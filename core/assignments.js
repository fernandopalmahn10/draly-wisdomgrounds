// =========================================================================
// assignments.js — Homework portal data + grading
//
// Async, no-PIN-needed homework. Students enter an access code (5 valid
// codes — teacher hands them out to her class) plus their student code
// (the same 4-char code the warmup mode generates), and gets a list of
// assignments to complete on their own time.
//
// Submissions auto-graded by normalizing pinyin (lowercase, strip tone
// marks, strip punctuation) and comparing to teacher's expected answer.
//
// HOW TO ADD A NEW ASSIGNMENT
// =========================================================================
// 1. Add an entry to ASSIGNMENTS below.
// 2. Pick a short `id` (lowercase, no spaces).
// 3. type currently only supports 'sentence-building' (student builds
//    pinyin sentences with word chips, compared to expected pinyin).
// 4. items: array of { es: 'Spanish prompt', expected: 'pinyin answer' }.
//    Tone marks in `expected` are optional — grading strips them anyway.
// 5. pointsPerItem: usually 100 / items.length so the assignment totals 100.
//
// HOW TO CHANGE ACCESS CODES
// =========================================================================
// Edit ACCESS_CODES below. The teacher gives one to her students; anyone
// with any of the 5 codes can enter. Codes are case-insensitive.
// =========================================================================
'use strict';

// Access codes — any of these grants entry to the homework portal.
// Numeric 4-digit codes (changed 2026-05-26) so the input can use the
// same numeric keypad UX as the live-game PIN field — easier for kids
// who can't comfortably type letters on phone keyboards.
//
// Teacher hands these out (e.g. one per class section, or just one).
// Easy-to-remember sequences so kids can recall them without writing
// them down. Change here to rotate (e.g. start of new school year).
const ACCESS_CODES = ['1001', '2002', '3003', '4004', '5005'];

const ASSIGNMENTS = [
  // === ASSIGNMENT 1 ===
  {
    id: 'familia-introduce',
    title: '👨‍👩‍👧 Mi familia',
    subtitle: '5 oraciones para presentar a tu familia',
    instructions: 'Lee la oración en español. Construye la oración en pinyin tocando las palabras del catálogo. Cuando termines las 5 oraciones, presiona Entregar.',
    type: 'sentence-building',
    items: [
      { es: 'Me llamo Xiǎo Míng.',          expected: 'wǒ jiào xiǎo míng' },
      { es: 'Tengo 8 años.',                expected: 'wǒ bā suì' },
      { es: 'Mi mamá es maestra.',          expected: 'wǒ māma shì lǎoshī' },
      { es: 'Tengo un hermano.',            expected: 'wǒ yǒu yī gè gēge' },
      { es: 'Amo a mi familia.',            expected: 'wǒ ài wǒ de jiā' },
    ],
    pointsPerItem: 20,
    // Parent-facing summary in Spanish — surfaced on the parent view of
    // the homework portal when this assignment is completed (score≥60).
    parentInsight: {
      title: 'Tu hijo/a sabe presentarse y hablar de su familia en chino',
      bullets: [
        'Decir su nombre en chino: "Wǒ jiào …" (Me llamo …)',
        'Decir su edad: "Wǒ bā suì" (Tengo 8 años)',
        'Hablar de su mamá, papá y hermanos en chino',
        'Expresar amor por su familia: "Wǒ ài wǒ de jiā"',
      ],
      encouragement: '¡Pídele que te diga cómo se llama y cuántos años tiene en chino! Verás que ya lo sabe.',
    },
  },
  // Add more here. See instructions at the top of this file.
];

// === Normalization for grading ===
// Both student answer and expected answer go through normalize(). Strips
// tone marks, lowercases, removes punctuation, collapses whitespace. So
// "Wǒ jiào Sofia." == "wo jiao sofia" == "wǒ jiào sofía" — all equivalent.
function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')                       // decompose tone marks
    .replace(/[̀-ͯ]/g, '')        // strip combining diacritics
    .replace(/[.,!?;:'"()¿¡]/g, '')         // strip punctuation
    .replace(/\s+/g, ' ')                   // collapse whitespace
    .trim();
}

function isAccessCodeValid(code) {
  return ACCESS_CODES.includes(String(code || '').trim().toUpperCase());
}

function listAssignments() {
  return ASSIGNMENTS.map((a) => ({
    id: a.id,
    title: a.title,
    subtitle: a.subtitle,
    itemCount: a.items.length,
    pointsPerItem: a.pointsPerItem,
    totalPoints: a.items.length * a.pointsPerItem,
  }));
}

function getAssignment(id) {
  return ASSIGNMENTS.find((a) => a.id === id) || null;
}

// Grade a submission. answers is array of strings (student's pinyin
// for each item). Returns { score, total, breakdown[] }.
function gradeSubmission(assignment, answers) {
  if (!assignment) return null;
  if (!Array.isArray(answers)) answers = [];
  let score = 0;
  const breakdown = assignment.items.map((item, i) => {
    const studentRaw = String(answers[i] || '');
    const studentNorm = normalize(studentRaw);
    const expectedNorm = normalize(item.expected);
    const correct = studentNorm.length > 0 && studentNorm === expectedNorm;
    if (correct) score += assignment.pointsPerItem;
    return {
      i,
      es: item.es,
      expected: item.expected,
      student: studentRaw,
      correct,
      pointsEarned: correct ? assignment.pointsPerItem : 0,
    };
  });
  const total = assignment.items.length * assignment.pointsPerItem;
  return { score, total, breakdown };
}

module.exports = {
  ACCESS_CODES,
  ASSIGNMENTS,
  isAccessCodeValid,
  listAssignments,
  getAssignment,
  gradeSubmission,
  normalize,
};
