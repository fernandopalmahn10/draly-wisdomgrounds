(function () {
  const socket = io();
  let pin = null;
  let state = null;
  let timerInterval = null;
  let urgentTriggered = false;
  let gridW = 30;
  let gridH = 18;
  let cellSize = 24;

  const $ = (id) => document.getElementById(id);

  $('mute-btn').addEventListener('click', () => {
    const muted = window.toggleMute();
    $('mute-btn').textContent = muted ? '🔇 Off' : '🔊 On';
  });
  document.addEventListener('click', () => window.unlockAudio && window.unlockAudio(), { once: true });

  const params = new URLSearchParams(location.search);
  const chosenSetId = params.get('setId');
  if (!chosenSetId) location.href = '/sets.html?game=color-clash';

  socket.emit('host:create', { gameType: 'color-clash' }, ({ pin: p }) => {
    pin = p;
    $('pin-display').textContent = p;
    if ($('active-pin-display')) $('active-pin-display').textContent = p;
    $('join-url').textContent = `${location.origin}/?pin=${p}`;
    document.title = `Market Clash · ${p}`;
    socket.emit('host:load-set', { pin, setId: chosenSetId }, (resp) => {
      if (!resp.ok) {
        alert('Could not load set: ' + (resp.error || 'unknown'));
        location.href = '/sets.html?game=color-clash';
        return;
      }
      $('set-title-display').textContent = resp.title;
      $('set-count-display').textContent = `${resp.count} questions`;
      MochiSounds.correct();
      updateStartBtn();
    });
  });

  socket.on('images-progress', ({ warmed, total }) => {
    const badge = $('images-progress-badge');
    const text = $('images-progress-text');
    if (!badge) return;
    badge.style.display = 'block';
    text.textContent = `${warmed}/${total}`;
    if (warmed >= total) {
      badge.style.color = 'var(--jade)';
      text.textContent = `${total}/${total} ✓`;
      setTimeout(() => { badge.style.display = 'none'; }, 4000);
    }
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
    if (confirm('End the round now?')) socket.emit('host:end-now', { pin });
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
        numEl.textContent = '開市!';
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

  socket.on('cs:init', (data) => {
    gridW = data.gridW;
    gridH = data.gridH;
    buildGrid();
    initPlayers(data.players);
    updateScores(data.teamScores);
  });

  socket.on('cs:move', ({ playerId, x, y, paint, teamScores }) => {
    movePlayer(playerId, x, y);
    if (paint) paintCell(paint.x, paint.y, paint.team);
    updateScores(teamScores);
  });

  socket.on('cs:paint', ({ cells, teamScores }) => {
    cells.forEach((c) => paintCell(c.x, c.y, c.team));
    updateScores(teamScores);
  });

  function buildGrid() {
    const grid = $('cc-grid');
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = `repeat(${gridW}, 1fr)`;
    const stage = document.querySelector('.cc-stage');
    const stageW = Math.min(stage.clientWidth - 80, 1300);
    const stageH = stage.clientHeight - 60;
    cellSize = Math.max(18, Math.min(34, Math.floor(Math.min((stageW - 40) / gridW, (stageH - 60) / gridH)) - 2));
    grid.style.maxWidth = (cellSize * gridW + (gridW - 1) * 2 + 24) + 'px';
    document.documentElement.style.setProperty('--cc-cell-size', cellSize + 'px');
    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        const cell = document.createElement('div');
        cell.className = 'cc-cell';
        cell.id = `cc-cell-${x}-${y}`;
        grid.appendChild(cell);
      }
    }
    $('cc-players').innerHTML = '';
    $('cc-players').style.width = (cellSize * gridW + (gridW - 1) * 2) + 'px';
    $('cc-players').style.height = (cellSize * gridH + (gridH - 1) * 2) + 'px';
  }

  function initPlayers(players) {
    const wrap = $('cc-players');
    wrap.innerHTML = '';
    Object.entries(players).forEach(([id, p]) => {
      const el = document.createElement('div');
      el.className = `cc-player ${p.team}`;
      el.id = `cc-player-${id}`;
      const emoji = p.team === 'red' ? '🏮' : '🥟';
      el.innerHTML = `
        <span class="cc-player-emoji">${emoji}</span>
        <span class="cc-player-name">${escapeHtml(p.name)}</span>
      `;
      positionPlayer(el, p.x, p.y);
      wrap.appendChild(el);
    });
  }

  function positionPlayer(el, x, y) {
    el.style.left = (x * (cellSize + 2)) + 'px';
    el.style.top = (y * (cellSize + 2)) + 'px';
  }

  function movePlayer(playerId, x, y) {
    const el = document.getElementById(`cc-player-${playerId}`);
    if (!el) return;
    positionPlayer(el, x, y);
  }

  function paintCell(x, y, team) {
    const cell = document.getElementById(`cc-cell-${x}-${y}`);
    if (!cell) return;
    cell.classList.remove('red', 'gold', 'fresh');
    cell.classList.add(team, 'fresh');
    setTimeout(() => cell.classList.remove('fresh'), 400);
  }

  function updateScores(teamScores) {
    const total = gridW * gridH;
    const r = teamScores.red || 0;
    const g = teamScores.gold || 0;
    const rPct = Math.round((r / total) * 100);
    const gPct = Math.round((g / total) * 100);
    $('pct-red').textContent = rPct + '%';
    $('pct-gold').textContent = gPct + '%';
    // Visual: bar widths reflect dominance
    const denom = Math.max(1, r + g);
    const rWidth = ((r / denom) * 100).toFixed(1);
    const gWidth = ((g / denom) * 100).toFixed(1);
    $('cc-bar-red').style.flexBasis = rWidth + '%';
    $('cc-bar-gold').style.flexBasis = gWidth + '%';
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
        MochiSounds.urgent();
      }
      if (remaining <= 0) clearInterval(timerInterval);
    }, 100);
  }

  socket.on('game-end', (data) => {
    if (timerInterval) clearInterval(timerInterval);
    MochiSounds.stopMusic();
    showScreen('win');
    renderLeaderboardCC(data);
    renderWinNarrationCC(data);
    const total = gridW * gridH;
    const rPct = Math.round((data.teamScores.red / total) * 100);
    const gPct = Math.round((data.teamScores.gold / total) * 100);
    $('final-red').textContent = rPct + '%';
    $('final-gold').textContent = gPct + '%';
    if (data.winner === 'red') {
      $('win-banner').textContent = '🏮 Team Lantern Wins!';
      $('win-banner').className = 'winner-banner red';
      $('win-emoji').textContent = '🏮';
      MochiSounds.winMusic();
      setTimeout(() => MochiSounds.winFanfare(), 400);
      launchConfetti(['#ff5a66', '#d92e3a', '#ffd57a']);
    } else if (data.winner === 'gold') {
      $('win-banner').textContent = '🥟 Team Dumpling Wins!';
      $('win-banner').className = 'winner-banner gold';
      $('win-emoji').textContent = '🥟';
      MochiSounds.winMusic();
      setTimeout(() => MochiSounds.winFanfare(), 400);
      launchConfetti(['#ffd57a', '#e8b14a', '#a8d4a0']);
    } else {
      $('win-banner').textContent = '🤝 Tie Market!';
      $('win-banner').className = 'winner-banner tie';
      $('win-emoji').textContent = '⚖️';
      MochiSounds.tieMusic();
    }
  });

  function renderLeaderboardCC(data) {
    const lb = $('leaderboard');
    if (!lb) return;
    lb.innerHTML = '';
    const rows = (data.leaderboard || []).slice(0, 12);
    rows.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = `lb-row ${p.team}`;
      const medal = ['🥇', '🥈', '🥉'][i] || `#${i + 1}`;
      const teamEmoji = p.team === 'red' ? '🏮' : '🥟';
      row.innerHTML = `
        <span class="lb-rank">${medal}</span>
        <span class="lb-name">${teamEmoji} ${escapeHtml(p.name)}</span>
        <span class="lb-score">${p.score} pts</span>
      `;
      lb.appendChild(row);
    });
  }
  function renderWinNarrationCC(data) {
    const narrEl = $('win-narration');
    if (!narrEl) return;
    const total = gridW * gridH;
    const rPct = Math.round((data.teamScores.red / total) * 100);
    const gPct = Math.round((data.teamScores.gold / total) * 100);
    const gap = Math.abs(rPct - gPct);
    let story = '';
    if (data.winner === 'red') {
      const margin = gap > 20 ? 'una victoria aplastante 🔥' : gap > 8 ? 'una victoria sólida 💪' : 'un duelo reñido ⚔️';
      story = `🏮 <span class="red-team">Team Lantern</span> pintó ${margin} con <strong>${rPct}%</strong> del mercado.`;
    } else if (data.winner === 'gold') {
      const margin = gap > 20 ? 'una victoria aplastante 🔥' : gap > 8 ? 'una victoria sólida 💪' : 'un duelo reñido ⚔️';
      story = `🥟 <span class="gold-team">Team Dumpling</span> pintó ${margin} con <strong>${gPct}%</strong> del mercado.`;
    } else {
      story = `🤝 <strong>¡Empate!</strong> Ambos equipos cubrieron el mismo porcentaje.`;
    }
    narrEl.innerHTML = story;
  }

  function renderLobbyPlayers(players) {
    const red = $('players-red');
    const gold = $('players-gold');
    red.innerHTML = '';
    gold.innerHTML = '';
    Object.entries(players || {}).forEach(([id, p]) => {
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
      c.textContent = ['🏮', '🥟', '✨', '🍡'][i % 4];
      c.style.fontSize = (1 + Math.random() * 1) + 'rem';
      c.style.background = 'transparent';
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 5000);
    }
  }

  socket.on('disconnect', () => console.log('[host-clash] disconnected, reconnecting...'));
  socket.on('connect', () => console.log('[host-clash] connected'));
  socket.on('host-left', () => console.warn('[host-clash] host-left'));

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
