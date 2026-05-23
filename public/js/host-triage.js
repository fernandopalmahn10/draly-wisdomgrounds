// Triage ER · 急诊室 — host view.
// Renders a 6-bed emergency room ward. Patients with ailments arrive into
// empty beds and their life bars tick down in real time. When a player
// (doctor) answers a vocab question correctly they pick WHICH PATIENT to
// treat on their phone — the host then plays the defib-zap + life-saved
// chime + EKG-stabilize animation on the chosen bed.
//
// Events from server:
//   tri:init             — initial state, 3 starter patients
//   tri:patient-arrived  — single new patient (walk-in)
//   tri:patient-treated  — a player saved a patient (which bed, team, points)
//   tri:patient-died     — a patient's life bar ran out
//   tri:event            — ambulance / code-blue / transfusion
//   tri:tick             — 4Hz life-HP refresh (smooth bars)
(function () {
  const socket = io();
  let pin = null;
  let state = null;
  let timerInterval = null;
  let urgentTriggered = false;

  let beds = 6;
  let lifeMax = 100;
  let patientsByBed = {};   // bedIdx → patient object
  let livesSavedRed = 0;
  let livesSavedGold = 0;
  let patientsDied = 0;
  let scores = { red: 0, gold: 0 };
  let gameOver = false;
  let ambienceTimer = null;
  let lastEventBannerAt = 0;

  const $ = (id) => document.getElementById(id);

  $('mute-btn').addEventListener('click', () => {
    const muted = window.toggleMute();
    $('mute-btn').textContent = muted ? '🔇 Off' : '🔊 On';
  });
  document.addEventListener('click', () => window.unlockAudio && window.unlockAudio(), { once: true });

  const params = new URLSearchParams(location.search);
  const chosenSetId = params.get('setId');
  if (!chosenSetId) location.href = '/sets.html?game=triage';

  socket.emit('host:create', { gameType: 'triage' }, ({ pin: p }) => {
    pin = p;
    $('pin-display').textContent = p;
    if ($('active-pin-display')) $('active-pin-display').textContent = p;
    $('join-url').textContent = `${location.origin}/?pin=${p}`;
    document.title = `🚑 Triage ER · ${p}`;
    socket.emit('host:load-set', { pin, setId: chosenSetId }, (resp) => {
      if (!resp.ok) {
        alert('No se pudo cargar el set: ' + (resp.error || 'desconocido'));
        location.href = '/sets.html?game=triage';
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
    if (confirm('¿Terminar el turno ahora?')) socket.emit('host:end-now', { pin });
  });
  $('play-again-btn').addEventListener('click', () => {
    if (MochiSounds.stopEndMusic) MochiSounds.stopEndMusic();
    socket.emit('host:reset', { pin });
    showScreen('lobby');
    patientsByBed = {};
    livesSavedRed = 0;
    livesSavedGold = 0;
    patientsDied = 0;
    scores = { red: 0, gold: 0 };
    gameOver = false;
    if (ambienceTimer) { clearInterval(ambienceTimer); ambienceTimer = null; }
    updateHud();
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
        numEl.textContent = '¡A SALVAR!';
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

  // === ER WARD INIT ===
  socket.on('tri:init', (data) => {
    beds = data.beds || 6;
    lifeMax = data.lifeMax || 100;
    patientsByBed = {};
    (data.patients || []).forEach((p) => { patientsByBed[p.bedIdx] = p; });
    livesSavedRed = data.livesSavedRed || 0;
    livesSavedGold = data.livesSavedGold || 0;
    patientsDied = 0;
    scores = data.teamScores || { red: 0, gold: 0 };
    gameOver = false;
    renderRosterSidebars(data.players);
    renderBedGrid();
    updateHud();
    setEventBanner('🏥 ¡Sala de Emergencias ABIERTA!', 'open');
    MochiSounds.battleHorn && MochiSounds.battleHorn();
    startAmbientHeartbeat();
  });

  socket.on('tri:patient-arrived', (data) => {
    const p = data.patient;
    if (!p) return;
    patientsByBed[p.bedIdx] = p;
    spawnPatientInBed(p);
    if (p.critical) {
      MochiSounds.codeBlue && MochiSounds.codeBlue();
    } else {
      MochiSounds.patientArrive && MochiSounds.patientArrive();
    }
  });

  socket.on('tri:patient-treated', (data) => {
    const bed = $('tri-bed-' + data.bedIdx);
    if (!bed) return;
    // Defib zap VFX + life-saved chime + bed flashes the team color
    spawnDefibZapFx(bed);
    bed.classList.add('treated', 'team-' + data.team);
    if (data.critical) bed.classList.add('treated-critical');
    MochiSounds.defibZap && MochiSounds.defibZap();
    setTimeout(() => MochiSounds.lifeSaved && MochiSounds.lifeSaved(), 280);
    // Floating "+10 / +25 pts" toast from the bed
    spawnPointToast(bed, '+' + (data.points || 10), data.team, data.critical);
    // Update HUD counters
    livesSavedRed = data.livesSavedRed != null ? data.livesSavedRed : livesSavedRed;
    livesSavedGold = data.livesSavedGold != null ? data.livesSavedGold : livesSavedGold;
    scores = data.teamScores || scores;
    delete patientsByBed[data.bedIdx];
    // Animate the patient leaving — heart-rate flatline calm, then bed empties
    setTimeout(() => {
      bed.classList.remove('treated', 'team-red', 'team-gold', 'treated-critical', 'occupied', 'critical');
      const inner = bed.querySelector('.tri-bed-inner');
      if (inner) {
        inner.innerHTML = bedEmptyMarkup();
      }
    }, 1200);
    // Update roster scoring
    bumpRosterScore(data.playerName, data.team, data.points);
    updateHud();
    if (data.critical && data.team) {
      setEventBanner('⚡ ¡VIDA CRÍTICA SALVADA por ' + escapeHtml(data.playerName || 'Doctor') + '!', 'critical');
    }
  });

  socket.on('tri:patient-died', (data) => {
    const bed = $('tri-bed-' + data.bedIdx);
    if (!bed) return;
    bed.classList.add('died');
    MochiSounds.flatlineAlarm && MochiSounds.flatlineAlarm();
    spawnFlatlineGhost(bed, data.icon || '😞');
    patientsDied = data.patientsDied || (patientsDied + 1);
    delete patientsByBed[data.bedIdx];
    setTimeout(() => {
      bed.classList.remove('died', 'occupied', 'critical');
      const inner = bed.querySelector('.tri-bed-inner');
      if (inner) inner.innerHTML = bedEmptyMarkup();
    }, 1700);
    updateHud();
  });

  socket.on('tri:event', (data) => {
    if (data.kind === 'ambulance') {
      setEventBanner('🚑 ¡AMBULANCIA — nuevos pacientes!', 'ambulance');
      animateAmbulanceArrival();
      (data.arrivals || []).forEach((p, i) => {
        setTimeout(() => {
          patientsByBed[p.bedIdx] = p;
          spawnPatientInBed(p);
        }, 700 + i * 350);
      });
      MochiSounds.ambulanceSiren && MochiSounds.ambulanceSiren();
    } else if (data.kind === 'code-blue') {
      const bed = $('tri-bed-' + data.bedIdx);
      const patient = patientsByBed[data.bedIdx];
      if (patient) patient.critical = true;
      if (bed) {
        bed.classList.add('critical', 'just-flipped-critical');
        setTimeout(() => bed.classList.remove('just-flipped-critical'), 1800);
        // Swap the patient's icon to the alarm one (server already toggled critical)
        const iconEl = bed.querySelector('.tri-patient-icon');
        if (iconEl && !iconEl.querySelector('.tri-crit-halo')) {
          const halo = document.createElement('span');
          halo.className = 'tri-crit-halo';
          halo.textContent = '🚨';
          iconEl.appendChild(halo);
        }
      }
      setEventBanner('⚡ ¡CÓDIGO AZUL! Paciente crítico', 'code-blue');
      MochiSounds.codeBlue && MochiSounds.codeBlue();
    } else if (data.kind === 'transfusion') {
      setEventBanner('🩸 ¡TRANSFUSIÓN! Todos recuperan vida', 'transfusion');
      // Briefly highlight every occupied bed with a heal pulse
      document.querySelectorAll('.tri-bed.occupied').forEach((bed) => {
        bed.classList.add('healed');
        setTimeout(() => bed.classList.remove('healed'), 1500);
      });
      MochiSounds.transfusion && MochiSounds.transfusion();
    }
  });

  // 4Hz life-HP refresh — animates the life bars smoothly without spamming
  // per-patient events.
  socket.on('tri:tick', (data) => {
    (data.patients || []).forEach((p) => {
      const bed = $('tri-bed-' + p.bedIdx);
      if (!bed) return;
      const cur = patientsByBed[p.bedIdx];
      if (!cur) return;
      cur.lifeHp = p.lifeHp;
      const ratio = Math.max(0, Math.min(1, p.lifeHp / p.lifeMax));
      const fill = bed.querySelector('.tri-life-fill');
      if (fill) {
        fill.style.width = (ratio * 100) + '%';
        fill.classList.toggle('warn', ratio < 0.6 && ratio >= 0.3);
        fill.classList.toggle('danger', ratio < 0.3);
      }
      // Critical bed pulses harder as life drops
      bed.classList.toggle('low-life', ratio < 0.3);
    });
    if (data.livesSavedRed != null) livesSavedRed = data.livesSavedRed;
    if (data.livesSavedGold != null) livesSavedGold = data.livesSavedGold;
    if (data.patientsDied != null) patientsDied = data.patientsDied;
    updateHud();
  });

  socket.on('game-end', (data) => {
    if (timerInterval) clearInterval(timerInterval);
    if (ambienceTimer) { clearInterval(ambienceTimer); ambienceTimer = null; }
    gameOver = true;
    MochiSounds.stopMusic && MochiSounds.stopMusic();
    showScreen('win');
    // Win condition for triage = team with most lives saved, fallback to teamScores
    const r = livesSavedRed;
    const g = livesSavedGold;
    $('final-red').textContent = r;
    $('final-gold').textContent = g;
    const winner = r > g ? 'red' : (g > r ? 'gold' : 'tie');
    const narr = $('win-narration');
    if (winner === 'red') {
      $('win-banner').textContent = '🩺 ¡Los Doctores Rojos ganaron el turno!';
      $('win-banner').className = 'winner-banner red';
      $('win-emoji').textContent = '🏥';
      MochiSounds.winMusic && MochiSounds.winMusic();
      setTimeout(() => MochiSounds.winFanfare && MochiSounds.winFanfare(), 400);
      if (narr) narr.innerHTML = `🩺 Los <span class="red-team">Doctores Rojos</span> salvaron <strong>${r}</strong> vidas. <span style="color:var(--ink-dim);">(${patientsDied} 💔 perdidas)</span>`;
      launchConfetti(['#ff5a66', '#d92e3a', '#ffd57a']);
    } else if (winner === 'gold') {
      $('win-banner').textContent = '💉 ¡Los Doctores Dorados ganaron el turno!';
      $('win-banner').className = 'winner-banner gold';
      $('win-emoji').textContent = '🏥';
      MochiSounds.winMusic && MochiSounds.winMusic();
      setTimeout(() => MochiSounds.winFanfare && MochiSounds.winFanfare(), 400);
      if (narr) narr.innerHTML = `💉 Los <span class="gold-team">Doctores Dorados</span> salvaron <strong>${g}</strong> vidas. <span style="color:var(--ink-dim);">(${patientsDied} 💔 perdidas)</span>`;
      launchConfetti(['#ffd57a', '#e8b14a', '#ff5a66']);
    } else {
      $('win-banner').textContent = '🏥 ¡Empate en la sala!';
      $('win-banner').className = 'winner-banner tie';
      $('win-emoji').textContent = '⚖️';
      MochiSounds.tieMusic && MochiSounds.tieMusic();
      if (narr) narr.innerHTML = `🏥 Ambos equipos salvaron <strong>${r}</strong> vidas. <span style="color:var(--ink-dim);">(${patientsDied} 💔 perdidas)</span>`;
    }
    renderLeaderboard(data);
  });

  // === BED GRID RENDERING ===
  function bedEmptyMarkup() {
    return `
      <div class="tri-bed-empty">
        <div class="tri-bed-empty-icon">🛏</div>
        <div class="tri-bed-empty-label">Cama libre</div>
      </div>`;
  }
  function renderBedGrid() {
    const grid = $('tri-bed-grid');
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 0; i < beds; i++) {
      const bed = document.createElement('div');
      bed.className = 'tri-bed';
      bed.id = 'tri-bed-' + i;
      bed.dataset.bedIdx = i;
      bed.innerHTML = `
        <div class="tri-bed-label">Cama ${i + 1}</div>
        <div class="tri-bed-inner">${bedEmptyMarkup()}</div>
      `;
      grid.appendChild(bed);
      const patient = patientsByBed[i];
      if (patient) spawnPatientInBed(patient);
    }
  }
  function spawnPatientInBed(p) {
    const bed = $('tri-bed-' + p.bedIdx);
    if (!bed) return;
    bed.classList.add('occupied');
    bed.classList.toggle('critical', !!p.critical);
    bed.classList.remove('died', 'treated', 'team-red', 'team-gold', 'low-life', 'treated-critical');
    const inner = bed.querySelector('.tri-bed-inner');
    if (!inner) return;
    inner.innerHTML = `
      <div class="tri-patient">
        <div class="tri-patient-icon">${p.icon || '🤒'}${p.critical ? '<span class="tri-crit-halo">🚨</span>' : ''}</div>
        <div class="tri-patient-name">${escapeHtml(p.name || '')}</div>
        <div class="tri-ekg"><svg viewBox="0 0 100 30" preserveAspectRatio="none"><polyline class="tri-ekg-line" points="0,15 12,15 16,5 20,25 24,15 40,15 44,8 48,22 52,15 70,15 74,4 78,26 82,15 100,15"/></svg></div>
        <div class="tri-life"><div class="tri-life-fill" style="width:${Math.max(0, Math.min(100, (p.lifeHp / p.lifeMax) * 100))}%;"></div></div>
      </div>
    `;
    // Spawn pulse — quick scale-in so the new patient is visually obvious
    bed.classList.add('arriving');
    setTimeout(() => bed.classList.remove('arriving'), 700);
  }

  // === VFX ===
  function spawnDefibZapFx(bed) {
    const fx = document.createElement('div');
    fx.className = 'tri-defib-zap';
    fx.innerHTML = '<div class="tri-defib-bolt">⚡</div><div class="tri-defib-ring"></div>';
    bed.appendChild(fx);
    setTimeout(() => fx.remove(), 900);
  }
  function spawnPointToast(bed, text, team, isCritical) {
    const toast = document.createElement('div');
    toast.className = 'tri-point-toast ' + (team || '') + (isCritical ? ' critical' : '');
    toast.textContent = text;
    bed.appendChild(toast);
    setTimeout(() => toast.remove(), 1400);
  }
  function spawnFlatlineGhost(bed, icon) {
    const ghost = document.createElement('div');
    ghost.className = 'tri-flatline-ghost';
    ghost.textContent = icon || '👻';
    bed.appendChild(ghost);
    setTimeout(() => ghost.remove(), 1700);
  }
  function animateAmbulanceArrival() {
    const amb = $('tri-ambulance');
    if (!amb) return;
    amb.classList.remove('arriving');
    void amb.offsetWidth;
    amb.classList.add('arriving');
    setTimeout(() => amb.classList.remove('arriving'), 3200);
  }

  function setEventBanner(text, kind) {
    const b = $('tri-event-banner');
    if (!b) return;
    b.textContent = text;
    b.className = 'tri-event-banner show ' + (kind || '');
    lastEventBannerAt = Date.now();
    setTimeout(() => {
      // Only clear if no newer banner overrode this one
      if (Date.now() - lastEventBannerAt >= 1700) {
        b.classList.remove('show');
      }
    }, 1800);
  }

  function updateHud() {
    if ($('saved-red'))  $('saved-red').textContent  = livesSavedRed;
    if ($('saved-gold')) $('saved-gold').textContent = livesSavedGold;
    if ($('deaths-display')) $('deaths-display').textContent = patientsDied;
  }

  // === Ambient heartbeat — soft beep every 4-7s while the ward is open.
  // Adds a subtle "hospital is alive" feel without ever dominating the mix.
  function startAmbientHeartbeat() {
    if (ambienceTimer) clearInterval(ambienceTimer);
    ambienceTimer = setInterval(() => {
      if (gameOver) return;
      if (Math.random() < 0.55 && MochiSounds.heartMonitorBeep) {
        MochiSounds.heartMonitorBeep();
      }
    }, 5200);
  }

  // === Side rosters ===
  const rosterPlayers = {}; // playerName → { team, avatar, score }
  function renderRosterSidebars(playersMap) {
    Object.entries(playersMap || {}).forEach(([id, p]) => {
      rosterPlayers[p.name] = {
        team: p.team,
        avatar: p.avatar || '',
        score: rosterPlayers[p.name] ? rosterPlayers[p.name].score : 0,
      };
    });
    redrawRosters();
  }
  function bumpRosterScore(name, team, pts) {
    if (!name) return;
    if (!rosterPlayers[name]) rosterPlayers[name] = { team, avatar: '', score: 0 };
    rosterPlayers[name].score += (pts || 0);
    redrawRosters();
  }
  function redrawRosters() {
    const red = $('tri-roster-list-red');
    const gold = $('tri-roster-list-gold');
    if (!red || !gold) return;
    red.innerHTML = '';
    gold.innerHTML = '';
    const sorted = Object.entries(rosterPlayers).sort((a, b) => b[1].score - a[1].score);
    sorted.forEach(([name, p]) => {
      const row = document.createElement('div');
      row.className = 'tri-roster-row';
      row.innerHTML = `
        <span class="tri-roster-avatar">${p.avatar || (p.team === 'red' ? '🩺' : '💉')}</span>
        <span class="tri-roster-name">${escapeHtml(name)}</span>
        <span class="tri-roster-score">${p.score}</span>
      `;
      (p.team === 'red' ? red : gold).appendChild(row);
    });
    // Density scaling — shrink row text if there are many players
    [red, gold].forEach((listEl) => {
      const n = listEl.children.length;
      const scale = n > 16 ? 'xs' : n > 10 ? 'sm' : 'md';
      listEl.dataset.density = scale;
    });
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
      const teamEmoji = p.team === 'red' ? '🩺' : '💉';
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

  function launchConfetti(colors) {
    for (let i = 0; i < 80; i++) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + '%';
      c.style.animationDelay = Math.random() * 1.5 + 's';
      c.style.animationDuration = 2 + Math.random() * 2 + 's';
      c.textContent = ['🩺', '💉', '❤️', '🚑', '✨', '🏥'][i % 6];
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

  socket.on('disconnect', () => console.log('[host-triage] disconnected'));
  socket.on('connect', () => console.log('[host-triage] connected'));
  socket.on('host-left', () => console.warn('[host-triage] host-left'));
})();
