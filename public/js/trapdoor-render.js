// Las Trampillas — what the phone (js/player-trapdoor.js) and the projector (js/host-trapdoor.js) both draw, one canvas
// each, with the video's fixed tilted top-down camera: the whole platform and every kid always in view.
//   · the ARENA: its Higgsfield backdrop (cover), a dark gap around the platform, the platform's thick rim (its side
//     and a gold ring), the round floor (the arena's top-down mosaic, squashed by the tilt), the 8 seams, the hub
//   · the ROULETTE: pink slices jumping on the round's schedule (td:round), «0» burning hot pink (td:lock)
//   · the DOORS: at td:open every dropping run of slices opens as double doors hinged on its outer seams (rotated in 3D
//     and projected), the dark pit under them; at td:close they swing back up
//   · the KIDS: each one's full-body saga character (js/halcon-board.js art) on a red / blue ring, depth-sorted around
//     the hub; golden wings behind a kid who has them (flapping over the hole when they save them); the scared pose on
//     a burning slice at «0»; falls clipped into the hole; a comeback rising from below with sparkles
//   · on the phone my character 1.35× bigger, a pulsing gold ring and «TÚ», names only near me; the projector names
//     everyone (never overlapping); the hub's number (5 … 1, then a red 0)
// Motion: every kid glides toward the server's position, run on along its way at the server's speed (the same step
// as the server: js/trapdoor-arena.js move). Frozen during a pause and after «¡FINAL!».
// window.TrapdoorRender = { Scene, load, pic, ready, spriteUrl, COL, TILT }.
(function (root) {
  'use strict';
  const TA = () => root.TrapdoorArena;
  const HB = () => root.HalconBoard;
  const mq = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reduced = () => !!(mq && mq.matches);
  const COL = {
    red: { c: '#ff4a2e', d: '#b3200e', l: '#ffb08a', ring: 'rgba(255,74,46,0.95)', soft: 'rgba(255,74,46,0.28)', name: 'Fuego' },
    gold: { c: '#2f86ff', d: '#1846b8', l: '#9fd0ff', ring: 'rgba(47,134,255,0.95)', soft: 'rgba(47,134,255,0.28)', name: 'Mar' },
  };
  const TILT = 0.6;               // the floor's ellipse: height = width × TILT (the video's camera)
  const DEPTH = 0.8;              // how much a unit straight down shows on screen (√(1 − TILT²))
  const CH = 25;                  // a kid's height in world units (the platform is 200 across)
  const RIM_SIDE = 9;             // the platform's thickness
  const HUB_H = 9;                // the hub's height
  const WINGS = '/assets/trapdoor/wings.webp';

  // ---------- pictures ----------
  const PIC = {};
  function pic(url) {
    if (!url) return null;
    let im = PIC[url];
    if (!im) { im = new Image(); im.decoding = 'async'; im.src = url; PIC[url] = im; }
    return im;
  }
  const ready = (im) => !!(im && im.complete && im.naturalWidth);
  const spriteUrl = (skin, pose) => (HB() ? HB().art(skin, pose || 'idle') : '/assets/dralingo/hello.webp');
  function load(arenaIdx) {
    const a = TA() && TA().arena(arenaIdx);
    if (!a) return;
    ['bg', 'floor', 'pit'].forEach((p) => pic(TA().art(a, p)));
    pic(WINGS);
  }
  // a sprite scaled once to the size it is drawn at (a cheap phone never scales a 400 px picture every frame)
  const SCALED = {};
  function scaled(url, hPx) {
    const im = pic(url);
    if (!ready(im)) return null;
    const h = Math.max(8, Math.round(hPx));
    const key = url + '|' + h;
    if (SCALED[key]) return SCALED[key];
    const w = Math.max(4, Math.round((im.naturalWidth * h) / im.naturalHeight));
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(im, 0, 0, w, h);
    SCALED[key] = cv;
    return cv;
  }
  // the hovering wings' golden glow, blurred once per sprite (shadowBlur every frame is costly on a cheap phone)
  const GLOW = new WeakMap();
  function glowOf(cv, dpr) {
    let gl = GLOW.get(cv);
    if (gl) return gl;
    const pad = Math.ceil(14 * dpr);
    gl = document.createElement('canvas');
    gl.width = cv.width + pad * 2; gl.height = cv.height + pad * 2;
    const x = gl.getContext('2d');
    x.shadowColor = 'rgba(255,214,90,0.9)'; x.shadowBlur = 12 * dpr;
    x.drawImage(cv, pad, pad);
    gl.pad = pad;
    GLOW.set(cv, gl);
    return gl;
  }

  // ---------- geometry on screen ----------
  // a point of the floor (world x, y; z = how far below the floor) → screen px
  function P(L, x, y, z) { return [L.cx + x * L.k, L.cy + y * L.k * TILT + (z || 0) * L.k * DEPTH]; }
  // the outline of slices a0…a1 (radians from 12 o'clock, clockwise) between radius r0 and r1 → [[x, y]] world points
  function wedge(a0, a1, r0, r1) {
    const pts = [];
    const n = Math.max(3, Math.ceil(((a1 - a0) / (Math.PI / 4)) * 10));
    for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; pts.push([Math.sin(a) * r1, -Math.cos(a) * r1]); }
    for (let i = n; i >= 0; i--) { const a = a0 + ((a1 - a0) * i) / n; pts.push([Math.sin(a) * r0, -Math.cos(a) * r0]); }
    return pts;
  }
  // the dropping set → runs of neighbouring slices [[first, count]] (a bowtie is two runs)
  function runsOf(set) {
    const S = TA().SLICES;
    const on = new Array(S).fill(false);
    (set || []).forEach((i) => { on[i] = true; });
    if (on.every(Boolean)) return [[0, S]];
    const runs = [];
    let start = on.findIndex((v, i) => v && !on[(i + S - 1) % S]);
    if (start < 0) return runs;
    for (let i = 0; i < S; i++) {
      const s = (start + i) % S;
      if (!on[s] || on[(s + S - 1) % S]) continue;
      let n = 0;
      while (n < S && on[(s + n) % S]) n++;
      runs.push([s, n]);
    }
    return runs;
  }
  // rotate a floor point about the radial hinge line at angle `ha` by `th` (downward), → [x, y, z]
  function swing(x, y, ha, th) {
    const ux = Math.sin(ha), uy = -Math.cos(ha);            // along the hinge
    const along = x * ux + y * uy;
    const px = x - along * ux, py = y - along * uy;          // perpendicular part (in the floor)
    const c = Math.cos(th), s = Math.sin(th);
    const d = Math.hypot(px, py);
    return [along * ux + px * c, along * uy + py * c, d * s];
  }

  // ---------- the scene ----------
  class Scene {
    constructor(canvas, opts) {
      this.cv = canvas;
      this.g = canvas.getContext('2d');
      this.mode = (opts && opts.mode) || 'phone';
      this.arena = null;
      this.kids = {};            // k → { k, name, team, skin, x, y, sx, sy, tx, ty, f, st, fall, rise }
      this.me = null;
      this.meXY = null;          // the phone's own predicted position (player-trapdoor.js)
      this.rd = null;            // { r, rounds, kind, final, jumps, start (perf ms) }
      this.lockSet = null;
      this.doors = null;         // { set, runs, openAt, closeAt }
      this.paused = false; this.pausedAt = 0;
      this.frozen = false;
      this.parts = [];
      this.ripple = null;
      this.labels = true;
      this.inset = { top: 0, bottom: 0 };
      this.dpr = 1; this.w = 1; this.h = 1;
      this.L = { cx: 0, cy: 0, k: 1 };
      this.cache = null; this.cacheKey = '';
      this.hubCache = null; this.hubKey = '';
      this.speed = 92;
    }
    setArena(i) {
      this.arena = TA().arena(i);
      this.arenaIdx = i;
      this.cacheKey = '';
      this.hubKey = '';
      load(i);
    }
    resize() {
      const r = this.cv.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false;
      this.dpr = Math.min(this.mode === 'host' ? 1.5 : 2, root.devicePixelRatio || 1);
      this.w = r.width; this.h = r.height;
      const W = Math.round(r.width * this.dpr), H = Math.round(r.height * this.dpr);
      if (this.cv.width !== W || this.cv.height !== H) { this.cv.width = W; this.cv.height = H; this.cacheKey = ''; this.hubKey = ''; }
      this.layout();
      return true;
    }
    // the platform as big as the box allows: its width, and its height + the kids standing on its far edge
    layout() {
      const W = this.w, H = this.h;
      const top = this.inset.top || 0, bot = this.inset.bottom || 0, left = this.inset.left || 0, right = this.inset.right || 0;
      const R = TA().R;
      const padX = this.mode === 'host' ? 12 : 6;
      const kW = (W - left - right - 2 * padX) / (2 * R * 1.06);
      const needH = 2 * R * 1.06 * TILT + RIM_SIDE * DEPTH + CH * (this.mode === 'host' ? 0.95 : 1.15) + 6;
      const kH = (H - top - bot - (this.mode === 'host' ? 10 : 4)) / needH;
      const k = Math.max(0.5, Math.min(kW, kH));
      const usedH = needH * k;
      const cy = top + (H - top - bot - usedH) / 2 + CH * (this.mode === 'host' ? 0.95 : 1.15) * k + R * 1.06 * TILT * k;
      const L = this.L;
      const cx = left + (W - left - right) / 2;
      if (L.k !== k || L.cx !== cx || L.cy !== cy) { this.cacheKey = ''; this.hubKey = ''; }
      L.k = k; L.cx = cx; L.cy = cy;
    }
    // a tap on the screen → a point of the floor (world units), or null off the platform's ellipse (with a margin)
    toWorld(px, py) {
      const L = this.L;
      const x = (px - L.cx) / L.k, y = (py - L.cy) / (L.k * TILT);
      if (Math.hypot(x, y) > TA().R * 1.25) return null;
      return [x, y];
    }
    // ---------- data in ----------
    roster(r) {
      Object.entries(r || {}).forEach(([k, v]) => {
        const d = this.kids[k] || (this.kids[k] = { k: +k, x: null, y: null });
        d.name = v[0]; d.team = v[1];
        d.skin = HB() ? HB().skinFor(v[2], v[0]) : 'dralingo';
        ['idle', 'no', 'ok'].forEach((p) => pic(spriteUrl(d.skin, p)));
      });
      Object.keys(this.kids).forEach((k) => { if (!r[k]) delete this.kids[k]; });
    }
    // rows [[k, x, y, tx, ty, flags]]  flags: 1 wings · 2 pit · 4 waiting · 8 away · 16 hovering
    positions(rows, nowPerf) {
      (rows || []).forEach(([k, x, y, tx, ty, f]) => {
        const d = this.kids[k] || (this.kids[k] = { k, x: null, y: null });
        const wasOff = d.f != null && (d.f & 6);
        d.sx = x; d.sy = y; d.tx = tx; d.ty = ty; d.f = f; d.st = nowPerf;
        if (d.x == null || Math.hypot(d.x - x, d.y - y) > 60 || (wasOff && !(f & 6))) { d.x = x; d.y = y; }
        if (tx < x - 0.3) d.face = -1; else if (tx > x + 0.3) d.face = 1;
      });
    }
    // a round from td:round / td:init: its schedule, anchored to this screen's clock
    round(info, agoMs, nowPerf) {
      this.rd = { r: info.r, rounds: info.rounds, kind: info.kind, final: !!info.final, jumps: info.jumps || [], start: nowPerf - (agoMs || 0) };
      this.lockSet = null;
      if (!info.keepDoors) this.doors = null;
    }
    // the round's clock (ms since it started), standing still while paused
    clock(nowPerf) { if (!this.rd) return -1; return (this.paused ? this.pausedAt : nowPerf) - this.rd.start; }
    pause(v, nowPerf, agoMs) {
      if (v) { if (!this.paused) { this.paused = true; this.pausedAt = nowPerf; } return; }
      if (this.paused && this.rd) this.rd.start += nowPerf - this.pausedAt;
      this.paused = false;
      if (this.rd && agoMs != null) this.rd.start = nowPerf - agoMs;     // the server's own clock wins
    }
    lock(set) { this.lockSet = (set || []).slice(); }
    // `at`: [[k, x, y]] where the server judged each kid (td:open): a fall or a save is drawn from there
    open(set, falls, saves, nowPerf, at) {
      const J = {};
      (at || []).forEach(([k, x, y]) => { J[k] = [x, y]; });
      [].concat(falls || [], saves || []).forEach((k) => {
        const d = this.kids[k], p = J[k];
        if (!d || !p) return;
        d.x = d.sx = d.tx = p[0]; d.y = d.sy = d.ty = p[1];
        if (k === this.me) this.meXY = null;
      });
      this.lockSet = (set || []).slice();
      this.doors = { set: this.lockSet, runs: runsOf(set), openAt: nowPerf, closeAt: null };
      const A = TA(), SL = A.SLICE, runs = this.doors.runs;
      const into = (ang, s) => { let a = ang - s * SL; if (a < 0) a += 2 * Math.PI; return a; };
      const runAt = (x, y) => { const ang = A.angleOf(x, y); return runs.find(([s, n]) => into(ang, s) < n * SL + 1e-6) || null; };
      (falls || []).forEach((k) => {
        const d = this.kids[k];
        if (!d) return;
        let x = d.x, y = d.y;
        if (x == null) { x = d.sx; y = d.sy; }
        if (x == null) return;
        let run = runAt(x, y);
        // the phone ran ahead of the server (the lag): fall from where the server judged the feet, never from safe floor
        if (!run && d.sx != null) { x = d.sx; y = d.sy; run = runAt(x, y); }
        if (!run && runs.length) {                       // still outside (an old position): the nearest edge of a hole
          const ang = A.angleOf(x, y), rr = Math.max(A.R_MIN + 4, Math.min(A.R_MAX - 6, Math.hypot(x, y)));
          let best = null, bd = 9;
          runs.forEach(([s, n]) => {
            [s * SL + 0.08, (s + n) * SL - 0.08].forEach((a) => {
              let da = Math.abs(a - ang) % (2 * Math.PI); da = Math.min(da, 2 * Math.PI - da);
              if (da < bd) { bd = da; best = [a, [s, n]]; }
            });
          });
          [x, y] = A.pointAt(best[0], rr);
          run = best[1];
        }
        d.x = x; d.y = y;
        d.fall = { t0: nowPerf, x, y, run };
        d.f = (d.f || 0) | 2;
        if (k === this.me) this.meXY = null;
      });
      (saves || []).forEach((k) => {
        const d = this.kids[k];
        if (!d) return;
        d.saveAt = nowPerf;
        d.f = ((d.f || 0) & ~1) | 16;
        if (d.x != null && !reduced()) this.sparkle(d.x, d.y, '#ffd966', 22);
      });
    }
    close(nowPerf) { if (this.doors && !this.doors.closeAt) this.doors.closeAt = nowPerf; }
    // a kid rising onto the floor (a comeback, or the start of a round)
    rise(k, x, y, nowPerf) {
      const d = this.kids[k] || (this.kids[k] = { k, x: null, y: null });
      d.x = d.sx = d.tx = x; d.y = d.sy = d.ty = y; d.st = nowPerf;
      d.f = (d.f || 0) & ~6;
      d.fall = null;
      d.rise = { t0: nowPerf };
      if (!reduced()) this.sparkle(x, y, '#fff3b0', 16);
    }
    sparkle(x, y, color, n) {
      for (let j = 0; j < n && this.parts.length < 200; j++) {
        const a = Math.random() * Math.PI * 2, v = 20 + Math.random() * 45;
        this.parts.push({ x, y, z: -6 - Math.random() * 14, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, vz: -20 - Math.random() * 30, life: 0.6 + Math.random() * 0.5, age: 0, c: color, r: 1.4 + Math.random() * 2 });
      }
    }
    // ---------- where each kid is now ----------
    predicted(d, nowPerf) {
      if (d.sx == null) return null;
      if (this.frozen || this.paused) return [d.sx, d.sy];
      const dt = Math.min(0.5, Math.max(0, (nowPerf - d.st) / 1000));
      if ((d.f & 14) || Math.hypot(d.tx - d.sx, d.ty - d.sy) < 0.05) return [d.sx, d.sy];
      return TA().move(d.sx, d.sy, d.tx, d.ty, this.speed * dt, (d.f & 16) ? null : this.openMap());
    }
    openMap() {
      if (!this.doors || this.doors.closeAt && performance.now() - this.doors.closeAt > TA().TIMING.CLOSE) return null;
      const m = {};
      this.doors.set.forEach((i) => { m[i] = true; });
      return m;
    }
    // ---------- one frame ----------
    frame(nowPerf, dt) {
      if (!this.arena) return;
      const g = this.g, dpr = this.dpr, L = this.L;
      const still = reduced();
      const t = this.clock(nowPerf);
      const T = TA().TIMING;
      // motion
      const kk = still ? 1 : 1 - Math.exp(-dt / 0.1);
      Object.values(this.kids).forEach((d) => {
        if (d.k === this.me && this.meXY) { d.x = this.meXY[0]; d.y = this.meXY[1]; return; }
        const p = this.predicted(d, nowPerf);
        if (!p) return;
        if (d.x == null) { d.x = p[0]; d.y = p[1]; }
        d.x += (p[0] - d.x) * kk; d.y += (p[1] - d.y) * kk;
      });
      this.parts.forEach((p) => { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz += 60 * dt; });
      this.parts = this.parts.filter((p) => p.age < p.life);
      // the static layer (backdrop + platform), built once per size / arena
      this.ensureCache();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, this.cv.width, this.cv.height);
      if (this.cache) g.drawImage(this.cache, 0, 0);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      // the roulette / «0»
      const phase = this.rd ? TA().phaseAt(t, this.rd.final) : 'none';
      let lit = null, hot = false;
      if (this.rd && (phase === 'roulette' || phase === 'count')) {
        let s = null;
        for (const j of this.rd.jumps) { if (j[0] <= t) s = j[1]; else break; }
        if (s != null) lit = TA().setOf(this.rd.kind, s);
      } else if (this.rd && phase === 'lock') {
        hot = true;
        lit = this.lockSet;
        if (!lit) { let s = null; for (const j of this.rd.jumps) if (j[0] <= t) s = j[1]; lit = s != null ? TA().setOf(this.rd.kind, s) : null; hot = false; }
      } else if (this.rd && phase === 'open' && !this.doors && this.lockSet) {
        hot = true;                    // my clock is past «0» but the doors haven't arrived yet (the tick): keep burning
        lit = this.lockSet;
      }
      this.litNow = lit; this.hotNow = hot;
      if (lit && !(this.doors && phase !== 'lock')) this.drawWarn(g, lit, hot, nowPerf, still);
      // the doors and the pit
      const doorsOn = this.doors && (!this.doors.closeAt || nowPerf - this.doors.closeAt < T.CLOSE + 80);
      if (doorsOn) this.drawDoors(g, nowPerf, still);
      // falls (clipped into their hole)
      Object.values(this.kids).forEach((d) => { if (d.fall) this.drawFall(g, d, nowPerf); });
      // the kids around the hub (behind it, the hub, in front of it)
      const shown = Object.values(this.kids).filter((d) => d.x != null && !(d.f & 6) && !d.fall);
      shown.sort((a, b) => a.y - b.y || a.k - b.k);
      // on the phone my character is drawn last, on top of a crowd (its ring and «TÚ» never hidden)
      const mineD = this.mode === 'phone' ? shown.find((d) => d.k === this.me) : null;
      const behind = shown.filter((d) => d.y < 0 && d !== mineD), front = shown.filter((d) => d.y >= 0 && d !== mineD);
      behind.forEach((d) => this.drawKid(g, d, nowPerf, lit, hot, phase));
      this.drawHub(g, t, phase, nowPerf);
      front.forEach((d) => this.drawKid(g, d, nowPerf, lit, hot, phase));
      if (mineD) this.drawKid(g, mineD, nowPerf, lit, hot, phase);
      // sparkles, the tap ripple, names
      this.parts.forEach((p) => {
        const [x, y] = P(L, p.x, p.y, p.z);
        g.globalAlpha = Math.max(0, 1 - p.age / p.life);
        g.fillStyle = p.c;
        g.beginPath(); g.arc(x, y, p.r * (L.k / 3.2), 0, Math.PI * 2); g.fill();
      });
      g.globalAlpha = 1;
      if (this.ripple && this.mode === 'phone') this.drawRipple(g, nowPerf);
      this.drawTags(g, shown, nowPerf);
    }
    // ---------- the static layer ----------
    ensureCache() {
      const key = [this.cv.width, this.cv.height, this.arenaIdx, this.L.k.toFixed(3), this.L.cx.toFixed(1), this.L.cy.toFixed(1)].join('|');
      const a = this.arena;
      const bg = pic(TA().art(a, 'bg')), fl = pic(TA().art(a, 'floor'));
      const full = key + '|' + (ready(bg) ? 1 : 0) + (ready(fl) ? 1 : 0);
      if (full === this.cacheKey && this.cache) return;
      this.cacheKey = full;
      const cv = this.cache || (this.cache = document.createElement('canvas'));
      cv.width = this.cv.width; cv.height = this.cv.height;
      const g = cv.getContext('2d');
      const dpr = this.dpr, L = this.L, R = TA().R, k = L.k;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const W = this.w, H = this.h;
      // the backdrop: its painted pit (a.hole0: centre x, y and the width the platform's rim covers, as fractions of the
      // picture) under the platform, and always covering the whole box
      if (ready(bg)) {
        const hp = a.hole0 || [0.5, 0.58, 0.44];
        const rimW = 2 * R * 1.045 * k;
        const sc = Math.max(W / bg.naturalWidth, H / bg.naturalHeight, rimW / (hp[2] * bg.naturalWidth));
        const bw = bg.naturalWidth * sc, bh = bg.naturalHeight * sc;
        const ox = Math.min(0, Math.max(W - bw, L.cx - bw * hp[0])), oy = Math.min(0, Math.max(H - bh, L.cy - bh * hp[1]));
        g.drawImage(bg, ox, oy, bw, bh);
      } else {
        const gr = g.createLinearGradient(0, 0, 0, H);
        gr.addColorStop(0, a.sky[0]); gr.addColorStop(0.55, a.sky[1]); gr.addColorStop(1, a.sky[2]);
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
      }
      // the dark gap around the platform (the pit it stands over)
      g.save();
      g.translate(L.cx, L.cy + RIM_SIDE * k * DEPTH * 0.7);
      g.scale(1, TILT);
      const gap = g.createRadialGradient(0, 0, R * k * 0.95, 0, 0, R * k * 1.32);
      gap.addColorStop(0, 'rgba(6,4,18,0.92)'); gap.addColorStop(0.55, 'rgba(6,4,18,0.55)'); gap.addColorStop(1, 'rgba(6,4,18,0)');
      g.fillStyle = gap;
      g.beginPath(); g.arc(0, 0, R * k * 1.32, 0, Math.PI * 2); g.fill();
      g.restore();
      // the rim's side (the platform's thickness), then the gold ring
      const rimR = R * 1.045;
      const side = RIM_SIDE * k * DEPTH;
      const sg = g.createLinearGradient(0, L.cy, 0, L.cy + rimR * k * TILT + side);
      sg.addColorStop(0, a.rim[1]); sg.addColorStop(0.6, a.rim[2]); sg.addColorStop(1, '#1a1206');
      g.fillStyle = sg;
      g.beginPath(); g.ellipse(L.cx, L.cy + side, rimR * k, rimR * k * TILT, 0, 0, Math.PI * 2); g.fill();
      g.fillRect(L.cx - rimR * k, L.cy, 2 * rimR * k, side);
      const rg = g.createLinearGradient(L.cx, L.cy - rimR * k * TILT, L.cx, L.cy + rimR * k * TILT);
      rg.addColorStop(0, a.rim[0]); rg.addColorStop(0.5, a.rim[1]); rg.addColorStop(1, a.rim[2]);
      g.fillStyle = rg;
      g.beginPath(); g.ellipse(L.cx, L.cy, rimR * k, rimR * k * TILT, 0, 0, Math.PI * 2); g.fill();
      // studs on the ring (like the video's bolts)
      g.fillStyle = 'rgba(255,255,255,0.55)';
      for (let i = 0; i < 16; i++) {
        const an = (i + 0.5) * Math.PI / 8;
        const [x, y] = P(L, Math.sin(an) * R * 1.023, -Math.cos(an) * R * 1.023, 0);
        g.beginPath(); g.ellipse(x, y, k * 0.9, k * 0.9 * TILT, 0, 0, Math.PI * 2); g.fill();
      }
      // the floor
      g.save();
      g.beginPath(); g.ellipse(L.cx, L.cy, R * k, R * k * TILT, 0, 0, Math.PI * 2); g.clip();
      if (ready(fl)) {
        g.translate(L.cx, L.cy); g.scale(1, TILT);
        g.drawImage(fl, -R * k, -R * k, 2 * R * k, 2 * R * k);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
      } else {
        g.fillStyle = '#e9e1cf'; g.fillRect(L.cx - R * k, L.cy - R * k, 2 * R * k, 2 * R * k);
      }
      // light from the top, a little shade toward the front (depth)
      const lg = g.createLinearGradient(0, L.cy - R * k * TILT, 0, L.cy + R * k * TILT);
      lg.addColorStop(0, 'rgba(255,255,255,0.10)'); lg.addColorStop(0.55, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(10,8,30,0.16)');
      g.fillStyle = lg; g.fillRect(L.cx - R * k, L.cy - R * k, 2 * R * k, 2 * R * k);
      g.restore();
      // the seams: 8 lines from the hub to the rim (the trapdoors' edges), a dark groove + a bright edge
      for (let i = 0; i < TA().SLICES; i++) {
        const an = i * TA().SLICE;
        const a0 = P(L, Math.sin(an) * TA().R_HUB, -Math.cos(an) * TA().R_HUB, 0), a1 = P(L, Math.sin(an) * R, -Math.cos(an) * R, 0);
        g.strokeStyle = 'rgba(30,20,10,0.55)'; g.lineWidth = Math.max(1.5, k * 1.1);
        g.beginPath(); g.moveTo(a0[0], a0[1] + 1); g.lineTo(a1[0], a1[1] + 1); g.stroke();
        g.strokeStyle = a.seam; g.lineWidth = Math.max(1, k * 0.65);
        g.beginPath(); g.moveTo(a0[0], a0[1]); g.lineTo(a1[0], a1[1]); g.stroke();
      }
      g.strokeStyle = 'rgba(30,20,10,0.45)'; g.lineWidth = Math.max(1.5, k);
      g.beginPath(); g.ellipse(L.cx, L.cy, R * k, R * k * TILT, 0, 0, Math.PI * 2); g.stroke();
      this.hubKey = '';
    }
    // ---------- the hub (a raised drum: the countdown on its top) ----------
    drawHub(g, t, phase, nowPerf) {
      const L = this.L, k = L.k, Rh = TA().R_HUB, a = this.arena;
      const h = HUB_H * k * DEPTH;
      const [cx, cy] = [L.cx, L.cy];
      // the gradients are made once per layout (not every frame)
      const key = cx + '|' + cy + '|' + k + '|' + a.id;
      if (this.hubKey !== key || !this.hubCache) {
        const sg = g.createLinearGradient(cx - Rh * k, 0, cx + Rh * k, 0);
        sg.addColorStop(0, a.rim[2]); sg.addColorStop(0.45, a.rim[0]); sg.addColorStop(1, a.rim[2]);
        const top = (c0, c1) => { const tg = g.createRadialGradient(cx, cy - h - Rh * k * TILT * 0.3, 2, cx, cy - h, Rh * k); tg.addColorStop(0, c0); tg.addColorStop(1, c1); return tg; };
        this.hubCache = { sg, tgN: top('#4b3a86', '#221848'), tgZ: top('#5a1030', '#2a0716') };
        this.hubKey = key;
      }
      const HC0 = this.hubCache;
      // the side
      g.fillStyle = HC0.sg;
      g.beginPath(); g.ellipse(cx, cy, Rh * k, Rh * k * TILT, 0, 0, Math.PI); g.lineTo(cx - Rh * k, cy - h); g.ellipse(cx, cy - h, Rh * k, Rh * k * TILT, 0, Math.PI, 0, true); g.closePath(); g.fill();
      // the top
      const n = this.rd ? TA().hubAt(t, this.rd.final) : null;
      const zero = n === 0;
      g.fillStyle = zero ? HC0.tgZ : HC0.tgN;
      g.beginPath(); g.ellipse(cx, cy - h, Rh * k, Rh * k * TILT, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = a.rim[0]; g.lineWidth = Math.max(2, k * 1.4);
      g.beginPath(); g.ellipse(cx, cy - h, Rh * k * 0.97, Rh * k * TILT * 0.97, 0, 0, Math.PI * 2); g.stroke();
      if (n != null) {
        const fs = Rh * k * 1.25;
        let sc = 1;
        if (!reduced() && n > 0) { const into = ((t - TA().bounds(this.rd.final).count) % 1000) / 1000; sc = 1 + Math.max(0, 0.25 - into) * 1.2; }
        if (zero && !reduced()) sc = 1 + 0.06 * Math.sin(nowPerf / 70);
        g.save();
        g.translate(cx, cy - h - fs * 0.08);
        g.scale(sc, sc * 0.92);
        g.font = `900 ${fs.toFixed(0)}px "Baloo 2", "Nunito", system-ui, sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = Math.max(3, fs * 0.12); g.strokeStyle = 'rgba(20,10,40,0.9)';
        g.strokeText(String(n), 0, 0);
        g.fillStyle = zero ? '#ff3b5c' : '#ffffff';
        g.fillText(String(n), 0, 0);
        g.restore();
      }
    }
    // ---------- pink warnings ----------
    drawWarn(g, set, hot, nowPerf, still) {
      const L = this.L;
      const pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(nowPerf / (hot ? 70 : 160));
      runsOf(set).forEach(([s, n]) => {
        const pts = wedge(s * TA().SLICE, (s + n) * TA().SLICE, TA().R_HUB, TA().R);
        g.beginPath();
        pts.forEach(([x, y], i) => { const p = P(L, x, y, 0); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
        g.closePath();
        // a saturated magenta in every round (a pastel pink vanished on a washed-out projector); «0» burns deeper
        g.fillStyle = hot ? `rgba(255,30,140,${(0.7 + 0.2 * pulse).toFixed(3)})` : `rgba(255,45,160,${(0.5 + 0.16 * pulse).toFixed(3)})`;
        g.fill();
        g.lineWidth = Math.max(2, L.k * (hot ? 1.8 : 1.4));
        g.strokeStyle = hot ? 'rgba(255,245,252,0.98)' : 'rgba(255,215,240,0.95)';
        g.stroke();
      });
    }
    // ---------- the doors ----------
    drawDoors(g, nowPerf, still) {
      const L = this.L, D = this.doors, T = TA().TIMING;
      // how open: 0 → 1 in 0.35 s at the open, back to 0 over the close
      let o;
      if (D.closeAt) o = Math.max(0, 1 - (nowPerf - D.closeAt) / T.CLOSE);
      else o = Math.min(1, (nowPerf - D.openAt) / 350);
      if (still) o = D.closeAt ? (o > 0.5 ? 1 : 0) : 1;
      const eased = 1 - Math.pow(1 - o, 3);
      const th = eased * (Math.PI / 2) * 0.94;
      const a = this.arena;
      D.runs.forEach(([s, n]) => {
        const a0 = s * TA().SLICE, a1 = (s + n) * TA().SLICE, am = (a0 + a1) / 2;
        // the hole: the pit's darkness (deepest in the middle)
        const hole = wedge(a0, a1, TA().R_HUB, TA().R);
        g.save();
        g.beginPath();
        hole.forEach(([x, y], i) => { const p = P(L, x, y, 0); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
        g.closePath();
        const [mx, my] = P(L, Math.sin(am) * TA().R * 0.6, -Math.cos(am) * TA().R * 0.6, 0);
        const hg = g.createRadialGradient(mx, my, 2, mx, my, TA().R * L.k * 0.8);
        hg.addColorStop(0, a.hole[1]); hg.addColorStop(1, a.hole[0]);
        g.globalAlpha = Math.min(1, eased * 1.4);
        g.fillStyle = hg;
        g.fill();
        g.globalAlpha = 1;
        // the two doors: hinged on the outer seams, split in the middle, swinging down; seen only through the opening
        // (the floor in front and the rim hide what hangs below it)
        g.clip();
        // far below: the arena's landing place (the cushion pool, the lotus pond…), small and dim
        const pit = pic(TA().art(a, 'pit'));
        if (ready(pit)) {
          const pw = TA().R * L.k * 1.2, ph = (pw * pit.naturalHeight) / pit.naturalWidth;
          g.globalAlpha = 0.5 * Math.min(1, eased * 1.4);
          g.drawImage(pit, mx - pw / 2, my - ph / 2 + 6 * L.k, pw, ph);
          g.globalAlpha = 1;
        }
        [[a0, am, a0], [am, a1, a1]].forEach(([d0, d1, hinge]) => {
          const pts = wedge(d0, d1, TA().R_HUB, TA().R).map(([x, y]) => swing(x, y, hinge, th));
          g.beginPath();
          pts.forEach(([x, y, z], i) => { const p = P(L, x, y, z); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
          g.closePath();
          const shade = 0.25 + 0.55 * eased;
          g.fillStyle = `rgba(${Math.round(235 - 120 * shade)},${Math.round(70 - 40 * shade)},${Math.round(165 - 80 * shade)},0.96)`;
          g.fill();
          g.strokeStyle = 'rgba(255,220,240,0.6)'; g.lineWidth = Math.max(1, L.k * 0.6);
          g.stroke();
        });
        g.restore();
      });
    }
    // the region a falling kid may show in: everything above its hole's front edge, inside the hole's left-right span
    holeClip(g, run) {
      const L = this.L;
      const [s, n] = run;
      const pts = wedge(s * TA().SLICE, (s + n) * TA().SLICE, TA().R_HUB, TA().R).map(([x, y]) => P(L, x, y, 0));
      let minX = Infinity, maxX = -Infinity;
      pts.forEach(([x]) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); });
      const bins = 28, low = new Array(bins + 1).fill(-Infinity);
      const span = Math.max(1, maxX - minX);
      // the lower edge: densify the outline, keep the lowest point per column
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
        for (let j = 0; j <= 8; j++) {
          const x = x0 + ((x1 - x0) * j) / 8, y = y0 + ((y1 - y0) * j) / 8;
          const b = Math.round(((x - minX) / span) * bins);
          if (y > low[b]) low[b] = y;
        }
      }
      for (let b = 0; b <= bins; b++) if (low[b] === -Infinity) low[b] = b ? low[b - 1] : 0;
      g.beginPath();
      g.moveTo(minX, -9999); g.lineTo(maxX, -9999);
      for (let b = bins; b >= 0; b--) g.lineTo(minX + (span * b) / bins, low[b]);
      g.closePath();
      g.clip();
    }
    drawFall(g, d, nowPerf) {
      const F = d.fall;
      const t = (nowPerf - F.t0) / 1000;
      if (t > 1.15 || !F.run) { d.fall = null; return; }
      if (reduced()) {                 // reduced motion: no drop, a short fade where they stood
        if (t > 0.45) { d.fall = null; return; }
        g.save(); g.globalAlpha = 1 - t / 0.45; this.drawSprite(g, d, F.x, F.y, 0, 'no', 1, nowPerf, {}); g.restore();
        return;
      }
      const L = this.L;
      const hop = t < 0.18 ? Math.sin((t / 0.18) * Math.PI) * 5 : 0;
      const drop = t < 0.18 ? 0 : 0.5 * 420 * Math.pow(t - 0.18, 2);       // units below the floor
      const sc = t < 0.18 ? 1 : Math.max(0.35, 1 - (t - 0.18) * 0.7);
      g.save();
      if (t >= 0.18) this.holeClip(g, F.run);
      g.globalAlpha = t > 0.75 ? Math.max(0, 1 - (t - 0.75) / 0.4) : 1;
      this.drawSprite(g, d, F.x, F.y, drop - hop, 'no', sc, nowPerf, { spin: t >= 0.18 ? (t - 0.18) * 2.2 * (d.k % 2 ? 1 : -1) : 0 });
      g.restore();
    }
    // ---------- a kid ----------
    drawKid(g, d, nowPerf, lit, hot, phase) {
      const L = this.L, k = L.k;
      const me = d.k === this.me && this.mode === 'phone';
      const away = !!(d.f & 8);
      const hover = !!(d.f & 16);
      const wings = !!(d.f & 1) || hover;
      const team = COL[d.team === 'gold' ? 'gold' : 'red'];
      const still = reduced();
      const sl = TA().sliceOf(d.x, d.y);
      const onLit = lit && lit.includes(sl);
      // the rise (a comeback / the start of a round): up from below, sparkles
      let rz = 0, ra = 1;
      if (d.rise) {
        const t = (nowPerf - d.rise.t0) / 500;
        if (t >= 1 || still) d.rise = null; else { rz = (1 - t) * 14; ra = t; }
      }
      const scale = me ? 1.35 : 1;
      const [fx, fy] = P(L, d.x, d.y, 0);
      g.save();
      g.globalAlpha = (away ? 0.4 : 1) * ra;
      // shadow + the team ring
      const rr = 6.2 * k * scale;
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.beginPath(); g.ellipse(fx, fy + 1, rr * 1.05, rr * TILT * 1.05, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = team.soft;
      g.beginPath(); g.ellipse(fx, fy, rr, rr * TILT, 0, 0, Math.PI * 2); g.fill();
      g.lineWidth = Math.max(1.5, k * (me ? 1.2 : 0.9));
      g.strokeStyle = team.ring;
      g.stroke();
      if (me) {
        // my pulsing ring: gold, or hot pink while my own slice burns at «0»
        const danger = onLit && hot;
        const pu = still ? 0.5 : 0.5 + 0.5 * Math.sin(nowPerf / (danger ? 90 : 220));
        g.strokeStyle = danger ? `rgba(255,40,150,${(0.65 + 0.35 * pu).toFixed(2)})` : `rgba(255,216,77,${(0.55 + 0.4 * pu).toFixed(2)})`;
        g.lineWidth = Math.max(2, k * 1.3);
        g.beginPath(); g.ellipse(fx, fy, rr * (1.25 + 0.12 * pu), rr * TILT * (1.25 + 0.12 * pu), 0, 0, Math.PI * 2); g.stroke();
      }
      // the pose: scared on a burning slice at «0», happy hovering or at the tally, else ready
      const pose = hover ? 'ok' : (onLit && hot) ? 'no' : (phase === 'tally' && !away) ? 'ok' : 'idle';
      let lift = 0;
      if (hover) lift = 7 + (still ? 0 : Math.sin(nowPerf / 160) * 1.5);
      const moving = d.sx != null && Math.hypot(d.tx - d.x, d.ty - d.y) > 0.6 && !this.paused && !this.frozen;
      const bob = moving && !still ? Math.abs(Math.sin(nowPerf / 90 + d.k)) * 1.4 : 0;
      this.drawSprite(g, d, d.x, d.y, -(lift + bob) + rz, pose, scale, nowPerf, { wings, hover, me });
      g.restore();
      d.headY = fy - (CH * scale + lift + bob) * k * 1.0;
      d.headX = fx;
    }
    // the sprite with its feet at (x, y) and z below the floor (negative = above)
    drawSprite(g, d, x, y, z, pose, scale, nowPerf, o) {
      const L = this.L, k = L.k;
      const hPx = CH * k * scale;
      const url = spriteUrl(d.skin, pose);
      // cached at a few sizes only (a falling kid shrinks every frame: one canvas per size would pile up)
      const qs = Math.max(0.25, Math.round(scale * 8) / 8), fit = scale / qs;
      const hq = CH * k * qs * this.dpr;
      const sp = scaled(url, hq) || scaled(spriteUrl(d.skin, 'idle'), hq);
      const [fx, fy] = P(L, x, y, z);
      const opt = o || {};
      // the wings behind the body (flapping over the hole, a slow glow otherwise)
      if (opt.wings) {
        const wi = scaled(WINGS, hPx * (opt.hover ? 0.72 : 0.5) * this.dpr);   // idle wings smaller (they hid name tags)
        const flap = reduced() ? 1 : opt.hover ? 0.55 + 0.45 * Math.abs(Math.sin(nowPerf / 75)) : 0.9 + 0.1 * Math.sin(nowPerf / 300);
        if (wi) {
          const ww = (wi.width / this.dpr) * 1.1, wh = (wi.height / this.dpr) * flap;
          const cy = fy - hPx * 0.66;
          if (opt.hover) {
            const gw = glowOf(wi, this.dpr), kx = ww / wi.width, ky = wh / wi.height;
            g.drawImage(gw, fx - ww / 2 - gw.pad * kx, cy - wh / 2 - gw.pad * ky, gw.width * kx, gw.height * ky);
          } else g.drawImage(wi, fx - ww / 2, cy - wh / 2, ww, wh);
        } else {
          g.fillStyle = 'rgba(255,214,90,0.85)';
          g.beginPath(); g.ellipse(fx - hPx * 0.32, fy - hPx * 0.62, hPx * 0.3, hPx * 0.16 * flap, -0.5, 0, Math.PI * 2); g.ellipse(fx + hPx * 0.32, fy - hPx * 0.62, hPx * 0.3, hPx * 0.16 * flap, 0.5, 0, Math.PI * 2); g.fill();
        }
      }
      if (!sp) {
        g.fillStyle = COL[d.team === 'gold' ? 'gold' : 'red'].c;
        g.beginPath(); g.ellipse(fx, fy - hPx * 0.5, hPx * 0.22, hPx * 0.48, 0, 0, Math.PI * 2); g.fill();
        return;
      }
      const w = (sp.width / this.dpr) * fit, h = (sp.height / this.dpr) * fit;
      g.save();
      g.translate(fx, fy);
      if (opt.spin) g.rotate(opt.spin);
      if (d.face === -1) g.scale(-1, 1);
      g.drawImage(sp, -w / 2, -h, w, h);
      g.restore();
    }
    drawRipple(g, nowPerf) {
      const R0 = this.ripple;
      const t = (nowPerf - R0.t) / 600;
      if (t > 1) { this.ripple = null; return; }
      const [x, y] = P(this.L, R0.x, R0.y, 0);
      const r = (4 + 10 * t) * this.L.k;
      g.strokeStyle = `rgba(255,236,140,${(1 - t).toFixed(2)})`;
      g.lineWidth = Math.max(2, this.L.k * 1.2);
      g.beginPath(); g.ellipse(x, y, r, r * TILT, 0, 0, Math.PI * 2); g.stroke();
    }
    // name tags: mine first («TÚ»), then (phone) the kids near me / (projector) everyone; a tag that would overlap one
    // already placed is skipped
    drawTags(g, list, nowPerf) {
      if (!this.labels) return;
      const host = this.mode === 'host';
      const fs = host ? Math.max(14, Math.min(19, this.L.k * 3.6)) : 11;
      const fsMe = 16;
      g.font = `800 ${fs}px "Nunito", system-ui, sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const placed = [];
      // the hub's number counts as placed: a name never covers the count (only my «TÚ» may)
      const hubBox = (() => {
        const L = this.L, Rh = TA().R_HUB * L.k, hh = HUB_H * L.k * DEPTH, nf = Rh * 1.25;
        return [L.cx - nf * 0.5, L.cy - hh - nf * 0.62, L.cx + nf * 0.5, L.cy - hh + nf * 0.5];
      })();
      const meD = this.kids[this.me];
      const order = list.slice().filter((d) => d.headY != null);
      if (!host && meD) order.sort((a, b) => (a === meD ? -1 : b === meD ? 1 : Math.hypot(a.x - meD.x, a.y - meD.y) - Math.hypot(b.x - meD.x, b.y - meD.y)));
      let others = 0;
      order.forEach((d) => {
        const mine = !host && d === meD;
        if (!host && !mine) { if (others >= 3 || !meD || Math.hypot(d.x - meD.x, d.y - meD.y) > 34) return; }
        const text = mine ? 'TÚ' : d.name || '';
        if (!text) return;
        if (mine) g.font = `900 ${fsMe}px "Nunito", system-ui, sans-serif`;
        const w = g.measureText(text).width + (mine ? 20 : 12), h = (mine ? fsMe : fs) + (mine ? 10 : 6);
        const x = d.headX, y = d.headY - h * 0.6 - (mine ? 9 : 2);
        const box = [x - w / 2, y - h / 2, x + w / 2, y + h / 2];
        const hits = (b) => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]);
        if (placed.some(hits) || (!mine && hits(hubBox))) return;
        placed.push(box);
        if (!mine) others++;
        const team = COL[d.team === 'gold' ? 'gold' : 'red'];
        g.fillStyle = mine ? '#ffd84d' : 'rgba(255,255,255,0.92)';
        g.strokeStyle = mine ? '#7a4a00' : team.c;
        g.lineWidth = mine ? 2.5 : 2;
        const r = h / 2;
        g.beginPath();
        g.moveTo(box[0] + r, box[1]); g.lineTo(box[2] - r, box[1]); g.arc(box[2] - r, y, r, -Math.PI / 2, Math.PI / 2); g.lineTo(box[0] + r, box[3]); g.arc(box[0] + r, y, r, Math.PI / 2, Math.PI * 1.5); g.closePath();
        g.fill(); g.stroke();
        if (mine) {                    // a pointer from «TÚ» down to my head
          g.beginPath(); g.moveTo(x - 6, box[3] - 1); g.lineTo(x + 6, box[3] - 1); g.lineTo(x, box[3] + 7); g.closePath();
          g.fillStyle = '#ffd84d'; g.fill(); g.stroke();
          g.fillRect(x - 5, box[3] - 2.5, 10, 2.5);
        }
        g.fillStyle = mine ? '#4a2a00' : '#1d2440';
        g.fillText(text, x, y + 0.5);
        if (mine) g.font = `800 ${fs}px "Nunito", system-ui, sans-serif`;
      });
      void nowPerf;
    }
  }

  root.TrapdoorRender = { Scene, load, pic, ready, spriteUrl, COL, TILT, runsOf, wedge, swing };
})(typeof window !== 'undefined' ? window : this);
