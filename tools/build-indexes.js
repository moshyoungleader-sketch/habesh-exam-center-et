"use strict";
/* Rebuilds data/exams/index.json and data/materials/index.json from the files that exist. Run: npm run build */
const { SITE, read, list, fs, path } = require("./lib");
const sets = [];
for (const f of list(path.join(SITE, "data/exams"))) {
  const file = read(path.join(SITE, "data/exams", f));
  for (const s of file.sets || []) sets.push({ id: s.id, file: f, level: s.level, subject: s.subject, year: s.year, kind: s.kind, title: s.title,
    questions: (s.questions || []).length, durationMinutes: s.durationMinutes, answerSource: s.answerSource || "reasoned", status: s.status || "published" });
}
fs.writeFileSync(path.join(SITE, "data/exams/index.json"), JSON.stringify({ sets }, null, 1) + "\n");
const files = list(path.join(SITE, "data/materials"));
fs.writeFileSync(path.join(SITE, "data/materials/index.json"), JSON.stringify({ files }, null, 1) + "\n");
console.log(`index: ${sets.length} exam set(s), ${files.length} materials file(s)`);
