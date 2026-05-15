// 中国大富翁 · Chinese Trivia Monopoly — host view.
// 16-tile perimeter board rendered with CSS grid + 3D perspective tilt. Each
// player's dragon token sits on its tile. Correct vocab answer → server rolls
// a die, advances the token, resolves the tile. We animate movement, money
// popups, and ownership colors.
(function () {
  const socket = io();
  let pin = null;
  let state = null;
  let timerInterval = null;
  let urgentTriggered = false;

  let tiles = [];
  let players = {};           // pid → { name, team, pos, money }
  let ownership = {};         // tileId → 'red' | 'gold' | null
  let scores = { red: 0, gold: 0 };
  let instantWin = 2000;
  let tycoonTeam = null;

  const $ = (id) => document.getElementById(id);

  $('mute-btn').addEventListener('click', () => {
    const muted = window.toggleMute();
    $('mute-btn').textContent = muted ? '🔇 Off' : '🔊 On';
  });
  document.addEventListener('click', () => window.unlockAudio && window.unlockAudio(), { once: true });

  const params = new URLSearchParams(location.search);
  const chosenSetId = params.get('setId');
  if (!chosenSetId) location.href = '/sets.html?game=monopoly';

  socket.emit('host:create', { gameType: 'monopoly' }, ({ pin: p }) => {
    pin = p;
    $('pin-display').textContent = p;
    if ($('active-pin-display')) $('active-pin-display').textContent = p;
    $('join-url').textContent = `${location.origin}/?pin=${p}`;
    document.title = `Dàfùwēng · ${p}`;
    socket.emit('host:load-set', { pin, setId: chosenSetId }, (resp) => {
      if (!resp.ok) {
        alert('No se pudo cargar el set: ' + (resp.error || 'desconocido'));
        location.href = '/sets.html?game=monopoly';
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
    players = {};
    ownership = {};
    scores = { red: 0, gold: 0 };
    tycoonTeam = null;
    updateWealthDisplay();
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
        numEl.textContent = '¡发!';
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

  socket.on('mp:init', (data) => {
    tiles = data.tiles || [];
    players = data.players || {};
    ownership = {};
    scores = data.teamScores || { red: 0, gold: 0 };
    if (data.instantWin) instantWin = data.instantWin;
    tycoonTeam = null;
    renderBoard();
    placeTokensInitial();
    updateWealthDisplay();
    renderLiveLeaderboard();
    setRecentEvent('¡Que rueden los dados! 🎲');
  });

  socket.on('mp:move', (data) => {
    if (data.teamScores) scores = data.teamScores;
    if (data.ownership)  ownership = data.ownership;
    // Update player position + wealth (drives the live leaderboard)
    const wealth = (typeof data.playerWealth === 'number') ? data.playerWealth : data.money;
    if (players[data.playerId]) {
      players[data.playerId].pos = data.toPos;
      players[data.playerId].money = wealth;
    } else {
      players[data.playerId] = { name: data.playerName, team: data.team, pos: data.toPos, money: wealth, char: data.char };
    }
    // Animate the move (one tile at a time)
    animateMove(data.playerId, data.fromPos, data.toPos, () => {
      applyTileEffect(data);
    });
    // Show dice
    if (!data.skipped) showDice(data.roll);
    refreshOwnership();
    updateWealthDisplay();
    renderLiveLeaderboard();
  });

  socket.on('mp:tycoon', ({ team, teamScores }) => {
    tycoonTeam = team;
    if (teamScores) scores = teamScores;
    updateWealthDisplay();
    const emoji = team === 'red' ? '🐉' : '🐲';
    setRecentEvent(`🏆 ¡${emoji} EL EQUIPO ${team === 'red' ? 'ROJO' : 'DORADO'} ALCANZÓ ¥${instantWin}! ¡VICTORIA INSTANTÁNEA!`);
    MochiSounds.winFanfare && MochiSounds.winFanfare();
  });

  socket.on('game-end', (data) => {
    if (timerInterval) clearInterval(timerInterval);
    MochiSounds.stopMusic();
    showScreen('win');
    $('final-red').textContent = data.teamScores.red || 0;
    $('final-gold').textContent = data.teamScores.gold || 0;
    const r = data.teamScores.red || 0;
    const g = data.teamScores.gold || 0;
    const gap = Math.abs(r - g);
    const narr = $('win-narration');
    if (data.winner === 'red') {
      $('win-banner').textContent = '🐉 ¡El Equipo Rojo se hizo rico!';
      $('win-banner').className = 'winner-banner red';
      $('win-emoji').textContent = '🐉';
      MochiSounds.winMusic && MochiSounds.winMusic();
      setTimeout(() => MochiSounds.winFanfare && MochiSounds.winFanfare(), 400);
      if (narr) narr.innerHTML = `🐉 <span class="red-team">El Equipo Rojo</span> acumuló <strong>¥${r}</strong> en efectivo + propiedades — ${gap > 500 ? 'un imperio comercial 💰' : gap > 200 ? 'una victoria sólida 💪' : 'un duelo reñido ⚔️'}.`;
      launchConfetti(['#ff5a66', '#d92e3a', '#ffd57a']);
    } else if (data.winner === 'gold') {
      $('win-banner').textContent = '🐲 ¡El Equipo Dorado se hizo rico!';
      $('win-banner').className = 'winner-banner gold';
      $('win-emoji').textContent = '🐲';
      MochiSounds.winMusic && MochiSounds.winMusic();
      setTimeout(() => MochiSounds.winFanfare && MochiSounds.winFanfare(), 400);
      if (narr) narr.innerHTML = `🐲 <span class="gold-team">El Equipo Dorado</span> acumuló <strong>¥${g}</strong> — ${gap > 500 ? 'un imperio comercial 💰' : gap > 200 ? 'una victoria sólida 💪' : 'un duelo reñido ⚔️'}.`;
      launchConfetti(['#ffd57a', '#e8b14a', '#ff5a66']);
    } else {
      $('win-banner').textContent = '🤝 ¡Empate de mercaderes!';
      $('win-banner').className = 'winner-banner tie';
      $('win-emoji').textContent = '⚖️';
      MochiSounds.tieMusic && MochiSounds.tieMusic();
      if (narr) narr.innerHTML = `🤝 Ambos equipos igualaron en <strong>¥${r}</strong>.`;
    }
    renderLeaderboard(data);
  });

  // === Board rendering ===
  // Perimeter layout on a 6x6 CSS grid. Tile ids 0..15 wrap clockwise from
  // top-left corner. Top row = ids 0..4, right column = 5..7, bottom row =
  // 8..11 (reversed visually), left column = 12..15 (reversed).
  function renderBoard() {
    const board = $('mp-board');
    if (!board || !tiles.length) return;
    // Remove any existing tile elements (keep .mp-board-center)
    [...board.querySelectorAll('.mp-tile')].forEach((el) => el.remove());
    tiles.forEach((t) => {
      const el = document.createElement('div');
      el.className = 'mp-tile tile-' + t.type + ' side-' + t.side;
      el.id = 'mp-tile-' + t.id;
      el.dataset.tileId = t.id;
      const ownerBorder = ownership[t.id] ? `<div class="mp-tile-owner ${ownership[t.id]}"></div>` : '';
      const costLabel = t.cost ? `<div class="mp-tile-cost">¥${t.cost}</div>` : '';
      el.innerHTML = `
        <div class="mp-tile-icon">${t.icon}</div>
        <div class="mp-tile-name">${escapeHtml(t.name)}</div>
        ${costLabel}
        <div class="mp-tile-tokens" id="mp-tokens-${t.id}"></div>
        ${ownerBorder}
      `;
      // CSS grid position based on tile id
      const { col, row } = tileGridPos(t.id);
      el.style.gridColumn = col;
      el.style.gridRow = row;
      board.appendChild(el);
    });
  }

  // Map 16 tile ids to 6x6 grid coords going clockwise from id=0 (top-left).
  // top row:    ids 0..4  at row 1, cols 1..5
  // right col:  ids 5..7  at rows 2..4, col 6
  // bottom row: id 8 at row 5 col 6 (corner), ids 9..11 at row 5 cols 5..3 → actually need 5x5+corner
  // Easier: 6x6 grid; top row r1c1..c6, right col r2..r5 c6, bottom r6c6..c1, left c1 r5..r2.
  // 16 tiles in 4 corners + 3 per side = 4 corners + 12 sides = 16. ✓
  // Corner-clockwise mapping:
  //   id 0 (corner) = r1 c1
  //   id 1 = r1 c2, id 2 = r1 c3, id 3 = r1 c4   (top side, 3 mid tiles; r1 c5 unused? No, need 1 more)
  // Wait — 16 tiles, 4 corners. Each side has 3 mid tiles. Corner + 3 mid + Corner + 3 mid + Corner + 3 mid + Corner + 3 mid = 16. Perfect.
  // Grid dims: corners + 3 mid per side → side length = 5 (corner + 3 + corner = 5 cells). 5x5 grid.
  function tileGridPos(id) {
    // 5x5 grid (1-indexed), corners + 3 mids per side, 16 tiles total.
    // ids 0..3 = top row (r1, c1..c4)
    // ids 4..7 = right col (r1..r4, c5)  → id 4 is corner top-right
    // ids 8..11 = bottom row going right→left (r5, c5..c2)
    // ids 12..15 = left col going bottom→top (r5..r2, c1)
    if (id <= 3)       return { row: 1, col: id + 1 };
    if (id <= 7)       return { row: id - 3, col: 5 };
    if (id <= 11)      return { row: 5, col: 13 - id };
    return { row: 17 - id, col: 1 };
  }

  function placeTokensInitial() {
    Object.entries(players).forEach(([pid, p]) => {
      const slot = $('mp-tokens-' + (p.pos || 0));
      if (!slot) return;
      const token = makeTokenEl(pid, p);
      slot.appendChild(token);
    });
  }

  // Build a token element that uses the player's Kenney character PNG. The
  // team-colored ring around it keeps the per-team coloring readable.
  function makeTokenEl(pid, p) {
    const token = document.createElement('div');
    token.id = 'mp-token-' + pid;
    token.className = 'mp-token ' + p.team;
    token.title = p.name;
    const charIdx = (typeof p.char === 'number') ? p.char : 0;
    token.innerHTML = `<img class="mp-token-img" src="/assets/monopoly/chars/char-${charIdx}.png" alt="${escapeHtml(p.name)}">`;
    return token;
  }

  function animateMove(pid, fromPos, toPos, onDone) {
    const token = $('mp-token-' + pid);
    if (!token) {
      // Token wasn't placed yet (player joined late) — place directly
      const slot = $('mp-tokens-' + toPos);
      if (slot && players[pid]) {
        slot.appendChild(makeTokenEl(pid, players[pid]));
      }
      if (onDone) onDone();
      return;
    }
    if (fromPos === toPos) { if (onDone) onDone(); return; }
    // Hop one tile at a time around the board
    const steps = ((toPos - fromPos) + tiles.length) % tiles.length;
    let cur = fromPos;
    let i = 0;
    function step() {
      cur = (cur + 1) % tiles.length;
      i++;
      const newSlot = $('mp-tokens-' + cur);
      if (newSlot) {
        newSlot.appendChild(token);
        token.classList.remove('hopping');
        void token.offsetWidth;
        token.classList.add('hopping');
      }
      MochiSounds.tick && MochiSounds.tick();
      if (i < steps) {
        setTimeout(step, 160);
      } else {
        if (onDone) onDone();
      }
    }
    if (steps === 0) { if (onDone) onDone(); return; }
    step();
  }

  function applyTileEffect(data) {
    const tile = data.tile;
    if (!tile) return;
    const teamEmoji = data.team === 'red' ? '🐉' : '🐲';
    let msg = '';
    let sound = null;
    switch (data.action) {
      case 'bought':
        msg = `${teamEmoji} ${escapeHtml(data.playerName)} compró ${tile.name} por ¥${-data.moneyDelta}`;
        spawnMoneyPop(data.toPos, data.moneyDelta, data.team);
        sound = 'correct';
        break;
      case 'own-city':
        msg = `${teamEmoji} ${escapeHtml(data.playerName)} llegó a su propia ciudad ${tile.name}`;
        break;
      case 'paid-rent':
        msg = `${teamEmoji} ${escapeHtml(data.playerName)} pagó ¥${data.rentAmount} de renta en ${tile.name}`;
        spawnMoneyPop(data.toPos, data.moneyDelta, data.team);
        sound = 'wrong';
        break;
      case 'cant-afford':
        msg = `${teamEmoji} ${escapeHtml(data.playerName)} llegó a ${tile.name} pero no tiene dinero`;
        break;
      case 'card-bonus':
        msg = `🎴 ${escapeHtml(data.playerName)} sacó una carta +¥${data.moneyDelta}`;
        spawnMoneyPop(data.toPos, data.moneyDelta, data.team);
        sound = 'correct';
        break;
      case 'treasure':
        msg = `🐉 ${escapeHtml(data.playerName)} encontró un tesoro +¥${data.moneyDelta}`;
        spawnMoneyPop(data.toPos, data.moneyDelta, data.team);
        sound = 'correct';
        break;
      case 'tax':
        msg = `💰 ${escapeHtml(data.playerName)} pagó ¥${-data.moneyDelta} de impuestos`;
        spawnMoneyPop(data.toPos, data.moneyDelta, data.team);
        sound = 'wrong';
        break;
      case 'festival':
        msg = `🏮 ¡FIESTA! ${escapeHtml(data.playerName)} ganó +¥${data.moneyDelta}`;
        spawnMoneyPop(data.toPos, data.moneyDelta, data.team);
        sound = 'winFanfare';
        break;
      case 'jail':
        msg = `🏛 ${escapeHtml(data.playerName)} cayó en la cárcel — pierde el próximo turno`;
        break;
      case 'start-bonus':
        msg = `🏯 ${escapeHtml(data.playerName)} cayó en START +¥${data.moneyDelta}`;
        spawnMoneyPop(data.toPos, data.moneyDelta, data.team);
        sound = 'correct';
        break;
      case 'skipped':
        msg = `🏛 ${escapeHtml(data.playerName)} estaba en la cárcel — turno perdido`;
        break;
      default:
        msg = `${teamEmoji} ${escapeHtml(data.playerName)} llegó a ${tile.name}`;
    }
    setRecentEvent(msg);
    if (sound && MochiSounds[sound]) MochiSounds[sound]();
  }

  function spawnMoneyPop(tilePos, delta, team) {
    const slot = $('mp-tokens-' + tilePos);
    if (!slot) return;
    const layer = $('mp-fx-layer');
    if (!layer) return;
    const pop = document.createElement('div');
    pop.className = 'mp-money-pop ' + (delta >= 0 ? 'gain' : 'loss');
    pop.textContent = (delta >= 0 ? '+' : '') + '¥' + Math.abs(delta);
    const r = slot.getBoundingClientRect();
    const lr = layer.getBoundingClientRect();
    pop.style.left = ((r.left + r.width / 2) - lr.left) + 'px';
    pop.style.top  = ((r.top  + r.height / 2) - lr.top)  + 'px';
    layer.appendChild(pop);
    setTimeout(() => pop.remove(), 1500);
  }

  function refreshOwnership() {
    tiles.forEach((t) => {
      const tEl = $('mp-tile-' + t.id);
      if (!tEl) return;
      const existing = tEl.querySelector('.mp-tile-owner');
      const owner = ownership[t.id];
      if (existing) existing.remove();
      if (owner) {
        const d = document.createElement('div');
        d.className = 'mp-tile-owner ' + owner;
        tEl.appendChild(d);
      }
    });
  }

  function showDice(n) {
    const dice = $('mp-dice');
    if (!dice) return;
    dice.textContent = '🎲 ' + n;
    dice.classList.remove('show');
    void dice.offsetWidth;
    dice.classList.add('show');
  }

  function setRecentEvent(text) {
    const el = $('mp-recent-event');
    if (!el) return;
    el.innerHTML = text;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }

  function updateWealthDisplay() {
    if ($('wealth-red'))  $('wealth-red').textContent  = scores.red  || 0;
    if ($('wealth-gold')) $('wealth-gold').textContent = scores.gold || 0;
  }

  // Top-5 live leaderboard inside the board center — Monopoly-style ranking
  // that updates every time a player completes a move. Sorted by wealth.
  function renderLiveLeaderboard() {
    const lb = $('mp-leaderboard');
    if (!lb) return;
    const ranked = Object.entries(players)
      .map(([id, p]) => ({ id, name: p.name, team: p.team, money: p.money || 0 }))
      .sort((a, b) => b.money - a.money)
      .slice(0, 5);
    lb.innerHTML = ranked.map((p, i) => {
      const medal = ['🥇', '🥈', '🥉'][i] || `#${i + 1}`;
      const teamEmoji = p.team === 'red' ? '🐉' : '🐲';
      return `<div class="mp-lb-row ${p.team}">
        <span class="mp-lb-rank">${medal}</span>
        <span class="mp-lb-name">${teamEmoji} ${escapeHtml(p.name)}</span>
        <span class="mp-lb-cash">¥${p.money}</span>
      </div>`;
    }).join('');
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
      const teamEmoji = p.team === 'red' ? '🐉' : '🐲';
      row.innerHTML = `
        <span class="lb-rank">${medal}</span>
        <span class="lb-name">${p.avatar ? p.avatar + " " : ""}${teamEmoji} ${escapeHtml(p.name)}</span>
        <span class="lb-score">¥${p.score}</span>
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
      c.textContent = ['💰', '🏯', '🐉', '🧧', '✨'][i % 5];
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

  socket.on('disconnect', () => console.log('[host-monopoly] disconnected'));
  socket.on('connect', () => console.log('[host-monopoly] connected'));
  socket.on('host-left', () => console.warn('[host-monopoly] host-left'));
})();
