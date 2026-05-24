// Lái-Qù-Huí · Dragon Courier — host view.
// Players are on their phones doing the actual game; the host page shows
// team scores + a small live mini-map with team-colored dots representing
// player positions. Minimal by design — kids never look at this screen.
(function () {
  const socket = io();
  let pin = null;
  let state = null;
  let timerInterval = null;
  let urgentTriggered = false;

  let gridW = 8, gridH = 8;
  let locations = [];
  let playersByPid = {};   // pid -> { name, team, avatar, x, y, score }
  let scores = { red: 0, gold: 0 };
  let gameOver = false;

  const $ = (id) => document.getElementById(id);

  $('mute-btn').addEventListener('click', () => {
    const muted = window.toggleMute();
    $('mute-btn').textContent = muted ? '🔇 Off' : '🔊 On';
  });
  document.addEventListener('click', () => window.unlockAudio && window.unlockAudio(), { once: true });
  window.addEventListener('music-started', (e) => {
    const chip = $('music-chip');
    const name = $('music-chip-name');
    if (!chip) return;
    if (name) name.textContent = 'Lái-Qù-Huí · ' + (e.detail.bpm || '') + 'bpm';
    chip.classList.remove('hidden');
    setTimeout(() => chip.classList.add('hidden'), 3500);
  });

  socket.emit('host:create', { gameType: 'laiquhui' }, ({ pin: p }) => {
    pin = p;
    $('pin-display').textContent = p;
    if ($('active-pin-display')) $('active-pin-display').textContent = p;
    $('join-url').textContent = `${location.origin}/?pin=${p}`;
    document.title = `🐉 来去回 · ${p}`;
    // No set needed — laiquhui generates missions server-side
    MochiSounds.correct && MochiSounds.correct();
    // Simulated "set loaded" so the start button enables once there's a player
    setTimeout(updateStartBtn, 100);
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
    MochiSounds.swap && MochiSounds.swap();
  });
  $('start-btn').addEventListener('click', () => socket.emit('host:start', { pin }));
  $('end-now-btn').addEventListener('click', () => {
    if (confirm('¿Terminar la ronda ahora?')) socket.emit('host:end-now', { pin });
  });
  $('play-again-btn').addEventListener('click', () => {
    if (MochiSounds.stopEndMusic) MochiSounds.stopEndMusic();
    socket.emit('host:reset', { pin });
    showScreen('lobby');
    playersByPid = {};
    scores = { red: 0, gold: 0 };
    gameOver = false;
    updateScoreboard();
  });

  function updateStartBtn() {
    const btn = $('start-btn');
    if (!state) { btn.disabled = true; return; }
    // No question set needed; just require at least one player
    btn.disabled = !(Object.keys(state.players || {}).length > 0);
  }

  socket.on('state', (s) => {
    state = s;
    if (s.state === 'lobby') {
      renderLobbyPlayers(s.players);
      updateStartBtn();
    }
    if (s.state === 'active' && s.endsAt && !timerInterval) startTimer();
  });

  socket.on('countdown', () => {
    showScreen('countdown');
    if (window.unlockAudio) window.unlockAudio();
    MochiSounds.startGameTheme && MochiSounds.startGameTheme('laiquhui');
    let n = 3;
    const numEl = $('countdown-num');
    const tick = () => {
      if (n > 0) {
        numEl.textContent = n;
        numEl.style.animation = 'none';
        numEl.offsetHeight;
        numEl.style.animation = '';
        MochiSounds.countdownNum && MochiSounds.countdownNum();
        n--;
        setTimeout(tick, 900);
      } else {
        numEl.textContent = '¡A REPARTIR!';
        numEl.style.animation = 'none';
        numEl.offsetHeight;
        numEl.style.animation = '';
        MochiSounds.go && MochiSounds.go();
        setTimeout(() => {
          showScreen('active');
          startTimer();
        }, 800);
      }
    };
    tick();
  });

  // === MAP INIT ===
  socket.on('lqh:init', (data) => {
    gridW = data.gridW;
    gridH = data.gridH;
    locations = data.locations || [];
    playersByPid = {};
    Object.entries(data.players || {}).forEach(([pid, p]) => {
      playersByPid[pid] = { ...p, score: 0 };
    });
    scores = data.teamScores || { red: 0, gold: 0 };
    renderMiniMap();
    redrawRosters();
    updateScoreboard();
  });

  socket.on('lqh:player-move', (data) => {
    if (!playersByPid[data.playerId]) {
      playersByPid[data.playerId] = { x: data.x, y: data.y, name: data.name, team: data.team, score: 0 };
    } else {
      playersByPid[data.playerId].x = data.x;
      playersByPid[data.playerId].y = data.y;
    }
    if (data.teamScores) {
      scores = data.teamScores;
      updateScoreboard();
    }
    renderMiniMap();
  });

  socket.on('game-end', (data) => {
    if (timerInterval) clearInterval(timerInterval);
    gameOver = true;
    MochiSounds.stopMusic && MochiSounds.stopMusic();
    showScreen('win');
    const r = data.teamScores.red || 0;
    const g = data.teamScores.gold || 0;
    $('final-red').textContent = r;
    $('final-gold').textContent = g;
    const narr = $('win-narration');
    if (data.winner === 'red') {
      $('win-banner').textContent = '🐲 ¡Los Mensajeros Rojos ganaron!';
      $('win-banner').className = 'winner-banner red';
      $('win-emoji').textContent = '🐲';
      MochiSounds.winMusic && MochiSounds.winMusic();
      setTimeout(() => MochiSounds.winFanfare && MochiSounds.winFanfare(), 400);
      if (narr) narr.innerHTML = `🐲 Los <span class="red-team">Mensajeros Rojos</span> entregaron más cartas. <strong>${r}</strong> pts.`;
      launchConfetti(['#ff5a66', '#d92e3a', '#ffd57a']);
    } else if (data.winner === 'gold') {
      $('win-banner').textContent = '🐉 ¡Los Mensajeros Dorados ganaron!';
      $('win-banner').className = 'winner-banner gold';
      $('win-emoji').textContent = '🐉';
      MochiSounds.winMusic && MochiSounds.winMusic();
      setTimeout(() => MochiSounds.winFanfare && MochiSounds.winFanfare(), 400);
      if (narr) narr.innerHTML = `🐉 Los <span class="gold-team">Mensajeros Dorados</span> entregaron más cartas. <strong>${g}</strong> pts.`;
      launchConfetti(['#ffd57a', '#e8b14a', '#ff5a66']);
    } else {
      $('win-banner').textContent = '🐲 ¡Empate!';
      $('win-banner').className = 'winner-banner tie';
      $('win-emoji').textContent = '⚖️';
      MochiSounds.tieMusic && MochiSounds.tieMusic();
      if (narr) narr.innerHTML = `Ambos equipos repartieron <strong>${r}</strong> cartas.`;
    }
    renderLeaderboard(data);
  });

  // === MINI MAP ===
  // 8x8 CSS grid showing the labelled locations + a colored dot per player.
  function renderMiniMap() {
    const map = $('lqh-mini-map');
    if (!map) return;
    // Build grid if empty
    if (map.children.length === 0) {
      map.style.gridTemplateColumns = `repeat(${gridW}, 1fr)`;
      map.style.gridTemplateRows = `repeat(${gridH}, 1fr)`;
      for (let y = 0; y < gridH; y++) {
        for (let x = 0; x < gridW; x++) {
          const tile = document.createElement('div');
          tile.className = 'lqh-tile';
          tile.id = `lqh-tile-${x}-${y}`;
          // If a location is here, mark it
          const loc = locations.find((l) => l.x === x && l.y === y);
          if (loc) {
            tile.classList.add('location', 'loc-' + loc.id);
            tile.innerHTML = `<div class="loc-icon">${loc.icon}</div><div class="loc-label">${loc.pinyin}</div>`;
          }
          map.appendChild(tile);
        }
      }
    }
    // Clear all dots
    map.querySelectorAll('.lqh-dot').forEach((d) => d.remove());
    // Re-add dots at current positions
    Object.entries(playersByPid).forEach(([pid, p]) => {
      const tile = $('lqh-tile-' + p.x + '-' + p.y);
      if (!tile) return;
      const dot = document.createElement('div');
      dot.className = 'lqh-dot ' + p.team;
      dot.title = p.name;
      tile.appendChild(dot);
    });
  }

  function updateScoreboard() {
    if ($('score-red'))  $('score-red').textContent  = scores.red  || 0;
    if ($('score-gold')) $('score-gold').textContent = scores.gold || 0;
  }

  // === Side rosters ===
  function redrawRosters() {
    const red = $('lqh-roster-list-red');
    const gold = $('lqh-roster-list-gold');
    if (!red || !gold) return;
    red.innerHTML = '';
    gold.innerHTML = '';
    const sorted = Object.entries(playersByPid).sort((a, b) => (b[1].score || 0) - (a[1].score || 0));
    sorted.forEach(([pid, p]) => {
      const row = document.createElement('div');
      row.className = 'lqh-roster-row';
      row.innerHTML = `
        <span class="lqh-roster-avatar">${p.avatar || (p.team === 'red' ? '🐲' : '🐉')}</span>
        <span class="lqh-roster-name">${escapeHtml(p.name)}</span>
        <span class="lqh-roster-score">${p.score || 0}</span>
      `;
      (p.team === 'red' ? red : gold).appendChild(row);
    });
    [red, gold].forEach((el) => {
      const n = el.children.length;
      el.dataset.density = n > 16 ? 'xs' : n > 10 ? 'sm' : 'md';
    });
  }

  function startTimer() {
    if (!state || !state.endsAt) { setTimeout(startTimer, 200); return; }
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
      const teamEmoji = p.team === 'red' ? '🐲' : '🐉';
      row.innerHTML = `
        <span class="lb-rank">${medal}</span>
        <span class="lb-name">${p.avatar ? p.avatar + ' ' : ''}${teamEmoji} ${escapeHtml(p.name)}</span>
        <span class="lb-score">${p.score} pts</span>
      `;
      lb.appendChild(row);
    });
  }

  function renderLobbyPlayers(playersMap) {
    const red = $('players-red');
    const gold = $('players-gold');
    if (!red || !gold) return;
    red.innerHTML = '';
    gold.innerHTML = '';
    Object.entries(playersMap || {}).forEach(([id, p]) => {
      const chip = document.createElement('div');
      chip.className = 'player-chip';
      chip.innerHTML = `${p.avatar ? `<span class="chip-avatar">${p.avatar}</span>` : ''}<span>${escapeHtml(p.name)}</span><span class="swap-arrow">↔</span>`;
      chip.addEventListener('click', () => {
        socket.emit('host:swap-team', { pin, playerId: id });
        MochiSounds.swap && MochiSounds.swap();
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
      c.textContent = ['🐲', '🐉', '🏠', '🏫', '🏥', '✨'][i % 6];
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
