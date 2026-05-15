// Piñata Tigre — host view.
// Two tigers, one per team. Players use a Mochi-Mash-style flow on their phones:
// answer a vocab question correctly → 5 s smash window → every tap is one stick
// strike on THEIR team's tiger. The host screen shows both tigers in real time,
// deforming + cracking as damage accumulates. First tiger to break (HP = 0) wins.
(function () {
  const socket = io();
  let pin = null;
  let state = null;
  let timerInterval = null;
  let urgentTriggered = false;

  let maxHp = 220;
  let hpRed = 220;
  let hpGold = 220;
  let scores = { red: 0, gold: 0 };
  let lootRed = [];
  let lootGold = [];
  let gameOver = false;

  const $ = (id) => document.getElementById(id);

  $('mute-btn').addEventListener('click', () => {
    const muted = window.toggleMute();
    $('mute-btn').textContent = muted ? '🔇 Off' : '🔊 On';
  });
  document.addEventListener('click', () => window.unlockAudio && window.unlockAudio(), { once: true });

  const params = new URLSearchParams(location.search);
  const chosenSetId = params.get('setId');
  if (!chosenSetId) location.href = '/sets.html?game=pinata';

  socket.emit('host:create', { gameType: 'pinata' }, ({ pin: p }) => {
    pin = p;
    $('pin-display').textContent = p;
    if ($('active-pin-display')) $('active-pin-display').textContent = p;
    $('join-url').textContent = `${location.origin}/?pin=${p}`;
    document.title = `Piñata Tigre · ${p}`;
    socket.emit('host:load-set', { pin, setId: chosenSetId }, (resp) => {
      if (!resp.ok) {
        alert('No se pudo cargar el set: ' + (resp.error || 'desconocido'));
        location.href = '/sets.html?game=pinata';
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
    hpRed = hpGold = maxHp;
    lootRed = []; lootGold = [];
    gameOver = false;
    renderLoot();
    setHpBars();
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
        numEl.textContent = '¡老虎!';
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

  socket.on('pn:init', (data) => {
    maxHp = data.maxHp;
    hpRed  = data.hpRed;
    hpGold = data.hpGold;
    scores = data.teamScores || { red: 0, gold: 0 };
    lootRed = []; lootGold = [];
    gameOver = false;
    setHpBars();
    updateScores();
    renderLoot();
    setBanner('¡Ataquen a su tigre! 攻击老虎');
  });

  // HP throttled broadcast — drives the deformation visuals
  socket.on('pn:hp', ({ hpRed: r, hpGold: g, maxHp: m }) => {
    if (typeof r === 'number') hpRed = r;
    if (typeof g === 'number') hpGold = g;
    if (typeof m === 'number') maxHp = m;
    setHpBars();
  });

  // Team-aggregated tap effects (already broadcast by server for Mochi-style).
  // Each chunk of taps spawns a flying stick + small candy puff per team.
  socket.on('tap-fx', ({ red, gold }) => {
    if (red && red > 0)  spawnStrikes('red',  Math.min(red, 6));
    if (gold && gold > 0) spawnStrikes('gold', Math.min(gold, 6));
  });

  socket.on('score-update', ({ teamScores }) => {
    if (teamScores) { scores = teamScores; updateScores(); }
  });

  socket.on('pn:broken', ({ team, hpRed: r, hpGold: g, teamScores }) => {
    gameOver = true;
    if (typeof r === 'number') hpRed = r;
    if (typeof g === 'number') hpGold = g;
    if (teamScores) scores = teamScores;
    setHpBars();
    updateScores();
    const emoji = team === 'red' ? '🥢' : '🏹';
    setBanner(`💥💥 ¡${team === 'red' ? 'Bastón' : 'Arco'} rompió su tigre primero! ${emoji}`);
    burstCandy(team);
    MochiSounds.candySpill && MochiSounds.candySpill();
    setTimeout(() => MochiSounds.winFanfare && MochiSounds.winFanfare(), 400);
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
      $('win-banner').textContent = '🥢 ¡Equipo Bastón gana!';
      $('win-banner').className = 'winner-banner red';
      $('win-emoji').textContent = '🥢';
      MochiSounds.winMusic && MochiSounds.winMusic();
      setTimeout(() => MochiSounds.winFanfare && MochiSounds.winFanfare(), 400);
      if (narr) narr.innerHTML = `🥢 <span class="red-team">Equipo Bastón</span> rompió la piñata con <strong>${r}</strong> golpes — ${gap > 80 ? 'una paliza 🔥' : gap > 30 ? 'una victoria sólida 💪' : 'un duelo reñido ⚔️'}.`;
      launchConfetti(['#ff5a66', '#d92e3a', '#ffd57a']);
    } else if (data.winner === 'gold') {
      $('win-banner').textContent = '🏹 ¡Equipo Arco gana!';
      $('win-banner').className = 'winner-banner gold';
      $('win-emoji').textContent = '🏹';
      MochiSounds.winMusic && MochiSounds.winMusic();
      setTimeout(() => MochiSounds.winFanfare && MochiSounds.winFanfare(), 400);
      if (narr) narr.innerHTML = `🏹 <span class="gold-team">Equipo Arco</span> rompió la piñata con <strong>${g}</strong> golpes — ${gap > 80 ? 'una paliza 🔥' : gap > 30 ? 'una victoria sólida 💪' : 'un duelo reñido ⚔️'}.`;
      launchConfetti(['#ffd57a', '#e8b14a', '#ff5a66']);
    } else {
      $('win-banner').textContent = '🤝 ¡Empate!';
      $('win-banner').className = 'winner-banner tie';
      $('win-emoji').textContent = '⚖️';
      MochiSounds.tieMusic && MochiSounds.tieMusic();
      if (narr) narr.innerHTML = `🤝 Ambos equipos golpearon igual: <strong>${r}</strong> golpes.`;
    }
    renderLeaderboard(data);
    setTimeout(() => launchConfetti(data.winner === 'red'
      ? ['#ff5a66', '#d92e3a', '#ffd57a']
      : ['#ffd57a', '#e8b14a', '#ff5a66']), 4000);
  });

  // === Visuals ===

  function setHpBars() {
    setHpBar('red',  hpRed);
    setHpBar('gold', hpGold);
  }

  function setHpBar(team, hp) {
    const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
    const fill = $('hp-' + team + '-fill');
    const txt = $('hp-' + team + '-text');
    if (fill) fill.style.width = pct + '%';
    if (txt) txt.textContent = `HP ${hp} / ${maxHp}`;
    if (fill) {
      if (pct > 66) fill.className = 'pn-hp-fill ok';
      else if (pct > 33) fill.className = 'pn-hp-fill warn';
      else fill.className = 'pn-hp-fill danger';
    }
    // Deformation: cracks + tilt proportional to damage taken.
    const wrap = $('tiger-' + team + '-wrap');
    const tiger = $('tiger-' + team);
    const cracks = $('cracks-' + team);
    if (!wrap || !cracks) return;
    const damageRatio = 1 - (hp / maxHp);
    // Tilt + scale-down as it falls apart
    const tilt = (damageRatio * 28) * (team === 'red' ? -1 : 1);
    wrap.style.setProperty('--deform-tilt', tilt + 'deg');
    wrap.style.setProperty('--deform-scale', (1 - damageRatio * 0.18).toFixed(3));
    // Tint progressively darker / desaturated
    if (tiger) tiger.style.filter = `drop-shadow(0 8px 20px rgba(0,0,0,0.7)) brightness(${(1 - damageRatio * 0.45).toFixed(2)}) saturate(${(1 - damageRatio * 0.55).toFixed(2)})`;
    // Crack overlays — count grows with damage
    const cracksTarget = Math.floor(damageRatio * 12);
    while (cracks.children.length < cracksTarget) {
      const c = document.createElement('div');
      c.className = 'pn-crack pn-crack-' + (cracks.children.length % 4);
      c.style.left = (10 + Math.random() * 80) + '%';
      c.style.top = (10 + Math.random() * 75) + '%';
      c.style.transform = `rotate(${Math.floor(Math.random() * 90 - 45)}deg)`;
      cracks.appendChild(c);
    }
    while (cracks.children.length > cracksTarget) {
      cracks.removeChild(cracks.lastChild);
    }
    // Big crack when ~70% damaged
    if (damageRatio > 0.7) wrap.classList.add('heavily-damaged');
    else wrap.classList.remove('heavily-damaged');
  }

  function updateScores() {
    $('score-red').textContent  = scores.red  || 0;
    $('score-gold').textContent = scores.gold || 0;
  }

  function setBanner(text) {
    const b = $('pn-banner');
    if (!b) return;
    b.innerHTML = text;
    b.classList.remove('flash');
    void b.offsetWidth;
    b.classList.add('flash');
  }

  // Spawn `count` overlapping stick strikes on the given team's tiger.
  function spawnStrikes(team, count) {
    if (gameOver) return;
    MochiSounds.thwack && MochiSounds.thwack();
    const stickFx = $('stick-fx-' + team);
    const wrap = $('tiger-' + team + '-wrap');
    if (!stickFx || !wrap) return;
    for (let i = 0; i < count; i++) {
      // Each strike: stick flies in, tiger shakes briefly
      const stick = document.createElement('div');
      stick.className = 'pn-stick ' + team;
      stick.textContent = team === 'red' ? '🥢' : '🏹';
      // Random origin + slight delay so multiple taps look like a flurry
      stick.style.animationDelay = (i * 60) + 'ms';
      stickFx.appendChild(stick);
      setTimeout(() => stick.remove(), 750 + i * 60);
    }
    wrap.classList.remove('shake');
    void wrap.offsetWidth;
    wrap.classList.add('shake');
  }

  // When a tiger breaks: explosion of candy + prizes from that side.
  function burstCandy(team) {
    const layer = $('pn-fx-layer');
    const wrap = $('tiger-' + team + '-wrap');
    if (!layer || !wrap) return;
    // Hide the actual tiger emoji (it's burst)
    const tiger = $('tiger-' + team);
    if (tiger) tiger.style.opacity = '0';
    const rect = wrap.getBoundingClientRect();
    const stageRect = layer.getBoundingClientRect();
    const cx = rect.left - stageRect.left + rect.width / 2;
    const cy = rect.top  - stageRect.top  + rect.height / 2;
    const candies = ['🍬', '🍭', '🍫', '🧧', '💰', '🪙', '🎁', '🥮', '🏮'];
    for (let i = 0; i < 38; i++) {
      const p = document.createElement('div');
      p.className = 'pn-burst-prize';
      p.textContent = candies[i % candies.length];
      const angle = (Math.PI * 2 * i) / 38 + Math.random() * 0.3;
      const dist = 300 + Math.random() * 240;
      p.style.left = cx + 'px';
      p.style.top = cy + 'px';
      p.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
      p.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
      p.style.animationDuration = (1.4 + Math.random() * 0.8) + 's';
      layer.appendChild(p);
      setTimeout(() => p.remove(), 2400);
    }
    // Loot tray collects some candies
    for (let i = 0; i < 16; i++) {
      const c = candies[Math.floor(Math.random() * candies.length)];
      if (team === 'red') lootRed.push(c);
      else lootGold.push(c);
    }
    setTimeout(renderLoot, 700);
  }

  function renderLoot() {
    const r = $('loot-red');
    const g = $('loot-gold');
    if (r) r.innerHTML = lootRed.slice(-40).map((i) => `<span>${i}</span>`).join('');
    if (g) g.innerHTML = lootGold.slice(-40).map((i) => `<span>${i}</span>`).join('');
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
      const teamEmoji = p.team === 'red' ? '🥢' : '🏹';
      row.innerHTML = `
        <span class="lb-rank">${medal}</span>
        <span class="lb-name">${teamEmoji} ${escapeHtml(p.name)}</span>
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
      c.textContent = ['🥢', '🏹', '🍬', '🧧', '🎁'][i % 5];
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

  socket.on('disconnect', () => console.log('[host-pinata] disconnected'));
  socket.on('connect', () => console.log('[host-pinata] connected'));
  socket.on('host-left', () => console.warn('[host-pinata] host-left'));
})();
