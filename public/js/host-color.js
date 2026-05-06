(function () {
  const socket = io();
  let pin = null;
  let state = null;
  let timerInterval = null;
  let urgentTriggered = false;
  let gridW = 24;
  let gridH = 14;
  let cellSize = 28;

  const $ = (id) => document.getElementById(id);

  $('mute-btn').addEventListener('click', () => {
    const muted = window.toggleMute();
    $('mute-btn').textContent = muted ? '🔇 Off' : '🔊 On';
  });
  document.addEventListener('click', () => window.unlockAudio && window.unlockAudio(), { once: true });

  const params = new URLSearchParams(location.search);
  const chosenSetId = params.get('setId');
  if (!chosenSetId) location.href = '/sets.html';

  socket.emit('host:create', { gameType: 'color-splash' }, ({ pin: p }) => {
    pin = p;
    $('pin-display').textContent = p;
    if ($('active-pin-display')) $('active-pin-display').textContent = p;
    $('join-url').textContent = `${location.origin}/?pin=${p}`;
    document.title = `Color Splash · ${p}`;
    socket.emit('host:load-set', { pin, setId: chosenSetId }, (resp) => {
      if (!resp.ok) {
        alert('Could not load set: ' + (resp.error || 'unknown'));
        location.href = '/sets.html';
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
    $('duration-value').textContent = v >= 60 ? `${Math.floor(v / 60)}m ${v % 60 ? (v % 60) + 's' : ''}`.trim() : `${v}s`;
  });
  $('duration-slider').addEventListener('change', (e) => {
    socket.emit('host:set-duration', { pin, duration: +e.target.value });
  });

  $('balance-btn').addEventListener('click', () => {
    socket.emit('host:auto-balance', { pin });
    MochiSounds.swap();
  });
  $('start-btn').addEventListener('click', () => {
    socket.emit('host:start', { pin });
  });
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
    const hasQs = state.questionsLoaded > 0;
    const hasPlayers = Object.keys(state.players || {}).length > 0;
    btn.disabled = !(hasQs && hasPlayers);
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
    // Dralingo only appears on player phones (host's big screen stays focused)
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
        numEl.textContent = 'GO!';
        numEl.style.animation = 'none';
        numEl.offsetHeight;
        numEl.style.animation = '';
        MochiSounds.go();
        setTimeout(() => {
          showScreen('active');
          startTimer();
        }, 700);
      }
    };
    tick();
  });

  socket.on('cs:init', (data) => {
    gridW = data.gridW;
    gridH = data.gridH;
    buildGrid(gridW, gridH);
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

  function buildGrid(w, h) {
    const grid = $('cs-grid');
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = `repeat(${w}, 1fr)`;
    // Compute cell size based on stage
    const stage = document.querySelector('.cs-stage');
    const stageW = Math.min(stage.clientWidth - 60, 1100);
    cellSize = Math.max(20, Math.min(40, Math.floor((stageW - 24) / w) - 3));
    grid.style.maxWidth = (cellSize * w + (w - 1) * 3 + 24) + 'px';
    document.documentElement.style.setProperty('--cell-size', cellSize + 'px');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const cell = document.createElement('div');
        cell.className = 'cs-cell';
        cell.id = `cell-${x}-${y}`;
        grid.appendChild(cell);
      }
    }
    $('cs-players').innerHTML = '';
    $('cs-players').style.width = (cellSize * w + (w - 1) * 3) + 'px';
    $('cs-players').style.height = (cellSize * h + (h - 1) * 3) + 'px';
  }

  function initPlayers(players) {
    const wrap = $('cs-players');
    wrap.innerHTML = '';
    Object.entries(players).forEach(([id, p]) => {
      const el = document.createElement('div');
      el.className = `cs-player ${p.team}`;
      el.id = `player-${id}`;
      const emoji = p.team === 'red' ? '🎨' : '🖌️';
      el.innerHTML = `
        <span class="cs-player-emoji">${emoji}</span>
        <span class="cs-player-name">${escapeHtml(p.name)}</span>
      `;
      positionPlayer(el, p.x, p.y);
      wrap.appendChild(el);
    });
  }

  function positionPlayer(el, x, y) {
    const px = x * (cellSize + 3);
    const py = y * (cellSize + 3);
    el.style.left = px + 'px';
    el.style.top = py + 'px';
  }

  function movePlayer(playerId, x, y) {
    const el = document.getElementById(`player-${playerId}`);
    if (!el) return;
    positionPlayer(el, x, y);
  }

  function paintCell(x, y, team) {
    const cell = document.getElementById(`cell-${x}-${y}`);
    if (!cell) return;
    cell.classList.remove('red', 'gold', 'fresh');
    cell.classList.add(team, 'fresh');
    setTimeout(() => cell.classList.remove('fresh'), 500);
  }

  function updateScores(teamScores) {
    const total = gridW * gridH;
    const r = teamScores.red || 0;
    const g = teamScores.gold || 0;
    const rPct = Math.round((r / total) * 100);
    const gPct = Math.round((g / total) * 100);
    $('pct-red').textContent = rPct + '%';
    $('pct-gold').textContent = gPct + '%';
  }

  function startTimer() {
    if (!state || !state.endsAt) return;
    urgentTriggered = false;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      const remaining = Math.max(0, state.endsAt - Date.now());
      const sec = Math.ceil(remaining / 1000);
      $('timer-display').textContent = sec;
      if (sec <= 10 && !urgentTriggered) {
        urgentTriggered = true;
        $('cs-time') && $('cs-time').classList.add('urgent');
        MochiSounds.urgent();
      }
      if (remaining <= 0) clearInterval(timerInterval);
    }, 100);
  }

  socket.on('game-end', (data) => {
    if (timerInterval) clearInterval(timerInterval);
    MochiSounds.stopMusic();
    showScreen('win');
    const total = gridW * gridH;
    const rPct = Math.round((data.teamScores.red / total) * 100);
    const gPct = Math.round((data.teamScores.gold / total) * 100);
    $('final-red').textContent = rPct + '%';
    $('final-gold').textContent = gPct + '%';
    if (data.winner === 'red') {
      $('win-banner').textContent = '🎨 Crimson Wins!';
      $('win-banner').className = 'winner-banner red';
      $('win-emoji').textContent = '🎨';
      MochiSounds.win();
      launchConfetti(['#ff5a66', '#d92e3a', '#ffd57a']);
    } else if (data.winner === 'gold') {
      $('win-banner').textContent = '🖌️ Sunburst Wins!';
      $('win-banner').className = 'winner-banner gold';
      $('win-emoji').textContent = '🖌️';
      MochiSounds.win();
      launchConfetti(['#ffd57a', '#e8b14a', '#ff5a66']);
    } else {
      $('win-banner').textContent = '🤝 Tie Splatter!';
      $('win-banner').className = 'winner-banner tie';
      $('win-emoji').textContent = '⚖️';
      MochiSounds.lose();
    }
  });

  function renderLobbyPlayers(players) {
    const red = $('players-red');
    const gold = $('players-gold');
    red.innerHTML = '';
    gold.innerHTML = '';
    Object.entries(players || {}).forEach(([id, p]) => {
      const chip = document.createElement('div');
      chip.className = 'player-chip';
      chip.innerHTML = `<span>${escapeHtml(p.name)}</span><span class="swap-arrow">↔</span>`;
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
      c.textContent = ['🎨', '🖌️', '✨'][i % 3];
      c.style.fontSize = (1 + Math.random() * 1) + 'rem';
      c.style.background = 'transparent';
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 5000);
    }
  }

  socket.on('disconnect', () => console.log('[host-color] socket disconnected, reconnecting…'));
  socket.on('connect', () => console.log('[host-color] socket connected'));
  socket.on('host-left', () => console.warn('[host-color] host-left received'));

  function showScreen(name) {
    ['lobby', 'countdown', 'active', 'win'].forEach((n) => {
      $('screen-' + n).classList.toggle('hidden', n !== name);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
})();
