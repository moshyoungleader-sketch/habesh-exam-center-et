/* exams.html: subjects for the saved selection; Practice or Mock, then the examination year. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const esc = HEC.util.escapeHTML;

  function showEmptyState() { $("subjectsSection").hidden = true; $("emptyState").hidden = false; }

  /* Step 5 (addendum): after Practice / Mock is chosen, the student picks the examination year. */
  async function chooseYear(selection, subject, mode) {
    const level = HEC.catalogue.examLevel(selection);
    const dialog = document.createElement("dialog");
    dialog.className = "panel";
    dialog.style.cssText = "max-width:420px;width:calc(100% - 32px);padding:24px;border-radius:16px";
    dialog.innerHTML = `<h2 style="margin-top:0">Choose the examination year</h2>
      <p class="muted">${esc(subject.name)} · ${mode === "mock" ? "Mock exam" : "Practice"}</p><div class="year-list" style="display:grid;gap:10px;margin:16px 0"></div>
      <button type="button" class="btn secondary" data-close>Cancel</button>`;
    const list = dialog.querySelector(".year-list");
    for (const year of HEC.config.examYears) {
      const sets = await HEC.content.findSets({ level: level.id, subject: subject.id, year });
      const count = sets.length ? sets[0].questions : 0;
      const button = document.createElement("button");
      button.type = "button"; button.className = "btn"; button.dataset.year = year;
      button.style.cssText = "display:flex;justify-content:space-between;gap:12px;width:100%";
      button.innerHTML = `<span>${year} E.C.</span><span style="font-weight:400">${sets.length ? esc(count ? count + " questions" : "Available") : "Not created yet"}</span>`;
      button.addEventListener("click", () => go(selection, subject, mode, year));
      list.append(button);
    }
    dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => dialog.remove());
    document.body.append(dialog);
    dialog.showModal();
  }

  function go(selection, subject, mode, year) {
    const info = { grade: selection.grade, region: selection.region || "", stream: selection.stream || "", subject: subject.id,
                   subjectTitle: subject.name, mode, year: String(year), selectedAt: new Date().toISOString() };
    try {
      HEC.store.set(HEC.store.keys.exam, info);
      const params = new URLSearchParams({ grade: info.grade, subject: info.subject, title: info.subjectTitle, type: mode, year: info.year });
      if (info.region) params.set("region", info.region);
      if (info.stream) params.set("stream", info.stream);
      location.href = "exam.html?" + params.toString();
    } catch (e) { alert("Your subject selection could not be saved. Check browser storage and try again."); }
  }

  async function renderPage() {
    await HEC.catalogue.load();
    const selection = HEC.store.getSelection();
    if (!selection) return showEmptyState();
    const subjects = HEC.catalogue.examSubjects(selection);
    if (!subjects.length) return showEmptyState();

    $("subjectsSection").hidden = false; $("emptyState").hidden = true;
    const labels = ["Grade " + selection.grade];
    labels.push(selection.grade === "12" ? HEC.util.streamLabel(selection.stream) : HEC.util.regionLabel(selection.region));
    $("selectionSummary").innerHTML = labels.map(l => `<span class="pill">${esc(l)}</span>`).join("");
    $("subjectsHeading").textContent = "Grade " + selection.grade + " subjects";
    const grid = $("subjectGrid");
    grid.innerHTML = subjects.map(s => `
      <article class="subject-card" data-subject="${esc(s.id)}" data-title="${esc(s.name)}">
        <span class="subject-icon" aria-hidden="true">${esc(s.icon || "•")}</span>
        <h3>${esc(s.name)}</h3>
        <p>${esc(s.description || "")}</p>
        <div class="subject-bottom subject-actions"><button type="button" class="mode-button" data-mode="practice">Practice</button><button type="button" class="mode-button mock-button" data-mode="mock">Mock exam</button></div>
      </article>`).join("");
    grid.querySelectorAll(".subject-card").forEach(card => {
      const subject = subjects.find(s => s.id === card.dataset.subject);
      card.querySelectorAll("[data-mode]").forEach(button =>
        button.addEventListener("click", () => chooseYear(selection, subject, button.dataset.mode)));
    });
  }

  $("year").textContent = new Date().getFullYear();
  renderPage().catch(showEmptyState);
})();
