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
//   other teachers. Seeded once, on the very first boot of an empty disk.
// • Regular teacher: sees only students whose `classroomCode` is in
//   their `accessCodes` array.
// • The legacy password (WU_ADMIN_PASSWORD env, set on Render; no default
//   since 2026-10-15): still grants super-admin access for back-compat with
//   the warmup-mode host page.
//
// ── CHANGING A CODE (2026-10-15, «Cambiar mi código») ─────────────────
// The super-admin code was exposed in a comment of the public maestro.js, so
// codes can now be changed in /maestro: changeCode() moves the record to the
// new code (same uid, codeGen + 1, so every device remembered with the old one
// asks again), and the old code is RETIRED for good (data/teachers-meta.json
// keeps a hash of it; no teacher can take it again). Each record has a `uid`
// (never shown, never a secret) that cookies and stored references use
// instead of the code. Codes never go into a log line.
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
const crypto = require('crypto');
const Levels = require('./levels');

const DATA_DIR = process.env.DRALY_DATA_DIR || path.join(__dirname, '..', 'data');   // tests: their own folder
const FILE_PATH = path.join(DATA_DIR, 'teachers.json');
// One-shot facts about the teacher table that must survive even if teachers.json is lost or unreadable: a super-admin
// existed once (so the boot seed never runs again) and the hashes of retired codes (never reused).
const META_PATH = path.join(DATA_DIR, 'teachers-meta.json');
let meta = { superAdminSeenAt: 0, retired: [] };
function loadMeta() {
  try { meta = Object.assign({ superAdminSeenAt: 0, retired: [] }, JSON.parse(fs.readFileSync(META_PATH, 'utf8')) || {}); }
  catch (_) { meta = { superAdminSeenAt: 0, retired: [] }; }
  if (!Array.isArray(meta.retired)) meta.retired = [];
}
function saveMeta() {
  ensureDir();
  try { fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2), 'utf8'); }
  catch (e) { console.warn('[teachers] failed to write the meta file:', e.message); }
}
const codeHash = (code) => crypto.createHash('sha256').update('draly-teacher-code:' + normalizeTeacherId(code)).digest('hex').slice(0, 32);
const isRetired = (code) => !!normalizeTeacherId(code) && meta.retired.includes(codeHash(code));
const newUid = () => crypto.randomBytes(9).toString('base64url');
// The first seeded super-admin's code, as a hash (the code itself was exposed and must not live in the source): the
// record still holding it, or null once he changed it.
const ORIGINAL_SEED_HASH = 'c1e9e02a9bfb60fefcdc539ac97f80b3';
const originalSeedId = () => Object.keys(teachers).find((k) => codeHash(k) === ORIGINAL_SEED_HASH) || null;

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

// Seed the super-admin on the VERY FIRST boot of an empty disk only. Never again once a super-admin has existed
// (teachers-meta.json superAdminSeenAt, a one-shot flag — CLAUDE.md "boot migrations only fill what is missing"): a lost
// or unreadable teachers.json must never bring back an old, known code (2026-10-15: the old seeded code had been
// served to everyone in a comment of maestro.js). The code comes from DRALY_SEED_ADMIN_CODE (local tests) or is random,
// and is never printed: sign in with WU_ADMIN_PASSWORD and read it in /maestro → Teachers.
function seedIfEmpty() {
  if (Object.keys(teachers).length > 0) return;
  if (meta.superAdminSeenAt) {
    console.warn('[teachers] no teacher accounts on the disk; the first-boot seed stays off (a super-admin existed before).' +
      ' Sign in with WU_ADMIN_PASSWORD and restore data/teachers.json from a backup.');
    return;
  }
  const now = Date.now();
  const id = normalizeTeacherId(process.env.DRALY_SEED_ADMIN_CODE || '') || generateTeacherId();
  teachers[id] = {
    teacherId:    id,
    uid:          newUid(),
    codeGen:      0,
    displayName:  '🐉 Dralingo 老师',
    email:        null,
    country:      'MX',
    accessCodes:  ['1001', '1002', '1003'],
    codeLevels:   { '1002': 'hsk2', '1003': 'yct1' },   // 1001 defaults to hsk1
    isSuperAdmin: true,
    createdAt:    now,
    lastSeen:     now,
  };
  persistNow();
  console.log('[teachers] first boot: seeded the super-admin (class codes 1001-1003; its teacher code is in /maestro → Teachers)');
}
// After every load: each record gets a uid + codeGen when missing (fill-only), and the one-shot «a super-admin
// existed» flag is written the first time one is seen.
function afterLoad() {
  let dirty = false;
  Object.values(teachers).forEach((t) => {
    if (!t || typeof t !== 'object') return;
    if (!t.uid) { t.uid = newUid(); dirty = true; }
    if (typeof t.codeGen !== 'number') { t.codeGen = 0; dirty = true; }
  });
  if (dirty) persistNow();
  if (!meta.superAdminSeenAt && Object.values(teachers).some((t) => t && t.isSuperAdmin)) {
    meta.superAdminSeenAt = Date.now();
    saveMeta();
  }
}

function load() {
  ensureDir();
  loadMeta();
  if (!fs.existsSync(FILE_PATH)) {
    teachers = {};
    seedIfEmpty();
    if (Object.keys(teachers).length) applyNamedSetup20260923();
    afterLoad();
    return;
  }
  let parsed = null;
  try {
    parsed = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8')) || {};
  } catch (e) {
    // 2026-10-15: never save over an unreadable teacher file (the seed used to overwrite it): keep it aside for recovery
    const aside = FILE_PATH.replace(/\.json$/, '.unreadable-' + Date.now() + '.json');
    try { fs.renameSync(FILE_PATH, aside); } catch (_) { /* ignore */ }
    console.error('[teachers] teachers.json unreadable, kept as', path.basename(aside), '-', e.message);
    teachers = {};
    seedIfEmpty();
    afterLoad();
    return;
  }
  teachers = parsed;
  console.log('[teachers] loaded', Object.keys(teachers).length, 'teacher accounts');
  // The old one-time migrations below look the first seeded super-admin up by its old code (originalSeedId(): only a
  // hash of that code is in the source): they were applied long ago and are no-ops once he changes that code
  // («Cambiar mi código», 2026-10-15). They only fill what is missing. A failing migration keeps every record (it used
  // to start an empty table and seed over the file).
  try {
    seedIfEmpty();
    // One-time migration: rename the old default "Sra. Emaar" to the
    // new "🐉 Dralingo 老师" on the existing persistent-disk record.
    // (The disk already has the old name from the first seed.)
    if (teachers[originalSeedId()] && teachers[originalSeedId()].displayName === 'Sra. Emaar') {
      teachers[originalSeedId()].displayName = '🐉 Dralingo 老师';
      persistNow();
      console.log('[teachers] migrated the super-admin display name → 🐉 Dralingo 老师');
    }
    // 🆕 2026-09-15 — HSK2 door: seed access code 1002 (level hsk2) on the
    // super-admin so teachers can enroll the new HSK2 students today.
    // One-time on the persistent-disk record; harmless if re-run.
    if (teachers[originalSeedId()]) {
      const t = teachers[originalSeedId()];
      let dirty = false;
      t.accessCodes = Array.isArray(t.accessCodes) ? t.accessCodes : [];
      if (!t.accessCodes.includes('1002')) { t.accessCodes.push('1002'); dirty = true; }
      t.codeLevels = (t.codeLevels && typeof t.codeLevels === 'object') ? t.codeLevels : {};
      // only when missing: since 2026-10-12 a code's level can be changed in /maestro and must survive restarts
      if (!t.codeLevels['1002']) { t.codeLevels['1002'] = 'hsk2'; dirty = true; }
      if (dirty) {
        persistNow();
        console.log('[teachers] seeded HSK2 access code 1002 on the super-admin');
      }
    }
    seedYctCode20261012();
    applyNamedSetup20260923();
  } catch (e) {
    console.warn('[teachers] a boot migration failed (accounts kept):', e.message);
  }
  afterLoad();
}

// 🆕 2026-10-12 (Fernando) — YCT door: access code 1003 (level yct1) on the super-admin, like 1002 for New HSK 1.
// Idempotent; skipped with a log line if another teacher already owns 1003.
function seedYctCode20261012() {
  const t = teachers[originalSeedId()];
  if (!t) return;
  const owner = getByAccessCode('1003');
  if (owner && owner !== t) { console.warn('[teachers] class code 1003 belongs to another teacher - YCT code not seeded'); return; }
  t.accessCodes = Array.isArray(t.accessCodes) ? t.accessCodes : [];
  t.codeLevels = (t.codeLevels && typeof t.codeLevels === 'object') ? t.codeLevels : {};
  if (t.accessCodes.includes('1003') && t.codeLevels['1003']) return;   // already there (or re-levelled by him)
  if (!t.accessCodes.includes('1003')) t.accessCodes.push('1003');
  t.codeLevels['1003'] = 'yct1';
  persistNow();
  console.log('[teachers] seeded YCT 1 access code 1003 on the super-admin');
}

// 🆕 2026-09-23 (Fernando) — one-time named-teacher setup, idempotent
// by name-match so re-deploys never duplicate:
//   · Ms Han → her classroom codes default to HSK2
//   · Ms Enni + Ms Nicole → created with BOTH an HSK1 and an HSK2 code
// The exact codes land on the persistent disk; read them in the
// Teachers tab of /maestro (never in the server log: 2026-10-15).
function applyNamedSetup20260923() {
  let dirty = false;
  const han = Object.values(teachers).find((t) => !t.isSuperAdmin && /\bhan\b/i.test(t.displayName || ''));
  if (han) {
    han.codeLevels = (han.codeLevels && typeof han.codeLevels === 'object') ? han.codeLevels : {};
    for (const c of (han.accessCodes || [])) {
      // only codes without a level: levels changed in /maestro (2026-10-12) must survive restarts
      if (!han.codeLevels[c]) { han.codeLevels[c] = 'hsk2'; dirty = true; }
    }
    if (dirty) console.log('[teachers] Ms Han → HSK2 default on classroom code(s):', (han.accessCodes || []).join(', '));
  }
  for (const name of ['Ms Enni', 'Ms Nicole']) {
    const key = name.replace(/^Ms\s+/i, '').toLowerCase();
    const exists = Object.values(teachers).some((t) => (t.displayName || '').toLowerCase().includes(key));
    if (!exists) {
      const rec = createTeacher({ displayName: name, levels: ['hsk1', 'hsk2'] });
      console.log('[teachers] created', name, '(teacher code and class codes in /maestro → Teachers) | class codes:',
        rec.accessCodes.length);
      dirty = true;
    }
  }
  if (dirty) persistNow();
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
// 🆕 2026-09-15 (Fernando) — HSK LEVEL PER ACCESS CODE.
// "What determines that I am HSK1?" — this. Each access code carries a
// level via the teacher's optional `codeLevels` map, e.g.
//   accessCodes: ['1001', '1002'], codeLevels: { '1002': 'hsk2' }
// Unlisted codes default to 'hsk1', so every existing student and
// teacher keeps working untouched. The student's level is stamped at
// /homework entry from the code they typed — new HSK2 kids just get
// the HSK2 code (1002) and the portal reshapes itself.
function levelForAccessCode(code) {
  const norm = String(code || '').trim().toUpperCase();
  const t = getByAccessCode(norm);
  if (t && t.codeLevels && typeof t.codeLevels === 'object') {
    const lvl = Levels.normalize(t.codeLevels[norm]);   // yct1 | hsk2 (New HSK 1) | hsk1 — core/levels.js
    if (lvl) return lvl;
  }
  return Levels.DEFAULT;
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
    if (!teachers[candidate] && !isRetired(candidate)) return candidate;
  }
  return 'T-' + randomCode(10);  // statistical impossibility fallback
}
// A random code of the same shape, for the super-admin's «nuevo código al azar» in /maestro
function suggestCode() { return 'T-' + randomCode(8); }
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
// 🆕 2026-09-23 — `levels` picks which classroom codes to mint: one 4-digit code per level
// (any of core/levels.js: yct1, hsk2 = New HSK 1, hsk1; default hsk1), each written in codeLevels.
function createTeacher({ displayName, email, country, levels }) {
  const teacherId = generateTeacherId();
  const wanted = [...new Set((Array.isArray(levels) ? levels : []).map(Levels.normalize).filter(Boolean))];
  if (!wanted.length) wanted.push(Levels.DEFAULT);
  const accessCodes = [];
  const codeLevels = {};
  for (const lvl of wanted) {
    let code = generateAccessCode();
    while (accessCodes.includes(code)) code = generateAccessCode();   // it only sees saved teachers, not this one
    accessCodes.push(code);
    codeLevels[code] = lvl;
  }
  const now = Date.now();
  const rec = {
    teacherId,
    uid: newUid(),
    codeGen: 0,
    displayName: String(displayName || 'Teacher').slice(0, 60),
    email:       email ? String(email).slice(0, 120) : null,
    country:     country ? String(country).slice(0, 3).toUpperCase() : null,
    accessCodes,
    codeLevels,
    isSuperAdmin: false,
    createdAt:   now,
    lastSeen:    now,
  };
  teachers[teacherId] = rec;
  scheduleSave();
  return rec;
}
// 🆕 2026-10-12 — classroom codes after creation: add one with a level, or change a code's level (the kids who type
// it next time get that level's tareas). Returns the updated listAll() row, or null.
function addAccessCode(teacherId, level) {
  const t = getByTeacherId(teacherId);
  const lvl = Levels.normalize(level);
  if (!t || !lvl) return null;
  const code = generateAccessCode();
  t.accessCodes = Array.isArray(t.accessCodes) ? t.accessCodes : [];
  t.codeLevels = (t.codeLevels && typeof t.codeLevels === 'object') ? t.codeLevels : {};
  t.accessCodes.push(code);
  t.codeLevels[code] = lvl;
  scheduleSave();
  return { code, teacher: row(t) };
}
function setCodeLevel(teacherId, code, level) {
  const t = getByTeacherId(teacherId);
  const lvl = Levels.normalize(level);
  const c = String(code || '').trim().toUpperCase();
  if (!t || !lvl || !(t.accessCodes || []).includes(c)) return null;
  t.codeLevels = (t.codeLevels && typeof t.codeLevels === 'object') ? t.codeLevels : {};
  t.codeLevels[c] = lvl;
  scheduleSave();
  return row(t);
}
// 🆕 2026-10-15 «Cambiar mi código». The rules for a new teacher code: 8-24 characters after normalizing (letters,
// numbers and dashes), at least one letter and one number, not a class code, not another teacher's code, not a code
// that was ever retired. → { ok: true, code } | { ok: false, error } (Spanish, shown to the teacher).
function validateNewCode(raw, forTeacherId) {
  const code = normalizeTeacherId(String(raw || '').trim());
  if (!code || code.replace(/-/g, '').length < 8) return { ok: false, error: 'El código necesita al menos 8 letras o números.' };
  if (code.length > 24) return { ok: false, error: 'El código puede tener 24 caracteres como máximo.' };
  if (!/[A-Z]/.test(code) || !/[0-9]/.test(code)) return { ok: false, error: 'Usa letras y números juntos (por ejemplo, una palabra y unos números).' };
  const self = getByTeacherId(forTeacherId);
  if (self && self.teacherId === code) return { ok: false, error: 'Ese ya es el código actual.' };
  if (teachers[code] || isRetired(code)) return { ok: false, error: 'Ese código no se puede usar. Elige otro.' };
  if (getByAccessCode(code)) return { ok: false, error: 'Ese es un código de clase. Elige otro.' };
  if (process.env.WU_ADMIN_PASSWORD && normalizeTeacherId(process.env.WU_ADMIN_PASSWORD) === code) return { ok: false, error: 'Ese código no se puede usar. Elige otro.' };
  return { ok: true, code };
}
// Move a teacher to a new code: same record and uid, codeGen + 1 (devices remembered with the old code ask again),
// the old code retired for good (it stops working at once and can never be taken again). Custom assignments that
// stored the old code follow (onRename hook from server.js). → { ok, teacher } | { ok: false, error }
function changeCode(teacherId, newCodeRaw, onRename) {
  const t = getByTeacherId(teacherId);
  if (!t) return { ok: false, error: 'No encontramos a esa maestra o maestro.' };
  const v = validateNewCode(newCodeRaw, t.teacherId);
  if (!v.ok) return v;
  const old = t.teacherId;
  delete teachers[old];
  t.teacherId = v.code;
  t.codeGen = (Number(t.codeGen) || 0) + 1;
  t.codeChangedAt = Date.now();
  if (!t.uid) t.uid = newUid();
  teachers[v.code] = t;
  if (!meta.retired.includes(codeHash(old))) meta.retired.push(codeHash(old));
  saveMeta();
  persistNow();                                    // at once: a restart right after must already know the new code
  try { if (typeof onRename === 'function') onRename(old, v.code); } catch (e) { console.warn('[teachers] rename hook failed:', e.message); }
  console.log('[teachers] a teacher code was changed (' + (t.isSuperAdmin ? 'super-admin' : 'teacher') + ', ' + String(t.displayName || '').slice(0, 30) + ')');
  return { ok: true, teacher: row(t) };
}
function getByUid(uid) {
  if (!uid || typeof uid !== 'string') return null;
  return Object.values(teachers).find((t) => t && t.uid === uid) || null;
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
function row(t) {
  return {
    teacherId: t.teacherId,
    displayName: t.displayName,
    email: t.email,
    country: t.country,
    accessCodes: (t.accessCodes || []).slice(),
    codeLevels: Object.assign({}, t.codeLevels || {}),
    isSuperAdmin: !!t.isSuperAdmin,
    createdAt: t.createdAt,
    lastSeen: t.lastSeen,
  };
}
function listAll() {
  return Object.values(teachers).map(row).sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
}

// Initial load on require() — wrapped so a disk-permission issue or
// corrupt JSON can never crash server boot. Worst case: teachers is
// an empty object (no super admin) until the first successful save.
try { load(); } catch (e) {
  console.error('[teachers] load() crashed at boot:', e.message);
  teachers = {};
}

module.exports = {
  load,
  getByTeacherId,
  getByAccessCode,
  isAccessCodeValid,
  levelForAccessCode,
  createTeacher,
  addAccessCode,
  setCodeLevel,
  deleteTeacher,
  touchLastSeen,
  listAll,
  normalizeTeacherId,
  getByUid,
  changeCode,
  validateNewCode,
  suggestCode,
  isRetired,
};
