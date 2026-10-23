// ¡No despiertes a Dralingo! — the kid's phone (the product). player.js calls DormilonPhone.init(...) once; the pastel
// skin (player-kingdoms-skin.js) routes the sounds, the music, the lobby card and the end screen here.
// v2 (his pick 2026-10-22, «Earn feathers, then pet with your finger»; his rule «Never call it done unless it FEELS like
// Mario Party»):
//   · MY TURN: the camera closes in: his sleeping face fills my phone (the close-up of js/dormilon-stage.js); I RUB his
//     head with my finger and the golden feather (with my face, like the glove of the video) follows it; every completed
//     back-and-forth rub = +1 (a feather spent, a soft woosh + pop, a sleepy squish, a buzz); a scribble = «¡Despacio!»
//     (+2 danger); a big 6-s countdown (red at 3), my feathers left, the big «¡Me retiro!». Out of feathers = done.
//   · NOT MY TURN (never a dead phone): quick questions from the class pack, each right answer = a feather that flies
//     into my quiver (max 6, the gang cheers a streak); my friend's turn plays live above (their feather moving on his
//     face as they rub, their «+1», the danger rising); before each turn the «¿Se despierta?» guess; reactions.
//   · the wake-up: he bolts up with the pillow, the gong, rays, the shake; the kid who woke him loses all their points.
//   · «¡FINAL!» → my board's ceremony: the bonus stars, «¿Quién gana tu tablero?», the winner by the bed, my card.
// Test hooks: DormilonPhone.frame(), .answer(i), .rub(n, gapMs), .stop(), .freeze(v).
(function () {
  'use strict';
  const A = '/assets/dormilon/', H = '/assets/halcon/', K = '/assets/kingdoms/', PARTY = '/assets/party/', MO = '/assets/monopoly/';
  const $ = (id) => document.getElementById(id);
  const S = () => window.DormStage;
  const HB = () => window.HalconBoard;
  const P = () => window.DralyParty || null;
  const C = () => window.DralingoCast || null;
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const sfx = (url, vol) => { const s = window.KingdomsSkin; if (s && s.sfx) s.sfx(url, vol); };
  const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (_) {} };
  const COLORS = ['red', 'blue', 'yellow', 'green'];
  const SHAPES = ['▲', '◆', '●', '■'];
  const MAXF = 6;
  // the music steps back during MY turn so the snore, the creaks and my heartbeat carry (player-kingdoms-skin.js musicVol)
  const duck = (low) => { const k = window.KingdomsSkin; if (k && k.musicVol) k.musicVol(low ? 0.08 : 0.32); };
  // Dralingo woken up: funny-grumpy, never scary (his personality: wise, super friendly — cast.md)
  const WAKE_LINES = ['¡¿QUIÉN ME DESPERTÓ?! ¡Soñaba con dumplings! 🥟', '¡Grrr! ¡Hasta un dragón sabio necesita su siesta! 😤', '¡Te vi con esa pluma! 😠', '¡Grrr… cinco minutitos más! 💢', '¡¿Otra vez cosquillas?! ¡Grrr!'];   // (v3: he wakes up ANGRY, funny-angry, never scary)
  const fmtClock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  let ctx = null, on = false, stage = null;
  let g = null;              // { id, you (k), b, phase }
  let seats = [];            // my board [{ k, name, skin, score, feathers, on }]
  let turn = null;           // { k, phase: 'pre'|'turn', until, guided, pats, total }
  let myQ = null, myLocked = false;
  let feathers = 3, streak = 0;
  let endsAt = 0, pausedLeft = 0, paused = false, frenzy = false, cue = 0, night = 1, guessed = null;
  let clockT = null, snoreT = null, timers = [];
  const later = (ms, fn) => { const t = setTimeout(fn, Math.max(0, ms)); timers.push(t); return t; };
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  const seat = (k) => seats.find((x) => x.k === k) || null;
  const nameOf = (k) => (seat(k) ? seat(k).name : '');
  const skinOf = (k) => (seat(k) ? seat(k).skin : 'dralingo');
  const mine = () => !!(g && turn && turn.k === g.you);
  const myName = () => ($('lobby-name') && $('lobby-name').textContent) || '';
  function localSkin() {
    let v = '';
    try { v = localStorage.getItem('dralyAvatar') || ''; } catch (_) {}
    return HB() ? HB().skinFor(v, myName()) : 'dralingo';
  }

  function setOn(v) {
    if (v === on) return;
    on = v;
    document.body.classList.toggle('dm-on', on);
    if (!on) { stopAll(); placeMute(false); }
  }
  // the platform's «🔊 Sonido» sits in the bedroom's corner while the game plays (never over the tiles or «¡Me retiro!»)
  let muteHome = null;
  function placeMute(inStage) {
    const b = $('mute-btn');
    if (!b) return;
    if (!muteHome) muteHome = { parent: b.parentNode, next: b.nextSibling };
    if (inStage) {
      const w = document.querySelector('#screen-dormilon .dm-stagewrap');
      if (w && b.parentNode !== w) w.appendChild(b);
      b.classList.add('dm-mute');
    } else {
      if (b.parentNode !== muteHome.parent) muteHome.parent.insertBefore(b, muteHome.next && muteHome.next.parentNode === muteHome.parent ? muteHome.next : null);
      b.classList.remove('dm-mute');
    }
  }
  function stopAll() { clearTimers(); stopSnore(); if (clockT) { clearInterval(clockT); clockT = null; } }

  // ---------- the screen ----------
  function ensureStage() {
    if (stage || !S()) return;
    stage = new (S().Stage)($('dm-stage'), { mode: 'phone' });
  }
  function show() {
    ctx.showScreen('dormilon');
    ensureStage();
    placeMute(true);
    requestAnimationFrame(() => { if (stage) stage.fit(); });
  }
  // my turn = the stage fills the phone (the close-up), the quiz panel steps away
  function setMyTurn(v) {
    const scr = $('screen-dormilon');
    if (!scr) return;
    scr.classList.toggle('dm-myturn', !!v);
    $('dm-turnhud').classList.toggle('hidden', !v);
    requestAnimationFrame(() => { if (stage) { stage.fit(); if (v) stage.featherAt(null, null, skinOf(g && g.you)); } });
  }
  function paintList() {
    const box = $('dm-list');
    if (!box) return;
    box.innerHTML = '';
    seats.forEach((x) => {
      const r = document.createElement('div');
      r.className = 'dm-row' + (turn && turn.k === x.k ? ' turn' : '') + (g && x.k === g.you ? ' me' : '') + (x.on === false ? ' off' : '');
      const i = document.createElement('img');
      i.alt = '';
      i.src = S() ? S().head(x.skin) : '';
      const n = document.createElement('span');
      n.className = 'dm-rn';
      n.textContent = g && x.k === g.you ? 'Tú' : x.name;
      const fe = document.createElement('i');
      fe.className = 'dm-rf';
      fe.id = 'dm-rf-' + x.k;
      fe.textContent = '🪶' + (x.feathers != null ? x.feathers : '');
      const sc = document.createElement('b');
      sc.textContent = x.score;
      sc.id = 'dm-sc-' + x.k;
      r.append(i, n, fe, sc);
      box.appendChild(r);
    });
  }
  function setScore(k, v, bump) {
    const x = seat(k);
    if (!x) return;
    x.score = v;
    const b = $('dm-sc-' + k);
    if (b) {
      b.textContent = v;
      if (bump && !reduced()) { b.classList.remove('bump', 'zero'); void b.offsetWidth; b.classList.add(bump); }
    }
    if (g && k === g.you) $('dm-me').textContent = v + ' ⭐';
  }
  function setSeatFeathers(k, n) {
    const x = seat(k);
    if (x) x.feathers = n;
    const e = $('dm-rf-' + k);
    if (e) e.textContent = '🪶' + n;
  }
  // my quiver: 6 slots, the gold ones are my feathers (in the quiz panel and in my turn's HUD)
  function paintQuiver(pop) {
    ['dm-quiver', 'dm-hudq'].forEach((id) => {
      const box = $(id);
      if (!box) return;
      if (box.childElementCount !== MAXF) { box.innerHTML = ''; for (let i = 0; i < MAXF; i++) { const s = document.createElement('i'); s.className = 'dm-qs'; box.appendChild(s); } }
      [...box.children].forEach((s, i) => { s.classList.toggle('full', i < feathers); s.classList.toggle('pop', !!pop && i === feathers - 1 && !reduced()); });
    });
    const t = $('dm-qcount');
    if (t) t.textContent = feathers >= MAXF ? '¡6 plumas, listo!' : feathers + ' de ' + MAXF;
    if (g) setSeatFeathers(g.you, feathers);
  }
  // a feather flies from the tile I got right into my quiver
  function flyFeather(fromEl) {
    if (reduced() || !fromEl) return;
    const to = $('dm-quiver');
    if (!to) return;
    const a = fromEl.getBoundingClientRect(), b = to.getBoundingClientRect();
    const f = document.createElement('img');
    f.src = A + 'feather.webp';
    f.alt = '';
    f.className = 'dm-flyf';
    f.style.left = (a.left + a.width / 2 - 22) + 'px';
    f.style.top = (a.top + a.height / 2 - 22) + 'px';
    document.body.appendChild(f);
    const dx = b.left + Math.min(b.width - 20, (feathers - 1) * (b.width / MAXF)) - (a.left + a.width / 2 - 22);
    const dy = b.top - (a.top + a.height / 2 - 22);
    f.animate([{ transform: 'translate(0,0) rotate(-30deg) scale(1.3)', opacity: 1 }, { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 60}px) rotate(160deg) scale(1)`, opacity: 1, offset: 0.55 }, { transform: `translate(${dx}px, ${dy}px) rotate(330deg) scale(0.6)`, opacity: 0.9 }], { duration: 620, easing: 'cubic-bezier(.3,.7,.4,1)' });
    setTimeout(() => f.remove(), 640);
  }
  // the question's time bar, drawn from its own deadline (myQ.until): a repaint, the rage or a pause never refill it
  let paintedQid = null, qShownAt = 0;
  function qbar() {
    const qt = $('dm-qtime');
    if (!qt || !myQ) return;
    const total = 15000, left = Math.max(0, Math.min(total, (myQ.until || Date.now() + total) - Date.now()));
    qt.style.setProperty('--ms', total + 'ms');
    qt.style.setProperty('--qd', (left - total) + 'ms');
    qt.classList.remove('run', 'done'); void qt.offsetWidth; qt.classList.add('run');
    if (myLocked) qt.classList.add('done');
  }
  // tell the server my question is on a visible screen (a pocketed / locked phone is never charged for a late one)
  function seenQ() {
    if (!myQ || myQ.seenSent || document.visibilityState !== 'visible') return;
    myQ.seenSent = true;
    ctx.socket.emit('player:dm-seen', { pin: ctx.getPin(), qid: myQ.qid });
  }
  // the board's wake-up froze my question's time on the server: the same here
  let frozeAt = 0;
  function freezeQ(on) {
    if (on) { if (!frozeAt) frozeAt = Date.now(); return; }
    if (frozeAt && myQ && myQ.until) myQ.until += Date.now() - frozeAt;
    frozeAt = 0;
  }
  // a wrong / late answer: the feather at the top of my quiver flies out and away («fsss»)
  function featherOut() {
    const q = $('dm-quiver');
    if (!q || reduced()) return;
    const slots = q.querySelectorAll('.dm-qs');
    const from = slots[Math.max(0, Math.min(slots.length - 1, feathers))] || q;
    const a = from.getBoundingClientRect();
    const fl = document.createElement('img');
    fl.src = A + 'feather.webp';
    fl.alt = '';
    fl.className = 'dm-outf';
    fl.style.left = (a.left + a.width / 2 - 20) + 'px';
    fl.style.top = (a.top + a.height / 2 - 20) + 'px';
    document.body.appendChild(fl);
    const dx = (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 60);
    fl.animate([{ transform: 'translate(0,0) rotate(0deg) scale(1.1)', opacity: 1 }, { transform: `translate(${dx * 0.4}px, -70px) rotate(${dx > 0 ? 140 : -140}deg) scale(1)`, opacity: 1, offset: 0.4 }, { transform: `translate(${dx}px, 90px) rotate(${dx > 0 ? 320 : -320}deg) scale(.7)`, opacity: 0 }], { duration: 900, easing: 'cubic-bezier(.3,.6,.5,1)' });
    setTimeout(() => fl.remove(), 920);
  }
  // the ANGRY wake-up on the whole phone: the screen floods red, sparks and anger marks fly around, the panel shakes
  let rageT = null;
  function rageOn(ms) {
    const r = $('dm-rage');
    if (!r) return;
    if (rageT) clearTimeout(rageT);
    r.innerHTML = '';
    if (!reduced()) {
      const W = innerWidth, Hh = innerHeight;
      for (let i = 0; i < 12; i++) {
        const e = document.createElement('i');
        e.className = 'fly';
        const x = Math.random() * W, y = Math.random() * Hh;
        e.style.setProperty('--x', Math.round(x) + 'px');
        e.style.setProperty('--y', Math.round(y) + 'px');
        e.style.setProperty('--dx', Math.round((Math.random() - 0.5) * W * 0.8) + 'px');
        e.style.setProperty('--dy', Math.round((Math.random() - 0.5) * Hh * 0.6) + 'px');
        e.style.setProperty('--t', (1.1 + Math.random() * 0.9).toFixed(2) + 's');
        e.style.setProperty('--d', Math.round(Math.random() * 900) + 'ms');
        r.appendChild(e);
      }
      // 💢 marks at the edges, never on a chip, the sound button, the top list, «−N», the word band or his face
      // (placed once the rage layout is on: the panel stepped aside, the stage re-fitted)
      const placeMarks = () => {
      const avoid = ['#dm-meter', '.muted-toggle', '.dm-top', '#dm-splash', '#dm-stage .dms-band', '#dm-stage .dms-bubble'].map((q) => document.querySelector(q))
        .filter((e) => e && e.offsetParent !== null).map((e) => e.getBoundingClientRect());
      if (stage && stage.angryPoints) {
        const sb = $('dm-stage').getBoundingClientRect(), ap = stage.angryPoints(1.07);
        const xs = [ap.eyeL[0], ap.eyeR[0], ap.mouth[0]], ys = [ap.eyeL[1] - 40, ap.mouth[1] + 40];
        avoid.push({ left: sb.left + Math.min(...xs) - 30, right: sb.left + Math.max(...xs) + 30, top: sb.top + Math.min(...ys), bottom: sb.top + Math.max(...ys) });
      }
      const sw = document.querySelector('.dm-stagewrap');
      if (sw) { const w = sw.getBoundingClientRect(); avoid.push({ left: w.left + w.width / 2 - 120, right: w.left + w.width / 2 + 120, top: w.top + w.height * 0.66 - 55, bottom: w.top + w.height * 0.66 + 55 }); }   // («−N 😱» lands there)
      const free = (x, y) => avoid.every((a) => x + 30 < a.left || x - 30 > a.right || y + 30 < a.top || y - 30 > a.bottom);
      const spots = [[0.08, 0.36], [0.92, 0.34], [0.08, 0.6], [0.92, 0.58], [0.1, 0.8], [0.9, 0.78], [0.3, 0.9], [0.7, 0.9], [0.5, 0.26]]
        .map(([fx, fy]) => [fx * innerWidth, fy * innerHeight]).filter(([x, y]) => free(x, y)).slice(0, 4);
      spots.forEach(([x, y], i) => {
        const mk = document.createElement('b');
        mk.className = 'mark';
        mk.textContent = '💢';
        mk.style.setProperty('--x', Math.round(x - 22) + 'px');
        mk.style.setProperty('--y', Math.round(y - 22) + 'px');
        mk.style.setProperty('--d', (i * 230) + 'ms');
        r.appendChild(mk);
      });
      };
      requestAnimationFrame(() => requestAnimationFrame(placeMarks));
      const scr = $('screen-dormilon');
      scr.classList.remove('dm-rageshake'); void scr.offsetWidth; scr.classList.add('dm-rageshake');
      setTimeout(() => scr.classList.remove('dm-rageshake'), 1150);
    }
    r.className = 'dm-rage';
    const scr2 = $('screen-dormilon');
    scr2.classList.add('dm-raging');                             // (the panel steps aside: his angry face fills the phone)
    freezeQ(true);
    requestAnimationFrame(() => { if (stage) stage.fit(); });
    rageT = setTimeout(() => { r.classList.add('out'); scr2.classList.remove('dm-raging'); requestAnimationFrame(() => { if (stage) stage.fit(); }); rageT = setTimeout(rageOff, 520); }, ms || 3300);
    // (the server keeps the board's quiz waiting until the new night: dm:night thaws my question's time)
  }
  function rageOff() {
    if (rageT) { clearTimeout(rageT); rageT = null; }
    const r = $('dm-rage');
    if (r) { r.className = 'dm-rage hidden'; r.innerHTML = ''; }
    const scr3 = $('screen-dormilon');
    if (scr3 && scr3.classList.contains('dm-raging')) { scr3.classList.remove('dm-raging'); requestAnimationFrame(() => { if (stage) stage.fit(); }); }
    requestAnimationFrame(qbar);
    if (stage) stage.calm();
  }
  let pausedTurn = 0;
  function paintClock() {
    const left = endsAt ? (paused ? pausedLeft : endsAt - Date.now()) : 0;
    $('dm-clock').textContent = endsAt ? fmtClock(left) : '·:··';
    $('dm-clock').classList.toggle('hurry', !!endsAt && left <= 30000);
    if (turn && turn.phase === 'turn') {
      const tl = paused ? pausedTurn : turn.until - Date.now();
      const sec = Math.max(0, Math.ceil(tl / 1000));
      const big = $('dm-count');
      if (big && big.dataset.s !== String(sec)) {
        big.dataset.s = String(sec);
        big.textContent = sec;
        big.classList.toggle('hurry', sec <= 3);
        if (!reduced()) { big.classList.remove('tick'); void big.offsetWidth; big.classList.add('tick'); }
        if (mine() && sec <= 3 && sec > 0 && !paused) sfx(PARTY + (sec % 2 ? 'tick-v2.mp3' : 'tock-v2.mp3'), 0.6);
      }
    }
  }
  function runClock() { if (!clockT) clockT = setInterval(paintClock, 200); paintClock(); }
  function paintNight() { $('dm-night').textContent = 'Noche ' + night; }

  // the snore (Higgsfield sounds): every few seconds while he sleeps, louder when he gets restless
  function snoreLoop() {
    stopSnore();
    const go = () => {
      if (!on || paused) { snoreT = setTimeout(go, 1500); return; }
      if (cue < 4 && g && g.phase === 'play') sfx(A + (cue >= 1 ? 'snore-loud-h1.mp3' : 'snore-h1.mp3'), cue >= 2 ? 0.6 : cue >= 1 ? 0.45 : mine() ? 0.4 : 0.3);
      snoreT = setTimeout(go, cue >= 3 ? 2600 : cue >= 1 ? 3200 : 4100);
    };
    snoreT = setTimeout(go, 1200);
  }
  function stopSnore() { if (snoreT) { clearTimeout(snoreT); snoreT = null; } }
  function setCue(n) {
    const was = cue;
    cue = n;
    if (stage) stage.setCue(n);
    if (n >= 2 && n > was && n < 4) sfx(A + (n >= 3 ? 'creak2.mp3' : 'creak.mp3'), 0.6);
    const st = $('dm-stop');
    if (st) st.className = 'dm-stop c' + Math.min(3, n);
    if (mine() && n >= 3 && n > was && n < 4) { sfx('/assets/escape/heartbeat.mp3', 0.75); buzz([50, 80, 50]); }
    const m = $('dm-meter');
    if (m) { m.className = 'dm-meter c' + Math.min(4, n); m.textContent = n >= 4 ? '😡 ¡Despierto!' : n >= 3 ? '😣 ¡Casi se despierta!' : n >= 2 ? '😟 Se está moviendo…' : n >= 1 ? '😪 Ronca más fuerte' : '😴 Duerme profundo'; }
  }

  // ---------- the panel (not my turn): the quiz, the guess, a message ----------
  function msg(big, small, kind, img) {
    $('dm-msg').classList.remove('hidden');
    $('dm-quiz').classList.add('hidden');
    const box = $('dm-msg');
    box.className = 'dm-msg' + (kind ? ' ' + kind : '');
    $('dm-msg-big').textContent = big || '';
    $('dm-msg-small').textContent = small || '';
    const im = $('dm-msg-img');
    if (img) { im.src = img; im.classList.remove('hidden'); } else im.classList.add('hidden');
  }
  function quizView() {
    $('dm-msg').classList.add('hidden');
    $('dm-quiz').classList.remove('hidden');
  }
  function whenMine() {
    if (!g || !seats.length || !turn) return '';
    const n = seats.length;
    const ti = seats.findIndex((x) => x.k === turn.k);
    const mi = seats.findIndex((x) => x.k === g.you);
    if (ti < 0 || mi < 0) return '';
    const d = (mi - ti + n) % n;
    if (d === 0) return '';
    if (d === 1) return '¡Tú sigues! Junta plumas';
    return 'Tu turno: después de ' + seats[(mi - 1 + n) % n].name;
  }
  function paintStatus() {
    const t = $('dm-status');
    if (!t) return;
    if (!turn || mine()) { t.textContent = ''; return; }
    t.innerHTML = '';
    const im = document.createElement('img');
    im.alt = '';
    im.src = S() ? S().head(skinOf(turn.k)) : '';
    const sp = document.createElement('span');
    sp.textContent = (turn.phase === 'pre' ? 'Turno de ' : '') + nameOf(turn.k) + (turn.phase === 'turn' ? ' le hace cosquillas…' : '');
    const nx = document.createElement('small');
    nx.textContent = whenMine();
    t.append(im, sp, nx);
  }
  function paintGuess() {
    const box = $('dm-guess');
    const watching = turn && turn.k !== (g && g.you);
    if (!watching || turn.safe) { box.classList.add('hidden'); return; }       // (only the board's first turn can't wake him)
    const open = turn.phase === 'pre' || (turn.phase === 'turn' && Date.now() - turn.startAt < 1500);
    box.classList.toggle('hidden', !open && !guessed);
    box.classList.toggle('done', !!guessed);
    document.querySelectorAll('#dm-guess button').forEach((b) => { b.disabled = !!guessed || !open; b.classList.toggle('picked', guessed === b.dataset.g); });
    $('dm-guess-q').textContent = guessed ? (guessed === 'wake' ? '😱 Dijiste: ¡se despierta!' : '😴 Dijiste: sigue dormido') : '¿Se despierta con ' + nameOf(turn.k) + '?';
  }
  // the quiz question (to earn feathers)
  function paintMyQ() {
    if (mine() && turn && turn.phase === 'turn') return;
    quizView();
    const box = $('dm-mq');
    if (feathers >= MAXF && !myQ) {
      box.classList.add('wait');
      $('dm-mq-text').textContent = '¡6 plumas, listo! 🪶 · Mira a ' + (turn ? nameOf(turn.k) : 'Dralingo');
      $('dm-tiles').innerHTML = '';
      $('dm-mq-img').classList.add('hidden');
      return;
    }
    if (!myQ) { box.classList.add('wait'); $('dm-mq-text').textContent = '…'; $('dm-tiles').innerHTML = ''; $('dm-mq-img').classList.add('hidden'); return; }
    box.classList.remove('wait');
    if (paintedQid === myQ.qid && $('dm-tiles').children.length) { qbar(); return; }   // (the same question: keep its tiles and its time)
    paintedQid = myQ.qid;
    qShownAt = Date.now();
    qbar();
    seenQ();
    const qf = $('dm-qfeed');                                  // a new question: the last answer's «+1 pluma» / «¡Casi!» goes
    if (qf.classList.contains('ans')) { qf.textContent = ''; qf.className = 'dm-qfeed'; }
    $('dm-mq-text').textContent = myQ.text;
    const im = $('dm-mq-img');
    if (myQ.image) { im.src = myQ.image; im.classList.remove('hidden'); } else { im.classList.add('hidden'); im.removeAttribute('src'); }
    const tiles = $('dm-tiles');
    tiles.innerHTML = '';
    myQ.answers.forEach((a, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dm-tile ' + COLORS[i % 4];
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
    if (!myQ || myLocked || paused) return;
    if (Date.now() - qShownAt < 350) return;                   // (a tap meant for the last question never lands on the new one)
    myLocked = true;
    if ($('dm-qtime')) $('dm-qtime').classList.add('done');
    const b = document.querySelectorAll('#dm-tiles .dm-tile')[i];
    if (b) b.classList.add('chosen');
    document.querySelectorAll('#dm-tiles .dm-tile').forEach((x) => { x.disabled = true; });
    sfx(K + 'tap.mp3', 0.5);
    ctx.socket.emit('player:dm-answer', { pin: ctx.getPin(), qid: myQ.qid, idx: i });
    ctx.markActivity();
  }
  // a gang member cheers a quiz streak (3, 5, 8…) at the panel's edge
  function cheer(n) {
    const c = C();
    if (!c || ![3, 5, 8, 12].includes(n)) return;
    const id = c.pick ? c.pick(1)[0] : 'aileen';
    const box = $('dm-cheer');
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

  // ---------- my turn: rub his head with my finger ----------
  // A stroke = one back-and-forth rub over his head: the finger travels 36 px+ one way, then 36 px+ back (any direction);
  // the leg that finished a stroke never counts as the first leg of the next one (a natural rub ≈ one tickle a 0.7 s, a
  // scribble is faster). A mouse rubs by just moving over him (no button to hold: a laptop kid hovers and it works).
  let rub = null, lastFeatherSent = 0, lastStrokeSent = 0, rubHintT = null;
  const newRub = (e) => ({ id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0, seg: 0, halves: 0, used: false });
  const canRub = () => !!(mine() && turn && (turn.phase === 'turn' || turn.phase === 'pre') && !paused);
  function rubStart(e) {
    if (!canRub()) return;                                    // (in «¡Te toca!» the finger may already rest on him)
    e.preventDefault();
    try { e.target.setPointerCapture(e.pointerId); } catch (_) {}
    rub = newRub(e);
    rubMove(e);
  }
  function rubMove(e) {
    if (rub && !canRub()) { rub = null; return; }              // (my turn ended / he woke up: the finger no longer moves the feather)
    if (!rub && e.pointerType === 'mouse' && canRub()) rub = newRub(e);
    if (!rub || e.pointerId !== rub.id || !stage) return;
    e.preventDefault();
    const box = $('dm-stage').getBoundingClientRect();
    const [fx, fy] = stage.toCu(e.clientX - box.left, e.clientY - box.top);
    stage.featherAt(fx, fy, skinOf(g.you));
    const now = Date.now();
    const live = !!(turn && turn.phase === 'turn');
    if (live && now - lastFeatherSent > 70) { lastFeatherSent = now; ctx.socket.emit('player:dm-feather', { pin: ctx.getPin(), x: fx, y: fy }); }
    const head = stage.onHead(fx, fy);
    if (live) rubHint(head);
    const mx = e.clientX - rub.x, my = e.clientY - rub.y;
    rub.x = e.clientX; rub.y = e.clientY;
    const len = Math.hypot(mx, my);
    if (len < 2) return;
    if (!head || !live) { rub.seg = 0; rub.halves = 0; rub.used = false; return; }
    const ux = mx / len, uy = my / len;
    if (!rub.seg) { rub.dx = ux; rub.dy = uy; rub.seg = len; return; }
    if (ux * rub.dx + uy * rub.dy < -0.35) {                 // the finger turned back: a long leg out = the first half
      rub.halves = rub.seg >= 36 && !rub.used ? 1 : 0;
      rub.used = false;
      rub.dx = ux; rub.dy = uy; rub.seg = len;
    } else {
      const vx = rub.dx * rub.seg + mx, vy = rub.dy * rub.seg + my, vl = Math.hypot(vx, vy) || 1;
      rub.dx = vx / vl; rub.dy = vy / vl; rub.seg += len;
    }
    if (rub.halves === 1 && rub.seg >= 36) { rub.halves = 0; rub.used = true; strokeNow(); }   // …and 36 px back = a tickle
  }
  function placeHand() {                                     // the guided hand's fingertip on his head
    const h = $('dm-hand');
    if (!stage || !h || !h.classList.contains('rubbing')) return;
    const sb = $('dm-stage').getBoundingClientRect(), hb = $('dm-turnhud').getBoundingClientRect();
    const [px, py] = stage.cuPoint(...stage.cuHead());
    h.style.left = Math.round(sb.left - hb.left + px - 25) + 'px';
    const nb = $('dm-hudname').getBoundingClientRect();        // (never over «Tu primer turno…» on a short screen)
    h.style.top = Math.round(Math.max(sb.top - hb.top + py - 6, nb.height ? nb.bottom - hb.top + 4 : 0)) + 'px';
  }
  function rubEnd(e) { if (rub && e.pointerId === rub.id) rub = null; }
  function rubHint(onHead) {
    const h = $('dm-rubhint');
    if (!h) return;
    if (onHead) { h.textContent = feathers > 0 ? 'Ida y vuelta = una cosquilla' : ''; h.classList.remove('warn'); }
    else { h.textContent = '👆 ¡En su cabeza!'; h.classList.add('warn'); }
  }
  function strokeNow() {
    const now = Date.now();
    if (now - lastStrokeSent < 230 || feathers <= 0) return;
    lastStrokeSent = now;
    ctx.socket.emit('player:dm-stroke', { pin: ctx.getPin() });
    ctx.markActivity();
    $('dm-hand').className = 'dm-hand hidden';          // (the guided hand goes once I rub)
  }
  function stopTurn() {
    if (!mine() || !turn || turn.phase !== 'turn' || paused) return;
    $('dm-stop').disabled = true;
    sfx(A + 'tap.mp3', 0.6);
    ctx.socket.emit('player:dm-stop', { pin: ctx.getPin() });
  }
  function paintHud() {
    // the name bar only on the guided first turn (an ordinary turn says it with «¡YA!»); the danger chip then steps aside
    const guided = !!(turn && turn.guided);
    $('dm-hudname').textContent = guided ? (turn.safe ? 'Tu primer turno: ¡frota su cabeza con el dedo!' : 'Tu primer turno: ¡frota su cabeza! Cuidado: se puede despertar') : '';
    $('dm-hudname').classList.toggle('hidden', !guided);
    $('screen-dormilon').classList.toggle('dm-guided', guided);
  }
  // the video's «START!»: a big word lands on his face («¡Te toca!» while the camera moves in, «¡YA!» when the clock runs)
  function splash(text, kind, ms) {
    const s = $('dm-splash');
    if (!s) return;
    s.textContent = text;
    s.className = 'dm-splash ' + (kind || '');
    if (!reduced()) { void s.offsetWidth; s.classList.add('on'); }
    later(ms || 1100, () => { if (s.textContent === text) s.className = 'dm-splash hidden'; });
  }
  // his sleepy giggle when the feather tickles him (Higgsfield takes, rotated so it never sounds the same twice in a row)
  let giggleN = 0;
  function giggle(vol) {
    giggleN = (giggleN + 1 + Math.floor(Math.random() * 2)) % 3;
    sfx(A + 'giggle-h' + (giggleN + 1) + '.mp3', vol);
  }

  // ---------- the events ----------
  function applyInit(d) {
    if (!d) return;
    const fresh = !g || g.id !== d.id;
    g = { id: d.id, you: d.you ? d.you.k : null, b: d.board ? d.board.id : null, phase: d.phase };
    show();
    if (fresh) { guessed = null; myQ = null; streak = 0; }
    paused = !!d.paused;
    $('dm-pause').classList.toggle('hidden', !paused);
    $('screen-dormilon').classList.toggle('dm-paused', paused);
    if (d.endsMs != null) { endsAt = Date.now() + d.endsMs; pausedLeft = d.endsMs; }
    frenzy = !!d.frenzy;
    document.body.classList.toggle('dm-frenzy', frenzy);
    if (d.you && d.you.feathers != null) feathers = d.you.feathers;
    const bd = d.board;
    if (bd) {
      seats = bd.seats.slice();
      night = bd.night || 1;
      paintNight();
      if (stage && bd.phase !== 'wake') stage.sleep();
      setCue(bd.cue || 0);
      const tk = bd.turn;
      if (tk && (bd.phase === 'pre' || bd.phase === 'turn')) {
        const total = bd.phase === 'turn' ? (d.turnMs || bd.phaseMs) : bd.phaseMs;
        turn = { k: tk, phase: bd.phase, until: Date.now() + (bd.phase === 'turn' ? (d.turnMs || 0) : bd.phaseMs), startAt: bd.phase === 'turn' ? 0 : Date.now(), guided: !!bd.guided, safe: !!bd.safe, pats: bd.pats || 0, total: Math.max(total, 1) };
        pausedTurn = d.turnMs || 0;
        const meNow = tk === g.you;                    // (my «¡Te toca!» is already the close-up, like dm:pre)
        if (stage) { stage.kid(skinOf(tk), nameOf(tk), { me: meNow }); stage.closeup(bd.phase === 'turn' || meNow); if (bd.phase === 'turn' || meNow) stage.featherAt(null, null, skinOf(tk)); }
      } else { turn = null; if (stage) { stage.kid(null); stage.closeup(false); } }
      if (bd.phase === 'wake' && stage) { stage.closeup(true); stage.wake(); stage.rage(Math.min(4000, bd.phaseMs || 0)); rageOn(Math.min(4000, bd.phaseMs || 0)); } else rageOff();
      if (d.you) guessed = d.you.guess || guessed;
    }
    paintList();
    paintQuiver();
    if (d.you) setScore(d.you.k, d.you.score);
    const myTurnNow = !!(turn && mine() && (turn.phase === 'turn' || turn.phase === 'pre'));
    setMyTurn(myTurnNow);
    if (myTurnNow) {
      paintHud();
      $('dm-stop').disabled = turn.phase !== 'turn';
      if (turn.phase === 'pre') { const big = $('dm-count'); big.textContent = turn.guided ? 9 : 6; big.dataset.s = ''; big.classList.remove('hurry'); }
    }
    if (d.q) { if (!myQ || myQ.qid !== d.q.qid || $('dm-quiz').classList.contains('hidden')) { myQ = d.q; myQ.until = Date.now() + (d.q.ms != null ? d.q.ms : 15000); paintMyQ(); } }
    else if (!myTurnNow) { myQ = null; if (d.phase === 'play') paintMyQ(); else msg('¡Shhh!', 'Dralingo está durmiendo…', 'calm'); }
    paintStatus();
    paintGuess();
    if (d.phase === 'play' || d.phase === 'intro') runClock();
    if (d.phase === 'play') snoreLoop();
    duck(myTurnNow);
    paintClock();
    $('dm-frenzy').classList.toggle('hidden', !frenzy);
  }
  function init(c) {
    ctx = c;
    const sock = c.socket;
    let frozen = false, queue = [];
    const s = { on: (ev, fn) => sock.on(ev, (d) => { if (frozen && ev.indexOf('dm:') === 0) { queue.push([fn, d]); return; } fn(d); }) };
    DormilonPhone._freeze = (v) => { frozen = !!v; if (!frozen) { const q = queue; queue = []; q.forEach(([fn, d]) => fn(d)); } return queue.length; };
    $('dm-stop').addEventListener('click', stopTurn);
    const touch = $('dm-touch');
    touch.addEventListener('pointerdown', rubStart);
    touch.addEventListener('pointermove', rubMove);
    touch.addEventListener('pointerup', rubEnd);
    touch.addEventListener('pointercancel', rubEnd);
    touch.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') rubEnd(e); });
    document.addEventListener('visibilitychange', () => { if (on && myQ && !$('dm-quiz').classList.contains('hidden')) seenQ(); });
    window.addEventListener('draly:elsewhere', () => { stopAll(); duck(false); setOn(false); });
    document.querySelectorAll('#dm-guess button').forEach((b) => b.addEventListener('click', () => {
      if (guessed || !turn) return;
      guessed = b.dataset.g;
      sfx(A + 'tap.mp3', 0.6);
      buzz(15);
      ctx.socket.emit('player:dm-guess', { pin: ctx.getPin(), g: guessed });
      paintGuess();
    }));
    let lastReact = 0;
    document.querySelectorAll('#dm-reacts button').forEach((b) => b.addEventListener('click', () => {
      const now = Date.now();
      if (now - lastReact < 1200) return;
      lastReact = now;
      b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
      ctx.socket.emit('player:dm-react', { pin: ctx.getPin(), e: b.dataset.e });
    }));
    s.on('state', (st) => {
      if (!st) return;
      if (st.gameType) setOn(st.gameType === 'dormilon');
      if (!on) return;
      if (st.state === 'lobby') {
        stopAll(); g = null; turn = null; myQ = null;
        placeMute(false);
        setMyTurn(false);
        document.body.classList.remove('dm-ended', 'dm-frenzy');
        const old = $('dm-cer'); if (old) old.remove();
      }
      if (g && st.players) {
        const off = {};
        Object.values(st.players).forEach((p) => { off[String(p.name).toLowerCase()] = !!p.off; });
        let ch = false;
        seats.forEach((x) => { const k = String(x.name).toLowerCase(); if (k in off && x.on === off[k]) { x.on = !off[k]; ch = true; } });
        if (ch) paintList();
      }
    });
    s.on('countdown', () => {
      if (!on) return;
      stopAll(); g = null; turn = null; myQ = null; guessed = null; endsAt = 0; cue = 0; night = 1; feathers = 3; streak = 0;
      setMyTurn(false);
      document.body.classList.remove('dm-ended', 'dm-frenzy');
      const old = $('dm-cer'); if (old) old.remove();
    });
    s.on('dm:init', (d) => { if (on || (d && d.id)) { setOn(true); applyInit(d); ctx.markActivity(); } });
    s.on('dm:seat', (d) => {
      if (!on || !d.board || !g || d.board.id !== g.b) return;
      seats = d.board.seats.slice();
      paintList();
      paintStatus();
    });
    s.on('dm:intro', (d) => {
      if (!on || !g) return;
      ctx.markActivity();
      g.phase = 'intro';
      if (stage) stage.say('¡Shhh! Dralingo duerme…', 'calm');
      msg('¡Shhh!', 'Responde y junta plumas 🪶 · en tu turno, ¡hazle cosquillas con el dedo!', 'calm', A + 'feather.webp');
      later((d.ms || 2600) - 700, () => { if (stage) stage.say('¡YA!', 'go', 700); sfx(H + 'start.mp3', 0.7); buzz(30); });
    });
    s.on('dm:play', (d) => {
      if (!on || !g) return;
      g.phase = 'play';
      endsAt = Date.now() + (d.endsMs || 0);
      runClock();
      snoreLoop();
      paintMyQ();
    });
    s.on('dm:pre', (d) => {
      if (!on || !g || d.b !== g.b) return;
      ctx.markActivity();
      turn = { k: d.k, phase: 'pre', until: Date.now() + d.ms, startAt: Date.now(), guided: !!d.guided, safe: !!d.safe, pats: 0, total: d.ms };
      guessed = null;
      if (stage) { stage.closeup(false); stage.kid(skinOf(d.k), nameOf(d.k), { me: d.k === g.you }); stage.say(''); }
      paintList();
      if (d.k === g.you) {
        myQ = null;
        if (d.feathers != null) { feathers = d.feathers; paintQuiver(); }
        msg('¡Te toca!', feathers ? 'Tienes ' + feathers + ' plumas: ¡prepara el dedo! 👆' : '¡Sin plumas! Responde para ganar más', 'go', S() ? S().tiptoe(skinOf(g.you)) : null);
        // the camera moves in on his face at once (the video's turn starts there): the feather waits by his head, the
        // finger may already rest on him, the clock and «¡Me retiro!» wake up with «¡YA!»
        if (stage) { stage.closeup(true); stage.featherAt(null, null, skinOf(g.you)); }
        setMyTurn(true);
        paintHud();
        $('dm-stop').disabled = true;
        $('dm-hand').className = 'dm-hand hidden';
        const big = $('dm-count');
        big.textContent = d.guided ? 9 : 6;
        big.dataset.s = '';
        big.classList.remove('hurry');
        $('dm-rubhint').textContent = feathers ? 'Pon el dedo en su cabeza… 👆' : '¡Sin plumas!';
        $('dm-rubhint').classList.remove('warn');
        splash('¡Te toca!', 'ready', Math.max(900, d.ms - 150));
        sfx(H + 'round.mp3', 0.7);
        buzz([40, 30, 40]);
      } else {
        if (stage) stage.say('Turno de ' + nameOf(d.k), 'calm', d.ms);
        paintMyQ();
      }
      paintStatus();
      paintGuess();
    });
    s.on('dm:skip', (d) => {
      if (!on || !g) return;
      if (d && d.b === g.b && d.k != null && stage) stage.say(nameOf(d.k) + ' no está: ¡siguiente!', 'calm', 1500);
      if (d && d.k == null && document.body.classList.contains('dm-ended')) skipCeremony();      // (after the end: «Saltar» → my card)
    });
    s.on('dm:go', (d) => {
      if (!on || !g || d.b !== g.b) return;
      ctx.markActivity();
      turn = { k: d.k, phase: 'turn', until: Date.now() + d.ms, startAt: Date.now(), guided: !!d.guided, safe: !!d.safe, pats: 0, total: d.ms };
      if (stage) { stage.closeup(true); stage.say(''); stage.featherAt(null, null, skinOf(d.k)); }
      if (d.k === g.you) {
        if (d.feathers != null) feathers = d.feathers;
        paintQuiver();
        setMyTurn(true);
        paintHud();
        $('dm-stop').disabled = false;
        $('dm-hand').className = d.guided ? 'dm-hand rubbing' : 'dm-hand hidden';
        if (d.guided) requestAnimationFrame(() => requestAnimationFrame(placeHand));
        rubHint(true);
        duck(true);
        splash(feathers ? '¡YA!' : '¡Sin plumas!', feathers ? 'go' : 'no', 900);
        sfx(K + 'whoosh.mp3', 0.5);
        buzz(30);
      } else {
        paintStatus();
        later(1600, paintGuess);
      }
      paintClock();
    });
    s.on('dm:fe', (d) => { if (on && g && d.b === g.b && d.k !== g.you && stage && turn && turn.phase === 'turn') stage.featherAt(d.x, d.y, skinOf(d.k)); });
    s.on('dm:q', (d) => {
      if (!on || !g || d.b !== g.b) return;
      ctx.markActivity();
      myQ = d;
      myQ.until = Date.now() + (d.ms || 15000);
      if (d.feathers != null) feathers = d.feathers;
      paintMyQ();
    });
    s.on('dm:qx', () => { myQ = null; });
    s.on('dm:nope', (d) => {
      if (!on || !myQ || !d || d.qid !== myQ.qid) return;
      if (d.why === 'closed' || d.why === 'fast') { myLocked = false; document.querySelectorAll('#dm-tiles .dm-tile').forEach((x) => { x.disabled = false; x.classList.remove('chosen'); }); }
    });
    s.on('dm:qr', (d) => {
      if (!on || !g) return;
      ctx.markActivity();
      const ts = document.querySelectorAll('#dm-tiles .dm-tile');
      feathers = d.feathers;
      streak = d.streak || 0;
      if (d.ok) {
        if (ts[d.idx]) ts[d.idx].classList.add('ok');
        if (d.gained) { flyFeather(ts[d.idx]); sfx(H + 'pop.mp3', 0.6); later(560, () => paintQuiver(true)); buzz(20); }
        $('dm-qfeed').textContent = d.full ? '¡6 plumas, listo! 🪶' : '+1 pluma 🪶';
        $('dm-qfeed').className = 'dm-qfeed ok ans';
        cheer(streak);
      } else {
        // it costs: a feather flies out of my quiver («fsss»), my head looks sad, the right one shown; he shifts (dm:shift)
        if (ts[d.idx]) ts[d.idx].classList.add('no');
        if (ts[d.correctIdx]) ts[d.correctIdx].classList.add('ok');
        document.querySelectorAll('#dm-tiles .dm-tile').forEach((x) => { x.disabled = true; });
        if ($('dm-qtime')) $('dm-qtime').classList.add('done');
        sfx(K + 'wrong.mp3', 0.4);
        const lost = d.gained < 0;
        if (lost) { featherOut(); later(120, () => sfx(A + 'lose-feather-h1.mp3', 0.8)); }
        paintQuiver();
        buzz(lost ? [30, 40, 30] : 25);
        const fb = $('dm-qfeed');
        fb.innerHTML = '';
        const sad = document.createElement('span');
        sad.className = 'sad';
        const im = document.createElement('img');
        im.alt = '';
        im.src = S() ? S().head(skinOf(g.you)) : '';
        const em = document.createElement('em');
        em.textContent = '😖';
        const tx = document.createElement('span');
        tx.textContent = (d.late ? '¡Se acabó el tiempo! ' : d.tooFast ? '¡Muy rápido! Primero lee. ' : '¡Casi! ') + 'Era «' + d.correctText + '»' + (lost ? ' · se fue una pluma 🪶💨' : '');
        sad.append(im, em, tx);
        fb.appendChild(sad);
        fb.className = 'dm-qfeed no ans';
      }
      myQ = null;
      later(d.ok ? 560 : 1300, () => { if (!myQ) paintMyQ(); });
    });
    s.on('dm:plume', (d) => { if (on && g && d.b === g.b) setSeatFeathers(d.k, d.feathers); });
    // a wrong / late answer on my board: he shifts in his sleep (everyone sees it, the danger rose)
    s.on('dm:shift', (d) => {
      if (!on || !g || d.b !== g.b) return;
      setCue(d.cue);
      if (stage) stage.shift();
      if (d.k === g.you) return;
      sfx(A + 'creak2.mp3', 0.3);
      if (mine() && turn && turn.phase === 'turn') { splash('¡Se movió!', 'no', 800); return; }
      const fb = $('dm-qfeed');
      if (fb && !fb.classList.contains('ans')) { fb.textContent = '¡Dralingo se movió! 😬'; fb.className = 'dm-qfeed no'; }   // (never who failed)
    });
    s.on('dm:nostroke', (d) => {
      if (!on || !d) return;
      if (d.why === 'empty') { rubHint(false); $('dm-rubhint').textContent = '¡Sin plumas!'; }
    });
    s.on('dm:pat', (d) => {
      if (!on || !g || d.b !== g.b) return;
      ctx.markActivity();
      setScore(d.k, d.score, 'bump');
      setSeatFeathers(d.k, d.feathers);
      setCue(d.cue);
      if (turn) turn.pats = d.pats;
      if (stage) stage.cuStroke(d.pts, d.fast);
      sfx(A + 'stroke.mp3', d.k === g.you ? 0.8 : 0.55);
      later(140, () => sfx(H + 'pop.mp3', d.k === g.you ? 0.6 : 0.4));
      if (d.fast) sfx(A + 'creak.mp3', 0.6);
      else later(200, () => giggle(d.k === g.you ? 0.8 : 0.45));
      if (d.k === g.you) {
        feathers = d.feathers;
        paintQuiver();
        buzz(d.fast ? [25, 30, 25] : 14);
        if (turn && turn.guided && d.pats === 2) {
          $('dm-hand').className = 'dm-hand on-stop';
          $('dm-hand').style.left = $('dm-hand').style.top = '';
          $('dm-hudname').textContent = '¿Otra más o te retiras? Si se despierta, ¡pierdes todo!';
        }
        const f = $('dm-plus');
        f.textContent = d.fast ? '¡Despacio! 😬' : '+' + d.pts + (d.pats >= 3 ? ' · ¡' + d.pats + '!' : '');
        f.classList.toggle('no', !!d.fast);
        if (!reduced()) { f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
      }
    });
    s.on('dm:wake', (d) => {
      if (!on || !g || d.b !== g.b) return;
      ctx.markActivity();
      clearTimers();
      const name = nameOf(d.k);
      setScore(d.k, 0, 'zero');
      setCue(4);
      if (stage) { stage.closeup(true); stage.featherOff(); stage.wake(); stage.rage(4300); stage.say('¡Se despertó!', 'wake'); later(1100, () => { if (stage) stage.speak(WAKE_LINES[Math.floor(Math.random() * WAKE_LINES.length)], 2400); }); }
      rageOn(4300);                                            // he is ANGRY: the whole phone floods red (the whole wake-up, 4.4 s on the server)
      $('dm-plus').classList.remove('on');                     // (no «+1 · ¡N!» left over: he is angry now)
      if (d.k === g.you && d.lost) later(150, () => splash('−' + d.lost + ' 😱', 'no lost', 1600));   // (my points vanish, under his face: his angry eyes stay clear)
      later(260, () => sfx(A + (Math.random() < 0.5 ? 'angry-h1.mp3' : 'angry-h2.mp3'), 0.85));
      const wasMine = d.k === g.you;
      turn = null;
      paintGuess();                                          // (the open «¿Se despierta?» closes: its 1.6-s timer was just cleared)
      setMyTurn(false);
      duck(false);
      paintList();
      sfx(A + 'wake-h1.mp3', 0.9);
      const right = (d.guess || []).includes(g.you);
      if (wasMine) {
        later(1600, () => sfx(MO + 'lose.mp3', 0.6));
        buzz([80, 60, 200]);
        msg('¡Lo despertaste! 😱', d.lost ? (d.lost === 1 ? 'Pierdes tu punto… ¡a recuperarlo!' : 'Pierdes tus ' + d.lost + ' puntos… ¡a recuperarlos!') : 'No tenías puntos: ¡nada que perder!', 'wake', A + 'dralingo-awake.webp');
      } else {
        later(450, () => sfx(H + 'aww.mp3', 0.55));
        buzz(60);
        $('dm-qfeed').textContent = '¡' + name + ' lo despertó!' + (d.lost ? ' Pierde ' + d.lost + (d.lost === 1 ? ' punto.' : ' puntos.') : '') + (right ? ' ¡Adivinaste! 🔮' : '');
        $('dm-qfeed').className = 'dm-qfeed no';
      }
      paintStatus();
    });
    s.on('dm:end', (d) => {
      if (!on || !g || d.b !== g.b) return;
      ctx.markActivity();
      const right = (d.guess || []).includes(g.you);
      const name = nameOf(d.k);
      setScore(d.k, d.score);
      if (d.feathers != null) setSeatFeathers(d.k, d.feathers);
      const wasMine = d.k === g.you;
      turn = null;
      if (stage) { stage.closeup(false); stage.featherOff(); }
      setMyTurn(false);
      duck(false);
      paintList();
      paintStatus();
      paintGuess();
      if (d.why === 'final') { msg('¡Shhh!', '¡Se acabó la noche!', 'calm'); return; }
      const pts = d.pts != null ? d.pts : d.pats;
      if (wasMine) {
        if (d.feathers != null) { feathers = d.feathers; paintQuiver(); }
        sfx(K + 'correct.mp3', 0.6);
        msg(pts ? '¡A salvo! +' + pts : d.why === 'empty' ? '¡Sin plumas!' : '¡Turno terminado!', d.why === 'guided' ? '¡Así se juega! Ahora responde para ganar plumas 🪶' : d.why === 'stop' ? 'Te retiraste a tiempo 😌' : d.why === 'empty' ? (pts ? '¡Usaste todas tus plumas!' : 'Responde preguntas para ganar plumas 🪶') : pts ? '¡Se acabó tu tiempo y sigue dormido!' : '¡Frota su cabeza ida y vuelta!', 'safe', S() ? S().tiptoe(skinOf(g.you)) : null);
        later(2000, () => { if (!turn || !mine()) paintMyQ(); });
      } else {
        $('dm-qfeed').textContent = (d.why === 'stop' ? name + ' se retiró' : name + ': ¡a salvo!') + (pts ? ' +' + pts : '') + (right ? ' · ¡Adivinaste! 🔮' : '');
        $('dm-qfeed').className = 'dm-qfeed';
        if (right) sfx(H + 'yes.mp3', 0.5);
      }
    });
    s.on('dm:night', (d) => {
      if (!on || !g || d.b !== g.b) return;
      night = d.night;
      paintNight();
      setCue(0);
      freezeQ(false);
      rageOff();
      if (stage) { stage.closeup(false); stage.sleep(); stage.kid(null); stage.say('Noche ' + d.night + ' 🌙 Se vuelve a dormir…', 'calm', 2200); }
      paintGuess();
      paintMyQ();
    });
    s.on('dm:guess', (d) => {
      if (!on || !g || d.b !== g.b) return;
      const t = $('dm-tally');
      if (t && d.tally) t.textContent = '😴 ' + d.tally.sleep + ' · 😱 ' + d.tally.wake;
    });
    s.on('dm:guess-no', () => { if (!on) return; guessed = null; paintGuess(); });
    s.on('dm:react', (d) => { if (on && g && d.b === g.b && stage) stage.react(d.e, skinOf(d.k)); });
    s.on('dm:frenzy', (d) => {
      if (!on || !g) return;
      frenzy = !d.off;
      document.body.classList.toggle('dm-frenzy', frenzy);
      $('dm-frenzy').classList.toggle('hidden', !frenzy);
      if (frenzy) {
        if (P() && P().news) P().news('¡Luna llena! 🌕', { sub: 'Últimos 30 segundos: cada cosquilla vale 2', kind: 'alarm', ms: 2800 });
        sfx(PARTY + 'hurry.mp3', 0.8);
        buzz([60, 40, 60]);
      }
    });
    s.on('dm:time', (d) => {
      if (!on || !g) return;
      endsAt = Date.now() + (d.endsMs || 0);
      if (paused) pausedLeft = d.endsMs || 0;
      paintClock();
      if (stage && d.add) stage.say((d.add > 0 ? '+' : '−') + Math.abs(d.add) + ' s', 'calm', 1200);
    });
    s.on('dm:pause', (d) => {
      if (!on || !g) return;
      paused = !!d.paused;
      if (paused) { pausedLeft = endsAt - Date.now(); if (turn) pausedTurn = turn.until - Date.now(); }
      $('dm-pause').classList.toggle('hidden', !paused);
      $('screen-dormilon').classList.toggle('dm-paused', paused);     // (the question's time stands still too)
      freezeQ(paused);
      if (!paused) qbar();
    });
    s.on('dm:final', (d) => {
      if (!on || !g) return;
      clearTimers(); stopSnore(); duck(false); rageOff();
      turn = null; myQ = null;
      setMyTurn(false);
      document.querySelectorAll('#dm-tiles .dm-tile').forEach((x) => { x.disabled = true; });
      if (P() && P().final) P().final({ mode: 'phone', ms: d.ms, sub: '¡Se acabó la noche!', play: (u, v) => sfx(u, v), buzz });
      else if (stage) stage.say('¡FINAL!', 'wake');
    });
    s.on('game-end', () => { if (!on) return; stopAll(); });
  }

  // ---------- the lobby card: the game in 3 pictures + who I play as ----------
  function lobby(head) {
    let box = $('dm-how');
    if (!head) { if (box) box.remove(); return; }
    const skin = localSkin();
    if (!box) {
      box = document.createElement('div');
      box.className = 'dm-how';
      box.id = 'dm-how';
      box.innerHTML = '<div class="dm-you"><img id="dm-you-img" alt=""><span>Vas a jugar como<b id="dm-you-name"></b></span></div>'
        + '<div class="dm-how-title">Así se juega</div><ol>'
        + '<li><div class="dm-step s1"><i class="t r">▲</i><i class="t b">◆</i><i class="t y ok">●</i><i class="t g">■</i><img class="fl" src="' + A + 'feather.webp" alt=""></div><span>Responde bien<small>= una pluma 🪶 · si fallas, se va una</small></span></li>'
        + '<li><div class="dm-step s2"><img src="' + A + 'closeup-sleep.webp" alt=""><img class="f" src="' + A + 'feather.webp" alt=""><b>+1</b></div><span>Tu turno: ¡frota!<small>ida y vuelta = +1</small></span></li>'
        + '<li><div class="dm-step s3"><img src="' + A + 'closeup-awake.webp" alt=""><b>0</b></div><span>¡No lo despiertes!<small>si se despierta, pierdes todo</small></span></li>'
        + '</ol>';
      head.after(box);
    }
    $('dm-you-img').src = S() ? S().tiptoe(skin) : '';
    $('dm-you-img').classList.toggle('flip', !!(S() && S().flip(skin)));
    $('dm-you-name').textContent = (window.Saga && window.Saga.labelOf && window.Saga.labelOf(skin)) || 'Dralingo';
  }

  // ---------- the end: my board's ceremony, then my card ----------
  let cer = null;
  function skipCeremony() { if (cer && cer.toCard) cer.toCard(); }
  function end(data) {
    const box = $('screen-end');
    if (!box) return;
    const old = $('dm-cer');
    if (old) old.remove();
    if (cer && cer.timers) cer.timers.forEach(clearTimeout);
    stopAll();
    placeMute(false);
    if (P() && P().hideFinal) P().hideFinal();
    const dm = (data && data.dormilon) || {};
    const me = (data && data.me) || {};
    const bd = dm.board || { rows: [], stars: [], winners: [] };
    const rows = bd.rows || [];
    const byK = {};
    rows.forEach((r) => { byK[r.k] = r; });
    const root = document.createElement('div');
    root.className = 'dm-cer';
    root.id = 'dm-cer';
    const st = document.createElement('div');
    st.className = 'dm-cer-stage';
    const show = document.createElement('div');
    show.className = 'dm-cer-show';
    root.append(st, show);
    box.appendChild(root);
    document.body.classList.add('dm-ended');
    const stg = S() ? new (S().Stage)(st, { mode: 'phone' }) : null;
    const C = cer = { timers: [] };
    const at = (ms, fn) => C.timers.push(setTimeout(fn, ms));
    const H_ = HB();
    const fig = (skin, pose) => (H_ ? H_.art(skin, pose, pose === 'win') : '');
    function scene(title, sub, figs, kind) {
      show.innerHTML = '';
      const c = document.createElement('div');
      c.className = 'dm-cer-card ' + (kind || '');
      const h = document.createElement('h2');
      h.textContent = title;
      c.appendChild(h);
      if (figs && figs.length) {
        const f = document.createElement('div');
        f.className = 'dm-cer-figs n' + Math.min(4, figs.length);
        figs.forEach(([skin, pose, label]) => {
          const d = document.createElement('div');
          d.className = 'dm-cer-fig';
          const i = document.createElement('img');
          i.alt = '';
          i.src = fig(skin, pose);
          const n = document.createElement('span');
          n.textContent = label || '';
          d.append(i, n);
          f.appendChild(d);
        });
        c.appendChild(f);
      }
      if (sub) { const p = document.createElement('p'); p.textContent = sub; c.appendChild(p); }
      show.appendChild(c);
    }
    const STAR_ICO = { valiente: '🦁', prudente: '🛡️', racha: '🔥', adivino: '🔮' };
    const UNIT = { valiente: ['cosquilla en un turno', 'cosquillas en un turno'], prudente: ['turno a salvo', 'turnos a salvo'], racha: ['seguida', 'seguidas'], adivino: ['adivinada', 'adivinadas'] };
    const starValue = (s) => s.value + ' ' + (UNIT[s.id] ? UNIT[s.id][s.value === 1 ? 0 : 1] : s.unit);
    const stars = bd.stars || [];
    let t = 200;
    if (stars.length) {
      at(t, () => { scene('¡Estrellas bonus! ⭐', 'Para los más valientes, prudentes y listos', null, 'gold'); sfx('/assets/mochi/star.mp3', 0.7); });
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
    // the drum: everybody of the board, no scores yet (the suspense), then the winner
    at(t, () => { scene('¿Quién gana tu tablero?', '🥁 …', rows.slice(0, 5).map((r) => [r.skin, 'idle', r.name]), 'drum'); sfx('/assets/mochi/drum.mp3', 0.7); });
    t += 1700;
    const winners = (bd.winners || []).map((k) => byK[k]).filter(Boolean);
    at(t, () => {
      if (winners.length) {
        scene(winners.length > 1 ? '¡Empate de campeones!' : '¡' + winners[0].name + ' gana!', winners.map((w) => w.score + (w.score === 1 ? ' punto' : ' puntos')).join(' · ') + ' · ¡Shhh, que no se despierte! 🤫', winners.map((w) => [w.skin, 'win', w.name]), 'win');
        if (stg) { stg.kid(winners[0].skin, winners[0].name, { me: winners[0].k === me.k }); stg.say('¡Shhh! 🤫', 'calm'); }
        sfx(K + 'sting-win.mp3', 0.85);
        if (me.won) buzz([60, 40, 60, 40, 200]);
        confetti(root);
      } else {
        scene('¡Nadie ganó esta vez!', 'Dralingo se despertó demasiado 😅 ¡La próxima noche es tuya!', null, 'win');
        if (stg) { stg.wake(); stg.say('¡Se despertó!', 'wake'); }
        sfx(A + 'wake-h1.mp3', 0.8);
      }
    });
    t += 3400;
    C.toCard = () => { C.timers.forEach(clearTimeout); C.timers = []; card(); };
    at(t, () => C.toCard());
    if (me.guest) { C.timers.forEach(clearTimeout); C.timers = []; at(300, () => C.toCard()); }   // (no board of mine: straight to the card)
    function card() {
      show.innerHTML = '';
      const c = document.createElement('div');
      c.className = 'dm-mycard' + (me.won ? ' won' : '');
      const f = document.createElement('img');
      f.className = 'dm-mycard-fig';
      f.alt = '';
      f.src = me.guest ? A + 'dralingo-sleep.webp' : fig(me.skin || (byK[me.k] && byK[me.k].skin) || 'dralingo', me.won ? 'win' : me.score ? 'ok' : me.lost ? 'no' : 'idle');
      const h = document.createElement('h2');
      h.textContent = me.guest ? '¡Se acabó la noche!' : me.won ? (winners.length > 1 ? '¡Empate en tu tablero! 🌙' : '¡Ganaste tu tablero! 🌙') : !me.score ? '¡La próxima es tuya!' : 'Puesto ' + (me.rank || '-') + ' de ' + (me.of || '-') + ' en tu tablero';
      const l1 = document.createElement('p');
      l1.className = 'dm-line';
      // never a «0» (his rule: «¡La próxima es tuya!»): a kid who woke him hears what happened instead
      if (me.guest) l1.textContent = 'Mira el proyector: ¡ahí están los campeones! 👀';
      else if (me.score) { l1.innerHTML = 'Tus puntos: <b></b>'; l1.querySelector('b').textContent = me.score + ' ⭐'; }
      else if (me.lost) l1.textContent = 'Tenías ' + me.lost + (me.lost === 1 ? ' punto' : ' puntos') + '… ¡y lo despertaste! 😱';
      else l1.textContent = 'Responde para ganar plumas 🪶 y en tu turno, ¡frota su cabeza!';
      const l2 = document.createElement('p');
      l2.className = 'dm-small';
      const bits = [];
      if (me.pats) bits.push(me.pats + (me.pats === 1 ? ' cosquilla' : ' cosquillas'));
      if (me.wakes) bits.push('lo despertaste ' + (me.wakes === 1 ? '1 vez' : me.wakes + ' veces'));
      if (me.guessOk) bits.push(me.guessOk + ' adivinadas');
      if (!me.guest) bits.push('en la clase: puesto ' + (me.classRank || '-') + ' de ' + (me.classOf || '-'));
      l2.textContent = bits.join(' · ');
      c.append(f, h, l1, l2);
      if ((me.stars || []).length) {
        const sb = document.createElement('div');
        sb.className = 'dm-mystars';
        me.stars.forEach((id) => { const s = stars.find((x) => x.id === id); const b = document.createElement('span'); b.textContent = (STAR_ICO[id] || '⭐') + ' ' + (s ? s.name : id); sb.appendChild(b); });
        c.appendChild(sb);
      }
      const list = document.createElement('ol');
      list.className = 'dm-board-rank';
      rows.forEach((r) => {
        const li = document.createElement('li');
        if (r.k === me.k) li.className = 'me';
        const im = document.createElement('img');
        im.alt = '';
        im.src = S() ? S().head(r.skin) : '';
        const n = document.createElement('span');
        n.textContent = r.rank + '. ' + r.name;
        const sc = document.createElement('b');
        sc.textContent = r.score;
        li.append(im, n, sc);
        list.appendChild(li);
      });
      c.appendChild(list);
      const home = document.createElement('button');
      home.type = 'button';
      home.className = 'dm-home';
      home.textContent = '🏠 Inicio';
      home.addEventListener('click', () => { location.href = '/'; });
      c.appendChild(home);
      show.appendChild(c);
      if (stg) stg.say('');
    }
    if (stg) stg.say('');
  }
  function confetti(root) {
    if (reduced()) return;
    const box = document.createElement('div');
    box.className = 'dm-confetti';
    for (let i = 0; i < 28; i++) {
      const c = document.createElement('i');
      c.style.left = Math.random() * 100 + '%';
      c.style.animationDelay = (Math.random() * 0.6).toFixed(2) + 's';
      c.style.background = ['#f2c14e', '#e2483c', '#7fb8ff', '#ffffff', '#ff9ec2'][i % 5];
      box.appendChild(c);
    }
    root.appendChild(box);
    setTimeout(() => box.remove(), 3500);
  }

  const DormilonPhone = window.DormilonPhone = {
    init, lobby, end,
    frame: () => ({
      on, phase: g && g.phase, you: g && g.you, board: g && g.b, seats: seats.map((x) => x.name + ':' + x.score + ':' + x.feathers),
      turn: turn && { k: turn.k, phase: turn.phase, mine: mine(), guided: turn.guided, safe: turn.safe }, q: myQ && myQ.text, answers: myQ && myQ.answers, feathers, cue, night, paused, frenzy,
      myturn: !!(document.getElementById('screen-dormilon') && document.getElementById('screen-dormilon').classList.contains('dm-myturn')),
      raging: !!(document.getElementById('screen-dormilon') && document.getElementById('screen-dormilon').classList.contains('dm-raging')),
    }),
    answer: (i) => answer(i),
    // test hook: n back-and-forth rubs over his head, gapMs apart (pointer events on the touch layer, like a finger)
    rub: (n, gapMs) => new Promise((done) => {
      const t = document.getElementById('dm-touch');
      const st = stage;
      if (!t || !st) { done(0); return; }
      const box = document.getElementById('dm-stage').getBoundingClientRect();
      const [hx, hy] = st.cuHead();
      const [px, py] = st.cuPoint(hx, hy);
      const cx = box.left + px, cy = box.top + py;
      const ev = (type, x, y) => t.dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: x, clientY: y, bubbles: true, cancelable: true, pointerType: 'touch' }));
      // (the moves are spread over the stroke's time like a real finger: one back-and-forth every gapMs)
      let i = 0, s = 0;
      const step = Math.max(8, Math.round((gapMs || 700) / 12));
      ev('pointerdown', cx - 30, cy);
      const one = () => {
        if (i >= n) { ev('pointerup', cx, cy); done(i); return; }
        s++;
        if (s <= 6) ev('pointermove', cx - 30 + s * 12, cy + (s % 2));
        else ev('pointermove', cx + 42 - (s - 6) * 12, cy - (s % 2));
        if (s >= 12) { s = 0; i++; }
        setTimeout(one, step);
      };
      one();
    }),
    stop: () => stopTurn(),
    freeze: (v) => (DormilonPhone._freeze ? DormilonPhone._freeze(v) : 0),
    stage: () => stage,
  };
})();
