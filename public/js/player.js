(function () {
  const socket = io();
  let pin = null;
  let team = null;
  let myName = '';
  let currentQid = null;
  let mashEndTime = 0;
  let mashTimerInterval = null;
  let mashTapHandler = null;
  let myScore = 0;
  let myPlayerId = null;
  let gameType = 'mochi-mash';
  // Color Splash state
  let csGridW = 24;
  let csGridH = 14;
  let csGrid = [];
  let csPlayers = {};
  let csMyX = 0;
  let csMyY = 0;
  let csWalkEndTime = 0;
  let csWalkTimerInterval = null;
  let csTilesPainted = 0;
  // Color Clash state
  let ccEnergy = 50;
  let ccDpadHandlerBound = false;

  const $ = (id) => document.getElementById(id);

  const SHAPES = ['▲', '◆', '●', '■'];

  // Mute toggle
  $('mute-btn').addEventListener('click', () => {
    const muted = window.toggleMute();
    $('mute-btn').textContent = muted ? '🔇 Off' : '🔊 On';
  });

  // Auto-rejoin on socket reconnect (handles phone sleep, network blips, tab switches)
  function showReconnectOverlay(message) {
    let el = document.getElementById('reconnect-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'reconnect-overlay';
      el.className = 'reconnect-overlay';
      el.innerHTML = '<div class="reconnect-spinner">🐉</div><div class="reconnect-text"></div>';
      document.body.appendChild(el);
    }
    el.querySelector('.reconnect-text').textContent = message || 'Reconnecting...';
    el.classList.remove('hidden');
  }
  function hideReconnectOverlay() {
    const el = document.getElementById('reconnect-overlay');
    if (el) el.classList.add('hidden');
  }
  socket.on('disconnect', (reason) => {
    if (pin && myName) showReconnectOverlay('Reconnecting...');
  });
  socket.on('connect', () => {
    // On any reconnect (after the first), re-emit player:join with stored credentials
    if (pin && myName) {
      socket.emit('player:join', { pin, name: myName }, (resp) => {
        if (resp.ok) {
          myPlayerId = resp.playerId; // new socket id after reconnect
          team = resp.team;
          if (resp.gameType) gameType = resp.gameType;
          hideReconnectOverlay();
          // If they were re-attached during an active game, server will send them
          // their cs:init / question event automatically. Player UI catches up.
        } else {
          showReconnectOverlay(resp.error || 'Could not rejoin');
        }
      });
    }
  });
  socket.on('connect_error', () => {
    if (pin && myName) showReconnectOverlay('Reconnecting...');
  });

  // Unlock audio on first tap
  document.addEventListener('click', () => window.unlockAudio && window.unlockAudio(), { once: true });
  document.addEventListener('touchstart', () => window.unlockAudio && window.unlockAudio(), { once: true });

  // Pre-fill PIN + name from URL (e.g., from home page or rematch link)
  const params = new URLSearchParams(location.search);
  const urlPin = params.get('pin');
  const urlName = params.get('name');
  const urlAutojoin = params.get('autojoin') === '1';
  if (urlPin) $('pin-input').value = urlPin;
  if (urlName) $('name-input').value = urlName;
  if (urlPin && urlName && urlAutojoin) {
    // Auto-fire join
    setTimeout(tryJoin, 50);
  } else if (urlPin) {
    $('name-input').focus();
  }

  $('join-btn').addEventListener('click', tryJoin);
  $('name-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryJoin(); });
  $('pin-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('name-input').focus(); });

  function tryJoin() {
    const p = $('pin-input').value.trim();
    const name = $('name-input').value.trim();
    if (!p || !name) {
      $('join-error').textContent = 'Enter PIN and name';
      return;
    }
    socket.emit('player:join', { pin: p, name }, (resp) => {
      if (!resp.ok) {
        $('join-error').textContent = resp.error || 'Could not join';
        MochiSounds.wrong();
        return;
      }
      pin = p;
      team = resp.team;
      myName = name;
      myPlayerId = resp.playerId;
      gameType = resp.gameType || 'mochi-mash';
      // Remember this game for the Rematch button on the home page
      try {
        localStorage.setItem('dralyLastJoin', JSON.stringify({ pin: p, name, ts: Date.now() }));
      } catch (e) { /* ignore */ }
      if (gameType === 'color-splash' || gameType === 'color-clash') {
        csGridW = resp.gridW || 24;
        csGridH = resp.gridH || 14;
        csMyX = resp.x || 0;
        csMyY = resp.y || 0;
      }
      if (gameType === 'color-clash') {
        ccEnergy = resp.energy || 50;
      }
      $('join-error').textContent = '';
      MochiSounds.join();
      enterLobby();
    });
  }

  function enterLobby() {
    $('lobby-name').textContent = myName;
    updateTeamUI();
    showScreen('lobby');
  }

  function updateTeamUI() {
    const isRed = team === 'red';
    // Lobby title varies by game type
    let teamLabel, teamMascot;
    if (gameType === 'color-clash') {
      teamLabel = isRed ? 'Team Lantern 紅燈籠' : 'Team Dumpling 餃子';
      teamMascot = isRed ? '🏮' : '🥟';
    } else if (gameType === 'color-splash') {
      teamLabel = isRed ? 'Team Crimson 紅' : 'Team Sunburst 金';
      teamMascot = isRed ? '🎨' : '🖌️';
    } else {
      teamLabel = isRed ? 'Team Panda 紅' : 'Team Kitsune 金';
      teamMascot = isRed ? '🐼' : '🦊';
    }
    if ($('lobby-mascot')) $('lobby-mascot').textContent = teamMascot;
    if ($('lobby-team-name')) {
      $('lobby-team-name').textContent = teamLabel;
      $('lobby-team-name').style.color = isRed ? 'var(--red-glow)' : 'var(--gold-glow)';
    }
    if ($('player-header')) $('player-header').className = `player-header ${team}`;
    if ($('mash-header')) $('mash-header').className = `player-header ${team}`;
    if ($('player-name-tag')) $('player-name-tag').textContent = myName;
    if ($('mash-name-tag')) $('mash-name-tag').textContent = myName;
    const mashBtn = $('mash-button');
    if (mashBtn) {
      mashBtn.classList.remove('red', 'gold');
      mashBtn.classList.add(team);
    }
    if ($('mash-mascot')) {
      $('mash-mascot').textContent = isRed ? '🐼' : '🦊';
    }
    // Color Clash team tag
    if ($('cc-team-tag')) {
      $('cc-team-tag').className = `cc-hud-tag ${team}`;
      $('cc-team-tag').textContent = isRed ? '🏮 Lantern' : '🥟 Dumpling';
    }
  }

  socket.on('team-changed', ({ team: newTeam }) => {
    team = newTeam;
    updateTeamUI();
    MochiSounds.swap();
  });

  socket.on('countdown', () => {
    showScreen('countdown');
    MochiSounds.startMusic();
    // Independent random Dralingo appearances on each player's phone
    Dralingo.startRandom({
      minMs: 25000,
      maxMs: 50000,
      isActive: () => true
    });
    // Color Clash: after the countdown ends, drop straight into the play screen
    // (other games wait for the first question event to arrive)
    if (gameType === 'color-clash') {
      setTimeout(() => {
        showScreen('cc-play');
        bindCcDpad();
        updateCcEnergyDisplay();
      }, 3500);
    }
    let n = 3;
    const numEl = $('player-countdown-num');
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
        // Question will arrive from server
      }
    };
    tick();
  });

  socket.on('question', (q) => {
    currentQid = q.qid;
    $('question-text').textContent = q.text;
    // Show image (or placeholder while loading)
    const imgWrap = $('question-image-wrap');
    const img = $('question-image');
    const loader = imgWrap.querySelector('.img-loading');
    if (q.image) {
      img.style.display = 'none';
      loader.style.display = 'flex';
      img.onload = () => {
        img.style.display = 'block';
        loader.style.display = 'none';
      };
      img.onerror = () => {
        loader.textContent = '📚';
      };
      img.src = q.image;
      imgWrap.style.display = 'flex';
    } else {
      imgWrap.style.display = 'none';
    }
    const ansEl = $('answers');
    ansEl.innerHTML = '';
    q.answers.forEach((a, i) => {
      const btn = document.createElement('button');
      btn.className = 'answer-btn';
      btn.innerHTML = `<span class="answer-shape shape-${i}">${SHAPES[i]}</span><span>${escapeHtml(a)}</span>`;
      btn.addEventListener('click', () => {
        socket.emit('player:answer', { pin, qid: currentQid, choiceIdx: i });
        document.querySelectorAll('.answer-btn').forEach((b) => b.disabled = true);
        btn.style.outline = '3px solid var(--ink)';
      });
      ansEl.appendChild(btn);
    });
    showScreen('question');
  });

  socket.on('answer-result', ({ correct, mashUntil, walkUntil, energy, correctText }) => {
    if (correct) {
      MochiSounds.correct();
      let happyMascot, sub;
      if (gameType === 'color-clash') {
        happyMascot = team === 'red' ? '🏮' : '🥟';
        sub = `+30 energy! ⚡`;
      } else if (gameType === 'color-splash') {
        happyMascot = team === 'red' ? '🎨' : '🖌️';
        sub = 'Walk and paint! ⚡';
      } else {
        happyMascot = team === 'red' ? '🐼' : '🦊';
        sub = 'Feed your team! ⚡';
      }
      showResultFeedback({
        mascot: happyMascot,
        mascotCls: 'happy',
        title: 'Correct!',
        sub,
        cls: 'correct'
      });
      burstSparkles('✨', 12);
      if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
      setTimeout(() => {
        if (gameType === 'color-clash') {
          if (typeof energy === 'number') ccEnergy = energy;
          showScreen('cc-play');
          updateCcEnergyDisplay();
        } else if (gameType === 'color-splash') {
          csWalkEndTime = walkUntil;
          startWalk();
        } else {
          mashEndTime = mashUntil;
          startMash();
        }
      }, 900);
    } else {
      MochiSounds.wrong();
      showResultFeedback({
        mascot: '💢',
        mascotCls: 'angry',
        title: 'Wrong!',
        sub: `Answer: ${escapeHtml(correctText || '')}`,
        cls: 'wrong'
      });
      if (navigator.vibrate) navigator.vibrate([100, 30, 100]);
      if (gameType === 'color-clash') {
        setTimeout(() => {
          if (typeof energy === 'number') ccEnergy = energy;
          showScreen('cc-play');
          updateCcEnergyDisplay();
        }, 1400);
      }
    }
  });

  function showResultFeedback({ mascot, mascotCls, title, sub, cls }) {
    $('result-feedback').innerHTML = `
      <div class="big-mascot ${mascotCls}">${mascot}</div>
      <h2 class="${cls}">${title}</h2>
      <p style="color:var(--ink-dim);">${sub || ''}</p>
    `;
    showScreen('result');
  }

  function burstSparkles(symbol, count) {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    for (let i = 0; i < count; i++) {
      const s = document.createElement('div');
      s.className = 'sparkle';
      s.textContent = symbol;
      const angle = (i / count) * Math.PI * 2;
      const dist = 80 + Math.random() * 80;
      s.style.left = cx + 'px';
      s.style.top = cy + 'px';
      s.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
      s.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
      s.style.setProperty('--rot', (Math.random() * 720) + 'deg');
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 900);
    }
  }

  function startMash() {
    showScreen('mash');
    const mashBtn = $('mash-button');
    let localTaps = 0;

    // Reset button state
    mashBtn.classList.remove('combo', 'idle', 'tapped');
    $('mash-counter').textContent = '+0';
    $('mash-timer-fill').style.width = '100%';

    // Clean up any previous handlers
    if (mashTapHandler) {
      mashBtn.removeEventListener('pointerdown', mashTapHandler);
      mashTapHandler = null;
    }

    function endMash() {
      mashBtn.classList.add('idle');
      mashBtn.classList.remove('combo');
      if (mashTapHandler) {
        mashBtn.removeEventListener('pointerdown', mashTapHandler);
        mashTapHandler = null;
      }
      if (mashTimerInterval) {
        clearInterval(mashTimerInterval);
        mashTimerInterval = null;
      }
    }

    mashTapHandler = (e) => {
      e.preventDefault();
      if (Date.now() > mashEndTime) {
        endMash();
        return;
      }
      // Immediate visual + haptic feedback (no network wait)
      mashBtn.classList.add('tapped');
      setTimeout(() => mashBtn.classList.remove('tapped'), 60);
      if (navigator.vibrate) navigator.vibrate(15);
      MochiSounds.tap();
      // Optimistic local counter
      localTaps++;
      $('mash-counter').textContent = `+${localTaps}`;
      // Send to server
      socket.emit('player:tap', { pin });
      // Spawn a dumpling at tap position
      spawnDumpling({ clientX: e.clientX, clientY: e.clientY });
    };

    mashBtn.addEventListener('pointerdown', mashTapHandler);

    if (mashTimerInterval) clearInterval(mashTimerInterval);
    const totalDur = mashEndTime - Date.now();
    mashTimerInterval = setInterval(() => {
      const remaining = Math.max(0, mashEndTime - Date.now());
      const pct = (remaining / totalDur) * 100;
      $('mash-timer-fill').style.width = pct + '%';
      if (remaining <= 0) {
        endMash();
      }
    }, 50);
  }

  // === COLOR CLASH ===
  socket.on('cc:energy', ({ energy }) => {
    ccEnergy = energy;
    updateCcEnergyDisplay();
  });

  function updateCcEnergyDisplay() {
    const fill = $('cc-energy-fill');
    const num = $('cc-energy-num');
    if (!fill) return;
    // Energy meter caps visually at 30 (since we start at 20, +12 per answer ≈ ~32 max usually)
    const pct = Math.max(0, Math.min(100, (ccEnergy / 30) * 100));
    fill.style.width = pct + '%';
    num.textContent = ccEnergy;
    const dpad = $('cc-dpad');
    const answerBtn = $('cc-answer-btn');
    if (ccEnergy < 1) {
      if (dpad) dpad.classList.add('idle');
      if (answerBtn) answerBtn.classList.add('pulsing');
      showLowEnergyBanner();
    } else {
      if (dpad) dpad.classList.remove('idle');
      if (answerBtn) answerBtn.classList.remove('pulsing');
      hideLowEnergyBanner();
    }
  }

  function showLowEnergyBanner() {
    if (document.getElementById('cc-low-energy-banner')) return;
    const b = document.createElement('div');
    b.id = 'cc-low-energy-banner';
    b.className = 'cc-low-energy';
    b.textContent = '⚡ Out of energy! Answer questions to recharge';
    document.body.appendChild(b);
  }
  function hideLowEnergyBanner() {
    const b = document.getElementById('cc-low-energy-banner');
    if (b) b.remove();
  }

  function bindCcDpad() {
    if (ccDpadHandlerBound) return;
    ccDpadHandlerBound = true;
    const dirs = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    let heldDir = null;
    let holdTimer = null;
    function move(dir) {
      const d = dirs[dir];
      if (!d) return;
      if (ccEnergy < 1) return;
      if (navigator.vibrate) navigator.vibrate(8);
      MochiSounds.step();
      socket.emit('player:cc-move', { pin, dx: d[0], dy: d[1] });
    }
    document.querySelectorAll('.cs-dpad-btn[data-cc-dir]').forEach((btn) => {
      const dir = btn.dataset.ccDir;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        btn.classList.add('pressed');
        heldDir = dir;
        move(dir);
        if (holdTimer) clearInterval(holdTimer);
        holdTimer = setInterval(() => { if (heldDir === dir) move(dir); }, 130);
      });
      const release = () => {
        btn.classList.remove('pressed');
        if (heldDir === dir) {
          heldDir = null;
          if (holdTimer) clearInterval(holdTimer);
          holdTimer = null;
        }
      };
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointerleave', release);
      btn.addEventListener('pointercancel', release);
    });
    // Keyboard support too
    const keyMap = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', a: 'left', s: 'down', d: 'right' };
    document.addEventListener('keydown', (e) => {
      if (gameType !== 'color-clash') return;
      const dir = keyMap[e.key];
      if (!dir) return;
      e.preventDefault();
      move(dir);
    });
    // Answer button — robust pointer + click handler with dedupe
    const answerBtn = $('cc-answer-btn');
    if (answerBtn) {
      let lastFire = 0;
      const handleAnswer = (e) => {
        const now = Date.now();
        if (now - lastFire < 250) return;
        lastFire = now;
        if (e) e.preventDefault();
        answerBtn.classList.add('pressed');
        setTimeout(() => answerBtn.classList.remove('pressed'), 180);
        if (navigator.vibrate) navigator.vibrate(20);
        MochiSounds.tick();
        socket.emit('player:request-question', { pin });
      };
      answerBtn.addEventListener('click', handleAnswer);
      answerBtn.addEventListener('touchstart', handleAnswer, { passive: false });
    }
  }

  // === COLOR SPLASH and COLOR CLASH (shared map renderer) ===
  // Picks the right DOM containers depending on which game we're in
  function miniGridEl() {
    return gameType === 'color-clash' ? $('cc-mini-grid') : $('cs-mini-grid');
  }
  function miniPlayersEl() {
    return gameType === 'color-clash' ? $('cc-mini-players') : $('cs-mini-players');
  }

  socket.on('cs:init', (data) => {
    csGridW = data.gridW;
    csGridH = data.gridH;
    csPlayers = data.players;
    if (csPlayers[myPlayerId]) {
      csMyX = csPlayers[myPlayerId].x;
      csMyY = csPlayers[myPlayerId].y;
    }
    csTilesPainted = 0;
    buildMiniGrid();
    initMiniPlayers();
  });

  socket.on('cs:move', ({ playerId, x, y, paint, teamScores }) => {
    if (csPlayers[playerId]) {
      csPlayers[playerId].x = x;
      csPlayers[playerId].y = y;
    }
    if (playerId === myPlayerId) {
      csMyX = x;
      csMyY = y;
    }
    moveMiniPlayer(playerId, x, y);
    if (paint) {
      paintMiniCell(paint.x, paint.y, paint.team);
      if (playerId === myPlayerId && paint.team === team) {
        csTilesPainted++;
        if (gameType === 'color-splash' && $('cs-walk-score')) {
          $('cs-walk-score').textContent = csTilesPainted;
        }
      }
    }
  });

  socket.on('cs:paint', ({ cells }) => {
    cells.forEach((c) => paintMiniCell(c.x, c.y, c.team));
  });

  function getMiniCellSize() {
    const screenW = Math.min(window.innerWidth - 40, 520);
    return Math.max(8, Math.floor((screenW - 16) / csGridW) - 1);
  }
  function miniIdPrefix() {
    return gameType === 'color-clash' ? 'cc-mini' : 'cs-mini';
  }

  function buildMiniGrid() {
    const grid = miniGridEl();
    if (!grid) return;
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = `repeat(${csGridW}, 1fr)`;
    const cellSize = getMiniCellSize();
    document.documentElement.style.setProperty('--cs-mini-cell', cellSize + 'px');
    const prefix = miniIdPrefix();
    for (let y = 0; y < csGridH; y++) {
      for (let x = 0; x < csGridW; x++) {
        const cell = document.createElement('div');
        cell.className = 'cs-cell';
        cell.id = `${prefix}-cell-${x}-${y}`;
        cell.style.minWidth = cellSize + 'px';
        cell.style.minHeight = cellSize + 'px';
        grid.appendChild(cell);
      }
    }
    const wrap = miniPlayersEl();
    if (wrap) {
      wrap.style.width = (cellSize * csGridW + (csGridW - 1)) + 'px';
      wrap.style.height = (cellSize * csGridH + (csGridH - 1)) + 'px';
    }
  }

  function initMiniPlayers() {
    const wrap = miniPlayersEl();
    if (!wrap) return;
    wrap.innerHTML = '';
    const prefix = miniIdPrefix();
    Object.entries(csPlayers).forEach(([id, p]) => {
      const el = document.createElement('div');
      el.className = `cs-player ${p.team}`;
      el.id = `${prefix}-player-${id}`;
      const cellSize = getMiniCellSize();
      el.style.width = cellSize + 'px';
      el.style.height = cellSize + 'px';
      el.style.fontSize = Math.max(8, cellSize - 2) + 'px';
      const isMe = id === myPlayerId;
      let emoji;
      if (gameType === 'color-clash') {
        emoji = isMe ? '🌟' : (p.team === 'red' ? '🏮' : '🥟');
      } else {
        emoji = isMe ? '🌟' : (p.team === 'red' ? '🎨' : '🖌️');
      }
      el.innerHTML = `<span class="cs-player-emoji">${emoji}</span>`;
      moveMiniPlayer(id, p.x, p.y);
      wrap.appendChild(el);
    });
  }

  function moveMiniPlayer(playerId, x, y) {
    const prefix = miniIdPrefix();
    const el = document.getElementById(`${prefix}-player-${playerId}`);
    if (!el) return;
    const cellSize = getMiniCellSize();
    el.style.left = (x * (cellSize + 1)) + 'px';
    el.style.top = (y * (cellSize + 1)) + 'px';
  }

  function paintMiniCell(x, y, team) {
    const prefix = miniIdPrefix();
    const cell = document.getElementById(`${prefix}-cell-${x}-${y}`);
    if (!cell) return;
    cell.classList.remove('red', 'gold', 'fresh');
    cell.classList.add(team, 'fresh');
    setTimeout(() => cell.classList.remove('fresh'), 500);
  }

  function startWalk() {
    showScreen('cs-walk');
    csTilesPainted = 0;
    $('cs-walk-score').textContent = '0';
    $('cs-walk-name-tag').textContent = myName;
    $('cs-walk-header').className = `player-header ${team}`;
    $('cs-walk-timer-fill').style.width = '100%';
    const dpad = $('cs-dpad');
    dpad.classList.remove('idle');

    if (csWalkTimerInterval) clearInterval(csWalkTimerInterval);
    const totalDur = csWalkEndTime - Date.now();
    csWalkTimerInterval = setInterval(() => {
      const remaining = Math.max(0, csWalkEndTime - Date.now());
      const pct = (remaining / totalDur) * 100;
      $('cs-walk-timer-fill').style.width = pct + '%';
      if (remaining <= 0) {
        clearInterval(csWalkTimerInterval);
        dpad.classList.add('idle');
      }
    }, 50);
  }

  // D-pad — bind once on load
  function bindDpad() {
    const dirs = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    let heldDir = null;
    let holdTimer = null;

    function move(dir) {
      const d = dirs[dir];
      if (!d) return;
      if (Date.now() > csWalkEndTime) return;
      if (navigator.vibrate) navigator.vibrate(10);
      MochiSounds.step();
      socket.emit('player:move', { pin, dx: d[0], dy: d[1] });
    }

    document.querySelectorAll('.cs-dpad-btn[data-dir]').forEach((btn) => {
      const dir = btn.dataset.dir;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        btn.classList.add('pressed');
        heldDir = dir;
        move(dir);
        // Auto-repeat while held
        if (holdTimer) clearInterval(holdTimer);
        holdTimer = setInterval(() => {
          if (heldDir === dir) move(dir);
        }, 140);
      });
      const release = () => {
        btn.classList.remove('pressed');
        if (heldDir === dir) {
          heldDir = null;
          if (holdTimer) clearInterval(holdTimer);
          holdTimer = null;
        }
      };
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointerleave', release);
      btn.addEventListener('pointercancel', release);
    });

    // Keyboard support
    const keyMap = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', a: 'left', s: 'down', d: 'right' };
    document.addEventListener('keydown', (e) => {
      const dir = keyMap[e.key];
      if (!dir || gameType !== 'color-splash') return;
      if (Date.now() > csWalkEndTime) return;
      e.preventDefault();
      move(dir);
    });
  }
  bindDpad();

  socket.on('tap-ack', ({ points, combo, score }) => {
    myScore = score;
    $('player-score').textContent = myScore;
    $('mash-score').textContent = myScore;
    if (combo) {
      $('mash-button').classList.add('combo');
      if (Math.random() < 0.15) {
        showComboBanner();
        MochiSounds.combo();
      }
    } else {
      $('mash-button').classList.remove('combo');
    }
  });

  function showComboBanner() {
    const banner = document.createElement('div');
    banner.className = 'combo-banner';
    banner.textContent = ['NICE!', 'COMBO!', 'FIRE!', 'MASH!'][Math.floor(Math.random() * 4)];
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 600);
  }

  function spawnDumpling(touchOrEvt) {
    const d = document.createElement('div');
    d.className = 'dumpling';
    d.textContent = ['🥮', '🍡', '🥟'][Math.floor(Math.random() * 3)];
    let x, y;
    if (touchOrEvt && touchOrEvt.clientX !== undefined) {
      x = touchOrEvt.clientX;
      y = touchOrEvt.clientY;
    } else {
      const rect = $('mash-button').getBoundingClientRect();
      x = rect.left + rect.width / 2 + (Math.random() - 0.5) * rect.width * 0.6;
      y = rect.top + rect.height / 2 + (Math.random() - 0.5) * rect.height * 0.6;
    }
    d.style.left = x + 'px';
    d.style.top = y + 'px';
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 850);
  }

  socket.on('game-end', (data) => {
    MochiSounds.stopMusic();
    Dralingo.stopRandom();
    if (mashTimerInterval) clearInterval(mashTimerInterval);
    if (csWalkTimerInterval) clearInterval(csWalkTimerInterval);
    if (mashTapHandler) {
      $('mash-button').removeEventListener('pointerdown', mashTapHandler);
      mashTapHandler = null;
    }
    const myTeamScore = data.teamScores[team];
    const enemyScore = data.teamScores[team === 'red' ? 'gold' : 'red'];
    const won = myTeamScore > enemyScore;
    const tie = myTeamScore === enemyScore;
    $('end-team-score').textContent = myTeamScore;
    $('end-personal-score').textContent = myScore;
    if (tie) {
      $('end-emoji').textContent = '🤝';
      $('end-banner').textContent = 'Tie Battle!';
      $('end-banner').className = 'winner-banner tie';
      MochiSounds.lose();
    } else if (won) {
      $('end-emoji').textContent = team === 'red' ? '🐼' : '🦊';
      $('end-banner').textContent = 'Victory!';
      $('end-banner').className = `winner-banner ${team}`;
      MochiSounds.win();
    } else {
      $('end-emoji').textContent = '💔';
      $('end-banner').textContent = 'Defeat';
      $('end-banner').className = 'winner-banner';
      MochiSounds.lose();
    }
    showScreen('end');
  });

  socket.on('host-left', () => {
    // Gentler than an alert — show a friendly card so kids don't panic
    showReconnectOverlay('The host has ended this round. Returning home...');
    setTimeout(() => { location.href = '/'; }, 3500);
  });

  socket.on('state', (s) => {
    if (s.state === 'lobby' && currentQid) {
      // host reset
      currentQid = null;
      myScore = 0;
      enterLobby();
    }
  });

  function showScreen(name) {
    ['join', 'lobby', 'countdown', 'question', 'result', 'mash', 'cs-walk', 'cc-play', 'end'].forEach((n) => {
      const el = $('screen-' + n);
      if (el) el.classList.toggle('hidden', n !== name);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
})();
