// Bake a real BLUE (Gold-team) variant of every red-tunic soldier sprite.
// The original spritesheet has red-tunic soldiers riding brown horses.
// CSS hue-rotate(180deg) made the HORSE blue too, which looks broken.
//
// Algorithm: walk every opaque pixel. If it's clearly RED-DOMINANT
// (r > g+25 AND r > b+25 AND r > 90), shift the hue toward blue while
// preserving brightness. The brown horse (where r is close to g and b),
// skin tones (where g and b are also high), and golden armor highlights
// (where g is close to r) all stay untouched.
//
// For each red-dominant pixel:
//   new_b = old_r          (transfer red intensity to the blue channel)
//   new_g = old_g          (green channel unchanged → keeps mid-tones natural)
//   new_r = old_b * 0.85   (dim the red channel)
// This produces a strong saturated blue tunic.

'use strict';
const path = require('path');
const fs = require('fs');
const { Jimp } = require('jimp');

const DIR = path.join(__dirname, '..', 'public', 'assets', 'conquest');

// Source sprites (red-tunic) → output filenames (blue-tunic Gold team)
const PAIRS = [
  ['soldier-idle.png',    'soldier-gold-idle.png'],
  ['soldier-attack.png',  'soldier-gold-attack.png'],
  ['soldier-charge.png',  'soldier-gold-charge.png'],
  ['soldier-defend.png',  'soldier-gold-defend.png'],
  ['soldier-fall.png',    'soldier-gold-fall.png'],
  ['cavalry-idle.png',    'cavalry-gold-idle.png'],
  ['cavalry-attack.png',  'cavalry-gold-attack.png'],
  ['cavalry-charge.png',  'cavalry-gold-charge.png'],
  ['cavalry-fall.png',    'cavalry-gold-fall.png'],
];

function isRedTunic(r, g, b) {
  // Catch the soldier's red tunic (skirt + boots + helmet plume) but NOT
  // the brown horse. Differentiator: red tunic has g/b BOTH very low, while
  // brown horse has b lower than g (b<<g, more orange than red).
  //   - r > 140 — reasonably strong red
  //   - r > g + 60 — well above green
  //   - r > b + 60 — well above blue
  //   - g < 105 — excludes skin tones / golden armor
  //   - |g - b| < 25 — KEY: red tunic has g≈b, brown horse has g > b
  return r > 140 &&
         r > g + 60 && r > b + 60 &&
         g < 105 &&
         Math.abs(g - b) < 25;
}

async function recolor(srcName, dstName) {
  const inPath = path.join(DIR, srcName);
  if (!fs.existsSync(inPath)) {
    console.warn(`[skip] ${srcName} not found`);
    return;
  }
  const img = await Jimp.read(inPath);
  const data = img.bitmap.data;
  let swapped = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;   // skip transparent
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (!isRedTunic(r, g, b)) continue;
    // Channel swap: red → blue
    data[i]     = Math.round(b * 0.85);    // less red
    data[i + 1] = g;                       // green unchanged
    data[i + 2] = r;                       // intensity from red into blue
    swapped++;
  }
  const outPath = path.join(DIR, dstName);
  await img.write(outPath);
  console.log(`✓ ${srcName} → ${dstName}  (${swapped} pixels recolored)`);
}

(async () => {
  for (const [src, dst] of PAIRS) await recolor(src, dst);
})().catch((e) => { console.error(e); process.exit(1); });
