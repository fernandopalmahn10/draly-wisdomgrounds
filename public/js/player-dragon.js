// Vuelo del Dragón v2 «La Carrera del Cielo de Dubái» — the kid's phone (the product). player.js calls
// DragonPhone.init(...) once; the shared phone skin (player-kingdoms-skin.js) gives the lobby look, the sounds and the
// music, and routes the lobby card and the end screen here. What this module draws, only while the room's game is
// 'dragon-eye':
//   · THE RACE (js/dragon-sky.js): the sky over Dubai with MY dragoncito big in front (my character standing on its back)
//     and my rivals in their lanes (true distances near me, squeezed toward the edges further away, «+120 m» on their
//     tag), the landmarks and the Creek rushing by, my race's plates on top (1º-4º, metres, stars; mine «TÚ»), the clock.
//     It never stops moving: rivals flap past, clouds drift, the gang talks. No dead phone.
//   · the question as a sheet at the bottom (picture, prompt, four big tiles, 20 s clock with ticks); the tap answers at
//     once (press, pop, my dragon perks up) and the server judges (packs never send the right answer)
//   · right → «¡Correcto!» → the sheet slides down: «¡A VOLAR!», the whole screen is the wing: every swipe up (or tap) is
//     a beat (wings up and down, the dragon surges, a pitch that climbs, «+6 m»), a golden ring sometimes waits ahead;
//     the beats go to the server every 250 ms (capped the same way here, so what I see is what I get) and the flight's
//     summary settles my metres (dr:flown)
//   · wrong → «¡Casi! Era …» with a wait bar on the sheet; my dragon dips; the race goes on above
//   · the star sprints («¡Carrera al Burj Khalifa!»: four live bars, Dralingo with the star, «¡ESTRELLA!»), overtakes,
//     lead / frenzy / time banners at the top edge (never over the tiles), fireworks in the last 30 s, the pause card,
//     «¡FINAL!» and the ceremony: my race's finish strip, the bonus stars one by one (+200 m dashes), «¿Quién gana tu
//     carrera?», my own card
// Test hooks: DragonPhone.frame(), .hold(v), .freeze(v) / .replay(ev) / .queued(), .stage(name), .sim(ev, d), .runIn(),
//             .rules(ms), .answer(i), .beat(n), .banner(kind, title, sub), .bigStar(), .gang(id, text), .tick(ms).
(function () {
  'use strict';
  const S = () => window.DragonSky;
  const C = window.DragonCourse;
  const DR = '/assets/dragon/', K = '/assets/kingdoms/', H = '/assets/halcon/', MO = '/assets/mochi/', MN = '/assets/monopoly/', SS = '/assets/sixseven/';
  const $ = (id) => document.getElementById(id);
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const skin = () => window.KingdomsSkin;
  const CAST = () => window.DralingoCast;
  const sfx = (path, vol) => { const s = skin(); if (s && s.sfx) s.sfx(path, vol); };
  const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (_) {} };
  const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('es-ES');
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const later = (ms, fn, list) => { const t = setTimeout(fn, Math.max(0, ms)); (list || timers).push(t); return t; };
  const lmName = (id) => { const l = C.lm(id); return l ? l.name : 'el monumento'; };
  const LOW = (navigator.hardwareConcurrency || 4) < 4;

  let ctx = null, on = false;
  let gen = 0;
  let timers = [], introTimers = [], cerTimers = [];
  let g = null;                  // { id, phase, endAt (perf), paused, pausedLeft, frenzy, dur, playAt (perf) }
  let sky = null, raceId = null;
  let seats = {};                // k → { k, name, skin, c, m (server), shown, fl, st, on, seq, el }
  let meK = null, myLead = null, lastSeq = 0;
  let roster = [];
  let testHold = false;

  // ---------- who I am ----------
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
  const listY = (a) => (a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1]);
  const seatName = (k) => (seats[k] ? (k === meK ? 'Tú' : seats[k].name) : '');
  const colorOf = (k) => S().colorOf(seats[k] ? seats[k].c : 0);

  // ---------- quick sounds (Web Audio: a wing beat per swipe lands on time) ----------
  let actx = null, loading = false;
  const bufs = {};
  const BUF = { f2: DR + 'flap2.mp3', f4: DR + 'flap4.mp3', f6: DR + 'flap6.mp3', pop: MO + 'pop.mp3', gold: MO + 'gold.mp3', tick: K + 'tick.mp3', star: MN + 'star.mp3', whoosh: K + 'whoosh.mp3' };
  function audioReady() {
    if (actx) { if (actx.state === 'suspended') actx.resume().catch(() => {}); return; }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      actx = new Ctx();
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
  function raceUp(v) { document.body.classList.toggle('drx-play', !!v && on); if (v) ctx.showScreen('dragon'); }
  function setOn(v) {
    if (v === on) return;
    on = v;
    document.body.classList.toggle('drx-on', on);
    if (!on) teardown(true);
  }
  function clearTimers(list) { (list || timers).forEach(clearTimeout); if (list) list.length = 0; else timers = []; }
  function hideOverlays() {
    const b = $('drx-banner'); if (b) b.classList.remove('show');
    const big = $('drx-big'); if (big) big.classList.add('hidden');
    bigOn = false;
    const fly = $('drx-fly'); if (fly) { fly.classList.add('hidden'); fly.classList.remove('end'); }
    document.body.classList.remove('drx-flying');
    const gg = $('drx-gang'); if (gg) gg.classList.remove('show');
    const ch = $('drx-chip'); if (ch) ch.classList.remove('show');
    bannerQ = []; bannerOn = false; document.body.classList.remove('drx-bannering');
  }
  function teardown(all) {
    gen++;
    hideOverlays();
    clearTimers();
    clearTimers(introTimers);
    stopQTimer();
    endFlight(true);
    cur = null; pendingQ = null;
    hideIntro();
    pauseUI(false);
    sprintUI(null);
    clearInterval(clockT);
    const fin = $('drx-final');
    if (fin) fin.classList.add('hidden');
    document.body.classList.remove('drx-ended', 'drx-play', 'drx-flying');
    if (all) {
      clearTimers(cerTimers);
      const f = $('drx-finale');
      if (f) f.remove();
      stopLoop();
      if (sky) { sky.destroy(); sky = null; }
      raceId = null; seats = {}; meK = null; myLead = null; lastSeq = 0; hudKey = '';
      rightN = 0; wrongN = 0; flights = 0; afterFlight = null; tailShown = false; lastPass = 0;
      const hud = $('drx-hud'); if (hud) hud.innerHTML = '';
      plates = {};
    }
  }

  // ---------- the race: the sky, the flyers, the plates ----------
  function ensureRace(view, me) {
    if (!S() || !$('drx-sky')) return;
    if (!sky || raceId !== view.id) {
      if (sky) sky.destroy();
      $('drx-sky').innerHTML = '';
      sky = new (S().Sky)($('drx-sky'), { anchor: 0.3, seed: 7 + (view.id || 1) * 13 });
      raceId = view.id;
      seats = {};
      plates = {};
      $('drx-hud').innerHTML = '';
      lastSeq = 0;
    }
    meK = me;
    (view.seats || []).forEach((x) => addSeat(x));
    myLead = view.lead;
    paintHud();
    geoNow();
    startLoop();
  }
  function addSeat(x) {
    let s = seats[x.k];
    if (!s) {
      s = seats[x.k] = { k: x.k, name: x.name, skin: x.skin, c: x.c, m: x.m || 0, shown: x.m || 0, st: x.st || 0, fl: 0, on: x.on !== false, seq: 0, sp: 0 };
      const me = x.k === meK;
      s.el = S().flyer({ skin: x.skin, c: x.c, name: me ? (myName() || x.name) : x.name, me });
      s.el.classList.add(me ? 'me' : 'rival');
      if (s.on === false) s.el.off(true);
      sky.flyers.appendChild(s.el);
      S().preload([x.c], [x.skin]);
    } else {
      Object.assign(s, { name: x.name, skin: x.skin, c: x.c, st: x.st != null ? x.st : s.st, on: x.on !== false });
      if (x.m != null && (x.m > s.m || s.seq === 0)) s.m = x.m;
      s.el.off(s.on === false);
    }
    return s;
  }
  // my race's live line: [[k, metres, flags, sprint metres]]
  function applyLine(d) {
    if (!d || d.b !== raceId || !sky) return;
    if (d.seq <= lastSeq) return;
    lastSeq = d.seq;
    const before = rankList();
    (d.d || []).forEach((row) => {
      const s = seats[row[0]];
      if (!s) return;
      const mine = row[0] === meK;
      // my own metres: during my flight the phone's prediction leads (dr:flown settles); otherwise the server's number
      if (!mine || !flight) s.m = row[1];
      s.fl = row[2] || 0;
      if (row.length > 3) s.sp = row[3];
      if (!mine) { s.el.flying(!!(s.fl & 1)); s.el.fire(!!(s.fl & 4)); }
      s.el.tail(!!(s.fl & 2));
      if (mine) tailChip(!!(s.fl & 2));
    });
    overtakes(before, rankList());
    if (sprint) paintSprint();
    paintHudSoon();
  }
  const metresOf = (s) => (s.k === meK && flight ? myPredicted() : s.m);
  function rankList() {
    return Object.values(seats).slice().sort((a, b) => metresOf(b) - metresOf(a) || b.st - a.st || a.k - b.k).map((s) => s.k);
  }
  // ---------- the plates (my race on top) ----------
  let plates = {}, hudT = null, hudKey = '';
  function paintHudSoon() { if (hudT) return; hudT = setTimeout(() => { hudT = null; paintHud(); }, 250); }
  function paintHud() {
    const hud = $('drx-hud');
    if (!hud) return;
    const order = rankList();
    const n = order.length;
    hud.classList.toggle('five', n > 4);
    const key = order.join(',');
    const moved = hudKey && key !== hudKey && !reduced();
    const before = {};
    if (moved) Object.entries(plates).forEach(([k, p]) => { before[k] = p.getBoundingClientRect().left; });
    hudKey = key;
    order.forEach((k, i) => {
      const s = seats[k];
      let p = plates[k];
      if (!p) {
        p = plates[k] = el('div', 'drx-plate' + (k === meK ? ' me' : ''));
        p.style.setProperty('--pc', S().colorOf(s.c).c);
        const mt = el('span', 'mt');
        mt.append(el('b'), el('small', null, 'm'));
        p.append(el('em', 'rk'), el('b', 'nm', k === meK ? 'TÚ' : s.name), mt);
        const st = el('span', 'st');
        st.append(S().star(), el('i'));
        p.appendChild(st);
        hud.appendChild(p);
      }
      p.style.order = String(i);
      p.querySelector('.rk').textContent = (i + 1) + 'º';
      p.querySelector('.mt b').textContent = fmt(metresOf(s));
      const st = p.querySelector('.st');
      st.classList.toggle('none', !(s.st > 0));
      st.lastChild.textContent = String(s.st || 0);
      p.classList.toggle('lead', myLead === k && n > 1);
      p.classList.toggle('off', s.on === false);
    });
    if (moved) Object.entries(plates).forEach(([k, p]) => {
      const dx = (before[k] || 0) - p.getBoundingClientRect().left;
      if (Math.abs(dx) > 2 && p.animate) p.animate([{ transform: `translate3d(${dx}px,0,0)` }, { transform: 'translate3d(0,0,0)' }], { duration: 320, easing: 'cubic-bezier(.23,1,.32,1)' });
    });
  }
  // overtakes: who I passed / who passed me (my phone only, ≥ 2.5 s apart, never during a big moment)
  let lastPass = 0;
  function overtakes(before, after) {
    if (meK == null || !g || g.phase !== 'play') return;
    const a = before.indexOf(meK), b = after.indexOf(meK);
    if (a < 0 || b < 0 || a === b) return;
    const now = performance.now();
    if (now - lastPass < 2500 || bigOn) return;
    lastPass = now;
    if (b < a) {
      const passed = before.slice(a - (a - b), a).filter((k) => k !== meK);
      const who = passed.length ? seatName(passed[passed.length - 1]) : '';
      chip('pass', who ? `¡Pasaste a ${who}!` : '¡Adelantaste!', b === 0 ? '¡Vas primero!' : `${b + 1}º lugar`);
      sfx(K + 'flag.mp3', 0.45);
      buzz([20, 30, 20]);
      if (Math.random() < 0.4) gang('aileen', line('aileen'));
    } else {
      const by = after[b - 1];
      chip('passed', `${seatName(by)} te pasó`, '¡Responde bien y vuela!');
    }
  }

  // ---------- geometry: lanes for my dragon and my rivals (question mode / flight mode) ----------
  let geo = null, geoTo = null;
  function geoCalc() {
    if (!sky) return null;
    const sz = sky.size();
    const W = sz.w, Hh = sz.h;
    const hud = $('drx-hud');
    const spr = $('drx-sprint');
    let top = (hud ? hud.offsetTop + hud.offsetHeight : 64) + 34;
    if (spr && !spr.classList.contains('hidden')) top = spr.offsetTop + spr.offsetHeight + 10;
    const flying = document.body.classList.contains('drx-flying');
    const q = $('drq');
    const sheetUp = q && !q.classList.contains('down');
    const bottom = flying || !sheetUp ? Hh - 70 : Hh - q.offsetHeight - 8;
    $('drx').style.setProperty('--sheet', (sheetUp && !flying ? q.offsetHeight : 0) + 'px');
    const avail = Math.max(60, bottom - top);
    const rivals = Object.keys(seats).length - 1;
    // my dragon: about half the space (what the rivals' lanes leave), never wider than half the screen
    const LANE = 30;
    const myMax = Math.min(avail * (rivals ? 0.5 : 0.85), flying ? 320 : 240);
    const myH = Math.max(Math.min(64, avail), Math.min(myMax, avail - rivals * LANE));
    const myW = Math.max(56, Math.min(W * (flying ? 0.62 : 0.5), (myH - 28) / 1.02));
    const myY = bottom - myW * 1.02 - 28;
    // the rivals' lanes: above my dragon, never over it (a tight phone: smaller rivals, no tags)
    const rivH = rivals ? Math.max(0, myY - top) / rivals : 0;
    const rivW = Math.max(24, Math.min(myW * 0.62, (rivH - 12) / 1.02));
    const lanes = [];
    for (let i = 0; i < rivals; i++) lanes.push(top + i * rivH + Math.max(0, rivH - (rivW * 1.02 + 12)) * 0.5);
    const drx = $('drx');
    if (drx) drx.classList.toggle('tight', rivH < 34);
    return { W, H: Hh, top, bottom, myW, myY, rivW, lanes };
  }
  function geoNow() { geoTo = geoCalc(); geo = geoTo && Object.assign({}, geoTo, { lanes: geoTo.lanes.slice() }); }
  function geoSoon() { geoTo = geoCalc(); }
  function geoStep(k) {
    if (!geo || !geoTo) return;
    ['myW', 'myY', 'rivW', 'W', 'H', 'top', 'bottom'].forEach((key) => { geo[key] += (geoTo[key] - geo[key]) * k; });
    while (geo.lanes.length < geoTo.lanes.length) geo.lanes.push(geoTo.lanes[geo.lanes.length]);
    geo.lanes.length = geoTo.lanes.length;
    geo.lanes.forEach((v, i) => { geo.lanes[i] += (geoTo.lanes[i] - v) * k; });
  }

  // ---------- the loop: the camera follows my dragon; rivals at their distance; the sky drifts ----------
  let raf = 0, lastT = 0, skip = false, tagT = 0;
  function startLoop() { if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(loop); } }
  function stopLoop() { cancelAnimationFrame(raf); raf = 0; }
  function loop(t) {
    raf = 0;
    if (!on || !sky) return;
    raf = requestAnimationFrame(loop);
    if (document.hidden) return;
    if (LOW && (skip = !skip)) return;            // cheap phones: 30 frames a second
    const dt = Math.min(0.1, (t - lastT) / 1000);
    lastT = t;
    frameAt(t, dt);
  }
  function frameAt(t, dt) {
    if (!sky || meK == null || !seats[meK]) return;
    const rm = reduced();
    geoStep(rm ? 1 : 1 - Math.exp(-dt / 0.18));
    const me = seats[meK];
    const target = flight ? myPredicted() : me.m;
    me.shown += (target - me.shown) * (rm ? 1 : 1 - Math.exp(-dt / (flight ? 0.09 : 0.35)));
    if (Math.abs(target - me.shown) < 0.05) me.shown = target;
    sky.camera(me.shown, t);
    if (g && g.dur && g.playAt && !g.paused) sky.night(Math.min(1, (performance.now() - g.playAt) / (g.dur * 1000)));
    if (!geo) return;
    const A = Math.max(80, geo.W * 0.62);
    let i = 0;
    const tags = t - tagT > 300;
    if (tags) tagT = t;
    Object.values(seats).sort((a, b) => a.c - b.c).forEach((s) => {
      if (s.k === meK) {
        place(s.el, geo.W * sky.anchor, geo.myY, geo.myW, 30);
        return;
      }
      s.shown += (s.m - s.shown) * (rm ? 1 : 1 - Math.exp(-dt / 0.45));
      const d = s.shown - me.shown;
      // squeezed toward the edges further away, but always whole on the screen (the tag hugs the edge)
      const half = geo.rivW / 2 + 4;
      const x = Math.max(half, Math.min(geo.W - half, geo.W * sky.anchor + C.relX(d, A)));
      const edge = x >= geo.W - half - 30 ? 'r' : x <= half + 30 ? 'l' : '';
      if (s.el._edge !== edge) { s.el._edge = edge; s.el.classList.toggle('edge-r', edge === 'r'); s.el.classList.toggle('edge-l', edge === 'l'); }
      place(s.el, x, geo.lanes[i] != null ? geo.lanes[i] : geo.top, geo.rivW, 20 - i);
      if (tags && s.el._name) {
        const far = Math.abs(d) >= 30 ? ` · ${d > 0 ? '+' : '−'}${fmt(Math.abs(d))} m` : '';
        const txt = s.name + far;
        if (s.el._name.textContent !== txt) s.el._name.textContent = txt;
      }
      i++;
    });
  }
  function place(node, cx, y, w, z) {
    const key = `${Math.round(cx)}|${Math.round(y)}|${Math.round(w)}`;
    if (node._key === key) return;
    node._key = key;
    node.style.setProperty('--fw', w.toFixed(1) + 'px');
    node.style.transform = `translate3d(${(cx - w / 2).toFixed(1)}px,${y.toFixed(1)}px,0)`;
    node.style.zIndex = String(z);
  }

  // ---------- the clock ----------
  let clockT = null;
  function runClock() {
    clearInterval(clockT);
    const c = $('drx-clock');
    if (!c) return;
    const paint = () => {
      if (!g || !g.endAt) { c.querySelector('b').textContent = '-:--'; return; }
      const left = g.paused ? g.pausedLeft : Math.max(0, g.endAt - performance.now());
      const s = Math.max(0, Math.ceil(left / 1000));
      c.querySelector('b').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      c.classList.toggle('x2', !!g.frenzy);
      c.classList.toggle('last', g.phase === 'play' && s <= 10);
      if (sprint) paintSprintClock();
    };
    paint();
    clockT = setInterval(paint, 250);
  }

  // ---------- the question sheet ----------
  let cur = null, pendingQ = null, qT = null, rescueT = null, lastTick = 0;
  function sheet(up) {
    const q = $('drq');
    if (!q) return;
    q.classList.toggle('down', !up);
    q.setAttribute('aria-hidden', up ? 'false' : 'true');
    geoSoon();
  }
  function showQuestion(q) {
    if (!on || !q) return;
    if (flight && !flight.done) { pendingQ = q; return; }   // my flight finishes first (the server deals after it anyway)
    raceUp(true);
    hideIntro();
    hideFly();
    if (cur && cur.qid === q.qid) {                     // the same question again (a resync / a rejoin)
      if (cur.tapped && !cur.done) { cur.tapped = false; setTiles(!(g && g.paused)); document.querySelectorAll('.drq-a').forEach((b) => b.classList.remove('picked')); runQTimer(); }
      sheet(true);
      return;
    }
    cur = { qid: q.qid, t0: performance.now(), ms: 20000, tapped: false, done: false, heldAt: 0, heldSum: 0, answers: q.answers || [] };
    const box = $('drq');
    box.classList.toggle('nopic', !q.image);
    const img = $('drq-img');
    if (q.image) { img.src = q.image; img.alt = ''; }
    else img.removeAttribute('src');
    if (window.DralyQ) window.DralyQ.fill($('drq-text'), q.text || ''); else $('drq-text').textContent = q.text || '';   // «…» red and bold (js/qtext.js)
    const v = $('drq-verdict');
    v.className = 'drq-verdict';
    v.textContent = '';
    const ans = $('drq-ans');
    ans.innerHTML = '';
    const SH = ['▲', '◆', '●', '■'];
    (q.answers || []).forEach((a, i) => {
      const b = el('button', 'drq-a s' + (i % 4) + (a.length > 34 ? ' xlong' : a.length > 16 ? ' long' : ''));
      b.type = 'button';
      const sh = el('span', 'drq-sh', SH[i % 4]);
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
    sfx(K + 'whoosh.mp3', 0.25);
    ctx.markActivity();
  }
  function setTiles(v) { document.querySelectorAll('.drq-a').forEach((b) => { b.disabled = !v; }); }
  const qLeft = () => (cur ? Math.max(0, cur.ms - ((cur.heldAt || performance.now()) - cur.t0 - cur.heldSum)) : 0);
  function runQTimer(fresh) {
    stopQTimer();
    if (!cur) return;
    const bar = $('drq-bar');
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
    const bar = $('drq-bar');
    if (bar && cur) { bar.style.transition = 'none'; bar.style.transform = `scaleX(${(qLeft() / cur.ms).toFixed(3)})`; }
  }
  function holdQ(v) {
    if (!cur) return;
    if (v && !cur.heldAt) { cur.heldAt = performance.now(); stopQTimer(); }
    else if (!v && cur.heldAt) { cur.heldSum += performance.now() - cur.heldAt; cur.heldAt = 0; if (!cur.tapped && !cur.done) runQTimer(); }
  }
  // the tap answers at once: the tile presses, a pop, my dragon perks up and my rider leans in; the server judges
  function answer(i) {
    audioReady();
    if (!cur || cur.tapped || cur.done || !g || g.phase !== 'play' || g.paused) return;
    cur.tapped = true;
    const btn = document.querySelectorAll('.drq-a')[i];
    if (btn) btn.classList.add('picked');
    setTiles(false);
    play('pop', 1.1, 0.5);
    buzz(10);
    stopQTimer();
    const me = seats[meK];
    if (me) me.el.lean();
    const v = $('drq-verdict');
    v.className = 'drq-verdict wait show';
    v.textContent = '';
    v.appendChild(el('b', 'dots', '•••'));
    const qid = cur.qid;
    ctx.socket.emit('player:answer', { pin: ctx.getPin(), qid, choiceIdx: i }, () => {});
    clearTimeout(rescueT);
    // no verdict in 3 s (a Wi-Fi blip): the tiles come back (the server answers a second tap or deals a new question)
    rescueT = setTimeout(() => {
      if (!(cur && cur.qid === qid && cur.tapped && !cur.done)) return;
      cur.tapped = false;
      if (btn) btn.classList.remove('picked');
      $('drq-verdict').className = 'drq-verdict';
      if (g && g.paused) return;
      setTiles(true);
      runQTimer();
    }, 3000);
    ctx.markActivity();
  }
  function verdict(cls, head, sub, waitMs) {
    const v = $('drq-verdict');
    v.className = 'drq-verdict ' + cls;
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
  let rightN = 0, wrongN = 0;
  function onResult(r) {
    const dr = r.dragon;
    clearTimeout(rescueT);
    stopQTimer();
    if (cur) { cur.done = true; cur.tapped = true; }
    setTiles(false);
    const tiles = document.querySelectorAll('.drq-a');
    tiles.forEach((b) => {
      const txt = b.lastChild && b.lastChild.textContent;
      if (txt === r.correctText) b.classList.add('right');
      else if (b.classList.contains('picked')) b.classList.add('wrong');
      else b.classList.add('dim');
    });
    const me = seats[meK];
    if (dr.right) {
      rightN++;
      const fire = dr.power >= 2 ? '¡Fuego azul ×2!' : dr.fire ? '¡Fuego azul!' : '';
      verdict('ok', '¡Correcto!', fire ? `${fire} Racha ${dr.streak}` : dr.streak >= 2 ? `Racha ${dr.streak}` : '¡A volar!');
      play('gold', 1.1, 0.5);
      buzz([20, 30, 20]);
      if (me) me.el.pose('ok', 1400);
      openFlight(dr);
      if (rightN === 1) gang('dralingo', '¡Yalla! ¡Aletea fuerte!');
      else if (dr.fire && dr.streak === 3) gang('dralingo', line('dralingo'));
    } else {
      wrongN++;
      const head = dr.tooFast ? '¡Muy rápido!' : dr.timeUp ? '¡Se acabó el tiempo!' : '¡Casi!';
      const sub = (dr.calm ? '¡Respira! Lee y piensa · ' : dr.tooFast ? 'Primero lee · ' : '') + (r.correctText ? 'Era: ' + r.correctText : '');
      verdict('no', head, sub, dr.wait);
      sfx(SS + 'wrong.mp3', 0.5);
      buzz([40, 30, 40]);
      if (me) { me.el.dip(); me.el.pose('no', 1300); }
      if (wrongN === 1 || dr.calm || Math.random() < 0.35) {
        const who = ['latifa', 'fer', 'hamdan', 'adrian'][Math.floor(Math.random() * 4)];
        gang(who, CAST() ? CAST().line(who, 'oops') : '¡Casi!');
      }
    }
    ctx.markActivity();
  }

  // ---------- the flight: every swipe up (or tap) is a wing beat ----------
  let flight = null;             // { mid, t0, until, ms, beats, sent, metres, base, ring, ringHit, power, frenzy, tail, beatM, rate, burst, done }
  const myPredicted = () => (flight ? flight.base + flight.metres : (seats[meK] ? seats[meK].m : 0));
  let flights = 0;
  function openFlight(d) {
    endFlight(true);
    const now = performance.now();
    const me = seats[meK];
    const f = flight = {
      mid: d.mid, t0: now + (d.lead || 0) - (d.elapsed || 0), ms: d.ms || 4000, beats: d.beats || 0, sent: d.beats || 0, metres: 0,
      base: me ? me.m : 0, ring: d.ring || 0, ringHit: false, power: d.power || 1, frenzy: !!d.frenzy || !!(g && g.frenzy),
      tail: !!d.tail, beatM: d.beatM || 6, rate: d.rate || 5, burst: d.burst || 3, done: false, open: false, heldAt: 0, sendT: null,
    };
    f.until = f.t0 + f.ms;
    flights++;
    later(d.lead || 0, () => { if (flight === f) flyOpen(f); });
  }
  function flyOpen(f) {
    if (!on || flight !== f || f.done) return;
    if (g && g.phase !== 'play') { endFlight(true); return; }   // («¡FINAL!» came during the lead)
    f.open = true;
    sheet(false);
    const gb = $('drx-gang'); if (gb) gb.classList.remove('show');
    document.body.classList.add('drx-flying');
    { const bn = $('drx-banner'); if (bn && bn.classList.contains('show')) bn.classList.remove('show'); }   // the banner steps aside for my flight
    geoSoon();
    const box = $('drx-fly');
    box.classList.remove('hidden', 'end');
    box.classList.toggle('fire', f.power > 1);
    $('drx-fly-head').textContent = f.power >= 2 ? '¡FUEGO AZUL ×2!' : f.power > 1 ? '¡FUEGO AZUL!' : '¡A VOLAR!';
    $('drx-fly-n').textContent = String(f.beats);
    $('drx-fly-m').textContent = '+0 m';
    $('drx-fly-hint').classList.toggle('hidden', flights > 3);
    const bar = $('drx-fly-bar');
    bar.style.transition = 'none';
    bar.style.transform = 'scaleX(1)';
    void bar.offsetWidth;
    bar.style.transition = `transform ${Math.max(0, f.until - performance.now())}ms linear`;
    bar.style.transform = 'scaleX(0)';
    $('drx-tap').classList.add('on');
    const me = seats[meK];
    if (me) { me.el.glide(false); me.el.fire(f.power > 1); }
    if (f.ring) showRing(f);
    play('whoosh', 1, 0.5);
    ctx.markActivity();
    if (g && g.paused) holdFlight(true);
    f.sendT = setInterval(() => sendBeats(f), 250);
    f.endT = later(Math.max(0, f.until - performance.now()), () => flyEnd(f));
  }
  function holdFlight(v) {
    const f = flight;
    if (!f || f.done || !f.open) return;
    if (v && !f.heldAt) { sendBeats(f); f.heldAt = performance.now(); clearTimeout(f.endT); const bar = $('drx-fly-bar'); bar.style.transition = 'none'; bar.style.transform = `scaleX(${Math.max(0, (f.until - f.heldAt) / f.ms).toFixed(3)})`; }
    else if (!v && f.heldAt) {
      const d = performance.now() - f.heldAt;
      f.t0 += d; f.until += d; f.heldAt = 0;
      const bar = $('drx-fly-bar');
      void bar.offsetWidth;
      bar.style.transition = `transform ${Math.max(0, f.until - performance.now())}ms linear`;
      bar.style.transform = 'scaleX(0)';
      f.endT = later(Math.max(0, f.until - performance.now()), () => flyEnd(f));
    }
  }
  // one beat: the same cap as the server (RATE a second of flight + a burst), so a predicted metre is a real metre
  function beat() {
    audioReady();
    const f = flight;
    if (!f || f.done || !f.open || f.heldAt || (g && g.paused)) return false;
    const now = performance.now();
    if (now < f.t0 || now > f.until) return false;
    const allowed = Math.floor((f.rate * (now - f.t0)) / 1000) + f.burst;
    const me = seats[meK];
    if (f.beats >= allowed) {
      if (me) me.el.beat(false);                      // the wings still answer the finger; no metres over the cap
      return false;
    }
    f.beats++;
    const mult = (g && g.frenzy) || f.frenzy ? 2 : 1;
    let v = f.beatM * mult * f.power;
    const st = standing();
    if (f.tail && st.last && st.gap >= 60) v += Math.max(0, Math.min(v * 0.5, st.gap - v));
    let ring = false;
    if (f.ring && !f.ringHit && f.beats >= f.ring) {
      f.ringHit = true;
      ring = true;
      let rv = 30 * mult;
      if (st.gap > 0) rv = Math.max(0, Math.min(rv, st.gap - v));
      v += rv;
    }
    const before = f.base + f.metres;
    const order = rankList();
    f.metres = Math.round((f.metres + v) * 10) / 10;
    passed(before, f.base + f.metres);
    overtakes(order, rankList());
    if (me) me.el.beat(f.beats % 4 === 0);
    play(['f2', 'f4', 'f6'][f.beats % 3], 0.9 + Math.min(0.5, f.beats * 0.02), 0.55);
    buzz(8);
    $('drx-fly-n').textContent = String(f.beats);
    $('drx-fly-m').textContent = '+' + fmt(f.metres) + ' m';
    popAtMe('+' + fmt(v) + ' m', ring ? 'ring' : f.power > 1 ? 'fire' : '');
    if (ring) ringHit();
    if (f.beats === 1) $('drx-fly-hint').classList.add('hidden');
    paintHudSoon();
    ctx.markActivity();
    return true;
  }
  // the landmarks and the laps my dragon passes during a flight: a chip on the way, Adrian after a lap
  let afterFlight = null;
  function passed(a, b) {
    if (!(b > a)) return;
    const lapA = Math.floor(a / C.LAP), lapB = Math.floor(b / C.LAP);
    if (lapB > lapA) {
      chip('lap', `¡Vuelta ${lapB + 1} a Dubái!`, 'Otra vez por el Creek');
      play('star', 1.3, 0.35);
      afterFlight = ['adrian', line('adrian')];
      return;
    }
    const at = (x) => ((x % C.LAP) + C.LAP) % C.LAP;
    const l = C.LANDMARKS.find((x) => at(a) < x.at && at(b) >= x.at);
    if (l) chip('lm', `¡${l.name}!`, 'Lo pasaste volando');
  }
  // where I stand in my race (for the tailwind and the ring's cap, like the server)
  function standing() {
    const me = seats[meK];
    const others = Object.values(seats).filter((s) => s.k !== meK && s.on !== false);
    if (!me || !others.length) return { last: false, gap: 0 };
    const m = myPredicted();
    const top = Math.max(...others.map((s) => s.m)), low = Math.min(...others.map((s) => s.m));
    return { last: m <= low && m < top, gap: Math.max(0, top - m) };
  }
  function sendBeats(f) {
    if (!f || f.beats <= f.sent) return;
    const n = Math.min(8, f.beats - f.sent);
    f.sent += n;
    ctx.socket.emit('player:dr-beats', { pin: ctx.getPin(), mid: f.mid, n });
  }
  // the flight box away (unless a newer flight is open): «¡Qué vuelo!» stays ~0.9 s, never over the next question
  function hideFly() {
    if (flight && flight.open) return;
    const box = $('drx-fly');
    if (box) { box.classList.add('hidden'); box.classList.remove('end'); }
    document.body.classList.remove('drx-flying');
    geoSoon();
  }
  function flyEnd(f) {
    if (flight !== f || f.done) return;
    sendBeats(f);
    sendBeats(f);
    clearInterval(f.sendT);
    $('drx-tap').classList.remove('on');
    const box = $('drx-fly');
    box.classList.add('end');
    $('drx-fly-head').textContent = f.metres > 0 ? '¡Qué vuelo!' : '¡Aletea la próxima vez!';
    const me = seats[meK];
    if (me) { me.el.glide(true); me.el.fire(false); }
    later(900, hideFly);
    hideRing();
    f.open = false;
    if (afterFlight) { const a = afterFlight; afterFlight = null; later(1200, () => gang(a[0], a[1])); }
    // the server's summary settles my metres (dr:flown); until then the prediction stays
    f.waitT = later(2500, () => { if (flight === f) endFlight(); });
  }
  function endFlight(silent) {
    const f = flight;
    if (!f) return;
    clearInterval(f.sendT);
    clearTimeout(f.endT);
    clearTimeout(f.waitT);
    f.done = true;
    flight = null;
    const me = seats[meK];
    if (me && !silent) { me.m = Math.max(me.m, Math.round(f.base + f.metres)); }
    if (me) { me.el.fire(false); me.el.glide(true); }
    const t = $('drx-tap'); if (t) t.classList.remove('on');
    hideRing();
    if (!silent) {
      hideFly();
      if (pendingQ) { const q = pendingQ; pendingQ = null; showQuestion(q); }
    }
  }
  function onFlown(s) {
    if (!flight || flight.mid !== s.mid) { if (seats[meK]) { const o = rankList(); seats[meK].m = s.m; overtakes(o, rankList()); paintHudSoon(); } return; }
    const f = flight;
    const me = seats[meK];
    if (me) me.m = s.m;
    f.metres = s.m - f.base;           // (the server's number: usually the same as the prediction)
    endFlight(true);
    const box = $('drx-fly');
    if (box && !box.classList.contains('end')) hideFly();   // (an «¡Qué vuelo!» on screen goes by its own timer)
    paintHud();
    if (s.metres >= 120 && Math.random() < 0.3) gang('fer', line('fer'));
    if (pendingQ) { const q = pendingQ; pendingQ = null; showQuestion(q); }
  }
  // a little «+6 m» over my dragon (pooled: ≤ 6 on screen)
  let pops = [];
  function popAtMe(text, cls) {
    if (reduced()) return;
    const me = seats[meK];
    const layer = $('drx-fx');
    if (!me || !layer || !geo) return;
    let p = pops.find((x) => !x._busy);
    if (!p) { if (pops.length >= 6) return; p = el('i', 'drx-pop'); layer.appendChild(p); pops.push(p); }
    p._busy = true;
    p.textContent = text;
    p.className = 'drx-pop ' + (cls || '');
    const x = geo.W * sky.anchor + geo.myW * 0.15 + (Math.random() - 0.5) * 30, y = geo.myY + geo.myW * 0.1;
    const a = p.animate([{ transform: `translate3d(${x}px,${y}px,0) scale(.8)`, opacity: 1 }, { transform: `translate3d(${x + 30}px,${y - 70}px,0) scale(1.05)`, opacity: 0 }],
      { duration: 650, easing: 'cubic-bezier(.2,.8,.3,1)' });
    a.onfinish = () => { p._busy = false; p.style.opacity = '0'; };
  }
  // the golden ring: it waits ahead of my dragon and comes closer with every beat
  let ringEl = null;
  function showRing(f) {
    hideRing();
    const layer = $('drx-fx');
    if (!layer || !geo) return;
    ringEl = el('div', 'drx-ring');
    ringEl.appendChild(S().ring());
    layer.appendChild(ringEl);
    const upd = () => {
      if (!ringEl || flight !== f || f.ringHit) return;
      const ahead = Math.max(0, (f.ring - f.beats)) * f.beatM * C.PX * 1.4;
      const x = geo.W * sky.anchor + geo.myW * 0.32 + ahead;
      // centred on my dragon's body (not its rider): the rivals' lanes above stay clear
      ringEl.style.transform = `translate3d(${x.toFixed(0)}px,${(geo.myY + geo.myW * 0.27).toFixed(0)}px,0)`;
      ringEl.style.setProperty('--rh', (geo.myW * 0.72).toFixed(0) + 'px');
      requestAnimationFrame(upd);
    };
    upd();
  }
  function ringHit() {
    if (ringEl) { ringEl.classList.add('hit'); const r = ringEl; ringEl = null; setTimeout(() => r.remove(), 600); }
    play('gold', 1.25, 0.7);
    buzz([20, 20, 40]);
    chip('ring', '¡Anillo dorado!', '¡Metros extra!');
    if (Math.random() < 0.5) gang('latifa', line('latifa'));
  }
  function hideRing() { if (ringEl) { ringEl.remove(); ringEl = null; } }
  function bindTap() {
    const t = $('drx-tap');
    if (!t || t._bound) return;
    t._bound = true;
    // a swipe up = one beat as soon as the finger has gone up 22 px; a tap (little movement) = one beat on release
    let y0 = 0, beatThis = false, down = false, maxUp = 0;
    t.addEventListener('pointerdown', (e) => {
      if (e.pointerType && e.pointerType !== 'mouse' && e.cancelable) e.preventDefault();
      down = true; beatThis = false; y0 = e.clientY; maxUp = 0;
      try { t.setPointerCapture(e.pointerId); } catch (_) {}
    });
    t.addEventListener('pointermove', (e) => {
      if (!down) return;
      const up = y0 - e.clientY;
      maxUp = Math.max(maxUp, up);
      if (!beatThis && up >= 22) { beatThis = true; beat(); }
      if (beatThis && maxUp - up >= 30) { beatThis = false; y0 = e.clientY; maxUp = 0; }   // back down: the next stroke
    });
    const release = () => { if (!down) return; down = false; if (!beatThis && maxUp < 22) beat(); };
    t.addEventListener('pointerup', release);
    t.addEventListener('pointercancel', () => { down = false; });
    t.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // ---------- the gang talks (one at a time, ≥ 2.5 s apart, never over the tiles) ----------
  // the one who talks, in a talking or cheering pose (art batch 2026-10-17; cast.js rotates the variants)
  const GANG_ART = (id) => (id === 'dralingo' || !CAST() ? (id === 'dralingo' ? '/assets/halcon/cast/dralingo-victory.webp' : H + 'cast/' + id + '-victory.webp')
    : CAST().pose(id, Math.random() < 0.5 ? 'talk' : 'cheer'));
  const line = (id) => (CAST() ? CAST().line(id, 'vuelo') : '');
  let gangAt = 0, gangT = null;
  function gang(id, text) {
    if (!text || !on || bigOn || (flight && flight.open)) return;   // (the flight is the moment: nobody talks over it)
    const now = performance.now();
    if (now - gangAt < 2500) return;
    gangAt = now;
    const b = $('drx-gang');
    if (!b) return;
    b.innerHTML = '';
    const im = el('img'); im.src = GANG_ART(id); im.alt = CAST() ? CAST().name(id) : '';
    const bub = el('div', 'bub');
    bub.append(el('b', null, CAST() ? CAST().name(id) : ''), el('span', null, text));
    b.append(im, bub);
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(gangT);
    gangT = setTimeout(() => { if (!testHold) b.classList.remove('show'); }, 2600);
  }
  // a small chip next to my dragon: overtakes, the ring, the tailwind
  let chipT = null;
  function chip(kind, head, sub) {
    const c = $('drx-chip');
    if (!c) return;
    c.className = 'drx-chip ' + kind;
    c.textContent = '';
    c.append(el('b', null, head));
    if (sub) c.append(el('span', null, sub));
    void c.offsetWidth;
    c.classList.add('show');
    clearTimeout(chipT);
    chipT = setTimeout(() => { if (!testHold) c.classList.remove('show'); }, 1900);
  }
  let tailShown = false;
  function tailChip(v) {
    if (v && !tailShown && g && g.phase === 'play') {
      chip('tail', '¡Viento a favor!', 'Cada aleteo vale más');
      gang('adric', line('adric'));
    }
    tailShown = v;
  }

  // ---------- the star sprint ----------
  let sprint = null;             // { n, lm, until (perf), total }
  function sprintUI(sp) {
    const box = $('drx-sprint');
    if (!box) return;
    sprint = sp;
    document.body.classList.toggle('drx-sprinting', !!sp);
    if (!sp) { box.classList.add('hidden'); box.innerHTML = ''; geoSoon(); return; }
    box.classList.remove('hidden');
    box.innerHTML = '';
    const head = el('div', 'spr-head');
    const im = el('img', 'spr-lm'); im.src = S().lmArt(sp.lm); im.alt = '';
    const tt = el('div', 'spr-t');
    tt.append(el('b', null, `¡Carrera al ${lmName(sp.lm)}!`), el('span', null, 'Quien más vuele se lleva la estrella'));
    const clock = el('div', 'spr-clock'); clock.id = 'drx-spr-clock';
    const dral = el('div', 'spr-dral fly');
    dral.appendChild(S().starFly());
    head.append(im, tt, clock, dral);
    const bars = el('div', 'spr-bars');
    bars.id = 'drx-spr-bars';
    Object.values(seats).sort((a, b) => a.c - b.c).forEach((s) => {
      const r = el('div', 'spr-bar' + (s.k === meK ? ' me' : ''));
      r.dataset.k = s.k;
      r.style.setProperty('--pc', S().colorOf(s.c).c);
      r.append(el('b', null, s.k === meK ? 'TÚ' : s.name), el('i'), el('span', null, '0 m'));
      bars.appendChild(r);
    });
    box.append(head, bars);
    paintSprint();
    paintSprintClock();
    geoSoon();
  }
  function paintSprint() {
    const bars = $('drx-spr-bars');
    if (!bars || !sprint) return;
    const vals = {};
    Object.values(seats).forEach((s) => { vals[s.k] = s.sp || 0; });
    if (flight && seats[meK]) vals[meK] = Math.max(vals[meK], (seats[meK].sp || 0));
    const top = Math.max(30, ...Object.values(vals));
    const lead = Math.max(...Object.values(vals));
    bars.querySelectorAll('.spr-bar').forEach((r) => {
      const v = vals[r.dataset.k] || 0;
      r.querySelector('i').style.transform = `scaleX(${(v / top).toFixed(3)})`;
      r.querySelector('span').textContent = fmt(v) + ' m';
      r.classList.toggle('top', v > 0 && v === lead);
    });
  }
  function paintSprintClock() {
    const c = $('drx-spr-clock');
    if (!c || !sprint) return;
    const left = g && g.paused ? sprint.left : Math.max(0, sprint.until - performance.now());
    c.textContent = String(Math.ceil(left / 1000));
  }
  function onSprint(d) {
    if (!on || !g) return;
    if (d.go) {
      Object.values(seats).forEach((s) => { s.sp = 0; });
      sprintUI({ n: d.n, lm: d.lm, until: performance.now() + (d.ms || 12000), total: d.ms || 12000 });
      // the sprint panel itself is the announcement (a banner under it said the same thing twice)
      sfx(K + 'landmark.mp3', 0.55);
      buzz([30, 40, 30]);
      gang('hamdan', `¡Yalla! ¡Al ${lmName(d.lm)}!`);
      return;
    }
    const mine = (d.races || []).find((x) => x.b === raceId);
    sprintUI(null);
    if (!mine) return;
    (mine.w || []).forEach((k) => { if (seats[k]) { seats[k].st = (seats[k].st || 0) + 1; if (mine.m && mine.m[k] != null) { if (k !== meK || !flight) seats[k].m = mine.m[k]; else flight.base += d.star || 150; } } });
    paintHud();
    if ((mine.w || []).includes(meK)) bigStar(d);
    else if ((mine.w || []).length) {
      const names = listY(mine.w.map(seatName));
      banner('star', [bold(`¡Estrella para ${names}!`), span(`Ganó la carrera al ${lmName(d.lm)}: +${d.star || 150} m`)], 'star', 2300);
      sfx(MN + 'star.mp3', 0.45);
    } else banner('star', [bold('Nadie voló en la carrera'), span('La estrella espera la próxima')], 'star', 1800);
  }
  // the one big moment: «¡ESTRELLA!» (Dralingo hands me the star, my dragon dashes)
  let bigOn = false;
  function bigStar(d) {
    const big = $('drx-big');
    if (!big) return;
    bigOn = true;
    holdQ(true);
    big.innerHTML = '';
    big.className = 'drx-big star';
    const card = el('div', 'drb-card');
    const st = el('div', 'drb-star');
    st.appendChild(S().star());
    const im = S().starFly('drb-dral');
    card.append(st, im, el('h2', null, '¡ESTRELLA!'), el('p', null, `Ganaste la carrera al ${lmName(d.lm)} · +${d.star || 150} m`));
    big.appendChild(card);
    play('star', 1, 0.9);
    buzz([40, 30, 40, 30, 140]);
    const me = seats[meK];
    if (me) { me.el.pose('ok', 2600); me.el.beat(true); }
    later(2200, () => { if (!testHold) { big.classList.add('hidden'); bigOn = false; if (!(g && g.paused)) holdQ(false); } });
    later(400, () => gang('dralingo', line('dralingo')));
  }

  // ---------- banners at the top edge (one at a time) ----------
  let bannerQ = [], bannerOn = false;
  const bold = (t) => el('b', null, t);
  const span = (t) => el('span', null, t);
  function banner(kind, parts, img, ms) {
    bannerQ.push({ kind, parts, img, ms: ms || 2300, at: performance.now() });
    if (bannerQ.length > 3) bannerQ.splice(0, bannerQ.length - 3);
    if (!bannerOn) nextBanner();
  }
  let bannerWaitT = null;
  function nextBanner() {
    const b = $('drx-banner');
    clearTimeout(bannerWaitT);
    if (b && bannerQ.length && document.body.classList.contains('drx-flying')) {
      bannerOn = true;
      document.body.classList.remove('drx-bannering');
      bannerWaitT = setTimeout(nextBanner, 250);
      return;
    }
    while (bannerQ.length && performance.now() - (bannerQ[0].at || 0) > 7000) bannerQ.shift();
    const it = bannerQ.shift();
    if (!b || !it) { bannerOn = false; document.body.classList.remove('drx-bannering'); return; }
    bannerOn = true;
    document.body.classList.add('drx-bannering');   // one headline at a time: the flight's title steps aside
    b.className = 'drx-banner ' + it.kind;
    b.innerHTML = '';
    if (it.img === 'star') b.appendChild(S().star());
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
    const box = $('drx-pause');
    if (box) box.classList.toggle('hidden', !v);
    if (v === paused) return;
    paused = v;
    holdQ(v);
    holdFlight(v);
    if (cur && !cur.tapped && !cur.done) setTiles(!v);
    if (sprint) {
      if (v) sprint.left = Math.max(0, sprint.until - performance.now());
      else if (sprint.left != null) sprint.until = performance.now() + sprint.left;
    }
  }

  // ---------- the countdown run-in and the rules card ----------
  function showRunIn() {
    const box = $('drx-intro');
    if (!box || !S()) return;
    clearTimers(introTimers);
    box.className = 'drx-intro runin';
    box.innerHTML = '';
    box.appendChild(el('div', 'dri-title', '¡Tu carrera!'));
    const list = Object.values(seats).sort((a, b) => a.c - b.c);
    const rivals = list.filter((s) => s.k !== meK).length;
    box.appendChild(el('p', 'dri-sub', rivals ? `Vuelas contra ${rivals} ${rivals === 1 ? 'rival' : 'rivales'} sobre Dubái` : '¡Vuela sobre Dubái!'));
    const st = el('div', 'dri-stage');
    const crew = el('div', 'dri-crew');
    list.forEach((s, i) => {
      const f = S().flyer({ skin: s.skin, c: s.c, name: s.k === meK ? (myName() || s.name) : s.name, me: s.k === meK });
      f.classList.add('dri-fly');
      f.style.setProperty('--i', i);
      f.style.setProperty('--odd', i % 2);
      crew.appendChild(f);
    });
    const host = el('div', 'dri-host fly');
    host.appendChild(S().starFly());
    st.append(crew, host);
    box.appendChild(st);
    const cap = el('p', 'dri-cap');
    cap.append('Dralingo espera con la ', bold('estrella'), ' en los monumentos');
    box.appendChild(cap);
    sfx(K + 'whoosh.mp3', 0.6);
    later(900, () => sfx(H + 'round.mp3', 0.45), introTimers);
  }
  function rulesPic() {
    const pic = el('div', 'dri-pic');
    const f = S().flyer({ skin: mySkin(), c: seats[meK] ? seats[meK].c : 1, name: '', tag: false });
    f.classList.add('dri-rulefly');
    pic.append(f, el('i', 'drx-hand up'), el('i', 'dri-arrow'));
    return pic;
  }
  function showRules(ms) {
    const box = $('drx-intro');
    if (!box || !S()) return;
    clearTimers(introTimers);
    box.className = 'drx-intro rules';
    box.innerHTML = '';
    const c = el('div', 'dri-card');
    c.append(rulesPic(), el('h2', null, '¡Responde y aletea!'), el('p', null, 'Cada respuesta correcta es un vuelo: desliza hacia arriba (o toca) y cada aleteo te adelanta. ¡Cruza los anillos dorados!'));
    const say = el('div', 'dri-say');
    box.append(c, say);
    const total = Math.max(1400, ms || 2800);
    later(total - 1250, () => { say.textContent = '¿Listos?'; sfx(K + 'tick.mp3', 0.7); }, introTimers);
    later(total - 600, () => { box.classList.add('go'); say.textContent = '¡YA!'; sfx(H + 'start.mp3', 0.8); buzz(30); }, introTimers);
    later(total + 400, () => { if (!testHold) hideIntro(); }, introTimers);
    later(Math.max(0, total - 2400), () => gang('fer', line('fer')), introTimers);
  }
  function hideIntro() {
    const box = $('drx-intro');
    if (box && !testHold) { clearTimers(introTimers); box.className = 'drx-intro hidden'; box.innerHTML = ''; }
  }

  // ---------- events ----------
  let frozen = false, queue = [];
  const handlers = {};
  function init(c) {
    ctx = c;
    const sock = c.socket;
    if (skin() && skin().holdWhen) skin().holdWhen(() => on && !!(g && g.paused));
    const s = { on: (ev, fn) => { handlers[ev] = fn; sock.on(ev, (d) => { if (frozen && (ev.indexOf('dr:') === 0 || ev === 'question' || ev === 'answer-result' || ev === 'game-end')) { queue.push([fn, d, ev]); return; } fn(d); }); } };
    s.on('state', (st) => {
      if (!st) return;
      if (st.gameType) setOn(st.gameType === 'dragon-eye');
      if (!on) return;
      roster = Object.values(st.players || {}).map((p) => ({ name: p.name, avatar: p.avatar, sk: p.sk, k: p.k, off: !!p.off }));
      const meP = st.players && sock.id && st.players[sock.id];
      if (meP && meP.sk) mySk = meP.sk;
      // who is online in my race (a kid who left stays in the race, greyed)
      roster.forEach((p) => { if (p.k != null && seats[p.k] && seats[p.k].on !== !p.off) { seats[p.k].on = !p.off; seats[p.k].el.off(p.off); paintHud(); } });
      if (st.state === 'lobby') { teardown(true); g = null; paintLobbyKid(); }
      if (st.state === 'active') setTimeout(() => {
        const q = $('screen-question');
        if (on && q && !q.classList.contains('hidden') && sky) raceUp(true);
      }, 0);
    });
    s.on('countdown', () => {
      if (!on) return;
      teardown(true);
      g = null;
      audioReady();
      const box = $('drx-intro');
      if (box) { box.className = 'drx-intro runin'; box.innerHTML = ''; box.appendChild(el('div', 'dri-title', '¡Preparando las carreras!')); }
    });
    s.on('dr:init', (d) => applyInit(d));
    s.on('dr:seat', (d) => {
      if (!on || !sky || !d || !d.race || d.race.id !== raceId) return;
      (d.race.seats || []).forEach((x) => { if (!seats[x.k]) { addSeat(x); chip('join', `${x.name} vuela contigo`, '¡Un rival más!'); } });
      paintHud();
      geoNow();
    });
    s.on('dr:intro', (d) => { if (!on || !g) return; g.phase = 'intro'; showRules(d && d.ms); });
    s.on('dr:play', (d) => {
      if (!on || !g) return;
      g.phase = 'play';
      g.endAt = performance.now() + (d.endsMs || 0);
      g.playAt = performance.now();
      hideIntro();
      raceUp(true);
      runClock();
      geoNow();
      ctx.markActivity();
    });
    s.on('question', (q) => { if (on && q && !q.ss) showQuestion(q); });
    s.on('answer-result', (r) => { if (on && r && r.dragon) onResult(r); });
    s.on('answer-stale', (d) => {
      if (!on || !cur || cur.done) return;
      if (d && d.reason === 'paused') {
        cur.tapped = false;
        document.querySelectorAll('.drq-a').forEach((b) => b.classList.remove('picked'));
        $('drq-verdict').className = 'drq-verdict';
        clearTimeout(rescueT);
      }
    });
    s.on('dr:flown', (f) => { if (on && f) onFlown(f); });
    s.on('dr:race', (d) => { if (on && d && (!g || d.id === g.id)) { applyLine(d); ctx.markActivity(); } });
    s.on('dr:sprint', (d) => { if (on && d && (!g || d.id === g.id)) onSprint(d); });
    s.on('dr:lead', (l) => {
      if (!on || !l || l.b !== raceId) return;
      myLead = l.k;
      paintHud();
      const mine = l.k === meK;
      const name = seatName(l.k);
      banner('lead', [bold(mine ? (l.first ? '¡Tomas la delantera!' : '¡Vuelves a ir primero!') : (l.first ? `¡${name} toma la delantera!` : `¡${name} pasa al primer lugar!`)),
        span(mine ? '¡No dejes de aletear!' : 'Responde bien y aletea: ¡alcánzalo!')], 'star', 2300);
      sfx(K + (mine ? 'flag.mp3' : 'castle-alert.mp3'), 0.5);
      buzz(mine ? [30, 40, 30] : [60, 40, 60]);
    });
    s.on('dr:frenzy', (d) => {
      if (!on || !g) return;
      g.frenzy = true;
      $('drx').classList.add('frenzy');
      if (sky) sky.frenzy(true);
      g.endAt = performance.now() + (d.endsMs || 30000);
      banner('frenzy', [bold('¡Últimos 30 segundos!'), span('¡ALAS DOBLES! Cada aleteo vale el doble')], 'star', 2600);
      sfx(K + 'siege.mp3', 0.6);
      buzz([50, 40, 50, 40, 80]);
      if (skin() && skin().music) skin().music('music-final', 0.4);
      gang('fer', '¡Últimos segundos: a volar!');
    });
    s.on('dr:time', (d) => {
      if (!on || !g) return;
      g.endAt = performance.now() + (d.endsMs || 0);
      if (g.paused) g.pausedLeft = d.endsMs || g.pausedLeft;
      banner('lead', [bold(d.add < 0 ? `${-d.add} segundos menos` : `+${d.add || 30} segundos más`)], null, 1600);
    });
    s.on('dr:pause', (d) => {
      if (!on || !g) return;
      g.paused = !!d.paused;
      if (g.paused) g.pausedLeft = Math.max(0, g.endAt - performance.now());
      else if (d.endsMs != null) g.endAt = performance.now() + d.endsMs;
      if (!g.paused && g.playAt) g.playAt += 0;   // (the night keeps its own pace)
      pauseUI(g.paused);
      if (sprint && d.sprint && !g.paused) sprint.until = performance.now() + d.sprint.ms;
      if (skin() && skin().hold) skin().hold(g.paused);
      if (g.phase === 'intro') { if (g.paused) clearTimers(introTimers); else showRules(d.phaseMs); }
      ctx.markActivity();
    });
    s.on('dr:final', () => {
      if (!on) return;
      ctx.markActivity();
      clearTimeout(rescueT);
      stopQTimer();
      setTiles(false);
      cur = null; pendingQ = null;
      if (flight && flight.open) flyEnd(flight);
      else if (flight) endFlight(true);
      later(700, hideFly);
      sheet(false);
      hideIntro();
      bannerQ = [];
      if ($('drx-banner')) $('drx-banner').classList.remove('show');
      if (g) { g.phase = 'final'; g.paused = false; }
      pauseUI(false);
      sprintUI(null);
      const f = $('drx-final');
      if (f) f.classList.remove('hidden');
      sfx('/assets/party/final-v2.mp3', 0.85);
      buzz([40, 30, 40]);
      if (skin() && skin().music) skin().music(null);
      if (sky) sky.frenzy(false);
    });
    s.on('dr:skip', () => { if (on) jumpToCard(); });
    s.on('game-end', () => {
      if (!on) return;
      gen++;
      hideOverlays();
      document.body.classList.remove('drx-play', 'drx-flying');
      clearTimers(); stopQTimer(); clearInterval(clockT); clearTimeout(rescueT);
      endFlight(true);
      cur = null; pendingQ = null;
      testHold = false;
      hideIntro();
      pauseUI(false);
      sprintUI(null);
      stopLoop();
      if (sky) sky.frenzy(false);
    });
    window.addEventListener('resize', () => { if (on && sky) geoNow(); });
    document.addEventListener('keydown', (e) => {
      if (!on || e.repeat) return;
      if (flight && flight.open && (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter')) { e.preventDefault(); beat(); }
    });
  }
  function applyInit(d) {
    setOn(true);
    ctx.markActivity();
    bindTap();
    const fresh = !g || g.id !== d.id;
    if (fresh && (g || sky)) teardown(true);           // (a phone that slept through «Otra ronda»: no old race left over)
    if (fresh) document.body.classList.remove('drx-ended');
    g = { id: d.id, phase: d.phase, frenzy: !!d.frenzy, paused: !!d.paused, endAt: d.endsMs != null ? performance.now() + d.endsMs : 0, pausedLeft: d.endsMs || 0,
      dur: d.duration || 240, playAt: performance.now() - (d.played || 0) };
    $('drx').classList.toggle('frenzy', g.frenzy);
    if (!d.race || !d.you) return;
    S().preload((d.race.seats || []).map((x) => x.c), (d.race.seats || []).map((x) => x.skin));
    ensureRace(d.race, d.you.k);
    if (seats[meK] && d.you.m != null) seats[meK].m = d.you.m;
    if (sky) sky.frenzy(g.frenzy);
    pauseUI(g.paused);
    runClock();
    if (d.sprint) sprintUI({ n: d.sprint.n, lm: d.sprint.lm, until: performance.now() + d.sprint.ms, total: d.sprint.total, left: d.sprint.ms });
    else if (sprint) sprintUI(null);
    if (d.phase === 'countdown') { showRunIn(); return; }
    if (d.phase === 'intro') { if (fresh || !$('drx-intro').classList.contains('rules')) showRules(d.phaseMs); return; }
    hideIntro();
    raceUp(true);
    // a reload in the middle of a flight: it comes back with the time really left
    if (d.you.flight && d.phase !== 'done') {
      if (!(flight && flight.mid === d.you.flight.mid)) openFlight(d.you.flight);
    } else if (flight) endFlight();
    else if (!cur) sheet(false);
    const fin = $('drx-final');
    if (fin) fin.classList.toggle('hidden', d.phase !== 'final');
    later(60, geoNow);
  }

  // ---------- lobby: who I am + «Así se juega» ----------
  function lobby(head) {
    let box = $('drx-how');
    if (!head) { if (box) box.remove(); return; }
    if (!S()) return;
    if (!box) {
      box = el('div', 'drx-how');
      box.id = 'drx-how';
      box.innerHTML = '<div class="drh-you"><div id="drh-kid"></div><div><b>¡Vuelas en una carrera!</b><span>Tú y tus rivales (de 3 a 5 por carrera), cada uno en su dragoncito</span></div></div>'
        + '<ol>'
        + '<li><div class="drh-step"><div class="drh-q"><i></i><i></i><i></i><i></i></div></div><span><b>Responde bien</b>cada respuesta correcta es un vuelo</span></li>'
        + '<li><div class="drh-step" id="drh-s2"></div><span><b>Desliza hacia arriba</b>cada aleteo te adelanta · ¡cruza los anillos dorados!</span></li>'
        + '<li><div class="drh-step" id="drh-s3"></div><span><b>¡Gana estrellas!</b>Dralingo las da en los monumentos</span></li>'
        + '</ol>';
      head.after(box);
      const f = S().flyer({ skin: mySkin(), c: 1, name: '', tag: false, still: true });
      $('drh-s2').append(f, el('i', 'drx-hand up'));
      $('drh-s3').append(S().starFly());
    }
    paintLobbyKid();
  }
  function paintLobbyKid() {
    const kid = $('drh-kid');
    if (!kid || !S()) return;
    kid.innerHTML = '';
    kid.appendChild(S().figure({ skin: mySkin(), c: -1, name: myName() }));
  }

  // ---------- the end: my race's ceremony, then my card ----------
  let cer = null;
  function end(data) {
    if (!S()) return;
    const box = $('screen-end');
    if (!box) return;
    clearTimers(cerTimers);
    const old = $('drx-finale');
    if (old) old.remove();
    const fin = el('div', 'drx-finale');
    fin.id = 'drx-finale';
    box.appendChild(fin);
    document.body.classList.add('drx-ended');
    bannerQ = []; bannerOn = false; document.body.classList.remove('drx-bannering');
    if ($('drx-banner')) $('drx-banner').classList.remove('show');
    const f = $('drx-final');
    if (f) f.classList.add('hidden');
    cer = { data, fin };
    const sk = el('button', 'drf-skip', 'Ver mi tarjeta');
    sk.type = 'button';
    sk.addEventListener('click', jumpToCard);
    fin.appendChild(sk);
    if (!g) { stage('card'); return; }      // a phone that reloaded after the end goes straight to its card
    const bonus = ((data && data.dragon && data.dragon.race && data.dragon.race.bonus) || []);
    const plan = [['line', 1700]].concat(bonus.map((s, i) => ['b' + i, 2100])).concat([['drum', 1300], ['win', 3600]]);
    let t = 0;
    plan.forEach(([name, ms]) => { later(t, () => stage(name), cerTimers); t += ms; });
    later(t, () => stage('card'), cerTimers);
  }
  function jumpToCard() { if (!cer) return; clearTimers(cerTimers); stage('card'); }
  function stageBox(cls) {
    const old = cer.fin.querySelector('.drf-stage');
    if (old) old.remove();
    const s = el('div', 'drf-stage ' + cls);
    cer.fin.prepend(s);
    return s;
  }
  function confetti(host, c, n) {
    if (reduced()) return;
    const col = S().colorOf(c);
    const cols = [col.c, col.s, '#ffc93c', '#fff7e3'];
    for (let i = 0; i < (n || 26); i++) {
      const x = el('i', 'ds-confetti');
      x.style.setProperty('--x', (4 + Math.random() * 92) + '%');
      x.style.setProperty('--d', (Math.random() * 0.8).toFixed(2) + 's');
      x.style.setProperty('--r', Math.round(Math.random() * 360) + 'deg');
      x.style.setProperty('--dx', Math.round((Math.random() - 0.5) * 120) + 'px');
      x.style.background = cols[i % cols.length];
      host.appendChild(x);
      setTimeout(() => x.remove(), 3600);
    }
  }
  function bonusValue(st) {
    if (st.id === 'sabia') return `${st.value} ${st.value === 1 ? 'acierto' : 'aciertos'}`;
    if (st.id === 'racha') return `${st.value} seguidas`;
    if (st.id === 'remontada') return `${fmt(st.value)} m desde el último lugar`;
    return String(st.value);
  }
  function stage(name) {
    if (!cer) return;
    cer.stage = name;
    const d = cer.data || {}, dr = d.dragon || {}, meD = d.me || {};
    const rc = dr.race || { rows: [], bonus: [], winners: [] };
    const bonusM = dr.bonusM || 200;
    const byK = {};
    (rc.rows || []).forEach((r) => { byK[r.k] = r; });
    const nm = (r) => (r.k === meD.k ? (myName() || r.name) : r.name);
    const sorted = (rc.rows || []).slice().sort((a, b) => a.c - b.c);
    const totalAt = (r, upTo) => r.flown + (rc.bonus || []).slice(0, upTo).filter((x) => (x.winners || []).includes(r.k)).length * bonusM;
    // my race as a finish strip: one lane per dragon (seat order), the bar as long as its metres, the flyer at its end
    function strip(upTo, hi, poses) {
      const box = el('div', 'drf-strip' + (sorted.length > 4 ? ' five' : ''));
      const max = Math.max(1, ...sorted.map((r) => totalAt(r, (rc.bonus || []).length)));
      sorted.forEach((r, i) => {
        const isHi = hi && hi.includes(r.k);
        const lane = el('div', 'drf-lane' + (isHi ? ' hi' : '') + (r.k === meD.k ? ' me' : ''));
        lane.style.setProperty('--pc', S().colorOf(r.c).c);
        lane.style.setProperty('--i', i);
        const tot = totalAt(r, upTo);
        const k = Math.max(0.04, tot / max);
        lane.style.setProperty('--k', k.toFixed(3));
        const bar = el('i', 'drf-bar');
        const f = S().flyer({ skin: r.skin, c: r.c, name: nm(r), me: r.k === meD.k, still: true, tag: false });
        f.classList.add('drf-fly');
        f.pose((poses && poses[r.k]) || (isHi ? 'ok' : 'idle'));
        const lab = el('div', 'drf-lab');
        const num = el('b', null, fmt(tot));
        lab.append(el('span', 'drf-nm', r.k === meD.k ? 'TÚ' : r.name), num, el('small', null, 'm'));
        if (isHi) { const s = el('em', 'drf-plus'); s.append(S().star(), document.createTextNode('+' + bonusM)); lab.appendChild(s); S().countUp(num, tot - bonusM, tot, 700); }
        lane.append(bar, f, lab);
        box.appendChild(lane);
      });
      return box;
    }
    if (name === 'line') {
      const s = stageBox('line');
      s.appendChild(el('h2', 'drf-h big', '¡Así llegó tu carrera!'));
      s.appendChild(el('p', 'drf-p', 'Ahora, tres estrellas bonus de +' + bonusM + '\u00a0m… ¡pueden cambiar quién gana!'));
      s.appendChild(strip(0, null));
      sfx(MO + 'drum.mp3', 0.55);
      return;
    }
    if (/^b\d+$/.test(name)) {
      const i = Number(name.slice(1));
      const st = (rc.bonus || [])[i];
      if (!st) return;
      const mine = (st.winners || []).includes(meD.k);
      const s = stageBox('star' + (mine ? ' mine' : ''));
      const head = el('div', 'drf-sthead');
      head.appendChild(S().star('drf-badge'));
      const ht = el('div');
      const who = (st.winners || []).map((k) => (k === meD.k ? 'Tú' : (byK[k] && byK[k].name) || '')).filter(Boolean);
      ht.append(el('h2', 'drf-h', st.name), el('p', 'drf-p', (who.length ? listY(who) + ' · ' : '') + bonusValue(st)), el('p', 'drf-p soft', 'para ' + st.what));
      head.appendChild(ht);
      s.appendChild(head);
      s.appendChild(strip(i + 1, st.winners || []));
      if (mine) { s.appendChild(el('div', 'drf-mine', '¡ES PARA TI!')); buzz([40, 30, 40, 30, 120]); }
      sfx(MN + 'star.mp3', mine ? 0.9 : 0.55);
      return;
    }
    if (name === 'drum') {
      const s = stageBox('drum');
      s.appendChild(el('h2', 'drf-h big', '¿Quién gana tu carrera?'));
      s.appendChild(el('p', 'drf-p', 'Más metros gana. Si empatan: más estrellas'));
      s.appendChild(strip((rc.bonus || []).length, null));
      sfx(MO + 'drum.mp3', 0.75);
      return;
    }
    if (name === 'win') {
      const s = stageBox('win');
      const winners = rc.winners || [];
      const iWon = winners.includes(meD.k);
      const wNames = winners.map((k) => (k === meD.k ? 'tú' : (byK[k] && byK[k].name) || '')).filter(Boolean);
      s.appendChild(el('h2', 'drf-h big', !winners.length ? '¡Buena carrera!' : iWon ? (winners.length > 1 ? '¡Empate! ¡Ganas tú también!' : '¡Ganaste tu carrera!') : `¡Gana ${listY(wNames)}!`));
      const poses = {};
      sorted.forEach((r) => { poses[r.k] = winners.includes(r.k) ? 'ok' : 'no'; });
      const champ = el('div', 'drf-champ' + (winners.length > 1 ? ' two' : ''));
      winners.slice(0, 2).forEach((k) => {
        const r = byK[k];
        if (!r) return;
        const c = el('div', 'drf-champ-k');
        const f = S().flyer({ skin: r.skin, c: r.c, name: nm(r), me: r.k === meD.k, still: true, tag: false });
        f.pose('ok');
        c.appendChild(f);
        const tot = el('div', 'drf-tot');
        tot.append(el('em', 'drf-crown', '1º'), el('b', null, fmt(r.total) + ' m'));
        if (r.stars) { const st = el('span'); st.append(S().star(), document.createTextNode(String(r.stars))); tot.appendChild(st); }
        c.appendChild(tot);
        champ.appendChild(c);
      });
      s.appendChild(champ);
      // the rest of the race in finishing order, each with its place (the line stages keep the seat order)
      const rest = sorted.filter((r) => !winners.includes(r.k)).sort((a, b) => (a.rank || 9) - (b.rank || 9));
      if (rest.length) {
        const row = el('div', 'drf-rest');
        rest.forEach((r, i) => {
          const col = el('div', 'drf-col' + (r.k === meD.k ? ' me' : ''));
          col.style.setProperty('--i', i);
          const fg = S().figure({ skin: r.skin, c: r.c, name: nm(r), me: r.k === meD.k, pose: 'no', tag: true });
          const m = el('b', 'drf-m');
          if (r.rank) m.appendChild(el('em', null, r.rank + 'º'));
          m.append(fmt(r.total) + ' m');
          col.append(fg, m);
          row.appendChild(col);
        });
        s.appendChild(row);
      }
      const conf = el('div', 'drf-conf');
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
      const sk = cer.fin.querySelector('.drf-skip');
      if (sk) sk.remove();
      const c = el('div', 'drk-card');
      const won = !!meD.won;
      const r = byK[meD.k] || { skin: mySkin(), c: meD.c || 0, name: myName(), k: meD.k };
      c.style.setProperty('--pc', S().colorOf(r.c).c);
      const top = el('div', 'drk-top');
      const f = S().flyer({ skin: r.skin, c: r.c, name: '', still: true, tag: false });
      f.pose(won ? 'ok' : (meD.total || 0) > 0 ? 'idle' : 'no');
      f.classList.add('drk-fly');
      const rank = el('div', 'drk-rank');
      rank.append(el('b', null, (meD.rank || '-') + 'º'), el('span', null, meD.of ? `de ${meD.of} en tu carrera` : 'en tu carrera'));
      top.append(f, rank);
      c.appendChild(top);
      c.appendChild(el('h2', 'drk-h', won ? '¡Ganaste tu carrera!' : (meD.total || 0) > 0 ? '¡Qué buen vuelo!' : '¡La próxima carrera es tuya!'));
      const big = el('div', 'drk-big');
      const mm = el('b', null, '0');
      big.append(mm, el('span', null, 'metros'));
      c.appendChild(big);
      S().countUp(mm, 0, meD.total || 0, 900);
      const facts = el('div', 'drk-facts');
      const fact = (n, l, ico) => { const x = el('div', 'drk-fact'); const b = el('b'); if (ico) b.appendChild(ico); b.appendChild(document.createTextNode(n)); x.append(b, el('span', null, l)); facts.appendChild(x); };
      if ((meD.stars || 0) > 0) fact(String(meD.stars), meD.stars === 1 ? 'estrella' : 'estrellas', S().star());
      if ((meD.right || 0) > 0) fact(String(meD.right), meD.right === 1 ? 'acierto' : 'aciertos');
      if ((meD.best || 0) >= 2 && facts.children.length < 3) fact(String(meD.best), 'mejor racha');
      if ((meD.rings || 0) > 0 && facts.children.length < 3) fact(String(meD.rings), meD.rings === 1 ? 'anillo dorado' : 'anillos dorados');
      if ((meD.laps || 0) > 0 && facts.children.length < 3) fact(String(meD.laps), meD.laps === 1 ? 'vuelta a Dubái' : 'vueltas a Dubái');
      if (!facts.children.length && (meD.answered || 0) > 0) fact(String(meD.answered), meD.answered === 1 ? 'pregunta jugada' : 'preguntas jugadas');
      if (facts.children.length) c.appendChild(facts);
      const mineBonus = (rc.bonus || []).filter((x) => (meD.bonus || []).includes(x.id));
      if (mineBonus.length || (meD.classRank && meD.classRank <= 3 && (meD.total || 0) > 0)) {
        const row = el('div', 'drk-stars');
        if (meD.classRank && meD.classRank <= 3 && (meD.total || 0) > 0) { const b = el('div', 'drk-star'); b.append(S().star(), el('span', null, `${meD.classRank}º de la clase`)); row.appendChild(b); }
        mineBonus.forEach((x) => { const b = el('div', 'drk-star'); b.append(S().star(), el('span', null, x.name)); row.appendChild(b); });
        c.appendChild(row);
      }
      c.appendChild(el('p', 'drk-wait', 'Quédate aquí: tu profe puede empezar otra ronda'));
      const home = el('button', 'drk-home', 'Salir del juego');
      home.type = 'button';
      home.addEventListener('click', () => { location.href = '/'; });
      c.appendChild(home);
      s.appendChild(c);
    }
  }

  window.DragonPhone = {
    init, lobby, end,
    frame: () => ({
      on, phase: g && g.phase, me: meK, race: raceId, seats: Object.fromEntries(Object.values(seats).map((s) => [s.k, { k: s.k, name: s.name, c: s.c, m: s.m, shown: Math.round(s.shown), st: s.st, fl: s.fl, on: s.on }])),
      qid: cur && cur.qid, tapped: !!(cur && cur.tapped), done: !!(cur && cur.done),
      flight: flight ? { mid: flight.mid, beats: flight.beats, sent: flight.sent, metres: flight.metres, open: flight.open, ring: flight.ring, ringHit: flight.ringHit, power: flight.power } : null,
      sprint: sprint ? { n: sprint.n, lm: sprint.lm } : null, frenzy: !!(g && g.frenzy), paused: !!(g && g.paused), stage: cer && cer.stage,
    }),
    hold: (v) => {
      testHold = !!v;
      const b = $('drx-banner');
      if (!testHold && b && b.classList.contains('show')) { b.classList.remove('show'); setTimeout(nextBanner, 260); }
    },
    freeze: (v) => { frozen = !!v; if (!frozen) { const q = queue; queue = []; q.forEach(([fn, d]) => fn(d)); } return queue.length; },
    replay: (ev) => { while (queue.length) { const [fn, d, e] = queue.shift(); fn(d); if (e === ev) break; } return queue.length; },
    queued: () => queue.map((x) => x[2]),
    stage: (name) => { if (cer) { clearTimers(cerTimers); stage(name); } },
    runIn: () => showRunIn(),
    rules: (ms) => showRules(ms),
    sim: (ev, d) => { if (handlers[ev]) handlers[ev](d); },
    answer: (i) => answer(i),
    beat: (n) => { let k = 0; for (let i = 0; i < (n || 1); i++) if (beat()) k++; return k; },
    holdFly: (v) => holdFlight(!!v),
    banner: (kind, title, sub) => banner(kind, [bold(title), span(sub || '')], 'star', 4000),
    bigStar: (lm) => bigStar({ lm: lm || 'burj', star: 150 }),
    gang: (id, text) => { gangAt = 0; gang(id, text || line(id)); },
    chip: (kind, head, sub) => chip(kind, head, sub),
    tick: (ms) => { const t = performance.now(); for (let i = 0; i < Math.ceil((ms || 1000) / 16); i++) frameAt(t + i * 16, 0.016); },
    sky: () => sky,
  };
})();
