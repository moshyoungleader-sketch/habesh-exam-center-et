"use strict";
/* Parity tests: the new core must behave like the old site. Run: npm test */
const { SITE, read, fs, path } = require("./lib");
const vm = require("vm"), assert = require("assert");
let passed = 0; const t = (name, fn) => { fn(); passed++; console.log("ok -", name); };

function load(storage = {}) {
  const ls = { getItem: k => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = String(v); }, removeItem: k => { delete storage[k]; } };
  const win = { localStorage: ls, document: { documentElement: { setAttribute() {} } }, crypto: undefined, atob, btoa, TextEncoder };
  win.window = win; win.location = { replace() {} };
  const ctx = vm.createContext(Object.assign(win, { localStorage: ls, console }));
  for (const m of ["config", "util", "store", "exam-engine"]) vm.runInContext(fs.readFileSync(path.join(SITE, "js/core", m + ".js"), "utf8"), ctx);
  return { HEC: ctx.HEC, storage };
}
const set = read(path.join(SITE, "data/exams/2017-g8.json")).sets[0];

/* The old grading code, copied from exam.html's inline script, as the reference */
function oldGrade(questions, answers) {
  let correctAnswers = 0;
  const review = questions.map(q => {
    const selected = Object.prototype.hasOwnProperty.call(answers, q.id) ? answers[q.id] : null;
    const isCorrect = selected === q.answer; if (isCorrect) correctAnswers++;
    return { id: q.id, topic: q.topic, question: q.question, options: q.options, selectedAnswer: selected, correctAnswer: q.answer, isCorrect, explanation: q.explanation };
  });
  return { correctAnswers, percentage: Math.round((correctAnswers / questions.length) * 100), review };
}
const qs = set.questions.map(q => Object.assign({ explanation: "" }, q));

t("60 real questions migrated", () => assert.strictEqual(set.questions.length, 60));
t("golden: all-correct, all-wrong, half, none answered match the old grader", () => {
  const { HEC } = load();
  const cases = [qs.reduce((a, q) => (a[q.id] = q.answer, a), {}), qs.reduce((a, q) => (a[q.id] = (q.answer + 1) % q.options.length, a), {}),
    qs.slice(0, 30).reduce((a, q) => (a[q.id] = q.answer, a), {}), {}];
  cases.forEach(ans => {
    const o = oldGrade(qs, ans), n = HEC.util.scoreOf(qs, ans);
    assert.strictEqual(n.correct, o.correctAnswers); assert.strictEqual(n.percentage, o.percentage);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(n.review)), JSON.parse(JSON.stringify(o.review)));
  });
});
t("F1: every historic region spelling resolves to one id", () => {
  const { HEC } = load();
  ["addis", "Addis Ababa", "addis_ababa", "addis-ababa"].forEach(v => assert.strictEqual(HEC.util.normRegion(v), "addis-ababa"));
  ["Amhara", "amhara"].forEach(v => assert.strictEqual(HEC.util.normRegion(v), "amhara"));
  ["natural", "natural-science", "Natural Science"].forEach(v => assert.strictEqual(HEC.util.normStream(v), "natural"));
  assert.strictEqual(HEC.util.normRegion("nowhere"), "");
});
t("F3: weak-topic data is found under either historic attempt shape", () => {
  const { HEC } = load();
  assert.strictEqual(HEC.util.reviewOf({ questions: [{ topic: "a" }] }).length, 1);
  assert.strictEqual(HEC.util.reviewOf({ review: [{}, {}] }).length, 2);
  assert.strictEqual(HEC.util.correctOf({ correct: 7 }), 7); assert.strictEqual(HEC.util.correctOf({ correctAnswers: 5 }), 5);
});
t("old-format account loads unchanged; a backup is taken once; no existing key is renamed", () => {
  const old = JSON.stringify([{ id: "u1", email: "a@b.c", password: "secret123", grade: "8", region: "addis", examHistory: [{ id: "x", percentage: 50 }], studyPlan: [], preferences: { theme: "dark" } }]);
  const { HEC, storage } = load({ hec_users: old, hec_current_user: "u1", hec_current_selection: JSON.stringify({ grade: "8", region: "addis", stream: "" }) });
  assert.strictEqual(storage.hec_users_backup_v1, old); assert.strictEqual(storage.hec_users, old);
  assert.strictEqual(HEC.store.currentUser().email, "a@b.c");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(HEC.store.getSelection())), { grade: "8", region: "addis-ababa", stream: "" });
  assert.strictEqual(storage.hec_schema_version, "1");
});
t("engine: timer counts down, warns at 5 minutes, expires once (fake clock)", () => {
  const { HEC } = load(); let expired = 0;
  const e = HEC.engine.create({ questions: qs, mode: "practice", autoTick: false, meta: { grade: "8", subject: "citizenship" }, onExpire: () => expired++ });
  e.start(15); assert.strictEqual(e.clock().text, "15:00"); assert.strictEqual(e.clock().warning, false);
  for (let i = 0; i < 600; i++) e.tick(); assert.strictEqual(e.clock().text, "05:00"); assert.strictEqual(e.clock().warning, true);
  for (let i = 0; i < 400; i++) e.tick(); assert.strictEqual(expired, 1); assert.strictEqual(e.clock().text, "00:00");
});
t("engine: navigation, clear, feedback", () => {
  const { HEC } = load();
  const e = HEC.engine.create({ questions: qs, mode: "practice", autoTick: false, meta: { grade: "8", subject: "citizenship" } });
  e.start(30); assert.strictEqual(e.feedback(), null); e.answer(qs[0].answer); assert.strictEqual(e.feedback().correct, true);
  e.next(); assert.strictEqual(e.state.index, 1); e.prev(); e.prev(); assert.strictEqual(e.state.index, 0);
  e.clear(); assert.strictEqual(e.counts().answered, 0);
});
t("practice attempt has the old shape plus additive fields", () => {
  const { HEC } = load();
  const e = HEC.engine.create({ questions: qs, mode: "practice", autoTick: false, meta: { grade: "8", region: "amhara", subject: "citizenship", subjectTitle: "Civics", year: 2017, setId: set.id, setTitle: set.title, answerSource: "reasoned" } });
  e.start(30); e.answer(qs[0].answer);
  const { attempt, shouldSave } = e.finish(false);
  assert.ok(shouldSave); assert.strictEqual(attempt.examType, "practice"); assert.strictEqual(attempt.totalQuestions, 60);
  ["id", "subject", "subjectTitle", "grade", "region", "stream", "correctAnswers", "percentage", "startedAt", "completedAt", "durationSeconds", "timedOut", "answers", "questions"].forEach(k => assert.ok(k in attempt, k));
  assert.strictEqual(attempt.unansweredCount, 59); assert.strictEqual(attempt.examYear, 2017);
});
t("addendum: Mock attempts are saved, labelled mock, and appear in history storage", () => {
  const user = { id: "u1", examHistory: [] };
  const { HEC, storage } = load({ hec_users: JSON.stringify([user]), hec_current_user: "u1" });
  const e = HEC.engine.create({ questions: qs, mode: "mock", autoTick: false, meta: { grade: "12", stream: "natural", subject: "physics", year: 2018, setId: "s", setTitle: "t" } });
  e.start(30); e.answer(0);
  const r = e.finish(false); assert.strictEqual(r.shouldSave, true);
  HEC.store.addAttempt(user, r.attempt);
  const saved = JSON.parse(storage.hec_users)[0].examHistory; assert.strictEqual(saved.length, 1);
  assert.strictEqual(saved[0].examType, "mock"); assert.strictEqual(storage.hec_last_attempt_id, r.attempt.id);
  assert.ok(saved[0].correctAnswers >= 0 && saved[0].unansweredCount === 59 && saved[0].grade === "12");
});
t("catalogue: every exam level subject exists; years offered are 2017 and 2018", () => {
  const cat = read(path.join(SITE, "data/catalogue.json")), { HEC } = load();
  cat.examLevels.forEach(l => l.subjects.forEach(s => assert.ok(cat.subjects[s], s)));
  assert.deepStrictEqual(Array.from(HEC.config.examYears), [2017, 2018]);
  assert.strictEqual(cat.examLevels.length, 6);
});
t("addendum subject names are kept exactly", () => {
  const cat = read(path.join(SITE, "data/catalogue.json")), L = g => cat.materialLevels.find(l => l.grade === g);
  assert.ok(L(5).subjects.some(s => s.label === "Performing and Visual Arts (PVA)"));
  assert.ok(L(8).subjects.some(s => s.label === "Career and Technical Education (CTE)"));
  assert.ok(L(9).subjects.some(s => s.label === "Amharic / Mother Tongue"));
  assert.ok(L(12).streams.natural.some(s => s.label === "Agriculture"));
});
console.log(`\n${passed} passed`);
