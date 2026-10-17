// Dragones Pintores v2 «El Cielo de las Maravillas» — the worlds and the sky, as data. ONE file for the server's rules
// (core/paint.js requires it) and both screens (js/paint-render.js draws it on the phone and the projector), so every
// screen builds the very same sky from the round's world + seed.
//   W, H      the sky in world units (the projector shows all of it; a phone follows its own dragon)
//   WORLDS    one per round (Dubái first, then China's wonders): name, the art folder, the three prize islands
//             (centre = contested, then the Fuego side, then the Mar side), its sky props and its colours
//   SLOTS     where the three islands float: one on the centre line, two mirrored (fair for both kingdoms)
//   HOMES     each kingdom's home cloud (Fuego left, Mar right)
//   build(world, seed)  the round's sky: clouds placed from the seed, mirrored across the centre line
// Browser: window.PaintWorlds. Node: require('./public/js/paint-worlds').
(function (root, factory) {
  const W = factory();
  if (typeof module === 'object' && module.exports) module.exports = W;
  else root.PaintWorlds = W;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  const W = 1600, H = 1000;
  const LM_R = 112;                 // an island's capture ring (world units)
  const SLOTS = [{ x: 800, y: 290 }, { x: 330, y: 640 }, { x: 1270, y: 640 }];
  const HOMES = { red: [110, 520], gold: [1490, 520] };
  // h = how tall the island picture is drawn (world units); the ring is the same for every island
  const WORLDS = [
    {
      id: 'dubai', name: 'Dubái de noche', short: 'Dubái', night: true,
      sky: ['#140f3a', '#2f2470', '#6b3f98'], glow: '#ffcf6b', cloudTint: 'rgba(90,100,200,0.22)',
      lms: [
        { id: 'burj', name: 'Burj Khalifa', h: 330 },
        { id: 'museum', name: 'Museo del Futuro', h: 200 },
        { id: 'arab', name: 'Burj Al Arab', h: 250 },
      ],
      props: ['balloon', 'skylantern', 'balloon'], fireworks: true,
    },
    {
      id: 'muralla', name: 'La Gran Muralla al atardecer', short: 'La Gran Muralla',
      sky: ['#ff9a62', '#ffc58a', '#c9a6e8'], glow: '#ffd27a', cloudTint: 'rgba(255,170,120,0.18)',
      lms: [
        { id: 'temple', name: 'Templo del Cielo', h: 240 },
        { id: 'tower', name: 'Torre de la Muralla', h: 220 },
        { id: 'panda', name: 'Isla del Panda', h: 220 },
      ],
      props: ['kite', 'crane', 'kite'],
    },
    {
      id: 'rio', name: 'El río Li', short: 'El río Li',
      sky: ['#5b8fb0', '#9fc7cf', '#d9c4e6'], glow: '#ffd9a0', cloudTint: 'rgba(120,170,190,0.16)',
      lms: [
        { id: 'pagoda', name: 'Pagoda del Pico', h: 270 },
        { id: 'elephant', name: 'Colina Trompa de Elefante', h: 210 },
        { id: 'bridge', name: 'Puente de la Luna', h: 210 },
      ],
      props: ['skylantern', 'crane', 'lantern'],
    },
    {
      id: 'shanghai', name: 'Las luces de Shanghái', short: 'Shanghái', night: true,
      sky: ['#0d1a44', '#23317a', '#5a3a8e'], glow: '#ff7ac8', cloudTint: 'rgba(80,110,210,0.22)',
      lms: [
        { id: 'pearl', name: 'Torre Perla Oriental', h: 320 },
        { id: 'tower', name: 'Torre de Shanghái', h: 330 },
        { id: 'garden', name: 'Jardín Yuyuan', h: 200 },
      ],
      props: ['lantern', 'balloon', 'skylantern'], fireworks: true,
    },
  ];
  const world = (i) => WORLDS[((Number(i) || 0) % WORLDS.length + WORLDS.length) % WORLDS.length];
  const art = (w, file) => '/assets/paint/' + w.id + '/' + file + '.webp';

  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  // The round's sky: { w, h, world (index), id, seed, clouds: [[x, y, r, shape]], lms: [{ id, name, x, y, r, h }],
  // homes }. Clouds are placed on the Fuego half and mirrored onto the Mar half (the same sky for both kingdoms).
  function build(worldIdx, seed) {
    const wi = ((Number(worldIdx) || 0) % WORLDS.length + WORLDS.length) % WORLDS.length;
    const wd = WORLDS[wi];
    const R = rng(seed || 1);
    const lms = wd.lms.map((l, i) => ({ id: l.id, name: l.name, x: SLOTS[i].x, y: SLOTS[i].y, r: LM_R, h: l.h }));
    const half = [];
    const free = (x, y, r) => {
      if (x - r < 24 || x + r > W / 2 - 8 || y - r < 60 || y + r > H - 190) return false;   // (the world's mid strip is the ground)
      if (Math.hypot(x - HOMES.red[0], y - HOMES.red[1]) < r + 120) return false;
      if (lms.some((l) => Math.hypot(x - l.x, y - l.y) < r + l.r + 26)) return false;
      return half.every(([cx, cy, cr]) => Math.hypot(x - cx, y - cy) > r + cr + 22);
    };
    for (let tries = 0; half.length < 28 && tries < 8000; tries++) {
      const r = 32 + Math.floor(R() * 4) * 7;               // 32, 39, 46, 53
      const x = 24 + r + R() * (W / 2 - 32 - 2 * r);
      const y = 60 + r + R() * (H - 250 - 2 * r);
      if (free(x, y, r)) half.push([Math.round(x), Math.round(y), r, Math.floor(R() * 4)]);
    }
    half.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    const clouds = [];
    half.forEach(([x, y, r, s]) => { clouds.push([x, y, r, s]); clouds.push([W - x, y, r, s]); });
    return { w: W, h: H, world: wi, id: wd.id, seed, clouds, lms, homes: { red: HOMES.red.slice(), gold: HOMES.gold.slice() } };
  }
  return { W, H, LM_R, SLOTS, HOMES, WORLDS, world, art, build, rng };
});
