// Dragones Pintores — projector view.
// Lobby (PIN, kingdoms, duration) → countdown → the whole sky map live (every dragon, every painted cloud)
// → winner screen. Dralingo announces with random TikTok-style entrances (js/dralingo-fx.js).
(function () {
  const socket = io();
  const $ = (id) => document.getElementById(id);
  const NAMES = { red: 'Reino del Fuego', gold: 'Reino del Mar' };
  const A = '/assets/kingdoms/';
  const POSE = (n) => A + 'dralingo/' + n + '.webp';
  const SFX = { tick: A + 'tick.mp3', whoosh: A + 'whoosh.mp3', win: A + 'sting-win.mp3', surround: A + 'surround.mp3', alert: A + 'castle-alert.mp3' };
  const COL = { red: '#f0443a', gold: '#2f7bea', redDeep: '#b22a22', goldDeep: '#1d52a8' };

  let pin = null, state = null, muted = false;
  let lv = null, solid = null, surf = null, own = {};
  let dragons = {};          // id → { x, y, tx, ty, f, team }
  let players = {};          // id → { name, team, score }
  let timerInterval = null, warned = {}, raf = 0;
  let canvas, g2, music = null, musicName = null;
  // Team colours on the dragons (his note 2026-10-11): Fuego = red Dralingo, Mar = blue.
  const IMG = { red: new Image(), gold: new Image() };
  IMG.red.src = POSE('fly-red');
  IMG.gold.src = POSE('fly');

  function sfx(name, vol) { if (muted) return; try { const a = new Audio(SFX[name]); a.volume = vol || 0.6; a.play().catch(() => {}); } catch (_) {} }
  function playMusic(name, vol) {
    if (musicName === name) return;
    stopMusic(); musicName = name;
    if (muted) return;
    try { music = new Audio(A + name + '.mp3'); music.loop = true; music.volume = vol || 0.4; music.play().catch(() => {}); } catch (_) {}
  }
  function stopMusic() { if (music) { try { music.pause(); } catch (_) {} } music = null; musicName = null; }

  $('mute-btn').addEventListener('click', () => {
    muted = window.toggleMute ? window.toggleMute() : !muted;
    $('mute-btn').textContent = muted ? '🔇 Sin sonido' : '🔊 Sonido';
    if (muted) stopMusic(); else if (!$('screen-lobby').classList.contains('hidden')) playMusic('music-lobby', 0.35);
  });
  document.addEventListener('click', () => {
    if (window.unlockAudio) window.unlockAudio();
    if (!$('screen-lobby').classList.contains('hidden')) playMusic('music-lobby', 0.35);
  }, { once: true });

  // ---------- room ----------
  const setId = new URLSearchParams(location.search).get('setId');
  // From /maestro the page opens with ?livegame=1 (pull the class in): keep that flag through the question picker.
  const LIVE = new URLSearchParams(location.search).get('livegame') === '1' ? '&livegame=1' : '';
  if (!setId) { location.href = '/packs.html?game=paint' + LIVE; return; }
  $('duration-slider').value = 240;
  $('duration-value').textContent = '4 min';
  socket.emit('host:create', { gameType: 'paint' }, ({ pin: p }) => {
    pin = p;
    $('pin-display').textContent = p;
    $('active-pin-display').textContent = p;
    $('join-url').textContent = `${location.origin}/?pin=${p}`;
    document.title = `Dragones Pintores · ${p}`;
    socket.emit('host:set-duration', { pin, duration: 240 });
    socket.emit('host:load-set', { pin, setId }, (resp) => {
      if (!resp || !resp.ok) { alert('No se pudo cargar la serie de preguntas.'); location.href = '/packs.html?game=paint' + LIVE; return; }
      $('set-display').textContent = `📚 ${resp.title} · ${resp.count} preguntas`;
      updateStartBtn();
    });
  });
  let connectedOnce = false;
  socket.on('connect', () => { if (connectedOnce && pin) socket.emit('host:reclaim', { pin }, () => {}); connectedOnce = true; });

  const fmtDur = (v) => (v % 60 ? `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')} min` : `${v / 60} min`);
  $('duration-slider').addEventListener('input', (e) => { $('duration-value').textContent = fmtDur(+e.target.value); });
  $('duration-slider').addEventListener('change', (e) => socket.emit('host:set-duration', { pin, duration: +e.target.value }));
  $('balance-btn').addEventListener('click', () => socket.emit('host:auto-balance', { pin }));
  $('start-btn').addEventListener('click', () => socket.emit('host:start', { pin }));
  $('add-time-btn').addEventListener('click', () => { socket.emit('host:add-time', { pin, seconds: 30 }); banner('+30 segundos ⏱'); });
  $('end-now-btn').addEventListener('click', () => { if (confirm('¿Terminar la ronda ahora?')) socket.emit('host:end-now', { pin }); });
  $('play-again-btn').addEventListener('click', () => { if (ceremony) { ceremony.stop(); ceremony = null; } socket.emit('host:reset', { pin }); showScreen('lobby'); playMusic('music-lobby', 0.35); });
  socket.on('host:start-error', (e) => alert(e && e.message ? e.message : 'No se pudo empezar.'));

  function updateStartBtn() { if (state) $('start-btn').disabled = !(state.questionsLoaded > 0 && Object.keys(state.players || {}).length > 0); }

  socket.on('state', (s) => {
    state = s;
    Object.entries(s.players || {}).forEach(([id, p]) => { players[id] = Object.assign(players[id] || { score: 0 }, { name: p.name, team: p.team, avatar: p.avatar }); });
    Object.keys(players).forEach((id) => { if (!s.players[id]) delete players[id]; });
    if (s.state === 'lobby') { renderLobby(s.players); updateStartBtn(); }
    if (s.state === 'active') renderRosters();
  });
  function renderLobby(map) {
    ['red', 'gold'].forEach((team) => {
      const box = $('players-' + team);
      box.innerHTML = '';
      const list = Object.entries(map || {}).filter(([, p]) => p.team === team);
      $('count-' + team).textContent = list.length === 1 ? '1 jugador' : `${list.length} jugadores`;
      list.forEach(([id, p]) => {
        const chip = document.createElement('button');
        chip.className = 'kd-chip';
        chip.textContent = (p.avatar ? p.avatar + ' ' : '') + p.name;
        chip.addEventListener('click', () => socket.emit('host:swap-team', { pin, playerId: id }));
        box.appendChild(chip);
      });
    });
  }

  // ---------- captains (two of the gang lead the kingdoms; revealed during the countdown, as in Reinos) ----------
  let captains = null;
  function paintCaptains(intro) {
    const C = window.DralingoCast;
    const ok = !!(captains && C);
    ['red', 'gold'].forEach((team) => {
      $('cap-' + team).classList.toggle('hidden', !ok);
      $('side-cap-' + team).classList.toggle('hidden', !ok);
      if (!ok) { $('side-capname-' + team).textContent = ''; return; }
      const id = captains[team];
      $('cap-' + team + '-img').src = C.pose(id, 'cheer');
      $('cap-' + team + '-name').textContent = C.captain(id);
      $('side-cap-' + team).src = C.pose(id, 'hello');
      $('side-capname-' + team).textContent = C.captain(id);
      if (intro) { const el = $('cap-' + team); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; }
    });
  }
  socket.on('pc:captains', (c) => { captains = c; paintCaptains(true); });

  // ---------- countdown ----------
  socket.on('countdown', () => {
    showScreen('countdown');
    stopMusic();
    let n = 3;
    const num = $('countdown-num');
    const tick = () => {
      num.style.animation = 'none'; void num.offsetWidth; num.style.animation = '';
      if (n > 0) { num.textContent = n; sfx('tick', 0.9); n--; setTimeout(tick, 900); }
      else { num.textContent = '¡A pintar!'; num.style.fontSize = '7rem'; sfx('whoosh', 0.9); setTimeout(() => { num.style.fontSize = ''; showScreen('active'); startTimer(); playMusic('music-battle', 0.32); resize(); }, 900); }
    };
    tick();
  });

  // ---------- map ----------
  socket.on('pc:init', (d) => {
    lv = d.level;
    solid = new Uint8Array(lv.cols * lv.rows);
    lv.solid.forEach((row, y) => { for (let x = 0; x < lv.cols; x++) solid[y * lv.cols + x] = row[x] === '#' ? 1 : 0; });
    surf = new Set(lv.surfaces);
    own = Object.assign({}, d.own || {});
    dragons = {};
    Object.entries(d.players || {}).forEach(([id, p]) => { players[id] = Object.assign(players[id] || {}, { name: p.name, team: p.team, score: 0 }); });
    updateScores(d.teamScores || { red: 0, gold: 0 });
    renderRosters();
    if (d.captains) { captains = d.captains; paintCaptains(false); }
    canvas = $('pc-host-canvas');
    g2 = canvas.getContext('2d');
    resize();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
    say('¡A pintar el cielo! Recarguen fuego respondiendo bien 🔥', 'fly');
  });
  socket.on('pc:pos', (arr) => {
    const seen = {};
    arr.forEach(([id, x, y, f, t]) => {
      seen[id] = 1;
      const dd = dragons[id] || (dragons[id] = { x, y });
      dd.tx = x; dd.ty = y; dd.f = f; dd.team = t ? 'gold' : 'red';
    });
    Object.keys(dragons).forEach((id) => { if (!seen[id]) delete dragons[id]; });
  });
  socket.on('pc:paint', (d) => {
    (d.tiles || []).forEach(([id, t]) => { own[id] = t ? 'gold' : 'red'; });
    if (d.scores) Object.entries(d.scores).forEach(([id, sc]) => { if (players[id]) players[id].score = sc; });
    updateScores(d.teamScores);
    renderRosters();
    (d.events || []).forEach((ev) => {
      if (ev.type === 'lead' && ev.team) {
        const now = Date.now();
        if (leadSaid && leadSaid !== ev.team && now - leadSaidAt < 4200) hideDralingo();   // the bubble said the other kingdom
        if (now - leadSaidAt < 7000) return;
        leadSaid = ev.team; leadSaidAt = now; lastSay = 0;
        // the leading kingdom's captain cheers (Reinos does the same); Dralingo's bubble when there is no captain
        const cap = captains && captains[ev.team];
        const C = window.DralingoCast;
        say(cap && C ? `¡El ${NAMES[ev.team]} pasa al frente! ${C.name(cap)}: «${C.line(cap, 'battle')}»` : `¡El ${NAMES[ev.team]} pasa al frente!`, 'pointing');
        if (window.DralingoFX) DralingoFX.play('flyby', { text: '¡' + (ev.team === 'red' ? 'Fuego' : 'Mar') + ' adelante!', mood: 'win' });
        sfx('surround', 0.5);
      } else if (ev.type === 'milestone') {
        banner(`🎨 ¡${ev.pct}% del cielo pintado!`);
        if (window.DralingoFX) DralingoFX.celebrate({ text: `¡${ev.pct}% pintado!`, mood: 'win' });
        sfx('alert', 0.6);
      }
    });
  });

  function resize() {
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
  }
  window.addEventListener('resize', resize);

  function draw() {
    raf = requestAnimationFrame(draw);
    if (!lv || !g2 || $('screen-active').classList.contains('hidden')) return;
    const cw = canvas.width, ch = canvas.height, t = lv.tile;
    const s = Math.min(cw / (lv.cols * t), ch / (lv.rows * t));
    const ox = (cw - lv.cols * t * s) / 2, oy = (ch - lv.rows * t * s) / 2;
    g2.setTransform(1, 0, 0, 1, 0, 0);
    window.PaintRender.sky(g2, cw, ch);
    g2.setTransform(s, 0, 0, s, ox, oy);
    window.PaintRender.tiles(g2, lv, solid, surf, own, 0, lv.cols - 1, 0, lv.rows - 1, 5);
    window.PaintRender.flags(g2, lv, 5);
    // MVP of each kingdom (most clouds painted) wears a crown over the name tag, like a live battle.
    const mvp = {};
    Object.entries(players).forEach(([id, p]) => {
      if ((p.score || 0) > 0 && (!mvp[p.team] || p.score > players[mvp[p.team]].score)) mvp[p.team] = id;
    });
    g2.font = '800 30px Nunito, sans-serif';
    g2.textAlign = 'center';
    g2.textBaseline = 'middle';
    Object.entries(dragons).forEach(([id, d]) => {
      d.x += (d.tx - d.x) * 0.25; d.y += (d.ty - d.y) * 0.25;
      g2.fillStyle = COL[d.team]; g2.globalAlpha = 0.45;
      g2.beginPath(); g2.ellipse(d.x, d.y - 2, 28, 8, 0, 0, 7); g2.fill(); g2.globalAlpha = 1;
      const img = IMG[d.team] || IMG.gold;
      if (img.complete && img.naturalWidth) {
        g2.save(); g2.translate(d.x, d.y - 44); if (!d.f) g2.scale(-1, 1); g2.drawImage(img, -44, -44, 88, 88); g2.restore();
      }
      const p = players[id];
      if (p) {
        const label = p.name.slice(0, 12);
        const w = g2.measureText(label).width + 22;
        const top = d.y - 132;
        g2.fillStyle = '#fff7e3'; g2.strokeStyle = d.team === 'red' ? COL.redDeep : COL.goldDeep; g2.lineWidth = 4;
        g2.beginPath();
        if (g2.roundRect) g2.roundRect(d.x - w / 2, top, w, 40, 12); else g2.rect(d.x - w / 2, top, w, 40);
        g2.fill(); g2.stroke();
        g2.fillStyle = '#1d2440'; g2.fillText(label, d.x, top + 21);
        if (mvp[d.team] === id) { g2.font = '40px sans-serif'; g2.fillText('👑', d.x, top - 22); g2.font = '800 30px Nunito, sans-serif'; }
      }
    });
  }

  function updateScores(ts) {
    if (!ts) return;
    const total = lv ? lv.surfaces.length : 500;
    const r = ts.red || 0, gg = ts.gold || 0;
    $('tug-red').style.flexBasis = Math.max(6, (r / total) * 100) + '%';
    $('tug-gold').style.flexBasis = Math.max(6, (gg / total) * 100) + '%';
    $('tug-red').textContent = r; $('tug-gold').textContent = gg;
    $('tiles-red').textContent = r; $('tiles-gold').textContent = gg;
  }
  function renderRosters() {
    ['red', 'gold'].forEach((team) => {
      const ul = $('roster-' + team);
      const list = Object.values(players).filter((p) => p.team === team).sort((a, b) => (b.score || 0) - (a.score || 0));
      ul.innerHTML = '';
      list.slice(0, 9).forEach((p, i) => {
        const li = document.createElement('li');
        if (i === 0 && (p.score || 0) > 0) li.className = 'king';
        const n = document.createElement('span'); n.textContent = (i === 0 && (p.score || 0) > 0 ? '👑 ' : '') + p.name;
        const sc = document.createElement('span'); sc.textContent = p.score || 0;
        li.append(n, sc); ul.appendChild(li);
      });
    });
  }

  // ---------- timer ----------
  function startTimer() {
    warned = {};
    $('timer-display').classList.remove('urgent');
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!state || !state.endsAt) return;
      if (hostPaused) {      // paused: the clock stands still (and shows «+30 s» at once)
        const ps = Math.ceil(Math.max(0, state.endsAt - hostPausedAt) / 1000);
        $('timer-display').textContent = `${Math.floor(ps / 60)}:${String(ps % 60).padStart(2, '0')}`;
        return;
      }
      const left = Math.max(0, state.endsAt - Date.now());
      const sec = Math.ceil(left / 1000);
      $('timer-display').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      if (sec === 60 && !warned[60]) { warned[60] = 1; banner('⏱ ¡Queda 1 minuto!'); }
      if (sec === 30 && !warned[30]) { warned[30] = 1; say('¡Últimos 30 segundos! Cada acierto: doble fuego y llamarada.', 'countdown'); playMusic('music-final', 0.42); }
      if (sec <= 10 && sec > 0 && !warned['t' + sec]) { warned['t' + sec] = 1; sfx('tick', 0.5); $('timer-display').classList.add('urgent'); }
    }, 250);
  }

  // ---------- end ----------

  // ---------- the Mario Party ending (js/party.js, 2026-10-16): «¡FINAL!», the ceremony, «Otra ronda» ----------
  // His rule «Feelings at the end of class»: the reveal, the winners celebrate and the others react, the bonus stars one
  // by one, the podium. «⏭ Saltar» (top right) jumps every phone to its card; «Sonido» stays on top.
  let ceremony = null;
  const playUrl = (url, vol) => { if (muted) return; try { const a = new Audio(url); a.volume = vol == null ? 0.7 : vol; a.play().catch(() => {}); } catch (_) {} };
  const FINAL_SUB = { time: '¡Se acabó el tiempo!', end: '¡Fin de la ronda!', allFrozen: '¿Quién ganó la batalla?', escaped: '¡Despegamos! ¿Qué rango ganamos?' };
  socket.on('fin:final', (d) => {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    if ($('timer-display')) { $('timer-display').textContent = '0:00'; $('timer-display').classList.remove('urgent'); }
    stopMusic();
    hideDralingo();
    document.querySelectorAll('.kd-banner').forEach((b) => b.remove());
    if ($('timer-display')) $('timer-display').classList.remove('pf-frenzy');
    if (window.DralyParty) { DralyParty.clearChip(); DralyParty.final({ mode: 'host', ms: d && d.ms, sub: FINAL_SUB[d && d.why] || FINAL_SUB.end, play: playUrl }); }
  });
  // the last 30 s, from the server (it can switch off again after «+30 s»): a banner, a ribbon with the seconds, a red clock
  socket.on('fin:frenzy', (d) => {
    if (!d || !window.DralyParty) return;
    if (d.off) { DralyParty.clearChip(); if ($('timer-display')) $('timer-display').classList.remove('pf-frenzy'); return; }
    if (!d.again) banner('🔥🔥 ¡Últimos 30 segundos! ¡Fuego doble!');
    DralyParty.chip('Fuego ×2', d.endsMs, 'host');
    if ($('timer-display')) $('timer-display').classList.add('pf-frenzy');
  });
  // «⏸ Pausa» (2026-10-16): the clock stops, plant windows / dragons wait; the card lets the buttons under it work
  let hostPaused = false, hostPausedAt = 0;
  function showHostPaused(v) {
    if (!!v !== hostPaused) hostPausedAt = v ? Date.now() : 0;
    hostPaused = !!v;
    $('pause-btn').textContent = hostPaused ? '▶ Seguir' : '⏸ Pausa';
    if (window.DralyParty) DralyParty.pauseCard(hostPaused, { mode: 'host' });
    if (hostPaused) stopMusic(); else if (!$('screen-active').classList.contains('hidden')) playMusic('music-battle', 0.32);
  }
  $('pause-btn').addEventListener('click', () => socket.emit('host:pause', { pin, paused: !hostPaused }));
  socket.on('pc:pause', (d) => { if (d && !d.paused && state) state.endsAt = Date.now() + (d.endsMs || 0); showHostPaused(d && d.paused); });
  socket.on('pc:init', (d) => { if (d && !!d.paused !== hostPaused) showHostPaused(d.paused); });
  function partyEnd(d) {
    if (hostPaused) showHostPaused(false);
    if (!window.DralyParty || !d || !d.fin) return false;
    DralyParty.clearChip();
    if ($('timer-display')) $('timer-display').classList.remove('pf-frenzy');
    if (ceremony) ceremony.stop();      // (the frozen board stays under the show: never the old end screen, it would spoil the result)
    ceremony = new DralyParty.Ceremony({
      mode: 'host', game: 'paint', data: d, mount: document.body, play: playUrl,
      onSkip: () => socket.emit('host:fin-skip', { pin }),
      onAgain: () => { ceremony = null; $('play-again-btn').click(); },
      onHome: () => { location.href = '/'; },
    });
    return true;
  }
  socket.on('state', (s) => { if (s && s.state === 'lobby' && ceremony) { ceremony.stop(); ceremony = null; } });

  socket.on('game-end', (d) => {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    stopMusic(); hideDralingo();
    if (partyEnd(d)) return;           // the Mario Party ceremony (the old end screen below stays as a fallback)
    showScreen('win');
    const r = d.teamScores.red || 0, gg = d.teamScores.gold || 0;
    $('final-red').textContent = r; $('final-gold').textContent = gg;
    const win = $('win-banner');
    $('win-pose').src = POSE(d.winner === 'red' ? 'champion-red' : d.winner === 'gold' ? 'champion' : 'jump');
    if (d.winner === 'red' || d.winner === 'gold') {
      win.textContent = `¡Gana el ${NAMES[d.winner]}!`;
      win.className = 'kd-winner ' + d.winner;
      $('win-why').textContent = `El cielo más pintado: ${Math.max(r, gg)} nubes`;
      sfx('win', 0.9);
      if (window.DralingoFX) setTimeout(() => DralingoFX.play(Math.random() < 0.5 ? 'rain' : 'gang', { text: '¡' + NAMES[d.winner] + '!', mood: 'win', stamp: '¡Victoria!' }), 600);
    } else {
      win.textContent = '¡Empate en el cielo!'; win.className = 'kd-winner';
      $('win-why').textContent = `Los dos reinos pintaron ${r} nubes`;
    }
    const lb = $('leaderboard');
    lb.innerHTML = '';
    (d.leaderboard || []).slice(0, 6).forEach((p, i) => {
      const row = document.createElement('div'); row.className = 'kd-lb-row';
      const rank = document.createElement('span'); rank.textContent = ['🥇', '🥈', '🥉'][i] || '#' + (i + 1);
      const name = document.createElement('span'); const dot = document.createElement('i'); dot.className = 'kd-dot ' + p.team;
      name.append(dot, document.createTextNode((p.avatar ? p.avatar + ' ' : '') + p.name));
      const sc = document.createElement('span'); sc.textContent = p.score === 1 ? '1 nube' : `${p.score} nubes`;
      row.append(rank, name, sc); lb.appendChild(row);
    });
  });

  // ---------- fx ----------
  let bannerTimer = null;
  function banner(text, team) {
    document.querySelectorAll('.kd-banner').forEach((b) => b.remove());
    const b = document.createElement('div');
    b.className = 'kd-banner' + (team ? ' ' + team : '');
    b.textContent = text;
    document.body.appendChild(b);
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.remove(), 3100);
  }
  let sayTimer = null, lastSay = 0, leadSaid = null, leadSaidAt = 0;
  function say(text, pose) {
    const now = Date.now();
    if (now - lastSay < 2500) return;
    lastSay = now;
    $('dralingo-say').textContent = text;
    $('dralingo-img').src = POSE(pose || 'pointing');
    $('dralingo').classList.add('show');
    clearTimeout(sayTimer);
    sayTimer = setTimeout(hideDralingo, 4200);
  }
  function hideDralingo() { $('dralingo').classList.remove('show'); }
  function showScreen(name) { ['lobby', 'countdown', 'active', 'win'].forEach((n) => $('screen-' + n).classList.toggle('hidden', n !== name)); }
})();
