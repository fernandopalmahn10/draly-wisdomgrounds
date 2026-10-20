// Ojos de Halcón — the projector (secondary: the phones are the product). Lobby (PIN + QR, the 3 steps, the contestants
// as full-body characters, 10 or 15 rounds) → the countdown in the TV studio (the class runs in) → every board of 4 as a
// mini Mario board (the same board the phones show: windows, stalls, live looks, glow / slump, chips) with the question
// big on top and the class top 5 at the side → «¡FINAL!» → the studio finale: the class winner poses, each board's
// champion cheers. Teacher buttons always work: Pausa (holds every clock), Saltar, +5 rondas, Terminar, Sonido.
// Test hooks: HalconHost.frame(), HalconHost.boards().
(function () {
  'use strict';
  const socket = io();
  const $ = (id) => document.getElementById(id);
  const HB = window.HalconBoard;
  const A = '/assets/halcon/', K = '/assets/kingdoms/';
  const ANSWER_MS = 6000;
  const SFX = {
    tick: K + 'tick.mp3', whoosh: K + 'whoosh.mp3', win: K + 'sting-win.mp3', tap: K + 'tap.mp3',
    round: A + 'round.mp3', pop: A + 'pop.mp3', yes: A + 'yes.mp3', aww: A + 'aww.mp3', first: A + 'first.mp3', final: A + 'final.mp3', start: A + 'start.mp3',
  };
  const MUSIC = { lobby: K + 'music-lobby.mp3', show: A + 'music-show.mp3', final: K + 'music-final.mp3' };
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const skinFor = HB.skinFor;     // the same pick as the server (lobby emoji, old ones included, or from the name)

  let pin = null, state = null, muted = false, rounds = 10, paused = false;
  let game = null;              // { id, round, rounds, phase }
  let boards = {};              // board id → { seats, board: Board, slot, label }
  let q = null, timers = [], lobbyKey = '', seenKids = new Set(), lastTop = [];
  let lobbyStudio = null, countStudio = null, endStudio = null;
  // screenshot runs can freeze the board on a moment: the game's events wait in a queue and replay in order
  let frozen = false, queue = [], testHold = false;
  const onHc = (ev, fn) => socket.on(ev, (d) => { if (frozen) { queue.push([fn, d, ev]); return; } fn(d); });

  // ---------- sound ----------
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
    try { music = new Audio(MUSIC[name]); music.loop = true; music.volume = vol || 0.32; music.play().catch(() => {}); } catch (_) {}
  }
  function stopMusic() { if (music) { try { music.pause(); } catch (_) {} } music = null; musicName = null; }
  function musicFor() {
    if (muted) return;
    if (!$('screen-lobby').classList.contains('hidden')) playMusic('lobby', 0.3);
    else if (!$('screen-active').classList.contains('hidden') && !paused) playMusic('show', 0.28);
    else if (!$('screen-win').classList.contains('hidden')) playMusic('final', 0.3);
  }
  $('mute-btn').addEventListener('click', () => {
    muted = window.toggleMute ? window.toggleMute() : !muted;
    $('mute-btn').textContent = muted ? '🔇 Sin sonido' : '🔊 Sonido';
    if (muted) stopMusic(); else musicFor();
  });
  document.addEventListener('click', () => { if (window.unlockAudio) window.unlockAudio(); musicFor(); }, { once: true });

  const later = (ms, fn) => { const t = setTimeout(fn, Math.max(0, ms)); timers.push(t); return t; };
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function showScreen(name) {
    ['lobby', 'countdown', 'active', 'win'].forEach((n) => $('screen-' + n).classList.toggle('hidden', n !== name));
    document.body.classList.toggle('hc-ended', name === 'win');      // the sound button moves off the finale's name tags
    if (name === 'active') requestAnimationFrame(fitAll);
    musicFor();
  }
  function say(text) { $('host-say').textContent = text; }
  function bigBand(text, kind, ms) {
    const b = $('bigband');
    b.textContent = text;
    b.className = 'hc-bigband' + (kind ? ' ' + kind : '');
    void b.offsetWidth;
    later(ms || 1100, () => b.classList.add('hidden'));
  }

  // ---------- room ----------
  const params = new URLSearchParams(location.search);
  const setId = params.get('setId');
  const LIVE = params.get('livegame') === '1' ? '&livegame=1' : '';
  if (!setId) { location.href = '/packs.html?game=halcon' + LIVE; return; }
  socket.emit('host:create', { gameType: 'halcon' }, ({ pin: p }) => {
    pin = p;
    $('pin-display').textContent = p;
    $('active-pin').textContent = p;
    const url = `${location.origin}/?pin=${p}`;
    $('join-url').textContent = url;
    document.title = `Ojos de Halcón · ${p}`;
    drawQr(url);
    socket.emit('host:hc-rounds', { pin, rounds });
    socket.emit('host:load-set', { pin, setId }, (resp) => {
      if (!resp || !resp.ok) { alert('No se pudo cargar la serie de preguntas.'); location.href = '/packs.html?game=halcon' + LIVE; return; }
      $('set-display').textContent = `📚 ${resp.title} · ${resp.count} preguntas`;
      updateStartBtn();
    });
  });
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
  document.querySelectorAll('.hc-rounds button').forEach((b) => b.addEventListener('click', () => {
    rounds = +b.dataset.r;
    document.querySelectorAll('.hc-rounds button').forEach((x) => x.classList.toggle('on', x === b));
    socket.emit('host:hc-rounds', { pin, rounds });
  }));
  $('start-btn').addEventListener('click', () => { $('start-btn').disabled = true; socket.emit('host:start', { pin }); });
  $('skip-btn').addEventListener('click', () => {
    const b = $('skip-btn');
    if (b.disabled) return;
    b.disabled = true;                       // one skip at a time: a double tap must not jump over the result
    socket.emit('host:hc-skip', { pin });
    setTimeout(() => { b.disabled = false; }, 800);
  });
  $('more-btn').addEventListener('click', () => socket.emit('host:hc-more', { pin }));
  $('less-btn').addEventListener('click', () => socket.emit('host:hc-less', { pin }));
  const endNow = () => { if (confirm('¿Terminar el concurso ahora?')) socket.emit('host:end-now', { pin }); };
  $('end-now-btn').addEventListener('click', endNow);
  $('paused-end-btn').addEventListener('click', endNow);     // the pause card covers the bar: Terminar is there too
  $('pause-btn').addEventListener('click', () => socket.emit('host:pause', { pin, paused: !paused }));
  $('resume-btn').addEventListener('click', () => socket.emit('host:pause', { pin, paused: false }));
  $('play-again-btn').addEventListener('click', () => {
    socket.emit('host:reset', { pin });
    clearTimers();
    game = null; q = null; boards = {}; $('boards').innerHTML = '';
    if (endStudio) { endStudio.destroy(); endStudio = null; }
    lobbyKey = '';
    showScreen('lobby');
  });
  socket.on('host:start-error', (e) => { alert(e && e.message ? e.message : 'No se pudo empezar.'); updateStartBtn(); });
  function updateStartBtn() {
    if (!state) return;
    $('start-btn').disabled = !(state.state === 'lobby' && state.questionsLoaded > 0 && Object.values(state.players || {}).some((p) => !p.off));
  }
  socket.on('state', (s) => {
    state = s;
    if (s.state === 'lobby') { renderLobby(s.players); updateStartBtn(); }
    if (s.state === 'active' && game) {
      const off = {};
      Object.values(s.players || {}).forEach((p) => { off[String(p.name).toLowerCase()] = !!p.off; });
      Object.values(boards).forEach((b) => b.seats.forEach((x) => { const k = String(x.name).toLowerCase(); if (k in off) b.board.setOn(x.id, !off[k]); }));
    }
  });

  // ---------- lobby ----------
  function renderLobby(players) {
    if (!lobbyStudio) {
      lobbyStudio = new HB.Studio($('lobby-studio'), {});
      lobbyStudio.say('¡Bienvenidos! Entren con el PIN 👀');
    }
    const list = Object.values(players || {}).filter((p) => !p.off);
    const key = JSON.stringify(list.map((p) => [p.name, p.avatar]));
    if (key === lobbyKey) return;
    lobbyKey = key;
    const box = $('players-all');
    box.innerHTML = '';
    $('count-all').textContent = list.length === 1 ? '1 jugador' : `${list.length} jugadores`;
    const nb = list.length <= 5 ? 1 : Math.ceil(list.length / 4);
    lobbyStudio.title(list.length ? `${list.length} concursantes` : 'Ojos de', list.length ? (nb === 1 ? '1 tablero' : `${nb} tableros`) : 'Halcón');
    list.forEach((p) => {
      const d = document.createElement('div');
      d.className = 'hc-kid' + (seenKids.has(p.name) ? '' : ' new');
      seenKids.add(p.name);
      const im = document.createElement('img');
      im.src = HB.art(skinFor(p.avatar, p.name), 'idle');
      im.alt = '';
      const n = document.createElement('span');
      n.textContent = p.name;
      d.append(im, n);
      box.appendChild(d);
    });
    if (!list.length) { const e = document.createElement('p'); e.className = 'hc-crew-empty'; e.textContent = 'Esperando a los concursantes: entren con el PIN.'; box.appendChild(e); }
  }

  // ---------- countdown: the studio, the class runs in ----------
  socket.on('countdown', () => {
    clearTimers();
    stopMusic();
    showScreen('countdown');
    const box = $('screen-countdown');
    box.innerHTML = '';
    countStudio = new HB.Studio(box, { big: true });
    const list = Object.values((state && state.players) || {}).filter((p) => !p.off);
    const shown = list.slice(0, 10).map((p, i) => ({ id: -1 - i, name: p.name, skin: skinFor(p.avatar, p.name) }));
    countStudio.intro(shown, null);
    const nb = list.length <= 5 ? 1 : Math.ceil(list.length / 4);
    countStudio.say(nb === 1 ? '¡Un tablero! ¡A sus puestos!' : `¡${nb} tableros de 4! ¡A sus puestos!`);
    sfx('whoosh', 0.7);
    later(2300, () => { if (testHold) return; countStudio.zoom(); sfx('round', 0.6); });
    // the camera lands on the boards (dealt during the countdown) with the video's «Look at the ♥!» band
    later(2820, () => {
      if (testHold || !game || game.phase !== 'countdown') return;
      showScreen('active');
      setQ('¡Mira la respuesta correcta!', null);
      eachBoard((b) => b.bandShow('¡Mira la respuesta correcta!'));
    });
  });

  // ---------- the game ----------
  onHc('hc:init', (d) => {
    game = { id: d.id, round: d.round, rounds: d.rounds, phase: d.phase };
    rounds = d.rounds;
    buildBoards(d.boards);
    paintRound();
    paintTop(d.top || []);
    if (d.phase === 'countdown') return;             // the boards wait behind the studio
    showScreen('active');
    setPaused(!!d.paused);
    if (d.q) {
      q = { round: d.round, text: d.q.text, image: d.q.image, opts: d.q.opts, pics: d.q.pics };
      setQ(d.q.text, d.q.image);
      if (d.q.opts) eachBoard((b) => b.open(d.q.opts, d.q.pics, d.phase === 'answer' && !d.paused ? d.phaseMs : 0, ANSWER_MS));
      requestAnimationFrame(() => {
        (d.ready || []).forEach((sid) => { const b = boardOfSeat(sid); if (b) b.board.ready(sid); });
        countLooks();
        if (d.phase === 'resolve' && d.res) d.res.boards.forEach((rb) => { if (boards[rb.id]) boards[rb.id].board.resolve(d.res.correctPos, rb.rows); });
      });
    } else if (d.phase === 'intro') {
      setQ('¡Mira la respuesta correcta!', null);
    }
  });
  onHc('hc:intro', (d) => {
    game.phase = 'intro';
    showScreen('active');
    setQ('¡Mira la respuesta correcta!', null);
    eachBoard((b) => { b.newRound(); b.dots(0, d.rounds); b.bandShow('¡Mira la respuesta correcta!'); });
    say('¡Miren la ventana con la respuesta correcta… rápido como un halcón!');
    later((d.ms || 1700) - 650, () => { eachBoard((b) => b.bandShow('¡YA!', 'go')); sfx('start', 0.8); });
  });
  onHc('hc:q', (d) => {
    clearTimers();
    game.round = d.round; game.rounds = d.rounds; game.phase = 'question';
    q = { round: d.round, text: d.text, image: d.image };
    setQ(d.text, d.image);
    paintRound();
    const single = Object.keys(boards).length === 1;
    eachBoard((b) => { b.newRound(); b.dots(d.round, d.rounds); if (single) b.bandShow(d.text, 'q'); else b.bandHide(); });
    countLooks();
    sfx('round', 0.5);
    if (d.last) { say('¡Última ronda! ¡La que decide!'); sfx('final', 0.35); } else if (d.round === 1) say('¡Lean la pregunta!');
  });
  onHc('hc:open', (d) => {
    if (!q || d.round !== q.round) return;
    game.phase = 'answer';
    q.opts = d.opts;
    q.pics = d.pics;
    eachBoard((b) => { b.bandHide(); b.open(d.opts, d.pics, d.ms, ANSWER_MS); });
    sfx('pop', 0.55);
    [3000, 2000, 1000].forEach((left) => later(d.ms - left, () => { sfx('tick', 0.5); eachBoard((b) => b.timerEl.classList.add('hurry')); }));
  });
  // a kid has looked: «ready» only (the windows of everybody show at the reveal, like the video)
  onHc('hc:ready', (d) => {
    if (!q || d.round !== q.round || !boards[d.board]) return;
    boards[d.board].board.ready(d.id);
    sfx('tap', 0.2, 60);
    countLooks();
  });
  onHc('hc:closing', (d) => {
    if (!q || d.round !== q.round) return;
    clearTimers();
    eachBoard((b) => b.timer(d.ms, ANSWER_MS));
  });
  onHc('hc:resolve', (d) => {
    if (!q || d.round !== q.round) return;
    clearTimers();
    game.phase = 'resolve';
    let right = 0, fives = [];
    d.boards.forEach((rb) => {
      const b = boards[rb.id];
      if (!b) return;
      b.board.resolve(d.correctPos, rb.rows);
      rb.rows.forEach((r) => { if (r.ok) right++; if (r.pts === 5) fives.push(b.seats.find((x) => x.id === r.id)); });
    });
    sfx('whoosh', 0.5);                                         // the reveal: everybody snaps to their window
    later(HB.REVEAL_MS, () => {                                 // then the verdict
      showAnswer(d.correctText);
      paintTop(d.top || []);
      sfx(right ? 'yes' : 'aww', 0.7);
      const f = fives.filter(Boolean);
      if (f.length === 1) say(`¡${f[0].name} fue el más rápido! +5`);
      else if (f.length > 1) say(`¡+5 para ${f.slice(0, 3).map((x) => x.name).join(', ')}${f.length > 3 ? '…' : ''}!`);
      else say(`Era «${d.correctText}». ¡A la próxima!`);
    });
  });
  onHc('hc:seat', (d) => {
    if (!d.board) return;
    if (!boards[d.board.id]) rebuildKeeping(Object.values(boards).map((b) => ({ id: b.id, seats: b.seats })).concat([d.board]));
    else { boards[d.board.id].seats = d.board.seats; boards[d.board.id].board.setSeats(d.board.seats, null); if (game) boards[d.board.id].board.dots(game.round, game.rounds); }
    if (d.top) paintTop(d.top);
    countLooks();
  });
  onHc('hc:rounds', (d) => {
    if (!game) return;
    game.rounds = d.rounds;
    paintRound();
    eachBoard((b) => b.dots(game.round, game.rounds));
    say(`¡Ahora son ${d.rounds} rondas! 🔁`);
  });
  onHc('hc:finish', () => {
    clearTimers();
    const midRound = game.phase !== 'resolve';
    game.phase = 'final';
    bigBand('¡FINAL!', '', 2200);
    eachBoard((b) => { if (midRound) b.newRound(); b.bandHide(); b.crown(); });
    sfx('final', 0.8);
    say('¡Se acabó! ¿Quién ganó cada tablero?');
  });
  onHc('hc:pause', (d) => {
    setPaused(d.paused);
    if (d.paused) { clearTimers(); eachBoard((b) => b.timerHold()); return; }
    if (d.phase === 'answer') {
      eachBoard((b) => b.timer(d.phaseMs, ANSWER_MS));
      [3000, 2000, 1000].forEach((left) => { if (d.phaseMs > left) later(d.phaseMs - left, () => sfx('tick', 0.5)); });
    }
  });
  function setPaused(v) {
    const was = paused;
    paused = !!v;
    if (paused && !was) say('⏸ Pausa: todos miran al profe.');
    $('paused').classList.toggle('hidden', !paused);
    $('pause-btn').textContent = paused ? '▶ Seguir' : '⏸ Pausa';
    if (paused) stopMusic(); else musicFor();
  }

  // ---------- the boards ----------
  function eachBoard(fn) { Object.values(boards).forEach((b) => fn(b.board)); }
  function boardOfSeat(sid) { return Object.values(boards).find((b) => b.seats.some((x) => x.id === sid)) || null; }
  // a late joiner opened a new board: rebuild the grid but keep the round on every board (its windows, timer, looks)
  function rebuildKeeping(list) {
    const looks = {}, readies = {};
    let left = 0;
    Object.values(boards).forEach((e) => { Object.assign(looks, e.board.looks); Object.assign(readies, e.board.readies); left = Math.max(left, e.board.timeLeft()); });
    buildBoards(list);
    Object.values(boards).forEach((e) => {
      if (game && game.phase === 'answer' && left) e.board.timer(left, ANSWER_MS);
      e.seats.forEach((s) => { if (looks[s.id] != null) e.board.look(s.id, looks[s.id], true); if (readies[s.id]) e.board.ready(s.id); });
    });
    countLooks();
    requestAnimationFrame(fitAll);
  }
  function buildBoards(list) {
    const wrap = $('boards');
    Object.values(boards).forEach((b) => b.board.destroy());
    boards = {};
    wrap.innerHTML = '';
    const n = list.length;
    wrap.className = 'hc-boards ' + (n <= 8 ? 'b' + n : 'bmany');
    // the slots first, so each board can pick its layout from the room it gets (wide = stalls in a row like the video)
    const slots = list.map((b, i) => {
      const slot = document.createElement('div');
      slot.className = 'hc-bslot';
      const label = document.createElement('b');
      label.textContent = n > 1 ? `Tablero ${i + 1}` : 'El tablero';
      const count = document.createElement('i');
      label.appendChild(count);
      const box = document.createElement('div');
      box.className = 'hc-bbox';
      slot.append(label, box);
      wrap.appendChild(slot);
      return { b, box, count };
    });
    slots.forEach(({ b, box, count }) => {
      const entry = { id: b.id, seats: b.seats, box, count, mini: n > 1, board: null, layout: null };
      boards[b.id] = entry;
      makeBoard(entry);
    });
  }
  // each board picks its layout from the room it gets: wide (stalls in a row, like the video) or tall (2×2); a board
  // built while the screen was hidden is rebuilt once the room is real (fitAll), keeping the round on it
  function makeBoard(entry) {
    const r = entry.box.getBoundingClientRect();
    const layout = !r.height || r.width / r.height > 1.45 ? 'wide' : 'tall';
    if (entry.board && entry.layout === layout) return;
    const looks = entry.board ? Object.assign({}, entry.board.looks) : {};
    const readies = entry.board ? Object.assign({}, entry.board.readies) : {};
    const left = entry.board ? entry.board.timeLeft() : 0;
    if (entry.board) entry.board.destroy();
    entry.layout = layout;
    entry.board = new HB.Board(entry.box, { layout, mini: entry.mini });
    entry.board.setSeats(entry.seats, null);
    entry.board.dots(game ? game.round : 0, game ? game.rounds : rounds);
    if (q && q.opts && game && (game.phase === 'answer' || game.phase === 'resolve')) entry.board.open(q.opts, q.pics, game.phase === 'answer' ? left : 0, ANSWER_MS);
    Object.keys(looks).forEach((sid) => entry.board.look(Number(sid), looks[sid], true));
    Object.keys(readies).forEach((sid) => entry.board.ready(Number(sid)));
  }
  function fitAll() {
    Object.values(boards).forEach((e) => { makeBoard(e); e.board.fit(); });
  }
  window.addEventListener('resize', () => { if (!$('screen-active').classList.contains('hidden')) fitAll(); });
  function countLooks() {
    Object.values(boards).forEach((b) => {
      const n = b.board.readyCount();
      b.count.textContent = game && game.phase === 'answer' ? `👀 ${n}/${b.seats.length}` : '';
    });
  }
  function setQ(text, image) {
    $('hq-text').textContent = text || '';
    const im = $('hq-img');
    if (image) { im.src = image; im.classList.remove('hidden'); } else { im.classList.add('hidden'); im.removeAttribute('src'); }
    const old = $('hq').querySelector('.ans');
    if (old) old.remove();
  }
  function showAnswer(text) {
    const old = $('hq').querySelector('.ans');
    if (old) old.remove();
    const s = document.createElement('span');
    s.className = 'ans';
    s.textContent = '✓ ' + text;
    $('hq').appendChild(s);
  }
  function paintRound() {
    if (!game) return;
    $('round-label').textContent = game.round ? `Ronda ${game.round}` : '¡Listos!';
    $('round-of').textContent = `de ${game.rounds}`;
    // «−5 rondas» never takes the round being played nor the next one (server host:hc-less)
    $('less-btn').disabled = game.phase === 'final' || game.rounds <= Math.max((game.round || 0) + 1, 2);
  }
  function paintTop(top) {
    lastTop = top || lastTop;
    const ol = $('top5');
    ol.innerHTML = '';
    lastTop.slice(0, 5).forEach((r) => {
      const li = document.createElement('li');
      const im = document.createElement('img');
      im.src = HB.head(r.skin);
      im.alt = '';
      const n = document.createElement('span');
      n.textContent = r.name;
      const s = document.createElement('b');
      s.textContent = r.score;
      li.append(im, n, s);
      ol.appendChild(li);
    });
  }

  // ---------- the end: the studio finale ----------
  socket.on('game-end', (d) => {
    clearTimers();
    setPaused(false);
    const hc = (d && d.halcon) || {};
    showScreen('win');
    const box = $('end-studio');
    box.innerHTML = '';
    endStudio = new HB.Studio(box, { big: true });
    const top = hc.top || [];
    const winners = top.filter((r) => (hc.winners || []).includes(r.id));
    const champs = (hc.boards || []).map((b, i) => ({ i, b, w: b.rows.filter((r) => b.winners.includes(r.id)) }));
    // one board: exactly the video's ending (the winner poses, the others fall). Several boards: the class winner(s)
    // in front, the other boards' champions cheering at the sides (at most 6 on stage)
    const one = (hc.boards || []).length === 1;
    const stage = one ? hc.boards[0].rows.slice() : winners.slice();
    if (!one) champs.forEach((c) => c.w.forEach((r) => { if (!stage.some((x) => x.id === r.id) && stage.length < 7) stage.push(r); }));
    endStudio.finale(stage.map((r) => ({ id: r.id, name: r.name, skin: r.skin })), winners.map((r) => r.id), null, { rest: one ? 'fall' : 'stand', animated: true });
    const why = hc.why === 'firsts' ? ' (desempate: más +5)' : hc.why === 'speed' ? ' (desempate: miró más rápido)' : '';
    endStudio.say(winners.length > 1 ? '¡Empate en la cima! ¡Qué ojos!' : winners[0] ? `¡${winners[0].name} tiene los ojos de halcón!${why}` : '¡Buen concurso!');
    const list = $('champs');
    list.innerHTML = '';
    champs.forEach(({ i, b, w }) => {
      w.forEach((r) => {
        const row = document.createElement('div');
        row.className = 'hc-champ';
        row.style.setProperty('--i', i);
        const im = document.createElement('img');
        im.src = HB.art(r.skin, 'ok');
        im.alt = '';
        const sp = document.createElement('span');
        sp.textContent = r.name;
        const sm = document.createElement('small');
        sm.textContent = (hc.boards.length > 1 ? `Tablero ${i + 1}` : 'El tablero') + (b.why === 'firsts' ? ' · desempate: más +5' : b.why === 'speed' ? ' · desempate: más rápido' : '');
        sp.appendChild(sm);
        const sc = document.createElement('b');
        sc.textContent = `${r.score} ⭐`;
        row.append(im, sp, sc);
        list.appendChild(row);
      });
    });
    const ol = $('end-top5');
    ol.innerHTML = '';
    top.slice(0, 5).forEach((r) => {
      const li = document.createElement('li');
      const im = document.createElement('img');
      im.src = HB.head(r.skin);
      im.alt = '';
      const n = document.createElement('span');
      n.textContent = `${r.rank}. ${r.name}`;
      const s = document.createElement('b');
      s.textContent = r.score;
      li.append(im, n, s);
      ol.appendChild(li);
    });
    stopMusic();
    sfx('win', 0.9);
    later(2200, () => musicFor());
  });

  window.HalconHost = {
    frame: () => ({ pin, paused, phase: game && game.phase, round: game && game.round, rounds: game && game.rounds, boards: Object.keys(boards).length }),
    boards: () => boards,
    freeze: (v) => {
      frozen = !!v;
      if (!frozen) { const q2 = queue; queue = []; q2.forEach(([fn, d]) => fn(d)); }
      return queue.length;
    },
    replay: (ev) => {
      while (queue.length) { const [fn, d, e] = queue.shift(); fn(d); if (e === ev) break; }
      return queue.length;
    },
    queued: () => queue.map((x) => x[2]),
    hold: (v) => { testHold = !!v; },
    holdReveal: (v) => HB.holdReveal(v),
  };
})();
