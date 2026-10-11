// Dragones Pintores (gameType 'paint') — level + rules, no sockets.
// A side-view sky of cloud platforms on a tile grid. Kids fly baby dragons on their phones; every surface tile they land on
// turns their kingdom's colour. Surface = a solid tile with empty space above it (that's what gets painted).
// The level is generated from a seed so the server, the projector and every phone build the exact same map.
'use strict';

const COLS = 60;            // 60×36 fills a 16:9 projector next to the two rosters
const ROWS = 36;
const TILE = 32;

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// Returns { cols, rows, tile, seed, solid: [row strings of '#'/'.'], surfaces: [ids], gems: [[x,y]], spawns: {red, gold} }
function buildLevel(seed) {
  const R = rng(seed || 1);
  const g = Array.from({ length: ROWS }, () => new Array(COLS).fill(false));
  const fill = (x0, x1, y) => { for (let x = Math.max(0, x0); x <= Math.min(COLS - 1, x1); x++) g[y][x] = true; };
  // ground with a few gaps (never under the spawn zones)
  fill(0, COLS - 1, ROWS - 1);
  fill(0, COLS - 1, ROWS - 2);
  for (let k = 0; k < 4; k++) {
    const gx = 14 + Math.floor(R() * (COLS - 30));
    for (let x = gx; x < gx + 3; x++) { g[ROWS - 1][x] = false; g[ROWS - 2][x] = false; }
  }
  // floating platform tiers (each tier ~4 rows above the last: reachable with jump + flap)
  const tiers = [ROWS - 6, ROWS - 10, ROWS - 14, ROWS - 18, ROWS - 22, ROWS - 26, ROWS - 30, ROWS - 34];
  tiers.forEach((y, ti) => {
    let x = Math.floor(R() * 5);
    while (x < COLS - 3) {
      const len = 4 + Math.floor(R() * 10);
      fill(x, x + len, y);
      if (R() < 0.25 && y + 3 < ROWS - 2) { const wx = x + Math.floor(R() * len); for (let yy = y; yy < y + 3; yy++) g[yy][wx] = true; }
      x += len + 3 + Math.floor(R() * (ti < 2 ? 5 : 7));
    }
  });
  // a couple of tall pillars to climb around
  for (let k = 0; k < 3; k++) {
    const px = 20 + Math.floor(R() * (COLS - 40));
    for (let y = ROWS - 8; y < ROWS - 2; y++) g[y][px] = true;
  }
  // keep the spawn columns clear above the ground
  [[2, 6], [COLS - 7, COLS - 3]].forEach(([a, b]) => { for (let y = 0; y < ROWS - 2; y++) for (let x = a; x <= b; x++) g[y][x] = false; });

  const surfaces = [];
  for (let y = 1; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (g[y][x] && !g[y - 1][x]) surfaces.push(y * COLS + x);
  // Gems float 3 rows above a paintable surface, in open air (never inside a wall or pillar), never stacked.
  const gems = [];
  const air = (x, y) => y > 2 && y < ROWS && !g[y][x];
  for (let tries = 0; gems.length < 14 && tries < 120; tries++) {
    const id = surfaces[Math.floor(R() * surfaces.length)];
    const x = id % COLS; const y = Math.floor(id / COLS) - 3;
    if (air(x, y) && air(x, y + 1) && air(x, y + 2) && !gems.some(([gx, gy]) => gx === x && gy === y)) gems.push([x, y]);
  }
  return {
    cols: COLS, rows: ROWS, tile: TILE, seed,
    solid: g.map((row) => row.map((v) => (v ? '#' : '.')).join('')),
    surfaces, gems,
    spawns: { red: [4, ROWS - 3], gold: [COLS - 5, ROWS - 3] },
  };
}

function counts(own) {
  const c = { red: 0, gold: 0 };
  Object.values(own).forEach((t) => { if (c[t] !== undefined) c[t]++; });
  return c;
}

module.exports = { COLS, ROWS, TILE, buildLevel, counts };
