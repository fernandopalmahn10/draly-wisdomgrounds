// =========================================================================
// ruta-progress.js — the unlock engine of La Ruta Dorada (phase 3 · his picks 2026-10-16)
// =========================================================================
// One place answers "how far along is this kid, and what does that open?" for every level of core/levels.js that has
// a La Base (core/levels.js `base`). /api/ruta-dorada, /maestro and the phases to come (El Entrenamiento, the golden
// book) read it; nothing else decides an unlock.
//
// The KEY is still the door of a whole level (core/level-keys.js LevelKeys.access): without it nothing here matters.
// Inside an open level, progress opens the steps, like a game:
//   La Base           · the kid's «¡Me la sé!» seals (a free tap: his pick, a kid's own checklist), per world.
//   El Entrenamiento  · opens WORLD BY WORLD: every seal of world N in La Base → world N of El Entrenamiento opens.
//                       A teacher's «Desbloquear» opens one world or all of them early («Volver a bloquear» undoes
//                       the teacher's opening; a world the kid's own seals opened stays open).
//   El Simulacro Dorado · opens with the key while El Entrenamiento is not live (the switch `trainingLive`, OFF until
//                       phase 4 ships, set in /maestro). Once it is live: every world practised with `doradoPct` % or
//                       more (default 70, changeable in /maestro), or a teacher's «Desbloquear».
//
// Stored on the student record (core/student-records.js updateRuta), per stored level id (yct1 · hsk2 · hsk1):
//   rec.ruta[level] = { s: '1-17,19,23-40'  the seals: word numbers of the level's base, as ranges (small: a whole
//                                            300-word base fits in ~10 characters once it is done)
//                       at: <ms>            last seal change
//                       tw: 'all' | [n…]    El Entrenamiento worlds a teacher opened
//                       td: 1               a teacher opened El Simulacro Dorado
//                       p: { n: pct }       El Entrenamiento: the best % per world (phase 4 writes it through
//                                           recordPractice; nothing fake is stored before that) }
// It travels with the record: archived and restored with it (Students.get/getOrCreate/getOrProvisionForPin).
//
// Settings (super admin, /maestro): <data>/ruta-settings.json { trainingLive, doradoPct } (gitignored, data disk).
// Boot only fills what is missing: a value he set is never reset.
// =========================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const Levels = require('./levels');

const DATA_DIR = process.env.DRALY_DATA_DIR || path.join(__dirname, '..', 'data');   // tests: their own folder
const SETTINGS_FILE = path.join(DATA_DIR, 'ruta-settings.json');
const CATALOG = path.join(__dirname, '..', 'public', 'assets', 'audios', 'catalog.json');
const BASE_DIR = path.join(__dirname, '..', 'protected', 'base');
const DEFAULTS = { trainingLive: false, doradoPct: 70 };
const PCT_MIN = 50, PCT_MAX = 100;

// ── settings ────────────────────────────────────────────────────────────────────────────────────────────────────
let settings = Object.assign({}, DEFAULTS);
let settingsOk = true;
function loadSettings() {
  settings = Object.assign({}, DEFAULTS);
  settingsOk = true;
  if (!fs.existsSync(SETTINGS_FILE)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) || {};
    // only what is missing or broken takes the default (a value he set is never forced back)
    if (typeof raw.trainingLive === 'boolean') settings.trainingLive = raw.trainingLive;
    if (Number.isInteger(raw.doradoPct) && raw.doradoPct >= PCT_MIN && raw.doradoPct <= PCT_MAX) settings.doradoPct = raw.doradoPct;
    if (Number(raw.updatedAt) > 0) settings.updatedAt = Number(raw.updatedAt);
  } catch (e) {
    const aside = SETTINGS_FILE.replace(/\.json$/, '.unreadable-' + Date.now() + '.json');
    try { fs.renameSync(SETTINGS_FILE, aside); } catch (_) { settingsOk = false; }
    console.error('[ruta] ruta-settings.json unreadable, kept aside; defaults in use -', e.message);
  }
}
function saveSettings() {
  if (!settingsOk) return false;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = SETTINGS_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(settings, null, 2), 'utf8');
    fs.renameSync(tmp, SETTINGS_FILE);
    return true;
  } catch (e) {
    console.warn('[ruta] could not save the settings:', e.message);
    return false;
  }
}
loadSettings();
const getSettings = () => ({ trainingLive: !!settings.trainingLive, doradoPct: settings.doradoPct, updatedAt: settings.updatedAt || 0,
  pctMin: PCT_MIN, pctMax: PCT_MAX });
// patch: { trainingLive?: boolean, doradoPct?: integer 50-100 } → { ok, settings } | { ok: false, error } (Spanish: his panel)
function setSettings(patch) {
  const p = patch && typeof patch === 'object' ? patch : {};
  const next = Object.assign({}, settings);
  if ('trainingLive' in p) {
    if (typeof p.trainingLive !== 'boolean') return { ok: false, error: 'El interruptor necesita sí o no.' };
    next.trainingLive = p.trainingLive;
  }
  if ('doradoPct' in p) {
    const n = Number(p.doradoPct);
    if (!Number.isInteger(n) || n < PCT_MIN || n > PCT_MAX) return { ok: false, error: 'El porcentaje va de ' + PCT_MIN + ' a ' + PCT_MAX + '.' };
    next.doradoPct = n;
  }
  if (!('trainingLive' in p) && !('doradoPct' in p)) return { ok: false, error: 'Nada que guardar.' };
  if (!settingsOk) return { ok: false, error: 'El archivo de ajustes no se pudo leer: avísale a Claude antes de cambiar nada.' };
  const before = settings;
  next.updatedAt = Date.now();
  settings = next;
  if (!saveSettings()) { settings = before; return { ok: false, error: 'No se pudo guardar. Vuelve a intentarlo.' }; }
  if (before.trainingLive !== next.trainingLive) console.log('[ruta] El Entrenamiento is ' + (next.trainingLive ? 'LIVE: El Simulacro Dorado now opens by practice' : 'not live: El Simulacro Dorado opens with the key'));
  if (before.doradoPct !== next.doradoPct) console.log('[ruta] El Simulacro Dorado needs ' + next.doradoPct + ' % in every world');
  return { ok: true, settings: getSettings() };
}

// ── each level's La Base: its word count and worlds (from the catalog scripts/audios-build.js writes; the worlds'
//    short names from the base's own data). Read once per boot: a new base comes with a deploy, which restarts. ──
let _bases = null;
function bases() {
  if (_bases) return _bases;
  const out = {};
  let cat = [];
  try { cat = JSON.parse(fs.readFileSync(CATALOG, 'utf8')).bases || []; } catch (e) { console.warn('[ruta] catalog unreadable:', e.message); }
  Levels.LEVELS.forEach((l) => {
    if (!l.base) return;
    const b = cat.find((x) => x && x.id === l.base);
    if (!b || !(Number(b.words) > 0) || !Array.isArray(b.worlds)) return;
    let named = [];
    try { named = JSON.parse(fs.readFileSync(path.join(BASE_DIR, b.id, 'base.json'), 'utf8')).worlds || []; } catch (_) { /* names are a nicety */ }
    let next = 1;
    const worlds = b.worlds.map((w) => {
      const first = Number(w.first) || next;
      const count = Number(w.count) || 0;
      next = first + count;
      const nm = named.find((x) => x && x.n === w.n) || {};
      return { n: Number(w.n), first, count, name: String(nm.name || ''), short: String(nm.short || nm.name || '') };
    }).filter((w) => w.n > 0 && w.count > 0);
    out[l.id] = { id: b.id, level: l.id, words: Number(b.words), worlds };
  });
  _bases = out;
  return _bases;
}
const baseOf = (level) => bases()[Levels.normalize(level)] || null;

// ── the seals as ranges: {1,2,3,5} ⇄ '1-3,5' ─────────────────────────────────────────────────────────────────────
function encodeSeals(set) {
  const a = Array.from(set || []).filter((n) => Number.isInteger(n) && n > 0).sort((x, y) => x - y);
  const out = [];
  for (let i = 0; i < a.length;) {
    let j = i;
    while (j + 1 < a.length && a[j + 1] <= a[j] + 1) j++;
    out.push(a[j] > a[i] ? a[i] + '-' + a[j] : String(a[i]));
    i = j + 1;
  }
  return out.join(',');
}
// (max: the base's word count; anything outside 1…max is dropped, never trusted)
function decodeSeals(str, max) {
  const set = new Set();
  const top = Number(max) > 0 ? Number(max) : 2000;
  String(str || '').split(',').forEach((part) => {
    const m = /^\s*(\d{1,4})(?:-(\d{1,4}))?\s*$/.exec(part);
    if (!m) return;
    const a = Math.max(1, Number(m[1]));
    const b = Math.min(top, m[2] ? Number(m[2]) : Number(m[1]));
    for (let n = a; n <= b; n++) set.add(n);
  });
  return set;
}

// ── reading a record ────────────────────────────────────────────────────────────────────────────────────────────
function entryOf(rec, level) {
  const lvl = Levels.normalize(level);
  const all = rec && rec.ruta && typeof rec.ruta === 'object' && !Array.isArray(rec.ruta) ? rec.ruta : null;
  const e = lvl && all ? all[lvl] : null;
  return e && typeof e === 'object' && !Array.isArray(e) ? e : null;
}
function sealsOf(rec, level) {
  const b = baseOf(level);
  const e = entryOf(rec, level);
  return e && b ? decodeSeals(e.s, b.words) : new Set();
}
function teacherWorlds(e, b) {
  if (!e || !b) return new Set();
  if (e.tw === 'all') return new Set(b.worlds.map((w) => w.n));
  return new Set((Array.isArray(e.tw) ? e.tw : []).map(Number).filter((n) => b.worlds.some((w) => w.n === n)));
}
// is there anything of this level on the record (a profile lists those levels too)
const hasAny = (rec, level) => !!entryOf(rec, level);

// The whole picture of one level for one kid.
//   rec: their record, or null for a phone without a login (then opts.seals = the seals that phone holds: a free tap
//   carries no secret, so a key-only phone may count its own)
// → null (the level has no La Base) | {
//     level, words, sealed, worlds: [{ n, name, short, count, sealed, train, via: 'seals'|'teacher'|null, practiced }],
//     train: { live, open, of, all },               (all = a teacher opened every world)
//     dorado: { rule: 'key'|'practice', open, via: 'key'|'practice'|'teacher'|null, pct, practiced, of, teacher } }
// dorado.open assumes the level's key: callers check LevelKeys.access first (the key is the door, this is the path).
function state(rec, level, opts) {
  const o = opts || {};
  const lvl = Levels.normalize(level);
  const b = baseOf(lvl);
  if (!b) return null;
  const st = getSettings();
  const e = rec ? (entryOf(rec, lvl) || {}) : {};
  const seals = rec ? sealsOf(rec, lvl) : (o.seals instanceof Set ? new Set([...o.seals].filter((n) => Number.isInteger(n) && n >= 1 && n <= b.words)) : new Set());
  const tw = teacherWorlds(e, b);
  const practice = e.p && typeof e.p === 'object' ? e.p : {};
  const worlds = b.worlds.map((w) => {
    let sealed = 0;
    for (let n = w.first; n < w.first + w.count; n++) if (seals.has(n)) sealed++;
    const bySeals = sealed >= w.count;
    const byTeacher = tw.has(w.n);
    const pv = Number(practice[w.n]);
    return { n: w.n, name: w.name, short: w.short, count: w.count, sealed, train: bySeals || byTeacher,
      via: bySeals ? 'seals' : (byTeacher ? 'teacher' : null), teacher: byTeacher,
      practiced: Number.isFinite(pv) && practice[w.n] != null ? pv : null };
  });
  const open = worlds.filter((w) => w.train).length;
  const practiced = worlds.filter((w) => w.practiced != null && w.practiced >= st.doradoPct).length;
  const byTeacher = !!e.td;
  let dorado;
  if (!st.trainingLive) dorado = { rule: 'key', open: true, via: 'key', pct: st.doradoPct, practiced, of: worlds.length, teacher: byTeacher };
  else {
    const all = worlds.length > 0 && practiced === worlds.length;
    dorado = { rule: 'practice', open: byTeacher || all, via: byTeacher ? 'teacher' : (all ? 'practice' : null), pct: st.doradoPct,
      practiced, of: worlds.length, teacher: byTeacher };
  }
  return { level: lvl, words: b.words, sealed: seals.size, worlds,
    train: { live: st.trainingLive, open, of: worlds.length, all: e.tw === 'all' }, dorado };
}

// ── the doors of the steps (phase 4 calls them AFTER LevelKeys.access, never instead of it) ─────────────────────
// a = LevelKeys.access(req, level) · rec = the logged-in kid's record or null · opts.seals = a key-only phone's seals
function trainWorldOpen(a, rec, level, world, opts) {
  if (!a || !a.ok) return false;
  if (a.via === 'teacher') return true;
  const s = state(rec, level, opts);
  const w = s && s.worlds.find((x) => x.n === Number(world));
  return !!(w && w.train);
}
function doradoOpen(a, rec, level, opts) {
  if (!a || !a.ok) return false;
  if (a.via === 'teacher') return true;
  if (!getSettings().trainingLive) return true;           // until El Entrenamiento is live: the key is enough
  if (!rec) return false;                                 // practice is saved on an account: a phone alone can't earn it
  const s = state(rec, level, opts);
  return !!(s && s.dorado.open);
}

// ── writing (through core/student-records.js, which owns the records and their saving) ──────────────────────────
let Students = null;
const students = () => Students || (Students = require('./student-records'));
const fail = (status, error) => ({ ok: false, status, error });

// A kid's stamps / unstamps from La Base (POST /api/ruta/seals). add / remove: arrays of word numbers of the level's
// base, never the same number in both. → { ok, seals: [n…] } | { ok: false, status, error }
function applySeals(code, level, add, remove) {
  const lvl = Levels.normalize(level);
  const b = baseOf(lvl);
  if (!b) return fail(404, 'Ese nivel no tiene La Base.');
  const list = (v) => (v == null ? [] : v);
  const A = list(add), R = list(remove);
  if (!Array.isArray(A) || !Array.isArray(R) || A.length + R.length > b.words * 2) return fail(400, 'Sellos no válidos.');
  const okN = (n) => Number.isInteger(n) && n >= 1 && n <= b.words;
  if (!A.every(okN) || !R.every(okN)) return fail(400, 'Esa palabra no está en La Base de ' + Levels.info(lvl).name + '.');
  const rem = new Set(R);
  if (A.some((n) => rem.has(n))) return fail(400, 'Sellos no válidos.');
  let after = null;
  const rec = students().updateRuta(code, lvl, (e) => {
    const s = decodeSeals(e.s, b.words);
    A.forEach((n) => s.add(n));
    R.forEach((n) => s.delete(n));
    if (s.size) e.s = encodeSeals(s); else delete e.s;
    if (A.length || R.length) e.at = Date.now();
    after = s;
  }, { activity: A.length + R.length > 0 });
  if (!rec) return fail(404, 'No encontramos tu cuenta.');
  return { ok: true, seals: [...after].sort((x, y) => x - y) };
}

// A teacher's «Desbloquear» / «Volver a bloquear» (/maestro). step: 'train' (world: a world number or 'all') | 'dorado'.
// → { ok } | { ok: false, status, error }
function setTeacherUnlock(code, level, step, world, on) {
  const lvl = Levels.normalize(level);
  const b = baseOf(lvl);
  if (!b) return fail(404, 'that level has no La Base');
  if (step !== 'train' && step !== 'dorado') return fail(400, 'unknown step');
  const w = world === 'all' ? 'all' : Number(world);
  if (step === 'train' && w !== 'all' && !b.worlds.some((x) => x.n === w)) return fail(400, 'that world does not exist');
  const rec = students().updateRuta(code, lvl, (e) => {
    if (step === 'dorado') { if (on) e.td = 1; else delete e.td; return; }
    const all = b.worlds.map((x) => x.n);
    let cur = e.tw === 'all' ? new Set(all) : new Set((Array.isArray(e.tw) ? e.tw : []).map(Number).filter((n) => all.includes(n)));
    if (w === 'all') cur = on ? new Set(all) : new Set();
    else if (on) cur.add(w); else cur.delete(w);
    if (!cur.size) delete e.tw;
    else e.tw = cur.size === all.length ? 'all' : [...cur].sort((x, y) => x - y);
  });
  if (!rec) return fail(404, 'student not found');
  return { ok: true };
}

// Phase 4 (El Entrenamiento) hands in a practice of world N of a level: the best % per world stays on the record, and
// El Simulacro Dorado opens by itself once every world has doradoPct % or more (when trainingLive is on).
// → { ok, best } | { ok: false, status, error }
function recordPractice(code, level, world, pct) {
  const lvl = Levels.normalize(level);
  const b = baseOf(lvl);
  if (!b) return fail(404, 'that level has no La Base');
  const w = Number(world);
  if (!b.worlds.some((x) => x.n === w)) return fail(400, 'that world does not exist');
  const p = Number(pct);
  if (!Number.isFinite(p) || p < 0 || p > 100) return fail(400, 'pct must be 0-100');
  let best = 0;
  const rec = students().updateRuta(code, lvl, (e) => {
    const cur = e.p && typeof e.p === 'object' && !Array.isArray(e.p) ? e.p : {};
    best = Math.max(Number(cur[w]) || 0, Math.round(p));
    cur[w] = best;
    e.p = cur;
  }, { activity: true });
  if (!rec) return fail(404, 'student not found');
  return { ok: true, best };
}

module.exports = {
  DEFAULTS, SETTINGS_FILE, PCT_MIN, PCT_MAX,
  loadSettings, getSettings, setSettings,
  bases, baseOf, encodeSeals, decodeSeals,
  entryOf, sealsOf, hasAny, state,
  trainWorldOpen, doradoOpen,
  applySeals, setTeacherUnlock, recordPractice,
};
