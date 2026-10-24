// 6-7 Swing v2 «La Balanza de Oro» — the kid's phone (the product). player.js calls SixSevenPhone.init(...) once; the
// shared phone skin (player-kingdoms-skin.js) gives the lobby look, the sounds and music, and routes the lobby card and
// the end screen here. What this module draws, only while the room's game is 'sixseven':
//   · countdown: the VS run-in (red | blue, Dralingo doing the «6-7» over the VS, my character runs in, my captain)
//   · intro: the rules card with ONE pictured control (a sum, the two buttons, a tapping hand) → «¿Listos?» → «¡YA!»
//   · THE GAME, rapid-fire: the sum (digits or pinyin words) on a card, two giant buttons «6 · liu» and «7 · qi», and
//     above them MY WORLD (2026-10-16, his «I didn't even feel there was a feeling, there's nothing in between»): the
//     golden balance, my team under my pan (me big + two mates), the rivals under theirs, Dralingo at its foot, my gold,
//     my captain's bubble, the live gap («¡Vamos ganando por 3!»). Nothing on this phone is ever dead:
//       - the tap answers AT ONCE: the sum is on screen, so a wrong button is certainly wrong and the right one (after
//         the server's too-fast line) certainly right; the reaction lands on the tap (the two buttons swing like the two
//         palms of the 6-7, my character swings, the voice says «liù» / «qī», my coins fly up into MY TEAM'S PAN, the
//         pan dips, Dralingo does the 6-7). The server's verdict follows and settles the coins (it always wins).
//       - between my sums my teammates' coins fly into our pan (the server's meter feed: who scored), their figures
//         swing, «Sofía +3» pops over the pan, the balance tips live; the next sum swings in like a palm (wipe)
//       - a wrong answer: a wobble, «Era 7 · qī», my captain says something kind, the buttons «¡Recargando!» (rocking
//         gently, a gold bar fills) while the world keeps going above
//       - «¡SIX SEVEN!»: a 6 then a 7 right (a mini stamp), racha 7 and my 67th coin (the big one: Dralingo slides in
//         doing the 6-7, the crowd shout, the palms double-swing, gold confetti), and my team's waves (ss:wave: the
//         whole crew swings, the shout, the balance rocks)
//   · banners at the top edge (lead change, landmark, the last 30 s, waves; never over the buttons), the pause card
//     (with the live score), «¡FINAL!» and the ceremony: the great weigh-in, «¡Gana el Equipo …!» (winners do the 6-7
//     swing, the others sob under a rain cloud), the bonus stars one by one, my own card
// Test hooks: SixSevenPhone.frame(), .tap(6|7), .hold(v), .freeze(v) / .replay(ev), .stage(name), .sim(ev, d), .runIn(),
// .rules(ms), .milestone(n), .six(kind), .gang(mood), .feed(list).
(function () {
  'use strict';
  const X = () => window.SixSevenStage;
  const S = () => window.MochiStage;
  const A = '/assets/sixseven/', K = '/assets/kingdoms/', H = '/assets/halcon/', MO = '/assets/mochi/';
  const $ = (id) => document.getElementById(id);
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const skin = () => window.KingdomsSkin;
  const sfx = (path, vol) => { const s = skin(); if (s && s.sfx) s.sfx(path, vol); };
  const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (_) {} };
  const later = (ms, fn, list) => { const t = setTimeout(fn, Math.max(0, ms)); (list || timers).push(t); return t; };
  const STYLE_NAME = { num: 'Números', zh: 'En Chino', mix: 'Mezcla' };
  const STYLE_EX = { num: '3 + 4', zh: 'sān + sì', mix: '3 + 4 · sān + sì' };
  const PY = ['líng', 'yī', 'èr', 'sān', 'sì', 'wǔ', 'liù', 'qī', 'bā', 'jiǔ', 'shí'];    // with tone marks (2026-10-24)
  const multOf = (s) => (s >= 10 ? 4 : s >= 6 ? 3 : s >= 3 ? 2 : 1);                   // core/sixseven.js streakMult
  const DRAL_AT = { 3: 2, 10: 4 };      // rachas where Dralingo slides in (6 = ×3 is a chip; 7 = «six seven», the big one)
  // the server's beats (R in core/sixseven.js, sent again in ss:init `w`); its verdict corrects a guess anyway
  let WAIT_RIGHT = 650, WAIT_WRONG = 1600, WAIT_WRONG2 = 2600;
  // my coins already in the pan on this screen but not yet in a server meter known to hold them: shown on top of the
  // meter (pendOf) until the first meter after the server's verdict, which always holds them (same socket, in order)
  let shots = [];               // { coins, landed, verdict, covered, cancelled }: my coins this round, until a meter holds them
  const pendOf = () => shots.reduce((a, s) => a + (s.landed && !s.covered && !s.cancelled ? s.coins : 0), 0);

  let ctx = null, on = false;
  let timers = [], introTimers = [], cerTimers = [];
  let g = null;                  // { id, phase, endAt (perf), paused, pausedLeft, frenzy, race, E, style }
  let meter = { r: 0, g: 0, b: null };
  let me = { k: null, coins: 0, streak: 0, right: 0, answered: 0, best: 0, misses: 0 };
  let roster = [];               // [{ k, name, team, avatar, sk, off }]
  let captains = null, style = 'mix';
  let testHold = false;
  const CAST = () => window.DralingoCast;

  // ---------- who I am ----------
  const myTeam = () => (ctx && ctx.getTeam()) || 'red';
  const myName = () => ($('lobby-name') && $('lobby-name').textContent) || '';
  let mySk = '';
  function mySkin() {
    if (mySk) return mySk;
    let v = '';
    try { v = localStorage.getItem('dralyAvatar') || ''; } catch (_) {}
    const list = (window.Saga && window.Saga.AVATARS) || [];
    if (!list.some((a) => a.emoji === v) && !(window.Saga && window.Saga.zoco && window.Saga.zoco(v))) v = (list[0] && list[0].emoji) || '🐉';   // (🪙 a skin of El Zoco stays)
    return S() ? S().skinFor(v, myName()) : 'dralingo';
  }
  const teamName = (t) => (t === 'red' ? 'Fuego' : 'Mar');
  const mine = (t) => t === myTeam();
  const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('es-ES');
  const coinsWord = (n) => (n === 1 ? 'moneda' : 'monedas');
  const byK = (k) => roster.find((p) => p.k === k) || null;

  // ---------- quick sounds (Web Audio: the pop must land on the tap, with no lag) ----------
  let actx = null, loading = false;
  const bufs = {};
  const BUF = { pop: MO + 'pop.mp3', coins: A + 'coins.mp3', wrong: A + 'wrong.mp3', gold: MO + 'gold.mp3',
    combo: MO + 'combo.mp3', liu: A + 'liu.mp3', qi: A + 'qi.mp3', liuqi: A + 'liuqi.mp3', shout: A + 'shout67.mp3' };
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
  function play(name, rate, vol, delay) {
    if (muted() || !actx || !bufs[name]) return;
    try {
      const src = actx.createBufferSource();
      src.buffer = bufs[name];
      src.playbackRate.value = rate || 1;
      const gn = actx.createGain();
      gn.gain.value = vol == null ? 0.7 : vol;
      src.connect(gn).connect(actx.destination);
      src.start(actx.currentTime + (delay || 0) / 1000);
    } catch (_) {}
  }

  // ---------- on / off ----------
  function setOn(v) {
    if (v === on) return;
    on = v;
    document.body.classList.toggle('ssx-on', on);
    if (!on) teardown(true);
  }
  function clearTimers(list) { (list || timers).forEach(clearTimeout); if (list) list.length = 0; else timers = []; }
  function teardown(all) {
    clearTimers();
    clearTimers(introTimers);
    stopQTimer();
    clearTimeout(rescueT);
    cur = null;
    hideIntro();
    pauseUI(false);
    clearInterval(chipT);
    if ($('ssx-chip')) $('ssx-chip').classList.add('hidden');
    const fin = $('ssx-final');
    if (fin) fin.classList.add('hidden');
    document.body.classList.remove('ssx-frenzy', 'ssx-ended', 'ssx-locked', 'ssx-bannering', 'ssx-joined');
    if ($('ssx')) $('ssx').classList.remove('frenzy');
    footDance(0);
    clearTimeout(joinT);
    if ($('ssx-j67')) $('ssx-j67').classList.remove('show');
    [6, 7].forEach((k) => { if (btnFr[k]) { btnFr[k].sway(false); btnFr[k].rest('stand'); } });
    if (all) { clearTimers(cerTimers); const f = $('ssx-finale'); if (f) f.remove(); }
  }

  // ---------- the game screen: my world + the card + the two buttons ----------
  let built = false, bal = null, coins = null, meFig = null, foot = null;
  const btnFr = {};              // 6 → Liu, 7 → Qi (on the buttons)
  const figs = {};               // k → a teammate's / rival's figure in the world
  let crewKey = '';
  function build() {
    if (built || !$('ssx')) return;
    built = true;
    bal = new (X().Balance)($('ssx-bal'));
    coins = new (X().Coins)($('ssx-fx'), 20);
    foot = X().dancer({ alt: '', on: false });
    $('ssx-foot').appendChild(foot);
    // Liu (the 6) lives on the 6 button, Qi (the 7) on the 7 (2026-10-20): a first-time kid sees that liu = 6 and
    // qi = 7 with nobody explaining; my right answer makes that friend cheer, a miss gets its «¡Uy!»
    // (they hang from the card's bottom corners, so they draw over the buttons' corners: the card's layer is above the
    // buttons, whose layer stays under the card so the verdict pill is never hidden)
    btnFr[6] = X().friend('liu', { lite: true, cls: 'ssx-fr six', alt: '' });
    btnFr[7] = X().friend('qi', { lite: true, cls: 'ssx-fr seven', alt: '' });
    [6, 7].forEach((d) => { btnFr[d].setAttribute('aria-hidden', 'true'); $('ssx-card').appendChild(btnFr[d]); });
    X().preloadFriends(true);
    // the press answers at once (pointerdown); the click that follows the same press (even a long one, or a slow
    // laptop mouse) is never a second answer to the NEXT sum. A click with no press before it is a keyboard (Enter / Space).
    const bind = (btn, choice) => {
      let pressAt = -1e9;
      btn.addEventListener('pointerdown', (e) => {
        pressAt = performance.now();
        if (e.pointerType && e.pointerType !== 'mouse' && e.cancelable) e.preventDefault();
        tap(choice);
      });
      btn.addEventListener('click', () => {
        if (performance.now() - pressAt < 2500) return;
        tap(choice);
      });
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    };
    bind($('ssx-b6'), 6);
    bind($('ssx-b7'), 7);
    // a keyboard (a school laptop): 6 and 7, or the arrows
    document.addEventListener('keydown', (e) => {
      if (!on || !cur || $('screen-sixseven').classList.contains('hidden') || e.repeat) return;
      if (e.key === '6' || e.key === 'ArrowLeft') { e.preventDefault(); tap(6); }
      else if (e.key === '7' || e.key === 'ArrowRight') { e.preventDefault(); tap(7); }
    });
  }
  // the crews under the pans: Fuego on the left, Mar on the right; mine = me big in front + two mates, theirs = three
  function paintTeam() {
    const t = myTeam();
    const z = $('ssx');
    if (!z) return;
    z.classList.toggle('red', t === 'red');
    z.classList.toggle('gold', t !== 'red');
    const meName = myName().toLowerCase();
    const others = roster.filter((p) => p.k != null && !p.off && (me.k != null ? p.k !== me.k : String(p.name || '').toLowerCase() !== meName)).sort((a, b) => a.k - b.k);
    const mates = others.filter((p) => p.team === t).slice(0, 2);
    const rivals = others.filter((p) => p.team !== t).slice(0, 2);
    const key = [t, mySkin(), myName(), mates.map((p) => p.k + p.sk).join(','), rivals.map((p) => p.k + p.sk).join(',')].join('|');
    if (key === crewKey) return;
    crewKey = key;
    const L = $('ssx-crew-l'), Rr = $('ssx-crew-r');
    const myBox = t === 'red' ? L : Rr, theirBox = t === 'red' ? Rr : L;
    myBox.className = 'ssx-crew ' + (t === 'red' ? 'l' : 'r') + ' mine';
    theirBox.className = 'ssx-crew ' + (t === 'red' ? 'r' : 'l') + ' rival';
    myBox.textContent = '';
    theirBox.textContent = '';
    if (!meFig || meFig._skin !== mySkin() || meFig._team !== t) {
      meFig = S().kidFigure({ team: t, skin: mySkin(), name: myName(), me: true });
      meFig._team = t;
    }
    X().sixReady(mySkin());                               // the 6-7 pictures load now, so the first wave shows them
    meFig.style.setProperty('--i', 0);
    myBox.appendChild(meFig);
    const fig = (p, i, team) => {
      let f = figs[p.k];
      const sk = p.sk || S().skinFor(p.avatar, p.name);
      if (!f || f._skin !== sk || f._team !== team) { f = S().kidFigure({ team, skin: sk, name: p.name, tag: false }); f._team = team; figs[p.k] = f; X().sixReady(sk); }
      f.style.setProperty('--i', i);
      return f;
    };
    mates.forEach((p, i) => myBox.appendChild(fig(p, i + 1, t)));
    rivals.forEach((p, i) => theirBox.appendChild(fig(p, i, p.team)));
  }
  let lastGap = null, lastLeader = 0;
  // the meter as this phone shows it: the server's, plus my coins that landed before a meter could hold them
  const shown = () => { const p = pendOf(); return myTeam() === 'red' ? { r: meter.r + p, g: meter.g } : { r: meter.r, g: meter.g + p }; };
  function paintMeter() {
    if (!$('ssx-mr')) return;
    const m = shown();
    const sum = m.r + m.g;
    $('ssx-mr').style.transform = `scaleX(${(sum ? m.r / sum : 0.5).toFixed(3)})`;
    $('ssx-rn').textContent = fmt(m.r);
    $('ssx-gn').textContent = fmt(m.g);
    const t = myTeam();
    const a = Math.round(t === 'red' ? m.r : m.g), b = Math.round(t === 'red' ? m.g : m.r);
    const gap = a - b;
    const st = $('ssx-status');
    let txt, cls;
    if (!a && !b) { txt = '¡A llenar la balanza!'; cls = ''; }
    else if (!gap) { txt = '¡Empate! ¡A tocar!'; cls = 'close'; }
    else if (gap > 0) {
      // ahead, but the other team is closing in: say so (the race is alive)
      const closing = lastGap != null && gap < lastGap && gap <= Math.max(4, Math.round(0.08 * (a + b)));
      txt = closing ? `¡Nos alcanzan! Solo ${fmt(gap)}` : `¡Vamos ganando por ${fmt(gap)}!`;
      cls = closing ? 'close' : 'ahead';
    } else { txt = gap === -1 ? '¡Falta 1 para alcanzarlos!' : `¡Faltan ${fmt(-gap)} para alcanzarlos!`; cls = 'behind'; }
    const leader = Math.sign(gap);
    if (st.textContent !== txt) st.textContent = txt;
    st.className = 'ssx-status ' + cls;
    if (leader !== lastLeader && leader !== 0 && !reduced()) { void st.offsetWidth; st.classList.add('pop'); }
    lastLeader = leader;
    lastGap = gap;
    if (bal) { bal.set(X().tilt(m.r, m.g)); bal.fill(m.r, m.g, (g && g.E) || 100); }
  }
  function paintCounter(bumpIt) {
    if (!$('ssx-n')) return;
    $('ssx-n').textContent = fmt(me.coins);
    if (bumpIt) bump($('ssx-count'));
  }
  const bump = (n) => { if (!reduced() && n && n.animate) n.animate([{ transform: 'scale(1.22)' }, { transform: 'scale(1)' }], { duration: 240, easing: 'cubic-bezier(.22,1,.36,1)' }); };
  function paintCombo(streak, mult) {
    const el = $('ssx-combo');
    if (!el) return;
    if (!(streak >= 2)) { el.className = 'ssx-combo'; el.textContent = ''; return; }
    mult = mult || multOf(streak);
    el.className = 'ssx-combo show' + (mult >= 3 ? ' fire' : mult >= 2 ? ' hot' : '');
    el.textContent = '';
    el.append(Object.assign(document.createElement('b'), { textContent: `Racha ${streak}` }));
    el.append(Object.assign(document.createElement('span'), { textContent: mult > 1 ? `×${mult} oro` : '¡1 más: ×2!' }));
  }
  // Dralingo at the foot of the balance does the 6-7 for a moment (my team scored), or all the time (the last 30 s)
  let footT = null;
  function footDance(ms) {
    if (!foot) return;
    clearTimeout(footT);
    if (g && g.frenzy && ms !== 0) { foot.play(true); return; }
    if (!ms) { foot.play(false); return; }
    foot.play(true);
    footT = setTimeout(() => { if (foot && !(g && g.frenzy)) foot.play(false); }, ms);
  }
  // a crew cheers together (the 6-7 swing) for a moment
  function crewCheer(team, ms) {
    const box = $(team === 'red' ? 'ssx-crew-l' : 'ssx-crew-r');
    if (!box) return;
    X().sixCrew(box, ms || 2000);                          // the whole crew does the 6-7 (a picture, not motion)
    if (reduced()) return;
    box.classList.remove('cheer');
    void box.offsetWidth;
    box.classList.add('cheer');
    later(ms || 2000, () => box.classList.remove('cheer'));
  }
  // a server meter arrived: every shot whose verdict came before it is now inside it (no more pending)
  function coverShots() {
    shots.forEach((s) => { if (s.verdict) s.covered = true; });
    shots = shots.filter((s) => !s.cancelled && !(s.covered && s.landed));
  }

  // ---------- my captain's bubble (the gang reacts, never over the buttons) ----------
  let gangT = null, gangAt = 0;
  function gang(mood, o) {
    o = o || {};
    const id = captains && captains[myTeam()];
    const box = $('ssx-gang');
    if (!id || !CAST() || !box) return;
    const now = Date.now();
    if (!o.force && now - gangAt < 3500) return;
    if ($('ssx-dral') && $('ssx-dral').classList.contains('show')) return;   // Dralingo is on: his moment
    gangAt = now;
    const img = $('ssx-gang-img');
    const p = CAST().pose(id, o.pose || (mood === 'oops' || mood === 'casi' ? 'hello' : 'cheer'));
    if (img.getAttribute('src') !== p) img.src = p;
    img.alt = CAST().name(id);
    $('ssx-gang-say').textContent = o.text || CAST().line(id, mood);
    if ($('ssx-who')) { clearTimeout(whoT); $('ssx-who').classList.remove('show'); }   // (the same corner: one at a time)
    box.classList.add('show');
    clearTimeout(gangT);
    gangT = setTimeout(() => box.classList.remove('show'), o.ms || 2300);
  }

  // ---------- one sum ----------
  let cur = null;                // { qid, ss, t0, ms, tapped, done, choice, heldAt, heldSum, tapAt, pred }
  let qT = null, rescueT = null, lastTick = 0;
  function showQuestion(q) {
    if (!on || !q || !q.ss) return;
    build();
    paintTeam();
    hideIntro();
    document.body.classList.remove('ssx-locked');
    ctx.showScreen('sixseven');
    if (cur && cur.qid === q.qid) {                      // the same sum again (a resync or a rejoin)
      // the server still has it open, so it never got my tap: a reaction already shown is taken back, the sum is mine again
      if (cur.pred) undoGuess();
      if (cur.tapped && !cur.done) { cur.tapped = false; $('ssx-b6').classList.remove('picked'); $('ssx-b7').classList.remove('picked'); }
      if (!cur.tapped && !cur.done) { setBtns(!(g && g.paused)); runQTimer(); }
      return;
    }
    // a new sum while my last tap is still a guess: the server never judged it (a rejoin dropped that sum): take it back
    if (cur && cur.pred) { const p = cur.pred; cur.pred = null; revertGuess(p); }
    const between = !!(cur && cur.done);                 // it follows an answered sum: the in-between beat ends here
    const ss = q.ss;
    cur = { qid: q.qid, ss, t0: performance.now(), ms: ss.ms || 12000, tapped: false, done: false, choice: null, heldAt: 0, heldSum: 0, tapAt: 0, pred: null };
    const card = $('ssx-card');
    card.className = 'ssx-card' + (ss.zh ? ' zh' : ' num') + (ss.gold ? ' gold' : '');
    const eq = $('ssx-eq');
    eq.innerHTML = '';
    eq.appendChild(X().sum(ss, 'ssx-sum'));
    $('ssx-ask').textContent = '?';
    // a new sum: Liu and Qi calm down at once, so no friend still cheering beside one button pulls the next tap
    [6, 7].forEach((k) => { const f = btnFr[k]; if (f && f.rest && f.dataset && f.dataset.pose !== f._rest) f.rest(f._rest); });
    $('ssx-verdict').className = 'ssx-verdict';
    $('ssx-verdict').textContent = '';
    ['ssx-b6', 'ssx-b7'].forEach((id) => $(id).classList.remove('picked', 'wrong', 'hint', 'right'));
    setBtns(true);
    $('ssx-lock').className = 'ssx-lock';
    if (between) X().wipe(card, eq);                     // the next sum tips in like a palm (alternating sides)
    else if (!reduced() && card.animate) card.animate([{ transform: 'translateY(10px) scale(.97)', opacity: 0.4 }, { transform: 'none', opacity: 1 }], { duration: 170, easing: 'cubic-bezier(.22,1,.36,1)' });
    if (ss.gold) { play('gold', 1.15, 0.45); buzz(20); }
    runQTimer(true);
    if (g && g.paused) { holdQ(true); setBtns(false); pauseUI(true); }
    if (!helped && !reduced()) { helped = true; $('ssx').classList.add('teach'); later(2600, () => { if ($('ssx')) $('ssx').classList.remove('teach'); }); }
    ctx.markActivity();
  }
  let helped = false;
  function setBtns(v) { ['ssx-b6', 'ssx-b7'].forEach((id) => { const b = $(id); if (b) b.disabled = !v; }); }
  const qLeft = () => (cur ? Math.max(0, cur.ms - ((cur.heldAt || performance.now()) - cur.t0 - cur.heldSum)) : 0);
  function runQTimer(fresh) {
    stopQTimer();
    if (!cur) return;
    const bar = $('ssx-qbar');
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
      if (s <= 3 && s > 0 && s !== lastTick) { lastTick = s; bar.parentNode.classList.add('hurry'); sfx(K + 'tick.mp3', 0.45); }
      if (l <= 0) {
        stopQTimer();
        if (cur.tapped) return;
        cur.tapped = true;
        setBtns(false);
        ctx.socket.emit('player:answer', { pin: ctx.getPin(), qid: cur.qid, choiceIdx: -1 }, () => {});   // time up = wrong
      }
    }, 150);
  }
  function stopQTimer() {
    clearInterval(qT);
    qT = null;
    const bar = $('ssx-qbar');
    if (bar && cur) { bar.style.transition = 'none'; bar.style.transform = `scaleX(${(qLeft() / cur.ms).toFixed(3)})`; }
  }
  function holdQ(v) {
    if (!cur) return;
    if (v && !cur.heldAt) { cur.heldAt = performance.now(); stopQTimer(); }
    else if (!v && cur.heldAt) { cur.heldSum += performance.now() - cur.heldAt; cur.heldAt = 0; if (!cur.tapped && !cur.done) runQTimer(); }
  }

  // ---------- the tap: the reaction lands NOW (a certain verdict), the server's verdict settles it ----------
  function tap(choice) {
    audioReady();
    if (!cur || cur.tapped || cur.done || !g || g.phase !== 'play' || g.paused) return;
    cur.tapped = true;
    cur.choice = choice;
    cur.tapAt = performance.now();
    const btn = $(choice === 6 ? 'ssx-b6' : 'ssx-b7');
    btn.classList.add('picked');
    setBtns(false);
    if (!reduced() && btn.animate) btn.animate([{ transform: 'translateY(6px) scale(.95)' }, { transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.22,1,.36,1)' });
    play('pop', 0.92 + Math.min(10, me.streak) * 0.05, 0.55);
    buzz(10);
    stopQTimer();
    const qid = cur.qid;
    ctx.socket.emit('player:answer', { pin: ctx.getPin(), qid, choiceIdx: choice === 6 ? 0 : 1 }, () => {});
    // what the server will say, when it is certain: the sum is on this screen, so a wrong button is wrong, and the
    // right one is right once the sum has been readable for the too-fast line (the server's clock started earlier,
    // so its time is never shorter than this phone's). A right tap faster than that waits for the server.
    const ans = X().sumValue(cur.ss);
    const seen = cur.tapAt - cur.t0 - cur.heldSum;
    // after a pause the phone's held time can be a little longer than the server's shift (the «Seguir» message travels):
    // keep a margin there, so a «certain» right answer is never flipped to «¡Muy rápido!» by the server
    const line = (cur.ss.min || 400) + (cur.heldSum > 0 ? 200 : 0);
    if (ans === 6 || ans === 7) {
      if (choice !== ans) predict(false, ans, seen < line);
      else if (seen >= line) predict(true, ans, false);
    }
    clearTimeout(rescueT);
    // no verdict in 3 s (a Wi-Fi blip): the buttons come back (the server answers a second tap or deals a new sum);
    // a reaction already shown stays and the same answer goes once more (the server judges only the first it gets)
    rescueT = setTimeout(() => {
      if (cur && cur.qid === qid && cur.pred) { ctx.socket.emit('player:answer', { pin: ctx.getPin(), qid, choiceIdx: choice === 6 ? 0 : 1 }, () => {}); return; }
      if (!(cur && cur.qid === qid && cur.tapped && !cur.done)) return;
      cur.tapped = false;
      btn.classList.remove('picked');
      if (g && g.paused) return;               // «Seguir» brings them back (pauseUI)
      setBtns(true);
      runQTimer();
    }, 3000);
    ctx.markActivity();
  }
  function predict(right, ans, maybeFast) {
    const st = right ? me.streak + 1 : 0;
    const mult = right ? multOf(st) : 1;
    const coinsN = right ? mult * (g && g.frenzy ? 2 : 1) : 0;
    const misses = right ? 0 : (me.misses || 0) + 1;
    const r = {
      qid: cur.qid, right, ans, word: PY[ans], choice: cur.choice, streak: st, mult, coins: coinsN, total: me.coins + coinsN,
      gold: !!cur.ss.gold, goldExtra: 0, frenzy: !!(g && g.frenzy), calm: misses >= 2, tooFast: false, timeUp: false,
      wait: right ? WAIT_RIGHT : misses >= 2 ? WAIT_WRONG2 : WAIT_WRONG, maybeFast, predicted: true,
      prev: { coins: me.coins, streak: me.streak, misses: me.misses, right: me.right, answered: me.answered, best: me.best },
    };
    cur.pred = r;
    apply(r);
  }
  // take a guessed reaction back (the server saw it otherwise, or never counted it): my numbers as they were, the coins
  // still in the air never land, the gold they already added to the meter comes off (the next meter settles it anyway)
  function revertGuess(p) {
    const shot = cur && cur.shot;
    if (shot && shot === p.shot) shot.cancelled = true;   // never lands, and comes off the pan if it already did
    paintMeter();
    Object.assign(me, p.prev);
    paintCounter(false);
    paintCombo(me.streak);
    ['ssx-b6', 'ssx-b7'].forEach((id) => $(id).classList.remove('wrong', 'hint', 'right'));
    $('ssx-card').classList.remove('ok', 'no');
    $('ssx-ask').textContent = '?';
    $('ssx-verdict').className = 'ssx-verdict';
    document.body.classList.remove('ssx-locked');
    $('ssx-lock').className = 'ssx-lock';
  }

  // ---------- the verdict ----------
  // r: the server's verdict (or a phone's certain guess, r.predicted). apply() shows it and counts it once.
  function apply(r) {
    me.coins = r.total != null ? r.total : me.coins;
    me.streak = r.streak || 0;
    me.answered++;
    if (r.right) { me.right++; me.best = Math.max(me.best, me.streak); me.misses = 0; }
    else me.misses = r.calm ? 2 : 1;
    cur.done = true;
    cur.tapped = true;
    if (r.right) right(r); else wrong(r);
    ctx.markActivity();
  }
  function onResult(r) {
    if (!on || !r) return;
    clearTimeout(rescueT);
    stopQTimer();
    const same = cur && cur.qid === r.qid;
    const p = same ? cur.pred : null;
    if (p) {
      cur.pred = null;
      if (p.right === r.right) settle(p, r);
      else {
        // the server saw it otherwise (very rare: a sum it had already closed): its verdict wins
        revertGuess(p);
        apply(r);
      }
    } else if (same && !cur.done) apply(r);
    else {
      // (a sum this screen no longer shows)
      me.coins = r.total != null ? r.total : me.coins;
      me.streak = r.streak || 0;
      paintCounter(false);
      paintCombo(me.streak);
      return;
    }
    moments(r);
    ctx.markActivity();
  }
  // the phone's guess and the server agree: take the server's numbers (the golden extra, the exact wait, the reason)
  function settle(p, r) {
    me.coins = r.total;
    me.streak = r.streak || 0;
    me.misses = r.right ? 0 : r.calm ? 2 : 1;
    if (r.right) {
      paintCombo(r.streak, r.mult);
      const shot = cur && cur.shot;
      if (shot) { shot.verdict = true; shot.gold = !!r.gold; shot.frenzy = !!r.frenzy; }
      if (shot && !shot.landed) shot.coins = r.coins;      // lands with the server's count
      else {
        if (shot) shot.coins = r.coins;
        // already landed and the server says more (a golden extra): only the difference pops
        if (r.coins > p.coins) plus(`+${r.coins - p.coins}`, 'gold');
        paintMeter();
        paintCounter(r.coins !== p.coins);
      }
    } else {
      if (r.tooFast) verdict('no', '¡Muy rápido!', `Primero lee la cuenta · era ${r.ans} · ${r.word}`);
      else if (r.timeUp) verdict('no', '¡Se acabó el tiempo!', `Era ${r.ans} · ${r.word}`);
      if (r.calm !== p.calm || r.wait !== p.wait) lockUI(r.calm, Math.max(200, r.wait - (performance.now() - cur.tapAt)));
    }
  }
  // the moments only the server can call: golden sums, rachas, «six seven» (never on a guess)
  let lastMini = 0;
  function moments(r) {
    if (!r.right) {
      // a lost racha or a second miss in a row: the captain says something kind
      if (r.calm) gang('oops', { force: true });
      return;
    }
    // the golden fanfare only when the golden extra is real (the comeback cap can bring it to 0 when my team is a hair
    // behind: then it is a plain right answer, never «¡Pregunta dorada! +1»)
    if (r.gold && r.goldExtra > 0) goldMoment(r);
    if (r.six) mySix(r);
    else if (DRAL_AT[r.streak] || (r.streak > 10 && r.streak % 5 === 0)) milestone(r);
    else if (r.streak === 6) { play('combo', 1.1, 0.5); bump($('ssx-combo')); }
    if (r.pair && !r.six && Date.now() - lastMini > 2500) {
      lastMini = Date.now(); sixStamp('mini', 'liù · qī'); X().palms($('ssx-b6'), $('ssx-b7'), 6, 2, [btnFr[6], btnFr[7]]); buzz([12, 40, 12]);
      if (btnFr[6]) { btnFr[6].react('cheer', 1100); later(140, () => btnFr[7] && btnFr[7].react('cheer', 1000)); }   // a 6 then a 7: both friends
    }
    // now and then (and on the first one) my captain cheers me on
    if (me.right === 1) gang('swing');
    else if (r.streak >= 3 && Math.random() < 0.3) gang('swing');
  }
  function verdict(cls, head, sub) {
    const v = $('ssx-verdict');
    v.className = 'ssx-verdict ' + cls;
    v.textContent = '';
    v.append(Object.assign(document.createElement('b'), { textContent: head }));
    if (sub) v.append(Object.assign(document.createElement('span'), { textContent: sub }));
    void v.offsetWidth;
    v.classList.add('show');
  }
  function right(r) {
    const card = $('ssx-card');
    card.classList.add('ok');
    $('ssx-ask').textContent = String(r.ans);
    const side = r.choice || r.ans;
    $(r.ans === 6 ? 'ssx-b6' : 'ssx-b7').classList.add('right');
    verdict('ok', '¡Sí!', `${r.ans} · ${r.word}`);
    play(r.ans === 6 ? 'liu' : 'qi', 1, 0.95, 40);
    X().palms($('ssx-b6'), $('ssx-b7'), side, 1, [btnFr[6], btnFr[7]]);   // the two buttons do the 6-7 (they are the two palms), Liu and Qi ride them
    if (btnFr[r.ans]) btnFr[r.ans].react('cheer', 1250);   // Liu cheers my 6, Qi my 7 (his friend on the button)
    X().swing(meFig, side, r.mult >= 3);
    X().six(meFig, 760);                                   // my character does the 6-7 too (art batch 2026-10-17)
    buzz(r.mult >= 3 ? [14, 30, 14] : 14);
    // my coins fly from the button I tapped up into MY TEAM'S PAN; when they land the pan dips, my gold counts up
    // (shot: what lands, settled by the server's verdict while the coins are in the air)
    const team = myTeam();
    const from = $(r.ans === 6 ? 'ssx-b6' : 'ssx-b7').getBoundingClientRect();
    const to = bal ? bal.target(team) : null;
    const n = Math.max(1, Math.min(5, r.coins));
    const shot = { coins: r.coins, gold: !!r.gold, frenzy: !!r.frenzy, landed: false, cancelled: false, verdict: !r.predicted, covered: false };
    if (cur) cur.shot = shot;
    r.shot = shot;
    shots.push(shot);
    if (shots.length > 6) shots.shift();
    const land = () => {
      if (shot.landed || shot.cancelled) return;
      shot.landed = true;
      play('coins', 0.95 + Math.min(10, me.streak) * 0.045, 0.5);
      if (bal) bal.bump(team, shot.coins >= 3);
      paintMeter();                                       // (my coins show in our pan now: pendOf until a meter holds them)
      paintCounter(true);
      plus(`+${shot.coins}`, shot.frenzy ? 'x2' : shot.gold ? 'gold' : '');
      footDance(900);
    };
    if (to && coins && !reduced()) {
      for (let i = 0; i < n; i++) {
        coins.fly({ x: from.left + from.width * (0.35 + Math.random() * 0.3), y: from.top + from.height * 0.3 }, { x: to.x + (Math.random() - 0.5) * 30, y: to.y }, {
          size: r.gold && i === 0 ? 36 : 26, gold: r.gold && i < 3, delay: i * 45, ms: 470, arc: 40 + Math.random() * 30, drift: (Math.random() - 0.5) * 50,
          onLand: i === 0 ? land : null,
        });
      }
    } else later(reduced() ? 60 : 400, land);
    paintCombo(r.streak, r.mult);
  }
  function plus(txt, cls) {
    const p = $('ssx-plus');
    p.className = 'ssx-plus ' + (cls || '');
    p.textContent = txt;
    void p.offsetWidth;
    p.classList.add('show');
  }
  // a racha that climbs a multiplier: Dralingo comes in from the far side doing the «6-7» and says «liù, qī!»
  let dralT = null, lastDral = 0;
  function dralIn(text, sound) {
    const now = Date.now();
    if (now - lastDral < 2500) return false;              // one Dralingo at a time
    lastDral = now;
    // Dralingo and my captain take turns: his entrance clears the bubble and holds it for a moment
    clearTimeout(gangT);
    if ($('ssx-gang')) $('ssx-gang').classList.remove('show');
    gangAt = now - 1500;
    const box = $('ssx-dral');
    box.innerHTML = '';
    const d = X().dancer({ alt: '' });
    box.appendChild(d);
    if (text) box.appendChild(Object.assign(document.createElement('b'), { className: 'ssx-dral-say', textContent: text }));
    box.className = 'ssx-dral show';
    if (sound !== false) play('liuqi', 1, 0.85, 220);
    clearTimeout(dralT);
    dralT = setTimeout(() => { box.className = 'ssx-dral'; }, 1900);
    return true;
  }
  function milestone(r) {
    play('combo', 1, 0.55);
    buzz([30, 30, 30, 30, 60]);
    dralIn(DRAL_AT[r.streak] ? `¡Racha ${r.streak}! ×${DRAL_AT[r.streak]} oro` : `¡Racha ${r.streak}!`);
  }
  // «¡SIX SEVEN!» stamped over my world: 'big' (racha 7, my 67th coin) or 'mini' at my pan (a 6 then a 7)
  function sixStamp(kind, sub) {
    const s = $('ssx-six');
    if (!s) return;
    s.className = 'ssx-six ' + kind;
    s.querySelector('span').textContent = sub || 'liù · qī';
    void s.offsetWidth;
    s.classList.add('show');
  }
  // MY «six seven»: racha 7 or my 67th coin. The meme, felt on my phone: the crowd shout, Dralingo doing it, the palms
  // double-swing, my crew swings with me, the balance rocks, gold confetti at the edges
  function mySix(r) {
    const racha = r.six & 1, coin67 = r.six & 2;
    quietUntil = Date.now() + 1400;                      // (the next banner waits: this moment is mine)
    if ($('ssx-who')) { clearTimeout(whoT); $('ssx-who').classList.remove('show'); }   // (no teammate chip over my stamp)
    sixStamp('big', racha ? `Racha ${r.streak} · liù qī` : coin67 ? '67 monedas · liù qī' : 'liù · qī');
    play('shout', 1, 0.85, 60);
    play('liuqi', 1, 0.75, 1000);
    buzz([30, 40, 30, 40, 30, 40, 90]);
    X().palms($('ssx-b6'), $('ssx-b7'), 6, 2);
    crewCheer(myTeam(), 1600);
    if (bal) bal.rock(true);
    footDance(2000);
    join67(1900);                                         // Liu and Qi leap off the buttons and become el 67
    lastDral = 0;                                         // this one always gets Dralingo (the stamp says it: no label)
    dralIn(null, false);
    const conf = $('ssx-conf');
    if (conf && S()) S().confetti(conf, null, 18);
  }
  // «¡SIX SEVEN!» = Liu and Qi team up (2026-10-20): they leap off the two buttons and el 67, the joined buddy, pops up
  // at the foot of my balance cheering; then they drop back onto their buttons. Never over the buttons or the sum.
  let joinT = null;
  function join67(ms) {
    const box = $('ssx-j67');
    if (!box) return;
    if (!box.firstChild) box.appendChild(X().friend('j67', { lite: true, pose: 'cheer', alt: '' }));
    const f = box.firstChild;
    if (f && f.pose) f.pose('cheer');
    box.classList.remove('show');
    void box.offsetWidth;
    box.classList.add('show');
    document.body.classList.add('ssx-joined');
    clearTimeout(joinT);
    joinT = setTimeout(() => { box.classList.remove('show'); document.body.classList.remove('ssx-joined'); }, ms || 1800);
  }
  function goldMoment(r) {
    play('gold', 1, 0.8);
    buzz([40, 30, 40, 30, 90]);
    const c = $('ssx-card').getBoundingClientRect();
    if (coins) coins.burst({ x: c.left + c.width / 2, y: c.top + c.height * 0.6 }, reduced() ? 0 : 10, { spread: 150, fall: 120, size: 26 });
    const f = $('ssx-flash');
    if (f) { f.classList.remove('show'); void f.offsetWidth; f.classList.add('show'); }
    verdict('ok gold', '¡Pregunta dorada!', `+${r.coins} ${coinsWord(r.coins)} · ${r.ans} · ${r.word}`);
  }
  function wrong(r) {
    const card = $('ssx-card');
    card.classList.add('no');
    $('ssx-ask').textContent = String(r.ans);
    const picked = r.choice ? $(r.choice === 6 ? 'ssx-b6' : 'ssx-b7') : null;
    if (picked) { picked.classList.add('wrong'); X().wobble(picked, true); }
    $(r.ans === 6 ? 'ssx-b6' : 'ssx-b7').classList.add('hint');
    // the friend I tapped goes «¡Uy!» (funny, never sad), the right one hops: «¡era yo!»
    if (r.choice && btnFr[r.choice]) btnFr[r.choice].react('uy', 1200);
    if (btnFr[r.ans]) later(220, () => btnFr[r.ans].react('stand', 500));
    if (r.tooFast) verdict('no', '¡Muy rápido!', `Primero lee la cuenta · era ${r.ans} · ${r.word}`);
    else if (r.timeUp) verdict('no', '¡Se acabó el tiempo!', `Era ${r.ans} · ${r.word}`);
    else verdict('no', '¡Uy!', `Era ${r.ans} · ${r.word}`);
    if (meFig) { meFig.pose('no'); X().wobble(meFig, false); later(900, () => { if (meFig) meFig.pose('idle'); }); }
    play('wrong', 1, 0.6);
    buzz([40, 30, 40]);
    paintCombo(0);
    lockUI(r.calm, r.wait || WAIT_WRONG);
    // a first slip: my captain sometimes says something kind (a second one in a row always does: moments())
    if (!r.calm && Math.random() < 0.45) gang('oops');
  }
  // the buttons recharge: «¡Recargando!» (or «¡Respira! Piensa y toca» after two in a row), a gold bar fills, the two
  // buttons rock gently like resting palms; the world above keeps going (my team's coins, the gap, my captain)
  function lockUI(calm, ms) {
    const lock = $('ssx-lock');
    lock.className = 'ssx-lock show' + (calm ? ' calm' : '');
    lock.textContent = '';
    const bar = document.createElement('i');
    const fill = document.createElement('em');
    bar.appendChild(fill);
    lock.append(Object.assign(document.createElement('b'), { textContent: calm ? '¡Respira! Piensa y toca' : '¡Recargando!' }), bar);
    fill.style.transition = 'none';
    fill.style.transform = 'scaleX(0)';
    void fill.offsetWidth;
    fill.style.transition = `transform ${Math.max(200, (ms || WAIT_WRONG) - 120)}ms linear`;
    fill.style.transform = 'scaleX(1)';
    document.body.classList.add('ssx-locked');
  }

  // ---------- my teammates (and the rivals) between my sums: the server's feed of who scored ----------
  // list: [[k, coins, golden, six], …] for the last 750 ms. Their figures swing and their coins fly into their pan;
  // a teammate not drawn drops coins from the sky; «Sofía +3» pops over my pan (one at a time).
  let whoT = null, whoAt = 0;
  function feed(list) {
    if (!on || !bal || !coins || !g || g.phase !== 'play' || !Array.isArray(list)) return;
    const t = myTeam();
    const world = $('ssx-world').getBoundingClientRect();
    let flights = 0;
    list.slice().sort((a, b) => (byK(b[0]) && byK(b[0]).team === t ? 1 : 0) - (byK(a[0]) && byK(a[0]).team === t ? 1 : 0)).forEach(([k, n, gold, six]) => {
      if (k === me.k || !(n > 0)) return;
      const p = byK(k);
      if (!p || (p.team !== 'red' && p.team !== 'gold')) return;
      const f = figs[k] && figs[k].isConnected ? figs[k] : null;
      if (f) { X().swing(f, Math.random() < 0.5 ? 6 : 7, n >= 3); X().six(f, 650); }
      if (flights < 4 && !reduced()) {
        flights++;
        const to = bal.target(p.team);
        let from;
        if (f) { const b = f._img.getBoundingClientRect(); from = { x: b.left + b.width / 2, y: b.top + b.height * 0.2 }; }
        else from = { x: to.x + (Math.random() - 0.5) * 70, y: world.top - 8 };
        coins.fly(from, { x: to.x + (Math.random() - 0.5) * 24, y: to.y }, {
          size: 20, ms: f ? 520 : 600, gold: !!gold, arc: f ? 50 : 6, delay: flights * 70,
          onLand: () => { if (bal) bal.bump(p.team); if (p.team === t) footDance(700); },
        });
      }
      if (p.team === t) whoChip(p, n, six);
      if (six && p.team === t) crewCheer(t, 1200);
    });
  }
  function whoChip(p, n, six) {
    const el = $('ssx-who');
    if (!el) return;
    const now = Date.now();
    if (!six && now - whoAt < 1100) return;
    // the «news» corner holds one thing at a time: my captain talking wins (a «six seven» chip waits for the next beat),
    // and my own «six seven» moment is never shared
    if ($('ssx-gang') && $('ssx-gang').classList.contains('show')) return;
    if (now < quietUntil) return;
    whoAt = now;
    el.className = 'ssx-who' + (six ? ' six' : '');
    el.textContent = '';
    const img = document.createElement('img');
    img.alt = '';
    img.src = S().kidArt(p.sk || S().skinFor(p.avatar, p.name), 'idle');
    el.append(img, document.createTextNode(p.name + ' '), Object.assign(document.createElement('b'), { textContent: six ? '¡SIX SEVEN!' : `+${n}` }));
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(whoT);
    whoT = setTimeout(() => el.classList.remove('show'), six ? 1600 : 1000);
  }

  // ---------- the countdown: VS run-in ----------
  function showRunIn() {
    const box = $('ssx-intro');
    if (!box) return;
    clearTimers(introTimers);
    box.className = 'ssx-intro runin';
    box.innerHTML = '';
    const t = myTeam();
    const el = X().el;
    const side = (team, isMe) => {
      const s = el('div', 'ssi-side ' + (team === 'red' ? 'red' : 'gold') + (isMe ? ' mine' : ''));
      s.appendChild(el('div', 'ssi-team', 'Equipo ' + teamName(team)));
      const cid = captains && captains[team];
      if (cid && CAST()) {
        const cap = el('div', 'ssi-capt');
        const ci = el('img');
        ci.alt = '';
        ci.src = CAST().pose(cid, 'hello');
        const ct = el('span');
        ct.append((isMe ? 'Tu ' : '') + (CAST().fem(cid) ? (isMe ? 'capitana' : 'Capitana') : (isMe ? 'capitán' : 'Capitán')), Object.assign(document.createElement('b'), { textContent: CAST().name(cid) }));
        cap.append(ci, ct);
        s.appendChild(cap);
      }
      const pan = el('div', 'ssi-pan');
      const pile = el('div', 'ssi-pile');
      [0.45, 0.75, 1, 0.7, 0.4].forEach((h) => { const st = el('i', 'ssb-stack'); st.style.setProperty('--h', h); pile.appendChild(st); });
      pan.append(pile, el('i', 'ssi-dish'));
      s.appendChild(pan);
      const crew = el('div', 'ssi-crew');
      const mates = roster.filter((p) => p.team === team && !p.off && (!isMe || p.name.toLowerCase() !== myName().toLowerCase())).slice(0, 3);
      mates.forEach((p, i) => {
        const f = S().kidFigure({ team, skin: p.sk || S().skinFor(p.avatar, p.name), name: p.name, tag: false });
        f.style.setProperty('--i', i + (isMe ? 1 : 0));
        f.classList.add('ssi-run', team === 'red' ? 'from-l' : 'from-r');
        crew.appendChild(f);
      });
      if (isMe) {
        const f = S().kidFigure({ team, skin: mySkin(), name: myName(), me: true });
        f.style.setProperty('--i', 0);
        f.classList.add('ssi-run', 'ssi-me', team === 'red' ? 'from-l' : 'from-r');
        crew.prepend(f);
      }
      s.appendChild(crew);
      return s;
    };
    const star = el('div', 'ssi-star');
    star.append(X().dancer({ alt: 'Dralingo' }), el('div', 'ssi-vs', 'VS'));
    const cap = el('div', 'ssi-cap ' + (t === 'red' ? 'red' : 'gold'));
    cap.append('¡Eres del ', Object.assign(document.createElement('b'), { textContent: 'Equipo ' + teamName(t) }), '!');
    box.append(side('red', t === 'red'), side('gold', t === 'gold'), star, cap);
    sfx(K + 'whoosh.mp3', 0.6);
    later(900, () => sfx(H + 'round.mp3', 0.45), introTimers);
  }
  // the pictured control: a sum, the two buttons, a hand tapping the right one
  function rulesPic(cls) {
    const el = X().el;
    const pic = el('div', 'ssi-pic' + (cls ? ' ' + cls : ''));
    const card = el('div', 'ssi-pic-card');
    card.append(X().sum({ a: 3, b: 4, op: '+', zh: style === 'zh' }, 'ssi-pic-sum'), el('span', 'ssi-pic-q', '= ?'));
    const btns = el('div', 'ssi-pic-btns');
    const b6 = el('span', 'ssi-pic-b b6');
    b6.append(el('b', null, '6'), el('small', null, 'liù'));
    const b7 = el('span', 'ssi-pic-b b7');
    b7.append(el('b', null, '7'), el('small', null, 'qī'));
    btns.append(b6, b7);
    X().friendOnPic(b6, 6, true);                         // Liu on the 6, Qi on the 7: the buttons as they really look
    X().friendOnPic(b7, 7, true);
    pic.append(card, btns, el('i', 'ssx-hand ssi-pic-hand'));
    return pic;
  }
  function showRules(ms) {
    const box = $('ssx-intro');
    if (!box) return;
    clearTimers(introTimers);
    box.className = 'ssx-intro rules ' + (myTeam() === 'red' ? 'red' : 'gold');
    box.innerHTML = '';
    const el = X().el;
    const card = el('div', 'ssi-card');
    card.append(rulesPic(), el('h2', 'ssi-title', '¡Toca el resultado!'), el('p', 'ssi-sub', 'Cada cuenta da 6 o 7. Piensa bien: la racha da más oro'));
    const say = el('div', 'ssi-say');
    box.append(card, say);
    const total = Math.max(1400, ms || 2800);
    later(total - 1250, () => { box.classList.add('ready'); say.textContent = '¿Listos?'; sfx(K + 'tick.mp3', 0.7); }, introTimers);
    later(total - 600, () => { box.classList.add('go'); say.textContent = '¡YA!'; sfx(H + 'start.mp3', 0.8); buzz(30); }, introTimers);
    later(total + 400, () => { if (!testHold) hideIntro(); }, introTimers);
  }
  function hideIntro() {
    const box = $('ssx-intro');
    if (box && !testHold) { clearTimers(introTimers); box.className = 'ssx-intro hidden'; box.innerHTML = ''; }
  }

  // ---------- banners at the top edge ----------
  // one banner at a time, just under the score bar; the world's top chips step aside while it shows. My own «six seven»
  // moment holds the next banner a beat (quietUntil): a rival's news never lands on top of my stamp.
  let bannerQ = [], bannerOn = false, quietUntil = 0;
  function banner(kind, html, team, ms) {
    bannerQ.push({ kind, html, team, ms: ms || 2300 });
    if (bannerQ.length > 3) bannerQ.splice(0, bannerQ.length - 3);         // never a backlog
    if (!bannerOn) nextBanner();
  }
  function nextBanner() {
    const b = $('ssx-banner');
    if (b && bannerQ.length && Date.now() < quietUntil) { bannerOn = true; setTimeout(nextBanner, quietUntil - Date.now() + 20); return; }
    const it = bannerQ.shift();
    if (!b || !it) { bannerOn = false; document.body.classList.remove('ssx-bannering'); return; }
    bannerOn = true;
    document.body.classList.add('ssx-bannering');
    b.className = 'ssx-banner ' + it.kind + (it.team ? ' ' + (it.team === 'red' ? 'red' : 'gold') : '');
    b.innerHTML = '';
    if (typeof it.html === 'string') b.textContent = it.html; else b.append(...it.html);
    void b.offsetWidth;
    b.classList.add('show');
    setTimeout(() => {
      if (testHold) return;
      b.classList.remove('show');
      setTimeout(nextBanner, 260);
    }, it.ms);
  }
  const bold = (t) => Object.assign(document.createElement('b'), { textContent: t });
  const span = (t) => Object.assign(document.createElement('span'), { textContent: t });

  // ---------- pause (with the live score: a pause is a wait too), frenzy chip ----------
  let paused = false;
  function pauseUI(v) {
    v = !!v;
    const box = $('ssx-pause');
    if (box) box.classList.toggle('hidden', !v);
    if (v) paintPauseScore();
    if (v === paused) return;
    paused = v;
    holdQ(v);
    if (cur && !cur.tapped && !cur.done) setBtns(!v);
  }
  function paintPauseScore() {
    const el = $('ssx-pause-score');
    if (!el) return;
    el.textContent = '';
    if (!g || !(meter.r || meter.g || me.coins)) return;
    el.append(Object.assign(document.createElement('b'), { className: 'r', textContent: `Fuego ${fmt(meter.r)}` }),
      Object.assign(document.createElement('b'), { className: 'g', textContent: `Mar ${fmt(meter.g)}` }),
      span(me.coins > 0 ? `Tú: ${fmt(me.coins)} ${me.coins === 1 ? 'moneda' : 'monedas'} de oro` : '¡Tu primera moneda te espera!'));
  }
  let chipT = null;
  function frenzyChip() {
    clearInterval(chipT);
    const chip = $('ssx-chip');
    if (!chip || !g || !g.frenzy) { if (chip) chip.classList.add('hidden'); return; }
    chip.classList.remove('hidden');
    const paint = () => {
      if (!g || !g.endAt) return;
      const left = g.paused ? g.pausedLeft : Math.max(0, g.endAt - performance.now());
      const s = Math.max(0, Math.ceil(left / 1000));
      chip.querySelector('b').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      chip.classList.toggle('last', s <= 10);
    };
    paint();
    chipT = setInterval(paint, 250);
  }
  function applyMeter(d) {
    if (!d) return;
    meter = Object.assign({}, meter, { r: d.r != null ? d.r : meter.r, g: d.g != null ? d.g : meter.g, b: d.b !== undefined ? d.b : meter.b });
    coverShots();                                         // this meter holds every coin the server had judged before it
    if (skin() && skin().setScores) skin().setScores({ red: meter.r, gold: meter.g });
    paintMeter();
    if (paused) paintPauseScore();
  }
  function rosterFrom(list) {
    const out = [];
    (list || []).forEach((p) => { if (p) out.push(p); });
    roster = out;
  }

  // ---------- events ----------
  let frozen = false, queue = [];
  const handlers = {};
  function init(c) {
    ctx = c;
    const sock = c.socket;
    if (skin() && skin().holdWhen) skin().holdWhen(() => on && !!(g && g.paused));
    const s = { on: (ev, fn) => { handlers[ev] = fn; sock.on(ev, (d) => { if (frozen && (ev.indexOf('ss:') === 0 || ev === 'question' || ev === 'answer-result')) { queue.push([fn, d, ev]); return; } fn(d); }); } };
    s.on('state', (st) => {
      if (!st) return;
      if (st.gameType) setOn(st.gameType === 'sixseven');
      if (!on) return;
      rosterFrom(Object.values(st.players || {}).map((p) => ({ k: p.k, name: p.name, team: p.team, avatar: p.avatar, sk: p.sk, off: !!p.off })));
      const meP = st.players && sock.id && st.players[sock.id];
      if (meP && meP.sk) mySk = meP.sk;
      if (meP && meP.k) me.k = meP.k;
      if (st.ssStyle && st.ssStyle !== style) { style = st.ssStyle; paintLobbyStyle(); }
      if (st.state === 'lobby') { teardown(true); g = null; meter = { r: 0, g: 0, b: null }; shots = []; me = { k: me.k, coins: 0, streak: 0, right: 0, answered: 0, best: 0, misses: 0 }; lastGap = null; }
      else if (built) paintTeam();
    });
    s.on('team-changed', () => { if (on) { if ($('ssx')) { crewKey = ''; paintTeam(); } paintMeter(); } });
    s.on('countdown', () => {
      if (!on) return;
      teardown(true);
      meter = { r: 0, g: 0, b: null }; shots = [];
      me = { k: me.k, coins: 0, streak: 0, right: 0, answered: 0, best: 0, misses: 0 };
      lastGap = null;
      g = null;
      X().preload();
      audioReady();
      showRunIn();
    });
    s.on('ss:init', (d) => applyInit(d));
    s.on('ss:captains', (cp) => { captains = cp; });
    s.on('ss:play', (d) => {
      if (!on || !g) return;
      g.phase = 'play';
      g.endAt = performance.now() + (d.endsMs || 0);
      ctx.markActivity();
    });
    s.on('question', (q) => { if (on && q && q.gameMode === 'sixseven') showQuestion(q); });
    s.on('answer-result', (r) => { if (on && r && r.sixseven) onResult(r.sixseven); });
    s.on('answer-stale', (d) => {
      if (!on || !cur) return;
      // the teacher paused while my tap was on its way: the sum is still open, I tap again after «Seguir» (a reaction
      // the phone already showed is taken back: the server never counted it)
      if (d && d.reason === 'paused' && (!cur.done || cur.pred)) {
        if (cur.pred) undoGuess();
        cur.tapped = false;
        ['ssx-b6', 'ssx-b7'].forEach((id) => $(id).classList.remove('picked'));
        clearTimeout(rescueT);
      }
    });
    s.on('ss:meter', (d) => { if (on) { applyMeter(d); if (d && d.f) feed(d.f); } });
    s.on('ss:wave', (d) => { if (on) wave(d); });
    s.on('ss:lead', (d) => {
      if (!on || !d) return;
      if (d.meter) applyMeter(d.meter);
      const ours = mine(d.team);
      banner('lead', [bold(d.first ? `¡El Equipo ${teamName(d.team)} toma la delantera!` : `¡El Equipo ${teamName(d.team)} pasa adelante!`),
        span(ours ? '¡La balanza baja de nuestro lado!' : '¡A remontar! Piensa y toca')], d.team, 2400);
      sfx(K + (ours ? 'flag.mp3' : 'castle-alert.mp3'), 0.6);
      buzz(ours ? [30, 40, 30] : [60, 40, 60]);
      crewCheer(d.team, 1400);
      gang(ours ? 'swing' : 'oops', { force: true });
    });
    s.on('ss:landmark', (d) => {
      if (!on || !d) return;
      if (d.meter) applyMeter(d.meter);
      const ours = mine(d.team);
      const img = document.createElement('img');
      img.alt = '';
      img.src = K + 'landmarks/' + d.id + '.webp';
      banner('landmark', [img, bold(ours ? `¡Primeros en el ${d.name}!` : `El Equipo ${teamName(d.team)} llegó al ${d.name}`),
        span(ours ? `+${d.bonus} monedas de oro para tu equipo` : '¡Vamos por el siguiente!')], d.team, 2500);
      sfx(ours ? K + 'landmark.mp3' : K + 'castle-alert.mp3', ours ? 0.7 : 0.45);
      if (ours) { buzz([40, 30, 40]); footDance(1500); }
      if (bal && coins && !reduced()) { const to = bal.target(d.team); coins.burst({ x: to.x, y: to.y - 30 }, 8, { spread: 90, fall: 40, size: 20 }); }
    });
    s.on('ss:frenzy', (d) => {
      if (!on || !g) return;
      g.frenzy = true;
      g.endAt = performance.now() + (d.endsMs || 30000);
      document.body.classList.add('ssx-frenzy');
      if ($('ssx')) $('ssx').classList.add('frenzy');
      banner('frenzy', [bold('¡Últimos 30 segundos!'), span('¡DOBLE ORO! Cada acierto vale el doble')], null, 2600);
      sfx(K + 'siege.mp3', 0.6);
      buzz([50, 40, 50, 40, 80]);
      if (skin() && skin().music) skin().music('music-final', 0.4);
      frenzyChip();
      footDance(1);
      [6, 7].forEach((k) => btnFr[k] && btnFr[k].sway(true));   // the last 30 s: Liu and Qi do the 6-7 on their buttons
      gang('swing', { force: true });
    });
    s.on('ss:time', (d) => {
      if (!on || !g) return;
      g.endAt = performance.now() + (d.endsMs || 0);
      if (g.paused) g.pausedLeft = d.endsMs || g.pausedLeft;
      banner('time', d.add < 0 ? `${-d.add} segundos menos` : `+${d.add || 30} segundos más`, null, 1600);
      frenzyChip();
    });
    s.on('ss:pause', (d) => {
      if (!on || !g) return;
      if (d && d.meter) applyMeter(d.meter);            // the score of the moment the teacher paused
      g.paused = !!d.paused;
      if (g.paused) g.pausedLeft = Math.max(0, g.endAt - performance.now());
      else if (d.endsMs != null) g.endAt = performance.now() + d.endsMs;
      pauseUI(g.paused);
      if (skin() && skin().hold) skin().hold(g.paused);
      if (g.paused) clearInterval(chipT); else frenzyChip();
      if (g.phase === 'intro') { if (g.paused) clearTimers(introTimers); else showRules(d.phaseMs); }
      ctx.markActivity();
    });
    s.on('ss:scale', (d) => {
      if (!on || !g || !d || d.id !== g.id) return;
      g.E = d.E;
      g.race = d.race || g.race;
      if (d.meter) applyMeter(d.meter);
    });
    s.on('ss:final', (d) => {
      if (!on) return;
      ctx.markActivity();
      clearTimers();
      clearTimeout(rescueT);
      hideIntro();
      stopQTimer();
      setBtns(false);
      cur = null;
      document.body.classList.remove('ssx-locked');
      clearInterval(chipT);
      if ($('ssx-chip')) $('ssx-chip').classList.add('hidden');
      if (d && d.meter) applyMeter(d.meter);
      bannerQ = [];
      if ($('ssx-banner')) $('ssx-banner').classList.remove('show');
      document.body.classList.remove('ssx-bannering');
      if (g) { g.phase = 'final'; g.paused = false; }
      pauseUI(false);
      footDance(0);
      const f = $('ssx-final');
      if (f) { f.classList.remove('hidden', 'show'); void f.offsetWidth; f.classList.add('show'); }
      sfx('/assets/party/final-v2.mp3', 0.85);
      buzz([40, 30, 40]);
      if (skin() && skin().music) skin().music(null);
    });
    s.on('ss:skip', () => { if (on) jumpToCard(); });
    s.on('game-end', () => {
      if (!on) return;
      clearTimers(); stopQTimer(); clearInterval(chipT); clearTimeout(rescueT);
      cur = null;
      testHold = false;
      hideIntro();
      document.body.classList.remove('ssx-locked');
      if ($('ssx-chip')) $('ssx-chip').classList.add('hidden');
      footDance(0);
      pauseUI(false);
    });
  }
  // the server never counted a guessed reaction (a pause on the way, an answer lost in a reconnect): take it back and
  // give the sum back to the kid
  function undoGuess() {
    const p = cur && cur.pred;
    if (!p) return;
    cur.pred = null;
    revertGuess(p);
    cur.done = false;
    cur.tapped = false;
    clearTimeout(rescueT);
    ['ssx-b6', 'ssx-b7'].forEach((id) => $(id).classList.remove('picked'));
  }
  // a team's «¡SIX SEVEN!» wave (its gold reached 67, then every step): the whole crew does the 6-7, the crowd shouts
  function wave(d) {
    if (!d || !g) return;
    if (d.meter) applyMeter(d.meter);
    const ours = mine(d.team);
    crewCheer(d.team, ours ? 2400 : 1600);
    if (bal) bal.rock(ours);
    if (ours) {
      banner('six', [bold('¡SIX SEVEN!'), span(`¡El Equipo ${teamName(d.team)} llegó a ${fmt(d.gold)} de oro! Liù, qī`)], null, 2600);   // (gold: ours)
      play('shout', 1, 0.8, 40);
      play('liuqi', 1, 0.7, 1050);
      buzz([30, 40, 30, 40, 30, 40, 90]);
      X().palms($('ssx-b6'), $('ssx-b7'), 6, 2);
      footDance(2400);
      join67(2200);                                       // our wave: Liu and Qi become el 67 too
      const conf = $('ssx-conf');
      if (conf && S()) S().confetti(conf, d.team, 20);
      gang('sixseven', { force: true, ms: 2200 });
    } else {
      banner('six compact', [bold(`¡SIX SEVEN del Equipo ${teamName(d.team)}!`)], d.team, 1900);   // (rival news: one line)
      sfx(K + 'castle-alert.mp3', 0.35);
    }
    if (bal && coins && !reduced()) { const to = bal.target(d.team); coins.burst({ x: to.x, y: to.y - 30 }, ours ? 10 : 6, { spread: 100, fall: 40, size: 20 }); }
  }
  function applyInit(d) {
    setOn(true);
    ctx.markActivity();
    const fresh = !g || g.id !== d.id;
    if (fresh) document.body.classList.remove('ssx-ended');
    g = {
      id: d.id, phase: d.phase, E: d.E, race: d.race || [], frenzy: !!d.frenzy, paused: !!d.paused, style: d.style || style,
      endAt: d.endsMs != null ? performance.now() + d.endsMs : 0, pausedLeft: d.endsMs || 0,
    };
    style = g.style;
    if (Array.isArray(d.w) && d.w.length === 3) [WAIT_RIGHT, WAIT_WRONG, WAIT_WRONG2] = d.w;
    if (d.you) {
      me.k = d.you.k; me.coins = d.you.coins || 0; me.streak = d.you.streak || 0; me.right = d.you.right || 0; me.answered = d.you.answered || 0; me.best = d.you.best || 0;
      // a guess still open is measured against the server's own numbers from now on
      if (cur && cur.pred) cur.pred.prev = Object.assign({}, cur.pred.prev, { coins: me.coins, streak: me.streak, right: me.right, answered: me.answered, best: me.best });
    }
    if (d.captains) captains = d.captains;
    if (Array.isArray(d.roster) && d.roster.length) {
      // the round's roster (k, name, character, team) until the next 'state' brings avatars too
      const old = roster;
      rosterFrom(d.roster.map((p) => { const o = old.find((x) => x.k === p.k) || {}; return { k: p.k, name: p.name, team: p.team, sk: p.skin, avatar: o.avatar, off: !p.on }; }));
    }
    build();
    paintTeam();
    applyMeter(d.meter);
    paintCounter(false);
    paintCombo(me.streak);
    document.body.classList.toggle('ssx-frenzy', g.frenzy);
    if ($('ssx')) $('ssx').classList.toggle('frenzy', g.frenzy);
    pauseUI(g.paused);
    frenzyChip();
    footDance(g.frenzy ? 1 : 0);
    if (d.phase === 'intro') { if (fresh || !$('ssx-intro').classList.contains('rules')) showRules(d.phaseMs); }
    else hideIntro();
    if (d.phase === 'play' && !cur) ctx.showScreen('sixseven');
    const fin = $('ssx-final');
    if (fin) { fin.classList.toggle('hidden', d.phase !== 'final'); fin.classList.toggle('show', d.phase === 'final'); }
  }

  // ---------- lobby: who I am + «Así se juega» + today's style ----------
  function lobby(head) {
    let box = $('ssx-how');
    if (!head) { if (box) box.remove(); return; }
    if (!S() || !X()) return;
    const t = myTeam();
    const el = X().el;
    if (!box) {
      box = el('div', 'ssx-how');
      box.id = 'ssx-how';
      box.innerHTML = '<div class="ssh-you"><div class="ssh-kid" id="ssh-kid"></div><div class="ssh-bal" id="ssh-bal"></div><span>Tú y tu balanza<b id="ssh-team"></b></span></div>'
        + '<div class="ssh-friends" id="ssh-friends"><span>¡Liu es el 6 y Qi es el 7!</span></div>'
        + '<div class="ssh-style" id="ssh-style"></div>'
        + '<div class="ssh-title">Así se juega</div><ol>'
        + '<li><div class="ssh-step s1" id="ssh-s1"></div><span><b>Mira la cuenta</b>siempre da 6 o 7</span></li>'
        + '<li><div class="ssh-step s2"><span class="ssi-pic-b b6"><b>6</b><small>liù</small></span><span class="ssi-pic-b b7"><b>7</b><small>qī</small></span><i class="ssx-hand"></i></div><span><b>Toca 6 o 7</b>6 es liù, 7 es qī en Chino Mandarín</span></li>'
        + '<li><div class="ssh-step s3" id="ssh-s3"></div><span><b>¡Llena tu balanza de oro!</b>En racha, cada acierto vale más</span></li>'
        + '</ol>';
      head.after(box);
      $('ssh-friends').prepend(X().friendsRow({ lite: true }));   // Dralingo's friends: the 6 is liu, the 7 is qi
      X().preloadFriends(true);
      new (X().Balance)($('ssh-s3')).set(-0.6, true);
      new (X().Balance)($('ssh-bal')).set(t === 'red' ? -0.5 : 0.5, true);
    }
    box.classList.toggle('red', t === 'red');
    const kid = $('ssh-kid');
    kid.innerHTML = '';
    kid.appendChild(S().kidFigure({ team: t, skin: mySkin(), name: myName(), tag: false }));
    $('ssh-team').textContent = 'Equipo ' + teamName(t);
    paintLobbyStyle();
  }
  function paintLobbyStyle() {
    const s1 = $('ssh-s1'), st = $('ssh-style');
    if (!s1 || !st) return;
    s1.innerHTML = '';
    const ex = style === 'zh' ? { a: 3, b: 4, op: '+', zh: true } : { a: 9, b: 3, op: '-', zh: false };
    s1.appendChild(X().sum(ex, 'ssh-sum'));
    st.textContent = '';
    st.append('Hoy: ', Object.assign(document.createElement('b'), { textContent: STYLE_NAME[style] || 'Mezcla' }), ' · ', Object.assign(document.createElement('span'), { textContent: STYLE_EX[style] || '' }));
  }

  // ---------- the end: the ceremony, then my card ----------
  let cer = null;
  function end(data) {
    if (!S() || !X()) return;
    const box = $('screen-end');
    if (!box) return;
    clearTimers(cerTimers);
    const old = $('ssx-finale');
    if (old) old.remove();
    const fin = X().el('div', 'ssx-finale');
    fin.id = 'ssx-finale';
    box.appendChild(fin);
    document.body.classList.add('ssx-ended');
    bannerQ = []; bannerOn = false;
    if ($('ssx-banner')) $('ssx-banner').classList.remove('show');
    document.body.classList.remove('ssx-bannering');
    const f = $('ssx-final');
    if (f) f.classList.add('hidden');
    cer = { data, stage: null, fin };
    const skip = X().el('button', 'ssx-skip', 'Ver mi tarjeta');
    skip.type = 'button';
    skip.addEventListener('click', jumpToCard);
    fin.appendChild(skip);
    // a phone that reloaded after the end (it never saw this game live) goes straight to its card
    if (!g) { stage('card'); return; }
    const stars = ((data && data.sixseven && data.sixseven.stars) || []);
    const plan = [['weigh', 3800], ['result', 3200]].concat(stars.map((s, i) => ['star' + i, 2100]));
    let t = 0;
    plan.forEach(([name, ms]) => { later(t, () => stage(name), cerTimers); t += ms; });
    later(t, () => stage('card'), cerTimers);
  }
  function jumpToCard() { if (!cer) return; clearTimers(cerTimers); stage('card'); }
  function stageBox(cls) {
    const fin = cer.fin;
    const old = fin.querySelector('.ssf-stage');
    if (old) old.remove();
    const s = X().el('div', 'ssf-stage ' + cls);
    fin.prepend(s);
    return s;
  }
  function stage(name) {
    if (!cer) return;
    cer.stage = name;
    const d = cer.data || {}, mo = d.sixseven || {}, meD = d.me || {};
    const tt = mo.totals || { r: 0, g: 0 };
    const t = meD.team || myTeam();
    const el = X().el;
    if (name === 'weigh') {
      const s = stageBox('weigh');
      s.appendChild(el('h2', 'ssf-h', '¿Quién tiene más oro?'));
      const box = el('div', 'ssf-bal');
      s.appendChild(box);
      const b = new (X().Balance)(box);
      b.fill(tt.r, tt.g, Math.max(tt.r, tt.g, 1));
      b.set(0, true);
      const nums = el('div', 'ssf-nums');
      const nr = el('b', 'ssf-n r', '0'), ng = el('b', 'ssf-n g', '0');
      nums.append(nr, el('span', 'ssf-vs', 'VS'), ng);
      s.appendChild(nums);
      const k = X().tilt(tt.r, tt.g);
      later(250, () => b.weigh(k, 3000), cerTimers);
      S().countUp(nr, 0, tt.r, 2800);
      S().countUp(ng, 0, tt.g, 2800);
      sfx(MO + 'drum.mp3', 0.75);
      return;
    }
    if (name === 'result') {
      const tie = mo.winner === 'tie';
      const s = stageBox('result ' + (tie ? 'tie' : mo.winner === 'red' ? 'red' : 'gold'));
      const won = mo.winner === t;
      s.appendChild(el('h2', 'ssf-h big', tie ? '¡Empate!' : `¡Gana el Equipo ${teamName(mo.winner)}!`));
      const lostMe = !tie && mo.winner !== t;
      const wc = mo.captains && !tie ? mo.captains[lostMe ? t : mo.winner] : null;
      if (wc && CAST()) s.appendChild(el('p', 'ssf-capline', `${CAST().captain(wc)}: «${CAST().line(wc, lostMe ? 'casi' : 'oro')}»`));
      // Dralingo dances the 6-7 with his friends Liu and Qi (2026-10-20; the phones' light loops)
      const trio = el('div', 'ssf-trio');
      trio.append(X().friend('liu', { lite: true, pose: 'dance', alt: '' }), X().dancer({ cls: 'ssf-dral' }), X().friend('qi', { lite: true, pose: 'dance', alt: '' }));
      s.appendChild(trio);
      const row = el('div', 'ssf-teams');
      ['red', 'gold'].forEach((team) => {
        const winT = tie || mo.winner === team;
        const side = el('div', 'ssf-side ' + (team === 'red' ? 'red' : 'gold') + (winT ? ' win' : ' lose') + (team === t ? ' mine' : ''));
        const crew = el('div', 'ssf-crew');
        if (!winT) crew.appendChild(X().cloud());
        const kids = (mo.teams && mo.teams[team]) || [];
        let list = kids.slice(0, 2);
        if (team === t && meD.k != null && !list.some((r) => r.k === meD.k)) {
          const mineRow = kids.find((r) => r.k === meD.k) || { k: meD.k, name: myName(), skin: mySkin(), team: t };
          list = [mineRow].concat(list.slice(0, 1));
        }
        list.forEach((r, i) => {
          const f = S().kidFigure({ team, skin: r.skin, name: r.name, me: r.k === meD.k, pose: winT ? 'ok' : 'no', tag: r.k === meD.k });
          f.classList.add(winT ? 'swing67' : 'sob');
          f.style.setProperty('--i', i);
          crew.appendChild(f);
        });
        side.appendChild(crew);
        X().fitCloud(crew);
        side.appendChild(el('b', 'ssf-total', fmt(team === 'red' ? tt.r : tt.g) + ' de oro'));
        if (winT) { const conf = el('div', 'ssf-conf'); side.appendChild(conf); S().confetti(conf, tie ? null : team, tie ? 14 : 22); }
        row.appendChild(side);
      });
      s.appendChild(row);
      sfx(K + 'sting-win.mp3', won || tie ? 0.9 : 0.55);
      if (won || tie) { play('shout', 1, 0.7, 350); play('liuqi', 1, 0.8, 1300); }
      if (!won && !tie) later(700, () => sfx(H + 'aww.mp3', 0.55), cerTimers);
      buzz(won || tie ? [60, 40, 60, 40, 200] : [80]);
      return;
    }
    if (name.indexOf('star') === 0) {
      const st = (mo.stars || [])[Number(name.slice(4))];
      if (!st) return;
      const mineStar = (meD.stars || []).includes(st.id);
      const s = stageBox('star' + (mineStar ? ' mine' : ''));
      const badge = el('div', 'ssf-badge');
      badge.appendChild(S().starSvg());
      s.appendChild(badge);
      s.appendChild(el('h2', 'ssf-h', st.name));
      const who = el('div', 'ssf-who');
      (st.who || []).forEach((r, i) => {
        const f = S().kidFigure({ team: r.team, skin: r.skin, name: r.name, me: r.k === meD.k, pose: 'ok' });
        f.style.setProperty('--i', i);
        who.appendChild(f);
      });
      s.appendChild(who);
      s.appendChild(el('div', 'ssf-val', (st.n > 4 ? `y ${st.n - 4} más · ` : '') + starValue(st)));
      if (mineStar) { s.appendChild(el('div', 'ssf-mine', '¡ES PARA TI!')); buzz([40, 30, 40, 30, 120]); }
      sfx(MO + 'star.mp3', mineStar ? 0.9 : 0.6);
      return;
    }
    if (name === 'card') {
      clearTimers(cerTimers);
      const s = stageBox('card ' + (t === 'red' ? 'red' : 'gold'));
      const skip = cer.fin.querySelector('.ssx-skip');
      if (skip) skip.remove();
      const won = mo.winner === t, tie = mo.winner === 'tie';
      const top = el('div', 'ssk-top');
      const kid = S().kidFigure({ team: t, skin: mySkin(), name: myName(), me: true, pose: won || tie ? 'ok' : 'no' });
      if (won || tie) kid.classList.add('swing67');
      const pile = el('div', 'ssk-pile');
      const kb = new (X().Balance)(pile);
      kb.fill(tt.r, tt.g, Math.max(tt.r, tt.g, 1));
      kb.set(X().tilt(tt.r, tt.g), true);
      top.append(kid, pile);
      s.appendChild(top);
      s.appendChild(el('h2', 'ssk-h', tie ? '¡Empate! ¡Qué balanza!' : won ? '¡Ganó tu equipo!' : `¡Buen intento, Equipo ${teamName(t)}!`));
      const big = el('p', 'ssk-big');
      if (meD.coins > 0) {
        big.append('Ganaste ', el('b', null, fmt(meD.coins)), meD.coins === 1 ? ' moneda de oro' : ' monedas de oro');
        s.appendChild(big);
        s.appendChild(el('p', 'ssk-line', meD.share >= 1 ? `El ${meD.share} % del oro de tu equipo` : '¡Cada moneda cuenta para tu equipo!'));
      } else {
        big.textContent = '¡La próxima es tuya!';
        s.appendChild(big);
        s.appendChild(el('p', 'ssk-line', 'Mira la cuenta y toca 6 o 7: cada acierto es oro'));
      }
      const score = el('p', 'ssk-score');
      score.append(el('b', 'r', `Fuego ${fmt(tt.r)}`), el('b', 'g', `Mar ${fmt(tt.g)}`));
      s.appendChild(score);
      const facts = el('div', 'ssk-facts');
      const fact = (n, l) => { const x = el('div', 'ssk-fact'); x.append(el('b', null, n), el('span', null, l)); facts.appendChild(x); };
      if (meD.right > 0) {
        fact(String(meD.right), meD.right === 1 ? 'acierto' : 'aciertos');
        fact(String(meD.best || 1), 'mejor racha');
        if ((meD.aim || 0) >= 50) fact(meD.aim + ' %', 'puntería');
        if (meD.zh) fact(String(meD.zh), 'en Chino Mandarín');
      } else if (meD.answered > 0) fact(String(meD.answered), meD.answered === 1 ? 'cuenta jugada' : 'cuentas jugadas');
      if (facts.children.length) s.appendChild(facts);
      const mineStars = (mo.stars || []).filter((x) => (meD.stars || []).includes(x.id));
      if (mineStars.length || (meD.mvp && meD.coins > 0)) {
        const row = el('div', 'ssk-stars');
        if (meD.mvp && meD.coins > 0) { const b = el('div', 'ssk-star mvp'); b.append(S().starSvg(), el('span', null, 'El mejor de tu equipo')); row.appendChild(b); }
        mineStars.forEach((x) => { const b = el('div', 'ssk-star'); b.append(S().starSvg(), el('span', null, x.name)); row.appendChild(b); });
        s.appendChild(row);
      }
      s.appendChild(el('p', 'ssk-wait', 'Quédate aquí: tu profe puede empezar otra ronda'));
      const home = el('button', 'ssk-home', 'Salir del juego');
      home.type = 'button';
      home.addEventListener('click', () => { location.href = '/'; });
      s.appendChild(home);
    }
  }
  function starValue(st) {
    if (st.id === 'fast') return `${String(st.value).replace('.', ',')} s`;
    if (st.id === 'streak') return `${st.value} seguidas`;
    if (st.id === 'right') return `${fmt(st.value)} ${st.value === 1 ? 'acierto' : 'aciertos'}`;
    if (st.id === 'aim') return `${st.value} %`;
    if (st.id === 'zh') return `${fmt(st.value)} en Chino Mandarín`;
    return `${fmt(st.value)} ${coinsWord(st.value)}`;
  }

  window.SixSevenPhone = {
    init, lobby, end,
    frame: () => ({
      on, phase: g && g.phase, meter: Object.assign({}, meter), me: Object.assign({}, me), qid: cur && cur.qid, tapped: !!(cur && cur.tapped),
      done: !!(cur && cur.done), guessed: !!(cur && cur.pred), frenzy: !!(g && g.frenzy), paused: !!(g && g.paused), stage: cer && cer.stage, style,
      locked: document.body.classList.contains('ssx-locked'), crew: Object.keys(figs).length, captains,
    }),
    tap: (n) => tap(n),
    hold: (v) => {
      testHold = !!v;
      const b = $('ssx-banner');
      if (!testHold && b && b.classList.contains('show')) { b.classList.remove('show'); setTimeout(nextBanner, 260); }
    },
    freeze: (v) => { frozen = !!v; if (!frozen) { const q = queue; queue = []; q.forEach(([fn, d]) => fn(d)); } return queue.length; },
    replay: (ev) => { while (queue.length) { const [fn, d, e] = queue.shift(); fn(d); if (e === ev) break; } return queue.length; },
    queued: () => queue.map((x) => x[2]),
    stage: (name) => { if (cer) { clearTimers(cerTimers); stage(name); } },
    runIn: () => showRunIn(),
    rules: (ms) => showRules(ms),
    sim: (ev, d) => { if (handlers[ev]) handlers[ev](d); },
    milestone: (n) => milestone({ streak: n || 3 }),
    six: (kind) => (kind === 'mini' ? sixStamp('mini', 'liù · qī') : mySix({ six: kind === 'coins' ? 2 : 1, streak: 7 })),
    gang: (mood) => gang(mood || 'swing', { force: true }),
    feed: (list) => feed(list),
  };
})();
