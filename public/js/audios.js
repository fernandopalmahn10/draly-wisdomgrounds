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
// 2026-10-18: a homework's page also has the kid's marks («Escuchada ✓», «¡Ya la mandé!», «✓ Mandada», «Deshacer»),
// drawn by js/ruta.js (Ruta.hwMarks: the same code as «Tus tareas»); the automatic student account (js/ruta-auto.js)
// shows its first card after the key screen made one, and the first El Entrenamiento round on a phone with no account
// makes one (a click listener on «¡A jugar!», the training code itself untouched).
// 2026-10-18 («a practice that's done shows it»): a round that ends on this page goes into the route data at once
// (ctx.trained), so «Volver» to the module page counts it on card 2 without a reload, and the next picker / path asks the
// server again; another tab's round (localStorage draly_train_*: its ping, a phone's or a teacher's scores) or a return
// to this tab redraws the picker / path when the server's answer OR this device's scores changed.
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
  // (an error screen always has its way back: La Ruta Dorada's own band, which hides the page's band, is gone with the
  // screen that failed, and the error draws its own «Volver»: home from the picker, else the worlds)
  const failedHtml = (msg) => {
    document.body.classList.remove('rp-on');
    const home = /^\/audios?\/?$/.test(location.pathname);
    return '<p style="margin:0 0 6px"><a class="dw-back" href="' + (home ? '/' : '/audios') + '">' + (home ? 'Volver al inicio' : 'Volver a los mundos') + '</a></p>' +
      '<p class="au-error">' + msg + '</p>' +
      '<p style="text-align:center"><button type="button" class="bs-btn bs-btn-red au-press" id="au-retry">Volver a intentar</button></p>';
  };
  function load() {
    main.innerHTML = '<p class="au-loading">Cargando…</p>';
    const state = fetch('/api/ruta-dorada', { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((s) => ((s && Array.isArray(s.modules)) ? s : null), () => null);
    Promise.all([fetch(fresh('/assets/audios/catalog.json')).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }), state])
      .then(([c, s]) => {
        catalog = c; ruta = s;
        if (!levelFollow()) route();
        // 🆕 2026-10-18: an automatic account made on the page before (the key screen) shows its card once
        if (window.DralyAuto) { try { window.DralyAuto.afterRoute(ruta); } catch (_) {} }
      })
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
  // 🆕 2026-10-22 «Change level» (/maestro): a teacher moved the logged-in kid to another level. The picker or another
  // module's path goes to that level's path (nothing to type: the kid's session already holds it), and the card «Tu profe
  // te cambió a <nivel> ✨» says so once (js/level-note.js). A base, a homework's audio, a round or a book keep their
  // page: the note waits for the route. → true when it went (the path is drawn)
  const noteFor = (s) => { const n = s && s.levelNote; return n && window.DralyLevelNote && !window.DralyLevelNote.seenHere(n.at) ? n : null; };
  function levelFollow() {
    const n = noteFor(ruta);
    if (!n || !catalog) return false;
    const p = location.pathname;
    const pick = /^\/audios?\/?$/i.test(p);
    const at = p.match(/^\/audios?\/([a-z0-9-]+)\/?$/i);
    const here = at ? at[1].toLowerCase() : '';
    const isMod = (x) => ruta.modules.some((m) => m.slug === x || m.id === x);
    if (!pick && !(here && isMod(here))) return false;
    const mod = ruta.modules.find((m) => m.slug === n.level || m.id === n.levelId);
    if (!mod) return false;
    if (here !== mod.slug) { try { history.replaceState(null, '', '/audios/' + mod.slug + location.search); } catch (_) { return false; } }
    route();
    setTimeout(() => window.DralyLevelNote.show(n), 350);
    return true;
  }
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
    m.train ? m.train.worlds.map((w) => (w.open ? 1 : 0) + ':' + (w.best == null ? '' : w.best)).join(',') : null,
    // (2026-10-18: the kid's homework marks, so marks made on another phone show when the kid comes back to this tab)
    m.tareas ? Object.keys(m.tareas).sort().map((id) => id + (m.tareas[id].h ? 'h' : '') + (m.tareas[id].s ? 's' : '')).join(',') : null]) : null);
  // (2026-10-18) El Entrenamiento's scores this DEVICE holds for the visitor (a key-only phone's, a teacher's own rounds)
  // and the ping of the last round any tab finished: part of what the picker / a path showed, so another tab's round or a
  // return to this tab redraws them even when the server's answer is the same
  const localSig = () => {
    const E = window.Entrenamiento;
    if (!E || !ruta || !Array.isArray(ruta.modules)) return '';
    let p = '';
    try { p = localStorage.getItem('draly_train_ping') || ''; } catch (_) {}
    return p + '|' + JSON.stringify(ruta.modules.map((m) => (m.train ? E.localBest(ruta, m.slug) : null)));
  };
  let drawnLocal = '';
  function refreshState(force) {   // force: redraw even when the server says the same (the phone's seals changed)
    if (!catalog || !isWorldView()) return;
    fetch('/api/ruta-dorada', { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).then((s) => {
        if (!s || !Array.isArray(s.modules) || !isWorldView()) return;
        if (noteFor(s)) { ruta = s; firstRoute = true; if (!levelFollow()) route(); return; }   // (2026-10-22: a teacher's «Change level»)
        if (force !== true && sig(s) === sig(ruta) && localSig() === drawnLocal) return;
        // (a homework audio playing here is never cut by a redraw: the next return to the tab brings the news)
        if (force !== true && player && !player.paused) return;
        ruta = s;
        firstRoute = true;                     // a quiet redraw: the focus stays where it was
        route();
      }).catch(() => {});
  }
  window.addEventListener('pageshow', (e) => { if (e.persisted) refreshState(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshState(); });
  // another tab finished an El Entrenamiento round (or kept a phone's / a teacher's score): the picker / a path shows it
  // (never for the sound switch, draly_train_sound: a mute tap is no news)
  window.addEventListener('storage', (e) => { if (e.key && /^draly_train_(?!sound$)/.test(e.key)) refreshState(); });
  // 🎯 2026-10-18 («a practice that's done shows it»): a round that ended on THIS page. Its best goes into the route data
  // the page keeps (an account's best: the server has it already, so «Volver» to the path counts it at once, no reload;
  // a phone's or a teacher's score is read from this device when the path draws), and the next picker / path asks the
  // server again for the rest (the Dorado's state).
  let trainDirty = false;
  // (a result that arrives after the kid already went back to the picker or a path, review 2026-10-18: that screen asks
  // again now and redraws: its ping makes this device's part differ)
  function trained(slug, key, best, info) {
    trainDirty = true;
    if (isWorldView()) setTimeout(() => { if (trainDirty && isWorldView()) { trainDirty = false; refreshState(); } }, 0);
    const m = ruta && Array.isArray(ruta.modules) ? ruta.modules.find((x) => x.slug === slug || x.id === slug) : null;
    if (!m || !m.train || !Array.isArray(m.train.worlds) || !info || !info.saved) return;
    const w = m.train.worlds.find((x) => x.key === key);
    if (w) w.best = Math.max(Number(w.best) || 0, Number(best) || 0);
    const d = m.dorado;
    if (d && d.rule === 'practice' && d.pct) {
      d.practiced = m.train.worlds.filter((x) => x.kind === 'world' && x.best != null && x.best >= d.pct).length;
      if (info.doradoNow) { d.open = true; d.via = 'practice'; }
    }
  }
  // the visitor's state again WITHOUT a redraw (2026-10-18: a homework page or El Entrenamiento learns the automatic
  // account a tap just made; the next screen is drawn with it) → Promise<state | null>
  function reloadState() {
    return fetch('/api/ruta-dorada', { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).then((s) => { if (s && Array.isArray(s.modules)) { ruta = s; return s; } return null; }, () => null);
  }
  // 🆕 2026-10-18: the first El Entrenamiento round on a phone with no account is a first real step: the phone gets its
  // automatic account (js/ruta-auto.js; its card waits until the round is over). The round itself is untouched: its
  // score joins the account through El Entrenamiento's usual path (the phone's proofs, at the next visit of the route).
  main.addEventListener('click', (e) => {
    if (!e.target.closest('#tr-go, #tr-again') || !ruta || ruta.student || ruta.teacher || !window.DralyAuto) return;
    const tm = location.pathname.match(/^\/audios?\/([a-z0-9-]+)\/entrenamiento/i);
    const mod = tm && ruta.modules.find((x) => x.slug === tm[1].toLowerCase() || x.id === tm[1].toLowerCase());
    if (!mod || !mod.open) return;
    window.DralyAuto.ensure(mod.slug, 'train', null, { afterRound: true }).then((r) => {
      if (!r) return;
      reloadState();
      if (r.account && (r.created || r.resumed)) window.DralyAuto.welcome(r.account, { afterRound: true });
    });
  }, true);

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
    // the picker / a path: what this device's scores were when drawn; after a round on this page, the server's word too
    if (isWorldView()) {
      drawnLocal = localSig();
      if (trainDirty) { trainDirty = false; refreshState(); }
    }
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
  const rutaCtx = () => ({ catalog, ruta, sealsOf, meterHtml, cardHtml, homeworksOf, refresh: refreshState, reloadState, trained });
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
    // (2026-10-18, «Mi Dralingo» part 3: a homework opened from its experience on the kid's home goes back there)
    let fromHome = new URLSearchParams(location.search).get('from') === 'homework';
    try { fromHome = fromHome || sessionStorage.getItem('draly_home_from') === location.pathname; } catch (_) { /* a link is enough */ }
    let html = (fromHome ? '<a class="au-back" href="/homework#exp-' + esc(h.exp) + '">' + ICON.back + 'Mi Dralingo</a>'
      : '<a class="au-back" data-nav href="/audios/' + esc(folder ? folder.id : '') + '">' + ICON.back + esc(folder ? folder.name : 'Todos los mundos') + '</a>') +
      '<section class="au-hero">' + (h.cover ? '<img src="' + esc(h.cover) + '" alt="">' : '') +
      '<h1>' + esc(h.title) + '</h1>' +
      '<p class="au-hero-meta">' + esc(h.levelName) + ' · Experiencia ' + h.exp + ' · Ronda ' + h.round + '</p>' +
      (h.tagline ? '<p class="au-tag">' + esc(h.tagline) + '</p>' : '') + '</section>' +
      // 🏆 2026-10-18: the kid's marks here too («Escuchada ✓», «¡Ya la mandé!», «✓ Mandada»), drawn by js/ruta.js
      '<div class="au-marks" data-marks></div>';
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
      '<p>Di las frases seguidas, en una sola toma, aunque tengas errores. Mándaselo a tu profe.</p>' +
      '<div class="au-marks" data-marks></div></section>';
    main.innerHTML = html;
    // the marks: the same code as La Ruta Dorada's «Tus tareas» (js/ruta.js): a kid of that level or a phone with no login
    // marks, a teacher sees the kids' buttons as a preview, a kid of another level only listens (no bar)
    const mounts = Array.prototype.slice.call(main.querySelectorAll('[data-marks]'));
    let bar = null;
    if (window.Ruta && window.Ruta.hwMarks) { try { bar = window.Ruta.hwMarks(mounts, rutaCtx(), h); } catch (e) { console.error('[audios] the homework marks could not be drawn', e); } }
    if (!bar) mounts.forEach((x) => x.remove());

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
    heard();
  }
  // 🏆 2026-10-18: playing a homework's audio here marks it «Escuchada» on La Ruta Dorada («Tus tareas», js/ruta.js:
  // the kid's account when logged in, else this phone)
  // (logged out: the phone's own mark, never the account of a kid who logged out here: js/ruta.js decides)
  function heard() {
    if (!hw || !window.Ruta || !window.Ruta.markHeard) return;
    try { window.Ruta.markHeard(hw.id, ruta, (lv) => homeworksOf(lv).map((x) => x.id)); } catch (_) {}
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
    heard();
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
