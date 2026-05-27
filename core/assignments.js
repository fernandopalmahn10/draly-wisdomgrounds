// =========================================================================
// assignments.js — Homework portal data + grading
// =========================================================================
//
//  ╔══════════════════════════════════════════════════════════════════════╗
//  ║                                                                      ║
//  ║   👇 EDIT THE HOMEWORK QUESTIONS HERE 👇                             ║
//  ║                                                                      ║
//  ║   Every assignment lives in the ASSIGNMENTS array below.             ║
//  ║   Each entry has:                                                    ║
//  ║      id            — short slug used in URLs (lowercase, no spaces)  ║
//  ║      title         — heading on the kid's card (emoji OK)            ║
//  ║      subtitle      — one-line description below the title            ║
//  ║      instructions  — help text on the assignment screen              ║
//  ║      items         — the actual questions (es + expected pinyin)     ║
//  ║      pointsPerItem — usually 100 / items.length (total = 100)        ║
//  ║      parentInsight — bullets shown to parents when score ≥ 60%       ║
//  ║                                                                      ║
//  ║   TO EDIT A QUESTION → find the item and rewrite es + expected.      ║
//  ║   TO ADD A QUESTION  → append { es: '…', expected: '…' } to items    ║
//  ║                        and update pointsPerItem so total stays ~100. ║
//  ║   TO REMOVE          → delete the line, bump pointsPerItem back up.  ║
//  ║   TO ADD A NEW TAREA → copy the whole { id, title, … } block, give   ║
//  ║                        it a unique id, and edit.                     ║
//  ║                                                                      ║
//  ║   ⚠️  CATALOG RULE: every word in `expected` MUST exist in           ║
//  ║      public/js/warmup-vocab.js — otherwise kids can't build it       ║
//  ║      from the word chips. To check: ctrl-F that file for the pinyin. ║
//  ║                                                                      ║
//  ║   Tone marks in `expected` are optional. Grading strips them.        ║
//  ║   So "wǒ" and "wo" and "WO" are all equivalent.                      ║
//  ║                                                                      ║
//  ╚══════════════════════════════════════════════════════════════════════╝
//
// HOW GRADING WORKS
// =========================================================================
// normalize(s) lowercases the answer, strips tone marks (NFD + remove
// combining diacritics), removes punctuation, collapses whitespace.
// So all of these compare equal:
//     "Wǒ jiào Sofia."  ==  "wo jiao sofia"  ==  "wǒ jiào sofía"
// Then student-normalized is compared to expected-normalized as strings.
// All-or-nothing per item: kid gets `pointsPerItem` if matched, 0 else.
//
// HOW TO CHANGE ACCESS CODES
// =========================================================================
// Edit ACCESS_CODES below. The teacher gives one to her students; anyone
// with any of the 5 codes can enter. Numeric so kids can type them on a
// phone numeric keypad.
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
    instructions: 'Lee la oración en español. Construye la oración en pinyin tocando las palabras del catálogo. 🗣️ DI CADA ORACIÓN EN VOZ ALTA antes de entregar — hablar es la mejor forma de aprender.',
    type: 'sentence-building',
    items: [
      // All expected answers use ONLY words present in the warmup catalog
      // (warmup-vocab.js) so kids can build them from the available chips.
      { es: 'Hola, mucho gusto.',           expected: 'nǐ hǎo' },
      { es: 'Tengo 8 años.',                expected: 'wǒ bā suì' },
      { es: 'Mi mamá es maestra.',          expected: 'wǒ māma shì lǎoshī' },
      { es: 'Tengo un hijo.',               expected: 'wǒ yǒu yī gè érzi' },
      { es: 'Amo a mi familia.',            expected: 'wǒ ài wǒ de jiā' },
    ],
    pointsPerItem: 20,
    // Parent-facing summary in Spanish — surfaced on the parent view of
    // the homework portal when this assignment is completed (score≥60).
    parentInsight: {
      title: 'Tu hijo/a sabe saludar y hablar de su familia en chino',
      bullets: [
        'Saludar: "Nǐ hǎo" (Hola)',
        'Decir su edad: "Wǒ bā suì" (Tengo 8 años)',
        'Hablar de su mamá: "Wǒ māma shì lǎoshī"',
        'Decir que tiene un hijo o un familiar (wǒ yǒu yī gè …)',
        'Expresar amor por su familia: "Wǒ ài wǒ de jiā"',
      ],
      encouragement: '¡Pídele que te salude en chino y te diga cuántos años tiene! Verás que ya lo sabe.',
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
