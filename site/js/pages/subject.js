/* subject.html: one hub per subject (Videos, Notes and text books, Past papers, Practice and mock exams). */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const U = HEC.util;
  const params = new URLSearchParams(location.search);
  const sel = HEC.store.getSelection() || {};
  const grade = params.get("grade") || sel.grade || "";
  const region = U.normRegion(params.get("region") || (params.has("grade") ? "" : sel.region));
  const stream = U.normStream(params.get("stream") || (params.has("grade") ? "" : sel.stream));
  const el = (tag, props, ...kids) => { const n = Object.assign(document.createElement(tag), props || {}); n.append(...kids.filter(k => k != null && k !== false)); return n; };
  const badge = text => el("span", { className: "resource-tag", textContent: text });

  function selectTab(name) {
    document.querySelectorAll(".subject-tabs [data-tab]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === name)));
    document.querySelectorAll(".subject-pane").forEach(p => { p.hidden = p.id !== "tab-" + name; });
  }
  function empty(pane, text) { pane.replaceChildren(el("p", { className: "muted", textContent: text })); }
  function openLink(url, label) { return el("a", { className: "btn secondary", href: url, target: "_blank", rel: "noopener noreferrer", textContent: label || "Open" }); }

  function renderVideos(pane, videos) {
    if (!videos.length) return empty(pane, "No videos have been added for this subject yet.");
    const player = el("div");
    const last = HEC.video.lastOpened(videos.map(v => v.id));
    const play = v => {
      const embed = v.available ? HEC.video.embedUrl(v) : "";
      if (embed) {
        player.replaceChildren(el("iframe", { className: "video-player", src: embed, title: v.title, allowFullscreen: true, loading: "lazy", referrerPolicy: "strict-origin-when-cross-origin" }));
      } else if (v.available) {
        player.replaceChildren(el("p", { className: "muted" }, "This video plays on ", HEC.video.host(v.url) || "another site", ". ", openLink(v.url, "Open video")));
      }
      HEC.video.markWatched(v.id, HEC.video.isWatched(v.id)); renderList();
    };
    const list = el("div");
    function renderList() {
      list.replaceChildren();
      let unit = null, ul = null;
      videos.forEach(v => {
        if (v.unit !== unit || !ul) { unit = v.unit; list.append(el("h3", { className: "unit-title", textContent: unit ? "Unit " + unit : "Videos" })); ul = el("ul", { className: "video-list" }); list.append(ul); }
        const watched = HEC.video.isWatched(v.id);
        const done = el("button", { type: "button", className: "btn secondary", textContent: watched ? "✓ Watched" : "Mark watched" });
        done.addEventListener("click", () => { HEC.video.markWatched(v.id, !watched); renderList(); });
        const go = v.available ? el("button", { type: "button", className: "btn primary", textContent: "Watch" }) : badge("Coming soon");
        if (v.available) go.addEventListener("click", () => play(v));
        ul.append(el("li", null, el("span", null, el("strong", { textContent: v.title }), " ", v.duration && badge(v.duration), v.language && badge(v.language.toUpperCase()), v.topic && badge(v.topic)), el("span", null, go, " ", v.available && done)));
      });
    }
    renderList();
    const resume = last && videos.find(v => v.id === last && v.available);
    pane.replaceChildren(player, resume && el("p", null, el("button", { type: "button", className: "btn secondary", textContent: "Continue where you left off: " + resume.title, onclick: () => play(resume) })), list,
      el("p", { className: "muted", textContent: "Streaming video cannot be saved for offline use." }));
  }
  function renderLinks(pane, items, none) {
    if (!items.length) return empty(pane, none);
    const ul = el("ul", { className: "video-list" });
    items.forEach(m => ul.append(el("li", null, el("span", null, el("strong", { textContent: m.title }), " ", badge(m.typeLabel), m.language && badge(m.language.toUpperCase()), m.year && badge(m.year + " E.C.")),
      m.available ? openLink(m.url) : badge("Coming soon"))));
    pane.replaceChildren(ul);
  }
  function examUrl(subjectId, title, mode, year) {
    const p = new URLSearchParams({ grade, subject: subjectId, title, type: mode, year });
    if (region) p.set("region", region);
    if (stream) p.set("stream", stream);
    return "exam.html?" + p.toString();
  }
  async function renderExams(pane, subjectId, name, kind) {
    const level = HEC.catalogue.examLevel({ grade, region, stream });
    if (!level || !level.subjects.includes(subjectId)) {
      return empty(pane, "Practice and mock exams are available for Grade 6 and 8 (with a region) and Grade 12 (with a stream). Choose them on the Grades page.");
    }
    pane.replaceChildren();
    for (const year of HEC.config.examYears) {
      const sets = await HEC.content.findSets({ level: level.id, subject: subjectId, year, kind });
      if (kind && !sets.length) continue;
      const row = el("div", { className: "year-row" }, el("strong", { textContent: year + " E.C." }));
      if (sets.length) {
        const s = sets[0];
        row.append(badge(s.questions + " questions"), badge(s.answerSource === "official" ? "Official answers" : "Unofficial answers"),
          el("a", { className: "btn primary", href: examUrl(subjectId, name, "practice", year), textContent: "Practice" }),
          el("a", { className: "btn secondary", href: examUrl(subjectId, name, "mock", year), textContent: "Mock exam" }));
      } else row.append(badge("Not created yet"));
      pane.append(row);
    }
    if (!pane.children.length) empty(pane, "No past papers have been added for this subject yet.");
  }

  async function init() {
    await HEC.catalogue.load();
    const subjectId = HEC.catalogue.resolveSubject(params.get("subject") || params.get("id") || "");
    if (!subjectId || !grade) { $("subjectName").textContent = "Subject not found"; $("subjectIntro").textContent = "Choose a subject from the Learning resources page or the Exams page."; document.querySelectorAll(".subject-pane").forEach(p => { p.hidden = true; }); return; }
    const name = HEC.catalogue.materialLabel(grade, stream, subjectId);
    const examName = HEC.catalogue.subjectName(subjectId);
    document.title = name + " | Habesha Exam Center";
    $("subjectName").textContent = name;
    $("subjectLevel").textContent = ["Grade " + grade, U.streamLabel(stream), U.regionLabel(region)].filter(Boolean).join(" · ");
    const all = await HEC.content.materialsFor(subjectId, grade, stream, region);
    renderVideos($("tab-videos"), all.filter(m => m.type === "video"));
    renderLinks($("tab-notes"), all.filter(m => ["notes", "textbook", "teacher-guide"].includes(m.type)), "No notes or text books have been added for this subject yet.");
    const papers = all.filter(m => m.type === "past-paper");
    const paperPane = $("tab-papers");
    await renderExams(paperPane, subjectId, examName, "past-paper");
    if (papers.length) { const ul = el("div"); renderLinks(ul, papers, ""); paperPane.append(el("h3", { className: "unit-title", textContent: "Past paper files" }), ul.firstChild); }
    await renderExams($("tab-exams"), subjectId, examName, "");
    document.querySelectorAll(".subject-tabs [data-tab]").forEach(b => b.addEventListener("click", () => selectTab(b.dataset.tab)));
    const wanted = params.get("tab"); if (wanted) selectTab(wanted);
  }
  init().catch(() => { $("subjectIntro").textContent = "This page could not be loaded. Open the site through a web server and try again."; });
})();
