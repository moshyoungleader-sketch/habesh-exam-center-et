const D = require("../server/db");
/* GET: the signed-in student's profile and results.
   POST: save profile changes and new results. The student is always the one in the session cookie. */
module.exports = async (req, res) => {
  try {
    await D.init();
    const uid = await D.currentUserId(req);
    if (!uid) return D.fail(res, 401, "Please log in again.");
    const sql = D.db();

    if (req.method === "GET") {
      const p = (await sql`SELECT email, full_name, grade, region, stream, preferences, study_plan, created_at FROM hec_users WHERE id = ${uid}`)[0];
      if (!p) return D.fail(res, 401, "Please log in again.");
      const attempts = await sql`SELECT id, data FROM hec_attempts WHERE user_id = ${uid} ORDER BY created_at ASC LIMIT 1000`;
      return res.status(200).json({
        email: p.email,
        profile: { full_name: p.full_name, grade: p.grade, region: p.region, stream: p.stream,
                   preferences: p.preferences, study_plan: p.study_plan, created_at: p.created_at },
        attempts: attempts
      });
    }

    if (req.method === "POST") {
      const b = req.body || {};
      if (b.profile) {
        const f = b.profile;
        await sql`UPDATE hec_users SET full_name = ${D.clean(f.full_name, 120)}, grade = ${D.clean(f.grade, 10)},
                    region = ${D.clean(f.region, 40)}, stream = ${D.clean(f.stream, 40)},
                    preferences = ${JSON.stringify(f.preferences || {})}::jsonb,
                    study_plan = ${JSON.stringify(Array.isArray(f.study_plan) ? f.study_plan.slice(0, 200) : [])}::jsonb,
                    updated_at = now()
                  WHERE id = ${uid}`;
      }
      const list = Array.isArray(b.attempts) ? b.attempts.slice(0, 50) : [];
      for (const a of list) {
        if (!a || !a.id || !a.data) continue;
        await sql`INSERT INTO hec_attempts (id, user_id, data, subject, grade, exam_type, exam_year, percentage, created_at)
                  VALUES (${D.clean(a.id, 80)}, ${uid}, ${JSON.stringify(a.data)}::jsonb, ${D.clean(a.subject, 40) || null},
                          ${D.clean(a.grade, 10)}, ${a.exam_type === "mock" ? "mock" : "practice"},
                          ${a.exam_year ? Number(a.exam_year) : null}, ${Math.round(Number(a.percentage) || 0)},
                          ${a.created_at ? new Date(a.created_at).toISOString() : new Date().toISOString()})
                  ON CONFLICT (id) DO NOTHING`;
      }
      return res.status(200).json({ ok: true, saved: list.length });
    }
    return D.fail(res, 405, "Method not allowed.");
  } catch (e) {
    console.error("sync failed:", e && e.message);
    D.fail(res, 500, "Could not save. It will be retried.");
  }
};
