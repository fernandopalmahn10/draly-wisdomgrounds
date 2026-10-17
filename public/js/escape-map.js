// La Gran Fuga de Dubái v2 «Las rutas de la fuga» (gameType 'escape') — the routes, their zones and the «zona segura»
// rooms, shared by the server (core/escape.js), the projector, every phone and the playtest bots, so one seed builds the
// same room everywhere (spec docs/specs/gran-fuga-v2.md).
//   ROUTES  one per round (Dubái first: the main stage; then China's wonders): three zones each, Hamdan's jet at the end
//   ZONES   per zone: its name, the room's name, the gate the crew runs through at its end, its art (a far background,
//           the ground strip the crew runs on, the top-down room), the room's walls as drawn in its picture, the props
//           the seed scatters in it, and the colours the screens fall back on while the art loads
// A room is a square hall of 16×16 tiles of 32 px (a portrait phone shows almost all of it): its painted picture
// covers the whole room; `layout` says which tiles are walls in that picture (the back wall is thicker) and which big
// objects of the picture block the way. Walking, walls and paths reuse the Batalla de Nieve code
// (public/js/snow-map.js): same tile codes, same feet box, same ≤ 1/60 s steps.
// Browser: window.EscapeMap (load snow-map.js first). Node: require('./public/js/escape-map').
(function (root, factory) {
  const SM = (typeof module === 'object' && module.exports) ? require('./snow-map') : root.SnowMap;
  const M = factory(SM);
  if (typeof module === 'object' && module.exports) module.exports = M;
  else root.EscapeMap = M;
})(typeof window !== 'undefined' ? window : this, function (SnowMap) {
  'use strict';
  const COLS = 16;
  const ROWS = 16;
  const TILE = SnowMap.TILE;                 // 32: the movement code reads its own TILE
  const { FLOOR, WALL, WATER, PROP } = SnowMap;
  const ART = '/assets/escape/';
  const JET = ART + 'jet.webp';

  // the zones. layout (tiles): top / bottom / left / right = the wall bands of the room's picture, blocks = the
  // picture's big objects inside them [x, y, w, h]. props = the kinds the seed scatters (PROP_ART). sky / ground /
  // floor / ink = fallback colours (sky top → horizon, ground top → bottom, the room's floor, the phone stage).
  const ZONES = {
    museo: {
      id: 'museo', name: 'Museo del Futuro', short: 'El Museo', at: 'en el Museo del Futuro', room: 'el vestíbulo del Museo', exit: 'museo',
      icon: '/assets/kingdoms/landmarks/big/museum.webp',
      layout: { top: 5, bottom: 1, left: 1, right: 1, blocks: [] },      // the oval window's wall fills the top 5 rows
      props: ['case', 'case', 'planter', 'lamp'],
      sky: ['#ffc9d6', '#ffe3b8'], ground: ['#f4f6fb', '#dfe6f3'], floor: '#eef1fa', ink: '#2a3a63',
    },
    fuente: {
      id: 'fuente', name: 'La Fuente del Burj Khalifa', short: 'La Fuente', at: 'en la Fuente del Burj Khalifa', room: 'la plaza de la Fuente', exit: 'arco',
      icon: '/assets/kingdoms/landmarks/big/burj.webp',
      // the lake and its balustrade on top, palms in planters down both sides, two palms and two lamps at the bottom
      layout: { top: 3, bottom: 1, left: 2, right: 2, blocks: [[4, 13, 2, 2], [10, 13, 2, 2], [2, 14, 1, 1], [13, 14, 1, 1]] },
      props: ['palm', 'bench', 'lamp', 'planter'],
      sky: ['#2f2470', '#ff9ab0'], ground: ['#f6ecd9', '#e5d3b4'], floor: '#f4e7cf', ink: '#2f2470',
    },
    pista: {
      id: 'pista', name: 'La pista del aeropuerto', short: 'La pista', at: 'en la pista del aeropuerto', room: 'la puerta de embarque', exit: 'jet',
      icon: JET, iconFallback: '/assets/saga/avatars/plane.webp',
      // the window wall on top, rows of seats down both sides, plants in the corners
      layout: { top: 2, bottom: 1, left: 2, right: 2, blocks: [[2, 2, 1, 1], [2, 14, 1, 1]] },
      props: ['seats', 'cart', 'planter'],
      sky: ['#c9a6e8', '#ffb36b'], ground: ['#8d97ad', '#6f7a92'], floor: '#dfe7f2', ink: '#3a3f63',
    },
    mercado: {
      id: 'mercado', name: 'El Mercado Nocturno', short: 'El Mercado', at: 'en el Mercado Nocturno', room: 'la plaza del mercado', exit: 'paifang',
      icon: '/assets/paint/props/lantern.webp',
      // the stalls and their lanterns on top, fruit baskets and crates down both sides and along the bottom corners
      layout: { top: 3, bottom: 1, left: 2, right: 2, blocks: [[2, 14, 4, 1], [10, 14, 4, 1]] },
      props: ['stall', 'sacks', 'steamers', 'vase'],
      sky: ['#0d1a44', '#5a3a8e'], ground: ['#8a7768', '#6e5b4f'], floor: '#9b8a7c', ink: '#1d1a3a',
    },
    jardin: {
      id: 'jardin', name: 'El Jardín Chino', short: 'El Jardín', at: 'en el Jardín Chino', room: 'el patio del jardín', exit: 'luna',
      icon: '/assets/paint/shanghai/garden.webp',
      // the white wall with its moon gate on top, garden beds down both sides; at the bottom the koi pond, a bonsai,
      // a bamboo clump, a rock and a blossom tree
      layout: { top: 4, bottom: 1, left: 2, right: 2, props: 2, blocks: [[2, 12, 3, 3], [5, 13, 2, 2], [9, 13, 2, 2], [11, 14, 2, 1], [13, 13, 1, 2]] },
      props: ['rock', 'bonsai', 'stonelantern', 'bamboo'],
      sky: ['#9fc7e8', '#fde3ea'], ground: ['#e9e2d4', '#cfc4b0'], floor: '#ddd5c4', ink: '#33405e',
    },
    muralla: {
      id: 'muralla', name: 'La Gran Muralla', short: 'La Muralla', at: 'en la Gran Muralla', room: 'la torre de la Muralla', exit: 'jet',
      icon: '/assets/paint/muralla/tower.webp',
      // the parapets all round; the watchtower fills the top middle, Robotín waits in its doorway
      layout: { top: 2, bottom: 1, left: 2, right: 2, dockY: 3, blocks: [[3, 2, 10, 1], [3, 3, 4, 1], [9, 3, 4, 1]] },
      props: ['rock', 'lion', 'stonelantern', 'vase'],
      sky: ['#ff9a62', '#ffd6a0'], ground: ['#cdbb9c', '#a8977a'], floor: '#cbbd9f', ink: '#4a3326',
    },
  };
  const ROUTES = [
    { id: 'dubai', name: 'Ruta de Dubái', short: 'Dubái', zones: ['museo', 'fuente', 'pista'],
      ranks: { cielo: 'Pilotos del Cielo', burj: 'Viajeros del Burj', zoco: 'Exploradores del Zoco' },
      rankArt: { cielo: JET, burj: '/assets/kingdoms/landmarks/big/burj.webp', zoco: '/assets/saga/avatars/camel.webp' },
      intro: 'Robotín, el guardia del Museo del Futuro, tiene un fallo y persigue a todo el equipo por Dubái.' },
    { id: 'china', name: 'Ruta de China', short: 'China', zones: ['mercado', 'jardin', 'muralla'],
      ranks: { cielo: 'Pilotos del Cielo', burj: 'Viajeros de la Muralla', zoco: 'Exploradores del Mercado' },
      rankArt: { cielo: JET, burj: '/assets/paint/muralla/tower.webp', zoco: '/assets/paint/props/lantern.webp' },
      intro: '¡Robotín los persigue por el portal del Museo hasta China! Mercado, jardín… ¡y la Gran Muralla!' },
  ];
  const routeIdx = (r) => ((Number(r) || 0) % ROUTES.length + ROUTES.length) % ROUTES.length;
  const route = (r) => ROUTES[routeIdx(r)];
  // the zone of level 1..3 on route r
  const zoneOf = (r, level) => ZONES[route(r).zones[Math.max(1, Math.min(3, level | 0 || 1)) - 1]];
  const zonesOf = (r) => route(r).zones.map((id) => ZONES[id]);
  const art = (zid, file) => ART + zid + '/' + file + '.webp';
  const gateArt = (id) => (id === 'jet' ? JET : ART + 'gates/' + id + '.webp');
  // the seeded props: their picture, how many tiles they block and how wide they are drawn (tiles)
  const PROP_ART = {
    case: { f: '/assets/props/display-case.webp', w: 1, h: 1, dw: 0.95 },
    planter: { f: '/assets/props/planter.webp', w: 1, h: 1, dw: 0.95 },
    lamp: { f: '/assets/props/lamp.webp', w: 1, h: 1, dw: 0.62 },
    palm: { f: '/assets/props/palm-pot.webp', w: 1, h: 1, dw: 1.2 },
    bench: { f: '/assets/props/bench.webp', w: 2, h: 1, dw: 1.9 },
    seats: { f: '/assets/props/seats.webp', w: 2, h: 1, dw: 2 },
    cart: { f: '/assets/props/cart.webp', w: 1, h: 1, dw: 1.05 },
    stall: { f: '/assets/props/stall.webp', w: 2, h: 1, dw: 1.9 },
    sacks: { f: '/assets/props/sacks.webp', w: 1, h: 1, dw: 1.25 },
    rock: { f: '/assets/props/rock.webp', w: 1, h: 1, dw: 1.15 },
    vase: { f: ART + 'props/vase.webp', w: 1, h: 1, dw: 0.85 },
    bamboo: { f: ART + 'props/bamboo.webp', w: 1, h: 1, dw: 1 },
    stonelantern: { f: ART + 'props/stonelantern.webp', w: 1, h: 1, dw: 0.9 },
    steamers: { f: ART + 'props/steamers.webp', w: 1, h: 1, dw: 1 },
    lion: { f: ART + 'props/lion.webp', w: 1, h: 1, dw: 1 },
    bonsai: { f: ART + 'props/bonsai.webp', w: 1, h: 1, dw: 1.05 },
  };

  function rng(seed) { return SnowMap.rng(seed); }

  // The room of level 1..3 on route r. The walls come from the zone's picture; the seed scatters 3 of its props.
  function buildRoom(seed, level, r) {
    const lv = Math.max(1, Math.min(3, level | 0));
    const z = zoneOf(r, lv);
    const L = z.layout;
    const R = rng(((seed >>> 0) || 1) * 31 + lv * 977 + routeIdx(r) * 4111);
    const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
    const grid = new Uint8Array(COLS * ROWS);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      grid[y * COLS + x] = (x < L.left || y < L.top || x >= COLS - L.right || y >= ROWS - L.bottom) ? WALL : FLOOR;
    }
    const at = (x, y) => (x < 0 || y < 0 || x >= COLS || y >= ROWS ? WALL : grid[y * COLS + x]);
    const props = [];
    const reserved = new Uint8Array(COLS * ROWS);
    const reserve = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < COLS && y < ROWS) reserved[y * COLS + x] = 1; };
    (L.blocks || []).forEach(([x, y, w, h]) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (xx >= 0 && yy >= 0 && xx < COLS && yy < ROWS) grid[yy * COLS + xx] = PROP; });
    // Robotín's charging dock: in front of the back wall, in the middle (or in a doorway of the picture: `dockY`)
    const dock = { x: COLS / 2 - 1, y: L.dockY != null ? L.dockY : L.top, w: 2, h: 1 };
    for (let xx = dock.x; xx < dock.x + dock.w; xx++) grid[dock.y * COLS + xx] = PROP;
    props.push({ kind: 'dock', x: dock.x, y: dock.y, w: dock.w, h: dock.h });
    reserve(dock.x - 2, dock.y, dock.x + dock.w + 1, dock.y + 2);
    reserve(5, 6, 10, 9);                              // the middle stays open: kids start there after each wave
    const floorCount = () => { let n = 0; for (let i = 0; i < grid.length; i++) if (grid[i] === FLOOR) n++; return n; };
    function reachable() {
      const seen = new Uint8Array(COLS * ROWS);
      const start = 8 * COLS + 8;
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
    function place(kind, tries) {
      const pa = PROP_ART[kind] || { w: 1, h: 1 };
      const w = pa.w, h = pa.h;
      for (let t = 0; t < (tries || 40); t++) {
        const x = ri(L.left + 1, COLS - L.right - 1 - w), y = ri(L.top + 1, ROWS - L.bottom - 1 - h);
        let ok = true;
        for (let yy = y - 1; yy <= y + h && ok; yy++) for (let xx = x - 1; xx <= x + w && ok; xx++) {
          const inside = xx >= x && xx < x + w && yy >= y && yy < y + h;
          const c = at(xx, yy);
          if (inside) { if (c !== FLOOR || reserved[yy * COLS + xx]) ok = false; }
          else if (c === PROP || c === WATER) ok = false;
        }
        if (!ok) continue;
        const before = floorCount();
        for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) grid[yy * COLS + xx] = PROP;
        if (reachable() === before - w * h) { const p = { kind, x, y, w, h }; props.push(p); return p; }
        for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) grid[yy * COLS + xx] = FLOOR;
      }
      return null;
    }
    // a few of the zone's props (3, or the layout's own `props` count in a room whose picture is already busy), picked
    // by the seed (a new arrangement every round)
    const pool = z.props.slice();
    for (let i = 0; i < (L.props == null ? 3 : L.props) && pool.length; i++) place(pool.splice(Math.floor(R() * pool.length), 1)[0]);
    // where kids appear (start of the zone phase, late joiners): open tiles in the middle band, a few rows below Robotín
    // (classroom playtest: a kid spawned under his dock read as «Robotín = TÚ»)
    const spawn = [];
    for (let y = Math.max(5, dock.y + 3); y <= 12; y++) for (let x = 3; x <= 12; x++) {
      if (at(x, y) === FLOOR && at(x + 1, y) === FLOOR && at(x - 1, y) === FLOOR && at(x, y + 1) === FLOOR && at(x, y - 1) === FLOOR) spawn.push([x, y]);
    }
    return { cols: COLS, rows: ROWS, tile: TILE, seed: seed || 1, level: lv, route: routeIdx(r), zone: z.id, grid, props, spawn, dock, layout: L };
  }

  // Is a w×h block at (x, y) all walkable floor (and away from Robotín's dock)?
  function blockFree(room, x, y, w, h) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      if (xx < 1 || yy < 1 || xx >= room.cols - 1 || yy >= room.rows - 1) return false;
      if (room.grid[yy * room.cols + xx] !== FLOOR) return false;
    }
    const d = room.dock;
    return !(y <= d.y + 1 && x + w > d.x - 1 && x < d.x + d.w + 1);      // (Robotín stands there: a tile of room around him)
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
    for (let pass = 0; pass < 5 && out.length < count; pass++, minD -= 1) {
      for (let t = 0; t < 400 && out.length < count && cand.length; t++) {
        const [x, y] = cand[Math.floor(R() * cand.length)];
        if (out.some((z) => Math.hypot(z.x - x, z.y - y) < minD || !(x >= z.x + z.w || z.x >= x + size || y >= z.y + z.h || z.y >= y + size))) continue;
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
  // how far (px) a point is from the nearest zone's edge (0 inside one)
  function zoneDist(zones, px, py) {
    let best = Infinity;
    (zones || []).forEach((z) => {
      const x0 = z.x * TILE, y0 = z.y * TILE, x1 = (z.x + z.w) * TILE, y1 = (z.y + z.h) * TILE;
      const dx = Math.max(x0 - px, 0, px - x1), dy = Math.max(y0 - py, 0, py - y1);
      best = Math.min(best, Math.hypot(dx, dy));
    });
    return best;
  }

  // the saga avatar a kid runs as (same rule as Batalla de Nieve)
  const skinFor = (avatar, name) => SnowMap.skinFor(avatar, name);

  return {
    COLS, ROWS, TILE, FLOOR, WALL, WATER, PROP, ROUTES, ZONES, PROP_ART, JET,
    rng, route, routeIdx, zoneOf, zonesOf, art, gateArt, buildRoom, waveZones, zoneAt, zoneDist, blockFree, skinFor,
    DIRS: SnowMap.DIRS, BODY: SnowMap.BODY,
    boxBlocked: SnowMap.boxBlocked, moveBody: SnowMap.moveBody, dirOf: SnowMap.dirOf, pathTo: SnowMap.pathTo, codeAtPx: SnowMap.codeAtPx,
  };
});
