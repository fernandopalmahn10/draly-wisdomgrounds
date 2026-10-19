// =========================================================================
// entrenamiento.js · El Entrenamiento, step 2 of La Ruta Dorada (phase 4, 2026-10-16)
// =========================================================================
// Drawn by js/audios.js's router inside La Ruta Dorada's page:
//   /audios/<level>/entrenamiento           the level's practice worlds: open or not, the kid's best stars, and the
//                                           Dorado meter (every world with 70 % opens El Simulacro Dorado)
//   /audios/<level>/entrenamiento/<world>   a world: one tap to start, a quick round of ~10 questions (one at a time,
//                                           audio, big tiles, instant right / wrong with the right answer, streaks,
//                                           Dralingo and the gang), then stars, the % and «Otra ronda»
// Everything comes from /api/ruta/train (server.js, core/entrenamiento.js), behind the level's key. The questions
// arrive WITHOUT their right answers: each tap is checked by the server, which answers right / wrong and only then the
// right one; the % is counted there. The audio streams from the round (/api/ruta/train/voice/…): no text in the URL.
// A key-only phone (nobody logged in) keeps its scores here (localStorage draly_train_<level>, with the server's signed
// proof) and hands them in at the kid's first login (POST /api/ruta/train/scores; `who` = the account the mirror holds,
// like La Base's seals; a sibling's scores wait for them in `held`).
// «A practice that's done shows it» (his words 2026-10-18: "whenever I finish a practice on the training it's not recorded…
// if I already finished it it should be green"), for EVERY visitor:
//   · a logged-in kid / an automatic account: the server's best (the round that made the account counts on it)
//   · a key-only phone: its own scores (draly_train_<level>, above)
//   · a teacher's device (his computer is the super admin): its rounds are kept ON THIS DEVICE ONLY, in
//     localStorage draly_train_t_<level> { v: 2, by: { <tw>: { best } } } (no proof: never sent anywhere, never a kid's
//     score), per PERSON on the device (`tw`, the server's opaque id: teacher B never sees teacher A's, a kid logged in on
//     a teacher device has their own), shown the same way with «Tus rondas de maestro: solo en este equipo»
//   A played world shows its stars and best %; at the % goal it turns GREEN with a ✓ (tile, the Dorado meter, card 2 of
//   the module page). A finished round tells the page (ctx.trained: the module page's card 2 counts it at once, no stale
//   route data after «Volver») and other tabs (localStorage draly_train_ping): this page redraws its worlds quietly when
//   another tab finishes a round or the tab comes back into view. A round's result is recorded ONCE wherever it arrives
//   (recordResult: the star screen, «Ver mis estrellas» answered after the kid left, the back button's keepalive); a
//   page closed before the answer gets it back from the server (`done`: that phone's or teacher's finished rounds).
// No hanzi, no em dash, pinyin without tone marks (the packs write it so).
// =========================================================================
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const calm = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const pick1 = (a) => a[Math.floor(Math.random() * a.length)];
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
  };
  // 🏠 2026-10-18 («Mi Dralingo» part 3): a world opened from the kid's home (/homework: «Practicar aquí») goes back
  // there, «Mi Dralingo», in one tap (js/mi-dralingo.js keeps that page's address in sessionStorage draly_home_from)
  const fromHome = () => { try { return sessionStorage.getItem('draly_home_from') === location.pathname; } catch (_) { return false; } };
  const homeBack = (back) => (fromHome() ? '<a class="au-back" href="/homework">' + I.back + 'Mi Dralingo</a>' : back);
  const I = {
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>',
    sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 9.5v5h3.5L12 19V5L7.5 9.5H4z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
    tap: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.5 3a2 2 0 0 1 2 2v5.2l.8-.3a2 2 0 0 1 2.4 1l.2.4.7-.2a2 2 0 0 1 2.4 1.2l.3.7a2 2 0 0 1 2.3 1.6l.4 2.6a5 5 0 0 1-1.3 4.1L18 22H10l-4.2-5.2a1.9 1.9 0 0 1 2.7-2.6l1 .8V5a2 2 0 0 1 0-2z"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    cross: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 11.5V8a4 4 0 0 1 8 0v3.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><rect x="4.5" y="11" width="15" height="10.5" rx="2.6" fill="currentColor"/></svg>',
    flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.6 2.5c.5 3-1.2 4.6-2.6 6.3-1.3 1.6-2.4 3.1-2.4 5.3a4.4 4.4 0 0 0 8.8.2c0-1.2-.4-2.2-1-3.1.9.3 1.7 1 2.2 1.9.6-1 .9-2.2.7-3.6-.4-3-2.9-5.5-5.7-7z"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
    again: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12a7 7 0 1 0 2.1-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M6.6 2.8v4.6h4.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 3.5h10v5.2a5 5 0 0 1-10 0z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M7 5.5H4.6a2.6 2.6 0 0 0 2.7 4.4M17 5.5h2.4a2.6 2.6 0 0 1-2.7 4.4M12 13.8v3.4"/><path fill="currentColor" d="M8 20.5h8v-.7a2.6 2.6 0 0 0-2.6-2.6h-2.8A2.6 2.6 0 0 0 8 19.8z"/></svg>',
    abc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 17l3.4-10h.6l3.4 10M4.7 13.5h4.8M13.5 7v10h3.3a2.6 2.6 0 0 0 0-5.2h-3.3 3a2.4 2.4 0 0 0 0-4.8z" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    exam: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2.4" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>',
  };
  // Dralingo in his platform look (kandura, ghutra, mustache): the gang's lines come from js/cast.js
  const DRAGON = { hello: '/assets/dralingo/hello.webp', power: '/assets/dralingo/power.webp', wise: '/assets/dralingo/wise.webp', cheer: '/assets/dralingo/anim/cheer-still.webp' };
  // recorded sound effects of the platform's games (never synthesized beeps)
  const SFX = { right: '/assets/kingdoms/correct.mp3', wrong: '/assets/kingdoms/wrong.mp3', streak: '/assets/kingdoms/streak.mp3',
    star: '/assets/mochi/star.mp3', win: '/assets/kingdoms/sting-win.mp3', tap: '/assets/kingdoms/tap.mp3' };
  const RIGHT_WORDS = ['¡Muy bien!', '¡Correcto!', '¡Eso es!', '¡Genial!', '¡Bien hecho!'];
  const STREAKS = [3, 5, 7, 10];

  // ── the phone's own scores (a key-only phone), joined to the account at the first login ──
  // { v: 1, who, best: { world: pct }, proofs: { world: token }, held: { who: { world: token } } }
  const MKEY = (slug) => 'draly_train_' + slug;
  function readM(slug) {
    let o = null;
    try { o = JSON.parse(store.get(MKEY(slug)) || 'null'); } catch (_) { o = null; }
    if (!o || typeof o !== 'object' || Array.isArray(o)) o = {};
    ['best', 'proofs', 'held'].forEach((k) => { if (!o[k] || typeof o[k] !== 'object' || Array.isArray(o[k])) o[k] = {}; });
    return o;
  }
  const writeM = (slug, o) => { o.v = 1; store.set(MKEY(slug), JSON.stringify(o)); };
  // → { best, beat } (beat: this round beat an earlier one on this phone)
  function keepScore(slug, key, pct, proof) {
    const o = readM(slug);
    const before = o.best[key] != null ? Number(o.best[key]) : NaN;
    if (!(before >= pct)) { o.best[key] = pct; if (proof) o.proofs[key] = proof; }
    writeM(slug, o);
    return { best: Math.max(pct, Number.isFinite(before) ? before : 0), beat: Number.isFinite(before) && pct > before };
  }
  // the account `who` is logged in on this phone: what this phone holds for them goes up (a sibling's scores wait)
  // → Promise<{ sent, best }> (never rejects). (Proofs the server doesn't take, bound to another phone id after its
  // cookies were cleared, can never join any account: they are not kept.)
  const syncing = {};       // level → the save in flight
  function syncScores(slug, who) {
    if (!who) return Promise.resolve({ sent: 0 });
    if (syncing[slug]) return syncing[slug];
    const o = readM(slug);
    if (o.who && o.who !== who) {                         // another kid's mirror on this phone: theirs waits for them
      if (Object.keys(o.proofs).length) o.held[o.who] = Object.assign({}, o.held[o.who] || {}, o.proofs);
      o.proofs = Object.assign({}, o.held[who] || {});
      delete o.held[who];
      const ids = Object.keys(o.held);
      ids.slice(0, Math.max(0, ids.length - 4)).forEach((k) => { delete o.held[k]; });   // a family phone: 4 kids at most
      o.best = {};
    }
    const proofs = Object.keys(o.proofs).map((k) => o.proofs[k]).filter((t) => typeof t === 'string');
    const mine = o.who;
    o.who = who;
    if (!proofs.length) { writeM(slug, o); return Promise.resolve({ sent: 0 }); }
    writeM(slug, o);
    syncing[slug] = fetch('/api/ruta/train/scores', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: slug, who: mine === who ? who : null, proofs }),
    }).then((r) => r.json().catch(() => null).then((d) => ({ status: r.status, d })), () => ({ status: 0, d: null }))
      .then(({ status, d }) => {
        delete syncing[slug];
        const now = readM(slug);
        if (d && d.ok) {
          if (d.coins && window.DralyCoins) window.DralyCoins.pop(d.coins);   // 🪙 this phone's rounds from before the login
          now.proofs = {}; now.best = {}; now.who = d.who || who; writeM(slug, now); return { sent: d.merged || 0, best: d.best || null };
        }
        if (status === 409 && d && d.who) { now.who = mine; writeM(slug, now); }   // the server knows better: settle at the next look
        return { sent: 0 };
      });
    return syncing[slug];
  }
  const phoneBest = (slug) => readM(slug).best;

  // ── a teacher's own rounds: on this device only (2026-10-18, «Teachers see what kids see») ──
  // localStorage draly_train_t_<level> = { v: 2, by: { <tw>: { best: { world: pct }, at } } }. Never sent to the server,
  // never joined to an account (there is no proof), and never read for a kid: only when the server says this visitor is a
  // teacher. `tw` (the review of 2026-10-18) = the server's opaque id of WHO the teacher is on this device (their uid, and
  // the kid logged in there too, server.js _trainTeacherWho): teacher B on a shared laptop never sees teacher A's green
  // worlds, and a kid logged in at /homework on a remembered teacher device never sees or writes into the teacher's.
  // No `tw` (an old server) = nothing kept. A first-version store ({ v: 1, best }) belongs to nobody: it is never shown.
  const TKEY = (slug) => 'draly_train_t_' + slug;
  const TEACHERS_MAX = 4;                                   // a shared laptop: four people's rounds at most
  const okTw = (tw) => typeof tw === 'string' && /^[a-f0-9]{8,40}$/.test(tw);
  function readT(slug) {
    let o = null;
    try { o = JSON.parse(store.get(TKEY(slug)) || 'null'); } catch (_) { o = null; }
    const by = o && typeof o === 'object' && o.v === 2 && o.by && typeof o.by === 'object' && !Array.isArray(o.by) ? o.by : {};
    return { v: 2, by };
  }
  function cleanBest(b) {
    const out = {};
    if (!b || typeof b !== 'object' || Array.isArray(b)) return out;
    Object.keys(b).forEach((k) => { const n = Number(b[k]); if (/^[a-z0-9-]{1,40}$/.test(k) && Number.isFinite(n) && n >= 0 && n <= 100) out[k] = n; });
    return out;
  }
  function teacherBest(slug, tw) {
    if (!okTw(tw)) return {};
    const e = readT(slug).by[tw];
    return e ? cleanBest(e.best) : {};
  }
  // → { best, beat } like keepScore
  function keepTeacher(slug, key, pct, tw) {
    if (!okTw(tw)) return { best: pct, beat: false };     // (the end card shows it; kept nowhere)
    const o = readT(slug);
    const best = o.by[tw] ? cleanBest(o.by[tw].best) : {};
    const before = best[key] != null ? Number(best[key]) : NaN;
    const result = { best: Math.max(pct, Number.isFinite(before) ? before : 0), beat: Number.isFinite(before) && pct > before };
    if (before >= pct && o.by[tw]) return result;            // (nothing new: nothing written, no news for the other tabs)
    if (!(before >= pct)) best[key] = pct;
    o.by[tw] = { best, at: Date.now() };
    const ids = Object.keys(o.by).sort((a, b) => (Number(o.by[a].at) || 0) - (Number(o.by[b].at) || 0));
    ids.slice(0, Math.max(0, ids.length - TEACHERS_MAX)).forEach((k) => { delete o.by[k]; });
    store.set(TKEY(slug), JSON.stringify(o));
    return result;
  }
  // the scores this device holds for THIS visitor: a teacher's own rounds, a key-only phone's scores, nothing for an account
  // (an account's best comes from the server). v: { student, teacher, tw } (the train view, or the route state)
  const localBest = (v, slug) => (v && v.teacher ? teacherBest(slug, v.tw) : v && !v.student ? phoneBest(slug) : {});
  const TEACHER_NOTE = 'Tus rondas de maestro: solo en este equipo';
  const teacherNote = (cls) => '<p class="tr-teacher-note' + (cls ? ' ' + cls : '') + '">' + I.eye + '<span>' + TEACHER_NOTE + '</span></p>';
  // other tabs learn that a round ended (their worlds and the module page redraw: js/audios.js listens too)
  const PING = 'draly_train_ping';
  const ping = (slug, key) => store.set(PING, JSON.stringify({ slug, key, at: Date.now() }));

  // ── the seals this phone holds, as ranges (the server counts them: a free tap carries no secret) ──
  function sealRanges(ctx, m) {
    const cb = m && m.base && (ctx.catalog.bases || []).find((x) => x.id === m.base.id);
    if (!cb || !window.AudiosBase) return '';
    const a = [...window.AudiosBase.seals(cb.level)].filter((n) => Number.isInteger(n) && n > 0).sort((x, y) => x - y);
    const out = [];
    for (let i = 0; i < a.length;) { let j = i; while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++; out.push(j > i ? a[i] + '-' + a[j] : String(a[i])); i = j + 1; }
    return out.join(',');
  }
  const starsOf = (pct, need) => (pct == null ? 0 : pct >= Math.max(90, need) ? 3 : pct >= need ? 2 : pct >= 40 ? 1 : 0);
  const starRow = (n, cls) => '<span class="tr-stars' + (cls ? ' ' + cls : '') + '" aria-hidden="true">' + [0, 1, 2].map((k) => '<i class="' + (k < n ? 'is-on' : '') + '">' + I.star + '</i>').join('') + '</span>';
  // a question's text: its pinyin groups in the pinyin type (the server says which groups are pinyin)
  function textHtml(text, py) {
    let k = 0;
    return esc(text).replace(/«([^«»]+)»/g, (all, inner) => (py && py[k++] ? '«<span class="tr-py" lang="zh-Latn-pinyin">' + inner + '</span>»' : all));
  }

  // ── sound: one element for the voice, one for the effects (both unlocked by the kid's first tap: iPhone) ──
  let voiceEl = null, sfxEl = null, seqToken = 0;
  function audioEls() {
    if (!voiceEl) { voiceEl = new Audio(); voiceEl.preload = 'auto'; }
    if (!sfxEl) { sfxEl = new Audio(); sfxEl.preload = 'auto'; }
  }
  function unlock() {
    audioEls();
    // (inside the tap: a phone lets these two elements play later, after the round arrives)
    [voiceEl, sfxEl].forEach((el) => { try { el.src = SFX.tap; el.volume = el === voiceEl ? 0 : 0.6; const p = el.play(); if (p && p.catch) p.catch(() => {}); } catch (_) {} });
  }
  let muted = store.get('draly_train_sound') === '0';
  function sfx(name) {
    if (muted || !sfxEl) return;
    try { sfxEl.pause(); sfxEl.src = SFX[name]; sfxEl.volume = name === 'win' ? 0.55 : 0.7; const p = sfxEl.play(); if (p && p.catch) p.catch(() => {}); } catch (_) {}
  }
  // the option being read aloud: a warm tint and a small speaker in its corner (not the ring of a tapped tile)
  function reading(tile, on) {
    if (!tile) return;
    tile.classList.toggle('is-reading', !!on);
    const mark = tile.querySelector('.tr-opt-mark');
    if (mark && !tile.classList.contains('is-right') && !tile.classList.contains('is-wrong')) mark.innerHTML = on ? I.sound : '';
  }
  function stopVoice() {
    seqToken++;
    if (voiceEl) { try { voiceEl.pause(); } catch (_) {} }
    if (play) { play.root.querySelectorAll('.tr-opt.is-reading').forEach((b) => reading(b, false)); if (play.spk) play.spk.classList.remove('is-on'); }
  }
  // play one clip → Promise (resolves when it ends or fails: the round never waits on a sound)
  function voice(url) {
    return new Promise((resolve) => {
      if (!voiceEl || !url) { resolve(false); return; }
      let done = false;
      const end = (okv) => { if (done) return; done = true; voiceEl.removeEventListener('ended', onEnd); voiceEl.removeEventListener('error', onErr); clearTimeout(t); resolve(okv); };
      const onEnd = () => end(true);
      const onErr = () => end(false);
      const t = setTimeout(() => end(false), 9000);
      voiceEl.addEventListener('ended', onEnd);
      voiceEl.addEventListener('error', onErr);
      try { voiceEl.pause(); voiceEl.volume = 1; voiceEl.src = url; const p = voiceEl.play(); if (p && p.catch) p.catch(() => end(false)); } catch (_) { end(false); }
    });
  }

  // ── the page on screen ──
  let play = null;          // the round on screen
  let timers = [];
  let screen = 0;           // bumped by every leave(): an answer that arrives after the kid moved on draws nothing
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  function leave() {
    // every question answered but the round not handed in (× at the end, the back button, Android's back): it still
    // counts. The server grades it, and its answer is RECORDED here like the star screen's (review 2026-10-18: before,
    // a key-only phone's proof and a teacher's round were dropped, and an account's card 2 stayed «0 de 8»). (The
    // server's `done` list brings it back too when the page itself was closed before the answer came: worldsPage.)
    const P = play;
    if (P && !P.finished && P.results.filter((x) => x != null).length === P.R.questions.length) {
      try {
        fetch('/api/ruta/train/finish', { method: 'POST', credentials: 'same-origin', keepalive: true, headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ round: P.R.round }) })
          .then((r) => r.json().catch(() => null)).then((d) => { if (d && d.ok) { P.finished = true; recordResult(P, d); } }).catch(() => {});
      } catch (_) { /* an old phone: the round ends unsaved */ }
    }
    screen++;
    shown = null;
    stopVoice();
    timers.forEach(clearTimeout); timers = [];
    play = null;
    document.body.classList.remove('au-is-train', 'au-is-play');
    document.removeEventListener('keydown', onKey);
  }
  const fetchJson = (url, opts) => fetch(url, Object.assign({ credentials: 'same-origin', cache: 'no-store' }, opts || {}))
    .then((r) => r.json().catch(() => null).then((d) => ({ status: r.status, d })), () => ({ status: 0, d: null }));
  const post = (url, body) => fetchJson(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  function failBox(main, msg, retry) {
    main.innerHTML = '<p class="au-error">' + esc(msg) + '</p><p style="text-align:center"><button type="button" class="tr-btn tr-btn-red" id="tr-retry">Volver a intentar</button></p>';
    main.querySelector('#tr-retry').addEventListener('click', retry);
  }
  // the level's jewel colours (the same as its card on La Ruta Dorada)
  const LOOK = { yct: ['#a8352c', '#6c1513', '#360606'], newhsk: ['#24806b', '#0e4d43', '#04221d'], hsk: ['#3c5bb0', '#1b2f6b', '#0a1435'] };
  const lookStyle = (m) => { const l = LOOK[m.family] || LOOK.yct; return '--c1:' + l[0] + ';--c2:' + l[1] + ';--c3:' + l[2]; };
  // a world's coin: its number, a check (best ≥ the Dorado's %), Pinyin's letters, the exam sheet, or the lock
  function coinHtml(w, need) {
    if (!w.open) return '<span class="tr-coin is-closed" aria-hidden="true">' + I.lock + '</span>';
    if (w.kind === 'pinyin') return '<span class="tr-coin is-extra" aria-hidden="true">' + I.abc + '</span>';
    if (w.kind === 'simulacro') return '<span class="tr-coin is-extra" aria-hidden="true">' + I.exam + '</span>';
    return '<span class="tr-coin' + (w.best != null && w.best >= need ? ' is-done' : '') + '" aria-hidden="true">' + (w.best != null && w.best >= need ? I.check : '<b>' + w.n + '</b>') + '</span>';
  }

  // ── /audios/<level>/entrenamiento: the worlds ──
  // El Simulacro Dorado runs in class with the teacher (the route state's `solo: false`, a kid's view only)
  const inClass = (ctx) => !!(ctx && ctx.ruta && ctx.ruta.solo === false && !ctx.ruta.teacher);
  // the screen on screen that may redraw by itself (the worlds, or a world's start card; never a round): another tab
  // finished a round, or this tab comes back into view → asked again, redrawn only when something changed
  let shown = null;          // { kind: 'worlds' | 'start', main, ctx, m, key, sig }
  // quiet: a redraw in place (no «Cargando…», the scroll stays) and only when what shows changed
  function worldsPage(main, ctx, m, quiet) {
    document.body.classList.add('au-is-train');
    document.title = 'El Entrenamiento · ' + m.name + ' · Dralingo';
    if (!quiet) main.innerHTML = '<p class="au-loading">Cargando tus mundos…</p>';
    const at = location.pathname;
    const scr = screen;
    fetchJson('/api/ruta/train?level=' + encodeURIComponent(m.slug) + '&s=' + encodeURIComponent(sealRanges(ctx, m))).then(({ status, d }) => {
      if (location.pathname !== at || scr !== screen) return;
      if (status === 401) { location.reload(); return; }                 // the key was closed meanwhile: the key screen
      if (!d || !d.ok) { if (!quiet) failBox(main, 'No se pudieron cargar tus mundos. Revisa tu internet.', () => worldsPage(main, ctx, m)); return; }
      if (adoptDone(m.slug, d.done, d)) ping(m.slug, '');               // a round the page never heard about
      const sig = viewSig(d, m.slug);
      if (!(quiet && shown && shown.kind === 'worlds' && shown.sig === sig)) drawWorlds(main, ctx, m, d);
      shown = { kind: 'worlds', main, ctx, m, sig, at };
      // a kid logged in: what this phone practised before the login joins their account, then the page shows it
      if (d.student && d.who) syncScores(m.slug, d.who).then((r) => { if (r.sent && location.pathname === at && scr === screen) worldsPage(main, ctx, m, true); });
    });
  }
  // what a worlds view shows for this visitor: each world open or not and its best (server + this device)
  function viewSig(v, slug) {
    const mine = localBest(v, slug);
    return JSON.stringify([v.student, v.teacher, v.who, (v.worlds || []).map((w) => [w.key, w.open, w.best, mine[w.key]]), v.dorado && [v.dorado.open, v.dorado.pct]]);
  }
  function drawWorlds(main, ctx, m, v) {
    const need = (v.dorado && v.dorado.pct) || 70;
    const mine = localBest(v, m.slug);
    const worlds = v.worlds.map((w) => Object.assign({}, w, { best: w.best != null ? w.best : (mine[w.key] != null ? Number(mine[w.key]) : null) }));
    const regular = worlds.filter((w) => w.kind === 'world');
    const counted = regular.filter((w) => w.best != null && w.best >= need).length;
    const d = v.dorado || {};
    const base = m.base ? '/audios/' + m.base.id : '/audios/' + m.slug;
    // the Dorado meter: one coin per world that counts; gold once that world has the %
    let goal = '<section class="tr-goal" aria-labelledby="tr-goal-t">' +
      '<span class="tr-goal-cup" aria-hidden="true">' + I.trophy + '</span>' +
      '<div class="tr-goal-body"><h2 class="tr-goal-title" id="tr-goal-t">El Simulacro Dorado</h2>';
    // (2026-10-18) El Simulacro Dorado in class (server.js DORADO_SELF_SERVE off → the route's `solo: false`): the
    // teacher opens it with a PIN, so the meter says «tell your profe», never «open the simulations»
    // A teacher's device: the meter counts THEIR rounds kept here (what a kid sees), and they still open the simulations
    if (v.teacher) goal += '<p class="tr-goal-text">' + (counted >= regular.length && regular.length
      ? '¡Todos tus mundos tienen ' + need + ' % o más! Así se abre El Simulacro Dorado para tus alumnos.'
      : 'Para tus alumnos se abre cuando cada mundo tenga ' + need + ' % o más: <b>' + counted + ' de ' + regular.length + '</b>.') + '</p>' +
      '<a class="tr-goal-link" href="/audios/' + esc(m.slug) + '#paso-3" data-nav>Ver los simulacros' + I.next + '</a>';
    else if (inClass(ctx)) goal += counted >= regular.length && regular.length
      ? '<p class="tr-goal-text">¡Terminaste El Entrenamiento! Avísale a tu profe: ya puedes hacer El Simulacro Dorado en clase.</p>' +
        '<a class="tr-goal-link" href="/audios/' + esc(m.slug) + '#paso-3" data-nav>Avisarle a mi profe' + I.next + '</a>'
      : '<p class="tr-goal-text">Tu profe lo abre en clase cuando cada mundo tenga ' + need + ' % o más: <b>' + counted + ' de ' + regular.length + '</b>.</p>';
    else if (d.open && d.rule === 'practice') goal += '<p class="tr-goal-text">' + (d.via === 'practice' ? '¡Lo abriste practicando!' : '¡Está abierto para ti!') + '</p>' +
      '<a class="tr-goal-link" href="/audios/' + esc(m.slug) + '#paso-3" data-nav>Ver los simulacros' + I.next + '</a>';
    else if (d.rule === 'key' || d.open) goal += '<p class="tr-goal-text">Ya está abierto con tu clave.</p>';
    else goal += '<p class="tr-goal-text">Se abre cuando cada mundo tenga ' + need + ' % o más: <b>' + counted + ' de ' + regular.length + '</b>.</p>';
    goal += '<ol class="tr-goal-coins" aria-hidden="true">' + regular.map((w) => '<li class="' + (w.best != null && w.best >= need ? 'is-on' : '') + '">' +
      (w.best != null && w.best >= need ? I.check : w.n) + '</li>').join('') + '</ol>';
    if (d.login && !v.teacher) goal += '<p class="tr-goal-note">Tus puntos quedan en este teléfono. <a href="/homework.html?next=' + encodeURIComponent(location.pathname) + '">Entra con tu código</a> para que cuenten.</p>';
    if (v.teacher) goal += teacherNote();
    goal += '</div></section>';
    const rows = worlds.map((w) => {
      const st = starsOf(w.best, need);
      let href = '', state, go = '', cls = 'tr-world';
      if (w.open) {
        href = '/audios/' + m.slug + '/entrenamiento/' + w.key;
        // a world played shows its stars and best %; at the % goal (a regular world) it turns green with a ✓
        const done = w.kind === 'world' && w.best != null && w.best >= need;
        state = w.best == null ? (w.kind === 'pinyin' ? 'Abierto desde el inicio' : 'Tu primera ronda te espera') : starRow(st) + '<span class="tr-best">' + w.best + ' %</span>' +
          (done ? '<span class="tr-ok">' + I.check + 'Listo</span>' : '');
        go = '<span class="tr-go">' + (w.best == null ? 'Jugar' : 'Otra vez') + '</span>';
        cls += ' is-open' + (w.kind !== 'world' ? ' is-' + w.kind : '') + (done ? ' is-done' : '');
      } else if (w.kind === 'simulacro') {
        state = 'Se abre cuando todos tus mundos estén listos';
        cls += ' is-closed is-simulacro';
      } else {
        const left = Math.max(0, (w.count || 0) - (w.sealed || 0));
        href = base + '#mundo-' + w.n;
        state = 'Pon «¡Me la sé!» en ' + (left === 1 ? 'la última palabra' : 'sus ' + left + ' palabras') + ' de La Base';
        go = '<span class="tr-go is-quiet">La Base</span>';
        cls += ' is-closed';
      }
      const label = (w.kind === 'world' ? 'Mundo ' + w.n + ', ' : '') + w.name + ': ' + (w.open ? (w.best == null ? 'listo para jugar' : 'tu mejor ' + w.best + ' %, ' + st + (st === 1 ? ' estrella' : ' estrellas') + (/ is-done/.test(cls) ? ', listo' : '')) : String(state).replace(/<[^>]+>/g, ''));
      const inner = coinHtml(w, need) + '<span class="tr-world-body" aria-hidden="true"><span class="tr-world-name">' + esc(w.name) + '</span>' +
        '<span class="tr-world-state">' + (/^</.test(state) ? state : esc(state)) + '</span></span>' + go;
      return '<li>' + (href ? '<a class="' + cls + '" href="' + esc(href) + '" data-nav aria-label="' + esc(label) + '">' + inner + '</a>'
        : '<div class="' + cls + '" role="group" aria-label="' + esc(label) + '">' + inner + '</div>') + '</li>';
    }).join('');
    const C = window.DralingoCast;
    const f = C ? C.pick(1)[0] : null;
    main.innerHTML = homeBack('<a class="au-back" data-nav href="/audios/' + esc(m.slug) + '">' + I.back + 'La Ruta de ' + esc(m.name) + '</a>') +
      '<section class="tr-head" style="' + lookStyle(m) + '">' +
        '<img class="tr-head-dragon" src="' + DRAGON.power + '" alt="" width="432" height="480" decoding="async">' +
        '<h1 class="tr-head-title">El Entrenamiento</h1>' +
        '<p class="tr-head-sub">' + esc(m.name) + ': rondas de 10 preguntas como en el examen, con audio.</p></section>' +
      goal +
      '<h2 class="au-h2 tr-h2">Tus mundos</h2><ol class="tr-worlds">' + rows + '</ol>' +
      (f ? '<div class="rd-friend"><img src="' + esc(C.pose(f, 'ruta')) + '" alt="" width="200" height="240" loading="lazy" decoding="async">' +
        '<p class="rd-bubble"><b>' + esc(C.name(f)) + '</b>' + esc(C.line(f, 'ruta')) + '</p></div>' : '');
  }

  // ── /audios/<level>/entrenamiento/<world>: start → round → end ──
  function worldPage(main, ctx, m, key, quiet) {
    document.body.classList.add('au-is-train');
    if (!quiet) main.innerHTML = '<p class="au-loading">Cargando…</p>';
    const at = location.pathname;
    const scr = screen;
    fetchJson('/api/ruta/train?level=' + encodeURIComponent(m.slug) + '&s=' + encodeURIComponent(sealRanges(ctx, m))).then(({ status, d }) => {
      if (location.pathname !== at || scr !== screen || play) return;
      if (status === 401) { location.reload(); return; }
      if (!d || !d.ok) { if (!quiet) failBox(main, 'No se pudo cargar este mundo. Revisa tu internet.', () => worldPage(main, ctx, m, key)); return; }
      if (d.student && d.who) syncScores(m.slug, d.who);
      if (adoptDone(m.slug, d.done, d)) ping(m.slug, '');
      const w = (d.worlds || []).find((x) => x.key === key);
      if (!w) { history.replaceState(null, '', '/audios/' + m.slug + '/entrenamiento'); worldsPage(main, ctx, m); return; }
      const mine = localBest(d, m.slug);
      if (w.best == null && mine[w.key] != null) w.best = Number(mine[w.key]);
      document.title = w.name + ' · El Entrenamiento · Dralingo';
      const sig = viewSig(d, m.slug);
      // (a quiet redraw never replaces a start card whose «¡A jugar!» was just tapped: the round is on its way)
      const going = main.querySelector('#tr-go[aria-busy]');
      if (!(quiet && (going || (shown && shown.kind === 'start' && shown.sig === sig)))) startCard(main, ctx, m, d, w);
      shown = { kind: 'start', main, ctx, m, key, sig, at };
    });
  }
  function startCard(main, ctx, m, v, w) {
    const need = (v.dorado && v.dorado.pct) || 70;
    const back = homeBack('<a class="au-back" data-nav href="/audios/' + esc(m.slug) + '/entrenamiento">' + I.back + 'Mis mundos</a>');
    const where = w.kind === 'world' ? 'Mundo ' + w.n + ' de ' + m.name : (w.kind === 'pinyin' ? 'Para empezar ' + m.name : 'El examen de ' + m.name);
    if (!w.open) {
      const base = m.base ? '/audios/' + m.base.id + (w.n ? '#mundo-' + w.n : '') : '/audios/' + m.slug;
      main.innerHTML = back + '<section class="tr-start is-closed" style="' + lookStyle(m) + '">' +
        '<img class="tr-start-dragon" src="' + DRAGON.wise + '" alt="" width="432" height="480" decoding="async">' +
        '<div class="tr-start-head"><h1 class="tr-start-title">' + esc(w.name) + '</h1><p class="tr-start-where">' + esc(where) + '</p></div>' +
        '<p class="tr-start-lock">' + I.lock + (w.kind === 'simulacro' ? 'Se abre cuando todos tus mundos estén listos.' : 'Se abre cuando pongas «¡Me la sé!» en todas sus palabras de La Base.') + '</p>' +
        (w.kind === 'simulacro' ? '' : '<a class="tr-btn tr-btn-red" href="' + esc(base) + '" data-nav>Ir a La Base</a>') + '</section>';
      return;
    }
    const st = starsOf(w.best, need);
    main.innerHTML = back + '<section class="tr-start" style="' + lookStyle(m) + '">' +
      '<img class="tr-start-dragon" src="' + DRAGON.hello + '" alt="" width="432" height="480" decoding="async" fetchpriority="high">' +
      '<div class="tr-start-head"><h1 class="tr-start-title">' + esc(w.name) + '</h1><p class="tr-start-where">' + esc(where) + '</p></div>' +
      '<ul class="tr-steps" aria-label="Cómo se juega">' +
        '<li><i aria-hidden="true">' + I.sound + '</i>Escucha</li>' +
        '<li><i aria-hidden="true">' + I.tap + '</i>Toca la respuesta</li>' +
        '<li><i aria-hidden="true">' + I.star + '</i>Gana estrellas</li></ul>' +
      (w.best != null ? '<p class="tr-start-best">Tu mejor ronda: ' + starRow(st) + '<b>' + w.best + ' %</b>' +
        (w.kind === 'world' && w.best >= need ? '<span class="tr-ok">' + I.check + 'Listo</span>' : '') + '</p>' : '') +
      '<button type="button" class="tr-btn tr-btn-gold tr-start-go" id="tr-go">' + I.play + '¡A jugar!</button>' +
      (w.kind === 'world' && (w.best == null || w.best < need) ? '<p class="tr-start-need">Con ' + need + ' % este mundo cuenta para El Simulacro Dorado.</p>' : '') +
      (v.teacher ? teacherNote('is-on-dark') : '') +
      '</section>';
    main.querySelector('#tr-go').addEventListener('click', () => { unlock(); startRound(main, ctx, m, v, w); });
  }
  function startRound(main, ctx, m, v, w) {
    const go = main.querySelector('#tr-go');
    if (go) { go.disabled = true; go.setAttribute('aria-busy', 'true'); go.lastChild.textContent = 'Preparando…'; }
    const at = screen;
    post('/api/ruta/train/round', { level: m.slug, world: w.key, s: sealRanges(ctx, m) }).then(({ status, d }) => {
      if (at !== screen) return;                                      // the kid left meanwhile: draw nothing
      if (status === 401) { location.reload(); return; }
      if (!d || !d.ok) {
        if (go) { go.disabled = false; go.removeAttribute('aria-busy'); go.lastChild.textContent = '¡A jugar!'; }
        const msg = (d && d.error) || (status === 0 ? 'Sin conexión. Revisa tu internet y toca otra vez.' : 'No se pudo empezar. Toca otra vez.');
        const card = main.querySelector('.tr-start');
        if (!card) return;
        let note = main.querySelector('.tr-start-error');
        if (!note) { note = document.createElement('p'); note.className = 'tr-start-error'; note.setAttribute('role', 'alert'); card.appendChild(note); }
        note.textContent = msg;
        return;
      }
      playRound(main, ctx, m, v, w, d);
    });
  }

  function onKey(e) {
    if (!play || e.altKey || e.ctrlKey || e.metaKey) return;
    if (/^[1-4]$/.test(e.key) && !play.locked) { const b = play.root.querySelectorAll('.tr-opt')[Number(e.key) - 1]; if (b) b.click(); }
    else if ((e.key === 'Enter' || e.key === ' ') && play.waiting && document.activeElement === document.body) { e.preventDefault(); nextQuestion(); }
  }
  function playRound(main, ctx, m, v, w, R) {
    timers.forEach(clearTimeout); timers = [];
    shown = null;                                                     // (a round: nothing redraws by itself)
    document.body.classList.add('au-is-play');
    const C = window.DralingoCast;
    const friend = C ? C.pick(1)[0] : null;
    play = { main, ctx, m, v, w, R, i: 0, results: [], streak: 0, best: 0, locked: false, waiting: false, friend, root: null, spk: null, autoTok: 0 };
    main.innerHTML = '<div class="tr-play" style="' + lookStyle(m) + '">' +
      '<div class="tr-bar">' +
        '<button type="button" class="tr-x" id="tr-x" aria-label="Salir de la ronda">' + I.close + '</button>' +
        '<ol class="tr-track" id="tr-track" aria-hidden="true">' + R.questions.map(() => '<li></li>').join('') + '</ol>' +
        '<span class="tr-streak" id="tr-streak" aria-hidden="true">' + I.flame + '<b>0</b></span>' +
        '<button type="button" class="tr-mute" id="tr-mute" aria-pressed="' + muted + '" aria-label="Sonidos">' + I.sound + '</button>' +
      '</div>' +
      '<p class="au-sr" id="tr-say" aria-live="polite"></p>' +
      '<div class="tr-stage" id="tr-stage"></div>' +
      '<div class="tr-feed" id="tr-feed" hidden></div></div>';
    play.root = main.querySelector('.tr-play');
    main.querySelector('#tr-x').addEventListener('click', () => {
      const answered = play ? play.results.filter((x) => x != null).length : 0;
      // every question answered: × shows the stars (the round counts) instead of throwing it away
      if (play && answered === R.questions.length) { stopVoice(); finishRound(); return; }
      if (answered && !confirm('¿Salir de la ronda? Esta ronda no se guarda.')) return;
      stopVoice();
      const to = '/audios/' + m.slug + '/entrenamiento';
      history.pushState(null, '', to);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    const mb = main.querySelector('#tr-mute');
    mb.classList.toggle('is-off', muted);
    mb.addEventListener('click', () => { muted = !muted; store.set('draly_train_sound', muted ? '0' : '1'); mb.setAttribute('aria-pressed', String(muted)); mb.classList.toggle('is-off', muted); if (muted) stopVoice(); });
    document.addEventListener('keydown', onKey);
    showQuestion();
  }
  const say = (t) => { const el = play && play.root.querySelector('#tr-say'); if (!el) return; el.textContent = ''; setTimeout(() => { el.textContent = t; }, 40); };
  const voiceUrl = (i, part) => '/api/ruta/train/voice/' + encodeURIComponent(play.R.round) + '/' + i + '/' + part;

  function showQuestion() {
    const P = play;
    const q = P.R.questions[P.i];
    P.locked = false; P.waiting = false;
    stopVoice();
    const feed = P.root.querySelector('#tr-feed');
    feed.hidden = true; feed.className = 'tr-feed';
    P.root.querySelectorAll('#tr-track li').forEach((li, k) => { li.classList.toggle('is-now', k === P.i); });
    const short = q.answers.every((a) => a.length <= 16);
    const stage = P.root.querySelector('#tr-stage');
    // the exam's own kinds (2026-10-18): a heard-only question shows a big «Escuchar» and no line (alt = its pinyin,
    // shown only when the sound fails), picture options are photos A B C, a ✓ / ✕ question has two big tiles
    const LETTERS = 'ABCD';
    const optHtml = (a, k) => {
      if (q.pics) {
        return '<button type="button" class="tr-opt is-pic" data-k="' + k + '" aria-label="Foto ' + LETTERS[k] + (q.alts && q.alts[k] ? ': ' + esc(q.alts[k]) : '') + '">' +
          '<span class="tr-opt-letter" aria-hidden="true">' + LETTERS[k] + '</span><img src="' + esc(q.pics[k]) + '" alt="" decoding="async"><span class="tr-opt-mark" aria-hidden="true"></span></button>';
      }
      if (q.tf) {
        const yes = k === 0;
        return '<button type="button" class="tr-opt is-tf ' + (yes ? 'is-yes' : 'is-no') + '" data-k="' + k + '">' +
          '<span class="tr-tf-icon" aria-hidden="true">' + (yes ? I.check : I.cross) + '</span><span class="tr-opt-text">' + esc((q.alts && q.alts[k]) || (yes ? 'Sí' : 'No')) + '</span>' +
          '<span class="tr-opt-mark" aria-hidden="true"></span></button>';
      }
      return '<button type="button" class="tr-opt" data-k="' + k + '"' + (q.pyAnswers ? ' lang="zh-Latn-pinyin"' : '') + '>' +
        '<span class="tr-opt-text">' + esc(a) + '</span><span class="tr-opt-mark" aria-hidden="true"></span></button>';
    };
    const optsCls = q.pics ? ' is-pics is-' + q.answers.length : q.tf ? ' is-tfs' : (short ? ' is-grid' : '') + (q.pyAnswers ? ' is-py' : '');
    stage.innerHTML = '<section class="tr-q' + (q.image ? ' has-pic' : '') + (q.listen ? ' is-listen' : '') + '">' +
        (q.image ? '<figure class="tr-pic"><img src="' + esc(q.image) + '" alt="" decoding="async"></figure>' : '') +
        '<div class="tr-ask">' +
          ((q.voice.ask || q.voice.opts) ? '<button type="button" class="tr-spk" id="tr-spk" aria-label="' + (q.listen ? 'Escuchar' : 'Escuchar otra vez') + '">' + I.sound + '</button>' : '') +
          '<h1 class="tr-text" tabindex="-1"><span class="au-sr">Pregunta ' + (P.i + 1) + ' de ' + P.R.total + ': </span>' + textHtml(q.text, q.py) + '</h1>' +
        '</div>' +
        (q.listen && q.alt ? '<p class="tr-alt" id="tr-alt" hidden>No se oye: lee «<span class="tr-py" lang="zh-Latn-pinyin">' + esc(q.alt) + '</span>»</p>' : '') +
      '</section>' +
      // the round's friend waits in the space between the question and the tiles (it shrinks away on a small screen
      // or a question with a picture: never in the way of a tile)
      (P.friend && window.DralingoCast && !q.image && !q.pics ? '<div class="tr-buddy" aria-hidden="true"><img src="' + esc(window.DralingoCast.pose(P.friend, 'hello')) + '" alt="" width="200" height="240" decoding="async"></div>' : '') +
      '<div class="tr-opts' + optsCls + '" role="group" aria-label="Respuestas">' + q.answers.map(optHtml).join('') + '</div>';
    P.spk = stage.querySelector('#tr-spk');
    if (P.spk) P.spk.addEventListener('click', () => speakQuestion(true));
    stage.querySelectorAll('.tr-opt').forEach((b) => b.addEventListener('click', () => choose(Number(b.dataset.k))));
    const h = stage.querySelector('.tr-text');
    if (P.i > 0 && h) { try { h.focus({ preventScroll: true }); } catch (_) {} }
    if (!calm() && stage.animate) {
      try { stage.animate([{ opacity: 0, transform: 'translate3d(18px,0,0)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.23,1,.32,1)' }); } catch (_) {}
    }
    // (a reading drill speaks only when the kid taps its speaker: the exam's reading part is read, not heard)
    if (!q.voice.tap) later(() => speakQuestion(false), calm() ? 150 : 320);
  }
  // the question's audio: the word / line it asks about, else its four options one by one (each tile lights up)
  function speakQuestion(again) {
    const P = play;
    if (!P || P.locked) return;
    const q = P.R.questions[P.i];
    // (sounds off: nothing plays by itself; a tap on the speaker still plays the line, or a heard-only question could
    // never be answered)
    if (muted && !again) return;
    stopVoice();
    const token = seqToken;
    const i = P.i;
    if (P.spk) P.spk.classList.add('is-on');
    const done = () => { if (P.spk && token === seqToken) P.spk.classList.remove('is-on'); };
    // (no sound came: the speaker goes away instead of looking broken; the question still plays. A heard-only question
    // keeps its speaker and shows its line instead: never stuck)
    const silent = () => {
      if (!P.spk || token !== seqToken) return;
      const alt = q.listen && P.root.querySelector('#tr-alt');
      if (alt) { alt.hidden = false; return; }
      P.spk.hidden = true; P.spk.closest('.tr-ask').classList.add('no-spk');
    };
    if (q.voice.ask) { voice(voiceUrl(i, 'ask')).then((okv) => { done(); if (!okv && token === seqToken) silent(); }); return; }
    if (!q.voice.opts) { done(); return; }
    const tiles = P.root.querySelectorAll('.tr-opt');
    let k = 0;
    const step = () => {
      if (token !== seqToken || !play || play !== P || P.i !== i || P.locked) return;
      tiles.forEach((t) => reading(t, false));
      if (k >= tiles.length) { done(); return; }
      reading(tiles[k], true);
      voice(voiceUrl(i, 'o' + k)).then((okv) => {
        if (token !== seqToken) return;
        if (!okv && k === 0) { tiles.forEach((t) => reading(t, false)); done(); silent(); return; }
        k++;
        later(step, 260);
      });
    };
    step();
  }

  function choose(k) {
    const P = play;
    if (!P || P.locked) return;
    P.locked = true;
    stopVoice();
    const q = P.R.questions[P.i];
    const tiles = [...P.root.querySelectorAll('.tr-opt')];
    const chosen = q.answers[k];
    tiles[k].classList.add('is-picked');
    tiles.forEach((t) => { t.disabled = true; });
    const send = (tries) => post('/api/ruta/train/answer', { round: P.R.round, i: q.i, chosen }).then(({ status, d }) => {
      if (play !== P) return;
      // (an earlier answer to this question already counted, e.g. its reply was lost: show THAT one)
      if (d && d.ok) { const first = d.again && d.chosen != null ? q.answers.indexOf(d.chosen) : -1; reveal(first >= 0 ? first : k, d); return; }
      // the round is over or no longer this phone's (it ended, «Salir», another login): start a fresh one
      if (status === 410 || status === 403 || status === 409) { gone(); return; }
      if (status === 401) { location.reload(); return; }
      if ((status === 0 || status >= 500 || status === 429) && tries < 2) { later(() => send(tries + 1), 900 * (tries + 1)); return; }
      // never stuck: the tiles come back, a plain line says what to do
      tiles.forEach((t) => { t.disabled = false; t.classList.remove('is-picked'); });
      P.locked = false;
      say('Sin conexión. Toca otra vez tu respuesta.');
      showFeed('is-net', DRAGON.wise, 'Sin conexión', 'Revisa tu internet y toca otra vez tu respuesta.', false);
    });
    send(0);
  }
  function reveal(k, d) {
    const P = play;
    const q = P.R.questions[P.i];
    const tiles = [...P.root.querySelectorAll('.tr-opt')];
    const right = d.correct === true;
    const ek = q.answers.indexOf(d.expected);
    tiles.forEach((t, j) => {
      t.classList.remove('is-picked');
      if (j === k) t.classList.add(right ? 'is-right' : 'is-wrong');
      else if (j === ek) t.classList.add('is-right', 'is-shown');
      else t.classList.add('is-out');
      const mark = t.querySelector('.tr-opt-mark');
      if (mark) mark.innerHTML = (j === k && !right) ? I.cross : (j === ek || (j === k && right)) ? I.check : '';
    });
    P.results[P.i] = right;
    const li = P.root.querySelectorAll('#tr-track li')[P.i];
    if (li) li.classList.add(right ? 'is-ok' : 'is-bad');
    P.streak = right ? P.streak + 1 : 0;
    P.best = Math.max(P.best, P.streak);
    const chip = P.root.querySelector('#tr-streak');
    chip.querySelector('b').textContent = String(P.streak);
    chip.classList.toggle('is-on', P.streak >= 2);
    const moment = right && STREAKS.includes(P.streak);
    if (moment && chip.animate && !calm()) {
      try { chip.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.32) rotate(-6deg)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.23,1,.32,1)' }); } catch (_) {}
    }
    if (!calm() && tiles[k].animate) {
      try {
        if (right) tiles[k].animate([{ transform: 'scale(.97)' }, { transform: 'scale(1.035)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'cubic-bezier(.23,1,.32,1)' });
        else tiles[k].animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-3px)' }, { transform: 'none' }], { duration: 300, easing: 'ease-out' });
      } catch (_) {}
    }
    sfx(right ? (moment ? 'streak' : 'right') : 'wrong');
    const C = window.DralingoCast;
    const last = P.i >= P.R.questions.length - 1;
    const answerHtml = '«' + (q.pyAnswers ? '<span class="tr-py" lang="zh-Latn-pinyin">' + esc(d.expected) + '</span>' : esc(d.expected)) + '»';
    // an exam drill says what its line was, now that it is answered: «Oíste «mao»: gato» (a reading drill: «mao»: gato)
    const shownHtml = d.show && d.show.py ? (q.listen ? 'Oíste ' : '') + '«<span class="tr-py" lang="zh-Latn-pinyin">' + esc(d.show.py) + '</span>»' + (d.show.es ? ': ' + esc(d.show.es) : '') : '';
    const shownText = d.show && d.show.py ? (q.listen ? 'Oíste ' : '') + d.show.py + (d.show.es ? ': ' + d.show.es : '') : '';
    // (a picture or ✓ / ✕ answer is named by its tile: the green photo, «Sí» / «No»)
    const expLabel = q.alts && ek >= 0 ? q.alts[ek] : d.expected;
    if (right) {
      // Dralingo or one of the gang, a different one now and then («alive, randomized, not overdone»)
      const useFriend = C && P.friend && (moment || Math.random() < 0.35) && !shownHtml;
      const pose = useFriend ? C.pose(P.friend, 'win') : DRAGON.power;
      const title = moment ? '¡' + P.streak + ' seguidas!' : pick1(RIGHT_WORDS);
      const line = useFriend ? C.name(P.friend) + ': ' + C.line(P.friend, 'win') : '';
      say(title + (line ? ' ' + line : '') + (shownText ? ' ' + shownText : ''));
      if (shownHtml) showFeed(moment ? 'is-right is-streak' : 'is-right', pose, title, shownHtml, true, last, true);
      else showFeed(moment ? 'is-right is-streak' : 'is-right', pose, title, line, true, last);
    } else {
      const useFriend = C && P.friend && Math.random() < 0.5;
      const pose = useFriend ? C.pose(P.friend, 'oops') : DRAGON.wise;
      const title = pick1(['¡Uy!', 'Casi', 'Esta no era']);
      const was = q.pics ? 'Era la foto ' + 'ABCD'[ek] : q.tf ? 'Era «' + esc(expLabel) + '»' : 'Era ' + answerHtml;
      say(title + '. ' + (q.pics ? 'Era la foto ' + 'ABCD'[ek] : 'Era ' + expLabel) + (shownText ? '. ' + shownText : ''));
      showFeed('is-wrong', pose, title, was + (shownHtml ? '. ' + shownHtml : ''), true, last, true);
    }
    // the tiles stay in sight above the sheet, the lower of the one tapped and the right one included (a small phone
    // scrolls a little; the tiles keep the sheet's height as scroll margin)
    const lower = [tiles[k], tiles[ek >= 0 ? ek : k]].sort((x, y) => y.getBoundingClientRect().top - x.getBoundingClientRect().top)[0];
    if (lower && lower.scrollIntoView) { try { lower.scrollIntoView({ block: 'nearest', behavior: calm() ? 'auto' : 'smooth' }); } catch (_) {} }
    // what it says once answered: the right answer, the sentence with its blank filled, the reply
    let waitAudio = Promise.resolve();
    if (d.after && !muted) waitAudio = new Promise((res) => later(() => { voice(voiceUrl(q.i, 'after')).then(res); }, right ? 380 : 520));
    // a right answer moves on by itself once its audio has played (never cut mid-word; 8 s at most); a wrong one
    // waits for «Siguiente» (time to see and hear the right one)
    if (right) {
      const token = ++P.autoTok;
      const step = P.i;
      Promise.race([waitAudio, new Promise((res) => later(res, 8000))]).then(() => {
        later(() => { if (play === P && P.i === step && P.waiting && P.autoTok === token) nextQuestion(); }, muted || !d.after ? 1100 : 600);
      });
    }
  }
  // the sheet at the bottom: who reacts, a few words, the big «Siguiente» (never covering the answer tiles: it slides
  // up below them and the page leaves room for it)
  function showFeed(kind, pose, title, lineHtml, withNext, last, lineIsHtml) {
    const P = play;
    const feed = P.root.querySelector('#tr-feed');
    feed.className = 'tr-feed ' + kind;
    feed.innerHTML = '<img class="tr-feed-pose" src="' + esc(pose) + '" alt="" width="200" height="240" decoding="async">' +
      '<div class="tr-feed-words"><p class="tr-feed-title">' + esc(title) + '</p>' + (lineHtml ? '<p class="tr-feed-line">' + (lineIsHtml ? lineHtml : esc(lineHtml)) + '</p>' : '') + '</div>' +
      (withNext ? '<button type="button" class="tr-btn ' + (kind.indexOf('is-wrong') >= 0 ? 'tr-btn-red' : 'tr-btn-green') + ' tr-next" id="tr-next">' + (last ? 'Ver mis estrellas' : 'Siguiente') + I.next + '</button>' : '');
    feed.hidden = false;
    if (withNext) {
      P.waiting = true;
      const nb = feed.querySelector('#tr-next');
      nb.addEventListener('click', () => nextQuestion());
      try { nb.focus({ preventScroll: true }); } catch (_) {}
    }
  }
  function nextQuestion() {
    const P = play;
    if (!P || !P.waiting) return;
    P.waiting = false;
    P.autoTok = (P.autoTok || 0) + 1;
    if (P.i >= P.R.questions.length - 1) { finishRound(); return; }
    P.i += 1;
    showQuestion();
  }
  function gone() {
    const P = play;
    if (!P) return;
    stopVoice();
    P.main.innerHTML = '<section class="tr-end is-gone"><img class="tr-end-pose" src="' + DRAGON.wise + '" alt="" width="432" height="480">' +
      '<h1 class="tr-end-title">Esta ronda ya terminó</h1><p class="tr-end-count">Empieza otra: ¡son solo 10 preguntas!</p>' +
      '<div class="tr-end-acts"><button type="button" class="tr-btn tr-btn-red" id="tr-again">' + I.again + 'Otra ronda</button></div></section>';
    document.body.classList.remove('au-is-play');
    P.main.querySelector('#tr-again').addEventListener('click', () => { unlock(); const m = P.m; startAgain(P.main, P.ctx, m, P.v, P.w); });
  }
  function startAgain(main, ctx, m, v, w) {
    shown = null;
    main.innerHTML = '<p class="au-loading">Preparando otra ronda…</p>';
    play = null;                                                      // the round on screen is over
    const at = screen;
    post('/api/ruta/train/round', { level: m.slug, world: w.key, s: sealRanges(ctx, m) }).then(({ status, d }) => {
      if (at !== screen) return;                                      // the kid left meanwhile: draw nothing
      if (status === 401) { location.reload(); return; }
      if (!d || !d.ok) { failBox(main, (d && d.error) || 'No se pudo empezar otra ronda. Revisa tu internet.', () => startAgain(main, ctx, m, v, w)); return; }
      playRound(main, ctx, m, v, w, d);
    });
  }
  function finishRound() {
    const P = play;
    if (!P || P.finishing) return;
    P.finishing = true;
    stopVoice();
    const send = (tries) => post('/api/ruta/train/finish', { round: P.R.round }).then(({ status, d }) => {
      // the result is recorded even when the kid already left (back during a slow «Ver mis estrellas»): only the
      // star screen needs the round on screen
      if (d && d.ok) {
        P.finished = true; recordResult(P, d); if (play === P) endCard(d);
        if (d.coins && window.DralyCoins) window.DralyCoins.pop(d.coins, { delay: 1600 });   // 🪙 +20 the goal reached (El Zoco)
        return;
      }
      if (play !== P) return;
      if (status === 410 || status === 403) { P.finished = true; gone(); return; }
      if (tries < 2) { later(() => send(tries + 1), 1000 * (tries + 1)); return; }
      P.finishing = false;
      showFeed('is-net', DRAGON.wise, 'Sin conexión', 'Revisa tu internet y toca «Ver mis estrellas» otra vez.', true, true);
    });
    send(0);
  }
  // ── a round's result, recorded ONCE wherever the round ends (review 2026-10-18: a kid who answered all 10 and pressed
  // back, or left while «Ver mis estrellas» was on its way on a slow Wi-Fi, lost it): its star screen, «×», the back
  // button (leave()'s keepalive), or an answer that came after the kid moved on. A key-only phone keeps its score and
  // proof, a teacher's device its own round, the page counts it (ctx.trained: card 2), other tabs hear it (ping), and the
  // screen on show (the worlds, a world's start card) redraws when the kid already left the round. → { best, beat }
  function recordResult(P, F) {
    if (!P || !F || !F.ok) return { best: null, beat: false };
    if (P.recorded) return P.recorded;
    const slug = P.m.slug, key = P.w.key;
    let best = F.best != null ? F.best : null;
    let beat = !!F.record;
    if (F.phone && F.proof) { const kept = keepScore(slug, key, F.pct, F.proof); best = kept.best; beat = kept.beat; }
    // a teacher's round: kept on this device only, for THIS teacher (never sent, never a kid's score), shown like a kid's
    if (F.teacher) { const kept = keepTeacher(slug, key, F.pct, P.v && P.v.tw); best = kept.best; beat = kept.beat; }
    P.recorded = { best, beat };
    if (best != null) {
      try { if (P.ctx && P.ctx.trained) P.ctx.trained(slug, key, best, { saved: !!F.saved, phone: !!F.phone, teacher: !!F.teacher, doradoNow: !!F.doradoNow }); } catch (_) {}
      ping(slug, key);
      if (play !== P) refreshShown();
    }
    return P.recorded;
  }
  // a finished round the page never heard about (the phone closed the page before the answer came): the server keeps its
  // result for that same phone or teacher for the round's hours (GET /api/ruta/train `done`), and it is kept here like a
  // star screen's (idempotent: the best stays the best, a proof is kept once). v = the train view (or the route's module).
  // → how many results it added (0 when this device already had them all: the caller pings other tabs only on news, so
  // two open tabs never keep asking each other)
  function adoptDone(slug, done, v) {
    if (!Array.isArray(done) || !done.length || !v) return 0;
    let n = 0;
    const snap = () => (store.get(MKEY(slug)) || '') + '|' + (store.get(TKEY(slug)) || '');
    const before = snap();
    done.slice(0, 40).forEach((x) => {
      const pct = Number(x && x.pct);
      if (!x || typeof x.world !== 'string' || !/^[a-z0-9-]{1,40}$/.test(x.world) || !Number.isFinite(pct) || pct < 0 || pct > 100) return;
      if (v.teacher) { keepTeacher(slug, x.world, pct, v.tw); n++; }
      else if (!v.student && typeof x.proof === 'string') { keepScore(slug, x.world, pct, x.proof); n++; }
    });
    return n && snap() !== before ? n : 0;
  }
  function endCard(F) {
    const P = play;
    const { m, v, w } = P;
    // (recorded already by finishRound; a direct call records it here)
    const { best, beat } = recordResult(P, F);
    const need = F.need || 70;
    const stars = F.stars || 0;
    const C = window.DralingoCast;
    const good = F.pct >= need;
    // the one who cheers: one of the gang with a line of the route, or Dralingo
    const f = P.friend;
    const pose = C && f ? C.pose(f, good ? 'win' : 'hello') : (good ? DRAGON.cheer : DRAGON.wise);
    const line = C && f ? C.line(f, 'ruta') : '';
    // the next open world after this one (Pinyin básico → world 1 → … → the Simulacro del examen)
    const list = (v.worlds || []).map((x) => (x.key === w.key && best != null ? Object.assign({}, x, { best: Math.max(best, x.best == null ? 0 : x.best) }) : x));
    const at = list.findIndex((x) => x.key === w.key);
    const nextW = list.slice(at + 1).find((x) => x.open) || null;
    const record = beat;
    // what this round changed on the route, in one line: this world counts now (green, with its ✓), or how many more
    // right answers it needs. (A teacher's list: their own rounds on this device; the view was drawn before this round.)
    const mineNow = localBest(v, m.slug);
    const listed = list.map((x) => (x.best == null && mineNow[x.key] != null ? Object.assign({}, x, { best: Number(mineNow[x.key]) }) : x));
    const regular = listed.filter((x) => x.kind === 'world');
    const counted = regular.filter((x) => x.best != null && x.best >= need).length;
    const missing = Math.max(0, Math.ceil((need * F.total) / 100) - F.right);
    const nowDone = w.kind === 'world' && best != null && best >= need;
    let change = '';
    if (w.kind === 'world') {
      change = good ? I.check + '<span>¡' + esc(w.name) + ' cuenta para El Simulacro Dorado! ' + counted + ' de ' + regular.length + ' mundos.</span>'
        : nowDone ? I.check + '<span>' + esc(w.name) + ' ya cuenta: tu mejor ronda tiene ' + best + ' %. ' + counted + ' de ' + regular.length + ' mundos.</span>'
          : '<span>' + (missing === 1 ? 'Con 1 bien más llegas al ' : 'Con ' + missing + ' bien más llegas al ') + need + ' %, y este mundo cuenta para El Simulacro Dorado.</span>';
    }
    document.body.classList.remove('au-is-play');
    P.main.innerHTML = homeBack('<a class="au-back" data-nav href="/audios/' + esc(m.slug) + '/entrenamiento">' + I.back + 'Mis mundos</a>') +
      '<section class="tr-end" style="' + lookStyle(m) + '" aria-labelledby="tr-end-t">' +
        '<div class="tr-end-stars" aria-hidden="true">' + [0, 1, 2].map((k) => '<i class="tr-end-star' + (k < stars ? ' is-on' : '') + '">' + I.star + '</i>').join('') + '</div>' +
        '<h1 class="tr-end-title" id="tr-end-t"><span class="tr-end-pct"><b id="tr-pct">' + F.pct + '</b> %</span>' +
          '<span class="au-sr">, ' + stars + (stars === 1 ? ' estrella' : ' estrellas') + '</span></h1>' +
        '<p class="tr-end-count">' + esc(w.name) + ': ' + F.right + ' de ' + F.total + ' bien' + (P.best >= 3 ? ', ' + P.best + ' seguidas' : '') + '</p>' +
        (record && best != null ? '<p class="tr-record">' + I.trophy + '¡Nuevo récord!</p>' : (best != null && best > F.pct ? '<p class="tr-end-best">Tu mejor ronda: ' + best + ' %</p>' : '')) +
        (F.doradoNow ? '<a class="tr-dorado" href="/audios/' + esc(m.slug) + '#paso-3" data-nav><span class="tr-dorado-cup" aria-hidden="true">' + I.trophy + '</span>' +
          (inClass(P.ctx) ? '<span><b>¡Terminaste El Entrenamiento!</b><span>Todos tus mundos tienen ' + need + ' % o más. Avísale a tu profe: ya puedes hacer El Simulacro Dorado.</span></span></a>'
            : '<span><b>¡Abriste El Simulacro Dorado!</b><span>Todos tus mundos tienen ' + need + ' % o más.</span></span></a>')
          : (change ? '<p class="tr-end-change' + (good || nowDone ? ' is-done' : '') + '">' + change + '</p>' : '')) +
        // the gold button is what comes next: another round below the %, the next world once this one counts; right
        // under the score, so a small phone shows it without scrolling
        '<div class="tr-end-acts' + (good && nextW ? ' is-next' : '') + '">' +
          '<button type="button" class="tr-btn ' + (good && nextW ? 'tr-btn-ghost' : 'tr-btn-gold') + '" id="tr-again">' + I.again + 'Otra ronda</button>' +
          (nextW ? '<a class="tr-btn ' + (good ? 'tr-btn-gold' : 'tr-btn-ghost') + '" href="/audios/' + esc(m.slug) + '/entrenamiento/' + esc(nextW.key) + '" data-nav>Siguiente mundo' + I.next + '</a>'
            : '<a class="tr-btn tr-btn-ghost" href="/audios/' + esc(m.slug) + '/entrenamiento" data-nav>Mis mundos</a>') +
        '</div>' +
        (F.phone ? '<p class="tr-end-phone">Tus puntos quedan en este teléfono. <a href="/homework.html?next=' + encodeURIComponent('/audios/' + m.slug + '/entrenamiento') + '">Entra con tu código</a> para guardarlos en tu cuenta.</p>' : '') +
        (F.teacher ? teacherNote() : '') +
        '<div class="tr-end-cast"><img src="' + pose + '" alt="" width="432" height="480" decoding="async">' +
          (line ? '<p class="rd-bubble"><b>' + esc(C.name(f)) + '</b>' + esc(line) + '</p>' : '') + '</div>' +
        '</section>';
    const again = P.main.querySelector('#tr-again');
    again.addEventListener('click', () => { unlock(); startAgain(P.main, P.ctx, m, Object.assign({}, v, { worlds: list }), Object.assign({}, w, { best })); });
    const primary = P.main.querySelector('.tr-end-acts .tr-btn-gold') || again;
    try { primary.focus({ preventScroll: true }); } catch (_) {}
    window.scrollTo(0, 0);
    // the one moment of the round: the stars land one by one, the % counts up (a still screen with reduced motion)
    const starsEls = P.main.querySelectorAll('.tr-end-star.is-on');
    if (!calm() && starsEls.length && starsEls[0].animate) {
      starsEls.forEach((s, k) => {
        try { s.animate([{ transform: 'scale(.4) rotate(-30deg)', opacity: 0 }, { transform: 'scale(1.18) rotate(6deg)', opacity: 1, offset: 0.65 }, { transform: 'none', opacity: 1 }],
          { duration: 520, delay: 260 + k * 220, easing: 'cubic-bezier(.23,1,.32,1)', fill: 'backwards' }); } catch (_) {}
        later(() => sfx('star'), 260 + k * 220);
      });
      const el = P.main.querySelector('#tr-pct');
      const t0 = performance.now();
      const tick = (t) => { const p = Math.min(1, (t - t0) / 700); el.textContent = String(Math.round(F.pct * (1 - Math.pow(1 - p, 3)))); if (p < 1 && play === P) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }
    if (good || F.doradoNow) later(() => sfx('win'), calm() ? 0 : 260 + starsEls.length * 220 + 200);
  }

  // ── no stale screen (2026-10-18): another tab finished a round (its ping, a teacher's or a phone's scores), or this
  // tab comes back into view → the worlds / the start card ask again and redraw in place when something changed
  // (never during a round or over its stars)
  function refreshShown() {
    const s = shown;
    if (!s || play || s.at !== location.pathname) return;
    if (s.kind === 'worlds') worldsPage(s.main, s.ctx, s.m, true);
    else if (s.kind === 'start') worldPage(s.main, s.ctx, s.m, s.key, true);
  }
  window.addEventListener('storage', (e) => { if (e.key && /^draly_train_(?!sound$)/.test(e.key)) refreshShown(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshShown(); });
  window.addEventListener('pageshow', (e) => { if (e.persisted) refreshShown(); });

  // ── the router's entry (js/audios.js) ──
  function render(main, ctx, m, key) {
    leave();
    if (key) worldPage(main, ctx, m, key); else worldsPage(main, ctx, m);
  }
  window.Entrenamiento = { render, leave, syncScores, phoneBest, teacherBest, localBest, adoptDone, sealRanges, starsOf, TEACHER_NOTE,
    _keepTeacher: keepTeacher, _recordResult: recordResult };
})();
