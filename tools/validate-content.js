"use strict";
/* Checks every data file. Invalid items are reported with file and number, never silently dropped. Exit 1 on errors. */
const { SITE, read, list, path } = require("./lib");
const cat = read(path.join(SITE, "data/catalogue.json"));
const errors = [], warns = [], ids = new Set();
const err = (f, m) => errors.push(`${f}: ${m}`);
const aliasOf = (map, v) => { v = String(v || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); return map[v] || ""; };
const subjMap = {}, typeMap = {};
for (const id in cat.subjects) { subjMap[id.replace(/-/g, " ")] = id; (cat.subjects[id].aliases || []).forEach(a => subjMap[a.replace(/-/g, " ")] = id); }
for (const id in cat.resourceTypes) { typeMap[id.replace(/-/g, " ")] = id; (cat.resourceTypes[id].aliases || []).forEach(a => typeMap[a.toLowerCase().replace(/[^a-z0-9]+/g, " ")] = id); }
const claim = (f, id) => { if (ids.has(id)) err(f, `duplicate id ${id}`); ids.add(id); };
const ytOk = u => { try { const x = new URL(u); if (!/(^|\.)youtube\.com$|^youtu\.be$/.test(x.hostname)) return true; const id = x.hostname === "youtu.be" ? x.pathname.slice(1) : x.searchParams.get("v") || (x.pathname.match(/^\/(?:embed|shorts)\/([^/?]+)/) || [])[1]; return /^[A-Za-z0-9_-]{11}$/.test(id || ""); } catch (e) { return false; } };

for (const f of list(path.join(SITE, "data/exams"))) {
  const file = read(path.join(SITE, "data/exams", f));
  (file.sets || []).forEach((s, si) => {
    const where = `${f} set ${si + 1} (${s.id})`;
    claim(f, s.id);
    if (!cat.examLevels.some(l => l.id === s.level)) err(where, `unknown level ${s.level}`);
    else if (!cat.examLevels.find(l => l.id === s.level).subjects.includes(aliasOf(subjMap, s.subject))) err(where, `subject ${s.subject} is not offered at ${s.level}`);
    if (!["past-paper", "model", "chapter-quiz", "mock"].includes(s.kind)) err(where, `unknown kind ${s.kind}`);
    if (!["official", "reasoned"].includes(s.answerSource)) err(where, "answerSource must be official or reasoned");
    if (!(s.questions || []).length) err(where, "no questions (delete the set; files exist only when content exists)");
    const seenQ = new Set();
    (s.questions || []).forEach((q, i) => {
      const w = `${where} question ${i + 1}`;
      if (q.id) claim(f, q.id);
      if (typeof q.question !== "string" || !q.question.trim()) err(w, "question text missing");
      if (!Array.isArray(q.options) || q.options.length < 2 || !q.options.every(o => typeof o === "string" && o.trim())) { err(w, "needs 2 or more text options"); return; }
      if (new Set(q.options).size !== q.options.length) err(w, "duplicate options");
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) err(w, `answer ${q.answer} is outside the option list`);
      if (seenQ.has(q.question)) err(w, "duplicate question"); seenQ.add(q.question);
    });
  });
}
for (const f of list(path.join(SITE, "data/materials"))) {
  const file = read(path.join(SITE, "data/materials", f));
  if (!Number.isInteger(file.grade) || file.grade < 5 || file.grade > 12) err(f, "grade must be 5 to 12");
  Object.entries(file.subjects || {}).forEach(([sub, items]) => {
    if (!aliasOf(subjMap, sub)) err(f, `unknown subject ${sub}`);
    items.forEach((m, i) => {
      const w = `${f} ${sub} #${i + 1}`;
      if (!m.id || !m.title) { err(w, "id and title are required"); return; }
      claim(f, m.id);
      if (!aliasOf(typeMap, m.type || file.type)) err(w, `unknown type ${m.type || file.type}`);
      if (m.status !== "coming-soon" && m.status !== "draft" && !m.url) err(w, "url is required");
      if (m.url && !/^https:\/\//i.test(m.url)) err(w, "url must start with https://");
      if (m.url && !ytOk(m.url)) err(w, "malformed YouTube link");
      if (["video"].includes(aliasOf(typeMap, m.type || file.type)) && !m.permission) warns.push(`${w}: no permission stated`);
      if (!m.source) warns.push(`${w}: no source stated`);
    });
  });
}
warns.forEach(w => console.warn("warning: " + w));
if (errors.length) { errors.forEach(e => console.error("ERROR " + e)); console.error(`${errors.length} error(s)`); process.exit(1); }
console.log(`content ok (${ids.size} ids checked, ${warns.length} warning(s))`);
