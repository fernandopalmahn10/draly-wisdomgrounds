(function () {
  // Prefer WebSocket transport — long-polling on flaky mobile networks is the
  // #1 cause of "I tapped and nothing happened." Aggressive reconnection so
  // the socket recovers within ~1 second of a drop.
  const socket = io({
    transports: ['websocket', 'polling'],
    upgrade: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
    timeout: 8000
  });
  let pin = null;
  let team = null;
  let myName = '';
  let currentQid = null;
  // (legacy timer kept for any reference; bulletproof flow below replaces it)

  // === BULLETPROOF ANSWER FLOW ===
  // Multi-layered to make "I tapped and nothing happened" impossible:
  //  1. Immediate visual feedback ("Enviando…" overlay) so the player KNOWS the
  //     tap registered, regardless of network state.
  //  2. Heartbeat: re-emit the answer every 1 s until we hear back from server,
  //     OR an 8 s deadline elapses, OR a new question arrives (it'd supersede).
  //  3. After 8 s with no result, force a socket reconnect + re-enable buttons.
  //  4. Server ACKs immediately on receipt so we know transport is alive even
  //     before the full answer-result is computed.
  let pendingAnswer = null;
  let answerHeartbeat = null;

  function sendAnswerBulletproof(qid, choiceIdx) {
    if (pendingAnswer && pendingAnswer.qid === qid) return; // already pending
    pendingAnswer = { qid, choiceIdx, startedAt: Date.now(), attempts: 0 };
    showSendingOverlay('Enviando respuesta…');
    attemptAnswerSend();
    if (answerHeartbeat) clearInterval(answerHeartbeat);
    answerHeartbeat = setInterval(() => {
      if (!pendingAnswer) {
        clearInterval(answerHeartbeat); answerHeartbeat = null;
        return;
      }
      const age = Date.now() - pendingAnswer.startedAt;
      if (age > 8000) {
        // Give up. Force-reconnect the socket; show an error; let player retry.
        clearAnswerHeartbeat();
        showSendingOverlay('Conexión inestable. Reconectando…');
        try { socket.disconnect(); socket.connect(); } catch (_) {}
        setTimeout(() => {
          hideSendingOverlay();
          document.querySelectorAll('.answer-btn').forEach((b) => {
            b.disabled = false; b.style.outline = '';
          });
        }, 2500);
        return;
      }
      attemptAnswerSend();
    }, 1000);
  }

  function attemptAnswerSend() {
    if (!pendingAnswer) return;
    pendingAnswer.attempts++;
    const payload = {
      pin,
      qid: pendingAnswer.qid,
      choiceIdx: pendingAnswer.choiceIdx
    };
    try {
      socket.timeout(700).emit('player:answer', payload, (err) => {
        if (!err && pendingAnswer) pendingAnswer.acked = true;
      });
    } catch (_) {
      // Older socket.io fallback
      try { socket.emit('player:answer', payload); } catch (e) {}
    }
  }

  function clearAnswerHeartbeat() {
    pendingAnswer = null;
    if (answerHeartbeat) { clearInterval(answerHeartbeat); answerHeartbeat = null; }
  }

  function showSendingOverlay(text) {
    let el = document.getElementById('sending-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sending-overlay';
      el.className = 'sending-overlay';
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.remove('hidden');
  }

  function hideSendingOverlay() {
    const el = document.getElementById('sending-overlay');
    if (el) el.classList.add('hidden');
  }
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
  // Color Splash canvas renderer state
  let csRaf = null;
  let csPickups = [];
  let csPickupFx = [];
  // Color Clash state
  let ccEnergy = 50;
  let ccDpadHandlerBound = false;
  // Market Quest state
  let mqWorld = { w: 1600, h: 900 };
  let mqVendors = [];
  let mqPickups = [];
  let mqPickupFx = [];
  let mqPlayers = {};
  let mqDisplayPlayers = {};
  let mqAssets = { scene: null };
  let mqJoystickBound = false;
  let mqInput = { left: false, right: false, up: false, down: false };
  let mqLastInputSent = 0;
  let mqRaf = null;
  let mqItemsCollected = 0;
  // Flappy state
  let flWorld = { w: 800, h: 480, pipeW: 80, pipeGap: 160, playerX: 180 };
  let flMe = { y: 240, alive: true, score: 0 };
  let flPipes = [];
  let flScrollPhase = 0; // for parallax animation
  let flRaf = null;
  let flTapBound = false;
  let flAssets = { bg: null, rockUp: null, rockDown: null, red: [], gold: [] };

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
    el.querySelector('.reconnect-text').textContent = message || 'Reconectando…';
    el.classList.remove('hidden');
  }
  function hideReconnectOverlay() {
    const el = document.getElementById('reconnect-overlay');
    if (el) el.classList.add('hidden');
  }
  socket.on('disconnect', (reason) => {
    if (pin && myName) showReconnectOverlay('Reconectando…');
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
    if (pin && myName) showReconnectOverlay('Reconectando…');
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
    startLobbyFlappy();
  }

  // ===== LOBBY MINI-GAME: a tiny client-side Flappy that runs while waiting =====
  // Pure local — no server. Just to entertain players.
  let lobbyFl = null;
  function startLobbyFlappy() {
    const canvas = $('lobby-flappy-canvas');
    if (!canvas) return;
    if (lobbyFl) return; // already running

    const ctx = canvas.getContext('2d');
    const W = 400, H = 280;
    canvas.width = W;
    canvas.height = H;

    // Load Kenney plane + rocks (cached after first load)
    const assets = { bg: null, ru: null, rd: null, plane: [] };
    function loadImg(src) {
      return new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
    }
    Promise.all([
      loadImg('/assets/flappy/background.png'),
      loadImg('/assets/flappy/rock-up.png'),
      loadImg('/assets/flappy/rock-down.png'),
      loadImg(`/assets/flappy/${team === 'red' ? 'red' : 'gold'}-1.png`),
      loadImg(`/assets/flappy/${team === 'red' ? 'red' : 'gold'}-2.png`),
      loadImg(`/assets/flappy/${team === 'red' ? 'red' : 'gold'}-3.png`)
    ]).then(([bg, ru, rd, p1, p2, p3]) => {
      assets.bg = bg;
      assets.ru = ru;
      assets.rd = rd;
      assets.plane = [p1, p2, p3].filter(Boolean);
    });

    const state = {
      x: 90, y: H / 2, vy: 0,
      pipes: [], scrollX: 0,
      alive: true, score: 0, best: parseInt(localStorage.getItem('dralyFlappyBest') || '0', 10),
      raf: null, started: false
    };
    $('lobby-flappy-best').textContent = state.best;

    // Tuning: easier than classic Flappy — gentler gravity, bigger gap, slower scroll
    const TUNING = {
      gravity: 0.28,        // was 0.35 — slower fall
      flapVy: -5.2,          // was -5.5
      scrollSpeed: 1.35,    // was 1.6 — slower pipes
      pipeGapHalf: 70,      // was 50 (so total gap is 140 instead of 100)
      pipeSpacing: 200,     // was 170
      playerR: 16           // was 18
    };

    function newPipe(x) {
      // Keep gap center within safe vertical range
      return { x, gap: 80 + Math.random() * (H - 160), scored: false };
    }
    function reset() {
      state.y = H / 2;
      state.vy = 0;
      state.pipes = [newPipe(W + 80), newPipe(W + 80 + TUNING.pipeSpacing), newPipe(W + 80 + TUNING.pipeSpacing * 2)];
      state.alive = true;
      state.score = 0;
      state.started = false;
    }
    reset();

    function flap() {
      if (!state.alive) { reset(); return; }
      if (!state.started) state.started = true;
      state.vy = TUNING.flapVy;
      // Sound: tap/whoosh
      if (window.MochiSounds) MochiSounds.tap();
    }
    canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); flap(); });

    function tick(now) {
      if (state.started && state.alive) {
        state.vy += TUNING.gravity;
        state.y += state.vy;
        state.scrollX += TUNING.scrollSpeed;

        state.pipes.forEach((p) => p.x -= TUNING.scrollSpeed);
        state.pipes = state.pipes.filter((p) => p.x > -80);
        while (state.pipes.length < 3) {
          const lastX = Math.max(...state.pipes.map((p) => p.x), W);
          state.pipes.push(newPipe(lastX + TUNING.pipeSpacing));
        }

        if (state.y < TUNING.playerR || state.y > H - TUNING.playerR) {
          if (state.alive && window.MochiSounds) MochiSounds.wrong();
          state.alive = false;
        }

        for (const p of state.pipes) {
          if (!p.scored && p.x + 60 < state.x - TUNING.playerR) {
            p.scored = true; state.score++;
            if (window.MochiSounds) MochiSounds.tick();
            if (state.score > state.best) {
              state.best = state.score;
              localStorage.setItem('dralyFlappyBest', String(state.best));
              if (window.MochiSounds) MochiSounds.combo();
            }
            $('lobby-flappy-best').textContent = state.best;
          }
          if (state.x + TUNING.playerR > p.x && state.x - TUNING.playerR < p.x + 60) {
            const top = p.gap - TUNING.pipeGapHalf;
            const bot = p.gap + TUNING.pipeGapHalf;
            if (state.y - TUNING.playerR < top || state.y + TUNING.playerR > bot) {
              if (state.alive && window.MochiSounds) MochiSounds.wrong();
              state.alive = false;
            }
          }
        }
      }

      // Render
      ctx.clearRect(0, 0, W, H);
      if (assets.bg) {
        const bw = (assets.bg.width / assets.bg.height) * H;
        const phase = state.scrollX % bw;
        ctx.drawImage(assets.bg, -phase, 0, bw, H);
        ctx.drawImage(assets.bg, bw - phase, 0, bw, H);
      } else {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#4ec9f5'); g.addColorStop(1, '#c8e7f5');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }

      state.pipes.forEach((p) => {
        const rockH = 220;
        if (assets.ru && assets.rd) {
          ctx.drawImage(assets.rd, p.x, p.gap - TUNING.pipeGapHalf - rockH, 60, rockH);
          ctx.drawImage(assets.ru, p.x, p.gap + TUNING.pipeGapHalf, 60, rockH);
        } else {
          ctx.fillStyle = '#3a8a3a';
          ctx.fillRect(p.x, 0, 60, p.gap - TUNING.pipeGapHalf);
          ctx.fillRect(p.x, p.gap + TUNING.pipeGapHalf, 60, H);
        }
      });

      // Plane
      const planeImgs = assets.plane;
      const f = Math.floor((now / 100) % Math.max(1, planeImgs.length));
      const img = planeImgs[f];
      ctx.save();
      ctx.translate(state.x, state.y);
      ctx.rotate(Math.max(-0.5, Math.min(0.7, state.vy * 0.08)));
      if (img) {
        ctx.drawImage(img, -28, -22, 56, 44);
      } else {
        ctx.font = '40px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(team === 'red' ? '🐲' : '🦅', 0, 0);
      }
      ctx.restore();

      // Score
      ctx.font = 'bold 26px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillText(state.score, W / 2 + 1, 40);
      ctx.fillStyle = '#fff';
      ctx.fillText(state.score, W / 2, 39);

      // Start prompt
      if (!state.started && state.alive) {
        ctx.fillStyle = 'rgba(13, 14, 26, 0.65)';
        ctx.fillRect(0, H / 2 - 32, W, 64);
        ctx.font = 'bold 18px Nunito, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText('Toca para empezar', W / 2, H / 2 + 4);
      }
      if (!state.alive) {
        ctx.fillStyle = 'rgba(139, 26, 35, 0.45)';
        ctx.fillRect(0, 0, W, H);
        ctx.font = 'bold 22px Nunito, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText('¡Boom! Toca para volver a volar', W / 2, H / 2 + 6);
      }

      state.raf = requestAnimationFrame(tick);
    }
    state.raf = requestAnimationFrame(tick);
    lobbyFl = state;
  }

  function stopLobbyFlappy() {
    if (lobbyFl && lobbyFl.raf) cancelAnimationFrame(lobbyFl.raf);
    lobbyFl = null;
  }

  function updateTeamUI() {
    const isRed = team === 'red';
    // Lobby title varies by game type
    let teamLabel, teamMascot;
    if (gameType === 'flappy') {
      teamLabel = isRed ? 'Equipo Rojo 紅龍' : 'Equipo Dorado 金鷹';
      teamMascot = isRed ? '🐲' : '🦅';
    } else if (gameType === 'market-quest') {
      teamLabel = isRed ? 'Team Long 紅龍' : 'Team Shi 金獅';
      teamMascot = isRed ? '🐲' : '🦁';
    } else if (gameType === 'color-clash') {
      teamLabel = isRed ? 'Team Lantern 紅燈籠' : 'Team Dumpling 餃子';
      teamMascot = isRed ? '🏮' : '🥟';
    } else if (gameType === 'color-splash') {
      teamLabel = isRed ? 'Equipo Estudiante 學生' : 'Equipo Maestro 老師';
      teamMascot = isRed ? '✏️' : '📚';
    } else if (gameType === 'pinata') {
      teamLabel = isRed ? 'Equipo Bastón 紅棍' : 'Equipo Arco 金弓';
      teamMascot = isRed ? '🥢' : '🏹';
    } else if (gameType === 'dragon-eye') {
      teamLabel = isRed ? 'Equipo Pincel 紅毛筆' : 'Equipo Tinta 金墨水';
      teamMascot = isRed ? '✒️' : '🖌️';
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
      // Piñata reskins the mash button: the target IS the tiger; the team
      // identity is read from the stick/bow emoji elsewhere.
      if (gameType === 'pinata') {
        $('mash-mascot').textContent = '🐯';
      } else {
        $('mash-mascot').textContent = isRed ? '🐼' : '🦊';
      }
    }
    // Color Clash team tag
    if ($('cc-team-tag')) {
      $('cc-team-tag').className = `cc-hud-tag ${team}`;
      $('cc-team-tag').textContent = isRed ? '🏮 Lantern' : '🥟 Dumpling';
    }
    // Market Quest team tag
    if ($('mq-player-tag')) {
      $('mq-player-tag').className = `mq-player-tag ${team}`;
      $('mq-player-tag').textContent = isRed ? '🐲 Long' : '🦁 Shi';
    }
    // Flappy team tag
    if ($('fl-player-tag')) {
      $('fl-player-tag').className = `fl-player-tag ${team}`;
      $('fl-player-tag').textContent = isRed ? '🐲 Rojo' : '🦅 Dorado';
    }
  }

  socket.on('team-changed', ({ team: newTeam }) => {
    team = newTeam;
    updateTeamUI();
    MochiSounds.swap();
  });

  socket.on('countdown', () => {
    stopLobbyFlappy();
    showScreen('countdown');
    MochiSounds.startMusic();
    // Independent random Dralingo appearances on each player's phone
    Dralingo.startRandom({
      minMs: 25000,
      maxMs: 50000,
      isActive: () => true
    });
    // Color Clash: after the countdown ends, drop straight into the play screen
    if (gameType === 'color-clash') {
      setTimeout(() => {
        showScreen('cc-play');
        bindCcDpad();
        updateCcEnergyDisplay();
      }, 3500);
    }
    // After countdown — only switch screens if we're still on countdown.
    // The server may fire a 'question' event during the transition (vendor collision on spawn)
    // and we don't want to clobber that. Helper: only switch if currently showing countdown.
    function safeSwitchAfterCountdown(targetScreen, onSwitch) {
      const countdownEl = $('screen-countdown');
      const stillOnCountdown = countdownEl && !countdownEl.classList.contains('hidden');
      if (stillOnCountdown) {
        showScreen(targetScreen);
      }
      // Always run initialization (joystick bindings, render loop start) regardless
      if (onSwitch) onSwitch();
    }

    if (gameType === 'market-quest') {
      setTimeout(() => {
        safeSwitchAfterCountdown('mq-play', () => initGameplayScreen('market-quest'));
      }, 3500);
    }
    if (gameType === 'flappy') {
      setTimeout(() => {
        safeSwitchAfterCountdown('fl-play', () => initGameplayScreen('flappy'));
      }, 3500);
    }
    // Piñata uses the standard question + mash flow — no special countdown branch needed.
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
    // A new question arriving means any pending answer for the OLD question
    // is irrelevant. Clear the heartbeat + overlay so we don't keep retrying
    // a stale answer that the server has already moved past.
    clearAnswerHeartbeat();
    hideSendingOverlay();
    q.answers.forEach((a, i) => {
      const btn = document.createElement('button');
      btn.className = 'answer-btn';
      btn.innerHTML = `<span class="answer-shape shape-${i}">${SHAPES[i]}</span><span>${escapeHtml(a)}</span>`;
      // Use pointerdown — fires faster than 'click' and isn't subject to the
      // 300ms tap-delay or synthetic-click-eaten-by-scroll bugs on mobile.
      const onTap = (e) => {
        if (e) e.preventDefault();
        if (btn.disabled) return;
        // Capture qid at tap time (closure-protected — even if a new question
        // arrives mid-tap, the local var is stable for this handler).
        const qidAtTap = currentQid;
        sendAnswerBulletproof(qidAtTap, i);
        document.querySelectorAll('.answer-btn').forEach((b) => b.disabled = true);
        btn.style.outline = '3px solid var(--ink)';
        btn.style.transform = 'scale(0.97)';
      };
      btn.addEventListener('pointerdown', onTap);
      btn.addEventListener('click', onTap); // keyboard / accessibility fallback
      ansEl.appendChild(btn);
    });
    showScreen('question');
  });

  // If the server tells us our answer was stale (no open question on server),
  // re-enable the buttons so the player can retry instead of being stuck.
  socket.on('answer-stale', () => {
    clearAnswerHeartbeat();
    hideSendingOverlay();
    document.querySelectorAll('.answer-btn').forEach((b) => {
      b.disabled = false;
      b.style.outline = '';
      b.style.transform = '';
    });
  });

  socket.on('answer-result', ({ correct, mashUntil, walkUntil, energy, correctText, vendorId, playerScore, itemIcon, itemChinese, dragonDot, dragonAim, dragonAimMs, points }) => {
    clearAnswerHeartbeat();
    hideSendingOverlay();
    // Dragon-Eye fast path: skip the 900ms result celebration and go straight
    // to the aim screen so the player has the full timer to think + tap.
    if (correct && gameType === 'dragon-eye' && dragonAim) {
      MochiSounds.correct();
      if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
      startDragonAim(dragonAimMs || 12000);
      return;
    }
    if (correct) {
      MochiSounds.correct();
      let happyMascot, sub;
      if (gameType === 'flappy') {
        happyMascot = team === 'red' ? '🐲' : '🦅';
        sub = '¡Revivido! Sigue volando ⚡';
      } else if (gameType === 'market-quest') {
        const vendor = mqVendors.find((v) => v.id === vendorId);
        happyMascot = vendor ? vendor.icon : '🛍';
        sub = '¡Puesto reclamado!';
        if (typeof playerScore === 'number') mqItemsCollected = playerScore;
        // Big collection toast + flying item + bag bump
        showMqCollectionFeedback(itemIcon || (vendor && vendor.icon) || '🛍', correctText, itemChinese);
      } else if (gameType === 'color-clash') {
        happyMascot = team === 'red' ? '🏮' : '🥟';
        sub = `+30 energía ⚡`;
      } else if (gameType === 'color-splash') {
        happyMascot = team === 'red' ? '🎨' : '🖌️';
        sub = '¡Camina y pinta! ⚡';
      } else if (gameType === 'pinata') {
        happyMascot = team === 'red' ? '🥢' : '🏹';
        sub = '¡Golpea la piñata! 🐯💥';
      } else if (gameType === 'dragon-eye') {
        happyMascot = team === 'red' ? '✒️' : '🖌️';
        sub = '¡A apuntar al ojo! 🎯';
      } else {
        happyMascot = team === 'red' ? '🐼' : '🦊';
        sub = '¡Alimenta a tu equipo! ⚡';
      }
      showResultFeedback({
        mascot: happyMascot,
        mascotCls: 'happy',
        title: '¡Correcto!',
        sub,
        cls: 'correct'
      });
      burstSparkles('✨', 12);
      if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
      setTimeout(() => {
        if (gameType === 'flappy') {
          showScreen('fl-play');
        } else if (gameType === 'market-quest') {
          showScreen('mq-play');
          if ($('mq-player-items')) $('mq-player-items').textContent = mqItemsCollected;
        } else if (gameType === 'color-clash') {
          if (typeof energy === 'number') ccEnergy = energy;
          showScreen('cc-play');
          updateCcEnergyDisplay();
        } else if (gameType === 'color-splash') {
          csWalkEndTime = walkUntil;
          startWalk();
        } else if (gameType === 'pinata') {
          mashEndTime = mashUntil;
          startPinataSmash();
        } else if (gameType === 'dragon-eye') {
          // Dragon: correct → open tap-anywhere aim screen. Player taps on the
          // dragon to place the pearl, then presses LANZAR.
          if (dragonAim) startDragonAim(8000);
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
        title: '¡Incorrecto!',
        sub: `Respuesta: ${escapeHtml(correctText || '')}`,
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
      if (gameType === 'market-quest') {
        setTimeout(() => {
          showScreen('mq-play');
        }, 1400);
      }
      // Flappy: stays dead; server will auto-send next revive question via setTimeout
      // (no screen change needed — the question screen will re-appear automatically)
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

  // === Piñata smash screen — the real interaction. ===
  // Hanging tiger that swings, a wooden Mexican stick at the bottom-right that
  // arcs up to hit on every tap, and candies that burst from the tiger and fall.
  let pnSmashTimerInt = null;
  let pnSmashTaps = 0;
  let pnSmashActive = false;

  function startPinataSmash() {
    pnSmashActive = true;
    pnSmashTaps = 0;
    document.body.classList.add('pinata-active');
    if ($('pn-smash-name-tag')) $('pn-smash-name-tag').textContent = myName;
    if ($('pn-smash-score')) $('pn-smash-score').textContent = myScore;
    if ($('pn-smash-header')) $('pn-smash-header').className = `player-header ${team}`;
    // Reset tiger
    const tiger = $('pn-smash-tiger');
    const tigerWrap = $('pn-smash-tiger-wrap');
    if (tiger) {
      tiger.textContent = '🐯';
      tiger.classList.remove('hit', 'angry');
    }
    if (tigerWrap) tigerWrap.classList.remove('damaged');
    // Clear any leftover candies
    const layer = $('pn-smash-candy-layer');
    if (layer) layer.innerHTML = '';
    // Reset timer fill
    const fill = $('pn-smash-timer-fill');
    if (fill) fill.style.width = '100%';
    showScreen('pinata-smash');
    // Bind tap button
    const btn = $('pn-smash-tap-btn');
    if (btn) {
      btn.onpointerdown = (e) => {
        e.preventDefault();
        pnHandleSmashTap();
      };
    }
    // Also let the player tap the tiger directly
    if (tigerWrap) {
      tigerWrap.onpointerdown = (e) => {
        e.preventDefault();
        pnHandleSmashTap();
      };
    }
    // Timer
    if (pnSmashTimerInt) clearInterval(pnSmashTimerInt);
    const totalDur = mashEndTime - Date.now();
    pnSmashTimerInt = setInterval(() => {
      const remaining = Math.max(0, mashEndTime - Date.now());
      if (fill) fill.style.width = ((remaining / totalDur) * 100) + '%';
      if (remaining <= 0) {
        clearInterval(pnSmashTimerInt);
        pnSmashTimerInt = null;
        pnSmashActive = false;
        document.body.classList.remove('pinata-active');
        // The next 'question' event will move us to screen-question naturally.
      }
    }, 50);
  }

  // Called from inside the tap-ack handler when piñata is the active game. We
  // animate the stick swing + spawn candies + shake the tiger. The actual tap
  // event was already sent to the server by the regular mash flow.
  function pnSmashScreenTap() {
    if (!pnSmashActive) return;
    pnSmashTaps++;
    if ($('pn-smash-score')) $('pn-smash-score').textContent = myScore;
    const stick = $('pn-smash-stick');
    if (stick) {
      stick.classList.remove('swing');
      void stick.offsetWidth;
      stick.classList.add('swing');
    }
    const tigerWrap = $('pn-smash-tiger-wrap');
    if (tigerWrap) {
      tigerWrap.classList.remove('shake');
      void tigerWrap.offsetWidth;
      tigerWrap.classList.add('shake');
      // After ~8 taps the tiger looks visibly damaged
      if (pnSmashTaps > 8) tigerWrap.classList.add('damaged');
      // Tiger face turns angry after a while (no demon)
      const tiger = $('pn-smash-tiger');
      if (tiger && pnSmashTaps > 6) tiger.textContent = '😾';
    }
    spawnPnCandyBurst();
  }

  function pnHandleSmashTap() {
    if (!pnSmashActive) return;
    if (Date.now() > mashEndTime) {
      pnSmashActive = false;
      document.body.classList.remove('pinata-active');
      return;
    }
    if (navigator.vibrate) navigator.vibrate(15);
    MochiSounds.tap && MochiSounds.tap();
    // Send tap to server — server emits tap-ack, which calls pnSmashScreenTap
    // for the animations. We do the visuals optimistically here too so it feels
    // instant even on a slow connection.
    socket.emit('player:tap', { pin });
    pnSmashScreenTap();
  }

  function spawnPnCandyBurst() {
    const layer = $('pn-smash-candy-layer');
    if (!layer) return;
    const tigerWrap = $('pn-smash-tiger-wrap');
    if (!tigerWrap) return;
    const stageRect = layer.getBoundingClientRect();
    const tigerRect = tigerWrap.getBoundingClientRect();
    const cx = tigerRect.left - stageRect.left + tigerRect.width / 2;
    const cy = tigerRect.top - stageRect.top + tigerRect.height / 2;
    const candies = ['🍬', '🍭', '🍫', '🧧', '🪙', '🥮', '🍡'];
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const c = document.createElement('div');
      c.className = 'pn-candy';
      c.textContent = candies[Math.floor(Math.random() * candies.length)];
      c.style.left = cx + 'px';
      c.style.top = cy + 'px';
      const dx = (Math.random() - 0.5) * 280;
      const dy = 220 + Math.random() * 180; // always falls down
      const rot = (Math.random() * 720 - 360) + 'deg';
      c.style.setProperty('--dx', dx + 'px');
      c.style.setProperty('--dy', dy + 'px');
      c.style.setProperty('--rot', rot);
      c.style.animationDuration = (0.9 + Math.random() * 0.4) + 's';
      layer.appendChild(c);
      setTimeout(() => c.remove(), 1500);
    }
  }

  // === Dragon's Eye aim mini-game (tap-anywhere) ===
  // Player taps anywhere on the dragon image. A + crosshair shows where their
  // pearl will land — they can re-tap to adjust. Pressing the launch button
  // commits the shot. Plenty of time (8 s window with visual countdown).
  let dragonAimX = 0.5, dragonAimY = 0.5;
  let dragonAimSelected = false;
  let dragonAimFired = false;
  let dragonAimTimerRaf = null;
  let dragonAimDeadline = 0;

  function startDragonAim(windowMs) {
    showScreen('dragon-aim');
    dragonAimSelected = false;
    dragonAimFired = false;
    dragonAimX = 0.5;
    dragonAimY = 0.5;
    const totalMs = windowMs || 8000;
    dragonAimDeadline = Date.now() + totalMs;
    const stage = $('dr-aim-stage');
    const crosshair = $('dr-aim-crosshair');
    const btn = $('dr-aim-tap-btn');
    const timerFill = $('dr-aim-timer-fill');
    if (crosshair) crosshair.classList.add('hidden');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Toca al dragón primero ↑';
    }

    // === Tap-on-dragon handler ===
    if (stage) {
      const onAimTap = (e) => {
        if (dragonAimFired) return;
        if (e) e.preventDefault();
        const r = stage.getBoundingClientRect();
        const clientX = e.clientX != null ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        const clientY = e.clientY != null ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
        const px = (clientX - r.left) / r.width;
        const py = (clientY - r.top) / r.height;
        dragonAimX = Math.max(0, Math.min(1, px));
        dragonAimY = Math.max(0, Math.min(1, py));
        dragonAimSelected = true;
        if (crosshair) {
          crosshair.classList.remove('hidden');
          crosshair.style.left = (dragonAimX * 100) + '%';
          crosshair.style.top  = (dragonAimY * 100) + '%';
        }
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '🐉 <span style="margin:0 8px;">¡LANZAR PERLA!</span> 🔮';
        }
        if (navigator.vibrate) navigator.vibrate(15);
      };
      // Bind only once per session — overwrite onpointerdown so each new round
      // doesn't accumulate listeners.
      stage.onpointerdown = onAimTap;
    }

    // === Launch button ===
    if (btn) {
      const onLaunch = (e) => {
        if (e) e.preventDefault();
        if (dragonAimFired || !dragonAimSelected) return;
        dragonAimFired = true;
        btn.disabled = true;
        btn.textContent = '🔮 ¡Lanzada!';
        socket.emit('dragon:aim-place', { pin, aimX: dragonAimX, aimY: dragonAimY });
        if (navigator.vibrate) navigator.vibrate(40);
        MochiSounds.populate && MochiSounds.populate(team);
      };
      btn.onpointerdown = onLaunch;
      btn.onclick = onLaunch;
    }

    // === Countdown bar + giant number ===
    const countdownEl = $('dr-aim-countdown');
    cancelAnimationFrame(dragonAimTimerRaf);
    function tick() {
      const remaining = Math.max(0, dragonAimDeadline - Date.now());
      const pct = (remaining / totalMs) * 100;
      if (timerFill) timerFill.style.width = pct + '%';
      if (countdownEl) {
        const secsLeft = Math.ceil(remaining / 1000);
        if (countdownEl.textContent !== String(secsLeft)) {
          countdownEl.textContent = secsLeft;
        }
        // Glow red in the last 3 seconds
        if (secsLeft <= 3) countdownEl.classList.add('urgent');
        else countdownEl.classList.remove('urgent');
      }
      if (remaining <= 0) {
        // Time's up — if they aimed but didn't fire, auto-launch with their selection.
        if (!dragonAimFired) {
          dragonAimFired = true;
          if (btn) { btn.disabled = true; btn.textContent = '🔮 ¡Tiempo!'; }
          socket.emit('dragon:aim-place', { pin, aimX: dragonAimX, aimY: dragonAimY });
        }
        return;
      }
      dragonAimTimerRaf = requestAnimationFrame(tick);
    }
    tick();
  }

  // Server tells us where the pearl actually landed
  socket.on('dragon:pearl-landed', ({ zone, isEye, reveal }) => {
    cancelAnimationFrame(dragonAimTimerRaf);
    const btn = $('dr-aim-tap-btn');
    if (btn) {
      if (isEye) btn.textContent = `👁 ¡OJO! +${reveal}% revelado`;
      else if (zone === 'head') btn.textContent = `🐉 ¡Cabeza! +${reveal}%`;
      else if (zone === 'body') btn.textContent = `✒️ Cuerpo +${reveal}%`;
      else btn.textContent = `🖌️ Al lado +${reveal}%`;
    }
    if (isEye) {
      MochiSounds.winFanfare && MochiSounds.winFanfare();
      burstSparkles('✨', 18);
    }
    // The next 'question' event will move us back to the question screen.
  });

  function startMash() {
    showScreen('mash');
    const mashBtn = $('mash-button');
    let localTaps = 0;

    // Re-skin the headline / hint + button based on game
    if (gameType === 'pinata') {
      document.body.classList.add('pinata-active');
      if ($('mash-headline')) $('mash-headline').innerHTML = '🥢 ¡ROMPE EL TIGRE!';
      if ($('mash-hint')) $('mash-hint').innerHTML = 'Cada toque = un golpe a tu tigre. ¡Sigue golpeando hasta romperlo!';
      // Set the mash button to "happy/calm" tiger initially. It gets angrier
      // as the player taps more during the smash window.
      const mascotEl = $('mash-mascot');
      if (mascotEl) {
        mascotEl.textContent = '🐯';
        mascotEl.classList.remove('pinata-angry', 'pinata-furious', 'pinata-hit');
        mascotEl._pnTaps = 0;
      }
    } else {
      document.body.classList.remove('pinata-active');
      if ($('mash-headline')) $('mash-headline').innerHTML = '⚡ ¡A APLASTAR! ⚡';
      if ($('mash-hint')) $('mash-hint').innerHTML = '¡TOCA, TOCA, TOCA! 🔥 8/seg = combo';
    }

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
      // Strip piñata-only body class so the next question screen looks normal
      document.body.classList.remove('pinata-active');
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

  // === MARKET QUEST ===
  socket.on('mq:init', (data) => {
    mqWorld.w = data.worldW;
    mqWorld.h = data.worldH;
    mqVendors = data.vendors || [];
    mqPickups = data.pickups || [];
    mqPickupFx = [];
    mqPlayers = data.players || {};
    if (data.teamScores) updateMqTeamScores(data.teamScores);
    mqDisplayPlayers = {};
    Object.entries(mqPlayers).forEach(([id, p]) => {
      mqDisplayPlayers[id] = { x: p.x, y: p.y, dir: p.dir, moving: false };
    });
    // Pre-load the scene image for the player's mini view
    if (!mqAssets.scene) {
      const img = new Image();
      img.onload = () => { mqAssets.scene = img; };
      img.src = '/assets/market-quest/tiny-town-scene.png';
    }
  });

  socket.on('mq:tick', ({ p: positions, full }) => {
    // Server sends deltas (only moving players) with periodic full syncs.
    Object.entries(positions).forEach(([id, pos]) => {
      if (!mqPlayers[id]) {
        mqPlayers[id] = { name: '?', team: 'red', x: pos.x, y: pos.y, dir: pos.d };
        mqDisplayPlayers[id] = { x: pos.x, y: pos.y, dir: pos.d, moving: !!pos.m };
      }
      mqPlayers[id].x = pos.x;
      mqPlayers[id].y = pos.y;
      mqPlayers[id].dir = pos.d;
      mqPlayers[id].moving = !!pos.m;
    });
    if (full) {
      Object.keys(mqDisplayPlayers).forEach((id) => {
        if (!positions[id]) delete mqDisplayPlayers[id];
      });
      Object.keys(mqPlayers).forEach((id) => {
        if (!positions[id]) delete mqPlayers[id];
      });
    } else {
      Object.keys(mqPlayers).forEach((id) => {
        if (!positions[id] && mqPlayers[id].moving) mqPlayers[id].moving = false;
      });
    }
    Object.keys(mqPlayers).forEach((id) => {
      if (!mqDisplayPlayers[id]) {
        mqDisplayPlayers[id] = {
          x: mqPlayers[id].x, y: mqPlayers[id].y, dir: mqPlayers[id].dir, moving: false
        };
      }
    });
    updateMqHint();
  });

  socket.on('mq:vendor-claimed', ({ vendorId, team, teamScores }) => {
    const v = mqVendors.find((x) => x.id === vendorId);
    if (v) v.claimedBy = team;
    if (teamScores) updateMqTeamScores(teamScores);
    MochiSounds.correct();
  });

  function updateMqTeamScores(scores) {
    if ($('mq-team-red')) $('mq-team-red').textContent = scores.red || 0;
    if ($('mq-team-gold')) $('mq-team-gold').textContent = scores.gold || 0;
  }

  socket.on('mq:pickup-grabbed', ({ id, icon, team, teamScores }) => {
    const pk = mqPickups.find((x) => x.id === id);
    if (pk) {
      pk.available = false;
      mqPickupFx.push({ x: pk.x, y: pk.y, icon, until: performance.now() + 600 });
    }
    if (teamScores) updateMqTeamScores(teamScores);
    MochiSounds.populate(team);
  });

  socket.on('mq:pickup-respawn', ({ id }) => {
    const pk = mqPickups.find((x) => x.id === id);
    if (pk) pk.available = true;
  });

  // Server tells THIS player they personally grabbed a pickup → bag bump + sparkles
  socket.on('mq:my-pickup', ({ icon, playerScore }) => {
    mqItemsCollected = playerScore;
    const itemsEl = $('mq-player-items');
    if (itemsEl) itemsEl.textContent = mqItemsCollected;
    // Tiny "+1" floater + sparkle, no big toast (that's reserved for vendor claims)
    const bag = $('mq-bag');
    if (bag) {
      bag.classList.remove('bumped');
      void bag.offsetWidth;
      bag.classList.add('bumped');
    }
    const bagRecent = $('mq-bag-recent');
    if (bagRecent) {
      const item = document.createElement('span');
      item.className = 'mq-bag-item';
      item.textContent = icon || '🍎';
      bagRecent.appendChild(item);
      while (bagRecent.children.length > 5) bagRecent.removeChild(bagRecent.firstChild);
    }
    if (navigator.vibrate) navigator.vibrate(20);
    MochiSounds.tap();
  });

  // === Shared gameplay-screen initializer ===
  // Called from BOTH the 'countdown' event AND the state-watchdog catch-up
  // path (when a player missed countdown). Idempotent — each underlying init
  // function self-guards against being called twice.
  function initGameplayScreen(forGameType) {
    if (forGameType === 'market-quest') {
      bindMqJoystick();
      startMqRender();
    } else if (forGameType === 'flappy') {
      loadFlappyAssets();
      bindFlTap();
      startFlRender();
    } else if (forGameType === 'color-clash') {
      bindCcDpad();
      updateCcEnergyDisplay();
    }
    // color-splash, mochi-mash, pinata: nothing extra to initialize — they
    // drive their own screens off the 'question' / 'answer-result' event flow.
  }

  function bindMqJoystick() {
    if (mqJoystickBound) return;
    mqJoystickBound = true;
    const base = $('mq-joystick');
    const knob = $('mq-joystick-knob');
    if (!base || !knob) return;

    let touching = false;
    let pointerId = null;

    function setKnob(dx, dy) {
      const max = base.clientWidth * 0.32;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > max) { dx = dx * max / d; dy = dy * max / d; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

      // Compute directional input
      const deadzone = max * 0.25;
      mqInput = { left: false, right: false, up: false, down: false };
      if (dx < -deadzone) mqInput.left = true;
      if (dx > deadzone) mqInput.right = true;
      if (dy < -deadzone) mqInput.up = true;
      if (dy > deadzone) mqInput.down = true;
    }

    function reset() {
      touching = false;
      pointerId = null;
      knob.style.transform = 'translate(-50%, -50%)';
      mqInput = { left: false, right: false, up: false, down: false };
      // Send the stopped state immediately
      socket.emit('player:mq-input', { pin, ...mqInput });
    }

    base.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      touching = true;
      pointerId = e.pointerId;
      try { base.setPointerCapture(e.pointerId); } catch (err) {}
      const r = base.getBoundingClientRect();
      setKnob(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
    });
    base.addEventListener('pointermove', (e) => {
      if (!touching || e.pointerId !== pointerId) return;
      const r = base.getBoundingClientRect();
      setKnob(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
    });
    base.addEventListener('pointerup', reset);
    base.addEventListener('pointercancel', reset);
    base.addEventListener('pointerleave', (e) => {
      if (touching && e.pointerId === pointerId) reset();
    });

    // Keyboard fallback for desktop testing
    const keyMap = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down' };
    document.addEventListener('keydown', (e) => {
      const dir = keyMap[e.key];
      if (!dir || gameType !== 'market-quest') return;
      mqInput[dir] = true;
    });
    document.addEventListener('keyup', (e) => {
      const dir = keyMap[e.key];
      if (!dir || gameType !== 'market-quest') return;
      mqInput[dir] = false;
    });

    // Send input to server at 20Hz
    setInterval(() => {
      if (gameType !== 'market-quest') return;
      const now = Date.now();
      if (now - mqLastInputSent < 45) return;
      mqLastInputSent = now;
      socket.emit('player:mq-input', { pin, ...mqInput });
    }, 50);
  }

  function startMqRender() {
    cancelAnimationFrame(mqRaf);
    let lastF = performance.now();
    function frame(now) {
      const canvas = $('mq-player-canvas');
      if (!canvas) { mqRaf = requestAnimationFrame(frame); return; }
      const ctx = canvas.getContext('2d');

      // Resize canvas backing to match display size (for crisp rendering)
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      if (canvas.width !== cssW || canvas.height !== cssH) {
        canvas.width = cssW;
        canvas.height = cssH;
      }
      const W = canvas.width;
      const H = canvas.height;

      // Smooth display positions
      Object.entries(mqPlayers).forEach(([id, p]) => {
        const d = mqDisplayPlayers[id];
        if (!d) return;
        d.x += (p.x - d.x) * 0.3;
        d.y += (p.y - d.y) * 0.3;
        d.dir = p.dir;
        d.moving = p.moving;
      });

      // Camera follows me
      const me = mqDisplayPlayers[myPlayerId];
      const camScale = Math.min(W / 800, H / 600); // show ~half the world around player
      const camX = me ? me.x : mqWorld.w / 2;
      const camY = me ? me.y : mqWorld.h / 2;

      ctx.fillStyle = '#1a0d08';
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(camScale, camScale);
      ctx.translate(-camX, -camY);

      // Background scene
      if (mqAssets.scene) {
        ctx.imageSmoothingEnabled = false;
        const sceneScale = Math.max(mqWorld.w / mqAssets.scene.width, mqWorld.h / mqAssets.scene.height);
        const sw = mqAssets.scene.width * sceneScale;
        const sh = mqAssets.scene.height * sceneScale;
        ctx.drawImage(mqAssets.scene, (mqWorld.w - sw) / 2, (mqWorld.h - sh) / 2, sw, sh);
        ctx.fillStyle = 'rgba(20, 10, 5, 0.25)';
        ctx.fillRect(0, 0, mqWorld.w, mqWorld.h);
      } else {
        const grad = ctx.createLinearGradient(0, 0, 0, mqWorld.h);
        grad.addColorStop(0, '#7a4f33');
        grad.addColorStop(1, '#432817');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, mqWorld.w, mqWorld.h);
      }

      const t = now / 1000;

      // Vendors
      mqVendors.forEach((v) => drawMqVendor(ctx, v, t));

      // Pickups (food items scattered on the floor)
      mqPickups.forEach((pickup) => drawMqPickup(ctx, pickup, t));

      // Grab effects — picked-up items rising and fading
      mqPickupFx = mqPickupFx.filter((fx) => fx.until > now);
      mqPickupFx.forEach((fx) => {
        const elapsed = 600 - (fx.until - now);
        const pr = elapsed / 600;
        const rise = 70 * pr;
        ctx.save();
        ctx.globalAlpha = 1 - pr;
        ctx.font = `${36 + 18 * pr}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(fx.icon, fx.x, fx.y - rise);
        ctx.restore();
      });

      // Players (Y-sorted)
      const sortedIds = Object.keys(mqDisplayPlayers).sort((a, b) =>
        mqDisplayPlayers[a].y - mqDisplayPlayers[b].y
      );
      sortedIds.forEach((id) => {
        const d = mqDisplayPlayers[id];
        const p = mqPlayers[id];
        if (!d || !p) return;
        drawMqPlayer(ctx, d, p, t, id === myPlayerId);
      });

      ctx.restore();

      mqRaf = requestAnimationFrame(frame);
    }
    mqRaf = requestAnimationFrame(frame);
  }

  function drawMqVendor(ctx, v, t) {
    const x = v.x, y = v.y;
    ctx.save();

    // Detection-radius aura on UNCLAIMED vendors
    if (!v.claimedBy) {
      const pulse = 0.55 + Math.sin(t * 2 + v.id) * 0.15;
      const grad = ctx.createRadialGradient(x, y + 12, 8, x, y + 12, 140);
      grad.addColorStop(0, `rgba(255, 220, 130, ${0.22 * pulse})`);
      grad.addColorStop(0.5, `rgba(255, 200, 100, ${0.14 * pulse})`);
      grad.addColorStop(1, 'rgba(255, 213, 122, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y + 12, 140, 0, Math.PI * 2);
      ctx.fill();

      // "💬 ¡Habla!" indicator if I'm within range
      const me = mqPlayers[myPlayerId];
      if (me) {
        const dx = me.x - v.x;
        const dy = me.y - v.y;
        if (dx * dx + dy * dy < 130 * 130) {
          const bob = Math.sin(t * 6) * 3;
          ctx.font = 'bold 22px serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#fff8e0';
          ctx.strokeStyle = '#2a1a0a';
          ctx.lineWidth = 4;
          ctx.strokeText('💬', x, y - 70 + bob);
          ctx.fillText('💬', x, y - 70 + bob);
        }
      }
    }

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + 36, 55, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    const claimed = v.claimedBy;
    const roofColor = claimed === 'red' ? '#d92e3a' : claimed === 'gold' ? '#e8b14a' : '#8b1a23';
    ctx.fillStyle = roofColor;
    ctx.beginPath();
    ctx.moveTo(x - 60, y - 30);
    ctx.quadraticCurveTo(x, y - 50, x + 60, y - 30);
    ctx.lineTo(x + 45, y - 12);
    ctx.lineTo(x - 45, y - 12);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#7a4d2a';
    ctx.fillRect(x - 45, y - 10, 90, 24);

    ctx.font = '40px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const bob = claimed ? 0 : Math.sin(t * 2 + v.id) * 3;
    ctx.fillText(v.icon, x, y - 26 + bob);
    ctx.restore();
  }

  function drawMqPickup(ctx, pickup, t) {
    if (!pickup.available) return;
    const x = pickup.x, y = pickup.y;
    const bob = Math.sin(t * 2.2 + pickup.id) * 4;
    ctx.save();
    // Glow ring
    const glow = ctx.createRadialGradient(x, y + bob, 4, x, y + bob, 32);
    glow.addColorStop(0, 'rgba(255, 220, 130, 0.5)');
    glow.addColorStop(1, 'rgba(255, 213, 122, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y + bob, 32, 0, Math.PI * 2);
    ctx.fill();
    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + 18, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // The food sprite
    ctx.font = '28px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pickup.icon, x, y + bob);
    ctx.restore();
  }

  function drawMqPlayer(ctx, d, p, t, isMe) {
    const x = d.x, y = d.y;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(x, y + 28, 22, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    const bob = d.moving ? Math.sin(t * 12) * 3 : 0;
    const team = p.team;
    const body = team === 'red' ? '#ff5a66' : '#ffd57a';
    const bodyDark = team === 'red' ? '#8b1a23' : '#a87a1f';

    ctx.fillStyle = bodyDark;
    ctx.beginPath();
    ctx.arc(x, y + 8 - bob, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y + 5 - bob, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f4d8b8';
    ctx.beginPath();
    ctx.arc(x, y - 18 - bob, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1a0d08';
    const eyeOffsetX = d.dir === 'left' ? -4 : d.dir === 'right' ? 4 : 0;
    const eyeOffsetY = d.dir === 'up' ? -3 : d.dir === 'down' ? 2 : 0;
    ctx.beginPath();
    ctx.arc(x - 5 + eyeOffsetX, y - 19 - bob + eyeOffsetY, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 5 + eyeOffsetX, y - 19 - bob + eyeOffsetY, 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = bodyDark;
    ctx.beginPath();
    ctx.ellipse(x, y - 28 - bob, 14, 6, 0, Math.PI, 2 * Math.PI);
    ctx.fill();

    // Star marker over "me"
    if (isMe) {
      ctx.fillStyle = '#ffd57a';
      ctx.font = 'bold 18px serif';
      ctx.textAlign = 'center';
      ctx.fillText('⭐', x, y - 42 - bob);
    }

    // Name
    ctx.font = 'bold 11px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const name = p.name || '?';
    const nameW = ctx.measureText(name).width;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(x - nameW / 2 - 4, y - 55 - bob, nameW + 8, 14);
    ctx.fillStyle = team === 'red' ? '#ff9aa5' : '#ffd57a';
    ctx.fillText(name, x, y - 54 - bob);
    ctx.restore();
  }

  function showMqCollectionFeedback(icon, spanishWord, chinesePhrase) {
    const toast = $('mq-collect-toast');
    const toastIcon = $('mq-toast-icon');
    const toastSub = $('mq-toast-sub');
    const toastChinese = $('mq-toast-chinese');
    if (toast) {
      toastIcon.textContent = icon || '🛍';
      toastSub.textContent = `Coleccionaste ${spanishWord || 'un producto'}`;
      toastChinese.textContent = chinesePhrase || '';
      toastChinese.style.display = chinesePhrase ? 'block' : 'none';
      toast.classList.remove('hidden');
      // Restart animation
      toast.classList.remove('visible');
      void toast.offsetWidth;
      toast.classList.add('visible');
      setTimeout(() => toast.classList.add('hidden'), 2200);
    }
    // Add item to the visible bag (last 5 collected)
    const bagRecent = $('mq-bag-recent');
    if (bagRecent) {
      const item = document.createElement('span');
      item.className = 'mq-bag-item';
      item.textContent = icon || '🛍';
      bagRecent.appendChild(item);
      // Keep only the last 5 items
      while (bagRecent.children.length > 5) bagRecent.removeChild(bagRecent.firstChild);
    }
    // Bump the bag with a satisfying squish
    const bag = $('mq-bag');
    if (bag) {
      bag.classList.remove('bumped');
      void bag.offsetWidth;
      bag.classList.add('bumped');
    }
    // Sparkles + vibration
    burstSparkles('✨', 16);
    if (navigator.vibrate) navigator.vibrate([50, 30, 80, 30, 50]);
  }

  function updateMqHint() {
    const me = mqPlayers[myPlayerId];
    const hint = $('mq-hint');
    if (!me || !hint) return;
    let nearVendor = null;
    for (const v of mqVendors) {
      if (v.claimedBy) continue;
      const dx = me.x - v.x;
      const dy = me.y - v.y;
      if (dx * dx + dy * dy < 110 * 110) { nearVendor = v; break; }
    }
    if (nearVendor) {
      hint.textContent = `${nearVendor.icon} ¡Cerca! Habla con el vendedor`;
      hint.classList.add('near-vendor');
    } else {
      hint.textContent = 'Camina hacia un puesto del mercado';
      hint.classList.remove('near-vendor');
    }
  }

  // === FLAPPY ===
  socket.on('fl:init', (data) => {
    flWorld.w = data.worldW;
    flWorld.h = data.worldH;
    flWorld.pipeW = data.pipeW;
    flWorld.pipeGap = data.pipeGap;
    flWorld.playerX = data.playerX;
  });

  socket.on('fl:tick', ({ me, pipes, teamScores }) => {
    if (me) {
      flMe.y = me.y;
      flMe.alive = me.alive;
      flMe.score = me.score;
    }
    if (pipes) flPipes = pipes;
    if ($('fl-player-score')) $('fl-player-score').textContent = flMe.score;
  });

  socket.on('fl:died', ({ score }) => {
    MochiSounds.wrong();
    flMe.alive = false;
    flMe.score = score;
    if (navigator.vibrate) navigator.vibrate([60, 40, 100]);
  });

  socket.on('fl:revived', () => {
    MochiSounds.correct();
    flMe.alive = true;
    if (navigator.vibrate) navigator.vibrate(30);
  });

  function loadFlappyAssets() {
    if (flAssets.bg) return; // already loaded
    function loadImg(src) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      });
    }
    Promise.all([
      loadImg('/assets/flappy/background.png'),
      loadImg('/assets/flappy/rock-up.png'),
      loadImg('/assets/flappy/rock-down.png'),
      loadImg('/assets/flappy/red-1.png'),
      loadImg('/assets/flappy/red-2.png'),
      loadImg('/assets/flappy/red-3.png'),
      loadImg('/assets/flappy/gold-1.png'),
      loadImg('/assets/flappy/gold-2.png'),
      loadImg('/assets/flappy/gold-3.png')
    ]).then(([bg, ru, rd, r1, r2, r3, g1, g2, g3]) => {
      flAssets.bg = bg;
      flAssets.rockUp = ru;
      flAssets.rockDown = rd;
      flAssets.red = [r1, r2, r3].filter(Boolean);
      flAssets.gold = [g1, g2, g3].filter(Boolean);
    });
  }

  function bindFlTap() {
    if (flTapBound) return;
    flTapBound = true;
    const surface = $('screen-fl-play');
    const handleTap = (e) => {
      e.preventDefault();
      if (!flMe.alive) return;
      MochiSounds.tap();
      if (navigator.vibrate) navigator.vibrate(8);
      socket.emit('player:fl-flap', { pin });
      const hint = $('fl-tap-hint');
      if (hint) hint.classList.add('hidden-hint');
    };
    surface.addEventListener('pointerdown', handleTap);
    document.addEventListener('keydown', (e) => {
      if (gameType !== 'flappy') return;
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') {
        handleTap(e);
      }
    });
  }

  function startFlRender() {
    cancelAnimationFrame(flRaf);
    function frame(now) {
      const canvas = $('fl-canvas');
      if (!canvas) { flRaf = requestAnimationFrame(frame); return; }
      const ctx = canvas.getContext('2d');
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      if (canvas.width !== cssW || canvas.height !== cssH) {
        canvas.width = cssW;
        canvas.height = cssH;
      }
      const W = canvas.width;
      const H = canvas.height;
      const sx = W / flWorld.w;
      const sy = H / flWorld.h;

      // Background — tile horizontally for parallax
      if (flAssets.bg) {
        ctx.imageSmoothingEnabled = false;
        const bgW = flAssets.bg.width * sy / (flAssets.bg.height / flWorld.h);
        flScrollPhase = (flScrollPhase + 0.5) % bgW;
        ctx.drawImage(flAssets.bg, -flScrollPhase, 0, bgW, H);
        ctx.drawImage(flAssets.bg, bgW - flScrollPhase, 0, bgW, H);
      } else {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#4ec9f5');
        grad.addColorStop(1, '#c8e7f5');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }

      // Pipes
      const halfGap = flWorld.pipeGap / 2;
      flPipes.forEach((pipe) => {
        const px = pipe.x * sx;
        const pw = flWorld.pipeW * sx;
        const gy = pipe.g * sy;
        if (flAssets.rockUp && flAssets.rockDown) {
          ctx.imageSmoothingEnabled = false;
          const rockH = (flAssets.rockDown.height * pw) / flAssets.rockDown.width;
          // top pipe (rockDown points down from ceiling)
          ctx.drawImage(flAssets.rockDown, px, gy - halfGap * sy - rockH, pw, rockH);
          // bottom pipe
          ctx.drawImage(flAssets.rockUp, px, gy + halfGap * sy, pw, rockH);
        } else {
          ctx.fillStyle = '#2d8a3a';
          ctx.fillRect(px, 0, pw, gy - halfGap * sy);
          ctx.fillRect(px, gy + halfGap * sy, pw, H);
        }
      });

      // Player plane
      const planeImgs = team === 'red' ? flAssets.red : flAssets.gold;
      const planeFrameIdx = Math.floor((now / 100) % Math.max(1, planeImgs.length));
      const img = planeImgs[planeFrameIdx];
      const ppx = flWorld.playerX * sx;
      const ppy = flMe.y * sy;
      const planeW = 60 * sx;
      const planeH = 50 * sy;
      ctx.save();
      ctx.translate(ppx, ppy);
      // Tilt based on velocity (use approximated from flapping)
      ctx.rotate((flMe.alive ? -0.2 : 0.6));
      if (img) {
        ctx.drawImage(img, -planeW / 2, -planeH / 2, planeW, planeH);
      } else {
        // Fallback dragon emoji
        ctx.font = `${planeH}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(team === 'red' ? '🐲' : '🦅', 0, 0);
      }
      ctx.restore();

      // Dead overlay
      if (!flMe.alive) {
        ctx.fillStyle = 'rgba(139, 26, 35, 0.4)';
        ctx.fillRect(0, 0, W, H);
        ctx.font = 'bold 28px Nunito, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.fillText('¡Estrellaste!', W / 2, H / 2 - 20);
        ctx.font = '18px Nunito, sans-serif';
        ctx.fillText('Responde para revivir →', W / 2, H / 2 + 14);
      }

      flRaf = requestAnimationFrame(frame);
    }
    flRaf = requestAnimationFrame(frame);
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
    b.textContent = '⚡ ¡Sin energía! Responde preguntas para recargar';
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

  // === COLOR SPLASH (Tinta y Bambú) — canvas renderer for player walk view ===
  function startCsWalkRender() {
    cancelAnimationFrame(csRaf);
    function frame(now) {
      const canvas = $('cs-walk-canvas');
      if (!canvas) { csRaf = requestAnimationFrame(frame); return; }
      // Stop if we've left the walk screen
      const walkScreen = $('screen-cs-walk');
      if (walkScreen && walkScreen.classList.contains('hidden')) {
        csRaf = null;
        return;
      }
      const ctx = canvas.getContext('2d');
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      if (canvas.width !== cssW || canvas.height !== cssH) {
        canvas.width = cssW;
        canvas.height = cssH;
      }
      const W = canvas.width;
      const H = canvas.height;

      // Compute cell size
      const margin = 16;
      const cs = Math.floor(Math.min((W - margin * 2) / csGridW, (H - margin * 2) / csGridH));
      const gridPxW = cs * csGridW;
      const gridPxH = cs * csGridH;
      const ox = (W - gridPxW) / 2;
      const oy = (H - gridPxH) / 2;

      // Rice paper inside the canvas (very faint, CSS already provides the bulk)
      ctx.fillStyle = 'rgba(244, 228, 192, 0.0)';
      ctx.fillRect(0, 0, W, H);

      // Faint grid lines (calligraphy paper marks)
      ctx.strokeStyle = 'rgba(100, 70, 40, 0.1)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= csGridW; i += 3) {
        ctx.beginPath();
        ctx.moveTo(ox + i * cs, oy);
        ctx.lineTo(ox + i * cs, oy + gridPxH);
        ctx.stroke();
      }
      for (let i = 0; i <= csGridH; i += 3) {
        ctx.beginPath();
        ctx.moveTo(ox, oy + i * cs);
        ctx.lineTo(ox + gridPxW, oy + i * cs);
        ctx.stroke();
      }

      // Ink splats — draw painted cells
      for (let y = 0; y < csGridH; y++) {
        for (let x = 0; x < csGridW; x++) {
          const cell = csGrid[y] && csGrid[y][x];
          if (!cell) continue;
          const cx = ox + x * cs + cs / 2;
          const cy = oy + y * cs + cs / 2;
          const baseColor = cell === 'red' ? '#8b1a23' : '#a87a1f';
          const accent = cell === 'red' ? '#d92e3a' : '#e8b14a';
          const glow = cell === 'red' ? 'rgba(217,46,58,0.3)' : 'rgba(232,177,74,0.3)';
          // Glow
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(cx, cy, cs * 0.85, 0, Math.PI * 2);
          ctx.fill();
          // Splat
          ctx.fillStyle = baseColor;
          const seed = x + y;
          const wob1 = ((seed * 17) % 100) / 100 * 0.3 + 0.85;
          const wob2 = ((seed * 31) % 100) / 100 * 0.3 + 0.85;
          ctx.beginPath();
          ctx.ellipse(cx, cy, cs * 0.55 * wob1, cs * 0.55 * wob2, ((seed * 7) % 360) * Math.PI / 180, 0, Math.PI * 2);
          ctx.fill();
          // Highlight
          ctx.fillStyle = accent;
          ctx.beginPath();
          ctx.ellipse(cx - cs * 0.1, cy - cs * 0.1, cs * 0.3, cs * 0.3, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Pickups (school items)
      csPickups.forEach((pickup) => {
        if (!pickup.available) return;
        const pcx = ox + pickup.x * cs + cs / 2;
        const pcy = oy + pickup.y * cs + cs / 2;
        const bob = Math.sin(now / 400 + pickup.id) * 3;
        // Glow
        const glow = ctx.createRadialGradient(pcx, pcy + bob, 4, pcx, pcy + bob, cs * 1.2);
        glow.addColorStop(0, 'rgba(255, 220, 130, 0.6)');
        glow.addColorStop(1, 'rgba(255, 213, 122, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(pcx, pcy + bob, cs * 1.2, 0, Math.PI * 2);
        ctx.fill();
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(pcx, pcy + cs * 0.55, cs * 0.35, cs * 0.13, 0, 0, Math.PI * 2);
        ctx.fill();
        // Icon
        ctx.font = `${cs * 1.05}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pickup.icon, pcx, pcy + bob);
      });

      // Pickup grab effect
      csPickupFx = csPickupFx.filter((fx) => fx.until > now);
      csPickupFx.forEach((fx) => {
        const elapsed = 700 - (fx.until - now);
        const p = elapsed / 700;
        const pcx = ox + fx.x * cs + cs / 2;
        const pcy = oy + fx.y * cs + cs / 2 - 50 * p;
        ctx.save();
        ctx.globalAlpha = 1 - p;
        ctx.font = `${cs * (1.1 + p * 0.8)}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(fx.icon, pcx, pcy);
        ctx.restore();
      });

      // Player avatars (myself + others). My character is highlighted with a star.
      Object.entries(csPlayers).forEach(([id, p]) => {
        const cx = ox + p.x * cs + cs / 2;
        const cy = oy + p.y * cs + cs / 2;
        const isMe = id === myPlayerId;
        const robe = p.team === 'red' ? '#d92e3a' : '#e8b14a';
        const robeDark = p.team === 'red' ? '#8b1a23' : '#a87a1f';
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(cx, cy + cs * 0.5, cs * 0.5, cs * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();
        const bob = isMe ? Math.sin(now / 100) * 2 : 0;
        // Robe
        ctx.fillStyle = robeDark;
        ctx.beginPath();
        ctx.arc(cx, cy + cs * 0.2 - bob, cs * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = robe;
        ctx.beginPath();
        ctx.arc(cx, cy + cs * 0.15 - bob, cs * 0.5, 0, Math.PI * 2);
        ctx.fill();
        // Head
        ctx.fillStyle = '#f4d8b8';
        ctx.beginPath();
        ctx.arc(cx, cy - cs * 0.3 - bob, cs * 0.4, 0, Math.PI * 2);
        ctx.fill();
        // Eyes
        ctx.fillStyle = '#1a0d08';
        ctx.beginPath();
        ctx.arc(cx - cs * 0.13, cy - cs * 0.32 - bob, cs * 0.06, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + cs * 0.13, cy - cs * 0.32 - bob, cs * 0.06, 0, Math.PI * 2);
        ctx.fill();
        // Star over me
        if (isMe) {
          ctx.fillStyle = '#ffd57a';
          ctx.font = `bold ${cs * 0.5}px serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('⭐', cx, cy - cs * 0.85 - bob);
        }
      });

      csRaf = requestAnimationFrame(frame);
    }
    csRaf = requestAnimationFrame(frame);
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
    if (gameType === 'color-splash') {
      // Clase de Caligrafía: canvas-rendered. Reset grid + pickups.
      csGrid = Array.from({ length: csGridH }, () => Array(csGridW).fill(null));
      csPickups = data.pickups || [];
      csPickupFx = [];
    } else {
      // Color Clash: keeps the DOM mini-board (still works)
      buildMiniGrid();
      initMiniPlayers();
    }
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
    if (gameType === 'color-splash') {
      // Apply paint to local canvas grid
      if (Array.isArray(paint)) {
        paint.forEach((c) => { csGrid[c.y][c.x] = c.team; });
        if (playerId === myPlayerId && paint.length) {
          csTilesPainted += paint.filter((c) => c.team === team).length;
          if ($('cs-walk-score')) $('cs-walk-score').textContent = csTilesPainted;
        }
      } else if (paint) {
        csGrid[paint.y][paint.x] = paint.team;
        if (playerId === myPlayerId && paint.team === team) {
          csTilesPainted++;
          if ($('cs-walk-score')) $('cs-walk-score').textContent = csTilesPainted;
        }
      }
    } else {
      // Color Clash: existing DOM path
      moveMiniPlayer(playerId, x, y);
      if (paint) {
        const single = Array.isArray(paint) ? paint[0] : paint;
        if (single) {
          paintMiniCell(single.x, single.y, single.team);
          if (playerId === myPlayerId && single.team === team) {
            csTilesPainted++;
          }
        }
      }
    }
  });

  socket.on('cs:paint', ({ cells }) => {
    if (gameType === 'color-splash') {
      cells.forEach((c) => { csGrid[c.y][c.x] = c.team; });
    } else {
      cells.forEach((c) => paintMiniCell(c.x, c.y, c.team));
    }
  });

  // Color Splash pickup events
  socket.on('cs:pickup-grabbed', ({ id, icon, team, bonusCells, teamScores }) => {
    const pk = csPickups.find((p) => p.id === id);
    if (pk) {
      pk.available = false;
      csPickupFx.push({ x: pk.x, y: pk.y, icon, until: performance.now() + 700 });
    }
    if (Array.isArray(bonusCells)) {
      bonusCells.forEach((c) => { csGrid[c.y][c.x] = c.team; });
    }
    MochiSounds.populate(team);
    // Small toast/HUD nudge if I grabbed it personally — using my socket id as proxy
    if (csPickups.find((p) => p.id === id)) {
      // We don't know the grabber socket here, so just sound+vibrate softly
      if (navigator.vibrate) navigator.vibrate(15);
    }
  });

  socket.on('cs:pickup-respawn', ({ id }) => {
    const pk = csPickups.find((p) => p.id === id);
    if (pk) pk.available = true;
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
    if ($('cs-walk-name-tag')) {
      $('cs-walk-name-tag').className = `cs-player-tag ${team}`;
    }
    $('cs-walk-timer-fill').style.width = '100%';
    const dpad = $('cs-dpad');
    dpad.classList.remove('idle');
    // Start canvas renderer for Color Splash player walk view
    if (gameType === 'color-splash') startCsWalkRender();

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
    // Piñata: tiger gets visibly angrier the more you tap during this window.
    // Stage 1: 🐯 calm, Stage 2: 😾 annoyed, Stage 3: 👹 furious.
    if (gameType === 'pinata') {
      // The brand-new piñata smash screen has its own per-tap visuals — see
      // pnSmashScreenTap() below. The legacy mash-mascot reskin only runs as a
      // fallback if for any reason the player ended up on the standard mash
      // screen. No demon face — just calm tiger → angry cat (per user feedback).
      const mascotEl = $('mash-mascot');
      if (mascotEl) {
        const tapsThisRound = (mascotEl._pnTaps || 0) + 1;
        mascotEl._pnTaps = tapsThisRound;
        const face = tapsThisRound > 6 ? '😾' : '🐯';
        if (mascotEl.textContent !== face) mascotEl.textContent = face;
        mascotEl.classList.remove('pinata-furious');
        if (tapsThisRound > 6) mascotEl.classList.add('pinata-angry');
        mascotEl.classList.remove('pinata-hit');
        void mascotEl.offsetWidth;
        mascotEl.classList.add('pinata-hit');
        if (MochiSounds.thwack) MochiSounds.thwack();
      }
      // Drive the new piñata smash screen if it's active
      pnSmashScreenTap();
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
    stopLobbyFlappy();
    if (mashTimerInterval) clearInterval(mashTimerInterval);
    if (csWalkTimerInterval) clearInterval(csWalkTimerInterval);
    if (mqRaf) { cancelAnimationFrame(mqRaf); mqRaf = null; }
    if (flRaf) { cancelAnimationFrame(flRaf); flRaf = null; }
    if (csRaf) { cancelAnimationFrame(csRaf); csRaf = null; }
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
      $('end-banner').textContent = '¡Empate épico!';
      $('end-banner').className = 'winner-banner tie';
      MochiSounds.tieMusic();
    } else if (won) {
      $('end-emoji').textContent = team === 'red' ? '🐼' : '🦊';
      $('end-banner').textContent = '¡Victoria!';
      $('end-banner').className = `winner-banner ${team}`;
      MochiSounds.winMusic();
      setTimeout(() => MochiSounds.winFanfare(), 400);
    } else {
      $('end-emoji').textContent = '💔';
      $('end-banner').textContent = '¡Mejor suerte la próxima!';
      $('end-banner').className = 'winner-banner';
      MochiSounds.loseMusic();
    }
    showScreen('end');
  });

  socket.on('host-left', () => {
    // Gentler than an alert — show a friendly card so kids don't panic
    showReconnectOverlay('El anfitrión terminó la ronda. Volviendo al inicio…');
    setTimeout(() => { location.href = '/'; }, 3500);
  });

  socket.on('state', (s) => {
    if (s.state === 'lobby' && currentQid) {
      // host reset
      currentQid = null;
      myScore = 0;
      enterLobby();
    }
    // === Catch-up watchdog ===
    // If the server says we're 'active' but we're still showing the lobby or
    // a frozen countdown screen, we missed the 'countdown' event (flaky wifi,
    // backgrounded tab, etc.). Force a transition into the right play screen
    // AND run the gameplay-screen initializer so joystick / canvas / etc are
    // actually live — otherwise the player sees a dead UI with no inputs.
    if (s.state === 'active') {
      const lobbyVisible = $('screen-lobby') && !$('screen-lobby').classList.contains('hidden');
      const countdownVisible = $('screen-countdown') && !$('screen-countdown').classList.contains('hidden');
      if (lobbyVisible || countdownVisible) {
        let target = 'question';
        if (gameType === 'flappy') target = 'fl-play';
        else if (gameType === 'market-quest') target = 'mq-play';
        else if (gameType === 'color-clash') target = 'cc-play';
        showScreen(target);
        stopLobbyFlappy();
        // Critical: initialize input handlers for the gameplay screen we just
        // forced them onto. Without this, the joystick/dpad/canvas are dead.
        initGameplayScreen(gameType);
      }
      // Even if they ARE on the right play screen but the handlers somehow
      // weren't bound (e.g. they hot-reloaded the tab while the game was running),
      // make sure the initializer ran. The internal flags make it cheap to call.
      const mqPlayVisible = $('screen-mq-play') && !$('screen-mq-play').classList.contains('hidden');
      const flPlayVisible = $('screen-fl-play') && !$('screen-fl-play').classList.contains('hidden');
      const ccPlayVisible = $('screen-cc-play') && !$('screen-cc-play').classList.contains('hidden');
      if (mqPlayVisible) initGameplayScreen('market-quest');
      else if (flPlayVisible) initGameplayScreen('flappy');
      else if (ccPlayVisible) initGameplayScreen('color-clash');
    }
  });

  function showScreen(name) {
    ['join', 'lobby', 'countdown', 'question', 'result', 'mash', 'pinata-smash', 'dragon-aim', 'cs-walk', 'cc-play', 'mq-play', 'fl-play', 'end'].forEach((n) => {
      const el = $('screen-' + n);
      if (el) el.classList.toggle('hidden', n !== name);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
})();
