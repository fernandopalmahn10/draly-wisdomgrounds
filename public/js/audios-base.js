// =========================================================================
// audios-base.js · «La base · Empieza aquí» (/audios/<level>-base)
// =========================================================================
// A level's study book («YCT 1 · Vocabulario», «HSK 1 · Vocabulario»…),
// digitally, one page code for every level. Data: the base.json that
// scripts/audios-build.js writes from content/audios/<level>-base.json, itself
// exported from the book's own source (../study/lib/web.py <level>): same
// words, sentences, pictures and order as the PDF. Never hanzi on screen.
//   tap the picture   → the word        tap the sentence → the sentence
//   tap the seal      → «¡Me la sé!» stamped, saved on this phone
//                       (localStorage draly_base_<level>: travels with the
//                       move bridge to app.dralingo.app) and, for a kid
//                       logged in at /homework, on their account too
//                       (phase 3: any phone, their teacher sees it)
//   «Escuchar el mundo» → word, pause, sentence, next word… (stoppable)
// One <audio> element (shared with audios.js) plays everything: one sound at a
// time. audios.js calls AudiosBase.render() / AudiosBase.leave().
// =========================================================================
(function () {
  'use strict';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const KEY = (level) => 'draly_base_' + level;

  const SPK = '<svg class="bs-spk" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 9.5v5h3.5L12 19V5L7.5 9.5H4z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
  const BARS = '<span class="bs-bars" aria-hidden="true"><i></i><i></i><i></i></span>';
  const ICON = {
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="5,12.5 10,17.5 19,7" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
    stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19.5h14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5.5" r="2.6" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="6" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="18" cy="18.5" r="2.6" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M8.3 10.8l7.4-4M8.3 13.2l7.4 4" stroke="currentColor" stroke-width="2.2"/></svg>',
    arrow: '<svg viewBox="0 0 24 12" class="arr" aria-hidden="true"><path d="M1 6h19M15 1.5 20.5 6 15 10.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  const DRAGON = { hello: '/assets/dralingo/hello.webp', wise: '/assets/dralingo/wise.webp', power: '/assets/dralingo/power.webp' };

  // ── saved seals (one small JSON per level) ─────────────────────────
  // { v: 1, seals: [n…], last, who?, pend? }: who + pend since phase 3 (below)
  function readObj(level) {
    try { const o = JSON.parse(localStorage.getItem(KEY(level)) || 'null'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (_) { return {}; }
  }
  function writeObj(level, o) { try { localStorage.setItem(KEY(level), JSON.stringify(o)); } catch (_) {} }
  const ints = (a) => (Array.isArray(a) ? a.filter((n) => Number.isInteger(n) && n > 0) : []);
  const sorted = (set) => [...set].sort((a, b) => a - b);
  function readSeals(level) { return new Set(ints(readObj(level).seals)); }
  // last: the word stamped most recently («Seguir» continues from its world, not from world 1)
  function readLast(level) { const o = readObj(level); return Number.isInteger(o.last) ? o.last : 0; }
  // change: { n, on } = a tap, kept as a change to save on the kid's account (pend) until the server has it
  function writeSeals(level, set, last, change) {
    const o = readObj(level);
    o.v = 1;
    o.seals = sorted(set);
    o.last = last || 0;
    // (a phone nobody is logged in on, that never held an account: nothing to save for anyone, the seals are its own)
    if (change && (o.who || !sync[level] || sync[level].mode !== 'device')) {
      const p = o.pend && typeof o.pend === 'object' ? o.pend : {};
      p[change.n] = change.on ? 1 : 0;
      o.pend = p;
    }
    writeObj(level, o);
  }

  // ── the seals on the kid's account (La Ruta Dorada, phase 3 · 2026-10-16) ──
  // A logged-in kid (the /homework session): every stamp and unstamp is saved on their record too (batched, retried
  // while the phone is offline), so La Base shows the same seals on any phone and their teacher sees them. This phone
  // keeps a mirror in draly_base_<level>:
  //   who  = whose account the mirror holds (an opaque id from the server, never the kid's code)
  //   pend = changes not saved yet: { <word number>: 1 stamped | 0 unstamped }
  //   held = another kid's changes not saved yet, kept for their next login on this phone: { <who>: pend }
  // The first time a phone meets the kid's account, the seals it holds from before the login join the account (a
  // union; unstamps made before that are not carried). A phone holding another kid's mirror (a sibling) takes this
  // kid's seals instead and never mixes them: every save names its `who`, and the server refuses (409) a save whose
  // `who` is not the logged-in kid. Nobody logged in (a key-only phone): the seals stay on the phone, as before; a mirror
  // whose login ended keeps its changes for that kid's next login. Server: /api/ruta/seals (server.js,
  // core/ruta-progress.js).
  const sync = {};   // level → { mode: 'account' | 'device' | null, max, timer, busy, again, tries, onChange, sent, syncTimer, syncTries }
  const MAX_TRIES = 8;   // then the page waits for the next visit, the next return to the tab or the connection coming back
  const applyPend = (set, pend) => { const s = new Set(set); Object.keys(pend || {}).forEach((k) => { if (pend[k]) s.add(+k); else s.delete(+k); }); return s; };
  const sameList = (a, b) => a.length === b.length && a.every((n, i) => n === b[i]);
  const pendOf = (o) => (o.pend && typeof o.pend === 'object' && !Array.isArray(o.pend) ? o.pend : {});
  function syncOf(level) {
    return sync[level] || (sync[level] = { mode: null, max: 0, timer: 0, busy: null, again: false, tries: 0, onChange: null, sent: false, syncTimer: 0, syncTries: 0 });
  }
  function later(level, ms) {
    const s = syncOf(level);
    clearTimeout(s.timer);
    s.timer = setTimeout(() => { s.timer = 0; flush(level); }, ms);
  }
  // only word numbers of this base travel (a stray entry would make the server refuse the whole batch)
  function cleanPend(level, o) {
    const s = syncOf(level);
    const p = pendOf(o);
    const okKey = (k) => /^\d{1,4}$/.test(k) && +k >= 1 && (!s.max || +k <= s.max);
    Object.keys(p).forEach((k) => { if (!okKey(k) || (p[k] !== 0 && p[k] !== 1)) delete p[k]; });
    return p;
  }
  // save the changes waiting on this phone. → a promise that settles when this round is done (never rejects)
  function flush(level) {
    const s = syncOf(level);
    if (s.mode !== 'account') return Promise.resolve();
    if (s.busy) { s.again = true; return s.busy; }
    clearTimeout(s.timer); s.timer = 0;
    const cur = readObj(level);
    const pend = cleanPend(level, cur);
    cur.pend = pend;
    writeObj(level, cur);
    const sent = Object.assign({}, pend);
    const keys = Object.keys(sent);
    if (!keys.length) return Promise.resolve();
    const add = keys.filter((k) => sent[k]).map(Number);
    const remove = keys.filter((k) => !sent[k]).map(Number);
    s.busy = fetch('/api/ruta/seals', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level, add, remove, who: cur.who || null }),
    }).then((r) => r.json().catch(() => null).then((d) => ({ status: r.status, d })), () => ({ status: 0, d: null }))
      .then(({ status, d }) => {
        s.busy = null;
        const o = readObj(level);
        const p = pendOf(o);
        if (d && d.ok && Array.isArray(d.seals)) {
          s.tries = 0;
          s.sent = true;
          Object.keys(sent).forEach((k) => { if (p[k] === sent[k]) delete p[k]; });   // a newer tap on the same word stays
          const before = ints(o.seals);
          o.pend = p;
          if (d.who) o.who = d.who;
          o.seals = sorted(applyPend(ints(d.seals), p));
          writeObj(level, o);
          if (!sameList(before, o.seals) && s.onChange) s.onChange(level);
          if (Object.keys(p).length || s.again) { s.again = false; later(level, 300); }
          return;
        }
        s.again = false;
        // another kid logged in on this phone meanwhile: never their account. Settle again (this kid's changes are
        // kept for their next login, the new kid's seals come in).
        if (status === 409) { s.mode = null; syncLevel(level); return; }
        // the login ended (12 h) or the level was closed: the changes wait on this phone for this kid's next login
        if (status === 401 || status === 403) { s.mode = 'device'; return; }
        // a word this level's base doesn't have (an old mirror): those changes are dropped, never retried forever
        if (status === 400 || status === 404) {
          Object.keys(sent).forEach((k) => { if (p[k] === sent[k]) delete p[k]; });
          o.pend = p;
          writeObj(level, o);
          return;
        }
        // offline, a busy server, too many at once: again a little later (2 s, 4 s, 8 s… up to a minute), a few times
        s.tries += 1;
        if (s.tries <= MAX_TRIES) later(level, Math.min(60000, 2000 * Math.pow(2, s.tries - 1)));
      });
    return s.busy;
  }
  // the mirror now holds `who`'s account (`acct` = its seals): what this phone holds for `who` goes up, a sibling's
  // unsaved changes are kept aside for them
  function settle(level, o, who, acct) {
    const s = syncOf(level);
    let pend;
    if (o.who === who) pend = pendOf(o);                       // the same kid: what waits goes up
    else if (!o.who) {                                         // the first time this phone meets the account: a union
      pend = {};
      ints(o.seals).forEach((n) => { if (!acct.has(n) && (!s.max || n <= s.max)) pend[n] = 1; });
    } else {                                                   // another kid's mirror: theirs waits for them, never mixed
      const held = o.held && typeof o.held === 'object' && !Array.isArray(o.held) ? o.held : {};
      const mine = pendOf(o);
      if (Object.keys(mine).length) held[o.who] = Object.assign({}, held[o.who] || {}, mine);
      pend = held[who] && typeof held[who] === 'object' ? held[who] : {};
      delete held[who];
      const ids = Object.keys(held);
      ids.slice(0, Math.max(0, ids.length - 4)).forEach((k) => { delete held[k]; });   // a family phone: 4 kids at most
      if (ids.length) o.held = held; else delete o.held;
    }
    o.v = 1;
    o.who = who;
    o.pend = pend;
    o.seals = sorted(applyPend(acct, pend));
  }
  // Ask the account (if a kid is logged in), settle the mirror, send what waits. max: the base's word count.
  // → Promise<{ account, who, changed, sent }> (changed: the mirror's seals changed; sent: the account was written)
  function syncLevel(level, max, onChange) {
    const s = syncOf(level);
    if (max) s.max = max;
    if (onChange) s.onChange = onChange;
    s.sent = false;
    clearTimeout(s.syncTimer); s.syncTimer = 0;
    return fetch('/api/ruta/seals?level=' + encodeURIComponent(level), { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null), () => null)
      .then((d) => {
        const o = readObj(level);
        const before = ints(o.seals);
        if (!d || !d.ok) {
          // offline, a busy class network or server trouble: the phone keeps what it has and asks again a little later
          // (and when the connection comes back); a locked level (401) simply stays on the phone
          if (s.mode !== 'device' && s.syncTries < MAX_TRIES) {
            s.syncTries += 1;
            s.syncTimer = setTimeout(() => { s.syncTimer = 0; syncLevel(level); }, Math.min(60000, 4000 * Math.pow(2, s.syncTries - 1)));
          }
          return { account: s.mode === 'account', who: o.who || null, changed: false, sent: false };
        }
        s.syncTries = 0;
        s.tries = 0;
        if (!d.student) {                        // a key on this phone, nobody logged in: the seals stay here
          s.mode = 'device';
          if (!o.who && o.pend) { delete o.pend; writeObj(level, o); }
          return { account: false, who: null, changed: false, sent: false };
        }
        s.mode = 'account';
        settle(level, o, d.who, new Set(ints(d.seals)));
        writeObj(level, o);
        const changed = !sameList(before, o.seals);
        if (changed && s.onChange) s.onChange(level);
        return flush(level).then(() => ({ account: true, who: d.who, changed, sent: s.sent }));
      });
  }
  // a tap: saved on the account a moment later (taps in a row travel together)
  function queueSave(level) { if (syncOf(level).mode === 'account') later(level, 1200); }
  // the connection is back: send what waits, or ask the account if the first look never got through
  window.addEventListener('online', () => Object.keys(sync).forEach((l) => {
    const s = sync[l];
    s.tries = 0;
    if (s.mode === 'account') flush(l);
    else if (s.mode === null) { s.syncTries = 0; syncLevel(l); }
  }));
  // the app closes or the kid leaves with taps not saved yet: they travel now (kept on the phone until a save is
  // confirmed, so they go again at the next visit if this one did not arrive)
  window.addEventListener('pagehide', () => Object.keys(sync).forEach((l) => {
    const s = sync[l];
    if (s.mode !== 'account' || s.busy) return;
    const o = readObj(l);
    const p = cleanPend(l, o);
    const keys = Object.keys(p);
    if (!keys.length) return;
    try {
      fetch('/api/ruta/seals', {
        method: 'POST', credentials: 'same-origin', keepalive: true, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: l, add: keys.filter((k) => p[k]).map(Number), remove: keys.filter((k) => !p[k]).map(Number), who: o.who || null }),
      }).catch(() => {});
    } catch (_) { /* an old phone: the next visit sends them */ }
  }));
  // back to a base left open (another tab, the phone's lock screen, a phone switched): the account may have seals from
  // another phone meanwhile; the page asks again (its onChange redraws). One small request per return, never a poll.
  function resync() {
    if (!active || !data || document.visibilityState !== 'visible') return;
    const s = sync[data.level];
    if (!s || s.mode === 'device') return;
    s.syncTries = 0;
    syncLevel(data.level, data.words.length);
  }
  document.addEventListener('visibilitychange', resync);
  window.addEventListener('pageshow', (e) => { if (e.persisted) resync(); });
  // whose account a phone's mirror holds, and its changes not saved yet (La Ruta Dorada, /homework)
  const mirrorWho = (level) => readObj(level).who || null;
  // first visit (no seal, no sound yet): the first card's speaker invites the first tap
  const HINT_KEY = 'draly_base_tapped';
  const tappedBefore = () => { try { return localStorage.getItem(HINT_KEY) === '1'; } catch (_) { return true; } };
  const markTapped = () => { try { localStorage.setItem(HINT_KEY, '1'); } catch (_) {} };

  // ── state of the page on screen ────────────────────────────────────
  let ctx = null;          // { main, player, say(text) } from audios.js
  let data = null;
  let root = null;
  let seals = new Set();
  let byN = new Map();     // word number → word
  let active = false;
  let playing = null;      // { els: [], onEnd }
  let seq = null;          // «Escuchar el mundo»: { w, list, i, step, timer }
  let io = null;
  let hintIo = null;
  let toastTimer = null;
  let lastWord = 0;        // the word stamped most recently
  let failShownAt = 0;     // «No se pudo escuchar» at most once a minute

  function render(main, d, c) {
    if (active) leave();                                   // never two pages' observers and listeners at once
    ctx = c;
    // tolerate a thinner data file (an older or another level's base): no section may throw
    d = Object.assign({ steps: [], parents: [], tones: [], toneNote: [], worlds: [], words: [] }, d);
    d.tones = d.tones.filter((t) => d.words.some((w) => w.n === t.word));
    data = d;
    active = true;
    byN = new Map(d.words.map((w) => [w.n, w]));
    seals = new Set([...readSeals(d.level)].filter((n) => byN.has(n)));   // only numbers of words on the page
    lastWord = byN.has(readLast(d.level)) ? readLast(d.level) : 0;
    document.title = 'La base · ' + d.levelName + ' · Dralingo';
    main.innerHTML = page(d);
    root = main.querySelector('.bs');
    root.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    ensureFloaters();
    update(false);
    watchWorlds();
    hintFirstTap();
    mediaInfo();
    // a logged-in kid: the seals of their account (any phone) replace this phone's, once settled (phase 3)
    const lvl = d.level;
    syncLevel(lvl, d.words.length, (changedLevel) => {
      if (!active || !data || data.level !== changedLevel) return;
      seals = new Set([...readSeals(changedLevel)].filter((n) => byN.has(n)));
      lastWord = byN.has(readLast(changedLevel)) ? readLast(changedLevel) : lastWord;
      update(false);
    });
    if (location.hash) {
      let target = null;
      try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (_) { target = null; }
      if (target) requestAnimationFrame(() => target.scrollIntoView());
    }
  }

  function leave() {
    if (!active) return;
    stopAll();
    active = false;
    if (data) flush(data.level);              // the route behind this page shows the account's seals: save the last taps now
    if (io) { io.disconnect(); io = null; }
    if (hintIo) { hintIo.disconnect(); hintIo = null; }
    document.removeEventListener('keydown', onKey);
    document.body.classList.remove('bs-has-now');
    ['bs-now', 'bs-toast'].forEach((id) => { const el = document.getElementById(id); if (el) el.remove(); });
    root = null;
  }

  // ── markup ─────────────────────────────────────────────────────────
  // The line under the tones, word for word as the level's book prints it (YCT 1: yī and gè; New HSK 1: yī and bù;
  // the HSK 1 book has none): {braces} are pinyin, and the examples that have a clip are buttons.
  function toneNote(d) {
    if (!d.toneNoteText) return '';
    const clips = new Map((d.toneNote || []).map((t) => [t.py, t]));
    const parts = String(d.toneNoteText).split(/\{([^}]+)\}/);
    let h = '';
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) { h += esc(parts[i]); continue; }
      const t = clips.get(parts[i]);
      if (!t) { h += '<span lang="zh-Latn-pinyin" translate="no">' + esc(parts[i]) + '</span>'; continue; }
      // a button keeps the punctuation after it on its line, glued to it («yí ge,» … «bú shì.»)
      const punct = (parts[i + 1] || '').match(/^[,.;:!?]*/)[0];
      if (punct) parts[i + 1] = parts[i + 1].slice(punct.length);
      h += '<span class="bs-chip-at"><button type="button" class="bs-chip" data-au="' + esc(t.au) + '" aria-label="Escuchar ' + esc(t.py) + '">' +
        SPK + BARS + '<span lang="zh-Latn-pinyin" translate="no">' + esc(t.py) + '</span></button>' + esc(punct) + '</span>';
    }
    return '<p class="bs-tones-note">' + h + '</p>';
  }
  // «New HSK 1» never breaks inside its name (the lede says «… de New HSK 1, con dibujos…»)
  const keepName = (text, name) => esc(text).split(esc(name)).join(esc(name).replace(/ /g, ' '));
  function meter(worlds, extraClass) {
    return '<div class="au-meter' + (extraClass || '') + '" aria-hidden="true">' +
      worlds.map((w) => '<i data-mw="' + w.n + '" style="--w:' + w.count + '"></i>').join('') + '</div>';
  }
  function page(d) {
    const W = d.worlds;
    const total = d.words.length;
    const hello = d.cover && d.cover.hello;   // «Nǐ hǎo!» on the cover, «Zàijiàn!» on the closing card (base.json)
    const bye = d.cover && d.cover.bye;
    const pdf = d.book ? '<a class="bs-btn bs-btn-line" href="' + esc(d.book.pdf) + '" download="' + esc(d.book.name) + '.pdf">' + ICON.down +
      '<span>Descargar el libro (PDF) <small>' + String(d.book.mb).replace('.', ',') + ' MB</small></span></a>' : '';
    let h = '<div class="bs">';
    // sticky thumb index
    // back: to the level's folder, or to /homework when the kid came from the portal (?from=homework; the home-screen app
    // has no browser back button). «← Volver» in words since 2026-10-18 (his rule: a clear way back on every screen)
    const back = ctx.from === 'homework'
      ? '<a class="dw-back dw-back--sm bs-bar-back" href="/homework" aria-label="Volver a mis tareas">Volver</a>'
      : '<a class="dw-back dw-back--sm bs-bar-back" href="/audios/' + esc(d.level) + '" data-nav aria-label="Volver a ' + esc(d.levelName) + '">Volver</a>';
    h += '<nav class="bs-bar" aria-label="Mundos de la base"><div class="bs-wrap">' + back +
      '<div class="bs-tabs">' + W.map((w) => '<a class="bs-tab" href="#mundo-' + w.n + '" data-tab="' + w.n + '" aria-label="Mundo ' + w.n + ': ' + esc(w.name) + '">' +
        '<span aria-hidden="true">' + w.n + '</span><span class="bs-tab-name" aria-hidden="true">' + esc(w.short) + '</span></a>').join('') + '</div>' +
      '<span class="bs-count" id="bs-count"><i aria-hidden="true">' + ICON.check + '</i><span><b>0</b>/' + total + '</span></span></div></nav>';
    // cover
    // a long level name («New HSK 1») takes a smaller title so it stays on one line, like the book's cover (t-level long)
    h += '<header class="bs-cover on-red" id="inicio"><div class="bs-wrap"><div class="bs-cover-top' + (String(d.levelName).length > 6 ? ' is-long' : '') + '">' +
      '<h1><span class="bs-level">' + esc(d.levelName) + '</span><span class="bs-name">' + esc(d.title) + '</span></h1>' +
      '<p class="bs-lede">' + keepName(d.lede, d.levelName) + '</p>' +
      '<img class="bs-dragon" src="' + DRAGON.hello + '" alt="Dralingo saluda" width="432" height="480" decoding="async">' +
      (hello ? '<button type="button" class="bs-bubble" data-au="' + esc(hello.au) + '" aria-label="Escuchar: ' + esc(hello.py) + '"><span lang="zh-Latn-pinyin" translate="no">' + esc(hello.py) + '</span></button>' : '') +
      '</div><div class="bs-cover-body">' +
        '<div class="bs-progress">' + meter(W) + '<p id="bs-cover-count"><b>0</b> de ' + total + ' sellos</p></div>' +
        '<div class="bs-actions"><a class="bs-btn bs-btn-gold" id="bs-go" href="#como-estudiar">' + ICON.play + '<span>Empezar</span></a>' + pdf + '</div>' +
        '<ol class="bs-index">' +
          '<li><a href="#como-estudiar"><b></b><span>Cómo estudiar y los tonos</span><em></em></a></li>' +
          W.map((w) => '<li><a href="#mundo-' + w.n + '"><b>' + w.n + '</b><span>' + esc(w.name) + '</span><em data-idx="' + w.n + '">0/' + w.count + '</em></a></li>').join('') +
          '<li><a href="#repaso"><b></b><span>Repaso</span><em></em></a></li>' +
        '</ol>' +
      '</div></div></header>';
    // cómo estudiar
    h += '<section class="bs-sec" id="como-estudiar" aria-labelledby="bs-h-como"><div class="bs-wrap"><div class="bs-intro-grid"><div>' +
      '<h2 class="bs-h2" id="bs-h-como">Cómo estudiar</h2><ol class="bs-steps">' +
      d.steps.map((s, i) => '<li><b aria-hidden="true">' + (i + 1) + '</b><span>' + esc(s) +
        (i === d.steps.length - 1 ? '<span class="bs-seal-demo" aria-hidden="true"><i class="empty"></i>' + ICON.arrow + '<i class="full">' + ICON.check + '</i></span>' : '') +
        '</span></li>').join('') + '</ol></div>' +
      '<div class="bs-wise"><img src="' + DRAGON.wise + '" alt="" width="432" height="480" loading="lazy" decoding="async"><p>Un poquito cada día.</p></div></div>' +
      '<aside class="bs-parents" aria-labelledby="bs-h-papas"><h3 id="bs-h-papas">Para papás y mamás</h3><ul>' +
      d.parents.map((p) => '<li>' + esc(p) + '</li>').join('') + '</ul></aside></div></section>';
    // los tonos
    h += '<section class="bs-sec" id="tonos" aria-labelledby="bs-h-tonos"><div class="bs-wrap">' +
      '<h2 class="bs-h2" id="bs-h-tonos">Los tonos</h2>' +
      '<p class="bs-lede2">La rayita sobre la vocal dice cómo suena la palabra. Toca cada tono para escucharlo.</p>' +
      '<ul class="bs-tones">' + d.tones.map((t) => {
        const w = byN.get(t.word);
        return '<li><button type="button" class="bs-tone" data-au="' + esc(w.au) + '" aria-label="' + esc(t.name + ', ' + t.how + ': ' + t.py + ', ' + t.es) + '. Escuchar">' +
          '<span class="bs-tone-mark">' + toneSvg(t.points) + '<span lang="zh-Latn-pinyin" translate="no">' + esc(t.mark) + '</span></span>' +
          '<span><span class="bs-tone-name">' + esc(t.name) + '</span><span class="bs-tone-how">' + esc(t.how) + '</span></span>' +
          '<img src="' + esc(w.pic) + '" alt="" width="400" height="400" loading="lazy" decoding="async">' +
          '<span class="bs-tone-word"><b lang="zh-Latn-pinyin" translate="no">' + esc(t.py) + '</b><small>' + esc(t.es) + '</small></span>' +
          '<span class="bs-mini bs-tone-spk">' + SPK + BARS + '</span></button></li>';
      }).join('') + '</ul>' +
      toneNote(d) + '</div></section>';
    // the worlds
    W.forEach((w) => {
      const words = d.words.filter((x) => x.world === w.n);
      const pics = w.pics.map((n) => byN.get(n)).filter(Boolean);
      h += '<section class="bs-world" id="mundo-' + w.n + '" data-world="' + w.n + '" aria-labelledby="bs-h-m' + w.n + '"><div class="bs-wrap">' +
        '<header class="bs-opener on-red">' +
          '<span class="bs-o-num" aria-hidden="true">' + w.n + '</span>' +
          '<h2 class="bs-o-name" id="bs-h-m' + w.n + '"><span class="au-sr">Mundo ' + w.n + ': </span>' + esc(w.name) + '</h2>' +
          '<p class="bs-o-count" data-oc="' + w.n + '">' + w.count + ' palabras</p>' +
          '<div class="bs-o-pics n' + pics.length + '" aria-hidden="true">' + pics.map((x) => '<img src="' + esc(x.pic) + '" alt="" width="400" height="400" loading="lazy" decoding="async">').join('') + '</div>' +
          meter([w]) +
          '<div class="bs-o-actions">' +
            '<button type="button" class="bs-btn bs-btn-gold" data-play-world="' + w.n + '">' + ICON.play + '<span>Escuchar el mundo</span></button>' +
            '<button type="button" class="bs-btn bs-btn-line bs-btn-icon" data-share="' + w.n + '" aria-label="Compartir el mundo ' + w.n + '">' + ICON.share + '<span class="bs-share-label">Compartir</span></button>' +
            HIDE_ES +
          '</div>' +
        '</header><div class="bs-grid">' + words.map(card).join('') + done(w, W[W.indexOf(w) + 1]) + '</div></div></section>';
    });
    // closing card + repaso
    h += '<div class="bs-wrap"><div class="bs-closing on-red" id="bs-closing">' +
      '<h2 id="bs-close-h">Después de las ' + total + ' palabras, el repaso</h2><p id="bs-close-p">Mira cada dibujo y di la palabra.</p>' +
      (bye ? '<button type="button" class="bs-bye" data-au="' + esc(bye.au) + '" aria-label="Escuchar: ' + esc(bye.py) + '"><span lang="zh-Latn-pinyin" translate="no">' + esc(bye.py) + '</span></button>' : '') +
      '<img src="' + DRAGON.hello + '" alt="" width="432" height="480" loading="lazy" decoding="async"></div></div>';
    h += '<section class="bs-sec" id="repaso" aria-labelledby="bs-h-repaso"><div class="bs-wrap">' +
      '<h2 class="bs-h2" id="bs-h-repaso">Repaso: ¿cómo se dice?</h2>' +
      '<p class="bs-lede2">Mira cada dibujo y di la palabra en Chino Mandarín. Toca el dibujo para ver la respuesta y escucharla.</p>' +
      '<div class="bs-rp-tools">' + HIDE_ES.replace('bs-toggle-red', '') +
      '<button type="button" class="bs-btn bs-btn-soft" id="bs-rp-reset" hidden>Tapar las respuestas</button></div>' +
      '<div class="bs-rp-grid" id="bs-rp-grid">' + d.words.map((w) =>
        (w.n === (W.find((x) => x.n === w.world) || {}).first
          ? '<p class="bs-rp-world"><b>' + w.world + '</b>' + esc((W.find((x) => x.n === w.world) || {}).name || '') + '</p>' : '') +
        '<button type="button" class="bs-rp" data-rp="' + w.n + '" aria-label="' + rpLabel(w, false) + '"><span aria-hidden="true">' + w.n + '</span>' +
        '<img src="' + esc(w.pic) + '" alt="" width="400" height="400" loading="lazy" decoding="async">' +
        '<b lang="zh-Latn-pinyin" translate="no" aria-hidden="true">' + esc(w.py) + '</b><em aria-hidden="true">' + esc(w.hint) + '</em></button>').join('') + '</div>' +
      '<p class="bs-rp-score" id="bs-rp-score">¿Cuántas te sabes? <b>0</b> de ' + total + '</p></div></section>';
    h += '<footer class="bs-end"><div class="bs-wrap">' +
      (d.book ? '<a class="bs-btn bs-btn-red" href="' + esc(d.book.pdf) + '" download="' + esc(d.book.name) + '.pdf">' + ICON.down +
        '<span>Descargar el libro <small>PDF · ' + d.book.pages + ' páginas</small></span></a>' : '') +
      '<a class="bs-btn bs-btn-soft" href="#inicio">Volver arriba</a></div></footer>';
    return h + '</div>';
  }

  // «Tapar el español» (the book's step 2: cover the Spanish): one state for the whole page, a switch in every world
  // opener and in the repaso; a tap on a card's picture shows that card's Spanish again
  const HIDE_ES = '<button type="button" class="bs-toggle bs-toggle-red" data-hide-es aria-pressed="false"><i aria-hidden="true"></i>Tapar el español</button>';

  // after a world's last card: shown once all its seals are stamped, with the way on
  function done(w, next) {
    return '<div class="bs-done on-red" data-done="' + w.n + '" hidden>' +
      '<img data-src="' + DRAGON.power + '" alt="" width="432" height="480">' +
      '<div><h3>¡Mundo ' + w.n + ' completo!</h3><p>Ya tienes los ' + w.count + ' sellos de ' + esc(w.name) + '. Este mundo ya está listo para El Entrenamiento.</p>' +
      (next ? '<a class="bs-btn bs-btn-gold" href="#mundo-' + next.n + '">' + ICON.play + '<span>Sigue: mundo ' + next.n + '</span></a>'
        : '<a class="bs-btn bs-btn-gold" href="#repaso">' + ICON.play + '<span>Ir al repaso</span></a>') +
      '</div></div>';
  }

  function card(w) {
    const pyLong = w.py.length > 9 ? ' long' : '';
    const esLong = w.es.length > 20 ? ' long' : '';
    const ex = w.ex[0] + w.ex[1] + w.ex[2];
    return '<article class="bs-card" id="palabra-' + w.n + '" data-n="' + w.n + '">' +
      '<span class="bs-num" aria-hidden="true">' + w.n + '</span>' +
      '<button type="button" class="bs-seal" data-seal="' + w.n + '" aria-pressed="false" aria-label="¡Me la sé! ' + esc(w.py) + ', ' + esc(w.es) + '">' +
        '<i>' + ICON.check + '</i><small aria-hidden="true">¡Me la sé!</small></button>' +
      '<button type="button" class="bs-word" data-word="' + w.n + '" aria-label="' + w.n + '. Escuchar ' + esc(w.py) + ': ' + esc(w.es) + '">' +
        '<span class="bs-pic-box"><img class="bs-pic" src="' + esc(w.pic) + '" alt="" width="400" height="400" loading="lazy" decoding="async">' +
        '<span class="bs-say" aria-hidden="true">' + SPK + BARS + '</span></span>' +
        '<span class="bs-py' + pyLong + '" lang="zh-Latn-pinyin" translate="no">' + esc(w.py) + '</span>' +
        '<span class="bs-es' + esLong + '">' + esc(w.es) + '</span></button>' +
      '<button type="button" class="bs-ex" data-ex="' + w.n + '" aria-label="Escuchar la frase: ' + esc(ex) + ' ' + esc(w.exes) + '">' +
        '<span class="bs-ex-py" lang="zh-Latn-pinyin" translate="no">' + esc(w.ex[0]) + '<b>' + esc(w.ex[1]) + '</b>' + esc(w.ex[2]) + '</span>' +
        '<span class="bs-ex-es">' + esc(w.exes) + '</span>' +
        '<span class="bs-say bs-say-ex" aria-hidden="true">' + SPK + BARS + '</span></button>' +
      '</article>';
  }
  function rpLabel(w, shown) {
    return esc(w.n + '. ' + w.hint + (shown ? ': ' + w.py + '. Escuchar otra vez' : '. Ver la respuesta y escucharla'));
  }
  // the pitch of a tone on a 5-line staff (high = 5), like the book's tones page
  function toneSvg(points) {
    const lines = [4, 9, 14, 19, 24].map((y) => '<line x1="0" x2="48" y1="' + y + '" y2="' + y + '"/>').join('');
    const pts = points.map((p) => p[0] + ',' + (29 - 5 * p[1])).join(' ');
    const last = points[points.length - 1];
    const prev = points[points.length - 2] || points[0];
    let head = '';
    if (last[0] - points[0][0] > 12) {        // an arrow head at the end of a contour that travels
      const x = last[0], y = 29 - 5 * last[1], px = prev[0], py = 29 - 5 * prev[1];
      const a = Math.atan2(y - py, x - px), L = 6, s = 0.5;
      const p1 = (x - L * Math.cos(a - s)).toFixed(1) + ',' + (y - L * Math.sin(a - s)).toFixed(1);
      const p2 = (x - L * Math.cos(a + s)).toFixed(1) + ',' + (y - L * Math.sin(a + s)).toFixed(1);
      head = '<polyline points="' + p1 + ' ' + x + ',' + y + ' ' + p2 + '"/>';
    }
    return '<svg viewBox="0 0 48 28" aria-hidden="true"><g class="staff">' + lines + '</g><polyline points="' + pts + '"/>' + head + '</svg>';
  }

  function ensureFloaters() {
    if (!document.getElementById('bs-now')) {
      const now = document.createElement('div');
      now.id = 'bs-now';
      now.className = 'bs-now';
      now.hidden = true;
      now.innerHTML = '<div class="bs-now-text"><b id="bs-now-title"></b><span id="bs-now-step"></span></div>' +
        '<button type="button" class="bs-btn bs-btn-gold" id="bs-now-stop">' + ICON.stop + '<span>Parar</span></button>';
      now.querySelector('#bs-now-stop').addEventListener('click', () => stopAll());
      document.body.appendChild(now);
    }
    if (!document.getElementById('bs-toast')) {
      const t = document.createElement('div');
      t.id = 'bs-toast';
      t.className = 'bs-toast';
      t.hidden = true;
      t.setAttribute('role', 'status');
      t.innerHTML = '<img alt="" width="432" height="480"><div><b></b><span></span></div>';
      document.body.appendChild(t);
    }
  }

  // ── progress everywhere at once ────────────────────────────────────
  function update(announce) {
    if (!root) return;
    const total = data.words.length;
    const n = seals.size;
    const done = (w) => data.words.filter((x) => x.world === w.n && seals.has(x.n)).length;
    root.querySelector('#bs-count > span').innerHTML = '<b>' + n + '</b>/' + total;
    root.querySelector('#bs-count').setAttribute('aria-label', n + ' de ' + total + ' sellos');
    root.querySelector('#bs-count').setAttribute('role', 'img');
    root.querySelector('#bs-cover-count').innerHTML = '<b>' + n + '</b> de ' + total + ' sellos';
    data.worlds.forEach((w) => {
      const k = done(w);
      root.querySelectorAll('[data-mw="' + w.n + '"]').forEach((seg) => seg.style.setProperty('--p', (k / w.count).toFixed(3)));
      const idx = root.querySelector('[data-idx="' + w.n + '"]');
      if (idx) { idx.textContent = k + '/' + w.count; idx.classList.toggle('is-done', k === w.count); }
      const oc = root.querySelector('[data-oc="' + w.n + '"]');
      if (oc) oc.innerHTML = w.count + ' palabras' + (k === w.count ? ' · <b>¡completo!</b>' : k ? ' · <b>' + k + '</b> con sello' : '');
      const tab = root.querySelector('[data-tab="' + w.n + '"]');
      if (tab) {
        tab.classList.toggle('is-done', k === w.count);
        tab.setAttribute('aria-label', 'Mundo ' + w.n + ': ' + w.name + (k === w.count ? ', completo' : ''));
      }
      const card = root.querySelector('[data-done="' + w.n + '"]');
      if (card) {
        card.hidden = k !== w.count;
        const im = card.querySelector('img[data-src]');
        if (!card.hidden && im) { im.src = im.getAttribute('data-src'); im.removeAttribute('data-src'); }
      }
    });
    root.querySelectorAll('.bs-seal').forEach((b) => b.setAttribute('aria-pressed', String(seals.has(+b.getAttribute('data-seal')))));
    const go = root.querySelector('#bs-go');
    // «Seguir»: the first unfinished world from the one the kid stamped last (then from the start again)
    const from = lastWord ? data.worlds.findIndex((w) => w.n === byN.get(lastWord).world) : 0;
    const order = data.worlds.slice(Math.max(0, from)).concat(data.worlds.slice(0, Math.max(0, from)));
    const next = order.find((w) => done(w) < w.count);
    if (!n) { go.setAttribute('href', '#como-estudiar'); go.lastChild.textContent = 'Empezar'; }
    else if (next) { go.setAttribute('href', '#mundo-' + next.n); go.lastChild.textContent = 'Seguir: mundo ' + next.n; }
    else { go.setAttribute('href', '#repaso'); go.lastChild.textContent = 'Ir al repaso'; }
    const all = n === total;
    root.querySelector('#bs-close-h').textContent = all ? '¡Terminaste las ' + total + ' palabras!' : 'Después de las ' + total + ' palabras, el repaso';
    root.querySelector('#bs-close-p').textContent = all ? 'Ahora haz el repaso.' : 'Mira cada dibujo y di la palabra.';
    root.querySelector('#bs-rp-score').innerHTML = '¿Cuántas te sabes? <b>' + n + '</b> de ' + total;
    if (announce) ctx.say(announce);
  }

  function toggleSeal(n, btn) {
    const w = byN.get(n);
    const on = !seals.has(n);
    if (on) { seals.add(n); lastWord = n; } else seals.delete(n);
    writeSeals(data.level, seals, lastWord, { n, on });
    queueSave(data.level);
    markTapped();
    if (on && !reduced() && btn.animate) {
      btn.querySelector('i').animate([
        { transform: 'scale(1.4) rotate(-14deg)', opacity: 0.2 },
        { transform: 'scale(.92) rotate(3deg)', opacity: 1, offset: 0.65 },
        { transform: 'none', opacity: 1 },
      ], { duration: 300, easing: 'cubic-bezier(.23, 1, .32, 1)' });
    }
    update((on ? 'Sello puesto: ' : 'Sello quitado: ') + w.py + '. ' + seals.size + ' de ' + data.words.length + '.');
    if (!on) return;
    const world = data.worlds.find((x) => x.n === w.world);
    const k = data.words.filter((x) => x.world === world.n && seals.has(x.n)).length;
    if (seals.size === data.words.length) {
      toast('¡Las ' + data.words.length + ' palabras!', 'Terminaste La base de ' + data.levelName + '. Ahora, el repaso.', true);
    } else if (k === world.count) {
      toast('¡Mundo ' + world.n + ' completo!', world.name + ': ¡listo para El Entrenamiento!', false);   // what the seals earn (phase 3)
    }
  }

  function toast(title, text, big) {
    const t = document.getElementById('bs-toast');
    if (!t) return;
    clearTimeout(toastTimer);
    const im = t.querySelector('img');
    if (!im.getAttribute('src')) im.src = DRAGON.power;   // fetched the first time a toast shows, not on page load
    t.querySelector('b').textContent = title;
    t.querySelector('span').textContent = text;
    t.classList.toggle('is-big', !!big);
    t.classList.remove('is-leaving');
    t.hidden = false;
    toastTimer = setTimeout(() => {
      t.classList.add('is-leaving');
      toastTimer = setTimeout(() => { t.hidden = true; t.classList.remove('is-leaving'); }, 180);
    }, big ? 4200 : 2600);
  }

  // ── sound: one at a time ───────────────────────────────────────────
  function clearOn() {
    if (!playing) return;
    playing.els.forEach((el) => el && el.classList.remove('is-on', 'is-playing'));
    playing = null;
  }
  function play(url, els, onEnd) {
    const p = ctx.player;
    clearOn();
    playing = { els: els.filter(Boolean), onEnd: onEnd || null };
    playing.els.forEach((el) => el.classList.add(el.classList.contains('bs-card') ? 'is-playing' : 'is-on'));
    try { p.pause(); } catch (_) {}
    p.src = url;
    p.playbackRate = 1;
    const mine = playing;
    markTapped();
    p.play().catch(() => { if (playing === mine) { clearOn(); stopSeq(); couldNotPlay(); } });
  }
  // a tap that makes no sound must say why (a weak phone signal is the usual reason), at most once a minute
  function couldNotPlay() {
    if (Date.now() - failShownAt < 60000) return;
    failShownAt = Date.now();
    toast('No se pudo escuchar', 'Revisa tu internet y vuelve a tocar.', false);
  }
  function onEnded() {
    if (!active || !playing) return;
    const done = playing.onEnd;
    clearOn();
    if (seq) seq.fails = 0;
    if (done) done();
  }
  function onError() {
    if (!active || !playing) return;
    const done = playing.onEnd;
    clearOn();
    couldNotPlay();
    // one missing clip never stalls «Escuchar el mundo»; two in a row (no internet) stop it instead of racing silently
    if (seq && (seq.fails = (seq.fails || 0) + 1) >= 2) { stopSeq(); return; }
    if (done) setTimeout(done, 300);
  }
  // paused from outside (lock screen, headphones): the card stops showing that it plays and the world stops
  function onPause() {
    if (!active || !playing) return;
    const p = ctx.player;
    if (p.ended || !p.paused) return;   // the clip finished (onEnded takes it) or the next clip already started
    clearOn();
    stopSeq();
  }
  function stopAll() {
    stopSeq();
    if (ctx && ctx.player) { try { ctx.player.pause(); } catch (_) {} }
    clearOn();
  }
  function onKey(e) { if (e.key === 'Escape' && seq) stopAll(); }

  function cardOf(n) { return root && root.querySelector('.bs-card[data-n="' + n + '"]'); }
  function playWord(n) {
    stopSeq();
    const c = cardOf(n);
    if (c && root.classList.contains('no-es')) c.classList.add('is-shown');   // with the Spanish covered, the tap shows it
    play(byN.get(n).au, [c, c && c.querySelector('.bs-word')]);
  }
  function playSentence(n) {
    stopSeq();
    const c = cardOf(n);
    play(byN.get(n).exau, [c, c && c.querySelector('.bs-ex')]);
  }

  // «Escuchar el mundo»: word, a breath, its sentence, a pause, the next word
  function playWorld(wn) {
    if (seq && seq.w === wn) { stopAll(); return; }
    stopAll();
    const world = data.worlds.find((x) => x.n === wn);
    seq = { w: wn, name: world.name, list: data.words.filter((x) => x.world === wn), i: 0, step: 'word', timer: null };
    const btn = root.querySelector('[data-play-world="' + wn + '"]');
    btn.classList.add('is-on');
    btn.querySelector('span').textContent = 'Parar';
    btn.firstElementChild.outerHTML = ICON.stop;
    const now = document.getElementById('bs-now');
    now.hidden = false;
    now.classList.remove('is-leaving');
    document.body.classList.add('bs-has-now');
    document.getElementById('bs-now-title').textContent = 'Mundo ' + wn + ': ' + world.name;
    seqStep();
  }
  function seqStep() {
    if (!seq || !active) return;
    const w = seq.list[seq.i];
    const c = cardOf(w.n);
    document.getElementById('bs-now-step').textContent = 'Palabra ' + (seq.i + 1) + ' de ' + seq.list.length + ': ' + w.py;
    if (seq.step === 'word') {
      inView(c);
      play(w.au, [c, c.querySelector('.bs-word')], () => {
        if (!seq) return;
        seq.step = 'ex';
        seq.timer = setTimeout(seqStep, 650);
      });
    } else {
      play(w.exau, [c, c.querySelector('.bs-ex')], () => {
        if (!seq) return;
        seq.i += 1;
        seq.step = 'word';
        if (seq.i >= seq.list.length) { stopSeq(); return; }
        seq.timer = setTimeout(seqStep, 1100);
      });
    }
  }
  function stopSeq() {
    if (!seq) return;
    clearTimeout(seq.timer);
    const wn = seq.w;
    seq = null;
    if (root) {
      const btn = root.querySelector('[data-play-world="' + wn + '"]');
      if (btn) {
        btn.classList.remove('is-on');
        btn.querySelector('span').textContent = 'Escuchar el mundo';
        btn.firstElementChild.outerHTML = ICON.play;
      }
    }
    const now = document.getElementById('bs-now');
    if (now && root && now.contains(document.activeElement)) {   // «Parar» had the focus: it goes back to the world
      const back = root.querySelector('[data-play-world="' + wn + '"]');
      if (back) { try { back.focus({ preventScroll: true }); } catch (_) {} }
    }
    if (now && !now.hidden) {
      now.classList.add('is-leaving');
      setTimeout(() => { if (!seq) { now.hidden = true; now.classList.remove('is-leaving'); } }, 200);
    }
    document.body.classList.remove('bs-has-now');
  }
  function inView(el) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    const top = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bar-h')) || 56) + 8;
    if (r.top < top || r.bottom > window.innerHeight - 96) el.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
  }

  // ── taps ───────────────────────────────────────────────────────────
  function onClick(e) {
    const t = e.target.closest('button, a');
    if (!t || !root.contains(t)) return;
    if (t.hasAttribute('data-seal')) { toggleSeal(+t.getAttribute('data-seal'), t); return; }
    if (t.hasAttribute('data-word')) { playWord(+t.getAttribute('data-word')); return; }
    if (t.hasAttribute('data-ex')) { playSentence(+t.getAttribute('data-ex')); return; }
    if (t.hasAttribute('data-play-world')) { playWorld(+t.getAttribute('data-play-world')); return; }
    if (t.hasAttribute('data-share')) { share(+t.getAttribute('data-share')); return; }
    if (t.hasAttribute('data-rp')) { reveal(t); return; }
    if (t.hasAttribute('data-au')) { stopSeq(); play(t.getAttribute('data-au'), [t]); return; }
    if (t.hasAttribute('data-hide-es')) {
      const on = t.getAttribute('aria-pressed') !== 'true';
      root.classList.toggle('no-es', on);
      root.querySelectorAll('[data-hide-es]').forEach((b) => b.setAttribute('aria-pressed', String(on)));
      root.querySelectorAll('.bs-card.is-shown').forEach((c) => c.classList.remove('is-shown'));
      ctx.say(on ? 'El español está tapado. Toca un dibujo para verlo.' : 'El español se ve otra vez.');
      return;
    }
    if (t.id === 'bs-rp-reset') {
      root.querySelectorAll('.bs-rp.is-shown').forEach((b) => { b.classList.remove('is-shown'); b.setAttribute('aria-label', rpLabel(byN.get(+b.getAttribute('data-rp')), false)); });
      t.hidden = true;
      return;
    }
  }
  function reveal(btn) {
    const w = byN.get(+btn.getAttribute('data-rp'));
    btn.classList.add('is-shown');
    btn.setAttribute('aria-label', rpLabel(w, true));
    root.querySelector('#bs-rp-reset').hidden = false;
    stopSeq();
    play(w.au, [btn]);
  }
  function share(wn) {
    const w = data.worlds.find((x) => x.n === wn);
    const url = location.origin + '/audios/' + data.id + '#mundo-' + wn;
    const title = 'Mundo ' + wn + ': ' + w.name + ' · La base de ' + data.levelName;
    if (navigator.share) { navigator.share({ title, text: title, url }).catch(() => {}); return; }
    const done = () => toast('Enlace copiado', 'Pégalo en WhatsApp para compartir este mundo.', false);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => toast('Comparte este enlace', url, false));
    else toast('Comparte este enlace', url, false);
  }

  // first visit only: when the first card comes into view, its two speakers pulse twice («tap me»), then never again
  function hintFirstTap() {
    if (tappedBefore() || seals.size || reduced() || !('IntersectionObserver' in window)) return;
    const first = root.querySelector('.bs-card');
    if (!first) return;
    hintIo = new IntersectionObserver((entries) => {
      if (!entries.some((en) => en.isIntersecting)) return;
      hintIo.disconnect();
      hintIo = null;
      first.querySelectorAll('.bs-say').forEach((s, i) => {
        s.style.animationDelay = (i * 0.35) + 's';
        s.classList.add('bs-hint');
        s.addEventListener('animationend', () => s.classList.remove('bs-hint'), { once: true });
      });
    }, { threshold: 0.6 });
    hintIo.observe(first);
  }

  // the world tab of the part on screen turns red, like the book's thumb index
  function watchWorlds() {
    if (!('IntersectionObserver' in window)) return;
    const tabs = root.querySelectorAll('.bs-tab');
    const seen = new Set();
    const paint = () => {
      const here = [...seen].sort((a, b) => a - b).pop();
      tabs.forEach((tb) => {
        const on = +tb.getAttribute('data-tab') === here;
        tb.classList.toggle('is-here', on);
        if (on) tb.setAttribute('aria-current', 'location'); else tb.removeAttribute('aria-current');
        const strip = tb.parentNode;
        if (on && strip.scrollWidth > strip.clientWidth) {
          const left = tb.offsetLeft - strip.offsetLeft;
          if (left < strip.scrollLeft || left + tb.offsetWidth > strip.scrollLeft + strip.clientWidth) {
            strip.scrollTo({ left: left - (strip.clientWidth - tb.offsetWidth) / 2, behavior: reduced() ? 'auto' : 'smooth' });
          }
        }
      });
    };
    io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const n = +en.target.getAttribute('data-world');
        if (en.isIntersecting) seen.add(n); else seen.delete(n);
      });
      paint();
    }, { rootMargin: '-35% 0px -60% 0px' });
    root.querySelectorAll('.bs-world').forEach((s) => io.observe(s));
  }

  function mediaInfo() {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: data.title + ' · ' + data.levelName, artist: 'Dralingo',
        artwork: [{ src: '/assets/app/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
      });
    } catch (_) {}
  }

  // the shared player: audios.js owns it, these listeners act only while the base is on screen
  function bind(player) {
    if (player.dataset.bsBound) return;
    player.dataset.bsBound = '1';
    player.addEventListener('ended', onEnded);
    player.addEventListener('error', onError);
    player.addEventListener('pause', onPause);
  }

  window.AudiosBase = {
    render(main, d, c) { bind(c.player); render(main, d, c); },
    leave,
    seals: readSeals,
    // La Ruta Dorada (js/ruta.js): settle a level's seals with the logged-in kid's account, and whose account this
    // phone's mirror holds
    sync: (level, max) => syncLevel(level, max),
    who: mirrorWho,
  };
})();
