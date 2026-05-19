// Background-removal helper for the 6-7 character PNG.
// The original 67.png has a solid light-blue background (around the user's
// screenshot color #e8f4fa / #dbecf6). We do an edge-seeded flood-fill that
// turns the background to transparent while preserving the central blocky
// character (and his foreground numbers / hands).
//
// Algorithm:
//   1. Detect background color by sampling the 4 corners.
//   2. Flood-fill from every edge pixel inward, marking anything within
//      tolerance of the background color as transparent.
//   3. The fill stops at the character's outline because the character is
//      darker/saturated blue (well outside tolerance from the light bg).
//   4. Apply a 1-pixel feather along the alpha edge so the cutout doesn't
//      look jagged.
//
// Run with: node scripts/bg-removal-67.js

'use strict';
const path = require('path');
const { Jimp } = require('jimp');

const IN_PATH  = path.join(__dirname, '..', 'public', 'assets', '67.png');
const OUT_PATH = path.join(__dirname, '..', 'public', 'assets', '67-transparent.png');

const TOLERANCE = 38;     // how close to the background color counts as "background"
const EDGE_FEATHER = 1;   // pixels of soft falloff at the alpha edge

(async () => {
  console.log('[bg-removal] Loading', IN_PATH);
  const img = await Jimp.read(IN_PATH);
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  const data = img.bitmap.data;

  // Sample background color from the 4 corners + take median per channel
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
    return Math.sqrt(dr*dr + dg*dg + db*db) <= TOLERANCE;
  }

  // BFS flood-fill from all edge pixels. Visited array tracks which pixels
  // have been classified as background (alpha=0).
  const visited = new Uint8Array(w * h);
  const queue = [];
  function enqueueEdges() {
    for (let x = 0; x < w; x++) {
      queue.push([x, 0]);
      queue.push([x, h - 1]);
    }
    for (let y = 0; y < h; y++) {
      queue.push([0, y]);
      queue.push([w - 1, y]);
    }
  }
  enqueueEdges();

  let cleared = 0;
  while (queue.length) {
    const [x, y] = queue.pop();
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const p = y * w + x;
    if (visited[p]) continue;
    const i = p * 4;
    if (!near(i)) continue;
    visited[p] = 1;
    data[i + 3] = 0;  // alpha → 0
    cleared++;
    queue.push([x + 1, y]);
    queue.push([x - 1, y]);
    queue.push([x, y + 1]);
    queue.push([x, y - 1]);
  }
  console.log(`[bg-removal] Cleared ${cleared} background pixels`);

  // Feather: soften the edge where the alpha just transitioned from 255 → 0.
  // Look at every transparent pixel; if any 8-neighbor is opaque, set the
  // alpha to ~half so the silhouette isn't pixel-sharp.
  if (EDGE_FEATHER > 0) {
    const featherPixels = [];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) * 4;
        if (data[i + 3] !== 0) continue;
        // Check neighbors
        let opaqueNeighbors = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const ni = ((y + dy) * w + (x + dx)) * 4;
            if (data[ni + 3] === 255) opaqueNeighbors++;
          }
        }
        if (opaqueNeighbors > 0) {
          featherPixels.push([i, Math.min(128, opaqueNeighbors * 28)]);
        }
      }
    }
    featherPixels.forEach(([i, a]) => { data[i + 3] = a; });
    console.log(`[bg-removal] Feathered ${featherPixels.length} edge pixels`);
  }

  await img.write(OUT_PATH);
  console.log('[bg-removal] Wrote', OUT_PATH);
})().catch((e) => {
  console.error('[bg-removal] FAILED:', e);
  process.exit(1);
});
