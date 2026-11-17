/* index.html (landing page) and apply-contributors.html */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  if ($("year")) $("year").textContent = new Date().getFullYear();

  const menuToggle = $("menuToggle"), navLinks = $("navLinks");
  if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
      menuToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
    });
    navLinks.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
      navLinks.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", "false");
    }));
  }
  document.querySelectorAll(".grade-link").forEach(link =>
    link.addEventListener("click", () => sessionStorage.setItem("hec_requested_grade", link.dataset.grade)));

  const button = $("applyButton"), note = $("formNote");
  if (button && note) {
    const url = HEC.config.googleFormUrl;
    if (/^https:\/\/docs\.google\.com\/forms\//.test(url)) {
      button.href = url;
      note.textContent = "Your application will open in Google Forms in a new tab.";
    } else {
      button.addEventListener("click", e => {
        e.preventDefault();
        note.textContent = "The Google Form link has not been configured yet. Ask the platform team to add it in js/core/config.js (googleFormUrl).";
      });
    }
  }
})();
