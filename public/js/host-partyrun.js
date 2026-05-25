// 🧧 Hóngbāo Run — host driver
// Players answer HSK1 vocab on their phones; the host page shows the
// FULL festive board with everyone's dragons + the live question + a
// per-player leaderboard (stars + coins). Pure cinema for the class
// screen — actual interaction lives on the phones.
(function () {
  const socket = io();
  let pin = null;
  let state = null;
  let scores = { red: 0, gold: 0 };
  let boardTiles = [];                  // server pushes the 20-tile pattern
  let playersOnBoard = {};              // id -> { name, team, avatar, tile, stars, coins }
  let questionTimerInt = null;

  const $ = (id) => document.getElementById(id);
  const TILE_ICON = {
    star:    '⭐',
    hongbao: '🧧',
    trap:    '🐉',
    blank:   '·',
  };

  $('mute-btn').addEventListener('click', () => {
    const muted = window.toggleMute();
    $('mute-btn').textContent = muted ? '🔇 Off' : '🔊 On';
  });
  document.addEventListener('click', () => window.unlockAudio && window.unlockAudio(), { once: true });
  window.addEventListener('music-started', (e) => {
    const chip = $('music-chip');
    const name = $('music-chip-name');
    if (!chip) return;
    if (name) name.textContent = 'Hóngbāo Run · ' + (e.detail.bpm || '') + 'bpm';
    chip.classList.remove('hidden');
    setTimeout(() => chip.classList.add('hidden'), 3500);
  });

  socket.emit('host:create', { gameType: 'partyrun' }, ({ pin: p }) => {
    pin = p;
    $('pin-display').textContent = p;
    if ($('active-pin-display')) $('active-pin-display').textContent = p;
    $('join-url').textContent = `${location.origin}/?pin=${p}`;
    document.title = `🧧 Hóngbāo Run · ${p}`;
    MochiSounds.correct && MochiSounds.correct();
    setTimeout(updateStartBtn, 100);
  });

  $('balance-btn').addEventListener('click', () => {
    socket.emit('host:auto-balance', { pin });
    MochiSounds.swap && MochiSounds.swap();
  });
  $('start-btn').addEventListener('click', () => socket.emit('host:start', { pin }));
  $('end-now-btn').addEventListener('click', () => {
    if (confirm('¿Terminar la carrera?')) socket.emit('host:end-now', { pin });
  });
  $('play-again-btn').addEventListener('click', () => {
    if (MochiSounds.stopEndMusic) MochiSounds.stopEndMusic();
    socket.emit('host:reset', { pin });
    showScreen('lobby');
    scores = { red: 0, gold: 0 };
    playersOnBoard = {};
  });

  function updateStartBtn() {
    const btn = $('start-btn');
    if (!state) { btn.disabled = true; return; }
    btn.disabled = !(Object.keys(state.players || {}).length > 0);
  }

  // ── Lobby plumbing ──────────────────────────────────────────────────
  socket.on('state', (s) => {
    state = s;
    if (s.state === 'lobby') {
      renderLobbyPlayers(s.players);
      updateStartBtn();
    }
    if (s.teamScores) scores = s.teamScores;
  });
  socket.on('countdown', () => {
    showScreen('countdown');
    if (window.unlockAudio) window.unlockAudio();
    MochiSounds.startGameTheme && MochiSounds.startGameTheme('partyrun');
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
        numEl.textContent = '¡A CORRER!';
        numEl.style.animation = 'none';
        numEl.offsetHeight;
        numEl.style.animation = '';
        MochiSounds.go && MochiSounds.go();
        setTimeout(() => { showScreen('active'); }, 800);
      }
    };
    tick();
  });

  // ── Partyrun init: board + initial player positions ────────────────
  socket.on('pr:init', (data) => {
    boardTiles = data.board || [];
    playersOnBoard = data.players || {};
    if ($('pr-round-max')) $('pr-round-max').textContent = data.maxRounds || 12;
    renderBoard();
    renderLeaderboard();
  });

  // ── New round: show the question + tick the timer ──────────────────
  socket.on('pr:question', (q) => {
    if ($('pr-round-now')) $('pr-round-now').textContent = q.round || 1;
    if ($('pr-q-text')) $('pr-q-text').textContent = q.text || '…';
    if ($('pr-q-tag')) $('pr-q-tag').textContent = `Ronda ${q.round}`;
    if ($('pr-question-banner')) $('pr-question-banner').classList.add('show');
    startQuestionTimer(q.deadline);
    MochiSounds.tap && MochiSounds.tap();
  });

  // ── Reveal: animate every dragon to its new tile, then show effects ─
  socket.on('pr:reveal', (data) => {
    if (questionTimerInt) clearInterval(questionTimerInt);
    if ($('pr-q-bar-fill')) $('pr-q-bar-fill').style.width = '0%';
    if ($('pr-question-banner')) $('pr-question-banner').classList.remove('show');
    const results = data.results || [];
    // Apply position + score updates in sequence with brief stagger so
    // each player's movement is visible to the class — Mario Party
    // showed each player roll one at a time.
    results.forEach((r, i) => {
      setTimeout(() => {
        // Update the in-memory player record + re-render that dragon.
        if (playersOnBoard[r.id]) {
          playersOnBoard[r.id].tile  = r.newTile;
          playersOnBoard[r.id].stars = r.stars;
          playersOnBoard[r.id].coins = r.coins;
        }
        renderBoard();
        renderLeaderboard();
        // Pop a brief tile-effect chip at the landed tile.
        flashTileEffect(r.newTile, r.effect);
        if (r.effect && r.effect.kind === 'star') {
          MochiSounds.winFanfare && MochiSounds.winFanfare();
        } else if (r.effect && r.effect.kind === 'hongbao') {
          MochiSounds.combo && MochiSounds.combo();
        } else if (r.effect && r.effect.kind === 'trap') {
          MochiSounds.wrong && MochiSounds.wrong();
        } else {
          MochiSounds.tap && MochiSounds.tap();
        }
      }, i * 320);
    });
  });

  // ── Game over: render leaderboard, declare winner ──────────────────
  socket.on('pr:game-over', (data) => {
    if (questionTimerInt) clearInterval(questionTimerInt);
    showScreen('win');
    MochiSounds.stopMusic && MochiSounds.stopMusic();
    const ts = data.teamScores || { red: 0, gold: 0 };
    $('final-red').textContent  = ts.red  || 0;
    $('final-gold').textContent = ts.gold || 0;
    const winnerTeam = ts.red === ts.gold ? null : (ts.red > ts.gold ? 'red' : 'gold');
    if (winnerTeam === 'red') {
      $('win-banner').textContent = '🐉 ¡Dragones Rojos ganaron!';
      $('win-banner').className = 'winner-banner red';
      $('win-emoji').textContent = '🐉';
    } else if (winnerTeam === 'gold') {
      $('win-banner').textContent = '🦁 ¡Leones Dorados ganaron!';
      $('win-banner').className = 'winner-banner gold';
      $('win-emoji').textContent = '🦁';
    } else {
      $('win-banner').textContent = '🤝 ¡Empate!';
      $('win-banner').className = 'winner-banner tie';
      $('win-emoji').textContent = '⚖️';
    }
    MochiSounds.winMusic && MochiSounds.winMusic();
    setTimeout(() => MochiSounds.winFanfare && MochiSounds.winFanfare(), 400);
    launchConfetti();
    renderWinBoard(data.players || []);
  });

  // ── Rendering ─────────────────────────────────────────────────────
  // Snake-layout the 20 tiles into 4 rows of 5 so the loop reads naturally.
  // Row 0: 0,1,2,3,4 (left→right)
  // Row 1: 9,8,7,6,5 (right→left)
  // Row 2: 10,11,12,13,14
  // Row 3: 19,18,17,16,15
  function tileRowCol(idx) {
    const cols = 5;
    const row = Math.floor(idx / cols);
    const isReverseRow = row % 2 === 1;
    const col = isReverseRow ? (cols - 1 - (idx % cols)) : (idx % cols);
    return { row, col };
  }
  function renderBoard() {
    const board = $('pr-board');
    if (!board) return;
    if (!board.firstChild || board.children.length !== boardTiles.length) {
      // First render — build the tile grid
      board.innerHTML = '';
      board.style.gridTemplateColumns = `repeat(5, 1fr)`;
      board.style.gridTemplateRows    = `repeat(4, 1fr)`;
      // Position each tile via grid-row / grid-column for the snake layout
      boardTiles.forEach((t, i) => {
        const { row, col } = tileRowCol(i);
        const cell = document.createElement('div');
        cell.id = 'pr-tile-' + i;
        cell.className = 'pr-tile tile-' + t.kind;
        cell.style.gridRow = (row + 1);
        cell.style.gridColumn = (col + 1);
        cell.innerHTML = `
          <div class="pr-tile-icon">${TILE_ICON[t.kind] || '·'}</div>
          <div class="pr-tile-idx">${i + 1}</div>
          <div class="pr-tile-dragons"></div>`;
        board.appendChild(cell);
      });
    }
    // Clear all dragon dots then re-place
    board.querySelectorAll('.pr-tile-dragons').forEach((d) => { d.innerHTML = ''; });
    Object.entries(playersOnBoard).forEach(([id, p]) => {
      const tileEl = document.getElementById('pr-tile-' + p.tile);
      if (!tileEl) return;
      const slot = tileEl.querySelector('.pr-tile-dragons');
      if (!slot) return;
      const dragon = document.createElement('div');
      dragon.className = 'pr-dragon team-' + p.team;
      dragon.title = p.name;
      dragon.textContent = (p.avatar && p.avatar.length <= 2) ? p.avatar : (p.team === 'red' ? '🐉' : '🦁');
      slot.appendChild(dragon);
    });
  }
  function flashTileEffect(tileIdx, effect) {
    const tileEl = document.getElementById('pr-tile-' + tileIdx);
    if (!tileEl || !effect) return;
    tileEl.classList.remove('pr-tile-fire');
    void tileEl.offsetWidth;
    tileEl.classList.add('pr-tile-fire');
    setTimeout(() => tileEl.classList.remove('pr-tile-fire'), 900);
    // Floating effect chip
    const chip = document.createElement('div');
    chip.className = 'pr-tile-chip kind-' + effect.kind;
    chip.textContent = effect.icon + ' ' + effect.es;
    tileEl.appendChild(chip);
    setTimeout(() => chip.remove(), 1500);
  }
  function renderLeaderboard() {
    const lb = $('pr-leaderboard');
    if (!lb) return;
    const rows = Object.entries(playersOnBoard).map(([id, p]) => ({
      id, ...p,
    })).sort((a, b) => (b.stars - a.stars) || (b.coins - a.coins));
    lb.innerHTML = '';
    rows.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'pr-lb-row team-' + p.team;
      row.innerHTML = `
        <span class="pr-lb-rank">${['🥇','🥈','🥉'][i] || '#' + (i + 1)}</span>
        <span class="pr-lb-name">${p.team === 'red' ? '🐉' : '🦁'} ${escapeHtml(p.name)}</span>
        <span class="pr-lb-stars">⭐ ${p.stars || 0}</span>
        <span class="pr-lb-coins">🧧 ${p.coins || 0}</span>`;
      lb.appendChild(row);
    });
  }
  function renderWinBoard(players) {
    const lb = $('leaderboard');
    if (!lb) return;
    lb.innerHTML = '';
    const sorted = players.slice().sort((a, b) => (b.stars - a.stars) || (b.coins - a.coins));
    sorted.slice(0, 12).forEach((p, i) => {
      const row = document.createElement('div');
      row.className = `lb-row ${p.team}`;
      const medal = ['🥇', '🥈', '🥉'][i] || `#${i + 1}`;
      const teamEmoji = p.team === 'red' ? '🐉' : '🦁';
      row.innerHTML = `
        <span class="lb-rank">${medal}</span>
        <span class="lb-name">${p.avatar ? p.avatar + ' ' : ''}${teamEmoji} ${escapeHtml(p.name)}</span>
        <span class="lb-score">⭐ ${p.stars} · 🧧 ${p.coins}</span>`;
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
  function startQuestionTimer(deadline) {
    if (questionTimerInt) clearInterval(questionTimerInt);
    const total = deadline - Date.now();
    questionTimerInt = setInterval(() => {
      const remaining = Math.max(0, deadline - Date.now());
      if ($('pr-timer-display')) $('pr-timer-display').textContent = Math.ceil(remaining / 1000) + 's';
      if ($('pr-q-bar-fill')) $('pr-q-bar-fill').style.width = (remaining / total * 100) + '%';
      if (remaining <= 0) { clearInterval(questionTimerInt); }
    }, 100);
  }
  function launchConfetti() {
    const icons = ['🧧', '⭐', '🐉', '🦁', '🎆', '🏮'];
    for (let i = 0; i < 80; i++) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + '%';
      c.style.animationDelay = Math.random() * 1.5 + 's';
      c.style.animationDuration = 2 + Math.random() * 2 + 's';
      c.textContent = icons[i % icons.length];
      c.style.fontSize = (1 + Math.random() * 1.2) + 'rem';
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
