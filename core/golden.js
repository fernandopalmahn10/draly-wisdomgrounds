// =========================================================================
// golden.js — El libro dorado: a level's golden book on the web (La Ruta Dorada, phase 5 · his picks 2026-10-16)
// =========================================================================
// The printed golden book («YCT 1 · Simulaciones», «New HSK 1 · Simulaciones», «HSK 1 · Simulaciones») digitally,
// inside El Simulacro Dorado: one phone card per question, simulation by simulation, with its photos, its own play
// button (the original exam recording of that question), the pinyin with tone marks, the Spanish and the answer in
// gold. ONE source with the PDF: ../study/lib/examweb.py exports the book's own questions (study/<book>, exam.py) into
//   content/golden/<book>.json         every simulation's parts and cards + its media lists (read here, never served)
//   protected/golden/<book>/<n>/…      photos p<NN>.webp and clips a<NN>.m4a of simulation n (`ex/` = the examples)
//   protected/golden/<book>/book.pdf   the book (a web copy under 9 MB)
// A level names its book in core/levels.js (`golden`). Old HSK's clips are the platform's own mp3 per question
// (protected/HSK SIMULATIONS/…): the JSON names them, they are served as they are.
//
// His picks (the doors live in server.js, in this order): the level's key (LevelKeys.access, the one door) → an
// account → THAT simulation taken (a graded attempt on the kid's account: solo, homework or a teacher's room all land
// in rec.hskResults through /api/hsk-sim/:simId/submit). Taken anywhere is enough (his pick after the build): a sim
// taken in a teacher's room opens its own book even before the kid earns El Simulacro Dorado
// (RutaProgress.doradoOpen); the other sims (a kid takes them alone only with the Dorado) and the PDF still need it.
// The sim is a real test first, the book is the review. A teacher sees every book and the PDF; a key-only phone has no
// account, so no book («Entra con tu código»). Mistakes first: the book opens on the wrong questions of the kid's
// LATEST graded attempt (its wrongQs), then the whole simulation. The PDF (it holds every answer) downloads once every
// simulation of the book is taken and the Dorado is open. Never leaked: a simulation's cards travel only to whoever
// may open them, its photos and clips are served by index through a checked route (a file name never says an
// answer), and the page code holds no content.
// =========================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Levels = require('./levels');
const SimLock = require('./sim-lock');

const ROOT = path.join(__dirname, '..');
const CONTENT = path.join(ROOT, 'content', 'golden');
const PROT = path.join(ROOT, 'protected');
const MEDIA = path.join(PROT, 'golden');
const TYPES = { '.webp': 'image/webp', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg' };
const LINK_TTL = 12 * 60 * 60 * 1000;    // a teacher's «Ver su libro» link (opened from /maestro, a school day)

// ── the books (read once per boot: a new export comes with a deploy, which restarts) ─────────────────────────────
const _books = new Map();
// only a book a level names in core/levels.js is ever read (and cached): any other name is null, never a disk read
function book(id) {
  if (!/^[a-z0-9]{1,32}$/.test(String(id || '')) || !Levels.LEVELS.some((l) => l.golden === id)) return null;
  if (_books.has(id)) return _books.get(id);
  let b = null;
  try {
    b = JSON.parse(fs.readFileSync(path.join(CONTENT, id + '.json'), 'utf8'));
    if (!b || b.id !== id || !Array.isArray(b.sims) || !b.sims.length || b.sims.some((s, i) => !s || s.n !== i + 1 || !Array.isArray(s.parts))) {
      console.warn('[golden] ' + id + '.json has no simulations in order: the book stays closed');
      b = null;
    }
  } catch (e) { if (e.code !== 'ENOENT') console.warn('[golden] ' + id + '.json unreadable:', e.message); b = null; }
  _books.set(id, b);
  return b;
}
// a level (stored id or curriculum name) → its book, or null (a level without a golden book yet)
function ofLevel(level) {
  const lvl = Levels.normalize(level);
  const info = lvl ? Levels.info(lvl) : null;
  return info && info.golden ? book(info.golden) : null;
}
// a simulation by its number, written only one way ('1'…'99': never '01', '1.0' or ' 1', so one file has one address)
const simOf = (b, n) => (b && /^[1-9]\d?$/.test(String(n)) ? b.sims[Number(n) - 1] || null : null);

// ── the kid's attempts (rec.hskResults, written by /api/hsk-sim/:simId/submit) ──────────────────────────────────────
// A graded attempt of that simulation (total > 0) that really answered the exam (his pick: «the sim is a real test
// first»): since 2026-10-16 the submit records how many questions were really answered (`answeredCount`, counted by
// the grader) out of how many (`questions`); a try needs at least half of them. One handed in blank, or with a
// question or two (a shortcut to the answers), opens no book. Older tries keep the old rule: anything but blank.
function real(t) {
  if (!(Number(t.total) > 0) || t.answeredCount === 0) return false;
  const q = Number(t.questions);
  return !(q > 0) || Number(t.answeredCount) * 2 >= q;
}
function attempts(rec, simId) {
  return (rec && Array.isArray(rec.hskResults) ? rec.hskResults : []).filter((t) => t && t.simId === simId && real(t));
}
function latest(rec, simId) {
  return attempts(rec, simId).reduce((best, t) => (!best || (Number(t.ts) || 0) >= (Number(best.ts) || 0) ? t : best), null);
}
const taken = (rec, simId) => attempts(rec, simId).length > 0;
// server.js tells the totals the graders count today (a try with another total predates a change of the simulation:
// old HSK sims 1-6 had 30 questions until 2026-06; its record of wrong questions does not fit the book)
const hooks = { totalOf: () => null };
function configure(h) { Object.assign(hooks, h || {}); }
const fits = (t) => { const now = hooks.totalOf(t.simId); return !now || Number(t.total) === now; };
// the latest attempt's mistakes (null: a try that kept no breakdown, before 2026-06-04, or one that does not fit)
function mistakesOf(t) { return t && Array.isArray(t.wrongQs) && fits(t) ? t.wrongQs.length : null; }

// TF answers come as 'T' / 'F' (YCT, New HSK) or true / false (old HSK); letters as they are
function answerText(v) {
  if (v === true || v === 'true' || v === 'T') return 'T';
  if (v === false || v === 'false' || v === 'F') return 'F';
  const s = String(v == null ? '' : v).trim().toUpperCase();
  return /^[A-F]$/.test(s) ? s : null;
}
// what the page needs of the latest attempt: its %, passed or not, and the questions it got wrong (with the kid's own
// answer). Passed = the exam's pass line as a share (YCT / HSK: 120 of 200 = 60 %): old HSK grades in points of 400.
function attemptView(t, sim) {
  if (!t) return null;
  const wrong = Array.isArray(t.wrongQs) && fits(t) ? t.wrongQs : null;
  const given = {};
  (wrong || []).forEach((w) => { if (w && typeof w.qid === 'string') given[w.qid] = answerText(w.given); });
  const percent = Math.round(Number(t.percent) || 0);
  const line = sim && Number(sim.total) > 0 ? Math.round((100 * Number(sim.pass)) / Number(sim.total)) : 60;
  return { ts: Number(t.ts) || 0, percent, passed: percent >= line,
    wrong: wrong ? wrong.map((w) => String(w && w.qid)).filter((q) => /^[LR]\d-\d{1,3}$/.test(q)) : null, given };
}

// ── one level's book for one visitor: per simulation taken / mistakes, and the PDF ───────────────────────────────
// rec: the kid's record (null for a teacher or a phone without a login) · teacher: sees every book and the PDF ·
// dorado: the kid's El Simulacro Dorado is open (the PDF, which holds every answer, also needs it; a taken sim's own
// book does not)
function summary(b, rec, teacher, dorado) {
  if (!b) return null;
  const sims = b.sims.map((s) => {
    const t = rec ? latest(rec, s.id) : null;
    return { n: s.n, id: s.id, taken: !!t, mistakes: t ? mistakesOf(t) : null, open: !!(teacher || t) };
  });
  const left = teacher ? 0 : sims.filter((s) => !s.taken).length;
  return { book: b.id, sims, left,
    pdf: { ready: !!teacher || (!!rec && dorado !== false && left === 0), dorado: !!teacher || dorado !== false, mb: b.pdf && b.pdf.mb, pages: b.pdf && b.pdf.pages } };
}

// ── what the page draws: one simulation's cards, its media as checked links (by index) ───────────────────────────
const mediaUrl = (b, where, kind, i, v) => '/golden-media/' + b.id + '/' + where + '/' + kind + i + (v ? '?v=' + encodeURIComponent(v) : '');
function mediaList(b, where, pack) {
  return {
    pics: (pack.pics || []).map((p, i) => ({ url: mediaUrl(b, where, 'p', i, p.v), w: p.w, h: p.h })),
    clips: (pack.clips || []).map((c, i) => mediaUrl(b, where, 'a', i, c.v)),
  };
}
function simView(b, n) {
  const s = simOf(b, n);
  if (!s) return null;
  return Object.assign({ n: s.n, id: s.id, total: s.total, pass: s.pass, questions: s.questions, parts: s.parts }, mediaList(b, String(s.n), s));
}
// (the examples go with ANY open book: their word lists never say which simulation question a word answers, only the
// example's own «Ej.», whatever an export holds)
function examplesView(b) {
  const e = b && b.examples;
  if (!e || !Array.isArray(e.parts)) return null;
  const parts = e.parts.map((p) => (Array.isArray(p.bank)
    ? Object.assign({}, p, { bank: p.bank.map((x) => { const r = Object.assign({}, x); if (r.for !== 'ex') delete r.for; return r; }) }) : p));
  return Object.assign({ parts }, mediaList(b, 'ex', e));
}

// ── a file of the book, from its index in the JSON (never a path taken from the address) ─────────────────────────
// where: '<n>' (a simulation) | 'ex' (the examples); name: 'p<i>' (photo) | 'a<i>' (clip) → { abs, type } | null
function mediaFile(b, where, name) {
  const m = /^(p|a)(\d{1,3})$/.exec(String(name || ''));
  if (!b || !m) return null;
  const pack = where === 'ex' ? b.examples : simOf(b, where);
  const e = pack && (m[1] === 'p' ? pack.pics : pack.clips) ? (m[1] === 'p' ? pack.pics : pack.clips)[Number(m[2])] : null;
  if (!e) return null;
  const abs = path.resolve(e.src ? path.join(PROT, e.src) : path.join(MEDIA, b.id, String(e.f || '')));
  const type = TYPES[path.extname(abs).toLowerCase()];
  if (!type || !abs.startsWith(PROT + path.sep)) return null;
  return { abs, type };
}
const pdfFile = (b) => (b ? path.join(MEDIA, b.id, 'book.pdf') : null);

// ── a teacher's «Ver su libro» (/maestro → a kid's profile): which kid's mistakes to show, sealed ──────────────────
// The link carries the kid's account and level encrypted with a key derived from the server's signing key (AES-GCM):
// nothing readable in the address or a log line, and it expires. It opens only for a teacher session that may see that
// kid (server.js checks _canSessionTouchStudent); a kid holding it sees only their own book.
const LINK_KEY = Buffer.from(SimLock.hmacHex('draly-golden-teacher-link', 64), 'hex');
function teacherLink(code, level, ttl) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', LINK_KEY, iv);
  const body = Buffer.concat([c.update(JSON.stringify([String(code), String(level), Date.now() + (ttl || LINK_TTL)]), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString('base64url');
}
function readTeacherLink(tok) {
  if (typeof tok !== 'string' || tok.length < 40 || tok.length > 300 || !/^[A-Za-z0-9_-]+$/.test(tok)) return null;
  try {
    const raw = Buffer.from(tok, 'base64url');
    const d = crypto.createDecipheriv('aes-256-gcm', LINK_KEY, raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    const [code, level, exp] = JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8'));
    if (!(Number(exp) > Date.now())) return null;
    return { code: String(code), level: String(level) };
  } catch (_) { return null; }
}

module.exports = {
  CONTENT, MEDIA, TYPES,
  book, ofLevel, simOf, attempts, latest, taken, mistakesOf, answerText, attemptView, configure,
  summary, simView, examplesView, mediaFile, pdfFile,
  teacherLink, readTeacherLink,
};
