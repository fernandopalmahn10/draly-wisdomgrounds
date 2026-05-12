// Piñata Tigre — host view.
// Lobby is shared with the other team-vs-team games. Once active, this view
// shows a swinging tiger piñata with HP, mirrors the current race question,
// and animates "smack" hits + prize drops as players land swings.
(function () {
  const socket = io();
  let pin = null;
  let state = null;
  let timerInterval = null;
  let urgentTriggered = false;

  let hp = 100;
  let maxHp = 100;
  let scores = { red: 0, gold: 0 };
  let lootRed = [];
  let lootGold = [];

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
    hp = maxHp;
    lootRed = [];
    lootGold = [];
    renderLoot();
    setHpBar();
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
    hp = data.hp;
    maxHp = data.maxHp;
    scores = data.teamScores || { red: 0, gold: 0 };
    lootRed = [];
    lootGold = [];
    setHpBar();
    updateScores();
    renderLoot();
    setBanner('¡Comienza la batalla! 战斗开始');
    $('pn-question').style.display = 'none';
  });

  socket.on('pn:question', ({ text, hp: serverHp }) => {
    if (typeof serverHp === 'number') {
      hp = serverHp;
      setHpBar();
    }
    setBanner('🗣 ¿Quién responde primero?');
    const qEl = $('pn-question');
    qEl.textContent = text;
    qEl.style.display = 'block';
    qEl.classList.remove('won');
    MochiSounds.questionAppear && MochiSounds.questionAppear();
  });

  socket.on('pn:race-won', ({ team, playerName, correctText }) => {
    const teamEmoji = team === 'red' ? '🥢' : '🏹';
    setBanner(`${teamEmoji} ¡${escapeHtml(playerName)} respondió primero! Cargando golpe…`);
    const qEl = $('pn-question');
    qEl.textContent = `✓ ${correctText}`;
    qEl.classList.add('won');
    MochiSounds.correct && MochiSounds.correct();
  });

  socket.on('pn:hit', ({ team, playerName, power, label, dmg, hp: serverHp, teamScores, prizeIcon }) => {
    hp = serverHp;
    if (teamScores) scores = teamScores;
    setHpBar();
    updateScores();
    playSwingFx(team, label, dmg);
    dropPrize(team, prizeIcon);
    const labelText =
      label === 'crit' ? '💥 ¡CRÍTICO!' :
      label === 'weak' ? '😅 Golpe débil' :
      '👊 Buen golpe';
    setBanner(`${labelText} · ${escapeHtml(playerName)} hizo ${dmg} de daño`);
    if (label === 'crit') {
      MochiSounds.populate && MochiSounds.populate(team);
    } else {
      MochiSounds.populate && MochiSounds.populate(team);
    }
  });

  socket.on('pn:broken', ({ teamScores }) => {
    if (teamScores) scores = teamScores;
    updateScores();
    setBanner('💥💥 ¡LA PIÑATA SE ROMPIÓ! 老虎破了！');
    burstPrizes();
    MochiSounds.winFanfare && MochiSounds.winFanfare();
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
      if (narr) narr.innerHTML = `🥢 <span class="red-team">Equipo Bastón</span> destrozó la piñata con <strong>${r}</strong> pts — ${gap > 50 ? 'una paliza 🔥' : gap > 20 ? 'una victoria sólida 💪' : 'un duelo reñido ⚔️'}.`;
      launchConfetti(['#ff5a66', '#d92e3a', '#ffd57a']);
    } else if (data.winner === 'gold') {
      $('win-banner').textContent = '🏹 ¡Equipo Arco gana!';
      $('win-banner').className = 'winner-banner gold';
      $('win-emoji').textContent = '🏹';
      MochiSounds.winMusic && MochiSounds.winMusic();
      setTimeout(() => MochiSounds.winFanfare && MochiSounds.winFanfare(), 400);
      if (narr) narr.innerHTML = `🏹 <span class="gold-team">Equipo Arco</span> destrozó la piñata con <strong>${g}</strong> pts — ${gap > 50 ? 'una paliza 🔥' : gap > 20 ? 'una victoria sólida 💪' : 'un duelo reñido ⚔️'}.`;
      launchConfetti(['#ffd57a', '#e8b14a', '#ff5a66']);
    } else {
      $('win-banner').textContent = '🤝 ¡Empate!';
      $('win-banner').className = 'winner-banner tie';
      $('win-emoji').textContent = '⚖️';
      MochiSounds.tieMusic && MochiSounds.tieMusic();
      if (narr) narr.innerHTML = `🤝 Ambos equipos hicieron el mismo daño: <strong>${r}</strong> pts.`;
    }
    renderLeaderboard(data);
    setTimeout(() => launchConfetti(data.winner === 'red'
      ? ['#ff5a66', '#d92e3a', '#ffd57a']
      : ['#ffd57a', '#e8b14a', '#ff5a66']), 4000);
  });

  function setHpBar() {
    const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
    $('pn-hp-fill').style.width = pct + '%';
    $('pn-hp-label').textContent = `HP ${hp} / ${maxHp}`;
    // Color shifts from gold → orange → red as HP drains
    const fill = $('pn-hp-fill');
    if (pct > 66) fill.className = 'pn-hp-fill ok';
    else if (pct > 33) fill.className = 'pn-hp-fill warn';
    else fill.className = 'pn-hp-fill danger';
    // Show cracks proportional to damage
    const cracks = $('pn-cracks');
    cracks.innerHTML = '';
    const damageRatio = 1 - (hp / maxHp);
    const cracksToShow = Math.floor(damageRatio * 8);
    for (let i = 0; i < cracksToShow; i++) {
      const c = document.createElement('div');
      c.className = 'pn-crack pn-crack-' + (i % 4);
      c.style.left = (10 + Math.random() * 80) + '%';
      c.style.top = (10 + Math.random() * 75) + '%';
      c.style.transform = `rotate(${Math.floor(Math.random() * 90 - 45)}deg)`;
      cracks.appendChild(c);
    }
  }

  function updateScores() {
    $('score-red').textContent = scores.red || 0;
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

  function playSwingFx(team, label, dmg) {
    const stickFx = $('pn-stick-fx');
    const stick = document.createElement('div');
    stick.className = 'pn-stick ' + team + (label === 'crit' ? ' crit' : '');
    stick.textContent = team === 'red' ? '🥢' : '🏹';
    stickFx.appendChild(stick);
    setTimeout(() => stick.remove(), 700);

    const wrap = $('pn-tiger-wrap');
    wrap.classList.remove('shake', 'shake-crit');
    void wrap.offsetWidth;
    wrap.classList.add(label === 'crit' ? 'shake-crit' : 'shake');

    // Damage popup
    const pop = document.createElement('div');
    pop.className = 'pn-dmg-popup ' + team + (label === 'crit' ? ' crit' : '');
    pop.textContent = `-${dmg}`;
    stickFx.appendChild(pop);
    setTimeout(() => pop.remove(), 900);
  }

  function dropPrize(team, icon) {
    const layer = $('pn-fx-layer');
    const prize = document.createElement('div');
    prize.className = 'pn-prize-fly ' + team;
    prize.textContent = icon || '🎁';
    // Start near tiger center, end in that team's loot tray corner
    layer.appendChild(prize);
    requestAnimationFrame(() => {
      prize.classList.add('fly');
    });
    setTimeout(() => {
      prize.remove();
      if (team === 'red') lootRed.push(icon);
      else lootGold.push(icon);
      renderLoot();
    }, 900);
  }

  function renderLoot() {
    const r = $('pn-loot-red');
    const g = $('pn-loot-gold');
    if (r) r.innerHTML = lootRed.slice(-30).map((i) => `<span>${i}</span>`).join('');
    if (g) g.innerHTML = lootGold.slice(-30).map((i) => `<span>${i}</span>`).join('');
  }

  function burstPrizes() {
    const layer = $('pn-fx-layer');
    for (let i = 0; i < 24; i++) {
      const p = document.createElement('div');
      p.className = 'pn-burst-prize';
      p.textContent = ['🎁', '💰', '🪙', '🍬', '🥮', '🧧', '🏮'][i % 7];
      const angle = (Math.PI * 2 * i) / 24;
      const dist = 280 + Math.random() * 180;
      p.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
      p.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
      layer.appendChild(p);
      setTimeout(() => p.remove(), 1800);
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
      c.textContent = ['🥢', '🏹', '🎁', '🧧', '✨'][i % 5];
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
