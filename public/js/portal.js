// HwPortal — the game-show layer of the student portal (/homework), 2026-10-13 remake (docs/specs/portal-remake.md).
// His rules: "game-show moments on every phone" and "alive, randomized, not overdone". homework.js keeps all the logic
// and calls in here at a few points; every call is guarded (`window.HwPortal &&`), so the portal still works without it.
//   HwPortal.welcome({ code, name, avatarUrl, level })             once per visit per kid, ≤ 2.2 s, tap to skip
//   HwPortal.reveal({ score, total, right, of, pass, passPct, avatarUrl, actions, continueLabel, onClose })
//                                                                   every way a tarea ends
//   HwPortal.hud(progress, code, onList)                            level-up / streak banner when the home shows more
//   HwPortal.combo(n, host)                                         «¡Combo x3!» chip in the quiz player
//   HwPortal.screen(name)                                           starts / stops the alive hero on the home
// Silent on purpose (no mute on the portal, kids do homework next to sleeping siblings). Reduced motion: every moment
// shows its final frame, nothing moves, no confetti.
(function () {
  'use strict';

  // ── POSE HOOKS ──────────────────────────────────────────────────────────────────────────────────────────────
  // The new gang poses (ready / victory / kind-sad / pointing) are being drawn on 2026-10-13. When they land, copy the
  // WebPs to /assets/cast/<id>-<pose>.webp (Dralingo: /assets/dralingo/<pose>.webp) and change ONLY these entries.
  //   ready    → the home hero (Dralingo + the friend who peeks in), the welcome (Dralingo)
  //   victory  → the reveal when the tarea passed, the level-up and streak banners
  //   kindSad  → the reveal when it didn't pass (kind, never mocking)
  //   pointing → empty states («¡Sin pendientes!»)
  const D = '/assets/dralingo/';
  const C = '/assets/cast/';
  const GANG = ['fer', 'hamdan', 'latifa', 'aileen', 'adric', 'adrian'];
  const POSES = {
    dralingo: { ready: D + 'hello.webp', victory: D + 'power.webp', kindSad: D + 'wise.webp', pointing: '/assets/kingdoms/dralingo/pointing.webp' },
  };
  GANG.forEach((id) => {
    POSES[id] = { ready: C + id + '-hello.webp', victory: C + id + '-cheer.webp', kindSad: C + id + '-mystery.webp', pointing: C + id + '-hello.webp' };
  });
  function pose(id, p) { const c = POSES[id] || POSES.dralingo; return c[p] || c.ready; }
  let kidAvatar = null;   // the kid's own avatar id (HwPortal.kid): the friends who react are never the kid

  const Cast = () => window.DralingoCast || null;
  const castName = (id) => (Cast() ? Cast().name(id) : (id === 'dralingo' ? 'Dralingo' : ''));
  const castLine = (id, mood, fallback) => (Cast() ? Cast().line(id, mood) : fallback);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const img = (cls, src, alt) => { const i = el('img', cls); i.alt = alt || ''; i.draggable = false; i.decoding = 'async'; i.src = src; return i; };
  const store = {
    get(k) { try { return window.localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { window.localStorage.setItem(k, v); } catch (_) {} },
    sget(k) { try { return window.sessionStorage.getItem(k); } catch (_) { return null; } },
    sset(k, v) { try { window.sessionStorage.setItem(k, v); } catch (_) {} },
  };

  // ── one moment at a time (the welcome, then a level-up, never two on top of each other) ──────────────────────
  const queue = [];
  let playing = false;
  function enqueue(run) { queue.push(run); if (!playing) next(); }
  function next() {
    const run = queue.shift();
    if (!run) { playing = false; return; }
    playing = true;
    let done = false;
    const finish = () => { if (done) return; done = true; setTimeout(next, 120); };
    try { run(finish); } catch (_) { finish(); }
    setTimeout(finish, 6000);   // a moment can never block the queue
  }

  // ── WELCOME: the kid and Dralingo slide in over a gold | sky split, «¡Hola, Sofia!» stamps in ──────────────────
  function welcome(o) {
    if (!o || !o.code) return;
    if (store.sget('hw_ptWelcome') === o.code) return;   // once per visit per kid
    store.sset('hw_ptWelcome', o.code);
    enqueue((finish) => {
      const root = el('div', 'pt-welcome');
      root.setAttribute('role', 'status');
      root.appendChild(el('div', 'pt-wc-split'));
      const kid = el('div', 'pt-wc-kid');
      if (o.avatarUrl) kid.appendChild(img('', o.avatarUrl));
      root.appendChild(kid);
      root.appendChild(img('pt-wc-dragon', pose('dralingo', 'ready')));
      const words = el('div', 'pt-wc-words');
      words.appendChild(el('div', 'pt-wc-stamp', o.name ? '¡Hola, ' + o.name + '!' : '¡Hola!'));
      if (o.level) words.appendChild(el('div', 'pt-wc-level', o.level));
      words.appendChild(el('div', 'pt-wc-sub', '¡Vamos a jugar!'));
      root.appendChild(words);
      document.body.appendChild(root);
      if (reduced()) root.classList.add('is-still');
      requestAnimationFrame(() => root.classList.add('is-in'));
      let gone = false;
      const leave = () => {
        if (gone) return;
        gone = true;
        root.classList.add('is-out');
        setTimeout(() => { root.remove(); finish(); }, reduced() ? 120 : 260);
      };
      root.addEventListener('click', leave);
      setTimeout(leave, reduced() ? 1400 : 2200);
    });
  }

  // ── confetti: CSS pieces, only for a passed tarea, gone after 3 s ────────────────────────────────────────────
  const CONF = ['#ffc93c', '#2f7bea', '#f0443a', '#26a65b', '#ff8fb8', '#fff7e3', '#9fdcf7'];
  function confetti(host, n) {
    if (reduced()) return;
    const layer = el('div', 'pt-confetti');
    layer.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < n; i++) {
      const p = el('i');
      p.style.left = (Math.random() * 100) + '%';
      p.style.background = CONF[i % CONF.length];
      p.style.animationDelay = (Math.random() * 0.5) + 's';
      p.style.animationDuration = (1.7 + Math.random() * 1.3) + 's';
      p.style.setProperty('--r', (Math.random() > 0.5 ? '' : '-') + (240 + Math.random() * 420) + 'deg');
      p.style.setProperty('--x', ((Math.random() - 0.5) * 120) + 'px');
      layer.appendChild(p);
    }
    host.appendChild(layer);
    setTimeout(() => layer.remove(), 3400);
  }

  // a 5-point star drawn as geometry (not a picture): gold when earned, white when not
  function starSvg() {
    const ns = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 48 46');
    s.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', 'M24 3l6.2 13.1 14.3 1.8-10.5 9.9 2.7 14.2L24 35l-12.7 7 2.7-14.2L3.5 17.9l14.3-1.8z');
    s.appendChild(p);
    return s;
  }

  function countUp(node, to, ms) {
    if (reduced() || to <= 0) { node.textContent = String(to); return; }
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);   // ease-out: fast start, gentle landing on the number
      node.textContent = String(Math.round(to * e));
      if (k < 1 && node.isConnected) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function lineFor(who, pass, pct) {
    if (pass) return castLine(who, 'win', '¡Bien hecho!');
    for (let i = 0; i < 6; i++) {   // under 50 points «Casi» would not be true: keep the kind lines that don't say it
      const l = castLine(who, 'oops', '¡Otra vez!');
      if (pct >= 50 || !/casi/i.test(l)) return l;
    }
    return '¡Otra vez! Tú puedes.';
  }

  // ── RESULTS REVEAL ────────────────────────────────────────────────────────────────────────────────────────────
  // o.actions: [{ label, kind: 'primary'|'secondary', run }]; «Continuar» is always there and always works.
  // The overlay keeps the .hw-epic class: homework-pastel.css hides the pinned code stack under it.
  function reveal(o) {
    o = o || {};
    const total = o.total || 100;
    const score = Math.max(0, Math.round(o.score || 0));
    const pct = total > 0 ? (score / total) * 100 : 0;
    const passPct = o.passPct || 80;
    const pass = o.pass != null ? !!o.pass : pct >= passPct;
    const stars = pct >= 95 ? 3 : pct >= passPct ? 2 : pct >= 50 ? 1 : 0;
    // a friend reacts, never the kid's own avatar; Adric's quiet «Nada mal» is not a ¡PERFECTO! line
    const who = pick(GANG.filter((id) => id !== kidAvatar && !(pct >= 95 && id === 'adric')));
    const title = pct >= 95 ? '¡PERFECTO!' : pass ? '¡EXCELENTE!' : pct >= 50 ? '¡Casi!' : '¡Tú puedes!';

    const ov = el('div', 'hw-epic pt-reveal ' + (pass ? 'is-pass' : 'is-low'));
    ov.id = 'pt-reveal';   // an id: homework-pastel.css styles .hw-epic through an :is() list that carries ids
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Resultado');
    if (pass) ov.appendChild(el('div', 'pt-rv-rays'));
    const card = el('div', 'pt-rv-card');
    const cast = el('div', 'pt-rv-cast');
    const kid = el('div', 'pt-rv-kid');
    if (o.avatarUrl) kid.appendChild(img('', o.avatarUrl));
    cast.appendChild(kid);
    cast.appendChild(img('pt-rv-gang', pose(who, pass ? 'victory' : 'kindSad')));
    card.appendChild(cast);
    card.appendChild(el('div', 'pt-rv-title', title));
    const starsRow = el('div', 'pt-rv-stars');
    starsRow.setAttribute('role', 'img');
    starsRow.setAttribute('aria-label', stars + ' / 3');
    for (let i = 0; i < 3; i++) {
      const st = el('span', 'pt-star' + (i < stars ? ' is-on' : ''));
      st.style.setProperty('--i', i);
      st.appendChild(starSvg());
      starsRow.appendChild(st);
    }
    card.appendChild(starsRow);
    const sc = el('div', 'pt-rv-score');
    const num = el('b', 'pt-rv-num', '0');
    sc.appendChild(num);
    sc.appendChild(el('span', 'pt-rv-of', '/' + total));
    card.appendChild(sc);
    if (o.of) card.appendChild(el('p', 'pt-rv-note', (o.right || 0) + ' de ' + o.of + ' correctas'));
    if (!pass) card.appendChild(el('p', 'pt-rv-need', 'Con ' + Math.ceil((total * passPct) / 100) + ' puntos pasas. ¡Inténtalo otra vez!'));
    const said = el('p', 'pt-rv-line');
    said.appendChild(el('b', 'pt-rv-who', castName(who)));
    said.appendChild(el('span', '', lineFor(who, pass, pct)));
    card.appendChild(said);

    const acts = el('div', 'pt-rv-actions');
    let closed = false;
    const close = (then) => {
      if (closed) return;
      closed = true;
      ov.classList.add('is-out');
      document.removeEventListener('keydown', onKey);
      behind.forEach((n) => { n.inert = false; });
      setTimeout(() => {
        ov.remove();
        if (opener && opener.isConnected && opener.focus) { try { opener.focus({ preventScroll: true }); } catch (_) {} }
        if (o.onClose) { try { o.onClose(); } catch (_) {} }
        if (then) { try { then(); } catch (_) {} }
      }, reduced() ? 60 : 180);
    };
    (o.actions || []).forEach((a) => {
      const b = el('button', 'pt-rv-btn ' + (a.kind === 'primary' ? 'is-primary' : 'is-secondary'), a.label);
      b.type = 'button';
      b.addEventListener('click', () => close(a.run));
      acts.appendChild(b);
    });
    const cont = el('button', 'hw-epic-ok pt-rv-btn ' + ((o.actions || []).some((a) => a.kind === 'primary') ? 'is-secondary' : 'is-primary'), o.continueLabel || ((o.actions || []).length ? '📚 Mis tareas' : 'Continuar'));
    cont.type = 'button';
    cont.addEventListener('click', () => close());
    acts.appendChild(cont);
    card.appendChild(acts);
    ov.appendChild(card);
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const opener = document.activeElement;
    const behind = Array.prototype.filter.call(document.querySelectorAll('body > .container, #hw-tr-play'), (n) => !n.inert);
    behind.forEach((n) => { n.inert = true; });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(ov);
    if (reduced()) ov.classList.add('is-still');
    requestAnimationFrame(() => ov.classList.add('is-in'));
    // the card lands first (260 ms), then the number climbs (900 ms), then the stars, the headline and the friend's line
    setTimeout(() => countUp(num, score, 900), reduced() ? 0 : 250);
    if (pass) setTimeout(() => { if (ov.isConnected) confetti(ov, pct >= 95 ? 60 : 40); }, reduced() ? 0 : 1600);
    card.tabIndex = -1;   // focus lands in the dialog (keyboard / screen readers) without a ring on a kid's button
    setTimeout(() => { try { card.focus({ preventScroll: true }); } catch (_) {} }, 50);
    return ov;
  }

  // ── HUD MOMENTS: a higher level or a longer streak than this phone saw last time ─────────────────────────────
  function banner(title, sub, src, kind) {
    enqueue((finish) => {
      const b = el('div', 'pt-banner ' + (kind || ''));
      b.setAttribute('role', 'status');
      b.appendChild(img('pt-banner-pose', src));
      const t = el('div', 'pt-banner-text');
      t.appendChild(el('b', '', title));
      if (sub) t.appendChild(el('span', '', sub));
      b.appendChild(t);
      document.body.appendChild(b);
      if (reduced()) b.classList.add('is-still');
      requestAnimationFrame(() => b.classList.add('is-in'));
      const hud = document.getElementById('hw-hud');
      if (hud && !reduced()) { hud.classList.remove('pt-bump'); void hud.offsetWidth; hud.classList.add('pt-bump'); }
      setTimeout(() => {
        b.classList.add('is-out');
        setTimeout(() => { b.remove(); finish(); }, 220);
      }, 2200);
    });
  }
  function hud(p, code, onList) {
    if (!p || !code) return;
    const key = 'hw_ptHud_' + code;
    let seen = null;
    try { seen = JSON.parse(store.get(key) || 'null'); } catch (_) { seen = null; }
    const now = { l: p.level || 1, s: p.streak || 0 };
    store.set(key, JSON.stringify(now));
    if (!seen || !onList) return;   // first visit only remembers; other screens celebrate in their own way
    if (now.l > seen.l) banner('¡Subiste a Nivel ' + now.l + '!', '¡Sigue así!', pose('dralingo', 'victory'), 'is-level');
    else if (now.s > seen.s && now.s >= 2) banner('¡Racha de ' + now.s + ' días!', 'Vuelve mañana para no perderla', pose(pick(GANG.filter((id) => id !== kidAvatar)), 'victory'), 'is-streak');
  }

  // ── COMBO chip in the quiz player: 3, 5, 8, 10… right in a row ──────────────────────────────────────────────
  const COMBO_AT = [3, 5, 8, 10, 15, 20];
  function combo(n, host) {
    if (COMBO_AT.indexOf(n) < 0 || !host) return;
    const old = host.querySelector('.pt-combo');
    if (old) old.remove();
    const c = el('div', 'pt-combo', '¡Combo x' + n + '!');
    c.setAttribute('role', 'status');
    host.appendChild(c);
    setTimeout(() => c.remove(), reduced() ? 1200 : 1400);
  }

  // ── THE ALIVE HERO on the home: Dralingo breathes, a friend peeks in with a line and changes every 12 s ────────
  const ANIMALS = [
    { id: 'camel', src: '/assets/saga/anim/camel-still.webp', who: 'Camello', line: '¡Hola! Soy el camello de Dubái 🐪' },
    { id: 'oryx', src: '/assets/saga/anim/oryx-still.webp', who: 'Órix', line: '¡Salta conmigo a estudiar!' },
    { id: 'falcon', src: '/assets/saga/anim/falcon-still.webp', who: 'Halcón', line: '¡Vuela alto hoy!' },
  ];
  let heroTimer = null;
  let lastFriend = null;
  function kid(id) { kidAvatar = id || null; }
  function friends() {
    return GANG.filter((id) => id !== kidAvatar).map((id) => ({ src: pose(id, 'ready'), who: castName(id), line: castLine(id, 'hello', '¡Hola!') })).concat(ANIMALS.filter((a) => a.id !== kidAvatar));
  }
  function buildHero() {
    const host = document.getElementById('pt-hero-cast');
    if (!host) return null;
    if (!host.firstChild) {
      host.appendChild(img('pt-hero-dragon', pose('dralingo', 'ready'), 'Dralingo'));
      const f = el('div', 'pt-hero-friend');
      const fi = el('img'); fi.alt = ''; fi.draggable = false;   // no src yet: the first friend appears without a swap
      f.appendChild(fi);
      host.appendChild(f);
      // the bubble is its own cell of the hero grid (left of the friend), so a long line grows the hero, never covers
      const bub = el('p', 'pt-hero-bubble');
      bub.setAttribute('aria-hidden', 'true');
      host.parentNode.insertBefore(bub, host);
    }
    return host;
  }
  function showFriend() {
    const host = buildHero();
    if (!host) return;
    const pool = friends().filter((x) => x.src !== lastFriend);
    const f = pick(pool);
    lastFriend = f.src;
    const box = host.querySelector('.pt-hero-friend');
    const im = box.querySelector('img');
    const bub = host.parentNode.querySelector('.pt-hero-bubble');
    const swap = () => {
      im.src = f.src;
      im.alt = f.who || '';
      bub.textContent = '';
      if (f.who) bub.appendChild(el('b', '', f.who));
      bub.appendChild(document.createTextNode(f.line));
      box.classList.remove('is-pop', 'is-out');
      bub.classList.remove('is-out');
      if (!reduced()) { void box.offsetWidth; box.classList.add('is-pop'); }
    };
    if (reduced() || !im.getAttribute('src')) { swap(); return; }
    box.classList.add('is-out');
    bub.classList.add('is-out');
    setTimeout(swap, 200);
  }
  function heroStart() {
    if (!document.getElementById('pt-hero-cast')) return;
    heroStop();
    showFriend();
    if (reduced()) return;   // one still pick, nothing moves
    heroTimer = setInterval(() => {
      const list = document.getElementById('screen-list');
      if (document.hidden || !list || list.classList.contains('hidden') || list.classList.contains('pt-in-folder')) return;
      if (document.querySelector('#hw-tr-play, #hw-sack-overlay, #pt-reveal, #hw-sentences-overlay:not(.hidden), .hw-inbox-overlay.show')) return;
      showFriend();
    }, 12000);
  }
  function heroStop() { if (heroTimer) { clearInterval(heroTimer); heroTimer = null; } }
  function screen(name) {
    if (name === 'list') { if (!heroTimer) heroStart(); } else heroStop();
  }

  if (document.body && document.body.classList.contains('hw-portal')) {
    window.HwPortal = { POSES, pose, welcome, reveal, hud, combo, confetti, screen, kid, heroStart, heroStop };
  }
})();
