/* Online accounts and results, stored on our own server (/api, Vercel functions + Neon Postgres).
   Pages keep reading the browser copy (hec_users) exactly as before. This module signs students in, copies their
   profile and results down at login, and copies new results and profile changes up in the background.
   If the network is down, the exam still works and saves locally; the upload is retried on the next page load,
   when the connection returns, or after the next change.
   Talks to /api with plain fetch. The login is kept in a secure cookie that the browser sends automatically. */
(function () {
  "use strict";
  var HEC = window.HEC = window.HEC || {};
  var cfg = HEC.config, S_KEY = "hec_session_state", ST_KEY = "hec_sync_state", PULL_KEY = "hec_last_pull";
  var enabled = (window.location.protocol === "https:" || window.location.hostname === "localhost") && cfg.accountsOnline !== false;
  var timer = null, running = false, again = false;

  /* The signed-in student's id and email only. The secure login cookie itself is handled by the browser. */
  function session() { return HEC.store.get(S_KEY, null); }
  function setSession(s) {
    if (!s) { HEC.store.remove(S_KEY); return null; }
    var rec = { userId: s.userId, email: s.email || "" };
    try { HEC.store.set(S_KEY, rec); } catch (e) { /* storage full: stay signed in for this page only */ }
    return rec;
  }
  /* One request to our own server. Throws Error with .status and a readable message. */
  async function call(path, opts) {
    opts = opts || {};
    var res;
    try {
      res = await fetch(path, { method: opts.method || "GET", credentials: "same-origin",
        headers: opts.body == null ? {} : { "Content-Type": "application/json" },
        body: opts.body == null ? undefined : JSON.stringify(opts.body) });
    } catch (e) { var n = new Error("Could not reach the server. Check your internet connection and try again."); n.network = true; throw n; }
    var data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) {
      var err = new Error((data && data.msg) || ("Request failed (" + res.status + ")"));
      err.status = res.status; throw err;
    }
    return data;
  }
  var isBadLogin = function (e) { return !!e && (e.status === 401 || e.status === 400 || e.status === 409); };

  /* ---- Auth ---- */
  async function signIn(email, password) {
    var r = await call("/api/login", { method: "POST", body: { email: email, password: password } });
    setSession({ userId: r.user.id, email: r.user.email });
    return { user: r.user };
  }
  async function signUp(email, password, meta) {
    var r = await call("/api/register", { method: "POST", body: { email: email, password: password, meta: meta || {} } });
    setSession({ userId: r.user.id, email: r.user.email });
    return { session: { user: r.user }, user: r.user };
  }
  async function updatePassword(password) { return call("/api/password", { method: "POST", body: { password: password } }); }
  async function signOut() {
    setSession(null);
    try { await call("/api/logout", { method: "POST" }); } catch (e) { /* already signed out locally */ }
  }

  /* ---- Data: what is stored where ---- */
  function profileFields(u) {
    return { full_name: u.fullName || "", grade: String(u.grade || ""), region: HEC.util.normRegion(u.region), stream: HEC.util.normStream(u.stream),
             preferences: u.preferences || {}, study_plan: Array.isArray(u.studyPlan) ? u.studyPlan : [] };
  }
  function attemptRow(a, uid) {
    return { id: a.id, user_id: uid, data: a, subject: a.subject || null, grade: String(a.grade || ""), exam_type: a.examType === "mock" ? "mock" : "practice",
             exam_year: a.examYear ? Number(a.examYear) : null, percentage: Math.round(Number(a.percentage) || 0), created_at: a.completedAt || new Date().toISOString() };
  }
  var state = function () { return HEC.store.get(ST_KEY, null); };

  /* Copy the student's profile and results down and make them the working browser copy. Returns the local user. */
  async function pull(uid, email) {
    var got = await call("/api/sync");
    var rows = got.attempts || [];
    var p = got.profile || {}, users = HEC.store.readUsers(), lower = String(email || got.email || "").toLowerCase();
    var existing = users.find(function (u) { return u && u.id === uid; }) ||
                   users.find(function (u) { return u && String(u.email || "").toLowerCase() === lower; }) || {};
    var u = Object.assign({}, existing);
    ["password", "passwordHash", "passwordSalt", "passwordIter"].forEach(function (k) { delete u[k]; });   // passwords live only on the server
    var remoteIds = rows.map(function (r) { return r.id; });
    var byId = {}; (existing.examHistory || []).forEach(function (a) { if (a && a.id) byId[a.id] = a; });
    rows.forEach(function (r) { byId[r.id] = r.data; });
    u.id = uid; u.email = lower || got.email; u.fullName = p.full_name || existing.fullName || "";
    u.grade = p.grade || existing.grade || ""; u.region = p.region || HEC.util.normRegion(existing.region); u.stream = p.stream || HEC.util.normStream(existing.stream);
    u.createdAt = p.created_at || existing.createdAt || new Date().toISOString();
    u.preferences = Object.assign({ theme: "light" }, existing.preferences || {}, p.preferences || {});
    u.studyPlan = (p.study_plan && p.study_plan.length) ? p.study_plan : (existing.studyPlan || []);
    u.examHistory = Object.keys(byId).map(function (k) { return byId[k]; }).sort(function (a, b) { return String(a.completedAt || "").localeCompare(String(b.completedAt || "")); });
    if (existing.id && existing.id !== uid) {            // an account from before online accounts: carry its per-student keys over to the new id
      ["hec_flashcards_", "hec_video_"].forEach(function (pre) {
        var v = localStorage.getItem(pre + existing.id);
        if (v != null && localStorage.getItem(pre + uid) == null) localStorage.setItem(pre + uid, v);
      });
    }
    users = users.filter(function (x) { return x && x.id !== uid && x.id !== existing.id; });
    users.push(u); HEC.store.writeUsers(users);
    localStorage.setItem(HEC.store.keys.current, uid);
    HEC.store.set(ST_KEY, { uid: uid, attempts: remoteIds, profile: JSON.stringify(profileFields({ fullName: p.full_name, grade: p.grade, region: p.region, stream: p.stream, preferences: p.preferences, studyPlan: p.study_plan })) });
    try { sessionStorage.setItem(PULL_KEY, String(Date.now())); } catch (e) { /* ignore */ }
    schedule(200);          // pushes anything the browser copy has that the server does not (first login after migration)
    return u;
  }

  /* Copy new results and profile changes up. Safe to call any time; does nothing when signed out or offline. */
  async function flush() {
    if (!enabled) return;
    if (running) { again = true; return; }
    running = true;
    try {
      var u = HEC.store.currentUser(), s = session();
      if (!u || !s || s.userId !== u.id) return;
      var st = state();
      if (!st || st.uid !== u.id) { await pull(u.id, u.email); return; }     // never push before knowing what the server has
      var changed = false, body = {};
      var fresh = (u.examHistory || []).filter(function (a) { return a && a.id && st.attempts.indexOf(a.id) === -1; });
      if (fresh.length) body.attempts = fresh.map(function (a) { return attemptRow(a, u.id); });
      var fields = profileFields(u), ph = JSON.stringify(fields);
      if (ph !== st.profile) body.profile = fields;
      if (body.attempts || body.profile) {
        await call("/api/sync", { method: "POST", body: body });
        if (body.attempts) { fresh.forEach(function (a) { st.attempts.push(a.id); }); }
        if (body.profile) st.profile = ph;
        changed = true;
      }
      if (changed) HEC.store.set(ST_KEY, st);
      var last = Number(sessionStorage.getItem(PULL_KEY) || 0);
      if (Date.now() - last > 5 * 60 * 1000) await pull(u.id, u.email);        // pick up results from another device
    } catch (e) {
      if (e && e.status === 401) setSession(null);          // cookie expired: the student must log in again
      if (window.console) console.warn("HEC sync will retry:", e.message);
    } finally {
      running = false;
      if (again) { again = false; schedule(500); }
    }
  }
  function schedule(ms) { if (!enabled) return; clearTimeout(timer); timer = setTimeout(flush, ms == null ? 800 : ms); }

  if (enabled) {
    /* Every page saves accounts straight to localStorage. Watch that one key so any change is uploaded without editing each page. */
    var original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      original.call(this, key, value);
      if (this === window.localStorage && key === HEC.store.keys.users) schedule();
    };
    window.addEventListener("online", function () { schedule(300); });
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") flush(); });
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { schedule(300); });
    else schedule(300);
  }

  HEC.sync = { enabled: enabled, signIn: signIn, signUp: signUp, signOut: signOut, updatePassword: updatePassword, pull: pull, flush: flush,
               schedule: schedule, session: session, isBadLogin: isBadLogin };
})();
