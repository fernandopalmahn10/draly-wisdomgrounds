// Batalla de Nieve en Ski Dubái — projector view.
// Lobby (PIN, everyone's saga avatar, the 3 steps) → the round's two captains face off during the countdown → the whole
// Dubai map live (every kid as their avatar, snowballs, the ❄️ chest), «❄️ 7/24 congelados» frost bar, survivors | ice
// team panels with their captains → the end show (survivors in a row, or the frozen champion Dralingo), MVPs, top 6.
// Big moments (one at a time, ≥ 7 s apart): the Hechizo de Hielo, half the class frozen, the last 3 (spotlight +
// heartbeat), 30 s left. Everything else is a banner or a small effect on the map.
(function () {
  const socket = io();
  const $ = (id) => document.getElementById(id);
  const M = window.SnowMap, R = window.SnowRender, Cast = window.DralingoCast || null;
  const A = '/assets/kingdoms/', SN = '/assets/snow/';
  const SFX = {
    tick: A + 'tick.mp3', whoosh: A + 'whoosh.mp3', win: A + 'sting-win.mp3', spell: A + 'siege.mp3', alert: A + 'castle-alert.mp3',
    freeze: SN + 'freeze.mp3', hit: SN + 'hit.mp3', stun: SN + 'stun.mp3', chest: SN + 'chest.mp3', spawn: SN + 'spawn.mp3',
    throw: SN + 'throw.mp3', pop: SN + 'pop.mp3', streak: A + 'streak.mp3',
  };
  const POSE = (n) => A + 'dralingo/' + n + '.webp';
  const ZNAME = (z) => (M.ZONES[z] && M.ZONES[z].name) || 'Dubái';

  let pin = null, state = null, muted = false;
  let map = null, round = null;
  let roster = {};            // idx → { name, skin, side, on }
  let kids = {};              // idx → { x, y, tx, ty, f, flags, moving }
  let balls = [], fx = [], chest = null;
  let captains = null, counts = { sun: 0, ice: 0, total: 0 };
  let freezesBy = {};         // idx → freezes this round (from sn:hit)
  let paused = false, spellCast = false, spellAt = 0, firstFreezeSaid = false;
  let canvas = null, g2 = null, raf = 0, lastFrame = 0;
  let timerInterval = null, warned = {};
  let music = null, musicName = null, heart = null;
  let lobbyPlayers = {};

  // ---------- sound ----------
  const lastSfx = {};
  function sfx(name, vol, gap) {
    if (muted || !SFX[name]) return;
    const now = Date.now();
    if (gap && now - (lastSfx[name] || 0) < gap) return;     // 30 kids throwing: never a wall of noise
    lastSfx[name] = now;
    try { const a = new Audio(SFX[name]); a.volume = vol || 0.6; a.play().catch(() => {}); } catch (_) {}
  }
  function playMusic(url, vol) {
    if (musicName === url) return;
    stopMusic();
    musicName = url;
    if (muted) return;
    try { music = new Audio(url); music.loop = true; music.volume = vol || 0.4; music.play().catch(() => {}); } catch (_) {}
  }
  function stopMusic() { if (music) { try { music.pause(); } catch (_) {} } music = null; musicName = null; }
  function heartbeat(on) {
    if (heart) { try { heart.pause(); } catch (_) {} heart = null; }
    if (!on || muted) return;
    try { heart = new Audio(SN + 'heartbeat.mp3'); heart.loop = true; heart.volume = 0.55; heart.play().catch(() => {}); } catch (_) {}
  }
  const LOBBY_MUSIC = A + 'music-lobby.mp3', BATTLE_MUSIC = SN + 'music-battle.mp3', FINAL_MUSIC = A + 'music-final.mp3';
  $('mute-btn').addEventListener('click', () => {
    muted = window.toggleMute ? window.toggleMute() : !muted;
    $('mute-btn').textContent = muted ? '🔇 Sin sonido' : '🔊 Sonido';
    if (muted) { stopMusic(); heartbeat(false); } else if (!$('screen-lobby').classList.contains('hidden')) playMusic(LOBBY_MUSIC, 0.35);
  });
  document.addEventListener('click', () => {
    if (window.unlockAudio) window.unlockAudio();
    if (!$('screen-lobby').classList.contains('hidden')) playMusic(LOBBY_MUSIC, 0.35);
  }, { once: true });

  // ---------- room ----------
  const params = new URLSearchParams(location.search);
  const setId = params.get('setId');
  // From /maestro the page opens with ?livegame=1 (pull the class in): keep that flag through the question picker.
  const LIVE = params.get('livegame') === '1' ? '&livegame=1' : '';
  if (!setId) { location.href = '/packs.html?game=snow' + LIVE; return; }
  R.preload();
  const fmtDur = (v) => (v % 60 ? `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')} min` : `${v / 60} min`);
  socket.emit('host:create', { gameType: 'snow' }, ({ pin: p }) => {
    pin = p;
    $('pin-display').textContent = p;
    $('active-pin-display').textContent = p;
    $('join-url').textContent = `${location.origin}/?pin=${p}`;
    document.title = `Batalla de Nieve · ${p}`;
    socket.emit('host:set-duration', { pin, duration: +$('duration-slider').value });
    socket.emit('host:load-set', { pin, setId }, (resp) => {
      if (!resp || !resp.ok) { alert('No se pudo cargar la serie de preguntas.'); location.href = '/packs.html?game=snow' + LIVE; return; }
      $('set-display').textContent = `📚 ${resp.title} · ${resp.count} preguntas`;
      updateStartBtn();
    });
  });
  // Wifi blip on the projector: reclaim the same room (the server re-sends sn:init mid-round).
  let connectedOnce = false;
  socket.on('connect', () => { if (connectedOnce && pin) socket.emit('host:reclaim', { pin }, () => {}); connectedOnce = true; });
  $('duration-slider').addEventListener('input', (e) => { $('duration-value').textContent = fmtDur(+e.target.value); });
  $('duration-slider').addEventListener('change', (e) => socket.emit('host:set-duration', { pin, duration: +e.target.value }));
  $('start-btn').addEventListener('click', () => { $('start-btn').disabled = true; socket.emit('host:start', { pin }); });
  $('add-time-btn').addEventListener('click', () => { socket.emit('host:add-time', { pin, seconds: 30 }); banner('+30 segundos ⏱'); });
  $('end-now-btn').addEventListener('click', () => { if (confirm('¿Terminar la ronda ahora?')) socket.emit('host:end-now', { pin }); });
  $('pause-btn').addEventListener('click', () => socket.emit('host:pause', { pin, paused: !paused }));
  $('resume-btn').addEventListener('click', () => socket.emit('host:pause', { pin, paused: false }));
  $('play-again-btn').addEventListener('click', () => {
    socket.emit('host:reset', { pin });
    heartbeat(false);
    showScreen('lobby');
    playMusic(LOBBY_MUSIC, 0.35);
  });
  socket.on('host:start-error', (e) => { alert(e && e.message ? e.message : 'No se pudo empezar.'); updateStartBtn(); });

  function updateStartBtn() {
    if (!state) return;
    $('start-btn').disabled = !(state.state === 'lobby' && state.questionsLoaded > 0 && Object.keys(state.players || {}).length > 0);
  }
  socket.on('state', (s) => {
    state = s;
    if (s.state === 'lobby') { renderLobby(s.players); updateStartBtn(); }
  });
  // lobby: one pool of kids, each shown as the saga character they'll walk as
  function renderLobby(map_) {
    const key = JSON.stringify(map_ || {});
    if (key === JSON.stringify(lobbyPlayers)) return;
    lobbyPlayers = JSON.parse(key);
    const box = $('players-all');
    box.innerHTML = '';
    const list = Object.values(map_ || {}).filter((p) => !p.off);   // phones that left don't count as players
    $('count-all').textContent = list.length === 1 ? '1 jugador' : `${list.length} jugadores`;
    box.classList.toggle('dense', list.length > 16);          // a whole class still fits on the projector
    box.classList.toggle('xdense', list.length > 28);
    list.forEach((p) => {
      const chip = document.createElement('span');
      chip.className = 'sn-chip';
      const im = document.createElement('img');
      im.src = R.SKIN_URL(M.skinFor(p.avatar, p.name));
      im.alt = '';
      chip.append(im, document.createTextNode(p.name));
      box.appendChild(chip);
    });
    // the 3rd step shows one of the kids' own characters frozen
    if (list.length) $('howto-frost').src = R.SKIN_URL(M.skinFor(list[0].avatar, list[0].name));
  }

  // ---------- captains + countdown ----------
  socket.on('sn:captains', (c) => { captains = c; paintCaptains(true); });
  function paintCaptains(intro) {
    const ok = !!(captains && Cast);
    ['sun', 'ice'].forEach((side) => {
      $('cap-' + side).classList.toggle('hidden', !ok);
      $('side-cap-' + side).classList.toggle('hidden', !ok);
      if (!ok) { $('side-capname-' + side).textContent = ''; return; }
      const id = captains[side];
      $('cap-' + side + '-img').src = Cast.pose(id, 'cheer');
      $('cap-' + side + '-name').textContent = Cast.captain(id);
      $('side-cap-' + side).src = Cast.pose(id, 'hello');
      $('side-capname-' + side).textContent = Cast.captain(id);
      if (intro) { const el = $('cap-' + side); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; }
    });
  }
  socket.on('countdown', () => {
    showScreen('countdown');
    stopMusic();
    heartbeat(false);
    let n = 3;
    const num = $('countdown-num');
    const tick = () => {
      num.style.animation = 'none'; void num.offsetWidth; num.style.animation = '';
      if (n > 0) { num.textContent = n; sfx('tick', 0.9); n--; setTimeout(tick, 900); }
      else {
        num.textContent = '¡A jugar!'; num.classList.add('go'); sfx('whoosh', 0.9);
        setTimeout(() => { num.classList.remove('go'); showScreen('active'); startTimer(); playMusic(BATTLE_MUSIC, 0.32); resize(); }, 900);
      }
    };
    tick();
  });

  // ---------- the map ----------
  socket.on('sn:init', (d) => {
    const same = round === d.round && map;
    round = d.round;
    if (!same) { map = M.buildMap(d.seed); kids = {}; balls = []; fx = []; freezesBy = {}; firstFreezeSaid = false; sidesKey = ''; }
    roster = d.players || {};
    counts = d.counts || counts;
    chest = d.chest ? Object.assign({}, d.chest) : null;
    paused = !!d.paused;
    spellCast = !!d.spellCast;
    spellAt = Date.now() + (d.spellInMs || 0);
    if (d.captains) { captains = d.captains; paintCaptains(false); }
    applyPos(d.pos || [], true);
    canvas = $('sn-host-canvas');
    g2 = canvas.getContext('2d');
    resize();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
    renderSides();
    showPaused(paused);
    // a projector that reconnected mid-round (missed 'countdown') would sit on the lobby: go to the map
    if (state && state.state === 'active' && $('screen-active').classList.contains('hidden') && $('screen-countdown').classList.contains('hidden')) {
      showScreen('active'); startTimer(); playMusic(BATTLE_MUSIC, 0.32);
    }
    if (!same) say('¡Bienvenidos a Ski Dubái! Junten copos en las estaciones ❓ antes del Hechizo de Hielo…', 'pointing');
  });
  function applyPos(arr, snap) {
    const seen = {};
    arr.forEach(([idx, x, y, f, fl]) => {
      seen[idx] = 1;
      const k = kids[idx] || (kids[idx] = { x, y, tx: x, ty: y, f, flags: fl });
      if (snap || Math.hypot(x - k.x, y - k.y) > 160) { k.x = x; k.y = y; }     // teleports (respawn) jump, walks glide
      k.tx = x; k.ty = y; k.f = f; k.flags = fl;
    });
    Object.keys(kids).forEach((i) => { if (!seen[i]) delete kids[i]; });
  }
  socket.on('sn:tick', (arr) => applyPos(arr, false));
  socket.on('sn:roster', (d) => { roster = d.players || roster; counts = d.counts || counts; renderSides(); });
  socket.on('sn:ball', (b) => {
    balls.push({ id: b.id, side: b.side, x0: b.x, y0: b.y, dx: b.dx, dy: b.dy, range: b.range, speed: b.speed, t0: performance.now(), x: b.x, y: b.y });
    sfx('throw', 0.25, 220);
  });
  function addFx(kind, x, y, extra) { fx.push(Object.assign({ kind, x, y, t0: performance.now(), dur: kind === 'freeze' ? 900 : kind === 'plus' ? 1100 : 500, seed: Math.random() * 6 }, extra || {})); }
  let lastBanner = 0;
  socket.on('sn:hit', (h) => {
    balls = balls.filter((b) => b.id !== h.ball);
    if (h.type === 'splash') { addFx('splash', h.x, h.y); sfx('hit', 0.22, 160); return; }
    addFx(h.type === 'bonk' ? 'splash' : h.type, h.x, h.y);
    if (h.type === 'brrr') sfx('hit', 0.5, 120);
    else if (h.type === 'stun') { sfx('stun', 0.5, 150); }
    else if (h.type === 'shield' || h.type === 'armor') sfx('pop', 0.35, 200);
    else if (h.type === 'freeze') {
      sfx('freeze', 0.8);
      if (roster[h.target]) roster[h.target].side = 'ice';
      freezesBy[h.by] = (freezesBy[h.by] || 0) + 1;
      counts = { sun: Math.max(0, counts.sun - 1), ice: counts.ice + 1, total: counts.total };
      addFx('plus', h.x, h.y, { text: '❄️', color: '#bfeaff' });
      const now = Date.now();
      if (now - lastBanner > 2500) { lastBanner = now; banner(`❄️ ¡${h.byName} congeló a ${h.targetName}!`, 'ice'); }
      if (!firstFreezeSaid) {
        firstFreezeSaid = true;
        const ic = captains && captains.ice;
        say(`¡Primer congelado! ${h.targetName} ya es del Equipo Hielo ❄️` + (ic && Cast ? ` ${Cast.name(ic)}: «${Cast.line(ic, 'win')}»` : ''), 'shocked');
      }
      renderSides();
    }
  });
  socket.on('sn:spell', (d) => {
    spellCast = true;
    (d.kids || []).forEach((k) => { if (roster[k.idx]) roster[k.idx].side = 'ice'; });
    counts = d.counts || counts;
    renderSides();
    $('head-start').classList.add('hidden');
    if ((d.kids || []).length) spellMoment(d.kids, d.again);
  });
  socket.on('sn:moment', (m) => {
    counts = m.counts || counts;
    renderSides();
    if (m.type === 'half') {
      banner(`❄️ ¡La mitad de la clase ya es de hielo!`, 'ice');
      sfx('alert', 0.7);
      const cap = captains && captains.ice;
      if (!(cap && Cast && bigFx('cameo', { char: cap, mood: 'battle', text: '¡La mitad ya es de hielo! ' + Cast.line(cap, 'battle') }))) say('¡La mitad ya es de hielo! Supervivientes: ¡respondan y corran!', 'shocked');
    } else if (m.type === 'last3') {
      const names = (m.kids || []).map((k) => k.name).join(', ');
      banner(`☀️ ¡Último refugio! Quedan ${m.kids.length}: ${names}`, 'sun');
      heartbeat(true);
      bigFx('spotlight', { text: `¡Quedan ${m.kids.length}! ¡Último refugio! ☀️`, poses: ['countdown'] }, 0) || say(`¡Quedan ${m.kids.length}! ${names}: ¡resistan!`, 'countdown');
      playMusic(FINAL_MUSIC, 0.42);
    } else if (m.type === 'last1') {
      const k = (m.kids || [])[0];
      if (k) { banner(`☀️ ¡Solo queda ${k.name}!`, 'sun'); say(`¡Todo depende de ${k.name}! ☀️`, 'shocked'); }
    }
  });
  socket.on('sn:chest', (c) => {
    if (c.id) {
      chest = Object.assign({}, c);
      banner(`🎁 ¡Cofre de hielo en ${ZNAME(c.zone)}! +5 ❄️`);
      sfx('spawn', 0.7);
    } else {
      if (c.taken) { addFx('chest', c.x, c.y); addFx('plus', c.x, c.y, { text: '+5 ❄️' }); sfx('chest', 0.7); banner(`🎁 ¡${c.name} abrió el cofre! +5 ❄️`); }
      chest = null;
    }
  });
  socket.on('sn:fx', (d) => {
    const k = kids[d.idx];
    if (!k) return;
    if (d.type === 'racha') { addFx('plus', k.x, k.y, { text: '¡Racha!', color: '#ff9f1c' }); sfx('streak', 0.4, 400); }
    if (d.type === 'job') addFx('plus', k.x, k.y, { text: d.kind === 'pearl' ? '+1 🦪' : '+1 🌴' });
  });
  socket.on('sn:pause', (d) => {
    paused = !!d.paused;
    balls = [];
    if (typeof d.spellInMs === 'number' && !spellCast) spellAt = Date.now() + d.spellInMs;
    showPaused(paused);
  });
  function showPaused(on) {
    $('paused').classList.toggle('hidden', !on);
    $('pause-btn').textContent = on ? '▶ Seguir' : '⏸ Pausa';
    if (on) { stopMusic(); heartbeat(false); } else if (!$('screen-active').classList.contains('hidden')) playMusic(BATTLE_MUSIC, 0.32);
  }

  // the side panels: who still runs, who is ice (the most freezes first)
  let sidesKey = '';
  function renderSides() {
    const list = Object.entries(roster).filter(([, p]) => p.on !== false);
    const sun = list.filter(([, p]) => p.side === 'sun').map(([i, p]) => Object.assign({ idx: +i }, p));
    const ice = list.filter(([, p]) => p.side === 'ice').map(([i, p]) => Object.assign({ idx: +i }, p));
    ice.sort((a, b) => (freezesBy[b.idx] || 0) - (freezesBy[a.idx] || 0));
    counts = { sun: sun.length, ice: ice.length, total: sun.length + ice.length };
    const key = JSON.stringify([sun.map((p) => p.idx), ice.map((p) => [p.idx, freezesBy[p.idx] || 0])]);
    paintFrost();
    if (key === sidesKey) return;
    sidesKey = key;
    $('count-sun').textContent = sun.length;
    $('count-ice').textContent = ice.length;
    fillRoster($('roster-sun'), sun, false);
    fillRoster($('roster-ice'), ice, true);
  }
  function fillRoster(ul, arr, ice) {
    ul.innerHTML = '';
    arr.slice(0, 9).forEach((p, i) => {
      const li = document.createElement('li');
      if (ice && i === 0 && (freezesBy[p.idx] || 0) > 0) li.className = 'king';
      const n = document.createElement('span');
      const im = document.createElement('img');
      im.src = R.SKIN_URL(p.skin); im.alt = ''; im.className = 'sn-av' + (ice ? ' ice' : '');
      n.append(im, document.createTextNode((ice && i === 0 && (freezesBy[p.idx] || 0) > 0 ? '👑 ' : '') + p.name));
      const sc = document.createElement('span');
      sc.textContent = ice ? (freezesBy[p.idx] ? '❄ ' + freezesBy[p.idx] : '') : '☀️';
      li.append(n, sc);
      ul.appendChild(li);
    });
    if (arr.length > 9) { const li = document.createElement('li'); li.textContent = `+${arr.length - 9} más`; ul.appendChild(li); }
  }
  function paintFrost() {
    const t = Math.max(1, counts.total);
    $('frost-fill').style.width = Math.round((counts.ice / t) * 100) + '%';
    $('frost-text').textContent = `❄️ ${counts.ice} / ${counts.total} congelados`;
  }

  function resize() {
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (r.width < 2) return;
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
  }
  window.addEventListener('resize', resize);

  function draw() {
    raf = requestAnimationFrame(draw);
    if (!map || !g2 || $('screen-active').classList.contains('hidden')) return;
    const now = performance.now();
    const dt = Math.min(0.1, (now - (lastFrame || now)) / 1000);
    lastFrame = now;
    step(dt, now);
    render(now);
  }
  function step(dt, now) {
    Object.values(kids).forEach((k) => {
      const d = Math.hypot(k.tx - k.x, k.ty - k.y);
      k.moving = d > 1.5;
      const a = Math.min(1, dt * 10);
      k.x += (k.tx - k.x) * a; k.y += (k.ty - k.y) * a;
    });
    balls = balls.filter((b) => {
      const dist = Math.min(b.range, (b.speed * (now - b.t0)) / 1000);
      b.x = b.x0 + b.dx * dist; b.y = b.y0 + b.dy * dist;
      return dist < b.range && now - b.t0 < 3000;
    });
    fx = fx.filter((f) => now - f.t0 < f.dur);
    // head start: «¡Junten copos!» countdown on the map until the spell
    if (!spellCast) {
      const left = Math.ceil((spellAt - Date.now()) / 1000);
      const hs = $('head-start');
      hs.classList.toggle('hidden', !(left > 0 && !paused));
      if (left > 0) $('head-start-n').textContent = left;
    }
  }
  function render(now) {
    const cw = canvas.width, ch = canvas.height, T = map.tile;
    const s = Math.min(cw / (map.cols * T), ch / (map.rows * T));
    const ox = (cw - map.cols * T * s) / 2, oy = (ch - map.rows * T * s) / 2;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    g2.setTransform(1, 0, 0, 1, 0, 0);
    g2.fillStyle = '#cfe9f7';
    g2.fillRect(0, 0, cw, ch);
    g2.setTransform(s, 0, 0, s, ox, oy);
    const list = Object.entries(kids).map(([idx, k]) => {
      const p = roster[idx] || {};
      return { idx: +idx, x: k.x, y: k.y, f: k.f, flags: k.flags, moving: k.moving, skin: p.skin || 'dralingo', name: p.name || '' };
    });
    const armor = counts.total > 0 && counts.ice <= counts.total * 0.2;   // core/snow.js R.ARMOR_RATIO
    R.world(g2, { map, kids: list, balls, fx, chest, now, armor }, { s: s / dpr }, {
      groundScale: Math.max(1, Math.min(2, Math.ceil(s * 2) / 2)), tag: 15, size: 56, big: true, labels: true, labelSize: 15,
    });
  }

  // ---------- timer ----------
  function startTimer() {
    warned = {};
    $('timer-display').classList.remove('urgent');
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!state || !state.endsAt || paused) return;
      const left = Math.max(0, state.endsAt - Date.now());
      const sec = Math.ceil(left / 1000);
      $('timer-display').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      if (sec === 60 && !warned[60]) { warned[60] = 1; banner('⏱ ¡Queda 1 minuto!'); }
      if (sec === 30 && !warned[30]) {
        warned[30] = 1;
        banner('⏱ ¡Quedan 30 segundos!');
        const sc = captains && captains.sun;
        (sc && Cast && bigFx('cameo', { char: sc, mood: 'battle', text: '¡Últimos 30 segundos! ' + Cast.line(sc, 'battle') }, 0))
          || bigFx('spotlight', { text: '¡Últimos 30 segundos! ¡Resistan! ☀️', poses: ['countdown'] }, 0) || say('¡Últimos 30 segundos! Supervivientes: ¡resistan!', 'countdown');
        playMusic(FINAL_MUSIC, 0.42);
      }
      if (sec <= 10 && sec > 0 && !warned['t' + sec]) { warned['t' + sec] = 1; sfx('tick', 0.5); $('timer-display').classList.add('urgent'); }
      if (sec > 10) $('timer-display').classList.remove('urgent');
    }, 250);
  }

  // ---------- the Hechizo de Hielo (big moment) ----------
  function spellMoment(list, again) {
    sfx('spell', 0.8);
    const box = $('spell');
    $('spell-title').textContent = again ? '¡El hechizo vuelve!' : '¡Hechizo de Hielo!';
    const row = $('spell-kids');
    row.innerHTML = '';
    list.forEach((k) => {
      const d = document.createElement('div');
      d.className = 'sn-spell-kid';
      const im = document.createElement('img');
      im.src = R.SKIN_URL(k.skin); im.alt = '';
      const b = document.createElement('b'); b.textContent = k.name;
      d.append(im, b);
      row.appendChild(d);
    });
    $('spell-sub').textContent = list.length === 1 ? 'es el Equipo Hielo: ¡corran!' : 'son el Equipo Hielo: ¡corran!';
    box.classList.remove('hidden');
    box.classList.remove('show'); void box.offsetWidth; box.classList.add('show');
    fxAt = Date.now();
    setTimeout(() => { box.classList.add('hidden'); box.classList.remove('show'); }, 3000);
    setTimeout(() => say('¡Supervivientes: respondan para tener copos y lancen bolas de nieve! ☀️', 'pointing'), 3200);
  }

  // ---------- big moments: one at a time, ≥ 7 s apart ----------
  let fxAt = 0;
  function bigFx(kind, opts, gapMs) {
    if (!window.DralingoFX || !$('spell').classList.contains('hidden')) return false;
    const now = Date.now();
    if (now - fxAt < (gapMs == null ? 7000 : Math.max(gapMs, 3200))) return false;
    if (DralingoFX.play(kind, opts)) { fxAt = now; return true; }
    return false;
  }

  // ---------- end ----------
  socket.on('game-end', (d) => {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    stopMusic(); heartbeat(false); hideDralingo();
    $('spell').classList.add('hidden');
    showPaused(false);
    showScreen('win');
    const sn = d.snow || {};
    const c = sn.counts || counts;
    $('final-sun').textContent = c.sun || 0;
    $('final-ice').textContent = c.ice || 0;
    $('mvp-sun').textContent = sn.mvpSun ? `☀️ ${sn.mvpSun.name} · ${sn.mvpSun.seconds} s` : '';
    $('mvp-ice').textContent = sn.mvpIce && sn.mvpIce.freezes > 0 ? `❄️ ${sn.mvpIce.name} · ${sn.mvpIce.freezes} ${sn.mvpIce.freezes === 1 ? 'congelado' : 'congelados'}` : '';
    const sunWon = (sn.winner || d.winner) === 'sun';
    const win = $('win-banner');
    const cap = $('win-cap');
    const capId = captains && captains[sunWon ? 'sun' : 'ice'];
    cap.classList.toggle('hidden', !(capId && Cast));
    if (capId && Cast) { cap.src = Cast.pose(capId, 'cheer'); cap.alt = Cast.captain(capId); }
    $('win-pose').src = POSE('champion');
    $('win-heroes').classList.toggle('frozen', !sunWon);
    const row = $('win-survivors');
    row.innerHTML = '';
    if (sunWon) {
      win.textContent = '¡Sobrevivieron!';
      win.className = 'kd-winner sn-win-sun';
      const n = c.sun || (sn.survivors || []).length;
      $('win-why').textContent = n === 1 ? `¡Solo uno resistió el Hechizo de Hielo: ${sn.survivors[0].name}!` : `${n} supervivientes resistieron el Hechizo de Hielo`;
      // the survivors in one row (12 at most, then «+N»), the heroes a bit smaller so everything fits the projector
      const shown = (sn.survivors || []).slice(0, 12);
      shown.forEach((k, i) => {
        const dv = document.createElement('div'); dv.className = 'sn-surv';
        dv.style.animationDelay = (0.25 + i * 0.07) + 's';
        const im = document.createElement('img'); im.src = R.SKIN_URL(k.skin); im.alt = '';
        const b = document.createElement('b'); b.textContent = k.name;
        dv.append(im, b); row.appendChild(dv);
      });
      if (n > shown.length) { const more = document.createElement('div'); more.className = 'sn-surv-more'; more.textContent = `+${n - shown.length}`; row.appendChild(more); }
      row.classList.toggle('hidden', !shown.length);
      $('screen-win').classList.toggle('sn-with-row', !!shown.length);
      confetti(['#ffb020', '#ffd23f', '#fff7e3', '#ff7a00']);
    } else {
      win.textContent = '¡Ganó el Equipo Hielo!';
      win.className = 'kd-winner sn-win-ice';
      $('win-why').textContent = '¡Congelaron a toda la clase! ❄️';
      row.classList.add('hidden');
      $('screen-win').classList.remove('sn-with-row');
      confetti(['#bfeaff', '#ffffff', '#4cc3ff', '#e8f7ff']);
    }
    sfx('win', 0.9);
    const loser = sunWon ? 'ice' : 'sun';
    setTimeout(() => bigFx('gang', {
      text: sunWon ? '¡Sobrevivieron!' : '¡Equipo Hielo!', mood: 'win', stamp: false,
      chars: capId ? [capId] : [], exclude: captains ? [captains[loser]] : [],
    }, 0), 900);
    const lb = $('leaderboard');
    lb.innerHTML = '';
    (sn.top || []).slice(0, 6).forEach((p, i) => {
      const r = document.createElement('div'); r.className = 'kd-lb-row';
      const rank = document.createElement('span'); rank.textContent = ['🥇', '🥈', '🥉'][i] || '#' + (i + 1);
      const name = document.createElement('span');
      const im = document.createElement('img'); im.src = R.SKIN_URL(p.skin); im.alt = ''; im.className = 'sn-av' + (p.side === 'ice' ? ' ice' : '');
      name.append(im, document.createTextNode(p.name + (p.side === 'ice' ? ' ❄️' : ' ☀️')));
      const sc = document.createElement('span'); sc.textContent = `${p.score} puntos`;
      r.append(rank, name, sc); lb.appendChild(r);
    });
  });

  // ---------- fx ----------
  let bannerTimer = null;
  function banner(text, side) {
    document.querySelectorAll('.kd-banner').forEach((b) => b.remove());
    const b = document.createElement('div');
    b.className = 'kd-banner' + (side ? ' sn-' + side : '');
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
    $('dralingo-img').src = POSE(pose || 'pointing');
    $('dralingo').classList.add('show');
    clearTimeout(sayTimer);
    sayTimer = setTimeout(hideDralingo, 4200);
  }
  function hideDralingo() { $('dralingo').classList.remove('show'); }
  function confetti(colors) {
    for (let i = 0; i < 80; i++) {
      const c = document.createElement('div');
      c.className = 'kd-confetti';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = 2.2 + Math.random() * 2 + 's';
      c.style.animationDelay = Math.random() * 1.2 + 's';
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 5600);
    }
  }
  // gentle falling snow on the lobby/end (a still frame when the class asks for less motion)
  (function snowfall() {
    const box = $('snowfall');
    if (!box || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    for (let i = 0; i < 26; i++) {
      const f = document.createElement('i');
      f.style.left = Math.random() * 100 + 'vw';
      f.style.animationDuration = 7 + Math.random() * 8 + 's';
      f.style.animationDelay = -Math.random() * 12 + 's';
      f.style.opacity = 0.5 + Math.random() * 0.5;
      f.style.transform = `scale(${0.5 + Math.random()})`;
      box.appendChild(f);
    }
  })();
  function showScreen(name) {
    ['lobby', 'countdown', 'active', 'win'].forEach((n) => $('screen-' + n).classList.toggle('hidden', n !== name));
    document.body.classList.toggle('sn-playing', name === 'active');
  }

  // test hook for headless screenshots (a browser here barely runs animation frames): draw now, read the state
  window.SnowHost = {
    frame: () => { if (map && g2) { step(0.05, performance.now()); render(performance.now()); } return { kids: Object.keys(kids).length, balls: balls.length, counts }; },
    debug: () => ({ pin, round, counts, roster, chest, paused, spellCast }),
    // screenshots: a test can hold the countdown on «3» (captains in) and then jump to the map
    skipCountdown: () => { showScreen('active'); startTimer(); resize(); return true; },
  };
})();
