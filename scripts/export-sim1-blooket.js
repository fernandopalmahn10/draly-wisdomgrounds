// ═══════════════════════════════════════════════════════════════════
// 📦 Export HSK1 · Simulación 1 → Blooket-ready CSV + XLSX
//
// Blooket's set-importer at https://www.blooket.com/upload-set accepts
// EITHER .csv or .xlsx using this exact column schema:
//
//   A: Question
//   B: Answer 1
//   C: Answer 2
//   D: Answer 3
//   E: Answer 4
//   F: Time Limit (seconds — Blooket caps at 5/10/15/20/30/45/60/90/120/240)
//   G: Correct Answer(s)   ← "1" / "2" / "3" / "4" (comma-separated for multi)
//
// What we export from Sim 1 (ALL 30 questions):
//
//   • Reading Part 1 (5 V/F)            → 2 options ✅ Sí / ❌ No
//   • Reading Part 2 (5 match)          → 4 options trimmed from A-F
//                                          (Blooket only allows 4 choices)
//   • Listening Part 1 (5 V/F)          → 2 options ✅ Sí / ❌ No
//   • Listening Part 2 (5 three-image)  → text-only fallback "Imagen A/B/C"
//                                          (Blooket can't render images via CSV;
//                                           the audio + 3 images are still on
//                                           Render so teacher can swap them in
//                                           inside Blooket's editor afterwards)
//   • Listening Part 3 (5 gallery)      → text-only fallback
//   • Listening Part 4 (5 MCQ pinyin)   → 3 pinyin options as-is
//
// Usage:  node scripts/export-sim1-blooket.js
// Output: blooket-sim1.csv   AND   blooket-sim1.xlsx (Blooket recommends xlsx)
// ═══════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { SIMULATIONS } = require('../core/hsk-sim.js');

const sim = SIMULATIONS['hsk1-sim1'];
if (!sim) { console.error('Sim 1 not found'); process.exit(1); }

// ────────────────────────────────────────────────────────────────
// Build the rows. Each row is an array matching Blooket's columns.
// ────────────────────────────────────────────────────────────────
const HEADER = ['Question', 'Answer 1', 'Answer 2', 'Answer 3', 'Answer 4', 'Time Limit', 'Correct Answer(s)'];
const rows = [HEADER];

function row(question, opts, correctIdx, time) {
  // Pad opts to 4 entries
  const padded = (opts || []).slice();
  while (padded.length < 4) padded.push('');
  return [question, padded[0], padded[1], padded[2], padded[3], time, correctIdx];
}

// ── LISTENING PART 1 (V/F — audio + image) ──────────────────────
// Blooket CSV can't carry audio; the prompt keeps the question
// number so the teacher can swap audio in via Blooket's editor.
sim.listening.part1.questions.forEach((q) => {
  const correctIdx = q.answer === true ? 1 : 2;
  rows.push(row(
    `L1 · Pregunta ${q.num} — Escucha y mira la imagen. ¿Coinciden?`,
    ['✅ Sí coinciden', '❌ No coinciden'],
    correctIdx,
    20
  ));
});

// ── LISTENING PART 2 (3 images) ─────────────────────────────────
// Image-heavy. Text fallback so Blooket can store the answer key;
// teacher swaps in real images after import.
sim.listening.part2.questions.forEach((q) => {
  const correctLetter = q.answer;
  const opts = q.options.map((o) => `Imagen ${o.letter}`);
  const correctIdx = q.options.findIndex((o) => o.letter === correctLetter) + 1;
  rows.push(row(
    `L2 · Pregunta ${q.num} — Escucha y elige la imagen correcta.`,
    opts,
    correctIdx,
    25
  ));
});

// ── LISTENING PART 3 (gallery match) ────────────────────────────
sim.listening.part3.questions.forEach((q) => {
  // Letters A-F minus the example letter C. Blooket only fits 4.
  // Keep correct + 3 distractors closest in alphabet.
  const correct = q.answer;
  const pool = ['A', 'B', 'C', 'D', 'E', 'F'].filter((l) => l !== correct && l !== sim.listening.part3.exampleAnswer);
  pool.sort((a, b) => Math.abs(a.charCodeAt(0) - correct.charCodeAt(0)) - Math.abs(b.charCodeAt(0) - correct.charCodeAt(0)));
  const four = [correct, ...pool.slice(0, 3)].sort();
  const correctIdx = four.indexOf(correct) + 1;
  rows.push(row(
    `L3 · Pregunta ${q.num} — Escucha y elige la imagen de la galería.`,
    four.map((l) => `Imagen ${l}`),
    correctIdx,
    25
  ));
});

// ── LISTENING PART 4 (3 pinyin options) ─────────────────────────
sim.listening.part4.questions.forEach((q) => {
  const opts = q.options.map((o) => o.text);
  const correctIdx = q.options.findIndex((o) => o.letter === q.answer) + 1;
  rows.push(row(
    `L4 · Pregunta ${q.num} — Escucha y elige la respuesta correcta.`,
    opts,
    correctIdx,
    25
  ));
});

// ── READING PART 1 (V/F on a pinyin word) ───────────────────────
sim.reading.part1.questions.forEach((q) => {
  const correctIdx = q.answer === true ? 1 : 2;
  rows.push(row(
    `R1 · ¿La palabra "${q.word}" coincide con la imagen?`,
    ['✅ Sí coincide', '❌ No coincide'],
    correctIdx,
    20
  ));
});

// ── READING PART 2 (match sentence to image, 4 of 6 letters) ────
sim.reading.part2.questions.forEach((q) => {
  const correct = q.answer;
  const pool = ['A', 'B', 'C', 'D', 'E', 'F'].filter((l) => l !== correct);
  pool.sort((a, b) => Math.abs(a.charCodeAt(0) - correct.charCodeAt(0)) - Math.abs(b.charCodeAt(0) - correct.charCodeAt(0)));
  const four = [correct, ...pool.slice(0, 3)].sort();
  const correctIdx = four.indexOf(correct) + 1;
  rows.push(row(
    `R2 · ${q.pinyin}`,
    four.map((l) => `Imagen ${l}`),
    correctIdx,
    25
  ));
});

// ────────────────────────────────────────────────────────────────
// Write CSV
// ────────────────────────────────────────────────────────────────
function csvEscape(s) {
  const str = String(s == null ? '' : s);
  if (/[",\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}
const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n') + '\n';
const csvPath = path.join(__dirname, '..', 'blooket-sim1.csv');
fs.writeFileSync(csvPath, csv, 'utf8');

// ────────────────────────────────────────────────────────────────
// Write XLSX
// ────────────────────────────────────────────────────────────────
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(rows);
// Reasonable column widths so the file is readable when opened in Excel
ws['!cols'] = [
  { wch: 56 }, // Question
  { wch: 22 }, // Answer 1
  { wch: 22 }, // Answer 2
  { wch: 22 }, // Answer 3
  { wch: 22 }, // Answer 4
  { wch: 12 }, // Time Limit
  { wch: 16 }, // Correct Answer(s)
];
XLSX.utils.book_append_sheet(wb, ws, 'Sim 1 — HSK1');
const xlsxPath = path.join(__dirname, '..', 'blooket-sim1.xlsx');
XLSX.writeFile(wb, xlsxPath);

// ────────────────────────────────────────────────────────────────
// Summary
// ────────────────────────────────────────────────────────────────
console.log('✅ Wrote', csvPath);
console.log('✅ Wrote', xlsxPath);
console.log(`   ${rows.length - 1} questions = 5 L1 + 5 L2 + 5 L3 + 5 L4 + 5 R1 + 5 R2 (full Sim 1)`);
console.log('');
console.log('Upload to Blooket:');
console.log('  1. Go to https://www.blooket.com/upload-set');
console.log('  2. Click "Choose File", pick blooket-sim1.xlsx');
console.log('  3. Name the set "HSK1 · Simulación 1" and click Import');
console.log('  4. Inside Blooket\'s editor: for L1/L2/L3 questions you can');
console.log('     swap "Imagen A/B/C" labels for the actual images by adding');
console.log('     them in the question editor (the answer key stays correct).');
