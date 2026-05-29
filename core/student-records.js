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
    avatar: null,                 // chosen on first homework-portal entry
    classroomCode: null,          // assigned when they enter a teacher's
                                  // access code (set via setClassroomCode)
    firstSeen: Date.now(),
    lastSeen: Date.now(),
    sentencesBuilt: [],
  };
  records[newCode] = rec;
  scheduleSave();
  return rec;
}
// Tag a student with the classroom (teacher's access code) they joined
// under. Called every time a kid enters via /homework — the access code
// they typed becomes their classroom of record. If a kid switches classes
// (types a different teacher's code), this will update accordingly.
function setClassroomCode(code, classroomCode) {
  const rec = get(code);
  if (!rec) return false;
  const clean = String(classroomCode || '').trim().toUpperCase();
  if (!clean) return false;
  if (rec.classroomCode !== clean) {
    rec.classroomCode = clean;
    rec.lastSeen = Date.now();
    scheduleSave();
  }
  return true;
}
// Persist the chosen avatar for a student. Avatars are now full-body
// SVG illustrations served from /assets/avatars/<name>.svg. The stored
// value is just the lowercase name (e.g. 'mochi'), which the client
// turns into an URL. Validates against AVATAR_OPTIONS so kids can't
// inject arbitrary paths.
//
// Legacy emoji avatars (from before 2026-05-27) are still accepted as
// fallback display values but new picks always use the SVG set.
// 24 avatars across multiple DiceBear styles so kids can pick something
// that feels like *them*. Mix of cartoon kids (adventurer), robots
// (bottts), aliens/doodles (croodles), emoji-style (fun-emoji), pixel
// art, fantasy (lorelei), and stylized (micah, thumbs, big-ears).
// All SVGs live in public/assets/avatars/<name>.svg.
const AVATAR_OPTIONS = [
  // Cartoon kids (adventurer)
  'mochi', 'dragon', 'stella', 'felix',
  'luna',  'atlas',  'zara',   'kai',
  'mei',   'theo',   'iris',   'nova',
  // Crazy variations — user feedback 2026-05-27: "monkeys, aliens,
  // funny hair, alien — like emojis but cooler."
  'robo',   'cyborg', 'alien',  'blob',
  'monkey', 'ghost',  'pixie',  'wizard',
  'pixel',  'punky',  'panda',  'ninja',
  // 2026-05-28 — wider variety: more heroes, beasts & robots.
  'tiger',  'phoenix', 'knight', 'mecha',
  'yeti',   'fox',     'owl',    'shark',
  'viking', 'galaxy',  'comet',  'boba',
  'lotus',  'ramen',   'koala',  'raptor',
];
function setAvatar(code, avatar) {
  const rec = get(code);
  if (!rec) return false;
  if (!AVATAR_OPTIONS.includes(avatar)) return false;
  rec.avatar = avatar;
  rec.lastSeen = Date.now();
  scheduleSave();
  return true;
}
// Allow renaming. Kids can change their display name from their
// settings page in the homework portal.
function setDisplayName(code, displayName) {
  const rec = get(code);
  if (!rec) return false;
  const clean = String(displayName || '').trim().slice(0, 24);
  if (!clean) return false;
  rec.displayName = clean;
  rec.lastSeen = Date.now();
  scheduleSave();
  return true;
}
// === INBOX / NOTIFICATIONS ============================================
// 2026-05-27: lets a teacher send a message to one student (or broadcast
// to a whole classroom). Each student record carries an `inbox` array
// of message objects. Kids poll /api/homework/inbox; the teacher
// posts via /api/admin/student/:code/message or /api/admin/broadcast.
//
// Message shape:
//   { id, from, fromName, text, actionType, actionUrl, actionLabel,
//     ts, readAt }
//   - actionType 'link' means actionUrl + actionLabel render a button
//   - actionType 'broadcast-warmup' is a special live-session invite
//
// Capped at 50 per student so the JSON doesn't grow unbounded.
function sendMessage(code, payload) {
  const rec = get(code);
  if (!rec) return null;
  if (!Array.isArray(rec.inbox)) rec.inbox = [];
  const msg = {
    id:           'm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
    from:         String(payload.from || ''),
    fromName:     String(payload.fromName || 'Maestro/a'),
    text:         String(payload.text || '').slice(0, 500),
    actionType:   payload.actionType || null,
    actionUrl:    payload.actionUrl || null,
    actionLabel:  payload.actionLabel || null,
    ts:           Date.now(),
    readAt:       null,
  };
  if (!msg.text && !msg.actionUrl) return null;
  rec.inbox.unshift(msg);                          // newest first
  if (rec.inbox.length > 50) rec.inbox = rec.inbox.slice(0, 50);
  rec.lastSeen = Date.now();
  scheduleSave();
  return msg;
}
// Get a student's inbox (newest first).
function getInbox(code, limit) {
  const rec = get(code);
  if (!rec) return [];
  const arr = Array.isArray(rec.inbox) ? rec.inbox.slice() : [];
  return typeof limit === 'number' ? arr.slice(0, limit) : arr;
}
// Mark one message as read (by message id). Returns true on success.
function markMessageRead(code, msgId) {
  const rec = get(code);
  if (!rec || !Array.isArray(rec.inbox)) return false;
  const msg = rec.inbox.find((m) => m.id === msgId);
  if (!msg) return false;
  if (msg.readAt) return true;
  msg.readAt = Date.now();
  scheduleSave();
  return true;
}
// Mark every message as read in one shot (used when the kid opens the inbox).
function markAllMessagesRead(code) {
  const rec = get(code);
  if (!rec || !Array.isArray(rec.inbox)) return 0;
  let changed = 0;
  rec.inbox.forEach((m) => { if (!m.readAt) { m.readAt = Date.now(); changed++; } });
  if (changed) scheduleSave();
  return changed;
}
// Broadcast a message to every student whose classroomCode matches.
// Returns the count of students who received it.
function broadcastToClassroom(classroomCode, payload) {
  const cc = String(classroomCode || '').trim().toUpperCase();
  if (!cc) return 0;
  let count = 0;
  Object.values(records).forEach((rec) => {
    if (rec.classroomCode === cc) {
      if (!Array.isArray(rec.inbox)) rec.inbox = [];
      const msg = {
        id:           'm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7) + '-' + count,
        from:         String(payload.from || ''),
        fromName:     String(payload.fromName || 'Maestro/a'),
        text:         String(payload.text || '').slice(0, 500),
        actionType:   payload.actionType || null,
        actionUrl:    payload.actionUrl || null,
        actionLabel:  payload.actionLabel || null,
        ts:           Date.now(),
        readAt:       null,
        broadcast:    true,
      };
      rec.inbox.unshift(msg);
      if (rec.inbox.length > 50) rec.inbox = rec.inbox.slice(0, 50);
      count++;
    }
  });
  if (count) scheduleSave();
  return count;
}

// Wipe all assignment submissions for a given assignment id under a
// student. Used by the "Reset score" button so a kid can attempt the
// assignment with a fresh slate (best score then comes from the new try).
function resetAssignmentSubmissions(code, assignmentId) {
  const rec = get(code);
  if (!rec || !Array.isArray(rec.assignmentSubmissions)) return 0;
  const before = rec.assignmentSubmissions.length;
  rec.assignmentSubmissions = rec.assignmentSubmissions.filter(
    (s) => s.assignmentId !== assignmentId
  );
  const removed = before - rec.assignmentSubmissions.length;
  if (removed) scheduleSave();
  return removed;
}

function get(code) {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  return records[normalized] || null;
}

// === TEACHER NOTES (for report cards) ===
// The teacher jots short notes/keywords per student per month. The parent
// report card composes prose + a grade from these. Stored on the record.
function addNote(code, { text, grade, month }) {
  const rec = get(code);
  if (!rec) return false;
  if (!Array.isArray(rec.notes)) rec.notes = [];
  const t = String(text || '').trim().slice(0, 400);
  if (!t) return false;
  // month like "2026-05"; default to current month.
  const m = /^\d{4}-\d{2}$/.test(String(month || '')) ? month
          : new Date().toISOString().slice(0, 7);
  rec.notes.push({
    ts: Date.now(),
    text: t,
    grade: (grade != null && grade !== '') ? String(grade).slice(0, 12) : null,
    month: m,
  });
  if (rec.notes.length > 300) rec.notes = rec.notes.slice(-300);
  rec.lastSeen = Date.now();
  scheduleSave();
  return true;
}
function getNotes(code) {
  const rec = get(code);
  return (rec && Array.isArray(rec.notes)) ? rec.notes.slice() : [];
}
function deleteNote(code, ts) {
  const rec = get(code);
  if (!rec || !Array.isArray(rec.notes)) return false;
  const before = rec.notes.length;
  rec.notes = rec.notes.filter((n) => n.ts !== Number(ts));
  if (rec.notes.length < before) { scheduleSave(); return true; }
  return false;
}

// Permanently remove a student record (teacher's Cuaderno). Used to clean
// up duplicates or ban a user. Irreversible — wipes their whole history.
function deleteStudent(code) {
  const normalized = normalizeCode(code);
  if (!normalized || !records[normalized]) return false;
  delete records[normalized];
  scheduleSave();
  return true;
}

// Store best-effort device / country / locale metadata. Sent by the client
// (homework portal) on identify — derived from navigator + timezone since
// we can't read the IP reliably behind Render's proxy. Used by the teacher
// to spot duplicate accounts and, if needed, ban a device.
function setMeta(code, meta) {
  const rec = get(code);
  if (!rec || !meta || typeof meta !== 'object') return false;
  if (meta.country) rec.country = String(meta.country).slice(0, 40);
  if (meta.device)  rec.device  = String(meta.device).slice(0, 60);
  if (meta.locale)  rec.locale  = String(meta.locale).slice(0, 20);
  if (meta.tz)      rec.tz      = String(meta.tz).slice(0, 48);
  rec.lastSeen = Date.now();
  scheduleSave();
  return true;
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

// Append a single sentence to ONE student's history (their own private
// save / edited copy). Mirrors logSentence but for a lone student, and is
// used by wu:save-mine and the homework "save copy" endpoint.
function appendSentence(code, words, pin) {
  const rec = get(code);
  if (!rec) return false;
  if (!Array.isArray(words) || !words.length) return false;
  rec.sentencesBuilt.push({
    ts: Date.now(),
    pin: pin || '',
    words: words.slice(),
    contributors: [rec.code],
  });
  if (rec.sentencesBuilt.length > 200) {
    rec.sentencesBuilt = rec.sentencesBuilt.slice(-200);
  }
  scheduleSave();
  return true;
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
      avatar: r.avatar || null,
      classroomCode: r.classroomCode || null,
      country: r.country || null,
      device: r.device || null,
      locale: r.locale || null,
      tz: r.tz || null,
      firstSeen: r.firstSeen || 0,
      lastSeen: r.lastSeen || 0,
      sentenceCount:   Array.isArray(r.sentencesBuilt)         ? r.sentencesBuilt.length         : 0,
      testCount:       Array.isArray(r.testResults)            ? r.testResults.length            : 0,
      assignmentCount: Array.isArray(r.assignmentSubmissions)  ? r.assignmentSubmissions.length  : 0,
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
  deleteStudent,
  setMeta,
  addNote,
  getNotes,
  deleteNote,
  logSentence,
  appendSentence,
  getHistory,
  deleteHistoryEntry,
  normalizeCode,
  listAll,
  logTestResult,
  getTestResults,
  logAssignmentSubmission,
  getAssignmentSubmissions,
  setAvatar,
  setDisplayName,
  setClassroomCode,
  resetAssignmentSubmissions,
  sendMessage,
  getInbox,
  markMessageRead,
  markAllMessagesRead,
  broadcastToClassroom,
  AVATAR_OPTIONS,
};
