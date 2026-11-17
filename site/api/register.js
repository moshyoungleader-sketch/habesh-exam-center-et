const D = require("../server/db");
module.exports = async (req, res) => {
  if (req.method !== "POST") return D.fail(res, 405, "Method not allowed.");
  try {
    await D.init();
    const b = req.body || {};
    const email = D.clean(b.email, 254).toLowerCase();
    const password = String(b.password || "");
    const meta = b.meta || {};
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return D.fail(res, 400, "Enter a valid email address.");
    if (password.length < 6) return D.fail(res, 400, "Password must be at least 6 characters.");
    const taken = await D.db()`SELECT id FROM hec_users WHERE email = ${email}`;
    if (taken.length) return D.fail(res, 409, "An account with this email already exists. Log in instead.");
    const rows = await D.db()`INSERT INTO hec_users (email, password_hash, full_name, grade)
      VALUES (${email}, ${D.hashPassword(password)}, ${D.clean(meta.full_name, 120)}, ${D.clean(meta.grade, 10)})
      RETURNING id`;
    await D.startSession(res, rows[0].id);
    res.status(200).json({ user: { id: rows[0].id, email: email } });
  } catch (e) {
    console.error("register failed:", e && e.message);
    D.fail(res, 500, "Could not create the account. Please try again.");
  }
};
