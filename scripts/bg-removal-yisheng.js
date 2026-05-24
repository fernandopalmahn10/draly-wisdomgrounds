// Background-removal for the doctor (yisheng.png) — strips the white-ish
// background so the character is a clean cutout, not a rectangle with a
// white box behind him. Edge-seeded flood fill targets white pixels and
// stops at the doctor's outline.
//
// Run with: node scripts/bg-removal-yisheng.js

'use strict';
const path = require('path');
const { Jimp } = require('jimp');

const IN_PATH  = path.join(__dirname, '..', 'public', 'assets', 'yisheng.png');
const OUT_PATH = path.join(__dirname, '..', 'public', 'assets', 'yisheng.png'); // overwrite

const TOLERANCE = 40;
const EDGE_FEATHER = 1;

(async () => {
  console.log('[bg-removal] Loading', IN_PATH);
  const img = await Jimp.read(IN_PATH);
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  const data = img.bitmap.data;

  // Sample background color from the 4 corners; for a doctor PNG this should
  // be white-ish (probably pure white from a generated image).
  const corners = [
    [0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1],
  ];
  const rs = [], gs = [], bs = [];
  corners.forEach(([x, y]) => {
    const i = (y * w + x) * 4;
    rs.push(data[i]); gs.push(data[i + 1]); bs.push(data[i + 2]);
  });
  rs.sort((a, b) => a - b); gs.sort((a, b) => a - b); bs.sort((a, b) => a - b);
  const bgR = rs[2], bgG = gs[2], bgB = bs[2];
  console.log(`[bg-removal] Background sampled as rgb(${bgR}, ${bgG}, ${bgB})`);

  function near(idx) {
    const dr = data[idx] - bgR;
    const dg = data[idx + 1] - bgG;
    const db = data[idx + 2] - bgB;
    return (dr * dr + dg * dg + db * db) < TOLERANCE * TOLERANCE * 3;
  }

  // Mark pixels as background via edge-seeded flood-fill (BFS with a queue).
  const isBg = new Uint8Array(w * h);
  const queue = [];

  // Seed: every edge pixel that LOOKS like background
  for (let x = 0; x < w; x++) {
    for (const y of [0, h - 1]) {
      const i = (y * w + x) * 4;
      if (near(i)) { isBg[y * w + x] = 1; queue.push([x, y]); }
    }
  }
  for (let y = 0; y < h; y++) {
    for (const x of [0, w - 1]) {
      const i = (y * w + x) * 4;
      if (near(i)) { isBg[y * w + x] = 1; queue.push([x, y]); }
    }
  }

  // BFS — flood inward
  while (queue.length) {
    const [x, y] = queue.shift();
    [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].forEach(([nx, ny]) => {
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) return;
      const ni = ny * w + nx;
      if (isBg[ni]) return;
      const di = ni * 4;
      if (near(di)) {
        isBg[ni] = 1;
        queue.push([nx, ny]);
      }
    });
  }

  // Apply: alpha = 0 for background, plus a 1-px feather for soft edges.
  // Feather: any non-bg pixel adjacent to a bg pixel gets alpha halved.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const di = idx * 4;
      if (isBg[idx]) {
        data[di + 3] = 0;
      } else if (EDGE_FEATHER > 0) {
        let edge = false;
        for (let dy = -EDGE_FEATHER; dy <= EDGE_FEATHER && !edge; dy++) {
          for (let dx = -EDGE_FEATHER; dx <= EDGE_FEATHER && !edge; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            if (isBg[ny * w + nx]) edge = true;
          }
        }
        if (edge) data[di + 3] = Math.round(data[di + 3] * 0.6);
      }
    }
  }

  console.log('[bg-removal] Writing', OUT_PATH);
  await img.write(OUT_PATH);
  console.log('[bg-removal] Done.');
})().catch((e) => { console.error(e); process.exit(1); });
