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

// Initial load on require()
load();

module.exports = {
  getOrCreate,
  get,
  logSentence,
  getHistory,
  normalizeCode,
};
