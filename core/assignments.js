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

// 2026-05-27: access codes are now stored in core/teachers.js, one per
// teacher. The list below is kept only as documentation of the OLD shape
// — actual validation goes through Teachers.isAccessCodeValid() which
// reads from data/teachers.json. The super-admin teacher (EMAAR2026) is
// seeded with code "1001" for backwards compatibility with existing
// students. Other 1001-5005 codes are dropped (user feedback: "I only
// use one anyway").
const LEGACY_ACCESS_CODES = ['1001'];   // for reference only — see teachers.js

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
  // User feedback 2026-05-27: "Experience 2 should ONLY use words of
  // Experience 2, no combinations with EXP1 pronouns." So this assignment
  // is phrase-based (verb + noun) rather than full sentences. The kid
  // practices the EXP2 vocab purely.
  {
    id: 'escuela-idioma',
    title: '🏫 EXP2 · Escuela e idioma',
    subtitle: '10 frases · SOLO palabras de Experience 2',
    expLabel: 'exp2',
    instructions: 'Cada frase usa SOLO palabras de Experience 2 (Escuela / Idioma). No mezcles con palabras de otras experiencias. Filtra el catálogo con la pestaña 🎓 EXP2. 🗣️ DI CADA FRASE EN VOZ ALTA.',
    type: 'sentence-building',
    items: [
      // STRICT: every pinyin word below is from EXP2 only. Verified
      // against public/js/warmup-vocab.js EXP2 block (18 words).
      { es: 'Leer libros',          expected: 'dú shū' },
      { es: 'Escribir caracteres',  expected: 'xiě zì' },
      { es: 'Estudiar chino',       expected: 'xuéxí hànyǔ' },
      { es: 'Hablar chino',         expected: 'shuō hànyǔ' },
      { es: 'Escuchar a la maestra', expected: 'tīng lǎoshī' },
      { es: 'Mirar libros',         expected: 'kàn shū' },
      { es: 'Ver al compañero',     expected: 'kànjiàn tóngxué' },
      { es: 'Maestro de chino',     expected: 'hànyǔ lǎoshī' },
      { es: 'Saber escribir',       expected: 'huì xiě' },
      { es: 'Poder leer',           expected: 'néng dú' },
    ],
    pointsPerItem: 10,  // 10 × 10 = 100
    parentInsight: {
      title: 'Tu hijo/a domina vocabulario de escuela y el idioma chino',
      bullets: [
        'Acciones: "dú shū" (leer libros), "xiě zì" (escribir caracteres)',
        'Idioma: "xuéxí hànyǔ" (estudiar chino), "shuō hànyǔ" (hablar chino)',
        'Sentidos: "tīng lǎoshī" (escuchar a la maestra), "kàn shū" (mirar libros)',
        'Habilidad: "huì xiě" (saber escribir), "néng dú" (poder leer)',
        'Personas: "lǎoshī" (maestra), "tóngxué" (compañero), "xuésheng" (estudiante)',
      ],
      encouragement: 'Pregúntale: "¿Cómo se dice leer libros en chino?" — debería responder "dú shū" rápidamente.',
    },
  },
  // === ASSIGNMENT 3 ===
  // Strict EXP3-only — Comprar / Comer. User feedback 2026-05-27:
  // "experience 2, just like buying things, buying food, buying
  // vegetables, it only should make usage of the words of experience 2"
  // — applied here too: phrases, not sentences, no EXP1 contamination.
  {
    id: 'comprar-comer',
    title: '🛒 EXP3 · Comprar y comer',
    subtitle: '10 frases · SOLO palabras de Experience 3',
    expLabel: 'exp3',
    instructions: 'Cada frase usa SOLO palabras de Experience 3 (Comprar / Comer). Filtra el catálogo con la pestaña 🍴 EXP3. 🗣️ DI CADA FRASE EN VOZ ALTA.',
    type: 'sentence-building',
    items: [
      // Every word here is from EXP3. Verified.
      { es: 'Comer arroz',           expected: 'chī mǐfàn' },
      { es: 'Beber té',              expected: 'hē chá' },
      { es: 'Comprar fruta',         expected: 'mǎi shuǐguǒ' },
      { es: 'Comer una manzana',     expected: 'chī píngguǒ' },
      { es: 'Beber agua',            expected: 'hē shuǐ' },
      { es: 'Me gusta la comida',    expected: 'xǐhuan cài' },
      { es: 'Quiero agua',           expected: 'xiǎng shuǐ' },
      { es: '¿Cuánto dinero?',       expected: 'duōshǎo qián' },
      { es: 'Comprar arroz',         expected: 'mǎi mǐfàn' },
      { es: 'Gracias, de nada',      expected: 'xièxie búkèqi' },
    ],
    pointsPerItem: 10,
    parentInsight: {
      title: 'Tu hijo/a puede pedir comida y bebida en chino',
      bullets: [
        'Acciones de mesa: "chī mǐfàn" (comer arroz), "hē chá" (beber té)',
        'Compras: "mǎi shuǐguǒ" (comprar fruta), "mǎi mǐfàn" (comprar arroz)',
        'Preguntar precio: "duōshǎo qián" (¿cuánto dinero?)',
        'Cortesía: "xièxie" (gracias), "búkèqi" (de nada)',
        'Preferencias: "xǐhuan cài" (me gusta la comida), "xiǎng shuǐ" (quiero agua)',
      ],
      encouragement: 'Cuando coman juntos, pídele que pida la comida en chino. "Yo quiero agua" → "wǒ xiǎng shuǐ".',
    },
  },
  // === ASSIGNMENT 4 ===
  // Strict EXP4-only — Tiempo / Clima. Same pattern: short phrases.
  {
    id: 'tiempo-clima',
    title: '⏰ EXP4 · Tiempo y clima',
    subtitle: '10 frases · SOLO palabras de Experience 4',
    expLabel: 'exp4',
    instructions: 'Cada frase usa SOLO palabras de Experience 4 (Tiempo / Clima). Filtra el catálogo con la pestaña ⏰ EXP4. 🗣️ DI CADA FRASE EN VOZ ALTA.',
    type: 'sentence-building',
    items: [
      { es: 'Hoy',                   expected: 'jīntiān' },
      { es: 'Mañana',                expected: 'míngtiān' },
      { es: 'Ayer',                  expected: 'zuótiān' },
      { es: 'El clima',              expected: 'tiānqì' },
      { es: 'Muy caliente',          expected: 'hěn rè' },
      { es: 'Muy frío',              expected: 'hěn lěng' },
      { es: 'Demasiado caliente',    expected: 'tài rè' },
      { es: 'Hoy llueve',            expected: 'jīntiān xiàyǔ' },
      { es: 'Ayer llovió',           expected: 'zuótiān xiàyǔ' },
      { es: 'Mañana por la tarde',   expected: 'míngtiān xiàwǔ' },
    ],
    pointsPerItem: 10,
    parentInsight: {
      title: 'Tu hijo/a puede hablar del tiempo y el clima en chino',
      bullets: [
        'Días: "jīntiān" (hoy), "míngtiān" (mañana), "zuótiān" (ayer)',
        'Clima: "tiānqì" (el clima), "xiàyǔ" (llover)',
        'Sensaciones: "hěn rè" (muy caliente), "hěn lěng" (muy frío)',
        'Énfasis: "tài rè" (demasiado caliente)',
        'Frases del día: "jīntiān xiàyǔ" (hoy llueve)',
      ],
      encouragement: 'Cada mañana, pregúntale en chino: "¿Cómo está el tiempo hoy?" — debería responder "jīntiān hěn rè" o "jīntiān hěn lěng".',
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

// Validation now routes through the teachers module — any access code
// belonging to any teacher's classroom is valid.
let _Teachers = null;
function _getTeachers() {
  if (!_Teachers) _Teachers = require('./teachers');
  return _Teachers;
}
function isAccessCodeValid(code) {
  return _getTeachers().isAccessCodeValid(code);
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
  LEGACY_ACCESS_CODES,
  ASSIGNMENTS,
  isAccessCodeValid,
  listAssignments,
  getAssignment,
  gradeSubmission,
  normalize,
};
