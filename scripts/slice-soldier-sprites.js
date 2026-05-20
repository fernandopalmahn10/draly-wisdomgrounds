// Slice the soldier spritesheet into individual sprites we can drop onto
// the conquest board via CSS background-image. The sheet is 2048×2048 with
// 8 columns and (counting) 9 rows of different unit types.
//
//   Row layout (from top):
//     0-2: foot soldier — col 0=IDLE, 1=IDLE2, 2=ATTACK, 3=ATTACK2,
//          4=CHARGE, 5=DEFEND, 6=FALL, 7=FALL2
//     3-5: horses (3 colors)
//     6-8: mounted cavalry
//
// Cells are NOT uniformly tall (foot rows shorter than cavalry rows). We
// crop empirically based on visual inspection: each "row group" has a
// different height ratio.
//
// Output sprites we actually need (4 total):
//   soldier-idle.png    — foot IDLE for the Red Army
//   soldier-attack.png  — foot ATTACK for the Red Army
//   soldier-fall.png    — fallen / defeated
//   cavalry-idle.png    — mounted cavalry IDLE for the Gold Army

'use strict';
const path = require('path');
const { Jimp } = require('jimp');

const IN_PATH = path.join(__dirname, '..', 'public', 'assets', 'soldier spritesheet.png');
const OUT_DIR = path.join(__dirname, '..', 'public', 'assets', 'conquest');

const fs = require('fs');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Treating the sheet as a clean 8x8 grid of 256×256 cells. The visible
// row order:
//   Row 0: foot IDLE / ATTACK / CHARGE / DEFEND / FALL (with text labels on top)
//   Rows 1-2: more foot soldier poses
//   Rows 3-4: horses (different colors)
//   Rows 5-7: mounted cavalry
//
// For foot sprites we shift y by +40 to skip the "IDLE/ATTACK/..." text labels.
const CELL = 256;
const CROPS = [
  // Foot soldier — Red Army. Skip the +40px text label band at the top.
  ['soldier-idle.png',    CELL * 0, 40,            CELL, CELL - 40],
  ['soldier-attack.png',  CELL * 2, 40,            CELL, CELL - 40],
  ['soldier-charge.png',  CELL * 4, 40,            CELL, CELL - 40],
  ['soldier-defend.png',  CELL * 6, 40,            CELL, CELL - 40],
  ['soldier-fall.png',    CELL * 6, 40,            CELL, CELL - 40],

  // Mounted cavalry — Gold/Blue Army. Cavalry rows start at y = CELL * 6.
  ['cavalry-idle.png',    CELL * 0, CELL * 6,      CELL, CELL],
  ['cavalry-attack.png',  CELL * 2, CELL * 6,      CELL, CELL],
  ['cavalry-charge.png',  CELL * 4, CELL * 6,      CELL, CELL],
  ['cavalry-fall.png',    CELL * 6, CELL * 6,      CELL, CELL],

  // Standalone horse — for ambient decoration
  ['horse-brown.png',     CELL * 0, CELL * 3,      CELL, CELL],
];

(async () => {
  console.log('[slice] Loading', IN_PATH);
  const sheet = await Jimp.read(IN_PATH);
  for (const [name, x, y, w, h] of CROPS) {
    const tile = sheet.clone();
    tile.crop({ x, y, w, h });
    const outPath = path.join(OUT_DIR, name);
    await tile.write(outPath);
    console.log(`✓ ${name}  [${w}×${h} at (${x},${y})]`);
  }
})().catch((e) => {
  console.error('[slice] FAILED:', e);
  process.exit(1);
});
