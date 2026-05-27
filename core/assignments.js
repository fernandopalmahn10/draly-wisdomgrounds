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
    title: '👨‍👩‍👧 EXP1 · Mi familia',
    subtitle: '5 oraciones · solo palabras de Experience 1 (Yo / Familia)',
    expLabel: 'exp1',  // surfaced in UI so kids/parents know the level
    instructions: 'Construye cada oración en pinyin usando SOLO palabras de Experience 1 (Yo / Familia). Filtra el catálogo con la pestaña 👋 EXP1 para verlas. 🗣️ DI CADA ORACIÓN EN VOZ ALTA antes de entregar.',
    type: 'sentence-building',
    items: [
      // STRICT EXP1 ONLY (per user feedback 2026-05-27). The 20 EXP1 words
      // available are: wǒ, nǐ, tā(他), tā(她), wǒmen, bàba, māma, érzi,
      // nǚ'ér, péngyou, jiā, ài, gǒu, māo, jiào, míngzi, shì, de, rènshi, suì.
      // No numbers, no laoshi, no greetings — those are EXP2/EXP8.
      //
      // POSSESSIVE STANDARD (user feedback 2026-05-27): ALWAYS use "wǒ de"
      // or "nǐ de" for "mi" / "tu" possessives — never omit the de
      // particle, even when it's grammatically optional in real Mandarin
      // (family terms). Consistency > naturalness while kids are learning
      // the pattern.
      { es: 'Yo amo a mi mamá.',            expected: 'wǒ ài wǒ de māma' },
      { es: 'Tú eres mi amigo.',            expected: 'nǐ shì wǒ de péngyou' },
      { es: 'Yo conozco a tu papá.',        expected: 'wǒ rènshi nǐ de bàba' },
      { es: 'Mi gato ama mi casa.',         expected: 'wǒ de māo ài wǒ de jiā' },
      { es: 'Nosotros amamos nuestra casa.', expected: 'wǒmen ài wǒmen de jiā' },
    ],
    pointsPerItem: 20,
    // Parent-facing summary in Spanish — surfaced on the parent view of
    // the homework portal when this assignment is completed (score≥60).
    parentInsight: {
      title: 'Tu hijo/a sabe hablar de su familia y amigos en chino',
      bullets: [
        'Decir que ama a su mamá: "Wǒ ài wǒ de māma"',
        'Identificar a un amigo: "Nǐ shì wǒ de péngyou"',
        'Hablar de su papá: "Wǒ rènshi nǐ de bàba"',
        'Hablar de su mascota: "Wǒ de māo ài wǒ de jiā"',
        'Hablar de la familia: "Wǒmen ài wǒmen de jiā"',
      ],
      encouragement: 'Pídele que te diga "Wǒ ài wǒ de māma" mientras te abraza — verás que ya sabe expresar cariño en chino.',
    },
  },
  // === ASSIGNMENT 2 ===
  {
    id: 'escuela-idioma',
    title: '🏫 EXP2 · Escuela e idioma',
    subtitle: '10 oraciones · palabras de Experience 2 (+ pronombres básicos)',
    expLabel: 'exp2',
    instructions: 'Construye cada oración en pinyin usando palabras de Experience 2 (Escuela / Idioma). Puedes usar pronombres básicos (wǒ, nǐ) de Experience 1. Filtra el catálogo con la pestaña 🎓 EXP2. 🗣️ DI CADA ORACIÓN EN VOZ ALTA.',
    type: 'sentence-building',
    items: [
      // STRICT: EXP2 verbs + nouns + EXP1 pronouns/de/shì/ài only.
      // All possessives use the wǒ de / nǐ de standard (user feedback 2026-05-27).
      { es: 'Yo soy estudiante.',           expected: 'wǒ shì xuésheng' },
      { es: 'Tú eres mi maestra.',          expected: 'nǐ shì wǒ de lǎoshī' },
      { es: 'Yo estudio chino.',            expected: 'wǒ xuéxí hànyǔ' },
      { es: 'Yo leo libros.',               expected: 'wǒ dú shū' },
      { es: 'Yo escribo caracteres.',       expected: 'wǒ xiě zì' },
      { es: 'Mi maestra habla chino.',      expected: 'wǒ de lǎoshī shuō hànyǔ' },
      { es: 'Yo escucho a mi maestra.',     expected: 'wǒ tīng wǒ de lǎoshī' },
      { es: 'Yo veo a mi compañero.',       expected: 'wǒ kànjiàn wǒ de tóngxué' },
      { es: 'Yo sé hablar chino.',          expected: 'wǒ huì shuō hànyǔ' },
      { es: 'Yo amo mi escuela.',           expected: 'wǒ ài wǒ de xuéxiào' },
    ],
    pointsPerItem: 10,  // 10 × 10 = 100
    parentInsight: {
      title: 'Tu hijo/a puede hablar de la escuela y el idioma chino',
      bullets: [
        'Presentarse como estudiante: "Wǒ shì xuésheng"',
        'Identificar a su maestra: "Nǐ shì wǒ de lǎoshī"',
        'Decir qué estudia: "Wǒ xuéxí hànyǔ"',
        'Hablar de leer y escribir: "Wǒ dú shū", "Wǒ xiě zì"',
        'Expresar habilidad: "Wǒ huì shuō hànyǔ" (yo sé hablar chino)',
      ],
      encouragement: 'Pregúntale: "¿Qué estás aprendiendo en chino?" — pídele que te enseñe a decir "yo estudio chino" en voz alta.',
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
    expLabel: a.expLabel || null,
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
