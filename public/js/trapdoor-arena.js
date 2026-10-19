// Las Trampillas (gameType 'trapdoor') — the platform every screen and the server share (spec docs/specs/las-trampillas.md).
//   ARENAS          the three places (art under /assets/trapdoor/<id>/: bg, floor, pit), their names and colours
//   geometry        a round platform of radius R (world units, x right, y toward the viewer), 8 pie slices from 12
//                   o'clock clockwise around a raised hub; a kid's feet stay between R_MIN and R_MAX from the centre
//   sliceOf(x, y)   which slice a point is on (0-7)
//   sets            what can drop: a quarter (2 adjacent slices), three adjacent slices, the bowtie (two opposite quarters)
//   clampTarget()   a tap → a target on the walkable ring (non-numbers → null)
//   move()          one step of a runner toward its target at a fixed distance: it slides around the hub and never steps
//                   into an open slice (the server moves every kid with it; the phone predicts its own run with it)
// UMD: the server (core/trapdoor.js) requires it; the pages read window.TrapdoorArena.
(function (root, factory) {
  const A = factory();
  if (typeof module === 'object' && module.exports) module.exports = A;
  else root.TrapdoorArena = A;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  const R = 100;          // the floor's radius
  const R_HUB = 24;       // the countdown pillar in the middle (nobody stands on it)
  const R_MIN = 32;       // a kid's feet: at least this far from the centre (the hub + a body)
  const R_MAX = 93;       // …and this far inside the rim
  const SLICES = 8;
  const SLICE = (2 * Math.PI) / SLICES;
  // the clock of a round (ms), the same on the server and the screens (the video: ~13 s a round)
  const TIMING = {
    INTRO: 2600,          // «¡YA!» (the video's START!)
    TITLE: 1500,          // «Ronda N» + the dots
    FINAL_TITLE: 2200,    // «¡Ronda final!» (a beat longer: the drama)
    ROULETTE: 2000,       // pink slices jumping before the count
    COUNT: 5000,          // 5, 4, 3, 2, 1
    LOCK: 1100,           // «0»: the chosen slices burn; the last dash
    OPEN: 1700,           // the doors swing down (falls judged at its start)
    CLOSE: 600,           // the doors close
    TALLY: 1300,          // «+N en pie»
  };
  // a round's phase boundaries (ms after the round started)
  function bounds(final) {
    const T = TIMING;
    const b1 = final ? T.FINAL_TITLE : T.TITLE, b2 = b1 + T.ROULETTE, b3 = b2 + T.COUNT, b4 = b3 + T.LOCK, b5 = b4 + T.OPEN, b6 = b5 + T.CLOSE;
    return { title: 0, roulette: b1, count: b2, lock: b3, open: b4, close: b5, tally: b6, end: b6 + T.TALLY };
  }
  // the phase at ms `t` into a round, and the hub's number (5 … 1 during the count, 0 from «0» until the doors close)
  function phaseAt(t, final) {
    const b = bounds(final);
    return t < b.roulette ? 'title' : t < b.count ? 'roulette' : t < b.lock ? 'count' : t < b.open ? 'lock' : t < b.close ? 'open' : t < b.tally ? 'close' : t < b.end ? 'tally' : 'next';
  }
  function hubAt(t, final) {
    const b = bounds(final);
    if (t >= b.count && t < b.lock) return Math.max(1, 5 - Math.floor((t - b.count) / 1000));
    if (t >= b.lock && t < b.close) return 0;
    return null;
  }
  // the hub's clock: which tick of the count it is at ms `t` (null outside the count) → { i, n, fast }. A round ticks once
  // a second; the Final Round («¡Rápido!», 2026-10-19) ticks twice a second, then four times a second in its last 2 s
  // (the screens play tick / tock, rising): the hurry of Mario Party's last seconds
  function tickAt(t, final) {
    const b = bounds(final);
    if (t < b.count || t >= b.lock) return null;
    const into = t - b.count;
    const n = Math.max(1, 5 - Math.floor(into / 1000));
    if (!final) return { i: Math.floor(into / 1000), n, fast: 0 };
    if (into < 3000) return { i: Math.floor(into / 500), n, fast: 1 };
    return { i: 6 + Math.floor((into - 3000) / 250), n, fast: 2 };
  }

  // Three arenas: Dubai first (the main stage), then China. `pit` is the place the fallen land in (their phones show it).
  const ARENAS = [
    {
      id: 'dubai', name: 'El Palacio de Dubái', short: 'Dubái', place: 'Un salón real con el horizonte de Dubái de noche',
      pitName: 'la piscina de cojines', hole0: [0.5, 0.6, 0.44], warn: '#ff4fb4', rim: ['#ffe9a3', '#e0a92b', '#8a5a10'], seam: '#f6d27a',
      floorTint: 'rgba(255,240,214,0.10)', hole: ['#1a1036', '#05030d'], sky: ['#1b1446', '#3a2a7a', '#e9a35c'],
    },
    {
      id: 'templo', name: 'El Templo del Cielo', short: 'Pekín', place: 'El altar redondo de mármol blanco al atardecer',
      pitName: 'el estanque de los lotos', hole0: [0.49, 0.6, 0.58], warn: '#ff4fb4', rim: ['#f4f1e8', '#c9c2b0', '#7c7462'], seam: '#d8b25a',
      floorTint: 'rgba(255,244,230,0.10)', hole: ['#0f2a2c', '#03100f'], sky: ['#f4a259', '#f7c98b', '#9cc8e8'],
    },
    {
      id: 'luna', name: 'El Jardín de la Luna', short: 'Suzhou', place: 'Un patio de mosaico detrás de la puerta de la luna',
      pitName: 'el estanque de las carpas', hole0: [0.495, 0.58, 0.44], warn: '#ff4fb4', rim: ['#e9e4da', '#b5ab98', '#6d6454'], seam: '#c79d4a',
      floorTint: 'rgba(240,250,236,0.10)', hole: ['#0d2236', '#02080f'], sky: ['#16324f', '#2e5f7a', '#f2c48d'],
    },
  ];
  const arena = (i) => ARENAS[((Number(i) || 0) % ARENAS.length + ARENAS.length) % ARENAS.length];
  const art = (a, part) => '/assets/trapdoor/' + a.id + '/' + part + '.webp';

  // the slice under a point: 0 starts at 12 o'clock (−y), clockwise
  function angleOf(x, y) {
    let a = Math.atan2(x, -y);
    if (a < 0) a += 2 * Math.PI;
    return a;
  }
  const sliceOf = (x, y) => Math.min(SLICES - 1, Math.floor(angleOf(x, y) / SLICE));
  // the centre angle of a slice (radians, 0 = 12 o'clock, clockwise) and a point on it
  const sliceMid = (i) => (i + 0.5) * SLICE;
  const pointAt = (ang, r) => [Math.sin(ang) * r, -Math.cos(ang) * r];

  // ---------- what drops ----------
  // kind 'quarter' → 8 options (s, s+1); 'three' → 8 options (s, s+1, s+2); 'bowtie' → 4 options (s, s+1, s+4, s+5)
  function setOf(kind, s) {
    s = ((s % SLICES) + SLICES) % SLICES;
    const w = (k) => (s + k) % SLICES;
    if (kind === 'three') return [w(0), w(1), w(2)];
    if (kind === 'bowtie') return [w(0), w(1), w(4), w(5)].sort((a, b) => a - b);
    return [w(0), w(1)];
  }
  const optionsOf = (kind) => (kind === 'bowtie' ? 4 : SLICES);
  const kindOf = (r, n) => (r >= n ? 'bowtie' : r > n / 2 ? 'three' : 'quarter');

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // a tap → a point on the walkable ring (inside the rim, outside the hub)
  function clampTarget(x, y) {
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    const r = Math.hypot(x, y);
    if (r < 1e-6) return [0, -R_MIN];
    const k = clamp(r, R_MIN, R_MAX) / r;
    return [x * k, y * k];
  }

  // One step of a runner: from (x, y) toward (tx, ty), at most `dist` world units. It slides along the hub instead of
  // crossing it, stays inside the rim, and never steps from a closed slice into an open one (`open`: slice → true).
  // → [x, y] (the same point when it can't move)
  function move(x, y, tx, ty, dist, open) {
    let px = x, py = y, left = dist;
    for (let it = 0; it < 3 && left > 1e-4; it++) {
      const dx = tx - px, dy = ty - py, d = Math.hypot(dx, dy);
      if (d < 1e-4) break;
      const s = Math.min(left, d);
      let nx = px + (dx / d) * s, ny = py + (dy / d) * s;
      if (Math.hypot(nx, ny) < R_MIN - 1e-3 || segHitsHub(px, py, nx, ny)) {
        // the straight way crosses the hub: walk around it (the tangent that turns toward the target)
        const r = Math.hypot(px, py) || 1;
        const t1 = [-py / r, px / r], t2 = [py / r, -px / r];
        const t = (t1[0] * dx + t1[1] * dy) >= (t2[0] * dx + t2[1] * dy) ? t1 : t2;
        nx = px + t[0] * s; ny = py + t[1] * s;
        const nr = Math.hypot(nx, ny) || 1;
        const want = Math.max(R_MIN, Math.min(nr, R_MAX));
        nx = (nx / nr) * want; ny = (ny / nr) * want;
      }
      const nr2 = Math.hypot(nx, ny);
      if (nr2 > R_MAX) { nx = (nx / nr2) * R_MAX; ny = (ny / nr2) * R_MAX; }
      if (open && !open[sliceOf(px, py)] && open[sliceOf(nx, ny)]) break;        // never into an open hole
      left -= Math.hypot(nx - px, ny - py) || s;
      px = nx; py = ny;
    }
    return [px, py];
  }
  // does the segment pass closer than R_MIN to the centre (somewhere between its ends)?
  function segHitsHub(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy;
    if (L < 1e-9) return false;
    const t = clamp(-(x0 * dx + y0 * dy) / L, 0, 1);
    return Math.hypot(x0 + t * dx, y0 + t * dy) < R_MIN - 1e-3;
  }

  // where kids start / rise: spread over the ring (seeded by their number so it is the same for everyone)
  function spawnAt(n, salt) {
    const k = Math.abs(Number(n) || 0) * 7919 + (Number(salt) || 0) * 104729;
    const ang = ((k * 0.6180339887) % 1) * 2 * Math.PI;
    const rr = R_MIN + 14 + ((k * 0.3819660113) % 1) * (R_MAX - R_MIN - 22);
    return pointAt(ang, rr);
  }

  // What a phone tells its kid at «0» (before the doors decide): `me` = where the phone shows me (it runs ahead), `srv`
  // = the server's last report of me (it trails by the lag). It never says «safe» while either one is on a burning
  // slice: the server judges its own position, so «¡Quieto ahí!» there would be a promise it can break.
  // → 'run' (my slice burns: ¡CORRE!) · 'keep' (I'm out on my screen, not yet on the server's: keep going) ·
  //   'safe' (both off) · and with wings 'wings' instead of 'run' / 'keep'
  function lockVerdict(me, srv, set, wings) {
    const on = (p) => !!(p && set && set.indexOf(sliceOf(p[0], p[1])) >= 0);
    const meOn = on(me), srvOn = on(srv);
    if (!meOn && !srvOn) return 'safe';
    if (wings) return 'wings';
    return meOn ? 'run' : 'keep';
  }

  return {
    R, R_HUB, R_MIN, R_MAX, SLICES, SLICE, TIMING, bounds, phaseAt, hubAt, tickAt, ARENAS, arena, art,
    angleOf, sliceOf, sliceMid, pointAt, setOf, optionsOf, kindOf, clampTarget, move, segHitsHub, spawnAt, lockVerdict,
  };
});
