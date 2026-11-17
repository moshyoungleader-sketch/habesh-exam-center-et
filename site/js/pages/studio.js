/* studio.html: turns a form into JSON you commit to data/. It validates as you type and cannot publish by itself. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const FILE_PREFIX = { video: "video", notes: "notes", textbook: "textbook", "teacher-guide": "textbook", "past-paper": "papers" };
  let current = { file: "", text: "" };

  const opt = (select, value, label) => select.append(Object.assign(document.createElement("option"), { value, textContent: label }));
  const fill = (select, rows) => { select.replaceChildren(); rows.forEach(r => opt(select, r[0], r[1])); };
  function checks(box, list) {
    box.replaceChildren(...list.map(([ok, text]) => Object.assign(document.createElement("div"), { className: ok ? "ok" : "bad", textContent: (ok ? "✓ " : "✗ ") + text })));
  }
  async function existing(path) { try { const r = await fetch(path, { cache: "no-cache" }); return r.ok ? await r.json() : null; } catch (e) { return null; } }
  const show = (file, obj, where) => {
    current = { file, text: JSON.stringify(obj, null, 2) + "\n" };
    $("out").value = current.text;
    $("outWhere").textContent = where;
  };
  function tab(name) {
    document.querySelectorAll(".subject-tabs [data-tab]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === name)));
    document.querySelectorAll(".subject-pane").forEach(p => { p.hidden = p.id !== "tab-" + name; });
    update();
  }

  /* ---------- materials ---------- */
  function subjects() {
    const g = $("mGrade").value, streamed = g === "11" || g === "12";
    $("mStreamWrap").hidden = !streamed;
    const keep = $("mSubject").value;
    fill($("mSubject"), HEC.catalogue.materialSubjects(g, streamed ? $("mStream").value : "").map(s => [s.id, s.label]));
    if ([...$("mSubject").options].some(o => o.value === keep)) $("mSubject").value = keep;
  }
  function nextId(file, grade, subject, type) {
    const code = { video: "v", notes: "n", textbook: "t", "teacher-guide": "tg", "past-paper": "pp" }[type];
    const used = file ? Object.values(file.subjects || {}).flat().map(e => e.id) : [];
    let n = 1; const base = `g${grade}-${subject}-${code}`;
    while (used.includes(base + String(n).padStart(3, "0"))) n++;
    return base + String(n).padStart(3, "0");
  }
  function youtubeProblem(url) {
    if (!/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(url)) return "";
    return HEC.video.youtubeId(url) ? "" : "That looks like a YouTube link, but the 11-character video id could not be found.";
  }
  async function materialOutput(entries, list, type, grade, stream, subject, box) {
    const name = `${FILE_PREFIX[type]}-g${grade}.json`, path = `data/materials/${name}`;
    const file = (await existing(path)) || { type: FILE_PREFIX[type] === "papers" ? "past-paper" : FILE_PREFIX[type], grade: Number(grade), subjects: {} };
    const ids = Object.values(file.subjects).flat().map(e => e.id);
    entries.forEach(e => { if (ids.includes(e.id)) list.push([false, `The id ${e.id} is already used.`]); });
    (file.subjects[subject] = file.subjects[subject] || []).push(...entries);
    checks(box, list);
    show(name, file, `Save this as ${path} (replace the whole file), then run npm run check and commit. After pasting, the new entry${entries.length > 1 ? "ies are" : " is"} live.`);
  }
  async function updateMaterial() {
    const type = $("mType").value, grade = $("mGrade").value, stream = $("mStream").value, subject = $("mSubject").value;
    const title = $("mTitle").value.trim(), url = $("mUrl").value.trim();
    const list = [[!!title, "Title is filled in."], [/^https:\/\//i.test(url), "Link starts with https://."]];
    const yt = youtubeProblem(url); if (yt) list.push([false, yt]);
    if (type === "video" && !$("mPermission").value) list.push([false, "Permission is not stated (recommended: say whether you may embed this video)."]);
    if (!$("mSource").value.trim()) list.push([false, "Say who made it (recommended)."]);
    if (!title || !/^https:\/\//i.test(url)) { checks($("mChecks"), list); return; }
    const file = await existing(`data/materials/${FILE_PREFIX[type]}-g${grade}.json`);
    const entry = { id: nextId(file, grade, subject, type), type, title, url };
    if (stream && (grade === "11" || grade === "12")) entry.stream = stream;
    [["language", "mLang"], ["topic", "mTopic"], ["source", "mSource"], ["permission", "mPermission"]].forEach(([k, id]) => { if ($(id).value.trim()) entry[k] = $(id).value.trim(); });
    if ($("mUnit").value) entry.unit = Number($("mUnit").value);
    entry.status = "published";
    await materialOutput([entry], list, type, grade, stream, subject, $("mChecks"));
  }
  async function updatePlaylist() {
    const type = $("mType").value, grade = $("mGrade").value, stream = $("mStream").value, subject = $("mSubject").value;
    const lines = $("pLines").value.split("\n").map(l => l.trim()).filter(Boolean), list = [];
    const file = await existing(`data/materials/${FILE_PREFIX[type]}-g${grade}.json`);
    const entries = [], base = nextId(file, grade, subject, type), start = Number(base.slice(-3));
    const prefix = base.slice(0, -3);
    lines.forEach((line, i) => {
      const [url, title] = line.split("|").map(s => (s || "").trim());
      const bad = !/^https:\/\//i.test(url || "") ? "needs an https:// link" : !title ? "needs a title after |" : youtubeProblem(url);
      list.push([!bad, `Line ${i + 1}: ${bad || "ok"}`]);
      if (!bad) {
        const e = { id: prefix + String(start + entries.length).padStart(3, "0"), type, title, url };
        if (stream && (grade === "11" || grade === "12")) e.stream = stream;
        if ($("pName").value.trim()) e.playlist = $("pName").value.trim();
        e.order = entries.length + 1; e.status = "published"; entries.push(e);
      }
    });
    if (!entries.length) { checks($("pChecks"), list.length ? list : [[false, "Paste at least one line."]]); return; }
    await materialOutput(entries, list, type, grade, stream, subject, $("pChecks"));
  }

  /* ---------- exam paper ---------- */
  function parseRows(text) {
    const questions = [], problems = [];
    text.split("\n").map(l => l.trim()).filter(Boolean).forEach((line, i) => {
      const p = line.split("|").map(s => s.trim()), n = i + 1;
      const letterAt = p.findIndex((x, k) => k >= 3 && /^[A-F]$/.test(x));
      if (p.length < 4 || letterAt === -1) { problems.push(`Question ${n}: use  question | A | B | C | D | answer letter | explanation | topic`); return; }
      const options = p.slice(1, letterAt), answer = p[letterAt].toUpperCase().charCodeAt(0) - 65;
      if (!p[0]) problems.push(`Question ${n}: the question text is empty.`);
      else if (answer >= options.length) problems.push(`Question ${n}: the answer letter is outside the options.`);
      else if (new Set(options).size !== options.length) problems.push(`Question ${n}: two options are identical.`);
      else {
        const q = { id: "", topic: p[letterAt + 2] || "General", question: p[0], options, answer };
        if (p[letterAt + 1]) q.explanation = p[letterAt + 1];
        questions.push(q);
      }
    });
    return { questions, problems };
  }
  function examSubjects() {
    const level = HEC.catalogue.data.examLevels.find(l => l.id === $("eLevel").value);
    const keep = $("eSubject").value;
    fill($("eSubject"), (level ? level.subjects : []).map(id => [id, HEC.catalogue.subjectName(id)]));
    if ([...$("eSubject").options].some(o => o.value === keep)) $("eSubject").value = keep;
  }
  async function updateExam() {
    const levelId = $("eLevel").value, subject = $("eSubject").value, year = $("eYear").value, kind = $("eKind").value;
    const level = HEC.catalogue.data.examLevels.find(l => l.id === levelId), title = $("eTitle").value.trim();
    const { questions, problems } = parseRows($("eRows").value);
    const list = [[!!title, "Paper title is filled in."], ...problems.map(p => [false, p])];
    if (questions.length) list.push([true, questions.length + " question(s) read correctly."]);
    if (!title || !questions.length) { checks($("eChecks"), list); return; }
    const name = `${year}-g${level.grade}.json`, path = `data/exams/${name}`;
    const file = (await existing(path)) || { year: Number(year), grade: level.grade, sets: [] };
    const id = `${levelId}-${subject}-${year}` + (kind === "past-paper" ? "" : "-" + kind);
    questions.forEach((q, i) => { q.id = `${id}-${String(i + 1).padStart(3, "0")}`; });
    const set = { id, level: levelId, subject, title, kind, year: Number(year), answerSource: $("eAnswers").value,
                  durationMinutes: Number($("eMinutes").value) || 60, status: "published", questions };
    const at = file.sets.findIndex(s => s.id === id);
    if (at === -1) file.sets.push(set); else { file.sets[at] = set; list.push([true, "This replaces the existing paper with the same id."]); }
    checks($("eChecks"), list);
    show(name, file, `Save this as ${path}, run npm run check (it rebuilds data/exams/index.json), then commit.`);
  }

  function update() {
    const open = document.querySelector(".subject-pane:not([hidden])").id;
    ({ "tab-material": updateMaterial, "tab-playlist": updatePlaylist, "tab-exam": updateExam }[open] || (() => {}))();
  }
  async function init() {
    await HEC.catalogue.load();
    const cat = HEC.catalogue.data;
    fill($("mType"), Object.keys(cat.resourceTypes).map(id => [id, cat.resourceTypes[id].label]));
    fill($("mGrade"), [5, 6, 7, 8, 9, 10, 11, 12].map(g => [String(g), "Grade " + g]));
    fill($("mStream"), HEC.config.streams.map(s => [s.id, s.label]));
    fill($("eLevel"), cat.examLevels.map(l => [l.id, `Grade ${l.grade} · ${HEC.util.regionLabel(l.region) || HEC.util.streamLabel(l.stream)}`]));
    fill($("eYear"), HEC.config.examYears.map(y => [String(y), y + " E.C."]));
    $("mGrade").value = "8"; subjects(); examSubjects();
    $("mGrade").addEventListener("change", subjects); $("mStream").addEventListener("change", subjects);
    $("eLevel").addEventListener("change", examSubjects);
    document.querySelectorAll("input, select, textarea").forEach(f => { if (f.id !== "out") f.addEventListener("input", update); f.addEventListener("change", update); });
    document.querySelectorAll(".subject-tabs [data-tab]").forEach(b => b.addEventListener("click", () => tab(b.dataset.tab)));
    $("copyBtn").addEventListener("click", async () => { try { await navigator.clipboard.writeText(current.text); $("outWhere").textContent += " Copied."; } catch (e) { $("out").select(); document.execCommand("copy"); } });
    $("downloadBtn").addEventListener("click", () => {
      if (!current.text) return;
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([current.text], { type: "application/json" })), download: current.file });
      document.body.append(a); a.click(); a.remove();
    });
  }
  init();
})();
