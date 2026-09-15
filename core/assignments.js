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
  // === ASSIGNMENT 5 — EXP5 · Viajes / Lugares ===
  // Strict EXP5-only. Focus on qù/lái/huí (ir/venir/regresar) + places +
  // zài (en/estar). User feedback: "Sentence structure is key to go to
  // return to come" — these are the spine of EXP5.
  // Available EXP5 words: běijīng, zhōngguó, qù, lái, huí, fēijī, chūzūchē,
  // zuò (sentarse/tomar), zhù, zài, nǎ, nǎr, nà, zhè, qiánmiàn, hòumiàn,
  // shàng, xià.
  {
    id: 'viajes-lugares',
    title: '✈️ EXP5 · Viajes y lugares',
    subtitle: '10 frases · SOLO palabras de Experience 5',
    expLabel: 'exp5',
    instructions: 'Cada frase usa SOLO palabras de Experience 5. Filtra el catálogo con la pestaña ✈️ EXP5. 🗣️ DI CADA FRASE EN VOZ ALTA.',
    type: 'sentence-building',
    items: [
      { es: 'Ir',                       expected: 'qù' },
      { es: 'Venir',                    expected: 'lái' },
      { es: 'Regresar',                 expected: 'huí' },
      { es: 'Ir a Beijing',             expected: 'qù běijīng' },
      { es: 'Ir a China',               expected: 'qù zhōngguó' },
      { es: 'Regresar a Beijing',       expected: 'huí běijīng' },
      { es: 'En China',                 expected: 'zài zhōngguó' },
      { es: 'Vivir en Beijing',         expected: 'zhù zài běijīng' },
      { es: 'Tomar un avión',           expected: 'zuò fēijī' },
      { es: 'Al frente',                expected: 'qiánmiàn' },
    ],
    pointsPerItem: 10,
    parentInsight: {
      title: 'Tu hijo/a domina la estructura ir / venir / regresar en chino',
      bullets: [
        'Verbos de movimiento: "qù" (ir), "lái" (venir), "huí" (regresar)',
        'Combinaciones lugar + verbo: "qù běijīng" (ir a Beijing), "huí běijīng" (regresar a Beijing)',
        'Localización con "zài": "zài zhōngguó" (en China)',
        'Vivir en un lugar: "zhù zài běijīng" (vivir en Beijing)',
        'Transporte: "zuò fēijī" (tomar avión)',
      ],
      encouragement: 'Cuando salgan a la calle, pregúntele "¿adónde vamos?" — debe responder "qù [el lugar]". El chino premia el orden VERBO + LUGAR.',
    },
  },
  // === ASSIGNMENT 6 — EXP6 · Casa / Actividades ===
  // Strict EXP6-only. Available: lǐ, zhuōzi, yǐzi, diànnǎo, diànshì,
  // diànyǐng, yīfu, kāi, shuìjiào, zuò (hacer), gōngzuò, dǎdiànhuà, wèi,
  // piàoliang, dà, xiǎo, yǒu, méiyǒu.
  {
    id: 'casa-actividades',
    title: '🏠 EXP6 · Casa y actividades',
    subtitle: '10 frases · SOLO palabras de Experience 6',
    expLabel: 'exp6',
    instructions: 'Cada frase usa SOLO palabras de Experience 6. Filtra el catálogo con la pestaña 🏠 EXP6. 🗣️ DI CADA FRASE EN VOZ ALTA.',
    type: 'sentence-building',
    items: [
      { es: 'Trabajar',                expected: 'gōngzuò' },
      { es: 'Dormir',                  expected: 'shuìjiào' },
      { es: 'Llamar por teléfono',     expected: 'dǎdiànhuà' },
      { es: 'Aló (al teléfono)',       expected: 'wèi' },
      { es: 'Tener una computadora',   expected: 'yǒu diànnǎo' },
      { es: 'No tener televisión',     expected: 'méiyǒu diànshì' },
      { es: 'Ropa bonita',             expected: 'piàoliang yīfu' },
      { es: 'Mesa grande',             expected: 'dà zhuōzi' },
      { es: 'Silla pequeña',           expected: 'xiǎo yǐzi' },
      { es: 'Encender la computadora', expected: 'kāi diànnǎo' },
    ],
    pointsPerItem: 10,
    parentInsight: {
      title: 'Tu hijo/a habla de su casa y actividades cotidianas en chino',
      bullets: [
        'Acciones del día: "gōngzuò" (trabajar), "shuìjiào" (dormir), "dǎdiànhuà" (llamar)',
        'Posesión: "yǒu / méiyǒu" + objeto — "yǒu diànnǎo" (tener computadora)',
        'Adjetivo + sustantivo: "dà zhuōzi" (mesa grande), "piàoliang yīfu" (ropa bonita)',
        'Encender / abrir: "kāi diànnǎo" (encender la computadora)',
        'Atender el teléfono: "wèi" (¿aló?)',
      ],
      encouragement: 'Cuando suene el teléfono, déjele contestar diciendo "wèi" — verá que ya se siente en chino.',
    },
  },
  // === ASSIGNMENT 7 — EXP7 · Personas / Preguntas ===
  // Strict EXP7-only. Available: rén, yīshēng, yīyuàn, xiǎojiě, xiē, duō,
  // shǎo, gè, shéi, shénme, zěnme, zěnmeyàng, jǐ, dōu, gāoxìng, duìbuqǐ.
  {
    id: 'personas-preguntas',
    title: '🙋 EXP7 · Personas y preguntas',
    subtitle: '10 frases · SOLO palabras de Experience 7',
    expLabel: 'exp7',
    instructions: 'Cada frase usa SOLO palabras de Experience 7. Filtra el catálogo con la pestaña 🙋 EXP7. 🗣️ DI CADA FRASE EN VOZ ALTA.',
    type: 'sentence-building',
    items: [
      { es: '¿Quién?',              expected: 'shéi' },
      { es: '¿Qué?',                expected: 'shénme' },
      { es: '¿Cómo?',               expected: 'zěnme' },
      { es: '¿Qué tal?',            expected: 'zěnmeyàng' },
      { es: '¿Cuántos? (≤10)',      expected: 'jǐ' },
      { es: 'Persona',              expected: 'rén' },
      { es: 'Doctor',               expected: 'yīshēng' },
      { es: 'Hospital',             expected: 'yīyuàn' },
      { es: 'Feliz',                expected: 'gāoxìng' },
      { es: 'Lo siento',            expected: 'duìbuqǐ' },
    ],
    pointsPerItem: 10,
    parentInsight: {
      title: 'Tu hijo/a hace preguntas y nombra a las personas en chino',
      bullets: [
        'Pronombres interrogativos: "shéi" (quién), "shénme" (qué), "zěnme" (cómo)',
        'Estado de ánimo: "zěnmeyàng" (¿qué tal?), "gāoxìng" (feliz)',
        'Cantidad pequeña: "jǐ" (¿cuántos ≤10?)',
        'Personas y lugares: "rén" (persona), "yīshēng" (doctor), "yīyuàn" (hospital)',
        'Cortesía: "duìbuqǐ" (lo siento)',
      ],
      encouragement: 'Cuando le pregunten en español "¿cómo estás?", invítele a responder "wǒ hěn gāoxìng" — el cerebro se acostumbra rápido al cambio.',
    },
  },
  // === ASSIGNMENT 8 — EXP8 · Números / Partículas ===
  // Strict EXP8-only. Available: yī, èr, sān, sì, wǔ, liù, qī, bā, jiǔ,
  // shí, yīdiǎnr, bù, ma, ne, le, hé, zàijiàn, méiguānxi.
  {
    id: 'numeros-particulas',
    title: '🔢 EXP8 · Números y partículas',
    subtitle: '10 frases · SOLO palabras de Experience 8',
    expLabel: 'exp8',
    instructions: 'Cada frase usa SOLO palabras de Experience 8. Filtra el catálogo con la pestaña 🔢 EXP8. 🗣️ DI CADA FRASE EN VOZ ALTA.',
    type: 'sentence-building',
    items: [
      { es: 'Uno',                  expected: 'yī' },
      { es: 'Dos',                  expected: 'èr' },
      { es: 'Tres',                 expected: 'sān' },
      { es: 'Cinco',                expected: 'wǔ' },
      { es: 'Diez',                 expected: 'shí' },
      { es: 'Un poquito',           expected: 'yīdiǎnr' },
      { es: 'Y (conector)',         expected: 'hé' },
      { es: 'No (negación)',        expected: 'bù' },
      { es: 'Adiós',                expected: 'zàijiàn' },
      { es: 'No importa',           expected: 'méiguānxi' },
    ],
    pointsPerItem: 10,
    parentInsight: {
      title: 'Tu hijo/a domina números y partículas claves del chino',
      bullets: [
        'Números 1-10: "yī, èr, sān, sì, wǔ, liù, qī, bā, jiǔ, shí"',
        'Conector "y": "hé" — para juntar dos cosas',
        'Negación: "bù" antes del verbo',
        'Cantidad pequeña: "yīdiǎnr" (un poquito)',
        'Despedida y cortesía: "zàijiàn" (adiós), "méiguānxi" (no importa)',
      ],
      encouragement: 'Cuente con él/ella hasta 10 en chino cada noche antes de dormir. Diez minutos, gran progreso.',
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

// ═════════════════════════════════════════════════════════════════════
// 🎒 HSK2 · "BOLSA DE PALABRAS" (word-sack) — 2026-09-15 (Fernando):
// "mix the really essential verbs (want/have/think) with the words you
// want to test + everything needed to finish the sentence. I want buy
// milk, I want drink this water… how many combinations can you make?"
//
// Each word-sack tarea is SELF-CONTAINED: it carries its own chip bag
// (sack) — so the HSK1 catalog rule does NOT apply here, and HSK1 words
// may appear as scaffolding (per the HSK2 doc: «El HSK1 sigue siendo el
// andamiaje; el HSK2 lo pinta»). The kid must DISCOVER `goal` distinct
// valid combinations. The client only ever sees HASHES of the valid
// sentences (no answers in devtools); the server re-validates on submit.
// ═════════════════════════════════════════════════════════════════════
function wordSackHash(s) {
  // djb2 over the normalized sentence — same tiny fn is mirrored in
  // homework.js so the client can check attempts offline.
  const n = normalize(s);
  let h = 5381;
  for (let i = 0; i < n.length; i++) h = ((h * 33) ^ n.charCodeAt(i)) >>> 0;
  return h.toString(16);
}
// Expand 'wǒ yào {F}' × {F:[…]} into concrete sentences.
function _expand(pattern, slots) {
  let out = [pattern];
  for (const key of Object.keys(slots)) {
    const next = [];
    for (const p of out) {
      if (p.includes('{' + key + '}')) {
        for (const v of slots[key]) next.push(p.split('{' + key + '}').join(v));
      } else {
        next.push(p);
      }
    }
    out = next;
  }
  return out;
}
function _sackWord(py, zh, es, cat) { return { py, zh, es, cat }; }

const HSK2_ASSIGNMENTS = [
  {
    id: 'hsk2-familia-grande',
    level: 'hsk2',
    type: 'word-sack',
    title: '👨‍👩‍👧 EXP1 · La Familia Grande',
    subtitle: 'Bolsa de palabras · descubre 6 combinaciones válidas',
    expLabel: 'exp1',
    instructions: 'Tienes una BOLSA de palabras: verbos esenciales + tu familia nueva de HSK2. Combínalas para formar oraciones REALES en chino. ¿Cuántas puedes descubrir? Necesitas 6. 🗣️ Di cada una EN VOZ ALTA.',
    goal: 6,
    sack: [
      _sackWord('wǒ', '我', 'yo', 'pronoun'), _sackWord('nǐ', '你', 'tú', 'pronoun'), _sackWord('tā', '他', 'él', 'pronoun'),
      _sackWord('yǒu', '有', 'tener', 'verb'), _sackWord('shì', '是', 'ser', 'verb'), _sackWord('ài', '爱', 'amar', 'verb'), _sackWord('jièshào', '介绍', 'presentar', 'verb'),
      _sackWord('gēge', '哥哥', 'hermano mayor', 'family'), _sackWord('dìdi', '弟弟', 'hermano menor', 'family'),
      _sackWord('jiějie', '姐姐', 'hermana mayor', 'family'), _sackWord('mèimei', '妹妹', 'hermana menor', 'family'), _sackWord('háizi', '孩子', 'niño / hijo', 'family'),
      _sackWord('hěn', '很', 'muy', 'particle'), _sackWord('gāo', '高', 'alto', 'adj'), _sackWord('de', '的', '(posesivo)', 'particle'),
    ],
    valid: [].concat(
      _expand('{P} yǒu {F}', { P: ['wǒ', 'nǐ', 'tā'], F: ['gēge', 'dìdi', 'jiějie', 'mèimei', 'háizi'] }),
      _expand('{P} ài {F}', { P: ['wǒ', 'nǐ', 'tā'], F: ['gēge', 'dìdi', 'jiějie', 'mèimei'] }),
      _expand('{F} hěn gāo', { F: ['gēge', 'dìdi', 'jiějie', 'mèimei', 'tā'] }),
      _expand('tā shì wǒ de {F}', { F: ['gēge', 'dìdi', 'jiějie', 'mèimei'] }),
      _expand('wǒ jièshào wǒ de {F}', { F: ['gēge', 'dìdi', 'jiějie', 'mèimei'] })
    ),
    parentInsight: {
      title: 'Tu hijo/a combina la familia extendida de HSK2',
      bullets: ['Formó oraciones con 有 (tener), 爱 (amar) y 介绍 (presentar)', 'Usa los hermanos de HSK2: 哥哥, 弟弟, 姐姐, 妹妹', 'Descubrió combinaciones por sí mismo/a — no memorizó'],
      encouragement: 'Pídele que te presente a la familia en chino: «我介绍我的哥哥».',
    },
  },
  {
    id: 'hsk2-dia-escuela',
    level: 'hsk2',
    type: 'word-sack',
    title: '🎓 EXP2 · Un Día en la Escuela',
    subtitle: 'Bolsa de palabras · descubre 6 combinaciones válidas',
    expLabel: 'exp2',
    instructions: 'La bolsa trae los verbos del aula HSK2: entender, saber, pensar, preguntar. Combínalas para decir qué pasa en un examen. Necesitas 6 oraciones válidas. 🗣️ EN VOZ ALTA.',
    goal: 6,
    sack: [
      _sackWord('wǒ', '我', 'yo', 'pronoun'), _sackWord('nǐ', '你', 'tú', 'pronoun'), _sackWord('tā', '她', 'ella', 'pronoun'),
      _sackWord('lǎoshī', '老师', 'maestro/a', 'family'),
      _sackWord('dǒng', '懂', 'entender', 'verb'), _sackWord('zhīdào', '知道', 'saber', 'verb'), _sackWord('juéde', '觉得', 'pensar / opinar', 'verb'),
      _sackWord('wèn', '问', 'preguntar', 'verb'), _sackWord('yǒu', '有', 'tener', 'verb'), _sackWord('kāishǐ', '开始', 'empezar', 'verb'),
      _sackWord('kǎoshì', '考试', 'examen', 'noun'), _sackWord('wèntí', '问题', 'problema / pregunta', 'noun'), _sackWord('kè', '课', 'clase', 'noun'),
      _sackWord('duì', '对', 'correcto', 'adj'), _sackWord('cuò', '错', 'incorrecto', 'adj'), _sackWord('bù', '不', 'no', 'particle'),
    ],
    valid: [].concat(
      _expand('{P} dǒng', { P: ['wǒ', 'nǐ', 'tā'] }),
      _expand('{P} bù dǒng', { P: ['wǒ', 'nǐ', 'tā'] }),
      _expand('{P} zhīdào', { P: ['wǒ', 'nǐ', 'tā'] }),
      _expand('{P} bù zhīdào', { P: ['wǒ', 'nǐ', 'tā'] }),
      _expand('{P} yǒu wèntí', { P: ['wǒ', 'nǐ', 'tā'] }),
      _expand('{P} juéde duì', { P: ['wǒ', 'nǐ', 'tā'] }),
      _expand('{P} juéde cuò', { P: ['wǒ', 'nǐ', 'tā'] }),
      _expand('lǎoshī wèn {P}', { P: ['wǒ', 'nǐ', 'tā'] }),
      ['wǒ wèn lǎoshī', 'kǎoshì kāishǐ', 'kè kāishǐ', 'lǎoshī yǒu wèntí']
    ),
    parentInsight: {
      title: 'Tu hijo/a habla del aula con verbos HSK2',
      bullets: ['Usa 懂 (entender), 知道 (saber) y 觉得 (opinar)', 'Puede decir «no entiendo» y «tengo una pregunta» en chino', 'Formó oraciones sobre exámenes y clases'],
      encouragement: 'Pregúntale «¿dǒng?» cuando le expliques algo — que responda en chino.',
    },
  },
  {
    id: 'hsk2-restaurante-chino',
    level: 'hsk2',
    type: 'word-sack',
    title: '🥢 EXP3 · El Restaurante Chino',
    subtitle: 'Bolsa de palabras · descubre 6 combinaciones válidas',
    expLabel: 'exp3',
    instructions: 'Como en el restaurante: «我要面条!» La bolsa trae comida HSK2 y los verbos para ordenar. Combina y descubre 6 oraciones válidas. 🗣️ Dilas EN VOZ ALTA como si ordenaras de verdad.',
    goal: 6,
    sack: [
      _sackWord('wǒ', '我', 'yo', 'pronoun'), _sackWord('nǐ', '你', 'tú', 'pronoun'), _sackWord('tā', '他', 'él', 'pronoun'),
      _sackWord('yào', '要', 'querer (pedir)', 'verb'), _sackWord('chī', '吃', 'comer', 'verb'), _sackWord('hē', '喝', 'beber', 'verb'),
      _sackWord('mǎi', '买', 'comprar', 'verb'), _sackWord('mài', '卖', 'vender', 'verb'), _sackWord('děng', '等', 'esperar', 'verb'), _sackWord('gěi', '给', 'dar', 'verb'),
      _sackWord('miàntiáo', '面条', 'fideos', 'food'), _sackWord('jīdàn', '鸡蛋', 'huevo', 'food'), _sackWord('kāfēi', '咖啡', 'café', 'food'),
      _sackWord('niúnǎi', '牛奶', 'leche', 'food'), _sackWord('xīguā', '西瓜', 'sandía', 'food'), _sackWord('yú', '鱼', 'pescado', 'food'),
      _sackWord('hǎochī', '好吃', 'delicioso', 'adj'), _sackWord('hěn', '很', 'muy', 'particle'),
    ],
    valid: [].concat(
      _expand('{P} yào {F}', { P: ['wǒ', 'nǐ', 'tā'], F: ['miàntiáo', 'jīdàn', 'kāfēi', 'niúnǎi', 'xīguā', 'yú'] }),
      _expand('wǒ yào chī {F}', { F: ['miàntiáo', 'jīdàn', 'xīguā', 'yú'] }),
      _expand('wǒ yào hē {D}', { D: ['kāfēi', 'niúnǎi'] }),
      _expand('wǒ yào mǎi {F}', { F: ['miàntiáo', 'jīdàn', 'kāfēi', 'niúnǎi', 'xīguā', 'yú'] }),
      _expand('tā mài {F}', { F: ['miàntiáo', 'jīdàn', 'kāfēi', 'niúnǎi', 'xīguā', 'yú'] }),
      _expand('{F} hěn hǎochī', { F: ['miàntiáo', 'jīdàn', 'xīguā', 'yú'] }),
      _expand('wǒ gěi nǐ {F}', { F: ['miàntiáo', 'jīdàn', 'kāfēi', 'niúnǎi', 'xīguā', 'yú'] }),
      ['nǐ děng wǒ', 'wǒ děng nǐ']
    ),
    parentInsight: {
      title: 'Tu hijo/a ordena comida en chino (HSK2)',
      bullets: ['Domina «我要…» (quiero…) con la comida de HSK2', 'Distingue 吃 (comer) de 喝 (beber) al combinar', 'Usa 给 (dar), 等 (esperar) y 卖 (vender) en contexto real'],
      encouragement: 'En un restaurante, pídele que ordene por ti: «我要牛奶» — ¡déjalo pedir!',
    },
  },
];
// Pre-compute the normalized valid set + hashes once at load.
HSK2_ASSIGNMENTS.forEach((a) => {
  a.validNorm = new Set(a.valid.map(normalize));
  a.validHashes = a.valid.map(wordSackHash);
});
// Tag the classic 8 as HSK1 + merge the HSK2 tareas into the registry.
ASSIGNMENTS.forEach((a) => { if (!a.level) a.level = 'hsk1'; });
HSK2_ASSIGNMENTS.forEach((a) => ASSIGNMENTS.push(a));

// List assignments, optionally filtered by level ('hsk1' | 'hsk2').
// No argument = ALL (used by health checks and teacher-side reports).
function listAssignments(level) {
  return ASSIGNMENTS
    .filter((a) => !level || (a.level || 'hsk1') === level)
    .map((a) => {
      const isSack = a.type === 'word-sack';
      const itemCount = isSack ? a.goal : a.items.length;
      const pointsPerItem = isSack ? Math.round(100 / a.goal) : a.pointsPerItem;
      return {
        id: a.id,
        title: a.title,
        subtitle: a.subtitle,
        expLabel: a.expLabel || null,
        level: a.level || 'hsk1',
        type: a.type || 'sentence-building',
        itemCount,
        pointsPerItem,
        totalPoints: isSack ? 100 : a.items.length * a.pointsPerItem,
      };
    });
}

function getAssignment(id) {
  return ASSIGNMENTS.find((a) => a.id === id) || null;
}

// Grade a submission. answers is array of strings (student's pinyin
// for each item). Returns { score, total, breakdown[] }.
function gradeSubmission(assignment, answers) {
  if (!assignment) return null;
  if (!Array.isArray(answers)) answers = [];
  // 🎒 word-sack: answers = the sentences the kid DISCOVERED. Score =
  // distinct valid combinations, capped at the goal, scaled to 100.
  // The server re-validates every sentence — client hashes are only a
  // UX convenience, never trusted.
  if (assignment.type === 'word-sack') {
    const seen = new Set();
    const breakdown = [];
    for (const raw of answers.slice(0, 40)) {
      const norm = normalize(raw);
      const valid = norm.length > 0 && assignment.validNorm.has(norm) && !seen.has(norm);
      if (valid) seen.add(norm);
      breakdown.push({
        i: breakdown.length,
        es: '🎒 combinación',
        expected: valid ? String(raw) : '—',
        student: String(raw || ''),
        correct: valid,
        pointsEarned: 0,   // filled below once we know the cap
      });
    }
    const found = Math.min(seen.size, assignment.goal);
    const score = Math.round((found / assignment.goal) * 100);
    const per = Math.round(100 / assignment.goal);
    let credited = 0;
    for (const b of breakdown) {
      if (b.correct && credited < assignment.goal) { b.pointsEarned = per; credited++; }
    }
    return { score, total: 100, breakdown };
  }
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
