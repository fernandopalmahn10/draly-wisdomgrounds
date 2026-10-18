// =========================================================================
// audios.js · «La Ruta Dorada» (/audios, /audios/<id>), was «Audios y vocabulario»
// =========================================================================
// Reads /assets/audios/catalog.json (written by scripts/audios-build.js) and
// /api/ruta-dorada (what THIS visitor may open, per level: server.js).
// /audios               → the module picker: one big card per level of
//                         core/levels.js that flies in (js/ruta.js)
// /audios/<level>       → the module's golden route: La Base, El
//                         Entrenamiento, El Simulacro Dorado, then the level's
//                         homework audios (js/ruta.js)
// /audios/<level>-base  → the base itself (js/audios-base.js)
// /audios/<homework id> → the homework: its three tracks (words, dialogue,
//                         video lines). The printed PDFs link here: these
//                         addresses never change (hsk2-… opens newhsk1-…).
// One <audio> element plays everything, so only one sound at a time.
// Homework audio needs no login; no hanzi (kid UI rule): pinyin + Spanish.
// =========================================================================
(function () {
  'use strict';
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (s) => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
  };
  const ICON = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>',
    sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 9.5v5h3.5L12 19V5L7.5 9.5H4z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 11.5V8a4 4 0 0 1 8 0v3.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><rect x="4.5" y="11" width="15" height="10.5" rx="2.6" fill="currentColor"/></svg>',
  };
  const KIND = {
    words: { title: 'Las palabras', how: 'Cada palabra suena dos veces. Repítela en voz alta en la pausa.' },
    dialogue: { title: 'Escucha, lee, repite', how: 'Primero suena toda la conversación. Después, frase por frase: repite en la pausa.' },
    video: { title: 'Tu video', how: 'Repite cada frase en la pausa. Al final suenan todas seguidas, como tu video de una sola toma.' },
  };

  const main = $('#au-main');
  const player = $('#au-player');
  const sayEl = $('#au-say');
  let catalog = null;
  let hw = null;                   // homework on screen
  let cur = null;                  // { kind: 'track', t } | { kind: 'clip', t, i }
  let slow = store.get('au-slow') === '1';
  let lastNow = null;
  let firstRoute = true;
  let navSeq = 0;                  // bumped by every route: a slow fetch never draws over a newer page
  // Cloudflare keeps /assets/* for 2 h: the catalog and a base's data are asked for with a 10-minute stamp, so a new
  // version reaches phones within minutes of a deploy (clips and pictures carry their own ?v= content stamp)
  const fresh = (url) => url + (url.indexOf('?') < 0 ? '?' : '&') + 't=' + Math.floor(Date.now() / 600000);

  const say = (text) => { if (!sayEl) return; sayEl.textContent = ''; setTimeout(() => { sayEl.textContent = text; }, 30); };

  // 🔑 2026-10-15 (La Ruta Dorada): a level's three levels open with that level's key (typed once on this phone, or on
  // the kid's account). The server knows (httpOnly cookies): /api/ruta-dorada says, per module, what this visitor may
  // open (and, only when open, the level's simulations), so a locked base shows its lock instead of its pictures.
  // (a homework audio page and a base never wait on it: if it fails, only the picker and the routes ask to retry)
  let ruta = null;
  const failedHtml = (msg) => '<p class="au-error">' + msg + '</p>' +
    '<p style="text-align:center"><button type="button" class="bs-btn bs-btn-red au-press" id="au-retry">Volver a intentar</button></p>';
  function load() {
    main.innerHTML = '<p class="au-loading">Cargando…</p>';
    const state = fetch('/api/ruta-dorada', { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((s) => ((s && Array.isArray(s.modules)) ? s : null), () => null);
    Promise.all([fetch(fresh('/assets/audios/catalog.json')).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }), state])
      .then(([c, s]) => { catalog = c; ruta = s; route(); })
      .catch(() => {
        main.innerHTML = failedHtml('No se pudo cargar La Ruta Dorada. Revisa tu internet.');
        $('#au-retry').addEventListener('click', load);
      });
  }

  // ← «Volver» (his rule 2026-10-18: "La Ruta Dorada doesn't have an escape button to go back"): one button in the header
  // band, which stays on screen. Each view still says where back is with its own `.au-back` link (ruta.js, entrenamiento.js,
  // libro.js, a homework's page); the band's button takes its address as soon as it is drawn (the link itself stays,
  // hidden by css/audios.css). A screen without one (the picker, a teacher's look at a kid's book) goes back to where
  // the visitor came from: Mis tareas, /maestro, else the home page (a link, not history: a kid may land from WhatsApp).
  const topBack = $('#au-top-back');
  function cameFrom() {
    let from = '';
    try { const r = document.referrer ? new URL(document.referrer) : null; if (r && r.origin === location.origin) from = r.pathname; } catch (_) {}
    if (/^\/(homework|tareas?)(\.html)?\/?$/.test(from)) return { href: '/homework', to: 'mis tareas' };
    if (/^\/(maestro|maestra|teacher)(\.html)?\/?$/.test(from)) return { href: '/maestro.html', to: 'Modo Maestro' };
    return { href: '/', to: 'el inicio' };
  }
  // The contract for a view (also the La Ruta Dorada redesign): its `.au-back` as a direct child of #au-main, or its own
  // «Volver» drawn with the shared `.dw-back` / `[data-back]` (then the band's button steps aside and the view's shows).
  let lastBack = '';
  function hoistBack() {
    if (!topBack) return;
    const ownBack = !!main.querySelector('.dw-back, [data-back]');
    const own = main.querySelector(':scope > .au-back');
    const b = own ? { href: own.getAttribute('href'), to: own.textContent.trim(), nav: own.hasAttribute('data-nav') } : cameFrom();
    const key = [ownBack, b.href, b.to, !!b.nav].join('|');
    if (key === lastBack) return;                          // (a text update in the page: nothing to do)
    lastBack = key;
    topBack.hidden = ownBack;
    document.body.classList.toggle('au-has-topback', !ownBack);   // the view's `.au-back` shows again when the band steps aside
    const label = /^volver/i.test(b.to) ? b.to : 'Volver: ' + b.to;
    topBack.setAttribute('href', b.href);
    topBack.toggleAttribute('data-nav', !!b.nav);
    topBack.setAttribute('aria-label', label);
    topBack.title = label;
  }
  if (topBack) {
    hoistBack();
    new MutationObserver(hoistBack).observe(main, { childList: true, subtree: true });
  }
  load();

  // the picker ↔ a path: the chosen card grows into the path's banner (View Transitions, where the phone has them);
  // reduced motion or an older phone: the new screen simply appears
  const calm = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const isWorldView = () => document.body.classList.contains('au-is-pick') || document.body.classList.contains('au-is-path');
  function swap(update) {
    const safe = () => {
      try { update(); } catch (e) {
        console.error('[audios] the screen could not be drawn', e);
        main.innerHTML = failedHtml('Algo salió mal. Vuelve a intentarlo.');
        $('#au-retry').addEventListener('click', load);
      }
    };
    if (!document.startViewTransition || calm() || !isWorldView()) { safe(); return; }
    try { document.startViewTransition(safe); } catch (_) { safe(); }
  }
  // back to this page from the key screen (a phone's back/forward cache) or from another tab: the locks may have
  // opened meanwhile. Ask the server again; redraw only the picker or a route, and only when something changed.
  // (phase 3: a kid's progress too, so seals saved from this phone or opened by a teacher redraw the route)
  const sig = (s) => JSON.stringify(s && s.modules ? s.modules.map((m) => [m.id, m.open, m.sims.length, m.dorado && m.dorado.open,
    m.progress ? [m.progress.sealed, m.progress.worlds.map((w) => (w.train ? 1 : 0) + (w.teacher ? 2 : 0)).join('')] : null,
    m.train ? m.train.worlds.map((w) => (w.open ? 1 : 0) + ':' + (w.best == null ? '' : w.best)).join(',') : null]) : null);
  function refreshState(force) {   // force: redraw even when the server says the same (the phone's seals changed)
    if (!catalog || !isWorldView()) return;
    fetch('/api/ruta-dorada', { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).then((s) => {
        if (!s || !Array.isArray(s.modules) || (force !== true && sig(s) === sig(ruta)) || !isWorldView()) return;
        ruta = s;
        firstRoute = true;                     // a quiet redraw: the focus stays where it was
        route();
      }).catch(() => {});
  }
  window.addEventListener('pageshow', (e) => { if (e.persisted) refreshState(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshState(); });

  let shownPath = null;            // the page on screen: going back through #mundo-… anchors only scrolls
  window.addEventListener('popstate', () => {
    if (!catalog) return;
    if (location.pathname === shownPath && document.body.classList.contains('au-is-base')) {
      let el = null;
      try { el = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (_) { el = null; }
      if (el) el.scrollIntoView(); else window.scrollTo(0, 0);
      return;
    }
    swap(route);
  });
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-nav]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    e.preventDefault();
    const href = a.getAttribute('href');
    swap(() => {
      history.pushState(null, '', href);
      route();
      if (!location.hash) window.scrollTo(0, 0);
    });
  });

  // ── what the catalog holds, per level folder ──────────────────────
  function folders() {
    if (Array.isArray(catalog.levels) && catalog.levels.length) return catalog.levels;
    const out = [];   // an older catalog without levels: one folder per homework level
    catalog.homeworks.forEach((h) => { if (!out.some((f) => f.id === h.level)) out.push({ id: h.level, name: h.levelName }); });
    return out;
  }
  const homeworksOf = (lv) => catalog.homeworks.filter((h) => h.level === lv)
    .sort((a, b) => (b.exp - a.exp) || (b.round - a.round));
  const sealsOf = (b) => (window.AudiosBase ? window.AudiosBase.seals(b.level) : new Set());

  function route() {
    if (!catalog) return;
    shownPath = location.pathname;
    navSeq++;
    stop();
    if (window.AudiosBase) window.AudiosBase.leave();
    if (window.Ruta) window.Ruta.leave();
    if (window.Entrenamiento) window.Entrenamiento.leave();
    if (window.GoldenBook) window.GoldenBook.leave();
    document.body.classList.remove('au-is-base', 'au-is-pick', 'au-is-path');
    // 📖 El libro dorado (phase 5): /audios/<level>/libro/<n> (js/libro.js; the server let only whoever has the level's
    // key reach this page, and its API asks every other door)
    const gm = location.pathname.match(/^\/audios?\/([a-z0-9-]+)\/libro\/(\d{1,2})\/?$/i);
    if (gm) {
      const gid = gm[1].toLowerCase();
      const gmod = ruta && ruta.modules.find((x) => x.slug === gid || x.id === gid);
      if (gmod && gmod.open && window.GoldenBook) {
        try { window.GoldenBook.render(main, Object.assign(rutaCtx(), { focus: !firstRoute }), gmod, gm[2]); } catch (e) {
          console.error('[audios] El libro dorado could not be drawn', e);
          main.innerHTML = failedHtml('Algo salió mal. Vuelve a intentarlo.');
          $('#au-retry').addEventListener('click', load);
        }
        if (!firstRoute) { const h = main.querySelector('h1'); if (h) { try { h.focus({ preventScroll: true }); } catch (_) {} } }
        firstRoute = false;
        return;
      }
      if (!ruta) { main.innerHTML = failedHtml('No se pudo cargar La Ruta Dorada. Revisa tu internet.'); $('#au-retry').addEventListener('click', load); return; }
      if (gmod) { history.replaceState(null, '', '/audios/' + gmod.slug); renderPath(gmod); return; }
    }
    // 🎯 El Entrenamiento (phase 4): /audios/<level>/entrenamiento[/<world>] (js/entrenamiento.js; the server let only
    // whoever has the level's key reach this page)
    const tm = location.pathname.match(/^\/audios?\/([a-z0-9-]+)\/entrenamiento(?:\/([a-z0-9-]+))?\/?$/i);
    if (tm) {
      const tid = tm[1].toLowerCase();
      const tmod = ruta && ruta.modules.find((x) => x.slug === tid || x.id === tid);
      if (tmod && tmod.open && window.Entrenamiento) {
        document.title = 'El Entrenamiento · ' + tmod.name + ' · Dralingo';
        try { window.Entrenamiento.render(main, rutaCtx(), tmod, tm[2] ? tm[2].toLowerCase() : null); } catch (e) {
          console.error('[audios] El Entrenamiento could not be drawn', e);
          main.innerHTML = failedHtml('Algo salió mal. Vuelve a intentarlo.');
          $('#au-retry').addEventListener('click', load);
        }
        firstRoute = false;
        return;
      }
      if (!ruta) { main.innerHTML = failedHtml('No se pudo cargar La Ruta Dorada. Revisa tu internet.'); $('#au-retry').addEventListener('click', load); return; }
      if (tmod) { history.replaceState(null, '', '/audios/' + tmod.slug); renderPath(tmod); return; }
    }
    const m = location.pathname.match(/^\/audios?\/([a-z0-9-]+)\/?$/i);
    let id = (m && m[1]) || new URLSearchParams(location.search).get('t');
    // HSK 2 was absorbed into New HSK 1 (2026-10-11): old links (hsk2-e01-r1, hsk2) still work
    if (id) {
      id = id.toLowerCase();
      // a level's stored id opens its curriculum folder (catalog `aliases` from core/levels.js): hsk2 → newhsk1 since HSK 2
      // was absorbed into New HSK 1 (2026-10-11), so /audios/hsk2-e01-r1 opens newhsk1-e01-r1
      const aliases = catalog.aliases || { hsk2: 'newhsk1' };
      Object.keys(aliases).forEach((a) => { if (id === a || id.indexOf(a + '-') === 0) id = aliases[a] + id.slice(a.length); });
    }
    const base = id && (catalog.bases || []).find((b) => b.id === id);
    const found = !base && id && catalog.homeworks.find((h) => h.id === id);
    const mod = !base && !found && id && ruta && ruta.modules.find((x) => x.slug === id || x.id === id);
    if (base) renderBase(base);
    else if (found) renderHomework(found);
    else if (!ruta) {                                     // the visitor's state did not arrive: ask again, never guess locks
      hw = null;
      main.innerHTML = failedHtml('No se pudo cargar La Ruta Dorada. Revisa tu internet.');
      $('#au-retry').addEventListener('click', load);
    }
    else if (mod) renderPath(mod);
    else renderPicker();
    // after a tap inside the page, the new screen's heading takes the focus (screen readers hear where they are)
    if (!firstRoute && !base) {
      const h = main.querySelector('h1');
      if (h) { h.tabIndex = -1; try { h.focus({ preventScroll: true }); } catch (_) {} }
    }
    firstRoute = false;
  }

  function meterHtml(b, seals) {
    if (!Array.isArray(b.worlds) || !b.worlds.length) return '';
    let next = 1;
    return '<span class="au-meter" aria-hidden="true">' + b.worlds.map((w) => {
      const first = w.first || next;                       // the world's first word number (catalog), else in a row
      let k = 0;
      for (let n = first; n < first + w.count; n++) if (seals.has(n)) k++;
      next = first + w.count;
      return '<i style="--w:' + w.count + ';--p:' + (k / w.count).toFixed(3) + '"></i>';
    }).join('') + '</span>';
  }

  // ── La Ruta Dorada (js/ruta.js draws both screens) ─────────────────
  // what ruta.js needs from this page: the catalog, the visitor's modules, the seals on this phone, the meters and
  // the homework cards (one look for them everywhere)
  const rutaCtx = () => ({ catalog, ruta, sealsOf, meterHtml, cardHtml, homeworksOf, refresh: refreshState });
  function renderPicker() {
    hw = null;
    document.title = 'La Ruta Dorada · Dralingo';
    document.body.classList.add('au-is-pick');
    if (!window.Ruta) { main.innerHTML = '<p class="au-error">No se pudo cargar La Ruta Dorada. Recarga la página.</p>'; return; }
    window.Ruta.picker(main, rutaCtx());
  }
  function renderPath(mod) {
    hw = null;
    document.title = mod.name + ' · La Ruta Dorada · Dralingo';
    document.body.classList.add('au-is-path');
    if (!window.Ruta) { main.innerHTML = '<p class="au-error">No se pudo cargar La Ruta Dorada. Recarga la página.</p>'; return; }
    window.Ruta.path(main, rutaCtx(), mod);
  }
  function cardHtml(h, isNew) {
    return '<a class="au-card" data-nav href="/audios/' + esc(h.id) + '">' +
      ((h.thumb || h.cover) ? '<img src="' + esc(h.thumb || h.cover) + '" alt="" width="360" height="241" loading="lazy" decoding="async">' : '<span></span>') +
      '<span><span class="au-card-title" style="display:block">' + esc(h.title) + '</span>' +
      '<span class="au-card-meta" style="display:block">Experiencia ' + h.exp + ' · Ronda ' + h.round + (isNew ? '<span class="au-new">Nueva</span>' : '') + '</span>' +
      '<span class="au-pill">' + ICON.play + h.tracks.length + ' audios</span></span></a>';
  }

  // ── The base (js/audios-base.js draws it) ──────────────────────────
  function renderBase(b) {
    hw = null;
    document.body.classList.add('au-is-base');
    document.title = b.title + ' · ' + b.levelName + ' · Dralingo';
    main.innerHTML = '<p class="au-loading">Cargando las palabras…</p>';
    const nav = navSeq;                                    // a later route (back, forward, a tap) wins
    const focus = !firstRoute;
    const failed = (msg) => {
      main.innerHTML = '<p class="au-error">' + msg + '</p>' +
        '<p style="text-align:center"><button type="button" class="bs-btn bs-btn-red au-press" id="au-retry">Volver a intentar</button></p>';
      $('#au-retry').addEventListener('click', () => { navSeq++; renderBase(b); });
    };
    fetch(fresh(b.data), { credentials: 'same-origin' })
      .then((r) => {
        // 🔑 locked (no key on this phone, or it was closed meanwhile): the base's own address shows the key screen
        if (r.status === 401) {
          const at = '/audios/' + b.id;
          let again = false;
          try { again = sessionStorage.getItem('draly_base_401') === at; sessionStorage.setItem('draly_base_401', at); } catch (_) {}
          if (!again || location.pathname !== at) { location.replace(at); return new Promise(() => {}); }
        }
        try { sessionStorage.removeItem('draly_base_401'); } catch (_) {}
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then((d) => {
        if (nav !== navSeq || !window.AudiosBase) return;   // the reader already moved on
        try {
          window.AudiosBase.render(main, d, { player, say, from: new URLSearchParams(location.search).get('from') });
        } catch (e) {
          console.error('[audios] the base page could not be drawn', e);
          failed('Algo salió mal al mostrar las palabras. Vuelve a intentarlo.');
          return;
        }
        if (focus) {                                         // arriving from a tap: the cover title takes the focus
          const h = main.querySelector('h1');
          if (h) { h.tabIndex = -1; try { h.focus({ preventScroll: true }); } catch (_) {} }
        }
      }, () => { if (nav === navSeq) failed('No se pudieron cargar las palabras. Revisa tu internet.'); });
  }

  // ── One homework ───────────────────────────────────────────────────
  function renderHomework(h) {
    hw = h;
    document.title = h.title + ' · Audios · Dralingo';
    const folder = folders().find((f) => f.id === h.level);
    let html = '<a class="au-back" data-nav href="/audios/' + esc(folder ? folder.id : '') + '">' + ICON.back + esc(folder ? folder.name : 'Todos los mundos') + '</a>' +
      '<section class="au-hero">' + (h.cover ? '<img src="' + esc(h.cover) + '" alt="">' : '') +
      '<h1>' + esc(h.title) + '</h1>' +
      '<p class="au-hero-meta">' + esc(h.levelName) + ' · Experiencia ' + h.exp + ' · Ronda ' + h.round + '</p>' +
      (h.tagline ? '<p class="au-tag">' + esc(h.tagline) + '</p>' : '') + '</section>';
    h.tracks.forEach((t, k) => {
      const K = KIND[t.kind] || { title: t.code, how: '' };
      const hasName = t.items.some((it) => /_{2,}/.test(it.py));
      html += '<section class="au-track" id="track-' + k + '">' +
        '<div class="au-track-head"><span class="au-num">' + (k + 1) + '</span><div>' +
        '<h2>' + K.title + '</h2><div class="au-code">Audio ' + esc(t.code) + '</div>' +
        '<p class="au-how">' + K.how + (hasName ? ' Donde ves ___ di tu nombre.' : '') + '</p></div></div>' +
        '<div class="au-player">' +
        '<button type="button" class="au-play" data-t="' + k + '" aria-pressed="false" aria-label="Escuchar ' + esc(K.title) + '">' + ICON.play + '</button>' +
        '<div class="au-bar"><div class="au-part" id="part-' + k + '">' + esc((t.parts[0] && t.parts[0].label) || '') + '</div>' +
        '<div class="au-track-line" data-t="' + k + '" role="slider" aria-label="Avance" aria-valuemin="0" aria-valuemax="' + Math.round(t.dur) + '" aria-valuenow="0" tabindex="0"><div class="au-fill" id="fill-' + k + '"></div></div>' +
        '<div class="au-time" id="time-' + k + '">0:00 / ' + fmt(t.dur) + '</div></div>' +
        '<button type="button" class="au-slow" aria-pressed="' + slow + '">🐢 Lento</button></div>' +
        '<div class="au-lines ' + esc(t.kind) + '">' + t.items.map((it, i) => lineHtml(t, it, i, k)).join('') + '</div></section>';
    });
    html += '<section class="au-end"><h3>¡Ahora graba tu video!</h3>' +
      '<p>Di las frases seguidas, en una sola toma, aunque tengas errores. Mándaselo a tu profe.</p></section>';
    main.innerHTML = html;

    main.querySelectorAll('.au-play').forEach((b) => b.addEventListener('click', () => toggleTrack(+b.getAttribute('data-t'))));
    main.querySelectorAll('.au-line').forEach((b) => b.addEventListener('click', () => playClip(+b.getAttribute('data-t'), +b.getAttribute('data-i'))));
    main.querySelectorAll('.au-slow').forEach((b) => b.addEventListener('click', () => {
      slow = !slow;
      store.set('au-slow', slow ? '1' : '0');
      main.querySelectorAll('.au-slow').forEach((x) => x.setAttribute('aria-pressed', String(slow)));
      player.playbackRate = slow ? 0.8 : 1;
    }));
    main.querySelectorAll('.au-track-line').forEach((bar) => {
      const k = +bar.getAttribute('data-t');
      bar.addEventListener('click', (e) => {
        const r = bar.getBoundingClientRect();
        seekTrack(k, ((e.clientX - r.left) / r.width) * hw.tracks[k].dur);
      });
      bar.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const now = cur && cur.kind === 'track' && cur.t === k ? player.currentTime : 0;
        seekTrack(k, now + (e.key === 'ArrowRight' ? 5 : -5));
      });
    });
  }

  function lineHtml(t, it, i, k) {
    const lead = t.kind === 'dialogue'
      ? '<span class="au-who ' + (it.who === 'profe' ? 'profe' : 'tu') + '">' + (it.who === 'profe' ? 'PROFE' : 'TÚ') + '</span>'
      : t.kind === 'video' ? '<span class="au-step">' + (i + 1) + '</span>' : '';
    return '<button type="button" class="au-line" data-t="' + k + '" data-i="' + i + '" aria-label="Escuchar: ' + esc(it.py) + ', ' + esc(it.es) + '">' + lead +
      '<span><span class="au-py" lang="zh-Latn-pinyin" translate="no" style="display:block">' + esc(it.py) + '</span><span class="au-es">' + esc(it.es) + '</span></span>' +
      '<span class="au-ico">' + ICON.sound + '</span></button>';
  }

  // ── Playback (homework tracks) ─────────────────────────────────────
  function toggleTrack(k) {
    if (cur && cur.kind === 'track' && cur.t === k) {
      if (player.paused) player.play().catch(() => {}); else player.pause();
      return;
    }
    startTrack(k, 0);
  }
  function startTrack(k, at) {
    stop();
    const t = hw.tracks[k];
    cur = { kind: 'track', t: k };
    player.src = t.src;
    player.playbackRate = slow ? 0.8 : 1;
    const go = () => { try { if (at) player.currentTime = at; } catch (_) {} player.play().catch(() => {}); };
    if (player.readyState >= 1) go(); else player.addEventListener('loadedmetadata', go, { once: true });
    player.load();
    mediaInfo(KIND[t.kind] ? KIND[t.kind].title : t.code);
  }
  function seekTrack(k, sec) {
    sec = Math.max(0, Math.min(hw.tracks[k].dur - 0.2, sec));
    if (cur && cur.kind === 'track' && cur.t === k) { player.currentTime = sec; if (player.paused) player.play().catch(() => {}); }
    else startTrack(k, sec);
  }
  function playClip(k, i) {
    stop();
    cur = { kind: 'clip', t: k, i };
    player.src = hw.tracks[k].items[i].clip;
    player.playbackRate = slow ? 0.8 : 1;
    player.play().catch(() => {});
    mark(k, i);
  }
  function stop() {
    try { player.pause(); } catch (_) {}
    if (cur && cur.kind === 'track') resetTrackUi(cur.t);
    mark(null);
    cur = null;
  }
  function resetTrackUi(k) {
    const b = main.querySelector('.au-play[data-t="' + k + '"]');
    if (b) { b.setAttribute('aria-pressed', 'false'); b.innerHTML = ICON.play; }
    const t = hw && hw.tracks[k];
    if (!t || !$('#fill-' + k)) return;
    $('#fill-' + k).style.width = '0';
    $('#time-' + k).textContent = '0:00 / ' + fmt(t.dur);
    $('#part-' + k).textContent = (t.parts[0] && t.parts[0].label) || '';
  }
  function mark(k, i) {
    if (lastNow) lastNow.classList.remove('now');
    lastNow = null;
    if (k == null) return;
    const el = main.querySelector('.au-line[data-t="' + k + '"][data-i="' + i + '"]');
    if (!el) return;
    el.classList.add('now');
    lastNow = el;
    if (cur && cur.kind === 'track') {
      const r = el.getBoundingClientRect();
      if (r.top < 70 || r.bottom > window.innerHeight - 20) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }
  function onState() {
    if (!cur || cur.kind !== 'track' || !hw) return;
    const b = main.querySelector('.au-play[data-t="' + cur.t + '"]');
    if (!b) return;
    const on = !player.paused && !player.ended;
    b.setAttribute('aria-pressed', String(on));
    b.innerHTML = on ? ICON.pause : ICON.play;
    b.setAttribute('aria-label', (on ? 'Pausar' : 'Escuchar') + ' ' + (KIND[hw.tracks[cur.t].kind] || {}).title);
  }
  player.addEventListener('play', onState);
  player.addEventListener('pause', onState);
  player.addEventListener('timeupdate', () => {
    if (!cur || cur.kind !== 'track' || !hw) return;
    const k = cur.t, t = hw.tracks[k], now = player.currentTime;
    $('#fill-' + k).style.width = Math.min(100, (now / t.dur) * 100) + '%';
    $('#time-' + k).textContent = fmt(now) + ' / ' + fmt(t.dur);
    const bar = main.querySelector('.au-track-line[data-t="' + k + '"]');
    if (bar) bar.setAttribute('aria-valuenow', String(Math.round(now)));
    let part = t.parts[0];
    t.parts.forEach((p) => { if (p.at <= now) part = p; });
    const pe = $('#part-' + k);
    if (part && pe.textContent !== part.label) pe.textContent = part.label;
    let seg = null;
    for (const s of t.segs) { if (s[1] <= now + 0.05) seg = s; else break; }
    const want = seg ? seg[0] : null;
    const el = want == null ? null : main.querySelector('.au-line[data-t="' + k + '"][data-i="' + want + '"]');
    if (el !== lastNow) mark(want == null ? null : k, want);
  });
  player.addEventListener('ended', () => {
    if (!hw) return;   // the base page handles its own clips (js/audios-base.js)
    if (cur && cur.kind === 'track') { const k = cur.t; cur = null; resetTrackUi(k); }
    else cur = null;
    mark(null);
  });

  // Lock-screen / headphone controls on phones.
  function mediaInfo(trackTitle) {
    if (!('mediaSession' in navigator) || !hw) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: trackTitle + ' · ' + hw.title, artist: 'Dralingo · ' + hw.levelName,
        artwork: hw.cover ? [{ src: hw.cover, sizes: '1200x805', type: 'image/jpeg' }] : [],
      });
    } catch (_) {}
  }
})();
