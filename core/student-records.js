// =========================================================================
// student-records.js — persistent per-student tracking
// Each student is identified by a stable 4-character alphanumeric CODE.
// The kid's phone stores the code in localStorage so the same phone always
// maps to the same record across sessions, server restarts, and class days.
//
// Storage: a single JSON file at data/student-records.json (auto-created).
// Writes are debounced 1 second so a flurry of activity doesn't thrash disk.
// 2026-10-18: six-character codes too (automatic accounts, createAuto; accounts made with the level key at /homework,
// createByKey / claimByKey: `byKey`, server.js «LA ENTRADA»).
// =========================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const Levels = require('./levels');
const Saga = require('../public/js/saga');   // the saga avatars (2026-10-12)

const DATA_DIR = process.env.STUDENT_DATA_DIR || process.env.DRALY_DATA_DIR || path.join(__dirname, '..', 'data');   // tests point it at a temp folder
const FILE_PATH = path.join(DATA_DIR, 'student-records.json');
// Code alphabet — avoids confusing chars (0/O, 1/I/l) so kids reading
// codes off a phone screen don't mis-type them.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

let records = {};        // code → { code, displayName, firstSeen, lastSeen, sentencesBuilt: [] }
let saveTimer = null;

// 🆕 2026-10-12 (his rule) — accounts with no activity for ARCHIVE_AFTER_DAYS move out of the live file into
// data/student-archive.json (same disk), and come back by themselves the moment anything looks their code up (the kid
// types it, a PIN join, a parent link). Nothing is deleted: the live file stays small and the teacher's list clean.
const ARCHIVE_PATH = path.join(DATA_DIR, 'student-archive.json');
const ARCHIVE_AFTER_DAYS = 30;
let archive = {};                // code → record (kept in memory like the live ones: a restore costs nothing)
let archiveDirty = false;        // the archive file must be rewritten (always AFTER the live file is safely written)
let archiveBroken = false;       // the archive file exists but can't be read: never overwrite it, never archive

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { /* ignore */ }
  }
}

function load() {
  ensureDir();
  records = {};
  if (fs.existsSync(FILE_PATH)) {
    let parsed = null;
    try {
      parsed = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8')) || {};
    } catch (e) {
      // 2026-10-12: never save over an unreadable student file (the next save used to wipe every account): keep it
      // aside for recovery and start with an empty map
      const aside = FILE_PATH.replace(/\.json$/, '.unreadable-' + Date.now() + '.json');
      try { fs.renameSync(FILE_PATH, aside); } catch (_) { /* ignore */ }
      console.error('[students] student file unreadable, kept as', path.basename(aside), '-', e.message);
    }
    if (parsed) {
      records = parsed;
      console.log('[students] loaded', Object.keys(records).length, 'student records');
      try { bootMigrations(); } catch (e) { console.warn('[students] a boot migration failed (records kept):', e.message); }
    }
  }
  loadArchive();
}

function bootMigrations() {
  {
    // 🆕 2026-06-04 v4 (Fernando bug): one-shot migration to UN-corrupt
    // records where displayName === code (the kid's name got clobbered
    // to their code by the unguarded getOrCreate or HSK heartbeat
    // fallback before today's fix). We set displayName to an empty
    // string — that way the next join with a real name will heal the
    // record (the join's guard treats empty existing displayName as
    // "ok to update with anything"). If the kid never re-joins, the
    // Cuaderno UI already falls back to displaying the code, so empty
    // displayName isn't a visible regression.
    let migrated = 0;
    Object.values(records).forEach((rec) => {
      if (rec && rec.code && rec.displayName
          && String(rec.displayName).toUpperCase() === String(rec.code).toUpperCase()) {
        rec.displayName = '';
        migrated++;
      }
    });
    if (migrated) {
      console.log('[students] un-corrupted', migrated, 'records whose displayName was the code');
      scheduleSave();
    }
    // 🆕 2026-10-12 — brand avatars (gojo, pikachu…) no longer exist: each becomes its saga replacement
    // (public/js/saga.js LEGACY_AVATARS). Only removed ids are touched, so it is a no-op after the first boot.
    let avMoved = 0;
    Object.values(records).forEach((rec) => {
      const to = rec && Saga.legacyAvatar(rec.avatar);
      if (to) { rec.avatar = to; avMoved++; }
    });
    if (avMoved) {
      console.log('[students] moved', avMoved, 'brand avatars to the saga');
      scheduleSave();
    }
    // 🆕 2026-10-12 — the reading story «Lǎoshī Yugi» became «Lǎoshī Dralingo» (same id): saved attempts keep their
    // scores, but their stored title / questions / choices stop saying Yugi (parents' view, «revisar errores»).
    // Only touches text that still contains «Yugi», so it is a no-op after the first boot.
    const deYugi = (v) => (typeof v === 'string' ? v.replace(/\bYugi\b/g, 'Dralingo') : v);
    let tests = 0;
    Object.values(records).forEach((rec) => {
      (rec && Array.isArray(rec.testResults) ? rec.testResults : []).forEach((t) => {
        if (!t || t.storyId !== 'yugipharaoh') return;
        const before = JSON.stringify(t);
        t.storyTitle = deYugi(t.storyTitle);
        (Array.isArray(t.breakdown) ? t.breakdown : []).forEach((b) => {
          if (!b || typeof b !== 'object') return;
          Object.keys(b).forEach((k) => {
            if (typeof b[k] === 'string') b[k] = deYugi(b[k]);
            else if (Array.isArray(b[k])) b[k] = b[k].map(deYugi);
          });
        });
        if (JSON.stringify(t) !== before) tests++;
      });
    });
    if (tests) {
      console.log('[students] renamed Yugi → Dralingo in', tests, 'saved reading results');
      scheduleSave();
    }
  }
}

function writeAtomic(file, text) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, file);                      // a crash mid-write never leaves a cut-off file
}

// Write the live file (compact JSON, atomic), then the archive if it changed. The live file always goes first: an
// account moving back from the archive is safe on disk before the archive lets it go. Returns false if the live
// write failed.
function persistNow() {
  ensureDir();
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  try {
    writeAtomic(FILE_PATH, JSON.stringify(records));
  } catch (e) {
    console.warn('[students] failed to persist:', e.message);
    return false;
  }
  if (archiveDirty && !archiveBroken) {
    try { writeAtomic(ARCHIVE_PATH, JSON.stringify(archive)); archiveDirty = false; }
    catch (e) { console.warn('[students] failed to write the archive (will retry):', e.message); }
  }
  return true;
}

// === ARCHIVE (inactive accounts) ===
const sameAccount = (a, b) => (Number(a && a.firstSeen) || 0) === (Number(b && b.firstSeen) || 0);
function loadArchive() {
  archive = {};
  archiveDirty = false;
  if (!fs.existsSync(ARCHIVE_PATH)) { archiveBroken = false; return; }
  try {
    archive = JSON.parse(fs.readFileSync(ARCHIVE_PATH, 'utf8')) || {};
    archiveBroken = false;
  } catch (e) {
    archiveBroken = true;
    archive = {};
    console.warn('[students] archive unreadable, archiving is off until it is fixed:', e.message);
    return;
  }
  // A code in both files: the same account (crash between two writes) → the live copy wins. A DIFFERENT account (the
  // code was handed out again while the archive was unreadable) → the archived one is kept under code~firstSeen, so no
  // history is ever dropped (it can be merged by hand).
  Object.keys(archive).forEach((c) => {
    if (!records[c]) return;
    if (!sameAccount(records[c], archive[c])) {
      archive[c + '~' + (Number(archive[c].firstSeen) || 0)] = archive[c];
      console.warn('[students] code', c, 'is used by two different accounts: the archived one kept as', c + '~' + archive[c].firstSeen);
    }
    delete archive[c];
    archiveDirty = true;
  });
  if (archiveDirty) scheduleSave();
  const n = Object.keys(archive).length;
  if (n) console.log('[students]', n, 'accounts in the archive');
}
// an automatic account (2026-10-18) with no class code and nothing done on it: no seals or practice, no homework mark,
// no exam try, no homework round, no sentence, no points
function emptyAuto(rec) {
  if (!rec || !rec.auto || rec.classroomCode) return false;
  const has = (v) => (Array.isArray(v) ? v.length > 0 : !!(v && typeof v === 'object' && Object.keys(v).length));
  return !has(rec.ruta) && !has(rec.tareas) && !has(rec.hskResults) && !has(rec.assignmentSubmissions) &&
    !has(rec.sentencesBuilt) && !has(rec.testResults) && !(Number(rec.xp) > 0);
}
function lastActive(rec) {
  return Math.max(Number(rec && rec.lastSeen) || 0, Number(rec && rec.firstSeen) || 0, Number(rec && rec.restoredAt) || 0);
}
// Bring an archived account back (kid login, PIN join, parent link, teacher push). Instant: the archive is in memory;
// the next save writes the live file first, then the trimmed archive.
function restoreArchived(code) {
  if (!code || records[code] || archiveBroken || !archive[code]) return null;
  const rec = archive[code];
  delete archive[code];
  rec.restoredAt = Date.now();                   // counts as activity: it isn't archived again tomorrow
  const av = Saga.legacyAvatar(rec.avatar);      // boot migrations only ran on live accounts
  if (av) rec.avatar = av;
  records[code] = rec;
  archiveDirty = true;
  scheduleSave();
  console.log('[students] an account came back from the archive');   // (2026-10-18: never a student code in the log)
  return rec;
}
// Move every account with no activity for `days` days into the archive. Order on disk: the archive (with them) first,
// then the live file (without them); if the live write fails they go straight back. Returns { moved, archived }.
function archiveInactive(days, now) {
  days = Number(days) || ARCHIVE_AFTER_DAYS;
  now = Number(now) || Date.now();
  if (archiveBroken) return { moved: 0, archived: 0, error: 'archive unreadable' };
  // a restore waiting for its save (≤ 1 s) must reach the live file before the archive is rewritten without it
  if ((saveTimer || archiveDirty) && !persistNow()) return { moved: 0, archived: Object.keys(archive).length, error: 'live file not written' };
  const cutoff = now - days * 86400e3;
  const moving = Object.keys(records).filter((c) => lastActive(records[c]) < cutoff);
  // (2026-10-18) automatic accounts nobody used rest in the archive like every other account: his rule «inactive
  // accounts are archived, never deleted» (the security review suggested removing them; kept as a count only, to watch)
  const empty = moving.filter((c) => emptyAuto(records[c])).length;
  if (!moving.length) return { moved: 0, archived: Object.keys(archive).length };
  const out = moveToArchive(moving);
  if (empty) out.emptyAuto = empty;
  if (out.moved) console.log('[students] archived', out.moved, 'accounts inactive', days, 'days ·', out.archived, 'in the archive' + (empty ? ' · ' + empty + ' of them automatic and never used' : ''));
  return out;
}
// The live accounts `moving` go to the archive, safely: the archive (with them) is written and read back first, then
// the live file (without them); if the live write fails they go straight back. → { moved, archived, error? }
function moveToArchive(moving) {
  moving.forEach((c) => { archive[c] = records[c]; });
  try {
    ensureDir();
    writeAtomic(ARCHIVE_PATH, JSON.stringify(archive));
    const check = JSON.parse(fs.readFileSync(ARCHIVE_PATH, 'utf8'));
    const missing = moving.filter((c) => !check[c]);
    if (missing.length) throw new Error(missing.length + ' accounts missing after writing');
  } catch (e) {
    moving.forEach((c) => { delete archive[c]; });
    archiveDirty = true;
    console.warn('[students] archive write failed, nothing archived:', e.message);
    return { moved: 0, archived: Object.keys(archive).length, error: e.message };
  }
  archiveDirty = false;
  moving.forEach((c) => { delete records[c]; });
  if (!persistNow()) {                            // live file not written: keep them live (the archive copy is the same)
    moving.forEach((c) => { records[c] = archive[c]; delete archive[c]; });
    archiveDirty = true;
    return { moved: 0, archived: Object.keys(archive).length, error: 'live file not written' };
  }
  return { moved: moving.length, archived: Object.keys(archive).length };
}
// 🆕 2026-10-18 (automatic accounts): ONE account to the archive now (an automatic account whose progress moved into
// the kid's real account, «Pasar mi progreso a esta cuenta»). `stamp` is written on it first (e.g. { mergedInto,
// mergedAt }). Like every archived account it comes back if its code is used again. → { moved, archived, error? }
function archiveOne(code, stamp) {
  const c = normalizeCode(code);
  if (!c || !records[c]) return { moved: 0, archived: Object.keys(archive).length, error: 'not a live account' };
  if (archiveBroken) return { moved: 0, archived: 0, error: 'archive unreadable' };
  if ((saveTimer || archiveDirty) && !persistNow()) return { moved: 0, archived: Object.keys(archive).length, error: 'live file not written' };
  if (stamp && typeof stamp === 'object') Object.assign(records[c], stamp);
  const out = moveToArchive([c]);
  if (out.moved) console.log('[students] archived 1 account (' + ((stamp && stamp.archivedWhy) || 'by hand') + ')');
  return out;
}
// An account as it is now, live or resting in the archive, WITHOUT bringing it back (get() restores an archived one:
// right for a kid typing their code, wrong for a page view). → { rec, archived } | null. Read-only: never write to it.
function peek(code) {
  const c = normalizeCode(code);
  if (!c) return null;
  if (records[c]) return { rec: records[c], archived: false };
  if (archive[c]) return { rec: archive[c], archived: true };
  return null;
}
// 🆕 2026-10-18 (his words: "make the system automatically give them an account"): an account La Ruta Dorada makes by
// itself at a visitor's first real step (a level key, a seal, a training round, a homework mark; server.js
// /api/ruta/auto decides). The same shape and code generator as a /homework login (getOrCreate), plus
//   auto: true      the system made it (the /maestro roster shows «automática» while it has no class code)
//   autoStep        what made it ('key' | 'seal' | 'train' | 'tarea')
//   autoName: true  its name is the friendly placeholder (never «Anon»), until the family types the kid's name
// No class code (a class code login at /homework claims it, see server.js). → the record
// (security review 2026-10-18: six characters with a digit, generateCode(6, true): an unclaimed automatic account has no
// class code to bind it, so its code alone must not be guessable)
function createAuto(name, level, step) {
  const code = generateCode(6, true);
  const rec = { code, displayName: String(name || '').slice(0, 24), avatar: null, classroomCode: null, classroomId: null,
    firstSeen: Date.now(), lastSeen: Date.now(), sentencesBuilt: [] };   // (the shape of getOrCreate's new record)
  records[code] = rec;
  rec.auto = true;
  rec.autoStep = String(step || '').slice(0, 8);
  rec.autoName = true;
  if (level) setLevel(rec.code, level);
  scheduleSave();
  return rec;
}
// «Pasar mi progreso a esta cuenta» (security review L3, 2026-10-18): the automatic account's exam tries and homework
// rounds MOVE into the kid's real account (an exam taken in a room never disappears from it); each try keeps its moment
// and says where it came from (migratedFrom, like migrateHskAttempt). → { tries, homework } moved
function moveResults(fromCode, toCode) {
  const from = get(fromCode), to = get(toCode);
  if (!from || !to || from.code === to.code) return { tries: 0, homework: 0 };
  const out = { tries: 0, homework: 0 };
  const now = Date.now();
  if (Array.isArray(from.hskResults) && from.hskResults.length) {
    if (!Array.isArray(to.hskResults)) to.hskResults = [];
    from.hskResults.forEach((t) => { if (t && typeof t === 'object') { to.hskResults.push(Object.assign({}, t, { migratedFrom: from.code, migratedAt: now })); out.tries++; } });
    from.hskResults = [];
  }
  if (Array.isArray(from.assignmentSubmissions) && from.assignmentSubmissions.length) {
    if (!Array.isArray(to.assignmentSubmissions)) to.assignmentSubmissions = [];
    from.assignmentSubmissions.forEach((s) => { if (s && typeof s === 'object') { to.assignmentSubmissions.push(s); out.homework++; } });
    to.assignmentSubmissions.sort((a, b) => (Number(a.ts) || 0) - (Number(b.ts) || 0));
    from.assignmentSubmissions = [];
  }
  if (out.tries || out.homework) scheduleSave();
  return out;
}
// the kid's real name typed on La Ruta Dorada (or at /homework): the placeholder is gone for good
function setRealName(code, displayName) {
  if (!setDisplayName(code, displayName)) return false;
  const rec = get(code);
  if (rec && rec.autoName) { delete rec.autoName; scheduleSave(); }
  return true;
}
// 🆕 2026-10-18 · «Mi Dralingo», la entrada (his pick: "the level key is the family's one password"): an account the
// family makes at /homework with the level key the teacher sent («Soy nuevo»), server.js «LA ENTRADA» decides.
//   byKey: <when>   made (or claimed) with a level key: it answers ONLY to its own session or the phone holding it (the
//                   `dkid` cookie), or to its code + the level key on a new phone; never to a class code + its code
// The same shape and code generator as an automatic account (six characters with a digit: nothing but the key binds
// it), the kid's real name and avatar, its level (the key's), NO class code (a teacher's PIN room tags it later).
function createByKey(name, avatar, level) {
  const code = generateCode(6, true);
  const rec = { code, displayName: String(name || '').slice(0, 24), avatar: AVATAR_OPTIONS.includes(avatar) ? avatar : null,
    classroomCode: null, classroomId: null, firstSeen: Date.now(), lastSeen: Date.now(), sentencesBuilt: [] };
  records[code] = rec;
  rec.byKey = Date.now();
  if (level) setLevel(rec.code, level);
  scheduleSave();
  return rec;
}
// An AUTOMATIC account (createAuto) becomes the kid's key account: «Soy nuevo» on the phone that holds it (its progress is
// never split) or its code + the level key. It stops being automatic (`wasAuto` keeps where it came from); name and avatar
// only when given (a code + key login keeps what it has). → the record, or null
function claimByKey(code, o) {
  const rec = get(code);
  if (!rec) return null;
  const opts = o || {};
  if (rec.auto) { rec.wasAuto = rec.autoStep || true; delete rec.auto; delete rec.autoStep; }
  rec.byKey = rec.byKey || Date.now();
  if (opts.name) { rec.displayName = String(opts.name).slice(0, 24); delete rec.autoName; }
  if (opts.avatar && AVATAR_OPTIONS.includes(opts.avatar)) rec.avatar = opts.avatar;
  if (opts.level) setLevel(rec.code, opts.level);
  rec.lastSeen = Date.now();
  scheduleSave();
  return rec;
}
// 🔒 2026-10-18 (security review F2) «Cerrar su sesión en todos los teléfonos» (/maestro, super admin): every session and
// remembered phone (dkid) of this kid stops; they come back with their code + the level key. → the new generation or null
function bumpKidGen(code) {
  const rec = get(code);
  if (!rec) return null;
  rec.kidGen = (Number(rec.kidGen) || 0) + 1;
  scheduleSave();
  return rec.kidGen;
}
// Counts for /api/_diag and the teacher dashboard. `classroomCodes` (a Set) limits the count to one teacher's classes.
function archiveStats(classroomCodes) {
  let bytes = 0;
  try { bytes = fs.existsSync(ARCHIVE_PATH) ? fs.statSync(ARCHIVE_PATH).size : 0; } catch (_) { /* ignore */ }
  const recs = Object.values(archive);
  const archived = classroomCodes ? recs.filter((r) => r && classroomCodes.has(r.classroomCode)).length : recs.length;
  return { archived, bytes, broken: archiveBroken, afterDays: ARCHIVE_AFTER_DAYS };
}

// Debounce writes so a class building 50 sentences/minute doesn't thrash
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, 1000);
}

// Generate a fresh unique 4-character code. ~30M possibilities, collision
// is astronomically rare but we check anyway.
// 2026-10-18 (security review): `len` 6 + `digit` for the automatic accounts (server.js): six characters of the same
// alphabet with at least one digit (~880 million codes, and never mistaken for a typed name at /homework).
function generateCode(len, digit) {
  const n = len || 4;
  const pick = () => ALPHABET[require('crypto').randomInt(ALPHABET.length)];
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = '';
    for (let i = 0; i < n; i++) code += pick();
    if (digit && !/[2-9]/.test(code)) continue;
    if (!records[code] && !archive[code]) return code;   // an archived kid keeps their code
  }
  // Fallback to one more character on the cosmically-unlikely path
  let code = '';
  for (let i = 0; i < n + 1; i++) code += pick();
  return digit && !/[2-9]/.test(code) ? code.slice(0, -1) + '7' : code;
}

// Sanitize an incoming code (uppercase, alphanumeric only, 4-5 chars; 6 since 2026-10-18: the automatic accounts).
function normalizeCode(code) {
  if (!code || typeof code !== 'string') return null;
  const cleaned = code.toUpperCase().replace(/[^A-Z2-9]/g, '');
  if (cleaned.length < 4 || cleaned.length > 6) return null;
  return cleaned;
}

// Get or create a student record. Returns the record (always non-null).
// 🆕 PIN-JOIN provisioning helper. The HSK PIN-room flow doesn't go
// through the homework gate, so kids can type ANY studentCode that
// doesn't yet exist in our records. Without this, their test results
// would have nowhere to land (root cause of the user's "PIN joiners
// don't have a profile" complaint).
//
// This creates a record using the EXACT typed code as the record key
// (so the kid's subsequent visits reuse the same record), tags it as
// a PIN-provisioned guest, and stamps it with the classroom code we
// can derive from the room. Teacher sees it in the Cuaderno with a
// 👤 badge and can rename or merge later.
function getOrProvisionForPin(typedCode, displayName, classroomCode) {
  const normalized = normalizeCode(typedCode);
  if (normalized) restoreArchived(normalized);   // a kid back after 30+ days gets their own account back
  if (normalized && records[normalized]) {
    const rec = records[normalized];
    // 🆕 2026-06-04 v3 (Fernando bug): do NOT overwrite an existing
    // good displayName with the studentCode used as fallback. When a
    // kid joins via PIN and no real name was passed in the URL, the
    // server resolves displayName ← studentCode as a placeholder.
    // Without this guard, that placeholder OVERWRITES the kid's real
    // name on every join, "changing names to codes on the whole
    // platform." The guard: only update if the new name is a real
    // name (not equal to the kid's code) OR the existing displayName
    // is itself the code (i.e., legacy guest record that needs an
    // upgrade).
    if (displayName) {
      const clean = String(displayName).slice(0, 24);
      const isCodePlaceholder = clean.toUpperCase() === rec.code.toUpperCase();
      const existingIsCode = !rec.displayName || rec.displayName.toUpperCase() === rec.code.toUpperCase();
      if (!isCodePlaceholder || existingIsCode) {
        rec.displayName = clean;
      }
    }
    // (2026-10-18: an UNCLAIMED automatic account is never tagged by a PIN join: only the phone holding it, at
    // /homework, claims it with a class code; its results still land on it)
    if (classroomCode && !rec.classroomCode && !rec.auto) rec.classroomCode = String(classroomCode).trim().toUpperCase();
    rec.lastSeen = Date.now();
    scheduleSave();
    return rec;
  }
  // Create using the typed code AS the record code — so the kid can
  // come back and join the same record by typing the same thing.
  const useCode = normalized || generateCode();
  const rec = {
    code: useCode,
    displayName: displayName ? String(displayName).slice(0, 24) : (typedCode || 'Anon'),
    avatar: null,
    classroomCode: classroomCode ? String(classroomCode).trim().toUpperCase() : null,
    firstSeen: Date.now(),
    lastSeen: Date.now(),
    sentencesBuilt: [],
    isGuestPinJoin: true,           // teacher-facing flag: 👤 badge
  };
  records[useCode] = rec;
  scheduleSave();
  return rec;
}

// If a known code is passed, returns the existing record. Otherwise
// creates a new one with the given displayName and a fresh code.
function getOrCreate(code, displayName) {
  const normalized = normalizeCode(code);
  if (normalized) restoreArchived(normalized);
  if (normalized && records[normalized]) {
    const rec = records[normalized];
    // 🆕 2026-06-04 v4 (Fernando bug — same root cause as
    // getOrProvisionForPin): NEVER overwrite a real name with the
    // kid's own code. When the kid's localStorage has stale data,
    // or when the HSK heartbeat falls back to studentCode-as-name,
    // the join would pass name === code; without this guard, every
    // subsequent join re-corrupts the displayName.
    if (displayName) {
      const clean = String(displayName).slice(0, 24);
      const isCodePlaceholder = clean.toUpperCase() === rec.code.toUpperCase();
      const existingIsCode = !rec.displayName || rec.displayName.toUpperCase() === rec.code.toUpperCase();
      if (!isCodePlaceholder || existingIsCode) {
        rec.displayName = clean;
      }
    }
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
    classroomId: null,            // 🆕 teacher-managed classroom (classrooms.js).
                                  // Set ONLY by the teacher; login never touches
                                  // it. null = grouped by access code by default.
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
// 🆕 2026-09-15 — HSK level per student, stamped at every /homework entry
// from the access code they typed (Teachers.levelForAccessCode). So a kid
// who moves up just starts using the HSK2 code and their portal reshapes.
// Absent/legacy records read as 'hsk1'.
// `previous`: the level an old record without one had (its class code's), so a change from it is dated too.
function setLevel(code, level, previous) {
  const rec = get(code);
  if (!rec) return false;
  const clean = Levels.normalize(level);   // yct1 | hsk2 (New HSK 1) | hsk1 — core/levels.js
  if (!clean) return false;
  if (rec.level !== clean) {
    // 2026-10-15: when the level changed (core/level-keys.js: a kid who moves to a level after the keys went live
    // needs that level's key; their old level stays open)
    // (a record that never had a level nor a class code gets its level now: dated too, so it is never "kept from
    // before the keys" for whichever level its first login happens to pick)
    const before = Levels.normalize(rec.level) || Levels.normalize(previous);
    if (!before || before !== clean) rec.levelSince = Date.now();
    rec.level = clean;
    scheduleSave();
  }
  return true;
}
// 🆕 2026-10-15 (La Ruta Dorada) — a level opened on the kid's ACCOUNT (any device): the key typed while logged in
// ('key', with the level's device generation `gen`: «Cerrar en todos los aparatos» ends it), a teacher's «Desbloquear»
// ('teacher'), or kept from before the keys went live ('grandfathered'). core/level-keys.js decides; this only stores.
// A teacher or grandfathered grant is never replaced; a key grant is renewed (or upgraded to those two).
function setLevelAccess(code, level, via, gen) {
  const rec = get(code);
  const clean = Levels.normalize(level);
  if (!rec || !clean) return false;
  if (!rec.levelAccess || typeof rec.levelAccess !== 'object') rec.levelAccess = {};
  const cur = rec.levelAccess[clean];
  const how = String(via || 'key').slice(0, 16);
  if (cur && cur.via !== 'key') return true;
  if (cur && how === 'key' && Number(cur.gen || 1) === Number(gen || 1)) return true;
  rec.levelAccess[clean] = how === 'key' ? { via: how, at: Date.now(), gen: Number(gen) || 1 } : { via: how, at: Date.now() };
  scheduleSave();
  return true;
}
// 🆕 2026-10-16 (La Ruta Dorada, phase 3) — the kid's progress on La Ruta Dorada, per level: rec.ruta[level] (the
// «¡Me la sé!» seals, a teacher's «Desbloquear» of El Entrenamiento worlds or El Simulacro Dorado, practice per world).
// core/ruta-progress.js decides what goes in; this only finds the record (an archived kid comes back), hands the
// level's entry to `mutate`, drops what ends up empty, and saves. opts.activity: the kid did it (counts as activity,
// so the account is not archived). → the record, or null.
function updateRuta(code, level, mutate, opts) {
  const rec = get(code);
  const lvl = Levels.normalize(level);
  if (!rec || !lvl || typeof mutate !== 'function') return null;
  const all = rec.ruta && typeof rec.ruta === 'object' && !Array.isArray(rec.ruta) ? rec.ruta : {};
  const e = all[lvl] && typeof all[lvl] === 'object' && !Array.isArray(all[lvl]) ? all[lvl] : {};
  mutate(e);
  if (Object.keys(e).some((k) => k !== 'at')) all[lvl] = e; else delete all[lvl];
  if (Object.keys(all).length) rec.ruta = all; else delete rec.ruta;
  if (opts && opts.activity) { rec.lastSeen = Date.now(); _studyDay(rec); }   // (a seal or a practice: a day of «N días seguidos»)
  scheduleSave();
  return rec;
}
// 🆕 2026-10-18 (La Ruta Dorada redesign) — the kid's homework audio marks: rec.tareas = { '<homework id>': { h: <when
// the audio was first played>, s: <when they tapped «¡Ya la mandé!»> } } (ids of public/assets/audios/catalog.json).
// server.js checks the ids and who asks; this only finds the record (an archived kid comes back), hands the map to
// `mutate`, drops empty entries and saves only when something changed (a repeated tap writes nothing and is not
// activity). opts.activity: the kid did it (counts as activity). → the record, or null.
function updateTareas(code, mutate, opts) {
  const rec = get(code);
  if (!rec || typeof mutate !== 'function') return null;
  const before = JSON.stringify(rec.tareas || null);
  const all = rec.tareas && typeof rec.tareas === 'object' && !Array.isArray(rec.tareas) ? JSON.parse(before) : {};
  mutate(all);
  Object.keys(all).forEach((k) => { const e = all[k]; if (!e || typeof e !== 'object' || (!e.h && !e.s)) delete all[k]; });
  const after = Object.keys(all).length ? all : null;
  if (JSON.stringify(after) === before) return rec;
  if (after) rec.tareas = after; else delete rec.tareas;
  if (opts && opts.activity) { rec.lastSeen = Date.now(); _studyDay(rec); }   // (a homework mark: a day of «N días seguidos»)
  scheduleSave();
  return rec;
}
// 🆕 2026-06-21 (Fernando) — teacher-managed classroom. Sets the student's
// classroomId (a classrooms.js id, or '' to unassign). Unlike setClassroomCode
// this is NEVER touched by login, so the teacher's filing sticks.
function setClassroomId(code, classroomId) {
  const rec = get(code);
  if (!rec) return false;
  rec.classroomId = classroomId ? String(classroomId).trim() : null;
  scheduleSave();
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
// 2026-10-12 — only our roster (his ask: "remove all options of characters that are not of our roster"): the saga
// avatars of public/js/saga.js. Kids who had a brand or generic avatar keep their stored value; every page shows
// a saga picture for it (Saga.avatarUrl).
const AVATAR_OPTIONS = Saga.AVATARS.map((a) => a.id);
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
// a message's button link (review 2026-10-18): a page of this site («/…», never «//host» or «/\host») or an https:// page;
// anything else (javascript:, data:, another scheme) is dropped when the teacher sends it, so no kid's phone ever holds it
function safeActionUrl(u) {
  const s = typeof u === 'string' ? u.trim().slice(0, 500) : '';
  return s && (/^\/(?![\/\\])/.test(s) || /^https:\/\/[^\s]+$/i.test(s)) ? s : null;
}
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
    actionUrl:    safeActionUrl(payload.actionUrl),
    actionLabel:  payload.actionLabel || null,
    ts:           Date.now(),
    readAt:       null,
  };
  if (!msg.text && !msg.actionUrl) return null;
  // 🆕 2026-06-21 (Fernando) — force-call DEDUP. Tapping the "call to room"
  // button several times used to stack a separate force message each time;
  // a kid opening their portal later would get yanked by an OLD one (often
  // to a room that no longer exists, "called to Maestro many many times").
  // A force call only ever means "come NOW", so a fresh force supersedes any
  // earlier unread force — retire the old ones so ONLY the latest can fire.
  if (msg.actionType === 'force') {
    rec.inbox.forEach((m) => {
      if (m.actionType === 'force' && !m.readAt) m.readAt = Date.now();
    });
  }
  rec.inbox.unshift(msg);                          // newest first
  if (rec.inbox.length > 50) rec.inbox = rec.inbox.slice(0, 50);
  rec.lastSeen = Date.now();
  scheduleSave();
  return msg;
}
// 🆕 2026-06-21 (Fernando) — teacher "send to homework profile". Finds an
// unread 'gohome' inbox message, marks it read (so it fires exactly once),
// and reports whether one was pending. The /api/heartbeat endpoint calls this
// so a kid stuck in any room (which heartbeats every 30s) gets sent back home.
function consumeGoHome(code) {
  const rec = get(code);
  if (!rec || !Array.isArray(rec.inbox)) return false;
  const go = rec.inbox.find((m) => !m.readAt && m.actionType === 'gohome');
  if (!go) return false;
  go.readAt = Date.now();
  scheduleSave();
  return true;
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
// 🆕 2026-06-08 (Fernando): when a teacher's room ends (Terminar or
// tab close), sweep EVERY student's inbox for unread force-pulls that
// pointed at that PIN and auto-mark-read them. Without this, kids
// poll the inbox 20s later, see the stale force message, get the
// "¡Tu maestra te llama!" takeover, redirect to /player.html, fail
// to join a dead room — and feel like their account is broken.
// Scans all records once (cheap; ~hundreds of students max).
function expirePinForceMessages(pin) {
  if (!pin) return 0;
  const needle = 'pin=' + String(pin);
  let cleared = 0;
  Object.values(records).forEach((rec) => {
    if (!Array.isArray(rec.inbox)) return;
    rec.inbox.forEach((m) => {
      if (m.readAt) return;
      if (m.actionType !== 'force') return;
      const url = String(m.actionUrl || '');
      if (url.includes(needle)) { m.readAt = Date.now(); cleared++; }
    });
  });
  if (cleared) scheduleSave();
  return cleared;
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
        actionUrl:    safeActionUrl(payload.actionUrl),
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
  return records[normalized] || restoreArchived(normalized) || null;
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
// `customWords` (optional) is the current room's live custom-word list.
// We snapshot the ones actually referenced by `sentence` into the entry
// so that — after the room closes — the kid's "Mis oraciones" can still
// render the teacher-typed pinyin/hanzi/es instead of the raw "cw..."
// ID. Without this, kids see codes like "cw_mp34578mt" in their history
// and Google TTS reads the code aloud (Fernando, 2026-06-06).
function logSentence(contributors, sentence, pin, customWords) {
  if (!Array.isArray(sentence) || !sentence.length) return;
  if (!Array.isArray(contributors) || !contributors.length) return;
  const referenced = Array.isArray(customWords)
    ? customWords
        .filter((w) => w && w.id && sentence.includes(w.id))
        .map((w) => ({
          id: w.id,
          pinyin: String(w.pinyin || ''),
          hanzi: String(w.hanzi || ''),
          es: String(w.es || ''),
          icon: String(w.icon || ''),
        }))
    : [];
  const entry = {
    ts: Date.now(),
    pin: pin || '',
    words: sentence.slice(),    // copy to avoid mutation
    contributors: contributors.slice(),
  };
  if (referenced.length) entry.customWords = referenced;
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
  // 🔒 2026-10-15: `editedBy` held the editing teacher's CODE on edits older than today, and this list reaches kids'
  // phones: it never leaves the server (nothing on screen uses it)
  const arr = (rec.sentencesBuilt || []).slice().reverse()
    .map((s) => { if (!s || !('editedBy' in s)) return s; const o = Object.assign({}, s); delete o.editedBy; return o; });
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

// Clear EVERY saved sentence for this student. Used by Maestro's cleanup
// tool ("limpiar oraciones guardadas") when a kid has a lot of junk/test
// saves and the teacher wants a fresh slate. Irreversible from the UI.
function clearAllSentences(code) {
  const rec = get(code);
  if (!rec) return 0;
  const n = rec.sentencesBuilt.length;
  if (!n) return 0;
  rec.sentencesBuilt = [];
  scheduleSave();
  return n;
}

// =====================================================================
// 🏆 DAILY PROGRESSION — XP, levels, tiers, DralySwords ⚔️ + streak.
// Drives the "Diario" tab: a daily mini-game that awards XP + DralySwords,
// a streak that rewards returning every day, and tiers from Bronce up to
// Dragón Dorado. The actual PRIZE at the top is a real-world secret the
// teacher arranges — the app only ever shows a locked mystery box.
// =====================================================================
const XP_PER_LEVEL = 250;
const MAX_LEVEL = 20;
function levelFromXp(xp) {
  return Math.min(MAX_LEVEL, Math.floor((Number(xp) || 0) / XP_PER_LEVEL) + 1);
}
// Mystical, brand-distinctive tier names — no generic bronze/silver. The
// progression honors the Dralingo dragon arc (seed → bamboo → lotus → phoenix
// → dragon) so kids feel like they're awakening something each level up.
function tierForLevel(level) {
  if (level >= 18) return { id: 'dragon',  label: 'Dragón Despierto', emoji: '🐉', color: '#ffd24a' };
  if (level >= 13) return { id: 'phoenix', label: 'Llama del Fénix',  emoji: '🔥', color: '#ff7a45' };
  if (level >= 8)  return { id: 'lotus',   label: 'Sabio del Loto',   emoji: '🪷', color: '#ff5b9f' };
  if (level >= 4)  return { id: 'bamboo',  label: 'Guardián del Bambú', emoji: '🎋', color: '#5be88a' };
  return { id: 'seed', label: 'Semilla del Saber', emoji: '🌱', color: '#9be36b' };
}
// Read-only progression snapshot for a student (defaults for old records).
function getProgress(code) {
  const rec = get(code);
  if (!rec) return null;
  const xp = Number(rec.xp) || 0;
  const level = levelFromXp(xp);
  return {
    xp,
    level,
    xpIntoLevel: xp - (level - 1) * XP_PER_LEVEL,
    xpForLevel: XP_PER_LEVEL,
    swords: Number(rec.swords) || 0,
    streak: Number(rec.streak) || 0,
    dailyDate: rec.dailyDate || null,
    tier: tierForLevel(level),
  };
}
// Add 1 day to a YYYY-MM-DD string (returns YYYY-MM-DD). Used for streaks.
function _addDay(dateStr, delta) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
// 🔥 2026-10-18 («Mi Dralingo» part 3, the kid's home): «N días seguidos» = days in a row with a REAL step: a La Base
// seal, an El Entrenamiento round, a homework mark («Escuchada», «¡Ya la mandé!»), a tarea handed in, the daily
// challenge. Before, only the daily challenge moved it (and it is «Muy pronto» now). Counted on the kid's own calendar:
// their phone's time zone (rec.tz, from the login), else UTC. rec.dayDate = the last day that counted; rec.streak = the
// days in a row up to it (the field the daily always used). A page view never counts.
function _localDay(rec, at) {
  const d = new Date(at || Date.now());
  const tz = rec && typeof rec.tz === 'string' ? rec.tz : '';
  if (tz) {
    try { const s = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; } catch (_) { /* an unknown zone: UTC */ }
  }
  return d.toISOString().slice(0, 10);
}
// a step on `day` (YYYY-MM-DD): the same day counts once, the next day adds one, a gap starts again at 1. A day before
// the last one (a phone that changed its zone) changes nothing. → true when the count moved
function _bumpDay(rec, day) {
  if (!rec || !/^\d{4}-\d{2}-\d{2}$/.test(String(day || ''))) return false;
  const last = rec.dayDate || rec.dailyDate || null;
  if (last && last > day) return false;
  if (last === day) { rec.dayDate = day; if (!(Number(rec.streak) > 0)) rec.streak = 1; return false; }
  rec.streak = last && last === _addDay(day, -1) ? (Number(rec.streak) || 0) + 1 : 1;
  rec.dayDate = day;
  return true;
}
const _studyDay = (rec) => _bumpDay(rec, _localDay(rec));
// the kid's phone time zone (review 2026-10-18: a kid who came in through la entrada or an automatic account never
// passed the old login's setMeta, so their days were counted in UTC: a kid in Mexico studying at 7 pm lost the streak).
// An IANA name the server's Intl knows («America/Mexico_City»), else nothing. setTz stores it only when it changed and
// never touches lastSeen (a page view is not activity: the archive's 30 days).
function tzOk(tz) {
  if (typeof tz !== 'string' || !tz || tz.length > 64 || !/^[A-Za-z0-9_+\-/]+$/.test(tz)) return false;
  try { new Intl.DateTimeFormat('en-CA', { timeZone: tz }); return true; } catch (_) { return false; }
}
function setTz(code, tz) {
  const rec = get(code);
  if (!rec || !tzOk(tz) || rec.tz === tz) return false;
  rec.tz = tz;
  scheduleSave();
  return true;
}
// a phone's «today» for the daily challenge: within one day of the server's UTC day (every zone on Earth is), else refused
function dayNearNow(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day || ''))) return false;
  const at = Date.parse(day + 'T00:00:00Z');
  const now = Date.parse(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
  return Number.isFinite(at) && Math.abs(at - now) <= 86400000;
}
// what the home shows: { days, today } (days = 0 once a day was missed: a broken streak never shows its old number)
function streakOf(recOrCode) {
  const rec = typeof recOrCode === 'string' ? get(recOrCode) : recOrCode;
  if (!rec) return { days: 0, today: false };
  const today = _localDay(rec);
  const last = rec.dayDate || rec.dailyDate || null;
  const n = Math.max(1, Number(rec.streak) || 0);
  if (last === today) return { days: n, today: true };
  if (last && last === _addDay(today, -1)) return { days: n, today: false };
  return { days: 0, today: false };
}
// Award today's daily challenge. Idempotent per local date (one claim/day).
// `correct` is how many words the kid cleared in the mini-game (capped).
function awardDaily(code, localDate, correct) {
  const rec = get(code);
  if (!rec) return { ok: false, reason: 'nocode' };
  // (review 2026-10-18: a phone's date more than a day from the server's is refused, before DESAFIO_LIVE ever turns on:
  // a date far ahead would freeze the streak, a date far back would never count)
  if (!dayNearNow(localDate)) {
    return { ok: false, reason: 'baddate' };
  }
  if (rec.dailyDate === localDate) {
    return { ok: false, reason: 'already', progress: getProgress(code) };
  }
  // Streak: +1 if they practised yesterday, else reset to 1 (2026-10-18: the same day count as every real step of
  // «Mi Dralingo», _bumpDay below: a seal and the daily on the same day count once)
  _bumpDay(rec, localDate);
  rec.dailyDate = localDate;
  // Rewards — server-computed so the client can't inflate them.
  // XP still scales with effort + streak (drives level progression), but the
  // PRIZE currency is intentionally tiny — exactly 1 ⚔️ per completed daily.
  // Milestones [30,50,100] then mean ~30 / ~50 / ~100 days of practice, so the
  // secret prizes the teacher gives out really are hard-earned.
  const c = Math.max(0, Math.min(12, Number(correct) || 0));
  const streakBonus = Math.min(10, rec.streak);
  const xpGain = 40 + c * 8 + streakBonus * 5;
  const swordGain = 1;
  const beforeLevel = levelFromXp(Number(rec.xp) || 0);
  rec.xp = (Number(rec.xp) || 0) + xpGain;
  rec.swords = (Number(rec.swords) || 0) + swordGain;
  const afterLevel = levelFromXp(rec.xp);
  scheduleSave();
  return {
    ok: true,
    gained: { xp: xpGain, swords: swordGain },
    leveledUp: afterLevel > beforeLevel,
    newLevel: afterLevel,
    progress: getProgress(code),
  };
}

// Append a single sentence to ONE student's history (their own private
// save / edited copy). Mirrors logSentence but for a lone student, and is
// used by wu:save-mine and the homework "save copy" endpoint.
function appendSentence(code, words, pin, customWords) {
  const rec = get(code);
  if (!rec) return false;
  if (!Array.isArray(words) || !words.length) return false;
  const referenced = Array.isArray(customWords)
    ? customWords
        .filter((w) => w && w.id && words.includes(w.id))
        .map((w) => ({
          id: w.id,
          pinyin: String(w.pinyin || ''),
          hanzi: String(w.hanzi || ''),
          es: String(w.es || ''),
          icon: String(w.icon || ''),
        }))
    : [];
  const entry = {
    ts: Date.now(),
    pin: pin || '',
    words: words.slice(),
    contributors: [rec.code],
  };
  if (referenced.length) entry.customWords = referenced;
  rec.sentencesBuilt.push(entry);
  if (rec.sentencesBuilt.length > 200) {
    rec.sentencesBuilt = rec.sentencesBuilt.slice(-200);
  }
  scheduleSave();
  return true;
}

// 📤 Teacher push — appends a sentence to a kid's Mis Oraciones with
// a "pushedByTeacher" flag so the kid + parent view know it came from
// the teacher (not the kid's own work). The teacher's name lands on
// the entry too so the report card can credit the source.
function pushSentenceFromTeacher(code, words, teacherName, category) {
  const rec = get(code);
  if (!rec) return false;
  if (!Array.isArray(words) || !words.length) return false;
  const entry = {
    ts: Date.now(),
    pin: '',
    words: words.slice(),
    contributors: [rec.code],
    pushedByTeacher: true,
    teacherName: String(teacherName || 'Maestro/a').slice(0, 32),
  };
  // 🆕 2026-06-04 (Fernando): teacher can tag pushed sentences with a
  // category so the kid can filter "De la maestra" by topic ("Casa",
  // "Escuela", "Tienda"…). The route validates the id against the
  // SENTENCE_CATEGORIES list; we just store whatever was handed to us.
  if (typeof category === 'string' && category) {
    entry.category = category;
  }
  rec.sentencesBuilt.push(entry);
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
      classroomId: r.classroomId || null,
      level: Levels.normalize(r.level) || Levels.DEFAULT,   // from the access code they last typed
      rawLevel: r.level || null,                            // (level keys: what the record really says)
      levelSince: r.levelSince || 0,
      levelAccess: r.levelAccess || null,                   // levels opened on the account (core/level-keys.js)
      ruta: r.ruta || null,                                 // La Ruta Dorada progress (core/ruta-progress.js; server.js
                                                            // turns it into a small bar and drops it from the roster)
      country: r.country || null,
      device: r.device || null,
      locale: r.locale || null,
      tz: r.tz || null,
      // 🆕 2026-10-18: an account La Ruta Dorada made by itself, not claimed by a class code yet (the roster's «automática»)
      auto: !!(r.auto && !r.classroomCode),
      autoBorn: !!r.auto,                                   // (its origin: never «from before the keys», server.js _levelState)
      byKey: !!r.byKey,                                     // 🆕 2026-10-18: made with the level key at /homework (la entrada)
      firstSeen: r.firstSeen || 0,
      lastSeen: r.lastSeen || 0,
      sentenceCount:   Array.isArray(r.sentencesBuilt)         ? r.sentencesBuilt.length         : 0,
      testCount:       Array.isArray(r.testResults)            ? r.testResults.length            : 0,
      assignmentCount: Array.isArray(r.assignmentSubmissions)  ? r.assignmentSubmissions.length  : 0,
      // Progression snapshot for the teacher's "Hoy ✅" Cuaderno column.
      xp: Number(r.xp) || 0,
      swords: Number(r.swords) || 0,
      streak: Number(r.streak) || 0,
      dailyDate: r.dailyDate || null,
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
  _studyDay(rec);   // (2026-10-18: a tarea handed in is a day of «N días seguidos»)
  if (rec.assignmentSubmissions.length > 100) {
    // 2026-10-12 — keep each tarea's BEST attempt (a passed round must never turn pending again: YCT kids replay 20
    // game rounds), then fill up to 100 with the most recent attempts; original order kept.
    const pct = (s) => (Number(s.score) || 0) / (Number(s.total) || 100);
    const best = new Map();
    rec.assignmentSubmissions.forEach((s) => {
      const b = best.get(s.assignmentId);
      if (!b || pct(s) >= pct(b)) best.set(s.assignmentId, s);
    });
    const keep = new Set(best.values());
    for (const s of rec.assignmentSubmissions.slice().reverse()) {
      if (keep.size >= 100) break;
      keep.add(s);
    }
    rec.assignmentSubmissions = rec.assignmentSubmissions.filter((s) => keep.has(s));
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

// 🆕 2026-06-16 (Fernando): migrate a single HSK attempt from one
// student to another. Used when a kid accidentally took an exam from
// the wrong account — the teacher moves the result to the correct
// student code so it shows up in their Cuaderno / Mis Exámenes / Papás
// everywhere, exactly as if they'd taken it from that account.
//   fromCode  — the (wrong) student the attempt currently lives on
//   ts        — the attempt's timestamp (unique within that student)
//   toCode    — the (correct) student to move it to (must already exist)
// Returns { ok, error? }. Persists via scheduleSave.
function migrateHskAttempt(fromCode, ts, toCode) {
  const from = get(fromCode);
  const to = get(toCode);
  if (!from) return { ok: false, error: 'origen no encontrado' };
  if (!to) return { ok: false, error: 'código destino no existe' };
  if (from.code === to.code) return { ok: false, error: 'mismo estudiante' };
  const target = Number(ts);
  if (!Number.isFinite(target)) return { ok: false, error: 'ts inválido' };
  if (!Array.isArray(from.hskResults)) from.hskResults = [];
  const idx = from.hskResults.findIndex((r) => r.ts === target);
  if (idx === -1) return { ok: false, error: 'intento no encontrado en origen' };
  const attempt = from.hskResults.splice(idx, 1)[0];
  if (!Array.isArray(to.hskResults)) to.hskResults = [];
  // Tag it so we have an audit trail of where it came from.
  attempt.migratedFrom = from.code;
  attempt.migratedAt = Date.now();
  to.hskResults.push(attempt);
  scheduleSave();
  return { ok: true, fromRemaining: from.hskResults.length, toTotal: to.hskResults.length };
}

module.exports = {
  getOrCreate,
  getOrProvisionForPin,
  migrateHskAttempt,
  save: scheduleSave,
  pushSentenceFromTeacher,
  get,
  deleteStudent,
  setMeta,
  addNote,
  getNotes,
  deleteNote,
  logSentence,
  appendSentence,
  clearAllSentences,
  getHistory,
  deleteHistoryEntry,
  getProgress,
  awardDaily,
  streakOf,
  setTz,
  tzOk,
  normalizeCode,
  listAll,
  logTestResult,
  getTestResults,
  logAssignmentSubmission,
  getAssignmentSubmissions,
  setAvatar,
  setDisplayName,
  setClassroomCode,
  setLevel,
  setLevelAccess,
  updateRuta,
  updateTareas,
  resetAssignmentSubmissions,
  sendMessage,
  getInbox,
  markMessageRead,
  markAllMessagesRead,
  expirePinForceMessages,
  consumeGoHome,
  setClassroomId,
  broadcastToClassroom,
  AVATAR_OPTIONS,
  archiveInactive,
  archiveStats,
  archiveOne,
  moveResults,
  peek,
  createAuto,
  setRealName,
  createByKey,     // 🆕 2026-10-18 la entrada
  claimByKey,
  bumpKidGen,      // 🔒 2026-10-18 security review F2
  ARCHIVE_AFTER_DAYS,
  flushNow: persistNow,   // write now (tests; before a planned shutdown)
};
