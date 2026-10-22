// ¡No despiertes a Dralingo! — the projector (secondary: the phones are the product). Lobby (PIN + QR, the game in 3
// pictures, the players as full-body characters, 3 / 4 / 5 min) → the countdown in the bedroom («¡Shhh!») → every board
// of 4 as its own bedroom (Dralingo asleep, the turn kid tiptoeing with the golden feather, the board's scores with an
// arrow on whose turn it is, strokes / stirs / wake-ups live) + the class top 3 → «¡FINAL!» → each board's champion and
// the class podium. Teacher buttons always work: Pausa, +30 s, −30 s, Saltar, Terminar, Sonido.
// v2 (2026-10-22): during a turn a board's tile is the close-up of his face, the turn kid's feather moving live (dm:fe)
// and each stroke landing (+1, the squish; a scribble wobbles); every kid's feathers (🪶N) beside their score.
// Test hooks: DormHost.frame(), DormHost.freeze(v).
(function () {
  'use strict';
  const socket = io();
  const $ = (id) => document.getElementById(id);
  const S = window.DormStage;
  const HB = window.HalconBoard;
  const A = '/assets/dormilon/', H = '/assets/halcon/', K = '/assets/kingdoms/', PARTY = '/assets/party/';
  const SFX = {
    stroke: A + 'stroke.mp3', pop: H + 'pop.mp3', creak: A + 'creak.mp3', wake: A + 'wake-h1.mp3', aww: H + 'aww.mp3',
    snore: A + 'snore-h1.mp3', angry: A + 'angry-h1.mp3', shift: A + 'creak2.mp3', round: H + 'round.mp3', start: H + 'start.mp3', whoosh: K + 'whoosh.mp3', win: K + 'sting-win.mp3',
    final: H + 'final.mp3', hurry: PARTY + 'hurry.mp3', tick: PARTY + 'tick.mp3', yes: H + 'yes.mp3',
    giggle1: A + 'giggle-h1.mp3', giggle2: A + 'giggle-h2.mp3', giggle3: A + 'giggle-h3.mp3',
  };
  const MUSIC = { lobby: K + 'music-lobby.mp3', night: A + 'music-night.mp3', final: K + 'music-final.mp3' };
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const skinFor = HB.skinFor;
  const WHISPER = {
    fer: ['Shhh… despacito, ¡y respondan bien!', 'Shhh… una cosquilla a la vez.'],
    hamdan: ['Shhh… con calma, como un halcón.', 'Shhh… paciencia, amigos.'],
    latifa: ['Shhh… ¡con mucho cuidado!', 'Shhh… que sueñe bonito.'],
    aileen: ['Shhh… ¡dale, despacito, vos podés!', 'Shhh… ¿vos te animás a otra?'],
    adric: ['Shhh… ¡hasta mi perro está calladito!', 'Shhh… pasito a pasito.'],
    adrian: ['Shhh… según mi mapa, ¡de puntitas!', 'Shhh… por aquí, sin ruido.'],
  };
  const WAKE_LINES = ['¡¿QUIÉN ME DESPERTÓ?! ¡Soñaba con dumplings! 🥟', '¡Grrr! ¡Hasta un dragón sabio necesita su siesta! 😤', '¡Te vi con esa pluma! 😠', '¡Grrr… cinco minutitos más! 💢', '¡¿Otra vez cosquillas?! ¡Grrr!'];   // (v3: he wakes up ANGRY, funny-angry, never scary)
  const pick1 = (a) => a[Math.floor(Math.random() * a.length)];
  function hostLine(id, text) {
    const C = window.DralingoCast;
    const im = document.querySelector('.dmh-host-say img');
    if (im) im.src = id === 'dralingo' ? A + 'dralingo-awake.webp' : (C ? C.pose(id, 'hello') : '/assets/dralingo/wise.webp');
    say(text);
  }
  let lastWhisper = 0;
  const fmtClock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  let pin = null, state = null, muted = false, paused = false, duration = 120, endsAt = 0, pausedLeft = 0, frenzy = false;
  let game = null;              // { id, phase }
  let boards = {};              // id → { view, stage, el, turn }
  let lobbyStage = null, countStage = null, lobbyKey = '', seenKids = new Set(), clockT = null, timers = [];
  let frozen = false, queue = [];
  const onDm = (ev, fn) => socket.on(ev, (d) => { if (frozen && ev.indexOf('dm:') === 0) { queue.push([fn, d]); return; } fn(d); });

  // ---------- sound ----------
  let music = null, musicName = null;
  const lastSfx = {};
  function sfx(name, vol, gap) {
    if (muted || !SFX[name]) return;
    const now = Date.now();
    if (gap && now - (lastSfx[name] || 0) < gap) return;     // 8 boards at once must not become noise
    lastSfx[name] = now;
    try { const a = new Audio(SFX[name]); a.volume = vol || 0.6; a.play().catch(() => {}); } catch (_) {}
  }
  function playMusic(name, vol) {
    if (musicName === name) return;
    stopMusic();
    musicName = name;
    if (muted || !MUSIC[name]) return;
    try { music = new Audio(MUSIC[name]); music.loop = true; music.volume = vol || 0.3; if (name === 'night' && frenzy) music.playbackRate = 1.18; music.play().catch(() => {}); } catch (_) {}
  }
  function stopMusic() { if (music) { try { music.pause(); } catch (_) {} } music = null; musicName = null; }
  function musicFor() {
    if (muted) return;
    if (!$('screen-lobby').classList.contains('hidden')) playMusic('lobby', 0.3);
    else if (!$('screen-active').classList.contains('hidden') && !paused) playMusic('night', 0.3);
    else if (!$('screen-win').classList.contains('hidden')) playMusic('final', 0.3);
  }
  $('mute-btn').addEventListener('click', () => {
    muted = window.toggleMute ? window.toggleMute() : !muted;
    $('mute-btn').textContent = muted ? '🔇 Sin sonido' : '🔊 Sonido';
    if (muted) stopMusic(); else musicFor();
  });
  document.addEventListener('click', () => { if (window.unlockAudio) window.unlockAudio(); musicFor(); }, { once: true });

  const later = (ms, fn) => { const t = setTimeout(fn, Math.max(0, ms)); timers.push(t); return t; };
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function showScreen(name) {
    ['lobby', 'countdown', 'active', 'win'].forEach((n) => $('screen-' + n).classList.toggle('hidden', n !== name));
    document.body.classList.toggle('dmh-ended', name === 'win');
    musicFor();
  }
  function say(text) { $('host-say').textContent = text; }
  function bigBand(text, kind, ms) {
    const b = $('bigband');
    b.textContent = text;
    b.className = 'dmh-bigband' + (kind ? ' ' + kind : '');
    void b.offsetWidth;
    later(ms || 1400, () => b.classList.add('hidden'));
  }

  // ---------- room ----------
  const params = new URLSearchParams(location.search);
  const setId = params.get('setId');
  const LIVE = params.get('livegame') === '1' ? '&livegame=1' : '';
  if (!setId) { location.href = '/packs.html?game=dormilon' + LIVE; return; }
  socket.emit('host:create', { gameType: 'dormilon' }, ({ pin: p }) => {
    if (!p) return;
    pin = p;
    $('pin-display').textContent = p;
    $('active-pin').textContent = p;
    const url = `${location.origin}/?pin=${p}`;
    $('join-url').textContent = url;
    document.title = `¡No despiertes a Dralingo! · ${p}`;
    drawQr(url);
    socket.emit('host:set-duration', { pin, duration });
    socket.emit('host:load-set', { pin, setId }, (resp) => {
      if (!resp || !resp.ok) { alert('No se pudo cargar la serie de preguntas.'); location.href = '/packs.html?game=dormilon' + LIVE; return; }
      $('set-display').textContent = `📚 ${resp.title} · ${resp.count} preguntas`;
      updateStartBtn();
    });
  });
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
  document.querySelectorAll('.dmh-dur button').forEach((b) => b.addEventListener('click', () => {
    duration = +b.dataset.s;
    document.querySelectorAll('.dmh-dur button').forEach((x) => x.classList.toggle('on', x === b));
    socket.emit('host:set-duration', { pin, duration });
  }));
  $('start-btn').addEventListener('click', () => { $('start-btn').disabled = true; socket.emit('host:start', { pin }); });
  $('skip-btn').addEventListener('click', () => {
    const b = $('skip-btn');
    if (b.disabled) return;
    b.disabled = true;
    socket.emit('host:dm-skip', { pin });
    setTimeout(() => { b.disabled = false; }, 800);
  });
  $('end-skip-btn').addEventListener('click', () => socket.emit('host:dm-skip', { pin }));
  $('plus-btn').addEventListener('click', () => socket.emit('host:add-time', { pin, seconds: 30 }));
  $('minus-btn').addEventListener('click', () => { if (!$('minus-btn').disabled) socket.emit('host:add-time', { pin, seconds: -30 }); });
  const endNow = () => { if (confirm('¿Terminar el juego ahora?')) socket.emit('host:end-now', { pin }); };
  $('end-now-btn').addEventListener('click', endNow);
  $('paused-end-btn').addEventListener('click', endNow);
  $('pause-btn').addEventListener('click', () => socket.emit('host:pause', { pin, paused: !paused }));
  $('resume-btn').addEventListener('click', () => socket.emit('host:pause', { pin, paused: false }));
  $('play-again-btn').addEventListener('click', () => {
    socket.emit('host:reset', { pin });
    clearTimers();
    resetBoards();
    game = null;
    lobbyKey = '';
    showScreen('lobby');
  });
  socket.on('host:start-error', (e) => { alert(e && e.message ? e.message : 'No se pudo empezar.'); updateStartBtn(); });
  socket.on('host:time-refused', () => { bigBand('Ya casi se acaba: no se puede quitar más', 'calm', 1600); paintMinus(); });
  function updateStartBtn() {
    if (!state) return;
    $('start-btn').disabled = !(state.state === 'lobby' && state.questionsLoaded > 0 && Object.values(state.players || {}).some((p) => !p.off));
  }
  socket.on('state', (s) => {
    state = s;
    if (s.state === 'lobby') { renderLobby(s.players); updateStartBtn(); }
    if (s.state === 'active' && game) {
      const off = {};
      Object.values(s.players || {}).forEach((p) => { off[String(p.name).toLowerCase()] = !!p.off; });
      Object.values(boards).forEach((b) => {
        let ch = false;
        b.view.seats.forEach((x) => { const k = String(x.name).toLowerCase(); if (k in off && x.on === off[k]) { x.on = !off[k]; ch = true; } });
        if (ch) paintList(b);
      });
    }
  });

  // ---------- lobby ----------
  function renderLobby(players) {
    if (!lobbyStage) { lobbyStage = new S.Stage($('lobby-stage'), { mode: 'big' }); lobbyStage.say('¡Shhh! Dralingo duerme…', 'calm'); }
    const list = Object.values(players || {}).filter((p) => !p.off);
    const key = JSON.stringify(list.map((p) => [p.name, p.avatar]));
    if (key === lobbyKey) return;
    lobbyKey = key;
    const box = $('players-all');
    box.innerHTML = '';
    $('count-all').textContent = list.length === 1 ? '1 jugador' : `${list.length} jugadores`;
    const nb = list.length <= 5 ? 1 : Math.ceil(list.length / 4);
    if (list.length) lobbyStage.say((list.length === 1 ? "1 jugador" : list.length + " jugadores") + (nb === 1 ? " · 1 tablero" : " · " + nb + " tableros"), "calm");
    list.forEach((p) => {
      const d = document.createElement('div');
      d.className = 'dmh-kid' + (seenKids.has(p.name) ? '' : ' new');
      seenKids.add(p.name);
      const skin = skinFor(p.avatar, p.name);
      const im = document.createElement('img');
      im.src = S.tiptoe(skin);
      if (S.flip(skin)) im.className = 'flip';
      im.alt = '';
      const n = document.createElement('span');
      n.textContent = p.name;
      d.append(im, n);
      box.appendChild(d);
    });
    if (!list.length) { const e = document.createElement('p'); e.className = 'dmh-crew-empty'; e.textContent = 'Esperando a los jugadores: entren con el PIN.'; box.appendChild(e); }
  }

  // ---------- the boards ----------
  function resetBoards() {
    Object.values(boards).forEach((b) => { if (b.stage) b.stage.destroy(); });
    boards = {};
    $('boards').innerHTML = '';
  }
  function gridFor(n) {
    const box = $('boards');
    const cols = n <= 1 ? 1 : n <= 4 ? 2 : n <= 6 ? 3 : 4;
    box.style.setProperty('--cols', cols);
    box.style.setProperty('--rows', Math.ceil(n / cols));
    box.classList.toggle('one', n === 1);
    box.classList.toggle('many', n > 4);
  }
  const seatOf = (b, k) => (b.view.seats || []).find((x) => x.k === k) || null;
  function buildBoards(list) {
    resetBoards();
    gridFor(list.length);
    list.forEach((v, i) => addBoardEl(v, i, list.length));
  }
  function addBoardEl(v, i, total) {
    {
      const el = document.createElement('div');
      el.className = 'dmh-board';
      el.innerHTML = '<div class="dmh-bstage"></div><div class="dmh-bhead"><b class="dmh-bname"></b><span class="dmh-bturn"></span><span class="dmh-bcue"></span></div><div class="dmh-blist"></div><div class="dmh-bq hidden"></div>';
      $('boards').appendChild(el);
      const b = { view: v, el, stage: null, turn: null, idx: i };
      el.querySelector('.dmh-bname').textContent = total > 1 ? 'Tablero ' + (i + 1) : 'El tablero';
      b.stage = new S.Stage(el.querySelector('.dmh-bstage'), { mode: total === 1 ? 'big' : 'tile' });
      boards[v.id] = b;
      applyView(b, v);
    }
  }
  function applyView(b, v) {
    b.view = v;
    if (v.phase === 'wake') b.stage.wake(); else b.stage.sleep();
    b.stage.setCue(v.cue || 0);
    const tk = v.turn;
    if (tk != null && (v.phase === 'pre' || v.phase === 'turn')) {
      const s = seatOf(b, tk);
      b.turn = tk;
      b.stage.kid(s ? s.skin : 'dralingo', s ? s.name : '');
      b.stage.closeup(v.phase === 'turn');
      if (v.phase === 'turn') b.stage.featherAt(null, null, s ? s.skin : 'dralingo');
      setTurnLabel(b, v.phase === 'pre' ? 'Turno de ' + (s ? s.name : '…') : (s ? s.name : '') + ' le hace cosquillas…');
    } else { b.turn = null; b.stage.kid(null); b.stage.closeup(v.phase === 'wake'); setTurnLabel(b, v.phase === 'night' ? 'Noche ' + v.night : ''); }
    paintCue(b, v.cue || 0);
    paintList(b);
  }
  function setTurnLabel(b, t) { b.el.querySelector('.dmh-bturn').textContent = t || ''; }
  function paintCue(b, c) {
    const e = b.el.querySelector('.dmh-bcue');
    e.className = 'dmh-bcue c' + c;
    e.textContent = c >= 4 ? '😡' : c >= 3 ? '😣' : c >= 2 ? '😟' : c >= 1 ? '😪' : '😴';
  }
  function paintList(b) {
    const box = b.el.querySelector('.dmh-blist');
    box.innerHTML = '';
    (b.view.seats || []).forEach((x) => {
      const r = document.createElement('div');
      r.className = 'dmh-row' + (b.turn === x.k ? ' turn' : '') + (x.on === false ? ' off' : '');
      const i = document.createElement('img');
      i.alt = '';
      i.src = S.head(x.skin);
      const n = document.createElement('span');
      n.textContent = x.name;
      const fe = document.createElement('i');
      fe.className = 'dmh-rf';
      fe.dataset.k = x.k;
      fe.textContent = '🪶' + (x.feathers != null ? x.feathers : '');
      const sc = document.createElement('b');
      sc.textContent = x.score;
      sc.dataset.k = x.k;
      r.append(i, n, fe, sc);
      box.appendChild(r);
    });
  }
  function setScore(b, k, v, cls) {
    const s = seatOf(b, k);
    if (s) s.score = v;
    const e = b.el.querySelector('.dmh-blist b[data-k="' + k + '"]');
    if (e) { e.textContent = v; if (cls && !reduced()) { e.classList.remove('bump', 'zero'); void e.offsetWidth; e.classList.add(cls); } }
  }
  function setFeathers(b, k, n) {
    const s = seatOf(b, k);
    if (s) s.feathers = n;
    const e = b.el.querySelector('.dmh-blist i[data-k="' + k + '"]');
    if (e) e.textContent = '🪶' + n;
  }
  function paintTop(top) {
    const box = $('top3');
    box.innerHTML = '';
    (top || []).forEach((r, i) => {
      const li = document.createElement('li');
      const im = document.createElement('img');
      im.alt = '';
      im.src = S.tiptoe(r.skin);
      if (S.flip(r.skin)) im.className = 'flip';
      const n = document.createElement('span');
      n.innerHTML = '<i>' + (i + 1) + '</i>';
      n.appendChild(document.createTextNode(r.name));
      const sc = document.createElement('b');
      sc.textContent = r.score + ' ⭐';
      li.append(im, n, sc);
      box.appendChild(li);
    });
  }
  function paintClock() {
    if (!endsAt) return;
    const left = paused ? pausedLeft : endsAt - Date.now();
    $('clock').textContent = fmtClock(left);
    $('clock').parentNode.classList.toggle('hurry', left <= 30000);
    paintMinus();
  }
  function paintMinus() { const left = paused ? pausedLeft : endsAt - Date.now(); $('minus-btn').disabled = !endsAt || left <= 12000 || (game && game.phase === 'final'); }
  function runClock() { if (!clockT) clockT = setInterval(paintClock, 250); paintClock(); }

  // ---------- the game ----------
  socket.on('countdown', () => {
    clearTimers();
    stopMusic();
    showScreen('countdown');
    const box = $('count-stage');
    if (countStage) countStage.destroy();
    box.innerHTML = '';
    countStage = new S.Stage(box, { mode: 'big' });
    countStage.say('¡Shhh! Dralingo duerme…', 'calm');
    sfx('whoosh', 0.6);
    later(1700, () => countStage && countStage.say('¡Que no se despierte!', 'go'));
  });
  onDm('dm:init', (d) => {
    if (!d) return;
    game = { id: d.id, phase: d.phase };
    paused = !!d.paused;
    $('paused').classList.toggle('hidden', !paused);
    if (d.endsMs != null) { endsAt = Date.now() + d.endsMs; pausedLeft = d.endsMs; }
    frenzy = !!d.frenzy;
    $('frenzy-chip').classList.toggle('hidden', !frenzy);
    document.body.classList.toggle('dmh-frenzy', frenzy);
    const same = Object.keys(boards).length === (d.boards || []).length && (d.boards || []).every((v) => boards[v.id]);
    if (!same) buildBoards(d.boards || []);
    else (d.boards || []).forEach((v) => applyView(boards[v.id], v));
    paintTop(d.top);
    if (d.phase !== 'countdown') { showScreen('active'); requestAnimationFrame(() => Object.values(boards).forEach((b) => b.stage.fit())); }
    if (d.phase === 'play' || d.phase === 'intro') runClock();
  });
  onDm('dm:seat', (d) => {
    if (!d.board) return;
    const b = boards[d.board.id];
    if (b) { b.view.seats = d.board.seats; paintList(b); }
    else {
      const n = Object.keys(boards).length + 1;
      if (n === 2) { const list = Object.values(boards).map((x) => x.view).concat([d.board]); buildBoards(list); }   // (one big bedroom becomes two tiles)
      else { gridFor(n); addBoardEl(d.board, n - 1, n); Object.values(boards).forEach((x) => x.stage.fit()); }
    }
  });
  onDm('dm:intro', (d) => {
    showScreen('active');
    requestAnimationFrame(() => Object.values(boards).forEach((b) => b.stage.fit()));
    bigBand('¡Shhh! Dralingo duerme…', 'calm', (d.ms || 2600) - 600);
    later((d.ms || 2600) - 600, () => { bigBand('¡YA!', 'go', 700); sfx('start', 0.7); });
    say('Respondan para ganar plumas… y en su turno, ¡a frotar sin despertarlo!');
  });
  onDm('dm:play', (d) => { if (game) game.phase = 'play'; endsAt = Date.now() + (d.endsMs || 0); runClock(); });
  onDm('dm:pre', (d) => {
    const b = boards[d.b];
    if (!b) return;
    b.turn = d.k;
    Object.assign(b.view, { phase: 'pre', turn: d.k, night: d.night || b.view.night });
    const s = seatOf(b, d.k);
    b.stage.closeup(false);
    b.stage.kid(s ? s.skin : 'dralingo', s ? s.name : '');
    b.stage.featherOn(false);
    b.stage.say('');
    setTurnLabel(b, 'Turno de ' + (s ? s.name : '…'));
    paintList(b);
    if (Date.now() - lastWhisper > 6000) { lastWhisper = Date.now(); const id = pick1(Object.keys(WHISPER)); hostLine(id, pick1(WHISPER[id])); }
    b.el.querySelector('.dmh-bq').classList.add('hidden');
    if (Object.keys(boards).length === 1) { b.stage.say('Turno de ' + (s ? s.name : ''), 'calm', 1600); sfx('round', 0.5); }
  });
  onDm('dm:skip', (d) => { const b = boards[d.b]; if (b && d.k != null) { const s = seatOf(b, d.k); b.stage.say((s ? s.name : 'Alguien') + ' no está', 'calm', 1300); } });
  onDm('dm:go', (d) => {
    const b = boards[d.b];
    if (!b) return;
    const s = seatOf(b, d.k);
    Object.assign(b.view, { phase: 'turn', turn: d.k });
    b.stage.closeup(true);
    b.stage.featherAt(null, null, s ? s.skin : 'dralingo');
    setTurnLabel(b, (s ? s.name : '') + ' le hace cosquillas…');
  });
  onDm('dm:bq', (d) => {
    const b = boards[d.b];
    if (!b) return;
    const q = b.el.querySelector('.dmh-bq');
    q.textContent = d.text;
    q.classList.remove('hidden');
  });
  onDm('dm:pat', (d) => {
    const b = boards[d.b];
    if (!b) return;
    b.stage.cuStroke(d.pts, d.fast);
    b.view.cue = d.cue;
    b.stage.setCue(d.cue);
    paintCue(b, d.cue);
    setScore(b, d.k, d.score, 'bump');
    setFeathers(b, d.k, d.feathers);
    sfx('stroke', 0.55, 250);
    if (d.fast) sfx('creak', 0.45, 500);
    else if (Date.now() - (lastSfx.giggle || 0) > 900) { lastSfx.giggle = Date.now(); setTimeout(() => sfx('giggle' + (1 + Math.floor(Math.random() * 3)), 0.5), 200); }   // his sleepy giggle (one at a time with many boards)
  });
  onDm('dm:miss', (d) => {
    const b = boards[d.b];
    if (!b) return;
    b.stage.stir();
    b.view.cue = d.cue;
    b.stage.setCue(d.cue);
    paintCue(b, d.cue);
    sfx('creak', 0.55, 400);
  });
  onDm('dm:wake', (d) => {
    const b = boards[d.b];
    if (!b) return;
    const s = seatOf(b, d.k);
    Object.assign(b.view, { phase: 'wake', turn: null, cue: 4 });
    b.stage.closeup(true);
    b.stage.featherOff();
    b.stage.wake();
    b.stage.rage(4000);                                  // he is ANGRY: the tile floods red (ring, lines, steam, sparks)
    b.stage.say('¡Se despertó!', 'wake');
    flashRed();
    paintCue(b, 4);
    setScore(b, d.k, 0, 'zero');
    b.turn = null;
    paintList(b);
    setTurnLabel(b, (s ? s.name : '') + (d.lost ? ' pierde ' + d.lost + (d.lost === 1 ? ' punto' : ' puntos') : ' lo despertó'));
    b.el.querySelector('.dmh-bq').classList.add('hidden');
    sfx('wake', 0.75, 900);
    later(260, () => sfx('angry', 0.7, 900));
    later(650, () => sfx('aww', 0.45, 900));
    const line = pick1(WAKE_LINES);
    hostLine('dralingo', 'Dralingo: «' + line + '»');
    later(1100, () => b.stage.speak(line, 2400));
  });
  onDm('dm:end', (d) => {
    const b = boards[d.b];
    if (!b) return;
    const s = seatOf(b, d.k);
    Object.assign(b.view, { phase: 'post', turn: null });
    b.stage.closeup(false);
    b.stage.featherOff();
    b.stage.featherOn(false);
    setScore(b, d.k, d.score);
    if (d.feathers != null) setFeathers(b, d.k, d.feathers);
    b.el.querySelector('.dmh-bq').classList.add('hidden');
    const pts = d.pts != null ? d.pts : d.pats;
    if (d.why !== 'final') setTurnLabel(b, (s ? s.name : '') + (pts ? ': ¡a salvo! +' + pts : ': turno terminado'));
  });
  // a wrong / late answer on a board: he shifts in his sleep there
  onDm('dm:shift', (d) => {
    const b = boards[d.b];
    if (!b) return;
    b.view.cue = d.cue;
    b.stage.setCue(d.cue);
    b.stage.shift();
    paintCue(b, d.cue);
    sfx('shift', 0.3, 2500);
  });
  // the whole projector pulses red for a beat (the tile itself keeps its anger for ~3 s)
  let lastFlash = 0;
  function flashRed() {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (Date.now() - lastFlash < 7000) return;          // (8 boards: never stacked, never more than one a 7 s)
    lastFlash = Date.now();
    const r = document.createElement('div');
    r.className = 'dmh-rage';
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 1700);
  }
  onDm('dm:night', (d) => {
    const b = boards[d.b];
    if (!b) return;
    Object.assign(b.view, { phase: 'night', turn: null, cue: 0, night: d.night });
    b.stage.closeup(false);
    b.stage.sleep();
    b.stage.kid(null);
    paintCue(b, 0);
    b.stage.say('Noche ' + d.night + ' 🌙', 'calm', 2000);
    setTurnLabel(b, 'Se vuelve a dormir…');
  });
  onDm('dm:fe', (d) => { const b = boards[d.b]; if (b && b.view.phase === 'turn') { const s = seatOf(b, d.k); b.stage.featherAt(d.x, d.y, s ? s.skin : 'dralingo'); } });
  onDm('dm:plume', (d) => { const b = boards[d.b]; if (b) setFeathers(b, d.k, d.feathers); });
  onDm('dm:react', (d) => { const b = boards[d.b]; if (b) { const s = seatOf(b, d.k); b.stage.react(d.e, s ? s.skin : null); } });
  onDm('dm:top', (d) => paintTop(d.top));
  onDm('dm:frenzy', (d) => {
    frenzy = !d.off;
    $('frenzy-chip').classList.toggle('hidden', !frenzy);
    document.body.classList.toggle('dmh-frenzy', frenzy);
    if (music) music.playbackRate = frenzy ? 1.18 : 1;
    if (frenzy) { bigBand('🌕 ¡Luna llena! Cosquillas ×2', 'go', 2200); sfx('hurry', 0.8); say('¡Últimos 30 segundos! Cada cosquilla vale 2'); }
  });
  onDm('dm:time', (d) => { endsAt = Date.now() + (d.endsMs || 0); if (paused) pausedLeft = d.endsMs || 0; paintClock(); if (d.add) bigBand((d.add > 0 ? '+' : '−') + Math.abs(d.add) + ' s', 'calm', 900); });
  onDm('dm:pause', (d) => {
    paused = !!d.paused;
    if (paused) pausedLeft = endsAt - Date.now();
    $('paused').classList.toggle('hidden', !paused);
    $('pause-btn').textContent = paused ? '▶ Seguir' : '⏸ Pausa';
    if (paused) stopMusic(); else musicFor();
  });
  onDm('dm:guess', () => {});
  onDm('dm:final', (d) => {
    if (game) game.phase = 'final';
    paintMinus();
    stopMusic();
    bigBand('¡FINAL!', 'final', d.ms || 2400);
    sfx('final', 0.8);
  });
  socket.on('game-end', (data) => {
    clearTimers();
    if (clockT) { clearInterval(clockT); clockT = null; }
    const dm = data && data.dormilon;
    if (!dm) return;
    paused = false;
    $('paused').classList.add('hidden');
    renderEnd(dm);
    showScreen('win');
    sfx('win', 0.8);
  });
  function fig(skin, pose) { return HB.art(skin, pose, pose === 'win'); }
  function renderEnd(dm) {
    const box = $('champs');
    box.innerHTML = '';
    box.classList.toggle('one', (dm.boards || []).length === 1);
    box.classList.toggle('few', (dm.boards || []).length === 2);
    (dm.boards || []).forEach((bd, i) => {
      const c = document.createElement('div');
      c.className = 'dmh-champ';
      const win = (bd.rows || []).filter((r) => (bd.winners || []).includes(r.k));
      const h = document.createElement('h3');
      h.textContent = (dm.boards.length > 1 ? 'Tablero ' + (i + 1) : 'El tablero') + (bd.nights > 1 ? ' · ' + bd.nights + ' noches' : '');
      c.appendChild(h);
      const figs = document.createElement('div');
      figs.className = 'dmh-champ-figs';
      if (win.length) win.forEach((w) => { const im = document.createElement('img'); im.alt = ''; im.src = fig(w.skin, 'win'); figs.appendChild(im); });
      else { const im = document.createElement('img'); im.alt = ''; im.src = A + 'dralingo-awake.webp'; im.className = 'awake'; figs.appendChild(im); }
      c.appendChild(figs);
      const n = document.createElement('p');
      n.className = 'dmh-champ-name';
      n.textContent = win.length ? win.map((w) => w.name).join(' y ') + ' · ' + win[0].score + ' ⭐' : 'Sin campeón: ¡se despertó demasiado!';
      c.appendChild(n);
      if ((bd.stars || []).length) {
        const st = document.createElement('div');
        st.className = 'dmh-champ-stars';
        const ICO = { valiente: '🦁', prudente: '🛡️', racha: '🔥', adivino: '🔮' };
        bd.stars.forEach((s) => {
          const who = (bd.rows || []).filter((r) => (s.winners || []).includes(r.k)).map((r) => r.name).join(' y ');
          const sp = document.createElement('span');
          sp.textContent = (ICO[s.id] || '⭐') + ' ' + s.name + ': ' + who;
          st.appendChild(sp);
        });
        c.appendChild(st);
      }
      box.appendChild(c);
    });
    const pod = $('podium');
    pod.innerHTML = '';
    const order = [1, 0, 2];
    order.forEach((i) => {
      const r = (dm.podium || [])[i];
      const col = document.createElement('div');
      col.className = 'dmh-pod p' + (i + 1);
      if (r && r.score > 0) {
        const im = document.createElement('img');
        im.alt = '';
        im.src = fig(r.skin, i === 0 ? 'win' : 'ok');
        const n = document.createElement('span');
        n.textContent = r.name;
        const sc = document.createElement('b');
        sc.textContent = r.score + ' ⭐';
        col.append(im, n, sc);
      }
      const step = document.createElement('div');
      step.className = 'dmh-step';
      step.textContent = i + 1;
      col.appendChild(step);
      pod.appendChild(col);
    });
    const anyWin = (dm.winners || []).length;
    $('end-title').textContent = anyWin ? '¡Campeones de la noche!' : '¡Dralingo ganó esta vez! 😅';
  }

  window.DormHost = {
    frame: () => ({ pin, phase: game && game.phase, boards: Object.keys(boards).length, paused, frenzy, clock: $('clock').textContent }),
    freeze: (v) => { frozen = !!v; if (!frozen) { const q = queue; queue = []; q.forEach(([fn, d]) => fn(d)); } if (S.freeze) S.freeze(v); return queue.length; },
  };
})();
