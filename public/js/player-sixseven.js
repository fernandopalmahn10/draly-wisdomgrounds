// 6-7 Swing v2 «La Balanza de Oro» — the kid's phone (the product). player.js calls SixSevenPhone.init(...) once; the
// shared phone skin (player-kingdoms-skin.js) gives the lobby look, the sounds and music, and routes the lobby card and
// the end screen here. What this module draws, only while the room's game is 'sixseven':
//   · countdown: the VS run-in (red | blue, Dralingo doing the «6-7» over the VS, my character runs in, my captain)
//   · intro: the rules card with ONE pictured control (a sum, the two buttons, a tapping hand) → «¿Listos?» → «¡YA!»
//   · THE GAME, rapid-fire: the sum (digits or pinyin words) on a card, my full-body character, two giant buttons
//     «6 · liu» and «7 · qi». A tap answers; the server judges it. Right: my character swings to the side I tapped,
//     the voice says «liù» or «qī», gold coins fly to my counter (a pop whose pitch climbs with the streak), the combo
//     chip, a golden sum's shower, Dralingo's «6-7» on a racha. Wrong: a funny wobble, «Era 7 · qi», a short wait with
//     the buttons asleep (longer after two in a row: «¡Respira!»)
//   · the team meter and a mini balance on top; lead-change / landmark / last-30-s banners at the top edge (never over
//     the buttons), the pause card, «¡FINAL!» and the ceremony: the great weigh-in, «¡Gana el Equipo …!» (winners do the
//     6-7 swing, the others sob under a rain cloud), the bonus stars one by one, my own card
// Test hooks: SixSevenPhone.frame(), .tap(6|7), .hold(v), .freeze(v) / .replay(ev), .stage(name), .sim(ev, d), .runIn(), .rules(ms).
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
  const STYLE_EX = { num: '3 + 4', zh: 'san + si', mix: '3 + 4 · san + si' };
  const MILESTONE = { 3: 2, 6: 3, 10: 4 };      // racha → the new multiplier

  let ctx = null, on = false;
  let timers = [], introTimers = [], cerTimers = [];
  let g = null;                  // { id, phase, endAt (perf), paused, pausedLeft, frenzy, race, E, style }
  let meter = { r: 0, g: 0, b: null };
  let me = { k: null, coins: 0, streak: 0, right: 0, answered: 0, best: 0 };
  let roster = [];
  let captains = null, style = 'mix';
  let testHold = false;
  const CAST = () => window.DralingoCast;
  const capLine = (mood) => { const id = captains && captains[myTeam()]; return id && CAST() ? CAST().name(id) + ': ' + CAST().line(id, mood) : ''; };

  // ---------- who I am ----------
  const myTeam = () => (ctx && ctx.getTeam()) || 'red';
  const myName = () => ($('lobby-name') && $('lobby-name').textContent) || '';
  let mySk = '';
  function mySkin() {
    if (mySk) return mySk;
    let v = '';
    try { v = localStorage.getItem('dralyAvatar') || ''; } catch (_) {}
    const list = (window.Saga && window.Saga.AVATARS) || [];
    if (!list.some((a) => a.emoji === v)) v = (list[0] && list[0].emoji) || '🐉';
    return S() ? S().skinFor(v, myName()) : 'dralingo';
  }
  const teamName = (t) => (t === 'red' ? 'Fuego' : 'Mar');
  const mine = (t) => t === myTeam();
  const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('es-ES');
  const coinsWord = (n) => (n === 1 ? 'moneda' : 'monedas');

  // ---------- quick sounds (Web Audio: the pop must land on the tap, with no lag) ----------
  let actx = null, loading = false;
  const bufs = {};
  const BUF = { pop: MO + 'pop.mp3', coins: A + 'coins.mp3', wrong: A + 'wrong.mp3', gold: MO + 'gold.mp3',
    combo: MO + 'combo.mp3', liu: A + 'liu.mp3', qi: A + 'qi.mp3', liuqi: A + 'liuqi.mp3' };
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
    document.body.classList.remove('ssx-frenzy', 'ssx-ended');
    if ($('ssx')) $('ssx').classList.remove('frenzy');
    if (all) { clearTimers(cerTimers); const f = $('ssx-finale'); if (f) f.remove(); }
  }

  // ---------- the game screen ----------
  let built = false, bal = null, coins = null, meFig = null, dral = null;
  function build() {
    if (built || !$('ssx')) return;
    built = true;
    bal = new (X().Balance)($('ssx-mini'), { mini: true });
    coins = new (X().Coins)($('ssx-fx'), 16);
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
  function paintTeam() {
    const t = myTeam();
    const z = $('ssx');
    if (!z) return;
    z.classList.toggle('red', t === 'red');
    z.classList.toggle('gold', t !== 'red');
    const box = $('ssx-me');
    if (!meFig || meFig._skin !== mySkin() || meFig._team !== t) {
      box.innerHTML = '';
      meFig = S().kidFigure({ team: t, skin: mySkin(), name: myName(), me: true });
      meFig._team = t;
      box.appendChild(meFig);
    }
    $('ssx-team').textContent = 'Equipo ' + teamName(t);
  }
  function paintMeter() {
    if (!$('ssx-mr')) return;
    const sum = meter.r + meter.g;
    $('ssx-mr').style.transform = `scaleX(${(sum ? meter.r / sum : 0.5).toFixed(3)})`;
    $('ssx-rn').textContent = fmt(meter.r);
    $('ssx-gn').textContent = fmt(meter.g);
    const t = myTeam();
    const a = t === 'red' ? meter.r : meter.g, b = t === 'red' ? meter.g : meter.r;
    const st = $('ssx-status');
    st.textContent = a > b ? `¡Ganamos por ${fmt(a - b)}!` : a < b ? `¡Faltan ${fmt(b - a)}!` : '¡Empate!';
    st.className = 'ssx-status ' + (a > b ? 'ahead' : a < b ? 'behind' : '');
    if (bal) bal.set(X().tilt(meter.r, meter.g));
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
    mult = mult || (streak >= 10 ? 4 : streak >= 6 ? 3 : streak >= 3 ? 2 : 1);
    el.className = 'ssx-combo show' + (mult >= 3 ? ' fire' : mult >= 2 ? ' hot' : '');
    el.textContent = '';
    el.append(Object.assign(document.createElement('b'), { textContent: `Racha ${streak}` }));
    el.append(Object.assign(document.createElement('span'), { textContent: mult > 1 ? `×${mult} oro` : `¡1 más: ×2!` }));
  }

  // ---------- one sum ----------
  let cur = null;                // { qid, ss, t0, ms, tapped, done, choice, heldAt, heldSum }
  let qT = null, rescueT = null, lastTick = 0;
  function showQuestion(q) {
    if (!on || !q || !q.ss) return;
    build();
    paintTeam();
    hideIntro();
    document.body.classList.remove('ssx-locked');
    ctx.showScreen('sixseven');
    if (cur && cur.qid === q.qid) {                      // the same sum again (a resync or a rejoin)
      if (cur.tapped && !cur.done) { cur.tapped = false; setBtns(!(g && g.paused)); $('ssx-b6').classList.remove('picked'); $('ssx-b7').classList.remove('picked'); runQTimer(); }
      return;
    }
    const ss = q.ss;
    cur = { qid: q.qid, ss, t0: performance.now(), ms: ss.ms || 12000, tapped: false, done: false, choice: null, heldAt: 0, heldSum: 0 };
    const card = $('ssx-card');
    card.className = 'ssx-card' + (ss.zh ? ' zh' : ' num') + (ss.gold ? ' gold' : '');
    const eq = $('ssx-eq');
    eq.innerHTML = '';
    eq.appendChild(X().sum(ss, 'ssx-sum'));
    $('ssx-ask').textContent = '?';
    $('ssx-verdict').className = 'ssx-verdict';
    $('ssx-verdict').textContent = '';
    ['ssx-b6', 'ssx-b7'].forEach((id) => $(id).classList.remove('picked', 'wrong', 'hint', 'right'));
    setBtns(true);
    $('ssx-lock').className = 'ssx-lock';
    if (!reduced() && card.animate) card.animate([{ transform: 'translateY(10px) scale(.97)', opacity: 0.4 }, { transform: 'none', opacity: 1 }], { duration: 170, easing: 'cubic-bezier(.22,1,.36,1)' });
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

  // ---------- the tap ----------
  function tap(choice) {
    audioReady();
    if (!cur || cur.tapped || cur.done || !g || g.phase !== 'play' || g.paused) return;
    cur.tapped = true;
    cur.choice = choice;
    const btn = $(choice === 6 ? 'ssx-b6' : 'ssx-b7');
    btn.classList.add('picked');
    setBtns(false);
    if (!reduced() && btn.animate) btn.animate([{ transform: 'translateY(6px) scale(.95)' }, { transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.22,1,.36,1)' });
    play('pop', 0.92 + Math.min(10, me.streak) * 0.05, 0.55);
    buzz(10);
    stopQTimer();
    const qid = cur.qid;
    ctx.socket.emit('player:answer', { pin: ctx.getPin(), qid, choiceIdx: choice === 6 ? 0 : 1 }, () => {});
    clearTimeout(rescueT);
    // no verdict in 3 s (a Wi-Fi blip): the buttons come back (the server answers a second tap or deals a new sum)
    rescueT = setTimeout(() => {
      if (!(cur && cur.qid === qid && cur.tapped && !cur.done)) return;
      cur.tapped = false;
      btn.classList.remove('picked');
      if (g && g.paused) return;               // «Seguir» brings them back (pauseUI)
      setBtns(true);
      runQTimer();
    }, 3000);
    ctx.markActivity();
  }

  // ---------- the verdict ----------
  function onResult(r) {
    if (!on || !r) return;
    clearTimeout(rescueT);
    stopQTimer();
    me.coins = r.total != null ? r.total : me.coins;
    me.streak = r.streak || 0;
    me.answered++;
    if (r.right) { me.right++; me.best = Math.max(me.best, me.streak); }
    if (!cur || cur.qid !== r.qid) { paintCounter(false); paintCombo(me.streak); return; }   // (a sum this screen no longer shows)
    cur.done = true;
    cur.tapped = true;
    if (r.right) right(r); else wrong(r);
    ctx.markActivity();
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
    $(r.ans === 6 ? 'ssx-b6' : 'ssx-b7').classList.add('right');
    verdict('ok', '¡Sí!', `${r.ans} · ${r.word}`);
    play(r.ans === 6 ? 'liu' : 'qi', 1, 0.95, 40);
    X().swing(meFig, r.choice || r.ans, r.mult >= 3);
    buzz(r.mult >= 3 ? [14, 30, 14] : 14);
    // the coins fly from the button I tapped to my counter
    const from = $(r.ans === 6 ? 'ssx-b6' : 'ssx-b7').getBoundingClientRect();
    const to = $('ssx-count').getBoundingClientRect();
    const n = Math.max(1, Math.min(7, r.coins));
    for (let i = 0; i < n; i++) {
      coins.fly({ x: from.left + from.width * (0.35 + Math.random() * 0.3), y: from.top + from.height * 0.4 }, { x: to.left + to.width * 0.3, y: to.top + to.height * 0.5 }, {
        size: r.gold && i === 0 ? 40 : 28, gold: r.gold && i < 3, delay: i * 45, ms: 480, arc: 70 + Math.random() * 40, drift: (Math.random() - 0.5) * 60,
        onLand: i === 0 ? () => play('coins', 0.95 + Math.min(10, r.streak) * 0.045, 0.5) : null,
      });
    }
    later(reduced() ? 0 : 520, () => paintCounter(true));
    plus(`+${r.coins}`, r.frenzy ? 'x2' : r.gold ? 'gold' : '');
    paintCombo(r.streak, r.mult);
    if (r.gold) goldMoment(r);
    else if (MILESTONE[r.streak] || (r.streak > 10 && r.streak % 5 === 0)) milestone(r);
  }
  function plus(txt, cls) {
    const p = $('ssx-plus');
    p.className = 'ssx-plus ' + (cls || '');
    p.textContent = txt;
    void p.offsetWidth;
    p.classList.add('show');
  }
  // a racha that climbs a multiplier: Dralingo comes in from the side doing the «6-7» and says «liù, qī!»
  let dralT = null, lastDral = 0;
  function milestone(r) {
    play('combo', 1, 0.55);
    buzz([30, 30, 30, 30, 60]);
    const now = Date.now();
    if (now - lastDral < 2500) return;                   // one Dralingo at a time
    lastDral = now;
    const box = $('ssx-dral');
    box.innerHTML = '';
    const d = X().dancer({ alt: '' });
    const say = Object.assign(document.createElement('b'), { className: 'ssx-dral-say', textContent: MILESTONE[r.streak] ? `¡Racha ${r.streak}! ×${MILESTONE[r.streak]} oro` : `¡Racha ${r.streak}!` });
    box.append(d, say);
    box.className = 'ssx-dral show';
    play('liuqi', 1, 0.85, 220);
    clearTimeout(dralT);
    dralT = setTimeout(() => { box.className = 'ssx-dral'; }, 1900);
  }
  function goldMoment(r) {
    play('gold', 1, 0.8);
    buzz([40, 30, 40, 30, 90]);
    const c = $('ssx-card').getBoundingClientRect();
    coins.burst({ x: c.left + c.width / 2, y: c.top + c.height * 0.6 }, reduced() ? 0 : 10, { spread: 150, fall: 120, size: 26 });
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
    if (r.tooFast) verdict('no', '¡Muy rápido!', `Primero lee la cuenta · era ${r.ans} · ${r.word}`);
    else if (r.timeUp) verdict('no', '¡Se acabó el tiempo!', `Era ${r.ans} · ${r.word}`);
    else verdict('no', '¡Uy!', `Era ${r.ans} · ${r.word}`);
    if (meFig) { meFig.pose('no'); X().wobble(meFig, false); later(900, () => { if (meFig) meFig.pose('idle'); }); }
    play('wrong', 1, 0.6);
    buzz([40, 30, 40]);
    paintCombo(0);
    // the buttons sleep for the wait (a bar drains); two wrong in a row: «¡Respira!»
    const lock = $('ssx-lock');
    lock.className = 'ssx-lock show' + (r.calm ? ' calm' : '');
    lock.textContent = '';
    lock.append(Object.assign(document.createElement('b'), { textContent: r.calm ? '¡Respira! Piensa y toca' : 'Espera…' }), Object.assign(document.createElement('i'), {}));
    const bar = lock.querySelector('i');
    bar.style.transition = 'none';
    bar.style.transform = 'scaleX(1)';
    void bar.offsetWidth;
    bar.style.transition = `transform ${Math.max(200, (r.wait || 1600) - 120)}ms linear`;
    bar.style.transform = 'scaleX(0)';
    document.body.classList.add('ssx-locked');
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
        ct.append((isMe ? 'Tu ' : '') + (CAST().fem(cid) ? 'capitana' : 'capitán'), Object.assign(document.createElement('b'), { textContent: CAST().name(cid) }));
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
        const f = S().kidFigure({ team, skin: S().skinFor(p.avatar, p.name), name: p.name, tag: false });
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
    b6.append(el('b', null, '6'), el('small', null, 'liu'));
    const b7 = el('span', 'ssi-pic-b b7');
    b7.append(el('b', null, '7'), el('small', null, 'qi'));
    btns.append(b6, b7);
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
  let bannerQ = [], bannerOn = false;
  function banner(kind, html, team, ms) {
    bannerQ.push({ kind, html, team, ms: ms || 2300 });
    if (bannerQ.length > 3) bannerQ.splice(0, bannerQ.length - 3);         // never a backlog
    if (!bannerOn) nextBanner();
  }
  function nextBanner() {
    const b = $('ssx-banner');
    const it = bannerQ.shift();
    if (!b || !it) { bannerOn = false; return; }
    bannerOn = true;
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

  // ---------- pause, frenzy chip ----------
  let paused = false;
  function pauseUI(v) {
    v = !!v;
    const box = $('ssx-pause');
    if (box) box.classList.toggle('hidden', !v);
    if (v === paused) return;
    paused = v;
    holdQ(v);
    if (cur && !cur.tapped && !cur.done) setBtns(!v);
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
    meter = Object.assign({}, meter, d);
    if (skin() && skin().setScores) skin().setScores({ red: meter.r, gold: meter.g });
    paintMeter();
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
      roster = Object.values(st.players || {}).map((p) => ({ name: p.name, team: p.team, avatar: p.avatar, off: !!p.off }));
      const meP = st.players && sock.id && st.players[sock.id];
      if (meP && meP.sk) mySk = meP.sk;
      if (st.ssStyle && st.ssStyle !== style) { style = st.ssStyle; paintLobbyStyle(); }
      if (st.state === 'lobby') { teardown(true); g = null; meter = { r: 0, g: 0, b: null }; me = { k: null, coins: 0, streak: 0, right: 0, answered: 0, best: 0 }; }
    });
    s.on('team-changed', () => { if (on) { if ($('ssx')) paintTeam(); paintMeter(); } });
    s.on('countdown', () => {
      if (!on) return;
      teardown(true);
      meter = { r: 0, g: 0, b: null };
      me = { k: null, coins: 0, streak: 0, right: 0, answered: 0, best: 0 };
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
      if (!on || !cur || cur.done) return;
      // the teacher paused while my tap was on its way: the sum is still open, I tap again after «Seguir»
      if (d && d.reason === 'paused') { cur.tapped = false; ['ssx-b6', 'ssx-b7'].forEach((id) => $(id).classList.remove('picked')); clearTimeout(rescueT); }
    });
    s.on('ss:meter', (d) => { if (on) applyMeter(d); });
    s.on('ss:lead', (d) => {
      if (!on || !d) return;
      if (d.meter) applyMeter(d.meter);
      const ours = mine(d.team);
      banner('lead', [bold(d.first ? `¡El Equipo ${teamName(d.team)} toma la delantera!` : `¡El Equipo ${teamName(d.team)} pasa adelante!`),
        span(capLine(ours ? 'swing' : 'oops') || (ours ? '¡La balanza es nuestra!' : '¡A remontar! Piensa y toca'))], d.team, 2400);
      sfx(K + (ours ? 'flag.mp3' : 'castle-alert.mp3'), 0.6);
      buzz(ours ? [30, 40, 30] : [60, 40, 60]);
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
      if (ours) buzz([40, 30, 40]);
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
    });
    s.on('ss:time', (d) => {
      if (!on || !g) return;
      g.endAt = performance.now() + (d.endsMs || 0);
      if (g.paused) g.pausedLeft = d.endsMs || g.pausedLeft;
      banner('time', `+${d.add || 30} segundos más`, null, 1600);
      frenzyChip();
    });
    s.on('ss:pause', (d) => {
      if (!on || !g) return;
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
      if (g) { g.phase = 'final'; g.paused = false; }
      pauseUI(false);
      const f = $('ssx-final');
      if (f) { f.classList.remove('hidden', 'show'); void f.offsetWidth; f.classList.add('show'); }
      sfx(H + 'final.mp3', 0.85);
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
      pauseUI(false);
    });
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
    if (d.you) { me.k = d.you.k; me.coins = d.you.coins || 0; me.streak = d.you.streak || 0; me.right = d.you.right || 0; me.answered = d.you.answered || 0; me.best = d.you.best || 0; }
    if (d.captains) captains = d.captains;
    build();
    paintTeam();
    applyMeter(d.meter);
    paintCounter(false);
    paintCombo(me.streak);
    document.body.classList.toggle('ssx-frenzy', g.frenzy);
    if ($('ssx')) $('ssx').classList.toggle('frenzy', g.frenzy);
    pauseUI(g.paused);
    frenzyChip();
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
        + '<div class="ssh-style" id="ssh-style"></div>'
        + '<div class="ssh-title">Así se juega</div><ol>'
        + '<li><div class="ssh-step s1" id="ssh-s1"></div><span><b>Mira la cuenta</b>siempre da 6 o 7</span></li>'
        + '<li><div class="ssh-step s2"><span class="ssi-pic-b b6"><b>6</b><small>liu</small></span><span class="ssi-pic-b b7"><b>7</b><small>qi</small></span><i class="ssx-hand"></i></div><span><b>Toca 6 o 7</b>6 es liu, 7 es qi en Chino Mandarín</span></li>'
        + '<li><div class="ssh-step s3" id="ssh-s3"></div><span><b>¡Llena tu balanza de oro!</b>En racha, cada acierto vale más</span></li>'
        + '</ol>';
      head.after(box);
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
      s.appendChild(X().dancer({ cls: 'ssf-dral' }));
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
      if (won || tie) play('liuqi', 1, 0.8, 500);
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
        if (meD.zh) fact(String(meD.zh), 'en chino');
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
    if (st.id === 'zh') return `${fmt(st.value)} en chino`;
    return `${fmt(st.value)} ${coinsWord(st.value)}`;
  }

  window.SixSevenPhone = {
    init, lobby, end,
    frame: () => ({
      on, phase: g && g.phase, meter: Object.assign({}, meter), me: Object.assign({}, me), qid: cur && cur.qid, tapped: !!(cur && cur.tapped),
      done: !!(cur && cur.done), frenzy: !!(g && g.frenzy), paused: !!(g && g.paused), stage: cer && cer.stage, style,
      locked: document.body.classList.contains('ssx-locked'),
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
    milestone: (n) => milestone({ streak: n || 6 }),
  };
})();
