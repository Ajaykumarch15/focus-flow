/* FocusFlow pre-React loader — theme detection, app-ready handoff, failsafe.
   Zero dependencies; loaded synchronously right after #focusflow-preloader. */
(function () {
  'use strict';

  var el = document.getElementById('focusflow-preloader');
  if (!el) return;

  /* Theme: cached app preference first, then OS preference (default dark). */
  var mode = null;
  try {
    var raw = localStorage.getItem('ff_theme_cache');
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && (parsed.mode === 'light' || parsed.mode === 'dark')) mode = parsed.mode;
    }
  } catch (e) { /* ignore malformed cache */ }

  if (mode !== 'light' && mode !== 'dark') {
    mode = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  }
  el.classList.toggle('theme-dark', mode === 'dark');

  /* Fade out and remove once React signals readiness. */
  var hidden = false;
  function hide() {
    if (hidden) return;
    hidden = true;
    el.classList.add('ff-hide');
    function done() { if (el.parentNode) el.parentNode.removeChild(el); }
    el.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 600); /* covers transition:none under reduced motion */
  }

  window.addEventListener('focusflow:app-ready', hide);

  /* Failsafe only — normal path is the app-ready event. */
  setTimeout(hide, 15000);
})();
