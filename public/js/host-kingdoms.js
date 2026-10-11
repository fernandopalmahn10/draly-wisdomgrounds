// Reinos de Colores — projector view.
// Lobby (PIN, kingdoms, duration) → countdown → live hex board fed by small kd:plant diffs → winner screen.
(function () {
  const socket = io();
  const $ = (id) => document.getElementById(id);
  const NAMES = { red: 'Reino del Fuego', gold: 'Reino del Mar' };
  const SHORT = { red: 'Fuego', gold: 'Mar' };
  const A = '/assets/kingdoms/';
  const SFX = {
    plant: A + 'plant.mp3', surround: A + 'surround.mp3', alert: A + 'castle-alert.mp3', siege: A + 'siege.mp3',
    tick: A + 'tick.mp3', whoosh: A + 'whoosh.mp3', win: A + 'sting-win.mp3', flag: A + 'flag.mp3',
  };
  const POSE = (n) => A + 'dralingo/' + n + '.webp';
  // Recorded music loops (Kenney): lobby → battle → tense final 30 s.
  let music = null;
  let musicName = null;
  function playMusic(name, vol) {
    if (musicName === name) return;
    stopMusic();
    musicName = name;
    if (muted) return;
    try { music = new Audio(A + name + '.mp3'); music.loop = true; music.volume = vol || 0.4; music.play().catch(() => {}); } catch (_) {}
  }
  function stopMusic() { if (music) { try { music.pause(); } catch (_) {} } music = null; musicName = null; }

  let pin = null;
  let state = null;
  let muted = false;
  let board = null;          // KdBoard instance
  let boardData = null;
  let own = {};
  let players = {};          // id → { name, team, score }
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
  if (!setId) { location.href = '/packs.html?game=kingdoms'; return; }

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
        location.href = '/packs.html?game=kingdoms';
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
    socket.emit('host:reset', { pin });
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

  // ---------- countdown ----------
  socket.on('countdown', () => {
    showScreen('countdown');
    stopMusic();
    let n = 3;
    const num = $('countdown-num');
    const tick = () => {
      num.style.animation = 'none'; void num.offsetWidth; num.style.animation = '';
      if (n > 0) { num.textContent = n; sfx('tick', 0.9); n--; setTimeout(tick, 900); }
      else { num.textContent = '¡A conquistar!'; num.style.fontSize = '7rem'; sfx('whoosh', 0.9); setTimeout(() => { num.style.fontSize = ''; showScreen('active'); startTimer(); playMusic('music-battle', 0.32); }, 900); }
    };
    tick();
  });

  // ---------- board ----------
  socket.on('kd:init', (d) => {
    boardData = d.board;
    own = Object.assign({}, d.own);
    Object.entries(d.players || {}).forEach(([id, p]) => { players[id] = Object.assign(players[id] || {}, p); });
    board = KdBoard.create($('board'), boardData, own, { grass: '/assets/kingdoms/grass.png', castle: '/assets/kingdoms/castle.png' });
    updateScores(d.teamScores);
    renderRosters();
    say('¡Que empiece la conquista! Respondan bien para ganar banderas 🚩', 'flag');
  });

  socket.on('kd:plant', (d) => {
    if (!board) return;
    if (players[d.playerId]) players[d.playerId].score = typeof d.playerScore === 'number' ? d.playerScore : (players[d.playerId].score || 0) + 1;
    if (d.tile !== null && d.tile !== undefined) {
      own[d.tile] = d.team;
      board.set(d.tile, d.team, 'pop');
      board.tag(d.tile, d.by, d.team);
      sfx('plant', 0.5);
    }
    (d.flipped || []).forEach((f, i) => {
      own[f.id] = d.team;
      setTimeout(() => board.set(f.id, d.team, 'flip'), 120 + i * 45);
    });
    const nf = (d.flipped || []).length;
    if (nf >= 1) {
      sfx('surround', 0.7);
      banner(`¡${d.by} rodeó ${nf === 1 ? '1 casilla' : nf + ' casillas'}! 🔁`, d.team);
      if (nf >= 3) say(`¡Increíble, ${d.by}! El ${NAMES[d.team]} encerró ${nf} casillas de golpe.`, 'jump');
    }
    (d.events || []).forEach((ev) => {
      if (ev.type === 'castle-alert') {
        sfx('alert', 0.7);
        banner(`🏰 ¡El castillo del ${SHORT[ev.team]} está casi rodeado!`, ev.team === 'red' ? 'gold' : 'red');
        say(`¡Cuidado, ${NAMES[ev.team]}! Defiendan su castillo.`, 'shocked');
      } else if (ev.type === 'siege') {
        sfx('siege', 0.8);
        banner(`⚔️ ¡Asedio! ${NAMES[ev.by]} +${ev.bonus} casillas`, ev.by);
        say(`¡Asedio total! El ${NAMES[ev.by]} rodeó el castillo enemigo.`, 'champion');
        bigBurst(ev.by);
      } else if (ev.type === 'lead' && ev.team) {
        say(`¡El ${NAMES[ev.team]} pasa al frente!`, 'pointing');
      }
    });
    updateScores(d.teamScores);
    renderRosters();
  });

  function updateScores(ts) {
    if (!ts) return;
    const total = boardData ? boardData.tiles.length : 91;
    const r = ts.red || 0;
    const g = ts.gold || 0;
    $('tug-red').style.flexBasis = Math.max(6, (r / total) * 100) + '%';
    $('tug-gold').style.flexBasis = Math.max(6, (g / total) * 100) + '%';
    $('tug-red').textContent = r;
    $('tug-gold').textContent = g;
    $('tiles-red').textContent = r;
    $('tiles-gold').textContent = g;
  }

  function renderRosters() {
    ['red', 'gold'].forEach((team) => {
      const ul = $('roster-' + team);
      const list = Object.values(players).filter((p) => p.team === team).sort((a, b) => (b.score || 0) - (a.score || 0));
      ul.innerHTML = '';
      list.slice(0, 9).forEach((p, i) => {
        const li = document.createElement('li');
        if (i === 0 && (p.score || 0) > 0) li.className = 'king';
        const name = document.createElement('span');
        name.textContent = (i === 0 && (p.score || 0) > 0 ? '👑 ' : '') + p.name;
        const sc = document.createElement('span');
        sc.textContent = p.score || 0;
        li.append(name, sc);
        ul.appendChild(li);
      });
      if (list.length > 9) {
        const li = document.createElement('li');
        li.textContent = `+${list.length - 9} más`;
        ul.appendChild(li);
      }
    });
  }

  // ---------- timer ----------
  function startTimer() {
    warned = {};
    $('timer-display').classList.remove('urgent');
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!state || !state.endsAt) return;
      const left = Math.max(0, state.endsAt - Date.now());
      const sec = Math.ceil(left / 1000);
      $('timer-display').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      if (sec === 60 && !warned[60]) { warned[60] = 1; banner('⏱ ¡Queda 1 minuto!'); }
      if (sec === 30 && !warned[30]) { warned[30] = 1; banner('⏱ ¡Quedan 30 segundos!'); say('¡Últimos 30 segundos! Rodeen todo lo que puedan.', 'countdown'); playMusic('music-final', 0.42); }
      if (sec <= 10 && sec > 0 && !warned['t' + sec]) { warned['t' + sec] = 1; sfx('tick', 0.5); $('timer-display').classList.add('urgent'); }
      if (sec > 10) $('timer-display').classList.remove('urgent');
    }, 250);
  }

  // ---------- end ----------
  socket.on('game-end', (d) => {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    stopMusic();
    hideDralingo();
    showScreen('win');
    const r = d.teamScores.red || 0;
    const g = d.teamScores.gold || 0;
    $('final-red').textContent = r;
    $('final-gold').textContent = g;
    const win = $('win-banner');
    if (d.winner === 'red' || d.winner === 'gold') {
      win.textContent = `¡Gana el ${NAMES[d.winner]}!`;
      win.className = 'kd-winner ' + d.winner;
      const gap = Math.abs(r - g);
      $('win-why').textContent = gap <= 3 ? `El imperio más grande, por solo ${gap === 1 ? '1 casilla' : gap + ' casillas'}` : `El imperio más grande del mapa: ${Math.max(r, g)} casillas`;
      sfx('win', 0.9);
      confetti(d.winner);
    } else {
      win.textContent = '¡Empate de reinos!';
      win.className = 'kd-winner';
      $('win-why').textContent = `Los dos reinos terminaron con ${r} casillas`;
      sfx('win', 0.6);
    }
    const lb = $('leaderboard');
    lb.innerHTML = '';
    (d.leaderboard || []).slice(0, 10).forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'kd-lb-row';
      const rank = document.createElement('span');
      rank.textContent = ['🥇', '🥈', '🥉'][i] || '#' + (i + 1);
      const name = document.createElement('span');
      const dot = document.createElement('i');
      dot.className = 'kd-dot ' + p.team;
      name.append(dot, document.createTextNode((p.avatar ? p.avatar + ' ' : '') + p.name));
      const sc = document.createElement('span');
      sc.textContent = `${p.score} casillas`;
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
  function say(text, pose) {
    const now = Date.now();
    if (now - lastSay < 2500) return;      // one line at a time, never a wall of chatter
    lastSay = now;
    $('dralingo-say').textContent = text;
    $('dralingo-img').src = POSE(pose || 'pointing');
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
  function bigBurst(team) { confetti(team, 40); }

  function showScreen(name) {
    ['lobby', 'countdown', 'active', 'win'].forEach((n) => $('screen-' + n).classList.toggle('hidden', n !== name));
  }
})();
