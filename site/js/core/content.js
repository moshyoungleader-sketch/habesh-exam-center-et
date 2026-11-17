/* Content loader: exam papers and learning materials are DATA (data/exams, data/materials).
   Adding content never needs a code change. Invalid items are skipped here and reported by tools/validate-content.js. */
(function () {
  "use strict";
  var HEC = window.HEC = window.HEC || {};
  var examIndexP = null, materialsP = null, setCache = {};

  function examIndex() {
    if (!examIndexP) examIndexP = HEC.catalogue.load().then(function () {
      return HEC.catalogue.fetchJSON(HEC.config.dataRoot + "exams/index.json").catch(function () { return { sets: [] }; });
    });
    return examIndexP;
  }
  /* Published exam papers for one level/subject (and optionally one E.C. year) */
  function findSets(query) {
    return examIndex().then(function (idx) {
      return (idx.sets || []).filter(function (s) {
        return s.status !== "draft" &&
          (!query.level || s.level === query.level) &&
          (!query.subject || HEC.catalogue.resolveSubject(s.subject) === HEC.catalogue.resolveSubject(query.subject)) &&
          (!query.year || Number(s.year) === Number(query.year)) &&
          (!query.kind || s.kind === query.kind);
      });
    });
  }
  /* The same malformed-question rules the old exam page applied */
  function normalizeQuestion(q, index) {
    if (!q || typeof q.question !== "string" || !Array.isArray(q.options) || q.options.length < 2) return null;
    var answer = Number(q.answer);
    if (!Number.isInteger(answer) || answer < 0 || answer >= q.options.length) return null;
    if (!q.options.every(function (o) { return typeof o === "string"; })) return null;
    if (q.status === "draft") return null;
    var out = { id: String(q.id || "q" + (index + 1)), topic: String(q.topic || "General"), question: q.question,
                options: q.options, answer: answer, explanation: String(q.explanation || "") };
    if (q.passage) out.passage = String(q.passage);
    if (q.image) out.image = String(q.image);
    return out;
  }
  /* entry (from the index) -> { set, questions } */
  function loadSet(entry) {
    var url = HEC.config.dataRoot + "exams/" + entry.file;
    if (!setCache[url]) setCache[url] = HEC.catalogue.fetchJSON(url);
    return setCache[url].then(function (file) {
      var set = (file.sets || []).find(function (s) { return s.id === entry.id; });
      if (!set) throw new Error("Set " + entry.id + " is not in " + entry.file);
      var passages = set.passages || {};
      var questions = (set.questions || []).map(normalizeQuestion).filter(Boolean).map(function (q, i) {
        var raw = set.questions.find(function (r) { return r && String(r.id) === q.id; }) || {};
        if (raw.passage && passages[raw.passage]) q.passageText = passages[raw.passage];
        return q;
      });
      return { set: set, questions: questions };
    });
  }

  /* ---- learning materials ---- */
  function materials() {
    if (!materialsP) materialsP = HEC.catalogue.load().then(function () {
      return HEC.catalogue.fetchJSON(HEC.config.dataRoot + "materials/index.json").catch(function () { return { files: [] }; });
    }).then(function (idx) {
      return Promise.all((idx.files || []).map(function (f) {
        return HEC.catalogue.fetchJSON(HEC.config.dataRoot + "materials/" + f).then(function (file) { return { f: f, file: file }; })
          .catch(function () { return null; });
      }));
    }).then(function (files) {
      var out = [], seen = {};
      files.filter(Boolean).forEach(function (x) {
        var file = x.file, grade = String(file.grade);
        Object.keys(file.subjects || {}).forEach(function (subjectKey) {
          var subject = HEC.catalogue.resolveSubject(subjectKey) || subjectKey;
          (file.subjects[subjectKey] || []).forEach(function (raw) {
            if (!raw || !raw.id || !raw.title || seen[raw.id] || raw.status === "draft") return;
            var type = HEC.catalogue.resolveType(raw.type || file.type);
            var url = String(raw.url || "");
            if (url && !/^https:\/\//i.test(url)) return;                     // https only
            if (!type) return;
            seen[raw.id] = true;
            var stream = HEC.util.normStream(raw.stream);
            out.push({ id: raw.id, title: raw.title, description: raw.description || "", type: type, typeLabel: HEC.catalogue.typeLabel(type),
              grade: grade, stream: stream, region: HEC.util.normRegion(raw.region), subject: subject,
              subjectName: HEC.catalogue.materialLabel(grade, stream, subject), url: url, status: raw.status || "published",
              available: !!url && raw.status !== "coming-soon", language: raw.language || "", unit: raw.unit, topic: raw.topic || "",
              duration: raw.duration || "", year: raw.year, playlist: raw.playlist || "", order: raw.order, source: raw.source || "",
              permission: raw.permission || "", image: (/^(https:\/\/|assets\/)/.test(String(raw.image||"")) ? String(raw.image) : "") });
          });
        });
      });
      return out;
    });
    return materialsP;
  }
  function materialsFor(subject, grade, stream, region) {
    var id = HEC.catalogue.resolveSubject(subject);
    return materials().then(function (all) {
      return all.filter(function (m) {
        return m.subject === id && (!grade || m.grade === String(grade)) && (!stream || !m.stream || m.stream === stream) &&
               (!region || !m.region || m.region === region);
      }).sort(function (a, b) { return (a.unit || 0) - (b.unit || 0) || (a.order || 0) - (b.order || 0); });
    });
  }
  /* "Study this next": materials of the same subject whose topic matches a topic the student got wrong */
  function materialsForTopics(subject, topics, grade, stream, region) {
    var wanted = topics.map(HEC.util.norm);
    return materialsFor(subject, grade, stream, region).then(function (list) {
      return list.filter(function (m) { return m.topic && wanted.indexOf(HEC.util.norm(m.topic)) !== -1; });
    });
  }
  /* One list for the global search: materials + exam papers */
  function searchIndex() {
    return Promise.all([materials().catch(function () { return []; }), examIndex().catch(function () { return { sets: [] }; })]).then(function (r) {
      var items = r[0].map(function (m) {
        return { label: m.title, detail: ["Grade " + m.grade, m.subjectName].filter(Boolean).join(" · "),
                 url: "resource-detail.html?id=" + encodeURIComponent(m.id), hay: [m.title, m.subjectName, m.description, "grade " + m.grade, m.typeLabel].join(" ") };
      });
      (r[1].sets || []).filter(function (s) { return s.status !== "draft"; }).forEach(function (s) {
        var lvl = HEC.catalogue.data && HEC.catalogue.data.examLevels.find(function (l) { return l.id === s.level; });
        var q = ["grade=" + (lvl ? lvl.grade : ""), lvl && lvl.region ? "region=" + lvl.region : "", lvl && lvl.stream ? "stream=" + lvl.stream : "", "subject=" + s.subject].filter(Boolean).join("&");
        items.push({ label: s.title + " · " + HEC.catalogue.subjectName(s.subject), detail: "Exam paper · Grade " + (lvl ? lvl.grade : ""),
                     url: "subject.html?" + q, hay: [s.title, HEC.catalogue.subjectName(s.subject), String(s.year), "exam paper"].join(" ") });
      });
      return items;
    });
  }

  HEC.content = { examIndex: examIndex, findSets: findSets, loadSet: loadSet, normalizeQuestion: normalizeQuestion,
    materials: materials, materialsFor: materialsFor, materialsForTopics: materialsForTopics, searchIndex: searchIndex };
})();
