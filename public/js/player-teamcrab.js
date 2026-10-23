// ¡Atrapa a Fénec! — the kid's phone (the product). player.js calls CrabPhone.init(...) once; the pastel skin
// (player-kingdoms-skin.js) routes the sounds, the music, the lobby card and the end screen here.
// His design 2026-10-23 (Mario Party «Team Crab» turned around: the kids are the crew of the robot crab):
//   · the beach on top: my crew's crab with my face in my glass cockpit, everyone's hammer, Fénec hopping on the dock,
//     El Péndulo over the sea; my crewmates' loaded hammers hover with their shadows on the planks, live;
//   · the quiz below: a right answer LOADS my hammer → the stage grows and I TOUCH Fénec (the hammer comes down right
//     there), or drag it over a spot and swipe down / «¡GOLPE!»; a 6-s bar (it slams by itself at 0);
//   · a BONK floods the whole phone gold: Fénec flat, dizzy stars, the class's words fly out of his sack to the crab;
//   · a wrong, late or blind answer: my hammer jams with smoke (3 s), Fénec snatches a word back «¡Mías!», a grumpy spark
//     feeds El Péndulo; his BIG SWING (all the crew's hammers knocked away) takes over the whole phone;
//   · «¡FINAL!» → my crew's ending (caught or escaped, the crab kicked to pieces), the ceremony, my card.
// Test hooks: CrabPhone.frame(), .answer(i), .tapFenec(), .slamAt(spot), .freeze(v), .stage().
(function () {
  'use strict';
  const A = '/assets/teamcrab/', H = '/assets/halcon/', K = '/assets/kingdoms/', PARTY = '/assets/party/', MO = '/assets/monopoly/';
  const $ = (id) => document.getElementById(id);
  const S = () => window.CrabStage;
  const HB = () => window.HalconBoard;
  const P = () => window.DralyParty || null;
  const C = () => window.DralingoCast || null;
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const sfx = (url, vol) => { const s = window.KingdomsSkin; if (s && s.sfx) s.sfx(url, vol); };
  const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (_) {} };
  const COLORS = ['red', 'blue', 'yellow', 'green'];
  const SHAPES = ['▲', '◆', '●', '■'];
  const fmtClock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const duck = (low) => { const k = window.KingdomsSkin; if (k && k.musicVol) k.musicVol(low ? 0.14 : 0.32); };

  let ctx = null, on = false, stage = null, lastBigFx = 0;
  let g = null;                  // { id, you, b, phase }
  let seats = [];                // my crew [{ k, name, skin, words, on }]
  let myH = { st: 'idle', until: 0, guided: false, x: 0.5 };
  let myQ = null, myLocked = false, paintedQid = null, qShownAt = 0;
  let words = 0, target = 1, anger = 0, endsAt = 0, pausedLeft = 0, paused = false, frenzy = false, streak = 0, moment = null;
  let clockT = null, timers = [];
  const later = (ms, fn) => { const t = setTimeout(fn, Math.max(0, ms)); timers.push(t); return t; };
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  const seat = (k) => seats.find((x) => x.k === k) || null;
  const nameOf = (k) => (seat(k) ? seat(k).name : '');
  const skinOf = (k) => (seat(k) ? seat(k).skin : 'dralingo');
  const myName = () => ($('lobby-name') && $('lobby-name').textContent) || '';
  function localSkin() {
    let v = '';
    try { v = localStorage.getItem('dralyAvatar') || ''; } catch (_) {}
    return HB() ? HB().skinFor(v || '🐉', myName()) : 'dralingo';     // (player.js joins with 🐉 when nothing was picked)
  }
  function setOn(v) {
    if (v === on) return;
    on = v;
    document.body.classList.toggle('tc-on', on);
    if (!on) { stopAll(); placeMute(false); }
  }
  // the platform's «🔊 Sonido» sits in the stage's top corner while the game plays (never over the tiles or «¡GOLPE!»)
  let muteHome = null;
  function placeMute(inStage) {
    const b = $('mute-btn');
    if (!b) return;
    if (!muteHome) muteHome = { parent: b.parentNode, next: b.nextSibling };
    if (inStage) { const w = $('tc-stagewrap'); if (w && b.parentNode !== w) w.appendChild(b); b.classList.add('tc-mute'); }
    else { if (b.parentNode !== muteHome.parent) muteHome.parent.insertBefore(b, muteHome.next && muteHome.next.parentNode === muteHome.parent ? muteHome.next : null); b.classList.remove('tc-mute'); }
  }
  function stopAll() { clearTimers(); if (clockT) { clearInterval(clockT); clockT = null; } }
  function ensureStage() { if (!stage && S()) stage = new (S().Stage)($('tc-stage'), { mode: 'phone' }); }
  function show() { ctx.showScreen('teamcrab'); ensureStage(); placeMute(true); requestAnimationFrame(() => { if (stage) stage.fit(); }); }

  // ---------- the top: my crew, the clock, the words we got back ----------
  function paintCrew() {
    const box = $('tc-crew');
    if (!box) return;
    box.innerHTML = '';
    seats.forEach((x) => {
      const r = document.createElement('div');
      r.className = 'tc-mate' + (g && x.k === g.you ? ' me' : '') + (x.on === false ? ' off' : '');
      const i = document.createElement('img');
      i.alt = '';
      i.src = S() ? S().head(x.skin) : '';
      const n = document.createElement('span');
      n.textContent = g && x.k === g.you ? 'Tú' : x.name;
      const b = document.createElement('b');
      b.id = 'tc-w-' + x.k;
      b.textContent = x.words || 0;
      r.append(i, n, b);
      box.appendChild(r);
    });
  }
  function setWords(k, v, bump) {
    const x = seat(k);
    if (x) x.words = v;
    const b = $('tc-w-' + k);
    if (b) { b.textContent = v; if (bump && !reduced()) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); } }
    if (g && k === g.you) $('tc-me').textContent = v + ' 📚';
  }
  function paintSack(pop) {
    const n = $('tc-sack-n'), f = $('tc-sack-fill');
    if (!n || !f) return;
    const full = words >= target;
    n.textContent = full ? '¡' + words + ' / ' + target + ' palabras! ✓' : words + ' / ' + target + ' palabras';   // (the words our crew got back / the goal to catch him)
    f.style.width = Math.min(100, Math.round((100 * words) / Math.max(1, target))) + '%';
    $('tc-sack').classList.toggle('full', full);
    if (pop && !reduced()) { const s = $('tc-sack'); s.classList.remove(pop); void s.offsetWidth; s.classList.add(pop); }
  }
  function paintClock() {
    const left = endsAt ? (paused ? pausedLeft : endsAt - Date.now()) : 0;
    $('tc-clock').textContent = endsAt ? fmtClock(left) : '·:··';
    $('tc-clock').classList.toggle('hurry', !!endsAt && left <= 30000);
    if (myH.st === 'loaded' && myH.until) {
      const lb = $('tc-loadbar');
      const tl = Math.max(0, myH.until - Date.now());
      if (lb) { lb.firstChild.style.width = Math.min(100, (100 * tl) / (myH.guided ? 9000 : 6000)) + '%'; lb.classList.toggle('hurry', tl < 2000); }
      const s = Math.ceil(tl / 1000);
      if (s <= 2 && s > 0 && lb && lb.dataset.s !== String(s) && !paused) { lb.dataset.s = String(s); sfx(PARTY + 'tick.mp3', 0.45); }
    }
  }
  function runClock() { if (!clockT) clockT = setInterval(paintClock, 200); paintClock(); }

  // ---------- the panel: the quiz, my loaded hammer, a message ----------
  function mode(m) {
    const scr = $('screen-teamcrab');
    $('tc-quiz').classList.toggle('hidden', m !== 'quiz');
    $('tc-pad').classList.toggle('hidden', m !== 'pad');
    $('tc-msg').classList.toggle('hidden', m !== 'msg');
    scr.classList.toggle('tc-aiming', m === 'pad');
    $('tc-touch').classList.toggle('live', m === 'pad');
    requestAnimationFrame(() => { if (stage) stage.fit(); });
  }
  function msg(big, small, kind, imgSrc) {
    mode('msg');
    const box = $('tc-msg');
    box.className = 'tc-msg' + (kind ? ' ' + kind : '');
    $('tc-msg-big').textContent = big || '';
    $('tc-msg-small').textContent = small || '';
    const im = $('tc-msg-img');
    if (imgSrc) { im.src = imgSrc; im.classList.remove('hidden'); } else im.classList.add('hidden');
  }
  function qbar() {
    const qt = $('tc-qtime');
    if (!qt || !myQ) return;
    const total = 15000, left = Math.max(0, Math.min(total, (myQ.until || Date.now() + total) - Date.now()));
    qt.style.setProperty('--ms', total + 'ms');
    qt.style.setProperty('--qd', (left - total) + 'ms');
    qt.classList.remove('run', 'done'); void qt.offsetWidth; qt.classList.add('run');
    if (myLocked || paused || moment) qt.classList.add('done');
  }
  function seenQ() {
    if (!myQ || myQ.seenSent || document.visibilityState !== 'visible') return;
    myQ.seenSent = true;
    ctx.socket.emit('player:tc-seen', { pin: ctx.getPin(), qid: myQ.qid });
  }
  let frozeAt = 0;
  function freezeQ(v) {
    if (v) { if (!frozeAt) frozeAt = Date.now(); return; }
    if (frozeAt && myQ && myQ.until) myQ.until += Date.now() - frozeAt;
    frozeAt = 0;
  }
  // what my panel shows now, from my hammer's state
  function paintPanel() {
    if (!g || g.phase === 'final') return;
    if (myH.st === 'loaded') { paintPad(); return; }
    if (myH.st === 'jam') { msg('¡Martillo atascado! 💨', 'Fénec se llevó una palabra… respira y responde la próxima', 'jam', A + 'fenec-laugh.webp'); return; }
    if (myH.st === 'knock') { msg('¡El Péndulo tumbó los martillos!', '¡Uf! Respira: en un momento vuelven 🔨', 'knock', A + 'pendulo-dizzy.webp'); return; }
    if (myH.st === 'fall' || myH.st === 'back') { msg('🔨 ¡BAM!', 'Tu martillo vuelve a subir… ¡prepárate para la próxima!', 'calm', A + 'hammer.webp'); return; }
    paintMyQ();
  }
  function paintMyQ() {
    mode('quiz');
    const box = $('tc-mq');
    if (!myQ) { box.classList.add('wait'); $('tc-mq-text').textContent = '…'; $('tc-tiles').innerHTML = ''; $('tc-mq-img').classList.add('hidden'); return; }
    box.classList.remove('wait');
    if (paintedQid === myQ.qid && $('tc-tiles').children.length) { qbar(); return; }
    paintedQid = myQ.qid;
    qShownAt = Date.now();
    qbar();
    seenQ();
    const qf = $('tc-qfeed');
    if (qf.classList.contains('ans')) { qf.textContent = ''; qf.className = 'tc-qfeed'; }
    $('tc-mq-text').textContent = myQ.text;
    const im = $('tc-mq-img');
    if (myQ.image) { im.src = myQ.image; im.classList.remove('hidden'); } else { im.classList.add('hidden'); im.removeAttribute('src'); }
    const tiles = $('tc-tiles');
    tiles.innerHTML = '';
    myQ.answers.forEach((a, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tc-tile ' + COLORS[i % 4];
      b.innerHTML = '<i>' + SHAPES[i % 4] + '</i>';
      const t = document.createElement('span');
      t.textContent = a;
      b.appendChild(t);
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); answer(i); });
      b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); answer(i); } });
      tiles.appendChild(b);
    });
    myLocked = false;
    if (!reduced()) { box.classList.remove('new'); void box.offsetWidth; box.classList.add('new'); }
  }
  function answer(i) {
    if (!myQ || myLocked || paused || moment === 'swing') return;   // (a bonk never blocks the quiz)
    if (Date.now() - qShownAt < 350) return;                  // (a tap meant for the last question never lands on the new one)
    myLocked = true;
    $('tc-qtime').classList.add('done');
    const b = document.querySelectorAll('#tc-tiles .tc-tile')[i];
    if (b) b.classList.add('chosen');
    document.querySelectorAll('#tc-tiles .tc-tile').forEach((x) => { x.disabled = true; });
    sfx(K + 'tap.mp3', 0.5);
    ctx.socket.emit('player:tc-answer', { pin: ctx.getPin(), qid: myQ.qid, idx: i });
    ctx.markActivity();
  }
  // a gang member cheers a streak (3, 5, 8…) at the panel's edge
  function cheer(n) {
    const c = C();
    if (!c || ![3, 5, 8, 12].includes(n)) return;
    const id = c.pick ? c.pick(1)[0] : 'aileen';
    const box = $('tc-cheer');
    box.innerHTML = '';
    const im = document.createElement('img');
    im.alt = '';
    im.src = c.pose(id, 'cheer');
    const t = document.createElement('span');
    t.textContent = '¡' + n + ' seguidas! ' + c.line(id, 'win');
    box.append(im, t);
    box.classList.remove('hidden', 'on'); void box.offsetWidth; box.classList.add('on');
    later(2400, () => box.classList.add('hidden'));
    sfx(K + 'streak.mp3', 0.5);
  }

  // ---------- my loaded hammer: touch Fénec, or drag and slam ----------
  function paintPad() {
    mode('pad');
    const hint = $('tc-padhint');
    hint.textContent = myH.guided ? 'Tu primer martillo: ¡toca a Fénec y cae encima!' : '¡Martillo listo! Toca a Fénec · o arrastra y ¡GOLPE!';
    $('tc-golpe').disabled = moment === 'bonk';
    if (moment === 'bonk') hint.textContent = '¡Está aplastado! Espera que se levante… 👀';
    const lb = $('tc-loadbar');
    if (lb) lb.dataset.s = '';
    paintClock();
    coach();
  }
  // the guided first slam: a hand goes from my hammer to Fénec and taps
  function coach() {
    const h = $('tc-hand');
    if (!h) return;
    if (!myH.guided || myH.st !== 'loaded' || moment === 'bonk' || !stage || !stage.g) { h.className = 'tc-hand hidden'; return; }
    const x = stage.spotPx(stage.at), y = stage.g.feet - stage.g.fenH * 0.5;
    h.style.left = Math.round(x - 20) + 'px';
    h.style.top = Math.round(y - 10) + 'px';
    h.className = 'tc-hand tap';
  }
  let drag = null, lastAimSent = 0;
  const canSlam = () => !!(g && myH.st === 'loaded' && !paused && moment !== 'bonk' && moment !== 'swing');
  function xOfClient(cx) {
    if (!stage || !stage.spotX) return 0.5;
    const r = $('tc-stage').getBoundingClientRect();
    const a = stage.spotX[0], b = stage.spotX[stage.spotX.length - 1];
    return Math.max(0, Math.min(1, (cx - r.left - a) / Math.max(1, b - a)));
  }
  function aimTo(x, force) {
    myH.x = x;
    if (stage && g) stage.aim(g.you, x);
    const now = Date.now();
    if (force || now - lastAimSent > 60) { lastAimSent = now; ctx.socket.emit('player:tc-aim', { pin: ctx.getPin(), x }); }
  }
  function slamNow(x) {
    if (!canSlam()) return;
    if (x != null) aimTo(x, true);
    myH.st = 'fall';
    $('tc-golpe').disabled = true;
    $('tc-hand').className = 'tc-hand hidden';
    ctx.socket.emit('player:tc-slam', { pin: ctx.getPin(), x: myH.x });
    if (stage && g) stage.slam(g.you, myH.x, 420);
    mySlamAt = Date.now();
    later(400, () => sfx(A + 'thud.mp3', 0.9));
    buzz(20);
    later(420, () => buzz(45));
    sfx(K + 'whoosh.mp3', 0.45);
    ctx.markActivity();
    msg('🔨 ¡BAM!', '¡Tu martillo cayó! ¿Lo aplastaste?', 'calm', A + 'hammer.webp');
  }
  let mySlamAt = 0;
  function touchStart(e) {
    if (!canSlam()) return;
    e.preventDefault();
    try { e.target.setPointerCapture(e.pointerId); } catch (_) {}
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: Date.now(), moved: false, startX: myH.x };
    if (e.pointerType !== 'mouse') aimTo(xOfClient(e.clientX));
  }
  function touchMove(e) {
    if (!canSlam()) { drag = null; return; }
    if (!drag && e.pointerType === 'mouse') { aimTo(xOfClient(e.clientX)); return; }   // (a laptop: the hammer follows the mouse)
    if (!drag || e.pointerId !== drag.id) return;
    e.preventDefault();
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) drag.moved = true;
    if (dy > 46 && dy > Math.abs(dx) * 1.1 && Date.now() - drag.t0 < 700) { drag = null; slamNow(null); return; }   // a swipe down = slam
    aimTo(xOfClient(e.clientX));
  }
  function touchEnd(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (!d.moved && Date.now() - d.t0 < 450) slamNow(xOfClient(e.clientX));          // a tap = the hammer comes down right there
  }

  // ---------- the big moments on the whole phone ----------
  function fxOn(kind, ms) {
    const r = $('tc-fx');
    if (!r) return;
    r.innerHTML = '';
    r.className = 'tc-fx ' + kind;
    if (!reduced()) {
      const n = kind === 'bonk' ? 16 : 12;
      for (let i = 0; i < n; i++) {
        const e = document.createElement('i');
        e.className = 'fly';
        e.textContent = kind === 'bonk' ? (i % 3 ? '★' : '✦') : '';
        e.style.setProperty('--x', Math.round(Math.random() * innerWidth) + 'px');
        e.style.setProperty('--y', Math.round(innerHeight * (0.1 + Math.random() * 0.6)) + 'px');
        e.style.setProperty('--dx', Math.round((Math.random() - 0.5) * innerWidth * 0.7) + 'px');
        e.style.setProperty('--dy', Math.round((Math.random() - 0.7) * innerHeight * 0.5) + 'px');
        e.style.setProperty('--t', (1.0 + Math.random() * 0.8).toFixed(2) + 's');
        e.style.setProperty('--d', Math.round(Math.random() * 600) + 'ms');
        r.appendChild(e);
      }
      const scr = $('screen-teamcrab');
      scr.classList.remove('tc-shake'); void scr.offsetWidth; scr.classList.add('tc-shake');
      setTimeout(() => scr.classList.remove('tc-shake'), 700);
    }
    if (kind === 'swing') {
      const p = document.createElement('img');
      p.className = 'tc-bigpend';
      p.alt = '';
      p.src = A + 'pendulo-swing.webp';
      r.appendChild(p);
    }
    clearTimeout(fxOn.t);
    fxOn.t = setTimeout(() => { r.classList.add('out'); setTimeout(() => { r.className = 'tc-fx hidden'; r.innerHTML = ''; }, 420); }, ms || 2400);
  }
  function bigCard(imgSrc, big, small, kind, ms) {
    const b = $('tc-big');
    b.innerHTML = '';
    b.className = 'tc-big ' + (kind || '');
    if (imgSrc) { const i = document.createElement('img'); i.alt = ''; i.src = imgSrc; b.appendChild(i); }
    const t = document.createElement('div');
    const h = document.createElement('b');
    h.textContent = big;
    const s = document.createElement('span');
    s.textContent = small || '';
    t.append(h, s);
    b.appendChild(t);
    clearTimeout(bigCard.t);
    bigCard.t = setTimeout(() => { b.className = 'tc-big hidden'; }, ms || 2400);
  }
  function setMoment(m, ms) {
    moment = m;
    const scr = $('screen-teamcrab');
    scr.classList.toggle('tc-moment', m === 'swing');            // (a swing knocks the hammers: the quiz waits; a bonk: it goes on)
    scr.classList.toggle('tc-bonking', m === 'bonk');
    if (m === 'bonk' && myH.st === 'loaded') { $('tc-padhint').textContent = '¡Está aplastado! Espera que se levante… 👀'; $('tc-golpe').disabled = true; $('tc-hand').className = 'tc-hand hidden'; }   // (a slam now would land on him flat: the pad says so)
    freezeQ(m === 'swing');
    if (m) {
      if (m === 'swing') document.querySelectorAll('#tc-tiles .tc-tile').forEach((x) => { x.disabled = true; });
      clearTimeout(setMoment.t);
      setMoment.t = setTimeout(() => endMoment(), ms);
    }
    requestAnimationFrame(() => { if (stage) stage.fit(); });
  }
  function endMoment() {
    if (!moment) return;
    moment = null;
    const scr = $('screen-teamcrab');
    const was = scr.classList.contains('tc-moment');
    scr.classList.remove('tc-moment', 'tc-bonking');
    if (was) freezeQ(false);
    if (!myLocked) document.querySelectorAll('#tc-tiles .tc-tile').forEach((x) => { x.disabled = false; });
    requestAnimationFrame(() => { if (stage) stage.fit(); qbar(); });
    paintPanel();
  }

  // ---------- the events ----------
  function applyInit(d) {
    if (!d) return;
    const fresh = !g || g.id !== d.id;
    g = { id: d.id, you: d.you ? d.you.k : null, b: d.board ? d.board.id : null, phase: d.phase };
    show();
    if (fresh) { myQ = null; streak = 0; moment = null; frozeAt = 0; if (stage) stage.reset(); }
    paused = !!d.paused;
    $('tc-pause').classList.toggle('hidden', !paused);
    if (d.endsMs != null) { endsAt = Date.now() + d.endsMs; pausedLeft = d.endsMs; }
    frenzy = !!d.frenzy;
    document.body.classList.toggle('tc-frenzy', frenzy);
    $('tc-frenzy').classList.toggle('hidden', !frenzy);
    const bd = d.board;
    if (bd) {
      seats = bd.seats.slice();
      words = bd.words; target = bd.target;
      anger = bd.anger || 0;
      if (stage) {
        stage.setCrew(seats, g.you);
        (bd.hammers || []).forEach((h) => { if (h.k !== g.you) stage.ham(h.k, h.st, h.x); });
        stage.placeFen(bd.fx, false);
        stage.setAnger(anger);
      }
    }
    if (d.you) {
      myH = { st: d.you.st || 'idle', until: Date.now() + (d.you.ms || 0), guided: !!d.you.guided, x: d.you.x != null ? d.you.x : 0.5 };
      if (stage) stage.ham(g.you, myH.st === 'jam' ? 'jam' : myH.st, myH.x);
      setWords(d.you.k, d.you.words || 0);
    }
    paintCrew();
    paintSack();
    if (d.q) { if (!myQ || myQ.qid !== d.q.qid) { myQ = d.q; myQ.until = Date.now() + (d.q.ms != null ? d.q.ms : 15000); } }
    else if (myH.st !== 'idle') myQ = null;
    if (d.phase === 'play') paintPanel();
    else if (d.phase === 'countdown' || d.phase === 'intro') msg('¡Atrapa a Fénec!', 'Responde bien = tu martillo se carga 🔨 · ¡luego aplasta a Fénec!', 'calm', A + 'fenec-idle.webp');
    if (d.phase === 'play' || d.phase === 'intro') runClock();
    paintClock();
    if (bd && bd.phase === 'bonk' && stage) { stage.fenPose('spill'); }
    duck(myH.st === 'loaded');
  }
  function init(c) {
    ctx = c;
    const sock = c.socket;
    let frozen = false, queue = [];
    const s = { on: (ev, fn) => sock.on(ev, (d) => { if (frozen && ev.indexOf('tc:') === 0) { queue.push([fn, d]); return; } fn(d); }) };
    CrabPhone._freeze = (v) => { frozen = !!v; if (!frozen) { const q = queue; queue = []; q.forEach(([fn, d]) => fn(d)); } return queue.length; };
    const touch = $('tc-touch');
    touch.addEventListener('pointerdown', touchStart);
    touch.addEventListener('pointermove', touchMove);
    touch.addEventListener('pointerup', touchEnd);
    touch.addEventListener('pointercancel', () => { drag = null; });
    $('tc-golpe').addEventListener('click', () => slamNow(null));
    document.addEventListener('visibilitychange', () => { if (on && myQ && !$('tc-quiz').classList.contains('hidden')) seenQ(); });
    window.addEventListener('draly:elsewhere', () => { stopAll(); duck(false); setOn(false); });
    let lastReact = 0;
    document.querySelectorAll('#tc-reacts button').forEach((b) => b.addEventListener('click', () => {
      const now = Date.now();
      if (now - lastReact < 1200) return;
      lastReact = now;
      b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
      ctx.socket.emit('player:tc-react', { pin: ctx.getPin(), e: b.dataset.e });
    }));
    s.on('state', (st) => {
      if (!st) return;
      if (st.gameType) setOn(st.gameType === 'teamcrab');
      if (!on) return;
      if (st.state === 'lobby') {
        stopAll(); g = null; myQ = null; moment = null; frozeAt = 0; stopCeremony();
        placeMute(false);
        document.body.classList.remove('tc-ended', 'tc-frenzy');
        const old = $('tc-cer'); if (old) old.remove();
      }
      if (g && st.players) {
        const off = {};
        Object.values(st.players).forEach((p) => { off[String(p.name).toLowerCase()] = !!p.off; });
        let ch = false;
        seats.forEach((x) => { const k = String(x.name).toLowerCase(); if (k in off && x.on === off[k]) { x.on = !off[k]; ch = true; if (stage) stage.setOn(x.k, x.on); } });
        if (ch) paintCrew();
      }
    });
    s.on('countdown', () => {
      if (!on) return;
      stopAll(); g = null; myQ = null; endsAt = 0; streak = 0; moment = null; words = 0; frozeAt = 0; stopCeremony();
      document.body.classList.remove('tc-ended', 'tc-frenzy');
      const old = $('tc-cer'); if (old) old.remove();
    });
    s.on('tc:init', (d) => { if (on || (d && d.id)) { setOn(true); applyInit(d); ctx.markActivity(); } });
    s.on('tc:seat', (d) => {
      if (!on || !d.board || !g || d.board.id !== g.b) return;
      seats = d.board.seats.slice();
      target = d.board.target;
      if (stage) { stage.setCrew(seats, g.you); (d.board.hammers || []).forEach((h) => stage.ham(h.k, h.k === g.you ? myH.st : h.st, h.k === g.you ? myH.x : h.x)); }
      paintCrew(); paintSack();
    });
    s.on('tc:intro', (d) => {
      if (!on || !g) return;
      ctx.markActivity();
      g.phase = 'intro';
      if (stage) { stage.say('¡Atrapa a Fénec!', 'go', (d.ms || 2600) - 700); stage.taunt('idle', '¡No me atrapan! 😜', 1800); }
      msg('¡Atrapa a Fénec!', 'Responde bien = tu martillo se carga 🔨 · ¡luego aplasta a Fénec!', 'calm', A + 'fenec-idle.webp');
      later((d.ms || 2600) - 700, () => { if (stage) stage.say('¡YA!', 'go', 700); sfx(H + 'start.mp3', 0.7); sfx(A + 'clank.mp3', 0.7); buzz(30); });
    });
    s.on('tc:play', (d) => {
      if (!on || !g) return;
      g.phase = 'play';
      endsAt = Date.now() + (d.endsMs || 0);
      runClock();
      paintPanel();
    });
    s.on('tc:q', (d) => {
      if (!on || !g || d.b !== g.b) return;
      ctx.markActivity();
      myQ = d;
      myQ.until = Date.now() + (d.ms || 15000);
      if (myH.st === 'idle' && moment !== 'swing') paintMyQ();
    });
    s.on('tc:nope', (d) => {
      if (!on || !myQ || !d || d.qid !== myQ.qid) return;
      if (d.why === 'closed') { myLocked = false; document.querySelectorAll('#tc-tiles .tc-tile').forEach((x) => { x.disabled = false; x.classList.remove('chosen'); }); }
    });
    s.on('tc:qr', (d) => {
      if (!on || !g) return;
      ctx.markActivity();
      const ts = document.querySelectorAll('#tc-tiles .tc-tile');
      streak = d.streak || 0;
      myQ = null;
      if (d.ok) {
        if (ts[d.idx]) ts[d.idx].classList.add('ok');
        sfx(K + 'correct.mp3', 0.55);
        sfx(A + 'clank.mp3', 0.5);
        buzz(20);
        $('tc-qfeed').textContent = '🔨 ¡Martillo cargado!';
        $('tc-qfeed').className = 'tc-qfeed ok ans';
        cheer(streak);
        myH = { st: 'loaded', until: Date.now() + (d.loadMs || 6000), guided: !!d.guided, x: myH.x };
        later(260, () => { if (myH.st === 'loaded') { duck(true); paintPad(); if (stage && g) stage.ham(g.you, 'loaded', myH.x); } });
      } else {
        if (ts[d.idx]) ts[d.idx].classList.add('no');
        if (ts[d.correctIdx]) ts[d.correctIdx].classList.add('ok');
        document.querySelectorAll('#tc-tiles .tc-tile').forEach((x) => { x.disabled = true; });
        $('tc-qtime').classList.add('done');
        sfx(K + 'wrong.mp3', 0.4);
        later(200, () => sfx(A + 'giggle.mp3', 0.75));
        buzz([30, 40, 30]);
        const fb = $('tc-qfeed');
        fb.innerHTML = '';
        const sad = document.createElement('span');
        sad.className = 'sad';
        const im = document.createElement('img');
        im.alt = '';
        im.src = A + 'fenec-laugh.webp';
        const tx = document.createElement('span');
        tx.textContent = (d.late ? '¡Se acabó el tiempo! ' : d.tooFast ? '¡Muy rápido! Primero lee. ' : '¡Casi! ') + 'Era «' + d.correctText + '» · ¡Mías! 😆';
        sad.append(im, tx);
        fb.appendChild(sad);
        fb.className = 'tc-qfeed no ans';
        myH = { st: 'jam', until: Date.now() + (d.jamMs || 3000), guided: false, x: myH.x };
        if (stage && g) stage.ham(g.you, 'jam', myH.x);
        later(1300, () => { if (myH.st === 'jam') paintPanel(); });
      }
    });
    // a hammer's state (mine: the end of a jam, a knock, back up; a crewmate's: loaded = its shadow on the dock)
    s.on('tc:ham', (d) => {
      if (!on || !g || d.b !== g.b) return;
      if (d.k === g.you) {
        if (d.st === 'loaded') myH = { st: 'loaded', until: Date.now() + (d.ms || 6000), guided: !!d.guided, x: d.x != null ? d.x : myH.x };
        else myH.st = d.st;
        if (stage) stage.ham(g.you, d.st, myH.x);
        if (d.st === 'idle') { duck(false); if (!moment) paintPanel(); }
        if (d.st === 'loaded' && !moment) { duck(true); paintPad(); }
        return;
      }
      if (stage) stage.ham(d.k, d.st, d.x);
    });
    s.on('tc:aim', (d) => { if (on && g && d.b === g.b && d.k !== g.you && stage) stage.aim(d.k, d.x); });
    s.on('tc:slam', (d) => {
      if (!on || !g || d.b !== g.b) return;
      ctx.markActivity();
      if (d.k === g.you) {
        if (Date.now() - mySlamAt > 600) {                          // (it slammed by itself: the time ran out)
          myH.st = 'fall';
          if (stage) stage.slam(g.you, d.x, d.ms);
          later((d.ms || 420) - 20, () => sfx(A + 'thud.mp3', 0.9));
          msg('🔨 ¡BAM!', '¡Se acabó el tiempo y tu martillo cayó solo!', 'calm', A + 'hammer.webp');
          $('tc-hand').className = 'tc-hand hidden';
        }
        duck(false);
        return;
      }
      if (stage) stage.slam(d.k, d.x, d.ms);
      later((d.ms || 420) - 20, () => sfx(A + 'thud.mp3', 0.45));
    });
    s.on('tc:impact', (d) => {
      if (!on || !g || d.b !== g.b) return;
      if (d.k === g.you && !d.hit) {
        $('tc-plus').textContent = '¡Se escapó! 😜';
        $('tc-plus').className = 'tc-plus no';
        if (!reduced()) { void $('tc-plus').offsetWidth; $('tc-plus').classList.add('on'); }
      }
    });
    s.on('tc:hop', (d) => { if (on && g && d.b === g.b && stage) stage.hop(d.from, d.to, d.ms); });
    s.on('tc:up', (d) => { if (on && g && d.b === g.b && stage) stage.up(d.from, d.to, d.ms); });
    s.on('tc:taunt', (d) => {
      if (!on || !g || d.b !== g.b || !stage || moment) return;              // (a big moment speaks for itself)
      stage.taunt(d.line);
      if (d.line === 'miss' || d.line === 'miss2' || d.line === 'mias') later(150, () => sfx(A + 'giggle.mp3', d.line === 'mias' ? 0.6 : 0.4));
    });
    // a BONK on my crew: the whole phone floods gold, Fénec flat, the words fly back
    s.on('tc:bonk', (d) => {
      if (!on || !g || d.b !== g.b) return;
      ctx.markActivity();
      const meB = d.k === g.you;
      const meA = (d.assists || []).includes(g.you);
      if (myH.st === 'loaded' && !meB) myH.until += d.ms || 2000;       // (the server holds my loaded hammer while he lies flat)
      words = d.words; target = d.target;
      paintSack('pop');
      const bk = seat(d.k);
      if (bk) setWords(d.k, (bk.words || 0) + d.pts, true);
      (d.assists || []).forEach((k) => { const x = seat(k); if (x) setWords(k, (x.words || 0) + 1, true); });
      setMoment('bonk', d.ms || 2000);
      if (stage) stage.bonk(d.k, d.flying, d.pts, d.ms);
      if (meB || meA || Date.now() - lastBigFx > 6000) { lastBigFx = Date.now(); fxOn('bonk', 1500); }   // (restraint: a crewmate's bonks never stack into noise)
      sfx(A + 'thud.mp3', 1);
      later(90, () => sfx(H + 'pop.mp3', 0.8));
      later(700, () => sfx('/assets/mochi/star.mp3', 0.75));
      later(1000, () => sfx(K + 'streak.mp3', 0.6));
      buzz(meB ? [60, 40, 120] : 50);
      const who = bk ? bk.name : '';
      const assist = (d.assists || []).filter((k) => k !== d.k).map(nameOf).filter(Boolean);
      if (meB) bigCard(S() ? S().head(skinOf(g.you)) : null, '¡LO APLASTASTE! +' + d.pts + ' 📚', assist.length ? '¡Trampa de ' + assist.join(' y ') + '!' : (d.x2 ? '¡Atardecer dorado: doble!' : '¡Las palabras vuelven a la tripulación!'), 'gold me', 2500);
      else if (meA) bigCard(S() ? S().head(skinOf(g.you)) : null, '¡Tu trampa funcionó! +1 📚', who + ' lo aplastó · ¡le tapaste la salida!', 'gold', 2500);
      else bigCard(S() ? S().head(skinOf(d.k)) : null, '¡' + who + ' aplastó a Fénec!', '+' + d.pts + ' palabras para la tripulación 📚', 'gold', 2500);
    });
    s.on('tc:full', (d) => {
      if (!on || !g || d.b !== g.b) return;
      if (P() && P().news) P().news('¡Bolsa vacía! 🎒 ¡Lo atraparon!', { sub: 'Sigan: cada martillazo suma al récord de su tripulación', kind: 'win', ms: 2600 });
      sfx(K + 'sting-win.mp3', 0.6);
    });
    // a miss on my crew (never who): Fénec snatches a word back, the spark feeds El Péndulo
    s.on('tc:snatch', (d) => {
      if (!on || !g || d.b !== g.b) return;
      words = d.words; target = d.target;
      paintSack(d.n ? 'drop' : null);
      if (stage && d.n) stage.snatch('📚');
    });
    s.on('tc:feed', (d) => {
      if (!on || !g || d.b !== g.b) return;
      anger = d.anger;
      if (stage) stage.feed(d.anger);
      later(560, () => sfx(A + 'slurp.mp3', 0.55));
      if (d.anger >= 4 && d.anger < 5) later(900, () => sfx(A + 'tick.mp3', 0.6));
    });
    s.on('tc:calm', (d) => {
      if (!on || !g || d.b !== g.b) return;
      const was = anger;
      anger = d.anger;
      if (stage) stage.calm(d.anger);
      if (Math.floor(was) !== Math.floor(d.anger)) sfx(H + 'pop.mp3', 0.35);
    });
    // El Péndulo's BIG SWING: the whole phone, every hammer of my crew knocked away
    s.on('tc:swing', (d) => {
      if (!on || !g || d.b !== g.b) return;
      ctx.markActivity();
      anger = 1;
      setMoment('swing', d.ms || 1800);
      if (stage) stage.swing(d.ms);
      fxOn('swing', (d.ms || 1800) + 200);
      sfx(A + 'swing.mp3', 0.95);
      later(260, () => sfx(A + 'clank.mp3', 0.8));
      later(520, () => sfx(A + 'swing.mp3', 0.7));
      buzz([80, 60, 160]);
      bigCard(A + 'pendulo-angry.webp', '¡ZAS! El Péndulo se enojó', 'Los errores lo alimentan… ¡respiren, respondan bien y se calma!', 'purple', (d.ms || 1800) + 400);
      if (myH.st !== 'jam') { myH.st = 'knock'; myH.until = Date.now() + (d.knockMs || 3000); }
    });
    s.on('tc:calmdown', (d) => { if (on && g && d.b === g.b && stage) stage.setAnger(d.anger); });
    s.on('tc:noslam', (d) => {
      if (!on || !d) return;
      if (d.why === 'wait' && myH.st === 'fall') { myH.st = 'loaded'; if (stage && g) stage.ham(g.you, 'loaded', myH.x); later(600, () => { if (!moment) paintPad(); }); }
    });
    s.on('tc:react', (d) => { if (on && g && d.b === g.b && stage) stage.react(d.e, skinOf(d.k)); });
    s.on('tc:frenzy', (d) => {
      if (!on || !g) return;
      frenzy = !d.off;
      document.body.classList.toggle('tc-frenzy', frenzy);
      $('tc-frenzy').classList.toggle('hidden', !frenzy);
      if (frenzy) {
        if (P() && P().news) P().news('¡Atardecer dorado! 🌅', { sub: 'Últimos 30 segundos: cada martillazo vale doble', kind: 'alarm', ms: 2800 });
        sfx(PARTY + 'hurry.mp3', 0.8);
        buzz([60, 40, 60]);
      }
    });
    s.on('tc:time', (d) => {
      if (!on || !g) return;
      endsAt = Date.now() + (d.endsMs || 0);
      if (paused) pausedLeft = d.endsMs || 0;
      if (d.targets && g.b != null && d.targets[g.b]) { target = d.targets[g.b]; paintSack(); }
      paintClock();
      if (stage && d.add) stage.say((d.add > 0 ? '+' : '−') + Math.abs(d.add) + ' s', 'calm', 1200);
    });
    s.on('tc:pause', (d) => {
      if (!on || !g) return;
      paused = !!d.paused;
      if (paused) pausedLeft = endsAt - Date.now();
      $('tc-pause').classList.toggle('hidden', !paused);
      freezeQ(paused);
      if (!paused) qbar();
    });
    s.on('tc:final', (d) => {
      if (!on || !g) return;
      clearTimers(); duck(false);
      g.phase = 'final';
      myQ = null; moment = null; frozeAt = 0;
      $('screen-teamcrab').classList.remove('tc-moment', 'tc-aiming');
      $('tc-touch').classList.remove('live');
      document.querySelectorAll('#tc-tiles .tc-tile').forEach((x) => { x.disabled = true; });
      const mine = (d.boards || []).find((b) => b.id === g.b);
      msg('¡FINAL!', mine ? (mine.caught ? '¡Recuperaron las palabras!' : 'Fénec todavía tiene palabras…') : '', 'calm', A + 'crab-hero.webp');
      if (P() && P().final) P().final({ mode: 'phone', ms: d.ms, sub: mine && mine.caught ? '¡Lo tienen!' : '¿Se escapa Fénec?', play: (u, v) => sfx(u, v), buzz });
      else if (stage) stage.say('¡FINAL!', 'win');
    });
    s.on('tc:skip', () => { if (on && document.body.classList.contains('tc-ended')) skipCeremony(); });
    s.on('game-end', () => { if (!on) return; stopAll(); });
  }

  // ---------- the lobby card: the game in 3 pictures + who I play as ----------
  function lobby(headEl) {
    let box = $('tc-how');
    if (!headEl) { if (box) box.remove(); return; }
    const skin = localSkin();
    if (!box) {
      box = document.createElement('div');
      box.className = 'tc-how';
      box.id = 'tc-how';
      box.innerHTML = '<div class="tc-you"><span class="tc-youdome"><img id="tc-you-img" alt=""></span><span>Vas a pilotar el cangrejo como<b id="tc-you-name"></b></span></div>'
        + '<div class="tc-villain"><img id="tc-vil-img" src="' + A + 'anim/fenec-idle-still.webp" alt=""><span><b>¡Fénec se robó las palabras!</b>Atrápalo con tu tripulación</span></div>'
        + '<div class="tc-how-title">Así se juega</div><ol>'
        + '<li><div class="tc-step s1"><i class="t r">▲</i><i class="t b">◆</i><i class="t y ok">●</i><i class="t g">■</i><img class="hm" src="' + A + 'hammer.webp" alt=""></div><span>Responde bien<small>= tu martillo se carga 🔨</small></span></li>'
        + '<li><div class="tc-step s2"><img class="fx" src="' + A + 'fenec-idle.webp" alt=""><img class="hm" src="' + A + 'hammer.webp" alt=""><i class="fing"></i></div><span>¡Toca a Fénec!<small>tu martillo cae encima: ¡BONK!</small></span></li>'
        + '<li><div class="tc-step s3"><img src="' + A + 'fenec-spill.webp" alt=""><b>📚</b></div><span>Recupera las palabras<small>si fallas, ¡se lleva una!</small></span></li>'
        + '</ol>';
      headEl.after(box);
      // his idle loop (Canva, the light copy for phones) after the still first frame
      if (!reduced()) { const v = new Image(); v.onload = () => { const i = $('tc-vil-img'); if (i) i.src = v.src; }; v.src = A + 'anim/fenec-idle-lite.webp'; }
    }
    $('tc-you-img').src = S() ? S().head(skin) : '';
    $('tc-you-name').textContent = (window.Saga && window.Saga.labelOf && window.Saga.labelOf(skin)) || 'Dralingo';
  }

  // ---------- the end: my crew's ending, the ceremony, my card ----------
  let cer = null;
  function skipCeremony() { if (cer && cer.toCard) cer.toCard(); }
  function stopCeremony() { if (cer) { (cer.timers || []).forEach(clearTimeout); cer.timers = []; if (cer.stg) cer.stg.destroy(); cer = null; } }
  function end(data) {
    const box = $('screen-end');
    if (!box) return;
    const old = $('tc-cer');
    if (old) old.remove();
    if (cer && cer.timers) cer.timers.forEach(clearTimeout);
    if (cer && cer.stg) cer.stg.destroy();
    stopAll();
    placeMute(false);
    if (P() && P().hideFinal) P().hideFinal();
    const tc = (data && data.teamcrab) || {};
    const me = (data && data.me) || {};
    const bd = tc.board || { rows: [], stars: [], winners: [] };
    const rows = bd.rows || [];
    const byK = {};
    rows.forEach((r) => { byK[r.k] = r; });
    const root = document.createElement('div');
    root.className = 'tc-cer';
    root.id = 'tc-cer';
    const st = document.createElement('div');
    st.className = 'tc-cer-stage';
    const showEl = document.createElement('div');
    showEl.className = 'tc-cer-show';
    root.append(st, showEl);
    box.appendChild(root);
    document.body.classList.add('tc-ended');
    const stg = S() ? new (S().Stage)(st, { mode: 'phone' }) : null;
    const Cc = cer = { timers: [], stg };
    const at = (ms, fn) => Cc.timers.push(setTimeout(fn, ms));
    const H_ = HB();
    const figOf = (skin, pose) => (H_ ? H_.art(skin, pose, pose === 'win') : '');
    function scene(title, sub, figs, kind) {
      showEl.innerHTML = '';
      const c = document.createElement('div');
      c.className = 'tc-cer-card ' + (kind || '');
      const h = document.createElement('h2');
      h.textContent = title;
      c.appendChild(h);
      if (figs && figs.length) {
        const f = document.createElement('div');
        f.className = 'tc-cer-figs n' + Math.min(4, figs.length);
        figs.forEach(([skin, pose, label, src]) => {
          const d = document.createElement('div');
          d.className = 'tc-cer-fig';
          const i = document.createElement('img');
          i.alt = '';
          i.src = src || figOf(skin, pose);
          const n = document.createElement('span');
          n.textContent = label || '';
          d.append(i, n);
          f.appendChild(d);
        });
        c.appendChild(f);
      }
      if (sub) { const p = document.createElement('p'); p.textContent = sub; c.appendChild(p); }
      showEl.appendChild(c);
    }
    if (stg && rows.length) {
      stg.setCrew(rows.map((r) => ({ k: r.k, name: r.name, skin: r.skin })), me.k);
      stg.placeFen(2, false);
    }
    const STAR_ICO = { martillo: '🔨', trampa: '🪤', racha: '🔥' };
    const UNIT = { martillo: ['martillazo', 'martillazos'], trampa: ['trampa', 'trampas'], racha: ['seguida', 'seguidas'] };
    const starValue = (s) => s.value + ' ' + (UNIT[s.id] ? UNIT[s.id][s.value === 1 ? 0 : 1] : s.unit);
    const stars = bd.stars || [];
    let t = 150;
    // 1 · the ending of my crew: caught («¡Atrapado!», he runs off) or escaped (he kicks the crab to pieces)
    if (!me.guest) {
      at(t, () => {
        root.classList.add('ending');
        if (stg) { requestAnimationFrame(() => stg.fit()); later(60, () => stg.ending(!!bd.caught, (tc.words || []).length ? tc.words : null)); }
        if (bd.caught) {
          scene('¡ATRAPADO! 🎉', '¡Recuperaron ' + bd.words + ' palabras! (la meta era ' + bd.target + ') · «¡La próxima vez, Dralingo!»', null, 'win');
          later(250, () => sfx(A + 'thud.mp3', 0.9)); later(900, () => sfx('/assets/mochi/star.mp3', 0.7)); later(3300, () => sfx(K + 'sting-win.mp3', 0.8));
          buzz([60, 40, 120]);
        } else {
          scene('¡Fénec se escapó! 😜', 'Recuperaron ' + bd.words + ' de ' + bd.target + ' palabras · ¡la próxima lo atrapan!', null, 'lose');
          later(200, () => sfx(A + 'giggle.mp3', 0.8)); later(1350, () => sfx(A + 'crash.mp3', 0.95)); later(1500, () => sfx(A + 'clank.mp3', 0.6));
          buzz([40, 30, 40]);
        }
      });
      t += 5200;
    }
    at(t - 200, () => { root.classList.remove('ending'); if (stg) requestAnimationFrame(() => stg.fit()); });
    if (stars.length) {
      at(t, () => { scene('¡Estrellas bonus! ⭐', 'Para los mejores de la tripulación', null, 'gold'); sfx('/assets/mochi/star.mp3', 0.7); });
      t += 1500;
      stars.forEach((s) => {
        at(t, () => {
          const who = (s.winners || []).map((k) => byK[k]).filter(Boolean);
          scene((STAR_ICO[s.id] || '⭐') + ' ' + s.name, who.map((r) => r.name).join(' y ') + ' · ' + starValue(s), who.map((r) => [r.skin, 'ok', r.name]), 'gold');
          sfx('/assets/mochi/star.mp3', 0.6);
          if (who.some((r) => r.k === me.k)) buzz([40, 30, 40]);
        });
        t += 2100;
      });
    }
    at(t, () => { scene('¿Quién recuperó más palabras?', '🥁 …', rows.slice(0, 5).map((r) => [r.skin, 'idle', r.name]), 'drum'); sfx('/assets/mochi/drum.mp3', 0.7); });
    t += 1700;
    const winners = (bd.winners || []).map((k) => byK[k]).filter(Boolean);
    at(t, () => {
      if (winners.length) {
        scene(winners.length > 1 ? '¡Empate de campeones!' : '¡' + winners[0].name + ' gana tu tripulación!', winners.map((w) => w.words + (w.words === 1 ? ' palabra' : ' palabras')).join(' · ') + ' 📚', winners.map((w) => [w.skin, 'win', w.name]), 'win');
        sfx(K + 'sting-win.mp3', 0.85);
        if (me.won) buzz([60, 40, 60, 40, 200]);
        confetti(root);
      } else {
        scene('¡Nadie recuperó palabras!', 'Fénec se las llevó todas 😅 ¡La próxima es tuya!', [[null, null, 'Fénec', A + 'fenec-kick.webp']], 'win');
      }
    });
    t += 3400;
    Cc.toCard = () => { Cc.timers.forEach(clearTimeout); Cc.timers = []; root.classList.remove('ending'); if (stg) requestAnimationFrame(() => stg.fit()); card(); };
    at(t, () => Cc.toCard());
    if (me.guest) { Cc.timers.forEach(clearTimeout); Cc.timers = []; at(300, () => Cc.toCard()); }
    function card() {
      showEl.innerHTML = '';
      const c = document.createElement('div');
      c.className = 'tc-mycard' + (me.won ? ' won' : '');
      const f = document.createElement('img');
      f.className = 'tc-mycard-fig';
      f.alt = '';
      f.src = me.guest ? A + 'crab-hero.webp' : figOf(me.skin || (byK[me.k] && byK[me.k].skin) || 'dralingo', me.won ? 'win' : me.words ? 'ok' : 'idle');
      const h = document.createElement('h2');
      h.textContent = me.guest ? '¡Se acabó!' : me.won ? (winners.length > 1 ? '¡Empate en tu tripulación! 🦀' : '¡Ganaste tu tripulación! 🦀') : !me.words ? '¡La próxima es tuya!' : 'Puesto ' + (me.rank || '-') + ' de ' + (me.of || '-') + ' en tu tripulación';
      const l1 = document.createElement('p');
      l1.className = 'tc-line';
      if (me.guest) l1.textContent = 'Mira el proyector: ¡ahí están las tripulaciones! 👀';
      else if (me.words) { l1.innerHTML = 'Recuperaste: <b></b>'; l1.querySelector('b').textContent = me.words + (me.words === 1 ? ' palabra 📚' : ' palabras 📚'); }
      else l1.textContent = 'Responde para cargar tu martillo 🔨 y ¡toca a Fénec!';
      const l2 = document.createElement('p');
      l2.className = 'tc-small';
      const bits = [];
      if (me.bonks) bits.push(me.bonks + (me.bonks === 1 ? ' martillazo' : ' martillazos'));
      if (me.assists) bits.push(me.assists + (me.assists === 1 ? ' trampa' : ' trampas'));
      if (!me.guest && bd.caught != null) bits.push(bd.caught ? 'tu tripulación lo atrapó 🎉' : 'Fénec se escapó 😜');
      if (!me.guest && me.crewRank && me.crews > 1) bits.push('tripulación ' + me.crewRank + '.ª de ' + me.crews);
      l2.textContent = bits.join(' · ');
      c.append(f, h, l1, l2);
      if ((me.stars || []).length) {
        const sb = document.createElement('div');
        sb.className = 'tc-mystars';
        me.stars.forEach((id) => { const s = stars.find((x) => x.id === id); const b = document.createElement('span'); b.textContent = (STAR_ICO[id] || '⭐') + ' ' + (s ? s.name : id); sb.appendChild(b); });
        c.appendChild(sb);
      }
      const list = document.createElement('ol');
      list.className = 'tc-board-rank';
      rows.forEach((r) => {
        const li = document.createElement('li');
        if (r.k === me.k) li.className = 'me';
        const im = document.createElement('img');
        im.alt = '';
        im.src = S() ? S().head(r.skin) : '';
        const n = document.createElement('span');
        n.textContent = r.rank + '. ' + r.name;
        const sc = document.createElement('b');
        sc.textContent = r.words + ' 📚';
        li.append(im, n, sc);
        list.appendChild(li);
      });
      c.appendChild(list);
      const home = document.createElement('button');
      home.type = 'button';
      home.className = 'tc-home';
      home.textContent = '🏠 Inicio';
      home.addEventListener('click', () => { location.href = '/'; });
      c.appendChild(home);
      showEl.appendChild(c);
    }
  }
  function confetti(root) {
    if (reduced()) return;
    const box = document.createElement('div');
    box.className = 'tc-confetti';
    for (let i = 0; i < 28; i++) {
      const c = document.createElement('i');
      c.style.left = Math.random() * 100 + '%';
      c.style.animationDelay = (Math.random() * 0.6).toFixed(2) + 's';
      c.style.background = ['#f2c14e', '#e2483c', '#4fc3f7', '#ffffff', '#ff9ec2'][i % 5];
      box.appendChild(c);
    }
    root.appendChild(box);
    setTimeout(() => box.remove(), 3500);
  }

  const CrabPhone = window.CrabPhone = {
    init, lobby, end,
    frame: () => ({
      on, phase: g && g.phase, you: g && g.you, board: g && g.b, seats: seats.map((x) => x.name + ':' + (x.words || 0)), words, target, anger,
      ham: myH.st, q: myQ && myQ.text, answers: myQ && myQ.answers, paused, frenzy, moment, fen: stage ? stage.at : null,
      aiming: !!($('screen-teamcrab') && $('screen-teamcrab').classList.contains('tc-aiming')),
    }),
    answer: (i) => answer(i),
    // test hooks: tap where Fénec stands now (like a finger), or slam over a spot
    tapFenec: () => { if (!stage || !stage.spotX) return false; const x = stage.at / (stage.spotX.length - 1); slamNow(x); return true; },
    slamAt: (spot) => { slamNow(spot / 4); },
    aimAt: (spot) => { aimTo(spot / 4, true); },
    freeze: (v) => (CrabPhone._freeze ? CrabPhone._freeze(v) : 0),
    stage: () => stage,
  };
})();
