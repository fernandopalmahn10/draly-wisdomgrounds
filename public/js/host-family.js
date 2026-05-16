// Mi Familia (我的家庭) — host view.
// Two team houses side by side with 4 rooms each (Sala / Cocina / Dormitorio
// / Jardín). Each correct answer awards a player a random furniture/family
// token; they tap a room on their phone to place it. The host renders each
// placement in real time.
(function () {
  const socket = io();
  let pin = null;
  let state = null;
  let timerInterval = null;
  let urgentTriggered = false;

  let scores = { red: 0, gold: 0 };
  let gameOver = false;

  const $ = (id) => document.getElementById(id);

  $('mute-btn').addEventListener('click', () => {
    const muted = window.toggleMute();
    $('mute-btn').textContent = muted ? '🔇 Off' : '🔊 On';
  });
  document.addEventListener('click', () => window.unlockAudio && window.unlockAudio(), { once: true });

  const params = new URLSearchParams(location.search);
  const chosenSetId = params.get('setId');
  if (!chosenSetId) location.href = '/sets.html?game=family';

  socket.emit('host:create', { gameType: 'family' }, ({ pin: p }) => {
    pin = p;
    $('pin-display').textContent = p;
    if ($('active-pin-display')) $('active-pin-display').textContent = p;
    $('join-url').textContent = `${location.origin}/?pin=${p}`;
    document.title = `Mi Familia · ${p}`;
    socket.emit('host:load-set', { pin, setId: chosenSetId }, (resp) => {
      if (!resp.ok) {
        alert('No se pudo cargar el set: ' + (resp.error || 'desconocido'));
        location.href = '/sets.html?game=family';
        return;
      }
      $('set-title-display').textContent = resp.title;
      $('set-count-display').textContent = `${resp.count} preguntas`;
      MochiSounds.correct();
      updateStartBtn();
    });
  });

  $('duration-slider').addEventListener('input', (e) => {
    const v = +e.target.value;
    $('duration-value').textContent = v >= 60 ? `${Math.floor(v / 60)}m${v % 60 ? ' ' + (v % 60) + 's' : ''}` : `${v}s`;
  });
  $('duration-slider').addEventListener('change', (e) => {
    socket.emit('host:set-duration', { pin, duration: +e.target.value });
  });
  $('balance-btn').addEventListener('click', () => {
    socket.emit('host:auto-balance', { pin });
    MochiSounds.swap();
  });
  $('start-btn').addEventListener('click', () => socket.emit('host:start', { pin }));
  $('end-now-btn').addEventListener('click', () => {
    if (confirm('¿Terminar la ronda ahora?')) socket.emit('host:end-now', { pin });
  });
  $('play-again-btn').addEventListener('click', () => {
    if (MochiSounds.stopEndMusic) MochiSounds.stopEndMusic();
    socket.emit('host:reset', { pin });
    showScreen('lobby');
    scores = { red: 0, gold: 0 };
    gameOver = false;
    clearHouses();
  });

  function updateStartBtn() {
    const btn = $('start-btn');
    if (!state) return;
    btn.disabled = !(state.questionsLoaded > 0 && Object.keys(state.players || {}).length > 0);
  }

  socket.on('state', (s) => {
    state = s;
    if (s.state === 'lobby') {
      renderLobbyPlayers(s.players);
      updateStartBtn();
    }
  });

  socket.on('countdown', () => {
    showScreen('countdown');
    MochiSounds.startMusic();
    let n = 3;
    const numEl = $('countdown-num');
    const tick = () => {
      if (n > 0) {
        numEl.textContent = n;
        numEl.style.animation = 'none';
        numEl.offsetHeight;
        numEl.style.animation = '';
        MochiSounds.countdownNum();
        n--;
        setTimeout(tick, 900);
      } else {
        numEl.textContent = '¡家!';
        numEl.style.animation = 'none';
        numEl.offsetHeight;
        numEl.style.animation = '';
        MochiSounds.go();
        setTimeout(() => {
          showScreen('active');
          startTimer();
        }, 800);
      }
    };
    tick();
  });

  socket.on('fm:init', (data) => {
    scores = data.teamScores || { red: 0, gold: 0 };
    gameOver = false;
    clearHouses();
    updateScores();
  });

  // A player placed a token into a room
  socket.on('fm:placed', ({ team, room, token, teamScores }) => {
    if (teamScores) { scores = teamScores; updateScores(); }
    const slot = $(`fm-${team}-${room}`);
    if (!slot) return;
    const item = document.createElement('span');
    item.className = 'fm-item';
    item.textContent = token.emoji;
    item.title = token.name;
    slot.appendChild(item);
    // Small chime on placement — generic, no individual name mentioned
    MochiSounds.populate && MochiSounds.populate(team);
  });

  socket.on('game-end', (data) => {
    if (timerInterval) clearInterval(timerInterval);
    MochiSounds.stopMusic();
    showScreen('win');
    $('final-red').textContent = data.teamScores.red || 0;
    $('final-gold').textContent = data.teamScores.gold || 0;
    const narr = $('win-narration');
    if (data.winner === 'red') {
      $('win-banner').textContent = '🏡 ¡Familia Roja construyó la mejor casa!';
      $('win-banner').className = 'winner-banner red';
      $('win-emoji').textContent = '🏡';
      MochiSounds.winMusic && MochiSounds.winMusic();
      setTimeout(() => MochiSounds.winFanfare && MochiSounds.winFanfare(), 400);
      if (narr) narr.innerHTML = `🏡 La <span class="red-team">Familia Roja</span> decoró su casa con <strong>${data.teamScores.red}</strong> objetos.`;
      launchConfetti(['#ff5a66', '#d92e3a', '#ffd57a']);
    } else if (data.winner === 'gold') {
      $('win-banner').textContent = '🏠 ¡Familia Dorada construyó la mejor casa!';
      $('win-banner').className = 'winner-banner gold';
      $('win-emoji').textContent = '🏠';
      MochiSounds.winMusic && MochiSounds.winMusic();
      setTimeout(() => MochiSounds.winFanfare && MochiSounds.winFanfare(), 400);
      if (narr) narr.innerHTML = `🏠 La <span class="gold-team">Familia Dorada</span> decoró su casa con <strong>${data.teamScores.gold}</strong> objetos.`;
      launchConfetti(['#ffd57a', '#e8b14a', '#ff5a66']);
    } else {
      $('win-banner').textContent = '🤝 ¡Empate familiar!';
      $('win-banner').className = 'winner-banner tie';
      $('win-emoji').textContent = '⚖️';
      MochiSounds.tieMusic && MochiSounds.tieMusic();
      if (narr) narr.innerHTML = `🤝 Ambas familias decoraron con <strong>${data.teamScores.red}</strong> objetos.`;
    }
    renderLeaderboard(data);
  });

  function updateScores() {
    $('score-red').textContent = scores.red || 0;
    $('score-gold').textContent = scores.gold || 0;
  }
  function clearHouses() {
    ['red','gold'].forEach((team) => {
      ['sala','cocina','dormitorio','jardin'].forEach((room) => {
        const el = $(`fm-${team}-${room}`);
        if (el) el.innerHTML = '';
      });
    });
  }
  function startTimer() {
    if (!state || !state.endsAt) return;
    urgentTriggered = false;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      const remaining = Math.max(0, state.endsAt - Date.now());
      const sec = Math.ceil(remaining / 1000);
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      $('timer-display').textContent = m > 0 ? `${m}:${String(s).padStart(2, '0')}` : sec;
      if (sec <= 10 && !urgentTriggered) {
        urgentTriggered = true;
        $('timer-display').classList.add('urgent');
        MochiSounds.urgent && MochiSounds.urgent();
      }
      if (remaining <= 0) clearInterval(timerInterval);
    }, 100);
  }
  function renderLeaderboard(data) {
    const lb = $('leaderboard');
    if (!lb) return;
    lb.innerHTML = '';
    const rows = (data.leaderboard || []).slice(0, 12);
    rows.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = `lb-row ${p.team}`;
      const medal = ['🥇', '🥈', '🥉'][i] || `#${i + 1}`;
      const teamEmoji = p.team === 'red' ? '🏡' : '🏠';
      row.innerHTML = `
        <span class="lb-rank">${medal}</span>
        <span class="lb-name">${p.avatar ? p.avatar + " " : ""}${teamEmoji} ${escapeHtml(p.name)}</span>
        <span class="lb-score">${p.score} objetos</span>
      `;
      lb.appendChild(row);
    });
  }
  function renderLobbyPlayers(playersMap) {
    const red = $('players-red');
    const gold = $('players-gold');
    red.innerHTML = '';
    gold.innerHTML = '';
    Object.entries(playersMap || {}).forEach(([id, p]) => {
      const chip = document.createElement('div');
      chip.className = 'player-chip';
      chip.innerHTML = `${p.avatar ? `<span class="chip-avatar">${p.avatar}</span>` : ""}<span>${escapeHtml(p.name)}</span><span class="swap-arrow">↔</span>`;
      chip.addEventListener('click', () => {
        socket.emit('host:swap-team', { pin, playerId: id });
        MochiSounds.swap();
      });
      (p.team === 'red' ? red : gold).appendChild(chip);
    });
  }
  function launchConfetti(colors) {
    for (let i = 0; i < 80; i++) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + '%';
      c.style.animationDelay = Math.random() * 1.5 + 's';
      c.style.animationDuration = 2 + Math.random() * 2 + 's';
      c.textContent = ['🏡', '🏠', '🪴', '🛋', '✨'][i % 5];
      c.style.fontSize = (1 + Math.random() * 1) + 'rem';
      c.style.background = 'transparent';
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 5000);
    }
  }
  function showScreen(name) {
    ['lobby', 'countdown', 'active', 'win'].forEach((n) => {
      const el = $('screen-' + n);
      if (el) el.classList.toggle('hidden', n !== name);
    });
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
})();
