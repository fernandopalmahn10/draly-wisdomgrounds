// Dragones Pintores v2 «El Cielo de las Maravillas» — the kid's phone (the product). player.js calls PaintPhone.init(…)
// once; the shared phone skin (player-kingdoms-skin.js) gives the lobby look, the captains under the 3-2-1, the music,
// the pause card, «¡FINAL!» and the Mario Party ending. This module, only while the room's game is 'paint':
//   · THE SKY of the round's world (js/paint-render.js): the background in parallax, the three landmark islands with
//     their capture rings (dragons hovering in a ring circle it), the clouds, every dragon; mine big, on top, with a
//     pulsing ring and «TÚ»; the camera keeps me well inside the screen
//   · TAP (or drag a finger) on the sky = where my dragon flies: it flies there at once (predicted here at the server's
//     own speed), the tap goes to the server as an intent (player:pc-go), the server flies the real dragon and judges
//     every cloud it paints; my phone shows its predicted paint at once and takes the server's colour back if it differs
//   · the HUD: Fuego vs Mar (points + islands held), my fire, my clouds, the clock, «Sonido»; a pointer at the screen's
//     edge for every island out of view (tap it to fly there); the big «🔥 Recargar» button
//   · the QUESTION as a sheet over the bottom of the sky (the sky stays alive above it): picture, prompt, four big tiles,
//     a 20 s clock; it rises by itself when my fire runs out
//   · moments in one slim pill above the fire button (never over my dragon): my kingdom's captures, islands lost, lead
//     changes with my captain's line, «Viento a favor»; inside an island's ring, «¡Quédate! Conquistando …»
// Test hooks: PaintPhone.debug(), .advance(sec), .tapWorld(x, y), .answer(i), .moment(m), .help(v), .hand(v), .intro(),
//             .frame(), .scene().
(function () {
  'use strict';
  const PW = () => window.PaintWorlds;
  const PR = () => window.PaintRender;
  const $ = (id) => document.getElementById(id);
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const skin = () => window.KingdomsSkin;
  const CAST = () => window.DralingoCast;
  const K = '/assets/kingdoms/', MO = '/assets/mochi/', MN = '/assets/monopoly/';
  const sfx = (path, vol) => { const s = skin(); if (s && s.sfx) s.sfx(path, vol); };
  const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (_) {} };
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const NAMES = { red: 'Reino del Fuego', gold: 'Reino del Mar' };
  const SHORT = { red: 'Fuego', gold: 'Mar' };
  const other = (t) => (t === 'red' ? 'gold' : 'red');
  const code = (t) => (t === 'red' ? 1 : 2);
  const MARGIN = 34;
  const ARM_MS = 500;                     // a tile answers only once the sheet has been up this long (no double-tap guess)

  let ctx = null, on = false;
  let scene = null, sky = null, world = null, roundId = null;
  let myK = null, me = null;             // me: { x, y, tx, ty, fire, blazeUntil, moving }
  let fireMax = 30, speed = [300, 360], brush = [22, 60];
  let serverOwn = [], predicted = {};    // cloud → when my phone painted it ahead of the server
  let flipSeen = {};                     // cloud → when the server last changed its colour (its 1.5 s cooldown)
  let scores = { red: 0, gold: 0 }, clouds = { red: 0, gold: 0 }, lm = [], mine = 0;
  let paused = false, pausedAt = 0, finalOn = false, captains = null, endsAt = 0, pausedLeft = 0, frenzy = false;
  let skew = null;                       // the server's clock − mine (from pc:pos), so a phone with a wrong clock reads the time right
  let raf = 0, lastT = 0, lastGo = 0, goTimer = null, pendingGo = null;
  let worldPick = 0;                      // the lobby's world (pc:world / state.pcWorld) before the round starts

  // ---------- quick sounds (Web Audio: the paint pops land on time) ----------
  let actx = null, loading = false;
  const bufs = {};
  const BUF = { pop: MO + 'pop.mp3', gold: MO + 'gold.mp3', tick: K + 'tick.mp3', star: MN + 'star.mp3', whoosh: K + 'whoosh.mp3', flag: K + 'flag.mp3' };
  function audioReady() {
    if (actx) { if (actx.state === 'suspended') actx.resume().catch(() => {}); return; }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      actx = new Ctx();
      if (!loading) {
        loading = true;
        Object.entries(BUF).forEach(([k, f]) => { fetch(f).then((r) => r.arrayBuffer()).then((b) => actx.decodeAudioData(b)).then((buf) => { bufs[k] = buf; }).catch(() => {}); });
      }
    } catch (_) {}
  }
  const muted = () => { const s = skin(); return !!(s && s.isMuted && s.isMuted()); };
  let lastPop = 0;
  function play(name, rate, vol) {
    if (muted() || !actx || !bufs[name]) return;
    try {
      const src = actx.createBufferSource();
      src.buffer = bufs[name];
      src.playbackRate.value = rate || 1;
      const gn = actx.createGain();
      gn.gain.value = vol == null ? 0.6 : vol;
      src.connect(gn).connect(actx.destination);
      src.start();
    } catch (_) {}
  }

  // ---------- on / off ----------
  function setOn(v) {
    if (v === on) return;
    on = v;
    document.body.classList.toggle('pp-on', on);
    if (!on) teardown();
  }
  function teardown() {
    stopLoop();
    closeSheet(true);
    hideMoment(true);
    document.body.classList.remove('pp-frenzy', 'pp-last', 'pp-final');
    frenzy = false;
  }
  const serverNow = () => Date.now() + (skew || 0);
  const leftMs = () => (paused ? pausedLeft : Math.max(0, endsAt - Date.now()));

  function init(c) {
    ctx = c;
    const s = c.socket;
    s.on('pc:init', (d) => {
      if (!d || d.world == null) return;
      setOn(true);
      const same = roundId === d.id && sky && me;
      roundId = d.id;
      if (d.speed) speed = d.speed;
      if (d.brush) brush = d.brush;
      fireMax = d.energyMax || 30;
      if (!same) {
        sky = PW().build(d.world, d.seed);
        world = PW().world(d.world);
        setupScene();
        predicted = {};
        flipSeen = {};
        mine = 0;
        finalOn = false;
        document.body.classList.remove('pp-final');
        document.documentElement.style.setProperty('--pp-world-bg', `url("${PW().art(world, 'bg')}")`);
      }
      serverOwn = (d.own || []).slice();
      scene.setOwn(serverOwn);
      scene.setIslands(d.lm);
      lm = d.lm || [];
      scene.roster(d.roster || {});
      myK = d.me;
      scene.positions(d.pos || [], performance.now());
      const mineD = scene.dragons[myK];
      scene.meD = mineD || null;
      if (mineD && (!same || !me)) me = { x: mineD.sx, y: mineD.sy, tx: mineD.tx, ty: mineD.ty, fire: d.energy, blazeUntil: 0, moving: false };
      if (mineD) { mineD.x = me.x; mineD.y = me.y; }
      if (me) me.fire = d.energy;
      scores = d.teamScores || scores;
      clouds = d.clouds || clouds;
      if (d.scores && myK != null && d.scores[myK] != null) mine = d.scores[myK];
      if (d.captains) captains = d.captains;
      paused = !!d.paused;
      if (paused) pausedLeft = d.endsMs || 0; else if (d.endsMs != null) endsAt = Date.now() + d.endsMs;
      // the server has no open question for me any more (it timed out while I was away): no dead sheet
      if (!d.q && cur && !cur.done) closeSheet(true);
      scene.frozen = paused || finalOn;
      ctx.showScreen('paint');
      start();
      hud(true);
      if (!same) { worldIntro(d.world); showHelp(); }
    });
    s.on('pc:roster', (r) => { if (!scene) return; scene.roster(r || {}); scene.meD = scene.dragons[myK] || scene.meD; });
    s.on('pc:pos', (m) => {
      if (!scene || !m) return;
      const now = performance.now();
      if (m.t) { const sk = m.t - Date.now(); skew = skew == null ? sk : skew + (sk - skew) * 0.2; }
      scene.positions(m.d || [], now);
      const d = scene.dragons[myK];
      if (d && !me && d.sx != null) me = { x: d.sx, y: d.sy, tx: d.tx, ty: d.ty, fire: d.f & 2 ? 0 : 1, blazeUntil: 0, moving: false };
      if (d && me && (m.d || []).some((row) => row[0] === myK)) {
        scene.meD = d;
        // the server's dragon is ~a round trip behind mine: a big gap (a refused tap, a rejoin) eases me back at once,
        // a small one only while I hover (never a tug in the middle of a flight)
        const err = Math.hypot(d.sx - me.x, d.sy - me.y);
        if (err > 150) { me.x += (d.sx - me.x) * 0.5; me.y += (d.sy - me.y) * 0.5; }
        else if (err > 30 && !me.moving && Math.hypot(me.tx - d.tx, me.ty - d.ty) < 6) { me.x += (d.sx - me.x) * 0.25; me.y += (d.sy - me.y) * 0.25; }
        if (d.f & 2) me.fire = Math.min(me.fire, 0);
        if ((d.f & 1) && me.blazeUntil < Date.now() + 300) me.blazeUntil = Date.now() + 400;   // a Llamarada the server says I have
        // my last tap didn't reach the server (Wi-Fi blip, rate limit): send it again
        if (!paused && !finalOn && me.fire > 0 && Math.hypot(d.tx - me.tx, d.ty - me.ty) > 6 && now - lastGo > 450) sendGo(me.tx, me.ty, true);
      }
    });
    s.on('pc:paint', (m) => {
      if (!scene || !m) return;
      const now = performance.now();
      let mineFlips = 0;
      (m.f || []).forEach(([i, cd]) => {
        serverOwn[i] = cd;
        flipSeen[i] = now;
        if (predicted[i] != null) { delete predicted[i]; scene.own[i] = cd; return; }   // my phone painted it already
        scene.paint(i, cd, now);
        if (cd === code(team())) mineFlips++;
      });
      if (mineFlips && now - lastPop > 70 && !reduced()) { lastPop = now; play('pop', 0.9 + Math.random() * 0.5, 0.18); }
      if (m.ts) scores = m.ts;
      if (m.cl) clouds = m.cl;
      if (m.lm) { lm = m.lm; scene.setIslands(m.lm); }
      if (m.sc && myK != null && m.sc[myK] != null) {
        const was = mine;
        mine = m.sc[myK];
        if (mine > was) bump($('pp-mine'));
      }
      hud();
      if (on && !finalOn) (m.ev || []).forEach(news);
    });
    s.on('pc:energy', (d) => { if (me && d) { me.fire = d.energy; hud(); } });
    s.on('pc:captains', (c) => { captains = c; });
    s.on('pc:world', (d) => { if (d && d.world != null) worldPick = d.world; if (lobbyBox) paintLobby(); });
    s.on('pc:pause', (d) => {
      const was = paused;
      paused = !!(d && d.paused);
      if (paused) { pausedLeft = d.endsMs || 0; pausedAt = Date.now(); holdQ(true); }
      else {
        endsAt = Date.now() + (d.endsMs || 0);
        if (was && me && me.blazeUntil > pausedAt) me.blazeUntil += Date.now() - pausedAt;   // the Llamarada waited too
        holdQ(false);
      }
      if (scene) scene.frozen = paused || finalOn;
      setTiles(!paused && cur && !cur.tapped);
      hud(true);
    });
    s.on('state', (st) => {
      if (!st) return;
      // the server's own clock: corrected by the measured skew (a phone whose clock is off still counts down right)
      if (st.endsAt && !paused) endsAt = skew != null ? st.endsAt - skew : (endsAt || st.endsAt);
      if (st.pcWorld != null && st.pcWorld !== worldPick) { worldPick = st.pcWorld; if (lobbyBox) paintLobby(); }
      if (st.state === 'lobby') { setOn(false); roundId = null; }
    });
    s.on('question', (q) => { if (on && q && !q.ss && !finalOn) showQuestion(q); });
    s.on('answer-result', (r) => { if (on && r && r.paint) onResult(r); });
    s.on('answer-stale', (d) => {
      if (!on || !cur || cur.done) return;
      // the server has no open question for me (its answer got lost on the way): close the sheet, never a dead one
      if (d && d.reason === 'no-question') { closeSheet(true); if (me && me.fire <= 0) ask(); return; }
      cur.tapped = false;
      $('pp-verdict').className = 'pp-verdict';
      document.querySelectorAll('.pp-a').forEach((b) => b.classList.remove('picked'));
      if (!paused && !finalOn) { setTiles(true); runQTimer(); }
    });
    s.on('fin:frenzy', (d) => {
      if (!on || !d) return;
      frenzy = !d.off;
      document.body.classList.toggle('pp-frenzy', frenzy);
      if (scene) scene.frenzy = frenzy;
      hud(true);
    });
    s.on('fin:final', () => {
      if (!on) return;
      finalOn = true;
      document.body.classList.add('pp-final');
      closeSheet(true);
      hideMoment(true);
      if (scene) scene.frozen = true;
      if (me) { me.tx = me.x; me.ty = me.y; }
    });
    s.on('game-end', () => { if (on) { finalOn = true; stopLoop(); closeSheet(true); } });
    s.on('countdown', () => { roundId = null; finalOn = false; document.body.classList.remove('pp-final', 'pp-frenzy'); });
    bind();
  }
  const team = () => (ctx ? ctx.getTeam() : 'red');

  // ---------- the scene ----------
  function setupScene() {
    const cv = $('pp-canvas');
    if (!cv) return;
    if (!scene) scene = new (PR().Scene)(cv, { mode: 'phone' });
    scene.dragons = {};
    scene.meD = null;
    scene.setSky(sky);
    scene.speed = speed;
    scene.frenzy = frenzy;
    scene.frozen = false;
    scene._viewSet = false;
    me = null;
    PR().load(sky.world);
    pointers(true);
  }
  function start() {
    if (raf) return;
    lastT = performance.now();
    raf = requestAnimationFrame(loop);
  }
  function stopLoop() { cancelAnimationFrame(raf); raf = 0; }
  let hudAt = 0, ptrAt = 0, actAt = 0, insetAt = 0, inset = { top: 0, bottom: 0 };
  function loop(t) {
    raf = 0;
    if (!on || !scene) return;
    raf = requestAnimationFrame(loop);
    if (document.hidden || $('screen-paint').classList.contains('hidden')) return;
    const dt = Math.min(0.1, (t - lastT) / 1000);
    lastT = t;
    stepMe(dt, t);
    frameAt(t, dt);
    if (t - hudAt > 120) { hudAt = t; hud(); capChip(); }
    if (t - ptrAt > 100) { ptrAt = t; pointers(); }
    if (t - actAt > 3000) { actAt = t; ctx.markActivity(); }
  }
  function frameAt(t, dt) {
    if (!scene.resize()) return;
    // the HUD's and the fire button's sizes: read twice a second (never a layout read every frame)
    if (t - insetAt > 500 || !insetAt) {
      insetAt = t;
      const hudEl = $('pp-hud'), btn = $('pp-recharge'), sh = $('pp-sheet');
      inset = { top: hudEl ? hudEl.offsetHeight : 0, bottom: btn ? btn.offsetHeight + 18 : 12, sheet: sh ? sh.offsetHeight : 0 };
    }
    const { top, bottom } = inset;
    scene.inset = { top, bottom };
    const H = scene.h, W = scene.w;
    const safeH = Math.max(80, H - top - bottom);
    const s = Math.max(0.46, Math.min(1.05, safeH / sky.h));
    scene.view.s = s;
    // the camera: my dragon at least ~80 px inside the band between the HUD and the fire button (or the open question
    // sheet), even if that shows a little sky past the world's edge
    const sheetUp = isSheetUp();
    const sheetTop = sheetUp ? H - (inset.sheet || H * 0.62) : H;     // (the sheet's layout height: its slide never changes it)
    const bandTop = top, bandBot = Math.min(H - bottom, sheetTop);
    const bandH = Math.max(60, bandBot - bandTop);
    const halfW = W / (2 * s);
    const mx = me ? me.x : sky.w / 2, my = me ? me.y : sky.h / 2;
    let cx = sky.w < 2 * halfW ? sky.w / 2 : Math.max(halfW, Math.min(sky.w - halfW, mx));
    const marginX = Math.min(90, W * 0.22) / s;
    cx = Math.max(mx - halfW + marginX, Math.min(mx + halfW - marginX, cx));
    // vertical: the world centred in the band when it fits, else following me; then my dragon kept off the edges
    const safeTop = top, safeCentre = safeTop + safeH / 2;
    const bandCentre = bandTop + bandH / 2;
    let cy = bandH / s >= sky.h ? sky.h / 2 : Math.max(bandH / (2 * s), Math.min(sky.h - bandH / (2 * s), my));
    let meY = bandCentre + (my - cy) * s;                             // where I would be on screen
    const mTop = bandTop + Math.min(112, bandH * 0.34), mBot = bandBot - Math.min(70, bandH * 0.25);
    if (meY < mTop) cy -= (mTop - meY) / s; else if (meY > mBot) cy += (meY - mBot) / s;
    cy += (safeCentre - bandCentre) / s;
    const k = reduced() ? 1 : 1 - Math.exp(-dt / 0.25);
    scene.view.cx += (cx - scene.view.cx) * k;
    scene.view.cy += (cy - scene.view.cy) * k;
    if (!scene._viewSet) { scene.view.cx = cx; scene.view.cy = cy; scene._viewSet = true; }
    scene.frame(t, dt);
  }

  // my dragon: the same straight flight the server flies (same speed), so the tap answers in the same frame
  function stepMe(dt, nowPerf) {
    if (!me || !scene) return;
    const d = scene.dragons[myK];
    if (!d) return;
    scene.meD = d;
    me.moving = false;
    if (!paused && !finalOn && me.fire > 0) {
      const dx = me.tx - me.x, dy = me.ty - me.y, dist = Math.hypot(dx, dy);
      if (dist > 0.5) {
        const blaze = me.blazeUntil > Date.now();
        const sp = blaze ? speed[1] : speed[0];
        const step = Math.min(dist, sp * Math.min(dt, me.fire));
        const x0 = me.x, y0 = me.y;
        if (step >= dist - 1e-6) { me.x = me.tx; me.y = me.ty; } else { me.x += (dx / dist) * step; me.y += (dy / dist) * step; }
        me.fire = Math.max(0, me.fire - step / sp);
        me.moving = true;
        if (dx < -0.5) d.face = -1; else if (dx > 0.5) d.face = 1;
        predictPaint(x0, y0, me.x, me.y, blaze ? brush[1] : brush[0], nowPerf);
        if (me.fire <= 0) { me.tx = me.x; me.ty = me.y; outOfFire(); }
      }
    }
    d.x = me.x; d.y = me.y;
    d.f = (d.f & ~2) | (me.fire > 0 ? 0 : 2);
    if (me.blazeUntil > Date.now()) d.f |= 1; else d.f &= ~1;
    // a cloud my phone painted that the server never confirmed (the cooldown, a rival first): its true colour back
    Object.keys(predicted).forEach((i) => { if (nowPerf - predicted[i] > 1200) { scene.own[i] = serverOwn[i] || 0; delete predicted[i]; } });
  }
  function segDist(px, py, x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy;
    const t = L > 0 ? Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / L)) : 0;
    return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
  }
  function predictPaint(x0, y0, x1, y1, b, nowPerf) {
    const my = code(team());
    let n = 0;
    sky.clouds.forEach(([cx, cy, r], i) => {
      if (scene.own[i] === my) return;
      if (nowPerf - (flipSeen[i] || -1e9) < 1450) return;     // just changed colour: the server will not let it flip yet
      if (Math.abs(cx - x1) > r + b + 60 || Math.abs(cy - y1) > r + b + 60) return;
      if (segDist(cx, cy, x0, y0, x1, y1) > r + b) return;
      scene.paint(i, my, nowPerf);
      predicted[i] = nowPerf;
      n++;
    });
    if (n && !reduced()) { play('pop', 1 + Math.random() * 0.4, 0.4); buzz(8); }
  }

  // ---------- tap / drag to fly ----------
  function clampW(x, y) { return [Math.max(MARGIN, Math.min(sky.w - MARGIN, x)), Math.max(MARGIN + 20, Math.min(sky.h - MARGIN - 40, y))]; }
  function sendGo(x, y, force) {
    const now = performance.now();
    if (!force && now - lastGo < 90) {           // a finger dragged: at most ~11 a second, the last one always goes
      pendingGo = [x, y];
      if (!goTimer) goTimer = setTimeout(() => { goTimer = null; if (pendingGo) { const p = pendingGo; pendingGo = null; sendGo(p[0], p[1], true); } }, 95);
      return;
    }
    lastGo = now;
    pendingGo = null;
    ctx.socket.emit('player:pc-go', { pin: ctx.getPin(), x: Math.round(x), y: Math.round(y) });
  }
  function flyTo(x, y, fromTap) {
    if (!on || !me || paused || finalOn || !sky) return;
    hideHand();
    if (helpOpen()) hideHelp();
    const [tx, ty] = clampW(x, y);
    if (me.fire <= 0) { if (fromTap) outOfFire(true); return; }
    me.tx = tx; me.ty = ty;
    if (fromTap) {
      scene.ripple = { x: tx, y: ty, t: performance.now() };
      play('whoosh', 1.25, 0.18);
    }
    sendGo(tx, ty, fromTap);
    ctx.markActivity();
  }
  let dragging = false;
  function bind() {
    const cv = $('pp-canvas');
    if (!cv) return;
    const pt = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointerdown', (e) => {
      audioReady();
      if (!scene || !sky) return;
      e.preventDefault();
      dragging = true;
      try { cv.setPointerCapture(e.pointerId); } catch (_) {}
      const w = scene.toWorld(...pt(e));
      if (w) flyTo(w[0], w[1], true);
    });
    cv.addEventListener('pointermove', (e) => {
      if (!dragging || !scene) return;
      const w = scene.toWorld(...pt(e));
      if (w) flyTo(w[0], w[1], false);
    });
    const up = () => { dragging = false; };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    const rb = $('pp-recharge');
    if (rb) rb.addEventListener('click', () => { audioReady(); ask(); });
    const go = $('pp-help-go');
    if (go) go.addEventListener('click', () => { audioReady(); hideHelp(); });
    window.addEventListener('resize', () => { insetAt = 0; if (scene) scene.resize(); });
    document.addEventListener('keydown', (e) => {          // a laptop in the classroom: arrow keys nudge the dragon
      if (!on || !me || !document.body.classList.contains('pp-on')) return;
      const k = { ArrowLeft: [-160, 0], ArrowRight: [160, 0], ArrowUp: [0, -140], ArrowDown: [0, 140] }[e.key];
      if (!k) return;
      e.preventDefault();
      flyTo(me.x + k[0], me.y + k[1], true);
    });
  }

  // ---------- the islands out of view: a pointer at the screen's edge (its picture, its owner's colour), tap = fly there ----------
  let ptrEls = [];
  function pointers(reset) {
    const box = $('pp-pointers');
    if (!box) return;
    if (reset) { box.innerHTML = ''; ptrEls = []; }
    if (!sky || !scene || !scene.cam || !world) return;
    if (!ptrEls.length) {
      sky.lms.forEach((l, i) => {
        const b = el('button', 'pp-ptr');
        b.type = 'button';
        b.setAttribute('aria-label', `Volar a ${l.name}`);
        const im = el('img');
        im.alt = '';
        im.src = PW().art(world, l.id);
        b.append(el('i', 'pp-ptr-arrow'), im);
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); audioReady(); flyTo(l.x, l.y, true); });
        box.appendChild(b);
        ptrEls.push(b);
      });
    }
    const c = scene.cam, W = scene.w, H = scene.h;
    const t0 = scene.inset.top + 34, b0 = Math.min(H - scene.inset.bottom, isSheetUp() ? H - (inset.sheet || H * 0.62) : H) - 34;
    sky.lms.forEach((l, i) => {
      const b = ptrEls[i];
      const sx = c.ox + l.x * c.s, sy = c.oy + l.y * c.s;
      const off = sx < -20 || sx > W + 20 || sy < scene.inset.top - 30 || sy > b0 + 30;
      b.classList.toggle('show', off && !finalOn);
      if (!off) return;
      const px = Math.max(30, Math.min(W - 30, sx)), py = Math.max(t0, Math.min(b0, sy));
      const ang = Math.atan2(sy - py, sx - px) * 180 / Math.PI;
      const st = lm[i] ? lm[i][1] : 0;
      b.dataset.own = st === 1 ? 'red' : st === 2 ? 'gold' : '';
      b.style.transform = `translate3d(${(px - 24).toFixed(0)}px,${(py - 24).toFixed(0)}px,0)`;
      b.firstChild.style.transform = `rotate(${ang.toFixed(0)}deg)`;
    });
  }

  // ---------- fire ----------
  let outAt = 0;
  function outOfFire(tapped) {
    if (!on || finalOn) return;
    const now = performance.now();
    if (tapped) { const b = $('pp-recharge'); if (b) { b.classList.remove('nudge'); void b.offsetWidth; b.classList.add('nudge'); } buzz([30, 40, 30]); }
    if (cur && !cur.done) { sheet(true); return; }
    if (now - outAt < 2500) return;
    outAt = now;
    // the server deals a question by itself at 0; ask too in case that one got lost
    setTimeout(() => { if (on && !finalOn && me && me.fire <= 0 && !cur) ask(); }, 1800);
  }
  function ask() {
    if (!ctx || finalOn) return;
    if (cur && !cur.done) { sheet(true); return; }
    ctx.socket.emit('player:pc-ask', { pin: ctx.getPin() });
    ctx.markActivity();
    const b = $('pp-recharge');
    if (b) b.classList.add('asking');
    setTimeout(() => { if (b) b.classList.remove('asking'); }, 1500);
  }

  // ---------- the question sheet ----------
  let cur = null, qT = null, rescueT = null, lastTick = 0, closeT = null, lastDoneQid = null;
  const Q_MS = 20000;
  const isSheetUp = () => { const q = $('pp-sheet'); return !!q && !q.classList.contains('down'); };
  function sheet(up) {
    const q = $('pp-sheet');
    if (!q) return;
    q.classList.toggle('down', !up);
    q.setAttribute('aria-hidden', up ? 'false' : 'true');
    document.body.classList.toggle('pp-asking', !!up);
    insetAt = 0;                       // the camera re-reads the sheet's height
  }
  function closeSheet(now) {
    clearTimeout(closeT);
    stopQTimer();
    clearTimeout(rescueT);
    if (now) { cur = null; sheet(false); return; }
    sheet(false);
  }
  function showQuestion(q) {
    if (!q || q.qid === lastDoneQid) return;          // a late copy of a question already answered (a «Recargar» crossed the server's deal)
    clearTimeout(closeT);
    if (cur && cur.qid === q.qid && !cur.done) {            // the same question again (a resync / a rejoin)
      if (cur.tapped) { cur.tapped = false; setTiles(!paused); document.querySelectorAll('.pp-a').forEach((b) => b.classList.remove('picked')); runQTimer(); }
      sheet(true);
      return;
    }
    const wasUp = isSheetUp();
    cur = { qid: q.qid, t0: performance.now(), tapped: false, done: false, heldAt: 0, heldSum: 0, armAt: performance.now() + (wasUp ? 250 : ARM_MS) };
    const box = $('pp-sheet');
    box.classList.toggle('nopic', !q.image);
    box.classList.toggle('empty', !!(me && me.fire <= 0));
    $('pp-q-head').textContent = me && me.fire <= 0 ? '¡Sin fuego! Responde y vuelve a volar' : `🔥 Responde bien: +${frenzy ? 20 : 10} s de fuego`;
    const img = $('pp-q-img');
    if (q.image) { img.src = q.image; img.alt = ''; } else img.removeAttribute('src');
    $('pp-q-text').textContent = q.text || '';
    $('pp-verdict').className = 'pp-verdict';
    $('pp-verdict').textContent = '';
    const ans = $('pp-ans');
    ans.innerHTML = '';
    const SH = ['▲', '◆', '●', '■'];
    (q.answers || []).forEach((a, i) => {
      const b = el('button', 'pp-a s' + (i % 4) + (a.length > 30 ? ' xlong' : a.length > 15 ? ' long' : ''));
      b.type = 'button';
      const sh = el('span', 'pp-sh', SH[i % 4]);
      sh.setAttribute('aria-hidden', 'true');
      b.append(sh, el('span', 'pp-at', a));
      let pressAt = -1e9;
      b.addEventListener('pointerdown', (e) => { pressAt = performance.now(); if (e.pointerType && e.pointerType !== 'mouse' && e.cancelable) e.preventDefault(); answer(i); });
      b.addEventListener('click', () => { if (performance.now() - pressAt < 2500) return; answer(i); });
      ans.appendChild(b);
    });
    sheet(true);
    runQTimer(true);
    if (paused) { holdQ(true); setTiles(false); }
    sfx(K + 'whoosh.mp3', 0.22);
    ctx.markActivity();
  }
  function setTiles(v) { document.querySelectorAll('.pp-a').forEach((b) => { b.disabled = !v; }); }
  const qLeft = () => (cur ? Math.max(0, Q_MS - ((cur.heldAt || performance.now()) - cur.t0 - cur.heldSum)) : 0);
  function runQTimer(fresh) {
    stopQTimer();
    if (!cur || cur.done) return;
    const bar = $('pp-q-bar');
    const left = qLeft();
    bar.style.transition = 'none';
    bar.style.transform = `scaleX(${(left / Q_MS).toFixed(3)})`;
    if (fresh) bar.parentNode.classList.remove('hurry');
    if (cur.heldAt || paused) return;
    void bar.offsetWidth;
    bar.style.transition = `transform ${left}ms linear`;
    bar.style.transform = 'scaleX(0)';
    lastTick = 99;
    qT = setInterval(() => {
      if (!cur || cur.tapped || cur.done || cur.heldAt) return;
      const l = qLeft();
      const sec = Math.ceil(l / 1000);
      if (sec <= 5 && sec > 0 && sec !== lastTick) { lastTick = sec; bar.parentNode.classList.add('hurry'); play('tick', 1, 0.35); }
      if (l <= 0) {
        stopQTimer();
        cur.tapped = true;
        setTiles(false);
        ctx.socket.emit('player:answer', { pin: ctx.getPin(), qid: cur.qid, choiceIdx: -1 }, () => {});   // time up = wrong (once)
      }
    }, 200);
  }
  function stopQTimer() {
    clearInterval(qT);
    qT = null;
    const bar = $('pp-q-bar');
    if (bar && cur) { bar.style.transition = 'none'; bar.style.transform = `scaleX(${(qLeft() / Q_MS).toFixed(3)})`; }
  }
  function holdQ(v) {
    if (!cur) return;
    if (v && !cur.heldAt) { cur.heldAt = performance.now(); stopQTimer(); }
    else if (!v && cur.heldAt) { cur.heldSum += performance.now() - cur.heldAt; cur.heldAt = 0; if (!cur.tapped && !cur.done) runQTimer(); }
  }
  // the tap answers at once: the tile presses, a pop; the server judges (packs never send the right answer)
  function answer(i) {
    audioReady();
    if (!cur || cur.tapped || cur.done || paused || finalOn) return;
    if (performance.now() < cur.armAt) return;          // the sheet is still rising: a double tap is not an answer
    cur.tapped = true;
    const btn = document.querySelectorAll('.pp-a')[i];
    if (btn) btn.classList.add('picked');
    setTiles(false);
    play('pop', 1.1, 0.45);
    buzz(10);
    stopQTimer();
    const v = $('pp-verdict');
    v.className = 'pp-verdict wait show';
    v.textContent = '';
    v.appendChild(el('b', 'dots', '•••'));
    const qid = cur.qid;
    ctx.socket.emit('player:answer', { pin: ctx.getPin(), qid, choiceIdx: i }, () => {});
    clearTimeout(rescueT);
    // no verdict in 3 s (a Wi-Fi blip): the tiles come back (the server answers a second tap, or says it has no question)
    rescueT = setTimeout(() => {
      if (!(cur && cur.qid === qid && cur.tapped && !cur.done)) return;
      cur.tapped = false;
      if (btn) btn.classList.remove('picked');
      $('pp-verdict').className = 'pp-verdict';
      if (paused) return;
      setTiles(true);
      runQTimer();
    }, 3000);
    ctx.markActivity();
  }
  function verdict(cls, head, sub, waitMs) {
    const v = $('pp-verdict');
    v.className = 'pp-verdict ' + cls;
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
  let rightN = 0;
  function onResult(r) {
    const pr = r.paint;
    clearTimeout(rescueT);
    stopQTimer();
    if (cur) { cur.done = true; cur.tapped = true; lastDoneQid = cur.qid; }
    setTiles(false);
    document.querySelectorAll('.pp-a').forEach((b) => {
      const txt = b.querySelector('.pp-at') && b.querySelector('.pp-at').textContent;
      if (txt === r.correctText) b.classList.add('right');
      else if (b.classList.contains('picked')) b.classList.add('wrong');
      else b.classList.add('dim');
    });
    if (me && typeof pr.energy === 'number') me.fire = pr.energy;
    if (r.correct) {
      rightN++;
      if (pr.blaze && me) me.blazeUntil = Date.now() + (pr.blazeMs || 6000);
      const head = pr.frenzy ? '¡RECARGA DOBLE!' : pr.blaze ? '¡LLAMARADA!' : '¡Correcto!';
      const sub = pr.frenzy ? `+${pr.gain || 20} s de fuego y llamarada 🔥🔥` : pr.blaze ? `+${pr.gain || 10} s · pintas más ancho y más rápido` : `+${pr.gain || 10} s de fuego 🔥` + (pr.streak >= 2 ? ` · racha ${pr.streak}` : '');
      verdict('ok', head, sub);
      play('gold', 1.1, 0.5);
      buzz([20, 30, 20]);
      fireFlash();
      if (pr.wind > 0) setTimeout(() => moment({ kind: 'wind', team: team(), title: '¡Viento a favor!', sub: `Soplaste ${pr.wind === 1 ? '1 nube' : pr.wind + ' nubes'} del ${SHORT[other(team())]} a tu color`, mine: true }), 500);
      if (rightN === 1) gangLine('¡Toca el cielo y vuela a pintar!');
      closeT = setTimeout(() => { if (cur && cur.done) { cur = null; sheet(false); } }, 1150);
    } else {
      const why = pr.why === 'fast' ? '¡Muy rápido! Lee primero' : pr.why === 'timeup' ? '¡Se acabó el tiempo!' : '¡Casi!';
      const wait = pr.wait || 2600;
      verdict('no', why, r.correctText ? `Era: ${r.correctText}` : '', wait);
      play('pop', 0.55, 0.35);
      buzz(30);
      // still no fire: the server sends the next question after the wait (the sheet stays up); with fire: back to the sky
      closeT = setTimeout(() => { if (cur && cur.done && me && me.fire > 0) { cur = null; sheet(false); } }, wait);
    }
    hud(true);
  }
  function fireFlash() { const f = $('pp-fire'); if (!f) return; f.classList.remove('gain'); void f.offsetWidth; f.classList.add('gain'); }

  // ---------- HUD ----------
  let hudKey = '';
  function hud(force) {
    if (!me && !force) return;
    const my = team();
    const fire = me ? Math.max(0, me.fire) : 0;
    const fill = $('pp-fire-fill');
    if (fill) fill.style.transform = `scaleX(${Math.max(0, Math.min(1, fire / fireMax)).toFixed(3)})`;
    const left = leftMs();
    const sec = Math.ceil(left / 1000);
    const key = [Math.ceil(fire), fire < 4, scores.red, scores.gold, my, mine, sec, paused, (lm || []).map((x) => x[1]).join(''), frenzy].join('|');
    if (key === hudKey && !force) return;
    hudKey = key;
    $('pp-fire-text').textContent = fire > 0 ? `🔥 ${Math.ceil(fire)} s` : '🔥 ¡Sin fuego!';
    $('pp-fire').classList.toggle('low', fire < 4);
    $('pp-fire').classList.toggle('out', fire <= 0);
    const rb = $('pp-recharge');
    if (rb) {
      rb.classList.toggle('urgent', fire < 4);
      $('pp-recharge-sub').textContent = fire <= 0 ? '¡Toca y responde para volar!' : fire < 4 ? '¡Poco fuego! Responde ya' : `Una pregunta = +${frenzy ? 20 : 10} s de fuego`;
    }
    const R = scores.red || 0, G = scores.gold || 0;
    $('pp-r').textContent = R;
    $('pp-g').textContent = G;
    const share = R + G > 0 ? R / (R + G) : 0.5;
    $('pp-tug').style.setProperty('--share', (share * 100).toFixed(1) + '%');
    document.querySelector('.pp-side.red').classList.toggle('me', my === 'red');
    document.querySelector('.pp-side.gold').classList.toggle('me', my === 'gold');
    ['red', 'gold'].forEach((t) => {
      const box = $('pp-isl-' + t);
      if (!box) return;
      const held = (lm || []).map((x, i) => (x[1] === code(t) ? i : -1)).filter((i) => i >= 0);
      const k = held.join(',');
      if (box.dataset.k === k) return;
      box.dataset.k = k;
      box.innerHTML = '';
      held.forEach((i) => {
        const l = sky && sky.lms[i];
        const im = el('img');
        im.alt = l ? l.name : '';
        if (world && l) im.src = PW().art(world, l.id);
        box.appendChild(im);
      });
    });
    const clock = $('pp-clock');
    clock.textContent = endsAt || paused ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : '-:--';
    clock.classList.toggle('last', !paused && (endsAt > 0) && sec <= 10);
    $('pp-mine-n').textContent = mine;
    $('pp-mine').classList.toggle('none', mine <= 0);
    const st = $('pp-lead');
    const a = scores[my] || 0, b = scores[other(my)] || 0;
    st.textContent = a > b ? `¡Vamos ganando por ${a - b}!` : a < b ? (b - a === 1 ? '¡Nos falta 1!' : `¡Nos faltan ${b - a}!`) : '¡Empate!';
    st.className = 'pp-lead ' + (a > b ? 'ahead' : a < b ? 'behind' : '');
  }
  function bump(node) { if (!node || reduced()) return; node.classList.remove('bump'); void node.offsetWidth; node.classList.add('bump'); }
  // inside an island's ring: «¡Quédate! Conquistando …» with the meter toward my kingdom (the tap answers back while I wait)
  let capKey = '';
  function capChip() {
    const box = $('pp-capchip');
    if (!box || !sky || !me) return;
    const my = team();
    let at = -1;
    sky.lms.forEach((l, i) => { if (at < 0 && Math.hypot(me.x - l.x, me.y - l.y) <= l.r) at = i; });
    const st = at >= 0 ? (lm[at] || [0, 0]) : null;
    const v = st ? st[0] : 0;
    const prog = my === 'red' ? (v + 1) / 2 : (1 - v) / 2;
    const mine2 = st && st[1] === code(my);
    const show = at >= 0 && !finalOn && !paused && !isSheetUp() && me.fire > 0;
    const text = !show ? '' : mine2 ? `¡${sky.lms[at].name} es de tu reino! Defiéndela` : `¡Quédate! Conquistando ${sky.lms[at].name}`;
    const key = [show, text, Math.round(prog * 50), my].join('|');
    if (key === capKey) return;
    capKey = key;
    box.classList.toggle('show', show);
    box.classList.toggle('mine', !!mine2);
    box.classList.toggle('red', my === 'red');
    box.classList.toggle('gold', my === 'gold');
    if (!show) return;
    $('pp-capchip-text').textContent = text;
    const im = $('pp-capchip-img');
    const u = PW().art(world, sky.lms[at].id);
    if (im.getAttribute('src') !== u) im.src = u;
    $('pp-capchip-fill').style.transform = `scaleX(${Math.max(0, Math.min(1, prog)).toFixed(3)})`;
  }

  // ---------- moments: one slim pill above the fire button (never over my dragon), one at a time ----------
  // My kingdom's captures jump the line; everything else waits at least 4 s, the rival's news 6 s; milestones are the
  // projector's.
  let momQ = [], momOn = false, momT = null, leadNewsAt = 0, rivalAt = 0, lastMomAt = 0;
  const lmName = (i) => (sky && sky.lms[i] ? sky.lms[i].name : 'la maravilla');
  function news(ev) {
    const my = team();
    const C = CAST();
    const cap = captains && captains[my];
    const now = Date.now();
    if (ev.type === 'capture') {
      if (scene && sky && sky.lms[ev.lm]) scene.flashIsland(ev.lm, ev.team, performance.now());
      if (ev.team === my) {
        const mineIn = (ev.names || []).some((n) => n === myName());
        moment({ kind: 'cap', team: my, lm: ev.lm, title: mineIn ? `¡Conquistaste ${lmName(ev.lm)}! +10` : `¡Tu reino conquistó ${lmName(ev.lm)}! +10`, sub: C && cap ? `${C.name(cap)}: «${C.line(cap, 'battle')}»` : (ev.from ? `¡Se la quitamos al ${SHORT[ev.from]}!` : ''), cast: cap, big: true, mine: true });
        play('star', 1, 0.6);
        buzz([40, 30, 60]);
      } else if (now - rivalAt > 6000) {
        rivalAt = now;
        moment({ kind: 'cap', team: ev.team, lm: ev.lm, title: ev.from === my ? `¡El ${SHORT[ev.team]} nos quitó ${lmName(ev.lm)}!` : `¡El ${SHORT[ev.team]} conquistó ${lmName(ev.lm)}!`, sub: '¡Vuela a su anillo y recupérala!' });
        sfx(K + 'castle-alert.mp3', 0.35);
      }
    } else if (ev.type === 'lost') {
      if (now - rivalAt > 6000) { rivalAt = now; moment({ kind: 'lost', team: ev.team === my ? ev.by : my, lm: ev.lm, title: `¡${lmName(ev.lm)} queda libre!`, sub: ev.team === my ? '¡Vuelve a su anillo y recupérala!' : '¡Corre y píntala de tu color!' }); }
    } else if (ev.type === 'lead' && ev.team) {
      if (now - leadNewsAt < 7000) return;
      if ((scores[ev.team] || 0) <= (scores[other(ev.team)] || 0)) return;        // the lead flipped back already
      leadNewsAt = now;
      if (ev.team === my) moment({ kind: 'lead', team: my, title: '¡Tu reino pasa adelante!', sub: C && cap ? `${C.name(cap)}: «${C.line(cap, 'battle')}»` : '¡Sigan pintando!', cast: cap });
      else moment({ kind: 'lead', team: ev.team, title: `¡El ${SHORT[ev.team]} pasa adelante!`, sub: '¡Vuela a sus nubes: tócalas y son tuyas!' });
    } else if (ev.type === 'wind' && ev.team && ev.k !== myK && ev.team === my) {
      moment({ kind: 'wind', team: my, title: '¡Viento a favor!', sub: `Tu reino sopló ${ev.n} nubes del ${SHORT[other(my)]}` });
    }
  }
  const myName = () => ($('lobby-name') && $('lobby-name').textContent) || '';
  function moment(m) {
    if (finalOn) return;
    if (m.big) momQ = momQ.filter((x) => x.big);      // a capture of mine jumps the line
    else if (Date.now() - lastMomAt < 4000 && !m.mine && momOn) return;   // never a stream of pills
    momQ.push(m);
    if (momQ.length > 2) momQ = momQ.slice(-2);
    if (!momOn) nextMoment();
  }
  function nextMoment() {
    // «Así se juega» first: the moments wait until the kid closes it
    if (helpOpen() && momQ.length) { momOn = true; clearTimeout(momT); momT = setTimeout(nextMoment, 600); return; }
    const m = momQ.shift();
    const box = $('pp-moment');
    if (!m || !box) { momOn = false; document.body.classList.remove('pp-mom'); if (box) box.classList.remove('show'); return; }
    momOn = true;
    lastMomAt = Date.now();
    document.body.classList.add('pp-mom');
    box.className = 'pp-moment ' + (m.kind || '') + ' ' + (m.team || '');
    const img = $('pp-moment-img');
    const l = m.lm != null && sky ? sky.lms[m.lm] : null;
    const C = CAST();
    if (l && world) { img.src = PW().art(world, l.id); img.className = 'island'; }
    else if (m.cast && C) { img.src = C.pose(m.cast, 'cheer'); img.className = 'cast'; }
    else { img.src = m.kind === 'wind' ? '/assets/dralingo/power.webp' : '/assets/dralingo/point.webp'; img.className = 'cast'; }
    $('pp-moment-title').textContent = m.title;
    $('pp-moment-sub').textContent = m.sub || '';
    void box.offsetWidth;
    box.classList.add('show');
    clearTimeout(momT);
    momT = setTimeout(() => { box.classList.remove('show'); momT = setTimeout(() => { document.body.classList.remove('pp-mom'); nextMoment(); }, 220); }, m.big ? 2800 : 2400);
  }
  function hideMoment(all) { if (all) momQ = []; clearTimeout(momT); momOn = false; document.body.classList.remove('pp-mom'); const b = $('pp-moment'); if (b) b.classList.remove('show'); }
  function gangLine(text) {
    const C = CAST();
    const cap = captains && captains[team()];
    if (!C || !cap) return;
    moment({ kind: 'gang', team: team(), title: `${C.name(cap)}: «${text}»`, sub: '', cast: cap, mine: true });
  }

  // ---------- first play: «Así se juega» (3 pictured steps) + a tapping hand on the sky ----------
  let helpT = null;
  function showHelp() {
    const card = $('pp-help');
    if (!card) return;
    const key = 'ppHelp:' + (ctx.getPin ? ctx.getPin() : '');
    let seen = false;
    try { seen = !!sessionStorage.getItem(key); sessionStorage.setItem(key, '1'); } catch (_) {}
    paintHelp(card);
    if (seen) { showHand(); return; }
    card.classList.remove('hidden');
    // a kid who never taps «¡A volar!» is never stuck behind the card: it steps aside by itself (the hand shows instead)
    clearTimeout(helpT);
    helpT = setTimeout(hideHelp, 14000);
  }
  function paintHelp(card) {
    const my = team();
    card.classList.toggle('red', my === 'red');
    card.classList.toggle('gold', my === 'gold');
    $('pp-help-title').textContent = my === 'red' ? '¡Eres del Reino del Fuego!' : '¡Eres del Reino del Mar!';
    $('pp-help-dragon').src = PR().frameUrl(my, 'mid');
    if (world) {
      const l = world.lms[0];
      $('pp-help-island').src = PW().art(world, l.id);
      $('pp-help-island').alt = l.name;
    }
  }
  function hideHelp() { clearTimeout(helpT); const c = $('pp-help'); if (c && !c.classList.contains('hidden')) { c.classList.add('hidden'); showHand(); } }
  const helpOpen = () => { const c = $('pp-help'); return !!c && !c.classList.contains('hidden'); };
  let handT = null;
  function showHand() {
    const h = $('pp-hand');
    if (!h || reduced()) return;
    h.classList.remove('hidden');
    clearTimeout(handT);
    handT = setTimeout(hideHand, 9000);
  }
  function hideHand() { const h = $('pp-hand'); if (h) h.classList.add('hidden'); clearTimeout(handT); }

  // ---------- the round's world: a card at the top as the round starts ----------
  function worldIntro(wi) {
    const box = $('pp-world');
    if (!box || !world) return;
    $('pp-world-n').textContent = `Mundo ${wi + 1} de ${PW().WORLDS.length}`;
    $('pp-world-name').textContent = world.name;
    const isl = $('pp-world-isl');
    isl.innerHTML = '';
    world.lms.forEach((l) => { const im = el('img'); im.alt = l.name; im.src = PW().art(world, l.id); isl.appendChild(im); });
    box.classList.remove('show');
    void box.offsetWidth;
    box.classList.add('show');
    setTimeout(() => box.classList.remove('show'), 3200);
  }

  // ---------- the lobby: «Así se juega» + this round's world (the shared skin calls lobby(head)) ----------
  let lobbyBox = null;
  function lobby(head) {
    if (!head) { if (lobbyBox) { lobbyBox.remove(); lobbyBox = null; } return; }
    if (!lobbyBox || !lobbyBox.isConnected) {
      lobbyBox = el('div', 'pp-lobby');
      lobbyBox.innerHTML = '<div class="pp-lobby-world"><img id="pp-lobby-bg" src="/assets/paint/dubai/bg.webp" alt=""><div><small>Este cielo</small><b id="pp-lobby-name"></b><span id="pp-lobby-isl"></span></div></div>'
        + '<div class="pp-lobby-title">Así se juega</div><ol class="pp-lobby-steps">'
        + '<li><span class="pp-step-ico tap">👆</span><span><b>Toca el cielo</b>tu dragón vuela ahí y pinta las nubes</span></li>'
        + '<li><span class="pp-step-ico isl"><img id="pp-lobby-lm" src="/assets/paint/dubai/burj.webp" alt=""></span><span><b>Conquista las maravillas</b>quédate en su anillo: +10 para tu reino</span></li>'
        + '<li><span class="pp-step-ico fire">🔥</span><span><b>¿Sin fuego? Responde</b>cada acierto: +10 s de vuelo</span></li></ol>';
      head.after(lobbyBox);
    }
    paintLobby();
  }
  function paintLobby() {
    if (!lobbyBox || !PW()) return;
    const w = PW().world(worldPick);
    $('pp-lobby-bg').src = PW().art(w, 'bg');
    $('pp-lobby-name').textContent = w.name;
    $('pp-lobby-lm').src = PW().art(w, w.lms[0].id);
    $('pp-lobby-isl').textContent = w.lms.map((l) => l.name).join(' · ');
    if (PR()) PR().load(worldPick);
  }

  window.PaintPhone = {
    init, lobby,
    debug: () => ({ on, me: me && Object.assign({}, me), myK, scores, mine, world: world && world.id, sheet: isSheetUp(), cur: cur && Object.assign({}, cur), paused, finalOn, skew }),
    // test hooks: headless browsers barely deliver animation frames, so step and draw by hand
    advance: (sec) => {
      if (!scene || !me) return null;
      const n = Math.round((sec || 0) * 60);
      for (let k = 0; k < n; k++) stepMe(1 / 60, performance.now());
      frameAt(performance.now(), 1 / 60);
      hud(true); capChip(); pointers();
      return { x: Math.round(me.x), y: Math.round(me.y), fire: Math.round(me.fire * 10) / 10 };
    },
    tapWorld: (x, y) => { flyTo(x, y, true); return me ? [me.tx, me.ty] : null; },
    answer: (i) => { if (cur) cur.armAt = 0; answer(i); },
    moment: (m) => moment(m),
    help: (v) => { const c = $('pp-help'); if (!c) return; if (v) { paintHelp(c); c.classList.remove('hidden'); } else hideHelp(); },
    hand: (v) => (v ? showHand() : hideHand()),
    intro: () => worldIntro(sky ? sky.world : 0),
    frame: () => { if (scene) frameAt(performance.now(), 1 / 60); pointers(); capChip(); },
    scene: () => scene,
  };
})();
