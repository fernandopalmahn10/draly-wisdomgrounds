// La Gran Fuga de Dubái (gameType 'escape') — the three Dubai zones and their «zona segura» rooms, shared by the server
// (core/escape.js), the projector, every phone and the playtest bots, so one seed builds the same room everywhere.
// A room is a small top-down hall (20×12 tiles of 32 px) seen whole on a phone: the Museo del Futuro hall, the Dubai
// Mall atrium and the airport gate. Robotín's charging dock sits at the top centre. Walking, walls and paths reuse the
// Batalla de Nieve code (public/js/snow-map.js): same tile codes, same feet box, same ≤ 1/60 s steps.
// Browser: window.EscapeMap (load snow-map.js first). Node: require('./public/js/escape-map').
(function (root, factory) {
  const SM = (typeof module === 'object' && module.exports) ? require('./snow-map') : root.SnowMap;
  const M = factory(SM);
  if (typeof module === 'object' && module.exports) module.exports = M;
  else root.EscapeMap = M;
})(typeof window !== 'undefined' ? window : this, function (SnowMap) {
  'use strict';
  const COLS = 20;
  const ROWS = 12;
  const TILE = SnowMap.TILE;                 // 32: the movement code reads its own TILE
  const { FLOOR, WALL, WATER, PROP } = SnowMap;
  // the three zones of the episode, in order (the spec's world): landmark art from assets/kingdoms/landmarks/big,
  // the jet is the saga plane (assets/saga/avatars/plane.webp, unbranded)
  const LEVELS = [
    { id: 'museo', name: 'Museo del Futuro', room: 'el vestíbulo del Museo', lm: '/assets/kingdoms/landmarks/big/museum.webp' },
    { id: 'mall', name: 'Dubai Mall y la Fuente', room: 'el atrio del Dubai Mall', lm: '/assets/kingdoms/landmarks/big/burj.webp' },
    { id: 'pista', name: 'Pista del aeropuerto', room: 'la puerta de embarque', lm: '/assets/saga/avatars/plane.webp' },
  ];
  const DOCK = { x: 9, y: 1, w: 2, h: 1 };  // Robotín's charging dock (top centre)

  function rng(seed) { return SnowMap.rng(seed); }

  // A room for level 1..3. What the seed moves: display cases, planters, benches, seat rows, carts.
  function buildRoom(seed, level) {
    const lv = Math.max(1, Math.min(3, level | 0));
    const R = rng(((seed >>> 0) || 1) * 31 + lv * 977);
    const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
    const grid = new Uint8Array(COLS * ROWS);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      grid[y * COLS + x] = (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) ? WALL : FLOOR;
    }
    const at = (x, y) => (x < 0 || y < 0 || x >= COLS || y >= ROWS ? WALL : grid[y * COLS + x]);
    const props = [];
    const reserved = new Uint8Array(COLS * ROWS);
    const reserve = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < COLS && y < ROWS) reserved[y * COLS + x] = 1; };
    const fixed = (kind, x, y, w, h, code, extra) => {
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) grid[yy * COLS + xx] = code;
      props.push(Object.assign({ kind, x, y, w, h }, extra || {}));
    };
    fixed('dock', DOCK.x, DOCK.y, DOCK.w, DOCK.h, PROP);
    reserve(DOCK.x - 2, DOCK.y, DOCK.x + DOCK.w + 1, DOCK.y + 2);
    reserve(7, 5, 12, 6);                              // the middle stays open: kids start there after each wave
    const floorCount = () => { let n = 0; for (let i = 0; i < grid.length; i++) if (grid[i] === FLOOR) n++; return n; };
    function reachable() {
      const seen = new Uint8Array(COLS * ROWS);
      const start = 6 * COLS + 10;
      const q = [start]; seen[start] = 1;
      let n = 0;
      while (q.length) {
        const i = q.pop(); n++;
        const x = i % COLS, y = (i / COLS) | 0;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) return;
          const j = ny * COLS + nx;
          if (!seen[j] && grid[j] === FLOOR) { seen[j] = 1; q.push(j); }
        });
      }
      return n;
    }
    // a seeded prop: footprint all FLOOR, not reserved, no prop touching it, every floor tile still reachable
    function place(kind, w, h, x0, y0, x1, y1, code, extra, tries) {
      for (let t = 0; t < (tries || 30); t++) {
        const x = ri(x0, x1 - w + 1), y = ri(y0, y1 - h + 1);
        let ok = true;
        for (let yy = y - 1; yy <= y + h && ok; yy++) for (let xx = x - 1; xx <= x + w && ok; xx++) {
          const inside = xx >= x && xx < x + w && yy >= y && yy < y + h;
          const c = at(xx, yy);
          if (inside) { if (c !== FLOOR || reserved[yy * COLS + xx]) ok = false; }
          else if (c === PROP || c === WATER) ok = false;
        }
        if (!ok) continue;
        const before = floorCount();
        for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) grid[yy * COLS + xx] = code;
        if (reachable() === before - w * h) { const p = Object.assign({ kind, x, y, w, h }, extra || {}); props.push(p); return p; }
        for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) grid[yy * COLS + xx] = FLOOR;
      }
      return null;
    }
    if (lv === 1) {
      // the museum hall: a small ring sculpture, glass display cases with glowing exhibits, planters
      place('ring', 2, 1, 2, 3, 17, 9, PROP);
      for (let i = 0; i < 4; i++) place('case', 1, 1, 2, 3, 17, 9, PROP, { hue: ri(0, 3) });
      for (let i = 0; i < 2; i++) place('planter', 1, 1, 1, 2, 18, 10, PROP);
    } else if (lv === 2) {
      // the mall atrium: a fountain, palm planters, benches
      place('fountain', 2, 2, 3, 3, 16, 8, WATER);
      for (let i = 0; i < 3; i++) place('palm', 1, 1, 1, 2, 18, 10, PROP);
      for (let i = 0; i < 2; i++) place('bench', 2, 1, 2, 3, 17, 9, PROP);
    } else {
      // the airport gate: rows of seats, a luggage cart, a plant
      for (let i = 0; i < 3; i++) place('seats', 3, 1, 2, 3, 17, 9, PROP, { hue: ri(0, 2) });
      place('cart', 1, 1, 1, 2, 18, 10, PROP);
      place('planter', 1, 1, 1, 2, 18, 10, PROP);
    }
    // where kids appear (start of the zone phase, late joiners): open tiles in the middle band
    const spawn = [];
    for (let y = 4; y <= 8; y++) for (let x = 3; x <= 16; x++) {
      if (at(x, y) === FLOOR && at(x + 1, y) === FLOOR && at(x - 1, y) === FLOOR && at(x, y + 1) === FLOOR && at(x, y - 1) === FLOOR) spawn.push([x, y]);
    }
    return { cols: COLS, rows: ROWS, tile: TILE, seed: seed || 1, level: lv, grid, props, spawn, dock: DOCK };
  }

  // Is a w×h block at (x, y) all walkable floor (and away from the dock)?
  function blockFree(room, x, y, w, h) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      if (xx < 1 || yy < 1 || xx >= room.cols - 1 || yy >= room.rows - 1) return false;
      if (room.grid[yy * room.cols + xx] !== FLOOR) return false;
    }
    return !(y <= DOCK.y + 2 && x + w > DOCK.x - 2 && x < DOCK.x + DOCK.w + 2);
  }

  // The safe zones of one wave (level 1..3, wave 1..3) for `n` kids. Deterministic for (seed, level, wave, n):
  //   wave 1: big zones, no limit (learn the move) · wave 2: every zone has a limit (some splitting)
  //   wave 3: one more zone, tighter limits (the class must split up). Level 3 is a bit tighter everywhere.
  function waveZones(room, seed, level, wave, n) {
    const R = rng(((seed >>> 0) || 1) * 131 + level * 7907 + wave * 104729);
    const kids = Math.max(1, n | 0);
    const count = wave === 3 ? 4 : 3;
    const size = 3;
    let caps = null;
    if (wave >= 2) {
      const slack = wave === 2 ? (level === 3 ? 1.4 : 1.6) : (level === 3 ? 1.15 : 1.25);
      const total = Math.max(count * 2, Math.ceil(kids * slack));
      caps = Array.from({ length: count }, () => Math.max(2, Math.ceil(total / count)));
    }
    // candidate blocks, then a spread-out pick (zones at least 5 tiles apart, centre to centre)
    const cand = [];
    for (let y = 1; y < room.rows - size; y++) for (let x = 1; x < room.cols - size; x++) if (blockFree(room, x, y, size, size)) cand.push([x, y]);
    const out = [];
    let minD = 6;
    for (let pass = 0; pass < 4 && out.length < count; pass++, minD -= 1) {
      for (let t = 0; t < 400 && out.length < count && cand.length; t++) {
        const [x, y] = cand[Math.floor(R() * cand.length)];
        if (out.some((z) => Math.hypot(z.x - x, z.y - y) < minD)) continue;
        out.push({ id: out.length, x, y, w: size, h: size, cap: caps ? caps[out.length] : 0 });
      }
    }
    return out;
  }

  // Which zone (if any) holds a kid's feet (pixel point). Zones are rectangles in tiles.
  function zoneAt(zones, px, py) {
    const T = TILE;
    for (const z of zones || []) {
      if (px >= z.x * T - 2 && px <= (z.x + z.w) * T + 2 && py >= z.y * T - 2 && py <= (z.y + z.h) * T + 2) return z.id;
    }
    return -1;
  }

  // the saga avatar a kid runs as (same rule as Batalla de Nieve)
  const skinFor = (avatar, name) => SnowMap.skinFor(avatar, name);

  return {
    COLS, ROWS, TILE, FLOOR, WALL, WATER, PROP, LEVELS, DOCK, DIRS: SnowMap.DIRS, BODY: SnowMap.BODY,
    rng, buildRoom, waveZones, zoneAt, blockFree, skinFor,
    boxBlocked: SnowMap.boxBlocked, moveBody: SnowMap.moveBody, dirOf: SnowMap.dirOf, pathTo: SnowMap.pathTo, codeAtPx: SnowMap.codeAtPx,
  };
});
