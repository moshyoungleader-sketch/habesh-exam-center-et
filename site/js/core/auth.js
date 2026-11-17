/* Accounts. With Supabase configured (config.js) they are real online accounts; otherwise demo accounts kept in this browser.
   Browser-only mode: Passwords are hashed with PBKDF2 (Web Crypto) when the browser allows it;
   accounts that still hold a plain-text password are upgraded the next time their owner signs in.
   This stops casual reading of stored passwords. It is NOT real account security (see docs/CONTENT-GUIDE.md). */
(function () {
  "use strict";
  var HEC = window.HEC = window.HEC || {};
  var ITER = 150000;
  var subtle = window.crypto && window.crypto.subtle;

  function b64(buf) { var s = ""; new Uint8Array(buf).forEach(function (b) { s += String.fromCharCode(b); }); return btoa(s); }
  function unb64(str) { return Uint8Array.from(atob(str), function (c) { return c.charCodeAt(0); }); }
  async function derive(password, salt, iter) {
    var key = await subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    return b64(await subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt, iterations: iter }, key, 256));
  }
  /* Sets the hash fields on the user object (or the plain password where Web Crypto is not available). */
  async function setPassword(user, password) {
    if (online()) { try { await HEC.sync.updatePassword(String(password)); } catch (e) { throw onlineError(e, "Your password could not be changed."); } return user; }
    if (!subtle) { user.password = String(password); return user; }
    var salt = window.crypto.getRandomValues(new Uint8Array(16));
    user.passwordSalt = b64(salt); user.passwordIter = ITER; user.passwordHash = await derive(String(password), salt, ITER);
    delete user.password; return user;
  }
  async function verifyPassword(user, password) {
    if (online()) { try { await HEC.sync.signIn(String(user.email || "").toLowerCase(), String(password)); return true; } catch (e) { return false; } }
    return verifyLocal(user, password);
  }
  /* Checks a password against a browser-stored account (used by browser-only mode and to migrate old accounts online) */
  async function verifyLocal(user, password) {
    if (user.passwordHash && subtle) return (await derive(String(password), unb64(user.passwordSalt), user.passwordIter || ITER)) === user.passwordHash;
    return user.password != null && String(user.password) === String(password == null ? "" : password);
  }
  function fail(msg) { throw new Error(msg); }

  var online = function () { return HEC.sync && HEC.sync.enabled; };
  function onlineError(e, fallback) {
    var m = String((e && e.message) || "");
    if (e && e.network) return e;
    if (/already|registered|exists/i.test(m)) return new Error("An account with this email already exists. Please log in instead.");
    if (/password/i.test(m) && /(least|short|weak|characters)/i.test(m)) return new Error("Your password must contain at least 8 characters.");
    if (/rate|too many|seconds/i.test(m)) return new Error("Too many attempts. Please wait a minute and try again.");
    return new Error(fallback || m || "Something went wrong. Please try again.");
  }

  async function registerOnline(data) {
    var email = String(data.email || "").trim().toLowerCase(), r;
    try { r = await HEC.sync.signUp(email, String(data.password), { full_name: String(data.fullName || "").trim(), grade: String(data.grade || "") }); }
    catch (e) { throw onlineError(e, "Could not create your account. Please try again."); }
    if (!r.session) { var pending = new Error("Account created. Check your email to confirm it, then log in."); pending.info = true; throw pending; }
    try { return await HEC.sync.pull(r.session.user.id, email); }
    catch (e) { throw onlineError(e, "Your account was created, but your profile could not be loaded. Please log in."); }
  }
  async function loginOnline(emailValue, password) {
    var email = String(emailValue || "").trim().toLowerCase(), s;
    try { s = await HEC.sync.signIn(email, password); }
    catch (e) {
      if (!HEC.sync.isBadLogin(e)) throw onlineError(e);
      /* An account made before online accounts existed: check it against the browser copy, then create the online account from it. */
      var legacy = HEC.store.readUsers().find(function (u) { return u && String(u.email || "").toLowerCase() === email && (u.password != null || u.passwordHash); });
      if (legacy && await verifyLocal(legacy, password)) {
        try {
          var r = await HEC.sync.signUp(email, String(password), { full_name: legacy.fullName || "", grade: String(legacy.grade || "") });
          if (r.session) s = r.session;
        } catch (e2) { /* fall through to the normal message */ }
      }
      if (!s) fail("We could not find a matching account. Check your details or register first.");
    }
    try { return await HEC.sync.pull(s.user.id, email); }
    catch (e) { throw onlineError(e, "You are signed in, but your profile could not be loaded. Please try again."); }
  }

  async function register(data) {
    if (online()) return registerOnline(data);
    var users;
    try { users = HEC.store.readUsers(); } catch (e) { fail("Browser storage is unavailable. Open the site through a web server and allow site storage."); }
    var email = String(data.email || "").trim().toLowerCase();
    if (users.some(function (u) { return u && String(u.email || "").trim().toLowerCase() === email; }))
      fail("An account with this email already exists. Please log in instead.");
    var user = { id: "hec_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10),
      fullName: String(data.fullName || "").trim(), email: email, grade: String(data.grade || ""),
      createdAt: new Date().toISOString(), region: "", stream: "", examHistory: [], studyPlan: [], preferences: { theme: "light" } };
    await setPassword(user, data.password);
    users.push(user);
    try { HEC.store.writeUsers(users); } catch (e) { fail("Could not save your account. Check browser storage and available space."); }
    try { localStorage.setItem(HEC.store.keys.current, user.id); } catch (e) { fail("Account saved, but the session could not be started. Please log in."); }
    return user;
  }
  async function login(emailValue, password) {
    if (online()) return loginOnline(emailValue, password);
    var email = String(emailValue || "").trim().toLowerCase(), user = null;
    var users = HEC.store.readUsers();
    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      if (u && typeof u.email === "string" && u.email.trim().toLowerCase() === email && await verifyPassword(u, password)) { user = u; break; }
    }
    if (!user) fail("We could not find a matching account. Check your details or register first.");
    if (!user.id) fail("This saved account is incomplete. Please register again.");
    if (user.password != null && subtle) {          // upgrade a plain-text account
      try { await setPassword(user, password); HEC.store.saveUser(user); } catch (e) { /* login still works */ }
    }
    try { localStorage.setItem(HEC.store.keys.current, user.id); } catch (e) { fail("Your details matched, but browser storage could not start a session."); }
    return user;
  }
  function logout() {
    if (online()) HEC.sync.signOut();
    try { localStorage.removeItem(HEC.store.keys.current); return true; } catch (e) { return false; } }

  HEC.auth = Object.freeze({ register: register, login: login, logout: logout, currentUser: HEC.store.currentUser,
    setPassword: setPassword, verifyPassword: verifyPassword });
  window.HECAuth = HEC.auth;     // the old global name, kept so nothing external breaks
})();
