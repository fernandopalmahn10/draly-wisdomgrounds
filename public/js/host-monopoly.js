// Dàfùwēng · Monopolio v2 «El Gran Tablero de Dubái» — the projector (secondary: the phones are the product). Lobby (PIN +
// QR, the 3 steps, the question pack, 3 / 4 / 5 min, the class as full-body characters) → the boards are dealt (each
// board's pieces on Salida) → the rules card «¡Responde y tira el dado!» → «¿Listos?» → «¡YA!» → the game: every board
// side by side (the same Dubai map, each kid a full-body piece in its seat colour hopping as it moves, the star with
// Dralingo, the landmarks taking their owner's flag), each board's players with stars and coins (a flash on every
// answer), the class top 3, the clock; bands for the big moments one at a time (a star, a storm, Burj Khalifa bought,
// a new leader, the last 30 s) → «¡FINAL!» → the ceremony: every board's bonus stars, each board's winner, the class
// podium. Teacher: Pausa (holds every clock), +30 s, Saltar (the intro, the ceremony), Terminar, Sonido, Otra ronda;
// F5 takes the same room back.
// Test hooks: MonoHost.frame(), .freeze(v) / .replay(ev), .hold(v), .stage(name), .sim(ev, d).
(function () {
  'use strict';
  const socket = io();
  const $ = (id) => document.getElementById(id);
  const B = window.MonoBoard;
  const MAP = window.MonoMap;
  const T = MAP.T;
  const MN = '/assets/monopoly/', K = '/assets/kingdoms/', H = '/assets/halcon/', MO = '/assets/mochi/';
  const reduced = B.reduced;
  const el = B.el;
  const fmt = B.fmt;
  const sleep = B.sleep;
  const LM = MAP.LANDMARKS;
  const PAUSE_ICON = '<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/>';
  const PLAY_ICON = '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/>';

  let pin = null, state = null, muted = false, duration = 240, paused = false;
  let g = null;                         // { id, phase, frenzy, endAt (perf), pausedLeft }
  let tiles = {};                       // board id → { id, root, board, head, chips: { k: el }, seats: { k: seat }, lead }
  let timers = [], frozen = false, queue = [], testHold = false;
  const handlers = {};
  const on = (ev, fn) => { handlers[ev] = fn; socket.on(ev, (d) => { if (frozen) { queue.push([fn, d, ev]); return; } fn(d); }); };
  const later = (ms, fn) => { const t = setTimeout(fn, Math.max(0, ms)); timers.push(t); return t; };
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  // ---------- sound ----------
  const SFX = {
    tick: K + 'tick.mp3', whoosh: K + 'whoosh.mp3', win: K + 'sting-win.mp3', flag: K + 'flag.mp3', alert: K + 'castle-alert.mp3',
    siege: K + 'siege.mp3', start: H + 'start.mp3', final: H + 'final.mp3', aww: H + 'aww.mp3', round: H + 'round.mp3',
    drum: MO + 'drum.mp3', star: MN + 'star.mp3', landmark: K + 'landmark.mp3', storm: MN + 'storm.mp3', level: MN + 'level.mp3',
  };
  const MUSIC = { lobby: K + 'music-lobby.mp3', play: MN + 'music-board.mp3', final: K + 'music-final.mp3' };
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

  // ---------- bands: one big moment at a time, ≥ 2.6 s apart, the most important first ----------
  let bandQ = [], bandOn = false;
  const RANK = { star: 4, storm: 3, frenzy: 5, lead: 1, buy: 2, time: 5 };
  function band(kind, parts, extra, ms) {
    // a newer band of the same kind replaces a waiting one: the projector never tells an old storm while another board storms
    for (let i = bandQ.length - 1; i >= 0; i--) if (bandQ[i].kind === kind) bandQ.splice(i, 1);
    bandQ.push({ kind, parts, extra, ms: ms || 2600, at: Date.now() });
    bandQ.sort((a, b) => (RANK[b.kind] || 0) - (RANK[a.kind] || 0));
    if (bandQ.length > 3) bandQ.length = 3;
    if (!bandOn) nextBand();
  }
  function nextBand() {
    const b = $('band');
    let it = bandQ.shift();
    // too old: skip it (a board moment is over after ~3 s; the frenzy and the clock bands wait longer)
    while (it && Date.now() - it.at > (it.kind === 'frenzy' || it.kind === 'time' ? 6000 : 3000)) it = bandQ.shift();
    if (!it) { bandOn = false; return; }
    bandOn = true;
    b.className = 'mnh-band ' + it.kind;
    b.innerHTML = '';
    if (it.extra) b.appendChild(it.extra);
    const txt = el('div');
    it.parts.forEach((p) => txt.appendChild(p));
    b.appendChild(txt);
    void b.offsetWidth;
    b.classList.add('show');
    setTimeout(() => {
      if (testHold) return;
      b.classList.remove('show');
      setTimeout(nextBand, 300);
    }, it.ms);
  }
  const bold = (t) => el('b', null, t);
  const span = (t) => el('span', null, t);

  // ---------- the room ----------
  const params = new URLSearchParams(location.search);
  const setId = params.get('setId');
  const LIVE = params.get('livegame') === '1' ? '&livegame=1' : '';
  if (!setId) { location.href = '/packs.html?game=monopoly' + LIVE; return; }
  $('set-change').href = '/packs.html?game=monopoly' + LIVE;
  function showPin(p) {
    pin = p;
    $('pin-display').textContent = p;
    $('active-pin').textContent = p;
    const url = `${location.origin}/?pin=${p}`;
    $('join-url').replaceChildren(location.host, document.createElement('wbr'), `/?pin=${p}`);
    document.title = `Dàfùwēng · ${p}`;
    drawQr(url);
    try { sessionStorage.setItem('draly.monopolyHost', JSON.stringify({ pin: p, setId })); } catch (_) {}
  }
  function createRoom() {
    socket.emit('host:create', { gameType: 'monopoly' }, (r) => {
      if (!r || !r.pin) return;
      showPin(r.pin);
      socket.emit('host:set-duration', { pin, duration });
      socket.emit('host:load-set', { pin, setId }, (resp) => {
        if (!resp || !resp.ok) { alert('No se pudo cargar la serie de preguntas.'); location.href = '/packs.html?game=monopoly' + LIVE; return; }
        $('set-title').textContent = `${resp.title} · ${resp.count} preguntas`;
        updateStartBtn();
      });
    });
  }
  // A reload of this tab (F5 mid-class) takes the same room back instead of opening a new PIN.
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem('draly.monopolyHost') || 'null'); } catch (_) {}
  if (saved && saved.pin && saved.setId === setId && !LIVE) {
    socket.emit('host:reclaim', { pin: saved.pin }, (r) => {
      if (r && r.ok && r.gameType === 'monopoly') { showPin(saved.pin); $('set-title').textContent = 'la serie elegida'; }
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
  document.querySelectorAll('.mnh-dur button').forEach((b) => b.addEventListener('click', () => {
    duration = +b.dataset.s;
    document.querySelectorAll('.mnh-dur button').forEach((x) => x.classList.toggle('on', x === b));
    socket.emit('host:set-duration', { pin, duration });
  }));
  $('start-btn').addEventListener('click', () => { $('start-btn').disabled = true; socket.emit('host:start', { pin }); });
  $('pause-btn').addEventListener('click', () => socket.emit('host:pause', { pin, paused: !paused }));
  $('resume-btn').addEventListener('click', () => socket.emit('host:pause', { pin, paused: false }));
  $('more-btn').addEventListener('click', () => socket.emit('host:add-time', { pin, seconds: 30 }));
  $('skip-btn').addEventListener('click', () => {
    const b = $('skip-btn');
    if (b.disabled) return;
    b.disabled = true;
    socket.emit('host:mn-skip', { pin });
    setTimeout(() => { b.disabled = false; }, 800);
  });
  const endNow = () => { if (confirm('¿Terminar la partida ahora?')) socket.emit('host:end-now', { pin }); };
  $('end-now-btn').addEventListener('click', endNow);
  $('paused-end-btn').addEventListener('click', endNow);
  $('cer-skip').addEventListener('click', () => { socket.emit('host:mn-skip', { pin }); stage('podium'); });
  $('home-btn').addEventListener('click', () => { location.href = '/'; });
  $('play-again-btn').addEventListener('click', () => {
    socket.emit('host:reset', { pin });
    clearTimers();
    resetBoards();
    g = null;
    $('cer').innerHTML = '';
    showScreen('lobby');
  });
  socket.on('host:start-error', (e) => { alert(e && e.message ? e.message : 'No se pudo empezar.'); updateStartBtn(); });
  function updateStartBtn() {
    if (!state) return;
    $('start-btn').disabled = !(state.state === 'lobby' && state.questionsLoaded > 0 && Object.values(state.players || {}).some((p) => !p.off));
  }

  // ---------- the lobby ----------
  let preview = null, crowdKey = '';
  function lobbyDecor() {
    const sd = $('step-dice');
    if (sd && !sd.firstChild) { const d = B.dice(); d._face.textContent = '4'; sd.append(d, el('i', 'mn-hand')); }
    const ss = $('step-star');
    if (ss && !ss.firstChild) { const im = el('img', 'mnh-hold'); im.src = B.DRALINGO_STAR || B.DRALINGO; im.alt = 'Dralingo con la estrella'; ss.append(im); }
    if (!preview && $('preview')) {
      preview = new B.Board($('preview'), { mode: 'tile', tags: false });
      requestAnimationFrame(() => preview.fit());
    }
  }
  function boardsNote(n) {
    if (n <= 0) return 'Tableros de 4: cada uno contra 3 rivales';
    if (n <= 5) return `1 tablero de ${n}`;
    const k = Math.ceil(n / 4);
    return `${k} tableros de 3 o 4`;
  }
  function paintCrowd() {
    const list = Object.values((state && state.players) || {});
    $('count').textContent = String(list.filter((p) => !p.off).length);
    $('boards-note').textContent = boardsNote(list.filter((p) => !p.off).length);
    const key = list.map((p) => `${p.name}:${p.sk || ''}:${p.off ? 1 : 0}`).join('|');
    if (key === crowdKey) return;
    crowdKey = key;
    const box = $('crowd');
    box.innerHTML = '';
    const n = list.length;
    const kh = n > 24 ? 74 : n > 14 ? 88 : 104;
    box.style.setProperty('--kh', kh + 'px');
    box.style.setProperty('--kw', Math.round(kh * 0.72) + 'px');
    list.forEach((p, i) => {
      const f = B.figure({ skin: p.sk || B.skinFor(p.avatar, p.name), c: -1, name: p.name, tag: true });   // seats (colours) come with the deal
      if (p.off) f.classList.add('off');
      box.appendChild(f);
    });
  }

  // ---------- the boards ----------
  function resetBoards() {
    Object.values(tiles).forEach((t) => { if (t.board) t.board.destroy(); });
    tiles = {};
    $('grid').innerHTML = '';
    $('top3').innerHTML = '';
    classTile = null;
  }
  // an odd number of boards leaves a hole in the grid: the class ranking fills it (who leads the whole class)
  let classTile = null;
  function layoutGrid() {
    const n = Object.keys(tiles).length;
    const cols = n <= 1 ? 1 : n <= 4 ? 2 : n <= 6 ? 3 : n <= 8 ? 4 : n <= 9 ? 3 : 4;
    const holes = n > 1 ? (cols - (n % cols)) % cols : 0;
    if (holes && !classTile) { classTile = el('section', 'mnh-tile mnh-class'); classTile.appendChild(el('h3', 'mnh-class-h', 'La clase')); classTile.appendChild(el('ol', 'mnh-class-list')); }
    if (classTile) { if (holes) { $('grid').appendChild(classTile); classTile.style.gridColumn = 'span ' + holes; } else classTile.remove(); }
    $('grid').style.setProperty('--cols', String(cols));
    $('grid').classList.toggle('roomy', n <= 4);   // up to 4 boards: bigger chips, readable from the back
    paintTop3();
    requestAnimationFrame(() => Object.values(tiles).forEach((t) => t.board.fit()));
  }
  function ensureTile(view) {
    let t = tiles[view.id];
    if (!t) {
      const root = el('section', 'mnh-tile');
      const head = el('div', 'mnh-tile-head');
      head.appendChild(el('span', 'mnh-tile-name', 'Tablero ' + view.id));
      const mapBox = el('div', 'mnh-tile-map');
      root.append(head, mapBox);
      $('grid').appendChild(root);
      const board = new B.Board(mapBox, { mode: 'tile', tags: false });
      t = tiles[view.id] = { id: view.id, root, head, board, chips: {}, seats: {}, lead: null, viewSeq: 0 };
      layoutGrid();
    }
    (view.seats || []).forEach((s) => { t.seats[s.k] = Object.assign(t.seats[s.k] || {}, s, { seq: Math.max((t.seats[s.k] && t.seats[s.k].seq) || 0, view.seq || 0) }); });
    t.board.setSeats(Object.values(t.seats));
    t.board.setOwners(view.owners || {});
    t.board.setStar(view.star, false);
    t.lead = view.lead;
    t.viewSeq = Math.max(t.viewSeq, view.seq || 0);
    paintChips(t);
    return t;
  }
  function paintChips(t) {
    const list = Object.values(t.seats).sort((a, b) => a.c - b.c);
    list.forEach((s) => {
      let c = t.chips[s.k];
      if (!c) {
        c = el('div', 'mnh-chip');
        c.style.setProperty('--pc', B.colorOf(s.c).c);
        c.append(el('i'), el('b', null, s.name));
        const st = el('span'); st.append(B.star(), el('em', 'n-st', '0'));
        const co = el('span'); co.append(B.coin(), el('em', 'n-co', '0'));
        c.append(st, co);
        c.querySelectorAll('em').forEach((x) => { x.style.fontStyle = 'normal'; });
        t.head.appendChild(c);
        t.chips[s.k] = c;
      }
      c.querySelector('.n-st').textContent = fmt(s.stars);
      c.querySelector('.n-co').textContent = fmt(s.coins);
      c.classList.toggle('lead', t.lead === s.k && list.length > 1);
      c.classList.toggle('off', s.on === false);
    });
  }
  function snap(t, map, seq, keepPos) {
    let changed = false;
    Object.entries(map || {}).forEach(([k, v]) => {
      const s = t.seats[k];
      if (!s || (s.seq || 0) > seq) return;
      s.seq = seq;
      if (s.coins !== v[1] || s.stars !== v[2]) changed = true;
      s.coins = v[1];
      s.stars = v[2];
      if (!keepPos) s.pos = v[0];
    });
    if (changed) { paintChips(t); top3Soon(); }
  }
  const group = (ev) => { const out = {}; (ev || []).forEach((e) => { (out[e.at] = out[e.at] || []).push(e); }); return out; };
  function move(mv) {
    const t = tiles[mv.b];
    if (!t || !t.seats[mv.k]) return;
    if (mv.seq <= t.viewSeq) return;          // already in the board this screen got whole (F5 / reclaim)
    const at = group(mv.ev);
    t.board.hop(mv.k, mv.path, {
      gate: async (i) => { if (i > 0) for (const e of (at[i] || [])) await moment(t, e, mv); },
      end: async () => { for (const e of (at[mv.path.length] || [])) await moment(t, e, mv); },
    }).then(() => {
      (mv.seats || []).forEach((x) => { if (t.seats[x.k]) t.board.settle(x.k, x.pos); });
      snap(t, Object.fromEntries((mv.seats || []).map((x) => [x.k, [x.pos, x.coins, x.stars]])), mv.seq);
    });
  }
  const nameOf = (t, k) => (t.seats[k] ? t.seats[k].name : '');
  function kidFig(t, k, pose) {
    const s = t.seats[k];
    return s ? B.figure({ skin: s.skin, c: s.c, name: s.name, pose: pose || 'ok' }) : null;
  }
  function ping(t) { t.root.classList.remove('ping'); void t.root.offsetWidth; t.root.classList.add('ping'); }
  async function moment(t, e, mv) {
    const k = mv.k;
    const ms = MAP.evMs(e);
    const t0 = performance.now();
    const p = t.board.posOf(k);
    switch (e.type) {
      case 'star':
        t.board.pop(p, '★', 'star');
        later(700, () => t.board.setStar(e.to, true));
        band('star', [bold(`¡Estrella para ${nameOf(t, k)}!`), span(`Tablero ${t.id} · Dralingo se la dio por 10 monedas`)], kidFig(t, k), 2600);
        sfx('star', 0.7, 900);
        ping(t);
        break;
      case 'buy':
        t.board.own(e.lm, { k, lvl: 1 });
        if (LM[e.lm].id === 'burj' || LM[e.lm].id === 'arab') {
          const im = el('img'); im.src = B.lmArt(LM[e.lm].id); im.alt = '';
          band('buy', [bold(`${nameOf(t, k)} compró ${LM[e.lm].name}`), span(`Tablero ${t.id} · quien caiga ahí le paga peaje`)], im, 2300);
          sfx('landmark', 0.5, 1500);
        }
        ping(t);
        break;
      case 'level': t.board.own(e.lm, { k, lvl: e.lvl }); break;
      case 'lucky':
        if (e.out === 'swap') { t.board.jump(k, e.to, { now: true }); t.board.jump(e.with, e.from); }
        break;
      case 'storm':
        t.board.storm();
        later(900, () => t.board.setStar(e.to, true));
        band('storm', [bold(`¡Tormenta de arena en el Tablero ${t.id}!`), span(`La provocó ${nameOf(t, k)}: todos pierden monedas y la estrella vuela`)], null, 2400);
        sfx('storm', 0.6, 1200);
        ping(t);
        break;
      case 'blue': t.board.pop(p, '+' + e.coins, 'gain'); break;
      case 'red': t.board.pop(p, String(e.coins || 0), 'loss'); break;
      case 'pass': t.board.pop(0, '+' + e.coins, 'gain'); break;
      default: break;
    }
    const half = Math.min(500, ms * 0.4);
    if (half > 0) await sleep(half);
    snap(t, e.s, mv.seq, true);
    const rest = ms - (performance.now() - t0);
    if (rest > 0) await sleep(rest);
  }
  // the class top 3 (stars, then coins) across every board
  let top3T = null;
  function top3Soon() { if (top3T) return; top3T = setTimeout(() => { top3T = null; paintTop3(); }, 500); }
  function paintTop3() {
    const all = [];
    Object.values(tiles).forEach((t) => Object.values(t.seats).forEach((s) => all.push(s)));
    all.sort((a, b) => b.stars - a.stars || b.coins - a.coins);
    const box = $('top3');
    box.innerHTML = '';
    all.slice(0, 3).forEach((s, i) => {
      if (!(s.stars > 0 || s.coins > 0)) return;
      const k = el('div', 'mnh-top3-k');
      k.appendChild(B.figure({ skin: s.skin, c: s.c, name: s.name }));
      const txt = el('div');
      const nm = el('b'); nm.append(el('em', null, (i + 1) + 'º'), document.createTextNode(s.name));
      const v = el('span'); v.append(B.star(), document.createTextNode(fmt(s.stars) + ' · ' + fmt(s.coins)), B.coin());
      txt.append(nm, v);
      k.appendChild(txt);
      box.appendChild(k);
    });
    // the class panel (when a board-sized hole is free): the top 6 of the whole class
    const list = classTile && classTile.querySelector('.mnh-class-list');
    if (!list || !classTile.isConnected) return;
    list.innerHTML = '';
    all.slice(0, 6).forEach((s, i) => {
      const li = el('li', 'mnh-class-k');
      li.appendChild(el('em', null, (i + 1) + 'º'));
      li.appendChild(B.figure({ skin: s.skin, c: s.c, name: s.name }));
      li.appendChild(el('b', null, s.name));
      const v = el('span'); v.append(B.star(), document.createTextNode(fmt(s.stars)), B.coin(), document.createTextNode(fmt(s.coins)));
      li.appendChild(v);
      list.appendChild(li);
    });
  }

  // ---------- the clock ----------
  let clockT = null, lastCount = null;
  function runClock() {
    clearInterval(clockT);
    const paint = () => {
      if (!g || !g.endAt) { const d = (g && g.dur) || duration; $('clock').textContent = `${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}`; return; }
      const left = g.paused ? g.pausedLeft : Math.max(0, g.endAt - performance.now());
      const s = Math.max(0, Math.ceil(left / 1000));
      $('clock').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      const c10 = $('count10');
      if (g.phase === 'play' && !g.paused && s <= 10 && s > 0) {
        c10.classList.remove('hidden');
        if (lastCount !== s) { lastCount = s; c10.textContent = String(s); sfx('tick', 0.5); }
      } else c10.classList.add('hidden');
    };
    paint();
    clockT = setInterval(paint, 250);
  }

  // ---------- the countdown, the rules card ----------
  function runIn(n) {
    const r = $('runin');
    r.classList.remove('hidden');
    r.innerHTML = '';
    const b = el('b', null, n > 1 ? `¡${n} tableros listos!` : '¡Tablero listo!');
    b.appendChild(el('small', null, 'Cada uno a su Salida… ¡la estrella espera!'));
    r.appendChild(b);
    sfx('round', 0.5);
    later(COUNTDOWN_HIDE, () => { if (!testHold) r.classList.add('hidden'); });
  }
  const COUNTDOWN_HIDE = 2600;
  function showRules(ms) {
    const box = $('rules');
    box.classList.remove('hidden');
    box.innerHTML = '';
    const c = el('div', 'mni-card');
    const pic = el('div', 'mni-pic');
    const d = B.dice(); d._face.textContent = '5';
    pic.append(d, B.figure({ skin: 'dralingo', c: 1, name: '' }), el('i', 'mn-hand'));
    c.append(pic, el('h2', null, '¡Responde y tira el dado!'), el('p', null, 'Cada respuesta correcta es un dado. Compra monumentos y llega a la estrella con 10 monedas'));
    const say = el('div', 'mni-say');
    c.appendChild(say);
    box.appendChild(c);
    const total = Math.max(1400, ms || T.show * 3.7);
    later(total - 1250, () => { say.textContent = '¿Listos?'; sfx('tick', 0.7); });
    later(total - 600, () => { say.textContent = '¡YA!'; sfx('start', 0.8); });
    later(total + 300, () => { if (!testHold) box.classList.add('hidden'); });
  }

  // ---------- events ----------
  on('state', (s) => {
    state = s;
    if (s.state === 'lobby') {
      if (!$('screen-win').classList.contains('hidden') || !$('screen-stage').classList.contains('hidden')) { resetBoards(); g = null; }
      showScreen('lobby');
      lobbyDecor();
      paintCrowd();
      if ([180, 240, 300].includes(s.duration)) {
        duration = s.duration;
        document.querySelectorAll('.mnh-dur button').forEach((x) => x.classList.toggle('on', +x.dataset.s === s.duration));
      }
    }
    // who is online (a kid who left stays on the board, greyed)
    Object.values(s.players || {}).forEach((p) => {
      if (p.k == null) return;
      Object.values(tiles).forEach((t) => { const st = t.seats[p.k]; if (st && st.on !== !p.off) { st.on = !p.off; t.board.online(p.k, !p.off); paintChips(t); } });
    });
    updateStartBtn();
  });
  on('countdown', () => { clearTimers(); resetBoards(); showScreen('stage'); $('skip-btn').classList.add('hidden'); });
  on('mn:init', (d) => {
    g = { id: d.id, dur: d.duration, phase: d.phase, frenzy: !!d.frenzy, paused: !!d.paused, endAt: d.endsMs != null ? performance.now() + d.endsMs : 0, pausedLeft: d.endsMs || 0 };
    showScreen('stage');
    (d.boards || []).forEach((v) => ensureTile(v));
    B.preload([].concat(...(d.boards || []).map((v) => v.seats.map((s) => s.skin))));
    layoutGrid();
    paintTop3();
    runClock();
    setPaused(!!d.paused);
    $('screen-stage').classList.toggle('frenzy', g.frenzy);
    if (d.phase === 'countdown') runIn((d.boards || []).length);
    if (d.phase === 'intro') { $('skip-btn').classList.remove('hidden'); showRules(d.phaseMs); }
    if (d.phase === 'final') $('final').classList.remove('hidden');
  });
  on('mn:seat', (d) => { if (d && d.board) { ensureTile(d.board); paintTop3(); } });
  on('mn:intro', (d) => { if (!g) return; g.phase = 'intro'; $('skip-btn').classList.remove('hidden'); showRules(d && d.ms); });
  on('mn:play', (d) => {
    if (!g) return;
    g.phase = 'play';
    g.endAt = performance.now() + (d.endsMs || 0);
    $('skip-btn').classList.add('hidden');
    $('rules').classList.add('hidden');
    musicFor();
  });
  on('mn:move', (mv) => { if (mv) move(mv); });
  on('mn:ans', (a) => {
    Object.values(tiles).forEach((t) => {
      const c = t.chips[a.k];
      if (!c) return;
      c.classList.remove('ok', 'no');
      void c.offsetWidth;
      c.classList.add(a.right ? 'ok' : 'no');
    });
  });
  on('mn:lead', (l) => {
    const t = tiles[l.b];
    if (!t) return;
    t.lead = l.k;
    paintChips(t);
    band('lead', [bold(`Tablero ${t.id}: ¡${nameOf(t, l.k)} ${l.first ? 'toma la delantera' : 'pasa al primer lugar'}!`), span('Más estrellas gana; si empatan, más monedas')], kidFig(t, l.k), 2200);
    sfx('flag', 0.4, 2500);
  });
  on('mn:frenzy', (d) => {
    if (!g) return;
    g.frenzy = true;
    g.endAt = performance.now() + (d.endsMs || 30000);
    $('screen-stage').classList.add('frenzy');
    band('frenzy', [bold('¡Últimos 30 segundos!'), span('¡MONEDAS DOBLES en todos los tableros!')], B.star(), 2800);
    sfx('siege', 0.6);
    musicFor();
  });
  on('mn:time', (d) => {
    if (!g) return;
    g.endAt = performance.now() + (d.endsMs || 0);
    if (g.paused) g.pausedLeft = d.endsMs || g.pausedLeft;
    band('time', [bold(`+${d.add || 30} segundos más`)], null, 1600);
  });
  function setPaused(v) {
    paused = !!v;
    $('paused').classList.toggle('hidden', !paused);
    $('pause-btn').querySelector('svg').innerHTML = paused ? PLAY_ICON : PAUSE_ICON;
    $('pause-btn').querySelector('span').textContent = paused ? 'Seguir' : 'Pausa';
    if (paused) stopMusic(); else musicFor();
  }
  on('mn:pause', (d) => {
    if (!g) return;
    g.paused = !!d.paused;
    if (g.paused) g.pausedLeft = Math.max(0, g.endAt - performance.now());
    else if (d.endsMs != null) g.endAt = performance.now() + d.endsMs;
    setPaused(g.paused);
    if (g.phase === 'intro') { if (g.paused) { clearTimers(); $('rules').classList.add('hidden'); } else showRules(d.phaseMs); }
  });
  on('mn:final', () => {
    if (g) { g.phase = 'final'; g.paused = false; }
    setPaused(false);
    $('count10').classList.add('hidden');
    $('rules').classList.add('hidden');
    $('final').classList.remove('hidden');
    sfx('final', 0.85);
    stopMusic();
  });
  on('game-end', (d) => {
    $('final').classList.add('hidden');
    $('count10').classList.add('hidden');
    clearInterval(clockT);
    bandQ = [];
    $('band').classList.remove('show');
    ceremony(d);
  });

  // ---------- the ceremony ----------
  let cer = null;
  function ceremony(d) {
    clearTimers();
    cer = { d, stage: null };
    showScreen('win');
    const mo = (d && d.monopoly) || {};
    const nb = Math.max(...(mo.boards || []).map((b) => (b.bonus || []).length), 0);
    const plan = [['bonus-intro', 1800]];
    for (let i = 0; i < nb; i++) plan.push(['bonus' + i, 2300]);
    plan.push(['drum', 1300], ['winners', 3800], ['podium', 0]);
    let t = 0;
    plan.forEach(([name, ms]) => { later(t, () => stage(name), 0); t += ms; });
  }
  function cerGrid(boards, fill) {
    const grid = el('div', 'mnh-cer-grid');
    const n = boards.length;
    grid.style.setProperty('--cols', String(n <= 1 ? 1 : n <= 4 ? 2 : n <= 6 ? 3 : 4));
    grid.classList.toggle('roomy', n <= 4);   // few boards: bigger characters and numbers
    boards.forEach((b) => { const box = el('section', 'mnh-cer-b'); box.appendChild(el('h3', null, 'Tablero ' + b.id)); fill(box, b); grid.appendChild(box); });
    return grid;
  }
  function confetti(host, c, n) {
    if (reduced()) return;
    const col = B.colorOf(c);
    const cols = [col.c, col.s, '#ffc93c', '#fff7e3'];
    for (let i = 0; i < (n || 30); i++) {
      const x = el('i', 'mn-confetti');
      x.style.setProperty('--x', (2 + Math.random() * 96) + '%');
      x.style.setProperty('--d', (Math.random() * 0.8).toFixed(2) + 's');
      x.style.setProperty('--r', Math.round(Math.random() * 360) + 'deg');
      x.style.setProperty('--dx', Math.round((Math.random() - 0.5) * 140) + 'px');
      x.style.background = cols[i % cols.length];
      host.appendChild(x);
      setTimeout(() => x.remove(), 3600);
    }
  }
  function stage(name) {
    if (!cer) return;
    cer.stage = name;
    const mo = (cer.d && cer.d.monopoly) || {};
    const boards = mo.boards || [];
    const box = $('cer');
    box.innerHTML = '';
    const head = (h, sub) => { const x = el('h2', 'mnh-end-h', h); if (sub) x.appendChild(el('small', null, sub)); box.appendChild(x); };
    const row = (b, opts) => {
      const r = el('div', 'mnh-cer-row');
      (b.rows || []).slice().sort((a, c) => a.c - c.c).forEach((x) => {
        const win = opts.winners && opts.winners.includes(x.k);
        const k = el('div', 'mnh-cer-k' + (opts.result ? (win ? ' win' : ' lose') : ''));
        if (opts.bonus && opts.bonus.includes(x.k)) { const bb = el('div', 'mnh-cer-bonus'); bb.appendChild(B.star()); k.appendChild(bb); }
        k.appendChild(B.figure({ skin: x.skin, c: x.c, name: x.name, pose: opts.result ? (win ? 'ok' : 'no') : (opts.bonus && opts.bonus.includes(x.k) ? 'ok' : 'idle'), tag: true }));
        const tot = el('div', 'mnh-cer-tot');
        const upTo = opts.upTo != null ? opts.upTo : (opts.useTotal ? 99 : 0);
        tot.append(B.star(), document.createTextNode(String(x.stars + (b.bonus || []).slice(0, upTo).filter((s) => (s.winners || []).includes(x.k)).length)));
        // the coins too once the board is decided: a tie on stars goes to more coins, the class sees why
        if (opts.useTotal) { const c = el('span', 'mnh-cer-coins'); c.append(B.coin(), String(x.coins)); tot.appendChild(c); }
        k.appendChild(tot);
        r.appendChild(k);
      });
      return r;
    };
    if (name === 'bonus-intro') {
      head('¡Estrellas bonus!', 'Tres estrellas más en cada tablero… ¡pueden cambiar quién gana!');
      box.appendChild(cerGrid(boards, (bx, b) => bx.appendChild(row(b, {}))));
      sfx('drum', 0.7);
      return;
    }
    if (/^bonus\d+$/.test(name)) {
      const i = Number(name.slice(5));
      const ex = boards.map((b) => (b.bonus || [])[i]).find(Boolean);
      const sh = el('div', 'mnh-cer-star');
      sh.appendChild(B.star());
      const tt = el('div');
      tt.append(el('b', null, ex ? ex.name : 'Estrella bonus'), el('span', null, ex ? 'para ' + ex.what : ''));
      sh.appendChild(tt);
      box.appendChild(sh);
      box.appendChild(cerGrid(boards, (bx, b) => {
        const st = (b.bonus || [])[i];
        bx.appendChild(row(b, { bonus: st ? st.winners : [], upTo: i + 1 }));
        if (!st) bx.appendChild(el('p', 'mnh-hint', 'Nadie la ganó en este tablero'));
      }));
      sfx('star', 0.6);
      return;
    }
    if (name === 'drum') {
      head('¿Quién gana cada tablero?', 'Más estrellas gana. Si empatan: más monedas');
      box.appendChild(cerGrid(boards, (bx, b) => bx.appendChild(row(b, { useTotal: true }))));
      sfx('drum', 0.8);
      return;
    }
    if (name === 'winners') {
      head('¡Los ganadores!');
      box.appendChild(cerGrid(boards, (bx, b) => {
        bx.appendChild(row(b, { result: true, winners: b.winners || [], useTotal: true }));
        const conf = el('div', 'mnf-conf');
        bx.appendChild(conf);
        const w = (b.rows || []).find((x) => (b.winners || []).includes(x.k));
        if (w) confetti(conf, w.c, 18);
      }));
      sfx('win', 0.9);
      later(800, () => sfx('aww', 0.35));
      return;
    }
    if (name === 'podium') {
      clearTimers();
      head('¡El podio de la clase!', 'Las estrellas de todos los tableros');
      const pod = el('div', 'mnh-podium');
      const top = (mo.podium || []).slice(0, 3);
      const order = top.length >= 3 ? [top[1], top[0], top[2]] : top.length === 2 ? [top[1], top[0]] : top;
      order.forEach((x) => {
        if (!x) return;
        const rk = top.indexOf(x) + 1;
        const p = el('div', 'mnh-pod p' + rk);
        p.appendChild(B.figure({ skin: x.skin, c: x.c, name: x.name, pose: 'ok', tag: true }));
        const step = el('div', 'mnh-pod-step');
        step.appendChild(el('b', null, rk + 'º'));
        const v = el('span'); v.append(B.star(), document.createTextNode(String(x.total) + ' · ' + fmt(x.coins)), B.coin());
        step.appendChild(v);
        p.appendChild(step);
        pod.appendChild(p);
      });
      if (!top.length) pod.appendChild(el('p', 'mnh-hint', '¡La próxima ronda será épica!'));
      box.appendChild(pod);
      const conf = el('div', 'mnf-conf');
      box.appendChild(conf);
      if (top[0]) confetti(conf, top[0].c, 40);
      $('cer-skip').classList.add('hidden');
      $('endtools').classList.remove('hidden');
    }
  }

  window.MonoHost = {
    frame: () => ({ pin, phase: g && g.phase, boards: Object.keys(tiles).length, paused, stage: cer && cer.stage,
      seats: Object.values(tiles).reduce((a, t) => a + Object.keys(t.seats).length, 0) }),
    freeze: (v) => { frozen = !!v; if (!frozen) { const q = queue; queue = []; q.forEach(([fn, d]) => fn(d)); } return queue.length; },
    replay: (ev) => { while (queue.length) { const [fn, d, e] = queue.shift(); fn(d); if (e === ev) break; } return queue.length; },
    queued: () => queue.map((x) => x[2]),
    hold: (v) => { testHold = !!v; },
    stage: (name) => { if (cer) { clearTimers(); stage(name); } },
    sim: (ev, d) => { if (handlers[ev]) handlers[ev](d); },
    band: (kind, title, sub) => band(kind, [bold(title), span(sub || '')], B.star(), 4000),
  };
})();
