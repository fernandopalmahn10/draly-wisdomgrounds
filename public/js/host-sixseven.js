// 6-7 Swing v2 «La Balanza de Oro» — the projector (secondary: the phones are the product). Lobby (PIN + QR, the 3 steps,
// the round style «Números» / «En Chino» / «Mezcla», 2 / 3 / 4 min, the two teams as full-body characters: tap one to
// change team) → the balance: the teams run in, the rules card «¡Toca el resultado!» → «¿Listos?» → «¡YA!» → the game:
// the gold meter, the giant golden balance tipping toward the team with more gold (its pans fill with coins), Dralingo
// doing the «6-7» at its foot, the kids under their pans (a right answer: the kid swings and a coin flies up to the pan;
// a wrong one: a wobble), the landmark race, lead-change / landmark / last-30-s bands, the captains' lines → «¡FINAL!» →
// the ceremony: the great weigh-in, «¡Gana el Equipo …!», the bonus stars one by one, the podium. Teacher: Pausa (holds
// every clock), +30 s, Saltar (the intro, the ceremony), Terminar, Sonido, Otra ronda. F5 takes the same room back.
// Test hooks: SixSevenHost.frame(), .freeze(v) / .replay(ev), .hold(v), .stage(name), .sim(ev, d), .score(k, coins, gold, wrong).
(function () {
  'use strict';
  const socket = io();
  const $ = (id) => document.getElementById(id);
  const S = window.MochiStage;
  const X = window.SixSevenStage;
  const A = '/assets/sixseven/', K = '/assets/kingdoms/', H = '/assets/halcon/', MO = '/assets/mochi/';
  const reduced = X.reduced;
  const STAR_MS = 2100, WEIGH_MS = 3800, RESULT_MS = 3200;
  const TEAM_NAME = { red: 'Fuego', gold: 'Mar' };
  const STYLE_NAME = { num: 'Números', zh: 'En Chino', mix: 'Mezcla' };
  const PAUSE_ICON = '<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/>';
  const PLAY_ICON = '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/>';

  let pin = null, state = null, muted = false, duration = 120, paused = false, style = 'mix';
  let g = null;                         // { id, phase, race, frenzy, endAt (perf), pausedLeft, E }
  let meter = { r: 0, g: 0, b: null };
  let roster = {};                      // k → { k, name, avatar, team, off, skin }
  let figs = {};                        // k → kid figure under the pans
  let bal = null, coins = null, timers = [], lobbyKey = '', crowdKey = '', seen = new Set();
  let frozen = false, queue = [], testHold = false;
  const handlers = {};
  const onSs = (ev, fn) => { handlers[ev] = fn; socket.on(ev, (d) => { if (frozen) { queue.push([fn, d, ev]); return; } fn(d); }); };
  const later = (ms, fn) => { const t = setTimeout(fn, Math.max(0, ms)); timers.push(t); return t; };
  function clearTimers() { timers.forEach(clearTimeout); timers = []; stopHype(); bandQ = []; sayQ = []; }   // (only ever called after init)

  // ---------- sound ----------
  const SFX = {
    tick: K + 'tick.mp3', whoosh: K + 'whoosh.mp3', win: K + 'sting-win.mp3', flag: K + 'flag.mp3', alert: K + 'castle-alert.mp3',
    siege: K + 'siege.mp3', start: H + 'start.mp3', final: '/assets/party/final-v2.mp3', aww: H + 'aww.mp3', round: H + 'round.mp3',
    drum: MO + 'drum.mp3', star: MO + 'star.mp3', gold: MO + 'gold.mp3', coin: A + 'coins.mp3', landmark: K + 'landmark.mp3', liuqi: A + 'liuqi.mp3',
    shout: A + 'shout67.mp3',             // «¡SIX SEVEN!» shouted by a crowd (Kenney Voiceover Pack, CC0, layered: ../ss67 shout.sh)
  };
  const MUSIC = { lobby: K + 'music-lobby.mp3', play: A + 'music-swing.mp3', final: K + 'music-final.mp3' };
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
  // Dralingo's bubble: each line stays at least 2.5 s (a new one waits its turn, at most two wait), so the room can read it
  let sayT = null, sayQT = null, sayMinUntil = 0, sayQ = [];
  function say(text, ms) {
    const now = Date.now();
    if (now < sayMinUntil) {
      sayQ.push([text, ms]);
      if (sayQ.length > 2) sayQ.shift();
      if (!sayQT) sayQT = setTimeout(nextSay, sayMinUntil - now + 20);
      return;
    }
    const el = $('host-say');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(sayT);
    sayT = setTimeout(() => el.classList.remove('show'), ms || 3200);
    sayMinUntil = now + 2500;
    if (sayQ.length && !sayQT) sayQT = setTimeout(nextSay, 2520);
  }
  function nextSay() { sayQT = null; const n = sayQ.shift(); if (n) say(n[0], n[1]); }
  // the big bands, one at a time: a band that arrives while another shows waits its turn (at most two wait; «¡FINAL!»
  // goes first and clears the rest), so a «six seven» wave right after a landmark is never lost
  let bandT = null, bandUntil = 0, bandQ = [];
  function band(kind, parts, team, ms) {
    if (kind === 'final') bandQ = [];
    else if (!g || g.phase !== 'play') return;          // a late band never lands on «¡FINAL!» or the ceremony
    else if (g.endAt && !paused && g.endAt - performance.now() < 10500) return;   // the last 10 s belong to the big countdown
    else if (Date.now() < bandUntil - 150) { bandQ.push([kind, parts, team, ms]); if (bandQ.length > 2) bandQ.shift(); return; }
    const b = $('band');
    b.className = 'ssp-band ' + kind + (team ? ' ' + team : '');
    b.innerHTML = '';
    parts.forEach((p) => b.appendChild(p));
    void b.offsetWidth;
    b.classList.add('show');
    document.body.classList.add('band-on');
    clearTimeout(bandT);
    bandUntil = Date.now() + (ms || 2200);
    bandT = setTimeout(() => {
      if (testHold) return;
      b.classList.remove('show');
      document.body.classList.remove('band-on');
      const nx = bandQ.shift();
      if (nx) timers.push(setTimeout(() => band(...nx), 260));
    }, ms || 2200);
  }
  const node = (tag, txt, cls) => X.el(tag, cls, txt);

  // ---------- the room ----------
  const params = new URLSearchParams(location.search);
  function showPin(p) {
    pin = p;
    $('pin-display').textContent = p;
    $('active-pin').textContent = p;
    const url = `${location.origin}/?pin=${p}`;
    // the address breaks before «/?pin=», never inside the site name
    $('join-url').replaceChildren(location.host, document.createElement('wbr'), `/?pin=${p}`);
    document.title = `Draly 67 · ${p}`;
    drawQr(url);
    try { sessionStorage.setItem('draly.sixsevenHost', JSON.stringify({ pin: p })); } catch (_) {}
  }
  function createRoom() {
    socket.emit('host:create', { gameType: 'sixseven', style }, ({ pin: p }) => {
      showPin(p);
      socket.emit('host:set-duration', { pin, duration });
      socket.emit('host:ss-style', { pin, style });
    });
  }
  // A reload of this tab (F5 mid-class) takes the same room back instead of opening a new PIN.
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem('draly.sixsevenHost') || 'null'); } catch (_) {}
  if (saved && saved.pin && !params.get('livegame')) {
    socket.emit('host:reclaim', { pin: saved.pin }, (r) => {
      if (r && r.ok && r.gameType === 'sixseven') showPin(saved.pin);
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
  document.querySelectorAll('.ssp-dur button').forEach((b) => b.addEventListener('click', () => {
    duration = +b.dataset.s;
    document.querySelectorAll('.ssp-dur button').forEach((x) => x.classList.toggle('on', x === b));
    socket.emit('host:set-duration', { pin, duration });
  }));
  function paintStyle() {
    document.querySelectorAll('.ssp-style').forEach((x) => { const on = x.dataset.style === style; x.classList.toggle('on', on); x.setAttribute('aria-checked', on ? 'true' : 'false'); });
    const s = $('step-sum');
    if (s) { s.innerHTML = ''; s.appendChild(X.sum(style === 'zh' ? { a: 3, b: 4, op: '+', zh: true } : { a: 9, b: 3, op: '-', zh: false }, 'ssh-sum')); }
  }
  document.querySelectorAll('.ssp-style').forEach((b) => b.addEventListener('click', () => {
    style = b.dataset.style;
    paintStyle();
    socket.emit('host:ss-style', { pin, style });
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
    socket.emit('host:ss-skip', { pin });
    setTimeout(() => { b.disabled = false; }, 800);
  });
  const endNow = () => { if (confirm('¿Terminar la partida ahora?')) socket.emit('host:end-now', { pin }); };
  $('end-now-btn').addEventListener('click', endNow);
  $('paused-end-btn').addEventListener('click', endNow);
  $('cer-skip').addEventListener('click', () => { socket.emit('host:ss-skip', { pin }); stage('podium'); });
  $('home-btn').addEventListener('click', () => { location.href = '/'; });
  $('play-again-btn').addEventListener('click', () => {
    socket.emit('host:reset', { pin });
    clearTimers();
    g = null; meter = { r: 0, g: 0, b: null }; figs = {}; crowdKey = ''; lobbyKey = '';
    $('crowd-red').innerHTML = ''; $('crowd-gold').innerHTML = '';
    $('cer').innerHTML = '';
    showScreen('lobby');
  });
  socket.on('host:start-error', (e) => { alert(e && e.message ? e.message : 'No se pudo empezar.'); updateStartBtn(); });
  function updateStartBtn() {
    if (!state) return;
    $('start-btn').disabled = !(state.state === 'lobby' && Object.values(state.players || {}).some((p) => !p.off));
  }
  socket.on('state', (s) => {
    state = s;
    const list = Object.values(s.players || {});
    roster = {};
    list.forEach((p) => { if (p.k) roster[p.k] = { k: p.k, name: p.name, avatar: p.avatar, team: p.team, off: !!p.off, skin: p.sk || S.skinFor(p.avatar, p.name) }; });
    if (s.ssStyle && s.ssStyle !== style && s.state === 'lobby') { style = s.ssStyle; paintStyle(); }
    if (s.state === 'lobby') {
      if ([120, 180, 240].includes(s.duration)) {
        duration = s.duration;
        document.querySelectorAll('.ssp-dur button').forEach((x) => x.classList.toggle('on', +x.dataset.s === s.duration));
      }
      renderLobby(list);
      updateStartBtn();
    } else if (g && s.state === 'active') renderCrowds(false);
  });

  // ---------- lobby ----------
  let pvBal = null;
  function renderLobby(players) {
    if (!pvBal) {
      pvBal = new X.Balance($('pv-bal'));
      pvBal.fill(14, 9, 20);
      pvBal.set(-0.35, true);
      $('pv-dral').appendChild(X.dancer({}));
      // Dralingo's friends in the preview, each over its own number: «6 · liu» and «7 · qi» (a first look teaches it)
      [['liu', 'six', 6], ['qi', 'seven', 7]].forEach(([id, cls, n]) => {
        const box = node('div', null, 'ssp-pv-fr ' + cls);
        const f = X.friend(id, {});                     // standing still: Dralingo dances and the trio waves (two moving things)
        box.append(f, X.numTag(n));
        $('preview').appendChild(box);
      });
      X.preloadFriends(false);
      // Liu, Dralingo and Qi wave hello above «¡A jugar!» (a full projector only: css hides it on a short screen, and
      // its loop loads only once it shows, e.g. after F11)
      const hello = () => {
        const im = $('ssp-hello');
        if (!im || im.getAttribute('src') || getComputedStyle(im.parentNode).display === 'none') return;
        im.src = A + 'friends/anim/trio-wave' + (reduced() ? '-still' : '') + '.webp';
        window.removeEventListener('resize', hello);
      };
      hello();
      window.addEventListener('resize', hello);
      new X.Balance($('step-bal')).set(-0.6, true);
      paintStyle();
      X.preload();
      let k = -0.35;
      setInterval(() => { if (!$('screen-lobby').classList.contains('hidden') && !reduced()) { k = -k; pvBal.set(k); } }, 2600);
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
        b.className = 'ssp-kid' + (seen.has(p.name) ? '' : ' new');
        b.setAttribute('aria-label', `${p.name}: pasar al Equipo ${team === 'red' ? 'Mar' : 'Fuego'}`);
        seen.add(p.name);
        b.appendChild(S.kidFigure({ team, skin: p.sk || S.skinFor(p.avatar, p.name), name: p.name }));
        b.appendChild(node('i', '⇄', 'ssp-kid-swap'));
        b.addEventListener('click', () => {
          const id = state && Object.keys(state.players).find((sid) => state.players[sid].name === p.name);
          if (id) socket.emit('host:swap-team', { pin, playerId: id });
        });
        box.appendChild(b);
      });
      if (!mine.length) box.appendChild(node('p', 'Esperando jugadores: entren con el PIN.', 'ssp-empty'));
    });
  }

  // ---------- the balance ----------
  function buildStage() {
    if (!bal) {
      bal = new X.Balance($('bal'));
      coins = new X.Coins($('fx'), 50);
      $('dral').appendChild(X.dancer({ alt: 'Dralingo hace el seis-siete' }));
      // Liu (the 6) and Qi (the 7) stand with Dralingo at the foot of the balance: the 6 on his left, the 7 on his
      // right, like the buttons on every phone (2026-10-20). A right 6 → Liu cheers, a right 7 → Qi cheers; a team's
      // «¡SIX SEVEN!» wave → they jump together and become el 67.
      hostFr = { 6: X.friend('liu', { cls: 'ssp-fr six' }), 7: X.friend('qi', { cls: 'ssp-fr seven' }), j: X.friend('j67', { cls: 'ssp-fr j67', pose: 'cheer' }) };
      $('screen-stage').append(hostFr[6], hostFr[7], hostFr.j);
      X.preloadFriends(false, null, ['stand', 'b', 'cheer', 'run']);
    }
    $('screen-stage').classList.remove('frenzy');
    paintMeter();
  }
  // the kids under their pans; rebuilt only when who-is-where changes
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
      const avail = window.innerWidth * 0.33 - 2 * (perRow - 1) - (mine.length > 16 ? 50 : 0);
      const kw = Math.max(44, Math.min(118, Math.floor(avail / perRow)));
      box.style.setProperty('--kw', kw + 'px');
      box.style.setProperty('--kh', (rows === 2 ? Math.round(window.innerHeight * 0.105) : Math.round(window.innerHeight * 0.19)) + 'px');
      mine.slice(0, 16).forEach((p, i) => {
        let f = figs[p.k];
        const skin = p.skin || S.skinFor(p.avatar, p.name);
        if (!f || f._team !== team || f._skin !== skin) {
          f = S.kidFigure({ team, skin, name: p.name });
          f._team = team;
          figs[p.k] = f;
          X.sixReady(skin);                               // the 6-7 pictures load now, so the first wave shows them
        }
        f.classList.toggle('off', p.off);
        f.style.setProperty('--ci', i % 8);      // the crowd's 6-7 ripples a little from kid to kid
        if (runIn && !reduced()) {
          f.style.animation = 'none';
          void f.offsetWidth;
          f.style.animation = `ss-run .7s var(--ss-ease-out) ${0.2 + i * 0.06}s both`;
          f.style.setProperty('--from', team === 'red' ? '-50vw' : '50vw');
        }
        box.appendChild(f);
      });
      if (mine.length > 16) box.appendChild(node('span', `+${mine.length - 16}`, 'ssp-more'));
    });
  }
  window.addEventListener('resize', () => { if (g && !$('screen-stage').classList.contains('hidden')) { crowdKey = ''; renderCrowds(false); } });
  function paintMeter() {
    const sum = meter.r + meter.g;
    $('m-red').textContent = X.fmt(meter.r);
    $('m-gold').textContent = X.fmt(meter.g);
    $('m-bar').style.transform = `scaleX(${(sum ? meter.r / sum : 0.5).toFixed(3)})`;
    if (bal) { bal.set(X.tilt(meter.r, meter.g)); bal.fill(meter.r, meter.g, g && g.E); }
    const E = (g && g.E) || 100;
    ['red', 'gold'].forEach((team) => {
      const v = team === 'red' ? meter.r : meter.g;
      $('mark-' + team).style.left = Math.min(100, (100 * v) / E) + '%';
    });
  }
  function buildRace() {
    const r = $('race');
    r.querySelectorAll('.ssp-lm').forEach((x) => x.remove());
    const E = (g && g.E) || 100;
    (g.race || []).forEach((l, i) => {
      const d = node('div', null, 'ssp-lm' + (l.team ? ' ' + l.team : ''));
      d.dataset.id = l.id;
      d.style.left = Math.min(100, (100 * l.at) / E) + '%';
      const im = node('img');
      im.src = K + 'landmarks/' + l.id + '.webp';
      im.alt = l.name;
      d.append(im, node('b', '+' + l.bonus));
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
      box.querySelector('.ssp-capt-name').textContent = C().captain(id);
    });
  }
  const capT = {};
  function capSay(team, mood, ms) {
    const id = captains && captains[team];
    if (!id || !C()) return;
    const box = $('capt-' + team);
    const sayEl = box.querySelector('.ssp-capt-say');
    sayEl.textContent = C().line(id, mood);
    sayEl.classList.add('show');
    box.querySelector('img').src = C().pose(id, mood === 'oops' ? 'mystery' : 'cheer');
    box.classList.remove('cheer'); void box.offsetWidth; if (mood !== 'oops') box.classList.add('cheer');
    clearTimeout(capT[team]);
    capT[team] = setTimeout(() => { sayEl.classList.remove('show'); box.querySelector('img').src = C().pose(id, 'hello'); }, ms || 3200);
  }
  socket.on('ss:captains', (c) => { captains = c; paintCaptains(); });

  // ---------- countdown: the teams run in ----------
  socket.on('countdown', () => {
    clearTimers();
    stopMusic();
    g = { id: null, phase: 'countdown', race: [], frenzy: false, endAt: 0, pausedLeft: 0, E: 100 };
    meter = { r: 0, g: 0, b: null };
    showScreen('stage');
    buildStage();
    bal.set(0, true);
    bal.fill(0, 0, 100);
    friendsRest('stand');
    $('screen-stage').classList.remove('joined');
    friendsRunIn();
    $('skip-btn').classList.add('hidden');
    $('more-btn').classList.add('hidden');
    clearInterval(clockT);
    const dur = (state && state.duration) || duration;
    $('clock').textContent = `${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, '0')}`;
    $('count10').classList.add('hidden');
    $('style-now').textContent = STYLE_NAME[style] || '';
    renderCrowds(true);
    paintCaptains();
    later(700, () => { capSay('red', 'hello', 2600); capSay('gold', 'hello', 2600); });
    say('¡Bienvenidos a la Balanza de Oro! ¡Fuego contra Mar!', 3400);
    sfx('whoosh', 0.7);
    later(900, () => sfx('round', 0.5));
  });

  // ---------- the game ----------
  onSs('ss:init', (d) => {
    g = { id: d.id, phase: d.phase, race: d.race || [], frenzy: !!d.frenzy, endAt: d.endsMs != null ? performance.now() + d.endsMs : 0, pausedLeft: d.endsMs || 0, E: d.E || 100 };
    meter = Object.assign({}, meter, d.meter || {});
    if (d.style) style = d.style;
    $('style-now').textContent = STYLE_NAME[style] || '';
    (d.roster || []).forEach((p) => { roster[p.k] = Object.assign(roster[p.k] || {}, { k: p.k, name: p.name, team: p.team, off: !p.on, skin: p.skin }); });
    if (d.captains) { captains = d.captains; paintCaptains(); }
    showScreen('stage');
    buildStage();
    buildRace();
    paintMeter();
    renderCrowds(false);
    setPaused(!!d.paused, d);
    $('screen-stage').classList.toggle('frenzy', g.frenzy);
    if (g.frenzy && d.phase === 'play') hype();
    $('skip-btn').classList.toggle('hidden', d.phase !== 'intro');
    $('more-btn').classList.toggle('hidden', d.phase !== 'play');
    if (d.phase === 'intro' && d.duration) $('clock').textContent = `${Math.floor(d.duration / 60)}:${String(Math.round(d.duration) % 60).padStart(2, '0')}`;
    if (d.phase === 'intro' && !d.paused) showRules(d.phaseMs);
    if (d.phase === 'play' || d.phase === 'final') runClock();
    if (d.phase === 'final') band('final', [node('b', '¡FINAL!')], null, 2400);
    musicFor();
  });
  function showRules(ms) {
    const box = $('rules');
    box.innerHTML = '';
    box.classList.remove('hidden');
    const card = node('div', null, 'ssp-rules-card');
    const pic = node('div', null, 'ssi-pic');
    const sumCard = node('div', null, 'ssi-pic-card');
    sumCard.append(X.sum({ a: 3, b: 4, op: '+', zh: style === 'zh' }, 'ssi-pic-sum'), node('span', '= ?', 'ssi-pic-q'));
    const btns = node('div', null, 'ssi-pic-btns');
    const b6 = node('span', null, 'ssi-pic-b b6');
    b6.append(node('b', '6'), node('small', 'liù'));
    const b7 = node('span', null, 'ssi-pic-b b7');
    b7.append(node('b', '7'), node('small', 'qī'));
    btns.append(b6, b7);
    X.friendOnPic(b6, 6);                    // Liu on the 6, Qi on the 7: the buttons as every phone shows them
    X.friendOnPic(b7, 7);
    pic.append(sumCard, btns, node('i', null, 'ssx-hand ssi-pic-hand'));
    const txt = node('div');
    txt.append(node('h2', '¡Toca el resultado!'), node('p', 'Cada cuenta da 6 o 7: 6 es liù, 7 es qī. Piensa bien: en racha, cada acierto vale más oro.'));
    const sayEl = node('div', '', 'ssp-rules-say');
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
  onSs('ss:play', (d) => {
    if (!g) return;
    g.phase = 'play';
    g.endAt = performance.now() + (d.endsMs || 0);
    clearRules();
    $('rules').classList.add('hidden');
    $('skip-btn').classList.add('hidden');
    $('more-btn').classList.remove('hidden');
    runClock();
    musicFor();
    say('¡A contar! Cada acierto es oro para la balanza de su equipo.', 3600);
  });
  onSs('ss:meter', (d) => {
    if (!g) return;
    meter = Object.assign({}, meter, d);
    paintMeter();
    (d.f || []).forEach(([k, n, gold, wrong, six, dig]) => score(k, n, gold, wrong, six, dig));
  });
  // Liu and Qi with Dralingo (2026-10-20): each cheers the right answers of its own number, at most one hop a beat
  let hostFr = null, joinT = null;
  const frAt = { 6: 0, 7: 0 };
  function friendCheer(dig) {
    if (!hostFr || $('screen-stage').classList.contains('joined')) return;
    const now = performance.now();
    // at most one hop a friend every 2.6 s, never on top of a cheer still running: with a whole class answering, a
    // constant hop stops meaning «a 6 just came in» (design review 2026-10-20)
    [6, 7].forEach((d) => {
      if (!(dig & (d === 6 ? 1 : 2)) || now - frAt[d] < 2600 || hostFr[d].dataset.pose === 'cheer') return;
      frAt[d] = now;
      hostFr[d].react('cheer', 1200);
    });
  }
  // (el 67 cheers on the side of the team that waved: Fuego on Liu's side, Mar on Qi's; Dralingo keeps the middle)
  function friendsJoin(ms, team) {
    if (!hostFr) return;
    const st = $('screen-stage');
    hostFr.j.pose('cheer');
    st.classList.remove('joined');
    void st.offsetWidth;
    st.classList.toggle('joined-gold', team === 'gold');
    st.classList.add('joined');
    clearTimeout(joinT);
    joinT = setTimeout(() => st.classList.remove('joined'), ms || 2400);
  }
  function friendsRest(p) { if (hostFr) [6, 7].forEach((d) => { hostFr[d].rest(p === 'sway' ? 'stand' : p); hostFr[d].sway(p === 'sway'); }); }
  // the countdown: Liu races in from the left to Dralingo's left, Qi right behind him past Dralingo to his right
  // (both from the left: a 7 is never shown mirrored)
  function friendsRunIn() {
    if (!hostFr || reduced()) return;
    [6, 7].forEach((d, i) => {
      const f = hostFr[d];
      f.pose('run');
      if (f.animate) f.animate([{ transform: `translateX(${d === 6 ? -42 : -60}vw)` }, { transform: 'translateX(0)' }],
        { duration: 1000 + i * 250, delay: 250 + i * 220, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
      later(1350 + i * 470, () => f.rest('stand'));
    });
  }
  // kids who answered since the last beat: the kid swings and a coin flies up to the team's pan (or a wobble); a kid who
  // just did a «six seven» (racha 7, their 67th coin) gets a little «¡6-7!» over the head and a longer swing
  let flying = 0, pops = 0;
  const lastBump = { red: 0, gold: 0 };
  function score(k, n, gold, wrong, six, dig) {
    const p = roster[k];
    if (!p || !bal) return;
    const f = figs[k];
    if (six && f && f.isConnected) kidPop(f, p.team);
    if (n > 0 && dig) friendCheer(dig);
    if (n > 0) {
      if (f && f.isConnected) { X.swing(f, Math.random() < 0.5 ? 6 : 7, n >= 3); X.six(f, 650); }
      if (flying > 40) return;
      const shots = Math.min(3, Math.max(1, Math.round(n / 2)));
      const src = f && f.isConnected ? f._img.getBoundingClientRect() : $('crowd-' + p.team).getBoundingClientRect();
      for (let i = 0; i < shots; i++) {
        flying++;
        const to = bal.target(p.team);
        coins.fly({ x: src.left + src.width * 0.5, y: src.top + src.height * 0.25 }, { x: to.x + (Math.random() - 0.5) * 40, y: to.y }, {
          gold: !!gold && i === 0, size: gold && i === 0 ? 40 : 28, ms: 640, delay: i * 80, arc: 90, drift: (Math.random() - 0.5) * 60,
          onLand: () => {
            flying = Math.max(0, flying - 1);
            const now = performance.now();
            if (now - lastBump[p.team] > 220) { lastBump[p.team] = now; bal.bump(p.team, gold); sfx('coin', 0.3, 90); }
          },
        });
      }
      if (gold) sfx('gold', 0.55, 400);
    } else if (wrong && f && f.isConnected) X.wobble(f._img, false);
  }
  function kidPop(f, team) {
    if (pops >= 3) return;                     // 30 kids: at most three pops on screen at once
    pops++;
    f.classList.add('six');
    const chip = node('b', '¡6-7!', 'ssp-pop ' + team);
    f.appendChild(chip);
    sfx('coin', 0.45, 200);
    setTimeout(() => { chip.remove(); f.classList.remove('six'); pops = Math.max(0, pops - 1); }, 1700);
  }
  // a crew cheers together (the 6-7 swing) for a moment
  const crewT = {};
  function crewCheer(team, ms) {
    const box = $('crowd-' + team);
    if (!box) return;
    X.sixCrew(box, ms || 2000);                            // the whole crowd does the 6-7 (a picture, not motion)
    if (reduced()) return;
    box.classList.remove('cheer');
    void box.offsetWidth;
    box.classList.add('cheer');
    clearTimeout(crewT[team]);
    crewT[team] = setTimeout(() => box.classList.remove('cheer'), ms || 2000);
  }
  // a team's «¡SIX SEVEN!» wave: the whole crowd does the 6-7, the crowd shout, Dralingo dances big, gold into its pan
  onSs('ss:wave', (d) => {
    if (!g || !d) return;
    if (d.meter) { meter = Object.assign({}, meter, d.meter); paintMeter(); }
    const t = TEAM_NAME[d.team];
    crewCheer(d.team, 2600);
    friendsJoin(2600, d.team);               // Liu and Qi jump together: el 67 cheers on that team's side
    band('six', [node('b', '¡SIX SEVEN!'), node('span', `¡El Equipo ${t} llegó a ${X.fmt(d.gold)} de oro! Liù, qī`)], d.team, 2400);
    sfx('shout', 0.9);
    later(1050, () => sfx('liuqi', 0.8));
    if (bal) {
      bal.rock(true);
      if (!reduced()) { const to = bal.target(d.team); coins.burst({ x: to.x, y: to.y - 50 }, 16, { spread: 160, fall: 70, size: 30 }); }
    }
    const dr = $('dral');
    if (dr && !reduced()) { dr.classList.remove('hype'); void dr.offsetWidth; dr.classList.add('hype'); later(2400, () => dr.classList.remove('hype')); }
    capSay(d.team, 'sixseven', 2600);
    // both teams waving within a moment: one line for the two, not three lines racing each other
    const both = lastWave.team && lastWave.team !== d.team && Date.now() - lastWave.at < 1500;
    lastWave = { team: d.team, at: Date.now() };
    if (both) { sayQ = []; say('¡Six seven de los dos equipos! ¡Qué carrera!', 2600); }
    else say(`¡Six seven! ¡${t} suma ${X.fmt(d.gold)} de oro!`, 2600);
  });
  let lastWave = { team: null, at: 0 };
  onSs('ss:landmark', (l) => {
    if (!g || !l) return;
    if (l.meter) { meter = Object.assign({}, meter, l.meter); paintMeter(); }
    const r = (g.race || []).find((x) => x.id === l.id);
    if (r) r.team = l.team;
    const el = $('race').querySelector(`.ssp-lm[data-id="${l.id}"]`);
    if (el) el.classList.add(l.team, 'won');
    sfx('landmark', 0.7);
    if (bal && !reduced()) { const to = bal.target(l.team); coins.burst({ x: to.x, y: to.y - 40 }, 14, { spread: 140, fall: 60, size: 30 }); }
    const im = node('img');
    im.src = K + 'landmarks/big/' + l.id + '.webp';
    im.alt = '';
    band('landmark', [im, node('b', `¡El Equipo ${TEAM_NAME[l.team]} llegó al ${l.name}!`), node('span', `+${l.bonus} monedas de oro para su balanza`)], l.team, 2500);
    say(`¡${TEAM_NAME[l.team]} llegó primero al ${l.name}!`);
    capSay(l.team, 'swing');
    crewCheer(l.team, 1600);
  });
  onSs('ss:lead', (d) => {
    if (d.meter) { meter = Object.assign({}, meter, d.meter); paintMeter(); }
    const t = TEAM_NAME[d.team];
    band('lead', [node('b', d.first ? `¡El Equipo ${t} toma la delantera!` : `¡El Equipo ${t} pasa adelante!`), node('span', d.first ? '¡La balanza baja de su lado!' : '¡La balanza cambia de lado!')], d.team, 2300);
    sfx(d.first ? 'flag' : 'alert', 0.7);
    // (no bubble line next to the band: it already says it; in the last 10 s, when no band covers the countdown, the
    // bubble says it instead)
    if (g && g.endAt && !paused && g.endAt - performance.now() < 10500) say(`¡${t} pasa adelante!`, 2400);
    capSay(d.team, 'swing');
    capSay(d.team === 'red' ? 'gold' : 'red', 'oops');
    crewCheer(d.team, 1600);               // the team that passes ahead jumps into the 6-7
    if (bal && !d.first) bal.rock(false);  // the balance swings over to its side
  });
  onSs('ss:frenzy', (d) => {
    if (!g) return;
    g.frenzy = true;
    g.endAt = performance.now() + (d.endsMs || 30000);
    $('screen-stage').classList.add('frenzy');
    band('frenzy', [node('b', '¡ÚLTIMOS 30 SEGUNDOS!'), node('span', '¡Doble oro! Cada acierto vale el doble')], null, 2600);
    sfx('siege', 0.7);
    say('¡Doble oro! ¡Todo puede cambiar!');
    capSay('red', 'swing', 3600);
    capSay('gold', 'swing', 3600);
    stopMusic();
    musicFor();
    hype();
  });
  // the last 30 s on the projector: both crowds bob to the beat (css .frenzy), Dralingo dances faster, and the gap is
  // called out every ~7 s («¡Fuego gana por 12! ¡Vamos, Mar!») so the room hears the race
  let hypeT = null;
  function hype() {
    clearInterval(hypeT);
    friendsRest('sway');                     // the last 30 s: Liu and Qi do the 6-7 with Dralingo, non-stop
    hypeT = setInterval(() => {
      if (!g || g.phase !== 'play' || paused) return;
      const gap = Math.round(meter.r - meter.g);
      if (!gap) say('¡Empate! ¡Todo puede pasar!', 3000);
      else {
        const lead = gap > 0 ? 'Fuego' : 'Mar', trail = gap > 0 ? 'Mar' : 'Fuego';
        say(Math.abs(gap) <= 6 ? `¡${lead} gana solo por ${Math.abs(gap)}! ¡Vamos, ${trail}!` : `¡${lead} gana por ${X.fmt(Math.abs(gap))}! ¡Vamos, ${trail}!`, 3000);
      }
    }, 7000);
  }
  const stopHype = () => { clearInterval(hypeT); hypeT = null; };
  onSs('ss:scale', (d) => {
    if (!g || d.id !== g.id) return;
    g.race = d.race || g.race;
    g.E = d.E || g.E;
    if (d.meter) meter = Object.assign({}, meter, d.meter);
    buildRace();
    paintMeter();
  });
  onSs('ss:time', (d) => {
    if (!g) return;
    g.endAt = performance.now() + (d.endsMs || 0);
    if (paused) g.pausedLeft = d.endsMs || g.pausedLeft;
    say(d.add < 0 ? `¡${-d.add} segundos menos!` : `¡${d.add || 30} segundos más!`, 2200);
  });
  onSs('ss:pause', (d) => {
    if (!g) return;
    if (d.endsMs != null) { g.endAt = performance.now() + d.endsMs; g.pausedLeft = d.endsMs; }
    setPaused(d.paused, d);
  });
  function setPaused(v, d) {
    paused = !!v;
    $('paused').classList.toggle('hidden', !paused);
    $('pause-btn').querySelector('span').textContent = paused ? 'Seguir' : 'Pausa';
    $('pause-btn').querySelector('svg').innerHTML = paused ? PLAY_ICON : PAUSE_ICON;
    if (paused) stopMusic(); else musicFor();
    if (paused) clearRules();
    if (d && d.phase === 'intro' && !paused && d.phaseMs) showRules(d.phaseMs);
  }
  onSs('ss:final', (d) => {
    if (!g) return;
    clearTimers();
    g.phase = 'final';
    if (d && d.meter) { meter = Object.assign({}, meter, d.meter); paintMeter(); }
    clearInterval(clockT);
    $('clock').textContent = '0:00';
    $('count10').classList.add('hidden');
    setPaused(false);
    band('final', [node('b', '¡FINAL!')], null, 2400);
    sfx('final', 0.9);
    stopMusic();
    say('¡Se acabó! ¿Quién tiene más oro?', 2400);
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
    const stars = (end.sixseven && end.sixseven.stars) || [];
    const plan = [['weigh', WEIGH_MS], ['result', RESULT_MS]].concat(stars.map((s, i) => ['star' + i, STAR_MS]));
    let t = 0;
    plan.forEach(([name, ms]) => { later(t, () => stage(name)); t += ms; });
    later(t, () => stage('podium'));
  });
  function stage(name) {
    if (!end) return;
    const mo = end.sixseven || {}, tt = mo.totals || { r: 0, g: 0 };
    const box = $('cer');
    box.innerHTML = '';
    $('cer-fx').innerHTML = '';
    if (name === 'weigh') {
      box.appendChild(node('h2', '¿Quién tiene más oro?', 'ssp-cer-h'));
      const wrap = node('div', null, 'ssp-weigh');
      const nr = node('b', '0', 'ssp-wn r'), ng = node('b', '0', 'ssp-wn g');
      const bx = node('div', null, 'ssp-weigh-bal');
      wrap.append(nr, bx, ng);
      box.appendChild(wrap);
      const b = new X.Balance(bx);
      b.fill(tt.r, tt.g, Math.max(tt.r, tt.g, 1));
      b.set(0, true);
      later(250, () => b.weigh(X.tilt(tt.r, tt.g), 3100));
      S.countUp(nr, 0, tt.r, 2900);
      S.countUp(ng, 0, tt.g, 2900);
      sfx('drum', 0.8);
      return;
    }
    if (name === 'result') {
      const tie = mo.winner === 'tie';
      box.appendChild(node('h2', tie ? '¡Empate! ¡La balanza quedó igualita!' : `¡Gana el Equipo ${TEAM_NAME[mo.winner]}!`, 'ssp-cer-h win ' + (tie ? 'tie' : mo.winner)));
      const wc = mo.captains && !tie ? mo.captains[mo.winner] : null;
      if (wc && C()) box.appendChild(node('p', `${C().captain(wc)}: «${C().line(wc, 'oro')}»`, 'ssp-capline'));
      const row = node('div', null, 'ssp-res');
      ['red', 'gold'].forEach((team, ti) => {
        const win = tie || mo.winner === team;
        const side = node('div', null, 'ssp-rside ' + team + (win ? ' win' : ' lose'));
        const crew = node('div', null, 'ssp-rcrew');
        if (!win) crew.appendChild(X.cloud());
        const shown = ((mo.teams && mo.teams[team]) || []).slice(0, 10);
        crew.classList.toggle('two', shown.length > 5);
        crew.style.setProperty('--per', Math.ceil(shown.length / 2));         // two even rows: nobody alone at the back
        shown.forEach((r, i) => {
          const f = S.kidFigure({ team, skin: r.skin, name: r.name, pose: win ? 'ok' : 'no', tag: false });
          f.classList.add(win ? 'swing67' : 'sob');
          f.style.setProperty('--i', i % 5);
          crew.appendChild(f);
        });
        side.append(crew, node('b', `Equipo ${TEAM_NAME[team]} · ${X.fmt(team === 'red' ? tt.r : tt.g)} de oro`, 'ssf-total'));
        X.fitCloud(crew);
        if (win) { const conf = node('div', null, 'ssf-conf'); side.appendChild(conf); S.confetti(conf, tie ? null : team, tie ? 26 : 44); }
        row.appendChild(side);
        if (ti === 0) {
          // Dralingo dances the 6-7 in the middle with his friends Liu and Qi (2026-10-20)
          const mid = node('div', null, 'ssp-rmid');
          mid.append(X.friend('liu', { pose: 'dance', cls: 'ssp-rfr' }), X.dancer({ alt: 'Dralingo celebra con el seis-siete' }), X.friend('qi', { pose: 'dance', cls: 'ssp-rfr' }));
          row.appendChild(mid);
        }
      });
      box.appendChild(row);
      sfx('win', 0.9);
      later(500, () => sfx('liuqi', 0.8));
      if (!tie) later(900, () => sfx('aww', 0.45));
      return;
    }
    if (name.indexOf('star') === 0) {
      const st = (mo.stars || [])[Number(name.slice(4))];
      if (!st) return;
      const wrap = node('div', null, 'ssp-star');
      const badge = node('div', null, 'ssf-badge');
      badge.appendChild(S.starSvg());
      wrap.append(badge, node('h3', st.name));
      const who = node('div', null, 'ssp-star-who');
      (st.who || []).forEach((r, i) => {
        const f = S.kidFigure({ team: r.team, skin: r.skin, name: r.name, pose: 'ok' });
        f.style.setProperty('--i', i);
        who.appendChild(f);
      });
      wrap.appendChild(who);
      wrap.appendChild(node('div', (st.n > 4 ? `y ${st.n - 4} más · ` : '') + starValue(st), 'ssf-val'));
      box.appendChild(wrap);
      later(800, () => sfx('star', 0.8));
      return;
    }
    if (name === 'podium') {
      clearTimers();
      $('cer-skip').classList.add('hidden');
      $('endtools').classList.remove('hidden');
      box.appendChild(node('h2', mo.winner === 'tie' ? '¡Empate en la Balanza de Oro!' : `¡Campeón: Equipo ${TEAM_NAME[mo.winner]}!`, 'ssp-cer-h win ' + (mo.winner === 'tie' ? 'tie' : mo.winner)));
      const pod = node('div', null, 'ssp-podium');
      const top = (mo.top || []).filter((r) => r.coins > 0).slice(0, 3);
      [1, 0, 2].forEach((i) => {
        const r = top[i];
        const p = node('div', null, 'ssp-pod p' + (i + 1));
        if (r) {
          const f = S.kidFigure({ team: r.team, skin: r.skin, name: r.name, pose: 'ok' });
          const step = node('div', null, 'ssp-pod-step');
          step.append(node('span', String(r.rank || i + 1)), node('small', X.fmt(r.coins) + ' de oro'));
          if ((r.stars || []).length) {
            const stars = node('div', null, 'ssp-pod-stars');
            r.stars.forEach(() => stars.appendChild(S.starSvg()));
            step.appendChild(stars);
          }
          p.append(f, step);
        }
        pod.appendChild(p);
      });
      const mvps = node('div', null, 'ssp-mvps');
      ['red', 'gold'].forEach((team) => {
        const r = mo.mvp && mo.mvp[team];
        if (!r) return;
        const m = node('div', null, 'ssp-mvp ' + team);
        m.appendChild(S.kidFigure({ team, skin: r.skin, name: r.name, tag: false, pose: 'ok' }));
        const t = node('div');
        t.append(node('small', 'El mejor del Equipo ' + TEAM_NAME[team]), node('b', r.name), node('small', X.fmt(r.coins) + ' de oro'));
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
    if (st.id === 'right') return `${X.fmt(st.value)} ${st.value === 1 ? 'acierto' : 'aciertos'}`;
    if (st.id === 'aim') return `${st.value} %`;
    if (st.id === 'zh') return `${X.fmt(st.value)} en Chino Mandarín`;
    return `${X.fmt(st.value)} ${st.value === 1 ? 'moneda' : 'monedas'}`;
  }

  window.SixSevenHost = {
    frame: () => ({ pin, paused, style, phase: g && g.phase, meter: Object.assign({}, meter), frenzy: !!(g && g.frenzy), kids: Object.keys(figs).length, flying }),
    freeze: (v) => { frozen = !!v; if (!frozen) { const q = queue; queue = []; q.forEach(([fn, d]) => fn(d)); } return queue.length; },
    replay: (ev) => { while (queue.length) { const [fn, d, e] = queue.shift(); fn(d); if (e === ev) break; } return queue.length; },
    queued: () => queue.map((x) => x[2]),
    hold: (v) => { testHold = !!v; },
    stage: (name) => { clearTimers(); stage(name); },
    sim: (ev, d) => { if (handlers[ev]) handlers[ev](d); },
    runIn: () => { crowdKey = ''; renderCrowds(true); },
    score,
  };
})();
