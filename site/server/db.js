/* Shared server helpers for the account API (Vercel functions in /api).
   Database: Neon Postgres, connected to the Vercel project (DATABASE_URL). Tables are created on first use. */
const crypto = require("crypto");
const { neon } = require("@neondatabase/serverless");

let sql = null, ready = null;
const COOKIE = "hec_session", SESSION_DAYS = 30;

function db() {
  if (!sql) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED;
    if (!url) throw new Error("Database is not connected to this project.");
    sql = neon(url);
  }
  return sql;
}

function init() {
  if (!ready) {
    ready = (async () => {
      const s = db();
      await s`CREATE TABLE IF NOT EXISTS hec_users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text UNIQUE NOT NULL,
        password_hash text NOT NULL,
        full_name text NOT NULL DEFAULT '',
        grade text NOT NULL DEFAULT '',
        region text NOT NULL DEFAULT '',
        stream text NOT NULL DEFAULT '',
        preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
        study_plan jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`;
      await s`CREATE TABLE IF NOT EXISTS hec_sessions (
        token_hash text PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES hec_users(id) ON DELETE CASCADE,
        expires_at timestamptz NOT NULL
      )`;
      await s`CREATE TABLE IF NOT EXISTS hec_attempts (
        id text PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES hec_users(id) ON DELETE CASCADE,
        data jsonb NOT NULL,
        subject text,
        grade text,
        exam_type text,
        exam_year int,
        percentage int,
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
      await s`CREATE INDEX IF NOT EXISTS hec_attempts_user ON hec_attempts (user_id, created_at)`;
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

/* Passwords: scrypt with a random salt, stored as scrypt$salt$hash. */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("base64");
  return "scrypt$" + salt + "$" + hash;
}
function checkPassword(password, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const h = crypto.scryptSync(String(password), parts[1], 64);
  const want = Buffer.from(parts[2], "base64");
  return want.length === h.length && crypto.timingSafeEqual(want, h);
}

/* Sessions: a random token in an HttpOnly cookie. Only its SHA-256 hash is stored. */
function tokenHash(t) { return crypto.createHash("sha256").update(t).digest("hex"); }
function readCookie(req) {
  const m = String(req.headers.cookie || "").match(new RegExp("(?:^|;\\s*)" + COOKIE + "=([^;]+)"));
  return m ? m[1] : null;
}
function setCookie(res, value, maxAge) {
  res.setHeader("Set-Cookie", COOKIE + "=" + value + "; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=" + maxAge);
}
async function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  await db()`INSERT INTO hec_sessions (token_hash, user_id, expires_at)
             VALUES (${tokenHash(token)}, ${userId}, now() + make_interval(days => ${SESSION_DAYS}))`;
  setCookie(res, token, SESSION_DAYS * 24 * 3600);
}
async function currentUserId(req) {
  const t = readCookie(req);
  if (!t) return null;
  const rows = await db()`SELECT user_id FROM hec_sessions WHERE token_hash = ${tokenHash(t)} AND expires_at > now()`;
  return rows.length ? rows[0].user_id : null;
}
async function endSession(req, res) {
  const t = readCookie(req);
  if (t) await db()`DELETE FROM hec_sessions WHERE token_hash = ${tokenHash(t)}`;
  setCookie(res, "", 0);
}

function fail(res, code, msg) { res.status(code).json({ msg: msg }); }
function clean(v, max) { return String(v == null ? "" : v).trim().slice(0, max || 200); }

module.exports = { db, init, hashPassword, checkPassword, startSession, currentUserId, endSession, fail, clean };
