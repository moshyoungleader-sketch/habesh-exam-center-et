const D = require("../server/db");
module.exports = async (req, res) => {
  if (req.method !== "POST") return D.fail(res, 405, "Method not allowed.");
  try {
    await D.init();
    const uid = await D.currentUserId(req);
    if (!uid) return D.fail(res, 401, "Please log in again.");
    const password = String((req.body || {}).password || "");
    if (password.length < 6) return D.fail(res, 400, "Password must be at least 6 characters.");
    await D.db()`UPDATE hec_users SET password_hash = ${D.hashPassword(password)}, updated_at = now() WHERE id = ${uid}`;
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("password change failed:", e && e.message);
    D.fail(res, 500, "Your password could not be changed.");
  }
};
