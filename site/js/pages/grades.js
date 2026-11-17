/* grades.html: choose grade, then region (Grades 6, 8) or stream (Grade 12). */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const GRADES = ["6", "8", "12"];
  const gradeCards = [...document.querySelectorAll(".grade-card")];
  const regionSelect = $("region"), streamSelect = $("stream"), continueButton = $("continueButton");
  let selectedGrade = "", currentUser = null;

  function showError(message) { $("errorMessage").textContent = message; $("errorMessage").classList.add("show"); }
  function clearError() { $("errorMessage").textContent = ""; $("errorMessage").classList.remove("show"); }

  function updateContinueButton() {
    let ready = false;
    if (selectedGrade === "6" || selectedGrade === "8") ready = Boolean(regionSelect.value);
    else if (selectedGrade === "12") ready = Boolean(streamSelect.value);
    continueButton.disabled = !ready;
  }

  function chooseGrade(grade) {
    selectedGrade = grade;
    clearError();
    gradeCards.forEach(card => {
      const active = card.dataset.grade === grade;
      card.classList.toggle("selected", active);
      card.setAttribute("aria-pressed", String(active));
    });
    $("regionField").classList.toggle("hidden", grade === "12");
    $("streamField").classList.toggle("hidden", grade !== "12");
    $("noExtraChoice").classList.add("hidden");
    const mine = currentUser && String(currentUser.grade) === grade;
    if (grade === "12") {
      regionSelect.value = "";
      streamSelect.value = mine ? HEC.util.normStream(currentUser.stream) : "";
    } else {
      streamSelect.value = "";
      regionSelect.value = mine ? HEC.util.normRegion(currentUser.region) : "";
    }
    $("selectionTitle").textContent = "Grade " + grade + " selection";
    updateContinueButton();
  }

  gradeCards.forEach(card => card.addEventListener("click", () => chooseGrade(card.dataset.grade)));
  regionSelect.addEventListener("change", updateContinueButton);
  streamSelect.addEventListener("change", updateContinueButton);

  continueButton.addEventListener("click", () => {
    clearError();
    if (!selectedGrade) { showError("Please choose your grade first."); return; }
    if ((selectedGrade === "6" || selectedGrade === "8") && !regionSelect.value) { showError("Please choose your curriculum collection."); return; }
    if (selectedGrade === "12" && !streamSelect.value) { showError("Please choose your Grade 12 stream."); return; }
    // F1: the region is always saved in its canonical form ("addis-ababa"), the same everywhere on the site
    const selection = {
      grade: selectedGrade,
      region: selectedGrade === "12" ? "" : HEC.util.normRegion(regionSelect.value),
      stream: selectedGrade === "12" ? HEC.util.normStream(streamSelect.value) : ""
    };
    try {
      HEC.store.setSelection(selection);
      if (currentUser) {
        const fresh = HEC.store.currentUser();
        if (fresh) { Object.assign(fresh, selection); HEC.store.saveUser(fresh); }
      }
      location.href = "exams.html";
    } catch (e) { showError("Your selection could not be saved. Check your browser storage and try again."); }
  });

  $("year").textContent = new Date().getFullYear();
  try {
    currentUser = HEC.store.currentUser();
    const saved = HEC.store.get(HEC.store.keys.selection, null);
    const requested = sessionStorage.getItem("hec_requested_grade");
    const initial = requested && GRADES.includes(requested) ? requested
      : saved && GRADES.includes(saved.grade) ? saved.grade
      : currentUser && GRADES.includes(String(currentUser.grade)) ? String(currentUser.grade) : "";
    if (initial) {
      chooseGrade(initial);
      if (saved && saved.grade === initial && (!currentUser || String(currentUser.grade) !== initial)) {
        regionSelect.value = HEC.util.normRegion(saved.region);
        streamSelect.value = HEC.util.normStream(saved.stream);
        updateContinueButton();
      }
      if (requested) sessionStorage.removeItem("hec_requested_grade");
    }
  } catch (e) { showError("Some saved information could not be loaded. You can still make a new selection."); }
})();
