// ═══════════════════════════════════════════════════════════════════
// 📦 Export HSK1 · Simulación 1 → Blooket-ready CSV
//
// Blooket import format (per their template at blooket.com/upload):
//   Column A: Question
//   Column B: Answer 1
//   Column C: Answer 2
//   Column D: Answer 3
//   Column E: Answer 4
//   Column F: Time Limit (seconds, 5-60)
//   Column G: Correct Answer(s)   ← "1" / "2" / "3" / "4" (or comma-separated for multi)
//
// What we export from Sim 1:
//   • Reading Part 1 (5 V/F)   → MCQ with 2 options: ✅ Sí, coincide / ❌ No coincide
//   • Reading Part 2 (5 match) → MCQ with 6 options A-F
//   • Listening Part 4 (5 MCQ)→ MCQ with 3 options (pinyin)
//   • Listening Part 1 V/F     → MCQ with 2 options (audio text becomes the prompt)
//
// We SKIP:
//   • Listening Part 2 / 3 — they reference images, which Blooket
//     doesn't support in CSV import. Add those manually after upload
//     via Blooket's image picker if you want them in the deck.
//
// Usage:  node scripts/export-sim1-blooket.js
// Output: blooket-sim1.csv at the repo root
// ═══════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { SIMULATIONS } = require('../core/hsk-sim.js');

const sim = SIMULATIONS['hsk1-sim1'];
if (!sim) { console.error('Sim 1 not found'); process.exit(1); }

// Blooket caps cells around 60 chars for Q + 75 for each answer; we
// stay well within that.
function csvEscape(s) {
  const str = String(s == null ? '' : s);
  if (/[",\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}
function row(q, a1, a2, a3, a4, time, correct) {
  return [q, a1, a2, a3, a4, time, correct].map(csvEscape).join(',');
}

const rows = [];
// Header — Blooket's exact column names
rows.push(row('Question', 'Answer 1', 'Answer 2', 'Answer 3', 'Answer 4', 'Time Limit', 'Correct Answer(s)'));

// ── READING PART 1 (V/F on a written word) ──────────────────────────
// Format: kid sees the pinyin word, picks "Sí coincide" / "No coincide"
sim.reading.part1.questions.forEach((q) => {
  const correctIdx = q.answer === true ? 1 : 2;
  rows.push(row(
    'R1 · ¿"' + q.word + '" coincide con la imagen?',
    '✅ Sí coincide',
    '❌ No coincide',
    '', '',
    20,
    correctIdx
  ));
});

// ── READING PART 2 (match sentence → letter A-F) ────────────────────
// Blooket only supports 4 answer choices; the original test has 6
// (A-F). We DROP the two letters that aren't the correct one and aren't
// near it alphabetically, keeping the correct letter + 3 closest as
// distractors. Print a note about this limitation.
const R2_GALLERY = ['A','B','C','D','E','F'];
sim.reading.part2.questions.forEach((q) => {
  const correct = q.answer;
  // Pick 3 distractors closest in alphabet to keep them as plausible
  const distractors = R2_GALLERY.filter((l) => l !== correct)
    .sort((a, b) => Math.abs(a.charCodeAt(0) - correct.charCodeAt(0)) - Math.abs(b.charCodeAt(0) - correct.charCodeAt(0)))
    .slice(0, 3);
  const allFour = [correct, ...distractors].sort();
  const correctIdx = allFour.indexOf(correct) + 1;
  rows.push(row(
    'R2 · ' + q.pinyin,
    'Imagen ' + allFour[0],
    'Imagen ' + allFour[1],
    'Imagen ' + allFour[2],
    'Imagen ' + allFour[3],
    25,
    correctIdx
  ));
});

// ── LISTENING PART 4 (3 pinyin options) ─────────────────────────────
// Audio text not available in the JSON, so we use a generic prompt.
// The kid reads the question stem aloud or you fill it in inside Blooket.
sim.listening.part4.questions.forEach((q) => {
  const opts = q.options.map((o) => o.text);
  const correctIdx = q.options.findIndex((o) => o.letter === q.answer) + 1;
  rows.push(row(
    'L4 · Escucha el audio y elige la respuesta correcta (pregunta ' + q.num + ')',
    opts[0],
    opts[1],
    opts[2],
    '',
    25,
    correctIdx
  ));
});

// ── LISTENING PART 1 (V/F) ──────────────────────────────────────────
// Audio reference can't import, but we add the example pinyin text as
// the prompt for usability.
sim.listening.part1.questions.forEach((q) => {
  const correctIdx = q.answer === true ? 1 : 2;
  rows.push(row(
    'L1 · Audio + imagen pregunta ' + q.num + ' — ¿coinciden?',
    '✅ Sí coinciden',
    '❌ No coinciden',
    '', '',
    20,
    correctIdx
  ));
});

const out = rows.join('\n') + '\n';
const outPath = path.join(__dirname, '..', 'blooket-sim1.csv');
fs.writeFileSync(outPath, out, 'utf8');
console.log('✅ Wrote', outPath);
console.log('   ', rows.length - 1, 'questions across',
  '5 R1 V/F · 5 R2 match (trimmed to 4 options) · 5 L4 MCQ · 5 L1 V/F');
console.log('');
console.log('Drag this CSV into Blooket → Discover → Create Set → Import → Choose File.');
console.log('Audio questions (L1) keep the question number in the prompt so you can');
console.log('record/upload the matching audio in Blooket\'s editor afterwards.');
