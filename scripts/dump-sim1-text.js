// ═══════════════════════════════════════════════════════════════════
// 📄 Dump HSK1 · Simulación 1 → human-readable plain text
//
// All 30 questions in the order they appear on the exam, with the
// correct answer marked ✓ for each. Use this to set up Blooket /
// Kahoot / Quizlet / paper print-out by hand.
//
// Usage:  node scripts/dump-sim1-text.js
// Output: sim1-questions.txt at the repo root
// ═══════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { SIMULATIONS } = require('../core/hsk-sim.js');

const sim = SIMULATIONS['hsk1-sim1'];
if (!sim) { console.error('Sim 1 not found'); process.exit(1); }

const lines = [];
const W = '═══════════════════════════════════════════════════════════════════';
const w = '───────────────────────────────────────────────────────────────────';

function header(t) { lines.push('', W, t, W, ''); }
function subhead(t) { lines.push('', w, t, w, ''); }
function txt(t) { lines.push(t); }

txt(W);
txt('  HSK1 · SIMULACIÓN 1 — Lista completa de preguntas');
txt('  ' + sim.totalQuestions + ' preguntas total · ' + sim.pointsPerQuestion + ' pts c/u · máx ' +
    (sim.totalQuestions * sim.pointsPerQuestion) + ' pts');
txt(W);

// ── LISTENING PART 1 (V/F) ──
header('LISTENING · PARTE 1 — Verdadero / Falso');
txt('Instrucción: ' + sim.listening.part1.instruction);
txt('');
txt('EJEMPLOS:');
sim.listening.part1.examples.forEach((ex) => {
  txt(`  ${ex.num}: ${ex.audioText ? '"' + ex.audioText + '"' : '(audio)'} — Respuesta: ${ex.answer ? '✓ VERDADERO' : '✗ FALSO'}`);
  if (ex.caption) txt(`       (${ex.caption})`);
});
txt('');
txt('PREGUNTAS:');
sim.listening.part1.questions.forEach((q) => {
  txt(`  ${q.num}. (audio MP3 + imagen) — Respuesta: ${q.answer ? '✓ VERDADERO' : '✗ FALSO'}`);
  if (q.audioText) txt(`     Audio dice: "${q.audioText}"`);
});

// ── LISTENING PART 2 (3 images) ──
header('LISTENING · PARTE 2 — Tres imágenes');
txt('Instrucción: ' + sim.listening.part2.instruction);
txt('');
txt('PREGUNTAS:');
sim.listening.part2.questions.forEach((q) => {
  txt(`  ${q.num}. (audio MP3)`);
  if (q.audioText) txt(`     Audio dice: "${q.audioText}"`);
  q.options.forEach((o) => {
    const mark = o.letter === q.answer ? ' ✓' : '';
    txt(`     ${o.letter}) Imagen ${o.letter}${mark}`);
  });
  txt(`     Respuesta correcta: ${q.answer}`);
  txt('');
});

// ── LISTENING PART 3 (gallery match) ──
header('LISTENING · PARTE 3 — Empareja con la imagen de la galería');
txt('Instrucción: ' + sim.listening.part3.instruction);
txt('');
txt('GALERÍA (las mismas 6 imágenes para todas las preguntas):');
sim.listening.part3.gallery.forEach((g) => {
  txt(`  ${g.letter}) ${g.label}`);
});
txt(`  Respuesta del EJEMPLO: ${sim.listening.part3.exampleAnswer}`);
txt('');
txt('PREGUNTAS:');
sim.listening.part3.questions.forEach((q) => {
  txt(`  ${q.num}. (audio MP3) — Respuesta correcta: ${q.answer}`);
  if (q.audioText) txt(`     Audio dice: "${q.audioText}"`);
});

// ── LISTENING PART 4 (3 pinyin options) ──
header('LISTENING · PARTE 4 — Tres opciones de texto');
txt('Instrucción: ' + sim.listening.part4.instruction);
txt('');
if (sim.listening.part4.example) {
  txt('EJEMPLO:');
  txt(`  ${sim.listening.part4.example.num}: (audio)`);
  if (sim.listening.part4.example.audioText) txt(`     Audio dice: "${sim.listening.part4.example.audioText}"`);
  sim.listening.part4.example.options.forEach((o) => {
    const mark = o.letter === sim.listening.part4.example.answer ? ' ✓' : '';
    txt(`     ${o.letter}) ${o.text}${mark}`);
  });
  txt('');
}
txt('PREGUNTAS:');
sim.listening.part4.questions.forEach((q) => {
  txt(`  ${q.num}. (audio MP3)`);
  if (q.audioText) txt(`     Audio dice: "${q.audioText}"`);
  q.options.forEach((o) => {
    const mark = o.letter === q.answer ? ' ✓' : '';
    txt(`     ${o.letter}) ${o.text}${mark}`);
  });
  txt(`     Respuesta correcta: ${q.answer}`);
  txt('');
});

// ── READING PART 1 (V/F on a word) ──
header('READING · PARTE 1 — Palabra ↔ Imagen ✓/✗');
txt('Instrucción: ' + sim.reading.part1.instruction);
txt('');
if (sim.reading.part1.example) {
  const ex = sim.reading.part1.example;
  txt(`EJEMPLO ${ex.num}: "${ex.word}" — Respuesta: ${ex.answer ? '✓ VERDADERO' : '✗ FALSO'}`);
  txt('');
}
txt('PREGUNTAS:');
sim.reading.part1.questions.forEach((q) => {
  txt(`  ${q.num}. Palabra: "${q.word}" — Respuesta: ${q.answer ? '✓ VERDADERO' : '✗ FALSO'}`);
});

// ── READING PART 2 (sentence → image) ──
header('READING · PARTE 2 — Empareja oración con imagen');
txt('Instrucción: ' + sim.reading.part2.instruction);
txt('');
txt('GALERÍA (las mismas 6 imágenes para todas las preguntas):');
sim.reading.part2.gallery.forEach((g) => {
  txt(`  ${g.letter}) ${g.label}`);
});
txt('');
if (sim.reading.part2.example) {
  const ex = sim.reading.part2.example;
  txt(`EJEMPLO ${ex.num}:`);
  txt(`  Hanzi:  ${ex.hanzi}`);
  txt(`  Pinyin: ${ex.pinyin}`);
  txt(`  Respuesta: ${ex.answer}`);
  txt('');
}
txt('PREGUNTAS:');
sim.reading.part2.questions.forEach((q) => {
  txt(`  ${q.num}.`);
  txt(`     Hanzi:  ${q.hanzi}`);
  txt(`     Pinyin: ${q.pinyin}`);
  txt(`     Respuesta correcta: ${q.answer}`);
  txt('');
});

// ── ANSWER KEY SUMMARY ──
header('CLAVE DE RESPUESTAS — Resumen');
txt('Sección              Pregunta  Respuesta');
txt(w);
sim.listening.part1.questions.forEach((q) => txt('L1 (V/F)             ' + String(q.num).padEnd(10) + (q.answer ? 'VERDADERO' : 'FALSO')));
sim.listening.part2.questions.forEach((q) => txt('L2 (3 imágenes)      ' + String(q.num).padEnd(10) + q.answer));
sim.listening.part3.questions.forEach((q) => txt('L3 (galería)         ' + String(q.num).padEnd(10) + q.answer));
sim.listening.part4.questions.forEach((q) => txt('L4 (3 opciones)      ' + String(q.num).padEnd(10) + q.answer + ' = ' + q.options.find((o) => o.letter === q.answer).text));
sim.reading.part1.questions.forEach((q) => txt('R1 (palabra V/F)     ' + String(q.num).padEnd(10) + '"' + q.word + '" = ' + (q.answer ? 'VERDADERO' : 'FALSO')));
sim.reading.part2.questions.forEach((q) => txt('R2 (oración→imagen)  ' + String(q.num).padEnd(10) + q.answer));
txt('');
txt(W);
txt('  FIN — HSK1 · Simulación 1');
txt(W);

const out = lines.join('\n') + '\n';
const outPath = path.join(__dirname, '..', 'sim1-questions.txt');
fs.writeFileSync(outPath, out, 'utf8');
console.log('✅ Wrote', outPath);
console.log('   ' + sim.totalQuestions + ' questions, full answer key included');
