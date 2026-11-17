/* Site settings and theme boot. Loaded in <head>, so the theme is applied before first paint. */
(function () {
  "use strict";
  var HEC = window.HEC = window.HEC || {};

  HEC.config = Object.freeze({
    schemaVersion: 1,
    /* Accounts and results online (Supabase). Leave both empty to keep everything in this browser, as before.
       Paste the Project URL and the "anon" / "publishable" key (never the service_role key). See docs/SUPABASE-SETUP.md. */
    /* Online requests go through this site (/supabase, see _redirects) so the login forms send data to the same address they came from. */
    supabaseUrl: (window.location.protocol === "https:" ? window.location.origin + "/supabase" : "https://evscdzahzfwzchmabxtl.supabase.co"),
    supabaseKey: "sb_publishable_-vsGKZl8IcyHEUXM6c_4EQ_4kpOFoK-",
    saveMockAttempts: true,     // addendum section 3: Mock Exam attempts are saved like Practice attempts
    examYears: [2017, 2018],    // addendum section 2: years offered after Practice / Mock is chosen (E.C.)
    googleFormUrl: window.HEC_GOOGLE_FORM_URL || "",         // contributor application form (https://docs.google.com/forms/...)
    dataRoot: "data/",
    /* Regions and streams live here (not in catalogue.json) because pages need them synchronously.
       "aliases" make every historic spelling resolve to the canonical id, which cures finding F1. */
    regions: [
      { id: "amhara", label: "Amhara", aliases: ["amhara region"] },
      { id: "addis-ababa", label: "Addis Ababa", aliases: ["addis", "addis ababa", "addis_ababa", "addis ababa city administration"] }
    ],
    streams: [
      { id: "natural", label: "Natural Science", aliases: ["natural-science", "natural science"] },
      { id: "social", label: "Social Science", aliases: ["social-science", "social science"] }
    ]
  });

  try {
    var t = localStorage.getItem("hec_theme");
    if (t !== "dark" && t !== "light") {
      var id = localStorage.getItem("hec_current_user");
      var users = JSON.parse(localStorage.getItem("hec_users") || "[]");
      var u = Array.isArray(users) ? users.find(function (x) { return x && x.id === id; }) : null;
      t = u && u.preferences && u.preferences.theme;
    }
    document.documentElement.setAttribute("data-theme", t === "dark" ? "dark" : "light");
  } catch (e) { document.documentElement.setAttribute("data-theme", "light"); }
})();
