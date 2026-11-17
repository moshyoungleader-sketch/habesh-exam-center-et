/* Shared navigation, global search and persistent appearance preference.
   Search covers page names, on-page headings, learning materials and exam papers. */
(() => {
  "use strict";

  const THEME_KEY = "hec_theme";
  const current = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const items = [
    ["index.html", "⌂", "Home"],
    ["register.html", "♙", "Register / Login"],
    ["dashboard.html", "▦", "My Dashboard"],
    ["grades.html", "▣", "Subjects & Topics"],
    ["resources.html", "▤", "Learning Resources"],
    ["exams.html", "▧", "Question Bank & Exams"],
    ["exam.html", "✎", "Take Examination"],
    ["results.html", "▤", "Results"],
    ["history.html", "◷", "Exam History"],
    ["progress.html", "▥", "Progress Tracking"],
    ["flashcards.html", "▣", "Flashcards"],
    ["planner.html", "▦", "Study Planner"],
    ["profile.html", "♙", "Profile"],
    ["settings.html", "⚙", "Settings"]
  ];

  const norm = value => String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  function readUserTheme() {
    try {
      const currentUser = localStorage.getItem("hec_current_user");
      const users = JSON.parse(localStorage.getItem("hec_users") || "[]");
      const user = Array.isArray(users)
        ? users.find(item => item && item.id === currentUser)
        : null;
      const theme = user && user.preferences && user.preferences.theme;
      return theme === "dark" || theme === "light" ? theme : "";
    } catch (_) {
      return "";
    }
  }

  function getTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "dark" || saved === "light") return saved;
    } catch (_) { /* use the account preference or light theme */ }
    return readUserTheme() || "light";
  }

  function saveTheme(theme) {
    try { localStorage.setItem(THEME_KEY, theme); } catch (_) { /* storage may be unavailable */ }

    try {
      const currentUser = localStorage.getItem("hec_current_user");
      const users = JSON.parse(localStorage.getItem("hec_users") || "[]");
      if (!Array.isArray(users) || !currentUser) return;
      const user = users.find(item => item && item.id === currentUser);
      if (!user) return;
      user.preferences = Object.assign({}, user.preferences || {}, { theme });
      localStorage.setItem("hec_users", JSON.stringify(users));
    } catch (_) { /* keep the browser preference even if account storage fails */ }
  }

  function applyTheme(theme, persist = true) {
    const selected = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = selected;
    document.documentElement.style.colorScheme = selected;
    if (document.body) document.body.classList.toggle("dark", selected === "dark");

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", selected === "dark" ? "#121922" : "#f7f9fb");

    const toggle = document.querySelector(".hec-theme-toggle");
    if (toggle) {
      const dark = selected === "dark";
      toggle.setAttribute("aria-pressed", String(dark));
      toggle.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to black theme");
      toggle.setAttribute("title", dark ? "Switch to light theme" : "Switch to black theme");
      const icon = toggle.querySelector(".hec-theme-toggle-icon");
      const label = toggle.querySelector(".hec-theme-toggle-label");
      if (icon) icon.textContent = dark ? "☼" : "◐";
      if (label) label.textContent = dark ? "Light" : "Black";
    }

    if (persist) saveTheme(selected);
    document.dispatchEvent(new CustomEvent("hec:themechange", { detail: { theme: selected } }));
    return selected;
  }

  window.HECTheme = Object.freeze({
    getTheme,
    setTheme: theme => applyTheme(theme, true),
    applyTheme: theme => applyTheme(theme, false)
  });

  function init() {
    applyTheme(getTheme(), false);
    if (document.querySelector(".hec-sidebar")) return;

    const side = document.createElement("aside");
    side.className = "hec-sidebar";
    side.id = "hecSidebar";
    side.setAttribute("aria-label", "Main navigation");
    side.setAttribute("aria-hidden", "true");
    side.innerHTML = `
      <div class="hec-drawer-head">
        <a class="hec-side-brand" href="index.html">
          <span>Habesha</span><em>Exam Center</em>
        </a>
        <button class="hec-close" type="button" aria-label="Close menu">×</button>
      </div>
      <nav class="hec-nav" aria-label="Site pages">
        ${items.map(([url, icon, label]) => `
          <a href="${url}" class="${current === url ? "active" : ""}" ${current === url ? 'aria-current="page"' : ""}>
            <span class="hec-ico" aria-hidden="true">${icon}</span><span>${label}</span>
          </a>`).join("")}
        <div class="hec-nav-label">Your study journey</div>
        <a href="apply-contributors.html"><span class="hec-ico" aria-hidden="true">✦</span><span>Contribute</span></a>
      </nav>`;

    const top = document.createElement("div");
    top.className = "hec-topbar";
    top.innerHTML = `
      <a class="hec-brand" href="index.html">
        <span>Habesha <span>Exam Center</span><small>LEARN · PRACTICE · SUCCEED</small></span>
      </a>
      <div class="hec-search-wrap">
        <input class="hec-search" type="search" aria-label="Search subjects, exams and pages" placeholder="Search subjects, exams, resources…" autocomplete="off">
        <div class="hec-search-results" role="listbox" aria-label="Search suggestions" hidden></div>
      </div>
      <button class="hec-theme-toggle" type="button" aria-pressed="false">
        <span class="hec-theme-toggle-icon" aria-hidden="true">◐</span>
        <span class="hec-theme-toggle-label">Black</span>
      </button>
      <button class="hec-menu-button" type="button" aria-label="Open navigation menu" aria-expanded="false">⋯</button>`;

    const scrim = document.createElement("div");
    scrim.className = "hec-scrim";
    scrim.setAttribute("aria-hidden", "true");
    document.body.prepend(scrim);
    document.body.prepend(top);
    document.body.prepend(side);

    applyTheme(getTheme(), false);

    const menuButton = top.querySelector(".hec-menu-button");
    const closeButton = side.querySelector(".hec-close");
    const themeButton = top.querySelector(".hec-theme-toggle");

    function toggleMenu(open) {
      side.classList.toggle("open", open);
      scrim.classList.toggle("show", open);
      side.setAttribute("aria-hidden", String(!open));
      menuButton.setAttribute("aria-expanded", String(open));
      menuButton.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
      menuButton.textContent = open ? "×" : "⋯";
      if (open) closeButton.focus();
      else menuButton.focus();
    }

    menuButton.addEventListener("click", () => toggleMenu(!side.classList.contains("open")));
    closeButton.addEventListener("click", () => toggleMenu(false));
    scrim.addEventListener("click", () => toggleMenu(false));
    themeButton.addEventListener("click", () => setThemeFromButton());

    function setThemeFromButton() {
      applyTheme(getTheme() === "dark" ? "light" : "dark", true);
    }

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && side.classList.contains("open")) toggleMenu(false);
    });
    side.querySelectorAll("a").forEach(link => link.addEventListener("click", () => toggleMenu(false)));

    const search = top.querySelector(".hec-search");
    const results = top.querySelector(".hec-search-results");

    function searchIndex() {
      const found = [];
      items.forEach(([url, , label]) => found.push({ label, url, detail: "Page" }));
      document.querySelectorAll("h1,h2,h3,.grade-card,.feature-card,.subject-card,.resource-card,[data-search]").forEach(element => {
        const label = (element.getAttribute("data-search") || element.innerText || "")
          .replace(/\s+/g, " ").trim().slice(0, 110);
        if (label) found.push({ label, url: null, element, detail: "On this page" });
      });
      return found;
    }

    function startsAtWord(label, query) {
      const value = norm(label);
      const terms = norm(query).split(" ").filter(Boolean);
      if (!terms.length) return false;
      if (value.startsWith(terms.join(" ")) || value.includes(" " + terms.join(" "))) return true;
      return terms.every(term => value.split(" ").some(word => word.startsWith(term)));
    }

    let contentIndex = [];
    let contentIndexPromise = null;

    function loadContentIndex() {
      if (!contentIndexPromise) {
        contentIndexPromise = (window.HEC && HEC.content ? HEC.content.searchIndex() : Promise.resolve([]))
          .then(list => { contentIndex = list; return list; })
          .catch(() => []);
      }
      return contentIndexPromise;
    }

    let searchSequence = 0;
    async function showSearchResults() {
      const sequence = ++searchSequence;
      const query = norm(search.value);
      results.replaceChildren();
      if (!query) { results.hidden = true; return; }

      const pageMatches = searchIndex().filter(item => startsAtWord(item.label, query));
      const resources = await loadContentIndex();
      if (sequence !== searchSequence) return;

      const resourceMatches = resources
        .filter(item => startsAtWord(item.hay, query))
        .slice(0, 5)
        .map(item => ({ label: item.label, url: item.url, detail: item.detail }));

      const matches = pageMatches.concat(resourceMatches).slice(0, 8);
      matches.forEach(match => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "hec-search-result";
        const label = document.createElement("span");
        label.textContent = match.label;
        const detail = document.createElement("small");
        detail.textContent = match.detail;
        button.append(label, detail);
        button.addEventListener("click", () => {
          if (match.url) {
            location.href = match.url;
          } else if (match.element) {
            match.element.scrollIntoView({ behavior: "smooth", block: "center" });
            match.element.classList.add("hec-search-highlight");
            window.setTimeout(() => match.element.classList.remove("hec-search-highlight"), 1600);
          }
          results.hidden = true;
        });
        results.append(button);
      });
      results.hidden = matches.length === 0;
    }

    search.addEventListener("input", showSearchResults);
    search.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        const first = results.querySelector(".hec-search-result");
        if (first && !results.hidden) first.click();
        else if (search.value.trim()) {
          const params = new URLSearchParams();
          params.set("search", search.value.trim());
          location.href = (current === "resources.html" ? "resources.html" : "grades.html") + "?" + params.toString();
        }
      }
      if (event.key === "Escape") results.hidden = true;
    });
    document.addEventListener("click", event => {
      if (!event.target.closest(".hec-search-wrap")) results.hidden = true;
    });

    if (!document.querySelector("footer")) {
      const footer = document.createElement("footer");
      footer.className = "hec-footer";
      footer.textContent = "Habesha Exam Center · Learn Today · Build Tomorrow";
      document.body.append(footer);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
