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
  // Reinos de Colores phone module (public/js/player-kingdoms.js); showScreen is hoisted.
  if (window.KingdomsPhone) {
    window.KingdomsPhone.init({ socket, getPin: () => pin, getTeam: () => team, showScreen: (n) => showScreen(n), markActivity: () => markActivity() });
  }
  if (window.PaintPhone) {
    window.PaintPhone.init({ socket, getPin: () => pin, getTeam: () => team, showScreen: (n) => showScreen(n), markActivity: () => markActivity() });
  }
  // Batalla de Nieve en Ski Dubái phone module (public/js/player-snow.js)
  if (window.SnowPhone) {
    window.SnowPhone.init({ socket, getPin: () => pin, getTeam: () => team, showScreen: (n) => showScreen(n), markActivity: () => markActivity() });
  }
  // La Gran Fuga de Dubái phone module (public/js/player-escape.js)
  if (window.EscapePhone) {
    window.EscapePhone.init({ socket, getPin: () => pin, getTeam: () => team, showScreen: (n) => showScreen(n), markActivity: () => markActivity() });
  }
  // Ojos de Halcón phone module (public/js/player-halcon.js): the kid's own Mario Party board
  if (window.HalconPhone) {
    window.HalconPhone.init({ socket, getPin: () => pin, getTeam: () => team, showScreen: (n) => showScreen(n), markActivity: () => markActivity() });
  }
  // Dàfùwēng · Monopolio v2 phone module (public/js/player-monopoly.js): the board around my piece, the question sheet,
  // the dice block, every space's moment, banners, ceremony
  if (window.MonoPhone) {
    window.MonoPhone.init({ socket, getPin: () => pin, getTeam: () => team, showScreen: (n) => showScreen(n), markActivity: () => markActivity() });
  }
  // Vuelo del Dragón v2 phone module (public/js/player-dragon.js): the race of 4 over Dubai, my dragoncito, the question
  // sheet, the flight (every swipe up = a wing beat), the star sprints, banners, ceremony
  if (window.DragonPhone) {
    window.DragonPhone.init({ socket, getPin: () => pin, getTeam: () => team, showScreen: (n) => showScreen(n), markActivity: () => markActivity() });
  }
  // Mochi Mash v2 phone module (public/js/player-mochi.js): run-in, mash zone, banners, ceremony
  if (window.MochiPhone) {
    window.MochiPhone.init({ socket, getPin: () => pin, getTeam: () => team, showScreen: (n) => showScreen(n), markActivity: () => markActivity() });
  }
  // Piñata Tigre v2 phone module (public/js/player-pinata.js): run-in, the hit with the timing meter, banners, ceremony
  if (window.PinataPhone) {
    window.PinataPhone.init({ socket, getPin: () => pin, getTeam: () => team, showScreen: (n) => showScreen(n), markActivity: () => markActivity() });
  }
  // 6-7 Swing v2 phone module (public/js/player-sixseven.js): run-in, the sums with the two giant buttons, banners, ceremony
  if (window.SixSevenPhone) {
    window.SixSevenPhone.init({ socket, getPin: () => pin, getTeam: () => team, showScreen: (n) => showScreen(n), markActivity: () => markActivity() });
  }
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
      // 4-SECOND CLIENT-SIDE SAFETY: re-enable buttons + hide overlay so the
      // player can RETAP if the server's answer-result never arrived. Without
      // this, a network hiccup left them stuck on a "Enviando…" screen with
      // disabled buttons. The bulletproof retry KEEPS firing in the
      // background — but the UI no longer blocks them.
      if (age > 4000 && pendingAnswer._uiRescued !== true) {
        pendingAnswer._uiRescued = true;
        hideSendingOverlay();
        document.querySelectorAll('.answer-btn').forEach((b) => {
          b.disabled = false;
          b.style.outline = '';
          b.style.transform = '';
        });
      }
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
  let myStudentCode = null;     // stable code persisted across sessions
  let gameType = 'mochi-mash';

  const $ = (id) => document.getElementById(id);

  const SHAPES = ['▲', '◆', '●', '■'];

  // Mute toggle
  $('mute-btn').addEventListener('click', () => {
    const muted = window.toggleMute();
    $('mute-btn').textContent = muted ? '🔇 Silencio' : '🔊 Sonido';
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
      const savedCode = (function () {
        try { return localStorage.getItem('dralyStudentCode') || null; }
        catch (_) { return null; }
      })();
      socket.emit('player:join', { pin, name: myName, avatar: getMyAvatar(), studentCode: savedCode }, (resp) => {
        if (resp.ok) {
          myPlayerId = resp.playerId; // new socket id after reconnect
          team = resp.team;
          if (resp.gameType) gameType = resp.gameType;
          // === Reset body gametype-* class on reconnect ===
          // Otherwise stale CSS from a previous gameType leaks through —
          // caused the "different interface on different devices" bug
          // when reconnecting between two different game sessions.
          document.body.className = (document.body.className || '')
            .split(/\s+/).filter((c) => !c.startsWith('gametype-')).join(' ');
          document.body.classList.add('gametype-' + gameType);
          if (resp.studentCode) {
            myStudentCode = resp.studentCode;
            try { localStorage.setItem('dralyStudentCode', resp.studentCode); } catch (_) {}
            const chip = document.getElementById('wu-player-code');
            if (chip) chip.textContent = resp.studentCode;
          }
          // === Pre-emptively route to the right SCREEN based on gameState +
          //     gameType. Otherwise the kid's old screen (e.g. a previous game's
          //     play screen) stays visible until a per-game
          //     init event arrives — and for some games, no such event ever
          //     fires unless they actively participate. This guarantees a
          //     correct landing screen on every reconnect. ===
          routePlayerForGameState(resp.gameState, gameType);
          hideReconnectOverlay();
        } else {
          showReconnectOverlay(resp.error || 'No pudimos volver a entrar. Revisa tu conexión.');
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
  // Show a visible 🎵 chip when the theme starts so the kid (and us) can
  // tell music actually fired. Auto-hides after ~3.5s.
  window.addEventListener('music-started', (e) => {
    const chip = document.getElementById('music-chip');
    const name = document.getElementById('music-chip-name');
    if (!chip) return;
    if (name) name.textContent = ((e.detail && e.detail.gameType) || 'theme') + ' · ' + ((e.detail && e.detail.bpm) || '') + 'bpm';
    chip.classList.remove('hidden');
    setTimeout(() => chip.classList.add('hidden'), 3500);
  });

  // Pre-fill PIN + name from URL (e.g., from home page or rematch link)
  const params = new URLSearchParams(location.search);
  const urlPin = params.get('pin');
  const urlName = params.get('name');
  const urlAutojoin = params.get('autojoin') === '1';
  if (urlPin) $('pin-input').value = urlPin;
  if (urlName) $('name-input').value = urlName;
  // 2026-10-12 — the join form lives on the home page card only (the old «Únete» screen here is gone)
  const backToHomeJoin = (err) => {
    const q = new URLSearchParams();
    if (urlPin) q.set('pin', urlPin);
    if (urlName) q.set('name', urlName);
    if (err) q.set('err', err);
    location.replace('/' + (q.toString() ? '?' + q.toString() : ''));
  };
  if (urlPin && urlName && urlAutojoin) {
    // Auto-fire join; a phone that can't reach the game in 15 s goes back to the card instead of waiting forever
    setTimeout(tryJoin, 50);
    setTimeout(() => { if (!pin) backToHomeJoin('No pudimos conectar con el juego. Inténtalo otra vez.'); }, 15000);
  } else {
    backToHomeJoin('');
  }

  $('join-btn').addEventListener('click', tryJoin);
  $('name-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryJoin(); });
  $('pin-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('name-input').focus(); });

  function tryJoin() {
    const p = $('pin-input').value.trim();
    const name = $('name-input').value.trim();
    if (!p || !name) {
      $('join-error').textContent = 'Escribe el PIN y tu nombre';
      return;
    }
    // Unlock audio at the FIRST user tap (join) so iOS Safari has its
    // AudioContext primed long before music tries to start. Otherwise the
    // ctx is created lazily on the much-later countdown event when the
    // gesture is already gone.
    if (window.unlockAudio) window.unlockAudio();
    // Send the persistent student code (if any) so the server links the
    // same physical phone to the same sentence-history record across
    // sessions / server restarts / class days.
    const savedCode = (function () {
      try { return localStorage.getItem('dralyStudentCode') || null; }
      catch (_) { return null; }
    })();
    socket.emit('player:join', { pin: p, name, avatar: getMyAvatar(), studentCode: savedCode }, (resp) => {
      if (!resp.ok) {
        const msg = resp.error || 'No pudimos entrar. Inténtalo otra vez.';
        $('join-error').textContent = msg;
        const jt = document.querySelector('.joining-text'); if (jt) jt.textContent = '¡Uy!';
        MochiSounds.wrong();
        setTimeout(() => backToHomeJoin(msg), 1400);   // fix the PIN / name on the home card
        return;
      }
      pin = p;
      team = resp.team;
      myName = name;
      myPlayerId = resp.playerId;
      gameType = resp.gameType || 'mochi-mash';
      // Persist the canonical code the server returned (may be the same
      // as savedCode, or a freshly-generated one if savedCode was null).
      if (resp.studentCode) {
        myStudentCode = resp.studentCode;
        try { localStorage.setItem('dralyStudentCode', resp.studentCode); }
        catch (_) { /* ignore */ }
        const chip = document.getElementById('wu-player-code');
        if (chip) chip.textContent = resp.studentCode;
      }
      // Tag <body> with the gameType so per-game UI (per-game CSS blocks)
      // becomes visible. Removing all gametype-* classes first ensures the
      // tag is exclusive — no leakage when a player rejoins a different round.
      document.body.className = (document.body.className || '')
        .split(/\s+/).filter((c) => !c.startsWith('gametype-')).join(' ');
      document.body.classList.add('gametype-' + gameType);
      // Remember this game for the Rematch button on the home page
      try {
        localStorage.setItem('dralyLastJoin', JSON.stringify({ pin: p, name, ts: Date.now() }));
      } catch (e) { /* ignore */ }
      $('join-error').textContent = '';
      MochiSounds.join();
      enterLobby();
      // If the game is already active when the kid joins (late-join),
      // immediately swap to the right active screen for this game type
      // instead of leaving them on the lobby + lantern. The per-game
      // init events from the server arrive shortly and populate content.
      if (resp.gameState === 'active') {
        routePlayerForGameState('active', gameType);
      }
    });
  }
  // Best-effort routing helper called on join + reconnect. Picks the
  // canonical "main" screen for each gameType in the active phase.
  // The server's per-game init events that follow can override this if
  // they have a more specific target.
  function routePlayerForGameState(gameState, gt) {
    if (gameState !== 'active') return;
    const screenForType = {
      'warmup':      'wu',
      'reading':     'rd',
      'sixseven':    'sixseven',
      'mochi-mash':  'question',
      'pinata':      'question',     // the hit screen opens itself after a right answer (player-pinata.js)
      'dragon-eye':  'dragon',       // the race is the kid's main screen (player-dragon.js)
      'monopoly':    'monopoly',     // the board is the kid's main screen (player-monopoly.js)
      'kingdoms':    'question',
      'paint':       'paint',
      'snow':        'snow',
      'escape':      'question',     // the zona segura room comes with es:init when the crew is in one
      'halcon':      'halcon',       // the kid's Mario Party board is the only screen
    };
    const target = screenForType[gt];
    if (target) showScreen(target);
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
  // 2026-10-12 — only our roster (his ask): the saga avatars (public/js/saga.js). The game carries each one's emoji
  // (hosts print it as text); the phone's picker shows the picture.
  const SAGA_AV = (window.Saga && window.Saga.AVATARS) || [];
  const AVATAR_CHOICES = SAGA_AV.map((x) => x.emoji);
  function getMyAvatar() {
    const v = localStorage.getItem('dralyAvatar');
    return AVATAR_CHOICES.includes(v) ? v : (AVATAR_CHOICES[0] || '🐉');   // an old animal emoji → Dralingo
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
    // already be looking at (lobby, mash, pinata, etc.)
    refreshAvatarHeaders();
  }

  // Pushes the new avatar into every spot on the page that shows the player's
  // own avatar (header tags, name labels, lobby mascot).
  function refreshAvatarHeaders() {
    const av = (typeof getMyAvatar === 'function') ? getMyAvatar() : '🐱';
    const nameWithAv = av ? `${av} ${myName || ''}`.trim() : (myName || '');
    if ($('player-name-tag')) $('player-name-tag').textContent = nameWithAv;
    if ($('mash-name-tag'))   $('mash-name-tag').textContent   = nameWithAv;
    // Lobby mascot: avatar · team-mascot combo. Re-build via updateTeamUI.
  }

  function renderAvatarPicker() {
    const grid = $('avatar-grid');
    if (!grid) return;
    const current = getMyAvatar();
    grid.innerHTML = '';
    AVATAR_CHOICES.forEach((a) => {
      const cell = document.createElement('div');
      cell.className = 'avatar-cell avatar-cell-saga' + (a === current ? ' selected' : '');
      const sv = SAGA_AV.find((x) => x.emoji === a);
      if (sv) { const im = document.createElement('img'); im.src = sv.url; im.alt = sv.label; im.draggable = false; cell.appendChild(im); }
      else cell.textContent = a;
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
    if (gameType === 'pinata') {
      // Piñata Tigre (since the 2026-10-15 remake: Fuego vs Mar, each team breaks its ladder of tiger piñatas)
      teamLabel = isRed ? 'Equipo Fuego' : 'Equipo Mar';
      teamMascot = isRed ? '🔥' : '🌊';
    } else if (gameType === 'dragon-eye') {
      teamLabel = 'Vuelo del Dragón';       // races of 4: every kid on their own dragoncito (no teams)
      teamMascot = '🐉';
    } else if (gameType === 'monopoly') {
      teamLabel = 'Dàfùwēng · Monopolio';   // boards of 4: every kid against the rivals of their board (no teams)
      teamMascot = '🎲';
    } else if (gameType === 'sixseven') {
      // 6-7 Swing (since the 2026-10-15 remake: Fuego vs Mar fill the pans of the golden balance)
      teamLabel = isRed ? 'Equipo Fuego' : 'Equipo Mar';
      teamMascot = isRed ? '🔥' : '🌊';
    } else if (gameType === 'kingdoms' || gameType === 'paint') {
      teamLabel = isRed ? 'Reino del Fuego' : 'Reino del Mar';
      teamMascot = isRed ? '🔥' : '🌊';
    } else if (gameType === 'snow') {
      teamLabel = 'Batalla de Nieve';      // no teams in the lobby: everyone starts as a survivor
      teamMascot = '❄️';
    } else if (gameType === 'escape') {
      teamLabel = 'La Gran Fuga de Dubái';  // co-op: the whole class is one crew
      teamMascot = '🚀';
    } else if (gameType === 'halcon') {
      teamLabel = 'Ojos de Halcón';         // boards of 4: every kid against the rivals of their board
      teamMascot = '🦅';
    } else if (gameType === 'mochi-mash') {
      // Mochi Mash (since the 2026-10-14 remake: Fuego vs Mar, each team feeds its Dragoncito)
      teamLabel = isRed ? 'Equipo Fuego' : 'Equipo Mar';
      teamMascot = isRed ? '🔥' : '🌊';
    } else {
      teamLabel = '¡Bienvenido!';        // class tools (warm-up, reading, HSK rooms): no teams
      teamMascot = '🐉';
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
    if ($('mash-mascot')) $('mash-mascot').textContent = '🍡';
  }

  socket.on('team-changed', ({ team: newTeam }) => {
    team = newTeam;
    updateTeamUI();
    MochiSounds.swap();
  });

  socket.on('countdown', () => {
    stopLobbyFlappy();
    showScreen('countdown');
    // === CRITICAL: each player phone runs its own audio. The host's music
    // never reaches the player's device — they have to start it locally.
    // Without this, kids playing on phones hear no music while the teacher's
    // laptop plays the theme nicely. ===
    if (window.unlockAudio) window.unlockAudio();
    if (MochiSounds.startGameTheme) {
      MochiSounds.startGameTheme(gameType);
    } else {
      MochiSounds.startMusic();
    }
    // (Random Dralingo pop-ins were here — disabled per user feedback;
    // they were too intrusive during active gameplay.)
    if (Dralingo && Dralingo.stopRandom) Dralingo.stopRandom();
    // === READING: jump to the reading-mirror screen ===
    if (gameType === 'reading') {
      setTimeout(() => showScreen('rd'), 800);
    }
    // === HSKSIM countdown handler intentionally a no-op — the
    // EARLY-REDIRECT in the state handler already moved this kid to
    // /hsk-sim.html before countdown ever fired. ===
    // === WARM-UP: jump to the read-only sentence-mirror screen ===
    if (gameType === 'warmup') {
      setTimeout(() => {
        showScreen('wu');
        renderWuStage([]);
      }, 1000);
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
        numEl.textContent = '¡YA!';      // kid UI is Spanish (was "GO!")
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
    if (gameType === 'monopoly') return;   // Dàfùwēng · Monopolio: the question is a sheet on the board (player-monopoly.js)
    if (gameType === 'dragon-eye') return; // Vuelo del Dragón: the question is a sheet under the race (player-dragon.js)
    // 6-7 Swing: its own screen (the sum + two giant buttons), drawn by player-sixseven.js (it listens to 'question')
    if (q.gameMode === 'sixseven' || gameType === 'sixseven') return;
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
      // sentence answers (exam simulacros, 2026-10-11) get smaller type so four of them still fit on a phone
      btn.className = 'answer-btn' + (a.length > 34 ? ' ans-xlong' : a.length > 16 ? ' ans-long' : '');
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

  // ===========================================================================
  // 📖 READING · cuento HSK1 sincronizado, audio + karaoke highlight
  // ===========================================================================
  // Per-game state. Server drives, this client mirrors.
  let rdStory = null;        // { title, subtitle, pages[] }
  let rdCurrentPageIdx = -1;
  let rdIsPlaying = false;
  let rdServerPlayStartedAt = 0;
  let rdServerAudioPosMs = 0;
  let rdServerOffsetMs = 0;
  let rdHighlightRafId = null;
  let rdLanguage = 'pinyin';
  let rdCurious = false;
  let rdStoryId = null;
  let rdPlaybackRate = 1.0;
  // Track if the student has triggered their personal local replay so we
  // don't fight the server's pause state — local replay is a one-shot.
  let rdLocalReplayActive = false;
  let rdTestQIdx = -1;          // current qIdx, -1 when no test
  let rdTestLockedQIdx = -1;    // qIdx the player has already locked an answer for
  let rdTestTimerInt = null;
  let rdTestDeadline = 0;
  // 🎬 ANIMATION VFX — teacher pushes any animation by fxId.
  // 2026-10-12 — the saga's animated stickers (public/js/saga.js), same list as the host
  const RD_ANIMATIONS_PLAYER = {};
  ((window.Saga && window.Saga.ANIMS) || []).forEach((a) => { RD_ANIMATIONS_PLAYER[a.id] = a.url; });
  socket.on('rd:vfx', (msg) => {
    if (!msg || !msg.fx) return;
    const url = RD_ANIMATIONS_PLAYER[msg.fx];
    const existing = document.getElementById('rd-turtle-overlay');
    if (msg.on && url) {
      if (existing) existing.remove();
      const ov = document.createElement('div');
      ov.id = 'rd-turtle-overlay';
      ov.className = 'rd-turtle-overlay';
      ov.innerHTML = '<img src="' + url + '" alt="animation">';
      ov.addEventListener('click', () => {
        ov.classList.remove('show');
        setTimeout(() => { try { ov.remove(); } catch (_) {} }, 250);
      });
      document.body.appendChild(ov);
      requestAnimationFrame(() => ov.classList.add('show'));
    } else if (existing) {
      existing.classList.remove('show');
      setTimeout(() => { try { existing.remove(); } catch (_) {} }, 250);
    }
  });
  // 🎵 Per-story music on the KID's phone too. Tracks last-started so
  // we don't restart the same theme on every state push. The Audio
  // Context resumes off the user's Join tap (real user gesture), so
  // music actually plays on iOS/Android.
  let _rdCurrentMusicTheme = null;
  function rdMaybeSwapMusic(themeName) {
    if (!window.MochiSounds || !themeName) return;
    if (themeName === _rdCurrentMusicTheme) return;
    try {
      if (MochiSounds.startGameTheme) {
        MochiSounds.startGameTheme(themeName);
        _rdCurrentMusicTheme = themeName;
      }
    } catch (_) {}
  }
  // 🎨 Apply per-story theme to the kid's body — purple/gold for Yugi,
  // teal/gold for Pīnpīn defaults, etc. CSS variables + a direct body
  // background swap so the kid's screen matches the teacher's screen.
  function rdApplyTheme(theme) {
    const body = document.body;
    if (!theme) {
      body.style.removeProperty('--story-primary');
      body.style.removeProperty('--story-accent');
      body.style.removeProperty('--story-bg');
      return;
    }
    if (theme.primary) body.style.setProperty('--story-primary', theme.primary);
    if (theme.accent)  body.style.setProperty('--story-accent',  theme.accent);
    if (theme.bgGrad) {
      body.style.setProperty('--story-bg', theme.bgGrad);
      body.style.background = theme.bgGrad;
      body.style.transition = 'background 0.6s ease';
    }
  }
  socket.on('rd:state', (state) => {
    if (gameType !== 'reading' || !state) return;
    // 🎵 Music + 🎨 Theme — propagated from server every state push.
    rdMaybeSwapMusic(state.music);
    rdApplyTheme(state.theme);
    // Story changed? Replace the local story snapshot and re-render.
    if (state.storyId && state.storyId !== rdStoryId) {
      rdStoryId = state.storyId;
      rdStory = { title: state.title, subtitle: state.subtitle, pages: state.pages };
      rdCurrentPageIdx = -1;  // force re-render below
      if ($('rd-player-page-max')) $('rd-player-page-max').textContent = rdStory.pages.length;
    } else if (state.pages && !rdStory) {
      rdStory = { title: state.title, subtitle: state.subtitle, pages: state.pages };
      if ($('rd-player-page-max')) $('rd-player-page-max').textContent = rdStory.pages.length;
    }
    // Force the reading screen — late-join safety
    if ($('screen-rd') && $('screen-rd').classList.contains('hidden')) {
      showScreen('rd');
    }
    if (typeof state.serverNow === 'number') {
      rdServerOffsetMs = Date.now() - state.serverNow;
    }
    if (typeof state.currentPage === 'number' && state.currentPage !== rdCurrentPageIdx) {
      rdCurrentPageIdx = state.currentPage;
      rdRenderPage();
    } else if (!$('rd-player-sentences') || !$('rd-player-sentences').firstChild) {
      rdRenderPage();
    }
    // Language changed? Re-render sentences in the new language without
    // touching the audio / playback state.
    const newLang = state.language || 'pinyin';
    if (newLang !== rdLanguage) {
      rdLanguage = newLang;
      if (rdStory && rdStory.pages[rdCurrentPageIdx]) {
        rdRenderSentences(rdStory.pages[rdCurrentPageIdx]);
      }
    }
    // Modo Curioso toggle. When ON, every pinyin word becomes tappable
    // to open the dictionary card. When OFF, taps do nothing and any
    // open Pokédex closes immediately.
    const newCurious = !!state.curious;
    if (newCurious !== rdCurious) {
      rdCurious = newCurious;
      const wrap = $('rd-player-sentences');
      if (wrap) wrap.classList.toggle('curious-on', rdCurious);
      if (!rdCurious && typeof hideWuPokedex === 'function') hideWuPokedex();
    }
    // 📝 Test mode — show/hide the overlay + render the current question.
    rdHandleTestState(state.test);
    rdServerPlayStartedAt = state.playStartedAt || 0;
    rdServerAudioPosMs = state.audioPosMs || 0;
    // Playback rate (slow-mo). Apply to local audio + reset any local-
    // replay state so server state stays authoritative.
    const newRate = state.playbackRate || 1.0;
    if (newRate !== rdPlaybackRate) {
      rdPlaybackRate = newRate;
      const audio = $('rd-player-audio');
      if (audio) audio.playbackRate = newRate;
    }
    // If teacher takes any action (play/pause/seek), cancel any in-progress
    // local-replay so the kid snaps back to class.
    rdLocalReplayActive = false;
    const wantPlay = !!state.isPlaying;
    rdSyncAudio(wantPlay);
    rdIsPlaying = wantPlay;
    const lbl = $('rd-pulse-label');
    if (lbl) lbl.textContent = wantPlay ? 'Escuchando…' : 'En pausa';
  });

  function rdRenderPage() {
    if (!rdStory) return;
    const page = rdStory.pages[rdCurrentPageIdx];
    if (!page) return;
    if ($('rd-player-page-now')) $('rd-player-page-now').textContent = (rdCurrentPageIdx + 1);
    // Image
    const imgWrap = $('rd-player-page-image');
    if (imgWrap) {
      imgWrap.innerHTML = `
        <img class="rd-player-img" src="${page.imageUrl}" alt="Página ${page.pageNum}"
             onerror="this.style.display='none'; this.parentNode.classList.add('no-image');">
        <span class="rd-player-image-placeholder">📷 Esperando imagen</span>`;
      imgWrap.classList.remove('no-image');
    }
    // Caption
    if ($('rd-player-caption')) $('rd-player-caption').textContent = page.caption || '';
    // Sentences
    rdRenderSentences(page);
    // Audio src
    const audio = $('rd-player-audio');
    if (audio) {
      audio.src = page.audioUrl;
      audio.currentTime = 0;
      // Apply the current playback rate so slow-mo carries over to the
      // newly loaded page.
      audio.playbackRate = rdPlaybackRate || 1.0;
      audio.onerror = () => {
        const lbl = $('rd-pulse-label');
        if (lbl) lbl.textContent = '🎵 Audio no disponible';
      };
      // === Auto-time karaoke ===
      // The story file declares audioDurationMs as a best-guess. When the
      // actual MP3 loads, we know the REAL duration from audio.duration.
      // If they differ by more than 200ms, scale every word's start/end
      // timestamp so the highlight matches the real narration pace. The
      // teacher doesn't have to manually tune audioDurationMs per page.
      audio.onloadedmetadata = () => {
        const realMs = (audio.duration || 0) * 1000;
        const declaredMs = page.audioDurationMs || realMs;
        if (realMs > 200 && declaredMs > 0 && Math.abs(realMs - declaredMs) > 200) {
          const scale = realMs / declaredMs;
          (page.words || []).forEach((w) => {
            w.startMs = Math.round(w.startMs * scale);
            w.endMs   = Math.round(w.endMs   * scale);
          });
          (page.sentenceRanges || []).forEach((r) => {
            r.startMs = Math.round(r.startMs * scale);
            r.endMs   = Math.round(r.endMs   * scale);
          });
          // Re-render so the new data-start/data-end attributes apply
          rdRenderSentences(page);
        }
      };
    }
  }
  function rdRenderSentences(page) {
    const wrap = $('rd-player-sentences');
    if (!wrap) return;
    wrap.innerHTML = '';
    wrap.dataset.lang = rdLanguage;
    if (rdLanguage === 'es') {
      // Spanish mode: sentence-level highlight, since cross-language
      // word order doesn't match.
      const ranges = page.sentenceRanges || [];
      const sentencesEs = page.sentencesEs || [];
      sentencesEs.forEach((esText, i) => {
        const range = ranges[i] || { startMs: 0, endMs: 0 };
        const line = document.createElement('div');
        line.className = 'rd-player-sentence rd-player-sentence-es';
        line.dataset.start = range.startMs;
        line.dataset.end = range.endMs;
        line.dataset.idx = i;
        line.textContent = esText;
        wrap.appendChild(line);
      });
    } else {
      // Pinyin: word-level karaoke
      const sentences = {};
      (page.words || []).forEach((w, idx) => {
        if (!sentences[w.sentenceIdx]) sentences[w.sentenceIdx] = [];
        sentences[w.sentenceIdx].push({ ...w, idx });
      });
      Object.keys(sentences).sort((a, b) => +a - +b).forEach((sIdx) => {
        const line = document.createElement('div');
        line.className = 'rd-player-sentence';
        sentences[sIdx].forEach((w) => {
          const span = document.createElement('span');
          span.className = 'rd-player-word';
          span.dataset.start = w.startMs;
          span.dataset.end = w.endMs;
          span.dataset.idx = w.idx;
          span.dataset.pinyin = w.pinyin;
          span.textContent = w.pinyin + ' ';
          // Modo Curioso: tap to open the dictionary card. Lookup
          // normalizes the pinyin string (lowercase + strip leading/
          // trailing punctuation) and finds it in WU_WORD_BY_PINYIN.
          span.addEventListener('click', () => {
            if (!rdCurious) return;
            const dict = window.lookupWuPinyin && window.lookupWuPinyin(w.pinyin);
            if (dict) {
              showWuPokedex(dict);
            } else {
              // Word isn't in the HSK1 dictionary — show a friendly fallback
              showWuPokedex({
                pinyin: w.pinyin,
                hanzi: '—',
                es: 'Esta palabra no está en el diccionario HSK1.',
                icon: '🔍',
                cat: 'pronoun',
                exp: 'exp1',
              });
            }
          });
          line.appendChild(span);
        });
        wrap.appendChild(line);
      });
    }
  }
  function rdComputeTargetPosMs() {
    if (!rdServerPlayStartedAt) return rdServerAudioPosMs;
    const nowOnServer = Date.now() - rdServerOffsetMs;
    const elapsed = Math.max(0, nowOnServer - rdServerPlayStartedAt);
    return rdServerAudioPosMs + elapsed * (rdPlaybackRate || 1.0);
  }
  function rdSyncAudio(wantPlay) {
    const audio = $('rd-player-audio');
    if (!audio) return;
    // While the student is on a personal local replay, ignore server sync
    // so we don't snap them out of it. The next server-driven event will
    // clear rdLocalReplayActive and they snap back to class playback.
    if (rdLocalReplayActive) return;
    const targetSec = rdComputeTargetPosMs() / 1000;
    if (Math.abs((audio.currentTime || 0) - targetSec) > 0.4) {
      try { audio.currentTime = targetSec; } catch (_) {}
    }
    if (wantPlay && audio.paused) {
      const p = audio.play();
      if (p && p.catch) p.catch(() => {
        // Autoplay blocked — show a hint banner. iOS Safari needs the
        // first user gesture before audio can fire.
        const lbl = $('rd-pulse-label');
        if (lbl) lbl.textContent = '👆 Toca la pantalla para escuchar';
      });
      rdStartHighlight();
    } else if (!wantPlay && !audio.paused) {
      audio.pause();
      rdStopHighlight();
    } else if (wantPlay) {
      rdStartHighlight();
    }
  }
  function rdStartHighlight() {
    if (rdHighlightRafId) return;
    const audio = $('rd-player-audio');
    const tick = () => {
      if (!audio) return;
      const tMs = (audio.currentTime || 0) * 1000;
      if (rdLanguage === 'es') {
        // Sentence-level highlight in Spanish mode
        const lines = document.querySelectorAll('#rd-player-sentences .rd-player-sentence-es');
        let activeIdx = -1;
        lines.forEach((line) => {
          const start = +line.dataset.start;
          const end = +line.dataset.end;
          if (tMs >= start && tMs < end) activeIdx = +line.dataset.idx;
        });
        lines.forEach((line) => {
          line.classList.toggle('active', +line.dataset.idx === activeIdx);
        });
      } else {
        // Word-level karaoke in pinyin mode
        const spans = document.querySelectorAll('#rd-player-sentences .rd-player-word');
        let activeIdx = -1;
        spans.forEach((s) => {
          const start = +s.dataset.start;
          const end = +s.dataset.end;
          if (tMs >= start && tMs < end) activeIdx = +s.dataset.idx;
        });
        spans.forEach((s) => {
          s.classList.toggle('active', +s.dataset.idx === activeIdx);
        });
      }
      if (audio.ended || audio.paused) {
        rdStopHighlight();
        return;
      }
      rdHighlightRafId = requestAnimationFrame(tick);
    };
    rdHighlightRafId = requestAnimationFrame(tick);
  }
  function rdStopHighlight() {
    if (rdHighlightRafId) cancelAnimationFrame(rdHighlightRafId);
    rdHighlightRafId = null;
  }
  // Tap-to-unlock-audio fallback for iOS Safari autoplay blocking
  document.addEventListener('click', () => {
    const audio = document.getElementById('rd-player-audio');
    if (audio && rdIsPlaying && audio.paused) {
      audio.play().catch(() => {});
      rdStartHighlight();
    }
  });
  // 🔁 Local replay — student's personal "play this page again" button.
  // Doesn't broadcast to the class. Plays the current page audio from
  // start at the current playback rate. If the teacher hits play/pause/
  // seek, the local replay is cancelled and the server state wins again.
  document.addEventListener('click', (e) => {
    if (!e.target || e.target.id !== 'rd-player-replay-btn') return;
    const audio = $('rd-player-audio');
    if (!audio) return;
    rdLocalReplayActive = true;
    audio.currentTime = 0;
    audio.playbackRate = rdPlaybackRate || 1.0;
    audio.play().catch(() => {
      // iOS audio unlock: user just tapped, so this should work
    });
    rdStartHighlight();
    const lbl = $('rd-pulse-label');
    if (lbl) lbl.textContent = '🔁 Tu reproducción';
    // When the audio finishes naturally, drop the local flag so the next
    // server sync (or teacher action) can run normally.
    audio.onended = () => {
      rdLocalReplayActive = false;
      if (lbl) lbl.textContent = rdIsPlaying ? 'Escuchando…' : 'En pausa';
    };
  });

  // === 📝 TEST MODE (player) ===
  // Driven by the state.test field on rd:state. Open the overlay when a
  // test is running; render the current question's choices; on tap emit
  // player:rd-test-answer with the picked index. Server fires rd:test-ack
  // back so we can lock in the chosen choice.
  function rdHandleTestState(test) {
    const overlay = $('rd-test-player');
    if (!test || !test.active) {
      // No active test
      if (overlay) overlay.classList.add('hidden');
      rdTestQIdx = -1;
      if (rdTestTimerInt) { clearInterval(rdTestTimerInt); rdTestTimerInt = null; }
      // Pause audio so it doesn't fight the (now hidden) test
      // (handled by server — it pauses on startTest)
      return;
    }
    // Active test — show overlay, render question
    if (overlay) overlay.classList.remove('hidden');
    // Hide any leftover result reveal
    const resWrap = $('rd-test-result');
    if (resWrap) resWrap.classList.add('hidden');
    // If qIdx changed, re-render choices and clear "locked"
    if (test.qIdx !== rdTestQIdx) {
      rdTestQIdx = test.qIdx;
      $('rd-test-qnow').textContent = (test.qIdx + 1);
      $('rd-test-qtotal').textContent = test.total;
      if (test.question) {
        $('rd-test-q').textContent = test.question.q;
        const wrap = $('rd-test-choices');
        wrap.innerHTML = '';
        (test.question.choices || []).forEach((c, i) => {
          const btn = document.createElement('button');
          btn.className = 'rd-test-choice';
          btn.type = 'button';
          btn.innerHTML = `<span class="rd-test-choice-letter">${String.fromCharCode(65 + i)}</span> ${rdEscapeHtml(c)}`;
          // Always allow re-tapping — students can change their mind any
          // time until the question advances. Server uses last-write-wins,
          // and resending the same answerIdx is a no-op.
          btn.onclick = () => {
            try { socket.emit('player:rd-test-answer', { pin, qIdx: rdTestQIdx, answerIdx: i }); } catch (_) {}
          };
          wrap.appendChild(btn);
        });
      }
      const locked = $('rd-test-locked');
      if (locked) locked.classList.add('hidden');
    }
    // Per-question countdown
    rdTestDeadline = test.deadline || 0;
    if (rdTestTimerInt) clearInterval(rdTestTimerInt);
    rdTestTimerInt = setInterval(() => {
      const remaining = Math.max(0, rdTestDeadline - Date.now());
      const t = $('rd-test-timer');
      if (t) t.textContent = Math.ceil(remaining / 1000) + 's';
      if (remaining <= 0) clearInterval(rdTestTimerInt);
    }, 200);
  }
  function rdEscapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  socket.on('rd:test-ack', (data) => {
    if (typeof data.qIdx !== 'number') return;
    rdTestLockedQIdx = data.qIdx;
    // Highlight the picked choice — BUT keep all buttons clickable so
    // the student can change their mind before the question advances.
    document.querySelectorAll('#rd-test-choices .rd-test-choice').forEach((b, i) => {
      b.classList.toggle('locked', i === data.answerIdx);
      // Don't disable — re-tap to change is allowed
      b.disabled = false;
    });
    const locked = $('rd-test-locked');
    if (locked) {
      locked.classList.remove('hidden');
      // Reword to reflect the "can change" behavior
      locked.innerHTML = '✓ Respuesta guardada. <strong>Puedes cambiarla</strong> antes de que pase la siguiente pregunta.';
    }
    if (MochiSounds.tap) MochiSounds.tap();
  });
  socket.on('rd:test-results', (data) => {
    // Find MY entry and show the score reveal
    const me = (data.results || []).find((r) => r.id === socket.id);
    if (!me) return;
    // Hide the test-in-progress overlay
    const overlay = $('rd-test-player');
    if (overlay) overlay.classList.add('hidden');
    rdTestQIdx = -1;
    rdTestLockedQIdx = -1;
    if (rdTestTimerInt) { clearInterval(rdTestTimerInt); rdTestTimerInt = null; }
    // Show the result-reveal screen
    const resWrap = $('rd-test-result');
    if (!resWrap) return;
    resWrap.classList.remove('hidden');
    const score = me.score || 0;
    const cert = score === 100 ? { emoji: '🏅', text: '¡PERFECTO!' }
              : score >=  80 ? { emoji: '⭐', text: '¡Excelente!' }
              : score >=  60 ? { emoji: '👍', text: '¡Bien hecho!' }
              : score >=  40 ? { emoji: '📚', text: 'Sigue practicando' }
              :                { emoji: '💪', text: '¡A repasar el cuento!' };
    $('rd-test-result-emoji').textContent = cert.emoji;
    $('rd-test-result-cert').textContent = cert.text;
    // Animate the score number counting up
    const numEl = $('rd-test-result-num');
    let cur = 0;
    const step = Math.max(1, Math.round(score / 30));
    const tick = () => {
      cur += step;
      if (cur >= score) { cur = score; numEl.textContent = cur; if (MochiSounds.winFanfare) MochiSounds.winFanfare(); return; }
      numEl.textContent = cur;
      setTimeout(tick, 30);
    };
    numEl.textContent = '0';
    setTimeout(tick, 200);
    // Per-question breakdown
    const bk = $('rd-test-result-breakdown');
    bk.innerHTML = '';
    (me.breakdown || []).forEach((b, i) => {
      const row = document.createElement('div');
      row.className = 'rd-test-bk-row ' + (b.gotRight ? 'ok' : 'no');
      row.innerHTML = `
        <span class="rd-test-bk-num">${i + 1}.</span>
        <span class="rd-test-bk-q">${rdEscapeHtml(b.q)}</span>
        <span class="rd-test-bk-verdict">${b.gotRight ? '✓' : '✕'}</span>
        <span class="rd-test-bk-ans">${rdEscapeHtml(b.correctText)}</span>`;
      bk.appendChild(row);
    });
  });
  // Close button on the result reveal
  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'rd-test-result-close') {
      const resWrap = $('rd-test-result');
      if (resWrap) resWrap.classList.add('hidden');
    }
  });

  // ===========================================================================
  // WARM-UP · read-only sentence mirror (teacher drives, player phone watches)
  // ===========================================================================
  let wuPlayerViewMode = 'text';
  let wuPlayerCurious = false;
  let wuPlayerIsDelegate = false;
  let wuPlayerIsJudge = false;     // can approve raise-hand requests
  let wuPlayerFrozen = false;      // teacher paused assistance
  let wuPlayerActiveExp = 'all';   // EXP filter on the player's own library
  let wuPlayerSearch = '';         // tone-stripped catalog search (asistente)
  let wuPlayerVisibleExps = null;  // null = all banks; else teacher-chosen ids
  let wuPlayerCustomWords = [];    // live teacher-created words
  function wuPlWord(wid) {
    return (window.WU_WORD_BY_ID && window.WU_WORD_BY_ID[wid])
        || wuPlayerCustomWords.find((w) => w.id === wid) || null;
  }
  // Tone-stripping normalizer (same forgiving semantics as /homework):
  // "ni hao" matches "nǐ hǎo". Lowercase → NFD → drop diacritics.
  function _wuNormalize(s) {
    return String(s == null ? '' : s)
      .toLowerCase().normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[.,!?;:'"()¿¡]/g, '')
      .replace(/\s+/g, ' ').trim();
  }
  let wuPlayerRearrange = false;   // local toggle — tap swaps instead of removes
  let wuPlayerSwapIdx = null;      // index of the first-selected word in swap
  let wuPlayerLastSentence = [];   // remember most recent sentence for re-renders
  // ⏱ Player-side time-machine countdown (driven by server timer.endsAt).
  let _wuPlTimerInt = null;
  function applyWuPlayerTimer(timer) {
    const badge = document.getElementById('wu-player-countdown');
    const num = document.getElementById('wu-player-countdown-num');
    if (_wuPlTimerInt) { clearInterval(_wuPlTimerInt); _wuPlTimerInt = null; }
    if (!timer || !timer.endsAt) {
      if (badge) badge.classList.add('hidden');
      document.body.classList.remove('wu-timemachine');
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000));
      if (num) num.textContent = left;
      if (badge) {
        badge.classList.remove('hidden');
        badge.classList.toggle('wu-countdown-low', left <= 5);
      }
      document.body.classList.add('wu-timemachine');
      if (left <= 0) {
        clearInterval(_wuPlTimerInt); _wuPlTimerInt = null;
        if (badge) badge.classList.add('wu-countdown-done');
        try { if (MochiSounds.flatlineAlarm) MochiSounds.flatlineAlarm(); } catch (_) {}
        setTimeout(() => {
          if (badge) { badge.classList.add('hidden'); badge.classList.remove('wu-countdown-done', 'wu-countdown-low'); }
          document.body.classList.remove('wu-timemachine');
        }, 2000);
      }
    };
    tick();
    _wuPlTimerInt = setInterval(tick, 250);
  }

  socket.on('wu:state', (data) => {
    if (gameType !== 'warmup') return;
    if (data.viewMode) wuPlayerViewMode = data.viewMode;
    wuPlayerCurious = !!data.curious;
    wuPlayerVisibleExps = Array.isArray(data.visibleExps) ? data.visibleExps : null;
    wuPlayerCustomWords = Array.isArray(data.customWords) ? data.customWords : [];
    if (wuPlayerIsDelegate) { renderPlayerExpTabs(); renderPlayerLibrary(); }  // refresh if banks changed
    if (!wuPlayerCurious) hideWuPokedex();
    // === Late-join safety: ensure we're on screen-wu ===
    const onWu = document.getElementById('screen-wu') &&
      !document.getElementById('screen-wu').classList.contains('hidden');
    if (!onWu) showScreen('wu');
    // === DELEGATE CHECK === Are WE in the delegates list?
    const delegates = Array.isArray(data.delegates) ? data.delegates : [];
    const wasDelegate = wuPlayerIsDelegate;
    wuPlayerIsDelegate = delegates.indexOf(myName) >= 0;
    const adminWrap = document.getElementById('wu-player-admin');
    if (adminWrap) adminWrap.classList.toggle('hidden', !wuPlayerIsDelegate);
    // Hide the "raise hand" button once they ARE an asistente.
    const handBtn = document.getElementById('wu-player-hand-btn');
    if (handBtn) handBtn.classList.toggle('hidden', wuPlayerIsDelegate);
    // === JUDGE CHECK === are WE a juez (can approve raise-hands)?
    const judges = Array.isArray(data.judges) ? data.judges : [];
    wuPlayerIsJudge = judges.indexOf(myName) >= 0;
    // === FREEZE === teacher paused assistance. Delegates stay in the UI but
    // can't touch — disable their builder + show a paused note. Either a
    // global freeze OR this kid's name in the selective freeze list.
    const frozenNames = Array.isArray(data.frozenNames) ? data.frozenNames : [];
    wuPlayerFrozen = !!data.frozen || frozenNames.indexOf(myName) >= 0;
    // === ⏱ TIME MACHINE === teacher's countdown, shown to everyone.
    applyWuPlayerTimer(data.timer);
    // Just promoted? Render the library + bind controls
    if (wuPlayerIsDelegate && !wasDelegate) {
      renderPlayerExpTabs();
      renderPlayerLibrary();
      bindPlayerAdminControls();
      if (MochiSounds.winFanfare) MochiSounds.winFanfare();
    }
    // Apply freeze visual: dim + disable the builder for delegates.
    if (adminWrap) {
      adminWrap.classList.toggle('wu-frozen', wuPlayerIsDelegate && wuPlayerFrozen);
      adminWrap.querySelectorAll('button').forEach((b) => {
        if (wuPlayerIsDelegate && wuPlayerFrozen) b.setAttribute('disabled', 'disabled');
        else b.removeAttribute('disabled');
      });
    }
    // Update hint
    const hint = document.getElementById('wu-player-hint');
    if (hint) {
      if (wuPlayerIsDelegate && wuPlayerFrozen) {
        hint.innerHTML = '⏸ <strong>El maestro pausó la asistencia.</strong> Espera tu turno…';
      } else if (wuPlayerIsDelegate) {
        hint.innerHTML = '🎓 <strong>¡Eres asistente!</strong> Toca palabras abajo para construir.';
      } else if (wuPlayerIsJudge) {
        hint.innerHTML = '⚖️ <strong>¡Eres juez!</strong> Aprueba a quién puede ser asistente.';
      } else if (wuPlayerCurious) {
        hint.innerHTML = '🔍 <strong>¡Modo Curioso!</strong> Toca una palabra para explorar.';
      } else {
        hint.innerHTML = 'Los colores que coinciden te ayudan a ver la estructura.';
      }
    }
    renderWuStage(data.sentence || []);
    // Super-maestro challenge prompt (carried in state for late-joiners)
    applyWuPrompt(typeof data.prompt === 'string' ? data.prompt : null);
  });

  // Live prompt push (super maestro typed/cleared a Spanish challenge)
  socket.on('wu:prompt', (data) => {
    if (gameType !== 'warmup') return;
    applyWuPrompt(data && typeof data.text === 'string' ? data.text : '');
  });
  // Show/hide the challenge banner on the player's warmup screen.
  function applyWuPrompt(text) {
    if (text === null || text === undefined) return;  // state didn't carry it
    const wrap = document.getElementById('wu-player-prompt');
    const t    = document.getElementById('wu-player-prompt-text');
    if (!wrap || !t) return;
    const clean = String(text).trim();
    if (!clean) {
      wrap.classList.add('hidden');
      t.textContent = '';
      return;
    }
    t.textContent = clean;
    wrap.classList.remove('hidden');
    if (MochiSounds && MochiSounds.tap) MochiSounds.tap();
  }

  // 🔊 GLOBAL AUDIO — every student can play the current warmup sentence in
  // a native (Google) voice, not just the teacher. Wired once at load.
  let _wuTtsAudio = null;
  function speakChineseWU(text, btn) {
    const clean = String(text || '').trim();
    if (!clean) return;
    // Stop any prior playback
    if (_wuTtsAudio) { try { _wuTtsAudio.pause(); _wuTtsAudio.removeAttribute('src'); _wuTtsAudio.load(); } catch (_) {} _wuTtsAudio = null; }
    if ('speechSynthesis' in window) { try { window.speechSynthesis.cancel(); } catch (_) {} }
    let orig = '';
    const restore = () => { if (btn) { btn.classList.remove('speaking'); btn.textContent = orig; } };
    if (btn) { btn.classList.add('speaking'); orig = btn.textContent; btn.textContent = '🔊 …'; }
    const audio = new Audio();
    _wuTtsAudio = audio;
    let played = false, fell = false;
    const fallback = () => {
      if (fell || played) return;
      fell = true;
      try { audio.pause(); audio.removeAttribute('src'); audio.load(); } catch (_) {}
      restore();
      if ('speechSynthesis' in window) {
        try { const u = new SpeechSynthesisUtterance(clean); u.lang = 'zh-CN'; u.rate = 0.85; u.onend = restore; window.speechSynthesis.speak(u); } catch (_) {}
      }
    };
    audio.addEventListener('canplay', () => { if (!fell) audio.play().then(() => { played = true; }).catch(() => { if (!played) fallback(); }); });
    audio.addEventListener('playing', () => { played = true; if ('speechSynthesis' in window) { try { window.speechSynthesis.cancel(); } catch (_) {} } });
    audio.addEventListener('ended', restore);
    audio.addEventListener('error', () => { if (!played) fallback(); });
    const to = setTimeout(() => { if (!played) fallback(); }, 10000);
    audio.addEventListener('playing', () => clearTimeout(to));
    audio.src = '/api/tts?text=' + encodeURIComponent(clean);
    audio.load();
  }
  (function bindWuPlayerSpeak() {
    const btn = document.getElementById('wu-player-speak-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (window.unlockAudio) window.unlockAudio();
      const pinyin = (wuPlayerLastSentence || [])
        .map((wid) => {
          const w = (window.WU_WORD_BY_ID && window.WU_WORD_BY_ID[wid])
                 || (wuPlayerCustomWords || []).find((cw) => cw && cw.id === wid);
          return (w && w.pinyin) || '';
        })
        .filter(Boolean).join(' ');
      if (!pinyin) {
        const o = btn.textContent; btn.textContent = '🔇 (vacío)';
        setTimeout(() => { btn.textContent = o; }, 1200);
        return;
      }
      speakChineseWU(pinyin, btn);
    });
  })();
  // 🔍 Asistente catalog search — tone-forgiving, like the teacher's.
  (function bindWuPlayerSearch() {
    const input = document.getElementById('wu-player-search');
    const clear = document.getElementById('wu-player-search-clear');
    if (input) {
      input.addEventListener('input', () => {
        wuPlayerSearch = _wuNormalize(input.value);
        if (clear) clear.classList.toggle('hidden', !input.value);
        renderPlayerLibrary();
      });
    }
    if (clear) {
      clear.addEventListener('click', () => {
        if (input) input.value = '';
        wuPlayerSearch = '';
        clear.classList.add('hidden');
        renderPlayerLibrary();
        if (input) input.focus();
      });
    }
  })();
  // ✋ Raise hand to become an asistente (gamified request to the teacher).
  (function bindWuPlayerHand() {
    const btn = document.getElementById('wu-player-hand-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      socket.emit('wu:raise-hand', { pin });
      if (MochiSounds && MochiSounds.tap) MochiSounds.tap();
      const o = btn.textContent;
      btn.textContent = '✋ ¡Mano levantada!';
      btn.classList.add('raised');
      setTimeout(() => { btn.textContent = o; btn.classList.remove('raised'); }, 2500);
    });
  })();

  // === VFX ON PLAYER SCREENS === the host broadcasts wu:fx; every phone
  // renders the same effect so the fun is uniform everywhere (spectators AND
  // asistentes). Self-contained — creates its own fixed overlay layer.
  socket.on('wu:fx', (d) => {
    if (gameType !== 'warmup' || !d || !d.kind) return;
    playerFireFx(d.kind);
  });
  // 🎬 PERSISTENT ANIMATION OVERLAYS — broadcast from the teacher's
  // Animaciones panel in host-warmup. Different from wu:fx (one-shot
  // particle bursts) — these are full-screen transparent GIFs that
  // stay on the kid's screen until the teacher toggles them off.
  // 2026-10-12 — the saga's animated stickers only (public/js/saga.js); the brand GIFs are gone
  const WU_ANIM_URL_PLAYER = {};
  ((window.Saga && window.Saga.ANIMS) || []).forEach((a) => { WU_ANIM_URL_PLAYER[a.id] = a.url; });
  // 🖼 DESCRIBE-THE-IMAGE — 2026-06-08 (Fernando). Teacher broadcasts a
  // picture from the HSK sims; show it BIG and centered on the kid's
  // phone so the class describes it together. Stays until the teacher
  // sends a null url (clears it) or the game ends. Tap-through allowed
  // so the kid can still use the builder underneath if delegated.
  socket.on('wu:image', (d) => {
    if (gameType !== 'warmup') return;
    let ov = document.getElementById('wu-describe-image');
    if (d && d.url) {
      if (!ov) {
        ov = document.createElement('div');
        ov.id = 'wu-describe-image';
        // 🆕 2026-06-08 (Fernando): COEXIST with the sentence builder.
        // This is a top BANNER, not a full-screen takeover — it pins to
        // the top ~40% and leaves the builder fully visible + usable
        // below. pointer-events:none so taps pass straight through to
        // whatever's underneath (the builder, Curious Mode, etc.).
        // The kid gets a small ✕ to collapse it if it's in their way;
        // the teacher's "Quitar" still clears it for everyone.
        ov.style.cssText = [
          'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:9000',
          'display:flex', 'flex-direction:column', 'align-items:center',
          'padding:8px 10px 10px', 'pointer-events:none',
          'background:linear-gradient(180deg,rgba(8,12,22,0.94) 0%,rgba(8,12,22,0.82) 70%,rgba(8,12,22,0) 100%)',
        ].join(';');
        ov.innerHTML =
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;pointer-events:auto;">' +
            '<span style="color:#5be8d1;font-weight:900;font-size:0.95rem;letter-spacing:0.03em;text-align:center;">🖼 Describe esta imagen en chino 🐉</span>' +
            '<button id="wu-describe-collapse" type="button" aria-label="Ocultar" style="pointer-events:auto;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.3);color:#fff;border-radius:8px;width:30px;height:30px;font-weight:900;cursor:pointer;">▲</button>' +
          '</div>' +
          '<img style="max-width:92vw;max-height:38vh;object-fit:contain;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,0.55);pointer-events:auto;background:#0d1224;">';
        document.body.appendChild(ov);
        // Collapse/expand toggle — lets the kid shrink the banner to a
        // thin strip if they need the full screen to build, then tap to
        // bring it back. Purely local; doesn't affect other kids.
        let collapsed = false;
        ov.addEventListener('click', (e) => {
          if (e.target.id !== 'wu-describe-collapse') return;
          collapsed = !collapsed;
          const img = ov.querySelector('img');
          const btn = ov.querySelector('#wu-describe-collapse');
          img.style.display = collapsed ? 'none' : 'block';
          btn.textContent = collapsed ? '▼' : '▲';
        });
      }
      ov.querySelector('img').src = d.url;
    } else if (ov) {
      ov.remove();
    }
  });
  socket.on('wu:anim', (d) => {
    if (gameType !== 'warmup' || !d || !d.id) return;
    let ov = document.getElementById('wu-anim-overlay-' + d.id);
    if (d.on && WU_ANIM_URL_PLAYER[d.id]) {
      if (ov) return;
      ov = document.createElement('div');
      ov.id = 'wu-anim-overlay-' + d.id;
      ov.className = 'wu-anim-overlay';
      ov.innerHTML = '<img src="' + WU_ANIM_URL_PLAYER[d.id] + '" alt="">';
      document.body.appendChild(ov);
    } else if (ov) {
      ov.remove();
    }
  });
  function _wuFxLayer() {
    let layer = document.getElementById('wu-player-fx-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'wu-player-fx-layer';
      layer.className = 'wu-fx-layer';
      layer.setAttribute('aria-hidden', 'true');
      document.body.appendChild(layer);
    }
    return layer;
  }
  // 2026-10-12 — the saga cast (public/js/saga.js BURSTS); the brand characters are gone
  const WU_CHARS_PL = {};
  ((window.Saga && window.Saga.BURSTS) || []).forEach((c) => { WU_CHARS_PL[c.id] = c; });
  function playerFireFx(kind) {
    if (kind === 'dralingo') { if (window.DralingoFX) window.DralingoFX.celebrate({ text: '¡Muy bien!', mood: 'win' }); return; }
    if (kind === 'gang') { if (window.DralingoFX) window.DralingoFX.play('gang', { text: '¡Muy bien!', mood: 'win' }); return; }
    if (WU_CHARS_PL[kind]) {
      const layer = _wuFxLayer();
      const c = WU_CHARS_PL[kind];
      document.body.classList.remove('wu-shake'); void document.body.offsetWidth;
      document.body.classList.add('wu-shake');
      setTimeout(() => document.body.classList.remove('wu-shake'), 700);
      const el = document.createElement('div');
      el.className = 'wu-fx-char';
      el.style.setProperty('--char-color', c.color);
      el.style.setProperty('--char-glow', c.glow);
      el.innerHTML = `
        <div class="wu-fx-char-lines"></div>
        <div class="wu-fx-char-aura"></div>
        <img class="wu-fx-char-img" alt="${kind}">
        <div class="wu-fx-char-cry">${c.cry}</div>`;
      el.querySelector('.wu-fx-char-img').src = c.img;
      layer.appendChild(el);
      if (MochiSounds && MochiSounds.combo) MochiSounds.combo();
      setTimeout(() => el.remove(), 3200);
      return;
    }
    return _playerFireFxStd(kind);
  }
  function _playerFireFxStd(kind) {
    const layer = _wuFxLayer();
    if (kind === 'shake') {
      document.body.classList.remove('wu-shake'); void document.body.offsetWidth;
      document.body.classList.add('wu-shake');
      setTimeout(() => document.body.classList.remove('wu-shake'), 700);
      return;
    }
    if (kind === 'sixseven') {
      document.body.classList.remove('wu-shake'); void document.body.offsetWidth;
      document.body.classList.add('wu-shake');
      setTimeout(() => document.body.classList.remove('wu-shake'), 700);
      const el = document.createElement('div');
      el.className = 'wu-fx-67';
      el.innerHTML = '<img class="a" src="/assets/sixseven/dralingo-67-a.webp" alt="Dralingo: seis-siete"><img class="b" src="/assets/sixseven/dralingo-67-b.webp" alt="">';
      layer.appendChild(el);
      if (MochiSounds && MochiSounds.combo) MochiSounds.combo();
      setTimeout(() => el.remove(), 2600);
      return;
    }
    if (kind === 'confetti') {
      const em = ['🎉', '✨', '🎊', '⭐', '🧧', '🐉'];
      for (let i = 0; i < 30; i++) {
        const el = document.createElement('div');
        el.className = 'wu-fx-confetti-bit'; el.textContent = em[i % em.length];
        el.style.left = Math.random() * 100 + 'vw';
        el.style.animationDelay = (Math.random() * 0.4) + 's';
        el.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
        el.style.fontSize = (18 + Math.random() * 20) + 'px';
        layer.appendChild(el); setTimeout(() => el.remove(), 3200);
      }
      return;
    }
    if (kind === 'rain') {
      for (let i = 0; i < 32; i++) {
        const el = document.createElement('div');
        el.className = 'wu-fx-rain-drop'; el.textContent = Math.random() < 0.5 ? '💧' : '🌧';
        el.style.left = Math.random() * 100 + 'vw';
        el.style.animationDelay = (Math.random() * 0.8) + 's';
        el.style.animationDuration = (0.8 + Math.random() * 0.8) + 's';
        layer.appendChild(el); setTimeout(() => el.remove(), 2400);
      }
      return;
    }
    if (kind === 'flash') {
      const f = document.createElement('div');
      f.className = 'wu-fx-flash';
      layer.appendChild(f);
      if (MochiSounds && MochiSounds.combo) MochiSounds.combo();
      setTimeout(() => f.remove(), 900);
      return;
    }
    if (kind === 'stars') {
      const em = ['⭐', '🌟', '✨', '💫'];
      for (let i = 0; i < 26; i++) {
        const el = document.createElement('div');
        el.className = 'wu-fx-confetti-bit'; el.textContent = em[i % em.length];
        el.style.left = Math.random() * 100 + 'vw';
        el.style.animationDelay = (Math.random() * 0.4) + 's';
        el.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
        el.style.fontSize = (16 + Math.random() * 20) + 'px';
        layer.appendChild(el); setTimeout(() => el.remove(), 3200);
      }
      return;
    }
    // zombies | moto | tiger — stampede across
    const isZombie = (kind === 'zombies');
    const isTiger = (kind === 'tiger');
    const glyphs = isZombie ? ['🧟', '🧟‍♂️', '🧟‍♀️'] : isTiger ? ['🐯', '🐅', '🐯'] : ['🏍', '🏍️', '🛵'];
    for (let i = 0; i < (isZombie ? 6 : 5); i++) {
      const el = document.createElement('div');
      el.className = 'wu-fx-runner ' + (isZombie ? 'is-zombie ' : isTiger ? 'is-tiger ' : 'is-moto ') + (Math.random() < 0.5 ? 'from-right' : 'from-left');
      el.textContent = glyphs[i % glyphs.length];
      el.style.top = (15 + Math.random() * 65) + 'vh';
      el.style.animationDelay = (Math.random() * 0.6) + 's';
      el.style.animationDuration = ((isZombie ? 3.2 : isTiger ? 2.4 : 1.8) + Math.random() * 1.2) + 's';
      el.style.fontSize = (32 + Math.random() * 20) + 'px';
      layer.appendChild(el); setTimeout(() => el.remove(), 5000);
    }
  }

  // === JUDGE === when a kid raises their hand, a juez sees an approve card.
  socket.on('wu:hand', (h) => {
    if (gameType !== 'warmup' || !wuPlayerIsJudge || !h || !h.name) return;
    if (h.name === myName) return;   // don't judge yourself
    showJudgeCard(h);
  });
  function showJudgeCard(h) {
    let wrap = document.getElementById('wu-judge-tray');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'wu-judge-tray';
      wrap.className = 'wu-judge-tray';
      document.body.appendChild(wrap);
    }
    // Avoid duplicate cards for the same kid
    if (wrap.querySelector('[data-name="' + CSS.escape(h.name) + '"]')) return;
    const card = document.createElement('div');
    card.className = 'wu-judge-card';
    card.setAttribute('data-name', h.name);
    card.innerHTML = `
      <span class="wu-judge-who">${h.avatar || '🙋'} ${escapeHtmlP(h.name)}</span>
      <span class="wu-judge-q">¿Puede ser asistente?</span>
      <span class="wu-judge-actions">
        <button class="wu-judge-yes" type="button">✅ Sí</button>
        <button class="wu-judge-no" type="button">❌ No</button>
      </span>`;
    card.querySelector('.wu-judge-yes').onclick = () => {
      socket.emit('wu:judge-grant', { pin, playerName: h.name });
      if (MochiSounds && MochiSounds.correct) MochiSounds.correct();
      card.remove();
    };
    card.querySelector('.wu-judge-no').onclick = () => {
      if (MochiSounds && MochiSounds.tap) MochiSounds.tap();
      card.remove();
    };
    wrap.appendChild(card);
    setTimeout(() => card.remove(), 15000);
  }
  function escapeHtmlP(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Player-side admin library — same word data + EXP tabs, but emits
  // wu:add-word without a password (server validates via delegates set).
  function renderPlayerExpTabs() {
    const wrap = document.getElementById('wu-player-exp-tabs');
    if (!wrap) return;
    wrap.innerHTML = '';
    // Only show the banks the teacher made visible (null = all). Kids must
    // NOT see EXP tabs the teacher didn't enable.
    const allowed = wuPlayerVisibleExps;
    const visible = Object.values(window.WU_EXPERIENCES || {})
      .filter((e) => !allowed || allowed.indexOf(e.id) >= 0);
    // If the active filter points at a now-hidden bank, reset to 'all'.
    if (wuPlayerActiveExp !== 'all' && allowed && allowed.indexOf(wuPlayerActiveExp) < 0) {
      wuPlayerActiveExp = 'all';
    }
    // "Todos" only makes sense when >1 bank is visible.
    if (visible.length !== 1) {
      const all = document.createElement('button');
      all.className = 'wu-pl-exp-tab' + (wuPlayerActiveExp === 'all' ? ' active' : '');
      all.dataset.exp = 'all';
      all.type = 'button';
      all.textContent = 'Todos';
      all.onclick = () => setPlayerExp('all');
      wrap.appendChild(all);
    } else {
      wuPlayerActiveExp = visible[0].id;   // single bank → lock to it
    }
    visible.forEach((e) => {
      const tab = document.createElement('button');
      tab.className = 'wu-pl-exp-tab' + (wuPlayerActiveExp === e.id ? ' active' : '');
      tab.dataset.exp = e.id;
      tab.type = 'button';
      tab.textContent = e.short;
      tab.onclick = () => setPlayerExp(e.id);
      wrap.appendChild(tab);
    });
  }
  function setPlayerExp(id) {
    wuPlayerActiveExp = id;
    document.querySelectorAll('.wu-pl-exp-tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.exp === id);
    });
    renderPlayerLibrary();
  }
  function renderPlayerLibrary() {
    const lib = document.getElementById('wu-player-library');
    if (!lib) return;
    lib.innerHTML = '';
    const byExp = {};
    const q = wuPlayerSearch;   // already normalized
    // Teacher-chosen visible banks (null = all). Students only see these.
    const allowed = wuPlayerVisibleExps;
    (window.WU_WORDS || []).forEach((w) => {
      if (allowed && allowed.indexOf(w.exp) < 0) return;   // bank hidden by teacher
      if (wuPlayerActiveExp !== 'all' && w.exp !== wuPlayerActiveExp) return;
      // Tone-stripped search across pinyin, español AND hanzi.
      if (q && !(
        _wuNormalize(w.pinyin).includes(q) ||
        _wuNormalize(w.es).includes(q) ||
        (w.hanzi && w.hanzi.includes(wuPlayerSearch.trim()))
      )) return;
      (byExp[w.exp] = byExp[w.exp] || []).push(w);
    });
    // Append live custom words (always visible regardless of bank filter).
    const customMatches = (wuPlayerCustomWords || []).filter((w) =>
      !q || _wuNormalize(w.pinyin).includes(q) || _wuNormalize(w.es).includes(q));
    if (q && Object.keys(byExp).length === 0) {
      lib.innerHTML = `<div class="wu-pl-lib-empty">🔍 Sin resultados para “${escapeHtmlP(wuPlayerSearch)}”. Prueba sin tonos.</div>`;
      return;
    }
    Object.keys(byExp).forEach((expId) => {
      const exp = window.WU_EXPERIENCES[expId];
      const section = document.createElement('div');
      section.className = 'wu-pl-lib-section';
      section.innerHTML = `<div class="wu-pl-lib-title">${exp ? exp.label : expId}</div>`;
      const grid = document.createElement('div');
      grid.className = 'wu-pl-lib-grid';
      byExp[expId].forEach((w) => {
        const cat = window.WU_CATEGORIES[w.cat] || { color: '#aaa' };
        const card = document.createElement('button');
        card.className = 'wu-pl-lib-card';
        card.type = 'button';
        card.style.setProperty('--cat-color', cat.color);
        card.innerHTML = `
          <span class="wu-pl-icon">${w.icon || ''}</span>
          <span class="wu-pl-pinyin">${w.pinyin}</span>
          <span class="wu-pl-hanzi">${w.hanzi}</span>
          <span class="wu-pl-es">${w.es}</span>`;
        card.onclick = () => {
          // No password — server validates via delegates set
          try { socket.emit('wu:add-word', { pin, wordId: w.id }); } catch (_) {}
          if (MochiSounds.tap) MochiSounds.tap();
        };
        grid.appendChild(card);
      });
      section.appendChild(grid);
      lib.appendChild(section);
    });
    // Custom (teacher-created) words — names etc., always available.
    if (customMatches.length) {
      const section = document.createElement('div');
      section.className = 'wu-pl-lib-section';
      section.innerHTML = '<div class="wu-pl-lib-title">⭐ Personalizadas</div>';
      const grid = document.createElement('div');
      grid.className = 'wu-pl-lib-grid';
      customMatches.forEach((w) => {
        const card = document.createElement('button');
        card.className = 'wu-pl-lib-card';
        card.type = 'button';
        card.style.setProperty('--cat-color', '#ffd86b');
        card.innerHTML = `
          <span class="wu-pl-icon">${w.icon || '⭐'}</span>
          <span class="wu-pl-pinyin">${escapeHtmlP(w.pinyin)}</span>
          <span class="wu-pl-hanzi">${escapeHtmlP(w.hanzi || '')}</span>
          <span class="wu-pl-es">${escapeHtmlP(w.es || '')}</span>`;
        card.onclick = () => {
          try { socket.emit('wu:add-word', { pin, wordId: w.id }); } catch (_) {}
          if (MochiSounds.tap) MochiSounds.tap();
        };
        grid.appendChild(card);
      });
      section.appendChild(grid);
      lib.appendChild(section);
    }
  }
  // === SENTENCE HISTORY MODAL ===
  // Tap "📜 Mis oraciones" → fetch this student's history from the server
  // (keyed by their stable student code) and render it.
  //
  // 🆕 2026-06-04 (Fernando): the list now splits into TWO tabs —
  //   "✍️ Mías" (saved by the kid) and "📤 De la maestra" (pushed by
  //   the teacher via /api/admin/sentence/push).
  // Both use the same row layout; only the filter differs. Last-viewed
  // tab is remembered in-session so flipping the modal closed and open
  // again stays on the same tab.
  let _wuHistoryTab = 'mine';   // 'mine' | 'teacher'
  let _wuHistoryCatFilter = '';  // category id or '' for "all categories"
  function openWuHistory() {
    const modal = document.getElementById('wu-history-modal');
    const list = document.getElementById('wu-history-list');
    const sub = document.getElementById('wu-history-sub');
    if (!modal || !list) return;
    modal.classList.remove('hidden');
    requestAnimationFrame(() => modal.classList.add('show'));
    list.innerHTML = '<div class="wu-history-empty">Cargando…</div>';
    if (!myStudentCode) {
      list.innerHTML = '<div class="wu-history-empty">Aún no tienes un código de estudiante.</div>';
      return;
    }
    socket.emit('wu:request-history', { studentCode: myStudentCode }, (resp) => {
      if (!resp || !resp.ok) {
        list.innerHTML = '<div class="wu-history-empty">No se pudo cargar el historial.</div>';
        return;
      }
      const sentences = resp.sentences || [];
      const teacherCount = sentences.filter((s) => s.pushedByTeacher).length;
      const mineCount = sentences.length - teacherCount;
      // Friendlier sub-header that owns the whole-page hero: shows
      // total, breakdown by source, and the kid's code as a soft chip.
      if (sub) {
        sub.innerHTML =
          'Tu colección de chino · ' +
          '<strong>' + sentences.length + '</strong> oración' + (sentences.length === 1 ? '' : 'es') +
          ' &nbsp;·&nbsp; ✍️ <strong>' + mineCount + '</strong> mía' + (mineCount === 1 ? '' : 's') +
          ' &nbsp;·&nbsp; 📤 <strong>' + teacherCount + '</strong> de tu maestra' +
          ' <span class="wu-history-code-chip">Código: ' + escapeHtml(myStudentCode) + '</span>';
      }
      _renderWuHistoryTabs(list, sentences, mineCount, teacherCount);
    });
  }
  function _renderWuHistoryTabs(list, sentences, mineCount, teacherCount) {
    // Tab strip — pinned, lets the kid flip between Mías and De la maestra.
    list.innerHTML = '';
    const tabs = document.createElement('div');
    tabs.className = 'wu-history-tabs';
    tabs.innerHTML =
      '<button class="wu-history-tab ' + (_wuHistoryTab === 'mine' ? 'is-active' : '') + '" data-tab="mine" type="button">' +
        '✍️ Mías <span class="wu-history-tab-n">' + mineCount + '</span>' +
      '</button>' +
      '<button class="wu-history-tab ' + (_wuHistoryTab === 'teacher' ? 'is-active' : '') + '" data-tab="teacher" type="button">' +
        '📤 De la maestra <span class="wu-history-tab-n">' + teacherCount + '</span>' +
      '</button>';
    list.appendChild(tabs);
    tabs.querySelectorAll('.wu-history-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        _wuHistoryTab = btn.dataset.tab;
        // Reset category filter when flipping tabs — categories only
        // exist on teacher-pushed sentences, so switching back to "Mías"
        // shouldn't drag an old filter along.
        if (_wuHistoryTab !== 'teacher') _wuHistoryCatFilter = '';
        _renderWuHistoryTabs(list, sentences, mineCount, teacherCount);
      });
    });
    // 🆕 Category filter chips — only shown on the teacher tab AND only
    // if the kid has at least one categorised teacher sentence. Each chip
    // shows the category emoji + label + count; "Todas" resets the filter.
    if (_wuHistoryTab === 'teacher' && teacherCount) {
      const teacherSentences = sentences.filter((s) => s.pushedByTeacher);
      const countsByCat = {};
      teacherSentences.forEach((s) => {
        const k = s.category || '';
        countsByCat[k] = (countsByCat[k] || 0) + 1;
      });
      const presentCats = (window.SENTENCE_CATEGORIES || []).filter((c) => countsByCat[c.id]);
      const uncategorisedCount = countsByCat[''] || 0;
      if (presentCats.length || uncategorisedCount) {
        const catBar = document.createElement('div');
        catBar.className = 'wu-history-catbar';
        let chipsHtml =
          '<button class="wu-history-cat-chip ' + (_wuHistoryCatFilter === '' ? 'is-active' : '') + '" data-cat="" type="button">' +
            '✨ Todas <span class="wu-history-cat-n">' + teacherSentences.length + '</span>' +
          '</button>';
        presentCats.forEach((c) => {
          chipsHtml +=
            '<button class="wu-history-cat-chip ' + (_wuHistoryCatFilter === c.id ? 'is-active' : '') + '"' +
            ' data-cat="' + escapeHtml(c.id) + '" type="button" style="--cat-color:' + c.color + ';">' +
              c.emoji + ' ' + escapeHtml(c.label) +
              ' <span class="wu-history-cat-n">' + countsByCat[c.id] + '</span>' +
            '</button>';
        });
        if (uncategorisedCount) {
          chipsHtml +=
            '<button class="wu-history-cat-chip ' + (_wuHistoryCatFilter === '__uncat__' ? 'is-active' : '') + '"' +
            ' data-cat="__uncat__" type="button">' +
              '🚫 Sin categoría <span class="wu-history-cat-n">' + uncategorisedCount + '</span>' +
            '</button>';
        }
        catBar.innerHTML = chipsHtml;
        list.appendChild(catBar);
        catBar.querySelectorAll('.wu-history-cat-chip').forEach((chip) => {
          chip.addEventListener('click', () => {
            _wuHistoryCatFilter = chip.dataset.cat;
            _renderWuHistoryTabs(list, sentences, mineCount, teacherCount);
          });
        });
      }
    }
    const body = document.createElement('div');
    body.className = 'wu-history-tab-body';
    list.appendChild(body);
    let filtered = sentences.filter((s) => _wuHistoryTab === 'teacher' ? !!s.pushedByTeacher : !s.pushedByTeacher);
    // Apply category filter ONLY on the teacher tab.
    if (_wuHistoryTab === 'teacher' && _wuHistoryCatFilter) {
      if (_wuHistoryCatFilter === '__uncat__') {
        filtered = filtered.filter((s) => !s.category);
      } else {
        filtered = filtered.filter((s) => s.category === _wuHistoryCatFilter);
      }
    }
    if (!filtered.length) {
      const emptyMsg = (_wuHistoryTab === 'teacher')
        ? 'Aún no te han enviado oraciones. Cuando tu maestra te envíe una, aparecerá aquí. 📤'
        : 'Aún no has construido ninguna oración. ¡Sé asistente y empieza! ✍️';
      body.innerHTML = '<div class="wu-history-empty">' + emptyMsg + '</div>';
      return;
    }
    filtered.forEach((s) => {
      const item = document.createElement('div');
      item.className = 'wu-history-item' + (s.pushedByTeacher ? ' is-from-teacher' : '');
      const date = new Date(s.ts);
      const dateStr = date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
      // Each word chip — now a vertical stack of icon · hanzi · pinyin
      // so the kid sees Chinese characters too, not just romanization.
      // Tap on the chip still pops the Curious Mode pokedex.
      // History rendering: look up word ids in the static catalog first,
      // then fall back to this entry's customWords snapshot (teacher words
      // typed at runtime — they have ephemeral "cw..." ids that aren't in
      // the catalog, so without the snapshot the kid sees raw codes).
      const _customMap = {};
      if (Array.isArray(s.customWords)) {
        s.customWords.forEach((cw) => { if (cw && cw.id) _customMap[cw.id] = cw; });
      }
      const wordObjs = (s.words || []).map((wid) => {
        return (window.WU_WORD_BY_ID && window.WU_WORD_BY_ID[wid])
            || _customMap[wid]
            || null;
      }).filter(Boolean);
      const wordsHtml = wordObjs.map((w) => {
        const wid = w.id;
        const cat = window.WU_CATEGORIES && window.WU_CATEGORIES[w.cat];
        const color = cat ? cat.color : '#fff';
        return '<button class="wu-hist-word curious-tappable" data-wid="' + escapeHtml(wid) + '"' +
          ' style="--cat-color:' + color + ';" type="button" aria-label="Explorar palabra ' + escapeHtml(w.pinyin) + '">' +
            '<span class="wu-hist-icon">' + (w.icon || '') + '</span>' +
            (w.hanzi ? '<span class="wu-hist-hanzi" lang="zh">' + escapeHtml(w.hanzi) + '</span>' : '') +
            '<span class="wu-hist-pinyin">' + escapeHtml(w.pinyin) + '</span>' +
            (w.es ? '<span class="wu-hist-es">' + escapeHtml(w.es) + '</span>' : '') +
          '</button>';
      }).join('');
      const teacherChip = s.pushedByTeacher
        ? '<span class="wu-history-from-teacher">📤 ' + escapeHtml(s.teacherName || 'Maestra') + '</span>'
        : '';
      // 🆕 Category badge — only on teacher-pushed sentences that
      // actually carry a category id. The chip color matches the
      // category's brand color so the kid recognises Casa vs Escuela
      // at a glance even before reading the label.
      let categoryChip = '';
      if (s.pushedByTeacher && s.category && window.SENTENCE_CATEGORY_BY_ID) {
        const cat = window.SENTENCE_CATEGORY_BY_ID[s.category];
        if (cat) {
          categoryChip = '<span class="wu-history-cat-pill" style="--cat-color:' + cat.color + ';">' +
            cat.emoji + ' ' + escapeHtml(cat.label) +
          '</span>';
        }
      }
      // Concatenated pinyin used by the Escuchar button. We send the
      // pinyin string straight to /api/tts (Google) — it handles
      // tones and renders quite natural Mandarin. The hanzi would be
      // more accurate but the existing builder uses pinyin everywhere
      // so this stays consistent.
      const pinyinSentence = wordObjs.map((w) => w.pinyin).join(' ').trim();
      // The hanzi-concatenated version is a fallback / future improvement;
      // store it on the button so we can A/B-flip later without a re-render.
      const hanziSentence = wordObjs.map((w) => w.hanzi || '').join('').trim();
      item.innerHTML =
        '<div class="wu-history-item-row">' +
          '<div class="wu-history-item-meta">📅 <strong>' + dateStr + '</strong> ' + teacherChip + ' ' + categoryChip + '</div>' +
          '<button class="wu-history-item-delete" type="button" aria-label="Borrar">🗑</button>' +
        '</div>' +
        '<div class="wu-history-item-words">' + wordsHtml + '</div>' +
        '<div class="wu-history-item-actions">' +
          '<button class="wu-history-listen" type="button" data-pinyin="' + escapeHtml(pinyinSentence) + '" data-hanzi="' + escapeHtml(hanziSentence) + '">🔊 Escuchar oración</button>' +
        '</div>';
      const delBtn = item.querySelector('.wu-history-item-delete');
      if (delBtn) {
        delBtn.onclick = (ev) => {
          ev.stopPropagation();
          if (!confirm('¿Borrar esta oración del historial?')) return;
          socket.emit('wu:delete-history-entry', {
            studentCode: myStudentCode, ts: s.ts,
          }, (resp) => {
            if (resp && resp.ok) openWuHistory();
            else alert('No se pudo borrar.');
          });
        };
      }
      // Listen — speaks the pinyin (Google TTS). We prefer hanzi for
      // pronunciation quality WHEN the sentence is at least 3 chars
      // long (single particles like "le" sound weird in isolation
      // through the hanzi pipeline).
      const listenBtn = item.querySelector('.wu-history-listen');
      if (listenBtn) {
        listenBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const hanzi = listenBtn.dataset.hanzi || '';
          const pinyin = listenBtn.dataset.pinyin || '';
          const toSpeak = (hanzi && hanzi.replace(/\s+/g, '').length >= 2) ? hanzi : pinyin;
          if (toSpeak) speakChineseWU(toSpeak, listenBtn);
        });
      }
      item.querySelectorAll('.wu-hist-word').forEach((el) => {
        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const w = window.WU_WORD_BY_ID && window.WU_WORD_BY_ID[el.dataset.wid];
          if (w) showWuPokedex(w);
        });
      });
      body.appendChild(item);
    });
  }
  function closeWuHistory() {
    const modal = document.getElementById('wu-history-modal');
    if (!modal) return;
    modal.classList.remove('show');
    setTimeout(() => modal.classList.add('hidden'), 250);
  }
  // Bind history button + modal close once
  document.addEventListener('DOMContentLoaded', () => {
    const btn   = document.getElementById('wu-player-history-btn');
    const close = document.getElementById('wu-history-close');
    const modal = document.getElementById('wu-history-modal');
    if (btn)   btn.addEventListener('click', openWuHistory);
    if (close) close.addEventListener('click', closeWuHistory);
    if (modal) modal.addEventListener('click', (e) => {
      if (e.target === modal) closeWuHistory();
    });
    // 💾 Save-is-everywhere button — any kid keeps the current sentence into
    // THEIR OWN history via wu:save-mine (no admin needed, works while frozen).
    const saveMine = document.getElementById('wu-player-save-mine');
    if (saveMine) saveMine.addEventListener('click', () => {
      try { socket.emit('wu:save-mine', { pin }); } catch (_) {}
      if (MochiSounds.correct) MochiSounds.correct();
    });
  });
  // Server notifies us our history grew (a sentence we contributed to was
  // cleared / replaced). If the modal is open right now, refresh it.
  socket.on('wu:history-updated', () => {
    const modal = document.getElementById('wu-history-modal');
    if (modal && !modal.classList.contains('hidden')) {
      openWuHistory();
    }
  });
  // Server confirms save landed (or failed) — flash the player's Save
  // button + pop a small chip with word count. This replaces the
  // disabled Rewards.show toast so the asistente actually SEES the save.
  socket.on('wu:saved', (data) => {
    if (data && data.ok) {
      flashWuPlayerSave(true, `✓ Guardada · ${data.words || 0} palabra${(data.words || 0) === 1 ? '' : 's'}`);
    } else {
      flashWuPlayerSave(false, '✕ Vacía — no guardada');
    }
  });
  function flashWuPlayerSave(ok, text) {
    // Flash whichever save button exists — the asistente's panel one OR the
    // always-visible "Guardar mi oración" button every kid has.
    const btn = document.getElementById('wu-player-save-mine')
             || document.getElementById('wu-player-admin-save');
    if (btn) {
      btn.classList.remove('wu-save-flash-ok', 'wu-save-flash-err');
      void btn.offsetWidth;
      btn.classList.add(ok ? 'wu-save-flash-ok' : 'wu-save-flash-err');
      setTimeout(() => btn.classList.remove('wu-save-flash-ok', 'wu-save-flash-err'), 1700);
    }
    let chip = document.getElementById('wu-player-save-chip');
    if (!chip) {
      chip = document.createElement('div');
      chip.id = 'wu-player-save-chip';
      chip.className = 'wu-save-chip';
      const parent = btn && btn.parentNode ? btn.parentNode : document.body;
      parent.appendChild(chip);
    }
    chip.textContent = text;
    chip.classList.remove('wu-save-chip-ok', 'wu-save-chip-err', 'show');
    chip.classList.add(ok ? 'wu-save-chip-ok' : 'wu-save-chip-err');
    void chip.offsetWidth;
    chip.classList.add('show');
    clearTimeout(chip._hideT);
    chip._hideT = setTimeout(() => { chip.classList.remove('show'); }, 1800);
  }

  function bindPlayerAdminControls() {
    const clear = document.getElementById('wu-player-admin-clear');
    const undo  = document.getElementById('wu-player-admin-undo');
    const rear  = document.getElementById('wu-player-admin-rearrange');
    const save  = document.getElementById('wu-player-admin-save');
    if (save && !save._wuBound) {
      save._wuBound = true;
      save.onclick = () => {
        try { socket.emit('wu:save-current', { pin }); } catch (_) {}
        if (MochiSounds.correct) MochiSounds.correct();
        // Confirmation lands via the `wu:saved` socket event below — that's
        // what flashes the button + shows the chip.
      };
    }
    if (clear && !clear._wuBound) {
      clear._wuBound = true;
      clear.onclick = () => {
        try { socket.emit('wu:clear', { pin }); } catch (_) {}
        if (MochiSounds.tap) MochiSounds.tap();
      };
    }
    if (undo && !undo._wuBound) {
      undo._wuBound = true;
      undo.onclick = () => {
        try { socket.emit('wu:undo', { pin }); } catch (_) {}
        if (MochiSounds.tap) MochiSounds.tap();
      };
    }
    if (rear && !rear._wuBound) {
      rear._wuBound = true;
      rear.onclick = () => {
        wuPlayerRearrange = !wuPlayerRearrange;
        wuPlayerSwapIdx = null;
        rear.classList.toggle('active', wuPlayerRearrange);
        rear.textContent = wuPlayerRearrange ? '✏️ Salir' : '🔀 Rearreglar';
        renderWuStage(wuPlayerLastSentence);
      };
    }
  }
  function renderWuStage(sentence) {
    wuPlayerLastSentence = sentence || [];
    const pinyinRow = document.getElementById('wu-player-stage-pinyin');
    const esRow     = document.getElementById('wu-player-stage-es');
    const empty     = document.getElementById('wu-player-stage-empty');
    if (!pinyinRow || !esRow) return;
    pinyinRow.innerHTML = '';
    esRow.innerHTML = '';
    if (!sentence.length) {
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';
    const showPic = (wuPlayerViewMode === 'picture' || wuPlayerViewMode === 'both');
    const showEmoji = (wuPlayerViewMode === 'text' || wuPlayerViewMode === 'both');
    sentence.forEach((wid, idx) => {
      const w = wuPlWord(wid);
      if (!w) return;
      const cat = window.WU_CATEGORIES && window.WU_CATEGORIES[w.cat];
      const color = cat ? cat.color : '#ffd86b';
      // Three tap-modes (in priority order):
      //   1. Curious mode ON  → tap opens Pokédex card
      //   2. Delegate + rearrange ON → tap selects, second tap swaps
      //   3. Delegate (no rearrange) → tap removes
      //   4. Read-only spectator → tap does nothing
      const isInteractive = wuPlayerCurious
        || (wuPlayerIsDelegate && wuPlayerRearrange)
        || wuPlayerIsDelegate;
      const tag = isInteractive ? 'button' : 'div';
      const p = document.createElement(tag);
      p.className = 'wu-player-word'
        + (wuPlayerViewMode === 'picture' ? ' picture-only' : '')
        + (wuPlayerCurious ? ' curious-tappable' : '')
        + (wuPlayerIsDelegate && wuPlayerRearrange ? ' rearrange-mode' : '')
        + (wuPlayerSwapIdx === idx ? ' swap-selected' : '');
      p.style.setProperty('--cat-color', color);
      const pic = showPic
        ? `<img class="wu-pw-pic" src="${(window.wuPicSrc ? window.wuPicSrc(w) : '/assets/warmup/' + w.id + '.png')}" alt="${w.pinyin}"
              onerror="this.classList.add('missing')">`
        : '';
      const ic = showEmoji ? `<span class="wu-pw-icon">${w.icon || ''}</span>` : '';
      p.innerHTML = `${pic}${ic}
        <span class="wu-pw-pinyin">${w.pinyin}</span>
        <span class="wu-pw-hanzi">${w.hanzi}</span>`;
      if (isInteractive) {
        p.type = 'button';
        const handle = (ev) => {
          if (ev) ev.preventDefault();
          if (wuPlayerCurious) {
            showWuPokedex(w);
            return;
          }
          if (wuPlayerIsDelegate && wuPlayerRearrange) {
            if (wuPlayerSwapIdx === null) {
              wuPlayerSwapIdx = idx;
              renderWuStage(sentence);
              if (MochiSounds.tap) MochiSounds.tap();
            } else if (wuPlayerSwapIdx === idx) {
              wuPlayerSwapIdx = null;
              renderWuStage(sentence);
            } else {
              try {
                socket.emit('wu:swap-words', {
                  pin, fromIndex: wuPlayerSwapIdx, toIndex: idx,
                });
              } catch (_) {}
              wuPlayerSwapIdx = null;
              if (MochiSounds.swap) MochiSounds.swap();
            }
            return;
          }
          if (wuPlayerIsDelegate) {
            // Plain delegate tap = remove this word
            try { socket.emit('wu:remove-word', { pin, index: idx }); } catch (_) {}
            if (MochiSounds.tap) MochiSounds.tap();
          }
        };
        p.addEventListener('click', handle);
      }
      pinyinRow.appendChild(p);
      const e = document.createElement('div');
      e.className = 'wu-player-es-word';
      e.style.setProperty('--cat-color', color);
      e.textContent = w.es;
      esRow.appendChild(e);
    });
  }
  // === 🔍 POKÉDEX OVERLAY ===
  // Pops a big card with the tapped word's full details. Card layout
  // uses the big-card engagement pattern — big icon, big
  // text, gradient background per category color, "Tap to close" hint.
  function showWuPokedex(w) {
    const overlay = document.getElementById('wu-pokedex');
    const card    = document.getElementById('wu-pokedex-card');
    if (!overlay || !card) return;
    const cat = window.WU_CATEGORIES && window.WU_CATEGORIES[w.cat];
    const exp = window.WU_EXPERIENCES && window.WU_EXPERIENCES[w.exp];
    const color = cat ? cat.color : '#fff';
    card.style.setProperty('--cat-color', color);
    card.innerHTML = `
      <div class="wu-pk-icon">${w.icon || '✨'}</div>
      <div class="wu-pk-pinyin">${w.pinyin}</div>
      <div class="wu-pk-hanzi">${w.hanzi}</div>
      <div class="wu-pk-es">${w.es}</div>
      <div class="wu-pk-meta">
        <div class="wu-pk-chip cat" style="background:${color}; color:#0a1320;">${(cat && cat.label) || w.cat}</div>
        <div class="wu-pk-chip exp">${(exp && exp.short) || w.exp}</div>
      </div>
      <div class="wu-pk-hint">Toca fuera para cerrar</div>`;
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => overlay.classList.add('show'));
    if (MochiSounds.correct) MochiSounds.correct();
  }
  function hideWuPokedex() {
    const overlay = document.getElementById('wu-pokedex');
    if (!overlay) return;
    overlay.classList.remove('show');
    setTimeout(() => overlay.classList.add('hidden'), 250);
  }
  // Bind close handlers once
  document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('wu-pokedex');
    const close   = document.getElementById('wu-pokedex-close');
    if (close) close.addEventListener('click', hideWuPokedex);
    if (overlay) overlay.addEventListener('click', (e) => {
      if (e.target === overlay) hideWuPokedex();
    });
  });

  socket.on('answer-result', ({ correct, mashUntil, correctText, points, monopoly, sixseven, kingdoms }) => {
    markActivity();
    clearAnswerHeartbeat();
    hideSendingOverlay();
    if (!correct) resetStreak();
    if (gameType === 'monopoly') return;   // Dàfùwēng · Monopolio: player-monopoly.js shows the verdict on its question sheet
    if (gameType === 'dragon-eye') return; // Vuelo del Dragón: player-dragon.js shows the verdict and opens the flight

    // 6-7 Swing: player-sixseven.js shows the verdict on its own screen (the swing, the coins, the wobble)
    if (gameType === 'sixseven') return;
    if (correct) {
      MochiSounds.correct();
      fireRewardForCorrect();
      let happyMascot, sub;
      if (gameType === 'pinata') {
        happyMascot = '🎯';                // (player-pinata.js redraws this screen with the team's tiger)
        sub = '¡Prepárate para golpear!';
      } else if (gameType === 'kingdoms') {
        happyMascot = '🚩';
        sub = kingdoms && kingdoms.flags > 1 ? '¡Bandera doble! Plántalas en el mapa' : '¡Ganaste una bandera!';
      } else if (gameType === 'snow') {
        happyMascot = '❄️';
        sub = '¡Copos para tus bolas de nieve!';
      } else if (gameType === 'escape') {
        happyMascot = '🚀';
        sub = '¡Turbo para la tripulación!';
      } else {
        happyMascot = '🍡';
        sub = '¡Dale mochis a tu dragoncito!';
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
        if (gameType === 'pinata') {
          // Piñata Tigre v2: player-pinata.js opens the hit screen at the server's lead-in (it listens to answer-result)
        } else if (gameType === 'kingdoms') {
          if (kingdoms && kingdoms.needsPlant && window.KingdomsPhone) window.KingdomsPhone.prompt(kingdoms);
        } else if (gameType === 'paint' || gameType === 'snow' || gameType === 'escape') {
          // Dragones Pintores / Batalla de Nieve: their phone modules return the kid to the map after the result screen.
          // La Gran Fuga: the server sends the next question after the turbo.
        } else if (gameType === 'mochi-mash' && window.MochiPhone) {
          // Mochi Mash v2: player-mochi.js opens its mash zone at the server's lead-in (it listens to answer-result)
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

    // (the headline / hint of the legacy mash screen)
    if ($('mash-headline')) $('mash-headline').innerHTML = '⚡ ¡A APLASTAR! ⚡';
    if ($('mash-hint')) $('mash-hint').innerHTML = '¡TOCA, TOCA, TOCA! 🔥 8/seg = combo';

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
    if (window.KingdomsPhone) window.KingdomsPhone.stop();
    MochiSounds.stopMusic();
    if (MochiSounds.stopGameTheme) MochiSounds.stopGameTheme();
    // After Modo Maestro (warmup), kids skip the "Empate épico / Inicio"
    // screen entirely and land straight in their /homework portal — no
    // logout, no extra tap. (Other game types keep the celebration screen.)
    if (gameType === 'warmup' && myStudentCode) {
      try { showReconnectOverlay('Clase terminada. Llevándote a tu portal…'); } catch (_) {}
      setTimeout(() => {
        location.href = '/homework?code=' + encodeURIComponent(myStudentCode) + '&from=maestro';
      }, 1800);
      return;
    }
    Dralingo.stopRandom();
    stopLobbyFlappy();
    if (mashTimerInterval) clearInterval(mashTimerInterval);
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
      $('end-emoji').textContent = team === 'red' ? '🔥👑' : '🌊👑';
      $('end-banner').textContent = gameType === 'kingdoms' ? '¡Tu reino ganó!' : '¡Victoria!';
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
    // 🆕 2026-06-21 (Fernando) — "if my sala dies, ALWAYS get them home."
    // ANY game type now sends a kid with a known code straight back to their
    // homework profile (a clean place I can re-grab them from), instead of
    // stranding them on a dead room. Only kids with no code fall back to the
    // public login. This is the auto-version of the 🏠 send-home button.
    if (myStudentCode) {
      showReconnectOverlay('Sala terminada. Llevándote a tu perfil…');
      setTimeout(() => {
        location.href = '/homework?code=' + encodeURIComponent(myStudentCode) + '&from=maestro';
      }, 2200);
      return;
    }
    // No student code (rare) — gentle card, then the public inicio.
    showReconnectOverlay('El anfitrión terminó la ronda. Volviendo al inicio…');
    setTimeout(() => { location.href = '/'; }, 3500);
  });

  socket.on('state', (s) => {
    // 🏆 HSKSIM EARLY REDIRECT — the moment we learn this room is an
    // HSK simulation, jump to /hsk-sim.html. Don't wait for countdown;
    // don't render the player lobby. If the kid joined LATE (room is
    // already 'active'), they redirect anyway and the test starts on
    // their device immediately. Uses location.replace() so the back
    // button doesn't trap them on the wrong page.
    if (s && s.gameType === 'hsksim' && location.pathname !== '/hsk-sim.html') {
      let sc = '';
      try { sc = localStorage.getItem('dralyStudentCode') || ''; } catch (_) {}
      const url = '/hsk-sim.html?pin=' + encodeURIComponent(pin)
        + (sc ? '&code=' + encodeURIComponent(sc) : '');
      location.replace(url);
      return;
    }
    const onEndScreen = $('screen-end') && !$('screen-end').classList.contains('hidden');
    if (s.state === 'lobby' && (currentQid || onEndScreen)) {
      // host reset
      currentQid = null;
      myScore = 0;
      enterLobby();
    }
    // === Catch-up watchdog ===
    // If the server says we're 'active' but we're still showing the lobby or
    // a frozen countdown screen, we missed the 'countdown' event (flaky wifi,
    // backgrounded tab, etc.). Force a transition onto the question screen
    // so the player isn't left on a dead lobby.
    if (s.state === 'active') {
      const lobbyVisible = $('screen-lobby') && !$('screen-lobby').classList.contains('hidden');
      const countdownVisible = $('screen-countdown') && !$('screen-countdown').classList.contains('hidden');
      if (lobbyVisible || countdownVisible) {
        showScreen(gameType === 'snow' ? 'snow' : gameType === 'halcon' ? 'halcon' : gameType === 'sixseven' ? 'sixseven' : gameType === 'dragon-eye' ? 'dragon' : 'question');   // the snow map / the board is the kid's main screen
        stopLobbyFlappy();
      }
    }
  });

  function showScreen(name) {
    ['join', 'lobby', 'countdown', 'question', 'result', 'mash', 'mochi', 'pinata', 'dragon', 'monopoly', 'sixseven', 'kd-plant', 'paint', 'snow', 'escape', 'halcon', 'wu', 'rd', 'end'].forEach((n) => {
      const el = $('screen-' + n);
      if (el) el.classList.toggle('hidden', n !== name);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // 🆕 2026-06-08 (Fernando): global presence heartbeat. Kid is inside
  // a live game → they're online but NOT polling the homework inbox,
  // so the teacher's "Solo en línea" filter would miss them and she
  // couldn't pull them into another room. Ping /api/heartbeat every 30s
  // with whatever studentCode lives in localStorage. Server side bumps
  // rec.lastSeen, which is what the picker's 60s online window checks.
  setInterval(() => {
    let code = '';
    try { code = localStorage.getItem('dralyStudentCode') || ''; } catch (_) {}
    if (!code) return;
    fetch('/api/heartbeat?code=' + encodeURIComponent(code), { method: 'GET', credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => {
        // 🆕 2026-06-21 (Fernando) — teacher "send to homework profile". If the
        // heartbeat answers with a redirect, the maestra is yanking this kid
        // back home (e.g. they were stuck in this room). Obey immediately.
        if (d && d.redirect) window.location.href = d.redirect;
      })
      .catch(() => {});
  }, 8000);   // 🆕 2026-06-21 (Fernando): 8s (was 30s) so "Llevar a casa" lands
              // in ~8s; if a beat is lost to bad signal the next one retries.
})();
