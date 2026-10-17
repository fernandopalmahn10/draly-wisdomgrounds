// Dragones Pintores v2 «El Cielo de las Maravillas» — what the phone (js/player-paint.js) and the projector
// (js/host-paint.js) both draw, on one canvas each:
//   · the round's WORLD (js/paint-worlds.js): its far background and its mid strip (Higgsfield art, parallax on the
//     phone), drifting sky props (lanterns, a crane, kites, balloons), fireworks on the night worlds in the last 30 s
//   · the three landmark ISLANDS (the prizes): the picture bobbing, its capture ring (a meter in the pushing kingdom's
//     colour), a glow + a big flag in the owner's colour; a dragon hovering in a ring circles the island (drawn on the
//     ring's edge, so the landmark stays in view and «stay in the ring» reads as «circle it»)
//   · the CLOUDS: fluffy art clouds, white until painted; painted = tinted with glowing fire red / sea blue, a pop and a
//     splash when they change colour
//   · the DRAGONS: the Vuelo dragoncitos (3 flying frames, red / blue) with the kid's saga character seated on the back,
//     a team-colour glow under them, a paint trail; on the phone mine is big and on top with «TÚ», the others smaller
//   · name tags that never overlap (priority first; on the phone only the dragons near me), the tap ripple
// Motion: every dragon glides toward the server's position, extrapolated along its flight (same speed as the server);
// frozen during a pause and after «¡FINAL!». The phone draws only what its camera sees.
// window.PaintRender = { Scene, load, pic, ready, worldOf, COL, frameUrl, riderUrl, cloudUrl, DR_W, DR_H }.
(function (root) {
  'use strict';
  const PW = () => root.PaintWorlds;
  const HB = () => root.HalconBoard;
  const mq = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reduced = () => !!(mq && mq.matches);
  const INK = '#1d2440';
  const COL = {
    red: { c: '#ff4a2e', d: '#b3200e', l: '#ffb08a', glow: 'rgba(255,96,40,0.85)', soft: 'rgba(255,96,40,0.35)', name: 'Fuego' },
    gold: { c: '#2f86ff', d: '#1846b8', l: '#9fd0ff', glow: 'rgba(60,150,255,0.85)', soft: 'rgba(60,150,255,0.35)', name: 'Mar' },
  };
  const DR_W = 104, DR_H = 81;            // a dragoncito in world units (frames are 400×312)
  const RIDER_H = 62;

  // ---------- pictures ----------
  const PIC = {};
  function pic(url) {
    if (!url) return null;
    let im = PIC[url];
    if (!im) { im = new Image(); im.decoding = 'async'; im.src = url; PIC[url] = im; }
    return im;
  }
  const ready = (im) => !!(im && im.complete && im.naturalWidth);
  const worldOf = (i) => (PW() ? PW().world(i) : null);
  const frameUrl = (team, f) => '/assets/dragon/fly-' + (team === 'gold' ? 'blue' : 'red') + '-' + f + '.webp';
  const riderUrl = (skin) => (HB() ? HB().art(skin, 'idle') : '/assets/dralingo/hello.webp');
  const cloudUrl = (s) => '/assets/paint/clouds/c' + ((s % 4) + 1) + '.webp';
  const propUrl = (p) => '/assets/paint/props/' + p + '.webp';
  function load(worldIdx) {
    const w = worldOf(worldIdx);
    if (!w) return;
    pic(PW().art(w, 'bg')); pic(PW().art(w, 'mid'));
    w.lms.forEach((l) => pic(PW().art(w, l.id)));
    (w.props || []).forEach((p) => pic(propUrl(p)));
    for (let s = 0; s < 4; s++) pic(cloudUrl(s));
    ['red', 'gold'].forEach((t) => ['up', 'mid', 'down'].forEach((f) => pic(frameUrl(t, f))));
  }

  // painted clouds: the white art tinted (light top → deep bottom) with a glow, made once per shape and kingdom
  const TINT = {};
  function tinted(s, team) {
    const key = s + team;
    if (TINT[key]) return TINT[key];
    const im = pic(cloudUrl(s));
    if (!ready(im)) return null;
    const W = 256, H = Math.round((256 * im.naturalHeight) / im.naturalWidth), pad = 26;
    const cv = document.createElement('canvas');
    cv.width = W + pad * 2; cv.height = H + pad * 2;
    const g = cv.getContext('2d');
    const body = document.createElement('canvas');
    body.width = W; body.height = H;
    const b = body.getContext('2d');
    b.drawImage(im, 0, 0, W, H);
    b.globalCompositeOperation = 'source-atop';
    const gr = b.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, COL[team].l); gr.addColorStop(0.55, COL[team].c); gr.addColorStop(1, COL[team].d);
    b.globalAlpha = 0.78;
    b.fillStyle = gr;
    b.fillRect(0, 0, W, H);
    b.globalAlpha = 1;
    b.globalCompositeOperation = 'source-over';
    g.shadowColor = COL[team].glow;
    g.shadowBlur = 22;
    g.drawImage(body, pad, pad);
    g.shadowBlur = 0;
    g.drawImage(body, pad, pad);
    TINT[key] = { cv, pad: pad / W };
    return TINT[key];
  }
  // a white cloud in the world's light (a soft wash over the art, same size and padding as the painted copies)
  function washed(s, color) {
    const key = s + '|' + color;
    if (TINT[key]) return TINT[key];
    const im = pic(cloudUrl(s));
    if (!ready(im)) return null;
    const W = 256, H = Math.round((256 * im.naturalHeight) / im.naturalWidth), pad = 26;
    const cv = document.createElement('canvas');
    cv.width = W + pad * 2; cv.height = H + pad * 2;
    const g = cv.getContext('2d');
    g.drawImage(im, pad, pad, W, H);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = color;
    g.fillRect(0, 0, cv.width, cv.height);
    g.globalCompositeOperation = 'source-over';
    TINT[key] = { cv, pad: pad / W };
    return TINT[key];
  }
  // soft glows made once (a Llamarada's flames, the team glow under a dragon): no gradient built every frame
  const GLOW = {};
  function glow(key, inner, outer) {
    if (GLOW[key]) return GLOW[key];
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, inner); gr.addColorStop(1, outer);
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    GLOW[key] = cv;
    return cv;
  }

  // ---------- the scene ----------
  // opts: { mode: 'phone' | 'host' }
  class Scene {
    constructor(canvas, opts) {
      this.cv = canvas;
      this.g = canvas.getContext('2d');
      this.mode = (opts && opts.mode) || 'phone';
      this.sky = null;
      this.world = null;
      this.own = [];
      this.pop = {};             // cloud → time it changed colour (the pop)
      this.lm = [];              // [[v, owner code]]
      this.lmFlash = {};         // island → { t, team } (a capture burst)
      this.dragons = {};         // k → { k, name, team, skin, x, y, sx, sy, tx, ty, st, f, trail: [], ox, oy }
      this.meD = null;
      this.parts = [];           // splash particles
      this.ripple = null;        // { x, y, t }
      this.speed = [300, 360];
      this.dpr = 1;
      this.w = 1; this.h = 1;
      this.view = { cx: 800, cy: 500, s: 0.7 };
      this.frenzy = false;
      this.frozen = false;       // a pause / «¡FINAL!»: no dragon drifts on
      this.fw = [];              // fireworks
      this.labels = true;
      this.crowns = {};          // k → true (the projector's top painter of each kingdom)
      this.inset = { top: 0, bottom: 0 };
    }
    setSky(sky) {
      this.sky = sky;
      this.world = worldOf(sky.world);
      this.own = new Array(sky.clouds.length).fill(0);
      this.lm = sky.lms.map(() => [0, 0]);
      this.pop = {};
      this.parts = [];
      Object.values(this.dragons).forEach((d) => { d.trail = []; });
      load(sky.world);
    }
    resize() {
      const r = this.cv.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false;
      this.dpr = Math.min(this.mode === 'host' ? 1.5 : 2, root.devicePixelRatio || 1);
      this.w = r.width; this.h = r.height;
      const W = Math.round(r.width * this.dpr), H = Math.round(r.height * this.dpr);
      if (this.cv.width !== W || this.cv.height !== H) { this.cv.width = W; this.cv.height = H; }
      return true;
    }
    // ownership: codes 0 white, 1 Fuego, 2 Mar
    setOwn(arr) { (arr || []).forEach((c, i) => { this.own[i] = c; }); }
    paint(i, code, now, quiet) {
      if (this.own[i] === code) return false;
      this.own[i] = code;
      if (!quiet) {
        this.pop[i] = now;
        if (code && this.sky) this.splash(this.sky.clouds[i][0], this.sky.clouds[i][1], code === 1 ? 'red' : 'gold', 10);
      }
      return true;
    }
    setIslands(lm) { if (lm) this.lm = lm.map((x) => [x[0], x[1]]); }
    flashIsland(i, team, now) { this.lmFlash[i] = { t: now, team }; const l = this.sky && this.sky.lms[i]; if (l) this.splash(l.x, l.y - 30, team, 26, 1.8); }
    splash(x, y, team, n, power) {
      if (reduced()) return;
      const k = power || 1;
      for (let j = 0; j < n && this.parts.length < 220; j++) {
        const a = Math.random() * Math.PI * 2, v = (80 + Math.random() * 160) * k;
        this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.5 + Math.random() * 0.4, age: 0, r: 4 + Math.random() * 6 * k, c: Math.random() < 0.3 ? '#fff6c8' : COL[team].c });
      }
    }
    // the roster from pc:init / pc:roster: { k: [name, team, avatar] } (a dragon not in it leaves the sky)
    roster(r) {
      Object.entries(r || {}).forEach(([k, v]) => {
        const d = this.dragons[k] || (this.dragons[k] = { k: +k, x: null, y: null, trail: [] });
        d.name = v[0]; d.team = v[1]; d.skin = HB() ? HB().skinFor(v[2], v[0]) : 'dralingo';
        pic(riderUrl(d.skin));
      });
      Object.keys(this.dragons).forEach((k) => { if (!r[k]) delete this.dragons[k]; });
    }
    // the positions from pc:pos: [[k, x, y, tx, ty, flags]] (only the dragons that moved; every one every 2 s)
    positions(arr, nowPerf) {
      (arr || []).forEach(([k, x, y, tx, ty, f]) => {
        const d = this.dragons[k] || (this.dragons[k] = { k, x: null, y: null, trail: [] });
        d.sx = x; d.sy = y; d.tx = tx; d.ty = ty; d.f = f; d.st = nowPerf;
        if (d.x == null || Math.hypot(d.x - x, d.y - y) > 600) { d.x = x; d.y = y; }
        if (tx < x - 0.5) d.face = -1; else if (tx > x + 0.5) d.face = 1; else if (f & 8) d.face = -1; else if (d.face == null) d.face = d.team === 'gold' ? -1 : 1;
      });
    }
    // where the server's dragon is now: its last position moved along its flight at its speed
    predicted(d, nowPerf) {
      if (d.sx == null) return null;
      if (this.frozen) return [d.sx, d.sy];
      const dt = Math.min(0.5, Math.max(0, (nowPerf - d.st) / 1000));
      const dx = d.tx - d.sx, dy = d.ty - d.sy, dist = Math.hypot(dx, dy);
      if ((d.f & 6) || dist < 0.5) return [d.sx, d.sy];
      const step = Math.min(dist, (d.f & 1 ? this.speed[1] : this.speed[0]) * dt);
      return [d.sx + (dx / dist) * step, d.sy + (dy / dist) * step];
    }

    // ---------- one frame ----------
    // view: { cx, cy, s } (world point at the screen centre of the safe area, px per world unit); host: fit the sky
    frame(nowPerf, dt) {
      if (!this.sky) return;
      const g = this.g, dpr = this.dpr, sky = this.sky;
      const t = nowPerf / 1000;
      const still = this.still = reduced();
      // ---- motion ----
      Object.values(this.dragons).forEach((d) => {
        if (d === this.meD) return;
        const p = this.predicted(d, nowPerf);
        if (!p) return;
        if (d.x == null) { d.x = p[0]; d.y = p[1]; }
        const k = still ? 1 : 1 - Math.exp(-dt / 0.12);
        d.x += (p[0] - d.x) * k; d.y += (p[1] - d.y) * k;
      });
      const ek = still ? 1 : 1 - Math.exp(-dt / 0.3);
      Object.values(this.dragons).forEach((d) => {
        if (d.x == null) return;
        const last = d.trail[d.trail.length - 1];
        if (!last || Math.hypot(last[0] - d.x, last[1] - d.y) > 9) { d.trail.push([d.x, d.y, nowPerf]); if (d.trail.length > 14) d.trail.shift(); }
        while (d.trail.length && nowPerf - d.trail[0][2] > 520) d.trail.shift();
        d.moving = !!d.trail.length && nowPerf - d.trail[d.trail.length - 1][2] < 140;
        // hovering in an island's ring: drawn circling on the ring's edge (the landmark stays in view)
        let ox = 0, oy = 0;
        if (!d.moving) {
          sky.lms.forEach((l) => {
            if (ox || oy || Math.hypot(d.x - l.x, d.y - l.y) > l.r) return;
            const a = d.k * 2.39 + (still ? 0 : t * 0.55);
            ox = l.x + Math.cos(a) * l.r * 0.82 - d.x;
            oy = l.y + 18 + Math.sin(a) * l.r * 0.45 - d.y;
          });
        }
        d.ox = (d.ox || 0) + (ox - (d.ox || 0)) * ek;
        d.oy = (d.oy || 0) + (oy - (d.oy || 0)) * ek;
        d.dx = d.x + d.ox; d.dy = d.y + d.oy;
      });
      this.parts.forEach((p) => { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.vx *= 0.97; });
      this.parts = this.parts.filter((p) => p.age < p.life);

      // ---- camera ----
      const W = this.w, H = this.h;
      let s, ox, oy;
      if (this.mode === 'host') {
        s = Math.min(W / sky.w, H / sky.h);
        ox = (W - sky.w * s) / 2; oy = (H - sky.h * s) / 2;
      } else {
        s = this.view.s;
        const safeTop = this.inset.top, safeH = Math.max(40, H - this.inset.top - this.inset.bottom);
        ox = W / 2 - this.view.cx * s;
        oy = safeTop + safeH / 2 - this.view.cy * s;
      }
      this.cam = { s, ox, oy };
      // what the camera sees, in world units (+ a margin): the phone skips the rest
      const vis = { x0: -ox / s - 160, x1: (W - ox) / s + 160, y0: -oy / s - 200, y1: (H - oy) / s + 160 };
      this.vis = vis;
      const seen = (x, y) => x > vis.x0 && x < vis.x1 && y > vis.y0 && y < vis.y1;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      // ---- the far sky ----
      const w = this.world;
      const bg = w && pic(PW().art(w, 'bg'));
      if (ready(bg)) {
        if (this.mode === 'host') {
          // cover the whole canvas (the sky rect sits in the middle)
          const sc = Math.max(W / bg.naturalWidth, H / bg.naturalHeight);
          g.drawImage(bg, (W - bg.naturalWidth * sc) / 2, (H - bg.naturalHeight * sc) / 2, bg.naturalWidth * sc, bg.naturalHeight * sc);
        } else {
          // parallax: the picture spans the sky's height (a little more) and slides at 35 % of the camera
          const bh = Math.max(H, sky.h * s * 1.06), bw = (bh * bg.naturalWidth) / bg.naturalHeight;
          const span = Math.max(0, bw - W);
          const camT = Math.max(0, Math.min(1, (this.view.cx - W / (2 * s)) / Math.max(1, sky.w - W / s)));
          g.drawImage(bg, -span * (0.18 + 0.64 * camT), Math.min(0, oy + (sky.h * s - bh) * 0.55), bw, bh);
        }
      } else {
        const gr = g.createLinearGradient(0, 0, 0, H);
        const c = (w && w.sky) || ['#9fdcf7', '#c6ecfb', '#fde4ec'];
        gr.addColorStop(0, c[0]); gr.addColorStop(0.6, c[1]); gr.addColorStop(1, c[2]);
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
      }
      // world space from here
      g.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
      // ---- props drifting far away ----
      if (w && w.props) {
        w.props.forEach((p, i) => {
          const im = pic(propUrl(p));
          if (!ready(im)) return;
          const hh = p === 'balloon' ? 96 : p === 'crane' ? 70 : p === 'kite' ? 90 : 62;
          const ww = (hh * im.naturalWidth) / im.naturalHeight;
          const dir = i % 2 ? -1 : 1, sp = 9 + i * 4;
          const span = sky.w + 400;
          const x = ((((still ? 0 : t) * sp * dir + i * 610) % span) + span) % span - 200;
          const y = 90 + ((i * 263) % 420) + Math.sin(t * 0.6 + i) * (still ? 0 : 10);
          if (!seen(x, y)) return;
          g.globalAlpha = 0.9;
          g.save(); g.translate(x, y); if (dir < 0 && p !== 'balloon' && p !== 'lantern' && p !== 'skylantern') g.scale(-1, 1);
          g.drawImage(im, -ww / 2, -hh / 2, ww, hh); g.restore();
          g.globalAlpha = 1;
        });
      }
      // ---- fireworks (night worlds, the last 30 s) ----
      if (this.frenzy && w && w.fireworks && !still) this.fireworks(g, t, dt);
      // ---- the ground of the world: only its top ~55 % shows above the sky's bottom edge (the clouds float above it) ----
      const mid = w && pic(PW().art(w, 'mid'));
      if (ready(mid)) {
        const mw = sky.w * (this.mode === 'host' ? 1.0 : 1.18);
        const mh = (mw * mid.naturalHeight) / mid.naturalWidth;
        const shift = this.mode === 'host' ? 0 : -(this.view.cx - sky.w / 2) * 0.18 - (mw - sky.w) / 2;
        g.drawImage(mid, shift, sky.h - Math.min(mh * 0.58, sky.h * 0.3), mw, mh);
      }
      // ---- islands ----
      sky.lms.forEach((l, i) => { if (seen(l.x, l.y)) this.island(g, l, i, t, nowPerf); });
      // ---- clouds ----
      this.clouds(g, nowPerf, seen);
      // ---- trails, the tap ripple ----
      Object.values(this.dragons).forEach((d) => { if (d.x != null && seen(d.x, d.y)) this.trail(g, d, nowPerf); });
      if (this.ripple && this.mode === 'phone') this.drawRipple(g, nowPerf);
      // ---- dragons (mine last, on top) ----
      const list = Object.values(this.dragons).filter((d) => d.x != null && seen(d.dx, d.dy)).sort((a, b) => (a === this.meD) - (b === this.meD) || a.dy - b.dy);
      list.forEach((d) => this.dragon(g, d, t));
      // ---- splash particles ----
      this.parts.forEach((p) => {
        g.globalAlpha = Math.max(0, 1 - p.age / p.life);
        g.fillStyle = p.c;
        g.beginPath(); g.arc(p.x, p.y, p.r * (1 - 0.5 * p.age / p.life), 0, 7); g.fill();
      });
      g.globalAlpha = 1;
      // ---- name tags (screen space, never overlapping) ----
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (this.labels) this.tags(g, list);
    }

    island(g, l, i, t, nowPerf) {
      const w = this.world;
      const host = this.mode === 'host';
      const im = w && pic(PW().art(w, l.id));
      const st = this.lm[i] || [0, 0];
      const v = st[0], owner = st[1] === 1 ? 'red' : st[1] === 2 ? 'gold' : null;
      const still = this.still;
      const bob = still ? 0 : Math.sin(t * 0.9 + i * 2.1) * 6;
      // glow under an owned island
      if (owner) {
        const gc = glow('isl' + owner, COL[owner].soft.replace('0.35', '0.6'), 'rgba(0,0,0,0)');
        g.drawImage(gc, l.x - l.r * 1.3, l.y + 10 - l.r * 1.3, l.r * 2.6, l.r * 2.6);
      }
      // the ring: a soft circle (dashed while nobody holds it) + the meter in the pushing kingdom's colour
      g.lineWidth = host ? 12 : 8;
      g.strokeStyle = owner ? COL[owner].l : 'rgba(255,255,255,0.7)';
      g.setLineDash(owner ? [] : [18, 14]);
      g.beginPath(); g.arc(l.x, l.y, l.r, 0, 7); g.stroke();
      g.setLineDash([]);
      if (Math.abs(v) > 0.005) {
        const team = v > 0 ? 'red' : 'gold';
        g.lineWidth = host ? 18 : 13;
        g.lineCap = 'round';
        g.strokeStyle = COL[team].c;
        if (host) { g.shadowColor = COL[team].glow; g.shadowBlur = 16; }
        g.beginPath(); g.arc(l.x, l.y, l.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, Math.abs(v))); g.stroke();
        g.shadowBlur = 0;
        g.lineCap = 'butt';
      }
      // the picture
      if (ready(im)) {
        const hh = l.h, ww = (hh * im.naturalWidth) / im.naturalHeight;
        g.drawImage(im, l.x - ww / 2, l.y - hh * 0.62 + bob, ww, hh);
      } else {
        g.fillStyle = 'rgba(255,255,255,0.8)';
        g.beginPath(); g.ellipse(l.x, l.y + 30, l.r * 0.7, 26, 0, 0, 7); g.fill();
      }
      // the owner's flag, big, on the ring
      if (owner) {
        const fx = l.x + l.r * 0.74, fy = l.y - l.r * 0.66, k = host ? 2 : 1.7;
        g.strokeStyle = INK; g.lineWidth = 3 * k;
        g.beginPath(); g.moveTo(fx, fy + 22 * k); g.lineTo(fx, fy - 26 * k); g.stroke();
        g.fillStyle = COL[owner].c;
        g.beginPath(); g.moveTo(fx, fy - 26 * k); g.lineTo(fx + 34 * k, fy - 14 * k); g.lineTo(fx, fy - 2 * k); g.closePath(); g.fill();
        g.lineWidth = 2.5 * k; g.stroke();
      }
      // a capture burst: rings spreading out
      const fl = this.lmFlash[i];
      if (fl && !still) {
        const a = (nowPerf - fl.t) / 900;
        if (a >= 1) delete this.lmFlash[i];
        else {
          g.strokeStyle = COL[fl.team].c;
          g.globalAlpha = 1 - a;
          g.lineWidth = 12 * (1 - a) + 2;
          g.beginPath(); g.arc(l.x, l.y, l.r * (1 + a * 0.9), 0, 7); g.stroke();
          g.globalAlpha = 1;
        }
      }
    }

    clouds(g, nowPerf, seen) {
      const sky = this.sky;
      const tint = this.world && this.world.cloudTint;
      const still = this.still;
      sky.clouds.forEach(([x, y, r, sh], i) => {
        if (!seen(x, y)) return;
        const code = this.own[i];
        const pp = this.pop[i];
        let k = 1;
        if (pp != null && !still) {
          const a = (nowPerf - pp) / 340;
          if (a >= 1) delete this.pop[i]; else k = 1 + 0.22 * Math.sin(a * Math.PI);
        }
        const im = pic(cloudUrl(sh));
        const ww = r * 2.5 * k;
        if (ready(im)) {
          const hh = (ww * im.naturalHeight) / im.naturalWidth;
          // painted: the tinted, glowing copy; white: the world's light on it (night blue, sunset peach)
          const tc = code ? tinted(sh, code === 1 ? 'red' : 'gold') : tint ? washed(sh, tint) : null;
          if (tc) {
            const scale = ww / 256;
            g.drawImage(tc.cv, x - (tc.cv.width * scale) / 2, y - (tc.cv.height * scale) / 2, tc.cv.width * scale, tc.cv.height * scale);
            return;
          }
          g.drawImage(im, x - ww / 2, y - hh / 2, ww, hh);
        } else {
          // until the art arrives: three puffs
          g.fillStyle = code === 1 ? COL.red.c : code === 2 ? COL.gold.c : '#ffffff';
          g.beginPath(); g.arc(x, y, r * 0.62 * k, 0, 7); g.arc(x - r * 0.55 * k, y + r * 0.18, r * 0.45 * k, 0, 7); g.arc(x + r * 0.55 * k, y + r * 0.15, r * 0.5 * k, 0, 7);
          g.fill();
        }
      });
    }

    trail(g, d, nowPerf) {
      if (!d.trail || d.trail.length < 2 || !d.team || !COL[d.team]) return;
      const c = COL[d.team];
      const blaze = d.f & 1;
      for (let i = 1; i < d.trail.length; i++) {
        const a = d.trail[i - 1], b = d.trail[i];
        const age = (nowPerf - b[2]) / 520;
        g.globalAlpha = Math.max(0, 0.55 * (1 - age));
        g.strokeStyle = blaze ? '#ffd23a' : c.c;
        g.lineWidth = (blaze ? 30 : 16) * (1 - age * 0.7);
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(a[0], a[1] + 8); g.lineTo(b[0], b[1] + 8); g.stroke();
      }
      g.globalAlpha = 1;
      g.lineCap = 'butt';
    }

    drawRipple(g, nowPerf) {
      const rp = this.ripple;
      const a = (nowPerf - rp.t) / 900;
      if (a > 1.6) { this.ripple = null; return; }
      const col = this.meD && COL[this.meD.team] ? COL[this.meD.team].c : '#fff';
      for (let j = 0; j < 2; j++) {
        const aa = a - j * 0.3;
        if (aa < 0 || aa > 1) continue;
        g.globalAlpha = 1 - aa;
        g.strokeStyle = '#fff';
        g.lineWidth = 6;
        g.beginPath(); g.arc(rp.x, rp.y, 14 + aa * 46, 0, 7); g.stroke();
        g.strokeStyle = col;
        g.lineWidth = 3;
        g.stroke();
      }
      g.globalAlpha = 1;
      // a dotted line from my dragon to the target while I fly there
      const me = this.meD;
      if (me && me.moving) {
        g.setLineDash([6, 12]);
        g.strokeStyle = 'rgba(255,255,255,0.75)';
        g.lineWidth = 4;
        g.beginPath(); g.moveTo(me.dx, me.dy); g.lineTo(rp.x, rp.y); g.stroke();
        g.setLineDash([]);
      }
    }

    // scale of a dragon on this screen: the projector draws all of them big; the phone, mine big and the others smaller
    kOf(d) {
      if (this.mode === 'host') return 1.3;
      return d === this.meD ? 1.45 : 0.85;
    }
    dragon(g, d, t) {
      const me = d === this.meD;
      const k = this.kOf(d);
      const w = DR_W * k, h = DR_H * k;
      const away = d.f & 4, noFire = d.f & 2;
      const still = this.still;
      const flap = d.moving && !noFire && !still ? Math.floor(t * 9 + d.k) % 4 : -1;
      const f = flap < 0 ? 'mid' : ['up', 'mid', 'down', 'mid'][flap];
      const im = pic(frameUrl(d.team, f));
      const bob = still ? 0 : Math.sin(t * 2.4 + d.k) * (d.moving ? 2 : 5);
      const x = d.dx, y = d.dy + bob;
      const base = away ? 0.35 : noFire ? 0.7 : 1;
      g.globalAlpha = base * (this.mode === 'phone' && !me ? 0.88 : 1);
      // the team glow under the dragon and its rider (one pair, one kingdom)
      if (COL[d.team]) {
        const gc = glow('dr' + d.team, COL[d.team].soft, 'rgba(0,0,0,0)');
        g.drawImage(gc, x - w * 0.62, y - h * 0.15, w * 1.24, h * 0.9);
      }
      // my ring
      if (me) {
        const pulse = still ? 0 : (Math.sin(t * 5) + 1) * 0.5;
        g.strokeStyle = '#ffffff'; g.lineWidth = 7;
        g.beginPath(); g.ellipse(x, y + h * 0.42, w * 0.56 + pulse * 6, h * 0.2 + pulse * 2, 0, 0, 7); g.stroke();
        g.strokeStyle = COL[d.team] ? COL[d.team].c : '#fff'; g.lineWidth = 4; g.stroke();
      }
      // the rider, seated on the back (feet hidden behind the dragon's body), a little behind its head
      const rim = pic(riderUrl(d.skin));
      if (ready(rim)) {
        const rh = RIDER_H * k, rw = (rh * rim.naturalWidth) / rim.naturalHeight;
        g.drawImage(rim, x - rw / 2 - (d.face < 0 ? -1 : 1) * w * 0.08, y + h * 0.08 - rh, rw, rh);
      }
      if (ready(im)) {
        g.save(); g.translate(x, y); if (d.face < 0) g.scale(-1, 1);
        g.drawImage(im, -w / 2, -h / 2, w, h);
        g.restore();
      } else {
        g.fillStyle = COL[d.team] ? COL[d.team].c : '#888';
        g.beginPath(); g.ellipse(x, y, w * 0.35, h * 0.3, 0, 0, 7); g.fill();
      }
      // a Llamarada: flames round the dragon
      if ((d.f & 1) && !still) {
        g.globalAlpha = 0.55 + 0.2 * Math.sin(t * 20);
        const gc = glow('blaze', 'rgba(255,200,60,0.55)', 'rgba(255,80,20,0)');
        g.drawImage(gc, x - w * 0.8, y - w * 0.8, w * 1.6, w * 1.6);
      }
      g.globalAlpha = 1;
    }

    // name tags in screen space: priority first (mine, the crowns, then near me / the centre); a tag that would overlap
    // hides; on the phone only the dragons near mine get one (the sky stays readable)
    tags(g, list) {
      const cam = this.cam;
      const host = this.mode === 'host';
      const fs = host ? 16 : 12;
      g.textBaseline = 'middle';
      g.textAlign = 'center';
      const placed = [];
      const me = this.meD;
      const mx = me && me.dx != null ? cam.ox + me.dx * cam.s : this.w / 2, my = me && me.dy != null ? cam.oy + me.dy * cam.s : this.h / 2;
      const items = list.filter((d) => d.name).map((d) => {
        const sx = cam.ox + d.dx * cam.s, sy = cam.oy + d.dy * cam.s;
        const isMe = d === me;
        const pr = isMe ? -1e9 : this.crowns[d.k] ? -1e8 : Math.hypot(sx - mx, sy - my);
        return { d, sx, sy, me: isMe, pr };
      }).sort((a, b) => a.pr - b.pr);
      const max = host ? 40 : 8;
      let n = 0;
      // my dragon and its rider first: no other kid's name ever sits on them (the phone)
      if (me && !host && me.dx != null) {
        const k = this.kOf(me), w = DR_W * k * cam.s, hh = (DR_H * 0.5 + RIDER_H * 0.75) * k * cam.s;
        placed.push([mx - w / 2, my - hh, w, hh + DR_H * 0.5 * k * cam.s]);
      }
      items.forEach((it) => {
        if (n >= max) return;
        if (!host && !it.me && it.pr > 190) return;             // the phone: names only round me
        const k = this.kOf(it.d);
        const meTag = it.me && !host;
        const size = meTag ? 17 : fs;
        g.font = `${meTag ? 900 : 800} ${size}px Nunito, system-ui, sans-serif`;
        const label = meTag ? 'TÚ' : it.d.name.length > 11 ? it.d.name.slice(0, 10) + '…' : it.d.name;
        const tw = g.measureText(label).width + (meTag ? 26 : 16);
        const th = size + (meTag ? 12 : 8);
        let top = it.sy - (DR_H * 0.32 + RIDER_H * 0.8) * k * cam.s - th - (meTag ? 8 : 2);
        if (top < this.inset.top + 2) top = it.sy + DR_H * 0.55 * k * cam.s + 4;
        const rect = [it.sx - tw / 2, top, tw, th];
        if (!it.me && (rect[0] < 2 || rect[0] + tw > this.w - 2 || top < this.inset.top - 4 || top > this.h - this.inset.bottom)) return;
        const hit = placed.some((p) => rect[0] < p[0] + p[2] + 2 && rect[0] + rect[2] + 2 > p[0] && rect[1] < p[1] + p[3] + 2 && rect[1] + rect[3] + 2 > p[1]);
        if (hit && !it.me) return;
        if (meTag) top = Math.max(this.inset.top + 2, top);
        placed.push(rect);
        n++;
        const team = COL[it.d.team] || COL.red;
        g.fillStyle = meTag ? team.c : 'rgba(255,253,246,0.94)';
        g.strokeStyle = meTag ? '#ffffff' : team.d;
        g.lineWidth = meTag ? 3 : 2.5;
        g.beginPath();
        if (g.roundRect) g.roundRect(rect[0], rect[1], rect[2], rect[3], th / 2); else g.rect(rect[0], rect[1], rect[2], rect[3]);
        g.fill(); g.stroke();
        if (meTag && top < it.sy) {          // a tail pointing at my dragon
          g.beginPath(); g.moveTo(it.sx - 8, top + th - 1); g.lineTo(it.sx, top + th + 9); g.lineTo(it.sx + 8, top + th - 1); g.closePath();
          g.fill(); g.stroke();
          g.fillRect(it.sx - 7, top + th - 4, 14, 4);
        }
        g.fillStyle = meTag ? '#ffffff' : INK;
        g.fillText(label, it.sx, top + th / 2 + 1);
        if (this.crowns[it.d.k]) { g.font = `${size + 8}px sans-serif`; g.fillText('👑', it.sx, top - size * 0.7); }
      });
    }

    fireworks(g, t, dt) {
      if (this.fw.length < 3 && Math.random() < dt * 1.2) {
        const x = 200 + Math.random() * (this.sky.w - 400), y = 120 + Math.random() * 260;
        const col = ['#ffd166', '#ff6b9a', '#7ad7ff', '#b2f26b'][Math.floor(Math.random() * 4)];
        this.fw.push({ x, y, t0: t, col, n: 16 + Math.floor(Math.random() * 8) });
      }
      this.fw = this.fw.filter((f) => t - f.t0 < 1.4);
      this.fw.forEach((f) => {
        const a = (t - f.t0) / 1.4;
        g.globalAlpha = Math.max(0, 1 - a);
        g.fillStyle = f.col;
        for (let j = 0; j < f.n; j++) {
          const ang = (j / f.n) * Math.PI * 2;
          const rr = 20 + a * 110;
          g.beginPath(); g.arc(f.x + Math.cos(ang) * rr, f.y + Math.sin(ang) * rr + a * a * 40, 4.5 * (1 - a) + 1.5, 0, 7); g.fill();
        }
      });
      g.globalAlpha = 1;
    }

    // screen px → world units (phone taps)
    toWorld(px, py) {
      const c = this.cam;
      if (!c) return null;
      return [(px - c.ox) / c.s, (py - c.oy) / c.s];
    }
  }

  root.PaintRender = { Scene, load, pic, ready, worldOf, COL, frameUrl, riderUrl, cloudUrl, DR_W, DR_H };
})(typeof window !== 'undefined' ? window : this);
