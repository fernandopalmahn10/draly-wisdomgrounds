// =========================================================================
// ruta.js · La Ruta Dorada (/audios), phase 2 (2026-10-15)
// =========================================================================
// His pick: "like choosing a world in a Nintendo game". Two screens, drawn by js/audios.js's router:
//   Ruta.picker(main, ctx)        /audios          one big glossy card per module of core/levels.js (YCT 1, New
//                                                  HSK 1, HSK 1, and every level added there later). Swipe (touch,
//                                                  mouse drag), arrow keys, the ‹ › buttons or the dots: the next card
//                                                  flies in with depth and a little bounce (a spring, transform and
//                                                  opacity only). Reduced motion: a calm crossfade. The first frame is
//                                                  still (a whole class may open it at once).
//   Ruta.path(main, ctx, module)  /audios/<level>  the module's golden route: 1 La Base, 2 El Entrenamiento (muy
//                                                  pronto), 3 El Simulacro Dorado (the level's sims), then the
//                                                  homework audios of the level (open, unchanged).
// What is open comes from the server (GET /api/ruta-dorada, LevelKeys.access per level: a teacher, the logged-in
// kid's account, this device's key). A locked module shows its locks and «Escribe la clave de <nivel>», which opens
// the phase-1 key screen at /audios/<level>/clave and comes back here. The sims only reach this page when open, and
// each one opens its player through the same key check at the player's door.
// No hanzi here, no em dash (scripts/test-audios-base.js).
// =========================================================================
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const calmMotion = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (_) {} },
    getL(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    setL(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
  };

  // ── look ──────────────────────────────────────────────────────────
  // one jewel colour per module, all living with Rojo Imperial, Oro and Crema (the books' palette): light · base · deep
  const FAMILY_LOOK = {
    yct: ['#a8352c', '#6c1513', '#360606'],      // Rojo Imperial
    newhsk: ['#24806b', '#0e4d43', '#04221d'],   // Jade
    hsk: ['#3c5bb0', '#1b2f6b', '#0a1435'],      // Lapislázuli
  };
  const EXTRA_LOOKS = [
    ['#83449a', '#4a1d5a', '#200a28'],           // Amatista
    ['#22788e', '#0f3f4c', '#041b22'],           // Petróleo
    ['#9a6a1e', '#5e3d0c', '#2a1a04'],           // Ámbar
  ];
  const FAMILY_SUB = { yct: 'El examen de los niños', newhsk: 'El nuevo HSK', hsk: 'El HSK clásico' };
  // the same family twice (YCT 2 after YCT 1) takes the next free colour, so two cards never look alike
  function looksFor(modules) {
    const used = new Set();
    let extra = 0;
    const out = {};
    modules.forEach((m) => {
      let look = FAMILY_LOOK[m.family];
      if (!look || used.has(m.family)) look = EXTRA_LOOKS[extra++ % EXTRA_LOOKS.length];
      used.add(m.family);
      out[m.slug] = look;
    });
    return out;
  }
  const lookStyle = (l) => '--c1:' + l[0] + ';--c2:' + l[1] + ';--c3:' + l[2];
  // Dralingo in his platform look; a different pose on each card, a new mix on every visit («alive, randomized»)
  const POSES = ['/assets/dralingo/hello.webp', '/assets/dralingo/power.webp', '/assets/dralingo/wise.webp'];
  const shuffled = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = b[i]; b[i] = b[j]; b[j] = t; } return b; };
  const visitPoses = shuffled(POSES);
  const poseOf = (i) => visitPoses[i % visitPoses.length];

  const I = {
    book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M2.5 5.2c2.9-1.2 6-1 8.8.9v13.4c-2.8-1.8-5.9-2-8.8-.9zM21.5 5.2c-2.9-1.2-6-1-8.8.9v13.4c2.8-1.8 5.9-2 8.8-.9z"/></svg>',
    target: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="4.6" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 3.5h10v5.2a5 5 0 0 1-10 0z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M7 5.5H4.6a2.6 2.6 0 0 0 2.7 4.4M17 5.5h2.4a2.6 2.6 0 0 1-2.7 4.4M12 13.8v3.4"/><path fill="currentColor" d="M8 20.5h8v-.7a2.6 2.6 0 0 0-2.6-2.6h-2.8A2.6 2.6 0 0 0 8 19.8z"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 11.5V8a4 4 0 0 1 8 0v3.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><rect x="4.5" y="11" width="15" height="10.5" rx="2.6" fill="currentColor"/></svg>',
    soon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" d="M7 3.5h10M7 20.5h10M8 3.5c0 4.6 8 4.7 8 8.5s-8 3.9-8 8.5M16 3.5c0 4.6-8 4.7-8 8.5s8 3.9 8 8.5"/></svg>',
    key: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2.4"/><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M12.2 12H21M18 12v3.2M21 12v2.4"/></svg>',
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    again: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12a7 7 0 1 0 2.1-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M6.6 2.8v4.6h4.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  const sky = '<svg class="rd-sky" viewBox="0 0 400 110" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false"><use href="#rd-sky"/></svg>' +
    '<svg class="rd-sky rd-sky-mirror" viewBox="0 0 400 110" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false"><use href="#rd-sky"/></svg>';
  const skyWide = '<svg class="rd-sky" viewBox="0 0 800 110" preserveAspectRatio="xMinYMax slice" aria-hidden="true" focusable="false">' +
    '<use href="#rd-sky" x="0" y="0" width="400" height="110"/><use href="#rd-sky" x="400" y="0" width="400" height="110"/></svg>';

  // ── what a module holds, for this visitor ─────────────────────────
  // base / gold: 'open' | 'locked' | 'soon' (nothing yet); train: 'soon' until phase 4
  function statesOf(m) {
    return {
      base: !m.base ? 'soon' : (m.open ? 'open' : 'locked'),
      train: 'soon',
      gold: !m.simCount ? 'soon' : (m.open ? 'open' : 'locked'),
    };
  }
  const sellos = (n, of) => n + ' de ' + of + ' sellos';   // the same wording as La Base: «7 de 83 sellos»
  function sealsOf(ctx, m) {
    const b = m.base && (ctx.catalog.bases || []).find((x) => x.id === m.base.id);
    return b ? ctx.sealsOf(b) : new Set();
  }

  // a friend of the gang cheers along (a new one, and a new line, on each visit: «alive, randomized»)
  function friendRow(cls) {
    const C = window.DralingoCast;
    if (!C) return '';
    const f = C.pick(1)[0];
    return '<div class="rd-friend' + (cls ? ' ' + cls : '') + '"><img src="' + esc(C.pose(f, 'ruta')) + '" alt="" width="200" height="240" decoding="async">' +
      '<p class="rd-bubble"><b>' + esc(C.name(f)) + '</b>' + esc(C.line(f, 'ruta')) + '</p></div>';
  }

  // ── the picker: big glossy cards that fly ─────────────────────────
  let live = null;   // the carousel on screen (one at a time)
  function leave() { if (live) { live.destroy(); live = null; } }

  function cardHtml(m, i, look, ctx) {
    const st = statesOf(m);
    const seals = m.open && m.base ? sealsOf(ctx, m).size : 0;
    // a locked module: the gold lock seal of the key screen next to its words (kids who don't read see the lock)
    const status = !m.open
      ? '<span class="rd-card-status is-locked"><span class="rd-lockseal" aria-hidden="true">' + I.lock + '</span><span id="rd-s-' + esc(m.slug) + '">Se abre con la clave</span></span>'
      : '<span class="rd-card-status" id="rd-s-' + esc(m.slug) + '">' + (m.base ? sellos(seals, m.base.words) : 'Tu ruta está abierta') + '</span>';
    const mini = [['base', 'La Base', I.book], ['train', 'Entrenamiento', I.target], ['gold', 'Simulacro', I.trophy]]
      .map(([k, label, icon]) => '<li class="is-' + st[k] + '"><i>' + (st[k] === 'locked' ? I.lock : icon) + '</i>' + label + '</li>').join('');
    return '<div class="rd-slide' + (m.name.length > 6 ? ' is-long' : '') + '" role="tabpanel" id="rd-p-' + esc(m.slug) + '" aria-labelledby="rd-t-' + esc(m.slug) + '" data-i="' + i + '">' +
      '<a class="rd-card' + (m.open ? '' : ' is-locked') + '" href="/audios/' + esc(m.slug) + '" data-nav style="' + lookStyle(look) + '"' +
        ' aria-label="Entrar a ' + esc(m.name) + '" aria-describedby="rd-s-' + esc(m.slug) + '" draggable="false">' +
        sky +
        '<img class="rd-card-dragon" src="' + poseOf(i) + '" alt="" width="432" height="480" decoding="async" draggable="false"' + (i === ctx.start ? ' fetchpriority="high"' : '') + '>' +
        '<span class="rd-card-text"><span class="rd-card-name">' + esc(m.name) + '</span>' +
          '<span class="rd-card-sub">' + esc(FAMILY_SUB[m.family] || ('Examen ' + (m.exam || m.name))) + '</span></span>' +
        '<ol class="rd-mini" aria-hidden="true">' + mini + '</ol>' +
        '<span class="rd-card-foot">' + status + '<span class="rd-card-go">Entrar' + I.right + '</span></span>' +
        '<span class="rd-card-gloss" aria-hidden="true"></span><span class="rd-card-shine" aria-hidden="true"></span>' +
        '<span class="rd-card-shade" aria-hidden="true"></span>' +
      '</a></div>';
  }

  function picker(main, ctx) {
    leave();
    const mods = ctx.ruta.modules || [];
    if (!mods.length) { main.innerHTML = '<p class="au-error">Muy pronto: tus mundos de Chino Mandarín.</p>'; return; }
    store.set('draly_ruta_from', '');   // the kid chose «all worlds»: the routes' back arrow leads here again, not to Mis tareas
    const looks = looksFor(mods);
    // the first card: the one this tab was on (back from a path), else the kid's own module (or a level this device
    // holds the key of), else the last one chosen on this phone, else the first
    const bySlug = (s) => mods.findIndex((m) => m.slug === s);
    let start = [store.get('draly_ruta_at'), ctx.ruta.home, store.getL('draly_ruta_last')].map(bySlug).find((i) => i >= 0);
    if (start == null) start = 0;
    ctx.start = start;
    const anon = !ctx.ruta.student && !ctx.ruta.teacher;
    const friend = window.DralingoCast ? window.DralingoCast.pick(1)[0] : null;
    main.innerHTML =
      '<section class="rd-pick">' +
        '<h1 class="rd-h1" id="rd-h1">Elige tu mundo</h1>' +
        '<p class="rd-lede">Cada mundo es un nivel de Chino Mandarín.</p>' +
        '<div class="rd-carousel" role="region" aria-roledescription="carrusel" aria-labelledby="rd-h1">' +
          '<div class="rd-stage' + (calmMotion() ? ' is-calm' : '') + '" id="rd-stage">' +
            mods.map((m, i) => cardHtml(m, i, looks[m.slug], ctx)).join('') + '</div>' +
          '<div class="rd-ctrl"' + (mods.length < 2 ? ' hidden' : '') + '>' +
            '<button class="rd-arrow" type="button" data-dir="-1" aria-controls="rd-stage" aria-label="Mundo anterior">' + I.left + '</button>' +
            '<div class="rd-dots" role="tablist" aria-label="Mundos">' +
              '<span class="rd-dot-now" aria-hidden="true"></span>' +
              mods.map((m) => '<button class="rd-dot" type="button" role="tab" id="rd-t-' + esc(m.slug) + '" aria-controls="rd-p-' + esc(m.slug) + '" aria-label="' + esc(m.name) + '"><i></i></button>').join('') +
            '</div>' +
            '<button class="rd-arrow" type="button" data-dir="1" aria-controls="rd-stage" aria-label="Mundo siguiente">' + I.right + '</button>' +
          '</div>' +
          '<p class="au-sr" id="rd-live" aria-live="polite"></p>' +
        '</div>' +
        (anon ? '<div class="rd-join">' +
          (friend ? '<img class="rd-join-friend" src="' + esc(window.DralingoCast.pose(friend, 'hello')) + '" alt="" width="200" height="240" loading="lazy" decoding="async">' : '') +
          '<div class="rd-join-text"><h2 class="rd-join-title">¿Ya eres alumno de Dralingo?</h2>' +
          '<p>Entra con tu código de estudiante. ¿Tienes la clave de tu nivel? Toca tu mundo.</p>' +
          '<a class="rd-btn rd-btn-red" href="/homework.html?next=%2Faudios">Entrar con mi código</a></div></div>' : friendRow('is-pick')) +
      '</section>';
    live = carousel(main, mods, start);
  }

  // ── the flying carousel ───────────────────────────────────────────
  // pos = which card is in the middle (0, 1, 2…; fractions while flying). Each frame writes transform/opacity only;
  // the card size is read once (and on resize), never inside a frame.
  function carousel(main, mods, start) {
    const stage = main.querySelector('#rd-stage');
    const slides = Array.prototype.slice.call(stage.querySelectorAll('.rd-slide'));
    const cards = slides.map((s) => s.querySelector('.rd-card'));
    const shades = slides.map((s) => s.querySelector('.rd-card-shade'));
    const glosses = slides.map((s) => s.querySelector('.rd-card-gloss'));
    const dots = Array.prototype.slice.call(main.querySelectorAll('.rd-dot'));
    const now = main.querySelector('.rd-dot-now');
    const arrows = Array.prototype.slice.call(main.querySelectorAll('.rd-arrow'));
    const liveEl = main.querySelector('#rd-live');
    const shines = slides.map((s) => s.querySelector('.rd-card-shine'));
    const n = slides.length;
    const calm = stage.classList.contains('is-calm');
    // three worlds or more go round in a ring (a neighbour on each side, like a world select); two stop at the ends
    const loop = n >= 3;
    const norm = (i) => ((i % n) + n) % n;
    const ring = (x) => (loop ? x - n * Math.round(x / n) : x);       // the shortest way from the middle to a card
    let pos = start, target = start, vel = 0, active = -1, raf = 0, last = 0, spacing = 300, dotStep = 44;
    let drag = null, dragRaf = 0, dragEndAt = 0, userMoved = false;
    const zNow = [];
    // spring: stiffness 190, damping ratio 0.66 (about 6 % overshoot: the little bounce), settles in ~0.45 s
    const K = 190, C = 2 * Math.sqrt(K) * 0.66;

    function measure() {
      const w = slides[0].offsetWidth || 280;
      const room = stage.clientWidth || window.innerWidth;
      // the neighbours peek in from the edges on a phone, stand beside the middle card on a laptop
      spacing = Math.min(w * 0.86, Math.max(w * 0.72, (room - w) / 2 + w * 0.3));
      dotStep = dots.length > 1 ? (dots[1].offsetLeft - dots[0].offsetLeft) || 44 : 44;
      if (now) now.style.transform = 'translate3d(' + (Math.max(0, active) * dotStep) + 'px,0,0)';
    }
    function paint() {
      for (let i = 0; i < n; i++) {
        const d = ring(i - pos), ad = Math.abs(d);
        if (!calm) {
          const cd = Math.max(-1.5, Math.min(1.5, d));
          slides[i].style.transform = 'perspective(1100px) translate3d(' + (d * spacing).toFixed(1) + 'px,' + (Math.min(ad, 1) * 16).toFixed(1) + 'px,' +
            (-Math.min(ad, 2.2) * 170).toFixed(1) + 'px) rotateY(' + (-cd * 26).toFixed(2) + 'deg)';
          slides[i].style.opacity = ad > 2.4 ? '0' : (ad > 1.5 ? ((2.4 - ad) / 0.9).toFixed(3) : '1');
          shades[i].style.opacity = (Math.min(ad, 1) * 0.46).toFixed(3);
          glosses[i].style.transform = 'translate3d(' + (cd * -38).toFixed(1) + '%,0,0)';
        }
        const z = 100 - Math.round(ad * 20);   // the card nearest the middle is always in front
        if (zNow[i] !== z) { slides[i].style.zIndex = String(z); zNow[i] = z; }
      }
    }
    function setActive(i, announce) {
      if (i === active) return;
      active = i;
      slides.forEach((s, k) => {
        const on = k === i;
        s.classList.toggle('is-active', on);
        if (on) s.removeAttribute('inert'); else s.setAttribute('inert', '');
        cards[k].tabIndex = on ? 0 : -1;       // (phones without inert: only the middle card is a tab stop)
      });
      dots.forEach((d, k) => { d.setAttribute('aria-selected', String(k === i)); d.tabIndex = k === i ? 0 : -1; });
      if (now) now.style.transform = 'translate3d(' + (i * dotStep) + 'px,0,0)';   // the gold pill slides (css transition)
      // aria-disabled, not disabled: a focused ‹ › keeps the focus (only two worlds stop at the ends)
      arrows[0].setAttribute('aria-disabled', String(!loop && i <= 0));
      arrows[1].setAttribute('aria-disabled', String(!loop && i >= n - 1));
      store.set('draly_ruta_at', mods[i].slug);
      store.setL('draly_ruta_last', mods[i].slug);
      if (announce && liveEl) {
        const m = mods[i];
        liveEl.textContent = '';
        setTimeout(() => { liveEl.textContent = m.name + ', mundo ' + (i + 1) + ' de ' + n + (m.open ? '' : ', se abre con la clave'); }, 30);
      }
    }
    function step(t) {
      const dt = Math.min(0.064, Math.max(0, (t - last) / 1000));
      last = t;
      let left = dt;
      while (left > 0) {                       // small fixed steps: the same spring on a 30 Hz phone and a 120 Hz laptop
        const h = Math.min(1 / 240, left);
        vel += (-K * (pos - target) - C * vel) * h;
        pos += vel * h;
        left -= h;
      }
      if (Math.abs(pos - target) < 0.0006 && Math.abs(vel) < 0.003) {
        pos = target = norm(Math.round(target)); vel = 0; raf = 0; paint(); settled();   // back to 0…n-1 (the ring looks the same)
        return;
      }
      paint();
      raf = requestAnimationFrame(step);
    }
    function kick() {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(step);
    }
    function settled() {
      if (!userMoved) return;
      userMoved = false;
      const s = shines[active];               // the arrival: one gold sweep across the card that just landed
      if (s && s.animate) {
        try {
          s.animate([{ opacity: 1, transform: 'translate3d(-45%,0,0)' }, { opacity: 0, transform: 'translate3d(45%,0,0)' }],
            { duration: 820, easing: 'cubic-bezier(.23, 1, .32, 1)' });
        } catch (_) { /* an old phone: no sweep */ }
      }
    }
    // how: 'card' / 'dot' = the keyboard moved (focus follows, the focused element speaks for itself);
    // 'tap' = a dot was tapped (it speaks for itself too); nothing = a swipe or ‹ ›: the live region says where we are
    function go(i, v0, how) {
      const idx = loop ? norm(i) : Math.max(0, Math.min(n - 1, i));
      userMoved = true;
      setActive(idx, !how);
      if (calm) { pos = target = idx; paint(); }
      else {
        target = loop ? idx + n * Math.round((pos - idx) / n) : idx;   // the nearest way round the ring
        if (typeof v0 === 'number' && isFinite(v0)) vel = Math.max(-14, Math.min(14, v0));
        kick();
      }
      if (how === 'card') { try { cards[idx].focus({ preventScroll: true }); } catch (_) {} }
      if (how === 'dot' && dots[idx]) { try { dots[idx].focus({ preventScroll: true }); } catch (_) {} }
    }

    // ── touch and mouse: the card follows the finger, a flick flies one card on ──
    const rubber = (x) => 0.32 * (1 - Math.exp(-x * 1.6));   // two worlds, past an end: it gives a little, then stops
    function onDown(e) {
      if (drag || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;   // one finger at a time
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, p0: pos, from: active, moved: false, pts: [[e.timeStamp, e.clientX]] };
      if (raf) { cancelAnimationFrame(raf); raf = 0; }  // grab the card mid-flight
    }
    function onMove(e) {
      if (!drag || e.pointerId !== drag.id) return;
      // a mouse let go outside the window never sends pointerup: no button pressed any more = the drag is over
      if (e.pointerType === 'mouse' && !(e.buttons & 1)) { endDrag(false); return; }
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.moved) {
        if (Math.abs(dx) < 7 && Math.abs(dy) < 7) return;
        if (Math.abs(dy) > Math.abs(dx)) { endDrag(false); return; }   // the page is scrolling: let it
        drag.moved = true;
        try { stage.setPointerCapture(e.pointerId); } catch (_) {}
        stage.classList.add('is-dragging');
      }
      drag.pts.push([e.timeStamp, e.clientX]);
      while (drag.pts.length > 2 && e.timeStamp - drag.pts[0][0] > 90) drag.pts.shift();
      if (calm) return;
      let p = drag.p0 - dx / spacing;
      if (!loop) {
        if (p < 0) p = -rubber(-p);
        else if (p > n - 1) p = n - 1 + rubber(p - (n - 1));
      }
      pos = p;
      // a 120 Hz screen sends several moves per frame: draw once per frame
      if (!dragRaf) dragRaf = requestAnimationFrame(() => { dragRaf = 0; paint(); });
    }
    function endDrag(fling) {
      const d = drag;
      drag = null;
      if (dragRaf) { cancelAnimationFrame(dragRaf); dragRaf = 0; }
      stage.classList.remove('is-dragging');
      if (!d) return;
      if (!d.moved || !fling) { if (pos !== target) kick(); return; }
      dragEndAt = performance.now();
      const a = d.pts[0], b = d.pts[d.pts.length - 1];
      const v = b[0] > a[0] ? (b[1] - a[1]) / (b[0] - a[0]) : 0;          // px per ms; < 0 = towards the next card
      const moved = calm ? -((b[1] - d.x0) / spacing) : ring(pos - d.from);
      const dir = v < -0.28 ? 1 : v > 0.28 ? -1 : (moved > 0.2 ? 1 : moved < -0.2 ? -1 : 0);
      go(d.from + dir, (-v * 1000) / spacing);
    }
    function onUp(e) { if (drag && e.pointerId === drag.id) endDrag(e.type === 'pointerup'); }
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', onUp);
    stage.addEventListener('lostpointercapture', onUp);
    stage.addEventListener('dragstart', (e) => e.preventDefault());
    // a drag never opens the card it ended on; a tap on a side card brings it to the middle
    stage.addEventListener('click', (e) => {
      if (performance.now() - dragEndAt < 450) { e.preventDefault(); e.stopPropagation(); return; }
      if (e.target.closest('.rd-slide.is-active')) return;
      const r = slides[active].getBoundingClientRect();
      if (e.clientX < r.left) go(active - 1); else if (e.clientX > r.right) go(active + 1);
    }, true);
    // keys: ← → on the card, ← → Home End on the dots (one tab stop, roving)
    stage.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); go(active + (e.key === 'ArrowRight' ? 1 : -1), undefined, 'card'); }
    });
    dots.forEach((d, k) => {
      d.addEventListener('click', () => go(k, undefined, 'tap'));
      d.addEventListener('keydown', (e) => {
        const to = e.key === 'ArrowRight' ? active + 1 : e.key === 'ArrowLeft' ? active - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : null;
        if (to == null) return;
        e.preventDefault();
        go(to, undefined, 'dot');
      });
    });
    arrows.forEach((b) => b.addEventListener('click', () => {
      if (b.getAttribute('aria-disabled') === 'true') return;
      go(active + Number(b.getAttribute('data-dir')));
    }));
    const onResize = () => { measure(); paint(); };
    window.addEventListener('resize', onResize);

    setActive(start, false);
    measure();
    paint();   // the still first frame: no entrance animation
    return {
      destroy() { if (raf) cancelAnimationFrame(raf); raf = 0; if (dragRaf) cancelAnimationFrame(dragRaf); dragRaf = 0; window.removeEventListener('resize', onResize); },
      // test hook (screenshots of a card mid-flight; headless browsers barely animate): draw position p as it is
      at(p) { if (raf) { cancelAnimationFrame(raf); raf = 0; } pos = p; paint(); return pos; },
      go,
    };
  }

  // ── a module's path: the golden route of three levels ─────────────
  function path(main, ctx, m) {
    leave();
    const mods = ctx.ruta.modules || [];
    const i = Math.max(0, mods.indexOf(m));
    const look = looksFor(mods)[m.slug];
    const st = statesOf(m);
    const anon = !ctx.ruta.student && !ctx.ruta.teacher;
    store.set('draly_ruta_at', m.slug);
    // back: to the worlds, or to «Mis tareas» when the kid came from there (the home-screen app has no back button)
    const qFrom = new URLSearchParams(location.search).get('from');
    if (qFrom === 'homework') store.set('draly_ruta_from', 'homework');
    const fromHw = store.get('draly_ruta_from') === 'homework';
    const back = fromHw ? '<a class="au-back" href="/homework.html">' + I.left + 'Volver a mis tareas</a>'
      : '<a class="au-back" data-nav href="/audios">' + I.left + 'Todos los mundos</a>';

    const hero = '<section class="rd-hero' + (m.name.length > 6 ? ' is-long' : '') + (m.open ? '' : ' is-locked') + '" style="' + lookStyle(look) + '">' +
      skyWide + '<img class="rd-hero-dragon" src="' + poseOf(i) + '" alt="" width="432" height="480" decoding="async">' +
      '<h1 class="rd-hero-name">' + esc(m.name) + '</h1>' +
      '<p class="rd-hero-sub">' + esc(FAMILY_SUB[m.family] || ('Examen ' + (m.exam || m.name))) + '</p>' +
      (m.open ? '' : '<span class="rd-seal" aria-hidden="true">' + I.lock + '</span>') +
      '<span class="rd-card-gloss" aria-hidden="true"></span></section>';

    const friend = friendRow('');

    const keyBox = m.open ? '' :
      '<div class="rd-keybox"><span class="rd-keybox-seal" aria-hidden="true">' + I.lock + '</span>' +
        '<div class="rd-keybox-body"><h2 class="rd-keybox-title">Tu ruta se abre con la clave de ' + esc(m.name) + '</h2>' +
        '<p>Está en el mensaje de tu maestra. Se escribe una sola vez y abre La Base y El Simulacro Dorado.</p>' +
        '<a class="rd-btn rd-btn-gold" href="/audios/' + esc(m.slug) + '/clave">' + I.key + 'Escribe la clave de ' + esc(m.name) + '</a>' +
        (anon ? '<p class="rd-keybox-alt">¿Ya eres alumno? <a href="/homework.html?next=' + encodeURIComponent('/audios/' + m.slug + '/clave') + '">Entra con tu código</a></p>' : '') +
        '</div></div>';

    // 1 · La Base
    const b = m.base && (ctx.catalog.bases || []).find((x) => x.id === m.base.id);
    let baseBody;
    if (st.base === 'open' && b) {
      const seals = ctx.sealsOf(b);
      const go = seals.size ? (seals.size >= b.words ? 'Repasar' : 'Seguir') : 'Empezar';
      baseBody = '<p class="rd-stop-text">Las ' + b.words + ' palabras con su dibujo, una frase y el audio.</p>' +
        '<div class="rd-progress">' + ctx.meterHtml(b, seals) + '<p>' + sellos(seals.size, b.words) + '</p></div>' +
        '<a class="rd-btn rd-btn-red" href="/audios/' + esc(b.id) + '" data-nav>' + I.play + go + '</a>';
    } else if (st.base === 'locked') {
      baseBody = '<p class="rd-stop-text">Las ' + m.base.words + ' palabras con su dibujo, una frase y el audio.</p>' +
        '<p class="rd-stop-state">' + I.lock + 'Se abre con la clave</p>';
    } else {
      baseBody = '<p class="rd-stop-text">Todas las palabras del nivel, con su dibujo y el audio.</p><p class="rd-soon">Muy pronto</p>';
    }
    // 2 · El Entrenamiento (phase 4): an honest «muy pronto»
    const trainBody = '<p class="rd-stop-text">Practica cada mundo como en el examen, con audio y la respuesta al instante.</p>' +
      '<p class="rd-soon">' + I.soon + 'Muy pronto</p>';
    // 3 · El Simulacro Dorado: the level's simulations (only when open: each opens its player through the key check)
    let goldBody;
    if (st.gold === 'open') {
      goldBody = '<p class="rd-stop-text">El examen completo con el audio original, como el día del examen.</p>' +
        '<ul class="rd-sims">' + m.sims.map((s) =>
          '<li><a class="rd-sim' + (s.best != null ? ' is-done' : '') + '" href="' + esc(s.href) + '">' +
            '<b class="rd-sim-n" aria-hidden="true">' + s.n + '</b>' +
            '<span class="rd-sim-name">Simulacro ' + s.n + '</span>' +
            '<span class="rd-sim-meta">' + s.questions + ' preguntas</span>' +
            // the kid's best try: from the exam's pass line (60 %: YCT and HSK pass at 120 / 200) its score with a gold
            // check; below it, never a low number on screen, just «Otra vez» (a kid reads a low score as failing)
            (s.best == null ? '' : s.best >= 60
              ? '<span class="rd-sim-best is-pass"><span class="au-sr">Tu mejor resultado: </span>' + I.check + s.best + ' %</span>'
              : '<span class="rd-sim-best"><span class="au-sr">Ya lo intentaste. </span>' + I.again + 'Otra vez</span>') +
          '</a></li>').join('') + '</ul>';
    } else if (st.gold === 'locked') {
      goldBody = '<p class="rd-stop-text">' + m.simCount + (m.simCount === 1 ? ' simulacro completo' : ' simulacros completos') + ' con el audio original del examen.</p>' +
        '<p class="rd-stop-state">' + I.lock + 'Se abre con la clave</p>';
    } else {
      goldBody = '<p class="rd-stop-text">El examen completo con el audio original.</p><p class="rd-soon">Muy pronto</p>';
    }
    const stop = (k, n, title, icon, body, next) => '<li class="rd-stop is-' + st[k] + '"' + (next ? ' data-next="' + next + '"' : '') + '>' +
      '<span class="rd-coin" aria-hidden="true">' + (st[k] === 'locked' ? I.lock : icon) + '<b>' + n + '</b></span>' +
      '<div class="rd-stop-body"><h2 class="rd-stop-title"><span class="au-sr">Paso ' + n + ': </span>' + title + '</h2>' + body + '</div></li>';

    const hws = ctx.homeworksOf(m.slug);
    main.innerHTML = back + hero + friend + keyBox +
      '<ol class="rd-route" aria-label="La Ruta Dorada de ' + esc(m.name) + '">' +
        stop('base', 1, 'La Base', I.book, baseBody, st.train) +
        stop('train', 2, 'El Entrenamiento', I.target, trainBody, st.gold) +
        stop('gold', 3, 'El Simulacro Dorado', I.trophy, goldBody) +
      '</ol>' +
      (hws.length ? '<h2 class="au-h2">Audios de las tareas</h2><div class="au-cards">' + hws.map((h, k) => ctx.cardHtml(h, k === 0)).join('') + '</div>' : '');
  }

  window.Ruta = { picker, path, leave, get live() { return live; } };
})();
