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

  // === Global stuck-watchdog ===
  // The single biggest source of player frustration is "I'm stuck on a screen
  // and nothing is happening." We bump `lastActivityAt` on every meaningful
  // socket event. If 12s pass with no activity while we're in-game, we ping
  // player:resync — server then tells us exactly what to do (re-send the open
  // question, push a fresh question if idle, etc.) so we get unstuck.
  let lastActivityAt = Date.now();
  function markActivity() { lastActivityAt = Date.now(); }

  setInterval(() => {
    if (!pin || !myName) return;
    // Skip if the page is hidden/backgrounded — phones throttle JS there and
    // we'd false-positive constantly.
    if (document.hidden) return;
    // Skip if we're explicitly on a "waiting" screen like join/lobby/end —
    // these are intentional pauses, not freezes.
    const onLobby = $('screen-lobby')  && !$('screen-lobby').classList.contains('hidden');
    const onJoin  = $('screen-join')   && !$('screen-join').classList.contains('hidden');
    const onEnd   = $('screen-end')    && !$('screen-end').classList.contains('hidden');
    if (onLobby || onJoin || onEnd) return;
    if (Date.now() - lastActivityAt > 12000) {
      console.warn('[watchdog] 12s without activity — pinging resync');
      try { socket.emit('player:resync', { pin }); } catch (_) {}
      markActivity(); // don't spam
    }
  }, 3000);

  // Server's response to a resync ping. Mostly the server will already have
  // pushed us a fresh question by now; this handler clears any pending
  // overlays and re-enables the answer buttons in case they were stuck.
  socket.on('state-resync', (data) => {
    markActivity();
    hideSendingOverlay();
    clearAnswerHeartbeat();
    document.querySelectorAll('.answer-btn').forEach((b) => {
      b.disabled = false;
      b.style.outline = '';
      b.style.transform = '';
    });
    // If the server says we're still in a mash window, restore the timer.
    if (data && typeof data.mashUntil === 'number' && data.mashUntil > Date.now()) {
      mashEndTime = data.mashUntil;
    }
  });

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
      socket.emit('player:join', { pin, name: myName, avatar: getMyAvatar() }, (resp) => {
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
    socket.emit('player:join', { pin: p, name, avatar: getMyAvatar() }, (resp) => {
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
    renderAvatarPicker();
  }

  // === Avatar picker ===
  // Curated animals + characters. Kids tap to pick; selection persists in
  // localStorage and is broadcast to the server so every host page can show
  // the avatar next to the player's name in lobby chips + game UIs.
  // Kids' favorites first — capybara + dinos prominently up front.
  // 🦫 is the closest standard emoji to a capybara (capybara isn't a separate
  // Unicode emoji as of this writing; beaver is what every emoji keyboard
  // calls "capybara" in casual chat).
  const AVATAR_CHOICES = [
    '🦫','🦖','🦕','🐲','🦄',
    '🐱','🐶','🦊','🐯','🦁',
    '🐰','🐻','🐼','🐨','🐸',
    '🐵','🐺','🦝','🐹','🐭',
    '🦔','🦦','🦥','🐢','🐙',
    '🐳','🐧','🦉','🦋','🐝',
    '🐔','🦅','🦜','🦩','🦓',
    '🦒','🐊','🐍','🦂','🐌'
  ];
  function getMyAvatar() {
    return localStorage.getItem('dralyAvatar') || '🐱';
  }
  function setMyAvatar(a) {
    try { localStorage.setItem('dralyAvatar', a); } catch (_) {}
    if (pin) {
      try { socket.emit('player:set-avatar', { pin, avatar: a }); } catch (_) {}
    }
    // BUG FIX: the team header at the top of every game screen reads the
    // avatar via getMyAvatar(). When the player picks a new avatar mid-lobby,
    // we used to wait for the next server state push to refresh — meaning the
    // top emoji visibly lagged behind the picker selection. Now we re-render
    // the local team UI immediately so it changes ON ALL DEVICES the moment
    // the player taps (server broadcast still propagates to other clients).
    try { updateTeamUI(); } catch (_) {}
    // Re-render any cached header references on screens the player might
    // already be looking at (lobby, mash, pinata, family-place, etc.)
    refreshAvatarHeaders();
  }

  // Pushes the new avatar into every spot on the page that shows the player's
  // own avatar (header tags, name labels, lobby mascot, family token wrapper).
  function refreshAvatarHeaders() {
    const av = (typeof getMyAvatar === 'function') ? getMyAvatar() : '🐱';
    const nameWithAv = av ? `${av} ${myName || ''}`.trim() : (myName || '');
    if ($('player-name-tag')) $('player-name-tag').textContent = nameWithAv;
    if ($('mash-name-tag'))   $('mash-name-tag').textContent   = nameWithAv;
    if ($('pn-smash-name'))   $('pn-smash-name').textContent   = nameWithAv;
    // Lobby mascot: avatar · team-mascot combo. Re-build via updateTeamUI.
  }
  function renderAvatarPicker() {
    const grid = $('avatar-grid');
    if (!grid) return;
    const current = getMyAvatar();
    grid.innerHTML = '';
    AVATAR_CHOICES.forEach((a) => {
      const cell = document.createElement('div');
      cell.className = 'avatar-cell' + (a === current ? ' selected' : '');
      cell.textContent = a;
      cell.addEventListener('pointerdown', (e) => {
        if (e) e.preventDefault();
        setMyAvatar(a);
        // Re-render to update selected state
        grid.querySelectorAll('.avatar-cell').forEach((c) => c.classList.remove('selected'));
        cell.classList.add('selected');
        if (navigator.vibrate) navigator.vibrate(15);
        MochiSounds.swap && MochiSounds.swap();
      });
      grid.appendChild(cell);
    });
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
    } else if (gameType === 'monopoly') {
      teamLabel = isRed ? 'Equipo Rojo 紅龍' : 'Equipo Dorado 金龍';
      teamMascot = isRed ? '🐉' : '🐲';
    } else if (gameType === 'zombie') {
      teamLabel = isRed ? 'Equipo Sobreviviente Rojo' : 'Equipo Sobreviviente Dorado';
      teamMascot = isRed ? '🏃' : '🏃‍♀️';
    } else if (gameType === 'family') {
      teamLabel = isRed ? 'Familia Roja 紅家' : 'Familia Dorada 金家';
      teamMascot = isRed ? '🏡' : '🏠';
    } else {
      teamLabel = isRed ? 'Team Panda 紅' : 'Team Kitsune 金';
      teamMascot = isRed ? '🐼' : '🦊';
    }
    // Show team mascot + the player's chosen avatar side by side
    if ($('lobby-mascot')) {
      const av = getMyAvatar();
      $('lobby-mascot').innerHTML = av ? `${av}<span style="margin:0 6px; opacity:0.5;">·</span>${teamMascot}` : teamMascot;
    }
    if ($('lobby-team-name')) {
      $('lobby-team-name').textContent = teamLabel;
      $('lobby-team-name').style.color = isRed ? 'var(--red-glow)' : 'var(--gold-glow)';
    }
    if ($('player-header')) $('player-header').className = `player-header ${team}`;
    if ($('mash-header')) $('mash-header').className = `player-header ${team}`;
    // Avatar+name on every gameplay header so the kid always sees themselves
    const av = getMyAvatar();
    const nameWithAv = av ? `${av} ${myName}` : myName;
    if ($('player-name-tag')) $('player-name-tag').textContent = nameWithAv;
    if ($('mash-name-tag')) $('mash-name-tag').textContent = nameWithAv;
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
    // (Random Dralingo pop-ins were here — disabled per user feedback;
    // they were too intrusive during active gameplay.)
    if (Dralingo && Dralingo.stopRandom) Dralingo.stopRandom();
    // Zombie game: start the spooky ambient layer that haunts the player's
    // question/result screens with peeks + groans (separate from the in-sprint
    // jumpscares — this one runs the WHOLE game)
    if (gameType === 'zombie') startZombieAmbience();
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
    markActivity();
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

  // === Player-side streak tracking — feeds the global Rewards toast system.
  // Reset on a wrong answer. Used to escalate from common → great → epic
  // messages so kids feel a real "I'm on a roll" arc as they get questions right.
  let correctStreak = 0;
  let lastAnswerAt = 0;
  function fireRewardForCorrect() {
    if (!window.Rewards) return;
    correctStreak++;
    const now = Date.now();
    const fastAnswer = lastAnswerAt > 0 && (now - lastAnswerAt) < 6000;
    lastAnswerAt = now;
    // Tier ladder: 1-2 common, 3-5 great, 6+ epic
    if (correctStreak >= 6) {
      window.Rewards.epic();
    } else if (correctStreak >= 3) {
      window.Rewards.streak(correctStreak);
    } else if (fastAnswer && Math.random() < 0.5) {
      window.Rewards.speed();
    } else if (Math.random() < 0.25) {
      // Occasional Chinese-language sprinkle — keeps the educational vibe
      window.Rewards.chinese();
    } else {
      window.Rewards.show();
    }
  }
  function resetStreak() { correctStreak = 0; }

  socket.on('answer-result', ({ correct, mashUntil, walkUntil, energy, correctText, vendorId, playerScore, itemIcon, itemChinese, dragonDot, dragonAim, dragonAimMs, points, monopoly, familyToken }) => {
    markActivity();
    clearAnswerHeartbeat();
    hideSendingOverlay();
    if (!correct) resetStreak();
    // === FAMILY fast path === Skip the 900ms result-feedback screen entirely
    // for Mi Familia — go DIRECTLY to the drag-and-drop placement screen so
    // the cadence stays snappy and kids never see a mismatched mascot.
    if (correct && gameType === 'family' && familyToken) {
      MochiSounds.correct && MochiSounds.correct();
      if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
      fireRewardForCorrect();
      startFamilyPlace(familyToken);
      return;
    }
    if (correct) {
      MochiSounds.correct();
      fireRewardForCorrect();
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
        happyMascot = team === 'red' ? '🐉' : '🐲';
        sub = '¡A volar! Toca rápido para subir ☁️';
      } else if (gameType === 'zombie') {
        happyMascot = team === 'red' ? '🏃' : '🏃‍♀️';
        sub = '¡Corre! Toca rápido para huir 🧟💨';
      } else if (gameType === 'family') {
        happyMascot = familyToken ? familyToken.emoji : '🎁';
        sub = `¡Ganaste ${familyToken ? familyToken.name : 'un objeto'}! Elige un cuarto…`;
      } else if (gameType === 'monopoly') {
        happyMascot = '🎲';
        sub = '¡A lanzar el dado!';
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
          // Dragon flight: SWIPE-UP gesture, NOT tap mashing. Each upswipe
          // gestures sends a player:tap (server logic unchanged) but the
          // physical motion on the phone is wholly different.
          mashEndTime = mashUntil;
          startDragonFlap();
        } else if (gameType === 'monopoly') {
          if (monopoly && monopoly.needsRoll) {
            startMonopolyRoll(monopoly.money || 0);
          }
        } else if (gameType === 'zombie') {
          mashEndTime = mashUntil;
          startZombieSprint();
        } else if (gameType === 'family') {
          if (familyToken) startFamilyPlace(familyToken);
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
    if ($('pn-smash-name-tag')) {
      const a = getMyAvatar();
      $('pn-smash-name-tag').textContent = a ? `${a} ${myName}` : myName;
    }
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

  // === Mi Familia: drag-and-drop placement ===
  // The awarded token is a draggable element. Player presses-and-drags it
  // into one of the 4 room drop zones. On release inside a zone → emit
  // family:place. Recommended rooms glow green. Combos pop a banner.
  let fmTimerInt = null;
  let fmDeadline = 0;
  let fmFired = false;
  let fmCurrentToken = null;

  function startFamilyPlace(token) {
    if (!token) return;
    fmCurrentToken = token;
    fmFired = false;
    showScreen('family-place');
    const tokenEl = $('fm-drag-token');
    const emoji = $('fm-token-emoji');
    const nameEl = $('fm-token-name');
    if (emoji) emoji.textContent = token.emoji;
    if (nameEl) nameEl.textContent = token.name || '';
    if (tokenEl) {
      tokenEl.classList.remove('dropping', 'flying');
      tokenEl.style.transform = '';
      tokenEl.style.left = '';
      tokenEl.style.top = '';
    }
    // Build a "where does this go?" hint from the token's recommended rooms.
    // Kids were guessing whether grandpa goes to the sala or dormitorio — the
    // hint now spells it out: "¡Llévame a la Sala o Jardín!" so the cognitive
    // load is on the LANGUAGE, not the placement puzzle.
    const ROOM_LABELS = { sala: '🛋 Sala', cocina: '🍳 Cocina', dormitorio: '🛏 Dormitorio', jardin: '🌳 Jardín' };
    const hintEl = $('fm-token-hint');
    if (hintEl) {
      const recs = (Array.isArray(token.rooms) ? token.rooms : []).map((r) => ROOM_LABELS[r] || r);
      if (recs.length === 0) hintEl.textContent = '¡Llévame al cuarto correcto!';
      else if (recs.length === 1) hintEl.textContent = `¡Llévame a la ${recs[0]}!`;
      else hintEl.textContent = `¡Llévame a ${recs.slice(0, -1).join(', ')} o ${recs[recs.length - 1]}!`;
    }
    // Highlight recommended rooms (where this token belongs)
    document.querySelectorAll('.fm-roomzone').forEach((z) => {
      const fits = Array.isArray(token.rooms) && token.rooms.includes(z.dataset.room);
      z.classList.toggle('recommended', !!fits);
      z.classList.remove('hovering', 'dropped');
    });
    const banner = $('fm-combo-banner');
    if (banner) banner.classList.add('hidden');
    const hint = $('fm-place-hint');
    if (hint) hint.textContent = '👆 Mantén el dedo y arrastra hacia un cuarto';

    // === Drag handling ===
    let dragging = false;
    let startX = 0, startY = 0;
    let origLeft = 0, origTop = 0;
    function onPress(e) {
      if (fmFired || !tokenEl) return;
      if (e) e.preventDefault();
      dragging = true;
      const r = tokenEl.getBoundingClientRect();
      const px = e.clientX != null ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const py = e.clientY != null ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      startX = px; startY = py;
      origLeft = r.left; origTop = r.top;
      tokenEl.classList.add('dragging');
      if (navigator.vibrate) navigator.vibrate(15);
      try { tokenEl.setPointerCapture && tokenEl.setPointerCapture(e.pointerId); } catch (_) {}
    }
    function onMove(e) {
      if (!dragging || fmFired) return;
      const px = e.clientX != null ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const py = e.clientY != null ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      const dx = px - startX, dy = py - startY;
      if (tokenEl) tokenEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.1)`;
      // Highlight the room under the finger
      const hoverEl = document.elementFromPoint(px, py);
      const zone = hoverEl ? hoverEl.closest('.fm-roomzone') : null;
      document.querySelectorAll('.fm-roomzone').forEach((z) => z.classList.toggle('hovering', z === zone));
    }
    function onRelease(e) {
      if (!dragging || fmFired) return;
      dragging = false;
      const px = e.clientX != null ? e.clientX : (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : 0);
      const py = e.clientY != null ? e.clientY : (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientY : 0);
      const hoverEl = document.elementFromPoint(px, py);
      const zone = hoverEl ? hoverEl.closest('.fm-roomzone') : null;
      if (zone) {
        commitPlacement(zone.dataset.room, zone);
      } else {
        // Snap back to center
        if (tokenEl) {
          tokenEl.classList.remove('dragging');
          tokenEl.style.transform = '';
          if (navigator.vibrate) navigator.vibrate([10, 30]);
        }
      }
      document.querySelectorAll('.fm-roomzone').forEach((z) => z.classList.remove('hovering'));
    }
    function commitPlacement(room, zone) {
      if (fmFired) return;
      fmFired = true;
      // Visual: token "flies" to room center, then disappears
      if (tokenEl && zone) {
        tokenEl.classList.remove('dragging');
        tokenEl.classList.add('flying');
        const tRect = tokenEl.getBoundingClientRect();
        const zRect = zone.getBoundingClientRect();
        const dx = (zRect.left + zRect.width / 2) - (tRect.left + tRect.width / 2);
        const dy = (zRect.top  + zRect.height / 2) - (tRect.top  + tRect.height / 2);
        tokenEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.3) rotate(180deg)`;
      }
      if (zone) zone.classList.add('dropped');
      socket.emit('family:place', { pin, room });
      if (navigator.vibrate) navigator.vibrate([20, 60, 20]);
      MochiSounds.correct && MochiSounds.correct();
    }
    // Also support tap-to-place as a fallback for kids who don't drag
    document.querySelectorAll('.fm-roomzone').forEach((z) => {
      z.onpointerdown = (e) => {
        if (fmFired) return;
        if (e) e.preventDefault();
        commitPlacement(z.dataset.room, z);
      };
    });
    if (tokenEl) {
      tokenEl.onpointerdown = onPress;
      tokenEl.onpointermove = onMove;
      tokenEl.onpointerup = onRelease;
      tokenEl.onpointercancel = onRelease;
    }
    // Capture moves at the document level so dragging across zones works
    document._fmMove = onMove;
    document._fmUp = onRelease;
    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onRelease, { passive: false });

    // 8-second timer
    const totalMs = 8000;
    fmDeadline = Date.now() + totalMs;
    if (fmTimerInt) clearInterval(fmTimerInt);
    fmTimerInt = setInterval(() => {
      const remaining = Math.max(0, fmDeadline - Date.now());
      const sec = Math.ceil(remaining / 1000);
      if ($('fm-place-timer-num')) $('fm-place-timer-num').textContent = sec;
      if (remaining <= 0) {
        clearInterval(fmTimerInt);
        fmTimerInt = null;
        // Server auto-places. Player just sees the next question soon.
      }
    }, 100);
  }

  // === Player-side family progress tracking ===
  // Mirrors the host's brick counter + construction stage on the player's
  // mini-house widget. Also fires periodic "your team did great!" Rewards
  // toasts so kids see their team's progress even when they aren't holding
  // a token — they don't watch the host screen, they look at their phone.
  const FM_PLAYER_STAGES = [
    { at: 0,  icon: '🏗' },   { at: 1,  icon: '🧱' },
    { at: 4,  icon: '🧱🧱' }, { at: 8,  icon: '🏚' },
    { at: 12, icon: '🏠' },   { at: 16, icon: '🏡' },
    { at: 20, icon: '🏡💨' }, { at: 24, icon: '🏡🌳' },
    { at: 28, icon: '🏡☀️' },
  ];
  let fmMyTeamBricks = 0;
  let fmTeammateMomentum = 0;  // counter for teammate-progress toasts

  socket.on('fm:init', () => {
    fmMyTeamBricks = 0;
    fmTeammateMomentum = 0;
    updateFmMiniHouse();
  });

  socket.on('fm:placed', (data) => {
    // Only count placements from MY team toward MY mini-house
    if (data.team !== team) return;
    fmMyTeamBricks++;
    updateFmMiniHouse();
    // Random "your team is winning" Rewards toast — fires every ~3rd placement
    // so it's not spam but kids do see consistent positive feedback. Tier
    // escalates with brick count to mirror the streak ladder logic.
    fmTeammateMomentum++;
    if (window.Rewards) {
      const milestone = FM_PLAYER_STAGES.find((s) => s.at === fmMyTeamBricks);
      if (milestone && fmMyTeamBricks >= 4) {
        // Big milestone — fire an epic toast
        window.Rewards.show({
          tier: 'epic',
          icon: milestone.icon,
          text: `¡Tu equipo construyó ${fmMyTeamBricks} ladrillos!`,
          duration: 2000,
        });
      } else if (fmTeammateMomentum % 3 === 0) {
        const phrases = [
          '¡Vamos equipo!', '¡Buen trabajo!', '¡Tu equipo va genial!',
          '¡Sigan así!', '¡Casa subiendo!', '¡Muy bien equipo!',
          '¡A construir!', '¡Imparables!',
        ];
        const tier = fmMyTeamBricks >= 12 ? 'great' : 'common';
        window.Rewards.show({
          tier,
          icon: '🧱',
          text: phrases[Math.floor(Math.random() * phrases.length)],
        });
      }
    }
    // Combo broadcast — when MY team unlocks a combo, celebrate big
    if (Array.isArray(data.combos) && data.combos.length > 0 && window.Rewards) {
      const c = data.combos[0];
      window.Rewards.show({
        tier: 'epic',
        icon: c.emoji,
        text: `¡${c.name}! +${c.bonus}`,
        duration: 2200,
      });
    }
  });

  function updateFmMiniHouse() {
    const num = $('fm-mini-house-bricks');
    if (num) num.textContent = fmMyTeamBricks;
    const stageEl = $('fm-mini-house-stage');
    if (stageEl) {
      const cur = [...FM_PLAYER_STAGES].reverse().find((s) => fmMyTeamBricks >= s.at);
      if (cur) {
        stageEl.textContent = cur.icon;
        // Pulse the icon so the upgrade is visible
        stageEl.classList.remove('fm-mini-house-pulse');
        void stageEl.offsetWidth;
        stageEl.classList.add('fm-mini-house-pulse');
      }
    }
  }

  socket.on('fm:place-confirmed', ({ room, token, combos, teamScore }) => {
    if (fmTimerInt) { clearInterval(fmTimerInt); fmTimerInt = null; }
    if (document._fmMove) document.removeEventListener('pointermove', document._fmMove);
    if (document._fmUp) document.removeEventListener('pointerup', document._fmUp);
    document._fmMove = null;
    document._fmUp = null;
    if (typeof teamScore === 'number' && $('fm-place-score')) {
      $('fm-place-score').textContent = teamScore;
    }
    // Show combo banner if any unlocked
    if (Array.isArray(combos) && combos.length > 0) {
      const banner = $('fm-combo-banner');
      if (banner) {
        const lines = combos.map(c => `<span>${c.emoji} <strong>${c.name}</strong> +${c.bonus}</span>`).join('');
        banner.innerHTML = lines;
        banner.classList.remove('hidden');
        banner.classList.remove('pop');
        void banner.offsetWidth;
        banner.classList.add('pop');
        MochiSounds.winFanfare && MochiSounds.winFanfare();
        if (navigator.vibrate) navigator.vibrate([40, 30, 40, 30, 80]);
      }
    }
    // Next question handler will swap us off this screen automatically
  });

  // === Zombie Escape: persistent spooky ambience overlay ===
  // Lives in #zombie-ambience (sits above every screen). Random zombie peeks
  // from the screen edges + ambient groans, throughout the WHOLE zombie game,
  // not just during the sprint mini-game. Makes the entire match feel haunted.
  let zbAmbienceInterval = null;
  let zbAmbiencePeekTimer = null;

  function startZombieAmbience() {
    const layer = $('zombie-ambience');
    if (!layer) return;
    layer.classList.remove('hidden');
    // Force-unlock the audio context — the player WILL have tapped to join
    // at this point, but some browsers re-suspend the context after a long
    // idle. Without this the spooky groans were inaudible despite firing.
    if (window.unlockAudio) window.unlockAudio();
    if (zbAmbienceInterval) clearInterval(zbAmbienceInterval);
    if (zbAmbiencePeekTimer) clearTimeout(zbAmbiencePeekTimer);
    // More frequent ambient groan — every ~5s, 75% chance
    zbAmbienceInterval = setInterval(() => {
      if (document.hidden) return;
      if (Math.random() < 0.75) {
        if (MochiSounds.zombieGroan) MochiSounds.zombieGroan(0.55);
      }
    }, 5000);
    // Guaranteed first BIG jumpscare 4-6s after match start — establishes the
    // mood immediately so the player isn't waiting for randomness to deliver.
    setTimeout(() => {
      if (gameType === 'zombie' && !document.hidden) spawnBigZombieJumpscare();
    }, 4000 + Math.random() * 2000);
    scheduleSpookyEvent();
  }

  function stopZombieAmbience() {
    const layer = $('zombie-ambience');
    if (layer) {
      layer.classList.add('hidden');
      layer.innerHTML = '';
    }
    if (zbAmbienceInterval) { clearInterval(zbAmbienceInterval); zbAmbienceInterval = null; }
    if (zbAmbiencePeekTimer) { clearTimeout(zbAmbiencePeekTimer); zbAmbiencePeekTimer = null; }
  }

  // Random "spooky event" scheduler — picks one of many possible scares each cycle.
  // The variety (peek, BIG jumpscare, blood splat, screen crack, lights flicker,
  // hand grab from edge) makes the game feel unpredictable and alive instead of
  // just having the same little corner-emoji over and over.
  function scheduleSpookyEvent() {
    // Much tighter cadence so the game feels actively haunted — a scare
    // roughly every 3-7s instead of 5-13s. Combined with the guaranteed
    // first jumpscare, the player sees something every few seconds.
    const wait = 3000 + Math.random() * 4000;
    zbAmbiencePeekTimer = setTimeout(() => {
      spawnSpookyEvent();
      scheduleSpookyEvent();
    }, wait);
  }

  function spawnSpookyEvent() {
    if (gameType !== 'zombie') return;
    if (document.hidden) return;
    // Weighted roll over the available scare types. BIG jumpscare is the
    // headliner — it now rolls 40% of the time so kids see them often.
    const r = Math.random();
    if (r < 0.40)      spawnBigZombieJumpscare();   // 40% — the BIG one
    else if (r < 0.62) spawnHandGrab();              // 22%
    else if (r < 0.78) spawnZombiePeek();            // 16% (edge peek)
    else if (r < 0.88) spawnBloodSplat();            // 10%
    else if (r < 0.95) spawnLightsFlicker();         // 7%
    else               spawnScreenCrack();           // 5%
  }

  // BIG center-screen zombie jumpscare — the marquee scare. A huge zombie
  // face/torso lunges out of the middle of the screen, glows green, shakes
  // the world, and lets out a loud groan. Disappears after ~1.8s.
  function spawnBigZombieJumpscare() {
    const layer = $('zombie-ambience');
    if (!layer) return;
    const wrap = document.createElement('div');
    wrap.className = 'zb-bigscare';
    const variants = ['🧟', '🧟‍♂️', '🧟‍♀️', '👻', '💀', '👹'];
    const pick = variants[Math.floor(Math.random() * variants.length)];
    wrap.innerHTML = `
      <div class="zb-bigscare-glow"></div>
      <div class="zb-bigscare-emoji">${pick}</div>
      <div class="zb-bigscare-vignette"></div>
    `;
    layer.appendChild(wrap);
    // Audio: full scream + a chunky thump for that "in your face" punch.
    if (MochiSounds.zombieScream) MochiSounds.zombieScream();
    else if (MochiSounds.zombieGroan) MochiSounds.zombieGroan(0.95);
    setTimeout(() => { if (MochiSounds.heartbeat) MochiSounds.heartbeat(); }, 480);
    // Heavy haptic burst on phones
    if (navigator.vibrate) navigator.vibrate([60, 40, 120, 30, 80]);
    // Shake the body for emphasis (CSS hooked to .zb-world-shake)
    document.body.classList.add('zb-world-shake');
    setTimeout(() => document.body.classList.remove('zb-world-shake'), 700);
    setTimeout(() => wrap.remove(), 1800);
  }

  // Bloody handprint slaps onto the screen, drips, fades
  function spawnBloodSplat() {
    const layer = $('zombie-ambience');
    if (!layer) return;
    const splat = document.createElement('div');
    splat.className = 'zb-blood';
    splat.style.left = (10 + Math.random() * 70) + '%';
    splat.style.top  = (15 + Math.random() * 60) + '%';
    splat.textContent = ['🩸', '🖐', '✋'][Math.floor(Math.random() * 3)];
    layer.appendChild(splat);
    if (MochiSounds.zombieGroan) MochiSounds.zombieGroan(0.45);
    if (navigator.vibrate) navigator.vibrate([40, 20, 40]);
    setTimeout(() => splat.remove(), 2600);
  }

  // Spooky "the power is out" flicker — black overlay flashes a few times
  function spawnLightsFlicker() {
    const layer = $('zombie-ambience');
    if (!layer) return;
    const flick = document.createElement('div');
    flick.className = 'zb-flicker';
    layer.appendChild(flick);
    if (MochiSounds.zombieGroan) MochiSounds.zombieGroan(0.25);
    setTimeout(() => flick.remove(), 1400);
  }

  // Cracked-glass screen overlay — slams in then fades
  function spawnScreenCrack() {
    const layer = $('zombie-ambience');
    if (!layer) return;
    const crack = document.createElement('div');
    crack.className = 'zb-crack';
    crack.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M50,50 L10,15 M50,50 L92,8 M50,50 L98,55 M50,50 L88,92 M50,50 L50,98 M50,50 L8,90 M50,50 L4,50 M50,50 L20,30 M50,50 L75,25 M50,50 L80,70" ' +
      'stroke="rgba(255,255,255,0.9)" stroke-width="0.4" fill="none"/>' +
      '<path d="M30,30 L36,38 M70,30 L65,40 M30,70 L40,62 M70,70 L60,62" stroke="rgba(255,255,255,0.6)" stroke-width="0.25" fill="none"/>' +
      '</svg>';
    layer.appendChild(crack);
    if (MochiSounds.wrong) MochiSounds.wrong();
    if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
    document.body.classList.add('zb-world-shake');
    setTimeout(() => document.body.classList.remove('zb-world-shake'), 400);
    setTimeout(() => crack.remove(), 2200);
  }

  // Hand grabs in from an edge — feels like a zombie is trying to drag you
  function spawnHandGrab() {
    const layer = $('zombie-ambience');
    if (!layer) return;
    const sides = ['top', 'bottom', 'left', 'right'];
    const side = sides[Math.floor(Math.random() * sides.length)];
    const grab = document.createElement('div');
    grab.className = `zb-grab ${side}`;
    grab.textContent = Math.random() < 0.5 ? '🤚' : '🖐';
    const pos = 20 + Math.random() * 60;
    if (side === 'top' || side === 'bottom') grab.style.left = pos + '%';
    if (side === 'left' || side === 'right') grab.style.top = pos + '%';
    layer.appendChild(grab);
    if (MochiSounds.zombieGroan) MochiSounds.zombieGroan(0.5);
    if (navigator.vibrate) navigator.vibrate(45);
    setTimeout(() => grab.remove(), 1800);
  }

  function spawnZombiePeek() {
    if (gameType !== 'zombie') return;
    if (document.hidden) return;
    const layer = $('zombie-ambience');
    if (!layer) return;
    // Pick a side at random — top, bottom, left, right
    const sides = ['top', 'bottom', 'left', 'right'];
    const side = sides[Math.floor(Math.random() * sides.length)];
    const variants = ['🧟', '🧟‍♂️', '🧟‍♀️', '🤚', '👁'];
    const emoji = variants[Math.floor(Math.random() * variants.length)];
    const peek = document.createElement('div');
    peek.className = `zb-peek ${side}`;
    peek.textContent = emoji;
    // Random position along the chosen edge
    const pos = 15 + Math.random() * 70; // 15..85%
    if (side === 'top' || side === 'bottom') peek.style.left = pos + '%';
    if (side === 'left' || side === 'right') peek.style.top = pos + '%';
    layer.appendChild(peek);
    if (MochiSounds.zombieGroan) MochiSounds.zombieGroan(0.4);
    if (navigator.vibrate) navigator.vibrate(25);
    setTimeout(() => peek.remove(), 2400);
  }

  // Keep old name working — some callers still reference schedulePeek
  function schedulePeek() { scheduleSpookyEvent(); }

  // === Zombie Escape: timed-jump auto-runner ===
  // Pseudo-3D parallax environment (sky → mountains → skyline → smoke → horde
  // → ground/survivor → particles → jumpscare flash). Each layer is a discrete
  // DOM element so the render code is modular: swap in canvas/WebGL/sprites
  // later by replacing the drawLayer* helpers without touching game logic.
  //
  // Mechanic: survivor runs in place, obstacles approach, tap SALTAR to jump.
  // Successful jump = +1 step (server tap). Mistimed = stumble (red flash,
  // no points). Wrong vocab answer = survivor steps BACK -8m + screen rumble.
  let zbSprintActive = false;
  let zbSprintEndsAt = 0;
  let zbSprintStartAt = 0;
  let zbSprintCleared = 0;
  let zbObstacleSpawner = null;
  let zbObstacleCleanup = null;
  let zbTimerInterval = null;
  let zbHordeTimer = null;
  let zbJumping = false;
  let zbObstacleList = [];        // [{el, startedAt, durationMs, cleared}]
  let zbCombo = 0;                // consecutive successful jumps
  let zbBestCombo = 0;

  function startZombieSprint() {
    showScreen('zombie-sprint');
    zbSprintActive = true;
    zbSprintEndsAt = mashEndTime;
    zbSprintStartAt = Date.now();
    zbSprintCleared = 0;
    zbCombo = 0;
    zbBestCombo = 0;
    zbJumping = false;
    zbObstacleList = [];
    if ($('zb-sprint-cleared')) $('zb-sprint-cleared').textContent = '0';
    if ($('zb-sprint-name')) {
      const avatar = getMyAvatar();
      $('zb-sprint-name').textContent = `${avatar} ${myName}`;
    }
    const surv = $('zb-sprint-survivor');
    if (surv) {
      surv.textContent = team === 'red' ? '🏃' : '🏃‍♀️';
      surv.classList.remove('jumping', 'stumble');
    }
    const obsLayer = $('zb-sprint-obstacles');
    if (obsLayer) obsLayer.innerHTML = '';

    // Bind jump button
    const btn = $('zb-jump-btn');
    if (btn) {
      const onJump = (e) => {
        if (e) e.preventDefault();
        if (!zbSprintActive || zbJumping) return;
        doJump();
      };
      btn.onpointerdown = onJump;
      btn.onclick = onJump;
    }

    // Obstacle spawner — interval shrinks over time (difficulty ramp).
    // Re-arms itself with a fresh setTimeout each spawn so the cadence
    // actually scales with elapsed time.
    function scheduleNextObstacle() {
      if (!zbSprintActive) return;
      const elapsed = Date.now() - zbSprintStartAt;
      // Base 900ms → as low as 480ms after 60s. Rare double-spawns mix it up.
      const base = Math.max(480, 900 - elapsed * 7 / 1000);
      const jitter = 200 + Math.random() * 250;
      zbObstacleSpawner = setTimeout(() => {
        spawnObstacle();
        // 18% chance: also drop a power-up so the player has variety in what
        // they're tracking — not just dodge-dodge-dodge
        if (Math.random() < 0.18) setTimeout(spawnPowerUp, 250);
        scheduleNextObstacle();
      }, base + jitter);
    }
    scheduleNextObstacle();
    // Spawn the first obstacle immediately so they have something to react to
    setTimeout(spawnObstacle, 200);

    // Horde event: every 20-30s, send a tight cluster of 3 obstacles in a row.
    // Reads as "the horde just caught up to you" — pure adrenaline beat.
    function scheduleHorde() {
      if (!zbSprintActive) return;
      const wait = 20000 + Math.random() * 10000;
      zbHordeTimer = setTimeout(() => {
        if (!zbSprintActive) return;
        if (window.Rewards) window.Rewards.show({
          tier: 'epic', icon: '🧟', text: '¡VIENE LA HORDA!', duration: 1800,
        });
        if (MochiSounds.zombieScream) MochiSounds.zombieScream();
        if (document.body.classList) {
          document.body.classList.add('zb-world-shake');
          setTimeout(() => document.body.classList.remove('zb-world-shake'), 700);
        }
        spawnObstacle(true);
        setTimeout(() => spawnObstacle(true), 380);
        setTimeout(() => spawnObstacle(true), 760);
        scheduleHorde();
      }, wait);
    }
    scheduleHorde();

    // Unified 60Hz tick: collisions + scare cues + ambient audio
    if (zbObstacleCleanup) clearInterval(zbObstacleCleanup);
    zbObstacleCleanup = setInterval(zbTick, 60);
    zbLastAmbient = 0;

    // Countdown timer
    if (zbTimerInterval) clearInterval(zbTimerInterval);
    zbTimerInterval = setInterval(() => {
      const remaining = Math.max(0, zbSprintEndsAt - Date.now());
      const sec = Math.ceil(remaining / 1000);
      if ($('zb-sprint-timer-num')) $('zb-sprint-timer-num').textContent = sec;
      if (remaining <= 0) endZombieSprint();
    }, 100);
  }

  function spawnObstacle(isHorde) {
    if (!zbSprintActive) return;
    const layer = $('zb-sprint-obstacles');
    if (!layer) return;
    const el = document.createElement('div');
    el.className = 'zb-obstacle';
    const variants = ['🤚', '🪨', '🪦', '🦴', '🧟', '🧟‍♂️', '🐀', '🕷', '🦇'];
    const pick = variants[Math.floor(Math.random() * variants.length)];
    el.textContent = pick;
    // Zombies + horde events get the "scary" aura
    if (pick === '🧟' || pick === '🧟‍♂️' || isHorde) el.classList.add('scary');
    layer.appendChild(el);
    // Slide duration shrinks slightly over time — obstacles get faster.
    const elapsed = Date.now() - zbSprintStartAt;
    let duration = Math.max(900, 1500 - elapsed * 7 / 1000);
    if (isHorde) duration = Math.max(800, duration - 200);
    el.style.animation = `zb-obstacle-slide ${duration}ms linear forwards`;
    const entry = { el, startedAt: Date.now(), durationMs: duration, cleared: false, isScary: el.classList.contains('scary'), kind: 'obstacle' };
    zbObstacleList.push(entry);
    // Audio scare cue 30% of the time (or always for horde)
    entry.scareAt = (isHorde || Math.random() < 0.3) ? entry.startedAt + duration * 0.55 : 0;
    setTimeout(() => {
      el.remove();
      zbObstacleList = zbObstacleList.filter((o) => o !== entry);
    }, duration + 80);
  }

  // Power-up pickup — a star/coin that floats at survivor-height. Jumping
  // over it = collect + bonus +3. Missing one = no penalty. Adds variety
  // without making the game harder.
  function spawnPowerUp() {
    if (!zbSprintActive) return;
    const layer = $('zb-sprint-obstacles');
    if (!layer) return;
    const el = document.createElement('div');
    el.className = 'zb-obstacle zb-powerup';
    const powerups = [
      { icon: '⭐', val: 3, msg: '+3 ⭐' },
      { icon: '💎', val: 5, msg: '+5 💎' },
      { icon: '🎁', val: 4, msg: '+4 🎁' },
      { icon: '🪙', val: 2, msg: '+2 🪙' },
      { icon: '❤️', val: 3, msg: '+3 ❤️' },
    ];
    const pup = powerups[Math.floor(Math.random() * powerups.length)];
    el.textContent = pup.icon;
    layer.appendChild(el);
    const duration = 1700;
    // Two layered animations: scroll AND spin. Keep them on a single
    // animation property so the JS-set inline style still wins over CSS.
    el.style.animation = `zb-obstacle-slide ${duration}ms linear forwards, zb-powerup-spin 1.2s ease-in-out infinite`;
    const entry = {
      el, startedAt: Date.now(), durationMs: duration, cleared: false,
      isScary: false, kind: 'powerup', value: pup.val, msg: pup.msg,
    };
    zbObstacleList.push(entry);
    setTimeout(() => {
      el.remove();
      zbObstacleList = zbObstacleList.filter((o) => o !== entry);
    }, duration + 80);
  }

  // Periodic ambient zombie groan — distant audio that makes the env feel alive
  function zbAmbientGroan() {
    if (!zbSprintActive) return;
    // Quietly play a groan-like noise burst (we synthesize via sounds.js)
    if (MochiSounds.zombieGroan) MochiSounds.zombieGroan(0.5);
  }
  // Trigger a jumpscare flash + rumble + loud groan
  function zbJumpscare() {
    const flash = $('zb-jumpscare');
    const stage = $('zb-sprint-stage');
    if (flash) {
      flash.classList.remove('flash');
      void flash.offsetWidth;
      flash.classList.add('flash');
    }
    if (stage) {
      stage.classList.remove('rumble');
      void stage.offsetWidth;
      stage.classList.add('rumble');
    }
    if (MochiSounds.zombieGroan) MochiSounds.zombieGroan(1);
    if (navigator.vibrate) navigator.vibrate([30, 40, 60]);
  }

  function doJump() {
    if (zbJumping) return;
    zbJumping = true;
    const surv = $('zb-sprint-survivor');
    if (surv) {
      surv.classList.remove('stumble');
      void surv.offsetWidth;
      surv.classList.add('jumping');
    }
    if (MochiSounds.whoosh) MochiSounds.whoosh();
    if (navigator.vibrate) navigator.vibrate(20);
    setTimeout(() => {
      zbJumping = false;
      if (surv) surv.classList.remove('jumping');
    }, 600);
  }

  // Unified tick — drives collision detection, scare-trigger timing, and
  // ambient audio. Runs at 60Hz target via setInterval(16ms).
  function zbTick() {
    if (!zbSprintActive) return;
    const now = Date.now();
    const survHitZone = { min: 18, max: 32 }; // percent (survivor's x)
    zbObstacleList.forEach((obs) => {
      if (obs.cleared) return;
      const t = (now - obs.startedAt) / obs.durationMs;
      const pct = 100 - t * 110; // 100% → -10%
      // Scare cue — fires ONCE when the obstacle is mid-approach (~55% in)
      if (obs.scareAt && !obs.scareFired && now >= obs.scareAt) {
        obs.scareFired = true;
        // Scary obstacles trigger a louder jumpscare; normal ones get a faint groan
        if (obs.isScary) zbJumpscare();
        else if (MochiSounds.zombieGroan) MochiSounds.zombieGroan(0.35);
      }
      if (pct >= survHitZone.min && pct <= survHitZone.max) {
        if (obs.kind === 'powerup') {
          // Power-ups are always collected (player jumps over them OR walks
          // through them) — kid-friendly: don't punish good vibes.
          obs.cleared = true;
          // Each value point counts as a tap, so the server reflects the bonus
          for (let i = 0; i < obs.value; i++) socket.emit('player:tap', { pin });
          zbSprintCleared += obs.value;
          if ($('zb-sprint-cleared')) $('zb-sprint-cleared').textContent = zbSprintCleared;
          spawnSprintPop(obs.el, obs.msg);
          MochiSounds.correct && MochiSounds.correct();
          if (window.Rewards) window.Rewards.show({
            tier: 'great', icon: obs.el.textContent, text: '¡Bonus!', duration: 1200,
          });
        } else if (zbJumping) {
          // Clean jump — +1, advance combo counter
          obs.cleared = true;
          socket.emit('player:tap', { pin });
          zbSprintCleared++;
          zbCombo++;
          if (zbCombo > zbBestCombo) zbBestCombo = zbCombo;
          if ($('zb-sprint-cleared')) $('zb-sprint-cleared').textContent = zbSprintCleared;
          spawnSprintPop(obs.el, zbCombo >= 3 ? `+1 x${zbCombo}` : '+1');
          MochiSounds.correct && MochiSounds.correct();
          // Combo milestones — gentle rewards toast every few jumps
          if (window.Rewards && (zbCombo === 3 || zbCombo === 5 || zbCombo === 8 || zbCombo >= 10 && zbCombo % 5 === 0)) {
            if (zbCombo >= 10) window.Rewards.epic();
            else window.Rewards.combo(zbCombo);
          }
        } else {
          // Missed jump — reset combo, stumble
          obs.cleared = true;
          zbCombo = 0;
          const surv = $('zb-sprint-survivor');
          if (surv) {
            surv.classList.remove('stumble');
            void surv.offsetWidth;
            surv.classList.add('stumble');
          }
          spawnSprintPop(obs.el, '💥');
          if (navigator.vibrate) navigator.vibrate([60, 30, 60]);
          // Heavy stumble on scary obstacles = jumpscare too
          if (obs.isScary) zbJumpscare();
        }
      }
    });
    // Roll for an ambient groan every ~3s (purely atmospheric)
    if (!zbLastAmbient || now - zbLastAmbient > 3000) {
      zbLastAmbient = now;
      if (Math.random() < 0.4) zbAmbientGroan();
    }
  }
  let zbLastAmbient = 0;

  function spawnSprintPop(anchorEl, text) {
    const layer = $('zb-sprint-obstacles');
    if (!layer || !anchorEl) return;
    const pop = document.createElement('div');
    pop.className = 'zb-sprint-pop';
    pop.textContent = text;
    pop.style.left = anchorEl.style.left || '24%';
    layer.appendChild(pop);
    setTimeout(() => pop.remove(), 700);
  }

  function endZombieSprint() {
    zbSprintActive = false;
    // Spawner is now a chained setTimeout, not setInterval — use clearTimeout.
    if (zbObstacleSpawner) { clearTimeout(zbObstacleSpawner); zbObstacleSpawner = null; }
    if (zbObstacleCleanup) { clearInterval(zbObstacleCleanup); zbObstacleCleanup = null; }
    if (zbTimerInterval)   { clearInterval(zbTimerInterval);   zbTimerInterval   = null; }
    if (zbHordeTimer)      { clearTimeout(zbHordeTimer);       zbHordeTimer      = null; }
    // Celebrate the best combo if it was meaningful
    if (window.Rewards && zbBestCombo >= 5) {
      window.Rewards.show({
        tier: 'great', icon: '🏆', text: `¡Mejor combo x${zbBestCombo}!`, duration: 2000,
      });
    }
    // The next 'question' event will switch screens for us.
  }

  // === Dragon flight: swipe-up to flap ===
  // Different gesture from Mochi/Piñata tap-mash. The player swipes upward
  // anywhere on the screen; each successful upswipe lifts their team's
  // dragon. Server logic is unchanged — we re-use the player:tap event.
  let dragonFlapActive = false;
  let dragonFlapCount = 0;
  let dragonFlapTimerRaf = null;
  let dragonFlapPointer = null;
  let dragonFlapTapHandler = null;

  function startDragonFlap() {
    dragonFlapActive = true;
    dragonFlapCount = 0;
    showScreen('dragon-flap');
    const dragonEl = $('dr-flap-dragon');
    if (dragonEl) {
      dragonEl.textContent = team === 'red' ? '🐉' : '🐲';
      dragonEl.style.transform = '';
    }
    if ($('dr-flap-counter')) $('dr-flap-counter').textContent = '0';
    const fill = $('dr-flap-timer-fill');
    if (fill) fill.style.width = '100%';
    const area = $('dr-flap-area');
    if (!area) return;

    // === Swipe gesture detection ===
    let startY = 0, startT = 0, started = false, peakDeltaY = 0;
    function onDown(e) {
      if (!dragonFlapActive) return;
      e.preventDefault();
      started = true;
      peakDeltaY = 0;
      startY = e.clientY != null ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      startT = Date.now();
      dragonFlapPointer = e.pointerId;
      if (area.setPointerCapture && e.pointerId != null) {
        try { area.setPointerCapture(e.pointerId); } catch (_) {}
      }
    }
    function onMove(e) {
      if (!started || !dragonFlapActive) return;
      const cy = e.clientY != null ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      const dy = cy - startY; // negative = swiping up
      if (dy < peakDeltaY) peakDeltaY = dy;
      // Visual: dragon follows the finger upward in lock-step (capped at -180px)
      if (dragonEl) {
        const lift = Math.max(0, Math.min(180, -dy));
        dragonEl.style.transform = `translate(-50%, -${lift}px) rotate(-${lift * 0.06}deg)`;
      }
    }
    function onUp(e) {
      if (!started) return;
      started = false;
      const dt = Date.now() - startT;
      // Detect a valid upswipe: at least 50 px and faster than 800 ms
      if (peakDeltaY <= -50 && dt < 800) {
        registerFlap();
      }
      // Dragon settles back to base position
      if (dragonEl) {
        dragonEl.style.transition = 'transform 0.35s cubic-bezier(.22,1.6,.36,1)';
        dragonEl.style.transform = '';
        setTimeout(() => { if (dragonEl) dragonEl.style.transition = ''; }, 380);
      }
    }
    // Wire (and remove any previously-wired) listeners idempotently
    area.onpointerdown = onDown;
    area.onpointermove = onMove;
    area.onpointerup = onUp;
    area.onpointercancel = onUp;
    area.onpointerleave = (e) => { if (started) onUp(e); };

    // === Timer + auto-close ===
    cancelAnimationFrame(dragonFlapTimerRaf);
    const totalMs = mashEndTime - Date.now();
    function tick() {
      const remaining = Math.max(0, mashEndTime - Date.now());
      if (fill) fill.style.width = ((remaining / totalMs) * 100) + '%';
      if (remaining <= 0) {
        dragonFlapActive = false;
        // Next 'question' event drives the next transition.
        return;
      }
      dragonFlapTimerRaf = requestAnimationFrame(tick);
    }
    tick();
  }

  function registerFlap() {
    if (!dragonFlapActive) return;
    if (Date.now() > mashEndTime) {
      dragonFlapActive = false;
      return;
    }
    dragonFlapCount++;
    if ($('dr-flap-counter')) $('dr-flap-counter').textContent = dragonFlapCount;
    // Send to server — re-uses the same player:tap path so altitude logic and
    // host visuals (cloud puff fx + dragon climb) work unchanged.
    socket.emit('player:tap', { pin });
    if (navigator.vibrate) navigator.vibrate(25);
    MochiSounds.whoosh ? MochiSounds.whoosh() : (MochiSounds.thwack && MochiSounds.thwack());
    // "+1" popup pulses upward from the dragon to celebrate the flap
    const layer = $('dr-flap-popup-layer');
    const dragonEl = $('dr-flap-dragon');
    if (layer && dragonEl) {
      const pop = document.createElement('div');
      pop.className = 'dr-flap-popup';
      pop.textContent = '+1';
      // Position near the dragon's current center
      const dr = dragonEl.getBoundingClientRect();
      const lr = layer.getBoundingClientRect();
      pop.style.left = ((dr.left + dr.width / 2) - lr.left) + 'px';
      pop.style.top  = ((dr.top  + dr.height / 2) - lr.top)  + 'px';
      layer.appendChild(pop);
      setTimeout(() => pop.remove(), 800);
    }
  }

  // === Chinese Monopoly: full board on the player's phone ===
  // Each player sees a mini-replica of the host's board. Their character sits
  // on its current tile. After a correct vocab answer, the dice appears in
  // the center — player holds-and-throws — character walks tile-by-tile to
  // its destination — action toast pops over the landing tile.
  let mpMyChar = 0;
  let mpMyCharName = '';
  let mpTiles = [];                  // tile definitions from server
  let mpPlayersState = {};           // pid → { name, team, pos, money, char }
  let mpOwnership = {};              // tileId → 'red' | 'gold' | null
  let mpShakeInterval = null;
  let mpShakeValue = 1;
  let mpDiceLocked = false;
  let mpRollStartTime = 0;
  let mpHoldStartTime = 0;
  let mpIsHolding = false;
  let mpWalking = false;             // true while character animates around the board

  socket.on('mp:my-char', ({ charIdx, charName, welcome }) => {
    mpMyChar = (typeof charIdx === 'number') ? charIdx : 0;
    mpMyCharName = charName || '';
    const lobbyImg = $('mp-roll-char');
    if (lobbyImg) lobbyImg.src = '/assets/monopoly/chars/char-' + mpMyChar + '.png';
    if (welcome) showMonopolyWelcome();
  });

  // Personality phrases keyed by character index. Spanish-first with the
  // character's Chinese-flavored hook below it. Picks at random per intro
  // so kids see different greetings if they restart.
  const MP_CHAR_GREETINGS = [
    // 0 Mei (female adventurer)
    [
      { es: '¡Hola, soy Mei! ¡Vamos a la aventura!', cn: '我叫美! 加油!' },
      { es: '¡Soy Mei, la valiente! ¿Lista para ganar?',   cn: '我是美, 我很勇敢!' },
      { es: '¡Hola! Mei al ataque. ¡Vamos!',               cn: '我叫美! 我们走吧!' },
    ],
    // 1 Liáng (male adventurer)
    [
      { es: '¡Yo soy Liáng! ¡A conquistar el tablero!',  cn: '我叫亮! 加油!' },
      { es: '¡Liáng presente! Vamos a hacer fortuna.',     cn: '我是亮, 一起赚钱!' },
      { es: '¡Hola amigos! Soy Liáng. ¡Hagamos historia!', cn: '我叫亮! 我们走吧!' },
    ],
    // 2 Sara
    [
      { es: '¡Hola! Yo soy Sara. ¡Será divertido!',     cn: '我叫莎拉! 你好!' },
      { es: '¡Sara aquí! ¿Lista para los dados?',        cn: '我是莎拉! 加油!' },
      { es: '¡Hola jugador! Soy Sara. ¡A jugar!',        cn: '我叫莎拉! 我们走吧!' },
    ],
    // 3 Daniel
    [
      { es: '¡Soy Daniel! Vamos a ganar mucho dinero.', cn: '我叫丹尼尔! 加油!' },
      { es: '¡Daniel listo! ¿Tirarás un seis?',          cn: '我是丹尼尔, 加油!' },
      { es: '¡Hola! Daniel a la orden. ¡Vamos!',         cn: '我叫丹尼尔! 你好!' },
    ],
    // 4 Robot-Bao
    [
      { es: '*BIP BOOP* Robot-Bao en línea. ¡A ganar!', cn: '机器人 包! 加油!' },
      { es: 'Detectado: jugador genial. ¡Vamos!',        cn: '我是机器人! 你好!' },
      { es: 'Cálculos completos. ¡Hora de jugar!',       cn: '机器人 包 准备! 走!' },
    ],
    // 5 Zombi
    [
      { es: 'Aaargh… ¡digo, hola! Soy Zombi. 🧟',       cn: '我是僵尸! 你好...' },
      { es: '¡Cerebrooo… digo, vamos a jugar!',           cn: '僵尸 来了! 加油!' },
      { es: 'Zombi feliz hoy. ¡Vamos a tirar el dado!',   cn: '我叫僵尸! 走吧!' },
    ],
  ];

  function showMonopolyWelcome() {
    const wc = $('mp-welcome-char');
    const wn = $('mp-welcome-name');
    const btn = $('mp-welcome-btn');
    const bt = $('mp-welcome-bubble-text');
    const bc = $('mp-welcome-bubble-cn');
    if (wc) wc.src = '/assets/monopoly/chars/char-' + mpMyChar + '.png';
    if (wn) wn.textContent = mpMyCharName || 'Tu personaje';
    // Pick a random personality phrase for this character
    const bank = MP_CHAR_GREETINGS[mpMyChar] || MP_CHAR_GREETINGS[0];
    const phrase = bank[Math.floor(Math.random() * bank.length)];
    if (bt) bt.textContent = phrase.es;
    if (bc) bc.textContent = phrase.cn;
    showScreen('monopoly-welcome');
    MochiSounds.correct && MochiSounds.correct();
    if (MochiSounds.coinClink) setTimeout(() => MochiSounds.coinClink(), 250);
    if (window.unlockAudio) window.unlockAudio();
    // Spawn sparkle particles around the character on entry
    spawnMpWelcomeSparkles();
    // Auto-dismiss after 4s OR on button tap
    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      const qText = $('question-text');
      if (qText && qText.textContent && qText.textContent.length > 1) {
        showScreen('question');
      } else {
        showMiniBoardIdle();
      }
    };
    if (btn) {
      btn.onpointerdown = btn.onclick = (e) => {
        if (e) e.preventDefault();
        MochiSounds.correct && MochiSounds.correct();
        if (window.Rewards) window.Rewards.show({ tier: 'great', icon: '🎲', text: '¡A jugar!' });
        dismiss();
      };
    }
    setTimeout(dismiss, 4000);
  }

  // Random gold sparkle particles around the welcome card
  function spawnMpWelcomeSparkles() {
    const layer = $('mp-welcome-sparkles');
    if (!layer) return;
    layer.innerHTML = '';
    const icons = ['✨', '⭐', '💫', '🌟', '🎉', '💰', '🧧', '🪙'];
    for (let i = 0; i < 18; i++) {
      const s = document.createElement('div');
      s.className = 'mp-welcome-spark';
      s.textContent = icons[Math.floor(Math.random() * icons.length)];
      s.style.left = (Math.random() * 95) + '%';
      s.style.top  = (40 + Math.random() * 55) + '%';
      s.style.animationDelay = (Math.random() * 1.6) + 's';
      layer.appendChild(s);
      setTimeout(() => s.remove(), 3500);
    }
  }

  // Show the mini-board screen in view-only mode (no dice prompt) so the player
  // can see the board while waiting for their next question.
  function showMiniBoardIdle() {
    showScreen('monopoly-roll');
    placeAllTokensOnMiniBoard();
    const dice = $('mp-mini-dice');
    if (dice) dice.style.display = 'none';
    const hint = $('mp-roll-hint');
    if (hint) hint.textContent = 'Esperando la próxima pregunta…';
    const title = $('mp-roll-title');
    if (title) title.textContent = '👀 Mira el tablero';
    const fill = $('mp-roll-timer-fill');
    if (fill) fill.style.width = '0%';
    const action = $('mp-mini-action');
    if (action) action.classList.add('hidden');
  }

  socket.on('mp:init', (data) => {
    if (gameType !== 'monopoly') return;
    mpTiles = data.tiles || [];
    mpPlayersState = data.players || {};
    mpOwnership = data.ownership || {};
    // Build the mini-board scaffolding once. Tile positions stay static; only
    // tokens + ownership rings move/update.
    renderMiniBoard();
    updateOwnershipRings(mpOwnership);
    placeAllTokensOnMiniBoard();
  });

  socket.on('mp:move', (data) => {
    markActivity();
    if (gameType !== 'monopoly') return;
    // Update everyone's positions/money so the leaderboard + tokens stay in sync.
    if (mpPlayersState[data.playerId]) {
      mpPlayersState[data.playerId].pos = data.toPos;
      mpPlayersState[data.playerId].money = (typeof data.playerWealth === 'number') ? data.playerWealth : data.money;
    } else {
      mpPlayersState[data.playerId] = {
        name: data.playerName,
        team: data.team,
        pos: data.toPos,
        money: data.money,
        char: data.char
      };
    }
    // For OTHER players' moves, just relocate their token on our mini-board
    // (no need to animate the walk for them — host shows the cinematic).
    if (data.playerId !== myPlayerId) {
      moveOtherTokenInstant(data.playerId, data.toPos);
    }
    // Update ownership rings if any tile just got bought
    if (data.ownership) updateOwnershipRings(data.ownership);
  });

  // === Build the mini-board grid ===
  // Same perimeter logic as the host: 16 tiles around a 5x5 grid, center plate
  // holds the dice + action toast.
  function renderMiniBoard() {
    const board = $('mp-mini-board');
    if (!board || !mpTiles.length) return;
    // Remove any prior tile elements (preserve center)
    [...board.querySelectorAll('.mp-mini-tile')].forEach((el) => el.remove());
    mpTiles.forEach((t) => {
      const el = document.createElement('div');
      el.className = 'mp-mini-tile tile-' + t.type;
      el.id = 'mp-mini-tile-' + t.id;
      el.innerHTML = `
        <div class="mp-mini-icon">${t.icon}</div>
        <div class="mp-mini-name">${escapeHtml(t.name)}</div>
        <div class="mp-mini-tokens" id="mp-mini-tokens-${t.id}"></div>
      `;
      const { col, row } = miniTileGridPos(t.id);
      el.style.gridColumn = col;
      el.style.gridRow = row;
      board.appendChild(el);
    });
  }
  function miniTileGridPos(id) {
    if (id <= 3)  return { row: 1, col: id + 1 };
    if (id <= 7)  return { row: id - 3, col: 5 };
    if (id <= 11) return { row: 5, col: 13 - id };
    return { row: 17 - id, col: 1 };
  }

  function placeAllTokensOnMiniBoard() {
    // Wipe existing tokens
    mpTiles.forEach((t) => {
      const slot = $('mp-mini-tokens-' + t.id);
      if (slot) slot.innerHTML = '';
    });
    // Place every player's token on their current tile
    Object.entries(mpPlayersState).forEach(([pid, p]) => {
      const slot = $('mp-mini-tokens-' + (p.pos || 0));
      if (!slot) return;
      slot.appendChild(makeMiniTokenEl(pid, p));
    });
  }
  function makeMiniTokenEl(pid, p) {
    const t = document.createElement('div');
    t.id = 'mp-mini-token-' + pid;
    t.className = 'mp-mini-token ' + p.team + (pid === myPlayerId ? ' me' : '');
    t.title = p.name;
    const ch = (typeof p.char === 'number') ? p.char : 0;
    t.innerHTML = `<img src="/assets/monopoly/chars/char-${ch}.png" alt="">`;
    return t;
  }
  function moveOtherTokenInstant(pid, toPos) {
    const tok = document.getElementById('mp-mini-token-' + pid);
    const slot = $('mp-mini-tokens-' + toPos);
    if (tok && slot) slot.appendChild(tok);
    else if (slot && mpPlayersState[pid]) slot.appendChild(makeMiniTokenEl(pid, mpPlayersState[pid]));
  }
  function updateOwnershipRings(ownership) {
    mpTiles.forEach((t) => {
      if (t.type !== 'city') return;
      const el = $('mp-mini-tile-' + t.id);
      if (!el) return;
      el.classList.remove('owned-red', 'owned-gold');
      const owner = ownership[t.id];
      if (owner === 'red')  el.classList.add('owned-red');
      if (owner === 'gold') el.classList.add('owned-gold');
    });
  }

  // === Global guard against the browser's long-press save-image / context
  // menu showing up over the monopoly roll screen. Fires once per page; the
  // dice mechanic relies on rapid touches that otherwise trigger iOS Safari's
  // "Save Image to Photos" callout or Chrome's right-click menu.
  let _mpContextGuardBound = false;
  function bindMpContextGuard() {
    if (_mpContextGuardBound) return;
    _mpContextGuardBound = true;
    const screen = $('screen-monopoly-roll');
    if (screen) {
      screen.addEventListener('contextmenu', (e) => { e.preventDefault(); return false; }, { passive: false });
      screen.addEventListener('dragstart',   (e) => { e.preventDefault(); return false; }, { passive: false });
    }
  }

  function startMonopolyRoll(currentCash) {
    bindMpContextGuard();
    if (!mpTiles.length) {
      // Board state never arrived — request a resync so the server re-sends
      // mp:init + we can retry the roll. Without this, the player would be
      // stuck on the result screen indefinitely.
      console.warn('[mp] startMonopolyRoll without tiles — requesting resync');
      try { socket.emit('player:resync', { pin }); } catch (_) {}
      // Auto-roll a safety value so the game keeps moving for this player
      setTimeout(() => {
        try { socket.emit('monopoly:roll', { pin, roll: 1 + Math.floor(Math.random() * 6) }); } catch (_) {}
      }, 1500);
      return;
    }
    showScreen('monopoly-roll');
    // Make sure tokens reflect any moves we missed while on the question screen
    placeAllTokensOnMiniBoard();
    mpDiceLocked = false;
    mpIsHolding = false;
    mpWalking = false;
    mpShakeValue = 1 + Math.floor(Math.random() * 6);
    mpRollStartTime = Date.now();
    if ($('mp-roll-cash')) $('mp-roll-cash').textContent = currentCash;
    if ($('mp-roll-name')) $('mp-roll-name').textContent = myName || 'Tú';
    if ($('mp-roll-char')) $('mp-roll-char').src = '/assets/monopoly/chars/char-' + mpMyChar + '.png';
    if ($('mp-roll-title')) $('mp-roll-title').textContent = '🎲 ¡Sacude y lanza el dado!';
    const dice = $('mp-mini-dice');
    const hint = $('mp-roll-hint');
    const fill = $('mp-roll-timer-fill');
    const actionToast = $('mp-mini-action');
    if (actionToast) { actionToast.textContent = ''; actionToast.classList.add('hidden'); }
    if (fill) fill.style.width = '100%';
    if (dice) {
      dice.src = '/assets/monopoly/dice/dice-1.png';
      dice.classList.remove('shaking', 'tumbling', 'locked');
      dice.style.display = '';
    }
    if (hint) hint.textContent = '👆 ¡TAP TAP TAP! Toca el dado rápido';

    // Highlight my own token by re-placing it (so it gets the .me class glow)
    const myTok = document.getElementById('mp-mini-token-' + myPlayerId);
    if (myTok) myTok.classList.add('me');

    // === RAPID-TAP DICE MECHANIC ===
    // Old hold-to-shake was triggering mobile browsers' long-press "save image"
    // context menu. New flow: each tap shakes the dice + rolls a fresh value.
    // Stop tapping for 700ms (or hit "¡LANZAR!") → die locks on the last value.
    // Counts taps so we can show a Mario-Party-style "x5 taps!" pump-up.
    let tapCount = 0;
    let lastTapAt = 0;
    let settleTimer = null;
    let autoLockTimer = null;

    function rollTapShake(e) {
      if (e) {
        // CRITICAL: kill the browser long-press save-image / context menu
        // by both preventDefault on the touch event AND preventing the
        // contextmenu event (handled separately below).
        e.preventDefault();
      }
      if (mpDiceLocked) return;
      tapCount++;
      lastTapAt = Date.now();
      mpShakeValue = 1 + Math.floor(Math.random() * 6);
      if (dice) {
        dice.src = '/assets/monopoly/dice/dice-' + mpShakeValue + '.png';
        // Snap pop on each tap for visual juice
        dice.classList.remove('tapped');
        void dice.offsetWidth;
        dice.classList.add('tapped');
      }
      MochiSounds.tick && MochiSounds.tick();
      if (navigator.vibrate) navigator.vibrate(15);
      if (hint) {
        hint.textContent = tapCount < 3
          ? `🎲 ¡Tap tap tap! ${tapCount}`
          : tapCount < 6
            ? `🔥 ¡Sigue! x${tapCount}`
            : `💥 ¡Para que se asiente! x${tapCount}`;
      }
      // Reset the "you stopped tapping" timer — die locks 700ms after the
      // last tap so the player has full control over when to commit.
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => settleDice(), 700);
    }

    function settleDice() {
      if (mpDiceLocked) return;
      if (tapCount === 0) {
        // They never tapped — pick a fair random value so the round moves on.
        mpShakeValue = 1 + Math.floor(Math.random() * 6);
      }
      if (dice) {
        dice.classList.remove('tapped', 'shaking');
        dice.classList.add('tumbling');
      }
      MochiSounds.whoosh && MochiSounds.whoosh();
      if (navigator.vibrate) navigator.vibrate([30, 30, 60]);
      // Short tumble then lock
      let tumbleTicks = 5;
      function tumbleStep() {
        if (tumbleTicks-- <= 0) {
          // Final value — we use the LAST shake value the player saw, which
          // feels deterministic (no "the game lied to me" moment).
          if (dice) {
            dice.src = '/assets/monopoly/dice/dice-' + mpShakeValue + '.png';
            dice.classList.remove('tumbling');
            dice.classList.add('locked');
          }
          mpDiceLocked = true;
          MochiSounds.diceLand && MochiSounds.diceLand();
          if (navigator.vibrate) navigator.vibrate([40, 40, 80]);
          celebrateRollValue(mpShakeValue);
          if (hint) hint.textContent = `🎲 ¡Sacaste un ${mpShakeValue}! Tu personaje camina...`;
          socket.emit('monopoly:roll', { pin, roll: mpShakeValue });
          return;
        }
        const v = 1 + Math.floor(Math.random() * 6);
        if (dice) dice.src = '/assets/monopoly/dice/dice-' + v + '.png';
        setTimeout(tumbleStep, 90);
      }
      tumbleStep();
    }

    // Bind tap to BOTH the dice and the center plate, so the whole area
    // catches the input — kid-friendly hitbox.
    const center = dice && dice.closest('.mp-mini-center');
    [dice, center].filter(Boolean).forEach((el) => {
      el.onpointerdown = rollTapShake;
      // Belt-and-suspenders: block the browser context menu / save-image popup
      el.oncontextmenu = (e) => { e.preventDefault(); return false; };
      el.ondragstart  = (e) => { e.preventDefault(); return false; };
      el.onpointerup   = null;
      el.onpointercancel = null;
      el.onpointerleave  = null;
    });
    // Block iOS callout on the dice image itself
    if (dice) {
      dice.style.webkitTouchCallout = 'none';
      dice.draggable = false;
    }

    // Hard auto-lock after 8s in case the player never taps OR forgets to stop
    if (autoLockTimer) clearTimeout(autoLockTimer);
    autoLockTimer = setTimeout(() => { if (!mpDiceLocked) settleDice(); }, 8000);

    // Timer fill bar reflects the 8s deadline
    function tickTimer() {
      if (mpDiceLocked) return;
      const remaining = Math.max(0, (mpRollStartTime + 8000) - Date.now());
      if (fill) fill.style.width = ((remaining / 8000) * 100) + '%';
      if (remaining > 0) requestAnimationFrame(tickTimer);
    }
    requestAnimationFrame(tickTimer);
  }

  // === Server result handler: walk the character + show action toast ===
  socket.on('mp:result', (data) => {
    markActivity();
    if (gameType !== 'monopoly') return;
    if ($('mp-roll-title')) $('mp-roll-title').textContent = `🎲 ${data.roll || 0}  →  caminando…`;
    // Hide the dice during the walk (it served its purpose)
    const dice = $('mp-mini-dice');
    if (dice) dice.style.display = 'none';
    // Animate the character walking from fromPos → toPos one tile at a time
    walkOwnCharacter(data.fromPos, data.toPos, data.skipped, () => {
      // After walk: float a tile-action toast over the landing tile
      showActionToast(data);
      // Hold the celebration for ~2.2s, then signal the server we're ready
      // for the next question. The server has a 6.5s safety ceiling so even
      // if this signal gets lost, the next question still arrives.
      setTimeout(() => {
        const action = $('mp-mini-action');
        if (action) action.classList.add('hidden');
        try { socket.emit('monopoly:ready', { pin }); } catch (_) {}
      }, 2200);
    });
  });

  function walkOwnCharacter(fromPos, toPos, skipped, onDone) {
    if (skipped || fromPos === toPos) {
      if (onDone) onDone();
      return;
    }
    mpWalking = true;
    const tok = document.getElementById('mp-mini-token-' + myPlayerId);
    if (!tok) {
      // Couldn't find our token — place it on destination directly
      const slot = $('mp-mini-tokens-' + toPos);
      if (slot && mpPlayersState[myPlayerId]) {
        slot.appendChild(makeMiniTokenEl(myPlayerId, mpPlayersState[myPlayerId]));
      }
      mpWalking = false;
      if (onDone) onDone();
      return;
    }
    // === CAMERA MODE ===
    // Activate the cinematic camera: board scales up + pans to keep the
    // active tile near screen-center. Each step updates --cam-x / --cam-y
    // so CSS transitions handle the smooth glide between tiles.
    const board = $('mp-mini-board');
    if (board) board.classList.add('mp-camera-on');
    const total = mpTiles.length || 16;
    const steps = ((toPos - fromPos) + total) % total;
    let cur = fromPos, i = 0;

    // Pan camera to the starting tile right away
    panCameraToTile(fromPos);

    function step() {
      cur = (cur + 1) % total;
      i++;
      const slot = $('mp-mini-tokens-' + cur);
      const tile = $('mp-mini-tile-' + cur);
      if (slot) {
        slot.appendChild(tok);
        tok.classList.remove('walking');
        void tok.offsetWidth;
        tok.classList.add('walking');
      }
      // Camera FOLLOW — pan board so the current tile sits near center
      panCameraToTile(cur);
      // Tile trail flash
      if (tile) {
        tile.classList.remove('mp-mini-passed');
        void tile.offsetWidth;
        tile.classList.add('mp-mini-passed');
        setTimeout(() => tile.classList.remove('mp-mini-passed'), 600);
      }
      // Step counter chip
      showStepCount(i, steps);
      // Tile-name flyout — show what tile we're passing through (icon + name)
      // so the kid actually KNOWS where they are. This is the "professional
      // game studio camera reveal" feel.
      const tdef = mpTiles[cur];
      if (tdef) showTilePassBy(tdef);
      MochiSounds.footstep && MochiSounds.footstep();
      if (navigator.vibrate) navigator.vibrate(10);
      if (i < steps) {
        setTimeout(step, 360);  // slower so the camera reveal lands per tile
      } else {
        // Landing emphasis — a final thud + tile highlight
        MochiSounds.diceLand && MochiSounds.diceLand();
        if (tile) tile.classList.add('mp-mini-landed');
        setTimeout(() => tile && tile.classList.remove('mp-mini-landed'), 1200);
        // Camera holds on the landing tile briefly, then zooms back out
        setTimeout(() => {
          if (board) board.classList.remove('mp-camera-on');
          board && board.style.setProperty('--cam-x', '0px');
          board && board.style.setProperty('--cam-y', '0px');
        }, 1700);
        mpWalking = false;
        if (onDone) onDone();
      }
    }
    step();
  }

  // Pan the mini-board so that the given tile id sits near the visual center.
  // Math: each tile's grid (col, row) determines its position on a 5x5 grid.
  // Center of the board is (col=3, row=3). We translate the board by
  // (3 - col) * cellSize horizontally, (3 - row) * cellSize vertically,
  // scaled by the active --cam-scale (e.g. 1.6).
  function panCameraToTile(tileId) {
    const board = $('mp-mini-board');
    if (!board) return;
    const { col, row } = miniTileGridPos(tileId);
    // Each cell takes 1/5 of the board's content width. Pan distance is
    // computed in CSS by multiplying offsetFromCenter * cellPercent.
    // We pass the offset as a percentage so the same math works on any size.
    const offsetX = (3 - col) * 20; // %
    const offsetY = (3 - row) * 20; // %
    board.style.setProperty('--cam-x', offsetX + '%');
    board.style.setProperty('--cam-y', offsetY + '%');
  }

  // Tile pass-by reveal card — pops near the top of the screen as the
  // character walks across each tile so kids can read the name + icon.
  function showTilePassBy(tdef) {
    let card = document.getElementById('mp-passby-card');
    if (!card) {
      card = document.createElement('div');
      card.id = 'mp-passby-card';
      card.className = 'mp-passby-card';
      const screen = $('screen-monopoly-roll');
      if (screen) screen.appendChild(card);
    }
    card.className = 'mp-passby-card show tile-' + (tdef.type || 'city');
    card.innerHTML = `
      <div class="mp-passby-icon">${tdef.icon || '🏙'}</div>
      <div class="mp-passby-name">${escapeHtml(tdef.name || '')}</div>
      <div class="mp-passby-type">${tileTypeLabel(tdef.type)}</div>
    `;
    // auto-clear after the step interval so they don't pile up
    clearTimeout(card._timer);
    card._timer = setTimeout(() => card.classList.remove('show'), 420);
  }

  function tileTypeLabel(t) {
    switch (t) {
      case 'start':    return '🏯 SALIDA';
      case 'city':     return '🏙 CIUDAD';
      case 'festival': return '🏮 FIESTA';
      case 'jail':     return '🏛 CÁRCEL';
      case 'tax':      return '💰 IMPUESTO';
      case 'card':     return '🎴 CARTA';
      case 'treasure': return '🐉 TESORO';
      default:         return '';
    }
  }

  // Floating step counter that pops near the dice center as the player walks
  function showStepCount(i, total) {
    const center = document.querySelector('.mp-mini-center');
    if (!center) return;
    let chip = document.getElementById('mp-step-counter');
    if (!chip) {
      chip = document.createElement('div');
      chip.id = 'mp-step-counter';
      chip.className = 'mp-step-counter';
      center.appendChild(chip);
    }
    chip.textContent = `${i} / ${total}`;
    chip.classList.remove('pulse');
    void chip.offsetWidth;
    chip.classList.add('pulse');
    if (i === total) {
      // Clean up after the final step
      setTimeout(() => { chip.remove(); }, 900);
    }
  }

  // === Roll-value celebration ===
  // Rolling a 6 is a "crit" — fireworks + epic Rewards. 5 is a "great" tier.
  // 1-4 still get a small confetti burst so EVERY roll feels rewarded.
  function celebrateRollValue(n) {
    const center = document.querySelector('.mp-mini-center');
    if (!center) return;
    // Build a value reveal element
    const reveal = document.createElement('div');
    reveal.className = 'mp-roll-reveal';
    if (n === 6) reveal.classList.add('crit');
    else if (n === 5) reveal.classList.add('great');
    reveal.innerHTML = `
      <div class="mp-roll-reveal-burst"></div>
      <div class="mp-roll-reveal-num">${n}</div>
      <div class="mp-roll-reveal-tag">${n === 6 ? '¡SEIS PERFECTO!' : n === 5 ? '¡Excelente!' : '¡Tirada!'}</div>
    `;
    center.appendChild(reveal);
    setTimeout(() => reveal.remove(), 1300);
    // Rewards + audio
    if (n === 6) {
      MochiSounds.crit6 && MochiSounds.crit6();
      if (window.Rewards) window.Rewards.show({ tier: 'epic', icon: '🎲', text: '¡SEIS! ¡Tiro perfecto!', duration: 2000 });
      if (navigator.vibrate) navigator.vibrate([60, 40, 60, 40, 120]);
    } else if (n === 5) {
      MochiSounds.coinClink && MochiSounds.coinClink();
      if (window.Rewards) window.Rewards.show({ tier: 'great', icon: '🎲', text: `¡${n}! ¡Buena tirada!` });
    } else {
      if (window.Rewards) window.Rewards.show({ icon: '🎲', text: `¡Tiraste ${n}!` });
    }
  }

  // Per-tile-type cinematic reaction. Layers a full-screen overlay over the
  // mini-board for ~1.5s so each landing feels CONSEQUENTIAL, not flat.
  function playTileReaction(data) {
    const screen = $('screen-monopoly-roll');
    if (!screen) return;
    const layer = document.createElement('div');
    layer.className = 'mp-tile-fx';
    let inner = '';
    let extraClass = '';
    switch (data.action) {
      case 'bought':
        extraClass = 'fx-bought';
        inner = `
          <div class="mp-fx-deed">
            <div class="mp-fx-deed-banner">¡COMPRADO!</div>
            <div class="mp-fx-deed-name">${escapeHtml(data.tile ? data.tile.name : '')}</div>
            <div class="mp-fx-deed-stamp">MÍO</div>
            <div class="mp-fx-deed-cost">-¥${-data.moneyDelta}</div>
          </div>`;
        MochiSounds.titleStamp && MochiSounds.titleStamp();
        setTimeout(() => MochiSounds.cashRegister && MochiSounds.cashRegister(), 300);
        if (window.Rewards) window.Rewards.show({ tier: 'great', icon: '🏙', text: '¡Compraste una ciudad!', duration: 1700 });
        break;
      case 'own-city':
        extraClass = 'fx-own-city';
        inner = `<div class="mp-fx-icon">🏙</div><div class="mp-fx-tag">¡Tu ciudad!</div>`;
        MochiSounds.coinClink && MochiSounds.coinClink();
        if (window.Rewards) window.Rewards.show({ icon: '🏙', text: '¡Tu propiedad!' });
        break;
      case 'paid-rent':
        extraClass = 'fx-rent';
        inner = `
          <div class="mp-fx-icon mp-fx-rent-dragon">🐲</div>
          <div class="mp-fx-tag">¡Pagaste renta!</div>
          <div class="mp-fx-money loss">-¥${data.rentAmount}</div>`;
        MochiSounds.wrong && MochiSounds.wrong();
        break;
      case 'cant-afford':
        extraClass = 'fx-broke';
        inner = `<div class="mp-fx-icon">😅</div><div class="mp-fx-tag">Sin dinero</div>`;
        break;
      case 'card-bonus':
        extraClass = 'fx-card';
        inner = `
          <div class="mp-fx-card-flip">🎴</div>
          <div class="mp-fx-tag">¡Carta de fortuna!</div>
          <div class="mp-fx-money gain">+¥${data.moneyDelta}</div>`;
        MochiSounds.coinClink && MochiSounds.coinClink();
        setTimeout(() => MochiSounds.cashRegister && MochiSounds.cashRegister(), 220);
        if (window.Rewards) window.Rewards.show({ tier: 'great', icon: '🎴', text: '¡Carta!' });
        break;
      case 'treasure':
        extraClass = 'fx-treasure';
        inner = `
          <div class="mp-fx-icon mp-fx-dragon">🐉</div>
          <div class="mp-fx-coins" id="mp-fx-coins"></div>
          <div class="mp-fx-tag">¡TESORO DEL DRAGÓN!</div>
          <div class="mp-fx-money gain">+¥${data.moneyDelta}</div>`;
        MochiSounds.dragonRoar && MochiSounds.dragonRoar();
        setTimeout(() => MochiSounds.cashRegister && MochiSounds.cashRegister(), 500);
        if (window.Rewards) window.Rewards.epic();
        if (navigator.vibrate) navigator.vibrate([40, 30, 80, 30, 40]);
        break;
      case 'tax':
        extraClass = 'fx-tax';
        inner = `
          <div class="mp-fx-icon">💰</div>
          <div class="mp-fx-tag">Impuesto</div>
          <div class="mp-fx-money loss">-¥${-data.moneyDelta}</div>`;
        MochiSounds.wrong && MochiSounds.wrong();
        break;
      case 'festival':
        extraClass = 'fx-festival';
        inner = `
          <div class="mp-fx-lanterns">
            <span>🏮</span><span>🎊</span><span>🏮</span><span>🎉</span><span>🏮</span>
          </div>
          <div class="mp-fx-tag">¡FIESTA! 🎊</div>
          <div class="mp-fx-money gain">+¥${data.moneyDelta}</div>`;
        MochiSounds.festival && MochiSounds.festival();
        if (window.Rewards) window.Rewards.epic();
        if (navigator.vibrate) navigator.vibrate([30, 30, 30, 30, 60]);
        break;
      case 'jail':
        extraClass = 'fx-jail';
        inner = `
          <div class="mp-fx-bars"></div>
          <div class="mp-fx-icon">🏛</div>
          <div class="mp-fx-tag">¡A la cárcel!</div>
          <div class="mp-fx-subtag">Pierdes el próximo turno</div>`;
        MochiSounds.jailSlam && MochiSounds.jailSlam();
        if (navigator.vibrate) navigator.vibrate([120, 50, 80]);
        break;
      case 'start-bonus':
        extraClass = 'fx-start';
        inner = `
          <div class="mp-fx-icon">🏯</div>
          <div class="mp-fx-tag">¡Pasaste por 北京!</div>
          <div class="mp-fx-money gain">+¥${data.moneyDelta}</div>`;
        MochiSounds.cashRegister && MochiSounds.cashRegister();
        if (window.Rewards) window.Rewards.show({ tier: 'great', icon: '🏯', text: '¡Bonus de salida!' });
        break;
      case 'skipped':
        extraClass = 'fx-skipped';
        inner = `<div class="mp-fx-icon">💤</div><div class="mp-fx-tag">Turno perdido…</div>`;
        break;
      default:
        return;
    }
    layer.classList.add(extraClass);
    layer.innerHTML = inner;
    screen.appendChild(layer);
    // For treasure tiles, spawn falling-coin particles
    if (data.action === 'treasure') {
      const coinHost = layer.querySelector('#mp-fx-coins');
      if (coinHost) {
        for (let i = 0; i < 14; i++) {
          const c = document.createElement('div');
          c.className = 'mp-fx-coin';
          c.textContent = ['🪙', '💰', '🧧'][i % 3];
          c.style.left = (10 + Math.random() * 80) + '%';
          c.style.animationDelay = (i * 70) + 'ms';
          coinHost.appendChild(c);
        }
      }
    }
    setTimeout(() => layer.remove(), 1900);
  }

  function showActionToast(data) {
    // First: trigger the cinematic per-tile-type reaction overlay
    playTileReaction(data);
    const toast = $('mp-mini-action');
    if (!toast) return;
    let txt = '';
    switch (data.action) {
      case 'bought':       txt = `🏙 ¡Compraste!  -¥${-data.moneyDelta}`; break;
      case 'own-city':     txt = `🏙 Tu ciudad`; break;
      case 'paid-rent':    txt = `💸 Renta -¥${data.rentAmount}`; break;
      case 'cant-afford':  txt = `😅 Sin dinero`; break;
      case 'card-bonus':   txt = `🎴 +¥${data.moneyDelta}`; break;
      case 'treasure':     txt = `🐉 ¡Tesoro!  +¥${data.moneyDelta}`; break;
      case 'tax':          txt = `💰 Impuesto -¥${-data.moneyDelta}`; break;
      case 'festival':     txt = `🏮 ¡FIESTA! +¥${data.moneyDelta}`; break;
      case 'jail':         txt = `🏛 ¡A la cárcel!`; break;
      case 'start-bonus':  txt = `🏯 Salida +¥${data.moneyDelta}`; break;
      case 'skipped':      txt = `🏛 Turno perdido`; break;
      default:             txt = '';
    }
    toast.innerHTML = txt + `<div class="mp-mini-balance">💼 ¥${data.money}</div>`;
    toast.classList.remove('hidden');
    toast.classList.remove('pop');
    void toast.offsetWidth;
    toast.classList.add('pop');
  }

  function startMash() {
    showScreen('mash');
    const mashBtn = $('mash-button');
    let localTaps = 0;

    // Re-skin the headline / hint + button based on game
    if (gameType === 'pinata') {
      document.body.classList.add('pinata-active');
      document.body.classList.remove('dragon-flying-active', 'zombie-sprinting');
      if ($('mash-headline')) $('mash-headline').innerHTML = '🥢 ¡ROMPE EL TIGRE!';
      if ($('mash-hint')) $('mash-hint').innerHTML = 'Cada toque = un golpe a tu tigre. ¡Sigue golpeando hasta romperlo!';
      const mascotEl = $('mash-mascot');
      if (mascotEl) {
        mascotEl.textContent = '🐯';
        mascotEl.classList.remove('pinata-angry', 'pinata-furious', 'pinata-hit');
        mascotEl._pnTaps = 0;
      }
    } else {
      document.body.classList.remove('pinata-active', 'dragon-flying-active', 'zombie-sprinting');
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
      // Strip game-specific body classes so the next question screen is clean
      document.body.classList.remove('pinata-active', 'dragon-flying-active', 'zombie-sprinting');
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
    markActivity();
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
      pnSmashScreenTap();
    } else if (gameType === 'dragon-eye') {
      // Dragon: visuals happen at swipe-time on the flap screen.
    } else if (gameType === 'zombie') {
      const mascotEl = $('mash-mascot');
      if (mascotEl) {
        mascotEl.classList.remove('zb-sprint-hit');
        void mascotEl.offsetWidth;
        mascotEl.classList.add('zb-sprint-hit');
      }
      if (MochiSounds.whoosh) MochiSounds.whoosh();
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
    stopZombieAmbience();
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
    ['join', 'lobby', 'countdown', 'question', 'result', 'mash', 'pinata-smash', 'dragon-flap', 'monopoly-welcome', 'monopoly-roll', 'zombie-sprint', 'family-place', 'cs-walk', 'cc-play', 'mq-play', 'fl-play', 'end'].forEach((n) => {
      const el = $('screen-' + n);
      if (el) el.classList.toggle('hidden', n !== name);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
})();
