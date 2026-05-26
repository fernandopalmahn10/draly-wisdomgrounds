// 6-7 SWING (six-seven, the viral meme) — host view.
// Single math game where every answer is either 6 or 7. Players tap one of
// two giant buttons on their phone. The big blocky 6-7 character on the host
// screen sways toward whichever team just scored, and floating 6s + 7s drift
// across the background like the meme's pixelated overlay.
(function () {
  const socket = io();
  let pin = null;
  let state = null;
  let timerInterval = null;
  let urgentTriggered = false;

  let scores = { red: 0, gold: 0 };
  let gameOver = false;
  // Per-player roster state — accumulated from state events + ss:tap events
  // so the side rosters always show every member regardless of join order.
  let rosterPlayers = {};   // id → { name, team, avatar, taps }
  let floatTimer = null;
  // Visual sway state: -1 = full left (team 6), +1 = full right (team 7), 0 = center.
  // Each tap nudges the sway smoothly via CSS variable.
  let swayLerp = 0;       // current displayed value
  let swayTarget = 0;     // target value (animated toward each frame)
  let swayRaf = null;

  const $ = (id) => document.getElementById(id);

  $('mute-btn').addEventListener('click', () => {
    const muted = window.toggleMute();
    $('mute-btn').textContent = muted ? '🔇 Off' : '🔊 On';
  });
  document.addEventListener('click', () => window.unlockAudio && window.unlockAudio(), { once: true });

  // === 67 JUMPSCARE LOADER === The user's PNG character art is no longer
  // the central icon — it now appears RARELY as a full-screen dance moment.
  // Detect which file is available on the server, then spawn a big dramatic
  // overlay every ~30s and on combo x3+ moments. Background-removed PNG
  // (67-transparent.png) takes priority over the original so the dancing
  // character isn't trapped in a rectangle.
  let ssJumpscareUrl = null;
  function detectSixSevenAsset() {
    const candidates = [
      '/assets/png-library/67-transparent.png',  // bg-removed version — preferred
      '/assets/png-library/67.png',
      '/assets/67.jpg',
      '/assets/sixseven-character.png',
      '/assets/sixseven-character.jpg',
      '/assets/sixseven.png',
      '/assets/six-seven.png',
    ];
    let idx = 0;
    function tryNext() {
      if (idx >= candidates.length) {
        console.warn('[6-7] No jumpscare image in /assets/. Tried: ' + candidates.join(', '));
        return;
      }
      const url = candidates[idx++];
      const img = new Image();
      img.onload = () => {
        ssJumpscareUrl = url;
        console.log('[6-7] Jumpscare image ready: ' + url);
      };
      img.onerror = () => tryNext();
      img.src = url;
    }
    tryNext();
  }
  detectSixSevenAsset();

  // Spawn the full-screen 67 dance jumpscare. Lives ~2.2s, then auto-removes.
  // Never stacks — if a previous one is still on screen, we skip.
  function spawnSixSevenJumpscare() {
    if (!ssJumpscareUrl) return;
    if (document.querySelector('.ss-jumpscare')) return;
    const wrap = document.createElement('div');
    wrap.className = 'ss-jumpscare';
    const img = document.createElement('img');
    img.src = ssJumpscareUrl;
    img.alt = '67';
    img.draggable = false;
    wrap.appendChild(img);
    document.body.appendChild(wrap);
    MochiSounds.sixSevenChant && MochiSounds.sixSevenChant();
    setTimeout(() => MochiSounds.swingWhoosh && MochiSounds.swingWhoosh(), 80);
    setTimeout(() => wrap.remove(), 2300);
  }
  // Periodic surprise: 25-45s between jumpscares — rare enough to feel
  // special, frequent enough to keep energy high.
  let ssHostJumpscareTimer = null;
  function startHostJumpscareLoop() {
    if (ssHostJumpscareTimer) clearTimeout(ssHostJumpscareTimer);
    const tick = () => {
      ssHostJumpscareTimer = setTimeout(() => {
        if (!gameOver) spawnSixSevenJumpscare();
        tick();
      }, 25000 + Math.random() * 20000);
    };
    tick();
  }

  socket.emit('host:create', { gameType: 'sixseven' }, ({ pin: p }) => {
    pin = p;
    $('pin-display').textContent = p;
    if ($('active-pin-display')) $('active-pin-display').textContent = p;
    $('join-url').textContent = `${location.origin}/?pin=${p}`;
    document.title = `6-7 Swing · ${p}`;
    // Sixseven needs no set load — server seeds questions automatically.
    MochiSounds.correct && MochiSounds.correct();
    updateStartBtn();
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
    MochiSounds.swap && MochiSounds.swap();
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
    if (floatTimer) { clearInterval(floatTimer); floatTimer = null; }
    if (swayRaf) cancelAnimationFrame(swayRaf);
    swayLerp = swayTarget = 0;
    applySway(0);
    updateScores();
  });

  function updateStartBtn() {
    const btn = $('start-btn');
    if (!state) return;
    // sixseven doesn't need a set, but DOES need players to start.
    btn.disabled = !(Object.keys(state.players || {}).length > 0);
  }

  socket.on('state', (s) => {
    state = s;
    // Always update the roster map so it reflects late joiners + team swaps
    if (s.players) {
      Object.entries(s.players).forEach(([id, p]) => {
        const prev = rosterPlayers[id] || { taps: 0, score: 0 };
        rosterPlayers[id] = {
          name: p.name, team: p.team, avatar: p.avatar || '🐱',
          taps: prev.taps, score: (typeof p.score === 'number') ? p.score : prev.score,
        };
      });
      // Remove players that left
      Object.keys(rosterPlayers).forEach((id) => {
        if (!s.players[id]) delete rosterPlayers[id];
      });
      renderSideRosters();
    }
    if (s.state === 'lobby') {
      renderLobbyPlayers(s.players);
      updateStartBtn();
    }
    if (s.state === 'active' && s.endsAt && !timerInterval) startTimer();
  });

  socket.on('countdown', () => {
    showScreen('countdown');
    MochiSounds.startMusic && MochiSounds.startMusic();
    MochiSounds.startGameTheme && MochiSounds.startGameTheme('sixseven');
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
        numEl.textContent = '🤙 67!';
        numEl.style.animation = 'none';
        numEl.offsetHeight;
        numEl.style.animation = '';
        MochiSounds.sixSevenChant && MochiSounds.sixSevenChant();
        setTimeout(() => {
          showScreen('active');
          startTimer();
          startFloatLoop();
          startSwayLoop();
          startHostAmbientDance();
          startHostJumpscareLoop();
          setBanner('🤙 ¡SIX SEVEN! 🤙');
        }, 1000);
      }
    };
    tick();
  });

  // === Tap event from a player — animate the character + swing toward team ===
  socket.on('ss:tap', ({ playerId, playerName, playerScore, team, choice, gained, streak, teamScores }) => {
    if (teamScores) { scores = teamScores; updateScores(); }
    // Update per-player score in roster
    if (playerId && rosterPlayers[playerId]) {
      if (typeof playerScore === 'number') rosterPlayers[playerId].score = playerScore;
      rosterPlayers[playerId].taps = (rosterPlayers[playerId].taps || 0) + 1;
      rosterPlayers[playerId].team = team;     // in case they swapped teams
      renderSideRosters();
    }
    if (gained > 0) {
      // Push the sway toward the matching team's side
      // Team 6 = LEFT  (sway target -1)
      // Team 7 = RIGHT (sway target +1)
      const dir = choice === '7' ? 1 : -1;
      swayTarget = Math.max(-1, Math.min(1, swayTarget * 0.4 + dir * 0.6));
      spawnTapBurst(team, choice, gained, streak);
      // Audio
      if (choice === '7') MochiSounds.tap7 && MochiSounds.tap7();
      else MochiSounds.tap6 && MochiSounds.tap6();
      // Combo bell on streaks ≥3
      if (streak >= 3 && MochiSounds.comboBell) {
        setTimeout(() => MochiSounds.comboBell(streak), 120);
      }
      // Banner moments
      if (streak === 3)  setBanner('🔥 ¡COMBO x2!');
      if (streak === 6)  setBanner('💥 ¡COMBO x3!');
      if (streak === 10) setBanner('⚡ ¡RACHA LEGENDARIA!');
      // Host fanfare on x3+ combos — dance + flash + shake. On x3 combo
      // (streak=6) the 67 character jumpscare also fires for max impact.
      if (streak >= 6) {
        triggerHostDance();
        shakeHostScreen();
        spawnSixSevenJumpscare();
      } else if (streak === 3) {
        shakeHostScreen();
      }
    }
  });

  // === Host engagement: same dance / shake as the player but on the big screen ===
  function triggerHostDance() {
    // Dance BOTH the PNG image and the CSS fallback (whichever is visible)
    [$('ss-character'), $('ss-character-img')].forEach((ch) => {
      if (!ch) return;
      ch.classList.remove('dancing');
      void ch.offsetWidth;
      ch.classList.add('dancing');
      setTimeout(() => ch.classList.remove('dancing'), 2500);
    });
    const flash = document.createElement('div');
    flash.className = 'ss-dance-flash';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 1900);
    const center = document.createElement('div');
    center.className = 'ss-dance-centerpiece';
    center.textContent = '67!';
    document.body.appendChild(center);
    setTimeout(() => center.remove(), 1900);
    MochiSounds.sixSevenChant && MochiSounds.sixSevenChant();
  }
  function shakeHostScreen() {
    document.body.classList.remove('ss-shake');
    void document.body.offsetWidth;
    document.body.classList.add('ss-shake');
    setTimeout(() => document.body.classList.remove('ss-shake'), 550);
  }
  // Also run periodic ambient dance bursts on the host every 12-20s so the
  // arena always feels alive even if no one is comboing.
  let hostDanceTimer = null;
  function startHostAmbientDance() {
    if (hostDanceTimer) clearTimeout(hostDanceTimer);
    const tick = () => {
      hostDanceTimer = setTimeout(() => {
        if (!gameOver) {
          if (Math.random() < 0.55) triggerHostDance();
        }
        tick();
      }, 12000 + Math.random() * 8000);
    };
    tick();
  }

  socket.on('game-end', (data) => {
    if (timerInterval) clearInterval(timerInterval);
    if (floatTimer) { clearInterval(floatTimer); floatTimer = null; }
    if (hostDanceTimer) { clearTimeout(hostDanceTimer); hostDanceTimer = null; }
    if (ssHostJumpscareTimer) { clearTimeout(ssHostJumpscareTimer); ssHostJumpscareTimer = null; }
    gameOver = true;
    MochiSounds.stopMusic && MochiSounds.stopMusic();
    showScreen('win');
    const r = data.teamScores.red  || 0;
    const g = data.teamScores.gold || 0;
    $('final-red').textContent  = r;
    $('final-gold').textContent = g;
    const narr = $('win-narration');
    if (data.winner === 'red') {
      $('win-banner').textContent = '🟦 ¡EQUIPO 6 GANA!';
      $('win-banner').className = 'winner-banner red';
      $('win-emoji').textContent = '6';
      MochiSounds.winMusic && MochiSounds.winMusic();
      setTimeout(() => MochiSounds.winFanfare && MochiSounds.winFanfare(), 400);
      if (narr) narr.innerHTML = `🟦 El <span class="red-team">Equipo 6</span> dominó con <strong>${r} puntos</strong>.`;
      launchConfetti(['#3eb3d4', '#2eb3d4', '#a8e0f0']);
    } else if (data.winner === 'gold') {
      $('win-banner').textContent = '🟪 ¡EQUIPO 7 GANA!';
      $('win-banner').className = 'winner-banner gold';
      $('win-emoji').textContent = '7';
      MochiSounds.winMusic && MochiSounds.winMusic();
      setTimeout(() => MochiSounds.winFanfare && MochiSounds.winFanfare(), 400);
      if (narr) narr.innerHTML = `🟪 El <span class="gold-team">Equipo 7</span> dominó con <strong>${g} puntos</strong>.`;
      launchConfetti(['#7a4eb0', '#4a3a7e', '#cec0e8']);
    } else {
      $('win-banner').textContent = '🤝 ¡EMPATE 6 = 7!';
      $('win-banner').className = 'winner-banner tie';
      $('win-emoji').textContent = '🤙';
      MochiSounds.tieMusic && MochiSounds.tieMusic();
      if (narr) narr.innerHTML = `🤝 Empate en <strong>${r} puntos</strong>.`;
    }
    renderLeaderboard(data);
  });

  // === Sway loop — smoothly interpolate the character toward swayTarget ===
  function startSwayLoop() {
    if (swayRaf) cancelAnimationFrame(swayRaf);
    function frame() {
      // Spring toward target, then drift back to center over time
      const k = 0.10;       // ease-toward-target rate
      const decay = 0.985;  // target-decay rate (pulls back to 0)
      swayLerp += (swayTarget - swayLerp) * k;
      swayTarget *= decay;
      applySway(swayLerp);
      swayRaf = requestAnimationFrame(frame);
    }
    frame();
  }
  function applySway(v) {
    const wrap = $('ss-character-wrap');
    if (!wrap) return;
    // v in [-1, 1] → rotate up to 18°, translate ~15% of viewport width
    wrap.style.setProperty('--sway', v.toFixed(3));
  }

  // === Floating 6s and 7s ambient layer ===
  function startFloatLoop() {
    if (floatTimer) clearInterval(floatTimer);
    floatTimer = setInterval(() => {
      if (gameOver) return;
      // 1-2 emojis per tick
      const n = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) spawnFloater();
    }, 700);
  }
  function spawnFloater() {
    const layer = $('ss-float-layer');
    if (!layer) return;
    const f = document.createElement('div');
    f.className = 'ss-floater ' + (Math.random() < 0.5 ? 'six' : 'seven');
    f.textContent = Math.random() < 0.5 ? '6' : '7';
    f.style.left = (Math.random() * 100) + '%';
    f.style.fontSize = (1.5 + Math.random() * 4) + 'rem';
    f.style.animationDuration = (5 + Math.random() * 5) + 's';
    layer.appendChild(f);
    setTimeout(() => f.remove(), 11000);
  }

  // === Tap burst — fly +N from the relevant side when a player scores ===
  function spawnTapBurst(team, choice, gained, streak) {
    const layer = $('ss-tap-burst-layer');
    if (!layer) return;
    const burst = document.createElement('div');
    burst.className = 'ss-tap-burst ' + (choice === '7' ? 'right' : 'left');
    if (streak >= 3) burst.classList.add('combo');
    burst.innerHTML = `<span class="ss-burst-num">${choice}</span><span class="ss-burst-points">+${gained}</span>`;
    burst.style.left = (choice === '7' ? (60 + Math.random() * 30) : (10 + Math.random() * 30)) + '%';
    burst.style.top  = (35 + Math.random() * 35) + '%';
    layer.appendChild(burst);
    setTimeout(() => burst.remove(), 1400);
  }

  function setBanner(text) {
    const b = $('ss-banner');
    if (!b) return;
    b.textContent = text;
    b.classList.remove('flash');
    void b.offsetWidth;
    b.classList.add('flash');
  }

  function updateScores() {
    if ($('score-red'))  $('score-red').textContent  = scores.red  || 0;
    if ($('score-gold')) $('score-gold').textContent = scores.gold || 0;
  }

  // === SIDE ROSTERS === Left = Team 6 (red), Right = Team 7 (gold).
  // Shows every player's avatar + name + score, scaled with team size.
  function renderSideRosters() {
    const redList  = $('ss-roster-list-red');
    const goldList = $('ss-roster-list-gold');
    if (!redList || !goldList) return;
    const red = [], gold = [];
    Object.entries(rosterPlayers).forEach(([id, p]) => {
      (p.team === 'red' ? red : gold).push({ id, ...p });
    });
    red.sort((a, b) => (b.score || 0) - (a.score || 0));
    gold.sort((a, b) => (b.score || 0) - (a.score || 0));
    [['ss-roster-red', red.length], ['ss-roster-gold', gold.length]].forEach(([id, n]) => {
      const el = $(id);
      if (!el) return;
      el.classList.remove('density-compact', 'density-micro');
      if (n >= 12) el.classList.add('density-micro');
      else if (n >= 7) el.classList.add('density-compact');
    });
    const rowHtml = (p) => `
      <div class="ss-roster-row">
        <span class="ss-roster-avatar">${p.avatar || '🐱'}</span>
        <span class="ss-roster-name">${escapeHtml(p.name || '')}</span>
        <span class="ss-roster-score">${p.score || 0}</span>
      </div>`;
    redList.innerHTML  = red.map(rowHtml).join('');
    goldList.innerHTML = gold.map(rowHtml).join('');
  }

  function startTimer() {
    if (!state || !state.endsAt) { setTimeout(startTimer, 200); return; }
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
      const teamNum = p.team === 'red' ? '6' : '7';
      row.innerHTML = `
        <span class="lb-rank">${medal}</span>
        <span class="lb-name">${p.avatar ? p.avatar + ' ' : ''}🤙 ${escapeHtml(p.name)}</span>
        <span class="lb-score">${p.score} pts</span>
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
      chip.innerHTML = `${p.avatar ? `<span class="chip-avatar">${p.avatar}</span>` : ''}<span>${escapeHtml(p.name)}</span><span class="swap-arrow">↔</span>`;
      chip.addEventListener('click', () => {
        socket.emit('host:swap-team', { pin, playerId: id });
        MochiSounds.swap && MochiSounds.swap();
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
      c.textContent = i % 2 ? '6' : '7';
      c.style.color = colors[i % colors.length];
      c.style.fontSize = (1 + Math.random() * 1.4) + 'rem';
      c.style.background = 'transparent';
      c.style.fontFamily = "'Press Start 2P', monospace";
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

  socket.on('disconnect', () => console.log('[host-sixseven] disconnected'));
  socket.on('connect', () => console.log('[host-sixseven] connected'));
  socket.on('host-left', () => console.warn('[host-sixseven] host-left'));
})();
