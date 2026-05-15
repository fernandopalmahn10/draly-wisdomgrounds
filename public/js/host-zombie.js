// Zombie Escape (末日逃生) — host view.
// Two side-scrolling lanes, one per team. Each lane: survivor on the left,
// zombie horde behind them, safe-zone helipad on the right. Every player tap
// during a sprint window pushes their team's survivor right; wrong answers
// pull the zombies forward. First survivor to the safe zone wins; caught = lose.
(function () {
  const socket = io();
  let pin = null;
  let state = null;
  let timerInterval = null;
  let urgentTriggered = false;

  let trackLen = 200;
  let survRed = 0, survGold = 0;
  let zombRed = -60, zombGold = -60;
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
  if (!chosenSetId) location.href = '/sets.html?game=zombie';

  socket.emit('host:create', { gameType: 'zombie' }, ({ pin: p }) => {
    pin = p;
    $('pin-display').textContent = p;
    if ($('active-pin-display')) $('active-pin-display').textContent = p;
    $('join-url').textContent = `${location.origin}/?pin=${p}`;
    document.title = `Zombie Escape · ${p}`;
    socket.emit('host:load-set', { pin, setId: chosenSetId }, (resp) => {
      if (!resp.ok) {
        alert('No se pudo cargar el set: ' + (resp.error || 'desconocido'));
        location.href = '/sets.html?game=zombie';
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
    survRed = survGold = 0;
    zombRed = zombGold = -60;
    gameOver = false;
    updateBoard();
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
        numEl.textContent = '¡跑!';
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

  socket.on('zb:init', (data) => {
    trackLen = data.trackLen || 200;
    scores = data.teamScores || { red: 0, gold: 0 };
    survRed = 0; survGold = 0;
    zombRed = -60; zombGold = -60;
    gameOver = false;
    updateBoard();
    setBanner('¡A correr! 跑！');
  });

  socket.on('zb:state', ({ survRed: sR, survGold: sG, zombRed: zR, zombGold: zG, trackLen: tL }) => {
    if (typeof sR === 'number') survRed = sR;
    if (typeof sG === 'number') survGold = sG;
    if (typeof zR === 'number') zombRed = zR;
    if (typeof zG === 'number') zombGold = zG;
    if (typeof tL === 'number') trackLen = tL;
    updateBoard();
  });

  socket.on('tap-fx', ({ red, gold }) => {
    if (red && red > 0)  spawnSprintFx('red',  Math.min(red, 4));
    if (gold && gold > 0) spawnSprintFx('gold', Math.min(gold, 4));
  });

  socket.on('zb:caught', ({ team }) => {
    gameOver = true;
    setBanner(`☠️ ¡La horda alcanzó al equipo ${team === 'red' ? 'Rojo' : 'Dorado'}!`);
    const lane = $('zb-lane-' + team);
    if (lane) lane.classList.add('caught');
    MochiSounds.wrong && MochiSounds.wrong();
  });

  socket.on('zb:escaped', ({ team }) => {
    gameOver = true;
    const emoji = team === 'red' ? '🏃' : '🏃‍♀️';
    setBanner(`🚁 ¡${emoji} El equipo ${team === 'red' ? 'Rojo' : 'Dorado'} escapó a la zona segura!`);
    const surv = $('zb-survivor-' + team);
    if (surv) surv.classList.add('escaped');
    MochiSounds.winFanfare && MochiSounds.winFanfare();
    burstHeloFx(team);
  });

  socket.on('game-end', (data) => {
    if (timerInterval) clearInterval(timerInterval);
    MochiSounds.stopMusic();
    showScreen('win');
    $('final-red').textContent = Math.round(survRed);
    $('final-gold').textContent = Math.round(survGold);
    const narr = $('win-narration');
    if (data.winner === 'red' || (survRed > survGold && !data.winner)) {
      $('win-banner').textContent = '🏃 ¡Equipo Rojo escapó primero!';
      $('win-banner').className = 'winner-banner red';
      $('win-emoji').textContent = '🚁';
      MochiSounds.winMusic && MochiSounds.winMusic();
      setTimeout(() => MochiSounds.winFanfare && MochiSounds.winFanfare(), 400);
      if (narr) narr.innerHTML = `🚁 El <span class="red-team">Equipo Rojo</span> llegó a la zona segura con <strong>${Math.round(survRed)}</strong> m recorridos.`;
      launchConfetti(['#ff5a66', '#d92e3a', '#ffd57a']);
    } else if (data.winner === 'gold' || (survGold > survRed && !data.winner)) {
      $('win-banner').textContent = '🏃‍♀️ ¡Equipo Dorado escapó primero!';
      $('win-banner').className = 'winner-banner gold';
      $('win-emoji').textContent = '🚁';
      MochiSounds.winMusic && MochiSounds.winMusic();
      setTimeout(() => MochiSounds.winFanfare && MochiSounds.winFanfare(), 400);
      if (narr) narr.innerHTML = `🚁 El <span class="gold-team">Equipo Dorado</span> llegó a la zona segura con <strong>${Math.round(survGold)}</strong> m recorridos.`;
      launchConfetti(['#ffd57a', '#e8b14a', '#ff5a66']);
    } else {
      $('win-banner').textContent = '🤝 ¡Empate!';
      $('win-banner').className = 'winner-banner tie';
      $('win-emoji').textContent = '⚖️';
      MochiSounds.tieMusic && MochiSounds.tieMusic();
      if (narr) narr.innerHTML = `🤝 Ambos sobrevivientes lograron <strong>${Math.round(survRed)}</strong> m.`;
    }
    renderLeaderboard(data);
  });

  function updateBoard() {
    $('dist-red').textContent = Math.round(survRed);
    $('dist-gold').textContent = Math.round(survGold);
    // Position survivors and zombies along their lanes (in % of track width)
    setLanePositions('red', survRed, zombRed);
    setLanePositions('gold', survGold, zombGold);
  }

  function setLanePositions(team, surv, zomb) {
    const sEl = $('zb-survivor-' + team);
    const zEl = $('zb-zombies-' + team);
    if (sEl) sEl.style.left = clampPct(surv) + '%';
    if (zEl) zEl.style.left = clampPct(zomb) + '%';
  }
  function clampPct(dist) {
    return Math.max(0, Math.min(100, (dist / trackLen) * 100));
  }

  function spawnSprintFx(team, count) {
    if (gameOver) return;
    const sEl = $('zb-survivor-' + team);
    if (!sEl) return;
    sEl.classList.remove('sprinting');
    void sEl.offsetWidth;
    sEl.classList.add('sprinting');
    MochiSounds.whoosh && MochiSounds.whoosh();
    // Dust puff behind the runner
    const lane = $('zb-lane-' + team);
    if (lane) {
      for (let i = 0; i < count; i++) {
        const puff = document.createElement('div');
        puff.className = 'zb-puff';
        puff.textContent = '💨';
        puff.style.left = sEl.style.left || '0%';
        puff.style.animationDelay = (i * 80) + 'ms';
        lane.appendChild(puff);
        setTimeout(() => puff.remove(), 700 + i * 80);
      }
    }
  }

  function burstHeloFx(team) {
    const lane = $('zb-lane-' + team);
    if (!lane) return;
    for (let i = 0; i < 18; i++) {
      const s = document.createElement('div');
      s.className = 'zb-spark';
      s.textContent = ['✨', '🎉', '🎊', '⭐', '🚁'][i % 5];
      s.style.left = (60 + Math.random() * 40) + '%';
      s.style.top = (10 + Math.random() * 60) + '%';
      s.style.animationDelay = (i * 60) + 'ms';
      lane.appendChild(s);
      setTimeout(() => s.remove(), 1600);
    }
  }

  function setBanner(text) {
    const b = $('zb-banner');
    if (!b) return;
    b.textContent = text;
    b.classList.remove('flash');
    void b.offsetWidth;
    b.classList.add('flash');
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
      const teamEmoji = p.team === 'red' ? '🏃' : '🏃‍♀️';
      row.innerHTML = `
        <span class="lb-rank">${medal}</span>
        <span class="lb-name">${p.avatar ? p.avatar + " " : ""}${teamEmoji} ${escapeHtml(p.name)}</span>
        <span class="lb-score">${p.score} pasos</span>
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
      const avatar = p.avatar ? `<span class="chip-avatar">${p.avatar}</span>` : '';
      chip.innerHTML = `${avatar}<span>${escapeHtml(p.name)}</span><span class="swap-arrow">↔</span>`;
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
      c.textContent = ['🚁', '🏃', '🏃‍♀️', '🧟', '✨'][i % 5];
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

  socket.on('disconnect', () => console.log('[host-zombie] disconnected'));
  socket.on('connect', () => console.log('[host-zombie] connected'));
  socket.on('host-left', () => console.warn('[host-zombie] host-left'));
})();
