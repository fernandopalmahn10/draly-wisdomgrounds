// Draly Cangrejo · ¡Atrapa a Fénec! — the kid's phone (the product). player.js calls CrabPhone.init(...) once; the pastel
// skin (player-kingdoms-skin.js) routes the sounds, the music, the lobby card and the end screen here.
// v2 (his feedback 2026-10-23 after playing v1, his rules «Skill decides, never luck» + «Two rhythms»): rounds of two
// windows.
//   · QUESTION WINDOW: quick-fire questions; a right answer fills one slot of MY HAMMER METER (4 max, a clank); a wrong,
//     late or blind answer: El Péndulo EATS one (the hammer flies from my meter into his mouth, «¡Ñam!», he grows). The
//     beach stays on top, alive: the crab, Fénec, El Péndulo, the race for Capitán.
//   · «¡A martillar!» (1.6 s, the whole phone): MY ROLE. ⭐ Capitán (the crew's best answerer of the window) = I DRIVE the
//     crab (drag: it walks there, its claws follow) · 🔨 Martillero (I have charges) = I aim my claw (hold: my shadow on
//     the planks follows my finger inside the crab's reach) and let go = SLAM (one charge) · 👀 no charges = I watch and
//     cheer («Responde bien en la próxima ronda para subir al cangrejo»).
//   · PLAY WINDOW (10 s): Fénec runs his readable pattern (stands, crouches leaning, runs 2 spots); my hammer falls in
//     0.35 s where my shadow is; it bonks him if he is under it at the impact: the whole phone floods gold, words fly back.
//   · «¡Tiempo!» → the round's tally → the next question window · the last round ×2 → «¡FINAL!» → my crew's ending
//     (caught / escaped kicking the crab to pieces), the ceremony, my card.
// v3 «1 contra 3» (the teacher's pick in the lobby): each round the crew's best answerer who hasn't run yet IS Fénec
// («¡Eres Fénec por esta ronda!»): the video's camera (Fénec from behind on the dock, the crab and its hammers in front),
// drag = run there, double tap / swipe / «⚡ TURBO» = a dash (his right answers of the window, max 3), a hit stuns him
// 1 s; his phone is the truth (player:tc-run ~14 a second; player:tc-land = where he was when each hammer landed on his
// own screen). The others pilot the crab as in v2 against him. «¡Tiempo!»: a point a second he survived (+3 untouched).
// Test hooks: CrabPhone.frame(), .answer(i), .tapFenec(), .slamAt(x), .aimAt(x), .steerTo(x), .runTo(x), .dash(dir),
// .freeze(v), .stage().
(function () {
  'use strict';
  const A = '/assets/teamcrab/', H = '/assets/halcon/', K = '/assets/kingdoms/', PARTY = '/assets/party/';
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
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  let ctx = null, on = false, stage = null, lastBigFx = 0, bonkAt = 0, eatAt = 0;
  let g = null;                  // { id, you, b, phase }
  let seats = [];                // my crew [{ k, name, skin, words, on, robot }]
  let rules = { reach: 1, fall: 350, back: 420, max: 4, speed: 4.2, hit: 0.45 };
  let charges = 0, role = 'none', captain = null, myClaw = 'idle', guidedDone = { cap: false, mart: false, run: false };
  let gmode = 'crew', runner = null, dashes = 0, runT = null, lastRunX = null, lastRunAt = 0, myRunEnd = null;   // («1 contra 3»)
  let rd = { n: 0, total: 0, phase: 'none', final: false, until: 0, ms: 0 };
  let myQ = null, myLocked = false, paintedQid = null, qShownAt = 0;
  let words = 0, target = 1, anger = 0, endsAt = 0, pausedLeft = 0, paused = false, frenzy = false, streak = 0;
  let clockT = null, timers = [], lastMineAt = 0, race = {}, raceLead = null;
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
  function stopAll() { clearTimers(); if (clockT) { clearInterval(clockT); clockT = null; } stopRun(); }
  function ensureStage() { if (!stage && S()) stage = new (S().Stage)($('tc-stage'), Object.assign({ mode: 'phone' }, rules)); }
  const isRunner = () => !!(g && runner != null && runner === g.you);
  function setMode(m) {
    gmode = m === 'vs' ? 'vs' : 'crew';
    const scr = $('screen-teamcrab');
    if (scr) scr.classList.toggle('tc-vs', gmode === 'vs');
  }
  function show() { ctx.showScreen('teamcrab'); ensureStage(); placeMute(true); requestAnimationFrame(() => { if (stage) stage.fit(); }); }
  const refit = () => requestAnimationFrame(() => { if (stage) stage.fit(); });

  // ---------- the top: my crew, the round, the clock, the words we got back ----------
  function paintCrew() {
    const box = $('tc-crew');
    if (!box) return;
    box.innerHTML = '';
    seats.forEach((x) => {
      const r = document.createElement('div');
      r.className = 'tc-mate' + (g && x.k === g.you ? ' me' : '') + (x.on === false ? ' off' : '') + (x.k === captain ? ' cap' : '') + (x.robot ? ' bot' : '');
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
  function paintRound() {
    const r = $('tc-round');
    if (!r) return;
    r.textContent = rd.n ? (rd.final ? '¡Ronda final! ×2' : 'Ronda ' + rd.n + (rd.total ? ' de ' + rd.total : '')) : '';
    r.classList.toggle('final', !!rd.final);
  }
  function paintClock() {
    const now = Date.now();
    const left = endsAt ? (paused ? pausedLeft : endsAt - now) : 0;
    $('tc-clock').textContent = endsAt ? fmtClock(left) : '·:··';
    $('tc-clock').classList.toggle('hurry', !!endsAt && left <= 30000);
    // the window's bar on the stage (the question window, «¡A martillar!»)
    const wt = $('tc-wtimer');
    if (wt && rd.until) {
      const l = Math.max(0, (paused ? rd.pausedLeft || 0 : rd.until - now));
      wt.firstChild.style.width = Math.min(100, (100 * l) / Math.max(1, rd.ms)) + '%';
      wt.className = 'tc-wtimer ' + rd.phase + (l < 3000 ? ' hurry' : '');
      if (rd.phase === 'pw') { const s = Math.ceil(l / 1000); if (s <= 3 && s > 0 && wt.dataset.s !== String(s) && !paused) { wt.dataset.s = String(s); sfx(PARTY + (s % 2 ? 'tick-v2.mp3' : 'tock-v2.mp3'), 0.5); } }
    }
  }
  function runClock() { if (!clockT) clockT = setInterval(paintClock, 150); paintClock(); }

  // ---------- my hammer meter (4 slots): right = a slot fills; El Péndulo eats one on a miss ----------
  function paintMeter(pop) {
    const box = $('tc-slots');
    if (!box) return;
    const n = Math.max(0, Math.min(rules.max, charges));
    [...box.children].forEach((s, i) => {
      s.classList.toggle('full', i < n);
      if (pop === 'add' && i === n - 1 && !reduced()) { s.classList.remove('pop'); void s.offsetWidth; s.classList.add('pop'); }
    });
    $('tc-meter').classList.toggle('max', n >= rules.max);
    $('tc-meter').classList.toggle('turbo', isRunner() && (rd.phase === 'pwin' || rd.phase === 'pw'));
    if (isRunner() && (rd.phase === 'pwin' || rd.phase === 'pw')) { [...box.children].forEach((sl, i) => sl.classList.toggle('full', i < dashes)); $('tc-meter-n').textContent = '⚡ ' + dashes + (dashes === 1 ? ' turbo' : ' turbos'); return; }
    $('tc-meter-n').textContent = n + (n === 1 ? ' martillazo' : ' martillazos');
  }
  // the charge I lost flies from my meter into El Péndulo's mouth («¡Ñam!»)
  function eatFly(ate) {
    const box = $('tc-slots');
    if (!box || !stage) return;
    const slot = box.children[Math.max(0, Math.min(rules.max - 1, charges))];
    const a = slot.getBoundingClientRect(), p = stage.pend.getBoundingClientRect();
    if (!reduced() && ate) {
      const f = document.createElement('img');
      f.className = 'tc-eatfly';
      f.alt = '';
      f.src = A + 'hammer.webp';
      f.style.left = a.left + a.width / 2 + 'px';
      f.style.top = a.top + a.height / 2 + 'px';
      f.style.setProperty('--dx', Math.round(p.left + p.width / 2 - (a.left + a.width / 2)) + 'px');
      f.style.setProperty('--dy', Math.round(p.top + p.height * 0.72 - (a.top + a.height / 2)) + 'px');
      document.body.appendChild(f);
      setTimeout(() => f.remove(), 760);
    }
    stage.eat(anger, { x: -9999, y: -9999 }, false);              // (he gulps and grows; the charge already flew from my meter)
  }

  // ---------- the panel: the quiz, my role in the play window, a message ----------
  function mode(m) {
    const scr = $('screen-teamcrab');
    $('tc-quiz').classList.toggle('hidden', m !== 'quiz');
    $('tc-pad').classList.toggle('hidden', m !== 'pad');
    $('tc-msg').classList.toggle('hidden', m !== 'msg');
    scr.classList.toggle('tc-aiming', m === 'pad');
    $('tc-touch').classList.toggle('live', m === 'pad' && (role === 'cap' || role === 'mart' || role === 'runner'));
    refit();
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
  function setWindow(ph) {
    const scr = $('screen-teamcrab');
    ['qw', 'pwin', 'pw', 'pwout'].forEach((p) => scr.classList.toggle('tc-' + p, p === ph));
    refit();
  }
  function qbar() {
    const qt = $('tc-qtime');
    if (!qt || !myQ) return;
    const total = myQ.total || 8000, left = Math.max(0, Math.min(total, (myQ.until || Date.now() + total) - Date.now()));
    qt.style.setProperty('--ms', total + 'ms');
    qt.style.setProperty('--qd', (left - total) + 'ms');
    qt.classList.remove('run', 'done'); void qt.offsetWidth; qt.classList.add('run');
    if (myLocked || paused) qt.classList.add('done');
  }
  function seenQ() {
    if (!myQ || myQ.seenSent || document.visibilityState !== 'visible') return;
    myQ.seenSent = true;
    ctx.socket.emit('player:tc-seen', { pin: ctx.getPin(), qid: myQ.qid });
  }
  // what my panel shows now, from the round's window and my role
  function paintPanel() {
    if (!g || g.phase === 'final') return;
    if (g.phase !== 'play') return;
    if (rd.phase === 'qw') { paintMyQ(); return; }
    if (rd.phase === 'pwin' || rd.phase === 'pw') { paintRole(); return; }
    if (rd.phase === 'pwout') return;
    paintMyQ();
  }
  function paintMyQ() {
    mode('quiz');
    const box = $('tc-mq');
    if (!myQ) {
      box.classList.add('wait');
      $('tc-mq-text').textContent = rd.phase === 'qw' && rd.until - Date.now() < 2600 ? '¡Ya viene «¡A martillar!»! 🔨' : '…';
      $('tc-tiles').innerHTML = ''; $('tc-mq-img').classList.add('hidden');
      return;
    }
    box.classList.remove('wait');
    if (paintedQid === myQ.qid && $('tc-tiles').children.length) { qbar(); return; }
    paintedQid = myQ.qid;
    qShownAt = Date.now();
    qbar();
    seenQ();
    const qf = $('tc-qfeed');
    if (qf.classList.contains('ans')) { const age = Date.now() - (+qf.dataset.at || 0); if (age > 1100) { qf.textContent = ''; qf.className = 'tc-qfeed'; } else later(1100 - age, () => { if (+qf.dataset.at && Date.now() - +qf.dataset.at >= 1000) { qf.textContent = ''; qf.className = 'tc-qfeed'; } }); }
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
    if (!myQ || myLocked || paused || rd.phase !== 'qw') return;
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
  // the crew's race for Capitán during the question window (right answers only: nobody's miss shows)
  function paintRace() {
    const el = $('tc-race');
    if (!el) return;
    let best = null;
    if (raceLead != null) best = { k: raceLead, n: race[raceLead] || 1 };
    else Object.entries(race).forEach(([k, n]) => { if (n > 0 && (!best || n > best.n)) best = { k: +k, n }; });
    if (!best || rd.phase !== 'qw') { el.textContent = ''; el.className = 'tc-race'; return; }
    const me = g && best.k === g.you;
    el.textContent = me ? '⭐ ¡Vas para Capitán!' : '⭐ Capitán: ' + nameOf(best.k);
    el.className = 'tc-race' + (me ? ' me' : '');
  }

  // ---------- the play window: my role ----------
  function paintRole() {
    const hint = $('tc-padhint'), golpe = $('tc-golpe');
    if (role === 'runner') {
      mode('pad');
      $('screen-teamcrab').classList.remove('tc-captain');
      hint.innerHTML = '<b>🦊 ¡Eres Fénec! ¡Corre!</b><span>Arrastra el dedo a los lados · mira las sombras: ¡ahí cae el martillo! · doble toque = ⚡ turbo</span>';
      golpe.classList.remove('hidden');
      golpe.classList.add('turbo');
      golpe.textContent = dashes > 0 ? '⚡ ¡TURBO! (' + dashes + ')' : '⚡ Sin turbos';
      golpe.disabled = rd.phase !== 'pw' || dashes <= 0;
      coach();
      return;
    }
    golpe.classList.remove('turbo');
    if (role === 'watch') {
      msg('👀 Esta ronda miras', 'Responde bien en la próxima ronda para subir al cangrejo 🦀', 'watch', A + 'crab-hero.webp');
      $('tc-touch').classList.remove('live');
      return;
    }
    mode('pad');
    $('screen-teamcrab').classList.toggle('tc-captain', role === 'cap');
    const runName = runner != null && !isRunner() ? nameOf(runner) : '';
    if (role === 'cap') {
      hint.innerHTML = runName ? '<b>⭐ ¡Eres el Capitán!</b><span>Arrastra el dedo: el cangrejo camina. ¡Llévalo encima de ' + esc(runName) + ' (Fénec 🦊)!</span>' : '<b>⭐ ¡Eres el Capitán!</b><span>Arrastra el dedo: el cangrejo camina. ¡Llévalo debajo de Fénec!</span>';
      golpe.classList.toggle('hidden', charges <= 0);
      golpe.textContent = '🔨 ¡GOLPE! (' + charges + ')';
    } else {
      hint.innerHTML = '<b>🔨 ¡A martillar! · ' + charges + (charges === 1 ? ' martillazo' : ' martillazos') + '</b><span>' + (runName ? '🦊 ' + esc(runName) + ' corre: ¡cúbranle los dos lados! · ' : '') + 'Mantén el dedo: tu sombra apunta · suelta = ¡GOLPE!</span>';
      golpe.classList.remove('hidden');
      golpe.textContent = '🔨 ¡GOLPE!';
    }
    golpe.disabled = rd.phase !== 'pw' || charges <= 0 || myClaw !== 'armed';
    coach();
  }
  // the guided first action: a hand shows what to do (drag for the Capitán, tap Fénec for a martillero)
  function coach() {
    const h = $('tc-hand');
    if (!h) return;
    const need = rd.phase === 'pw' && ((role === 'cap' && !guidedDone.cap) || (role === 'mart' && !guidedDone.mart) || (role === 'runner' && !guidedDone.run));
    if (!need || !stage || !stage.g) { h.className = 'tc-hand hidden'; return; }
    if (role === 'cap' || role === 'runner') {
      h.style.left = Math.round(stage.g.W / 2 - 20) + 'px';
      h.style.top = Math.round(stage.g.feet - stage.g.fenH * 0.2) + 'px';
      h.className = 'tc-hand drag';
    } else {
      const fx = stage.f.mode === 'run' || stage.f.mode === 'crouch' ? stage.f.x1 : stage.fx;
      const x = stage.xPx(fx), y = stage.g.feet - stage.g.fenH * 0.5;
      h.style.left = Math.round(x - 20) + 'px';
      h.style.top = Math.round(y - 10) + 'px';
      h.className = 'tc-hand tap';
    }
  }
  let drag = null, lastSent = 0, mySlamAt = 0, lastWalkSfx = 0;
  // the crab's servos whirr and clank when it starts to walk (at most every 1.5 s)
  function walkSfx(vol) { const now = Date.now(); if (now - lastWalkSfx > 1500) { lastWalkSfx = now; sfx(A + 'clank.mp3', vol); } }
  const playing = () => !!(g && g.phase === 'play' && rd.phase === 'pw' && !paused);
  const canSlam = () => playing() && charges > 0 && myClaw === 'armed' && Date.now() - mySlamAt > rules.fall;
  function xOfClient(cx) {
    if (!stage || !stage.spotW) return 2;
    const r = $('tc-stage').getBoundingClientRect();
    return stage.xOfPx(cx - r.left);
  }
  function aimTo(x, force) {
    if (!stage || !g) return;
    const off = clamp(x - stage.crabX, -rules.reach, rules.reach);
    stage.aim(g.you, off);
    const now = Date.now();
    if (force || now - lastSent > 60) { lastSent = now; ctx.socket.emit('player:tc-aim', { pin: ctx.getPin(), x }); }
  }
  function steerTo(x, force) {
    if (!stage || !g || role !== 'cap' || !playing()) return;
    stage.steer(x);
    stage.light(g.you);
    if (Math.abs(x - stage.crabX) > 0.3) walkSfx(0.4);
    const now = Date.now();
    if (force || now - lastSent > 60) { lastSent = now; ctx.socket.emit('player:tc-steer', { pin: ctx.getPin(), x }); }
    if (!guidedDone.cap) { guidedDone.cap = true; coach(); }
  }
  function slamNow(x) {
    if (!canSlam()) { if (playing() && charges <= 0) noCharges(); return; }
    const sx = x != null ? clamp(x, Math.max(0, stage.crabX - rules.reach), Math.min(stage.MAXX || 4, stage.crabX + rules.reach)) : null;
    mySlamAt = Date.now();
    myClaw = 'fall';
    charges = Math.max(0, charges - 1);
    paintMeter();
    ctx.socket.emit('player:tc-slam', { pin: ctx.getPin(), x: sx });
    if (stage && g) stage.slam(g.you, sx, rules.fall);
    later(rules.fall - 20, () => sfx(A + 'thud.mp3', 0.9));
    buzz(20);
    later(rules.fall, () => buzz(45));
    sfx(K + 'whoosh.mp3', 0.45);
    ctx.markActivity();
    if (!guidedDone.mart) guidedDone.mart = true;
    $('tc-hand').className = 'tc-hand hidden';
    paintRole();
  }
  function shadowX(fallback) { const c = stage && g && stage.cr(g.you); return c && c.st === 'armed' ? Math.max(0, Math.min(4, stage.crabX + c.off)) : fallback; }
  function noCharges() {
    const p = $('tc-plus');
    p.textContent = 'Sin martillazos · ¡responde bien la próxima ronda!';
    p.className = 'tc-plus no';
    if (!reduced()) { void p.offsetWidth; p.classList.add('on'); }
  }
  // ---------- «1 contra 3»: I am Fénec ----------
  let lastTapAt = 0, lastTapX = 0;
  function runTo(x) {
    if (!stage || !isRunner() || !playing()) return;
    stage.runTarget(x);
    if (!guidedDone.run) { guidedDone.run = true; $('tc-hand').className = 'tc-hand hidden'; }
    ctx.markActivity();
  }
  // a dash (dir -1 / 1); without a direction: away from the nearest falling shadow, else the way I run
  function dashNow(dir) {
    if (!stage || !isRunner() || !playing() || dashes <= 0) return;
    if (!dir) {
      const mx = stage.myX();
      const near = stage.crew.filter((c) => c.st === 'fall').sort((a, b) => Math.abs(a.fallX - mx) - Math.abs(b.fallX - mx))[0];
      dir = near ? (near.fallX > mx ? -1 : 1) : (stage.me && stage.me.dir) || 1;
      if ((dir < 0 && mx < 0.3) || (dir > 0 && mx > (stage.MAXX || 4) - 0.3)) dir = -dir;
    }
    if (!stage.dash(dir)) return;
    dashes--;
    paintMeter(); paintRole();
    ctx.socket.emit('player:tc-dash', { pin: ctx.getPin(), dir });
    sfx(K + 'whoosh.mp3', 0.6);
    buzz(25);
    ctx.markActivity();
  }
  // my phone is the truth: where I am, ~14 times a second (and every 0.4 s while I stand)
  function runStream() {
    if (!stage || !isRunner() || !playing()) return;
    const x = stage.myX();
    const now = Date.now();
    if (x == null || (lastRunX != null && Math.abs(x - lastRunX) < 0.01 && now - lastRunAt < 400)) return;
    lastRunX = x; lastRunAt = now;
    ctx.socket.emit('player:tc-run', { pin: ctx.getPin(), x });
  }
  function startRun() { if (!runT) runT = setInterval(runStream, 70); }
  function stopRun() { if (runT) { clearInterval(runT); runT = null; } lastRunX = null; }
  function touchStart(e) {
    if (!playing()) return;
    e.preventDefault();
    try { e.target.setPointerCapture(e.pointerId); } catch (_) {}
    drag = { id: e.pointerId, t0: Date.now(), x0: e.clientX };
    if (role === 'runner') {
      const now = Date.now();
      if (now - lastTapAt < 320 && Math.abs(e.clientX - lastTapX) < 60) { lastTapAt = 0; const mx = stage ? stage.xPx(stage.myX()) + $('tc-stage').getBoundingClientRect().left : e.clientX; dashNow(e.clientX < mx ? -1 : 1); return; }
      lastTapAt = now; lastTapX = e.clientX;
      runTo(xOfClient(e.clientX));
      return;
    }
    if (role === 'cap') steerTo(xOfClient(e.clientX), true);
    else if (role === 'mart' && canSlam()) aimTo(xOfClient(e.clientX), true);
  }
  function touchMove(e) {
    if (!playing()) { drag = null; return; }
    if (!drag && e.pointerType === 'mouse') { if (role === 'mart' && canSlam()) aimTo(xOfClient(e.clientX)); return; }   // (a laptop: the shadow follows the mouse)
    if (!drag || e.pointerId !== drag.id) return;
    e.preventDefault();
    if (role === 'runner') { runTo(xOfClient(e.clientX)); return; }
    if (role === 'cap') steerTo(xOfClient(e.clientX));
    else if (role === 'mart' && canSlam()) aimTo(xOfClient(e.clientX));
  }
  function touchEnd(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (role === 'runner') {                                         // (a quick swipe = a dash that way)
      const dt = Date.now() - drag.t0, dx = e.clientX - drag.x0;
      drag = null;
      if (dt < 260 && Math.abs(dx) > 50) dashNow(dx < 0 ? -1 : 1);
      return;
    }
    drag = null;
    if (role === 'mart') slamNow(shadowX(xOfClient(e.clientX)));     // let go = the hammer comes down where its shadow is
  }

  // ---------- the big moments on the whole phone ----------
  function fxOn(kind, ms) {
    const r = $('tc-fx');
    if (!r) return;
    r.innerHTML = '';
    r.className = 'tc-fx ' + kind;
    if (!reduced()) {
      const n = kind === 'bonk' ? 16 : 10;
      for (let i = 0; i < n; i++) {
        const e = document.createElement('i');
        e.className = 'fly';
        e.textContent = kind === 'bonk' ? (i % 3 ? '★' : '✦') : kind === 'go' ? '🔨' : '';
        e.style.setProperty('--x', Math.round(Math.random() * innerWidth) + 'px');
        e.style.setProperty('--y', Math.round(innerHeight * (0.1 + Math.random() * 0.6)) + 'px');
        e.style.setProperty('--dx', Math.round((Math.random() - 0.5) * innerWidth * 0.7) + 'px');
        e.style.setProperty('--dy', Math.round((Math.random() - 0.7) * innerHeight * 0.5) + 'px');
        e.style.setProperty('--t', (1.0 + Math.random() * 0.8).toFixed(2) + 's');
        e.style.setProperty('--d', Math.round(Math.random() * 500) + 'ms');
        r.appendChild(e);
      }
      if (kind === 'bonk') { const scr = $('screen-teamcrab'); scr.classList.remove('tc-shake'); void scr.offsetWidth; scr.classList.add('tc-shake'); setTimeout(() => scr.classList.remove('tc-shake'), 700); }
    }
    clearTimeout(fxOn.t);
    fxOn.t = setTimeout(() => { r.classList.add('out'); setTimeout(() => { r.className = 'tc-fx hidden'; r.innerHTML = ''; }, 420); }, ms || 2000);
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
    bigCard.t = setTimeout(() => { b.className = 'tc-big hidden'; }, ms || 2200);
  }

  // ---------- the rounds ----------
  function onRound(d) {
    const was = rd.phase, wasFinal = rd.final, wasN = rd.n;
    rd = { n: d.n, total: d.total, phase: d.phase, final: !!d.final, ms: d.ms || 1, until: Date.now() + (d.ms || 0) };
    const wt = $('tc-wtimer'); if (wt) wt.dataset.s = '';
    paintRound();
    setWindow(d.phase);
    if (stage) stage.setPlaying(d.phase === 'pw' || d.phase === 'pwin');
    const again = d.phase === 'qw' && was === 'qw' && d.n === wasN;   // (the teacher's ±30 s re-planned this same window)
    if (d.phase === 'qw' && !again) { race = {}; raceLead = null; }
    if (d.phase === 'qw') {
      role = 'none'; captain = null; myRunEnd = null;
      if (runner != null) { runner = null; stopRun(); if (stage) stage.setRunner(null); }
      if (stage) { stage.setCaptain(null); stage.showReach(false); }
      $('screen-teamcrab').classList.remove('tc-captain');
      $('tc-hand').className = 'tc-hand hidden';
      paintCrew(); paintRace();
      if ((!again && (d.n > 1 || was === 'pwout')) || (again && d.final && !wasFinal)) {
        if (stage) stage.say(d.final ? '¡Ronda final! Martillazos dobles' : '¡A responder! Ronda ' + d.n, d.final ? 'final' : 'calm', 1400);
        sfx(K + 'whoosh.mp3', 0.4);
      }
      duck(false);
      paintMyQ();
    } else if (d.phase === 'pwin') {
      myQ = null;
      paintMeter();
      duck(true);
    } else if (d.phase === 'pw') {
      if (stage) stage.say('', null);
      if (isRunner()) { startRun(); if (stage) stage.say('¡CORRE! 🦊', 'go', 700); }
      paintRole();
    } else if (d.phase === 'pwout') {
      const wasRunner = isRunner();
      stopRun();
      runner = null;
      if (stage) stage.setRunner(null);
      $('tc-golpe').classList.remove('turbo');
      $('tc-touch').classList.remove('live');
      $('tc-hand').className = 'tc-hand hidden';
      if (stage) stage.showReach(false);
      const mine = (d.tally || []).find((x) => g && x.b === g.b);
      const n = mine ? mine.bonks : 0;
      if (wasRunner && myRunEnd) {
        const r = myRunEnd;
        msg('🦊 ¡Sobreviviste ' + r.secs + ' s!', '+' + r.pts + ' puntos' + (r.untouched ? ' · ¡ni te tocaron! +3 ⭐' : '') + (r.x2 ? ' · ×2' : '') + ' · ahora, ¡a responder!', 'win', A + 'fenec-laugh.webp');
      } else if (gmode === 'vs' && myRunEnd && myRunEnd.k !== (g && g.you)) {
        const r = myRunEnd;
        msg('¡Tiempo! ⏱', n ? '¡' + n + (n === 1 ? ' martillazo' : ' martillazos') + ' a Fénec! · ' + nameOf(r.k) + ' aguantó ' + r.secs + ' s' : nameOf(r.k) + ' se salvó: ' + r.secs + ' s sin que lo tocaran · ¡a responder!', n ? 'win' : 'calm', n ? A + 'fenec-spill.webp' : A + 'fenec-laugh.webp');
      } else
      msg('¡Tiempo! ⏱', n ? '¡' + n + (n === 1 ? ' martillazo' : ' martillazos') + ' a Fénec esta ronda! · Ahora, ¡a responder!' : 'Fénec se salvó esta ronda… ¡a responder y a cargar martillazos!', n ? 'win' : 'calm', n ? A + 'fenec-spill.webp' : A + 'fenec-laugh.webp');
      if (stage) stage.say('¡Tiempo!', 'calm', 1200);
      sfx(H + 'pop.mp3', 0.5);
      duck(false);
    }
    paintClock();
  }
  // «¡A martillar!»: my role takes over the phone for a beat
  function onRoles(d) {
    captain = d.captain;
    runner = d.runner != null ? d.runner : null;
    const mine = (d.mart || []).find((x) => g && x.k === g.you);
    role = isRunner() ? 'runner' : g && d.captain === g.you ? 'cap' : mine ? 'mart' : 'watch';
    if (role === 'runner') { dashes = d.dashes || 0; charges = Math.max(0, charges - dashes); }
    if (mine) charges = mine.charges;
    myClaw = mine ? 'armed' : 'idle';
    paintMeter();
    if (stage) {
      stage.setRunner(runner, role === 'runner', d.rx, runner != null ? nameOf(runner) : '', runner != null ? skinOf(runner) : null);
      stage.setCaptain(d.captain);
      (d.mart || []).forEach((x) => stage.claw(x.k, 'armed', x.off, x.charges));
      if (d.crab != null) stage.crabTo(d.crab, d.crab);
      stage.showReach(role === 'mart' || (role === 'cap' && charges > 0));
    }
    paintCrew();
    const capName = d.captain != null ? (g && d.captain === g.you ? 'Tú' : nameOf(d.captain)) : null;
    fxOn('go', 1400);
    sfx(A + 'clank.mp3', 0.8);
    later(120, () => sfx(H + 'start.mp3', 0.6));
    buzz(role === 'watch' ? 20 : [40, 30, 60]);
    const runName = runner != null && role !== 'runner' ? nameOf(runner) : '';
    if (role === 'runner') bigCard(A + 'fenec-back.webp', '🦊 ¡Eres Fénec por esta ronda!', '¡Fuiste el mejor! Corre: arrastra el dedo · ⚡ ' + dashes + (dashes === 1 ? ' turbo' : ' turbos') + ' (doble toque)', 'gold me', 2000);
    else if (role === 'cap') bigCard(S() ? S().head(skinOf(g.you)) : null, '⭐ ¡Eres el Capitán!', runName ? '🦊 ' + runName + ' es Fénec: ¡llévale el cangrejo encima!' : 'Fuiste el mejor: ¡tú manejas el cangrejo!', 'gold me', 1600);
    else if (role === 'mart') bigCard(A + 'hammer.webp', runName ? '🦊 ¡' + runName + ' es Fénec!' : '¡A martillar! 🔨 ×' + charges, runName ? '¡Martíllalo! 🔨 ×' + charges + (capName ? ' · ⭐ Capitán: ' + capName : '') : capName ? '⭐ Capitán: ' + capName : 'Toca a Fénec cuando tu sombra esté sobre él', 'gold', 1600);
    else bigCard(A + 'crab-hero.webp', '¡A martillar!', 'Esta ronda miras · responde bien para subir al cangrejo', 'calm', 1600);
    if (role === 'runner') { msg('🦊 ¡Prepárate para correr!', 'Mira las sombras de los martillos: ¡ahí caen!', 'go', A + 'fenec-back.webp'); sfx(A + 'giggle.mp3', 0.5); return; }
    msg('¡A martillar! 🔨', role === 'cap' ? '⭐ Tú manejas el cangrejo' : role === 'mart' ? 'Tienes ' + charges + (charges === 1 ? ' martillazo' : ' martillazos') : '👀 Esta ronda miras', 'go', A + 'hammer.webp');
  }

  // ---------- the events ----------
  function applyInit(d) {
    if (!d) return;
    const fresh = !g || g.id !== d.id;
    if (d.rules) rules = Object.assign(rules, d.rules);
    setMode(d.mode);
    g = { id: d.id, you: d.you ? d.you.k : null, b: d.board ? d.board.id : null, phase: d.phase };
    show();
    if (stage && d.rules) Object.assign(stage.o, d.rules);
    if (fresh) { myQ = null; streak = 0; race = {}; guidedDone = { cap: false, mart: false, run: false }; if (stage) stage.reset(); }
    paused = !!d.paused;
    $('tc-pause').classList.toggle('hidden', !paused);
    if (stage) stage.setPaused(paused);
    if (d.endsMs != null) { endsAt = Date.now() + d.endsMs; pausedLeft = d.endsMs; }
    frenzy = !!d.frenzy;
    document.body.classList.toggle('tc-frenzy', frenzy);
    $('tc-frenzy').classList.toggle('hidden', !frenzy);
    if (d.round) { rd = { n: d.round.n, total: d.round.total, phase: d.round.phase, final: !!d.round.final, ms: Math.max(1, d.round.ms), until: Date.now() + d.round.ms, pausedLeft: d.round.ms }; paintRound(); setWindow(rd.phase); }
    const bd = d.board;
    if (bd) {
      seats = bd.seats.slice();
      words = bd.words; target = bd.target;
      anger = bd.anger || 0;
      captain = bd.captain;
      if (stage) {
        stage.setCrew(seats, g.you);
        stage.setCaptain(bd.captain);
        stage.crabTo(bd.crab, bd.crab, true);
        if (bd.fen) stage.fenec(bd.fen);
        (bd.claws || []).forEach((c) => stage.claw(c.k, c.st === 'fall' || c.st === 'wait' ? 'armed' : c.st, c.off, c.charges));
        stage.setAnger(anger);
        stage.setPlaying(rd.phase === 'pw' || rd.phase === 'pwin');
        runner = bd.runner != null && (rd.phase === 'pw' || rd.phase === 'pwin') ? bd.runner : null;
        stage.setRunner(runner, runner != null && runner === g.you, bd.rx, runner != null ? nameOf(runner) : '', runner != null ? skinOf(runner) : null);
        if (runner != null && bd.stunMs) stage.stunMe(bd.stunMs);
      }
    }
    if (d.you) {
      charges = d.you.charges || 0;
      myClaw = d.you.claw ? d.you.claw.st : 'idle';
      role = d.you.runner && (rd.phase === 'pw' || rd.phase === 'pwin') ? 'runner' : d.you.captain ? 'cap' : (rd.phase === 'pw' || rd.phase === 'pwin') ? (d.you.role || (myClaw !== 'idle' ? 'mart' : 'watch')) : 'none';
      dashes = d.you.dashes || 0;
      if (role === 'runner' && rd.phase === 'pw') startRun(); else stopRun();
      setWords(d.you.k, d.you.words || 0);
      if (stage) stage.showReach(rd.phase === 'pw' && (role === 'mart' || (role === 'cap' && charges > 0)));
    }
    paintMeter();
    paintCrew();
    paintSack();
    if (d.q) { if (!myQ || myQ.qid !== d.q.qid) { myQ = d.q; myQ.total = 8000; } myQ.until = Date.now() + (d.q.ms != null ? d.q.ms : 8000); }
    else myQ = null;
    if (d.phase === 'play') paintPanel();
    else if (d.phase === 'countdown' || d.phase === 'intro') msg('Draly Cangrejo', gmode === 'vs' ? '1 contra 3 · responde bien: el mejor es Fénec 🦊 y corre · los demás, ¡a martillar!' : 'Responde bien = +1 martillazo 🔨 · luego, ¡a martillar a Fénec!', 'calm', A + 'fenec-idle.webp');
    if (d.phase === 'play' || d.phase === 'intro') runClock();
    paintClock();
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
    $('tc-golpe').addEventListener('click', () => { if (role === 'runner') dashNow(0); else if (role === 'cap') slamNow(stage ? stage.crabX : null); else slamNow(null); });
    document.addEventListener('visibilitychange', () => { if (on && myQ && !$('tc-quiz').classList.contains('hidden')) seenQ(); });
    window.addEventListener('draly:elsewhere', () => { stopAll(); duck(false); setOn(false); });
    let lastReact = 0;
    document.querySelectorAll('#tc-reacts button').forEach((b) => b.addEventListener('click', () => {
      const now = Date.now();
      if (now - lastReact < 1200) return;
      lastReact = now;
      b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
      ctx.socket.emit('player:tc-react', { pin: ctx.getPin(), e: b.dataset.e });
      if (stage) stage.react(b.dataset.e, skinOf(g && g.you));
    }));
    s.on('state', (st) => {
      if (!st) return;
      if (st.gameType) setOn(st.gameType === 'teamcrab');
      if (!on) return;
      if (st.tcMode && st.tcMode !== gmode) { setMode(st.tcMode); if ($('tc-how')) lobbyText(); }
      if (st.state === 'lobby') {
        stopAll(); g = null; myQ = null; stopCeremony();
        placeMute(false);
        document.body.classList.remove('tc-ended', 'tc-frenzy');
        const old = $('tc-cer'); if (old) old.remove();
      }
      if (g && st.players) {
        const off = {};
        Object.values(st.players).forEach((p) => { off[String(p.name).toLowerCase()] = !!p.off; });
        let ch = false;
        seats.forEach((x) => { if (x.robot) return; const k = String(x.name).toLowerCase(); if (k in off && x.on === off[k]) { x.on = !off[k]; ch = true; if (stage) stage.setOn(x.k, x.on); } });
        if (ch) paintCrew();
      }
    });
    s.on('countdown', () => {
      if (!on) return;
      stopAll(); g = null; myQ = null; endsAt = 0; streak = 0; words = 0; charges = 0; role = 'none'; stopCeremony();
      document.body.classList.remove('tc-ended', 'tc-frenzy');
      const old = $('tc-cer'); if (old) old.remove();
    });
    s.on('tc:init', (d) => { if (on || (d && d.id)) { setOn(true); applyInit(d); ctx.markActivity(); } });
    s.on('tc:seat', (d) => {
      if (!on || !d.board || !g || d.board.id !== g.b) return;
      seats = d.board.seats.slice();
      target = d.board.target;
      if (stage) { stage.setCrew(seats, g.you); (d.board.claws || []).forEach((c) => { if (c.k !== g.you) stage.claw(c.k, c.st, c.off, c.charges); }); }
      paintCrew(); paintSack();
    });
    s.on('tc:intro', (d) => {
      if (!on || !g) return;
      ctx.markActivity();
      g.phase = 'intro';
      if (stage) { stage.say('¡Atrapa a Fénec!', 'go', (d.ms || 2600) - 700); stage.taunt('idle', '¡No me atrapan! 😜', 1800); }
      msg('Draly Cangrejo', 'Responde bien = +1 martillazo 🔨 · si fallas, ¡El Péndulo se lo come!', 'calm', A + 'fenec-idle.webp');
      later((d.ms || 2600) - 700, () => { if (stage) stage.say('¡YA!', 'go', 700); sfx(H + 'start.mp3', 0.7); sfx(A + 'clank.mp3', 0.7); buzz(30); });
    });
    s.on('tc:play', (d) => {
      if (!on || !g) return;
      g.phase = 'play';
      endsAt = Date.now() + (d.endsMs || 0);
      runClock();
    });
    s.on('tc:round', (d) => { if (on && g && d) onRound(d); });
    s.on('tc:roles', (d) => { if (on && g && d.b === g.b) onRoles(d); });
    s.on('tc:q', (d) => {
      if (!on || !g || d.b !== g.b) return;
      ctx.markActivity();
      myQ = d;
      myQ.total = d.ms || 8000;
      myQ.until = Date.now() + (d.ms || 8000);
      if (d.charges != null) { charges = d.charges; paintMeter(); }
      if (rd.phase === 'qw') paintMyQ();
    });
    s.on('tc:ping', (d) => { if (on && d && d.t) ctx.socket.emit('player:tc-pong', { pin: ctx.getPin(), t: d.t }); });
    // «1 contra 3»: the runner's spot (relayed), his dashes, his seconds at «¡Tiempo!»
    s.on('tc:runner', (d) => { if (on && g && d.b === g.b && stage && !isRunner()) stage.runAt(d.x); });
    s.on('tc:dash', (d) => { if (on && g && d.b === g.b && stage && d.k !== g.you) { stage.dashFx(d.dir); sfx(K + 'whoosh.mp3', 0.3); } });
    s.on('tc:nodash', (d) => { if (!on || !isRunner()) return; dashes = Math.min(3, dashes + 1); if (stage && stage.me && d && d.x != null) { stage.me.x = stage.me.tx = d.x; stage.me.dashTo = null; } paintMeter(); paintRole(); });
    s.on('tc:runend', (d) => {
      if (!on || !g || d.b !== g.b) return;
      myRunEnd = d;
      setWords(d.k, d.words, true);
      if (d.k === g.you) { charges = d.charges != null ? d.charges : charges; dashes = 0; paintMeter(); sfx(d.untouched ? '/assets/mochi/star.mp3' : H + 'pop.mp3', 0.7); buzz(d.untouched ? [40, 30, 80] : 30); }
    });
    s.on('tc:qx', () => { if (!on || !g) return; myQ = null; if (rd.phase === 'qw') paintMyQ(); });
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
        charges = d.charges;
        paintMeter(d.gained ? 'add' : null);
        sfx(K + 'correct.mp3', 0.55);
        if (d.gained) sfx(A + 'clank.mp3', 0.5);
        buzz(20);
        $('tc-qfeed').textContent = d.gained ? '🔨 ¡+1 martillazo!' : '🔨 ¡Martillo lleno! ¡Y sumas para Capitán ⭐!';
        $('tc-qfeed').className = 'tc-qfeed ok ans';
        $('tc-qfeed').dataset.at = String(Date.now());
        cheer(streak);
      } else {
        if (ts[d.idx]) ts[d.idx].classList.add('no');
        if (ts[d.correctIdx]) ts[d.correctIdx].classList.add('ok');
        document.querySelectorAll('#tc-tiles .tc-tile').forEach((x) => { x.disabled = true; });
        $('tc-qtime').classList.add('done');
        sfx(K + 'wrong.mp3', 0.4);
        buzz([30, 40, 30]);
        const fb = $('tc-qfeed');
        fb.innerHTML = '';
        const sad = document.createElement('span');
        sad.className = 'sad';
        const im = document.createElement('img');
        im.alt = '';
        im.src = A + 'pendulo-angry.webp';
        const tx = document.createElement('span');
        tx.textContent = (d.late ? '¡Se acabó el tiempo! ' : d.tooFast ? '¡Muy rápido! Primero lee. ' : '¡Casi! ') + 'Era «' + d.correctText + '» · El Péndulo: ¡Ñam! 😋';
        sad.append(im, tx);
        fb.appendChild(sad);
        fb.className = 'tc-qfeed no ans';
        fb.dataset.at = String(Date.now());
      }
    });
    // my own miss: the charge flies from my meter into El Péndulo («¡Ñam!»); with none he still grows
    s.on('tc:mine', (d) => {
      if (!on || !g) return;
      lastMineAt = Date.now();
      if (d.ate) eatAt = Date.now();
      charges = d.charges;
      eatFly(!!d.ate);
      paintMeter();
      later(540, () => sfx(A + (d.ate ? 'chomp.mp3' : 'slurp.mp3'), 0.8));   // («¡Ñam!»: he bites my hammer; with none he just slurps)
    });
    s.on('tc:eat', (d) => {
      if (!on || !g || d.b !== g.b) return;
      anger = d.anger;
      // (my own miss plays from my meter: tc:mine arrives right after this one)
      later(80, () => { if (Date.now() - lastMineAt < 400) return; if (stage) stage.eat(d.anger, null, d.ate); later(540, () => sfx(A + (d.ate ? 'chomp.mp3' : 'slurp.mp3'), 0.45)); });
    });
    s.on('tc:calm', (d) => {
      if (!on || !g || d.b !== g.b) return;
      const was = anger;
      anger = d.anger;
      if (stage) stage.calm(d.anger);
      if (Math.floor(was) !== Math.floor(d.anger)) sfx(H + 'pop.mp3', 0.35);
    });
    s.on('tc:race', (d) => { if (!on || !g || d.b !== g.b) return; race[d.k] = d.rightQW; if (d.lead !== undefined) raceLead = d.lead; paintRace(); });
    // the crab walks (the server's x every ~0.1 s; the Capitán's finger relayed so everyone sees it start at once)
    s.on('tc:crab', (d) => { if (on && g && d.b === g.b && stage) stage.crabTo(d.x, d.tx); });
    s.on('tc:steer', (d) => { if (on && g && d.b === g.b && stage && d.k !== g.you) { if (Math.abs(d.tx - stage.crabX) > 0.3) walkSfx(0.25); stage.steer(d.tx); stage.light(d.k); } });
    s.on('tc:fen', (d) => { if (on && g && d.b === g.b && stage) { stage.fenec(d); if (role === 'mart' && !guidedDone.mart) coach(); } });
    s.on('tc:aim', (d) => { if (on && g && d.b === g.b && d.k !== g.you && stage) { stage.aim(d.k, d.off); stage.light(d.k); } });
    s.on('tc:claw', (d) => {
      if (!on || !g || d.b !== g.b) return;
      if (d.k === g.you) { myClaw = d.st; charges = d.charges; paintMeter(); if (rd.phase === 'pw' && role !== 'watch') paintRole(); }
      if (stage) stage.claw(d.k, d.st, null, d.charges);
    });
    s.on('tc:slam', (d) => {
      if (!on || !g || d.b !== g.b) return;
      ctx.markActivity();
      if (d.k === g.you) { charges = d.charges; paintMeter(); if (stage) { if (Date.now() - mySlamAt > 600) stage.slam(g.you, d.x, d.ms); else stage.refall(g.you, d.x); } return; }
      if (isRunner() && d.sid) {
        // (my verdict: where I was when it landed on MY screen; the server believes it)
        const land = () => {
          const x = stage ? stage.myX() : null;
          if (x == null) return;
          ctx.socket.emit('player:tc-land', { pin: ctx.getPin(), sid: d.sid, x });
          if (Math.abs(x - d.x) >= rules.hit) dodged();
        };
        if (stage) { stage.slam(d.k, d.x, d.ms, land); stage.charges(d.k, d.charges); } else later(d.ms || 750, land);
        later((d.ms || 750) - 20, () => sfx(A + 'thud.mp3', 0.7));
        buzz(15);
        return;
      }
      if (stage) { stage.slam(d.k, d.x, d.ms); stage.charges(d.k, d.charges); }
      later((d.ms || 350) - 20, () => sfx(A + 'thud.mp3', 0.45));
    });
    s.on('tc:impact', (d) => {
      if (!on || !g || d.b !== g.b) return;
      if (d.k === g.you && !d.hit) {
        const p = $('tc-plus');
        p.textContent = d.runner != null ? '¡Se escapó! Cúbranle los dos lados 🔨🔨' : '¡Fallaste! Mira dónde para Fénec 👀';
        p.className = 'tc-plus no';
        if (!reduced()) { void p.offsetWidth; p.classList.add('on'); }
      }
    });
    s.on('tc:taunt', (d) => {
      if (!on || !g || d.b !== g.b || !stage) return;
      stage.taunt(d.line);
      if (d.line === 'miss' || d.line === 'miss2') later(150, () => sfx(A + 'giggle.mp3', 0.4));
    });
    // a BONK on my crew: the whole phone floods gold, Fénec flat, the words fly back
    s.on('tc:bonk', (d) => {
      if (!on || !g || d.b !== g.b) return;
      ctx.markActivity();
      if (d.runner != null && d.runner === g.you) {
        if (stage && stage.me && d.x != null) { stage.me.x = stage.me.tx = d.x; stage.me.dashTo = null; }   // (where the server judged me)
        const bk0 = seat(d.k);
        if (bk0) setWords(d.k, (bk0.words || 0) + d.pts, true);
        if (stage) stage.stunMe(d.ms, d.flying);
        bigCard(A + 'fenec-bonk.webp', '💫 ¡Te dieron!', '¡Arriba y a correr! Esquiva la próxima sombra', 'calm', 1300);
        sfx(A + 'thud.mp3', 1);
        later(250, () => sfx(A + 'giggle.mp3', 0.4));
        buzz([80, 40, 80]);
        return;
      }
      const meB = d.k === g.you;
      const meA = (d.assists || []).includes(g.you);
      const meC = d.cap === g.you;
      words = d.words; target = d.target;
      paintSack('pop');
      const bk = seat(d.k);
      if (bk) setWords(d.k, (bk.words || 0) + d.pts, true);
      (d.assists || []).forEach((k) => { const x = seat(k); if (x) setWords(k, (x.words || 0) + 1, true); });
      if (d.cap != null) { const x = seat(d.cap); if (x) setWords(d.cap, (x.words || 0) + 1, true); }
      bonkAt = Date.now();
      if (stage) stage.bonk(d.k, d.flying, d.pts, d.ms, d.x);
      if (meB || meA || meC || Date.now() - lastBigFx > 5000) { lastBigFx = Date.now(); fxOn('bonk', 1300); }   // (restraint: a crewmate's bonks never stack into noise)
      sfx(A + 'thud.mp3', 1);
      later(90, () => sfx(H + 'pop.mp3', 0.8));
      later(600, () => sfx('/assets/mochi/star.mp3', 0.75));
      buzz(meB ? [60, 40, 120] : 50);
      const who = bk ? bk.name : '';
      if (meB) bigCard(S() ? S().head(skinOf(g.you)) : null, '¡BONK! +' + d.pts + ' 📚', d.x2 ? '¡Ronda final: doble!' : '¡Le diste a Fénec! Las palabras vuelven', 'gold me', 1800);
      else if (meC) bigCard(S() ? S().head(skinOf(g.you)) : null, '¡Buen manejo, Capitán! +1 📚', who + ' le dio · ¡tú llevaste el cangrejo!', 'gold', 1800);
      else if (meA) bigCard(S() ? S().head(skinOf(g.you)) : null, '¡Tu trampa funcionó! +1 📚', who + ' le dio · ¡tu martillo le tapaba la salida!', 'gold', 1800);
      else bigCard(S() ? S().head(skinOf(d.k)) : null, '¡' + who + ' le dio a Fénec!', '+' + d.pts + (d.runner != null ? ' puntos 📚' : ' palabras para la tripulación 📚'), 'gold', 1800);
    });
    s.on('tc:full', () => {
      if (!on || !g) return;
      if (P() && P().news) P().news('¡Bolsa llena! 🎒 ¡Lo atraparon!', { sub: 'Sigan: cada martillazo suma al récord de su tripulación', kind: 'win', ms: 2400 });
      sfx(K + 'sting-win.mp3', 0.6);
    });
    s.on('tc:noslam', (d) => {
      if (!on || !d) return;
      if (d.why === 'wait' || d.why === 'closed') { charges = Math.min(rules.max, charges + 1); mySlamAt = 0; myClaw = d.why === 'wait' ? 'armed' : myClaw; paintMeter(); if (rd.phase === 'pw') paintRole(); }
    });
    s.on('tc:react', (d) => { if (on && g && d.b === g.b && stage && d.k !== g.you) stage.react(d.e, skinOf(d.k)); });
    s.on('tc:frenzy', (d) => {
      if (!on || !g) return;
      frenzy = !d.off;
      document.body.classList.toggle('tc-frenzy', frenzy);
      $('tc-frenzy').classList.toggle('hidden', !frenzy);
      if (frenzy) {
        if (P() && P().news) P().news('¡Ronda final! 🌅', { sub: 'Cada martillazo vale doble', kind: 'alarm', ms: 2400 });
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
      if (paused) { pausedLeft = endsAt - Date.now(); rd.pausedLeft = rd.until - Date.now(); }
      $('tc-pause').classList.toggle('hidden', !paused);
      if (stage) stage.setPaused(paused);
      if (!paused) qbar();
    });
    s.on('tc:final', (d) => {
      if (!on || !g) return;
      clearTimers(); duck(false);
      stopRun(); runner = null; if (stage) stage.setRunner(null);
      g.phase = 'final';
      myQ = null;
      $('screen-teamcrab').classList.remove('tc-aiming', 'tc-captain');
      $('tc-touch').classList.remove('live');
      $('tc-hand').className = 'tc-hand hidden';
      if (stage) { stage.setPlaying(false); stage.showReach(false); }
      document.querySelectorAll('#tc-tiles .tc-tile').forEach((x) => { x.disabled = true; });
      const mine = (d.boards || []).find((b) => b.id === g.b);
      const vsEnd = d.mode === 'vs' || gmode === 'vs';
      msg('¡FINAL!', vsEnd ? '¿Quién corrió mejor? ¿Quién martilló más?' : mine ? (mine.caught ? '¡Recuperaron las palabras!' : 'Fénec todavía tiene palabras…') : '', 'calm', A + 'crab-hero.webp');
      if (P() && P().final) P().final({ mode: 'phone', ms: d.ms, sub: vsEnd ? '¡Se acabó la carrera!' : mine && mine.caught ? '¡Lo tienen!' : '¿Se escapa Fénec?', play: (u, v) => sfx(u, v), buzz });
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
        + '<li><div class="tc-step s1"><i class="t r">▲</i><i class="t b">◆</i><i class="t y ok">●</i><i class="t g">■</i><img class="hm" src="' + A + 'hammer.webp" alt=""></div><span>Responde bien<small>= +1 martillazo 🔨</small></span></li>'
        + '<li><div class="tc-step s2"><img class="pd" src="' + A + 'pendulo-eat.webp" alt=""><img class="hm" src="' + A + 'hammer.webp" alt=""></div><span>Si te equivocas…<small>El Péndulo se come tu martillazo</small></span></li>'
        + '<li><div class="tc-step s3"><img class="fx" src="' + A + 'fenec-idle.webp" alt=""><img class="hm" src="' + A + 'hammer.webp" alt=""><i class="fing"></i></div><span>¡A martillar!<small>toca a Fénec: ¡BONK! · el mejor es ⭐ Capitán y mueve el cangrejo</small></span></li>'
        + '</ol>';
      headEl.after(box);
      lobbyText();
      // his idle loop (Canva, the light copy for phones) after the still first frame
      if (!reduced()) { const v = new Image(); v.onload = () => { const i = $('tc-vil-img'); if (i) i.src = v.src; }; v.src = A + 'anim/fenec-idle-lite.webp'; }
    }
    $('tc-you-img').src = S() ? S().head(skin) : '';
    $('tc-you-name').textContent = (window.Saga && window.Saga.labelOf && window.Saga.labelOf(skin)) || 'Dralingo';
  }

  // the lobby card's words for the mode the teacher picked
  function lobbyText() {
    const box = $('tc-how');
    if (!box) return;
    const vs = gmode === 'vs';
    box.classList.toggle('vs', vs);
    const vb = box.querySelector('.tc-villain span');
    if (vb) vb.innerHTML = vs ? '<b>Hoy: 1 contra 3 🦊</b>Cada ronda, uno es Fénec y los demás lo martillan' : '<b>¡Fénec se robó las palabras!</b>Atrápalo con tu tripulación';
    const li = box.querySelectorAll('ol li');
    if (li[0]) li[0].querySelector('span').innerHTML = vs ? 'Responde bien<small>= +1 martillazo 🔨 o +1 turbo ⚡</small>' : 'Responde bien<small>= +1 martillazo 🔨</small>';
    if (li[2]) {
      const st = li[2].querySelector('.tc-step');
      if (st) { const im = st.querySelector('img.fx'); if (im) im.src = A + (vs ? 'fenec-back.webp' : 'fenec-idle.webp'); st.classList.toggle('vs', vs); }
      li[2].querySelector('span').innerHTML = vs ? '¡El mejor es Fénec! 🦊<small>arrastra para correr · esquiva las sombras · los demás, ¡a martillarlo!</small>' : '¡A martillar!<small>toca a Fénec: ¡BONK! · el mejor es ⭐ Capitán y mueve el cangrejo</small>';
    }
    const you = box.querySelector('.tc-you > span');
    if (you && you.firstChild && you.firstChild.nodeType === 3) you.firstChild.textContent = vs ? 'Vas a jugar (cangrejo y Fénec) como' : 'Vas a pilotar el cangrejo como';
  }
  function dodged() {
    const p = $('tc-plus');
    p.textContent = pick1(['¡Esquivado! 😎', '¡Ni te tocaron! 🦊', '¡Por poco! 💨']);
    p.className = 'tc-plus ok';
    if (!reduced()) { void p.offsetWidth; p.classList.add('on'); }
    sfx(A + 'giggle.mp3', 0.35);
  }
  const pick1 = (a) => a[Math.floor(Math.random() * a.length)];
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
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
    const bots = bd.robots || [];
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
    const stg = S() ? new (S().Stage)(st, Object.assign({ mode: 'phone' }, rules)) : null;
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
    if (stg && (rows.length || bots.length)) {
      stg.setCrew(rows.concat(bots.map((r) => Object.assign({ robot: true }, r))).map((r) => ({ k: r.k, name: r.name, skin: r.skin, robot: r.robot })), me.k);
      stg.placeFen(2);
    }
    const vsEnd = tc.mode === 'vs' || bd.mode === 'vs';
    const STAR_ICO = { martillo: '🔨', capitan: '⭐', trampa: '🪤', racha: '🔥', corredor: '🦊' };
    const UNIT = { martillo: ['martillazo', 'martillazos'], capitan: ['atrapada al volante', 'atrapadas al volante'], trampa: ['trampa', 'trampas'], racha: ['seguida', 'seguidas'], corredor: ['punto corriendo', 'puntos corriendo'] };
    const starValue = (s) => s.value + ' ' + (UNIT[s.id] ? UNIT[s.id][s.value === 1 ? 0 : 1] : s.unit);
    const stars = bd.stars || [];
    let t = 150;
    // 1 · the ending of my crew: caught («¡Atrapado!», he runs off) or escaped (he kicks the crab to pieces); in «1 contra
    // 3» my own race: how long I ran, how many hammers I landed
    if (!me.guest && vsEnd) {
      at(t, () => {
        const bits = [];
        if (me.runs) bits.push('Corriste ' + (me.survived || 0) + ' s como Fénec 🦊');
        if (me.bonks) bits.push(me.bonks + (me.bonks === 1 ? ' martillazo' : ' martillazos') + ' 🔨');
        scene('¡Se acabó la carrera! 🦊', bits.join(' · ') || '¡La próxima corres tú!', [[me.skin || 'dralingo', 'ok', 'Tú'], [null, null, 'Fénec', A + 'fenec-laugh.webp']], 'gold');
        sfx('/assets/mochi/star.mp3', 0.7);
      });
      t += 2600;
    } else if (!me.guest) {
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
    at(t, () => { scene(vsEnd ? '¿Quién hizo más puntos?' : '¿Quién recuperó más palabras?', '🥁 …', rows.slice(0, 5).map((r) => [r.skin, 'idle', r.name]), 'drum'); sfx('/assets/mochi/drum.mp3', 0.7); });
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
      else if (me.words) { l1.innerHTML = (vsEnd ? 'Tus puntos: ' : 'Recuperaste: ') + '<b></b>'; l1.querySelector('b').textContent = me.words + (vsEnd ? ' 📚' : me.words === 1 ? ' palabra 📚' : ' palabras 📚'); }
      else l1.textContent = vsEnd ? 'Responde bien: el mejor corre como Fénec 🦊 y los demás martillan 🔨' : 'Responde bien para ganar martillazos 🔨 y ¡toca a Fénec!';
      const l2 = document.createElement('p');
      l2.className = 'tc-small';
      const bits = [];
      if (me.bonks) bits.push(me.bonks + (me.bonks === 1 ? ' martillazo' : ' martillazos'));
      if (me.captained) bits.push('⭐ Capitán ' + me.captained + (me.captained === 1 ? ' vez' : ' veces'));
      if (me.assists) bits.push(me.assists + (me.assists === 1 ? ' trampa' : ' trampas'));
      if (me.runs) bits.push('🦊 ' + (me.survived || 0) + ' s corriendo');
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
      bots.forEach((r) => {                                       // (robot crewmates: in the crew, never ranked)
        const li = document.createElement('li');
        li.className = 'bot';
        const im = document.createElement('img');
        im.alt = '';
        im.src = S() ? S().head(r.skin) : '';
        const n = document.createElement('span');
        n.textContent = r.name + ' (robot)';
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
      round: rd.n, window: rd.phase, final: rd.final, role, captain, charges, claw: myClaw, q: myQ && myQ.text, answers: myQ && myQ.answers,
      paused, frenzy, fen: stage ? Math.round(stage.fx * 100) / 100 : null, fenMode: stage ? stage.f.mode : null, crab: stage ? Math.round(stage.crabX * 100) / 100 : null,
      aiming: !!($('screen-teamcrab') && $('screen-teamcrab').classList.contains('tc-aiming')),
      moment: Date.now() - bonkAt < 1100 ? 'bonk' : Date.now() - eatAt < 900 ? 'eat' : null,
      mode: gmode, runner, me: stage && stage.me ? Math.round(stage.me.x * 100) / 100 : null, dashes, stunned: !!(stage && stage.me && Date.now() < stage.me.stunUntil),
    }),
    answer: (i) => answer(i),
    // test hooks: like a finger — tap where Fénec stands now (or where he will land), slam at x, aim at x, steer to x
    tapFenec: () => { if (!stage) return false; const f = stage.f; const x = f.mode === 'run' || f.mode === 'crouch' ? f.x1 : stage.fx; slamNow(x); return true; },
    slamAt: (x) => { slamNow(x); },
    aimAt: (x) => { aimTo(x, true); },
    steerTo: (x) => { steerTo(x, true); },
    runTo: (x) => { runTo(x); },
    dash: (dir) => { dashNow(dir || 0); },
    freeze: (v) => (CrabPhone._freeze ? CrabPhone._freeze(v) : 0),
    stage: () => stage,
  };
})();
