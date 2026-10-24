// Draly Siesta · ¡No despiertes a Dralingo! — the kid's phone (the product). player.js calls DormilonPhone.init(...)
// once; the pastel skin (player-kingdoms-skin.js) routes the sounds, the music, the lobby card and the end screen here.
// v4 (2026-10-24, his «every kid in, every moment; build, then the reveal; little on screen»): the Windows rhythm.
//   · QUESTION WINDOW: the camera out on the bedroom (he sleeps); only my question and my 4 feather slots: a right
//     answer = a golden feather flies into my quiver; a wrong / late / blind one = a feather flies off («fsss»), he shifts.
//   · «¡A hacerle cosquillas!» → PLAY WINDOW (10 s): the camera in, his face fills my phone and EVERY kid of my board
//     rubs at once on their own phone. Each back-and-forth rub spends a feather from my hand; if he stays asleep that
//     feather flies into MY collection «Tus plumas» (a pile of golden feathers by my face, it grows with a soft swish;
//     2 a tickle in the final round); he giggles / squirms / a snore bubble pops; my friends' tickles land live on his
//     face (their head + «+1») and their feathers grow in the top row. «🪶 ¡Guardar mis plumas!» keeps this round's
//     feathers safe. If MY stroke wakes him: the feathers I collected THIS round fly away («fsss»), the ANGRY wake-up
//     floods the whole phone (v3's rage); then he sleeps again and the window goes on.
//   · v4.1 (2026-10-24, his «Everything belongs to the game's story»: "you're not building a tower, you're collecting
//     golden feathers… who has most feathers wins"): one unit, the feather (no coins, no tower).
//   · the tally: «+3 🪶 · Tus plumas: 7», then the next question window.
//   · «¡FINAL!» → my board's ceremony: the bonus stars, the feather piles rise side by side (the reveal), the winner, my card.
// Test hooks: DormilonPhone.frame(), .answer(i), .rub(n, gapMs), .stop(), .freeze(v), .stage().
(function () {
  'use strict';
  const A = '/assets/dormilon/', H = '/assets/halcon/', K = '/assets/kingdoms/', PARTY = '/assets/party/', MO = '/assets/monopoly/';
  const SWISH = A + 'stroke.mp3', POP = '/assets/halcon/pop.mp3', FLYAWAY = A + 'lose-feather-h1.mp3';   // (a feather lands softly; this round's feathers fly away «fsss»)
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
  const MAXF = 4;
  // the music steps back in the play window so the snore, the giggles and the feathers carry (player-kingdoms-skin.js musicVol)
  const duck = (low) => { const k = window.KingdomsSkin; if (k && k.musicVol) k.musicVol(low ? 0.08 : 0.32); };
  // Dralingo woken up: funny-grumpy, never scary (his personality: wise, super friendly — cast.md)
  const WAKE_LINES = ['¡¿QUIÉN ME DESPERTÓ?! ¡Soñaba con dumplings! 🥟', '¡Grrr! ¡Hasta un dragón sabio necesita su siesta! 😤', '¡Te vi con esa pluma! 😠', '¡Grrr… cinco minutitos más! 💢', '¡¿Otra vez cosquillas?! ¡Grrr!'];
  const fmtClock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  let ctx = null, on = false, stage = null, myGot = 0, awakeUntil = 0, tallyShown = false, keepTold = false, keepShown = false;
  let g = null;             // { id, you (k), b, phase }
  let seats = [];            // my board [{ k, name, skin, score, pile, safe, feathers, on, robot }]
  let rd = null;             // the round { n, total, phase: 'qw'|'pwin'|'pw'|'pwout', final, until }
  let myQ = null, myLocked = false;
  let feathers = 0, streak = 0, pile = 0, safe = false, score = 0, first = true, myPats = 0;
  let endsAt = 0, pausedLeft = 0, paused = false, frenzy = false, cue = 0, awake = false;
  let clockT = null, snoreT = null, timers = [];
  const later = (ms, fn) => { const t = setTimeout(fn, Math.max(0, ms)); timers.push(t); return t; };
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  const seat = (k) => seats.find((x) => x.k === k) || null;
  const nameOf = (k) => (seat(k) ? seat(k).name : '');
  const skinOf = (k) => (seat(k) ? seat(k).skin : 'dralingo');
  const inPlay = () => !!(rd && (rd.phase === 'pw' || rd.phase === 'pwin'));
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
  // the platform's «🔊 Sonido» sits in the bedroom's corner while the game plays (never over the tiles or «¡Guardar mis plumas!»)
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
  // the play window = his face fills the phone (the close-up), the question panel steps away
  function setPlay(v) {
    const scr = $('screen-dormilon');
    if (!scr) return;
    scr.classList.toggle('dm-myturn', !!v);
    $('dm-turnhud').classList.toggle('hidden', !v);
    if (stage) stage.closeup(!!v);
    requestAnimationFrame(() => { if (stage) { stage.fit(); if (v) stage.featherAt(null, null, skinOf(g && g.you)); } });
    duck(!!v);
  }
  // my board in the top row: each kid's head, name and feathers collected (in the play window: this round's beside them, ✓ kept)
  function paintList() {
    const box = $('dm-list');
    if (!box) return;
    box.innerHTML = '';
    const play = inPlay() || (rd && rd.phase === 'pwout');
    seats.forEach((x) => {
      const r = document.createElement('div');
      r.className = 'dm-row' + (g && x.k === g.you ? ' me' : '') + (x.on === false ? ' off' : '') + (play && x.safe && x.pile === 0 && x.got ? ' safe' : '');
      r.id = 'dm-row-' + x.k;
      const i = document.createElement('img');
      i.alt = '';
      i.src = S() ? S().head(x.skin) : '';
      const n = document.createElement('span');
      n.className = 'dm-rn';
      n.textContent = g && x.k === g.you ? 'Tú' : x.name;
      // the feathers collected stay (never «3 → 0» at «¡A hacerle cosquillas!»); this round's ride beside them
      const sc = document.createElement('b');
      sc.id = 'dm-sc-' + x.k;
      sc.textContent = '🪶' + (x.score || 0);
      r.append(i, n, sc);
      if (play) { const rp = document.createElement('i'); rp.className = 'dm-rp' + (x.safe && x.got ? ' safe' : ''); rp.id = 'dm-rp-' + x.k; rp.textContent = (x.pile || x.got) ? '+' + (x.pile || x.got) : ''; if (!rp.textContent) rp.style.visibility = 'hidden'; r.appendChild(rp); }
      box.appendChild(r);
    });
  }
  // this round's feathers beside a kid's collection in the top row (cls: '' growing · 'safe' kept · 'fell' flown away)
  function setRp(k, n, cls) {
    const e = $('dm-rp-' + k);
    if (!e) return;
    e.textContent = n ? '+' + n : cls === 'fell' ? '💥' : '';
    e.className = 'dm-rp' + (cls ? ' ' + cls : '');
    e.style.visibility = e.textContent ? '' : 'hidden';
  }
  function bumpRow(k, cls) {
    const r = $('dm-row-' + k);
    if (!r || reduced()) return;
    r.classList.remove('bump', 'fall', 'safe-in'); void r.offsetWidth; r.classList.add(cls);
  }
  function paintMe() { $('dm-me').textContent = '🪶 ' + score; }
  // my quiver: 4 slots, the gold ones are my feathers (in the question panel and in the play window's HUD)
  function paintQuiver(pop) {
    ['dm-quiver', 'dm-hudq'].forEach((id) => {
      const box = $(id);
      if (!box) return;
      if (box.childElementCount !== MAXF) { box.innerHTML = ''; for (let i = 0; i < MAXF; i++) { const s = document.createElement('i'); s.className = 'dm-qs'; box.appendChild(s); } }
      [...box.children].forEach((s, i) => { s.classList.toggle('full', i < feathers); s.classList.toggle('pop', !!pop && i === feathers - 1 && !reduced()); });
    });
    const t = $('dm-qcount');
    if (t) t.textContent = feathers >= MAXF ? '¡Llena!' : feathers + ' de ' + MAXF;
    const x = g && seat(g.you);
    if (x) x.feathers = feathers;
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
  // the question's time bar, drawn from its own deadline (myQ.until): a repaint or a pause never refills it
  let paintedQid = null, qShownAt = 0;
  function qbar() {
    const qt = $('dm-qtime');
    if (!qt || !myQ) return;
    const total = myQ.total || 12000, left = Math.max(0, Math.min(total, (myQ.until || Date.now() + total) - Date.now()));
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
  let frozeAt = 0;
  function freezeQ(v) {
    if (v) { if (!frozeAt) frozeAt = Date.now(); return; }
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

  // ---------- «Tus plumas»: my collection of golden feathers (the play window) ----------
  // a pile by my face: every feather I collected in the game (the ones kept in earlier rounds settled, this round's
  // glowing on top); a tickle that doesn't wake him flies its feather from my hand into the pile
  const PILE_MAX = 15;                       // feathers drawn (a bigger collection shows its number)
  const PILE_AT = (() => { const out = []; [5, 4, 3, 2, 1].forEach((n, r) => { for (let j = 0; j < n; j++) out.push([(j - (n - 1) / 2) * 13, r * 15]); }); return out; })();
  function paintPile(how) {
    const t = $('dm-pile');
    if (!t) return;
    const total = score + pile;                // everything I collected: kept + this round's still at stake
    const stack = t.querySelector('.dm-stack');
    const want = Math.min(PILE_MAX, total);
    while (stack.childElementCount > want) stack.lastChild.remove();
    while (stack.childElementCount < want) {
      const i = stack.childElementCount;
      const c = document.createElement('i');
      c.className = 'dm-pf';
      c.style.setProperty('--x', PILE_AT[i][0] + 'px');
      c.style.setProperty('--y', PILE_AT[i][1] + 'px');
      c.style.setProperty('--r', ((i % 2 ? 1 : -1) * (18 + (i * 37) % 40)) + 'deg');
      stack.appendChild(c);
      if (how === 'add' && !reduced()) c.classList.add('drop');
    }
    const atStake = Math.min(pile, want);       // this round's, not kept yet: they glow (a wake-up takes them)
    [...stack.children].forEach((c, i) => c.classList.toggle('risk', i >= want - atStake));
    t.style.setProperty('--n', Math.ceil(want / 5));
    t.querySelector('.dm-tnum').textContent = total ? total + ' 🪶' : '';
    t.classList.toggle('empty', !total);
    t.classList.toggle('safe', !!safe && myGot > 0);
    if (how === 'add' && !reduced()) { t.classList.remove('jump'); void t.offsetWidth; t.classList.add('jump'); }
  }
  // a tickle that didn't wake him: the feather flies from my hand (the slot it left) into my pile
  function featherToPile() {
    if (reduced()) return;
    const q = $('dm-hudq'), t = $('dm-pile');
    if (!q || !t) return;
    const slots = q.querySelectorAll('.dm-qs');
    const from = slots[Math.max(0, Math.min(slots.length - 1, feathers))] || q;
    const a = from.getBoundingClientRect(), b = t.querySelector('.dm-stack').getBoundingClientRect();
    const f = document.createElement('img');
    f.src = A + 'feather.webp';
    f.alt = '';
    f.className = 'dm-flyf';
    f.style.left = (a.left + a.width / 2 - 22) + 'px';
    f.style.top = (a.top + a.height / 2 - 22) + 'px';
    document.body.appendChild(f);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height * 0.4 - (a.top + a.height / 2);
    f.animate([{ transform: 'translate(0,0) rotate(0deg) scale(.8)', opacity: 1 }, { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 70}px) rotate(140deg) scale(1.15)`, opacity: 1, offset: 0.5 }, { transform: `translate(${dx}px, ${dy}px) rotate(300deg) scale(.7)`, opacity: 0.85 }], { duration: 560, easing: 'cubic-bezier(.3,.7,.4,1)' });
    setTimeout(() => f.remove(), 580);
  }
  // he woke up on my tickle: the feathers I collected THIS round fly away out of my pile («fsss»)
  function feathersFlyAway(lost) {
    const t = $('dm-pile');
    if (!t) return;
    const all = [...t.querySelectorAll('.dm-pf')];
    const going = all.slice(Math.max(0, all.length - lost));
    if (!reduced()) {
      going.forEach((c, i) => {
        const a = c.getBoundingClientRect();
        const f = document.createElement('img');
        f.src = A + 'feather.webp';
        f.alt = '';
        f.className = 'dm-flyf dm-flyaway';
        f.style.left = a.left + 'px'; f.style.top = a.top + 'px';
        document.body.appendChild(f);
        const side = i % 2 ? 1 : -1, dx = side * (60 + Math.random() * innerWidth * 0.35), dy = -(innerHeight * (0.45 + Math.random() * 0.3));
        f.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: `translate(${dx * 0.3}px, ${dy * 0.35}px) rotate(${side * 70}deg)`, opacity: 1, offset: 0.35 }, { transform: `translate(${dx * 0.7}px, ${dy * 0.7}px) rotate(${-side * 40}deg)`, opacity: 0.8, offset: 0.7 }, { transform: `translate(${dx}px, ${dy}px) rotate(${side * 110}deg)`, opacity: 0 }], { duration: 1500 + i * 90, easing: 'ease-out' });
        setTimeout(() => f.remove(), 1700 + i * 90);
      });
    }
    pile = 0;
    paintPile();
    if (lost) later(150, () => splash('−' + lost + ' 🪶 ¡Se volaron!', 'no lost', 1700));
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
        e.style.setProperty('--x', Math.round(Math.random() * W) + 'px');
        e.style.setProperty('--y', Math.round(Math.random() * Hh) + 'px');
        e.style.setProperty('--dx', Math.round((Math.random() - 0.5) * W * 0.8) + 'px');
        e.style.setProperty('--dy', Math.round((Math.random() - 0.5) * Hh * 0.6) + 'px');
        e.style.setProperty('--t', (1.1 + Math.random() * 0.9).toFixed(2) + 's');
        e.style.setProperty('--d', Math.round(Math.random() * 900) + 'ms');
        r.appendChild(e);
      }
      // 💢 marks at the edges, never on a chip, the sound button, the top row, «−N», the band or his face
      const placeMarks = () => {
        const avoid = ['#dm-meter', '.muted-toggle', '.dm-top', '#dm-splash', '#dm-stage .dms-band', '#dm-stage .dms-bubble', '#dm-pile', '.dm-hudrow'].map((q) => document.querySelector(q))
          .filter((e) => e && e.offsetParent !== null).map((e) => e.getBoundingClientRect());
        if (stage && stage.angryPoints) {
          const sb = $('dm-stage').getBoundingClientRect(), ap = stage.angryPoints(1.07);
          const xs = [ap.eyeL[0], ap.eyeR[0], ap.mouth[0]], ys = [ap.eyeL[1] - 40, ap.mouth[1] + 40];
          avoid.push({ left: sb.left + Math.min(...xs) - 30, right: sb.left + Math.max(...xs) + 30, top: sb.top + Math.min(...ys), bottom: sb.top + Math.max(...ys) });
        }
        const sw = document.querySelector('.dm-stagewrap');
        if (sw) { const w = sw.getBoundingClientRect(); avoid.push({ left: w.left + w.width / 2 - 120, right: w.left + w.width / 2 + 120, top: w.top + w.height * 0.66 - 55, bottom: w.top + w.height * 0.66 + 55 }); }
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
    scr2.classList.add('dm-raging');
    requestAnimationFrame(() => { if (stage) stage.fit(); });
    rageT = setTimeout(() => { r.classList.add('out'); rageT = setTimeout(rageOff, 520); }, ms || 3300);
  }
  function rageOff() {
    if (rageT) { clearTimeout(rageT); rageT = null; }
    const r = $('dm-rage');
    if (r) { r.className = 'dm-rage hidden'; r.innerHTML = ''; }
    const scr3 = $('screen-dormilon');
    if (scr3 && scr3.classList.contains('dm-raging')) { scr3.classList.remove('dm-raging'); requestAnimationFrame(() => { if (stage) stage.fit(); }); }
    if (stage) stage.calm();
  }
  // the clocks: the game's (top) and the play window's big countdown (red at 3)
  let pausedRound = 0;
  function paintClock() {
    const left = endsAt ? (paused ? pausedLeft : endsAt - Date.now()) : 0;
    $('dm-clock').textContent = endsAt ? fmtClock(left) : '·:··';
    $('dm-clock').classList.toggle('hurry', !!endsAt && left <= 30000);
    if (rd && rd.phase === 'pw') {
      const tl = paused ? pausedRound : rd.until - Date.now();
      const sec = Math.max(0, Math.ceil(tl / 1000));
      const big = $('dm-count');
      if (big && big.dataset.s !== String(sec)) {
        big.dataset.s = String(sec);
        big.textContent = sec;
        big.classList.toggle('hurry', sec <= 3);
        if (!reduced()) { big.classList.remove('tick'); void big.offsetWidth; big.classList.add('tick'); }
        if (sec <= 3 && sec > 0 && !paused && !safe && !awake) sfx(PARTY + (sec % 2 ? 'tick-v2.mp3' : 'tock-v2.mp3'), 0.5);
      }
    }
  }
  function runClock() { if (!clockT) clockT = setInterval(paintClock, 200); paintClock(); }
  function paintRound() {
    const e = $('dm-night');
    if (!e) return;
    e.textContent = rd && rd.n ? (rd.final ? '🌕 ¡Ronda final!' : 'Ronda ' + rd.n + (rd.total ? ' de ' + rd.total : '')) : '';
  }

  // the snore (Higgsfield sounds): every few seconds while he sleeps, louder when he gets restless
  function snoreLoop() {
    stopSnore();
    const go = () => {
      if (!on || paused) { snoreT = setTimeout(go, 1500); return; }
      if (!awake && g && g.phase === 'play') sfx(A + (cue >= 1 ? 'snore-loud-h1.mp3' : 'snore-h1.mp3'), cue >= 2 ? 0.6 : cue >= 1 ? 0.45 : inPlay() ? 0.4 : 0.3);
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
    if (inPlay() && !safe && n >= 3 && n > was && n < 4) { sfx('/assets/escape/heartbeat.mp3', 0.75); buzz([50, 80, 50]); }
    const m = $('dm-meter');
    if (m) { m.className = 'dm-meter c' + Math.min(4, n); m.textContent = n >= 4 ? '😡 ¡Despierto!' : n >= 3 ? '😣 ¡Casi se despierta!' : n >= 2 ? '😟 Se está moviendo…' : n >= 1 ? '😪 Ronca más fuerte' : '😴 Duerme profundo'; }
  }

  // ---------- the panel (question window): the question, a message ----------
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
  function paintStatus() {
    const t = $('dm-status');
    if (!t) return;
    t.textContent = rd && rd.phase === 'qw' && feathers >= MAXF ? '¡Aljaba llena! Sigue respondiendo: un error te quita una' : '';
  }
  // the question (to earn feathers)
  function paintMyQ() {
    if (!rd || rd.phase !== 'qw') return;
    quizView();
    const box = $('dm-mq');
    if (!myQ) { box.classList.add('wait'); $('dm-mq-text').textContent = '…'; $('dm-tiles').innerHTML = ''; $('dm-mq-img').classList.add('hidden'); return; }
    box.classList.remove('wait');
    if (paintedQid === myQ.qid && $('dm-tiles').children.length) { qbar(); return; }   // (the same question: keep its tiles and its time)
    paintedQid = myQ.qid;
    qShownAt = Date.now();
    qbar();
    seenQ();
    const qf = $('dm-qfeed');                                  // a new question: the last answer's «+1 pluma» / «¡Casi!» goes
    if (qf.classList.contains('ans')) { qf.textContent = ''; qf.className = 'dm-qfeed'; }
    if (window.DralyQ) window.DralyQ.fill($('dm-mq-text'), myQ.text); else $('dm-mq-text').textContent = myQ.text;   // «…» red and bold (js/qtext.js)
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
    if (Date.now() - qShownAt < 520) return;                   // (a tap meant for the last question never lands on the new one)
    myLocked = true;
    if ($('dm-qtime')) $('dm-qtime').classList.add('done');
    const b = document.querySelectorAll('#dm-tiles .dm-tile')[i];
    if (b) b.classList.add('chosen');
    document.querySelectorAll('#dm-tiles .dm-tile').forEach((x) => { x.disabled = true; });
    sfx(K + 'tap.mp3', 0.5);
    ctx.socket.emit('player:dm-answer', { pin: ctx.getPin(), qid: myQ.qid, idx: i });
    ctx.markActivity();
  }
  // a gang member cheers a streak (3, 5, 8…) at the panel's edge
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

  // ---------- the play window: rub his head with my finger ----------
  // A stroke = one back-and-forth rub over his head: the finger travels 36 px+ one way, then 36 px+ back (any direction);
  // the leg that finished a stroke never counts as the first leg of the next one (a natural rub ≈ one tickle a 0.7 s, a
  // scribble is faster). A mouse rubs by just moving over him (no button to hold: a laptop kid hovers and it works).
  let rub = null, lastStrokeSent = 0;
  const newRub = (e) => ({ id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0, seg: 0, halves: 0, used: false });
  const canRub = () => !!(rd && (rd.phase === 'pw' || rd.phase === 'pwin') && !paused && !safe && !awake);
  function rubStart(e) {
    if (!canRub()) return;                                    // (in «¡A hacerle cosquillas!» the finger may already rest on him)
    e.preventDefault();
    try { e.target.setPointerCapture(e.pointerId); } catch (_) {}
    rub = newRub(e);
    rubMove(e);
  }
  function rubMove(e) {
    if (rub && !canRub()) { rub = null; return; }
    if (!rub && e.pointerType === 'mouse' && canRub()) rub = newRub(e);
    if (!rub || e.pointerId !== rub.id || !stage) return;
    e.preventDefault();
    const box = $('dm-stage').getBoundingClientRect();
    const [fx, fy] = stage.toCu(e.clientX - box.left, e.clientY - box.top);
    stage.featherAt(fx, fy, skinOf(g.you));
    rub.fx = fx; rub.fy = fy;
    const live = !!(rd && rd.phase === 'pw');
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
    if (rub.halves === 1 && rub.seg >= 36) { rub.halves = 0; rub.used = true; strokeNow(rub.fx, rub.fy); }   // …and 36 px back = a tickle
  }
  function placeHand() {                                     // the guided hand's fingertip on his head
    const h = $('dm-hand');
    if (!stage || !h || !h.classList.contains('rubbing')) return;
    const sb = $('dm-stage').getBoundingClientRect(), hb = $('dm-turnhud').getBoundingClientRect();
    const [px, py] = stage.cuPoint(...stage.cuHead());
    h.style.left = Math.round(sb.left - hb.left + px - 25) + 'px';
    const nb = $('dm-hudname').getBoundingClientRect();
    h.style.top = Math.round(Math.max(sb.top - hb.top + py - 6, nb.height ? nb.bottom - hb.top + 4 : 0)) + 'px';
  }
  function rubEnd(e) { if (rub && e.pointerId === rub.id) rub = null; }
  function rubHint(onHead) {
    const h = $('dm-rubhint');
    if (!h) return;
    if (onHead) { h.textContent = feathers > 0 ? 'Ida y vuelta = una cosquilla' : ''; h.classList.remove('warn'); }
    else { h.textContent = '👆 ¡En su cabeza!'; h.classList.add('warn'); }
  }
  function strokeNow(x, y) {
    const now = Date.now();
    if (now - lastStrokeSent < 260 || feathers <= 0) return;
    lastStrokeSent = now;
    ctx.socket.emit('player:dm-stroke', { pin: ctx.getPin(), x, y });
    ctx.markActivity();
    $('dm-hand').className = 'dm-hand hidden';          // (the guided hand goes once I rub)
  }
  function stopTurn() {
    if (!rd || rd.phase !== 'pw' || paused || safe || awake) return;
    $('dm-stop').disabled = true;
    sfx(A + 'tap.mp3', 0.6);
    ctx.socket.emit('player:dm-stop', { pin: ctx.getPin() });
  }
  // the HUD of the play window: my state in one line (guided the first time), «¡Guardar mis plumas!» or «¡Guardadas!»
  function paintHud() {
    const hn = $('dm-hudname');
    let line = '';
    const empty = feathers <= 0 && !pile && !myGot;           // (nothing to tickle with and nothing built this round)
    if (awake) line = '';
    else if (empty && inPlay()) line = 'Sin plumas esta ronda 🪶 ¡Mira y anima! Responde bien en la próxima';
    else if (safe) line = '';
    else if (first && rd && rd.phase === 'pw' && !pile) line = '¡Frota su cabeza! Si sigue dormido, la pluma es tuya 🪶';
    else if (!keepTold && rd && rd.phase === 'pw' && pile) { line = 'Guárdalas y nadie te las quita esta ronda'; keepShown = true; }
    hn.textContent = line;
    hn.classList.toggle('hidden', !line);
    $('screen-dormilon').classList.toggle('dm-guided', !!line);
    $('screen-dormilon').classList.toggle('dm-safe', !!safe && !empty);
    $('screen-dormilon').classList.toggle('dm-empty', empty);
    if (empty) { const h = $('dm-rubhint'); h.textContent = ''; h.classList.remove('warn'); }
    const st = $('dm-stop');
    st.disabled = !(rd && rd.phase === 'pw') || safe || awake || paused;
    st.textContent = empty ? 'Sin plumas' : safe ? '✓ ¡Plumas guardadas!' : '🪶 ¡Guardar mis plumas!';
    $('dm-reacts2').classList.toggle('hidden', !safe || awake);
  }
  // the video's «START!»: a big word lands on his face
  function splash(text, kind, ms) {
    const s = $('dm-splash');
    if (!s) return;
    s.textContent = text;
    s.className = 'dm-splash ' + (kind || '');
    if (!reduced()) { void s.offsetWidth; s.classList.add('on'); }
    later(ms || 1100, () => { if (s.textContent === text) s.className = 'dm-splash hidden'; });
  }
  // his sleepy giggle when a feather tickles him (Higgsfield takes, rotated so it never sounds the same twice in a row)
  let giggleN = 0, lastGiggle = 0;
  function giggle(vol) {
    const now = Date.now();
    if (now - lastGiggle < 260) return;                  // (four kids at once: never a wall of giggles)
    lastGiggle = now;
    giggleN = (giggleN + 1 + Math.floor(Math.random() * 2)) % 3;
    sfx(A + 'giggle-h' + (giggleN + 1) + '.mp3', vol);
  }

  // ---------- the windows ----------
  function enterQW(ms) {
    if (keepShown) keepTold = true;          // (the «Guárdalas…» line: one window is enough)
    rageOff();
    awake = false;
    setPlay(false);
    if (stage) { stage.featherOff(); stage.say(''); }
    $('dm-tallycard').classList.add('hidden');
    tallyShown = false;
    { const qf = $('dm-qfeed'); qf.textContent = ''; qf.className = 'dm-qfeed'; }
    seats.forEach((x) => { x.pile = 0; x.safe = false; x.got = 0; });
    pile = 0; safe = false; myGot = 0;
    paintPile();
    paintList();
    paintRound();
    paintStatus();
    if (!myQ) paintMyQ();
  }
  function enterPWin(ms) {
    myQ = null; paintedQid = null;
    awake = false;
    pile = 0; myGot = 0; safe = feathers <= 0;
    paintPile();
    setPlay(true);
    paintHud();
    paintList();
    const big = $('dm-count');
    big.textContent = Math.round((rd.pwMs || 10000) / 1000); big.dataset.s = ''; big.classList.remove('hurry');
    $('dm-hand').className = 'dm-hand hidden';
    $('dm-rubhint').textContent = feathers ? 'Pon el dedo en su cabeza… 👆' : 'Sin plumas esta ronda: ¡mira y anima!';
    $('dm-rubhint').classList.remove('warn');
    splash('¡A hacerle cosquillas!', 'ready', Math.max(900, (ms || 1600) - 100));
    sfx(H + 'round.mp3', 0.7);
    buzz([40, 30, 40]);
  }
  function enterPW() {
    paintHud();
    if (!safe) {
      $('dm-hand').className = first ? 'dm-hand rubbing' : 'dm-hand hidden';
      if (first) requestAnimationFrame(() => requestAnimationFrame(placeHand));
      rubHint(true);
      splash('¡YA!', 'go', 800);
      sfx(K + 'whoosh.mp3', 0.5);
      buzz(30);
    } else splash('¡Mira!', 'go', 800);
    paintClock();
  }
  function enterPWOut(d) {
    rub = null;
    $('dm-hand').className = 'dm-hand hidden';
    const row = d && d.tally ? (d.tally.find((t) => t.b === g.b) || null) : null;
    if (row) row.rows.forEach((x) => { const s = seat(x.k); if (s) { s.score = x.score; s.got = x.got; s.pile = 0; s.safe = true; } });
    const mine = row && row.rows.find((x) => x.k === g.you);
    const got = mine ? mine.got : myGot;
    if (mine) { score = mine.score; feathers = mine.feathers; }
    pile = 0; safe = true;
    if (tallyShown) { paintMe(); paintList(); return; }      // (my board's tally already came: «bdone»)
    tallyShown = true;
    paintMe();
    paintList();
    later(awake ? Math.max(0, awakeUntil - Date.now()) : 200, () => {
      setPlay(false);
      rageOff();
      { const st = $('dm-status'); if (st) st.textContent = ''; }
      if (rd && rd.final) msg('¡Ronda final terminada!', '¡Ahora vemos quién juntó más plumas! 🪶', 'calm');
      else msg('Ahora, ¡a responder!', feathers >= MAXF ? 'Tu aljaba está llena 🪶' : 'Cada acierto = una pluma 🪶 para la próxima ronda', 'calm');
      const c = $('dm-tallycard');
      c.classList.remove('hidden');
      $('dm-tc-big').textContent = got ? '+' + got + ' 🪶' : '+0';
      $('dm-tc-small').textContent = 'Tus plumas: ' + score + (feathers ? ' · en la mano: ' + feathers : '');
      c.classList.toggle('zero', !got);
      if (!reduced()) { c.classList.remove('on'); void c.offsetWidth; c.classList.add('on'); }
      if (got) { sfx(POP, 0.55); buzz(20); }
      paintMe();
    });
    first = false;
  }

  // ---------- the events ----------
  function applyInit(d) {
    if (!d) return;
    const fresh = !g || g.id !== d.id;
    g = { id: d.id, you: d.you ? d.you.k : null, b: d.board ? d.board.id : null, phase: d.phase };
    show();
    if (fresh) { myQ = null; streak = 0; }
    paused = !!d.paused;
    $('dm-pause').classList.toggle('hidden', !paused);
    $('screen-dormilon').classList.toggle('dm-paused', paused);
    if (d.endsMs != null) { endsAt = Date.now() + d.endsMs; pausedLeft = d.endsMs; }
    frenzy = !!d.frenzy;
    document.body.classList.toggle('dm-frenzy', frenzy);
    if (d.you) { feathers = d.you.feathers || 0; pile = d.you.pile || 0; safe = !!d.you.safe; score = d.you.score || 0; first = !!d.you.first; myGot = d.you.got || 0; myPats = 0; }
    rd = d.round ? Object.assign({}, d.round, { until: Date.now() + (d.round.ms || 0) }) : null;
    if (rd && paused) pausedRound = d.round.ms || 0;
    const bd = d.board;
    if (bd) {
      seats = bd.seats.slice();
      awake = !!bd.awake;
      if (stage && !awake) stage.sleep();
      setCue(bd.cue || 0);
    }
    paintMe();
    { const h = $('dm-tlhead'); if (h && S() && g) h.src = S().head(skinOf(g.you)); }   // (my face on «Tus plumas»)
    paintQuiver();
    paintRound();
    const play = inPlay();
    setPlay(play);
    paintPile();
    if (play) { paintHud(); paintClock(); }
    if (awake && stage) { stage.wake(); stage.rage(Math.min(4000, bd.wakeMs || 0)); rageOn(Math.min(4000, bd.wakeMs || 0)); } else rageOff();
    if (d.q && rd && rd.phase === 'qw') { if (!myQ || myQ.qid !== d.q.qid || $('dm-quiz').classList.contains('hidden')) { myQ = d.q; myQ.total = 12000; myQ.until = Date.now() + (d.q.ms != null ? d.q.ms : 12000); paintMyQ(); } }
    else if (!play) { myQ = null; if (d.phase === 'play' && rd && rd.phase === 'qw') paintMyQ(); else msg('¡Shhh!', 'Dralingo está durmiendo…', 'calm'); }
    paintList();
    paintStatus();
    if (d.phase === 'play' || d.phase === 'intro') runClock();
    if (d.phase === 'play') snoreLoop();
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
    let lastReact = 0;
    document.querySelectorAll('#dm-reacts2 button').forEach((b) => b.addEventListener('click', () => {
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
        stopAll(); g = null; rd = null; myQ = null;
        placeMute(false);
        setPlay(false);
        document.body.classList.remove('dm-ended', 'dm-frenzy');
        const old = $('dm-cer'); if (old) old.remove();
      }
      if (g && st.players) {
        const off = {};
        Object.values(st.players).forEach((p) => { off[String(p.name).toLowerCase()] = !!p.off; });
        let ch = false;
        seats.forEach((x) => { if (x.robot) return; const k = String(x.name).toLowerCase(); if (k in off && x.on === off[k]) { x.on = !off[k]; ch = true; } });
        if (ch) paintList();
      }
    });
    s.on('countdown', () => {
      if (!on) return;
      stopAll(); g = null; rd = null; myQ = null; endsAt = 0; cue = 0; feathers = 0; streak = 0; pile = 0; safe = false; score = 0; first = true; awake = false; keepTold = false; keepShown = false;
      setPlay(false);
      document.body.classList.remove('dm-ended', 'dm-frenzy');
      const old = $('dm-cer'); if (old) old.remove();
    });
    s.on('dm:init', (d) => { if (on || (d && d.id)) { setOn(true); applyInit(d); ctx.markActivity(); } });
    s.on('dm:seat', (d) => {
      if (!on || !d.board || !g || d.board.id !== g.b) return;
      seats = d.board.seats.slice();
      paintList();
    });
    s.on('dm:intro', (d) => {
      if (!on || !g) return;
      ctx.markActivity();
      g.phase = 'intro';
      if (stage) stage.say('¡Shhh! Dralingo duerme…', 'calm');
      msg('¡Shhh!', 'Responde y junta plumas 🪶 · luego, ¡todos le hacen cosquillas a la vez!', 'calm', A + 'feather.webp');
      later((d.ms || 2600) - 700, () => { if (stage) stage.say('¡YA!', 'go', 700); sfx(H + 'start.mp3', 0.7); buzz(30); });
    });
    s.on('dm:play', (d) => {
      if (!on || !g) return;
      g.phase = 'play';
      endsAt = Date.now() + (d.endsMs || 0);
      runClock();
      snoreLoop();
    });
    s.on('dm:round', (d) => {
      if (!on || !g) return;
      ctx.markActivity();
      if (rd && rd.n === d.n && rd.phase === d.phase) { rd.until = Date.now() + (d.ms || 0); rd.total = d.total; rd.final = !!d.final; paintRound(); paintClock(); return; }
      rd = { n: d.n, total: d.total, phase: d.phase, final: !!d.final, until: Date.now() + (d.ms || 0), pwMs: rd && rd.pwMs };
      if (d.phase === 'pwin') rd.pwMs = 10000;
      paintRound();
      if (d.phase === 'qw') enterQW(d.ms);
      else if (d.phase === 'pwin') enterPWin(d.ms);
      else if (d.phase === 'pw') { rd.pwMs = d.ms; enterPW(); }
      else if (d.phase === 'pwout') enterPWOut(d);
    });
    s.on('dm:pwmore', (d) => { if (!on || !g || !rd || rd.phase !== 'pw') return; rd.until = Date.now() + (d.ms || 0); paintClock(); });
    // everyone on my board is done: my round's tally comes now (no still seconds while other boards play)
    s.on('dm:bdone', (d) => { if (!on || !g || d.b !== g.b || !rd || rd.phase !== 'pw') return; enterPWOut({ tally: [{ b: d.b, rows: d.rows }] }); });
    s.on('dm:ready', (d) => {
      if (!on || !g || d.b !== g.b) return;
      (d.feathers || []).forEach((x) => { const st = seat(x.k); if (st) st.feathers = x.feathers; if (g && x.k === g.you) feathers = x.feathers; });
      setCue(d.cue || 0);
      paintQuiver();
      paintHud();
    });
    s.on('dm:skip', (d) => {
      if (!on || !g) return;
      if (document.body.classList.contains('dm-ended')) skipCeremony();      // (after the end: «Saltar» → my card)
    });
    s.on('dm:q', (d) => {
      if (!on || !g || d.b !== g.b) return;
      ctx.markActivity();
      myQ = d;
      myQ.total = d.ms || 12000;
      myQ.until = Date.now() + (d.ms || 12000);
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
        else paintQuiver();
        $('dm-qfeed').textContent = d.gained ? (d.full ? '¡Aljaba llena! 🪶🪶🪶🪶' : '+1 pluma 🪶') : '¡Bien! Tu aljaba ya está llena 🪶';
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
      paintStatus();
      myQ = null;
      later(d.ok ? 320 : 1300, () => { if (!myQ) paintMyQ(); });
    });
    s.on('dm:plume', (d) => { if (on && g && d.b === g.b) { const x = seat(d.k); if (x) x.feathers = d.feathers; } });
    // a wrong / late answer on my board: he shifts in his sleep (everyone sees it, the danger rose; never who)
    s.on('dm:shift', (d) => {
      if (!on || !g || d.b !== g.b) return;
      setCue(d.cue);
      if (stage) stage.shift();
      if (d.k === g.you) return;
      sfx(A + 'creak2.mp3', 0.3);
      const fb = $('dm-qfeed');
      if (fb && !fb.classList.contains('ans')) { fb.textContent = '¡Dralingo se movió! 😬'; fb.className = 'dm-qfeed no'; }
    });
    s.on('dm:nostroke', (d) => {
      if (!on || !d) return;
      if (d.why === 'empty') { rubHint(false); $('dm-rubhint').textContent = '¡Sin plumas!'; }
    });
    // a tickle on my board: mine flies its feather into my collection; a friend's lands live on his face with their head
    s.on('dm:pat', (d) => {
      if (!on || !g || d.b !== g.b) return;
      ctx.markActivity();
      const x = seat(d.k);
      if (x) { x.pile = d.pile; x.feathers = d.feathers; }
      setCue(d.cue);
      const meNow = d.k === g.you;
      if (stage) { if (meNow) stage.cuStroke(d.pts, d.fast); else stage.otherStroke(d.x, d.y, skinOf(d.k), d.pts, d.fast); }
      if (stage && !meNow && d.cue < 4) stage.tickled();
      sfx(A + 'stroke.mp3', meNow ? 0.8 : 0.35);
      if (d.fast) sfx(A + 'creak.mp3', meNow ? 0.6 : 0.3);
      else later(200, () => giggle(meNow ? 0.8 : 0.4));
      bumpRow(d.k, 'bump');
      setRp(d.k, d.pile, '');
      if (meNow) {
        feathers = d.feathers;
        pile = d.pile;
        myPats++;
        paintQuiver();
        const woke = d.cue >= 4;
        if (!woke) { featherToPile(); later(420, () => { paintPile('add'); sfx(POP, 0.45); }); } else paintPile();
        if (stage && d.cue < 4) stage.tickled(true);
        buzz(d.fast ? [25, 30, 25] : 14);
        paintHud();
        if (d.fast) splash('¡Despacio! 😬', 'no', 700);
      }
    });
    s.on('dm:bank', (d) => {
      if (!on || !g || d.b !== g.b) return;
      const x = seat(d.k);
      if (x) { x.safe = true; x.got = (x.got || 0) + (d.pile || 0); x.pile = 0; x.score = d.score; }
      bumpRow(d.k, 'safe-in');
      setRp(d.k, x ? x.got : d.pile, 'safe');
      const sc = $('dm-sc-' + d.k); if (sc) sc.textContent = '🪶' + d.score;
      if (d.k === g.you) {
        safe = true; score = d.score; myGot += d.pile || 0; pile = 0;
        if (d.feathers != null) feathers = d.feathers;
        paintQuiver();
        paintPile();
        keepTold = true;
        paintHud();
        rub = null;
        if (stage) stage.featherOff();
        if (d.pile) { splash('¡Guardadas! +' + d.pile + ' 🪶', 'safe', 1300); sfx(K + 'correct.mp3', 0.6); later(160, () => sfx(SWISH, 0.5)); buzz([20, 30, 20]); }
        else splash('¡Plumas guardadas!', 'safe', 1000);
      }
    });
    s.on('dm:wake', (d) => {
      if (!on || !g || d.b !== g.b) return;
      ctx.markActivity();
      awake = true;
      awakeUntil = Date.now() + (d.ms || 3800);
      rub = null;
      const name = nameOf(d.k);
      const fell = (d.fell || []).find((x) => x.k === d.k);
      const lost = fell ? fell.lost : 0;
      const x = seat(d.k);
      if (x) x.pile = 0;
      bumpRow(d.k, 'fall');
      setRp(d.k, 0, 'fell');
      setCue(4);
      if (stage) { stage.closeup(true); stage.featherOff(); stage.wake(); stage.rage(d.ms || 3800); stage.say(d.k === g.you ? '¡Lo despertaste!' : '¡' + name + ' lo despertó!', 'wake'); later(1100, () => { if (stage) stage.speak(WAKE_LINES[Math.floor(Math.random() * WAKE_LINES.length)], 2200); }); }
      { const sp = $('dm-splash'); if (sp) sp.className = 'dm-splash hidden'; }   // (a «¡YA!» or «¡A salvo!» of a second ago never sits on his angry face)
      rageOn((d.ms || 3800) - 300);
      later(260, () => sfx(A + (Math.random() < 0.5 ? 'angry-h1.mp3' : 'angry-h2.mp3'), 0.85));
      sfx(A + 'wake-h1.mp3', 0.9);
      if (d.k === g.you) {
        feathersFlyAway(lost);
        later(120, () => sfx(FLYAWAY, 0.85));
        later(1600, () => sfx(MO + 'lose.mp3', 0.6));
        buzz([80, 60, 200]);
      } else {
        later(450, () => sfx(H + 'aww.mp3', 0.5));
        buzz(60);
      }
      paintHud();
    });
    // he falls asleep again: a new night (the danger back to 0); the window goes on
    s.on('dm:sleep', (d) => {
      if (!on || !g || d.b !== g.b) return;
      awake = false;
      rageOff();
      if (stage) { stage.sleep(); stage.say(''); }
      setCue(d.cue || 0);
      if (rd && rd.phase === 'pw') {
        setPlay(true);
        paintHud();
        if (!safe && feathers > 0) { splash('¡Se durmió! ¡Sigue!', 'ready', 1100); later(200, () => { if (stage) stage.featherAt(null, null, skinOf(g.you)); }); }
      }
    });
    s.on('dm:react', (d) => { if (on && g && d.b === g.b && stage) stage.react(d.e, skinOf(d.k)); });
    s.on('dm:frenzy', (d) => {
      if (!on || !g) return;
      frenzy = !d.off;
      document.body.classList.toggle('dm-frenzy', frenzy);
      $('dm-frenzy').classList.toggle('hidden', !frenzy);
      if (frenzy) {
        if (P() && P().news) P().news('¡Ronda final! 🌕', { sub: 'Luna llena: cada cosquilla te da 2 plumas 🪶', kind: 'alarm', ms: 2800 });
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
      if (paused) { pausedLeft = endsAt - Date.now(); if (rd) pausedRound = rd.until - Date.now(); }
      $('dm-pause').classList.toggle('hidden', !paused);
      $('screen-dormilon').classList.toggle('dm-paused', paused);
      freezeQ(paused);
      if (!paused) qbar();
      paintHud();
    });
    s.on('dm:final', (d) => {
      if (!on || !g) return;
      clearTimers(); stopSnore(); duck(false); rageOff();
      rd = null; myQ = null;
      setPlay(false);
      $('dm-tallycard').classList.add('hidden');
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
        + '<li><div class="dm-step s2"><img src="' + A + 'closeup-sleep.webp" alt=""><img class="f" src="' + A + 'feather.webp" alt=""><b>+1 🪶</b></div><span>¡Todos a la vez!<small>frota su cabeza: si sigue dormido, la pluma es tuya</small></span></li>'
        + '<li><div class="dm-step s3"><img src="' + A + 'closeup-awake.webp" alt=""><b>✋</b></div><span>¡No lo despiertes!<small>si lo despiertas tú, se vuelan tus plumas de la ronda · «Guardar mis plumas» las protege</small></span></li>'
        + '</ol>';
      head.after(box);
    }
    $('dm-you-img').src = S() ? S().tiptoe(skin) : '';
    $('dm-you-img').classList.toggle('flip', !!(S() && S().flip(skin)));
    $('dm-you-name').textContent = (window.Saga && window.Saga.labelOf && window.Saga.labelOf(skin)) || 'Dralingo';
  }

  // ---------- the end: my board's ceremony (the feather piles rise side by side), then my card ----------
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
    const showEl = document.createElement('div');
    showEl.className = 'dm-cer-show';
    root.append(st, showEl);
    box.appendChild(root);
    document.body.classList.add('dm-ended');
    const stg = S() ? new (S().Stage)(st, { mode: 'phone' }) : null;
    const Cx = cer = { timers: [] };
    const at = (ms, fn) => Cx.timers.push(setTimeout(fn, ms));
    const H_ = HB();
    const fig = (skin, pose) => (H_ ? H_.art(skin, pose, pose === 'win') : '');
    function scene(title, sub, figs, kind) {
      showEl.innerHTML = '';
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
      showEl.appendChild(c);
      return c;
    }
    // the reveal: every kid's pile of golden feathers rises at once, side by side, the numbers counting up (the most wins)
    function piles(list) {
      const c = scene('¿Quién juntó más plumas?', null, null, 'drum');
      const box2 = document.createElement('div');
      box2.className = 'dm-piles n' + Math.min(5, list.length);
      const top = Math.max(1, ...list.map((r) => r.score));
      const cols = list.map((r) => {
        const col = document.createElement('div');
        col.className = 'dm-tcol' + (r.k === me.k ? ' me' : '') + (r.robot ? ' robot' : '');
        const num = document.createElement('b');
        num.textContent = '0';
        const bar = document.createElement('i');
        bar.className = 'dm-tbar';
        const im = document.createElement('img');
        im.alt = '';
        im.src = S() ? S().head(r.skin) : '';
        const n = document.createElement('span');
        n.textContent = r.k === me.k ? 'Tú' : r.name;
        col.append(num, bar, im, n);
        box2.appendChild(col);
        return { r, num, bar, col };
      });
      c.appendChild(box2);
      const T = reduced() ? 0 : 2200;
      requestAnimationFrame(() => cols.forEach((x) => { x.bar.style.transitionDuration = T + 'ms'; x.bar.style.height = Math.round(8 + 82 * x.r.score / top) + '%'; }));
      const t0 = performance.now();
      const step = () => {
        const k = T ? Math.min(1, (performance.now() - t0) / T) : 1;
        cols.forEach((x) => { x.num.textContent = Math.round(x.r.score * k) + ' 🪶'; });
        if (k < 1 && document.body.contains(box2)) requestAnimationFrame(step);
        else cols.forEach((x) => { if (x.r.rank === 1 && x.r.score > 0) x.col.classList.add('top'); });
      };
      requestAnimationFrame(step);
      sfx('/assets/mochi/drum.mp3', 0.7);
      at(T * 0.4, () => sfx(SWISH, 0.45));
      at(T * 0.8, () => sfx(SWISH, 0.55));
    }
    const STAR_ICO = { ronda: '🪶', prudente: '🛡️', valiente: '🦁', racha: '🔥' };
    const UNIT = { ronda: ['pluma en una ronda', 'plumas en una ronda'], prudente: ['ronda guardada', 'rondas guardadas'], valiente: ['cosquilla', 'cosquillas'], racha: ['seguida', 'seguidas'] };
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
        t += 1900;
      });
    }
    const bots = (bd.robots || []).map((r) => Object.assign({ robot: true, rank: null }, r));   // (robots stand beside, never crowned)
    if (rows.length) { at(t, () => piles(rows.concat(bots).slice(0, 5))); t += 3600; }
    const winners = (bd.winners || []).map((k) => byK[k]).filter(Boolean);
    at(t, () => {
      if (winners.length) {
        scene(winners.length > 1 ? '¡Empate de campeones!' : '¡' + winners[0].name + ' gana!', winners.map((w) => w.score + ' 🪶').join(' · ') + ' · ¡Shhh, que no se despierte! 🤫', winners.map((w) => [w.skin, 'win', w.name]), 'win');
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
    Cx.toCard = () => { Cx.timers.forEach(clearTimeout); Cx.timers = []; card(); };
    at(t, () => Cx.toCard());
    if (me.guest) { Cx.timers.forEach(clearTimeout); Cx.timers = []; at(300, () => Cx.toCard()); }   // (no board of mine: straight to the card)
    function card() {
      showEl.innerHTML = '';
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
      // never a «0» (his rule: «¡La próxima es tuya!»): a kid whose feathers flew away hears what happened instead
      if (me.guest) l1.textContent = 'Mira el proyector: ¡ahí están los campeones! 👀';
      else if (me.score) { l1.innerHTML = 'Tus plumas: <b></b>'; l1.querySelector('b').textContent = me.score + ' 🪶'; }
      else if (me.lost) l1.textContent = 'Juntaste ' + me.lost + (me.lost === 1 ? ' pluma' : ' plumas') + '… ¡y se volaron al despertarlo! 😱';
      else l1.textContent = 'Responde para ganar plumas 🪶 y luego, ¡frota su cabeza!';
      const l2 = document.createElement('p');
      l2.className = 'dm-small';
      const bits = [];
      if (me.pats) bits.push(me.pats + (me.pats === 1 ? ' cosquilla' : ' cosquillas'));
      if (me.wakes) bits.push('lo despertaste ' + (me.wakes === 1 ? '1 vez' : me.wakes + ' veces'));
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
        sc.textContent = r.score + ' 🪶';
        li.append(im, n, sc);
        list.appendChild(li);
      });
      c.appendChild(list);
      if (bots.length) { const rn = document.createElement('p'); rn.className = 'dm-robots-note'; rn.textContent = '🤖 Jugaste con robots: no cuentan para puestos ni estrellas'; c.appendChild(rn); }
      const home = document.createElement('button');
      home.type = 'button';
      home.className = 'dm-home';
      home.textContent = '🏠 Inicio';
      home.addEventListener('click', () => { location.href = '/'; });
      c.appendChild(home);
      showEl.appendChild(c);
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
      on, phase: g && g.phase, you: g && g.you, board: g && g.b, seats: seats.map((x) => x.name + ':' + x.score + ':' + (x.pile || 0) + ':' + x.feathers),
      round: rd && { n: rd.n, phase: rd.phase, final: rd.final, ms: Math.round(rd.until - Date.now()) }, q: myQ && myQ.text, answers: myQ && myQ.answers, feathers, pile, safe, score, cue, awake, paused, frenzy,
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
