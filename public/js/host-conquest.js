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
  let unitsByTile = {};   // tileId → soldier emoji (🐎 / 🏹 / 🗡 / 🛡 / 👑)
  let scores = { red: 0, gold: 0 };
  let gameOver = false;
  let warriorTimer = null;
  let drumTimer = null;

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
    unitsByTile = {};
    scores = { red: 0, gold: 0 };
    gameOver = false;
    if (warriorTimer) { clearInterval(warriorTimer); warriorTimer = null; }
    if (drumTimer)    { clearInterval(drumTimer);    drumTimer    = null; }
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
    unitsByTile = data.units || {};
    scores = data.teamScores || { red: 0, gold: 0 };
    gameOver = false;
    renderMap();
    updateScores();
    setBanner('⚔️ ¡La batalla empieza!');
    MochiSounds.warDrum && MochiSounds.warDrum();
    startAmbientWarriors();
    startAmbientDrums();
  });

  // === Capture event — soldier MARCHES from a friendly neighbor onto the tile
  // (visible animation, not instant snap). On enemy ground a sword-clash
  // sprite + attack pose plays before the new soldier settles in. ===
  socket.on('cq:capture', (cap) => {
    if (cap.teamScores) { scores = cap.teamScores; updateScores(); }
    if (cap.action === 'reinforce') {
      const cap2 = territories.find((t) => t.capitalOf === cap.toTeam);
      const el = cap2 && $('cq-tile-' + cap2.id);
      if (el) flashTile(el, cap.toTeam, true);
      return;
    }
    const prevOwner = ownership[cap.tileId];
    ownership[cap.tileId] = cap.toTeam;
    if (cap.unit) unitsByTile[cap.tileId] = cap.unit;
    const tile = territories[cap.tileId];
    const tileEl = $('cq-tile-' + cap.tileId);
    if (!tileEl) return;

    // Visual ownership update
    tileEl.classList.remove('owned-red', 'owned-gold', 'conquering');
    void tileEl.offsetWidth;
    tileEl.classList.add('owned-' + cap.toTeam, 'conquering');
    setTimeout(() => tileEl && tileEl.classList.remove('conquering'), 1400);

    // If conquering an enemy: dislodge the old formation with a fall animation
    const oldFormation = document.getElementById('cq-soldier-' + cap.tileId);
    if (oldFormation && prevOwner && prevOwner !== cap.toTeam) {
      // Swap each unit in the falling formation to its fall pose
      const fallSrc = prevOwner === 'red'
        ? '/assets/conquest/soldier-fall.png'
        : '/assets/conquest/cavalry-fall.png';
      oldFormation.querySelectorAll('img').forEach((img) => { img.src = fallSrc; });
      oldFormation.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      oldFormation.style.opacity = '0';
      oldFormation.style.transform = 'translate3d(-50%, -120%, 0) rotate(-15deg)';
      setTimeout(() => oldFormation.remove(), 550);
    } else if (oldFormation) {
      oldFormation.remove();
    }

    // Find a friendly neighbor (or use the team's capital) as the soldier's
    // starting position — the new soldier visibly MARCHES from there.
    const sourceTile = findFriendlyNeighbor(tile, cap.toTeam);
    spawnMarchingSoldier(sourceTile || tile, tile, cap.toTeam, cap.action);

    // Banner + sound
    const teamName = cap.toTeam === 'red' ? 'Roja' : 'Dorada';
    if (cap.action === 'conquered') {
      setBanner(`⚔️ ¡El ejército ${teamName} conquistó la posición enemiga!`);
      MochiSounds.swordClash && MochiSounds.swordClash();
      spawnSwordClashFx(tileEl);
      if (navigator.vibrate) navigator.vibrate([40, 30, 80]);
    } else if (cap.action === 'expanded') {
      setBanner(`🐎 ¡La caballería ${teamName} avanza al frente!`);
      MochiSounds.horseGallop && MochiSounds.horseGallop();
    } else if (cap.action === 'jumped') {
      setBanner(`🏹 ¡Salto sorpresa de la tropa ${teamName}!`);
      MochiSounds.archerTwang && MochiSounds.archerTwang();
    }
  });

  // Find any tile our team owns that's adjacent to the captured tile, so
  // we can march from there. Falls back to the team's capital.
  function findFriendlyNeighbor(targetTile, team) {
    const adj = territories.filter((t) => {
      const dx = Math.abs(t.x - targetTile.x);
      const dy = Math.abs(t.y - targetTile.y);
      return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
    });
    const friendly = adj.filter((t) => ownership[t.id] === team);
    if (friendly.length) return friendly[0];
    return territories.find((t) => t.capitalOf === team);
  }

  // Spawn a SOLO marching soldier that visibly slides from a source tile
  // to the target tile, swaps to attack pose on enemy conquests, then
  // disappears (the target's FORMATION will be spawned separately by the
  // capture handler, which represents the new garrison).
  function spawnMarchingSoldier(from, to, team, action) {
    const army = $('cq-army-layer');
    if (!army) return;
    const fromPos = tilePos(from);
    const toPos = tilePos(to);
    const wrap = document.createElement('div');
    wrap.className = 'cq-soldier ' + team + ' marching';
    // Use a temp id so it doesn't collide with the permanent formation
    wrap.id = 'cq-march-' + to.id + '-' + Date.now();
    const src = team === 'red'
      ? '/assets/conquest/soldier-idle.png'
      : '/assets/conquest/cavalry-idle.png';
    const attackSrc = team === 'red'
      ? '/assets/conquest/soldier-attack.png'
      : '/assets/conquest/cavalry-attack.png';
    // Start at the source tile
    wrap.style.left = (fromPos.left + fromPos.width / 2) + '%';
    wrap.style.top  = (fromPos.top  + fromPos.height * 0.85) + '%';
    wrap.innerHTML = `<img src="${src}" alt="${team}">`;
    army.appendChild(wrap);
    // Slide to target via CSS transition
    requestAnimationFrame(() => {
      wrap.style.left = (toPos.left + toPos.width / 2) + '%';
      wrap.style.top  = (toPos.top  + toPos.height * 0.85) + '%';
    });
    // Mid-march: attack pose on enemy conquests
    if (action === 'conquered') {
      setTimeout(() => {
        const img = wrap.querySelector('img');
        if (img) img.src = attackSrc;
      }, 400);
    }
    // After arrival: spawn the permanent formation on the target tile,
    // then remove the solo marcher.
    setTimeout(() => {
      spawnSoldierSprite(to, team);
      wrap.remove();
    }, 750);
  }

  socket.on('cq:capital-fallen', ({ team }) => {
    setBanner(`🏯 ¡La fortaleza enemiga ha caído! ⚔️`);
    MochiSounds.fortressFall && MochiSounds.fortressFall();
    setTimeout(() => MochiSounds.winFanfare && MochiSounds.winFanfare(), 600);
    burstStars(team);
  });

  // === End of game ===
  socket.on('game-end', (data) => {
    if (timerInterval) clearInterval(timerInterval);
    if (warriorTimer) { clearInterval(warriorTimer); warriorTimer = null; }
    if (drumTimer)    { clearInterval(drumTimer);    drumTimer    = null; }
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

  // === Percent positions for the 6x4 logical grid overlaid on BOARD CONQUER.png
  // The painted board's hex grid spans roughly:
  //   x: 15% to 85% of the board image (left edge of leftmost hex to right edge)
  //   y: 18% to 75%
  // We lay out a 6-col × 4-row grid in that area with a half-column horizontal
  // stagger on alternating rows (classic hex layout). Each cell ~12% × 18%.
  function tilePos(t) {
    const colCount = 6;
    const rowCount = 4;
    const xL = 14, xR = 86;     // % of board
    const yT = 17, yB = 76;
    const colStep = (xR - xL) / (colCount - 1);
    const rowStep = (yB - yT) / (rowCount - 1);
    const staggerX = (t.y % 2 === 1) ? colStep * 0.5 : 0;
    return {
      left: xL + t.x * colStep + staggerX,
      top:  yT + t.y * rowStep,
      width: colStep * 0.95,   // tile width as % of board
      height: rowStep * 0.95,
    };
  }

  // === Map rendering — invisible hex overlay + sprite-based soldiers ===
  function renderMap() {
    const grid = $('cq-map');
    const army = $('cq-army-layer');
    if (!grid || !army) return;
    grid.innerHTML = '';
    army.innerHTML = '';
    territories.forEach((t) => {
      const { left, top, width, height } = tilePos(t);
      // Logical hex outline (semi-transparent ring on owned)
      const el = document.createElement('div');
      el.className = 'cq-tile terrain-' + (t.terrain || 'sand');
      el.id = 'cq-tile-' + t.id;
      el.dataset.tileId = t.id;
      const owner = ownership[t.id];
      if (owner) el.classList.add('owned-' + owner);
      if (t.isCapital) el.classList.add('capital');
      el.style.left   = left + '%';
      el.style.top    = top + '%';
      el.style.width  = width + '%';
      el.style.height = height + '%';
      grid.appendChild(el);
      // Soldier sprite for owned tiles
      if (owner) {
        spawnSoldierSprite(t, owner);
      }
    });
  }

  // Spawn a FORMATION of soldiers (2-3 stacked) on a given tile. Capitals
  // get a bigger formation (4 soldiers in a row) so the team's home camp
  // always reads as an army. Regular owned tiles get a smaller garrison.
  function spawnSoldierSprite(tile, team) {
    const army = $('cq-army-layer');
    if (!army) return;
    const pos = tilePos(tile);
    // Remove any existing formation on this tile
    const existing = document.getElementById('cq-soldier-' + tile.id);
    if (existing) existing.remove();
    const formationCount = tile.isCapital ? 4 : 2;
    const src = team === 'red'
      ? '/assets/conquest/soldier-idle.png'
      : '/assets/conquest/cavalry-idle.png';
    const wrap = document.createElement('div');
    wrap.className = 'cq-soldier-formation ' + team;
    wrap.id = 'cq-soldier-' + tile.id;
    wrap.dataset.tileId = tile.id;
    wrap.style.left = (pos.left + pos.width / 2) + '%';
    wrap.style.top  = (pos.top + pos.height * 0.85) + '%';
    // Build N soldiers offset side-by-side so they read as a formation,
    // not as one lone unit. Slight overlap = ranks of infantry.
    let inner = '';
    for (let i = 0; i < formationCount; i++) {
      const offsetX = (i - (formationCount - 1) / 2) * 18;   // horizontal spread
      const offsetY = (i % 2 === 1) ? -4 : 0;                // back-rank slightly up
      const scale = tile.isCapital ? 1 : 0.85;
      inner += `<img class="cq-formation-unit" data-unit="${i}"
                     src="${src}"
                     style="left: ${offsetX}px; bottom: ${offsetY}px; transform: scale(${scale});">`;
    }
    wrap.innerHTML = inner;
    army.appendChild(wrap);
  }

  // === Capture animations ===
  function spawnHorseCharge(tileEl, team, unit) {
    // A horseman / archer / swordsman charges in from off-screen to the tile.
    const map = $('cq-map');
    if (!map || !tileEl) return;
    const r = tileEl.getBoundingClientRect();
    const mr = map.getBoundingClientRect();
    const cx = r.left + r.width / 2 - mr.left;
    const cy = r.top  + r.height / 2 - mr.top;
    const horse = document.createElement('div');
    horse.className = 'cq-horse ' + team;
    horse.textContent = unit || '🐎';
    horse.style.left = cx + 'px';
    horse.style.top  = cy + 'px';
    map.appendChild(horse);
    setTimeout(() => horse.remove(), 1200);
  }
  // Spark burst over a tile when steel meets steel
  function spawnSwordClashFx(tileEl) {
    if (!tileEl) return;
    const map = $('cq-map');
    if (!map) return;
    const r = tileEl.getBoundingClientRect();
    const mr = map.getBoundingClientRect();
    const cx = r.left + r.width / 2 - mr.left;
    const cy = r.top  + r.height / 2 - mr.top;
    for (let i = 0; i < 8; i++) {
      const s = document.createElement('div');
      s.className = 'cq-clash-spark';
      s.textContent = ['⚔️', '✨', '💥'][i % 3];
      s.style.left = cx + 'px';
      s.style.top  = cy + 'px';
      const ang = (i / 8) * Math.PI * 2;
      s.style.setProperty('--dx', Math.cos(ang) * 60 + 'px');
      s.style.setProperty('--dy', Math.sin(ang) * 60 + 'px');
      s.style.animationDelay = (i * 25) + 'ms';
      map.appendChild(s);
      setTimeout(() => s.remove(), 900);
    }
  }
  // Distant war drum every ~15-25s — keeps the battlefield ominous
  function startAmbientDrums() {
    if (drumTimer) clearInterval(drumTimer);
    drumTimer = setInterval(() => {
      if (gameOver) return;
      if (Math.random() < 0.55 && MochiSounds.warDrum) MochiSounds.warDrum();
    }, 16000);
  }

  function flashTile(el, team, reinforce) {
    if (!el) return;
    el.classList.remove('flash-' + team);
    void el.offsetWidth;
    el.classList.add('flash-' + team);
    if (reinforce) {
      el.classList.add('reinforced');
      setTimeout(() => el.classList.remove('reinforced'), 800);
      // Also pulse the formation on this tile so the "reinforcements" feel
      // physically visible
      const tileId = el.dataset.tileId;
      const formation = tileId != null && document.getElementById('cq-soldier-' + tileId);
      if (formation) {
        formation.classList.remove('reinforcing');
        void formation.offsetWidth;
        formation.classList.add('reinforcing');
        setTimeout(() => formation.classList.remove('reinforcing'), 850);
      }
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
    // Use the actual cavalry sprite — a horseman gallops across the map.
    // Random direction: 50% left→right, 50% right→left (sprite mirrored).
    const rtl = Math.random() < 0.5;
    if (rtl) w.classList.add('rtl');
    w.innerHTML = '<img src="/assets/conquest/cavalry-idle.png" alt="">';
    w.style.top = (15 + Math.random() * 55) + '%';
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
