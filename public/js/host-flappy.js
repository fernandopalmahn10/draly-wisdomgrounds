(function () {
  const socket = io();
  let pin = null;
  let state = null;
  let timerInterval = null;
  let urgentTriggered = false;

  // Track per-player live state for the leaderboard
  let livePlayers = {}; // id → { name, team, y, score, alive }

  const $ = (id) => document.getElementById(id);

  $('mute-btn').addEventListener('click', () => {
    const muted = window.toggleMute();
    $('mute-btn').textContent = muted ? '🔇 Off' : '🔊 On';
  });
  document.addEventListener('click', () => window.unlockAudio && window.unlockAudio(), { once: true });

  const params = new URLSearchParams(location.search);
  const chosenSetId = params.get('setId');
  if (!chosenSetId) location.href = '/sets.html?game=flappy';

  socket.emit('host:create', { gameType: 'flappy' }, ({ pin: p }) => {
    pin = p;
    $('pin-display').textContent = p;
    if ($('active-pin-display')) $('active-pin-display').textContent = p;
    $('join-url').textContent = `${location.origin}/?pin=${p}`;
    document.title = `Flappy Dragon · ${p}`;
    socket.emit('host:load-set', { pin, setId: chosenSetId }, (resp) => {
      if (!resp.ok) {
        alert('Could not load set: ' + (resp.error || 'unknown'));
        location.href = '/sets.html?game=flappy';
        return;
      }
      $('set-title-display').textContent = resp.title;
      $('set-count-display').textContent = `${resp.count} questions`;
      MochiSounds.correct();
      updateStartBtn();
    });
  });

  $('duration-slider').addEventListener('input', (e) => {
    const v = +e.target.value;
    $('duration-value').textContent = v >= 60
      ? `${Math.floor(v / 60)}m${v % 60 ? ' ' + (v % 60) + 's' : ''}`
      : `${v}s`;
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
    socket.emit('host:reset', { pin });
    showScreen('lobby');
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
    } else if (s.state === 'active') {
      // Keep player metadata fresh (name/team) — server includes it in state
      Object.entries(s.players || {}).forEach(([id, p]) => {
        if (!livePlayers[id]) livePlayers[id] = { score: 0, alive: true, y: 240 };
        livePlayers[id].name = p.name;
        livePlayers[id].team = p.team;
      });
    }
  });

  socket.on('fl:init', (data) => {
    Object.entries(data.players || {}).forEach(([id, p]) => {
      livePlayers[id] = {
        name: p.name, team: p.team, y: p.y, score: p.score || 0, alive: p.alive !== false
      };
    });
    updateScores(data.teamScores || { red: 0, gold: 0 });
    renderLeaderboard();
  });

  // Each player gets their own fl:tick. The host also gets one per player it's subscribed to,
  // but `io.to(pid).emit` sends only to that socket. So host doesn't get fl:tick events directly.
  // We rely on the state broadcast for periodic updates.
  // Solution: server broadcasts the team scores via fl:tick too. We listen for state-driven updates.
  socket.on('fl:scores', ({ teamScores, players }) => {
    if (teamScores) updateScores(teamScores);
    if (players) {
      Object.entries(players).forEach(([id, p]) => {
        if (!livePlayers[id]) livePlayers[id] = {};
        Object.assign(livePlayers[id], p);
      });
      renderLeaderboard();
    }
  });

  function updateScores(s) {
    $('score-red').textContent = s.red || 0;
    $('score-gold').textContent = s.gold || 0;
  }

  function renderLeaderboard() {
    const lb = $('fl-leaderboard');
    if (!lb) return;
    const sorted = Object.entries(livePlayers)
      .map(([id, p]) => ({ id, ...p }))
      .sort((a, b) => (b.score || 0) - (a.score || 0));
    lb.innerHTML = '';
    sorted.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = `fl-lb-row ${p.team} ${p.alive ? '' : 'dead'}`;
      const medal = ['🥇', '🥈', '🥉'][i] || `#${i + 1}`;
      const planeEmoji = p.team === 'red' ? '🐲' : '🦅';
      const status = p.alive ? '✈️' : '💥';
      row.innerHTML = `
        <span class="fl-lb-rank">${medal}</span>
        <span class="fl-lb-plane">${planeEmoji}</span>
        <span class="fl-lb-name">${escapeHtml(p.name || '?')}</span>
        <span class="fl-lb-status">${status}</span>
        <span class="fl-lb-score">${p.score || 0}</span>
      `;
      lb.appendChild(row);
    });
  }

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
        numEl.textContent = '¡Vuela!';
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
      if (sec <= 15 && !urgentTriggered) {
        urgentTriggered = true;
        $('timer-display').classList.add('urgent');
        MochiSounds.urgent();
      }
      if (remaining <= 0) clearInterval(timerInterval);
    }, 100);
  }

  socket.on('game-end', (data) => {
    if (timerInterval) clearInterval(timerInterval);
    MochiSounds.stopMusic();
    showScreen('win');
    $('final-red').textContent = data.teamScores.red || 0;
    $('final-gold').textContent = data.teamScores.gold || 0;
    if (data.winner === 'red') {
      $('win-banner').textContent = '🐲 ¡Equipo Rojo gana!';
      $('win-banner').className = 'winner-banner red';
      $('win-emoji').textContent = '🐲';
      MochiSounds.winMusic();
      setTimeout(() => MochiSounds.winFanfare(), 400);
      launchConfetti(['#ff5a66', '#d92e3a', '#ffd57a']);
    } else if (data.winner === 'gold') {
      $('win-banner').textContent = '🦅 ¡Equipo Dorado gana!';
      $('win-banner').className = 'winner-banner gold';
      $('win-emoji').textContent = '🦅';
      MochiSounds.winMusic();
      setTimeout(() => MochiSounds.winFanfare(), 400);
      launchConfetti(['#ffd57a', '#e8b14a', '#ff5a66']);
    } else {
      $('win-banner').textContent = '🤝 ¡Empate!';
      $('win-banner').className = 'winner-banner tie';
      $('win-emoji').textContent = '⚖️';
      MochiSounds.tieMusic();
    }
    renderWinNarration(data);
    renderFinalLeaderboard(data);
  });

  function renderWinNarration(data) {
    const narr = $('win-narration');
    if (!narr) return;
    const r = data.teamScores.red || 0;
    const g = data.teamScores.gold || 0;
    const gap = Math.abs(r - g);
    let story = '';
    if (data.winner === 'red') {
      const margin = gap > 50 ? 'una victoria aplastante 🔥' : gap > 20 ? 'una victoria sólida 💪' : 'un duelo reñido ⚔️';
      story = `🐲 <span class="red-team">Equipo Rojo</span> voló a ${margin} con <strong>${r}</strong> pts.`;
    } else if (data.winner === 'gold') {
      const margin = gap > 50 ? 'una victoria aplastante 🔥' : gap > 20 ? 'una victoria sólida 💪' : 'un duelo reñido ⚔️';
      story = `🦅 <span class="gold-team">Equipo Dorado</span> voló a ${margin} con <strong>${g}</strong> pts.`;
    } else {
      story = `🤝 <strong>¡Empate!</strong> Ambos equipos terminaron con <strong>${r}</strong> pts.`;
    }
    narr.innerHTML = story;
  }

  function renderFinalLeaderboard(data) {
    const lb = $('leaderboard');
    if (!lb) return;
    lb.innerHTML = '';
    const rows = (data.leaderboard || []).slice(0, 12);
    rows.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = `lb-row ${p.team}`;
      const medal = ['🥇', '🥈', '🥉'][i] || `#${i + 1}`;
      const teamEmoji = p.team === 'red' ? '🐲' : '🦅';
      row.innerHTML = `
        <span class="lb-rank">${medal}</span>
        <span class="lb-name">${teamEmoji} ${escapeHtml(p.name)}</span>
        <span class="lb-score">${p.score} pts</span>
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
      c.textContent = ['🐲', '🦅', '🛩', '✨', '⭐'][i % 5];
      c.style.fontSize = (1 + Math.random() * 1) + 'rem';
      c.style.background = 'transparent';
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 5000);
    }
  }

  socket.on('disconnect', () => console.log('[host-flappy] disconnected'));
  socket.on('connect', () => console.log('[host-flappy] connected'));
  socket.on('host-left', () => console.warn('[host-flappy] host-left'));

  // Periodic state poll for leaderboard updates (since fl:tick is sent per-player only)
  setInterval(() => {
    // Trigger a re-render with current state if anyone scored
    renderLeaderboard();
  }, 500);

  function showScreen(name) {
    ['lobby', 'countdown', 'active', 'win'].forEach((n) => {
      const el = $('screen-' + n);
      if (el) el.classList.toggle('hidden', n !== name);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
})();
