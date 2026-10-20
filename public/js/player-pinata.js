// Piñata Tigre v2 — the kid's phone (the product). player.js calls PinataPhone.init(...) once; the shared phone skin
// (player-kingdoms-skin.js) gives the Kahoot question screen and routes the lobby card, the result screen and the end
// screen here. What this module adds, only while the room's game is 'pinata':
//   · countdown: the VS run-in (red | blue, each team's tiger swings in on its rope, my character runs in, my captain)
//   · intro: the rules card with ONE pictured control (the meter, a tapping hand) → «¿Listos?» → «¡YA!»
//   · question screen: a strip that always says what to do and my candies
//   · THE HIT: after every right answer the phone becomes the hit. An arrow sweeps over flojo · bien · fuerte · dorado;
//     one tap anywhere stops it, my character swings the stick, a recorded whack, vibration, the screen shakes, the
//     tiger jolts and cracks, candies fly out and land in my counter, the grade stamp, the racha chip. The tap goes to
//     the server as the ms on my own arrow clock (player:pn-hit); the server judges it and answers pn:hit. My hit broke
//     the tiger: the burst (shards + candy shower) and the next tiger drops in
//   · lead-change / burst / landmark / last-30-s banners at the top edge (never over the answer tiles), the pause card,
//     «¡FINAL!» and the ceremony: the candy jars, «¡Gana el Equipo …!» (winners cheer, the others sob under a rain
//     cloud), the bonus stars one by one, my own card
// Test hooks: PinataPhone.frame(), .tap(), .needleAt(pos), .hold(v), .freeze(v) / .replay(ev), .stage(name), .sim(ev, d).
(function () {
  'use strict';
  const P = () => window.PinataStage;
  const S = () => window.MochiStage;
  const A = '/assets/pinata/', K = '/assets/kingdoms/', H = '/assets/halcon/', MO = '/assets/mochi/';
  const $ = (id) => document.getElementById(id);
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const skin = () => window.KingdomsSkin;
  const sfx = (path, vol) => { const s = skin(); if (s && s.sfx) s.sfx(path, vol); };
  const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (_) {} };
  const later = (ms, fn, list) => { const t = setTimeout(fn, Math.max(0, ms)); (list || timers).push(t); return t; };
  const GRADE = {
    weak: { stamp: 'Flojito', buzz: 15, shake: 2, snd: 'whack', rate: 0.86, vol: 0.5 },
    good: { stamp: '¡Bien!', buzz: 25, shake: 4, snd: 'whack', rate: 1, vol: 0.7 },
    strong: { stamp: '¡Fuerte!', buzz: [20, 15, 35], shake: 7, snd: 'whackBig', rate: 1, vol: 0.8 },
    crit: { stamp: '¡CRÍTICO!', buzz: [30, 20, 30, 20, 90], shake: 12, snd: 'whackBig', rate: 1.08, vol: 0.95 },
    auto: { stamp: 'Golpe automático', buzz: 10, shake: 2, snd: 'whack', rate: 0.8, vol: 0.4 },
  };

  let ctx = null, on = false;
  let timers = [], introTimers = [], cerTimers = [];
  let g = null;                  // { id, phase, endAt (perf), paused, pausedLeft, frenzy, ladder, E }
  let meter = { r: 0, g: 0, tr: 0, tg: 0, hr: 1, hg: 1, lr: 1, lg: 1, b: null };
  let me = { k: null, candy: 0, streak: 0 };
  let roster = [];
  let captains = null;
  let testHold = false;
  const CAST = () => window.DralingoCast;
  const capLine = (mood) => { const id = captains && captains[myTeam()]; return id && CAST() ? CAST().name(id) + ': ' + CAST().line(id, mood) : ''; };

  // ---------- who I am ----------
  const myTeam = () => (ctx && ctx.getTeam()) || 'red';
  const myName = () => ($('lobby-name') && $('lobby-name').textContent) || '';
  // my character = the one the server (and the projector) shows: its `sk` for me, else what player.js getMyAvatar()
  // sends at join (Dralingo when nothing is saved)
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
  const tierOf = (t) => (t === 'red' ? meter.tr : meter.tg) || 0;
  const lifeOf = (t) => (t === 'red' ? [meter.hr, meter.lr] : [meter.hg, meter.lg]);
  function tierName(i) {
    const l = g && g.ladder && g.ladder[i];
    return l ? l.name : (P().LADDER[i] || 'Tigre de oro');
  }
  const tierLabel = (i) => (i < 4 ? `Tigre ${i + 1} · ${tierName(i)}` : '¡Tigre de oro!');
  const landmarkImg = (i) => K + 'landmarks/' + (['museum', 'frame', 'arab', 'burj'][Math.min(3, i)]) + '.webp';

  // ---------- quick sounds (Web Audio: the whack must land on the tap, with no lag) ----------
  let actx = null, loading = false;
  const bufs = {};
  const BUF = { whack: 'whack.mp3', whackBig: 'whack-big.mp3', crit: 'crit.mp3', swing: 'swing.mp3', candy: 'candy.mp3', burst: 'burst.mp3' };
  function audioReady() {
    if (actx) { if (actx.state === 'suspended') actx.resume().catch(() => {}); return; }
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      actx = new C();
      if (!loading) {
        loading = true;
        Object.entries(BUF).forEach(([k, f]) => {
          fetch(A + f).then((r) => r.arrayBuffer()).then((b) => actx.decodeAudioData(b)).then((buf) => { bufs[k] = buf; }).catch(() => {});
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
    document.body.classList.toggle('pt-on', on);
    if (!on) teardown(true);
  }
  function clearTimers(list) { (list || timers).forEach(clearTimeout); if (list) list.length = 0; else timers = []; }
  function teardown(all) {
    document.body.classList.remove('pt-zone');
    clearTimers();
    clearTimers(introTimers);
    stopSwing();
    hideIntro();
    pauseUI(false);
    clearInterval(chipT);
    if ($('pt-chip')) $('pt-chip').classList.add('hidden');
    if ($('pt-prompt')) $('pt-prompt').classList.remove('x2');
    const fin = $('pt-final');
    if (fin) fin.classList.add('hidden');
    document.body.classList.remove('pt-frenzy', 'pt-ended');
    if (all) { clearTimers(cerTimers); const f = $('pt-finale'); if (f) f.remove(); }
  }

  // ---------- the strip on the question screen: what to do + my candies ----------
  function ensurePrompt() {
    const q = $('screen-question');
    if (!q || $('pt-prompt')) return;
    const box = document.createElement('div');
    box.className = 'pt-prompt';
    box.id = 'pt-prompt';
    box.setAttribute('role', 'status');
    box.innerHTML = '<img id="pt-prompt-img" alt="" src="' + P().tigerArt(myTeam(), 0) + '"><span class="pt-prompt-t"><b>Responde bien</b><span>y le das un golpe a tu piñata</span><em class="pt-prompt-x" id="pt-prompt-x"></em></span>'
      + '<span class="pt-prompt-n"><i class="ptc ptc-w c0" aria-hidden="true"></i><b id="pt-prompt-n">0</b></span>';
    const timer = $('kdp-timer');
    if (timer) timer.after(box); else q.prepend(box);
    paintPrompt();
  }
  function paintPrompt() {
    if (!$('pt-prompt') || !P()) return;
    const u = P().tigerArt(myTeam(), tierOf(myTeam()));
    if ($('pt-prompt-img').getAttribute('src') !== u) $('pt-prompt-img').src = u;
    $('pt-prompt-n').textContent = P().fmt(me.candy);
    $('pt-prompt').classList.toggle('red', myTeam() === 'red');
  }

  // ---------- the countdown: VS run-in ----------
  function showRunIn() {
    const box = $('pt-intro');
    if (!box) return;
    clearTimers(introTimers);
    box.className = 'pt-intro runin';
    box.innerHTML = '';
    const t = myTeam();
    const side = (team, isMe) => {
      const s = P().el('div', 'pti-side ' + (team === 'red' ? 'red' : 'gold') + (isMe ? ' mine' : ''));
      s.appendChild(P().el('div', 'pti-team', 'Equipo ' + teamName(team)));
      const cid = captains && captains[team];
      if (cid && CAST()) {
        const cap = P().el('div', 'pti-capt');
        const ci = P().el('img');
        ci.alt = '';
        ci.src = CAST().pose(cid, 'hello');
        const ct = P().el('span');
        ct.append((isMe ? 'Tu ' : '') + (CAST().fem(cid) ? 'capitana' : 'capitán'), Object.assign(document.createElement('b'), { textContent: CAST().name(cid) }));
        cap.append(ci, ct);
        s.appendChild(cap);
      }
      const hang = P().el('div', 'pti-tiger');
      const tg = new (P().Tiger)(hang, { team, tier: 0, mirror: team === 'gold', idle: true });
      tg.root.classList.add('swing-in');
      s.appendChild(hang);
      const crew = P().el('div', 'pti-crew');
      const mates = roster.filter((p) => p.team === team && !p.off && (!isMe || p.name.toLowerCase() !== myName().toLowerCase())).slice(0, 3);
      mates.forEach((p, i) => {
        const f = S().kidFigure({ team, skin: S().skinFor(p.avatar, p.name), name: p.name, tag: false });
        f.style.setProperty('--i', i + (isMe ? 1 : 0));
        f.classList.add('pti-run', team === 'red' ? 'from-l' : 'from-r');
        crew.appendChild(f);
      });
      if (isMe) {
        const f = S().kidFigure({ team, skin: mySkin(), name: myName(), me: true });
        f.style.setProperty('--i', 0);
        f.classList.add('pti-run', 'pti-me', team === 'red' ? 'from-l' : 'from-r');
        crew.prepend(f);
      }
      s.appendChild(crew);
      return s;
    };
    const vs = P().el('div', 'pti-vs', 'VS');
    const cap = P().el('div', 'pti-cap ' + (t === 'red' ? 'red' : 'gold'));
    cap.append('¡Eres del ', Object.assign(document.createElement('b'), { textContent: 'Equipo ' + teamName(t) }), '!');
    box.append(side('red', t === 'red'), side('gold', t === 'gold'), vs, cap);
    sfx(K + 'whoosh.mp3', 0.6);
    later(900, () => sfx(H + 'round.mp3', 0.45), introTimers);
  }
  // the pictured control: a meter whose arrow sweeps (CSS) and a tapping hand
  function rulesPic(big) {
    const pic = P().el('div', 'pti-pic' + (big ? ' big' : ''));
    const tg = P().el('img', 'pti-pic-tiger');
    tg.alt = '';
    tg.src = P().tigerArt(myTeam(), 0);
    const m = P().el('div', 'pti-pic-meter');
    const bar = P().el('i', 'pti-pic-bar');
    const st = S().starSvg();
    st.classList.add('pti-pic-star');
    m.append(bar, st, P().el('i', 'pti-pic-needle'));
    pic.append(tg, m, P().el('i', 'pt-hand pti-pic-hand'));
    return pic;
  }
  function showRules(ms) {
    const box = $('pt-intro');
    if (!box) return;
    clearTimers(introTimers);
    box.className = 'pt-intro rules ' + (myTeam() === 'red' ? 'red' : 'gold');
    box.innerHTML = '';
    const card = P().el('div', 'pti-card');
    card.append(rulesPic(false), P().el('h2', 'pti-title', '¡Para la flecha en el dorado!'), P().el('p', 'pti-sub', 'Cada respuesta correcta es un golpe a tu piñata'));
    const say = P().el('div', 'pti-say');
    box.append(card, say);
    const total = Math.max(1400, ms || 2800);
    later(total - 1250, () => { box.classList.add('ready'); say.textContent = '¿Listos?'; sfx(K + 'tick.mp3', 0.7); }, introTimers);
    later(total - 600, () => { box.classList.add('go'); say.textContent = '¡YA!'; sfx(H + 'start.mp3', 0.8); buzz(30); }, introTimers);
    later(total + 400, () => { if (!testHold) hideIntro(); }, introTimers);
  }
  function hideIntro() {
    const box = $('pt-intro');
    if (box && !testHold) { clearTimers(introTimers); box.className = 'pt-intro hidden'; box.innerHTML = ''; }
  }

  // ---------- THE HIT ----------
  let sw = null;                 // the open swing: { hid, phase, half, window, z, wide, fast, streak, bonus, t0, paused, pausedAt, pausedSum, tapped, c, local }
  let tiger = null, meterEl = null, candy = null, kidFig = null, stickEl = null, rafT = null, swingResult = null;
  let helped = 0, lastHid = 0;
  let pending = null;            // a right answer's swing still in its lead-in: { info, t, pausedAt }
  let retryT = null;             // a tap that got no answer (a Wi-Fi blip) is sent once more
  function buildZone() {
    const z = $('ptz');
    if (!z || meterEl) return;
    meterEl = new (P().Meter)($('ptz-meterbox'));
    candy = new (P().Candy)($('ptz-fx'), 26);
    const tap = (e) => {
      if (e.pointerType && e.pointerType !== 'mouse' && e.cancelable) e.preventDefault();
      onTap();
    };
    z.addEventListener('pointerdown', tap);
    z.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) onTap(); } });
    z.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('resize', () => { if (meterEl) meterEl.measure(); });
  }
  function paintZoneTeam() {
    const t = myTeam();
    const z = $('ptz');
    z.classList.toggle('red', t === 'red');
    z.classList.toggle('gold', t !== 'red');
    if (!tiger || tiger.team !== t) {
      $('ptz-tiger').innerHTML = '';
      tiger = new (P().Tiger)($('ptz-tiger'), { team: t, tier: tierOf(t), mirror: true, idle: true });
    }
    const kid = $('ptz-kid');
    if (!kidFig || kidFig._skin !== mySkin() || kidFig._team !== t) {
      kid.innerHTML = '';
      kidFig = S().kidFigure({ team: t, skin: mySkin(), name: myName(), me: true });
      kidFig._team = t;
      stickEl = P().stick(t);
      kidFig.appendChild(stickEl);
      kid.appendChild(kidFig);
    }
  }
  function paintTier() {
    const t = myTeam();
    const i = tierOf(t);
    if (tiger) tiger.setTier(i, false);            // (also brings back a tiger whose burst timer was cleared)
    const [left, total] = lifeOf(t);
    if (tiger) tiger.setLife(left, total);
    $('ptz-tier-name').textContent = tierLabel(i);
    const u = landmarkImg(i);
    if ($('ptz-tier-img').getAttribute('src') !== u) $('ptz-tier-img').src = u;
    $('ptz-tier').classList.toggle('golden', i >= 3);
    $('ptz-life').style.transform = `scaleX(${total > 0 ? Math.max(0, Math.min(1, left / total)).toFixed(3) : 1})`;
  }
  function paintMeter() {
    if (!$('ptz-mr')) return;
    const sum = Math.max(1, meter.r + meter.g);
    $('ptz-mr').style.transform = `scaleX(${(meter.r + meter.g ? meter.r / sum : 0.5).toFixed(3)})`;
    $('ptz-rn').textContent = P().fmt(meter.r);
    $('ptz-gn').textContent = P().fmt(meter.g);
    const t = myTeam();
    const a = t === 'red' ? meter.r : meter.g, b = t === 'red' ? meter.g : meter.r;
    const st = $('ptz-status');
    st.textContent = a > b ? `¡Ganamos por ${P().fmt(a - b)}!` : a < b ? `¡Faltan ${P().fmt(b - a)}!` : '¡Empate!';
    st.className = 'ptz-status ' + (a > b ? 'ahead' : a < b ? 'behind' : '');
  }
  function streakChip(n) {
    const el = $('ptz-streak');
    if (!el) return;
    if (!(n >= 2)) { el.className = 'ptz-streak'; el.textContent = ''; return; }
    el.className = 'ptz-streak show' + (n >= 6 ? ' fire' : n >= 3 ? ' hot' : '');
    el.textContent = '';
    el.append(Object.assign(document.createElement('b'), { textContent: `Racha ×${n}` }));
    if (n >= 3) el.append(Object.assign(document.createElement('span'), { textContent: n >= 6 ? '+2 ¡En llamas!' : '+1 golpe' }));
  }
  function openSwing(info) {
    if (!on || !info || !info.hid || !g || g.phase !== 'play') return;     // never after «¡FINAL!»
    if (info.hid <= lastHid) return;                                       // (an old swing)
    buildZone();
    stopSwing();
    paintZoneTeam();
    ctx.showScreen('pinata');
    document.body.classList.add('pt-zone');
    const z = $('ptz');
    z.classList.remove('done', 'hurry', 'burst');
    z.classList.toggle('frenzy', !!(g && g.frenzy));
    z.focus({ preventScroll: true });
    sw = {
      hid: info.hid, phase: info.phase || 0, half: info.half || 900, window: info.window || 2700,
      z: { crit: info.crit || 0.075, strong: info.strong || 0.2, good: info.good || 0.34 }, wide: !!info.wide,
      fast: !!info.fast, streak: info.streak || 0, bonus: info.bonus || 0, t0: (info._t0 || performance.now()) + (info.lead || 0),
      paused: false, pausedAt: 0, pausedSum: 0, tapped: false, c: null, local: null,
    };
    lastHid = sw.hid;
    me.streak = sw.streak;
    $('ptz-n').textContent = P().fmt(me.candy);
    $('ptz-stamp').className = 'ptz-stamp';
    $('ptz-stamp').textContent = '';
    $('ptz-hint').textContent = '¡Toca en el dorado!';
    $('ptz-hint').className = 'ptz-hint';
    const notes = $('ptz-notes');
    notes.innerHTML = '';
    const note = (txt, cls) => notes.appendChild(P().el('span', 'ptz-note ' + (cls || ''), txt));
    if (sw.wide) note('¡Van perdiendo: zona dorada más grande!', 'wide');
    if (sw.fast) note('¡Rápido! +1', 'fast');
    if (g && g.frenzy) note('¡Doble golpe!', 'x2');
    streakChip(sw.streak);
    paintMeter();
    paintTier();
    meterEl.zones(sw.z);
    meterEl.root.classList.toggle('wide', sw.wide);
    const bar = $('ptz-bar');
    bar.style.transition = 'none';
    bar.style.transform = 'scaleX(1)';
    void bar.offsetWidth;
    const left = Math.max(0, sw.t0 + sw.window - performance.now());
    if (g.paused) { sw.paused = true; sw.pausedAt = performance.now(); }
    else { bar.style.transition = `transform ${left}ms linear`; bar.style.transform = 'scaleX(0)'; }
    if (helped < 2 && !reduced()) { helped++; z.classList.add('teach'); later(2400, () => z.classList.remove('teach')); }
    loop();
    ctx.markActivity();
  }
  const swingC = () => (sw ? Math.max(0, (sw.paused ? sw.pausedAt : performance.now()) - sw.t0 - sw.pausedSum) : 0);
  let heldPos = null;            // test hook: the arrow stays here (screenshots)
  function loop() {
    if (!sw || sw.tapped) return;
    const c = swingC();
    meterEl.at(heldPos != null ? heldPos : P().needle(sw.phase, c, sw.half));
    if (!sw.paused && heldPos == null) {
      const left = sw.window - c;
      if (left <= 900 && !$('ptz').classList.contains('hurry')) { $('ptz').classList.add('hurry'); sfx(K + 'tick.mp3', 0.45); }
      if (left <= 0) { autoSwing(); return; }
    }
    rafT = requestAnimationFrame(loop);
  }
  function onTap() {
    audioReady();
    if (!sw || sw.tapped || sw.paused || (g && g.paused)) return;
    const c = heldPos != null ? null : swingC();
    if (c != null && c > sw.window) { autoSwing(); return; }
    sw.tapped = true;
    cancelAnimationFrame(rafT);
    const pos = heldPos != null ? heldPos : P().needle(sw.phase, c, sw.half);
    const gr = P().grade(pos, sw.z);
    sw.c = c != null ? Math.round(c) : null;
    sw.local = gr;
    meterEl.stop(pos, gr);
    const tap = { pin: ctx.getPin(), hid: sw.hid, c: sw.c };
    ctx.socket.emit('player:pn-hit', tap);
    clearTimeout(retryT);
    retryT = setTimeout(() => { if (sw && sw.hid === tap.hid && sw.tapped && ctx.socket.connected) ctx.socket.emit('player:pn-hit', tap); }, 1400);
    ctx.markActivity();
    swingAnim(gr, predicted(gr));
  }
  // the phone's own guess of the power (the server's pn:hit confirms it a moment later)
  function predicted(gr) {
    const base = { crit: 6, strong: 3, good: 2, weak: 1, auto: 1 }[gr] + (gr === 'auto' ? 0 : sw ? sw.bonus : 0);
    return base * (g && g.frenzy ? 2 : 1);
  }
  function autoSwing() {
    if (!sw || sw.tapped) return;
    sw.tapped = true;
    sw.local = 'auto';
    cancelAnimationFrame(rafT);
    meterEl.root.classList.add('stop', 'g-auto');
    ctx.socket.emit('player:pn-hit', { pin: ctx.getPin(), hid: sw.hid, auto: true });
    swingAnim('auto', predicted('auto'));
  }
  // the swing: wind-up + strike (stick and body), the impact ~130 ms later: whack, buzz, shake, jolt, candies, stamp
  function swingAnim(gr, power) {
    const G = GRADE[gr] || GRADE.weak;
    const z = $('ptz');
    $('ptz').classList.remove('hurry');
    $('ptz').classList.add('done');
    const bar = $('ptz-bar');
    bar.style.transition = 'none';
    play('swing', 1.05, 0.5);
    if (!reduced() && stickEl && stickEl.animate) {
      stickEl.animate([
        { transform: 'rotate(10deg)' }, { transform: 'rotate(-35deg)', offset: 0.3 },
        { transform: 'rotate(62deg)', offset: 0.55 }, { transform: 'rotate(34deg)', offset: 0.75 }, { transform: 'rotate(10deg)' },
      ], { duration: 520, easing: 'cubic-bezier(.3,.7,.2,1)' });
      if (kidFig && kidFig._img.animate) kidFig._img.animate([
        { transform: 'rotate(0deg)' }, { transform: 'rotate(-6deg) translateX(-3%)', offset: 0.3 },
        { transform: 'rotate(7deg) translateX(5%)', offset: 0.55 }, { transform: 'rotate(0deg)' },
      ], { duration: 560, easing: 'cubic-bezier(.3,.7,.2,1)' });
    }
    later(gr === 'auto' ? 120 : 140, () => impact(gr, power, G));
  }
  function impact(gr, power, G) {
    const z = $('ptz');
    play(G.snd, G.rate * (0.96 + Math.random() * 0.08), G.vol);
    if (gr === 'crit') play('crit', 1, 0.8, 40);
    buzz(G.buzz);
    if (!reduced() && z.animate) {
      const a = G.shake;
      z.animate([
        { transform: 'translate(0,0)' }, { transform: `translate(${a}px, ${-a * 0.6}px)` }, { transform: `translate(${-a * 0.8}px, ${a * 0.5}px)` },
        { transform: `translate(${a * 0.5}px, ${a * 0.3}px)` }, { transform: 'translate(0,0)' },
      ], { duration: gr === 'crit' ? 420 : 280, easing: 'ease-out' });
    }
    if (gr === 'crit') { const f = $('ptz-flash'); if (f) { f.classList.remove('show'); void f.offsetWidth; f.classList.add('show'); } }
    if (tiger && !reduced()) {
      const at = tiger.impact(), L = $('ptz-fx').getBoundingClientRect();
      const pop = P().el('i', 'ptz-pop' + (gr === 'crit' ? ' crit' : ''));
      pop.style.left = (at.x - L.left) + 'px';
      pop.style.top = (at.y - L.top) + 'px';
      $('ptz-fx').appendChild(pop);
      setTimeout(() => pop.remove(), 500);
    }
    if (tiger) {
      tiger.jolt(power, gr === 'crit');
      const n = Math.max(1, Math.min(14, power));
      candy.spill(tiger.impact(), n, { spread: 120 + n * 9, gold: gr === 'crit', size: 24, fall: 300 });
      // a few of them reach my counter
      const cnt = $('ptz-n').getBoundingClientRect();
      const to = { x: cnt.left + cnt.width / 2, y: cnt.top + cnt.height / 2 };
      for (let i = 0; i < Math.min(4, n); i++) {
        candy.fly(tiger.center(), to, { gold: gr === 'crit' && i === 0, delay: 120 + i * 70, drift: (Math.random() - 0.5) * 60, onLand: i === 0 ? () => play('candy', 1, 0.5) : null });
      }
    }
    stamp(gr, power);
  }
  function stamp(gr, power) {
    const s = $('ptz-stamp');
    s.className = 'ptz-stamp g-' + gr;
    s.textContent = '';
    s.append(Object.assign(document.createElement('b'), { textContent: (GRADE[gr] || GRADE.weak).stamp }),
      Object.assign(document.createElement('span'), { textContent: `+${power} ${power === 1 ? 'caramelo' : 'caramelos'}` }));
    void s.offsetWidth;
    s.classList.add('show');
    $('ptz-hint').textContent = gr === 'auto' ? '¡La próxima vez, toca la pantalla!' : gr === 'crit' ? '¡Golpe perfecto!' : '¡Buen golpe!';
    $('ptz-hint').className = 'ptz-hint done ' + gr;
  }
  // the server's verdict (pn:hit): the real numbers; a different grade than guessed replaces the stamp
  function onHit(h) {
    if (!h) return;
    me.candy = h.total;
    me.streak = h.streak || me.streak;
    paintPrompt();
    const cur = sw && sw.hid === h.hid ? sw : null;
    if (cur) clearTimeout(retryT);
    if (cur && (!cur.local || cur.local !== h.grade)) stamp(h.grade, h.power);
    else if (cur) { const sp = $('ptz-stamp').querySelector('span'); if (sp) sp.textContent = `+${h.power} ${h.power === 1 ? 'caramelo' : 'caramelos'}`; }
    else if (!cur && $('ptz') && !$('screen-pinata').classList.contains('hidden')) stamp(h.grade, h.power);   // the server closed it
    later(380, () => { if ($('ptz-n')) { $('ptz-n').textContent = P().fmt(me.candy); bump($('ptz-n')); } });
    if (h.meter) applyMeter(h.meter);
    (h.bursts || []).forEach((b, i) => later(420 + i * 1300, () => burstMoment(b, true)));
    if (cur) { sw = null; swingResult = h; }
  }
  const bump = (n) => { if (!reduced() && n && n.animate) n.animate([{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' }); };
  function stopSwing() {
    cancelAnimationFrame(rafT);
    sw = null;
  }
  // a tiger broke: on the hit screen the big moment (mine = my own hit broke it), elsewhere a banner
  const seenBursts = new Set();
  function burstMoment(b, mineHit) {
    if (!b || seenBursts.has(b.bid)) return;
    seenBursts.add(b.bid);
    const ours = mine(b.team);
    const zoneOn = $('screen-pinata') && !$('screen-pinata').classList.contains('hidden') && document.body.classList.contains('pt-zone');
    if (ours && zoneOn && tiger) {
      const z = $('ptz');
      z.classList.add('burst');
      const c = tiger.center();
      tiger.burst($('ptz-fx'));
      candy.spill(c, reduced() ? 0 : 22, { spread: 230, size: 28, fall: 520, ms: 1300, stagger: 12 });
      if (S()) S().confetti($('ptz-conf'), b.team, 26);
      play('burst', 1, 0.85);
      later(200, () => sfx(K + 'sting-win.mp3', 0.7));
      buzz([60, 40, 60, 40, 160]);
      const big = $('ptz-big');
      big.className = 'ptz-big ' + (b.team === 'red' ? 'red' : 'gold');
      big.textContent = '';
      big.append(Object.assign(document.createElement('b'), { textContent: mineHit ? '¡ROMPISTE LA PIÑATA!' : `¡${b.who || 'Tu equipo'} rompió la piñata!` }),
        Object.assign(document.createElement('span'), { textContent: `+${b.jackpot} caramelos para tu equipo` }));
      if (b.landmark) big.append(Object.assign(document.createElement('em'), { textContent: `¡Primeros en el ${b.name}! +${b.bonus}` }));
      later(450, () => { void big.offsetWidth; big.classList.add('show'); });
      later(2350, () => { big.classList.remove('show'); z.classList.remove('burst'); });
      later(1100, () => { if (tiger) { tiger.setTier(b.tier + 1, true); paintTier(); } });
      return;
    }
    const img = P().el('img');
    img.alt = '';
    img.src = b.tier < 4 ? landmarkImg(b.tier) : P().tigerArt(b.team, b.tier);
    const head = ours ? `¡${b.who || 'Tu equipo'} rompió la piñata! +${b.jackpot}` : `El Equipo ${teamName(b.team)} rompió su piñata`;
    const sub = b.landmark ? (ours ? `¡Primeros en el ${b.name}! +${b.bonus} caramelos` : `Llegaron primero al ${b.name}. ¡A remontar!`)
      : ours ? '¡Viene un tigre más grande!' : `+${b.jackpot} caramelos para ellos`;
    banner('burst', [img, Object.assign(document.createElement('b'), { textContent: head }), Object.assign(document.createElement('span'), { textContent: sub })], b.team, 2400);
    sfx(ours ? A + 'burst.mp3' : K + 'castle-alert.mp3', ours ? 0.6 : 0.45);
    if (ours) buzz([40, 30, 40]);
  }

  // ---------- banners at the top edge ----------
  let bannerQ = [], bannerOn = false;
  function banner(kind, html, team, ms) {
    bannerQ.push({ kind, html, team, ms: ms || 2300 });
    if (bannerQ.length > 3) bannerQ.splice(0, bannerQ.length - 3);         // never a backlog
    if (!bannerOn) nextBanner();
  }
  function nextBanner() {
    const b = $('pt-banner');
    const it = bannerQ.shift();
    if (!b || !it) { bannerOn = false; return; }
    bannerOn = true;
    b.className = 'pt-banner ' + it.kind + (it.team ? ' ' + (it.team === 'red' ? 'red' : 'gold') : '');
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

  // ---------- pause, frenzy chip ----------
  let paused = false;
  function pauseUI(v) {
    v = !!v;
    const box = $('pt-pause');
    if (box) box.classList.toggle('hidden', !v);
    if (v === paused) return;
    paused = v;
    if (!sw || sw.tapped) return;
    const bar = $('ptz-bar');
    if (v) {
      sw.paused = true;
      sw.pausedAt = performance.now();
      const left = Math.max(0, sw.window - swingC());
      bar.style.transition = 'none';
      bar.style.transform = `scaleX(${(left / sw.window).toFixed(3)})`;
    } else {
      if (sw.paused) sw.pausedSum += performance.now() - sw.pausedAt;
      sw.paused = false;
      const left = Math.max(0, sw.window - swingC());
      void bar.offsetWidth;
      bar.style.transition = `transform ${left}ms linear`;
      bar.style.transform = 'scaleX(0)';
    }
  }
  let chipT = null;
  function frenzyChip() {
    clearInterval(chipT);
    const chip = $('pt-chip');
    if (!chip || !g || !g.frenzy) { if (chip) chip.classList.add('hidden'); return; }
    chip.classList.remove('hidden');
    const paint = () => {
      if (!g || !g.endAt) return;
      const left = g.paused ? g.pausedLeft : Math.max(0, g.endAt - performance.now());
      const s = Math.max(0, Math.ceil(left / 1000));
      const t = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      chip.querySelector('b').textContent = t;
      chip.classList.toggle('last', s <= 10);
      if ($('pt-prompt')) { $('pt-prompt').classList.add('x2'); $('pt-prompt-x').textContent = `¡Doble golpe! Quedan ${t}`; }
    };
    paint();
    chipT = setInterval(paint, 250);
  }
  function applyMeter(d) {
    if (!d) return;
    const before = { tr: meter.tr, tg: meter.tg };
    meter = Object.assign({}, meter, d);
    if (skin() && skin().setScores) skin().setScores({ red: meter.r, gold: meter.g });
    paintMeter();
    // the tiger on my hit screen follows (a burst animates it; a plain meter only repaints the cracks)
    if (tiger && before[myTeam() === 'red' ? 'tr' : 'tg'] === tierOf(myTeam())) {
      const [l, t] = lifeOf(myTeam());
      tiger.setLife(l, t);
      if ($('ptz-life')) $('ptz-life').style.transform = `scaleX(${t > 0 ? Math.max(0, Math.min(1, l / t)).toFixed(3) : 1})`;
    } else if (tiger && !document.body.classList.contains('pt-zone')) paintTier();
    paintPrompt();
  }

  // ---------- events ----------
  let frozen = false, queue = [];
  const handlers = {};
  function init(c) {
    ctx = c;
    const sock = c.socket;
    if (skin() && skin().holdWhen) skin().holdWhen(() => on && !!(g && g.paused));
    // the swing's ping: answered at once (its round trip is how the server judges my tap)
    sock.on('pn:ping', (d, ack) => { if (typeof ack === 'function') ack({ ok: 1 }); });
    const s = { on: (ev, fn) => { handlers[ev] = fn; sock.on(ev, (d) => { if (frozen && ev.indexOf('pn:') === 0) { queue.push([fn, d, ev]); return; } fn(d); }); } };
    s.on('state', (st) => {
      if (!st) return;
      if (st.gameType) setOn(st.gameType === 'pinata');
      if (!on) return;
      roster = Object.values(st.players || {}).map((p) => ({ name: p.name, team: p.team, avatar: p.avatar, off: !!p.off }));
      const meP = st.players && sock.id && st.players[sock.id];
      if (meP && meP.sk) mySk = meP.sk;
      if (st.state === 'lobby') { teardown(true); g = null; meter = { r: 0, g: 0, tr: 0, tg: 0, hr: 1, hg: 1, lr: 1, lg: 1, b: null }; me = { k: null, candy: 0, streak: 0 }; }
    });
    s.on('team-changed', () => { if (on) { paintPrompt(); if ($('ptz')) paintZoneTeam(); } });
    s.on('countdown', () => {
      if (!on) return;
      teardown(true);
      meter = { r: 0, g: 0, tr: 0, tg: 0, hr: 1, hg: 1, lr: 1, lg: 1, b: null };
      me = { k: null, candy: 0, streak: 0 };
      g = null;
      P().preload();
      showRunIn();
    });
    s.on('pn:init', (d) => applyInit(d));
    s.on('pn:captains', (cp) => { captains = cp; });
    s.on('pn:play', (d) => {
      if (!on || !g) return;
      g.phase = 'play';
      g.endAt = performance.now() + (d.endsMs || 0);
      ctx.markActivity();
    });
    s.on('question', () => {
      document.body.classList.remove('pt-zone');
      if (!on) return;
      if (sw) stopSwing();
      hideIntro();
      setTimeout(() => { ensurePrompt(); paintPrompt(); }, 0);
    });
    s.on('answer-result', (r) => {
      if (!on || !r || !r.pinata) return;
      stopSwing();
      if (r.correct && r.pinata.hid) {
        const info = Object.assign({ _t0: performance.now() }, r.pinata);
        pending = { info, t: later(info.lead || 800, () => { pending = null; openSwing(info); }), pausedAt: 0 };
      }
    });
    s.on('pn:hit', (h) => { if (on) onHit(h); });
    s.on('pn:nohit', (d) => {
      if (!on || !d || !sw || sw.hid !== d.hid) return;
      if (!d.paused) { sw = null; return; }                     // the server already closed it (its auto result came first)
      // the tap crossed the teacher's «Pausa»: the swing is still open on the server, so it comes back held, and the
      // kid taps again after «Seguir»
      sw.tapped = false;
      sw.local = null;
      if (!sw.paused) { sw.paused = true; sw.pausedAt = performance.now(); }
      meterEl.root.classList.remove('stop', 'g-crit', 'g-strong', 'g-good', 'g-weak', 'g-auto');
      $('ptz').classList.remove('done');
      $('ptz-stamp').className = 'ptz-stamp';
      $('ptz-hint').textContent = '¡Toca en el dorado!';
      $('ptz-hint').className = 'ptz-hint';
      loop();
    });
    s.on('pn:meter', (d) => { if (on) applyMeter(d); });
    s.on('pn:burst', (b) => {
      if (!on || !b) return;
      if (b.meter) applyMeter(b.meter);
      // my own hit's burst plays from pn:hit (after the swing); everybody else's now
      if (b.k && b.k === me.k) return;
      burstMoment(b, false);
    });
    s.on('pn:lead', (d) => {
      if (!on || !d) return;
      if (d.meter) applyMeter(d.meter);
      const ours = mine(d.team);
      banner('lead', [Object.assign(document.createElement('b'), { textContent: d.first ? `¡El Equipo ${teamName(d.team)} toma la delantera!` : `¡El Equipo ${teamName(d.team)} pasa adelante!` }),
        Object.assign(document.createElement('span'), { textContent: capLine(ours ? 'fiesta' : 'smash') || (ours ? '¡Sigan así!' : '¡A remontar! Responde y golpea en el dorado') })], d.team, 2400);
      sfx(K + (ours ? 'flag.mp3' : 'castle-alert.mp3'), 0.6);
      buzz(ours ? [30, 40, 30] : [60, 40, 60]);
    });
    s.on('pn:frenzy', (d) => {
      if (!on || !g) return;
      g.frenzy = true;
      g.endAt = performance.now() + (d.endsMs || 30000);
      document.body.classList.add('pt-frenzy');
      if ($('ptz')) $('ptz').classList.add('frenzy');
      banner('frenzy', [Object.assign(document.createElement('b'), { textContent: '¡Últimos 30 segundos!' }), Object.assign(document.createElement('span'), { textContent: '¡DOBLE GOLPE! Cada golpe vale el doble' })], null, 2600);
      sfx(K + 'siege.mp3', 0.6);
      buzz([50, 40, 50, 40, 80]);
      if (skin() && skin().music) skin().music('music-final', 0.4);
      frenzyChip();
    });
    s.on('pn:time', (d) => {
      if (!on || !g) return;
      g.endAt = performance.now() + (d.endsMs || 0);
      if (g.paused) g.pausedLeft = d.endsMs || g.pausedLeft;
      banner('time', d.add < 0 ? `${-d.add} segundos menos` : `+${d.add || 30} segundos más`, null, 1600);
      frenzyChip();
    });
    s.on('pn:pause', (d) => {
      if (!on || !g) return;
      g.paused = !!d.paused;
      if (g.paused) g.pausedLeft = Math.max(0, g.endAt - performance.now());
      else if (d.endsMs != null) g.endAt = performance.now() + d.endsMs;
      pauseUI(g.paused);
      if (skin() && skin().hold) skin().hold(g.paused);
      if (g.paused) clearInterval(chipT); else frenzyChip();
      if (g.phase === 'intro') { if (g.paused) clearTimers(introTimers); else showRules(d.phaseMs); }
      // a swing still in its lead-in waits with the server's clock (the server moves its start by the pause too)
      if (pending) {
        if (g.paused) { clearTimeout(pending.t); pending.pausedAt = performance.now(); }
        else if (pending.pausedAt) {
          const p0 = pending; p0.info._t0 += performance.now() - p0.pausedAt; p0.pausedAt = 0;
          p0.t = later(Math.max(0, p0.info._t0 + (p0.info.lead || 0) - performance.now()), () => { pending = null; openSwing(p0.info); });
        }
      }
      ctx.markActivity();
    });
    s.on('pn:scale', (d) => {
      if (!on || !g || !d || d.id !== g.id) return;
      g.E = d.E;
      g.ladder = d.ladder || g.ladder;
      if (d.meter) applyMeter(d.meter);
    });
    s.on('pn:final', (d) => {
      if (!on) return;
      ctx.markActivity();
      clearTimers();                                       // a swing that was about to open never opens after «¡FINAL!»
      pending = null;
      clearTimeout(retryT);
      hideIntro();
      if (sw && !sw.tapped) autoSwing();
      if ($('ptz-hint')) $('ptz-hint').textContent = '';
      document.querySelectorAll('.pt-next').forEach((n) => { n.textContent = '¡Ahora viene el gran final!'; });
      clearInterval(chipT);
      if ($('pt-chip')) $('pt-chip').classList.add('hidden');
      if (d && d.meter) applyMeter(d.meter);
      if (g) g.phase = 'final';
      pauseUI(false);
      const f = $('pt-final');
      if (f) { f.classList.remove('hidden', 'show'); void f.offsetWidth; f.classList.add('show'); }
      sfx(H + 'final.mp3', 0.85);
      buzz([40, 30, 40]);
      if (skin() && skin().music) skin().music(null);
    });
    s.on('pn:skip', () => { if (on) jumpToCard(); });
    s.on('game-end', () => {
      if (!on) return;
      document.body.classList.remove('pt-zone');
      clearTimers(); stopSwing(); clearInterval(chipT);
      pending = null;
      clearTimeout(retryT);
      testHold = false;
      hideIntro();
      if ($('pt-chip')) $('pt-chip').classList.add('hidden');
      pauseUI(false);
    });
  }
  function applyInit(d) {
    setOn(true);
    ctx.markActivity();
    const fresh = !g || g.id !== d.id;
    if (fresh) {                                    // a new game numbers its swings and bursts from 1 again
      lastHid = 0; seenBursts.clear(); swingResult = null;
      document.body.classList.remove('pt-ended');   // and the sound button leaves the ceremony's corner
    }
    g = {
      id: d.id, phase: d.phase, E: d.E, ladder: d.ladder || [], frenzy: !!d.frenzy, paused: !!d.paused,
      endAt: d.endsMs != null ? performance.now() + d.endsMs : 0, pausedLeft: d.endsMs || 0,
    };
    if (d.you) { me.k = d.you.k; me.candy = d.you.candy || 0; me.streak = d.you.streak || 0; }
    if (d.captains) captains = d.captains;
    applyMeter(d.meter);
    document.body.classList.toggle('pt-frenzy', g.frenzy);
    pauseUI(g.paused);
    frenzyChip();
    paintPrompt();
    if (d.phase === 'intro') { if (fresh || !$('pt-intro').classList.contains('rules')) showRules(d.phaseMs); }
    else hideIntro();
    const fin = $('pt-final');
    if (fin) { fin.classList.toggle('hidden', d.phase !== 'final'); fin.classList.toggle('show', d.phase === 'final'); }
  }

  // ---------- the result screen (from the skin): my character reacts ----------
  function result(box, correct, correctText, r) {
    box.innerHTML = '';
    const info = (r && r.pinata) || {};
    const t = myTeam();
    const pic = P().el('div', 'pt-res-pic' + (correct ? ' ok' : ' no'));
    const f = S().kidFigure({ team: t, skin: mySkin(), name: myName(), pose: correct ? 'ok' : 'no', tag: false });
    if (correct) f.appendChild(P().stick(t));
    pic.appendChild(f);
    if (correct) { const tg = P().el('img', 'pt-res-tiger'); tg.alt = ''; tg.src = P().tigerArt(t, tierOf(t)); pic.appendChild(tg); }
    const title = P().el('div', 'kdp-res-title ' + (correct ? 'ok' : 'no'));
    const timeUp = !correct && r && r.timeUp;
    title.textContent = correct ? '¡Correcto!' : timeUp ? '¡Se acabó el tiempo!' : '¡Casi!';
    box.append(pic, title);
    if (correct) {
      box.appendChild(P().el('div', 'kdp-res-sub', '¡Prepárate para golpear!'));
      const chips = P().el('div', 'pt-res-chips');
      if (info.fast) chips.appendChild(P().el('span', 'pt-res-chip fast', '¡Rápido! +1'));
      if (info.streak >= 3) chips.appendChild(P().el('span', 'pt-res-chip hot', `Racha de ${info.streak}: +${info.streak >= 6 ? 2 : 1}`));
      else if (info.streak >= 2) chips.appendChild(P().el('span', 'pt-res-chip', `Racha de ${info.streak}`));
      if (info.wide) chips.appendChild(P().el('span', 'pt-res-chip wide', 'Zona dorada más grande'));
      if (chips.childNodes.length) box.appendChild(chips);
    } else {
      box.appendChild(P().el('div', 'kdp-res-sub', 'La respuesta era'));
      box.appendChild(P().el('div', 'kdp-res-answer', correctText || ''));
      box.appendChild(P().el('div', 'kdp-res-sub pt-next', 'Ya viene otra pregunta…'));
    }
  }

  // ---------- lobby: who I am + «Así se juega» ----------
  function lobby(head) {
    let box = $('pt-how');
    if (!head) { if (box) box.remove(); return; }
    if (!S() || !P()) return;
    const t = myTeam();
    if (!box) {
      box = document.createElement('div');
      box.className = 'pt-how';
      box.id = 'pt-how';
      box.innerHTML = '<div class="pt-you"><div class="pt-you-kid" id="pt-you-kid"></div><div class="pt-you-tiger" id="pt-you-tiger"></div><span>Tú y tu piñata<b id="pt-you-team"></b></span></div>'
        + '<div class="pt-how-title">Así se juega</div><ol>'
        + '<li><div class="pt-step s1"><i class="t r"></i><i class="t b"></i><i class="t y"></i><i class="t g ok"></i></div><span><b>Responde bien</b>la pregunta en Chino Mandarín</span></li>'
        + '<li><div class="pt-step s2" id="pt-how-meter"></div><span><b>Toca en el dorado</b>y tu golpe es ¡CRÍTICO!</span></li>'
        + '<li><div class="pt-step s3" id="pt-how-burst"></div><span><b>¡Rompe la piñata!</b>Gana el equipo con más caramelos</span></li>'
        + '</ol>';
      head.after(box);
      const m = $('pt-how-meter');
      const bar = P().el('i', 'pti-pic-bar');
      const st = S().starSvg();
      st.classList.add('pti-pic-star');
      m.append(bar, st, P().el('i', 'pti-pic-needle'), P().el('i', 'pt-hand'));
      const bz = $('pt-how-burst');
      const im = P().el('img');
      im.alt = '';
      bz.appendChild(im);
      for (let i = 0; i < 5; i++) { const cdy = P().candy(i === 0, i % 3 === 0 ? 'l' : 'w'); cdy.style.setProperty('--i', i); bz.appendChild(cdy); }
    }
    box.classList.toggle('red', t === 'red');
    const kid = $('pt-you-kid');
    kid.innerHTML = '';
    const f = S().kidFigure({ team: t, skin: mySkin(), name: myName(), tag: false });
    f.appendChild(P().stick(t));
    kid.appendChild(f);
    const ty = $('pt-you-tiger');
    ty.innerHTML = '';
    const im = P().el('img');
    im.alt = '';
    im.src = P().tigerArt(t, 0);
    ty.appendChild(im);
    $('pt-you-team').textContent = 'Equipo ' + teamName(t);
    $('pt-how-burst').querySelector('img').src = P().tigerArt(t, 3);
  }

  // ---------- the end: the ceremony, then my card ----------
  let cer = null;
  function end(data) {
    if (!S() || !P()) return;
    const box = $('screen-end');
    if (!box) return;
    clearTimers(cerTimers);
    const old = $('pt-finale');
    if (old) old.remove();
    const fin = document.createElement('div');
    fin.className = 'pt-finale';
    fin.id = 'pt-finale';
    box.appendChild(fin);
    document.body.classList.add('pt-ended');
    bannerQ = []; bannerOn = false;
    if ($('pt-banner')) $('pt-banner').classList.remove('show');
    const f = $('pt-final');
    if (f) f.classList.add('hidden');
    cer = { data, stage: null, fin };
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'pt-skip';
    skip.textContent = 'Ver mi tarjeta';
    skip.addEventListener('click', jumpToCard);
    fin.appendChild(skip);
    // a phone that reloaded after the end (it never saw this game live) goes straight to its card
    if (!g) { stage('card'); return; }
    const stars = ((data && data.pinata && data.pinata.stars) || []);
    const plan = [['jars', 3600], ['result', 3000]].concat(stars.map((s, i) => ['star' + i, 2200]));
    let t = 0;
    plan.forEach(([name, ms]) => { later(t, () => stage(name), cerTimers); t += ms; });
    later(t, () => stage('card'), cerTimers);
  }
  function jumpToCard() { if (!cer) return; clearTimers(cerTimers); stage('card'); }
  function stageBox(cls) {
    const fin = cer.fin;
    const old = fin.querySelector('.ptf-stage');
    if (old) old.remove();
    const s = document.createElement('div');
    s.className = 'ptf-stage ' + cls;
    fin.prepend(s);
    return s;
  }
  // a candy jar (glass + a candy fill that rises)
  function jar(team, isMine, label, tier) {
    const col = P().el('div', 'ptf-col ' + (team === 'red' ? 'red' : 'gold') + (isMine ? ' mine' : ''));
    const hang = P().el('div', 'ptf-hang');
    const tg = new (P().Tiger)(hang, { team, tier: Math.min(3, tier || 0), mirror: team === 'gold', idle: false });
    const j = P().el('div', 'ptf-jar');
    const fill = P().el('i', 'ptf-fill');
    j.append(fill, P().el('i', 'ptf-glass'));
    const n = P().el('b', 'ptf-n', '0');
    col.append(hang, j, n, P().el('span', 'ptf-team', label));
    return { col, tiger: tg, fill, n };
  }
  function stage(name) {
    if (!cer) return;
    cer.stage = name;
    const d = cer.data || {}, mo = d.pinata || {}, meD = d.me || {};
    const tt = mo.totals || { r: 0, g: 0 };
    const t = meD.team || myTeam();
    const el = P().el;
    if (name === 'jars') {
      const s = stageBox('jars');
      s.appendChild(el('h2', 'ptf-h', '¿Quién juntó más caramelos?'));
      const row = el('div', 'ptf-jars');
      const fx = el('div', 'ptf-fx');
      const cfx = new (P().Candy)(fx, 30);
      s.append(row, fx);
      const max = Math.max(1, tt.r, tt.g);
      ['red', 'gold'].forEach((team) => {
        const v = team === 'red' ? tt.r : tt.g;
        const J = jar(team, team === t, team === t ? 'Tu equipo' : 'Equipo ' + teamName(team), mo.tiers && mo.tiers[team]);
        row.appendChild(J.col);
        const k = v / max;
        // the last tigers burst over their jars, then the candies rise
        later(350, () => { J.tiger.burst(fx); cfx.spill(J.tiger.center(), reduced() ? 0 : 12, { spread: 120, fall: 260, size: 22 }); }, cerTimers);
        if (reduced()) { J.fill.style.transform = `scaleY(${k})`; J.n.textContent = P().fmt(v); }
        else {
          later(500, () => {
            J.fill.animate([{ transform: 'scaleY(0)' }, { transform: `scaleY(${k})` }], { duration: 600 + 2200 * k, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' });
            S().countUp(J.n, 0, v, 600 + 2200 * k);
          }, cerTimers);
        }
      });
      play('burst', 1, 0.6);
      sfx(MO + 'drum.mp3', 0.75);
      return;
    }
    if (name === 'result') {
      const tie = mo.winner === 'tie';
      const s = stageBox('result ' + (tie ? 'tie' : mo.winner === 'red' ? 'red' : 'gold'));
      const won = mo.winner === t;
      s.appendChild(el('h2', 'ptf-h big', tie ? '¡Empate!' : `¡Gana el Equipo ${teamName(mo.winner)}!`));
      const wc = mo.captains && !tie ? mo.captains[mo.winner] : null;
      if (wc && CAST()) s.appendChild(el('p', 'ptf-capline', `${CAST().captain(wc)}: «${CAST().line(wc, 'fiesta')}»`));
      const row = el('div', 'ptf-teams');
      ['red', 'gold'].forEach((team) => {
        const winT = tie || mo.winner === team;
        const side = el('div', 'ptf-side ' + (team === 'red' ? 'red' : 'gold') + (winT ? ' win' : ' lose') + (team === t ? ' mine' : ''));
        const mas = el('img', 'ptf-mascot');
        mas.alt = '';
        mas.src = '/assets/kingdoms/dralingo/' + (tie ? 'jump' : winT ? 'champion' : 'shocked') + (team === 'red' ? '-red' : '') + '.webp';
        side.appendChild(mas);
        const crew = el('div', 'ptf-crew');
        if (!winT) crew.appendChild(P().cloud());
        const kids = (mo.teams && mo.teams[team]) || [];
        let list = kids.slice(0, 2);
        if (team === t && meD.k != null && !list.some((r) => r.k === meD.k)) {
          const mineRow = kids.find((r) => r.k === meD.k) || { k: meD.k, name: myName(), skin: mySkin(), team: t };
          list = [mineRow].concat(list.slice(0, 1));
        }
        list.forEach((r, i) => {
          const f = S().kidFigure({ team, skin: r.skin, name: r.name, me: r.k === meD.k, pose: winT ? 'ok' : 'no', tag: r.k === meD.k });
          f.classList.add(winT ? 'cheer' : 'sob');
          f.style.setProperty('--i', i);
          crew.appendChild(f);
        });
        side.appendChild(crew);
        side.appendChild(el('b', 'ptf-total', P().fmt(team === 'red' ? tt.r : tt.g) + ' caramelos'));
        // confetti only over the winners (the other side gets the rain cloud)
        if (winT) { const conf = el('div', 'ptf-conf'); side.appendChild(conf); S().confetti(conf, tie ? null : team, tie ? 14 : 22); }
        row.appendChild(side);
      });
      s.appendChild(row);
      sfx(K + 'sting-win.mp3', won || tie ? 0.9 : 0.55);
      if (!won && !tie) later(700, () => sfx(H + 'aww.mp3', 0.55), cerTimers);
      buzz(won || tie ? [60, 40, 60, 40, 200] : [80]);
      return;
    }
    if (name.indexOf('star') === 0) {
      const st = (mo.stars || [])[Number(name.slice(4))];
      if (!st) return;
      const mineStar = (meD.stars || []).includes(st.id);
      const s = stageBox('star' + (mineStar ? ' mine' : ''));
      const badge = el('div', 'ptf-badge');
      badge.appendChild(S().starSvg());
      s.appendChild(badge);
      s.appendChild(el('h2', 'ptf-h', st.name));
      const who = el('div', 'ptf-who');
      (st.who || []).forEach((r, i) => {
        const f = S().kidFigure({ team: r.team, skin: r.skin, name: r.name, me: r.k === meD.k, pose: 'ok' });
        f.style.setProperty('--i', i);
        who.appendChild(f);
      });
      s.appendChild(who);
      s.appendChild(el('div', 'ptf-val', (st.n > 4 ? `y ${st.n - 4} más · ` : '') + starValue(st)));
      if (mineStar) { s.appendChild(el('div', 'ptf-mine', '¡ES PARA TI!')); buzz([40, 30, 40, 30, 120]); }
      sfx(MO + 'star.mp3', mineStar ? 0.9 : 0.6);
      return;
    }
    if (name === 'card') {
      clearTimers(cerTimers);
      const s = stageBox('card ' + (t === 'red' ? 'red' : 'gold'));
      const skip = cer.fin.querySelector('.pt-skip');
      if (skip) skip.remove();
      const won = mo.winner === t, tie = mo.winner === 'tie';
      const top = el('div', 'ptk-top');
      const kid = S().kidFigure({ team: t, skin: mySkin(), name: myName(), me: true, pose: won || tie ? 'ok' : 'no' });
      kid.appendChild(P().stick(t));
      const tg = el('img', 'ptk-tiger');
      tg.alt = '';
      tg.src = P().tigerArt(t, Math.max(0, ((mo.tiers && mo.tiers[t]) || 0)));
      top.append(kid, tg);
      s.appendChild(top);
      s.appendChild(el('h2', 'ptk-h', tie ? '¡Empate! ¡Qué fiesta!' : won ? '¡Ganó tu equipo!' : `¡Buen intento, Equipo ${teamName(t)}!`));
      const big = el('p', 'ptk-big');
      if (meD.candy > 0) {
        big.append('Sacaste ', el('b', null, P().fmt(meD.candy)), meD.candy === 1 ? ' caramelo' : ' caramelos');
        s.appendChild(big);
        s.appendChild(el('p', 'ptk-line', `El ${meD.share || 0} % de los caramelos de tu equipo`));
      } else {
        big.textContent = '¡La próxima es tuya!';
        s.appendChild(big);
        s.appendChild(el('p', 'ptk-line', 'Responde bien y toca en el dorado para sacar caramelos'));
      }
      const score = el('p', 'ptk-score');
      score.append(el('b', 'r', `Fuego ${P().fmt(tt.r)}`), el('b', 'g', `Mar ${P().fmt(tt.g)}`));
      s.appendChild(score);
      const facts = el('div', 'ptk-facts');
      const fact = (n, l) => { const x = el('div', 'ptk-fact'); x.append(el('b', null, n), el('span', null, l)); facts.appendChild(x); };
      fact(String(meD.hits || 0), meD.hits === 1 ? 'golpe' : 'golpes');
      fact(String(meD.crits || 0), meD.crits === 1 ? 'crítico' : 'críticos');
      fact(String(meD.best || 0), 'racha');
      if (meD.bursts) fact(String(meD.bursts), meD.bursts === 1 ? 'piñata rota' : 'piñatas rotas');
      s.appendChild(facts);
      const mineStars = (mo.stars || []).filter((x) => (meD.stars || []).includes(x.id));
      if (mineStars.length || (meD.mvp && meD.candy > 0)) {
        const row = el('div', 'ptk-stars');
        if (meD.mvp && meD.candy > 0) { const b = el('div', 'ptk-star mvp'); b.append(S().starSvg(), el('span', null, 'El mejor de tu equipo')); row.appendChild(b); }
        mineStars.forEach((x) => { const b = el('div', 'ptk-star'); b.append(S().starSvg(), el('span', null, x.name)); row.appendChild(b); });
        s.appendChild(row);
      }
      // the card never sends a kid out of the class: «Otra ronda» brings every phone back to the lobby
      s.appendChild(el('p', 'ptk-wait', 'Quédate aquí: tu profe puede empezar otra ronda'));
      const home = el('button', 'ptk-home', 'Salir del juego');
      home.type = 'button';
      home.addEventListener('click', () => { location.href = '/'; });
      s.appendChild(home);
    }
  }
  function starValue(st) {
    if (st.id === 'fast') return `${String(st.value).replace('.', ',')} s`;
    if (st.id === 'streak') return `${st.value} seguidas`;
    if (st.id === 'hits') return `${P().fmt(st.value)} golpes`;
    if (st.id === 'crits') return `${P().fmt(st.value)} ${st.value === 1 ? 'crítico' : 'críticos'}`;
    return `${P().fmt(st.value)} caramelos`;
  }

  window.PinataPhone = {
    init, lobby, result, end,
    frame: () => ({
      on, phase: g && g.phase, meter: Object.assign({}, meter), me: Object.assign({}, me), swinging: !!sw, tapped: !!(sw && sw.tapped),
      hid: sw && sw.hid, c: sw ? Math.round(swingC()) : null, local: sw && sw.local, frenzy: !!(g && g.frenzy), paused: !!(g && g.paused),
      stage: cer && cer.stage, last: swingResult,
    }),
    tap: () => { onTap(); return sw ? sw.local : null; },
    needleAt: (pos) => { heldPos = pos == null ? null : pos; if (sw && meterEl && pos != null) meterEl.at(pos); },
    hold: (v) => {
      testHold = !!v;
      const b = $('pt-banner');
      if (!testHold && b && b.classList.contains('show')) { b.classList.remove('show'); setTimeout(nextBanner, 260); }
    },
    freeze: (v) => { frozen = !!v; if (!frozen) { const q = queue; queue = []; q.forEach(([fn, d]) => fn(d)); } return queue.length; },
    replay: (ev) => { while (queue.length) { const [fn, d, e] = queue.shift(); fn(d); if (e === ev) break; } return queue.length; },
    queued: () => queue.map((x) => x[2]),
    stage: (name) => { if (cer) { clearTimers(cerTimers); stage(name); } },
    runIn: () => showRunIn(),
    rules: (ms) => showRules(ms),
    sim: (ev, d) => { if (handlers[ev]) handlers[ev](d); },
    openSwing: (info) => openSwing(Object.assign({ _t0: performance.now() - (info && info.lead || 0) }, info)),
    burst: (b) => burstMoment(Object.assign({ bid: Math.random() }, b), true),
  };
})();
