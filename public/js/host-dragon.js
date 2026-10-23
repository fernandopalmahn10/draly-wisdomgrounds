// Vuelo del Dragón v2 «La Carrera del Cielo de Dubái» — the projector (secondary: the phones are the product). Lobby (PIN +
// QR, the 3 steps, the question pack, 3 / 4 / 5 min, the class as full-body characters, a sky with four dragoncitos
// flying past the landmarks) → the races are dealt (every race's dragons fly onto the start line) → the rules card
// «¡Responde y aletea!» → «¿Listos?» → «¡YA!» → the race: every race as a sky strip (its dragons in their seat colours, the
// kids standing on them, the camera framing that race, the landmarks rushing by, the sky darkening into night), each
// race's players with metres and stars (a flash on every answer), the class top 3, the clock; bands for the big moments
// one at a time (a star sprint, its winners, a new leader, the last 30 s) and fireworks in the last 30 s → «¡FINAL!» →
// the ceremony: every race's finish strip, its bonus stars (+200 m dashes), each race's winner, the class podium.
// Teacher: Pausa (holds every clock), +30 s, Saltar (the intro, the ceremony), Terminar, Sonido, Otra ronda; F5 takes the
// same room back.
// Test hooks: DragonHost.frame(), .freeze(v) / .replay(ev) / .queued(), .hold(v), .stage(name), .sim(ev, d), .band(…).
(function () {
  'use strict';
  const socket = io();
  const $ = (id) => document.getElementById(id);
  const S = window.DragonSky;
  const C = window.DragonCourse;
  const el = S.el, fmt = S.fmt, reduced = S.reduced;
  const K = '/assets/kingdoms/', H = '/assets/halcon/', MO = '/assets/mochi/', MN = '/assets/monopoly/', DR = '/assets/dragon/';
  const PAUSE_ICON = '<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/>';
  const PLAY_ICON = '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/>';
  const lmName = (id) => { const l = C.lm(id); return l ? l.name : 'el monumento'; };

  let pin = null, state = null, muted = false, duration = 240, paused = false;
  let g = null;                         // { id, dur, phase, frenzy, endAt (perf), pausedLeft, playAt (perf) }
  let tiles = {};                       // race id → { id, root, head, skyBox, sky, chips: { k: el }, seats: { k: seat }, lead, seq, spr }
  let timers = [], frozen = false, queue = [], testHold = false;
  let sprint = null;
  const handlers = {};
  const on = (ev, fn) => { handlers[ev] = fn; socket.on(ev, (d) => { if (frozen) { queue.push([fn, d, ev]); return; } fn(d); }); };
  const later = (ms, fn) => { const t = setTimeout(fn, Math.max(0, ms)); timers.push(t); return t; };
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  // ---------- sound ----------
  const SFX = {
    tick: K + 'tick.mp3', whoosh: K + 'whoosh.mp3', win: K + 'sting-win.mp3', flag: K + 'flag.mp3', alert: K + 'castle-alert.mp3',
    siege: K + 'siege.mp3', start: H + 'start.mp3', final: '/assets/party/final-v2.mp3', aww: H + 'aww.mp3', round: H + 'round.mp3',
    drum: MO + 'drum.mp3', star: MN + 'star.mp3', landmark: K + 'landmark.mp3', pop: MO + 'pop.mp3',
  };
  const MUSIC = { lobby: K + 'music-lobby.mp3', play: DR + 'music-race.mp3', final: K + 'music-final.mp3' };
  let music = null, musicName = null;
  const lastSfx = {};
  function sfx(name, vol, gap) {
    if (muted || !SFX[name]) return;
    const now = Date.now();
    if (gap && now - (lastSfx[name] || 0) < gap) return;
    lastSfx[name] = now;
    try { const a = new Audio(SFX[name]); a.volume = vol || 0.6; a.play().catch(() => {}); } catch (_) {}
  }
  function playMusic(name, vol) {
    if (musicName === name) return;
    stopMusic();
    musicName = name;
    if (muted || !MUSIC[name]) return;
    try { music = new Audio(MUSIC[name]); music.loop = true; music.volume = vol || 0.3; music.play().catch(() => {}); } catch (_) {}
  }
  function stopMusic() { if (music) { try { music.pause(); } catch (_) {} } music = null; musicName = null; }
  function musicFor() {
    if (muted || paused) return;
    if (!$('screen-lobby').classList.contains('hidden')) playMusic('lobby', 0.3);
    else if (!$('screen-stage').classList.contains('hidden') && g && g.phase === 'play') playMusic(g.frenzy ? 'final' : 'play', g.frenzy ? 0.36 : 0.3);
    else if (!$('screen-win').classList.contains('hidden')) playMusic('final', 0.26);
  }
  $('mute-btn').addEventListener('click', () => {
    muted = window.toggleMute ? window.toggleMute() : !muted;
    $('mute-btn').querySelector('span').textContent = muted ? 'Sin sonido' : 'Sonido';
    $('mute-btn').setAttribute('aria-pressed', muted ? 'true' : 'false');
    if (muted) stopMusic(); else musicFor();
  });
  document.addEventListener('click', () => { if (window.unlockAudio) window.unlockAudio(); musicFor(); }, { once: true });

  function showScreen(name) {
    ['lobby', 'stage', 'win'].forEach((n) => $('screen-' + n).classList.toggle('hidden', n !== name));
    $('controls').classList.toggle('hidden', name !== 'stage');
    $('endtools').classList.add('hidden');
    $('cer-skip').classList.toggle('hidden', name !== 'win');
    if (name !== 'lobby') stopPreview(); else startPreview();
    musicFor();
  }

  // ---------- bands: one big moment at a time, the most important first ----------
  let bandQ = [], bandOn = false;
  const RANK = { star: 4, sprint: 3, frenzy: 5, lead: 1, time: 5 };
  function band(kind, parts, extra, ms) {
    for (let i = bandQ.length - 1; i >= 0; i--) if (bandQ[i].kind === kind) bandQ.splice(i, 1);
    bandQ.push({ kind, parts, extra, ms: ms || 2600, at: Date.now() });
    bandQ.sort((a, b) => (RANK[b.kind] || 0) - (RANK[a.kind] || 0));
    if (bandQ.length > 3) bandQ.length = 3;
    if (!bandOn) nextBand();
  }
  function nextBand() {
    const b = $('band');
    let it = bandQ.shift();
    while (it && Date.now() - it.at > (it.kind === 'frenzy' || it.kind === 'time' ? 6000 : 3500)) it = bandQ.shift();
    if (!it) { bandOn = false; return; }
    bandOn = true;
    b.className = 'drh-band ' + it.kind;
    b.innerHTML = '';
    if (it.extra) b.appendChild(it.extra);
    const txt = el('div');
    it.parts.forEach((p) => txt.appendChild(p));
    b.appendChild(txt);
    void b.offsetWidth;
    b.classList.add('show');
    setTimeout(() => {
      if (testHold) return;
      b.classList.remove('show');
      setTimeout(nextBand, 300);
    }, it.ms);
  }
  const bold = (t) => el('b', null, t);
  const span = (t) => el('span', null, t);

  // ---------- the room ----------
  const params = new URLSearchParams(location.search);
  const setId = params.get('setId');
  const LIVE = params.get('livegame') === '1' ? '&livegame=1' : '';
  if (!setId) { location.href = '/packs.html?game=dragon-eye' + LIVE; return; }
  $('set-change').href = '/packs.html?game=dragon-eye' + LIVE;
  function showPin(p) {
    pin = p;
    $('pin-display').textContent = p;
    $('active-pin').textContent = p;
    const url = `${location.origin}/?pin=${p}`;
    $('join-url').replaceChildren(location.host, document.createElement('wbr'), `/?pin=${p}`);
    document.title = `Draly Vuelo · ${p}`;
    drawQr(url);
    try { sessionStorage.setItem('draly.dragonHost', JSON.stringify({ pin: p, setId })); } catch (_) {}
  }
  function createRoom() {
    socket.emit('host:create', { gameType: 'dragon-eye' }, (r) => {
      if (!r || !r.pin) return;
      showPin(r.pin);
      socket.emit('host:set-duration', { pin, duration });
      socket.emit('host:load-set', { pin, setId }, (resp) => {
        if (!resp || !resp.ok) { alert('No se pudo cargar la serie de preguntas.'); location.href = '/packs.html?game=dragon-eye' + LIVE; return; }
        $('set-title').textContent = `${resp.title} · ${resp.count} preguntas`;
        updateStartBtn();
      });
    });
  }
  // A reload of this tab (F5 mid-class) takes the same room back instead of opening a new PIN.
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem('draly.dragonHost') || 'null'); } catch (_) {}
  if (saved && saved.pin && saved.setId === setId && !LIVE) {
    socket.emit('host:reclaim', { pin: saved.pin }, (r) => {
      if (r && r.ok && r.gameType === 'dragon-eye') { showPin(saved.pin); $('set-title').textContent = 'la serie elegida'; }
      else createRoom();
    });
  } else createRoom();
  function drawQr(url) {
    const box = $('qr');
    try {
      if (!window.qrcode) { box.style.display = 'none'; return; }
      const qr = window.qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    } catch (_) { box.style.display = 'none'; }
  }
  let connectedOnce = false;
  socket.on('connect', () => { if (connectedOnce && pin) socket.emit('host:reclaim', { pin }, () => {}); connectedOnce = true; });
  document.querySelectorAll('.drh-dur button').forEach((b) => b.addEventListener('click', () => {
    duration = +b.dataset.s;
    document.querySelectorAll('.drh-dur button').forEach((x) => x.classList.toggle('on', x === b));
    socket.emit('host:set-duration', { pin, duration });
  }));
  $('start-btn').addEventListener('click', () => { $('start-btn').disabled = true; socket.emit('host:start', { pin }); });
  $('pause-btn').addEventListener('click', () => socket.emit('host:pause', { pin, paused: !paused }));
  $('resume-btn').addEventListener('click', () => socket.emit('host:pause', { pin, paused: false }));
  $('more-btn').addEventListener('click', () => socket.emit('host:add-time', { pin, seconds: 30 }));
  $('less-btn').addEventListener('click', () => socket.emit('host:add-time', { pin, seconds: -30 }));
  $('skip-btn').addEventListener('click', () => {
    const b = $('skip-btn');
    if (b.disabled) return;
    b.disabled = true;
    socket.emit('host:dr-skip', { pin });
    setTimeout(() => { b.disabled = false; }, 800);
  });
  const endNow = () => { if (confirm('¿Terminar la carrera ahora?')) socket.emit('host:end-now', { pin }); };
  $('end-now-btn').addEventListener('click', endNow);
  $('paused-end-btn').addEventListener('click', endNow);
  $('cer-skip').addEventListener('click', () => { socket.emit('host:dr-skip', { pin }); clearTimers(); stage('podium'); });
  $('home-btn').addEventListener('click', () => { location.href = '/'; });
  $('play-again-btn').addEventListener('click', () => {
    socket.emit('host:reset', { pin });
    clearTimers();
    resetRaces();
    g = null;
    $('cer').innerHTML = '';
    showScreen('lobby');
  });
  socket.on('host:start-error', (e) => { alert(e && e.message ? e.message : 'No se pudo empezar.'); updateStartBtn(); });
  function updateStartBtn() {
    if (!state) return;
    $('start-btn').disabled = !(state.state === 'lobby' && state.questionsLoaded > 0 && Object.values(state.players || {}).some((p) => !p.off));
  }

  // ---------- the lobby ----------
  let preview = null, previewRaf = 0, crowdKey = '';
  function lobbyDecor() {
    const sf = $('step-fly');
    if (sf && !sf.firstChild) sf.append(S.flyer({ skin: 'aileen', c: 2, name: '', tag: false }), el('i', 'drx-hand up'));
    const ss = $('step-star');
    if (ss && !ss.firstChild) ss.append(S.starFly());
  }
  // the lobby's sky: four dragoncitos flying past the landmarks (one rAF while the lobby shows)
  function startPreview() {
    const box = $('preview');
    if (!box || previewRaf) return;
    if (!preview) {
      preview = { sky: new S.Sky(box, { anchor: 0.5, px: 2.2, seed: 5 }), flyers: [], cam: 200 };
      const demo = [['dralingo', 1, -150], ['aileen', 0, 40], ['camel', 3, -60], ['hamdan', 2, 130]];
      demo.forEach(([skin, c, base], i) => {
        const f = S.flyer({ skin, c, name: '', tag: false });
        preview.sky.flyers.appendChild(f);
        preview.flyers.push({ f, base, ph: i * 1.7, lane: i });
      });
      preview.sky.night(0.75);
    }
    const t0 = performance.now();
    const step = (t) => {
      previewRaf = requestAnimationFrame(step);
      if (document.hidden) return;
      const p = preview;
      const sec = (t - t0) / 1000;
      p.cam = 200 + sec * (reduced() ? 0 : 38);
      p.sky.camera(p.cam, t);
      const w = p.sky.w, h = p.sky.h;
      // one lane each (never overlapping), drifting back and forth like a race
      const fw = Math.min(170, (h * 0.86) / (p.flyers.length * 1.02));
      p.flyers.forEach((x, i) => {
        const dx = x.base + Math.sin(sec * 0.6 + x.ph) * 40;
        const y = h * 0.03 + i * fw * 1.02;
        x.f.style.setProperty('--fw', fw + 'px');
        x.f.style.transform = `translate3d(${(w * 0.5 + dx * 1.6 - fw / 2).toFixed(1)}px,${y.toFixed(1)}px,0)`;
        if (!reduced() && Math.random() < 0.012) x.f.beat();
      });
    };
    previewRaf = requestAnimationFrame(step);
  }
  function stopPreview() { cancelAnimationFrame(previewRaf); previewRaf = 0; }
  function racesNote(n) {
    if (n <= 0) return 'Carreras de 4: cada uno contra 3 rivales';
    if (n <= 5) return `1 carrera de ${n}`;
    const r = Math.ceil(n / 4), lo = Math.floor(n / r), hi = Math.ceil(n / r);
    return `${r} carreras de ${lo === hi ? lo : lo + ' o ' + hi}`;
  }
  function paintCrowd() {
    const list = Object.values((state && state.players) || {});
    $('count').textContent = String(list.filter((p) => !p.off).length);
    $('races-note').textContent = racesNote(list.filter((p) => !p.off).length);
    const key = list.map((p) => `${p.name}:${p.sk || ''}:${p.off ? 1 : 0}`).join('|');
    if (key === crowdKey) return;
    crowdKey = key;
    const box = $('crowd');
    box.innerHTML = '';
    const n = list.length;
    const kh = n > 24 ? 70 : n > 14 ? 84 : 100;
    box.style.setProperty('--kh', kh + 'px');
    box.style.setProperty('--kw', Math.round(kh * 0.72) + 'px');
    list.forEach((p) => {
      const f = S.figure({ skin: p.sk || S.skinFor(p.avatar, p.name), c: -1, name: p.name, tag: true });   // seat colours come with the deal
      if (p.off) f.classList.add('off');
      box.appendChild(f);
    });
  }

  // ---------- the races ----------
  function resetRaces() {
    Object.values(tiles).forEach((t) => { if (t.sky) t.sky.destroy(); });
    tiles = {};
    $('grid').innerHTML = '';
    $('top3').innerHTML = '';
    top3Key = '';
    classTile = null;
    sprint = null; sprintTop(false);
  }
  let classTile = null;
  function layoutGrid() {
    const n = Object.keys(tiles).length;
    const cols = n <= 2 ? 1 : n <= 4 ? 2 : n <= 6 ? 3 : 4;
    const holes = cols > 1 ? (cols - (n % cols)) % cols : 0;
    if (holes && !classTile) { classTile = el('section', 'drh-tile drh-class'); classTile.appendChild(el('h3', 'drh-class-h', 'La clase')); classTile.appendChild(el('ol', 'drh-class-list')); }
    if (classTile) { if (holes) $('grid').appendChild(classTile); else classTile.remove(); }
    $('grid').style.setProperty('--cols', String(cols));
    $('grid').classList.toggle('roomy', n <= 2);
    paintTop3();
    requestAnimationFrame(() => Object.values(tiles).forEach((t) => { if (t.sky) t.sky.size(); }));
  }
  function ensureTile(view) {
    let t = tiles[view.id];
    if (!t) {
      const root = el('section', 'drh-tile');
      const head = el('div', 'drh-tile-head');
      head.appendChild(el('span', 'drh-tile-name', 'Carrera ' + view.id));
      const skyBox = el('div', 'drh-tile-sky');
      root.append(head, skyBox);
      $('grid').appendChild(root);
      t = tiles[view.id] = { id: view.id, root, head, skyBox, sky: null, chips: {}, seats: {}, lead: null, seq: 0, cam: 0, px: 2 };
      t.sky = new S.Sky(skyBox, { anchor: 0.5, px: 2, seed: 3 + view.id * 17, clouds: 2 });
      layoutGrid();
    }
    (view.seats || []).forEach((s) => {
      let x = t.seats[s.k];
      if (!x) {
        x = t.seats[s.k] = Object.assign({}, s, { shown: s.m || 0, fl: 0, sp: 0 });
        x.el = S.flyer({ skin: s.skin, c: s.c, name: s.name });
        t.sky.flyers.appendChild(x.el);
      } else Object.assign(x, { name: s.name, skin: s.skin, c: s.c, st: s.st, on: s.on, m: Math.max(x.m || 0, s.m || 0) });
      x.el.off(x.on === false);
    });
    t.lead = view.lead;
    paintChips(t);
    return t;
  }
  function paintChips(t) {
    const list = Object.values(t.seats).sort((a, b) => a.c - b.c);
    list.forEach((s) => {
      let c = t.chips[s.k];
      if (!c) {
        c = el('div', 'drh-chip');
        c.style.setProperty('--pc', S.colorOf(s.c).c);
        const st = el('span', 'st');
        st.append(S.star(), el('i'));
        c.append(el('i'), el('b', null, s.name), el('em', 'n-m', '0 m'), st);
        t.head.appendChild(c);
        t.chips[s.k] = c;
      }
      c.querySelector('.n-m').textContent = fmt(s.m) + ' m';
      const st = c.querySelector('.st');
      st.classList.toggle('none', !(s.st > 0));
      st.lastChild.textContent = String(s.st || 0);
      st.lastChild.style.fontStyle = 'normal';
      c.classList.toggle('lead', t.lead === s.k && list.length > 1);
      c.classList.toggle('off', s.on === false);
    });
  }
  function applyLine(t, seq, d) {
    if (seq <= t.seq) return;
    t.seq = seq;
    (d || []).forEach((row) => {
      const s = t.seats[row[0]];
      if (!s) return;
      s.m = row[1];
      s.fl = row[2] || 0;
      if (row.length > 3) s.sp = row[3];
      s.el.flying(!!(s.fl & 1));
      s.el.fire(!!(s.fl & 4));
      s.el.tail(!!(s.fl & 2));
    });
    paintChips(t);
    if (sprint) paintTileSprint(t);
    top3Soon();
  }
  // F11 / a resized window: every sky measures itself again (lanes, landmark heights)
  window.addEventListener('resize', () => {
    Object.values(tiles).forEach((t) => { if (t.sky) { t.sky.size(); Object.values(t.seats).forEach((s) => { s.el._key = ''; }); } });
    if (preview) preview.sky.size();
  });
  // the class top 3 (metres) across every race: rebuilt only when the order changes, else the numbers alone
  let top3T = null, top3Key = '';
  function top3Soon() { if (top3T) return; top3T = setTimeout(() => { top3T = null; paintTop3(); }, 600); }
  function paintTop3() {
    const all = [];
    Object.values(tiles).forEach((t) => Object.values(t.seats).forEach((s) => all.push(s)));
    all.sort((a, b) => b.m - a.m || (b.st || 0) - (a.st || 0));
    const box = $('top3');
    const key = all.slice(0, 6).map((s) => s.k + ':' + (s.m > 0 ? 1 : 0)).join(',') + '|' + (classTile && classTile.isConnected ? 1 : 0);
    if (key === top3Key) {
      box.querySelectorAll('.drh-top3-k').forEach((n) => { const s = n._s; if (s) n._v.textContent = fmt(s.m) + ' m'; if (s && s.st && !n._st) { n._v.append(' · ', S.star('drh-mini-star'), String(s.st)); n._st = 1; } });
      if (classTile) classTile.querySelectorAll('.drh-class-k').forEach((n) => { if (n._s) n._v.textContent = fmt(n._s.m) + ' m'; });
      return;
    }
    top3Key = key;
    box.innerHTML = '';
    all.slice(0, 3).forEach((s, i) => {
      if (!(s.m > 0)) return;
      const k = el('div', 'drh-top3-k');
      k.appendChild(S.figure({ skin: s.skin, c: s.c, name: s.name }));
      const txt = el('div');
      const nm = el('b'); nm.append(el('em', null, (i + 1) + 'º'), document.createTextNode(s.name));
      const v = el('span', null, fmt(s.m) + ' m');
      if (s.st) { v.append(' · ', S.star('drh-mini-star'), String(s.st)); k._st = 1; }
      k._s = s; k._v = v;
      txt.append(nm, v);
      k.appendChild(txt);
      box.appendChild(k);
    });
    const list = classTile && classTile.querySelector('.drh-class-list');
    if (!list || !classTile.isConnected) return;
    list.innerHTML = '';
    all.slice(0, 6).forEach((s, i) => {
      const li = el('li', 'drh-class-k');
      li.appendChild(el('em', null, (i + 1) + 'º'));
      li.appendChild(S.figure({ skin: s.skin, c: s.c, name: s.name }));
      li.appendChild(el('b', null, s.name));
      const v = el('span', null, fmt(s.m) + ' m');
      li.appendChild(v);
      li._s = s; li._v = v;
      list.appendChild(li);
    });
  }

  // ---------- the loop: each race framed by its own camera ----------
  let raf = 0, lastT = 0;
  function startLoop() { if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(loop); } }
  function stopLoop() { cancelAnimationFrame(raf); raf = 0; }
  function loop(t) {
    raf = requestAnimationFrame(loop);
    if (document.hidden) return;
    const dt = Math.min(0.1, (t - lastT) / 1000);
    lastT = t;
    frameAt(t, dt);
  }
  function frameAt(t, dt) {
    const rm = reduced();
    const night = g && g.playAt && !g.paused && g.dur ? Math.min(1, (performance.now() - g.playAt) / (g.dur * 1000)) : null;
    Object.values(tiles).forEach((tl) => {
      const sky = tl.sky;
      if (!sky) return;
      if (!sky.w || sky.w < 10) sky.size();
      const seats = Object.values(tl.seats);
      if (!seats.length) return;
      seats.forEach((s) => { s.shown += (s.m - s.shown) * (rm ? 1 : 1 - Math.exp(-dt / 0.45)); });
      const lo = Math.min(...seats.map((s) => s.shown)), hi = Math.max(...seats.map((s) => s.shown));
      // the camera frames the whole race (the scale eases so the landmarks don't jump)
      const span = Math.max(80, hi - lo);
      const wantPx = Math.max(0.35, Math.min(3, (sky.w * 0.5) / span));
      tl.px += (wantPx - tl.px) * (rm ? 1 : 1 - Math.exp(-dt / 0.8));
      sky.px = tl.px;
      const cam = (lo + hi) / 2;
      tl.cam += (cam - tl.cam) * (rm ? 1 : 1 - Math.exp(-dt / 0.35));
      sky.camera(tl.cam, t);
      if (night != null) sky.night(night);
      const n = seats.length;
      // one lane per dragon, never overlapping (the name sits behind each dragon, on its trail)
      const fw = Math.max(34, Math.min((sky.h - 8) / (n * 1.02), sky.w * 0.2, 170));
      seats.sort((a, b) => a.c - b.c).forEach((s, i) => {
        // a dragon far behind (or ahead) waits at the tile's edge, whole, its name turned inwards
        const raw = sky.xOf(s.shown);
        const x = Math.max(fw / 2 + 6, Math.min(sky.w - fw / 2 - 6, raw));
        const edgeL = x - fw / 2 < 76;           // no room for the name on the left: it goes to the right
        const laneH = (sky.h - 8 - fw * 1.02) / Math.max(1, n - 1);
        const y = 4 + i * Math.max(fw * 1.02, laneH);
        const key = `${Math.round(x)}|${Math.round(y)}|${Math.round(fw)}|${edgeL ? 1 : 0}`;
        if (s.el._key === key) return;
        s.el._key = key;
        s.el.style.setProperty('--fw', fw.toFixed(1) + 'px');
        s.el.classList.toggle('hx-l', edgeL);
        s.el.style.transform = `translate3d(${(x - fw / 2).toFixed(1)}px,${y.toFixed(1)}px,0)`;
        s.el.style.zIndex = String(10 + i);
      });
    });
  }

  // ---------- the clock ----------
  let clockT = null, lastCount = null;
  function runClock() {
    clearInterval(clockT);
    const paint = () => {
      paintSprintTop();
      if (!g || !g.endAt) { const d = (g && g.dur) || duration; $('clock').textContent = `${Math.floor(d / 60)}:${String(Math.round(d % 60)).padStart(2, '0')}`; return; }
      const left = g.paused ? g.pausedLeft : Math.max(0, g.endAt - performance.now());
      const s = Math.max(0, Math.ceil(left / 1000));
      $('clock').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      if ($('less-btn')) $('less-btn').disabled = g.phase !== 'play' || left <= 11000;   // «−30 s» stops 10 s before the end (core/party.js clockShift)
      const c10 = $('count10');
      if (g.phase === 'play' && !g.paused && s <= 10 && s > 0) {
        c10.classList.remove('hidden');
        if (lastCount !== s) { lastCount = s; c10.textContent = String(s); sfx('tick', 0.5); }
      } else c10.classList.add('hidden');
    };
    paint();
    clockT = setInterval(paint, 250);
  }

  // ---------- the countdown, the rules card ----------
  function runIn(n) {
    const r = $('runin');
    r.classList.remove('hidden');
    r.innerHTML = '';
    const b = el('b', null, n > 1 ? `¡${n} carreras listas!` : '¡Carrera lista!');
    b.appendChild(el('small', null, 'Cada dragoncito a la salida… ¡Dralingo espera con la estrella!'));
    // Dralingo holds the star beside the title (the same picture as the phones' run-in)
    const host = el('div', 'drh-runin-host');
    host.appendChild(S.starFly());
    const card = el('div', 'drh-runin-card');
    card.append(b, host);
    r.appendChild(card);
    sfx('round', 0.5);
    later(2600, () => { if (!testHold) r.classList.add('hidden'); });
  }
  function showRules(ms) {
    $('runin').classList.add('hidden');   // the run-in never outlives its moment
    const box = $('rules');
    box.classList.remove('hidden');
    box.innerHTML = '';
    const c = el('div', 'dri-card');
    const pic = el('div', 'dri-pic');
    const f = S.flyer({ skin: 'hamdan', c: 2, name: '', tag: false });
    f.classList.add('dri-rulefly');
    pic.append(f, el('i', 'drx-hand up'), el('i', 'dri-arrow'));
    c.append(pic, el('h2', null, '¡Responde y aletea!'), el('p', null, 'Cada respuesta correcta es un vuelo: desliza hacia arriba y cada aleteo te adelanta. ¡Cruza los anillos dorados! Cada 40 s, carrera por la estrella.'));
    const say = el('div', 'dri-say');
    c.appendChild(say);
    box.appendChild(c);
    const total = Math.max(1400, ms || 2800);
    later(total - 1250, () => { say.textContent = '¿Listos?'; sfx('tick', 0.7); });
    later(total - 600, () => { say.textContent = '¡YA!'; sfx('start', 0.8); });
    later(total + 300, () => { if (!testHold) box.classList.add('hidden'); });
  }

  // ---------- the star sprint (every race at once) ----------
  // a sprint in each race's chips: a gold «+96» pill per dragon, the race's sprint leader glows (nothing over the sky)
  function paintTileSprint(t) {
    const seats = Object.values(t.seats);
    const lead = sprint ? Math.max(0, ...seats.map((s) => s.sp || 0)) : 0;
    seats.forEach((s) => {
      const c = t.chips[s.k];
      if (!c) return;
      let p = c.querySelector('.spm');
      if (!sprint) { if (p) p.remove(); c.classList.remove('spl'); return; }
      if (!p) { p = el('span', 'spm'); c.appendChild(p); }
      const v = s.sp || 0;
      p.textContent = '+' + fmt(v);
      c.classList.toggle('spl', v > 0 && v === lead);
    });
  }
  // the sprint's headline in the top bar (in place of the class top 3): where, Dralingo with the star, the seconds left
  const listY = (a) => (a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1]);
  function sprintTop(on) {
    const stage = $('screen-stage');
    if (!stage) return;
    if (!on || !sprint) { stage.classList.remove('sprinting'); return; }
    let box = $('sprtop');
    if (!box) { box = el('div', 'drh-sprtop'); box.id = 'sprtop'; $('top3').after(box); }
    box.innerHTML = '';
    const im = el('img', 'spt-lm'); im.src = S.lmArt(sprint.lm); im.alt = '';
    const tt = el('div', 'spt-t');
    tt.append(el('b', null, `¡Carrera al ${lmName(sprint.lm)}!`), el('span', null, 'En cada carrera, quien más vuele se lleva la estrella'));
    const dral = el('div', 'spt-dral');
    dral.appendChild(S.starFly());
    const n = el('b', 'spt-n'); n.id = 'sprtop-n';
    box.append(im, tt, dral, n);
    stage.classList.add('sprinting');
    paintSprintTop();
  }
  function paintSprintTop() {
    const n = $('sprtop-n');
    if (!n || !sprint || sprint.until == null) return;
    const left = sprint.left != null ? sprint.left : Math.max(0, sprint.until - performance.now());
    n.textContent = String(Math.ceil(left / 1000));
  }
  function onSprint(d) {
    if (d.go) {
      sprint = { n: d.n, lm: d.lm, until: performance.now() + (d.ms || 12000), left: null };
      sprintTop(true);
      Object.values(tiles).forEach((t) => { Object.values(t.seats).forEach((s) => { s.sp = 0; }); paintTileSprint(t); });
      const im = el('img'); im.src = S.lmArt(d.lm); im.alt = '';
      band('sprint', [bold(`¡Carrera al ${lmName(d.lm)}!`), span('Dralingo tiene una estrella en cada carrera: ¡quien más vuele en 12 segundos!')], im, 3000);
      sfx('landmark', 0.55);
      return;
    }
    sprint = null; sprintTop(false);
    const names = [];
    (d.races || []).forEach((r) => {
      const t = tiles[r.b];
      if (!t) return;
      paintTileSprint(t);
      (r.w || []).forEach((k) => {
        const s = t.seats[k];
        if (!s) return;
        s.st = (s.st || 0) + 1;
        if (r.m && r.m[k] != null) s.m = r.m[k];
        s.el.beat(true);
        s.el.pose('ok', 2400);
        names.push(s.name);
      });
      if ((r.w || []).length) { t.root.classList.remove('ping'); void t.root.offsetWidth; t.root.classList.add('ping'); }
      paintChips(t);
    });
    top3Soon();
    if (names.length) {
      const list = names.length > 6 ? names.slice(0, 6).join(', ') + '…' : names.join(', ');
      band('star', [bold(`¡Estrella del ${lmName(d.lm)}!`), span(`${list} · +${d.star || 150} m`)], S.star(), 3000);
      sfx('star', 0.7, 900);
    }
  }

  // ---------- events ----------
  on('state', (s) => {
    state = s;
    if (s.state === 'lobby') {
      if (!$('screen-win').classList.contains('hidden') || !$('screen-stage').classList.contains('hidden')) { resetRaces(); stopLoop(); g = null; }
      showScreen('lobby');
      lobbyDecor();
      paintCrowd();
      if ([180, 240, 300].includes(s.duration)) {
        duration = s.duration;
        document.querySelectorAll('.drh-dur button').forEach((x) => x.classList.toggle('on', +x.dataset.s === s.duration));
      }
    }
    Object.values(s.players || {}).forEach((p) => {
      if (p.k == null) return;
      Object.values(tiles).forEach((t) => { const st = t.seats[p.k]; if (st && st.on !== !p.off) { st.on = !p.off; st.el.off(p.off); paintChips(t); } });
    });
    updateStartBtn();
  });
  on('countdown', () => { clearTimers(); resetRaces(); showScreen('stage'); $('skip-btn').classList.add('hidden'); });
  on('dr:init', (d) => {
    g = { id: d.id, dur: d.duration, phase: d.phase, frenzy: !!d.frenzy, paused: !!d.paused, endAt: d.endsMs != null ? performance.now() + d.endsMs : 0, pausedLeft: d.endsMs || 0,
      playAt: performance.now() - (d.played || 0) };
    showScreen('stage');
    (d.races || []).forEach((v) => ensureTile(v));
    S.preload([0, 1, 2, 3, 4], [].concat(...(d.races || []).map((v) => v.seats.map((s) => s.skin))));
    layoutGrid();
    paintTop3();
    runClock();
    setPaused(!!d.paused);
    $('screen-stage').classList.toggle('frenzy', g.frenzy);
    Object.values(tiles).forEach((t) => t.sky.frenzy(g.frenzy));
    if (d.sprint) {
      const ms = d.sprint.ms || 0;
      sprint = { n: d.sprint.n, lm: d.sprint.lm, until: performance.now() + ms, left: d.paused ? ms : null };
      Object.values(tiles).forEach(paintTileSprint);
    }
    sprintTop(!!d.sprint);
    if (d.phase === 'countdown') runIn((d.races || []).length);
    if (d.phase === 'intro') { $('skip-btn').classList.remove('hidden'); showRules(d.phaseMs); }
    if (d.phase === 'final') $('final').classList.remove('hidden');
    startLoop();
  });
  on('dr:seat', (d) => { if (d && d.race) { ensureTile(d.race); paintTop3(); } });
  on('dr:intro', (d) => { if (!g) return; g.phase = 'intro'; $('skip-btn').classList.remove('hidden'); showRules(d && d.ms); });
  on('dr:play', (d) => {
    if (!g) return;
    g.phase = 'play';
    g.endAt = performance.now() + (d.endsMs || 0);
    g.playAt = performance.now();
    $('skip-btn').classList.add('hidden');
    $('rules').classList.add('hidden');
    $('runin').classList.add('hidden');
    musicFor();
  });
  on('dr:races', (d) => { if (!g || !d || d.id !== g.id) return; (d.r || []).forEach(([b, seq, line]) => { const t = tiles[b]; if (t) applyLine(t, seq, line); }); });
  on('dr:ans', (a) => {
    Object.values(tiles).forEach((t) => {
      const c = t.chips[a.k];
      if (!c) return;
      c.classList.remove('ok', 'no');
      void c.offsetWidth;
      c.classList.add(a.right ? 'ok' : 'no');
    });
  });
  on('dr:sprint', (d) => { if (g && d && d.id === g.id) onSprint(d); });
  on('dr:lead', (l) => {
    const t = tiles[l.b];
    if (!t) return;
    t.lead = l.k;
    paintChips(t);
    const s = t.seats[l.k];
    if (g && g.endAt && !g.paused && g.endAt - performance.now() < 10500) return;   // the last 10 s belong to the count
    const fig = s ? S.figure({ skin: s.skin, c: s.c, name: s.name, pose: 'ok' }) : null;
    band('lead', [bold(`Carrera ${t.id}: ¡${s ? s.name : ''} ${l.first ? 'toma la delantera' : 'pasa al primer lugar'}!`), span('Gana quien vuele más metros')], fig, 2200);
    sfx('flag', 0.4, 2500);
  });
  on('dr:frenzy', (d) => {
    if (!g) return;
    g.frenzy = true;
    g.endAt = performance.now() + (d.endsMs || 30000);
    $('screen-stage').classList.add('frenzy');
    Object.values(tiles).forEach((t) => t.sky.frenzy(true));
    band('frenzy', [bold('¡Últimos 30 segundos!'), span('¡ALAS DOBLES en todas las carreras!')], S.star(), 2800);
    sfx('siege', 0.6);
    musicFor();
  });
  on('dr:time', (d) => {
    if (!g) return;
    g.endAt = performance.now() + (d.endsMs || 0);
    if (g.paused) g.pausedLeft = d.endsMs || g.pausedLeft;
    band('time', [bold(d.add < 0 ? `${-d.add} segundos menos` : `+${d.add || 30} segundos más`)], null, 1600);
  });
  function setPaused(v) {
    paused = !!v;
    $('paused').classList.toggle('hidden', !paused);
    $('pause-btn').querySelector('svg').innerHTML = paused ? PLAY_ICON : PAUSE_ICON;
    $('pause-btn').querySelector('span').textContent = paused ? 'Seguir' : 'Pausa';
    if (paused) stopMusic(); else musicFor();
  }
  on('dr:pause', (d) => {
    if (!g) return;
    g.paused = !!d.paused;
    if (g.paused) g.pausedLeft = Math.max(0, g.endAt - performance.now());
    else if (d.endsMs != null) g.endAt = performance.now() + d.endsMs;
    if (sprint && sprint.until != null) {
      if (g.paused) sprint.left = Math.max(0, sprint.until - performance.now());
      else if (sprint.left != null) { sprint.until = performance.now() + sprint.left; sprint.left = null; }
    }
    setPaused(g.paused);
    if (g.phase === 'intro') { if (g.paused) { clearTimers(); $('rules').classList.add('hidden'); } else showRules(d.phaseMs); }
  });
  on('dr:final', () => {
    bandQ = [];
    $('band').classList.remove('show');
    if (g) { g.phase = 'final'; g.paused = false; }
    $('skip-btn').classList.add('hidden');
    setPaused(false);
    sprint = null; sprintTop(false);
    Object.values(tiles).forEach((t) => { paintTileSprint(t); t.sky.frenzy(false); });
    $('count10').classList.add('hidden');
    $('rules').classList.add('hidden');
    $('final').classList.remove('hidden');
    sfx('final', 0.85);
    stopMusic();
  });
  on('game-end', (d) => {
    $('final').classList.add('hidden');
    $('count10').classList.add('hidden');
    clearInterval(clockT);
    bandQ = [];
    $('band').classList.remove('show');
    stopLoop();
    ceremony(d);
  });

  // ---------- the ceremony ----------
  let cer = null;
  function ceremony(d) {
    clearTimers();
    cer = { d, stage: null };
    showScreen('win');
    const dr = (d && d.dragon) || {};
    const nb = Math.max(...(dr.races || []).map((b) => (b.bonus || []).length), 0);
    const plan = [['bonus-intro', 1900]];
    for (let i = 0; i < nb; i++) plan.push(['bonus' + i, 2300]);
    plan.push(['drum', 1300], ['winners', 3800], ['podium', 0]);
    let t = 0;
    plan.forEach(([name, ms]) => { later(t, () => stage(name)); t += ms; });
  }
  function cerGrid(races, fill) {
    const grid = el('div', 'drh-cer-grid');
    const n = races.length;
    grid.style.setProperty('--cols', String(n <= 1 ? 1 : n <= 4 ? 2 : n <= 6 ? 3 : 4));
    grid.classList.toggle('roomy', n <= 2);
    races.forEach((b) => { const box = el('section', 'drh-cer-b'); box.appendChild(el('h3', null, 'Carrera ' + b.id)); fill(box, b); grid.appendChild(box); });
    return grid;
  }
  function confetti(host, c, n) {
    if (reduced()) return;
    const col = S.colorOf(c);
    const cols = [col.c, col.s, '#ffc93c', '#fff7e3'];
    for (let i = 0; i < (n || 30); i++) {
      const x = el('i', 'ds-confetti');
      x.style.setProperty('--x', (2 + Math.random() * 96) + '%');
      x.style.setProperty('--d', (Math.random() * 0.8).toFixed(2) + 's');
      x.style.setProperty('--r', Math.round(Math.random() * 360) + 'deg');
      x.style.setProperty('--dx', Math.round((Math.random() - 0.5) * 140) + 'px');
      x.style.background = cols[i % cols.length];
      host.appendChild(x);
      setTimeout(() => x.remove(), 3600);
    }
  }
  // a race as a finish strip (lanes in seat order; upTo = how many bonus stars are given so far; hi = who gets one now)
  function strip(rc, upTo, hi, result, bonusM) {
    const sorted = (rc.rows || []).slice().sort((a, b) => a.c - b.c);
    const totalAt = (r, u) => r.flown + (rc.bonus || []).slice(0, u).filter((x) => (x.winners || []).includes(r.k)).length * bonusM;
    const max = Math.max(1, ...sorted.map((r) => totalAt(r, (rc.bonus || []).length)));
    const box = el('div', 'drf-strip' + (sorted.length > 4 ? ' five' : ''));
    sorted.forEach((r, i) => {
      const isHi = hi && hi.includes(r.k);
      const win = result && (rc.winners || []).includes(r.k);
      const lane = el('div', 'drf-lane' + (isHi || win ? ' hi' : ''));
      lane.style.setProperty('--pc', S.colorOf(r.c).c);
      lane.style.setProperty('--i', i);
      const tot = totalAt(r, upTo);
      lane.style.setProperty('--k', Math.max(0.04, tot / max).toFixed(3));
      const f = S.flyer({ skin: r.skin, c: r.c, name: r.name, still: true, tag: false });
      f.classList.add('drf-fly');
      f.pose(result ? (win ? 'ok' : 'no') : isHi ? 'ok' : 'idle');
      const lab = el('div', 'drf-lab');
      const num = el('b', null, fmt(tot));
      lab.append(el('span', 'drf-nm', r.name), num, el('small', null, 'm'));
      if (isHi) { const s = el('em', 'drf-plus'); s.append(S.star(), document.createTextNode('+' + bonusM)); lab.appendChild(s); S.countUp(num, tot - bonusM, tot, 700); }
      lane.append(el('i', 'drf-bar'), f, lab);
      box.appendChild(lane);
    });
    return box;
  }
  function stage(name) {
    if (!cer) return;
    cer.stage = name;
    const dr = (cer.d && cer.d.dragon) || {};
    const races = dr.races || [];
    const bonusM = dr.bonusM || 200;
    const box = $('cer');
    box.innerHTML = '';
    const head = (h, sub) => { const x = el('h2', 'drh-end-h', h); if (sub) x.appendChild(el('small', null, sub)); box.appendChild(x); };
    if (name === 'bonus-intro') {
      head('¡Así llegaron las carreras!', `Tres estrellas bonus de +${bonusM}\u00a0m en cada carrera… ¡pueden cambiar quién gana!`);
      box.appendChild(cerGrid(races, (bx, b) => bx.appendChild(strip(b, 0, null, false, bonusM))));
      sfx('drum', 0.7);
      return;
    }
    if (/^bonus\d+$/.test(name)) {
      const i = Number(name.slice(5));
      const ex = races.map((b) => (b.bonus || [])[i]).find(Boolean);
      const sh = el('div', 'drh-cer-star');
      sh.appendChild(S.star());
      const tt = el('div');
      tt.append(el('b', null, ex ? ex.name : 'Estrella bonus'), el('span', null, ex ? `para ${ex.what} · +${bonusM}\u00a0m` : ''));
      sh.appendChild(tt);
      box.appendChild(sh);
      box.appendChild(cerGrid(races, (bx, b) => {
        const st = (b.bonus || [])[i];
        bx.appendChild(strip(b, i + 1, st ? st.winners : [], false, bonusM));
        if (!st) bx.appendChild(el('p', 'drh-hint', 'Nadie la ganó en esta carrera'));
      }));
      sfx('star', 0.6);
      return;
    }
    if (name === 'drum') {
      head('¿Quién gana cada carrera?', 'Más metros gana. Si empatan: más estrellas');
      box.appendChild(cerGrid(races, (bx, b) => bx.appendChild(strip(b, (b.bonus || []).length, null, false, bonusM))));
      sfx('drum', 0.8);
      return;
    }
    if (name === 'winners') {
      head('¡Los ganadores!');
      box.appendChild(cerGrid(races, (bx, b) => {
        bx.appendChild(strip(b, (b.bonus || []).length, null, true, bonusM));
        const conf = el('div', 'drf-conf');
        bx.appendChild(conf);
        const w = (b.rows || []).find((x) => (b.winners || []).includes(x.k));
        if (w) confetti(conf, w.c, 18);
        const wn = (b.rows || []).filter((x) => (b.winners || []).includes(x.k)).map((x) => x.name);
        const h = bx.querySelector('h3');
        if (h && wn.length) h.appendChild(el('span', 'drh-cer-win', `¡Gana ${listY(wn)}!`));
      }));
      sfx('win', 0.9);
      later(800, () => sfx('aww', 0.35));
      return;
    }
    if (name === 'podium') {
      clearTimers();
      head('¡El podio de la clase!', 'Los metros de todas las carreras');
      const pod = el('div', 'drh-podium');
      const top = (dr.podium || []).slice(0, 3);
      const order = top.length >= 3 ? [top[1], top[0], top[2]] : top.length === 2 ? [top[1], top[0]] : top;
      order.forEach((x) => {
        if (!x) return;
        const rk = x.classRank || (top.indexOf(x) + 1);
        const p = el('div', 'drh-pod p' + Math.min(3, rk));
        const f = S.flyer({ skin: x.skin, c: x.c, name: x.name, still: true, tag: false });
        f.pose('ok');
        p.appendChild(f);
        p.appendChild(el('div', 'drh-pod-name', x.name));
        const step = el('div', 'drh-pod-step');
        step.appendChild(el('b', null, rk + 'º'));
        const v = el('span');
        v.append(document.createTextNode(fmt(x.total) + ' m'));
        if (x.stars) { v.append(' · ', S.star(), document.createTextNode(String(x.stars))); }
        step.appendChild(v);
        p.appendChild(step);
        pod.appendChild(p);
      });
      if (!top.length) pod.appendChild(el('p', 'drh-hint', '¡La próxima carrera será épica!'));
      box.appendChild(pod);
      const conf = el('div', 'drf-conf');
      box.appendChild(conf);
      if (top[0]) confetti(conf, top[0].c, 40);
      $('cer-skip').classList.add('hidden');
      $('endtools').classList.remove('hidden');
    }
  }

  window.DragonHost = {
    frame: () => ({ pin, phase: g && g.phase, races: Object.keys(tiles).length, paused, stage: cer && cer.stage, sprint,
      seats: Object.values(tiles).reduce((a, t) => a + Object.keys(t.seats).length, 0) }),
    freeze: (v) => { frozen = !!v; if (!frozen) { const q = queue; queue = []; q.forEach(([fn, d]) => fn(d)); } return queue.length; },
    replay: (ev) => { while (queue.length) { const [fn, d, e] = queue.shift(); fn(d); if (e === ev) break; } return queue.length; },
    queued: () => queue.map((x) => x[2]),
    hold: (v) => { testHold = !!v; },
    stage: (name) => { if (cer) { clearTimers(); stage(name); } },
    sim: (ev, d) => { if (handlers[ev]) handlers[ev](d); },
    band: (kind, title, sub) => band(kind, [bold(title), span(sub || '')], S.star(), 4000),
    tick: (ms) => { const t = performance.now(); for (let i = 0; i < Math.ceil((ms || 1000) / 16); i++) frameAt(t + i * 16, 0.016); },
  };
})();
