// Shéi Shì? · Identity Detective — host driver.
// Players solve identity puzzles on their phones; host shows lobby +
// team scoreboard + minimal active-state hero (per the user's
// "player phone is the cool screen" rule).
(function () {
  const socket = io();
  let pin = null;
  let state = null;
  let timerInterval = null;
  let urgentTriggered = false;
  let scores = { red: 0, gold: 0 };
  let gameOver = false;

  const $ = (id) => document.getElementById(id);
  $('mute-btn').addEventListener('click', () => {
    const muted = window.toggleMute();
    $('mute-btn').textContent = muted ? '🔇 Off' : '🔊 On';
  });
  document.addEventListener('click', () => window.unlockAudio && window.unlockAudio(), { once: true });
  window.addEventListener('music-started', (e) => {
    const chip = $('music-chip');
    const name = $('music-chip-name');
    if (!chip) return;
    if (name) name.textContent = 'Shéi Shì · ' + (e.detail.bpm || '') + 'bpm';
    chip.classList.remove('hidden');
    setTimeout(() => chip.classList.add('hidden'), 3500);
  });

  socket.emit('host:create', { gameType: 'identity' }, ({ pin: p }) => {
    pin = p;
    $('pin-display').textContent = p;
    if ($('active-pin-display')) $('active-pin-display').textContent = p;
    $('join-url').textContent = `${location.origin}/?pin=${p}`;
    document.title = `🕵️ Shéi Shì · ${p}`;
    MochiSounds.correct && MochiSounds.correct();
    setTimeout(updateStartBtn, 100);
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
    if (confirm('¿Terminar la investigación?')) socket.emit('host:end-now', { pin });
  });
  $('play-again-btn').addEventListener('click', () => {
    if (MochiSounds.stopEndMusic) MochiSounds.stopEndMusic();
    socket.emit('host:reset', { pin });
    showScreen('lobby');
    scores = { red: 0, gold: 0 };
    gameOver = false;
    updateScoreboard();
  });

  function updateStartBtn() {
    const btn = $('start-btn');
    if (!state) { btn.disabled = true; return; }
    btn.disabled = !(Object.keys(state.players || {}).length > 0);
  }

  socket.on('state', (s) => {
    state = s;
    if (s.state === 'lobby') {
      renderLobbyPlayers(s.players);
      updateStartBtn();
    }
    if (s.teamScores) { scores = s.teamScores; updateScoreboard(); }
    if (s.state === 'active' && s.endsAt && !timerInterval) startTimer();
  });

  socket.on('countdown', () => {
    showScreen('countdown');
    if (window.unlockAudio) window.unlockAudio();
    MochiSounds.startGameTheme && MochiSounds.startGameTheme('identity');
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
        numEl.textContent = '¡A INVESTIGAR!';
        numEl.style.animation = 'none';
        numEl.offsetHeight;
        numEl.style.animation = '';
        MochiSounds.go && MochiSounds.go();
        setTimeout(() => { showScreen('active'); startTimer(); }, 800);
      }
    };
    tick();
  });

  socket.on('game-end', (data) => {
    if (timerInterval) clearInterval(timerInterval);
    gameOver = true;
    MochiSounds.stopMusic && MochiSounds.stopMusic();
    showScreen('win');
    const r = data.teamScores.red || 0;
    const g = data.teamScores.gold || 0;
    $('final-red').textContent = r;
    $('final-gold').textContent = g;
    const narr = $('win-narration');
    if (data.winner === 'red') {
      $('win-banner').textContent = '🕵️ ¡Los Detectives Rojos ganaron!';
      $('win-banner').className = 'winner-banner red';
      $('win-emoji').textContent = '🕵️';
      MochiSounds.winMusic && MochiSounds.winMusic();
      setTimeout(() => MochiSounds.winFanfare && MochiSounds.winFanfare(), 400);
      if (narr) narr.innerHTML = `🕵️ Los <span class="red-team">Rojos</span> resolvieron más casos. <strong>${r}</strong> pts.`;
      launchConfetti();
    } else if (data.winner === 'gold') {
      $('win-banner').textContent = '🕵️‍♀️ ¡Los Detectives Dorados ganaron!';
      $('win-banner').className = 'winner-banner gold';
      $('win-emoji').textContent = '🕵️‍♀️';
      MochiSounds.winMusic && MochiSounds.winMusic();
      setTimeout(() => MochiSounds.winFanfare && MochiSounds.winFanfare(), 400);
      if (narr) narr.innerHTML = `🕵️‍♀️ Los <span class="gold-team">Dorados</span> resolvieron más casos. <strong>${g}</strong> pts.`;
      launchConfetti();
    } else {
      $('win-banner').textContent = '🔍 ¡Empate de detectives!';
      $('win-banner').className = 'winner-banner tie';
      $('win-emoji').textContent = '⚖️';
      MochiSounds.tieMusic && MochiSounds.tieMusic();
      if (narr) narr.innerHTML = `Ambos equipos resolvieron <strong>${r}</strong> casos.`;
    }
    renderLeaderboard(data);
  });

  function updateScoreboard() {
    if ($('score-red'))  $('score-red').textContent  = scores.red  || 0;
    if ($('score-gold')) $('score-gold').textContent = scores.gold || 0;
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
      const teamEmoji = p.team === 'red' ? '🕵️' : '🕵️‍♀️';
      row.innerHTML = `
        <span class="lb-rank">${medal}</span>
        <span class="lb-name">${p.avatar ? p.avatar + ' ' : ''}${teamEmoji} ${escapeHtml(p.name)}</span>
        <span class="lb-score">${p.score} pts</span>
      `;
      lb.appendChild(row);
    });
  }
  function renderLobbyPlayers(playersMap) {
    const red = $('players-red');
    const gold = $('players-gold');
    if (!red || !gold) return;
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
  function launchConfetti() {
    const icons = ['🕵️', '🔍', '🎯', '⭐', '🏆', '🤝'];
    for (let i = 0; i < 70; i++) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + '%';
      c.style.animationDelay = Math.random() * 1.5 + 's';
      c.style.animationDuration = 2 + Math.random() * 2 + 's';
      c.textContent = icons[i % icons.length];
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
})();
