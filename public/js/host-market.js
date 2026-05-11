(function () {
  const socket = io();
  let pin = null;
  let state = null;
  let timerInterval = null;
  let urgentTriggered = false;

  // World state (kept up to date by mq:init + mq:tick + mq:vendor-claimed)
  let world = { w: 1600, h: 900 };
  let vendors = [];
  let pickups = [];            // id → { id, x, y, icon, available }
  let pickupFx = [];           // active grab-animation effects { x, y, icon, until }
  let players = {};            // id → { name, team, x, y, dir, moving }
  let displayPlayers = {};     // id → smoothed render position
  let scores = { red: 0, gold: 0 };

  // Asset cache
  const assets = {
    scene: null,      // Tiny Town pre-composed scene
    foodTiles: null,  // food sprite sheet
    townTiles: null,  // town tile sheet (for character)
  };

  const FOOD_TILE_SIZE = 18;
  const FOOD_TILE_SPACING = 1;
  const FOOD_COLS = 16;
  // We won't pick exact food tile indices yet — emoji icons on vendor stalls are clear enough.
  // The food-tiles.png is loaded so we can swap in later.

  const $ = (id) => document.getElementById(id);

  $('mute-btn').addEventListener('click', () => {
    const muted = window.toggleMute();
    $('mute-btn').textContent = muted ? '🔇 Off' : '🔊 On';
  });
  document.addEventListener('click', () => window.unlockAudio && window.unlockAudio(), { once: true });

  const params = new URLSearchParams(location.search);
  const chosenSetId = params.get('setId');
  if (!chosenSetId) location.href = '/sets.html?game=market-quest';

  // Preload assets
  function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }
  Promise.all([
    loadImage('/assets/market-quest/tiny-town-scene.png'),
    loadImage('/assets/market-quest/food-tiles.png'),
    loadImage('/assets/market-quest/tiny-town-tiles.png')
  ]).then(([scene, food, town]) => {
    assets.scene = scene;
    assets.foodTiles = food;
    assets.townTiles = town;
  });

  socket.emit('host:create', { gameType: 'market-quest' }, ({ pin: p }) => {
    pin = p;
    $('pin-display').textContent = p;
    if ($('active-pin-display')) $('active-pin-display').textContent = p;
    $('join-url').textContent = `${location.origin}/?pin=${p}`;
    document.title = `Market Quest · ${p}`;
    socket.emit('host:load-set', { pin, setId: chosenSetId }, (resp) => {
      if (!resp.ok) {
        alert('Could not load set: ' + (resp.error || 'unknown'));
        location.href = '/sets.html?game=market-quest';
        return;
      }
      $('set-title-display').textContent = resp.title;
      $('set-count-display').textContent = `${resp.count} questions`;
      MochiSounds.correct();
      updateStartBtn();
    });
  });

  $('duration-slider').addEventListener('input', (e) => {
    const v = +e.target.value;
    $('duration-value').textContent = v >= 60
      ? `${Math.floor(v / 60)}m${v % 60 ? ' ' + (v % 60) + 's' : ''}`
      : `${v}s`;
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
    if (confirm('End the round now?')) socket.emit('host:end-now', { pin });
  });
  $('play-again-btn').addEventListener('click', () => {
    socket.emit('host:reset', { pin });
    showScreen('lobby');
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
        numEl.textContent = '開市!';
        numEl.style.animation = 'none';
        numEl.offsetHeight;
        numEl.style.animation = '';
        MochiSounds.go();
        setTimeout(() => {
          showScreen('active');
          startTimer();
          startRenderLoop();
        }, 800);
      }
    };
    tick();
  });

  socket.on('mq:init', (data) => {
    world.w = data.worldW;
    world.h = data.worldH;
    vendors = data.vendors || [];
    pickups = data.pickups || [];
    pickupFx = [];
    players = data.players || {};
    scores = data.teamScores || { red: 0, gold: 0 };
    // Initialize display positions to match server positions
    displayPlayers = {};
    Object.entries(players).forEach(([id, p]) => {
      displayPlayers[id] = { x: p.x, y: p.y, dir: p.dir, moving: false };
    });
    updateScores(scores);
  });

  socket.on('mq:tick', ({ p: positions }) => {
    Object.entries(positions).forEach(([id, pos]) => {
      if (!players[id]) {
        // New player mid-game — server didn't send re-init, fabricate entry
        players[id] = { name: '?', team: 'red', x: pos.x, y: pos.y, dir: pos.d };
        displayPlayers[id] = { x: pos.x, y: pos.y, dir: pos.d, moving: !!pos.m };
      }
      players[id].x = pos.x;
      players[id].y = pos.y;
      players[id].dir = pos.d;
      players[id].moving = !!pos.m;
    });
    // Remove stale players not in tick
    Object.keys(displayPlayers).forEach((id) => {
      if (!positions[id]) delete displayPlayers[id];
    });
    // Ensure new ones have display entries
    Object.keys(players).forEach((id) => {
      if (!displayPlayers[id]) {
        displayPlayers[id] = {
          x: players[id].x, y: players[id].y, dir: players[id].dir, moving: false
        };
      }
    });
  });

  socket.on('mq:vendor-claimed', ({ vendorId, team, playerName, teamScores }) => {
    const v = vendors.find((x) => x.id === vendorId);
    if (v) v.claimedBy = team;
    if (teamScores) {
      scores = teamScores;
      updateScores(scores);
    }
    MochiSounds.correct();
  });

  socket.on('mq:pickup-grabbed', ({ id, icon, team, teamScores }) => {
    const pickup = pickups.find((p) => p.id === id);
    if (pickup) {
      pickup.available = false;
      pickupFx.push({ x: pickup.x, y: pickup.y, icon, team, until: performance.now() + 600 });
    }
    if (teamScores) {
      scores = teamScores;
      updateScores(scores);
    }
    MochiSounds.populate(team);
  });

  socket.on('mq:pickup-respawn', ({ id }) => {
    const pickup = pickups.find((p) => p.id === id);
    if (pickup) pickup.available = true;
  });

  function updateScores(s) {
    $('score-red').textContent = s.red || 0;
    $('score-gold').textContent = s.gold || 0;
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
      if (sec <= 15 && !urgentTriggered) {
        urgentTriggered = true;
        $('timer-display').classList.add('urgent');
        MochiSounds.urgent();
      }
      if (remaining <= 0) clearInterval(timerInterval);
    }, 100);
  }

  // === CANVAS RENDER LOOP ===
  let raf = null;
  let lastFrame = performance.now();

  function startRenderLoop() {
    cancelAnimationFrame(raf);
    lastFrame = performance.now();
    raf = requestAnimationFrame(renderFrame);
  }

  function renderFrame(now) {
    const dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;

    const canvas = $('mq-canvas');
    if (!canvas) { raf = requestAnimationFrame(renderFrame); return; }
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    // Smooth display positions toward server positions (interpolation)
    Object.entries(players).forEach(([id, p]) => {
      const d = displayPlayers[id];
      if (!d) return;
      const lerp = 0.25; // 25% catch-up per frame
      d.x += (p.x - d.x) * lerp;
      d.y += (p.y - d.y) * lerp;
      d.dir = p.dir;
      d.moving = p.moving;
    });

    // Clear
    ctx.fillStyle = '#1a0d08';
    ctx.fillRect(0, 0, W, H);

    // Background: tiled Tiny Town scene (or fallback gradient)
    if (assets.scene) {
      const sceneW = assets.scene.width;
      const sceneH = assets.scene.height;
      const scale = Math.max(W / sceneW, H / sceneH);
      const sx = (W - sceneW * scale) / 2;
      const sy = (H - sceneH * scale) / 2;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(assets.scene, sx, sy, sceneW * scale, sceneH * scale);
      // Slight dark overlay to make players + vendors pop
      ctx.fillStyle = 'rgba(20, 10, 5, 0.25)';
      ctx.fillRect(0, 0, W, H);
    } else {
      // Fallback: parchment gradient + grid texture
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#7a4f33');
      grad.addColorStop(1, '#432817');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    // Draw vendor stalls + pickups
    const t = now / 1000;
    vendors.forEach((v) => {
      drawVendor(ctx, v, t);
    });
    pickups.forEach((pickup) => {
      drawPickup(ctx, pickup, t);
    });
    // Grab effects: items flying upward and fading
    pickupFx = pickupFx.filter((fx) => fx.until > now);
    pickupFx.forEach((fx) => {
      const elapsed = 600 - (fx.until - now);
      const p = elapsed / 600;
      const rise = 60 * p;
      const alpha = 1 - p;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `${40 + 20 * p}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fx.icon, fx.x, fx.y - rise);
      ctx.restore();
    });

    // Draw players (sorted by Y so closer ones overlap correctly)
    const sortedIds = Object.keys(displayPlayers).sort((a, b) => displayPlayers[a].y - displayPlayers[b].y);
    sortedIds.forEach((id) => {
      const d = displayPlayers[id];
      const p = players[id];
      if (!d || !p) return;
      drawPlayer(ctx, d, p, t);
    });

    raf = requestAnimationFrame(renderFrame);
  }

  function drawVendor(ctx, v, t) {
    const x = v.x, y = v.y;
    // Stall base — wooden table
    ctx.save();
    const stallW = 90, stallH = 60;

    // Detection-radius aura on UNCLAIMED vendors so players see where to go
    if (!v.claimedBy) {
      const pulse = 0.55 + Math.sin(t * 2 + v.id) * 0.15;
      const grad = ctx.createRadialGradient(x, y + 12, 8, x, y + 12, 140);
      grad.addColorStop(0, `rgba(255, 220, 130, ${0.18 * pulse})`);
      grad.addColorStop(0.5, `rgba(255, 200, 100, ${0.12 * pulse})`);
      grad.addColorStop(1, 'rgba(255, 213, 122, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y + 12, 140, 0, Math.PI * 2);
      ctx.fill();
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + 36, 55, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stall roof (Chinese pavilion style — slight curve, red/gold)
    const claimed = v.claimedBy;
    const roofColor = claimed === 'red' ? '#d92e3a' : claimed === 'gold' ? '#e8b14a' : '#8b1a23';
    const roofGlow = claimed === 'red' ? '#ff5a66' : claimed === 'gold' ? '#ffd57a' : null;
    ctx.fillStyle = roofColor;
    ctx.beginPath();
    ctx.moveTo(x - stallW / 2 - 15, y - 30);
    ctx.quadraticCurveTo(x, y - 50, x + stallW / 2 + 15, y - 30);
    ctx.lineTo(x + stallW / 2, y - 12);
    ctx.lineTo(x - stallW / 2, y - 12);
    ctx.closePath();
    ctx.fill();
    if (roofGlow) {
      ctx.shadowColor = roofGlow;
      ctx.shadowBlur = 20;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Table top
    ctx.fillStyle = '#7a4d2a';
    ctx.fillRect(x - stallW / 2, y - 10, stallW, 24);
    ctx.fillStyle = '#9a6a3a';
    ctx.fillRect(x - stallW / 2, y - 10, stallW, 4);

    // Item icon (emoji)
    ctx.font = '40px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const bob = claimed ? 0 : Math.sin(t * 2 + v.id) * 3;
    ctx.fillText(v.icon, x, y - 26 + bob);

    // If claimed: draw a flag with team color
    if (claimed) {
      ctx.fillStyle = claimed === 'red' ? '#ff5a66' : '#ffd57a';
      ctx.fillRect(x + stallW / 2 - 6, y - 50, 4, 30);
      ctx.beginPath();
      ctx.moveTo(x + stallW / 2 - 2, y - 50);
      ctx.lineTo(x + stallW / 2 + 18, y - 44);
      ctx.lineTo(x + stallW / 2 - 2, y - 38);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPickup(ctx, pickup, t) {
    if (!pickup.available) return; // hidden until respawn
    const x = pickup.x;
    const y = pickup.y;
    const bob = Math.sin(t * 2.2 + pickup.id) * 4;
    ctx.save();
    // Soft glow ring around pickup so kids notice it
    const glow = ctx.createRadialGradient(x, y + bob, 4, x, y + bob, 36);
    glow.addColorStop(0, 'rgba(255, 220, 130, 0.45)');
    glow.addColorStop(1, 'rgba(255, 213, 122, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y + bob, 36, 0, Math.PI * 2);
    ctx.fill();
    // Shadow on the ground
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + 18, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // The food item
    ctx.font = '32px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pickup.icon, x, y + bob);
    ctx.restore();
  }

  function drawPlayer(ctx, d, p, t) {
    const x = d.x, y = d.y;
    ctx.save();
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(x, y + 28, 22, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Walking bob
    const bob = d.moving ? Math.sin(t * 12) * 3 : 0;

    // Character body — colored circle with face
    const team = p.team;
    const body = team === 'red' ? '#ff5a66' : '#ffd57a';
    const bodyDark = team === 'red' ? '#8b1a23' : '#a87a1f';

    // Body
    ctx.fillStyle = bodyDark;
    ctx.beginPath();
    ctx.arc(x, y + 8 - bob, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y + 5 - bob, 16, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#f4d8b8';
    ctx.beginPath();
    ctx.arc(x, y - 18 - bob, 14, 0, Math.PI * 2);
    ctx.fill();

    // Eyes — direction-aware
    ctx.fillStyle = '#1a0d08';
    const eyeOffsetX = d.dir === 'left' ? -4 : d.dir === 'right' ? 4 : 0;
    const eyeOffsetY = d.dir === 'up' ? -3 : d.dir === 'down' ? 2 : 0;
    ctx.beginPath();
    ctx.arc(x - 5 + eyeOffsetX, y - 19 - bob + eyeOffsetY, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 5 + eyeOffsetX, y - 19 - bob + eyeOffsetY, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Team-colored cap / accessory
    ctx.fillStyle = bodyDark;
    ctx.beginPath();
    ctx.ellipse(x, y - 28 - bob, 14, 6, 0, Math.PI, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = body;
    ctx.fillRect(x - 14, y - 28 - bob, 28, 2);

    // Name label
    ctx.font = 'bold 11px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const name = p.name || '?';
    const nameW = ctx.measureText(name).width;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(x - nameW / 2 - 4, y - 50 - bob, nameW + 8, 14);
    ctx.fillStyle = team === 'red' ? '#ff9aa5' : '#ffd57a';
    ctx.fillText(name, x, y - 49 - bob);
    ctx.restore();
  }

  socket.on('game-end', (data) => {
    if (timerInterval) clearInterval(timerInterval);
    cancelAnimationFrame(raf);
    MochiSounds.stopMusic();
    showScreen('win');
    const r = data.teamScores.red || 0;
    const g = data.teamScores.gold || 0;
    $('final-red').textContent = r;
    $('final-gold').textContent = g;
    if (data.winner === 'red') {
      $('win-banner').textContent = '🐲 Team Long Wins!';
      $('win-banner').className = 'winner-banner red';
      $('win-emoji').textContent = '🐲';
      MochiSounds.win();
      launchConfetti(['#ff5a66', '#d92e3a', '#ffd57a']);
    } else if (data.winner === 'gold') {
      $('win-banner').textContent = '🦁 Team Shi Wins!';
      $('win-banner').className = 'winner-banner gold';
      $('win-emoji').textContent = '🦁';
      MochiSounds.win();
      launchConfetti(['#ffd57a', '#e8b14a', '#ff5a66']);
    } else {
      $('win-banner').textContent = '🤝 Market Tie!';
      $('win-banner').className = 'winner-banner tie';
      $('win-emoji').textContent = '⚖️';
      MochiSounds.lose();
    }
  });

  function renderLobbyPlayers(playersMap) {
    const red = $('players-red');
    const gold = $('players-gold');
    red.innerHTML = '';
    gold.innerHTML = '';
    Object.entries(playersMap || {}).forEach(([id, p]) => {
      const chip = document.createElement('div');
      chip.className = 'player-chip';
      chip.innerHTML = `<span>${escapeHtml(p.name)}</span><span class="swap-arrow">↔</span>`;
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
      c.textContent = ['🛍️', '🏮', '🥟', '✨', '🐲', '🦁'][i % 6];
      c.style.fontSize = (1 + Math.random() * 1) + 'rem';
      c.style.background = 'transparent';
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 5000);
    }
  }

  socket.on('disconnect', () => console.log('[host-market] disconnected'));
  socket.on('connect', () => console.log('[host-market] connected'));
  socket.on('host-left', () => console.warn('[host-market] host-left'));

  function showScreen(name) {
    ['lobby', 'countdown', 'active', 'win'].forEach((n) => {
      const el = $('screen-' + n);
      if (el) el.classList.toggle('hidden', n !== name);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
})();
