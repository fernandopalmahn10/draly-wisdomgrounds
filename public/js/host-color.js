(function () {
  const socket = io();
  let pin = null;
  let state = null;
  let timerInterval = null;
  let urgentTriggered = false;
  let gridW = 30;
  let gridH = 18;
  let cellSize = 32;

  // World state
  let grid = [];               // 2D array of team or null
  let pickups = [];            // [{ id, x, y, icon, available }]
  let pickupFx = [];           // active grab animations
  let players = {};            // id → { name, team, x, y }
  let displayPlayers = {};     // smoothed positions
  let scores = { red: 0, gold: 0 };
  let paintFx = [];            // recent paint splat animations

  const $ = (id) => document.getElementById(id);

  $('mute-btn').addEventListener('click', () => {
    const muted = window.toggleMute();
    $('mute-btn').textContent = muted ? '🔇 Off' : '🔊 On';
  });
  document.addEventListener('click', () => window.unlockAudio && window.unlockAudio(), { once: true });

  const params = new URLSearchParams(location.search);
  const chosenSetId = params.get('setId');
  if (!chosenSetId) location.href = '/sets.html?game=color-splash';

  socket.emit('host:create', { gameType: 'color-splash' }, ({ pin: p }) => {
    pin = p;
    $('pin-display').textContent = p;
    if ($('active-pin-display')) $('active-pin-display').textContent = p;
    $('join-url').textContent = `${location.origin}/?pin=${p}`;
    document.title = `Tinta y Bambú · ${p}`;
    socket.emit('host:load-set', { pin, setId: chosenSetId }, (resp) => {
      if (!resp.ok) {
        alert('Could not load set: ' + (resp.error || 'unknown'));
        location.href = '/sets.html?game=color-splash';
        return;
      }
      $('set-title-display').textContent = resp.title;
      $('set-count-display').textContent = `${resp.count} preguntas`;
      MochiSounds.correct();
      updateStartBtn();
    });
  });

  socket.on('images-progress', ({ warmed, total }) => {
    const badge = $('images-progress-badge');
    const text = $('images-progress-text');
    if (!badge) return;
    badge.style.display = 'block';
    text.textContent = `${warmed}/${total}`;
    if (warmed >= total) {
      badge.style.color = 'var(--jade)';
      text.textContent = `${total}/${total} ✓`;
      setTimeout(() => { badge.style.display = 'none'; }, 4000);
    }
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
    if (confirm('¿Terminar la ronda ahora?')) socket.emit('host:end-now', { pin });
  });
  $('play-again-btn').addEventListener('click', () => {
    if (MochiSounds.stopEndMusic) MochiSounds.stopEndMusic();
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
        numEl.textContent = '¡墨!';
        numEl.style.animation = 'none';
        numEl.offsetHeight;
        numEl.style.animation = '';
        MochiSounds.go();
        setTimeout(() => {
          showScreen('active');
          startTimer();
          startRender();
        }, 800);
      }
    };
    tick();
  });

  socket.on('cs:init', (data) => {
    gridW = data.gridW;
    gridH = data.gridH;
    grid = Array.from({ length: gridH }, () => Array(gridW).fill(null));
    players = data.players || {};
    displayPlayers = {};
    Object.entries(players).forEach(([id, p]) => {
      displayPlayers[id] = { x: p.x, y: p.y };
    });
    pickups = data.pickups || [];
    pickupFx = [];
    paintFx = [];
    scores = data.teamScores || { red: 0, gold: 0 };
    updateScores(scores);
  });

  socket.on('cs:pickup-grabbed', ({ id, icon, x, y, team, bonusCells, teamScores }) => {
    const pk = pickups.find((p) => p.id === id);
    if (pk) {
      pk.available = false;
      pickupFx.push({ x: pk.x, y: pk.y, icon, team, until: performance.now() + 700 });
    }
    if (Array.isArray(bonusCells)) {
      bonusCells.forEach((c) => {
        grid[c.y][c.x] = c.team;
        paintFx.push({ x: c.x, y: c.y, team: c.team, until: performance.now() + 450 });
      });
    }
    if (teamScores) {
      scores = teamScores;
      updateScores(scores);
    }
    MochiSounds.populate(team);
  });

  socket.on('cs:pickup-respawn', ({ id }) => {
    const pk = pickups.find((p) => p.id === id);
    if (pk) pk.available = true;
  });

  socket.on('cs:move', ({ playerId, x, y, paint, teamScores }) => {
    if (players[playerId]) {
      players[playerId].x = x;
      players[playerId].y = y;
    }
    if (!displayPlayers[playerId]) displayPlayers[playerId] = { x, y };
    if (Array.isArray(paint)) {
      paint.forEach((c) => {
        grid[c.y][c.x] = c.team;
        paintFx.push({ x: c.x, y: c.y, team: c.team, until: performance.now() + 450 });
      });
    } else if (paint) {
      grid[paint.y][paint.x] = paint.team;
      paintFx.push({ x: paint.x, y: paint.y, team: paint.team, until: performance.now() + 450 });
    }
    if (teamScores) {
      scores = teamScores;
      updateScores(scores);
    }
  });

  socket.on('cs:paint', ({ cells, teamScores }) => {
    cells.forEach((c) => {
      grid[c.y][c.x] = c.team;
      paintFx.push({ x: c.x, y: c.y, team: c.team, until: performance.now() + 450 });
    });
    if (teamScores) {
      scores = teamScores;
      updateScores(scores);
    }
  });

  function updateScores(s) {
    const total = gridW * gridH;
    const rPct = Math.round(((s.red || 0) / total) * 100);
    const gPct = Math.round(((s.gold || 0) / total) * 100);
    $('pct-red').textContent = rPct + '%';
    $('pct-gold').textContent = gPct + '%';
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
        MochiSounds.urgent();
      }
      if (remaining <= 0) clearInterval(timerInterval);
    }, 100);
  }

  // === Canvas render loop ===
  let raf = null;

  function startRender() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(renderFrame);
  }

  function renderFrame(now) {
    const canvas = $('cs-canvas');
    if (!canvas) { raf = requestAnimationFrame(renderFrame); return; }
    const ctx = canvas.getContext('2d');
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (canvas.width !== cssW || canvas.height !== cssH) {
      canvas.width = cssW;
      canvas.height = cssH;
    }
    const W = canvas.width;
    const H = canvas.height;

    // Compute cell size to fit the grid in the canvas with some margin
    const margin = 40;
    cellSize = Math.floor(Math.min((W - margin * 2) / gridW, (H - margin * 2) / gridH));
    const gridPixelW = cellSize * gridW;
    const gridPixelH = cellSize * gridH;
    const offsetX = (W - gridPixelW) / 2;
    const offsetY = (H - gridPixelH) / 2;

    // Rice paper background (the canvas itself is transparent above the CSS background;
    // we layer a subtle vignette + ink-bleed effects)
    ctx.fillStyle = 'rgba(244, 228, 192, 0.0)'; // let CSS background show
    ctx.fillRect(0, 0, W, H);

    // Subtle paper grid lines (very faint, like calligraphy paper marks)
    ctx.strokeStyle = 'rgba(100, 70, 40, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= gridW; i += 3) {
      ctx.beginPath();
      ctx.moveTo(offsetX + i * cellSize, offsetY);
      ctx.lineTo(offsetX + i * cellSize, offsetY + gridPixelH);
      ctx.stroke();
    }
    for (let i = 0; i <= gridH; i += 3) {
      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY + i * cellSize);
      ctx.lineTo(offsetX + gridPixelW, offsetY + i * cellSize);
      ctx.stroke();
    }

    // Ink splats — render painted cells as organic blobs with bleed
    ctx.save();
    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        const cell = grid[y][x];
        if (!cell) continue;
        const cx = offsetX + x * cellSize + cellSize / 2;
        const cy = offsetY + y * cellSize + cellSize / 2;
        drawInkSplat(ctx, cx, cy, cellSize, cell, x + y);
      }
    }
    ctx.restore();

    // Pickups — glowing school items on the rice paper
    pickups.forEach((pickup) => {
      if (!pickup.available) return;
      const cx = offsetX + pickup.x * cellSize + cellSize / 2;
      const cy = offsetY + pickup.y * cellSize + cellSize / 2;
      const bob = Math.sin(now / 400 + pickup.id) * 4;
      // Soft golden glow ring
      const glow = ctx.createRadialGradient(cx, cy + bob, 4, cx, cy + bob, cellSize * 1.4);
      glow.addColorStop(0, 'rgba(255, 220, 130, 0.55)');
      glow.addColorStop(1, 'rgba(255, 213, 122, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy + bob, cellSize * 1.4, 0, Math.PI * 2);
      ctx.fill();
      // Ground shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + cellSize * 0.55, cellSize * 0.4, cellSize * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      // The school item
      ctx.font = `${cellSize * 1.1}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pickup.icon, cx, cy + bob);
    });

    // Pickup grab effect — item flies up + fades
    pickupFx = pickupFx.filter((fx) => fx.until > now);
    pickupFx.forEach((fx) => {
      const elapsed = 700 - (fx.until - now);
      const p = elapsed / 700;
      const cx = offsetX + fx.x * cellSize + cellSize / 2;
      const cy = offsetY + fx.y * cellSize + cellSize / 2 - 70 * p;
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.font = `${cellSize * (1.2 + p * 0.8)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fx.icon, cx, cy);
      ctx.restore();
    });

    // Fresh paint pulse — recently painted cells get a brighter highlight
    paintFx = paintFx.filter((fx) => fx.until > now);
    paintFx.forEach((fx) => {
      const elapsed = 450 - (fx.until - now);
      const p = elapsed / 450;
      const cx = offsetX + fx.x * cellSize + cellSize / 2;
      const cy = offsetY + fx.y * cellSize + cellSize / 2;
      const r = cellSize * (0.6 + p * 0.8);
      ctx.save();
      ctx.globalAlpha = (1 - p) * 0.5;
      const color = fx.team === 'red' ? '#ff5a66' : '#ffd57a';
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Players — smooth interpolation toward server positions
    Object.entries(players).forEach(([id, p]) => {
      const d = displayPlayers[id];
      if (!d) return;
      d.x += (p.x - d.x) * 0.3;
      d.y += (p.y - d.y) * 0.3;
    });

    // Y-sort by row
    const sortedIds = Object.keys(displayPlayers).sort((a, b) => displayPlayers[a].y - displayPlayers[b].y);
    sortedIds.forEach((id) => {
      const d = displayPlayers[id];
      const p = players[id];
      if (!d || !p) return;
      drawScholar(ctx, offsetX + d.x * cellSize + cellSize / 2, offsetY + d.y * cellSize + cellSize / 2, p, cellSize, now);
    });

    raf = requestAnimationFrame(renderFrame);
  }

  function drawInkSplat(ctx, cx, cy, size, team, seed) {
    const baseColor = team === 'red' ? '#8b1a23' : '#a87a1f';
    const accentColor = team === 'red' ? '#d92e3a' : '#e8b14a';
    const glow = team === 'red' ? 'rgba(217, 46, 58, 0.3)' : 'rgba(232, 177, 74, 0.3)';
    // Outer bleed (soft glow)
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.85, 0, Math.PI * 2);
    ctx.fill();
    // Main splat — slightly irregular based on seed
    const wobble1 = ((seed * 17) % 100) / 100 * 0.3 + 0.85;
    const wobble2 = ((seed * 31) % 100) / 100 * 0.3 + 0.85;
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.ellipse(cx, cy, size * 0.55 * wobble1, size * 0.55 * wobble2, ((seed * 7) % 360) * Math.PI / 180, 0, Math.PI * 2);
    ctx.fill();
    // Highlight
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.ellipse(cx - size * 0.1, cy - size * 0.1, size * 0.3, size * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawScholar(ctx, x, y, p, size, now) {
    ctx.save();
    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.5, size * 0.5, size * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Walking bob
    const bob = Math.sin(now / 100) * 2;

    // Robe (team color)
    const robe = p.team === 'red' ? '#d92e3a' : '#e8b14a';
    const robeDark = p.team === 'red' ? '#8b1a23' : '#a87a1f';
    ctx.fillStyle = robeDark;
    ctx.beginPath();
    ctx.arc(x, y + size * 0.2 - bob, size * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = robe;
    ctx.beginPath();
    ctx.arc(x, y + size * 0.15 - bob, size * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#f4d8b8';
    ctx.beginPath();
    ctx.arc(x, y - size * 0.3 - bob, size * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#1a0d08';
    ctx.beginPath();
    ctx.arc(x - size * 0.13, y - size * 0.32 - bob, size * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + size * 0.13, y - size * 0.32 - bob, size * 0.06, 0, Math.PI * 2);
    ctx.fill();

    // Brush in hand (team-tinted ink tip)
    ctx.strokeStyle = '#4a2e1d';
    ctx.lineWidth = size * 0.08;
    ctx.beginPath();
    ctx.moveTo(x + size * 0.35, y - size * 0.2 - bob);
    ctx.lineTo(x + size * 0.6, y - size * 0.05 - bob);
    ctx.stroke();
    ctx.fillStyle = robe;
    ctx.beginPath();
    ctx.arc(x + size * 0.62, y - size * 0.03 - bob, size * 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Name label
    ctx.font = `bold ${Math.max(10, size * 0.32)}px Nunito, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const name = p.name || '?';
    const nameW = ctx.measureText(name).width;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(x - nameW / 2 - 4, y - size * 0.85 - bob, nameW + 8, size * 0.4);
    ctx.fillStyle = p.team === 'red' ? '#ff9aa5' : '#ffd57a';
    ctx.fillText(name, x, y - size * 0.83 - bob);

    ctx.restore();
  }

  socket.on('game-end', (data) => {
    if (timerInterval) clearInterval(timerInterval);
    cancelAnimationFrame(raf);
    MochiSounds.stopMusic();
    showScreen('win');
    const total = gridW * gridH;
    const rPct = Math.round((data.teamScores.red / total) * 100);
    const gPct = Math.round((data.teamScores.gold / total) * 100);
    $('final-red').textContent = rPct + '%';
    $('final-gold').textContent = gPct + '%';
    const narr = $('win-narration');
    const gap = Math.abs(rPct - gPct);
    if (data.winner === 'red') {
      $('win-banner').textContent = '✏️ ¡Estudiantes ganan!';
      $('win-banner').className = 'winner-banner red';
      $('win-emoji').textContent = '✏️';
      MochiSounds.winMusic();
      setTimeout(() => MochiSounds.winFanfare(), 400);
      if (narr) narr.innerHTML = `✏️ <span class="red-team">Los Estudiantes</span> cubrieron el papel con <strong>${rPct}%</strong> — ${gap > 20 ? 'una obra maestra 🎨' : gap > 8 ? 'una victoria sólida 💪' : 'un duelo reñido ⚔️'}.`;
      launchConfetti(['#ff5a66', '#d92e3a', '#ffd57a']);
    } else if (data.winner === 'gold') {
      $('win-banner').textContent = '📚 ¡Maestros ganan!';
      $('win-banner').className = 'winner-banner gold';
      $('win-emoji').textContent = '📚';
      MochiSounds.winMusic();
      setTimeout(() => MochiSounds.winFanfare(), 400);
      if (narr) narr.innerHTML = `📚 <span class="gold-team">Los Maestros</span> cubrieron el papel con <strong>${gPct}%</strong> — ${gap > 20 ? 'una obra maestra 🎨' : gap > 8 ? 'una victoria sólida 💪' : 'un duelo reñido ⚔️'}.`;
      launchConfetti(['#ffd57a', '#e8b14a', '#ff5a66']);
    } else {
      $('win-banner').textContent = '🤝 ¡Empate en clase!';
      $('win-banner').className = 'winner-banner tie';
      $('win-emoji').textContent = '⚖️';
      MochiSounds.tieMusic();
      if (narr) narr.innerHTML = `🤝 Ambos equipos pintaron el mismo <strong>${rPct}%</strong> del papel de caligrafía.`;
    }
    setTimeout(() => launchConfetti(data.winner === 'red' ? ['#ff5a66', '#d92e3a', '#ffd57a'] : ['#ffd57a', '#e8b14a', '#ff5a66']), 4000);
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
      c.textContent = ['📚', '✏️', '🖌', '🍎', '✨'][i % 5];
      c.style.fontSize = (1 + Math.random() * 1) + 'rem';
      c.style.background = 'transparent';
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 5000);
    }
  }

  socket.on('disconnect', () => console.log('[host-color] disconnected'));
  socket.on('connect', () => console.log('[host-color] connected'));
  socket.on('host-left', () => console.warn('[host-color] host-left'));

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
