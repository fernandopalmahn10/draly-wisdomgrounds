// La Gran Fuga de Dubái v2 «Las rutas de la fuga» — projector view (spec docs/specs/gran-fuga-v2.md).
// Lobby (PIN, this round's ROUTE with «Cambiar ruta», the crew as their saga avatars, Robotín, the 3 steps) → the
// episode intro in the countdown (the crew with Dralingo and Profe Fer VS Robotín, 3-2-1) → the chase in the zone's
// own world (js/escape-render.js scene(): its far background and its ground strip in parallax, the next place's gate
// or Hamdan's jet arriving), every kid running, Robotín behind with his tickle-zaps, turbo names popping big → the
// «zona segura» room (the zone's painted top-down room, square, every kid, green zones with their limits, name tags
// that never overlap) → level cleared with a postcard of the next place → the escape: the crew boards Hamdan's jet
// and it takes off while Robotín arrives too late → the shared Mario Party ending (js/party.js).
// Big moments one at a time; the teacher's buttons always work (pause lets clicks through); an F5 keeps the room.
(function () {
  const socket = io();
  const $ = (id) => document.getElementById(id);
  const R = window.EscapeRender, M = window.EscapeMap, Cast = window.DralingoCast || null;
  const A = '/assets/kingdoms/', ES = '/assets/escape/', D = '/assets/dralingo/';
  // (chase pass 2026-10-19: a real zap — crackle + buzz —, his sparks and his siren; the old zap / glitch / turbo files
  // were too quiet to hear or 27 ms long; scripts/escape-sounds.js builds them all from the Kenney packs)
  const SFX = {
    tick: A + 'tick.mp3', whoosh: A + 'whoosh.mp3', win: A + 'sting-win.mp3', cleared: A + 'landmark.mp3', alert: A + 'castle-alert.mp3',
    turbo: ES + 'turbo-v2.mp3', super: ES + 'super-v2.mp3', zap: ES + 'zap-crackle.mp3', glitch: ES + 'spark.mp3', siren: ES + 'siren.mp3',
    safe: ES + 'safe.mp3', heart: ES + 'heart-v2.mp3', wave: ES + 'wave.mp3', jet: ES + 'jet.mp3', pop: A + 'tap.mp3',
  };
  // ---------- music: ONE constant map (to swap the chase track: `node scripts/escape-sounds.js --music <file>` prints
  // its line). The chase track reacts to the danger (Web Audio: a low-pass filter + its speed + its volume, MOODS):
  //   calm   Robotín asleep, the cards between places: muffled      chase  the run: the track
  //   danger the crew's alarm, his sprint, or a quarter of the class with him right behind them: a little faster
  //   zone   the zona segura: hiding, the chase muffled outside      final  the last minute: faster still
  const MUSIC = {
    lobby: { src: A + 'music-lobby.mp3' },
    chase: { src: ES + 'music-chase.mp3', pre: 0.25, loop: 70.2394 },   // «Desert Storm» by lemonmusicstudio (Pixabay), drum & bass, 82 / 164 BPM: his pick 2026-10-19
  };
  const MOODS = {     // f = the filter's cutoff (Hz), r = speed, v = volume
    calm: { f: 900, r: 1, v: 0.26 }, chase: { f: 16000, r: 1, v: 0.34 }, danger: { f: 16000, r: 1.07, v: 0.4 },
    zone: { f: 650, r: 0.98, v: 0.3 }, final: { f: 16000, r: 1.12, v: 0.42 },
  };
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ESCAPE_MS = 7500;     // core/escape.js R.ESCAPE_MS: the boarding + take-off on the stage

  let pin = null, state = null, muted = false;
  let es = null;              // the episode right now (es:init / es:phase / es:tick)
  let routePick = 0;          // the lobby's route (the server's g.esRoute)
  let roster = {}, cast = null, lobbyPlayers = null;
  const seenChips = new Set();   // lobby: only a kid who just joined gets the pop-in
  let crewM = 0, robotM = -22, crewShown = 0, robotShown = -22, dizzyUntil = 0, zapAt = 0, wakeUntil = 0, dazeUntil = 0, sprintUntil = 0;
  let closeFlag = false;     // «Robotín se acerca» (the server decides, with hysteresis)
  let pausedLeft = 0;        // the wave clock shown while the teacher pauses
  let pausedClockAt = 0;     // when the pause began (the round clock shows the time left at that moment)
  let room = null, zones = [], occ = {}, kids = {}, waveUntil = 0, waveTotal = 10000, flashAt = 0, zapTargets = [];
  let dashes = {};            // idx → { t0, super }
  let zappedAt = {};          // the chase pass: idx → when HIS Robotín zapped that kid (lightning on the runner, dizzy)
  let escapeAt = 0;           // performance.now() when the boarding began (phase 'escape')
  let paused = false, warned = {}, timerInterval = null;
  let canvas = null, g2 = null, raf = 0, lastFrame = 0, dralingoAt = null;
  let testHold = false;       // screenshots only (EscapeHost.hold): turbo dashes and name pops stay on screen
  let music = null, musicName = null;
  const zoneNow = () => M.zoneOf(es ? es.route : routePick, es ? es.level : 1);

  // ---------- sound ----------
  const lastSfx = {};
  function sfx(name, vol, gap) {
    if (muted || !SFX[name]) return;
    const now = Date.now();
    if (gap && now - (lastSfx[name] || 0) < gap) return;      // 30 kids answering: never a wall of noise
    lastSfx[name] = now;
    try { const a = new Audio(SFX[name]); a.volume = vol || 0.6; a.play().catch(() => {}); } catch (_) {}
  }
  // the lobby's loop: a plain <audio>
  function playMusic(name, vol) {
    if (name !== 'lobby') return;
    Deck.stop();
    if (musicName === name) return;
    stopLobby();
    musicName = name;
    if (muted) return;
    try { music = new Audio(MUSIC.lobby.src); music.loop = true; music.volume = vol || 0.36; music.play().catch(() => {}); } catch (_) {}
  }
  function stopLobby() { if (music) { try { music.pause(); } catch (_) {} } music = null; musicName = null; }
  function stopMusic() { stopLobby(); Deck.stop(); }
  // the chase track: decoded once, looped exactly (MUSIC.chase.pre / loop: the file carries a quarter second of itself
  // before and after the loop, so the encoder's padding never makes a gap), its mood glides (0.6 s)
  const Deck = (() => {
    let ac = null, buf = null, loading = null, src = null, filt = null, gain = null, mood = null, want = null, fb = null;
    const ctx = () => { if (!ac) { try { const C = window.AudioContext || window.webkitAudioContext; if (C) ac = new C(); } catch (_) { ac = null; } } return ac; };
    function load() {
      const c = ctx();
      if (!c) return Promise.resolve(null);
      if (!loading) loading = fetch(MUSIC.chase.src).then((r) => r.arrayBuffer()).then((b) => new Promise((res) => c.decodeAudioData(b, res, () => res(null)))).then((d) => { buf = d; return d; }).catch(() => null);
      return loading;
    }
    function play(m) {
      want = m;
      if (muted) return;
      const c = ctx();
      if (!c) { fallback(m); return; }
      if (c.state === 'suspended') c.resume().catch(() => {});
      if (!buf) { load().then((d) => { if (d && want) play(want); else if (!d && want) fallback(want); }); return; }
      if (!src) {
        const T = MUSIC.chase;
        src = c.createBufferSource(); src.buffer = buf; src.loop = true;
        src.loopStart = T.pre || 0; src.loopEnd = T.loop ? (T.pre || 0) + T.loop : buf.duration;
        filt = c.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = MOODS[m].f; filt.Q.value = 0.7;
        gain = c.createGain(); gain.gain.value = 0;
        src.connect(filt); filt.connect(gain); gain.connect(c.destination);
        src.start(0, T.pre || 0);
        mood = null;
      }
      setMood(m);
    }
    function setMood(m) {
      if (!src || mood === m || !MOODS[m]) return;
      mood = m;
      const M = MOODS[m], t = ac.currentTime;
      [[filt.frequency, M.f, true], [src.playbackRate, M.r], [gain.gain, M.v]].forEach(([p, v, exp]) => {
        p.cancelScheduledValues(t); p.setValueAtTime(p.value, t);
        if (exp) p.exponentialRampToValueAtTime(Math.max(40, v), t + 0.6); else p.linearRampToValueAtTime(v, t + 0.6);
      });
    }
    function stop() {
      want = null; mood = null;
      if (fb) { try { fb.pause(); } catch (_) {} fb = null; }
      if (!src) return;
      const s = src, gn = gain, t = ac.currentTime;
      src = null;
      try {
        if (ac.state === 'suspended') s.stop();         // (stopped while held by a pause: gone at once, nothing left to resume)
        else { gn.gain.cancelScheduledValues(t); gn.gain.setValueAtTime(gn.gain.value, t); gn.gain.linearRampToValueAtTime(0, t + 0.3); s.stop(t + 0.35); }
      } catch (_) {}
    }
    // no Web Audio: the same track as a plain loop, its mood only as its volume
    function fallback(m) {
      if (!fb) { try { fb = new Audio(MUSIC.chase.src); fb.loop = true; fb.play().catch(() => {}); } catch (_) { fb = null; } }
      if (fb) fb.volume = MOODS[m].v;
    }
    // a teacher's pause holds the track where it is (the chase picks up again from there on «Seguir»)
    function hold(v) { if (!ac || !src) { if (fb) { try { if (v) fb.pause(); else fb.play().catch(() => {}); } catch (_) {} } return; } if (v) ac.suspend().catch(() => {}); else ac.resume().catch(() => {}); }
    return { play, stop, load, hold, mood: () => mood || (fb ? 'fallback' : null) };
  })();
  $('mute-btn').addEventListener('click', () => {
    muted = window.toggleMute ? window.toggleMute() : !muted;
    $('mute-btn').textContent = muted ? '🔇 Sin sonido' : '🔊 Sonido';
    if (muted) stopMusic(); else if (!$('screen-lobby').classList.contains('hidden')) playMusic('lobby'); else musicFor(true);
  });
  document.addEventListener('click', () => {
    if (window.unlockAudio) window.unlockAudio();
    Deck.load();
    if (!$('screen-lobby').classList.contains('hidden')) playMusic('lobby', 0.33);
  }, { once: true });

  // ---------- room ----------
  const params = new URLSearchParams(location.search);
  const setId = params.get('setId');
  const LIVE = params.get('livegame') === '1' ? '&livegame=1' : '';   // from /maestro: keep pulling the class in
  if (!setId) { location.href = '/packs.html?game=escape' + LIVE; return; }
  R.preload(null, 0);
  const fmtDur = (v) => (v % 60 ? `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')} min` : `${v / 60} min`);
  function showPin(p) {
    pin = p;
    $('pin-display').textContent = p;
    $('active-pin-display').textContent = p;
    $('join-url').textContent = `${location.origin}/?pin=${p}`;
    document.title = `Draly Fuga · ${p}`;
    try { sessionStorage.setItem('draly.escapeHost', JSON.stringify({ pin: p, setId })); } catch (_) {}
  }
  function createRoom() {
    socket.emit('host:create', { gameType: 'escape' }, (r) => {
      if (!r || !r.pin) return;
      showPin(r.pin);
      socket.emit('host:set-duration', { pin, duration: +$('duration-slider').value });
      socket.emit('host:load-set', { pin, setId }, (resp) => {
        if (!resp || !resp.ok) { alert('No se pudo cargar la serie de preguntas.'); location.href = '/packs.html?game=escape' + LIVE; return; }
        $('set-display').textContent = `📚 ${resp.title} · ${resp.count} preguntas`;
        updateStartBtn();
      });
    });
  }
  // v2: a reload of this tab (F5 mid-class) takes the same room back (its token: js/teacher-gate.js) instead of a new
  // PIN; the server sends the episode (es:init) or the ending again, and the class plays on (like Pintores v2).
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem('draly.escapeHost') || 'null'); } catch (_) {}
  if (saved && saved.pin && saved.setId === setId && !LIVE) {
    socket.emit('host:reclaim', { pin: saved.pin }, (r) => {
      if (r && r.ok && r.gameType === 'escape') { showPin(saved.pin); $('set-display').textContent = '📚 la serie elegida'; }
      else createRoom();
    });
  } else createRoom();
  let connectedOnce = false;
  socket.on('connect', () => { if (connectedOnce && pin) socket.emit('host:reclaim', { pin }, () => {}); connectedOnce = true; });
  $('duration-slider').addEventListener('input', (e) => { $('duration-value').textContent = fmtDur(+e.target.value); });
  $('duration-slider').addEventListener('change', (e) => socket.emit('host:set-duration', { pin, duration: +e.target.value }));
  $('start-btn').addEventListener('click', () => { $('start-btn').disabled = true; socket.emit('host:start', { pin }); });
  $('add-time-btn').addEventListener('click', () => { socket.emit('host:add-time', { pin, seconds: 30 }); banner('+30 segundos ⏱'); });
  $('cut-time-btn').addEventListener('click', () => socket.emit('host:add-time', { pin, seconds: -30 }));
  socket.on('host:time-cut', (d) => { if (d && d.add) banner(`${-d.add} segundos menos ⏱`); });
  socket.on('host:time-refused', () => banner('Ya casi termina: no se puede quitar más tiempo'));
  $('end-now-btn').addEventListener('click', () => { if (confirm('¿Terminar la ronda ahora?')) socket.emit('host:end-now', { pin }); });
  $('pause-btn').addEventListener('click', () => socket.emit('host:pause', { pin, paused: !paused }));
  $('skip-btn').addEventListener('click', () => socket.emit('host:es-skip', { pin }));
  $('resume-btn').addEventListener('click', () => socket.emit('host:pause', { pin, paused: false }));
  $('play-again-btn').addEventListener('click', () => {
    if (ceremony) { ceremony.stop(); ceremony = null; }
    if (window.DralyParty && DralyParty.hurryGlow) DralyParty.hurryGlow(false);
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
    if (s.esRoute != null && s.esRoute !== routePick && s.state === 'lobby') { routePick = s.esRoute; paintRoute(); }
    if (s.state === 'lobby') {
      renderLobby(s.players); updateStartBtn();
      if (s.duration && +$('duration-slider').value !== s.duration) { $('duration-slider').value = s.duration; $('duration-value').textContent = fmtDur(s.duration); }
    }
    // a projector that reconnected around the start (missed 'countdown'): go to the episode
    if (s.state === 'active' && es && !$('screen-lobby').classList.contains('hidden') && !ceremony) { showScreen('active'); startTimer(); resize(); }
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

  // ---------- the route of this round (lobby): its three places and the jet; «Cambiar ruta» ----------
  const pickRoute = (dir) => { if (pin) socket.emit('host:es-route', { pin, route: M.routeIdx(routePick + dir) }, () => {}); };
  $('route-next').addEventListener('click', () => pickRoute(1));
  $('route-prev').addEventListener('click', () => pickRoute(-1));
  socket.on('es:route', (d) => { if (d && d.route != null) { routePick = d.route; paintRoute(); } });
  function paintRoute() {
    const rt = M.route(routePick);
    $('route-n').textContent = `Ruta ${M.routeIdx(routePick) + 1} de ${M.ROUTES.length}`;
    $('route-name').textContent = rt.name;
    $('es-sub').textContent = rt.intro + ' ¡Respondan para escapar en el jet de Hamdan!';
    const box = $('route-stops');
    box.innerHTML = '';
    M.zonesOf(routePick).forEach((z, i) => {
      const f = document.createElement('figure');
      f.className = 'es-stop';
      f.style.setProperty('--i', i);
      const im = document.createElement('img');
      im.src = M.art(z.id, 'bg-s'); im.alt = '';
      im.onerror = () => { im.onerror = null; im.src = z.icon; im.classList.add('icon'); };
      const c = document.createElement('figcaption');
      c.textContent = z.name;
      f.append(im, c);
      box.appendChild(f);
    });
    const j = document.createElement('figure');
    j.className = 'es-stop jet';
    const ji = document.createElement('img');
    ji.src = M.JET; ji.alt = '';
    ji.onerror = () => { ji.onerror = null; ji.src = '/assets/saga/avatars/plane.webp'; };
    const jc = document.createElement('figcaption');
    jc.textContent = 'El jet de Hamdan';
    j.append(ji, jc);
    box.appendChild(j);
    R.preload(null, routePick);
  }
  paintRoute();

  // ---------- little Robotín canvases (lobby, how-to, intro, meter, moments) ----------
  function robotCanvas(c, mood, t, scale) {
    if (!c) return;
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    const s = c.height * (scale || 0.8);
    R.robotin(g, c.width / 2 - s * 0.08, c.height - c.height * 0.06, s, { t, mood, moving: mood === 'chase' });
    if (R.onRobot) R.onRobot(mood, c, () => robotCanvas(c, mood, t, scale));      // his picture arrived: draw it
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
    ended = false; lastMinute = false;
    stopMusic();
    startLobbyLoop();
    const z1 = M.zoneOf(routePick, 1);
    $('intro-route').textContent = `${M.route(routePick).name} · ${z1.name}`;
    document.documentElement.style.setProperty('--es-intro-bg', `url("${M.art(z1.id, 'bg')}")`);
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
    $('intro-line').textContent = '¡Hola, tripulación! Robotín despertó: ¡a escapar respondiendo!';
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
    // between zones (cleared / caught) the stage shows the next run's start, not the old finish line
    if (d.phase === 'cleared' || d.phase === 'caught') { crewM = 0; robotM = -22; crewShown = 0; robotShown = -22; }
  }
  socket.on('es:init', (d) => {
    clearTimeout(stopRafTimer);
    const fresh = !es || es.round !== d.round;
    applyPublic(d);
    roster = d.players || {};
    if (Array.isArray(d.nz)) nearKids = d.nz;
    cast = d.cast || cast;
    if (d.route != null) routePick = d.route;
    if (fresh) { crewShown = crewM; robotShown = robotM; dashes = {}; warned = {}; zappedAt = {}; nearKids = []; lastMinute = false; ended = false; R.preload(null, es.route); Deck.load(); }
    canvas = $('es-canvas');
    g2 = canvas.getContext('2d');
    if (d.phase === 'zone') enterZone(d); else leaveZone();
    if (d.phase === 'escape') escapeAt = performance.now() - Math.max(0, ESCAPE_MS - (d.phaseMs || 0));
    if (d.phase === 'run' && fresh) { wakeUntil = Date.now() + (d.wakeMs || 0); setTimeout(() => wakeMoment(), 900); }
    paintLevel(); paintHearts(); resize();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
    // a projector that reconnected mid-round (missed 'countdown') would sit on the lobby: go to the episode
    if (state && state.state === 'active' && $('screen-active').classList.contains('hidden') && $('screen-countdown').classList.contains('hidden')) {
      showScreen('active'); startTimer();
    }
    musicFor(true);
  });
  socket.on('es:roster', (d) => { roster = d.players || roster; });
  socket.on('es:tick', (d) => {
    if (typeof d.c === 'number') { crewM = d.c; robotM = d.r; closeFlag = !!d.cl; }
    if (d.pos) applyPos(d.pos);
    if (d.occ) { occ = {}; d.occ.forEach(([zid, n, safe]) => { occ[zid] = { n, safe }; }); }
    if (typeof d.wl === 'number' && d.wl > 0) waveUntil = Date.now() + d.wl;
  });
  // the chase pass: the kids he is right behind (sent to the projector only, when the list changes)
  socket.on('es:nz', (nz) => {
    if (Array.isArray(nz) && !testHold) { nearKids = nz; musicFor(); }
  });
  socket.on('es:turbo', (d) => {
    dashes[d.idx] = { t0: performance.now(), super: !!d.super };
    pop(d);
    sfx(d.super ? 'super' : 'turbo', d.super ? 0.55 : 0.32, d.super ? 200 : 120);
  });
  // the chase pass: Robotín reached one kid (that kid's phone has the full zap): the projector shows who — lightning on
  // the runner, a cyan chip with the name, the crackle (a few at once never make a wall of noise)
  socket.on('es:pzap', (d) => {
    if (!d || !es || es.phase !== 'run') return;
    zappedAt[d.idx] = performance.now();
    sfx('zap', 0.4, 450);
    pop({ idx: d.idx, name: d.name, zap: true });
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
    if (m.type === 'sprint') { sprintUntil = Date.now() + 2500; sfx('siren', 0.4, 6000); sfx('glitch', 0.45, 4000); musicFor(true); if (Date.now() - momentAt > 3000) banner('⚡ ¡Robotín acelera!', 'robo'); }
    if (m.type === 'lastmin') {
      banner('⏱ ¡Último minuto!');
      lastMinute = true; musicFor(true);           // the chase track, faster still
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
      if (prev !== 'zone') { banner('🟢 ¡Zona segura! Entren en una zona verde', 'safe'); say(`¡A ${zoneNow().room}! Cuando se enciendan las zonas verdes, ¡entren!`, 'hello'); }
    } else leaveZone();
    if (d.clearedLevel && d.phase === 'cleared') clearedMoment(d.clearedLevel, d.heartBack);
    if (d.phase === 'caught') caughtMoment();
    if (d.phase === 'escape') escapeMoment();
    if (d.phase === 'run') { crewShown = 0; robotShown = d.robot; wakeUntil = Date.now() + (d.wakeMs || 0); dashes = {}; zappedAt = {}; nearKids = []; setTimeout(() => wakeMoment(d.replay), 300); }
    musicFor(true);
  });
  socket.on('es:wave', (w) => {
    zones = w.zones || [];
    occ = {};
    waveUntil = Date.now() + w.ms;
    waveTotal = w.ms;
    if (es) es.wave = w.wave;
    flashAt = 0; zapTargets = [];
    sfx('wave', 0.6);
    const capped = zones.some((z) => z.cap);
    $('wave-title').textContent = `Ola ${w.wave} de ${w.waves}`;
    $('wave-sub').textContent = capped ? '¡Sepárense! Cada zona tiene su límite' : '¡Entren en una zona verde!';
    $('zonehud').classList.remove('zapped');
    if (capped && w.wave === 2) banner('👥 ¡Sepárense! Cada zona tiene sitio para pocos', 'safe');
  });
  socket.on('es:wave-end', (r) => {
    flashAt = performance.now();
    zapTargets = r.out.map((i) => kids[i]).filter(Boolean);
    sfx('zap', 0.6);
    if (es) es.hearts = r.hearts;
    paintHearts(r.lost);              // (the hearts lost shake: the count is the new one)
    // the result in the wave card (the room stays clear: Robotín and the zones are the show)
    $('wave-title').textContent = r.out.length ? `✓ ${r.safe.length} a salvo` : (r.n > 1 ? '✓ ¡Todos a salvo!' : '✓ ¡A salvo!');
    $('wave-sub').textContent = r.out.length ? `⚡ ${r.out.length} fuera${r.lost ? ' · −' + r.lost + ' ❤️' : ' · ¡gratis!'}` : '¡Ningún zap!';
    $('zonehud').classList.toggle('zapped', !!r.out.length);
    if (!r.out.length) sfx('safe', 0.7);
    else {
      sfx('heart', 0.6);
      if (es && es.wave < 3) setTimeout(() => say('¡Juntos en la próxima ola! 🟢', 'hello'), 900);
    }
  });

  // the chase music's mood right now (called on every step of the episode and twice a second from the stage)
  let lastMinute = false, nearKids = [], musicAt = 0;
  let ended = false;          // «¡FINAL!» or the ceremony: the chase music stays silent until the next round's countdown
  function musicFor(force) {
    if (ended || !es || paused || ceremony) return;
    if (es.phase === 'escape') return;                               // (the jet's own sounds)
    if (!force && Date.now() - musicAt < 450) return;
    musicAt = Date.now();
    stopLobby();
    let m = 'chase';
    if (es.phase === 'zone') m = 'zone';
    else if (es.phase === 'cleared' || es.phase === 'caught') m = 'calm';
    else if (Date.now() < wakeUntil) m = 'calm';
    else if (closeFlag || Date.now() < sprintUntil || nearKids.length >= Math.max(2, crewList().length / 4)) m = 'danger';
    if (lastMinute && es.phase !== 'zone') m = 'final';
    Deck.play(m);
  }

  // ---------- the zona segura room ----------
  function enterZone(d) {
    room = M.buildRoom(es.seed, d.level || es.level, es.route);
    R.roomArt(room.zone);
    zones = d.zones || [];
    if (d.waveMs) { waveUntil = Date.now() + d.waveMs; waveTotal = d.waveTotalMs || d.waveMs; }
    applyPos(d.pos || [], true);
    $('zonehud').classList.remove('hidden');
    $('zoneside').classList.remove('hidden');
    $('zoneside-name').textContent = zoneNow().name;
    $('zoneside-room').textContent = 'En ' + zoneNow().room;
    $('zoneside-safe').textContent = '';
    if (!d.wave) { $('wave-title').textContent = '¡Zona segura!'; $('wave-sub').textContent = 'Las zonas verdes se encienden…'; }
    else { $('wave-title').textContent = `Ola ${d.wave} de ${d.waves || 3}`; $('wave-sub').textContent = (d.zones || []).some((z) => z.cap) ? '¡Sepárense! Cada zona tiene su límite' : '¡Entren en una zona verde!'; }      // (an F5 mid-wave)
    document.body.classList.add('es-zone-on');
  }
  function leaveZone() {
    const wasRoom = !!room;
    room = null; zones = []; kids = {}; occ = {};
    $('zonehud').classList.add('hidden');
    $('zoneside').classList.add('hidden');
    document.body.classList.remove('es-zone-on');
    if (wasRoom) $('dralingo').classList.remove('show');    // the run has its own Dralingo at the front: never two on screen
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
    if (room) drawZone(now); else if (es.phase === 'escape') drawEscape(now); else drawRun(now);
    hud(now);
    if (es.phase === 'run') musicFor();          // (throttled: the danger may have changed)
    placeSay();
  }

  // the chase in the zone's own world: its far background + ground strip (parallax), the crew, Robotín, the goal
  const PXM = 24;           // css px per metre of ground
  const PXG = 14;           // css px per metre between the crew's back and Robotín
  const crewX = (W) => W * 0.66;
  const MAX_SHOWN = 12;              // the projector shows 12 runners (+N): a wall of 30 tiny kids reads as nobody
  function sizes(H, n) { return n <= 6 ? H * 0.26 : H * 0.22; }
  function crewList() {
    return Object.entries(roster).filter(([, p]) => p.on !== false).map(([i, p]) => ({ idx: +i, name: p.name, skin: p.skin || 'dralingo' })).sort((a, b) => a.idx - b.idx);
  }
  // who runs on screen: the kids dashing right now first, then by join order (a turbo always shows its kid)
  function shownCrew(list) {
    if (list.length <= MAX_SHOWN) return list;
    // first the kids being zapped right now, then the ones dashing, then the ones he is right behind
    const pn = performance.now();
    const rank = (k) => (pn - (zappedAt[k.idx] || -1e9) < 1600 ? 0 : dashes[k.idx] ? 1 : nearKids.includes(k.idx) ? 2 : 3);
    return list.slice().sort((a, b) => rank(a) - rank(b) || a.idx - b.idx).slice(0, MAX_SHOWN).sort((a, b) => a.idx - b.idx);
  }
  // the pack: two staggered rows (front = even, back = odd), columns towards Robotín; a dashing kid jumps ahead,
  // cheering, with a gold ring and a speed trail
  function pack(list, cx, base, size, now) {
    const step = size * 0.62;
    return list.map((k, i) => {
      const back = i % 2 === 1, col = Math.floor(i / 2);
      let x = cx - col * step - (back ? step / 2 : 0), y = base - (back ? size * 0.17 : 0);
      const d = dashes[k.idx];
      let dash = 0;
      if (d) { const u = testHold ? 0.45 : (now - d.t0) / 900; if (u >= 1) delete dashes[k.idx]; else dash = Math.sin(Math.min(1, u) * Math.PI) * size * (d.super ? 1.3 : 0.85); }
      x += dash;
      return { k, x, y, dash, back, sup: d && d.super };
    });
  }
  function drawRun(now) {
    const dpr = canvas.width / Math.max(1, canvas.getBoundingClientRect().width);
    const W = canvas.width / dpr, H = canvas.height / dpr, t = now / 1000;
    const g = g2;
    const z = zoneNow();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const L = es.L || 100;
    const sc = R.scene(g, { zone: z, W, H, crew: crewShown + ((es.level || 1) - 1) * L, groundFrac: 0.4, feetFrac: 0.12, pxm: PXM, bgPxm: 1.4 });
    const base = sc.feetY;
    // the goal: the next place's gate (or Hamdan's jet with its stairs) comes into view in the last metres
    const goalX = crewX(W) + (L - crewShown) * PXM + 40;
    if (goalX < W + 500) R.goal(g, z, goalX, base + 2, z.exit === 'jet' ? H * 0.36 : H * 0.62, t);
    // the crew
    const all = crewList();
    const list = shownCrew(all);
    const more = all.length - list.length;
    const size = sizes(H, list.length);
    const cx = crewX(W);
    const dz = Date.now() < dizzyUntil;
    const packed = pack(list, cx, base, size, now);
    const back = packed.length ? Math.min(...packed.map((p) => p.x)) - size * 0.4 : cx;
    // Robotín behind the pack: the gap in metres is the distance on screen (at the edge while he is far)
    const gap = Math.max(0, crewShown - robotShown);
    const rx = Math.max(W * 0.07, back - size * 0.95 - gap * PXG);
    const rs = Math.min(H * 0.46, size * 2.1);
    const dazed = Date.now() < dazeUntil;
    const zapping = now - zapAt < 900;
    const waking = Date.now() < wakeUntil;
    const sprinting = Date.now() < sprintUntil;
    // (the chase pass: his eyes glow red when he is close to the crew or right behind several kids; a siren in a sprint)
    const zappingOne = Object.values(zappedAt).some((at) => performance.now() - at < 700);
    const eyes = closeFlag || sprinting ? 1 : Math.min(1, nearKids.length / Math.max(3, all.length * 0.3));
    R.robotin(g, rx, base + 4, rs, { t: sprinting ? t * 1.6 : t, mood: zapping || zappingOne ? 'zap' : (dazed ? 'dizzy' : 'chase'), moving: !waking && !dazed, glitch: true, eyes, siren: sprinting });
    // the back row first, then the front row; the speed trails under everyone
    packed.forEach((p) => { if (p.dash > 2) trail(g, p.x, p.y, size, p.dash, p.sup); });
    // (the chase pass: a runner HIS Robotín just zapped is dizzy; the ones he is right behind get a red ring)
    const pn = performance.now();
    packed.slice().sort((p, q) => p.y - q.y).forEach((p) => {
      const zp = pn - (zappedAt[p.k.idx] || -1e9) < 1800;
      R.kid(g, { x: p.x, y: p.y, skin: p.k.skin, idx: p.k.idx, moving: true, dizzy: dz || zp, cheer: p.dash > 2 && !zp, glow: p.dash > 2, danger: !zp && nearKids.includes(p.k.idx), f: 0 }, size, t);
    });
    // Dralingo leads the crew, pointing the way (his platform look)
    const dr = R.img(D + 'point.webp');
    const drF = R.ready(dr) ? dr : R.img(D + 'power.webp');
    if (R.ready(drF)) {
      const ds = size * 1.45, bob = -Math.abs(Math.sin(t * 9)) * ds * 0.05;
      const dw = ds * drF.naturalWidth / drF.naturalHeight;
      g.fillStyle = 'rgba(29,36,64,.22)'; R.ell(g, cx + size * 0.95, base + 2, ds * 0.26, ds * 0.07); g.fill();
      g.drawImage(drF, cx + size * 0.95 - dw / 2, base - ds + bob, dw, ds);
      dralingoAt = { x: cx + size * 0.95, y: base - ds };      // his speech bubble follows him
    }
    // every runner's name with its own kid: front row under the feet, back row over the head (a dashing kid's bigger)
    const taken = [];
    packed.slice().sort((p, q) => q.dash - p.dash).forEach((p) => R.tag(g, { x: p.x, y: p.y, name: p.k.name, me: false, below: !p.back }, size, 1, p.dash > 2 ? 20 : 17, null, taken));
    if (more > 0) {           // the rest of the crew, behind the pack
      const label = `+${more} más`;
      g.font = "800 20px 'Baloo 2', Nunito, sans-serif";
      const w = g.measureText(label).width + 26, mx = Math.max(w / 2 + 8, back - size * 0.1), my = base - size * 0.55;
      g.fillStyle = 'rgba(255,247,227,.96)'; R.rr(g, mx - w / 2, my - 17, w, 34, 17); g.fill();
      g.strokeStyle = R.INK; g.lineWidth = 3; g.stroke();
      g.fillStyle = R.INK; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, mx, my + 1);
    }
    // the zap: lightning from the broom to a few runners
    if (zapping) {
      const tip = { x: rx + rs * 0.6, y: base - rs * 0.42 };
      packed.slice(-5).forEach((p, i) => R.zap(g, tip.x, tip.y, p.x, p.y - size * 0.5, 4, (reduced() ? 7 : Math.floor(now / 50)) + i * 13));
    }
    // … and to each runner he zapped in the last 0.9 s (his personal zaps)
    packed.forEach((p, i) => {
      if (pn - (zappedAt[p.k.idx] || -1e9) < 900) R.zap(g, rx + rs * 0.6, base - rs * 0.42, p.x, p.y - size * 0.5, 3.5, (reduced() ? 7 : Math.floor(now / 50)) + i * 17);
    });
    $('danger').classList.toggle('on', es.phase === 'run' && closeFlag && !waking);
  }
  function trail(g, x, y, size, dash, sup) {
    g.save();
    g.globalAlpha = Math.min(1, dash / size) * 0.85;
    g.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      g.strokeStyle = sup ? (i % 2 ? 'rgba(255,138,31,.85)' : 'rgba(255,210,63,.9)') : 'rgba(255,255,255,.9)';
      g.lineWidth = sup ? 5 : 3.5;
      const yy = y - size * (0.2 + i * 0.17);
      g.beginPath(); g.moveTo(x - size * 0.35, yy); g.lineTo(x - size * 0.35 - dash * (0.8 + i * 0.12), yy); g.stroke();
    }
    g.restore();
  }
  // the escape (phase 'escape', 7.5 s): the crew runs up the stairs of Hamdan's jet, the door closes, the jet rolls and
  // takes off; Robotín arrives too late and spins dizzy. Drawn on the route's last scene.
  function drawEscape(now) {
    const dpr = canvas.width / Math.max(1, canvas.getBoundingClientRect().width);
    const W = canvas.width / dpr, H = canvas.height / dpr, t = now / 1000;
    const g = g2;
    const z = zoneNow();
    const L = es.L || 100;
    const u = testHold && escapeHoldU != null ? escapeHoldU * ESCAPE_MS / 1000 : Math.max(0, (now - escapeAt) / 1000);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sc = R.scene(g, { zone: z, W, H, crew: L + (es.level - 1) * L, groundFrac: 0.4, feetFrac: 0.1, pxm: PXM, bgPxm: 1.4 });
    const base = sc.feetY;
    const jh = H * 0.42;
    const doorX = W * 0.66;
    // the jet: parked facing the crew, then rolling left (from 3.8 s) and climbing out of the frame over Robotín
    const roll = Math.max(0, u - 3.8);
    const jx = doorX - roll * roll * 130;
    const lift = Math.max(0, u - 4.5);
    const jy = base - lift * lift * 75;
    const list = crewList();
    const size = sizes(H, list.length) * 0.92;
    // the crew walks to the stairs one by one and goes in (everyone aboard by ~3.4 s)
    const step = Math.min(0.3, 2.4 / Math.max(1, list.length));      // (boarding spread over ~3 s)
    const order = list.slice().reverse();
    const aboard = [];
    if (!lift) R.jet(g, jx, jy, jh, { faces: aboardSkins(order, u, step) });            // parked or rolling: behind the crew boarding it
    order.forEach((k, i) => {
      const t0 = 0.3 + i * step;
      const from = W * 0.44 - (i % 8) * size * 0.45;
      const p = Math.max(0, Math.min(1, (u - t0) / 0.9));
      if (p >= 1) { aboard.push(k); return; }
      const x = from + (doorX - from) * p;
      R.kid(g, { x, y: base - (i % 3) * size * 0.12 - p * jh * 0.08, skin: k.skin, idx: k.idx, moving: true, f: 0 }, size, t);
    });
    // Hamdan waves at the stairs, then goes in last
    if (u < 3.5) {
      const hm = R.img('/assets/cast/hamdan-hello.webp');
      if (R.ready(hm)) { const hh = H * 0.36; const hw = hh * hm.naturalWidth / hm.naturalHeight; g.drawImage(hm, doorX - hw - jh * 0.12, base - hh, hw, hh); }
    }
    // Robotín rolls in from the left too late, then spins dizzy
    const rIn = Math.min(1, Math.max(0, (u - 2.2) / 2));
    const rx = -H * 0.2 + rIn * (W * 0.3);
    R.robotin(g, rx, base + 4, H * 0.42, { t, mood: u > 4.8 ? 'dizzy' : 'chase', moving: rIn < 1, glitch: true });
    if (lift > 0) R.jet(g, jx, jy, jh, { lift: true, tilt: Math.min(0.24, lift * 0.16), faces: order.slice(0, 6).map((k) => k.skin) });      // (over Robotín once it climbs; the crew at the windows)
    if (u >= 4 && !escapeConfetti) { escapeConfetti = true; confetti(['#ffd23f', '#ff8a1f', '#f9b4c8', '#ffffff'], 80); sfx('jet', 0.8); }
  }
  let escapeConfetti = false, escapeHoldU = null, stopRafTimer = null;
  // the kids already aboard at time u show at the jet's windows (six at most)
  const aboardSkins = (order, u, step) => order.filter((k, i) => u - (0.3 + i * step) >= 0.9).slice(0, 6).map((k) => k.skin);

  // the zona segura room, the whole class at once: square, in the middle; the wave card left, the place's card right
  function drawZone(now) {
    const dpr = canvas.width / Math.max(1, canvas.getBoundingClientRect().width);
    const W = canvas.width / dpr, H = canvas.height / dpr, t = now / 1000;
    const g = g2;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const z = zoneNow();
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, z.sky[0]); bg.addColorStop(1, z.sky[1]);
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // the zone's far picture, dimmed, behind the room (the place stays the place)
    const far = R.img(M.art(z.id, 'bg'));
    if (R.ready(far)) {
      const bw = Math.max(W, H * far.naturalWidth / far.naturalHeight), bh = bw * far.naturalHeight / far.naturalWidth;
      g.globalAlpha = 0.55; g.drawImage(far, (W - bw) / 2, (H - bh) / 2, bw, bh); g.globalAlpha = 1;
      g.fillStyle = 'rgba(29,36,64,.28)'; g.fillRect(0, 0, W, H);
    }
    const T = room.tile, RW = room.cols * T, RH = room.rows * T;
    const s = Math.min((W - 2 * 250) / RW, (H - 12) / RH);
    const ox = (W - RW * s) / 2, oy = (H - RH * s) / 2;
    // the room's frame: a thick ink border with a soft shadow
    g.fillStyle = 'rgba(29,36,64,.35)'; R.rr(g, ox - 6, oy + 4, RW * s + 12, RH * s + 10, 20); g.fill();
    g.save();
    R.rr(g, ox, oy, RW * s, RH * s, 16); g.clip();
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
      size: list.length > 20 ? 44 : 50, tag: 16, tags: true, badge: 20,
    });
    g.restore();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.strokeStyle = R.INK; g.lineWidth = 4; R.rr(g, ox, oy, RW * s, RH * s, 16); g.stroke();
    $('danger').classList.remove('on');
  }

  // ---------- HUD ----------
  let hudKey = '', meterW = 0;
  window.addEventListener('resize', () => { meterW = 0; });
  function hud(now) {
    if (!es) return;
    const L = es.L || 100;     // the meter runs from 25 m before the start to the goal (Robotín's head start is visible)
    const esc = es.phase === 'escape';
    const cp = room || esc ? 1 : Math.max(0, Math.min(1, (crewShown + 25) / (L + 25))), rp = room ? 0 : esc ? 0.45 : Math.max(0, Math.min(1, (robotShown + 25) / (L + 25)));
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
    const z = zoneNow();
    $('level-ico').src = z.icon;
    $('level-name').textContent = z.name + (es.replay ? ' · otra vez' : '');
    $('level-num').textContent = `Nivel ${es.level} de 3 · ` + (es.phase === 'zone' ? 'Zona segura' : M.route(es.route).short);
    meterW = 0;          // the chip's width changed: measure the meter again
    const next = es.level >= 3 ? null : M.zoneOf(es.route, es.level + 1);
    $('meter-goal').src = next ? next.icon : M.JET;
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
  const escaping = () => (es && es.phase === 'escape') || escapeHoldU != null;
  function pop(d) {
    if (escaping()) return;            // (the escape: the jet and the ribbon only)
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
      el.className = 'es-pop' + (d.super ? ' super' : '') + (d.zap ? ' zap' : '') + (d.more ? ' more' : '');
      if (d.more) el.textContent = `+${d.more} más 🚀`;
      else {
        const sk = (roster[d.idx] || {}).skin;
        if (sk) { const im = document.createElement('img'); im.src = R.SKIN_URL(sk); im.alt = ''; el.appendChild(im); }
        const b = document.createElement('b'); b.textContent = d.name;
        const s = document.createElement('span'); s.textContent = d.zap ? '⚡ ¡Zap de Robotín!' : d.super ? '¡Súper turbo! 🔥' : '¡Turbo! 🚀';
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
    art.classList.toggle('postcard', !!o.postcard);
    if (o.art) { art.onerror = o.fallback ? () => { art.onerror = null; art.classList.remove('postcard'); art.src = o.fallback; } : null; art.src = o.art; }
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
    banner(replay ? '🤖 ¡Otra vez Robotín! ¡Ahora corre más rápido!' : `🤖 ¡Robotín despertó ${zoneNow().at}! ¡Corran!`, 'robo');
    if (es.level === 1 && !replay) say('¡Cada respuesta correcta es un turbo! 🚀', 'power');
  }
  // a zone cleared: a postcard of the NEXT place (the crew is about to run through its gate)
  function clearedMoment(level, heartBack) {
    sfx('cleared', 0.8);
    const next = level < 3 ? M.zoneOf(es.route, level + 1) : null;
    bigMoment({ kind: 'cleared', art: next ? M.art(next.id, 'bg') : M.JET, fallback: next ? next.icon : '/assets/saga/avatars/plane.webp', postcard: !!next,
      title: `¡Nivel ${level} superado!`, sub: (next ? `Siguiente parada: ${next.name}` : '') + (heartBack ? ' · +1 ❤️' : ''), cast: cheer(level - 1), line: cheer(level - 1) && Cast ? Cast.line(cheer(level - 1), 'chase') : '', ms: 3800 }, true);
    confetti(['#ffd23f', '#2fbf71', '#ff8a1f', '#ffffff'], 50);
  }
  function caughtMoment() {
    sfx('zap', 0.8);
    bigMoment({ kind: 'caught', robot: 'happy', title: '¡Robotín los alcanzó!', sub: 'Otra vez esta zona: Robotín va más rápido, ¡más turbos!', ms: 3800 }, true);
    setTimeout(() => say('¡Tranquilos, equipo! Lo intentamos otra vez juntos 💪', 'wise'), 3900);
  }
  // the escape: the stage itself shows the boarding and the take-off; a ribbon and Hamdan's line ride on top
  function escapeMoment() {
    escapeAt = performance.now();
    escapeConfetti = false;
    hideDralingo();
    popQ.length = 0; $('pops').innerHTML = '';
    document.querySelectorAll('.kd-banner').forEach((b) => b.remove());
    stopMusic();
    sfx('whoosh', 0.7);
    setTimeout(() => sfx('win', 0.8), 4200);
    const cid = cast && cast.jet ? cast.jet : 'hamdan';
    const rib = $('escape-ribbon');
    $('escape-title').textContent = '¡Al jet de Hamdan!';
    $('escape-sub').textContent = Cast ? `${Cast.name(cid)}: «${Cast.line(cid, 'win')}»` : '¡Rumbo al cielo!';
    rib.classList.remove('hidden', 'up');
    setTimeout(() => { $('escape-title').textContent = '¡Escaparon!'; rib.classList.add('up'); }, 3900);
    setTimeout(() => { if (!testHold) rib.classList.add('hidden'); }, ESCAPE_MS + 400);
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
    if (on) { stopLobby(); Deck.hold(true); } else { Deck.hold(false); musicFor(true); }
  }

  // ---------- the Mario Party ending (js/party.js, 2026-10-16): «¡FINAL!», the ceremony, «Otra ronda» ----------
  // His rule «Feelings at the end of class»: the reveal, the winners celebrate and the others react, the bonus stars one
  // by one, the podium. «⏭ Saltar» (top right) jumps every phone to its card; «Sonido» stays on top.
  let ceremony = null;
  const playUrl = (url, vol) => { if (muted) return; try { const a = new Audio(url); a.volume = vol == null ? 0.7 : vol; a.play().catch(() => {}); } catch (_) {} };
  const FINAL_SUB = { time: '¡Se acabó el tiempo!', end: '¡Fin de la ronda!', allFrozen: '¿Quién ganó la batalla?', escaped: '¡Despegamos! ¿Qué rango ganamos?' };
  socket.on('fin:final', (d) => {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    if ($('timer-display')) { $('timer-display').textContent = '0:00'; $('timer-display').classList.remove('urgent'); }
    ended = true;                 // (before showPaused: its «Seguir» path would start the chase music again)
    nearKids = []; zappedAt = {}; // (no red rings or lightning under «¡FINAL!»)
    if (window.DralyParty && DralyParty.hurryGlow) DralyParty.hurryGlow(false);
    stopMusic();
    hideDralingo();
    showPaused(false);
    document.querySelectorAll('.kd-banner').forEach((b) => b.remove());
    $('escape-ribbon').classList.add('hidden');
    if (es) document.documentElement.style.setProperty('--es-world-bg', `url("${M.art(zoneNow().id, 'bg')}")`);   // the ceremony's backdrop: the place they reached
    if ($('timer-display')) $('timer-display').classList.remove('pf-frenzy');
    if (window.DralyParty) { DralyParty.clearChip(); DralyParty.final({ mode: 'host', ms: d && d.ms, sub: FINAL_SUB[d && d.why] || FINAL_SUB.end, play: playUrl }); }
  });
  function partyEnd(d) {
    if (!window.DralyParty || !d || !d.fin) return false;
    DralyParty.clearChip();
    if ($('timer-display')) $('timer-display').classList.remove('pf-frenzy');
    if (ceremony) ceremony.stop();      // (the frozen stage stays under the show: never the old end screen, it would spoil the result)
    ceremony = new DralyParty.Ceremony({
      mode: 'host', game: 'escape', data: d, mount: document.body, play: playUrl,
      onSkip: () => socket.emit('host:fin-skip', { pin }),
      onAgain: () => { ceremony = null; $('play-again-btn').click(); },
      onHome: () => { location.href = '/'; },
    });
    return true;
  }
  socket.on('state', (s) => { if (s && s.state === 'lobby' && ceremony) { ceremony.stop(); ceremony = null; } });

  // the last 30 s («¡Súper turbos!»): every right answer is a súper turbo; a ribbon with the seconds, a red clock
  socket.on('fin:frenzy', (d) => {
    if (!d || !window.DralyParty) return;
    if (d.off) { DralyParty.clearChip(); if (!d.hold && DralyParty.hurryGlow) DralyParty.hurryGlow(false); if ($('timer-display')) $('timer-display').classList.remove('pf-frenzy'); return; }
    if (!d.again) {
      banner('🚀 ¡Últimos 30 segundos! ¡Súper turbos!', 'time');
      say('¡Últimos 30 segundos! ¡Cada acierto es un súper turbo!', 'power');
      // «¡Rápido!» (2026-10-19): the jingle and the alarm lights (the chase music keeps its own mood: it already rises)
      if (DralyParty.SND && DralyParty.SND.hurry) playUrl(DralyParty.SND.hurry, 0.85);
    }
    if (DralyParty.hurryGlow) DralyParty.hurryGlow(true);
    DralyParty.chip('Súper turbos', d.endsMs, 'host');
    if ($('timer-display')) $('timer-display').classList.add('pf-frenzy');
  });
  // ---------- end ----------
  socket.on('game-end', (d) => {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    clearTimeout(stopRafTimer);
    stopRafTimer = setTimeout(() => { cancelAnimationFrame(raf); raf = 0; }, 3000);    // the stage is gone: no more frames
    const ex = d && d.fin && d.fin.extra;      // (a projector reloaded during the ceremony: the backdrop from the ending's data)
    if (ex) document.documentElement.style.setProperty('--es-world-bg', `url("${M.art(M.zoneOf(ex.route || 0, ex.escaped ? 3 : (ex.level || 1)).id, 'bg')}")`);
    ended = true;
    stopMusic(); hideDralingo(); showPaused(false);
    if (!$('moment').classList.contains('hidden')) $('moment').classList.add('hidden');
    $('escape-ribbon').classList.add('hidden');
    if (partyEnd(d)) return;           // the Mario Party ceremony (the old end screen below stays as a fallback)
    const e = d.escape || {};
    const rt = M.route(e.route || 0);
    showScreen('win');
    const rk = e.rank || { id: 'zoco', name: rt.ranks.zoco, stars: 1 };
    $('rank-name').textContent = rk.name;
    $('rank-art').src = rk.art || rt.rankArt[rk.id] || rt.rankArt.zoco;
    $('rank-badge').className = 'es-badge ' + rk.id;
    $('rank-stars').textContent = '⭐'.repeat(rk.stars || 1);
    const zs = M.zonesOf(e.route || 0);
    const lvReached = zs[Math.max(0, Math.min(2, (e.level || 1) - 1))];
    $('end-why').textContent = e.escaped
      ? `¡Escaparon en el jet de Hamdan con ${e.hearts} ${e.hearts === 1 ? 'corazón' : 'corazones'}!`
      : `Llegaron hasta ${lvReached.name} · ${e.hearts} ${e.hearts === 1 ? 'corazón' : 'corazones'}`;
    const lvBox = $('end-levels');
    lvBox.innerHTML = '';
    zs.forEach((l, i) => {
      const c = document.createElement('span');
      c.className = 'es-lv' + (i < (e.levelsCleared || 0) ? ' done' : '');
      const im = document.createElement('img'); im.src = l.icon; im.alt = '';
      c.append(im, document.createTextNode(l.name));
      lvBox.appendChild(c);
    });
    const crew = $('end-crew');
    crew.innerHTML = '';
    (e.crew || []).slice(0, 40).forEach((r, i) => {
      const dv = document.createElement('div'); dv.className = 'es-crewmate'; dv.style.setProperty('--i', Math.min(i, 20));
      const im = document.createElement('img'); im.src = R.SKIN_URL(r.skin || 'dralingo'); im.alt = '';
      const b = document.createElement('b'); b.textContent = r.name;
      dv.append(im, b); crew.appendChild(dv);
    });
    sfx('win', 0.9);
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
    if (escaping()) return;
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
    debug: () => ({ pin, es, roster, occ, paused, routePick, music: { mood: Deck.mood(), ended, lobby: musicName }, nearKids }),
    skipCountdown: () => { showScreen('active'); startTimer(); resize(); return true; },
    moment: (kind, level) => {
      if (kind === 'zap') { zapAt = performance.now(); dizzyUntil = Date.now() + 3000; return bigMoment({ kind: 'zap', robot: 'zap', title: '¡ZAP!', sub: '¡Cosquillas eléctricas! Todos mareados 3 s', ms: 60000 }, true); }
      if (kind === 'cleared') { clearedMoment(level || 1); return true; }
      if (kind === 'caught') { caughtMoment(); return true; }
      if (kind === 'escape') { escapeMoment(); return true; }
      return false;
    },
    // the escape staged at u (0..1 of its 7.5 s): the boarding (≈ .3), the take-off (≈ .75)
    escapeAt: (u) => { if (!es) return false; es.phase = 'escape'; leaveZone(); escapeHoldU = u; testHold = true; escapeMoment(); if (u > 0.52) { $('escape-title').textContent = '¡Escaparon!'; $('escape-ribbon').classList.add('up'); } frame(performance.now()); return true; },
    unstage: (phase) => { if (es) es.phase = phase || 'run'; escapeHoldU = null; testHold = false; $('escape-ribbon').classList.add('hidden'); return true; },
    turbo: (idx, sup) => { const p = roster[idx] || {}; dashes[idx] = { t0: performance.now() - 450, super: !!sup }; pop({ idx, name: p.name || 'Ana', super: !!sup }); },
    hold: (v) => { testHold = !!v; if (!v) { dashes = {}; escapeHoldU = null; $('pops').innerHTML = ''; } return testHold; },
    // the chase pass: hold a personal zap on runner `zap` (lightning, dizzy, its cyan chip) and red rings on `near`
    chase: (o) => {
      o = o || {};
      if (o.zap != null) { zappedAt[o.zap] = performance.now() + 1e7; const p = roster[o.zap] || {}; pop({ idx: o.zap, name: p.name || 'Ana', zap: true }); }
      if (Array.isArray(o.near)) nearKids = o.near;
      if (es && g2) { resize(); frame(performance.now()); }
      return { near: nearKids, zapped: Object.keys(zappedAt), mood: Deck.mood() };
    },
    say: (text, pose) => { lastSay = 0; say(text, pose); return true; },
  };
})();
