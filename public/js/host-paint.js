// Dragones Pintores v2 «El Cielo de las Maravillas» — the projector (secondary: the kids' phones are the game).
// Lobby (PIN, this round's world with «Cambiar mundo», the kingdoms, «Así se juega») → the captains' VS countdown → the
// whole sky of the world live (js/paint-render.js: every dragon with a name tag that never overlaps, the clouds, the
// three prize islands with their capture rings) with the race on top, each kingdom's captain, islands and roster on the
// sides → island captures as a big moment in the middle, lead changes, the last 30 s, the last 10 s big → «¡FINAL!» and
// the shared Mario Party ceremony (js/party.js). «Otra ronda» = the next world. Test hook: window.PaintHost.
(function () {
  const socket = io();
  const $ = (id) => document.getElementById(id);
  const PW = window.PaintWorlds;
  const NAMES = { red: 'Reino del Fuego', gold: 'Reino del Mar' };
  const SHORT = { red: 'Fuego', gold: 'Mar' };
  const A = '/assets/kingdoms/';
  const SFX = { tick: A + 'tick.mp3', whoosh: A + 'whoosh.mp3', win: A + 'sting-win.mp3', surround: A + 'surround.mp3', alert: A + 'castle-alert.mp3', star: '/assets/monopoly/star.mp3', pop: '/assets/mochi/pop.mp3' };
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  let pin = null, state = null, muted = false;
  let scene = null, sky = null, world = null, roundId = null, worldPick = 0;
  let roster = {};           // k → [name, team, avatar]
  let kscores = {};          // k → clouds owned now
  let lmState = [];
  let timerInterval = null, warned = {}, raf = 0, lastT = 0;
  let music = null, musicName = null;

  function sfx(name, vol) { if (muted) return; try { const a = new Audio(SFX[name] || name); a.volume = vol || 0.6; a.play().catch(() => {}); } catch (_) {} }
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
  const DEF = 240;
  $('duration-slider').value = DEF;
  $('duration-value').textContent = '4 min';
  function showPin(p) {
    pin = p;
    $('pin-display').textContent = p;
    $('active-pin-display').textContent = p;
    $('join-url').textContent = `${location.origin}/?pin=${p}`;
    document.title = `Dragones Pintores · ${p}`;
    try { sessionStorage.setItem('draly.paintHost', JSON.stringify({ pin: p, setId })); } catch (_) {}
  }
  function createRoom() {
    socket.emit('host:create', { gameType: 'paint' }, (r) => {
      if (!r || !r.pin) return;
      showPin(r.pin);
      socket.emit('host:set-duration', { pin, duration: DEF });
      socket.emit('host:load-set', { pin, setId }, (resp) => {
        if (!resp || !resp.ok) { alert('No se pudo cargar la serie de preguntas.'); location.href = '/packs.html?game=paint' + LIVE; return; }
        $('set-display').textContent = `📚 ${resp.title} · ${resp.count} preguntas`;
        updateStartBtn();
      });
    });
  }
  // A reload of this tab (F5 mid-class) takes the same room back (its token: js/teacher-gate.js) instead of a new PIN:
  // the server sends the sky (pc:init) or the ending again, and the class plays on.
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem('draly.paintHost') || 'null'); } catch (_) {}
  if (saved && saved.pin && saved.setId === setId && !LIVE) {
    socket.emit('host:reclaim', { pin: saved.pin }, (r) => {
      if (r && r.ok && r.gameType === 'paint') { showPin(saved.pin); $('set-display').textContent = '📚 la serie elegida'; }
      else createRoom();
    });
  } else createRoom();
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
  // the round's world: the teacher picks another in the lobby; «Otra ronda» moves on to the next one by itself
  const pickWorld = (dir) => { if (pin) socket.emit('host:pc-world', { pin, world: (((worldPick + dir) % PW.WORLDS.length) + PW.WORLDS.length) % PW.WORLDS.length }, () => {}); };
  $('world-next').addEventListener('click', () => pickWorld(1));
  $('world-prev').addEventListener('click', () => pickWorld(-1));
  socket.on('pc:world', (d) => { if (d && d.world != null) { worldPick = d.world; paintWorldCard(); } });
  function paintWorldCard() {
    const w = PW.world(worldPick);
    $('world-bg').src = PW.art(w, 'bg');
    $('world-n').textContent = `Mundo ${worldPick + 1} de ${PW.WORLDS.length}`;
    $('world-name').textContent = w.name;
    const box = $('world-isl');
    box.innerHTML = '';
    w.lms.forEach((l) => {
      const f = document.createElement('figure');
      const im = document.createElement('img');
      im.src = PW.art(w, l.id); im.alt = '';
      const c = document.createElement('figcaption');
      c.textContent = l.name;
      f.append(im, c);
      box.appendChild(f);
    });
    $('howto-isl').src = PW.art(w, w.lms[0].id);
    if (window.PaintRender) window.PaintRender.load(worldPick);
  }
  paintWorldCard();

  function updateStartBtn() { if (state) $('start-btn').disabled = !(state.questionsLoaded > 0 && Object.keys(state.players || {}).length > 0); }

  socket.on('state', (s) => {
    if (s && s.endsAt && skew != null) s.endsAt -= skew;
    state = s;
    if (s.pcWorld != null && s.pcWorld !== worldPick && s.state === 'lobby') { worldPick = s.pcWorld; paintWorldCard(); }
    if (s.state === 'lobby') { renderLobby(s.players); updateStartBtn(); if (s.duration && +$('duration-slider').value !== s.duration) { $('duration-slider').value = s.duration; $('duration-value').textContent = fmtDur(s.duration); } }
    if (s.state === 'active' && !$('screen-lobby').classList.contains('hidden') && !ceremony) { showScreen('active'); startTimer(); }
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
    const w = PW.world(worldPick);
    $('count-world').textContent = `Mundo ${worldPick + 1} · ${w.name}`;
    let n = 3;
    const num = $('countdown-num');
    const tick = () => {
      num.style.animation = 'none'; void num.offsetWidth; num.style.animation = '';
      if (n > 0) { num.textContent = n; sfx('tick', 0.9); n--; setTimeout(tick, 900); }
      else { num.textContent = '¡A pintar!'; num.classList.add('go'); sfx('whoosh', 0.9); setTimeout(() => { num.classList.remove('go'); showScreen('active'); startTimer(); playMusic('music-battle', 0.32); if (scene) scene.resize(); }, 900); }
    };
    tick();
  });

  // ---------- the sky ----------
  socket.on('pc:init', (d) => {
    if (!d || d.world == null) return;
    const fresh = roundId !== d.id || !scene;
    roundId = d.id;
    worldPick = d.world;
    sky = PW.build(d.world, d.seed);
    world = PW.world(d.world);
    if (!scene) scene = new window.PaintRender.Scene($('pc-host-canvas'), { mode: 'host' });
    if (fresh) { scene.dragons = {}; scene.setSky(sky); scene.frenzy = false; }
    scene.frozen = !!d.paused;
    document.documentElement.style.setProperty('--pp-world-bg', `url("${PW.art(world, 'bg')}")`);
    // (a projector whose connection dropped during the countdown never got «¡A pintar!»: straight to the sky)
    if ($('screen-active').classList.contains('hidden') && !ceremony) { showScreen('active'); startTimer(); playMusic('music-battle', 0.32); }
    if (d.endsMs != null && state) state.endsAt = Date.now() + d.endsMs;
    if (d.speed) scene.speed = d.speed;
    scene.setOwn(d.own || []);
    scene.setIslands(d.lm);
    lmState = d.lm || [];
    roster = d.roster || {};
    scene.roster(roster);
    scene.positions(d.pos || [], performance.now());
    kscores = d.scores || {};
    $('world-chip').textContent = world.name;
    updateScores(d.teamScores || { red: 0, gold: 0 }, d.clouds);
    renderRosters();
    paintIslandsHeld();
    if (d.captains) { captains = d.captains; paintCaptains(false); }
    scene.resize();
    if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(draw); }
    if (fresh) say(`¡Bienvenidos a ${world.name}! Toquen el cielo para volar y conquisten las maravillas`, 'point');
  });
  socket.on('pc:roster', (r) => { roster = r || {}; if (scene) scene.roster(roster); renderRosters(); });
  let skew = null;          // the server's clock − this laptop's (the countdown reads right even on a wrong clock)
  socket.on('pc:pos', (m) => {
    if (!scene || !m) return;
    if (m.t) { const sk = m.t - Date.now(); skew = skew == null ? sk : skew + (sk - skew) * 0.2; }
    scene.positions(m.d || [], performance.now());
  });
  let lastPop = 0;
  socket.on('pc:paint', (m) => {
    if (!scene || !m) return;
    const now = performance.now();
    (m.f || []).forEach(([i, c]) => scene.paint(i, c, now));
    if ((m.f || []).length && now - lastPop > 260 && !muted) { lastPop = now; sfx('pop', 0.12); }
    if (m.lm) { lmState = m.lm; scene.setIslands(m.lm); paintIslandsHeld(); }
    if (m.sc) { kscores = m.sc; renderRosters(); }
    if (m.ts) updateScores(m.ts, m.cl);
    (m.ev || []).forEach(event);
  });
  function resize() { if (scene) scene.resize(); }
  window.addEventListener('resize', resize);

  function draw(t) {
    raf = requestAnimationFrame(draw);
    const dt = Math.min(0.1, (t - lastT) / 1000);
    lastT = t;
    if (!scene || !sky || $('screen-active').classList.contains('hidden')) return;
    if (!scene.resize()) return;
    // the crown: each kingdom's top painter (most clouds right now)
    const crowns = {};
    ['red', 'gold'].forEach((team) => {
      let best = null, bs = 0;
      Object.entries(roster).forEach(([k, v]) => { if (v[1] === team && (kscores[k] || 0) > bs) { bs = kscores[k]; best = k; } });
      if (best) crowns[best] = true;
    });
    scene.crowns = crowns;
    scene.frame(t, dt);
  }

  // ---------- the race, the sides ----------
  let shown = { red: 0, gold: 0 };
  function updateScores(ts, cl) {
    if (!ts) return;
    const r = ts.red || 0, g = ts.gold || 0;
    const share = r + g > 0 ? r / (r + g) : 0.5;
    $('tug-fill').style.width = (share * 100).toFixed(1) + '%';
    $('tiles-red').textContent = r;
    $('tiles-gold').textContent = g;
    if (r !== shown.red) bump($('tiles-red').parentNode);
    if (g !== shown.gold) bump($('tiles-gold').parentNode);
    shown = { red: r, gold: g };
    if (cl) {
      ['red', 'gold'].forEach((t) => {
        const n = lmState.filter((x) => x[1] === (t === 'red' ? 1 : 2)).length;
        $('side-clouds-' + t).textContent = cl[t] || 0;
        $('side-isl-' + t).textContent = n ? (n === 1 ? ' · 1 maravilla' : ` · ${n} maravillas`) : '';
      });
    }
  }
  function bump(node) { if (!node || reduced()) return; node.classList.remove('bump'); void node.offsetWidth; node.classList.add('bump'); }
  function paintIslandsHeld() {
    if (!sky || !world) return;
    ['red', 'gold'].forEach((team) => {
      const box = $('side-lms-' + team);
      const held = lmState.map((x, i) => (x[1] === (team === 'red' ? 1 : 2) ? i : -1)).filter((i) => i >= 0);
      const k = held.join(',');
      if (box.dataset.k === k) return;
      box.dataset.k = k;
      box.innerHTML = '';
      held.forEach((i) => { const im = document.createElement('img'); im.src = PW.art(world, sky.lms[i].id); im.alt = sky.lms[i].name; im.title = sky.lms[i].name + ' · +10'; box.appendChild(im); });
    });
  }
  function renderRosters() {
    ['red', 'gold'].forEach((team) => {
      const ul = $('roster-' + team);
      const list = Object.entries(roster).filter(([, v]) => v[1] === team).map(([k, v]) => ({ k, name: v[0], score: kscores[k] || 0 }))
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
      const key = list.map((p) => p.k + ':' + p.score).join(',');
      if (ul.dataset.k === key) return;
      ul.dataset.k = key;
      ul.innerHTML = '';
      list.slice(0, 9).forEach((p, i) => {
        const li = document.createElement('li');
        if (i === 0 && p.score > 0) li.className = 'king';
        const n = document.createElement('span'); n.textContent = (i === 0 && p.score > 0 ? '👑 ' : '') + p.name;
        const sc = document.createElement('span'); sc.textContent = p.score;
        li.append(n, sc); ul.appendChild(li);
      });
      if (list.length > 9) { const li = document.createElement('li'); li.className = 'more'; li.textContent = `y ${list.length - 9} más`; ul.appendChild(li); }
    });
  }

  // ---------- what happens in the sky: captures (one big moment at a time), leads, milestones, wind ----------
  let bigQ = [], bigOn = false, bigT = null, leadSaidAt = 0, leadSaid = null;
  const lmName = (i) => (sky && sky.lms[i] ? sky.lms[i].name : 'la maravilla');
  const listY = (a) => (a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1]);
  function event(ev) {
    if (ev.type === 'capture') {
      if (scene) scene.flashIsland(ev.lm, ev.team, performance.now());
      big({ team: ev.team, lm: ev.lm, title: ev.from && ev.from !== ev.team ? `¡El ${SHORT[ev.team]} le quitó ${lmName(ev.lm)} al ${SHORT[ev.from]}!` : `¡El ${NAMES[ev.team]} conquistó ${lmName(ev.lm)}!`, sub: ev.names && ev.names.length ? listY(ev.names) : '', pts: '+10' });
    } else if (ev.type === 'lost') {
      if (!lastTenOn()) banner(`¡${lmName(ev.lm)} queda libre!`, ev.by);
    } else if (ev.type === 'lead' && ev.team) {
      const now = Date.now();
      if (lastTenOn() || (shown[ev.team] || 0) <= (shown[ev.team === 'red' ? 'gold' : 'red'] || 0)) return;   // (it flipped back already)
      if (leadSaid && leadSaid !== ev.team && now - leadSaidAt < 4200) hideDralingo();
      if (now - leadSaidAt < 7000) return;
      leadSaid = ev.team; leadSaidAt = now; lastSay = 0;
      const cap = captains && captains[ev.team];
      const C = window.DralingoCast;
      say(cap && C ? `¡El ${NAMES[ev.team]} pasa al frente! ${C.name(cap)}: «${C.line(cap, 'battle')}»` : `¡El ${NAMES[ev.team]} pasa al frente!`, 'point');
      if (window.DralingoFX && !bigOn && (!state || !state.endsAt || state.endsAt - Date.now() > 15000)) DralingoFX.play('flyby', { text: '¡' + SHORT[ev.team] + ' adelante!', mood: 'win' });
      sfx('surround', 0.5);
    } else if (ev.type === 'milestone') {
      if (lastTenOn()) return;
      banner(`🎨 ¡${ev.pct} % del cielo pintado!`);
      sfx('alert', 0.5);
    } else if (ev.type === 'wind' && ev.team) {
      if (lastTenOn()) return;
      const who = roster[ev.k] ? roster[ev.k][0] : '';
      banner(`🌬️ ¡Viento a favor! ${who ? who + ' sopló' : 'El ' + SHORT[ev.team] + ' sopló'} ${ev.n} nubes`, ev.team);
    }
  }
  let lastBigAt = 0;
  function big(m) {
    if (bigOn && Date.now() - lastBigAt < 4000 && bigQ.length) { banner(m.title, m.team); return; }
    bigQ.push(m);
    if (bigQ.length > 2) bigQ = bigQ.slice(-2);
    if (!bigOn) nextBig();
  }
  function nextBig() {
    const m = bigQ.shift();
    const box = $('ph-big');
    if (!m) { bigOn = false; box.classList.remove('show'); return; }
    bigOn = true;
    lastBigAt = Date.now();
    box.className = 'ph-big ' + m.team;
    $('ph-big-img').src = world && sky ? PW.art(world, sky.lms[m.lm].id) : '';
    $('ph-big-title').textContent = m.title;
    $('ph-big-sub').textContent = m.sub || '';
    $('ph-big-pts').textContent = m.pts || '';
    void box.offsetWidth;
    box.classList.add('show');
    sfx('star', 0.7);
    clearTimeout(bigT);
    if (m.hold) return;                 // (test hook: held for a still)
    bigT = setTimeout(() => { box.classList.remove('show'); bigT = setTimeout(nextBig, 500); }, 3000);
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
        lastTen(0);
        return;
      }
      const left = Math.max(0, state.endsAt - Date.now());
      const sec = Math.ceil(left / 1000);
      $('timer-display').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      if (sec === 60 && !warned[60]) { warned[60] = 1; banner('⏱ ¡Queda 1 minuto!'); }
      if (sec === 30 && !warned[30]) { warned[30] = 1; say('¡Últimos 30 segundos! Cada acierto: recarga doble y llamarada.', 'point'); playMusic('music-final', 0.42); }
      if (sec <= 10 && sec > 0 && !warned['t' + sec]) { warned['t' + sec] = 1; sfx('tick', 0.5); $('timer-display').classList.add('urgent'); }
      lastTen(sec <= 10 && sec > 0 ? sec : 0);
    }, 250);
  }
  // the last 10 s, big over the sky (read from the back of the room)
  let lastShown = 0;
  const lastTenOn = () => lastShown > 0;
  function lastTen(sec) {
    const el = $('ph-last');
    if (sec === lastShown) return;
    lastShown = sec;
    el.classList.toggle('show', sec > 0);
    if (sec > 0) { el.textContent = sec; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; if (sec === 10) { hideDralingo(); document.querySelectorAll('.kd-banner').forEach((b) => b.remove()); } }
  }

  // ---------- the Mario Party ending (js/party.js, 2026-10-16): «¡FINAL!», the ceremony, «Otra ronda» ----------
  let ceremony = null;
  const playUrl = (url, vol) => { if (muted) return; try { const a = new Audio(url); a.volume = vol == null ? 0.7 : vol; a.play().catch(() => {}); } catch (_) {} };
  const FINAL_SUB = { time: '¡Se acabó el tiempo!', end: '¡Fin de la ronda!' };
  socket.on('fin:final', (d) => {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    if ($('timer-display')) { $('timer-display').textContent = '0:00'; $('timer-display').classList.remove('urgent', 'pf-frenzy'); }
    lastTen(0);
    stopMusic();
    hideDralingo();
    if (scene) scene.frozen = true;
    bigQ = []; clearTimeout(bigT); $('ph-big').classList.remove('show'); bigOn = false;
    document.querySelectorAll('.kd-banner').forEach((b) => b.remove());
    if (window.DralyParty) { DralyParty.clearChip(); DralyParty.final({ mode: 'host', ms: d && d.ms, sub: FINAL_SUB[d && d.why] || FINAL_SUB.end, play: playUrl }); }
  });
  // the last 30 s, from the server (it can switch off again after «+30 s»): a banner, a ribbon, a red clock, fireworks
  socket.on('fin:frenzy', (d) => {
    if (!d || !window.DralyParty) return;
    if (d.off) { DralyParty.clearChip(); $('timer-display').classList.remove('pf-frenzy'); if (scene) scene.frenzy = false; document.body.classList.remove('ph-frenzy'); return; }
    if (!d.again) banner('⚡ ¡Últimos 30 segundos! ¡Recarga doble!');
    DralyParty.chip('Recarga doble', d.endsMs, 'host');
    $('timer-display').classList.add('pf-frenzy');
    if (scene) scene.frenzy = true;
    document.body.classList.add('ph-frenzy');
  });
  // «⏸ Pausa»: the clock stops, the dragons wait; the card lets the buttons under it work
  let hostPaused = false, hostPausedAt = 0;
  function showHostPaused(v) {
    if (!!v !== hostPaused) hostPausedAt = v ? Date.now() : 0;
    hostPaused = !!v;
    $('pause-btn').textContent = hostPaused ? '▶ Seguir' : '⏸ Pausa';
    if (window.DralyParty) DralyParty.pauseCard(hostPaused, { mode: 'host' });
    if (hostPaused) stopMusic(); else if (!$('screen-active').classList.contains('hidden')) playMusic('music-battle', 0.32);
  }
  $('pause-btn').addEventListener('click', () => socket.emit('host:pause', { pin, paused: !hostPaused }));
  socket.on('pc:pause', (d) => { if (d && !d.paused && state) state.endsAt = Date.now() + (d.endsMs || 0); if (scene) scene.frozen = !!(d && d.paused); showHostPaused(d && d.paused); });
  socket.on('pc:init', (d) => { if (d && !!d.paused !== hostPaused) showHostPaused(d.paused); });
  function partyEnd(d) {
    if (hostPaused) showHostPaused(false);
    if (!window.DralyParty || !d || !d.fin) return false;
    DralyParty.clearChip();
    $('timer-display').classList.remove('pf-frenzy');
    document.body.classList.remove('ph-frenzy');
    if (scene) scene.frenzy = false;
    if (ceremony) ceremony.stop();      // (the frozen sky stays under the show: never the old end screen, it would spoil the result)
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
    stopMusic(); hideDralingo(); lastTen(0);
    cancelAnimationFrame(raf); raf = 0;           // the frozen sky under the ceremony needs no more frames
    if (partyEnd(d)) return;           // the Mario Party ceremony (the old end screen below stays as a fallback)
    showScreen('win');
    const r = d.teamScores.red || 0, gg = d.teamScores.gold || 0;
    $('final-red').textContent = r; $('final-gold').textContent = gg;
    const win = $('win-banner');
    if (d.winner === 'red' || d.winner === 'gold') {
      win.textContent = `¡Gana el ${NAMES[d.winner]}!`;
      win.className = 'kd-winner ' + d.winner;
      $('win-why').textContent = `El cielo más pintado: ${Math.max(r, gg)} puntos`;
      sfx('win', 0.9);
    } else {
      win.textContent = '¡Empate en el cielo!'; win.className = 'kd-winner';
      $('win-why').textContent = `Los dos reinos hicieron ${r} puntos`;
    }
    const lb = $('leaderboard');
    lb.innerHTML = '';
    (d.leaderboard || []).slice(0, 6).forEach((p, i) => {
      const row = document.createElement('div'); row.className = 'kd-lb-row';
      const rank = document.createElement('span'); rank.textContent = ['🥇', '🥈', '🥉'][i] || '#' + (i + 1);
      const name = document.createElement('span'); const dot = document.createElement('i'); dot.className = 'kd-dot ' + p.team;
      name.append(dot, document.createTextNode(p.name));
      const sc = document.createElement('span'); sc.textContent = p.score === 1 ? '1 nube' : `${p.score} nubes`;
      row.append(rank, name, sc); lb.appendChild(row);
    });
  });

  // ---------- fx ----------
  let bannerTimer = null;
  function banner(text, team) {
    document.querySelectorAll('.kd-banner').forEach((b) => b.remove());
    const b = document.createElement('div');
    b.className = 'kd-banner ph-banner' + (team ? ' ' + team : '');
    b.textContent = text;
    document.body.appendChild(b);
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.remove(), 3100);
  }
  let sayTimer = null, lastSay = 0;
  function say(text, pose) {
    const now = Date.now();
    if (now - lastSay < 2500) return;
    lastSay = now;
    $('dralingo-say').textContent = text;
    $('dralingo-img').src = '/assets/dralingo/' + (pose || 'point') + '.webp';
    $('dralingo').classList.add('show');
    clearTimeout(sayTimer);
    sayTimer = setTimeout(hideDralingo, 4200);
  }
  function hideDralingo() { $('dralingo').classList.remove('show'); }
  function showScreen(name) { ['lobby', 'countdown', 'active', 'win'].forEach((n) => $('screen-' + n).classList.toggle('hidden', n !== name)); }

  window.PaintHost = {
    scene: () => scene,
    big: (m, hold) => big(Object.assign({}, m, { hold: !!hold })),
    banner: (t, team) => banner(t, team),
    last: (s) => lastTen(s),
    frame: () => { if (scene && scene.resize()) scene.frame(performance.now(), 1 / 60); },
  };
})();
