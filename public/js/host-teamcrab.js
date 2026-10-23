// Draly Cangrejo · ¡Atrapa a Fénec! — the projector (secondary: the phones are the product). Lobby (PIN + QR, 2 / 3 / 4
// min, «¡Empezar!», «🤖 Probar con robots», the game in 3 pictures, the crab on the beach, the players) → the countdown on
// the beach → every crew as its own beach tile (its crab walking with the kids' faces in the cockpits, the Capitán's star,
// the hammers live with their shadows, Fénec running his pattern, El Péndulo eating the misses, the words the crew got
// back) + the round bar (questions / «¡A martillar!») + the crews' standings → «¡FINAL!» → each crew's ending (caught /
// escaped) and champion, the crews, the class podium. Teacher buttons always work: Pausa, +30 s, −30 s, Saltar (the
// current window), Terminar, Sonido. Test hooks: CrabHost.frame(), CrabHost.freeze(v), CrabHost.boardStage(id).
// v3 «1 contra 3» (the lobby's «🎮 Modo», host:tc-mode): each round one kid of every crew is Fénec (his face and name
// ride over him; he runs where his phone says), the others martillan; «¡Tiempo!» shows how long he lasted.
(function () {
  'use strict';
  const socket = io();
  const $ = (id) => document.getElementById(id);
  const S = window.CrabStage;
  const HB = window.HalconBoard;
  const A = '/assets/teamcrab/', H = '/assets/halcon/', K = '/assets/kingdoms/', PARTY = '/assets/party/';
  const SFX = {
    thud: A + 'thud.mp3', clank: A + 'clank.mp3', crash: A + 'crash.mp3', tick: A + 'tick.mp3', swing: A + 'swing.mp3',
    slurp: A + 'slurp.mp3', chomp: A + 'chomp.mp3', giggle: A + 'giggle.mp3', pop: H + 'pop.mp3', star: '/assets/mochi/star.mp3', start: H + 'start.mp3',
    whoosh: K + 'whoosh.mp3', win: K + 'sting-win.mp3', final: PARTY + 'final-v2.mp3', hurry: PARTY + 'hurry.mp3', tick2: PARTY + 'tick-v2.mp3', tock2: PARTY + 'tock-v2.mp3', streak: K + 'streak.mp3',
  };
  const MUSIC = { lobby: K + 'music-lobby.mp3', play: A + 'music-beach.mp3', final: K + 'music-final.mp3' };   // (the beach tune: Kenney «Night at the Beach»)
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const skinFor = HB.skinFor;
  const GANG = {
    fer: ['¡Atención, equipo! Capitán, ¡llévalos debajo de Fénec!', '¡Respondan bien y ganen martillazos!'],
    hamdan: ['¡Yalla! ¡Juntos lo atrapamos!', 'Con calma, como un halcón: mira dónde para.'],
    latifa: ['Tengo un plan: esperen a que se quede quieto.', 'Cada palabra es una pista.'],
    aileen: ['¡Dale, vos podés! ¡Aplastalo!', '¿Viste? ¡Se agacha antes de correr!'],
    adric: ['Mira… se agacha hacia donde va a correr.', 'Sígueme.'],
    adrian: ['¡Por aquí! ¡Rodéenlo!', '¡A la aventura!'],
  };
  const pick1 = (a) => a[Math.floor(Math.random() * a.length)];
  const fmtClock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  let pin = null, state = null, muted = false, paused = false, duration = 120, endsAt = 0, pausedLeft = 0, frenzy = false;
  let game = null, rules = null, robots = [], gmode = 'crew';
  let rd = { n: 0, total: 0, phase: 'none', final: false, until: 0, ms: 1 };
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
    if (im) im.src = who === 'fenec' || !who ? A + 'anim/fenec-idle.webp' : who === 'pendulo' ? A + 'pendulo-eat.webp' : Cc ? Cc.pose(who, 'hello') : A + 'anim/fenec-idle.webp';
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
    document.title = `Draly Cangrejo · ${p}`;
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
  // «🤖 Probar con robots»: 3 robot crewmates (he can try the game with one phone); a second tap takes them away
  $('robots-btn').addEventListener('click', () => { if (pin) socket.emit('host:tc-robots', { pin, on: !robots.length }); });
  // «🎮 Modo»: «Todos contra Fénec» (v2) or «1 contra 3» (a kid is Fénec each round); it stays for «Otra ronda»
  function paintMode(m) {
    gmode = m === 'vs' ? 'vs' : 'crew';
    document.querySelectorAll('.tch-mode button').forEach((x) => { const onB = x.dataset.mode === gmode; x.classList.toggle('on', onB); x.setAttribute('aria-pressed', onB ? 'true' : 'false'); });
    document.body.classList.toggle('tch-vs', gmode === 'vs');
    const tl = $('tagline');
    if (tl) { if (!tl.dataset.crew) tl.dataset.crew = tl.textContent; tl.textContent = gmode === 'vs' ? '1 contra 3: cada ronda, preguntas rápidas (cada respuesta buena = un martillazo o un turbo); luego el mejor de cada cangrejo ES Fénec por 10 segundos y corre por el muelle esquivando las sombras, y los demás manejan el cangrejo y lo martillan. Todos corren por turnos. Si fallan, El Péndulo se come su martillazo.' : tl.dataset.crew; }
    const st = document.querySelectorAll('.tch-steps li');
    if (st[0]) { const sm0 = st[0].querySelector('small'); if (sm0) sm0.textContent = gmode === 'vs' ? '= +1 martillazo 🔨 o +1 turbo ⚡' : '= +1 martillazo 🔨'; }
    if (st[2]) { const im = st[2].querySelector('img.fx'); if (im) im.src = A + (gmode === 'vs' ? 'fenec-back.webp' : 'fenec-idle.webp'); const sm = st[2].querySelector('small'); if (sm) sm.textContent = gmode === 'vs' ? 'el mejor de la ronda es Fénec 🦊 y corre · los demás lo martillan' : 'toca a Fénec: ¡BONK! · el mejor es ⭐ Capitán y mueve el cangrejo'; }
  }
  document.querySelectorAll('.tch-mode button').forEach((b) => b.addEventListener('click', () => { if (!pin) return; paintMode(b.dataset.mode); socket.emit('host:tc-mode', { pin, mode: b.dataset.mode }); }));
  socket.on('tc:mode', (d) => paintMode(d && d.mode));
  socket.on('tc:robots', (d) => {
    robots = (d && d.on && d.robots) || [];
    const b = $('robots-btn');
    b.classList.toggle('on', !!robots.length);
    b.setAttribute('aria-pressed', robots.length ? 'true' : 'false');
    b.textContent = robots.length ? '🤖 Robots: sí (quitar)' : '🤖 Probar con robots';
    lobbyKey = '';
    if (state) renderLobby(state.players);
  });
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
    document.body.classList.remove('tch-pw');
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
    $('robots-btn').disabled = s.state !== 'lobby';
    document.querySelectorAll('.tch-mode button').forEach((x) => { x.disabled = s.state !== 'lobby'; });
    if (s.state === 'lobby' && s.tcMode && s.tcMode !== gmode) paintMode(s.tcMode);
    if (s.state === 'active' && game) {
      const off = {};
      Object.values(s.players || {}).forEach((p) => { off[String(p.name).toLowerCase()] = !!p.off; });
      Object.values(boards).forEach((b) => {
        b.view.seats.forEach((x) => { if (x.robot) return; const k = String(x.name).toLowerCase(); if (k in off && x.on === off[k]) { x.on = !off[k]; b.stage.setOn(x.k, x.on); } });
      });
    }
  });

  // ---------- lobby ----------
  // (alive, not overdone: Fénec crouches and runs along the dock now and then, and taunts)
  let lobbyAt = 2;
  function lobbyMove() {
    if (!lobbyStage || $('screen-lobby').classList.contains('hidden')) return;
    const to = Math.max(0, Math.min(4, lobbyAt + (lobbyAt <= 0.5 ? 2 : lobbyAt >= 3.5 ? -2 : Math.random() < 0.5 ? -2 : 2)));
    const dir = to > lobbyAt ? 1 : -1;
    const from = lobbyAt;
    lobbyStage.fenec({ mode: 'crouch', x: from, x0: from, x1: to, dir, ms: 300, dur: 300 });
    setTimeout(() => { if (!lobbyStage) return; const dur = Math.abs(to - from) / 3.2 * 1000; lobbyStage.fenec({ mode: 'run', x: from, x0: from, x1: to, dir, ms: dur, dur }); setTimeout(() => lobbyStage && lobbyStage.fenec({ mode: 'idle', x: to, x0: to, x1: to, dir, ms: 1000, dur: 1000 }), dur); }, 300);
    lobbyStage.steer(Math.max(0.6, Math.min(3.4, to)));
    lobbyAt = to;
    if (Math.random() < 0.5) setTimeout(() => lobbyStage && lobbyStage.taunt('idle', null, 2200), 1100);
  }
  function renderLobby(players) {
    if (!lobbyStage) {
      lobbyStage = new S.Stage($('lobby-stage'), { mode: 'big' });
      setInterval(lobbyMove, 3400);
    }
    const list = Object.values(players || {}).filter((p) => !p.off);
    const key = JSON.stringify(list.map((p) => [p.name, p.avatar]).concat(robots.map((r) => [r.name])));
    if (key === lobbyKey) return;
    lobbyKey = key;
    const box = $('players-all');
    box.innerHTML = '';
    const bots = list.length >= 1 && list.length <= 2 ? robots.slice(0, 4 - list.length) : [];   // (robots only join a teacher trying alone: 1-2 phones)
    const n = list.length + bots.length;
    $('count-all').textContent = (list.length === 1 ? '1 jugador' : `${list.length} jugadores`) + (bots.length ? ' + ' + bots.length + ' 🤖' : robots.length && list.length > 2 ? ' · 🤖 solo con 1-2 teléfonos' : '');
    const nb = n <= 5 ? 1 : Math.ceil(n / 4);
    const crew = list.slice(0, 4).map((p, i) => ({ k: i + 1, name: p.name, skin: skinFor(p.avatar, p.name) }))
      .concat(bots.map((r, i) => ({ k: 100 + i, name: r.name, skin: r.skin, robot: true }))).slice(0, 5);
    lobbyStage.setCrew(crew, null);
    if (n) lobbyStage.say((list.length === 1 ? '1 jugador' : list.length + ' jugadores') + (bots.length ? ' + ' + bots.length + ' robots' : '') + (nb === 1 ? ' · 1 cangrejo' : ' · ' + nb + ' cangrejos'), 'calm', 2600);
    list.forEach((p) => {
      const d = document.createElement('div');
      d.className = 'tch-kid' + (seenKids.has(p.name) ? '' : ' new');
      seenKids.add(p.name);
      const skin = skinFor(p.avatar, p.name);
      const im = document.createElement('img');
      im.src = S.fig(skin, 'idle');
      im.alt = '';
      const nm = document.createElement('span');
      nm.textContent = p.name;
      d.append(im, nm);
      box.appendChild(d);
    });
    bots.forEach((r) => {
      const d = document.createElement('div');
      d.className = 'tch-kid bot';
      const im = document.createElement('img');
      im.src = S.fig(r.skin, 'idle');
      im.alt = '';
      const nm = document.createElement('span');
      nm.textContent = r.name;
      d.append(im, nm);
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
    el.innerHTML = '<div class="tch-bstage"></div><div class="tch-bhead"><b class="tch-bname"></b><span class="tch-brun"></span><span class="tch-bcap"></span><div class="tch-bsack"><i></i></div><span class="tch-bwords"></span></div>';
    $('boards').appendChild(el);
    const b = { view: v, el, stage: null, idx: i };
    el.querySelector('.tch-bname').textContent = total > 1 ? 'Cangrejo ' + (i + 1) : 'El cangrejo';
    b.stage = new S.Stage(el.querySelector('.tch-bstage'), Object.assign({ mode: total === 1 ? 'big' : 'tile' }, rules || {}));
    boards[v.id] = b;
    applyView(b, v);
  }
  function applyView(b, v) {
    b.view = v;
    b.stage.setCrew(v.seats, null);
    b.stage.setCaptain(v.captain);
    b.stage.crabTo(v.crab, v.crab, true);
    if (v.fen) b.stage.fenec(v.fen);
    (v.claws || []).forEach((c) => b.stage.claw(c.k, c.st === 'fall' || c.st === 'wait' ? 'armed' : c.st, c.off, c.charges));
    b.stage.setAnger(v.anger || 0);
    b.stage.setPlaying(rd.phase === 'pw' || rd.phase === 'pwin');
    const run = v.runner != null && (rd.phase === 'pw' || rd.phase === 'pwin') ? (v.seats || []).find((x) => x.k === v.runner) : null;
    b.stage.setRunner(run ? run.k : null, false, v.rx, run ? run.name : '', run ? run.skin : null);
    paintRun(b, run ? run.name : '');
    paintCap(b);
    paintWords(b);
  }
  function paintCap(b) {
    const s = (b.view.seats || []).find((x) => x.k === b.view.captain);
    b.el.querySelector('.tch-bcap').textContent = s ? '⭐ ' + s.name : '';
  }
  function paintRun(b, name) { b.el.querySelector('.tch-brun').textContent = name ? '🦊 ' + name + ' corre' : ''; }
  function paintWords(b, pop) {
    const v = b.view;
    if (gmode === 'vs') { b.el.querySelector('.tch-bsack').style.display = 'none'; b.el.querySelector('.tch-bwords').textContent = '🔨 ' + (v.bonks || 0) + (v.bonks === 1 ? ' martillazo' : ' martillazos'); return; }
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
      sc.textContent = gmode === 'vs' ? (b ? (b.view.bonks || 0) : 0) + ' 🔨' : c.words + ' / ' + c.target + ' 📚';
      li.append(n, heads, sc);
      box.appendChild(li);
    });
  }
  function paintClock() {
    if (!endsAt) return;
    const now = Date.now();
    const left = paused ? pausedLeft : endsAt - now;
    $('clock').textContent = fmtClock(left);
    $('clock').parentNode.classList.toggle('hurry', left <= 30000);
    const wb = $('wbar');
    if (wb && rd.until) {
      const l = Math.max(0, paused ? rd.pausedLeft || 0 : rd.until - now);
      wb.firstChild.style.width = Math.min(100, (100 * l) / Math.max(1, rd.ms)) + '%';
      wb.className = 'tch-wbar ' + rd.phase;
      if (rd.phase === 'pw' && !paused) { const s = Math.ceil(l / 1000); if (s <= 3 && s > 0 && wb.dataset.s !== String(s)) { wb.dataset.s = String(s); sfx(s % 2 ? 'tick2' : 'tock2', 0.55); } }
      else wb.dataset.s = '';
    }
    paintMinus();
  }
  function paintMinus() { const left = paused ? pausedLeft : endsAt - Date.now(); $('minus-btn').disabled = !endsAt || left <= 12000 || (game && game.phase === 'final'); }
  function runClock() { if (!clockT) clockT = setInterval(paintClock, 200); paintClock(); }
  function paintRound() {
    const c = $('round-chip');
    c.textContent = !rd.n ? '' : rd.phase === 'pw' || rd.phase === 'pwin' ? '🔨 ¡A martillar!' + (rd.final ? ' ×2' : '') : (rd.final ? '¡Ronda final!' : 'Ronda ' + rd.n + (rd.total ? ' de ' + rd.total : '')) + ' · preguntas';
    c.className = 'tch-round ' + rd.phase + (rd.final ? ' final' : '');
    $('headline').textContent = gmode === 'vs' ? (rd.phase === 'qw' ? '¡Respondan bien! El mejor de cada cangrejo será Fénec 🦊 (si fallan, El Péndulo se come el martillazo)'
      : rd.phase === 'pwout' ? '¡Tiempo! Ahora, a responder otra vez.' : '🦊 Fénec: ¡esquiva las sombras! · los demás: ¡cúbranle los dos lados!')
      : rd.phase === 'qw' ? '¡Respondan bien para ganar martillazos! (si fallan, El Péndulo se los come)'
      : rd.phase === 'pwout' ? '¡Tiempo! Ahora, a responder otra vez.'
        : 'Capitán ⭐: lleva el cangrejo debajo de Fénec · los demás: ¡toquen a Fénec!';
    document.body.classList.toggle('tch-pw', rd.phase === 'pw' || rd.phase === 'pwin');
  }

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
    if (!game || game.id !== d.id) Object.keys(runEnds).forEach((k) => delete runEnds[k]);
    game = { id: d.id, phase: d.phase };
    if (d.rules) rules = d.rules;
    if (d.mode) gmode = d.mode;
    document.body.classList.toggle('tch-vs', gmode === 'vs');
    paused = !!d.paused;
    $('paused').classList.toggle('hidden', !paused);
    if (d.endsMs != null) { endsAt = Date.now() + d.endsMs; pausedLeft = d.endsMs; }
    frenzy = !!d.frenzy;
    $('frenzy-chip').classList.toggle('hidden', !frenzy);
    document.body.classList.toggle('tch-frenzy', frenzy);
    if (d.round) { rd = { n: d.round.n, total: d.round.total, phase: d.round.phase, final: !!d.round.final, ms: Math.max(1, d.round.ms), until: Date.now() + d.round.ms, pausedLeft: d.round.ms }; paintRound(); }
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
    bigBand('Draly Cangrejo · ¡Atrapa a Fénec!', 'go', (d.ms || 2600) - 600);
    later((d.ms || 2600) - 600, () => { bigBand('¡YA!', 'go', 700); sfx('start', 0.7); sfx('clank', 0.6); });
    say('¡Mías, mías! ¡No me atrapan! 😜', 'fenec');
  });
  onTc('tc:play', (d) => { if (game) game.phase = 'play'; endsAt = Date.now() + (d.endsMs || 0); runClock(); });
  // the rounds: questions → «¡A martillar!» (the roles) → 10 s of play → «¡Tiempo!»
  onTc('tc:round', (d) => {
    const again = d.phase === 'qw' && rd.phase === 'qw' && rd.n === d.n, wasFinal = rd.final;   // (±30 s re-planned this window)
    rd = { n: d.n, total: d.total, phase: d.phase, final: !!d.final, ms: Math.max(1, d.ms || 1), until: Date.now() + (d.ms || 0) };
    paintRound();
    Object.values(boards).forEach((b) => b.stage.setPlaying(d.phase === 'pw' || d.phase === 'pwin'));
    if (d.phase === 'qw') {
      Object.values(boards).forEach((b) => { b.view.captain = null; b.stage.setCaptain(null); paintCap(b); });
      if ((!again && d.n > 1) || (again && d.final && !wasFinal)) { bigBand(d.final ? '¡Ronda final! Martillazos ×2' : 'Ronda ' + d.n + ' · ¡a responder!', 'calm', 1300); sfx('whoosh', 0.4); }
      if (!again && d.n > 1) later(1500, () => { const id = pick1(Object.keys(GANG)); say(pick1(GANG[id]), id); });
    } else if (d.phase === 'pwin') {
      bigBand(gmode === 'vs' ? '🦊 ¡1 contra 3! ¡A martillar!' : '🔨 ¡A martillar!', 'go', 1300);
      sfx('clank', 0.75); later(120, () => sfx('start', 0.55));
    } else if (d.phase === 'pwout') {
      const n = (d.tally || []).reduce((a, x) => a + (x.bonks || 0), 0);
      const one = Object.keys(boards).length === 1 && runEnds[Object.keys(boards)[0]];
      if (gmode === 'vs' && one) bigBand('¡Tiempo! 🦊 ' + one.name + ' aguantó ' + one.secs + ' s' + (n ? ' · ' + n + (n === 1 ? ' martillazo' : ' martillazos') : ' ¡intacto!'), 'calm', 1500);
      else bigBand('¡Tiempo! ' + (n ? n + (n === 1 ? ' martillazo' : ' martillazos') + ' a Fénec' : 'Fénec se salvó…'), 'calm', 1300);
      Object.keys(runEnds).forEach((k) => delete runEnds[k]);
      sfx('pop', 0.5);
    }
    paintClock();
  });
  onTc('tc:roles', (d) => {
    const b = boards[d.b];
    if (!b) return;
    b.view.captain = d.captain;
    b.view.runner = d.runner != null ? d.runner : null;
    const run = d.runner != null ? (b.view.seats || []).find((x) => x.k === d.runner) : null;
    b.stage.setRunner(run ? run.k : null, false, d.rx, run ? run.name : '', run ? run.skin : null);
    paintRun(b, run ? run.name : '');
    b.stage.setCaptain(d.captain);
    (d.mart || []).forEach((x) => b.stage.claw(x.k, 'armed', x.off, x.charges));
    if (d.crab != null) b.stage.crabTo(d.crab, d.crab);
    paintCap(b);
  });
  onTc('tc:crab', (d) => { const b = boards[d.b]; if (b) b.stage.crabTo(d.x, d.tx); });
  onTc('tc:runner', (d) => { const b = boards[d.b]; if (b) b.stage.runAt(d.x); });
  onTc('tc:dash', (d) => { const b = boards[d.b]; if (b) { b.stage.dashFx(d.dir); sfx('whoosh', 0.3, 400); } });
  // «¡Tiempo!» in «1 contra 3»: how long the runner lasted (never who got hit)
  const runEnds = {};
  onTc('tc:runend', (d) => {
    const b = boards[d.b];
    if (!b) return;
    const s = (b.view.seats || []).find((x) => x.k === d.k);
    runEnds[d.b] = { name: s ? s.name : '', secs: d.secs, untouched: d.untouched };
    b.view.runner = null;
    b.stage.setRunner(null);
    paintRun(b, '');
    if (Object.keys(boards).length <= 4) b.stage.say('🦊 ' + (s ? s.name : 'Fénec') + ': ' + d.secs + ' s' + (d.untouched ? ' ¡intacto! ⭐' : ''), d.untouched ? 'win' : 'calm', 1800);
  });
  onTc('tc:steer', (d) => { const b = boards[d.b]; if (b) { b.stage.steer(d.tx); b.stage.light(d.k); } });
  onTc('tc:fen', (d) => { const b = boards[d.b]; if (b) b.stage.fenec(d); });
  onTc('tc:claw', (d) => { const b = boards[d.b]; if (b) b.stage.claw(d.k, d.st, null, d.charges); });
  onTc('tc:aim', (d) => { const b = boards[d.b]; if (b) { b.stage.aim(d.k, d.off); b.stage.light(d.k); } });
  onTc('tc:slam', (d) => { const b = boards[d.b]; if (!b) return; b.stage.slam(d.k, d.x, d.ms); b.stage.charges(d.k, d.charges); later((d.ms || 350) - 20, () => sfx('thud', 0.45, 160)); });
  onTc('tc:taunt', (d) => {
    const b = boards[d.b];
    if (!b) return;
    if (Object.keys(boards).length <= 4) b.stage.taunt(d.line);
    if (d.line === 'miss') sfx('giggle', 0.35, 2500);
  });
  let lastGang = 0;
  onTc('tc:bonk', (d) => {
    const b = boards[d.b];
    if (!b) return;
    b.view.words = d.words; b.view.target = d.target; b.view.bonks = d.n || ((b.view.bonks || 0) + 1);
    paintWords(b, 'pop');
    b.stage.bonk(d.k, d.flying, d.pts, d.ms, d.x);
    b.el.classList.remove('bonked'); void b.el.offsetWidth; b.el.classList.add('bonked');
    sfx('thud', 0.8, 200);
    later(90, () => sfx('pop', 0.6, 300));
    later(600, () => sfx('star', 0.6, 500));
    const s = (b.view.seats || []).find((x) => x.k === d.k);
    if (Date.now() - lastGang > 4000) {
      lastGang = Date.now();
      say(d.runner != null ? '¡Martillazo de ' + (s ? s.name : 'la tripulación') + '! +' + d.pts + ' 📚' + ((d.assists || []).length ? ' · ¡le cerraron el paso! 🪤' : '') : '¡' + (s ? s.name : 'La tripulación') + ' le dio a Fénec! +' + d.pts + ' palabras 📚' + ((d.assists || []).length ? ' · ¡con trampa!' : ''), s ? null : 'fer');
    }
  });
  onTc('tc:full', (d) => { const b = boards[d.b]; if (b) { bigBand('🎒 ¡Cangrejo ' + (b.idx + 1) + ' llenó la bolsa!', 'go', 1800); sfx('win', 0.5, 2000); } });
  // a miss (never who): a hammer flies into El Péndulo's mouth, «¡Ñam!», he grows
  let lastEatSay = 0;
  onTc('tc:eat', (d) => {
    const b = boards[d.b];
    if (!b) return;
    b.view.anger = d.anger;
    b.stage.eat(d.anger, null, d.ate);
    later(540, () => sfx(d.ate ? 'chomp' : 'slurp', 0.4, 1200));
    if (Date.now() - lastEatSay > 12000) { lastEatSay = Date.now(); say('El Péndulo: «¡Ñam! Qué rico martillazo» · si fallan, se los come', 'pendulo'); }
  });
  onTc('tc:calm', (d) => { const b = boards[d.b]; if (b) { b.view.anger = d.anger; b.stage.calm(d.anger); } });
  onTc('tc:react', (d) => { const b = boards[d.b]; if (b) { const s = (b.view.seats || []).find((x) => x.k === d.k); b.stage.react(d.e, s ? s.skin : null); } });
  onTc('tc:crews', (d) => paintCrews(d.crews));
  onTc('tc:frenzy', (d) => {
    frenzy = !d.off;
    $('frenzy-chip').classList.toggle('hidden', !frenzy);
    document.body.classList.toggle('tch-frenzy', frenzy);
    if (music) music.playbackRate = frenzy ? 1.15 : 1;
    if (frenzy) { bigBand('🌅 ¡Ronda final! Martillazos ×2', 'go', 2200); sfx('hurry', 0.8); say('¡Última ronda! Cada martillazo vale doble', 'fer'); }
  });
  onTc('tc:time', (d) => { Object.entries(d.targets || {}).forEach(([id, t]) => { const b = boards[id]; if (b) { b.view.target = t; paintWords(b); } }); endsAt = Date.now() + (d.endsMs || 0); if (paused) pausedLeft = d.endsMs || 0; paintClock(); if (d.add) bigBand((d.add > 0 ? '+' : '−') + Math.abs(d.add) + ' s', 'calm', 900); });
  onTc('tc:pause', (d) => {
    paused = !!d.paused;
    if (paused) { pausedLeft = endsAt - Date.now(); rd.pausedLeft = rd.until - Date.now(); }
    $('paused').classList.toggle('hidden', !paused);
    $('pause-btn').textContent = paused ? '▶ Seguir' : '⏸ Pausa';
    Object.values(boards).forEach((b) => b.stage.setPaused(paused));
    if (paused) stopMusic(); else musicFor();
  });
  onTc('tc:final', (d) => {
    if (game) game.phase = 'final';
    paintMinus();
    stopMusic();
    Object.values(boards).forEach((b) => { b.stage.setPlaying(false); b.stage.setRunner(null); paintRun(b, ''); });
    document.body.classList.remove('tch-pw');
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
    const vsEnd = tc.mode === 'vs';
    const ICO = { martillo: '🔨', capitan: '⭐', trampa: '🪤', racha: '🔥', corredor: '🦊' };
    (tc.boards || []).forEach((bd, i) => {
      const c = document.createElement('div');
      c.className = 'tch-champ ' + (vsEnd ? 'vs' : bd.caught ? 'caught' : 'escaped');
      const h = document.createElement('h3');
      h.textContent = (n > 1 ? 'Cangrejo ' + (i + 1) : 'El cangrejo') + (vsEnd ? ' · 1 contra 3 🦊' : bd.caught ? ' · ¡Atrapado! 🎉' : ' · se escapó 😜');
      c.appendChild(h);
      const res = document.createElement('div');
      res.className = 'tch-champ-res';
      const fx = document.createElement('img');
      fx.alt = '';
      fx.src = A + (vsEnd ? 'fenec-laugh.webp' : bd.caught ? 'fenec-run.webp' : 'fenec-kick.webp');
      const cr = document.createElement('img');
      cr.alt = '';
      cr.className = 'crab';
      cr.src = A + (vsEnd || bd.caught ? 'crab-hero.webp' : 'crab-broken.webp');
      res.append(cr, fx);
      c.appendChild(res);
      const w = document.createElement('p');
      w.className = 'tch-champ-words';
      const runs = (bd.rows || []).reduce((a, r) => a + (r.runs || 0), 0);
      w.textContent = vsEnd ? '🔨 ' + (bd.bonks || 0) + ((bd.bonks || 0) === 1 ? ' martillazo' : ' martillazos') + ' · 🦊 ' + runs + (runs === 1 ? ' carrera' : ' carreras') + ' como Fénec' : bd.caught ? '📚 ¡' + bd.words + ' palabras recuperadas! (meta: ' + bd.target + ')' : '📚 ' + bd.words + ' de ' + bd.target + ' palabras · ¡la próxima!';
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
      if ((bd.robots || []).length) {
        const rb = document.createElement('p');
        rb.className = 'tch-champ-bots';
        rb.textContent = 'Con ' + bd.robots.map((r) => r.name).join(', ') + ' (robots: no cuentan)';
        c.appendChild(rb);
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
      li.appendChild(document.createTextNode((n > 1 ? 'Cangrejo ' + (idx + 1) : 'El cangrejo') + (c.caught && !vsEnd ? ' 🎉' : '')));
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
    const got = (tc.boards || []).filter((b) => b.caught).length;
    if (vsEnd) { $('end-title').textContent = '¡Se acabó la carrera! 🦊 ¿Quién corrió y martilló mejor?'; return; }
    $('end-title').textContent = !got ? '¡Fénec se escapó esta vez! 😜' : n === 1 ? '¡Atrapamos a Fénec! 🎉' : got === n ? '¡Todos atraparon a Fénec! 🎉' : '¡' + got + ' de ' + n + ' cangrejos atraparon a Fénec! 🎉';
  }

  window.CrabHost = {
    frame: () => ({ pin, phase: game && game.phase, boards: Object.keys(boards).length, paused, frenzy, clock: $('clock').textContent, round: rd.n, window: rd.phase, robots: robots.length, mode: gmode }),
    freeze: (v) => { frozen = !!v; if (!frozen) { const q = queue; queue = []; q.forEach(([fn, d]) => fn(d)); } if (S.freeze) S.freeze(v); return queue.length; },
    boardStage: (id) => (boards[id] ? boards[id].stage : null),
  };
})();
