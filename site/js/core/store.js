/* The only code that touches browser storage for accounts and selections.
   Keys are exactly the ones the old site used, so existing students keep their data:
   hec_users, hec_current_user, hec_current_selection, hec_selected_exam, hec_last_attempt_id,
   hec_theme, hec_remembered_email, hec_flashcards_<userId>.   New keys: hec_schema_version, hec_users_backup_v1, hec_video_<userId>. */
(function () {
  "use strict";
  var HEC = window.HEC = window.HEC || {};
  var K = { users: "hec_users", current: "hec_current_user", selection: "hec_current_selection",
            exam: "hec_selected_exam", last: "hec_last_attempt_id", backup: "hec_users_backup_v1", schema: "hec_schema_version" };

  function get(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw == null ? fallback : JSON.parse(raw); } catch (e) { return fallback; }
  }
  function set(key, value) { localStorage.setItem(key, JSON.stringify(value)); }   // may throw (quota): callers show a message
  function remove(key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } }

  function readUsers() { var u = get(K.users, []); return Array.isArray(u) ? u : []; }
  function writeUsers(users) { set(K.users, users); }
  function currentUserId() { try { return localStorage.getItem(K.current); } catch (e) { return null; } }
  function currentUser() {
    var id = currentUserId();
    return id ? readUsers().find(function (u) { return u && u.id === id; }) || null : null;
  }
  /* Redirects to login when there is no valid session, as every private page did. */
  function requireUser() {
    var user = currentUser();
    if (!user) { remove(K.current); location.replace("login.html"); return null; }
    return user;
  }
  function saveUser(user) {
    var users = readUsers(), i = users.findIndex(function (u) { return u && u.id === user.id; });
    if (i === -1) return false;
    users[i] = user; writeUsers(users); return true;
  }
  function addAttempt(user, attempt) {
    var users = readUsers(), i = users.findIndex(function (u) { return u && u.id === user.id; });
    if (i === -1) throw new Error("Your account could not be found. The result could not be saved.");
    if (!Array.isArray(users[i].examHistory)) users[i].examHistory = [];
    users[i].examHistory.push(attempt);
    writeUsers(users);
    localStorage.setItem(K.last, attempt.id);
    return attempt;
  }
  /* Saved selection, with the region/stream written in any historic spelling resolved to the canonical id. */
  function getSelection() {
    var s = get(K.selection, null);
    if (s && ["6", "8", "12"].indexOf(String(s.grade)) !== -1)
      return { grade: String(s.grade), region: HEC.util.normRegion(s.region), stream: HEC.util.normStream(s.stream) };
    var u = currentUser();
    if (u && ["6", "8", "12"].indexOf(String(u.grade)) !== -1)
      return { grade: String(u.grade), region: HEC.util.normRegion(u.region), stream: HEC.util.normStream(u.stream) };
    return null;
  }
  function setSelection(sel) {
    set(K.selection, { grade: sel.grade, region: sel.region || "", stream: sel.stream || "", updatedAt: new Date().toISOString() });
  }
  /* Per-student video state (new key, never touches existing ones): { <videoId>: { seconds, done, at } } */
  function videoState() { var u = currentUserId(); return u ? get("hec_video_" + u, {}) : {}; }
  function saveVideoState(state) { var u = currentUserId(); if (u) { try { set("hec_video_" + u, state); } catch (e) { /* ignore */ } } }

  /* One-time safety copy before anything new writes to the account list (restore: copy back with one line). */
  (function migrate() {
    try {
      if (localStorage.getItem(K.schema)) return;
      var raw = localStorage.getItem(K.users);
      if (raw && !localStorage.getItem(K.backup)) localStorage.setItem(K.backup, raw);
      localStorage.setItem(K.schema, String(HEC.config.schemaVersion));
    } catch (e) { /* storage unavailable: pages show their own messages */ }
  })();

  HEC.store = Object.freeze({ keys: K, get: get, set: set, remove: remove, readUsers: readUsers, writeUsers: writeUsers,
    currentUser: currentUser, currentUserId: currentUserId, requireUser: requireUser, saveUser: saveUser, addAttempt: addAttempt,
    getSelection: getSelection, setSelection: setSelection, videoState: videoState, saveVideoState: saveVideoState });
})();
