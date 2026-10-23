// Piñata Tigre v2 — the projector (secondary: the phones are the product). Lobby (PIN + QR, the 3 steps, 2 / 3 / 4 min,
// the two teams as full-body characters: tap one to change team) → the party: the teams run in, the rules card «¡Para la
// flecha en el dorado!» → «¿Listos?» → «¡YA!» → the game: the candy meter, each team's tiger on its rope (cracking, jolting
// when its kids hit, bursting into a candy shower, the next bigger tiger dropping in), the landmark ladder, the kids in the
// courtyard swinging their sticks, lead-change / burst / last-30-s bands, the captains' and Dralingo's lines → «¡FINAL!»
// → the ceremony: the candy jars, «¡Gana el Equipo …!», the bonus stars one by one, the podium. Teacher: Pausa (holds
// every clock), +30 s, Saltar (the intro, the ceremony), Terminar, Sonido, Otra ronda.
// Test hooks: PinataHost.frame(), .freeze(v) / .replay(ev), .hold(v), .stage(name), .sim(ev, d), .hit(k, power, crit).
(function () {
  'use strict';
  const socket = io();
  const $ = (id) => document.getElementById(id);
  const S = window.MochiStage;
  const P = window.PinataStage;
  const A = '/assets/pinata/', K = '/assets/kingdoms/', H = '/assets/halcon/', MO = '/assets/mochi/';
  const reduced = P.reduced;
  const STAR_MS = 2200, JARS_MS = 3600, RESULT_MS = 3000;
  const TEAM_NAME = { red: 'Fuego', gold: 'Mar' };
  const LM = ['museum', 'frame', 'arab', 'burj'];

  let pin = null, state = null, muted = false, duration = 180, paused = false;
  let g = null;                         // { id, phase, ladder, frenzy, endAt (perf), pausedLeft }
  let meter = { r: 0, g: 0, tr: 0, tg: 0, hr: 1, hg: 1, lr: 1, lg: 1 };
  let roster = {};                      // k → { k, name, avatar, team, off, skin }
  let figs = {};                        // k → kid figure in the courtyard
  let tigers = {}, candy = null, timers = [], lobbyKey = '', crowdKey = '', seen = new Set();
  let frozen = false, queue = [], testHold = false;
  const handlers = {};
  const onPn = (ev, fn) => { handlers[ev] = fn; socket.on(ev, (d) => { if (frozen) { queue.push([fn, d, ev]); return; } fn(d); }); };
  const later = (ms, fn) => { const t = setTimeout(fn, Math.max(0, ms)); timers.push(t); return t; };
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  // ---------- sound ----------
  const SFX = {
    tick: K + 'tick.mp3', whoosh: K + 'whoosh.mp3', win: K + 'sting-win.mp3', flag: K + 'flag.mp3', alert: K + 'castle-alert.mp3',
    landmark: K + 'landmark.mp3', siege: K + 'siege.mp3', start: H + 'start.mp3', final: '/assets/party/final-v2.mp3', aww: H + 'aww.mp3',
    round: H + 'round.mp3', drum: MO + 'drum.mp3', star: MO + 'star.mp3', whack: A + 'whack.mp3', whackBig: A + 'whack-big.mp3',
    crit: A + 'crit.mp3', burst: A + 'burst.mp3', candy: A + 'candy.mp3',
  };
  const MUSIC = { lobby: K + 'music-lobby.mp3', play: A + 'music-fiesta.mp3', final: K + 'music-final.mp3' };
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
    P.bunting($('bunting-' + (name === 'win' ? 'end' : name)));
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
  let bandT = null, bandUntil = 0;
  function band(kind, parts, team, ms) {
    const b = $('band');
    b.className = 'pth-band ' + kind + (team ? ' ' + team : '');
    b.innerHTML = '';
    parts.forEach((p) => b.appendChild(p));
    void b.offsetWidth;
    b.classList.add('show');
    document.body.classList.add('band-on');
    clearTimeout(bandT);
    bandUntil = Date.now() + (ms || 2200);
    bandT = setTimeout(() => { if (!testHold) { b.classList.remove('show'); document.body.classList.remove('band-on'); } }, ms || 2200);
  }
  const node = (tag, txt, cls) => S.el(tag, cls, txt);

  // ---------- the room ----------
  const params = new URLSearchParams(location.search);
  const setId = params.get('setId');
  const LIVE = params.get('livegame') === '1' ? '&livegame=1' : '';
  if (!setId) { location.href = '/packs.html?game=pinata' + LIVE; return; }
  function showPin(p) {
    pin = p;
    $('pin-display').textContent = p;
    $('active-pin').textContent = p;
    const url = `${location.origin}/?pin=${p}`;
    // the address breaks before «/?pin=», never inside the site name
    $('join-url').replaceChildren(location.host, document.createElement('wbr'), `/?pin=${p}`);
    document.title = `Draly Piñata · ${p}`;
    drawQr(url);
    try { sessionStorage.setItem('draly.pinataHost', JSON.stringify({ pin: p, setId })); } catch (_) {}
  }
  function createRoom() {
    socket.emit('host:create', { gameType: 'pinata' }, ({ pin: p }) => {
      showPin(p);
      socket.emit('host:set-duration', { pin, duration });
      socket.emit('host:load-set', { pin, setId }, (resp) => {
        if (!resp || !resp.ok) { alert('No se pudo cargar la serie de preguntas.'); location.href = '/packs.html?game=pinata' + LIVE; return; }
        $('set-display').textContent = `${resp.title} · ${resp.count} preguntas`;
        updateStartBtn();
      });
    });
  }
  // A reload of this tab (F5 mid-class) takes the same room back instead of opening a new PIN.
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem('draly.pinataHost') || 'null'); } catch (_) {}
  if (saved && saved.pin && saved.setId === setId) {
    socket.emit('host:reclaim', { pin: saved.pin }, (r) => {
      if (r && r.ok && r.gameType === 'pinata') showPin(saved.pin);
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
  document.querySelectorAll('.pth-dur button').forEach((b) => b.addEventListener('click', () => {
    duration = +b.dataset.s;
    document.querySelectorAll('.pth-dur button').forEach((x) => x.classList.toggle('on', x === b));
    socket.emit('host:set-duration', { pin, duration });
  }));
  $('balance-btn').addEventListener('click', () => socket.emit('host:auto-balance', { pin }));
  $('start-btn').addEventListener('click', () => { $('start-btn').disabled = true; socket.emit('host:start', { pin }); });
  $('pause-btn').addEventListener('click', () => socket.emit('host:pause', { pin, paused: !paused }));
  $('resume-btn').addEventListener('click', () => socket.emit('host:pause', { pin, paused: false }));
  $('more-btn').addEventListener('click', () => socket.emit('host:add-time', { pin, seconds: 30 }));
  $('less-btn').addEventListener('click', () => socket.emit('host:add-time', { pin, seconds: -30 }));
  $('skip-btn').addEventListener('click', () => {
    const b = $('skip-btn');
    if (b.disabled) return;
    b.disabled = true;
    socket.emit('host:pn-skip', { pin });
    setTimeout(() => { b.disabled = false; }, 800);
  });
  const endNow = () => { if (confirm('¿Terminar la partida ahora?')) socket.emit('host:end-now', { pin }); };
  $('end-now-btn').addEventListener('click', endNow);
  $('paused-end-btn').addEventListener('click', endNow);
  $('cer-skip').addEventListener('click', () => { socket.emit('host:pn-skip', { pin }); stage('podium'); });
  $('home-btn').addEventListener('click', () => { location.href = '/'; });
  $('play-again-btn').addEventListener('click', () => {
    socket.emit('host:reset', { pin });
    clearTimers();
    g = null; meter = { r: 0, g: 0, tr: 0, tg: 0, hr: 1, hg: 1, lr: 1, lg: 1 }; figs = {}; crowdKey = ''; lobbyKey = '';
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
    if (s.setTitle && /Cargando/.test($('set-display').textContent)) $('set-display').textContent = `${s.setTitle} · ${s.questionsLoaded} preguntas`;
    const list = Object.values(s.players || {});
    roster = {};
    list.forEach((p) => { if (p.k) roster[p.k] = { k: p.k, name: p.name, avatar: p.avatar, team: p.team, off: !!p.off, skin: p.sk || S.skinFor(p.avatar, p.name) }; });
    if (s.state === 'lobby') {
      if ([120, 180, 240].includes(s.duration)) {
        duration = s.duration;
        document.querySelectorAll('.pth-dur button').forEach((x) => x.classList.toggle('on', +x.dataset.s === s.duration));
      }
      renderLobby(list);
      updateStartBtn();
    } else if (g && s.state === 'active') renderCrowds(false);
  });

  // ---------- lobby ----------
  let pvTigers = null;
  function renderLobby(players) {
    if (!pvTigers) {
      pvTigers = { red: new P.Tiger($('pv-red'), { team: 'red', tier: 0 }), gold: new P.Tiger($('pv-gold'), { team: 'gold', tier: 0, mirror: true }) };
      P.preload();
      const m = $('step-meter');
      const st = S.starSvg();
      st.classList.add('pti-pic-star');
      m.append(node('i', null, 'pti-pic-bar'), st, node('i', null, 'pti-pic-needle'), node('i', null, 'pt-hand'));
      for (let i = 0; i < 5; i++) { const c = P.candy(i === 0, i % 3 === 0 ? 'l' : 'w'); c.style.setProperty('--i', i); $('step-burst').appendChild(c); }
      P.bunting($('bunting-preview'));
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
      box.classList.toggle('dense', mine.length > 8);
      box.classList.toggle('denser', mine.length > 12);
      mine.forEach((p) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'pth-kid' + (seen.has(p.name) ? '' : ' new');
        b.setAttribute('aria-label', `${p.name}: pasar al Equipo ${team === 'red' ? 'Mar' : 'Fuego'}`);
        seen.add(p.name);
        b.appendChild(S.kidFigure({ team, skin: p.sk || S.skinFor(p.avatar, p.name), name: p.name }));
        b.appendChild(node('i', '⇄', 'pth-kid-swap'));
        b.addEventListener('click', () => {
          const id = state && Object.keys(state.players).find((sid) => state.players[sid].name === p.name);
          if (id) socket.emit('host:swap-team', { pin, playerId: id });
        });
        box.appendChild(b);
      });
      if (!mine.length) box.appendChild(node('p', 'Esperando jugadores: entren con el PIN.', 'pth-empty'));
    });
  }

  // ---------- the party ----------
  function buildStage() {
    if (!tigers.red) {
      tigers.red = new P.Tiger($('hang-red'), { team: 'red', tier: 0 });
      tigers.gold = new P.Tiger($('hang-gold'), { team: 'gold', tier: 0, mirror: true });
      tigers.red.maxKick = tigers.gold.maxKick = 24;       // the projector's tigers hang lower: they can swing further
      candy = new P.Candy($('fx'), 60);
    }
    tigers.red.setTier(0, false); tigers.gold.setTier(0, false);
    tigers.red.setLife(1, 1); tigers.gold.setLife(1, 1);
    $('screen-stage').classList.remove('frenzy');
    paintMeter();
  }
  // the kids in the courtyard (two crowds), each with a stick; rebuilt only when who-is-where changes
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
      const avail = window.innerWidth * 0.38 - 2 * (perRow - 1) - (mine.length > 16 ? 50 : 0);
      const kw = Math.max(44, Math.min(120, Math.floor(avail / perRow)));
      box.style.setProperty('--kw', kw + 'px');
      box.style.setProperty('--kh', (rows === 2 ? Math.round(window.innerHeight * 0.105) : Math.round(window.innerHeight * 0.2)) + 'px');
      mine.slice(0, 16).forEach((p, i) => {
        let f = figs[p.k];
        const skin = p.skin || S.skinFor(p.avatar, p.name);
        if (!f || f._team !== team || f._skin !== skin) {
          f = S.kidFigure({ team, skin, name: p.name });
          f._team = team;
          f._stick = P.stick(team);
          f.appendChild(f._stick);
          figs[p.k] = f;
        }
        f.classList.toggle('off', p.off);
        if (runIn && !reduced()) {
          f.style.animation = 'none';
          void f.offsetWidth;
          f.style.animation = `pt-run .7s var(--pt-ease-out) ${0.2 + i * 0.06}s both`;
          f.style.setProperty('--from', team === 'red' ? '-50vw' : '50vw');
        }
        box.appendChild(f);
      });
      if (mine.length > 16) box.appendChild(node('span', `+${mine.length - 16}`, 'pth-more'));
    });
  }
  window.addEventListener('resize', () => {
    if (g && !$('screen-stage').classList.contains('hidden')) { crowdKey = ''; renderCrowds(false); P.bunting($('bunting-stage')); }
  });
  const tierName = (i) => (g && g.ladder && g.ladder[i] ? g.ladder[i].name : (P.LADDER[i] || 'Tigre de oro'));
  function paintLabel(team) {
    const box = $('label-' + team);
    const i = team === 'red' ? meter.tr : meter.tg;
    const left = team === 'red' ? meter.hr : meter.hg, total = team === 'red' ? meter.lr : meter.lg;
    box.classList.toggle('golden', i >= 3);
    const im = box.querySelector('img');
    const u = K + 'landmarks/' + LM[Math.min(3, i)] + '.webp';
    if (im.getAttribute('src') !== u) im.src = u;
    box.querySelector('b').textContent = i < 4 ? `Tigre ${i + 1} · ${tierName(i)}` : '¡Tigre de oro!';
    box.querySelector('.ptz-life i').style.transform = `scaleX(${total > 0 ? Math.max(0, Math.min(1, left / total)).toFixed(3) : 1})`;
  }
  // a team's height on the ladder: tigers broken + how far into the current one (0 … 4 → the ruler)
  function progress(team) {
    const i = team === 'red' ? meter.tr : meter.tg;
    const left = team === 'red' ? meter.hr : meter.hg, total = team === 'red' ? meter.lr : meter.lg;
    return Math.min(4.15, i + (total > 0 ? 1 - left / total : 0));
  }
  function paintMeter() {
    const sum = meter.r + meter.g;
    $('m-red').textContent = P.fmt(meter.r);
    $('m-gold').textContent = P.fmt(meter.g);
    $('m-bar').style.transform = `scaleX(${(sum ? meter.r / sum : 0.5).toFixed(3)})`;
    ['red', 'gold'].forEach((team) => {
      paintLabel(team);
      $('mark-' + team).style.bottom = Math.min(100, (100 * progress(team)) / 4.15) + '%';
      const tg = tigers[team];
      // a burst whose «next tiger» timer was cleared («¡FINAL!», a reconnect): the tiger comes back anyway
      if (tg && tg._bursting && performance.now() - (tg._burstAt || 0) > 1500) { tg._bursting = false; tg.setTier(team === 'red' ? meter.tr : meter.tg, false); }
      if (tg && !tg._bursting) {
        const i = team === 'red' ? meter.tr : meter.tg;
        if (tg.tier !== i) tg.setTier(i, false);
        tg.setLife(team === 'red' ? meter.hr : meter.hg, team === 'red' ? meter.lr : meter.lg);
      }
    });
  }
  function buildRuler() {
    const r = $('ruler');
    r.querySelectorAll('.pth-lm').forEach((x) => x.remove());
    (g.ladder || []).forEach((l, i) => {
      const d = node('div', null, 'pth-lm' + (l.team ? ' ' + l.team : ''));
      d.dataset.i = i;
      d.style.bottom = ((100 * (i + 1)) / 4.15) + '%';
      const im = node('img');
      im.src = K + 'landmarks/' + l.id + '.webp';
      im.alt = l.name;
      d.appendChild(im);
      r.appendChild(d);
    });
  }
  let clockT = null;
  function runClock() {
    clearInterval(clockT);
    const paint = () => {
      if (!g || !g.endAt) return;
      const left = paused ? g.pausedLeft : Math.max(0, g.endAt - performance.now());
      const s = Math.ceil(left / 1000);
      $('clock').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      if ($('less-btn')) $('less-btn').disabled = g.phase !== 'play' || left <= 11000;   // «−30 s» stops 10 s before the end (core/party.js clockShift)
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

  // ---------- the captains ----------
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
      box.querySelector('.pth-capt-name').textContent = C().captain(id);
    });
  }
  const capT = {};
  function capSay(team, mood, ms) {
    const id = captains && captains[team];
    if (!id || !C()) return;
    const box = $('capt-' + team);
    const sayEl = box.querySelector('.pth-capt-say');
    sayEl.textContent = C().line(id, mood);
    sayEl.classList.add('show');
    box.querySelector('img').src = C().pose(id, mood === 'oops' ? 'mystery' : 'cheer');
    box.classList.remove('cheer'); void box.offsetWidth; if (mood !== 'oops') box.classList.add('cheer');
    clearTimeout(capT[team]);
    capT[team] = setTimeout(() => { sayEl.classList.remove('show'); box.querySelector('img').src = C().pose(id, 'hello'); }, ms || 3200);
  }
  socket.on('pn:captains', (c) => { captains = c; paintCaptains(); });

  // ---------- countdown: the teams run in ----------
  socket.on('countdown', () => {
    clearTimers();
    stopMusic();
    g = { id: null, phase: 'countdown', ladder: [], frenzy: false, endAt: 0, pausedLeft: 0 };
    meter = { r: 0, g: 0, tr: 0, tg: 0, hr: 1, hg: 1, lr: 1, lg: 1 };
    showScreen('stage');
    buildStage();
    ['red', 'gold'].forEach((t) => { tigers[t].root.classList.remove('swing-in'); void tigers[t].root.offsetWidth; tigers[t].root.classList.add('swing-in'); });
    $('skip-btn').classList.add('hidden');
    $('more-btn').classList.add('hidden');
    clearInterval(clockT);
    const dur = (state && state.duration) || duration;
    $('clock').textContent = `${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, '0')}`;
    $('count10').classList.add('hidden');
    renderCrowds(true);
    paintCaptains();
    later(700, () => { capSay('red', 'hello', 2600); capSay('gold', 'hello', 2600); });
    say('¡Bienvenidos a la fiesta de las piñatas! ¡Fuego contra Mar!', 3400);
    sfx('whoosh', 0.7);
    later(900, () => sfx('round', 0.5));
  });

  // ---------- the game ----------
  onPn('pn:init', (d) => {
    g = { id: d.id, phase: d.phase, ladder: d.ladder || [], frenzy: !!d.frenzy, endAt: d.endsMs != null ? performance.now() + d.endsMs : 0, pausedLeft: d.endsMs || 0 };
    meter = Object.assign({}, meter, d.meter || {});
    (d.roster || []).forEach((p) => { roster[p.k] = Object.assign(roster[p.k] || {}, { k: p.k, name: p.name, team: p.team, off: !p.on, skin: p.skin }); });
    if (d.captains) { captains = d.captains; paintCaptains(); }
    showScreen('stage');
    buildStage();
    buildRuler();
    paintMeter();
    renderCrowds(false);
    setPaused(!!d.paused, d);
    $('screen-stage').classList.toggle('frenzy', g.frenzy);
    $('skip-btn').classList.toggle('hidden', d.phase !== 'intro');
    $('more-btn').classList.toggle('hidden', d.phase !== 'play');
    if (d.phase === 'intro' && d.duration) $('clock').textContent = `${Math.floor(d.duration / 60)}:${String(Math.round(d.duration) % 60).padStart(2, '0')}`;
    if (d.phase === 'play' || d.phase === 'final') runClock();
    if (d.phase === 'final') band('final', [node('b', '¡FINAL!')], null, 2400);
    musicFor();
  });
  function showRules(ms) {
    const box = $('rules');
    box.innerHTML = '';
    box.classList.remove('hidden');
    const card = node('div', null, 'pth-rules-card');
    const pic = node('div', null, 'pti-pic');
    const tg = node('img', null, 'pti-pic-tiger');
    tg.src = P.tigerArt('red', 0);
    tg.alt = '';
    const m = node('div', null, 'pti-pic-meter');
    const st = S.starSvg();
    st.classList.add('pti-pic-star');
    m.append(node('i', null, 'pti-pic-bar'), st, node('i', null, 'pti-pic-needle'));
    pic.append(tg, m, node('i', null, 'pt-hand'));
    const txt = node('div');
    txt.append(node('h2', '¡Para la flecha en el dorado!'), node('p', 'Cada respuesta correcta es un golpe a la piñata de tu equipo. En el dorado: ¡golpe crítico!'));
    const sayEl = node('div', '', 'pth-rules-say');
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
  let rulesT = [];
  function clearRules() { rulesT.forEach(clearTimeout); rulesT = []; }
  onPn('pn:play', (d) => {
    if (!g) return;
    g.phase = 'play';
    g.endAt = performance.now() + (d.endsMs || 0);
    clearRules();
    $('rules').classList.add('hidden');
    $('skip-btn').classList.add('hidden');
    $('more-btn').classList.remove('hidden');
    runClock();
    musicFor();
    say('¡A responder! Cada respuesta correcta es un golpe a su piñata.', 3600);
  });
  onPn('pn:meter', (d) => {
    if (!g) return;
    meter = Object.assign({}, meter, d);
    paintMeter();
    (d.f || []).forEach(([k, power, crit]) => hit(k, power, crit));
  });
  // kids hit since the last tick: their figure swings its stick, the tiger jolts, candies fly to them
  const lastJolt = { red: 0, gold: 0 };
  let flying = 0, critPops = 0;
  function hit(k, power, crit) {
    const p = roster[k];
    if (!p || !tigers[p.team]) return;
    const team = p.team;
    const tg = tigers[team];
    const f = figs[k];
    if (f && f.isConnected && !reduced() && f._stick && f._stick.animate) {
      f._stick.animate([{ transform: 'rotate(10deg)' }, { transform: 'rotate(-35deg)', offset: 0.3 }, { transform: 'rotate(60deg)', offset: 0.55 }, { transform: 'rotate(10deg)' }],
        { duration: 480, easing: 'cubic-bezier(.3,.7,.2,1)' });
      f._img.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-8%) scale(1.04, .97)', offset: 0.4 }, { transform: 'translateY(0)' }], { duration: 320, easing: 'cubic-bezier(.22,1,.36,1)' });
    }
    if (tg._bursting) return;
    const now = performance.now();
    if (now - lastJolt[team] > 240) { lastJolt[team] = now; tg.jolt(power, crit); sfx(crit ? 'whackBig' : 'whack', crit ? 0.6 : 0.4, 90); }
    if (crit) {
      sfx('crit', 0.5, 300);
      if (critPops < 3) {
        critPops++;
        const c = tg.center();
        const pop = node('div', '¡CRÍTICO!', 'pth-crit');
        pop.style.left = c.x + 'px';
        pop.style.top = (c.y - c.h * 0.3) + 'px';
        $('fx').appendChild(pop);
        setTimeout(() => { pop.remove(); critPops--; }, 1000);
      }
    }
    const shots = Math.min(3, Math.max(1, Math.round(power / 2)));
    for (let i = 0; i < shots; i++) {
      if (flying > 40) break;
      flying++;
      const src = tg.impact();
      const dst = f && f.isConnected ? f._img.getBoundingClientRect() : $('crowd-' + team).getBoundingClientRect();
      candy.fly(src, { x: dst.left + dst.width * 0.5, y: dst.top + dst.height * 0.3 }, {
        gold: crit && i === 0, size: crit && i === 0 ? 34 : 26, ms: 620, delay: i * 70, arc: 60, drift: (Math.random() - 0.5) * 90,
        onLand: () => { flying = Math.max(0, flying - 1); },
      });
    }
  }
  onPn('pn:burst', (b) => {
    if (!g || !b) return;
    if (b.meter) meter = Object.assign({}, meter, b.meter);
    const tg = tigers[b.team];
    if (tg) {
      tg._bursting = true;
      tg._burstAt = performance.now();
      const c = tg.center();
      tg.burst($('fx'));
      if (!reduced()) candy.spill(c, 34, { spread: 340, size: 32, fall: 620, ms: 1500, stagger: 10, gold: true });
      later(1150, () => { tg._bursting = false; tg.setTier(b.tier + 1, true); paintMeter(); });
    }
    if (b.landmark) {
      const l = g.ladder && g.ladder[b.tier];
      if (l) l.team = b.team;
      const el = $('ruler').querySelector(`.pth-lm[data-i="${b.tier}"]`);
      if (el) el.classList.add(b.team, 'won');
    }
    paintMeter();
    sfx('burst', 0.8);
    later(250, () => sfx(b.landmark ? 'landmark' : 'win', 0.6));
    const im = node('img');
    im.src = b.tier < 4 ? K + 'landmarks/big/' + LM[b.tier] + '.webp' : P.tigerArt(b.team, b.tier);
    im.alt = '';
    // big bands stay rare: a burst in the middle of another band only gets Dralingo's line; the shower plays first,
    // then the band (low, under the tigers)
    if (Date.now() > bandUntil - 400) {
      bandUntil = Date.now() + 3200;
      later(650, () => band('burst', [im, node('b', `¡El Equipo ${TEAM_NAME[b.team]} rompió la piñata!`),
        node('span', b.landmark ? `${b.who ? b.who + ' dio el golpe final. ' : ''}¡Primeros en el ${b.name}! +${b.jackpot + b.bonus} caramelos` : `${b.who ? b.who + ' dio el golpe final: ' : ''}+${b.jackpot} caramelos`)], b.team, 2500));
    }
    say(b.landmark ? `¡${TEAM_NAME[b.team]} llegó primero al ${b.name}!` : `¡Lluvia de caramelos para el Equipo ${TEAM_NAME[b.team]}!`);
    capSay(b.team, 'smash');
  });
  onPn('pn:lead', (d) => {
    if (d.meter) { meter = Object.assign({}, meter, d.meter); paintMeter(); }
    const t = TEAM_NAME[d.team];
    if (Date.now() > bandUntil - 400) band('lead', [node('b', d.first ? `¡El Equipo ${t} toma la delantera!` : `¡El Equipo ${t} pasa adelante!`), node('span', d.first ? '¡Que no se escape!' : '¡Cambio de líder!')], d.team, 2300);
    sfx(d.first ? 'flag' : 'alert', 0.7);
    say(d.first ? `¡${t} va primero! ¡Vamos, ${d.team === 'red' ? 'Mar' : 'Fuego'}!` : `¡Remontada del Equipo ${t}!`);
    capSay(d.team, 'fiesta');
    capSay(d.team === 'red' ? 'gold' : 'red', 'smash');
  });
  onPn('pn:frenzy', (d) => {
    if (!g) return;
    g.frenzy = true;
    g.endAt = performance.now() + (d.endsMs || 30000);
    $('screen-stage').classList.add('frenzy');
    band('frenzy', [node('b', '¡ÚLTIMOS 30 SEGUNDOS!'), node('span', '¡Doble golpe! Cada golpe vale el doble')], null, 2600);
    sfx('siege', 0.7);
    say('¡Doble golpe! ¡Todo puede cambiar!');
    capSay('red', 'smash', 3600);
    capSay('gold', 'smash', 3600);
    stopMusic();
    musicFor();
  });
  onPn('pn:scale', (d) => {
    if (!g || d.id !== g.id) return;
    g.ladder = d.ladder || g.ladder;
    if (d.meter) meter = Object.assign({}, meter, d.meter);
    buildRuler();
    paintMeter();
  });
  onPn('pn:time', (d) => {
    if (!g) return;
    g.endAt = performance.now() + (d.endsMs || 0);
    if (paused) g.pausedLeft = d.endsMs || g.pausedLeft;
    say(d.add < 0 ? `¡${-d.add} segundos menos!` : `¡${d.add || 30} segundos más!`, 2200);
  });
  onPn('pn:pause', (d) => {
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
  onPn('pn:final', (d) => {
    if (!g) return;
    clearTimers();
    g.phase = 'final';
    if (d && d.meter) { meter = Object.assign({}, meter, d.meter); paintMeter(); }
    later(1600, paintMeter);                 // a tiger that burst just before «¡FINAL!» comes back (its timer was cleared)
    clearInterval(clockT);
    $('clock').textContent = '0:00';
    $('count10').classList.add('hidden');
    setPaused(false);
    band('final', [node('b', '¡FINAL!')], null, 2400);
    sfx('final', 0.9);
    stopMusic();
    say('¡Se acabó! ¿Quién juntó más caramelos?', 2400);
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
    const stars = (end.pinata && end.pinata.stars) || [];
    const plan = [['jars', JARS_MS], ['result', RESULT_MS]].concat(stars.map((s, i) => ['star' + i, STAR_MS]));
    let t = 0;
    plan.forEach(([name, ms]) => { later(t, () => stage(name)); t += ms; });
    later(t, () => stage('podium'));
  });
  function stage(name) {
    if (!end) return;
    const mo = end.pinata || {}, tt = mo.totals || { r: 0, g: 0 };
    const box = $('cer');
    box.innerHTML = '';
    $('cer-fx').innerHTML = '';
    if (name === 'jars') {
      box.appendChild(node('h2', '¿Quién juntó más caramelos?', 'pth-cer-h'));
      const row = node('div', null, 'pth-jars');
      const cfx = new P.Candy($('cer-fx'), 40);
      const max = Math.max(1, tt.r, tt.g);
      ['red', 'gold'].forEach((team) => {
        const v = team === 'red' ? tt.r : tt.g;
        const col = node('div', null, 'ptf-col ' + team);
        const hang = node('div', null, 'ptf-hang');
        const tg = new P.Tiger(hang, { team, tier: Math.min(3, (mo.tiers && mo.tiers[team]) || 0), mirror: team === 'gold', idle: false });
        const jar = node('div', null, 'ptf-jar');
        const fill = node('i', null, 'ptf-fill');
        jar.append(fill, node('i', null, 'ptf-glass'));
        const n = node('b', '0', 'ptf-n');
        col.append(hang, jar, n, node('span', 'Equipo ' + TEAM_NAME[team], 'ptf-team'));
        row.appendChild(col);
        const k = v / max;
        later(380, () => { tg.burst($('cer-fx')); if (!reduced()) cfx.spill(tg.center(), 18, { spread: 200, fall: 380, size: 30 }); });
        if (reduced()) { fill.style.transform = `scaleY(${k})`; n.textContent = P.fmt(v); }
        else later(520, () => {
          fill.animate([{ transform: 'scaleY(0)' }, { transform: `scaleY(${k})` }], { duration: 600 + 2200 * k, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' });
          S.countUp(n, 0, v, 600 + 2200 * k);
        });
      });
      box.appendChild(row);
      sfx('burst', 0.7);
      sfx('drum', 0.8);
      return;
    }
    if (name === 'result') {
      const tie = mo.winner === 'tie';
      box.appendChild(node('h2', tie ? '¡Empate! ¡Los dos equipos juntaron lo mismo!' : `¡Gana el Equipo ${TEAM_NAME[mo.winner]}!`, 'pth-cer-h win ' + (tie ? 'tie' : mo.winner)));
      const wc = mo.captains && !tie ? mo.captains[mo.winner] : null;
      if (wc && C()) box.appendChild(node('p', `${C().captain(wc)}: «${C().line(wc, 'fiesta')}»`, 'pth-capline'));
      const row = node('div', null, 'pth-res');
      ['red', 'gold'].forEach((team) => {
        const win = tie || mo.winner === team;
        const side = node('div', null, 'pth-rside ' + (win ? 'win' : 'lose'));
        const mas = node('img', null, 'ptf-mascot');
        mas.alt = '';
        mas.src = '/assets/kingdoms/dralingo/' + (tie ? 'jump' : win ? 'champion' : 'shocked') + (team === 'red' ? '-red' : '') + '.webp';
        side.appendChild(mas);
        const crew = node('div', null, 'pth-rcrew');
        if (!win) crew.appendChild(P.cloud());
        const shown = ((mo.teams && mo.teams[team]) || []).slice(0, 10);
        crew.style.setProperty('--n', Math.max(4, shown.length));
        shown.forEach((r, i) => {
          const f = S.kidFigure({ team, skin: r.skin, name: r.name, pose: win ? 'ok' : 'no', tag: false });
          f.classList.add(win ? 'cheer' : 'sob');
          f.style.setProperty('--i', i % 5);
          crew.appendChild(f);
        });
        side.append(crew, node('b', `Equipo ${TEAM_NAME[team]} · ${P.fmt(team === 'red' ? tt.r : tt.g)} caramelos`, 'ptf-total'));
        if (win) { const conf = node('div', null, 'ptf-conf'); side.appendChild(conf); S.confetti(conf, tie ? null : team, tie ? 26 : 44); }
        row.appendChild(side);
      });
      box.appendChild(row);
      sfx('win', 0.9);
      if (!tie) later(800, () => sfx('aww', 0.45));
      return;
    }
    if (name.indexOf('star') === 0) {
      const st = (mo.stars || [])[Number(name.slice(4))];
      if (!st) return;
      const wrap = node('div', null, 'pth-star');
      const badge = node('div', null, 'ptf-badge');
      badge.appendChild(S.starSvg());
      wrap.append(badge, node('h3', st.name));
      const who = node('div', null, 'pth-star-who');
      (st.who || []).forEach((r, i) => {
        const f = S.kidFigure({ team: r.team, skin: r.skin, name: r.name, pose: 'ok' });
        f.style.setProperty('--i', i);
        who.appendChild(f);
      });
      wrap.appendChild(who);
      wrap.appendChild(node('div', (st.n > 4 ? `y ${st.n - 4} más · ` : '') + starValue(st), 'ptf-val'));
      box.appendChild(wrap);
      later(850, () => sfx('star', 0.8));
      return;
    }
    if (name === 'podium') {
      clearTimers();
      $('cer-skip').classList.add('hidden');
      $('endtools').classList.remove('hidden');
      box.appendChild(node('h2', mo.winner === 'tie' ? '¡Empate en la fiesta de las piñatas!' : `¡Campeón: Equipo ${TEAM_NAME[mo.winner]}!`, 'pth-cer-h win ' + (mo.winner === 'tie' ? 'tie' : mo.winner)));
      const pod = node('div', null, 'pth-podium');
      const top = (mo.top || []).filter((r) => r.candy > 0).slice(0, 3);
      [1, 0, 2].forEach((i) => {
        const r = top[i];
        const p = node('div', null, 'pth-pod p' + (i + 1));
        if (r) {
          const stars = node('div', null, 'pth-pod-stars');
          (r.stars || []).forEach(() => stars.appendChild(S.starSvg()));
          const f = S.kidFigure({ team: r.team, skin: r.skin, name: r.name, pose: 'ok' });
          const step = node('div', null, 'pth-pod-step');
          step.append(node('span', String(i + 1)), node('small', P.fmt(r.candy) + ' caramelos'));
          p.append(stars, f, step);
        }
        pod.appendChild(p);
      });
      const mvps = node('div', null, 'pth-mvps');
      ['red', 'gold'].forEach((team) => {
        const r = mo.mvp && mo.mvp[team];
        if (!r) return;
        const m = node('div', null, 'pth-mvp ' + team);
        m.appendChild(S.kidFigure({ team, skin: r.skin, name: r.name, tag: false, pose: 'ok' }));
        const t = node('div');
        t.append(node('small', 'El mejor del Equipo ' + TEAM_NAME[team]), node('b', r.name), node('small', P.fmt(r.candy) + ' caramelos'));
        m.appendChild(t);
        mvps.appendChild(m);
      });
      pod.appendChild(mvps);
      box.appendChild(pod);
      musicFor();
    }
  }
  function starValue(st) {
    if (st.id === 'fast') return `${String(st.value).replace('.', ',')} s`;
    if (st.id === 'streak') return `${st.value} seguidas`;
    if (st.id === 'hits') return `${P.fmt(st.value)} golpes`;
    if (st.id === 'crits') return `${P.fmt(st.value)} ${st.value === 1 ? 'crítico' : 'críticos'}`;
    return `${P.fmt(st.value)} caramelos`;
  }

  window.PinataHost = {
    frame: () => ({ pin, paused, phase: g && g.phase, meter: Object.assign({}, meter), frenzy: !!(g && g.frenzy), kids: Object.keys(figs).length, flying }),
    freeze: (v) => { frozen = !!v; if (!frozen) { const q = queue; queue = []; q.forEach(([fn, d]) => fn(d)); } return queue.length; },
    replay: (ev) => { while (queue.length) { const [fn, d, e] = queue.shift(); fn(d); if (e === ev) break; } return queue.length; },
    queued: () => queue.map((x) => x[2]),
    hold: (v) => { testHold = !!v; },
    stage: (name) => { clearTimers(); stage(name); },
    sim: (ev, d) => { if (handlers[ev]) handlers[ev](d); },
    runIn: () => { crowdKey = ''; renderCrowds(true); },
    hit,
  };
})();
