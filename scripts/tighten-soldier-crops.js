// After chroma-keying the checker out, the sprites still have:
//   - A faint label band at the bottom ("IDLE", "ATTACK" text)
//   - A partial neighbor sprite leaking in from the right side
// Crop each PNG tighter to keep only the main figure.

'use strict';
const path = require('path');
const fs = require('fs');
const { Jimp } = require('jimp');

const DIR = path.join(__dirname, '..', 'public', 'assets', 'conquest');
const FILES = fs.readdirSync(DIR).filter((f) => f.endsWith('.png'));

(async () => {
  for (const f of FILES) {
    const p = path.join(DIR, f);
    const img = await Jimp.read(p);
    const w = img.bitmap.width;
    const h = img.bitmap.height;
    // Crop: keep left ~85% width, top ~80% height. Both label band and
    // right-side neighbor sprite get sliced off.
    const newW = Math.round(w * 0.85);
    const newH = Math.round(h * 0.80);
    img.crop({ x: 0, y: 0, w: newW, h: newH });
    await img.write(p);
    console.log(`✓ ${f}: ${w}×${h} → ${newW}×${newH}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
