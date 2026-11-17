"use strict";
/* A small stand-in for Supabase (Auth + the two tables) so the online mode can be tried and tested on your own computer
   without an account:   npm run mock   then set supabaseUrl to http://localhost:54321 and supabaseKey to anything in site/js/core/config.js.
   It mimics the real API shapes and the row-level-security rule (a student sees only their own rows). It is NOT Supabase and keeps data in memory only.
   Options (environment): CONFIRM_EMAIL=1 (sign-up needs email confirmation), EXPIRES=<seconds> (short sessions, to test token refresh), PORT. */
const http = require("http"), crypto = require("crypto");
const PORT = Number(process.env.PORT || 54321), EXPIRES = Number(process.env.EXPIRES || 3600), CONFIRM = !!process.env.CONFIRM_EMAIL;
const db = { users: [], profiles: [], attempts: [], tokens: {}, refresh: {} };
let counter = 0;
const uuid = () => crypto.randomUUID();

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "apikey, authorization, content-type, prefer, x-client-info", "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" });
  res.end(body === undefined ? "" : JSON.stringify(body));
}
const authErr = (res, status, code, msg) => send(res, status, { code: status, error_code: code, msg });
function session(user) {
  const at = "at_" + user.id + "_" + (++counter), rt = "rt_" + user.id + "_" + counter;
  db.tokens[at] = { uid: user.id, exp: Date.now() + EXPIRES * 1000 }; db.refresh[rt] = user.id;
  return { access_token: at, token_type: "bearer", expires_in: EXPIRES, expires_at: Math.floor(Date.now() / 1000) + EXPIRES, refresh_token: rt, user: pub(user) };
}
const pub = u => ({ id: u.id, email: u.email, user_metadata: u.meta });
function who(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || ""); const t = m && db.tokens[m[1]];
  return t && t.exp > Date.now() ? t.uid : null;
}
function filters(url) { const f = []; for (const [k, v] of url.searchParams) { const m = /^eq\.(.*)$/.exec(v); if (m && !["select", "order", "limit", "on_conflict"].includes(k)) f.push([k, m[1]]); } return f; }
const CHECKS = { profiles: r => ["", "6", "8", "12"].includes(r.grade ?? "") && ["", "amhara", "addis-ababa"].includes(r.region ?? "") && ["", "natural", "social"].includes(r.stream ?? "") };

http.createServer((req, res) => {
  if (req.method === "OPTIONS") return send(res, 204);
  const url = new URL(req.url, "http://x"); let raw = "";
  req.on("data", c => raw += c); req.on("end", () => {
    let body = null; try { body = raw ? JSON.parse(raw) : null; } catch (e) { return send(res, 400, { message: "bad json" }); }
    const p = url.pathname;
    if (p === "/__admin/dump") return send(res, 200, { users: db.users.map(pub), profiles: db.profiles, attempts: db.attempts });
    if (p === "/__admin/reset") { db.users = []; db.profiles = []; db.attempts = []; db.tokens = {}; db.refresh = {}; return send(res, 200, { ok: true }); }
    if (!req.headers.apikey) return send(res, 401, { message: "No API key found in request" });

    if (p === "/auth/v1/signup" && req.method === "POST") {
      const email = String(body.email || "").toLowerCase();
      if (!email || String(body.password || "").length < 6) return authErr(res, 422, "weak_password", "Password should be at least 6 characters.");
      if (db.users.some(u => u.email === email)) return authErr(res, 422, "user_already_exists", "User already registered");
      const user = { id: uuid(), email, password: body.password, meta: body.data || {} }; db.users.push(user);
      const g = user.meta.grade;   // the sign-up trigger
      db.profiles.push({ id: user.id, email, full_name: user.meta.full_name || "", grade: ["6", "8", "12"].includes(g) ? g : "", region: "", stream: "", preferences: {}, study_plan: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      return send(res, 200, CONFIRM ? pub(user) : session(user));
    }
    if (p === "/auth/v1/token" && req.method === "POST") {
      const gt = url.searchParams.get("grant_type");
      if (gt === "password") {
        const u = db.users.find(x => x.email === String(body.email || "").toLowerCase() && x.password === body.password);
        if (!u) return authErr(res, 400, "invalid_credentials", "Invalid login credentials");
        if (CONFIRM && !u.confirmed) return authErr(res, 400, "email_not_confirmed", "Email not confirmed");
        return send(res, 200, session(u));
      }
      if (gt === "refresh_token") {
        const uid = db.refresh[body.refresh_token]; const u = db.users.find(x => x.id === uid);
        if (!u) return authErr(res, 400, "refresh_token_not_found", "Invalid Refresh Token");
        delete db.refresh[body.refresh_token]; return send(res, 200, session(u));
      }
    }
    if (p === "/auth/v1/user" && req.method === "PUT") {
      const uid = who(req); if (!uid) return authErr(res, 401, "bad_jwt", "invalid JWT");
      if (String(body.password || "").length < 6) return authErr(res, 422, "weak_password", "Password should be at least 6 characters.");
      db.users.find(u => u.id === uid).password = body.password; return send(res, 200, { id: uid });
    }
    if (p === "/auth/v1/logout") return send(res, 204);

    const m = /^\/rest\/v1\/(profiles|attempts)$/.exec(p);
    if (m) {
      const table = m[1], uid = who(req), owner = table === "profiles" ? "id" : "user_id";
      if (!uid) return send(res, 401, { code: "PGRST301", message: "JWT required" });   // anonymous callers get nothing
      if (req.method === "GET") {
        let rows = db[table].filter(r => r[owner] === uid && filters(url).every(([k, v]) => String(r[k]) === v));
        if (url.searchParams.get("order") === "created_at.asc") rows = rows.slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
        return send(res, 200, rows.slice(0, Number(url.searchParams.get("limit") || 1000)));
      }
      if (req.method === "POST") {
        const rows = Array.isArray(body) ? body : [body], prefer = req.headers.prefer || "";
        for (const r of rows) {
          if (r[owner] !== uid) return send(res, 403, { code: "42501", message: "new row violates row-level security policy" });   // RLS
          if (CHECKS[table] && !CHECKS[table](r)) return send(res, 400, { code: "23514", message: "new row violates check constraint" });
          if (table === "attempts" && JSON.stringify(r.data || "").length > 400000) return send(res, 400, { code: "23514", message: "too large" });
        }
        for (const r of rows) {
          const i = db[table].findIndex(x => x.id === r.id);
          if (i === -1) db[table].push(Object.assign({ created_at: new Date().toISOString() }, r));
          else if (/merge-duplicates/.test(prefer)) db[table][i] = Object.assign({}, db[table][i], r);
          else if (!/ignore-duplicates/.test(prefer)) return send(res, 409, { code: "23505", message: "duplicate key" });
        }
        return send(res, 201);
      }
    }
    send(res, 404, { message: "not found" });
  });
}).listen(PORT, () => console.log(`Mock Supabase on http://localhost:${PORT}`));
