/* resources.html (browse) and resource-detail.html. Data comes from data/materials via HEC.content. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const U = HEC.util;
  const state = { all: [], grade: "all", stream: "all", region: "all", subject: "all", type: "all", search: "" };

  function addOption(select, value, label) { select.append(Object.assign(document.createElement("option"), { value, textContent: label })); }
  const tag = value => Object.assign(document.createElement("span"), { className: "resource-tag", textContent: value });

  function updateFilterVisibility() {
    const hasStreams = state.grade === "11" || state.grade === "12";
    const hasRegions = state.grade !== "all" && Number(state.grade) <= 10;
    $("streamFilter").parentElement.hidden = !hasStreams;
    $("regionFilter").parentElement.hidden = !hasRegions;
    if (!hasStreams) state.stream = "all";
    if (!hasRegions) state.region = "all";
  }
  /* Subject names are listed exactly as supplied, per grade (and per stream for Grades 11-12). */
  function updateSubjectOptions() {
    const select = $("subjectFilter"), previous = state.subject;
    select.replaceChildren();
    addOption(select, "all", "All subjects");
    const grades = state.grade === "all" ? [5, 6, 7, 8, 9, 10, 11, 12] : [Number(state.grade)];
    const seen = new Set();
    grades.forEach(g => HEC.catalogue.materialSubjects(g, state.stream === "all" ? "" : state.stream).forEach(s => {
      if (seen.has(s.label)) return;
      seen.add(s.label); addOption(select, s.id, s.label);
    }));
    select.value = [...select.options].some(o => o.value === previous) ? previous : "all";
    state.subject = select.value;
  }
  function filtered() {
    return state.all.filter(r => {
      if (state.grade !== "all" && r.grade !== state.grade) return false;
      if (state.stream !== "all" && r.stream && r.stream !== state.stream) return false;
      if (state.region !== "all" && r.region && r.region !== state.region) return false;
      if (state.subject !== "all" && r.subject !== state.subject) return false;
      if (state.type !== "all" && r.type !== state.type) return false;
      if (state.search && !U.startsAtWord([r.title, r.description, r.subjectName, r.typeLabel, "Grade " + r.grade,
        U.streamLabel(r.stream), U.regionLabel(r.region), r.language, r.year].join(" "), state.search)) return false;
      return true;
    });
  }
  function card(r) {
    const article = document.createElement("article");
    article.className = "resource-card";
    article.dataset.search = [r.title, r.subjectName, r.typeLabel, "Grade " + r.grade].join(" ");
    if (r.image) { const img = document.createElement("img"); img.className = "resource-cover"; img.src = r.image; img.alt = ""; img.loading = "lazy"; article.append(img); }
    const body = document.createElement("div");
    body.className = "resource-card-body";
    const meta = document.createElement("div");
    meta.className = "resource-card-meta";
    meta.append(tag(r.typeLabel), tag("Grade " + r.grade));
    if (r.stream) meta.append(tag(U.streamLabel(r.stream)));
    if (r.region) meta.append(tag(U.regionLabel(r.region)));
    if (r.language) meta.append(tag(r.language.toUpperCase()));
    if (r.year) meta.append(tag(r.year + " E.C."));
    const h3 = Object.assign(document.createElement("h3"), { textContent: r.title });
    const subject = Object.assign(document.createElement("p"), { className: "resource-subject", textContent: r.subjectName });
    body.append(meta, h3, subject);
    if (r.description) body.append(Object.assign(document.createElement("p"), { className: "resource-card-description", textContent: r.description }));
    const footer = document.createElement("div");
    footer.className = "resource-card-footer";
    footer.append(Object.assign(document.createElement("span"), { className: "resource-status" + (r.available ? " available" : ""), textContent: r.available ? "Available" : "Details only" }),
      Object.assign(document.createElement("a"), { className: "btn secondary", href: "resource-detail.html?id=" + encodeURIComponent(r.id), textContent: "View resource" }));
    body.append(footer); article.append(body);
    return article;
  }
  function render() {
    const grid = $("resourceGrid"), list = filtered();
    $("resourceCount").textContent = list.length + (list.length === 1 ? " resource" : " resources");
    grid.setAttribute("aria-busy", "false");
    grid.replaceChildren();
    if (!list.length) {
      const empty = document.createElement("section");
      empty.className = "resources-empty";
      empty.append(Object.assign(document.createElement("h2"), { textContent: state.search ? "No matching resources" : "The learning library is ready" }),
        Object.assign(document.createElement("p"), { textContent: state.search ? "Try another search term or change the filters."
          : "No learning materials have been added yet. Add videos, notes and text books to the files in data/materials (see docs/CONTENT-GUIDE.md) and they appear here automatically." }));
      grid.append(empty);
      return;
    }
    list.forEach(r => grid.append(card(r)));
  }
  function initFilters() {
    const cat = HEC.catalogue.data;
    [5, 6, 7, 8, 9, 10, 11, 12].forEach(g => addOption($("gradeFilter"), String(g), "Grade " + g));
    HEC.config.streams.forEach(s => addOption($("streamFilter"), s.id, s.label));
    HEC.config.regions.forEach(r => addOption($("regionFilter"), r.id, r.label));
    Object.keys(cat.resourceTypes).forEach(id => addOption($("typeFilter"), id, cat.resourceTypes[id].label));
    const saved = HEC.store.getSelection();
    if (saved) {
      $("gradeFilter").value = state.grade = saved.grade;
      if (saved.stream) $("streamFilter").value = state.stream = saved.stream;
      if (saved.region) $("regionFilter").value = state.region = saved.region;
    }
    const bind = (id, key, reset) => $(id).addEventListener("change", () => {
      state[key] = $(id).value;
      if (reset) { state.stream = state.region = "all"; $("streamFilter").value = $("regionFilter").value = "all"; }
      updateFilterVisibility(); updateSubjectOptions(); render();
    });
    bind("gradeFilter", "grade", true); bind("streamFilter", "stream"); bind("regionFilter", "region");
    $("subjectFilter").addEventListener("change", () => { state.subject = $("subjectFilter").value; render(); });
    $("typeFilter").addEventListener("change", () => { state.type = $("typeFilter").value; render(); });
    $("searchInput").addEventListener("input", e => { state.search = e.target.value.trim(); render(); });
    updateFilterVisibility(); updateSubjectOptions();
  }
  function detail() {
    const id = new URLSearchParams(location.search).get("id");
    const r = state.all.find(x => x.id === id);
    if (!r) { $("resourcePanel").hidden = true; $("missingPanel").hidden = false; return; }
    $("resourcePanel").hidden = false; $("missingPanel").hidden = true;
    if ($("resourceIcon")) $("resourceIcon").textContent = r.typeLabel.slice(0, 1);
    $("resourceType").textContent = r.typeLabel;
    $("resourceTitle").textContent = r.title;
    $("resourceDescription").textContent = r.description;
    $("resourceTags").replaceChildren(...["Grade " + r.grade, U.streamLabel(r.stream), r.subjectName, U.regionLabel(r.region), r.language && r.language.toUpperCase(), r.year && r.year + " E.C."].filter(Boolean).map(tag));
    $("resourceInformation").textContent = [r.subjectName, "Grade " + r.grade, U.streamLabel(r.stream), r.source && "Source: " + r.source].filter(Boolean).join(" · ");
    const status = $("resourceStatus"), open = $("openResource");
    status.classList.toggle("available", r.available);
    status.textContent = r.available ? "This learning material is ready to open." : "The resource entry has been added, but its verified file or link is not available yet.";
    open.hidden = !r.available;
    if (r.available) open.href = r.url; else open.removeAttribute("href");
    if (r.available && r.type === "video") {
      const embed = HEC.video.embedUrl(r);
      if (embed) {
        const frame = document.createElement("iframe");
        frame.src = embed; frame.title = r.title; frame.allowFullscreen = true; frame.loading = "lazy";
        frame.referrerPolicy = "strict-origin-when-cross-origin";
        frame.style.cssText = "width:100%;aspect-ratio:16/9;border:0;border-radius:12px;margin-bottom:16px";
        status.before(frame);
      }
      HEC.video.markWatched(r.id, false);
    }
  }
  async function init() {
    const grid = $("resourceGrid");
    try {
      await HEC.catalogue.load();
      state.all = await HEC.content.materials();
      if (grid) {
        initFilters();
        const q = new URLSearchParams(location.search).get("search");
        if (q) { $("searchInput").value = q; state.search = q; }
        render();
      } else if ($("resourcePanel")) detail();
    } catch (error) {
      console.error("Could not initialise the learning library:", error);
      if (grid) { grid.replaceChildren(Object.assign(document.createElement("section"), { className: "resources-empty", textContent: "The resource library could not be loaded. Open the site through a web server (not by double-clicking the file) and try again." })); }
      if ($("resourcePanel")) { $("resourcePanel").hidden = true; $("missingPanel").hidden = false; }
    }
    if ($("year")) $("year").textContent = new Date().getFullYear();
  }
  init();
})();
