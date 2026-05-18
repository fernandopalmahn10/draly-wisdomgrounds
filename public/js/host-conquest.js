// Reinos en Guerra · 战国 — host view.
// Renders a 6x4 territory grid of ancient China. Each correct answer from a
// player captures one tile for their team (server picks the smartest target,
// adjacency-aware). The host animates the conquest with a horse-warrior
// charge from the team's existing land + a flag planting.
(function () {
  const socket = io();
  let pin = null;
  let state = null;
  let timerInterval = null;
  let urgentTriggered = false;

  let territories = [];
  let ownership = {};
  let scores = { red: 0, gold: 0 };
  let gameOver = false;
  let warriorTimer = null;

  const $ = (id) => document.getElementById(id);

  $('mute-btn').addEventListener('click', () => {
    const muted = window.toggleMute();
    $('mute-btn').textContent = muted ? '🔇 Off' : '🔊 On';
  });
  document.addEventListener('click', () => window.unlockAudio && window.unlockAudio(), { once: true });

  const params = new URLSearchParams(location.search);
  const chosenSetId = params.get('setId');
  if (!chosenSetId) location.href = '/sets.html?game=conquest';

  socket.emit('host:create', { gameType: 'conquest' }, ({ pin: p }) => {
    pin = p;
    $('pin-display').textContent = p;
    if ($('active-pin-display')) $('active-pin-display').textContent = p;
    $('join-url').textContent = `${location.origin}/?pin=${p}`;
    document.title = `战国 · ${p}`;
    socket.emit('host:load-set', { pin, setId: chosenSetId }, (resp) => {
      if (!resp.ok) {
        alert('No se pudo cargar el set: ' + (resp.error || 'desconocido'));
        location.href = '/sets.html?game=conquest';
        return;
      }
      $('set-title-display').textContent = resp.title;
      $('set-count-display').textContent = `${resp.count} preguntas`;
      MochiSounds.correct && MochiSounds.correct();
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
    MochiSounds.swap && MochiSounds.swap();
  });
  $('start-btn').addEventListener('click', () => socket.emit('host:start', { pin }));
  $('end-now-btn').addEventListener('click', () => {
    if (confirm('¿Terminar la guerra ahora?')) socket.emit('host:end-now', { pin });
  });
  $('play-again-btn').addEventListener('click', () => {
    if (MochiSounds.stopEndMusic) MochiSounds.stopEndMusic();
    socket.emit('host:reset', { pin });
    showScreen('lobby');
    territories = [];
    ownership = {};
    scores = { red: 0, gold: 0 };
    gameOver = false;
    if (warriorTimer) { clearInterval(warriorTimer); warriorTimer = null; }
    updateScores();
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
    // Belt-and-suspenders timer recovery (avoids the frozen-timer bug we hit
    // in other modes when state was filtered to lobby-only)
    if (s.state === 'active' && s.endsAt && !timerInterval) startTimer();
  });

  socket.on('countdown', () => {
    showScreen('countdown');
    MochiSounds.startMusic && MochiSounds.startMusic();
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
        numEl.textContent = '¡冲!';
        numEl.style.animation = 'none';
        numEl.offsetHeight;
        numEl.style.animation = '';
        MochiSounds.go && MochiSounds.go();
        setTimeout(() => {
          showScreen('active');
          startTimer();
        }, 800);
      }
    };
    tick();
  });

  // === Map init ===
  socket.on('cq:init', (data) => {
    territories = data.territories || [];
    ownership = data.ownership || {};
    scores = data.teamScores || { red: 0, gold: 0 };
    gameOver = false;
    renderMap();
    updateScores();
    setBanner('¡战国 La guerra empieza!');
    startAmbientWarriors();
  });

  // === Capture event from server — animate the conquest ===
  socket.on('cq:capture', (cap) => {
    if (cap.teamScores) { scores = cap.teamScores; updateScores(); }
    if (cap.action === 'reinforce') {
      // Visual: pulse our capital, no ownership change
      const cap2 = territories.find((t) => t.capitalOf === cap.toTeam);
      const el = cap2 && $('cq-tile-' + cap2.id);
      if (el) flashTile(el, cap.toTeam, true);
      return;
    }
    ownership[cap.tileId] = cap.toTeam;
    const tile = territories[cap.tileId];
    const tileEl = $('cq-tile-' + cap.tileId);
    if (!tileEl) return;
    // Flag planting + flash + horse charge from a same-team neighbor
    spawnHorseCharge(tileEl, cap.toTeam);
    tileEl.classList.remove('owned-red', 'owned-gold', 'conquering');
    void tileEl.offsetWidth;
    tileEl.classList.add('owned-' + cap.toTeam, 'conquering');
    setTimeout(() => tileEl && tileEl.classList.remove('conquering'), 1400);
    // Replace the flag indicator
    const flag = tileEl.querySelector('.cq-flag');
    if (flag) {
      flag.textContent = cap.toTeam === 'red' ? '🚩' : '🏳';
      flag.classList.remove('plant');
      void flag.offsetWidth;
      flag.classList.add('plant');
    }
    // Banner — different message per action
    const teamEmoji = cap.toTeam === 'red' ? '🐉' : '🐲';
    if (cap.action === 'conquered') {
      setBanner(`${teamEmoji} ¡${cap.toTeam === 'red' ? 'Rojo' : 'Dorado'} conquistó ${tile.name} ${tile.pinyin}!`);
      MochiSounds.wrong && MochiSounds.wrong();   // a sharp clash for stealing
      MochiSounds.cashRegister && setTimeout(() => MochiSounds.cashRegister(), 200);
    } else if (cap.action === 'expanded') {
      setBanner(`${teamEmoji} ${cap.toTeam === 'red' ? 'Rojo' : 'Dorado'} tomó ${tile.name} (${tile.es})`);
      MochiSounds.coinClink && MochiSounds.coinClink();
    } else if (cap.action === 'jumped') {
      setBanner(`${teamEmoji} ¡Salto a ${tile.name}!`);
      MochiSounds.whoosh && MochiSounds.whoosh();
    }
  });

  socket.on('cq:capital-fallen', ({ team }) => {
    const emoji = team === 'red' ? '🐉' : '🐲';
    setBanner(`🏯 ¡${emoji} ${team === 'red' ? 'ROJOS' : 'DORADOS'} TOMARON LA CAPITAL ENEMIGA! 🎺`);
    MochiSounds.winFanfare && MochiSounds.winFanfare();
    burstStars(team);
  });

  // === End of game ===
  socket.on('game-end', (data) => {
    if (timerInterval) clearInterval(timerInterval);
    if (warriorTimer) { clearInterval(warriorTimer); warriorTimer = null; }
    gameOver = true;
    MochiSounds.stopMusic && MochiSounds.stopMusic();
    showScreen('win');
    $('final-red').textContent = data.teamScores.red || 0;
    $('final-gold').textContent = data.teamScores.gold || 0;
    const r = data.teamScores.red || 0;
    const g = data.teamScores.gold || 0;
    const narr = $('win-narration');
    if (data.winner === 'red') {
      $('win-banner').textContent = '🐉 ¡La Caballería Roja conquistó China!';
      $('win-banner').className = 'winner-banner red';
      $('win-emoji').textContent = '🏯';
      MochiSounds.winMusic && MochiSounds.winMusic();
      setTimeout(() => MochiSounds.winFanfare && MochiSounds.winFanfare(), 400);
      if (narr) narr.innerHTML = `🐉 La <span class="red-team">Caballería Roja</span> domina <strong>${r}</strong> territorios.`;
      launchConfetti(['#ff5a66', '#d92e3a', '#ffd57a']);
    } else if (data.winner === 'gold') {
      $('win-banner').textContent = '🐲 ¡La Caballería Dorada conquistó China!';
      $('win-banner').className = 'winner-banner gold';
      $('win-emoji').textContent = '🏯';
      MochiSounds.winMusic && MochiSounds.winMusic();
      setTimeout(() => MochiSounds.winFanfare && MochiSounds.winFanfare(), 400);
      if (narr) narr.innerHTML = `🐲 La <span class="gold-team">Caballería Dorada</span> domina <strong>${g}</strong> territorios.`;
      launchConfetti(['#ffd57a', '#e8b14a', '#ff5a66']);
    } else {
      $('win-banner').textContent = '⚔️ ¡Empate de generales!';
      $('win-banner').className = 'winner-banner tie';
      $('win-emoji').textContent = '⚖️';
      MochiSounds.tieMusic && MochiSounds.tieMusic();
      if (narr) narr.innerHTML = `⚔️ Ambos ejércitos dominaron <strong>${r}</strong> territorios.`;
    }
    renderLeaderboard(data);
  });

  // === Map rendering ===
  function renderMap() {
    const map = $('cq-map');
    if (!map) return;
    map.innerHTML = '';
    map.style.gridTemplateColumns = `repeat(6, 1fr)`;
    map.style.gridTemplateRows = `repeat(4, 1fr)`;
    territories.forEach((t) => {
      const el = document.createElement('div');
      el.className = 'cq-tile';
      el.id = 'cq-tile-' + t.id;
      el.dataset.tileId = t.id;
      const owner = ownership[t.id];
      if (owner) el.classList.add('owned-' + owner);
      if (t.isCapital) el.classList.add('capital');
      el.innerHTML = `
        <div class="cq-tile-icon">${t.icon}</div>
        <div class="cq-tile-cn">${t.name}</div>
        <div class="cq-tile-pinyin">${t.pinyin}</div>
        <div class="cq-tile-es">${t.es}</div>
        <div class="cq-flag">${owner === 'red' ? '🚩' : owner === 'gold' ? '🏳' : ''}</div>
        ${t.isCapital ? '<div class="cq-capital-star">★</div>' : ''}
      `;
      el.style.gridColumn = (t.x + 1);
      el.style.gridRow = (t.y + 1);
      map.appendChild(el);
    });
  }

  // === Capture animations ===
  function spawnHorseCharge(tileEl, team) {
    // A horse emoji charges in from off-screen, then plants the flag.
    const map = $('cq-map');
    if (!map || !tileEl) return;
    const r = tileEl.getBoundingClientRect();
    const mr = map.getBoundingClientRect();
    const cx = r.left + r.width / 2 - mr.left;
    const cy = r.top  + r.height / 2 - mr.top;
    const horse = document.createElement('div');
    horse.className = 'cq-horse ' + team;
    horse.textContent = '🐎';
    horse.style.left = cx + 'px';
    horse.style.top  = cy + 'px';
    map.appendChild(horse);
    setTimeout(() => horse.remove(), 1200);
  }

  function flashTile(el, team, reinforce) {
    if (!el) return;
    el.classList.remove('flash-' + team);
    void el.offsetWidth;
    el.classList.add('flash-' + team);
    if (reinforce) {
      el.classList.add('reinforced');
      setTimeout(() => el.classList.remove('reinforced'), 800);
    }
    setTimeout(() => el.classList.remove('flash-' + team), 900);
  }

  function setBanner(text) {
    const b = $('cq-banner');
    if (!b) return;
    b.textContent = text;
    b.classList.remove('flash');
    void b.offsetWidth;
    b.classList.add('flash');
  }

  function updateScores() {
    if ($('land-red'))  $('land-red').textContent  = scores.red  || 0;
    if ($('land-gold')) $('land-gold').textContent = scores.gold || 0;
  }

  function burstStars(team) {
    const map = $('cq-map');
    if (!map) return;
    for (let i = 0; i < 24; i++) {
      const s = document.createElement('div');
      s.className = 'cq-spark';
      s.textContent = ['🎺', '🚩', '⚔️', '🏯', '✨'][i % 5];
      s.style.left = (Math.random() * 100) + '%';
      s.style.top  = (Math.random() * 100) + '%';
      s.style.animationDelay = (i * 50) + 'ms';
      map.appendChild(s);
      setTimeout(() => s.remove(), 1800);
    }
  }

  // Ambient gallop — every ~10-18s a riderless horse runs across the map
  // bottom edge to keep the scene alive.
  function startAmbientWarriors() {
    if (warriorTimer) clearInterval(warriorTimer);
    warriorTimer = setInterval(() => {
      if (gameOver) return;
      if (Math.random() < 0.6) spawnAmbientWarrior();
    }, 10000);
  }
  function spawnAmbientWarrior() {
    const layer = $('cq-warriors');
    if (!layer) return;
    const w = document.createElement('div');
    w.className = 'cq-warrior';
    w.textContent = ['🐎', '🏇', '🐉', '🏯', '⚔️'][Math.floor(Math.random() * 5)];
    w.style.top = (10 + Math.random() * 60) + '%';
    layer.appendChild(w);
    setTimeout(() => w.remove(), 6500);
  }

  // === Timer ===
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
      const teamEmoji = p.team === 'red' ? '🐉' : '🐲';
      row.innerHTML = `
        <span class="lb-rank">${medal}</span>
        <span class="lb-name">${p.avatar ? p.avatar + ' ' : ''}${teamEmoji} ${escapeHtml(p.name)}</span>
        <span class="lb-score">${p.score} 🏯</span>
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
      c.textContent = ['🏯', '🐉', '🚩', '⚔️', '🐎'][i % 5];
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

  socket.on('disconnect', () => console.log('[host-conquest] disconnected'));
  socket.on('connect', () => console.log('[host-conquest] connected'));
  socket.on('host-left', () => console.warn('[host-conquest] host-left'));
})();
