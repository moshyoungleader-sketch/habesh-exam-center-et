/* exam.html: load a paper, set up the timer, take the exam, save the attempt. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const user = HEC.store.requireUser();
  if (!user) return;

  const params = new URLSearchParams(location.search);
  const picked = HEC.store.get(HEC.store.keys.exam, {}) || {};
  const examType = params.get("type") === "mock" ? "mock" : "practice";
  const grade = params.get("grade") || picked.grade || user.grade || "";
  const region = HEC.util.normRegion(params.get("region") || picked.region || user.region || "");
  const stream = HEC.util.normStream(params.get("stream") || picked.stream || user.stream || "");
  const yearParam = params.get("year") || "";
  let subject = params.get("subject") || picked.subject || "";
  let subjectTitle = params.get("title") || picked.subjectTitle || subject;
  let engine = null, entry = null, loaded = null;

  function showNotice(message, type) {
    $("notice").textContent = message;
    $("notice").className = "notice" + (type ? " " + type : "");
    $("notice").classList.remove("hidden");
  }
  function showEmpty(message) {
    $("setupPanel").classList.add("hidden");
    $("examArea").classList.add("hidden");
    $("emptyPanel").classList.remove("hidden");
    $("emptyMessage").textContent = message;
  }
  function contextLine(count) {
    return `Grade ${grade}` + (region && String(grade) !== "12" ? ` · ${HEC.util.regionLabel(region)}` : "") +
      (stream ? ` · ${HEC.util.streamLabel(stream)}` : "") + (entry && entry.year ? ` · ${entry.year} E.C.` : "") +
      (examType === "mock" ? " · Mock exam" : "") + ` · ${count} questions`;
  }

  async function loadPaper() {
    await HEC.catalogue.load();
    const level = HEC.catalogue.examLevel({ grade, region, stream });
    const id = HEC.catalogue.resolveSubject(subject);
    if (!level || !subject || !id) { showEmpty("Choose a grade and subject first, then select an exam."); return; }
    subject = id;
    if (!params.get("title") && !picked.subjectTitle) subjectTitle = HEC.catalogue.subjectName(id);

    const sets = await HEC.content.findSets({ level: level.id, subject: id, year: yearParam });
    if (!sets.length) {
      showEmpty(yearParam
        ? `The ${yearParam} E.C. paper for ${subjectTitle} has not been created yet. Choose another year or subject.`
        : `The exam paper for ${subjectTitle} has not been created yet.`);
      return;
    }
    const field = $("paperField"), select = $("paperSelect");
    if (sets.length > 1) {
      field.classList.remove("hidden");
      select.replaceChildren(...sets.map(s => Object.assign(document.createElement("option"), { value: s.id, textContent: `${s.year || ""} ${s.title}`.trim() })));
      select.addEventListener("change", () => choose(sets.find(s => s.id === select.value)));
    }
    await choose(sets[0]);
  }

  async function choose(chosen) {
    try { loaded = await HEC.content.loadSet(chosen); }
    catch (_) { showEmpty("This exam paper could not be loaded. Check your connection and try again."); return; }
    entry = chosen;
    if (!loaded.questions.length) { showEmpty("No valid questions have been added to this paper yet."); return; }
    $("setupPanel").classList.remove("hidden");
    $("examTitle").textContent = subjectTitle || "Practice Exam";
    $("examMeta").textContent = contextLine(loaded.questions.length);
    $("totalQuestions").textContent = loaded.questions.length;
    const info = $("paperInfo");
    info.replaceChildren();
    const unofficial = (loaded.set.answerSource || "reasoned") === "reasoned";
    [chosen.title, chosen.kind ? chosen.kind.replace("-", " ") : "", unofficial ? "Unofficial answers" : "Official answers"]
      .filter(Boolean).forEach(text => {
        const pill = document.createElement("span");
        pill.className = "pill"; pill.style.marginRight = "6px"; pill.textContent = text;
        info.append(pill);
      });
    if (unofficial) {
      const note = document.createElement("p");
      note.className = "muted"; note.textContent = "The answers for this paper were worked out independently; no official answer key was supplied.";
      info.append(note);
    }
    info.classList.remove("hidden");
    const wanted = String(loaded.set.durationMinutes || 30);
    if ([...$("durationSelect").options].some(o => o.value === wanted)) $("durationSelect").value = wanted;
  }

  function startExam() {
    if (!loaded || !loaded.questions.length || engine) return;
    engine = HEC.engine.create({
      questions: loaded.questions, mode: examType,
      meta: { grade, region, stream, subject, subjectTitle, year: entry.year, setId: entry.id, setTitle: entry.title, answerSource: loaded.set.answerSource || "reasoned" },
      onTick: updateTimer, onExpire: () => submitExam(true)
    });
    engine.start($("durationSelect").value);
    $("setupPanel").classList.add("hidden");
    $("examArea").classList.remove("hidden");
    renderQuestion(); renderNavigator(); updateCounts(); updateTimer();
  }
  function updateTimer() {
    const c = engine.clock();
    $("timer").textContent = c.text;
    $("timer").classList.toggle("warning", c.warning);
  }
  function renderQuestion() {
    const q = engine.questions[engine.state.index];
    if (!q) return;
    $("explanationPanel").classList.add("hidden");
    $("explanationBtn").style.display = examType === "practice" ? "inline-flex" : "none";
    $("questionNumber").textContent = `Question ${engine.state.index + 1} of ${engine.questions.length}`;
    $("passageBox").textContent = q.passageText || "";
    $("passageBox").classList.toggle("hidden", !q.passageText);
    const image = $("questionImage");
    if (q.image && /^(https:\/\/|assets\/)/.test(q.image)) { image.src = q.image; image.classList.remove("hidden"); } else { image.removeAttribute("src"); image.classList.add("hidden"); }
    $("questionText").textContent = q.question;
    $("options").replaceChildren();
    q.options.forEach((optionText, optionIndex) => {
      const chosen = engine.state.answers[q.id] === optionIndex;
      const label = document.createElement("label");
      label.className = "option" + (chosen ? " selected" : "");
      const radio = document.createElement("input");
      radio.type = "radio"; radio.name = "answer"; radio.value = optionIndex; radio.checked = chosen;
      radio.addEventListener("change", () => { engine.answer(optionIndex); renderQuestion(); renderNavigator(); updateCounts(); });
      const letter = document.createElement("span");
      letter.className = "option-letter"; letter.textContent = String.fromCharCode(65 + optionIndex);
      const text = document.createElement("span");
      text.className = "option-text"; text.textContent = optionText;
      label.append(radio, letter, text);
      $("options").appendChild(label);
    });
    $("previousBtn").disabled = engine.state.index === 0;
    $("nextBtn").disabled = engine.state.index === engine.questions.length - 1;
    renderNavigator();
  }
  function renderNavigator() {
    const grid = $("questionGrid");
    grid.replaceChildren();
    engine.questions.forEach((q, index) => {
      const button = document.createElement("button");
      button.type = "button"; button.className = "qjump";
      if (Object.prototype.hasOwnProperty.call(engine.state.answers, q.id)) button.classList.add("answered");
      if (index === engine.state.index) button.classList.add("current");
      button.textContent = index + 1;
      button.setAttribute("aria-label", `Go to question ${index + 1}`);
      button.addEventListener("click", () => { engine.go(index); renderQuestion(); toggleQuestionMenu(false); });
      grid.appendChild(button);
    });
  }
  function updateCounts() {
    const c = engine.counts();
    $("answeredCount").textContent = c.answered;
    $("unansweredCount").textContent = c.unanswered;
  }

  function submitExam(timedOut) {
    if (!engine || engine.state.submitted) return;
    const unanswered = engine.counts().unanswered;
    if (!timedOut && unanswered > 0) {
      if (!confirm(`You have ${unanswered} unanswered question(s). Submit anyway?`)) return;
    } else if (!timedOut && !confirm("Submit your exam now? You cannot change your answers afterward.")) return;

    const result = engine.finish(timedOut);
    if (!result) return;
    const attempt = result.attempt;
    if (!result.shouldSave) {          // only when config.saveMockAttempts is switched off
      $("questionNavigator").classList.remove("open");
      $("examArea").innerHTML = `<section class="panel" style="text-align:center;padding:40px"><h1>Mock exam completed</h1><p class="muted">This mock attempt was not saved to your account.</p><h2 style="font-size:42px">${attempt.percentage}%</h2><p>${attempt.correctAnswers} correct out of ${attempt.totalQuestions} questions.</p><a class="btn" href="exams.html">Back to exams</a></section>`;
      return;
    }
    try {
      HEC.store.addAttempt(user, attempt);
      location.href = "results.html?id=" + encodeURIComponent(attempt.id);
    } catch (e) {
      showNotice(e && /account/.test(e.message) ? e.message : "Your result could not be saved because browser storage is unavailable or full. Please keep this page open and try again.", "error");
      engine.reopen();
    }
  }

  const nav = $("questionNavigator");
  const navScrim = document.createElement("div");
  navScrim.className = "exam-nav-scrim";
  document.body.appendChild(navScrim);
  function toggleQuestionMenu(open) {
    nav.classList.toggle("open", open);
    navScrim.classList.toggle("show", open);
    $("questionMenuBtn").setAttribute("aria-expanded", String(open));
  }
  $("startBtn").addEventListener("click", startExam);
  $("previousBtn").addEventListener("click", () => { engine.prev(); renderQuestion(); });
  $("nextBtn").addEventListener("click", () => { engine.next(); renderQuestion(); });
  $("clearBtn").addEventListener("click", () => { engine.clear(); renderQuestion(); updateCounts(); });
  $("submitBtn").addEventListener("click", () => submitExam(false));
  $("questionMenuBtn").addEventListener("click", () => toggleQuestionMenu(!nav.classList.contains("open")));
  $("closeQuestionMenu").addEventListener("click", () => toggleQuestionMenu(false));
  navScrim.addEventListener("click", () => toggleQuestionMenu(false));
  $("exitExamBtn").addEventListener("click", () => {
    if (!confirm("Exit this exam now? Your answers will not be saved.")) return;
    engine.stopTimer();
    location.href = "exams.html";
  });
  $("explanationBtn").addEventListener("click", () => {
    const f = engine.feedback();
    if (!f) { showNotice("Choose an answer first to review it.", "error"); return; }
    $("answerFeedback").textContent = f.text;
    $("explanationText").textContent = f.explanation;
    $("explanationPanel").classList.remove("hidden");
  });
  loadPaper().catch(() => showEmpty("The exam could not be loaded. Open the site through a web server and try again."));
})();
