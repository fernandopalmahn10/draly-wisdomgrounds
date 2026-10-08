// =========================================================================
// yct-sim.js — YCT simulation data + grading
// =========================================================================
// Every core/yct/<level>-sim<N>.json (written by scripts/yct-import.js)
// is one full YCT mock exam: a listening section driven by ONE continuous
// audio track (welcome, instructions and items exactly as in the real
// exam, with each item's [start, end] in `t`) and a self-paced reading
// section. The kid-facing payload strips answers and transcripts of the
// scored items; grading returns them so the results screen can review.
//
// Score: listening and reading are worth half the total each (YCT1:
// 100 + 100 = 200, pass 120), split evenly across the items of each
// section — the official report scores 20 listening items at 5 pts.
// =========================================================================
'use strict';
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'yct');
const SIMS = {};
try {
  fs.readdirSync(DIR).filter((f) => /\.json$/.test(f)).sort().forEach((f) => {
    const s = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
    SIMS[s.id] = s;
  });
} catch (_) { /* no YCT sims yet */ }

const isYct = (simId) => /^yct\d+-/i.test(String(simId || ''));
const get = (simId) => SIMS[simId] || null;

function scoredItems(section) {
  const out = [];
  (section.parts || []).forEach((p) => p.items.forEach((it) => { if (!it.example) out.push(it); }));
  return out;
}

function listSims() {
  return Object.values(SIMS).map((s) => ({
    id: s.id,
    title: s.title,
    subtitle: 'Escucha (' + s.listening.parts.length + ' partes) · Lectura (' + s.reading.parts.length + ' partes)',
    level: s.level,
    totalQuestions: scoredItems(s.listening).length + scoredItems(s.reading).length,
    questionCount: scoredItems(s.listening).length + scoredItems(s.reading).length,
    partCount: s.listening.parts.length + s.reading.parts.length,
  }));
}

function buildSimPayload(simId) {
  const s = get(simId);
  if (!s) return null;
  const copy = JSON.parse(JSON.stringify(s));
  [copy.listening, copy.reading].forEach((sec) => sec.parts.forEach((p) => p.items.forEach((it) => {
    if (it.example) return;        // examples are shown already answered
    delete it.answer;
    delete it.transcript;          // reading the hanzi would replace listening
  })));
  copy.kind = 'yct';
  return copy;
}

function gradeSim(simId, answers) {
  const s = get(simId);
  if (!s) return null;
  answers = answers || {};
  const half = (s.scoring.total || 200) / 2;
  const breakdown = [];
  const parts = [];
  let raw = 0;
  [['listening', s.listening], ['reading', s.reading]].forEach(([secId, sec]) => {
    const items = scoredItems(sec);
    const per = half / items.length;
    sec.parts.forEach((p) => {
      const row = { section: secId, part: p.part, correct: 0, total: 0, items: [] };
      p.items.forEach((it) => {
        if (it.example) return;
        const given = answers[it.qid];
        const ok = given != null && String(given) === String(it.answer);
        if (ok) { raw += per; row.correct++; }
        row.total++;
        row.items.push({ qid: it.qid, num: it.num, correct: ok });
        breakdown.push({ qid: it.qid, num: it.num, expected: it.answer, given: given == null ? null : given, correct: ok });
      });
      parts.push(row);
    });
  });
  const score = Math.round(raw);
  const total = s.scoring.total || 200;
  // Answers + transcripts for the review screen (the exam is over).
  const review = {};
  [s.listening, s.reading].forEach((sec) => sec.parts.forEach((p) => p.items.forEach((it) => {
    if (it.example) return;
    review[it.qid] = { answer: it.answer, transcript: it.transcript || null };
  })));
  return {
    score, total,
    percent: Math.round((score / total) * 100),
    pass: s.scoring.pass || Math.round(total * 0.6),
    passed: score >= (s.scoring.pass || Math.round(total * 0.6)),
    parts, breakdown, review,
  };
}

module.exports = { SIMS, isYct, get, listSims, buildSimPayload, gradeSim };
