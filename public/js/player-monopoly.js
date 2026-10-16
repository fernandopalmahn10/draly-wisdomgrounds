// Dàfùwēng · Monopolio v2 «El Gran Tablero de Dubái» — the kid's phone (the product). player.js calls MonoPhone.init(...)
// once; the shared phone skin (player-kingdoms-skin.js) gives the lobby look, the sounds and the music, and routes the
// lobby card and the end screen here. What this module draws, only while the room's game is 'monopoly':
//   · THE BOARD around my piece (js/monopoly-board.js): my board's players on top (rank, stars, coins; mine «TÚ»), the
//     minimap, rivals hopping in and out of view, the ticker of what they did. It never goes away: no dead phone.
//   · the question as a sheet at the bottom (picture, prompt, four big tiles, 20 s clock with ticks); the server judges
//   · right → «¡Correcto!» → the sheet slides down, the dice block spins over my head, the whole screen is its button
//     (no tap in 3 s: it rolls by itself). The server's number, my piece hops (the camera follows, the steps count down
//     above my head) and every moment of the turn plays with its host from the gang: Salida, the star (the big moment),
//     blue / red, a landmark (buy, toll, level), «¡Suerte!» (Latifa's roulette: chest, swap, duel, advance 3), the storm
//   · wrong → «¡Casi! Era …» with a wait bar on the sheet, the board keeps living above it
//   · the countdown run-in (my board of 4 runs in, Dralingo with the star), the rules card with ONE pictured control,
//     lead / frenzy / time / affects-me banners at the top edge (never over the tiles), the pause card, «¡FINAL!» and the
//     ceremony: the bonus stars of my board one by one, «¿Quién gana tu tablero?», my own card
// Test hooks: MonoPhone.frame(), .hold(v), .freeze(v) / .replay(ev), .stage(name), .sim(ev, d), .runIn(), .rules(ms),
//             .tapDice(), .answer(i).
(function () {
  'use strict';
  const B = () => window.MonoBoard;
  const MAP = window.MonoMap;
  const T = MAP.T;
  const MN = '/assets/monopoly/', K = '/assets/kingdoms/', H = '/assets/halcon/', MO = '/assets/mochi/', SS = '/assets/sixseven/';
  const $ = (id) => document.getElementById(id);
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const skin = () => window.KingdomsSkin;
  const CAST = () => window.DralingoCast;
  const sfx = (path, vol) => { const s = skin(); if (s && s.sfx) s.sfx(path, vol); };
  const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (_) {} };
  const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
  const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('es-ES');
  const coinsWord = (n) => (Math.abs(n) === 1 ? 'moneda' : 'monedas');
  const LM = MAP.LANDMARKS;
  const lmName = (i) => (LM[i] ? LM[i].name : 'el monumento');
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const later = (ms, fn, list) => { const t = setTimeout(fn, Math.max(0, ms)); (list || timers).push(t); return t; };

  let ctx = null, on = false;
  let gen = 0;                   // bumped at every end / teardown: moves still playing from before stop at their next step
  const alive = (n) => n === gen;
  let timers = [], introTimers = [], cerTimers = [];
  let g = null;                  // { id, phase, endAt (perf), paused, pausedLeft, frenzy }
  let board = null, mini = null, boardId = null;
  let seats = {};                // k → { k, name, skin, c, pos, coins, stars, on, seq }
  let meK = null, starPos = MAP.STAR_START, owners = {};
  let roster = [];               // lobby: [{ name, avatar, sk, off }]
  let testHold = false;

  // ---------- who I am ----------
  const myName = () => ($('lobby-name') && $('lobby-name').textContent) || '';
  let mySk = '';
  function mySkin() {
    if (mySk) return mySk;
    let v = '';
    try { v = localStorage.getItem('dralyAvatar') || ''; } catch (_) {}
    const list = (window.Saga && window.Saga.AVATARS) || [];
    if (!list.some((a) => a.emoji === v)) v = (list[0] && list[0].emoji) || '🐉';
    return B() ? B().skinFor(v, myName()) : 'dralingo';
  }
  const seatName = (k) => (seats[k] ? (k === meK ? 'Tú' : seats[k].name) : '');
  const colorOf = (k) => B().colorOf(seats[k] ? seats[k].c : 0);

  // ---------- quick sounds (Web Audio: hops and coins land on time) ----------
  let actx = null, loading = false;
  const bufs = {};
  const BUF = { hop: MN + 'hop.mp3', coin: SS + 'coins.mp3', throw: MN + 'dice-throw.mp3', shake: MN + 'dice-shake.mp3', lose: MN + 'lose.mp3',
    pop: MO + 'pop.mp3', gold: MO + 'gold.mp3', tick: K + 'tick.mp3' };
  function audioReady() {
    if (actx) { if (actx.state === 'suspended') actx.resume().catch(() => {}); return; }
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      actx = new C();
      if (!loading) {
        loading = true;
        Object.entries(BUF).forEach(([k, f]) => {
          fetch(f).then((r) => r.arrayBuffer()).then((b) => actx.decodeAudioData(b)).then((buf) => { bufs[k] = buf; }).catch(() => {});
        });
      }
    } catch (_) {}
  }
  const muted = () => { const s = skin(); return !!(s && s.isMuted && s.isMuted()); };
  function play(name, rate, vol) {
    if (muted() || !actx || !bufs[name]) return;
    try {
      const src = actx.createBufferSource();
      src.buffer = bufs[name];
      src.playbackRate.value = rate || 1;
      const gn = actx.createGain();
      gn.gain.value = vol == null ? 0.7 : vol;
      src.connect(gn).connect(actx.destination);
      src.start();
    } catch (_) {}
  }

  // ---------- on / off ----------
  function boardUp(v) { document.body.classList.toggle('mnx-play', !!v && on); if (v) ctx.showScreen('monopoly'); }
  function setOn(v) {
    if (v === on) return;
    on = v;
    document.body.classList.toggle('mnx-on', on);
    if (!on) teardown(true);
  }
  function clearTimers(list) { (list || timers).forEach(clearTimeout); if (list) list.length = 0; else timers = []; }
  function hideOverlays() {
    ['mnx-big'].forEach((id) => { const x = $(id); if (x) x.classList.add('hidden'); });
    const b = $('mnx-banner'); if (b) b.classList.remove('show');
    const c = $('mnx-card'); if (c) c.classList.remove('show');
    const t = $('mnx-tick'); if (t) t.classList.remove('show');
    bannerQ = []; bannerOn = false;
  }
  function teardown(all) {
    gen++;
    hideOverlays();
    clearTimers();
    clearTimers(introTimers);
    stopQTimer();
    closeDice();
    cur = null; pendingQ = null; playing = null;
    hideIntro();
    pauseUI(false);
    clearInterval(clockT);
    const fin = $('mnx-final');
    if (fin) fin.classList.add('hidden');
    const big = $('mnx-big');
    if (big) big.classList.add('hidden');
    document.body.classList.remove('mnx-ended', 'mnx-play');
    if (all) {
      clearTimers(cerTimers);
      const f = $('mnx-finale');
      if (f) f.remove();
      if (board) { board.destroy(); board = null; }
      if (mini && mini.root) mini.root.remove();
      mini = null; boardId = null; seats = {}; meK = null; owners = {};
    }
  }

  // ---------- the board, the plates, the minimap ----------
  function ensureBoard(view, me) {
    if (!B() || !$('mnx-view')) return;
    if (!board || boardId !== view.id) {
      if (board) board.destroy();
      $('mnx-view').innerHTML = '';
      board = new (B().Board)($('mnx-view'), { mode: 'phone', me, tags: true });
      boardId = view.id;
      const mm = $('mnx-mini');
      mm.innerHTML = '';
      mini = new (B().Minimap)(mm);
      seats = {};
    }
    meK = me;
    applyView(view);
  }
  let viewSeq = 0;
  // after a move: every seat it touched stands where the server says (a swap queued behind a later move, a reconnect)
  function settleSeats(list) { (list || []).forEach((x) => { if (seats[x.k] && board) board.settle(x.k, x.pos); }); }
  function applyView(view) {
    if (!view) return;
    viewSeq = view.seq || 0;
    (view.seats || []).forEach((s) => { seats[s.k] = Object.assign(seats[s.k] || {}, s, { seq: view.seq || 0 }); });
    owners = Object.assign({}, view.owners || {});
    starPos = view.star;
    board.setSeats(Object.values(seats));
    board.setOwners(owners);
    board.setStar(starPos, false);
    paintHud();
    paintMini();
    aim(0);
  }
  // a snapshot of some seats ({ k: [pos, coins, stars] }) from a move of sequence `seq` (an older move never overwrites)
  function snap(map, seq, opts) {
    let changed = false;
    Object.entries(map || {}).forEach(([k, v]) => {
      const s = seats[k];
      if (!s || (s.seq || 0) > seq) return;
      const before = s.coins, beforeStars = s.stars;
      s.seq = seq;
      s.coins = v[1];
      s.stars = v[2];
      if (!(opts && opts.keepPos)) s.pos = v[0];
      if (before !== s.coins || beforeStars !== s.stars) { changed = true; bumpPlate(Number(k)); }
    });
    if (changed) paintHud();
  }
  function rankOf() {
    const list = Object.values(seats).slice().sort((a, b) => b.stars - a.stars || b.coins - a.coins || a.c - b.c);
    const rank = {};
    list.forEach((s, i) => { rank[s.k] = i > 0 && list[i - 1].stars === s.stars && list[i - 1].coins === s.coins ? rank[list[i - 1].k] : i + 1; });
    return rank;
  }
  let plates = {};
  function paintHud() {
    const hud = $('mnx-hud');
    if (!hud || !B()) return;
    const list = Object.values(seats).sort((a, b) => a.c - b.c);
    hud.style.setProperty('--n', String(Math.max(1, list.length)));
    const key = list.map((s) => s.k + ':' + s.c).join(',');
    if (hud._key !== key) {
      hud._key = key;
      hud.innerHTML = '';
      plates = {};
      list.forEach((s) => {
        const col = B().colorOf(s.c);
        const p = el('div', 'mnx-pl' + (s.k === meK ? ' me' : ''));
        p.style.setProperty('--pc', col.c);
        const fig = el('div', 'mnx-pl-fig');
        const im = el('img');
        im.alt = '';
        im.src = B().art(s.skin, 'idle');
        fig.appendChild(im);
        const name = el('div', 'mnx-pl-name');
        if (s.k === meK) name.appendChild(el('em', null, 'TÚ'));
        name.appendChild(document.createTextNode(s.k === meK ? '' : s.name));
        const nums = el('div', 'mnx-pl-nums');
        const st = el('span'); st.append(B().star(), el('b', 'n-st', '0'));
        const co = el('span'); co.append(B().coin(), el('b', 'n-co', '0'));
        nums.append(st, co);
        const rk = el('div', 'mnx-pl-rank', '');
        p.append(fig, name, nums, rk);
        p.setAttribute('aria-label', (s.k === meK ? 'Tú' : s.name));
        hud.appendChild(p);
        plates[s.k] = p;
      });
    }
    const rank = rankOf();
    list.forEach((s) => {
      const p = plates[s.k];
      if (!p) return;
      p.querySelector('.n-st').textContent = fmt(s.stars);
      p.querySelector('.n-co').textContent = fmt(s.coins);
      const r = p.querySelector('.mnx-pl-rank');
      r.textContent = rank[s.k] + 'º';
      r.classList.toggle('first', rank[s.k] === 1 && list.length > 1);
      p.classList.toggle('off', s.on === false);
    });
  }
  function bumpPlate(k) {
    const p = plates[k];
    if (!p || reduced()) return;
    p.classList.remove('bump');
    void p.offsetWidth;
    p.classList.add('bump');
  }
  function paintMini() { if (mini) mini.set(Object.values(seats), starPos, meK); }
  // where the camera aims: the middle of what the sheet / the card leave visible
  function aim(ms) {
    if (!board) return;
    const hud = $('mnx-hud'), q = $('mnq');
    const hb = hud ? hud.getBoundingClientRect().bottom : 70;
    const H = window.innerHeight;
    const sheetUp = q && !q.classList.contains('down') && !$('screen-monopoly').classList.contains('hidden');
    const bottom = sheetUp ? H - q.offsetHeight : H;    // (the sheet's resting place: it may still be sliding)
    const top = hb + 40;
    board.view(Math.round(top + (bottom - top) * (sheetUp ? 0.62 : 0.6)), ms, hb, bottom);
  }
  // the screen position over my piece's head (the dice, the steps): from the camera's target, so it is right even while
  // the camera still slides there
  function overHead(node) {
    const h = board && meK != null ? board.headXY(meK) : null;
    node.style.left = (h ? Math.round(h.x) : window.innerWidth / 2) + 'px';
    node.style.top = (h ? Math.round(h.y) : window.innerHeight * 0.4) + 'px';
  }

  // ---------- coins flying to / from a plate ----------
  function flyCoins(from, toK, n, out) {
    if (reduced() || !n) return;
    const plate = plates[toK];
    if (!plate || !from) return;
    const pr = plate.getBoundingClientRect();
    const to = { x: pr.left + pr.width * 0.72, y: pr.top + pr.height * 0.7 };
    const a = out ? to : from, b = out ? from : to;
    const layer = $('mnx-fx');
    const count = Math.max(1, Math.min(6, Math.abs(n)));
    for (let i = 0; i < count; i++) {
      const c = el('div', 'mn-flycoin');
      c.appendChild(B().coin());
      layer.appendChild(c);
      const dx = (Math.random() - 0.5) * 50;
      const an = c.animate([
        { transform: `translate(${a.x - 13}px,${a.y - 13}px) scale(.7)`, opacity: 1 },
        { transform: `translate(${(a.x + b.x) / 2 + dx - 13}px,${Math.min(a.y, b.y) - 70}px) scale(1.1)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${b.x - 13}px,${b.y - 13}px) scale(.6)`, opacity: 0.9 },
      ], { duration: 560, delay: i * 60, easing: 'cubic-bezier(.33,0,.67,1)', fill: 'both' });
      an.onfinish = () => c.remove();
      if (i === 0) setTimeout(() => play(out ? 'lose' : 'coin', 1, 0.5), 560);
    }
  }
  const pieceAt = (k) => (board ? board.pieceXY(k) : null);

  // ---------- the clock ----------
  let clockT = null;
  function runClock() {
    clearInterval(clockT);
    const c = $('mnx-clock');
    if (!c) return;
    const paint = () => {
      if (!g || !g.endAt) { c.querySelector('b').textContent = '–:––'; return; }
      const left = g.paused ? g.pausedLeft : Math.max(0, g.endAt - performance.now());
      const s = Math.max(0, Math.ceil(left / 1000));
      c.querySelector('b').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      c.classList.toggle('x2', !!g.frenzy);
      c.classList.toggle('last', g.phase === 'play' && s <= 10);
    };
    paint();
    clockT = setInterval(paint, 250);
  }

  // ---------- the question sheet ----------
  let cur = null, pendingQ = null, qT = null, rescueT = null, lastTick = 0, helped = 0;
  function sheet(up) {
    const q = $('mnq');
    if (!q) return;
    q.classList.toggle('down', !up);
    q.setAttribute('aria-hidden', up ? 'false' : 'true');
    aim(380);
  }
  function showQuestion(q) {
    if (!on || !q) return;
    if (playing) { pendingQ = q; return; }   // my move finishes first (≤ about a second)
    if (dice) closeDice();                  // (the server deals only after a turn: a lost script must not hold the phone)
    boardUp(true);
    hideIntro();
    hideCard();
    if (cur && cur.qid === q.qid) {                     // the same question again (a resync / a rejoin)
      if (cur.tapped && !cur.done) { cur.tapped = false; setTiles(!(g && g.paused)); document.querySelectorAll('.mnq-a').forEach((b) => b.classList.remove('picked')); runQTimer(); }
      sheet(true);
      return;
    }
    cur = { qid: q.qid, t0: performance.now(), ms: 20000, tapped: false, done: false, heldAt: 0, heldSum: 0, answers: q.answers || [] };
    const box = $('mnq');
    box.classList.toggle('nopic', !q.image);
    const img = $('mnq-img');
    if (q.image) { img.src = q.image; img.alt = ''; }
    else img.removeAttribute('src');
    $('mnq-text').textContent = q.text || '';
    const v = $('mnq-verdict');
    v.className = 'mnq-verdict';
    v.textContent = '';
    const ans = $('mnq-ans');
    ans.innerHTML = '';
    const SH = ['▲', '◆', '●', '■'];
    (q.answers || []).forEach((a, i) => {
      const b = el('button', 'mnq-a s' + (i % 4) + (a.length > 34 ? ' xlong' : a.length > 16 ? ' long' : ''));
      b.type = 'button';
      const sh = el('span', 'mnq-sh', SH[i % 4]);
      sh.setAttribute('aria-hidden', 'true');
      b.appendChild(sh);
      b.appendChild(el('span', null, a));
      let pressAt = -1e9;
      b.addEventListener('pointerdown', (e) => {
        pressAt = performance.now();
        if (e.pointerType && e.pointerType !== 'mouse' && e.cancelable) e.preventDefault();
        answer(i);
      });
      b.addEventListener('click', () => { if (performance.now() - pressAt < 2500) return; answer(i); });
      ans.appendChild(b);
    });
    sheet(true);
    runQTimer(true);
    if (g && g.paused) { holdQ(true); setTiles(false); }
    sfx(K + 'whoosh.mp3', 0.3);
    ctx.markActivity();
  }
  function setTiles(v) { document.querySelectorAll('.mnq-a').forEach((b) => { b.disabled = !v; }); }
  const qLeft = () => (cur ? Math.max(0, cur.ms - ((cur.heldAt || performance.now()) - cur.t0 - cur.heldSum)) : 0);
  function runQTimer(fresh) {
    stopQTimer();
    if (!cur) return;
    const bar = $('mnq-bar');
    const left = qLeft();
    bar.style.transition = 'none';
    bar.style.transform = `scaleX(${(left / cur.ms).toFixed(3)})`;
    if (fresh) bar.parentNode.classList.remove('hurry');
    if (cur.heldAt || (g && g.paused)) return;
    void bar.offsetWidth;
    bar.style.transition = `transform ${left}ms linear`;
    bar.style.transform = 'scaleX(0)';
    lastTick = 99;
    qT = setInterval(() => {
      if (!cur || cur.tapped || cur.done || cur.heldAt) return;
      const l = qLeft();
      const s = Math.ceil(l / 1000);
      if (s <= 5 && s > 0 && s !== lastTick) { lastTick = s; bar.parentNode.classList.add('hurry'); play('tick', 1, 0.4); }
      if (l <= 0) {
        stopQTimer();
        if (cur.tapped) return;
        cur.tapped = true;
        setTiles(false);
        ctx.socket.emit('player:answer', { pin: ctx.getPin(), qid: cur.qid, choiceIdx: -1 }, () => {});   // time up = wrong
      }
    }, 200);
  }
  function stopQTimer() {
    clearInterval(qT);
    qT = null;
    const bar = $('mnq-bar');
    if (bar && cur) { bar.style.transition = 'none'; bar.style.transform = `scaleX(${(qLeft() / cur.ms).toFixed(3)})`; }
  }
  function holdQ(v) {
    if (!cur) return;
    if (v && !cur.heldAt) { cur.heldAt = performance.now(); stopQTimer(); }
    else if (!v && cur.heldAt) { cur.heldSum += performance.now() - cur.heldAt; cur.heldAt = 0; if (!cur.tapped && !cur.done) runQTimer(); }
  }
  function answer(i) {
    audioReady();
    if (!cur || cur.tapped || cur.done || !g || g.phase !== 'play' || g.paused) return;
    cur.tapped = true;
    const btn = document.querySelectorAll('.mnq-a')[i];
    if (btn) btn.classList.add('picked');
    setTiles(false);
    play('pop', 1, 0.5);
    buzz(10);
    stopQTimer();
    const qid = cur.qid;
    ctx.socket.emit('player:answer', { pin: ctx.getPin(), qid, choiceIdx: i }, () => {});
    clearTimeout(rescueT);
    // no verdict in 3 s (a Wi-Fi blip): the tiles come back (the server answers a second tap or deals a new question)
    rescueT = setTimeout(() => {
      if (!(cur && cur.qid === qid && cur.tapped && !cur.done)) return;
      cur.tapped = false;
      if (btn) btn.classList.remove('picked');
      if (g && g.paused) return;
      setTiles(true);
      runQTimer();
    }, 3000);
    ctx.markActivity();
  }
  function verdict(cls, head, sub, waitMs) {
    const v = $('mnq-verdict');
    v.className = 'mnq-verdict ' + cls;
    v.textContent = '';
    v.appendChild(el('b', null, head));
    if (sub) v.appendChild(el('small', null, sub));
    if (waitMs) {
      const w = el('span', 'wait');
      const i = el('i');
      w.appendChild(i);
      v.appendChild(w);
      i.style.transform = 'scaleX(1)';
      requestAnimationFrame(() => { i.style.transition = `transform ${Math.max(200, waitMs - 150)}ms linear`; i.style.transform = 'scaleX(0)'; });
    }
    void v.offsetWidth;
    v.classList.add('show');
  }
  function onResult(r) {
    const mo = r.monopoly;
    clearTimeout(rescueT);
    stopQTimer();
    if (cur) { cur.done = true; cur.tapped = true; }
    setTiles(false);
    // the right answer glows (when it is one of the tiles)
    const tiles = document.querySelectorAll('.mnq-a');
    tiles.forEach((b) => {
      const txt = b.lastChild && b.lastChild.textContent;
      if (txt === r.correctText) b.classList.add('right');
      else if (b.classList.contains('picked')) b.classList.add('wrong');
      else b.classList.add('dim');
    });
    if (mo.right) {
      verdict('ok', mo.dice === 2 ? '¡Correcto! ¡Dado doble!' : '¡Correcto!', mo.streak >= 2 ? `Racha ${mo.streak}` : '');
      play('gold', 1.1, 0.5);
      buzz([20, 30, 20]);
      openDice(mo);
    } else {
      const head = mo.tooFast ? '¡Muy rápido!' : mo.timeUp ? '¡Se acabó el tiempo!' : '¡Casi!';
      const sub = (mo.calm ? '¡Respira! Lee y piensa · ' : mo.tooFast ? 'Primero lee · ' : '') + (r.correctText ? 'Era: ' + r.correctText : '');
      verdict('no', head, sub, mo.wait);
      sfx(SS + 'wrong.mp3', 0.5);
      buzz([40, 30, 40]);
      if (board && meK != null) { board.pose(meK, 'no'); later(1100, () => board && board.pose(meK, 'idle')); }
    }
    ctx.markActivity();
  }

  // ---------- the dice block ----------
  let dice = null;               // { tid, n, until, tapped, done, spinT, box, faces }
  function openDice(mo) {
    closeDice();
    const now = performance.now();
    dice = { tid: mo.tid, n: mo.dice || 1, until: now + (mo.lead || T.show) + (mo.ms || 3000), tapped: false, done: false, spinT: null, faces: [], heldAt: 0 };
    const d0 = dice;
    later(mo.lead || 800, () => {
      if (dice !== d0 || d0.done) return;
      sheet(false);
      hideCard();
      const stage = $('mnx-stage');
      const box = el('div', 'mnx-dicebox');
      for (let i = 0; i < d0.n; i++) {
        const d = B().dice('spin' + (d0.n === 2 ? ' gold' : ''));
        d0.faces.push(d);
        box.appendChild(d);
      }
      d0.box = box;
      stage.appendChild(box);
      later(400, () => { if (d0.box) overHead(d0.box); });
      overHead(box);
      // the numbers spin until the tap
      d0.spinT = setInterval(() => d0.faces.forEach((d) => { d._face.textContent = String(1 + Math.floor(Math.random() * 6)); }), 90);
      $('mnx-tap').classList.add('on');
      prompt(true, d0.n === 2 ? '¡Toca y tira los 2 dados!' : '¡Toca para tirar el dado!', helped < 2);
      play('shake', 1, 0.45);
      ctx.markActivity();
      if (g && g.paused) holdDice(true);
      // nobody tapped: the dice roll by themselves (the server's tick decides; the same dice)
      d0.autoT = later(Math.max(0, d0.until - performance.now()), () => autoPrompt(d0));
    });
  }
  function holdDice(v) {
    if (!dice || dice.done) return;
    if (v && !dice.heldAt) { dice.heldAt = performance.now(); clearTimeout(dice.autoT); }
    else if (!v && dice.heldAt) {
      dice.until += performance.now() - dice.heldAt;
      dice.heldAt = 0;
      const d0 = dice;
      d0.autoT = later(Math.max(0, d0.until - performance.now()), () => autoPrompt(d0));
    }
  }
  // nobody tapped: «¡El dado se tira solo!» (the server rolls); 1.5 s later the phone asks for that turn (the server sends
  // the same turn again if it already rolled: a script lost on the way never leaves the kid waiting)
  function autoPrompt(d0) {
    if (dice !== d0 || d0.tapped || d0.done) return;
    prompt(true, '¡El dado se tira solo!', false);
    d0.rescue = setInterval(() => { if (dice === d0 && !d0.done) ctx.socket.emit('player:mn-roll', { pin: ctx.getPin(), tid: d0.tid }); else clearInterval(d0.rescue); }, 1500);
  }
  function tapDice() {
    audioReady();
    if (!dice || dice.tapped || dice.done || !dice.box || (g && g.paused)) return;
    dice.tapped = true;
    helped++;
    const tid = dice.tid;
    ctx.socket.emit('player:mn-roll', { pin: ctx.getPin(), tid });
    dice.faces.forEach((d) => {
      d.classList.remove('spin');
      d.classList.add('hit');
      if (!reduced() && d.animate) d.animate([{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-28px) scale(1.12)' }, { transform: 'translateY(0) scale(1)' }], { duration: 300, easing: 'cubic-bezier(.3,1.55,.5,1)' });
    });
    play('throw', 1, 0.7);
    buzz(25);
    prompt(false);
    $('mnx-tap').classList.remove('on');
    const d0 = dice;
    // no script in 2.5 s: ask again (the server sends the same turn again, never a second one)
    d0.rescue = setInterval(() => { if (dice === d0 && !d0.done) ctx.socket.emit('player:mn-roll', { pin: ctx.getPin(), tid }); else clearInterval(d0.rescue); }, 2500);
    ctx.markActivity();
  }
  function closeDice(s) {
    if (!dice) return;
    clearInterval(dice.spinT);
    clearInterval(dice.rescue);
    clearTimeout(dice.autoT);
    dice.done = true;
    if (s && dice.box) {
      dice.faces.forEach((d, i) => { d.classList.remove('spin'); d.classList.add('hit'); d._face.textContent = String(s.dice[i] || ''); });
    }
    const box = dice.box;
    if (box) setTimeout(() => box.remove(), s ? T.show : 0);
    $('mnx-tap').classList.remove('on');
    prompt(false);
    dice = null;
  }
  function prompt(v, text, hand) {
    const p = $('mnx-prompt');
    if (!p) return;
    p.classList.toggle('on', !!v);
    if (!v) return;
    p.innerHTML = '';
    if (hand && !reduced()) p.appendChild(el('i', 'mn-hand'));
    p.appendChild(el('span', null, text));
  }

  // ---------- my turn: the script ----------
  let playing = null;
  function group(ev) { const out = {}; (ev || []).forEach((e) => { (out[e.at] = out[e.at] || []).push(e); }); return out; }
  // my turn played back; whatever happens inside, the phone is never left holding the next question (finally)
  async function playScript(s) {
    if (!on || !board || s.k !== meK) return;
    if (playing && playing.tid === s.tid) return;
    if (s.b !== boardId) return;
    const mine = { tid: s.tid };
    try { await playTurn(s, mine); } catch (e) { console.warn('[monopoly] turn', e); }
    finally {
      if (playing === mine || (playing && playing.tid === s.tid)) playing = null;
      document.querySelectorAll('.mnx-steps').forEach((x) => x.remove());
      if (pendingQ && !playing) { const q = pendingQ; pendingQ = null; showQuestion(q); }
    }
  }
  async function playTurn(s, mine) {
    const n = gen;
    const wasDice = dice && dice.tid === s.tid;
    if (wasDice) closeDice(s);
    else if (dice) closeDice();
    playing = mine;
    sheet(false);
    hideCard();
    const total = s.dice.reduce((a, d) => a + d, 0);
    if (!wasDice) {
      // a turn rolled by itself (or after a reload): show the dice first
      const box = el('div', 'mnx-dicebox');
      s.dice.forEach((n) => { const d = B().dice('hit'); d._face.textContent = String(n); box.appendChild(d); });
      overHead(box);
      $('mnx-stage').appendChild(box);
      setTimeout(() => box.remove(), T.show);
      play('throw', 1, 0.6);
    }
    await sleep(T.show);
    if (!alive(n)) return;
    ctx.markActivity();
    const steps = el('div', 'mnx-steps', String(total));
    overHead(steps);
    $('mnx-stage').appendChild(steps);
    let left = total + ((s.ev || []).some((e) => e.out === 'ahead') ? 3 : 0);
    steps.textContent = String(left);
    const at = group(s.ev);
    let hopN = 0;
    await board.hop(meK, s.path, {
      gate: async (i) => { if (i > 0 && alive(n)) for (const e of (at[i] || [])) await moment(e, s, n); },
      onStep: () => {
        left = Math.max(0, left - 1);
        steps.textContent = left ? String(left) : '';
        steps.classList.remove('tick'); void steps.offsetWidth; steps.classList.add('tick');
        steps.style.visibility = left ? '' : 'hidden';
        overHead(steps);
        play('hop', 0.9 + Math.min(12, hopN++) * 0.04, 0.45);
        ctx.markActivity();
      },
      end: async () => { steps.remove(); if (alive(n)) for (const e of (at[s.path.length] || [])) await moment(e, s, n); },
    });
    steps.remove();
    if (!alive(n)) return;
    snap(Object.fromEntries((s.seats || []).map((x) => [x.k, [x.pos, x.coins, x.stars]])), s.seq);
    settleSeats(s.seats);
    paintMini();
    await sleep(T.end);
    hideCard();
    ctx.markActivity();
  }
  function host(id) { return CAST() ? CAST().pose(id, 'cheer') : ''; }
  const line = (id) => (CAST() ? CAST().line(id, 'tablero') : '');
  // one moment of MY turn (on my own board), timed like the server (MAP.evMs)
  async function moment(e, s, n) {
    if (!alive(n)) return;
    const ms = MAP.evMs(e);
    const me = meK;
    const t0 = performance.now();
    const p = board.posOf(me);
    const fromMe = pieceAt(me);
    ctx.markActivity();
    switch (e.type) {
      case 'pass':
        board.pop(0, '+' + e.coins, 'gain');
        flyCoins(fromMe, me, e.coins);
        card({ host: 'adrian', title: '¡Otra vuelta!', sub: line('adrian'), val: '+' + e.coins, cls: 'gain', gold: e.lucky });
        break;
      case 'star':
        bigStar(e);
        break;
      case 'nostar':
        card({ img: B().DRALINGO, title: `¡Te faltan ${e.need} ${coinsWord(e.need)} para la estrella!`, sub: 'Dralingo: «Junta 10 monedas y vuelve»' });
        break;
      case 'blue':
        board.pop(p, '+' + e.coins, 'gain');
        board.flash(p, 'flash-gold');
        flyCoins(fromMe, me, e.coins);
        if (e.lucky) card({ img: B().DRALINGO, title: '¡Monedas de la suerte!', sub: 'Vas último: la suerte te ayuda', val: '+' + e.coins, cls: 'gain', gold: true });
        break;
      case 'red':
        board.pop(p, e.coins ? String(e.coins) : '0', 'loss');
        board.flash(p, 'flash-red');
        if (e.coins) flyCoins(fromMe, me, e.coins, true);
        if (board) { board.pose(me, 'no'); later(900, () => board && board.pose(me, 'idle')); }
        break;
      case 'buy':
        board.own(e.lm, { k: me, lvl: 1 });
        owners[e.lm] = { k: me, lvl: 1 };
        card({ host: 'hamdan', lm: e.lm, title: `¡${lmName(e.lm)} es tuyo!`, sub: `Hamdan: «${line('hamdan')}» Quien caiga aquí te paga`, val: '−' + e.price, cls: 'loss', gold: true });
        flyCoins(fromMe, me, e.price, true);
        sfx(K + 'landmark.mp3', 0.7);
        buzz([30, 30, 60]);
        board.pose(me, 'ok');
        later(1400, () => board && board.pose(me, 'idle'));
        break;
      case 'broke':
        card({ host: 'hamdan', lm: e.lm, title: `Te faltan ${e.need} ${coinsWord(e.need)} para ${lmName(e.lm)}`, sub: 'Junta monedas y vuelve' });
        break;
      case 'toll': {
        const to = e.to;
        card({ lm: e.lm, title: `Peaje para ${seatName(to)}`, sub: `${lmName(e.lm)} es de ${seatName(to)}`, val: '−' + e.coins, cls: 'loss', bad: true });
        if (e.coins) { flyCoins(fromMe, me, e.coins, true); later(300, () => flyCoins(fromMe, to, e.coins)); }
        break;
      }
      case 'level':
        owners[e.lm] = { k: me, lvl: e.lvl };
        board.own(e.lm, { k: me, lvl: e.lvl });
        card({ host: 'hamdan', lm: e.lm, title: e.max ? `${lmName(e.lm)}: ¡nivel máximo!` : `¡${lmName(e.lm)} sube a nivel ${e.lvl}!`, sub: 'Ahora el peaje es más alto', val: '★'.repeat(e.lvl), gold: true });
        sfx(MN + 'level.mp3', 0.7);
        break;
      case 'lucky':
        await lucky(e, s);
        break;
      case 'storm':
        stormMoment(e, s.k);
        break;
      default: break;
    }
    // the numbers of this moment (mine, and a rival's for a toll / swap / duel / storm), then the rest of its time
    const half = e.type === 'lucky' ? 0 : Math.min(500, ms * 0.4);
    const done = performance.now() - t0;
    if (half > done) await sleep(half - done);
    if (!alive(n)) return;
    snap(e.s, s.seq, { keepPos: true });
    paintMini();
    const rest = ms - (performance.now() - t0);
    if (rest > 0) await sleep(rest);
  }
  function bigStar(e) {
    const big = $('mnx-big');
    big.innerHTML = '';
    const inn = el('div', 'mnx-big-in');
    inn.appendChild(B().star());
    inn.appendChild(el('b', null, '¡ESTRELLA!'));
    inn.appendChild(el('span', null, 'Dralingo: «' + (line('dralingo') || '¡Una estrella para ti!') + '» · −10 monedas'));
    const d = el('img'); d.src = B().DRALINGO; d.alt = '';
    inn.appendChild(d);
    big.appendChild(inn);
    big.classList.remove('hidden');
    sfx(MN + 'star.mp3', 0.9);
    buzz([60, 40, 60, 40, 160]);
    board.pose(meK, 'ok');
    later(1700, () => {
      if (!testHold) big.classList.add('hidden');
      starPos = e.to;
      board.setStar(e.to, true);
      paintMini();
      board.pose(meK, 'idle');
    });
  }
  async function lucky(e, s) {
    const me = meK;
    // Latifa spins the roulette, then the outcome
    const wheel = el('div', 'mnx-wheel');
    card({ host: 'latifa', title: '¡Suerte!', sub: 'Latifa: «' + line('latifa') + '»', extra: wheel });
    sfx(K + 'tick.mp3', 0.5);
    requestAnimationFrame(() => { wheel.style.setProperty('--turn', (900 + Math.floor(Math.random() * 360)) + 'deg'); wheel.classList.add('spin'); });
    await sleep(T.roulette);
    const fromMe = pieceAt(me);
    if (e.out === 'chest' || e.out === 'gold') {
      card({ host: 'latifa', title: e.out === 'gold' ? '¡Cofre de oro!' : '¡Un cofre!', sub: e.lucky ? 'Con monedas de la suerte' : 'Monedas para comprar estrellas', val: '+' + e.coins, cls: 'gain', gold: true });
      flyCoins(fromMe, me, e.coins);
      sfx(MO + 'gold.mp3', 0.7);
    } else if (e.out === 'swap') {
      card({ host: 'latifa', title: `¡Cambio! Tú y ${seatName(e.with)}`, sub: 'Cambian de lugar en el tablero' });
      sfx(K + 'whoosh.mp3', 0.7);
      board.jump(me, e.to, { now: true });
      board.jump(e.with, e.from);
    } else if (e.out === 'duel') {
      const duel = el('div', 'mnx-duel');
      const mk = (n, who) => { const w = el('div'); const d = B().dice('hit'); d._face.textContent = String(n); w.append(d, el('small', null, who)); return w; };
      duel.append(mk(e.a, 'Tú'), mk(e.b, seatName(e.with)));
      const res = e.coins > 0 ? `¡Ganaste ${e.coins}!` : e.coins < 0 ? `Perdiste ${-e.coins}` : '¡Empate!';
      card({ host: 'aileen', title: `¡Duelo con ${seatName(e.with)}! ${res}`, sub: 'Aileen: «' + line('aileen') + '»', extra: duel, cls: e.coins > 0 ? 'gain' : e.coins < 0 ? 'loss' : '' });
      sfx(MO + 'drum.mp3', 0.5);
      if (e.coins > 0) later(700, () => { flyCoins(pieceAt(e.with), me, e.coins); });
      else if (e.coins < 0) later(700, () => { flyCoins(fromMe, me, -e.coins, true); });
    } else if (e.out === 'ahead') {
      card({ host: 'latifa', title: '¡Avanza 3!', sub: 'Tres casillas más' });
    }
  }
  function stormMoment(e, by) {
    board.storm();
    sfx(MN + 'storm.mp3', 0.8);
    buzz([80, 40, 80]);
    const mine = e.lost && e.lost[meK];
    card({ host: 'adric', title: '¡Tormenta de arena!', sub: (by === meK ? 'La provocaste tú. ' : `La provocó ${seatName(by)}. `) + 'Todos pierden monedas y la estrella vuela', val: mine ? '−' + mine : '', cls: 'loss', bad: true });
    if (mine) flyCoins(pieceAt(meK), meK, mine, true);
    later(900, () => { starPos = e.to; board.setStar(e.to, true); paintMini(); });
  }

  // ---------- the moment card ----------
  let cardT = null;
  function card(o) {
    const c = $('mnx-card');
    if (!c) return;
    clearTimeout(cardT);
    c.className = 'mnx-card' + (o.gold ? ' gold' : '') + (o.bad ? ' bad' : '');
    c.innerHTML = '';
    if (o.lm != null) { const i = el('img', 'mnx-card-lm'); i.src = B().lmArt(LM[o.lm].id); i.alt = ''; c.appendChild(i); }
    else if (o.host) { const i = el('img', 'mnx-card-host'); i.src = host(o.host); i.alt = ''; c.appendChild(i); }
    else if (o.img) { const i = el('img', 'mnx-card-host'); i.src = o.img; i.alt = ''; c.appendChild(i); }
    const body = el('div', 'mnx-card-body');
    body.appendChild(el('b', null, o.title));
    if (o.sub) body.appendChild(el('span', null, o.sub));
    c.appendChild(body);
    if (o.extra) c.appendChild(o.extra);
    if (o.val) {
      const v = el('div', 'mnx-card-val ' + (o.cls || ''));
      if (/^[+−-]?\d/.test(o.val)) v.append(el('span', null, o.val), B().coin());
      else v.textContent = o.val;
      c.appendChild(v);
    }
    void c.offsetWidth;
    c.classList.add('show');
    cardT = setTimeout(hideCard, 3200);
  }
  function hideCard() { const c = $('mnx-card'); if (c && !testHold) c.classList.remove('show'); }

  // ---------- rivals: their moves on my board ----------
  function rivalMove(mv) {
    if (!on || !board || mv.b !== boardId || mv.k === meK || !seats[mv.k]) return;
    if (mv.seq <= viewSeq) return;            // older than the board my phone last got whole (a reconnect): already drawn
    const n = gen;
    const at = group(mv.ev);
    board.hop(mv.k, mv.path, {
      gate: async (i) => { if (i > 0 && alive(n)) for (const e of (at[i] || [])) await rivalMoment(e, mv, n); },
      onStep: () => { if (++rivalSteps % 8 === 0) paintMini(); },
      end: async () => { if (alive(n)) for (const e of (at[mv.path.length] || [])) await rivalMoment(e, mv, n); },
    }).then(() => {
      if (!alive(n)) return;
      settleSeats(mv.seats);
      snap(Object.fromEntries((mv.seats || []).map((x) => [x.k, [x.pos, x.coins, x.stars]])), mv.seq);
      paintMini();
    });
    ctx.markActivity();
  }
  let rivalSteps = 0;
  async function rivalMoment(e, mv, n) {
    if (!alive(n)) return;
    const k = mv.k;
    const name = seatName(k);
    const p = board.posOf(k);
    const ms = MAP.evMs(e);
    const t0 = performance.now();
    switch (e.type) {
      case 'star':
        board.pop(p, '★', 'star');
        tick(k, `${name} compró una estrella`);
        sfx(MO + 'star.mp3', 0.45);
        later(700, () => { starPos = e.to; board.setStar(e.to, true); paintMini(); });
        break;
      case 'buy':
        board.own(e.lm, { k, lvl: 1 });
        owners[e.lm] = { k, lvl: 1 };
        tick(k, `${name} compró ${lmName(e.lm)}`);
        break;
      case 'level':
        board.own(e.lm, { k, lvl: e.lvl });
        owners[e.lm] = { k, lvl: e.lvl };
        tick(k, `${lmName(e.lm)} de ${name}: nivel ${e.lvl}`);
        break;
      case 'toll':
        if (e.to === meK) {
          banner('mine', [bold(`¡${name} te pagó ${e.coins} de peaje!`), span(`Cayó en tu ${lmName(e.lm)}`)], B().lmArt(LM[e.lm].id), 2400);
          flyCoins(pieceAt(k), meK, e.coins);
          buzz([30, 30, 30]);
        } else tick(k, `${name} pagó peaje a ${seatName(e.to)}`);
        break;
      case 'lucky':
        if (e.out === 'swap') {
          if (e.with === meK) { banner('hurt', [bold(`¡${name} cambió de lugar contigo!`), span('«¡Suerte!» de Latifa: cambio')], host('latifa'), 2400); buzz([40, 30, 40]); }
          else tick(k, `${name} cambió de lugar con ${seatName(e.with)}`);
          board.jump(k, e.to, { now: true });
          board.jump(e.with, e.from);
        } else if (e.out === 'duel') {
          if (e.with === meK) {
            const won = e.coins < 0, lost = e.coins > 0;
            banner(won ? 'mine' : lost ? 'hurt' : 'lead', [bold(`¡Duelo con ${name}! ${name} ${e.a} · tú ${e.b}`), span(won ? `¡Ganaste ${-e.coins} monedas!` : lost ? `Perdiste ${e.coins} monedas` : '¡Empate!')], host('aileen'), 2600);
            if (won) flyCoins(pieceAt(k), meK, -e.coins);
            if (lost) flyCoins(pieceAt(meK), meK, e.coins, true);
          } else tick(k, `Duelo: ${name} contra ${seatName(e.with)}`);
        } else if (e.out === 'gold') tick(k, `${name} abrió un cofre de oro`);
        break;
      case 'storm': {
        board.storm();
        sfx(MN + 'storm.mp3', 0.6);
        const mine = e.lost && e.lost[meK];
        banner('hurt', [bold('¡Tormenta de arena!'), span(`La provocó ${name}: ${mine ? 'pierdes ' + mine + ' · ' : ''}la estrella vuela`)], host('adric'), 2600);
        if (mine) flyCoins(pieceAt(meK), meK, mine, true);
        later(900, () => { starPos = e.to; board.setStar(e.to, true); paintMini(); });
        buzz([60, 40, 60]);
        break;
      }
      case 'blue': board.pop(p, '+' + e.coins, 'gain'); break;
      case 'red': board.pop(p, String(e.coins || 0), 'loss'); break;
      case 'pass': board.pop(0, '+' + e.coins, 'gain'); break;
      default: break;
    }
    const half = Math.min(500, ms * 0.4);
    if (half > 0) await sleep(half);
    if (!alive(n)) return;
    snap(e.s, mv.seq, { keepPos: true });
    const rest = ms - (performance.now() - t0);
    if (rest > 0) await sleep(rest);
  }
  // the ticker: one line of what a rival did (newest wins, never a backlog)
  let tickT = null;
  function tick(k, text) {
    const t = $('mnx-tick');
    if (!t) return;
    t.innerHTML = '';
    const dot = el('i');
    dot.style.setProperty('--c', colorOf(k).c);
    t.append(dot, el('span', null, text));
    t.classList.add('show');
    clearTimeout(tickT);
    tickT = setTimeout(() => { if (!testHold) t.classList.remove('show'); }, 2200);
  }

  // ---------- banners at the top edge ----------
  let bannerQ = [], bannerOn = false;
  const bold = (t) => el('b', null, t);
  const span = (t) => el('span', null, t);
  function banner(kind, parts, img, ms) {
    bannerQ.push({ kind, parts, img, ms: ms || 2300 });
    if (bannerQ.length > 3) bannerQ.splice(0, bannerQ.length - 3);
    if (!bannerOn) nextBanner();
  }
  function nextBanner() {
    const b = $('mnx-banner');
    const it = bannerQ.shift();
    if (!b || !it) { bannerOn = false; return; }
    bannerOn = true;
    b.className = 'mnx-banner ' + it.kind;
    b.innerHTML = '';
    if (it.img === 'star') b.appendChild(B().star());
    else if (it.img) { const i = el('img'); i.src = it.img; i.alt = ''; b.appendChild(i); }
    const txt = el('div');
    it.parts.forEach((x) => txt.appendChild(x));
    b.appendChild(txt);
    void b.offsetWidth;
    b.classList.add('show');
    setTimeout(() => {
      if (testHold) return;
      b.classList.remove('show');
      setTimeout(nextBanner, 260);
    }, it.ms);
  }

  // ---------- pause ----------
  let paused = false;
  function pauseUI(v) {
    v = !!v;
    const box = $('mnx-pause');
    if (box) box.classList.toggle('hidden', !v);
    if (v === paused) return;
    paused = v;
    holdQ(v);
    holdDice(v);
    if (cur && !cur.tapped && !cur.done) setTiles(!v);
  }

  // ---------- the countdown run-in and the rules card ----------
  function showRunIn() {
    const box = $('mnx-intro');
    if (!box || !B()) return;
    clearTimers(introTimers);
    box.className = 'mnx-intro runin';
    box.innerHTML = '';
    box.appendChild(el('div', 'mni-title', '¡Tu tablero!'));
    const list = Object.values(seats).sort((a, b) => a.c - b.c);
    const rivals = list.filter((s) => s.k !== meK).length;
    box.appendChild(el('p', 'mni-sub', rivals ? `Juegas contra ${rivals} ${rivals === 1 ? 'rival' : 'rivales'}: ¡junta estrellas!` : '¡Junta estrellas!'));
    const st = el('div', 'mni-stage');
    const starEl = B().star('mni-star');
    const dr = el('img', 'mni-dral'); dr.src = B().DRALINGO; dr.alt = 'Dralingo';
    const crew = el('div', 'mni-crew');
    list.forEach((s, i) => {
      const f = B().figure({ skin: s.skin, c: s.c, name: s.k === meK ? myName() : s.name, me: s.k === meK, tag: true });
      f.classList.add('mni-run', i % 2 ? 'from-r' : 'from-l');
      f.style.setProperty('--i', i);
      crew.appendChild(f);
    });
    st.append(starEl, dr, crew);
    box.appendChild(st);
    const cap = el('p', 'mni-cap');
    cap.append('Dralingo tiene la ', bold('estrella'), ': ¡llega con 10 monedas!');
    box.appendChild(cap);
    sfx(K + 'whoosh.mp3', 0.6);
    later(900, () => sfx(H + 'round.mp3', 0.45), introTimers);
  }
  function rulesPic() {
    const pic = el('div', 'mni-pic');
    pic.appendChild(B().dice());
    pic.lastChild._face.textContent = '5';
    pic.appendChild(B().figure({ skin: mySkin(), c: seats[meK] ? seats[meK].c : 1, name: '' }));
    pic.appendChild(el('i', 'mn-hand'));
    return pic;
  }
  function showRules(ms) {
    const box = $('mnx-intro');
    if (!box || !B()) return;
    clearTimers(introTimers);
    box.className = 'mnx-intro rules';
    box.innerHTML = '';
    const c = el('div', 'mni-card');
    c.append(rulesPic(), el('h2', null, '¡Responde y tira el dado!'), el('p', null, 'Cada respuesta correcta es un dado. Camina, compra monumentos y llega a la estrella con 10 monedas'));
    const say = el('div', 'mni-say');
    box.append(c, say);
    const total = Math.max(1400, ms || 2800);
    later(total - 1250, () => { say.textContent = '¿Listos?'; sfx(K + 'tick.mp3', 0.7); }, introTimers);
    later(total - 600, () => { box.classList.add('go'); say.textContent = '¡YA!'; sfx(H + 'start.mp3', 0.8); buzz(30); }, introTimers);
    later(total + 400, () => { if (!testHold) hideIntro(); }, introTimers);
  }
  function hideIntro() {
    const box = $('mnx-intro');
    if (box && !testHold) { clearTimers(introTimers); box.className = 'mnx-intro hidden'; box.innerHTML = ''; }
  }

  // ---------- events ----------
  let frozen = false, queue = [];
  const handlers = {};
  function init(c) {
    ctx = c;
    const sock = c.socket;
    if (skin() && skin().holdWhen) skin().holdWhen(() => on && !!(g && g.paused));
    const s = { on: (ev, fn) => { handlers[ev] = fn; sock.on(ev, (d) => { if (frozen && (ev.indexOf('mn:') === 0 || ev === 'question' || ev === 'answer-result' || ev === 'game-end')) { queue.push([fn, d, ev]); return; } fn(d); }); } };
    s.on('state', (st) => {
      if (!st) return;
      if (st.gameType) setOn(st.gameType === 'monopoly');
      if (!on) return;
      roster = Object.values(st.players || {}).map((p) => ({ name: p.name, avatar: p.avatar, sk: p.sk, k: p.k, off: !!p.off }));
      const meP = st.players && sock.id && st.players[sock.id];
      if (meP && meP.sk) mySk = meP.sk;
      // who is online on my board (a kid who left stays on the board, greyed)
      if (board) roster.forEach((p) => { if (p.k != null && seats[p.k] && seats[p.k].on !== !p.off) { seats[p.k].on = !p.off; board.online(p.k, !p.off); paintHud(); } });
      if (st.state === 'lobby') { teardown(true); g = null; paintLobbyKid(); }
      // the shared code shows its question screen when it thinks the game started: this game's screen is the board
      if (st.state === 'active') setTimeout(() => {
        const q = $('screen-question');
        if (on && q && !q.classList.contains('hidden') && board) boardUp(true);
      }, 0);
    });
    s.on('countdown', () => {
      if (!on) return;
      teardown(true);
      g = null;
      audioReady();
      const box = $('mnx-intro');
      if (box) { box.className = 'mnx-intro runin'; box.innerHTML = ''; box.appendChild(el('div', 'mni-title', '¡Repartiendo tableros!')); }
    });
    s.on('mn:init', (d) => applyInit(d));
    s.on('mn:seat', (d) => {
      if (!on || !board || !d || !d.board || d.board.id !== boardId) return;
      (d.board.seats || []).forEach((x) => { if (!seats[x.k]) { seats[x.k] = Object.assign({}, x, { seq: 0 }); tick(x.k, `${x.name} se unió a tu tablero`); } });
      board.setSeats(Object.values(seats));
      paintHud();
      paintMini();
    });
    s.on('mn:intro', (d) => { if (!on || !g) return; g.phase = 'intro'; showRules(d && d.ms); });
    s.on('mn:play', (d) => {
      if (!on || !g) return;
      g.phase = 'play';
      g.endAt = performance.now() + (d.endsMs || 0);
      hideIntro();
      boardUp(true);
      runClock();
      aim(0);
      ctx.markActivity();
    });
    s.on('question', (q) => { if (on && q && !q.ss) showQuestion(q); });
    s.on('answer-result', (r) => { if (on && r && r.monopoly) onResult(r); });
    s.on('answer-stale', (d) => {
      if (!on || !cur || cur.done) return;
      if (d && d.reason === 'paused') { cur.tapped = false; document.querySelectorAll('.mnq-a').forEach((b) => b.classList.remove('picked')); clearTimeout(rescueT); }
    });
    s.on('mn:turn', (sc) => { if (on && sc) playScript(sc); });
    s.on('mn:noroll', (d) => {
      if (!on || !dice || !d || dice.tid !== d.tid) return;
      // the teacher paused while my tap was on its way: tap again after «Seguir»
      dice.tapped = false;
      clearInterval(dice.rescue);
      dice.faces.forEach((x) => { x.classList.remove('hit'); x.classList.add('spin'); });
      $('mnx-tap').classList.add('on');
    });
    s.on('mn:move', (mv) => { if (mv) rivalMove(mv); });
    s.on('mn:lead', (l) => {
      if (!on || !l || l.b !== boardId) return;
      const mine = l.k === meK;
      const name = seatName(l.k);
      banner('lead', [bold(mine ? (l.first ? '¡Tomas la delantera!' : '¡Pasas al primer lugar!') : (l.first ? `¡${name} toma la delantera!` : `¡${name} pasa al primer lugar!`)),
        span(mine ? 'Cuida tus estrellas' : 'Responde bien: ¡alcánzalo!')], 'star', 2300);
      sfx(K + (mine ? 'flag.mp3' : 'castle-alert.mp3'), 0.55);
      buzz(mine ? [30, 40, 30] : [60, 40, 60]);
    });
    s.on('mn:frenzy', (d) => {
      if (!on || !g) return;
      g.frenzy = true;
      $('mnx').classList.add('frenzy');
      g.endAt = performance.now() + (d.endsMs || 30000);
      banner('frenzy', [bold('¡Últimos 30 segundos!'), span('¡MONEDAS DOBLES! Todo vale el doble')], 'star', 2600);
      sfx(K + 'siege.mp3', 0.6);
      buzz([50, 40, 50, 40, 80]);
      if (skin() && skin().music) skin().music('music-final', 0.4);
    });
    s.on('mn:time', (d) => {
      if (!on || !g) return;
      g.endAt = performance.now() + (d.endsMs || 0);
      if (g.paused) g.pausedLeft = d.endsMs || g.pausedLeft;
      banner('lead', [bold(`+${d.add || 30} segundos más`)], null, 1600);
    });
    s.on('mn:pause', (d) => {
      if (!on || !g) return;
      g.paused = !!d.paused;
      if (g.paused) g.pausedLeft = Math.max(0, g.endAt - performance.now());
      else if (d.endsMs != null) g.endAt = performance.now() + d.endsMs;
      pauseUI(g.paused);
      if (skin() && skin().hold) skin().hold(g.paused);
      if (g.phase === 'intro') { if (g.paused) clearTimers(introTimers); else showRules(d.phaseMs); }
      ctx.markActivity();
    });
    s.on('mn:final', () => {
      if (!on) return;
      ctx.markActivity();
      clearTimeout(rescueT);
      stopQTimer();
      setTiles(false);
      cur = null; pendingQ = null;
      if (!dice) sheet(false);
      hideIntro();
      bannerQ = [];
      if ($('mnx-banner')) $('mnx-banner').classList.remove('show');
      if (g) { g.phase = 'final'; g.paused = false; }
      pauseUI(false);
      const f = $('mnx-final');
      if (f) { f.classList.remove('hidden'); }
      sfx(H + 'final.mp3', 0.85);
      buzz([40, 30, 40]);
      if (skin() && skin().music) skin().music(null);
    });
    s.on('mn:skip', () => { if (on) jumpToCard(); });
    s.on('game-end', () => {
      if (!on) return;
      gen++;
      hideOverlays();
      document.body.classList.remove('mnx-play');
      clearTimers(); stopQTimer(); clearInterval(clockT); clearTimeout(rescueT);
      closeDice();
      cur = null; pendingQ = null;
      testHold = false;
      hideIntro();
      pauseUI(false);
    });
    window.addEventListener('resize', () => { if (on && board) aim(0); });
    document.addEventListener('keydown', (e) => {
      if (!on || e.repeat) return;
      if (dice && !dice.tapped && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); tapDice(); }
    });
  }
  function bindTap() {
    const t = $('mnx-tap');
    if (!t || t._bound) return;
    t._bound = true;
    t.addEventListener('pointerdown', (e) => { if (e.pointerType && e.pointerType !== 'mouse' && e.cancelable) e.preventDefault(); tapDice(); });
    t.addEventListener('click', () => tapDice());
    t.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  function applyInit(d) {
    setOn(true);
    ctx.markActivity();
    bindTap();
    const fresh = !g || g.id !== d.id;
    if (fresh) document.body.classList.remove('mnx-ended');
    g = { id: d.id, phase: d.phase, frenzy: !!d.frenzy, paused: !!d.paused, endAt: d.endsMs != null ? performance.now() + d.endsMs : 0, pausedLeft: d.endsMs || 0 };
    $('mnx').classList.toggle('frenzy', g.frenzy);
    if (!d.board || !d.you) return;
    B().preload((d.board.seats || []).map((x) => x.skin));
    ensureBoard(d.board, d.you.k);
    pauseUI(g.paused);
    runClock();
    if (d.phase === 'countdown') { showRunIn(); return; }
    if (d.phase === 'intro') { if (fresh || !$('mnx-intro').classList.contains('rules')) showRules(d.phaseMs); return; }
    hideIntro();
    boardUp(true);
    // a reload in the middle of something: an open dice window comes back, a turn still playing jumps to its end
    if (d.you.turn && d.phase !== 'done') {
      if (!(dice && dice.tid === d.you.turn.tid)) openDice({ tid: d.you.turn.tid, dice: d.you.turn.dice, lead: 0, ms: d.you.turn.msLeft });
    } else if (dice) {
      // my dice window is over on the server (rolled while my phone was away): play that turn if it is it, else close it
      const last = d.you.last;
      if (last && last.tid === dice.tid && !playing) playScript(last);
      else closeDice();
    } else if (!cur) sheet(false);
    if (!dice && !playing && pendingQ) { const q = pendingQ; pendingQ = null; showQuestion(q); }
    const fin = $('mnx-final');
    if (fin) fin.classList.toggle('hidden', d.phase !== 'final');
    later(60, () => aim(0));
  }

  // ---------- lobby: who I am + «Así se juega» ----------
  function lobby(head) {
    let box = $('mnx-how');
    if (!head) { if (box) box.remove(); return; }
    if (!B()) return;
    if (!box) {
      box = el('div', 'mnx-how');
      box.id = 'mnx-how';
      box.innerHTML = '<div class="mnh-you"><div id="mnh-kid"></div><div><b>¡Juegas en un tablero!</b><span>Tú y tus rivales (3 o 4 por tablero), cada uno con su color</span></div></div>'
        + '<ol>'
        + '<li><div class="mnh-step"><div class="mnh-q"><i></i><i></i><i></i><i></i></div></div><span><b>Responde bien</b>cada respuesta correcta es un dado</span></li>'
        + '<li><div class="mnh-step" id="mnh-s2"></div><span><b>Toca el dado</b>tu personaje camina por Dubái</span></li>'
        + '<li><div class="mnh-step" id="mnh-s3"></div><span><b>¡Junta estrellas!</b>Dralingo te da una por 10 monedas</span></li>'
        + '</ol>';
      head.after(box);
      const d = B().dice(); d._face.textContent = '4';
      $('mnh-s2').append(d, el('i', 'mn-hand'));
      const im = el('img'); im.src = B().DRALINGO; im.alt = '';
      $('mnh-s3').append(B().star(), im);
    }
    paintLobbyKid();
  }
  function paintLobbyKid() {
    const kid = $('mnh-kid');
    if (!kid || !B()) return;
    kid.innerHTML = '';
    kid.appendChild(B().figure({ skin: mySkin(), c: -1, name: myName() }));   // my seat colour comes with the deal
  }

  // ---------- the end: the ceremony of my board, then my card ----------
  let cer = null;
  function end(data) {
    if (!B()) return;
    const box = $('screen-end');
    if (!box) return;
    clearTimers(cerTimers);
    const old = $('mnx-finale');
    if (old) old.remove();
    const fin = el('div', 'mnx-finale');
    fin.id = 'mnx-finale';
    box.appendChild(fin);
    document.body.classList.add('mnx-ended');
    bannerQ = []; bannerOn = false;
    if ($('mnx-banner')) $('mnx-banner').classList.remove('show');
    const f = $('mnx-final');
    if (f) f.classList.add('hidden');
    cer = { data, fin };
    const skip = el('button', 'mnf-skip', 'Ver mi tarjeta');
    skip.type = 'button';
    skip.addEventListener('click', jumpToCard);
    fin.appendChild(skip);
    if (!g) { stage('card'); return; }      // a phone that reloaded after the end goes straight to its card
    const bonus = ((data && data.monopoly && data.monopoly.board && data.monopoly.board.bonus) || []);
    const plan = [['bonus', 1600]].concat(bonus.map((s, i) => ['b' + i, 2100])).concat([['drum', 1300], ['win', 3600]]);
    let t = 0;
    plan.forEach(([name, ms]) => { later(t, () => stage(name), cerTimers); t += ms; });
    later(t, () => stage('card'), cerTimers);
  }
  function jumpToCard() { if (!cer) return; clearTimers(cerTimers); stage('card'); }
  function stageBox(cls) {
    const old = cer.fin.querySelector('.mnf-stage');
    if (old) old.remove();
    const s = el('div', 'mnf-stage ' + cls);
    cer.fin.prepend(s);
    return s;
  }
  function confetti(host, c, n) {
    if (reduced()) return;
    const col = B().colorOf(c);
    const cols = [col.c, col.s, '#ffc93c', '#fff7e3'];
    for (let i = 0; i < (n || 26); i++) {
      const x = el('i', 'mn-confetti');
      x.style.setProperty('--x', (4 + Math.random() * 92) + '%');
      x.style.setProperty('--d', (Math.random() * 0.8).toFixed(2) + 's');
      x.style.setProperty('--r', Math.round(Math.random() * 360) + 'deg');
      x.style.setProperty('--dx', Math.round((Math.random() - 0.5) * 120) + 'px');
      x.style.background = cols[i % cols.length];
      host.appendChild(x);
      setTimeout(() => x.remove(), 3600);
    }
  }
  function stage(name) {
    if (!cer) return;
    cer.stage = name;
    const d = cer.data || {}, mo = d.monopoly || {}, meD = d.me || {};
    const bd = mo.board || { rows: [], bonus: [], winners: [] };
    const byK = {};
    (bd.rows || []).forEach((r) => { byK[r.k] = r; });
    const fig = (r, pose, tag) => B().figure({ skin: r.skin, c: r.c, name: r.k === meD.k ? myName() || r.name : r.name, me: r.k === meD.k, pose, tag: tag !== false });
    // my whole board as one scene: every player of my board in a row (seat order), their stars under them; `upTo` = how
    // many bonus stars are given so far (the totals grow one moment at a time), `hi` = who gets the star now
    const sorted = (bd.rows || []).slice().sort((a, b) => a.c - b.c);
    const totalAt = (r, upTo) => r.stars + (bd.bonus || []).slice(0, upTo).filter((x) => (x.winners || []).includes(r.k)).length;
    function boardRow(upTo, hi, pose, coins) {
      const row = el('div', 'mnf-row' + (sorted.length > 4 ? ' five' : ''));
      sorted.forEach((r, i) => {
        const isHi = hi && hi.includes(r.k);
        const col = el('div', 'mnf-col' + (isHi ? ' hi' : hi ? ' dim' : '') + (r.k === meD.k ? ' me' : ''));
        col.style.setProperty('--i', i);
        if (isHi) { const drop = el('div', 'mnf-drop'); drop.appendChild(B().star()); col.appendChild(drop); }
        col.appendChild(fig(r, isHi ? 'ok' : (pose || 'idle')));
        const tot = el('div', 'mnf-tot');
        tot.append(B().star(), el('span', null, String(totalAt(r, upTo))));
        if (isHi) tot.appendChild(el('em', 'mnf-plus', '+1'));
        col.appendChild(tot);
        if (coins) { const c = el('div', 'mnf-coins'); c.append(B().coin(), el('span', null, String(r.coins))); col.appendChild(c); }
        row.appendChild(col);
      });
      return row;
    }
    if (name === 'bonus') {
      const s = stageBox('bonus');
      s.appendChild(B().star('mnf-badge'));
      s.appendChild(el('h2', 'mnf-h big', '¡Estrellas bonus!'));
      s.appendChild(el('p', 'mnf-p', 'Tres estrellas más para tu tablero… ¡pueden cambiar quién gana!'));
      s.appendChild(boardRow(0, null, 'idle'));
      sfx(MO + 'drum.mp3', 0.6);
      return;
    }
    if (name.indexOf('b') === 0 && /^b\d+$/.test(name)) {
      const i = Number(name.slice(1));
      const st = (bd.bonus || [])[i];
      if (!st) return;
      const mine = (st.winners || []).includes(meD.k);
      const s = stageBox('star' + (mine ? ' mine' : ''));
      const head = el('div', 'mnf-sthead');
      head.appendChild(B().star('mnf-badge small'));
      const ht = el('div');
      const who = (st.winners || []).map((k) => (k === meD.k ? 'Tú' : (byK[k] && byK[k].name) || '')).filter(Boolean);
      ht.append(el('h2', 'mnf-h', st.name), el('p', 'mnf-p', (who.length ? who.join(' y ') + ' · ' : '') + bonusValue(st)), el('p', 'mnf-p soft', 'para ' + st.what));
      head.appendChild(ht);
      s.appendChild(head);
      s.appendChild(boardRow(i + 1, st.winners || [], 'idle'));
      if (mine) { s.appendChild(el('div', 'mnf-mine', '¡ES PARA TI!')); buzz([40, 30, 40, 30, 120]); }
      sfx(MN + 'star.mp3', mine ? 0.9 : 0.55);
      return;
    }
    if (name === 'drum') {
      const s = stageBox('drum');
      s.appendChild(el('h2', 'mnf-h big', '¿Quién gana tu tablero?'));
      s.appendChild(el('p', 'mnf-p', 'Más estrellas gana. Si empatan: más monedas'));
      s.appendChild(boardRow((bd.bonus || []).length, null, 'idle', true));
      sfx(MO + 'drum.mp3', 0.75);
      return;
    }
    if (name === 'win') {
      const s = stageBox('win');
      const winners = bd.winners || [];
      const iWon = winners.includes(meD.k);
      const wNames = winners.map((k) => (k === meD.k ? 'tú' : (byK[k] && byK[k].name) || '')).filter(Boolean);
      s.appendChild(el('h2', 'mnf-h big', !winners.length ? '¡Buen tablero!' : iWon ? (winners.length > 1 ? '¡Empate! ¡Ganas tú también!' : '¡Ganaste tu tablero!') : `¡Gana ${wNames.join(' y ')}!`));
      // the winner(s) big in the middle on a gold glow, the others below, reacting
      const champ = el('div', 'mnf-champ' + (winners.length > 1 ? ' two' : ''));
      winners.slice(0, 2).forEach((k) => {
        const r = byK[k];
        if (!r) return;
        const c = el('div', 'mnf-champ-k');
        c.appendChild(fig(r, 'ok'));
        const tot = el('div', 'mnf-tot big');
        const tie = sorted.some((x) => !winners.includes(x.k) && x.total === r.total);
        tot.append(el('div', 'mnf-crown', '1º'), B().star(), el('span', null, `${r.total} ${r.total === 1 ? 'estrella' : 'estrellas'}`));
        c.appendChild(tot);
        if (tie) { const cc = el('div', 'mnf-coins'); cc.append(B().coin(), el('span', null, `${r.coins} monedas`)); c.appendChild(cc); }
        champ.appendChild(c);
      });
      const conf = el('div', 'mnf-conf');
      s.append(champ);
      const rest = sorted.filter((r) => !winners.includes(r.k));
      if (rest.length) {
        const row = el('div', 'mnf-row small');
        rest.forEach((r, i) => {
          const col = el('div', 'mnf-col lose' + (r.k === meD.k ? ' me' : ''));
          col.style.setProperty('--i', i);
          col.appendChild(fig(r, 'no'));
          const tot = el('div', 'mnf-tot');
          tot.append(B().star(), el('span', null, String(r.total)));
          col.appendChild(tot);
          row.appendChild(col);
        });
        s.appendChild(row);
      }
      s.appendChild(conf);
      if (winners.length) confetti(conf, byK[winners[0]] ? byK[winners[0]].c : 0, 30);
      sfx(K + 'sting-win.mp3', iWon ? 0.9 : 0.55);
      if (!iWon) later(700, () => sfx(H + 'aww.mp3', 0.5), cerTimers);
      buzz(iWon ? [60, 40, 60, 40, 200] : [80]);
      return;
    }
    if (name === 'card') {
      clearTimers(cerTimers);
      const s = stageBox('card');
      const skip = cer.fin.querySelector('.mnf-skip');
      if (skip) skip.remove();
      const c = el('div', 'mnk-card');
      const top = el('div', 'mnk-top');
      const won = !!meD.won;
      const r = byK[meD.k] || { skin: mySkin(), c: meD.c || 0, name: myName(), k: meD.k };
      const f = fig(r, won ? 'ok' : 'idle', false);
      const rank = el('div', 'mnk-rank');
      rank.append(el('b', null, (meD.rank || '–') + 'º'), el('span', null, meD.of ? `de ${meD.of} en tu tablero` : 'en tu tablero'));
      top.append(f, rank);
      c.appendChild(top);
      c.appendChild(el('h2', 'mnk-h', won ? '¡Ganaste tu tablero!' : (meD.total || 0) > 0 ? '¡Qué buen tablero!' : '¡La próxima estrella es tuya!'));
      const big = el('div', 'mnk-big');
      const st = el('span'); st.append(B().star(), el('b', null, fmt(meD.total || 0)));
      const co = el('span'); co.append(B().coin(), el('b', null, fmt(meD.coins || 0)));
      big.append(st, co);
      c.appendChild(big);
      const facts = el('div', 'mnk-facts');
      const fact = (n, l) => { const x = el('div', 'mnk-fact'); x.append(el('b', null, n), el('span', null, l)); facts.appendChild(x); };
      if ((meD.right || 0) > 0) fact(String(meD.right), meD.right === 1 ? 'acierto' : 'aciertos');
      if ((meD.lands || 0) > 0) fact(String(meD.lands), meD.lands === 1 ? 'monumento' : 'monumentos');
      if ((meD.best || 0) >= 2) fact(String(meD.best), 'mejor racha');
      if ((meD.laps || 0) > 0 && facts.children.length < 3) fact(String(meD.laps), meD.laps === 1 ? 'vuelta' : 'vueltas');
      if ((meD.tolls || 0) > 0 && facts.children.length < 3) fact(String(meD.tolls), 'de peajes');
      if (!facts.children.length && (meD.answered || 0) > 0) fact(String(meD.answered), meD.answered === 1 ? 'pregunta jugada' : 'preguntas jugadas');
      if (facts.children.length) c.appendChild(facts);
      const mineBonus = (bd.bonus || []).filter((x) => (meD.bonus || []).includes(x.id));
      if (mineBonus.length || (meD.classRank && meD.classRank <= 3 && (meD.total || 0) > 0)) {
        const row = el('div', 'mnk-stars');
        if (meD.classRank && meD.classRank <= 3 && (meD.total || 0) > 0) { const b = el('div', 'mnk-star'); b.append(B().star(), el('span', null, `${meD.classRank}º de la clase`)); row.appendChild(b); }
        mineBonus.forEach((x) => { const b = el('div', 'mnk-star'); b.append(B().star(), el('span', null, x.name)); row.appendChild(b); });
        c.appendChild(row);
      }
      c.appendChild(el('p', 'mnk-wait', 'Quédate aquí: tu profe puede empezar otra ronda'));
      const home = el('button', 'mnk-home', 'Salir del juego');
      home.type = 'button';
      home.addEventListener('click', () => { location.href = '/'; });
      c.appendChild(home);
      s.appendChild(c);
    }
  }
  function bonusValue(st) {
    if (st.id === 'sabia') return `${st.value} ${st.value === 1 ? 'acierto' : 'aciertos'}`;
    if (st.id === 'magnate') return `${st.value} ${st.value === 1 ? 'monumento' : 'monumentos'}`;
    if (st.id === 'racha') return `${st.value} seguidas`;
    return String(st.value);
  }

  window.MonoPhone = {
    init, lobby, end,
    frame: () => ({
      on, phase: g && g.phase, me: meK, board: boardId, seats: JSON.parse(JSON.stringify(seats)), qid: cur && cur.qid, tapped: !!(cur && cur.tapped),
      done: !!(cur && cur.done), dice: dice ? { tid: dice.tid, n: dice.n, tapped: dice.tapped } : null, playing: !!playing,
      frenzy: !!(g && g.frenzy), paused: !!(g && g.paused), stage: cer && cer.stage, star: starPos,
    }),
    hold: (v) => {
      testHold = !!v;
      const b = $('mnx-banner');
      if (!testHold && b && b.classList.contains('show')) { b.classList.remove('show'); setTimeout(nextBanner, 260); }
    },
    freeze: (v) => { frozen = !!v; if (!frozen) { const q = queue; queue = []; q.forEach(([fn, d]) => fn(d)); } return queue.length; },
    replay: (ev) => { while (queue.length) { const [fn, d, e] = queue.shift(); fn(d); if (e === ev) break; } return queue.length; },
    queued: () => queue.map((x) => x[2]),
    stage: (name) => { if (cer) { clearTimers(cerTimers); stage(name); } },
    runIn: () => showRunIn(),
    rules: (ms) => showRules(ms),
    sim: (ev, d) => { if (handlers[ev]) handlers[ev](d); },
    tapDice: () => tapDice(),
    answer: (i) => answer(i),
    card: (o) => card(o),
    banner: (kind, title, sub) => banner(kind, [bold(title), span(sub || '')], 'star', 4000),
    bigStar: () => bigStar({ to: starPos }),
  };
})();
