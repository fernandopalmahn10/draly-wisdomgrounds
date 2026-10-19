// Batalla de Nieve en Ski Dubái (gameType 'snow') — the map, shared by the server (core/snow.js), the projector, every
// phone and the playtest bots, so a seed builds the exact same Dubai everywhere.
// Top-down tile map, 44×26 tiles of 32 px. The zones never move (kids learn the map): El Zoco top-left, El Creek
// top-middle (water + quay with pearl spots), Museo del Futuro top-right, Ski Dubái in the centre (the ice team's home),
// El Desierto bottom-left (date palms, oasis), El Bulevar bottom-middle (Dubai Frame), Plaza del Burj Khalifa
// bottom-right. What the seed changes: market stalls, igloos, snowmen, pines, palms, planters, boats.
// Browser: window.SnowMap. Node: require('./public/js/snow-map').
(function (root, factory) {
  const M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M;
  else root.SnowMap = M;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  const COLS = 44;
  const ROWS = 26;
  const TILE = 32;
  // grid codes: kids walk only on FLOOR; snowballs fly over FLOOR and WATER, stop on WALL and PROP
  const FLOOR = 0, WALL = 1, WATER = 2, PROP = 3;
  const CX = 22, CY = 12.5;            // Ski Dubái centre (tile units): the ice team's home
  const ZONES = {
    zoco: { name: 'El Zoco' },
    creek: { name: 'El Creek' },
    museo: { name: 'Museo del Futuro' },
    ski: { name: 'Ski Dubái' },
    desierto: { name: 'El Desierto' },
    bulevar: { name: 'El Bulevar' },
    plaza: { name: 'Plaza del Burj Khalifa' },
  };
  // the 4-colour question stations (2×2 each, fixed so kids learn where they are)
  const STATIONS = [
    { id: 0, zone: 'zoco', x: 6, y: 4 },
    { id: 1, zone: 'museo', x: 33, y: 6 },
    { id: 2, zone: 'plaza', x: 34, y: 14 },
    { id: 3, zone: 'desierto', x: 8, y: 15 },
    { id: 4, zone: 'bulevar', x: 21, y: 20 },
  ];
  // saga avatars a kid can walk as (public/js/saga.js); the lobby stores the kid's pick as an emoji
  const SKINS = ['dralingo', 'fer', 'hamdan', 'latifa', 'aileen', 'adric', 'adrian', 'camel', 'plane', 'falcon', 'oryx'];
  const EMOJI = {
    '🐉': 'dralingo', '🐲': 'dralingo', '👨‍🏫': 'fer', '🧔': 'hamdan', '🧕': 'latifa', '🌎': 'aileen', '🐕': 'adric',
    '🐶': 'adric', '🗺️': 'adrian', '🗺': 'adrian', '🐪': 'camel', '🐫': 'camel', '✈️': 'plane', '✈': 'plane',
    '🦅': 'falcon', '🦌': 'oryx',
  };

  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  // What the ground looks like (and is) at a tile.
  function groundAt(x, y) {
    if (x <= 0 || y <= 0 || x >= COLS - 1 || y >= ROWS - 1) return 'wall';
    if (x >= 15 && x <= 28 && y <= 4) return 'water';
    if (x >= 14 && x <= 29 && y <= 6) return 'quay';
    if (x <= 13 && y <= 9) return 'market';
    if (x >= 30 && y <= 9) return 'museum';
    const ex = (x + 0.5 - CX) / 7.6, ey = (y + 0.5 - CY) / 5.3;
    if (ex * ex + ey * ey <= 1) return 'snow';
    if (x <= 13) return 'sand';
    if (x >= 30) return 'plaza';
    if (y >= 18) return 'boulevard';
    return 'path';
  }
  function zoneAt(x, y) {
    const gnd = groundAt(x, y);
    return { market: 'zoco', museum: 'museo', water: 'creek', quay: 'creek', snow: 'ski', path: 'ski', sand: 'desierto',
      plaza: 'plaza', boulevard: 'bulevar', wall: null }[gnd];
  }

  function buildMap(seed) {
    const R = rng(seed || 1);
    const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
    const grid = new Uint8Array(COLS * ROWS);
    const at = (x, y) => (x < 0 || y < 0 || x >= COLS || y >= ROWS ? WALL : grid[y * COLS + x]);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const gnd = groundAt(x, y);
        grid[y * COLS + x] = gnd === 'wall' ? WALL : gnd === 'water' ? WATER : FLOOR;
      }
    }
    const props = [];
    const reserved = new Uint8Array(COLS * ROWS);    // tiles that must stay walkable (paths, spawns, stand spots)
    const reserve = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < COLS && y < ROWS) reserved[y * COLS + x] = 1; };

    // fixed features first
    const fixed = (kind, x, y, w, h, code, extra) => {
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) grid[yy * COLS + xx] = code;
      props.push(Object.assign({ kind, x, y, w, h }, extra || {}));
    };
    STATIONS.forEach((s) => { fixed('station', s.x, s.y, 2, 2, PROP, { id: s.id, zone: s.zone }); reserve(s.x - 1, s.y - 1, s.x + 2, s.y + 2); });
    fixed('atlantis', 16, 1, 3, 2, PROP);            // landmarks standing in the creek
    fixed('arab', 25, 1, 2, 2, PROP);
    fixed('museum', 36, 2, 3, 2, PROP);
    reserve(35, 1, 39, 4);
    fixed('burj', 37, 19, 2, 2, PROP);
    fixed('fountain', 32, 20, 3, 2, WATER);
    reserve(31, 18, 39, 22);
    fixed('frame', 26, 22, 2, 1, PROP);
    reserve(25, 21, 28, 23);
    fixed('oasis', 4, 19, 2, 2, WATER);
    reserve(3, 18, 6, 21);
    reserve(14, 5, 29, 5);                            // the quay row where kids stand to dive for pearls
    // the ice team's home: the middle of Ski Dubái stays open
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const d = Math.hypot(x + 0.5 - CX, y + 0.5 - CY);
      if (d < 3.6) reserved[y * COLS + x] = 1;
    }
    // the gates between zones stay open (a corridor through every border)
    reserve(13, 2, 14, 9); reserve(29, 2, 30, 9);     // zoco|creek|museo
    reserve(2, 9, 12, 10); reserve(31, 9, 41, 10);    // zoco|desierto, museo|plaza
    reserve(13, 11, 15, 23); reserve(28, 11, 30, 23); // desierto|centre, centre|plaza
    reserve(15, 17, 28, 18);                          // centre|bulevar
    reserve(20, 6, 24, 8);                            // creek|centre

    // flood fill from the centre: every walkable tile must stay reachable
    const floorCount = () => { let n = 0; for (let i = 0; i < grid.length; i++) if (grid[i] === FLOOR) n++; return n; };
    function reachable() {
      const seen = new Uint8Array(COLS * ROWS);
      const start = Math.floor(CY) * COLS + Math.floor(CX);
      const q = [start];
      seen[start] = 1;
      let n = 0;
      while (q.length) {
        const i = q.pop();
        n++;
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
    // a seeded prop: footprint all FLOOR of the right ground, not reserved, no other prop touching it, map still connected
    function place(kind, w, h, grounds, x0, y0, x1, y1, extra, tries) {
      for (let t = 0; t < (tries || 40); t++) {
        const x = ri(x0, x1 - w + 1), y = ri(y0, y1 - h + 1);
        let ok = true;
        for (let yy = y - 1; yy <= y + h && ok; yy++) {
          for (let xx = x - 1; xx <= x + w && ok; xx++) {
            const inside = xx >= x && xx < x + w && yy >= y && yy < y + h;
            const c = at(xx, yy);
            if (inside) { if (c !== FLOOR || reserved[yy * COLS + xx] || !grounds.includes(groundAt(xx, yy))) ok = false; }
            else if (c === PROP) ok = false;
          }
        }
        if (!ok) continue;
        const before = floorCount();
        for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) grid[yy * COLS + xx] = PROP;
        if (reachable() === before - w * h) { const p = Object.assign({ kind, x, y, w, h }, extra || {}); props.push(p); return p; }
        for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) grid[yy * COLS + xx] = FLOOR;
      }
      return null;
    }
    // El Zoco: two rows of stalls with alleys
    const AWN = ['#f0443a', '#26b5a8', '#ff9f1c', '#8b5cf6', '#2f7bea'];
    [2, 7].forEach((row) => {
      let x = 1 + ri(0, 1);
      while (x + 1 <= 12) {
        const len = 2 + ri(0, 1);
        place('stall', len, 1, ['market'], x, row, Math.min(12, x + len - 1), row, { awning: AWN[ri(0, AWN.length - 1)], goods: ri(0, 2) }, 1);
        x += len + 1 + ri(0, 1);
      }
    });
    for (let i = 0; i < 2; i++) place('sacks', 1, 1, ['market'], 1, 3, 12, 9, { tint: ri(0, 2) });
    // Museo del Futuro: modern planters
    for (let i = 0; i < 4; i++) place('planter', 1, 1, ['museum'], 30, 1, 42, 9);
    // Ski Dubái: igloos, snowmen, pine trees
    for (let i = 0; i < 3; i++) place('igloo', 2, 2, ['snow'], 14, 7, 29, 17);
    for (let i = 0; i < 4; i++) place('snowman', 1, 1, ['snow'], 14, 7, 29, 17, { scarf: AWN[ri(0, AWN.length - 1)] });
    for (let i = 0; i < 6; i++) place('pine', 1, 1, ['snow', 'path'], 14, 7, 29, 17);
    // El Desierto: date palms (the first four have dates to harvest), rocks, a resting camel
    const palms = [];
    for (let i = 0; i < 7; i++) { const p = place('palm', 1, 1, ['sand'], 1, 11, 13, 24); if (p) palms.push(p); }
    for (let i = 0; i < 2; i++) place('rock', 1, 1, ['sand'], 1, 11, 13, 24);
    place('camel', 2, 1, ['sand'], 1, 11, 13, 24);
    // El Bulevar + Plaza: palm planters and benches
    for (let i = 0; i < 3; i++) place('potpalm', 1, 1, ['boulevard'], 14, 18, 29, 24);
    for (let i = 0; i < 3; i++) place('bench', 2, 1, ['plaza'], 30, 11, 42, 24);
    for (let i = 0; i < 2; i++) place('planter', 1, 1, ['plaza'], 30, 11, 42, 24);

    // decorations that never block (drawn only)
    const decor = [];
    for (let i = 0; i < 3; i++) decor.push({ kind: 'boat', x: 19 + i * 3 + R() * 1.5, y: 2.2 + R() * 1.4, hue: ri(0, 2) });
    for (let i = 0; i < 5; i++) decor.push({ kind: 'dune', x: 1.5 + R() * 11, y: 11.5 + R() * 12.5, s: 0.7 + R() * 0.8 });
    for (let i = 0; i < 6; i++) decor.push({ kind: 'lamp', x: 14.5 + i * 2.6, y: 18.3 + (i % 2) * 6 });
    for (let i = 0; i < 4; i++) decor.push({ kind: 'lantern', x: 1.6 + i * 3.3 + R(), y: 5.3 + R() * 0.6, hue: ri(0, 4) });

    // jobs: pearl diving along the quay (stand on row 5, the oyster is in the water on row 4), dates on the palms
    const jobs = [];
    [17, 20, 23, 27].forEach((x) => jobs.push({ id: jobs.length, kind: 'pearl', x: x + 0.5, y: 4.5, zone: 'creek' }));
    palms.slice(0, 4).forEach((p) => jobs.push({ id: jobs.length, kind: 'date', x: p.x + 0.5, y: p.y + 0.5, zone: 'desierto' }));
    palms.slice(0, 4).forEach((p) => { p.dates = true; });

    // where kids appear: survivors far from the centre, the ice team around it
    const sun = [], ice = [];
    const chest = {};
    for (let y = 1; y < ROWS - 1; y++) {
      for (let x = 1; x < COLS - 1; x++) {
        if (grid[y * COLS + x] !== FLOOR) continue;
        const open4 = at(x + 1, y) === FLOOR && at(x - 1, y) === FLOOR && at(x, y + 1) === FLOOR && at(x, y - 1) === FLOOR;
        const d = Math.hypot(x + 0.5 - CX, y + 0.5 - CY);
        const z = zoneAt(x, y);
        if (d < 3 && open4) ice.push([x, y]);
        if (d > 11 && open4 && ['zoco', 'museo', 'desierto', 'plaza'].includes(z)) sun.push([x, y]);
        if (open4 && z && !(z === 'ski' && d < 4)) (chest[z] = chest[z] || []).push([x, y]);
      }
    }
    return {
      cols: COLS, rows: ROWS, tile: TILE, seed: seed || 1, grid, props, decor, jobs,
      stations: STATIONS.map((s) => Object.assign({ w: 2, h: 2 }, s)),
      spawns: { sun, ice, center: [CX, CY] }, chestSpots: chest,
    };
  }

  // ---------- movement (phones and bots run it; the server only checks the result) ----------
  const BODY = { hw: 9, top: 8, bottom: 3 };          // feet box around (x, y) = the kid's feet
  const codeAtPx = (map, px, py) => {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= map.cols || ty >= map.rows) return WALL;
    return map.grid[ty * map.cols + tx];
  };
  // inset > 0 shrinks the box (the server's check: a phone hugging a wall is never refused for a rounding hair)
  function boxBlocked(map, x, y, inset) {
    const i = inset || 0;
    const pts = [[x - BODY.hw + i, y - BODY.top + i], [x + BODY.hw - i, y - BODY.top + i], [x - BODY.hw + i, y + BODY.bottom - i], [x + BODY.hw - i, y + BODY.bottom - i]];
    return pts.some(([px, py]) => codeAtPx(map, px, py) !== FLOOR);
  }
  // Move a body by (dx, dy) px, one axis at a time, sliding along walls. Steps must stay small (≤ 1/60 s).
  function moveBody(map, b, dx, dy) {
    if (dx && !boxBlocked(map, b.x + dx, b.y)) b.x += dx;
    if (dy && !boxBlocked(map, b.x, b.y + dy)) b.y += dy;
    return b;
  }
  // 8 directions: f = 0 right, 1 down-right, 2 down, … 7 up-right (screen coordinates)
  const DIRS = [[1, 0], [0.7071, 0.7071], [0, 1], [-0.7071, 0.7071], [-1, 0], [-0.7071, -0.7071], [0, -1], [0.7071, -0.7071]];
  function dirOf(vx, vy) {
    if (!vx && !vy) return -1;
    const a = Math.atan2(vy, vx);
    return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
  }
  // Shortest walk on the tile grid (4-neighbour BFS) from a pixel point to a tile next to the target rectangle.
  function pathTo(map, fromX, fromY, tx0, ty0, tw, th) {
    const start = Math.floor(fromY / TILE) * map.cols + Math.floor(fromX / TILE);
    const goal = new Set();
    for (let y = ty0 - 1; y <= ty0 + (th || 1); y++) for (let x = tx0 - 1; x <= tx0 + (tw || 1); x++) {
      if (x >= 0 && y >= 0 && x < map.cols && y < map.rows && map.grid[y * map.cols + x] === FLOOR) goal.add(y * map.cols + x);
    }
    const prev = new Int32Array(map.cols * map.rows).fill(-2);
    prev[start] = -1;
    const q = [start];
    let found = -1;
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      if (goal.has(i)) { found = i; break; }
      const x = i % map.cols, y = (i / map.cols) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= map.cols || ny >= map.rows) continue;
        const j = ny * map.cols + nx;
        if (prev[j] !== -2 || map.grid[j] !== FLOOR) continue;
        prev[j] = i;
        q.push(j);
      }
    }
    if (found < 0) return null;
    const out = [];
    for (let i = found; i >= 0; i = prev[i]) out.push([(i % map.cols + 0.5) * TILE, (((i / map.cols) | 0) + 0.5) * TILE + 6]);
    return out.reverse();
  }

  // 🪙 2026-10-19 El Zoco de Dralingo: a skin the kid unlocked (the server lets one into a room only when the kid's
  // account owns it) is their character too. The list is public/js/saga.js ZOCO (the page's window.Saga; the server's
  // require). Every game's skinFor answers through here or through HalconBoard.skinFor.
  let SagaRef = null;
  function zocoSkin(id) {
    if (!SagaRef) {
      if (typeof window !== 'undefined' && window.Saga) SagaRef = window.Saga;
      else if (typeof module === 'object' && module.exports && typeof require === 'function') { try { SagaRef = require('./saga'); } catch (_) { SagaRef = null; } }
    }
    return SagaRef && SagaRef.zoco ? SagaRef.zoco(id) : null;
  }
  // the saga avatar a kid walks as: their lobby pick, or (old animal emoji / nothing) one picked from their name
  function skinFor(avatar, name) {
    if (typeof avatar === 'string') {
      if (EMOJI[avatar]) return EMOJI[avatar];
      if (SKINS.includes(avatar) || zocoSkin(avatar)) return avatar;
    }
    const s = String(name || '').toLowerCase();
    let h = 7;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return SKINS[h % SKINS.length];
  }

  return {
    COLS, ROWS, TILE, FLOOR, WALL, WATER, PROP, CX, CY, ZONES, STATIONS, SKINS, DIRS, BODY,
    rng, groundAt, zoneAt, buildMap, boxBlocked, moveBody, dirOf, pathTo, skinFor, codeAtPx,
  };
});
