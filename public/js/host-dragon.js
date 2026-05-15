// Vuelo del Dragón (飞龙) — host view.
// Two dragons race vertically through scenery layers. Each correct vocab
// answer earns a player 5s of flap-mode; every tap lifts their team's dragon
// higher. Scenery reveals as altitude grows (rooftops → bamboo → mountains
// → clouds → heavens). First dragon to the top wins.
(function () {
  const socket = io();
  let pin = null;
  let state = null;
  let timerInterval = null;
  let urgentTriggered = false;

  let altRed = 0;
  let altGold = 0;
  let maxAlt = 500;
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
  if (!chosenSetId) location.href = '/sets.html?game=dragon-eye';

  socket.emit('host:create', { gameType: 'dragon-eye' }, ({ pin: p }) => {
    pin = p;
    $('pin-display').textContent = p;
    if ($('active-pin-display')) $('active-pin-display').textContent = p;
    $('join-url').textContent = `${location.origin}/?pin=${p}`;
    document.title = `Vuelo del Dragón · ${p}`;
    socket.emit('host:load-set', { pin, setId: chosenSetId }, (resp) => {
      if (!resp.ok) {
        alert('No se pudo cargar el set: ' + (resp.error || 'desconocido'));
        location.href = '/sets.html?game=dragon-eye';
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
    altRed = altGold = 0;
    scores = { red: 0, gold: 0 };
    gameOver = false;
    updateAltDisplay();
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
        numEl.textContent = '飞!';
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

  socket.on('dragon:init', (data) => {
    maxAlt = data.maxAlt || 500;
    altRed = 0;
    altGold = 0;
    scores = data.teamScores || { red: 0, gold: 0 };
    gameOver = false;
    updateAltDisplay();
    setBanner('¡A volar! 飞起来！');
  });

  // Altitude updates from server (throttled to ~10Hz)
  socket.on('dragon:alt', ({ altRed: aR, altGold: aG, maxAlt: m }) => {
    if (typeof aR === 'number') altRed = aR;
    if (typeof aG === 'number') altGold = aG;
    if (typeof m === 'number') maxAlt = m;
    updateAltDisplay();
  });

  // Team-aggregated tap fx → wing flap animation + altitude lift sound
  socket.on('tap-fx', ({ red, gold }) => {
    if (red && red > 0)  spawnFlaps('red', Math.min(red, 5));
    if (gold && gold > 0) spawnFlaps('gold', Math.min(gold, 5));
  });

  socket.on('score-update', ({ teamScores }) => {
    if (teamScores) { scores = teamScores; }
  });

  socket.on('dragon:reached-heavens', ({ team, teamScores }) => {
    gameOver = true;
    if (teamScores) scores = teamScores;
    const emoji = team === 'red' ? '🐉' : '🐲';
    setBanner(`✨ ¡${emoji} El dragón ${team === 'red' ? 'Rojo' : 'Dorado'} llegó al cielo celestial! ✨`);
    const dragon = $('flying-dragon-' + team);
    if (dragon) dragon.classList.add('ascended');
    MochiSounds.winFanfare && MochiSounds.winFanfare();
    burstStars(team);
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
      $('win-banner').textContent = '🐉 ¡Dragón Rojo voló más alto!';
      $('win-banner').className = 'winner-banner red';
      $('win-emoji').textContent = '🐉';
      MochiSounds.winMusic && MochiSounds.winMusic();
      setTimeout(() => MochiSounds.winFanfare && MochiSounds.winFanfare(), 400);
      if (narr) narr.innerHTML = `🐉 <span class="red-team">El Dragón Rojo</span> llegó a las nubes celestiales con <strong>${r}</strong> aleteos — ${gap > 100 ? 'una hazaña épica 🔥' : gap > 40 ? 'una victoria sólida 💪' : 'un vuelo reñido ⚔️'}.`;
      launchConfetti(['#ff5a66', '#d92e3a', '#ffd57a']);
    } else if (data.winner === 'gold') {
      $('win-banner').textContent = '🐲 ¡Dragón Dorado voló más alto!';
      $('win-banner').className = 'winner-banner gold';
      $('win-emoji').textContent = '🐲';
      MochiSounds.winMusic && MochiSounds.winMusic();
      setTimeout(() => MochiSounds.winFanfare && MochiSounds.winFanfare(), 400);
      if (narr) narr.innerHTML = `🐲 <span class="gold-team">El Dragón Dorado</span> llegó a las nubes celestiales con <strong>${g}</strong> aleteos — ${gap > 100 ? 'una hazaña épica 🔥' : gap > 40 ? 'una victoria sólida 💪' : 'un vuelo reñido ⚔️'}.`;
      launchConfetti(['#ffd57a', '#e8b14a', '#ff5a66']);
    } else {
      $('win-banner').textContent = '🤝 ¡Empate en el cielo!';
      $('win-banner').className = 'winner-banner tie';
      $('win-emoji').textContent = '⚖️';
      MochiSounds.tieMusic && MochiSounds.tieMusic();
      if (narr) narr.innerHTML = `🤝 Ambos dragones volaron igual: <strong>${r}</strong> aleteos.`;
    }
    renderLeaderboard(data);
    setTimeout(() => launchConfetti(data.winner === 'red'
      ? ['#ff5a66', '#d92e3a', '#ffd57a']
      : ['#ffd57a', '#e8b14a', '#ff5a66']), 4000);
  });

  // === Visuals ===

  function updateAltDisplay() {
    const pctR = Math.min(100, Math.round((altRed  / maxAlt) * 100));
    const pctG = Math.min(100, Math.round((altGold / maxAlt) * 100));
    if ($('alt-red'))  $('alt-red').textContent  = altRed;
    if ($('alt-gold')) $('alt-gold').textContent = altGold;
    if ($('alt-fill-red'))  $('alt-fill-red').style.height  = pctR + '%';
    if ($('alt-fill-gold')) $('alt-fill-gold').style.height = pctG + '%';
    // Position the flying dragon: bottom = 4% (rooftops start) → 92% (heavens)
    const dragonR = $('flying-dragon-red');
    const dragonG = $('flying-dragon-gold');
    if (dragonR) dragonR.style.bottom = (4 + pctR * 0.88) + '%';
    if (dragonG) dragonG.style.bottom = (4 + pctG * 0.88) + '%';
    // Toggle scenery visibility based on altitude (each layer unlocks at a band)
    setSceneryReveal('red',  pctR);
    setSceneryReveal('gold', pctG);
  }

  function setSceneryReveal(team, pct) {
    const col = $('flight-col-' + team);
    if (!col) return;
    // Each scenery layer reveals at a specific altitude %:
    //   rooftops: always (0%+)
    //   bamboo: 15%+
    //   mountains: 30%+
    //   clouds: 50%+
    //   temple: 70%+
    //   heavens: 90%+
    const thresholds = {
      rooftops: 0,
      bamboo: 15,
      mountains: 30,
      clouds: 50,
      temple: 70,
      heavens: 90
    };
    Object.entries(thresholds).forEach(([cls, threshold]) => {
      const layers = col.querySelectorAll('.dr-scenery.' + cls);
      layers.forEach((l) => {
        if (pct >= threshold) l.classList.add('revealed');
        else l.classList.remove('revealed');
      });
    });
  }

  function setBanner(text) {
    const b = $('dr-banner');
    if (!b) return;
    b.textContent = text;
    b.classList.remove('flash');
    void b.offsetWidth;
    b.classList.add('flash');
  }

  // Spawn N wing-flap animations on the team's column. Each is a small puff
  // of cloud + a quick scale-bounce on the dragon emoji.
  function spawnFlaps(team, count) {
    if (gameOver) return;
    MochiSounds.thwack && MochiSounds.thwack();
    const fxLayer = $('flap-fx-' + team);
    const dragon = $('flying-dragon-' + team);
    if (!fxLayer || !dragon) return;
    for (let i = 0; i < count; i++) {
      const puff = document.createElement('div');
      puff.className = 'dr-flap-puff';
      puff.textContent = '💨';
      // Spawn at the dragon's current position
      const dRect = dragon.getBoundingClientRect();
      const lRect = fxLayer.getBoundingClientRect();
      puff.style.left = ((dRect.left + dRect.width / 2) - lRect.left) + 'px';
      puff.style.top  = ((dRect.top  + dRect.height / 2) - lRect.top)  + 'px';
      puff.style.animationDelay = (i * 50) + 'ms';
      fxLayer.appendChild(puff);
      setTimeout(() => puff.remove(), 700 + i * 50);
    }
    // Bounce the dragon emoji to indicate flap
    dragon.classList.remove('flap');
    void dragon.offsetWidth;
    dragon.classList.add('flap');
  }

  function burstStars(team) {
    const fxLayer = $('flap-fx-' + team);
    const dragon = $('flying-dragon-' + team);
    if (!fxLayer || !dragon) return;
    for (let i = 0; i < 24; i++) {
      const s = document.createElement('div');
      s.className = 'dr-burst-star';
      s.textContent = ['✨','⭐','🌟','🌠','☀️'][i % 5];
      const dRect = dragon.getBoundingClientRect();
      const lRect = fxLayer.getBoundingClientRect();
      s.style.left = ((dRect.left + dRect.width / 2) - lRect.left) + 'px';
      s.style.top  = ((dRect.top  + dRect.height / 2) - lRect.top)  + 'px';
      const ang = (Math.PI * 2 * i) / 24 + Math.random() * 0.4;
      const dist = 160 + Math.random() * 120;
      s.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      s.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
      fxLayer.appendChild(s);
      setTimeout(() => s.remove(), 1800);
    }
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
        <span class="lb-name">${teamEmoji} ${escapeHtml(p.name)}</span>
        <span class="lb-score">${p.score} aleteos</span>
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
      c.textContent = ['🐉', '🐲', '☁️', '✨', '🏯'][i % 5];
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

  socket.on('disconnect', () => console.log('[host-dragon] disconnected'));
  socket.on('connect', () => console.log('[host-dragon] connected'));
  socket.on('host-left', () => console.warn('[host-dragon] host-left'));
})();
