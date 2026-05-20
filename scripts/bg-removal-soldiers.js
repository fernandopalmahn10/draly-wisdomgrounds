// Strip the gray/white CHECKER background from every sliced soldier sprite.
// The original spritesheet was exported with a "transparency-checker" visual
// pattern baked into actual pixels (not real alpha), so straight cropping
// leaves a gray/white squares behind the figure.
//
// Algorithm (same as bg-removal-67 but tuned for grayscale checker):
//   1. Seed a BFS queue with every edge pixel.
//   2. A pixel is "checker" if it's achromatic AND light enough:
//      r,g,b all > 125 AND channels within 18 of each other.
//   3. Flood-fill — only edge-connected pixels matching the test flip to alpha=0.
//      Important: NEVER walk through saturated pixels, so any white pixels
//      INSIDE the soldier (eye highlights, armor) stay opaque.
//   4. Feather a 1-pixel halo so the cutout isn't pixel-sharp.
//
// Output: overwrites each sliced PNG in /assets/conquest/ in place.

'use strict';
const path = require('path');
const fs = require('fs');
const { Jimp } = require('jimp');

const DIR = path.join(__dirname, '..', 'public', 'assets', 'conquest');
const FILES = fs.readdirSync(DIR).filter((f) => f.endsWith('.png'));

const CHANNEL_TOL = 18;     // max spread between r/g/b to count as achromatic
const LIGHT_THRESHOLD = 125; // all three channels must be at least this bright

function isChecker(d, i) {
  const r = d[i], g = d[i + 1], b = d[i + 2];
  if (r < LIGHT_THRESHOLD || g < LIGHT_THRESHOLD || b < LIGHT_THRESHOLD) return false;
  return (Math.abs(r - g) <= CHANNEL_TOL &&
          Math.abs(g - b) <= CHANNEL_TOL &&
          Math.abs(r - b) <= CHANNEL_TOL);
}

async function processOne(filename) {
  const inPath = path.join(DIR, filename);
  const img = await Jimp.read(inPath);
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  const data = img.bitmap.data;
  const visited = new Uint8Array(w * h);
  const queue = [];
  // Seed all edge pixels
  for (let x = 0; x < w; x++) { queue.push([x, 0]); queue.push([x, h - 1]); }
  for (let y = 0; y < h; y++) { queue.push([0, y]); queue.push([w - 1, y]); }
  let cleared = 0;
  while (queue.length) {
    const [x, y] = queue.pop();
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const p = y * w + x;
    if (visited[p]) continue;
    const i = p * 4;
    if (!isChecker(data, i)) continue;
    visited[p] = 1;
    data[i + 3] = 0;
    cleared++;
    queue.push([x + 1, y]); queue.push([x - 1, y]);
    queue.push([x, y + 1]); queue.push([x, y - 1]);
  }
  // Edge feather — soften the alpha boundary 1 pixel deep
  const feather = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] !== 0) continue;
      let opaqueN = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const ni = ((y + dy) * w + (x + dx)) * 4;
          if (data[ni + 3] === 255) opaqueN++;
        }
      }
      if (opaqueN > 0) feather.push([i, Math.min(120, opaqueN * 24)]);
    }
  }
  feather.forEach(([i, a]) => { data[i + 3] = a; });
  await img.write(inPath);
  console.log(`✓ ${filename}: cleared ${cleared}, feathered ${feather.length}`);
}

(async () => {
  console.log(`[soldier bg-removal] Processing ${FILES.length} sprites in ${DIR}`);
  for (const f of FILES) await processOne(f);
  console.log('[soldier bg-removal] DONE');
})().catch((e) => { console.error(e); process.exit(1); });
