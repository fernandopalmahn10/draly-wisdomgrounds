// Mochi Mash v2 — the projector (secondary: the phones are the product). Lobby (PIN + QR, the 3 steps, 2 / 3 / 4 min, the
// two teams as full-body characters: tap one to change team) → the terrace: the teams run in, the rules card «¡Toca
// rápido!» → «¿Listos?» → «¡YA!» → the game: the tug meter, the two Dragoncitos growing on their plates, mochis flying
// from the kids who feed, the landmark ruler, lead-change / landmark / last-30-s bands, Dralingo's lines → «¡FINAL!» →
// the ceremony: the weigh-in, «¡Gana el Equipo …!», the bonus stars one by one, the podium. Teacher: Pausa (holds every
// clock), +30 s, Saltar (the intro, the ceremony), Terminar, Sonido, Otra ronda.
// Test hooks: MochiHost.frame(), .freeze(v) / .replay(ev), .hold(v), .stage(name).
(function () {
  'use strict';
  const socket = io();
  const $ = (id) => document.getElementById(id);
  const S = window.MochiStage;
  const A = '/assets/mochi/', K = '/assets/kingdoms/', H = '/assets/halcon/';
  const reduced = S.reduced;
  const STAR_MS = 2200, WEIGH_MS = 3400, RESULT_MS = 2800;
  const TEAM_NAME = { red: 'Fuego', gold: 'Mar' };

  let pin = null, state = null, muted = false, duration = 180, paused = false;
  let g = null;                         // { id, phase, E, landmarks, frenzy, endAt (perf), pausedLeft }
  let totals = { r: 0, g: 0 };
  let roster = {};                      // k → { k, name, avatar, team, off }
  let figs = {};                        // k → kid figure on the deck
  let dragons = {}, flyer = null, timers = [], lobbyKey = '', crowdKey = '', seen = new Set();
  let frozen = false, queue = [], testHold = false;
  const handlers = {};                  // test hook sim(ev, d)
  const onMm = (ev, fn) => { handlers[ev] = fn; socket.on(ev, (d) => { if (frozen) { queue.push([fn, d, ev]); return; } fn(d); }); };
  const later = (ms, fn) => { const t = setTimeout(fn, Math.max(0, ms)); timers.push(t); return t; };
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  // ---------- sound ----------
  const SFX = {
    tick: K + 'tick.mp3', whoosh: K + 'whoosh.mp3', win: K + 'sting-win.mp3', flag: K + 'flag.mp3', alert: K + 'castle-alert.mp3',
    landmark: K + 'landmark.mp3', siege: K + 'siege.mp3', start: H + 'start.mp3', final: H + 'final.mp3', aww: H + 'aww.mp3', yes: H + 'yes.mp3',
    round: H + 'round.mp3', drum: A + 'drum.mp3', star: A + 'star.mp3', gold: A + 'gold.mp3', pop: A + 'pop.mp3',
  };
  const MUSIC = { lobby: K + 'music-lobby.mp3', play: A + 'music-mash.mp3', final: K + 'music-final.mp3' };
  let music = null, musicName = null;
  const lastSfx = {};
  function sfx(name, vol, gap) {
    if (muted || !SFX[name]) return;
    const now = Date.now();
    if (gap && now - (lastSfx[name] || 0) < gap) return;
    lastSfx[name] = now;
    try { const a = new Audio(SFX[name]); a.volume = vol || 0.6; a.play().catch(() => {}); } catch (_) {}
  }
  function playMusic(name, vol) {
    if (musicName === name) return;
    stopMusic();
    musicName = name;
    if (muted || !MUSIC[name]) return;
    try { music = new Audio(MUSIC[name]); music.loop = true; music.volume = vol || 0.3; music.play().catch(() => {}); } catch (_) {}
  }
  function stopMusic() { if (music) { try { music.pause(); } catch (_) {} } music = null; musicName = null; }
  function musicFor() {
    if (muted || paused) return;
    if (!$('screen-lobby').classList.contains('hidden')) playMusic('lobby', 0.3);
    else if (!$('screen-stage').classList.contains('hidden') && g && g.phase === 'play') playMusic(g.frenzy ? 'final' : 'play', g.frenzy ? 0.36 : 0.3);
    else if (!$('screen-win').classList.contains('hidden')) playMusic('final', 0.26);
  }
  $('mute-btn').addEventListener('click', () => {
    muted = window.toggleMute ? window.toggleMute() : !muted;
    $('mute-btn').querySelector('span').textContent = muted ? 'Sin sonido' : 'Sonido';
    $('mute-btn').setAttribute('aria-pressed', muted ? 'true' : 'false');
    if (muted) stopMusic(); else musicFor();
  });
  document.addEventListener('click', () => { if (window.unlockAudio) window.unlockAudio(); musicFor(); }, { once: true });

  function showScreen(name) {
    ['lobby', 'stage', 'win'].forEach((n) => $('screen-' + n).classList.toggle('hidden', n !== name));
    $('controls').classList.toggle('hidden', name !== 'stage');
    $('endtools').classList.add('hidden');
    $('cer-skip').classList.toggle('hidden', name !== 'win');
    musicFor();
  }
  let sayT = null;
  function say(text, ms) {
    const el = $('host-say');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(sayT);
    sayT = setTimeout(() => el.classList.remove('show'), ms || 3200);
  }
  let bandT = null;
  function band(kind, parts, team, ms) {
    const b = $('band');
    b.className = 'mmh-band ' + kind + (team ? ' ' + team : '');
    b.innerHTML = '';
    parts.forEach((p) => b.appendChild(p));
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(bandT);
    bandT = setTimeout(() => { if (!testHold) b.classList.remove('show'); }, ms || 2200);
  }
  const node = (tag, txt, cls) => S.el(tag, cls, txt);

  // ---------- the room ----------
  const params = new URLSearchParams(location.search);
  const setId = params.get('setId');
  const LIVE = params.get('livegame') === '1' ? '&livegame=1' : '';
  if (!setId) { location.href = '/packs.html?game=mochi-mash' + LIVE; return; }
  function showPin(p) {
    pin = p;
    $('pin-display').textContent = p;
    $('active-pin').textContent = p;
    const url = `${location.origin}/?pin=${p}`;
    $('join-url').textContent = url;
    document.title = `Mochi Mash · ${p}`;
    drawQr(url);
    try { sessionStorage.setItem('mochi.host', JSON.stringify({ pin: p, setId })); } catch (_) {}
  }
  function createRoom() {
    socket.emit('host:create', { gameType: 'mochi-mash' }, ({ pin: p }) => {
      showPin(p);
      socket.emit('host:set-duration', { pin, duration });
      socket.emit('host:load-set', { pin, setId }, (resp) => {
        if (!resp || !resp.ok) { alert('No se pudo cargar la serie de preguntas.'); location.href = '/packs.html?game=mochi-mash' + LIVE; return; }
        $('set-display').textContent = `${resp.title} · ${resp.count} preguntas`;
        updateStartBtn();
      });
    });
  }
  // A reload of this tab (F5 mid-class) takes the same room back instead of opening a new PIN: the kids keep playing
  // and the teacher keeps Pausa / Terminar (the server sends the terrace or the ceremony again on reclaim).
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem('mochi.host') || 'null'); } catch (_) {}
  if (saved && saved.pin && saved.setId === setId) {
    socket.emit('host:reclaim', { pin: saved.pin }, (r) => {
      if (r && r.ok && r.gameType === 'mochi-mash') showPin(saved.pin);
      else createRoom();
    });
  } else createRoom();
  function drawQr(url) {
    const box = $('qr');
    try {
      if (!window.qrcode) { box.style.display = 'none'; return; }
      const qr = window.qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    } catch (_) { box.style.display = 'none'; }
  }
  let connectedOnce = false;
  socket.on('connect', () => { if (connectedOnce && pin) socket.emit('host:reclaim', { pin }, () => {}); connectedOnce = true; });
  document.querySelectorAll('.mmh-dur button').forEach((b) => b.addEventListener('click', () => {
    duration = +b.dataset.s;
    document.querySelectorAll('.mmh-dur button').forEach((x) => x.classList.toggle('on', x === b));
    socket.emit('host:set-duration', { pin, duration });
  }));
  $('balance-btn').addEventListener('click', () => socket.emit('host:auto-balance', { pin }));
  $('start-btn').addEventListener('click', () => { $('start-btn').disabled = true; socket.emit('host:start', { pin }); });
  $('pause-btn').addEventListener('click', () => socket.emit('host:pause', { pin, paused: !paused }));
  $('resume-btn').addEventListener('click', () => socket.emit('host:pause', { pin, paused: false }));
  $('more-btn').addEventListener('click', () => socket.emit('host:add-time', { pin, seconds: 30 }));
  $('skip-btn').addEventListener('click', () => {
    const b = $('skip-btn');
    if (b.disabled) return;
    b.disabled = true;
    socket.emit('host:mm-skip', { pin });
    setTimeout(() => { b.disabled = false; }, 800);
  });
  const endNow = () => { if (confirm('¿Terminar la partida ahora?')) socket.emit('host:end-now', { pin }); };
  $('end-now-btn').addEventListener('click', endNow);
  $('paused-end-btn').addEventListener('click', endNow);
  $('cer-skip').addEventListener('click', () => { socket.emit('host:mm-skip', { pin }); stage('podium'); });
  $('home-btn').addEventListener('click', () => { location.href = '/'; });
  $('play-again-btn').addEventListener('click', () => {
    socket.emit('host:reset', { pin });
    clearTimers();
    g = null; totals = { r: 0, g: 0 }; figs = {}; crowdKey = ''; lobbyKey = ''; flying = 0;
    $('crowd-red').innerHTML = ''; $('crowd-gold').innerHTML = '';
    $('cer').innerHTML = '';
    showScreen('lobby');
  });
  socket.on('host:start-error', (e) => { alert(e && e.message ? e.message : 'No se pudo empezar.'); updateStartBtn(); });
  function updateStartBtn() {
    if (!state) return;
    $('start-btn').disabled = !(state.state === 'lobby' && state.questionsLoaded > 0 && Object.values(state.players || {}).some((p) => !p.off));
  }
  socket.on('state', (s) => {
    state = s;
    if (s.setTitle && /Cargando/.test($('set-display').textContent)) $('set-display').textContent = `${s.setTitle} · ${s.questionsLoaded} preguntas`;   // (a reclaimed room)
    const list = Object.values(s.players || {});
    roster = {};
    list.forEach((p) => { if (p.k) roster[p.k] = { k: p.k, name: p.name, avatar: p.avatar, team: p.team, off: !!p.off, skin: p.sk || S.skinFor(p.avatar, p.name) }; });
    if (s.state === 'lobby') {
      if ([120, 180, 240].includes(s.duration)) {          // the picker shows the room's time (after a reload / «Otra ronda»)
        duration = s.duration;
        document.querySelectorAll('.mmh-dur button').forEach((x) => x.classList.toggle('on', +x.dataset.s === s.duration));
      }
      renderLobby(list);
      updateStartBtn();
    }
    else if (g && (s.state === 'active')) renderCrowds(false);
  });

  // ---------- lobby ----------
  let pvDragons = null;
  function renderLobby(players) {
    if (!pvDragons) {
      pvDragons = { red: new S.Dragon($('pv-red'), { team: 'red', size: 0.4 }), gold: new S.Dragon($('pv-gold'), { team: 'gold', size: 0.4 }) };
      S.preloadDragons();
    }
    const list = players.filter((p) => !p.off);
    const key = JSON.stringify(list.map((p) => [p.name, p.avatar, p.team]));
    if (key === lobbyKey) return;
    lobbyKey = key;
    ['red', 'gold'].forEach((team) => {
      const box = $('kids-' + team);
      box.innerHTML = '';
      const mine = list.filter((p) => p.team === team);
      $('count-' + team).textContent = mine.length === 1 ? '1 jugador' : `${mine.length} jugadores`;
      box.classList.toggle('dense', mine.length > 8);          // a big class still fits without scrolling
      box.classList.toggle('denser', mine.length > 12);
      mine.forEach((p) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'mmh-kid' + (seen.has(p.name) ? '' : ' new');
        b.setAttribute('aria-label', `${p.name}: pasar al Equipo ${team === 'red' ? 'Mar' : 'Fuego'}`);
        seen.add(p.name);
        b.appendChild(S.kidFigure({ team, skin: p.sk || S.skinFor(p.avatar, p.name), name: p.name }));
        b.appendChild(node('i', '⇄', 'mmh-kid-swap'));
        // the socket id at click time (a kid who reconnected in the lobby has a new one)
        b.addEventListener('click', () => {
          const id = state && Object.keys(state.players).find((sid) => state.players[sid].name === p.name);
          if (id) socket.emit('host:swap-team', { pin, playerId: id });
        });
        box.appendChild(b);
      });
      if (!mine.length) box.appendChild(node('p', 'Esperando jugadores: entren con el PIN.', 'mmh-empty'));
    });
  }

  // ---------- the terrace ----------
  function buildStage() {
    if (!dragons.red) {
      dragons.red = new S.Dragon($('plate-red'), { team: 'red', size: 0 });
      dragons.gold = new S.Dragon($('plate-gold'), { team: 'gold', size: 0 });
      flyer = new S.Flyer($('fly'), 40);
    }
    dragons.red.grow(0, true); dragons.gold.grow(0, true);
    dragons.red.setPose('hungry'); dragons.gold.setPose('hungry');
    $('screen-stage').classList.remove('frenzy');
    paintMeter();
  }
  // the kids on the deck (two crowds under their plates); rebuilt only when who-is-where changes
  function renderCrowds(runIn) {
    const list = Object.values(roster);
    const key = JSON.stringify(list.map((p) => [p.k, p.team, p.off, p.avatar]));
    if (key === crowdKey && !runIn) return;
    crowdKey = key;
    ['red', 'gold'].forEach((team) => {
      const box = $('crowd-' + team);
      box.innerHTML = '';
      const mine = list.filter((p) => p.team === team).sort((a, b) => a.off - b.off || a.k - b.k);
      const n = Math.min(mine.length, 16);
      const rows = n > 8 ? 2 : 1;
      const perRow = Math.ceil(n / rows) || 1;
      const avail = window.innerWidth * 0.38 - 2 * (perRow - 1) - (mine.length > 16 ? 50 : 0);   // every kid of a row fits (no wrap)
      const kw = Math.max(44, Math.min(120, Math.floor(avail / perRow)));
      box.style.setProperty('--kw', kw + 'px');
      box.style.setProperty('--kh', (rows === 2 ? Math.round(window.innerHeight * 0.105) : Math.round(window.innerHeight * 0.2)) + 'px');
      mine.slice(0, 16).forEach((p, i) => {
        let f = figs[p.k];
        const skin = p.skin || S.skinFor(p.avatar, p.name);
        if (!f || f._team !== team || f._skin !== skin) {
          f = S.kidFigure({ team, skin, name: p.name });
          f._team = team;
          figs[p.k] = f;
        }
        f.classList.toggle('off', p.off);
        if (runIn && !reduced()) {
          f.style.animation = 'none';
          void f.offsetWidth;
          f.style.animation = `mm-run .7s var(--mm-ease-out) ${0.2 + i * 0.06}s both`;
          f.style.setProperty('--from', team === 'red' ? '-50vw' : '50vw');
        }
        box.appendChild(f);
      });
      if (mine.length > 16) box.appendChild(node('span', `+${mine.length - 16}`, 'mmh-more'));
    });
  }
  window.addEventListener('resize', () => { if (g && !$('screen-stage').classList.contains('hidden')) { crowdKey = ''; renderCrowds(false); } });
  function paintMeter() {
    const sum = totals.r + totals.g;
    $('m-red').textContent = S.fmt(totals.r);
    $('m-gold').textContent = S.fmt(totals.g);
    $('m-bar').style.transform = `scaleX(${(sum ? totals.r / sum : 0.5).toFixed(3)})`;
    if (!g) return;
    const top = Math.max(1, ...((g.landmarks || []).map((l) => l.at))) * 1.08;
    $('mark-red').style.bottom = Math.min(100, (100 * totals.r) / top) + '%';
    $('mark-gold').style.bottom = Math.min(100, (100 * totals.g) / top) + '%';
    if (dragons.red) {
      dragons.red.grow(S.growth(totals.r, g.E));
      dragons.gold.grow(S.growth(totals.g, g.E));
      const lead = totals.r > totals.g ? 'red' : totals.g > totals.r ? 'gold' : null;
      dragons.red.rest(lead === 'red' ? 'happy' : lead === 'gold' ? 'worried' : 'hungry');
      dragons.gold.rest(lead === 'gold' ? 'happy' : lead === 'red' ? 'worried' : 'hungry');
    }
  }
  function buildRuler() {
    const r = $('ruler');
    r.querySelectorAll('.mmh-lm').forEach((x) => x.remove());
    const top = Math.max(1, ...((g.landmarks || []).map((l) => l.at))) * 1.08;
    (g.landmarks || []).forEach((l) => {
      const d = node('div', null, 'mmh-lm' + (l.team ? ' ' + l.team : ''));
      d.dataset.id = l.id;
      d.style.bottom = ((100 * l.at) / top) + '%';
      const im = node('img');
      im.src = K + 'landmarks/' + l.id + '.webp';
      im.alt = l.name;
      d.append(im, node('span', l.name, 'mmh-lm-name'));
      r.appendChild(d);
    });
  }
  // the clock: mm:ss on the top, the last ten seconds big
  let clockT = null;
  function runClock() {
    clearInterval(clockT);
    const paint = () => {
      if (!g || !g.endAt) return;
      const left = paused ? g.pausedLeft : Math.max(0, g.endAt - performance.now());
      const s = Math.ceil(left / 1000);
      $('clock').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      const c = $('count10');
      if (g.phase === 'play' && s <= 10 && s > 0) {
        if (c.textContent !== String(s)) {
          c.textContent = String(s);
          c.classList.remove('hidden', 'tick'); void c.offsetWidth; c.classList.add('tick');
          if (!paused) sfx('tick', 0.6);
        }
      } else c.classList.add('hidden');
    };
    paint();
    clockT = setInterval(paint, 200);
  }

  // ---------- the captains: one of the gang per team, speaking in their own voice (js/cast.js) ----------
  let captains = null;
  const C = () => window.DralingoCast;
  function paintCaptains() {
    ['red', 'gold'].forEach((team) => {
      const box = $('capt-' + team);
      const id = captains && captains[team];
      box.classList.toggle('hidden', !(id && C()));
      if (!id || !C()) return;
      box.querySelector('img').src = C().pose(id, 'hello');
      box.querySelector('img').alt = C().name(id);
      box.querySelector('.mmh-capt-name').textContent = C().captain(id);
    });
  }
  const capT = {};
  function capSay(team, mood, ms) {
    const id = captains && captains[team];
    if (!id || !C()) return;
    const box = $('capt-' + team);
    const sayEl = box.querySelector('.mmh-capt-say');
    sayEl.textContent = C().line(id, mood);
    sayEl.classList.add('show');
    box.querySelector('img').src = C().pose(id, mood === 'oops' ? 'mystery' : 'cheer');
    box.classList.remove('cheer'); void box.offsetWidth; if (mood !== 'oops') box.classList.add('cheer');
    clearTimeout(capT[team]);
    capT[team] = setTimeout(() => { sayEl.classList.remove('show'); box.querySelector('img').src = C().pose(id, 'hello'); }, ms || 3200);
  }
  socket.on('mm:captains', (c) => { captains = c; paintCaptains(); });

  // ---------- countdown: the teams run in on the terrace ----------
  socket.on('countdown', () => {
    clearTimers();
    stopMusic();
    g = { id: null, phase: 'countdown', E: 1, landmarks: [], frenzy: false, endAt: 0, pausedLeft: 0 };
    flying = 0;
    totals = { r: 0, g: 0 };
    buildStage();
    showScreen('stage');
    $('skip-btn').classList.add('hidden');
    $('more-btn').classList.add('hidden');
    clearInterval(clockT);
    const dur = (state && state.duration) || duration;
    $('clock').textContent = `${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, '0')}`;   // the picked time, not the last round's
    $('count10').classList.add('hidden');
    renderCrowds(true);
    paintCaptains();
    later(700, () => { capSay('red', 'hello', 2600); capSay('gold', 'hello', 2600); });
    say('¡Alimenten a su dragoncito! ¡Fuego contra Mar!', 3400);
    sfx('whoosh', 0.7);
    later(900, () => sfx('round', 0.5));
  });

  // ---------- the game ----------
  onMm('mm:init', (d) => {
    g = { id: d.id, phase: d.phase, E: d.E, landmarks: d.landmarks || [], frenzy: !!d.frenzy, endAt: d.endsMs != null ? performance.now() + d.endsMs : 0, pausedLeft: d.endsMs || 0 };
    totals = { r: d.totals.r, g: d.totals.g };
    (d.roster || []).forEach((p) => { roster[p.k] = Object.assign(roster[p.k] || {}, { k: p.k, name: p.name, team: p.team, off: !p.on, skin: p.skin }); });
    flying = 0;
    if (d.captains) { captains = d.captains; paintCaptains(); }
    buildStage();
    showScreen('stage');
    buildRuler();
    paintMeter();
    renderCrowds(false);
    setPaused(!!d.paused, d);
    $('screen-stage').classList.toggle('frenzy', g.frenzy);
    $('skip-btn').classList.toggle('hidden', d.phase !== 'intro');
    $('more-btn').classList.toggle('hidden', d.phase !== 'play');      // «+30 s» only while playing (setPaused shows the intro card)
    if (d.phase === 'intro' && d.duration) $('clock').textContent = `${Math.floor(d.duration / 60)}:${String(Math.round(d.duration) % 60).padStart(2, '0')}`;
    if (d.phase === 'play' || d.phase === 'final') runClock();
    if (d.phase === 'final') band('final', [node('b', '¡FINAL!')], null, 2400);
    musicFor();
  });
  function showRules(ms) {
    const box = $('rules');
    box.innerHTML = '';
    box.classList.remove('hidden');
    const card = node('div', null, 'mmh-rules-card');
    const pic = node('div', null, 'mmi-pic');
    const dr = node('img', null, 'mmi-pic-dragon');
    dr.src = S.dragonArt('red', 'eat');
    dr.alt = '';
    const fly = node('i', null, 'mm-mochi f3 mmi-pic-mochi');
    pic.append(dr, fly, node('i', null, 'mmi-pic-btn'), node('i', null, 'mmi-pic-hand'));
    const txt = node('div');
    txt.append(node('h2', '¡Toca rápido!'), node('p', 'Respondan bien y toquen la pantalla: cada toque lanza un mochi al dragoncito de su equipo.'));
    const sayEl = node('div', '', 'mmh-rules-say');
    txt.appendChild(sayEl);
    card.append(pic, txt);
    box.appendChild(card);
    const total = Math.max(1400, ms || 2800);
    clearRules();
    const rl = (t, fn) => rulesT.push(setTimeout(fn, Math.max(0, t)));
    rl(total - 1250, () => { sayEl.textContent = '¿Listos?'; sfx('tick', 0.7); });
    rl(total - 600, () => { sayEl.textContent = '¡YA!'; sfx('start', 0.85); });
    rl(total + 300, () => { if (!testHold) box.classList.add('hidden'); });
  }
  // the rules card keeps its own timers: «Pausa» and «Saltar» stop its «¿Listos?… ¡YA!»
  let rulesT = [];
  function clearRules() { rulesT.forEach(clearTimeout); rulesT = []; }
  onMm('mm:play', (d) => {
    if (!g) return;
    g.phase = 'play';
    g.endAt = performance.now() + (d.endsMs || 0);
    clearRules();
    $('rules').classList.add('hidden');
    $('skip-btn').classList.add('hidden');
    $('more-btn').classList.remove('hidden');
    runClock();
    musicFor();
    say('¡A responder! Cada respuesta correcta da 5 segundos de mochis.', 3600);
  });
  onMm('mm:meter', (d) => {
    if (!g) return;
    totals = { r: d.r, g: d.g };
    paintMeter();
    (d.f || []).forEach(([k, n, gold]) => feed(k, n, gold));
  });
  // a kid fed n mochis since the last tick: their figure hops and a few mochis fly to their dragoncito
  let flying = 0;
  function feed(k, n, gold) {
    const p = roster[k];
    if (!p || !dragons[p.team]) return;
    const f = figs[k];
    const team = p.team;
    if (f && f.isConnected && !reduced() && f._img.animate) {    // a hop (WAAPI: no forced reflow per feeder per tick)
      f._img.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-10%) scale(1.05, .96)', offset: 0.4 }, { transform: 'translateY(0)' }], { duration: 300, easing: 'cubic-bezier(.22,1,.36,1)' });
    }
    const shots = Math.min(3, Math.max(1, Math.round(n / 3))) + (gold ? 1 : 0);
    for (let i = 0; i < shots; i++) {
      later(i * 70, () => {
        if (flying > 36) return;                  // counted when it really flies (a cleared timer never leaks a slot)
        flying++;
        const src = f && f.isConnected ? f._img.getBoundingClientRect() : $('crowd-' + team).getBoundingClientRect();
        const from = { x: src.left + src.width * 0.5, y: src.top + src.height * 0.35 };
        const isGold = gold && i === shots - 1;
        flyer.fly(from, dragons[team].mouth(), {
          gold: isGold, size: isGold ? 48 : 34, ms: 560, drift: (Math.random() - 0.5) * 80,
          onLand: () => { flying = Math.max(0, flying - 1); dragons[team].chomp(isGold); if (isGold) sfx('gold', 0.5, 200); },
        });
      });
    }
  }
  onMm('mm:lead', (d) => {
    if (d.totals) { totals = { r: d.totals.r, g: d.totals.g }; paintMeter(); }
    const t = TEAM_NAME[d.team];
    band('lead', [node('b', d.first ? `¡El Equipo ${t} toma la delantera!` : `¡El Equipo ${t} pasa adelante!`), node('span', d.first ? '¡Que no se escape!' : '¡Cambio de líder!')], d.team, 2300);
    sfx(d.first ? 'flag' : 'alert', 0.7);
    say(d.first ? `¡${t} va primero! ¡Vamos, ${d.team === 'red' ? 'Mar' : 'Fuego'}!` : `¡Remontada del Equipo ${t}!`);
    capSay(d.team, 'win');
    capSay(d.team === 'red' ? 'gold' : 'red', 'feast');
  });
  onMm('mm:landmark', (d) => {
    if (d.totals) { totals = { r: d.totals.r, g: d.totals.g }; paintMeter(); }
    const l = (g && g.landmarks || []).find((x) => x.id === d.id);
    if (l) l.team = d.team;
    const el = $('ruler').querySelector(`.mmh-lm[data-id="${d.id}"]`);
    if (el) { el.classList.add(d.team, 'won'); }
    const im = node('img');
    im.src = K + 'landmarks/big/' + d.id + '.webp';
    im.alt = '';
    band('landmark', [im, node('b', `¡${d.name}!`), node('span', `El dragoncito del Equipo ${TEAM_NAME[d.team]} llegó primero: +${d.bonus} mochis`)], d.team, 2600);
    sfx('landmark', 0.7);
    say(`¡Tan alto como el ${d.name}!`);
    capSay(d.team, 'feast');
  });
  onMm('mm:frenzy', (d) => {
    if (!g) return;
    g.frenzy = true;
    g.endAt = performance.now() + (d.endsMs || 30000);
    $('screen-stage').classList.add('frenzy');
    band('frenzy', [node('b', '¡ÚLTIMOS 30 SEGUNDOS!'), node('span', '¡Doble mochi! Cada mochi vale 2')], null, 2600);
    sfx('siege', 0.7);
    say('¡Doble mochi! ¡Todo puede cambiar!');
    capSay('red', 'battle', 3600);
    capSay('gold', 'battle', 3600);
    stopMusic();
    musicFor();
  });
  // late joiners early in the game: the race gets longer, the landmarks nobody won yet move up
  onMm('mm:scale', (d) => {
    if (!g || d.id !== g.id) return;
    g.E = d.E;
    g.landmarks = d.landmarks || g.landmarks;
    buildRuler();
    paintMeter();
  });
  onMm('mm:time', (d) => {
    if (!g) return;
    g.endAt = performance.now() + (d.endsMs || 0);
    if (paused) g.pausedLeft = d.endsMs || g.pausedLeft;
    say(`¡${d.add || 30} segundos más!`, 2200);
  });
  onMm('mm:pause', (d) => {
    if (!g) return;
    if (d.endsMs != null) { g.endAt = performance.now() + d.endsMs; g.pausedLeft = d.endsMs; }
    setPaused(d.paused, d);
  });
  function setPaused(v, d) {
    paused = !!v;
    $('paused').classList.toggle('hidden', !paused);
    $('pause-btn').querySelector('span').textContent = paused ? 'Seguir' : 'Pausa';
    if (paused) stopMusic(); else musicFor();
    if (paused) clearRules();
    if (d && d.phase === 'intro' && !paused && d.phaseMs) showRules(d.phaseMs);
  }
  onMm('mm:final', () => {
    if (!g) return;
    clearTimers();
    g.phase = 'final';
    clearInterval(clockT);
    $('clock').textContent = '0:00';
    $('count10').classList.add('hidden');
    setPaused(false);
    band('final', [node('b', '¡FINAL!')], null, 2400);
    sfx('final', 0.9);
    stopMusic();
    say('¡Se acabó! ¿Qué dragoncito comió más?', 2400);
  });

  // ---------- the ceremony ----------
  let end = null;
  socket.on('game-end', (d) => {
    clearTimers();
    clearInterval(clockT);
    setPaused(false);
    $('rules').classList.add('hidden');
    $('band').classList.remove('show');
    end = d || {};
    showScreen('win');
    stopMusic();
    const stars = (end.mochi && end.mochi.stars) || [];
    const plan = [['weigh', WEIGH_MS], ['result', RESULT_MS]].concat(stars.map((s, i) => ['star' + i, STAR_MS]));
    let t = 0;
    plan.forEach(([name, ms]) => { later(t, () => stage(name)); t += ms; });
    later(t, () => stage('podium'));
  });
  function stage(name) {
    if (!end) return;
    const mo = end.mochi || {}, tt = mo.totals || { r: 0, g: 0 };
    const box = $('cer');
    box.innerHTML = '';
    $('cer-fx').innerHTML = '';
    if (name === 'weigh') {
      box.appendChild(node('h2', '¿Qué dragoncito comió más?', 'mmh-cer-h'));
      const row = node('div', null, 'mmh-weigh');
      const max = Math.max(1, tt.r, tt.g);
      ['red', 'gold'].forEach((team) => {
        const v = team === 'red' ? tt.r : tt.g;
        const col = node('div', null, 'mmh-wcol ' + team);
        const wd = node('div', null, 'mmh-wd');
        const im = node('img');
        im.src = S.dragonArt(team, 'eat');
        im.alt = '';
        wd.appendChild(im);
        const tube = node('div', null, 'mmh-tube');
        const fill = node('i');
        const n = node('b', '0');
        tube.append(fill, n);
        col.append(wd, tube, node('span', 'Equipo ' + TEAM_NAME[team], 'mmh-wname'));
        row.appendChild(col);
        const k = v / max;
        if (reduced()) { fill.style.transform = `scaleY(${k})`; n.textContent = S.fmt(v); }
        else {
          fill.animate([{ transform: 'scaleY(0)' }, { transform: `scaleY(${k})` }], { duration: 600 + 2200 * k, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' });
          S.countUp(n, 0, v, 600 + 2200 * k);
        }
      });
      box.appendChild(row);
      sfx('drum', 0.8);
      return;
    }
    if (name === 'result') {
      const tie = mo.winner === 'tie';
      box.appendChild(node('h2', tie ? '¡Empate! ¡Los dos dragoncitos comieron igual!' : `¡Gana el Equipo ${TEAM_NAME[mo.winner]}!`, 'mmh-cer-h win ' + (tie ? 'tie' : mo.winner)));
      const wc = mo.captains && !tie ? mo.captains[mo.winner] : null;
      if (wc && C()) box.appendChild(node('p', `${C().captain(wc)}: «${C().line(wc, 'win')}»`, 'mmh-capline'));
      const row = node('div', null, 'mmh-res');
      ['red', 'gold'].forEach((team) => {
        const win = tie || mo.winner === team;
        const side = node('div', null, 'mmh-rside ' + (win ? 'win' : 'lose'));
        const im = node('img', null, 'mmh-rd');
        im.src = S.dragonArt(team, tie ? 'dance' : win ? 'win' : 'worried');
        im.alt = '';
        const crew = node('div', null, 'mmh-rcrew');
        const shown = ((mo.teams && mo.teams[team]) || []).slice(0, 10);
        crew.style.setProperty('--n', Math.max(4, shown.length));
        shown.forEach((r, i) => {
          const f = S.kidFigure({ team, skin: r.skin, name: r.name, pose: win ? 'ok' : 'no', tag: false });
          f.classList.add(win ? 'cheer' : 'slump');
          f.style.setProperty('--i', i % 5);
          crew.appendChild(f);
        });
        side.append(im, crew, node('b', S.fmt(team === 'red' ? tt.r : tt.g) + ' mochis', 'mmf-total'));
        row.appendChild(side);
      });
      box.appendChild(row);
      S.confetti($('cer-fx'), tie ? null : mo.winner, 60);
      sfx('win', 0.9);
      if (!tie) later(800, () => sfx('aww', 0.4));
      return;
    }
    if (name.indexOf('star') === 0) {
      const st = (mo.stars || [])[Number(name.slice(4))];
      if (!st) return;
      const wrap = node('div', null, 'mmh-star');
      const badge = node('div', null, 'mmf-badge');
      badge.appendChild(S.starSvg());
      wrap.append(badge, node('div', 'Estrella Bonus', 'mmf-kicker'), node('h3', st.name));
      const who = node('div', null, 'mmh-star-who');
      (st.who || []).forEach((r, i) => {
        const f = S.kidFigure({ team: r.team, skin: r.skin, name: r.name, pose: 'ok' });
        f.style.setProperty('--i', i);
        who.appendChild(f);
      });
      wrap.appendChild(who);
      const val = st.id === 'fast' ? `${String(st.value).replace('.', ',')} s` : st.id === 'aim' ? `${st.value} %` : st.id === 'streak' ? `${st.value} seguidas` : `${S.fmt(st.value)} mochis`;
      wrap.appendChild(node('div', (st.n > 4 ? `y ${st.n - 4} más · ` : '') + val, 'mmf-val'));
      box.appendChild(wrap);
      later(850, () => sfx('star', 0.8));
      return;
    }
    if (name === 'podium') {
      clearTimers();
      $('cer-skip').classList.add('hidden');
      $('endtools').classList.remove('hidden');
      box.appendChild(node('h2', mo.winner === 'tie' ? '¡Empate en la Terraza del Mochi!' : `¡Campeón: Equipo ${TEAM_NAME[mo.winner]}!`, 'mmh-cer-h win ' + (mo.winner === 'tie' ? 'tie' : mo.winner)));
      const pod = node('div', null, 'mmh-podium');
      const top = (mo.top || []).filter((r) => r.mochis > 0).slice(0, 3);
      const order = [1, 0, 2];
      order.forEach((i) => {
        const r = top[i];
        const p = node('div', null, 'mmh-pod p' + (i + 1));
        if (r) {
          const stars = node('div', null, 'mmh-pod-stars');
          (r.stars || []).forEach(() => stars.appendChild(S.starSvg()));
          const f = S.kidFigure({ team: r.team, skin: r.skin, name: r.name, pose: 'ok' });
          const step = node('div', null, 'mmh-pod-step');
          step.append(node('span', String(i + 1)), node('small', S.fmt(r.mochis) + ' mochis'));
          p.append(stars, f, step);
        }
        pod.appendChild(p);
      });
      const mvps = node('div', null, 'mmh-mvps');
      ['red', 'gold'].forEach((team) => {
        const r = mo.mvp && mo.mvp[team];
        if (!r) return;
        const m = node('div', null, 'mmh-mvp ' + team);
        m.appendChild(S.kidFigure({ team, skin: r.skin, name: r.name, tag: false, pose: 'ok' }));
        const t = node('div');
        t.append(node('small', 'El mejor del Equipo ' + TEAM_NAME[team]), node('b', r.name), node('small', S.fmt(r.mochis) + ' mochis'));
        m.appendChild(t);
        mvps.appendChild(m);
      });
      pod.appendChild(mvps);
      box.appendChild(pod);
      musicFor();
    }
  }

  window.MochiHost = {
    frame: () => ({ pin, paused, phase: g && g.phase, totals, frenzy: !!(g && g.frenzy), kids: Object.keys(figs).length, flying }),
    freeze: (v) => { frozen = !!v; if (!frozen) { const q = queue; queue = []; q.forEach(([fn, d]) => fn(d)); } return queue.length; },
    replay: (ev) => { while (queue.length) { const [fn, d, e] = queue.shift(); fn(d); if (e === ev) break; } return queue.length; },
    queued: () => queue.map((x) => x[2]),
    hold: (v) => { testHold = !!v; },
    stage: (name) => { clearTimers(); stage(name); },
    sim: (ev, d) => { if (handlers[ev]) handlers[ev](d); },
    runIn: () => { crowdKey = ''; renderCrowds(true); },
    feed,
  };
})();
