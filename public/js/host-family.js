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

  // === BRICK CONSTRUCTION STATE ===
  // Each placement = +1 brick. We track per-team brick counts so the wall
  // foundation fills in and the roof gets new decorations at milestones.
  const FM_WALL_CAPACITY = 30;           // bricks per row at full house
  const FM_ROOF_MILESTONES = [
    { at: 4,  emoji: '🪟', label: 'ventana' },
    { at: 8,  emoji: '🚪', label: 'puerta' },
    { at: 12, emoji: '🪴', label: 'planta' },
    { at: 16, emoji: '🌳', label: 'árbol' },
    { at: 20, emoji: '🏮', label: 'lámpara' },
    { at: 24, emoji: '🐦', label: 'pájaro' },
    { at: 28, emoji: '☀️', label: 'sol' },
  ];
  let bricksRed = 0;
  let bricksGold = 0;

  socket.on('fm:init', (data) => {
    scores = data.teamScores || { red: 0, gold: 0 };
    gameOver = false;
    bricksRed = bricksGold = 0;
    clearHouses();
    resetBrickWalls();
    updateScores();
    startAmbientCritters();
  });

  // A player placed a token into a room — animate it landing + show +1 pop
  // + flash a combo banner if any combos unlocked from this placement.
  socket.on('fm:placed', ({ team, room, token, teamScores, combos }) => {
    if (teamScores) { scores = teamScores; updateScores(); }
    const slot = $(`fm-${team}-${room}`);
    const roomEl = slot && slot.closest('.fm-room');
    if (slot) {
      const item = document.createElement('span');
      item.className = 'fm-item';
      item.textContent = token.emoji;
      item.title = token.name;
      slot.appendChild(item);
      // +1 popup over the room (or +bonus if combos unlocked)
      if (roomEl) spawnRoomPop(roomEl, '+1');
    }
    // Room WAKES UP — flash + scale pulse so the placement reads as a beat
    if (roomEl) {
      roomEl.classList.remove('fm-room-celebrate');
      void roomEl.offsetWidth;
      roomEl.classList.add('fm-room-celebrate');
      setTimeout(() => roomEl.classList.remove('fm-room-celebrate'), 900);
      // Each room type spawns its own ambient particle on placement
      spawnRoomAmbient(roomEl, room);
    }
    // === Lay a brick === Each placement adds one brick to the team's wall +
    // bumps the counter. At milestones, the house roof grows a new decoration.
    layBrick(team);
    MochiSounds.populate && MochiSounds.populate(team);
    // Combo celebration — bigger pop, banner across the host + full-screen
    // flash for big-bonus combos (≥10) so the moment feels earned.
    if (Array.isArray(combos) && combos.length > 0) {
      combos.forEach((c) => spawnComboBanner(team, c));
      MochiSounds.winFanfare && MochiSounds.winFanfare();
      const biggest = combos.reduce((m, c) => Math.max(m, c.bonus || 0), 0);
      if (biggest >= 10) spawnComboFullscreen(team, combos[0], biggest);
    }
  });

  function spawnRoomPop(roomEl, text) {
    const pop = document.createElement('div');
    pop.className = 'fm-room-pop';
    pop.textContent = text;
    roomEl.appendChild(pop);
    setTimeout(() => pop.remove(), 900);
  }

  // Per-room-type ambient particle when an item is placed — gives each room
  // its own personality. Sala = 📺/sparkle, Cocina = 🍳/steam, Dormitorio =
  // 💤, Jardín = 🦋/leaves.
  function spawnRoomAmbient(roomEl, room) {
    const banks = {
      sala:       ['✨', '📺', '🎵', '☕'],
      cocina:     ['💨', '🍳', '🥢', '✨'],
      dormitorio: ['💤', '🌙', '✨', '⭐'],
      jardin:     ['🦋', '🌸', '🍃', '🐝'],
    };
    const icons = banks[room] || ['✨'];
    for (let i = 0; i < 4; i++) {
      const p = document.createElement('div');
      p.className = 'fm-room-ambient';
      p.textContent = icons[Math.floor(Math.random() * icons.length)];
      p.style.left = (10 + Math.random() * 80) + '%';
      p.style.animationDelay = (i * 80) + 'ms';
      roomEl.appendChild(p);
      setTimeout(() => p.remove(), 1400);
    }
  }

  function spawnComboBanner(team, combo) {
    const houseEl = $('fm-house-' + team);
    if (!houseEl) return;
    const banner = document.createElement('div');
    banner.className = 'fm-combo-banner-host ' + team;
    banner.innerHTML = `<span class="fm-combo-emoji">${combo.emoji}</span><span class="fm-combo-name">${combo.name}</span><span class="fm-combo-bonus">+${combo.bonus}</span>`;
    houseEl.appendChild(banner);
    setTimeout(() => banner.remove(), 2200);
  }

  // === BRICK CONSTRUCTION HELPERS ===
  // Each placement lays one visible brick on the team's foundation wall +
  // bumps the brick counter. At milestone counts, the house gets a new
  // roof decoration (window, door, plant, tree, lantern, bird, sun).
  function resetBrickWalls() {
    ['red', 'gold'].forEach((team) => {
      const wall = $('fm-brick-wall-' + team);
      if (wall) wall.innerHTML = '';
      const decor = $('fm-roof-decor-' + team);
      if (decor) decor.innerHTML = '';
      const num = $('fm-bricks-num-' + team);
      if (num) num.textContent = '0';
    });
  }

  function layBrick(team) {
    const count = team === 'red' ? (bricksRed = bricksRed + 1) : (bricksGold = bricksGold + 1);
    const wall = $('fm-brick-wall-' + team);
    const num  = $('fm-bricks-num-' + team);
    if (num) num.textContent = count;
    if (wall && count <= FM_WALL_CAPACITY) {
      const brick = document.createElement('div');
      brick.className = 'fm-brick';
      brick.style.left = ((count - 1) * (100 / FM_WALL_CAPACITY)) + '%';
      // Slight offset so bricks read like a real wall pattern, not a flat strip
      brick.style.bottom = ((count % 2 === 0) ? '0px' : '10px');
      wall.appendChild(brick);
    }
    // Roof decoration unlocked? Add it to the roof decor strip
    const milestone = FM_ROOF_MILESTONES.find((m) => m.at === count);
    if (milestone) {
      const decor = $('fm-roof-decor-' + team);
      if (decor) {
        const d = document.createElement('div');
        d.className = 'fm-roof-decor-item';
        d.textContent = milestone.emoji;
        d.title = milestone.label;
        decor.appendChild(d);
      }
      // Big celebration toast for the unlock
      const houseEl = $('fm-house-' + team);
      if (houseEl) {
        const t = document.createElement('div');
        t.className = 'fm-milestone-toast';
        t.innerHTML = `<span>${milestone.emoji}</span><span>¡${count} ladrillos! Nueva ${milestone.label}</span>`;
        houseEl.appendChild(t);
        setTimeout(() => t.remove(), 2000);
      }
      MochiSounds.winFanfare && MochiSounds.winFanfare();
    }
    // Brick-lay "drop in" particle right under the room that received the
    // placement — feels physical, like a brick was actually laid.
    spawnBrickLayFx(team);
  }

  function spawnBrickLayFx(team) {
    const houseEl = $('fm-house-' + team);
    if (!houseEl) return;
    const fx = document.createElement('div');
    fx.className = 'fm-brick-lay-fx';
    fx.textContent = '🧱';
    fx.style.left = (15 + Math.random() * 70) + '%';
    houseEl.appendChild(fx);
    setTimeout(() => fx.remove(), 900);
  }

  // === AMBIENT CRITTERS — birds, butterflies, doorbell guests ===
  // Adds cozy "alive house" vibes without distracting from gameplay.
  let ambientTimer = null;
  function startAmbientCritters() {
    if (ambientTimer) clearInterval(ambientTimer);
    ambientTimer = setInterval(() => {
      if (Math.random() < 0.5) spawnCritter();
    }, 4500);
  }
  function spawnCritter() {
    const layer = $('fm-critters');
    if (!layer) return;
    const kinds = [
      { icon: '🐦', cls: 'bird',      duration: 5500 },
      { icon: '🦋', cls: 'butterfly', duration: 6500 },
      { icon: '🐝', cls: 'butterfly', duration: 6000 },
      { icon: '🪁', cls: 'bird',      duration: 6500 },
    ];
    const k = kinds[Math.floor(Math.random() * kinds.length)];
    const c = document.createElement('div');
    c.className = 'fm-critter ' + k.cls;
    c.textContent = k.icon;
    c.style.top = (15 + Math.random() * 35) + '%';
    layer.appendChild(c);
    setTimeout(() => c.remove(), k.duration);
  }

  // Big combo (≥10 bonus) — full-screen flash + confetti, like the
  // "the team just scored something massive" vibe in a real game.
  function spawnComboFullscreen(team, combo, bonus) {
    const layer = document.createElement('div');
    layer.className = 'fm-combo-fullscreen ' + team;
    layer.innerHTML = `
      <div class="fm-combo-fs-burst"></div>
      <div class="fm-combo-fs-icon">${combo.emoji}</div>
      <div class="fm-combo-fs-name">${combo.name}</div>
      <div class="fm-combo-fs-bonus">+${bonus}</div>
    `;
    document.body.appendChild(layer);
    // Confetti burst from the layer's bottom edge
    for (let i = 0; i < 30; i++) {
      const c = document.createElement('div');
      c.className = 'fm-combo-confetti';
      c.textContent = ['🎉', '🎊', '✨', '🧧', '🏡'][i % 5];
      c.style.left = (Math.random() * 100) + '%';
      c.style.animationDelay = (Math.random() * 800) + 'ms';
      c.style.animationDuration = (1.6 + Math.random() * 1.2) + 's';
      layer.appendChild(c);
    }
    setTimeout(() => layer.remove(), 2600);
  }

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
