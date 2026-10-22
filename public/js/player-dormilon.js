// ¡No despiertes a Dralingo! — the kid's phone (the product). player.js calls DormilonPhone.init(...) once; the pastel
// skin (player-kingdoms-skin.js) routes the sounds, the music, the lobby card and the end screen here.
//   · my board on top like the video (4 faces, the scores, an arrow on whose turn it is), the clock, the night
//   · the bedroom (js/dormilon-stage.js): Dralingo snoring in his bed, the turn kid tiptoeing in with the golden feather
//   · MY TURN: a big countdown, quick questions one after another (Kahoot tiles), every right answer = a stroke (+1),
//     a wrong one = he stirs; the big «¡Me retiro!» keeps my points safe. The first turn is guided (coach card + hand).
//   · A FRIEND'S TURN (never a dead phone): «Turno de Hamdan», the «¿Se despierta?» guess, the question live with ✓ / ✗
//     (I can tap what I would say), reactions 🤫 😱 😂 👏 floating over the bed, «Tu turno: después de Aileen».
//   · the wake-up: he bolts up, rays, the gong, «¡Se despertó!»; the kid who woke him loses all their points
//   · «¡FINAL!» → my board's ceremony: the bonus stars, «¿Quién gana tu tablero?», the winner, my card.
// Test hooks: DormilonPhone.frame(), DormilonPhone.answer(i), DormilonPhone.freeze(v).
(function () {
  'use strict';
  const A = '/assets/dormilon/', H = '/assets/halcon/', K = '/assets/kingdoms/', PARTY = '/assets/party/', MO = '/assets/monopoly/';
  const $ = (id) => document.getElementById(id);
  const S = () => window.DormStage;
  const HB = () => window.HalconBoard;
  const P = () => window.DralyParty || null;
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const sfx = (url, vol) => { const s = window.KingdomsSkin; if (s && s.sfx) s.sfx(url, vol); };
  const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (_) {} };
  const COLORS = ['red', 'blue', 'yellow', 'green'];
  const SHAPES = ['▲', '◆', '●', '■'];
  // the music steps back during MY turn so the snore, the creaks and my heartbeat carry (player-kingdoms-skin.js musicVol)
  const duck = (low) => { const k = window.KingdomsSkin; if (k && k.musicVol) k.musicVol(low ? 0.1 : 0.32); };
  // Dralingo woken up: funny-grumpy, never scary (his personality: wise, super friendly — cast.md)
  const WAKE_LINES = ['¡¿Quién me despertó?! Soñaba con dumplings… 🥟', '¡Uaaah! ¡Hasta un dragón sabio necesita su siesta!', '¡Te vi con esa pluma! 😤', '¡Ay, qué cosquillas! …bueno, a dormir otra vez.', '¡Shhh! ¡Mañana tengo clase de Chino Mandarín!'];
  const fmtClock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  let ctx = null, on = false, stage = null;
  let g = null;              // { id, you (k), b, phase }
  let seats = [];            // my board [{ k, name, skin, score, on }]
  let turn = null;           // { k, phase: 'pre'|'turn', until, guided, pats }
  let myQ = null, myLocked = false, bq = null, myPick = -1;
  let endsAt = 0, paused = false, frenzy = false, cue = 0, night = 1, guessed = null, coachStep = 0;
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
  // the platform's «🔊 Sonido» button sits in the bedroom's corner while the game plays (never over «¡Me retiro!» or the
  // tiles), and goes back to its own place for the lobby, the ceremony and other games
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
      const sc = document.createElement('b');
      sc.textContent = x.score;
      sc.id = 'dm-sc-' + x.k;
      r.append(i, n, sc);
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
  function paintClock() {
    const left = endsAt ? (paused ? pausedLeft : endsAt - Date.now()) : 0;
    $('dm-clock').textContent = endsAt ? fmtClock(left) : '·:··';
    $('dm-clock').classList.toggle('hurry', !!endsAt && left <= 30000);
    if (turn && turn.phase === 'turn') {
      const tl = paused ? turn.pausedLeft : turn.until - Date.now();
      const sec = Math.max(0, Math.ceil(tl / 1000));
      const big = $('dm-count');
      if (big && big.dataset.s !== String(sec)) {
        big.dataset.s = String(sec);
        big.textContent = sec;
        big.classList.toggle('hurry', sec <= 3);
        if (mine() && sec <= 3 && sec > 0 && !paused) sfx(PARTY + (sec % 2 ? 'tick.mp3' : 'tock.mp3'), 0.55);
      }
      const ring = $('dm-ring');
      if (ring && turn.total) ring.style.setProperty('--p', Math.max(0, Math.min(1, tl / turn.total)).toFixed(3));
    }
  }
  let pausedLeft = 0;
  function runClock() { if (!clockT) clockT = setInterval(paintClock, 250); paintClock(); }
  function paintNight() { $('dm-night').textContent = 'Noche ' + night; }

  // the snore: every few seconds while he sleeps, louder when he gets restless (the sound of the danger on MY phone)
  function snoreLoop() {
    stopSnore();
    const go = () => {
      if (!on || paused) { snoreT = setTimeout(go, 1500); return; }
      if (cue < 4 && g && g.phase === 'play') sfx(A + (cue >= 1 ? 'snore-loud.mp3' : 'snore.mp3'), cue >= 2 ? 0.6 : cue >= 1 ? 0.45 : 0.32);
      snoreT = setTimeout(go, cue >= 3 ? 2700 : cue >= 1 ? 3200 : 4200);
    };
    snoreT = setTimeout(go, 1200);
  }
  function stopSnore() { if (snoreT) { clearTimeout(snoreT); snoreT = null; } }
  function setCue(n) {
    const was = cue;
    cue = n;
    if (stage) stage.setCue(n);
    if (n >= 2 && n > was && n < 4) sfx(A + (n >= 3 ? 'creak2.mp3' : 'creak.mp3'), 0.6);
    // the danger under my thumb: «¡Me retiro!» warms (gold → orange → pulsing red) and my heart beats on my turn
    const st = $('dm-stop');
    if (st) st.className = 'dm-stop c' + Math.min(3, n);
    if (mine() && n >= 3 && n > was && n < 4) { sfx('/assets/escape/heartbeat.mp3', 0.7); buzz([50, 80, 50]); }
    const m = $('dm-meter');
    if (m) { m.className = 'dm-meter c' + Math.min(4, n); m.textContent = n >= 4 ? '😡 ¡Despierto!' : n >= 3 ? '😣 ¡Casi se despierta!' : n >= 2 ? '😟 Se está moviendo…' : n >= 1 ? '😪 Ronca más fuerte' : '😴 Duerme profundo'; }
  }

  // ---------- the panel: my turn / a friend's turn ----------
  function panel(mode) {
    ['dm-mine', 'dm-watch', 'dm-msg'].forEach((id) => $(id).classList.toggle('hidden', id !== mode));
  }
  function msg(big, small, kind, img) {
    panel('dm-msg');
    const box = $('dm-msg');
    box.className = 'dm-msg' + (kind ? ' ' + kind : '');
    $('dm-msg-big').textContent = big || '';
    $('dm-msg-small').textContent = small || '';
    const im = $('dm-msg-img');
    if (img) { im.src = img; im.classList.remove('hidden'); } else im.classList.add('hidden');
  }
  function whenMine() {
    if (!g || !seats.length || !turn) return '';
    const n = seats.length;
    const ti = seats.findIndex((x) => x.k === turn.k);
    const mi = seats.findIndex((x) => x.k === g.you);
    if (ti < 0 || mi < 0) return '';
    const d = (mi - ti + n) % n;
    if (d === 0) return '';
    if (d === 1) return '¡Tú sigues! Prepárate';
    return 'Tu turno: después de ' + seats[(mi - 1 + n) % n].name;
  }
  function watch(k) {
    panel('dm-watch');
    $('dm-w-who').textContent = nameOf(k);
    $('dm-w-img').src = S() ? S().head(skinOf(k)) : '';
    $('dm-w-next').textContent = whenMine();
    paintGuess();
    paintBq();
  }
  function paintGuess() {
    const box = $('dm-guess');
    if (turn && turn.guided && turn.k !== (g && g.you)) {
      // a friend's first turn is the class's lesson (he never wakes then): watch, no guess
      box.classList.remove('hidden');
      box.classList.add('done');
      $('dm-guess-q').textContent = '👀 Primer turno de ' + nameOf(turn.k) + ': ¡mira cómo se juega!';
      $('dm-tally').textContent = '';
      return;
    }
    const open = turn && turn.k !== (g && g.you) && (turn.phase === 'pre' || (turn.phase === 'turn' && Date.now() - turn.startAt < 1700));
    box.classList.toggle('hidden', !open && !guessed);
    box.classList.toggle('done', !!guessed);
    document.querySelectorAll('#dm-guess button').forEach((b) => { b.disabled = !!guessed || !open; b.classList.toggle('picked', guessed === b.dataset.g); });
    $('dm-guess-q').textContent = guessed ? (guessed === 'wake' ? '😱 Dijiste: ¡se despierta!' : '😴 Dijiste: sigue dormido') : '¿Se despierta en este turno?';
  }
  function paintBq() {
    const box = $('dm-bq');
    if (!bq) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    $('dm-bq-text').textContent = bq.text;
    const opts = $('dm-bq-opts');
    opts.innerHTML = '';
    bq.answers.forEach((a, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dm-bqo ' + COLORS[i % 4] + (myPick === i ? ' picked' : '');
      b.textContent = a;
      b.addEventListener('click', () => { if (!bq || bq.done) return; myPick = i; sfx(A + 'tap.mp3', 0.5); paintBq(); });
      opts.appendChild(b);
    });
    $('dm-bq-hint').textContent = bq.done ? '' : myPick >= 0 ? '¡Ya elegiste! Mira si acierta…' : '¿Tú qué dirías? Toca (sin puntos)';
  }
  function markBq(idx, correctIdx) {
    if (!bq) return;
    bq.done = true;
    const btns = document.querySelectorAll('#dm-bq-opts .dm-bqo');
    btns.forEach((b, i) => { b.disabled = true; if (i === correctIdx) b.classList.add('ok'); else if (i === idx) b.classList.add('no'); });
    if (myPick >= 0) {
      const right = myPick === correctIdx;
      $('dm-bq-hint').textContent = right ? '¡Tú también lo sabías! ✓' : 'Era «' + bq.answers[correctIdx] + '»';
      $('dm-bq-hint').className = 'dm-bq-hint ' + (right ? 'ok' : 'no');
    } else $('dm-bq-hint').textContent = '';
  }
  // my question
  function paintMyQ() {
    panel('dm-mine');
    const box = $('dm-mq');
    if (!myQ) { box.classList.add('wait'); $('dm-mq-text').textContent = '¡Atento!'; $('dm-tiles').innerHTML = ''; return; }
    box.classList.remove('wait');
    $('dm-mq-text').textContent = myQ.text;
    const im = $('dm-mq-img');
    if (myQ.image) { im.src = myQ.image; im.classList.remove('hidden'); } else { im.classList.add('hidden'); im.removeAttribute('src'); }
    const tiles = $('dm-tiles');
    tiles.innerHTML = '';
    tiles.classList.toggle('three', myQ.answers.length === 3);
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
    coach();
  }
  function answer(i) {
    if (!myQ || myLocked || paused || !mine()) return;
    myLocked = true;
    const b = document.querySelectorAll('#dm-tiles .dm-tile')[i];
    if (b) b.classList.add('chosen');
    document.querySelectorAll('#dm-tiles .dm-tile').forEach((x) => { x.disabled = true; });
    sfx(K + 'tap.mp3', 0.5);
    ctx.socket.emit('player:dm-answer', { pin: ctx.getPin(), qid: myQ.qid, idx: i });
    ctx.markActivity();
  }
  function stopTurn() {
    if (!mine() || !turn || turn.phase !== 'turn' || paused) return;
    $('dm-stop').disabled = true;
    sfx(A + 'tap.mp3', 0.6);
    ctx.socket.emit('player:dm-stop', { pin: ctx.getPin() });
  }
  // the guided first turn: the coach card + the hand on the answers, then on «¡Me retiro!»
  function coach() {
    const box = $('dm-coach');
    const hand = $('dm-hand');
    if (!turn || !turn.guided || !mine() || turn.phase !== 'turn') { box.classList.add('hidden'); hand.className = 'dm-hand hidden'; return; }
    box.classList.remove('hidden');
    if (coachStep === 0) {
      $('dm-coach-big').textContent = 'Responde bien = una cosquilla ✨';
      $('dm-coach-small').textContent = '+1 punto cada una. ¡Pero no lo despiertes!';
      hand.className = 'dm-hand on-tiles';
    } else {
      $('dm-coach-big').textContent = '¿Otra cosquilla o te retiras?';
      $('dm-coach-small').textContent = 'Toca «¡Me retiro!» y tus puntos quedan a salvo';
      hand.className = 'dm-hand on-stop';
    }
  }

  // ---------- the events ----------
  function applyInit(d) {
    if (!d) return;
    const fresh = !g || g.id !== d.id;
    g = { id: d.id, you: d.you ? d.you.k : null, b: d.board ? d.board.id : null, phase: d.phase };
    show();
    if (fresh) { guessed = null; coachStep = 0; bq = null; myPick = -1; }
    paused = !!d.paused;
    $('dm-pause').classList.toggle('hidden', !paused);
    if (d.endsMs != null) { endsAt = Date.now() + d.endsMs; pausedLeft = d.endsMs; }
    frenzy = !!d.frenzy;
    document.body.classList.toggle('dm-frenzy', frenzy);
    const bd = d.board;
    if (bd) {
      seats = bd.seats.slice();
      night = bd.night || 1;
      paintNight();
      if (stage && bd.phase !== 'wake') stage.sleep();        // (no wake-up rays left over after a reconnect)
      setCue(bd.cue || 0);
      const tk = bd.turn;
      if (tk && (bd.phase === 'pre' || bd.phase === 'turn')) {
        const total = bd.phase === 'turn' ? (d.turnMs || bd.phaseMs) : bd.phaseMs;
        turn = { k: tk, phase: bd.phase, until: Date.now() + (bd.phase === 'turn' ? (d.turnMs || 0) : bd.phaseMs), startAt: bd.phase === 'turn' ? 0 : Date.now(), guided: !!bd.guided, pats: bd.pats || 0, total: Math.max(total, 1), pausedLeft: d.turnMs || 0 };
        if (stage) { stage.kid(skinOf(tk), nameOf(tk), { me: tk === g.you }); stage.featherOn(bd.phase === 'turn'); }
      } else { turn = null; if (stage) stage.kid(null); }
      if (bd.phase === 'wake' && stage) stage.wake();
      if (d.you) guessed = d.you.guess || guessed;
    }
    paintList();
    if (d.you) setScore(d.you.k, d.you.score);
    if (d.q && turn && mine()) {
      turn.until = Date.now() + (d.q.ms || 0);
      if (!myQ || myQ.qid !== d.q.qid || $('dm-mine').classList.contains('hidden')) { myQ = d.q; paintMyQ(); }   // (a resync of the same question keeps my tap)
    }
    else if (turn && mine() && turn.phase === 'turn') { myQ = null; paintMyQ(); }
    else if (turn && turn.phase === 'pre' && mine()) msg('¡Te toca!', 'Prepárate: responde bien = una cosquilla', 'go', S() ? S().tiptoe(skinOf(g.you)) : null);
    else if (turn) { bq = d.bq ? Object.assign({}, d.bq) : bq; watch(turn.k); }
    else if (d.phase === 'countdown' || d.phase === 'intro') msg('¡Shhh!', 'Dralingo está durmiendo…', 'calm');
    else msg('😴', 'Dralingo duerme…', 'calm');
    if (d.phase === 'play' || d.phase === 'intro') runClock();
    if (d.phase === 'play') snoreLoop();
    duck(!!(turn && mine() && turn.phase === 'turn'));
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
        stopAll(); g = null; turn = null; myQ = null; bq = null;
        placeMute(false);
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
      stopAll(); g = null; turn = null; myQ = null; bq = null; guessed = null; coachStep = 0; endsAt = 0; cue = 0; night = 1;
      document.body.classList.remove('dm-ended', 'dm-frenzy');
      const old = $('dm-cer'); if (old) old.remove();
    });
    s.on('dm:init', (d) => { if (on || (d && d.id)) { setOn(true); applyInit(d); ctx.markActivity(); } });
    s.on('dm:seat', (d) => {
      if (!on || !d.board || !g || d.board.id !== g.b) return;
      seats = d.board.seats.slice();
      paintList();
      if (turn && !mine()) $('dm-w-next').textContent = whenMine();
    });
    s.on('dm:intro', (d) => {
      if (!on || !g) return;
      ctx.markActivity();
      g.phase = 'intro';
      if (stage) stage.say('¡Shhh! Dralingo duerme…', 'calm');
      msg('¡Shhh!', 'Responde bien = una cosquilla. ¡No lo despiertes!', 'calm', A + 'feather.webp');
      later((d.ms || 2600) - 700, () => { if (stage) stage.say('¡YA!', 'go', 700); sfx(H + 'start.mp3', 0.7); buzz(30); });
    });
    s.on('dm:play', (d) => {
      if (!on || !g) return;
      g.phase = 'play';
      endsAt = Date.now() + (d.endsMs || 0);
      runClock();
      snoreLoop();
    });
    s.on('dm:pre', (d) => {
      if (!on || !g || d.b !== g.b) return;
      ctx.markActivity();
      clearTimers();
      turn = { k: d.k, phase: 'pre', until: Date.now() + d.ms, startAt: Date.now(), guided: !!d.guided, pats: 0, total: d.ms };
      guessed = null; myQ = null; bq = null; myPick = -1; coachStep = 0;
      if (stage) { stage.kid(skinOf(d.k), nameOf(d.k), { me: d.k === g.you }); stage.featherOn(false); stage.say(''); }
      paintList();
      if (d.k === g.you) {
        msg('¡Te toca!', d.guided ? 'Tu primer turno: te enseño cómo' : 'Responde bien = una cosquilla. ¡Pero no lo despiertes!', 'go', S() ? S().tiptoe(skinOf(g.you)) : null);
        sfx(H + 'round.mp3', 0.7);
        buzz([40, 30, 40]);
      } else {
        watch(d.k);
        if (!d.here) $('dm-w-next').textContent = nameOf(d.k) + ' no está… esperando un momento';
      }
      coach();
    });
    s.on('dm:skip', (d) => {
      if (!on || !g) return;
      if (d && d.b === g.b && d.k != null && stage) stage.say(nameOf(d.k) + ' no está: ¡siguiente!', 'calm', 1500);
      if (d && d.k == null && document.body.classList.contains('dm-ended')) skipCeremony();      // (after the end: «Saltar» → my card)
    });
    s.on('dm:go', (d) => {
      if (!on || !g || d.b !== g.b) return;
      ctx.markActivity();
      turn = { k: d.k, phase: 'turn', until: Date.now() + d.ms, startAt: Date.now(), guided: !!d.guided, pats: 0, total: d.ms };
      if (stage) stage.featherOn(true);
      if (d.k === g.you) {
        myQ = null;
        paintMyQ();
        $('dm-stop').disabled = false;
        duck(true);
        sfx(K + 'whoosh.mp3', 0.5);
      } else {
        watch(d.k);
        later(2100, paintGuess);
      }
      paintClock();
    });
    s.on('dm:q', (d) => {
      if (!on || !g || d.b !== g.b) return;
      ctx.markActivity();
      myQ = d;
      if (turn) { turn.until = Date.now() + (d.ms || 0); if (turn.phase !== 'turn') { turn.phase = 'turn'; turn.total = d.ms; } }
      paintMyQ();
    });
    s.on('dm:nope', (d) => {
      if (!on || !myQ || !d || d.qid !== myQ.qid) return;
      if (d.why === 'closed' || d.why === 'fast') { myLocked = false; document.querySelectorAll('#dm-tiles .dm-tile').forEach((x) => { x.disabled = false; x.classList.remove('chosen'); }); }
    });
    s.on('dm:bq', (d) => {
      if (!on || !g || d.b !== g.b || d.k === g.you) return;
      ctx.markActivity();
      bq = { text: d.text, answers: d.answers, done: false };
      myPick = -1;
      if (turn && !mine()) paintBq();
    });
    s.on('dm:pat', (d) => {
      if (!on || !g || d.b !== g.b) return;
      ctx.markActivity();
      setScore(d.k, d.score, 'bump');
      setCue(d.cue);
      if (turn) turn.pats = d.pats;
      if (stage) stage.stroke(d.pts);
      sfx(A + 'stroke.mp3', 0.75);
      later(160, () => sfx(H + 'pop.mp3', 0.6));
      if (d.k === g.you) {
        buzz(25);
        const t = document.querySelectorAll('#dm-tiles .dm-tile')[d.idx];
        if (t) t.classList.add('ok');
        const f = $('dm-plus');
        f.textContent = '+' + d.pts + (d.streak >= 3 ? ' · ¡' + d.streak + ' seguidas!' : '');
        if (!reduced()) { f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
        if (turn && turn.guided && coachStep === 0) { coachStep = 1; coach(); }
      } else markBq(d.idx, d.idx);
    });
    s.on('dm:miss', (d) => {
      if (!on || !g || d.b !== g.b) return;
      ctx.markActivity();
      setCue(d.cue);
      if (stage) stage.stir();
      sfx(A + 'creak.mp3', 0.7);
      if (d.k === g.you) {
        sfx(K + 'wrong.mp3', 0.45);
        buzz([30, 40, 30]);
        const ts = document.querySelectorAll('#dm-tiles .dm-tile');
        if (ts[d.idx]) ts[d.idx].classList.add('no');
        if (ts[d.correctIdx]) ts[d.correctIdx].classList.add('ok');
        const f = $('dm-plus');
        f.textContent = '¡Se movió! Era «' + d.correctText + '»';
        f.classList.add('no');
        if (!reduced()) { f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
        later(900, () => f.classList.remove('no'));
      } else markBq(d.idx, d.correctIdx);
    });
    s.on('dm:wake', (d) => {
      if (!on || !g || d.b !== g.b) return;
      ctx.markActivity();
      clearTimers();
      const name = nameOf(d.k);
      setScore(d.k, 0, 'zero');
      setCue(4);
      if (stage) { stage.wake(); stage.say('¡Se despertó!', 'wake'); later(1100, () => { if (stage) stage.speak(WAKE_LINES[Math.floor(Math.random() * WAKE_LINES.length)], 2400); }); }
      duck(false);
      turn = null; myQ = null; bq = null;
      paintList();
      sfx(A + 'wake.mp3', 0.9);
      const right = (d.guess || []).includes(g.you);
      if (d.k === g.you) {
        later(500, () => sfx(MO + 'lose.mp3', 0.7));
        buzz([80, 60, 200]);
        msg('¡Lo despertaste! 😱', d.lost ? (d.lost === 1 ? 'Pierdes tu punto… ¡a recuperarlo!' : 'Pierdes tus ' + d.lost + ' puntos… ¡a recuperarlos!') : 'No tenías puntos: ¡nada que perder!', 'wake', A + 'dralingo-awake.webp');
      } else {
        later(450, () => sfx(H + 'aww.mp3', 0.55));
        buzz(60);
        msg('¡' + name + ' lo despertó!', (d.lost ? name + ' pierde ' + d.lost + (d.lost === 1 ? ' punto. ' : ' puntos. ') : '') + (right ? '¡Adivinaste! 🔮' : ''), 'wake', A + 'dralingo-awake.webp');
      }
    });
    s.on('dm:end', (d) => {
      if (!on || !g || d.b !== g.b) return;
      ctx.markActivity();
      if (stage) stage.featherOn(false);
      const right = (d.guess || []).includes(g.you);
      const name = nameOf(d.k);
      setScore(d.k, d.score);
      turn = null; myQ = null; bq = null;
      paintList();
      coach();
      duck(false);
      if (d.why === 'final') { msg('¡Shhh!', '¡Se acabó la noche!', 'calm'); return; }
      const pts = d.pts != null ? d.pts : d.pats;
      if (d.k === g.you) {
        sfx(K + 'correct.mp3', 0.6);
        msg(pts ? '¡A salvo! +' + pts : '¡Turno terminado!', d.why === 'stop' ? 'Te retiraste a tiempo 😌' : d.pats ? '¡Se acabó tu tiempo y sigue dormido!' : 'La próxima: ¡responde para hacerle cosquillas!', 'safe', S() ? S().tiptoe(skinOf(g.you)) : null);
      } else {
        msg(d.why === 'stop' ? name + ' se retiró' : name + ': ¡a salvo!', (pts ? '+' + pts + ' para ' + name + '. ' : '') + (right ? '¡Adivinaste! 🔮' : ''), 'safe', S() ? S().head(skinOf(d.k)) : null);
        if (right) sfx(H + 'yes.mp3', 0.5);
      }
    });
    s.on('dm:night', (d) => {
      if (!on || !g || d.b !== g.b) return;
      night = d.night;
      paintNight();
      setCue(0);
      if (stage) { stage.sleep(); stage.kid(null); stage.say('Noche ' + d.night + ' 🌙 Se vuelve a dormir…', 'calm', 2200); }
      msg('Noche ' + d.night, 'Dralingo se vuelve a dormir… 😴', 'calm', A + 'dralingo-sleep.webp');
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
      if (paused) { pausedLeft = endsAt - Date.now(); if (turn) turn.pausedLeft = turn.until - Date.now(); }
      $('dm-pause').classList.toggle('hidden', !paused);
    });
    s.on('dm:final', (d) => {
      if (!on || !g) return;
      clearTimers(); stopSnore(); duck(false);
      turn = null; myQ = null;
      document.querySelectorAll('#dm-tiles .dm-tile').forEach((x) => { x.disabled = true; });
      $('dm-coach').classList.add('hidden'); $('dm-hand').className = 'dm-hand hidden';
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
        + '<li><div class="dm-step s1"><i class="t r">▲</i><i class="t b">◆</i><i class="t y ok">●</i><i class="t g">■</i></div><span>Responde bien<small>en tu turno</small></span></li>'
        + '<li><div class="dm-step s2"><img src="' + A + 'dralingo-sleep.webp" alt=""><img class="f" src="' + A + 'feather.webp" alt=""><b>+1</b></div><span>Una cosquilla<small>= +1 punto</small></span></li>'
        + '<li><div class="dm-step s3"><img src="' + A + 'dralingo-awake.webp" alt=""><b>0</b></div><span>¡No lo despiertes!<small>si se despierta, pierdes todo</small></span></li>'
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
        sfx(A + 'wake.mp3', 0.8);
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
      else l1.textContent = 'Responde bien en tu turno y hazle cosquillas 🪶';
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
      on, phase: g && g.phase, you: g && g.you, board: g && g.b, seats: seats.map((x) => x.name + ':' + x.score),
      turn: turn && { k: turn.k, phase: turn.phase, mine: mine(), guided: turn.guided }, q: myQ && myQ.text, cue, night, paused, frenzy,
      panel: ['dm-mine', 'dm-watch', 'dm-msg'].find((id) => $(id) && !$(id).classList.contains('hidden')) || null,
    }),
    answer: (i) => answer(i),
    stop: () => stopTurn(),
    freeze: (v) => (DormilonPhone._freeze ? DormilonPhone._freeze(v) : 0),
    stage: () => stage,
  };
})();
