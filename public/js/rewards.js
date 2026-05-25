// === Global Reward Toast System — DISABLED ===
// The user found the yellow/red balloon toasts visually intrusive and asked
// for them to be erased EVERYWHERE. We keep the window.Rewards API surface
// (so existing call sites don't error), but every method is now a no-op.
// To re-enable later, restore the original module body from git history
// (commit before 2026-05-25).
//
// ⚠ Earlier this file used a MutationObserver on document.documentElement
// to nuke any reward-toast DOM that snuck in. That observer ran on EVERY
// mutation anywhere on the page — which murdered Triage (rapid EKG / patient
// timer / bed updates). Removed. CSS `display: none !important` on
// `.reward-toast*` is enough to hide anything that slips through.
(function () {
  'use strict';
  function noop() {}
  window.Rewards = {
    show: noop,
    combo: noop,
    streak: noop,
    epic: noop,
    speed: noop,
    chinese: noop,
    ICONS: {},
    MSGS: {},
  };
  // One-shot cleanup of any toast layer left in the DOM (e.g. from a cached
  // page). No observer — CSS handles future cases.
  try {
    document
      .querySelectorAll('.reward-toast-layer, .reward-toast')
      .forEach((el) => el.remove());
  } catch (e) { /* ignore */ }
})();
