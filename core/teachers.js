// =========================================================================
// teachers.js — multi-teacher accounts + classroom isolation
//
// 2026-05-27: introduces per-teacher data isolation so the platform can
// support multiple teachers (you in Mexico, Maria in China, Wang in
// Taiwan, …) without anyone seeing each other's students.
//
// ── DATA MODEL ───────────────────────────────────────────────────────
// Each teacher has TWO codes:
//   • teacherId   — secret login code (e.g. "EMAAR2026"). Logs into
//                   /maestro to see their students. Never shared with kids.
//   • accessCodes — short classroom code(s) (e.g. "1001"). KIDS type this
//                   on /homework.html to join. Each student record gets
//                   tagged with the code they used to join.
//
// ── AUTH RULES ───────────────────────────────────────────────────────
// • Super admin (isSuperAdmin:true): sees every student, can list/create
//   other teachers. Default seeded super admin is EMAAR2026.
// • Regular teacher: sees only students whose `classroomCode` is in
//   their `accessCodes` array.
// • Legacy passwords (draly2026, WU_ADMIN_PASSWORD env): still grant
//   super-admin access for back-compat with the warmup-mode host page.
//
// ── PHONE SWITCHING ──────────────────────────────────────────────────
// All teacher data lives in data/teachers.json on Render's persistent
// disk. The teacher's localStorage on each device holds only their
// teacherId. Switching phones = re-enter teacherId. No data migration
// (data was never on the phone).
// =========================================================================
'use strict';
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'teachers.json');

// Alphabet for code generation — drops 0/O/1/I/L for legibility
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

let teachers = {};      // teacherId -> Teacher
let saveTimer = null;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
  }
}

function persistNow() {
  ensureDir();
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(teachers, null, 2), 'utf8');
  } catch (e) {
    console.warn('[teachers] failed to persist:', e.message);
  }
}
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, 800);
}

// Seed the file with the super-admin teacher on first boot. After that
// the JSON file lives on the persistent disk and survives deploys.
function seedIfEmpty() {
  if (Object.keys(teachers).length > 0) return;
  const now = Date.now();
  teachers['EMAAR2026'] = {
    teacherId:    'EMAAR2026',
    displayName:  'Sra. Emaar',
    email:        null,
    country:      'MX',
    accessCodes:  ['1001'],
    isSuperAdmin: true,
    createdAt:    now,
    lastSeen:     now,
  };
  persistNow();
  console.log('[teachers] seeded super-admin EMAAR2026 with access code 1001');
}

function load() {
  ensureDir();
  if (!fs.existsSync(FILE_PATH)) {
    teachers = {};
    seedIfEmpty();
    return;
  }
  try {
    const raw = fs.readFileSync(FILE_PATH, 'utf8');
    teachers = JSON.parse(raw) || {};
    console.log('[teachers] loaded', Object.keys(teachers).length, 'teacher accounts');
    seedIfEmpty();
  } catch (e) {
    console.warn('[teachers] failed to load, starting fresh:', e.message);
    teachers = {};
    seedIfEmpty();
  }
}

// === LOOKUPS ===
// Normalize a teacher login code (uppercase, alphanumeric).
function normalizeTeacherId(id) {
  if (!id || typeof id !== 'string') return null;
  return id.toUpperCase().replace(/[^A-Z0-9-]/g, '');
}
// Get a teacher by login code. Returns the full record or null.
function getByTeacherId(id) {
  const n = normalizeTeacherId(id);
  return n ? (teachers[n] || null) : null;
}
// Find which teacher owns a given classroom access code. Returns the
// teacher record or null. Used when a student enters /homework.html and
// types an access code — we figure out which classroom they're joining.
function getByAccessCode(code) {
  const norm = String(code || '').trim().toUpperCase();
  if (!norm) return null;
  for (const t of Object.values(teachers)) {
    if (Array.isArray(t.accessCodes) && t.accessCodes.includes(norm)) {
      return t;
    }
  }
  return null;
}
// Quick boolean — is this a known access code (any teacher's)?
function isAccessCodeValid(code) {
  return !!getByAccessCode(code);
}

// === CODE GENERATION ===
// Random alphanumeric string from the legible alphabet
function randomCode(length) {
  let s = '';
  for (let i = 0; i < length; i++) {
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return s;
}
// Generate a teacher login code — 8 chars, prefixed "T-" so it visually
// reads as a teacher code. Retries on collision (astronomically rare).
function generateTeacherId() {
  for (let i = 0; i < 50; i++) {
    const candidate = 'T-' + randomCode(6);
    if (!teachers[candidate]) return candidate;
  }
  return 'T-' + randomCode(10);  // statistical impossibility fallback
}
// Generate a 4-digit numeric classroom code. Kid-friendly typing.
function generateAccessCode() {
  const used = new Set();
  Object.values(teachers).forEach((t) => {
    (t.accessCodes || []).forEach((c) => used.add(c));
  });
  for (let i = 0; i < 200; i++) {
    const candidate = String(1000 + Math.floor(Math.random() * 9000));
    if (!used.has(candidate)) return candidate;
  }
  return String(Date.now() % 100000);  // fallback if 9000 codes exhausted
}

// === CRUD ===
// Create a new teacher. Returns the new record (with codes filled in).
function createTeacher({ displayName, email, country }) {
  const teacherId = generateTeacherId();
  const accessCode = generateAccessCode();
  const now = Date.now();
  const rec = {
    teacherId,
    displayName: String(displayName || 'Teacher').slice(0, 60),
    email:       email ? String(email).slice(0, 120) : null,
    country:     country ? String(country).slice(0, 3).toUpperCase() : null,
    accessCodes: [accessCode],
    isSuperAdmin: false,
    createdAt:   now,
    lastSeen:    now,
  };
  teachers[teacherId] = rec;
  scheduleSave();
  return rec;
}
// Delete a teacher (super-admin only). Their students get orphaned
// (classroomCode survives on the records but no teacher owns the code).
function deleteTeacher(teacherId) {
  const n = normalizeTeacherId(teacherId);
  if (!n || !teachers[n]) return false;
  if (teachers[n].isSuperAdmin) return false;  // can't delete super admin
  delete teachers[n];
  scheduleSave();
  return true;
}
// Touch lastSeen on each successful login.
function touchLastSeen(teacherId) {
  const t = getByTeacherId(teacherId);
  if (t) { t.lastSeen = Date.now(); scheduleSave(); }
}
// List all teachers (super-admin view)
function listAll() {
  return Object.values(teachers)
    .map((t) => ({
      teacherId: t.teacherId,
      displayName: t.displayName,
      email: t.email,
      country: t.country,
      accessCodes: (t.accessCodes || []).slice(),
      isSuperAdmin: !!t.isSuperAdmin,
      createdAt: t.createdAt,
      lastSeen: t.lastSeen,
    }))
    .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
}

// Initial load on require()
load();

module.exports = {
  load,
  getByTeacherId,
  getByAccessCode,
  isAccessCodeValid,
  createTeacher,
  deleteTeacher,
  touchLastSeen,
  listAll,
  normalizeTeacherId,
};
