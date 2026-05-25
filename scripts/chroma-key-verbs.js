// One-shot: chroma-key the white backgrounds out of qu.png / lai.png /
// hui.png so they no longer look like white rectangles when placed on the
// dark mission card. Uses flood-fill from the four corners so only the
// connected background pixels become transparent — never eats white
// pixels that are part of the character.
const path = require('path');
const fs = require('fs');

(async () => {
  const jimpMod = require('jimp');
  const Jimp = jimpMod.Jimp || jimpMod.default || jimpMod;
  const files = ['qu.png', 'lai.png', 'hui.png'].map((f) =>
    path.join(__dirname, '..', 'public', 'assets', f)
  );

  // A pixel is "background-white" if R/G/B are all this high AND it's
  // currently opaque. 230 is generous enough to catch off-white shading
  // around the edge of scanned/AI-generated PNGs without eating ivory
  // highlights inside the character body.
  const THRESHOLD = 228;

  for (const file of files) {
    if (!fs.existsSync(file)) {
      console.log('SKIP (missing):', file);
      continue;
    }
    const img = await Jimp.read(file);
    const { width, height, data } = img.bitmap;
    const visited = new Uint8Array(width * height);

    function isWhite(x, y) {
      const idx = (y * width + x) * 4;
      return (
        data[idx]     >= THRESHOLD &&
        data[idx + 1] >= THRESHOLD &&
        data[idx + 2] >= THRESHOLD &&
        data[idx + 3] > 0
      );
    }

    const stack = [];
    // Seed from all four corners so we cover backgrounds even if the
    // character touches one of them.
    for (const [sx, sy] of [
      [0, 0],
      [width - 1, 0],
      [0, height - 1],
      [width - 1, height - 1],
    ]) {
      stack.push([sx, sy]);
    }

    while (stack.length) {
      const [x, y] = stack.pop();
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const i = y * width + x;
      if (visited[i]) continue;
      visited[i] = 1;
      if (!isWhite(x, y)) continue;
      data[i * 4 + 3] = 0;
      // 4-neighbour flood
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    // Soft-feather pass: any pixel STILL opaque but adjacent to a now-
    // transparent pixel AND mostly-white → reduce alpha. Kills the white
    // halo line that flood-fill leaves around the character outline.
    const featherCopy = new Uint8Array(data);
    const FEATHER_THRESHOLD = 200;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = (y * width + x) * 4;
        if (data[i + 3] === 0) continue;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (r < FEATHER_THRESHOLD && g < FEATHER_THRESHOLD && b < FEATHER_THRESHOLD) continue;
        // Check 4-neighbours in original copy
        const neighbours = [
          ((y - 1) * width + x) * 4 + 3,
          ((y + 1) * width + x) * 4 + 3,
          (y * width + x - 1) * 4 + 3,
          (y * width + x + 1) * 4 + 3,
        ];
        const touchesTransparent = neighbours.some((ni) => featherCopy[ni] === 0);
        if (touchesTransparent) {
          // Scale alpha proportionally to how white the pixel is
          const whiteness = (r + g + b) / 3;
          const fade = Math.max(0, 1 - Math.max(0, whiteness - 200) / 55);
          data[i + 3] = Math.round(data[i + 3] * fade);
        }
      }
    }

    await img.write(file);
    console.log('chroma-keyed', path.basename(file), `${width}x${height}`);
  }
  console.log('done');
})();
