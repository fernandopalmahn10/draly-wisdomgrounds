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
          // when reconnecting between warmup and identity sessions.
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
          //     gameType. Otherwise the kid's old screen (e.g. screen-tri-pick
          //     from a previous triage game) stays visible until a per-game
          //     init event arrives — and for some games, no such event ever
          //     fires unless they actively participate. This guarantees a
          //     correct landing screen on every reconnect. ===
          routePlayerForGameState(resp.gameState, gameType);
          hideReconnectOverlay();
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
        $('join-error').textContent = resp.error || 'Could not join';
        MochiSounds.wrong();
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
      // Tag <body> with the gameType so per-game UI (e.g. triage-only blocks)
      // becomes visible. Removing all gametype-* classes first ensures the
      // tag is exclusive — no leakage when a player rejoins a different round.
      document.body.className = (document.body.className || '')
        .split(/\s+/).filter((c) => !c.startsWith('gametype-')).join(' ');
      document.body.classList.add('gametype-' + gameType);
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
  // they have a more specific target (e.g. tri-pick vs tri-cpr in triage).
  function routePlayerForGameState(gameState, gt) {
    if (gameState !== 'active') return;
    const screenForType = {
      'laiquhui':    'lqh',
      'identity':    'id',
      'warmup':      'wu',
      'partyrun':    'pr',
      'reading':     'rd',
      'triage':      'question',
      'sixseven':    'sixseven',
      'mochi-mash':  'question',
      'color-splash':'cs-walk',
      'color-clash': 'cc-play',
      'market-quest':'mq-play',
      'flappy':      'fl-play',
      'pinata':      'pinata-smash',
      'dragon-eye':  'dragon-flap',
      'monopoly':    'monopoly-roll',
      'zombie':      'zombie-sprint',
      'family':      'family-place',
      'conquest':    'cq-order',
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

  // === 6-7 SWING (sixseven) PLAYER LOGIC =====================================
  // Math problem + two giant 6/7 buttons. The mini character sways toward the
  // button last tapped. Streak counter + speed bonus + Rewards toasts on combos.
  let ssMyScore = 0;
  let ssMyStreak = 0;
  let ssCurrentQid = null;
  let ssSwayTarget = 0;
  let ssSwayLerp = 0;
  let ssSwayRaf = null;
  let ssFloatTimer = null;
  let ssButtonsBound = false;

  function renderSixSevenQuestion(q) {
    ssCurrentQid = q.qid;
    // Show the math problem; reset button states
    if ($('ss-problem')) $('ss-problem').textContent = q.text;
    document.querySelectorAll('.ss-btn').forEach((b) => {
      b.disabled = false;
      b.classList.remove('tapped');
    });
    // First-time setup: bind buttons + start ambient loops + load asset
    if (!ssButtonsBound) {
      bindSixSevenButtons();
      startSixSevenSwayLoop();
      startSixSevenFloats();
      loadSixSevenPlayerAsset();
      startPlayerJumpscareLoop();
      ssButtonsBound = true;
    }
    showScreen('sixseven');
  }

  // 67 JUMPSCARE — the user's PNG art now appears RARELY as a full-screen
  // dance, NOT as the central icon. Detect which file is available, then
  // spawn the big dancing overlay on combo x3 + every 30-50s ambient.
  // CSS character stays as the calm central figure.
  let ssPlayerJumpscareUrl = null;
  function loadSixSevenPlayerAsset() {
    const candidates = [
      '/assets/png-library/67-transparent.png',  // bg-removed version — preferred
      '/assets/png-library/67.png',
      '/assets/67.jpg',
      '/assets/sixseven-character.png',
      '/assets/sixseven-character.jpg',
      '/assets/sixseven.png',
    ];
    let idx = 0;
    function tryNext() {
      if (idx >= candidates.length) {
        console.warn('[6-7] No jumpscare image in /assets/.');
        return;
      }
      const url = candidates[idx++];
      const probe = new Image();
      probe.onload = () => {
        ssPlayerJumpscareUrl = url;
        console.log('[6-7] Player jumpscare ready: ' + url);
      };
      probe.onerror = () => tryNext();
      probe.src = url;
    }
    tryNext();
  }
  function spawnPlayerSixSevenJumpscare() {
    if (!ssPlayerJumpscareUrl) return;
    if (document.querySelector('.ss-jumpscare')) return;
    const wrap = document.createElement('div');
    wrap.className = 'ss-jumpscare';
    const img = document.createElement('img');
    img.src = ssPlayerJumpscareUrl;
    img.alt = '67';
    img.draggable = false;
    wrap.appendChild(img);
    document.body.appendChild(wrap);
    MochiSounds.sixSevenChant && MochiSounds.sixSevenChant();
    setTimeout(() => MochiSounds.swingWhoosh && MochiSounds.swingWhoosh(), 80);
    if (navigator.vibrate) navigator.vibrate([40, 20, 60, 20, 40]);
    setTimeout(() => wrap.remove(), 2300);
  }
  // Periodic player jumpscare every 30-50s
  let ssPlayerJumpscareTimer = null;
  function startPlayerJumpscareLoop() {
    if (ssPlayerJumpscareTimer) clearTimeout(ssPlayerJumpscareTimer);
    const tick = () => {
      ssPlayerJumpscareTimer = setTimeout(() => {
        if (gameType === 'sixseven' && !document.hidden) {
          spawnPlayerSixSevenJumpscare();
        }
        tick();
      }, 30000 + Math.random() * 20000);
    };
    tick();
  }
  function stopPlayerJumpscareLoop() {
    if (ssPlayerJumpscareTimer) { clearTimeout(ssPlayerJumpscareTimer); ssPlayerJumpscareTimer = null; }
  }

  function bindSixSevenButtons() {
    const btn6 = $('ss-btn-6');
    const btn7 = $('ss-btn-7');
    [{ btn: btn6, idx: 0, choice: '6' },
     { btn: btn7, idx: 1, choice: '7' }].forEach(({ btn, idx, choice }) => {
      if (!btn) return;
      // Belt-and-suspenders: pointerdown + click + touchstart, dedupe, no
      // preventDefault on mouse so synthetic click survives.
      let lastTap = 0;
      const onTap = (e) => {
        const now = Date.now();
        if (now - lastTap < 120) return;     // dedupe pointer + click
        lastTap = now;
        if (e && e.pointerType !== 'mouse' && e.cancelable) {
          try { e.preventDefault(); } catch (_) {}
        }
        if (btn.disabled) return;
        // Tap pop + sway nudge — IMMEDIATE local feedback before server reply
        btn.classList.remove('tapped');
        void btn.offsetWidth;
        btn.classList.add('tapped');
        ssSwayTarget = Math.max(-1, Math.min(1, ssSwayTarget * 0.4 + (choice === '7' ? 1 : -1) * 0.6));
        if (navigator.vibrate) navigator.vibrate(20);
        if (choice === '7') MochiSounds.tap7 && MochiSounds.tap7();
        else MochiSounds.tap6 && MochiSounds.tap6();
        // Disable both buttons until we get a response
        document.querySelectorAll('.ss-btn').forEach((b) => b.disabled = true);
        // Fire-and-forget — NO heartbeat overlay, NO retry layer.
        // Sixseven runs at 600-800ms cadence so the next question always
        // bails out the player if anything went wrong.
        sendSixSevenAnswer(ssCurrentQid, idx);
      };
      btn.addEventListener('pointerdown', onTap, { passive: false });
      btn.addEventListener('click', onTap);
      btn.addEventListener('touchstart', onTap, { passive: false });
      btn.oncontextmenu = (e) => { e.preventDefault(); return false; };
    });
  }

  // Direct, no-overlay, no-heartbeat send for sixseven. The standard
  // sendAnswerBulletproof() shows an "Enviando respuesta…" overlay + uses
  // a 1Hz heartbeat that retries the answer if no ack — overkill for the
  // 600-800ms cadence sixseven runs at, and the user reported the overlay
  // getting stuck visually. Fire-and-forget: if the answer is dropped, the
  // next question arrives in <1s anyway and resets everything.
  function sendSixSevenAnswer(qid, choiceIdx) {
    try {
      socket.emit('player:answer', { pin, qid, choiceIdx });
    } catch (_) {}
    // Safety net: if no answer-result arrives in 1.5s, re-enable buttons
    // so the player isn't stuck (e.g., they tapped during a disconnect).
    setTimeout(() => {
      document.querySelectorAll('.ss-btn').forEach((b) => {
        if (b.disabled) b.disabled = false;
      });
    }, 1500);
  }

  function startSixSevenSwayLoop() {
    if (ssSwayRaf) cancelAnimationFrame(ssSwayRaf);
    const frame = () => {
      ssSwayLerp += (ssSwayTarget - ssSwayLerp) * 0.12;
      ssSwayTarget *= 0.985;
      const wrap = $('ss-player-character-wrap');
      if (wrap) wrap.style.setProperty('--sway', ssSwayLerp.toFixed(3));
      ssSwayRaf = requestAnimationFrame(frame);
    };
    frame();
  }

  function startSixSevenFloats() {
    if (ssFloatTimer) clearInterval(ssFloatTimer);
    ssFloatTimer = setInterval(() => {
      const layer = $('ss-player-float-layer');
      if (!layer || gameType !== 'sixseven') return;
      // Light density on phones — 1 floater every 1.4s
      const f = document.createElement('div');
      f.className = 'ss-floater ' + (Math.random() < 0.5 ? 'six' : 'seven');
      f.textContent = Math.random() < 0.5 ? '6' : '7';
      f.style.left = (Math.random() * 100) + '%';
      f.style.fontSize = (1.2 + Math.random() * 2.5) + 'rem';
      f.style.animationDuration = (5 + Math.random() * 4) + 's';
      layer.appendChild(f);
      setTimeout(() => f.remove(), 11000);
    }, 1400);
  }

  function flashSixSevenFeedback(correct) {
    const el = $(correct ? 'ss-flash-correct' : 'ss-flash-wrong');
    if (!el) return;
    el.classList.remove('fire');
    void el.offsetWidth;
    el.classList.add('fire');
  }

  // === ENGAGEMENT LAYER (like zombie's spooky ambience, but cheerful) ===
  // Ambient "67!" peeks from the screen edges every 4-8s, periodic dance
  // moments (10-16s) where the character breaks out + the screen flashes
  // gold/cyan/purple with a giant "67!" centerpiece, and screen shake on
  // big combos. Critical: gives the math grind real emotional beats.
  let ssAmbiencePeekTimer = null;
  let ssDanceTimer = null;
  function startSixSevenAmbience() {
    const layer = $('ss-ambience');
    if (layer) layer.classList.remove('hidden');
    schedulePeek();
    scheduleDance();
  }
  function stopSixSevenAmbience() {
    const layer = $('ss-ambience');
    if (layer) { layer.classList.add('hidden'); layer.innerHTML = ''; }
    if (ssAmbiencePeekTimer) { clearTimeout(ssAmbiencePeekTimer); ssAmbiencePeekTimer = null; }
    if (ssDanceTimer) { clearTimeout(ssDanceTimer); ssDanceTimer = null; }
  }
  function schedulePeek() {
    const wait = 4000 + Math.random() * 4000;
    ssAmbiencePeekTimer = setTimeout(() => {
      spawnSixSevenPeek();
      schedulePeek();
    }, wait);
  }
  function spawnSixSevenPeek() {
    if (gameType !== 'sixseven') return;
    if (document.hidden) return;
    const layer = $('ss-ambience');
    if (!layer) return;
    const sides = ['top', 'bottom', 'left', 'right'];
    const side = sides[Math.floor(Math.random() * sides.length)];
    const isSeven = Math.random() < 0.5;
    const peek = document.createElement('div');
    peek.className = `ss-peek ${side}${isSeven ? ' seven' : ''}`;
    peek.textContent = isSeven ? '7!' : '6!';
    const pos = 15 + Math.random() * 70;
    if (side === 'top' || side === 'bottom') peek.style.left = pos + '%';
    if (side === 'left' || side === 'right') peek.style.top = pos + '%';
    layer.appendChild(peek);
    // Audio cue — alternate 6 and 7 tones for variety
    if (isSeven) MochiSounds.tap7 && MochiSounds.tap7();
    else MochiSounds.tap6 && MochiSounds.tap6();
    if (navigator.vibrate) navigator.vibrate(20);
    setTimeout(() => peek.remove(), 2000);
  }
  function scheduleDance() {
    const wait = 10000 + Math.random() * 6000;
    ssDanceTimer = setTimeout(() => {
      triggerSixSevenDance();
      scheduleDance();
    }, wait);
  }
  function triggerSixSevenDance() {
    if (gameType !== 'sixseven') return;
    if (document.hidden) return;
    // 1) Make BOTH the PNG image and the CSS-fallback character DANCE for ~2.5s
    document.querySelectorAll('.ss-character, .ss-character-img').forEach((c) => {
      c.classList.remove('dancing');
      void c.offsetWidth;
      c.classList.add('dancing');
      setTimeout(() => c.classList.remove('dancing'), 2500);
    });
    // 2) Full-screen colored flash + centerpiece
    const flash = document.createElement('div');
    flash.className = 'ss-dance-flash';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 1900);
    const center = document.createElement('div');
    center.className = 'ss-dance-centerpiece';
    center.textContent = '67!';
    document.body.appendChild(center);
    setTimeout(() => center.remove(), 1900);
    // 3) Audio fanfare: 67 chant + drum + swing whoosh
    MochiSounds.sixSevenChant && MochiSounds.sixSevenChant();
    setTimeout(() => MochiSounds.swingWhoosh && MochiSounds.swingWhoosh(), 200);
    // 4) Vibrate
    if (navigator.vibrate) navigator.vibrate([60, 40, 60, 40, 100]);
    // 5) Burst of edge peeks for spectacle
    for (let i = 0; i < 4; i++) {
      setTimeout(spawnSixSevenPeek, i * 200);
    }
  }
  function shakeSixSevenScreen() {
    document.body.classList.remove('ss-shake');
    void document.body.offsetWidth;
    document.body.classList.add('ss-shake');
    setTimeout(() => document.body.classList.remove('ss-shake'), 550);
  }

  function updateSixSevenHud(score, streak) {
    if (typeof score === 'number') {
      ssMyScore = score;
      if ($('ss-player-score')) $('ss-player-score').textContent = ssMyScore;
    }
    if (typeof streak === 'number') {
      ssMyStreak = streak;
      if ($('ss-player-streak')) $('ss-player-streak').textContent = ssMyStreak;
      const pill = $('ss-player-streak-pill');
      if (pill) pill.classList.toggle('hot', ssMyStreak >= 3);
    }
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
    } else if (gameType === 'conquest') {
      teamLabel = isRed ? 'Caballería Roja 紅龍' : 'Caballería Dorada 金龍';
      teamMascot = isRed ? '🐉' : '🐲';
    } else if (gameType === 'sixseven') {
      teamLabel = isRed ? 'Equipo 6 🟦' : 'Equipo 7 🟪';
      teamMascot = isRed ? '6' : '7';
    } else if (gameType === 'triage') {
      teamLabel = isRed ? 'Doctores Rojos 🩺' : 'Doctores Dorados 💉';
      teamMascot = isRed ? '🩺' : '💉';
    } else if (gameType === 'laiquhui') {
      teamLabel = isRed ? 'Mensajeros Rojos 紅信使' : 'Mensajeros Dorados 金信使';
      teamMascot = isRed ? '🐲' : '🐉';
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
    // Zombie game: start the spooky ambient layer that haunts the player's
    // question/result screens with peeks + groans (separate from the in-sprint
    // jumpscares — this one runs the WHOLE game)
    if (gameType === 'zombie') startZombieAmbience();
    // === LÁI-QÙ-HUÍ: jump straight into the courier screen after countdown.
    // The first `lqh:mission` event will land on us almost immediately and
    // call lqhShowMission() which calls showScreen('lqh').
    if (gameType === 'laiquhui') {
      setTimeout(() => showScreen('lqh'), 3500);
    }
    // === SHÉI SHÌ?: jump to the identity detective screen ===
    if (gameType === 'identity') {
      setTimeout(() => showScreen('id'), 1000);
    }
    // === HÓNGBĀO RUN: jump to the partyrun board screen ===
    if (gameType === 'partyrun') {
      setTimeout(() => showScreen('pr'), 1000);
    }
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
    // === TRIAGE: omnipresent floating-vocab background on the player phone.
    // This is the "intrusive vocab" the user asked for, on the screen kids
    // actually look at. Spawns a new pinyin tile every ~2.4s for the entire
    // round; tiles drift up the screen and fade. ===
    if (gameType === 'triage') startTriageVocabBg();
    // 6-7 SWING engagement layer — ambient peeks + periodic dance moments
    if (gameType === 'sixseven') {
      if (window.unlockAudio) window.unlockAudio();
      // Mark body so the decorative lanterns hide site-wide on Safari (no :has())
      document.body.classList.add('sixseven-active');
      startSixSevenAmbience();
    }
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
    // === TRIAGE-LEAK GUARD (bug fix 2026-05-27) ===
    // A standard quiz `question` event is ONLY ever sent by set-based
    // games (Mochi Mash, Market Quest, Color Clash, Monopoly, etc.) —
    // NEVER by Triage (which uses tri-patient / tri-treat events). So if
    // we're receiving one, we are definitively NOT in triage. Strip any
    // leftover hospital vocab banner / floating tiles / ambulance / walking
    // doctor that leaked from a stale `gametype-triage` body class on a
    // previous session in this browser tab. This is what put the
    // "El doctor trabaja en el hospital" banner on top of Mochi Mash.
    if (document.body.classList.contains('gametype-triage')) {
      document.body.classList.remove('gametype-triage');
    }
    if (typeof stopTriageVocabBg === 'function') stopTriageVocabBg();
    // 6-7 SWING — completely different question UI: skip the standard
    // multi-choice answer grid, show the math problem + two giant buttons.
    if (q.gameMode === 'sixseven' || gameType === 'sixseven') {
      renderSixSevenQuestion(q);
      return;
    }
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

  // === REINOS EN GUERRA v5 — STRATEGIC MARCH-ORDER PICKER ===
  // Shown after a correct vocab answer. Three big buttons + 5s auto-resolve.
  // Whatever the player taps becomes the team's next move on the host board.
  let cqOrderTimer = null;
  function showConquestOrderPicker(availability) {
    const tag = $('cq-order-team-tag');
    if (tag) {
      tag.textContent = (team === 'red' ? '🐉 Caballería Roja' : '🐲 Caballería Dorada');
      tag.className = 'cq-order-team-tag ' + team;
    }
    // Apply availability — greyed-out buttons aren't tappable but stay visible
    document.querySelectorAll('.cq-order-btn').forEach((b) => {
      const ord = b.dataset.order;
      const ok = availability[ord] !== false;
      b.disabled = !ok;
      b.classList.toggle('cq-order-disabled', !ok);
    });
    showScreen('cq-order');
    if (window.unlockAudio) window.unlockAudio();
    if (MochiSounds.warDrum) MochiSounds.warDrum();
    // Bind buttons (one-shot — first tap wins, then disable all)
    let chosen = false;
    function emitOrder(order) {
      if (chosen) return;
      chosen = true;
      if (cqOrderTimer) { clearInterval(cqOrderTimer); cqOrderTimer = null; }
      document.querySelectorAll('.cq-order-btn').forEach((b) => b.disabled = true);
      // Visual feedback on the tapped button
      const btn = document.querySelector(`.cq-order-btn[data-order="${order}"]`);
      if (btn) btn.classList.add('cq-order-chosen');
      // Sound by order type
      if (order === 'attack' && MochiSounds.swordClash) MochiSounds.swordClash();
      else if (order === 'advance' && MochiSounds.horseGallop) MochiSounds.horseGallop();
      else if (order === 'defend' && MochiSounds.archerTwang) MochiSounds.archerTwang();
      if (navigator.vibrate) navigator.vibrate(30);
      try { socket.emit('player:cq-order', { pin, order }); } catch (_) {}
    }
    document.querySelectorAll('.cq-order-btn').forEach((b) => {
      const ord = b.dataset.order;
      b.onpointerdown = (e) => { if (e) e.preventDefault(); if (!b.disabled) emitOrder(ord); };
      b.onclick = (e) => { if (e) e.preventDefault(); if (!b.disabled) emitOrder(ord); };
    });
    // 5-second countdown. If they don't pick, auto-fire the first available.
    const totalMs = 5000;
    const startedAt = Date.now();
    if ($('cq-order-timer-num')) $('cq-order-timer-num').textContent = '5';
    if ($('cq-order-timer-fill')) $('cq-order-timer-fill').style.width = '100%';
    if (cqOrderTimer) clearInterval(cqOrderTimer);
    cqOrderTimer = setInterval(() => {
      const remaining = Math.max(0, (startedAt + totalMs) - Date.now());
      if ($('cq-order-timer-num')) $('cq-order-timer-num').textContent = Math.ceil(remaining / 1000);
      if ($('cq-order-timer-fill')) $('cq-order-timer-fill').style.width = ((remaining / totalMs) * 100) + '%';
      if (remaining <= 0) {
        clearInterval(cqOrderTimer); cqOrderTimer = null;
        if (!chosen) {
          // Auto-resolve to the first available option
          const order = availability.attack ? 'attack'
                      : availability.advance ? 'advance' : 'defend';
          emitOrder(order);
        }
      }
    }, 100);
  }
  // === TRIAGE ER — PATIENT-PICK SCREEN LOGIC ===
  // Shown after a correct vocab answer in Triage. Cards = up to 4 patients
  // sorted by urgency. Tap a card → emit player:tri-treat. 5s auto-resolve.
  let triPickTimer = null;
  function showTriagePatientPicker(patients) {
    const tag = document.getElementById('tri-pick-team-tag');
    if (tag) {
      tag.textContent = (team === 'red' ? '🩺 Doctor Rojo' : '💉 Doctor Dorado');
      tag.className = 'tri-pick-team-tag ' + team;
    }
    const cardsEl = document.getElementById('tri-pick-cards');
    if (!cardsEl) return;
    cardsEl.innerHTML = '';
    // Build a card per patient. Critical ones get a 🚨 halo + alarm class.
    // Empty cards (when fewer than 4 alive) are shown grayed out as "all clear".
    if (!patients.length) {
      const empty = document.createElement('div');
      empty.className = 'tri-pick-empty';
      empty.innerHTML = '<div class="tri-pick-empty-icon">✅</div><div>Ward despejado — ¡todos a salvo!</div>';
      cardsEl.appendChild(empty);
    }
    patients.forEach((pat) => {
      const card = document.createElement('button');
      card.className = 'tri-pick-card' + (pat.critical ? ' critical' : '');
      card.dataset.patientId = pat.id;
      const lifePct = Math.round((pat.lifeHpRatio || 0) * 100);
      const lifeBarClass = lifePct < 30 ? 'danger' : (lifePct < 60 ? 'warn' : 'ok');
      card.innerHTML = `
        <div class="tri-pick-card-bed">Cama ${pat.bedIdx + 1}</div>
        <div class="tri-pick-card-icon">${pat.icon}${pat.critical ? '<span class="tri-pick-crit-badge">🚨</span>' : ''}</div>
        <div class="tri-pick-card-name">${escapeHtml(pat.name || '')}</div>
        <div class="tri-pick-card-life ${lifeBarClass}"><div class="tri-pick-card-life-fill" style="width:${lifePct}%;"></div></div>
        <div class="tri-pick-card-pts">${pat.critical ? '+25 pts' : '+10 pts'}</div>
      `;
      cardsEl.appendChild(card);
    });
    showScreen('tri-pick');
    if (window.unlockAudio) window.unlockAudio();
    if (MochiSounds.heartMonitorBeep) MochiSounds.heartMonitorBeep();
    let chosen = false;
    function emitTreat(patientId) {
      if (chosen) return;
      chosen = true;
      if (triPickTimer) { clearInterval(triPickTimer); triPickTimer = null; }
      cardsEl.querySelectorAll('.tri-pick-card').forEach((c) => c.disabled = true);
      const card = cardsEl.querySelector(`.tri-pick-card[data-patient-id="${patientId}"]`);
      if (card) card.classList.add('chosen');
      if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
      // Resolve the picked patient from the snapshot list we already have so
      // the CPR screen can display the right icon + name + critical flag.
      const picked = (patients || []).find((pp) => pp.id === patientId);
      // If they timed out with an empty ward, skip CPR and emit directly so
      // the server falls back to its empty-ward branch.
      if (!picked) {
        try { socket.emit('player:tri-treat', { pin, patientId }); } catch (_) {}
        return;
      }
      // === Launch the CPR mini-game ===
      // Player still has to actually DO the rescue — taps drive a power ring
      // that fills with each compression. Critical patients also get a defib
      // power-meter at the end for bonus points.
      startCprMiniGame(picked);
    }
    // Bind cards (one-shot — first tap wins)
    cardsEl.querySelectorAll('.tri-pick-card').forEach((card) => {
      const pid = Number(card.dataset.patientId);
      const onTap = (e) => { if (e) e.preventDefault(); if (!card.disabled) emitTreat(pid); };
      card.addEventListener('pointerdown', onTap);
      card.addEventListener('click', onTap);
    });
    // 5-second countdown
    const totalMs = 5000;
    const startedAt = Date.now();
    if (document.getElementById('tri-pick-timer-num')) document.getElementById('tri-pick-timer-num').textContent = '5';
    if (document.getElementById('tri-pick-timer-fill')) document.getElementById('tri-pick-timer-fill').style.width = '100%';
    if (triPickTimer) clearInterval(triPickTimer);
    triPickTimer = setInterval(() => {
      const remaining = Math.max(0, (startedAt + totalMs) - Date.now());
      const numEl = document.getElementById('tri-pick-timer-num');
      const fillEl = document.getElementById('tri-pick-timer-fill');
      if (numEl) numEl.textContent = Math.ceil(remaining / 1000);
      if (fillEl) fillEl.style.width = ((remaining / totalMs) * 100) + '%';
      if (remaining <= 0) {
        clearInterval(triPickTimer); triPickTimer = null;
        if (!chosen) {
          // Auto-pick: most-urgent (first card). If no patients at all, emit -1
          // so server falls back to its empty-ward branch.
          const firstCard = cardsEl.querySelector('.tri-pick-card');
          const pid = firstCard ? Number(firstCard.dataset.patientId) : -1;
          emitTreat(pid);
        }
      }
    }, 100);
  }
  // === TRIAGE ER — CPR / DEFIB MINI-GAME ===
  // Drives the screen-tri-cpr interactive rescue. The player must actually
  // TAP the heart enough times within a window to revive the patient. Each
  // tap pulses the heart, beeps the monitor, fills the rescue ring, and
  // draws another spike on the live EKG. Critical patients also get a
  // defibrillator power-meter where timing-the-needle on the green zone
  // adds bonus points. Result is sent to the server via player:tri-treat
  // with an extra `bonus` field (small integer).
  // === SENTENCE POOL — cycled per CPR rescue ===
  // Five HSK1 sentences using the target hospital/doctor vocabulary. The
  // server doesn't pick the sentence; the client just rotates locally so
  // every rescue introduces a new linguistic angle on the same set of words.
  const TRI_SENTENCES = [
    { pinyin: 'Yīshēng zài <strong>yīyuàn</strong> 🏥 gōngzuò', es: 'El doctor trabaja en el hospital' },
    { pinyin: 'Yīshēng zài <strong>nǎ’er</strong>?',            es: '¿Dónde está el doctor?' },
    { pinyin: 'Wǒ qù <strong>yīyuàn</strong> 🏥',               es: 'Voy al hospital' },
    { pinyin: '<strong>Yīyuàn</strong> hěn dà',                 es: 'El hospital es grande' },
    { pinyin: 'Bìngrén zài <strong>yīyuàn</strong> 🏥',         es: 'El paciente está en el hospital' },
    { pinyin: 'Wǒ shì <strong>yīshēng</strong> 🩺',             es: 'Soy doctor' },
  ];
  let triSentenceIdx = 0;
  function currentSentence() { return TRI_SENTENCES[triSentenceIdx % TRI_SENTENCES.length]; }
  function advanceSentence() { triSentenceIdx = (triSentenceIdx + 1) % TRI_SENTENCES.length; }

  let cprState = null;
  function startCprMiniGame(picked) {
    // Reset state
    if (cprState && cprState.timerInt) clearInterval(cprState.timerInt);
    if (cprState && cprState.defibInt) clearInterval(cprState.defibInt);
    if (cprState && cprState.rhythmInt) clearInterval(cprState.rhythmInt);
    cprState = {
      patientId: picked.id,
      isCritical: !!picked.critical,
      // === NEW MECHANIC: 3 RHYTHMIC compressions (was 5-8 spam taps) ===
      // The user wanted LESS tapping and MORE timing/precision. Now you have
      // to tap the heart in sync with a metronome dot crossing a green zone.
      // Mistimed taps don't advance progress; the rhythm bar shakes red.
      tapsNeeded: 3,
      tapsDone: 0,
      ekgPoints: ['0,30'],
      ekgX: 0,
      startedAt: Date.now(),
      // Tighter time window — forces real focus, no spamming through
      windowMs: picked.critical ? 8500 : 7500,
      timerInt: null,
      defibInt: null,
      rhythmInt: null,
      defibActive: false,
      defibAngle: 0,
      bonus: 0,
      completed: false,
      failed: false,
      // Rhythm metronome state
      rhythmT0: Date.now(),
      rhythmPeriodMs: 1100,        // dot completes one sweep every 1.1s
      rhythmPos: 0,                // 0..1, sin-wave position
      // The "stop the bar" mechanic now runs for EVERY patient, not just critical.
      // Critical = defib power-meter. Normal = single "stop the bar at center".
      wantsDefib: true,
      // Pick & advance the sentence shown on this CPR screen
      sentence: currentSentence(),
    };
    advanceSentence();
    // Populate the screen
    document.getElementById('tri-cpr-patient-icon').textContent = picked.icon || '🤒';
    document.getElementById('tri-cpr-patient-name').textContent = picked.name || 'Paciente';
    document.getElementById('tri-cpr-bedlabel').textContent = 'Cama ' + ((picked.bedIdx != null ? picked.bedIdx : 0) + 1);
    const stage = document.getElementById('tri-cpr-stage');
    if (stage) stage.classList.toggle('critical', cprState.isCritical);
    document.getElementById('tri-cpr-hint').textContent = cprState.isCritical
      ? `¡CRÍTICO! Toca al ritmo → DESCARGA en VERDE`
      : `Toca al ritmo → DESCARGA en VERDE`;
    // === Inject the current sentence onto the screen as the level header ===
    let levelEl = document.getElementById('tri-cpr-level');
    if (!levelEl) {
      levelEl = document.createElement('div');
      levelEl.id = 'tri-cpr-level';
      levelEl.className = 'tri-cpr-level';
      const stageEl = document.getElementById('tri-cpr-stage');
      if (stageEl && stageEl.parentNode) stageEl.parentNode.insertBefore(levelEl, stageEl);
    }
    levelEl.innerHTML = `
      <div class="tri-cpr-level-pinyin">${cprState.sentence.pinyin}</div>
      <div class="tri-cpr-level-es">${cprState.sentence.es}</div>`;
    // === Inject the rhythm metronome bar above the heart ===
    let rhythmEl = document.getElementById('tri-cpr-rhythm');
    if (!rhythmEl) {
      rhythmEl = document.createElement('div');
      rhythmEl.id = 'tri-cpr-rhythm';
      rhythmEl.className = 'tri-cpr-rhythm';
      rhythmEl.innerHTML = `
        <div class="tri-rh-track">
          <div class="tri-rh-zone"></div>
          <div class="tri-rh-dot" id="tri-rh-dot"></div>
        </div>
        <div class="tri-rh-label">TOCA cuando el punto entre en VERDE</div>`;
      const stageEl = document.getElementById('tri-cpr-stage');
      if (stageEl) stageEl.insertBefore(rhythmEl, stageEl.firstChild);
    }
    rhythmEl.classList.remove('shake');
    // Render the ticks
    const ticksEl = document.getElementById('tri-cpr-ticks');
    ticksEl.innerHTML = '';
    for (let i = 0; i < cprState.tapsNeeded; i++) {
      const t = document.createElement('div');
      t.className = 'tri-cpr-tick';
      t.dataset.idx = i;
      ticksEl.appendChild(t);
    }
    // Reset live EKG
    const ekgLive = document.getElementById('tri-cpr-ekg-live');
    if (ekgLive) ekgLive.setAttribute('points', '0,30');
    // Reset defib panel
    document.getElementById('tri-cpr-defib').classList.add('hidden');
    document.getElementById('tri-cpr-defib-btn').disabled = false;
    // Show the screen
    showScreen('tri-cpr');
    if (MochiSounds.heartMonitorBeep) MochiSounds.heartMonitorBeep();
    if (window.unlockAudio) window.unlockAudio();
    // Bind the heart button — pointerdown for snappy taps
    const heart = document.getElementById('tri-cpr-heart');
    const heartHandler = (e) => {
      if (e) e.preventDefault();
      cprHandleCompression();
    };
    heart.onpointerdown = heartHandler;
    heart.onclick = heartHandler;
    // Bind the defib release button (only used for critical step)
    const defibBtn = document.getElementById('tri-cpr-defib-btn');
    const defibHandler = (e) => {
      if (e) e.preventDefault();
      cprReleaseDefib();
    };
    defibBtn.onpointerdown = defibHandler;
    defibBtn.onclick = defibHandler;
    // Start the timer countdown
    const fill = document.getElementById('tri-cpr-timer-fill');
    if (fill) fill.style.width = '100%';
    cprState.timerInt = setInterval(() => {
      if (!cprState) return;
      const remaining = Math.max(0, cprState.startedAt + cprState.windowMs - Date.now());
      if (fill) fill.style.width = ((remaining / cprState.windowMs) * 100) + '%';
      if (remaining <= 0) {
        clearInterval(cprState.timerInt); cprState.timerInt = null;
        // Time's up — auto-commit whatever progress they made
        cprCommit('timeout');
      }
    }, 80);
    // Clear any previous tap-bonus words + start the floating-vocab spawner
    cprClearVocabFloats();
    cprState.vocabBonus = 0;     // +1 per tapped vocab word, capped at 3
    cprState.vocabSpawnInt = setInterval(() => {
      if (!cprState || cprState.completed) return;
      cprSpawnVocabTap();
    }, 900);
    // Seed one immediately
    setTimeout(cprSpawnVocabTap, 300);
    // === Drive the rhythm-metronome dot ===
    // 60Hz update of the dot's horizontal position. The dot sweeps a
    // sin-wave: 0% → 100% → 0%. "Green zone" is 38-62%, "yellow" 22-38 +
    // 62-78%, "red" elsewhere. cprHandleCompression checks the current
    // position at tap time to decide if the tap counts.
    cprState.rhythmInt = setInterval(() => {
      if (!cprState || cprState.completed) return;
      const t = (Date.now() - cprState.rhythmT0) / cprState.rhythmPeriodMs;
      // sin gives -1..1; we want 0..100
      const pos = (Math.sin(t * Math.PI * 2) + 1) * 50;
      cprState.rhythmPos = pos;
      const dot = document.getElementById('tri-rh-dot');
      if (dot) dot.style.left = pos + '%';
    }, 16);
  }
  // ===========================================================================
  // SHÉI SHÌ? · Identity Detective — per-player round picker
  // ===========================================================================
  let idCurrentRound = null;
  let idTimerInt = null;
  socket.on('id:init', () => {
    if (gameType !== 'identity') return;
    showScreen('id');
  });
  socket.on('id:round', (data) => {
    if (gameType !== 'identity') return;
    // Force-route to the identity screen — handles late-join where the
    // player was previously stuck on (e.g.) the triage doctor banner.
    if (document.getElementById('screen-id') &&
        document.getElementById('screen-id').classList.contains('hidden')) {
      showScreen('id');
    }
    idCurrentRound = data;
    // HUD update
    if ($('id-score')) $('id-score').textContent = data.score || 0;
    if ($('id-streak')) $('id-streak').textContent = data.streak || 0;
    if ($('id-correct')) $('id-correct').textContent = data.correct || 0;
    if ($('id-wrong')) $('id-wrong').textContent = data.wrong || 0;
    // Clue
    $('id-clue-pinyin').innerHTML = idHighlightStruggleWords(data.clue.pinyin);
    $('id-clue-es').textContent = data.clue.es;
    // Suspects grid
    renderIdSuspects(data.suspects);
    // Timer bar
    if ($('id-clue-bar-fill')) $('id-clue-bar-fill').style.width = '100%';
    startIdTimer(data.deadline);
    // Hide any leftover feedback
    const fb = $('id-feedback');
    if (fb) { fb.classList.add('hidden'); fb.classList.remove('show'); }
  });
  socket.on('id:result', (data) => {
    if (gameType !== 'identity') return;
    if (idTimerInt) { clearInterval(idTimerInt); idTimerInt = null; }
    if (idShuffleHandle) { clearTimeout(idShuffleHandle); idShuffleHandle = null; }
    if ($('id-score')) $('id-score').textContent = data.score || 0;
    if ($('id-streak')) $('id-streak').textContent = data.streak || 0;
    if ($('id-wrong')) $('id-wrong').textContent = data.wrong || 0;
    // Reveal: flip EVERY card face-up. Match by dataset.suspectIdx (the real
    // identity that travels with the card through the shuffle), NOT by the
    // card's DOM position.
    document.querySelectorAll('.id-suspect-card').forEach((card) => {
      card.classList.remove('flipped');
      const realIdx = +card.dataset.suspectIdx;
      if (realIdx === data.targetIdx) card.classList.add('reveal-correct');
      if (!data.correct && realIdx === data.picked) card.classList.add('reveal-wrong');
    });
    idSetPhaseText(data.correct ? '🎯 ¡Lo encontraste!' : '🔎 ¡Mira de nuevo!');
    showIdFeedback(data);
    if (data.correct) {
      if (MochiSounds.correct) MochiSounds.correct();
      if (window.Rewards) {
        const tier = data.streak >= 5 ? 'epic' : data.streak >= 3 ? 'great' : 'common';
        window.Rewards.show({ tier, icon: '🕵️', text: `¡Correcto! +${data.points}` });
      }
    } else {
      if (MochiSounds.wrong) MochiSounds.wrong();
      if (window.Rewards) {
        window.Rewards.show({ icon: data.timeout ? '⏰' : '💔', text: data.timeout ? '¡Tiempo!' : 'Mira la pista de nuevo', duration: 1600 });
      }
    }
  });
  // === MAGIC-CARD / 3-CARD-MONTE MECHANIC =====================================
  // Card lifecycle in a round:
  //   PHASE A (memorize)  — all cards face UP for ~2.2s so player can scan
  //                          which one matches the clue.
  //   PHASE B (flip)      — all cards rotateY(180) face DOWN simultaneously.
  //   PHASE C (shuffle)   — N pair-swaps. Each swap visibly translates two
  //                          face-down cards to each other's slot. The card's
  //                          IDENTITY (dataset.suspectIdx) follows the card,
  //                          so when the player taps a slot, the server still
  //                          gets the correct suspect index.
  //   PHASE D (pick)      — cards re-enabled, player taps. The tapped card
  //                          flips back face-up immediately so they see what
  //                          they actually chose.
  //   PHASE E (result)    — every card flips face-up, correct + wrong are
  //                          highlighted via reveal-correct / reveal-wrong.
  function renderIdSuspects(suspects) {
    const wrap = $('id-suspects');
    if (!wrap) return;
    wrap.innerHTML = '';
    wrap.classList.add('id-suspects-shuffleable');
    // Cancel any prior shuffle still running
    if (idShuffleHandle) { clearTimeout(idShuffleHandle); idShuffleHandle = null; }
    const n = suspects.length;
    const cols = n <= 4 ? 2 : (n <= 6 ? 2 : 4);
    wrap.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    const cardEls = [];
    suspects.forEach((s, i) => {
      const card = document.createElement('button');
      card.className = 'id-suspect-card id-flipper';
      card.type = 'button';
      card.dataset.suspectIdx = i;
      card.disabled = true; // re-enabled after shuffle ends
      card.innerHTML = `
        <div class="id-card-3d">
          <div class="id-card-face id-card-front">
            <div class="id-sc-avatar">${s.avatar}</div>
            <div class="id-sc-row"><span class="id-sc-label">名字</span> <span class="id-sc-name">${s.name}</span></div>
            <div class="id-sc-row"><span class="id-sc-label">岁</span> <span class="id-sc-age">${s.age}</span></div>
            <div class="id-sc-row"><span class="id-sc-label">${s.rel.hanzi}</span> <span class="id-sc-rel">${s.rel.pinyin}</span></div>
          </div>
          <div class="id-card-face id-card-back">
            <div class="id-card-back-rune">🕵️</div>
            <div class="id-card-back-mark">?</div>
          </div>
        </div>`;
      cardEls.push(card);
      wrap.appendChild(card);
    });
    // Phase banner inside the narrator bubble — tells the kid what to do.
    idSetPhaseText('🔍 Lee la pista y memoriza…');
    // Narrator detective pops in with a little wave when the clue arrives
    const narrator = document.getElementById('id-narrator');
    if (narrator) {
      narrator.classList.remove('speak');
      void narrator.offsetWidth;
      narrator.classList.add('speak');
    }
    // ── Phase timing ── Memorize bumped to 7s (was 5s) per user feedback
    // 2026-05-25: "give them like two more seconds before you start to
    // shuffle things." Combined with the cap of 4 suspects on the server
    // side, students have plenty of time to read all three attributes
    // before cards flip face-down.
    const MEMORIZE_MS = 7000;
    const FLIP_MS     = 520;
    const SWAPS       = Math.min(6, Math.max(4, n));
    // Per-swap duration is now RANDOMIZED per swap (see idShuffleCards) so
    // the shuffle is unpredictable. This is just the baseline we pass in.
    const SWAP_MS     = 420;
    // Phase B: flip face-down
    idShuffleHandle = setTimeout(() => {
      idSetPhaseText('🌀 ¡Mezclando!');
      cardEls.forEach((card) => card.classList.add('flipped'));
      if (MochiSounds.swing) MochiSounds.swing();
      // Phase C: shuffle
      idShuffleHandle = setTimeout(() => {
        idShuffleCards(cardEls, SWAPS, SWAP_MS, () => {
          // Phase D: enable picking
          idSetPhaseText('👉 ¡Toca al sospechoso!');
          cardEls.forEach((card) => {
            card.disabled = false;
            card.onclick = () => {
              if (!idCurrentRound) return;
              const realIdx = +card.dataset.suspectIdx;
              try { socket.emit('player:id-pick', { pin, suspectIdx: realIdx }); } catch (_) {}
              cardEls.forEach((c) => { c.disabled = true; });
              // Flip the picked card face-up so player sees their choice
              card.classList.remove('flipped');
              card.classList.add('chosen');
              if (MochiSounds.tap) MochiSounds.tap();
            };
          });
        });
      }, FLIP_MS);
    }, MEMORIZE_MS);
  }
  // === MAGIC-CARD SHUFFLE with RANDOMIZED ANIMATION FEEL ============
  // Each swap step picks a fresh random shuffle "flavor" so the player
  // never knows what's coming next:
  //   • pair-swap (classic)              — two cards trade places
  //   • triple-rotate (every 3rd swap)   — three cards rotate slots
  //   • arc-style                        — cards take a curved path
  //                                          (via a momentary rotation/scale)
  // Easing curves + per-swap durations are also randomized within bounds.
  let idShuffleHandle = null;
  function idShuffleCards(cardEls, swaps, baseSwapMs, done) {
    if (!cardEls.length) { done && done(); return; }
    const wrap = cardEls[0].parentNode;
    const colsMatch = wrap.style.gridTemplateColumns.match(/repeat\((\d+)/);
    const cols = colsMatch ? parseInt(colsMatch[1], 10) : 2;
    const rect = wrap.getBoundingClientRect();
    const rows = Math.ceil(cardEls.length / cols);
    const cellW = rect.width / cols;
    const cellH = rect.height / rows;
    // slots[i] = the visual slot occupied by card i (natural slot is i).
    const slots = cardEls.map((_, i) => i);
    // Random extras per step — stored on the card so we can clear them.
    const easings = [
      'cubic-bezier(0.4, 1.2, 0.5, 1)',     // overshoot
      'cubic-bezier(0.34, 1.56, 0.64, 1)',  // big overshoot
      'cubic-bezier(0.65, 0.05, 0.36, 1)',  // smooth
      'cubic-bezier(0.86, 0, 0.07, 1)',     // snappy
      'cubic-bezier(0.25, 0.8, 0.25, 1)',   // ease-out-quart
    ];
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function applyPositions(extras) {
      cardEls.forEach((card, idx) => {
        const cur = slots[idx];
        const naturalRow = Math.floor(idx / cols);
        const naturalCol = idx % cols;
        const curRow = Math.floor(cur / cols);
        const curCol = cur % cols;
        const dx = (curCol - naturalCol) * cellW;
        const dy = (curRow - naturalRow) * cellH;
        const extra = (extras && extras[idx]) || '';
        card.style.transform = `translate3d(${dx}px, ${dy}px, 0) ${extra}`;
      });
    }
    let step = 0;
    function nextSwap() {
      if (step >= swaps) {
        // Clear any leftover rotation/scale extras so the final state is clean
        applyPositions(null);
        // And settle one frame later so the easing finishes before pick phase
        idShuffleHandle = setTimeout(() => done && done(), 320);
        return;
      }
      // Randomize per-step duration + easing — fresh animation feel each swap
      const swapMs = baseSwapMs + Math.floor((Math.random() - 0.5) * 220);
      const easing = pick(easings);
      cardEls.forEach((card) => {
        card.style.transition = `transform ${Math.max(220, swapMs)}ms ${easing}`;
      });
      // 25% chance of a triple-rotation (three cards rotate slots) for
      // extra unpredictability. Otherwise a normal pair-swap.
      const doTriple = cardEls.length >= 3 && Math.random() < 0.25;
      const extras = {};
      if (doTriple) {
        // Pick 3 distinct cards a → b → c → a
        const indices = [];
        while (indices.length < 3) {
          const pickedI = Math.floor(Math.random() * cardEls.length);
          if (!indices.includes(pickedI)) indices.push(pickedI);
        }
        const [a, b, c] = indices;
        const tmp = slots[a]; slots[a] = slots[b]; slots[b] = slots[c]; slots[c] = tmp;
      } else {
        const a = Math.floor(Math.random() * cardEls.length);
        let b = Math.floor(Math.random() * cardEls.length);
        while (b === a) b = Math.floor(Math.random() * cardEls.length);
        const tmp = slots[a]; slots[a] = slots[b]; slots[b] = tmp;
      }
      // Random per-step flair: occasionally rotate or scale a few cards
      // mid-swap to make the motion feel like a real card trick. We add
      // these extras for THIS step only; next step we either keep or
      // reset them. Visual signature changes constantly.
      const flairKind = Math.random();
      if (flairKind < 0.3) {
        // Light rotation on all cards — gives the whole shuffle a "spin"
        const rot = (Math.random() - 0.5) * 14; // ±7deg
        cardEls.forEach((_, idx) => { extras[idx] = `rotate(${rot}deg)`; });
      } else if (flairKind < 0.55) {
        // Subtle scale pulse on a random subset
        cardEls.forEach((_, idx) => {
          const s = 0.92 + Math.random() * 0.16;
          extras[idx] = `scale(${s})`;
        });
      } else if (flairKind < 0.75) {
        // Mixed counter-rotation: even cards rotate one way, odd the other
        cardEls.forEach((_, idx) => {
          const dir = idx % 2 === 0 ? 1 : -1;
          extras[idx] = `rotate(${dir * 8}deg)`;
        });
      }
      // (else 25%: no extra flair, pure pair-swap)
      applyPositions(extras);
      if (MochiSounds.tap) MochiSounds.tap();
      step++;
      // Inter-swap delay also varies so the cadence isn't metronomic
      const interStep = swapMs + 60 + Math.floor(Math.random() * 140);
      idShuffleHandle = setTimeout(nextSwap, interStep);
    }
    // Small initial pause before first swap — kid sees all cards face-down
    // for a beat first.
    idShuffleHandle = setTimeout(nextSwap, 220);
  }
  // Helper to set the phase-of-round indicator under the narrator bubble.
  function idSetPhaseText(text) {
    const phaseEl = document.getElementById('id-phase-banner');
    if (phaseEl) {
      phaseEl.textContent = text;
      phaseEl.classList.remove('show');
      void phaseEl.offsetWidth;
      phaseEl.classList.add('show');
    }
  }
  function idHighlightStruggleWords(pinyin) {
    // Bold the four struggle words in the clue for visual reinforcement
    return pinyin
      .replace(/\b(jiào)\b/g, '<strong class="id-hw">$1</strong>')
      .replace(/(\d+)\s+(suì)\b/g, '<strong class="id-hw">$1 $2</strong>')
      .replace(/\b(péngyou|jiā|gēge|dìdi|jiějie|mèimei|érzi|nǚʼér|bàba|māma)\b/g, '<strong class="id-hw-rel">$1</strong>');
  }
  function startIdTimer(deadline) {
    if (idTimerInt) clearInterval(idTimerInt);
    const total = deadline - Date.now();
    idTimerInt = setInterval(() => {
      const remaining = Math.max(0, deadline - Date.now());
      if ($('id-timer')) $('id-timer').textContent = Math.ceil(remaining / 1000) + 's';
      if ($('id-clue-bar-fill')) $('id-clue-bar-fill').style.width = (remaining / total * 100) + '%';
      if (remaining <= 0) {
        clearInterval(idTimerInt);
        idTimerInt = null;
      }
    }, 100);
  }
  function showIdFeedback(data) {
    const fb = $('id-feedback');
    if (!fb) return;
    if (data.correct) {
      fb.className = 'id-feedback success';
      fb.innerHTML = `<div class="id-fb-emoji">🎯</div><div class="id-fb-title">¡Correcto!</div><div class="id-fb-pts">+${data.points} pts</div>`;
    } else if (data.timeout) {
      fb.className = 'id-feedback fail';
      fb.innerHTML = `<div class="id-fb-emoji">⏰</div><div class="id-fb-title">¡Tiempo agotado!</div><div class="id-fb-pts">Era ${data.target.name}</div>`;
    } else {
      fb.className = 'id-feedback fail';
      fb.innerHTML = `<div class="id-fb-emoji">🤔</div><div class="id-fb-title">No era ése</div><div class="id-fb-pts">Era ${data.target.name}, ${data.target.age} suì, ${data.target.rel.pinyin}</div>`;
    }
    fb.classList.remove('hidden');
    requestAnimationFrame(() => fb.classList.add('show'));
    setTimeout(() => { fb.classList.remove('show'); }, 1400);
    setTimeout(() => { fb.classList.add('hidden'); }, 1700);
  }

  // ===========================================================================
  // 🧧 HÓNGBĀO RUN — per-player vocab + dice + minimap on the phone
  // ===========================================================================
  // Per-game state captured from pr:init and updated each round.
  let prState = {
    board: [],         // [{kind, idx}, ...]
    starGoal: 3,
    myTile: 0,
    myStars: 0,
    myCoins: 0,
    pickedThisRound: -1,
    questionTimerInt: null,
  };
  const PR_TILE_ICON = { star: '⭐', hongbao: '🧧', trap: '🐉', blank: '·' };
  socket.on('pr:init', (data) => {
    prState.board = data.board || [];
    prState.starGoal = data.starGoal || 3;
    // Find my own player object in the init's players map
    const me = data.players && data.players[socket.id];
    if (me) {
      prState.myTile  = me.tile  || 0;
      prState.myStars = me.stars || 0;
      prState.myCoins = me.coins || 0;
    }
    prRenderHud();
    prRenderMiniBoard();
    document.body.classList.add('gametype-partyrun');
    // Force the partyrun screen — handles late-join where the kid was
    // previously parked on a different game's screen (e.g. triage doctor).
    showScreen('pr');
  });
  socket.on('pr:question', (q) => {
    prState.pickedThisRound = -1;
    if ($('pr-hud-round')) $('pr-hud-round').textContent = `Ronda ${q.round}/${q.maxRounds}`;
    if ($('pr-q-tag-player')) $('pr-q-tag-player').textContent = `Ronda ${q.round}`;
    if ($('pr-q-text-player')) $('pr-q-text-player').textContent = q.text || '…';
    // Hide reveal area, show question + choices
    const rev = document.getElementById('pr-reveal');
    if (rev) rev.classList.add('hidden');
    prRenderChoices(q.choices || []);
    prStartQuestionTimer(q.deadline);
  });
  socket.on('pr:answer-ack', (data) => {
    prState.pickedThisRound = data.answerIdx;
    document.querySelectorAll('#pr-choices .pr-choice').forEach((btn, i) => {
      btn.classList.toggle('locked', i === data.answerIdx);
      btn.disabled = true; // locked in until reveal
    });
    if (MochiSounds.tap) MochiSounds.tap();
  });
  socket.on('pr:reveal', (data) => {
    if (prState.questionTimerInt) clearInterval(prState.questionTimerInt);
    // Find my own result entry
    const me = (data.results || []).find((r) => r.id === socket.id);
    if (!me) return;
    // Update state
    prState.myTile  = me.newTile;
    prState.myStars = me.stars;
    prState.myCoins = me.coins;
    prRenderHud();
    prRenderMiniBoard();
    // Show reveal area: dice + tile-effect chip
    const rev = $('pr-reveal');
    const dice = $('pr-dice');
    const msg = $('pr-reveal-msg');
    const tile = $('pr-tile-landed');
    if (rev) rev.classList.remove('hidden');
    // Briefly show ? then animate dice through a few faces before settling
    if (dice) {
      dice.textContent = '?';
      dice.classList.remove('pr-dice-roll');
      void dice.offsetWidth;
      dice.classList.add('pr-dice-roll');
      let ticks = 0;
      const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
      const tickInt = setInterval(() => {
        dice.textContent = faces[Math.floor(Math.random() * faces.length)];
        ticks++;
        if (ticks >= 7) {
          clearInterval(tickInt);
          dice.textContent = faces[me.roll - 1] || me.roll;
        }
      }, 90);
    }
    if (msg) {
      const verdict = me.correct
        ? '<span class="pr-rev-ok">✓ Correcto</span>'
        : (me.hadAnswer ? '<span class="pr-rev-no">✕ Incorrecto</span>' : '<span class="pr-rev-no">⏰ No respondiste</span>');
      msg.innerHTML = `${verdict} · <strong>+${me.roll}</strong> casillas`;
    }
    if (tile && me.effect) {
      tile.innerHTML = `
        <span class="pr-eff-icon kind-${me.effect.kind}">${me.effect.icon}</span>
        <span class="pr-eff-label">${me.effect.es}</span>`;
      tile.className = 'pr-tile-landed kind-' + me.effect.kind;
    }
    // Per-effect sound
    if (me.effect) {
      if (me.effect.kind === 'star')         MochiSounds.winFanfare && MochiSounds.winFanfare();
      else if (me.effect.kind === 'hongbao') MochiSounds.combo && MochiSounds.combo();
      else if (me.effect.kind === 'trap')    MochiSounds.wrong && MochiSounds.wrong();
      else                                    MochiSounds.tap && MochiSounds.tap();
    }
  });
  socket.on('pr:game-over', () => {
    if (prState.questionTimerInt) clearInterval(prState.questionTimerInt);
    // Host page handles the win screen; phone just shows a calm "ya termina"
    const rev = $('pr-reveal');
    if (rev) {
      rev.classList.remove('hidden');
      const msg = $('pr-reveal-msg');
      if (msg) msg.innerHTML = '🏁 ¡Carrera terminada! Mira el tablero del maestro.';
    }
  });
  function prStartQuestionTimer(deadline) {
    if (prState.questionTimerInt) clearInterval(prState.questionTimerInt);
    const total = deadline - Date.now();
    prState.questionTimerInt = setInterval(() => {
      const remaining = Math.max(0, deadline - Date.now());
      if ($('pr-q-bar-fill-player')) {
        $('pr-q-bar-fill-player').style.width = (remaining / total * 100) + '%';
      }
      if (remaining <= 0) clearInterval(prState.questionTimerInt);
    }, 100);
  }
  function prRenderHud() {
    if ($('pr-stars')) $('pr-stars').textContent = prState.myStars;
    if ($('pr-coins')) $('pr-coins').textContent = prState.myCoins;
  }
  function prRenderChoices(choices) {
    const wrap = $('pr-choices');
    if (!wrap) return;
    wrap.innerHTML = '';
    choices.forEach((c, i) => {
      const btn = document.createElement('button');
      btn.className = 'pr-choice';
      btn.type = 'button';
      btn.textContent = c;
      btn.onclick = () => {
        if (prState.pickedThisRound >= 0) return;
        try { socket.emit('player:pr-answer', { pin, answerIdx: i }); } catch (_) {}
      };
      wrap.appendChild(btn);
    });
  }
  // Mini-board: 4 rows × 5 cols snake layout. Same shape as the host's,
  // sized to fit on the phone above the question card. Your dragon marker
  // sits on whichever tile you're on; surrounding tiles glow softly so
  // you can see "what's nearby".
  function prMiniRowCol(idx) {
    const cols = 5;
    const row = Math.floor(idx / cols);
    const isReverseRow = row % 2 === 1;
    const col = isReverseRow ? (cols - 1 - (idx % cols)) : (idx % cols);
    return { row, col };
  }
  function prRenderMiniBoard() {
    const wrap = $('pr-mini-board');
    if (!wrap) return;
    if (!prState.board.length) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = '';
    wrap.style.gridTemplateColumns = `repeat(5, 1fr)`;
    wrap.style.gridTemplateRows    = `repeat(4, 1fr)`;
    prState.board.forEach((t, i) => {
      const { row, col } = prMiniRowCol(i);
      const cell = document.createElement('div');
      cell.className = 'pr-mini-tile kind-' + t.kind;
      cell.style.gridRow = (row + 1);
      cell.style.gridColumn = (col + 1);
      if (i === prState.myTile) cell.classList.add('me');
      cell.innerHTML = `<span class="pr-mini-icon">${PR_TILE_ICON[t.kind] || '·'}</span>`;
      if (i === prState.myTile) {
        const dragon = document.createElement('span');
        dragon.className = 'pr-mini-me';
        dragon.textContent = (team === 'red' ? '🐉' : '🦁');
        cell.appendChild(dragon);
      }
      wrap.appendChild(cell);
    });
  }

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
  // Mirror of the host's ANIMATIONS array — keep in sync.
  const RD_ANIMATIONS_PLAYER = {
    gojo:   '/assets/png-library/GOJO%20TRANSPARENT.gif',
    yugi:   '/assets/png-library/YUGI%20TRANSPARENT.gif',
    freddy: '/assets/png-library/FREDDY%20TRANSPARENT.gif',
    mario:  '/assets/png-library/MARIO%20TRANSPARENT.gif',
    sonic:  '/assets/png-library/SONIC%20TRANSPARENT.gif',
    elsa:   '/assets/png-library/ELSA%20TRANSPARENT.gif',
    turtle: '/assets/png-library/Squirtle%20animation.gif',
  };
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
  const WU_ANIM_URL_PLAYER = {
    gojo:   '/assets/png-library/GOJO%20TRANSPARENT.gif',
    yugi:   '/assets/png-library/YUGI%20TRANSPARENT.gif',
    freddy: '/assets/png-library/FREDDY%20TRANSPARENT.gif',
    mario:  '/assets/png-library/MARIO%20TRANSPARENT.gif',
    sonic:  '/assets/png-library/SONIC%20TRANSPARENT.gif',
    elsa:   '/assets/png-library/ELSA%20TRANSPARENT.gif',
    turtle: '/assets/png-library/Squirtle%20animation.gif',
  };
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
  const WU_CHARS_PL = {
    gojo:   { color: '#5ab0ff', glow: '#a98bff', label: '無量空処 ∞' },
    yuji:   { color: '#ff5a5a', glow: '#ff2d2d', label: '黒閃 BLACK FLASH' },
    fnaf:   { color: '#ff3b3b', glow: '#7a0000', label: "IT'S ME" },
    shelly: { color: '#ffd23b', glow: '#ff9f1c', label: '¡SUPER!' },
    dandy:  { color: '#5be8d1', glow: '#7bdf7b', label: '¡HOLA!' },
  };
  function playerFireFx(kind) {
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
        <div class="wu-fx-char-cry">${c.label}</div>`;
      const img = el.querySelector('.wu-fx-char-img');
      _wuTransparentChar(kind, (url) => { img.src = url; });
      layer.appendChild(el);
      if (MochiSounds && MochiSounds.combo) MochiSounds.combo();
      setTimeout(() => el.remove(), 3200);
      return;
    }
    return _playerFireFxStd(kind);
  }
  // Edge-flood chroma-key: removes a solid background matte from the
  // character PNGs at load time (downscaled + cached), so they're truly
  // transparent regardless of any baked-in background. Falls back to the
  // raw PNG on any failure.
  const _wuCharCache = {};
  function _wuTransparentChar(kind, cb) {
    const raw = '/assets/png-library/' + kind + '.png';
    // Gojo's white hair sits on a light background — flood-key eats his hair.
    // He looks better untouched, so skip chroma-key for him.
    if (kind === 'gojo') { cb(raw); return; }
    if (_wuCharCache[kind]) { cb(_wuCharCache[kind]); return; }
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, 680 / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
        const id = ctx.getImageData(0, 0, w, h); const px = id.data;
        const at = (x, y) => (y * w + x) * 4;
        // Sample border-average as background color.
        let br = 0, bg = 0, bb = 0, n = 0;
        for (let x = 0; x < w; x += Math.max(1, (w / 60) | 0)) { [0, h - 1].forEach((y) => { const o = at(x, y); if (px[o + 3] > 10) { br += px[o]; bg += px[o + 1]; bb += px[o + 2]; n++; } }); }
        if (!n) { _wuCharCache[kind] = raw; cb(raw); return; }
        br /= n; bg /= n; bb /= n;
        const T = 46 * 46 * 3;
        const close = (o) => { const dr = px[o] - br, dg = px[o + 1] - bg, db = px[o + 2] - bb; return (dr * dr + dg * dg + db * db) <= T; };
        // Flood from every border pixel.
        const stack = []; const seen = new Uint8Array(w * h);
        for (let x = 0; x < w; x++) { stack.push(x, 0, x, h - 1); }
        for (let y = 0; y < h; y++) { stack.push(0, y, w - 1, y); }
        while (stack.length) {
          const y = stack.pop(), x = stack.pop(); const i = y * w + x;
          if (x < 0 || y < 0 || x >= w || y >= h || seen[i]) continue;
          const o = i * 4;
          if (px[o + 3] === 0 || close(o)) { seen[i] = 1; px[o + 3] = 0; stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1); }
        }
        ctx.putImageData(id, 0, 0);
        const url = cv.toDataURL('image/png');
        _wuCharCache[kind] = url; cb(url);
      } catch (e) { _wuCharCache[kind] = raw; cb(raw); }
    };
    img.onerror = () => { _wuCharCache[kind] = raw; cb(raw); };
    img.src = raw;
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
      el.innerHTML = '<img src="/assets/png-library/67-transparent.png" alt="6-7" onerror="this.replaceWith(document.createTextNode(\'6️⃣7️⃣\'))">';
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
  // borrows from the Mi Familia engagement pattern — big icon, big
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

  // ===========================================================================
  // LÁI-QÙ-HUÍ · Dragon Courier — player phone is the whole game
  // ===========================================================================
  let lqhState = {
    gridW: 10, gridH: 8,
    locations: [],
    pickups: {},         // pickupId -> {x, y, icon, ...}
    myPos: { x: 1, y: 6 },
    lastPos: { x: 1, y: 6 },
    mission: null,
    score: 0,
    missionsDone: 0,
    missionsFailed: 0,
    streak: 0,
    bestStreak: 0,
    missionTimerInt: null,
    boundDpad: false,
    footstepTrail: [],
    lastMoveAt: 0,        // for tile-by-tile cadence
    lastDir: null,        // 'shang' | 'xia' | 'qian' | 'hou' — used for hop animation
  };
  // Tap-to-step cooldown. Each tile press locks the d-pad for this many ms
  // so the dragon moves "start by start" (the user's words) instead of
  // blurring across tiles when you mash buttons.
  const LQH_STEP_COOLDOWN_MS = 220;
  // Verb → asset/emoji helper for the mission verb tag + dragon sprite.
  // We have qu.png / lai.png / hui.png in /assets — swap the dragon sprite
  // to match the current mission verb so each delivery feels distinct.
  const LQH_VERB_META = {
    qu:  { tag: 'qù 去',  cls: 'verb-qu',  icon: '🐲', asset: '/assets/png-library/qu.png'  },
    lai: { tag: 'lái 来', cls: 'verb-lai', icon: '🐉', asset: '/assets/png-library/lai.png' },
    hui: { tag: 'huí 回', cls: 'verb-hui', icon: '🏠', asset: '/assets/png-library/hui.png' },
  };
  // Drop a fading footstep trail behind the courier so movement reads as
  // progress, not random tapping. Each step leaves a small dot on the
  // tile the courier just left; dots fade after a short window.
  function lqhDropFootstep(x, y) {
    const tile = document.getElementById(`lqh-tile-${x}-${y}`);
    if (!tile) return;
    const dot = document.createElement('div');
    dot.className = 'lqh-footstep ' + (team || 'red');
    tile.appendChild(dot);
    setTimeout(() => dot.remove(), 1400);
  }

  function lqhRenderMap() {
    const map = document.getElementById('lqh-map');
    if (!map) return;
    // Initialise tiles once
    if (map.children.length === 0) {
      map.style.gridTemplateColumns = `repeat(${lqhState.gridW}, 1fr)`;
      map.style.gridTemplateRows    = `repeat(${lqhState.gridH}, 1fr)`;
      for (let y = 0; y < lqhState.gridH; y++) {
        for (let x = 0; x < lqhState.gridW; x++) {
          const tile = document.createElement('div');
          tile.className = 'lqh-tile';
          tile.id = `lqh-tile-${x}-${y}`;
          const loc = lqhState.locations.find((l) => l.x === x && l.y === y);
          if (loc) {
            tile.classList.add('location', 'loc-' + loc.id);
            tile.innerHTML = `
              <span class="lqh-loc-icon">${loc.icon}</span>
              <span class="lqh-loc-pinyin">${loc.pinyin}</span>`;
          }
          map.appendChild(tile);
        }
      }
    }
    // Clear any prior dragon / destination markers / pickups
    map.querySelectorAll('.lqh-me, .lqh-target-ring, .lqh-pickup').forEach((el) => el.remove());
    map.querySelectorAll('.lqh-tile.target').forEach((el) => el.classList.remove('target'));
    // Render every active pickup on its tile
    Object.values(lqhState.pickups || {}).forEach((pk) => {
      const tile = document.getElementById(`lqh-tile-${pk.x}-${pk.y}`);
      if (!tile) return;
      const el = document.createElement('div');
      el.className = 'lqh-pickup';
      el.textContent = pk.icon || '⭐';
      el.dataset.pickupId = pk.id;
      tile.appendChild(el);
    });
    // Mark destination
    if (lqhState.mission) {
      const dest = lqhState.locations.find((l) => l.id === lqhState.mission.destId);
      if (dest) {
        const destTile = document.getElementById(`lqh-tile-${dest.x}-${dest.y}`);
        if (destTile) {
          destTile.classList.add('target');
          const ring = document.createElement('div');
          ring.className = 'lqh-target-ring';
          ring.textContent = '🎯';
          destTile.appendChild(ring);
        }
      }
    }
    // Place the player's character on its current tile. We swap the sprite
    // per mission verb: qu.png / lai.png / hui.png — gives each delivery a
    // distinct visual identity ("you're being lái right now"). The asset
    // path is read off LQH_VERB_META; if a PNG is missing we fall back to
    // the platform dragon, then to an emoji.
    const me = document.getElementById(`lqh-tile-${lqhState.myPos.x}-${lqhState.myPos.y}`);
    if (me) {
      const dragon = document.createElement('div');
      dragon.className = 'lqh-me ' + (team || 'red');
      // Direction-aware hop animation — applies a small slide-in from the
      // direction the player just came from. Makes the move read as
      // "stepped from there to here" rather than teleport.
      if (lqhState.lastDir) dragon.classList.add('hop-' + lqhState.lastDir);
      const verb = (lqhState.mission && lqhState.mission.verb) || 'qu';
      const meta = LQH_VERB_META[verb] || LQH_VERB_META.qu;
      dragon.innerHTML = `<img src="${meta.asset}"
        data-fallback="/assets/dralingo.png"
        onerror="if(this.dataset.fallback&&this.src.indexOf(this.dataset.fallback)===-1){this.src=this.dataset.fallback;}else{this.style.display='none';this.parentNode.classList.add('emoji-fallback');}"
        alt="me"><span class="lqh-me-emoji">${meta.icon}</span>`;
      me.appendChild(dragon);
    }
  }
  function lqhShowMission(mission, x, y, score, done, failed) {
    lqhState.mission = mission;
    lqhState.myPos = { x, y };
    lqhState.score = score != null ? score : lqhState.score;
    if (done != null) lqhState.missionsDone = done;
    if (failed != null) lqhState.missionsFailed = failed;
    // HUD
    document.getElementById('lqh-score').textContent = lqhState.score || 0;
    document.getElementById('lqh-done').textContent = lqhState.missionsDone || 0;
    document.getElementById('lqh-failed').textContent = lqhState.missionsFailed || 0;
    // Mission card
    const meta = LQH_VERB_META[mission.verb] || LQH_VERB_META.qu;
    const tagEl = document.getElementById('lqh-mission-verb-tag');
    tagEl.textContent = meta.tag;
    tagEl.className = 'lqh-mission-verb-tag ' + meta.cls;
    document.getElementById('lqh-mission-pinyin').innerHTML = mission.pinyin;
    document.getElementById('lqh-mission-es').textContent = mission.es;
    // Swap the verb mascot PNG so the user's qu/lai/hui artwork is visible
    // on every round. Fallback to dralingo.png then to hidden if missing.
    const mascotEl = document.getElementById('lqh-mission-mascot');
    if (mascotEl) {
      mascotEl.src = meta.asset;
      mascotEl.onerror = () => {
        if (mascotEl.dataset.fallbackTried) { mascotEl.style.display = 'none'; return; }
        mascotEl.dataset.fallbackTried = '1';
        mascotEl.src = '/assets/dralingo.png';
      };
      mascotEl.classList.remove('lqh-mascot-pop');
      void mascotEl.offsetWidth;
      mascotEl.classList.add('lqh-mascot-pop');
    }
    // Reset + drive the mission timer bar
    const fill = document.getElementById('lqh-mission-bar-fill');
    if (fill) fill.style.width = '100%';
    const timerEl = document.getElementById('lqh-mission-timer');
    if (lqhState.missionTimerInt) clearInterval(lqhState.missionTimerInt);
    const total = mission.deadline - mission.startedAt;
    lqhState.missionTimerInt = setInterval(() => {
      const remaining = Math.max(0, mission.deadline - Date.now());
      if (timerEl) timerEl.textContent = Math.ceil(remaining / 1000) + 's';
      if (fill) fill.style.width = ((remaining / total) * 100) + '%';
      if (remaining <= 0) {
        clearInterval(lqhState.missionTimerInt);
        lqhState.missionTimerInt = null;
      }
    }, 100);
    // Re-render the map
    lqhRenderMap();
    // Bind the D-pad once. Enforce a per-step COOLDOWN — taps that arrive
    // inside the cooldown window are dropped on the client (we never even
    // tell the server). This is what gives the dragon a discrete tile-by-
    // tile cadence: each press = exactly one step, with a felt rhythm.
    if (!lqhState.boundDpad) {
      document.querySelectorAll('#screen-lqh .lqh-dir-btn').forEach((btn) => {
        const onTap = (e) => {
          if (e) e.preventDefault();
          const now = Date.now();
          if (now - (lqhState.lastMoveAt || 0) < LQH_STEP_COOLDOWN_MS) {
            // Too soon — give a soft no-op press feedback instead of sending
            btn.classList.remove('press');
            void btn.offsetWidth;
            btn.classList.add('press');
            return;
          }
          lqhState.lastMoveAt = now;
          const dir = btn.dataset.dir;
          lqhState.lastDir = dir;
          btn.classList.remove('press');
          void btn.offsetWidth;
          btn.classList.add('press');
          if (MochiSounds.tap) MochiSounds.tap();
          if (navigator.vibrate) navigator.vibrate(10);
          try { socket.emit('player:lqh-move', { pin, dir }); } catch (_) {}
        };
        btn.addEventListener('pointerdown', onTap);
        btn.addEventListener('click', onTap);
      });
      lqhState.boundDpad = true;
    }
    showScreen('lqh');
  }
  function lqhShowFeedback(kind, text) {
    const fb = document.getElementById('lqh-feedback');
    if (!fb) return;
    fb.className = 'lqh-feedback ' + kind;
    fb.innerHTML = text;
    fb.classList.remove('hidden');
    void fb.offsetWidth;
    fb.classList.add('show');
    setTimeout(() => fb.classList.remove('show'), 900);
    setTimeout(() => fb.classList.add('hidden'), 1100);
  }
  socket.on('lqh:init', (data) => {
    lqhState.gridW = data.gridW;
    lqhState.gridH = data.gridH;
    lqhState.locations = data.locations || [];
    lqhState.pickups = {};
    (data.pickups || []).forEach((pk) => { lqhState.pickups[pk.id] = pk; });
    lqhState.score = 0;
    lqhState.missionsDone = 0;
    lqhState.missionsFailed = 0;
    // Reset map
    const map = document.getElementById('lqh-map');
    if (map) map.innerHTML = '';
    document.body.classList.add('gametype-laiquhui');
    // Force-route to LQH screen — fixes late-join leak where the kid was
    // parked on the previous game's screen (commonly the triage doctor).
    showScreen('lqh');
  });
  // Pickup picked up by THIS player — flash + score bump
  socket.on('lqh:pickup', (data) => {
    delete lqhState.pickups[data.pickupId];
    lqhState.score = data.score != null ? data.score : lqhState.score;
    document.getElementById('lqh-score').textContent = lqhState.score;
    // Spawn a quick "+5 ⭐" toast at the pickup tile
    const tile = document.getElementById(`lqh-tile-${data.x}-${data.y}`);
    if (tile) {
      const toast = document.createElement('div');
      toast.className = 'lqh-pickup-toast';
      toast.innerHTML = `${data.icon} +${data.pts}`;
      tile.appendChild(toast);
      setTimeout(() => toast.remove(), 1100);
    }
    if (MochiSounds.combo) MochiSounds.combo();
    if (window.Rewards) window.Rewards.show({ icon: data.icon, text: `+${data.pts} ${data.es || ''}`, duration: 1300 });
    lqhRenderMap();
  });
  // Pickup removed (collected by ANY player, so other phones also clear it)
  socket.on('lqh:pickup-removed', (data) => {
    delete lqhState.pickups[data.pickupId];
    // Pickup may have been rendered already; remove its DOM node
    document.querySelectorAll(`.lqh-pickup[data-pickup-id="${data.pickupId}"]`).forEach((el) => el.remove());
  });
  // A new pickup spawned somewhere on the map
  socket.on('lqh:pickup-spawned', (data) => {
    lqhState.pickups[data.id] = data;
    lqhRenderMap();
  });
  // Achievement banner pops
  socket.on('lqh:achievements', (data) => {
    (data.achievements || []).forEach((ach, i) => {
      setTimeout(() => lqhShowAchievement(ach), i * 600);
    });
  });
  // === WEATHER EVENTS ===
  // Server-driven, every ~22s. Show a Chinese banner with the sentence +
  // a visual overlay (raindrops / sun rays / snowflakes / wind streaks).
  // Movement is NEVER affected — this is decorative + pedagogical.
  socket.on('lqh:weather', (w) => {
    const banner = document.getElementById('lqh-weather-banner');
    const fx = document.getElementById('lqh-weather-fx');
    if (!banner || !fx) return;
    banner.innerHTML = `
      <span class="lqh-w-icon">${w.icon}</span>
      <span class="lqh-w-pinyin">${w.pinyin}</span>
      <span class="lqh-w-es">${w.es}</span>`;
    banner.className = 'lqh-weather-banner weather-' + w.kind;
    banner.classList.remove('hidden');
    requestAnimationFrame(() => banner.classList.add('show'));
    // Visual particle layer
    fx.innerHTML = '';
    fx.className = 'lqh-weather-fx active fx-' + w.kind;
    if (w.kind === 'rain' || w.kind === 'snow') {
      const count = 28;
      for (let i = 0; i < count; i++) {
        const d = document.createElement('div');
        d.className = 'lqh-w-drop ' + w.kind;
        d.textContent = w.kind === 'rain' ? '💧' : '❄️';
        d.style.left = (Math.random() * 100) + '%';
        d.style.animationDelay = (Math.random() * 2) + 's';
        d.style.animationDuration = (1.2 + Math.random() * 1.4) + 's';
        fx.appendChild(d);
      }
    } else if (w.kind === 'wind') {
      const count = 12;
      for (let i = 0; i < count; i++) {
        const d = document.createElement('div');
        d.className = 'lqh-w-streak';
        d.textContent = '〰';
        d.style.top = (Math.random() * 100) + '%';
        d.style.animationDelay = (Math.random() * 1.5) + 's';
        d.style.animationDuration = (1.4 + Math.random() * 0.8) + 's';
        fx.appendChild(d);
      }
    } else if (w.kind === 'sun') {
      // Soft golden glow tint via class only — no particles needed
    } else if (w.kind === 'cloud') {
      // Subtle darken tint via class only
    }
    // Auto-hide after duration
    setTimeout(() => {
      banner.classList.remove('show');
      fx.classList.remove('active');
      setTimeout(() => {
        banner.classList.add('hidden');
        fx.innerHTML = '';
        fx.className = 'lqh-weather-fx';
      }, 600);
    }, w.durationMs || 8000);
  });
  function lqhShowAchievement(ach) {
    const banner = document.createElement('div');
    banner.className = 'lqh-achievement';
    banner.innerHTML = `
      <div class="lqh-ach-icon">${ach.icon || '🏆'}</div>
      <div class="lqh-ach-title">${ach.title}</div>
      <div class="lqh-ach-sub">${ach.sub || ''}</div>`;
    document.body.appendChild(banner);
    requestAnimationFrame(() => banner.classList.add('show'));
    setTimeout(() => {
      banner.classList.remove('show');
      setTimeout(() => banner.remove(), 400);
    }, 2400);
    if (MochiSounds.winFanfare) MochiSounds.winFanfare();
    if (navigator.vibrate) navigator.vibrate([60, 30, 60]);
  }
  socket.on('lqh:mission', (data) => {
    lqhShowMission(data.mission, data.x, data.y, data.score, data.missionsDone, data.missionsFailed);
  });
  socket.on('lqh:move', (data) => {
    if (data.bump) {
      // Shake the corresponding D-pad button — visual wall feedback
      const btn = document.querySelector(`.lqh-dir-btn[data-dir="${data.dir}"]`);
      if (btn) {
        btn.classList.remove('bump');
        void btn.offsetWidth;
        btn.classList.add('bump');
      }
      if (MochiSounds.wrong) MochiSounds.wrong();
      if (navigator.vibrate) navigator.vibrate([60, 20, 60]);
      return;
    }
    // Drop a footstep on the tile we're LEAVING (not entering)
    lqhDropFootstep(lqhState.myPos.x, lqhState.myPos.y);
    lqhState.lastPos = { ...lqhState.myPos };
    lqhState.myPos = { x: data.x, y: data.y };
    if (MochiSounds.tap) MochiSounds.tap();
    lqhRenderMap();
  });
  socket.on('lqh:complete', (data) => {
    lqhState.score = data.score != null ? data.score : lqhState.score;
    lqhState.missionsDone = data.missionsDone != null ? data.missionsDone : lqhState.missionsDone;
    lqhState.myPos = { x: data.x, y: data.y };
    lqhState.streak = (lqhState.streak || 0) + 1;
    if (lqhState.streak > lqhState.bestStreak) lqhState.bestStreak = lqhState.streak;
    document.getElementById('lqh-score').textContent = lqhState.score;
    document.getElementById('lqh-done').textContent = lqhState.missionsDone;
    // === BIG CELEBRATION (engagement-checklist) ===
    // Confetti burst from the destination tile, sentence-stamp pop, per-verb
    // sound. Streak ladder escalates the toast tier.
    lqhBurstConfetti();
    const verb = data.verb || 'qu';
    // Verb-specific feedback emoji
    const verbEmoji = verb === 'lai' ? '🌟' : verb === 'hui' ? '🏠' : '✅';
    lqhShowFeedback('success', `
      <div class="lqh-fb-emoji">${verbEmoji}</div>
      <div class="lqh-fb-title">¡${data.sentence}!</div>
      <div class="lqh-fb-pts">+${data.points} pts</div>
      ${lqhState.streak >= 3 ? `<div class="lqh-fb-streak">🔥 Racha x${lqhState.streak}</div>` : ''}`);
    if (MochiSounds.correct) MochiSounds.correct();
    // Streak ladder rewards
    if (window.Rewards) {
      if (lqhState.streak >= 6) {
        window.Rewards.show({ tier: 'epic', icon: '🐉', text: `¡Mensajero LEGENDARIO! x${lqhState.streak} · +${data.points}`, duration: 2000 });
      } else if (lqhState.streak >= 3) {
        window.Rewards.show({ tier: 'great', icon: '🔥', text: `¡Racha x${lqhState.streak}! +${data.points}` });
      } else {
        window.Rewards.show({ icon: '🐲', text: '¡Entregado! +' + data.points });
      }
    }
    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
    // Clear the trail so each mission gets a fresh "fresh start" feel
    setTimeout(() => {
      document.querySelectorAll('.lqh-footstep').forEach((el) => el.remove());
    }, 1200);
  });
  socket.on('lqh:fail', (data) => {
    lqhState.missionsFailed = data.missionsFailed != null ? data.missionsFailed : lqhState.missionsFailed;
    // === STREAK BREAKER — failing zeroes out the streak (real consequence)
    const brokeStreak = lqhState.streak;
    lqhState.streak = 0;
    document.getElementById('lqh-failed').textContent = lqhState.missionsFailed;
    lqhShowFeedback('fail', `
      <div class="lqh-fb-emoji">💔</div>
      <div class="lqh-fb-title">¡Tiempo agotado!</div>
      <div class="lqh-fb-pts">${data.sentence}</div>
      ${brokeStreak >= 3 ? `<div class="lqh-fb-streak-broken">Racha x${brokeStreak} rota</div>` : ''}`);
    if (MochiSounds.wrong) MochiSounds.wrong();
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  });
  // Confetti burst inside the map area when a mission completes
  function lqhBurstConfetti() {
    const map = document.getElementById('lqh-map');
    if (!map) return;
    const icons = ['🎉', '⭐', '✨', '🐲', '🐉', '📜', '💌'];
    for (let i = 0; i < 14; i++) {
      const c = document.createElement('div');
      c.className = 'lqh-confetti';
      c.textContent = icons[i % icons.length];
      c.style.left = (10 + Math.random() * 80) + '%';
      c.style.top = (10 + Math.random() * 80) + '%';
      c.style.animationDelay = (i * 30) + 'ms';
      c.style.setProperty('--dx', (Math.random() * 200 - 100) + 'px');
      c.style.setProperty('--dy', (-100 - Math.random() * 150) + 'px');
      c.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
      map.appendChild(c);
      setTimeout(() => c.remove(), 1400);
    }
  }
  // === Player-side TRIAGE BG layer ===
  // Three overlapping layers on the question screen during active round:
  //   1. Floating pinyin tiles drift up the edges (cap 4 concurrent)
  //   2. Random short Chinese-mandarin sentence pop-ups appear at random
  //      positions every ~5s and fade out (3-second visibility)
  //   3. An ambulance drives across the screen every ~14s
  //   4. The walking doctor strolls left↔right with a speech bubble
  //   5. The sentence-between-question-and-answers cycles every few questions
  let triBgTimer = null;
  let triSentencePopupTimer = null;
  let triAmbulanceTimer = null;
  let triWalkingDoctorTimer = null;
  let triBannerCycleTimer = null;
  function startTriageVocabBg() {
    if (triBgTimer) clearInterval(triBgTimer);
    // Seed a few staggered tiles
    for (let i = 0; i < 2; i++) setTimeout(spawnTriBgFloater, i * 1100);
    // Throttle on low-end devices
    const lowEnd = (navigator.hardwareConcurrency || 4) < 4;
    triBgTimer = setInterval(spawnTriBgFloater, lowEnd ? 3000 : 2400);
    // Random Chinese-mandarin sentence pop-ups
    if (triSentencePopupTimer) clearInterval(triSentencePopupTimer);
    triSentencePopupTimer = setInterval(spawnTriSentencePopup, lowEnd ? 6500 : 5000);
    setTimeout(spawnTriSentencePopup, 800);
    // Ambulance drives across the screen periodically
    if (triAmbulanceTimer) clearInterval(triAmbulanceTimer);
    triAmbulanceTimer = setInterval(driveAmbulance, 14000);
    setTimeout(driveAmbulance, 3500);
    // Walking doctor starts strolling
    startWalkingDoctor();
    // Banner sentence cycles every 18s — kids see different sentences
    if (triBannerCycleTimer) clearInterval(triBannerCycleTimer);
    cycleBannerSentence();           // set initial
    triBannerCycleTimer = setInterval(cycleBannerSentence, 18000);
  }
  function stopTriageVocabBg() {
    if (triBgTimer) clearInterval(triBgTimer);
    if (triSentencePopupTimer) clearInterval(triSentencePopupTimer);
    if (triAmbulanceTimer) clearInterval(triAmbulanceTimer);
    if (triWalkingDoctorTimer) clearInterval(triWalkingDoctorTimer);
    if (triBannerCycleTimer) clearInterval(triBannerCycleTimer);
    triBgTimer = null;
    triSentencePopupTimer = null;
    triAmbulanceTimer = null;
    triWalkingDoctorTimer = null;
    triBannerCycleTimer = null;
    ['tri-q-float-bg', 'tri-q-ambulance', 'tri-q-walking-doctor'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.remove('driving', 'walking-l', 'walking-r');
        el.style.transform = '';
      }
    });
    const layer = document.getElementById('tri-q-float-bg');
    if (layer) layer.innerHTML = '';
  }
  // Drive the ambulance across the player screen — slides in from one edge,
  // crosses, exits the other. CSS handles the actual animation.
  function driveAmbulance() {
    const amb = document.getElementById('tri-q-ambulance');
    if (!amb) return;
    // Alternate direction each pass
    amb.classList.remove('driving-l2r', 'driving-r2l');
    void amb.offsetWidth;
    const ltr = Math.random() < 0.5;
    amb.classList.add(ltr ? 'driving-l2r' : 'driving-r2l');
    amb.textContent = ltr ? '🚑' : '🚑';   // siren-style icon
    // Faint siren sound when it appears
    if (MochiSounds.ambulanceSiren) MochiSounds.ambulanceSiren();
  }
  // Walking doctor — slides side-to-side across the bottom edge of the
  // question screen, mirrors when turning. Periodic speech bubble.
  function startWalkingDoctor() {
    const doc = document.getElementById('tri-q-walking-doctor');
    if (!doc) return;
    doc.classList.remove('walking-l2r', 'walking-r2l');
    void doc.offsetWidth;
    doc.classList.add('walking-l2r');
    // Bubble pop cycle
    const bubble = document.getElementById('tri-q-walking-bubble');
    if (!bubble) return;
    const lines = [
      'Wǒ shì <strong>yīshēng</strong> 🩺',
      'Vamos a la <strong>yīyuàn</strong> 🏥',
      'Nǐ qù <strong>yīyuàn</strong>?',
      'Bìngrén zài <strong>yīyuàn</strong>',
      '¡Salva al paciente!',
    ];
    let i = 0;
    function pop() {
      bubble.innerHTML = lines[i % lines.length];
      bubble.classList.remove('show');
      void bubble.offsetWidth;
      bubble.classList.add('show');
      i++;
      setTimeout(() => bubble.classList.remove('show'), 3200);
    }
    setTimeout(pop, 1200);
    if (triWalkingDoctorTimer) clearInterval(triWalkingDoctorTimer);
    triWalkingDoctorTimer = setInterval(() => {
      // Toggle walking direction every cycle
      const isL2R = doc.classList.contains('walking-l2r');
      doc.classList.remove('walking-l2r', 'walking-r2l');
      void doc.offsetWidth;
      doc.classList.add(isL2R ? 'walking-r2l' : 'walking-l2r');
      pop();
    }, 8000);
  }
  // Cycle the sentence shown in the between-question-and-answers banner.
  // Uses the same pool as the CPR sentence-levels.
  let triBannerIdx = 0;
  function cycleBannerSentence() {
    const pinEl = document.getElementById('tri-q-pinyin');
    const esEl  = document.getElementById('tri-q-es');
    if (!pinEl || !esEl) return;
    const pool = (typeof TRI_SENTENCES !== 'undefined' && TRI_SENTENCES) ? TRI_SENTENCES : null;
    if (!pool) return;
    const s = pool[triBannerIdx % pool.length];
    pinEl.innerHTML = s.pinyin;
    esEl.textContent = s.es;
    triBannerIdx++;
  }
  // Random Chinese-mandarin sentence pop-ups at random screen positions
  function spawnTriSentencePopup() {
    if (document.body.classList.contains('gametype-triage') === false) return;
    const pool = (typeof TRI_SENTENCES !== 'undefined' && TRI_SENTENCES) ? TRI_SENTENCES : null;
    if (!pool) return;
    const s = pool[Math.floor(Math.random() * pool.length)];
    // Layer container — use the float-bg layer so it pins under the question
    const layer = document.getElementById('tri-q-float-bg');
    if (!layer) return;
    // Cap concurrent pop-ups
    if (layer.querySelectorAll('.tri-q-sentence-pop').length >= 2) return;
    const pop = document.createElement('div');
    pop.className = 'tri-q-sentence-pop';
    pop.innerHTML = `<div class="pin">${s.pinyin}</div><div class="es">${s.es}</div>`;
    // Random position: avoid the center where the question card sits
    const sideLeft = Math.random() < 0.5;
    pop.style.left = sideLeft
      ? (2 + Math.random() * 18) + '%'
      : (62 + Math.random() * 24) + '%';
    pop.style.top = (20 + Math.random() * 50) + '%';
    layer.appendChild(pop);
    setTimeout(() => pop.remove(), 4200);
  }
  function spawnTriBgFloater() {
    const layer = document.getElementById('tri-q-float-bg');
    if (!layer) return;
    // Hard cap concurrent floaters
    if (layer.children.length >= 4) return;
    const v = TRI_VOCAB_POOL[Math.floor(Math.random() * TRI_VOCAB_POOL.length)];
    const el = document.createElement('div');
    el.className = 'tri-q-floater' + (v.key ? ' key' : '');
    el.innerHTML = `<span>${v.icon || ''} ${v.pinyin}</span><span class="es">${v.es}</span>`;
    // Random horizontal position avoiding the very center (where the
    // question card sits) — bias to the edges.
    const sideLeft = Math.random() < 0.5;
    el.style.left = sideLeft
      ? (3 + Math.random() * 22) + '%'
      : (75 + Math.random() * 22) + '%';
    layer.appendChild(el);
    setTimeout(() => el.remove(), 9200);
  }

  // Vocabulary pool used by the CPR tap-bonus + picker floats
  const TRI_VOCAB_POOL = [
    { pinyin: 'yīshēng',  es: 'doctor',   icon: '🩺', key: true,  bonus: 1 },
    { pinyin: 'yīyuàn',   es: 'hospital', icon: '🏥', key: true,  bonus: 2 },
    { pinyin: 'zài',      es: 'en',       icon: '📍', key: false, bonus: 1 },
    { pinyin: 'nǎ’er',    es: '¿dónde?',  icon: '❓', key: false, bonus: 1 },
    { pinyin: 'gōngzuò',  es: 'trabajar', icon: '🧑‍⚕️', key: false, bonus: 1 },
  ];
  function cprClearVocabFloats() {
    if (cprState && cprState.vocabSpawnInt) {
      clearInterval(cprState.vocabSpawnInt);
      cprState.vocabSpawnInt = null;
    }
    const layer = document.getElementById('tri-cpr-vocab-float');
    if (layer) layer.innerHTML = '';
  }
  function cprSpawnVocabTap() {
    const layer = document.getElementById('tri-cpr-vocab-float');
    if (!layer || !cprState) return;
    // Cap: only one floater on screen at a time so they don't dogpile the heart
    if (layer.querySelectorAll('.tri-cpr-vocab-tap:not(.popped)').length > 0) return;
    const v = TRI_VOCAB_POOL[Math.floor(Math.random() * TRI_VOCAB_POOL.length)];
    const tap = document.createElement('div');
    tap.className = 'tri-cpr-vocab-tap';
    tap.innerHTML = `
      <span>${v.icon} ${v.pinyin}</span>
      <span class="es">${v.es}</span>`;
    // Random horizontal position avoiding the center heart (avoid 35-65%)
    const sideLeft = Math.random() < 0.5;
    const leftPct = sideLeft ? (4 + Math.random() * 25) : (66 + Math.random() * 25);
    tap.style.left = leftPct + '%';
    tap.style.bottom = '20%';
    const onTap = (e) => {
      if (e) e.preventDefault();
      if (!cprState || tap.classList.contains('popped')) return;
      // Cap the bonus at 3 to prevent spam-farming
      if ((cprState.vocabBonus || 0) >= 3) {
        tap.classList.add('popped');
        setTimeout(() => tap.remove(), 400);
        return;
      }
      cprState.vocabBonus = (cprState.vocabBonus || 0) + 1;
      cprState.bonus = (cprState.bonus || 0) + (v.bonus || 1);
      tap.classList.add('popped');
      // Spawn a Spanish-translation toast at the tap point
      const toast = document.createElement('div');
      toast.className = 'tri-cpr-tap-toast';
      toast.textContent = '+' + (v.bonus || 1) + ' ' + v.es;
      toast.style.left = leftPct + '%';
      toast.style.bottom = '24%';
      layer.appendChild(toast);
      setTimeout(() => toast.remove(), 1100);
      if (MochiSounds.combo) MochiSounds.combo();
      if (navigator.vibrate) navigator.vibrate(12);
      setTimeout(() => tap.remove(), 400);
    };
    tap.addEventListener('pointerdown', onTap);
    tap.addEventListener('click', onTap);
    layer.appendChild(tap);
    // Auto-remove if not tapped within 5.5s
    setTimeout(() => { if (tap && tap.parentNode) tap.remove(); }, 5500);
  }
  function cprHandleCompression() {
    if (!cprState || cprState.completed) return;
    if (cprState.defibActive) return;   // defib step ignores heart taps
    if (cprState.tapsDone >= cprState.tapsNeeded) return;
    // === RHYTHM GATE ===
    // The tap only counts if the metronome dot is currently in the GREEN
    // zone (38-62%). Otherwise we shake the rhythm bar red and play a
    // "wrong" beep — no progress made. This is the timing/precision the
    // user asked for instead of pure spam.
    const pos = cprState.rhythmPos || 0;
    const inGreen  = pos >= 36 && pos <= 64;
    const inYellow = pos >= 22 && pos <= 78;
    const rhythmEl = document.getElementById('tri-cpr-rhythm');
    if (!inGreen && !inYellow) {
      // Bad tap — shake + small penalty (rhythm bar shakes red, no progress)
      if (rhythmEl) {
        rhythmEl.classList.remove('shake');
        void rhythmEl.offsetWidth;
        rhythmEl.classList.add('shake');
      }
      if (MochiSounds.wrong) MochiSounds.wrong();
      if (navigator.vibrate) navigator.vibrate([60, 30, 60]);
      return;
    }
    cprState.tapsDone++;
    // Tick UI fill
    const ticks = document.querySelectorAll('.tri-cpr-tick');
    const tick = ticks[cprState.tapsDone - 1];
    if (tick) {
      tick.classList.add('on');
      if (inGreen) tick.classList.add('perfect');
    }
    // Bonus: +1 per green tap (perfect rhythm)
    if (inGreen) cprState.bonus = (cprState.bonus || 0) + 1;
    // Heart pulse
    const heart = document.getElementById('tri-cpr-heart');
    if (heart) {
      heart.classList.remove('pulse');
      void heart.offsetWidth;
      heart.classList.add('pulse');
    }
    // Live EKG: add a sharp spike
    const live = document.getElementById('tri-cpr-ekg-live');
    if (live) {
      const baseX = 5 + (cprState.tapsDone - 1) * (190 / cprState.tapsNeeded);
      cprState.ekgPoints.push(`${baseX - 2},30`);
      cprState.ekgPoints.push(`${baseX - 1},10`);
      cprState.ekgPoints.push(`${baseX + 1},50`);
      cprState.ekgPoints.push(`${baseX + 2},30`);
      live.setAttribute('points', cprState.ekgPoints.join(' '));
    }
    // Sound + haptic
    if (MochiSounds.heartMonitorBeep) MochiSounds.heartMonitorBeep();
    if (navigator.vibrate) navigator.vibrate(18);
    // Perfect-green visual star
    if (inGreen && heart) {
      const star = document.createElement('div');
      star.className = 'tri-cpr-rhythm-star';
      star.textContent = '✨';
      heart.appendChild(star);
      setTimeout(() => star.remove(), 700);
    }
    cprState.lastTapAt = Date.now();
    if (cprState.tapsDone >= cprState.tapsNeeded) {
      // CPR rhythm complete — ALWAYS go to defib for every patient now.
      // The user wanted MORE timing emphasis, not less, so defib applies
      // universally instead of being a critical-only bonus phase.
      cprStartDefib();
    }
  }
  function cprStartDefib() {
    cprState.defibActive = true;
    document.getElementById('tri-cpr-hint').textContent = '¡Carga lista! Toca DESCARGAR en VERDE';
    const panel = document.getElementById('tri-cpr-defib');
    panel.classList.remove('hidden');
    // Scroll the panel into view in case the page overflowed on small phones —
    // belt-and-suspenders to the sticky CSS positioning. Always reachable.
    setTimeout(() => {
      try { panel.scrollIntoView({ behavior: 'smooth', block: 'end' }); } catch (_) {}
    }, 50);
    // Needle sweeps back-and-forth across the track at ~1.5Hz
    const needle = document.getElementById('tri-cpr-defib-needle');
    cprState.defibT0 = Date.now();
    cprState.defibInt = setInterval(() => {
      if (!cprState || !cprState.defibActive) return;
      const t = (Date.now() - cprState.defibT0) / 1000;
      // sweep -1..1..-1 via sin, then normalize to 0..100
      const v = (Math.sin(t * Math.PI * 2 * 1.6) + 1) * 50;
      needle.style.left = v + '%';
    }, 30);
  }
  function cprReleaseDefib() {
    if (!cprState || !cprState.defibActive) return;
    cprState.defibActive = false;
    if (cprState.defibInt) { clearInterval(cprState.defibInt); cprState.defibInt = null; }
    const needle = document.getElementById('tri-cpr-defib-needle');
    const pos = parseFloat(needle.style.left) || 0;
    // Zones: green 38-62 (perfect), yellow 22-38 / 62-78 (good), red elsewhere
    let zone, addBonus;
    if (pos >= 38 && pos <= 62)      { zone = 'green'; addBonus = 8; }
    else if (pos >= 22 && pos <= 78) { zone = 'yellow'; addBonus = 4; }
    else                             { zone = 'red'; addBonus = 0; }
    cprState.bonus = (cprState.bonus || 0) + addBonus;
    needle.dataset.zone = zone;
    document.getElementById('tri-cpr-defib-btn').disabled = true;
    if (MochiSounds.defibZap) MochiSounds.defibZap();
    if (navigator.vibrate) navigator.vibrate([20, 30, 80]);
    // === FAIL ON RED ===
    // Hitting the red zone now KILLS the patient. This is the game integrity
    // the user wanted — failing has real consequences, not just lower bonus.
    if (zone === 'red') {
      cprState.failed = true;
      document.getElementById('tri-cpr-hint').textContent = '💔 ¡DESCARGA FALLIDA! Paciente perdido';
      cprShowFailScreen('descarga-fallida');
      setTimeout(() => cprCommit('defib-failed'), 1400);
      return;
    }
    document.getElementById('tri-cpr-hint').textContent = zone === 'green'
      ? '⚡ ¡DESCARGA PERFECTA! +' + addBonus
      : '⚡ Descarga aceptable · +' + addBonus;
    setTimeout(() => cprCommit('defib-done'), 700);
  }
  // Big visible fail feedback — flatline sound + red flash + sad doctor
  function cprShowFailScreen(reason) {
    if (MochiSounds.flatlineAlarm) MochiSounds.flatlineAlarm();
    if (navigator.vibrate) navigator.vibrate([200, 50, 200, 50, 200]);
    const heart = document.getElementById('tri-cpr-heart');
    if (heart) heart.classList.add('cpr-fail-flatline');
    const stage = document.getElementById('tri-cpr-stage');
    if (stage) {
      stage.classList.add('cpr-failed');
      // Big "FALLASTE" banner
      const banner = document.createElement('div');
      banner.className = 'tri-cpr-fail-banner';
      banner.innerHTML = `
        <div class="tri-cpr-fail-emoji">💔</div>
        <div class="tri-cpr-fail-title">¡FALLASTE!</div>
        <div class="tri-cpr-fail-sub">El paciente no sobrevivió.</div>`;
      stage.appendChild(banner);
      setTimeout(() => { banner.remove(); stage.classList.remove('cpr-failed'); }, 1600);
    }
  }
  function cprCommit(reason) {
    if (!cprState || cprState.completed) return;
    cprState.completed = true;
    if (cprState.timerInt) { clearInterval(cprState.timerInt); cprState.timerInt = null; }
    if (cprState.defibInt) { clearInterval(cprState.defibInt); cprState.defibInt = null; }
    if (cprState.rhythmInt) { clearInterval(cprState.rhythmInt); cprState.rhythmInt = null; }
    if (cprState.vocabSpawnInt) { clearInterval(cprState.vocabSpawnInt); cprState.vocabSpawnInt = null; }
    // === FAILURE DETECTION ===
    // Two distinct fail paths:
    //   1. Timeout — didn't complete enough rhythm taps in the window
    //   2. Defib hit RED — bad timing on the power-meter (set in releaseDefib)
    let failed = !!cprState.failed;
    if (!failed && cprState.tapsDone < cprState.tapsNeeded) {
      failed = true;
      // Show the fail screen if we haven't already
      cprShowFailScreen('timeout');
    }
    if (failed) {
      cprState.bonus = 0;
    } else {
      // Successful rescue — flash + chime
      const heart = document.getElementById('tri-cpr-heart');
      if (heart) {
        heart.classList.add('flash');
        setTimeout(() => heart && heart.classList.remove('flash'), 500);
      }
      if (MochiSounds.lifeSaved) MochiSounds.lifeSaved();
    }
    try {
      socket.emit('player:tri-treat', {
        pin,
        patientId: cprState.patientId,
        bonus: cprState.bonus || 0,
        completed: cprState.tapsDone >= cprState.tapsNeeded && !cprState.failed,
        failed,
      });
    } catch (_) {}
    cprState = null;
  }

  // Server fires this on every late-join to a triage game so the client
  // can route the kid to the question screen. Avoids them being stuck on
  // a previous game's screen when they reconnect mid-round.
  socket.on('tri:late-join', () => {
    if (gameType !== 'triage') return;
    // The server will follow up with a `question` event which renders the
    // question. We just make sure they're on screen-question, not on
    // some stale screen from a previous game.
    const qScreen = document.getElementById('screen-question');
    if (qScreen && qScreen.classList.contains('hidden')) {
      showScreen('question');
    }
  });

  // Server confirmation that the patient was treated. Show a tier-matched
  // Rewards toast and return to the question screen — the next question is
  // already queued by the server (1.5s window).
  socket.on('tri:treat-resolved', (data) => {
    if (gameType !== 'triage') return;
    const bonus = data.cprBonus || 0;
    const bonusTxt = bonus > 0 ? ` (+${bonus} bonus)` : '';
    if (window.Rewards) {
      if (data.action === 'critical-saved') {
        window.Rewards.show({ tier: 'epic', icon: '⚡', text: `¡VIDA CRÍTICA SALVADA! +${data.points || 25}${bonusTxt}`, duration: 2000 });
      } else if (data.action === 'saved') {
        window.Rewards.show({ tier: 'great', icon: '🩺', text: `¡Paciente salvado! +${data.points || 10}${bonusTxt}` });
      } else if (data.action === 'failed') {
        // FAIL — explicit user-facing message; no points awarded
        window.Rewards.show({ tier: 'bad', icon: '💔', text: '¡FALLASTE! El paciente no sobrevivió · 0 puntos', duration: 2200 });
      } else if (data.action === 'empty-ward') {
        window.Rewards.show({ icon: '✅', text: 'Ward despejado · +1' });
      }
    }
    // Drop back to question screen so we're ready for the next prompt.
    setTimeout(() => showScreen('question'), data.action === 'failed' ? 1200 : 600);
  });

  // Server confirmation that the order was processed — show a brief tier-
  // matched Rewards toast + Spanish-themed sub.
  socket.on('cq:order-resolved', (data) => {
    if (gameType !== 'conquest') return;
    if (!window.Rewards) return;
    const action = data.action;
    if (action === 'conquered') {
      window.Rewards.show({ tier: 'epic', icon: '⚔️', text: '¡Asalto exitoso!', duration: 1800 });
    } else if (action === 'expanded') {
      window.Rewards.show({ tier: 'great', icon: '🚩', text: '¡Terreno conquistado!' });
    } else if (action === 'jumped') {
      window.Rewards.show({ tier: 'great', icon: '🐎', text: '¡Salto sorpresa!' });
    } else if (action === 'reinforce') {
      window.Rewards.show({ icon: '🛡', text: '¡Posición fortificada!' });
    }
    if (data.capturedEnemyCapital) {
      window.Rewards.show({ tier: 'epic', icon: '🏯', text: '¡TOMASTE LA CAPITAL ENEMIGA! 🎺', duration: 2400 });
    }
  });

  socket.on('answer-result', ({ correct, mashUntil, walkUntil, energy, correctText, vendorId, playerScore, itemIcon, itemChinese, dragonDot, dragonAim, dragonAimMs, points, monopoly, familyToken, conquest, sixseven, triage }) => {
    markActivity();
    clearAnswerHeartbeat();
    hideSendingOverlay();
    if (!correct) resetStreak();

    // 6-7 SWING fast-path — keep the player on the swing screen, just flash
    // feedback + update HUD + bump the sway. Server will send the next
    // question almost immediately (600-800ms).
    if (gameType === 'sixseven') {
      flashSixSevenFeedback(correct);
      if (sixseven) {
        const newScore = ssMyScore + (sixseven.gained || 0);
        updateSixSevenHud(newScore, sixseven.streak || 0);
        // Combo bell on streak milestones
        if (correct && sixseven.streak >= 3 && MochiSounds.comboBell) {
          MochiSounds.comboBell(sixseven.streak);
        }
        if (correct && sixseven.streak === 6 && window.Rewards) {
          window.Rewards.show({ tier: 'epic', icon: '⚡', text: '¡Combo x3!', duration: 1800 });
          shakeSixSevenScreen();
          // Combo x3 unlock — the FULL 67-character jumpscare takes over
          // the player's whole screen, dances, then disappears. Rare moment.
          triggerSixSevenDance();
          spawnPlayerSixSevenJumpscare();
        } else if (correct && sixseven.streak >= 3 && window.Rewards && sixseven.streak % 3 === 0) {
          window.Rewards.combo(sixseven.streak);
          if (sixseven.streak >= 9) shakeSixSevenScreen();
        }
      }
      // Re-enable buttons so the next question arrives clean
      setTimeout(() => {
        document.querySelectorAll('.ss-btn').forEach((b) => b.classList.remove('tapped'));
      }, 250);
      return;  // skip the standard result-feedback screen flow
    }
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
      } else if (gameType === 'triage' && triage && triage.needsPick) {
        // === TRIAGE ER PATIENT PICKER ===
        // Server gave us a current snapshot of urgent patients — show the
        // "which patient do you treat?" cards. The picker handles its own
        // result feedback + queues the next question via tri:treat-resolved.
        showTriagePatientPicker(triage.patients || []);
        return;   // skip the standard result feedback + next-question wait
      } else if (gameType === 'conquest' && conquest && conquest.needsOrder) {
        // === STRATEGIC MARCH-ORDER PICKER ===
        // The server says we have a soldier to deploy. Open the 3-button
        // picker INSTEAD of showing the standard result feedback. The
        // player's tap on ATTACK/ADVANCE/DEFEND will fire the actual
        // capture on the server.
        showConquestOrderPicker(conquest.availability || { attack: true, advance: true, defend: true });
        return;   // skip the standard result-feedback flow + next-question wait
      } else if (gameType === 'conquest') {
        // Battle-themed feedback — fallback if needsOrder wasn't set
        // (shouldn't normally happen, but keeps the screen clean if it does).
        const unit = conquest && conquest.unit ? conquest.unit : '🐎';
        happyMascot = unit;
        const unitName = unit === '🏹' ? 'arquero'
                       : unit === '🗡' ? 'espadachín'
                       : unit === '🛡' ? 'lancero'
                       : unit === '👑' ? 'general'
                       : 'caballero';
        if (conquest && conquest.action === 'conquered') {
          sub = `⚔️ ¡Tu ${unitName} venció al enemigo!`;
          if (window.Rewards) window.Rewards.show({
            tier: 'epic', icon: '⚔️',
            text: '¡Choque de espadas! ¡Terreno conquistado!',
            duration: 1900,
          });
        } else if (conquest && conquest.action === 'expanded') {
          sub = `🐎 ¡Tu ${unitName} avanza en el campo!`;
          if (window.Rewards) window.Rewards.show({
            tier: 'great', icon: unit, text: '¡La caballería avanza!',
          });
        } else if (conquest && conquest.action === 'jumped') {
          sub = `🏹 ¡Flecha sorpresa al frente!`;
          if (window.Rewards) window.Rewards.show({
            tier: 'great', icon: '🏹', text: '¡Salto sorpresa!',
          });
        } else {
          sub = `🛡 ¡Refuerzos en la fortaleza!`;
        }
        if (conquest && conquest.capturedEnemyCapital && window.Rewards) {
          window.Rewards.show({
            tier: 'epic', icon: '🏯',
            text: '¡LA FORTALEZA ENEMIGA HA CAÍDO! 🎺',
            duration: 2400,
          });
        }
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
        } else if (gameType === 'triage') {
          // Triage ER: the picker took over via early-return above. This
          // branch only fires for an edge case where needsPick wasn't set —
          // stay on the question screen so we never fall through to the
          // panda/kitsune mash screen.
          showScreen('question');
        } else if (gameType === 'conquest') {
          // BUG FIX: previously the conquest else-fallthrough hit startMash()
          // which displayed the panda/kitsune mochi-mash screen on conquest
          // players' devices. Now we explicitly stay on the question screen
          // (the order picker, if needed, was already shown above via the
          // early return; otherwise the next question event will arrive).
          showScreen('question');
        } else if (gameType === 'sixseven') {
          // Sixseven handles its own screen via the dedicated handler.
          showScreen('sixseven');
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
      if (gameType === 'conquest') {
        // Wrong-answer in conquest — go back to question screen, next q
        // is already queued by the server's nextDelay logic. Without this
        // explicit branch, the player got stuck on the result screen.
        setTimeout(() => showScreen('question'), 1400);
      }
      if (gameType === 'triage') {
        // Wrong-answer in triage — encourage them, no penalty, next q
        // is already queued. Mirror conquest's screen restore.
        setTimeout(() => showScreen('question'), 1400);
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
    // Wipe any items left in the player's room zones from a prior round
    ['sala', 'cocina', 'dormitorio', 'jardin'].forEach((r) => {
      const c = $('fm-roomzone-items-' + r);
      if (c) c.innerHTML = '';
    });
  });

  socket.on('fm:placed', (data) => {
    // Only count placements from MY team toward MY mini-house
    if (data.team !== team) return;
    fmMyTeamBricks++;
    updateFmMiniHouse();
    // Mirror the item INTO the corresponding room zone on the player's
    // drag board — kids see their team's house actually filling up with
    // sofás/dogs/plants as they answer questions. Drops in with 3D animation.
    const itemHost = $('fm-roomzone-items-' + data.room);
    if (itemHost && data.token && data.token.emoji) {
      const item = document.createElement('span');
      item.className = 'fm-roomzone-item';
      item.textContent = data.token.emoji;
      item.title = data.token.name || '';
      itemHost.appendChild(item);
    }
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

    // === ROBUST JUMP BINDING ===
    // Old code used `btn.onpointerdown = ...` + preventDefault which silently
    // fails on some desktop browsers (the click event gets suppressed and the
    // pointerdown handler's preventDefault chains weirdly with passive listeners).
    // Now: addEventListener for BOTH pointerdown AND click, NO preventDefault on
    // click (preventDefault only on touchstart to stop scroll), plus a global
    // Space / ArrowUp / W key fallback so desktop users have a guaranteed input.
    const btn = $('zb-jump-btn');
    const stage = $('zb-sprint-stage');
    if (btn) {
      // Bookkeeping so subsequent startZombieSprint calls don't multi-bind
      if (btn._jumpHandlersBound) {
        // Already bound — the inner handler reads zbSprintActive/zbJumping,
        // so we don't need to re-bind on each sprint start.
      } else {
        const tryJump = () => {
          if (!zbSprintActive || zbJumping) return;
          doJump();
        };
        // pointerdown is the fastest input — fires on touch start AND mouse down
        btn.addEventListener('pointerdown', (e) => {
          // Only prevent default for touch-derived events (stops scroll/zoom).
          // For mouse on desktop, preventDefault CAN block the synthetic click,
          // which then prevents focus + may cause silent failures.
          if (e && e.pointerType !== 'mouse') {
            try { e.preventDefault(); } catch (_) {}
          }
          tryJump();
        }, { passive: false });
        // click as a guaranteed fallback (some desktop browsers / a11y tools)
        btn.addEventListener('click', tryJump);
        // touchstart for very old mobile browsers that don't fire pointerevents
        btn.addEventListener('touchstart', (e) => {
          if (e && e.cancelable) try { e.preventDefault(); } catch (_) {}
          tryJump();
        }, { passive: false });
        btn._jumpHandlersBound = true;
      }
    }
    // Tap-anywhere on the stage = jump (so kids on tablet/desktop don't have
    // to aim for the button precisely). Bound once per sprint start.
    if (stage && !stage._jumpStageBound) {
      const stageTry = () => {
        if (!zbSprintActive || zbJumping) return;
        doJump();
      };
      stage.addEventListener('pointerdown', (e) => {
        if (e && e.pointerType !== 'mouse') {
          try { e.preventDefault(); } catch (_) {}
        }
        stageTry();
      }, { passive: false });
      stage.addEventListener('click', stageTry);
      stage._jumpStageBound = true;
    }
    // Keyboard fallback for desktop — Space, ArrowUp, W, or Enter all jump.
    // Bound on the window once; only fires while the sprint screen is active.
    if (!window._zbKeyBound) {
      window.addEventListener('keydown', (e) => {
        if (!zbSprintActive || zbJumping) return;
        const k = e.key;
        if (k === ' ' || k === 'Spacebar' || k === 'ArrowUp' || k === 'w' || k === 'W' || k === 'Enter') {
          e.preventDefault();
          doJump();
        }
      });
      window._zbKeyBound = true;
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

    let _lastTapMs = 0;
    function rollTapShake(e) {
      // Dedupe — pointerdown + click + touchstart can all fire for one tap
      // depending on browser/device. 80ms window catches synthetic clicks
      // but allows legitimate fast tap-mashing (≥12Hz).
      const now = Date.now();
      if (now - _lastTapMs < 80) return;
      _lastTapMs = now;
      if (e) {
        // Only preventDefault on touch/pen — on mouse it kills the synthetic
        // click which other browser features need.
        if (e.pointerType !== 'mouse' && e.cancelable) {
          try { e.preventDefault(); } catch (_) {}
        }
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

    // Bind tap to BOTH the dice and the center plate. Use addEventListener
    // (with `{ passive: false }`) for cross-browser robustness — the older
    // `el.onpointerdown = fn` pattern silently fails on some desktop browsers
    // when chained with preventDefault, AND clearing old listeners by
    // reassignment is unreliable. addEventListener gives us a clean contract.
    const center = dice && dice.closest('.mp-mini-center');
    [dice, center].filter(Boolean).forEach((el) => {
      // Detach any prior bindings from old sprint sessions
      if (el._mpTapHandler) {
        el.removeEventListener('pointerdown', el._mpTapHandler);
        el.removeEventListener('click',       el._mpTapHandler);
        el.removeEventListener('touchstart',  el._mpTapHandler);
      }
      const tap = (e) => {
        // Don't preventDefault for mouse — kills the synthetic click on desktop
        if (e && e.pointerType !== 'mouse' && e.cancelable) {
          try { e.preventDefault(); } catch (_) {}
        }
        rollTapShake(e);
      };
      el._mpTapHandler = tap;
      el.addEventListener('pointerdown', tap, { passive: false });
      el.addEventListener('click',       tap);
      el.addEventListener('touchstart',  tap, { passive: false });
      // Belt-and-suspenders: block the browser context menu / save-image popup
      el.oncontextmenu = (e) => { e.preventDefault(); return false; };
      el.ondragstart  = (e) => { e.preventDefault(); return false; };
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
    stopZombieAmbience();
    stopSixSevenAmbience();
    stopPlayerJumpscareLoop();
    stopTriageVocabBg();
    document.body.classList.remove('sixseven-active');
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
    // After Modo Maestro (warmup), send kids straight to THEIR portal instead
    // of the public login — they shouldn't have to log in again. We pass their
    // student code so /homework can pre-fill (and auto-enter if their access
    // code is remembered on this device). Other game types still go to inicio.
    if (gameType === 'warmup' && myStudentCode) {
      showReconnectOverlay('Clase terminada. Llevándote a tu portal…');
      setTimeout(() => {
        location.href = '/homework?code=' + encodeURIComponent(myStudentCode) + '&from=maestro';
      }, 2600);
      return;
    }
    // Gentler than an alert — show a friendly card so kids don't panic
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
    // === TRIAGE-LEAK GUARD (bug fix 2026-05-27, hardened) ===
    // The hospital vocab banner + floating tiles live in the shared
    // question-screen markup, gated by body.gametype-triage. That class
    // can go stale (kid played triage earlier, then late-joins a
    // restarted Mochi Mash in the same tab) and the banner bleeds in —
    // even on the lobby / countdown, BEFORE any question fires. Since
    // this runs on EVERY screen switch, we strip the triage class +
    // stop the vocab background whenever the current game is NOT triage.
    // (Triage's own screens are tri-pick / tri-cpr — it re-asserts the
    // class itself when it starts.)
    if (gameType !== 'triage') {
      if (document.body.classList.contains('gametype-triage')) {
        document.body.classList.remove('gametype-triage');
      }
      if (typeof stopTriageVocabBg === 'function') stopTriageVocabBg();
      // Also wipe any banner text the triage game may have populated, so a
      // stale-but-filled banner can't survive into a non-triage game even if
      // the body class somehow lingers. The :empty CSS rule then keeps the
      // box hidden as well.
      const _pin = document.getElementById('tri-q-pinyin');
      const _es  = document.getElementById('tri-q-es');
      if (_pin) _pin.innerHTML = '';
      if (_es)  _es.textContent = '';
    }
    ['join', 'lobby', 'countdown', 'question', 'result', 'mash', 'pinata-smash', 'dragon-flap', 'monopoly-welcome', 'monopoly-roll', 'zombie-sprint', 'family-place', 'cs-walk', 'cc-play', 'mq-play', 'fl-play', 'sixseven', 'cq-order', 'tri-pick', 'tri-cpr', 'lqh', 'wu', 'id', 'pr', 'rd', 'end'].forEach((n) => {
      const el = $('screen-' + n);
      if (el) el.classList.toggle('hidden', n !== name);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
})();
