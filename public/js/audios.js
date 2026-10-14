// =========================================================================
// audios.js · «Audios y vocabulario» (/audios, /audios/<id>)
// =========================================================================
// Reads /assets/audios/catalog.json (written by scripts/audios-build.js).
// /audios               → the library: one folder per level (core/levels.js
//                         names: YCT 1 · New HSK 1 · HSK 1)
// /audios/<level>       → a level folder: its vocabulary base pinned first
//                         («La base · Empieza aquí»), then its homework audios
// /audios/<level>-base  → the base itself (js/audios-base.js)
// /audios/<homework id> → the homework: its three tracks (words, dialogue,
//                         video lines). The printed PDFs link here: these
//                         addresses never change (hsk2-… opens newhsk1-…).
// One <audio> element plays everything, so only one sound at a time.
// No login and no hanzi (kid UI rule): pinyin with tones + Spanish.
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

  function load() {
    main.innerHTML = '<p class="au-loading">Cargando…</p>';
    fetch(fresh('/assets/audios/catalog.json'))
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((c) => { catalog = c; route(); })
      .catch(() => {
        main.innerHTML = '<p class="au-error">No se pudieron cargar los audios. Revisa tu internet.</p>' +
          '<p style="text-align:center"><button type="button" class="bs-btn bs-btn-red au-press" id="au-retry">Volver a intentar</button></p>';
        $('#au-retry').addEventListener('click', load);
      });
  }
  load();

  let shownPath = null;            // the page on screen: going back through #mundo-… anchors only scrolls
  window.addEventListener('popstate', () => {
    if (!catalog) return;
    if (location.pathname === shownPath && document.body.classList.contains('au-is-base')) {
      let el = null;
      try { el = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (_) { el = null; }
      if (el) el.scrollIntoView(); else window.scrollTo(0, 0);
      return;
    }
    route();
  });
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-nav]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    e.preventDefault();
    history.pushState(null, '', a.getAttribute('href'));
    route();
    if (!location.hash) window.scrollTo(0, 0);
  });

  // ── what the catalog holds, per level folder ──────────────────────
  function folders() {
    if (Array.isArray(catalog.levels) && catalog.levels.length) return catalog.levels;
    const out = [];   // an older catalog without levels: one folder per homework level
    catalog.homeworks.forEach((h) => { if (!out.some((f) => f.id === h.level)) out.push({ id: h.level, name: h.levelName }); });
    return out;
  }
  const basesOf = (lv) => (catalog.bases || []).filter((b) => b.level === lv);
  const homeworksOf = (lv) => catalog.homeworks.filter((h) => h.level === lv)
    .sort((a, b) => (b.exp - a.exp) || (b.round - a.round));
  const sealsOf = (b) => (window.AudiosBase ? window.AudiosBase.seals(b.level) : new Set());

  function route() {
    if (!catalog) return;
    shownPath = location.pathname;
    navSeq++;
    stop();
    if (window.AudiosBase) window.AudiosBase.leave();
    document.body.classList.remove('au-is-base');
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
    const folder = !base && id && folders().find((f) => f.id === id);
    const found = !base && !folder && id && catalog.homeworks.find((h) => h.id === id);
    if (base) renderBase(base);
    else if (folder) renderFolder(folder);
    else if (found) renderHomework(found);
    else renderLibrary();
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
  const sellos = (n, of) => n + ' de ' + of + ' sellos';   // one wording everywhere: «7 de 83 sellos»

  // ── The library: one folder per level ──────────────────────────────
  function renderLibrary() {
    hw = null;
    document.title = 'Audios y vocabulario · Dralingo';
    const list = folders().map((f) => ({ f, bases: basesOf(f.id), hws: homeworksOf(f.id) }))
      .filter((x) => x.bases.length || x.hws.length);
    if (!list.length) { main.innerHTML = '<p class="au-error">Todavía no hay audios. ¡Muy pronto!</p>'; return; }
    main.innerHTML =
      '<h1 class="au-h1">Audios y vocabulario</h1>' +
      '<p class="au-lede">Elige tu nivel. En cada uno están sus palabras y los audios de sus tareas.</p>' +
      '<div class="au-folders">' + list.map(({ f, bases, hws }) => {
        const b = bases[0];
        const seals = b ? sealsOf(b) : null;
        const pics = b ? (b.peek || []) : hws.map((h) => h.thumb || h.cover).filter(Boolean).slice(0, 3);
        const tareas = hws.length ? hws.length + (hws.length === 1 ? ' tarea' : ' tareas') + ' con audio' : 'Tareas con audio: muy pronto';
        return '<a class="au-folder' + (b ? ' is-start on-red' : '') + '" href="/audios/' + esc(f.id) + '" data-nav>' +
          '<span><span class="au-folder-name">' + esc(f.name) + '</span>' +
          (b ? '<span class="au-folder-what"><b>' + esc(b.title) + ' · ' + esc(b.kicker || 'Empieza aquí') + '</b><br>' + b.words + ' palabras con audio</span>' +
                meterHtml(b, seals) +
                '<span class="au-folder-meta">' + sellos(seals.size, b.words) + (hws.length ? ' · ' + tareas : '') + '</span>'
             : '<span class="au-folder-what"><b>' + tareas + '</b></span>' +
               '<span class="au-folder-meta">La más nueva: ' + esc(hws[0].title) + '</span>') +
          '</span>' +
          (pics.length ? '<span class="au-peek' + (b ? '' : ' is-covers') + '" aria-hidden="true">' +
            pics.map((p) => '<img src="' + esc(p) + '" alt="" ' + (b ? 'width="400" height="400"' : 'width="360" height="241"') + ' decoding="async">').join('') + '</span>' : '') +
          '</a>';
      }).join('') + '</div>';
  }

  // ── A level folder: its base pinned first, then its homework audios ─
  function renderFolder(f) {
    hw = null;
    document.title = f.name + ' · Audios y vocabulario · Dralingo';
    const b = basesOf(f.id)[0];
    const hws = homeworksOf(f.id);
    let html = '<a class="au-back" data-nav href="/audios">' + ICON.back + 'Todos los niveles</a>' +
      '<h1 class="au-h1">' + esc(f.name) + '</h1>';
    if (b) {
      const seals = sealsOf(b);
      const go = seals.size ? (seals.size >= b.words ? 'Repasar' : 'Seguir') : 'Empezar';
      html += '<p class="au-lede">Empieza por la base: las ' + b.words + ' palabras, con su dibujo, una frase y el audio.</p>' +
        '<a class="au-start on-red" href="/audios/' + esc(b.id) + '" data-nav>' +
          '<span class="au-start-title">' + esc(b.title) + '<span>' + esc(b.kicker || 'Empieza aquí') + '</span></span>' +
          '<span class="au-start-what">' + b.words + ' palabras en ' + (b.worlds || []).length + ' mundos</span>' +
          meterHtml(b, seals) +
          '<span class="au-start-count">' + sellos(seals.size, b.words) + '</span>' +
          '<span class="au-start-go">' + ICON.play + go + '</span>' +
          '<img class="au-start-dragon" src="/assets/dralingo/hello.webp" alt="" width="432" height="480" decoding="async">' +
        '</a>' +
        '<h2 class="au-h2">Audios de las tareas</h2>';
    } else {
      html += '<p class="au-lede">Toca tu tarea y escucha cada palabra y cada frase.</p><div style="height:16px"></div>';
    }
    html += hws.length ? '<div class="au-cards">' + hws.map((h, k) => cardHtml(h, k === 0)).join('') + '</div>'
      : '<p class="au-empty"><b>Todavía no hay tareas de ' + esc(f.name) + ' con audio.</b> Cuando llegue la primera, aparece aquí.' +
        (b ? ' Mientras tanto, empieza por la base.' : '') + '</p>';
    main.innerHTML = html;
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
    fetch(fresh(b.data))
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
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
    let html = '<a class="au-back" data-nav href="/audios/' + esc(folder ? folder.id : '') + '">' + ICON.back + esc(folder ? folder.name : 'Todos los niveles') + '</a>' +
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
