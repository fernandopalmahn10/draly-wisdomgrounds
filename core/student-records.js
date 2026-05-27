// =========================================================================
// student-records.js — persistent per-student tracking
// Each student is identified by a stable 4-character alphanumeric CODE.
// The kid's phone stores the code in localStorage so the same phone always
// maps to the same record across sessions, server restarts, and class days.
//
// Storage: a single JSON file at data/student-records.json (auto-created).
// Writes are debounced 1 second so a flurry of activity doesn't thrash disk.
// =========================================================================
'use strict';
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'student-records.json');
// Code alphabet — avoids confusing chars (0/O, 1/I/l) so kids reading
// codes off a phone screen don't mis-type them.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

let records = {};        // code → { code, displayName, firstSeen, lastSeen, sentencesBuilt: [] }
let saveTimer = null;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { /* ignore */ }
  }
}

function load() {
  ensureDir();
  if (!fs.existsSync(FILE_PATH)) {
    records = {};
    return;
  }
  try {
    const raw = fs.readFileSync(FILE_PATH, 'utf8');
    records = JSON.parse(raw) || {};
    console.log('[students] loaded', Object.keys(records).length, 'student records');
  } catch (e) {
    console.warn('[students] failed to load records, starting fresh:', e.message);
    records = {};
  }
}

function persistNow() {
  ensureDir();
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(records, null, 2), 'utf8');
  } catch (e) {
    console.warn('[students] failed to persist:', e.message);
  }
}

// Debounce writes so a class building 50 sentences/minute doesn't thrash
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, 1000);
}

// Generate a fresh unique 4-character code. ~30M possibilities, collision
// is astronomically rare but we check anyway.
function generateCode() {
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    if (!records[code]) return code;
  }
  // Fallback to 5 chars on the cosmically-unlikely path
  let code = '';
  for (let i = 0; i < 5; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return code;
}

// Sanitize an incoming code (uppercase, alphanumeric only, 4 chars).
function normalizeCode(code) {
  if (!code || typeof code !== 'string') return null;
  const cleaned = code.toUpperCase().replace(/[^A-Z2-9]/g, '');
  if (cleaned.length < 4 || cleaned.length > 5) return null;
  return cleaned;
}

// Get or create a student record. Returns the record (always non-null).
// If a known code is passed, returns the existing record. Otherwise
// creates a new one with the given displayName and a fresh code.
function getOrCreate(code, displayName) {
  const normalized = normalizeCode(code);
  if (normalized && records[normalized]) {
    const rec = records[normalized];
    // Refresh the display name on each rejoin (kid can pick a new name)
    if (displayName) rec.displayName = String(displayName).slice(0, 24);
    rec.lastSeen = Date.now();
    scheduleSave();
    return rec;
  }
  const newCode = generateCode();
  const rec = {
    code: newCode,
    displayName: displayName ? String(displayName).slice(0, 24) : 'Anon',
    firstSeen: Date.now(),
    lastSeen: Date.now(),
    sentencesBuilt: [],
  };
  records[newCode] = rec;
  scheduleSave();
  return rec;
}

function get(code) {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  return records[normalized] || null;
}

// Append a built sentence to a student's history.
// `sentence` is an array of word IDs.
// `contributors` is an array of student CODES who contributed to it.
function logSentence(contributors, sentence, pin) {
  if (!Array.isArray(sentence) || !sentence.length) return;
  if (!Array.isArray(contributors) || !contributors.length) return;
  const entry = {
    ts: Date.now(),
    pin: pin || '',
    words: sentence.slice(),    // copy to avoid mutation
    contributors: contributors.slice(),
  };
  contributors.forEach((code) => {
    const rec = records[code];
    if (!rec) return;
    rec.sentencesBuilt.push(entry);
    // Cap history to last 200 entries per student so the JSON doesn't grow
    // unboundedly. Newest first when read.
    if (rec.sentencesBuilt.length > 200) {
      rec.sentencesBuilt = rec.sentencesBuilt.slice(-200);
    }
  });
  scheduleSave();
}

// Return the student's history (newest first). Caps to most recent N.
function getHistory(code, limit) {
  const rec = get(code);
  if (!rec) return [];
  const arr = rec.sentencesBuilt.slice().reverse();
  return typeof limit === 'number' ? arr.slice(0, limit) : arr;
}

// Delete a single history entry for the given student, identified by its
// timestamp (which is unique within their record). Returns true if removed.
function deleteHistoryEntry(code, ts) {
  const rec = get(code);
  if (!rec) return false;
  const target = Number(ts);
  if (!Number.isFinite(target)) return false;
  const before = rec.sentencesBuilt.length;
  rec.sentencesBuilt = rec.sentencesBuilt.filter((e) => e.ts !== target);
  if (rec.sentencesBuilt.length < before) {
    scheduleSave();
    return true;
  }
  return false;
}

// Teacher-side roster summary. Returns one row per student with code,
// displayName, sentence count, firstSeen, lastSeen. Sorted by most-recent
// activity so the kids who just played show at the top of the teacher's
// "Cuaderno de Alumnos" list. NEVER includes the actual sentence words —
// the teacher has to drill into a specific student to see those.
function listAll() {
  return Object.values(records)
    .map((r) => ({
      code: r.code,
      displayName: r.displayName || 'Anon',
      firstSeen: r.firstSeen || 0,
      lastSeen: r.lastSeen || 0,
      sentenceCount: Array.isArray(r.sentencesBuilt) ? r.sentencesBuilt.length : 0,
      testCount:     Array.isArray(r.testResults)   ? r.testResults.length   : 0,
    }))
    .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
}

// === TEST RESULTS ===
// Persist a graded test attempt for a student. One entry per attempt;
// capped to last 100 so the JSON doesn't grow unbounded. The teacher's
// Cuaderno de Alumnos drills into this list per student.
function logTestResult(code, payload) {
  const rec = get(code);
  if (!rec) return false;
  if (!Array.isArray(rec.testResults)) rec.testResults = [];
  const entry = {
    ts:        Date.now(),
    storyId:   String(payload.storyId || ''),
    storyTitle: String(payload.storyTitle || ''),
    score:     Number(payload.score || 0),       // 0–100
    pointsPerQ: Number(payload.pointsPerQ || 20),
    breakdown: Array.isArray(payload.breakdown) ? payload.breakdown.slice() : [],
    pin:       String(payload.pin || ''),
  };
  rec.testResults.push(entry);
  if (rec.testResults.length > 100) {
    rec.testResults = rec.testResults.slice(-100);
  }
  rec.lastSeen = Date.now();
  scheduleSave();
  return true;
}
function getTestResults(code, limit) {
  const rec = get(code);
  if (!rec) return [];
  const arr = (rec.testResults || []).slice().reverse();    // newest first
  return typeof limit === 'number' ? arr.slice(0, limit) : arr;
}

// === ASSIGNMENT SUBMISSIONS ===
// Records homework submissions per student. One entry per submission;
// students CAN resubmit but each attempt is logged so we see progress.
// Capped at last 100 attempts so the JSON doesn't grow without bound.
function logAssignmentSubmission(code, payload) {
  const rec = get(code);
  if (!rec) return false;
  if (!Array.isArray(rec.assignmentSubmissions)) rec.assignmentSubmissions = [];
  const entry = {
    ts:         Date.now(),
    assignmentId:    String(payload.assignmentId || ''),
    assignmentTitle: String(payload.assignmentTitle || ''),
    accessCode:      String(payload.accessCode || ''),
    score:           Number(payload.score || 0),
    total:           Number(payload.total || 100),
    breakdown:       Array.isArray(payload.breakdown) ? payload.breakdown.slice() : [],
  };
  rec.assignmentSubmissions.push(entry);
  if (rec.assignmentSubmissions.length > 100) {
    rec.assignmentSubmissions = rec.assignmentSubmissions.slice(-100);
  }
  rec.lastSeen = Date.now();
  scheduleSave();
  return true;
}
function getAssignmentSubmissions(code, limit) {
  const rec = get(code);
  if (!rec) return [];
  const arr = (rec.assignmentSubmissions || []).slice().reverse();
  return typeof limit === 'number' ? arr.slice(0, limit) : arr;
}

// Initial load on require()
load();

module.exports = {
  getOrCreate,
  get,
  logSentence,
  getHistory,
  deleteHistoryEntry,
  normalizeCode,
  listAll,
  logTestResult,
  getTestResults,
  logAssignmentSubmission,
  getAssignmentSubmissions,
};
