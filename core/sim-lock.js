// =========================================================================
// sim-lock.js — the exam simulations are for enrolled students and teachers only
// (La Ruta Dorada, phase 1, 2026-10-15). His words: "if anyone random accesses our platform and goes directly to the
// simulations we could get in trouble, and we're not going to give away everything for free".
// =========================================================================
// What this module owns (the checks that need live rooms or student records stay in server.js):
//   · Where the locked files live: protected/<YCT|NEW HSK|HSK> SIMULATIONS/… (recordings + pictures) and
//     protected/pages/ (yct-sim.html, hsk-sim.html and the level key screen level-key.html). Nothing is under public/, so the
//     static server can never hand it out, and nothing is under /assets/ (Cloudflare keeps /assets/* for 2 h).
//   · Media links: the sim data keeps its media as logical URLs (/assets/YCT%20SIMULATIONS/…, what yct-import.js and
//     core/hsk-sim.js write). rewrite() turns every one of them into /sim-media/<token>/<fileId>.<ext>: the token is
//     signed with the server key, expires (3 h), is bound to ONE simulation and to the way in (a teacher's room PIN is
//     re-checked on every file, so the files stop when the room closes); the file id is an HMAC of the path, so no
//     «(CORRECT)» / «(TRUE)» from an old file name ever reaches a phone.
//   · The student session cookie `dsim` (httpOnly, 12 h): code + level, set by the /homework login (or by the key
//     screen from the codes the phone already saved; re-checked on every request in server.js). Never the code in a
//     URL. Since 2026-10-15 (second round) a session alone opens nothing locked: core/level-keys.js decides with the
//     level's key; a teacher is a remembered teacher device (core/level-keys.js), not a sim session any more.
//   · The room pass: joining a teacher's exam room (socket player:join) gives the phone one; the room's sim loads only
//     with it, so a PIN guessed from outside opens nothing. The submit ticket in each payload hands an exam in even
//     after the room closed (a student's ticket carries their own code: their grade, their record).
//   · The signing key: env SIM_LOCK_SECRET, else env SIM_LOCK_KEY_HEX (the data disk's key as 64 hex, so it survives a
//     lost disk; 2026-10-20), else data/sim-lock.key (made once on the data disk, so links and sessions survive a
//     restart or a deploy), else a random key for this run.
// =========================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'protected');
const PAGES = path.join(DIR, 'pages');
const FAMILY_RE = /^(YCT|NEW HSK|HSK) SIMULATIONS\/\1 (\d+)\/SIMULATION (\d+)\//;   // the folder names the sim ids
const FAMILY_ID = { 'YCT': 'yct', 'NEW HSK': 'newhsk', 'HSK': 'hsk' };
const TYPES = { '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
const MEDIA_TTL = 3 * 60 * 60 * 1000;      // a whole exam (YCT ≈ 45 min, New HSK ≈ 1 h) with room to spare
const COOKIE = 'dsim';
const COOKIE_TTL = 12 * 60 * 60 * 1000;    // the friendly page renews it silently from the phone's saved codes
const MISSING = '/sim-media/missing';      // a referenced file that is not on disk: a quiet 404, never src=""

// ── the key ──────────────────────────────────────────────────────────────────────────────────────────────────────
function loadKey() {
  const env = process.env.SIM_LOCK_SECRET;
  if (env && env.length >= 32) return Buffer.from(env, 'utf8');
  // 2026-10-20 (scale): the SAME key as data/sim-lock.key, kept in Render's settings (64 hex = the file's text) so it
  // survives a lost data disk without travelling in every weekly backup; phones signed with the file stay signed in
  const hexEnv = String(process.env.SIM_LOCK_KEY_HEX || '').trim();
  if (/^[a-f0-9]{64}$/i.test(hexEnv)) return Buffer.from(hexEnv, 'hex');
  const file = path.join(process.env.DRALY_DATA_DIR || path.join(ROOT, 'data'), 'sim-lock.key');   // tests: their own folder
  try {
    const hex = fs.readFileSync(file, 'utf8').trim();
    if (/^[a-f0-9]{64}$/.test(hex)) return Buffer.from(hex, 'hex');
  } catch (_) { /* first run */ }
  const key = crypto.randomBytes(32);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, key.toString('hex'), { mode: 0o600 });
  } catch (e) { console.warn('[sim-lock] key not saved, links and sessions end at the next restart:', e.message); }
  return key;
}
const KEY = loadKey();
const mac = (s) => crypto.createHmac('sha256', KEY).update(s).digest();
const b64u = (buf) => Buffer.from(buf).toString('base64url');

// purpose 'm' = media link · 'x' = submit ticket · 'c' = session cookie · 'p' = room pass · 'l' = a level's key on a
// device · 'T' = a remembered teacher device (core/level-keys.js). A token of one purpose never works as another.
function sign(purpose, fields, ttl) {
  const exp = Math.floor((Date.now() + ttl) / 1000).toString(36);
  const body = [purpose].concat(fields.map((f) => String(f == null ? '' : f).replace(/~/g, '')), exp).join('~');
  return b64u(body) + '.' + b64u(mac(body)).slice(0, 22);
}
function verify(token, purpose) {
  if (typeof token !== 'string' || token.length > 400) return null;
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  let body;
  try { body = Buffer.from(token.slice(0, dot), 'base64url').toString('utf8'); } catch (_) { return null; }
  const want = Buffer.from(b64u(mac(body)).slice(0, 22));
  const got = Buffer.from(token.slice(dot + 1));
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;
  const parts = body.split('~');
  if (parts[0] !== purpose || parts.length < 3) return null;
  const exp = parseInt(parts[parts.length - 1], 36);
  if (!exp || exp * 1000 < Date.now()) return null;
  return parts.slice(1, -1);
}

// ── the file index (one scan of protected/, ~1000 files; again when a new sim's file is asked for) ───────────────
let FILES = new Map();     // fileId → { id, abs, rel, sim, ext }
let BY_REL = new Map();    // 'YCT SIMULATIONS/YCT 1/SIMULATION 1/listening.m4a' → the same entry
let scannedAt = 0;
function scan() {
  const files = new Map();
  const byRel = new Map();
  const walk = (dir, rel) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const e of entries) {
      const r = rel + '/' + e.name;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) { walk(abs, r); continue; }
      const m = FAMILY_RE.exec(r);
      const ext = path.extname(e.name).toLowerCase();
      if (!m || !TYPES[ext]) continue;
      const f = { id: mac('file:' + r).toString('hex').slice(0, 24), abs, rel: r, sim: FAMILY_ID[m[1]] + m[2] + '-sim' + m[3], ext };
      files.set(f.id, f);
      byRel.set(r, f);
    }
  };
  Object.keys(FAMILY_ID).forEach((fam) => walk(path.join(DIR, fam + ' SIMULATIONS'), fam + ' SIMULATIONS'));
  FILES = files;
  BY_REL = byRel;
  scannedAt = Date.now();
}
const stale = () => Date.now() - scannedAt > 60 * 1000;
function fileByRel(rel) {
  if (!scannedAt) scan();
  if (!BY_REL.has(rel) && stale()) scan();
  return BY_REL.get(rel) || null;
}
function fileById(id) {
  if (!scannedAt) scan();
  if (!FILES.has(id) && stale()) scan();
  return FILES.get(id) || null;
}

// '/assets/YCT%20SIMULATIONS/YCT%201/SIMULATION%201/images/L1_1.webp' (as the sim data writes it) → its path in
// protected/ ('YCT SIMULATIONS/YCT 1/SIMULATION 1/images/L1_1.webp'), or null for anything else
function relOf(url) {
  if (typeof url !== 'string' || url.length > 400 || url.slice(0, 8) !== '/assets/') return null;
  let p;
  try { p = decodeURIComponent(url.slice(8).split(/[?#]/)[0]); } catch (_) { return null; }
  if (!FAMILY_RE.test(p) || p.split('/').some((s) => !s || s === '.' || s === '..')) return null;
  return p;
}
const isSimMediaUrl = (url) => !!relOf(url);

// The sim a protected URL belongs to (a logical /assets/… URL or a /sim-media/ link), or null.
function simOfUrl(url) {
  const rel = relOf(url);
  if (rel) { const f = fileByRel(rel); return f ? f.sim : null; }
  const m = /^\/sim-media\/[^/]+\/([a-f0-9]{24})\.[a-z0-9]+$/.exec(String(url || ''));
  const f = m && fileById(m[1]);
  return f ? f.sim : null;
}
// A /sim-media/ link or a logical URL → the logical URL (to check it against a list such as the picture catalog).
function logicalUrl(url) {
  if (relOf(url)) return url;
  const m = /^\/sim-media\/[^/]+\/([a-f0-9]{24})\.[a-z0-9]+$/.exec(String(url || ''));
  const f = m && fileById(m[1]);
  return f ? '/assets/' + f.rel.split('/').map(encodeURIComponent).join('/') : null;
}

// grant = how this request may see the sim: { kind: 't' teacher | 's' logged-in student with the level open |
// 'k' a device with the level's key (no login) | 'r' kid in a teacher's room (pin) | 'w' kid in a Modo Maestro room
// (pin) | 'd' local test harness }
const mediaToken = (grant, sim) => sign('m', [grant.kind, sim, grant.pin || ''], MEDIA_TTL);
// the submit ticket travels in the JSON body (never a URL): a student's carries their own code, so a grade handed in
// with it always lands on their record
const ticket = (grant, sim) => sign('x', [grant.kind, sim, grant.pin || '', grant.kind === 's' ? grant.studentCode || '' : ''], MEDIA_TTL);
// The room pass: what joining a teacher's exam room (socket player:join, so the kid is on the teacher's roster) gives
// a phone; the room's sim loads only with it (a bare PIN guessed from outside opens nothing).
const ROOM_PASS_TTL = 6 * 60 * 60 * 1000;   // an exam room lives 6 h at most
// Bound to the room's creation moment too (2026-10-15 review): a PIN used again later never reopens with an old pass.
const roomPass = (pin, sim, createdAt) => sign('p', [pin, sim, Number(createdAt) || 0], ROOM_PASS_TTL);
function roomPassOk(tok, pin, sim, createdAt) {
  const v = verify(tok, 'p');
  return !!(v && v[0] === String(pin) && v[1] === sim && v[2] === String(Number(createdAt) || 0));
}
// An HMAC of `s` with the server key, hex (e.g. a fingerprint that must not be testable offline)
const hmacHex = (s, n) => mac(String(s)).toString('hex').slice(0, n || 16);

// Every protected media URL inside `value` (any depth) → its signed link for `grant`. A new copy; `value` is untouched.
function rewrite(value, grant) {
  const tokens = {};
  const swap = (s) => {
    const rel = relOf(s);
    if (!rel) return s;
    const f = fileByRel(rel);
    if (!f) return MISSING;
    const t = tokens[f.sim] || (tokens[f.sim] = mediaToken(grant, f.sim));
    return '/sim-media/' + t + '/' + f.id + f.ext;
  };
  if (typeof value === 'string') return swap(value);
  return JSON.parse(JSON.stringify(value), (k, v) => (typeof v === 'string' ? swap(v) : v));
}
// One signed link for a single logical URL (e.g. the picture a teacher pushes to a room).
const linkFor = (url, grant) => rewrite(String(url || ''), grant);

// A /sim-media/<token>/<file> request → { file, kind, sim, pin } or { status } (403 bad/expired/other sim, 404 no file).
function openMedia(token, name) {
  const v = verify(token, 'm');
  if (!v) return { status: 403 };
  const m = /^([a-f0-9]{24})\.[a-z0-9]{2,4}$/.exec(String(name || ''));
  const f = m && fileById(m[1]);
  if (!f) return { status: 404 };
  if (f.sim !== v[1]) return { status: 403 };      // a link of one simulation never opens another one's files
  return { file: f, kind: v[0], sim: v[1], pin: v[2], type: TYPES[f.ext] };
}
// A submit ticket for `sim` → { kind, pin } or null.
function ticketGrant(tok, sim) {
  const v = verify(tok, 'x');
  return v && v[1] === sim ? { kind: v[0], pin: v[2] || '', studentCode: v[3] || '', ticket: true } : null;
}

// ── cookies (the student session here; the level keys and teacher devices in core/level-keys.js) ───────────────────
// `headers` = req.headers or a socket's handshake headers
function readCookie(reqOrHeaders, name) {
  const h = (reqOrHeaders && reqOrHeaders.headers) || reqOrHeaders || {};
  const raw = String(h.cookie || '');
  const want = name || COOKIE;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === want) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch (_) { return ''; }
    }
  }
  return '';
}
const https = (req) => !!req.secure || /^https$/i.test(String((req.headers && req.headers['x-forwarded-proto']) || '').split(',')[0].trim());
// One httpOnly, same-site cookie (never readable by page scripts; Secure behind https). maxAgeMs 0 = delete it.
function setCookie(req, res, name, value, maxAgeMs) {
  res.append('Set-Cookie', name + '=' + (value || '') + '; Path=/; Max-Age=' + Math.max(0, Math.floor((maxAgeMs || 0) / 1000)) +
    '; HttpOnly; SameSite=Lax' + (https(req) ? '; Secure' : ''));
}
// 🔒 2026-10-18 (security review F2): a kid's sessions carry the account's `kidGen` (server.js plugs in genOf(code));
// «Cerrar su sesión en todos los teléfonos» in /maestro bumps it and every session made before stops at once. A session
// without the field (made before) counts as generation 0.
const sessionHooks = { genOf: () => 0 };
function configureSessions(h) { Object.assign(sessionHooks, h || {}); }
const genOfCode = (code) => { try { return String(Number(sessionHooks.genOf(code)) || 0); } catch (_) { return '0'; } };
// → { kind: 's', code, level } | null (server.js re-checks the student still exists)
function session(req) {
  const v = verify(readCookie(req), 'c');
  if (!v) return null;
  if (v[0] === 's' && v[1] && v[2] && String(v[3] || '0') === genOfCode(v[1])) return { kind: 's', code: v[1], level: v[2] };
  return null;
}
// → the cookie's value (server.js: an automatic account's renewed session is read by the same request, 2026-10-18)
function setSession(req, res, kind, code, level) {
  const tok = sign('c', [kind, code || '', level || '', genOfCode(code)], COOKIE_TTL);
  setCookie(req, res, COOKIE, tok, COOKIE_TTL);
  return tok;
}

// ── local test harness: yct-sim.html?debug=1&direct=1… opens without a room on this PC only ───────────────────────
// Never on Render (RENDER is set there), never through a proxy or Cloudflare, only to localhost from localhost.
function isLocalDev(req) {
  if (process.env.RENDER || process.env.SIM_LOCK_DEV === '0') return false;
  const h = req.headers || {};
  if (h['x-forwarded-for'] || h['forwarded'] || h['cf-connecting-ip'] || h['x-real-ip']) return false;
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(String(h.host || ''))) return false;
  const ra = String((req.socket && req.socket.remoteAddress) || '');
  return ra === '127.0.0.1' || ra === '::1' || ra === '::ffff:127.0.0.1';
}

// ── the pages ─────────────────────────────────────────────────────────────────────────────────────────────────
const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0', 'CDN-Cache-Control': 'no-store',
  'Cloudflare-CDN-Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'X-Content-Type-Options': 'nosniff' };
function sendPage(res, name) {
  if (!/^(yct|hsk)-sim\.html$/.test(name)) return res.status(404).end();
  res.set(NO_STORE);
  res.sendFile(path.join(PAGES, name));
}
// (Who is refused gets the level's key screen, core/level-keys.js sendKeyScreen: protected/pages/level-key.html.)

module.exports = {
  DIR, PAGES, NO_STORE, COOKIE,
  relOf, isSimMediaUrl, simOfUrl, logicalUrl, rewrite, linkFor, ticket, ticketGrant, roomPass, roomPassOk, openMedia, hmacHex,
  session, setSession, configureSessions, isLocalDev, sendPage, scan,
  sign, verify, readCookie, setCookie, https,
  _sign: sign, _verify: verify,   // tests
};
