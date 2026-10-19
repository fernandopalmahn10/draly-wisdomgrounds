// Reinos de Colores — projector view.
// Lobby (PIN, kingdoms, the 3 steps) → the round's two captains face off during the countdown → live hex board with the
// Dubai landmarks, fed by small kd:plant diffs → winner screen with the gang. Big moments use DralingoFX
// (js/dralingo-fx.js, one effect at a time) and the cast (js/cast.js); the Dralingo announcer bubble covers the rest.
(function () {
  const socket = io();
  const $ = (id) => document.getElementById(id);
  const NAMES = { red: 'Reino del Fuego', gold: 'Reino del Mar' };
  const SHORT = { red: 'Fuego', gold: 'Mar' };
  const A = '/assets/kingdoms/';
  const SFX = {
    plant: A + 'plant.mp3', surround: A + 'surround.mp3', alert: A + 'castle-alert.mp3', siege: A + 'siege.mp3',
    tick: A + 'tick.mp3', whoosh: A + 'whoosh.mp3', win: A + 'sting-win.mp3', flag: A + 'flag.mp3', landmark: A + 'landmark.mp3',
  };
  // Team-coloured Dralingo (his rule 2026-10-11): moments about the Fuego kingdom use the red dragon.
  const RED_POSES = ['jump', 'flag', 'shocked', 'thinking', 'pointing', 'champion', 'countdown', 'fly'];
  const POSE = (n, team) => A + 'dralingo/' + n + (team === 'red' && RED_POSES.includes(n) ? '-red' : '') + '.webp';
  const FX_POSES = { red: ['jump-red', 'flag-red', 'champion-red', 'pointing-red'], gold: ['jump', 'flag', 'champion', 'pointing', 'party', 'clap'] };
  const LM = KdBoard.LANDMARKS;
  const LM_BIG = (k) => A + 'landmarks/big/' + k + '.webp';    // 440 px tall, for the full-screen moment
  const Cast = window.DralingoCast || null;
  // Recorded music loops (Kenney): lobby → battle → tense final 30 s.
  let music = null;
  let musicName = null;
  function playMusic(name, vol) {
    if (musicName === name) return;
    stopMusic();
    musicName = name;
    if (muted) return;
    try {
      music = new Audio(A + name + '.mp3'); music.loop = true; music.volume = vol || 0.4;
      if (name === 'music-battle' && window.DralyParty) DralyParty.hurryApply(music);   // (back from a pause in the last 30 s: still fast)
      music.play().catch(() => {});
    } catch (_) {}
  }
  function stopMusic() { if (music) { try { music.pause(); } catch (_) {} } music = null; musicName = null; }
  // «¡Rápido!» (the last 30 s, 2026-10-19): the jingle, then the battle music back faster and higher (js/party.js); before,
  // another loop (music-final) that didn't match took over
  function hurryUp() {
    if (!window.DralyParty) { playMusic('music-final', 0.42); return; }
    if (DralyParty.hurryOn()) return;            // (once: a resent fin:frenzy never replays the jingle)
    DralyParty.hurryHost({ play: playUrl, music: () => (musicName === 'music-battle' ? music : null), vol: 0.42 });
  }
  const hurryOff = () => { if (window.DralyParty) DralyParty.hurryHostOff(music); };

  let pin = null;
  let state = null;
  let muted = false;
  let board = null;          // KdBoard instance
  let boardData = null;
  let own = {};
  let players = {};          // id → { name, team, score }
  let captains = null;       // { red: castId, gold: castId } — a new pair every round
  let timerInterval = null;
  let warned = {};
  let lastPlantSfx = 0;

  // ---------- sound ----------
  function sfx(name, vol) {
    if (muted) return;
    const now = Date.now();
    if (name === 'plant') { if (now - lastPlantSfx < 120) return; lastPlantSfx = now; }
    try { const a = new Audio(SFX[name]); a.volume = vol || 0.6; a.play().catch(() => {}); } catch (_) {}
  }
  $('mute-btn').addEventListener('click', () => {
    muted = window.toggleMute ? window.toggleMute() : !muted;
    $('mute-btn').textContent = muted ? '🔇 Sin sonido' : '🔊 Sonido';
    if (muted) stopMusic();
    else if (!$('screen-lobby').classList.contains('hidden')) playMusic('music-lobby', 0.35);
  });
  document.addEventListener('click', () => {
    if (window.unlockAudio) window.unlockAudio();
    if (!$('screen-lobby').classList.contains('hidden')) playMusic('music-lobby', 0.35);   // browsers need a first click
  }, { once: true });

  // ---------- room ----------
  const params = new URLSearchParams(location.search);
  const setId = params.get('setId');
  // From /maestro the page opens with ?livegame=1 (pull the class in): keep that flag through the question picker.
  const LIVE = new URLSearchParams(location.search).get('livegame') === '1' ? '&livegame=1' : '';
  if (!setId) { location.href = '/packs.html?game=kingdoms' + LIVE; return; }

  socket.emit('host:create', { gameType: 'kingdoms' }, ({ pin: p }) => {
    pin = p;
    $('pin-display').textContent = p;
    $('active-pin-display').textContent = p;
    $('join-url').textContent = `${location.origin}/?pin=${p}`;
    document.title = `Reinos de Colores · ${p}`;
    socket.emit('host:set-duration', { pin, duration: +$('duration-slider').value });
    socket.emit('host:load-set', { pin, setId }, (resp) => {
      if (!resp || !resp.ok) {
        alert('No se pudo cargar la serie de preguntas: ' + ((resp && resp.error) || 'desconocido'));
        location.href = '/packs.html?game=kingdoms' + LIVE;
        return;
      }
      $('set-display').textContent = `📚 ${resp.title} · ${resp.count} preguntas`;
      updateStartBtn();
    });
  });

  function fmtDur(v) { return v % 60 ? `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')} min` : `${v / 60} min`; }
  $('duration-slider').addEventListener('input', (e) => { $('duration-value').textContent = fmtDur(+e.target.value); });
  $('duration-slider').addEventListener('change', (e) => socket.emit('host:set-duration', { pin, duration: +e.target.value }));
  $('balance-btn').addEventListener('click', () => { socket.emit('host:auto-balance', { pin }); MochiSounds.swap && MochiSounds.swap(); });
  $('start-btn').addEventListener('click', () => socket.emit('host:start', { pin }));
  $('add-time-btn').addEventListener('click', () => {
    socket.emit('host:add-time', { pin, seconds: 30 });
    banner('+30 segundos ⏱');
  });
  $('end-now-btn').addEventListener('click', () => {
    if (confirm('¿Terminar la ronda ahora?')) socket.emit('host:end-now', { pin });
  });
  $('play-again-btn').addEventListener('click', () => {
    if (ceremony) { ceremony.stop(); ceremony = null; }
    hurryOff();
    socket.emit('host:reset', { pin });
    captains = null;
    showScreen('lobby');
    playMusic('music-lobby', 0.35);
  });
  // Wifi blip on the projector: socket.io reconnects with a NEW socket; reclaim the same room so the board,
  // the end of the round and the teacher buttons keep working (the server re-sends kd:init mid-round).
  let connectedOnce = false;
  socket.on('connect', () => {
    if (connectedOnce && pin) socket.emit('host:reclaim', { pin }, () => {});
    connectedOnce = true;
  });
  socket.on('host:start-error', (e) => alert(e && e.message ? e.message : 'No se pudo empezar.'));

  function updateStartBtn() {
    if (!state) return;
    $('start-btn').disabled = !(state.questionsLoaded > 0 && Object.keys(state.players || {}).length > 0);
  }

  socket.on('state', (s) => {
    state = s;
    Object.entries(s.players || {}).forEach(([id, p]) => {
      players[id] = Object.assign(players[id] || {}, { name: p.name, team: p.team, avatar: p.avatar });
      if (typeof p.score === 'number' && s.state !== 'active') players[id].score = p.score;
    });
    Object.keys(players).forEach((id) => { if (!s.players[id]) delete players[id]; });
    if (s.state === 'lobby') { renderLobby(s.players); updateStartBtn(); }
    if (s.state === 'active' && timerInterval) renderRosters();
  });

  function renderLobby(map) {
    ['red', 'gold'].forEach((team) => {
      const box = $('players-' + team);
      box.innerHTML = '';
      const list = Object.entries(map || {}).filter(([, p]) => p.team === team);
      $('count-' + team).textContent = list.length === 1 ? '1 jugador' : `${list.length} jugadores`;
      list.forEach(([id, p]) => {
        const chip = document.createElement('button');
        chip.className = 'kd-chip';
        chip.textContent = (p.avatar ? p.avatar + ' ' : '') + p.name;
        chip.title = 'Cambiar de reino';
        chip.addEventListener('click', () => { socket.emit('host:swap-team', { pin, playerId: id }); MochiSounds.swap && MochiSounds.swap(); });
        box.appendChild(chip);
      });
    });
  }

  // ---------- captains (two of the gang lead the kingdoms; revealed during the countdown) ----------
  socket.on('kd:captains', (c) => { captains = c; paintCaptains(true); });
  function paintCaptains(intro) {
    const ok = !!(captains && Cast);
    ['red', 'gold'].forEach((team) => {
      $('cap-' + team).classList.toggle('hidden', !ok);
      $('side-cap-' + team).classList.toggle('hidden', !ok);
      if (!ok) { $('side-capname-' + team).textContent = ''; return; }
      const id = captains[team];
      $('cap-' + team + '-img').src = Cast.pose(id, 'cheer');
      $('cap-' + team + '-name').textContent = Cast.captain(id);
      $('side-cap-' + team).src = Cast.pose(id, 'hello');
      $('side-capname-' + team).textContent = Cast.captain(id);
      if (intro) { const el = $('cap-' + team); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; }
    });
  }

  // ---------- countdown ----------
  let introSaid = false;
  socket.on('countdown', () => {
    showScreen('countdown');
    stopMusic();
    introSaid = false;
    Object.keys(lmLast).forEach((k) => delete lmLast[k]);
    let n = 3;
    const num = $('countdown-num');
    const tick = () => {
      num.style.animation = 'none'; void num.offsetWidth; num.style.animation = '';
      if (n > 0) { num.textContent = n; sfx('tick', 0.9); n--; setTimeout(tick, 900); }
      else { num.textContent = '¡A conquistar!'; num.classList.add('go'); sfx('whoosh', 0.9); setTimeout(() => { num.classList.remove('go'); showScreen('active'); startTimer(); playMusic('music-battle', 0.32); }, 900); }
    };
    tick();
  });

  // ---------- board ----------
  socket.on('kd:init', (d) => {
    boardData = d.board;
    own = Object.assign({}, d.own);
    Object.entries(d.players || {}).forEach(([id, p]) => { players[id] = Object.assign(players[id] || {}, p); });
    if (d.captains) { captains = d.captains; paintCaptains(false); }
    board = KdBoard.create($('board'), boardData, own, { grass: '/assets/kingdoms/grass.png', castle: '/assets/kingdoms/castle.png' });
    Object.values(boardData.landmarks || {}).forEach((k) => { new Image().src = LM_BIG(k); });   // the big moment shows instantly
    lmKey = '';
    updateScores(d.teamScores);
    renderRosters();
    renderLms();
    // A projector that reconnected mid-round (missed 'countdown') would otherwise sit on the lobby: go to the board.
    if (state && state.state === 'active' && $('screen-active').classList.contains('hidden') && $('screen-countdown').classList.contains('hidden')) {
      showScreen('active');
      startTimer();
      playMusic('music-battle', 0.32);
    }
    if (!introSaid) { introSaid = true; say('¡Que empiece la conquista! Respondan bien y conquisten los monumentos de Dubái 🏙️', 'flag'); }
  });

  socket.on('kd:plant', (d) => {
    if (!board) return;
    if (players[d.playerId]) players[d.playerId].score = typeof d.playerScore === 'number' ? d.playerScore : (players[d.playerId].score || 0) + 1;
    if (d.tile !== null && d.tile !== undefined) {
      own[d.tile] = d.team;
      board.set(d.tile, d.team, 'pop');
      board.tag(d.tile, (d.double ? '🚩🚩 ' : '') + d.by, d.team);
      sfx('plant', 0.5);
    }
    const flipped = d.flipped || [];
    flipped.forEach((f, i) => {
      own[f.id] = d.team;
      setTimeout(() => board.set(f.id, d.team, 'flip'), 120 + i * 45);
    });
    const nf = flipped.length;
    const tookLandmark = (d.events || []).some((ev) => ev.type === 'landmark');
    if (nf >= 1) {
      setTimeout(() => board.burst(flipped.map((f) => f.id), d.team), 140);
      sfx('surround', 0.7);
      banner(`¡${d.by} rodeó ${nf === 1 ? '1 casilla' : nf + ' casillas'}! 🔁`, d.team);
      // a surround that also took a landmark: the landmark moment tells the story, no second effect on top
      if (nf >= 5 && !tookLandmark) bigFx('zoom', { text: `¡${d.by} rodeó ${nf} casillas!`, poses: FX_POSES[d.team] }) || say(`¡Increíble, ${d.by}!`, 'jump', d.team);
      else if (nf >= 3) say(`¡Increíble, ${d.by}! El ${NAMES[d.team]} encerró ${nf} casillas de golpe.`, 'jump', d.team);
    }
    (d.events || []).forEach((ev) => {
      if (ev.type === 'landmark') {
        onLandmark(ev);
      } else if (ev.type === 'castle-alert') {
        sfx('alert', 0.7);
        banner(`🏰 ¡El castillo del ${SHORT[ev.team]} está casi rodeado!`, ev.team === 'red' ? 'gold' : 'red');
        const cap = captains && captains[ev.team];
        if (!(cap && bigFx('cameo', { char: cap, mood: 'oops', text: '¡Defiendan el castillo!' }, 5000))) {
          say(`¡Cuidado, ${NAMES[ev.team]}! Defiendan su castillo.`, 'shocked', ev.team);
        }
      } else if (ev.type === 'siege') {
        sfx('siege', 0.8);
        banner(`⚔️ ¡Asedio! ${NAMES[ev.by]} +${ev.bonus} puntos`, ev.by);
        bigFx('gang', {
          text: `¡El ${NAMES[ev.by]} rodeó el castillo!`, mood: 'win', stamp: '¡ASEDIO!', team: ev.by,
          chars: captains ? [captains[ev.by]] : [], exclude: captains ? [captains[ev.team]] : [],
        }, 0) || say(`¡Asedio total! El ${NAMES[ev.by]} rodeó el castillo enemigo.`, 'champion', ev.by);
        confetti(ev.by, 40);
      } else if (ev.type === 'lead' && ev.team) {
        // In a close round the lead flips a lot: the captain cheers at most every 20 s, Dralingo's bubble covers the rest.
        const cap = captains && captains[ev.team];
        if (cap && Cast && Date.now() - leadFxAt > 20000 && bigFx('cameo', { char: cap, mood: 'battle', text: `¡${SHORT[ev.team]} al frente! ${Cast.line(cap, 'battle')}` })) {
          leadFxAt = Date.now();
        } else {
          say(`¡El ${NAMES[ev.team]} pasa al frente!`, 'pointing', ev.team);
        }
      }
    });
    updateScores(d.teamScores);
    renderRosters();
    renderLms();
  });

  function updateScores(ts) {
    if (!ts) return;
    const r = ts.red || 0;
    const g = ts.gold || 0;
    const total = Math.max(1, r + g);
    $('tug-red').style.flexBasis = Math.max(8, Math.min(92, (r / total) * 100)) + '%';
    $('tug-gold').style.flexBasis = Math.max(8, Math.min(92, (g / total) * 100)) + '%';
    $('tug-red').textContent = r;
    $('tug-gold').textContent = g;
    $('tiles-red').textContent = r;
    $('tiles-gold').textContent = g;
  }

  // Landmarks each kingdom holds, as little pictures under its score (only re-drawn when something changed).
  let lmKey = '';
  function heldLms(team) {
    return Object.entries((boardData && boardData.landmarks) || {}).filter(([id]) => own[id] === team).map(([, k]) => k);
  }
  function renderLms() {
    const key = heldLms('red').join() + '|' + heldLms('gold').join();
    if (key === lmKey) return;
    lmKey = key;
    ['red', 'gold'].forEach((team) => fillLms($('lms-' + team), heldLms(team)));
  }
  function fillLms(box, keys) {
    box.innerHTML = '';
    keys.forEach((k) => {
      const i = document.createElement('img');
      i.src = KdBoard.LM_SRC(k);
      i.alt = LM[k].name;
      i.title = `${LM[k].name} +${LM[k].bonus}`;
      box.appendChild(i);
    });
  }

  function renderRosters() {
    ['red', 'gold'].forEach((team) => {
      const ul = $('roster-' + team);
      const list = Object.values(players).filter((p) => p.team === team).sort((a, b) => (b.score || 0) - (a.score || 0));
      ul.innerHTML = '';
      list.slice(0, 8).forEach((p, i) => {
        const li = document.createElement('li');
        if (i === 0 && (p.score || 0) > 0) li.className = 'king';
        const name = document.createElement('span');
        name.textContent = (i === 0 && (p.score || 0) > 0 ? '👑 ' : '') + p.name;
        const sc = document.createElement('span');
        sc.textContent = p.score || 0;
        li.append(name, sc);
        ul.appendChild(li);
      });
      if (list.length > 8) {
        const li = document.createElement('li');
        li.textContent = `+${list.length - 8} más`;
        ul.appendChild(li);
      }
    });
  }

  // ---------- big moments ----------
  // One big effect at a time and not too often: the board is the show.
  let fxAt = 0;
  let leadFxAt = 0;
  function bigFx(kind, opts, gapMs) {
    if (!window.DralingoFX || lmBusy) return false;          // never on top of a landmark moment
    const now = Date.now();
    if (now - fxAt < (gapMs == null ? 7000 : gapMs)) return false;
    if (DralingoFX.play(kind, opts)) { fxAt = now; return true; }
    return false;
  }
  // A Dubai landmark changed hands. With 30 kids they flip back and forth all round, so only the first capture of each
  // landmark (or one after a long while) gets the full-screen moment, at most one every 8 s; the other flips get the
  // board hop + a banner. A queued moment that is out of date by the time it would show is dropped.
  const LM_FULL_GAP = 8000;
  const LM_REPEAT_GAP = 25000;
  const LM_SHOW_MS = 2300;
  const lmLast = {};          // tile → when its last full moment played (cleared every round)
  const lmQueue = [];
  let lmBusy = false;
  let lmFullAt = 0;
  const lmText = (ev) => {
    const L = LM[ev.lm];
    return ev.from && ev.from !== ev.team ? `¡El ${SHORT[ev.team]} le quita ${L.the} al ${SHORT[ev.from]}!` : `¡El ${SHORT[ev.team]} conquista ${L.the}!`;
  };
  function onLandmark(ev) {
    if (!LM[ev.lm]) return;
    const now = Date.now();
    const first = !lmLast[ev.tile];
    if (!lmBusy && now - lmFullAt > LM_FULL_GAP && (first || now - lmLast[ev.tile] > LM_REPEAT_GAP)) { landmarkMoment(ev); return; }
    if (first && lmQueue.length < 2 && !lmQueue.some((q) => q.tile === ev.tile)) { lmQueue.push(ev); return; }
    sfx('landmark', 0.45);
    banner('🏙️ ' + lmText(ev), ev.team);
  }
  function landmarkMoment(ev) {
    if ($('screen-active').classList.contains('hidden')) return;      // the round ended meanwhile
    lmBusy = true;
    lmFullAt = Date.now();
    lmLast[ev.tile] = lmFullAt;
    const L = LM[ev.lm];
    const bonus = ev.bonus || L.bonus;
    sfx('landmark', 0.8);
    const box = $('lm-moment');
    $('lm-moment-img').src = LM_BIG(ev.lm);
    $('lm-moment-plus').textContent = '+' + bonus;
    const text = $('lm-moment-text');
    text.innerHTML = '';
    const big = document.createElement('b');
    big.textContent = lmText(ev);
    const small = document.createElement('span');
    small.textContent = `🚩 ${ev.by} · +${bonus} puntos para el ${NAMES[ev.team]}`;
    text.append(big, small);
    box.className = 'kd-lm-moment ' + ev.team;
    void box.offsetWidth;
    box.classList.add('show');
    fxAt = Date.now();                 // nothing else on top of this one
    setTimeout(() => {
      box.className = 'kd-lm-moment hidden';
      lmBusy = false;
      // next queued first-capture, only if that kingdom still holds it
      let next = lmQueue.shift();
      while (next && own[next.tile] !== next.team) next = lmQueue.shift();
      if (next) setTimeout(() => { if (!lmBusy && own[next.tile] === next.team) landmarkMoment(next); }, 900);
    }, LM_SHOW_MS);
  }

  // ---------- timer ----------
  function startTimer() {
    warned = {};
    $('timer-display').classList.remove('urgent');
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!state || !state.endsAt) return;
      if (hostPaused) {      // paused: the clock stands still (and shows «+30 s» at once)
        const ps = Math.ceil(Math.max(0, state.endsAt - hostPausedAt) / 1000);
        $('timer-display').textContent = `${Math.floor(ps / 60)}:${String(ps % 60).padStart(2, '0')}`;
        return;
      }
      const left = Math.max(0, state.endsAt - Date.now());
      const sec = Math.ceil(left / 1000);
      $('timer-display').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      if (sec === 60 && !warned[60]) { warned[60] = 1; banner('⏱ ¡Queda 1 minuto!'); }
      if (sec === 30 && !warned[30]) {
        warned[30] = 1;
        bigFx('spotlight', { text: '¡Últimos 30 segundos! ¡Banderas dobles!', poses: ['countdown'] }, 0) || say('¡Últimos 30 segundos! Cada acierto vale dos banderas.', 'countdown');
        // («¡Rápido!» comes with the server's fin:frenzy: only rounds of 60 s or more, and «+30 s» takes it back)
      }
      if (sec <= 10 && sec > 0 && !warned['t' + sec]) { warned['t' + sec] = 1; $('timer-display').classList.add('urgent'); }
      // the last 10 s: a clock that ticks and tocks twice, then four times a second (was one tick a second)
      const ci = window.DralyParty ? DralyParty.clockIdx(left) : -1;
      if (ci >= 0 && ci !== warned.clock) { warned.clock = ci; DralyParty.hurryClock(ci, playUrl); }
      if (sec > 10) $('timer-display').classList.remove('urgent');
    }, 250);
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
    hurryOff();
    stopMusic();
    hideDralingo();
    $('lm-moment').className = 'kd-lm-moment hidden';
    lmQueue.length = 0;
    lmBusy = false;
    document.querySelectorAll('.kd-banner').forEach((b) => b.remove());
    if ($('timer-display')) $('timer-display').classList.remove('pf-frenzy');
    if (window.DralyParty) { DralyParty.clearChip(); DralyParty.final({ mode: 'host', ms: d && d.ms, sub: FINAL_SUB[d && d.why] || FINAL_SUB.end, play: playUrl }); }
  });
  // the last 30 s, from the server (it can switch off again after «+30 s»): a banner, a ribbon with the seconds, a red clock
  socket.on('fin:frenzy', (d) => {
    if (!d || !window.DralyParty) return;
    // (`hold` = «⏸ Pausa» in the last 30 s: the hurry waits with the clock; a real `off` = «+30 s» gave the time back)
    if (d.off) { DralyParty.clearChip(); if (!d.hold) hurryOff(); if ($('timer-display')) $('timer-display').classList.remove('pf-frenzy'); return; }
    if (!d.again) banner('🚩🚩 ¡Últimos 30 segundos! ¡Banderas dobles!');
    DralyParty.chip('Banderas ×2', d.endsMs, 'host');
    if (d.again) { DralyParty.hurryGlow(true); DralyParty.hurryApply(music); } else if (!hostPaused) hurryUp();   // (after «Seguir»: no second jingle)
    if ($('timer-display')) $('timer-display').classList.add('pf-frenzy');
  });
  // «⏸ Pausa» (2026-10-16): the clock stops, plant windows / dragons wait; the card lets the buttons under it work
  let hostPaused = false, hostPausedAt = 0;
  function showHostPaused(v) {
    if (!!v !== hostPaused) hostPausedAt = v ? Date.now() : 0;
    hostPaused = !!v;
    $('pause-btn').textContent = hostPaused ? '▶ Seguir' : '⏸ Pausa';
    if (window.DralyParty) DralyParty.pauseCard(hostPaused, { mode: 'host' });
    if (hostPaused) stopMusic(); else if (!$('screen-active').classList.contains('hidden')) playMusic('music-battle', 0.32);
  }
  $('pause-btn').addEventListener('click', () => socket.emit('host:pause', { pin, paused: !hostPaused }));
  socket.on('kd:pause', (d) => { if (d && !d.paused && state) state.endsAt = Date.now() + (d.endsMs || 0); showHostPaused(d && d.paused); });
  socket.on('kd:init', (d) => { if (d && !!d.paused !== hostPaused) showHostPaused(d.paused); });
  function partyEnd(d) {
    if (hostPaused) showHostPaused(false);
    if (!window.DralyParty || !d || !d.fin) return false;
    DralyParty.clearChip();
    if ($('timer-display')) $('timer-display').classList.remove('pf-frenzy');
    if (ceremony) ceremony.stop();      // (the frozen board stays under the show: never the old end screen, it would spoil the result)
    ceremony = new DralyParty.Ceremony({
      mode: 'host', game: 'kingdoms', data: d, mount: document.body, play: playUrl,
      onSkip: () => socket.emit('host:fin-skip', { pin }),
      onAgain: () => { ceremony = null; $('play-again-btn').click(); },
      onHome: () => { location.href = '/'; },
    });
    return true;
  }
  socket.on('state', (s) => { if (s && s.state === 'lobby' && ceremony) { ceremony.stop(); ceremony = null; } });

  // ---------- end ----------
  socket.on('game-end', (d) => {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    stopMusic();
    hideDralingo();
    $('lm-moment').className = 'kd-lm-moment hidden';
    lmQueue.length = 0;
    lmBusy = false;                    // the gang finale must not wait for a cut-off landmark moment
    if (partyEnd(d)) return;           // the Mario Party ceremony (the old end screen below stays as a fallback)
    showScreen('win');
    const r = d.teamScores.red || 0;
    const g = d.teamScores.gold || 0;
    $('final-red').textContent = r;
    $('final-gold').textContent = g;
    ['red', 'gold'].forEach((team) => {
      fillLms($('final-lms-' + team), heldLms(team));
      const mvp = team === 'red' ? d.mvpRed : d.mvpGold;
      $('mvp-' + team).textContent = mvp && mvp.score > 0 ? `👑 ${mvp.name} · ${mvp.score}` : '';
    });
    const win = $('win-banner');
    const cap = $('win-cap');
    if (d.winner === 'red' || d.winner === 'gold') {
      $('win-pose').src = POSE('champion', d.winner);
      const capId = captains && captains[d.winner];
      cap.classList.toggle('hidden', !(capId && Cast));
      if (capId && Cast) { cap.src = Cast.pose(capId, 'cheer'); cap.alt = Cast.captain(capId); }
      win.textContent = `¡El ${NAMES[d.winner]} conquista Dubái!`;
      win.className = 'kd-winner ' + d.winner;
      const gap = Math.abs(r - g);
      const lms = heldLms(d.winner).length;
      const lmText = lms ? ` · ${lms === 1 ? '1 monumento' : lms + ' monumentos'} 🏙️` : '';
      $('win-why').textContent = (gap <= 3 ? `¡Por solo ${gap === 1 ? '1 punto' : gap + ' puntos'}!` : `${Math.max(r, g)} puntos contra ${Math.min(r, g)}`) + lmText;
      sfx('win', 0.9);
      confetti(d.winner);
      // the gang celebrates with the winning captain and a Dralingo in the winner's colour; no stamp over the headline
      const loser = d.winner === 'red' ? 'gold' : 'red';
      setTimeout(() => bigFx('gang', {
        text: `¡${NAMES[d.winner]}!`, mood: 'win', stamp: false, team: d.winner,
        chars: capId ? [capId] : [], exclude: captains ? [captains[loser]] : [],
      }, 0), 700);
    } else {
      $('win-pose').src = POSE('jump');
      cap.classList.add('hidden');
      win.textContent = '¡Empate de reinos!';
      win.className = 'kd-winner';
      $('win-why').textContent = `Los dos reinos terminaron con ${r} puntos`;
      sfx('win', 0.6);
    }
    const lb = $('leaderboard');
    lb.innerHTML = '';
    (d.leaderboard || []).slice(0, 6).forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'kd-lb-row';
      const rank = document.createElement('span');
      rank.textContent = ['🥇', '🥈', '🥉'][i] || '#' + (i + 1);
      const name = document.createElement('span');
      const dot = document.createElement('i');
      dot.className = 'kd-dot ' + p.team;
      name.append(dot, document.createTextNode((p.avatar ? p.avatar + ' ' : '') + p.name));
      const sc = document.createElement('span');
      sc.textContent = p.score === 1 ? '1 punto' : `${p.score} puntos`;
      row.append(rank, name, sc);
      lb.appendChild(row);
    });
  });

  // ---------- fx ----------
  let bannerTimer = null;
  function banner(text, team) {
    document.querySelectorAll('.kd-banner').forEach((b) => b.remove());
    const b = document.createElement('div');
    b.className = 'kd-banner' + (team ? ' ' + team : '');
    b.textContent = text;
    document.body.appendChild(b);
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.remove(), 3100);
  }
  let sayTimer = null;
  let lastSay = 0;
  function say(text, pose, team) {
    const now = Date.now();
    if (now - lastSay < 2500) return;      // one line at a time, never a wall of chatter
    lastSay = now;
    $('dralingo-say').textContent = text;
    $('dralingo-img').src = POSE(pose || 'pointing', team);
    $('dralingo').classList.add('show');
    clearTimeout(sayTimer);
    sayTimer = setTimeout(hideDralingo, 4200);
  }
  function hideDralingo() { $('dralingo').classList.remove('show'); }
  function confetti(team, count) {
    const colors = team === 'red' ? ['#f0443a', '#ffc93c', '#fff7e3'] : ['#2f7bea', '#ffc93c', '#fff7e3'];
    for (let i = 0; i < (count || 90); i++) {
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
  }
})();
