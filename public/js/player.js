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

  const $ = (id) => document.getElementById(id);

  const SHAPES = ['▲', '◆', '●', '■'];

  // Mute toggle
  $('mute-btn').addEventListener('click', () => {
    const muted = window.toggleMute();
    $('mute-btn').textContent = muted ? '🔇 Off' : '🔊 On';
  });

  // Unlock audio on first tap
  document.addEventListener('click', () => window.unlockAudio && window.unlockAudio(), { once: true });
  document.addEventListener('touchstart', () => window.unlockAudio && window.unlockAudio(), { once: true });

  // Pre-fill PIN from URL
  const params = new URLSearchParams(location.search);
  if (params.get('pin')) {
    $('pin-input').value = params.get('pin');
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
      if (gameType === 'color-splash') {
        csGridW = resp.gridW || 24;
        csGridH = resp.gridH || 14;
        csMyX = resp.x || 0;
        csMyY = resp.y || 0;
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
    const isPanda = team === 'red';
    $('lobby-mascot').textContent = isPanda ? '🐼' : '🦊';
    $('lobby-team-name').textContent = isPanda ? 'Team Panda 紅' : 'Team Kitsune 金';
    $('lobby-team-name').style.color = isPanda ? 'var(--red-glow)' : 'var(--gold-glow)';
    $('player-header').className = `player-header ${team}`;
    $('mash-header').className = `player-header ${team}`;
    $('player-name-tag').textContent = myName;
    $('mash-name-tag').textContent = myName;
    const mashBtn = $('mash-button');
    mashBtn.classList.remove('red', 'gold');
    mashBtn.classList.add(team);
    $('mash-mascot').textContent = isPanda ? '🐼' : '🦊';
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

  socket.on('answer-result', ({ correct, mashUntil, walkUntil, correctText }) => {
    if (correct) {
      MochiSounds.correct();
      const happyMascot = gameType === 'color-splash'
        ? (team === 'red' ? '🎨' : '🖌️')
        : (team === 'red' ? '🐼' : '🦊');
      const sub = gameType === 'color-splash' ? 'Walk and paint! ⚡' : 'Feed your team! ⚡';
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
        if (gameType === 'color-splash') {
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

  // === COLOR SPLASH ===
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
        $('cs-walk-score').textContent = csTilesPainted;
      }
    }
  });

  socket.on('cs:paint', ({ cells }) => {
    cells.forEach((c) => paintMiniCell(c.x, c.y, c.team));
  });

  function buildMiniGrid() {
    const grid = $('cs-mini-grid');
    if (!grid) return;
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = `repeat(${csGridW}, 1fr)`;
    const screenW = Math.min(window.innerWidth - 40, 480);
    const cellSize = Math.max(8, Math.floor((screenW - 16) / csGridW) - 1);
    document.documentElement.style.setProperty('--cs-mini-cell', cellSize + 'px');
    for (let y = 0; y < csGridH; y++) {
      for (let x = 0; x < csGridW; x++) {
        const cell = document.createElement('div');
        cell.className = 'cs-cell';
        cell.id = `mini-cell-${x}-${y}`;
        cell.style.minWidth = cellSize + 'px';
        cell.style.minHeight = cellSize + 'px';
        grid.appendChild(cell);
      }
    }
    const wrap = $('cs-mini-players');
    if (wrap) {
      wrap.style.width = (cellSize * csGridW + (csGridW - 1)) + 'px';
      wrap.style.height = (cellSize * csGridH + (csGridH - 1)) + 'px';
    }
  }

  function initMiniPlayers() {
    const wrap = $('cs-mini-players');
    if (!wrap) return;
    wrap.innerHTML = '';
    Object.entries(csPlayers).forEach(([id, p]) => {
      const el = document.createElement('div');
      el.className = `cs-player ${p.team}`;
      el.id = `mini-player-${id}`;
      const screenW = Math.min(window.innerWidth - 40, 480);
      const cellSize = Math.max(8, Math.floor((screenW - 16) / csGridW) - 1);
      el.style.width = cellSize + 'px';
      el.style.height = cellSize + 'px';
      el.style.fontSize = Math.max(8, cellSize - 2) + 'px';
      const isMe = id === myPlayerId;
      const emoji = isMe ? '🌟' : (p.team === 'red' ? '🎨' : '🖌️');
      el.innerHTML = `<span class="cs-player-emoji">${emoji}</span>`;
      moveMiniPlayer(id, p.x, p.y);
      wrap.appendChild(el);
    });
  }

  function moveMiniPlayer(playerId, x, y) {
    const el = document.getElementById(`mini-player-${playerId}`);
    if (!el) return;
    const screenW = Math.min(window.innerWidth - 40, 480);
    const cellSize = Math.max(8, Math.floor((screenW - 16) / csGridW) - 1);
    el.style.left = (x * (cellSize + 1)) + 'px';
    el.style.top = (y * (cellSize + 1)) + 'px';
  }

  function paintMiniCell(x, y, team) {
    const cell = document.getElementById(`mini-cell-${x}-${y}`);
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
    alert('Host disconnected. Returning home.');
    location.href = '/';
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
    ['join', 'lobby', 'countdown', 'question', 'result', 'mash', 'cs-walk', 'end'].forEach((n) => {
      const el = $('screen-' + n);
      if (el) el.classList.toggle('hidden', n !== name);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
})();
