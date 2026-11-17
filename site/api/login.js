const D = require("../server/db");
module.exports = async (req, res) => {
  if (req.method !== "POST") return D.fail(res, 405, "Method not allowed.");
  try {
    await D.init();
    const b = req.body || {};
    const email = D.clean(b.email, 254).toLowerCase();
    const rows = await D.db()`SELECT id, email, password_hash FROM hec_users WHERE email = ${email}`;
    if (!rows.length || !D.checkPassword(String(b.password || ""), rows[0].password_hash)) {
      return D.fail(res, 401, "Wrong email or password.");
    }
    await D.startSession(res, rows[0].id);
    res.status(200).json({ user: { id: rows[0].id, email: rows[0].email } });
  } catch (e) {
    console.error("login failed:", e && e.message);
    D.fail(res, 500, "Could not log in. Please try again.");
  }
};
