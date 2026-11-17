const D = require("../server/db");
module.exports = async (req, res) => {
  try {
    await D.init();
    await D.endSession(req, res);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.setHeader("Set-Cookie", "hec_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
    res.status(200).json({ ok: true });
  }
};
