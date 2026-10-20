// usage-peaks.js — how many classes ran at the same time, day by day (2026-10-20, his ask "fully scalable": the monthly
// health check must know when the one Starter server needs to grow).
// server.js samples every 30 s (`_liveRoomStats`):
//   · rooms   = live rooms (a connected projector or a connected kid: the same notion as /api/_diag `liveRooms`);
//   · classes = live rooms with at least CLASS_KIDS (5) kids connected: a real class, the load the server feels (a
//               projector left open with nobody in it is not a class; review 2026-10-20);
//   · players = the kids connected in live rooms.
// Per day (his clock, UTC−6) the highest of each is kept for today and the last 60 days in data/usage-peaks.json:
// numbers only, never a name, a PIN or a code. Written at most every 2 minutes, and only when a peak went up or a new
// day began. /api/_diag shows the 30-day peak; scripts/health-check.js reads it (warning at 3 classes or 90 kids at
// once, red line at 5 classes or 150 kids on the Starter server; Render's Standard ≈ 10 classes).
'use strict';
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DRALY_DATA_DIR || path.join(__dirname, '..', 'data');   // tests: their own folder
const FILE = path.join(DATA_DIR, 'usage-peaks.json');
const KEEP_DAYS = 61;                                                   // today + the last 60
const CLASS_KIDS = 5;                                                   // a live room with this many kids = a class
const OFFSET_H = Number.isFinite(Number(process.env.DRALY_UTC_OFFSET_HOURS)) && process.env.DRALY_UTC_OFFSET_HOURS !== ''
  ? Number(process.env.DRALY_UTC_OFFSET_HOURS) : -6;                     // his time (classes 4 p.m. on, UTC−6)
const WRITE_MS = Math.max(200, Number(process.env.DRALY_PEAKS_WRITE_MS) || 2 * 60 * 1000);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_N = 100000;                                                   // a sane ceiling for any count
const FIELDS = ['rooms', 'classes', 'players'];

let days = Object.create(null);   // 'YYYY-MM-DD' → { rooms, classes, players }
let dirty = false;
let lastWrite = 0;

const dayKey = (t) => new Date(t + OFFSET_H * 3600e3).toISOString().slice(0, 10);
const count = (n) => (Number.isFinite(Number(n)) ? Math.max(0, Math.min(MAX_N, Math.floor(Number(n)))) : 0);
const blank = () => ({ rooms: 0, classes: 0, players: 0 });

function prune(now) {
  const keep = new Set();
  for (let i = 0; i < KEEP_DAYS; i++) keep.add(dayKey(now - i * 86400e3));
  for (const k of Object.keys(days)) if (!keep.has(k)) delete days[k];
}

function load() {
  days = Object.create(null);
  let raw = null;
  try { raw = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (_) { return; }   // first boot, or unreadable: start fresh
  const src = raw && typeof raw === 'object' && raw.days && typeof raw.days === 'object' ? raw.days : {};
  for (const k of Object.keys(src)) {
    const d = src[k];
    if (!DAY_RE.test(k) || !d || typeof d !== 'object') continue;
    days[k] = { rooms: count(d.rooms), classes: count(d.classes), players: count(d.players) };
  }
  prune(Date.now());
}

function flush(now = Date.now()) {
  if (!dirty) return false;
  prune(now);
  const out = {};
  Object.keys(days).sort().forEach((k) => { out[k] = { rooms: days[k].rooms, classes: days[k].classes, players: days[k].players }; });
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ v: 1, utcOffsetHours: OFFSET_H, classKids: CLASS_KIDS, days: out }), 'utf8');
    fs.renameSync(tmp, FILE);
    dirty = false;
    lastWrite = now;
    return true;
  } catch (e) {
    console.warn('[usage-peaks] write failed (kept in memory):', e.message);
    lastWrite = now;                                                    // try again at the next window, not every sample
    return false;
  }
}

// One sample: { rooms, classes, players } right now.
function note(s, now = Date.now()) {
  const k = dayKey(now);
  if (!days[k]) { days[k] = blank(); dirty = true; }                    // a day the server was up counts, even with 0
  const cur = days[k];
  for (const f of FIELDS) {
    const n = count(s && s[f]);
    if (n > cur[f]) { cur[f] = n; dirty = true; }
  }
  if (dirty && now - lastWrite >= WRITE_MS) flush(now);
}

// The highest of each over the last `n` days (today included) → { rooms, classes, players, days: days with a sample }
function peak(n = 30, now = Date.now()) {
  const out = blank();
  let seen = 0;
  for (let i = 0; i < n; i++) {
    const d = days[dayKey(now - i * 86400e3)];
    if (!d) continue;
    seen++;
    for (const f of FIELDS) out[f] = Math.max(out[f], d[f]);
  }
  out.days = seen;
  return out;
}

try { load(); } catch (e) { console.warn('[usage-peaks] load failed:', e.message); days = Object.create(null); }

module.exports = { note, peak, flush, load, dayKey, FILE, CLASS_KIDS };
