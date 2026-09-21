// =========================================================================
// 🎯 sim-trainer.js — HSK1 tiered homework built FROM the simulations
// v2 2026-09-20 (Fernando): "Classify the 400 questions — when you click
// Tier 1 you see the EIGHT EXPERIENCES. Everything related to family in
// one place, school in another… from the whole 10 simulations."
//
// Structure: TIER (difficulty of the mechanic) × EXPERIENCIA (theme).
//   🥉 Tier 1 · Palabras y Audio — L1, L2, L3, R1 (short audio + single words)
//   🥈 Tier 2 · Oraciones        — L4, R2 (sentence-level)
//   🥇 Tier 3 · Lectura Profunda — R3, R4 (question↔answer, fill the blank)
// Themes come from data/trainer-audit.json — produced by an internal
// audit: text questions matched against the 150-word experiencia map,
// and every audio-only question classified by VISION agents that looked
// at its actual exam image.
// A session = up to SESSION_SIZE random questions of that tier+theme.
// Answers NEVER leave the server (check + re-grade here).
// =========================================================================
'use strict';

const fs = require('fs');
const path = require('path');
const HskSim = require('./hsk-sim');

const SESSION_SIZE = 10;
const PASS_PCT = 80;

const TIERS = [
  { tier: 1, icon: '🥉', title: 'Tier 1 · Palabras y Audio', blurb: 'Audio corto y palabras sueltas — el comienzo suave', parts: ['L1', 'L2', 'L3', 'R1'] },
  { tier: 2, icon: '🥈', title: 'Tier 2 · Oraciones',        blurb: 'Del audio y la imagen a la oración completa',      parts: ['L4', 'R2'] },
  { tier: 3, icon: '🥇', title: 'Tier 3 · Lectura Profunda', blurb: 'Pregunta ↔ respuesta y completar — lo del examen', parts: ['R3', 'R4'] },
];

const EXP_LABELS = {
  exp1: 'Yo / Familia', exp2: 'Escuela / Idioma', exp3: 'Comprar / Comer',
  exp4: 'Tiempo / Clima', exp5: 'Viajes / Lugares', exp6: 'Casa / Actividades',
  exp7: 'Personas / ¿?', exp8: 'Números / Partículas',
};

// ── theme audit (qid → expN) ──
let AUDIT = {};
try {
  AUDIT = JSON.parse(fs.readFileSync(path.join(__dirname, 'trainer-audit.json'), 'utf8'));
  console.log('[trainer] theme audit loaded:', Object.keys(AUDIT).length, 'questions');
} catch (e) {
  console.warn('[trainer] no trainer-audit.json — themes default to exp6:', e.message);
}

// ── Build the normalized question bank once at load ──
const ALL = [];              // every question, with .part .exp .answer
const BY_QID = new Map();

function _isExampleLabel(g) {
  return /ejemplo/i.test(String(g.label || ''));
}

(function build() {
  for (const simId of Object.keys(HskSim.SIMULATIONS)) {
    const sim = HskSim.SIMULATIONS[simId];
    const push = (part, q) => {
      q.qid = simId + '|' + part + '|' + q.num;
      delete q.num;
      q.part = part;
      q.exp = AUDIT[q.qid] || 'exp6';
      ALL.push(q);
      BY_QID.set(q.qid, q);
    };
    sim.listening.part1.questions.forEach((q) => push('L1', {
      num: q.num, audio: q.audioUrl || null, image: q.image, tf: true, answer: q.answer === true,
    }));
    sim.listening.part2.questions.forEach((q) => push('L2', {
      num: q.num, audio: q.audioUrl || null,
      options: (q.options || []).map((o) => ({ key: o.letter, image: o.image })),
      answer: q.answer,
    }));
    {
      const gal = (sim.listening.part3.gallery || []).filter((g) => !_isExampleLabel(g));
      sim.listening.part3.questions.forEach((q) => push('L3', {
        num: q.num, audio: q.audioUrl || null,
        options: gal.map((g) => ({ key: g.letter, image: g.image })),
        answer: q.answer,
      }));
    }
    sim.listening.part4.questions.forEach((q) => push('L4', {
      num: q.num, audio: q.audioUrl || null,
      options: (q.options || []).map((o) => ({ key: o.letter, text: o.text })),
      answer: q.answer,
    }));
    sim.reading.part1.questions.forEach((q) => push('R1', {
      num: q.num, image: q.image, prompt: q.word, tf: true, answer: q.answer === true,
    }));
    {
      const gal = (sim.reading.part2.gallery || []).filter((g) => !_isExampleLabel(g));
      sim.reading.part2.questions.forEach((q) => push('R2', {
        num: q.num, prompt: q.pinyin, promptSub: q.hanzi,
        options: gal.map((g) => ({ key: g.letter, image: g.image })),
        answer: q.answer,
      }));
    }
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

function _tierOf(n) { return TIERS.find((t) => t.tier === Number(n)) || null; }
function _pool(tierNum, exp) {
  const t = _tierOf(tierNum);
  if (!t) return [];
  return ALL.filter((q) => t.parts.includes(q.part) && q.exp === exp);
}

// The tier × experiencia availability matrix (question counts).
function matrix() {
  const out = {};
  for (const t of TIERS) {
    const row = {};
    for (const exp of Object.keys(EXP_LABELS)) row[exp] = _pool(t.tier, exp).length;
    out['t' + t.tier] = row;
  }
  return out;
}

function _sanitize(q) {
  const cp = Object.assign({}, q);
  delete cp.answer;
  delete cp.part;
  delete cp.exp;
  return cp;
}

// A fresh session for one tier+theme. Size adapts to the pool.
function getSession(tierNum, exp) {
  const t = _tierOf(tierNum);
  if (!t || !EXP_LABELS[exp]) return null;
  const pool = _pool(tierNum, exp);
  if (!pool.length) return null;
  const arr = pool.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const n = Math.min(SESSION_SIZE, arr.length);
  return {
    tier: { tier: t.tier, icon: t.icon, title: t.title },
    exp: exp,
    expLabel: EXP_LABELS[exp],
    questions: arr.slice(0, n).map(_sanitize),
    total: n,
    poolSize: pool.length,
  };
}

function check(qid, given) {
  const q = BY_QID.get(String(qid || ''));
  if (!q) return null;
  let correct;
  if (q.tf) correct = (given === true || given === 'true') === (q.answer === true);
  else correct = String(given || '').toUpperCase() === String(q.answer).toUpperCase();
  return { correct, expected: q.tf ? q.answer : String(q.answer) };
}

// Final grade: denominator = the session size for that tier+theme.
function grade(tierNum, exp, answers) {
  const t = _tierOf(tierNum);
  if (!t || !EXP_LABELS[exp]) return null;
  const denom = Math.min(SESSION_SIZE, _pool(tierNum, exp).length);
  if (!denom) return null;
  if (!Array.isArray(answers)) answers = [];
  let right = 0;
  const seen = new Set();
  for (const a of answers.slice(0, denom)) {
    if (!a || seen.has(a.qid)) continue;
    seen.add(a.qid);
    const q = BY_QID.get(String(a.qid || ''));
    if (!q) continue;
    if (!t.parts.includes(q.part) || q.exp !== exp) continue;  // wrong bucket → no credit
    const v = check(a.qid, a.answer);
    if (v && v.correct) right++;
  }
  const score = Math.round((right / denom) * 100);
  return { score, total: 100, right, of: denom };
}

module.exports = { TIERS, EXP_LABELS, SESSION_SIZE, PASS_PCT, matrix, getSession, check, grade, ALL };
