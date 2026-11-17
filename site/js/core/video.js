/* Video links. Only https links are accepted. YouTube is played in the privacy-enhanced embed using the 11-character
   video id alone; the site never inserts raw embed code from data. Every other host opens in a new tab. */
(function () {
  "use strict";
  var HEC = window.HEC = window.HEC || {};

  function youtubeId(url) {
    try {
      var u = new URL(url);
      if (u.protocol !== "https:") return "";
      var id = "";
      if (u.hostname === "youtu.be") id = u.pathname.slice(1);
      else if (/(^|\.)youtube\.com$/.test(u.hostname)) id = u.pathname === "/watch" ? u.searchParams.get("v") : (u.pathname.match(/^\/(?:embed|shorts)\/([^/?]+)/) || [])[1];
      return /^[A-Za-z0-9_-]{11}$/.test(id || "") ? id : "";
    } catch (e) { return ""; }
  }
  /* Playable inline only when the host is YouTube and the entry allows embedding (permission is "embed-allowed" or unset for own content) */
  function embedUrl(entry) {
    var id = youtubeId(entry.url);
    if (!id || (entry.permission && entry.permission !== "embed-allowed" && entry.permission !== "own")) return "";
    return "https://www.youtube-nocookie.com/embed/" + id + "?rel=0";
  }
  function host(url) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return ""; } }

  /* Watched state and "continue where you left off" live in one per-student key, hec_video_<userId>. */
  function markWatched(id, done) { var s = HEC.store.videoState(); s[id] = Object.assign({}, s[id], { done: !!done, at: new Date().toISOString() }); HEC.store.saveVideoState(s); }
  function isWatched(id) { var e = HEC.store.videoState()[id]; return !!(e && e.done); }
  function lastOpened(ids) {
    var s = HEC.store.videoState(), best = null;
    ids.forEach(function (id) { if (s[id] && s[id].at && (!best || s[id].at > s[best].at)) best = id; });
    return best;
  }
  HEC.video = { youtubeId: youtubeId, embedUrl: embedUrl, host: host, markWatched: markWatched, isWatched: isWatched, lastOpened: lastOpened };
})();
