// zoco-coins.js · the «+N monedas» moment of El Zoco de Dralingo (2026-10-19, his OK of the Souq's design). Every step
// that pays answers `coins: { got, c, items }` (server.js: La Base's seals, El Entrenamiento's rounds, the homework marks);
// the page hands it here: DralyCoins.pop(coins). A small gold pill slides in at the top edge for a moment (taps close
// together add up: «+6 monedas»), never over a button or blocking anything (pointer-events: none), reduced motion = a
// fade. «Deshacer» of a homework shows what went back («−50 monedas»). Pages listening for the new total (the home's
// coins pill) hear the `draly:coins` event. Loaded by homework.html and audios.html (css/zoco-coins.css).
(function () {
  'use strict';
  let sum = 0, total = null, timer = null, hide = null, el = null;
  const calm = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const COIN = '<svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true" focusable="false"><circle cx="16" cy="16" r="14" fill="#e8c878" stroke="#b88b2c" stroke-width="2.5"/><circle cx="16" cy="16" r="9" fill="none" stroke="#b88b2c" stroke-width="1.8"/><path d="M16 10.5l1.7 3.5 3.8.5-2.8 2.6.7 3.8L16 19l-3.4 1.9.7-3.8-2.8-2.6 3.8-.5z" fill="#b88b2c"/></svg>';
  function sound() {
    if (sum <= 0) return;
    try { const a = new Audio('/assets/sixseven/coins.mp3'); a.volume = 0.5; const p = a.play(); if (p && p.catch) p.catch(() => {}); } catch (_) { /* the pill still shows */ }
  }
  // a coins pill on screen (the home's band, the Zoco's purse, the home's door): the coins fly out of it instead of a
  // pill over the page's top (where «Volver» lives)
  const ANCHORS = '.zc-purse, .md-coins, .md-coins-mini, .md-zoco-c, .md-tile-coins';
  function anchor() {
    const list = Array.prototype.slice.call(document.querySelectorAll(ANCHORS));
    for (let i = 0; i < list.length; i++) {
      const r = list[i].getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom < window.innerHeight - 60) return list[i];
    }
    return null;
  }
  function fly(a, n) {
    const r = a.getBoundingClientRect();
    const f = document.createElement('div');
    f.className = 'zc-float';
    f.setAttribute('role', 'status');
    f.innerHTML = COIN + '<b>+' + n + '</b><span class="zc-sr">' + (n === 1 ? ' moneda' : ' monedas') + '</span>';
    f.style.left = Math.round(Math.min(window.innerWidth - 50, Math.max(50, r.left + r.width / 2))) + 'px';
    f.style.top = Math.round(r.bottom + 6) + 'px';
    document.body.appendChild(f);
    a.classList.remove('zc-bump');
    void a.offsetWidth;
    a.classList.add('zc-bump');
    setTimeout(() => { f.remove(); a.classList.remove('zc-bump'); }, calm() ? 1800 : 1600);
  }
  function show() {
    timer = null;
    const n = sum;
    sum = 0;
    if (!n) return;
    const a = n > 0 ? anchor() : null;
    if (a) { fly(a, n); if (!calm()) sound(); return; }
    if (!el) {
      el = document.createElement('div');
      el.className = 'zc-pop';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    const up = n > 0;
    el.classList.toggle('is-back', !up);
    el.innerHTML = COIN + '<span><b>' + (up ? '+' + n : '−' + Math.abs(n)) + (Math.abs(n) === 1 ? ' moneda' : ' monedas') + '</b>' +
      '<small>' + (up ? 'para el Zoco de Dralingo' : 'volvieron al deshacer') + '</small></span>';
    el.classList.remove('is-on');
    void el.offsetWidth;
    el.classList.add('is-on');
    if (up && !calm()) sound();
    clearTimeout(hide);
    hide = setTimeout(() => { if (el) el.classList.remove('is-on'); }, 2600);
  }
  // coins: { got, c } from a step's answer (got: what this step paid, c: the purse now). opts.delay: wait first (a star
  // screen that is still coming in)
  function pop(coins, opts) {
    const n = coins && Number(coins.got);
    if (!n) return;
    sum += n;
    if (coins.c != null && Number.isFinite(Number(coins.c))) total = Number(coins.c);
    seen(coins.at);
    try { document.dispatchEvent(new CustomEvent('draly:coins', { detail: { got: n, c: total } })); } catch (_) { /* old browser */ }
    clearTimeout(timer);
    timer = setTimeout(show, Math.max(500, Number(opts && opts.delay) || 0));
  }
  // what this phone already showed, by the SERVER's clock (each answer's `at`): the home pops only newer coins
  // (localStorage draly_zoco_seen: a draly… key, so the move to app.dralingo.app carries it)
  const SEEN = 'draly_zoco_seen';
  function seen(at) {
    const t = Number(at);
    if (!Number.isFinite(t) || t <= 0) return lastSeen();
    try { if (t > lastSeen()) localStorage.setItem(SEEN, String(t)); } catch (_) { /* private mode */ }
    return Math.max(t, lastSeen());
  }
  function lastSeen() { try { const v = Number(localStorage.getItem(SEEN)); return Number.isFinite(v) && v > 0 ? v : 0; } catch (_) { return 0; } }
  window.DralyCoins = { pop, seen, lastSeen };
})();
