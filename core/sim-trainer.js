// =========================================================================
// 🎯 sim-trainer.js — HSK1 tiered homework built FROM the simulations
// 2026-09-20 (Fernando): "You have completely everything in the database
// for the simulations — so let's do the homeworks based on tier. Three
// tiers, eight different homeworks, small versions of the tests, with
// the real pictures and audio, so when we get to the simulations they
// already have a base."
//
// The 8 homeworks ARE the 8 exam parts, drawing from ALL 10 sims
// (~50 real questions each). Tiers by difficulty:
//   🥉 Tier 1 · Escucha       — L1, L2, L3 (audio first, easiest)
//   🥈 Tier 2 · Escucha y Lee — L4, R1, R2 (the bridge)
//   🥇 Tier 3 · Lectura       — R3, R4    (reading, hardest)
// A session = SESSION_SIZE random questions (small, not overwhelming).
// Answers NEVER leave the server: the client checks each tap via
// /trainer/check and the final score is re-graded here.
// =========================================================================
'use strict';

const HskSim = require('./hsk-sim');

const SESSION_SIZE = 10;
const PASS_PCT = 80;

const TRAINERS = [
  { id: 'trainer-l1', part: 'L1', tier: 1, icon: '🎧', title: 'Audio · ¿Verdadero o Falso?',
    instructions: 'Escucha el audio y mira la imagen. ¿Dicen lo mismo? Marca ✓ o ✕.' },
  { id: 'trainer-l2', part: 'L2', tier: 1, icon: '🖼️', title: 'Audio · Elige la imagen',
    instructions: 'Escucha el audio y toca la imagen correcta.' },
  { id: 'trainer-l3', part: 'L3', tier: 1, icon: '🔠', title: 'Audio · Empareja la galería',
    instructions: 'Escucha el audio y encuentra su imagen en la galería.' },
  { id: 'trainer-l4', part: 'L4', tier: 2, icon: '💬', title: 'Audio · Elige la respuesta',
    instructions: 'Escucha el audio y elige la opción correcta en pinyin.' },
  { id: 'trainer-r1', part: 'R1', tier: 2, icon: '👀', title: 'Palabra ↔ Imagen',
    instructions: 'Lee la palabra. ¿Coincide con la imagen? Marca ✓ o ✕.' },
  { id: 'trainer-r2', part: 'R2', tier: 2, icon: '🧩', title: 'Oración → Imagen',
    instructions: 'Lee la oración y toca la imagen que la representa.' },
  { id: 'trainer-r3', part: 'R3', tier: 3, icon: '❓', title: 'Pregunta ↔ Respuesta',
    instructions: 'Lee la pregunta y elige la mejor respuesta.' },
  { id: 'trainer-r4', part: 'R4', tier: 3, icon: '✍️', title: 'Completa la oración',
    instructions: 'Lee la oración y elige la palabra que completa el espacio ( ).' },
];

const TIERS = [
  { tier: 1, icon: '🥉', title: 'Tier 1 · Escucha',       blurb: 'Puro oído — como empieza el examen' },
  { tier: 2, icon: '🥈', title: 'Tier 2 · Escucha y Lee', blurb: 'El puente: del audio al pinyin' },
  { tier: 3, icon: '🥇', title: 'Tier 3 · Lectura',       blurb: 'Solo lectura — lo más difícil' },
];

// ── Build the normalized question bank once at load ──
// Generic question shape (client gets everything EXCEPT `answer`):
//   { qid, audio?, image?, prompt?, promptSub?, tf?, options: [{key, image?|text?, sub?}] }
const BANK = {};        // part → [question]
const BY_QID = new Map(); // qid → question (with answer)

function _isExampleLabel(g) {
  return /ejemplo/i.test(String(g.label || ''));
}

(function build() {
  for (const t of TRAINERS) BANK[t.part] = [];
  for (const simId of Object.keys(HskSim.SIMULATIONS)) {
    const sim = HskSim.SIMULATIONS[simId];
    const push = (part, q) => {
      q.qid = simId + '|' + part + '|' + q.num;
      delete q.num;
      BANK[part].push(q);
      BY_QID.set(q.qid, q);
    };
    // L1 — audio + image, true/false
    sim.listening.part1.questions.forEach((q) => push('L1', {
      num: q.num, audio: q.audioUrl || null, image: q.image, tf: true, answer: q.answer === true,
    }));
    // L2 — audio, pick 1 of its 3 images
    sim.listening.part2.questions.forEach((q) => push('L2', {
      num: q.num, audio: q.audioUrl || null,
      options: (q.options || []).map((o) => ({ key: o.letter, image: o.image })),
      answer: q.answer,
    }));
    // L3 — audio, pick from the part gallery (examples excluded)
    {
      const gal = (sim.listening.part3.gallery || []).filter((g) => !_isExampleLabel(g));
      sim.listening.part3.questions.forEach((q) => push('L3', {
        num: q.num, audio: q.audioUrl || null,
        options: gal.map((g) => ({ key: g.letter, image: g.image })),
        answer: q.answer,
      }));
    }
    // L4 — audio, pick 1 of 3 text options
    sim.listening.part4.questions.forEach((q) => push('L4', {
      num: q.num, audio: q.audioUrl || null,
      options: (q.options || []).map((o) => ({ key: o.letter, text: o.text })),
      answer: q.answer,
    }));
    // R1 — word + image, true/false
    sim.reading.part1.questions.forEach((q) => push('R1', {
      num: q.num, image: q.image, prompt: q.word, tf: true, answer: q.answer === true,
    }));
    // R2 — sentence, pick from picture gallery (examples excluded)
    {
      const gal = (sim.reading.part2.gallery || []).filter((g) => !_isExampleLabel(g));
      sim.reading.part2.questions.forEach((q) => push('R2', {
        num: q.num, prompt: q.pinyin, promptSub: q.hanzi,
        options: gal.map((g) => ({ key: g.letter, image: g.image })),
        answer: q.answer,
      }));
    }
    // R3 / R4 — question or blank-sentence, pick from the word bank
    // (the example's letter is excluded, same as the real exam UX)
    for (const [part, pdata] of [['R3', sim.reading.part3], ['R4', sim.reading.part4]]) {
      if (!pdata) continue;
      const exLetter = pdata.example ? pdata.example.answer : null;
      const bank = (pdata.bank || []).filter((b) => b.letter !== exLetter);
      pdata.questions.forEach((q) => push(part, {
        num: q.num, prompt: q.pinyin, promptSub: q.hanzi,
        options: bank.map((b) => ({ key: b.letter, text: b.pinyin, sub: b.hanzi })),
        answer: q.answer,
      }));
    }
  }
})();

function _sanitize(q) {
  const cp = Object.assign({}, q);
  delete cp.answer;
  return cp;
}

// A fresh training session: SESSION_SIZE random questions of that part.
function getSession(trainerId) {
  const t = TRAINERS.find((x) => x.id === trainerId);
  if (!t) return null;
  const pool = BANK[t.part].slice();
  for (let i = pool.length - 1; i > 0; i--) {          // Fisher-Yates
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return {
    trainer: t,
    questions: pool.slice(0, SESSION_SIZE).map(_sanitize),
    total: SESSION_SIZE,
    poolSize: BANK[t.part].length,
  };
}

// Instant per-tap verdict (authoritative, answers never shipped).
function check(qid, given) {
  const q = BY_QID.get(String(qid || ''));
  if (!q) return null;
  let correct;
  if (q.tf) correct = (given === true || given === 'true') === (q.answer === true);
  else correct = String(given || '').toUpperCase() === String(q.answer).toUpperCase();
  return { correct, expected: q.tf ? q.answer : String(q.answer) };
}

// Final grade — re-checks every answer server-side.
function grade(trainerId, answers) {
  const t = TRAINERS.find((x) => x.id === trainerId);
  if (!t) return null;
  if (!Array.isArray(answers)) answers = [];
  let right = 0;
  const seen = new Set();
  for (const a of answers.slice(0, SESSION_SIZE)) {
    if (!a || seen.has(a.qid)) continue;
    seen.add(a.qid);
    const q = BY_QID.get(String(a.qid || ''));
    if (!q) continue;
    if (String(a.qid).split('|')[1] !== t.part) continue;   // wrong part → no credit
    const v = check(a.qid, a.answer);
    if (v && v.correct) right++;
  }
  const score = Math.round((right / SESSION_SIZE) * 100);
  return { score, total: 100, right, of: SESSION_SIZE };
}

module.exports = { TRAINERS, TIERS, SESSION_SIZE, PASS_PCT, getSession, check, grade, BANK };
