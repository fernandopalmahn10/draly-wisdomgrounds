// =========================================================================
// audios.js — "Audios de las tareas" (/audios, /audios/<id>)
// =========================================================================
// Reads /assets/audios/catalog.json (written by scripts/audios-build.js).
// /audios          → level chips + one card per homework (newest first)
// /audios/<id>     → the homework: its three tracks (words, dialogue, video
//                    lines). One big play button per track; every line is
//                    tappable on its own; the line being read turns gold.
// One <audio> element plays everything, so only one sound at a time.
// No login and no hanzi (kid UI rule): pinyin with tones + Spanish, as in the PDF.
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
  };
  const KIND = {
    words: { title: 'Las palabras', how: 'Cada palabra suena dos veces. Repítela en voz alta en la pausa.' },
    dialogue: { title: 'Escucha, lee, repite', how: 'Primero suena toda la conversación. Después, frase por frase: repite en la pausa.' },
    video: { title: 'Tu video', how: 'Repite cada frase en la pausa. Al final suenan todas seguidas, como tu video de una sola toma.' },
  };

  const main = $('#au-main');
  const player = $('#au-player');
  let catalog = null;
  let hw = null;                   // homework on screen
  let cur = null;                  // { kind: 'track', t } | { kind: 'clip', t, i }
  let slow = store.get('au-slow') === '1';
  let lastNow = null;

  fetch('/assets/audios/catalog.json', { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((c) => { catalog = c; route(); })
    .catch(() => { main.innerHTML = '<p class="au-error">No se pudieron cargar los audios. Revisa tu internet y vuelve a intentar.</p>'; });

  window.addEventListener('popstate', route);
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-nav]');
    if (!a || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    history.pushState(null, '', a.getAttribute('href'));
    route();
    window.scrollTo(0, 0);
  });

  function route() {
    if (!catalog) return;
    stop();
    const m = location.pathname.match(/^\/audios?\/([a-z0-9-]+)\/?$/i);
    let id = (m && m[1]) || new URLSearchParams(location.search).get('t');
    if (id) id = id.replace(/^hsk2-/i, 'newhsk1-');   // HSK 2 was absorbed into New HSK 1 (2026-10-11): old links still work
    const found = id && catalog.homeworks.find((h) => h.id === id.toLowerCase());
    if (found) renderHomework(found); else renderList();
  }

  // ── List ───────────────────────────────────────────────────────────
  function renderList() {
    hw = null;
    document.title = 'Audios de las tareas · Dralingo';
    const levels = [];
    catalog.homeworks.forEach((h) => { if (!levels.some((l) => l.id === h.level)) levels.push({ id: h.level, name: h.levelName }); });
    if (!levels.length) { main.innerHTML = '<p class="au-error">Todavía no hay audios. ¡Muy pronto!</p>'; return; }
    let level = store.get('au-level');
    if (!levels.some((l) => l.id === level)) level = levels[0].id;
    const draw = () => {
      const list = catalog.homeworks.filter((h) => h.level === level)
        .sort((a, b) => (b.exp - a.exp) || (b.round - a.round));
      main.innerHTML =
        '<h1 class="au-intro">¿Cómo suena tu tarea?</h1>' +
        '<p class="au-intro-sub">Toca tu tarea y escucha cada palabra y cada frase.</p>' +
        (levels.length > 1 ? '<div class="au-levels" role="group" aria-label="Nivel">' + levels.map((l) =>
          '<button type="button" class="au-level" data-level="' + esc(l.id) + '" aria-pressed="' + (l.id === level) + '">' + esc(l.name) + '</button>').join('') + '</div>' : '') +
        '<div class="au-cards">' + list.map((h, k) =>
          '<a class="au-card" data-nav href="/audios/' + esc(h.id) + '">' +
          (h.cover ? '<img src="' + esc(h.cover) + '" alt="">' : '<span></span>') +
          '<span><span class="au-card-meta">Experiencia ' + h.exp + ' · Ronda ' + h.round + (k === 0 ? '<span class="au-new">Nueva</span>' : '') + '</span>' +
          '<span class="au-card-title" style="display:block">' + esc(h.title) + '</span>' +
          '<span class="au-pill">' + ICON.play + h.tracks.length + ' audios</span></span></a>').join('') + '</div>';
      main.querySelectorAll('.au-level').forEach((b) => b.addEventListener('click', () => {
        level = b.getAttribute('data-level');
        store.set('au-level', level);
        draw();
      }));
    };
    draw();
  }

  // ── One homework ───────────────────────────────────────────────────
  function renderHomework(h) {
    hw = h;
    store.set('au-level', h.level);
    document.title = h.title + ' · Audios · Dralingo';
    let html = '<a class="au-back" data-nav href="/audios">← Todas las tareas</a>' +
      '<section class="au-hero">' + (h.cover ? '<img src="' + esc(h.cover) + '" alt="">' : '') +
      '<p class="au-hero-meta">' + esc(h.levelName) + ' · Experiencia ' + h.exp + ' · Ronda ' + h.round + '</p>' +
      '<h1>' + esc(h.title) + '</h1>' + (h.tagline ? '<p class="au-tag">' + esc(h.tagline) + '</p>' : '') + '</section>';
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
      '<span><span class="au-py" style="display:block">' + esc(it.py) + '</span><span class="au-es">' + esc(it.es) + '</span></span>' +
      '<span class="au-ico">' + ICON.sound + '</span></button>';
  }

  // ── Playback ───────────────────────────────────────────────────────
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
    if (!cur || cur.kind !== 'track') return;
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
