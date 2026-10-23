// ¡Atrapa a Fénec! — the projector (secondary: the phones are the product). Lobby (PIN + QR, 2 / 3 / 4 min, «¡Empezar!»,
// the game in 3 pictures, the crab on the beach, the players) → the countdown on the beach → every crew as its own beach
// tile (its crab with the kids' faces in the cockpits, the hammers live with their shadows, Fénec dodging, El Péndulo,
// the words the crew got back) + the crews' standings → «¡FINAL!» → each crew's ending (caught / escaped) and champion,
// the crews, the class podium. Teacher buttons always work: Pausa, +30 s, −30 s, Saltar, Terminar, Sonido.
// Test hooks: CrabHost.frame(), CrabHost.freeze(v).
(function () {
  'use strict';
  const socket = io();
  const $ = (id) => document.getElementById(id);
  const S = window.CrabStage;
  const HB = window.HalconBoard;
  const A = '/assets/teamcrab/', H = '/assets/halcon/', K = '/assets/kingdoms/', PARTY = '/assets/party/';
  const SFX = {
    thud: A + 'thud.mp3', clank: A + 'clank.mp3', crash: A + 'crash.mp3', tick: A + 'tick.mp3', swing: A + 'swing.mp3',
    slurp: A + 'slurp.mp3', giggle: A + 'giggle.mp3', pop: H + 'pop.mp3', star: '/assets/mochi/star.mp3', start: H + 'start.mp3',
    whoosh: K + 'whoosh.mp3', win: K + 'sting-win.mp3', final: H + 'final.mp3', hurry: PARTY + 'hurry.mp3', streak: K + 'streak.mp3',
  };
  const MUSIC = { lobby: K + 'music-lobby.mp3', play: A + 'music-beach.mp3', final: K + 'music-final.mp3' };   // (the beach tune: Kenney «Night at the Beach»)
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const skinFor = HB.skinFor;
  const GANG = {
    fer: ['¡Atención, equipo! Tapen sus salidas.', '¡Respondan bien y carguen el martillo!'],
    hamdan: ['¡Yalla! ¡Juntos lo atrapamos!', 'Con calma, como un halcón.'],
    latifa: ['Tengo un plan: uno encima, otro al lado.', 'Cada palabra es una pista.'],
    aileen: ['¡Dale, vos podés! ¡Aplastalo!', '¿Viste? ¡Se escapa por el costado!'],
    adric: ['Mira… se mueve a la izquierda.', 'Sígueme.'],
    adrian: ['¡Por aquí! ¡Rodéenlo!', '¡A la aventura!'],
  };
  const pick1 = (a) => a[Math.floor(Math.random() * a.length)];
  const fmtClock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  let pin = null, state = null, muted = false, paused = false, duration = 120, endsAt = 0, pausedLeft = 0, frenzy = false;
  let game = null;
  let boards = {};               // id → { view, stage, el }
  let lobbyStage = null, countStage = null, lobbyKey = '', seenKids = new Set(), clockT = null, timers = [];
  let frozen = false, queue = [];
  const onTc = (ev, fn) => socket.on(ev, (d) => { if (frozen && ev.indexOf('tc:') === 0) { queue.push([fn, d]); return; } fn(d); });

  // ---------- sound ----------
  let music = null, musicName = null;
  const lastSfx = {};
  function sfx(name, vol, gap) {
    if (muted || !SFX[name]) return;
    const now = Date.now();
    if (gap && now - (lastSfx[name] || 0) < gap) return;      // 8 crews at once must not become noise
    lastSfx[name] = now;
    try { const a = new Audio(SFX[name]); a.volume = vol || 0.6; a.play().catch(() => {}); } catch (_) {}
  }
  function playMusic(name, vol) {
    if (musicName === name) return;
    stopMusic();
    musicName = name;
    if (muted || !MUSIC[name]) return;
    try { music = new Audio(MUSIC[name]); music.loop = true; music.volume = vol || 0.3; if (name === 'play' && frenzy) music.playbackRate = 1.15; music.play().catch(() => {}); } catch (_) {}
  }
  function stopMusic() { if (music) { try { music.pause(); } catch (_) {} } music = null; musicName = null; }
  function musicFor() {
    if (muted) return;
    if (!$('screen-lobby').classList.contains('hidden')) playMusic('lobby', 0.3);
    else if (!$('screen-active').classList.contains('hidden') && !paused) playMusic('play', 0.26);
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
    document.body.classList.toggle('tch-ended', name === 'win');
    musicFor();
  }
  function say(text, who) {
    $('host-say').textContent = text;
    const im = $('host-img');
    const Cc = window.DralingoCast;
    // (his animations, Canva 2026-10-23: Fénec's cheeky idle, El Péndulo swinging; the gang's own poses)
    if (im) im.src = who === 'fenec' || !who ? A + 'anim/fenec-idle.webp' : who === 'pendulo' ? A + 'anim/pendulo-swing.webp' : Cc ? Cc.pose(who, 'hello') : A + 'anim/fenec-idle.webp';
  }
  function bigBand(text, kind, ms) {
    const b = $('bigband');
    b.textContent = text;
    b.className = 'tch-bigband' + (kind ? ' ' + kind : '');
    void b.offsetWidth;
    later(ms || 1400, () => b.classList.add('hidden'));
  }

  // ---------- room ----------
  const params = new URLSearchParams(location.search);
  const setId = params.get('setId');
  const LIVE = params.get('livegame') === '1' ? '&livegame=1' : '';
  if (!setId) { location.href = '/packs.html?game=teamcrab' + LIVE; return; }
  socket.emit('host:create', { gameType: 'teamcrab' }, ({ pin: p }) => {
    if (!p) return;
    pin = p;
    $('pin-display').textContent = p;
    $('active-pin').textContent = p;
    const url = `${location.origin}/?pin=${p}`;
    $('join-url').textContent = url;
    document.title = `¡Atrapa a Fénec! · ${p}`;
    drawQr(url);
    socket.emit('host:set-duration', { pin, duration });
    socket.emit('host:load-set', { pin, setId }, (resp) => {
      if (!resp || !resp.ok) { alert('No se pudo cargar la serie de preguntas.'); location.href = '/packs.html?game=teamcrab' + LIVE; return; }
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
  document.querySelectorAll('.tch-dur button').forEach((b) => b.addEventListener('click', () => {
    duration = +b.dataset.s;
    document.querySelectorAll('.tch-dur button').forEach((x) => x.classList.toggle('on', x === b));
    socket.emit('host:set-duration', { pin, duration });
  }));
  $('start-btn').addEventListener('click', () => { $('start-btn').disabled = true; socket.emit('host:start', { pin }); });
  $('skip-btn').addEventListener('click', () => {
    const b = $('skip-btn');
    if (b.disabled) return;
    b.disabled = true;
    socket.emit('host:tc-skip', { pin });
    setTimeout(() => { b.disabled = false; }, 800);
  });
  $('end-skip-btn').addEventListener('click', () => socket.emit('host:tc-skip', { pin }));
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
        b.view.seats.forEach((x) => { const k = String(x.name).toLowerCase(); if (k in off && x.on === off[k]) { x.on = !off[k]; b.stage.setOn(x.k, x.on); } });
      });
    }
  });

  // ---------- lobby ----------
  function renderLobby(players) {
    if (!lobbyStage) {
      lobbyStage = new S.Stage($('lobby-stage'), { mode: 'big' });
      // (alive, not overdone: Fénec taunts now and then, hops between the spots)
      let at = 2;
      const live = () => {
        if (!lobbyStage || $('screen-lobby').classList.contains('hidden')) return;
        const to = Math.max(0, Math.min(4, at + (Math.random() < 0.5 ? -1 : 1)));
        lobbyStage.hop(at, to, 300);
        at = to;
        if (Math.random() < 0.5) setTimeout(() => lobbyStage && lobbyStage.taunt('idle', null, 2200), 400);
      };
      setInterval(live, 3400);
    }
    const list = Object.values(players || {}).filter((p) => !p.off);
    const key = JSON.stringify(list.map((p) => [p.name, p.avatar]));
    if (key === lobbyKey) return;
    lobbyKey = key;
    const box = $('players-all');
    box.innerHTML = '';
    $('count-all').textContent = list.length === 1 ? '1 jugador' : `${list.length} jugadores`;
    const nb = list.length <= 5 ? 1 : Math.ceil(list.length / 4);
    lobbyStage.setCrew(list.slice(0, 4).map((p, i) => ({ k: i + 1, name: p.name, skin: skinFor(p.avatar, p.name) })), null);
    if (list.length) lobbyStage.say((list.length === 1 ? '1 jugador' : list.length + ' jugadores') + (nb === 1 ? ' · 1 cangrejo' : ' · ' + nb + ' cangrejos'), 'calm', 2600);
    list.forEach((p) => {
      const d = document.createElement('div');
      d.className = 'tch-kid' + (seenKids.has(p.name) ? '' : ' new');
      seenKids.add(p.name);
      const skin = skinFor(p.avatar, p.name);
      const im = document.createElement('img');
      im.src = S.fig(skin, 'idle');
      im.alt = '';
      const n = document.createElement('span');
      n.textContent = p.name;
      d.append(im, n);
      box.appendChild(d);
    });
    if (!list.length) { const e = document.createElement('p'); e.className = 'tch-crew-empty'; e.textContent = 'Esperando a los tripulantes: entren con el PIN.'; box.appendChild(e); }
  }

  // ---------- the crews ----------
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
  function buildBoards(list) {
    resetBoards();
    gridFor(list.length);
    list.forEach((v, i) => addBoardEl(v, i, list.length));
  }
  function addBoardEl(v, i, total) {
    const el = document.createElement('div');
    el.className = 'tch-board';
    el.innerHTML = '<div class="tch-bstage"></div><div class="tch-bhead"><b class="tch-bname"></b><div class="tch-bsack"><i></i></div><span class="tch-bwords"></span></div>';
    $('boards').appendChild(el);
    const b = { view: v, el, stage: null, idx: i };
    el.querySelector('.tch-bname').textContent = total > 1 ? 'Cangrejo ' + (i + 1) : 'El cangrejo';
    b.stage = new S.Stage(el.querySelector('.tch-bstage'), { mode: total === 1 ? 'big' : 'tile' });
    boards[v.id] = b;
    applyView(b, v);
  }
  function applyView(b, v) {
    b.view = v;
    b.stage.setCrew(v.seats, null);
    (v.hammers || []).forEach((h) => b.stage.ham(h.k, h.st, h.x));
    b.stage.placeFen(v.fx, false);
    b.stage.setAnger(v.anger || 0);
    paintWords(b);
  }
  function paintWords(b, pop) {
    const v = b.view;
    const f = b.el.querySelector('.tch-bsack i');
    f.style.width = Math.min(100, Math.round((100 * v.words) / Math.max(1, v.target))) + '%';
    b.el.querySelector('.tch-bwords').textContent = '📚 ' + v.words + ' / ' + v.target + (v.words >= v.target ? ' ✓' : '');
    b.el.classList.toggle('full', v.words >= v.target);
    if (pop && !reduced()) { b.el.classList.remove(pop); void b.el.offsetWidth; b.el.classList.add(pop); }
  }
  function paintCrews(list) {
    const box = $('crews');
    box.innerHTML = '';
    (list || []).forEach((c, i) => {
      const b = boards[c.id];
      const li = document.createElement('li');
      li.className = c.words >= c.target ? 'full' : '';
      const n = document.createElement('span');
      n.innerHTML = '<i>' + (i + 1) + '</i>';
      n.appendChild(document.createTextNode(b ? (Object.keys(boards).length > 1 ? 'Cangrejo ' + (b.idx + 1) : 'El cangrejo') : 'Cangrejo'));
      const heads = document.createElement('em');
      (b ? b.view.seats : []).slice(0, 5).forEach((x) => { const im = document.createElement('img'); im.alt = ''; im.src = S.head(x.skin); heads.appendChild(im); });
      const sc = document.createElement('b');
      sc.textContent = c.words + ' / ' + c.target + ' 📚';
      li.append(n, heads, sc);
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
    countStage.say('¡Fénec se robó las palabras!', 'calm');
    countStage.taunt('idle', '¡Mías, mías! 😜', 2400);
    sfx('clank', 0.7);
    later(1700, () => countStage && countStage.say('¡A los cangrejos!', 'go'));
  });
  onTc('tc:init', (d) => {
    if (!d) return;
    game = { id: d.id, phase: d.phase };
    paused = !!d.paused;
    $('paused').classList.toggle('hidden', !paused);
    if (d.endsMs != null) { endsAt = Date.now() + d.endsMs; pausedLeft = d.endsMs; }
    frenzy = !!d.frenzy;
    $('frenzy-chip').classList.toggle('hidden', !frenzy);
    document.body.classList.toggle('tch-frenzy', frenzy);
    const same = Object.keys(boards).length === (d.boards || []).length && (d.boards || []).every((v) => boards[v.id]);
    if (!same) buildBoards(d.boards || []);
    else (d.boards || []).forEach((v) => applyView(boards[v.id], v));
    paintCrews(d.crews);
    if (d.phase !== 'countdown') { showScreen('active'); requestAnimationFrame(() => Object.values(boards).forEach((b) => b.stage.fit())); }
    if (d.phase === 'play' || d.phase === 'intro') runClock();
  });
  onTc('tc:seat', (d) => {
    if (!d.board) return;
    const b = boards[d.board.id];
    if (b) { applyView(b, d.board); }
    else {
      const n = Object.keys(boards).length + 1;
      if (n === 2) { const list = Object.values(boards).map((x) => x.view).concat([d.board]); buildBoards(list); }
      else { gridFor(n); addBoardEl(d.board, n - 1, n); Object.values(boards).forEach((x) => x.stage.fit()); }
    }
  });
  onTc('tc:intro', (d) => {
    showScreen('active');
    requestAnimationFrame(() => Object.values(boards).forEach((b) => b.stage.fit()));
    bigBand('¡Atrapa a Fénec!', 'go', (d.ms || 2600) - 600);
    later((d.ms || 2600) - 600, () => { bigBand('¡YA!', 'go', 700); sfx('start', 0.7); sfx('clank', 0.6); });
    say('¡Mías, mías! ¡No me atrapan! 😜', 'fenec');
  });
  onTc('tc:play', (d) => { if (game) game.phase = 'play'; endsAt = Date.now() + (d.endsMs || 0); runClock(); });
  const viewHam = (b, k, st, x) => { const h = (b.view.hammers || []).find((y) => y.k === k); if (h) { if (st) h.st = st; if (x != null) h.x = x; } };
  onTc('tc:ham', (d) => { const b = boards[d.b]; if (b) { b.stage.ham(d.k, d.st, d.x); viewHam(b, d.k, d.st, d.x); } });
  onTc('tc:aim', (d) => { const b = boards[d.b]; if (b) { b.stage.aim(d.k, d.x); viewHam(b, d.k, null, d.x); } });
  onTc('tc:slam', (d) => { const b = boards[d.b]; if (!b) return; b.stage.slam(d.k, d.x, d.ms); later((d.ms || 420) - 20, () => sfx('thud', 0.45, 160)); });
  onTc('tc:hop', (d) => { const b = boards[d.b]; if (b) { b.view.fx = d.to; b.stage.hop(d.from, d.to, d.ms); } });
  onTc('tc:up', (d) => { const b = boards[d.b]; if (b) { b.view.fx = d.to; b.stage.up(d.from, d.to, d.ms); } });
  onTc('tc:taunt', (d) => {
    const b = boards[d.b];
    if (!b) return;
    if (Object.keys(boards).length <= 4) b.stage.taunt(d.line);
    if (d.line === 'mias') sfx('giggle', 0.4, 2500);
  });
  let lastGang = 0;
  onTc('tc:bonk', (d) => {
    const b = boards[d.b];
    if (!b) return;
    b.view.words = d.words; b.view.target = d.target;
    paintWords(b, 'pop');
    b.stage.bonk(d.k, d.flying, d.pts, d.ms);
    b.el.classList.remove('bonked'); void b.el.offsetWidth; b.el.classList.add('bonked');
    sfx('thud', 0.8, 200);
    later(90, () => sfx('pop', 0.6, 300));
    later(700, () => sfx('star', 0.6, 500));
    const s = (b.view.seats || []).find((x) => x.k === d.k);
    if (Date.now() - lastGang > 5000) {
      lastGang = Date.now();
      say('¡' + (s ? s.name : 'La tripulación') + ' aplastó a Fénec! +' + d.pts + ' palabras 📚' + ((d.assists || []).length ? ' · ¡con trampa!' : ''), s ? null : 'fer');
      later(2600, () => { const id = pick1(Object.keys(GANG)); say(pick1(GANG[id]), id); });
    }
  });
  onTc('tc:full', (d) => { const b = boards[d.b]; if (b) { bigBand('🎒 ¡Cangrejo ' + (b.idx + 1) + ' vació la bolsa!', 'go', 1800); sfx('win', 0.5, 2000); } });
  onTc('tc:snatch', (d) => { const b = boards[d.b]; if (!b) return; b.view.words = d.words; paintWords(b, d.n ? 'drop' : null); if (d.n) b.stage.snatch('📚'); });
  onTc('tc:feed', (d) => { const b = boards[d.b]; if (!b) return; b.view.anger = d.anger; b.stage.feed(d.anger); later(560, () => sfx('slurp', 0.35, 1500)); });
  onTc('tc:calm', (d) => { const b = boards[d.b]; if (b) { b.view.anger = d.anger; b.stage.calm(d.anger); } });
  onTc('tc:calmdown', (d) => { const b = boards[d.b]; if (b) { b.view.anger = d.anger; b.stage.setAnger(d.anger); } });
  let lastFlash = 0;
  onTc('tc:swing', (d) => {
    const b = boards[d.b];
    if (!b) return;
    b.stage.swing(d.ms);
    b.el.classList.remove('swung'); void b.el.offsetWidth; b.el.classList.add('swung');
    sfx('swing', 0.85, 800);
    later(260, () => sfx('clank', 0.6, 800));
    say('El Péndulo: «¡Enójate! ¡Ñam!» · los errores lo alimentan, ¡respiren y respondan bien!', 'pendulo');
    if (!reduced() && Date.now() - lastFlash > 7000) {
      lastFlash = Date.now();
      const r = document.createElement('div');
      r.className = 'tch-purple';
      document.body.appendChild(r);
      setTimeout(() => r.remove(), 1700);
    }
  });
  onTc('tc:react', (d) => { const b = boards[d.b]; if (b) { const s = (b.view.seats || []).find((x) => x.k === d.k); b.stage.react(d.e, s ? s.skin : null); } });
  onTc('tc:crews', (d) => paintCrews(d.crews));
  onTc('tc:frenzy', (d) => {
    frenzy = !d.off;
    $('frenzy-chip').classList.toggle('hidden', !frenzy);
    document.body.classList.toggle('tch-frenzy', frenzy);
    if (music) music.playbackRate = frenzy ? 1.15 : 1;
    if (frenzy) { bigBand('🌅 ¡Atardecer dorado! Martillazos ×2', 'go', 2200); sfx('hurry', 0.8); say('¡Últimos 30 segundos! Cada martillazo vale doble', 'fer'); }
  });
  onTc('tc:time', (d) => { Object.entries(d.targets || {}).forEach(([id, t]) => { const b = boards[id]; if (b) { b.view.target = t; paintWords(b); } }); endsAt = Date.now() + (d.endsMs || 0); if (paused) pausedLeft = d.endsMs || 0; paintClock(); if (d.add) bigBand((d.add > 0 ? '+' : '−') + Math.abs(d.add) + ' s', 'calm', 900); });
  onTc('tc:pause', (d) => {
    paused = !!d.paused;
    if (paused) pausedLeft = endsAt - Date.now();
    $('paused').classList.toggle('hidden', !paused);
    $('pause-btn').textContent = paused ? '▶ Seguir' : '⏸ Pausa';
    if (paused) stopMusic(); else musicFor();
  });
  onTc('tc:final', (d) => {
    if (game) game.phase = 'final';
    paintMinus();
    stopMusic();
    bigBand('¡FINAL!', 'final', d.ms || 2400);
    sfx('final', 0.8);
  });
  socket.on('game-end', (data) => {
    clearTimers();
    if (clockT) { clearInterval(clockT); clockT = null; }
    const tc = data && data.teamcrab;
    if (!tc) return;
    paused = false;
    $('paused').classList.add('hidden');
    renderEnd(tc);
    showScreen('win');
    sfx('win', 0.8);
  });
  function fig(skin, pose) { return HB.art(skin, pose, pose === 'win'); }
  function renderEnd(tc) {
    const box = $('champs');
    box.innerHTML = '';
    box.scrollTop = 0;
    try { window.scrollTo(0, 0); } catch (_) {}                  // (the end opens at its top: the last game's scroll never carries over)
    const n = (tc.boards || []).length;
    box.classList.toggle('one', n === 1);
    box.classList.toggle('few', n === 2);
    const ICO = { martillo: '🔨', trampa: '🪤', racha: '🔥' };
    (tc.boards || []).forEach((bd, i) => {
      const c = document.createElement('div');
      c.className = 'tch-champ ' + (bd.caught ? 'caught' : 'escaped');
      const h = document.createElement('h3');
      h.textContent = (n > 1 ? 'Cangrejo ' + (i + 1) : 'El cangrejo') + (bd.caught ? ' · ¡Atrapado! 🎉' : ' · se escapó 😜');
      c.appendChild(h);
      const res = document.createElement('div');
      res.className = 'tch-champ-res';
      const fx = document.createElement('img');
      fx.alt = '';
      fx.src = A + (bd.caught ? 'fenec-run.webp' : 'fenec-kick.webp');
      const cr = document.createElement('img');
      cr.alt = '';
      cr.className = 'crab';
      cr.src = A + (bd.caught ? 'crab-hero.webp' : 'crab-broken.webp');
      res.append(cr, fx);
      c.appendChild(res);
      const w = document.createElement('p');
      w.className = 'tch-champ-words';
      w.textContent = bd.caught ? '📚 ¡' + bd.words + ' palabras recuperadas! (meta: ' + bd.target + ')' : '📚 ' + bd.words + ' de ' + bd.target + ' palabras · ¡la próxima!';
      c.appendChild(w);
      const win = (bd.rows || []).filter((r) => (bd.winners || []).includes(r.k));
      const figs = document.createElement('div');
      figs.className = 'tch-champ-figs';
      win.forEach((x) => { const im = document.createElement('img'); im.alt = ''; im.src = fig(x.skin, 'win'); figs.appendChild(im); });
      c.appendChild(figs);
      const nm = document.createElement('p');
      nm.className = 'tch-champ-name';
      nm.textContent = win.length ? win.map((x) => x.name).join(' y ') + ' · ' + win[0].words + ' 📚' : '¡La próxima es suya!';
      c.appendChild(nm);
      if ((bd.stars || []).length) {
        const st = document.createElement('div');
        st.className = 'tch-champ-stars';
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
    const ce = $('crews-end');
    ce.innerHTML = '';
    (tc.crews || []).forEach((c) => {
      const li = document.createElement('li');
      li.className = c.caught ? 'caught' : '';
      const idx = (tc.boards || []).findIndex((b) => b.id === c.id);
      li.innerHTML = '<i>' + c.rank + '</i>';
      li.appendChild(document.createTextNode((n > 1 ? 'Cangrejo ' + (idx + 1) : 'El cangrejo') + (c.caught ? ' 🎉' : '')));
      const b = document.createElement('b');
      b.textContent = c.words + ' 📚';
      li.appendChild(b);
      ce.appendChild(li);
    });
    const pod = $('podium');
    pod.innerHTML = '';
    [1, 0, 2].forEach((i) => {
      const r = (tc.podium || [])[i];
      const col = document.createElement('div');
      col.className = 'tch-pod p' + (i + 1);
      if (r && r.words > 0) {
        const im = document.createElement('img');
        im.alt = '';
        im.src = fig(r.skin, i === 0 ? 'win' : 'ok');
        const nm = document.createElement('span');
        nm.textContent = r.name;
        const sc = document.createElement('b');
        sc.textContent = r.words + ' 📚';
        col.append(im, nm, sc);
      }
      const step = document.createElement('div');
      step.className = 'tch-step';
      step.textContent = i + 1;
      col.appendChild(step);
      pod.appendChild(col);
    });
    const any = (tc.boards || []).some((b) => b.caught);
    $('end-title').textContent = any ? (n > 1 && (tc.boards || []).every((b) => b.caught) ? '¡Todos atraparon a Fénec! 🎉' : '¡Atrapamos a Fénec! 🎉') : '¡Fénec se escapó esta vez! 😜';
  }

  window.CrabHost = {
    frame: () => ({ pin, phase: game && game.phase, boards: Object.keys(boards).length, paused, frenzy, clock: $('clock').textContent }),
    freeze: (v) => { frozen = !!v; if (!frozen) { const q = queue; queue = []; q.forEach(([fn, d]) => fn(d)); } if (S.freeze) S.freeze(v); return queue.length; },
    boardStage: (id) => (boards[id] ? boards[id].stage : null),
  };
})();
