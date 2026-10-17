// Dragones Pintores — the kid's phone: a little platformer. Physics run here; the server owns energy + tile colours.
// Fly your baby dragon over the cloud platforms; every surface you land on turns your kingdom's colour.
// Moving burns fire (energy). «Recargar» asks the server for a question; a right answer gives +10 s of fire.
// player.js calls PaintPhone.init(...) once; questions/results use the shared pastel skin (player-kingdoms-skin.js).
(function () {
  const G = 1900;          // gravity px/s²
  const SPEED = 230;       // run speed px/s
  const JUMP = 640;        // jump impulse px/s (≈ 3.4 tiles)
  const W = 24, H = 28;    // dragon box
  const SEND_MS = 125;     // position updates (8 Hz)
  const POSE = (n) => '/assets/kingdoms/dralingo/' + n + '.webp';
  const COL = { red: '#f0443a', gold: '#2f7bea', redDeep: '#b22a22', goldDeep: '#1d52a8' };

  let ctx = null;              // { socket, getPin, getTeam, showScreen, markActivity }
  let lv = null;               // level from pc:init
  let solid = null;            // Uint8Array cols*rows
  let surf = null;             // Set of surface ids
  let own = {};
  let others = {};             // id → { x, y, f, team, name }
  let names = {};
  let me = null;               // { x, y, vx, vy, f, ground, jumps, extra }
  let energy = 0, energyMax = 30;
  let blazeUntil = 0;
  let input = { l: false, r: false };
  let running = false, raf = 0, lastT = 0, lastSend = 0;
  let pendingPaint = [];
  let spent = 0;               // fire seconds burnt since the last position message
  let gems = [];
  let scores = { red: 0, gold: 0 };
  let myClouds = 0;            // clouds that are mine right now (pc:paint scores): shown in the score bar
  let paused = false;          // «⏸ Pausa»: the dragon stands still (no physics, no fire, no paint)
  let captains = null;         // the round's two captains (pc:init / pc:captains): they cheer on my phone
  let canvas, c2d, dpr = 1;
  // Team colours on the dragons too (his note 2026-10-11): Fuego flies the red Dralingo, Mar the blue one.
  const IMG = { fly: {}, jump: {} };
  function loadImages() {
    if (IMG.fly.red) return;
    [['fly', 'red', 'fly-red'], ['fly', 'gold', 'fly'], ['jump', 'red', 'jump-red'], ['jump', 'gold', 'jump']].forEach(([k, t, f]) => {
      const i = new Image(); i.src = POSE(f); IMG[k][t] = i;
    });
  }

  const $ = (id) => document.getElementById(id);
  const team = () => (ctx ? ctx.getTeam() : 'red');
  const isSolid = (tx, ty) => tx < 0 || tx >= lv.cols || (ty >= 0 && ty < lv.rows && solid[ty * lv.cols + tx] === 1);

  function init(c) {
    ctx = c;
    const s = c.socket;
    s.on('pc:init', (d) => {
      if (!d || !d.level) return;
      // Same round (a resync or a WiFi rejoin): keep the dragon, its gems and jumps; only refresh the shared state.
      const sameRound = !!(lv && me && d.level.seed === lv.seed && d.level.cols === lv.cols);
      lv = d.level;
      if (!sameRound) {
        solid = new Uint8Array(lv.cols * lv.rows);
        lv.solid.forEach((row, y) => { for (let x = 0; x < lv.cols; x++) solid[y * lv.cols + x] = row[x] === '#' ? 1 : 0; });
        surf = new Set(lv.surfaces);
        gems = (lv.gems || []).map(([x, y]) => ({ x, y, taken: 0 }));
        others = {};
        spawn();
      }
      own = Object.assign({}, d.own || {});
      names = {};
      Object.entries(d.players || {}).forEach(([id, p]) => { names[id] = p.name; });
      energy = d.energy; energyMax = d.energyMax || 30;
      scores = d.teamScores || scores;
      if (d.captains) captains = d.captains;
      if (!sameRound) myClouds = 0;
      paused = !!d.paused;
      loadImages();
      const ep = document.querySelector('#pc-empty .pc-card-pose');
      if (ep) ep.src = POSE(team() === 'red' ? 'shocked-red' : 'shocked');
      start();
      showHelp();
    });
    s.on('pc:pos', (arr) => {
      const seen = {};
      arr.forEach(([id, x, y, f, t]) => {
        if (id === s.id) return;
        seen[id] = true;
        const o = others[id] || (others[id] = { x, y, f, team: t ? 'gold' : 'red', tx: x, ty: y });
        o.tx = x; o.ty = y; o.f = f; o.team = t ? 'gold' : 'red';
      });
      Object.keys(others).forEach((id) => { if (!seen[id]) delete others[id]; });
    });
    s.on('pc:paint', (d) => {
      (d.tiles || []).forEach(([id, t]) => { own[id] = t ? 'gold' : 'red'; });
      if (d.scores && d.scores[s.id] != null) myClouds = d.scores[s.id];
      if (d.teamScores) { scores = d.teamScores; hud(); }
      if (running) news(d.events || []);
    });
    s.on('pc:captains', (c) => { captains = c; });
    s.on('pc:pause', (d) => { paused = !!(d && d.paused); input.l = false; input.r = false; spent = 0; pendingPaint = []; });
    s.on('pc:energy', (d) => { energy = d.energy; hud(); });
    s.on('state', (st) => { if (st && st.players) Object.entries(st.players).forEach(([id, p]) => { names[id] = p.name; }); });
    s.on('answer-result', (r) => {
      if (!r || !r.paint) return;
      energy = r.paint.energy;
      if (r.paint.blaze) blazeUntil = Date.now() + (r.paint.blazeMs || 6000);
      const et = $('pc-empty-title');
      if (et) et.textContent = r.correct ? '¡Te quedaste sin fuego!' : '¡Casi! Prueba otra pregunta';
      hud();
      setTimeout(() => backToGame(), r.correct ? 1500 : 1700);
    });
    s.on('game-end', () => stop());
    s.on('fin:final', () => { input.l = false; input.r = false; stop(); });     // «¡FINAL!»: the dragons stop where they are
    bindControls();
  }

  // What the class just did, on my phone (js/party.js news at the top edge, never over the controls): my kingdom passing
  // ahead (my captain's line) or falling behind, a quarter / half / three quarters of the sky painted
  let leadNewsAt = 0;
  function news(events) {
    const P = window.DralyParty;
    if (!P || !events.length) return;
    const my = team();
    const cap = captains && captains[my];
    const C = window.DralingoCast;
    events.forEach((ev) => {
      if (ev.type === 'lead' && ev.team) {
        if (Date.now() - leadNewsAt < 7000) return;
        leadNewsAt = Date.now();
        if (ev.team === my) P.news('🔥 ¡Tu reino pasa adelante!', { sub: C && cap ? `${C.name(cap)}: «${C.line(cap, 'battle')}»` : '¡Sigan pintando!', kind: my, cast: cap, key: 'lead' });
        else P.news(`¡El ${ev.team === 'red' ? 'Fuego' : 'Mar'} pasa adelante!`, { sub: '¡A pintar! Pisa sus nubes y son tuyas', kind: ev.team, key: 'lead' });
      } else if (ev.type === 'milestone') {
        P.news(`🎨 ¡${ev.pct} % del cielo pintado!`, { sub: `Fuego ${scores.red || 0} · Mar ${scores.gold || 0} nubes`, kind: 'star', key: 'm' + ev.pct });
      }
    });
  }

  function spawn() {
    const sp = lv.spawns[team()] || lv.spawns.red;
    me = { x: sp[0] * lv.tile + (Math.random() * 40 - 20), y: (sp[1] - 2) * lv.tile, vx: 0, vy: 0, f: team() === 'red' ? 1 : 0, ground: false, jumps: 0, extra: 0 };
  }

  function backToGame() {
    if (!lv || !running) return;
    ctx.showScreen('paint');
    resize();
    hud();
  }

  function start() {
    running = true;
    ctx.showScreen('paint');
    canvas = $('pc-canvas');
    c2d = canvas.getContext('2d');
    resize();
    hud();
    lastT = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }
  function stop() { running = false; cancelAnimationFrame(raf); }

  function resize() {
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;               // hidden (question screen): keep the last good size
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
  }
  window.addEventListener('resize', resize);

  // ---------- controls ----------
  function bindControls() {
    const hold = (id, key) => {
      const el = $(id);
      if (!el) return;
      const on = (e) => { e.preventDefault(); if (helpOpen()) hideHelp(); input[key] = true; el.classList.add('down'); };
      const off = (e) => { e.preventDefault(); input[key] = false; el.classList.remove('down'); };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointerleave', off);
      el.addEventListener('pointercancel', off);
    };
    hold('pc-left', 'l');
    hold('pc-right', 'r');
    const jb = $('pc-jump');
    if (jb) jb.addEventListener('pointerdown', (e) => { e.preventDefault(); if (helpOpen()) hideHelp(); jump(); jb.classList.add('down'); setTimeout(() => jb.classList.remove('down'), 120); });
    ['pc-recharge', 'pc-empty-go'].forEach((id) => { const b = $(id); if (b) b.addEventListener('click', recharge); });
    const empty = $('pc-empty');
    if (empty) empty.addEventListener('click', (e) => { if (e.target === empty) recharge(); });
    const go = $('pc-help-go');
    if (go) go.addEventListener('click', hideHelp);
    document.addEventListener('keydown', (e) => {
      if (!running || !document.body.classList.contains('pc-on')) return;
      if (e.key === 'ArrowLeft') input.l = true;
      if (e.key === 'ArrowRight') input.r = true;
      if (e.key === 'ArrowUp' || e.key === ' ') { e.preventDefault(); jump(); }
    });
    document.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft') input.l = false;
      if (e.key === 'ArrowRight') input.r = false;
    });
  }
  function recharge() {
    if (!ctx) return;
    ctx.socket.emit('player:pc-ask', { pin: ctx.getPin() });
    if (ctx.markActivity) ctx.markActivity();
  }
  // First-play card: 3 pictured steps, once per game on this phone (a reload mid-game skips it).
  function showHelp() {
    const card = $('pc-help');
    if (!card) return;
    const key = 'pcHelp:' + (ctx.getPin ? ctx.getPin() : '');
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch (_) { /* private mode: show it */ }
    const my = team();
    $('pc-help-pose').src = POSE(my === 'red' ? 'fly-red' : 'fly');
    $('pc-help-title').textContent = my === 'red' ? '¡Eres del Reino del Fuego!' : '¡Eres del Reino del Mar!';
    const tile = $('pc-help-tile');
    if (tile) { tile.textContent = '🎨'; tile.className = 'pc-step-ico ' + my; }
    card.classList.remove('hidden');
  }
  function hideHelp() { const c = $('pc-help'); if (c) c.classList.add('hidden'); hud(); }
  const helpOpen = () => { const c = $('pc-help'); return !!c && !c.classList.contains('hidden'); };

  function jump() {
    if (!me || energy <= 0) return;
    const max = 2 + me.extra;              // jump + flap (+ gems)
    if (me.ground) { me.vy = -JUMP; me.jumps = 1; me.ground = false; }
    else if (me.jumps < max) { me.vy = -JUMP * 0.92; me.jumps += 1; if (me.jumps > 2) me.extra = Math.max(0, me.extra - 1); }
  }

  // ---------- simulation ----------
  function step(dt) {
    const hasFire = energy > 0;
    const dir = hasFire ? (input.r ? 1 : 0) - (input.l ? 1 : 0) : 0;
    me.vx = dir * SPEED;
    if (dir) me.f = dir > 0 ? 1 : 0;
    me.vy = Math.min(me.vy + G * dt, 1400);
    // horizontal
    me.x += me.vx * dt;
    const t = lv.tile;
    let tx0 = Math.floor((me.x - W / 2) / t), tx1 = Math.floor((me.x + W / 2 - 1) / t);
    let ty0 = Math.floor((me.y - H) / t), ty1 = Math.floor((me.y - 1) / t);
    for (let ty = ty0; ty <= ty1; ty++) {
      if (me.vx > 0 && isSolid(tx1, ty)) { me.x = tx1 * t - W / 2; break; }
      if (me.vx < 0 && isSolid(tx0, ty)) { me.x = (tx0 + 1) * t + W / 2; break; }
    }
    // vertical
    me.y += me.vy * dt;
    me.ground = false;
    tx0 = Math.floor((me.x - W / 2) / t); tx1 = Math.floor((me.x + W / 2 - 1) / t);
    if (me.vy >= 0) {
      const ty = Math.floor(me.y / t);
      for (let tx = tx0; tx <= tx1; tx++) {
        if (isSolid(tx, ty)) { me.y = ty * t; me.vy = 0; me.ground = true; me.jumps = 0; break; }
      }
    } else {
      const ty = Math.floor((me.y - H) / t);
      for (let tx = tx0; tx <= tx1; tx++) {
        if (isSolid(tx, ty)) { me.y = (ty + 1) * t + H; me.vy = 0; break; }
      }
    }
    if (me.y > (lv.rows + 4) * t) spawn();                 // fell through a hole: back home
    if (dir || !me.ground) {                                // flying/running burns fire; the server charges the same
      energy = Math.max(0, energy - dt);                    // seconds (sent as `spent`), so a laggy phone isn't charged
      spent += dt;                                          // for frames it never showed
    }
    // paint what we stand on
    if (me.ground && hasFire) {
      const row = Math.floor(me.y / t);
      const cx = Math.floor(me.x / t);
      const span = Date.now() < blazeUntil ? 2 : 0;
      for (let tx = cx - span; tx <= cx + span; tx++) {
        const id = row * lv.cols + tx;
        if (surf.has(id) && own[id] !== team()) { own[id] = team(); pendingPaint.push(id); }
      }
    }
    // gems
    gems.forEach((gm) => {
      if (gm.taken && Date.now() - gm.taken > 12000) gm.taken = 0;
      if (gm.taken) return;
      const gx = (gm.x + 0.5) * t, gy = (gm.y + 0.5) * t;
      if (Math.abs(gx - me.x) < 26 && Math.abs(gy - (me.y - H / 2)) < 30) {
        gm.taken = Date.now(); me.extra = Math.min(2, me.extra + 1);
        if (window.KingdomsSkin) window.KingdomsSkin.sfx('streak', 0.6);
      }
    });
    // others glide toward their last known position
    Object.values(others).forEach((o) => { o.x += (o.tx - o.x) * Math.min(1, dt * 10); o.y += (o.ty - o.y) * Math.min(1, dt * 10); });
  }

  function send(now) {
    if (now - lastSend < SEND_MS) return;
    lastSend = now;
    if (ctx.markActivity) ctx.markActivity();
    const moving = input.l || input.r || !me.ground;
    ctx.socket.emit('player:pc-pos', { pin: ctx.getPin(), x: me.x, y: me.y, f: me.f, moving: moving && energy > 0, spent: Math.round(spent * 1000) / 1000 });
    spent = 0;
    if (pendingPaint.length) {
      ctx.socket.emit('player:pc-paint', { pin: ctx.getPin(), tiles: pendingPaint.splice(0, 16) });
    }
  }

  // ---------- drawing ----------
  function draw() {
    const cw = canvas.width, ch = canvas.height;
    const t = lv.tile;
    const scale = (ch / (13 * t));                       // ~13 tiles tall on screen
    const vw = cw / scale, vh = ch / scale;
    let camX = me.x - vw / 2, camY = me.y - vh * 0.58;
    camX = Math.max(0, Math.min(lv.cols * t - vw, camX));
    camY = Math.max(-2 * t, Math.min(lv.rows * t - vh, camY));
    const g = c2d;
    g.setTransform(1, 0, 0, 1, 0, 0);
    window.PaintRender.sky(g, cw, ch);
    g.setTransform(scale, 0, 0, scale, -camX * scale, -camY * scale);
    // soft background clouds (parallax)
    g.fillStyle = 'rgba(255,255,255,.55)';
    for (let i = 0; i < 9; i++) {
      const bx = ((i * 431) % (lv.cols * t)) + camX * 0.45;
      const by = 80 + (i * 137) % (lv.rows * t * 0.6);
      g.beginPath(); g.arc(bx, by, 46, 0, 7); g.arc(bx + 40, by + 8, 36, 0, 7); g.arc(bx - 38, by + 10, 32, 0, 7); g.fill();
    }
    const x0 = Math.max(0, Math.floor(camX / t)), x1 = Math.min(lv.cols - 1, Math.ceil((camX + vw) / t));
    const y0 = Math.max(0, Math.floor(camY / t)), y1 = Math.min(lv.rows - 1, Math.ceil((camY + vh) / t));
    window.PaintRender.tiles(g, lv, solid, surf, own, x0, x1, y0, y1, 3);
    window.PaintRender.flags(g, lv, 3);
    // gems
    const now = Date.now();
    gems.forEach((gm) => {
      if (gm.taken) return;
      const gx = (gm.x + 0.5) * t, gy = (gm.y + 0.5) * t + Math.sin(now / 300 + gm.x) * 4;
      g.save(); g.translate(gx, gy); g.rotate(Math.PI / 4);
      g.fillStyle = '#36c26b'; g.strokeStyle = '#1d2440'; g.lineWidth = 3;
      g.fillRect(-9, -9, 18, 18); g.strokeRect(-9, -9, 18, 18); g.restore();
    });
    // other dragons
    g.font = '800 13px Nunito, sans-serif'; g.textAlign = 'center';
    Object.entries(others).forEach(([id, o]) => {
      drawDragon(g, IMG.jump[o.team] || IMG.jump.gold, o.x, o.y, o.f, COL[o.team], 46);
      if (names[id]) { g.fillStyle = '#1d2440'; g.fillText(names[id], o.x, o.y - 52); }
    });
    // me
    const blaze = now < blazeUntil;
    if (blaze) { g.fillStyle = 'rgba(255,140,0,.35)'; g.beginPath(); g.arc(me.x, me.y - 22, 40 + Math.sin(now / 80) * 4, 0, 7); g.fill(); }
    drawDragon(g, IMG.fly[team()] || IMG.fly.gold, me.x, me.y, me.f, COL[team()], 60);
  }
  function drawDragon(g, img, x, y, f, color, size) {
    g.fillStyle = color; g.globalAlpha = 0.35;
    g.beginPath(); g.ellipse(x, y - 2, size * 0.34, 6, 0, 0, 7); g.fill(); g.globalAlpha = 1;
    if (img.complete && img.naturalWidth) {
      g.save(); g.translate(x, y - size * 0.5);
      if (!f) g.scale(-1, 1);
      g.drawImage(img, -size / 2, -size / 2, size, size); g.restore();
    } else { g.fillStyle = color; g.beginPath(); g.arc(x, y - 16, 14, 0, 7); g.fill(); }
  }

  // ---------- HUD ----------
  let hudKey = '';
  function hud() {
    const fill = $('pc-energy-fill');
    if (fill) fill.style.width = Math.max(0, Math.min(100, (energy / energyMax) * 100)) + '%';
    // Everything below only changes on whole seconds or score changes: skip the DOM work otherwise (cheap phones).
    const key = [Math.ceil(Math.max(0, energy)), energy < 4, energy <= 0, running, helpOpen(), scores.red || 0, scores.gold || 0, team(), myClouds].join('|');
    if (key === hudKey) return;
    hudKey = key;
    const et = $('pc-energy-text');
    if (et) et.textContent = energy > 0 ? '🔥 ' + Math.ceil(energy) + ' s de fuego' : '🔥 ¡Sin fuego!';
    const rb = $('pc-recharge');
    if (rb) rb.classList.toggle('urgent', energy < 4);
    const sub = $('pc-recharge-sub');
    if (sub) sub.textContent = energy <= 0 ? '¡Toca aquí y responde!' : energy < 4 ? '¡Poco fuego! Responde ya' : 'Responde una pregunta';
    const empty = $('pc-empty');
    if (empty) empty.classList.toggle('hidden', !(running && energy <= 0 && !helpOpen()));
    const bar = $('pc-score');
    if (bar) {
      const my = team();
      bar.innerHTML = '';
      const a = document.createElement('span'); a.className = 'pc-s red' + (my === 'red' ? ' me' : ''); a.textContent = '🔥 ' + (scores.red || 0);
      const b = document.createElement('span'); b.className = 'pc-s gold' + (my === 'gold' ? ' me' : ''); b.textContent = (scores.gold || 0) + ' 🌊';
      bar.append(a, b);
      if (myClouds > 0) { const m = document.createElement('span'); m.className = 'pc-s pc-mine'; m.textContent = '☁️ ' + myClouds; m.title = 'Tus nubes'; bar.appendChild(m); }
    }
  }

  function loop(now) {
    if (!running) return;
    const dt = Math.min(0.1, (now - lastT) / 1000);
    lastT = now;
    if (lv && me && document.body.classList.contains('pc-on') && !$('screen-paint').classList.contains('hidden') && paused) {
      draw();                      // paused: the sky stays on screen, nothing moves
    } else if (lv && me && document.body.classList.contains('pc-on') && !$('screen-paint').classList.contains('hidden')) {
      // ≤ 1/60 s per step: a dragon never moves more than ~23 px per step, less than a tile, so it can't tunnel
      for (let rem = dt; rem > 1e-6; rem -= 1 / 60) step(Math.min(rem, 1 / 60));
      send(now);
      draw();
      if (Math.random() < 0.1) hud();
    }
    raf = requestAnimationFrame(loop);
  }

  window.PaintPhone = {
    init,
    debug: () => ({ me, energy, input, running, blaze: Date.now() < blazeUntil }),
    // Test hook: headless QA browsers barely deliver animation frames, so step the simulation by hand.
    //   PaintPhone.advance(1.2, { r: true })  → run right for 1.2 s, send, draw
    advance: (sec, keys) => {
      if (!lv || !me) return null;
      Object.assign(input, keys || {});
      for (let k = 0; k < Math.round(sec * 60); k++) step(1 / 60);
      lastSend = 0;
      send(performance.now());
      draw();
      hud();
      return { x: Math.round(me.x), y: Math.round(me.y), ground: me.ground, energy: Math.round(energy * 10) / 10, painted: Object.keys(own).length };
    },
    jump: () => jump(),
  };
})();
