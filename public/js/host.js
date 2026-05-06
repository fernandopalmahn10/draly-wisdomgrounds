(function () {
  const socket = io();
  let pin = null;
  let state = null;
  let timerInterval = null;
  let urgentTriggered = false;
  let lastFilled = { red: 0, gold: 0 };
  const TERRITORY_CELLS = 24;
  const POINTS_PER_CELL = 20;

  const $ = (id) => document.getElementById(id);

  // Mute toggle
  $('mute-btn').addEventListener('click', () => {
    const muted = window.toggleMute();
    $('mute-btn').textContent = muted ? '🔇 Off' : '🔊 On';
  });

  // Unlock audio on first click
  document.addEventListener('click', () => window.unlockAudio && window.unlockAudio(), { once: true });

  // Read chosen set from URL
  const params = new URLSearchParams(location.search);
  const chosenSetId = params.get('setId');

  if (!chosenSetId) {
    // No set chosen → bounce to /sets.html
    location.href = '/sets.html';
  }

  // Create game on load and load the chosen set
  socket.emit('host:create', ({ pin: p }) => {
    pin = p;
    $('pin-display').textContent = p;
    $('join-url').textContent = `${location.origin}/?pin=${p}`;
    document.title = `Mochi Mash · ${p}`;

    // Load chosen set into the game
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

  // Duration
  $('duration-slider').addEventListener('input', (e) => {
    const v = +e.target.value;
    $('duration-value').textContent = v >= 60 ? `${Math.floor(v / 60)}m ${v % 60 ? (v % 60) + 's' : ''}`.trim() : `${v}s`;
  });
  $('duration-slider').addEventListener('change', (e) => {
    socket.emit('host:set-duration', { pin, duration: +e.target.value });
  });

  // Auto-balance
  $('balance-btn').addEventListener('click', () => {
    socket.emit('host:auto-balance', { pin });
    MochiSounds.swap();
  });

  // Start
  $('start-btn').addEventListener('click', () => {
    socket.emit('host:start', { pin });
  });

  // End now
  $('end-now-btn').addEventListener('click', () => {
    if (confirm('End the round now?')) {
      socket.emit('host:end-now', { pin });
    }
  });

  // Play again
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

  // State updates
  socket.on('images-progress', ({ warmed, total }) => {
    const badge = document.getElementById('images-progress-badge');
    const text = document.getElementById('images-progress-text');
    if (!badge || !text) return;
    badge.style.display = 'block';
    text.textContent = `${warmed}/${total}`;
    if (warmed >= total) {
      badge.style.color = 'var(--jade)';
      text.textContent = `${total}/${total} ✓`;
      setTimeout(() => { badge.style.display = 'none'; }, 4000);
    }
  });

  socket.on('state', (s) => {
    state = s;
    if (s.state === 'lobby') {
      renderLobbyPlayers(s.players);
      updateStartBtn();
    } else if (s.state === 'active') {
      $('score-red').textContent = s.teamScores.red;
      $('score-gold').textContent = s.teamScores.gold;
      renderActivePlayers(s.players);
      renderFeed(s.feed);
    }
  });

  socket.on('score-update', ({ teamScores }) => {
    if (state && state.state === 'active') {
      state.teamScores = teamScores;
      $('score-red').textContent = teamScores.red;
      $('score-gold').textContent = teamScores.gold;
      updateTerritory('red', teamScores.red);
      updateTerritory('gold', teamScores.gold);
      bumpMascots();
    }
  });

  function initTerritory(team) {
    const grid = $(`grid-${team}`);
    const zoo = $(`zoo-${team}`);
    grid.innerHTML = '';
    if (zoo) zoo.classList.remove('full');
    for (let i = 0; i < TERRITORY_CELLS; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      grid.appendChild(cell);
    }
    lastFilled[team] = 0;
  }

  function updateTerritory(team, score) {
    const grid = $(`grid-${team}`);
    if (!grid) return;
    if (grid.children.length === 0) initTerritory(team);
    const filled = Math.min(TERRITORY_CELLS, Math.floor(score / POINTS_PER_CELL));
    if (filled > lastFilled[team]) {
      const emoji = team === 'red' ? '🐼' : '🦊';
      for (let i = lastFilled[team]; i < filled; i++) {
        const cell = grid.children[i];
        if (!cell) continue;
        cell.classList.add('filled', 'fresh');
        cell.textContent = emoji;
        setTimeout(((c) => () => c.classList.remove('fresh'))(cell), 600);
      }
      MochiSounds.populate(team);
      lastFilled[team] = filled;
      if (filled >= TERRITORY_CELLS) {
        const zoo = $(`zoo-${team}`);
        if (zoo) zoo.classList.add('full');
      }
    }
  }

  socket.on('countdown', ({ ms }) => {
    showScreen('countdown');
    initTerritory('red');
    initTerritory('gold');
    MochiSounds.startMusic();
    // Start random Dralingo appearances during battle
    Dralingo.startRandom({
      minMs: 25000,
      maxMs: 50000,
      isActive: () => state && state.state === 'active'
    });
    let n = 3;
    const overlay = $('screen-countdown');
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

  function startTimer() {
    if (!state || !state.endsAt) return;
    urgentTriggered = false;
    if (timerInterval) clearInterval(timerInterval);
    const total = state.duration * 1000;
    timerInterval = setInterval(() => {
      const remaining = Math.max(0, state.endsAt - Date.now());
      const sec = Math.ceil(remaining / 1000);
      $('timer-display').textContent = sec;
      $('timer-bar-fill').style.width = `${(remaining / total) * 100}%`;
      if (sec <= 10 && !urgentTriggered) {
        urgentTriggered = true;
        $('timer-bar').classList.add('urgent');
        $('timer-display').classList.add('urgent');
        MochiSounds.urgent();
      }
      if (remaining <= 0) {
        clearInterval(timerInterval);
      }
    }, 100);
  }

  socket.on('game-end', (data) => {
    if (timerInterval) clearInterval(timerInterval);
    MochiSounds.stopMusic();
    Dralingo.stopRandom();
    // Final legendary salute
    setTimeout(() => Dralingo.legendary({ quote: 'Wisdom prevails! 🐉' }), 600);
    showScreen('win');
    $('final-red').textContent = data.teamScores.red;
    $('final-gold').textContent = data.teamScores.gold;
    if (data.winner === 'red') {
      $('win-banner').textContent = '🐼 Team Panda Wins!';
      $('win-banner').className = 'winner-banner red';
      $('win-emoji').textContent = '🐼';
      MochiSounds.win();
      launchConfetti(['#ff5a66', '#d92e3a', '#ffd57a']);
    } else if (data.winner === 'gold') {
      $('win-banner').textContent = '🦊 Team Kitsune Wins!';
      $('win-banner').className = 'winner-banner gold';
      $('win-emoji').textContent = '🦊';
      MochiSounds.win();
      launchConfetti(['#ffd57a', '#e8b14a', '#ff5a66']);
    } else {
      $('win-banner').textContent = '🤝 Tie Battle!';
      $('win-banner').className = 'winner-banner tie';
      $('win-emoji').textContent = '⚖️';
      MochiSounds.lose();
    }
    const lb = $('leaderboard');
    lb.innerHTML = '';
    (data.leaderboard || []).slice(0, 10).forEach((p, i) => {
      const row = document.createElement('div');
      row.className = `lb-row ${p.team}`;
      const medal = ['🥇', '🥈', '🥉'][i] || `#${i + 1}`;
      row.innerHTML = `
        <span class="lb-rank">${medal}</span>
        <span class="lb-name">${escapeHtml(p.name)}</span>
        <span class="lb-score">${p.score}</span>
      `;
      lb.appendChild(row);
    });
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

  function renderActivePlayers(players) {
    const red = $('active-players-red');
    const gold = $('active-players-gold');
    red.innerHTML = '';
    gold.innerHTML = '';
    Object.values(players || {}).sort((a, b) => b.score - a.score).forEach((p) => {
      const chip = document.createElement('div');
      chip.className = 'player-chip';
      chip.innerHTML = `<span>${escapeHtml(p.name)}</span><span style="opacity:0.7; font-size:0.8rem;">${p.score}</span>`;
      (p.team === 'red' ? red : gold).appendChild(chip);
    });
  }

  function renderFeed(feed) {
    const el = $('feed');
    el.innerHTML = '';
    (feed || []).slice().reverse().forEach((item) => {
      const row = document.createElement('div');
      row.className = `feed-item ${item.team || ''}`;
      let text = '';
      if (item.type === 'join') text = `🪷 ${item.name} joined ${item.team === 'red' ? 'Panda' : 'Kitsune'}`;
      else if (item.type === 'swap') text = `↔ ${item.name} → ${item.team === 'red' ? 'Panda' : 'Kitsune'}`;
      else if (item.type === 'leave') text = `← ${item.name} left`;
      else if (item.type === 'combo') text = `🔥 ${item.name} combo!`;
      row.textContent = text;
      el.appendChild(row);
    });
  }

  let mascotBumpTimer = null;
  function bumpMascots() {
    clearTimeout(mascotBumpTimer);
    $('mascot-red').classList.add('eating');
    $('mascot-gold').classList.add('eating');
    mascotBumpTimer = setTimeout(() => {
      $('mascot-red').classList.remove('eating');
      $('mascot-gold').classList.remove('eating');
    }, 200);
  }

  function launchConfetti(colors) {
    for (let i = 0; i < 80; i++) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + '%';
      c.style.background = colors[i % colors.length];
      c.style.animationDelay = Math.random() * 1.5 + 's';
      c.style.animationDuration = 2 + Math.random() * 2 + 's';
      c.textContent = ['🥮', '🍡', '🥟'][i % 3];
      c.style.fontSize = (1 + Math.random() * 1) + 'rem';
      c.style.background = 'transparent';
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 5000);
    }
  }

  socket.on('host-left', () => {
    alert('Connection lost. Please reload.');
  });

  function showScreen(name) {
    ['lobby', 'countdown', 'active', 'win'].forEach((n) => {
      $('screen-' + n).classList.toggle('hidden', n !== name);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
})();
