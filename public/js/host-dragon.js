// Dragon's Eye (画龙点睛) — host view.
// One big dragon image; each correct vocab answer lands a colored dot on it
// from the player's team. Eye-hits flash + boost score. First team to 5 eye
// hits wakes the dragon and wins.
(function () {
  const socket = io();
  let pin = null;
  let state = null;
  let timerInterval = null;
  let urgentTriggered = false;

  let scores = { red: 0, gold: 0 };
  let eyes = { red: 0, gold: 0 };
  let eyeHitsToWin = 5;
  let awakened = false;

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
    document.title = `Ojo del Dragón · ${p}`;
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
    clearDots();
    scores = { red: 0, gold: 0 };
    eyes = { red: 0, gold: 0 };
    awakened = false;
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
        numEl.textContent = '¡龙!';
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
    if (data.eyeHitsToWin) eyeHitsToWin = data.eyeHitsToWin;
    scores = data.teamScores || { red: 0, gold: 0 };
    eyes = { red: 0, gold: 0 };
    awakened = false;
    clearDots();
    updateScores();
    setBanner('¡Comienza la batalla! 战斗开始');
  });

  socket.on('dragon:dot', ({ x, y, team, isEye, playerName, points, eyeHitsRed, eyeHitsGold, teamScores }) => {
    if (teamScores) scores = teamScores;
    eyes.red = eyeHitsRed || 0;
    eyes.gold = eyeHitsGold || 0;
    updateScores();
    spawnDot(x, y, team, isEye);
    if (isEye) {
      flashEye(x);
      setBanner(`👁 ¡${escapeHtml(playerName)} acertó en el OJO! +${points}`);
      MochiSounds.winFanfare && MochiSounds.winFanfare();
    } else {
      setBanner(`✒️ ${escapeHtml(playerName)} pintó un punto (+${points})`);
      MochiSounds.populate && MochiSounds.populate(team);
    }
  });

  socket.on('dragon:awakened', ({ team }) => {
    awakened = true;
    const emoji = team === 'red' ? '✒️' : '🖌️';
    setBanner(`🐉 ¡EL DRAGÓN DESPERTÓ! ${emoji} ¡${team === 'red' ? 'Pincel' : 'Tinta'} ganó!`);
    const dragon = $('dr-dragon-wrap');
    if (dragon) {
      dragon.classList.add('awakened');
    }
    MochiSounds.winFanfare && MochiSounds.winFanfare();
    setTimeout(() => MochiSounds.winMusic && MochiSounds.winMusic(), 500);
    burstFireworks();
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
      $('win-banner').textContent = '✒️ ¡Equipo Pincel despertó al dragón!';
      $('win-banner').className = 'winner-banner red';
      $('win-emoji').textContent = '🐉';
      MochiSounds.winMusic && MochiSounds.winMusic();
      setTimeout(() => MochiSounds.winFanfare && MochiSounds.winFanfare(), 400);
      if (narr) narr.innerHTML = `🐉 <span class="red-team">Equipo Pincel</span> hizo despertar al dragón con <strong>${r}</strong> puntos — ${gap > 30 ? 'una pintura maestra 🎨' : gap > 10 ? 'una victoria sólida 💪' : 'un duelo reñido ⚔️'}.`;
      launchConfetti(['#ff5a66', '#d92e3a', '#ffd57a']);
    } else if (data.winner === 'gold') {
      $('win-banner').textContent = '🖌️ ¡Equipo Tinta despertó al dragón!';
      $('win-banner').className = 'winner-banner gold';
      $('win-emoji').textContent = '🐉';
      MochiSounds.winMusic && MochiSounds.winMusic();
      setTimeout(() => MochiSounds.winFanfare && MochiSounds.winFanfare(), 400);
      if (narr) narr.innerHTML = `🐉 <span class="gold-team">Equipo Tinta</span> hizo despertar al dragón con <strong>${g}</strong> puntos — ${gap > 30 ? 'una pintura maestra 🎨' : gap > 10 ? 'una victoria sólida 💪' : 'un duelo reñido ⚔️'}.`;
      launchConfetti(['#ffd57a', '#e8b14a', '#ff5a66']);
    } else {
      $('win-banner').textContent = '🤝 ¡Empate!';
      $('win-banner').className = 'winner-banner tie';
      $('win-emoji').textContent = '⚖️';
      MochiSounds.tieMusic && MochiSounds.tieMusic();
      if (narr) narr.innerHTML = `🤝 Ambos pintores empataron con <strong>${r}</strong> puntos.`;
    }
    renderLeaderboard(data);
    setTimeout(() => launchConfetti(data.winner === 'red'
      ? ['#ff5a66', '#d92e3a', '#ffd57a']
      : ['#ffd57a', '#e8b14a', '#ff5a66']), 4000);
  });

  function spawnDot(x, y, team, isEye) {
    const layer = $('dr-dot-layer');
    if (!layer) return;
    const dot = document.createElement('div');
    dot.className = 'dr-dot ' + team + (isEye ? ' eye-hit' : '');
    dot.style.left = (x * 100) + '%';
    dot.style.top = (y * 100) + '%';
    layer.appendChild(dot);
  }

  function flashEye(x) {
    // Pick which eye glow to flash based on x: left eye ~0.42, right ~0.55
    const glow = x < 0.5 ? $('dr-eye-glow-l') : $('dr-eye-glow-r');
    if (!glow) return;
    glow.classList.remove('flash');
    void glow.offsetWidth;
    glow.classList.add('flash');
  }

  function clearDots() {
    const layer = $('dr-dot-layer');
    if (layer) layer.innerHTML = '';
  }

  function updateScores() {
    $('score-red').textContent = scores.red || 0;
    $('score-gold').textContent = scores.gold || 0;
    if ($('eyes-red')) $('eyes-red').textContent = eyes.red || 0;
    if ($('eyes-gold')) $('eyes-gold').textContent = eyes.gold || 0;
  }

  function setBanner(text) {
    const b = $('dr-banner');
    if (!b) return;
    b.textContent = text;
    b.classList.remove('flash');
    void b.offsetWidth;
    b.classList.add('flash');
  }

  function burstFireworks() {
    // Big celebratory burst of stars from the dragon
    const wrap = $('dr-dragon-wrap');
    if (!wrap) return;
    for (let i = 0; i < 30; i++) {
      const s = document.createElement('div');
      s.className = 'dr-firework';
      s.textContent = ['✨','🎆','⭐','🐉','🧧'][i % 5];
      const ang = (Math.PI * 2 * i) / 30 + Math.random() * 0.4;
      const dist = 240 + Math.random() * 200;
      s.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      s.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
      wrap.appendChild(s);
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
      const teamEmoji = p.team === 'red' ? '✒️' : '🖌️';
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
      c.textContent = ['🐉', '✒️', '🖌️', '🧧', '✨'][i % 5];
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
