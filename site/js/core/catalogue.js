/* The catalogue: exam levels, subjects, resource types (data/catalogue.json). One set of ids for the whole site. */
(function () {
  "use strict";
  var HEC = window.HEC = window.HEC || {};
  var promise = null, data = null, subjectAlias = {}, typeAlias = {};

  function fetchJSON(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(url + " (" + r.status + ")");
      return r.json();
    });
  }
  function load() {
    if (!promise) promise = fetchJSON(HEC.config.dataRoot + "catalogue.json").then(function (cat) {
      data = cat;
      Object.keys(cat.subjects).forEach(function (id) {
        subjectAlias[HEC.util.norm(id)] = id;
        (cat.subjects[id].aliases || []).forEach(function (a) { subjectAlias[HEC.util.norm(a)] = id; });
      });
      Object.keys(cat.resourceTypes).forEach(function (id) {
        typeAlias[HEC.util.norm(id)] = id;
        (cat.resourceTypes[id].aliases || []).forEach(function (a) { typeAlias[HEC.util.norm(a)] = id; });
      });
      return cat;
    });
    return promise;
  }
  /* Any historic spelling of a subject ("citizenship-education", "ICT") -> canonical id, or "" if unknown */
  function resolveSubject(value) { return subjectAlias[HEC.util.norm(value)] || ""; }
  function resolveType(value) { return typeAlias[HEC.util.norm(value)] || ""; }
  function subjectName(id) { var s = data && data.subjects[resolveSubject(id) || id]; return s ? s.name : String(id || ""); }
  function typeLabel(id) { var t = data && data.resourceTypes[id]; return t ? t.label : String(id || ""); }

  /* selection {grade, region, stream} -> level id, e.g. "g8-amhara", "g12-natural" */
  function examLevel(sel) {
    if (!data || !sel) return null;
    var region = HEC.util.normRegion(sel.region), stream = HEC.util.normStream(sel.stream);
    return data.examLevels.find(function (l) {
      return String(l.grade) === String(sel.grade) && (l.region ? l.region === region : true) && (l.stream ? l.stream === stream : true);
    }) || null;
  }
  function examSubjects(sel) {
    var level = examLevel(sel);
    return level ? level.subjects.map(function (id) { return Object.assign({ id: id }, data.subjects[id]); }) : [];
  }
  /* label list for the Learning Resources filters: exactly the names supplied, per grade (and stream for 11-12) */
  function materialSubjects(grade, stream) {
    var level = data && data.materialLevels.find(function (l) { return String(l.grade) === String(grade); });
    if (!level) return [];
    if (level.streams) {
      var s = HEC.util.normStream(stream);
      return s ? level.streams[s] : level.streams.natural.concat(level.streams.social.filter(function (x) {
        return !level.streams.natural.some(function (y) { return y.id === x.id && y.label === x.label; }); }));
    }
    return level.subjects;
  }
  function materialLabel(grade, stream, id) {
    var f = materialSubjects(grade, stream).find(function (x) { return x.id === id; });
    return f ? f.label : subjectName(id);
  }

  HEC.catalogue = { load: load, resolveSubject: resolveSubject, resolveType: resolveType, subjectName: subjectName, typeLabel: typeLabel,
    examLevel: examLevel, examSubjects: examSubjects, materialSubjects: materialSubjects, materialLabel: materialLabel,
    fetchJSON: fetchJSON, get data() { return data; } };
})();
