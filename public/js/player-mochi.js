// Mochi Mash v2 — the kid's phone (the product). player.js calls MochiPhone.init(...) once; the shared phone skin
// (player-kingdoms-skin.js) gives the Kahoot question screen and routes the lobby card, the result screen and the end
// screen here. What this module adds, only while the room's game is 'mochi-mash':
//   · countdown: the VS run-in on the terrace (my team's side, my full-body character runs in under my Dragoncito)
//   · intro: the rules card with ONE pictured control («¡Toca rápido!») → «¿Listos?» → «¡YA!»
//   · question screen: a strip that always says what to do and my mochis
//   · THE MASH ZONE: the whole phone is the button; every tap throws a mochi from my character into my Dragoncito's
//     mouth (press, pop with pitch variety, vibration, combo counter, golden mochi); taps go to the server as a COUNT
//     every 250 ms; the window's summary at the end
//   · lead-change / landmark / last-30-s banners at the top edge (never over the answer tiles), the pause card,
//     «¡FINAL!» and the ceremony: the weigh-in, «¡Gana el Equipo …!», the bonus stars one by one, my own card
// Test hooks: MochiPhone.frame(), .tap(n), .hold(v), .freeze(v) / .replay(ev), .stage(name).
(function () {
  'use strict';
  const S = () => window.MochiStage;
  const A = '/assets/mochi/', K = '/assets/kingdoms/', H = '/assets/halcon/';
  const BATCH_MS = 250;
  const $ = (id) => document.getElementById(id);
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const skin = () => window.KingdomsSkin;
  const sfx = (path, vol) => { const s = skin(); if (s && s.sfx) s.sfx(path, vol); };
  const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (_) {} };
  const later = (ms, fn, list) => { const t = setTimeout(fn, Math.max(0, ms)); (list || timers).push(t); return t; };

  let ctx = null, on = false;
  let timers = [], introTimers = [], cerTimers = [];
  let g = null;                  // { id, phase, E, landmarks, frenzy, endsAt (perf time), paused }
  let totals = { r: 0, g: 0 };
  let me = { k: null, mochis: 0 };
  let roster = [];               // from the room's state: [{ name, team, avatar, off }]
  let testHold = false;
  let captains = null;           // { red, gold }: one of the gang per team (server picks them at «Empezar»)
  const CAST = () => window.DralingoCast;
  // my captain's line in their own voice (js/cast.js; Aileen in voseo)
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

  // ---------- quick sounds (Web Audio for the pops: 10 a second need no lag) ----------
  let actx = null, popBuf = null, popLoading = false;
  function audioReady() {
    if (actx) { if (actx.state === 'suspended') actx.resume().catch(() => {}); return; }
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      actx = new C();
      if (!popLoading) {
        popLoading = true;
        fetch(A + 'pop.mp3').then((r) => r.arrayBuffer()).then((b) => actx.decodeAudioData(b)).then((buf) => { popBuf = buf; }).catch(() => {});
      }
    } catch (_) {}
  }
  const muted = () => { const s = skin(); return !!(s && s.isMuted && s.isMuted()); };
  function pop(rate) {
    if (muted() || !actx || !popBuf) return;
    try {
      const src = actx.createBufferSource();
      src.buffer = popBuf;
      src.playbackRate.value = rate || 1;
      const gn = actx.createGain();
      gn.gain.value = 0.55;
      src.connect(gn).connect(actx.destination);
      src.start();
    } catch (_) {}
  }

  // ---------- on / off ----------
  function setOn(v) {
    if (v === on) return;
    on = v;
    document.body.classList.toggle('mm-on', on);
    if (!on) teardown(true);
  }
  function clearTimers(list) { (list || timers).forEach(clearTimeout); if (list) list.length = 0; else timers = []; }
  function teardown(all) {
    document.body.classList.remove('mm-zone');
    clearTimers();
    clearTimers(introTimers);
    stopMash(true);
    hideIntro();
    pauseUI(false);
    clearInterval(chipT);
    if ($('mm-chip')) $('mm-chip').classList.add('hidden');
    if ($('mm-prompt')) $('mm-prompt').classList.remove('x2');
    const fin = $('mm-final');
    if (fin) fin.classList.add('hidden');
    document.body.classList.remove('mm-frenzy', 'mm-ended');
    if (all) { clearTimers(cerTimers); const f = $('mm-finale'); if (f) f.remove(); }
  }

  // ---------- the strip on the question screen: what to do + my mochis ----------
  function ensurePrompt() {
    const q = $('screen-question');
    if (!q || $('mm-prompt')) return;
    const box = document.createElement('div');
    box.className = 'mm-prompt';
    box.id = 'mm-prompt';
    box.setAttribute('role', 'status');
    box.innerHTML = '<img id="mm-prompt-img" alt="" src="' + S().dragonArt(myTeam(), 'hungry') + '"><span class="mm-prompt-t"><b>Responde bien</b><span>y ganas 5 segundos para darle mochis a tu dragoncito</span><em class="mm-prompt-x" id="mm-prompt-x"></em></span>'
      + '<span class="mm-prompt-n"><i class="mm-mochi f0" aria-hidden="true"></i><b id="mm-prompt-n">0</b></span>';
    const timer = $('kdp-timer');
    if (timer) timer.after(box); else q.prepend(box);
    paintPrompt();
  }
  function paintPrompt() {
    if (!$('mm-prompt')) return;
    $('mm-prompt-img').src = S().dragonArt(myTeam(), 'hungry');
    $('mm-prompt-n').textContent = S().fmt(me.mochis);
    $('mm-prompt').classList.toggle('red', myTeam() === 'red');
  }

  // ---------- the countdown: VS run-in on the terrace ----------
  function showRunIn() {
    const box = $('mm-intro');
    if (!box) return;
    clearTimers(introTimers);
    box.className = 'mm-intro runin';
    box.innerHTML = '';
    const t = myTeam(), o = t === 'red' ? 'gold' : 'red';
    const side = (team, isMe) => {
      const s = document.createElement('div');
      s.className = 'mmi-side ' + (team === 'red' ? 'red' : 'gold') + (isMe ? ' mine' : '');
      const d = document.createElement('div');
      d.className = 'mmi-dragon';
      const img = document.createElement('img');
      img.alt = '';
      img.src = S().dragonArt(team, isMe ? 'happy' : 'hungry');
      d.appendChild(img);
      const name = document.createElement('div');
      name.className = 'mmi-team';
      name.textContent = 'Equipo ' + teamName(team);
      s.appendChild(name);
      const cid = captains && captains[team];
      if (cid && CAST()) {
        const cap = document.createElement('div');
        cap.className = 'mmi-capt';
        const ci = document.createElement('img');
        ci.alt = '';
        ci.src = CAST().pose(cid, 'hello');
        const ct = document.createElement('span');
        ct.append((isMe ? 'Tu ' : '') + (CAST().fem(cid) ? 'capitana' : 'capitán'), Object.assign(document.createElement('b'), { textContent: CAST().name(cid) }));
        cap.append(ci, ct);
        s.appendChild(cap);
      }
      s.appendChild(d);
      // my side: me in front, up to 3 teammates behind; the rival side: up to 3 of them
      const crew = document.createElement('div');
      crew.className = 'mmi-crew';
      const mates = roster.filter((p) => p.team === team && !p.off && (!isMe || p.name.toLowerCase() !== myName().toLowerCase())).slice(0, 3);
      mates.forEach((p, i) => {
        const f = S().kidFigure({ team, skin: S().skinFor(p.avatar, p.name), name: p.name, tag: false });
        f.style.setProperty('--i', i + (isMe ? 1 : 0));
        f.classList.add('mmi-run', team === 'red' ? 'from-l' : 'from-r');
        crew.appendChild(f);
      });
      if (isMe) {
        const f = S().kidFigure({ team, skin: mySkin(), name: myName(), me: true });
        f.style.setProperty('--i', 0);
        f.classList.add('mmi-run', 'mmi-me', team === 'red' ? 'from-l' : 'from-r');
        crew.prepend(f);
      }
      s.appendChild(crew);
      return s;
    };
    const left = side('red', t === 'red'), right = side('gold', t === 'gold');
    const vs = document.createElement('div');
    vs.className = 'mmi-vs';
    vs.textContent = 'VS';
    const cap = document.createElement('div');
    cap.className = 'mmi-cap ' + (t === 'red' ? 'red' : 'gold');
    cap.innerHTML = '';
    cap.append('¡Eres del ', Object.assign(document.createElement('b'), { textContent: 'Equipo ' + teamName(t) }), '!');
    box.append(left, right, vs, cap);
    sfx(K + 'whoosh.mp3', 0.6);
    later(900, () => sfx(H + 'round.mp3', 0.45), introTimers);
    void o;
  }
  // the intro: the rules card (ONE pictured control) → «¿Listos?» → «¡YA!»
  function showRules(ms) {
    const box = $('mm-intro');
    if (!box) return;
    clearTimers(introTimers);
    box.className = 'mm-intro rules ' + (myTeam() === 'red' ? 'red' : 'gold');
    box.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'mmi-card';
    const pic = document.createElement('div');
    pic.className = 'mmi-pic';
    const dragon = document.createElement('img');
    dragon.className = 'mmi-pic-dragon';
    dragon.alt = '';
    dragon.src = S().dragonArt(myTeam(), 'eat');
    const btn = document.createElement('i');
    btn.className = 'mmi-pic-btn';
    const hand = document.createElement('i');
    hand.className = 'mmi-pic-hand';
    const fly = document.createElement('i');
    fly.className = 'mm-mochi f1 mmi-pic-mochi';
    pic.append(dragon, fly, btn, hand);
    const h = document.createElement('h2');
    h.className = 'mmi-title';
    h.textContent = '¡Toca rápido!';
    const p = document.createElement('p');
    p.className = 'mmi-sub';
    p.textContent = 'Cada toque lanza un mochi a tu dragoncito';
    card.append(pic, h, p);
    const say = document.createElement('div');
    say.className = 'mmi-say';
    box.append(card, say);
    const total = Math.max(1400, ms || 2800);
    later(total - 1250, () => { box.classList.add('ready'); say.textContent = '¿Listos?'; sfx(K + 'tick.mp3', 0.7); }, introTimers);
    later(total - 600, () => { box.classList.add('go'); say.textContent = '¡YA!'; sfx(H + 'start.mp3', 0.8); buzz(30); }, introTimers);
    later(total + 400, () => { if (!testHold) hideIntro(); }, introTimers);
  }
  function hideIntro() {
    const box = $('mm-intro');
    if (box && !testHold) { clearTimers(introTimers); box.className = 'mm-intro hidden'; box.innerHTML = ''; }   // no stray «¿Listos?» later
  }

  // ---------- the mash zone ----------
  let mash = null;               // { mid, ms, left, endAt, n, sent, gold, golden, frenzy, startedAt, team }
  let flyer = null, dragon = null, kidFig = null, sendT = null, rafT = null;
  function buildZone() {
    const z = $('mmz');
    if (!z || dragon) return;
    dragon = new (S().Dragon)($('mmz-dragon'), { team: myTeam(), size: 0 });
    flyer = new (S().Flyer)($('mmz-fly'), 14);
    const tap = (e) => {
      if (e.pointerType && e.pointerType !== 'mouse' && e.cancelable) e.preventDefault();
      onTap(e);
    };
    z.addEventListener('pointerdown', tap);
    z.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) onTap(e); } });   // holding a key is not mashing
    z.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  function paintZoneTeam() {
    if (!dragon) return;
    const t = myTeam();
    if (dragon.team !== t) {
      $('mmz-dragon').innerHTML = '';
      dragon = new (S().Dragon)($('mmz-dragon'), { team: t, size: 0 });
    }
    $('mmz').classList.toggle('red', t === 'red');
    $('mmz').classList.toggle('gold', t !== 'red');
    const kid = $('mmz-kid');
    if (!kidFig || kidFig._skin !== mySkin() || kidFig._team !== t) {
      kid.innerHTML = '';
      kidFig = S().kidFigure({ team: t, skin: mySkin(), name: myName(), me: true });
      kidFig._team = t;
      kid.appendChild(kidFig);
    }
  }
  function openMash(info) {
    if (!on || !info || !info.mid || !g || g.phase !== 'play') return;     // never after «¡FINAL!»
    buildZone();
    paintZoneTeam();
    stopMash(true);
    ctx.showScreen('mochi');
    document.body.classList.add('mm-zone');           // the sound button moves to the top corner (the foot is the timer)
    const ms = info.ms || 5000;
    mash = { mid: info.mid, ms, left: ms, endAt: performance.now() + ms, n: 0, sent: 0, gold: info.gold || 0, golden: false, frenzy: !!(g && g.frenzy) || !!info.frenzy, team: myTeam(), combo: 0 };
    const z = $('mmz');
    z.classList.remove('done', 'hurry');
    z.classList.toggle('frenzy', mash.frenzy);
    z.focus({ preventScroll: true });
    $('mmz-n').textContent = '0';
    $('mmz-note').textContent = info.streakBonus ? `¡Racha de ${info.streak}! +1 segundo` : (info.behind ? '¡Mochis dorados para los que remontan!' : (mash.frenzy ? '¡Doble mochi!' : ''));
    $('mmz-note').className = 'mmz-note' + ($('mmz-note').textContent ? ' show' : '');
    $('mmz-hint').textContent = '¡Toca rápido!';
    paintMeter();
    growZone();
    dragon.rest(restPose());
    const fill = $('mmz-bar');
    fill.style.transition = 'none';
    fill.style.transform = 'scaleX(1)';
    void fill.offsetWidth;
    if (g.paused) { mash.pausedLeft = ms; zonePaused = true; }          // opened during a pause: it starts on «Seguir»
    else { zonePaused = false; fill.style.transition = `transform ${ms}ms linear`; fill.style.transform = 'scaleX(0)'; }
    if (!helped && !reduced()) { helped = true; $('mmz').classList.add('teach'); later(2200, () => $('mmz').classList.remove('teach')); }
    sendT = setInterval(flush, BATCH_MS);
    loop();
    ctx.markActivity();
  }
  let helped = false;
  function loop() {
    if (!mash) return;
    if (!(g && g.paused)) {
      const left = mash.endAt - performance.now();
      mash.left = left;
      if (left <= 1500 && !$('mmz').classList.contains('hurry')) { $('mmz').classList.add('hurry'); sfx(K + 'tick.mp3', 0.5); }
      if (left <= 0) { endMash(); return; }
    }
    rafT = requestAnimationFrame(loop);
  }
  function onTap(e) {
    audioReady();
    if (!mash || (g && g.paused)) return;
    if (performance.now() > mash.endAt) { endMash(); return; }
    mash.n++;
    mash.combo++;
    ctx.markActivity();
    const z = $('mmz');
    // press feel: the whole zone sinks for a moment (transition-free WAAPI, interruptible)
    if (!reduced() && z.animate) z.animate([{ transform: 'scale(.975)' }, { transform: 'scale(1)' }], { duration: 110, easing: 'cubic-bezier(.22,1,.36,1)' });
    const golden = !!(mash.gold && mash.n === mash.gold && !mash.golden);
    if (golden) mash.golden = true;
    pop(0.92 + Math.random() * 0.24 + Math.min(0.25, mash.combo / 160));
    buzz(golden ? [20, 30, 50] : 8);
    // the mochi flies from my hands into the mouth
    // my character tosses it from the plate of mochis at their feet
    const tray = z.querySelector('.mmz-tray');
    const k = tray ? tray.getBoundingClientRect() : z.getBoundingClientRect();
    const from = { x: k.left + k.width * (0.2 + Math.random() * 0.6), y: k.top + k.height * 0.2 };
    const to = dragon.mouth();
    const mult = mash.frenzy ? 2 : 1;
    flyer.fly(from, to, {
      gold: golden, size: golden ? 46 : 34, drift: (Math.random() - 0.5) * 50, ms: golden ? 520 : 360,
      onLand: () => {
        if (!dragon) return;
        dragon.chomp(golden);
        if (golden) { sfx(A + 'gold.mp3', 0.8); plus(`¡Mochi dorado! +${5 * mult}`, true); }
      },
    });
    const shown = mash.n * mult + (mash.golden ? 4 * mult : 0);
    const nEl = $('mmz-n');
    nEl.textContent = S().fmt(shown);
    if (!reduced() && nEl.animate) nEl.animate([{ transform: 'scale(1.16)' }, { transform: 'scale(1)' }], { duration: 140, easing: 'cubic-bezier(.22,1,.36,1)' });
    if (mash.combo % 10 === 0) { sfx(A + 'combo.mp3', 0.55); plus(`¡Combo ×${mash.combo}!`, false); }
    if (kidFig && !reduced() && kidFig.animate) kidFig._img.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-6%) rotate(-3deg)' }, { transform: 'translateY(0)' }], { duration: 160, easing: 'ease-out' });
    if (e && e.type === 'keydown') return;
  }
  function plus(text, gold) {
    const el = $('mmz-plus');
    el.textContent = text;
    el.className = 'mmz-plus show' + (gold ? ' gold' : '');
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.className = 'mmz-plus'; }, 900);
  }
  function flush(final) {
    if (!mash) return;
    const n = mash.n - mash.sent;
    if (n <= 0 && !final) return;
    mash.sent = mash.n;
    if (n > 0) ctx.socket.emit('player:mm-taps', { pin: ctx.getPin(), mid: mash.mid, n, fin: !!final });
  }
  function endMash() {
    if (!mash) return;
    flush(true);
    const m = mash;
    clearInterval(sendT); sendT = null;
    cancelAnimationFrame(rafT);
    const z = $('mmz');
    z.classList.add('done');
    z.classList.remove('hurry');
    const mult = m.frenzy ? 2 : 1;
    const got = m.n * mult + (m.golden ? 4 * mult : 0);
    if (m.mid !== lastMashedMid) me.mochis += got;      // (the server's summary may already have set the real total)
    $('mmz-hint').textContent = got ? `¡+${S().fmt(got)} mochis!` : '¡Se acabó el tiempo!';
    if (got) sfx(H + 'yes.mp3', 0.5);
    dragon.rest(restPose());
    paintPrompt();
    m.closedAt = Date.now();
    lastMash = m;
    mash = null;
  }
  let lastMash = null, lastMashedMid = null;
  function stopMash(silent) {
    if (!mash) return;
    if (!silent) endMash();
    else { flush(true); clearInterval(sendT); sendT = null; cancelAnimationFrame(rafT); mash = null; }
  }
  function restPose() {
    const t = myTeam();
    const mineT = t === 'red' ? totals.r : totals.g, theirs = t === 'red' ? totals.g : totals.r;
    return mineT > theirs ? 'happy' : mineT < theirs ? 'worried' : 'hungry';
  }
  function growZone() {
    if (!dragon || !g) return;
    const t = myTeam();
    dragon.grow(S().growth(t === 'red' ? totals.r : totals.g, g.E));
  }
  // the tug bar at the top of the zone
  function paintMeter() {
    const bar = $('mmz-meter');
    if (!bar) return;
    const sum = Math.max(1, totals.r + totals.g);
    const k = totals.r + totals.g ? totals.r / sum : 0.5;
    $('mmz-meter-r').style.transform = `scaleX(${k.toFixed(3)})`;
    $('mmz-meter-rn').textContent = S().fmt(totals.r);
    $('mmz-meter-gn').textContent = S().fmt(totals.g);
    bar.classList.toggle('me-red', myTeam() === 'red');
    const t = myTeam();
    const a = t === 'red' ? totals.r : totals.g, b = t === 'red' ? totals.g : totals.r;
    const st = $('mmz-status');
    st.textContent = a > b ? `¡Ganamos por ${S().fmt(a - b)}!` : a < b ? `¡Faltan ${S().fmt(b - a)}!` : '¡Empate!';
    st.className = 'mmz-status ' + (a > b ? 'ahead' : a < b ? 'behind' : '');
  }

  // ---------- banners at the top edge ----------
  let bannerQ = [], bannerOn = false;
  function banner(kind, html, team, ms) {
    bannerQ.push({ kind, html, team, ms: ms || 2300 });
    if (!bannerOn) nextBanner();
  }
  function nextBanner() {
    const b = $('mm-banner');
    const it = bannerQ.shift();
    if (!b || !it) { bannerOn = false; return; }
    bannerOn = true;
    b.className = 'mm-banner ' + it.kind + (it.team ? ' ' + (it.team === 'red' ? 'red' : 'gold') : '');
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
  // The pause holds an open mash window where it is. Only a CHANGE of the pause moves the window: a resync while paused
  // (the 12 s watchdog sends one) re-applies the same state and must not eat the time left.
  let zonePaused = false;
  function pauseUI(v) {
    v = !!v;
    const box = $('mm-pause');
    if (box) box.classList.toggle('hidden', !v);
    if (v === zonePaused) return;
    zonePaused = v;
    if (!mash) return;
    const fill = $('mmz-bar');
    if (v) {
      mash.pausedLeft = Math.max(0, mash.endAt - performance.now());
      fill.style.transition = 'none';
      fill.style.transform = `scaleX(${(mash.pausedLeft / mash.ms).toFixed(3)})`;
    } else {
      const left = mash.pausedLeft != null ? mash.pausedLeft : Math.max(0, mash.endAt - performance.now());
      mash.endAt = performance.now() + left;
      mash.pausedLeft = null;
      void fill.offsetWidth;
      fill.style.transition = `transform ${left}ms linear`;
      fill.style.transform = 'scaleX(0)';
    }
  }
  let chipT = null;
  function frenzyChip() {
    clearInterval(chipT);
    const chip = $('mm-chip');
    if (!chip || !g || !g.frenzy) { if (chip) chip.classList.add('hidden'); return; }
    chip.classList.remove('hidden');
    const paint = () => {
      if (!g || !g.endAt) return;
      const left = g.paused ? g.pausedLeft : Math.max(0, g.endAt - performance.now());
      const s = Math.max(0, Math.ceil(left / 1000));
      const t = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      chip.querySelector('b').textContent = t;
      chip.classList.toggle('last', s <= 10);
      // the question screen says it inside the strip (the chip would cover my counter there)
      if ($('mm-prompt')) { $('mm-prompt').classList.add('x2'); $('mm-prompt-x').textContent = `¡Doble mochi! Quedan ${t}`; }
    };
    paint();
    chipT = setInterval(paint, 250);
  }

  // ---------- events ----------
  let frozen = false, queue = [];
  const handlers = {};            // test hook sim(ev, d): play one of this module's handlers with a made-up event
  function init(c) {
    ctx = c;
    const sock = c.socket;
    // the question's 20 s clock stands still while the teacher pauses (a question that lands during a pause starts held)
    if (skin() && skin().holdWhen) skin().holdWhen(() => on && !!(g && g.paused));
    const s = { on: (ev, fn) => { handlers[ev] = fn; sock.on(ev, (d) => { if (frozen && ev.indexOf('mm:') === 0) { queue.push([fn, d, ev]); return; } fn(d); }); } };
    s.on('state', (st) => {
      if (!st) return;
      if (st.gameType) setOn(st.gameType === 'mochi-mash');
      if (!on) return;
      roster = Object.values(st.players || {}).map((p) => ({ name: p.name, team: p.team, avatar: p.avatar, off: !!p.off }));
      const meP = st.players && sock.id && st.players[sock.id];
      if (meP && meP.sk) mySk = meP.sk;
      if (st.state === 'lobby') { teardown(true); g = null; totals = { r: 0, g: 0 }; me = { k: null, mochis: 0 }; }
    });
    s.on('team-changed', () => { if (on) { paintPrompt(); paintZoneTeam(); } });
    s.on('countdown', () => {
      if (!on) return;
      teardown(true);
      totals = { r: 0, g: 0 };
      me = { k: null, mochis: 0 };
      g = null;
      S().preloadDragons();
      showRunIn();
    });
    s.on('mm:init', (d) => applyInit(d));
    s.on('mm:captains', (c) => { captains = c; });
    s.on('mm:play', (d) => {
      if (!on || !g) return;
      g.phase = 'play';
      g.endAt = performance.now() + (d.endsMs || 0);
      ctx.markActivity();
    });
    s.on('question', () => {
      document.body.classList.remove('mm-zone');
      if (!on) return;
      if (mash) stopMash(true);                           // (a reconnect mid-window: the server already closed it)
      hideIntro();
      setTimeout(() => { ensurePrompt(); paintPrompt(); }, 0);
    });
    s.on('answer-result', (r) => {
      if (!on || !r || !r.mochi) return;
      stopMash(true);
      if (r.correct && r.mochi.mid) {
        const info = r.mochi;
        later(info.lead || 900, () => openMash(info));
      }
    });
    s.on('mm:mashed', (d) => {
      if (!on || !d) return;
      lastMashedMid = d.mid;
      if (mash && mash.mid === d.mid) endMash();          // the server closed this window first: stop tapping into it
      me.mochis = d.total;
      paintPrompt();
      if (lastMash && lastMash.mid === d.mid && $('mmz').classList.contains('done')) $('mmz-hint').textContent = d.mochis ? `¡+${S().fmt(d.mochis)} mochis!` : '¡Se acabó el tiempo!';
    });
    s.on('mm:meter', (d) => {
      if (!on || !d) return;
      totals = { r: d.r, g: d.g };
      if (skin() && skin().setScores) skin().setScores({ red: d.r, gold: d.g });
      paintMeter();
      growZone();
      if (dragon && !mash) dragon.rest(restPose());
    });
    s.on('mm:lead', (d) => {
      if (!on || !d) return;
      if (d.totals) totals = { r: d.totals.r, g: d.totals.g };
      const ours = mine(d.team);
      banner('lead', [Object.assign(document.createElement('b'), { textContent: d.first ? `¡El Equipo ${teamName(d.team)} toma la delantera!` : `¡El Equipo ${teamName(d.team)} pasa adelante!` }),
        Object.assign(document.createElement('span'), { textContent: capLine(ours ? 'win' : 'feast') || (ours ? '¡Sigan así!' : '¡A remontar! Responde y toca rápido') })], d.team, 2400);
      sfx(K + (ours ? 'flag.mp3' : 'castle-alert.mp3'), 0.6);
      buzz(ours ? [30, 40, 30] : [60, 40, 60]);
      if (dragon && !mash) dragon.rest(restPose());
    });
    s.on('mm:landmark', (d) => {
      if (!on || !d) return;
      if (d.totals) totals = { r: d.totals.r, g: d.totals.g };
      const lm = (g && g.landmarks || []).find((l) => l.id === d.id);
      if (lm) lm.team = d.team;
      const img = document.createElement('img');
      img.alt = '';
      img.src = K + 'landmarks/' + d.id + '.webp';
      banner('landmark', [img, Object.assign(document.createElement('b'), { textContent: `${d.name}: ¡del Equipo ${teamName(d.team)}!` }),
        Object.assign(document.createElement('span'), { textContent: mine(d.team) ? `¡Llegaron primero! +${d.bonus} mochis` : `Llegaron primero. +${d.bonus} para ellos` })], d.team, 2600);
      sfx(K + 'landmark.mp3', 0.6);
    });
    s.on('mm:frenzy', (d) => {
      if (!on || !g) return;
      g.frenzy = true;
      g.endAt = performance.now() + (d.endsMs || 30000);
      document.body.classList.add('mm-frenzy');
      if (mash) { mash.frenzy = true; $('mmz').classList.add('frenzy'); }
      banner('frenzy', [Object.assign(document.createElement('b'), { textContent: '¡Últimos 30 segundos!' }), Object.assign(document.createElement('span'), { textContent: '¡DOBLE MOCHI! Cada mochi vale 2' })], null, 2600);
      sfx(K + 'siege.mp3', 0.6);
      buzz([50, 40, 50, 40, 80]);
      if (skin() && skin().music) skin().music('music-final', 0.4);
      frenzyChip();
    });
    s.on('mm:time', (d) => {
      if (!on || !g) return;
      g.endAt = performance.now() + (d.endsMs || 0);
      banner('time', d.add < 0 ? `${-d.add} segundos menos` : `+${d.add || 30} segundos más`, null, 1600);
      frenzyChip();
    });
    s.on('mm:pause', (d) => {
      if (!on || !g) return;
      g.paused = !!d.paused;
      if (g.paused) g.pausedLeft = Math.max(0, g.endAt - performance.now());
      else if (d.endsMs != null) g.endAt = performance.now() + d.endsMs;
      pauseUI(g.paused);
      if (skin() && skin().hold) skin().hold(g.paused);
      if (g.paused) clearInterval(chipT); else frenzyChip();
      // a pause in the intro holds the rules card; «Seguir» plays its «¿Listos?… ¡YA!» with the time the server has left
      if (g.phase === 'intro') { if (g.paused) clearTimers(introTimers); else showRules(d.phaseMs); }
      ctx.markActivity();
    });
    s.on('mm:scale', (d) => {
      if (!on || !g || !d || d.id !== g.id) return;
      g.E = d.E;
      g.landmarks = d.landmarks || g.landmarks;
      growZone();
    });
    s.on('mm:final', (d) => {
      if (!on) return;
      ctx.markActivity();
      clearTimers();                                       // a window that was about to open never opens after «¡FINAL!»
      hideIntro();                                         // (a pause in the intro + «Terminar»: the rules card never stays on top)
      stopMash(false);
      document.body.classList.remove('mm-zone');
      clearInterval(chipT);
      if ($('mm-chip')) $('mm-chip').classList.add('hidden');
      if (d && d.totals) totals = { r: d.totals.r, g: d.totals.g };
      if (g) g.phase = 'final';
      pauseUI(false);
      const f = $('mm-final');
      if (f) { f.classList.remove('hidden', 'show'); void f.offsetWidth; f.classList.add('show'); }
      sfx(H + 'final.mp3', 0.85);
      buzz([40, 30, 40]);
      if (skin() && skin().music) skin().music(null);
    });
    s.on('mm:skip', () => { if (on) jumpToCard(); });
    s.on('game-end', () => {
      if (!on) return;
      document.body.classList.remove('mm-zone');
      clearTimers(); stopMash(true); clearInterval(chipT);
      hideIntro();
      if ($('mm-chip')) $('mm-chip').classList.add('hidden');
      pauseUI(false);
    });
  }
  function applyInit(d) {
    setOn(true);
    ctx.markActivity();
    const fresh = !g || g.id !== d.id;
    g = {
      id: d.id, phase: d.phase, E: d.E, landmarks: d.landmarks || [], frenzy: !!d.frenzy, paused: !!d.paused,
      endAt: d.endsMs != null ? performance.now() + d.endsMs : 0, pausedLeft: d.endsMs || 0,
    };
    totals = { r: d.totals.r, g: d.totals.g };
    if (d.you) { me.k = d.you.k; me.mochis = d.you.mochis || 0; }
    if (d.captains) captains = d.captains;
    if (skin() && skin().setScores) skin().setScores({ red: totals.r, gold: totals.g });
    document.body.classList.toggle('mm-frenzy', g.frenzy);
    pauseUI(g.paused);
    frenzyChip();
    paintPrompt();
    if (d.phase === 'intro') { if (fresh || !$('mm-intro').classList.contains('rules')) showRules(d.phaseMs); }
    else hideIntro();
    if (d.phase === 'final') { const f = $('mm-final'); if (f) { f.classList.remove('hidden'); f.classList.add('show'); } }
  }

  // ---------- the result screen (from the skin): my dragoncito reacts ----------
  function result(box, correct, correctText, r) {
    box.innerHTML = '';
    const info = (r && r.mochi) || {};
    const img = document.createElement('img');
    img.className = 'kdp-sticker';
    img.alt = '';
    img.src = S().dragonArt(myTeam(), correct ? 'happy' : 'worried');
    const title = document.createElement('div');
    title.className = 'kdp-res-title ' + (correct ? 'ok' : 'no');
    const timeUp = !correct && r && r.timeUp;
    title.textContent = correct ? '¡Correcto!' : timeUp ? '¡Se acabó el tiempo!' : '¡Casi!';
    box.append(img, title);
    const sub = document.createElement('div');
    sub.className = 'kdp-res-sub';
    if (correct) {
      sub.textContent = info.streakBonus ? `¡Racha de ${info.streak}! 6 segundos de mochis` : '¡Prepárate para tocar rápido!';
      box.appendChild(sub);
      if (info.streak >= 2) {
        const fl = document.createElement('div');
        fl.className = 'kdp-streak';
        fl.textContent = `Racha de ${info.streak}`;
        box.appendChild(fl);
      }
    } else {
      sub.textContent = 'La respuesta era';
      const ans = document.createElement('div');
      ans.className = 'kdp-res-answer';
      ans.textContent = correctText || '';
      const nx = document.createElement('div');
      nx.className = 'kdp-res-sub mm-next';
      nx.textContent = 'Ya viene otra pregunta…';
      box.append(sub, ans, nx);
    }
  }

  // ---------- lobby: who I am + «Así se juega» ----------
  function lobby(head) {
    let box = $('mm-how');
    if (!head) { if (box) box.remove(); return; }
    if (!S()) return;
    const t = myTeam();
    if (!box) {
      box = document.createElement('div');
      box.className = 'mm-how';
      box.id = 'mm-how';
      box.innerHTML = '<div class="mm-you"><div class="mm-you-kid" id="mm-you-kid"></div><img class="mm-you-dragon" id="mm-you-dragon" alt="" src="' + S().dragonArt(t, 'hungry') + '"><span>Tú y tu dragoncito<b id="mm-you-team"></b></span></div>'
        + '<div class="mm-how-title">Así se juega</div><ol>'
        + '<li><div class="mm-step s1"><i class="t r"></i><i class="t b"></i><i class="t y"></i><i class="t g ok"></i></div><span><b>Responde bien</b>la pregunta en Chino Mandarín</span></li>'
        + '<li><div class="mm-step s2"><i class="mmi-pic-btn"></i><i class="mmi-pic-hand"></i></div><span><b>¡Toca rápido!</b>5 segundos: cada toque es un mochi</span></li>'
        + '<li><div class="mm-step s3"><img id="mm-how-win" alt="" src="' + S().dragonArt(t, 'win') + '"></div><span><b>El dragoncito más grande gana</b>¡y hay estrellas para los mejores!</span></li>'
        + '</ol>';
      head.after(box);
    }
    box.classList.toggle('red', t === 'red');
    const kid = $('mm-you-kid');
    kid.innerHTML = '';
    kid.appendChild(S().kidFigure({ team: t, skin: mySkin(), name: myName(), tag: false }));
    $('mm-you-dragon').src = S().dragonArt(t, 'hungry');
    $('mm-you-team').textContent = 'Equipo ' + teamName(t);
    $('mm-how-win').src = S().dragonArt(t, 'win');
  }

  // ---------- the end: the ceremony, then my card ----------
  let cer = null;               // { data, stage }
  function end(data) {
    if (!S()) return;
    const box = $('screen-end');
    if (!box) return;
    clearTimers(cerTimers);
    const old = $('mm-finale');
    if (old) old.remove();
    const fin = document.createElement('div');
    fin.className = 'mm-finale';
    fin.id = 'mm-finale';
    box.appendChild(fin);
    document.body.classList.add('mm-ended');
    bannerQ = []; bannerOn = false;                // no game banner over the ceremony
    if ($('mm-banner')) $('mm-banner').classList.remove('show');
    const f = $('mm-final');
    if (f) f.classList.add('hidden');
    cer = { data, stage: null, fin };
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'mm-skip';
    skip.textContent = 'Ver mi tarjeta';
    skip.addEventListener('click', jumpToCard);
    fin.appendChild(skip);
    const stars = ((data && data.mochi && data.mochi.stars) || []);
    const plan = [['weigh', 3400], ['result', 2800]].concat(stars.map((s, i) => ['star' + i, 2200]));
    let t = 0;
    plan.forEach(([name, ms]) => { later(t, () => stage(name), cerTimers); t += ms; });
    later(t, () => stage('card'), cerTimers);
  }
  function jumpToCard() { if (!cer) return; clearTimers(cerTimers); stage('card'); }
  function stageBox(cls) {
    const fin = cer.fin;
    const old = fin.querySelector('.mmf-stage');
    if (old) old.remove();
    const s = document.createElement('div');
    s.className = 'mmf-stage ' + cls;
    fin.prepend(s);
    return s;
  }
  function stage(name) {
    if (!cer) return;
    cer.stage = name;
    const d = cer.data || {}, mo = d.mochi || {}, meD = d.me || {};
    const tt = mo.totals || { r: 0, g: 0 };
    const t = meD.team || myTeam();
    const el = S().el;
    if (name === 'weigh') {
      const s = stageBox('weigh');
      s.appendChild(el('h2', 'mmf-h', '¿Qué dragoncito comió más?'));
      const row = el('div', 'mmf-scale');
      const max = Math.max(1, tt.r, tt.g);
      ['red', 'gold'].forEach((team) => {
        const v = team === 'red' ? tt.r : tt.g;
        const col = el('div', 'mmf-col ' + (team === 'red' ? 'red' : 'gold') + (team === t ? ' mine' : ''));
        const dr = el('img', 'mmf-dragon');
        dr.alt = '';
        dr.src = S().dragonArt(team, 'eat');
        const tube = el('div', 'mmf-tube');
        const fill = el('i');
        tube.appendChild(fill);
        const n = el('b', 'mmf-n', '0');
        const lab = el('span', 'mmf-team', team === t ? 'Tu equipo' : 'Equipo ' + teamName(team));
        col.append(dr, tube, n, lab);
        row.appendChild(col);
        const k = v / max;
        if (reduced()) { fill.style.transform = `scaleY(${k})`; n.textContent = S().fmt(v); }
        else {
          // both climb together; the smaller one stops first (the drum keeps going for the other)
          fill.animate([{ transform: 'scaleY(0)' }, { transform: `scaleY(${k})` }], { duration: 600 + 2200 * k, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' });
          S().countUp(n, 0, v, 600 + 2200 * k);
        }
      });
      s.appendChild(row);
      sfx(A + 'drum.mp3', 0.75);
      return;
    }
    if (name === 'result') {
      const s = stageBox('result ' + (mo.winner === 'tie' ? 'tie' : mo.winner === 'red' ? 'red' : 'gold'));
      const won = mo.winner === t, tie = mo.winner === 'tie';
      s.appendChild(el('h2', 'mmf-h big', tie ? '¡Empate!' : `¡Gana el Equipo ${teamName(mo.winner)}!`));
      const wc = mo.captains && !tie ? mo.captains[mo.winner] : null;
      if (wc && CAST()) s.appendChild(el('p', 'mmf-capline', `${CAST().captain(wc)}: «${CAST().line(wc, 'win')}»`));
      const row = el('div', 'mmf-teams');
      ['red', 'gold'].forEach((team) => {
        const winT = tie || mo.winner === team;
        const side = el('div', 'mmf-team-side ' + (team === 'red' ? 'red' : 'gold') + (winT ? ' win' : ' lose') + (team === t ? ' mine' : ''));
        const dr = el('img', 'mmf-dragon');
        dr.alt = '';
        dr.src = S().dragonArt(team, tie ? 'dance' : winT ? 'win' : 'worried');
        side.appendChild(dr);
        const crew = el('div', 'mmf-crew');
        const kids = (mo.teams && mo.teams[team]) || [];
        let list = kids.slice(0, 3);
        if (team === t && meD.k != null && !list.some((r) => r.k === meD.k)) {
          const mineRow = kids.find((r) => r.k === meD.k) || { k: meD.k, name: myName(), skin: mySkin(), team: t };
          list = [mineRow].concat(list.slice(0, 2));
        }
        list.forEach((r, i) => {
          const f = S().kidFigure({ team, skin: r.skin, name: r.name, me: r.k === meD.k, pose: winT ? 'ok' : 'no', tag: r.k === meD.k });
          f.classList.add(winT ? 'cheer' : 'slump');
          f.style.setProperty('--i', i);
          crew.appendChild(f);
        });
        side.appendChild(crew);
        side.appendChild(el('b', 'mmf-total', S().fmt(team === 'red' ? tt.r : tt.g) + ' mochis'));
        row.appendChild(side);
      });
      s.appendChild(row);
      const conf = el('div', 'mmf-fx');
      s.appendChild(conf);
      S().confetti(conf, tie ? null : mo.winner, 34);
      sfx(K + 'sting-win.mp3', won || tie ? 0.9 : 0.55);
      if (!won && !tie) later(700, () => sfx(H + 'aww.mp3', 0.5), cerTimers);
      buzz(won ? [60, 40, 60, 40, 200] : [80]);
      return;
    }
    if (name.indexOf('star') === 0) {
      const st = (mo.stars || [])[Number(name.slice(4))];
      if (!st) return;
      const mineStar = (meD.stars || []).includes(st.id);
      const s = stageBox('star' + (mineStar ? ' mine' : ''));
      const badge = el('div', 'mmf-badge');
      badge.appendChild(S().starSvg());
      s.appendChild(badge);
      s.appendChild(el('div', 'mmf-kicker', 'Estrella Bonus'));
      s.appendChild(el('h2', 'mmf-h', st.name));
      const who = el('div', 'mmf-who');
      (st.who || []).forEach((r, i) => {
        const f = S().kidFigure({ team: r.team, skin: r.skin, name: r.name, me: r.k === meD.k, pose: 'ok' });
        f.style.setProperty('--i', i);
        who.appendChild(f);
      });
      s.appendChild(who);
      const val = st.id === 'fast' ? `${String(st.value).replace('.', ',')} s` : st.id === 'aim' ? `${st.value} %` : st.id === 'streak' ? `${st.value} seguidas` : `${S().fmt(st.value)} mochis`;
      s.appendChild(el('div', 'mmf-val', (st.n > 4 ? `y ${st.n - 4} más · ` : '') + val));
      if (mineStar) { s.appendChild(el('div', 'mmf-mine', '¡ES PARA TI!')); buzz([40, 30, 40, 30, 120]); }
      sfx(A + 'star.mp3', mineStar ? 0.9 : 0.6);
      return;
    }
    if (name === 'card') {
      clearTimers(cerTimers);
      const s = stageBox('card ' + (t === 'red' ? 'red' : 'gold'));
      const skip = cer.fin.querySelector('.mm-skip');
      if (skip) skip.remove();
      const won = mo.winner === t, tie = mo.winner === 'tie';
      const top = el('div', 'mmc-top');
      const kid = S().kidFigure({ team: t, skin: mySkin(), name: myName(), me: true, pose: won || tie ? 'ok' : 'no' });
      const dr = el('img', 'mmc-dragon');
      dr.alt = '';
      dr.src = S().dragonArt(t, won ? 'win' : tie ? 'dance' : 'think');
      top.append(kid, dr);
      s.appendChild(top);
      s.appendChild(el('h2', 'mmc-h', tie ? '¡Empate! ¡Qué partida!' : won ? '¡Ganó tu equipo!' : `¡Buen intento, Equipo ${teamName(t)}!`));
      const big = el('p', 'mmc-big');
      if (meD.mochis > 0) {
        big.append('Diste ', el('b', null, S().fmt(meD.mochis)), ' mochis');
        s.appendChild(big);
        s.appendChild(el('p', 'mmc-line', `El ${meD.share || 0} % de los mochis de tu equipo`));
      } else {
        big.textContent = '¡La próxima es tuya!';
        s.appendChild(big);
        s.appendChild(el('p', 'mmc-line', 'Responde bien y toca rápido para darle mochis'));
      }
      const score = el('p', 'mmc-score');
      score.append(el('b', 'r', `Fuego ${S().fmt(tt.r)}`), el('b', 'g', `Mar ${S().fmt(tt.g)}`));
      s.appendChild(score);
      const facts = el('div', 'mmc-facts');
      const fact = (n, l) => { const x = el('div', 'mmc-fact'); x.append(el('b', null, n), el('span', null, l)); facts.appendChild(x); };
      fact(`${meD.right || 0}/${meD.answered || 0}`, 'aciertos');
      fact(String(meD.best || 0), 'racha');
      if (meD.gold) fact(String(meD.gold), meD.gold === 1 ? 'mochi dorado' : 'dorados');
      s.appendChild(facts);
      const mineStars = (mo.stars || []).filter((x) => (meD.stars || []).includes(x.id));
      if (mineStars.length || meD.mvp) {
        const row = el('div', 'mmc-stars');
        if (meD.mvp && meD.mochis > 0) { const b = el('div', 'mmc-star mvp'); b.append(S().starSvg('mvp'), el('span', null, 'El mejor de tu equipo')); row.appendChild(b); }
        mineStars.forEach((x) => { const b = el('div', 'mmc-star'); b.append(S().starSvg(), el('span', null, x.name)); row.appendChild(b); });
        s.appendChild(row);
      }
      // the card never sends a kid out of the class: «Otra ronda» brings every phone back to the lobby
      s.appendChild(el('p', 'mmc-wait', 'Quédate aquí: tu profe puede empezar otra ronda'));
      const home = el('button', 'mmc-home', 'Salir del juego');
      home.type = 'button';
      home.addEventListener('click', () => { location.href = '/'; });
      s.appendChild(home);
    }
  }

  window.MochiPhone = {
    init, lobby, result, end,
    frame: () => ({
      on, phase: g && g.phase, totals, me: Object.assign({}, me), mashing: !!mash, taps: mash ? mash.n : 0, sent: mash ? mash.sent : 0,
      frenzy: !!(g && g.frenzy), paused: !!(g && g.paused), stage: cer && cer.stage,
    }),
    tap: (n) => { for (let i = 0; i < (n || 1); i++) onTap({ type: 'test' }); return mash ? mash.n : 0; },
    hold: (v) => {
      testHold = !!v;
      const b = $('mm-banner');
      if (!testHold && b && b.classList.contains('show')) { b.classList.remove('show'); setTimeout(nextBanner, 260); }   // a held banner goes, the queue moves on
    },
    freeze: (v) => { frozen = !!v; if (!frozen) { const q = queue; queue = []; q.forEach(([fn, d]) => fn(d)); } return queue.length; },
    replay: (ev) => { while (queue.length) { const [fn, d, e] = queue.shift(); fn(d); if (e === ev) break; } return queue.length; },
    queued: () => queue.map((x) => x[2]),
    stage: (name) => { if (cer) { clearTimers(cerTimers); stage(name); } },
    runIn: () => showRunIn(),
    rules: (ms) => showRules(ms),
    sim: (ev, d) => { if (handlers[ev]) handlers[ev](d); },
    openMash: (info) => openMash(info),
  };
})();
