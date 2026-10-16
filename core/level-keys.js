// =========================================================================
// level-keys.js — a secret key per level opens all three levels of that module; a teacher device is remembered
// (La Ruta Dorada, phase 1 · his decisions 2026-10-15)
// =========================================================================
// His words: "we are a premium company, it looks bad if everything is free". Nothing of a module is open to anyone
// any more: one key per level of core/levels.js (YCT 1, New HSK 1 = stored id hsk2, HSK 1, and every level added
// there later) opens La Base, El Entrenamiento and El Simulacro Dorado of that level. A key is a word + a number
// (DRAGON-47 style); any case, spaces, dashes and accents are ignored when comparing. He sets and changes them in
// /maestro → Teachers → «Claves de nivel»; they live ONLY on the data disk (<data>/level-keys.json, gitignored):
// never in the repo, a log line or a chat.
//
// access(req, level) is THE question every locked level asks (La Base today; El Entrenamiento and El Simulacro
// Dorado in phases 2-4 call the same function). Yes when:
//   teacher  · the request is a teacher's (code header, or a remembered teacher device): every level
//   student  · the logged-in kid (the /homework session `dsim`) has the level open on their ACCOUNT: the key typed
//              while logged in (any device), a teacher's «Desbloquear», or grandfathered (below)
//   key      · THIS device typed the level's key once (signed httpOnly cookie dlv_<level>, a year)
// Kids in a teacher's live PIN room need nothing of this: the room pass (core/sim-lock.js) covers what the teacher
// launches. Homework (/homework, its audio pages) never asks.
//
// Grandfathering (his choice: no disruption): the keys go live the moment the FIRST key is set in /maestro
// (goLiveAt, recorded once, never moved). A student record created before that (firstSeen; restored archived
// accounts keep theirs) keeps its class level without the key, once the kid is logged in. Until the first key
// exists every enrolled kid keeps their level. A kid who moves to another level after the go-live needs that
// level's key (Students.setLevel dates the change: levelSince); the old level stays open (stamped at that login).
//
// A key change: the old key stops working for anyone typing it from then on; devices and accounts that already
// opened the level KEEP it (his "no disruption": 800 families must not retype; a leaked key that spread can be
// cut with «Cerrar en todos los aparatos», which bumps the level's `gen` and ends every device cookie of that
// level — real students get it back at their next /homework login, from their account).
//
// Wrong guesses: 5 per device (cookie dkd) and 30 per internet address (a class shares one school IP) in 15 min,
// then a wait with a kind message. A key that belongs to ANOTHER level gets its own message (and is not a guess).
//
// Teacher devices («crear un juego needs first time key access, then it's safe»): hosting any room needs a teacher
// the first time on a device; the teacher's code (the /maestro code) or a /maestro login then remembers THAT device
// (signed httpOnly cookie dtd, 90 days) — never an internet address (a school Wi-Fi gives every phone the same one).
// The cookie carries the teacher's uid and codeGen (core/teachers.js), so «Cambiar mi código» ends every device that
// was remembered with the old code; the legacy WU_ADMIN_PASSWORD's devices end when that password changes.
// =========================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Levels = require('./levels');
const SimLock = require('./sim-lock');   // the one server signing key + cookie helpers
const Teachers = require('./teachers');

const DATA_DIR = process.env.DRALY_DATA_DIR || path.join(__dirname, '..', 'data');   // tests: their own folder
const FILE = path.join(DATA_DIR, 'level-keys.json');
const PAGE = path.join(SimLock.PAGES, 'level-key.html');

const KEY_COOKIE = (level) => 'dlv_' + level;
const KEY_TTL = 365 * 24 * 3600e3;            // browsers keep a cookie ~400 days at most
const TEACHER_COOKIE = 'dtd';
const TEACHER_TTL = 90 * 24 * 3600e3;         // his "first time key access, then it's safe" (~90 days)
const DEVICE_COOKIE = 'dkd';                  // a random id per browser, only to count wrong guesses per device
const EXAMPLE = 'PANDA-12';                   // the shape the key screen shows: never accepted as a real key
const DEV_MAX = 5, IP_MAX = 30, WINDOW = 15 * 60 * 1000;

// ── the stored keys ─────────────────────────────────────────────────────────────────────────────────────────────
// { goLiveAt, levels: { <level id>: { key (as he typed it, upper case), norm, setAt, gen, changes } } }
let state = { goLiveAt: 0, levels: {} };
let loadedOk = true;
function load() {
  state = { goLiveAt: 0, levels: {} };
  loadedOk = true;
  if (!fs.existsSync(FILE)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8')) || {};
    state.goLiveAt = Number(raw.goLiveAt) || 0;
    state.levels = raw.levels && typeof raw.levels === 'object' ? raw.levels : {};
  } catch (e) {
    // never write over an unreadable key file (the go-live moment decides who is grandfathered): keep it aside
    loadedOk = false;
    const aside = FILE.replace(/\.json$/, '.unreadable-' + Date.now() + '.json');
    try { fs.renameSync(FILE, aside); loadedOk = true; } catch (_) { /* keep refusing to write */ }
    console.error('[level-keys] level-keys.json unreadable, kept as', path.basename(aside), '-', e.message);
  }
}
function save() {
  if (!loadedOk) return false;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmp, FILE);
    return true;
  } catch (e) {
    console.warn('[level-keys] could not save the keys:', e.message);
    return false;
  }
}
load();

// «DRAGÓN 47», «dragon-47», «Dragon47» → «DRAGON47»: any case, no accents, no spaces or dashes
function normalizeKey(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 40);
}
const levelEntry = (lvl) => (lvl && state.levels[lvl]) || null;
const genOf = (lvl) => Number((levelEntry(lvl) || {}).gen) || 1;
const goLiveAt = () => state.goLiveAt || 0;

// A new key for a level (from /maestro). → { ok: true, level, levelName } | { ok: false, error } (Spanish, his screen)
function validateKey(level, raw) {
  const lvl = Levels.normalize(level);
  if (!lvl) return { ok: false, error: 'Ese nivel no existe.' };
  const shown = String(raw == null ? '' : raw).trim().toUpperCase().replace(/\s+/g, ' ');
  const norm = normalizeKey(shown);
  if (!shown || shown.length > 30 || /[^A-ZÁÉÍÓÚÜÑ0-9 -]/.test(shown)) {
    return { ok: false, error: 'Usa solo letras, números y un guion. Por ejemplo: una palabra, un guion y un número.' };
  }
  const letters = (norm.match(/[A-Z]/g) || []).length;
  const digits = (norm.match(/[0-9]/g) || []).length;
  if (letters < 4 || digits < 2) return { ok: false, error: 'La clave necesita una palabra de 4 letras o más y un número de 2 cifras o más.' };
  if (norm.length > 24) return { ok: false, error: 'La clave es muy larga: que sea fácil de escribir (24 letras y números como máximo).' };
  if (norm === normalizeKey(EXAMPLE)) return { ok: false, error: 'Esa es la clave de ejemplo que ve todo el mundo. Elige otra.' };
  const clash = Object.keys(state.levels).find((l) => l !== lvl && state.levels[l] && state.levels[l].norm === norm);
  if (clash) return { ok: false, error: 'Cada nivel necesita su propia clave (esa ya es la de ' + Levels.info(clash).name + ').' };
  const cur = levelEntry(lvl);
  if (cur && cur.norm === norm) return { ok: false, error: 'Esa ya es la clave de ' + Levels.info(lvl).name + '.' };
  return { ok: true, level: lvl, shown, norm };
}
function setKey(level, raw) {
  const v = validateKey(level, raw);
  if (!v.ok) return v;
  if (!loadedOk) return { ok: false, error: 'El archivo de claves no se pudo leer: avísale a Claude antes de cambiar nada.' };
  const prev = levelEntry(v.level);
  const now = Date.now();
  state.levels[v.level] = { key: v.shown, norm: v.norm, setAt: now, gen: (prev && Number(prev.gen)) || 1, changes: ((prev && prev.changes) || 0) + 1 };
  if (!state.goLiveAt) state.goLiveAt = now;      // the keys go live with the first one, once
  if (!save()) return { ok: false, error: 'No se pudo guardar la clave. Vuelve a intentarlo.' };
  console.log('[level-keys] the key of ' + Levels.info(v.level).name + (prev ? ' was changed' : ' was set') + (state.goLiveAt === now ? ' (keys live from now on)' : ''));
  return { ok: true, level: v.level, levelName: Levels.info(v.level).name };
}
// «Cerrar en todos los aparatos»: every device cookie of the level stops (accounts keep what they have)
function closeDevices(level) {
  const lvl = Levels.normalize(level);
  if (!lvl) return { ok: false, error: 'Ese nivel no existe.' };
  const cur = levelEntry(lvl) || { key: '', norm: '', setAt: 0, gen: 1, changes: 0 };
  cur.gen = (Number(cur.gen) || 1) + 1;
  state.levels[lvl] = cur;
  if (!save()) return { ok: false, error: 'No se pudo guardar. Vuelve a intentarlo.' };
  console.log('[level-keys] every device of ' + Levels.info(lvl).name + ' must type the key again');
  return { ok: true };
}
// what /maestro shows (super-admin only): every level of core/levels.js, with or without a key
function list() {
  return Levels.LEVELS.map((l) => {
    const e = levelEntry(l.id);
    return { id: l.id, name: l.name, family: l.family, base: l.base || null, key: (e && e.key) || '', setAt: (e && e.setAt) || 0,
      changes: (e && e.changes) || 0, gen: genOf(l.id) };
  });
}
const keyFits = (lvl, typed) => {
  const e = levelEntry(lvl);
  if (!e || !e.norm || !typed) return false;
  const a = Buffer.from(normalizeKey(typed)), b = Buffer.from(e.norm);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
// the level a typed key belongs to, or null (to tell a parent «esa clave es de HSK 1»)
const levelOfKey = (typed) => Object.keys(state.levels).find((l) => keyFits(l, typed)) || null;

// ── wrong guesses: per device and per internet address ──────────────────────────────────────────────────────────
const fails = new Map();   // 'd:<device>' | 'i:<ip>' → [timestamps]
const recent = (k, now) => (fails.get(k) || []).filter((t) => now - t < WINDOW);
function guessWait(ip, dev) {
  const now = Date.now();
  const d = dev ? recent('d:' + dev, now) : [];
  const i = recent('i:' + ip, now);
  const over = d.length >= DEV_MAX ? d : (i.length >= IP_MAX ? i : null);
  if (!over) return 0;
  return Math.max(1, Math.ceil((over[0] + WINDOW - now) / 60000));     // minutes until the oldest guess expires
}
function noteWrong(ip, dev) {
  const now = Date.now();
  ['d:' + (dev || ''), 'i:' + ip].forEach((k) => {
    if (k === 'd:') return;
    const arr = recent(k, now);
    arr.push(now);
    fails.set(k, arr);
  });
  const ipCount = recent('i:' + ip, now).length;
  if (ipCount === IP_MAX) console.warn('[security] level-key guessing ip=' + ip + ' → paused 15 min');
  if (fails.size > 5000) for (const [k, v] of fails) if (!v.length || now - v[v.length - 1] > WINDOW) fails.delete(k);
}
const clearDevice = (dev) => { if (dev) fails.delete('d:' + dev); };
// this browser's guess-counting id (made on the first try)
function deviceId(req, res) {
  let id = SimLock.readCookie(req, DEVICE_COOKIE);
  if (!/^[a-f0-9]{24}$/.test(id)) {
    id = crypto.randomBytes(12).toString('hex');
    if (res) SimLock.setCookie(req, res, DEVICE_COOKIE, id, KEY_TTL);
  }
  return id;
}

// ── a level's key on this device ────────────────────────────────────────────────────────────────────────────────
function deviceOpen(req, level) {
  const lvl = Levels.normalize(level);
  if (!lvl) return false;
  const v = SimLock.verify(SimLock.readCookie(req, KEY_COOKIE(lvl)), 'l');
  return !!(v && v[0] === lvl && String(v[1]) === String(genOf(lvl)));
}
function rememberDevice(req, res, level) {
  const lvl = Levels.normalize(level);
  if (!lvl) return;
  SimLock.setCookie(req, res, KEY_COOKIE(lvl), SimLock.sign('l', [lvl, genOf(lvl)], KEY_TTL), KEY_TTL);
}

// ── a student record ────────────────────────────────────────────────────────────────────────────────────────────
// the class level of a record: the level stamped at its last /homework login, else its class code's level
function classLevel(rec) {
  if (!rec) return null;
  return Levels.normalize(rec.level) || (rec.classroomCode ? Levels.normalize(Teachers.levelForAccessCode(rec.classroomCode)) : null);
}
function grandfathered(rec, level) {
  const lvl = Levels.normalize(level);
  if (!rec || !lvl || classLevel(rec) !== lvl) return false;
  const g = goLiveAt();
  if (!g) return true;                                             // no key set yet: every enrolled kid keeps their level
  if (!(Number(rec.firstSeen) > 0 && Number(rec.firstSeen) < g)) return false;   // registered after the go-live
  return !(Number(rec.levelSince) >= g);                           // moved to this level after the go-live: needs its key
}
// how a record has the level open ('key' | 'teacher' | 'grandfathered') or null
function recordOpenVia(rec, level) {
  const lvl = Levels.normalize(level);
  if (!rec || !lvl) return null;
  const a = rec.levelAccess && rec.levelAccess[lvl];
  if (a) return a.via || 'key';
  return grandfathered(rec, lvl) ? 'grandfathered' : null;
}

// ── a teacher's device ──────────────────────────────────────────────────────────────────────────────────────────
const legacyGen = () => {
  const pw = process.env.WU_ADMIN_PASSWORD;
  return pw ? crypto.createHash('sha256').update('draly-legacy-device:' + pw).digest('hex').slice(0, 16) : null;
};
// req (or a socket's handshake headers) → { teacher, isSuperAdmin, legacy } | null. Re-checked on every use: the
// teacher must still exist with the same codeGen (a changed code ends the device).
function teacherDevice(reqOrHeaders) {
  const v = SimLock.verify(SimLock.readCookie(reqOrHeaders, TEACHER_COOKIE), 'T');
  if (!v || v.length < 2) return null;
  if (v[0] === '*') {
    const g = legacyGen();
    return g && v[1] === g ? { teacher: null, isSuperAdmin: true, legacy: true, device: true } : null;
  }
  const t = Teachers.getByUid(v[0]);
  if (!t || String(Number(t.codeGen) || 0) !== String(v[1])) return null;
  return { teacher: t, isSuperAdmin: !!t.isSuperAdmin, legacy: false, device: true };
}
// session = what server.js _adminAuth returned for a right code
function rememberTeacher(req, res, session) {
  if (!session) return false;
  const uid = session.teacher ? session.teacher.uid : '*';
  const gen = session.teacher ? String(Number(session.teacher.codeGen) || 0) : legacyGen();
  if (!uid || gen == null) return false;
  SimLock.setCookie(req, res, TEACHER_COOKIE, SimLock.sign('T', [uid, gen], TEACHER_TTL), TEACHER_TTL);
  return true;
}
const forgetTeacher = (req, res) => SimLock.setCookie(req, res, TEACHER_COOKIE, '', 0);

// ── THE question: may this request use level X? ─────────────────────────────────────────────────────────────────
// server.js plugs in who the request is (teacherOf: code header / teacher device; studentOf: the /homework session's
// record, looked up with Students.get so an archived kid comes back).
const resolvers = { teacherOf: () => null, studentOf: () => null };
function configure(r) { Object.assign(resolvers, r || {}); }
// → { ok, level, via: 'teacher' | 'student' | 'key', how?, studentCode? } — studentCode = the logged-in kid, if any
function access(req, level) {
  const lvl = Levels.normalize(level);
  if (!lvl) return { ok: false, level: null };
  if (resolvers.teacherOf(req)) return { ok: true, level: lvl, via: 'teacher' };
  const rec = resolvers.studentOf(req);
  const how = rec ? recordOpenVia(rec, lvl) : null;
  if (how) return { ok: true, level: lvl, via: 'student', how, studentCode: rec.code };
  if (deviceOpen(req, lvl)) return { ok: true, level: lvl, via: 'key', studentCode: rec ? rec.code : null };
  return { ok: false, level: lvl, studentCode: rec ? rec.code : null };
}
// every level at once (the /audios library draws its locks with it): { yct1: true, hsk2: false, … } plus each
// level's curriculum id (newhsk1) so the page can look a catalog entry up either way
function accessMap(req) {
  const out = {};
  Levels.LEVELS.forEach((l) => { out[l.id] = access(req, l.id).ok; if (l.pack && l.pack !== l.id) out[l.pack] = out[l.id]; });
  return out;
}

// ── the key screen (protected/pages/level-key.html), served in place of whatever was locked ─────────────────────
let _tpl = null;
const escHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// st: { level, what: 'base' | 'sim', reason: 'key' | 'room' | 'pin' }
function sendKeyScreen(res, st) {
  if (!_tpl || !process.env.RENDER) _tpl = fs.readFileSync(PAGE, 'utf8');   // re-read locally (design work), once on Render
  const lvl = Levels.normalize(st && st.level);
  const info = lvl ? Levels.info(lvl) : null;
  const state = {
    level: lvl, levelName: info ? info.name : '', family: info ? info.family : '', what: (st && st.what) || 'base',
    reason: (st && st.reason) || 'key', example: EXAMPLE, base: info && info.base ? '/audios/' + info.base : '/audios',
  };
  const json = JSON.stringify(state).replace(/</g, '\\u003c');
  const html = _tpl.replace(/\{\{levelName\}\}/g, () => escHtml(state.levelName || 'tu nivel'))
    .replace('/*LEVEL_KEY_STATE*/null', () => json);                                   // functions: no $-patterns expanded
  res.status(401).set(SimLock.NO_STORE).type('html').send(html);
}

module.exports = {
  EXAMPLE, KEY_COOKIE, TEACHER_COOKIE, DEVICE_COOKIE, FILE,
  load, normalizeKey, validateKey, setKey, closeDevices, list, keyFits, levelOfKey, goLiveAt, genOf,
  guessWait, noteWrong, clearDevice, deviceId,
  deviceOpen, rememberDevice,
  classLevel, grandfathered, recordOpenVia,
  teacherDevice, rememberTeacher, forgetTeacher,
  configure, access, accessMap,
  sendKeyScreen,
};
