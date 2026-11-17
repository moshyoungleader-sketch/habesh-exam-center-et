/* Small shared helpers: text, ids, scoring. One copy for every page. */
(function () {
  "use strict";
  var HEC = window.HEC = window.HEC || {};

  function escapeHTML(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  /* "Civics & Ethics" -> "civics-and-ethics" (same rule the old exam page used for file names) */
  function slug(value) {
    return String(value || "").toLowerCase().trim().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  /* Search normaliser: lower case, accents removed, only letters and digits */
  function norm(value) {
    return String(value || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
  }
  /* Word-start matching, as the global search and the Resources filter always did */
  function startsAtWord(label, query) {
    var value = norm(label), terms = norm(query).split(" ").filter(Boolean);
    if (!terms.length) return true;
    if (value.indexOf(terms.join(" ")) === 0 || value.indexOf(" " + terms.join(" ")) !== -1) return true;
    var words = value.split(" ");
    return terms.every(function (t) { return words.some(function (w) { return w.indexOf(t) === 0; }); });
  }
  function resolveAlias(list, value) {
    var v = norm(value);
    if (!v) return "";
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (norm(item.id) === v || norm(item.label) === v || (item.aliases || []).some(function (a) { return norm(a) === v; })) return item.id;
    }
    return "";
  }
  function normRegion(value) { return resolveAlias(HEC.config.regions, value); }
  function normStream(value) { return resolveAlias(HEC.config.streams, value); }
  function labelOf(list, id) { var f = list.find(function (x) { return x.id === id; }); return f ? f.label : ""; }
  function regionLabel(value) { return labelOf(HEC.config.regions, normRegion(value)); }
  function streamLabel(value) { return labelOf(HEC.config.streams, normStream(value)); }

  /* Saved attempts exist in two historic shapes: review list under "questions" (written by exam page) or "review";
     correct count under "correctAnswers" or "correct". Every page reads them through these two functions. */
  function reviewOf(attempt) {
    if (!attempt) return [];
    if (Array.isArray(attempt.review)) return attempt.review;
    return Array.isArray(attempt.questions) ? attempt.questions : [];
  }
  function correctOf(attempt) {
    if (!attempt) return 0;
    var n = Number(attempt.correctAnswers != null ? attempt.correctAnswers : attempt.correct);
    return Number.isFinite(n) ? n : 0;
  }
  /* Grade a set of answers. Identical arithmetic to the old exam page: rounded percentage of correct answers. */
  function scoreOf(questions, answers) {
    var correct = 0;
    var review = questions.map(function (q) {
      var has = Object.prototype.hasOwnProperty.call(answers, q.id);
      var selected = has ? answers[q.id] : null;
      var isCorrect = selected === q.answer;
      if (isCorrect) correct++;
      return { id: q.id, topic: q.topic, question: q.question, options: q.options, selectedAnswer: selected,
               correctAnswer: q.answer, isCorrect: isCorrect, explanation: q.explanation };
    });
    var total = questions.length;
    return { correct: correct, total: total, answered: review.filter(function (r) { return r.selectedAnswer !== null; }).length,
             percentage: total ? Math.round((correct / total) * 100) : 0, review: review };
  }

  HEC.util = Object.freeze({ escapeHTML: escapeHTML, slug: slug, norm: norm, startsAtWord: startsAtWord,
    normRegion: normRegion, normStream: normStream, regionLabel: regionLabel, streamLabel: streamLabel,
    reviewOf: reviewOf, correctOf: correctOf, scoreOf: scoreOf });
})();
