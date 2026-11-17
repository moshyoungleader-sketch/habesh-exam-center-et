/* Exam engine: timer, navigation, answers, grading, and the saved attempt. No DOM in here, so it can be tested
   with a fake clock (tools/parity-test.js). Behaviour is taken from the exam page students use today
   (the old exam-engine.js was cut off mid-statement and never loaded). */
(function () {
  "use strict";
  var HEC = window.HEC = window.HEC || {};
  var DURATIONS = [15, 30, 45, 60, 90, 120];      // the existing time-limit selector

  function create(opts) {
    var questions = opts.questions, meta = opts.meta || {}, mode = opts.mode === "mock" ? "mock" : "practice";
    var st = { answers: {}, index: 0, remaining: 0, minutes: 30, started: false, submitted: false, startedAt: null, timer: null };
    var has = function (q) { return Object.prototype.hasOwnProperty.call(st.answers, q.id); };

    function counts() {
      var answered = questions.filter(has).length;
      return { total: questions.length, answered: answered, unanswered: questions.length - answered };
    }
    function start(minutes) {
      if (!questions.length || st.started) return false;
      st.minutes = Number(minutes) || 30;
      st.remaining = st.minutes * 60; st.startedAt = new Date().toISOString(); st.started = true;
      if (opts.autoTick !== false) st.timer = setInterval(tick, 1000);
      return true;
    }
    function tick() {                      // one second; the page (or a test) drives it
      if (!st.started || st.submitted || st.remaining <= 0) return;
      st.remaining--;
      if (opts.onTick) opts.onTick(st.remaining);
      if (st.remaining <= 0) { stopTimer(); if (opts.onExpire) opts.onExpire(); }
    }
    function stopTimer() { if (st.timer) { clearInterval(st.timer); st.timer = null; } }
    function clock() {                     // "MM:SS" and whether the 5-minute warning style applies
      var r = Math.max(0, st.remaining), m = Math.floor(r / 60), s = r % 60;
      return { text: String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0"), warning: st.remaining <= 300 };
    }
    function answer(optionIndex) { var q = questions[st.index]; if (q) st.answers[q.id] = optionIndex; }
    function clear() { var q = questions[st.index]; if (q) delete st.answers[q.id]; }
    function go(i) { if (i >= 0 && i < questions.length) st.index = i; return st.index; }
    function next() { return go(st.index + 1); }
    function prev() { return go(st.index - 1); }
    /* Practice-only feedback for the current question: null until the student has chosen an answer */
    function feedback() {
      var q = questions[st.index];
      if (!q || !has(q)) return null;
      var ok = st.answers[q.id] === q.answer;
      return { correct: ok, text: ok ? "Correct answer!" : "Not quite. Correct answer: " + String.fromCharCode(65 + q.answer) + ". " + q.options[q.answer],
               explanation: q.explanation || "No explanation has been added for this question yet." };
    }
    function buildAttempt(timedOut) {
      var r = HEC.util.scoreOf(questions, st.answers), completedAt = new Date().toISOString();
      var attempt = {
        id: "attempt_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
        subject: HEC.util.slug(meta.subject), subjectTitle: meta.subjectTitle || meta.subject,
        grade: String(meta.grade), region: meta.region || "", stream: meta.stream || "",
        examType: mode, totalQuestions: questions.length, correctAnswers: r.correct, percentage: r.percentage,
        startedAt: st.startedAt, completedAt: completedAt,
        durationSeconds: Math.max(0, st.minutes * 60 - st.remaining), timedOut: !!timedOut,
        answers: Object.assign({}, st.answers), questions: r.review,
        incorrectCount: r.answered - r.correct, unansweredCount: questions.length - r.answered      // new, additive
      };
      if (meta.year) { attempt.examYear = Number(meta.year); attempt.examSetId = meta.setId; attempt.examSetTitle = meta.setTitle; attempt.answerSource = meta.answerSource; }
      return attempt;
    }
    /* Returns { attempt, saved }. Practice attempts are always saved; Mock attempts are saved unless config says otherwise. */
    function finish(timedOut) {
      if (!st.started || st.submitted) return null;
      st.submitted = true; stopTimer();
      var attempt = buildAttempt(timedOut), save = mode === "practice" || HEC.config.saveMockAttempts;
      return { attempt: attempt, shouldSave: save };
    }
    function reopen() { st.submitted = false; }       // used when saving fails, so the student can try again
    return { questions: questions, mode: mode, state: st, counts: counts, start: start, tick: tick, clock: clock, stopTimer: stopTimer,
             answer: answer, clear: clear, go: go, next: next, prev: prev, feedback: feedback, finish: finish, reopen: reopen, buildAttempt: buildAttempt };
  }
  HEC.engine = { create: create, DURATIONS: DURATIONS };
})();
