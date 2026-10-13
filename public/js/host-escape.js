// La Gran Fuga de Dubái — projector view.
// Lobby (PIN, the crew as their saga avatars, Robotín, the 3 steps) → the episode intro in the countdown (the crew with
// Dralingo and Profe Fer VS Robotín, 3-2-1) → the chase: a side-scrolling Dubai at golden hour, every kid running with a
// name tag, Robotín behind with his tickle-zaps, turbo names popping big → the «zona segura» rooms (top-down, every kid,
// green zones with their limits) → level cleared with the zone's landmark → the escape in Hamdan's jet → the crew rank,
// the awards and the crew. Big moments one at a time; the teacher's buttons always work (pause lets clicks through).
(function () {
  const socket = io();
  const $ = (id) => document.getElementById(id);
  const R = window.EscapeRender, M = window.EscapeMap, Cast = window.DralingoCast || null;
  const A = '/assets/kingdoms/', ES = '/assets/escape/', D = '/assets/dralingo/';
  const SFX = {
    tick: A + 'tick.mp3', whoosh: A + 'whoosh.mp3', win: A + 'sting-win.mp3', cleared: A + 'landmark.mp3', alert: A + 'castle-alert.mp3',
    turbo: ES + 'turbo.mp3', super: ES + 'super.mp3', zap: ES + 'zap.mp3', glitch: ES + 'glitch.mp3', safe: ES + 'safe.mp3',
    heart: ES + 'heart.mp3', wave: ES + 'wave.mp3', jet: ES + 'jet.mp3', pop: A + 'tap.mp3',
  };
  const MUSIC = { lobby: A + 'music-lobby.mp3', run: ES + 'music-run.mp3', zone: ES + 'music-zone.mp3', final: A + 'music-final.mp3' };
  const LV = M.LEVELS;
  const RANK_ART = { cielo: '/assets/saga/avatars/plane.webp', burj: '/assets/kingdoms/landmarks/big/burj.webp', zoco: '/assets/saga/avatars/camel.webp' };
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let pin = null, state = null, muted = false;
  let es = null;              // the episode right now (es:init / es:phase / es:tick)
  let roster = {}, cast = null, lobbyPlayers = null;
  const seenChips = new Set();   // lobby: only a kid who just joined gets the pop-in
  let crewM = 0, robotM = -22, crewShown = 0, robotShown = -22, dizzyUntil = 0, zapAt = 0, wakeUntil = 0, dazeUntil = 0, sprintUntil = 0;
  let closeFlag = false;     // «Robotín se acerca» (the server decides, with hysteresis)
  let pausedLeft = 0;        // the wave clock shown while the teacher pauses
  let pausedClockAt = 0;     // when the pause began (the round clock shows the time left at that moment)
  let room = null, zones = [], occ = {}, kids = {}, waveUntil = 0, waveTotal = 12000, flashAt = 0, zapTargets = [];
  let dashes = {};            // idx → { t0, super }
  let paused = false, warned = {}, timerInterval = null;
  let canvas = null, g2 = null, raf = 0, lastFrame = 0, dralingoAt = null;
  let testHold = false;       // screenshots only (EscapeHost.hold): turbo dashes and name pops stay on screen
  let music = null, musicName = null;

  // ---------- sound ----------
  const lastSfx = {};
  function sfx(name, vol, gap) {
    if (muted || !SFX[name]) return;
    const now = Date.now();
    if (gap && now - (lastSfx[name] || 0) < gap) return;      // 30 kids answering: never a wall of noise
    lastSfx[name] = now;
    try { const a = new Audio(SFX[name]); a.volume = vol || 0.6; a.play().catch(() => {}); } catch (_) {}
  }
  function playMusic(name, vol) {
    if (musicName === name) return;
    stopMusic();
    musicName = name;
    if (muted || !MUSIC[name]) return;
    try { music = new Audio(MUSIC[name]); music.loop = true; music.volume = vol || 0.36; music.play().catch(() => {}); } catch (_) {}
  }
  function stopMusic() { if (music) { try { music.pause(); } catch (_) {} } music = null; musicName = null; }
  $('mute-btn').addEventListener('click', () => {
    muted = window.toggleMute ? window.toggleMute() : !muted;
    $('mute-btn').textContent = muted ? '🔇 Sin sonido' : '🔊 Sonido';
    if (muted) stopMusic(); else if (!$('screen-lobby').classList.contains('hidden')) playMusic('lobby');
  });
  document.addEventListener('click', () => {
    if (window.unlockAudio) window.unlockAudio();
    if (!$('screen-lobby').classList.contains('hidden')) playMusic('lobby', 0.33);
  }, { once: true });

  // ---------- room ----------
  const params = new URLSearchParams(location.search);
  const setId = params.get('setId');
  const LIVE = params.get('livegame') === '1' ? '&livegame=1' : '';   // from /maestro: keep pulling the class in
  if (!setId) { location.href = '/packs.html?game=escape' + LIVE; return; }
  R.preload();
  const fmtDur = (v) => (v % 60 ? `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')} min` : `${v / 60} min`);
  socket.emit('host:create', { gameType: 'escape' }, ({ pin: p }) => {
    pin = p;
    $('pin-display').textContent = p;
    $('active-pin-display').textContent = p;
    $('join-url').textContent = `${location.origin}/?pin=${p}`;
    document.title = `La Gran Fuga · ${p}`;
    socket.emit('host:set-duration', { pin, duration: +$('duration-slider').value });
    socket.emit('host:load-set', { pin, setId }, (resp) => {
      if (!resp || !resp.ok) { alert('No se pudo cargar la serie de preguntas.'); location.href = '/packs.html?game=escape' + LIVE; return; }
      $('set-display').textContent = `📚 ${resp.title} · ${resp.count} preguntas`;
      updateStartBtn();
    });
  });
  let connectedOnce = false;
  socket.on('connect', () => { if (connectedOnce && pin) socket.emit('host:reclaim', { pin }, () => {}); connectedOnce = true; });
  $('duration-slider').addEventListener('input', (e) => { $('duration-value').textContent = fmtDur(+e.target.value); });
  $('duration-slider').addEventListener('change', (e) => socket.emit('host:set-duration', { pin, duration: +e.target.value }));
  $('start-btn').addEventListener('click', () => { $('start-btn').disabled = true; socket.emit('host:start', { pin }); });
  $('add-time-btn').addEventListener('click', () => { socket.emit('host:add-time', { pin, seconds: 30 }); banner('+30 segundos ⏱'); });
  $('end-now-btn').addEventListener('click', () => { if (confirm('¿Terminar la ronda ahora?')) socket.emit('host:end-now', { pin }); });
  $('pause-btn').addEventListener('click', () => socket.emit('host:pause', { pin, paused: !paused }));
  $('skip-btn').addEventListener('click', () => socket.emit('host:es-skip', { pin }));
  $('resume-btn').addEventListener('click', () => socket.emit('host:pause', { pin, paused: false }));
  $('play-again-btn').addEventListener('click', () => {
    socket.emit('host:reset', { pin });
    es = null;
    showScreen('lobby');
    playMusic('lobby', 0.33);
  });
  socket.on('host:start-error', (e) => { alert(e && e.message ? e.message : 'No se pudo empezar.'); updateStartBtn(); });
  function updateStartBtn() {
    if (!state) return;
    $('start-btn').disabled = !(state.state === 'lobby' && state.questionsLoaded > 0 && Object.keys(state.players || {}).length > 0);
  }
  socket.on('state', (s) => {
    state = s;
    if (s.state === 'lobby') { renderLobby(s.players); updateStartBtn(); }
  });
  function renderLobby(players) {
    const key = JSON.stringify(players || {});
    if (key === JSON.stringify(lobbyPlayers)) return;
    lobbyPlayers = JSON.parse(key);
    const box = $('players-all');
    box.innerHTML = '';
    const list = Object.values(players || {}).filter((p) => !p.off);
    $('count-all').textContent = list.length === 1 ? '1 jugador' : `${list.length} jugadores`;
    box.classList.toggle('dense', list.length > 16);
    box.classList.toggle('xdense', list.length > 28);
    list.forEach((p) => {
      const chip = document.createElement('span');
      chip.className = 'es-chip' + (seenChips.has(p.name) ? '' : ' new');
      seenChips.add(p.name);
      const im = document.createElement('img');
      im.src = R.SKIN_URL(M.skinFor(p.avatar, p.name)); im.alt = '';
      chip.append(im, document.createTextNode(p.name));
      box.appendChild(chip);
    });
    if (list.length) $('howto-me').src = R.SKIN_URL(M.skinFor(list[list.length - 1].avatar, list[list.length - 1].name));
    if (!list.length) { const e = document.createElement('p'); e.className = 'es-crew-empty'; e.textContent = 'Esperando a la tripulación: entren con el PIN.'; box.appendChild(e); }
  }

  // ---------- little Robotín canvases (lobby, how-to, intro, meter, moments) ----------
  function robotCanvas(c, mood, t, scale) {
    if (!c) return;
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    const s = c.height * (scale || 0.8);
    R.robotin(g, c.width / 2 - s * 0.08, c.height - c.height * 0.06, s, { t, mood, moving: mood === 'chase' });
  }
  let lobbyRaf = 0;
  function lobbyLoop(ts) {
    const t = ts / 1000;
    if ($('screen-lobby').classList.contains('hidden') && $('screen-countdown').classList.contains('hidden')) { lobbyRaf = 0; return; }
    robotCanvas($('lobby-robot'), 'idle', t);
    robotCanvas($('howto-robot'), 'chase', t, 0.9);
    robotCanvas($('intro-robot'), Math.floor(t * 1.2) % 3 === 2 ? 'zap' : 'chase', t, 0.8);
    lobbyRaf = reduced() ? 0 : requestAnimationFrame(lobbyLoop);
  }
  function startLobbyLoop() { if (!lobbyRaf) { if (reduced()) lobbyLoop(1000); else lobbyRaf = requestAnimationFrame(lobbyLoop); } }
  startLobbyLoop();
  robotCanvas($('meter-robot-c'), 'chase', 0.4, 0.9);

  // ---------- the episode intro (countdown) ----------
  socket.on('es:cast', (c) => { cast = c; });
  socket.on('countdown', () => {
    showScreen('countdown');
    stopMusic();
    startLobbyLoop();
    // the crew line-up: Dralingo leads, then the kids (as their saga avatars)
    const row = $('intro-kids');
    row.innerHTML = '';
    const list = Object.values(lobbyPlayers || (state && state.players) || {}).filter((p) => !p.off);
    const shown = list.length > 9 ? 8 : list.length;
    list.slice(0, shown).forEach((p, i) => {
      const im = document.createElement('img');
      im.src = R.SKIN_URL(M.skinFor(p.avatar, p.name)); im.alt = '';
      im.style.setProperty('--i', i);
      row.appendChild(im);
    });
    if (list.length > shown) { const more = document.createElement('b'); more.textContent = `+${list.length - shown}`; row.appendChild(more); }
    $('intro-line').textContent = Cast ? Cast.line('fer', 'hello') : '¡Atención, equipo! Tenemos una misión.';
    let n = 3;
    const num = $('countdown-num');
    num.classList.remove('go');
    const tick = () => {
      num.style.animation = 'none'; void num.offsetWidth; num.style.animation = '';
      if (n > 0) { num.textContent = n; sfx('tick', 0.9); n--; setTimeout(tick, 900); }
      else {
        num.textContent = '¡A correr!'; num.classList.add('go'); sfx('whoosh', 0.9);
        setTimeout(() => { num.classList.remove('go'); showScreen('active'); startTimer(); resize(); }, 800);
      }
    };
    tick();
    sfx('glitch', 0.5);
  });

  // ---------- the episode ----------
  function applyPublic(d) {
    es = Object.assign(es || {}, d);
    if (typeof d.crew === 'number') { crewM = d.crew; robotM = d.robot; }
    if (typeof d.close === 'boolean') closeFlag = d.close;
    if (d.dizzyMs) dizzyUntil = Date.now() + d.dizzyMs;
    if (typeof d.paused === 'boolean') { if (d.paused && !paused) { pausedLeft = Math.max(0, waveUntil - Date.now()); pausedClockAt = Date.now(); } paused = d.paused; showPaused(paused); }
    if (typeof d.waveMs === 'number' && d.waveMs > 0 && !paused) waveUntil = Date.now() + d.waveMs;
  }
  socket.on('es:init', (d) => {
    const fresh = !es || es.round !== d.round;
    applyPublic(d);
    roster = d.players || {};
    cast = d.cast || cast;
    if (fresh) { crewShown = crewM; robotShown = robotM; dashes = {}; warned = {}; }
    canvas = $('es-canvas');
    g2 = canvas.getContext('2d');
    if (d.phase === 'zone') enterZone(d); else leaveZone();
    if (d.phase === 'run' && fresh) { wakeUntil = Date.now() + (d.wakeMs || 0); setTimeout(() => wakeMoment(), 900); }
    paintLevel(); paintHearts(); resize();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
    // a projector that reconnected mid-round (missed 'countdown') would sit on the lobby: go to the episode
    if (state && state.state === 'active' && $('screen-active').classList.contains('hidden') && $('screen-countdown').classList.contains('hidden')) {
      showScreen('active'); startTimer();
    }
    musicFor();
  });
  socket.on('es:roster', (d) => { roster = d.players || roster; });
  socket.on('es:tick', (d) => {
    if (typeof d.c === 'number') { crewM = d.c; robotM = d.r; closeFlag = !!d.cl; }
    if (d.pos) applyPos(d.pos);
    if (d.occ) { occ = {}; d.occ.forEach(([zid, n, safe]) => { occ[zid] = { n, safe }; }); }
    if (typeof d.wl === 'number' && d.wl > 0) waveUntil = Date.now() + d.wl;
  });
  socket.on('es:turbo', (d) => {
    dashes[d.idx] = { t0: performance.now(), super: !!d.super };
    pop(d);
    sfx(d.super ? 'super' : 'turbo', d.super ? 0.55 : 0.32, d.super ? 200 : 120);
  });
  socket.on('es:zap', (d) => {
    crewM = d.crew; robotM = d.robot;
    crewShown = Math.min(crewShown, crewM + 0.5);
    zapAt = performance.now();
    dizzyUntil = Date.now() + (d.dizzyMs || 3000);
    dazeUntil = Date.now() + 2500;
    sprintUntil = 0;
    sfx('zap', 0.8);
    if (!bigMoment({ kind: 'zap', robot: 'zap', title: '¡ZAP!', sub: '¡Cosquillas eléctricas! Todos mareados 3 s', ms: 2000 })) banner('⚡ ¡Zap! ¡Robotín los alcanzó!', 'robo');
    say(['¡Ay, cosquillas! ¡Respondan para alejarnos!', '¡Uy! ¡Turbo, equipo, turbo!'][d.zaps % 2], 'wise');
  });
  socket.on('es:moment', (m) => {
    if (m.type === 'close') { say('¡Robotín se acerca! ¡Respondan rápido! 🚀', 'power'); sfx('alert', 0.45, 3000); }
    if (m.type === 'skip') { banner('⏭ Zona segura terminada: ¡seguimos!', 'safe'); }
    if (m.type === 'sprint') { sprintUntil = Date.now() + 2500; sfx('glitch', 0.5, 4000); if (Date.now() - momentAt > 3000) banner('⚡ ¡Robotín acelera!', 'robo'); }
    if (m.type === 'lastmin') {
      banner('⏱ ¡Último minuto!');
      playMusic('final', 0.4);
      const c = cheer(3);
      if (!(c && bigFx('cameo', { char: c, mood: 'chase', text: '¡Último minuto! ' + Cast.line(c, 'chase') }))) say('¡Último minuto! ¡Todos a responder!', 'power');
    }
  });
  socket.on('es:pause', (d) => { applyPublic(d); });
  socket.on('es:phase', (d) => {
    const prev = es && es.phase;
    applyPublic(d);
    paintLevel(); paintHearts();
    if (d.phase === 'zone') {
      enterZone(d);
      if (prev !== 'zone') { banner('🟢 ¡Zona segura! Entren en una zona verde', 'safe'); say(`¡A ${LV[d.level - 1].room}! Cuando se enciendan las zonas verdes, ¡entren!`, 'hello'); }
    } else leaveZone();
    if (d.clearedLevel && d.phase === 'cleared') clearedMoment(d.clearedLevel, d.heartBack);
    if (d.phase === 'caught') caughtMoment();
    if (d.phase === 'escape') escapeMoment();
    if (d.phase === 'run') { crewShown = 0; robotShown = d.robot; wakeUntil = Date.now() + (d.wakeMs || 0); dashes = {}; setTimeout(() => wakeMoment(d.replay), 300); }
    musicFor();
  });
  socket.on('es:wave', (w) => {
    zones = w.zones || [];
    occ = {};
    waveUntil = Date.now() + w.ms;
    waveTotal = w.ms;
    es.wave = w.wave;
    flashAt = 0; zapTargets = [];
    sfx('wave', 0.6);
    const capped = zones.some((z) => z.cap);
    $('wave-title').textContent = `Ola ${w.wave} de ${w.waves}`;
    $('wave-sub').textContent = capped ? '¡Sepárense! Cada zona tiene su límite' : '¡Entren en una zona verde!';
    if (capped && w.wave === 2) banner('👥 ¡Sepárense! Cada zona tiene sitio para pocos', 'safe');
  });
  socket.on('es:wave-end', (r) => {
    flashAt = performance.now();
    zapTargets = r.out.map((i) => kids[i]).filter(Boolean);
    sfx('zap', 0.6);
    paintHearts(r.lost);
    if (es) es.hearts = r.hearts;
    paintHearts();
    if (!r.out.length) { sfx('safe', 0.7); banner(r.n > 1 ? '✅ ¡Todos a salvo!' : '✅ ¡A salvo!', 'safe'); }
    else {
      sfx('heart', 0.6);
      banner(`⚡ ¡Zap! ${r.out.length === 1 ? '1 se quedó fuera' : r.out.length + ' se quedaron fuera'}${r.lost ? ': −' + r.lost + ' ❤️' : ''}`, 'robo');
      if (es && es.wave < 3) setTimeout(() => say('¡Juntos en la próxima ola! 🟢', 'hello'), 900);
    }
  });

  function musicFor() {
    if (!es || paused) return;
    if (musicName === 'final' && es.phase !== 'escape') return;     // the last minute keeps its music
    if (es.phase === 'run') playMusic('run', 0.34);
    else if (es.phase === 'zone') playMusic('zone', 0.3);
  }

  // ---------- the zona segura room ----------
  function enterZone(d) {
    room = M.buildRoom(es.seed, d.level || es.level);
    zones = d.zones || [];
    if (d.waveMs) { waveUntil = Date.now() + d.waveMs; waveTotal = d.waveTotalMs || d.waveMs; }
    applyPos(d.pos || [], true);
    $('zonehud').classList.remove('hidden');
    if (!d.wave) { $('wave-title').textContent = '¡Zona segura!'; $('wave-sub').textContent = 'Las zonas verdes se encienden…'; }
    document.body.classList.add('es-zone-on');
  }
  function leaveZone() {
    room = null; zones = []; kids = {}; occ = {};
    $('zonehud').classList.add('hidden');
    document.body.classList.remove('es-zone-on');
  }
  function applyPos(arr, snap) {
    const seen = {};
    arr.forEach(([idx, x, y, f, dz]) => {
      seen[idx] = 1;
      const k = kids[idx] || (kids[idx] = { x, y, tx: x, ty: y, f });
      if (snap || Math.hypot(x - k.x, y - k.y) > 140) { k.x = x; k.y = y; }
      k.tx = x; k.ty = y; k.f = f; k.dizzy = !!dz;
    });
    Object.keys(kids).forEach((i) => { if (!seen[i]) delete kids[i]; });
  }

  // ---------- drawing ----------
  function resize() {
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    if (r.width < 2) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
  }
  window.addEventListener('resize', resize);
  function draw(ts) {
    raf = requestAnimationFrame(draw);
    if (!g2 || !es || $('screen-active').classList.contains('hidden')) return;
    frame(ts || performance.now());
  }
  function frame(now) {
    const dt = Math.min(0.1, (now - (lastFrame || now)) / 1000);
    lastFrame = now;
    // glide toward the server's numbers (5 Hz) so the run looks smooth at 60 fps
    const a = Math.min(1, dt * 6);
    crewShown += (crewM - crewShown) * a;
    robotShown += (robotM - robotShown) * a;
    Object.values(kids).forEach((k) => { const d = Math.hypot(k.tx - k.x, k.ty - k.y); k.moving = d > 1.5; const b = Math.min(1, dt * 10); k.x += (k.tx - k.x) * b; k.y += (k.ty - k.y) * b; });
    if (room) drawZone(now); else drawRun(now);
    hud(now);
    placeSay();
  }

  // the chase: golden-hour sky, the skyline, the zone's landmark, the ground, the crew, Robotín
  const SKY = [['#ffe3b8', '#ffc9d6'], ['#ffd2a8', '#f7b3cf'], ['#ffbf9b', '#d9b8f0']];
  const GROUND = [['#eef0fa', '#dfe3f3'], ['#fbf0dc', '#f1e0c2'], ['#9aa6c2', '#8794b3']];
  const PXM = 26;           // css px per metre of ground
  const PXG = 15;           // css px per metre between the crew's back and Robotín
  function drawRun(now) {
    const dpr = canvas.width / Math.max(1, canvas.getBoundingClientRect().width);
    const W = canvas.width / dpr, H = canvas.height / dpr, t = now / 1000;
    const g = g2;
    const lv = Math.max(1, Math.min(3, es.level || 1));
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const horizon = H * 0.56;
    // sky + a low sun
    const sk = g.createLinearGradient(0, 0, 0, horizon);
    sk.addColorStop(0, SKY[lv - 1][1]); sk.addColorStop(1, SKY[lv - 1][0]);
    g.fillStyle = sk; g.fillRect(0, 0, W, horizon + 2);
    g.fillStyle = 'rgba(255,240,200,.85)'; R.ell(g, W * 0.78, horizon - H * 0.12, H * 0.09, H * 0.09); g.fill();
    // the skyline (the platform's Dubai picture, the city band only), slow parallax; copies alternate mirrored so the
    // seams always match, and a golden haze keeps it behind the sticker-style runners
    const sky = R.img('/assets/dubai/skyline-wide.webp');
    if (R.ready(sky)) {
      const sy = 0, sH = sky.naturalHeight * 0.73;              // the picture's own sky down to the waterline
      const sh = horizon + 2, sw = sh * (sky.naturalWidth / sH);
      const off = ((crewShown + (lv - 1) * 100) * PXM * 0.08) % (sw * 2);
      g.globalAlpha = 0.9;
      for (let k = 0, x = -off; x < W; k++, x += sw) {
        if (k % 2) { g.save(); g.translate(x + sw, 0); g.scale(-1, 1); g.drawImage(sky, 0, sy, sky.naturalWidth, sH, 0, horizon - sh, sw, sh); g.restore(); }
        else g.drawImage(sky, 0, sy, sky.naturalWidth, sH, x, horizon - sh, sw, sh);
      }
      g.globalAlpha = 1;
      const haze = g.createLinearGradient(0, horizon - sh, 0, horizon);
      haze.addColorStop(0, 'rgba(255,227,184,0)'); haze.addColorStop(1, 'rgba(255,214,190,.55)');
      g.fillStyle = haze; g.fillRect(0, horizon - sh, W, sh);
    }
    // the zone's landmark passes by in the middle distance
    const lmM = 52, lmPar = 0.55;
    const lmX = crewX(W) + (lmM - crewShown) * PXM * lmPar;
    if (lv === 1) landmark(g, '/assets/kingdoms/landmarks/big/museum.webp', lmX, horizon + 6, H * 0.34);
    if (lv === 2) { landmark(g, '/assets/kingdoms/landmarks/big/burj.webp', lmX, horizon + 6, H * 0.58); fountain(g, lmX + H * 0.28, horizon + 4, H * 0.14, t); }
    if (lv === 3) tower(g, lmX, horizon + 4, H * 0.4);
    // the ground: the zone's floor scrolling under the crew
    const gr = g.createLinearGradient(0, horizon, 0, H);
    gr.addColorStop(0, GROUND[lv - 1][0]); gr.addColorStop(1, GROUND[lv - 1][1]);
    g.fillStyle = gr; g.fillRect(0, horizon, W, H - horizon);
    g.strokeStyle = 'rgba(29,36,64,.12)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, horizon); g.lineTo(W, horizon); g.stroke();
    const gOff = (crewShown * PXM) % 120;
    for (let x = -gOff; x < W + 120; x += 120) {
      if (lv === 3) { g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(x, H * 0.86, 60, 8); }
      else { g.strokeStyle = lv === 1 ? 'rgba(95,200,255,.35)' : 'rgba(190,150,80,.25)'; g.beginPath(); g.moveTo(x, horizon); g.lineTo(x - 140, H); g.stroke(); }
    }
    if (lv === 3) for (let x = -((crewShown * PXM) % 90); x < W; x += 90) { g.fillStyle = Math.floor(t * 3 + x / 90) % 2 ? '#ffd23f' : '#ffffff'; R.ell(g, x, horizon + 14, 4, 4); g.fill(); }
    // the goal: the gate to the next zone (or Hamdan's jet) comes into view in the last metres
    const goalX = crewX(W) + (100 - crewShown) * PXM;
    if (goalX < W + 300) goal(g, goalX, H, horizon, lv, t);
    // the crew
    const list = crewList();
    const n = list.length;
    const size = n <= 10 ? H * 0.21 : n <= 20 ? H * 0.17 : H * 0.145;
    const cx = crewX(W), base = H * 0.93;
    const dz = Date.now() < dizzyUntil;
    const packed = list.map((k, i) => {
      const row = i % 3, col = Math.floor(i / 3);
      let x = cx - col * size * 0.62 - row * size * 0.2, y = base - row * size * 0.24;
      const d = dashes[k.idx];
      let dash = 0;
      if (d) { const u = testHold ? 0.45 : (now - d.t0) / 900; if (u >= 1) delete dashes[k.idx]; else dash = Math.sin(Math.min(1, u) * Math.PI) * size * (d.super ? 1.6 : 1); }
      x += dash;
      return { k, x, y, dash, sup: d && d.super };
    });
    const back = packed.length ? Math.min(...packed.map((p) => p.x)) - size * 0.4 : cx;
    // Robotín behind the pack: the gap in metres is the distance on screen
    const gap = Math.max(0, crewShown - robotShown);
    const rx = Math.max(W * 0.06, back - size * 0.9 - gap * PXG);
    const rs = size * 2.2;
    const dazed = Date.now() < dazeUntil;
    const zapping = now - zapAt < 900;
    const waking = Date.now() < wakeUntil;
    const sprinting = Date.now() < sprintUntil;
    R.robotin(g, rx, base + 4, rs, { t: sprinting ? t * 1.6 : t, mood: zapping ? 'zap' : (dazed ? 'dizzy' : (closeFlag || sprinting ? 'happy' : 'chase')), moving: !waking && !dazed, glitch: true });
    // runners back to front (lower = closer), the dashing ones on top with a speed trail
    packed.sort((p, q) => p.y - q.y);
    packed.forEach((p) => {
      if (p.dash > 2) trail(g, p.x, p.y, size, p.dash, p.sup);
      R.kid(g, { x: p.x, y: p.y, skin: p.k.skin, idx: p.k.idx, moving: true, dizzy: dz, f: 0 }, size, t);
    });
    // Dralingo leads the crew (his platform look)
    const dr = R.img(D + 'power.webp');
    if (R.ready(dr)) {
      const ds = size * 1.55, bob = -Math.abs(Math.sin(t * 9)) * ds * 0.05;
      g.fillStyle = 'rgba(29,36,64,.2)'; R.ell(g, cx + size * 0.95, base + 2, ds * 0.26, ds * 0.07); g.fill();
      g.drawImage(dr, cx + size * 0.95 - ds * 0.45, base - ds + bob, ds * 0.9, ds);
      dralingoAt = { x: cx + size * 0.95, y: base - ds };      // his speech bubble follows him
    }
    // name tags of the dashing kids only (30 tags at once would be noise)
    packed.forEach((p) => { if (p.dash > 2) R.tag(g, { x: p.x, y: p.y, name: p.k.name, me: false }, size, 1, 16); });
    // the zap: lightning from the broom to a few runners
    if (zapping) {
      const tip = { x: rx + rs * 0.6, y: base - rs * 0.42 };
      packed.slice(-5).forEach((p, i) => R.zap(g, tip.x, tip.y, p.x, p.y - size * 0.5, 4, Math.floor(now / 50) + i * 13));
    }
    $('danger').classList.toggle('on', es.phase === 'run' && closeFlag && !waking);
  }
  const crewX = (W) => W * 0.62;
  function crewList() {
    return Object.entries(roster).filter(([, p]) => p.on !== false).map(([i, p]) => ({ idx: +i, name: p.name, skin: p.skin || 'dralingo' })).sort((a, b) => a.idx - b.idx);
  }
  function landmark(g, url, x, groundY, h) {
    const i = R.img(url);
    if (!R.ready(i)) return;
    const w = h * i.naturalWidth / i.naturalHeight;
    g.fillStyle = 'rgba(29,36,64,.15)'; R.ell(g, x, groundY, w * 0.4, h * 0.04); g.fill();
    g.drawImage(i, x - w / 2, groundY - h, w, h);
  }
  function fountain(g, x, y, h, t) {
    g.fillStyle = '#7fd3ea'; R.ell(g, x, y, h * 1.2, h * 0.16); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 3;
    for (let k = 0; k < 7; k++) { const sx = x + (k - 3) * h * 0.3, jh = h * (0.6 + 0.4 * Math.sin(t * 3 + k)); g.beginPath(); g.moveTo(sx, y); g.quadraticCurveTo(sx + h * 0.08, y - jh * 1.4, sx + h * 0.16, y); g.stroke(); }
  }
  function tower(g, x, y, h) {        // the airport control tower (canvas until its picture exists)
    g.fillStyle = '#e8ecf6'; g.fillRect(x - h * 0.06, y - h, h * 0.12, h);
    g.strokeStyle = R.INK; g.lineWidth = 3; g.strokeRect(x - h * 0.06, y - h, h * 0.12, h);
    g.fillStyle = '#9fdcf7'; R.rr(g, x - h * 0.16, y - h * 1.12, h * 0.32, h * 0.16, 10); g.fill(); g.stroke();
    g.fillStyle = '#ffffff'; R.rr(g, x - h * 0.2, y - h * 1.16, h * 0.4, h * 0.05, 6); g.fill(); g.stroke();
  }
  function goal(g, x, H, horizon, lv, t) {
    if (lv === 3) {
      // Hamdan's jet waiting at the end of the runway, Hamdan waving next to it
      const jet = R.img('/assets/saga/avatars/plane.webp');
      const js = H * 0.42;
      if (R.ready(jet)) g.drawImage(jet, x - js * 0.2, H * 0.9 - js * 0.95, js, js);
      const hm = R.img('/assets/cast/hamdan-hello.webp');
      if (R.ready(hm)) { const hh = H * 0.3; g.drawImage(hm, x - hh * 0.55, H * 0.9 - hh, hh * hm.naturalWidth / hm.naturalHeight, hh); }
      return;
    }
    // an arch gate in the next zone's colours with its landmark on top
    const gh = H * 0.42, gw = gh * 0.7;
    g.strokeStyle = R.INK; g.lineWidth = 5;
    g.fillStyle = lv === 1 ? '#ffd23f' : '#2fbf71';
    R.rr(g, x - gw / 2, H * 0.9 - gh, gw * 0.16, gh, 8); g.fill(); g.stroke();
    R.rr(g, x + gw / 2 - gw * 0.16, H * 0.9 - gh, gw * 0.16, gh, 8); g.fill(); g.stroke();
    R.rr(g, x - gw / 2 - 10, H * 0.9 - gh - 20, gw + 20, 34, 14); g.fill(); g.stroke();
    const next = R.img(LV[lv].lm);
    if (R.ready(next)) { const ih = gh * 0.45; const iw = ih * next.naturalWidth / next.naturalHeight; g.drawImage(next, x - iw / 2, H * 0.9 - gh - 20 - ih + 6 + Math.sin(t * 3) * 3, iw, ih); }
  }
  function trail(g, x, y, size, dash, sup) {
    g.save();
    g.globalAlpha = Math.min(1, dash / size) * 0.85;
    g.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      g.strokeStyle = sup ? (i % 2 ? '#ff8a1f' : '#ffd23f') : 'rgba(255,255,255,.95)';
      g.lineWidth = sup ? 7 : 5;
      const yy = y - size * (0.2 + i * 0.17);
      g.beginPath(); g.moveTo(x - size * 0.35, yy); g.lineTo(x - size * 0.35 - dash * (0.8 + i * 0.12), yy); g.stroke();
    }
    g.restore();
  }

  // the zona segura room, the whole class at once
  function drawZone(now) {
    const dpr = canvas.width / Math.max(1, canvas.getBoundingClientRect().width);
    const W = canvas.width / dpr, H = canvas.height / dpr, t = now / 1000;
    const g = g2;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#ffe3cf'); bg.addColorStop(1, '#f4d6ea');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const T = room.tile, RW = room.cols * T, RH = room.rows * T;
    const side = 200;                       // the wave card lives in the left column, never over a zone
    const s = Math.min((W - side - 24) / RW, (H - 16) / RH);
    const ox = side + (W - side - RW * s) / 2, oy = (H - RH * s) / 2;
    g.setTransform(dpr * s, 0, 0, dpr * s, ox * dpr, oy * dpr);
    const list = Object.entries(kids).map(([i, k]) => {
      const p = roster[i] || {};
      const safe = Object.values(occ).some((o) => (o.safe || []).includes(+i));
      return { idx: +i, x: k.x, y: k.y, f: k.f, moving: k.moving, dizzy: k.dizzy, skin: p.skin || 'dralingo', name: p.name || '', safe };
    });
    const flash = flashAt ? Math.max(0, 1 - (now - flashAt) / 900) : 0;
    const left = waveUntil - Date.now();
    const mood = flash > 0 ? 'zap' : (left > 0 && left < 3000 ? 'happy' : 'idle');
    R.room(g, { room, zones, occ, kids: list, t, flash, zapTargets, robot: { mood } }, { s }, {
      size: list.length > 20 ? 34 : 40, tag: 17, tags: true, groundScale: Math.max(1, Math.min(2, Math.ceil(s * dpr * 2) / 2)), badge: 21,
    });
    $('danger').classList.remove('on');
  }

  // ---------- HUD ----------
  let hudKey = '', meterW = 0;
  window.addEventListener('resize', () => { meterW = 0; });
  function hud(now) {
    if (!es) return;
    const L = es.L || 100;     // the meter runs from 25 m before the start to the goal (Robotín's head start is visible)
    const cp = room ? 1 : Math.max(0, Math.min(1, (crewShown + 25) / (L + 25))), rp = room ? 0 : Math.max(0, Math.min(1, (robotShown + 25) / (L + 25)));
    // markers ride on transforms (the values are already smoothed every frame): no layout work 60 times a second
    if (!meterW) meterW = $('meter').clientWidth;
    $('meter-fill').style.transform = `scaleX(${cp.toFixed(4)})`;
    $('meter-crew').style.transform = `translateX(${(cp * meterW).toFixed(1)}px)`;
    $('meter-robot').style.transform = `translateX(${(rp * meterW).toFixed(1)}px)`;
    $('meter').classList.toggle('close', es.phase === 'run' && closeFlag);
    if (room) {
      const left = paused ? pausedLeft : Math.max(0, waveUntil - Date.now());
      const sec = Math.ceil(left / 1000);
      $('wave-n').textContent = es.wave && left > 0 ? sec : '✓';
      $('wave-ring').style.setProperty('--p', es.wave && left > 0 ? (left / Math.max(1, waveTotal)).toFixed(3) : 0);
      $('wave-ring').classList.toggle('hurry', es.wave && left > 0 && left < 3000);
      if (!paused && es.wave && left > 0 && left < 3000 && hudKey !== 'w' + es.wave + sec) { hudKey = 'w' + es.wave + sec; sfx('tick', 0.5); }
    }
  }
  function paintLevel() {
    if (!es) return;
    const lv = LV[(es.level || 1) - 1];
    $('level-ico').src = lv.lm;
    $('level-name').textContent = lv.name + (es.replay ? ' · otra vez' : '');
    $('level-num').textContent = es.phase === 'zone' ? `Zona segura · Nivel ${es.level} de 3` : `Nivel ${es.level} de 3`;
    $('meter-goal').src = es.level >= 3 ? '/assets/saga/avatars/plane.webp' : LV[es.level].lm;
  }
  function paintHearts(lost) {
    const box = $('hearts');
    const h = es ? es.hearts : 5;
    if (box.children.length !== 5) { box.innerHTML = ''; for (let i = 0; i < 5; i++) { const s = document.createElement('i'); s.textContent = '❤️'; box.appendChild(s); } }
    Array.from(box.children).forEach((el, i) => {
      const was = !el.classList.contains('off');
      el.classList.toggle('off', i >= h);
      if (lost && was && i >= h) { el.classList.remove('lose'); void el.offsetWidth; el.classList.add('lose'); }
    });
    box.setAttribute('aria-label', `${h} corazones`);
  }

  // ---------- timer ----------
  function startTimer() {
    warned = {};
    $('timer-display').classList.remove('urgent');
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!state || !state.endsAt) return;
      const left = Math.max(0, state.endsAt - (paused ? pausedClockAt : Date.now()));
      const sec = Math.ceil(left / 1000);
      $('timer-display').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      if (sec <= 10 && sec > 0 && !warned['t' + sec]) { warned['t' + sec] = 1; sfx('tick', 0.5); $('timer-display').classList.add('urgent'); }
      if (sec > 10) $('timer-display').classList.remove('urgent');
    }, 250);
  }

  // ---------- turbo names: one at a time, ≥ 0.4 s apart ----------
  const popQ = [];
  let popAt = 0, popTimer = null;
  function pop(d) {
    popQ.push(d);
    if (popQ.length > 6) { const extra = popQ.splice(5); popQ.push({ name: '', more: extra.length }); }
    pump();
  }
  function pump() {
    if (popTimer || !popQ.length) return;
    const wait = Math.max(0, 400 - (Date.now() - popAt));
    popTimer = setTimeout(() => {
      popTimer = null;
      const d = popQ.shift();
      if (!d) return;
      popAt = Date.now();
      const el = document.createElement('div');
      el.className = 'es-pop' + (d.super ? ' super' : '') + (d.more ? ' more' : '');
      if (d.more) el.textContent = `+${d.more} turbos más 🚀`;
      else {
        const sk = (roster[d.idx] || {}).skin;
        if (sk) { const im = document.createElement('img'); im.src = R.SKIN_URL(sk); im.alt = ''; el.appendChild(im); }
        const b = document.createElement('b'); b.textContent = d.name;
        const s = document.createElement('span'); s.textContent = d.super ? '¡Súper turbo! 🔥' : '¡Turbo! 🚀';
        el.append(b, s);
      }
      $('pops').appendChild(el);
      while ($('pops').children.length > 2) $('pops').firstChild.remove();
      setTimeout(() => { if (!testHold) el.remove(); }, 1300);
      pump();
    }, wait);
  }

  // ---------- big moments: one at a time; optional ones ≥ 7 s apart ----------
  let momentAt = 0, momentTimer = null, momentRaf = 0;
  function bigMoment(o, forced) {
    const now = Date.now();
    if (!forced && (now - momentAt < 7000 || !$('moment').classList.contains('hidden'))) return false;
    momentAt = now;
    const box = $('moment');
    box.className = 'es-moment ' + (o.kind || '');
    $('moment-title').textContent = o.title || '';
    $('moment-sub').textContent = o.sub || '';
    const art = $('moment-art');
    art.classList.toggle('hidden', !o.art);
    if (o.art) art.src = o.art;
    const rc = $('moment-robot');
    rc.classList.toggle('hidden', !o.robot);
    cancelAnimationFrame(momentRaf);
    if (o.robot) {
      const loop = (ts) => { robotCanvas(rc, o.robot, ts / 1000, 0.8); if (!box.classList.contains('hidden') && !reduced()) momentRaf = requestAnimationFrame(loop); };
      momentRaf = requestAnimationFrame(loop);
    }
    const row = $('moment-crew');
    row.innerHTML = '';
    if (o.crew) crewList().slice(0, 10).forEach((k, i) => { const im = document.createElement('img'); im.src = R.SKIN_URL(k.skin); im.alt = ''; im.style.setProperty('--i', i); row.appendChild(im); });
    row.classList.toggle('hidden', !o.crew);
    const c = $('moment-cast');
    c.classList.toggle('hidden', !(o.cast && Cast));
    if (o.cast && Cast) { $('moment-cast-img').src = Cast.pose(o.cast, 'cheer'); $('moment-cast-line').textContent = `${Cast.name(o.cast)}: «${o.line || Cast.line(o.cast, 'win')}»`; }
    box.classList.remove('hidden');
    void box.offsetWidth;
    box.classList.add('show');
    clearTimeout(momentTimer);
    momentTimer = setTimeout(() => { if (testHold) return; box.classList.add('hidden'); box.classList.remove('show'); cancelAnimationFrame(momentRaf); }, o.ms || 2600);
    return true;
  }
  const cheer = (i) => (cast && cast.cheers && Cast ? cast.cheers[i % cast.cheers.length] : null);
  function wakeMoment(replay) {
    if (!es || es.phase !== 'run') return;
    sfx('glitch', 0.6);
    banner(replay ? '🤖 ¡Otra vez Robotín! ¡Ahora corre más rápido!' : '🤖 ¡Robotín despertó! ¡Corran!', 'robo');
    if (es.level === 1 && !replay) say('¡Cada respuesta correcta es un turbo! 🚀', 'power');
  }
  function clearedMoment(level, heartBack) {
    sfx('cleared', 0.8);
    const lv = LV[level - 1], next = LV[level];
    bigMoment({ kind: 'cleared', art: lv.lm, title: `¡Nivel ${level} superado!`, sub: (next ? `Siguiente: ${next.name}` : '') + (heartBack ? ' · +1 ❤️' : ''), cast: cheer(level - 1), ms: 3800 }, true);
    confetti(['#ffd23f', '#2fbf71', '#ff8a1f', '#ffffff'], 50);
  }
  function caughtMoment() {
    sfx('zap', 0.8);
    bigMoment({ kind: 'caught', robot: 'happy', title: '¡Robotín los alcanzó!', sub: 'Otra vez esta zona: Robotín va más rápido, ¡más turbos!', ms: 3800 }, true);
    setTimeout(() => say('¡Tranquilos, equipo! Lo intentamos otra vez juntos 💪', 'wise'), 3900);
  }
  function escapeMoment() {
    sfx('jet', 0.8);
    stopMusic();
    setTimeout(() => sfx('win', 0.8), 1200);
    const cid = cast && cast.jet ? cast.jet : 'hamdan';
    bigMoment({ kind: 'escape', art: '/assets/saga/anim/plane.webp', title: '¡Escaparon!', sub: '¡Rumbo al cielo en el jet de Hamdan!', cast: cid, line: Cast ? Cast.line(cid, 'win') : '', crew: true, ms: 6600 }, true);
    confetti(['#ffd23f', '#ff8a1f', '#f9b4c8', '#ffffff'], 80);
  }
  function bigFx(kind, opts) {
    if (!window.DralingoFX || !$('moment').classList.contains('hidden')) return false;
    const now = Date.now();
    if (now - momentAt < 3200) return false;
    if (DralingoFX.play(kind, opts)) { momentAt = now; return true; }
    return false;
  }

  // ---------- pause ----------
  function showPaused(on) {
    $('paused').classList.toggle('hidden', !on);
    $('pause-btn').textContent = on ? '▶ Seguir' : '⏸ Pausa';
    if (on) stopMusic(); else musicFor();
  }

  // ---------- end ----------
  socket.on('game-end', (d) => {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    setTimeout(() => { cancelAnimationFrame(raf); raf = 0; }, 3000);    // the stage is gone: no more frames
    stopMusic(); hideDralingo(); showPaused(false);
    const e = d.escape || {};
    const show = () => {
      $('moment').classList.add('hidden');
      showScreen('win');
      const rk = e.rank || { id: 'zoco', name: 'Exploradores del Zoco', stars: 1 };
      $('rank-name').textContent = rk.name;
      $('rank-art').src = RANK_ART[rk.id] || RANK_ART.zoco;
      $('rank-badge').className = 'es-badge ' + rk.id;
      $('rank-stars').textContent = '⭐'.repeat(rk.stars || 1);
      const lvReached = LV[Math.max(0, Math.min(2, (e.level || 1) - 1))];
      $('end-why').textContent = e.escaped
        ? `¡Escaparon en el jet de Hamdan con ${e.hearts} ${e.hearts === 1 ? 'corazón' : 'corazones'}!`
        : `Llegaron hasta ${lvReached.name} · ${e.hearts} ${e.hearts === 1 ? 'corazón' : 'corazones'}`;
      const lvBox = $('end-levels');
      lvBox.innerHTML = '';
      LV.forEach((l, i) => {
        const c = document.createElement('span');
        c.className = 'es-lv' + (i < (e.levelsCleared || 0) ? ' done' : '');
        const im = document.createElement('img'); im.src = l.lm; im.alt = '';
        c.append(im, document.createTextNode(l.name));
        lvBox.appendChild(c);
      });
      const aw = $('awards');
      aw.innerHTML = '';
      const A_ = e.awards || {};
      [['turbos', '🚀', 'Más turbos', (r) => `${r.turbos} turbos`], ['fastest', '⚡', 'Más rápido a la zona', (r) => `${(r.reach / 1000).toFixed(1).replace('.', ',')} s en promedio`], ['streak', '🔥', 'Mejor racha', (r) => `${r.best} seguidas`]].forEach(([k, ico, title, stat], i) => {
        const r = A_[k];
        if (!r) return;
        const c = document.createElement('div');
        c.className = 'es-award';
        c.style.setProperty('--i', i);
        const im = document.createElement('img'); im.src = R.SKIN_URL(r.skin || 'dralingo'); im.alt = '';
        const t = document.createElement('span'); t.className = 'es-award-t'; t.textContent = `${ico} ${title}`;
        const n = document.createElement('b'); n.textContent = r.name;
        const s = document.createElement('small'); s.textContent = stat(r);
        c.append(im, t, n, s);
        aw.appendChild(c);
      });
      const crew = $('end-crew');
      crew.innerHTML = '';
      const all = (e.crew || []).slice(0, 40);
      crew.classList.toggle('dense', all.length > 14);
      crew.classList.toggle('xdense', all.length > 26);
      all.forEach((r, i) => {
        const dv = document.createElement('div'); dv.className = 'es-crewmate'; dv.style.setProperty('--i', Math.min(i, 20));
        const im = document.createElement('img'); im.src = R.SKIN_URL(r.skin || 'dralingo'); im.alt = '';
        const b = document.createElement('b'); b.textContent = r.name;
        dv.append(im, b); crew.appendChild(dv);
      });
      sfx('win', 0.9);
      confetti(e.escaped ? ['#ffd23f', '#ff8a1f', '#f9b4c8', '#ffffff'] : ['#ffd23f', '#9fdcf7', '#ffffff'], 70);
      setTimeout(() => bigFx('gang', { text: e.escaped ? '¡Escapamos!' : '¡Buen viaje, equipo!', mood: 'win', stamp: false, chars: cast && cast.jet ? [cast.jet] : [] }), 1100);
    };
    // the escape moment finishes first (the jet takes off), then the show; when the time runs out, a «¡Tiempo!» beat
    const box = $('moment');
    if (!box.classList.contains('hidden') && box.classList.contains('escape')) setTimeout(show, 1400);
    else if (!e.escaped) {
      const lv = LV[Math.max(0, Math.min(2, (e.level || 1) - 1))];
      sfx('tick', 0.8);
      bigMoment({ kind: 'timeup', robot: 'dizzy', title: '¡Tiempo!', sub: `Robotín se quedó sin batería. ¡Llegaron hasta ${lv.name}!`, ms: 2600 }, true);
      setTimeout(show, 2500);
    } else show();
  });

  // ---------- small helpers ----------
  let bannerTimer = null;
  function banner(text, kind) {
    document.querySelectorAll('.kd-banner').forEach((b) => b.remove());
    const b = document.createElement('div');
    b.className = 'kd-banner es-banner' + (kind ? ' ' + kind : '');
    b.textContent = text;
    document.body.appendChild(b);
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.remove(), 3100);
  }
  // Dralingo talks: during the chase his bubble rides above him at the front of the crew (one Dralingo on screen, never
  // two); in the rooms and big moments he peeks in from the corner (the platform's kd-dralingo)
  let sayTimer = null, lastSay = 0;
  function say(text, pose) {
    const now = Date.now();
    if (now - lastSay < 2500) return;
    lastSay = now;
    clearTimeout(sayTimer);
    if (es && es.phase === 'run' && !room && !$('screen-active').classList.contains('hidden')) {
      $('run-say').textContent = text;
      $('run-say').classList.add('show');
      $('dralingo').classList.remove('show');
    } else {
      $('dralingo-say').textContent = text;
      $('dralingo-img').src = D + (pose || 'hello') + '.webp';
      $('dralingo').classList.add('show');
    }
    sayTimer = setTimeout(() => { if (!testHold) hideDralingo(); }, 4200);
  }
  function hideDralingo() { $('dralingo').classList.remove('show'); $('run-say').classList.remove('show'); }
  function placeSay() {
    const b = $('run-say');
    if (!b.classList.contains('show') || !dralingoAt) return;
    b.style.transform = `translate(${Math.round(dralingoAt.x)}px, ${Math.round(dralingoAt.y)}px) translate(-20%, -100%)`;
  }
  function confetti(colors, n) {
    if (reduced()) return;
    for (let i = 0; i < n; i++) {
      const c = document.createElement('div');
      c.className = 'kd-confetti';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = 2.2 + Math.random() * 2 + 's';
      c.style.animationDelay = Math.random() * 1.2 + 's';
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 5600);
    }
  }
  function showScreen(name) {
    ['lobby', 'countdown', 'active', 'win'].forEach((n) => $('screen-' + n).classList.toggle('hidden', n !== name));
    document.body.classList.toggle('es-playing', name === 'active');
    if (name === 'lobby' || name === 'countdown') startLobbyLoop();
  }
  paintHearts();

  // test hooks for headless screenshots (browsers here barely run animation frames): draw now, read the state, stage moments
  window.EscapeHost = {
    frame: () => { if (es && g2) { resize(); frame(performance.now()); } return { es, crewM, robotM, kids: Object.keys(kids).length, zones: zones.length }; },
    debug: () => ({ pin, es, roster, occ, paused }),
    skipCountdown: () => { showScreen('active'); startTimer(); resize(); return true; },
    moment: (kind, level) => {
      if (kind === 'zap') { zapAt = performance.now(); dizzyUntil = Date.now() + 3000; return bigMoment({ kind: 'zap', robot: 'zap', title: '¡ZAP!', sub: '¡Cosquillas eléctricas! Todos mareados 3 s', ms: 60000 }, true); }
      if (kind === 'cleared') { clearedMoment(level || 1); return true; }
      if (kind === 'caught') { caughtMoment(); return true; }
      if (kind === 'escape') { escapeMoment(); return true; }
      if (kind === 'timeup') return bigMoment({ kind: 'timeup', robot: 'dizzy', title: '¡Tiempo!', sub: 'Robotín se quedó sin batería. ¡Llegaron hasta ' + LV[1].name + '!', ms: 2600 }, true);
      return false;
    },
    turbo: (idx, sup) => { const p = roster[idx] || {}; dashes[idx] = { t0: performance.now() - 450, super: !!sup }; pop({ idx, name: p.name || 'Ana', super: !!sup }); },
    hold: (v) => { testHold = !!v; if (!v) { dashes = {}; $('pops').innerHTML = ''; } return testHold; },
    say: (text, pose) => { lastSay = 0; say(text, pose); return true; },
  };
})();
