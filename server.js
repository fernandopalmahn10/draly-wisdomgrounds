const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const Sets = require('./core/sets');
const Images = require('./core/images');
const Students = require('./core/student-records');
const TeacherPresets = require('./core/teacher-presets');
const ReadingStory = require('./core/reading-story');
const HskSim = require('./core/hsk-sim');
// YCT mock exams (core/yct/*.json) share the HSK room/PIN/submit plumbing;
// these helpers route a simId to the right engine by its prefix.
const YctSim = require('./core/yct-sim');
const _simPayload = (id) => (YctSim.isYct(id) ? YctSim.buildSimPayload(id) : HskSim.buildSimPayload(id));
const _simGrade = (id, a) => (YctSim.isYct(id) ? YctSim.gradeSim(id, a) : HskSim.gradeSim(id, a));
const _simMeta = (id) => (HskSim.SIMULATIONS || {})[id] || YctSim.get(id) || null;
const SimTrainer = require('./core/sim-trainer');
const SimImages = require('./core/sim-images');
const SimLock = require('./core/sim-lock');   // 🔒 simulations for enrolled students + teachers only (2026-10-15)
SimLock.scan();                                 // the index of the locked files (~1000, a few ms), before the first class
const LevelKeys = require('./core/level-keys'); // 🔑 a key per level opens La Base / Entrenamiento / Simulacro Dorado (2026-10-15)
const RutaProgress = require('./core/ruta-progress'); // 🏆 La Ruta Dorada: seals on the kid's record + the unlock engine (2026-10-16)
const Train = require('./core/entrenamiento');        // 🎯 El Entrenamiento: practice world by world, graded here (phase 4, 2026-10-16)
const Golden = require('./core/golden');             // 📖 El libro dorado: the golden book on the web (phase 5, 2026-10-16)
const Zoco = require('./core/zoco');                 // 🪙 El Zoco de Dralingo: coins from real steps + the characters shop (2026-10-19)
const UsagePeaks = require('./core/usage-peaks');    // 📈 the most classes at the same time, per day (2026-10-20, scale)
const SentenceCategories = require('./core/sentence-categories');
const Assignments = require('./core/assignments');
const Teachers = require('./core/teachers');
// (2026-10-19) a class code still on kids' accounts is never handed to another class (new, added or renamed codes)
Teachers.configure({ classCodesOnKids: () => Students.classroomCodesInUse() });
const Levels = require('./core/levels');
const Packs = require('./core/packs');
const Saga = require('./public/js/saga');   // the saga cast + animations (2026-10-12)
const Classrooms = require('./core/classrooms');
const Guides = require('./core/guides');
const Emirati = require('./core/emirati-vocab');
const CustomAsg = require('./core/custom-assignments');
const Kingdoms = require('./core/kingdoms');
const Paint = require('./core/paint');
const Snow = require('./core/snow');                 // Batalla de Nieve en Ski Dubái (rules)
const SnowMap = require('./public/js/snow-map');     // … and its map, shared with the phones and the projector
const Escape = require('./core/escape');             // La Gran Fuga de Dubái (rules)
const EscapeMap = require('./public/js/escape-map'); // … and its zona segura rooms, shared with the phones and the projector
const Party = require('./core/party');               // the Mario Party ending of Reinos / Pintores / Nieve / Fuga (stars, «¡FINAL!»)
const Halcon = require('./core/halcon');             // Ojos de Halcón: Mario Party «Looking for Love» in boards of 4 (rules)
const Mono = require('./core/monopoly');             // Dàfùwēng · Monopolio v2: «El Gran Tablero de Dubái», boards of 4 (rules)
const Dorm = require('./core/dormilon');
const Crab = require('./core/teamcrab');   // ¡Atrapa a Fénec!: Mario Party «Team Crab», the crew of a robot crab vs Fénec (rules)             // ¡No despiertes a Dralingo!: Mario Party «Don't Wake Wiggler», boards of 4 (rules)
const Dragon = require('./core/dragon');               // Vuelo del Dragón v2: «La Carrera del Cielo de Dubái», races of 4 (rules)
const Mochi = require('./core/mochi');               // Mochi Mash v2: «La Terraza del Mochi», team mash + ceremony (rules)
const Pinata = require('./core/pinata');             // Piñata Tigre v2: «La Fiesta de las Piñatas», team hits + timing meter (rules)
const Sixseven = require('./core/sixseven');         // 6-7 Swing v2: «La Balanza de Oro», sums that are always 6 or 7 (rules)
const Trap = require('./core/trapdoor');             // Las Trampillas: Mario Party's trapdoor platform, Fuego vs Mar (rules)
const GameNames = require('./core/game-names');      // the «Draly Party» names (2026-10-23) + the old ones kids' inboxes kept
// Tiny persistence for the owner's Emirati Arabic gateway (single global
// profile, since this is a super-admin-only personal feature). Lives on the
// same data disk as the rest of the JSON state.
const _emFs = require('fs');
const _emPath = require('path');
const EMIRATI_FILE = _emPath.join(__dirname, 'data', 'emirati-progress.json');
function _emiratiRead() {
  try { return JSON.parse(_emFs.readFileSync(EMIRATI_FILE, 'utf8')); }
  catch (_) { return { seen: [], streak: 0, lastDate: null }; }
}
function _emiratiWrite(state) {
  try {
    const dir = _emPath.dirname(EMIRATI_FILE);
    if (!_emFs.existsSync(dir)) _emFs.mkdirSync(dir, { recursive: true });
    _emFs.writeFileSync(EMIRATI_FILE, JSON.stringify(state, null, 2));
  } catch (e) { console.warn('[emirati] write failed:', e.message); }
}
function _emiratiYesterday(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 5e6,
  // Detect dead clients faster — default is 25s/20s which is too forgiving for
  // classroom wifi. With these, a frozen client is reaped after ~20s and the
  // grace-period rejoin path kicks in cleanly instead of leaving phantom slots.
  pingInterval: 10000,
  pingTimeout: 20000,
  // Allow both transports; clients prefer websocket first but fall back to
  // polling on locked-down networks.
  transports: ['websocket', 'polling'],
  // 🔒 2026-10-17 — a socket only from the platform's own pages (see _socketOriginOk below)
  allowRequest: (req, done) => {
    const ok = _socketOriginOk(req);
    if (!ok) _noteRefusedOrigin(req.headers.origin);
    done(null, ok);
  },
});
// 🔒 2026-10-17 — which pages may open a live-game socket. WebSockets ignore CORS, so a page on ANY site could open one
// from a teacher's browser (the remembered-teacher cookie may ride along) and act as that teacher's projector. On a
// socket handshake a browser always names the page's site in Origin: it must be ours (the address the request reached,
// app.dralingo.app / dralingo.app / www, the old Render address, localhost while developing (never on Render);
// DRALY_SOCKET_ORIGINS adds hosts, comma-separated). No Origin at all = not a page on another site (the test scripts
// and bots, a same-origin polling request): let in, every teacher check still applies. «null» (a sandboxed frame, a
// file) is not, nor JSONP polling (`j=`: a <script> tag on another site sends no Origin; our client never uses it) or
// a request the browser itself marks cross-site.
const _SOCKET_HOSTS = new Set(['app.dralingo.app', 'dralingo.app', 'www.dralingo.app']
  .concat(process.env.RENDER ? [] : ['localhost', '127.0.0.1', '[::1]'])
  .concat(String(process.env.DRALY_SOCKET_ORIGINS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)));
function _socketOriginOk(req) {
  const h = (req && req.headers) || {};
  // (engine.io picks JSONP by its decoded query, `_query.j`, filled before it asks us; the raw URL as a fallback)
  if ((req && req._query && typeof req._query.j === 'string') || /[?&](j|%6a)=/i.test(String((req && req.url) || ''))) return false;
  if (h.origin === undefined || h.origin === '') return h['sec-fetch-site'] !== 'cross-site';
  let u;
  try { u = new URL(String(h.origin)); } catch (_) { return false; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  if (u.host.toLowerCase() === String(h.host || '').toLowerCase()) return true;   // the same address the page came from
  const host = u.hostname.toLowerCase();   // (no port; an IPv6 keeps its brackets)
  if (_SOCKET_HOSTS.has(host) || host === MOVE_FROM_HOST) return true;
  try { return host === new URL(MOVE_TO_ORIGIN).hostname.toLowerCase(); } catch (_) { return false; }
}
const _refusedOrigins = new Map();   // origin → when it was last written to the log (once an hour each)
function _noteRefusedOrigin(origin) {
  const k = String(origin).slice(0, 120), now = Date.now();
  if (now - (_refusedOrigins.get(k) || 0) < 3600e3) return;
  if (_refusedOrigins.size > 500) _refusedOrigins.clear();
  _refusedOrigins.set(k, now);
  console.warn('[security] socket refused: a page on another site (origin ' + JSON.stringify(k) + ')');
}

// 🆕 2026-10-12 — the platform's address is now https://app.dralingo.app (through his Cloudflare). localStorage is per
// address, so a PAGE opened at the old Render address hands the phone's saved data to the new address once, then goes
// there (otherwise kids lose their saved student code and make duplicate accounts; teachers their login / lesson packs).
//  · small values (student code, class code, avatar, language…) travel in the URL fragment (never sent to a server);
//  · big or secret ones (a teacher's lesson packs, saved password) travel once through the server under a one-time
//    token (POST /api/move/start → GET /api/move/:token, 10 min, 512 KB each, 25 MB for all moves together); if that
//    fails the phone simply stays on the old address and tries again next visit: nothing is ever left behind;
//  · after one complete move the old address only forwards (dralyMovedTo), so data removed on the new address (a
//    teacher logging out) never comes back from an old bookmark;
//  · the new address accepts saved data only when the visit really came from the old address (referrer) and writes
//    only keys it doesn't have yet (a different student code there is kept, the old one saved as dralyStudentCodePrev).
// Not moved: API calls, live-game sockets, files, the projector, live-game and exam pages (/host-*.html, player.html,
// yct-sim.html, hsk-sim.html: mid-class sessionStorage and reloads), one-click launches (?autohost / livemaster /
// livegame), and anything with ?nomove=1. Kids move when they open the home page, homework, audios or parents' view.
// MOVE_FROM_HOST / MOVE_TO_ORIGIN override both addresses for local tests (launch config dralingo-move-test).
const MOVE_FROM_HOST = String(process.env.MOVE_FROM_HOST || 'draly-wisdomgrounds-2.onrender.com').toLowerCase();
const MOVE_TO_ORIGIN = process.env.MOVE_TO_ORIGIN || 'https://app.dralingo.app';
const MOVE_KEYS_RE = /^(draly|mochi\.|hw_|em_|wu_)/i;   // the platform's own saved keys (homework, player, maestro, warm-up)
const _moves = new Map();                               // token → { data, at, bytes }
let _movesBytes = 0;
const MOVE_PAGE = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="origin">
<title>Draly Wisdom Grounds</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fdf6e9;color:#1d2440;font:700 1.2rem system-ui,sans-serif}</style>
</head><body><p>Cargando… 🐉</p><script>
(function () {
  var NEW = ${JSON.stringify(MOVE_TO_ORIGIN)}, FROM = ${JSON.stringify(MOVE_FROM_HOST)}, RE = ${MOVE_KEYS_RE.toString()};
  function stay() { var u = new URL(location.href); u.searchParams.set('nomove', '1'); location.replace(u.toString()); }
  if (location.host.toLowerCase() !== FROM) { stay(); return; }          // never loop on any other address
  var to = location.pathname + location.search + location.hash;
  var moved = false;
  try { moved = localStorage.getItem('dralyMovedTo') === NEW; } catch (e) {}
  var small = {}, big = {}, nSmall = 0, nBig = 0;
  if (!moved) {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!RE.test(k) || k === 'dralyMovedTo') continue;
        var v = localStorage.getItem(k);
        if (v.length <= 300 && !/pw|pass/i.test(k)) { small[k] = v; nSmall++; } else { big[k] = v; nBig++; }
      }
    } catch (e) {}
  }
  if (moved || (!nSmall && !nBig)) { location.replace(NEW + to); return; }
  function go(token) {
    var h = 'to=' + encodeURIComponent(to);
    if (nSmall) h += '&d=' + encodeURIComponent(JSON.stringify(small));
    if (token) h += '&t=' + token;
    try { localStorage.setItem('dralyMovedTo', NEW); } catch (e) {}
    location.replace(NEW + '/move.html#' + h);
  }
  if (!nBig) { go(''); return; }
  var x = new XMLHttpRequest();
  x.open('POST', '/api/move/start'); x.setRequestHeader('Content-Type', 'application/json'); x.timeout = 8000;
  x.onload = function () { var t = ''; try { t = JSON.parse(x.responseText).token || ''; } catch (e) {} if (t) go(t); else stay(); };
  x.onerror = x.ontimeout = stay;
  x.send(JSON.stringify({ data: big }));
})();
</script></body></html>`;
// The arrival page on the new address (served from code so it knows which address it may accept data from).
const MOVE_ARRIVE_PAGE = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Draly Wisdom Grounds</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fdf6e9;color:#1d2440;font:700 1.2rem system-ui,sans-serif}</style>
</head><body><p>Cargando… 🐉</p><script>
(function () {
  var FROM = ${JSON.stringify(MOVE_FROM_HOST)}, RE = ${MOVE_KEYS_RE.toString()};
  var h = new URLSearchParams(location.hash.slice(1));
  try { history.replaceState(null, '', '/move.html'); } catch (e) {}
  var dest = '/';
  try { var u = new URL(h.get('to') || '/', location.origin); if (u.origin === location.origin) dest = u.href; } catch (e) {}   // absolute: '//x' tricks can't leave the site
  var done = false;
  function go() { if (done) return; done = true; location.replace(dest); }
  var ref = '';
  try { ref = new URL(document.referrer).host.toLowerCase(); } catch (e) {}
  if (ref !== FROM) { go(); return; }                                    // only a real move may write saved data here
  function put(obj) {
    Object.keys(obj || {}).forEach(function (k) {
      try {
        if (!RE.test(k) || k === 'dralyMovedTo' || typeof obj[k] !== 'string') return;
        var cur = localStorage.getItem(k);
        if (cur === null) localStorage.setItem(k, obj[k]);
        else if (k === 'dralyStudentCode' && cur !== obj[k] && localStorage.getItem('dralyStudentCodePrev') === null) {
          localStorage.setItem('dralyStudentCodePrev', obj[k]);          // two accounts on this phone: keep both codes
        }
      } catch (e) {}
    });
  }
  try { put(JSON.parse(h.get('d') || '{}')); } catch (e) {}
  var t = h.get('t');
  if (!t || !/^[a-f0-9]{32}$/.test(t)) { go(); return; }
  setTimeout(go, 10000);                                                 // never stuck on this page
  fetch('/api/move/' + t, { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (j) { if (j && j.ok) put(j.data); })
    .catch(function () {})
    .then(go);
})();
</script></body></html>`;
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path === '/move.html') {                                       // arrival page: never on the old address
    if (String(req.headers.host || '').toLowerCase() === MOVE_FROM_HOST) return res.redirect(302, MOVE_TO_ORIGIN + '/');
    res.set('Cache-Control', 'no-store');
    return res.type('html').send(MOVE_ARRIVE_PAGE);
  }
  if (String(req.headers.host || '').toLowerCase() !== MOVE_FROM_HOST) return next();
  if (/^\/(api|socket\.io|assets|js|css|health|healthz|_render-health)(\/|$)/i.test(req.path)) return next();
  if (/^\/(host-[^/]*|player|yct-sim|hsk-sim)\.html$/i.test(req.path)) return next();   // projector, live game, exams: never mid-activity
  if (/\.[a-z0-9]+$/i.test(req.path) && !/\.html$/i.test(req.path)) return next();      // files: served as usual
  if (['nomove', 'autohost', 'livemaster', 'livegame'].some((q) => q in req.query)) return next();
  if (!/text\/html/i.test(String(req.headers.accept || ''))) return next();            // scripts, health checks, bots
  res.set('Cache-Control', 'no-store');
  res.type('html').send(MOVE_PAGE);
});
// 🔒 2026-10-15 — La Ruta Dorada, phase 1: the exam simulations are no longer open to anyone with the address (his
// words: "we're not going to give away everything for free"). Pages, data AND media (core/sim-lock.js):
//  · /yct-sim.html and /hsk-sim.html live in protected/pages/ and open only for: a kid with the PIN of a teacher's open
//    room, a logged-in student (the `dsim` session cookie the /homework login sets) — with ?sim= only for their own
//    level —, a teacher (cookie from their /maestro code), or the local test harness (?debug=1&direct=1, this PC only).
//    Everyone else gets the friendly «Este simulacro es para alumnos de Dralingo» page.
//  · the recordings and pictures live in protected/ and only travel as signed /sim-media/ links inside a payload the
//    request was allowed to see (never under /assets/: Cloudflare keeps /assets/* for 2 h).
// The files left the old /assets/… addresses: those answer 404 (even for copies left on a PC that never got pushed).
// (2026-10-15 review: every /assets/ path is decoded BEFORE it is tested, so %73tudy or %53IMULATIONS can't slip by)
app.use((req, res, next) => {
  if (!/(assets|%)/i.test(req.path)) return next();   // a cheap pre-test; the decoded path decides
  let p = req.path;
  try { p = decodeURIComponent(p); } catch (_) { /* keep raw */ }
  p = path.posix.normalize(p.replace(/\\/g, '/')).toLowerCase();
  if (!/^\/+assets\/+([^/]*simulations|study(\/|$)|audios\/+[^/]*-base(\/|$))/.test(p)) return next();
  res.set(SimLock.NO_STORE);
  res.status(404).type('text').send('Not found');
});
app.get(['/yct-sim.html', '/hsk-sim.html'], (req, res) => _simPageGate(req, res));
app.get('/sim-media/:token/:file', (req, res) => _simMediaFile(req, res));
// 🔑 2026-10-15 (second round) — La Base is no longer free either: its data, clips, pictures and the La Base PDF left
// public/ for protected/base/<level>-base/ and protected/study/, served only through /base-media/ to a request that
// may use that level (core/level-keys.js access()). The old /assets/… addresses answer 404 (a copy that a build tool
// writes into public/ again, e.g. a new PDF from ../study/lib/web.py, is never served from there).
// (the guard above answers them)
app.get('/base-media/:base/*', (req, res) => _baseMediaFile(req, res));
// Serve static assets. HTML pages get no-cache headers so phones always pull
// the latest markup (otherwise stale cached HTML keeps referencing old
// rewards.js / player.js versions and users see "nothing changed" after a
// deploy). Versioned CSS/JS via ?v=... are still cached aggressively.
// 🆕 2026-10-20 (scale) — Cloudflare serves the platform's own files, so 30 phones in a class stop downloading the same
// pictures, sounds and music from the one Render server (_staticCache below), for files of public/assets, js and css:
//   · asked for with EXACTLY `?v=<a version today's pages ask for>` → a year, immutable (a new ?v= is a new file).
//     Only versions found in our pages and code at boot (core/asset-refs.js): a guessed future ?v= (they are dates)
//     must never get today's file stored for a year (review 2026-10-20);
//   · asked for with no query at all → phones 10 min (Cache-Control), Cloudflare 1 day + stale-while-revalidate
//     (Cloudflare-CDN-Cache-Control, which only Cloudflare reads: a phone never shows a day-old picture). A re-made
//     picture under the same name shows within a day: give changed art a new name or ?v=;
//   · any other query (?t=…, an unknown ?v=, several) → as before (public, max-age=0).
// HTML pages, sw.js, the manifest and everything outside public/ (/api, /base-media, sims, golden book, study PDFs, key
// screens) are untouched. `node scripts/test-cache-versions.js` fails a deploy whose changed file kept its old ?v= (or
// a changed script asked for without one): a forgotten bump would otherwise stick for a year.
const AssetRefs = require('./core/asset-refs');
const _STATIC_LONG = 'public, max-age=31536000, immutable';
const _STATIC_SHORT = 'public, max-age=600';
const _STATIC_SHORT_CDN = 'public, max-age=86400, stale-while-revalidate=86400';
const _PUBLIC_DIR = path.join(__dirname, 'public');
let _knownV = new Map();   // '/js/x.js' → Set of the ?v= today's pages ask for (~50 ms at boot)
try { _knownV = AssetRefs.knownVersions(__dirname); } catch (e) { console.warn('[cache] versions not read (no year-long caching):', e.message); }
function _staticCache(res, filePath) {
  const rel = path.relative(_PUBLIC_DIR, filePath).split(path.sep).join('/');
  const top = rel.split('/')[0];
  if (top !== 'assets' && top !== 'js' && top !== 'css') return;   // sw.js, the manifest, root files: as before
  const url = String((res.req && (res.req.originalUrl || res.req.url)) || '');
  const qi = url.indexOf('?');
  const q = qi < 0 ? '' : url.slice(qi + 1);
  if (!q) {
    res.setHeader('Cache-Control', _STATIC_SHORT);
    res.setHeader('Cloudflare-CDN-Cache-Control', _STATIC_SHORT_CDN);
    return;
  }
  const m = /^v=([A-Za-z0-9._-]{1,64})$/.exec(q);
  const known = m && _knownV.get('/' + rel);
  if (known && known.has(m[1])) res.setHeader('Cache-Control', _STATIC_LONG);
}
app.use(express.static(_PUBLIC_DIR, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (/[\\/]assets[\\/]png-library[\\/]/.test(filePath)) {
      // 🆕 2026-06-08 (Fernando) — transparent dancing GIFs (3MB each)
      // get blasted to every kid's phone for the GIF push feature.
      // Without long caching, each blast re-downloads 3MB per kid.
      // With immutable+1yr cache, the kid's browser downloads it ONCE
      // ever and replays from disk for every future push — that turns
      // a 90MB-per-30-kids hit into 0 bytes after day 1. The asset
      // filenames are stable (CR7 TRANSPARENT.gif, etc.) so immutable
      // is honest; if you ever swap an asset, rename it.
      res.setHeader('Cache-Control', _STATIC_LONG);
    } else {
      _staticCache(res, filePath);
    }
  },
}));
app.use(express.json({ limit: '5mb' }));
// 🆕 2026-10-18: an automatic account's session comes back from its device cookie before ANY route reads a session
// (security review L5; the function lives with the automatic accounts, «AUTOMATIC STUDENT ACCOUNTS» below)
app.use(_autoRenew);
// 🆕 2026-10-18 (la entrada): the same for a kid the phone remembers from the entrance (its `dkid` cookie, «LA ENTRADA» below)
app.use(_kidRenew);
// The move to app.dralingo.app (see MOVE_PAGE above): the old address leaves a phone's big saved data here once...
app.post('/api/move/start', (req, res) => {
  const now = Date.now();
  for (const [t, m] of _moves) if (now - m.at > 10 * 60 * 1000) { _movesBytes -= m.bytes; _moves.delete(t); }
  const src = req.body && req.body.data;
  if (!src || typeof src !== 'object' || Array.isArray(src)) return res.status(400).json({ ok: false });
  const data = {};
  let bytes = 0;
  for (const [k, v] of Object.entries(src)) {
    if (!MOVE_KEYS_RE.test(k) || k === 'dralyMovedTo' || typeof v !== 'string' || k.length > 80) continue;
    bytes += 2 * (k.length + v.length);                    // JS strings: up to 2 bytes per character
    data[k] = v;
  }
  if (bytes > 512 * 1024) return res.status(413).json({ ok: false });
  if (_moves.size >= 300 || _movesBytes + bytes > 25 * 1024 * 1024) return res.status(429).json({ ok: false });
  const token = require('crypto').randomBytes(16).toString('hex');
  _moves.set(token, { data, at: now, bytes });
  _movesBytes += bytes;
  res.json({ ok: true, token });
});
// ...and the new address picks it up once (the arrival page writes only what the phone doesn't already have there).
app.get('/api/move/:token', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const t = String(req.params.token);
  const m = _moves.get(t);
  if (m) { _moves.delete(t); _movesBytes -= m.bytes; }
  if (!m || Date.now() - m.at > 10 * 60 * 1000) return res.status(404).json({ ok: false });
  res.json({ ok: true, data: m.data });
});
// Health endpoints — Render hits one of these to verify the server is
// alive after each deploy. Three paths covered because different
// platforms look for different names. All return plain "ok" in <1ms
// with no DB / disk access, so they pass the strictest timeout.
app.get(['/health', '/healthz', '/_render-health'], (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.type('text/plain').send('ok');
});
// Diagnostic: confirms every game module + sets + teachers are loaded.
// Visit /api/_diag to verify deploy is fully wired after a release.
app.get('/api/_diag', (req, res) => {
  const out = { ok: true, ts: Date.now(), commit: process.env.RENDER_GIT_COMMIT || 'local' };
  try { out.sets = Sets.listSets().length; } catch (e) { out.setsErr = e.message; }
  try { out.assignments = Assignments.listAssignments().length; } catch (e) { out.asgErr = e.message; }
  try { out.teachers = Teachers.listAll().length; } catch (e) { out.teachersErr = e.message; }
  try { out.stories = Object.keys(ReadingStory.STORIES || {}).length; } catch (e) { out.storiesErr = e.message; }
  // monthly health check (scripts/health-check.js): sizes only, never content. The student file is rewritten whole on
  // every save, so its size is the early sign that it should move to a database (~20 MB).
  try {
    const fs = require('fs');
    out.studentRecordsBytes = fs.statSync(path.join(__dirname, 'data', 'student-records.json')).size;
  } catch (_) { out.studentRecordsBytes = null; }
  try {
    const a = Students.archiveStats();
    out.archivedAccounts = a.archived;
    out.archiveBytes = a.bytes;
    if (a.broken) out.archiveBroken = true;
  } catch (_) { /* older module */ }
  const mu = process.memoryUsage();
  out.memoryMB = Math.round(mu.rss / 1048576);
  out.uptimeHours = Math.round(process.uptime() / 360) / 10;
  out.rooms = Object.keys(games || {}).length;
  // 2026-10-17: rooms with someone in them right now (a connected projector or a connected kid). `rooms` also counts
  // rooms kept up to an hour after their projector left (so a teacher can come back): the deploy guard reads this one.
  try { out.liveRooms = _liveRoomStats().rooms; } catch (_) { out.liveRooms = out.rooms; }
  // 2026-10-20 (scale): the most live rooms, classes (rooms with 5+ kids) and kids connected at the same time over the
  // last 30 days, numbers only (core/usage-peaks.js; `days` = how many of those days the server sampled).
  // scripts/health-check.js reads it.
  try { out.peak30 = UsagePeaks.peak(30); } catch (_) { /* no peaks yet */ }
  res.set('Cache-Control', 'no-store');
  res.json(out);
});
// Right now: live rooms (a connected projector or at least one connected kid), classes (live rooms with 5+ kids
// connected: core/usage-peaks.js CLASS_KIDS) and the kids connected in them.
function _liveRoomStats() {
  let rooms = 0, classes = 0, players = 0;
  for (const g of Object.values(games)) {
    if (!g) continue;
    const kids = Object.values(g.players || {}).filter((p) => p && !p.disconnected).length;
    if ((g.hostId && io.sockets.sockets.get(g.hostId)) || kids) { rooms++; players += kids; if (kids >= UsagePeaks.CLASS_KIDS) classes++; }
  }
  return { rooms, classes, players };
}
// 2026-10-20 (scale): every 30 s, today's peak of classes at once and kids connected (written at most every 2 min)
setInterval(() => {
  try { UsagePeaks.note(_liveRoomStats()); } catch (e) { console.warn('[usage-peaks] sample failed:', e.message); }
}, Math.max(200, Number(process.env.DRALY_PEAKS_SAMPLE_MS) || 30 * 1000)).unref();

// === /api/admin/disk-status — Render persistent-disk verification ===
// Hit this from any browser with ?pw=<your admin password>. Tells you:
//   - The resolved absolute path of the data/ directory
//   - Whether it's writable RIGHT NOW
//   - Stats on the student-records.json file
//   - A "persistence likely" heuristic (file exists + writable + recently modified)
// Use this to confirm your Render Disk is mounted at the correct path
// before relying on per-student history surviving across deploys.
// 🆕 2026-06-16 (Fernando) — ONE-CLICK BACKUP (Option B). Streams a
// JSON snapshot of every runtime data file (student records, presets,
// teachers, HSK rooms, etc.) as a single downloadable file. The teacher
// taps "Descargar respaldo" on /maestro → browser saves
// draly-backup-<date>.json → drag into Google Drive. This is the manual
// safety net until off-site auto-backup (Option C) lands. Admin-gated.
//
// Why JSON not tar: keeps it dependency-free + works from any browser
// (no shell). Bundles every *.json under data/ plus a manifest. PII
// stays admin-gated; never cached.
// 🆕 2026-10-20 (scale, his OK: "back it up weekly without pressing anything") — a second door for the laptop's weekly
// script (tools/backup/pull-backup.js, Sunday 7:00): the header X-Backup-Token, compared in constant time with the env
// var BACKUP_TOKEN (unset, empty or shorter than 32 characters = this door is OFF and the header means nothing). It
// opens THIS endpoint only (no other route reads that header), a wrong key answers exactly like a wrong teacher code
// and counts in the same turnstile (10 per address in 10 min), 6 pulls a day at most, and the log says «backup pulled
// by the weekly key» with the address (never the key). The file holds every kid, teacher code and level key: the key
// is as precious as the super admin's code.
// The bundle (format 2): every data/*.json read in one go (one moment: an account moving to the archive is never in
// neither), then streamed with the guides and sets read in small pieces (a disk full of guides never fills the
// server's 512 MB; one backup at a time):
//   { _meta, files: { "<name>.json": <its JSON> } (as before), raw: { "<name>.json": "<base64>" } (a .json that does not
//     parse, e.g. a «.unreadable-<time>.json» copy the server parked), guides: { "<file>.pdf": "<base64>" } (data/guides/, the
//     teacher guide PDFs), sets: { "<file>": "<base64>" } (data/sets/, uploaded question sets), keys: { "sim-lock.key":
//     "<text>" } (ONLY in the super admin's own download: the key that signs every remembered phone, level key and
//     teacher device never changes, so one copy is enough, best in Render's env SIM_LOCK_KEY_HEX; a weekly file that
//     leaks must not let anyone sign devices), _end: { ok, errors } }  — how to restore: docs/BACKUP.md.
const _BACKUP_TOKEN = String(process.env.BACKUP_TOKEN || '').trim();
const _BACKUP_TOKEN_ON = _BACKUP_TOKEN.length >= 32;
if (process.env.BACKUP_TOKEN && !_BACKUP_TOKEN_ON) console.warn('[backup] BACKUP_TOKEN is shorter than 32 characters: the weekly key is OFF');
const _BACKUP_PER_DAY = 6;
const _backupPulls = [];   // when the weekly key pulled (last 24 h)
let _backupSince = 0;      // one backup at a time (each holds a few MB; three at once must never squeeze the server)
const _backupBusy_ = () => _backupSince && Date.now() - _backupSince < 15 * 60e3;   // a stalled download frees it after 15 min
const _sha256 = (s) => require('crypto').createHash('sha256').update(String(s), 'utf8').digest();
function _backupTokenOk(given) {
  const g = String(given == null ? '' : given).trim();
  return _BACKUP_TOKEN_ON && !!g && require('crypto').timingSafeEqual(_sha256(g), _sha256(_BACKUP_TOKEN));
}
app.get('/api/admin/backup', (req, res) => {
  res.set({ 'Cache-Control': 'no-store', 'Cloudflare-CDN-Cache-Control': 'no-store' });
  if (req.method !== 'GET') return res.status(405).set('Allow', 'GET').end();   // (a HEAD would read every file for nothing)
  if (_BACKUP_TOKEN_ON && req.headers['x-backup-token'] !== undefined) {
    const ip = _clientIp(req);
    if (_adminFailCount(ip) >= 10) return res.status(429).json({ ok: false, error: 'demasiados intentos, espera unos minutos' });
    if (!_backupTokenOk(req.headers['x-backup-token'])) {
      _adminNoteFail(ip);
      return res.status(401).json({ ok: false, error: 'wrong password' });   // the same answer as a wrong teacher code
    }
    if (_backupBusy_()) return res.status(429).json({ ok: false, error: 'ya se está haciendo un respaldo, prueba en un minuto' });
    const now = Date.now();
    while (_backupPulls.length && now - _backupPulls[0] > 86400e3) _backupPulls.shift();
    if (_backupPulls.length >= _BACKUP_PER_DAY) {
      console.warn('[backup] the weekly key asked again: ' + _BACKUP_PER_DAY + ' backups in 24 h already, refused (from ' + ip + ')');
      return res.status(429).json({ ok: false, error: 'ya hubo ' + _BACKUP_PER_DAY + ' respaldos hoy, espera a mañana' });
    }
    _backupPulls.push(now);
    console.log('[backup] backup pulled by the weekly key (from ' + ip + ')');
    return _sendBackup(req, res, 'weekly key', false);
  }
  const session = _adminAuth(req, res);
  if (!session) return;
  // Only the super-admin can pull a full-platform backup (it contains
  // EVERY classroom's data). Regular teachers are denied.
  if (!(session.isSuperAdmin)) {
    return res.status(403).json({ ok: false, error: 'solo super-admin puede descargar el respaldo completo' });
  }
  if (_backupBusy_()) return res.status(429).json({ ok: false, error: 'ya se está haciendo un respaldo, prueba en un minuto' });
  console.log('[backup] backup pulled by the super admin');
  return _sendBackup(req, res, 'super admin', true);
});
async function _sendBackup(req, res, by, withKeys) {
  const fs = require('fs'), fsp = fs.promises;
  const DATA_DIR = process.env.DRALY_DATA_DIR || path.join(__dirname, 'data');
  const filesIn = (dir, test) => {
    try { return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile() && test(e.name)).map((e) => e.name).sort(); } catch (_) { return []; }
  };
  // one moment: the lists and every JSON file, read back to back with nothing else running in between
  let top;
  try { top = fs.readdirSync(DATA_DIR, { withFileTypes: true }); } catch (err) {
    return res.status(500).json({ ok: false, error: 'no se pudo leer data/: ' + err.message });
  }
  const errors = [];
  // whole, valid JSON goes in `files` as it is; a .json that does not parse goes in `raw` as its bytes (base64), so it
  // can still be restored: a copy the server parked on purpose («<name>.unreadable-<time>.json», kept for recovery) is
  // no error; any other broken file is (PARTIAL on the laptop)
  const rawFiles = [];
  const jsonFiles = [];
  top.filter((e) => e.isFile() && e.name.endsWith('.json')).map((e) => e.name).sort().forEach((n) => {   // as before
    let buf;
    try { buf = fs.readFileSync(path.join(DATA_DIR, n)); } catch (_) { errors.push(n); return; }
    try {
      const text = buf.toString('utf8').trim();
      JSON.parse(text);
      jsonFiles.push([n, text]);
    } catch (_) {
      rawFiles.push([n, buf.toString('base64')]);
      if (!/\.unreadable-\d+\.json$/.test(n)) errors.push(n + ' (not valid JSON: kept in raw)');
    }
  });
  const guideNames = filesIn(path.join(DATA_DIR, 'guides'), (n) => !n.startsWith('.'));
  const setNames = filesIn(path.join(DATA_DIR, 'sets'), (n) => /\.(csv|xlsx|xls)$/i.test(n));
  let keyText = null;
  if (withKeys) { try { keyText = fs.readFileSync(path.join(DATA_DIR, 'sim-lock.key'), 'utf8').trim() || null; } catch (_) { /* none on this disk */ } }
  const mine = _backupSince = Date.now();
  const stamp = new Date().toISOString().slice(0, 10);
  res.status(200);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="draly-backup-' + stamp + '.json"');
  let gone = false;
  res.on('close', () => { gone = true; });
  // write and wait while the connection is full; a closed connection never leaves this waiting
  const put = (s) => new Promise((ok) => {
    if (gone || res.destroyed || res.writableEnded) { gone = true; return ok(); }
    if (res.write(s)) return ok();
    const done = () => { res.off('drain', done); res.off('close', done); ok(); };
    res.on('drain', done);
    res.on('close', done);
  });
  // one file as base64, read 192 KB at a time (a multiple of 3 bytes: the pieces join into one base64 string)
  // → 'ok' | 'cut' (written, but the read failed half way) | 'gone' (deleted a moment ago) | 'unreadable' (nothing written)
  const putFile = async (file, prefix) => {
    let fh;
    try { fh = await fsp.open(file, 'r'); } catch (e) { return e.code === 'ENOENT' ? 'gone' : 'unreadable'; }
    try {
      await put(prefix + '"');
      const buf = Buffer.alloc(3 * 65536);
      let rest = Buffer.alloc(0);
      for (;;) {
        if (gone) break;
        const { bytesRead } = await fh.read(buf, 0, buf.length, null);
        if (!bytesRead) break;
        const chunk = Buffer.concat([rest, buf.subarray(0, bytesRead)]);
        const cut = chunk.length - (chunk.length % 3);
        rest = Buffer.from(chunk.subarray(cut));
        await put(chunk.subarray(0, cut).toString('base64'));
      }
      await put(rest.toString('base64') + '"');
      return 'ok';
    } catch (e) {
      await put('"');                             // the string closes; the file is listed as cut in _end
      return 'cut';
    } finally { try { await fh.close(); } catch (_) {} }
  };
  const meta = { generatedAt: new Date().toISOString(), commit: process.env.RENDER_GIT_COMMIT || 'local', format: 2, by,
    counts: { files: jsonFiles.length, raw: rawFiles.length, guides: guideNames.length, sets: setNames.length, keys: keyText ? 1 : 0 } };
  try {
    await put('{"_meta":' + JSON.stringify(meta) + ',\n"files":{');
    for (let i = 0; i < jsonFiles.length && !gone; i++) await put((i ? ',\n' : '\n') + JSON.stringify(jsonFiles[i][0]) + ':' + jsonFiles[i][1]);
    await put('},\n"raw":{');
    for (let i = 0; i < rawFiles.length && !gone; i++) await put((i ? ',\n' : '\n') + JSON.stringify(rawFiles[i][0]) + ':"' + rawFiles[i][1] + '"');
    jsonFiles.length = 0; rawFiles.length = 0;    // (let the texts go before the long part)
    for (const [key, names] of [['guides', guideNames], ['sets', setNames]]) {
      await put('},\n' + JSON.stringify(key) + ':{');
      let first = true;
      for (const n of names) {
        if (gone) break;
        const r = await putFile(path.join(DATA_DIR, key, n), (first ? '\n' : ',\n') + JSON.stringify(n) + ':');
        if (r === 'gone') continue;               // deleted by a teacher a moment ago: simply not in this backup
        if (r === 'ok' || r === 'cut') first = false;
        if (r !== 'ok') errors.push(key + '/' + n + (r === 'cut' ? ' (cut)' : ''));
      }
    }
    await put('},\n"keys":{' + (keyText ? '"sim-lock.key":' + JSON.stringify(keyText) : ''));
    await put('},\n"_end":' + JSON.stringify({ ok: !errors.length, errors }) + '}\n');
    if (!gone) res.end();
  } catch (err) {
    console.warn('[backup] the backup stream stopped:', err.message);
    try { res.destroy(err); } catch (_) {}
  } finally {
    if (_backupSince === mine) _backupSince = 0;
  }
}

// 🔒 2026-06-21 (Security Phase 1) — shared admin-auth hardening helpers.
//   • _adminPw: read the admin secret from the X-Admin-Password HEADER first
//     (so it stops landing in URLs, server logs and browser history), and
//     still fall back to the legacy ?pw= query param so nothing breaks.
//   • _safeEqual: constant-time compare so the super-admin password can't be
//     recovered one character at a time via response-timing.
//   • _adminFail*: a per-IP turnstile that counts ONLY failed attempts —
//     after 10 wrong guesses in 10 min an IP gets 429s, which stops
//     brute-forcing. Legit teachers (who send the right code) never fail,
//     so their dashboard polling is never throttled.
function _clientIp(req) {
  return _ipFromHeaders(req.headers || {}, req.connection?.remoteAddress);
}
// 🔒 2026-10-15: Cloudflare's CF-Connecting-IP first (Cloudflare overwrites it, so a visitor can't fake it on
// app.dralingo.app the way they can put anything first in X-Forwarded-For); the old order otherwise. The old Render
// address still takes any header: lock it to Cloudflare to make every per-address limit exact.
// 🔒 2026-10-15 (security review): a client can write any CF-Connecting-IP or X-Forwarded-For it likes, e.g. through
// the old onrender.com address, so neither is believed blindly any more (every per-address limit hangs on this):
//   · the hop that reached us = the LAST X-Forwarded-For entry (Render's proxy appends the address that connected to
//     it), or the socket address when there is no proxy;
//   · CF-Connecting-IP counts only when that hop is Cloudflare (its published ranges), or on this PC's own tests
//     (loopback, never on Render);
//   · IPv6 addresses count per /64 (one home network), so a prefix can't mint endless addresses.
const _CF_V4 = ['173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18', '108.162.192.0/18',
  '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14',
  '172.64.0.0/13', '131.0.72.0/22'].map((c) => { const [a, b] = c.split('/'); return [a.split('.').reduce((n, x) => n * 256 + +x, 0), +b]; });
const _CF_V6 = ['2400:cb00', '2606:4700', '2803:f800', '2405:b500', '2405:8100', '2c0f:f248'];   // /32s (+ 2a06:98c0::/29 below)
function _v4num(ip) { const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip); return m ? ((+m[1] * 256 + +m[2]) * 256 + +m[3]) * 256 + +m[4] : null; }
function _isCloudflare(ip) {
  const n = _v4num(ip);
  if (n != null) return _CF_V4.some(([base, bits]) => Math.floor(n / 2 ** (32 - bits)) === Math.floor(base / 2 ** (32 - bits)));
  const s = ip.toLowerCase();
  if (_CF_V6.some((p) => s.startsWith(p + ':'))) return true;
  const m = /^2a06:([0-9a-f]{1,4}):/.exec(s);
  return !!(m && (parseInt(m[1], 16) & 0xfff8) === 0x98c0);
}
function _cleanIp(ip) {
  let s = String(ip || '').trim().replace(/^\[|\]$/g, '');
  if (/^::ffff:\d+\.\d+\.\d+\.\d+$/i.test(s)) s = s.slice(7);
  if (!s.includes(':')) return s;
  // IPv6: its /64 (the first four groups, '::' expanded)
  const [head, tail] = s.toLowerCase().split('::');
  const h = head ? head.split(':') : [];
  const t = tail !== undefined ? (tail ? tail.split(':') : []) : [];
  const groups = tail !== undefined ? h.concat(Array(Math.max(0, 8 - h.length - t.length)).fill('0'), t) : h;
  return groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':') + '::/64';
}
function _ipFromHeaders(h, remote) {
  const xff = String(h['x-forwarded-for'] || '').split(',').map((x) => x.trim()).filter(Boolean);
  const hop = _cleanIp(xff.length ? xff[xff.length - 1] : remote);
  const loopTest = !process.env.RENDER && /^(127\.0\.0\.1|::1)$/.test(String(remote || '').replace(/^::ffff:/, '')) && !xff.length;
  const cf = String(h['cf-connecting-ip'] || '').split(',')[0].trim();
  if (cf && (_isCloudflare(hop) || loopTest)) return _cleanIp(cf);
  return hop || 'unknown';
}
const _socketIp = (socket) => _ipFromHeaders(socket.handshake.headers || {}, socket.handshake.address);
// 🔒 2026-10-11 — every browser page now sends the code in the X-Admin-Pw header
// (URI-encoded so any character fits in a header; decoded here) or a JSON body
// field `pw`. The ?pw= / ?password= query param is a TRANSITION fallback only, so
// pages cached before this change keep working: remove it once every teacher has
// reloaded, because query strings are written to Render/proxy access logs.
function _adminPw(req) {
  const h = req.headers || {};
  let v = h['x-admin-password'] || '';
  if (!v && h['x-admin-pw']) {
    v = h['x-admin-pw'];
    try { v = decodeURIComponent(v); } catch (_) { /* not URI-encoded: use as-is */ }
  }
  if (!v && req.body && typeof req.body === 'object' && typeof req.body.pw === 'string') v = req.body.pw;
  if (!v && req.query) v = req.query.pw || req.query.password || '';
  return String(v || '').trim();
}
function _safeEqual(a, b) {
  const ba = Buffer.from(String(a == null ? '' : a), 'utf8');
  const bb = Buffer.from(String(b == null ? '' : b), 'utf8');
  if (ba.length !== bb.length) return false;
  try { return require('crypto').timingSafeEqual(ba, bb); }
  catch (_) { return String(a) === String(b); }
}
// 🔒 2026-10-15 — the legacy super-admin password is ONLY the WU_ADMIN_PASSWORD env var (set on Render). It used to
// fall back to a default written in this file (so it was known to anyone who ever saw the code); with the variable
// unset there is no legacy password at all (teacher codes still work). Never compared when either side is empty.
const _LEGACY_PW = String(process.env.WU_ADMIN_PASSWORD || '');
if (!_LEGACY_PW) console.log('[security] WU_ADMIN_PASSWORD is not set: no legacy admin password (teacher codes only)');
else if (_LEGACY_PW.length < 16) console.warn('[security] WU_ADMIN_PASSWORD is short: make it a long random value (SECURITY-SOP step 10)');
function _legacyPwOk(given) {
  const g = String(given == null ? '' : given).trim();
  return !!(_LEGACY_PW && g && _safeEqual(g, _LEGACY_PW));
}
const _adminFailHits = new Map();   // ip → [timestamps of FAILED admin auths]
function _adminFailCount(ip) {
  const now = Date.now();
  const window = 10 * 60 * 1000;
  const arr = (_adminFailHits.get(ip) || []).filter((t) => now - t < window);
  _adminFailHits.set(ip, arr);
  return arr.length;
}
function _adminNoteFail(ip, limit = 10) {
  const now = Date.now();
  const arr = (_adminFailHits.get(ip) || []).filter((t) => now - t < (10 * 60 * 1000));
  arr.push(now);
  _adminFailHits.set(ip, arr);
  // 📓 Phase 2: security log — surfaces in Render's log stream so a brute-
  // force shows up as a burst of these. The 10th fail flips the turnstile.
  console.warn('[security] admin-auth FAIL ip=' + ip + ' fails=' + arr.length + '/' + limit
    + (arr.length === limit ? ' → LOCKED for 10 min' : ''));
  if (_adminFailHits.size > 5000) {
    for (const [k, v] of _adminFailHits) {
      if (!v.length || now - v[v.length - 1] > (10 * 60 * 1000)) _adminFailHits.delete(k);
    }
  }
}
// 🔒 2026-10-17 — whose wrong codes a check counts on (HTTP _adminAuth and the sockets' _socketCode): an address, 10 in
// 10 min; a remembered teacher device never its school's address (kids on the same Wi-Fi never stop the teacher) but
// itself, 10 (its own cookie: signed, made only from a right code, different on every device, so one laptop's typos
// never stop her other devices), and all of that teacher's devices together 30 (a fresh cookie is one right code away:
// the cookie alone would never run out). → { waits(), miss() }
const _deviceKey = (reqOrHeaders) => 'device:' + require('crypto').createHash('sha256')
  .update(String(SimLock.readCookie(reqOrHeaders, 'dtd') || '')).digest('hex').slice(0, 24);
function _turnstile(dev, reqOrHeaders, ip) {
  if (!dev) return { waits: () => _adminFailCount(ip) >= 10, miss: () => _adminNoteFail(ip) };
  const dk = _deviceKey(reqOrHeaders), tk = 'teacher:' + _ownerOfTeacher(dev);
  return {
    waits: () => _adminFailCount(dk) >= 10 || _adminFailCount(tk) >= 30,
    miss: () => { _adminNoteFail(dk); _adminNoteFail(tk, 30); },
  };
}

app.get('/api/admin/disk-status', (req, res) => {
  const fs = require('fs');
  const ip = _clientIp(req);
  if (_adminFailCount(ip) >= 10) return res.status(429).json({ error: 'demasiados intentos, espera unos minutos' });
  const givenPw = _adminPw(req);
  if (!_legacyPwOk(givenPw)) { _adminNoteFail(ip); return res.status(401).json({ error: 'wrong password' }); }

  const DATA_DIR = path.join(__dirname, 'data');
  const STUDENTS_FILE = path.join(DATA_DIR, 'student-records.json');
  const PRESETS_FILE  = path.join(DATA_DIR, 'teacher-presets.json');
  const HEARTBEAT_FILE = path.join(DATA_DIR, 'heartbeat.txt');

  const out = {
    ok: true,
    dataDir: DATA_DIR,
    cwd: process.cwd(),
    nodeEnv: process.env.NODE_ENV || 'development',
    renderDisk: process.env.RENDER_DISK_PATH || null,
    files: {},
    writable: false,
    persistenceLikely: false,
  };
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    // Try writing a heartbeat with the boot time → if next-deploy still
    // shows an older boot time, the disk is genuinely persisting.
    const now = new Date().toISOString();
    fs.writeFileSync(HEARTBEAT_FILE, JSON.stringify({
      bootedAt: serverStartTime, lastChecked: now
    }, null, 2));
    out.writable = true;
    out.heartbeat = JSON.parse(fs.readFileSync(HEARTBEAT_FILE, 'utf8'));
  } catch (e) {
    out.writable = false;
    out.writeError = e.message;
  }
  // Stats for the key files
  [['students', STUDENTS_FILE], ['presets', PRESETS_FILE]].forEach(([k, p]) => {
    try {
      if (fs.existsSync(p)) {
        const st = fs.statSync(p);
        out.files[k] = {
          path: p,
          exists: true,
          sizeBytes: st.size,
          modified: st.mtime.toISOString(),
        };
      } else {
        out.files[k] = { path: p, exists: false };
      }
    } catch (e) {
      out.files[k] = { path: p, error: e.message };
    }
  });
  out.persistenceLikely = out.writable && (out.files.students || {}).exists !== undefined;
  res.json(out);
});

// === TEACHER NOTEBOOK — Cuaderno de Alumnos ============================
// Two admin-gated endpoints powering the warm-up host's "Cuaderno de
// Alumnos" panel. The teacher unlocks with WU_ADMIN_PASSWORD then can
// see every student code that has ever saved a sentence on this Render
// instance, along with their displayName + sentence count. Drilling into
// a specific code returns the full sentence history for that kid.
// Multi-teacher auth (2026-05-27 rewrite). The query param `pw` is now
// a TEACHER ID (a code) which we look up in teachers.json. Falls back
// to the legacy super-admin passwords for backwards compatibility with
// existing host pages (warmup admin gate etc.).
//
// Returns null on failure (and writes 401), or a "session" object on
// success:
//   { teacher: <teacher record or null for legacy>, isSuperAdmin: bool }
// The session is used downstream to filter results by the teacher's
// classroom access codes.
function _adminAuth(req, res) {
  // Brute-force turnstile (see helpers above): too many FAILED auths from
  // one IP → 429. Only failures are counted, so legitimate dashboard
  // polling with the correct code is never throttled.
  // 🔒 2026-10-15: a remembered teacher device is never locked out with its school's address (kids or an old tab
  // sending wrong codes from the same Wi-Fi must not strand the teacher mid-class). 🔒 2026-10-17: its own wrong codes
  // count on the device and its teacher instead (_turnstile, the same rule as the sockets), so it can't try codes
  // without limit
  const dev = LevelKeys.teacherDevice(req);
  const ts = _turnstile(dev, req, dev ? null : _clientIp(req));
  if (ts.waits()) {
    if (res) res.status(429).json({ ok: false, error: 'demasiados intentos, espera unos minutos' });
    return null;
  }
  // Read from header first, then legacy ?pw= query param (back-compat).
  const givenPw = _adminPw(req);
  // 🔒 2026-10-15: a code changed with «Cambiar mi código» is refused but never counted as a guess (every tab and
  // projector that still holds it keeps asking until it is reloaded, and that must not lock the school out)
  // (2026-10-19: only when no teacher holds it: a live code typed with its accents or without its dashes is never
  // «retired» because an old code once looked like it)
  if (givenPw && Teachers.isRetired(givenPw) && !Teachers.getByTeacherId(givenPw)) {
    if (res) res.status(401).json({ ok: false, retired: true, error: 'Este código ya se cambió. Entra con tu código nuevo.' });
    return null;
  }
  // Legacy super-admin passwords still grant full access for the live
  // warmup-host flow (host-warmup.html unlock). These bypass the
  // teachers table entirely. Constant-time compare so the secret can't be
  // recovered via response timing.
  if (_legacyPwOk(givenPw)) {
    return { teacher: null, isSuperAdmin: true, legacy: true };
  }
  // Otherwise look up as a teacher code
  const teacher = givenPw ? Teachers.getByTeacherId(givenPw) : null;
  if (!teacher) {
    ts.miss();
    if (res) res.status(401).json({ ok: false, error: 'wrong password' });
    return null;
  }
  Teachers.touchLastSeen(teacher.teacherId);
  return { teacher, isSuperAdmin: !!teacher.isSuperAdmin, legacy: false };
}
// ── 🔑 2026-10-15 — who a request is, for the level keys (core/level-keys.js) ─────────────────────────────────────
// A teacher: a code in the X-Admin-Pw header (wrong codes count in the turnstile above) or a remembered teacher device
// (that answer carries device: true). Once per request (a wrong code is counted once).
function _teacherOf(req) {
  if (req && Object.prototype.hasOwnProperty.call(req, '_dralyTeacher')) return req._dralyTeacher;
  const h = (req && req.headers) || {};
  let t = null;
  if (h['x-admin-pw'] || h['x-admin-password']) t = _adminAuth(req, null);
  if (!t) t = LevelKeys.teacherDevice(req);
  if (req) req._dralyTeacher = t;
  return t;
}
// 🔒 2026-10-18 (his rule: study PDFs download only for the super admin): a super admin's code in X-Admin-Pw or a
// remembered super-admin device. La Base's vocabulary PDF and the golden book's PDF answer only to this.
const _superOf = (req) => { const t = _teacherOf(req); return !!(t && t.isSuperAdmin); };
// The logged-in kid's record (the /homework session): Students.get brings an archived kid back.
function _studentOf(req) {
  const s = SimLock.session(req);
  return s && s.kind === 's' ? Students.get(s.code) : null;
}
LevelKeys.configure({ teacherOf: _teacherOf, studentOf: _studentOf });
// 🔒 2026-10-18 (security review F2): every kid session carries its account's kidGen («Cerrar su sesión en todos los
// teléfonos» in /maestro bumps it: the sessions made before stop at once). peek: never wakes an archived account.
SimLock.configureSessions({ genOf: (code) => { const p = Students.peek(code); return p ? Number(p.rec.kidGen) || 0 : 0; } });
// The one question every locked level asks (La Base now; El Entrenamiento and El Simulacro Dorado in phases 2-4):
// may this request use level X? → { ok, level, via: 'teacher' | 'student' | 'key', studentCode? }
const levelAccess = (req, level) => LevelKeys.access(req, level);

// ── 🔑 a teacher device («crear un juego» needs the teacher's code the first time on a device, then it is remembered)
// GET → is this device remembered? POST { code } (or the X-Admin-Pw header) → remember it (90 days). Wrong codes count
// in the admin turnstile (10 per 10 min per address). The /maestro login remembers the device too.
app.get('/api/teacher-device', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const t = LevelKeys.teacherDevice(req);
  res.json({ ok: true, remembered: !!t, name: t ? (t.teacher ? t.teacher.displayName : 'Super admin') : null });
});
app.post('/api/teacher-device', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const ip = _clientIp(req);
  if (_adminFailCount(ip) >= 10) return res.status(429).json({ ok: false, error: 'Muchos intentos. Espera 10 minutos y vuelve a intentarlo.' });
  // the JSON body or the header only (never ?pw=: a link on another site must not remember a device)
  const hdr = req.headers || {};
  let viaHeader = String(hdr['x-admin-password'] || hdr['x-admin-pw'] || '');
  try { viaHeader = decodeURIComponent(viaHeader); } catch (_) { /* as-is */ }
  const code = String((req.body && typeof req.body.code === 'string' && req.body.code) || viaHeader || '').trim().slice(0, 80);
  const s = code && _legacyPwOk(code) ? { teacher: null, isSuperAdmin: true, legacy: true }
    : (code ? (Teachers.getByTeacherId(code) ? { teacher: Teachers.getByTeacherId(code), isSuperAdmin: !!Teachers.getByTeacherId(code).isSuperAdmin, legacy: false } : null) : null);
  if (!s) {
    if (code && Teachers.isRetired(code)) return res.status(401).json({ ok: false, retired: true, error: 'Ese código ya se cambió. Escribe tu código nuevo.' });
    if (code) _adminNoteFail(ip);
    return res.status(401).json({ ok: false, error: 'Ese código no funciona. Es el mismo con el que entras a Teacher Mode (/maestro).' });
  }
  if (s.teacher) Teachers.touchLastSeen(s.teacher.teacherId);
  LevelKeys.rememberTeacher(req, res, s);
  res.json({ ok: true, name: s.teacher ? s.teacher.displayName : 'Super admin' });
});
app.post('/api/teacher-device/forget', (req, res) => {   // /maestro «Log out»: this device is a teacher's no more
  LevelKeys.forgetTeacher(req, res);
  res.set('Cache-Control', 'no-store').json({ ok: true });
});
// === 🌐 EMIRATI ARABIC GATEWAY (super-admin only) =====================
// The platform owner's personal language-learning sidecar. Returns today's
// 5 words deterministically by date, prioritizing words not yet seen. The
// /api/tts endpoint already supports any Google Cloud voice via ?voice=,
// so the client speaks Arabic by passing voice=ar-XA-Wavenet-A (MSA — the
// closest standard voice to Emirati; an actual Khaleeji custom voice would
// need a paid trained model).
app.get('/api/maestro/emirati/today', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  if (!session.isSuperAdmin) return res.status(403).json({ ok: false, error: 'super admin only' });
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '')
    ? req.query.date : new Date().toISOString().slice(0, 10);
  const state = _emiratiRead();
  // 🔁 Otras (rotate) support — client can pass ?skip=id1,id2,... to
  // exclude the current set from the pool for one fetch so a different
  // batch shows up.
  const skipIds = String(req.query.skip || '').split(',').filter(Boolean);
  // 🆕 2026-06-01 — self-refilling 10-word / 20-sentence study queue.
  // Marking a sentence or word removes that single item from the list;
  // the next priority item slides in on the next fetch to keep the
  // visible count near 10/20. Sentences and words are independent —
  // a word stays visible until the kid marks the word itself, even if
  // all its sentences are individually learned.
  // 🆕 2026-06-04 — bumped to 25 / 50 per Fernando. Old caps 10/20.
  const wordCap = Math.max(1, Math.min(50, parseInt(req.query.wordCap, 10) || 25));
  const sentenceCap = Math.max(1, Math.min(100, parseInt(req.query.sentCap, 10) || 50));
  const words = Emirati.studyList({
    seenIds: state.seen || [],
    learnedSentKeys: state.learnedSentences || [],
    skipIds,
    wordCap,
    sentenceCap,
  });
  // Count visible sentences so the client HUD can show "10 palabras · 17 oraciones"
  const visibleSentenceCount = words.reduce((n, w) => n + (w.ses ? w.ses.length : 0), 0);
  res.json({
    ok: true,
    date,
    words,
    wordCap,
    sentenceCap,
    visibleSentenceCount,
    sections: Emirati.EMIRATI_SECTIONS,
    sectionOrder: Emirati.EMIRATI_SECTION_ORDER,
    learnedSentences: state.learnedSentences || [],
    progress: {
      seenCount: (state.seen || []).length,
      total: Emirati.EMIRATI_WORDS.length,
      streak: state.streak || 0,
      lastDate: state.lastDate || null,
      sentencesLearned: (state.learnedSentences || []).length,
    },
  });
});
// 🎙️ EMIRATI AUDIO OVERRIDE + AZURE AUTO-GENERATION
// Priority on each request:
//  1. Pre-recorded MP3 on disk (data/emirati-audio/<wordId>.mp3 / .m4a / .wav)
//  2. Azure ar-AE-FatimaNeural / ar-AE-HamdanNeural — auto-fetched + cached
//     on first play if AZURE_SPEECH_KEY env var is set (Azure Free tier F0
//     covers 500k chars/month, way more than the 275-word dataset needs)
//  3. 404 → client falls back to Google MSA
const EMIRATI_AUDIO_DIR = _emPath.join(__dirname, 'data', 'emirati-audio');
const EMIRATI_AUDIO_EXTS = ['.mp3', '.m4a', '.wav', '.ogg'];
const _https = require('https');
function _azureSpeak(text, voice, outPath, cb) {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION || 'eastus';
  if (!key) return cb(new Error('AZURE_SPEECH_KEY not set'));
  const safeText = String(text || '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  const ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='ar-AE'>"
    + "<voice name='" + voice + "'>" + safeText + '</voice></speak>';
  // 🔧 EXPLICIT UTF-8 BUFFER — Arabic SSML has multi-byte chars; if we
  // pass the string straight to req.write, Node sometimes computes
  // Content-Length as char count, not byte count, and Azure rejects the
  // request as truncated. Buffering forces the byte count to match.
  const ssmlBuf = Buffer.from(ssml, 'utf8');
  const req = _https.request({
    method: 'POST',
    hostname: region + '.tts.speech.microsoft.com',
    path: '/cognitiveservices/v1',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml; charset=utf-8',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'draly-wisdomgrounds',
      'Content-Length': ssmlBuf.length,
    },
  }, (resp) => {
    if (resp.statusCode !== 200) {
      let errBuf = '';
      resp.on('data', (c) => { errBuf += c; });
      resp.on('end', () => cb(new Error('azure ' + resp.statusCode + ': ' + errBuf.slice(0, 200))));
      return;
    }
    const chunks = [];
    resp.on('data', (c) => chunks.push(c));
    resp.on('end', () => {
      const buf = Buffer.concat(chunks);
      if (buf.length < 100) {
        const peek = buf.toString('utf8', 0, Math.min(buf.length, 200));
        console.warn('[azure-tts] empty response (' + buf.length + ' bytes). Body:', peek);
        return cb(new Error('azure empty (' + buf.length + 'B): ' + peek));
      }
      // 🔧 Disk write is now NON-FATAL — if it fails, we still hand the
      // buffer back to the caller so the response goes out. The previous
      // try/catch around BOTH validation AND write meant a disk failure
      // turned the whole callback into an error → 404 to client. Now
      // disk failure logs a warning, but the audio still flows.
      try {
        const dir = _emPath.dirname(outPath);
        if (!_emFs.existsSync(dir)) _emFs.mkdirSync(dir, { recursive: true });
        _emFs.writeFileSync(outPath, buf);
      } catch (e) {
        console.warn('[azure-tts] disk write failed (non-fatal):', e.message, 'path:', outPath);
      }
      cb(null, buf);
    });
  });
  req.on('error', (e) => cb(e));
  req.write(ssmlBuf);
  req.end();
}
function _emiratiFindCached(id) {
  for (let i = 0; i < EMIRATI_AUDIO_EXTS.length; i++) {
    const p = _emPath.join(EMIRATI_AUDIO_DIR, id + EMIRATI_AUDIO_EXTS[i]);
    if (_emFs.existsSync(p)) return p;
  }
  return null;
}
// 💰 SAFE CAP — 2026-07-06 (Fernando: "put a safe cap on it"). The audio
// endpoints are public and synthesis costs money, so three fences:
//   1. ALLOWLIST: only Arabic that exists in the dataset (word.ar or a
//      sentence's ses.ar) can be synthesized. Total possible cost is
//      bounded by the dataset (~583 words + ~1,160 sentences × 2 voices,
//      each rendered ONCE ever, then disk-cached forever).
//   2. LENGTH: /audio/text rejects anything over 300 chars.
//   3. RATE: max 40 fresh syntheses/min/IP (cache hits don't count).
//      Normal studying is a handful per minute; the bulk pre-generator
//      goes through the pw-gated /generate-all, not these routes.
const _EMIRATI_KNOWN_AR = (() => {
  const set = new Set();
  (Emirati.EMIRATI_WORDS || []).forEach((w) => {
    if (w.ar) set.add(String(w.ar).trim());
    (w.ses || []).forEach((sn) => { if (sn && sn.ar) set.add(String(sn.ar).trim()); });
  });
  console.log('[emirati] synth allowlist:', set.size, 'known Arabic strings');
  return set;
})();
const _emSynthHits = new Map();   // ip → { n, t }
function _emiratiSynthRateLimit(req) {
  const ip = _clientIp(req);
  const now = Date.now();
  const rec = _emSynthHits.get(ip) || { n: 0, t: now };
  if (now - rec.t > 60000) { rec.n = 0; rec.t = now; }
  rec.n++;
  _emSynthHits.set(ip, rec);
  if (rec.n > 40) {
    console.warn('[security] emirati synth rate-limit hit ip=' + ip + ' (possible denial-of-wallet probe)');
    return false;
  }
  return true;
}
// Register-text endpoint — client POSTs Arabic text, gets back a stable
// ID it can use with the proven /:wordId audio endpoint.
// 💰 Allowlisted: only dataset sentences can be registered.
app.post('/api/emirati/audio/register', (req, res) => {
  const ar = String((req.body && req.body.ar) || '').trim();
  if (!ar) return res.status(400).json({ ok: false });
  if (!_EMIRATI_KNOWN_AR.has(ar)) {
    console.warn('[security] emirati register rejected (unknown text) ip=' + _clientIp(req));
    return res.status(403).json({ ok: false, error: 'unknown text' });
  }
  const id = 's_' + _registerSentenceText(ar);
  res.json({ ok: true, id });
});
// 🛟 GOOGLE ar-XA FALLBACK — 2026-07-06 (Fernando: "when I touch the
// button it's not playing"). Root cause: only pre-cached MP3s played;
// anything needing FRESH Azure synthesis 404'd (AZURE_SPEECH_KEY missing
// or failing on Render), so all 100 new loc-words were silent. Now the
// word endpoint falls back to Google Cloud TTS Arabic (already whitelisted
// in /api/tts for this gateway). Cached as <id>_g.mp3 — a DIFFERENT name
// than the Azure cache, so the moment Azure works again the next tap
// renders + serves the real Khaleeji voice and the fallback stops.
async function _emiratiGoogleFallback(res, id, arText, azVoice) {
  try {
    const gName = id + (azVoice === 'ar-AE-HamdanNeural' ? '_m' : '') + '_g';
    const gPath = _emPath.join(EMIRATI_AUDIO_DIR, gName + '.mp3');
    if (_emFs.existsSync(gPath)) return _serveAudioFile(res, gPath);
    const client = _getTtsClient();
    if (!client) return res.status(404).end();
    const gVoice = azVoice === 'ar-AE-HamdanNeural' ? 'ar-XA-Wavenet-B' : 'ar-XA-Wavenet-A';
    const [out] = await client.synthesizeSpeech({
      input: { text: arText },
      voice: { languageCode: 'ar-XA', name: gVoice },
      audioConfig: { audioEncoding: 'MP3', speakingRate: 0.9, pitch: 0.0 },
    });
    if (!out || !out.audioContent) return res.status(404).end();
    _emFs.writeFile(gPath, out.audioContent, () => {});
    console.log('[em-google-fallback] served MSA fallback for', id);
    return _serveAudioFile(res, gPath, out.audioContent);
  } catch (e) {
    console.warn('[em-google-fallback] failed for', id, e.message);
    try { res.status(404).end(); } catch (_) {}
  }
}
app.get('/api/emirati/audio/:wordId', (req, res, next) => {
  // ⚠️ ROUTE COLLISION GUARD — this wildcard is registered BEFORE the
  // more-specific /audio/text and /audio/test200 routes, so it was
  // silently swallowing them (both always 404'd as "unknown word").
  if (req.params.wordId === 'text' || req.params.wordId === 'test200') return next();
  const id = String(req.params.wordId || '').replace(/[^A-Za-z0-9_-]/g, '');
  if (!id) return res.status(400).end();
  const voice = req.query.voice === 'male' ? 'ar-AE-HamdanNeural' : 'ar-AE-FatimaNeural';
  // 🔧 Per-voice cache key so switching Fatima ↔ Hamdan actually changes
  // what plays. File names: e7.mp3 (Fatima), e7_m.mp3 (Hamdan). Without
  // this, the first voice "won" forever no matter what UI you toggled.
  const cacheBaseName = id + (voice === 'ar-AE-HamdanNeural' ? '_m' : '');
  const cached = _emiratiFindCached(cacheBaseName);
  if (cached) {
    // Stale-cache guard (matches text endpoint).
    try {
      if (_emFs.statSync(cached).size < 1000) {
        console.warn('[azure-word] evicting stale cache:', cached);
        _emFs.unlinkSync(cached);
      } else {
        return _serveAudioFile(res, cached);
      }
    } catch (_) {}
  }
  // 💰 Cache miss → this is the only path that costs money. Rate-limit it.
  if (!_emiratiSynthRateLimit(req)) return res.status(429).end();
  // Resolve the Arabic text FIRST (needed by both Azure and the fallback).
  // ⭐ Sentence IDs (s_<hash>) → look up the registered Arabic text.
  let textToSpeak;
  if (id.startsWith('s_')) {
    textToSpeak = _resolveSentenceText(id.slice(2));
    if (!textToSpeak) {
      console.warn('[azure-word] unknown sentence id:', id);
      return res.status(404).end();
    }
  } else {
    const word = Emirati.EMIRATI_WORDS.find((w) => w.id === id);
    if (!word) return res.status(404).end();
    textToSpeak = word.ar;
  }
  if (process.env.AZURE_SPEECH_KEY) {
    const outPath = _emPath.join(EMIRATI_AUDIO_DIR, cacheBaseName + '.mp3');
    return _azureSpeak(textToSpeak, voice, outPath, (err, buf) => {
      if (err) {
        console.warn('[azure-tts] failed for', id, err.message, '→ trying Google fallback');
        return _emiratiGoogleFallback(res, id, textToSpeak, voice);
      }
      _serveAudioFile(res, outPath, buf);
    });
  }
  return _emiratiGoogleFallback(res, id, textToSpeak, voice);
});
// 🧪 DIAGNOSTIC — super-admin only. Tests Azure with the exact text the
// user passes, returns the full Azure result so we can see what's failing.
// Hit /api/maestro/emirati/azure/diagnose?pw=...&text=<arabic>&voice=male
app.get('/api/maestro/emirati/azure/diagnose', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  if (!session.isSuperAdmin) return res.status(403).json({ ok: false, error: 'super admin only' });
  const text = String(req.query.text || 'السلام عليكم، شلونكم؟').trim();
  const voice = req.query.voice === 'male' ? 'ar-AE-HamdanNeural' : 'ar-AE-FatimaNeural';
  if (!process.env.AZURE_SPEECH_KEY) {
    return res.json({ ok: false, reason: 'AZURE_SPEECH_KEY not set on server', text, voice });
  }
  const region = process.env.AZURE_SPEECH_REGION || 'eastus';
  const safeText = String(text || '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  const ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='ar-AE'>"
    + "<voice name='" + voice + "'>" + safeText + '</voice></speak>';
  const ssmlBuf = Buffer.from(ssml, 'utf8');
  const azureReq = _https.request({
    method: 'POST',
    hostname: region + '.tts.speech.microsoft.com',
    path: '/cognitiveservices/v1',
    headers: {
      'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY,
      'Content-Type': 'application/ssml+xml; charset=utf-8',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'draly-wisdomgrounds',
      'Content-Length': ssmlBuf.length,
    },
  }, (resp) => {
    const chunks = [];
    resp.on('data', (c) => chunks.push(c));
    resp.on('end', () => {
      const buf = Buffer.concat(chunks);
      res.json({
        ok: resp.statusCode === 200 && buf.length >= 100,
        text, voice, region,
        azureStatus: resp.statusCode,
        azureHeaders: resp.headers,
        bytesReceived: buf.length,
        firstBytesHex: buf.slice(0, 32).toString('hex'),
        bodyAsText: buf.length < 500 ? buf.toString('utf8') : '(binary mp3, ' + buf.length + ' bytes)',
        ssmlSent: ssml,
        ssmlByteLength: ssmlBuf.length,
      });
    });
  });
  azureReq.on('error', (e) => res.json({ ok: false, reason: 'network error', error: e.message, text, voice }));
  azureReq.write(ssmlBuf);
  azureReq.end();
});

// 🧪 SANITY ENDPOINT — confirms the platform's route is alive and the
// AZURE key is visible. If GET /api/emirati/audio/test200 returns 200
// but /audio/text returns 404, we know the route is correct and Azure
// itself is failing.
app.get('/api/emirati/audio/test200', (req, res) => {
  res.status(200).json({
    ok: true,
    hasKey: !!process.env.AZURE_SPEECH_KEY,
    region: process.env.AZURE_SPEECH_REGION || 'eastus',
    timestamp: Date.now(),
  });
});

// 🔧 USER'S INSIGHT: words work, sentences fail. Same Azure call —
// only difference is the URL path. Let's route sentences through the
// PROVEN word path by hashing the text as a fake "word ID" and using
// the same endpoint that already works.
const _sentenceTextById = {};  // in-memory map: hash → Arabic text
function _registerSentenceText(text) {
  const h = require('crypto').createHash('sha1').update(text).digest('hex').slice(0, 12);
  _sentenceTextById[h] = text;
  return h;
}
// Resolve hash back to original text for synthesis.
function _resolveSentenceText(id) {
  return _sentenceTextById[id] || null;
}
// 🎙️ EMIRATI SENTENCE AUDIO — arbitrary Arabic text through Azure ar-AE,
// content-hashed cache so repeat plays are instant. Used by the per-
// sentence 🔊 buttons. Without this, every sentence fell through to
// Google MSA (the user's "the pronunciation is bad" complaint).
const _emCrypto = require('crypto');
app.get('/api/emirati/audio/text', (req, res) => {
  const ar = String(req.query.ar || '').trim();
  if (!ar) return res.status(400).end();
  const voice = req.query.voice === 'male' ? 'ar-AE-HamdanNeural' : 'ar-AE-FatimaNeural';
  const hash = _emCrypto.createHash('sha1').update(voice + '|' + ar).digest('hex').slice(0, 16);
  const cachePath = _emPath.join(EMIRATI_AUDIO_DIR, 'txt_' + hash + '.mp3');
  // 🔧 STALE-CACHE GUARD — checks BOTH size AND MP3 magic bytes. A
  // partial / malformed file from earlier broken deploys could be >1KB
  // but still not a real MP3, in which case the browser <audio> refuses
  // to play it. ?force=1 bypasses the cache entirely.
  if (req.query.force === '1' && _emFs.existsSync(cachePath)) {
    try { _emFs.unlinkSync(cachePath); console.warn('[azure-text] force-evicted:', cachePath); } catch (_) {}
  }
  if (_emFs.existsSync(cachePath)) {
    if (_isValidMp3(cachePath)) {
      console.log('[azure-text] cache hit:', cachePath, 'size:', _emFs.statSync(cachePath).size);
      return _serveAudioFile(res, cachePath);
    }
    console.warn('[azure-text] evicting corrupt cache:', cachePath);
    try { _emFs.unlinkSync(cachePath); } catch (_) {}
  }
  // 💰 SAFE CAP — cache miss from here on = real synthesis cost.
  // Only dataset sentences, bounded length, per-IP rate limit.
  if (ar.length > 300) return res.status(400).end();
  if (!_EMIRATI_KNOWN_AR.has(ar)) {
    console.warn('[security] emirati text synth rejected (unknown text) ip=' + _clientIp(req));
    return res.status(403).end();
  }
  if (!_emiratiSynthRateLimit(req)) return res.status(429).end();
  if (!process.env.AZURE_SPEECH_KEY) {
    // 🛟 Same Google ar-XA fallback as the word endpoint (2026-07-06) —
    // sentences must never be silent. Cached under txt_<hash>_g.mp3 so
    // a working Azure key takes over transparently later.
    console.warn('[azure-text] AZURE_SPEECH_KEY not set → Google fallback');
    return _emiratiGoogleFallback(res, 'txt_' + hash, ar, voice);
  }
  // 🚀 RAW PIPE — bypasses everything. Stream Azure response → client.
  // No cache logic, no validation in the middle, no disk write between
  // Azure and client. The user's been getting 404 for sentences for
  // days because some step between Azure's success and the client's
  // receive was failing. Cutting out everything in between.
  console.log('[azure-text] PIPING Azure for:', ar.slice(0, 60), 'voice:', voice);
  const region = process.env.AZURE_SPEECH_REGION || 'eastus';
  const safeText = ar.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  const ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='ar-AE'>"
    + "<voice name='" + voice + "'>" + safeText + '</voice></speak>';
  const ssmlBuf = Buffer.from(ssml, 'utf8');
  const azureReq = _https.request({
    method: 'POST',
    hostname: region + '.tts.speech.microsoft.com',
    path: '/cognitiveservices/v1',
    headers: {
      'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY,
      'Content-Type': 'application/ssml+xml; charset=utf-8',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'draly-wisdomgrounds',
      'Content-Length': ssmlBuf.length,
    },
  }, (azureResp) => {
    console.log('[azure-text] Azure status:', azureResp.statusCode);
    if (azureResp.statusCode !== 200) {
      let errBody = '';
      azureResp.on('data', (c) => { errBody += c; });
      azureResp.on('end', () => {
        // 🛟 2026-07-06 — Azure 401 (expired/rotated key) was returning a
        // bare 502 here, so sentence audio died even though the Google
        // fallback existed. Now: log the Azure error, fall back, never
        // leave the button silent.
        console.warn('[azure-text] Azure', azureResp.statusCode, '→ Google fallback. body:', errBody.slice(0, 300));
        if (!res.headersSent) _emiratiGoogleFallback(res, 'txt_' + hash, ar, voice);
      });
      return;
    }
    // Set headers and PIPE the audio bytes directly to the client.
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=2592000');
    azureResp.pipe(res);
    // ALSO tee the bytes to disk for next time (best effort).
    try {
      const dir = _emPath.dirname(cachePath);
      if (!_emFs.existsSync(dir)) _emFs.mkdirSync(dir, { recursive: true });
      const writeStream = _emFs.createWriteStream(cachePath);
      azureResp.pipe(writeStream);
      writeStream.on('error', (e) => console.warn('[azure-text] tee write failed:', e.message));
    } catch (e) {
      console.warn('[azure-text] tee setup failed (non-fatal):', e.message);
    }
  });
  azureReq.on('error', (e) => {
    console.warn('[azure-text] request error:', e.message);
    if (!res.headersSent) res.status(503).json({ error: e.message });
  });
  azureReq.write(ssmlBuf);
  azureReq.end();
});

// Streams Azure TTS straight to the HTTP response. Optionally tees the
// bytes into a cache file so future requests are instant. Disk failure
// is non-fatal — client still gets the audio.
function _streamAzureToResponse(text, voice, res, optionalCachePath) {
  const region = process.env.AZURE_SPEECH_REGION || 'eastus';
  const safeText = String(text || '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  const ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='ar-AE'>"
    + "<voice name='" + voice + "'>" + safeText + '</voice></speak>';
  const ssmlBuf = Buffer.from(ssml, 'utf8');
  const azureReq = _https.request({
    method: 'POST',
    hostname: region + '.tts.speech.microsoft.com',
    path: '/cognitiveservices/v1',
    headers: {
      'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY,
      'Content-Type': 'application/ssml+xml; charset=utf-8',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'draly-wisdomgrounds',
      'Content-Length': ssmlBuf.length,
    },
  }, (resp) => {
    if (resp.statusCode !== 200) {
      let errBody = '';
      resp.on('data', (c) => { errBody += c; });
      resp.on('end', () => {
        console.warn('[azure-stream] non-200:', resp.statusCode, errBody.slice(0, 200));
        if (!res.headersSent) res.status(502).end();
      });
      return;
    }
    // Buffer + relay so we can also cache for next time.
    const chunks = [];
    resp.on('data', (c) => chunks.push(c));
    resp.on('end', () => {
      const buf = Buffer.concat(chunks);
      if (buf.length < 100) {
        console.warn('[azure-stream] empty body:', buf.length);
        if (!res.headersSent) res.status(502).end();
        return;
      }
      // Try to cache for next time (non-fatal).
      if (optionalCachePath) {
        try {
          const dir = _emPath.dirname(optionalCachePath);
          if (!_emFs.existsSync(dir)) _emFs.mkdirSync(dir, { recursive: true });
          _emFs.writeFileSync(optionalCachePath, buf);
        } catch (e) {
          console.warn('[azure-stream] disk cache write failed (non-fatal):', e.message);
        }
      }
      // Send to client.
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', String(buf.length));
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=2592000');
      res.status(200).end(buf);
    });
  });
  azureReq.on('error', (e) => {
    console.warn('[azure-stream] req error:', e.message);
    if (!res.headersSent) res.status(503).end();
  });
  azureReq.write(ssmlBuf);
  azureReq.end();
}

// Inspect first 4 bytes of a file to verify it's a real MP3.
// MP3 magic: "ID3" header (0x49 0x44 0x33) OR MPEG sync word (0xFF 0xFx).
// Anything else = corrupt cache → evict and regenerate.
function _isValidMp3(filePath) {
  try {
    const fd = _emFs.openSync(filePath, 'r');
    const buf = Buffer.alloc(4);
    _emFs.readSync(fd, buf, 0, 4, 0);
    _emFs.closeSync(fd);
    // ID3 tag
    if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true;
    // MPEG audio sync word (first 11 bits = 1)
    if (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0) return true;
    return false;
  } catch (e) {
    console.warn('[mp3-valid] read failed:', e.message);
    return false;
  }
}

// 🧹 ADMIN-ONLY: wipe every cached audio file. Used when the cache has
// corruption from previous broken deploys and we want a fresh slate.
// Hit /api/maestro/emirati/audio/clear-cache?pw=...
app.post('/api/maestro/emirati/audio/clear-cache', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  if (!session.isSuperAdmin) return res.status(403).json({ ok: false, error: 'super admin only' });
  let removed = 0, kept = 0;
  try {
    if (_emFs.existsSync(EMIRATI_AUDIO_DIR)) {
      const files = _emFs.readdirSync(EMIRATI_AUDIO_DIR);
      files.forEach((f) => {
        if (!/\.(mp3|m4a|wav|ogg)$/i.test(f)) return;
        const p = _emPath.join(EMIRATI_AUDIO_DIR, f);
        // Keep user-recorded MP3s (no txt_ prefix, no e\d+ word prefix).
        if (f.startsWith('txt_') || /^e\d+(_m)?\.mp3$/.test(f)) {
          try { _emFs.unlinkSync(p); removed++; } catch (_) { kept++; }
        } else {
          kept++;
        }
      });
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
  res.json({ ok: true, removed, kept });
});

// Reliable audio delivery — sets explicit Content-Type + Content-Length +
// Accept-Ranges so mobile <audio> elements load cleanly. Falls back to
// sendFile if the buffer isn't provided (cache-hit path).
function _serveAudioFile(res, filePath, buf) {
  try {
    // Prefer the in-memory buffer if caller provided it (fresh from Azure).
    // Only fall back to disk read on cache-hit path.
    if (!buf) {
      if (!_emFs.existsSync(filePath)) {
        console.warn('[serve-audio] file does not exist:', filePath);
        return res.status(404).end();
      }
      buf = _emFs.readFileSync(filePath);
    }
    if (!buf || buf.length < 100) {
      console.warn('[serve-audio] invalid buf, length:', buf ? buf.length : 'null');
      return res.status(500).json({ ok: false, error: 'invalid audio buffer' });
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', String(buf.length));
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=2592000');
    console.log('[serve-audio] sending', buf.length, 'bytes');
    res.status(200).end(buf);
  } catch (e) {
    console.warn('[serve-audio] threw:', e.message, e.stack);
    if (!res.headersSent) res.status(500).end();
  }
}

// Super-admin status check — used by the Maestro UI to surface "Azure
// configured / not configured" and the cache progress (X / 275 generated).
app.get('/api/maestro/emirati/azure-status', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  if (!session.isSuperAdmin) return res.status(403).json({ ok: false, error: 'super admin only' });
  let cached = 0;
  Emirati.EMIRATI_WORDS.forEach((w) => { if (_emiratiFindCached(w.id)) cached++; });
  res.json({
    ok: true,
    azureConfigured: !!process.env.AZURE_SPEECH_KEY,
    region: process.env.AZURE_SPEECH_REGION || 'eastus',
    voiceFemale: 'ar-AE-FatimaNeural',
    voiceMale: 'ar-AE-HamdanNeural',
    total: Emirati.EMIRATI_WORDS.length,
    cached,
  });
});
// Bulk pre-generate every Emirati word in one go. Runs in the background
// (returns immediately with the queue size); the UI polls /azure-status to
// watch progress. Throttled to 4 req/s to be nice to the free tier.
let _emiratiBulkRunning = false;
app.post('/api/maestro/emirati/generate-all', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  if (!session.isSuperAdmin) return res.status(403).json({ ok: false, error: 'super admin only' });
  if (!process.env.AZURE_SPEECH_KEY) {
    return res.status(400).json({ ok: false, error: 'AZURE_SPEECH_KEY env var not set on this server' });
  }
  if (_emiratiBulkRunning) return res.json({ ok: true, alreadyRunning: true });
  const voice = (req.body && req.body.voice === 'male') ? 'ar-AE-HamdanNeural' : 'ar-AE-FatimaNeural';
  const queue = Emirati.EMIRATI_WORDS.filter((w) => !_emiratiFindCached(w.id));
  res.json({ ok: true, queued: queue.length, total: Emirati.EMIRATI_WORDS.length, voice });
  _emiratiBulkRunning = true;
  (function next(i) {
    if (i >= queue.length) { _emiratiBulkRunning = false; return; }
    const w = queue[i];
    const outPath = _emPath.join(EMIRATI_AUDIO_DIR, w.id + '.mp3');
    _azureSpeak(w.ar, voice, outPath, (err) => {
      if (err) console.warn('[azure-tts bulk] fail', w.id, err.message);
      setTimeout(() => next(i + 1), 250);  // ~4 req/s
    });
  })(0);
});

app.post('/api/maestro/emirati/mark', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  if (!session.isSuperAdmin) return res.status(403).json({ ok: false, error: 'super admin only' });
  const { wordIds, date, unmark } = req.body || {};
  if (!Array.isArray(wordIds)) return res.status(400).json({ ok: false, error: 'wordIds required' });
  const state = _emiratiRead();
  const seen = new Set(state.seen || []);
  // 🔄 Now supports unmark — pass { wordIds, unmark: true } to forget them.
  wordIds.forEach((id) => {
    if (typeof id !== 'string') return;
    if (unmark) seen.delete(id); else seen.add(id);
  });
  state.seen = Array.from(seen);
  const today = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : new Date().toISOString().slice(0, 10);
  if (!unmark && state.lastDate !== today) {
    state.streak = (state.lastDate && state.lastDate === _emiratiYesterday(today))
      ? (Number(state.streak) || 0) + 1
      : 1;
    state.lastDate = today;
  }
  _emiratiWrite(state);
  res.json({ ok: true, progress: { seenCount: state.seen.length, total: Emirati.EMIRATI_WORDS.length, streak: state.streak, lastDate: state.lastDate, sentencesLearned: (state.learnedSentences || []).length } });
});

// === 🎯 CUSTOM ASSIGNMENTS — teacher-authored, per-student, multi-bank ====
// Teacher creates one or many sentence items + selects target kids by code.
// Targeted kids see them in their homework portal above HSK1 folders.
app.post('/api/admin/custom-assignment', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  const { title, instructions, items, targetStudents, pointsPerItem } = req.body || {};
  const rec = CustomAsg.create({
    teacherId: session.teacher ? session.teacher.teacherId : (session.isSuperAdmin ? 'super' : null),
    title, instructions, items, targetStudents, pointsPerItem,
  });
  if (!rec) return res.status(400).json({ ok: false, error: 'invalid: necesita al menos 1 item + 1 estudiante' });
  res.json({ ok: true, assignment: rec });
});
app.get('/api/admin/custom-assignments', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  // Super admin sees all; regular teachers see only their own.
  const list = session.isSuperAdmin
    ? CustomAsg.listAll()
    : CustomAsg.listForTeacher(session.teacher ? session.teacher.teacherId : null);
  res.json({ ok: true, assignments: list });
});
app.delete('/api/admin/custom-assignment/:id', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  const ok = CustomAsg.remove(req.params.id,
    session.teacher ? session.teacher.teacherId : null,
    !!session.isSuperAdmin);
  res.json({ ok });
});
app.get('/api/homework/custom-assignments/:code', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  // 🔒 2026-10-18 (ownership; security review F6: one answer for an unknown code and «not yours», _hwKid)
  const rec = _hwKid(req, res, req.params.code);
  if (!rec) return;
  const list = CustomAsg.listForStudent(rec.code).map((a) => ({
    id: a.id,
    title: a.title,
    instructions: a.instructions,
    itemCount: a.items.length,
    createdAt: a.createdAt,
    // 🔒 2026-10-15: the teacher's code (teacherId) is never sent to a kid's phone
  }));
  res.json({ ok: true, assignments: list });
});
app.get('/api/homework/custom-assignment/:id', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const rec = _hwKid(req, res, req.query.studentCode);   // 🔒 2026-10-18 (ownership, F6)
  if (!rec) return;
  const a = CustomAsg.get(req.params.id);
  if (!a || a.status !== 'active') return res.status(404).json({ ok: false, error: 'no encontrada' });
  if (a.targetStudents.indexOf(rec.code) < 0) return res.status(403).json({ ok: false, error: 'no es para ti' });
  // Strip server-only fields. Hand the kid the same shape regular assignments use,
  // PLUS a `custom: true` flag and `expLabel: null` so the homework UI knows to
  // unlock the word bank to ALL EXPs (multi-bank intent).
  res.json({ ok: true, assignment: {
    id: a.id, custom: true,
    title: a.title, subtitle: 'Tarea especial de tu maestra',
    instructions: a.instructions || 'Arma cada oración usando palabras de cualquier experiencia.',
    items: a.items.map((it) => ({ es: it.es })),  // hide expected from the client
    pointsPerItem: a.pointsPerItem,
    expLabel: null,
    createdAt: a.createdAt,
  } });
});
app.post('/api/homework/custom-assignment/submit', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const { studentCode, assignmentId, answers } = req.body || {};
  // 🔒 2026-10-18 (ownership): a grade lands only on the caller's own record, never on a classmate's by a typed code (F6)
  const rec = _hwKid(req, res, studentCode);
  if (!rec) return;
  const a = CustomAsg.get(assignmentId);
  if (!a || a.status !== 'active') return res.status(404).json({ ok: false, error: 'no encontrada' });
  if (a.targetStudents.indexOf(rec.code) < 0) return res.status(403).json({ ok: false, error: 'no es para ti' });
  const result = CustomAsg.grade(a, answers);
  if (!result) return res.status(400).json({ ok: false, error: 'no se pudo calificar' });
  // Reuse the existing student submission log so it appears in parent view,
  // mistake review, etc. The custom flag lets the UI render its tag.
  Students.logAssignmentSubmission(rec.code, {
    assignmentId: a.id,
    custom: true,
    title: a.title,
    accessCode: String(req.body.accessCode || ''),
    score: result.score, total: result.total,
    answers: Array.isArray(answers) ? answers : [],
    breakdown: result.breakdown,
  });
  res.json({ ok: true, score: result.score, total: result.total, breakdown: result.breakdown });
});

app.get('/api/admin/students', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  // 🔑 2026-10-15: the /maestro login (this call) remembers the device as a teacher's: games open from it without
  // asking again (core/level-keys.js). Only when it isn't already (the roster polls every 15 s).
  const dev = LevelKeys.teacherDevice(req);
  if (!dev || (dev.teacher ? dev.teacher.uid : '*') !== (session.teacher ? session.teacher.uid : '*')) LevelKeys.rememberTeacher(req, res, session);
  let students = Students.listAll();
  // Filter by the teacher's classroom access codes. Super admin sees
  // everyone (including legacy students without a classroomCode).
  if (!session.isSuperAdmin && session.teacher) {
    const codes = new Set((session.teacher.accessCodes || []));
    students = students.filter((s) => s.classroomCode && codes.has(s.classroomCode));
  }
  // 🆕 Attach the EFFECTIVE classroom (teacher filing, else access-code match)
  // so the roster + push picker can show + group by class.
  students = students.map((s) => {
    const c = _effectiveClassroom(s);
    const lv = _levelState(s);
    const out = Object.assign({}, s, { classroomId: c ? c.id : null, classroomName: c ? c.name : null, levelOpen: lv.open, levelVia: lv.via,
      // (2026-10-22: the kid's level as the kid sees it, LevelKeys.classLevel: a teacher's «Change level», a key
      // account's own level, else the class code's; a record with neither still reads as the default)
      level: lv.level || Levels.DEFAULT,
      rutaBar: _rutaBar(s) });   // 🏆 La Ruta Dorada of their class level, in one small bar (2026-10-16)
    delete out.rawLevel; delete out.levelSince; delete out.levelAccess; delete out.ruta; delete out.autoBorn;
    return out;
  });
  res.json({
    ok: true,
    students,
    self: session.teacher ? {
      teacherId: session.teacher.teacherId,
      displayName: session.teacher.displayName,
      isSuperAdmin: session.isSuperAdmin,
      accessCodes: session.teacher.accessCodes,
    } : { isSuperAdmin: true, legacy: true },
    // accounts resting in the archive (30 days without activity): they come back when the kid uses their code
    archived: Students.archiveStats
      ? Students.archiveStats(session.isSuperAdmin || !session.teacher ? null : new Set(session.teacher.accessCodes || [])).archived
      : 0,
    archiveAfterDays: Students.ARCHIVE_AFTER_DAYS || 30,
  });
});
// 🆕 2026-06-21 (Fernando) — CLASSROOM SYSTEM (teacher-managed groups).
// A student's EFFECTIVE classroom is the one the teacher filed them into
// (classroomId), or — if unfiled — the classroom whose access code matches
// the login code they joined with. Manual filing always wins; classroomCode
// (the login code) is never reused, so parent-privacy stays intact.
function _effectiveClassroom(s) {
  // 🆕 2026-06-21 (Fernando) — NO auto-default. A student belongs to a
  // classroom ONLY if the teacher explicitly filed them there. A brand-new
  // class starts empty until you add kids in the member editor.
  if (s.classroomId) { const c = Classrooms.get(s.classroomId); if (c) return c; }
  return null;
}
// List every classroom with live student + online counts.
app.get('/api/admin/classrooms', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  const now = Date.now();
  const ONLINE = 60 * 1000;
  const counts = {};
  Students.listAll().forEach((s) => {
    const c = _effectiveClassroom(s);
    if (!c) return;
    if (!counts[c.id]) counts[c.id] = { students: 0, online: 0 };
    counts[c.id].students++;
    if (s.lastSeen && (now - s.lastSeen) <= ONLINE) counts[c.id].online++;
  });
  let list = Classrooms.list().map((c) => ({
    id: c.id, name: c.name, code: c.code || null,
    studentCount: (counts[c.id] || {}).students || 0,
    onlineCount: (counts[c.id] || {}).online || 0,
  }));
  // Regular teachers only see classrooms tied to one of their access codes
  // (or not yet tied to any). Super-admin sees all.
  if (!session.isSuperAdmin && session.teacher) {
    const codes = new Set((session.teacher.accessCodes || []).map((x) => String(x).trim().toUpperCase()));
    list = list.filter((c) => !c.code || codes.has(c.code));
  }
  res.json({ ok: true, classrooms: list });
});
// Create a classroom. Body: { name, code? }.
app.post('/api/admin/classrooms', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  const { name, code } = req.body || {};
  const c = Classrooms.create({ name, code });
  res.json({ ok: true, classroom: c });
});
// Rename / re-code a classroom. Body: { name?, code? }.
app.post('/api/admin/classroom/:id', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  const { name, code } = req.body || {};
  const c = Classrooms.update(req.params.id, { name, code });
  if (!c) return res.status(404).json({ ok: false, error: 'classroom not found' });
  res.json({ ok: true, classroom: c });
});
// Delete a classroom. Students filed into it fall back to access-code grouping.
app.delete('/api/admin/classroom/:id', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  res.json({ ok: Classrooms.remove(req.params.id) });
});
// File a student into a classroom (or '' to unfile). Body: { classroomId }.
app.post('/api/admin/student/:code/classroom', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  const rec = Students.get(req.params.code);
  if (!rec) return res.status(404).json({ ok: false, error: 'student not found' });
  if (!_canSessionTouchStudent(session, rec)) {
    return res.status(403).json({ ok: false, error: 'not in your classroom' });
  }
  const classroomId = String((req.body || {}).classroomId || '').trim();
  if (classroomId && !Classrooms.get(classroomId)) {
    return res.status(400).json({ ok: false, error: 'classroom not found' });
  }
  Students.setClassroomId(rec.code, classroomId);
  const c = classroomId ? Classrooms.get(classroomId) : null;
  res.json({ ok: true, code: rec.code, classroomId: classroomId || null, classroomName: c ? c.name : null });
});

// 🆕 2026-06-21 (Fernando) — LIVE FEEDBACK for "Llevar a casa". For each code,
// reports whether the most-recent gohome message has been DELIVERED (the
// kid's page consumed it → marked read) and whether they're still online.
// The send-home modal polls this so the teacher sees who actually went home.
app.get('/api/admin/gohome-status', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  const codes = String(req.query.codes || '').split(',').map((c) => c.trim()).filter(Boolean).slice(0, 200);
  // 🆕 reused for "Forzar alumnos" too: ?type=force checks force-message
  // delivery (kid's page consumed it and is entering the exam). Default gohome.
  const type = String(req.query.type || 'gohome');
  const now = Date.now();
  const statuses = codes.map((code) => {
    const rec = Students.get(code);
    if (!rec) return { code, exists: false, arrived: false, online: false };
    const go = (rec.inbox || []).find((m) => m.actionType === type);  // inbox is newest-first
    return {
      code,
      name: rec.displayName || 'Anon',
      exists: true,
      arrived: !!(go && go.readAt),
      online: !!(rec.lastSeen && (now - rec.lastSeen) <= 60 * 1000),
    };
  });
  res.json({ ok: true, statuses });
});

app.get('/api/admin/students/:code', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  const code = req.params.code;
  const rec = Students.get(code);
  if (!rec) return res.status(404).json({ ok: false, error: 'student not found' });
  // Authorization: teacher can only view students in their classrooms.
  if (!session.isSuperAdmin && session.teacher) {
    const codes = new Set((session.teacher.accessCodes || []));
    if (!rec.classroomCode || !codes.has(rec.classroomCode)) {
      return res.status(403).json({ ok: false, error: 'this student is not in your classroom' });
    }
  }
  res.json({
    ok: true,
    code: rec.code,
    displayName: rec.displayName || 'Anon',
    avatar:    rec.avatar || null,
    classroomCode: rec.classroomCode || null,
    classroomId: (_effectiveClassroom(rec) || {}).id || null,
    classroomName: (_effectiveClassroom(rec) || {}).name || null,
    country:   rec.country || null,
    device:    rec.device || null,
    locale:    rec.locale || null,
    tz:        rec.tz || null,
    firstSeen: rec.firstSeen || 0,
    lastSeen:  rec.lastSeen || 0,
    sentences: Students.getHistory(rec.code), // newest-first
    tests:     Students.getTestResults(rec.code, 50), // newest-first
    assignments: Students.getAssignmentSubmissions(rec.code, 50),
    notes:     Students.getNotes(rec.code),
    // 🏆 HSK simulation history — every exam this student has ever
    // delivered. Sorted newest first so the Cuaderno sees the most
    // recent attempt at the top, plus a per-sim "best score" summary.
    hskResults: (Array.isArray(rec.hskResults) ? rec.hskResults : []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0)),
    // 👤 GUEST FLAG — the kid joined via PIN with a typed code that
    // wasn't in our records. We auto-provisioned a record for them.
    // The Cuaderno shows a badge so the teacher can decide whether
    // to keep, rename, or merge into an existing student.
    isGuestPinJoin: !!rec.isGuestPinJoin,
    auto: !!(rec.auto && !rec.classroomCode),   // 🆕 2026-10-18: made by La Ruta Dorada by itself («automática»)
    byKey: !!(rec.byKey && !rec.classroomCode),   // 🆕 2026-10-18 (la entrada): made with the level key, no class yet («con clave»)
    levelKey: _levelState(rec),   // 🔑 2026-10-15: is their level open on their account, and how
    levelChange: _levelChangeOf(rec),   // 🆕 2026-10-22: a teacher's «Change level» still in force (when, seen on the phone)
    ruta: _rutaAdmin(rec),        // 🏆 2026-10-16: La Ruta Dorada per level (seals, El Entrenamiento, El Simulacro Dorado)
  });
});
// ── 🆕 2026-10-22 «Change level» (/maestro → a kid's profile) ─────────────────────────────────────────────────────────
// His words: "if I see someone is mistakenly in a level that doesn't correspond to them, I change it, and then
// automatically that person gets logged out and logged in again and it says exactly that… that is happening a lot".
// POST /api/admin/kid-level { code, level } (the kid's code in the body, never in an address: addresses reach access
// logs) → { ok, from, level, levelName, kidName, moved, undo, levelKey, levelChange, ruta } | { ok: true, unchanged }.
// Who: the kid's own teacher (the kid is on one of her class codes: a key kid tagged to her class too) or the super
// admin, the same as every kid-profile action (_canSessionTouchStudent); a page of ours (_autoSameSite) and the teacher
// edits' rate (_editRateOk). An unknown code and «not yours» get ONE answer; an archived account is refused (never woken).
// What changes (core/student-records.js changeLevel, written at once): the kid's own level (it wins over the class
// code's: LevelKeys.classLevel is the one function every reader asks), the same teacher's class code of that level when
// she has one, the new level opened as a teacher's opening (no key), a grandfathered old level kept theirs, and the
// notice their phone shows once. Their progress stays. The phone follows at its next request (/api/homework/home,
// /api/ruta-dorada, /api/entrada/*: the dkid cookie is re-issued, the saved class code still works). «Undo» for a
// short while: POST /api/admin/kid-level/undo { undo } puts back exactly what was replaced (the same teacher only).
const _NO_KID = 'We could not find this kid in your classes.';
const _kidLevelUndo = new Map();   // token → { code, who, snap, expect, until }
const _sessionWho = (session) => (session && session.teacher ? 't:' + session.teacher.uid : 'super');
function _levelChangeOf(rec) {
  const lb = rec && rec.levelBy;
  if (!lb || lb.undo || !_levelBound(rec)) return null;
  return { at: Number(lb.at) || 0, seen: Number(lb.seen) || 0 };
}
// the class code a kid moves to: the same teacher's class of the new level (the teacher of the kid's class code now),
// the first one in her list; null = no move (no class code, no class of that level, or theirs is already of that level)
function _kidLevelClass(rec, level) {
  const cur = rec && rec.classroomCode ? String(rec.classroomCode).trim().toUpperCase() : '';
  if (!cur || Teachers.levelForAccessCode(cur) === level) return null;
  const t = Teachers.getByAccessCode(cur);
  const code = t ? (t.accessCodes || []).find((c) => Teachers.levelForAccessCode(c) === level) : null;
  return code ? String(code).trim().toUpperCase() : null;
}
function _kidLevelGate(req, res) {
  res.set('Cache-Control', 'private, no-store');
  if (!_autoSameSite(req)) { res.status(403).json({ ok: false, error: 'Open /maestro and change it there.' }); return null; }
  const session = _adminAuth(req, res);
  if (!session) return null;
  if (!_editRateOk(req, session)) { res.status(429).json({ ok: false, error: 'Too many changes in a row. Wait a few minutes.' }); return null; }
  return session;
}
app.post('/api/admin/kid-level', (req, res) => {
  const session = _kidLevelGate(req, res);
  if (!session) return;
  const b = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const level = Levels.normalize(String(b.level || '').slice(0, 20));
  if (!level) return res.status(400).json({ ok: false, error: 'Pick a level.' });
  const code = Students.normalizeCode(String(b.code || '').slice(0, 12));
  const p = code ? Students.peek(code) : null;
  if (!p || p.rec.mergedInto || !_canSessionTouchStudent(session, p.rec)) return res.status(404).json({ ok: false, error: _NO_KID });
  if (p.archived) return res.status(409).json({ ok: false, archived: true, error: 'This account is resting in the archive (30 days without activity). It comes back the next time the kid logs in: change the level then.' });
  const rec = p.rec;
  const from = LevelKeys.classLevel(rec);
  const info = Levels.info(level);
  if (from === level) return res.json({ ok: true, unchanged: true, level, levelName: info.name, teacherName: info.teacherName });
  const keepFrom = !!(from && LevelKeys.goLiveAt() && LevelKeys.recordOpenVia(rec, from) === 'grandfathered');
  // (review) a level an earlier «Change level» opened and the kid never used closes again: a mis-move never stays open
  const fa = from && rec.levelAccess ? rec.levelAccess[from] : null;
  const dropFrom = !!(fa && fa.by === 'level' && !RutaProgress.hasAny(rec, from));
  const before = rec.classroomCode || null;
  const out = Students.changeLevel(rec.code, { level, from, keepFrom, dropFrom, toGen: LevelKeys.genOf(level),
    classroomCode: _kidLevelClass(rec, level), by: _sessionWho(session) });
  if (!out) return res.status(500).json({ ok: false, error: 'Could not save the change. Try again.' });
  const token = require('crypto').randomBytes(12).toString('hex');
  const now = Date.now();
  for (const [k, v] of _kidLevelUndo) if (v.until < now) _kidLevelUndo.delete(k);
  _kidLevelUndo.set(token, { code: rec.code, who: _sessionWho(session), snap: out.snap, expect: out.expect, until: now + 60e3 });
  const moved = (rec.classroomCode || null) !== before;
  console.log('[kid-level] a teacher changed a kid\'s level: ' + (from ? Levels.info(from).teacherName : 'none') + ' → ' + info.teacherName + (moved ? ' (moved to her class of that level)' : ''));   // (never a code or a name)
  res.json({ ok: true, from, fromName: from ? Levels.info(from).teacherName : null, level, levelName: info.name, teacherName: info.teacherName,
    moved, classroomCode: rec.classroomCode || null, undo: token,
    levelKey: _levelState(rec), levelChange: _levelChangeOf(rec), ruta: _rutaAdmin(rec) });
});
app.post('/api/admin/kid-level/undo', (req, res) => {
  const session = _kidLevelGate(req, res);
  if (!session) return;
  const token = String((req.body || {}).undo || '');
  const u = /^[a-f0-9]{24}$/.test(token) ? _kidLevelUndo.get(token) : null;
  if (!u || u.until < Date.now() || u.who !== _sessionWho(session)) return res.status(410).json({ ok: false, error: 'Too late to undo. Change the level again instead.' });
  _kidLevelUndo.delete(token);
  const back = (r) => { const l = LevelKeys.classLevel(r); return l ? { to: l, toGen: LevelKeys.genOf(l) } : {}; };
  if (!Students.undoLevel(u.code, u.snap, u.expect, back, _sessionWho(session))) return res.status(409).json({ ok: false, error: 'Something else changed this kid since. Change the level again instead.' });
  const rec = Students.peek(u.code).rec;
  const lvl = LevelKeys.classLevel(rec);
  console.log('[kid-level] a level change was undone');
  res.json({ ok: true, level: lvl, teacherName: lvl ? Levels.info(lvl).teacherName : null, classroomCode: rec.classroomCode || null,
    levelKey: _levelState(rec), levelChange: _levelChangeOf(rec), ruta: _rutaAdmin(rec) });
});
// ── 🔑 2026-10-15 — a kid's level on their account (core/level-keys.js), for the Cuaderno ─────────────────────────
// s = a record or a Students.listAll() row → { level, levelName, open, via: 'key' | 'teacher' | 'grandfathered' | null }
function _levelState(s) {
  const rec = { level: 'rawLevel' in s ? s.rawLevel : s.level, classroomCode: s.classroomCode, firstSeen: s.firstSeen,
    levelSince: s.levelSince, levelAccess: s.levelAccess, auto: 'autoBorn' in s ? s.autoBorn : !!s.auto };   // (the account's ORIGIN: never grandfathered, 2026-10-18 L8)
  const lvl = LevelKeys.classLevel(rec);
  const via = lvl ? LevelKeys.recordOpenVia(rec, lvl) : null;
  return { level: lvl, levelName: lvl ? Levels.info(lvl).name : null, open: !!via, via: via || null };
}
// «Desbloquear»: a teacher opens a kid's level on their account (any device, after their next /homework login),
// e.g. a new kid whose family hasn't got the key yet. Teachers of that kid's class (or the super-admin) only.
app.post('/api/admin/student/:code/level-access', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  const rec = Students.get(req.params.code);
  if (!rec) return res.status(404).json({ ok: false, error: 'student not found' });
  if (!_canSessionTouchStudent(session, rec)) return res.status(403).json({ ok: false, error: 'not in your classroom' });
  const level = Levels.normalize((req.body || {}).level) || LevelKeys.classLevel(rec);
  if (!level) return res.status(400).json({ ok: false, error: 'this student has no level yet' });
  Students.setLevelAccess(rec.code, level, 'teacher');
  res.json({ ok: true, levelKey: _levelState(rec), ruta: _rutaAdmin(rec) });
});
// ── 🏆 2026-10-16 La Ruta Dorada, phase 3: a kid's progress for the Cuaderno (core/ruta-progress.js) ───────────────
// The levels shown: their class level first, then any level they have progress in or have open on their account.
// Per level: open on the account (and how), seals per world, which El Entrenamiento worlds are open (by their seals
// or a teacher), El Simulacro Dorado (the rule in force) and their best % per simulation.
function _rutaAdmin(rec) {
  const st = RutaProgress.getSettings();
  const own = LevelKeys.classLevel(rec);
  const tries = Array.isArray(rec.hskResults) ? rec.hskResults : [];
  const levels = Levels.LEVELS
    .filter((l) => RutaProgress.baseOf(l.id) && (l.id === own || RutaProgress.hasAny(rec, l.id) || LevelKeys.recordOpenVia(rec, l.id)))
    .sort((a, b) => (a.id === own ? -1 : b.id === own ? 1 : 0))
    .map((l) => {
      const s = RutaProgress.state(rec, l.id);
      const via = LevelKeys.recordOpenVia(rec, l.id);
      // 🆕 2026-10-21: each experience's words (pinyin + Spanish) and whether this kid marked it («¡Me la sé!»)
      const sealed = RutaProgress.sealsOf(rec, l.id);
      const worlds = s.worlds.map((w) => Object.assign({}, w, {
        words: RutaProgress.worldWords(l.id, w.n).map((x) => ({ n: x.n, py: x.py, es: x.es, m: sealed.has(x.n) ? 1 : 0 })) }));
      // 🎯 phase 4: El Entrenamiento's extra worlds (Pinyin básico, Simulacro del examen) with the kid's best %: shown,
      // never counted for the Dorado (the regular worlds' best % is `practiced` in each world)
      const extra = (Train.worldsOf(l.id) || []).filter((w) => w.kind !== 'world')
        .map((w) => ({ key: w.key, name: w.name, best: s.extra && s.extra[w.key] != null ? s.extra[w.key] : null }));
      // 📖 phase 5: per simulation taken, the latest try's mistakes and «Ver su libro» (that kid's mistakes view, a
      // sealed link that opens only for a teacher session: core/golden.js teacherLink)
      const gb = Golden.ofLevel(l.id);
      let link = null;
      return {
        id: l.id, name: l.name, own: l.id === own, open: !!via, via: via || null,
        words: s.words, sealed: s.sealed, worlds, train: s.train, dorado: s.dorado, extra,
        sims: _rutaSimsOf(l.id).map((x) => {
          const mine = tries.filter((t) => t && t.simId === x.id);
          const best = mine.reduce((m, t) => Math.max(m, Number(t.percent) || 0), -1);
          const last = gb && Golden.simOf(gb, x.n) && Golden.simOf(gb, x.n).id === x.id ? Golden.latest(rec, x.id) : null;
          if (last && !link) link = Golden.teacherLink(rec.code, l.id);
          return { id: x.id, n: x.n, best: best >= 0 ? Math.round(best) : null, tries: mine.length,
            mistakes: last ? Golden.mistakesOf(last) : null, book: last ? _goldenHref(l.id, x.n) + '?de=' + link : null };
        }),
      };
    });
  return { settings: { trainingLive: st.trainingLive, doradoPct: st.doradoPct, trainingLaunchAt: st.trainingLaunchAt }, levels };
}
// the roster's small bar: the kid's class level (seals, El Entrenamiento worlds open) from a Students.listAll() row
function _rutaBar(s) {
  const lvl = LevelKeys.classLevel({ level: s.rawLevel, classroomCode: s.classroomCode });
  const st = lvl ? RutaProgress.state({ ruta: s.ruta }, lvl) : null;
  if (!st) return null;
  return { level: lvl, sealed: st.sealed, words: st.words, train: st.train.open, worlds: st.train.of };
}
// ── 🆕 2026-10-21 «Words: easiest and hardest» (/maestro → Class work) ──────────────────────────────────────────────
// His ask: which words the kids mark («¡Me la sé!» in La Base) and which they don't, to know what to put more emphasis
// on. Per experience (world) of the level's La Base: each word with how many of the kids who STARTED that experience
// (marked at least one of its words) marked it; a kid who hasn't reached an experience says nothing about its words.
// Only the teacher's own kids (her class codes; the super admin: everyone), never the archive (Students.listAll holds
// the live accounts only; Students.get would bring an archived kid back). Numbers only: no names, no codes, no log line.
// GET ?level=<id> (optional; default: the level where most of her kids marked words) → { levels: [{ id, name }], level, name,
//   kids, classKids, worlds: [{ n, name, short, count, started, all, words: [{ n, py, es, marked }] }] }
app.get('/api/admin/word-marks', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const session = _adminAuth(req, res);
  if (!session) return;
  const mine = session.isSuperAdmin || !session.teacher ? null : new Set(session.teacher.accessCodes || []);
  const kids = Students.listAll().filter((s) => !mine || (s.classroomCode && mine.has(s.classroomCode)));
  // the levels to pick from: her class codes' levels + any level her kids have marks in (super admin: every level)
  const ids = new Set();
  if (!mine) Levels.LEVELS.forEach((l) => ids.add(l.id));
  else {
    const cl = (session.teacher.codeLevels && typeof session.teacher.codeLevels === 'object') ? session.teacher.codeLevels : {};
    (session.teacher.accessCodes || []).forEach((c) => ids.add(Levels.normalize(cl[c]) || Levels.DEFAULT));
    kids.forEach((s) => { if (s.ruta && typeof s.ruta === 'object') Object.keys(s.ruta).forEach((k) => { const n = Levels.normalize(k); if (n) ids.add(n); }); });
  }
  const levels = Levels.LEVELS.filter((l) => ids.has(l.id) && RutaProgress.baseOf(l.id)).map((l) => ({ id: l.id, name: l.name }));
  const asked = req.query.level == null || req.query.level === '' ? null : Levels.normalize(String(req.query.level).slice(0, 20));
  if (req.query.level && !asked) return res.status(400).json({ ok: false, error: 'unknown level' });
  if (!levels.length) return res.json({ ok: true, levels: [], level: null, kids: 0, classKids: 0, worlds: [] });
  if (asked && !levels.some((l) => l.id === asked)) return res.status(403).json({ ok: false, error: 'not one of your levels' });
  const marksIn = (id) => kids.map((s) => RutaProgress.sealsOf({ ruta: s.ruta }, id)).filter((set) => set.size > 0);
  // not asked: the level where most of her kids have marked words (the first of her levels when none has any)
  let lvl = asked, marks = asked ? marksIn(asked) : null;
  if (!lvl) levels.forEach((l) => { const m = marksIn(l.id); if (!lvl || m.length > marks.length) { lvl = l.id; marks = m; } });
  const b = RutaProgress.baseOf(lvl);
  const classKids = kids.filter((s) => LevelKeys.classLevel({ level: s.rawLevel, classroomCode: s.classroomCode }) === lvl).length;
  const worlds = b.worlds.map((w) => {
    const words = RutaProgress.worldWords(lvl, w.n).map((x) => ({ n: x.n, py: x.py, es: x.es, marked: 0 }));
    let started = 0, all = 0;
    marks.forEach((set) => {
      let got = 0;
      words.forEach((x) => { if (set.has(x.n)) { x.marked++; got++; } });
      if (got > 0) started++;
      if (got > 0 && got === words.length) all++;
    });
    return { n: w.n, name: w.name, short: w.short, count: w.count, started, all, words };
  });
  res.json({ ok: true, levels, level: lvl, name: Levels.info(lvl).name, kids: marks.length, classKids, worlds });
});
// «Desbloquear» / «Volver a bloquear» one step for one kid: POST { level, step: 'train' | 'dorado', world: n | 'all',
// action: 'unlock' | 'lock' }. Teachers of the kid's class (or the super admin). «Volver a bloquear» undoes only what a
// teacher opened: a world the kid's own seals opened stays open.
app.post('/api/admin/student/:code/ruta', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const session = _adminAuth(req, res);
  if (!session) return;
  const rec = Students.get(req.params.code);
  if (!rec) return res.status(404).json({ ok: false, error: 'student not found' });
  if (!_canSessionTouchStudent(session, rec)) return res.status(403).json({ ok: false, error: 'not in your classroom' });
  const b = req.body || {};
  const level = Levels.normalize(b.level);
  if (!level || !RutaProgress.baseOf(level)) return res.status(400).json({ ok: false, error: 'unknown level' });
  const on = b.action === 'unlock' ? true : (b.action === 'lock' ? false : null);
  if (on === null) return res.status(400).json({ ok: false, error: 'action must be unlock or lock' });
  const out = RutaProgress.setTeacherUnlock(rec.code, level, String(b.step || ''), b.world, on);
  if (!out.ok) return res.status(out.status || 400).json(out);
  res.json({ ok: true, ruta: _rutaAdmin(rec) });
});

// Permanently DELETE a student record (super-admin or owning teacher).
// Used to remove duplicate / banned accounts from the Cuaderno. Wipes the
// whole record + all their history. Irreversible.
app.delete('/api/admin/students/:code', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  const rec = Students.get(req.params.code);
  if (!rec) return res.status(404).json({ ok: false, error: 'student not found' });
  if (!_canSessionTouchStudent(session, rec)) {
    return res.status(403).json({ ok: false, error: 'not in your classroom' });
  }
  const ok = Students.deleteStudent(rec.code);
  res.json({ ok: !!ok });
});

// === MESSAGING (teacher → student[s]) =================================
// Teachers can send a message to one student in their classroom, or
// broadcast to every student in their classroom. Students poll their
// inbox from /api/homework/inbox and see notifications.

// Authorization helper — can THIS session touch THIS student?
function _canSessionTouchStudent(session, rec) {
  if (!session || !rec) return false;
  if (session.isSuperAdmin) return true;       // super admin / legacy → all
  if (!session.teacher) return false;
  const codes = new Set(session.teacher.accessCodes || []);
  return !!(rec.classroomCode && codes.has(rec.classroomCode));
}

// Send a message to a single student. POST { text, actionType?, actionUrl?, actionLabel? }
app.post('/api/admin/student/:code/message', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  const rec = Students.get(req.params.code);
  if (!rec) return res.status(404).json({ ok: false, error: 'student not found' });
  if (!_canSessionTouchStudent(session, rec)) {
    return res.status(403).json({ ok: false, error: 'not in your classroom' });
  }
  const { text, actionType, actionUrl, actionLabel } = req.body || {};
  if (!text && !actionUrl) {
    return res.status(400).json({ ok: false, error: 'text or actionUrl required' });
  }
  const fromName = session.teacher ? session.teacher.displayName : 'Maestro/a';
  const fromId   = session.teacher ? 't:' + session.teacher.uid : 'super';   // 🔒 2026-10-15: never the teacher's code (kids' phones get their inbox)
  const msg = Students.sendMessage(rec.code, { from: fromId, fromName, text, actionType, actionUrl, actionLabel });
  if (!msg) return res.status(400).json({ ok: false, error: 'message rejected' });
  res.json({ ok: true, message: msg });
});

// === 📋 REPORT-CARD NOTES (teacher) ===
// Teacher adds short notes/keywords + an optional grade per month. The
// parent's "Generar reporte" tab composes a branded report card from these.
app.post('/api/admin/student/:code/note', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  const rec = Students.get(req.params.code);
  if (!rec) return res.status(404).json({ ok: false, error: 'student not found' });
  if (!_canSessionTouchStudent(session, rec)) {
    return res.status(403).json({ ok: false, error: 'not in your classroom' });
  }
  const { text, grade, month } = req.body || {};
  const ok = Students.addNote(rec.code, { text, grade, month });
  if (!ok) return res.status(400).json({ ok: false, error: 'empty note' });
  res.json({ ok: true, notes: Students.getNotes(rec.code) });
});
app.delete('/api/admin/student/:code/note/:ts', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  const rec = Students.get(req.params.code);
  if (!rec || !_canSessionTouchStudent(session, rec)) {
    return res.status(403).json({ ok: false, error: 'not allowed' });
  }
  Students.deleteNote(rec.code, req.params.ts);
  res.json({ ok: true, notes: Students.getNotes(rec.code) });
});

// === 📋 REPORT CARDS (parent, read-only via access code) ===
// List the months that have a report (notes). Always includes the current
// month so a fresh card can be generated even before any notes exist.
app.get('/api/homework/reports/:code', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const rec = _hwKid(req, res, req.params.code);   // 🔒 2026-10-18 (ownership; F6: one answer, no restore on a probe)
  if (!rec) return;
  // 🗓 Build the month list from ANY activity, not just teacher notes.
  // User reported: in May the option appeared because there were notes;
  // in June, the May button disappeared because no notes were added to
  // it that month. Parents need to be able to look back at any month
  // the kid was active — assignments, tests, HSK exams, or notes.
  const months = new Set();
  Students.getNotes(rec.code).forEach((n) => { if (n.month) months.add(n.month); });
  Students.getAssignmentSubmissions(rec.code, 500).forEach((s) => { if (s.ts) months.add(_tsToMonth(s.ts)); });
  Students.getTestResults(rec.code, 500).forEach((t) => { if (t.ts) months.add(_tsToMonth(t.ts)); });
  (rec.hskResults || []).forEach((r) => { if (r.ts) months.add(_tsToMonth(r.ts)); });
  (Students.getHistory(rec.code) || []).forEach((h) => { if (h.ts) months.add(_tsToMonth(h.ts)); });
  // Always include the current month so parents can generate "this
  // month so far" even before the kid has done anything yet.
  months.add(new Date().toISOString().slice(0, 7));
  // Newest first — parents typically want the latest report up top.
  const list = Array.from(months).filter(Boolean).sort().reverse();
  res.json({ ok: true, months: list });
});
// Full report-card payload for one month: notes, computed grade, stats.
app.get('/api/homework/report/:code', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const rec = _hwKid(req, res, req.params.code);   // 🔒 2026-10-18 (ownership; F6: one answer, no restore on a probe)
  if (!rec) return;
  const month = /^\d{4}-\d{2}$/.test(String(req.query.month || '')) ? req.query.month
              : new Date().toISOString().slice(0, 7);
  const notes = Students.getNotes(rec.code).filter((n) => n.month === month);
  // Grade: the teacher's most-recent explicit grade for the month wins;
  // otherwise derive a letter from assignment+test performance.
  let grade = null;
  for (let i = notes.length - 1; i >= 0; i--) { if (notes[i].grade) { grade = notes[i].grade; break; } }
  // 🔧 2026-05-30 — accurate, MONTH-SCOPED, PER-UNIQUE-ITEM stats.
  // Was: subs.length / tests.length counted every retry as a separate
  // "tarea" so a kid who retried one assignment 5 times showed "5 tareas".
  // Now: best score per unique assignmentId / storyId within this month,
  // and the headline numbers count how many distinct items the kid PASSED
  // (assignment passes at >=80%, test passes at >=80) and total sentences
  // saved that month (used for the parent-view 0→2000 progress).
  const allSubs = Students.getAssignmentSubmissions(rec.code, 500);
  const allTests = Students.getTestResults(rec.code, 500);
  const monthSubs = allSubs.filter((s) => _tsToMonth(s.ts) === month);
  const monthTests = allTests.filter((t) => _tsToMonth(t.ts) === month);
  const bestSubByAsgn = {};
  monthSubs.forEach((s) => {
    const pct = (s.score / (s.total || 100)) * 100;
    if (!(s.assignmentId in bestSubByAsgn) || pct > bestSubByAsgn[s.assignmentId]) {
      bestSubByAsgn[s.assignmentId] = pct;
    }
  });
  const bestTestByStory = {};
  monthTests.forEach((t) => {
    if (!(t.storyId in bestTestByStory) || t.score > bestTestByStory[t.storyId]) {
      bestTestByStory[t.storyId] = t.score;
    }
  });
  const assignmentsPassed = Object.values(bestSubByAsgn).filter((p) => p >= 80).length;
  const assignmentsAttempted = Object.keys(bestSubByAsgn).length;
  const testsPassed = Object.values(bestTestByStory).filter((p) => p >= 80).length;
  const testsAttempted = Object.keys(bestTestByStory).length;
  // Sentences saved this month (used by the parent 0→2000 progress).
  const sentencesThisMonth = (rec.sentencesBuilt || [])
    .filter((s) => _tsToMonth(s.ts) === month).length;
  if (!grade) {
    const pcts = Object.values(bestSubByAsgn).concat(Object.values(bestTestByStory));
    if (pcts.length) {
      const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length;
      grade = avg >= 90 ? 'A' : avg >= 80 ? 'B' : avg >= 70 ? 'C' : avg >= 60 ? 'D' : 'E';
    } else grade = '—';
  }
  res.json({
    ok: true,
    month,
    code: rec.code,
    displayName: rec.displayName || 'Anon',
    avatar: rec.avatar || null,
    grade,
    notes: notes.map((n) => ({ ts: n.ts, text: n.text, grade: n.grade })),
    stats: {
      // Headline numbers shown on the certificate. These count UNIQUE items
      // passed (>=80), not raw retries.
      assignments: assignmentsPassed,
      assignmentsAttempted,
      tests: testsPassed,
      testsAttempted,
      sentences: sentencesThisMonth,
    },
  });
});
function _tsToMonth(ts) {
  const t = Number(ts);
  if (!Number.isFinite(t)) return '';
  return new Date(t).toISOString().slice(0, 7);
}

// Rename a student (super-admin or owning teacher).
app.post('/api/admin/student/:code/rename', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  const rec = Students.get(req.params.code);
  if (!rec) return res.status(404).json({ ok: false, error: 'student not found' });
  if (!_canSessionTouchStudent(session, rec)) {
    return res.status(403).json({ ok: false, error: 'not in your classroom' });
  }
  const { displayName } = req.body || {};
  const ok = Students.setDisplayName(rec.code, displayName);
  if (!ok) return res.status(400).json({ ok: false, error: 'invalid name' });
  res.json({ ok: true, displayName: Students.get(rec.code).displayName });
});

// Broadcast to a SPECIFIC LIST of student codes (e.g. all currently
// online). POST { studentCodes: ["XYZN", ...], text, actionType?, ... }
// User feedback 2026-05-27: "I want to enable Modo Maestro for everyone
// I select that's online — not the whole classroom necessarily."
app.post('/api/admin/broadcast-selected', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  const { studentCodes, text, actionType, actionUrl, actionLabel } = req.body || {};
  if (!Array.isArray(studentCodes) || !studentCodes.length) {
    return res.status(400).json({ ok: false, error: 'studentCodes array required' });
  }
  if (!text && !actionUrl) {
    return res.status(400).json({ ok: false, error: 'text or actionUrl required' });
  }
  const fromName = session.teacher ? session.teacher.displayName : 'Maestro/a';
  const fromId   = session.teacher ? 't:' + session.teacher.uid : 'super';   // 🔒 2026-10-15: never the teacher's code (kids' phones get their inbox)
  // Authorization: regular teachers can only message students in their
  // own classrooms. Super admin can message anyone.
  const ownCodes = session.teacher ? new Set(session.teacher.accessCodes || []) : null;
  let sent = 0, skipped = 0;
  studentCodes.forEach((code) => {
    const rec = Students.get(code);
    if (!rec) { skipped++; return; }
    if (!session.isSuperAdmin && ownCodes && !ownCodes.has(rec.classroomCode)) {
      skipped++;
      return;
    }
    const msg = Students.sendMessage(rec.code, {
      from: fromId, fromName, text, actionType, actionUrl, actionLabel,
    });
    if (msg) sent++;
  });
  res.json({ ok: true, sent, skipped });
});

// Broadcast to all students in a classroom. POST { classroomCode, text, ... }
// Super admin can target any classroom; regular teacher only their own.
app.post('/api/admin/broadcast', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  const { classroomCode, text, actionType, actionUrl, actionLabel } = req.body || {};
  const cc = String(classroomCode || '').trim().toUpperCase();
  if (!cc) return res.status(400).json({ ok: false, error: 'classroomCode required' });
  // Authorization: regular teachers can only broadcast to their own
  // classroom codes. Super admin can target any.
  if (!session.isSuperAdmin && session.teacher) {
    const codes = new Set(session.teacher.accessCodes || []);
    if (!codes.has(cc)) return res.status(403).json({ ok: false, error: 'not your classroom' });
  }
  if (!text && !actionUrl) {
    return res.status(400).json({ ok: false, error: 'text or actionUrl required' });
  }
  const fromName = session.teacher ? session.teacher.displayName : 'Maestro/a';
  const fromId   = session.teacher ? 't:' + session.teacher.uid : 'super';   // 🔒 2026-10-15: never the teacher's code (kids' phones get their inbox)
  const count = Students.broadcastToClassroom(cc, { from: fromId, fromName, text, actionType, actionUrl, actionLabel });
  res.json({ ok: true, sent: count });
});

// Student inbox — gated by access code. ALSO touches lastSeen, which
// is how the /maestro live-presence indicator works. The /homework
// page polls this every 20s while open, so every poll re-marks the
// kid as "online now" for the teacher's Cuaderno view.
// User feedback 2026-05-27: "kids said they're online but I don't see
// them" — the inbox poll wasn't touching lastSeen before.
app.get('/api/homework/inbox', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const code = req.query.studentCode;
  const rec = _hwKid(req, res, code);   // 🔒 2026-10-18 (ownership; F6: one answer, no restore on a probe)
  if (!rec) return;
  rec.lastSeen = Date.now();   // ← presence heartbeat
  // 🔒 2026-10-15: `from` held the sending teacher's CODE on messages older than today: never sent to a phone
  // 🎮 2026-10-23 (the «Draly Party» names): an invite saved with a game's old name («La maestra está abriendo Mochi Mash
  // ahora…», «📚 Dàfùwēng · Monopolio») reads today's name (core/game-names.js); the record keeps what it saved
  const inbox = Students.getInbox(rec.code, 30).map((m) => { const o = Object.assign({}, GameNames.inboxMessage(m)); delete o.from; return o; });
  const unread = inbox.filter((m) => !m.readAt).length;
  res.json({ ok: true, inbox, unread });
});

// Dedicated presence ping — homework page can hit this even when it
// doesn't need anything from the inbox. Just bumps lastSeen.
app.post('/api/homework/ping', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const { studentCode } = req.body || {};
  const rec = _hwKid(req, res, studentCode);   // 🔒 2026-10-18 (ownership; F6: one answer, no restore on a probe)
  if (!rec) return;
  rec.lastSeen = Date.now();
  res.json({ ok: true, lastSeen: rec.lastSeen });
});

// 🆕 2026-06-08 (Fernando): global presence heartbeat. Any page that
// knows a studentCode (player.html in a game, hsk-sim.html taking the
// exam, host-warmup.html for the asistente kid) pings this every 30s
// so the teacher's "Solo en línea" filter sees them as online even
// when they're NOT sitting on the homework portal. Without this, kids
// in a different room/page looked offline and the teacher couldn't
// pull them back. Fernando's words: "If they are in different rooms,
// how do we know that they're still in the platform?"
//
// No access code required (works from any platform page). To prevent
// the endpoint from leaking which codes exist, we return 200 OK
// regardless and silently no-op on unknown codes. Tiny in-memory
// rate-limiter (no new dependency) so it can't be spammed to brute-
// force enumerate codes: max 120 reqs/min per client IP.
const _hbHits = new Map();   // ip → [timestamp, ...]
function _hbRateLimit(req) {
  const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
  const key = String(ip).split(',')[0].trim();
  const now = Date.now();
  const window = 60 * 1000;
  const arr = (_hbHits.get(key) || []).filter((t) => now - t < window);
  arr.push(now);
  _hbHits.set(key, arr);
  // Periodic GC so the map doesn't grow unbounded
  if (_hbHits.size > 5000) {
    for (const [k, v] of _hbHits) {
      if (!v.length || now - v[v.length - 1] > window) _hbHits.delete(k);
    }
  }
  return arr.length <= 120;
}
app.get('/api/heartbeat', (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!_hbRateLimit(req)) return res.status(429).json({ ok: false, error: 'rate-limited' });
  const code = String(req.query.code || '').trim();
  if (code) {
    // (2026-10-18, security check N5: a live account only; a probe never wakes an archived one)
    const live = Students.peek(code);
    const rec = live && !live.archived ? live.rec : null;
    if (rec) {
      rec.lastSeen = Date.now();
      // 🆕 2026-06-21 (Fernando) — teacher "send to homework profile". If an
      // unread 'gohome' message is pending, tell WHATEVER page is heartbeating
      // (player.html / hsk-sim.html — even a stuck/dead room) to navigate back
      // to /homework, and retire the message so it fires exactly once.
      if (Students.consumeGoHome(rec.code)) {
        return res.json({ ok: true, ts: Date.now(),
          redirect: '/homework?code=' + encodeURIComponent(rec.code) + '&from=maestro' });
      }
    }
  }
  res.json({ ok: true, ts: Date.now() });
});

// 🆕 2026-06-08 (Fernando) — GIF picker push. Teacher on /maestro
// dashboard picks a transparent dancing GIF + which kids → server
// inserts a special inbox message (actionType:'anim') for each kid.
// Kid's homework page inbox poll (every 20s) picks it up and shows
// the GIF overlay for 8s. Pattern is identical to the existing
// inbox-message-with-action flow; just a new actionType.
//
// Future: hook this to "mascot of the day" auto-rotation or HSK
// streak rewards — same endpoint, just called by a cron instead of
// by the teacher.
//
// Rate-limit: max 6 sends/min per IP so a runaway can't blast hundreds
// of inbox messages. Uses the same in-memory ip → timestamps map as
// the heartbeat for cheap-and-cheerful protection (no new dep).
const _gpHits = new Map();
function _gpRateLimit(req) {
  const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
  const key = 'gp-' + String(ip).split(',')[0].trim();
  const now = Date.now();
  const window = 60 * 1000;
  const arr = (_gpHits.get(key) || []).filter((t) => now - t < window);
  arr.push(now);
  _gpHits.set(key, arr);
  return arr.length <= 6;
}
// Whitelist of GIF IDs the teacher can broadcast — same set as the
// warmup Animaciones tray. Keeps server in charge of the URL so the
// client can't shove an arbitrary URL through the inbox.
// 2026-10-12 — the saga only (public/js/saga.js: Dralingo ×3, camel, Dubai plane, falcon, oryx); brand GIFs gone
const _GIF_LIBRARY = {};
Saga.ANIMS.forEach((x) => { _GIF_LIBRARY[x.id] = { url: x.url, label: x.label }; });
app.post('/api/admin/gif-push', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  if (!_gpRateLimit(req)) return res.status(429).json({ ok: false, error: 'demasiados envíos; espera un momento' });
  const { studentCodes, animId } = req.body || {};
  if (!Array.isArray(studentCodes) || !studentCodes.length) {
    return res.status(400).json({ ok: false, error: 'studentCodes required' });
  }
  const gif = _GIF_LIBRARY[String(animId || '').toLowerCase()];
  if (!gif) return res.status(400).json({ ok: false, error: 'unknown animId' });
  const fromName = (session.teacher && session.teacher.displayName) || 'Tu maestra';
  const fromId = (session.teacher && 't:' + session.teacher.uid) || 'super';   // 🔒 never the teacher's code
  let sent = 0;
  studentCodes.slice(0, 200).forEach((code) => {
    const rec = Students.get(String(code || '').trim());
    if (!rec) return;
    // Permission check — super-admin sees all, classroom teachers only
    // their own classroom (same pattern as other admin endpoints).
    if (!_canSessionTouchStudent(session, rec)) return;
    const msg = Students.sendMessage(rec.code, {
      from: fromId,
      fromName,
      text: gif.label,
      actionType: 'anim',
      actionUrl: gif.url,
      actionLabel: gif.label,
    });
    if (msg) sent++;
  });
  res.json({ ok: true, sent, animId, label: gif.label });
});

// Mark a single message read
app.post('/api/homework/inbox/:msgId/read', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const { studentCode } = req.body || {};
  const rec = _hwKid(req, res, studentCode);   // 🔒 2026-10-18 (ownership): only the kid's own inbox (F6)
  if (!rec) return;
  const ok = Students.markMessageRead(rec.code, req.params.msgId);
  res.json({ ok });
});

// Mark all messages read (when the kid opens the inbox modal)
app.post('/api/homework/inbox/read-all', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const { studentCode } = req.body || {};
  const rec = _hwKid(req, res, studentCode);   // 🔒 2026-10-18 (ownership): only the kid's own inbox (F6)
  if (!rec) return;
  const count = Students.markAllMessagesRead(rec.code);
  res.json({ ok: true, marked: count });
});

// === TEACHER MANAGEMENT (super-admin only) ===
// List all teachers. Used by /maestro super-admin panel.
app.get('/api/admin/teachers', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  if (!session.isSuperAdmin) return res.status(403).json({ ok: false, error: 'super admin only' });
  res.json({ ok: true, teachers: Teachers.listAll() });
});
// Create a new teacher. Returns the new teacherId + access code so the
// super admin can hand them over.
app.post('/api/admin/teachers', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  if (!session.isSuperAdmin) return res.status(403).json({ ok: false, error: 'super admin only' });
  const { displayName, email, country, levels } = req.body || {};
  if (!displayName) return res.status(400).json({ ok: false, error: 'displayName required' });
  // levels: any of core/levels.js (['yct1','hsk2','hsk1'] …) — one classroom code per level
  const t = Teachers.createTeacher({ displayName, email, country, levels });
  res.json({ ok: true, teacher: t });
});
// 🆕 2026-10-12 — the levels a classroom code can have (pickers in the Teachers tab)
app.get('/api/admin/levels', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  res.json({ ok: true, levels: Levels.list() });
});
// Add a classroom code with a level to an existing teacher
app.post('/api/admin/teachers/:teacherId/codes', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  if (!session.isSuperAdmin) return res.status(403).json({ ok: false, error: 'super admin only' });
  const out = Teachers.addAccessCode(req.params.teacherId, (req.body || {}).level);
  if (!out) return res.status(400).json({ ok: false, error: 'teacher or level not found' });
  res.json({ ok: true, code: out.code, teacher: out.teacher });
});
// Change the level of one classroom code (the kids who type it next get that level's tareas)
app.put('/api/admin/teachers/:teacherId/codes/:code', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  if (!session.isSuperAdmin) return res.status(403).json({ ok: false, error: 'super admin only' });
  const t = Teachers.setCodeLevel(req.params.teacherId, req.params.code, (req.body || {}).level);
  if (!t) return res.status(400).json({ ok: false, error: 'teacher, code or level not found' });
  res.json({ ok: true, teacher: t });
});
// ── 🔑 2026-10-15 «Cambiar mi código» ──────────────────────────────────────────────────────────────────────────────
// The super-admin code was served to everyone in a comment of the public maestro.js: every teacher can now change
// their own code (POST /api/admin/my-code { newCode }, signed in with the current one), and the super-admin can change
// any teacher's (PUT /api/admin/teachers/:teacherId/code). The old code stops at once and is retired for good
// (core/teachers.js); devices remembered with it ask again; THIS device is remembered with the new one. Codes never
// reach a log line.
function _changeTeacherCode(req, res, teacherId, newCode, isSelf) {
  const out = Teachers.changeCode(teacherId, newCode, (oldId, newId) => CustomAsg.renameTeacher(oldId, newId));
  if (!out.ok) return res.status(400).json({ ok: false, error: out.error });
  if (isSelf) LevelKeys.rememberTeacher(req, res, { teacher: Teachers.getByTeacherId(out.teacher.teacherId) });
  res.json({ ok: true, teacher: out.teacher });
}
// 🔒 2026-10-19 — the teacher edits' rate: per signed-in teacher (60 changes / 300 🎲 ideas in 10 minutes: «ese código no
// se puede usar» must not become a way to test codes) plus a looser cap per address (200 / 900), so one teacher at a
// school's shared address never stalls another. → false = wait
function _editRateOk(req, session, light) {
  const win = 10 * 60 * 1000;
  const who = (light ? 'ts:u:' : 'te:u:') + (session && session.teacher ? session.teacher.uid : 'legacy');
  const addr = (light ? 'ts:a:' : 'te:a:') + _clientIp(req);
  const max = light ? 300 : 60, amax = light ? 900 : 200;
  if (!_autoHit(who, win, max, true) || !_autoHit(addr, win, amax, true)) return false;
  _autoHit(who, win, max);
  _autoHit(addr, win, amax);
  return true;
}
app.post('/api/admin/my-code', (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!_autoSameSite(req)) return res.status(403).json({ ok: false, error: 'Abre /maestro y cámbialo desde ahí.' });
  const session = _adminAuth(req, res);
  if (!session) return;
  if (!session.teacher) return res.status(400).json({ ok: false, error: 'Entraste con la contraseña de respaldo (WU_ADMIN_PASSWORD): esa se cambia en Render, no aquí.' });
  if (!_editRateOk(req, session)) return res.status(429).json({ ok: false, error: 'Muchos intentos seguidos. Espera unos minutos.' });
  _changeTeacherCode(req, res, session.teacher.teacherId, (req.body || {}).newCode, true);
});
app.put('/api/admin/teachers/:teacherId/code', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const session = _adminAuth(req, res);
  if (!session) return;
  if (!session.isSuperAdmin) return res.status(403).json({ ok: false, error: 'super admin only' });
  const self = session.teacher && Teachers.getByTeacherId(req.params.teacherId) === session.teacher;
  _changeTeacherCode(req, res, req.params.teacherId, (req.body || {}).newCode, !!self);
});
// 🎲 «Sugerir» (2026-10-19, his ask: "send suggestions super cartoon style"): an animal + a describer + a food or thing +
// 2 digits (core/cartoon-codes.js), free and never a retired code; every signed-in teacher (their own «Cambiar mi
// código») and the super admin (anyone's). Made on the server with crypto randomness; never logged.
app.get('/api/admin/teachers/suggest-code', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const session = _adminAuth(req, res);
  if (!session) return;
  if (!_editRateOk(req, session, true)) return res.status(429).json({ ok: false, error: 'Muchas ideas seguidas. Espera un momento.' });
  res.json({ ok: true, code: Teachers.suggestCode() });
});

// ── 🆕 2026-10-19 /maestro → Teachers: edit a teacher (super admin; his ask: "edit the teachers' name and their codes
// and passwords") ─────────────────────────────────────────────────────────────────────────────────────────────────
// A teacher is named by uid in these URLs (never by a code: addresses reach access logs). Every change: the super
// admin's code (X-Admin-Pw), a page of ours (_autoSameSite), the edit rate (_editRateOk), written at once, logged with
// the teacher's name only (core/teachers.js), never a code. (The older /api/admin/teachers/:teacherId/… routes stay
// only for pages loaded before this; /maestro no longer calls them: remove them once no old tab is left.)
function _teacherEditGate(req, res, light) {
  res.set('Cache-Control', 'private, no-store');
  if (!_autoSameSite(req)) { res.status(403).json({ ok: false, error: 'Abre /maestro y cámbialo desde ahí.' }); return null; }
  const session = _adminAuth(req, res);
  if (!session) return null;
  if (!session.isSuperAdmin) { res.status(403).json({ ok: false, error: 'Solo el super admin puede cambiar esto.' }); return null; }
  if (!_editRateOk(req, session, light)) { res.status(429).json({ ok: false, error: 'Muchos cambios seguidos. Espera unos minutos.' }); return null; }
  return session;
}
const _NO_TEACHER = 'No encontramos a esa maestra o maestro. Abre la pestaña otra vez.';
const _teacherOfUid = (uid) => (typeof uid === 'string' && uid.length <= 40 ? Teachers.getByUid(uid) : null);
// name / email / country → { ok, teacher, changed }
app.put('/api/admin/teacher/:uid/profile', (req, res) => {
  if (!_teacherEditGate(req, res)) return;
  if (!_teacherOfUid(req.params.uid)) return res.status(404).json({ ok: false, error: _NO_TEACHER });
  const b = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const patch = {};
  ['displayName', 'email', 'country'].forEach((k) => { if (Object.prototype.hasOwnProperty.call(b, k)) patch[k] = b[k]; });
  const out = Teachers.updateProfile(req.params.uid, patch);
  res.status(out.ok ? 200 : 400).json(out);
});
// the teacher's login code («contraseña»): the same change as «Cambiar mi código» (old code retired, devices ask again,
// special assignments follow); the super admin's own row keeps this device remembered. → { ok, teacher } (the new code
// is teacher.teacherId: the window shows it once)
app.put('/api/admin/teacher/:uid/code', (req, res) => {
  const session = _teacherEditGate(req, res);
  if (!session) return;
  const t = _teacherOfUid(req.params.uid);
  if (!t) return res.status(404).json({ ok: false, error: _NO_TEACHER });
  _changeTeacherCode(req, res, t.teacherId, (req.body || {}).newCode, !!(session.teacher && session.teacher === t));
});
// the rest of the row by uid too (review 2026-10-19: these took the teacher's code in the URL): a class code's level
// { code, level }, a new class code { level }, and deleting a teacher (never the super admin; their kids keep their code,
// which is then never given to another class)
app.put('/api/admin/teacher/:uid/class-codes/level', (req, res) => {
  if (!_teacherEditGate(req, res)) return;
  const t = _teacherOfUid(req.params.uid);
  if (!t) return res.status(404).json({ ok: false, error: _NO_TEACHER });
  const out = Teachers.setCodeLevel(t.teacherId, (req.body || {}).code, (req.body || {}).level);
  if (!out) return res.status(400).json({ ok: false, error: 'Ese código o ese nivel no existe. Abre la pestaña otra vez.' });
  res.json({ ok: true, teacher: out });
});
app.post('/api/admin/teacher/:uid/class-codes', (req, res) => {
  if (!_teacherEditGate(req, res)) return;
  const t = _teacherOfUid(req.params.uid);
  if (!t) return res.status(404).json({ ok: false, error: _NO_TEACHER });
  const out = Teachers.addAccessCode(t.teacherId, (req.body || {}).level);
  if (!out) return res.status(400).json({ ok: false, error: 'Ese nivel no existe. Abre la pestaña otra vez.' });
  res.json({ ok: true, code: out.code, teacher: out.teacher });
});
app.delete('/api/admin/teacher/:uid', (req, res) => {
  if (!_teacherEditGate(req, res)) return;
  const t = _teacherOfUid(req.params.uid);
  if (!t) return res.status(404).json({ ok: false, error: _NO_TEACHER });
  if (!Teachers.deleteTeacher(t.teacherId)) return res.status(400).json({ ok: false, error: 'El super admin no se puede borrar.' });
  res.json({ ok: true });
});
// 🎲 a class code: 4 digits, free (no class, no kids, never retired)
app.get('/api/admin/class-codes/suggest', (req, res) => {
  if (!_teacherEditGate(req, res, true)) return;
  res.json({ ok: true, code: Teachers.suggestClassCode() });
});
// Before renaming a class code: is the new one allowed, and how many kids move? { from, to? } → { ok, from, to, kids:
// { live, archived }, classrooms } | 400 { error }
app.post('/api/admin/teacher/:uid/class-code/check', (req, res) => {
  if (!_teacherEditGate(req, res, true)) return;
  const b = req.body || {};
  const t = _teacherOfUid(req.params.uid);
  if (!t) return res.status(404).json({ ok: false, error: _NO_TEACHER });
  const from = String(b.from == null ? '' : b.from).trim().toUpperCase();
  if (!(t.accessCodes || []).includes(from)) return res.status(400).json({ ok: false, error: 'Ese código de clase ya no es de esta maestra. Abre la pestaña otra vez.' });
  const info = { ok: true, from, kids: Students.countByClassroomCode(from), classrooms: Classrooms.list().filter((c) => c.code === from).length };
  if (b.to != null && String(b.to).trim()) {
    const c = Teachers.checkClassCodeRename(t.uid, from, b.to);
    if (!c.ok) return res.status(400).json(Object.assign(info, { ok: false, error: c.error }));
    info.to = c.to;
  }
  res.json(info);
});
// Rename a class code everywhere it lives, so no kid or data is lost: every account tagged with it (live and in the
// archive: their names, results, homework, seals, level all stay; they only carry the new code), then the teacher's
// code list and the code's level (codeLevels), its named classrooms and guides. The old code stops existing at once and
// is retired (no other class may take it; this teacher may take it back). A kid with a session or a remembered phone
// keeps going; a phone that only saved the old class code asks for the kid's code + level key (the 4-number door is
// closed); PIN rooms tag new kids with the new code. Refused (nothing changed) when the archive can't be read or the
// disk refuses. { from, to } → { ok, teacher, from, to, kids: { live, archived }, classrooms, guides }
app.put('/api/admin/teacher/:uid/class-code', (req, res) => {
  if (!_teacherEditGate(req, res)) return;
  const b = req.body || {};
  const t = _teacherOfUid(req.params.uid);
  if (!t) return res.status(404).json({ ok: false, error: _NO_TEACHER });
  const c = Teachers.checkClassCodeRename(t.uid, b.from, b.to);
  if (!c.ok) return res.status(400).json(c);
  const NOT_CHANGED = 'No se pudo guardar: el código de clase no cambió y ningún alumno se movió. Vuelve a intentarlo en un momento.';
  const s = Students.renameClassroomCode(c.from, c.to);     // 1. the kids, written at once (undone by itself on failure)
  if (!s.ok) {
    console.warn('[teachers] a class code rename was refused: ' + (s.error === 'archive' ? 'the archive file is unreadable' : 'the student file was not written'));
    return res.status(503).json({ ok: false, error: s.error === 'archive'
      ? 'Ahora no se puede: el archivo de cuentas archivadas no se puede leer y esos alumnos no se moverían. El código de clase no cambió.'
      : NOT_CHANGED });
  }
  let done = Teachers.commitClassCodeRename(t.uid, c.from, c.to);   // 2. the teacher's code + its level
  if (!done.ok) {
    const back = Students.renameClassroomCode(c.to, c.from);
    if (back.ok) {
      console.warn('[teachers] a class code rename was undone (the teacher file was not written)');
      return res.status(503).json({ ok: false, error: NOT_CHANGED });
    }
    // (review 2026-10-19) the kids could not move back either: the teacher follows them in memory (saved by the next
    // write), so no kid is left on a code nobody owns
    done = Teachers.commitClassCodeRename(t.uid, c.from, c.to, true);
    console.warn('[teachers] a class code rename: the disk refused twice; kept in memory' + (done.ok ? '' : ' FAILED: the kids carry a code no teacher owns'));
    return res.status(503).json({ ok: false, error: 'Los alumnos ya pasaron al código nuevo, pero el disco no respondió bien. Abre esta pestaña otra vez en un minuto para comprobarlo.' });
  }
  let classrooms = 0, guides = 0;                                     // 3. what else carries the class code
  try { classrooms = Classrooms.renameCode(c.from, c.to); } catch (e) { console.warn('[teachers] classrooms not renamed:', e.message); }
  try { guides = Guides.renameClassroomCode(c.from, c.to); } catch (e) { console.warn('[teachers] guides not renamed:', e.message); }
  console.log('[teachers] class code rename: ' + s.live + ' kids moved, ' + s.archived + ' archived, ' + classrooms + ' classrooms, ' + guides + ' guides');
  res.json({ ok: true, teacher: done.teacher, from: c.from, to: c.to, kids: { live: s.live, archived: s.archived }, classrooms, guides });
});

// ── 🔑 2026-10-15 «Claves de nivel» (super-admin): see, set and change each level's key (core/level-keys.js) ──────
app.get('/api/admin/level-keys', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const session = _adminAuth(req, res);
  if (!session) return;
  if (!session.isSuperAdmin) return res.status(403).json({ ok: false, error: 'super admin only' });
  res.json({ ok: true, goLiveAt: LevelKeys.goLiveAt(), example: LevelKeys.EXAMPLE, levels: LevelKeys.list() });
});
app.put('/api/admin/level-keys/:level', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const session = _adminAuth(req, res);
  if (!session) return;
  if (!session.isSuperAdmin) return res.status(403).json({ ok: false, error: 'super admin only' });
  const out = LevelKeys.setKey(req.params.level, (req.body || {}).key);
  if (!out.ok) return res.status(400).json(out);
  res.json({ ok: true, goLiveAt: LevelKeys.goLiveAt(), levels: LevelKeys.list() });
});
app.post('/api/admin/level-keys/:level/close-devices', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const session = _adminAuth(req, res);
  if (!session) return;
  if (!session.isSuperAdmin) return res.status(403).json({ ok: false, error: 'super admin only' });
  const out = LevelKeys.closeDevices(req.params.level);
  if (!out.ok) return res.status(400).json(out);
  res.json({ ok: true, levels: LevelKeys.list() });
});
// ── 🏆 2026-10-16 La Ruta Dorada, phase 3: the unlock rules (core/ruta-progress.js) ───────────────────────────────────
// Every teacher may read them (a kid's profile explains them); only the super admin changes them: «El Entrenamiento
// está activo» (OFF until phase 4 ships: the Simulacro Dorado opens with the key) and the % every world needs then.
app.get('/api/admin/ruta-settings', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const session = _adminAuth(req, res);
  if (!session) return;
  res.json({ ok: true, settings: RutaProgress.getSettings(), canEdit: !!session.isSuperAdmin });
});
app.put('/api/admin/ruta-settings', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const session = _adminAuth(req, res);
  if (!session) return;
  if (!session.isSuperAdmin) return res.status(403).json({ ok: false, error: 'super admin only' });
  const b = req.body || {};
  const patch = {};
  if ('trainingLive' in b) patch.trainingLive = b.trainingLive;
  if ('doradoPct' in b) patch.doradoPct = b.doradoPct;
  const out = RutaProgress.setSettings(patch);
  if (!out.ok) return res.status(400).json(out);
  res.json({ ok: true, settings: out.settings, canEdit: true });
});

// Delete a teacher (super-admin only; cannot delete a super admin)
app.delete('/api/admin/teachers/:teacherId', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  if (!session.isSuperAdmin) return res.status(403).json({ ok: false, error: 'super admin only' });
  const ok = Teachers.deleteTeacher(req.params.teacherId);
  if (!ok) return res.status(400).json({ ok: false, error: 'cannot delete (not found or is super admin)' });
  res.json({ ok: true });
});

// === 📚 HOMEWORK PORTAL — async assignments, no PIN/host needed =========
// Student flow:
//   1) POST /api/homework/enter  { accessCode, studentCode?, displayName? }
//      → returns { ok, studentCode, assignments: [...] }
//   2) GET  /api/homework/assignment/:id?accessCode=XYZ
//      → returns the assignment body (items, instructions)
//   3) POST /api/homework/submit  { accessCode, studentCode, assignmentId, answers[] }
//      → grades, persists to student-records, returns { score, breakdown }
// All endpoints gate on isAccessCodeValid() — no admin password needed
// for students. The teacher hands out one of the 5 codes to her class.
// opts.classCodeOnly (2026-10-18, /api/homework/enter): only a real class code, never the session below
function _hwCheckAccess(req, res, opts) {
  const code = req.body && req.body.accessCode
            || req.query && req.query.accessCode
            || '';
  if (!Assignments.isAccessCodeValid(code)) {
    // 🆕 2026-10-18 (la entrada): a kid who came in with the level key has no class code: their session on this phone is
    // the pass when the page sends NO class code (each endpoint still asks _hwOwnsStudent whose record it may touch).
    // A wrong class code is still refused, and the old form's login always needs a real one (classCodeOnly).
    // 🆕 2026-10-19: a class code the super admin renamed (retired) counts as no code for a kid with a session: a page
    // that was open at that moment keeps working (its kid's record already carries the new code); it opens nothing else
    if ((!String(code || '').trim() || Teachers.isRetiredClassCode(code)) && !(opts && opts.classCodeOnly) && _entradaSessionKid(req)) return true;
    res.status(401).json({ ok: false, error: 'Código de acceso incorrecto' });
    return false;
  }
  return true;
}

// 🔒 2026-06-21 (Security Phase 1) — IDOR guard for parent/student reads.
// _hwCheckAccess only proves the access code is a VALID teacher code; it
// does NOT prove the requester may see THIS particular child. Without this,
// anyone holding one valid (often shared, low-entropy) classroom code could
// read any student's report card / inbox / sentences just by changing the
// :code in the URL. Here we bind the request: the presented access code
// must match the student's own classroomCode. Every kid who has entered
// since classroomCode shipped is tagged and therefore protected; legacy
// untagged records fall through to the old behavior so no real family is
// ever locked out. Returns true if the request may touch this student.
function _hwOwnsStudent(req, rec) {
  if (!rec) return false;
  // 🆕 2026-10-18 (la entrada): the kid's own session on this phone (or the phone holding them, `dkid`) owns their record.
  // An account made with the level key answers to nothing else: never a class code + its code (the code alone never
  // opens an account on a new phone: there it takes the code AND the level key, POST /api/entrada/entrar)
  if (_entradaOwns(req, rec)) return true;
  if (rec.byKey) return false;
  // Legacy record with no classroom tag — can't bind, preserve old access.
  // 🔒 2026-10-18 (security review M3): except an UNCLAIMED automatic account, which only the device holding it (its
  // dauto cookie) may use: its 6-character code alone opens nothing anywhere else
  if (!rec.classroomCode) return !(rec.auto && !rec.mergedInto) || _autoDeviceHolds(req, rec);
  const presented = String(
    (req.body && req.body.accessCode) || (req.query && req.query.accessCode) || ''
  ).trim().toUpperCase();
  if (presented === String(rec.classroomCode).trim().toUpperCase()) return true;
  // 🆕 2026-10-22 «Change level» (/maestro): a class code a teacher moved THIS kid away from still holds them on the phone
  // that saved it (the same proof as before the move; the login then hands that phone its new class code), only while
  // her change is still the account's level and class code (review: never a former class code for good)
  return !!(presented && _levelBound(rec) && Array.isArray(rec.levelBy.codes) && rec.levelBy.codes.includes(presented));
}
// 🆕 2026-10-22 «Change level»: is the teacher's last change still the account's state (its level AND its class code)?
// Only then do the levels and class codes it moved the kid away from still hold the kid, and its notice still shows.
// A login that re-tags the kid, a level key that moves them, another change: it stops at once.
function _levelBound(rec) {
  const lb = rec && rec.levelBy;
  if (!lb || typeof lb !== 'object' || !lb.to || LevelKeys.classLevel(rec) !== lb.to) return false;
  const cc = rec.classroomCode ? String(rec.classroomCode).trim().toUpperCase() : null;
  return (lb.cc == null ? null : String(lb.cc).trim().toUpperCase()) === cc;
}
// 🆕 2026-10-22 «Change level»: does a /homework login with this class code keep the level a teacher set? Yes while her
// change is still the kid's level and the code is the kid's own class code or one she moved them away from (the code a
// phone saved before the change); no for any other code (it re-tags the kid as always)
function _levelKept(rec, accessCode) {
  const typed = String(accessCode || '').trim().toUpperCase();
  if (!typed || !_levelBound(rec)) return false;
  return typed === String(rec.classroomCode || '').trim().toUpperCase() || (Array.isArray(rec.levelBy.codes) && rec.levelBy.codes.includes(typed));
}
// the notice the kid's phone shows once after a teacher's change («Tu profe te cambió a New HSK 1 ✨»): only while that
// change is still the kid's level and the phone hasn't shown it → { at, level, levelId, name, family } | null
function _levelNoteOf(rec) {
  const lb = rec && rec.levelBy;
  if (!lb || lb.seen || !_levelBound(rec)) return null;
  const i = Levels.info(lb.to);
  return { at: Number(lb.at) || 0, level: i.pack || i.id, levelId: i.id, name: i.name, family: i.family };
}

// 🔒 2026-06-21 (Security Phase 1) — overload/spam guard for student entry.
// Generous on purpose: a whole class often shares ONE public IP (school
// NAT), so 30+ kids may legitimately enter within the same minute. The cap
// is set high enough that no real classroom ever trips it, but low enough
// that a bot hammering the endpoint to create junk records / probe codes
// gets stopped. The real defense against cross-child reads is the IDOR
// guard above; this is purely an anti-flood backstop. 100 enters/min/IP.
const _enterHits = new Map();
function _enterRateLimit(req) {
  const ip = 'enter-' + _clientIp(req);
  const now = Date.now();
  const window = 60 * 1000;
  const arr = (_enterHits.get(ip) || []).filter((t) => now - t < window);
  arr.push(now);
  _enterHits.set(ip, arr);
  if (_enterHits.size > 5000) {
    for (const [k, v] of _enterHits) {
      if (!v.length || now - v[v.length - 1] > window) _enterHits.delete(k);
    }
  }
  return arr.length <= 100;
}
// 🔒 2026-10-15 — student codes typed that match no account (or someone else's class code on a tagged account), per
// address (60 / 10 min) and for the whole platform (600 / hour: class codes are not secret, so many addresses together
// must not find codes either; a pause then lasts until the hour's count drops, logged once). See /api/homework/enter.
const _hwMisses = new Map();
let _hwMissesAll = [];
function _hwCodeMissBlocked(req) {
  const now = Date.now();
  _hwMissesAll = _hwMissesAll.filter((t) => now - t < 60 * 60 * 1000);
  if (_hwMissesAll.length >= 600) return true;
  return (_hwMisses.get(_clientIp(req)) || []).filter((t) => now - t < 10 * 60 * 1000).length >= 60;
}
function _hwCodeMiss(req) {
  const now = Date.now();
  const ip = _clientIp(req);
  const arr = (_hwMisses.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  arr.push(now);
  _hwMisses.set(ip, arr);
  _hwMissesAll.push(now);
  if (arr.length === 60) console.warn('[security] student-code guessing ip=' + ip + ' → logins with unknown codes paused 10 min');
  if (_hwMissesAll.length === 600) console.warn('[security] 600 unknown student codes in one hour from many addresses → unknown-code logins paused');
  if (_hwMisses.size > 5000) for (const [k, v] of _hwMisses) if (!v.length || now - v[v.length - 1] > 10 * 60 * 1000) _hwMisses.delete(k);
}
// 🔒 2026-10-18 (security review F6) — the kid a homework call names, only when this request may touch that record
// (_hwOwnsStudent: the kid's session or remembered phone, or their own class code). An unknown code and «not yours» get
// ONE answer (403 «no autorizado»), counted per ADDRESS only (_hwMisses: never the platform-wide bucket, so nobody can
// block other families), 429 once that address is out of tries; a probe never brings an archived account back (peek
// first, Students.get only once ownership is proven). → the record, or null (already answered)
function _hwAddrMissBlocked(req) {
  const now = Date.now();
  return (_hwMisses.get(_clientIp(req)) || []).filter((t) => now - t < 10 * 60 * 1000).length >= 60;
}
function _hwAddrMiss(req) {
  const now = Date.now();
  const ip = _clientIp(req);
  const arr = (_hwMisses.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  arr.push(now);
  _hwMisses.set(ip, arr);
  if (arr.length === 60) console.warn('[security] student-code probing ip=' + ip + ' → lookups of unknown codes paused 10 min');
  if (_hwMisses.size > 5000) for (const [k, v] of _hwMisses) if (!v.length || now - v[v.length - 1] > 10 * 60 * 1000) _hwMisses.delete(k);
}
function _hwKid(req, res, code) {
  const p = code ? Students.peek(String(code)) : null;
  if (p && _hwOwnsStudent(req, p.rec)) return Students.get(p.rec.code);
  if (_hwAddrMissBlocked(req)) { res.status(429).json({ ok: false, error: 'demasiados intentos, espera unos minutos' }); return null; }
  _hwAddrMiss(req);
  res.status(403).json({ ok: false, error: 'no autorizado' });
  return null;
}
app.post('/api/homework/enter', (req, res) => {
  if (!_hwCheckAccess(req, res, { classCodeOnly: true })) return;
  if (!_enterRateLimit(req)) { console.warn('[security] homework/enter flood ip=' + _clientIp(req)); return res.status(429).json({ ok: false, error: 'demasiados intentos, espera un momento' }); }
  try {
    const { displayName, accessCode, meta } = req.body || {};
    // 🔒 2026-10-18 (security review M3): an UNCLAIMED automatic account answers here only on the device holding it (its
    // dauto cookie): anywhere else its code is a code that does not exist (the same answer and the same counted miss
    // below; with a name, a new account like any unknown code), so a class code + a guessed code never takes one over
    // (no session, no level on this device). '#' normalizes to no code at all.
    const studentCode = _autoLoginRefused(req, (req.body || {}).studentCode) ? '#' : (req.body || {}).studentCode;
    // 🆕 2026-10-12 — never an «Anon» account: no code and no name is refused, and a short name («Luis», «María»)
    // that looks like a code but matches no student comes back as codeNotFound (the client asks «¿eres nuevo/a?»
    // and resends it as a name).
    if (!studentCode && !String(displayName || '').trim()) {
      return res.status(400).json({ ok: false, error: 'Escribe tu nombre o tu código de estudiante' });
    }
    // 🔒 2026-10-15: a typed code that matches no account counts against the address (a login opens the levels the
    // kid's account has open, so student codes must not be found by trying them: 60 misses / 10 min per address; a
    // class of new kids whose names look like codes stays far below it)
    if (studentCode && !Students.get(studentCode)) {
      if (_hwCodeMissBlocked(req)) return res.status(429).json({ ok: false, error: 'demasiados intentos, espera unos minutos' });
      _hwCodeMiss(req);
    }
    if (studentCode && !displayName && !Students.get(studentCode)) {
      return res.json({ ok: false, codeNotFound: true, error: 'No encontramos ese código de estudiante' });
    }
    // 🆕 2026-09-15 — detect brand-new accounts BEFORE getOrCreate so the
    // client can show the big "anótalo en un cuaderno" student-code banner
    // exactly once (prevents duplicate accounts from forgotten codes).
    const isNew = !(studentCode && Students.get(studentCode));
    const rec = Students.getOrCreate(studentCode, displayName);
    // 🔒 2026-10-15 (security review): is this the kid's OWN class code, BEFORE this login re-tags the account (moving a
    // kid up is just handing them the next code, so homework keeps working either way)? Only then does the login open
    // anything of the key model (session, grandfathered level, the level on this device). A different class code on an
    // already-tagged account also counts as a guess.
    const ownsBefore = isNew || _hwOwnsStudent(req, rec);
    if (!ownsBefore) {
      if (_hwCodeMissBlocked(req)) return res.status(429).json({ ok: false, error: 'demasiados intentos, espera unos minutos' });
      _hwCodeMiss(req);
    }
    // 🔑 the level this account had before this login (a grandfathered level is stamped on the account below, before
    // the new code may move the kid to another level). Only on the kid's own class code: stamped by someone else's
    // login, a second login with the code they just re-tagged would hand them that level through the account.
    const prevLevel = LevelKeys.classLevel(rec);
    if (ownsBefore && prevLevel && LevelKeys.goLiveAt() && LevelKeys.recordOpenVia(rec, prevLevel) === 'grandfathered') {
      Students.setLevelAccess(rec.code, prevLevel, 'grandfathered');
    }
    // 🆕 HSK level comes from the ACCESS CODE the kid typed (1001→hsk1,
    // 1002→hsk2 …). Stamped on the record every entry, so moving a kid
    // up is just handing them the next code.
    // 🆕 2026-10-22 «Change level»: except after a teacher changed this kid's level in /maestro. Their own class code, or
    // a class code she moved them away from (saved on the phone), keeps her choice: no re-stamp, no re-tag; the answer
    // names the class code they are in now (`classMoved`: the phone saves it). Any other class code: as always.
    const kept = _levelKept(rec, accessCode);
    const level = kept ? (LevelKeys.classLevel(rec) || Levels.DEFAULT) : Teachers.levelForAccessCode(accessCode);
    if (!kept) {
      const was = [rec.level || null, rec.classroomCode || null].join('|');
      try { Students.setLevel(rec.code, level, prevLevel); }
      catch (e) { console.warn('[hw:enter] setLevel failed:', e.message); }
      // Tag with their teacher's classroom code. Guard so a failure here
      // never blocks the kid from entering — they can still do tareas.
      if (accessCode) {
        try { Students.setClassroomCode(rec.code, accessCode); }
        catch (e) { console.warn('[hw:enter] setClassroomCode failed:', e.message); }
      }
      // (2026-10-22, review) this login moved the kid: nothing a teacher's «Change level» left keeps working
      if (rec.levelBy && [rec.level || null, rec.classroomCode || null].join('|') !== was) Students.clearLevelBy(rec.code);
    }
    const classMoved = !!(kept && rec.classroomCode && String(accessCode || '').trim().toUpperCase() !== rec.classroomCode);
    // Best-effort device / country / locale capture (client-supplied, since
    // we can't read the real IP behind Render's proxy). Lets the teacher
    // spot duplicates + ban a device from the Cuaderno. Never blocks entry.
    try {
      if (meta && typeof meta === 'object') Students.setMeta(rec.code, meta);
    } catch (e) { console.warn('[hw:enter] setMeta failed:', e.message); }
    // 🔒 2026-10-15 — the same login is this kid's session on this phone (httpOnly cookie, core/sim-lock.js); only from
    // their own classroom code, like every other read of their record. 🔑 Their level opens here when their account has
    // it open (grandfathered, key saved, «Desbloquear»), and a key this device typed before is saved on the account.
    let levelOpen = false;
    if (ownsBefore) {
      SimLock.setSession(req, res, 's', rec.code, level);
      levelOpen = _openLevelOnDevice(req, res, rec, level);
    }
    // 🏆 2026-10-16: the seals on their account (any phone) for the «La Ruta Dorada de <nivel>» count on their home;
    // only to the kid's own login (their own class code), like everything else of their record
    const base = audioBaseFor(Levels.info(level));
    if (base && ownsBefore) { base.seals = [...RutaProgress.sealsOf(rec, level)].sort((a, b) => a - b); base.who = _sealWho(rec.code); }
    // 🏆 2026-10-18: «Hacer mis tareas» on their home: their level's homework audios and the ones marked «¡Ya la mandé!»
    // on their account (the phone adds its own marks not saved yet); only to the kid's own login, like the seals
    const tIds = ownsBefore ? _tareaIdsOf(level) : [];
    const tMarks = tIds.length ? _tareaMarks(rec, tIds) : null;
    const tareas = tIds.length ? { level: Levels.info(level).pack || level, ids: tIds, sent: tIds.filter((id) => tMarks[id] && tMarks[id].s), who: _sealWho(rec.code) } : null;
    _autoAfterLogin(req, res, rec, ownsBefore);   // 🆕 2026-10-18: a device holding an automatic account (claim / park)
    res.json({
      ok: true,
      studentCode: rec.code,
      displayName: rec.displayName,
      avatar: rec.avatar || null,
      avatarOptions: Students.AVATAR_OPTIONS,
      classroomCode: rec.classroomCode || null,
      classMoved,                                     // 🆕 2026-10-22: a teacher moved them to this class: the phone saves it
      level: level,                                   // 'yct1' | 'hsk2' (New HSK 1) | 'hsk1' — core/levels.js
      levelName: Levels.info(level).name,
      folders: Assignments.levelFolders(level),       // pack-quiz levels: one folder per world (else null)
      daily: Levels.info(level).daily !== false,      // Desafíos (HSK 1 words): off below HSK 1
      base,                                           // its vocabulary base on /audios («Empieza aquí»), or null
      tareas,                                         // its homework audios + the ones sent («Hacer mis tareas»), or null
      levelOpen,                                     // 🔑 its levels are open on this phone (else the base asks the key)
      isNew: isNew,                                   // show the code banner once
      assignments: Assignments.listAssignments(level), // portal reshapes by level
      submissions: Students.getAssignmentSubmissions(rec.code, 100),
    });
  } catch (e) {
    console.error('[hw:enter] FAILED:', e.message, e.stack);
    res.status(500).json({ ok: false, error: 'server error: ' + e.message });
  }
});
// Set the kid's avatar (one of the 12 allowed SVG names).
app.post('/api/homework/avatar', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const { studentCode, avatar } = req.body || {};
  // 🔒 Phase 2: bind the write to ownership — can't edit a kid in another
  // classroom even with a valid access code. (2026-10-18 F6: an unknown code answers the same as «not yours»)
  const rec = _hwKid(req, res, studentCode);
  if (!rec) return;
  const ok = Students.setAvatar(rec.code, avatar);
  if (!ok) return res.status(400).json({ ok: false, error: 'avatar inválido o estudiante no encontrado' });
  res.json({ ok: true });
});
// Let a kid rename themselves from the portal settings.
app.post('/api/homework/rename', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const { studentCode, displayName } = req.body || {};
  const rec0 = _hwKid(req, res, studentCode);   // 🔒 Phase 2 ownership bind (2026-10-18 F6: one answer)
  if (!rec0) return;
  const ok = Students.setDisplayName(rec0.code, displayName);
  if (!ok) return res.status(400).json({ ok: false, error: 'nombre inválido o estudiante no encontrado' });
  const rec = Students.get(rec0.code);
  res.json({ ok: true, displayName: rec ? rec.displayName : null });
});
// Reset a kid's submissions for a specific assignment (clean slate).
app.post('/api/homework/reset', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const { studentCode, assignmentId } = req.body || {};
  if (!assignmentId) return res.status(400).json({ ok: false, error: 'assignmentId requerido' });
  const rec = _hwKid(req, res, studentCode);   // 🔒 Phase 2 ownership bind (2026-10-18 F6: one answer)
  if (!rec) return;
  const removed = Students.resetAssignmentSubmissions(rec.code, assignmentId);
  res.json({ ok: true, removed });
});
// 👨‍👩‍👧 2026-10-18 · Papás («Mi Dralingo» part 2, his approved design): the kid's La Ruta Dorada for the parents' view.
// Only for the logged-in kid's OWN record (the /homework session cookie must be this same kid: the insights door alone,
// a class code + a student code, never shows it). Built from the builders the kid's route already uses
// (RutaProgress.state: seals and the best % per world · _rutaExps: the experiences' names and pictures · Train.worldsOf:
// the practice links · _tareaIdsOf + _tareaMarks: the homework sent · Golden.latest + attemptView: the simulations
// taken), then worked out by public/js/papas-plan.js, the same file the page runs (four numbers, the experiences done /
// current / later, «Lo más importante esta semana»). Cheap: one record, the level's ~10 worlds and ~10 homeworks.
const PapasPlan = require('./public/js/papas-plan.js');
let _papasHw = null;   // homework id → { exp, round, title } from the audio catalog (read once per boot, like the marks')
function _papasHwInfo() {
  if (_papasHw) return _papasHw;
  const m = new Map();
  let list = null;
  try { list = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'assets', 'audios', 'catalog.json'), 'utf8')).homeworks; }
  catch (e) { console.warn('[papas] catalog unreadable:', e.message); }
  // (2026-10-18, «Mi Dralingo» part 3: the kid's home plays each homework right in its experience: its three tracks,
  // light (address, kind, code, length; never the lines), and its pictures)
  const light = (t) => ({ src: String(t.src || ''), kind: String(t.kind || ''), code: String(t.code || ''), dur: Number(t.dur) || 0 });
  (Array.isArray(list) ? list : []).forEach((h) => { if (h && typeof h.id === 'string') m.set(h.id, { exp: Number(h.exp) || null, round: Number(h.round) || null, title: String(h.title || ''),
    tracks: Array.isArray(h.tracks) ? h.tracks.filter((t) => t && t.src).map(light) : [], thumb: h.thumb || null, cover: h.cover || null }); });
  if (Array.isArray(list)) _papasHw = m;
  return m;
}
// the simulation taken last (the latest try of each, golden books) → { n, percent, passed, at } | null: Papás, the kid's
// home and La Ruta Dorada's module page read the same one («¡Aprobaste El Simulacro Dorado con P %!»)
function _simsTaken(rec, lvl) {
  const gb = Golden.ofLevel(lvl);
  const out = [];
  if (gb && rec) gb.sims.forEach((s) => {
    const t = Golden.latest(rec, s.id);
    if (!t) return;
    const v = Golden.attemptView(t, s);
    out.push({ n: s.n, percent: v.percent, passed: v.passed, at: v.ts, mistakes: Golden.mistakesOf(t), book: _goldenHref(lvl, s.n) });
  });
  return out;
}
function _lastSimOf(books) {
  const last = (books || []).reduce((m, x) => (!m || x.at >= m.at ? x : m), null);
  return last ? { n: last.n, percent: last.percent, passed: last.passed, at: last.at } : null;
}
function _papasRuta(rec, level) {
  const lvl = level.id;
  const slug = level.pack || lvl;
  const st = RutaProgress.state(rec, lvl);            // null: the level has no La Base yet
  const b = RutaProgress.baseOf(lvl);
  const exps = _rutaExps(lvl);
  const tw = Train.worldsOf(lvl) || [];
  const ids = _tareaIdsOf(lvl);
  const marks = _tareaMarks(rec, ids);
  const info = _papasHwInfo();
  const ab = audioBaseFor(level);
  // the simulations of this level the kid took (the latest try of each), for «simulacro en clase» and its golden book
  const books = _simsTaken(rec, lvl);
  const last = _lastSimOf(books);
  const raw = {
    level: lvl, slug, name: level.name, who: _sealWho(rec.code),
    base: ab ? { href: ab.href, level: ab.level } : null,
    pct: st ? st.dorado.pct : RutaProgress.getSettings().doradoPct,
    words: st ? st.words : 0,
    seals: st ? [...RutaProgress.sealsOf(rec, lvl)].sort((x, y) => x - y) : [],
    worlds: (st ? st.worlds : []).map((w) => {
      const e = exps.find((x) => x.n === w.n);
      const bw = b ? b.worlds.find((x) => x.n === w.n) : null;
      const k = tw.find((x) => x.kind === 'world' && x.n === w.n);
      return { n: w.n, name: (e && e.name) || w.name || w.short, pic: e ? e.pic : null, first: bw ? bw.first : 0, count: w.count,
        best: w.practiced, open: !!w.train, train: k ? '/audios/' + slug + '/entrenamiento/' + k.key : null };
    }),
    hws: ids.map((id) => { const i = info.get(id) || {}; return { id, exp: i.exp || null, round: i.round || null, title: i.title || '', sent: !!(marks[id] && marks[id].s) }; }),
    sim: last,
    books: books.sort((x, y) => x.n - y.n),
  };
  raw.plan = PapasPlan.plan(raw);
  // (the kid's home reuses what was just read: never sent, never in the JSON)
  Object.defineProperty(raw, '_parts', { value: { st, tw, ids, info } });
  return raw;
}
// the questions to ask at home, by experience («Cómo ayudar en casa» picks this week's): each passed tarea's own
// encouragement (core/assignments.js parentInsight), its experience from the tarea's world (a pack world by its order
// among the level's experiences, or EXP1…EXP8)
function _papasPrompts(insights, level) {
  const pack = Packs.LEVELS.find((p) => p.id === (level.pack || level.id));
  const order = pack ? pack.worlds.filter((w) => w && w.id !== 'pinyin' && w.id !== 'simulacro').map((w) => w.id) : [];
  const out = [];
  (insights || []).forEach((row) => {
    const a = Assignments.getAssignment(row.assignmentId);
    const text = row.insight && row.insight.encouragement;
    if (!a || !text || (a.level || 'hsk1') !== level.id) return;   // (a tarea of the kid's level only)
    const lab = String(a.expLabel || '');
    const m = /^exp\s*(\d+)$/i.exec(lab);
    const exp = m ? Number(m[1]) : (order.indexOf(lab) + 1 || null);
    if (exp) out.push({ exp, text: String(text) });
  });
  return out;
}
// 🏠 2026-10-18 · «Mi Dralingo» part 3: THE KID'S HOME (/homework, public/js/mi-dralingo.js, his approved design
// .claude/handoff/kidhome-design: Main, Phone, Experiencia…). La Ruta Dorada as a path of the level's experiences, «Hoy»
// (js/papas-plan.js today(): the same decision as Papás' «Lo más importante»), each experience = 1 Palabras → 2 Tu tarea
// → 3 Práctica (papas-plan.js LADDER, 2026-10-21; the practice in its own view), El Simulacro Dorado at the end. GET /api/homework/home?accessCode=&studentCode= (the homework doors:
// _hwCheckAccess + _hwKid, so an unknown code and «not yours» get the same 403) →
//   { ok, level, slug, levelName, family, streak: { days, today }, ruta: null | {…} }
// `ruta` only when the /homework session on this phone is this same kid (like Papás: a class code + a code never shows
// it): _papasRuta (seals, practice, homework sent, simulations, the plan) + open (LevelKeys.access: La Base and El
// Entrenamiento open on this request) + key (the level's key screen) + exps (each experience's pack world, its folder
// picture and a few word pictures, all under neutral names) + marks (heard / sent) + media (each homework's light tracks
// and pictures, to play it right in its experience) + dorado (RutaProgress) + extra (Pinyin básico, Simulacro del examen)
// + route (the module page, which keeps everything else). Never the kid's code, never hanzi, never cached.
function _homeRuta(req, rec, level) {
  const lvl = level.id;
  const raw = _papasRuta(rec, level);
  const slug = raw.slug;
  const { st, tw, ids, info } = raw._parts;
  const a = levelAccess(req, lvl);
  const media = {};
  ids.forEach((id) => { const h = info.get(id); if (h) media[id] = { tracks: h.tracks || [], thumb: h.thumb || null, cover: h.cover || null }; });
  const extra = (kind) => {
    const k = tw.find((x) => x.kind === kind);
    if (!k) return null;
    const best = st && st.extra && st.extra[kind] != null ? st.extra[kind] : null;
    // (Pinyin básico is open from the start; the Simulacro del examen once every regular world is open)
    const open = kind === 'pinyin' || !!(st && st.worlds.length && st.worlds.every((w) => w.train));
    return { href: '/audios/' + slug + '/entrenamiento/' + k.key, best, open };
  };
  return Object.assign(raw, {
    open: !!a.ok,
    key: '/audios/' + slug + '/clave',
    route: '/audios/' + slug,
    exps: _rutaExps(lvl).map((e) => ({ n: e.n, name: e.name, pic: e.pic, world: _rutaExpWorld[slug + '/' + e.n] || null, peek: _rutaExpPeek[slug + '/' + e.n] || [] })),
    marks: _tareaMarks(rec, ids),
    media,
    dorado: st ? { open: !!st.dorado.open, via: st.dorado.via || null, practiced: st.dorado.practiced, of: st.dorado.of, pct: st.dorado.pct, teacher: !!st.dorado.teacher } : null,
    extra: { pinyin: extra('pinyin'), simulacro: extra('simulacro') },
  });
}
app.get('/api/homework/home', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (!_hwCheckAccess(req, res)) return;
  const rec = _hwKid(req, res, req.query && req.query.studentCode);
  if (!rec) return;
  try {
    // (review 2026-10-18: the level as the login payload reads it, LevelKeys.classLevel: a key account's own level)
    const level = Levels.info(LevelKeys.classLevel(rec) || rec.level || Levels.DEFAULT);
    const me = _studentOf(req);
    let ruta = null, zoco = null, levelNote = null;
    if (me && me.code === rec.code) {
      // 🆕 2026-10-22 «Change level»: the teacher's change, once (the page comes in again in `level` and says so)
      levelNote = _levelNoteOf(rec);
      _kidFollow(req, res);
      // the phone's time zone, for «N días seguidos» on the kid's own calendar (only the kid's own session sets it)
      if (req.query && req.query.tz) Students.setTz(rec.code, String(req.query.tz));
      try { ruta = _homeRuta(req, rec, level); } catch (e) { console.warn('[home] ruta failed:', e.message); }
      // 🪙 2026-10-19 El Zoco: the coins pill of the band and what came in since this phone last looked (`zs`); the
      // purse opens here at the first visit (the welcome grant), a new day pays what a cap left waiting
      try {
        Students.updateZoco(rec.code, (r) => { Zoco.ensure(r, _zocoEnv()); return Zoco.settle(r); });
        zoco = Object.assign(Zoco.brief(Students.get(rec.code), Number(req.query && req.query.zs) || 0), { now: Date.now() });
      } catch (e) { console.warn('[home] zoco failed:', e.message); }
    }
    res.json({ ok: true, level: level.id, slug: level.pack || level.id, levelName: level.name, family: level.family,
      streak: Students.streakOf(rec), ruta, zoco, levelNote });
  } catch (e) {
    console.error('[home] failed:', e.message);
    res.status(500).json({ ok: false, error: 'No se pudo cargar tu inicio. Vuelve a intentarlo.' });
  }
});
// 👨‍👩‍👧 Parent view — returns a digest of what the kid has learned, in
// Spanish, derived from their completed assignments + reading-mode tests.
// No password, just access code + student code (parent uses same as kid).
app.get('/api/homework/insights/:code', (req, res) => {
  res.set('Cache-Control', 'private, no-store');   // (2026-10-18: a kid's progress, never kept by a cache)
  if (!_hwCheckAccess(req, res)) return;
  const rec = _hwKid(req, res, req.params.code);   // 🔒 2026-10-18 (ownership; F6: one answer, no restore on a probe)
  if (!rec) return;
  const subs = Students.getAssignmentSubmissions(rec.code, 100);
  // Map each submission to its assignment definition + insight. Take the
  // BEST attempt per assignment, then keep only those with score ≥ 60%.
  const bestByAssignment = {};
  subs.forEach((s) => {
    const cur = bestByAssignment[s.assignmentId];
    if (!cur || s.score > cur.score) bestByAssignment[s.assignmentId] = s;
  });
  const insights = [];
  Object.values(bestByAssignment).forEach((sub) => {
    const a = Assignments.getAssignment(sub.assignmentId);
    if (!a || !a.parentInsight) return;
    const pct = (sub.score / sub.total) * 100;
    if (pct < 80) return;  // PASS threshold is 80% (user 2026-05-28)
    insights.push({
      assignmentId:    a.id,
      assignmentTitle: a.title,
      score:           sub.score,
      total:           sub.total,
      pct:             Math.round(pct),
      insight:         a.parentInsight,
      lastAttemptAt:   sub.ts,
    });
  });
  // Tests done (any reading-mode test attempt counts as "they engaged").
  // We dedupe by storyId so the parent sees "1 story tested" if the kid
  // retook the same test 5 times — user feedback 2026-05-27: "it says
  // five exámenes de lectura but we only did one and they took it
  // multiple times".
  const tests = Students.getTestResults(rec.code, 50);
  const testsByStory = {};
  tests.forEach((t) => {
    if (!testsByStory[t.storyId] || t.score > testsByStory[t.storyId].score) {
      testsByStory[t.storyId] = t;
    }
  });
  const uniqueTests = Object.values(testsByStory);
  // ASSIGNMENTS THE KID HASN'T TRIED YET — surfaced so the parent can
  // nudge them ("¡Aún no has hecho la tarea de la familia! Hazla ahora.")
  // Listed in the parent view with a redirect CTA into the homework portal.
  // only the kid's own level counts as "por hacer" (2026-10-22: the one function every reader asks, LevelKeys.classLevel:
  // a teacher's «Change level» or a key account's own level; else the class code's)
  const level = Levels.info(LevelKeys.classLevel(rec) || Levels.DEFAULT);
  const allAssignments = Assignments.listAssignments(level.id);
  // PENDING = never tried OR best attempt < 80% (can't pass below 80).
  const bestPctById = {};
  Object.values(bestByAssignment).forEach((s) => {
    bestPctById[s.assignmentId] = (s.score / (s.total || 100)) * 100;
  });
  const remaining = allAssignments
    .filter((a) => (bestPctById[a.id] == null) || (bestPctById[a.id] < 80))
    .map((a) => ({
      assignmentId: a.id,
      title:        a.title,
      subtitle:     a.subtitle,
      totalPoints:  a.totalPoints,
      bestPct:      bestPctById[a.id] != null ? Math.round(bestPctById[a.id]) : null,
    }));
  // CONVERSATION PROMPTS — concrete questions parents can ask. Pulled
  // from each mastered assignment's encouragement string PLUS each
  // passed reading test (≥60%). User feedback 2026-05-27: prompts
  // should "be linked with the amount of tests and lectures the kid
  // has done according to the system."
  const conversationPrompts = insights.map((row) => ({
    assignmentTitle: row.assignmentTitle,
    prompt: row.insight.encouragement
         || `Pregúntale: "${row.assignmentTitle}" — pídele que te lo diga en voz alta.`,
  }));
  uniqueTests.filter((t) => t.score >= 60).forEach((t) => {
    conversationPrompts.push({
      assignmentTitle: t.storyTitle || t.storyId,
      prompt: `Pídele que te cuente la historia de "${t.storyTitle || t.storyId}" — los personajes, qué pasó, su parte favorita.`,
    });
  });
  // WORD COUNT — estimate vocab the kid has demonstrated. We count
  // unique normalized pinyin tokens that appeared in CORRECT graded
  // breakdowns. Conservative: only words the kid actually used right.
  const learnedWords = new Set();
  let sentencesAttempted = 0;
  let sentencesCorrect = 0;
  subs.forEach((s) => {
    // 🎮 pack-quiz tareas (YCT game rounds) are questions, not sentences: only their «¿Cómo se dice…?» answers
    // (pinyin) count as words
    if (String(s.assignmentId || '').startsWith('pack-')) {
      (s.breakdown || []).forEach((b) => {
        if (b.correct && /^¿Cómo se dice/.test(b.es || '')) learnedWords.add(String(b.student).toLowerCase().replace(/[^a-z]/g, ''));
      });
      return;
    }
    (s.breakdown || []).forEach((b) => {
      sentencesAttempted++;
      if (b.correct) {
        sentencesCorrect++;
        if (b.student) {
          String(b.student).toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[.,!?;:'"()¿¡]/g, '')
            .split(/\s+/).filter(Boolean)
            .forEach((w) => learnedWords.add(w));
        }
      }
    });
  });
  // PER-SENTENCE DETAIL for the expandable "oraciones correctas" panel in
  // the parent view — what each kid wrote vs the right answer, per lesson.
  // Built from the BEST attempt per assignment so parents see their latest
  // best work, not every retry.
  const sentenceDetail = [];
  Object.values(bestByAssignment).forEach((sub) => {
    const rows = (sub.breakdown || []).map((b) => ({
      es: b.es, expected: b.expected, student: b.student || '', correct: !!b.correct,
    }));
    if (!rows.length) return;
    sentenceDetail.push({
      assignmentId: sub.assignmentId,
      assignmentTitle: sub.assignmentTitle || sub.assignmentId,
      score: sub.score, total: sub.total,
      correct: rows.filter((r) => r.correct).length,
      rows,
    });
  });
  // 📝 EXÁMENES REALES — HSK simulation attempts the kid has finished.
  // Stored per-student as rec.hskResults = [{ simId, score, total,
  // percent, ts }]. We enrich each row with the friendly title from
  // the HskSim module so the parent sees "HSK1 · Simulación 2"
  // instead of "hsk1-sim2", and sort newest first so the most recent
  // attempt is on top. (Fernando 2026-06-04: parents should see real
  // exam attempts in their Progreso view; existing accounts that
  // already have data will populate automatically.)
  const hskRows = (Array.isArray(rec.hskResults) ? rec.hskResults : [])
    .slice()
    .sort((a, b) => (b.ts || 0) - (a.ts || 0))
    .map((r) => {
      const sim = _simMeta(r.simId);
      return {
        simId:   r.simId,
        title:   (sim && sim.title) || r.simId,
        level:   (sim && sim.level) || null,
        score:   r.score,
        total:   r.total,
        percent: r.percent,
        ts:      r.ts,
      };
    });
  // Pick the BEST attempt per simId for the headline counter so a kid
  // who took Sim 1 four times shows as "1 examen" with their best %, not 4.
  const bestPercentBySim = {};
  hskRows.forEach((r) => {
    if (bestPercentBySim[r.simId] == null || r.percent > bestPercentBySim[r.simId]) {
      bestPercentBySim[r.simId] = r.percent;
    }
  });
  res.json({
    ok: true,
    code: rec.code,
    displayName: rec.displayName,
    avatar: rec.avatar || '🧒🏼',
    level: level.id,
    levelName: level.name,
    levelEmoji: level.emoji,
    levelExam: level.exam,
    levelNext: level.next,
    levelWords: level.packWords ? Packs.wordLists(level.pack) : null,   // null = the client's HSK 1 list
    insights,
    tests: uniqueTests,
    remaining,
    conversationPrompts,
    sentenceDetail,
    hskResults: hskRows,
    // 👨‍👩‍👧 2026-10-18 · Papás: La Ruta Dorada (seals, practice, homework sent, simulations, «Lo más importante»), only
    // when the /homework session on this phone is this same kid (null otherwise: the page asks to come in again)
    ruta: (() => {
      const me = _studentOf(req);
      if (!me || me.code !== rec.code) return null;
      try { return Object.assign(_papasRuta(rec, level), { prompts: _papasPrompts(insights, level) }); }
      catch (e) { console.warn('[papas] ruta failed:', e.message); return null; }
    })(),
    totals: {
      assignmentAttempts:    subs.length,
      // of THIS level's tareas (a kid who moved up keeps the old logros in the list, not in the count)
      assignmentsMastered:   insights.filter((row) => allAssignments.some((a) => a.id === row.assignmentId)).length,
      assignmentsAvailable:  allAssignments.length,
      assignmentsRemaining:  remaining.length,
      readingTestsTaken:     uniqueTests.length,     // unique stories, NOT total attempts
      readingTestAttempts:   tests.length,
      // Estimated vocab (user feedback 2026-05-27: "make a word count
      // — palabras aprendidas, oraciones, estimated").
      wordsLearned:          learnedWords.size,
      wordsTotalHsk1:        150,
      wordsTotal:            level.words || null,   // null = the level has no fixed count to show (YCT 1)
      sentencesCorrect,
      sentencesAttempted,
      // 🌱 Lifetime saved-sentence count — drives the parent 0→2000 progress
      // bar. Every save (warmup save, daily-bonus, edited copy) increments it.
      sentencesSavedTotal:   (rec.sentencesBuilt || []).length,
      sentencesSavedGoal:    2000,
      // 📝 HSK simulation counters for the parent's Progreso view.
      hskAttempts:           hskRows.length,
      hskSimsAttempted:      Object.keys(bestPercentBySim).length,
    },
  });
});

// Maestro per-sentence delete — surgical removal. User feedback:
// "I do not need to delete every single sentence, just one or two,
// individually." Same access rule as the nuke-all endpoint below.
app.post('/api/admin/student/:code/sentence/delete', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  const rec = Students.get(req.params.code);
  if (!rec) return res.status(404).json({ ok: false, error: 'student not found' });
  if (!_canSessionTouchStudent(session, rec)) {
    return res.status(403).json({ ok: false, error: 'not in your classroom' });
  }
  const { ts } = req.body || {};
  const ok = Students.deleteHistoryEntry(rec.code, ts);
  res.json({ ok, sentences: Students.getHistory(rec.code, 200) });
});

// 📤 PUSH a teacher-built sentence to one or more students' Mis
// Oraciones. The teacher constructs the sentence in host-warmup
// (or eventually a standalone builder), picks the recipients, and
// fires this endpoint. Each kid sees the sentence as if they saved
// it themselves — except it's flagged pushedByTeacher so the kid /
// parent view can show a "📤 Enviada por tu maestra" badge.
//
// POST /api/admin/sentence/push
// { studentCodes: ["ABCD", ...], words: [...], teacherName?: string }
app.post('/api/admin/sentence/push', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  const { studentCodes, words, sentences, category } = req.body || {};
  if (!Array.isArray(studentCodes) || !studentCodes.length) {
    return res.status(400).json({ ok: false, error: 'studentCodes array required' });
  }
  // 🆕 2026-06-04 — accept EITHER single-sentence (legacy `words` array)
  // OR a batch (`sentences: [{ words, category? }, ...]`). The batch
  // path supports "Paquete de lección" where a teacher accumulates
  // several sentences for one experience and ships them in one POST.
  // Per-sentence category overrides the batch-level category.
  let packs = [];
  if (Array.isArray(sentences) && sentences.length) {
    packs = sentences.filter((s) => s && Array.isArray(s.words) && s.words.length).map((s) => ({
      words: s.words.map((w) => String(w).slice(0, 32)).slice(0, 24),
      category: SentenceCategories.isValidCategoryId(s.category) ? s.category
              : SentenceCategories.isValidCategoryId(category)   ? category
              : null,
    }));
    if (!packs.length) return res.status(400).json({ ok: false, error: 'sentences array empty' });
    if (packs.length > 20) return res.status(400).json({ ok: false, error: 'too many sentences (max 20)' });
  } else if (Array.isArray(words) && words.length) {
    packs = [{
      words: words.map((w) => String(w).slice(0, 32)).slice(0, 24),
      category: SentenceCategories.isValidCategoryId(category) ? category : null,
    }];
  } else {
    return res.status(400).json({ ok: false, error: 'words array OR sentences array required' });
  }
  // Authorization: regular teachers can only push to kids in their
  // own classrooms. Super-admin pushes to anyone.
  const ownCodes = session.teacher ? new Set(session.teacher.accessCodes || []) : null;
  const teacherName = session.teacher
    ? (session.teacher.displayName || 'Maestro/a')
    : 'Super maestro';
  let sentencesSent = 0, kidsTouched = 0, skipped = 0, notFound = 0;
  studentCodes.forEach((code) => {
    const rec = Students.get(code);
    if (!rec) { notFound++; return; }
    // 🆕 2026-06-21 (Fernando) BUGFIX: super-admin must reach EVERY student.
    // Was missing the !isSuperAdmin guard (every other endpoint has it), so
    // pushing to an aula whose members joined with a different access code
    // silently SKIPPED them — the sentence never landed in Mis Oraciones /
    // report card / parent view. Now super-admin pushes to anyone.
    if (!session.isSuperAdmin && ownCodes && rec.classroomCode && !ownCodes.has(rec.classroomCode)) {
      skipped++; return;
    }
    let landed = 0;
    packs.forEach((p) => {
      if (Students.pushSentenceFromTeacher(rec.code, p.words, teacherName, p.category)) {
        landed++;
      }
    });
    if (landed) { kidsTouched++; sentencesSent += landed; }
  });
  res.json({
    ok: true,
    sent: kidsTouched,                  // legacy field name (kids reached)
    sentencesSent,                      // total sentence-rows written
    packSize: packs.length,
    skipped,
    notFound,
  });
});

// ✏️ Maestro EDIT: replace the words of an existing saved sentence
// in-place. Used when a kid saves a sentence that has typos or runs
// two words together — teacher edits without losing the timestamp /
// position in the history. Accepts a new words array (same shape
// logSentence uses).
app.post('/api/admin/student/:code/sentence/edit', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  const rec = Students.get(req.params.code);
  if (!rec) return res.status(404).json({ ok: false, error: 'student not found' });
  if (!_canSessionTouchStudent(session, rec)) {
    return res.status(403).json({ ok: false, error: 'not in your classroom' });
  }
  const { ts, words } = req.body || {};
  if (!Array.isArray(words) || !words.length) {
    return res.status(400).json({ ok: false, error: 'words required' });
  }
  const idx = (rec.sentencesBuilt || []).findIndex((s) => s.ts === ts);
  if (idx < 0) return res.status(404).json({ ok: false, error: 'sentence not found' });
  // Mutate in place — preserves ts so the entry stays in the same
  // chronological slot. Cap word count + length per word.
  rec.sentencesBuilt[idx].words = words.map((w) => String(w).slice(0, 32)).slice(0, 24);
  rec.sentencesBuilt[idx].editedBy = session.teacher ? 't:' + session.teacher.uid : 'super';   // 🔒 never the teacher's code
  rec.sentencesBuilt[idx].editedAt = Date.now();
  try { Students._save && Students._save(); } catch (_) {}
  res.json({ ok: true, sentences: Students.getHistory(rec.code, 200) });
});

// Maestro cleanup: nuke every saved sentence for this student. Used when
// the teacher needs a fresh slate (kid was spamming test saves, etc.).
// Super-admin or the owning teacher only — same access rule as deletion.
app.post('/api/admin/student/:code/sentences/clear', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  const rec = Students.get(req.params.code);
  if (!rec) return res.status(404).json({ ok: false, error: 'student not found' });
  if (!_canSessionTouchStudent(session, rec)) {
    return res.status(403).json({ ok: false, error: 'not in your classroom' });
  }
  const removed = Students.clearAllSentences(rec.code);
  res.json({ ok: true, removed });
});

// 🗑 DELETE one HSK simulation attempt from a student's record.
// (Fernando 2026-06-04: "me as a teacher, can I delete one of the
// records of the simulation so that their parents don't see that
// they got a 30, for example? And if I delete it, they get deleted
// on their own dashboard as well.")
//
// Deletion is by timestamp (unique per attempt within a student). The
// parent view and kid Mis Exámenes both refetch on open so a deletion
// here disappears from those surfaces automatically — no broadcasts
// needed.
//
// POST /api/admin/student/:code/hsk-attempt/delete?pw=...
//   body: { ts: <number> }
app.post('/api/admin/student/:code/hsk-attempt/delete', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  const rec = Students.get(req.params.code);
  if (!rec) return res.status(404).json({ ok: false, error: 'student not found' });
  if (!_canSessionTouchStudent(session, rec)) {
    return res.status(403).json({ ok: false, error: 'not in your classroom' });
  }
  const ts = parseInt((req.body && req.body.ts), 10);
  if (!ts) return res.status(400).json({ ok: false, error: 'ts required' });
  const before = (rec.hskResults || []).length;
  rec.hskResults = (rec.hskResults || []).filter((r) => r.ts !== ts);
  const removed = before - rec.hskResults.length;
  if (!removed) return res.status(404).json({ ok: false, error: 'attempt not found' });
  // 🆕 2026-06-16: was Students._save (never exported → silent no-op, so
  // deletions didn't survive a restart). Use the real save.
  try { Students.save(); } catch (_) {}
  res.json({ ok: true, removed, remaining: rec.hskResults.length });
});

// 🆕 2026-06-16 (Fernando): MIGRATE an HSK attempt to another student.
// "Sometimes kids take a test from the wrong account — I should touch
// the result and migrate it to the correct student code, and it appears
// everywhere (Cuaderno, Mis Exámenes, Papás) as if taken from that
// account." Both students must be in the teacher's classroom.
//   POST /api/admin/hsk-result/migrate?pw=...
//   body: { fromCode, ts, toCode }
app.post('/api/admin/hsk-result/migrate', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  const { fromCode, ts, toCode } = req.body || {};
  const fromRec = Students.get(String(fromCode || '').trim());
  const toRec = Students.get(String(toCode || '').trim().toUpperCase());
  if (!fromRec) return res.status(404).json({ ok: false, error: 'origen no encontrado' });
  if (!toRec) return res.status(404).json({ ok: false, error: 'el código destino no existe' });
  // Permission: teacher must own BOTH students (super-admin owns all).
  if (!_canSessionTouchStudent(session, fromRec) || !_canSessionTouchStudent(session, toRec)) {
    return res.status(403).json({ ok: false, error: 'fuera de tu salón' });
  }
  const result = Students.migrateHskAttempt(fromRec.code, parseInt(ts, 10), toRec.code);
  if (!result.ok) return res.status(400).json(result);
  res.json({ ok: true, toName: toRec.displayName || toRec.code, toCode: toRec.code });
});

app.get('/api/homework/assignment/:id', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const a = Assignments.getAssignment(req.params.id);
  if (!a) return res.status(404).json({ ok: false, error: 'Asignación no encontrada' });
  // 🎒 word-sack (HSK2): send the chip bag + goal + HASHES of the valid
  // sentences (djb2 of the normalized string). The kid's device can
  // confirm a discovery instantly, but devtools never shows an answer,
  // and the server re-validates on submit anyway.
  if (a.type === 'word-sack') {
    return res.json({
      ok: true,
      id: a.id,
      title: a.title,
      subtitle: a.subtitle,
      instructions: a.instructions,
      type: a.type,
      level: a.level || 'hsk2',
      expLabel: a.expLabel || null,
      goal: a.goal,
      sack: a.sack,
      validHashes: a.validHashes,
      hintTemplates: a.hintTemplates || [],   // «wǒ yào ▢» — never a full answer
      items: [],   // legacy clients see an empty classic tarea, not a crash
    });
  }
  // 🎮 pack-quiz (YCT game rounds): the round's questions, answers shuffled, never the correct one — each tap is
  // checked by /api/homework/pack-check and the submit is re-graded on the server.
  if (a.type === 'pack-quiz') {
    return res.json({
      ok: true, id: a.id, title: a.title, subtitle: a.subtitle, instructions: a.instructions,
      type: a.type, level: a.level, expLabel: a.expLabel || null,
      questions: Assignments.packQuizQuestions(a),
      items: [],   // legacy clients see an empty classic tarea, not a crash
    });
  }
  // Don't send the `expected` answers — the student would see them in
  // dev tools. Send the prompts only; grading happens server-side.
  res.json({
    ok: true,
    id: a.id,
    title: a.title,
    subtitle: a.subtitle,
    instructions: a.instructions,
    type: a.type,
    expLabel: a.expLabel || null,   // lets the client lock the word bank
    pointsPerItem: a.pointsPerItem,
    items: a.items.map((it) => ({ es: it.es })),  // NO expected
  });
});

// === 📘 STUDY-GUIDE PDFs ============================================
// Stored on the persistent disk (see core/guides.js). Families list + open
// them from the parent view's "Guías" tab; teachers upload from /maestro.

// List guides for a family (filtered to their classroom + shared guides).
app.get('/api/guides', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  let cc = null;
  try {
    // (2026-10-18 F6: only the kid's own record picks the class's guides; a probe never restores an archived account)
    const p = req.query.studentCode ? Students.peek(String(req.query.studentCode)) : null;
    const rec = p && _hwOwnsStudent(req, p.rec) ? p.rec : null;
    cc = rec && rec.classroomCode ? rec.classroomCode : null;
  } catch (_) {}
  res.json({ ok: true, guides: Guides.list(cc) });
});
// Stream a guide PDF inline (opens in the phone's PDF viewer / new tab).
app.get('/api/guides/:id', (req, res) => {
  const fp = Guides.filePath(req.params.id);
  if (!fp || !fs.existsSync(fp)) return res.status(404).json({ ok: false, error: 'guía no encontrada' });
  const g = Guides.get(req.params.id);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="' + ((g && g.title) || 'guia').replace(/[^a-z0-9 _-]/gi, '') + '.pdf"');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  fs.createReadStream(fp).pipe(res);
});
// Teacher list (admin) — shows all guides with size, for management.
app.get('/api/admin/guides', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  res.json({ ok: true, guides: Guides.list(null) });
});
// Upload a guide PDF (admin). Body: { title, exp, classroomCode, dataBase64 }.
// 20mb JSON parser on THIS route only (a 2-3 MB PDF is ~4 MB base64).
app.post('/api/admin/guides', express.json({ limit: '20mb' }), (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  const { title, exp, classroomCode, dataBase64 } = req.body || {};
  if (!dataBase64 || typeof dataBase64 !== 'string') {
    return res.status(400).json({ ok: false, error: 'falta el PDF' });
  }
  // Strip a data: URL prefix if present.
  const b64 = dataBase64.replace(/^data:application\/pdf;base64,/, '');
  let buffer;
  try { buffer = Buffer.from(b64, 'base64'); }
  catch (_) { return res.status(400).json({ ok: false, error: 'PDF inválido' }); }
  if (!buffer.length || buffer.length > 18 * 1024 * 1024) {
    return res.status(400).json({ ok: false, error: 'PDF vacío o demasiado grande (máx 18 MB)' });
  }
  // Sanity: PDFs start with "%PDF".
  if (buffer.slice(0, 4).toString('latin1') !== '%PDF') {
    return res.status(400).json({ ok: false, error: 'El archivo no es un PDF válido' });
  }
  const rec = Guides.addGuide({ title, exp, classroomCode, buffer });
  res.json({ ok: true, guide: { id: rec.id, title: rec.title, exp: rec.exp, size: rec.size } });
});
app.delete('/api/admin/guides/:id', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  const ok = Guides.deleteGuide(req.params.id);
  res.json({ ok: !!ok });
});

// 🎮 one tap in a pack-quiz tarea → { correct, expected } (the right answer is shown after the tap, so the kid learns)
app.post('/api/homework/pack-check', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const { assignmentId, text, chosen } = req.body || {};
  const a = Assignments.getAssignment(assignmentId);
  if (!a || a.type !== 'pack-quiz' || !a.key.has(text)) return res.status(404).json({ ok: false, error: 'Pregunta no encontrada' });
  const expected = a.key.get(text);
  res.json({ ok: true, correct: String(chosen || '') === expected, expected });
});

app.post('/api/homework/submit', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const { studentCode, assignmentId, answers, accessCode } = req.body || {};
  const a = Assignments.getAssignment(assignmentId);
  if (!a) return res.status(404).json({ ok: false, error: 'Asignación no encontrada' });
  // 🔒 2026-10-12 — only from the kid's own classroom code (same IDOR guard as avatar / rename / insights)
  const rec = _hwKid(req, res, studentCode);   // 🔒 2026-10-18 (ownership; F6: one answer, no restore on a probe)
  if (!rec) return;
  const result = Assignments.gradeSubmission(a, answers);
  Students.logAssignmentSubmission(rec.code, {
    assignmentId: a.id,
    assignmentTitle: a.title,
    accessCode: String(accessCode || ''),
    score: result.score,
    total: result.total,
    breakdown: result.breakdown,
  });
  res.json({
    ok: true,
    score: result.score,
    total: result.total,
    breakdown: result.breakdown,
    studentCode: rec.code,
    displayName: rec.displayName,
  });
});

// === 🎯 SIM TRAINER — tiered homework built from the simulations =====
// 2026-09-20 (Fernando): 3 tiers · 8 homeworks = the 8 exam parts,
// mini-tests with the REAL images/audio from all 10 sims. "So when we
// get to the simulations they already have a base."
app.get('/api/homework/trainer/list', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  res.json({
    ok: true,
    tiers: SimTrainer.TIERS.map((t) => ({ tier: t.tier, icon: t.icon, title: t.title, blurb: t.blurb })),
    expLabels: SimTrainer.EXP_LABELS,
    matrix: SimTrainer.matrix(),      // t1..t3 → exp1..exp8 → question count
    sessionSize: SimTrainer.SESSION_SIZE,
    passPct: SimTrainer.PASS_PCT,
  });
});
app.get('/api/homework/trainer/session/:tier/:exp', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  // 🔒 2026-10-15: these are the Old HSK 1 simulations' own pictures and recordings: only for the classes of that level
  // (the portal offers the trainer to them only), as signed links like every sim file
  const trainerLevel = _simLevel(Object.keys(HskSim.SIMULATIONS)[0]);
  if (_hwReqLevel(req, req.query.accessCode) !== trainerLevel) return res.status(403).json({ ok: false, error: 'Este entrenamiento es de otro nivel' });
  const s = SimTrainer.getSession(req.params.tier, req.params.exp);
  if (!s) return res.status(404).json({ ok: false, error: 'entrenamiento no encontrado' });
  res.set('Cache-Control', 'private, no-store');
  res.json({ ok: true, tier: s.tier, exp: s.exp, expLabel: s.expLabel, questions: SimLock.rewrite(s.questions, { kind: 's' }), total: s.total, poolSize: s.poolSize });
});
// Instant per-tap verdict — answers never travel to the client.
app.post('/api/homework/trainer/check', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  // 🔒 2026-10-15: each verdict tells the answer of an Old HSK 1 sim question: that level's classes only, like the session
  if (_hwReqLevel(req, req.body && req.body.accessCode) !== _simLevel(Object.keys(HskSim.SIMULATIONS)[0])) {
    return res.status(403).json({ ok: false, error: 'Este entrenamiento es de otro nivel' });
  }
  const { qid, answer } = req.body || {};
  const v = SimTrainer.check(qid, answer);
  if (!v) return res.status(404).json({ ok: false, error: 'pregunta no encontrada' });
  res.json({ ok: true, correct: v.correct, expected: v.expected });
});
app.post('/api/homework/trainer/submit', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const { studentCode, tier, exp, answers, accessCode } = req.body || {};
  // 🔒 2026-10-18 (security review F6): a trainer grade lands only on the caller's own record (the same proof as every
  // homework write, one answer for an unknown code and «not yours»)
  const rec = _hwKid(req, res, studentCode);
  if (!rec) return;
  const result = SimTrainer.grade(tier, exp, answers);
  if (!result) return res.status(404).json({ ok: false, error: 'entrenamiento no encontrado' });
  const tMeta = SimTrainer.TIERS.find((x) => x.tier === Number(tier));
  // Logged like any tarea → shows in Completadas, report cards, papás.
  Students.logAssignmentSubmission(rec.code, {
    assignmentId: 'trainer-t' + Number(tier) + '-' + String(exp),
    assignmentTitle: '🎯 ' + (tMeta ? tMeta.icon : '') + ' Tier ' + Number(tier) + ' · ' + (SimTrainer.EXP_LABELS[exp] || exp),
    accessCode: String(accessCode || ''),
    score: result.score,
    total: result.total,
    breakdown: [],
  });
  res.json({ ok: true, score: result.score, total: result.total, right: result.right, of: result.of });
});

// === 📖 READING-TEST HOMEWORK INTEGRATION ===========================
// Students can revisit a reading test on their own time. Per user
// feedback 2026-05-27: kids need self-serve access to the test of a
// story the teacher already covered in class. Gating rules:
//   - A test is AVAILABLE to a kid if they have AT LEAST one prior
//     testResult entry for that story (proves they took the live test
//     in class, so they're "registered" for it).
//   - For now, while we bootstrap, we also expose all stories with
//     `unlockedForAll: true` so anyone with an access code can try.
//     Switch UNLOCKED_FOR_ALL → false once teachers start using the
//     in-class flow for registration.
// NOTE: ReadingStory is already required at the top of the file.
// 2026-05-27: user explicitly requested gating: "if the professor didn't
// introduce it to you, it should not appear to you as available test."
// So we LOCK by default — only kids with at least one prior testResult
// for a story see it as available. Teacher introduces it in class (live
// test or just having kids load the page during the lesson) and the kid
// becomes "registered" via the testResult entry.
const READING_UNLOCKED_FOR_ALL = false;

function _hwReadingListFor(code) {
  const rec = Students.get(code);
  const priorAttempts = rec && Array.isArray(rec.testResults) ? rec.testResults : [];
  const bestByStory = {};
  priorAttempts.forEach((t) => {
    if (!bestByStory[t.storyId] || t.score > bestByStory[t.storyId].score) {
      bestByStory[t.storyId] = t;
    }
  });
  return ReadingStory.listStories().map((s) => {
    const story = (ReadingStory.STORIES || {})[s.id];
    const best = bestByStory[s.id];
    const triedInClass = !!best;
    return {
      storyId:   s.id,
      exp:       s.exp || story.exp || null,   // (2026-10-18: its experience, «Mi Dralingo» lists it with it)
      title:     story.title,
      subtitle:  story.subtitle,
      pageCount: story.pages.length,
      coverImage:  ReadingStory.pageImageUrl(story, 1),
      available: triedInClass || READING_UNLOCKED_FOR_ALL,
      triedInClass,
      bestScore: best ? best.score : null,
      attempts:  priorAttempts.filter((t) => t.storyId === s.id).length,
    };
  });
}

// 📚 Public stories list, grouped by HSK1 experience — used by the
// Modo Maestro story picker. Returns every story with its `exp` tag
// so the client can render folders (EXP1 has Pīnpīn, EXP2 has Lǎoshī Dralingo).
app.get('/api/reading/stories', (req, res) => {
  res.json({ ok: true, stories: ReadingStory.listStories() });
});

// 🏆 HSK SIMULATION ENDPOINTS ===========================================
// List available simulations (just metadata).
app.get('/api/hsk-sim/list', (req, res) => {
  res.json({ ok: true, sims: HskSim.listSims().concat(YctSim.listSims()) });
});
// 🖼 Sim-image catalog for the "Describe la imagen" teaching mode in
// Modo Maestro. Scans the HSK simulation folders and returns every
// describable picture grouped by simulation. Admin-gated (teacher
// code). Pass ?maxSim=5 to limit to ready sims; ?refresh=1 to rescan
// after dropping new sim folders without restarting the server.
// Fernando 2026-06-08: "pick from a list of all the pictures we have,
// put it on everyone's screen, then have them describe it together."
app.get('/api/sim-images', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  const maxSim = req.query.maxSim ? parseInt(req.query.maxSim, 10) : 10;  // default: ready sims 1-10
  const refresh = req.query.refresh === '1';
  const cat = SimImages.getCatalog({ maxSim, refresh });
  res.set('Cache-Control', 'private, no-store');
  res.json({ ok: true, groups: SimLock.rewrite(cat.groups, { kind: 't' }), total: cat.total });   // 🔒 signed links (2026-10-15)
});
// 🧠 SENTENCE PRACTICE (teacher-only, WITH answers) — feeds the
// "Práctica de oraciones 31-40" sheet in Modo Maestro. Returns every
// sim's Reading Parts 3 & 4 (question + full A-F bank + answer key)
// grouped by HSK level, so the teacher can analyze each question in
// class: eliminate the wrong options one by one until "nothing else
// makes sense — only the answer". Fernando 2026-07-04.
// ⚠️ Answers included on purpose → MUST stay behind _adminAuth. The
// kid-facing sim payload (buildSimPayload) strips answers; never swap.
app.get('/api/hsk-sim-practice', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  const levels = {};
  Object.keys(HskSim.SIMULATIONS).forEach((id) => {
    const sim = HskSim.SIMULATIONS[id];
    if (!sim || !sim.reading) return;
    const p3 = sim.reading.part3;
    const p4 = sim.reading.part4;
    if (!p3 && !p4) return;  // older sims without R3/R4
    const lvl = sim.level || 'hsk1';
    if (!levels[lvl]) levels[lvl] = [];
    const pick = (p) => p ? {
      title: p.title || '',
      instruction: p.instruction || '',
      bank: (p.bank || []).map((b) => ({ letter: b.letter, hanzi: b.hanzi || '', pinyin: b.pinyin || '' })),
      example: p.example ? { num: p.example.num, hanzi: p.example.hanzi || '', pinyin: p.example.pinyin || '', answer: p.example.answer } : null,
      // es/en = per-sentence meanings (2026-07-07: shown in parentheses
      // under each sentence with an ES↔EN toggle for non-Spanish teachers)
      questions: (p.questions || []).map((q) => ({ num: q.num, hanzi: q.hanzi || '', pinyin: q.pinyin || '', answer: q.answer, es: q.es || '', en: q.en || '' })),
    } : null;
    levels[lvl].push({ id, title: sim.title || id, part3: pick(p3), part4: pick(p4) });
  });
  // 🆕 2026-10-12 — YCT + New HSK sims too: their reading parts with a word bank, in the same part shape
  Object.keys(YctSim.SIMS).forEach((id) => {
    const s = _practiceFromYctSim(YctSim.SIMS[id]);
    if (!s) return;
    if (!levels[s.level]) levels[s.level] = [];
    levels[s.level].push(s.sim);
  });
  // Stable order: sim 1, 2, 3… (ids are 'hsk1-simN')
  Object.keys(levels).forEach((lvl) => {
    levels[lvl].sort((a, b) => {
      const na = parseInt((a.id.match(/sim(\d+)/) || [])[1] || '0', 10);
      const nb = parseInt((b.id.match(/sim(\d+)/) || [])[1] || '0', 10);
      return na - nb;
    });
  });
  // folders for the dashboard: test family → level → sims (same families as Official Tests)
  const FAMILIES = [
    { id: 'yct', name: 'YCT', emoji: '🧒', blurb: 'Exams for kids', test: (l) => /^yct\d/.test(l) },
    { id: 'newhsk', name: 'New HSK', emoji: '🆕', blurb: 'The new HSK', test: (l) => /^newhsk\d/.test(l) },
    { id: 'oldhsk', name: 'Old HSK', emoji: '📘', blurb: 'The classic HSK', test: (l) => /^hsk\d/.test(l) },
  ];
  const levelName = (l) => l.replace(/^yct(\d+)$/, 'YCT $1').replace(/^newhsk(\d+)$/, 'New HSK $1').replace(/^hsk(\d+)$/, 'HSK $1');
  const order = (l) => parseInt((l.match(/\d+/) || ['0'])[0], 10);
  const families = FAMILIES.map((f) => ({
    id: f.id, name: f.name, emoji: f.emoji, blurb: f.blurb,
    levels: Object.keys(levels).filter(f.test).sort((a, b) => order(a) - order(b))
      .map((l) => ({ id: l, name: levelName(l), sims: levels[l] })),
  }));
  const levelNames = {};
  Object.keys(levels).forEach((l) => { levelNames[l] = levelName(l); });
  res.json({ ok: true, levels, levelNames, families });
});
// One YCT / New HSK sim → { level, sim: { id, title, part3, part4 } } in the old-HSK practice shape: its reading
// parts with a word bank (YCT 1: R3 fill-in · New HSK 1: R2 question ↔ reply, R3 fill-in), answers included.
const _PRACTICE_PART_NAMES = {
  read_choose_reply_bank: ['Question ↔ reply', 'Pick the reply from the bank that answers each question.'],
  read_fill_blank_word_bank: ['Fill the blank', 'Pick the word from the bank that completes each sentence.'],
};
function _practiceFromYctSim(sim) {
  if (!sim || !sim.reading || !Array.isArray(sim.reading.parts)) return null;
  const level = String(sim.level || '').toLowerCase();
  const es = _practiceSpanish(level);
  const one = (it) => {
    const lines = Array.isArray(it.dialogue) && it.dialogue.length ? it.dialogue : [it];
    return {
      hanzi: lines.map((l) => l.hanzi || '').join(' — '),
      pinyin: lines.map((l) => l.pinyin || '').join(' — '),
      es: lines.map((l) => es(l.pinyin)).filter(Boolean).join(' — '),
    };
  };
  const parts = sim.reading.parts.filter((p) => Array.isArray(p.bank) && p.bank.length && _PRACTICE_PART_NAMES[p.type])
    .map((p) => {
      const real = p.items.filter((x) => !x.example);
      const nums = real.map((x) => x.num);
      const ex = p.items.find((x) => x.example);
      const [name, instruction] = _PRACTICE_PART_NAMES[p.type];
      return {
        title: `${p.zh || ''} · Reading part ${p.part} (${Math.min(...nums)}–${Math.max(...nums)}) · ${name}`.replace(/^ · /, ''),
        instruction,
        bank: p.bank.map((b) => ({ letter: b.label, hanzi: b.hanzi || '', pinyin: b.pinyin || '' })),
        example: ex ? Object.assign({ num: ex.num, answer: ex.answer }, one(ex)) : null,
        questions: real.map((q) => Object.assign({ num: q.num, answer: q.answer, en: '' }, one(q))),
      };
    });
  if (!parts.length) return null;
  return { level, sim: { id: sim.id, title: sim.title || sim.id, part3: parts[0], part4: parts[1] || null } };
}
// Spanish for a sim sentence by its pinyin: New HSK 1 has its own file (mother file), YCT 1 borrows the game pack's
// exam sentences; '' when unknown (the card just shows no meaning line).
const _practiceEsCache = {};
function _practiceSpanish(level) {
  if (!_practiceEsCache[level]) {
    const map = new Map();
    const pack = Packs.LEVELS.find((l) => l.id === level);
    if (pack) pack.worlds.forEach((w) => w.rounds.forEach((r) => (r.items || []).forEach((it) => {
      if (it.k === 'm' && it.py && it.es) map.set(Packs.plain(it.py), it.es);
    })));
    if (level === 'newhsk1') {
      try { Object.entries(require('./core/packs/newhsk1-es.json')).forEach(([py, s]) => map.set(Packs.plain(py), s)); } catch (_) {}
    }
    _practiceEsCache[level] = map;
  }
  const map = _practiceEsCache[level];
  return (py) => map.get(Packs.plain(py)) || '';
}
// ── 🔒 Who may open a simulation (2026-10-15, La Ruta Dorada phase 1; core/sim-lock.js + core/level-keys.js) ──────
// Until today any PIN of any exam room or just a class access code (1001…) opened every sim, answers on submit
// included. Now one of these, and only for the sims it covers:
//   t · a teacher: the /maestro code in X-Admin-Pw (admin turnstile counts wrong codes), or a remembered teacher device
//   r · a kid in a teacher's exam room: that room's PIN + the room pass, for THAT room's sim, while the room is open
//   s · the logged-in kid (the `dsim` cookie of the /homework login) who may use the sim's level (levelAccess: the
//       level's key on this device or on their account, a teacher's «Desbloquear», or grandfathered): saved on them
//   k · a device with the level's key and nobody logged in: graded, saved only for the kid whose codes the phone proves
//   d · the local test harness (?debug=1&direct=1 on this PC only, SimLock.isLocalDev — never on Render)
// Everyone else gets the level's key screen (core/level-keys.js sendKeyScreen).
// A teacher's exam room behind a PIN, or null once it is closed («Cerrar la sala», host:end) or 6 h old. HSK_ROOMS is
// the authority (written for every exam room, kept on the data disk, so a restart or a deploy never closes one);
// a different live game that happens to reuse the PIN means the old exam room is gone.
// PIN guessing: an exam PIN is 3-4 digits, so a sim page / payload / room lookup with a PIN that never belonged to an
// exam room counts against the caller's IP; 60 such misses in 10 min stop PIN entry from that IP for 10 min (a class
// arrives with the right PIN by the redirect, and a just-closed room's PIN is never a miss).
const _pinMisses = new Map();    // ip → [timestamps]
const _hskClosed = new Map();    // pin → when its exam room closed (kids reloading it are not guessing)
// (req = an HTTP request, or the address string of a socket)
function _pinBlocked(req) {
  const arr = (_pinMisses.get(typeof req === 'string' ? req : _clientIp(req)) || []).filter((t) => Date.now() - t < 10 * 60 * 1000);
  return arr.length >= 60;
}
function _pinMiss(req, pin) {
  const now = Date.now();
  const closed = _hskClosed.get(String(pin));
  if (closed && now - closed < 6 * 60 * 60 * 1000) return;
  const ip = typeof req === 'string' ? req : _clientIp(req);
  const arr = (_pinMisses.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  arr.push(now);
  _pinMisses.set(ip, arr);
  if (arr.length === 60) console.warn('[security] exam PIN guessing ip=' + ip + ' → PIN entry paused 10 min');
  if (_pinMisses.size > 5000) for (const [k, v] of _pinMisses) if (!v.length || now - v[v.length - 1] > 10 * 60 * 1000) _pinMisses.delete(k);
}
function _hskRoomFor(pin) {
  pin = String(pin || '').trim();
  if (!/^\d{3,5}$/.test(pin)) return null;
  const r = HSK_ROOMS.get(pin);
  if (!r || Date.now() - (r.createdAt || 0) > 6 * 60 * 60 * 1000) return null;
  const g = games[pin];
  if (g && (g.gameType !== 'hsksim' || !g.hsk || g.hsk.simId !== r.simId)) return null;
  return { pin, simId: r.simId, createdAt: r.createdAt || 0 };
}
const _simLevel = (simId) => { const m = _simMeta(simId); return m ? Levels.normalize(m.level) : null; };
const _simsOfLevel = (level) => HskSim.listSims().concat(YctSim.listSims()).filter((s) => Levels.normalize(s.level) === level).map((s) => s.id);
// 🔒 2026-10-18 (his decision: "the golden simulations should be just for me because I will manually put simulations to
// kids"; the PIN keeps the parent communication strong): EL SIMULACRO DORADO IS THE TEACHER'S. A kid takes a simulation
// only in a teacher's PIN room; once El Entrenamiento is done, La Ruta Dorada's card 3 tells the family to let the teacher
// know (WhatsApp). The code that let a kid take a simulation ALONE from La Ruta Dorada (the earned Dorado, the session or
// key-only phone's grade, the sims' player links on the route) is KEPT, switched off by this ONE flag. OFF:
//   · _simGrant: a kid or a key-only phone on their own → 403 «tu profe lo abre en clase» (rooms, teachers: as always)
//   · _simPageGate: a sim's link → the level's route, card 3 (?dorado=clase#paso-3); the key screen without the key
//   · /api/ruta-dorada: the sims are still listed (their chips, best %, taken books) but with no player link for a kid
//   · /api/golden: a book not taken says why: 'clase' (no player link); a taken one opens as before (taken anywhere)
// Switching it back on is his call alone: env DRALY_DORADO_SELF_SERVE=1 (no code change; the tests use it to keep the
// kept code honest).
const DORADO_SELF_SERVE = process.env.DRALY_DORADO_SELF_SERVE === '1';
const DORADO_CLASS_MSG = 'El Simulacro Dorado lo abre tu profe en clase, con un PIN. Cuando termines El Entrenamiento, avísale.';
// → { grant } or { status, error }. countMiss: a PIN that opens nothing counts as a guess (the payload, not the submit).
function _simGrant(req, simId, countMiss) {
  const level = _simLevel(simId);
  if (!level) return { status: 404, error: 'unknown sim' };
  const h = req.headers || {};
  const t = _teacherOf(req);
  if ((h['x-admin-pw'] || h['x-admin-password']) && t && !t.device) return { grant: { kind: 't' } };
  // a room first: whoever plays in a teacher's room plays as a kid (their grade is saved like everyone's). It takes the
  // room pass that joining the room gave the phone (player:join, so they are on the teacher's roster), not a bare PIN.
  const pin = String((req.query && req.query.pin) || (req.body && req.body.pin) || '').trim();
  const pass = String((req.query && req.query.pass) || (req.body && req.body.pass) || '');
  const room = pin ? _hskRoomFor(pin) : null;
  if (room && room.simId === simId && SimLock.roomPassOk(pass, room.pin, simId, room.createdAt)) return { grant: { kind: 'r', pin: room.pin } };
  if (pin && !room && countMiss) _pinMiss(req, pin);
  const a = levelAccess(req, level);     // a teacher device · the logged-in kid's account · this device's key
  if (a.ok && a.via === 'teacher') return { grant: { kind: 't' } };
  if (a.ok && !DORADO_SELF_SERVE) return { status: 403, level, teacher: true, error: DORADO_CLASS_MSG };   // 🔒 2026-10-18 (above)
  // 🏆 phase 4 (2026-10-16): a kid on their own (no teacher's room) also needs El Simulacro Dorado open: once El
  // Entrenamiento is live it is earned (every world practised with doradoPct %, a teacher's «Desbloquear», or a sim
  // taken before the launch), and only on an account (a key-only phone can't earn it). Rooms and teachers: as before.
  if (a.ok && !RutaProgress.doradoOpen(a, a.studentCode ? Students.get(a.studentCode) : null, level)) {
    return { status: 403, level, dorado: true, error: 'El Simulacro Dorado de ' + Levels.info(level).name + ' se abre cuando practiques cada mundo de El Entrenamiento.' };
  }
  if (a.ok && a.studentCode) return { grant: { kind: 's', studentCode: a.studentCode } };
  if (a.ok) return { grant: { kind: 'k' } };
  if (req.query && req.query.debug === '1' && req.query.direct === '1' && SimLock.isLocalDev(req)) return { grant: { kind: 'd' } };
  return { status: 401, level, error: pin ? 'Esta sala ya cerró. Pídele a tu maestra el PIN nuevo.'
    : 'Escribe la clave de ' + Levels.info(level).name + ' para abrir este simulacro.' };
}
// GET /yct-sim.html · /hsk-sim.html — the player, or the level's key screen (never a raw 401 text)
function _simPageGate(req, res) {
  const page = /yct-sim/i.test(req.path) ? 'yct-sim.html' : 'hsk-sim.html';
  const q = req.query || {};
  if (q.debug === '1' && q.direct === '1' && SimLock.isLocalDev(req)) return SimLock.sendPage(res, page);
  const pin = String(q.pin || '').trim();
  if (pin) {
    // the page itself holds no exam (the sim loads only with the room pass): a live room's PIN always opens it, so a
    // whole class behind one address is never locked out; a PIN that opens nothing counts as a guess
    if (_hskRoomFor(pin)) return SimLock.sendPage(res, page);
    _pinMiss(req, pin);
    return LevelKeys.sendKeyScreen(res, { reason: 'room', what: 'sim' });
  }
  // a teacher's forced link (/maestro «Forzar», ?access=…&sim=…): the page with its PIN box (it holds no exam; the sim
  // loads only with the room pass or the level's key), so a kid without the key still joins the teacher's room
  if ('access' in q) return SimLock.sendPage(res, page);
  // one sim by its link (no room): whoever may use its level; else that level's key screen
  const sim = String(q.sim || '').trim();
  const level = sim ? _simLevel(sim) : null;
  if (level) {
    const a = levelAccess(req, level);
    if (!a.ok) return LevelKeys.sendKeyScreen(res, { level, what: 'sim' });
    // 🔒 2026-10-18: the teacher opens it in class (DORADO_SELF_SERVE off) → the route's card 3 says so
    if (!DORADO_SELF_SERVE && a.via !== 'teacher') {
      res.set('Cache-Control', 'private, no-store');
      return res.redirect(302, '/audios/' + (Levels.info(level).pack || level) + '?dorado=clase#paso-3');
    }
    // 🏆 phase 4: the key is there but El Simulacro Dorado is not earned yet → the level's route, whose step 3 says
    // how it opens («Se abre cuando practiques cada mundo con 70 %») and shows the kid's progress
    if (!RutaProgress.doradoOpen(a, a.studentCode ? Students.get(a.studentCode) : null, level)) {
      res.set('Cache-Control', 'private, no-store');
      return res.redirect(302, '/audios/' + (Levels.info(level).pack || level) + '?dorado=cerrado#paso-3');
    }
    return SimLock.sendPage(res, page);
  }
  // the bare page (its PIN box): a teacher, or anyone with a level open; else the «PIN de tu maestra» card
  if (_teacherOf(req) || Levels.LEVELS.some((l) => levelAccess(req, l.id).ok)) return SimLock.sendPage(res, page);
  return LevelKeys.sendKeyScreen(res, { reason: 'pin', what: 'sim' });
}
// GET /sim-media/<token>/<file> — a recording or picture, only with a valid link of ITS sim, never cached by anyone.
function _simMediaFile(req, res) {
  res.set(SimLock.NO_STORE);
  res.set('Cross-Origin-Resource-Policy', 'same-origin');
  const m = SimLock.openMedia(req.params.token, req.params.file);
  if (!m.file) return res.status(m.status || 403).type('text').send(m.status === 404 ? 'Not found' : 'Forbidden');
  const alive = m.kind === 'r' ? !!(_hskRoomFor(m.pin) && _hskRoomFor(m.pin).simId === m.sim)
    : m.kind === 'w' ? !!(games[m.pin] && games[m.pin].gameType === 'warmup' && games[m.pin].state !== 'ended')
    : m.kind === 'd' ? SimLock.isLocalDev(req)
    : m.kind === 's' || m.kind === 't' || m.kind === 'k';
  if (!alive) return res.status(403).type('text').send('Forbidden');
  res.type(m.type);
  res.sendFile(m.file.abs, { cacheControl: false, lastModified: false }, (err) => {   // Range requests for the audio
    if (err && !res.headersSent) res.status(err.statusCode || 404).end();
  });
}
// The session for this phone from codes it already has (the key screen calls this, silently, before showing its
// form): a student's access code + student code (an existing account only, never a new one, never re-tagged) — the
// kid's level opens on this device when their account has it open (grandfathered, key saved, teacher) —, or a
// teacher's code in X-Admin-Pw (remembers the device as a teacher's). Wrong codes count in a turnstile like the admin
// one (a class shares one IP: 30 fails / 10 min). /api/sim-access/session is the address the lock branch used.
const _simSessFails = new Map();
function _accessSession(req, res) {
  res.set('Cache-Control', 'no-store');
  const ip = _clientIp(req);
  const now = Date.now();
  const fails = (_simSessFails.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (fails.length >= 30) return res.status(429).json({ ok: false, error: 'demasiados intentos, espera unos minutos' });
  const fail = (status, error) => {
    fails.push(now);
    _simSessFails.set(ip, fails);
    if (_simSessFails.size > 5000) _simSessFails.clear();
    return res.status(status).json({ ok: false, error });
  };
  const h = req.headers || {};
  if (h['x-admin-pw'] || h['x-admin-password']) {
    const s = _adminAuth(req, res);   // writes its own 401 / 429
    if (!s) return;
    LevelKeys.rememberTeacher(req, res, s);
    return res.json({ ok: true, kind: 'teacher' });
  }
  const { accessCode, studentCode } = req.body || {};
  if (!Assignments.isAccessCodeValid(accessCode)) return fail(401, 'Código de acceso incorrecto');
  const rec = studentCode ? Students.get(String(studentCode).trim().toUpperCase()) : null;
  if (!rec) return fail(401, 'No encontramos ese código de estudiante');
  // only a kid already tagged with this classroom code (an untagged old account logs in once at /homework, which tags it)
  if (!rec.classroomCode || !_hwOwnsStudent(req, rec)) return fail(403, 'no autorizado');
  const level = LevelKeys.classLevel(rec);
  SimLock.setSession(req, res, 's', rec.code, level);
  _autoAfterLogin(req, res, rec, true);   // 🆕 2026-10-18: this kid on a device holding an automatic account (claim / park)
  const open = _openLevelOnDevice(req, res, rec, level);
  res.json({ ok: true, kind: 'student', level, levelName: Levels.info(level).name, open, sims: _simsOfLevel(level) });
}
app.post(['/api/level-access/session', '/api/sim-access/session'], _accessSession);
// A logged-in kid (their own class code): a grandfathered level is stamped on the account (it stays theirs if they
// move up later), the key this device already typed is saved on the account (any device from now on), and a level
// open on the account opens on this device (a year). → is the level open for this kid on this device?
function _openLevelOnDevice(req, res, rec, level) {
  if (!rec || !level) return false;
  if (LevelKeys.goLiveAt() && LevelKeys.recordOpenVia(rec, level) === 'grandfathered') Students.setLevelAccess(rec.code, level, 'grandfathered');
  const onDevice = LevelKeys.deviceOpen(req, level);
  if (onDevice) Students.setLevelAccess(rec.code, level, 'key', LevelKeys.genOf(level));
  const open = !!LevelKeys.recordOpenVia(rec, level);
  if (open && !onDevice) LevelKeys.rememberDevice(req, res, level);
  return open || onDevice;
}
// ── 🔑 The key screen's «Entrar»: POST { level, key } (core/level-keys.js) ─────────────────────────────────────────
// Right key → this device keeps the level a year (and the logged-in kid's account keeps it on every device). Wrong →
// a kind message; 5 wrong per device / 30 per address in 15 min → a wait. Never logged, never echoed.
app.post('/api/level-key', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const level = Levels.normalize((req.body || {}).level);
  if (!level) return res.status(400).json({ ok: false, error: 'Ese nivel no existe.' });
  const name = Levels.info(level).name;
  const ip = _clientIp(req);
  const dev = LevelKeys.deviceId(req, res);
  const wait = LevelKeys.guessWait(ip, dev);
  if (wait) {
    return res.status(429).json({ ok: false, wait, error: 'Ya fueron muchos intentos. Espera ' + wait + (wait === 1 ? ' minuto' : ' minutos') +
      ' y vuelve a intentarlo con la clave del mensaje de tu maestra.' });
  }
  const typed = String((req.body || {}).key || '').slice(0, 80);
  if (!LevelKeys.normalizeKey(typed)) return res.status(400).json({ ok: false, error: 'Escribe la clave.' });
  if (!LevelKeys.list().some((l) => l.id === level && l.key)) {
    return res.status(401).json({ ok: false, error: name + ' todavía no tiene clave. Tu maestra te la enviará muy pronto.' });
  }
  if (!LevelKeys.keyFits(level, typed)) {
    const other = LevelKeys.levelOfKey(typed);
    if (other) return res.status(401).json({ ok: false, otherLevel: other, error: 'Esa clave es de ' + Levels.info(other).name + '. Aquí va la clave de ' + name + '.' });
    LevelKeys.noteWrong(ip, dev);
    return res.status(401).json({ ok: false, error: 'Esa clave no es. Revísala en el mensaje de tu maestra.' });
  }
  LevelKeys.clearDevice(dev);
  LevelKeys.rememberDevice(req, res, level);
  const stu = _studentOf(req);                        // logged in at /homework → saved on the account too
  if (stu) Students.setLevelAccess(stu.code, level, 'key', LevelKeys.genOf(level));
  res.json({ ok: true, level, levelName: name, saved: !!stu });
});
// Which levels this device may use (the /audios library draws its locks with it): { levels: { yct1: true, … } }
app.get('/api/level-access', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  res.json({ ok: true, levels: LevelKeys.accessMap(req), teacher: !!_teacherOf(req) });
});

// Fetch a simulation's payload (answers stripped by the engine), its media as signed /sim-media/ links, plus a
// submit ticket (a kid can still hand in after the room closed).
// ⚠️ ROUTE COLLISION GUARD — this is a wildcard `:simId` route, so it
// matches ANY single-segment URL after /api/hsk-sim/. That means a path
// like /api/hsk-sim/results would shadow the more-specific results
// endpoint registered later. We reject reserved-word simIds here so
// Express can fall through to the right handler — fixes the "unexpected
// top type is not valid JSON" the user saw on the Resultados HSK panel.
const HSK_RESERVED_PATHS = new Set(['results', 'sessions', 'heartbeat', 'list', 'room']);
app.get('/api/hsk-sim/:simId', (req, res, next) => {
  if (HSK_RESERVED_PATHS.has(req.params.simId)) return next();
  res.set('Cache-Control', 'private, no-store');
  const simId = String(req.params.simId);
  const g = _simGrant(req, simId, true);
  if (!g.grant) return res.status(g.status).json({ ok: false, locked: g.status !== 404, error: g.error });
  const payload = _simPayload(simId);
  if (!payload) return res.status(404).json({ ok: false, error: 'unknown sim' });
  const sim = SimLock.rewrite(payload, g.grant);
  sim.ticket = SimLock.ticket(g.grant, simId);
  res.json({ ok: true, sim });
});
// Submit answers, grade them, persist to student record.
app.post('/api/hsk-sim/:simId/submit', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const simId = String(req.params.simId);
  const g = _simGrant(req, simId);
  const grant = g.grant || SimLock.ticketGrant(req.body && req.body.ticket, simId);
  if (!grant) return res.status(g.status || 401).json({ ok: false, locked: true, error: g.error });
  // a teacher trying a sim: graded, never saved on a student's record
  if (grant.kind === 't') {
    const r0 = _simGrade(simId, (req.body && req.body.answers) || {});
    return r0 ? res.json({ ok: true, result: r0, saved: false }) : res.status(404).json({ ok: false, error: 'unknown sim' });
  }
  const { answers, displayName } = req.body || {};
  // a logged-in student on their own (no room) saves on their own record, whatever the page sent (their session, or
  // the code inside their ticket)
  let studentCode = grant.kind === 's' && grant.studentCode ? grant.studentCode : (req.body || {}).studentCode;
  if (grant.kind === 's' && !grant.studentCode) return res.status(401).json({ ok: false, locked: true, error: 'Vuelve a entrar con tu código.' });
  // 🔑 'k' (2026-10-15): a device with the level's key and nobody logged in. The grade lands on a record only when the
  // phone proves whose it is like homework does (the kid's class code + student code, an existing tagged account);
  // otherwise it is graded and not saved (never on a classmate's record by a typed code).
  if (grant.kind === 'k') {
    const b = req.body || {};
    const r = b.studentCode ? Students.get(String(b.studentCode).trim().toUpperCase()) : null;
    if (r && r.classroomCode && Assignments.isAccessCodeValid(b.accessCode) && _hwOwnsStudent(req, r)) studentCode = r.code;
    else {
      const rg = _simGrade(simId, answers || {});
      return rg ? res.json({ ok: true, result: rg, saved: false, guest: true }) : res.status(404).json({ ok: false, error: 'unknown sim' });
    }
  }
  // 🆕 Same guest-provisioning + name recovery as heartbeat. Without
  // this, the kid's exam result would land under code-as-name instead
  // of their actual chosen name. Match the heartbeat logic exactly.
  const pin = String(req.query.pin || (req.body && req.body.pin) || '').trim();
  const g0 = pin ? _hskGameLookup(pin) : null;
  const classroomFromRoom = (g0 && g0.hsk && g0.hsk.classroomCode) || null;
  let nameFromSocket = '';
  if (g0 && g0.players) {
    for (const p of Object.values(g0.players)) {
      if ((p.studentCode && p.studentCode === studentCode) || (p.name && p.name.toLowerCase() === String(studentCode || '').toLowerCase())) {
        nameFromSocket = p.name; break;
      }
    }
  }
  const resolvedName = (displayName && String(displayName).trim()) || nameFromSocket || studentCode;
  // 🔒 2026-10-18 (ownership): the result still lands on the typed code in the teacher's room, but an EXISTING account is
  // renamed only by its own phone (the same proof as homework)
  const known0 = studentCode ? Students.peek(studentCode) : null;
  const nameOk = !known0 || _hwOwnsStudent(req, known0.rec);
  const rec = Students.getOrProvisionForPin(studentCode, nameOk ? resolvedName : null, classroomFromRoom);
  if (!rec) return res.status(400).json({ ok: false, error: 'no se pudo crear el registro de estudiante' });
  // Retroactive upgrade — same as heartbeat.
  if (nameOk && resolvedName && rec.displayName === rec.code && resolvedName !== rec.code) {
    rec.displayName = String(resolvedName).slice(0, 24);
  }
  const result = _simGrade(req.params.simId, answers || {});
  if (!result) return res.status(404).json({ ok: false, error: 'unknown sim' });
  // Persist into student.hskResults so the Cuaderno can show it later.
  // 🆕 2026-06-04 (Fernando): we now ALSO save the per-question
  // breakdown so the teacher can drill into "which questions did
  // this kid get wrong?" From his message: "the data speaks for
  // itself, right? A lot of data really tells us patterns. What
  // should we improve in that classroom?" Only `wrong` items are
  // stored to keep the JSON file small — most kids will get most
  // questions right so the correct ones add 5-10× the bytes for
  // zero analytical value. The full count is in `total` already.
  if (!Array.isArray(rec.hskResults)) rec.hskResults = [];
  const wrongQs = (Array.isArray(result.breakdown) ? result.breakdown : [])
    .filter((b) => !b.correct)
    .map((b) => ({ qid: b.qid, expected: b.expected, given: b.given }));
  rec.hskResults.push({
    simId: req.params.simId,
    score: result.score,
    total: result.total,
    percent: result.percent,
    wrongQs,                                // [{qid:'L1-1', expected:false, given:true}, ...]
    // 📖 2026-10-16 (El libro dorado): the questions really answered, as the grader saw them (not the keys a phone
    // sent), out of how many: a simulation's golden book opens only after a real try (core/golden.js `real`)
    answeredCount: Array.isArray(result.breakdown) ? result.breakdown.filter((b) => b.given != null && b.given !== '').length : Object.keys(answers || {}).length,
    questions: Array.isArray(result.breakdown) ? result.breakdown.length : undefined,
    ts: Date.now(),
  });
  try { Students._save && Students._save(); } catch (_) {}
  res.json({ ok: true, result });
});

// 🔍 Shared wrong-question enrichment — turns a stored {qid, expected,
// given} into everything a review screen needs. Fernando 2026-07-05:
// "disregard what part it was — just 'pregunta 15'. And give them more
// context: what the narrator said, what they chose — not just letters."
//   - qNum + partLabel (partLabel kept for the teacher view)
//   - questionLabel/questionHanzi: the word / sentence of the question
//   - audioUrl: the ACTUAL narrator clip (kid can replay it — better
//     than a transcript, and most audioText fields are empty anyway)
//   - image: the question's own image (L1/R1)
//   - givenLabel/expectedLabel: content, not bare letters — "B · zuò
//     fēijī" (L4 options), "B · shì de (是的)" (R3/R4 bank)
//   - givenImage/expectedImage: the tapped vs correct PICTURE for the
//     image parts (L2 options, L3/R2 gallery)
// Also fixes a real gap: R3/R4 were missing from the old inline maps,
// so mistakes there showed raw "R3-33" with no text at all.
function _enrichHskWrongQs(sim, wrongQs) {
  const partLabels = {
    L1: 'Parte 1 (audio)', L2: 'Parte 2 (audio)',
    L3: 'Parte 3 (audio)', L4: 'Parte 4 (audio)',
    R1: 'Lectura 1', R2: 'Lectura 2', R3: 'Lectura 3', R4: 'Lectura 4',
  };
  const fmtBool = (v) => (v === true || v === 'true') ? 'Verdadero (✓)'
                       : (v === false || v === 'false') ? 'Falso (✕)'
                       : String(v == null || v === '' ? '(sin responder)' : v);
  return (wrongQs || []).map((wq) => {
    const out = Object.assign({}, wq);
    out.givenLabel = fmtBool(wq.given);
    out.expectedLabel = fmtBool(wq.expected);
    if (!sim) return out;
    if (sim.reading && Array.isArray(sim.reading.parts)) return _enrichYctWrongQ(sim, wq, out);   // YCT / New HSK
    const [part, numStr] = String(wq.qid).split('-');
    const num = parseInt(numStr, 10);
    out.partLabel = partLabels[part] || part;
    out.qNum = num;
    const parts = {
      L1: sim.listening && sim.listening.part1,
      L2: sim.listening && sim.listening.part2,
      L3: sim.listening && sim.listening.part3,
      L4: sim.listening && sim.listening.part4,
      R1: sim.reading && sim.reading.part1,
      R2: sim.reading && sim.reading.part2,
      R3: sim.reading && sim.reading.part3,
      R4: sim.reading && sim.reading.part4,
    };
    const p = parts[part];
    const q = p && Array.isArray(p.questions) ? p.questions.find((x) => x.num === num) : null;
    if (!q) return out;
    // Question text + media
    if (q.word) out.questionLabel = q.word;                 // R1 vocab word
    else if (q.pinyin) out.questionLabel = q.pinyin;        // R2/R3/R4 sentence
    else if (q.audioText) out.questionLabel = q.audioText;  // listening transcript when we have it
    if (q.hanzi) out.questionHanzi = q.hanzi;
    if (q.audioUrl) out.audioUrl = q.audioUrl;              // replay the narrator
    if (q.image) out.image = q.image;                       // L1/R1 picture
    // Letter answers → resolve to CONTENT (text or picture)
    const resolveLetter = (letter) => {
      if (letter == null || letter === '' || typeof letter === 'boolean') return null;
      const L = String(letter);
      if (Array.isArray(q.options)) {                       // L2 (images) / L4 (texts)
        const o = q.options.find((x) => x.letter === L);
        if (o) return { text: o.text || null, image: o.image || null };
      }
      if (Array.isArray(p.gallery)) {                       // L3 / R2 picture galleries
        const g = p.gallery.find((x) => x.letter === L);
        if (g) return { text: null, image: g.image || null };
      }
      if (Array.isArray(p.bank)) {                          // R3/R4 word banks
        const b = p.bank.find((x) => x.letter === L);
        if (b) return { text: (b.pinyin || '') + (b.hanzi ? ' (' + b.hanzi + ')' : ''), image: null };
      }
      return null;
    };
    const gv = resolveLetter(wq.given);
    const ev = resolveLetter(wq.expected);
    if (gv) {
      if (gv.text) out.givenLabel = wq.given + ' · ' + gv.text;
      if (gv.image) out.givenImage = gv.image;
    }
    if (ev) {
      if (ev.text) out.expectedLabel = wq.expected + ' · ' + ev.text;
      if (ev.image) out.expectedImage = ev.image;
    }
    return out;
  });
}

// 🆕 2026-10-12 — the same enrichment for a YCT / New HSK sim (core/yct/*.json: listening.parts / reading.parts with
// items keyed by qid 'L1-3' / 'R3-31'), so «Mis exámenes» and the Cuaderno show the question, not bare letters.
function _enrichYctWrongQ(sim, wq, out) {
  const sec = String(wq.qid || '')[0] === 'L' ? 'listening' : 'reading';
  const part = ((sim[sec] && sim[sec].parts) || []).find((p) => (p.items || []).some((x) => x.qid === wq.qid));
  const it = part && part.items.find((x) => x.qid === wq.qid);
  if (!it) return out;
  out.partLabel = (sec === 'listening' ? 'Escucha' : 'Lectura') + ' · Parte ' + part.part;
  out.qNum = it.num;
  const lines = Array.isArray(it.dialogue) ? it.dialogue : null;
  const zp = (o) => o ? { py: o.pinyin || '', hz: o.hanzi || '' } : null;
  const shown = it.word ? zp(it.word)
    : lines ? { py: lines.map((l) => l.pinyin).join(' — '), hz: lines.map((l) => l.hanzi).join(' — ') }
    : it.passage ? { py: [it.passage.pinyin, it.question && it.question.pinyin].filter(Boolean).join(' — '),
                     hz: [it.passage.hanzi, it.question && it.question.hanzi].filter(Boolean).join(' — ') }
    : it.pinyin ? zp(it)
    : it.transcript ? zp(it.transcript) : null;      // listening: what the audio said (review happens after the exam)
  if (shown && shown.py) out.questionLabel = shown.py;
  if (shown && shown.hz) out.questionHanzi = shown.hz;
  if (it.image) out.image = it.image;
  const resolve = (letter) => {
    if (letter == null || letter === '' || typeof letter === 'boolean') return null;
    const L = String(letter);
    const pools = [it.options, part.gallery, part.bank];
    for (const pool of pools) {
      const o = Array.isArray(pool) && pool.find((x) => x.label === L);
      if (o) return { text: o.pinyin ? o.pinyin + (o.hanzi ? ' (' + o.hanzi + ')' : '') : null, image: o.image || null };
    }
    return null;
  };
  const gv = resolve(wq.given);
  const ev = resolve(wq.expected);
  if (gv) { if (gv.text) out.givenLabel = wq.given + ' · ' + gv.text; if (gv.image) out.givenImage = gv.image; }
  if (ev) { if (ev.text) out.expectedLabel = wq.expected + ' · ' + ev.text; if (ev.image) out.expectedImage = ev.image; }
  return out;
}

// 🔍 Per-attempt drill-down — returns the wrong-question list for ONE
// recorded attempt (identified by ts). Used by the maestro Cuaderno
// "Ver errores" expander.
// (Fernando 2026-06-04: "either in my maestro mode and in their maestro
// mode, and maybe even you can also run the same data through analytics".)
app.get('/api/admin/student/:code/hsk-attempt', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  const rec = Students.get(req.params.code);
  if (!rec) return res.status(404).json({ ok: false, error: 'student not found' });
  if (!_canSessionTouchStudent(session, rec)) {
    return res.status(403).json({ ok: false, error: 'not in your classroom' });
  }
  const ts = parseInt(req.query.ts, 10);
  if (!ts) return res.status(400).json({ ok: false, error: 'ts required' });
  const attempt = (rec.hskResults || []).find((r) => r.ts === ts);
  if (!attempt) return res.status(404).json({ ok: false, error: 'attempt not found' });
  // Re-attach question text/media via the shared enrichment helper so
  // the teacher sees content, not bare letters (and R3/R4 resolve too).
  const sim = _simMeta(attempt.simId);   // old HSK or YCT / New HSK (2026-10-12)
  const wrongQs = SimLock.rewrite(_enrichHskWrongQs(sim, attempt.wrongQs), { kind: 't' });   // 🔒 signed links
  res.set('Cache-Control', 'private, no-store');
  res.json({
    ok: true,
    code: rec.code,
    displayName: rec.displayName,
    simId: attempt.simId,
    simTitle: (sim && sim.title) || attempt.simId,
    score: attempt.score,
    total: attempt.total,
    percent: attempt.percent,
    ts: attempt.ts,
    wrongQs,
    wrongCount: wrongQs.length,
  });
});

// 👶 KID-FACING — list THIS student's HSK attempts so they can review
// their own records. Same data as the parent view's section but
// callable from the kid's homework portal screen. Auth: access code
// (not admin). Returns wrongQs counts but NOT the wrong-question
// detail (use my-hsk-attempt below for that).
app.get('/api/homework/my-hsk-attempts/:code', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const rec = _hwKid(req, res, req.params.code);   // 🔒 2026-10-18 (ownership; F6: one answer, no restore on a probe)
  if (!rec) return;
  const rows = (Array.isArray(rec.hskResults) ? rec.hskResults : [])
    .slice()
    .sort((a, b) => (b.ts || 0) - (a.ts || 0))
    .map((r) => {
      const sim = _simMeta(r.simId);
      return {
        simId: r.simId,
        title: (sim && sim.title) || r.simId,
        score: r.score,
        total: r.total,
        percent: r.percent,
        wrongCount: Array.isArray(r.wrongQs) ? r.wrongQs.length : 0,
        hasBreakdown: Array.isArray(r.wrongQs),    // false for pre-2026-06-04 attempts
        ts: r.ts,
      };
    });
  res.json({ ok: true, attempts: rows });
});

// 👶 KID-FACING — wrong-question detail for ONE of THIS student's
// attempts. Same enrichment as the admin endpoint (question labels
// pulled from the sim catalog so the kid sees "Lectura 1, pregunta 22
// · yīshēng" not just "R1-22").
app.get('/api/homework/my-hsk-attempt/:code', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  // 🔒 2026-10-15: the exam's pictures and recordings come with it, so only from the kid's own classroom code
  const rec = _hwKid(req, res, req.params.code);   // 🔒 2026-10-18 (ownership; F6: one answer, no restore on a probe)
  if (!rec) return;
  const ts = parseInt(req.query.ts, 10);
  if (!ts) return res.status(400).json({ ok: false, error: 'ts required' });
  const attempt = (rec.hskResults || []).find((r) => r.ts === ts);
  if (!attempt) return res.status(404).json({ ok: false, error: 'attempt not found' });
  const sim = _simMeta(attempt.simId);   // old HSK or YCT / New HSK (2026-10-12)
  // Shared enrichment (see _enrichHskWrongQs): question text + hanzi,
  // narrator audio replay URL, question/option images, and content-rich
  // "elegiste vs correcta" labels — R3/R4 included. Its media as signed links (🔒 2026-10-15): the kid took this exam.
  const wrongQs = SimLock.rewrite(_enrichHskWrongQs(sim, attempt.wrongQs), { kind: 's' });
  res.set('Cache-Control', 'private, no-store');
  res.json({
    ok: true,
    simId: attempt.simId,
    simTitle: (sim && sim.title) || attempt.simId,
    score: attempt.score,
    total: attempt.total,
    percent: attempt.percent,
    ts: attempt.ts,
    wrongQs,
    wrongCount: wrongQs.length,
    hasBreakdown: Array.isArray(attempt.wrongQs),
  });
});

// 📊 Classroom mistake heatmap — aggregates wrong-answer counts across
// ALL students the caller can touch. Output: per-question hit counts
// + per-part totals so the teacher sees "L2-7 was wrong for 8/12 kids"
// at a glance. Stub for now — wire into a UI in a later session
// (queued analytics item #6 in TODO-QUEUED.md).
app.get('/api/admin/hsk-mistakes/heatmap', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  const simId = req.query.simId || null;
  const all = (typeof Students.listAll === 'function') ? Students.listAll() : [];
  const ownCodes = session.teacher ? new Set(session.teacher.accessCodes || []) : null;
  const wrongCounts = {};   // qid → { wrong, attempted }
  let attempts = 0;
  for (const summary of all) {
    const rec = Students.get(summary.code);
    if (!rec || !Array.isArray(rec.hskResults)) continue;
    if (ownCodes && rec.accessCode && !ownCodes.has(rec.accessCode)) continue;
    rec.hskResults.forEach((r) => {
      if (simId && r.simId !== simId) return;
      attempts++;
      const wrongSet = new Set((r.wrongQs || []).map((w) => w.qid));
      // For every question in the sim, increment "attempted"; if it was
      // wrong for this kid, also increment "wrong". This requires the
      // sim catalog to enumerate all qids.
      const sim = (HskSim.SIMULATIONS || {})[r.simId];
      if (!sim) return;
      const enumerate = (prefix, qs) => {
        (qs || []).forEach((q) => {
          const key = prefix + '-' + q.num;
          if (!wrongCounts[key]) wrongCounts[key] = { qid: key, simId: r.simId, wrong: 0, attempted: 0 };
          wrongCounts[key].attempted++;
          if (wrongSet.has(key)) wrongCounts[key].wrong++;
        });
      };
      enumerate('L1', sim.listening && sim.listening.part1 && sim.listening.part1.questions);
      enumerate('L2', sim.listening && sim.listening.part2 && sim.listening.part2.questions);
      enumerate('L3', sim.listening && sim.listening.part3 && sim.listening.part3.questions);
      enumerate('L4', sim.listening && sim.listening.part4 && sim.listening.part4.questions);
      enumerate('R1', sim.reading && sim.reading.part1 && sim.reading.part1.questions);
      enumerate('R2', sim.reading && sim.reading.part2 && sim.reading.part2.questions);
    });
  }
  const rows = Object.values(wrongCounts)
    .map((c) => Object.assign({}, c, { wrongPct: c.attempted ? Math.round((c.wrong / c.attempted) * 100) : 0 }))
    .sort((a, b) => b.wrongPct - a.wrongPct);
  res.json({ ok: true, attempts, rows });
});

// 🏆 HSK live sessions — teacher's live-monitor heartbeat protocol.
// The student-side runner pings every ~8s with { simId, accessCode,
// studentCode, cursor, total, answered, status }. The teacher polls
// /sessions every ~5s to render who's currently inside, where they
// are, and who's stale (no ping > 30s = probably aborted/closed tab).
const HSK_SESSIONS = new Map();   // key: pin|studentCode
function _hskSessionKey(pin, sc) {
  return String(pin) + '|' + String(sc);
}

// 🎯 PIN-based ROOM model — mirrors the reading-lecture UX. The teacher
// opens /host-hsk.html, the page creates a room, gets back a 4-digit
// PIN, displays it big. Kids type the PIN in /hsk-sim.html (or land
// there via force-impose) and join. Late joiners simply enter the PIN
// any time the room is open — they start from question 1 on their own
// device while everyone else continues where they are.
//
// IMPORTANT: rooms are PERSISTED to data/hsk-rooms.json so a Render
// dyno restart (or new deploy) doesn't wipe the PIN — otherwise the
// teacher creates a PIN, the server restarts, and kids see "no room
// with this PIN" forever. This is exactly the bug reported 2026-06-03.
const HSK_ROOMS_FILE = path.join(process.env.DRALY_DATA_DIR || path.join(__dirname, 'data'), 'hsk-rooms.json');   // tests: their own folder
const HSK_ROOMS = new Map();   // pin → { pin, simId, createdAt, fx, hostHeartbeat, owner (teacher uid, never sent) }

function _hskRoomsLoad() {
  try {
    if (!fs.existsSync(HSK_ROOMS_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(HSK_ROOMS_FILE, 'utf8'));
    const cutoff = Date.now() - 6 * 60 * 60 * 1000;   // drop anything > 6h old
    Object.keys(raw || {}).forEach((pin) => {
      const r = raw[pin];
      if (r && (r.createdAt || 0) >= cutoff) HSK_ROOMS.set(pin, r);
    });
    console.log('[hsk] loaded', HSK_ROOMS.size, 'rooms from disk');
  } catch (e) { console.warn('[hsk] load rooms failed:', e.message); }
}
function _hskRoomsSave() {
  try {
    const dir = path.dirname(HSK_ROOMS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const obj = {};
    HSK_ROOMS.forEach((v, k) => { obj[k] = v; });
    fs.writeFileSync(HSK_ROOMS_FILE, JSON.stringify(obj), 'utf8');
  } catch (e) { console.warn('[hsk] save rooms failed:', e.message); }
}
_hskRoomsLoad();

function _hskGenPin() {
  // 4-digit numeric PIN, avoid leading-zero ambiguity, avoid collisions.
  for (let i = 0; i < 30; i++) {
    const p = String(1000 + Math.floor(Math.random() * 9000));
    if (!HSK_ROOMS.has(p)) return p;
  }
  return String(Date.now()).slice(-4);
}
// Sweep rooms older than 6 hours so the file doesn't grow forever.
setInterval(() => {
  const cutoff = Date.now() - 6 * 60 * 60 * 1000;
  let changed = false;
  for (const [pin, room] of HSK_ROOMS) {
    if ((room.createdAt || 0) < cutoff) { HSK_ROOMS.delete(pin); _hskClosed.set(pin, Date.now()); changed = true; }
  }
  for (const [pin, at] of _hskClosed) if (at < cutoff) _hskClosed.delete(pin);   // 🔒 closed-room PINs: 6 h memory
  if (changed) _hskRoomsSave();
}, 10 * 60 * 1000);

// ─── Helpers that bridge HSK rooms to the shared `games` Map ────────
// We register HSK rooms in the same games[pin] table that every other
// live game uses (reading, warmup, …). This gives HSK the
// same reliability — host:reclaim, the 60-min grace timer, broadcast,
// socket-room delivery. PIN can also be entered through /player.html
// because the kids' framework already validates against games[pin].
function _hskGameLookup(pin) {
  let g = games[pin];
  if (g && g.gameType === 'hsksim') return g;
  if (g) return null;   // 2026-10-15: another live game owns this PIN now; never overwrite it with an old exam room
  // LAZY HYDRATION: HSK_ROOMS is the disk-persistent table loaded at
  // boot. games[] is in-memory only. After a dyno restart, the PIN is
  // in HSK_ROOMS but NOT in games[]. We recreate the games[] entry on
  // the fly so the room remains "real" to player:join + every other
  // socket flow — no kid sees "No game with that PIN".
  const legacy = HSK_ROOMS.get(pin);
  if (!legacy) return null;
  games[pin] = {
    gameType: 'hsksim',
    state: 'lobby',
    hostId: null,
    hostOwner: legacy.owner || null,   // 🔒 2026-10-17: who opened it, kept on disk (a restart never hands it to anyone)
    createdAt: legacy.createdAt || Date.now(),
    duration: 3600,
    startedAt: null, endsAt: null,
    questions: [],
    players: {},
    teamScores: { red: 0, gold: 0 },
    feed: [],
    hsk: { simId: legacy.simId, fx: legacy.fx || null, sessions: {} },
  };
  return games[pin];
}

// Teacher creates a room — admin-auth via ?pw=
app.post('/api/hsk-sim/room/create', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  const simId = (req.body && req.body.simId) || (req.query && req.query.simId);
  if (!simId || !_simPayload(simId)) {
    return res.status(400).json({ ok: false, error: 'unknown simId' });
  }
  // ⭐ Reliability fix: PIN now lives in the same `games` table as
  // every working game (lecture, warmup, etc.). Drops the in-memory
  // HSK_ROOMS map that was getting wiped on dyno restart and that
  // /player.html couldn't see (root cause of "no game with that PIN"
  // reported 2026-06-03).
  const pin = genPin();
  const owner = _ownerOfTeacher(session);   // 🔒 2026-10-17: who opened it (host:reclaim, _mayReclaim)
  games[pin] = {
    gameType: 'hsksim',
    state: 'lobby',
    hostId: null,                 // no socket host page right now (HTTP-driven)
    hostOwner: owner,
    createdAt: Date.now(),
    duration: 3600,
    startedAt: null, endsAt: null,
    questions: [],
    players: {},                  // kids who join via socket land here
    teamScores: { red: 0, gold: 0 },
    feed: [],
    // HSK-specific state, namespaced so it doesn't collide with anything.
    hsk: {
      simId,
      fx: null,                   // current animation broadcast (or null)
      sessions: {},               // studentCode → heartbeat snapshot
    },
  };
  // Mirror into HSK_ROOMS too so the legacy disk-persistence keeps
  // working across restarts (and so /api/hsk-sim/room/:pin works for
  // old clients during the rollout).
  HSK_ROOMS.set(pin, { pin, simId, createdAt: Date.now(), fx: null, owner });
  _hskRoomsSave();
  res.json({ ok: true, pin, simId });
});

// Look up the simId for a PIN. Now checks games[] FIRST (the
// authoritative source), then falls back to HSK_ROOMS for any rooms
// loaded from disk after a restart.
app.get('/api/hsk-sim/room/:pin', (req, res) => {
  const pin = req.params.pin;
  // 🔒 2026-10-15: a PIN that was never an exam room counts as a guess (see _pinMiss)
  if (_pinBlocked(req)) return res.status(429).json({ ok: false, error: 'Espera unos minutos y vuelve a escribir el PIN.' });
  if (!HSK_ROOMS.has(String(pin)) && !(games[pin] && games[pin].gameType === 'hsksim')) _pinMiss(req, pin);
  const g = _hskGameLookup(pin);
  if (g) {
    return res.json({ ok: true, pin, simId: g.hsk.simId, fx: g.hsk.fx || null });
  }
  const legacy = HSK_ROOMS.get(pin);
  if (legacy) return res.json({ ok: true, pin, simId: legacy.simId, fx: legacy.fx || null });
  res.status(404).json({ ok: false, error: 'PIN no válido. Pregúntale a tu maestra.' });
});

// Teacher fires an animation across every kid in the room. Updates
// both games[pin].hsk.fx (authoritative) and HSK_ROOMS (legacy mirror).
app.post('/api/hsk-sim/room/:pin/fx', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  const pin = req.params.pin;
  const g = _hskGameLookup(pin);
  const legacy = HSK_ROOMS.get(pin);
  if (!g && !legacy) return res.status(404).json({ ok: false, error: 'room not found' });
  const { fx, on } = req.body || {};
  if (on && !Saga.anim(String(fx || ''))) return res.status(400).json({ ok: false, error: 'unknown animation' });   // saga only
  const fxState = on ? { id: String(fx || ''), since: Date.now() } : null;
  if (g)      g.hsk.fx = fxState;
  if (legacy) legacy.fx = fxState;
  _hskRoomsSave();
  res.json({ ok: true, fx: fxState });
});
app.post('/api/hsk-sim/heartbeat', (req, res) => {
  const { pin, simId, accessCode, studentCode, cursor, total, answered, section, status, displayName } = req.body || {};
  // PIN is the new room key. accessCode is retained for back-compat
  // with old force-impose flows. Either path produces a sessionKey
  // that the teacher can poll on.
  const roomKey = pin || accessCode || simId;
  if (!roomKey || !studentCode) {
    return res.status(400).json({ ok: false, error: 'pin (or accessCode) + studentCode required' });
  }
  const key = _hskSessionKey(roomKey, studentCode);
  // 🆕 GUEST PROVISIONING — if the kid typed a studentCode that
  // doesn't exist (PIN-join with a custom name), auto-create a
  // record so their progress + final result have somewhere to land.
  // 🪪 NAME RECOVERY: prefer the displayName the client sent (the
  // REAL name from the /player.html step) over the typed studentCode.
  // Also backfill existing records whose displayName equals their
  // code (legacy state from before this fix) — first time a real
  // name arrives, the record is upgraded.
  const g0 = pin ? _hskGameLookup(pin) : null;
  const classroomFromRoom = (g0 && g0.hsk && g0.hsk.classroomCode) || null;
  // Also check the socket roster: when the kid is in g.players, their
  // socket name is the authoritative display name.
  let nameFromSocket = '';
  if (g0 && g0.players) {
    for (const p of Object.values(g0.players)) {
      if ((p.studentCode && p.studentCode === studentCode) || (p.name && p.name.toLowerCase() === String(studentCode || '').toLowerCase())) {
        nameFromSocket = p.name; break;
      }
    }
  }
  const resolvedName = (displayName && String(displayName).trim()) || nameFromSocket || studentCode;
  // 🔒 2026-10-18 (ownership): an EXISTING account is renamed only by its own phone (the same proof as homework)
  const known1 = studentCode ? Students.peek(studentCode) : null;
  const nameOk = !known1 || _hwOwnsStudent(req, known1.rec);
  const rec = Students.getOrProvisionForPin(studentCode, nameOk ? resolvedName : null, classroomFromRoom);
  // Retroactive upgrade: if the record's displayName is still the
  // raw code (legacy guest record) and we now have a real name,
  // upgrade it. Saves the teacher from seeing "ABCD" in the Cuaderno
  // after we already learned the kid is "Lin".
  if (nameOk && rec && resolvedName && rec.displayName === rec.code && resolvedName !== rec.code) {
    rec.displayName = String(resolvedName).slice(0, 24);
    try { Students._save && Students._save(); } catch (_) {}
  }
  const isJoin = !HSK_SESSIONS.has(key);
  const g = pin ? _hskGameLookup(pin) : null;
  const session = {
    pin: pin || null,
    simId: simId
      || (g && g.hsk.simId)
      || (HSK_ROOMS.get(pin) && HSK_ROOMS.get(pin).simId)
      || null,
    accessCode: accessCode || null,
    studentCode,
    displayName: (rec && rec.displayName) || studentCode,
    avatar:      (rec && rec.avatar) || null,
    cursor:   cursor || 0,
    total:    total  || 0,
    answered: answered || 0,
    section:  section || '',
    status:   status || 'in-progress',
    lastBeat: Date.now(),
    isJoin,
  };
  HSK_SESSIONS.set(key, session);
  // Mirror into games[pin].hsk.sessions so the host live view reads
  // from the authoritative socket-framework table.
  if (g) g.hsk.sessions[studentCode] = session;
  // Response includes current room-wide fx so the kid renders it
  // without a separate poll.
  const fx = (g && g.hsk.fx) || (HSK_ROOMS.get(pin) && HSK_ROOMS.get(pin).fx) || null;
  res.json({ ok: true, fx });
});
// Teacher polls — returns all heartbeats for a given accessCode + sim,
// classified by freshness. Admin-auth via ?pw=
app.get('/api/hsk-sim/sessions', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  const wantPin    = req.query.pin || null;
  const wantSimId  = req.query.simId || null;
  const wantAccess = req.query.accessCode || null;
  const now = Date.now();
  const STALE_MS = 30 * 1000;
  const live = [], stale = [], completed = [], left = [];
  for (const s of HSK_SESSIONS.values()) {
    if (wantPin    && s.pin        !== wantPin)    continue;
    if (wantSimId  && s.simId      !== wantSimId)  continue;
    if (wantAccess && s.accessCode !== wantAccess) continue;
    const age = now - s.lastBeat;
    const row = Object.assign({}, s, { age });
    if      (s.status === 'completed') completed.push(row);
    else if (s.status === 'left')      left.push(row);
    else if (age > STALE_MS)           stale.push(row);
    else                                live.push(row);
  }
  res.json({ ok: true, live, stale, completed, left });
});
// Teacher polls completed results across all students who have ever
// taken any HSK sim (or just one if simId is provided). Drives the
// "Resultados HSK" panel in the maestro dashboard.
app.get('/api/hsk-sim/results', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  const wantSimId = req.query.simId || null;
  const all = (typeof Students.listAll === 'function') ? Students.listAll() : [];
  const ownCodes = session.teacher ? new Set(session.teacher.accessCodes || []) : null;
  const rows = [];
  for (const summary of all) {
    const rec = Students.get(summary.code);
    if (!rec || !Array.isArray(rec.hskResults) || !rec.hskResults.length) continue;
    if (ownCodes && rec.accessCode && !ownCodes.has(rec.accessCode)) continue;
    rec.hskResults.forEach((r) => {
      if (wantSimId && r.simId !== wantSimId) return;
      rows.push({
        code: rec.code,
        displayName: rec.displayName,
        avatar: rec.avatar,
        simId: r.simId,
        score: r.score,
        total: r.total,
        percent: r.percent,
        ts: r.ts,
      });
    });
  }
  rows.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  res.json({ ok: true, results: rows });
});

// List available reading tests for the kid.
app.get('/api/homework/reading-tests', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const code = req.query.studentCode;
  // 🔒 2026-10-18 (ownership): a kid's own tries only for their own phone; anyone else gets the plain list
  // (F6: peek first, a probe never brings an archived account back; the answer is the same plain list either way)
  const p = code ? Students.peek(String(code)) : null;
  const own = p && _hwOwnsStudent(req, p.rec) ? Students.get(p.rec.code) : null;
  res.json({ ok: true, stories: _hwReadingListFor(own ? own.code : null) });
});

// Full story content (pages + questions, NO correctIdx in the choices).
app.get('/api/homework/reading-test/:storyId', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const story = (ReadingStory.STORIES || {})[req.params.storyId];
  if (!story) return res.status(404).json({ ok: false, error: 'Historia no encontrada' });
  // Gate: if the kid hasn't been in class for this test, deny — UNLESS
  // we're in bootstrap "unlocked for all" mode.
  const studentCode = req.query.studentCode;
  if (!READING_UNLOCKED_FOR_ALL) {
    const p0 = studentCode ? Students.peek(String(studentCode)) : null;   // (F6: a probe never restores an archived account)
    const rec = p0 && _hwOwnsStudent(req, p0.rec) ? Students.get(p0.rec.code) : null;   // 🔒 2026-10-18 (ownership): a classmate's tries open nothing
    const hasAttempted = rec && Array.isArray(rec.testResults)
      && rec.testResults.some((t) => t.storyId === story.id);
    if (!hasAttempted) {
      return res.status(403).json({ ok: false, error: 'Aún no has hecho este examen en clase. Pídele a tu maestra que lo abra.' });
    }
  }
  res.json({
    ok: true,
    id: story.id,
    title: story.title,
    subtitle: story.subtitle,
    pages: story.pages.map((p) => ({
      pageNum:    p.pageNum,
      caption:    p.caption,
      sentences:  p.sentences,
      sentencesEs: p.sentencesEs,
      audioUrl:   '/assets/reading/' + story.id + '/page-' + p.pageNum + '.mp3',
      imageUrl:   ReadingStory.pageImageUrl(story, p.pageNum),
    })),
    questions: story.questions.map((q) => ({
      q: q.q,
      choices: q.choices,
      // NEVER send correctIdx to the client
    })),
  });
});

// Submit & grade a reading test taken from the homework portal.
app.post('/api/homework/reading-test/submit', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const { studentCode, storyId, answers, accessCode } = req.body || {};
  const story = (ReadingStory.STORIES || {})[storyId];
  if (!story) return res.status(404).json({ ok: false, error: 'Historia no encontrada' });
  // 🔒 2026-10-18 (ownership): a reading-test grade lands only on the caller's own record
  const rec = _hwKid(req, res, studentCode);   // 🔒 2026-10-18 (ownership; F6: one answer, no restore on a probe)
  if (!rec) return;
  const arr = Array.isArray(answers) ? answers : [];
  const pointsPerQ = 20;
  let score = 0;
  const breakdown = story.questions.map((q, i) => {
    const picked = Number(arr[i]);
    const correct = Number.isFinite(picked) && picked === q.correctIdx;
    if (correct) score += pointsPerQ;
    return {
      i,
      q:         q.q,
      choices:   q.choices,
      picked:    Number.isFinite(picked) ? picked : null,
      correctIdx: q.correctIdx,
      correct,
      pointsEarned: correct ? pointsPerQ : 0,
    };
  });
  Students.logTestResult(rec.code, {
    storyId:    story.id,
    storyTitle: story.title,
    score,
    pointsPerQ,
    breakdown,
    pin:        'homework',
  });
  res.json({ ok: true, score, total: 100, breakdown });
});

// Review a PAST reading-test attempt — returns the best attempt's full
// breakdown so the student can SEE which questions they missed + the right
// answer (so they can fix it next time). User 2026-05-28: "they cannot see
// why they got it wrong."
app.get('/api/homework/reading-review/:storyId', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  // 🔒 2026-10-18 (ownership): a try's answers (with the right ones) only for the kid's own phone (F6: one answer)
  const rec = _hwKid(req, res, req.query.studentCode);
  if (!rec) return;
  if (!Array.isArray(rec.testResults)) return res.json({ ok: true, attempt: null });
  const attempts = rec.testResults.filter((t) => t.storyId === req.params.storyId);
  if (!attempts.length) return res.json({ ok: true, attempt: null });
  // Best score, tie → most recent.
  const best = attempts.slice().sort((a, b) => (b.score - a.score) || (b.ts - a.ts))[0];
  res.json({
    ok: true,
    attempt: {
      storyId: best.storyId, storyTitle: best.storyTitle,
      score: best.score, ts: best.ts,
      breakdown: best.breakdown || [],
    },
  });
});

// 📜 The kid's own saved warmup sentences (for the homework-portal profile).
// Same data the in-game "Mis oraciones" shows, exposed via REST.
app.get('/api/homework/sentences/:code', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const rec = _hwKid(req, res, req.params.code);   // 🔒 2026-10-18 (ownership; F6: one answer, no restore on a probe)
  if (!rec) return;
  res.json({ ok: true, sentences: Students.getHistory(rec.code, 100) });  // newest-first
});
// Kid deletes ONE of their own saved sentences (junk / accidental save).
app.post('/api/homework/sentences/delete', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const { studentCode, ts } = req.body || {};
  const rec = _hwKid(req, res, studentCode);   // 🔒 2026-10-18 (ownership; F6: one answer, no restore on a probe)
  if (!rec) return;
  const ok = Students.deleteHistoryEntry(rec.code, ts);
  res.json({ ok, sentences: Students.getHistory(rec.code, 100) });
});
// Kid saves an EDITED copy of one of their sentences. Per user intent the
// original is preserved — this appends a brand-new entry with the reordered/
// trimmed word list ("save as a copy of the sentence they started with").
app.post('/api/homework/sentences/save', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const { studentCode, words } = req.body || {};
  const rec = _hwKid(req, res, studentCode);   // 🔒 2026-10-18 (ownership; F6: one answer, no restore on a probe)
  if (!rec) return;
  if (!Array.isArray(words) || !words.length) return res.status(400).json({ ok: false, error: 'oración vacía' });
  Students.appendSentence(rec.code, words.slice(0, 24), '');
  res.json({ ok: true, sentences: Students.getHistory(rec.code, 100) });
});

// === 🏆 DAILY CHALLENGE (the "Diario" tab) ===========================
// The theme rotates by date so it "changes" each day. The client builds the
// actual word objects from warmup-vocab (it has the dictionary); the server
// only decides WHICH experience bank + the goal, and owns the rewards.
const DAILY_EXPS = ['exp1', 'exp2', 'exp3', 'exp4', 'exp5', 'exp6', 'exp7', 'exp8'];
const DAILY_GOAL = 8;
function _dailyThemeFor(dateStr) {
  // Deterministic hash of the date → pick an experience bank.
  let h = 0;
  for (let i = 0; i < String(dateStr).length; i++) h = (h * 31 + dateStr.charCodeAt(i)) >>> 0;
  return { exp: DAILY_EXPS[h % DAILY_EXPS.length], goal: DAILY_GOAL };
}
// 🎲 The mechanic rotates DAILY across 5 distinct modes so no two
// consecutive days ever feel the same. Old version cycled by day-of-week
// → "Tuesday always plays the same" → the kid said "today feels exactly
// like yesterday." Fixed by rotating on a days-since-epoch counter, which
// guarantees a fresh mode every day on a 5-day cycle. Period = 5 days.
//
// Modes:
//   slash  — 🍉 cut falling characters (the classic, kept for nostalgia)
//   story  — 📖 Templo del Dragón cutscene (Pokémon dialogue + boss)
//   memory — 🧠 Memory pairs (find 4 pinyin/Spanish matches)
//   speak  — 🗣️ Speak & Listen (TTS prompt + repeat)
//   react  — ⚡ Reacción Pīnyīn (NEW — 3-sec timer, pick correct emoji)
const DAILY_MODE_ORDER = ['story', 'react', 'slash', 'memory', 'speak'];
const DAILY_MODE_META = {
  slash:  { emoji: '🍉', label: 'Corte rápido',     short: 'Slash' },
  story:  { emoji: '📖', label: 'Templo del Dragón',short: 'Historia' },
  memory: { emoji: '🧠', label: 'Memoria Flash',    short: 'Memoria' },
  speak:  { emoji: '🗣️', label: 'Escucha y Repite', short: 'Speak' },
  react:  { emoji: '⚡', label: 'Reacción Pīnyīn',  short: 'Reacción' },
};
function _daysSinceEpoch(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));
  if (!m) return 0;
  return Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000);
}
function _dailyModeFor(dateStr) {
  const days = _daysSinceEpoch(dateStr);
  return DAILY_MODE_ORDER[((days % DAILY_MODE_ORDER.length) + DAILY_MODE_ORDER.length) % DAILY_MODE_ORDER.length];
}
// 🎁 Mystery bonus — ~1 in 7 days the kid gets DOUBLE sword rewards.
// Deterministic per date so the kid can plan, but unpredictable enough
// that opening the daily feels like checking a loot box.
function _dailyBonusFor(dateStr) {
  const days = _daysSinceEpoch(dateStr);
  // Mix the day number with a prime to scatter the bonus days across
  // the week — avoids always landing on the same DOW.
  return ((days * 17 + 3) % 7) === 0;
}
function _tomorrowStr(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));
  if (!m) return dateStr;
  const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]) + 86400000);
  return t.toISOString().slice(0, 10);
}
function _todayServer() { return new Date().toISOString().slice(0, 10); }
// Sword milestones — locked SECRET prizes (real reward arranged by teacher).
// Smaller / quicker milestones so the FIRST prize feels reachable. Kids hit
// chest #1 in about 1 day, #2 in ~2-3 days, #3 in ~1 week. Tunable here.
const DAILY_MILESTONES = [30, 50, 100];
app.get('/api/homework/daily', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const rec = _hwKid(req, res, req.query.studentCode);   // 🔒 2026-10-18 (ownership; F6: one answer, no restore on a probe)
  if (!rec) return;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : _todayServer();
  const prog = Students.getProgress(rec.code);
  // 🆕 Preview tomorrow's mode so the daily card can tease "mañana: 🧠
  // Memoria" — builds anticipation, the kid checks back the next day.
  const tomorrow = _tomorrowStr(date);
  res.json({
    ok: true,
    date,
    theme: _dailyThemeFor(date),
    mode: _dailyModeFor(date),
    modeMeta: DAILY_MODE_META[_dailyModeFor(date)] || null,
    bonus: _dailyBonusFor(date),  // true = double-sword wildcard day
    tomorrow: {
      date: tomorrow,
      mode: _dailyModeFor(tomorrow),
      modeMeta: DAILY_MODE_META[_dailyModeFor(tomorrow)] || null,
    },
    doneToday: prog && prog.dailyDate === date,
    progress: prog,
    milestones: DAILY_MILESTONES,
  });
});
app.post('/api/homework/daily/complete', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const { studentCode, date, correct } = req.body || {};
  // 🔒 2026-10-18 (ownership): swords and streaks land only on the caller's own record
  const rec = _hwKid(req, res, studentCode);   // 🔒 2026-10-18 (ownership; F6: one answer, no restore on a probe)
  if (!rec) return;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : _todayServer();
  const result = Students.awardDaily(rec.code, d, correct);
  // 🎁 Mystery-bonus day: double the swords. The base award already
  // landed on the student record via awardDaily; we top it up here with
  // a second +N swords and flag the response so the client can render
  // a "+2x ¡DÍA DORADO!" banner.
  const isBonus = _dailyBonusFor(d);
  let bonusSwords = 0;
  if (result.ok && isBonus && result.gained && result.gained.swords) {
    bonusSwords = result.gained.swords;
    rec.swords = (Number(rec.swords) || 0) + bonusSwords;
    if (result.gained) result.gained.swords += bonusSwords;
    // Refresh progress snapshot so the client HUD shows the post-bonus total.
    result.progress = Students.getProgress(rec.code);
  }
  res.json(Object.assign({
    ok: result.ok,
    reason: result.reason,
    bonus: isBonus,
    bonusSwords,
  }, result));
});
// Sentence-bonus: after the slash game, the kid arranges the words they
// discovered into a sentence. +1 ⚔️ and the sentence is saved to their
// Mis oraciones. Idempotent per day so they can't farm it.
app.post('/api/homework/daily/sentence-bonus', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const { studentCode, date, wordIds } = req.body || {};
  const rec = _hwKid(req, res, studentCode);   // 🔒 2026-10-18 (ownership; F6: one answer, no restore on a probe)
  if (!rec) return;
  if (!Array.isArray(wordIds) || wordIds.length < 2) {
    return res.json({ ok: false, reason: 'short' });
  }
  const d = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : _todayServer();
  // 🔧 ALWAYS save the sentence (Venn-diagram unlimited saves per day) so
  // every redo of the daily contributes to Mis oraciones + the parent
  // 0→2000 progress bar. The +1 ⚔️ sword bonus is the only thing that
  // caps to once-per-day to avoid sword inflation.
  Students.appendSentence(rec.code, wordIds.slice(0, 12), 'daily-bonus');
  let gained = { swords: 0 };
  let alreadyClaimed = false;
  if (rec.bonusDate === d) {
    alreadyClaimed = true;
  } else {
    rec.swords = (Number(rec.swords) || 0) + 1;
    rec.bonusDate = d;
    gained.swords = 1;
  }
  res.json({
    ok: true,
    gained,
    alreadyClaimed,
    sentenceSaved: true,
    progress: Students.getProgress(rec.code),
  });
});

// 🌐 EMIRATI: full review payload — every word the kid has marked as seen
// PLUS every example sentence flagged as learned. Drives the "📜 Mis
// aprendidos" modal in the gateway. Returns the full hydrated word
// objects (ar, tr, en, section, ses[]) so the client can render them
// the same way as the daily card, with the same 🔊/✓ tools.
app.get('/api/maestro/emirati/learned', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  if (!session.isSuperAdmin) return res.status(403).json({ ok: false, error: 'super admin only' });
  const state = _emiratiRead();
  const seen = new Set(state.seen || []);
  const learnedSentences = new Set(state.learnedSentences || []);
  const seenWords = Emirati.EMIRATI_WORDS.filter((w) => seen.has(w.id))
    .sort((a, b) => a.priority - b.priority);
  // Group by section so the UI can render carpets.
  const bySection = {};
  seenWords.forEach((w) => {
    const k = w.section;
    if (!bySection[k]) bySection[k] = [];
    bySection[k].push(w);
  });
  // Also enumerate every individually-learned sentence with its parent word.
  const learnedSentenceRows = [];
  Emirati.EMIRATI_WORDS.forEach((w) => {
    (w.ses || []).forEach((s, si) => {
      const key = w.id + ':' + si;
      if (learnedSentences.has(key)) {
        learnedSentenceRows.push({ key, wordId: w.id, ar: w.ar, tr: w.tr, en: w.en, section: w.section, sentence: s });
      }
    });
  });
  res.json({
    ok: true,
    sections: Emirati.EMIRATI_SECTIONS,
    bySection,
    seenWordsCount: seenWords.length,
    learnedSentenceRows,
    learnedSentenceCount: learnedSentenceRows.length,
  });
});

// 🌐 EMIRATI: mark an example sentence as "learned" (per-sentence tracking
// so the gateway feels like a real progression, not just a word list).
// Key format: <wordId>:<sentenceIndex>  e.g.  "e7:0"  →  word e7, ses[0].
app.post('/api/maestro/emirati/sentence/mark', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  if (!session.isSuperAdmin) return res.status(403).json({ ok: false, error: 'super admin only' });
  const { keys, unmark } = req.body || {};
  if (!Array.isArray(keys) || !keys.length) {
    return res.status(400).json({ ok: false, error: 'keys[] required' });
  }
  const state = _emiratiRead();
  state.learnedSentences = Array.isArray(state.learnedSentences) ? state.learnedSentences : [];
  const set = new Set(state.learnedSentences);
  keys.forEach((k) => {
    const norm = String(k).replace(/[^A-Za-z0-9:_-]/g, '');
    if (!norm) return;
    if (unmark) set.delete(norm); else set.add(norm);
  });
  state.learnedSentences = Array.from(set);
  _emiratiWrite(state);
  res.json({ ok: true, count: state.learnedSentences.length, learnedSentences: state.learnedSentences });
});

// Review a PAST assignment attempt — best submission's breakdown so the kid
// sees which sentences they got wrong + the correct answer.
app.get('/api/homework/assignment-review/:id', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const rec = _hwKid(req, res, req.query.studentCode);   // 🔒 2026-10-18 (ownership; F6: one answer, no restore on a probe)
  if (!rec) return;
  const subs = Students.getAssignmentSubmissions(rec.code, 100).filter((s) => s.assignmentId === req.params.id);
  if (!subs.length) return res.json({ ok: true, attempt: null });
  const best = subs.slice().sort((a, b) => (b.score - a.score) || (b.ts - a.ts))[0];
  res.json({ ok: true, attempt: { score: best.score, total: best.total, breakdown: best.breakdown || [] } });
});

// === 🔊 GOOGLE CLOUD TTS — premium-quality zh-CN audio ================
// Wired 2026-05-27 per user request (Web Speech sounded terrible, GCP
// TTS sounds human). Caches every synthesized MP3 to disk so the second
// playback of the same phrase is instant + free.
//
// Lazy-loads the client only when the credentials env var is set, so the
// server still boots fine on dev machines without GCP set up.
let _ttsClient = null;
function _getTtsClient() {
  if (_ttsClient) return _ttsClient;
  const raw = process.env.GOOGLE_TTS_CREDENTIALS_JSON;
  if (!raw) {
    console.warn('[tts] GOOGLE_TTS_CREDENTIALS_JSON not set — TTS disabled');
    return null;
  }
  let creds;
  try {
    creds = JSON.parse(raw);
  } catch (e) {
    console.error('[tts] failed to parse GOOGLE_TTS_CREDENTIALS_JSON:', e.message);
    return null;
  }
  try {
    const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
    _ttsClient = new TextToSpeechClient({ credentials: creds, projectId: creds.project_id });
    console.log('[tts] Google Cloud TTS client initialized for project', creds.project_id);
    return _ttsClient;
  } catch (e) {
    console.error('[tts] failed to init Google TTS client:', e.message);
    return null;
  }
}

const TTS_CACHE_DIR = path.join(__dirname, 'data', 'tts-cache');
// Google's Mandarin voices use the cmn-CN locale prefix (Mandarin is
// ISO 639-3 "cmn", not "zh"). Previously was zh-CN-Wavenet-A which
// returns "voice does not exist" from the API (2026-05-27).
const TTS_DEFAULT_VOICE = process.env.TTS_VOICE || 'cmn-CN-Wavenet-A';
// Pull language code from the voice prefix so both cmn-CN-* and zh-CN-*
// requests work without further config changes.
function _languageCodeFromVoice(voice) {
  const m = /^([a-z]{2,3}-[A-Z]{2})/.exec(String(voice || ''));
  return m ? m[1] : 'cmn-CN';
}

// PINYIN → HANZI conversion. Critical insight 2026-05-27: Google's
// cmn-CN voices interpret pinyin tokens as romanized text and pronounce
// them with mediocre tones (user reported "doesn't sound multilingual,
// not with tones"). Feeding hanzi (Chinese characters) instead produces
// true native Mandarin pronunciation.
//
// We parse warmup-vocab.js at boot to build the lookup map. The pinyin
// keys are toneless+lowercase so they match the kid's typed answers
// after normalization (the same way grading works).
let _pinyinToHanzi = null;
function _loadPinyinHanziMap() {
  if (_pinyinToHanzi) return _pinyinToHanzi;
  _pinyinToHanzi = { withTone: new Map(), toneless: new Map() };
  try {
    const src = fs.readFileSync(path.join(__dirname, 'public/js/warmup-vocab.js'), 'utf8');
    // Match the w() factory lines: w('exp1', 'pronoun', 'wǒ', '我', 'yo', '👤'),
    // The 3rd capture is pinyin, the 4th is hanzi.
    const re = /w\('exp\d+',\s*'[^']+',\s*'([^']+)',\s*'([^']+)'/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      const pinyinTone = m[1].toLowerCase().replace(/['ʼ]/g, '');
      const pinyinFlat = pinyinTone.normalize('NFD').replace(/[̀-ͯ]/g, '');
      const hanzi = m[2];
      if (pinyinTone && hanzi) {
        // Tone-marked keys: always set (no real collisions when tones present)
        _pinyinToHanzi.withTone.set(pinyinTone, hanzi);
        // Toneless: FIRST-WINS so foundational words (earlier EXP) beat
        // homonyms (e.g. shi=是 wins over shi=十; he=喝 wins over hé=和)
        if (!_pinyinToHanzi.toneless.has(pinyinFlat)) {
          _pinyinToHanzi.toneless.set(pinyinFlat, hanzi);
        }
      }
    }
    console.log('[tts] pinyin→hanzi map loaded:',
      _pinyinToHanzi.withTone.size, 'tone-marked,',
      _pinyinToHanzi.toneless.size, 'toneless');
  } catch (e) {
    console.warn('[tts] failed to load pinyin→hanzi map:', e.message);
  }
  return _pinyinToHanzi;
}
// Returns true if the text already contains CJK chars — skip conversion.
function _looksLikeChinese(text) {
  return /[一-鿿]/.test(String(text || ''));
}
// Tokenize pinyin, look up each token. Try tone-marked FIRST (precise),
// fall back to toneless (best-effort). Words not in either map pass
// through as-is. Joined without spaces — that's how Chinese is written.
function _convertPinyinToHanzi(text) {
  if (_looksLikeChinese(text)) return text;
  const maps = _loadPinyinHanziMap();
  // Tokenize on whitespace, lowercase, strip punctuation but KEEP tones
  const tokens = String(text || '').toLowerCase()
    .replace(/[.,!?;:"()¿¡]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  let hits = 0;
  const out = tokens.map((tok) => {
    const stripped = tok.replace(/['ʼ]/g, '');
    // First, exact tone-marked match
    let h = maps.withTone.get(stripped);
    if (h) { hits++; return h; }
    // Fallback: toneless match
    const flat = stripped.normalize('NFD').replace(/[̀-ͯ]/g, '');
    h = maps.toneless.get(flat);
    if (h) { hits++; return h; }
    return tok;
  }).join('');
  if (hits === 0) return text;  // nothing matched, pass through
  return out;
}
// one pinyin word → its hanzi from the platform's list, or null (El Entrenamiento's voice falls back to it after the
// curriculum's own words: core/entrenamiento.js speechText)
function _pinyinTokenHanzi(tok) {
  const maps = _loadPinyinHanziMap();
  const s = String(tok || '').toLowerCase().replace(/['ʼ]/g, '');
  return maps.withTone.get(s) || maps.toneless.get(s.normalize('NFD').replace(/[̀-ͯ]/g, '')) || null;
}
Train.configure({ tokenHanzi: _pinyinTokenHanzi });
// Hash a (text, voice) pair so different voices don't collide and the
// same text re-uses the same file forever.
function _ttsCacheKey(text, voice) {
  return require('crypto').createHash('sha1')
    .update(voice + '|' + String(text || '').trim().normalize('NFC'))
    .digest('hex');
}
function _ttsCachePath(text, voice) {
  return path.join(TTS_CACHE_DIR, _ttsCacheKey(text, voice) + '.mp3');
}
try { fs.mkdirSync(TTS_CACHE_DIR, { recursive: true }); } catch (_) {}

// Health check — hit this from a browser to see exactly why TTS isn't
// working. Returns JSON describing each precondition (env var set?
// JSON parseable? client init? package present?). User-friendly so it
// can be debugged without server logs.
// Pass ?live=1 to ALSO do a real synthesizeSpeech() call so we can
// see if the credentials actually authorize the API.
app.get('/api/tts/health', async (req, res) => {
  const out = {
    envVarSet: !!process.env.GOOGLE_TTS_CREDENTIALS_JSON,
    envVarLength: (process.env.GOOGLE_TTS_CREDENTIALS_JSON || '').length,
    parseable: false,
    projectId: null,
    sdkLoaded: false,
    clientInit: false,
    voice: TTS_DEFAULT_VOICE,
    cacheDir: TTS_CACHE_DIR,
    cacheExists: false,
    cachedFiles: 0,
  };
  if (out.envVarSet) {
    try {
      const j = JSON.parse(process.env.GOOGLE_TTS_CREDENTIALS_JSON);
      out.parseable = true;
      out.projectId = j.project_id || null;
      out.hasPrivateKey = !!j.private_key;
      out.clientEmail = j.client_email ? j.client_email.replace(/^([^@]{4}).+(@.+)$/, '$1***$2') : null;
    } catch (e) {
      out.parseError = e.message;
    }
  }
  try {
    require.resolve('@google-cloud/text-to-speech');
    out.sdkLoaded = true;
  } catch (_) {
    out.sdkLoaded = false;
  }
  // Try to init the client and report any error
  try {
    const client = _getTtsClient();
    out.clientInit = !!client;
  } catch (e) {
    out.clientInitError = e.message;
  }
  // Cache state
  try {
    if (fs.existsSync(TTS_CACHE_DIR)) {
      out.cacheExists = true;
      out.cachedFiles = fs.readdirSync(TTS_CACHE_DIR).filter((f) => f.endsWith('.mp3')).length;
    }
  } catch (_) {}
  // Live synthesize test — only if ?live=1, otherwise skipped to avoid
  // burning Google quota on every health check.
  if (req.query.live === '1' && out.clientInit) {
    try {
      const client = _getTtsClient();
      const [r] = await client.synthesizeSpeech({
        input: { text: 'ni hao' },
        voice: { languageCode: _languageCodeFromVoice(TTS_DEFAULT_VOICE), name: TTS_DEFAULT_VOICE },
        audioConfig: { audioEncoding: 'MP3' },
      });
      out.liveTest = {
        success: !!(r && r.audioContent),
        audioBytes: r && r.audioContent ? r.audioContent.length : 0,
      };
    } catch (e) {
      out.liveTest = { success: false, error: e.message, code: e.code || null };
    }
  }
  res.json(out);
});

// 🔒 2026-06-21 (Security Phase 1) — denial-of-wallet guard for TTS.
// Google Cloud bills per character on every CACHE MISS (a brand-new
// text+voice combo that has to be synthesized). Cache HITS are free
// (served from disk), so we throttle ONLY the miss path — real kids
// replaying already-made audio are never slowed down. Cap: 20 fresh
// syntheses/min per IP. Normal use synthesizes a handful of NEW phrases
// a minute (the rest are cached); a billing-attack loop of unique
// strings gets capped at 20 Google calls/min/IP instead of unlimited.
// Same cheap in-memory ip→timestamps pattern as _hbRateLimit (no dep).
const _ttsHits = new Map();
function _ttsSynthRateLimit(req) {
  const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
  const key = 'tts-' + String(ip).split(',')[0].trim();
  const now = Date.now();
  const window = 60 * 1000;
  const arr = (_ttsHits.get(key) || []).filter((t) => now - t < window);
  arr.push(now);
  _ttsHits.set(key, arr);
  if (_ttsHits.size > 5000) {
    for (const [k, v] of _ttsHits) {
      if (!v.length || now - v[v.length - 1] > window) _ttsHits.delete(k);
    }
  }
  return arr.length <= 20;
}

// GET /api/tts?text=...&voice=zh-CN-Wavenet-A
// Returns audio/mpeg. Cache-first: hits Google only on miss.
// Status: 200 with audio, 404 if no client, 400 if bad input.
app.get('/api/tts', async (req, res) => {
  const text = String(req.query.text || '').trim();
  const voice = String(req.query.voice || TTS_DEFAULT_VOICE);
  if (!text) return res.status(400).json({ ok: false, error: 'missing text' });
  if (text.length > 200) return res.status(400).json({ ok: false, error: 'text too long' });
  // Whitelist voice names to prevent abuse (and typos that 404 at Google).
  // Mandarin (cmn-CN / cmn-TW / legacy zh-CN) is the primary use case;
  // we also allow ar-XA (Arabic — MSA) for the owner's Emirati gateway.
  if (!/^(cmn|zh)-(CN|TW)-[A-Za-z0-9-]+$/.test(voice)
      && !/^ar-XA-[A-Za-z0-9-]+$/.test(voice)) {
    return res.status(400).json({ ok: false, error: 'invalid voice' });
  }
  return _ttsServe(req, res, text, voice, null);
});
// The cache-first Google voice behind /api/tts, also used by El Entrenamiento's questions (/api/ruta/train/voice/…).
// opts.trusted: the text was chosen by the server (a curriculum question), never typed by a visitor, so the per-address
// synth limit (a denial-of-wallet guard against floods of unique strings) does not apply; a global cap of new voices
// a minute still does. opts.cacheControl: the response's Cache-Control (default public, 30 days).
const _ttsTrustedHits = [];
const _ttsInFlight = new Map();   // cache path → the synthesis already running for it (a class asking at once: one call)
async function _ttsServe(req, res, text, voice, opts) {
  const o = opts || {};
  const cc = o.cacheControl || 'public, max-age=2592000';   // 30 days
  const cachePath = _ttsCachePath(text, voice);
  // Cache hit → stream from disk, ~5ms
  if (fs.existsSync(cachePath)) {
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', cc);
    return fs.createReadStream(cachePath).pipe(res);
  }
  // Cache miss → this is the ONLY path that costs money. Throttle it so a
  // loop of unique strings can't run up the Google bill. Returns 429 (and a
  // friendly message) past 20 fresh syntheses/min/IP — well above real use.
  if (o.trusted) {
    const now = Date.now();
    while (_ttsTrustedHits.length && now - _ttsTrustedHits[0] > 60 * 1000) _ttsTrustedHits.shift();
    if (_ttsTrustedHits.length >= 240) return res.status(429).set('Retry-After', '20').json({ ok: false, error: 'Espera un momento.' });
    _ttsTrustedHits.push(now);
  } else if (!_ttsSynthRateLimit(req)) {
    console.warn('[security] tts synth rate-limit hit ip=' + _clientIp(req) + ' (possible denial-of-wallet probe)');
    return res.status(429).json({ ok: false, error: 'demasiadas voces nuevas, espera un momento' });
  }
  // Cache miss → synthesize via Google Cloud TTS
  const client = _getTtsClient();
  if (!client) return res.status(503).json({ ok: false, error: 'TTS not configured' });
  try {
    let job = _ttsInFlight.get(cachePath);
    if (!job) {
      // Convert pinyin → hanzi for true Mandarin pronunciation. Sending
      // "wo ai mama" to a cmn-CN voice produces a confused tone-deaf
      // reading. Sending "我爱妈妈" produces native pronunciation. SKIP this
      // conversion for non-Mandarin voices (Arabic etc.) — the conversion
      // would mangle the native script.
      const isMandarin = /^(cmn|zh)-/.test(voice);
      const synthText = isMandarin ? _convertPinyinToHanzi(text) : text;
      if (!o.trusted) console.log('[tts] synth voice=' + voice + ' text=' + JSON.stringify(text) + ' → ' + JSON.stringify(synthText));
      job = client.synthesizeSpeech({
        input: { text: synthText },
        voice: { languageCode: _languageCodeFromVoice(voice), name: voice },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 0.85,    // ~15% slower so kids can mimic
          pitch: 0.0,
        },
      }).then(async ([out]) => {
        // Persist for next time: written whole to a temp file and renamed, so a request in between never streams a
        // half-written clip (the synthesis stays "in flight" until the file is complete)
        if (out && out.audioContent) {
          const tmp = cachePath + '.' + process.pid + '.tmp';
          try { await fs.promises.writeFile(tmp, out.audioContent); await fs.promises.rename(tmp, cachePath); } catch (err) {
            console.warn('[tts] failed to cache', cachePath, err.message);
            fs.promises.unlink(tmp).catch(() => {});
          }
        }
        return out;
      }).finally(() => _ttsInFlight.delete(cachePath));
      _ttsInFlight.set(cachePath, job);
    }
    const out = await job;
    if (!out || !out.audioContent) {
      return res.status(502).json({ ok: false, error: 'no audio returned' });
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', cc);
    res.end(out.audioContent);
  } catch (e) {
    // (a curriculum question's text stays out of the log: El Entrenamiento's voice never prints what it says)
    console.error('[tts] synthesize failed' + (o.trusted ? '' : ' for ' + JSON.stringify(text)) + ':', e.message);
    if (!res.headersSent) res.status(502).json({ ok: false, error: o.trusted ? 'tts failed' : 'tts failed: ' + e.message });
  }
}

// Friendly redirect: students can type /homework or /tarea — both work.
// The Modo-Maestro auto-exit redirect lands on /homework?code=...&from=maestro,
// so this route MUST exist (and preserve the query string). Without it the
// kid hits a 502/404 on exit.
app.get(['/tarea', '/tareas'], (req, res) => res.redirect('/homework.html'));
// Teachers type /maestro (CLAUDE.md, host-hsk's "missing code" link): it used to be a 404.
app.get(['/maestro', '/maestra', '/teacher'], (req, res) => res.redirect('/maestro.html'));
app.get('/homework', (req, res) => {
  res.sendFile(_emPath.join(__dirname, 'public', 'homework.html'));
});
// 🔊 Homework audio gateway (2026-10-11): public, no login. /audios lists every homework,
// /audios/<id> (e.g. /audios/hsk1-e03-r1) opens one; the PDFs link straight to it.
// A level's vocabulary base («La base · Empieza aquí», core/levels.js `base`) as the /homework home links it: its address,
// its folder (the page saves seals under draly_base_<folder>) and its own word count, read once per boot from the
// catalog scripts/audios-build.js writes (a deploy restarts the server, so it never goes stale).
let _audioBases = null;
function _loadAudioBases() {
  if (!_audioBases) {
    try { _audioBases = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'assets', 'audios', 'catalog.json'), 'utf8')).bases || []; }
    catch (e) { console.warn('[audios] catalog unreadable:', e.message); _audioBases = []; }
  }
  return _audioBases;
}
function audioBaseFor(info) {
  if (!info || !info.base) return null;
  const b = _loadAudioBases().find((x) => x.id === info.base);
  return b ? { href: '/audios/' + b.id, level: b.level, words: b.words } : null;
}
// 🏆 2026-10-18 (La Ruta Dorada redesign): the homework audios of the same catalog, for the kid's done marks
// («Escuchada», «¡Ya la mandé!»): id → its level folder (yct1 · newhsk1 · hsk1), newest first. Read once per boot.
let _audioHomeworks = null;
function _loadAudioHomeworks() {
  if (_audioHomeworks) return _audioHomeworks;
  let list;
  try { list = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'assets', 'audios', 'catalog.json'), 'utf8')).homeworks; }
  catch (e) { console.warn('[audios] catalog unreadable:', e.message); list = null; }
  const map = new Map();
  (Array.isArray(list) ? list : []).filter((h) => h && typeof h.id === 'string').sort((a, b) => ((b.exp || 0) - (a.exp || 0)) || ((b.round || 0) - (a.round || 0)))
    .forEach((h) => map.set(h.id, String(h.level || '')));
  // (kept only after a good read: one failed read never leaves the marks with an empty catalog until the next deploy)
  if (Array.isArray(list)) _audioHomeworks = map;
  return map;
}
// an id as a phone sends it → the catalog's id, or null (hsk2-e01-r1 is newhsk1-e01-r1: HSK 2 became New HSK 1)
function _tareaId(raw) {
  if (typeof raw !== 'string' || raw.length > 60) return null;
  let id = raw.trim().toLowerCase();
  Levels.LEVELS.forEach((l) => { if (l.pack && l.pack !== l.id && id.indexOf(l.id + '-') === 0) id = l.pack + id.slice(l.id.length); });
  return _loadAudioHomeworks().has(id) ? id : null;
}
// the homework ids of a level (its curriculum folder), newest first
function _tareaIdsOf(lvl) {
  const l = Levels.normalize(lvl);
  if (!l) return [];
  const folder = Levels.info(l).pack || l;
  return [..._loadAudioHomeworks()].filter((e) => e[1] === folder).map((e) => e[0]);
}
// 🗂️ 2026-10-18 «Homework by experience, like folders» (his rule: "basing everything on experiences is so good and we
// should keep following the same rule"): a module's experiences = its curriculum pack's regular worlds, in order
// («EXP3 · El Restaurante Chino» → { n: 3, name: 'El Restaurante Chino', pic }), never Pinyin básico or the Simulacro
// del examen. pic = one of that world's own glossy pack pictures (public /assets/packs/…), a word that shows the
// experience (the house for the family, the school, the plane for the trip…), else the world's first picture on disk.
// La Ruta Dorada's «Tus tareas» draws one folder per experience; a homework audio's `exp` is its experience number.
const _EXP_PIC = { familia: ['jia', 'baba'], escuela: ['xuexiao', 'laoshi'], restaurante: ['fandian'], tienda: ['yifu', 'shangdian'], rutina: ['tianqi'],
  salud: ['yisheng', 'wan'], china: ['feiji'], magicas: ['xiexie'], mercado: ['shangdian'], tiempo: ['tianqi'], viajes: ['feiji'], casa: ['dianshi', 'zhuozi'],
  personas: ['ren'], numeros: ['san'], espejo: ['bizi'], mascotas: ['mao', 'gou'], comida: ['mifan'] };
const _rutaExpsCache = {};
const _rutaExpFiles = Object.create(null);   // '<level>/<n>' → the picture's file (only what _rutaExps chose)
const HOME_PEEK = 4;
const _rutaExpPeek = Object.create(null);    // '<slug>/<n>' → [the peek pictures' neutral addresses]
const _rutaExpWorld = Object.create(null);   // '<slug>/<n>' → the pack world's id (the teacher's game rounds name it)
function _rutaExps(lvl) {
  const l = Levels.normalize(lvl);
  if (!l) return [];
  if (_rutaExpsCache[l]) return _rutaExpsCache[l];
  const slug = Levels.info(l).pack || l;
  const pack = Packs.LEVELS.find((p) => p.id === slug);
  const out = [];
  (pack ? pack.worlds : []).filter((w) => w && w.id !== 'pinyin' && w.id !== 'simulacro').forEach((w, i) => {
    const m = /^EXP\s*(\d+)\s*·\s*/.exec(String(w.name || ''));
    let files = [];
    try { files = fs.readdirSync(path.join(__dirname, 'public', 'assets', 'packs', slug, w.id)).filter((f) => /^[a-z0-9-]+\.webp$/.test(f)); } catch (_) { files = []; }
    const words = (w.rounds || []).flatMap((r) => r.words || []).map((x) => x && x.img).filter(Boolean);
    const img = (_EXP_PIC[w.id] || []).concat(words).find((x) => files.includes(x + '.webp')) || (files[0] || '').replace(/\.webp$/, '');
    const n = m ? Number(m[1]) : i + 1;
    // (review 2026-10-18) served under a neutral name, /ruta-exp/<level>/<n>.webp: the pack names a picture after its
    // word's pinyin («jia.webp»), which a folder never needs to say; ?v= changes when the picture does
    let pic = null;
    if (img) {
      const file = path.join(__dirname, 'public', 'assets', 'packs', slug, w.id, img + '.webp');
      let v = '0';
      // (its content's hash: the same on every deploy, new only when the picture is)
      try { v = require('crypto').createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 8); } catch (_) { /* listed above */ }
      _rutaExpFiles[slug + '/' + n] = file;
      pic = '/ruta-exp/' + slug + '/' + n + '.webp?v=' + v;
    }
    out.push({ n, name: String(w.name || '').replace(/^EXP\s*\d+\s*·\s*/, ''), pic });
    // 🏠 2026-10-18 («Mi Dralingo» part 3): a few more word pictures of that world for the home's «1 Palabras» step,
    // under neutral names too (/ruta-exp/<level>/<n>-<k>.webp); kept apart, so /api/ruta-dorada stays as light as before
    const peek = [];
    words.concat(files.map((f) => f.replace(/\.webp$/, ''))).forEach((x) => {
      if (peek.length >= HOME_PEEK || x === img || peek.includes(x) || !files.includes(x + '.webp')) return;
      peek.push(x);
    });
    _rutaExpPeek[slug + '/' + n] = peek.map((x, k) => {
      const file = path.join(__dirname, 'public', 'assets', 'packs', slug, w.id, x + '.webp');
      let v = '0';
      try { v = require('crypto').createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 8); } catch (_) { /* listed above */ }
      _rutaExpFiles[slug + '/' + n + '-' + (k + 1)] = file;
      return '/ruta-exp/' + slug + '/' + n + '-' + (k + 1) + '.webp?v=' + v;
    });
    _rutaExpWorld[slug + '/' + n] = w.id;
  });
  _rutaExpsCache[l] = out;
  return out;
}
// a kid's marks → { id: { h: 1, s: 1 } } (what is set only; the moments stay on the record), for `ids` or all of them
function _tareaMarks(rec, ids) {
  const t = rec && rec.tareas && typeof rec.tareas === 'object' && !Array.isArray(rec.tareas) ? rec.tareas : {};
  const out = {};
  (ids || Object.keys(t)).forEach((id) => {
    const e = Object.prototype.hasOwnProperty.call(t, id) ? t[id] : null;
    if (e && (e.h || e.s)) out[id] = Object.assign({}, e.h ? { h: 1 } : {}, e.s ? { s: 1 } : {});
  });
  return out;
}
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 🆕 2026-10-18 · AUTOMATIC STUDENT ACCOUNTS (his words: "sometimes it's really hard for people to make an account so make
// the system automatically give them an account and the option to also put their name… if they directly click on La Ruta
// Dorada without being a student then they automatically should keep that code forever")
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// WHEN: a visitor with no student session gets a real account at their first REAL step on La Ruta Dorada, never on a page
// view (bots, link previews, a whole class opening a link make nothing). The page asks POST /api/ruta/auto right after:
//   'key'   the level's key typed right (protected/pages/level-key.html)        · the level open on this device
//   'seal'  the first «¡Me la sé!» (js/audios-base.js)                           · the level open
//   'train' the first El Entrenamiento round («¡A jugar!», js/audios.js)          · the level open
//   'tarea' the first «¡Ya la mandé!» (js/ruta.js; never the «Escuchada» of a play) · a homework id of the audio catalog
//                                                                                   + a device already seen (dkd)
// (a phone that remembers a /homework login logs that kid in again first, js/ruta-auto.js, unless that kid tapped
// «Salir» there: localStorage dralyHwOut, cleared by the next «Entrar». No duplicate for real kids, no sibling on them.)
// THE ACCOUNT: Students.createAuto: the same record shape as a /homework login, a SIX-character code of the same alphabet
// with a digit (security review M3: nothing else binds an unclaimed account), `auto: true`, level = the module's (its
// key's), a friendly placeholder name («Dragoncito 382»: never «Anon», never the code, since names show on rosters and
// projectors), NO class code (no safe default: a level's class codes belong to teachers; see CLAIM).
// THE PHONE KEEPS IT: the same signed session as a login (dsim, 12 h) + `dauto` (httpOnly, signed, a year: the code, parked
// or not, and the account's firstSeen, so a code handed out again never answers to an old cookie) = "this device holds
// automatic account X". While X is live, unclaimed, never merged and not parked, any request renews the session
// (_autoRenew, mounted right after express.json: a reload, a new tab, the home-screen app keep the same account); a page
// view never counts as activity and never wakes an archived one. One per device: never a second one by itself.
// A readable cookie `draly_auto_new` asks the page to show «¡Ya tienes tu cuenta de Dralingo!» once.
// CLAIM: an UNCLAIMED automatic account answers at /homework ONLY on the device holding its dauto (security review M3):
// there its code + a real class code takes it (tagged, a session; `auto` stays as its origin, the roster's «automática»
// goes) and the device cookie is dropped. Anywhere else its code counts as a wrong code (the same answer, the same miss).
// A PIN room never tags one (core/student-records.js). A teacher still finds it in /maestro.
// PARK: «Salir» at /homework, or a /homework login to ANOTHER account on this device, parks it: no renewal, and a later
// step NEVER resumes it by itself (security review M2: a sister on the same phone): /api/ruta/auto answers
// `why: 'parked'` with the account's «Mi código» summary, the page asks «¿Eres tú?» and only «Sí, soy yo» resumes it
// (POST /api/ruta/auto/resume); «No, soy otro alumno» keeps that step on the phone, and the next step asks for a new
// account (`fresh: true`), which then becomes this device's account.
// MERGE («Pasar mi progreso a esta cuenta», the /homework «¿Eres tú?» card): BOTH proofs on this device, the automatic
// account (dauto) AND a /homework login to the other account (its session, from that kid's own class code). Seals and
// homework marks join (a union), each El Entrenamiento world keeps the best %, and its exam tries and homework rounds MOVE
// into the real account (L3: an exam taken in a room never disappears); never the typed account's own tries, levels or
// teacher data. The automatic account then rests in the archive (mergedInto: never resumed or merged again).
// LIMITS: 120 new accounts an hour per address (two classes on one school Wi-Fi), 3 a day per device (dkd), 300 an hour
// for the platform; a request from another site (Origin, Sec-Fetch-Site) is refused. An automatic account nobody ever
// used is removed when it goes stale (core/student-records.js archiveInactive); one with progress rests in the archive.
// Test: scripts/test-auto-account.js.
const AUTO_COOKIE = 'dauto';
const AUTO_TTL = 365 * 24 * 3600e3;
const AUTO_STEPS = ['key', 'seal', 'train', 'tarea'];
// usable as this device's automatic account: made by the system, not claimed by a class code, never merged away
const _autoUnclaimed = (rec) => !!(rec && rec.auto && !rec.classroomCode && !rec.mergedInto);
function _autoCookie(req) {
  const v = SimLock.verify(SimLock.readCookie(req, AUTO_COOKIE), 'A');
  return v && /^[A-Z2-9]{4,6}$/.test(v[0]) && v.length >= 3 ? { code: v[0], parked: v[1] === '1', born: String(v[2] || '') } : null;
}
// the device cookie's account, only when it is that very account (the same firstSeen: L2) → { rec, archived } | null
function _autoHeld(a) {
  const p = a ? Students.peek(a.code) : null;
  return p && String(Number(p.rec.firstSeen) || 0) === a.born ? p : null;
}
const _autoSetCookie = (req, res, rec, parked) => SimLock.setCookie(req, res, AUTO_COOKIE,
  SimLock.sign('A', [rec.code, parked ? '1' : '0', String(Number(rec.firstSeen) || 0)], AUTO_TTL), AUTO_TTL);
const _autoDropCookie = (req, res) => SimLock.setCookie(req, res, AUTO_COOKIE, '', 0);
// does THIS device hold `rec` (an automatic account) through its dauto?
const _autoDeviceHolds = (req, rec) => { const a = _autoCookie(req); return !!(a && rec && a.code === rec.code && _autoHeld(a)); };
// a cookie this same request reads from now on (the handlers after us see the renewed session)
function _autoReqCookie(req, name, value) {
  const keep = String((req.headers && req.headers.cookie) || '').split(';').map((x) => x.trim()).filter((x) => x && x.split('=')[0] !== name);
  keep.push(name + '=' + value);
  req.headers.cookie = keep.join('; ');
}
function _autoSession(req, res, rec) {
  const tok = SimLock.setSession(req, res, 's', rec.code, LevelKeys.classLevel(rec) || Levels.DEFAULT);
  if (tok) _autoReqCookie(req, SimLock.COOKIE, tok);
}
// a page of ours, never another site (a link preview or a bot never POSTs from our page)
function _autoSameSite(req) {
  const site = String((req.headers && req.headers['sec-fetch-site']) || '');
  if (site && site !== 'same-origin') return false;
  return _socketOriginOk(req);
}
const _autoHits = new Map();   // '*' | 'i:<ip>' | 'd:<device>' | 'n:<code>' | 'm:<ip>' | 'g:<ip>' | 'r:<ip>' → [timestamps]
function _autoHit(key, win, max, dry) {
  const now = Date.now();
  const arr = (_autoHits.get(key) || []).filter((t) => now - t < win);
  _autoHits.set(key, arr);
  if (arr.length >= max) return false;
  if (!dry) arr.push(now);
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _autoHits) if (!v.length || now - v[v.length - 1] > 25 * 3600e3) _autoHits.delete(k);
  if (_autoHits.size > 50000) _autoHits.clear();
}, 10 * 60 * 1000).unref();
// a new account here? (120 an hour per address, 3 a day per device, 300 an hour for everyone) → false = wait
function _autoRateOk(req, res) {
  const ip = 'i:' + _clientIp(req), dev = 'd:' + LevelKeys.deviceId(req, res);
  if (!_autoHit('*', 3600e3, 300, true) || !_autoHit(ip, 3600e3, 120, true) || !_autoHit(dev, 86400e3, 3, true)) return false;
  _autoHit('*', 3600e3, 300); _autoHit(ip, 3600e3, 120); _autoHit(dev, 86400e3, 3);
  return true;
}
// a device the platform has seen before (its dkd id, given by /api/ruta-dorada, a key, a training round)
const _autoKnownDevice = (req) => /^[a-f0-9]{24}$/.test(SimLock.readCookie(req, LevelKeys.DEVICE_COOKIE));
// «Dragoncito 382»: friendly, never a real kid's name, never the code (rosters and projectors show names)
const _autoPlaceholder = () => 'Dragoncito ' + (100 + require('crypto').randomInt(900));
// a name typed for the kid: letters (accents too), spaces, an apostrophe or a dash; 2-24 characters; never the code
function _autoCleanName(raw, code) {
  const s = String(raw == null ? '' : raw).normalize('NFC').replace(/\s+/g, ' ').trim();
  if (s.length < 2 || s.length > 24) return null;
  if (!/^[\p{L}][\p{L}' -]*$/u.test(s)) return null;
  if (/^anon(imo|ymous)?$/i.test(s) || /^dragoncito\b/i.test(s) || s.toUpperCase().replace(/\s/g, '') === String(code || '')) return null;
  return s;
}
// what the page may know about the account this phone holds (only ever sent to that phone): its code («Mi código»),
// its name (or the placeholder), its own class code (L6: «Sí, soy yo» logs in with it, never with another one) and, for
// an automatic account still wearing the system's placeholder name («Dragoncito NNN», or none): nobody's name yet
const _autoNameless = (rec) => !!rec && (!rec.displayName || (!!rec.autoName && /^Dragoncito \d{3}$/.test(rec.displayName)));
// «¿Eres tú?», a few counts of its progress
function _autoMeOf(rec, withProgress) {
  if (!rec) return null;
  const lvl = LevelKeys.classLevel(rec);
  // (placeholder: the name the system gave it, still there; a name typed since, even in a PIN room, is the kid's)
  const out = { code: rec.code, name: rec.displayName || '', placeholder: !rec.displayName || (!!rec.autoName && /^Dragoncito \d{3}$/.test(rec.displayName)), auto: _autoUnclaimed(rec), byKey: !!rec.byKey,
    who: _sealWho(rec.code), level: lvl ? (Levels.info(lvl).pack || lvl) : null, levelName: lvl ? Levels.info(lvl).name : null,
    classroomCode: rec.classroomCode || null };
  if (withProgress) {
    let seals = 0, worlds = 0;
    Object.keys(rec.ruta && typeof rec.ruta === 'object' ? rec.ruta : {}).forEach((l) => {
      if (RutaProgress.baseOf(l)) seals += RutaProgress.sealsOf(rec, l).size;
      const p = rec.ruta[l] && rec.ruta[l].p;
      if (p && typeof p === 'object') worlds += Object.keys(p).length;
    });
    const t = rec.tareas && typeof rec.tareas === 'object' ? Object.values(rec.tareas) : [];
    const sent = t.filter((e) => e && e.s).length, heard = t.filter((e) => e && e.h).length;
    const tries = Array.isArray(rec.hskResults) ? rec.hskResults.length : 0;
    const homework = Array.isArray(rec.assignmentSubmissions) ? rec.assignmentSubmissions.length : 0;
    // (security check N1: sentences built and reading tries are a kid's progress too)
    const sentences = Array.isArray(rec.sentencesBuilt) ? rec.sentencesBuilt.length : 0;
    const reads = Array.isArray(rec.testResults) ? rec.testResults.length : 0;
    out.progress = { seals, sent, heard, worlds, tries, homework, sentences, reads, any: seals + heard + worlds + tries + homework + sentences + reads > 0 };
  }
  return out;
}
// every request (mounted right after express.json): an automatic account's session comes back from its device cookie
// (pages and API only, cheap check)
function _autoRenew(req, res, next) {
  const raw = String((req.headers && req.headers.cookie) || '');
  if (raw.indexOf(AUTO_COOKIE + '=') < 0 || !/^\/(api\/|audios?(\/|$)|base-media\/|golden-media\/|yct-sim|hsk-sim)/.test(req.path)) return next();
  try {
    const s = SimLock.session(req);
    if (s && Students.peek(s.code)) return next();            // a session already (this kid, or another kid's login)
    const a = _autoCookie(req);
    if (!a || a.parked) return next();
    const p = _autoHeld(a);
    if (!p || p.archived || !_autoUnclaimed(p.rec)) return next();
    _autoSession(req, res, p.rec);
  } catch (e) { console.warn('[auto] renew failed:', e.message); }
  next();
}
// M3: an UNCLAIMED automatic account's code at /homework from a device that does not hold it → treated as a code that
// does not exist (the caller counts the miss and answers like a wrong code). → true = refuse it
function _autoLoginRefused(req, code) {
  const p = code ? Students.peek(code) : null;
  // (2026-10-18, la entrada: an account made with the level key never logs in with a class code: its code + the key)
  return !!(p && ((_autoUnclaimed(p.rec) && !_autoDeviceHolds(req, p.rec)) || p.rec.byKey));
}
// /api/homework/enter, the key screen's silent login: a login on a device holding an automatic account. Its own code
// with a class code = the claim (the device cookie goes: a normal account now); another kid's own login = that kid is
// on this phone now (parked).
function _autoAfterLogin(req, res, rec, owns) {
  _kidAfterLogin(req, res, rec, owns);   // 🆕 2026-10-18 (la entrada): another kid's login parks the kid this phone remembers
  try {
    const a = _autoCookie(req);
    if (!a || !owns || !rec) return;
    const p = _autoHeld(a);
    if (!p || a.code === rec.code) { _autoDropCookie(req, res); return; }
    if (!a.parked) _autoSetCookie(req, res, p.rec, true);
  } catch (e) { console.warn('[auto] after login:', e.message); }
}
// /api/homework/logout («Salir»): the device's automatic account rests: no renewal, and no step resumes it by itself
function _autoPark(req, res) {
  try { const a = _autoCookie(req); const p = _autoHeld(a); if (a && p && !a.parked) _autoSetCookie(req, res, p.rec, true); } catch (_) { /* ignore */ }
}
// POST /api/ruta/auto { level, step: 'key'|'seal'|'train'|'tarea', id?, fresh? } → { ok, created, resumed?, account } |
// { ok: false, why: 'teacher' | 'key' | 'device' | 'login' | 'rate' | 'site' } | { ok: false, why: 'parked', account }
// fresh: true = «No, soy otro alumno» was the answer to this device's parked account: a new account for this kid
app.post('/api/ruta/auto', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (!_autoSameSite(req)) return res.status(403).json({ ok: false, why: 'site' });
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  const step = AUTO_STEPS.includes(b.step) ? b.step : null;
  let level = Levels.normalize(b.level);
  const tid = step === 'tarea' ? _tareaId(b.id) : null;
  if (tid && !level) level = Levels.normalize(_loadAudioHomeworks().get(tid));
  if (!step || !level || (step === 'tarea' && !tid)) return res.status(400).json({ ok: false, error: 'Paso no válido.' });
  if (_teacherOf(req)) return res.json({ ok: false, why: 'teacher' });
  const cur = _studentOf(req);
  if (cur) return res.json({ ok: true, created: false, account: _autoMeOf(cur) });
  if (step !== 'tarea' && !LevelKeys.access(req, level).ok) return res.status(401).json({ ok: false, why: 'key' });
  // (L4) the open homework pages: only a device the platform has already seen (its page set dkd), never a bare POST
  if (step === 'tarea' && !_autoKnownDevice(req)) return res.status(403).json({ ok: false, why: 'device' });
  const a = _autoCookie(req);
  const held = _autoHeld(a);
  if (held && _autoUnclaimed(held.rec)) {
    // this device's own account, parked («Salir», another kid's login): never resumed by itself (M2), unless this
    // phone said «No, soy otro alumno» (fresh): then a new account for this kid, below
    if (a.parked && !b.fresh) return res.json({ ok: false, why: 'parked', account: _autoMeOf(held.rec, true) });
    if (!a.parked) {
      const old = Students.get(a.code);                          // (a real step: an archived one comes back)
      _autoSession(req, res, old);
      return res.json({ ok: true, created: false, resumed: true, account: _autoMeOf(old) });
    }
  } else if (held && held.rec.classroomCode && !held.rec.mergedInto) {
    return res.json({ ok: false, why: 'login' });                // claimed by a class code since: it logs in at /homework
  }
  if (!_autoRateOk(req, res)) return res.status(429).set('Retry-After', '120').json({ ok: false, why: 'rate', error: 'Espera un momento.' });
  const rec = Students.createAuto(_autoPlaceholder(), level, step);
  _autoSession(req, res, rec);
  _autoSetCookie(req, res, rec, false);
  res.append('Set-Cookie', 'draly_auto_new=1; Path=/; Max-Age=86400; SameSite=Lax' + (SimLock.https(req) ? '; Secure' : ''));
  console.log('[auto] an automatic account was made (' + step + ', ' + level + (b.fresh ? ', another kid on a phone that had one' : '') + ')');   // (never its code)
  res.json({ ok: true, created: true, account: _autoMeOf(rec) });
});
// POST /api/ruta/auto/resume → { ok, resumed, account } | { ok: false, why: 'auto' }: «¿Eres tú? Sí, soy yo» for this
// device's parked automatic account (the only way back to it after «Salir»)
app.post('/api/ruta/auto/resume', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (!_autoSameSite(req)) return res.status(403).json({ ok: false, why: 'site' });
  if (!_autoHit('r:' + _clientIp(req), 60 * 1000, 30)) return res.status(429).set('Retry-After', '30').json({ ok: false, error: 'Espera un momento.' });
  if (_teacherOf(req)) return res.json({ ok: false, why: 'teacher' });
  const a = _autoCookie(req);
  const held = _autoHeld(a);
  if (!held || !_autoUnclaimed(held.rec)) return res.status(403).json({ ok: false, why: 'auto', error: 'Este teléfono no tiene una cuenta automática.' });
  const rec = Students.get(a.code);                              // (an archived one comes back: the kid said it is theirs)
  _autoSession(req, res, rec);
  if (a.parked) _autoSetCookie(req, res, rec, false);
  res.json({ ok: true, resumed: true, account: _autoMeOf(rec) });
});
// GET /api/ruta/me → { ok, account: null | { code, name, placeholder, auto, who, level, levelName, classroomCode,
// progress, session, parked?, archived? } }: the account this phone holds (its login, else its automatic account, parked
// or resting in the archive: never woken by this read). For «Mi código» and the «¿Eres tú?» cards.
app.get('/api/ruta/me', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (!_autoHit('m:' + _clientIp(req), 5 * 60 * 1000, 4000)) return res.status(429).set('Retry-After', '30').json({ ok: false, error: 'Espera un momento.' });
  const s = SimLock.session(req);
  const live = s ? Students.peek(s.code) : null;
  if (live && !live.archived) return res.json({ ok: true, account: Object.assign(_autoMeOf(live.rec, true), { session: true }) });
  const a = _autoCookie(req);
  const p = _autoHeld(a);
  if (p && _autoUnclaimed(p.rec)) return res.json({ ok: true, account: Object.assign(_autoMeOf(p.rec, true), { session: false, parked: a.parked, archived: p.archived }) });
  res.json({ ok: true, account: null });
});
// POST /api/ruta/me/name { name } → { ok, account }: the kid's real name, for the account this phone is logged in as
app.post('/api/ruta/me/name', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (!_autoSameSite(req)) return res.status(403).json({ ok: false, why: 'site' });
  const rec = _studentOf(req);
  if (!rec) return res.status(403).json({ ok: false, error: 'Entra con tu código.' });
  if (!_autoHit('n:' + rec.code, 60 * 1000, 20)) return res.status(429).set('Retry-After', '30').json({ ok: false, error: 'Espera un momento.' });
  const name = _autoCleanName((req.body || {}).name, rec.code);
  if (!name) return res.status(400).json({ ok: false, error: 'Escribe tu nombre con letras (de 2 a 24).' });
  Students.setRealName(rec.code, name);
  res.json({ ok: true, account: _autoMeOf(Students.get(rec.code)) });
});
// the automatic account's progress joins `to`: a union of seals and homework marks, the best % per practice world, and
// its exam tries + homework rounds moved over (L3); nothing else of either account changes → the counts that moved
function _autoMerge(from, to) {
  const out = { seals: 0, worlds: 0, heard: 0, sent: 0, tries: 0, homework: 0 };
  // 🪙 2026-10-19 El Zoco: the automatic account's coins and characters join the real account FIRST, and everything it
  // did counts as done there (the seals, practices and homework moving in below never pay a second time)
  try { Students.updateZoco(to.code, (t) => { const z = Zoco.merge(from, t, _zocoEnv()); out.coins = z.c; out.skins = z.own; return true; }); }
  catch (e) { console.warn('[zoco] merge failed:', e.message); }
  const ruta = from.ruta && typeof from.ruta === 'object' && !Array.isArray(from.ruta) ? from.ruta : {};
  Object.keys(ruta).forEach((lvl) => {
    if (!Levels.normalize(lvl)) return;
    if (RutaProgress.baseOf(lvl)) {
      const mine = RutaProgress.sealsOf(to, lvl);
      const add = [...RutaProgress.sealsOf(from, lvl)].filter((n) => !mine.has(n));
      if (add.length && RutaProgress.applySeals(to.code, lvl, add, []).ok) out.seals += add.length;
    }
    const p = ruta[lvl] && ruta[lvl].p;
    if (p && typeof p === 'object' && !Array.isArray(p)) {
      Object.keys(p).forEach((w) => { if (RutaProgress.recordPractice(to.code, lvl, w, p[w]).ok) out.worlds++; });
    }
  });
  const t = from.tareas && typeof from.tareas === 'object' && !Array.isArray(from.tareas) ? from.tareas : {};
  const ids = Object.keys(t).filter((id) => _tareaId(id) === id && t[id] && (t[id].h || t[id].s));
  if (ids.length) {
    Students.updateTareas(to.code, (all) => {
      ids.forEach((id) => {
        const e = t[id];
        const x = Object.prototype.hasOwnProperty.call(all, id) && all[id] && typeof all[id] === 'object' ? all[id] : (all[id] = {});
        if (e.h && !x.h) { x.h = e.h; out.heard++; }
        if (e.s && !x.s) { x.s = e.s; if (!x.h) x.h = e.s; out.sent++; }
      });
    }, { activity: true });
  }
  const moved = Students.moveResults(from.code, to.code);
  out.tries = moved.tries;
  out.homework = moved.homework;
  return out;
}
// POST /api/ruta/auto/merge → { ok, merged: { seals, worlds, heard, sent, tries, homework }, account } |
// { ok: false, why: 'auto' | 'login' }
// «Pasar mi progreso a esta cuenta»: this device's automatic account (dauto) into the account just logged in at /homework
app.post('/api/ruta/auto/merge', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (!_autoSameSite(req)) return res.status(403).json({ ok: false, why: 'site' });
  if (!_autoHit('g:' + _clientIp(req), 3600e3, 20)) return res.status(429).set('Retry-After', '120').json({ ok: false, error: 'Espera un momento.' });
  const a = _autoCookie(req);
  const p = _autoHeld(a);
  if (!p || !_autoUnclaimed(p.rec)) return res.status(403).json({ ok: false, why: 'auto', error: 'Este teléfono no tiene una cuenta automática.' });
  const to = _studentOf(req);
  if (!to || to.code === p.rec.code || !to.classroomCode) return res.status(403).json({ ok: false, why: 'login', error: 'Entra con tu código primero.' });
  const from = Students.get(a.code);                            // (an archived one comes back to be merged)
  const merged = _autoMerge(from, to);
  const arch = Students.archiveOne(from.code, { mergedInto: to.code, mergedAt: Date.now(), archivedWhy: 'merged into a class account' });
  if (arch.error) console.warn('[auto] merged, but the automatic account stays live:', arch.error);
  _autoDropCookie(req, res);
  console.log('[auto] an automatic account was merged into a class account (' + merged.seals + ' seals, ' + merged.sent + ' sent, ' + merged.tries + ' tries)');
  res.json({ ok: true, merged, account: _autoMeOf(Students.get(to.code), true) });
});
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 🆕 2026-10-18 · «MI DRALINGO», PART 1: LA ENTRADA. His pick: "the level key is the family's one password" (he asked for
// something easy that is still password-protected and places kids in their level from home, without a teacher's approval)
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// /homework opens on the entrance (public/js/entrada.js, his approved design «Entrada», states hola · quien · clave · nivel
// · codigo · tengo):
//   hola    this phone remembers a kid: «¡Hola de nuevo!» → «¡Vamos!», nothing to type. Remembered = a live session, the
//           phone's `dkid` (below), its unparked automatic account once it has a name (dauto), or the OLD saved class code
//           + student code of today's families (POST /api/entrada/hola checks them like a login; «¡Vamos!» then logs in
//           with them exactly as the old card did: no family is locked out)
//   quien   «Ya tengo mi código» · «Soy nuevo»
//   clave → nivel → codigo   «Soy nuevo»: the level key from the teacher's WhatsApp (it tells the level: «¡Tu nivel es New
//           HSK 1!»), a name + a saga avatar, «Crear mi cuenta» → the six-character code («anótalo», «Copiar») → «¡Vamos!»
//           (the portal home). A phone holding an unclaimed automatic account turns THAT account into the kid's (its
//           progress is never split; a parked one asks «¿Eres tú?» first)
//   tengo   «Ya tengo mi código»: the student code (4 to 6 characters: old accounts too) AND the level key
//   the transitional door «¿Tu profe te dio un código de 4 números? Entra aquí»: the old class code + student code form
//           (/api/homework/enter, unchanged) for families without a key yet; he removes it once every family has its key
// THE ACCOUNT (`byKey`, core/student-records.js createByKey / claimByKey): no class code, six characters with a digit, the
// key's level open on the account (a key grant with its gen: «Cerrar en todos los aparatos» still ends it) and on the
// device. It answers ONLY to its own session, the phone holding it, or its code + the key of a level it has: never to a
// class code + its code (_hwOwnsStudent, _autoLoginRefused). The code alone never opens an account on a new phone.
// THE PHONE KEEPS IT: `dkid` (httpOnly, signed 'K', a year: the code, parked or not, the account's firstSeen, its level
// + that level's key generation, its kidGen: F2 below) = "this phone
// holds kid X", for every account made or entered here (the dauto idea); _kidRenew renews the 12 h session from it (a page
// view never wakes an archived account). One kid per phone: a new account or a login here takes the cookie. «Salir»
// parks it (/api/homework/logout: no «¡Hola de nuevo!», no renewal, until the kid comes in again with code + key), and so
// does another kid's login on this phone (_autoAfterLogin).
// HOMEWORK without a class code: _hwCheckAccess takes the kid's session as the pass (the page sends no class code) and
// _hwOwnsStudent the kid's own session; the HSK 1 trainer reads the session's level (_hwReqLevel).
// A TEACHER: a key account that joins a teacher's PIN room (player:join), proven by that phone's own cookies (its session
// or dkid: a typed code alone never moves a kid into a class), takes the room owner's class code for its level
// (core/teachers.js codeLevels), so it shows on that teacher's /maestro roster. Never an unclaimed automatic account
// (security review M3). Until then only the super admin sees it (the roster's «con clave» tag).
// LIMITS: a wrong key counts on the key screen's counters (LevelKeys.noteWrong: 5 per phone + 30 per address in 15 min);
// a wrong code + key pair counts there AND as an unknown student code (60 per address in 10 min, 600 an hour for all);
// old saved codes that no longer match count like a login miss; «¡Hola de nuevo!» and «¡Vamos!» 600 a minute per address
// (a school's Wi-Fi never waits); new accounts 120 an hour per address, 5 a day per phone, 300 an hour for the platform.
// Requests from other sites are refused (_autoSameSite). One uniform line for a wrong pair
// («El código o la clave no coinciden»): it never says which of the two was wrong, nor whether a code exists.
// SECURITY REVIEW (2026-10-18, on top of the merge):
//   F1 «Soy nuevo» takes the phone's automatic account only after «Sí, soy yo» (resume) or when it is empty and nameless;
//      «¿No eres tú?» always makes a fresh account
//   F2 dkid carries the level's key generation and the kid's kidGen: «Cerrar en todos los aparatos» → type the new key
//      (/reabrir); «Cerrar su sesión en todos los teléfonos» (/maestro) → sessions and phones end, code + key again
//   F3 /entrar: a wrong key is a key guess only; a wrong code with a right key counts per phone, per address and in its
//      own platform bucket (never the old form's)
//   F4 a parked key account never shows its code (name + avatar); «Salir» forgets the code on a key kid's phone
//   F5 /entrar never opens an unclaimed automatic account away from its phone (M3)
// Test: scripts/test-entrada.js.
const KID_COOKIE = 'dkid';
const KID_TTL = 365 * 24 * 3600e3;
const ENTRADA_BAD_KEY = 'Esa clave no es. Revísala en el mensaje de tu profe.';
const ENTRADA_BAD_PAIR = 'El código o la clave no coinciden. Revísalos y vuelve a intentarlo.';
const _entradaWaitMsg = (wait) => 'Ya fueron muchos intentos. Espera ' + wait + (wait === 1 ? ' minuto' : ' minutos') + ' y vuelve a intentarlo.';
// 🔒 2026-10-18 (security review F2) dkid can be revoked: it also carries the account's level + that level's key
// generation (`lg`, «Cambiar» + «Cerrar en todos los aparatos» bump it) and the account's `kidGen` (`kg`, /maestro
// «Cerrar su sesión en todos los teléfonos»). A level generation that moved = «Este teléfono te recuerda: escribe la
// clave nueva de tu nivel» (the key only, POST /api/entrada/reabrir); a kidGen that moved = like parked: code + key.
// (req or a socket's handshake) → { code, parked, born, lg, kg } | null
function _kidCookie(reqOrHs) {
  const v = SimLock.verify(SimLock.readCookie(reqOrHs, KID_COOKIE), 'K');
  return v && /^[A-Z2-9]{4,6}$/.test(v[0]) && v.length >= 3
    ? { code: v[0], parked: v[1] === '1', born: String(v[2] || ''), lg: String(v[3] || ''), kg: String(v[4] || '0') } : null;
}
// the cookie's account, only when it is that very account (the same firstSeen) and never merged away → { rec, archived } | null
function _kidHeld(k) {
  const p = k ? Students.peek(k.code) : null;
  return p && !p.rec.mergedInto && String(Number(p.rec.firstSeen) || 0) === k.born ? p : null;
}
// the account's level and its key generation now ('hsk2:1'), and its kidGen ('0')
const _kidLg = (rec) => { const l = LevelKeys.classLevel(rec) || Levels.DEFAULT; return l + ':' + LevelKeys.genOf(l); };
const _kidKg = (rec) => String(Number(rec && rec.kidGen) || 0);
// 'ok' (this phone holds the kid) · 'key' (the level's key changed since: type the new key) · 'out' (parked, or the
// kid's sessions were closed: code + key) · null (no such account)
function _kidState(k, p) {
  if (!k || !p) return null;
  if (k.parked || k.kg !== _kidKg(p.rec)) return 'out';
  return k.lg === _kidLg(p.rec) || _kidLgMoved(k, p.rec) ? 'ok' : 'key';
}
// 🆕 2026-10-22 «Change level» (/maestro): a teacher moved the kid to another level; the phone's dkid still names the
// level it came in with. It still holds the kid (never the key screen, never «¿Eres tú?») while that level's key
// generation is the one it carries (nothing was closed since) and a teacher moved the kid away from that level
// (rec.levelBy.from). The cookie is re-issued for the new level at the next answer (_kidFollow).
// (review 2026-10-22: only while that change is still the account's state, _levelBound, and the NEW level's key generation
// is still the one at the change: a «Cerrar en todos los aparatos» of either level ends a phone that hasn't followed yet.
// Once followed, the phone is the new level's like any phone that typed it: «Abrir otro nivel» re-issues it the same way)
function _kidLgMoved(k, rec) {
  const lb = rec && rec.levelBy;
  if (!k || !lb || !Array.isArray(lb.from) || !lb.from.length || !_levelBound(rec)) return false;
  if (String(LevelKeys.genOf(lb.to)) !== String(Number(lb.toGen) || 1)) return false;
  const i = String(k.lg || '').lastIndexOf(':');
  const lvl = i > 0 ? Levels.normalize(k.lg.slice(0, i)) : null;
  return !!(lvl && lb.from.includes(lvl) && String(LevelKeys.genOf(lvl)) === k.lg.slice(i + 1));
}
// the phone's dkid named the level before a teacher's change: re-issued now for the kid's level (same kid, same phone)
function _kidFollow(req, res) {
  try {
    const k = _kidCookie(req);
    const p = _kidHeld(k);
    if (k && p && !k.parked && k.lg !== _kidLg(p.rec) && _kidState(k, p) === 'ok') _kidSetCookie(req, res, p.rec, false);
  } catch (_) { /* the old cookie keeps working */ }
}
function _kidSetCookie(req, res, rec, parked) {
  SimLock.setCookie(req, res, KID_COOKIE, SimLock.sign('K', [rec.code, parked ? '1' : '0', String(Number(rec.firstSeen) || 0), _kidLg(rec), _kidKg(rec)], KID_TTL), KID_TTL);
}
// does THIS phone hold `rec` (not parked, nothing closed since)?
function _kidDeviceHolds(req, rec) {
  const k = _kidCookie(req);
  return !!(k && rec && k.code === rec.code && _kidState(k, _kidHeld(k)) === 'ok');
}
// the logged-in kid of a homework call (their session): the pass when the page sends no class code
function _entradaSessionKid(req) { return _studentOf(req); }
// does this request's own kid (its session, or this phone's dkid) own `rec`? (_hwOwnsStudent asks it first)
function _entradaOwns(req, rec) {
  if (!rec) return false;
  const s = SimLock.session(req);
  if (s && s.kind === 's' && s.code === rec.code) return true;
  return _kidDeviceHolds(req, rec);
}
// every request (mounted right after _autoRenew): the remembered kid's session comes back from dkid (pages and API only)
function _kidRenew(req, res, next) {
  const raw = String((req.headers && req.headers.cookie) || '');
  if (raw.indexOf(KID_COOKIE + '=') < 0 || !/^\/(api\/|audios?(\/|$)|base-media\/|golden-media\/|yct-sim|hsk-sim)/.test(req.path)) return next();
  try {
    const s = SimLock.session(req);
    if (s && Students.peek(s.code)) return next();              // a session already (this kid, or another kid's login)
    const k = _kidCookie(req);
    const p = _kidHeld(k);
    if (!p || _kidState(k, p) !== 'ok' || p.archived || _autoUnclaimed(p.rec)) return next();
    _autoSession(req, res, p.rec);                              // the same session as a login, read by this request too
    if (k.lg !== _kidLg(p.rec)) _kidSetCookie(req, res, p.rec, false);   // (2026-10-22: a teacher changed the kid's level)
  } catch (e) { console.warn('[entrada] renew failed:', e.message); }
  next();
}
// «Salir» on /homework: the kid this phone remembers rests (no «¡Hola de nuevo!», no renewal)
function _kidPark(req, res) {
  try { const k = _kidCookie(req); const p = _kidHeld(k); if (k && p && !k.parked) _kidSetCookie(req, res, p.rec, true); } catch (_) { /* ignore */ }
}
// a login to ANOTHER account on this phone (the old form, the key screen's silent login): the remembered kid rests
function _kidAfterLogin(req, res, rec, owns) {
  try {
    const k = _kidCookie(req);
    if (!k || !owns || !rec || k.code === rec.code || k.parked) return;
    const p = _kidHeld(k);
    if (p) _kidSetCookie(req, res, p.rec, true);
  } catch (_) { /* ignore */ }
}
// a new account here? (120 an hour per address, 5 a day per phone: brothers and sisters, 300 an hour for everyone)
function _entradaRateOk(req, dev) {
  const ip = 'ki:' + _clientIp(req), d = 'kd:' + dev;
  if (!_autoHit('k*', 3600e3, 300, true) || !_autoHit(ip, 3600e3, 120, true) || !_autoHit(d, 86400e3, 5, true)) return false;
  _autoHit('k*', 3600e3, 300); _autoHit(ip, 3600e3, 120); _autoHit(d, 86400e3, 5);
  return true;
}
// the level key typed here → { level, ip, dev }, or null with the answer already sent (a wait; nothing typed; a wrong key
// = one uniform line and a counted guess, the key screen's counters)
function _entradaKey(req, res) {
  const ip = _clientIp(req);
  const dev = LevelKeys.deviceId(req, res);
  const wait = LevelKeys.guessWait(ip, dev);
  if (wait) { res.status(429).json({ ok: false, wait, error: _entradaWaitMsg(wait) }); return null; }
  const typed = String((req.body || {}).key || '').slice(0, 80);
  if (!LevelKeys.normalizeKey(typed)) { res.status(400).json({ ok: false, why: 'key', error: 'Escribe la clave de tu nivel.' }); return null; }
  const level = LevelKeys.levelOfKey(typed);
  if (!level) { LevelKeys.noteWrong(ip, dev); res.status(401).json({ ok: false, why: 'key', error: ENTRADA_BAD_KEY }); return null; }
  return { level, ip, dev };
}
const _entradaLevel = (lvl) => { const i = Levels.info(lvl); return { level: i.pack || i.id, levelId: i.id, levelName: i.name, family: i.family }; };
// what the entrance shows of an account (only ever to the phone that holds it): name, avatar, level and the experience it
// is on (the first La Base world not finished: its seals or the practice %; none before any progress)
function _entradaSummary(rec, how) {
  const lvl = LevelKeys.classLevel(rec) || Levels.DEFAULT;
  let exp = null;
  try {
    const st = RutaProgress.state(rec, lvl);
    if (st && st.worlds.length && (st.sealed > 0 || st.worlds.some((w) => w.practiced != null))) {
      const pct = RutaProgress.getSettings().doradoPct;
      const w = st.worlds.find((x) => x.sealed < x.count || !(x.practiced >= pct)) || st.worlds[st.worlds.length - 1];
      exp = { n: w.n, name: w.name };
    }
  } catch (_) { /* no experience line */ }
  return Object.assign({ name: rec.displayName || '', avatar: rec.avatar || null, exp, how }, _entradaLevel(lvl));
}
// a parked account of this phone, for «¿Eres tú?». An automatic account shows its code (its own «¿Eres tú?» design); a
// key account NEVER (security review F4: on a shared phone the next person must not learn it): name + avatar only
function _entradaParked(rec, kind) {
  const m = _autoMeOf(rec, true);
  const out = { kind, name: m.name, placeholder: m.placeholder, avatar: rec.avatar || null, progress: m.progress };
  if (kind === 'auto') out.code = m.code;
  return out;
}
// does the account have this level (its class level, or one opened on it)?
const _entradaHas = (r, l) => LevelKeys.classLevel(r) === l || !!(r && r.levelAccess && r.levelAccess[l]);
// 🔒 2026-10-18 (security review F3) /entrar's own counters for a wrong CODE with a right key: per phone (10 / 15 min),
// per address (the same 60 / 10 min as the homework lookups, _hwMisses) and its own bucket for the platform (600 / hour,
// never the old form's): a wrong key is a key guess only (LevelKeys.noteWrong), never a code guess
let _entradaMissAll = [];
function _entradaCodeBlocked(req, dev) {
  const now = Date.now();
  _entradaMissAll = _entradaMissAll.filter((t) => now - t < 3600e3);
  return _entradaMissAll.length >= 600 || _hwAddrMissBlocked(req) || !_autoHit('ec:' + dev, 15 * 60 * 1000, 10, true);
}
function _entradaCodeMiss(req, dev) {
  _hwAddrMiss(req);
  _autoHit('ec:' + dev, 15 * 60 * 1000, 10);
  _entradaMissAll.push(Date.now());
  if (_entradaMissAll.length === 600) console.warn('[security] 600 wrong codes with a right level key in one hour → code + key logins paused');
}
// the kid comes in on this phone: the key's level on the account and the device, the session, and dkid (one kid per
// phone: a different automatic account here rests, its own cookie goes once it is this account)
function _entradaIn(req, res, rec, level, dev) {
  Students.setLevelAccess(rec.code, level, 'key', LevelKeys.genOf(level));
  LevelKeys.rememberDevice(req, res, level);
  LevelKeys.clearDevice(dev);
  const a = _autoCookie(req);
  const ap = _autoHeld(a);
  if (a && (!ap || a.code === rec.code)) _autoDropCookie(req, res);
  else if (ap && !a.parked) _autoSetCookie(req, res, ap.rec, true);
  _autoSession(req, res, Students.get(rec.code));
  _kidSetCookie(req, res, rec, false);
  _kidTz(req, rec);
}
// (review 2026-10-18) the phone's time zone from la entrada's POSTs, for the kid it just let in: «N días seguidos» on
// their own calendar (core/student-records.js setTz: a known IANA zone, stored only when it changed)
function _kidTz(req, rec) {
  const tz = req.body && typeof req.body.tz === 'string' ? req.body.tz : '';
  if (tz && rec && rec.code) Students.setTz(rec.code, tz);
}
// the same answer as /api/homework/enter, for the portal home (today's; part 3 replaces it). keyMode: the page sends no
// class code (the session is the pass); a class account keeps its own class code as before
function _entradaPayload(req, res, rec, o) {
  _kidTz(req, rec);
  const level = LevelKeys.classLevel(rec) || Levels.DEFAULT;
  const info = Levels.info(level);
  const levelOpen = _openLevelOnDevice(req, res, rec, level);
  const base = audioBaseFor(info);
  if (base) { base.seals = [...RutaProgress.sealsOf(rec, level)].sort((x, y) => x - y); base.who = _sealWho(rec.code); }
  const tIds = _tareaIdsOf(level);
  const tMarks = tIds.length ? _tareaMarks(rec, tIds) : null;
  const tareas = tIds.length ? { level: info.pack || level, ids: tIds, sent: tIds.filter((id) => tMarks[id] && tMarks[id].s), who: _sealWho(rec.code) } : null;
  const classAcct = !!(rec.classroomCode && !rec.byKey && !_autoUnclaimed(rec));
  return {
    ok: true, studentCode: rec.code, displayName: rec.displayName, avatar: rec.avatar || null, avatarOptions: Students.AVATAR_OPTIONS,
    classroomCode: classAcct ? rec.classroomCode : null, keyMode: !classAcct,
    level, levelName: info.name, folders: Assignments.levelFolders(level), daily: info.daily !== false, base, tareas, levelOpen,
    isNew: !!(o && o.isNew), assignments: Assignments.listAssignments(level), submissions: Students.getAssignmentSubmissions(rec.code, 100),
  };
}
// GET /api/entrada/hola → { ok, kid: summary | null, relock: summary | null, auto: account | null, parked: { kind, name,
// avatar, progress, code (automatic accounts only) } | null, levels: ['YCT 1', …] }: the kid this phone remembers (its
// session, dkid, a named automatic account), the kid whose level key changed since (relock: type the new key), an unnamed
// automatic account (auto: «Soy nuevo» asks about it when it has progress), or a parked account for «¿Eres tú?». Never
// wakes an archived one.
app.get('/api/entrada/hola', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (!_autoHit('eh:' + _clientIp(req), 5 * 60 * 1000, 4000)) return res.status(429).set('Retry-After', '30').json({ ok: false, error: 'Espera un momento.' });
  const out = { ok: true, kid: null, relock: null, auto: null, parked: null, levels: Levels.LEVELS.map((l) => l.name) };
  _kidFollow(req, res);   // (2026-10-22: the phone's dkid follows a teacher's level change)
  const s = SimLock.session(req);
  const live = s && s.kind === 's' ? Students.peek(s.code) : null;
  if (live && !live.archived && !live.rec.mergedInto) {
    if (_autoUnclaimed(live.rec) && _autoNameless(live.rec)) out.auto = _autoMeOf(live.rec, true);
    else out.kid = _entradaSummary(live.rec, 'session');
    return res.json(out);
  }
  const k = _kidCookie(req);
  const kp = _kidHeld(k);
  const ks = _kidState(k, kp);
  if (ks === 'ok') { out.kid = _entradaSummary(kp.rec, 'device'); return res.json(out); }
  // (F2) the level's key changed since this phone came in: «escribe la clave nueva de tu nivel» (never the code)
  if (ks === 'key') { out.relock = _entradaSummary(kp.rec, 'relock'); return res.json(out); }
  if (ks === 'out') out.parked = _entradaParked(kp.rec, 'key');
  const a = _autoCookie(req);
  const ap = _autoHeld(a);
  if (ap && _autoUnclaimed(ap.rec)) {
    if (a.parked) { if (!out.parked) out.parked = _entradaParked(ap.rec, 'auto'); }
    else if (_autoNameless(ap.rec)) out.auto = _autoMeOf(ap.rec, true);
    else out.kid = _entradaSummary(ap.rec, 'auto');
  }
  res.json(out);
});
// POST /api/entrada/hola { accessCode, studentCode } → { ok, kid } | 401: today's families, whose phone saved the OLD class
// code + student code: the same proof as their login (their own class code), counted like a login miss when it fails
app.post('/api/entrada/hola', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (!_autoSameSite(req)) return res.status(403).json({ ok: false, why: 'site' });
  if (!_autoHit('ep:' + _clientIp(req), 60 * 1000, 600)) return res.status(429).json({ ok: false, error: 'Espera un momento.' });
  // (security check N2: per ADDRESS only, never the platform-wide bucket: nobody far away can empty every family's
  // «¡Hola de nuevo!» by filling it with garbage codes)
  if (_hwAddrMissBlocked(req)) return res.status(429).json({ ok: false, error: 'Ya fueron muchos intentos. Espera unos minutos.' });
  const b = req.body || {};
  const code = Students.normalizeCode(String(b.studentCode || ''));
  const p = code ? Students.peek(code) : null;
  const fine = !!(p && !p.rec.mergedInto && Assignments.isAccessCodeValid(b.accessCode) && !_autoLoginRefused(req, code) && _hwOwnsStudent(req, p.rec));
  if (!fine) { _hwAddrMiss(req); return res.status(401).json({ ok: false }); }
  res.json({ ok: true, kid: _entradaSummary(p.rec, 'codes') });
});
// POST /api/entrada/vamos → the portal's answer (like /api/homework/enter) for the kid this phone remembers (session,
// dkid, its unparked automatic account) | 401 why: 'none' (the page shows «¿Quién eres?»)
app.post('/api/entrada/vamos', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (!_autoSameSite(req)) return res.status(403).json({ ok: false, why: 'site' });
  if (!_autoHit('ev:' + _clientIp(req), 60 * 1000, 600)) return res.status(429).json({ ok: false, error: 'Espera un momento.' });
  try {
    let rec = null;
    const s = SimLock.session(req);
    const live = s && s.kind === 's' ? Students.peek(s.code) : null;
    if (live && !live.rec.mergedInto) rec = Students.get(s.code);   // (a real step: an archived kid comes back)
    if (!rec) { const k = _kidCookie(req); const kp = _kidHeld(k); if (_kidState(k, kp) === 'ok') rec = Students.get(k.code); }
    if (!rec) { const a = _autoCookie(req); const ap = _autoHeld(a); if (ap && !a.parked && _autoUnclaimed(ap.rec)) rec = Students.get(a.code); }
    if (!rec) return res.status(401).json({ ok: false, why: 'none', error: 'Entra con tu código y la clave de tu nivel.' });
    if (!s || s.code !== rec.code) _autoSession(req, res, rec);
    _kidFollow(req, res);   // (2026-10-22: the phone's dkid follows a teacher's level change)
    res.json(_entradaPayload(req, res, rec, { isNew: false }));
  } catch (e) {
    console.error('[entrada] vamos failed:', e.message);
    res.status(500).json({ ok: false, error: 'No se pudo entrar. Vuelve a intentarlo.' });
  }
});
// POST /api/entrada/clave { key } → { ok, level, levelId, levelName, family } («¡Tu nivel es New HSK 1!») | a uniform 401
app.post('/api/entrada/clave', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (!_autoSameSite(req)) return res.status(403).json({ ok: false, why: 'site' });
  const ck = _entradaKey(req, res);
  if (!ck) return;
  res.json(Object.assign({ ok: true }, _entradaLevel(ck.level)));
});
// POST /api/entrada/crear { key, name, avatar, resume?, fresh? } → { ok, created, converted, account: { code, name, avatar,
// level, levelName } } | { ok: false, why: 'parked', account } (this phone's automatic account, parked or with progress or
// a name: «¿Eres tú?» → resume: true makes it the kid's, fresh: true a new one; «¿No eres tú?» always sends fresh) |
// 400 name / avatar / key | 401 the key | 429
app.post('/api/entrada/crear', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (!_autoSameSite(req)) return res.status(403).json({ ok: false, why: 'site' });
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  const name = _autoCleanName(b.name, '');
  if (!name) return res.status(400).json({ ok: false, why: 'name', error: 'Escribe tu nombre con letras (de 2 a 24).' });
  const avatar = Students.AVATAR_OPTIONS.includes(b.avatar) ? b.avatar : null;
  if (!avatar) return res.status(400).json({ ok: false, why: 'avatar', error: 'Elige tu avatar.' });
  const ck = _entradaKey(req, res);
  if (!ck) return;
  try {
    let rec = null;
    let converted = false;
    const a = _autoCookie(req);
    const held = _autoHeld(a);
    if (held && _autoUnclaimed(held.rec)) {
      // 🔒 2026-10-18 (security review F1): the phone's automatic account becomes this kid's only (a) when «¿Eres tú?» was
      // answered «Sí, soy yo» (resume), or (b) when it is an empty, nameless account in use on this phone (nothing of
      // anyone's to take) and the kid didn't say «¿No eres tú?» (fresh). Anything else asks «¿Eres tú?» first; fresh =
      // a new account, that one untouched (it rests: _entradaIn parks it)
      const prog = ((_autoMeOf(held.rec, true) || {}).progress || {}).any;
      // (security check N1: «nameless» = the system's placeholder still there; a name typed since, even in a PIN room, is
      // a kid's, and sentences or reading tries count as progress)
      const quiet = !a.parked && _autoNameless(held.rec) && !prog;
      if (b.resume || (quiet && !b.fresh)) { rec = Students.claimByKey(a.code, { name, avatar, level: ck.level }); converted = !!rec; }
      else if (!b.fresh) return res.json({ ok: false, why: 'parked', account: _entradaParked(held.rec, 'auto') });
    }
    if (!rec) {
      if (!_entradaRateOk(req, ck.dev)) return res.status(429).set('Retry-After', '120').json({ ok: false, why: 'rate', error: 'Espera un momento y vuelve a intentarlo.' });
      rec = Students.createByKey(name, avatar, ck.level);
    }
    _entradaIn(req, res, rec, ck.level, ck.dev);
    console.log('[entrada] ' + (converted ? 'an automatic account became a kid\'s account' : 'a new account') + ' with the key of ' + Levels.info(ck.level).name);   // (never its code)
    res.json({ ok: true, created: !converted, converted, account: Object.assign({ code: rec.code, name: rec.displayName, avatar: rec.avatar }, _entradaLevel(ck.level)) });
  } catch (e) {
    console.error('[entrada] crear failed:', e.message);
    res.status(500).json({ ok: false, error: 'No se pudo crear la cuenta. Vuelve a intentarlo.' });
  }
});
// POST /api/entrada/entrar { code, key } → the portal's answer | one uniform 401 «El código o la clave no coinciden» (an
// unknown code, a wrong key, a key of a level the account doesn't have: all the same, all counted) | 400 | 429
app.post('/api/entrada/entrar', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (!_autoSameSite(req)) return res.status(403).json({ ok: false, why: 'site' });
  if (!_enterRateLimit(req)) return res.status(429).json({ ok: false, error: 'Espera un momento.' });
  const b = req.body || {};
  const code = Students.normalizeCode(String(b.code || ''));
  if (!code) return res.status(400).json({ ok: false, why: 'code', error: 'Escribe tu código de alumno.' });
  if (!LevelKeys.normalizeKey(String(b.key || '').slice(0, 80))) return res.status(400).json({ ok: false, why: 'key', error: 'Escribe la clave de tu nivel.' });
  const ip = _clientIp(req);
  const dev = LevelKeys.deviceId(req, res);
  // (security review F3) the per-phone and per-address checks first; this door's own platform bucket, never the old
  // form's (a stranger must never be able to block every family's code + key)
  const wait = LevelKeys.guessWait(ip, dev);
  if (wait) return res.status(429).json({ ok: false, wait, error: _entradaWaitMsg(wait) });
  if (_entradaCodeBlocked(req, dev)) return res.status(429).json({ ok: false, error: 'Ya fueron muchos intentos. Espera unos minutos y vuelve a intentarlo.' });
  const level = LevelKeys.levelOfKey(String(b.key).slice(0, 80));
  // a wrong key: a key guess only (the key screen's counters), never a code guess
  if (!level) { LevelKeys.noteWrong(ip, dev); return res.status(401).json({ ok: false, error: ENTRADA_BAD_PAIR }); }
  const p = Students.peek(code);
  // (security review F5, the M3 rule) an UNCLAIMED automatic account answers only on the phone that holds it: anywhere
  // else its code is a code that does not exist (it becomes the kid's through «Soy nuevo» on that phone)
  const fine = !!(p && !p.rec.mergedInto && _entradaHas(p.rec, level) && (!_autoUnclaimed(p.rec) || _autoDeviceHolds(req, p.rec)));
  if (!fine) {
    _entradaCodeMiss(req, dev);                                    // a right key with a wrong code: a code guess
    return res.status(401).json({ ok: false, error: ENTRADA_BAD_PAIR });
  }
  try {
    let rec = Students.get(code);                                  // (an archived kid comes back)
    if (_autoUnclaimed(rec)) rec = Students.claimByKey(rec.code, {}) || rec;   // its code + the key on ITS phone: the family's own now
    _entradaIn(req, res, rec, level, dev);
    res.json(_entradaPayload(req, res, Students.get(rec.code), { isNew: false }));
  } catch (e) {
    console.error('[entrada] entrar failed:', e.message);
    res.status(500).json({ ok: false, error: 'No se pudo entrar. Vuelve a intentarlo.' });
  }
});
// POST /api/entrada/nivel { key } → { ok, moved, level, levelId, levelName } («Abrir otro nivel», Ajustes today, Mi perfil
// in part 3): the logged-in kid types the key of another level: it opens on the account and this phone, and becomes the
// kid's level (moving up = the new key, his rule); the old level stays theirs
app.post('/api/entrada/nivel', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (!_autoSameSite(req)) return res.status(403).json({ ok: false, why: 'site' });
  const rec = _studentOf(req);
  if (!rec) return res.status(401).json({ ok: false, why: 'login', error: 'Entra con tu código primero.' });
  const ck = _entradaKey(req, res);
  if (!ck) return;
  const prev = LevelKeys.classLevel(rec);
  Students.setLevelAccess(rec.code, ck.level, 'key', LevelKeys.genOf(ck.level));
  LevelKeys.rememberDevice(req, res, ck.level);
  LevelKeys.clearDevice(ck.dev);
  const moved = prev !== ck.level;
  if (moved) {
    if (prev && LevelKeys.recordOpenVia(rec, prev) === 'grandfathered') Students.setLevelAccess(rec.code, prev, 'grandfathered');
    Students.setLevel(rec.code, ck.level, prev);
    _autoSession(req, res, Students.get(rec.code));
    // (F2) the phone's dkid names the kid's level: re-issued for the new one (else it would ask the key again)
    const k = _kidCookie(req);
    if (k && k.code === rec.code && _kidHeld(k)) _kidSetCookie(req, res, Students.get(rec.code), false);
  }
  res.json(Object.assign({ ok: true, moved }, _entradaLevel(ck.level)));
});
// 🔒 2026-10-18 (security review F2) POST /api/entrada/reabrir { key } → the portal's answer | 401: the level's key
// changed since this phone came in («Cambiar» + «Cerrar en todos los aparatos»): «Este teléfono te recuerda: escribe la
// clave nueva de tu nivel». The KEY only (this phone still holds the kid: dkid, the same firstSeen and kidGen); a key of
// a level the account doesn't have = the same uniform line, counted like any wrong key
app.post('/api/entrada/reabrir', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (!_autoSameSite(req)) return res.status(403).json({ ok: false, why: 'site' });
  const k = _kidCookie(req);
  const kp = _kidHeld(k);
  if (_kidState(k, kp) !== 'key') return res.status(401).json({ ok: false, why: 'none', error: 'Entra con tu código y la clave de tu nivel.' });
  const ck = _entradaKey(req, res);
  if (!ck) return;
  if (!_entradaHas(kp.rec, ck.level)) {
    LevelKeys.noteWrong(ck.ip, ck.dev);
    return res.status(401).json({ ok: false, why: 'key', error: ENTRADA_BAD_KEY });
  }
  try {
    const rec = Students.get(k.code);                              // (an archived kid comes back: a real step)
    _entradaIn(req, res, rec, ck.level, ck.dev);
    res.json(_entradaPayload(req, res, Students.get(rec.code), { isNew: false }));
  } catch (e) {
    console.error('[entrada] reabrir failed:', e.message);
    res.status(500).json({ ok: false, error: 'No se pudo entrar. Vuelve a intentarlo.' });
  }
});
// 🔒 2026-10-18 (security review F2) /maestro (super admin), a kid's profile: «Cerrar su sesión en todos los teléfonos» —
// the account's kidGen moves on: every session (core/sim-lock.js) and every remembered phone (dkid) of this kid stop at
// once; they come back with their code + the level key (a class kid's old class code + code still logs in too)
app.post('/api/admin/student/:code/close-sessions', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const session = _adminAuth(req, res);
  if (!session) return;
  if (!session.isSuperAdmin) return res.status(403).json({ ok: false, error: 'super admin only' });
  const p = Students.peek(req.params.code);
  if (!p) return res.status(404).json({ ok: false, error: 'student not found' });
  const gen = Students.bumpKidGen(p.rec.code);
  console.log('[entrada] a kid\'s sessions were closed on every phone (super admin)');
  res.json({ ok: true, kidGen: gen });
});
// 🔒 2026-10-18 (ownership): may this socket's phone use this EXISTING account in a PIN room (rename it, save results on
// it)? The same proof as every homework write (_hwOwnsStudent): the kid's session or remembered-device cookie on the
// socket, or the class code saved with the code on that phone (sent as `accessCode`); legacy untagged accounts as before
function _joinOwns(socket, rec, accessCode) {
  if (!rec) return false;
  const hs = (socket && socket.handshake) || {};
  return _hwOwnsStudent({ headers: hs.headers || {}, body: { accessCode: String(accessCode || '') }, query: {} }, rec);
}
// player:join (a teacher's PIN room): a key account with no class code takes the room owner's class code for its level,
// only when the phone proves it holds the account (its session or dkid on the socket); never an unclaimed automatic one
function _entradaPinTag(socket, g, rec) {
  try {
    if (!rec || !rec.byKey || rec.classroomCode || rec.mergedInto || _autoUnclaimed(rec)) return;
    const hs = (socket && socket.handshake) || {};
    const s = SimLock.session(hs);
    const k = _kidCookie(hs);
    const mine = (s && s.kind === 's' && s.code === rec.code) || (k && k.code === rec.code && _kidState(k, _kidHeld(k)) === 'ok');
    if (!mine) return;
    const t = g && g.hostOwner && g.hostOwner !== '*' ? Teachers.getByUid(g.hostOwner) : null;
    const lvl = LevelKeys.classLevel(rec);
    const code = t && lvl ? (t.accessCodes || []).find((c) => Teachers.levelForAccessCode(c) === lvl) : null;
    if (!code) return;
    Students.setClassroomCode(rec.code, code);
    console.log('[entrada] a key account joined its teacher\'s class in a PIN room (' + Levels.info(lvl).name + ')');
  } catch (e) { console.warn('[entrada] PIN tag failed:', e.message); }
}
// the level of a homework request: its class code's, else (la entrada) the logged-in kid's
function _hwReqLevel(req, code) {
  // (2026-10-22, review) a kid a teacher moved with «Change level» while keeping their class code: their own level,
  // never the code's (moved to Old HSK 1 from a New HSK 1 class, the HSK 1 trainer opens; moved away, it closes)
  const me = _studentOf(req);
  if (me && _levelBound(me)) return LevelKeys.classLevel(me);
  if (Assignments.isAccessCodeValid(code)) return Teachers.levelForAccessCode(code);
  const rec = me;
  return rec ? LevelKeys.classLevel(rec) : Teachers.levelForAccessCode(code);
}
// the route state's 2026-10-18 extras: the class mode of El Simulacro Dorado (DORADO_SELF_SERVE off: no player links for
// a kid) and `me` (the logged-in kid's code and name, for «Mi código» and the first-account card)
function _rutaExtras(req, st) {
  if (!st || !Array.isArray(st.modules)) return st;
  st.solo = DORADO_SELF_SERVE || !!st.teacher;
  st.modules.forEach((m) => {
    if (m.dorado) m.dorado.solo = st.solo;
    if (!st.solo && Array.isArray(m.sims)) m.sims.forEach((s) => { s.href = null; });
  });
  const rec = st.student ? _studentOf(req) : null;
  st.me = rec ? _autoMeOf(rec) : null;
  // 🆕 2026-10-22 «Change level»: a teacher moved the logged-in kid to another level: the route goes to that module and
  // says so once (js/level-note.js); only to the kid's own session
  st.levelNote = rec ? _levelNoteOf(rec) : null;
  return st;
}
app.get(['/audios', '/audio', '/audios/:id', '/audio/:id'], (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  // 🔑 2026-10-15: a level's base (/audios/yct1-base, /audios/hsk2-base…) opens only for whoever may use that level;
  // everyone else gets the level's key screen right here (after the key, the same address shows the base). Homework
  // audio pages (/audios/<homework id>), the module picker (/audios) and each module's path (/audios/<level>) stay
  // open: the printed PDFs link to them, and the path shows its locks itself.
  const b = req.params.id ? _baseOf(req.params.id) : null;
  if (b && !LevelKeys.access(req, b.level).ok) return LevelKeys.sendKeyScreen(res, { level: b.level, what: 'base' });
  res.sendFile(_emPath.join(__dirname, 'public', 'audios.html'));
});
// ── 🏆 La Ruta Dorada, phase 2 (2026-10-15): the module picker (/audios) and each module's path (/audios/<level>) ──
// «Escribe la clave de YCT 1» on a locked path = /audios/<level>/clave: the level's key screen (phase 1, the same
// LevelKeys.access question as everything else), which reloads itself once the key is right; then this address sends
// the visitor back to the path, now open. A level that is already open goes straight back.
app.get(['/audios/:id/clave', '/audio/:id/clave'], (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const lvl = Levels.normalize(req.params.id);
  if (!lvl) return res.redirect(302, '/audios');
  const slug = Levels.info(lvl).pack || lvl;
  if (LevelKeys.access(req, lvl).ok) return res.redirect(302, '/audios/' + slug);
  return LevelKeys.sendKeyScreen(res, { level: lvl, what: 'ruta' });
});
// 🎯 El Entrenamiento (phase 4, 2026-10-16): /audios/<level>/entrenamiento (its worlds) and
// /audios/<level>/entrenamiento/<world> (a world's quick rounds), drawn by js/entrenamiento.js inside La Ruta Dorada's
// page. Behind the level's key (LevelKeys.access, the one door): without it, the key screen right here, which comes
// back to the same address once the key is right. Whether a world is open is the API's answer (it knows the kid).
app.get(['/audios/:id/entrenamiento', '/audios/:id/entrenamiento/:world', '/audio/:id/entrenamiento', '/audio/:id/entrenamiento/:world'], (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const lvl = Levels.normalize(req.params.id);
  const W = lvl ? Train.worldsOf(lvl) : null;
  if (!W) return res.redirect(302, lvl ? '/audios/' + (Levels.info(lvl).pack || lvl) : '/audios');
  const slug = Levels.info(lvl).pack || lvl;
  if (req.params.world && !W.some((w) => w.key === req.params.world)) return res.redirect(302, '/audios/' + slug + '/entrenamiento');
  if (!LevelKeys.access(req, lvl).ok) return LevelKeys.sendKeyScreen(res, { level: lvl, what: 'train' });
  res.sendFile(_emPath.join(__dirname, 'public', 'audios.html'));
});
// 📖 El libro dorado (phase 5, 2026-10-16): /audios/<level>/libro/<n> = simulation n's golden book, drawn by
// js/libro.js inside La Ruta Dorada's page. The page holds no content: what it may show comes from /api/golden/…
// (below), which asks every door. Without the level's key: the key screen right here (it comes back to this address).
// /audios/<level>/libro (no simulation) = the route's step 3.
app.get(['/audios/:id/libro', '/audio/:id/libro', '/audios/:id/libro/:n', '/audio/:id/libro/:n'], (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const lvl = Levels.normalize(req.params.id);
  const b = lvl ? Golden.ofLevel(lvl) : null;
  const slug = lvl ? (Levels.info(lvl).pack || lvl) : null;
  if (!b) return res.redirect(302, slug ? '/audios/' + slug : '/audios');
  if (req.params.n == null || !Golden.simOf(b, req.params.n)) return res.redirect(302, '/audios/' + slug + '#paso-3');
  if (!LevelKeys.access(req, lvl).ok) return LevelKeys.sendKeyScreen(res, { level: lvl, what: 'sim' });
  res.sendFile(_emPath.join(__dirname, 'public', 'audios.html'));
});
// What the picker and the paths draw, for THIS request (never cached): one module per level of core/levels.js
// (future levels automatically), whether its key is open here (LevelKeys.access: a teacher, the logged-in kid's
// account, this device's key), and only when it is open the level's simulations (links to the players, which ask
// LevelKeys.access again at their own door: never a bypass). Nothing locked travels to a visitor: no media links, no
// sim list, no answers (the sims' names and question counts are only for whoever may open them).
//   home = the module to show first: the logged-in kid's class level, else the first level this device holds a key of
let _rutaSims = null;   // the sims never change while the server runs (a new one comes with a deploy)
const _rutaSimNum = (id) => parseInt((String(id).match(/sim(\d+)$/) || [])[1] || '0', 10);
// a level's simulations in order: [{ id, n, questions, href }]
function _rutaSimsOf(level) {
  if (!_rutaSims) _rutaSims = HskSim.listSims().concat(YctSim.listSims());
  return _rutaSims.filter((s) => Levels.normalize(s.level) === level).sort((x, y) => _rutaSimNum(x.id) - _rutaSimNum(y.id))
    .map((s) => ({ id: s.id, n: _rutaSimNum(s.id), questions: s.totalQuestions || s.questionCount || 0,
      href: (/^hsk\d/.test(s.id) ? '/hsk-sim.html?sim=' : '/yct-sim.html?sim=') + encodeURIComponent(s.id) }));
}
// 🏆 phase 3 (2026-10-16): an open module also carries its worlds (number + short name: the route draws a key-only
// phone's progress from its own seals) and, for the logged-in kid, `progress` from their record (core/ruta-progress.js:
// seals per world, the El Entrenamiento worlds their seals or a teacher opened, El Simulacro Dorado). `dorado` = the
// rule in force: while El Entrenamiento is not live the key opens it; once it is live the sims are listed only to whoever
// has earned it (a teacher, or the kid's practice / «Desbloquear»). A locked module carries none of it.
function _rutaState(req) {
  const teacher = !!_teacherOf(req);
  const superAdmin = _superOf(req);   // 🔒 2026-10-18: the golden book's PDF link is only theirs
  const rec = _studentOf(req);
  const bases = _loadAudioBases();
  const live = RutaProgress.getSettings().trainingLive;
  let home = rec ? LevelKeys.classLevel(rec) : null;
  const modules = Levels.LEVELS.map((l) => {
    const a = LevelKeys.access(req, l.id);
    if (!home && !teacher && a.ok && a.via === 'key') home = l.id;
    const b = l.base ? bases.find((x) => x.id === l.base) : null;
    const own = _rutaSimsOf(l.id);
    const tries = a.ok && rec && Array.isArray(rec.hskResults) ? rec.hskResults : [];
    const rb = a.ok ? RutaProgress.baseOf(l.id) : null;
    const prog = a.ok && rec && rb ? RutaProgress.state(rec, l.id) : null;
    // El Simulacro Dorado for this visitor (only meaningful when the module is open)
    let dorado = null;
    if (a.ok) {
      // (a level without a La Base has no worlds to practise: the key keeps opening its Simulacro)
      if (!live || a.via === 'teacher' || !rb) dorado = { open: true, rule: live && rb ? 'practice' : 'key' };
      else if (prog) {
        dorado = { open: prog.dorado.open, rule: 'practice', via: prog.dorado.via, pct: prog.dorado.pct, practiced: prog.dorado.practiced, of: prog.dorado.of };
      } else dorado = { open: false, rule: 'practice', pct: RutaProgress.getSettings().doradoPct, login: true };   // a phone alone can't save practice
    }
    // 🎯 phase 4: El Entrenamiento's worlds for this visitor (open by the account's seals / a teacher, the account's best
    // %); a key-only phone adds its own seals and scores on the page (they never travel in this state)
    const tv = a.ok && rb ? Train.view(l.id, rec, a, null) : null;
    const train = tv ? { live, ready: tv.ready, of: tv.of,
      worlds: tv.worlds.map((w) => ({ key: w.key, kind: w.kind, n: w.n, short: w.short, emoji: w.emoji, open: w.open, via: w.via, best: w.best })),
      // (review 2026-10-18) a key-only phone's or a teacher's finished rounds the page may never have heard (card 2 counts them)
      done: rec && !teacher ? [] : Train.doneFor(l.id, _trainWho(req, null, a)) } : null;
    const listSims = a.ok && dorado && dorado.open;
    // 📖 phase 5: the golden book of each simulation (core/golden.js): once the logged-in kid took that simulation (a
    // teacher: every one), its «Libro dorado» with the latest try's mistakes, and the PDF once every one is taken AND
    // the Dorado is open. Taken anywhere is enough (his pick after the build): a kid whose Dorado is still closed but who
    // took a simulation in a teacher's room gets that one's book (`golden.taken`, nothing about the others). A
    // key-only phone has no account: `golden.login` (the step says «Entra con tu código»). Counts only, never answers.
    const teach = a.ok && a.via === 'teacher';
    const gb = a.ok && (listSims || (rec && !teach)) ? Golden.ofLevel(l.id) : null;
    const gs = gb ? Golden.summary(gb, teach ? null : rec, teach, !!listSims) : null;
    // (2026-10-18) `at` = when the kid's latest try of a simulation was handed in: the route's «Libro dorado» opens the
    // book of the simulation taken last
    const lastAt = (simId) => { const t = rec && !teach ? Golden.latest(rec, simId) : null; return t ? Number(t.ts) || 0 : null; };
    const takenOnly = gs && !listSims ? gs.sims.filter((s) => s.taken).map((s) => ({ n: s.n, mistakes: s.mistakes, at: lastAt(s.id), book: _goldenHref(l.id, s.n) })) : null;
    return {
      id: l.id, slug: l.pack || l.id, name: l.name, family: l.family, exam: l.exam || '', open: !!a.ok,
      base: b ? Object.assign({ id: b.id, words: b.words }, rb ? { worlds: rb.worlds.map((w) => ({ n: w.n, short: w.short, first: w.first, count: w.count })) } : {}) : null,
      simCount: own.length,
      sims: listSims ? own.map((s) => {
        const best = tries.filter((t) => t && t.simId === s.id).reduce((m, t) => Math.max(m, Number(t.percent) || 0), -1);
        const g = gs ? gs.sims.find((x) => x.id === s.id) : null;
        return Object.assign({}, s, { best: best >= 0 ? Math.round(best) : null, taken: !!(g && g.taken),
          mistakes: g && g.taken ? g.mistakes : null, at: g && g.taken ? lastAt(s.id) : null,
          book: g && g.open && (teach || rec) ? _goldenHref(l.id, g.n) : null });
      }) : [],
      // (the PDF holds every answer: since 2026-10-18 a download for the super admin only, his rule)
      golden: !gs ? null : takenOnly ? (takenOnly.length ? { closed: true, taken: takenOnly, pdf: null } : null)
        : { sims: gs.sims.length, left: gs.left, login: !teach && !rec, mb: gs.pdf.mb,
          pdf: superAdmin ? '/golden-media/' + gb.id + '/book.pdf?v=' + encodeURIComponent((gb.pdf && gb.pdf.v) || '') : null },
      dorado,
      train,
      // 🏆 2026-10-18: the logged-in kid's homework marks for this level's audios («Escuchada», «¡Ya la mandé!»), from
      // their account (any phone). The homework audios are open, so a locked module carries them too.
      tareas: rec ? _tareaMarks(rec, _tareaIdsOf(l.id)) : null,
      // (review 2026-10-18) the logged-in kid's simulation taken last, for the bubble that says what «Hoy» says on their
      // home (js/papas-plan.js today(): «¡Aprobaste El Simulacro Dorado con P %!»)
      simLast: rec && a.ok && !teach ? _lastSimOf(_simsTaken(rec, l.id)) : null,
      // 🗂️ the module's experiences, the folders of «Tus tareas» (public: the curriculum's names and pack pictures, served
      // under neutral names by /ruta-exp/<level>/<n>.webp)
      exps: _rutaExps(l.id),
      progress: prog ? {
        sealed: prog.sealed, words: prog.words,
        worlds: prog.worlds.map((w) => ({ n: w.n, short: w.short, count: w.count, sealed: w.sealed, train: w.train, teacher: w.teacher })),
        train: { live: prog.train.live, open: prog.train.open, of: prog.train.of },
      } : null,
    };
  });
  // who: the logged-in kid's opaque id (the same as /api/ruta/seals): the route trusts a phone's seal mirror only when
  // it holds this kid's account
  // tw: a teacher device's opaque person id (El Entrenamiento keeps a teacher's own rounds on the device under it)
  // auto: an unclaimed automatic account still wearing its placeholder name (review 2026-10-18: /homework would greet it
  // with «¿Quién eres?», so the module page never offers it «Mi Dralingo» as its way back)
  return { ok: true, teacher, superAdmin, student: !!rec, auto: !!(rec && _autoUnclaimed(rec) && _autoNameless(rec)), who: rec ? _sealWho(rec.code) : null, tw: teacher ? _trainTeacherWho(req) : null,
    home: home ? (Levels.info(home).pack || home) : null, modules };
}
// 🗂️ an experience folder's picture by its number (review 2026-10-18: never the pack's pinyin file name); public like
// the packs' pictures, only a picture _rutaExps chose. /ruta-exp/<level>/<n>.webp
app.get('/ruta-exp/:level/:file', (req, res) => {
  const lvl = Levels.normalize(req.params.level);
  // (2026-10-18, «Mi Dralingo» part 3: <n>-<k>.webp = the k-th peek picture of experience n, the home's «1 Palabras»)
  const m = /^(\d{1,2})(?:-([1-9]))?\.webp$/.exec(String(req.params.file || ''));
  if (!lvl || !m) return res.status(404).end();
  _rutaExps(lvl);
  const file = _rutaExpFiles[(Levels.info(lvl).pack || lvl) + '/' + Number(m[1]) + (m[2] ? '-' + Number(m[2]) : '')];
  if (!file) return res.status(404).end();
  res.set({ 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' }).type('image/webp');
  res.sendFile(file, { cacheControl: false }, (err) => { if (err && !res.headersSent) res.status(404).end(); });
});
app.get('/api/ruta-dorada', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  LevelKeys.deviceId(req, res);   // (2026-10-18: a device the platform has seen, its dkd id: the homework mark's account step needs it)
  _kidFollow(req, res);           // (2026-10-22: the phone's dkid follows a teacher's level change)
  try { res.json(_rutaExtras(req, _rutaState(req))); } catch (e) {
    console.error('[ruta-dorada] state failed:', e.message);
    res.status(500).json({ ok: false, error: 'No se pudo cargar La Ruta Dorada.' });
  }
});
// ── 🪙 El Zoco de Dralingo (2026-10-19, his OK: "Okay I approve the design of the Souq") ───────────────────────────
// Coins come only from real steps, judged here on the kid's OWN record (core/zoco.js: the amounts, the daily caps, the
// one-time welcome grant), never from a number a phone sends, never bought with money. Who earns: the account this
// request proves is the kid's (their /homework session for La Base, El Entrenamiento and the homework marks; a PIN join
// that _joinOwns proved for a class game). Who spends and equips: only that kid's session (never a code in the body).
//   GET  /api/zoco?since=<ms>        → { ok, student: false } | { ok, student: true, who, coins, own, equipped, items,
//                                       cats, ways, news (moves since `since`), caps, waiting, settled? }
//   POST /api/zoco/buy   { id, who } → { ok, coins, own, item } | 402 not enough coins · 404 not on sale · 409 owned
//   POST /api/zoco/equip { id, who } → { ok, avatar } (a free saga avatar, or a skin the kid owns)
// Steps pay inside their own endpoints (/api/ruta/seals, /api/ruta/tareas, /api/ruta/train/finish + scores, every pin
// game's end through _zocoGameEnd), each answer carrying `coins: { got, c, items }` for the «+N monedas» moment.
const _zocoEnv = () => ({ goal: RutaProgress.getSettings().doradoPct });
// the kid's purse opened BEFORE a step changes the record (what was done before El Zoco never pays coin by coin)
function _zocoOpen(code) {
  try { return Students.updateZoco(code, (rec) => { Zoco.ensure(rec, _zocoEnv()); return true; }); }
  catch (e) { console.warn('[zoco] open failed:', e.message); return null; }
}
// a step's coins (+ a 7-day streak the step may have completed): fn(rec) → { got, items }. A step never fails because
// of the coins: any trouble here is logged and the step answers as always.
function _zocoPay(code, fn) {
  try {
    return Students.updateZoco(code, (rec) => {
      Zoco.ensure(rec, _zocoEnv());
      const r = fn(rec) || { got: 0, items: [] };
      const s = Zoco.settleStreak(rec);
      return { got: r.got + s.got, items: r.items.concat(s.items), c: rec.zoco.c };
    });
  } catch (e) { console.warn('[zoco] pay failed:', e.message); return null; }
}
const _zocoOut = (r) => (r && r.got ? { got: r.got, c: r.c, items: r.items, at: Date.now() } : undefined);
// the homework that pays: the kid's own level's homework audios (another level's homework only plays)
const _zocoHwIds = (rec) => _tareaIdsOf(LevelKeys.classLevel(rec) || rec.level || Levels.DEFAULT);
// rate: a read per address (a school Wi-Fi is never slowed), a buy / equip per kid
const _zocoHits = new Map();
function _zocoRate(key, win, max) {
  const now = Date.now();
  const arr = (_zocoHits.get(key) || []).filter((t) => now - t < win);
  if (arr.length >= max) { _zocoHits.set(key, arr); return false; }
  arr.push(now);
  _zocoHits.set(key, arr);
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _zocoHits) if (!v.length || now - v[v.length - 1] > 10 * 60 * 1000) _zocoHits.delete(k);
  if (_zocoHits.size > 50000) _zocoHits.clear();
}, 60 * 1000).unref();
// the logged-in kid of a shop write: same site, their session, their own phone's mirror (`who`), within the rate
function _zocoKid(req, res) {
  res.set('Cache-Control', 'private, no-store');
  if (!_autoSameSite(req)) { res.status(403).json({ ok: false, why: 'site' }); return null; }
  const rec = _studentOf(req);
  if (!rec) { res.status(403).json({ ok: false, student: false, error: 'Entra con tu código para usar el Zoco.' }); return null; }
  if (!_zocoRate('k:' + rec.code, 60 * 1000, 30)) { res.status(429).set('Retry-After', '20').json({ ok: false, error: 'Espera un momento.' }); return null; }
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  const who = _sealWho(rec.code);
  if (b.who != null && String(b.who) !== who) { res.status(409).json({ ok: false, who, error: 'Otra cuenta entró en este teléfono.' }); return null; }
  return rec;
}
app.get('/api/zoco', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (!_zocoRate('i:' + _clientIp(req), 5 * 60 * 1000, 4000)) return res.status(429).set('Retry-After', '30').json({ ok: false, error: 'Espera un momento.' });
  const me = _studentOf(req);
  if (!me) return res.json({ ok: true, student: false });
  try {
    const settled = Students.updateZoco(me.code, (rec) => { Zoco.ensure(rec, _zocoEnv()); return Zoco.settle(rec); });
    const rec = Students.get(me.code);
    res.json(Object.assign({ ok: true, student: true, who: _sealWho(rec.code), now: Date.now() }, Zoco.view(rec, { since: Number((req.query || {}).since) || 0 }),
      _zocoOut(settled) ? { settled: _zocoOut(settled) } : {}));
  } catch (e) {
    console.error('[zoco] read failed:', e.message);
    res.status(500).json({ ok: false, error: 'No se pudo abrir el Zoco. Vuelve a intentarlo.' });
  }
});
app.post('/api/zoco/buy', (req, res) => {
  const rec = _zocoKid(req, res);
  if (!rec) return;
  const id = String(((req.body || {}).id) || '').slice(0, 60);
  const out = Students.updateZoco(rec.code, (r) => { Zoco.ensure(r, _zocoEnv()); return Zoco.buy(r, id); });
  if (!out || !out.ok) return res.status((out && out.status) || 400).json(Object.assign({ ok: false }, out || {}, { status: undefined }));
  const after = Students.get(rec.code);
  console.log('[zoco] a character was bought (' + id + ')');   // (never a student code in the log)
  res.json({ ok: true, coins: out.c, own: after.zoco.own.slice(), item: out.item });
});
app.post('/api/zoco/equip', (req, res) => {
  const rec = _zocoKid(req, res);
  if (!rec) return;
  const id = String(((req.body || {}).id) || '').slice(0, 60);
  if (!Students.setAvatar(rec.code, id)) return res.status(403).json({ ok: false, why: 'owned', error: 'Ese personaje todavía no es tuyo.' });
  res.json({ ok: true, avatar: id });
});
// ── 🏆 La Ruta Dorada, phase 3 (2026-10-16): a logged-in kid's «¡Me la sé!» seals live on their record ──────────────
// GET  /api/ruta/seals?level=yct1           → { ok, student: false } (a key on this phone, nobody logged in: the seals
//                                              stay on the phone, as before) | { ok, student: true, who, seals: [n…] }
// POST /api/ruta/seals { level, add, remove } → { ok, who, seals } — the page's batched stamps / unstamps, and the
//                                              phone's own seals the first time it meets the kid's account (a union)
// Only for a level this request may use (LevelKeys.access: the one door) and only the logged-in kid's own record (the
// /homework session). Word numbers are checked against the level's base. `who` tells the page whose seals its mirror
// holds (an opaque id of the account, never the code), so a sibling's login on the same phone never mixes them.
// Rate: a save (a signed kid session) counts per kid only, 90 a minute (the page batches its taps: one request a second
// or less; a refusal is retried) so a school address full of kids (one Wi-Fi, two classes) is never slowed down; a
// read counts per address, 4000 per 5 minutes.
// A save carries the `who` its phone's mirror holds: when another kid has logged in on that phone meanwhile, the
// server answers 409 (never writes one kid's taps on a sibling's account) and the page settles with the new account.
const _sealHits = new Map();   // 'k:<code>' | 'i:<ip>' → [timestamps]
function _sealRateOk(req, code) {
  const now = Date.now();
  const hit = (k, win, max) => {
    const arr = (_sealHits.get(k) || []).filter((t) => now - t < win);
    if (arr.length >= max) { _sealHits.set(k, arr); return false; }
    arr.push(now);
    _sealHits.set(k, arr);
    return true;
  };
  if (_sealHits.size > 5000) for (const [k, v] of _sealHits) if (!v.length || now - v[v.length - 1] > 5 * 60 * 1000) _sealHits.delete(k);
  return code ? hit('k:' + code, 60 * 1000, 90) : hit('i:' + _clientIp(req), 5 * 60 * 1000, 4000);
}
const _sealWho = (code) => SimLock.hmacHex('ruta-who:' + code, 12);
function _sealDoor(req, res, raw) {
  res.set('Cache-Control', 'private, no-store');
  const lvl = Levels.normalize(raw);
  if (!lvl || !RutaProgress.baseOf(lvl)) { res.status(404).json({ ok: false, error: 'Ese nivel no tiene La Base.' }); return null; }
  if (!levelAccess(req, lvl).ok) { res.status(401).json({ ok: false, locked: true, level: lvl }); return null; }
  return lvl;
}
app.get('/api/ruta/seals', (req, res) => {
  const lvl = _sealDoor(req, res, req.query && req.query.level);
  if (!lvl) return;
  if (!_sealRateOk(req, null)) return res.status(429).set('Retry-After', '30').json({ ok: false, error: 'Espera un momento.' });
  const rec = _studentOf(req);
  if (!rec) return res.json({ ok: true, student: false });
  res.json({ ok: true, student: true, who: _sealWho(rec.code), seals: [...RutaProgress.sealsOf(rec, lvl)].sort((a, b) => a - b) });
});
app.post('/api/ruta/seals', (req, res) => {
  const b = req.body || {};
  const lvl = _sealDoor(req, res, b.level);
  if (!lvl) return;
  const rec = _studentOf(req);
  if (!rec) return res.status(403).json({ ok: false, student: false, error: 'Entra con tu código para guardar tus sellos en tu cuenta.' });
  if (!_sealRateOk(req, rec.code)) return res.status(429).set('Retry-After', '20').json({ ok: false, error: 'Espera un momento: tus sellos se guardan enseguida.' });
  const who = _sealWho(rec.code);
  if (b.who != null && String(b.who) !== who) return res.status(409).json({ ok: false, who, error: 'Otra cuenta entró en este teléfono.' });
  _zocoOpen(rec.code);                                   // 🪙 (before the step: what was sealed before El Zoco never pays)
  const out = RutaProgress.applySeals(rec.code, lvl, b.add, b.remove);
  if (!out.ok) return res.status(out.status || 400).json({ ok: false, error: out.error });
  const coins = _zocoPay(rec.code, (r) => Zoco.settleSeals(r, lvl));
  res.json(Object.assign({ ok: true, who, seals: out.seals }, _zocoOut(coins) ? { coins: _zocoOut(coins) } : {}));
});
// ── 🏆 La Ruta Dorada redesign (2026-10-18): the homework done marks live on the kid's ACCOUNT ─────────────────────
// (his worry: a kid changes or loses the phone)
// GET  /api/ruta/tareas → { ok, student: false } (nobody logged in: the marks stay on the phone, with a soft «Entra con
//                         tu código») | { ok, student: true, who, marks: { <homework id>: { h?: 1, s?: 1 } } }
// POST /api/ruta/tareas { who, heard: [id…], sent: [id…], unsent: [id…] } → { ok, who, marks, unknown? }
// h = «Escuchada» (the audio played on the page), s = «¡Ya la mandé!» (one tap once the kid sent the video to the
// teacher on WhatsApp; his pick: no teacher confirmation). Only the logged-in kid's OWN record (the /homework session
// cookie; never a code in the body), only ids of the audio catalog (an unknown id is skipped and named back in
// `unknown`; the good ones are saved), at most 60 ids per list. The homework audio pages are open (no key), so the
// marks need no level key. A phone's own marks (made while nobody was logged in) join the next account that logs in on
// it (a union, sent by the page); `who` = the seals' opaque
// id of the account: a save from a sibling's mirror is refused (409), never written on this account. Rate: a save
// counts per kid (60 a minute: the page batches), a read per address (4000 per 5 minutes: a school Wi-Fi is never slowed).
const _tareaHits = new Map();   // key → [timestamps]
function _tareaRate(key, win, max) {
  const now = Date.now();
  const arr = (_tareaHits.get(key) || []).filter((t) => now - t < win);
  if (arr.length >= max) { _tareaHits.set(key, arr); return false; }
  arr.push(now);
  _tareaHits.set(key, arr);
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _tareaHits) if (!v.length || now - v[v.length - 1] > 10 * 60 * 1000) _tareaHits.delete(k);
  if (_tareaHits.size > 50000) _tareaHits.clear();
}, 60 * 1000).unref();
app.get('/api/ruta/tareas', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (!_tareaRate('i:' + _clientIp(req), 5 * 60 * 1000, 4000)) return res.status(429).set('Retry-After', '30').json({ ok: false, error: 'Espera un momento.' });
  const rec = _studentOf(req);
  if (!rec) return res.json({ ok: true, student: false });
  res.json({ ok: true, student: true, who: _sealWho(rec.code), marks: _tareaMarks(rec) });
});
app.post('/api/ruta/tareas', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  const rec = _studentOf(req);
  if (!rec) return res.status(403).json({ ok: false, student: false, error: 'Entra con tu código para guardar tus tareas en tu cuenta.' });
  if (!_tareaRate('k:' + rec.code, 60 * 1000, 60)) return res.status(429).set('Retry-After', '20').json({ ok: false, error: 'Espera un momento: tus tareas se guardan enseguida.' });
  const who = _sealWho(rec.code);
  if (b.who != null && String(b.who) !== who) return res.status(409).json({ ok: false, who, error: 'Otra cuenta entró en este teléfono.' });
  // (an id the catalog does not have, e.g. a homework renamed since the phone marked it, is skipped and named back in
  // `unknown`: the batch's good marks are saved, never refused for one stale id)
  const lists = {};
  const unknown = [];
  for (const k of ['heard', 'sent', 'unsent']) {
    const v = b[k] == null ? [] : b[k];
    if (!Array.isArray(v) || v.length > 60) return res.status(400).json({ ok: false, error: 'Lista no válida.' });
    lists[k] = [];
    v.forEach((raw) => {
      const id = _tareaId(raw);
      if (id) lists[k].push(id);
      else if (unknown.length < 60) unknown.push(typeof raw === 'string' ? raw.slice(0, 60) : String(typeof raw));
    });
  }
  if (lists.sent.some((id) => lists.unsent.includes(id))) return res.status(400).json({ ok: false, error: 'Una tarea no puede estar mandada y no mandada a la vez.' });
  const now = Date.now();
  const any = lists.heard.length + lists.sent.length + lists.unsent.length > 0;
  let coins = null;
  if (any) {
    _zocoOpen(rec.code);                                 // 🪙 (before the step: a homework sent before El Zoco never pays)
    Students.updateTareas(rec.code, (all) => {
      const at = (id) => (Object.prototype.hasOwnProperty.call(all, id) && all[id] && typeof all[id] === 'object' ? all[id] : (all[id] = {}));
      lists.heard.forEach((id) => { const e = at(id); if (!e.h) e.h = now; });
      lists.sent.forEach((id) => { const e = at(id); if (!e.h) e.h = now; if (!e.s) e.s = now; });   // sent = heard too
      lists.unsent.forEach((id) => { const e = at(id); delete e.s; });
    }, { activity: true });
    // 🪙 a homework of the kid's own level marked «¡Ya la mandé!» pays (core/zoco.js PAY.hw), «Deshacer» takes it back
    if (lists.sent.length || lists.unsent.length) coins = _zocoPay(rec.code, (r) => Zoco.settleHw(r, _zocoHwIds(r)));
    else coins = _zocoPay(rec.code, () => ({ got: 0, items: [] }));
  }
  res.json(Object.assign({ ok: true, who, marks: _tareaMarks(Students.get(rec.code)) }, unknown.length ? { unknown } : {}, _zocoOut(coins) ? { coins: _zocoOut(coins) } : {}));
});
// ── 🎯 El Entrenamiento (phase 4, 2026-10-16): quick rounds graded here (core/entrenamiento.js) ─────────────────────
// GET  /api/ruta/train?level=yct1&s=1-17,20            → the level's practice worlds for this visitor: open or not (the
//                                                        account's seals + `s` = the seals this phone holds: a free
//                                                        tap carries no secret), the account's best %, the Dorado rule
// POST /api/ruta/train/round  { level, world, s }      → a round: ~10 questions WITHOUT their right answers
// POST /api/ruta/train/answer { round, i, chosen }     → right or wrong + the right answer, only once answered (the
//                                                        first answer counts)
// POST /api/ruta/train/finish { round }                → the % counted here; the best goes on the logged-in kid's record
//                                                        (a key-only phone gets a signed proof instead)
// GET  /api/ruta/train/voice/<round>/<i>/<part>        → the question's audio (part: ask · o0…o3 · after, once answered)
// POST /api/ruta/train/scores { level, who, proofs }   → a key-only phone's proofs join the logged-in kid's account
// Every call asks LevelKeys.access for the level first (the one door); a round answers only the phone or account that
// started it. Never a right answer before the kid answered, never a % taken from the phone.
const _trainHits = new Map();
function _trainRate(key, win, max) {
  const now = Date.now();
  const arr = (_trainHits.get(key) || []).filter((t) => now - t < win);
  if (arr.length >= max) { _trainHits.set(key, arr); return false; }
  arr.push(now);
  _trainHits.set(key, arr);
  return true;
}
// the counters forget on a timer (never on a request: a flood can't make every request walk them), with a hard size
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _trainHits) if (!v.length || now - v[v.length - 1] > 10 * 60 * 1000) _trainHits.delete(k);
  if (_trainHits.size > 50000) _trainHits.clear();
}, 60 * 1000).unref();
// who is asking: the logged-in kid (their account), this phone (its id), a teacher (their id). Only a new round gives a
// phone its id (the `dkd` cookie of core/level-keys.js); every later call reads the one it has (none = no round of it).
function _trainWho(req, res, a, create) {
  const t = a && a.via === 'teacher' ? _teacherOf(req) : null;
  let dev = '';
  if (create) dev = LevelKeys.deviceId(req, res);
  else { const c = SimLock.readCookie(req, LevelKeys.DEVICE_COOKIE); if (/^[a-f0-9]{24}$/.test(c)) dev = c; }
  return { code: a && a.via !== 'teacher' && a.studentCode ? a.studentCode : null, dev,
    tid: t ? (t.teacher ? String(t.teacher.uid || t.teacher.teacherId) : '*') : null, tw: t ? _trainTeacherWho(req) : null };
}
// (review 2026-10-18) WHO plays on a teacher device, as an opaque id: the teacher (their uid, or the legacy password) AND
// the kid logged in at /homework on that device, if any. js/entrenamiento.js keeps a teacher's own rounds on the device
// under it (localStorage draly_train_t_<level>), so teacher B on a shared laptop never sees teacher A's green worlds, and a
// kid logged in on a remembered teacher device never sees or writes into the teacher's. Never the teacher's code, never
// the kid's code (an HMAC). → 'hex' | null (not a teacher)
function _trainTeacherWho(req) {
  const t = _teacherOf(req);
  if (!t) return null;
  const tid = t.teacher ? String(t.teacher.uid || t.teacher.teacherId) : '*';
  const kid = _studentOf(req);
  return SimLock.hmacHex('train-teacher:' + tid + '|' + (kid ? kid.code : ''), 12);
}
const _trainOwner = (who) => (who.tid ? 't:' + who.tid : who.code ? 's:' + who.code : 'd:' + who.dev);
// the level's door for a training call → { lvl, a } or null (the response is written)
function _trainDoor(req, res, raw) {
  res.set({ 'Cache-Control': 'private, no-store', 'Cloudflare-CDN-Cache-Control': 'no-store' });
  const lvl = Levels.normalize(raw);
  if (!lvl || !Train.worldsOf(lvl)) { res.status(404).json({ ok: false, error: 'Ese nivel no tiene El Entrenamiento.' }); return null; }
  const a = levelAccess(req, lvl);
  if (!a.ok) { res.status(401).json({ ok: false, locked: true, level: lvl }); return null; }
  return { lvl, a };
}
// the seals a phone says it holds ('1-17,20', ranges of word numbers of the level's base)
function _trainClaimed(lvl, s) {
  const b = RutaProgress.baseOf(lvl);
  const str = typeof s === 'string' ? s.slice(0, 2000) : '';
  return b && str ? RutaProgress.decodeSeals(str, b.words) : null;
}
const _trainRec = (a) => (a.via !== 'teacher' && a.studentCode ? Students.get(a.studentCode) : null);
app.get('/api/ruta/train', (req, res) => {
  const d = _trainDoor(req, res, req.query && req.query.level);
  if (!d) return;
  if (!_trainRate('i:' + _clientIp(req), 5 * 60 * 1000, 4000)) return res.status(429).set('Retry-After', '30').json({ ok: false, error: 'Espera un momento.' });
  const rec = _trainRec(d.a);
  const v = Train.view(d.lvl, rec, d.a, _trainClaimed(d.lvl, req.query.s));
  const info = Levels.info(d.lvl);
  // (review 2026-10-18) tw = a teacher device's opaque person id (its own rounds are kept under it); done = the finished
  // rounds of THIS phone or teacher whose result the page may never have heard (Train.doneFor; an account needs none)
  const tw = d.a.via === 'teacher' ? _trainTeacherWho(req) : null;
  res.json(Object.assign({ ok: true, slug: info.pack || d.lvl, name: info.name, base: info.base || null, student: !!rec, teacher: d.a.via === 'teacher',
    who: rec ? _sealWho(rec.code) : null, tw, live: RutaProgress.getSettings().trainingLive }, v,
    { done: rec ? [] : Train.doneFor(d.lvl, _trainWho(req, res, d.a)) }));
});
app.post('/api/ruta/train/round', (req, res) => {
  const b = req.body || {};
  const d = _trainDoor(req, res, b.level);
  if (!d) return;
  // (the address first: a class shares one, 600 rounds in 10 minutes is far above two classes at once)
  const ip = _clientIp(req);
  if (!_trainRate('ri:' + ip, 10 * 60 * 1000, 600)) return res.status(429).set('Retry-After', '30').json({ ok: false, error: 'Muchas rondas seguidas: espera un momento.' });
  const who = _trainWho(req, res, d.a, true);
  if (!_trainRate('r:' + _trainOwner(who), 10 * 60 * 1000, 40)) return res.status(429).set('Retry-After', '30').json({ ok: false, error: 'Muchas rondas seguidas: espera un momento.' });
  const out = Train.startRound(d.lvl, String(b.world || ''), who, d.a, _trainRec(d.a), _trainClaimed(d.lvl, b.s), ip);
  if (!out.ok) return res.status(out.status || 400).json(out);
  res.json(out);
});
// a call about a round: its level's door first, then the round's owner (core/entrenamiento.js)
function _trainRoundDoor(req, res, id) {
  res.set({ 'Cache-Control': 'private, no-store', 'Cloudflare-CDN-Cache-Control': 'no-store' });
  const lvl = Train.roundLevel(String(id || ''));
  if (!lvl) { res.status(410).json({ ok: false, gone: true, error: 'Esta ronda ya terminó. ¡Empieza otra!' }); return null; }
  return _trainDoor(req, res, lvl);
}
app.post('/api/ruta/train/answer', (req, res) => {
  const b = req.body || {};
  const d = _trainRoundDoor(req, res, b.round);
  if (!d) return;
  if (!_trainRate('ai:' + _clientIp(req), 10 * 60 * 1000, 8000)) return res.status(429).set('Retry-After', '20').json({ ok: false, error: 'Espera un momento.' });
  const out = Train.answer(String(b.round), b.i, b.chosen, _trainWho(req, res, d.a));
  if (!out.ok) return res.status(out.status || 400).json(out);
  res.json(out);
});
app.post('/api/ruta/train/finish', (req, res) => {
  const b = req.body || {};
  const d = _trainRoundDoor(req, res, b.round);
  if (!d) return;
  const rec = _trainRec(d.a);
  if (rec) _zocoOpen(rec.code);                          // 🪙 (before the step: a world at its goal before El Zoco never pays)
  const out = Train.finish(String(b.round), _trainWho(req, res, d.a), d.a, rec);
  if (!out.ok) return res.status(out.status || 400).json(out);
  // 🪙 PAY.train the first time a world reaches its goal (core/zoco.js; a replayed round pays nothing more)
  const coins = rec && out.saved ? _zocoOut(_zocoPay(rec.code, (r) => Zoco.settleTrain(r, d.lvl, RutaProgress.getSettings().doradoPct))) : undefined;
  res.json(coins ? Object.assign({}, out, { coins }) : out);
});
app.get('/api/ruta/train/voice/:round/:i/:part', (req, res) => {
  const d = _trainRoundDoor(req, res, req.params.round);
  if (!d) return;
  if (!_trainRate('v:' + _clientIp(req), 5 * 60 * 1000, 40000)) return res.status(429).set('Retry-After', '20').json({ ok: false });
  const out = Train.voice(String(req.params.round), req.params.i, String(req.params.part || ''), _trainWho(req, res, d.a));
  if (!out.ok) return res.status(out.status || 404).json({ ok: false });
  // (kept by the phone for the round's hour only, on success: an error is never kept)
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin' });
  if (out.file) {
    res.set('Cache-Control', 'private, max-age=3600').type('audio/mpeg');
    return res.sendFile(out.file, { cacheControl: false }, (err) => { if (err && !res.headersSent) res.status(404).set('Cache-Control', 'no-store').end(); });
  }
  _ttsServe(req, res, out.text, TTS_DEFAULT_VOICE, { trusted: true, cacheControl: 'private, max-age=3600' });
});
// a question's picture by the round (never the picture's own file name: it would say a «¿Cómo se dice?»'s answer)
app.get('/api/ruta/train/pic/:round/:i', (req, res) => {
  const d = _trainRoundDoor(req, res, req.params.round);
  if (!d) return;
  if (!_trainRate('v:' + _clientIp(req), 5 * 60 * 1000, 40000)) return res.status(429).set('Retry-After', '20').json({ ok: false });
  const out = Train.picture(String(req.params.round), req.params.i, _trainWho(req, res, d.a));
  if (!out.ok) return res.status(out.status || 404).json({ ok: false });
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin', 'Cache-Control': 'private, max-age=3600' }).type('image/webp');
  res.sendFile(out.file, { cacheControl: false }, (err) => { if (err && !res.headersSent) res.status(404).set('Cache-Control', 'no-store').end(); });
});
// one picture option of an exam drill («toca la foto»: core/entrenamiento-drills.js), by its place in the round: the
// same doors as the question's picture, never a file name
app.get('/api/ruta/train/pic/:round/:i/:k', (req, res) => {
  const d = _trainRoundDoor(req, res, req.params.round);
  if (!d) return;
  if (!_trainRate('v:' + _clientIp(req), 5 * 60 * 1000, 40000)) return res.status(429).set('Retry-After', '20').json({ ok: false });
  const out = Train.picture(String(req.params.round), req.params.i, _trainWho(req, res, d.a), String(req.params.k));
  if (!out.ok) return res.status(out.status || 404).json({ ok: false });
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin', 'Cache-Control': 'private, max-age=3600' }).type('image/webp');
  res.sendFile(out.file, { cacheControl: false }, (err) => { if (err && !res.headersSent) res.status(404).set('Cache-Control', 'no-store').end(); });
});
app.post('/api/ruta/train/scores', (req, res) => {
  const b = req.body || {};
  const d = _trainDoor(req, res, b.level);
  if (!d) return;
  const rec = _trainRec(d.a);
  if (!rec) return res.status(403).json({ ok: false, student: false, error: 'Entra con tu código para guardar tus puntos en tu cuenta.' });
  if (!_trainRate('s:' + rec.code, 60 * 1000, 30)) return res.status(429).set('Retry-After', '20').json({ ok: false, error: 'Espera un momento.' });
  const who = _sealWho(rec.code);
  if (b.who != null && String(b.who) !== who) return res.status(409).json({ ok: false, who, error: 'Otra cuenta entró en este teléfono.' });
  _zocoOpen(rec.code);                                   // 🪙 (before the step)
  const out = Train.mergeProofs(rec.code, d.lvl, b.proofs, _trainWho(req, res, d.a));
  if (!out.ok) return res.status(out.status || 400).json(out);
  // 🪙 this phone's own rounds from before the login (signed proofs, each joins one account only) pay like a round now
  const coins = out.merged ? _zocoOut(_zocoPay(rec.code, (r) => Zoco.settleTrain(r, d.lvl, RutaProgress.getSettings().doradoPct))) : undefined;
  res.json(Object.assign({ ok: true, who, merged: out.merged, best: Train.bestOf(Students.get(rec.code), d.lvl) }, coins ? { coins } : {}));
});
// ── 📖 El libro dorado (phase 5, 2026-10-16): the golden book on the web (core/golden.js) ──────────────────────────
// GET /api/golden/<level>/<n>[?de=<teacher link>] → simulation n's book for THIS visitor, or why not (never cached)
// GET /golden-media/<book>/<n|ex>/<p|a><i>           → a photo / a clip of that simulation (or of the examples), by index
// GET /golden-media/<book>/book.pdf                  → the PDF, for the super admin only (his rule 2026-10-18)
// Doors, in order (his picks): the level's key (LevelKeys.access, the one door: 401 = the key screen) → a kid's account
// (a key-only phone has none: «Entra con tu código») → THAT simulation taken (Golden.taken: a graded try on the record
// that really answered the exam). Taken anywhere is enough (his pick after the build): a simulation taken in a
// teacher's room opens its own book (its photos, clips and the examples) even before El Simulacro Dorado
// (RutaProgress.doradoOpen); a simulation not taken answers `why: 'dorado'` while the Dorado is closed (the kid can't
// take it alone yet), else `why: 'taken'`; the PDF is the super admin's only (2026-10-18). A teacher (code header
// or remembered teacher device) passes the other doors; with ?de= (the sealed link of /maestro's «Ver su libro») and a teacher
// session that may see that kid, the page shows that kid's mistakes. Views only read: nothing here writes on a record.
// Rates (fixed windows of 5 minutes, counted AFTER the door so nobody spends another's budget on a school's one Wi-Fi):
// a teacher never waits; a kid's account 600 book views and 6000 files; refused or unknown requests 300 per address.
const _goldenWin = new Map();   // key → { start, n }
const GOLDEN_WIN = 5 * 60 * 1000;
function _goldenRate(key, max) {
  const now = Date.now();
  let e = _goldenWin.get(key);
  if (!e || now - e.start >= GOLDEN_WIN) {
    if (!e && _goldenWin.size >= 50000) return false;   // a flood of new keys: refuse rather than grow
    e = { start: now, n: 0 };
    _goldenWin.set(key, e);
  }
  if (e.n >= max) return false;
  e.n++;
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, e] of _goldenWin) if (now - e.start >= GOLDEN_WIN) _goldenWin.delete(k);
}, 60 * 1000).unref();
// one budget per visitor kind: → true when the request may go on
const _goldenOk = (req, door, kind) => (door.ok ? (door.teacher || _goldenRate(kind + ':k:' + door.rec.code, kind === 'b' ? 600 : 6000))
  : _goldenRate('x:' + _clientIp(req), 300));
const _GOLDEN_NO_STORE = { 'Cache-Control': 'private, no-store', 'CDN-Cache-Control': 'no-store', 'Cloudflare-CDN-Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' };
// the attempts' totals as the graders count them today (old HSK: 10 points a question; 30-question sims grew to 40 in
// 2026-06): a try with another total is from before, its per-question record does not fit the book
const _goldenTotals = {};
Golden.configure({ totalOf: (simId) => {
  if (!(simId in _goldenTotals)) { const g = _simGrade(simId, {}); _goldenTotals[simId] = g ? Number(g.total) || null : null; }
  return _goldenTotals[simId];
} });
// → { ok: true, teacher, rec, dorado (El Simulacro Dorado open for this visitor) } | { ok: false, status, why: 'key' | 'login' }
function _goldenDoor(req, lvl) {
  const a = levelAccess(req, lvl);
  if (!a.ok) return { ok: false, status: 401, why: 'key' };
  if (a.via === 'teacher') return { ok: true, teacher: true, rec: null, dorado: true };
  const rec = a.studentCode ? Students.get(a.studentCode) : null;
  if (!rec) return { ok: false, status: 403, why: 'login' };
  return { ok: true, teacher: false, rec, dorado: RutaProgress.doradoOpen(a, rec, lvl) };
}
// the PDF holds every answer: since 2026-10-18 (his rule «study PDFs download only for the super admin») only a super
// admin downloads it (a kid, a parent or a regular teacher studies on the web pages, with their audio)
const _goldenPdfOk = (req) => _superOf(req);
const _goldenSimOk = (door, sim) => !!(door.ok && sim && (door.teacher || Golden.taken(door.rec, sim.id)));
const _goldenHref = (lvl, n) => '/audios/' + (Levels.info(lvl).pack || lvl) + '/libro/' + n;
app.get('/api/golden/:level/:n', (req, res) => {
  res.set(_GOLDEN_NO_STORE);
  const lvl = Levels.normalize(req.params.level);
  const b = lvl ? Golden.ofLevel(lvl) : null;
  const sim = b ? Golden.simOf(b, req.params.n) : null;
  const door = sim ? _goldenDoor(req, lvl) : { ok: false };
  if (!_goldenOk(req, door, 'b')) return res.status(429).set('Retry-After', '30').json({ ok: false, why: 'wait', error: 'Espera un momento.' });
  if (!sim) return res.status(404).json({ ok: false, error: 'Ese libro no existe.' });
  const info = Levels.info(lvl);
  const slug = info.pack || lvl;
  // (without the level's key nothing of the book travels: not its title, its simulations or their players)
  if (!door.ok && door.why === 'key' && !(req.query && req.query.de && Golden.readTeacherLink(String(req.query.de)))) {
    return res.status(401).json({ ok: false, why: 'key', locked: true, level: lvl, slug });
  }
  const head = { level: lvl, slug, name: info.name, book: b.id, title: b.title, n: sim.n,
    simCount: b.sims.length, player: (/^hsk\d/.test(sim.id) ? '/hsk-sim.html?sim=' : '/yct-sim.html?sim=') + encodeURIComponent(sim.id),
    pct: RutaProgress.getSettings().doradoPct };   // (the Dorado's % per world, for «Se abre cuando practiques… con 70 %»)
  // 🔒 2026-10-18 (DORADO_SELF_SERVE off): only a teacher gets a player's link; a kid's book says «tu profe lo abre en clase»
  head.solo = DORADO_SELF_SERVE || !!door.teacher;
  if (!head.solo) head.player = null;
  // a teacher's «Ver su libro» opened where this browser is no teacher's (no remembered device): the page offers to
  // remember it with the /maestro code it holds, never shows a kid's message
  if (!door.ok && req.query && req.query.de && Golden.readTeacherLink(String(req.query.de))) {
    return res.status(403).json({ ok: false, why: 'teacher', level: lvl, slug, name: info.name, n: sim.n });
  }
  if (!door.ok) return res.status(door.status).json(Object.assign({ ok: false, why: door.why }, head));
  // a teacher's «Ver su libro»: that kid's attempts (only for a teacher session that may see the kid)
  let rec = door.rec, kid = null;
  if (door.teacher && req.query && req.query.de) {
    const link = Golden.readTeacherLink(String(req.query.de));
    const r = link && Levels.normalize(link.level) === lvl ? Students.get(link.code) : null;
    if (!r || !_canSessionTouchStudent(_teacherOf(req), r)) return res.status(403).json(Object.assign({ ok: false, why: 'link' }, head));
    rec = r;
    kid = { name: String(r.displayName || 'Anon').slice(0, 40) };
  }
  const sum = Golden.summary(b, rec, door.teacher && !kid, door.dorado);
  if (kid) sum.sims.forEach((s) => { s.open = true; });     // the teacher sees every book; the kid's tries mark theirs
  // a simulation not taken: while the Dorado is closed the kid can't take it alone yet («Primero, El Simulacro Dorado»)
  if (!_goldenSimOk(door, sim)) return res.status(403).json(Object.assign({ ok: false, why: !head.solo ? 'clase' : door.dorado ? 'taken' : 'dorado', sims: sum.sims }, head));
  const mine = Golden.attemptView(rec ? Golden.latest(rec, sim.id) : null, sim);
  res.json(Object.assign({ ok: true, who: kid ? 'teacher-kid' : (door.teacher ? 'teacher' : 'kid'), kid, dorado: !!door.dorado }, head, {
    sim: Golden.simView(b, sim.n), examples: Golden.examplesView(b), review: b.review || [], mine, sims: sum.sims,
    pdf: Object.assign({}, sum.pdf, { left: door.teacher ? 0 : sum.left, dorado: !!door.dorado, ready: _goldenPdfOk(req),
      href: _goldenPdfOk(req) ? '/golden-media/' + b.id + '/book.pdf?v=' + encodeURIComponent((b.pdf && b.pdf.v) || '') : null }),
  }));
});
function _goldenMediaDoor(req, res, bookId) {
  res.set(_GOLDEN_NO_STORE);
  res.set('Cross-Origin-Resource-Policy', 'same-origin');
  // only a book a level names (core/levels.js `golden`): an unknown name never reaches the disk or a cache
  const l = Levels.LEVELS.find((x) => x.golden && x.golden === String(bookId || ''));
  const b = l ? Golden.book(l.golden) : null;
  const door = b ? _goldenDoor(req, l.id) : { ok: false };
  if (!_goldenOk(req, door, 'm')) { res.status(429).set('Retry-After', '20').type('text').send('Espera un momento.'); return null; }
  if (!b) { res.status(404).type('text').send('Not found'); return null; }
  if (!door.ok) { res.status(door.status).type('text').send('Forbidden'); return null; }
  return { b, lvl: l.id, door };
}
app.get('/golden-media/:book/book.pdf', (req, res) => {
  const d = _goldenMediaDoor(req, res, req.params.book);
  if (!d) return;
  // the PDF holds every answer: a super admin only (2026-10-18); everyone else studies on the web pages
  if (!_goldenPdfOk(req)) return res.status(403).type('text').send('Forbidden');
  const name = String(d.b.title || d.b.id).replace(/[^\w .·-]/g, '');
  res.type('application/pdf').set('Content-Disposition', 'attachment; filename="' + d.b.id + '.pdf"; filename*=UTF-8\'\'' + encodeURIComponent(name + '.pdf'));
  res.sendFile(Golden.pdfFile(d.b), { cacheControl: false, lastModified: false }, (err) => {
    if (err && !res.headersSent) res.status(404).type('text').send('Not found');
  });
});
app.get('/golden-media/:book/:where/:name', (req, res) => {
  const d = _goldenMediaDoor(req, res, req.params.book);
  if (!d) return;
  const where = String(req.params.where);
  // the examples («Así es el examen») go with any book this visitor may open; a simulation's files with that book only
  const ok = where === 'ex' ? (d.door.teacher || d.b.sims.some((s) => Golden.taken(d.door.rec, s.id)))
    : _goldenSimOk(d.door, Golden.simOf(d.b, where));
  if (!ok) return res.status(403).type('text').send('Forbidden');
  const f = Golden.mediaFile(d.b, where, req.params.name);
  if (!f) return res.status(404).type('text').send('Not found');
  // (the phone keeps a file a week: its address carries the file's content stamp, ?v=; Cloudflare keeps nothing)
  res.set('Cache-Control', 'private, max-age=604800').type(f.type);
  res.sendFile(f.abs, { cacheControl: false, lastModified: false }, (err) => {   // Range requests for the clips
    if (err && !res.headersSent) res.status(404).set('Cache-Control', 'no-store').type('text').send('Not found');
  });
});
// «Salir» on /homework (2026-10-16): the kid's session on this phone ends (the next kid on a family phone writes no
// seals or results on them); their codes stay saved on the phone, so coming back is still one tap on «Entrar».
app.post('/api/homework/logout', (req, res) => {
  SimLock.setCookie(req, res, SimLock.COOKIE, '', 0);
  _autoPark(req, res);   // 🆕 2026-10-18: a device's automatic account rests too (no renewal on page views)
  _kidPark(req, res);    // 🆕 2026-10-18 (la entrada): and the kid this phone remembers (no «¡Hola de nuevo!» by itself)
  res.set('Cache-Control', 'no-store').json({ ok: true });
});
// 🆕 2026-10-22 «Change level»: the kid's phone showed «Tu profe te cambió a <nivel> ✨» (js/level-note.js) → it is not
// shown again, on any phone. POST { at } (the change's moment, from the note). The kid's own session only, a page of ours.
app.post('/api/homework/level-note', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (!_autoSameSite(req)) return res.status(403).json({ ok: false });
  const rec = _studentOf(req);
  if (!rec) return res.status(401).json({ ok: false });
  if (!_autoHit('ln:' + rec.code, 60 * 1000, 30)) return res.status(429).json({ ok: false });
  res.json({ ok: true, seen: Students.seeLevelNote(rec.code, Number((req.body || {}).at) || 0) });
});
// ── 🔑 La Base files: /base-media/<base id>/<file> (2026-10-15) ────────────────────────────────────────────────────
// protected/base/<base id>/ (base.json, the clips, pics/) and protected/study/<level>-vocabulario.pdf (as book.pdf).
// Checked on every file (the level's device key cookie or the logged-in kid's account, core/level-keys.js), private to
// the phone (never kept by Cloudflare: not under /assets/, Cloudflare-CDN-Cache-Control no-store), and the clips and
// pictures carry their ?v= content stamps, so the phone may keep them a week.
const BASE_DIR = path.join(__dirname, 'protected', 'base');
const STUDY_DIR = path.join(__dirname, 'protected', 'study');
const BASE_TYPES = { '.mp3': 'audio/mpeg', '.webp': 'image/webp', '.json': 'application/json; charset=utf-8', '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.png': 'image/png' };
// 'yct1-base' / 'HSK2-base' (the stored id's old address) → { id: 'newhsk1-base', level: 'hsk2', pack: 'newhsk1' } or null
function _baseOf(raw) {
  let id = String(raw || '').toLowerCase();
  Levels.LEVELS.forEach((l) => { if (l.pack && l.pack !== l.id && id.indexOf(l.id + '-') === 0) id = l.pack + id.slice(l.id.length); });
  const l = Levels.LEVELS.find((x) => x.base && x.base === id);
  return l ? { id, level: l.id, pack: l.pack } : null;
}
// a base's page data without its `book` (the PDF's address, pages, size): what everyone but the super admin gets
// (2026-10-18). Kept in memory per base, read again when the file changes (a rebuild while the server runs).
const _baseJsonCache = new Map();   // base id → { mtime, text }
function _baseJsonNoPdf(id) {
  const file = path.join(BASE_DIR, id, 'base.json');
  let st;
  try { st = fs.statSync(file); } catch (_) { return null; }
  const c = _baseJsonCache.get(id);
  if (c && c.mtime === st.mtimeMs) return c.text;
  let text;
  try { const d = JSON.parse(fs.readFileSync(file, 'utf8')); delete d.book; text = JSON.stringify(d); } catch (_) { return null; }
  _baseJsonCache.set(id, { mtime: st.mtimeMs, text });
  return text;
}
function _baseMediaFile(req, res) {
  res.set({ 'CDN-Cache-Control': 'no-store', 'Cloudflare-CDN-Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex', 'Cross-Origin-Resource-Policy': 'same-origin' });
  const b = _baseOf(req.params.base);
  const rest = String(req.params[0] || '');
  if (!b || !/^(pics\/)?[A-Za-z0-9_-]+\.(mp3|webp|json|pdf|jpg|png)$/.test(rest)) {
    return res.status(404).set('Cache-Control', 'no-store').type('text').send('Not found');
  }
  if (!LevelKeys.access(req, b.level).ok) {
    return res.status(401).set('Cache-Control', 'private, no-store').json({ ok: false, locked: true, level: b.level });
  }
  // 🔒 2026-10-18 (his rule): the vocabulary PDF is a download for the super admin only; families study on the page
  // (with its audio). The page's data names the PDF only to the super admin, so nobody else sees a download button.
  const superAdmin = _superOf(req);
  if (rest === 'book.pdf' && !superAdmin) return res.status(403).set('Cache-Control', 'private, no-store').type('text').send('Forbidden');
  if (rest === 'base.json' && !superAdmin) {
    const j = _baseJsonNoPdf(b.id);
    if (!j) return res.status(404).set('Cache-Control', 'no-store').type('text').send('Not found');
    return res.set('Cache-Control', 'private, no-cache').type(BASE_TYPES['.json']).send(j);
  }
  const file = rest === 'book.pdf' ? path.join(STUDY_DIR, b.pack + '-vocabulario.pdf') : path.join(BASE_DIR, b.id, rest);
  const ext = path.extname(file).toLowerCase();
  res.set('Cache-Control', ext === '.json' ? 'private, no-cache' : 'private, max-age=604800');
  res.type(BASE_TYPES[ext] || 'application/octet-stream');
  if (rest === 'book.pdf') res.set('Content-Disposition', 'inline; filename="' + b.pack + '-vocabulario.pdf"');
  res.sendFile(file, { cacheControl: false }, (err) => {   // Range requests for the clips
    if (err && !res.headersSent) res.status(err.statusCode || 404).set('Cache-Control', 'no-store').type('text').send('Not found');
  });
}

// Record the server boot time so the heartbeat above can be compared
// across deploys. If your disk is genuinely persistent, the heartbeat
// file from a PREVIOUS boot will still be there when this boots again.
const serverStartTime = new Date().toISOString();

// ---- Question Sets API ----
// Curriculum picker tree: family → level → world → round (core/packs.js)
app.get('/api/packs', (req, res) => res.json({ families: require('./core/packs').catalog() }));

app.get('/api/sets', (req, res) => {
  try {
    res.json({ sets: Sets.listSets() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/sets/:id', (req, res) => {
  try {
    const set = Sets.loadSet(req.params.id);
    if (!set) return res.status(404).json({ error: 'Set not found' });
    // 🔒 2026-10-15 — a «Simulacro del examen» round is the simulations' own questions WITH their answers: its name
    // only (all games.html needs), unless a teacher code comes along. Games load rounds on the server (host:load-set).
    if (/^pack:[a-z0-9]+-simulacro-/i.test(String(req.params.id))) {
      const h = req.headers || {};
      const teacher = (h['x-admin-pw'] || h['x-admin-password']) && _adminAuth(req, null);
      if (!teacher) return res.set('Cache-Control', 'no-store').json({ id: set.id, title: set.title, filename: set.filename, questions: [], locked: true });
    }
    res.json(set);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/sets', (req, res) => {
  try {
    const { filename, content } = req.body || {};
    if (!filename || !content) return res.status(400).json({ error: 'Missing filename or content' });
    const buffer = Buffer.from(content, 'base64');
    const set = Sets.saveSet(filename, buffer);
    res.json(set);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/sets/:id', (req, res) => {
  try {
    const ok = Sets.deleteSet(req.params.id);
    res.json({ ok });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/sets/:id/rename', (req, res) => {
  try {
    const { title } = req.body || {};
    const out = Sets.renameSet(req.params.id, title);
    if (!out) return res.status(404).json({ error: 'Set not found' });
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// 🔒 2026-10-16: no prototype (a «PIN» like __proto__ must never reach Object.prototype through games[pin])
const games = Object.create(null);

// Home page «Volver a la partida»: only offer the rematch while that room is still open (booleans only).
// 🔒 2026-10-17: the home page's «¿volver a tu juego?» check (public/index.html) counts like a join: a PIN that is no
// running room spends one of the address's PIN guesses, and an address out of guesses hears «not alive» for every PIN,
// so it can no longer list the running classes (it answered any PIN, unlimited, in ~25 s for all 900).
app.get('/api/room-alive/:pin', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const pin = String(req.params.pin || '');
  if (!/^\d{3,4}$/.test(pin) || _pinBlocked(req)) return res.json({ alive: false });
  const g = games[pin];
  const alive = !!g && g.state !== 'ended';
  if (!alive) _pinMiss(req, pin);
  res.json({ alive });
});

const MASH_DURATION_MS = 5000;
const TAP_MIN_INTERVAL_MS = 70;
const COMBO_WINDOW_MS = 1000;
const COMBO_THRESHOLD = 8;
const WRONG_PENALTY = 3;
const COUNTDOWN_MS = 3500;

// Retired 2026-10-10: Market Quest, Color Clash, Color Splash, Flappy, Zombie, Mi Familia, Conquest, Triage, Lái-Qù-Huí, Shéi Shì, Hóngbāo Run (their constants and helpers were removed).

// === WARM-UP MODE · sentence-builder broadcast tool ===
// Teacher-driven flashcard mode. The teacher picks Chinese words from a
// library on the host page, and the constructed sentence broadcasts live
// to every player phone. Color-coded by category so kids can see how the
// pinyin words map to Spanish word-for-word.
// No timer, no scoring, no game loop — teacher exits when ready.
// 2026-05-27: unified admin password gate. ANY of the following grants
// admin powers in the live-game socket handlers below:
//   - WU_ADMIN_PASSWORD (the legacy password: the Render env var only, no
//     default since 2026-10-15, see _legacyPwOk)
//   - Any teacherId from teachers.json (so the super admin + every regular
//     teacher can host their own warmup sessions, save presets, see the
//     Cuaderno, etc., using ONE code — same one they use to log into /maestro)
//
// This solves user feedback 2026-05-27: "I should be super admin and
// have that privilege everywhere — don't make me re-enter passwords."
// 🔒 2026-10-17: a socket checks a code ONLY through _socketCode below (the wrong-code turnstile); the old
// isAdminPassword / isSuperAdminPassword are gone so no new handler reads a code without it.
// ── 🔒 2026-10-16 — who opened a live room, and who may take its projector back (host:create / host:reclaim) ──────
// A room's owner is a teacher's uid ('*' = the legacy super-admin password or its remembered device).
const _ownerOfTeacher = (t) => (t ? (t.teacher ? t.teacher.uid : '*') : null);
function _ownerOfCode(code) {
  const p = String(code == null ? '' : code).trim();
  if (!p) return null;
  if (_legacyPwOk(p)) return { owner: '*', superAdmin: true };
  const t = Teachers.getByTeacherId(p);
  return t ? { owner: t.uid, superAdmin: !!t.isSuperAdmin } : null;
}
// host:reclaim → 'ok' | 'host-live' | 'wait' | 'bad-password' | 'no-game'. `g` = the live room at that PIN, or null.
// The room's own secret (only the projector that opened it got it) always works at once: an F5 or a dropped connection
// of that projector (warm-up, reading and exam rooms also need a teacher code, and its own teacher's code never waits
// for the school's address). While the room's projector is still CONNECTED nothing else takes it (an old sleeping tab
// of the same teacher or of the super admin, whose PIN came back for a newer room, must never freeze a running class).
// Once the projector is gone: the same teacher by remembered device or code, or a super admin. A code is only read
// while its address has wrong codes left (the remembered device never waits). Every room follows this, warm-up,
// reading and exam rooms too (his decision 2026-10-17; they also need the teacher code). A room with no owner on record
// (an exam room saved to disk before 2026-10-17) goes back only to a super admin.
// 🔒 2026-10-17 (PIN oracle): only the room's own projector, its teacher or a super admin hears anything about a PIN.
// Anyone else is asked who they are FIRST, the same way for every PIN, and then gets the answer of an empty PIN
// ('no-game'), or 'bad-password' / 'wait' for a wrong code / a waiting address. Before, 'no-game' against
// 'bad-password' / 'not-host' / 'host-live' told running rooms from empty PINs to any socket, with no limit: a
// running exam room's PIN lets a stranger join it (player:join hands out the room pass), which is why player:join
// and the HTTP lookups count unknown PINs (_pinMiss). Any new socket handler that takes a PIN answers the same way.
const _RECLAIM_NEEDS_CODE = new Set(['warmup', 'reading', 'hsksim']);   // 🔒 exam rooms too (2026-10-15)
function _mayReclaim(g, socket, password, token) {
  const needsCode = !!g && _RECLAIM_NEEDS_CODE.has(g.gameType);
  const refused = (c) => (c.why === 'wait' ? 'wait' : 'bad-password');
  if (g && g.hostToken && token && _safeEqual(String(token), g.hostToken)) {
    if (!needsCode) return 'ok';
    const c = _socketCode(socket, password, _roomOwnerFor(g, token));
    return c.ok ? 'ok' : refused(c);
  }
  const mine = (w) => !!g && !!w && (w.superAdmin || (!!g.hostOwner && w.owner === g.hostOwner));
  const dev = LevelKeys.teacherDevice((socket.handshake && socket.handshake.headers) || {});
  let c = null;
  if (!(dev && mine({ owner: _ownerOfTeacher(dev), superAdmin: !!dev.isSuperAdmin }))) {
    c = _socketCode(socket, password);   // (a wrong code counts; 'wait' comes before a code is read)
    if (!c.ok) return c.why === 'none' ? 'no-game' : refused(c);
    if (!mine(c)) return 'no-game';      // a colleague's room, or no room at all: the same answer
  }
  // its teacher or a super admin from here on: the room may say how it is
  if (needsCode && !c) { c = _socketCode(socket, password); if (!c.ok) return refused(c); }
  if (g.hostId && io.sockets.sockets.get(g.hostId)) return 'host-live';
  return 'ok';
}
// ── 🔒 2026-10-17 — ONE door for every teacher code a live-game socket sends ───────────────────────────────────────
// The projector-lock review found the warm-up presets, the warm-up and reading teacher tools and the exam / warm-up /
// reading branch of host:reclaim reading codes with no turnstile: any socket could try codes as fast as it liked
// (Cloudflare's rate limit covers only HTTP /api). Every socket handler checks a code here, never by itself (the old
// isAdminPassword / isSuperAdminPassword are gone; `superAdmin` in the answer gates the super-only live tools, e.g.
// the random-Spanish prompt broadcast in Modo Maestro):
//   · an address with 10 wrong codes in 10 min waits (the admin turnstile, shared with HTTP), checked BEFORE the code
//     is read: a waiting address learns nothing, not even from a right code;
//   · every wrong code really sent counts; an empty one, or one retired by «Cambiar mi código», never does;
//   · a remembered teacher device (the dtd cookie on the handshake) never waits for its school's address: its own
//     wrong codes count on the device (10) and on its teacher's devices together (30) instead (_turnstile: kids on the
//     same Wi-Fi can't stop the teacher, and the teacher's devices can't try codes without limit either);
//   · a code this connection already proved goes on, and `owner` (a room's own projector, proved by its room token: an
//     F5 or a dropped connection) lets that room's own teacher's code through while the address waits: a running class
//     never freezes because the school's address filled up with wrong codes. Any other code on that path waits too and
//     counts as a miss for that teacher (10 like everywhere, then even the right one waits), so a stolen token can't
//     test the opener's code without limit. Being a room's host is NOT proof (a super admin, or the opener from another
//     device, can host it too: a host socket gets only the plain rule, so it can't test the opener's code).
// → { ok: true, owner, superAdmin } | { ok: false, why: 'none' | 'wait' | 'retired' | 'wrong' }
const _codeMark = (p) => require('crypto').createHash('sha256').update('draly-socket-code:' + p).digest('hex');
function _socketCode(socket, password, owner) {
  const p = String(password == null ? '' : password).trim();
  if (!p) return { ok: false, why: 'none' };
  const data = socket.data || (socket.data = {});
  const mark = p.length <= 512 ? _codeMark(p) : null;   // (a code is ~10 characters: megabytes are just wrong, cheaply)
  const proved = !!mark && Array.isArray(data.dralyCodes) && data.dralyCodes.includes(mark);
  let ts = null, waiting = false;
  if (!proved) {
    const hs = (socket.handshake && socket.handshake.headers) || {};
    const dev = LevelKeys.teacherDevice(hs);
    ts = _turnstile(dev, hs, dev ? null : _socketIp(socket));
    waiting = ts.waits();
    if (waiting && !owner) return { ok: false, why: 'wait' };
  }
  const who = mark ? _ownerOfCode(p) : null;
  if (waiting) {   // (only a room token gets here: see `owner` above)
    const okey = 'room-owner:' + owner;
    if (_adminFailCount(okey) >= 10) return { ok: false, why: 'wait' };
    if (!(who && who.owner === owner)) {
      if (!(mark && !who && Teachers.isRetired(p))) _adminNoteFail(okey);
      return { ok: false, why: 'wait' };
    }
  }
  if (!who) {
    if (mark && Teachers.isRetired(p)) return { ok: false, why: 'retired' };
    if (ts) ts.miss();
    return { ok: false, why: 'wrong' };
  }
  if (!proved) data.dralyCodes = (data.dralyCodes || []).concat(mark).slice(-4);
  return { ok: true, owner: who.owner, superAdmin: who.superAdmin };
}
// the room's own projector = the one that carries its room token (only the tab that opened the room got it)
const _roomOwnerFor = (g, token) => (g && g.hostOwner && g.hostToken && token
  && _safeEqual(String(token), g.hostToken)) ? g.hostOwner : null;
// 🔒 2026-10-17 (his decision) — who may close an exam room («Cerrar la sala», socket host:end): the owner rule of
// _mayReclaim on top of the teacher check. Before, any teacher code or remembered teacher device closed ANY exam room:
// one code tried over the 900 PINs closed every running exam mid-exam. A teacher always (a remembered teacher device,
// or a code through _socketCode), and then only the room's own projector (its room token), the teacher who opened it
// (`owner`: g.hostOwner, or `owner` in hsk-rooms.json for a room not hydrated yet) or a super admin. A room with no
// owner on record (saved before 2026-10-17) closes only for a super admin or its own projector. A right code refused
// here never counts as a wrong one. `g` = the live exam room or null. → 'ok' | 'wait' | 'not-teacher' | 'not-owner'
function _mayCloseExam(g, owner, socket, password, token) {
  const ownTab = !!(g && g.hostToken && token && _safeEqual(String(token), g.hostToken));
  const mine = (w) => !!w && (ownTab || w.superAdmin || (!!owner && w.owner === owner));
  const dev = LevelKeys.teacherDevice((socket.handshake && socket.handshake.headers) || {});
  if (dev && mine({ owner: _ownerOfTeacher(dev), superAdmin: !!dev.isSuperAdmin })) return 'ok';
  const c = _socketCode(socket, password, _roomOwnerFor(g, token));   // (a wrong code counts; 'wait' before it is read)
  if (c.why === 'wait') return 'wait';
  if (!c.ok) return dev ? 'not-owner' : 'not-teacher';
  return mine(c) ? 'ok' : 'not-owner';
}

function genPin() {
  // Prefer short 3-digit PINs (100-999) so kids can type them in 1 second.
  // If we ever have so many active games that 3-digit space is exhausted
  // (~50+ collisions in a row), fall back to a 4-digit PIN (1000-9999).
  let pin;
  for (let tries = 0; tries < 50; tries++) {
    pin = String(Math.floor(100 + Math.random() * 900));
    if (!games[pin] && !HSK_ROOMS.has(pin)) return pin;   // 🔒 never an open exam room's PIN (kept on disk across restarts)
  }
  do {
    pin = String(Math.floor(1000 + Math.random() * 9000));
  } while (games[pin] || HSK_ROOMS.has(pin));
  return pin;
}

function pickTeam(game) {
  const counts = { red: 0, gold: 0 };
  Object.values(game.players).forEach((p) => counts[p.team]++);
  return counts.red <= counts.gold ? 'red' : 'gold';
}

function publicState(game) {
  const out = {
    state: game.state,
    duration: game.duration,
    endsAt: game.endsAt,
    teamScores: game.teamScores,
    questionsLoaded: game.questions.length,
    setTitle: game.setTitle || null,
    gameType: game.gameType || null,
    players: Object.fromEntries(
      Object.entries(game.players).map(([id, p]) => [
        id,
        Object.assign({ name: p.name, team: p.team, score: p.score, avatar: p.avatar || '' }, p.disconnected ? { off: true } : {},
          p.mmId ? { k: p.mmId, sk: hcSkin(p) } : {}, game.gameType === 'pinata' && p.pnId ? { k: p.pnId, sk: hcSkin(p) } : {},
          game.gameType === 'sixseven' && p.ssId ? { k: p.ssId, sk: hcSkin(p) } : {})
      ])
    ),
    feed: game.feed.slice(-12)
  };
  // 6-7 Swing: the round style the teacher picked (the phones' lobby shows «Hoy: En Chino»)
  if (game.gameType === 'sixseven') out.ssStyle = Sixseven.cleanStyle(game.ssStyle);
  // Dragones Pintores v2: the world of this round (the phones' lobby shows its picture and name)
  if (game.gameType === 'paint') out.pcWorld = game.paint ? game.paint.sky.world : (game.pcWorld | 0);
  // La Gran Fuga v2: the route of this round (the phones' lobby shows its three places)
  if (game.gameType === 'escape') out.esRoute = game.escape ? game.escape.route : EscapeMap.routeIdx(game.esRoute);
  // Las Trampillas: the arena and the rounds of this match (the phones' lobby shows them)
  // Draly Cangrejo: «Todos contra Fénec» or «1 contra 3» (the phones' lobby shows the steps of the mode)
  if (game.gameType === 'teamcrab') out.tcMode = game.tc && game.state !== 'lobby' ? game.tc.mode : (game.tcMode === 'vs' ? 'vs' : 'crew');
  if (game.gameType === 'trapdoor') { out.tdArena = game.td ? game.td.arena : (game.tdArena | 0); out.tdRounds = game.td ? game.td.rounds : (game.tdRounds || Trap.R.ROUNDS); }
  // HSK rooms expose simId so kid clients know what to load when
  // state flips to 'active'. fx is the current animation overlay.
  if (game.gameType === 'hsksim' && game.hsk) {
    out.hsk = { simId: game.hsk.simId, fx: game.hsk.fx || null };
  }
  // Dàfùwēng · Monopolio: each kid's id (k) and character (sk) for the lobby, the boards and the greyed piece of a kid who left
  if (game.gameType === 'monopoly') Object.entries(game.players).forEach(([id, p]) => { if (p.mnK) Object.assign(out.players[id], { k: p.mnK, sk: hcSkin(p) }); });
  // Vuelo del Dragón: the same (the lobby, the races and the greyed dragon of a kid who left)
  if (game.gameType === 'dragon-eye') Object.entries(game.players).forEach(([id, p]) => { if (p.drK) Object.assign(out.players[id], { k: p.drK, sk: hcSkin(p) }); });
  return out;
}

// Throttled broadcast — coalesces rapid-fire calls (avatar swap, swap-team,
// join/rejoin churn) into at most one 'state' emit per 120ms per game.
// This is the cheapest lag win: instead of pushing 5-10 state events per
// second during busy moments, we push max ~8/s — clients still feel realtime
// but use 5x less bandwidth + render budget.
const BROADCAST_THROTTLE_MS = 120;
function broadcast(pin) {
  if (!games[pin]) return;
  const g = games[pin];
  const now = Date.now();
  // Always send if more than threshold has passed
  if (!g._lastBcast || now - g._lastBcast >= BROADCAST_THROTTLE_MS) {
    g._lastBcast = now;
    if (g._pendingBcast) { clearTimeout(g._pendingBcast); g._pendingBcast = null; }
    io.to(pin).emit('state', publicState(g));
    return;
  }
  // Coalesce: schedule a single trailing-edge broadcast so the latest state
  // gets through even if the burst keeps firing.
  if (g._pendingBcast) return;
  const wait = BROADCAST_THROTTLE_MS - (now - g._lastBcast);
  g._pendingBcast = setTimeout(() => {
    g._pendingBcast = null;
    if (!games[pin]) return;
    games[pin]._lastBcast = Date.now();
    io.to(pin).emit('state', publicState(games[pin]));
  }, Math.max(20, wait));
}

function nextQuestionFor(game, playerId) {
  const p = game.players[playerId];
  if (!p || !game.questions.length) return null;
  if (game.finalizing) return null;     // «¡FINAL!» (Reinos, Pintores, Nieve, Fuga): the round is over, no new question

  if (game.gameType === 'monopoly' && !(game.mn && game.mn.phase === 'play')) return null;   // Monopolio: questions only in play (mnTick deals)
  if (game.gameType === 'dragon-eye' && !(game.dr && game.dr.phase === 'play')) return null;   // Vuelo del Dragón: the same (drTick deals)

  // 6-7 Swing v2: its room tick deals every sum (ssDeal, core/sixseven.js); never a generic question
  if (game.gameType === 'sixseven') return null;
  if (game.gameType === 'dormilon') return null;   // Draly Siesta: its tick deals every kid's questions (dm:q)
  if (game.gameType === 'teamcrab') return null;   // ¡Atrapa a Fénec!: its tick deals every kid's questions (tc:q)

  const q = game.questions[p.queueIdx % game.questions.length];
  p.queueIdx++;
  const shuffled = [...q.answers];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const qid = `q-${p.queueIdx}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const image = Images.urlForQuestion(q);
  p.currentQ = { qid, correctIdx: shuffled.indexOf(q.correct), text: q.text, answers: shuffled, image };
  p.lastQuestionAt = Date.now();
  return { qid, text: q.text, answers: shuffled, image };
}

// === 🎲 DÀFÙWĒNG · MONOPOLIO v2 (gameType 'monopoly') — «El Gran Tablero de Dubái», a Mario Party board night ===
// Rules in core/monopoly.js (spec docs/specs/monopoly-v2.md). Boards of 4, every kid for themself, all boards on the same
// map. The boards are dealt when the countdown starts (each phone runs in with its own board, mn:init); one 200 ms tick
// per room runs the clock: intro → play (questions dealt, a dice window nobody tapped rolls by itself, time-ups called)
// → frenzy (last 30 s) → «¡FINAL!» (open dice windows still roll) → game-end (each phone its own board's ceremony and
// card, the projector every board + the class podium). A right answer opens a dice window (answer-result.monopoly); the
// tap (player:mn-roll) or the tick resolves the whole turn at once: the kid gets its script (mn:turn), the other phones
// of its board and the projector a copy (mn:move). Each board is a socket.io room of its own (the game id in its name,
// so «Otra ronda» never mixes boards). No full-room 'state' push on answers.
const MN_TICK_MS = 200;
function mnEnsureId(g, p) { if (!p.mnK) p.mnK = (g.mnNextK = (g.mnNextK || 0) + 1); return p.mnK; }
const mnRoom = (pin, m, bid) => `${pin}:mn:${m.id}:${bid}`;
function mnJoinRoom(pin, g, pid, p) {
  const m = g.mn;
  const r = m && Mono.kid(m, p.mnK);
  if (!r || r.b == null) return;
  const s = io.sockets.sockets.get(pid);
  if (s) s.join(mnRoom(pin, m, r.b));
}
function mnOnline(g) {
  const on = new Set();
  Object.values(g.players).forEach((p) => { if (p.mnK && !p.disconnected) on.add(p.mnK); });
  return (k) => on.has(k);
}
const mnClock = (m) => (m.paused ? m.pausedAt : Date.now());
function mnInitPayload(g, pid) {
  const m = g.mn;
  const clock = mnClock(m);
  const online = mnOnline(g);
  const out = {
    id: m.id, phase: m.phase, phaseMs: Math.max(0, m.phaseUntil - clock), paused: !!m.paused,
    endsMs: m.endsAt ? Math.max(0, m.endsAt - clock) : null, frenzy: !!m.frenzy,
    frenzyMs: m.frenzyAt ? Math.max(0, m.frenzyAt - clock) : null, duration: m.duration, boardsN: m.boards.length,
  };
  if (!pid) { out.boards = m.boards.map((b) => Mono.boardView(m, b, online)); return out; }
  const p = g.players[pid];
  const r = p && Mono.kid(m, p.mnK);
  if (!r || r.b == null) return out;
  const b = Mono.boardOf(m, r.b);
  out.board = b ? Mono.boardView(m, b, online) : null;
  out.you = {
    k: r.k, b: r.b, c: r.c, pos: r.pos, coins: r.coins, stars: r.stars, right: r.right, streak: r.streak, best: r.best,
    // an open dice window (with the time really left), a turn still playing (its script again), a wait
    turn: r.turn ? { tid: r.turn.tid, dice: r.turn.dice, msLeft: Math.max(0, Mono.R.LEAD_MS + Mono.R.DICE_MS - (clock - r.turn.sentAt)) } : null,
    busyMs: r.nextQAt ? Math.max(0, r.nextQAt - clock) : 0,
    last: r.last && r.nextQAt > clock ? r.last : null,
  };
  return out;
}
function mnStop(g) { if (g && g.mn && g.mn.timer) { clearInterval(g.mn.timer); g.mn.timer = null; } }
// The countdown starts: the boards are dealt now, so every phone runs in with its own board and the projector with all.
function mnDeal(pin, g) {
  mnStop(g);
  const now = Date.now();
  const m = Mono.newGame(1 + Math.floor(Math.random() * 1e9), g.duration, now);
  m.phase = 'countdown';
  m.phaseUntil = now + COUNTDOWN_MS;
  g.mn = m;
  Object.values(g.players).forEach((p) => { mnEnsureId(g, p); p.currentQ = null; p.mashUntil = 0; });
  Mono.deal(m, Object.values(g.players).filter((p) => !p.disconnected).map((p) => [p.mnK, p.name, hcSkin(p)]));
  Object.entries(g.players).forEach(([pid, p]) => {
    if (p.disconnected || !Mono.inGame(m, p.mnK)) return;
    mnJoinRoom(pin, g, pid, p);
    io.to(pid).emit('mn:init', mnInitPayload(g, pid));
  });
  io.to(g.hostId).emit('mn:init', mnInitPayload(g, null));
}
// A kid who wasn't dealt in (joined late, came back after the deal) sits at the smallest board; that board's phones and
// the projector get the new piece. Returns true when the kid got a new seat.
function mnSeatLate(pin, g, pid, p) {
  const m = g.mn;
  const b = Mono.seatLate(m, mnEnsureId(g, p), p.name, hcSkin(p));
  if (!b) return false;
  mnJoinRoom(pin, g, pid, p);
  const view = Mono.boardView(m, b, mnOnline(g));
  io.to(mnRoom(pin, m, b.id)).except(pid).emit('mn:seat', { board: view });
  io.to(g.hostId).emit('mn:seat', { board: view });
  return true;
}
// The countdown is over: the intro («¡Responde y tira el dado!» → «¿Listos?» → «¡YA!»), then mnPlay; the tick deals.
function mnStart(pin, g) {
  const m = g.mn;
  if (!m || m.phase !== 'countdown') return;
  const now = Date.now();
  m.phase = 'intro';
  m.phaseAt = now;
  m.phaseUntil = now + Mono.R.INTRO_MS;
  Object.entries(g.players).forEach(([pid, p]) => {
    mnEnsureId(g, p);
    p.currentQ = null;
    p.lastQuestionAt = now;
    if (!p.disconnected && !Mono.inGame(m, p.mnK)) { mnSeatLate(pin, g, pid, p); io.to(pid).emit('mn:init', mnInitPayload(g, pid)); }
  });
  g.endsAt = now + Mono.R.INTRO_MS + m.duration * 1000;
  io.to(pin).emit('mn:intro', { id: m.id, ms: Mono.R.INTRO_MS });
  mnStop(g);
  m.timer = setInterval(() => mnTick(pin, m), MN_TICK_MS);
}
function mnPlay(pin, g) {
  const m = g.mn;
  if (!m || m.phase !== 'intro') return;
  const now = Date.now();
  Mono.startPlay(m, now);
  g.endsAt = m.endsAt;
  io.to(pin).emit('mn:play', { id: m.id, endsMs: m.endsAt - now, frenzyMs: m.frenzyAt - now });
  g._lastBcast = 0;
  broadcast(pin);                      // (the next tick deals every kid's first question)
}
function mnSendQ(g, pid, p) {
  const q = nextQuestionFor(g, pid);
  if (q) io.to(pid).emit('question', q);
}
// A turn resolved (a tap, or by itself): the kid its script, the board's other phones and the projector the move.
function mnRoll(pin, g, pid, p, auto, now) {
  const m = g.mn;
  const t = Mono.roll(m, p.mnK, now, auto);
  if (!t) return null;
  if (!p.disconnected) io.to(pid).emit('mn:turn', t.script);
  io.to(mnRoom(pin, m, t.move.b)).except(pid).emit('mn:move', t.move);
  io.to(g.hostId).emit('mn:move', t.move);
  return t;
}
// A right / wrong / time-up answer. Right: the dice window opens (its tap or the tick rolls). Wrong: the wait.
function mnAnswer(pin, g, pid, p, correct, correctText, timeUp) {
  const m = g.mn;
  const now = Date.now();
  const res = Mono.answer(m, p.mnK, correct, now - (p.lastQuestionAt || now), now, !!timeUp);
  if (!res) return;
  if (res.right) io.to(pid).emit('answer-result', { correct: true, correctText, monopoly: Object.assign({ right: true, streak: res.streak }, res.turn) });
  else io.to(pid).emit('answer-result', { correct: false, correctText, monopoly: { right: false, wait: res.wait, calm: res.calm, tooFast: res.tooFast, timeUp: res.timeUp } });
  io.to(g.hostId).emit('mn:ans', { k: p.mnK, right: res.right });
}
function mnTick(pin, m) {
  const g = games[pin];
  if (!g || g.mn !== m || g.state !== 'active') { clearInterval(m.timer); m.timer = null; return; }
  if (m.paused) return;
  const now = Date.now();
  try {
    if (m.phase === 'intro') { if (now >= m.phaseUntil) mnPlay(pin, g); return; }
    if (m.phase !== 'play' && m.phase !== 'final') return;
    Object.entries(g.players).forEach(([pid, p]) => { try {
      const r = Mono.kid(m, p.mnK);
      if (!r || r.b == null) return;
      if (r.turn && now >= Mono.rollAt(r)) mnRoll(pin, g, pid, p, true, now);   // no tap in time: the dice roll by themselves
      if (m.phase !== 'play') return;
      // a question nobody answered: «time up» 3 s after the phone's 20 s (a frozen tab can't hold a kid)
      if (p.currentQ && now - (p.lastQuestionAt || now) >= Mono.R.Q_MS + Mono.R.Q_GRACE_MS) {
        const cq = p.currentQ;
        p.currentQ = null;
        mnAnswer(pin, g, pid, p, false, cq.answers[cq.correctIdx], true);
      }
      if (!p.disconnected && !p.currentQ && !r.turn && now >= (r.nextQAt || 0)) mnSendQ(g, pid, p);
    } catch (e) { console.error('[monopoly] kid', e); } });
    if (m.phase === 'play') {
      const ev = Mono.tick(m, now);
      ev.leads.forEach((l) => { io.to(mnRoom(pin, m, l.b)).emit('mn:lead', l); io.to(g.hostId).emit('mn:lead', l); });
      if (ev.frenzy) io.to(pin).emit('mn:frenzy', { endsMs: Math.max(0, m.endsAt - now) });
      if (now >= m.endsAt) mnFinal(pin, g);
    } else if (now >= m.phaseUntil) {
      // «¡FINAL!» is over: a dice window still open rolls now (a right answer is never lost), then the ceremony
      Object.entries(g.players).forEach(([pid, p]) => { const r = Mono.kid(m, p.mnK); if (r && r.turn) mnRoll(pin, g, pid, p, true, now); });
      mnStop(g);
      if (g.endTimer) { clearTimeout(g.endTimer); g.endTimer = null; }
      endGame(pin);
    }
  } catch (e) { console.error('[monopoly] tick', e); }
}
// «¡FINAL!» on every screen; the tick ends the game FINAL_MS later (a dice window still open can be tapped meanwhile).
function mnFinal(pin, g) {
  const m = g.mn;
  if (!m || m.phase === 'final' || m.phase === 'done') return;
  const now = Date.now();
  if (m.paused) {
    const shift = now - m.pausedAt;
    Mono.shiftTimes(m, shift);
    Object.values(g.players).forEach((p) => { if (p.lastQuestionAt) p.lastQuestionAt += shift; });
    m.paused = false;
  }
  if (m.phase !== 'play') {           // «Terminar» in the countdown / intro: nothing played yet
    Mono.startPlay(m, now);
  }
  Mono.final(m, now);
  Object.values(g.players).forEach((p) => { p.currentQ = null; });
  io.to(pin).emit('mn:final', { id: m.id, ms: Mono.R.FINAL_MS });
  if (!m.timer) m.timer = setInterval(() => mnTick(pin, m), MN_TICK_MS);
}
function mnPause(pin, g, paused) {
  const m = g.mn;
  if (!m || !!m.paused === !!paused || m.phase === 'final' || m.phase === 'done' || m.phase === 'countdown') return;
  const now = Date.now();
  if (paused) { m.paused = true; m.pausedAt = now; }
  else {
    const shift = now - m.pausedAt;
    Mono.shiftTimes(m, shift);
    Object.values(g.players).forEach((p) => { if (p.lastQuestionAt) p.lastQuestionAt += shift; });
    if (g.endsAt) g.endsAt += shift;
    m.paused = false;
  }
  const clock = mnClock(m);
  io.to(pin).emit('mn:pause', {
    id: m.id, paused: !!m.paused, phase: m.phase, phaseMs: Math.max(0, m.phaseUntil - clock),
    endsMs: m.endsAt ? Math.max(0, m.endsAt - clock) : null, frenzyMs: m.frenzyAt ? Math.max(0, m.frenzyAt - clock) : null,
  });
  g._lastBcast = 0;
  broadcast(pin);
}
// The end: bonus stars per board, each board's winner, the class podium; each phone gets its own board + its card
// (built again on demand for a reconnect).
function mnEndPayloads(g) {
  const m = g.mn;
  const fin = Mono.finish(m);
  const lite = (x) => x && { k: x.k, name: x.name, skin: x.skin, c: x.c, b: x.b, total: x.total, stars: x.stars, coins: x.coins, rank: x.rank, bonus: x.bonus, lands: x.lands, right: x.right };
  const boards = fin.boards.map((bd) => ({
    id: bd.id, star: bd.star, owners: bd.owners, winners: bd.winners, rows: bd.rows.map(lite),
    bonus: bd.bonus.map((s) => ({ id: s.id, name: s.name, what: s.what, value: s.value, winners: s.winners })),
  }));
  const podium = fin.podium.map(lite);
  const byK = {};
  fin.rows.forEach((x) => { byK[x.k] = x; });
  const common = { winner: 'tie', teamScores: { red: 0, gold: 0 } };   // (no teams: the shared phone code reads these)
  return {
    byK,
    host: Object.assign({
      leaderboard: podium.map((x) => ({ name: x.name, score: x.total, team: 'red' })),
      monopoly: { boards, podium, count: fin.rows.length },
    }, common),
    forPlayer(pid) {
      const p = g.players[pid];
      const x = p && byK[p.mnK];
      if (!x) return null;
      const board = boards.find((bd) => bd.id === x.b) || null;
      return Object.assign({}, common, {
        scores: { [pid]: x.total },
        monopoly: { board, podium, count: fin.rows.length, boardsN: boards.length },
        me: {
          k: x.k, b: x.b, c: x.c, rank: x.rank, of: x.of, classRank: x.classRank, total: x.total, stars: x.stars, bonus: x.bonus,
          coins: x.coins, lands: x.lands, right: x.right, answered: x.answered, best: x.best, tolls: x.tolls, bought: x.bought,
          laps: x.laps, won: !!(board && board.winners.includes(x.k)),
        },
      });
    },
  };
}
function mnFinish(pin, g) {
  const m = g.mn;
  if (!m) return;
  mnStop(g);
  m.phase = 'done';
  const end = mnEndPayloads(g);
  Object.values(g.players).forEach((p) => { const x = end.byK[p.mnK]; if (x) p.score = x.total; });   // the room's own score = stars (bonus included)
  io.to(g.hostId).emit('game-end', end.host);
  Object.entries(g.players).forEach(([pid, p]) => {
    if (p.disconnected) return;
    const one = end.forPlayer(pid);
    if (one) io.to(pid).emit('game-end', one);
  });
  _zocoGameEnd(pin, g, end);   // 🪙 El Zoco: a game played for real and its bonus stars pay (core/zoco.js PAY; after the ceremony is sent)
}

// === 😴 DRALY SIESTA · ¡NO DESPIERTES A DRALINGO! (gameType 'dormilon') — Super Mario Party «Don't Wake Wiggler», boards of 4 ===
// Rules in core/dormilon.js (spec docs/specs/no-despiertes-a-dralingo.md). v4 (2026-10-24, his «every kid in, every
// moment; build, then the reveal»): the Windows rhythm. The boards are dealt when the countdown starts (each phone runs
// in with its own board, dm:init); one 100 ms tick per room runs everything: intro → rounds: dm:round 'qw' (each kid's
// questions to them only, dm:q → a right answer = a golden feather, a miss = a feather flies off and he shifts: dm:qr to
// me, dm:plume + dm:shift to the board) → dm:ready + dm:round 'pwin' «¡A hacerle cosquillas!» → dm:round 'pw': EVERY
// kid rubs at once (player:dm-stroke with the finger's x, y = one completed stroke: dm:pat to the board, every phone
// sees whose tickle landed where), «🪶 ¡Guardar mis plumas!» (player:dm-stop → dm:bank), a stroke that wakes him (dm:wake:
// the waker's feathers of the round fly away, the ANGRY wake-up on the board's phones, then dm:sleep) → dm:round 'pwout' with the tally → …
// the final round ×2 (dm:frenzy) → «¡FINAL!» → game-end (each phone its board's ceremony and card, the projector every
// board's champion + the class podium). «🤖 Probar con robots» (host:dm-robots, lobby, teacher only): robots fill a
// board of 1-2 phones and play like an average kid; they never count. Each board is a socket.io room of its own (the
// game id in its name, so «Otra ronda» never mixes boards). The class top 3 rides on dm:top to the projector.
const DM_TICK_MS = 100;
const DM_ROBOTS = [['🤖 Robi', 'hamdan'], ['🤖 Roba', 'latifa'], ['🤖 Robo', 'aileen']];
const dmRobotNames = (n) => DM_ROBOTS.slice(0, Math.max(0, Math.min(DM_ROBOTS.length, n || 0))).map(([name, skin]) => ({ name, skin }));
function dmEnsureId(g, p) { if (!p.dmK) p.dmK = (g.dmNextK = (g.dmNextK || 0) + 1); return p.dmK; }
const dmRoom = (pin, m, bid) => `${pin}:dm:${m.id}:${bid}`;
function dmJoinRoom(pin, g, pid, p) {
  const m = g.dm;
  const r = m && Dorm.kid(m, p.dmK);
  if (!r) return;
  const s = io.sockets.sockets.get(pid);
  if (s) s.join(dmRoom(pin, m, r.b));
}
function dmOnline(g) {
  const on = new Set();
  Object.values(g.players).forEach((p) => { if (p.dmK && !p.disconnected) on.add(p.dmK); });
  return (k) => on.has(k);
}
function dmPidOf(g, k) {
  for (const [pid, p] of Object.entries(g.players)) if (p.dmK === k && !p.disconnected) return pid;
  return null;
}
const dmClock = (m) => (m.paused ? m.pausedAt : Date.now());
function dmTop(g, n) {
  return Object.values(g.dm.kids).filter((r) => !r.robot).sort((a, b) => b.score - a.score || b.big - a.big || a.k - b.k).slice(0, n)
    .map((r) => ({ k: r.k, name: r.name, skin: r.skin, score: r.score, b: r.b }));
}
function dmInitPayload(g, pid) {
  const m = g.dm;
  const clock = dmClock(m);
  const online = dmOnline(g);
  const out = {
    id: m.id, phase: m.phase, phaseMs: Math.max(0, m.phaseUntil - clock), paused: !!m.paused,
    endsMs: m.endsAt ? Math.max(0, m.endsAt - clock) : null, frenzy: !!m.frenzy, duration: m.duration, boardsN: m.boards.length,
    top: dmTop(g, 3), round: Dorm.roundView(m, clock),
  };
  if (!pid) { out.boards = m.boards.map((b) => Dorm.boardView(m, b, online, clock)); return out; }
  const p = g.players[pid];
  const r = p && Dorm.kid(m, p.dmK);
  if (!r) return out;
  const b = Dorm.boardOf(m, r.b);
  out.board = b ? Dorm.boardView(m, b, online, clock) : null;
  out.you = { k: r.k, b: r.b, score: r.score, pile: r.pile, got: r.got, safe: r.safe, feathers: r.feathers, pats: r.pats, first: !!r.first };
  out.q = Dorm.openQ(m, r.k, clock);                                // my open question again (same qid, the time left)
  return out;
}
function dmStop(g) { if (g && g.dm && g.dm.timer) { clearInterval(g.dm.timer); g.dm.timer = null; } }
// The events of the rules (core/dormilon.js) to the screens: the board's phones (its room) + the projector; a question
// only to its kid (never its right answer); the rounds to the whole room.
function dmEmit(pin, g, evs) {
  const m = g.dm;
  if (!m || !evs || !evs.length) return;
  let scored = false;
  evs.forEach((e) => {
    try {
      if (e.t === 'q') {
        const pid = dmPidOf(g, e.k);
        if (pid) io.to(pid).emit('dm:q', Object.assign({ b: e.b, feathers: e.feathers, ms: e.ms }, Dorm.qPublic(e.q)));
        return;
      }
      if (e.t === 'qx') { const pid = dmPidOf(g, e.k); if (pid) io.to(pid).emit('dm:qx', { b: e.b }); return; }
      if (e.t === 'qr') {
        const pid = dmPidOf(g, e.k);
        const payload = Object.assign({ id: m.id }, e);
        delete payload.t;
        if (pid) io.to(pid).emit('dm:qr', payload);
        const plume = { id: m.id, b: e.b, k: e.k, feathers: e.feathers, ok: e.ok };
        io.to(dmRoom(pin, m, e.b)).except(pid || '').emit('dm:plume', plume);
        io.to(g.hostId).emit('dm:plume', plume);
        return;
      }
      if (e.t === 'round') { io.to(pin).emit('dm:round', Object.assign({ id: m.id }, e, { t: undefined })); return; }
      if (e.t === 'frenzy') { io.to(pin).emit('dm:frenzy', { id: m.id, endsMs: e.endsMs, off: !!e.off }); return; }
      if (e.t === 'final') { io.to(pin).emit('dm:final', { id: m.id, ms: e.ms }); return; }
      if (e.t === 'pwmore') { io.to(pin).emit('dm:pwmore', { id: m.id, ms: e.ms, add: e.add }); return; }   // (the play window waited for a wake-up: everyone's count gets the time back)
      if (e.t === 'pat' || e.t === 'wake' || e.t === 'bank') {
        const r = Dorm.kid(m, e.k);
        Object.values(g.players).forEach((p) => { if (r && p.dmK === r.k) p.score = r.score; });
        if (e.t !== 'pat') scored = true;
      }
      const name = 'dm:' + e.t;
      const payload = Object.assign({ id: m.id }, e);
      delete payload.t;
      io.to(dmRoom(pin, m, e.b)).emit(name, payload);
      io.to(g.hostId).emit(name, payload);
    } catch (err) { console.error('[dormilon] emit', e && e.t, err); }
  });
  if (scored || evs.some((e) => e.t === 'round' && e.phase === 'pwout')) io.to(g.hostId).emit('dm:top', { top: dmTop(g, 3) });
}
// The countdown starts: the boards are dealt now, so every phone runs in with its own board and the projector with all.
function dmDeal(pin, g) {
  dmStop(g);
  const now = Date.now();
  const m = Dorm.newGame(1 + Math.floor(Math.random() * 1e9), g.duration, now);
  m.phaseUntil = now + COUNTDOWN_MS;
  m.timer = null;
  g.dm = m;
  Object.values(g.players).forEach((p) => { dmEnsureId(g, p); p.currentQ = null; });
  Dorm.deal(m, Object.values(g.players).filter((p) => !p.disconnected).map((p) => [p.dmK, p.name, hcSkin(p), p.studentCode || '']));
  // «🤖 Probar con robots»: they sit in the smallest board of 1-2 phones (his own when he plays with one phone)
  dmRobotNames(g.dmRobots).forEach((x) => Dorm.seatRobot(m, (g.dmNextK = (g.dmNextK || 0) + 1), x.name, x.skin));
  Object.entries(g.players).forEach(([pid, p]) => {
    if (p.disconnected || !Dorm.inGame(m, p.dmK)) return;
    dmJoinRoom(pin, g, pid, p);
    io.to(pid).emit('dm:init', dmInitPayload(g, pid));
  });
  io.to(g.hostId).emit('dm:init', dmInitPayload(g, null));
}
// A kid who wasn't dealt in (joined late, came back after the deal) sits at the smallest board; that board's phones and
// the projector get the new kid. Returns true when the kid got a new seat.
function dmSeatLate(pin, g, pid, p) {
  const m = g.dm;
  const b = Dorm.seatLate(m, dmEnsureId(g, p), p.name, hcSkin(p), p.studentCode || '');
  if (!b) return false;
  dmJoinRoom(pin, g, pid, p);
  const view = Dorm.boardView(m, b, dmOnline(g), dmClock(m));
  io.to(dmRoom(pin, m, b.id)).except(pid).emit('dm:seat', { board: view });
  io.to(g.hostId).emit('dm:seat', { board: view });
  return true;
}
// The countdown is over: the intro («¡Shhh! Dralingo duerme…» → «¡YA!»), then dmPlay; the tick runs everything.
function dmStart(pin, g) {
  const m = g.dm;
  if (!m || m.phase !== 'countdown') return;
  const now = Date.now();
  m.phase = 'intro';
  m.phaseAt = now;
  m.phaseUntil = now + Dorm.R.INTRO_MS;
  Object.entries(g.players).forEach(([pid, p]) => {
    dmEnsureId(g, p);
    p.currentQ = null;
    if (!p.disconnected && !Dorm.inGame(m, p.dmK)) { dmSeatLate(pin, g, pid, p); io.to(pid).emit('dm:init', dmInitPayload(g, pid)); }
  });
  g.endsAt = now + Dorm.R.INTRO_MS + m.duration * 1000;
  io.to(pin).emit('dm:intro', { id: m.id, ms: Dorm.R.INTRO_MS });
  dmStop(g);
  m.timer = setInterval(() => dmTick(pin, m), DM_TICK_MS);
}
function dmPlay(pin, g) {
  const m = g.dm;
  if (!m || m.phase !== 'intro') return;
  const now = Date.now();
  const evs = Dorm.startPlay(m, now);
  g.endsAt = m.endsAt;
  io.to(pin).emit('dm:play', { id: m.id, endsMs: m.endsAt - now });
  dmEmit(pin, g, evs);
  g._lastBcast = 0;
  broadcast(pin);
}
const dmOpts = (g) => ({ questions: g.questions, imageFor: (q) => Images.urlForQuestion(q), online: dmOnline(g) });
function dmTick(pin, m) {
  const g = games[pin];
  if (!g || g.dm !== m || g.state !== 'active') { clearInterval(m.timer); m.timer = null; return; }
  if (m.paused) return;
  const now = Date.now();
  try {
    if (m.phase === 'intro') { if (now >= m.phaseUntil) dmPlay(pin, g); return; }
    if (m.phase === 'play') { dmEmit(pin, g, Dorm.tick(m, now, dmOpts(g))); return; }
    if (m.phase === 'final' && now >= m.phaseUntil) {
      dmStop(g);
      if (g.endTimer) { clearTimeout(g.endTimer); g.endTimer = null; }
      endGame(pin);
    }
  } catch (e) { console.error('[dormilon] tick', e); }
}
// «¡FINAL!» on every screen (every kid's feathers of the round are kept); the tick ends the game FINAL_MS later.
function dmFinal(pin, g) {
  const m = g.dm;
  if (!m || m.phase === 'final' || m.phase === 'done') return;
  const now = Date.now();
  if (m.paused) { Dorm.shiftTimes(m, now - m.pausedAt); m.paused = false; io.to(pin).emit('dm:pause', { id: m.id, paused: false }); }
  dmEmit(pin, g, Dorm.final(m, now));
  Object.values(g.players).forEach((p) => { p.currentQ = null; });
  if (!m.timer) m.timer = setInterval(() => dmTick(pin, m), DM_TICK_MS);
}
function dmPause(pin, g, paused) {
  const m = g.dm;
  if (!m || !!m.paused === !!paused || m.phase === 'final' || m.phase === 'done' || m.phase === 'countdown') return;
  const now = Date.now();
  if (paused) { m.paused = true; m.pausedAt = now; }
  else {
    const shift = now - m.pausedAt;
    Dorm.shiftTimes(m, shift);
    if (g.endsAt) g.endsAt += shift;
    m.paused = false;
  }
  const clock = dmClock(m);
  io.to(pin).emit('dm:pause', { id: m.id, paused: !!m.paused, phase: m.phase, endsMs: m.endsAt ? Math.max(0, m.endsAt - clock) : null });
  // every board again with its time left (the window's countdown on the phones stands still / runs on)
  Object.entries(g.players).forEach(([pid, p]) => { if (!p.disconnected && Dorm.inGame(m, p.dmK)) io.to(pid).emit('dm:init', dmInitPayload(g, pid)); });
  io.to(g.hostId).emit('dm:init', dmInitPayload(g, null));
  g._lastBcast = 0;
  broadcast(pin);
}
// The end: each board's ranking, bonus stars and winner (people only: robots are listed apart); the class podium; each
// phone its own board + its card (built again on demand for a reconnect).
function dmEndPayloads(g) {
  const m = g.dm;
  const fin = Dorm.finish(m);
  const lite = (x) => x && {
    k: x.k, name: x.name, skin: x.skin, b: x.b, score: x.score, pats: x.pats, wakes: x.wakes, falls: x.falls, lost: x.lost, rank: x.rank,
    classRank: x.classRank, stars: x.stars, best: x.best, big: x.big, saved: x.saved,
  };
  const boards = fin.boards.map((bd) => ({
    id: bd.id, nights: bd.nights, wakes: bd.wakes, winners: bd.winners, rows: bd.rows.map((k) => lite(fin.byK[k])), robots: bd.robots,
    stars: bd.stars.map((s) => ({ id: s.id, name: s.name, unit: s.unit, value: s.value, winners: s.winners })),
  }));
  const podium = fin.order.slice(0, 3).map((k) => lite(fin.byK[k]));
  const common = { winner: 'tie', teamScores: { red: 0, gold: 0 } };   // (no teams: the shared phone code reads these)
  return {
    byK: fin.byK,
    // a phone with no row (seated too late, e.g. it joined during «¡FINAL!»): the podium and «mira el proyector»
    guest: () => Object.assign({}, common, { dormilon: { board: null, podium, count: fin.count, boardsN: boards.length }, me: { guest: true } }),
    host: Object.assign({
      leaderboard: fin.order.map((k) => ({ name: fin.byK[k].name, score: fin.byK[k].score, team: 'red' })),
      dormilon: { boards, podium, count: fin.count, winners: fin.winners },
    }, common),
    forPlayer(pid) {
      const p = g.players[pid];
      const x = p && fin.byK[p.dmK];
      if (!x || x.robot) return null;
      const board = boards.find((bd) => bd.id === x.b) || null;
      return Object.assign({}, common, {
        scores: { [pid]: x.score },
        dormilon: { board, podium, count: fin.count, boardsN: boards.length },
        me: {
          k: x.k, b: x.b, skin: x.skin, rank: x.rank, of: board ? board.rows.length : 1, classRank: x.classRank, classOf: fin.count,
          score: x.score, pats: x.pats, wakes: x.wakes, falls: x.falls, lost: x.lost, stars: x.stars, answered: x.answered, right: x.right,
          best: x.best, big: x.big, saved: x.saved, won: !!(board && board.winners.includes(x.k)),
        },
      });
    },
  };
}
function dmFinish(pin, g) {
  const m = g.dm;
  if (!m) return;
  dmStop(g);
  m.phase = 'done';
  const end = dmEndPayloads(g);
  Object.values(g.players).forEach((p) => { const x = end.byK[p.dmK]; if (x) p.score = x.score; });
  io.to(g.hostId).emit('game-end', end.host);
  Object.entries(g.players).forEach(([pid, p]) => {
    if (p.disconnected) return;
    io.to(pid).emit('game-end', end.forPlayer(pid) || end.guest());
  });
  _zocoGameEnd(pin, g, end);   // 🪙 El Zoco: a game played for real and its bonus stars pay (core/zoco.js PAY; after the ceremony is sent)
}
// a kid's phone (re)connects mid-game: its seat (or a late seat), its board room, the board again with an open question
function dmAttach(pin, g, pid, p) {
  const m = g.dm;
  if (!m) return;
  // a kid the room forgot (away 5+ min: a new player entry) takes its own row back by its student code (points, seat)
  if (!Dorm.inGame(m, p.dmK) && p.studentCode) { const old = Dorm.byCode(m, p.studentCode, dmOnline(g)); if (old) p.dmK = old.k; }
  dmEnsureId(g, p);
  p.currentQ = null;
  if (!Dorm.inGame(m, p.dmK)) { if (m.phase === 'intro' || m.phase === 'play') dmSeatLate(pin, g, pid, p); }   // (in the countdown dmStart seats them)
  else dmJoinRoom(pin, g, pid, p);
  io.to(pid).emit('dm:init', dmInitPayload(g, pid));
}

// === 🦀 DRALY CANGREJO · ¡ATRAPA A FÉNEC! (gameType 'teamcrab') — Super Mario Party «Team Crab», a robot crab's crew vs Fénec ===
// Rules in core/teamcrab.js (spec docs/specs/atrapa-a-fenec.md). v2 (2026-10-23, his «Skill decides, never luck» and
// «Two rhythms»): rounds of two windows. The crews are dealt when the countdown starts (each phone runs in with its own
// crab, tc:init); one 80 ms tick per room runs everything: intro → rounds: tc:round 'qw' (each kid's quick-fire questions
// to them only, tc:q → a right answer = +1 hammer charge, a miss = El Péndulo eats one: tc:mine to me, tc:eat to the crew,
// never who) → tc:roles (the window's best answerer = the Capitán; kids with charges = martilleros) → tc:round 'pw'
// «¡A martillar!» (the Capitán drags, player:tc-steer, and the crab walks, tc:crab volatile; martilleros aim,
// player:tc-aim, relayed, and slam, player:tc-slam → tc:slam; the tick judges every impact where Fénec IS: tc:impact /
// tc:bonk, the crew's big moment; Fénec's moves tc:fen) → tc:round 'pwout' (the round's tally) → … → the last round ×2
// → «¡FINAL!» (caught or escaped per crew) → game-end. Each crew is a socket.io room of its own (the game id in its name,
// so «Otra ronda» never mixes crews). «🤖 Probar con robots» (host:tc-robots, the teacher in the lobby) seats robot
// crewmates the rules play like an average kid; a robot is never a player (no coins, record, star, podium or ranking).
// v3 «1 contra 3» (host:tc-mode in the lobby, g.tcMode 'vs'): each round one kid of the crew is Fénec (tc:roles runner);
// HIS phone is the truth for where he is: it streams player:tc-run (~14 a second, clamped to his speed, relayed volatile
// as tc:runner), spends a dash (player:tc-dash → tc:dash) and tells the server where he was when each hammer landed on
// his own screen (player:tc-land {sid, x}); the hammer waits for that verdict (his round trip + a little), and without it
// the hit zone shrinks: in doubt, the runner wins. «¡Tiempo!» banks his seconds (tc:runend).
const TC_TICK_MS = 80;
const TC_ROBOTS = [['🤖 Robi', 'hamdan'], ['🤖 Roba', 'latifa'], ['🤖 Robo', 'aileen']];
function tcEnsureId(g, p) { if (!p.tcK) p.tcK = (g.tcNextK = (g.tcNextK || 0) + 1); return p.tcK; }
const tcRoom = (pin, m, bid) => `${pin}:tc:${m.id}:${bid}`;
function tcJoinRoom(pin, g, pid, p) {
  const m = g.tc;
  const r = m && Crab.kid(m, p.tcK);
  if (!r) return;
  const s = io.sockets.sockets.get(pid);
  if (s) s.join(tcRoom(pin, m, r.b));
}
function tcOnline(g) {
  const on = new Set();
  Object.values(g.players).forEach((p) => { if (p.tcK && !p.disconnected) on.add(p.tcK); });
  return (k) => on.has(k);
}
function tcPidOf(g, k) {
  for (const [pid, p] of Object.entries(g.players)) if (p.tcK === k && !p.disconnected) return pid;
  return null;
}
const tcClock = (m) => (m.paused ? m.pausedAt : Date.now());
function tcCrews(g) {
  return g.tc.boards.filter((b) => b.seats.length).map((b) => ({ id: b.id, words: b.words, target: b.target, full: !!b.full, n: b.seats.length }))
    .sort((a, b) => b.words / b.target - a.words / a.target || b.words - a.words || a.id - b.id);
}
function tcInitPayload(g, pid) {
  const m = g.tc;
  const clock = tcClock(m);
  const online = tcOnline(g);
  const out = {
    id: m.id, phase: m.phase, phaseMs: Math.max(0, m.phaseUntil - clock), paused: !!m.paused,
    endsMs: m.endsAt ? Math.max(0, m.endsAt - clock) : null, frenzy: !!m.frenzy, duration: m.duration, boardsN: m.boards.length,
    crews: tcCrews(g), spots: Crab.R.SPOTS, round: Crab.roundView(m, clock), mode: m.mode,
    rules: { reach: Crab.R.REACH, fall: Crab.R.FALL_MS, back: Crab.R.BACK_MS, max: Crab.R.CHARGES_MAX, speed: Crab.R.CRAB_SPEED, hit: Crab.R.HIT_R,
      vs: { fall: Crab.R.VS.FALL_MS, run: Crab.R.VS.RUN_SPEED, dashX: Crab.R.VS.DASH_X, dashMs: Crab.R.VS.DASH_MS, dashes: Crab.R.VS.DASHES_MAX, stun: Crab.R.VS.STUN_MS } },
  };
  if (!pid) { out.boards = m.boards.map((b) => Crab.boardView(m, b, online, clock)); return out; }
  const p = g.players[pid];
  const r = p && Crab.kid(m, p.tcK);
  if (!r) return out;
  const b = Crab.boardOf(m, r.b);
  out.board = b ? Crab.boardView(m, b, online, clock) : null;
  out.you = {
    k: r.k, b: r.b, words: r.words, bonks: r.bonks, charges: r.charges, rightQW: r.rightQW, captain: !!(b && b.captain === r.k), role: r.role || null,
    runner: !!(b && b.runner === r.k), dashes: r.dashes || 0, runs: r.runs || 0,
    claw: { st: r.claw.st, off: r.claw.off, x: r.claw.x, ms: r.claw.readyAt ? Math.max(0, r.claw.readyAt - clock) : 0 },
  };
  out.q = Crab.openQ(m, r.k, clock);
  return out;
}
function tcStop(g) { if (g && g.tc && g.tc.timer) { clearInterval(g.tc.timer); g.tc.timer = null; } }
// The events of the rules (core/teamcrab.js) to the screens: the crew's phones (its room) + the projector; a question,
// its result, my own charges after a miss and a withdrawn question only to their kid (a miss is never shown with a name).
const TC_KID_ONLY = { qr: 'tc:qr', mine: 'tc:mine', qx: 'tc:qx' };
const TC_ALL = { round: 1, frenzy: 1, final: 1 };
function tcEmit(pin, g, evs) {
  const m = g.tc;
  if (!m || !evs || !evs.length) return;
  let crews = false;
  evs.forEach((e) => {
    try {
      if (e.t === 'q') {
        const pid = tcPidOf(g, e.k);
        if (pid) io.to(pid).emit('tc:q', Object.assign({ b: e.b, ms: e.ms, charges: e.charges }, Crab.qPublic(e.q)));
        return;
      }
      const payload = Object.assign({ id: m.id }, e);
      delete payload.t;
      if (TC_KID_ONLY[e.t]) {
        const pid = tcPidOf(g, e.k);
        if (pid) io.to(pid).emit(TC_KID_ONLY[e.t], payload);
        return;
      }
      if (TC_ALL[e.t]) { io.to(pin).emit('tc:' + e.t, payload); return; }
      if ((e.t === 'crab' || e.t === 'runner') && e.vol) {
        delete payload.vol;
        io.to(tcRoom(pin, m, e.b)).volatile.emit('tc:' + e.t, payload);
        io.to(g.hostId).volatile.emit('tc:' + e.t, payload);
        return;
      }
      if (e.t === 'runend') { const r = Crab.kid(m, e.k); if (r) Object.values(g.players).forEach((p) => { if (p.tcK === r.k) p.score = r.words; }); }
      if (e.t === 'bonk' || e.t === 'full') {
        crews = true;
        if (e.t === 'bonk') [e.k, e.cap].concat(e.assists || []).forEach((k) => { const r = k != null && Crab.kid(m, k); if (r) Object.values(g.players).forEach((p) => { if (p.tcK === r.k) p.score = r.words; }); });
      }
      io.to(tcRoom(pin, m, e.b)).emit('tc:' + e.t, payload);
      io.to(g.hostId).emit('tc:' + e.t, payload);
    } catch (err) { console.error('[teamcrab] emit', e && e.t, err); }
  });
  if (crews) io.to(g.hostId).emit('tc:crews', { crews: tcCrews(g) });
}
// The countdown starts: the crews are dealt now (every phone runs in with its own crab and the projector with all).
function tcWords(g) {
  const out = [];
  (g.questions || []).forEach((q) => {
    const w = String(q.key || '').trim().toLowerCase();
    if (w && /^[a-z]+( [a-z]+)*$/.test(w) && w.length <= 14 && !out.includes(w)) out.push(w);
  });
  return out;
}
const tcRobotNames = (n) => TC_ROBOTS.slice(0, Math.max(0, Math.min(TC_ROBOTS.length, n || 0))).map(([name, skin]) => ({ name, skin }));
function tcDeal(pin, g) {
  tcStop(g);
  const now = Date.now();
  const m = Crab.newGame(1 + Math.floor(Math.random() * 1e9), g.duration, now, tcWords(g), g.tcMode);
  m.phaseUntil = now + COUNTDOWN_MS;
  m.timer = null;
  g.tc = m;
  Object.values(g.players).forEach((p) => { tcEnsureId(g, p); p.currentQ = null; });
  Crab.deal(m, Object.values(g.players).filter((p) => !p.disconnected).map((p) => [p.tcK, p.name, hcSkin(p), p.studentCode || '']));
  // «🤖 Probar con robots»: they sit in the smallest crew (his own when he plays with one phone)
  tcRobotNames(g.tcRobots).forEach((x) => Crab.seatRobot(m, (g.tcNextK = (g.tcNextK || 0) + 1), x.name, x.skin));
  Object.entries(g.players).forEach(([pid, p]) => {
    if (p.disconnected || !Crab.inGame(m, p.tcK)) return;
    tcJoinRoom(pin, g, pid, p);
    io.to(pid).emit('tc:init', tcInitPayload(g, pid));
  });
  io.to(g.hostId).emit('tc:init', tcInitPayload(g, null));
}
// A kid who wasn't dealt in sits in the smallest crew (their claw joins the crab); that crew and the projector hear it.
function tcSeatLate(pin, g, pid, p) {
  const m = g.tc;
  const b = Crab.seatLate(m, tcEnsureId(g, p), p.name, hcSkin(p), p.studentCode || '', Date.now());
  if (!b) return false;
  tcJoinRoom(pin, g, pid, p);
  const view = Crab.boardView(m, b, tcOnline(g), tcClock(m));
  io.to(tcRoom(pin, m, b.id)).except(pid).emit('tc:seat', { board: view });
  io.to(g.hostId).emit('tc:seat', { board: view });
  return true;
}
function tcStart(pin, g) {
  const m = g.tc;
  if (!m || m.phase !== 'countdown') return;
  const now = Date.now();
  m.phase = 'intro';
  m.phaseAt = now;
  m.phaseUntil = now + Crab.R.INTRO_MS;
  Object.entries(g.players).forEach(([pid, p]) => {
    tcEnsureId(g, p);
    p.currentQ = null;
    if (!p.disconnected && !Crab.inGame(m, p.tcK)) { tcSeatLate(pin, g, pid, p); io.to(pid).emit('tc:init', tcInitPayload(g, pid)); }
  });
  g.endsAt = now + Crab.R.INTRO_MS + m.duration * 1000;
  io.to(pin).emit('tc:intro', { id: m.id, ms: Crab.R.INTRO_MS });
  tcStop(g);
  m.timer = setInterval(() => tcTick(pin, m), TC_TICK_MS);
}
function tcPlay(pin, g) {
  const m = g.tc;
  if (!m || m.phase !== 'intro') return;
  const now = Date.now();
  const ev = Crab.startPlay(m, now);
  g.endsAt = m.endsAt;
  io.to(pin).emit('tc:play', { id: m.id, endsMs: m.endsAt - now });
  tcEmit(pin, g, ev);
  g._lastBcast = 0;
  broadcast(pin);
}
const tcOpts = (g) => ({ questions: g.questions, imageFor: (q) => Images.urlForQuestion(q), online: tcOnline(g) });
function tcTick(pin, m) {
  const g = games[pin];
  if (!g || g.tc !== m || g.state !== 'active') { clearInterval(m.timer); m.timer = null; return; }
  if (m.paused) return;
  const now = Date.now();
  try {
    if (m.phase === 'intro') { if (now >= m.phaseUntil) tcPlay(pin, g); return; }
    if (m.phase === 'play') {
      if (now - (m.pingAt || 0) >= 3000) { m.pingAt = now; io.to(pin).emit('tc:ping', { t: now }); }   // (each phone's round trip: a slam is judged where Fénec was on its screen)
      tcEmit(pin, g, Crab.tick(m, now, tcOpts(g)));
      return;
    }
    if (m.phase === 'final' && now >= m.phaseUntil) {
      tcStop(g);
      if (g.endTimer) { clearTimeout(g.endTimer); g.endTimer = null; }
      endGame(pin);
    }
  } catch (e) { console.error('[teamcrab] tick', e); }
}
// «¡FINAL!» on every screen (a falling hammer still lands); the tick ends the game FINAL_MS later.
function tcFinal(pin, g) {
  const m = g.tc;
  if (!m || m.phase === 'final' || m.phase === 'done') return;
  const now = Date.now();
  if (m.paused) { Crab.shiftTimes(m, now - m.pausedAt); m.paused = false; io.to(pin).emit('tc:pause', { id: m.id, paused: false }); }
  tcEmit(pin, g, Crab.final(m, now));
  Object.values(g.players).forEach((p) => { p.currentQ = null; });
  if (!m.timer) m.timer = setInterval(() => tcTick(pin, m), TC_TICK_MS);
}
function tcPause(pin, g, paused) {
  const m = g.tc;
  if (!m || !!m.paused === !!paused || m.phase === 'final' || m.phase === 'done' || m.phase === 'countdown') return;
  const now = Date.now();
  if (paused) { m.paused = true; m.pausedAt = now; }
  else {
    const shift = now - m.pausedAt;
    Crab.shiftTimes(m, shift);
    if (g.endsAt) g.endsAt += shift;
    m.paused = false;
  }
  const clock = tcClock(m);
  io.to(pin).emit('tc:pause', { id: m.id, paused: !!m.paused, phase: m.phase, endsMs: m.endsAt ? Math.max(0, m.endsAt - clock) : null });
  Object.entries(g.players).forEach(([pid, p]) => { if (!p.disconnected && Crab.inGame(m, p.tcK)) io.to(pid).emit('tc:init', tcInitPayload(g, pid)); });
  io.to(g.hostId).emit('tc:init', tcInitPayload(g, null));
  g._lastBcast = 0;
  broadcast(pin);
}
// The end: each crew's ending (caught / escaped), ranking, bonus stars and winner; the crews; the class podium; each
// phone its own crew + its card (built again on demand for a reconnect). Robots ride along in their crew's line only.
function tcEndPayloads(g) {
  const m = g.tc;
  const fin = Crab.finish(m);
  const lite = (x) => x && {
    k: x.k, name: x.name, skin: x.skin, b: x.b, words: x.words, bonks: x.bonks, assists: x.assists, capBonks: x.capBonks, rank: x.rank,
    classRank: x.classRank, stars: x.stars, best: x.best, runs: x.runs, survived: x.survived, runPts: x.runPts,
  };
  const boards = fin.boards.map((bd) => ({
    id: bd.id, mode: m.mode, words: bd.words, target: bd.target, caught: bd.caught, bonks: bd.bonks, winners: bd.winners, rows: bd.rows.map((k) => lite(fin.byK[k])),
    robots: bd.robots, stars: bd.stars.map((s) => ({ id: s.id, name: s.name, unit: s.unit, value: s.value, winners: s.winners })),
  }));
  const podium = fin.order.slice(0, 3).map((k) => lite(fin.byK[k]));
  const common = { winner: 'tie', teamScores: { red: 0, gold: 0 } };   // (no teams: the shared phone code reads these)
  const words = (m.words || []).slice(0, 8);                         // (the class's pinyin words: they fly out of his sack in the ending)
  return {
    byK: fin.byK,
    guest: () => Object.assign({}, common, { teamcrab: { board: null, words, podium, crews: fin.crews, count: fin.count, boardsN: boards.length, mode: m.mode }, me: { guest: true } }),
    host: Object.assign({
      leaderboard: fin.order.map((k) => ({ name: fin.byK[k].name, score: fin.byK[k].words, team: 'red' })),
      teamcrab: { boards, podium, crews: fin.crews, count: fin.count, words, mode: m.mode },
    }, common),
    forPlayer(pid) {
      const p = g.players[pid];
      const x = p && fin.byK[p.tcK];
      if (!x || x.robot) return null;
      const board = boards.find((bd) => bd.id === x.b) || null;
      const crew = fin.crews.find((c) => c.id === x.b) || null;
      return Object.assign({}, common, {
        scores: { [pid]: x.words },
        teamcrab: { board, podium, crews: fin.crews, count: fin.count, boardsN: boards.length, words, mode: m.mode },
        me: {
          k: x.k, b: x.b, skin: x.skin, rank: x.rank, of: board ? board.rows.length : 1, classRank: x.classRank, classOf: fin.count,
          words: x.words, bonks: x.bonks, assists: x.assists, capBonks: x.capBonks, captained: x.captained, slams: x.slams, stars: x.stars,
          answered: x.answered, right: x.right, best: x.best, won: !!(board && board.winners.includes(x.k)), caught: !!(board && board.caught),
          crewRank: crew ? crew.rank : null, crews: fin.crews.length, runs: x.runs, survived: x.survived, runPts: x.runPts, hitsTaken: x.hitsTaken,
        },
      });
    },
  };
}
function tcFinish(pin, g) {
  const m = g.tc;
  if (!m) return;
  tcStop(g);
  m.phase = 'done';
  const end = tcEndPayloads(g);
  Object.values(g.players).forEach((p) => { const x = end.byK[p.tcK]; if (x) p.score = x.words; });
  io.to(g.hostId).emit('game-end', end.host);
  Object.entries(g.players).forEach(([pid, p]) => {
    if (p.disconnected) return;
    io.to(pid).emit('game-end', end.forPlayer(pid) || end.guest());
  });
  _zocoGameEnd(pin, g, end);   // 🪙 El Zoco: a game played for real and its bonus stars pay (players only: never a robot)
}
// a kid's phone (re)connects mid-game: its seat (or a late seat), its crew room, the crab again with an open question
function tcAttach(pin, g, pid, p) {
  const m = g.tc;
  if (!m) return;
  if (!Crab.inGame(m, p.tcK) && p.studentCode) { const old = Crab.byCode(m, p.studentCode, tcOnline(g)); if (old) p.tcK = old.k; }
  tcEnsureId(g, p);
  p.currentQ = null;
  if (!Crab.inGame(m, p.tcK)) { if (m.phase === 'intro' || m.phase === 'play') tcSeatLate(pin, g, pid, p); }
  else tcJoinRoom(pin, g, pid, p);
  io.to(pid).emit('tc:init', tcInitPayload(g, pid));
}

// === 🐉 VUELO DEL DRAGÓN v2 (gameType 'dragon-eye') — «La Carrera del Cielo de Dubái», a Mario Party sky race ===
// Rules in core/dragon.js (spec docs/specs/dragon-v2.md). Races of 4, every kid on their own dragoncito, every race over
// the same Dubai course. The races are dealt when the countdown starts (each phone runs in with its own race, dr:init);
// one 200 ms tick per room runs the clock: intro → play (questions dealt, flights closed on the server's clock, time-ups
// called, the star sprints, leads, the frenzy) → «¡FINAL!» (beats on their way still count) → game-end (each phone its own
// race's ceremony and card, the projector every race + the class podium). A right answer opens a flight
// (answer-result.dragon); the phone sends its wing beats in batches (player:dr-beats, no answer per batch: the phone
// predicts with the same cap) and gets the flight's summary when the server closes it (dr:flown). Each race is a
// socket.io room of its own (the game id in its name, so «Otra ronda» never mixes races): its phones get the race's live
// line (dr:race: metres + flags, every 500 ms only when something changed), the projector one line for every race
// (dr:races). No full-room 'state' push on answers.
const DR_TICK_MS = 200;
const DR_LINE_MS = 500;
function drEnsureId(g, p) { if (!p.drK) p.drK = (g.drNextK = (g.drNextK || 0) + 1); return p.drK; }
const drRoom = (pin, m, bid) => `${pin}:dr:${m.id}:${bid}`;
function drJoinRoom(pin, g, pid, p) {
  const m = g.dr;
  const r = m && Dragon.kid(m, p.drK);
  if (!r || r.b == null) return;
  const s = io.sockets.sockets.get(pid);
  if (s) s.join(drRoom(pin, m, r.b));
}
function drOnline(g) {
  const on = new Set();
  Object.values(g.players).forEach((p) => { if (p.drK && !p.disconnected) on.add(p.drK); });
  return (k) => on.has(k);
}
const drClock = (m) => (m.paused ? m.pausedAt : Date.now());
function drSprintView(m, clock) {
  const sp = m.sprint;
  return sp ? { n: sp.n, lm: sp.lm, ms: Math.max(0, sp.until - clock), total: Dragon.R.SPRINT_MS } : null;
}
function drInitPayload(g, pid) {
  const m = g.dr;
  const clock = drClock(m);
  const online = drOnline(g);
  const out = {
    id: m.id, phase: m.phase, phaseMs: Math.max(0, m.phaseUntil - clock), paused: !!m.paused,
    endsMs: m.endsAt ? Math.max(0, m.endsAt - clock) : null, frenzy: !!m.frenzy,
    frenzyMs: m.frenzyAt ? Math.max(0, m.frenzyAt - clock) : null, duration: m.duration, racesN: m.races.length,
    played: m.playAt ? Math.max(0, clock - m.playAt) : 0, sprint: drSprintView(m, clock),
  };
  if (!pid) { out.races = m.races.map((b) => Dragon.raceView(m, b, online)); return out; }
  const p = g.players[pid];
  const r = p && Dragon.kid(m, p.drK);
  if (!r || r.b == null) return out;
  const b = Dragon.raceOf(m, r.b);
  out.race = b ? Dragon.raceView(m, b, online) : null;
  const x = r.flap && !r.flap.closed ? r.flap : null;
  out.you = {
    k: r.k, b: r.b, c: r.c, m: Math.round(r.m), st: r.stars, right: r.right, streak: r.streak, best: r.best,
    // an open flight (with the time really left), a wait
    flight: x ? {
      mid: x.mid, lead: Math.max(0, x.start - clock), ms: x.until - x.start, elapsed: Math.max(0, clock - x.start), beats: x.beats,
      ring: x.ringHit ? 0 : x.ring, fire: x.fire, power: x.power, frenzy: m.frenzy, tail: Dragon.tailOn(m, r),
      beatM: Dragon.R.BEAT_M, rate: Dragon.R.RATE, burst: Dragon.R.BURST, resumed: true,
    } : null,
    busyMs: r.nextQAt ? Math.max(0, r.nextQAt - clock) : 0,
  };
  return out;
}
function drStop(g) { if (g && g.dr && g.dr.timer) { clearInterval(g.dr.timer); g.dr.timer = null; } }
// The countdown starts: the races are dealt now, so every phone runs in with its own race and the projector with all.
function drDeal(pin, g) {
  drStop(g);
  const now = Date.now();
  const m = Dragon.newGame(1 + Math.floor(Math.random() * 1e9), g.duration, now);
  m.phase = 'countdown';
  m.phaseUntil = now + COUNTDOWN_MS;
  g.dr = m;
  Object.values(g.players).forEach((p) => { drEnsureId(g, p); p.currentQ = null; p.mashUntil = 0; });
  Dragon.deal(m, Object.values(g.players).filter((p) => !p.disconnected).map((p) => [p.drK, p.name, hcSkin(p)]));
  Object.entries(g.players).forEach(([pid, p]) => {
    if (p.disconnected || !Dragon.inGame(m, p.drK)) return;
    drJoinRoom(pin, g, pid, p);
    io.to(pid).emit('dr:init', drInitPayload(g, pid));
  });
  io.to(g.hostId).emit('dr:init', drInitPayload(g, null));
}
// A kid who wasn't dealt in (joined late, came back after the deal) flies in the smallest race (level with its last
// dragon); that race's phones and the projector get the new dragon. Returns true when the kid got a new seat.
function drSeatLate(pin, g, pid, p) {
  const m = g.dr;
  const nm = String(p.name || '').toLowerCase();
  const taken = new Set(Object.values(g.players).filter((q) => q !== p).map((q) => q.drK));
  const old = nm && Object.values(m.kids).find((r) => r.away && r.b != null && r.name.toLowerCase() === nm && !taken.has(r.k));
  if (old) {
    p.drK = old.k;
    Dragon.setAway(m, old.k, false);
    drJoinRoom(pin, g, pid, p);
    return false;
  }
  const b = Dragon.seatLate(m, drEnsureId(g, p), p.name, hcSkin(p));
  if (!b) return false;
  drJoinRoom(pin, g, pid, p);
  const view = Dragon.raceView(m, b, drOnline(g));
  io.to(drRoom(pin, m, b.id)).except(pid).emit('dr:seat', { race: view });
  io.to(g.hostId).emit('dr:seat', { race: view });
  return true;
}
// The countdown is over: the intro («¡Responde y aletea!» → «¿Listos?» → «¡YA!»), then drPlay; the tick deals.
function drStart(pin, g) {
  const m = g.dr;
  if (!m || m.phase !== 'countdown') return;
  const now = Date.now();
  m.phase = 'intro';
  m.phaseAt = now;
  m.phaseUntil = now + Dragon.R.INTRO_MS;
  Object.entries(g.players).forEach(([pid, p]) => {
    drEnsureId(g, p);
    p.currentQ = null;
    p.lastQuestionAt = now;
    if (!p.disconnected && !Dragon.inGame(m, p.drK)) { drSeatLate(pin, g, pid, p); io.to(pid).emit('dr:init', drInitPayload(g, pid)); }
  });
  g.endsAt = now + Dragon.R.INTRO_MS + m.duration * 1000;
  io.to(pin).emit('dr:intro', { id: m.id, ms: Dragon.R.INTRO_MS });
  drStop(g);
  m.timer = setInterval(() => drTick(pin, m), DR_TICK_MS);
}
function drPlay(pin, g) {
  const m = g.dr;
  if (!m || m.phase !== 'intro') return;
  const now = Date.now();
  Dragon.startPlay(m, now);
  g.endsAt = m.endsAt;
  io.to(pin).emit('dr:play', { id: m.id, endsMs: m.endsAt - now, frenzyMs: m.frenzyAt - now, sprintMs: m.nextSprintAt - now });
  g._lastBcast = 0;
  broadcast(pin);                      // (the next tick deals every kid's first question)
}
function drSendQ(g, pid, p) {
  const q = nextQuestionFor(g, pid);
  if (q) io.to(pid).emit('question', q);
}
// A right / wrong / time-up answer. Right: a flight opens (the phone flies at the lead). Wrong: the wait.
function drAnswer(pin, g, pid, p, correct, correctText, timeUp) {
  const m = g.dr;
  const now = Date.now();
  const res = Dragon.answer(m, p.drK, correct, now - (p.lastQuestionAt || now), now, !!timeUp);
  if (!res) return;
  if (res.right) io.to(pid).emit('answer-result', { correct: true, correctText, dragon: Object.assign({ right: true, streak: res.streak }, res.flight) });
  else io.to(pid).emit('answer-result', { correct: false, correctText, dragon: { right: false, wait: res.wait, calm: res.calm, tooFast: res.tooFast, timeUp: res.timeUp } });
  io.to(g.hostId).emit('dr:ans', { k: p.drK, right: res.right });
}
// A flight is over on the server's clock: its summary to the phone (the phone settles its metres to it).
function drClose(g, pid, p, now) {
  const s = Dragon.closeFlap(g.dr, p.drK, now);
  if (s && !p.disconnected) io.to(pid).emit('dr:flown', s);
  return s;
}
// Each race's live line (metres + flags of its dragons, the sprint metres during a sprint) when something changed.
function drLines(pin, g, now, force) {
  const m = g.dr;
  const all = [];
  m.races.forEach((b) => {
    if (!b.dirty && !force) return;
    b.dirty = false;
    b.seq++;
    const d = Dragon.racePos(m, b, now);
    io.to(drRoom(pin, m, b.id)).emit('dr:race', { id: m.id, b: b.id, seq: b.seq, d });
    all.push([b.id, b.seq, d]);
  });
  if (all.length) io.to(g.hostId).emit('dr:races', { id: m.id, r: all });
}
function drSprintEnd(pin, g, end) {
  io.to(pin).emit('dr:sprint', { id: g.dr.id, go: false, n: end.n, lm: end.lm, star: end.star, races: end.races });
}
function drTick(pin, m) {
  const g = games[pin];
  if (!g || g.dr !== m || g.state !== 'active') { clearInterval(m.timer); m.timer = null; return; }
  if (m.paused) return;
  const now = Date.now();
  try {
    if (m.phase === 'intro') { if (now >= m.phaseUntil) drPlay(pin, g); return; }
    if (m.phase !== 'play' && m.phase !== 'final') return;
    Object.entries(g.players).forEach(([pid, p]) => { try {
      const r = Dragon.kid(m, p.drK);
      if (!r || r.b == null) return;
      if (r.flap && now >= Dragon.closeAt(r.flap)) drClose(g, pid, p, now);
      if (m.phase !== 'play') return;
      // a question nobody answered: «time up» 3 s after the phone's 20 s (a frozen tab can't hold a kid)
      if (p.currentQ && now - (p.lastQuestionAt || now) >= Dragon.R.Q_MS + Dragon.R.Q_GRACE_MS) {
        const cq = p.currentQ;
        p.currentQ = null;
        drAnswer(pin, g, pid, p, false, cq.answers[cq.correctIdx], true);
      }
      if (!p.disconnected && !p.currentQ && !r.flap && now >= (r.nextQAt || 0)) drSendQ(g, pid, p);
    } catch (e) { console.error('[dragon] kid', e); } });
    if (m.phase === 'play') {
      const ev = Dragon.tick(m, now);
      if (ev.sprintEnd) drSprintEnd(pin, g, ev.sprintEnd);
      if (ev.sprintGo) io.to(pin).emit('dr:sprint', { id: m.id, go: true, n: ev.sprintGo.n, lm: ev.sprintGo.lm, ms: ev.sprintGo.ms });
      ev.leads.forEach((l) => { io.to(drRoom(pin, m, l.b)).emit('dr:lead', l); io.to(g.hostId).emit('dr:lead', l); });
      if (ev.frenzy) io.to(pin).emit('dr:frenzy', { id: m.id, endsMs: Math.max(0, m.endsAt - now) });
      if (now >= m.endsAt) drFinal(pin, g);
    } else if (now >= m.phaseUntil) {
      // «¡FINAL!» is over: every flight closes now (its beats are in), the last line, then the ceremony
      Object.entries(g.players).forEach(([pid, p]) => { const r = Dragon.kid(m, p.drK); if (r && r.flap) drClose(g, pid, p, now); });
      drLines(pin, g, now, true);
      drStop(g);
      if (g.endTimer) { clearTimeout(g.endTimer); g.endTimer = null; }
      endGame(pin);
      return;
    }
    if (now - (m.lineAt || 0) >= DR_LINE_MS) { m.lineAt = now; drLines(pin, g, now, false); }
  } catch (e) { console.error('[dragon] tick', e); }
}
// «¡FINAL!» on every screen; the tick ends the game FINAL_MS later (beats already on their way still count).
function drFinal(pin, g) {
  const m = g.dr;
  if (!m || m.phase === 'final' || m.phase === 'done') return;
  const now = Date.now();
  if (m.paused) {
    const shift = now - m.pausedAt;
    Dragon.shiftTimes(m, shift);
    Object.values(g.players).forEach((p) => { if (p.lastQuestionAt) p.lastQuestionAt += shift; });
    m.paused = false;
  }
  if (m.phase !== 'play') Dragon.startPlay(m, now);   // «Terminar» in the countdown / intro: nothing flown yet
  const sp = Dragon.final(m, now);
  if (sp) drSprintEnd(pin, g, sp);
  Object.values(g.players).forEach((p) => { p.currentQ = null; });
  io.to(pin).emit('dr:final', { id: m.id, ms: Dragon.R.FINAL_MS });
  if (!m.timer) m.timer = setInterval(() => drTick(pin, m), DR_TICK_MS);
}
function drPause(pin, g, paused) {
  const m = g.dr;
  if (!m || !!m.paused === !!paused || m.phase === 'final' || m.phase === 'done' || m.phase === 'countdown') return;
  const now = Date.now();
  if (paused) { m.paused = true; m.pausedAt = now; }
  else {
    const shift = now - m.pausedAt;
    Dragon.shiftTimes(m, shift);
    Object.values(g.players).forEach((p) => { if (p.lastQuestionAt) p.lastQuestionAt += shift; });
    if (g.endsAt) g.endsAt += shift;
    m.paused = false;
  }
  const clock = drClock(m);
  io.to(pin).emit('dr:pause', {
    id: m.id, paused: !!m.paused, phase: m.phase, phaseMs: Math.max(0, m.phaseUntil - clock),
    endsMs: m.endsAt ? Math.max(0, m.endsAt - clock) : null, frenzyMs: m.frenzyAt ? Math.max(0, m.frenzyAt - clock) : null,
    sprint: drSprintView(m, clock),
  });
  g._lastBcast = 0;
  broadcast(pin);
}
// The end: bonus stars per race, each race's winner, the class podium; each phone gets its own race + its card (built
// again on demand for a reconnect).
function drEndPayloads(g) {
  const m = g.dr;
  const fin = Dragon.finish(m);
  const lite = (x) => x && { k: x.k, name: x.name, skin: x.skin, c: x.c, b: x.b, total: x.total, flown: x.flown, stars: x.stars, rank: x.rank, bonus: x.bonus, right: x.right };
  const races = fin.races.map((rc) => ({
    id: rc.id, winners: rc.winners, rows: rc.rows.map(lite),
    bonus: rc.bonus.map((s) => ({ id: s.id, name: s.name, what: s.what, unit: s.unit, value: s.value, winners: s.winners })),
  }));
  const podium = fin.podium.map(lite);
  const byK = {};
  fin.rows.forEach((x) => { byK[x.k] = x; });
  const common = { winner: 'tie', teamScores: { red: 0, gold: 0 } };   // (no teams: the shared phone code reads these)
  return {
    byK,
    host: Object.assign({
      leaderboard: podium.map((x) => ({ name: x.name, score: x.total, team: 'red' })),
      dragon: { races, podium, count: fin.rows.length, bonusM: Dragon.R.BONUS_M },
    }, common),
    forPlayer(pid) {
      const p = g.players[pid];
      const x = p && byK[p.drK];
      if (!x) return null;
      const race = races.find((rc) => rc.id === x.b) || null;
      return Object.assign({}, common, {
        scores: { [pid]: x.total },
        dragon: { race, podium, count: fin.rows.length, racesN: races.length, bonusM: Dragon.R.BONUS_M },
        me: {
          k: x.k, b: x.b, c: x.c, rank: x.rank, of: x.of, classRank: x.classRank, total: x.total, flown: x.flown, stars: x.stars,
          bonus: x.bonus, right: x.right, answered: x.answered, best: x.best, beats: x.beats, rings: x.rings, laps: x.laps,
          won: !!(race && race.winners.includes(x.k)),
        },
      });
    },
  };
}
function drFinish(pin, g) {
  const m = g.dr;
  if (!m) return;
  drStop(g);
  m.phase = 'done';
  const end = drEndPayloads(g);
  Object.values(g.players).forEach((p) => { const x = end.byK[p.drK]; if (x) p.score = x.total; });   // the room's own score = metres (bonus included)
  io.to(g.hostId).emit('game-end', end.host);
  Object.entries(g.players).forEach(([pid, p]) => {
    if (p.disconnected) return;
    const one = end.forPlayer(pid);
    if (one) io.to(pid).emit('game-end', one);
  });
  _zocoGameEnd(pin, g, end);   // 🪙 El Zoco: a game played for real and its bonus stars pay (core/zoco.js PAY; after the ceremony is sent)
}

// === 🏰 REINOS DE COLORES (gameType 'kingdoms') — hex territory game, Kahoot «Color Kingdoms» style ===
// Right answer → flag → kid taps a glowing tile on their phone → tile turns their colour; pockets they
// surround flip too. Board rules live in core/kingdoms.js. Only DIFFS are broadcast (kd:plant), never the
// whole board, so 30 phones stay light. Every timer captures the round object and does nothing once the
// round changed (end / reset / restart), so a stale timer can never touch a new round.
const KD_PLANT_MS = 8000;        // what the phone shows: 8 s to tap a tile
const KD_GRACE_MS = 1500;        // server waits a bit longer (phone shows the map ~0.9 s after the answer + network)
const KD_NEXT_Q_MS = 900;        // pause after a plant before the next question

const KD_CAPTAINS = ['fer', 'hamdan', 'latifa', 'aileen', 'adric', 'adrian'];   // the cast (public/js/cast.js)
function kdShuffle(a) { return a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]); }
// A new pair every round: last round's captains sit this one out (6 in the cast, so 4 are always free).
function kdPickCaptains(prev) {
  const used = prev ? [prev.red, prev.gold] : [];
  const c = kdShuffle(KD_CAPTAINS.filter((id) => !used.includes(id)));
  return { red: c[0], gold: c[1] };
}

// Score = tiles + siege bonus + Dubai landmarks held right now.
function kdTeamScores(k) {
  const c = Kingdoms.tileCounts(k.own);
  const lm = Kingdoms.landmarkScore(k.board, k.own);
  return { red: c.red + k.bonus.red + lm.red, gold: c.gold + k.bonus.gold + lm.gold };
}
function kdTop(g) {
  const top = {};
  Object.entries(g.players).forEach(([id, p]) => {
    if (!top[p.team] || (p.score || 0) > top[p.team].score) top[p.team] = { id, name: p.name, score: p.score || 0 };
  });
  return top;
}
// Phones only need the board; the projector also gets the roster.
function kdInitPayload(g, forHost) {
  const k = g.kingdoms;
  const out = {
    board: Kingdoms.publicBoard(k.board), own: k.own, teamScores: g.teamScores, top: kdTop(g),
    pressure: Kingdoms.castlePressure(k.board, k.own), plantMs: KD_PLANT_MS, captains: k.captains, paused: !!k.paused,
  };
  if (forHost) {
    out.players = Object.fromEntries(Object.entries(g.players).map(([id, p]) => [id, { name: p.name, team: p.team, avatar: p.avatar || '', score: p.score || 0 }]));
  }
  return out;
}
function kdEmitInit(pin, g) {
  io.to(pin).except(g.hostId).emit('kd:init', kdInitPayload(g, false));
  io.to(g.hostId).emit('kd:init', kdInitPayload(g, true));
}
function kdClearTimers(g) {
  Object.values(g.players || {}).forEach((p) => {
    if (p.kdTimer) { clearTimeout(p.kdTimer); p.kdTimer = null; }
    p.kdPending = false; p.kdOpen = false; p.kdFlags = 0;
  });
}
function kdStart(pin, g) {
  kdClearTimers(g);
  const R = Kingdoms.radiusFor(Object.keys(g.players).length);
  const board = Kingdoms.buildBoard(R, kdShuffle(Kingdoms.SIDE_LANDMARKS));
  g.kingdoms = {
    board, own: Kingdoms.initialOwnership(board),
    bonus: { red: 0, gold: 0 }, alerted: { red: false, gold: false }, sieged: { red: false, gold: false },
    leader: null, plants: 0,
    captains: g.kdCaptains || kdPickCaptains(),     // a new pair of the gang leads the kingdoms every round
  };
  Object.values(g.players).forEach((p) => {
    p.kdStreak = 0; p.kdCorrect = 0;
    p.kdAnswered = 0; p.kdBest = 0; p.kdTiles = 0; p.kdBig = 0; p.kdLms = 0;   // for the ending's stars and each kid's card
  });
  g.teamScores = kdTeamScores(g.kingdoms);
  kdEmitInit(pin, g);
}
// Ask a kid to plant one flag. `reprompt` = reconnect/resync: re-show the open prompt without restarting its timer.
function kdPrompt(pin, pid, opts) {
  opts = opts || {};
  const g = games[pin];
  if (!g || !g.kingdoms || g.state !== 'active' || g.finalizing || g.kingdoms.paused) return;     // «¡FINAL!» / paused: no new flag prompt
  const p = g.players[pid];
  if (!p || !(p.kdFlags > 0)) return;
  const k = g.kingdoms;
  p.kdPending = true;
  p.kdOpen = true;
  if (!opts.reprompt || !p.kdTimer || p.kdTimerPid !== pid) {   // a rejoin changes the socket id: re-arm
    if (p.kdTimer) clearTimeout(p.kdTimer);
    p.kdDeadline = Date.now() + KD_PLANT_MS + KD_GRACE_MS;
    p.kdTimerPid = pid;
    p.kdTimer = setTimeout(() => { if (g.kingdoms === k) kdApplyPlant(pin, pid, null, true); }, KD_PLANT_MS + KD_GRACE_MS);
  }
  p.mashUntil = p.kdDeadline + 1000;      // keeps the global watchdog from pushing a question meanwhile
  const payload = {
    needsPlant: true, flags: p.kdFlags, valid: Kingdoms.validTargets(k.board, k.own, p.team),
    plantMs: Math.max(1000, Math.min(KD_PLANT_MS, p.kdDeadline - KD_GRACE_MS - Date.now())),
  };
  if (opts.correctText !== undefined) {
    io.to(pid).emit('answer-result', { correct: true, correctText: opts.correctText, kingdoms: payload });
  } else {
    io.to(pid).emit('kd:prompt', payload);
  }
}
function kdApplyPlant(pin, pid, tileId, auto) {
  const g = games[pin];
  if (!g || !g.kingdoms || g.state !== 'active') return;
  const p = g.players[pid];
  if (!p || !p.kdPending) return;
  if (!auto && !p.kdOpen) return;        // tap with no prompt open (e.g. between the two flags of a double)
  if (g.finalizing && (auto || Date.now() - g.finalizing.at > Party.GRACE_MS)) return;   // «¡FINAL!»: only a tap already on its way counts
  if (g.kingdoms.paused) return;                                    // paused: the flag waits (the resume prompts again)
  p.kdOpen = false;
  const k = g.kingdoms;
  if (p.kdTimer) { clearTimeout(p.kdTimer); p.kdTimer = null; }
  const valid = Kingdoms.validTargets(k.board, k.own, p.team);
  const asked = (typeof tileId === 'number' && Number.isInteger(tileId)) ? tileId : null;
  const target = asked !== null && valid.includes(asked) ? asked : Kingdoms.bestTarget(k.board, k.own, p.team);
  const fallback = !auto && asked !== null && target !== asked;   // tapped tile was taken a moment earlier
  let result = null;
  const events = [];
  const double = (p.kdFlags || 0) > 1;
  if (target !== null && target !== undefined) {
    result = Kingdoms.plant(k.board, k.own, p.team, target);
    k.plants++;
    // Dubai landmarks this plant took (directly or inside a surround): the kingdom always gets them; the kid earns
    // their bonus only for a flag they planted themselves (an auto-plant must never pay more than tapping).
    const taken = Kingdoms.landmarksTaken(k.board, result);
    const lmPoints = auto ? 0 : taken.reduce((s, x) => s + Kingdoms.LANDMARKS[x.lm].bonus, 0);
    p.score = (p.score || 0) + 1 + result.flipped.length + lmPoints;
    p.kdTiles = (p.kdTiles || 0) + 1 + result.flipped.length;            // the ending's «Más territorio» / «Mayor conquista»
    p.kdBig = Math.max(p.kdBig || 0, 1 + result.flipped.length);
    if (!auto) p.kdLms = (p.kdLms || 0) + taken.length;
    taken.forEach((x) => events.push({ type: 'landmark', tile: x.tile, lm: x.lm, from: x.from, team: p.team, by: p.name, bonus: Kingdoms.LANDMARKS[x.lm].bonus }));
  }
  // Castle pressure: banner once when it reaches ALERT_AT, siege bonus once when fully surrounded.
  const pressure = Kingdoms.castlePressure(k.board, k.own);
  ['red', 'gold'].forEach((team) => {
    const attacker = team === 'red' ? 'gold' : 'red';
    if (pressure[team] >= Kingdoms.ALERT_AT && !k.alerted[team]) { k.alerted[team] = true; events.push({ type: 'castle-alert', team }); }
    if (pressure[team] < Kingdoms.ALERT_AT - 1) k.alerted[team] = false;      // can fire again after a rescue
    if (pressure[team] === 6 && !k.sieged[team]) {
      k.sieged[team] = true;
      k.bonus[attacker] += Kingdoms.SIEGE_BONUS;
      events.push({ type: 'siege', team, by: attacker, bonus: Kingdoms.SIEGE_BONUS });
    }
  });
  g.teamScores = kdTeamScores(k);
  const leader = g.teamScores.red > g.teamScores.gold ? 'red' : g.teamScores.gold > g.teamScores.red ? 'gold' : k.leader;
  if (leader !== k.leader && k.plants > 3) events.push({ type: 'lead', team: leader });
  k.leader = leader;
  io.to(pin).emit('kd:plant', {
    by: p.name, playerId: pid, team: p.team, auto: !!auto, fallback, double, playerScore: p.score || 0, playerTiles: p.kdTiles || 0,
    tile: result ? result.tile : null, from: result ? result.from : null,
    flipped: result ? result.flipped : [], teamScores: g.teamScores, top: kdTop(g), pressure, events,
  });
  p.kdFlags = Math.max(0, (p.kdFlags || 1) - 1);
  if (p.kdFlags > 0 && result) {
    // «Bandera doble»: plant again. A kid who let the first flag auto-plant isn't looking, so the
    // second one is auto-planted right away instead of making them wait another 8 s.
    if (auto) setTimeout(() => { if (g.kingdoms === k) kdApplyPlant(pin, pid, null, true); }, 700);
    else setTimeout(() => { if (g.kingdoms === k) kdPrompt(pin, pid); }, 500);
    return;
  }
  p.kdPending = false;
  p.kdFlags = 0;
  p.mashUntil = 0;
  setTimeout(() => {
    if (g.kingdoms !== k || !games[pin] || games[pin].state !== 'active' || !g.players[pid]) return;
    const q = nextQuestionFor(g, pid);
    if (q) io.to(pid).emit('question', q);
  }, KD_NEXT_Q_MS);
}

// Teacher «⏸ Pausa» (2026-10-16): the clock stops, plant windows wait, answers come back unused (the question stays open),
// taps are refused; on resume the clock moves on by the paused time and every kid still holding a flag gets a fresh 8 s.
function kdPause(pin, g, paused) {
  const k = g.kingdoms;
  if (!k || !!k.paused === !!paused || g.finalizing) return;
  const now = Date.now();
  if (paused) {
    k.paused = true;
    k.pausedAt = now;
    if (g.endTimer) { clearTimeout(g.endTimer); g.endTimer = null; }
    Object.values(g.players).forEach((p) => { if (p.kdTimer) { clearTimeout(p.kdTimer); p.kdTimer = null; } p.kdOpen = false; });
  } else {
    const shift = now - k.pausedAt;
    k.paused = false;
    g.endsAt += shift;
    if (g.endTimer) clearTimeout(g.endTimer);
    g.endTimer = setTimeout(() => { if (games[pin] === g && g.state === 'active') endGame(pin); }, Math.max(0, g.endsAt - now));
    Object.entries(g.players).forEach(([pid, p]) => { if (p.kdPending && p.kdFlags > 0 && !p.disconnected) kdPrompt(pin, pid); });
  }
  io.to(pin).emit('kd:pause', { paused: !!k.paused, endsMs: Math.max(0, g.endsAt - now) });
  finFrenzyAgain(pin, g, !!k.paused);
  g._lastBcast = 0;
  broadcast(pin);
}

// === 🎨 DRAGONES PINTORES v2 (gameType 'paint') — «El Cielo de las Maravillas» (spec docs/specs/dragones-pintores-v2.md) ===
// Each round is a world (Dubái de noche, la Gran Muralla, el río Li, Shanghái; core/paint.js + js/paint-worlds.js). The
// server flies every dragon itself at 10 Hz: a phone's tap is only an intent (player:pc-go), clamped to the sky and
// rate-limited; the dragon flies there at a fixed speed burning fire, and the server paints every cloud its brush touches
// on the way (phones never send paint). The three landmark islands are captured by staying inside their ring. Positions
// go out at 5 Hz (pc:pos, only when something moved), paint / islands / news on change (pc:paint), the roster when it
// changes (pc:roster). Questions on demand («Recargar»: player:pc-ask) and pushed by the server when a dragon runs out
// of fire; one nobody answers is closed as «time up» after Paint.R.Q_SERVER_MS.
const PC_TICK_MS = Paint.R.TICK_MS;
const PC_ENERGY_MAX = Paint.ENERGY_MAX;
const PC_LEAD_ANNOUNCE_MS = 4000;    // lead-change announcements at most every 4 s (a tied round would spam sounds)
const PC_LOST_HOLD_MS = 2500;       // an island's «lost» waits this long: taken by the other kingdom meanwhile = one capture moment
const PC_WORLDS = Paint.WORLDS.length;
const pcTeam = (p) => (p && p.team === 'gold' ? 'gold' : 'red');
const pcCode = (t) => (t === 'red' ? 1 : t === 'gold' ? 2 : 0);

function pcEnsureK(g, p) { if (!p.pcK) p.pcK = (g.pcNextK = (g.pcNextK || 0) + 1); return p.pcK; }
// a kid's dragon for this round: at its kingdom's home with the start fire, its stats at zero (a late joiner too)
function pcFresh(g, p) {
  const k = g.paint;
  pcEnsureK(g, p);
  const team = pcTeam(p);
  const [x, y] = Paint.spawn(k.sky, team, p.pcK);
  p.pcD = { key: p.pcK, team, x, y, tx: x, ty: y, fire: Paint.R.START_FIRE, blazeUntil: 0, strokes: 0, lms: 0, face: team === 'gold' ? -1 : 1, away: false };
  p.pcRound = k.id;
  p.pcStreak = 0; p.pcRight = 0; p.pcAnswered = 0; p.pcBest = 0; p.pcBlazes = 0; p.pcWind = 0;
  p.pcGo = { t: 0, n: 0 }; p.pcSentFire = -1; p.pcNextQAt = 0; p.pcWantQ = false; p.pcWrongRow = 0;
  p.score = 0;
  p.currentQ = null;     // questions are on demand here: never carry last round's open question into this one
}
const pcHas = (g, p) => !!(g.paint && p && p.pcD && p.pcRound === g.paint.id);
// an open question older than the phone's 20 s (a kid back after a drop): closed quietly, the tick deals a fresh one
function pcStaleQ(p) {
  if (p && p.currentQ && p.lastQuestionAt && Date.now() - p.lastQuestionAt > 20000) { p.currentQ = null; p.pcNextQAt = 0; }
}
function pcRoster(g) {
  const out = {};
  Object.values(g.players).forEach((p) => { if (p.pcK && (p.team === 'red' || p.team === 'gold')) out[p.pcK] = [p.name, p.team, p.avatar || '']; });
  return out;
}
// [[k, x, y, tx, ty, flags]]  flags: 1 Llamarada · 2 no fire · 4 away · 8 facing left
function pcPosArr(g, now) {
  const arr = [];
  Object.values(g.players).forEach((p) => {
    if (!pcHas(g, p)) return;
    const d = p.pcD;
    const f = ((d.blazeUntil || 0) > now ? 1 : 0) | (d.fire > 0 ? 0 : 2) | (p.disconnected ? 4 : 0) | (d.face < 0 ? 8 : 0);
    arr.push([p.pcK, Math.round(d.x), Math.round(d.y), Math.round(d.tx), Math.round(d.ty), f]);
  });
  return arr;
}
const pcLmState = (k) => k.board.lm.map((s) => [Math.round(s.v * 100) / 100, pcCode(s.owner)]);
function pcInitPayload(g, pid) {
  const k = g.paint;
  const p = pid ? g.players[pid] : null;
  const now = Date.now();
  return {
    id: k.id, world: k.sky.world, seed: k.sky.seed,
    own: k.board.own.map(pcCode), lm: pcLmState(k), teamScores: g.teamScores, clouds: k.clouds || { red: 0, gold: 0 },
    me: p ? pcEnsureK(g, p) : null, energy: p && p.pcD ? p.pcD.fire : 0, energyMax: PC_ENERGY_MAX,
    captains: g.pcCaptains || null, paused: !!k.paused, roster: pcRoster(g), pos: pcPosArr(g, now), t: now,
    scores: Object.fromEntries(Object.values(g.players).filter((pl) => pl.pcK).map((pl) => [pl.pcK, pl.score || 0])),
    speed: [Paint.R.SPEED, Paint.R.BLAZE_SPEED], brush: [Paint.R.BRUSH, Paint.R.BLAZE_BRUSH],
    endsMs: g.endsAt ? Math.max(0, g.endsAt - (k.paused ? k.pausedAt : now)) : 0,
    q: !!(p && p.currentQ),
  };
}
function pcStart(pin, g) {
  pcStop(g);
  const world = (((g.pcWorld | 0) % PC_WORLDS) + PC_WORLDS) % PC_WORLDS;
  const sky = Paint.buildSky(world, 1 + Math.floor(Math.random() * 1e6));
  g.paint = {
    id: (g.pcRounds = (g.pcRounds || 0) + 1), sky, board: Paint.newBoard(sky), clouds: { red: 0, gold: 0 },
    leader: null, leadAt: 0, milestones: {}, tick: null, tickN: 0, lastT: Date.now(), posKey: '', lmKey: '', paused: false,
  };
  Object.values(g.players).forEach((p) => pcFresh(g, p));
  g.teamScores = { red: 0, gold: 0 };
  Object.keys(g.players).forEach((pid) => io.to(pid).emit('pc:init', pcInitPayload(g, pid)));
  io.to(g.hostId).emit('pc:init', pcInitPayload(g, null));
  const tick = setInterval(() => pcTick(pin, tick), PC_TICK_MS);
  g.paint.tick = tick;
}
// A kid's score = clouds they own right now (the last painter of each cloud), so the crown goes to who holds the sky.
function pcScoreByOwner(g) {
  const c = Paint.cloudsBy(g.paint.board);
  Object.values(g.players).forEach((pl) => { pl.score = (pl.pcK && c[pl.pcK]) || 0; });
}
function pcRecount(g) {
  const t = Paint.totals(g.paint.board);
  g.teamScores = { red: t.red, gold: t.gold };
  g.paint.clouds = t.clouds;
  pcScoreByOwner(g);
  return t;
}
// Final recount + the last batch of paint, so the winner is decided on every cloud painted (called from endGame).
function pcFlush(pin, g) {
  if (!g || !g.paint) return;
  pcSendPaint(pin, g, Date.now(), true);
  pcRecount(g);
}
function pcStop(g) {
  if (g && g.paint && g.paint.tick) { clearInterval(g.paint.tick); g.paint.tick = null; }
}
const pcNames = (g, keys) => (keys || []).slice(0, 3).map((key) => { const p = Object.values(g.players).find((pl) => pl.pcK === key); return p ? p.name : null; }).filter(Boolean);
// paint + islands + news since the last send (one small message to the room)
function pcSendPaint(pin, g, now, force) {
  const k = g.paint;
  const b = k.board;
  const lm = pcLmState(k);
  const lmKey = JSON.stringify(lm);
  const lostDue = (k.lostQ || []).some((l) => now - l.at >= PC_LOST_HOLD_MS);
  if (!force && !b.flips.length && !b.events.length && lmKey === k.lmKey && !lostDue) return;
  k.lmKey = lmKey;
  const flips = b.flips.map(([i, t]) => [i, pcCode(t)]);
  const raw = b.events;
  b.flips = [];
  b.events = [];
  const before = g.teamScores ? Object.assign({}, g.teamScores) : { red: 0, gold: 0 };
  const t = pcRecount(g);
  const events = [];
  const lostQ = k.lostQ || (k.lostQ = []);
  raw.forEach((ev) => {
    if (ev.type === 'capture') {
      const held = lostQ.find((l) => l.lm === ev.lm);
      k.lostQ = lostQ.filter((l) => l.lm !== ev.lm);
      events.push({ type: 'capture', lm: ev.lm, team: ev.team, from: ev.from || (held ? held.team : null), names: pcNames(g, ev.keys) });
    } else if (ev.type === 'lost') {
      lostQ.push({ lm: ev.lm, team: ev.team, by: ev.by, at: now });
    } else if (ev.type === 'wind') events.push({ type: 'wind', team: ev.team, k: ev.k, n: ev.n });
  });
  // a «lost» nobody turned into a capture within PC_LOST_HOLD_MS: now it is news («¡Burj Khalifa queda libre!»)
  k.lostQ = (k.lostQ || []).filter((l) => {
    if (now - l.at < PC_LOST_HOLD_MS && !force) return true;
    events.push({ type: 'lost', lm: l.lm, team: l.team, by: l.by });
    return false;
  });
  const leader = t.red > t.gold ? 'red' : t.gold > t.red ? 'gold' : k.leader;
  if (leader && leader !== k.leader) {
    if ((t.red + t.gold) > 12 && now - (k.leadAt || 0) > PC_LEAD_ANNOUNCE_MS && !g.finalizing) {
      events.push({ type: 'lead', team: leader });
      k.leadAt = now;
    }
    k.leader = leader;
  }
  const painted = (t.clouds.red + t.clouds.gold) / Math.max(1, k.sky.clouds.length);
  [0.25, 0.5, 0.75].forEach((m) => { if (painted >= m && !k.milestones[m]) { k.milestones[m] = true; events.push({ type: 'milestone', pct: Math.round(m * 100) }); } });
  const msg = { f: flips, ts: g.teamScores, cl: t.clouds, lm, ev: events };
  if (flips.length || force || before.red !== t.red || before.gold !== t.gold) {
    msg.sc = Object.fromEntries(Object.values(g.players).filter((pl) => pl.pcK).map((pl) => [pl.pcK, pl.score || 0]));
  }
  io.to(pin).emit('pc:paint', msg);
}
function pcTick(pin, id) {
  const g = games[pin];
  // A room that vanished (or a newer round) stops its own old interval: no ticking forever after a host leaves.
  if (!g || !g.paint || (id && g.paint.tick !== id)) { if (id) clearInterval(id); return; }
  if (g.state !== 'active') return pcStop(g);
  const k = g.paint;
  const now = Date.now();
  const dt = Math.min(0.25, Math.max(0, (now - k.lastT) / 1000));
  k.lastT = now;
  if (k.paused) return;
  // «¡FINAL!»: the dragons stop where they are (a flight already on its way counts for the shared 0.6 s grace)
  if (g.finalizing && now - g.finalizing.at > Party.GRACE_MS) return;
  k.tickN++;
  const ds = [];
  Object.values(g.players).forEach((p) => {
    if (!pcHas(g, p)) return;
    p.pcD.away = !!p.disconnected;
    p.pcD.team = pcTeam(p);
    ds.push(p.pcD);
  });
  Paint.step(k.board, ds, dt, now);
  Object.entries(g.players).forEach(([pid, p]) => {
    if (!pcHas(g, p) || p.disconnected) return;
    const d = p.pcD;
    const whole = Math.ceil(d.fire);
    if (whole !== p.pcSentFire) { p.pcSentFire = whole; io.to(pid).emit('pc:energy', { energy: Math.round(d.fire * 100) / 100 }); }
    if (g.finalizing) return;
    // out of fire (or «Recargar» tapped): a question comes (after a «¡Casi!» it waits for the phone's verdict first)
    if ((d.fire <= 0 || p.pcWantQ) && !p.currentQ && now >= (p.pcNextQAt || 0)) {
      p.pcWantQ = false;
      const q = nextQuestionFor(g, pid);
      if (q) io.to(pid).emit('question', q);
    }
    // a question nobody answers: «time up» on the server too (the phone's own clock says 20 s)
    if (p.currentQ && p.lastQuestionAt && now - p.lastQuestionAt > Paint.R.Q_SERVER_MS) {
      const cq = p.currentQ;
      p.currentQ = null;
      pcAnswer(pin, g, pid, p, false, cq.answers[cq.correctIdx], 'timeup');
    }
  });
  if (k.tickN % 2 === 0) {
    const arr = pcPosArr(g, now);
    const full = k.tickN % 20 === 0;
    const sent = k.sent || (k.sent = {});
    const out = full ? arr : arr.filter((row) => { const was = sent[row[0]]; return !was || was.some((v, i) => v !== row[i]); });
    arr.forEach((row) => { sent[row[0]] = row; });
    if (out.length) io.to(pin).emit('pc:pos', { t: now, d: out, full: full || undefined });
    pcSendPaint(pin, g, now, false);
  }
}
// Teacher «⏸ Pausa» (2026-10-16): the clock stops, the dragons and the islands stand still (no fire burnt, no clouds
// painted), «Recargar» waits; an answer comes back unused (the question stays open); on resume every clock moves on by
// the paused time (the end, the Llamaradas, the open questions' 23 s).
function pcPause(pin, g, paused) {
  const k = g.paint;
  if (!k || !!k.paused === !!paused || g.finalizing) return;
  const now = Date.now();
  if (paused) {
    k.paused = true;
    k.pausedAt = now;
    if (g.endTimer) { clearTimeout(g.endTimer); g.endTimer = null; }
  } else {
    const shift = now - k.pausedAt;
    k.paused = false;
    k.lastT = now;
    g.endsAt += shift;
    Object.values(g.players).forEach((p) => {
      if (p.pcD && p.pcD.blazeUntil > k.pausedAt) p.pcD.blazeUntil += shift;
      if (p.currentQ && p.lastQuestionAt) p.lastQuestionAt += shift;
      if (p.pcNextQAt) p.pcNextQAt += shift;
    });
    if (g.endTimer) clearTimeout(g.endTimer);
    g.endTimer = setTimeout(() => { if (games[pin] === g && g.state === 'active') endGame(pin); }, Math.max(0, g.endsAt - now));
  }
  io.to(pin).emit('pc:pause', { paused: !!k.paused, endsMs: Math.max(0, g.endsAt - now) });
  finFrenzyAgain(pin, g, !!k.paused);
  g._lastBcast = 0;
  broadcast(pin);
}
// A right answer: fire (+ a Llamarada on 3 in a row, or always in the last 30 s) and, while the kid's kingdom trails by
// 12 or more, «Viento a favor» (core/paint.js comeback: capped at the gap). A guess under 450 ms counts as wrong.
function pcAnswer(pin, g, pid, p, correct, correctText, why) {
  if (!g.paint) return;
  if (!pcHas(g, p)) pcFresh(g, p);
  const d = p.pcD;
  const now = Date.now();
  if (correct && why !== 'timeup' && Paint.tooFast(p.lastQuestionAt, now)) { correct = false; why = 'fast'; }
  p.pcAnswered = (p.pcAnswered || 0) + 1;
  if (correct) {
    p.pcStreak = (p.pcStreak || 0) + 1;
    p.pcRight = (p.pcRight || 0) + 1;
    p.pcBest = Math.max(p.pcBest || 0, p.pcStreak);
    p.pcWrongRow = 0;
    const rw = Paint.reward(p.pcStreak, !!g.finFrenzy);
    d.fire = Math.min(PC_ENERGY_MAX, d.fire + rw.energy);
    if (rw.blaze) d.blazeUntil = now + Paint.R.BLAZE_MS;
    if (p.pcStreak % 3 === 0) p.pcBlazes = (p.pcBlazes || 0) + 1;      // the «Más llamaradas» star: earned by a streak only
    const wind = g.finalizing ? [] : Paint.comeback(g.paint.board, d.team, d.x, d.y, now);
    if (wind.length) {
      Paint.applyFlips(g.paint.board, wind, d.team, d.key, now);
      d.strokes = (d.strokes || 0) + wind.length;
      p.pcWind = (p.pcWind || 0) + wind.length;
      g.paint.board.events.push({ type: 'wind', team: d.team, k: p.pcK, n: wind.length });
    }
    p.pcSentFire = Math.ceil(d.fire);
    io.to(pid).emit('answer-result', { correct: true, correctText, paint: { energy: d.fire, blaze: rw.blaze, blazeMs: Paint.R.BLAZE_MS, streak: p.pcStreak, gain: rw.energy, frenzy: !!g.finFrenzy, wind: wind.length, windIds: wind } });
  } else {
    p.pcStreak = 0;
    p.pcWrongRow = (p.pcWrongRow || 0) + 1;
    // the next question waits for the «¡Casi!» on the phone (longer after two in a row: «guessing» loses to thinking)
    const wait = p.pcWrongRow >= 2 ? Paint.R.WRONG_WAIT2_MS : Paint.R.WRONG_WAIT_MS;
    p.pcNextQAt = now + wait;
    io.to(pid).emit('answer-result', { correct: false, correctText, paint: { energy: d.fire, streak: 0, why: why || '', wait } });
  }
}

// === 🕳️ LAS TRAMPILLAS (gameType 'trapdoor') — Mario Party's trapdoor platform (spec docs/specs/las-trampillas.md) ===
// The rules live in core/trapdoor.js, the platform in public/js/trapdoor-arena.js (shared with the screens). One 100 ms
// tick per room owns the clock: «¡YA!», the rounds (title → roulette → 5..1 → «0» → the doors → the tally), the Final
// Round, then «¡FINAL!» and the shared ceremony (finBegin). The server moves every kid itself (a tap is an intent:
// player:td-go), judges every fall at the instant the doors open, deals every question (the wings on the floor, the
// comeback in the pit, «rise with wings» while waiting) and closes the wings question at «0». Down: td:pos at 5 Hz (only
// who moved, everyone every 2 s), td:round / td:lock / td:open / td:close / td:tally at those instants, td:me per kid on
// a change, td:roster on joins and team changes, td:rise when a kid comes back mid-round. No `state` pushes during play.
const tdTeam = (p) => (p && p.team === 'gold' ? 'gold' : 'red');
const TD_ARENAS = Trap.A.ARENAS.length;
function tdEnsureK(g, p) { if (!p.tdK) p.tdK = (g.tdNextK = (g.tdNextK || 0) + 1); return p.tdK; }
const tdKidOf = (g, p) => (g && g.td && p && p.tdK ? g.td.kids[p.tdK] || null : null);
// the teacher's duration (the generic slider, the bots' --seconds) → rounds; the lobby's 5 · 7 · 10 sets them directly
const tdRoundsFor = (sec) => Trap.clampRounds(Math.round((Math.max(15, Number(sec) || 0) * 1000 - Trap.R.INTRO_MS) / Trap.ROUND_MS(false)));
const tdCapS = (n) => Math.ceil(Trap.timeCapMs(n) / 1000);
// a kid on this match's platform (a late joiner rises at the next round), with the name and character it plays as
function tdAttach(g, p, now) {
  const k = tdEnsureK(g, p);
  const d = Trap.addKid(g.td, k, tdTeam(p), now || Date.now());
  d.away = !!p.disconnected;
  return d;
}
function tdRoster(g) {
  const out = {};
  Object.values(g.players).forEach((p) => { if (p.tdK && (p.team === 'red' || p.team === 'gold')) out[p.tdK] = [p.name, p.team, p.avatar || '']; });
  return out;
}
// [[k, x, y, tx, ty, flags]]  flags: 1 wings · 2 in the pit · 4 waiting to rise · 8 phone away · 16 hovering on wings
const tdR1 = (v) => Math.round(v * 10) / 10;
function tdPosArr(m) {
  return Object.values(m.kids).filter((d) => !d.gone).map((d) => [d.k, tdR1(d.x), tdR1(d.y), tdR1(d.tx), tdR1(d.ty),
    (d.wings ? 1 : 0) | (d.st === 'down' ? 2 : 0) | (d.st === 'wait' ? 4 : 0) | (d.away ? 8 : 0) | (d.hover ? 16 : 0)]);
}
// how far into the current round / the intro the clock is (paused: where it stopped)
function tdAgo(m, now) { const at = m.paused ? m.pausedAt : now; return Math.max(0, at - (m.phase === 'intro' ? m.introAt : m.t0)); }
const TD_SHOWN = { lock: 1, open: 1, close: 1 };
function tdInitPayload(g, pid) {
  const m = g.td;
  const p = pid ? g.players[pid] : null;
  const d = p ? tdKidOf(g, p) : null;
  const now = Date.now();
  return {
    id: m.id, arena: m.arena, rounds: m.rounds, r: m.r, phase: m.phase, kind: m.kind, final: m.final, mult: m.mult,
    jumps: m.jumps, ago: tdAgo(m, now), t: now,
    set: TD_SHOWN[m.phase] && m.drop ? m.drop.set : null, open: m.phase === 'open' || m.phase === 'close',
    score: { red: m.score.red, gold: m.score.gold }, roster: tdRoster(g), pos: tdPosArr(m),
    me: d ? d.k : null, st: d ? d.st : null, wings: !!(d && d.wings), wingsNext: !!(d && d.wingsNext),
    captains: g.tdCaptains || null, paused: !!m.paused, endsMs: Math.max(0, Trap.endsAt(m, now) - now),
    speed: Trap.R.SPEED, q: !!(p && p.currentQ), qKind: p && p.currentQ ? p.tdQKind || null : null,
    sc: p ? undefined : Object.fromEntries(Object.values(m.kids).map((x) => [x.k, x.pts])),   // the projector's rosters after an F5
  };
}
function tdStart(pin, g) {
  tdStop(g);
  const now = Date.now();
  g.td = Trap.newGame({ arena: g.tdArena | 0, rounds: g.tdRounds || Trap.R.ROUNDS, now });
  const m = g.td;
  m.id = (g.tdMatches = (g.tdMatches || 0) + 1);
  m.lastT = now; m.tickN = 0; m.sent = {}; m.tick = null;
  Object.values(g.players).forEach((p) => { tdAttach(g, p, now); p.currentQ = null; p.tdQKind = null; p.tdMeKey = ''; p.score = 0; p.tdGo = { t: 0, n: 0 }; });
  g.teamScores = { red: 0, gold: 0 };
  g.endsAt = Trap.endsAt(m, now);
  Object.keys(g.players).forEach((pid) => io.to(pid).emit('td:init', tdInitPayload(g, pid)));
  io.to(g.hostId).emit('td:init', tdInitPayload(g, null));
  const tick = setInterval(() => tdTick(pin, tick), Trap.R.TICK_MS);
  m.tick = tick;
}
function tdStop(g) { if (g && g.td && g.td.tick) { clearInterval(g.td.tick); g.td.tick = null; } }
// what this kid is now (on the floor / in the pit / waiting; wings): sent when it changes
function tdMe(pid, p, d, force) {
  if (!d) return;
  const key = [d.st, d.wings ? 1 : 0, d.wingsNext ? 1 : 0, d.hover ? 1 : 0].join('|');
  if (!force && key === p.tdMeKey) return;
  p.tdMeKey = key;
  io.to(pid).emit('td:me', { k: d.k, st: d.st, wings: !!d.wings, wingsNext: !!d.wingsNext, hover: !!d.hover });
}
// the events of Trap.advance(), told to every screen
function tdEvents(pin, g, ev, now) {
  const m = g.td;
  ev.forEach((e) => {
    if (e.type === 'round') {
      io.to(pin).emit('td:round', { id: m.id, r: m.r, rounds: m.rounds, kind: m.kind, final: m.final, mult: m.mult, jumps: m.jumps, enter: e.enter, ago: tdAgo(m, now), pos: tdPosArr(m) });
      // a kid who rises with a «rise with wings» question still open: the same question now gives the wings of this round
      Object.entries(g.players).forEach(([pid, p]) => {
        if (p.currentQ && p.tdQKind === 'pre' && e.enter.includes(p.tdK)) { p.tdQKind = 'wings'; io.to(pid).emit('td:qkind', { qid: p.currentQ.qid, kind: 'wings' }); }
      });
      g.endsAt = Trap.endsAt(m, now);
    } else if (e.type === 'lock') {
      io.to(pin).emit('td:lock', { id: m.id, r: m.r, set: e.set });
      // «0»: the wings are decided; an open wings question closes («¡CORRE!»)
      Object.entries(g.players).forEach(([pid, p]) => {
        if (p.currentQ && p.tdQKind === 'wings') { const qid = p.currentQ.qid; p.currentQ = null; p.tdQKind = null; io.to(pid).emit('td:qclose', { qid, why: 'lock' }); }
      });
    } else if (e.type === 'open') {
      // `at`: where each kid on the floor was judged (after the lag grace): falls are drawn from there, never from a
      // position the phone predicted
      const r2 = (v) => Math.round(v * 100) / 100;
      io.to(pin).emit('td:open', { id: m.id, r: m.r, set: e.set, falls: e.falls, saves: e.saves, at: (e.where || []).map(([k, x, y]) => [k, r2(x), r2(y)]) });
    } else if (e.type === 'close') {
      io.to(pin).emit('td:close', { id: m.id, r: m.r });
    } else if (e.type === 'tally') {
      g.teamScores = { red: m.score.red, gold: m.score.gold };
      Object.values(g.players).forEach((p) => { const d = tdKidOf(g, p); p.score = d ? d.pts : 0; });
      io.to(pin).emit('td:tally', { id: m.id, r: m.r, rounds: m.rounds, add: e.add, stand: e.stand, present: e.present, score: e.score, lead: e.lead, leadChanged: e.leadChanged, mult: e.mult, final: e.final,
        sc: Object.fromEntries(Object.values(m.kids).map((d) => [d.k, d.pts])) });
    } else if (e.type === 'end') {
      finBegin(pin, g, 'time');
    }
  });
}
// The match's only clock: a fault is logged, and one that keeps failing (~3 s) sends the class to the ending
// instead of leaving a frozen platform on the projector.
function tdTick(pin, id) {
  try {
    tdTickInner(pin, id);
    const g = games[pin];
    if (g && g.td) g.td.errs = 0;
  } catch (e) {
    console.error('[tdTick]', e);
    const g = games[pin];
    if (g && g.td && (g.td.errs = (g.td.errs || 0) + 1) >= 30 && g.state === 'active' && !g.finalizing) {
      tdStop(g);
      try { finBegin(pin, g, 'time'); } catch (e2) { console.error('[tdTick] ending', e2); }
    }
  }
}
function tdTickInner(pin, id) {
  const g = games[pin];
  // A room that vanished (or a newer match) stops its own old interval: no ticking forever after a host leaves.
  if (!g || !g.td || (id && g.td.tick !== id)) { if (id) clearInterval(id); return; }
  if (g.state !== 'active') return tdStop(g);
  const m = g.td;
  const now = Date.now();
  const dt = Math.min(0.25, Math.max(0, (now - m.lastT) / 1000));
  m.lastT = now;
  if (m.paused) return;
  // «¡FINAL!»: the platform stands still (nothing is scored after the last tally)
  if (g.finalizing) { if (m.phase !== 'done') m.phase = 'final'; return; }
  m.tickN++;
  // the kids as the room knows them: team (a teacher swap), away (a phone that dropped), name + character
  const byK = {};
  Object.entries(g.players).forEach(([pid, p]) => {
    if (!p.tdK) return;
    byK[p.tdK] = [pid, p];
    const d = m.kids[p.tdK];
    if (d) { d.team = tdTeam(p); d.away = !!p.disconnected; }
  });
  Object.values(m.kids).forEach((d) => { d.gone = !byK[d.k]; if (d.gone) d.away = true; });     // left the room (the 5-min cleanup): off every screen
  tdEvents(pin, g, Trap.advance(m, now, Math.random), now);
  if (g.finalizing || g.state !== 'active') return;
  Trap.stepKids(m, dt);
  // questions: dealt by the room (never asked for), closed as «time up» after Trap.R.Q_SERVER_MS
  Object.values(byK).forEach(([pid, p]) => {
    const d = m.kids[p.tdK];
    if (!d || p.disconnected) return;
    if (p.currentQ && p.lastQuestionAt && now - p.lastQuestionAt > Trap.R.Q_SERVER_MS) {
      const cq = p.currentQ;
      p.currentQ = null;
      tdAnswer(pin, g, pid, p, false, cq.answers[cq.correctIdx], 'timeup');
    }
    if (!p.currentQ && now >= (d.nextQAt || 0)) {
      const kind = Trap.wantQ(m, d.k, now);
      if (kind) {
        const q = nextQuestionFor(g, pid);
        if (q) { p.tdQKind = kind; p.tdDealtAt = now; io.to(pid).emit('question', Object.assign({}, q, { td: kind })); }
      }
    }
    tdMe(pid, p, d, false);
    // the phone's round trip, every 3 s (a tiny ack): the doors' grace follows each kid's own lag (Trap.graceOf)
    if (now - (p.tdPingAt || 0) >= Trap.R.PING_EVERY_MS) {
      p.tdPingAt = now;
      const sock = io.sockets.sockets.get(pid);
      if (sock) {
        const t0 = Date.now();
        sock.timeout(2500).emit('td:ping', { lag: d.lagMs || 0 }, (err) => {     // (timeout: an unanswered ping is dropped)
          if (err || games[pin] !== g || !g.td || g.td.kids[d.k] !== d) return;
          p.tdRtts = (p.tdRtts || []).concat(Date.now() - t0).slice(-5);
          const s = p.tdRtts.slice().sort((a, b) => a - b);
          d.lagMs = Math.round(s[s.length >> 1] / 2);
        });
      }
    }
  });
  if (m.tickN % 2 === 0) {
    const arr = tdPosArr(m);
    const full = m.tickN % 20 === 0;
    const out = full ? arr : arr.filter((row) => { const was = m.sent[row[0]]; return !was || was.some((v, i) => v !== row[i]); });
    arr.forEach((row) => { m.sent[row[0]] = row; });
    if (out.length) io.to(pin).emit('td:pos', { t: now, d: out, full: full || undefined });
  }
}
// A judged answer: too fast (< 450 ms) = wrong. The kind is the one the question was dealt for (p.tdQKind).
function tdAnswer(pin, g, pid, p, correct, correctText, why) {
  const m = g.td;
  if (!m) return;
  const d = tdKidOf(g, p) || tdAttach(g, p);
  const now = Date.now();
  // «a guess» is timed from the deal on the wall clock (p.tdDealtAt): a teacher's pause is reading time too, so a kid
  // who answers the moment the game resumes is not called too fast (lastQuestionAt is shifted by pauses: the time-up)
  if (correct && why !== 'timeup' && Trap.tooFast(p.tdDealtAt || p.lastQuestionAt, now)) { correct = false; why = 'fast'; }
  const kind = p.tdQKind || 'wings';
  p.tdQKind = null;
  const res = Trap.answer(m, d.k, kind, correct, now, Math.random);
  if (res.back === 'now' && res.rose) io.to(pin).emit('td:rise', { id: m.id, k: d.k, x: tdR1(res.rose[0]), y: tdR1(res.rose[1]) });
  io.to(pid).emit('answer-result', { correct: !!correct, correctText, td: Object.assign({}, res, { why: why || '', r: m.r, final: m.final }) });
  tdMe(pid, p, d, true);
}
// Teacher «⏸ Pausa»: the count, the roulette, the runners and the question clocks stand still; on «Seguir» every clock
// moves on by the paused time (the round, the open questions, the «¡Casi!» waits).
function tdPause(pin, g, paused) {
  const m = g.td;
  if (!m || !!m.paused === !!paused || g.finalizing) return;
  const now = Date.now();
  if (paused) {
    if (!Trap.pause(m, now)) return;
  } else {
    const shift = Trap.resume(m, now);
    m.lastT = now;
    Object.values(g.players).forEach((p) => { if (p.currentQ && p.lastQuestionAt) p.lastQuestionAt += shift; });
  }
  g.endsAt = Trap.endsAt(m, now);
  io.to(pin).emit('td:pause', { id: m.id, paused: !!m.paused, ago: tdAgo(m, now), phase: m.phase, r: m.r, endsMs: Math.max(0, g.endsAt - now) });
  g._lastBcast = 0;
  broadcast(pin);
}
// Las Trampillas: kingdom points (the share standing each round), each kid's rounds standing, wings, comebacks, stars
function tdEndPayloads(g) {
  const m = g.td;
  const rows = Object.values(g.players).filter((p) => p.team && p.tdK && m && m.kids[p.tdK]).map((p) => {
    const d = m.kids[p.tdK];
    return { k: finKey(g, p), name: p.name, skin: hcSkin(p), team: p.team, pts: d.pts, stood: d.stood, best: d.best, saved: d.saved, backs: d.backs, right: d.right, answered: d.answered, falls: d.falls, away: !!p.disconnected };
  }).filter((r) => !r.away || r.pts > 0 || r.answered > 0);
  const fin = Trap.finish(rows, g.teamScores);
  const byK = {};
  fin.rows.forEach((r) => { byK[r.k] = r; });
  const lite = (r) => Party.lite(r, r && r.pts);
  const common = {
    winner: fin.winner,
    leaderboard: fin.rows.map((r) => ({ name: r.name, score: r.pts, team: r.team, avatar: '' })),
    fin: {
      game: 'trapdoor', winner: fin.winner, why: g.finalizing ? g.finalizing.why : 'time', count: fin.rows.length,
      totals: fin.totals, captains: g.tdCaptains || null, arena: m ? m.arena : (g.tdArena | 0), rounds: m ? m.r : 0,
      crews: { red: fin.rows.filter((r) => r.team === 'red').slice(0, 12).map(lite), gold: fin.rows.filter((r) => r.team === 'gold').slice(0, 12).map(lite) },
      stars: Party.publicStars(fin.stars, byK, (r) => r.pts),
      top: fin.rows.slice(0, 10).map(lite), mvp: { red: lite(byK[fin.mvp.red]), gold: lite(byK[fin.mvp.gold]) },
    },
  };
  const cards = {};
  fin.rows.forEach((r) => {
    cards[r.k] = {
      score: r.pts,
      me: {
        k: r.k, team: r.team, skin: r.skin, won: fin.winner === r.team, tie: fin.winner === 'tie', mvp: fin.mvp[r.team] === r.k,
        stars: r.stars, rank: r.rank, of: fin.rows.length,
        pts: r.pts, stood: r.stood, best: r.best, saved: r.saved, backs: r.backs, right: r.right, answered: r.answered, falls: r.falls, share: r.share,
      },
    };
  });
  return finPack(g, common, fin.totals, cards);
}

// === ❄️ BATALLA DE NIEVE EN SKI DUBÁI (gameType 'snow') — Gimkit 2D-map infection game, Dralingo style ===
// Rules in core/snow.js, map in public/js/snow-map.js (spec docs/specs/batalla-de-nieve.md). Phones walk their saga
// avatar (movement runs on the phone, the server checks speed and walls), answer at the 4-colour stations for copos,
// throw snowballs (server-simulated, 10 Hz), and the ice team grows until the timer ends or nobody is left.
// Kids are numbered per round (p.snIdx) so the 5 Hz position broadcast stays small and survives rejoins.
const SN_TICK_MS = 100;
function snFlags(p, now) {
  return (p.snSide === 'ice' ? 1 : 0) | (now < (p.snStunUntil || 0) ? 2 : 0) | (now < (p.snShieldUntil || 0) ? 4 : 0)
    | (now < (p.snRespawnUntil || 0) ? 8 : 0);
}
function snRoster(g) {
  const out = {};
  Object.values(g.players).forEach((p) => {
    if (!p.snIdx || p.snRound !== g.snow.id) return;
    out[p.snIdx] = { name: p.name, skin: p.snSkin, side: p.snSide, on: !p.disconnected };
  });
  return out;
}
function snPosArray(g, now) {
  const k = g.snow;
  const arr = [];
  Object.entries(g.players).forEach(([pid, p]) => {
    const pos = k.pos[pid];
    if (!pos || p.disconnected || p.snRound !== k.id) return;
    arr.push([p.snIdx, Math.round(pos.x), Math.round(pos.y), pos.f || 0, snFlags(p, now)]);
  });
  return arr;
}
function snMe(g, p, now, extra) {
  return Object.assign({
    idx: p.snIdx, side: p.snSide, copos: p.snCopos, calor: p.snCalor, streak: p.snStreak || 0,
    stunMs: Math.max(0, (p.snStunUntil || 0) - now), respawnMs: Math.max(0, (p.snRespawnUntil || 0) - now),
    shieldMs: Math.max(0, (p.snShieldUntil || 0) - now), score: Snow.scoreOf(p, now), freezes: p.snFreezes || 0,
    paused: !!g.snow.paused,
  }, extra || {});
}
function snSendMe(g, pid, extra) {
  const p = g.players[pid];
  if (p && g.snow) io.to(pid).emit('sn:me', snMe(g, p, Date.now(), extra));
}
function snSpawnPos(g, side) {
  const m = g.snow.map;
  const list = side === 'ice' ? m.spawns.ice : m.spawns.sun;
  const [tx, ty] = list[Math.floor(Math.random() * list.length)];
  return { x: (tx + 0.5) * m.tile, y: (ty + 0.5) * m.tile + 6 };
}
// Bring a kid into the running round (start, late join, rejoin with a new socket id).
function snAttach(g, pid, p, late) {
  const k = g.snow;
  const now = Date.now();
  const fresh = p.snRound !== k.id;
  Snow.preparePlayer(k, p, now, late);
  if (fresh) p.snSkin = SnowMap.skinFor(p.avatar, p.name);
  if (p.snPid && p.snPid !== pid && k.pos[p.snPid]) { k.pos[pid] = k.pos[p.snPid]; delete k.pos[p.snPid]; }
  if (p.snPid && p.snPid !== pid) k.balls.forEach((b) => { if (b.by === p.snPid) b.by = pid; });
  // a survivor's clock stops while their phone is away (see the disconnect handler) and runs again on the way back
  if (!fresh && p.snSide === 'sun' && !p.snSunSince) p.snSunSince = now;
  p.snPid = pid;
  if (!k.pos[pid]) { const s = snSpawnPos(g, p.snSide); k.pos[pid] = { x: s.x, y: s.y, f: 2, at: now }; }
  k.posDirty = true;
}
function snInitPayload(g, pid) {
  const k = g.snow;
  const now = Date.now();
  const out = {
    seed: k.seed, round: k.id, spellInMs: Math.max(0, k.spellAt - now), spellCast: k.spellCast, paused: k.paused,
    players: snRoster(g), pos: snPosArray(g, now), counts: Snow.counts(g.players), captains: g.snCaptains || null,
    chest: k.chest ? { id: k.chest.id, x: k.chest.x, y: k.chest.y, zone: k.chest.zone, lifeMs: k.chest.until - now } : null,
  };
  const p = pid ? g.players[pid] : null;
  if (p && k.pos[pid]) out.me = snMe(g, p, now, { x: k.pos[pid].x, y: k.pos[pid].y });
  return out;
}
function snStart(pin, g) {
  snStop(g);
  const now = Date.now();
  g.snow = Snow.newRound(1 + Math.floor(Math.random() * 1e6), now);
  g.snow.tick = null;
  Object.entries(g.players).forEach(([pid, p]) => {
    p.snRound = null; p.snPid = null;
    p.score = 0;
    p.currentQ = null;            // questions are on demand at the stations
    // each kid starts the pack at a random spot, so «Otra ronda» never replays the same question order
    p.queueIdx = Math.floor(Math.random() * Math.max(1, (g.questions || []).length));
    // a phone that already left isn't in this round (class test 2026-10-12: absent kids were ranked as survivors);
    // if it comes back, the join / resync attaches it as a late joiner
    if (p.disconnected) { p.snSide = null; p.snSunSince = 0; return; }
    snAttach(g, pid, p, false);
  });
  g.teamScores = { red: 0, gold: 0 };
  Object.keys(g.players).forEach((pid) => io.to(pid).emit('sn:init', snInitPayload(g, pid)));
  io.to(g.hostId).emit('sn:init', snInitPayload(g, null));
  g.snow.lastStep = now;
  const tick = setInterval(() => snTick(pin, tick), SN_TICK_MS);
  g.snow.tick = tick;
}
function snStop(g) {
  if (g && g.snow && g.snow.tick) { clearInterval(g.snow.tick); g.snow.tick = null; }
}
function snSpell(pin, g, now) {
  const k = g.snow;
  const ids = Snow.castSpell(k, g.players, now);
  ids.forEach((pid) => {
    const s = snSpawnPos(g, 'ice');
    k.pos[pid] = { x: s.x, y: s.y, f: 2, at: now + Snow.R.RESPAWN_MS };
    snSendMe(g, pid, { pos: [s.x, s.y], frozenBy: 'spell' });
  });
  k.posDirty = true;
  io.to(pin).emit('sn:spell', {
    kids: ids.map((pid) => ({ idx: g.players[pid].snIdx, name: g.players[pid].name, skin: g.players[pid].snSkin })),
    counts: Snow.counts(g.players), again: !!k.spellAgain,
  });
  k.spellAgain = false;
  k.nextChestAt = Math.max(k.nextChestAt, now + 6000);
}
// Big moments the projector shows (each once per round): half the class frozen, the last 3, the last one.
function snMoments(pin, g) {
  const k = g.snow;
  const c = Snow.counts(g.players);
  const m = k.milestones;
  if (!m.half && c.total >= 4 && c.ice >= Math.ceil(c.total / 2) && c.sun > 0) { m.half = true; io.to(pin).emit('sn:moment', { type: 'half', counts: c }); }
  if (!m.last3 && c.total >= 6 && c.sun <= 3 && c.sun >= 2) {
    m.last3 = true;
    const kids = Object.values(g.players).filter((p) => !p.disconnected && p.snSide === 'sun' && p.snRound === k.id).map((p) => ({ idx: p.snIdx, name: p.name, skin: p.snSkin }));
    // «¡Último refugio!»: the last survivors get full ☀️ and a 5 s shield, so the finale lasts and is worth watching
    Snow.refuge(g.players, Date.now()).forEach((pid) => snSendMe(g, pid, { refuge: true }));
    io.to(pin).emit('sn:moment', { type: 'last3', counts: c, kids });
  }
  if (!m.last1 && c.total >= 3 && c.sun === 1) {
    m.last1 = true;
    const p = Object.values(g.players).find((pl) => !pl.disconnected && pl.snSide === 'sun' && pl.snRound === k.id);
    if (p) io.to(pin).emit('sn:moment', { type: 'last1', counts: c, kids: [{ idx: p.snIdx, name: p.name, skin: p.snSkin }] });
  }
}
function snHits(pin, g, events, now) {
  const k = g.snow;
  let froze = false;
  events.forEach((ev) => {
    const by = g.players[ev.by];
    const t = g.players[ev.target];
    io.to(pin).emit('sn:hit', {
      type: ev.type, ball: ev.ball, x: ev.x, y: ev.y, calor: ev.calor,
      by: by ? by.snIdx : 0, byName: by ? by.name : '', target: t ? t.snIdx : 0, targetName: t ? t.name : '',
    });
    if (!t) return;
    if (ev.type === 'freeze') {
      froze = true;
      const s = snSpawnPos(g, 'ice');
      k.pos[ev.target] = { x: s.x, y: s.y, f: 2, at: now + Snow.R.RESPAWN_MS };
      snSendMe(g, ev.target, { pos: [s.x, s.y], frozenBy: by ? by.name : '', hit: 'freeze' });
      if (by) snSendMe(g, ev.by, { scored: 'freeze', targetName: t.name });
    } else if (ev.type === 'brrr' || ev.type === 'stun' || ev.type === 'shield') {
      snSendMe(g, ev.target, { hit: ev.type, byName: by ? by.name : '' });
      if (by && ev.type === 'stun') snSendMe(g, ev.by, { scored: 'stun', targetName: t.name });
    }
  });
  k.posDirty = true;
  if (froze) snMoments(pin, g);
}
function snTick(pin, id) {
  const g = games[pin];
  // A room that vanished (or a newer round) stops its own old interval.
  if (!g || !g.snow || (id && g.snow.tick !== id)) { if (id) clearInterval(id); return; }
  if (g.state !== 'active') return snStop(g);
  const k = g.snow;
  const now = Date.now();
  const dt = Math.min(0.25, Math.max(0, (now - (k.lastStep || now)) / 1000));
  k.lastStep = now;
  k.n = (k.n || 0) + 1;
  if (k.paused || g.finalizing) return;     // paused, or «¡FINAL!»: nothing moves
  if (!k.spellCast) {
    if (now >= k.spellAt) snSpell(pin, g, now);
  } else if (!k.ending) {
    // every ice kid left the game: the spell comes back for one survivor after a few seconds
    const c = Snow.counts(g.players);
    if (c.ice === 0 && c.sun >= 2) {
      if (!k.noIceSince) k.noIceSince = now;
      else if (now - k.noIceSince > 6000) { k.noIceSince = 0; k.spellAgain = true; snSpell(pin, g, now); }
    } else k.noIceSince = 0;
  }
  if (k.balls.length) {
    const evs = Snow.stepBalls(k, g.players, dt, now);
    if (evs.length) snHits(pin, g, evs, now);
  }
  if (k.n % 10 === 0) Snow.warmUp(g.players, now).forEach((pid) => snSendMe(g, pid, { warm: true }));
  if (k.chest && now > k.chest.until) {
    io.to(pin).emit('sn:chest', { id: null, gone: k.chest.id });
    k.chest = null;
    k.nextChestAt = now + Snow.nextChestGap();
  }
  if (!k.chest && k.spellCast && now >= k.nextChestAt) {
    const c = Snow.spawnChest(k, now);
    io.to(pin).emit('sn:chest', { id: c.id, x: c.x, y: c.y, zone: c.zone, lifeMs: c.until - now });
  }
  // who is in the game (joins, leaves): a fresh roster for the projector and phones
  if (k.n % 5 === 0) {
    const sig = Object.values(g.players).filter((p) => p.snRound === k.id).map((p) => p.snIdx + (p.disconnected ? 'x' : '') + p.snSide).join(',');
    if (sig !== k.rosterSig) { k.rosterSig = sig; io.to(pin).emit('sn:roster', { players: snRoster(g), counts: Snow.counts(g.players) }); k.posDirty = true; }
  }
  if (k.n % 2 === 0 && (k.posDirty || k.n % 20 === 0)) {
    k.posDirty = false;
    io.to(pin).emit('sn:tick', snPosArray(g, now));
  }
  if (!k.ending) {
    const w = Snow.winnerNow(k, g.players, now);
    if (w) {
      k.ending = true;
      setTimeout(() => {
        if (games[pin] !== g || g.state !== 'active' || g.snow !== k) return;
        if (!Snow.winnerNow(k, g.players, Date.now())) { k.ending = false; return; }   // someone came back meanwhile
        finBegin(pin, g, 'allFrozen');
      }, 2600);
    }
  }
}
function snAnswer(pin, g, pid, p, correct, correctText) {
  if (!g.snow) return;
  const r = Snow.answer(p, correct, !!g.finFrenzy);       // the last 30 s: «¡Copos dobles!»
  io.to(pid).emit('answer-result', {
    correct, correctText,
    snow: { gained: r.gained, racha: r.racha, calor: r.calor, copos: p.snCopos, calorNow: p.snCalor, streak: p.snStreak || 0, side: p.snSide },
  });
  snSendMe(g, pid);
  if (correct && r.racha) io.to(g.hostId).emit('sn:fx', { type: 'racha', idx: p.snIdx, name: p.name, streak: p.snStreak });
}
// Teacher pause: nothing moves, no snowballs, the clock stops; on resume every timer moves forward.
function snPause(pin, g, paused) {
  const k = g.snow;
  if (!k || !!k.paused === !!paused) return;
  const now = Date.now();
  if (paused) {
    k.paused = true;
    k.pausedAt = now;
    k.balls = [];                       // snowballs in the air melt (the screens drop theirs too)
    if (g.endTimer) { clearTimeout(g.endTimer); g.endTimer = null; }
  } else {
    const shift = now - k.pausedAt;
    Snow.shiftTimers(k, g.players, shift);
    g.endsAt += shift;
    k.paused = false;
    if (g.endTimer) clearTimeout(g.endTimer);
    g.endTimer = setTimeout(() => { if (games[pin] && games[pin].state === 'active') endGame(pin); }, Math.max(0, g.endsAt - now));
  }
  io.to(pin).emit('sn:pause', { paused: k.paused, spellInMs: k.spellCast ? 0 : Math.max(0, k.spellAt - now) });
  finFrenzyAgain(pin, g, !!k.paused);
  Object.keys(g.players).forEach((pid) => snSendMe(g, pid));
  g._lastBcast = 0;
  broadcast(pin);
}
// End: the winner side, every kid's numbers, the bonus stars (core/snow.js finish) for the Mario Party ceremony on every
// screen (js/party.js; built once by finFinish and kept for a screen that reconnects). The `snow` object is the old
// end screen's data, kept as it was.
function snEndPayloads(g) {
  const k = g.snow;
  if (!k) return null;
  snStop(g);
  const at = g.finalizing ? g.finalizing.at : Date.now();      // the seconds of «¡FINAL!» are not survived seconds
  const fin = Snow.finish(k, g.players, at);
  const old = (r) => r && ({ idx: (g.players[r.id] || {}).snIdx, name: r.name, skin: (g.players[r.id] || {}).snSkin, side: r.side, score: r.score, seconds: r.seconds, freezes: r.freezes, right: r.right });
  Object.values(g.players).forEach((p) => { if (p.snRound === k.id) p.score = Snow.scoreOf(p, at); });
  const byK = {};
  fin.rows.forEach((r) => { byK[r.k] = r; });
  const lite = (r) => Party.lite(r, r && r.score);
  const live = fin.rows.filter((r) => !r.gone);
  const finCommon = {
    game: 'snow', winner: fin.winner, why: g.finalizing ? g.finalizing.why : 'time', count: live.length,
    totals: { sun: fin.counts.sun, ice: fin.counts.ice, total: fin.counts.total },
    captains: g.snCaptains || null,
    stars: Party.publicStars(fin.stars, byK, (r) => r.score),
    mvp: { sun: lite(fin.mvpSun), ice: lite(fin.mvpIce) },
  };
  const crews = (n) => ({ sun: live.filter((r) => r.side === 'sun').slice(0, n).map(lite), ice: live.filter((r) => r.side === 'ice').slice(0, n).map(lite) });
  // the phones: what their ceremony draws (a few kids of each side, the stars, their card); the projector: everything
  const common = { winner: fin.winner, snow: { winner: fin.winner, counts: fin.counts }, fin: Object.assign({ crews: crews(6), top: [] }, finCommon) };
  const hostOnly = {
    snow: {
      winner: fin.winner, counts: fin.counts, mvpSun: old(fin.mvpSun), mvpIce: old(fin.mvpIce),
      top: fin.rows.slice(0, 8).map(old),
      survivors: fin.rows.filter((r) => r.side === 'sun' && !r.gone).slice(0, 14).map(old),
    },
    leaderboard: fin.rows.map((r) => ({ name: r.name, score: r.score, team: r.side, avatar: r.avatar })),
    fin: Object.assign({ crews: crews(12), top: live.slice(0, 10).map(lite) }, finCommon),
  };
  const teamScores = { red: fin.counts.sun, gold: fin.counts.ice };
  const cards = {};
  fin.rows.forEach((r) => {
    cards[r.k] = {
      won: r.side === fin.winner, score: r.score,
      me: {
        k: r.k, team: r.side, side: r.side, skin: r.skin, won: r.side === fin.winner, tie: false, stars: r.stars, rank: r.rank,
        mvp: (fin.mvpSun && fin.mvpSun.k === r.k && r.seconds > 0) || (fin.mvpIce && fin.mvpIce.k === r.k && r.freezes > 0) || false,
        score: r.score, seconds: r.seconds, freezes: r.freezes, right: r.right, answered: r.right + ((g.players[r.id] || {}).snWrong || 0),
        hits: r.hits, stuns: r.stuns, best: r.best, spell: r.spell,
      },
    };
  });
  return {
    teamScores, host: Object.assign({ teamScores }, common, hostOnly),
    keyOf: (p) => (p && p.snRound === k.id ? p.snIdx : null),
    guest: () => Object.assign({ teamScores }, common, { me: { k: 0, guest: true } }),
    forPlayer(pid) {
      const p = g.players[pid];
      const c = p && cards[this.keyOf(p)];
      if (!c) return null;
      const other = p.team === 'red' ? 'gold' : 'red';
      return Object.assign({}, common, { teamScores: { [p.team]: c.won ? 1 : 0, [other]: c.won ? 0 : 1 }, scores: { [pid]: c.score }, me: c.me });
    },
  };
}

// === 🦅 OJOS DE HALCÓN (gameType 'halcon') — Super Mario Party «Looking for Love», played in boards of 4 ===
// Rules in core/halcon.js (spec docs/specs/ojos-de-halcon.md). The teacher's «Empezar» deals the class into boards of 4
// (3 when it doesn't divide; ≤ 5 kids = one board) so the countdown can show each board's run-in on its phones. Every
// round is server-timed: the question across the boards → the four answers in the windows (each look reaches the kid's
// board and the projector at once; right / wrong stays secret) → the round resolves (+5/+3/+2/+1 by speed inside each
// board, 0 for a wrong look) → next. One timer per room that a pause re-arms. Phones get only their own board; the
// projector gets every board and the class top 5. Kids sit in seats (p.hcSeat): a reload keeps the seat and the look.
function hcSeatMap(g) {
  const out = {};
  const h = g.halcon;
  Object.entries(g.players).forEach(([pid, p]) => { if (Halcon.inGame(h, p)) out[p.hcSeat] = [pid, p]; });
  return out;
}
const hcSkin = (p) => SnowMap.skinFor(p.avatar, p.name);   // the saga character the kid picked in the lobby
function hcBoardPublic(g, b, seats) {
  const h = g.halcon;
  return {
    id: b.id,
    seats: b.seats.map((sid) => {
      const s = h.seats[sid], hit = seats[sid];
      return { id: sid, name: s.name, skin: s.skin, score: s.score || 0, on: !!(hit && !hit[1].disconnected) };
    }),
  };
}
function hcBoardPids(g, boardId) {
  const h = g.halcon;
  return Object.entries(g.players)
    .filter(([, p]) => Halcon.inGame(h, p) && p.hcBoard === boardId && !p.disconnected).map(([pid]) => pid);
}
function hcTop(g, n) {
  return Object.values(g.halcon.seats).slice().sort((a, b) => (b.score || 0) - (a.score || 0) || a.id - b.id).slice(0, n)
    .map((s) => ({ id: s.id, name: s.name, skin: s.skin, score: s.score || 0, board: s.board }));
}
// the question as a screen may see it now: the answers only once the windows open, the right one only at resolve
function hcQPublic(h) {
  const q = h.q;
  if (!q || !['question', 'answer', 'resolve'].includes(h.phase)) return null;
  const open = h.phase !== 'question';
  return { text: q.text, image: q.image, opts: open ? q.opts : null, pics: open ? q.pics : null, correctPos: h.phase === 'resolve' ? q.correctPos : -1 };
}
// time left in the phase; while paused the clock stands still (phaseUntil only moves on resume)
const hcPhaseLeft = (h, now) => Math.max(0, h.phaseUntil - (h.paused ? h.pausedAt : now));
function hcInitPayload(g, pid) {
  const h = g.halcon;
  const now = Date.now();
  const seats = hcSeatMap(g);
  const p = pid ? g.players[pid] : null;
  const mine = p && Halcon.inGame(h, p) ? Halcon.boardOf(h, p.hcBoard) : null;
  const boards = pid ? (mine ? [mine] : []) : h.boards;
  const ids = new Set(boards.map((b) => b.id));
  const res = h.phase === 'resolve' && h.lastRes ? h.lastRes : null;
  // before the reveal only WHO looked (and the phone's own window); the windows of the others come with the resolve
  const view = Halcon.lookView(h, [...ids], mine ? p.hcSeat : null);
  return {
    id: h.id, phase: h.phase, phaseMs: hcPhaseLeft(h, now), paused: !!h.paused, round: h.round, rounds: h.rounds,
    you: mine ? p.hcSeat : null, board: mine ? mine.id : null,
    boards: boards.map((b) => hcBoardPublic(g, b, seats)),
    q: hcQPublic(h),
    ready: view.ready, mine: view.mine,
    res: res ? { correctPos: res.correctPos, correctText: res.correctText, boards: res.boards.filter((b) => ids.has(b.id)) } : null,
    top: pid ? null : hcTop(g, 5),
    serverNow: now,
  };
}
function hcSendInit(pin, g) {
  io.to(g.hostId).emit('hc:init', hcInitPayload(g, null));
  Object.entries(g.players).forEach(([pid, p]) => { if (!p.disconnected) io.to(pid).emit('hc:init', hcInitPayload(g, pid)); });
}
// the one timer of the room: remembers what it was going to do, so a pause can re-arm it with the time left
function hcTimer(pin, g, ms, fn) {
  const h = g.halcon;
  if (h.timer) clearTimeout(h.timer);
  h.timerAt = Date.now() + Math.max(0, ms);
  h.timerFn = fn;
  h.timer = setTimeout(() => {
    const gg = games[pin];
    if (!gg || gg.halcon !== h || h.paused || gg.state !== 'active') return;
    h.timer = null;
    try { fn(); } catch (e) { console.error('[halcon] timer', e); }
  }, Math.max(0, ms));
}
function hcStop(g) { if (g && g.halcon && g.halcon.timer) { clearTimeout(g.halcon.timer); g.halcon.timer = null; } }
// Per-answer pictures for «¿Qué significa «gege»?» questions: the window shows the picture of each meaning (+ its
// label) when every answer has one in the level's word list; otherwise text. Never for «¿Cómo se dice…?» (the picture
// of the asked word would give the answer away).
const _hcPics = {};
function hcPicFor(g, q) {
  if (!q || (q.kind !== 'zh2es' && q.kind !== 'w')) return null;
  const sid = String(g.setId || '');
  if (!sid.startsWith('pack:')) return null;
  const level = sid.slice(5).split('-')[0];
  if (!_hcPics[level]) {
    const m = {};
    try { Packs.wordLists(level).forEach((w) => w.words.forEach((x) => { if (x.image) m[String(x.es).toLowerCase().trim()] = x.image; })); } catch (_) {}
    _hcPics[level] = m;
  }
  const m = _hcPics[level], out = {};
  q.answers.forEach((a) => { const u = m[String(a).toLowerCase().trim()]; if (u) out[a] = u; });
  return out;
}
// «Empezar» (the countdown starts): the boards are dealt now so every phone's run-in shows its own board.
function hcDeal(pin, g) {
  hcStop(g);
  const now = Date.now();
  const h = Halcon.newGame(1 + Math.floor(Math.random() * 1e9), g.hcRounds || Halcon.R.ROUNDS, now);
  h.timer = null;
  g.halcon = h;
  Object.values(g.players).forEach((p) => { p.hcGame = null; p.currentQ = null; });
  Halcon.deal(h, Object.entries(g.players).filter(([, p]) => !p.disconnected).map(([pid, p]) => [pid, p, hcSkin(p)]));
  h.phaseUntil = now + COUNTDOWN_MS;
  hcSendInit(pin, g);
}
// A kid who wasn't dealt in (joined late, came back after the deal) sits at the smallest board; the board's phones and
// the projector add the new stall. Returns true when the kid got a new seat.
function hcSeatLate(pin, g, pid, p) {
  const h = g.halcon;
  const b = Halcon.lateSeat(h, p, hcSkin(p));
  if (!b) return false;
  p.currentQ = null;
  const pub = hcBoardPublic(g, b, hcSeatMap(g));
  hcBoardPids(g, b.id).forEach((id) => { if (id !== pid) io.to(id).emit('hc:seat', { board: pub }); });
  io.to(g.hostId).emit('hc:seat', { board: pub, top: hcTop(g, 5) });
  return true;
}
// The countdown is over: «¡Mira la respuesta correcta!» → «¡YA!» → round 1.
function hcStart(pin, g) {
  if (!g.halcon) hcDeal(pin, g);
  const h = g.halcon;
  const now = Date.now();
  // the rounds end the game themselves; the room's cap is only a safety net (a +5 rondas or a pause moves it)
  g.duration = Halcon.timeCapS(h.rounds);
  g.endsAt = now + g.duration * 1000;
  h.phase = 'intro';
  h.phaseAt = now;
  h.phaseUntil = now + Halcon.R.INTRO_MS;
  // whoever joined during the countdown sits down now (their snapshot already says «intro», not the run-in)
  Object.entries(g.players).forEach(([pid, p]) => {
    if (!p.disconnected && !Halcon.inGame(h, p) && hcSeatLate(pin, g, pid, p)) io.to(pid).emit('hc:init', hcInitPayload(g, pid));
  });
  io.to(pin).emit('hc:intro', { id: h.id, ms: Halcon.R.INTRO_MS, rounds: h.rounds });
  hcTimer(pin, g, Halcon.R.INTRO_MS, () => hcRound(pin, g));
}
function hcRound(pin, g) {
  const h = g.halcon;
  const q = Halcon.nextQuestion(h, g.questions);
  if (!q) { hcFinal(pin, g); return; }
  const now = Date.now();
  Halcon.startQuestion(h, q, Images.urlForQuestion(q), hcPicFor(g, q), now);
  io.to(pin).emit('hc:q', { id: h.id, round: h.round, rounds: h.rounds, text: h.q.text, image: h.q.image, ms: Halcon.R.QUESTION_MS, last: h.round >= h.rounds });
  hcTimer(pin, g, Halcon.R.QUESTION_MS, () => hcOpen(pin, g));
}
function hcOpen(pin, g) {
  const h = g.halcon;
  if (!Halcon.openAnswers(h, Date.now())) return;
  io.to(pin).emit('hc:open', { id: h.id, round: h.round, opts: h.q.opts, pics: h.q.pics, ms: Halcon.R.ANSWER_MS });
  hcTimer(pin, g, Halcon.R.ANSWER_MS, () => hcResolve(pin, g));
}
function hcAnswer(pin, g, pid, pos) {
  const h = g.halcon;
  const p = g.players[pid];
  if (!h || !p || g.state !== 'active') return;
  const now = Date.now();
  const r = Halcon.answer(h, p, pos, now);
  io.to(pid).emit('hc:mine', { round: h.round, status: r.status, pos: r.look ? r.look.pos : -1 });
  if (r.status !== 'ok') return;
  p.hcLooks = (Number(p.hcLooks) || 0) + 1;   // 🪙 (El Zoco: «played for real» = rounds this kid looked)
  // the board's other phones and the projector only learn that this kid is READY, never the window (the reveal shows it)
  const ev = { round: h.round, id: p.hcSeat, board: p.hcBoard };
  hcBoardPids(g, p.hcBoard).forEach((id) => { if (id !== pid) io.to(id).emit('hc:ready', ev); });
  io.to(g.hostId).emit('hc:ready', ev);
  // everyone looked: the round resolves soon instead of waiting the whole window
  const left = Halcon.closeEarly(h, g.players, now);
  if (left) {
    hcTimer(pin, g, left, () => hcResolve(pin, g));
    io.to(pin).emit('hc:closing', { round: h.round, ms: left });
  }
}
function hcResolve(pin, g) {
  const h = g.halcon;
  if (!h || !h.q || h.phase === 'resolve' || h.phase === 'final' || h.phase === 'done') return;
  if (h.phase === 'question') Halcon.openAnswers(h, Date.now());
  const res = Halcon.resolve(h, g.players, Date.now());
  h.lastRes = res;
  io.to(g.hostId).emit('hc:resolve', Object.assign({ top: hcTop(g, 5) }, res));
  res.boards.forEach((b) => {
    const pub = { round: res.round, rounds: res.rounds, correctPos: res.correctPos, correctText: res.correctText, last: res.last, board: b };
    hcBoardPids(g, b.id).forEach((pid) => io.to(pid).emit('hc:resolve', pub));
  });
  broadcast(pin);                                            // the scores ride on the room's state too
  hcTimer(pin, g, Halcon.R.RESOLVE_MS, () => (h.round >= h.rounds ? hcFinal(pin, g) : hcRound(pin, g)));
}
// «¡FINAL!» on every screen, the final chips, then the studio finale (game-end).
function hcFinal(pin, g) {
  const h = g.halcon;
  if (!h || h.phase === 'final' || h.phase === 'done') return;
  // «Terminar» while the windows are open: the looks already made still count (a kid who saw it gets the points)
  if (h.q && h.phase === 'answer') {
    const res = Halcon.resolve(h, g.players, Date.now());
    h.lastRes = res;
    io.to(g.hostId).emit('hc:resolve', Object.assign({ top: hcTop(g, 5) }, res));
    res.boards.forEach((b) => {
      const pub = { round: res.round, rounds: res.rounds, correctPos: res.correctPos, correctText: res.correctText, last: true, board: b };
      hcBoardPids(g, b.id).forEach((pid) => io.to(pid).emit('hc:resolve', pub));
    });
    broadcast(pin);
  }
  h.phase = 'final';
  h.phaseAt = Date.now();
  h.phaseUntil = h.phaseAt + Halcon.R.FINAL_MS;
  h.q = null;
  io.to(pin).emit('hc:finish', { id: h.id, round: h.round, ms: Halcon.R.FINAL_MS });
  hcTimer(pin, g, Halcon.R.FINAL_MS, () => { if (g.endTimer) { clearTimeout(g.endTimer); g.endTimer = null; } endGame(pin); });
}
// Teacher «⏭ Saltar»: the intro or a bare question gives way to a (fresh) question, an open round resolves now, a
// resolve gives way to the next round.
function hcSkip(pin, g) {
  const h = g.halcon;
  if (!h || h.paused) return;
  if (Date.now() - h.phaseAt < 700) return;      // a double tap must not skip the result the first tap just opened
  if (h.phase === 'intro') hcRound(pin, g);
  else if (h.phase === 'question') { h.round--; h.q = null; hcRound(pin, g); }
  else if (h.phase === 'answer') hcResolve(pin, g);
  else if (h.phase === 'resolve') { if (h.round >= h.rounds) hcFinal(pin, g); else hcRound(pin, g); }
}
function hcPause(pin, g, paused) {
  const h = g.halcon;
  if (!h || !!h.paused === !!paused || h.phase === 'done') return;
  const now = Date.now();
  if (paused) {
    h.paused = true;
    h.pausedAt = now;
    if (h.timer) { clearTimeout(h.timer); h.timer = null; }
    if (g.endTimer) { clearTimeout(g.endTimer); g.endTimer = null; }
  } else {
    const shift = now - h.pausedAt;
    Halcon.shiftTimes(h, shift);
    h.timerAt = (h.timerAt || now) + shift;
    g.endsAt += shift;
    h.paused = false;
    if (h.timerFn) hcTimer(pin, g, h.timerAt - now, h.timerFn);
    if (g.endTimer) clearTimeout(g.endTimer);
    g.endTimer = setTimeout(() => { if (games[pin] && games[pin].state === 'active') endGame(pin); }, Math.max(0, g.endsAt - now));
  }
  io.to(pin).emit('hc:pause', { id: h.id, paused: !!h.paused, phase: h.phase, phaseMs: hcPhaseLeft(h, Date.now()), round: h.round });
}
// The end: each board's ranking and winner (the studio finale on its phones), the class ranking on the projector.
function hcFinish(pin, g) {
  const h = g.halcon;
  if (!h) return;
  hcStop(g);
  h.phase = 'done';
  g.teamScores = { red: 0, gold: 0 };
  const end = hcEndPayloads(g);
  io.to(g.hostId).emit('game-end', end.host);
  Object.entries(g.players).forEach(([pid, p]) => {
    if (p.disconnected) return;
    const one = end.forPlayer(pid);
    if (one) io.to(pid).emit('game-end', one);
  });
  _zocoGameEnd(pin, g, end);   // 🪙 El Zoco: a game played for real and its bonus stars pay (core/zoco.js PAY; after the ceremony is sent)
}
// The game-end payloads (the projector's, and each phone's own: its board + its place). Built again on demand, so a
// projector or a phone that drops around the end still gets its finale after reconnecting (reclaim / resync).
function hcEndPayloads(g) {
  const h = g.halcon;
  const fin = Halcon.finish(h, g.players);
  const lite = (r) => ({ id: r.id, board: r.board, name: r.name, skin: r.skin, score: r.score, rank: r.rank, firsts: r.firsts, right: r.right, best: r.best, avg: r.avg });
  const boards = fin.boards.map((b) => ({ id: b.id, rows: b.rows.map(lite), winners: b.winners.map((w) => w.id), why: b.why }));
  const common = {
    winner: 'tie',   // player.js's generic end screen needs a value; the phone module paints the studio finale
    halcon: {
      boards, top: fin.all.slice(0, 10).map(lite), winners: fin.winners.map((w) => w.id), why: fin.why,
      count: fin.all.length, rounds: fin.rounds, totalRounds: fin.totalRounds,
    },
  };
  return {
    host: Object.assign({ teamScores: { red: 0, gold: 0 }, leaderboard: fin.all.map((r) => ({ name: r.name, score: r.score, team: 'all' })) }, common),
    forPlayer(pid) {
      const p = g.players[pid];
      if (!p || !Halcon.inGame(h, p)) return null;
      const r = fin.all.find((x) => x.id === p.hcSeat);
      if (!r) return null;
      const b = boards.find((x) => x.id === r.board);
      const mineRow = b ? b.rows.find((x) => x.id === r.id) : null;
      return Object.assign({}, common, {
        teamScores: { red: 0, gold: 0 },
        scores: { [pid]: r.score },
        halcon: Object.assign({}, common.halcon, { boards: b ? [b] : [] }),
        me: {
          id: r.id, board: r.board, rank: mineRow ? mineRow.rank : 1, of: b ? b.rows.length : 1, classRank: r.rank, classOf: fin.all.length,
          score: r.score, firsts: r.firsts, right: r.right, best: r.best, avg: r.avg,
          won: !!(b && b.winners.includes(r.id)), classWon: fin.winners.some((w) => w.id === r.id),
        },
      });
    },
  };
}

// === 🍡 MOCHI MASH v2 (gameType 'mochi-mash') — «La Terraza del Mochi», team mash with a Mario Party ceremony ===
// Rules in core/mochi.js (spec docs/specs/mochi-mash-v2.md). Fuego ('red') and Mar ('gold') feed their Dragoncitos:
// a right answer opens a mash window; the phone sends tap COUNTS every 250 ms (player:mm-taps) and the server credits at
// most R.RATE per second. One 250 ms tick per room runs the clock: intro → play (questions dealt) → frenzy (last 30 s)
// → «¡FINAL!» → game-end (each phone its own card, the projector everything). Meter: the projector every tick, phones
// every other tick and only when it changed; the projector also gets who fed (mm:fx inside mm:meter) for the flying
// mochis. Questions come from the room's pack through nextQuestionFor; no full-room 'state' push on answers.
const MM_TICK_MS = 250;
function mmEnsureId(g, p) { if (!p.mmId) p.mmId = (g.mmNextId = (g.mmNextId || 0) + 1); return p.mmId; }
function mmRoster(g) {
  return Object.values(g.players).filter((p) => p.mmId).map((p) => ({ k: p.mmId, name: p.name, skin: hcSkin(p), team: p.team, on: !p.disconnected }));
}
function mmInitPayload(g, pid) {
  const m = g.mm;
  const now = Date.now();
  const clock = m.paused ? m.pausedAt : now;
  const p = pid ? g.players[pid] : null;
  return {
    id: m.id, phase: m.phase, phaseMs: Math.max(0, m.phaseUntil - clock), paused: !!m.paused,
    endsMs: m.endsAt ? Math.max(0, m.endsAt - clock) : null, frenzy: !!m.frenzy,
    frenzyMs: m.frenzyAt ? Math.max(0, m.frenzyAt - clock) : null, duration: m.duration,
    totals: Mochi.display(m), E: m.E, lead: m.lead, behind: m.behind,
    landmarks: m.landmarks.map((l) => ({ id: l.id, name: l.name, at: l.at, bonus: l.bonus, team: l.team })),
    roster: mmRoster(g), captains: g.mmCaptains || null,
    you: p ? { k: p.mmId, team: p.team, mochis: p.mmMochis || 0, streak: p.mmStreak || 0, right: p.mmRight || 0 } : null,
  };
}
function mmStop(g) { if (g && g.mm && g.mm.timer) { clearInterval(g.mm.timer); g.mm.timer = null; } }
// a late joiner early in the game grows the expected total and moves the landmarks nobody has won yet (core rescale)
function mmRescale(pin, g) {
  const m = g.mm;
  if (!m || !Mochi.rescale(m, Mochi.teamSizes(g.players), Date.now())) return;
  io.to(pin).emit('mm:scale', { id: m.id, E: m.E, landmarks: m.landmarks.map((l) => ({ id: l.id, name: l.name, at: l.at, bonus: l.bonus, team: l.team })) });
}
// The countdown is over: the intro («¡Toca rápido!» → «¿Listos?» → «¡YA!»), then mmPlay deals the questions.
function mmStart(pin, g) {
  mmStop(g);
  const now = Date.now();
  const m = Mochi.newGame(1 + Math.floor(Math.random() * 1e9), g.duration, now, Mochi.teamSizes(g.players));
  g.mm = m;
  Object.values(g.players).forEach((p) => { mmEnsureId(g, p); Mochi.resetKid(p, m); p.currentQ = null; p.mashUntil = 0; p.lastQuestionAt = now; });
  g.endsAt = now + Mochi.R.INTRO_MS + m.duration * 1000;
  io.to(g.hostId).emit('mm:init', mmInitPayload(g, null));
  Object.entries(g.players).forEach(([pid, p]) => { if (!p.disconnected) io.to(pid).emit('mm:init', mmInitPayload(g, pid)); });
  m.timer = setInterval(() => mmTick(pin, m), MM_TICK_MS);
}
function mmPlay(pin, g) {
  const m = g.mm;
  if (!m || m.phase !== 'intro') return;
  const now = Date.now();
  Mochi.startPlay(m, now);
  g.endsAt = m.endsAt;
  io.to(pin).emit('mm:play', { id: m.id, endsMs: m.endsAt - now, frenzyMs: m.frenzyAt - now });
  Object.entries(g.players).forEach(([pid, p]) => {
    if (p.disconnected || p.currentQ) return;
    const q = nextQuestionFor(g, pid);
    if (q) io.to(pid).emit('question', q);
  });
  g._lastBcast = 0;
  broadcast(pin);
}
// a kid's window is over: its summary, the next question NEXT_MS later (tick)
function mmClose(g, pid, p, now) {
  const s = Mochi.closeMash(g.mm, p, now);
  if (s) { p.mashUntil = now + Mochi.R.NEXT_MS + 1000; if (!p.disconnected) io.to(pid).emit('mm:mashed', s); }   // (the tick deals the next one)
  return s;
}
function mmTick(pin, m) {
  const g = games[pin];
  if (!g || g.mm !== m || g.state !== 'active') { clearInterval(m.timer); m.timer = null; return; }
  if (m.paused) return;
  const now = Date.now();
  try {
    if (m.phase === 'intro') { if (now >= m.phaseUntil) mmPlay(pin, g); return; }
    if (m.phase === 'play' || m.phase === 'final') {
      m.w = Mochi.weights(Mochi.teamSizes(g.players));
      const cutAt = m.phase === 'final' ? m.endedAt : Infinity;
      Object.entries(g.players).forEach(([pid, p]) => {
        if (!Mochi.inGame(m, p)) return;
        if (p.mmMash && now >= Math.min(p.mmMash.until, cutAt) + Mochi.R.GRACE_MS) mmClose(g, pid, p, now);
        if (m.phase === 'play' && !p.mmMash && !p.currentQ && p.mmNextQAt && now >= p.mmNextQAt && !p.disconnected) {
          p.mmNextQAt = 0;
          const q = nextQuestionFor(g, pid);
          if (q) io.to(pid).emit('question', q);
        }
      });
    }
    if (m.phase === 'play') {
      const ev = Mochi.tick(m, now);
      ev.landmarks.forEach((l) => io.to(pin).emit('mm:landmark', Object.assign({ totals: Mochi.display(m) }, l)));
      if (ev.lead) io.to(pin).emit('mm:lead', Object.assign({ totals: Mochi.display(m) }, ev.lead));
      if (ev.frenzy) io.to(pin).emit('mm:frenzy', { endsMs: Math.max(0, m.endsAt - now) });
    }
    // the meter: the projector every tick (with who fed), phones every other tick, only when something changed
    const fx = Object.entries(m.fx).map(([k, v]) => [Number(k), v[0], v[1]]);
    m.fx = {};
    const d = Mochi.display(m);
    const key = d.r + ':' + d.g;
    if (fx.length || key !== m.hostKey) { m.hostKey = key; io.to(g.hostId).emit('mm:meter', { r: d.r, g: d.g, f: fx, b: m.behind }); }
    m.beat = (m.beat || 0) + 1;
    if (m.beat % 2 === 0 && key !== m.kidKey) { m.kidKey = key; io.to(pin).except(g.hostId).emit('mm:meter', { r: d.r, g: d.g, b: m.behind }); }
    if (m.phase === 'play' && now >= m.endsAt) mmFinal(pin, g);
    else if (m.phase === 'final' && now >= m.phaseUntil) {
      Object.entries(g.players).forEach(([pid, p]) => { if (p.mmMash) mmClose(g, pid, p, now); });
      mmStop(g);
      if (g.endTimer) { clearTimeout(g.endTimer); g.endTimer = null; }
      endGame(pin);
    }
  } catch (e) { console.error('[mochi] tick', e); }
}
// A right / wrong answer (player:answer). Right: the mash window opens LEAD_MS later (the phone shows «¡Correcto!»).
function mmAnswer(pin, g, pid, p, correct, correctText) {
  const now = Date.now();
  if (p.mmMash) mmClose(g, pid, p, now);                   // (defensive) never two windows at once
  const r = Mochi.answer(g.mm, p, correct, now - (p.lastQuestionAt || now), now);
  if (r.right) {
    p.mashUntil = Mochi.closeAt(p.mmMash) + 1500;          // keeps the global watchdog from pushing a question meanwhile
    p.mmNextQAt = 0;
    io.to(pid).emit('answer-result', { correct: true, correctText, mochi: Object.assign({ streak: r.streak }, r.mash) });
  } else {
    // the room's tick deals the next question after the «¡Casi!» wait (pause-shifted, cancelled by «¡FINAL!» / reset);
    // mashUntil keeps the global watchdog away meanwhile
    p.mmNextQAt = now + r.wait;
    p.mashUntil = now + r.wait + 1000;
    io.to(pid).emit('answer-result', { correct: false, correctText, mochi: { wait: r.wait, streak: 0 } });
  }
}
// «¡FINAL!» on every screen; the tick ends the game FINAL_MS later (windows in flight still count for GRACE_MS).
function mmFinal(pin, g) {
  const m = g.mm;
  if (!m || m.phase === 'final' || m.phase === 'done') return;
  const now = Date.now();
  if (m.paused) { const shift = now - m.pausedAt; Mochi.shiftTimes(m, shift); Object.values(g.players).forEach((p) => Mochi.shiftMash(p, shift)); m.paused = false; }
  Mochi.final(m, now);
  Object.values(g.players).forEach((p) => { p.currentQ = null; p.mmNextQAt = 0; });
  io.to(pin).emit('mm:final', { id: m.id, ms: Mochi.R.FINAL_MS, totals: Mochi.display(m) });
  if (!m.timer) m.timer = setInterval(() => mmTick(pin, m), MM_TICK_MS);
}
function mmPause(pin, g, paused) {
  const m = g.mm;
  if (!m || !!m.paused === !!paused || m.phase === 'final' || m.phase === 'done') return;
  const now = Date.now();
  if (paused) { m.paused = true; m.pausedAt = now; }
  else {
    const shift = now - m.pausedAt;
    Mochi.shiftTimes(m, shift);
    Object.values(g.players).forEach((p) => { Mochi.shiftMash(p, shift); if (p.mashUntil) p.mashUntil += shift; });
    if (g.endsAt) g.endsAt += shift;
    m.paused = false;
  }
  const clock = m.paused ? m.pausedAt : now;
  io.to(pin).emit('mm:pause', {
    id: m.id, paused: !!m.paused, phase: m.phase, phaseMs: Math.max(0, m.phaseUntil - clock),
    endsMs: m.endsAt ? Math.max(0, m.endsAt - clock) : null, frenzyMs: m.frenzyAt ? Math.max(0, m.frenzyAt - clock) : null,
  });
  g._lastBcast = 0;
  broadcast(pin);
}
// The end: totals, winner, bonus stars; each phone its own card (built again on demand for a reconnect).
function mmEndPayloads(g) {
  const m = g.mm;
  const rows = Object.values(g.players).filter((p) => Mochi.inGame(m, p)).map((p) => ({
    k: p.mmId, name: p.name, skin: hcSkin(p), team: p.team, mochis: p.mmMochis || 0, right: p.mmRight || 0,
    answered: p.mmAnswered || 0, best: p.mmBest || 0, fast: p.mmFast, behind: p.mmBehind || 0, gold: p.mmGold || 0,
  }));
  const fin = Mochi.finish(m, rows);
  const byK = {};
  fin.rows.forEach((r) => { byK[r.k] = r; });
  const lite = (r) => r && { k: r.k, name: r.name, skin: r.skin, team: r.team, mochis: r.mochis, rank: r.rank, stars: r.stars };
  const stars = fin.stars.map((s) => ({ id: s.id, name: s.name, unit: s.unit, value: s.value, n: s.winners.length, who: s.winners.slice(0, 4).map((k) => lite(byK[k])) }));
  const common = {
    winner: fin.winner,
    teamScores: { red: fin.totals.r, gold: fin.totals.g },
    mochi: {
      totals: fin.totals, winner: fin.winner, stars, landmarks: fin.landmarks, E: m.E, count: fin.rows.length, captains: g.mmCaptains || null,
      top: fin.rows.slice(0, 10).map(lite), mvp: { red: lite(byK[fin.mvp.red]), gold: lite(byK[fin.mvp.gold]) },
      teams: { red: fin.rows.filter((r) => r.team === 'red').slice(0, 12).map(lite), gold: fin.rows.filter((r) => r.team === 'gold').slice(0, 12).map(lite) },
    },
  };
  return {
    host: Object.assign({ leaderboard: fin.rows.map((r) => ({ name: r.name, score: r.mochis, team: r.team })) }, common),
    forPlayer(pid) {
      const p = g.players[pid];
      if (!p || !Mochi.inGame(m, p)) return null;
      const r = byK[p.mmId];
      if (!r) return null;
      return Object.assign({}, common, {
        scores: { [pid]: r.mochis },
        me: {
          k: r.k, team: r.team, mochis: r.mochis, share: r.share, right: r.right, answered: r.answered, best: r.best,
          fast: r.fast, gold: r.gold, stars: r.stars, rank: r.rank, of: fin.rows.length,
          won: fin.winner === r.team, tie: fin.winner === 'tie', mvp: fin.mvp[r.team] === r.k,
        },
      });
    },
  };
}
function mmFinish(pin, g) {
  const m = g.mm;
  if (!m) return;
  mmStop(g);
  m.phase = 'done';
  const end = mmEndPayloads(g);
  g.teamScores = end.host.teamScores;
  Object.values(g.players).forEach((p) => { if (Mochi.inGame(m, p)) p.score = p.mmMochis || 0; });   // the room's own score = mochis
  io.to(g.hostId).emit('game-end', end.host);
  Object.entries(g.players).forEach(([pid, p]) => {
    if (p.disconnected) return;
    const one = end.forPlayer(pid);
    if (one) io.to(pid).emit('game-end', one);
  });
  _zocoGameEnd(pin, g, end);   // 🪙 El Zoco: a game played for real and its bonus stars pay (core/zoco.js PAY; after the ceremony is sent)
}

// === 🐯 PIÑATA TIGRE v2 (gameType 'pinata') — «La Fiesta de las Piñatas», team hits + a server-judged timing meter ===
// Rules in core/pinata.js (spec docs/specs/pinata-tigre-v2.md). Fuego ('red') and Mar ('gold') each break a ladder of
// tiger piñatas under Dubai landmarks: EVERY right answer is a hit for that kid. The answer-result carries the swing (the
// arrow's random start), then pn:ping WITH an ack measures this phone's round trip; the phone's tap (player:pn-hit, the
// ms on its own arrow clock) is accepted only within ± TOL of the server's estimate. One 250 ms tick per room runs the
// clock: intro → play (questions dealt) → frenzy (last 30 s) → «¡FINAL!» → game-end (each phone its own card, the
// projector everything). Meter: the projector every tick (with who hit: f), phones every other tick and only when it
// changed. No full-room 'state' push on answers.
const PN_TICK_MS = 250;
function pnEnsureId(g, p) { if (!p.pnId) p.pnId = (g.pnNextId = (g.pnNextId || 0) + 1); return p.pnId; }
function pnRoster(g) {
  return Object.values(g.players).filter((p) => p.pnId).map((p) => ({ k: p.pnId, name: p.name, skin: hcSkin(p), team: p.team, on: !p.disconnected }));
}
const pnMeter = (m) => Object.assign(Pinata.display(m), { b: m.behind });
function pnInitPayload(g, pid) {
  const m = g.pn;
  const now = Date.now();
  const clock = m.paused ? m.pausedAt : now;
  const p = pid ? g.players[pid] : null;
  return {
    id: m.id, phase: m.phase, phaseMs: Math.max(0, m.phaseUntil - clock), paused: !!m.paused,
    endsMs: m.endsAt ? Math.max(0, m.endsAt - clock) : null, frenzy: !!m.frenzy,
    frenzyMs: m.frenzyAt ? Math.max(0, m.frenzyAt - clock) : null, duration: m.duration,
    meter: pnMeter(m), E: m.E, lead: m.lead, ladder: Pinata.ladder(m),
    roster: pnRoster(g), captains: g.pnCaptains || null,
    you: p ? { k: p.pnId, team: p.team, candy: p.pnCandy || 0, streak: p.pnStreak || 0, right: p.pnRight || 0, hits: p.pnHits || 0 } : null,
  };
}
function pnStop(g) { if (g && g.pn && g.pn.timer) { clearInterval(g.pn.timer); g.pn.timer = null; } }
// a late joiner early in the game makes the ladder longer (core rescale)
function pnRescale(pin, g) {
  const m = g.pn;
  if (!m || !Pinata.rescale(m, Pinata.teamSizes(g.players), Date.now())) return;
  io.to(pin).emit('pn:scale', { id: m.id, E: m.E, ladder: Pinata.ladder(m), meter: pnMeter(m) });
}
// The countdown is over: the intro («¡Para la flecha en el dorado!» → «¿Listos?» → «¡YA!»), then pnPlay deals questions.
function pnStart(pin, g) {
  pnStop(g);
  const now = Date.now();
  const m = Pinata.newGame(1 + Math.floor(Math.random() * 1e9), g.duration, now, Pinata.teamSizes(g.players));
  g.pn = m;
  Object.values(g.players).forEach((p) => { pnEnsureId(g, p); Pinata.resetKid(p, m); p.currentQ = null; p.mashUntil = 0; p.lastQuestionAt = now; });
  g.endsAt = now + Pinata.R.INTRO_MS + m.duration * 1000;
  io.to(g.hostId).emit('pn:init', pnInitPayload(g, null));
  Object.entries(g.players).forEach(([pid, p]) => { if (!p.disconnected) io.to(pid).emit('pn:init', pnInitPayload(g, pid)); });
  m.timer = setInterval(() => pnTick(pin, m), PN_TICK_MS);
}
function pnPlay(pin, g) {
  const m = g.pn;
  if (!m || m.phase !== 'intro') return;
  const now = Date.now();
  Pinata.startPlay(m, now);
  g.endsAt = m.endsAt;
  io.to(pin).emit('pn:play', { id: m.id, endsMs: m.endsAt - now, frenzyMs: m.frenzyAt - now });
  Object.entries(g.players).forEach(([pid, p]) => {
    if (p.disconnected || p.currentQ) return;
    const q = nextQuestionFor(g, pid);
    if (q) io.to(pid).emit('question', q);
  });
  g._lastBcast = 0;
  broadcast(pin);
}
// A tap (or an automatic hit) judged: the kid's own result, every broken tiger to the whole room.
function pnApplyHit(pin, g, pid, p, hid, c, auto, now) {
  const m = g.pn;
  const h = Pinata.hit(m, p, Number.isFinite(hid) ? hid : null, c, auto, now);
  if (!h) { if (!p.disconnected && Number.isFinite(hid)) io.to(pid).emit('pn:nohit', { hid, paused: !!m.paused }); return null; }
  p.mashUntil = p.pnNextQAt + 1000;                        // keeps the global watchdog away until the tick deals the next one
  const meter = h.bursts.length ? pnMeter(m) : null;
  if (!p.disconnected) io.to(pid).emit('pn:hit', Object.assign({ meter }, h));
  h.bursts.forEach((b) => io.to(pin).emit('pn:burst', Object.assign({ who: p.name, k: p.pnId, meter: pnMeter(m) }, b)));
  return h;
}
function pnTick(pin, m) {
  const g = games[pin];
  if (!g || g.pn !== m || g.state !== 'active') { clearInterval(m.timer); m.timer = null; return; }
  if (m.paused) return;
  const now = Date.now();
  try {
    if (m.phase === 'intro') { if (now >= m.phaseUntil) pnPlay(pin, g); return; }
    if (m.phase === 'play' || m.phase === 'final') {
      m.w = Pinata.weights(Pinata.teamSizes(g.players));
      Object.entries(g.players).forEach(([pid, p]) => {
        if (!Pinata.inGame(m, p)) return;
        // a swing nobody tapped (or whose tap never arrived): an automatic hit, the right answer is not lost
        if (p.pnSwing && now >= Pinata.cutAt(m, p.pnSwing)) pnApplyHit(pin, g, pid, p, null, null, true, now);
        if (m.phase === 'play' && !p.pnSwing && !p.currentQ && (!p.pnNextQAt || now >= p.pnNextQAt) && !p.disconnected) {
          p.pnNextQAt = 0;
          const q = nextQuestionFor(g, pid);
          if (q) io.to(pid).emit('question', q);
        }
      });
    }
    if (m.phase === 'play') {
      const ev = Pinata.tick(m, now);
      if (ev.lead) io.to(pin).emit('pn:lead', Object.assign({ meter: pnMeter(m) }, ev.lead));
      if (ev.frenzy) io.to(pin).emit('pn:frenzy', { endsMs: Math.max(0, m.endsAt - now) });
    }
    // the meter: the projector every tick (with who hit), phones every other tick, only when something changed
    const fx = Object.entries(m.fx).map(([k, v]) => [Number(k), v[0], v[1]]);
    m.fx = {};
    const d = pnMeter(m);
    const key = [d.r, d.g, d.tr, d.tg, d.hr, d.hg, d.lr, d.lg, d.b].join(':');
    if (fx.length || key !== m.hostKey) { m.hostKey = key; io.to(g.hostId).emit('pn:meter', Object.assign({ f: fx }, d)); }
    m.beat = (m.beat || 0) + 1;
    if (m.beat % 2 === 0 && key !== m.kidKey) { m.kidKey = key; io.to(pin).except(g.hostId).emit('pn:meter', d); }
    if (m.phase === 'play' && now >= m.endsAt) pnFinal(pin, g);
    else if (m.phase === 'final' && now >= m.phaseUntil) {
      Object.entries(g.players).forEach(([pid, p]) => { if (p.pnSwing && Pinata.inGame(m, p)) pnApplyHit(pin, g, pid, p, null, null, true, now); });
      pnStop(g);
      if (g.endTimer) { clearTimeout(g.endTimer); g.endTimer = null; }
      endGame(pin);
    }
  } catch (e) { console.error('[pinata] tick', e); }
}
// A right / wrong answer (player:answer). Right: the swing; its pin:ping ack measures the phone's round trip.
function pnAnswer(pin, g, socket, p, correct, correctText) {
  const now = Date.now();
  const pid = socket.id;
  const m = g.pn;
  if (p.pnSwing) pnApplyHit(pin, g, pid, p, null, null, true, now);   // (defensive) never two swings at once
  const r = Pinata.answer(m, p, correct, now - (p.lastQuestionAt || now), now);
  if (r.right) {
    p.pnNextQAt = 0;
    p.mashUntil = Pinata.closeAt(p.pnSwing) + Pinata.R.BURST_MS + 1500;   // keeps the global watchdog away meanwhile
    // the ping goes FIRST: the phone acks it before running its (heavier) answer-result handlers, so the round trip
    // measured is the network's, not the page's
    const hid = r.swing.hid;
    try {
      socket.timeout(Pinata.R.RTT_MAX).emit('pn:ping', { hid }, (err) => {
        if (!err && g.pn === m && Pinata.inGame(m, p)) Pinata.ack(m, p, hid, Date.now());
      });
    } catch (e) { /* no ack: the default round trip */ }
    io.to(pid).emit('answer-result', { correct: true, correctText, pinata: Object.assign({ streak: r.streak }, r.swing) });
  } else {
    // the room's tick deals the next question after the «¡Casi!» wait (pause-shifted, cancelled by «¡FINAL!» / reset)
    p.pnNextQAt = now + r.wait;
    p.mashUntil = now + r.wait + 1000;
    io.to(pid).emit('answer-result', { correct: false, correctText, pinata: { wait: r.wait, streak: 0 } });
  }
}
// «¡FINAL!» on every screen; the tick ends the game FINAL_MS later (taps already on their way still count).
function pnFinal(pin, g) {
  const m = g.pn;
  if (!m || m.phase === 'final' || m.phase === 'done') return;
  const now = Date.now();
  if (m.paused) {
    const shift = now - m.pausedAt;
    Pinata.shiftTimes(m, shift);
    Object.values(g.players).forEach((p) => Pinata.shiftSwing(p, shift));
    m.paused = false;
  }
  Pinata.final(m, now);
  Object.values(g.players).forEach((p) => { p.currentQ = null; p.pnNextQAt = 0; });
  io.to(pin).emit('pn:final', { id: m.id, ms: Pinata.R.FINAL_MS, meter: pnMeter(m) });
  if (!m.timer) m.timer = setInterval(() => pnTick(pin, m), PN_TICK_MS);
}
function pnPause(pin, g, paused) {
  const m = g.pn;
  if (!m || !!m.paused === !!paused || m.phase === 'final' || m.phase === 'done') return;
  const now = Date.now();
  if (paused) { m.paused = true; m.pausedAt = now; }
  else {
    const shift = now - m.pausedAt;
    Pinata.shiftTimes(m, shift);
    Object.values(g.players).forEach((p) => { Pinata.shiftSwing(p, shift); if (p.mashUntil) p.mashUntil += shift; });
    if (g.endsAt) g.endsAt += shift;
    m.paused = false;
  }
  const clock = m.paused ? m.pausedAt : now;
  io.to(pin).emit('pn:pause', {
    id: m.id, paused: !!m.paused, phase: m.phase, phaseMs: Math.max(0, m.phaseUntil - clock),
    endsMs: m.endsAt ? Math.max(0, m.endsAt - clock) : null, frenzyMs: m.frenzyAt ? Math.max(0, m.frenzyAt - clock) : null,
  });
  g._lastBcast = 0;
  broadcast(pin);
}
// The end: candies, winner, bonus stars; each phone its own card (built again on demand for a reconnect).
function pnEndPayloads(g) {
  const m = g.pn;
  const rows = Object.values(g.players).filter((p) => Pinata.inGame(m, p)).map((p) => ({
    k: p.pnId, name: p.name, skin: hcSkin(p), team: p.team, candy: p.pnCandy || 0, hits: p.pnHits || 0, crits: p.pnCrits || 0,
    right: p.pnRight || 0, answered: p.pnAnswered || 0, best: p.pnBest || 0, fast: p.pnFast, behind: p.pnBehind || 0, bursts: p.pnBursts || 0,
  }));
  const fin = Pinata.finish(m, rows);
  const byK = {};
  fin.rows.forEach((r) => { byK[r.k] = r; });
  const lite = (r) => r && { k: r.k, name: r.name, skin: r.skin, team: r.team, candy: r.candy, rank: r.rank, stars: r.stars };
  const stars = fin.stars.map((s) => ({ id: s.id, name: s.name, unit: s.unit, value: s.value, n: s.winners.length, who: s.winners.slice(0, 4).map((k) => lite(byK[k])) }));
  const common = {
    winner: fin.winner,
    teamScores: { red: fin.totals.r, gold: fin.totals.g },
    pinata: {
      totals: fin.totals, winner: fin.winner, stars, landmarks: fin.landmarks, tiers: fin.tiers, E: m.E, count: fin.rows.length,
      captains: g.pnCaptains || null,
      top: fin.rows.slice(0, 10).map(lite), mvp: { red: lite(byK[fin.mvp.red]), gold: lite(byK[fin.mvp.gold]) },
      teams: { red: fin.rows.filter((r) => r.team === 'red').slice(0, 12).map(lite), gold: fin.rows.filter((r) => r.team === 'gold').slice(0, 12).map(lite) },
    },
  };
  return {
    host: Object.assign({ leaderboard: fin.rows.map((r) => ({ name: r.name, score: r.candy, team: r.team })) }, common),
    forPlayer(pid) {
      const p = g.players[pid];
      if (!p || !Pinata.inGame(m, p)) return null;
      const r = byK[p.pnId];
      if (!r) return null;
      return Object.assign({}, common, {
        scores: { [pid]: r.candy },
        me: {
          k: r.k, team: r.team, candy: r.candy, share: r.share, hits: r.hits, crits: r.crits, right: r.right, answered: r.answered,
          best: r.best, fast: r.fast, bursts: r.bursts, stars: r.stars, rank: r.rank, of: fin.rows.length,
          won: fin.winner === r.team, tie: fin.winner === 'tie', mvp: fin.mvp[r.team] === r.k,
        },
      });
    },
  };
}
function pnFinish(pin, g) {
  const m = g.pn;
  if (!m) return;
  pnStop(g);
  m.phase = 'done';
  const end = pnEndPayloads(g);
  g.teamScores = end.host.teamScores;
  Object.values(g.players).forEach((p) => { if (Pinata.inGame(m, p)) p.score = p.pnCandy || 0; });   // the room's own score = candies
  io.to(g.hostId).emit('game-end', end.host);
  Object.entries(g.players).forEach(([pid, p]) => {
    if (p.disconnected) return;
    const one = end.forPlayer(pid);
    if (one) io.to(pid).emit('game-end', one);
  });
  _zocoGameEnd(pin, g, end);   // 🪙 El Zoco: a game played for real and its bonus stars pay (core/zoco.js PAY; after the ceremony is sent)
}

// === 🤙 6-7 SWING v2 (gameType 'sixseven') — «La Balanza de Oro», sums whose answer is always 6 or 7 ===
// Rules in core/sixseven.js (spec docs/specs/six-seven-v2.md). No question pack: the core deals each kid its next sum
// (Números / En Chino / Mezcla, the teacher's pick in the lobby), the phone shows two giant buttons «6 · liu» / «7 · qi»
// and the server judges every tap (a right one drops gold on the team's pan, a wrong one costs a short wait). One 125 ms
// tick per room runs the clock: intro → play (deals the next sum after each answer's beat) → frenzy (last 30 s) →
// «¡FINAL!» → game-end (each phone its own card, the projector everything). Meter: the projector every 250 ms (with the
// feed of who scored: f), phones every 750 ms and only when it changed. No full-room 'state' push on answers.
const SS_TICK_MS = 125;
const SS_GRACE_MS = 600;            // an answer already on its way when «¡FINAL!» starts still counts
const SS_LATE_MS = 2500;            // an open sum the phone never timed out (a frozen tab): the server calls time up
const SS_KID_FEED = 8;              // the phones' feed: at most 8 scorers per 750 ms beat (4 per team, «six seven» kids first)
function ssEnsureId(g, p) { if (!p.ssId) p.ssId = (g.ssNextId = (g.ssNextId || 0) + 1); return p.ssId; }
function ssRoster(g) {
  return Object.values(g.players).filter((p) => p.ssId && (!g.ss || Sixseven.inGame(g.ss, p))).map((p) => ({ k: p.ssId, name: p.name, skin: hcSkin(p), team: p.team, on: !p.disconnected }));
}
const ssMeter = (m) => Object.assign(Sixseven.display(m), { b: m.behind });
function ssInitPayload(g, pid) {
  const m = g.ss;
  const now = Date.now();
  const clock = m.paused ? m.pausedAt : now;
  const p = pid ? g.players[pid] : null;
  return {
    id: m.id, phase: m.phase, phaseMs: Math.max(0, m.phaseUntil - clock), paused: !!m.paused, style: m.style,
    endsMs: m.endsAt ? Math.max(0, m.endsAt - clock) : null, frenzy: !!m.frenzy,
    frenzyMs: m.frenzyAt ? Math.max(0, m.frenzyAt - clock) : null, duration: m.duration,
    meter: ssMeter(m), E: m.E, lead: m.lead, race: Sixseven.race(m),
    roster: ssRoster(g), captains: g.ssCaptains || null,
    w: [Sixseven.R.RIGHT_MS, Sixseven.R.WRONG_MS, Sixseven.R.WRONG2_MS],   // the beats, for the phone's instant reaction
    you: p ? { k: p.ssId, team: p.team, coins: p.ssCoins || 0, streak: p.ssStreak || 0, right: p.ssRight || 0, answered: p.ssAnswered || 0, best: p.ssBest || 0 } : null,
  };
}
function ssStop(g) { if (g && g.ss && g.ss.timer) { clearInterval(g.ss.timer); g.ss.timer = null; } }
// a late joiner early in the game makes the landmark race longer (core rescale)
function ssRescale(pin, g) {
  const m = g.ss;
  if (!m || !Sixseven.rescale(m, Sixseven.teamSizes(g.players), Date.now())) return;
  io.to(pin).emit('ss:scale', { id: m.id, E: m.E, race: Sixseven.race(m), meter: ssMeter(m) });
}
// The countdown is over: the intro («¡Toca el resultado!» → «¿Listos?» → «¡YA!»), then ssPlay deals the sums.
function ssStart(pin, g) {
  ssStop(g);
  const now = Date.now();
  const m = Sixseven.newGame(1 + Math.floor(Math.random() * 1e9), g.duration, now, Sixseven.teamSizes(g.players), g.ssStyle);
  g.ss = m;
  Object.values(g.players).forEach((p) => {
    p.currentQ = null; p.ssOut = null; p.mashUntil = 0;
    // a kid who left before the round sits it out (not in the crowds, the ceremony or «of N»); back = joins fresh
    if (p.disconnected) { p.ssGame = null; p.ssQ = null; p.ssNextQAt = 0; return; }
    ssEnsureId(g, p); Sixseven.resetKid(p, m); p.lastQuestionAt = now;
  });
  g.endsAt = now + Sixseven.R.INTRO_MS + m.duration * 1000;
  io.to(g.hostId).emit('ss:init', ssInitPayload(g, null));
  Object.entries(g.players).forEach(([pid, p]) => { if (!p.disconnected) io.to(pid).emit('ss:init', ssInitPayload(g, pid)); });
  m.timer = setInterval(() => ssTick(pin, m), SS_TICK_MS);
}
function ssPlay(pin, g) {
  const m = g.ss;
  if (!m || m.phase !== 'intro') return;
  const now = Date.now();
  Sixseven.startPlay(m, now);
  g.endsAt = m.endsAt;
  io.to(pin).emit('ss:play', { id: m.id, endsMs: m.endsAt - now, frenzyMs: m.frenzyAt - now });
  Object.entries(g.players).forEach(([pid, p]) => { if (!p.disconnected && Sixseven.inGame(m, p) && !p.ssQ) ssSend(g, pid, p, now); });
  g._lastBcast = 0;
  broadcast(pin);
}
// a kid's next sum (the answer stays on the server: p.ssQ); p.ssOut is the same sum again for a resync / rejoin / pause
function ssSend(g, pid, p, now) {
  const q = Sixseven.deal(g.ss, p, now);
  p.ssOut = q;
  p.lastQuestionAt = now;
  io.to(pid).emit('question', q);
}
// the open sum again (a rejoin, a resync, a reload): with the time it really has left on the server's clock; a sum
// that is almost over is dropped without a verdict (no streak lost for a Wi-Fi drop) and the tick deals a fresh one
function ssResend(g, pid, p) {
  const m = g.ss;
  if (!p.ssQ || !p.ssOut) { p.ssQ = null; p.ssOut = null; return; }
  const clock = m.paused ? m.pausedAt : Date.now();
  const left = Sixseven.R.Q_MS - (clock - p.ssQ.at);
  if (left < 3000) { p.ssQ = null; p.ssOut = null; p.ssNextQAt = 0; return; }
  io.to(pid).emit('question', Object.assign({}, p.ssOut, { ss: Object.assign({}, p.ssOut.ss, { ms: Math.round(left) }) }));
}
// the kid's verdict: its own answer-result (never a room broadcast); the next sum comes from the tick after the wait
function ssResult(g, pid, p, r) {
  p.mashUntil = Date.now() + r.wait + 1500;          // keeps the global watchdog away until the tick deals the next one
  if (p.disconnected) return;
  io.to(pid).emit('answer-result', {
    correct: r.right, correctText: `${r.ans} · ${r.word}`,
    sixseven: {
      qid: r.qid, right: r.right, ans: r.ans, word: r.word, choice: r.choice, timeUp: !!r.timeUp, tooFast: !!r.tooFast, calm: !!r.calm,
      wait: r.wait, streak: r.streak, mult: r.mult || 1, coins: r.coins, total: r.total, gold: !!r.gold, goldExtra: r.goldExtra || 0,
      frenzy: !!r.frenzy, zh: !!r.zh, six: r.six || 0, pair: !!r.pair,     // the kid's own «¡SIX SEVEN!» (racha 7 / 67th coin / 6 → 7)
    },
  });
}
function ssTick(pin, m) {
  const g = games[pin];
  if (!g || g.ss !== m || g.state !== 'active') { clearInterval(m.timer); m.timer = null; return; }
  if (m.paused) return;
  const now = Date.now();
  try {
    if (m.phase === 'intro') { if (now >= m.phaseUntil) ssPlay(pin, g); return; }
    if (m.phase === 'play') {
      m.w = Sixseven.weights(Sixseven.teamSizes(g.players));
      Object.entries(g.players).forEach(([pid, p]) => {
        if (!Sixseven.inGame(m, p) || p.disconnected) return;
        // a sum the phone never timed out (frozen tab): time up, so the kid gets a fresh one when it wakes up
        if (p.ssQ && now - p.ssQ.at > Sixseven.R.Q_MS + SS_LATE_MS) { ssResult(g, pid, p, Sixseven.answer(m, p, null, now)); p.ssOut = null; return; }
        if (!p.ssQ && (!p.ssNextQAt || now >= p.ssNextQAt)) ssSend(g, pid, p, now);
      });
      const ev = Sixseven.tick(m, now);
      ev.landmarks.forEach((l) => io.to(pin).emit('ss:landmark', Object.assign({ meter: ssMeter(m) }, l)));
      // a team's «¡SIX SEVEN!» wave (its gold at 67, then every waveStep): rare, one event for the whole room
      ev.waves.forEach((w) => io.to(pin).emit('ss:wave', Object.assign({ meter: ssMeter(m) }, w)));
      if (ev.lead) io.to(pin).emit('ss:lead', Object.assign({ meter: ssMeter(m) }, ev.lead));
      if (ev.frenzy) io.to(pin).emit('ss:frenzy', { endsMs: Math.max(0, m.endsAt - now) });
    }
    // the meter: the projector every 250 ms (with who scored), phones every 750 ms, only when something changed. Both
    // carry the feed of who scored (f: [k, coins, golden, wrong, six, dig] for the projector; [k, coins, golden, six] of the
    // biggest scorers since the last phone beat for the phones), so every phone sees its teammates' coins land in the
    // team's pan between its own sums (his «no dead phones», 2026-10-16). Still one event per beat, never one per answer.
    m.beat = (m.beat || 0) + 1;
    if (m.beat % 2 === 0) {
      const fx = Object.entries(m.fx).map(([k, v]) => [Number(k), v[0], v[1], v[2], v[3] || 0, v[4] || 0]);   // (+ dig: 1 = a right 6, 2 = a right 7)
      m.fx = {};
      m.kfx = m.kfx || {};
      fx.forEach(([k, n, gold, , six]) => {
        if (!(n > 0)) return;
        const e = m.kfx[k] || (m.kfx[k] = [0, 0, 0]);
        e[0] += n; e[1] |= gold ? 1 : 0; e[2] |= six;
      });
      const d = ssMeter(m);
      const k = [d.r, d.g, d.b].join(':');
      if (fx.length || k !== m.hostKey) { m.hostKey = k; io.to(g.hostId).emit('ss:meter', Object.assign({ f: fx }, d)); }
      if (m.beat % 6 === 0) {
        // up to 4 scorers of EACH team («six seven» kids first, then the biggest, ties in a fresh order every beat), so
        // the trailing team's phones see their own teammates' coins too, not only the strongest kids of the room
        const teamOf = {};
        Object.values(g.players).forEach((p) => { if (p.ssId) teamOf[p.ssId] = p.team; });
        const all = Object.entries(m.kfx).map(([kk, v]) => [Number(kk), v[0], v[1], v[2], Math.random()])
          .sort((a, b) => (b[3] ? 1 : 0) - (a[3] ? 1 : 0) || b[1] - a[1] || a[4] - b[4]);
        const per = { red: 0, gold: 0 };
        const kf = [];
        all.forEach((e) => { const t = teamOf[e[0]]; if (per[t] == null || per[t] >= SS_KID_FEED / 2) return; per[t]++; kf.push(e.slice(0, 4)); });
        m.kfx = {};
        if (k !== m.kidKey || kf.length) { m.kidKey = k; io.to(pin).except(g.hostId).emit('ss:meter', kf.length ? Object.assign({ f: kf }, d) : d); }
      }
    }
    if (m.phase === 'play' && now >= m.endsAt) ssFinal(pin, g);
    else if (m.phase === 'final' && now >= m.phaseUntil) {
      ssStop(g);
      if (g.endTimer) { clearTimeout(g.endTimer); g.endTimer = null; }
      endGame(pin);
    }
  } catch (e) { console.error('[sixseven] tick', e); }
}
// player:answer for 6-7 Swing (choiceIdx 0 = «6», 1 = «7», -1 = time up). A tap with no open sum (a mashing finger)
// gets at most one 'answer-stale' a second, so mashing can't make the server talk back 10 times a second. An answer
// for an older sum (a late time-up, a tap re-sent after a Wi-Fi blip) is dropped: it never judges a sum the kid hasn't seen.
function ssAnswer(pin, g, socket, p, choiceIdx, qid) {
  const m = g.ss;
  const now = Date.now();
  if (!Sixseven.inGame(m, p)) { ssEnsureId(g, p); Sixseven.join(m, p); }
  const stale = (reason) => {
    if (now - (p.ssStaleAt || 0) < 1000) return;
    p.ssStaleAt = now;
    io.to(socket.id).emit('answer-stale', { reason });
  };
  if (!p.ssQ) return stale('no-question');
  if (qid != null && qid !== p.ssQ.qid) return;             // an older sum's answer
  if (m.paused) return stale('paused');                     // the sum stays open: the phone gets its buttons back
  if (m.phase !== 'play' && !(m.phase === 'final' && now - m.endedAt <= SS_GRACE_MS)) return stale('not-playing');
  const choice = choiceIdx === 0 ? 6 : choiceIdx === 1 ? 7 : null;
  const r = Sixseven.answer(m, p, choice, now);
  p.ssOut = null;
  if (r) ssResult(g, socket.id, p, r);
}
// «¡FINAL!» on every screen; the tick ends the game FINAL_MS later (an answer already on its way still counts).
function ssFinal(pin, g) {
  const m = g.ss;
  if (!m || m.phase === 'final' || m.phase === 'done') return;
  const now = Date.now();
  if (m.paused) {
    const shift = now - m.pausedAt;
    Sixseven.shiftTimes(m, shift);
    Object.values(g.players).forEach((p) => Sixseven.shiftKid(p, shift));
    m.paused = false;
  }
  Sixseven.final(m, now);
  Object.values(g.players).forEach((p) => { p.currentQ = null; p.ssNextQAt = 0; p.ssOut = null; });
  io.to(pin).emit('ss:final', { id: m.id, ms: Sixseven.R.FINAL_MS, meter: ssMeter(m) });
  if (!m.timer) m.timer = setInterval(() => ssTick(pin, m), SS_TICK_MS);
}
function ssPause(pin, g, paused) {
  const m = g.ss;
  if (!m || !!m.paused === !!paused || m.phase === 'final' || m.phase === 'done') return;
  const now = Date.now();
  if (paused) { m.paused = true; m.pausedAt = now; }
  else {
    const shift = now - m.pausedAt;
    Sixseven.shiftTimes(m, shift);
    Object.values(g.players).forEach((p) => { Sixseven.shiftKid(p, shift); if (p.mashUntil) p.mashUntil += shift; });
    if (g.endsAt) g.endsAt += shift;
    m.paused = false;
  }
  const clock = m.paused ? m.pausedAt : now;
  io.to(pin).emit('ss:pause', {
    id: m.id, paused: !!m.paused, phase: m.phase, phaseMs: Math.max(0, m.phaseUntil - clock),
    endsMs: m.endsAt ? Math.max(0, m.endsAt - clock) : null, frenzyMs: m.frenzyAt ? Math.max(0, m.frenzyAt - clock) : null,
    meter: ssMeter(m),                  // the pause card shows the score of THIS moment (the meter stops while paused)
  });
  g._lastBcast = 0;
  broadcast(pin);
}
// The end: gold, winner, bonus stars; each phone its own card (built again on demand for a reconnect).
function ssEndPayloads(g) {
  const m = g.ss;
  const rows = Object.values(g.players).filter((p) => Sixseven.inGame(m, p)).map((p) => ({
    k: p.ssId, name: p.name, skin: hcSkin(p), team: p.team, coins: p.ssCoins || 0, right: p.ssRight || 0, answered: p.ssAnswered || 0,
    best: p.ssBest || 0, fast: p.ssFast, behind: p.ssBehind || 0, zh: p.ssZh || 0, golds: p.ssGolds || 0,
  }));
  const fin = Sixseven.finish(m, rows);
  const byK = {};
  fin.rows.forEach((r) => { byK[r.k] = r; });
  const lite = (r) => r && { k: r.k, name: r.name, skin: r.skin, team: r.team, coins: r.coins, rank: r.rank, stars: r.stars };
  const stars = fin.stars.map((s) => ({ id: s.id, name: s.name, unit: s.unit, value: s.value, n: s.winners.length, who: s.winners.slice(0, 4).map((k) => lite(byK[k])) }));
  const common = {
    winner: fin.winner,
    teamScores: { red: fin.totals.r, gold: fin.totals.g },
    sixseven: {
      totals: fin.totals, winner: fin.winner, stars, landmarks: fin.landmarks, E: m.E, count: fin.rows.length, style: fin.style,
      captains: g.ssCaptains || null,
      top: fin.rows.slice(0, 10).map(lite), mvp: { red: lite(byK[fin.mvp.red]), gold: lite(byK[fin.mvp.gold]) },
      teams: { red: fin.rows.filter((r) => r.team === 'red').slice(0, 12).map(lite), gold: fin.rows.filter((r) => r.team === 'gold').slice(0, 12).map(lite) },
    },
  };
  return {
    host: Object.assign({ leaderboard: fin.rows.map((r) => ({ name: r.name, score: r.coins, team: r.team })) }, common),
    forPlayer(pid) {
      const p = g.players[pid];
      if (!p || !Sixseven.inGame(m, p)) return null;
      const r = byK[p.ssId];
      if (!r) return null;
      return Object.assign({}, common, {
        scores: { [pid]: r.coins },
        me: {
          k: r.k, team: r.team, coins: r.coins, share: r.share, right: r.right, answered: r.answered, aim: r.aim, best: r.best,
          fast: r.fast, zh: r.zh, golds: r.golds, stars: r.stars, rank: r.rank, of: fin.rows.length,
          won: fin.winner === r.team, tie: fin.winner === 'tie', mvp: fin.mvp[r.team] === r.k,
        },
      });
    },
  };
}
function ssFinish(pin, g) {
  const m = g.ss;
  if (!m) return;
  ssStop(g);
  m.phase = 'done';
  const end = ssEndPayloads(g);
  g.teamScores = end.host.teamScores;
  Object.values(g.players).forEach((p) => { if (Sixseven.inGame(m, p)) { p.score = p.ssCoins || 0; p.ssQ = null; p.ssOut = null; } });
  io.to(g.hostId).emit('game-end', end.host);
  Object.entries(g.players).forEach(([pid, p]) => {
    if (p.disconnected) return;
    const one = end.forPlayer(pid);
    if (one) io.to(pid).emit('game-end', one);
  });
  _zocoGameEnd(pin, g, end);   // 🪙 El Zoco: a game played for real and its bonus stars pay (core/zoco.js PAY; after the ceremony is sent)
}

// === 🚀 LA GRAN FUGA DE DUBÁI (gameType 'escape') — Kahoot «Robot Run» style co-op chase, Dralingo episode ===
// Rules in core/escape.js, routes and rooms in public/js/escape-map.js (spec docs/specs/gran-fuga-v2.md; v1:
// gran-fuga-de-dubai.md). The whole class runs from Robotín through the three zones of the round's route (Dubái, China;
// g.esRoute, picked in the lobby, «Otra ronda» = the next one): right answers are turbos (the run is server-timed, 10 Hz
// physics, 5 Hz broadcast, its pace set from the clock at every run), then the «zona segura» waves in a top-down room
// (phones walk their avatar, the server checks positions).
// Kids are numbered per round (p.esIdx) so the broadcasts stay small and survive rejoins. Every timer is checked against
// the round object, so a stale timer never touches a new round.
const ES_TICK_MS = 100;
const ES_NEXT_Q_MS = { right: 1300, wrong: 1600 };   // the phone's turbo / right-answer screen, then the next question
function esRoster(g) {
  const out = {};
  Object.values(g.players).forEach((p) => {
    if (!p.esIdx || p.esRound !== g.escape.id) return;
    out[p.esIdx] = { name: p.name, skin: p.esSkin, on: !p.disconnected };
  });
  return out;
}
function esPosArray(g, now) {
  const k = g.escape;
  const arr = [];
  Object.entries(g.players).forEach(([pid, p]) => {
    const pos = k.pos[pid];
    if (!pos || p.disconnected || p.esRound !== k.id) return;
    arr.push([p.esIdx, Math.round(pos.x), Math.round(pos.y), pos.f || 0, now < (p.esDizzyUntil || 0) ? 1 : 0]);
  });
  return arr;
}
// what every screen needs to draw the episode right now
function esPublic(g, now) {
  const k = g.escape;
  return {
    route: k.route, zone: EscapeMap.zoneOf(k.route, k.level).id,
    level: k.level, phase: k.phase, L: Escape.R.L, crew: Math.round(k.crew * 10) / 10, robot: Math.round(k.robot * 10) / 10,
    hearts: k.hearts, levelsCleared: k.levelsCleared, replay: k.replay, paused: k.paused, close: k.phase === 'run' && !!k.closeSaid,
    wakeMs: Math.max(0, k.wakeAt - now), dizzyMs: Math.max(0, k.dizzyUntil - now), phaseMs: k.phaseUntil ? Math.max(0, k.phaseUntil - now) : 0,
    wave: k.wave, waves: Escape.R.WAVES, zones: k.zones, waveMs: k.wave && !k.waveResolved ? Math.max(0, k.waveUntil - now) : 0,
    waveTotalMs: k.wave ? k.waveUntil - k.waveAt : 0, roomSeed: k.room ? k.seed : 0,
  };
}
function esMe(g, p, now, extra) {
  const k = g.escape;
  return Object.assign({
    idx: p.esIdx, turbos: p.esTurbos || 0, best: p.esBest || 0, streak: p.esStreak || 0, safe: p.esSafe || 0, waves: p.esWaves || 0,
    dizzyMs: Math.max(0, (p.esDizzyUntil || 0) - now),
    // the chase pass: my own Robotín (gap, his speed, my stun / shield / his lunge), so a phone that reconnects mid-stun
    // gets its lock back with the time left
    ch: k && k.phase === 'run' ? Escape.chaseView(k, p, now, !!p.currentQ) : null, pzaps: p.esPZaps || 0,
  }, extra || {});
}
// The chase pass (2026-10-19): what MY Robotín just did goes to my phone only; the projector hears who got zapped.
function esChaseEvent(pin, g, pid, p, ev) {
  if (ev.type === 'pzap') {
    io.to(pid).emit('es:pzap', { stunMs: ev.stunMs, shieldMs: ev.shieldMs, n: p.esPZaps || 0, g: p.esGap });
    io.to(g.hostId).emit('es:pzap', { idx: p.esIdx, name: p.name });
  } else if (ev.type === 'lunge') io.to(pid).emit('es:lunge', { ms: ev.ms });
  else if (ev.type === 'trip') io.to(pid).emit('es:trip', { g: p.esGap });
  else if (ev.type === 'near') io.to(pid).emit('es:near', { g: p.esGap });
}
function esSendMe(g, pid, extra) {
  const p = g.players[pid];
  if (p && g.escape) io.to(pid).emit('es:me', esMe(g, p, Date.now(), extra));
}
function esInitPayload(g, pid) {
  const k = g.escape;
  const now = Date.now();
  const R = Escape.R;
  const out = Object.assign(esPublic(g, now), {
    seed: k.seed, round: k.id, players: esRoster(g), pos: k.phase === 'zone' ? esPosArray(g, now) : [], cast: g.esCast || null,
    // the chase pass: the phone draws my Robotín with the server's own numbers (one source: core/escape.js)
    chase: { g0: R.CH_G0, gmax: R.CH_GMAX, warn: R.CH_WARN, near: R.CH_NEAR, lx: R.CH_LUNGE_X, lk: R.CH_LUNGE_K },
  });
  const p = pid ? g.players[pid] : null;
  if (p && p.esRound === k.id) out.me = esMe(g, p, now, k.pos[pid] ? { x: k.pos[pid].x, y: k.pos[pid].y } : {});
  if (!pid) out.nz = k.phase === 'run' ? (k.near || []) : [];     // (the projector: the kids he is right behind)
  return out;
}
// Bring a kid into the running round (start, late join, rejoin with a new socket id).
function esAttach(g, pid, p) {
  const k = g.escape;
  const fresh = p.esRound !== k.id;
  Escape.preparePlayer(k, p);
  if (fresh) p.esSkin = EscapeMap.skinFor(p.avatar, p.name);
  const takeover = !!p.esPid && p.esPid !== pid;          // a NEW socket for this kid (a reload, a real reconnect)
  if (takeover && k.pos[p.esPid]) { k.pos[pid] = k.pos[p.esPid]; delete k.pos[p.esPid]; }
  // the chase pass: a phone really back in a run gets 2.5 s of shield (never zapped before its question has even
  // redrawn); never for a resync of the same socket (every 12 s while a kid thinks or the teacher pauses: the
  // classroom playtest saw free shields and a whole class unchased after a long pause), never during a pause
  if (!fresh && takeover && k.phase === 'run' && !k.paused && p.esRunN === k.runN) p.esShieldUntil = Math.max(p.esShieldUntil || 0, Date.now() + 2500);
  p.esPid = pid;
  if (k.phase === 'zone' && k.room && !k.pos[pid]) { const s = Escape.spawnPos(k, p.esIdx); k.pos[pid] = { x: s.x, y: s.y, f: 2, at: Date.now() }; }
}
// a fresh question for every kid in the room (start of a run)
function esDeal(pin, g) {
  Object.entries(g.players).forEach(([pid, p]) => {
    if (p.disconnected) return;
    p.currentQ = null;
    const q = nextQuestionFor(g, pid);
    if (q) io.to(pid).emit('question', q);
  });
}
function esStart(pin, g) {
  esStop(g);
  const now = Date.now();
  g.escape = Escape.newRound(1 + Math.floor(Math.random() * 1e6), now, g.duration, g.esRoute | 0);
  g.escape.tick = null;
  if (g.endsAt) Escape.retimeRun(g.escape, (g.endsAt - now) / 1000);      // v2: the run's pace from the clock
  Object.entries(g.players).forEach(([pid, p]) => {
    p.esRound = null; p.esPid = null; p.score = 0;
    // each kid starts the pack at a random spot, so «Otra ronda» never replays the same question order
    p.queueIdx = Math.floor(Math.random() * Math.max(1, (g.questions || []).length));
    if (p.disconnected) return;          // a phone that already left joins as a late joiner if it comes back
    esAttach(g, pid, p);
  });
  g.teamScores = { red: 0, gold: 0 };
  Object.keys(g.players).forEach((pid) => io.to(pid).emit('es:init', esInitPayload(g, pid)));
  io.to(g.hostId).emit('es:init', esInitPayload(g, null));
  g.escape.lastStep = now;
  const tick = setInterval(() => esTick(pin, tick), ES_TICK_MS);
  g.escape.tick = tick;
}
function esStop(g) {
  if (g && g.escape && g.escape.tick) { clearInterval(g.escape.tick); g.escape.tick = null; }
}
// a new step of the episode for every screen (zone, wave, cleared, caught, escape, run)
function esPhase(pin, g, extra) {
  const now = Date.now();
  io.to(pin).emit('es:phase', Object.assign(esPublic(g, now), { pos: g.escape.phase === 'zone' ? esPosArray(g, now) : [] }, extra || {}));
}
function esTick(pin, id) {
  try { esTickInner(pin, id); } catch (e) { console.error('[esTick]', e); }
}
function esTickInner(pin, id) {
  const g = games[pin];
  // A room that vanished (or a newer round) stops its own old interval.
  if (!g || !g.escape || (id && g.escape.tick !== id)) { if (id) clearInterval(id); return; }
  if (g.state !== 'active') return esStop(g);
  const k = g.escape;
  const now = Date.now();
  const dt = Math.min(0.25, Math.max(0, (now - (k.lastStep || now)) / 1000));
  k.lastStep = now;
  k.n = (k.n || 0) + 1;
  if (k.paused || g.finalizing) return;     // paused, or «¡FINAL!»: the chase stands still
  // the last minute: once per round (phones + projector stage it)
  if (!k.milestones.lastmin && g.endsAt && g.endsAt - now <= 60000 && g.endsAt - now > 1000 && g.duration >= 150 && k.phase !== 'escape') {
    k.milestones.lastmin = true;
    io.to(pin).emit('es:moment', { type: 'lastmin' });
  }
  if (k.phase === 'run') {
    const evs = Escape.stepRun(k, g.players, dt, now);
    evs.forEach((ev) => {
      if (ev.type === 'zap') { io.to(pin).emit('es:zap', { crew: k.crew, robot: k.robot, dizzyMs: Escape.R.DIZZY_MS, zaps: k.zaps }); }
      else if (ev.type === 'close') io.to(pin).emit('es:moment', { type: 'close' });
      else if (ev.type === 'sprint') io.to(g.hostId).emit('es:moment', { type: 'sprint' });
      else if (ev.type === 'done') {
        // the crew reached the zone: open questions are dropped, everyone appears in the zona segura room
        Escape.startZone(k, now);
        Object.entries(g.players).forEach(([pid, p]) => {
          p.currentQ = null;
          if (p.disconnected || p.esRound !== k.id) return;
          const s = Escape.spawnPos(k, p.esIdx);
          k.pos[pid] = { x: s.x, y: s.y, f: 2, at: now };
        });
        esPhase(pin, g);
      }
    });
    // the chase pass: every kid's own Robotín (closing while that kid's question is open); each phone gets its own
    // numbers ~3 times a second (and at once on an event), the projector the kids he is right behind
    if (k.phase === 'run') {
      const sync = k.n % 3 === 0;
      const near = [];
      Object.entries(g.players).forEach(([pid, p]) => {
        if (p.disconnected || p.esRound !== k.id) return;
        // a question open for more than 25 s of its own time is a phone that is not there (locked, in a pocket: a live
        // phone's own 20 s clock always answers): he stops chasing it, it never shows in danger on the projector
        const open = !!p.currentQ && (p.esOpenMs || 0) < 25000;
        const ev = Escape.stepChase(k, p, open, dt, now);
        if (ev) esChaseEvent(pin, g, pid, p, ev);
        if (sync || ev) {
          // only when something changed (his distance, his speed, my stun / shield / his lunge starting or ending);
          // volatile: a phone on weak Wi-Fi never gets a backlog of old distances
          const view = Escape.chaseView(k, p, now, open);
          const sig = view.g + '|' + view.v + '|' + (view.st > 0) + '|' + (view.sh > 0) + '|' + (view.lu > 0);
          if (ev || sig !== p.esGSig) { p.esGSig = sig; io.to(pid).volatile.emit('es:g', view); }
        }
        if (open && p.esRunN === k.runN && p.esGap < Escape.R.CH_WARN && now >= (p.esShieldUntil || 0)) near.push(p.esIdx);
      });
      // the kids he is right behind: the projector only, and only when the list changes
      const nsig = near.join(',');
      if (nsig !== k.nearSig) { k.nearSig = nsig; k.near = near; io.to(g.hostId).emit('es:nz', near); }
    }
    if (k.phase === 'run' && k.n % 2 === 0) {
      io.to(pin).emit('es:tick', { c: Math.round(k.crew * 10) / 10, r: Math.round(k.robot * 10) / 10, d: now < k.dizzyUntil ? 1 : 0, cl: k.closeSaid ? 1 : 0 });
    }
  } else if (k.phase === 'zone') {
    if (!k.wave && now >= k.phaseUntil) {
      Escape.startWave(k, g.players, now);
      io.to(pin).emit('es:wave', { wave: k.wave, waves: Escape.R.WAVES, zones: k.zones, ms: k.waveUntil - now });
    } else if (k.wave && !k.waveResolved && now >= k.waveUntil) {
      const r = Escape.resolveWave(k, g.players, now);
      const idxOf = (pid) => (g.players[pid] || {}).esIdx || 0;
      io.to(pin).emit('es:wave-end', { wave: k.wave, safe: r.safe.map(idxOf), out: r.out.map(idxOf), lost: r.lost, hearts: r.hearts, n: r.n, dizzyMs: Escape.R.ZONE_DIZZY_MS });
      r.out.forEach((pid) => esSendMe(g, pid, { zapped: true }));
      r.safe.forEach((pid) => esSendMe(g, pid, { safeNow: true }));
      k.phaseUntil = now + Escape.R.WAVE_REST_MS;
    } else if (k.wave && k.waveResolved && now >= k.phaseUntil) {
      if (k.wave >= Escape.R.WAVES || (k.hearts <= 0 && !k.replayed[k.level])) {
        const next = Escape.afterZone(k);
        const level = k.level;
        if (next === 'caught') { Escape.caught(k); k.phase = 'caught'; k.phaseAt = now; k.phaseUntil = now + Escape.R.CAUGHT_MS; esPhase(pin, g, { caughtLevel: level }); }
        else if (next === 'cleared') { const h0 = k.hearts; Escape.clearLevel(k); k.phase = 'cleared'; k.phaseAt = now; k.phaseUntil = now + Escape.R.CLEARED_MS; esPhase(pin, g, { clearedLevel: level, heartBack: k.hearts > h0 }); }
        else { k.levelsCleared = Escape.R.LEVELS; k.escaped = true; k.phase = 'escape'; k.phaseAt = now; k.phaseUntil = now + Escape.R.ESCAPE_MS; esPhase(pin, g, { clearedLevel: level }); }
        k.zones = [];
      } else {
        Escape.startWave(k, g.players, now);
        io.to(pin).emit('es:wave', { wave: k.wave, waves: Escape.R.WAVES, zones: k.zones, ms: k.waveUntil - now });
      }
    }
    if (k.phase === 'zone' && k.n % 2 === 0) {
      const live = k.wave && !k.waveResolved;
      const msg = { pos: esPosArray(g, now), wl: live ? Math.max(0, k.waveUntil - now) : 0 };
      // who is in which zone, only while the wave is live (the screens keep the last count after the zap)
      if (live) msg.occ = Escape.occupancy(k, g.players, now).map((o) => [o.id, o.kids.length, o.safe.map((x) => x.idx)]);
      io.to(pin).emit('es:tick', msg);
    }
  } else if (k.phase === 'cleared' || k.phase === 'caught') {
    if (now >= k.phaseUntil) {
      Escape.startRun(k, now, k.phase === 'caught');
      if (g.endsAt) Escape.retimeRun(k, (g.endsAt - now) / 1000);      // v2: what's left on the clock sets this run's pace
      esPhase(pin, g);
      esDeal(pin, g);
    }
  } else if (k.phase === 'escape') {
    if (now >= k.phaseUntil && !k.ending) {
      k.ending = true;
      finBegin(pin, g, 'escaped');           // the jet took off: «¡FINAL!», then the ceremony
    }
  }
  // who is in the game (joins, leaves): a fresh roster for every screen
  if (k.n % 5 === 0) {
    const sig = Object.values(g.players).filter((p) => p.esRound === k.id).map((p) => p.esIdx + (p.disconnected ? 'x' : '')).join(',');
    if (sig !== k.rosterSig) { k.rosterSig = sig; io.to(pin).emit('es:roster', { players: esRoster(g) }); }
  }
}
function esAnswer(pin, g, pid, p, correct, correctText) {
  const k = g.escape;
  if (!k) return;
  const n = Escape.kidsOn(g.players, k).length;
  const r = Escape.answer(k, p, correct, n, !!g.finFrenzy);   // the last 30 s: every turbo a súper turbo
  // the chase pass: a right answer = I dash away from MY Robotín (a súper turbo farther), a wrong one = he gains
  const ch = Escape.chaseAnswer(k, p, correct, !!r.super, Date.now());
  p.lastQuestionAt = Date.now();     // the global watchdog must not push a question over the turbo screen
  io.to(pid).emit('answer-result', {
    correct, correctText,
    escape: { turbo: !!r.turbo, super: !!r.super, gain: r.gain || 0, streak: p.esStreak || 0, turbos: p.esTurbos || 0, crew: Math.round(k.crew * 10) / 10, robot: Math.round(k.robot * 10) / 10,
      gap: ch ? ch.gap : null, from: ch ? ch.from : null },
  });
  if (r.turbo) io.to(g.hostId).emit('es:turbo', { idx: p.esIdx, name: p.name, super: r.super, gain: r.gain, streak: p.esStreak });
  // the next question only while the crew is still running (a zone or a big moment may have started meanwhile); never
  // inside a stun (a new question would wipe the lock on the phone)
  const wait = Math.max(correct ? ES_NEXT_Q_MS.right : ES_NEXT_Q_MS.wrong, (p.esStunUntil || 0) - Date.now() + 50);
  setTimeout(() => {
    if (games[pin] !== g || g.state !== 'active' || g.escape !== k || k.phase !== 'run' || k.paused || !g.players[pid] || g.players[pid].currentQ) return;
    const q = nextQuestionFor(g, pid);
    if (q) io.to(pid).emit('question', q);
  }, wait);
}
// Teacher pause: nothing moves, the clock stops; on resume every timer moves forward.
function esPause(pin, g, paused) {
  const k = g.escape;
  if (!k || !!k.paused === !!paused) return;
  const now = Date.now();
  if (paused) {
    k.paused = true;
    k.pausedAt = now;
    if (g.endTimer) { clearTimeout(g.endTimer); g.endTimer = null; }
  } else {
    const shift = now - k.pausedAt;
    Escape.shiftTimers(k, g.players, shift);
    g.endsAt += shift;
    k.paused = false;
    if (g.endTimer) clearTimeout(g.endTimer);
    g.endTimer = setTimeout(() => { if (games[pin] && games[pin].state === 'active') endGame(pin); }, Math.max(0, g.endsAt - now));
    // kids who answered during the pause get their next question now
    if (k.phase === 'run') Object.entries(g.players).forEach(([pid, p]) => {
      if (p.disconnected || p.currentQ || p.esRound !== k.id) return;
      const q = nextQuestionFor(g, pid);
      if (q) io.to(pid).emit('question', q);
    });
  }
  io.to(pin).emit('es:pause', Object.assign(esPublic(g, now), { paused: k.paused }));
  finFrenzyAgain(pin, g, !!k.paused);
  g._lastBcast = 0;
  broadcast(pin);
}
// End: the crew's rank, the awards and stars, every kid's own numbers, for the Mario Party ceremony on every screen
// (js/party.js; built once by finFinish and kept for a screen that reconnects). The `escape` object is the old end
// screen's data, kept as it was. Co-op: the crew is shown in join order, never ranked in front of the class.
function esEndPayloads(g) {
  const k = g.escape;
  if (!k) return null;
  esStop(g);
  const fin = Escape.finish(k, g.players);
  const old = (r) => r && ({ idx: (g.players[r.id] || {}).esIdx, name: r.name, skin: (g.players[r.id] || {}).esSkin, score: r.score, turbos: r.turbos, best: r.best, safe: r.safe, waves: r.waves, reach: r.reach });
  Object.entries(g.players).forEach(([, p]) => { if (p.esRound === k.id) p.score = (fin.rows.find((r) => g.players[r.id] === p) || {}).score || 0; });
  const awards = { turbos: old(fin.awards.turbos), fastest: old(fin.awards.fastest), streak: old(fin.awards.streak) };
  const byK = {};
  fin.rows.forEach((r) => { byK[r.k] = r; });
  const lite = (r) => Party.lite(r, r && r.score);
  const crew = fin.rows.filter((r) => !r.gone).slice().sort((x, y) => (x.k || 0) - (y.k || 0));
  const finCommon = {
    game: 'escape', winner: fin.escaped ? 'crew' : 'robot', why: g.finalizing ? g.finalizing.why : 'time', count: crew.length,
    totals: { crew: fin.turbos }, captains: g.esCast || null,
    stars: Party.publicStars(fin.stars, byK, (r) => r.score),
    top: [], mvp: {},
    extra: { rank: fin.rank, route: fin.route, levelsCleared: fin.levelsCleared, hearts: fin.hearts, escaped: fin.escaped, level: k.level, zaps: fin.zaps },
  };
  const escOld = { rank: fin.rank, route: fin.route, levelsCleared: fin.levelsCleared, hearts: fin.hearts, escaped: fin.escaped, level: k.level, zaps: fin.zaps, turbos: fin.turbos, cast: g.esCast || null };
  // the phones: a dozen crewmates for their ceremony; the projector: the whole crew (in join order, never ranked)
  const common = { winner: fin.escaped ? 'crew' : 'tie', escape: escOld, fin: Object.assign({ crews: { crew: crew.slice(0, 12).map(lite) } }, finCommon) };
  const hostOnly = {
    escape: Object.assign({}, escOld, { awards, top: fin.rows.slice(0, 8).map(old), crew: crew.map(old).slice(0, 40) }),
    leaderboard: fin.rows.map((r) => ({ name: r.name, score: r.score, team: 'crew', avatar: r.avatar })),
    fin: Object.assign({ crews: { crew: crew.slice(0, 40).map(lite) } }, finCommon),
  };
  const teamScores = { red: fin.levelsCleared, gold: 0 };
  const cards = {};
  fin.rows.forEach((r) => {
    const p = g.players[r.id] || {};
    cards[r.k] = {
      score: r.score,
      me: {
        k: r.k, team: 'crew', skin: r.skin, won: fin.escaped, tie: false, stars: r.stars, mvp: false,
        score: r.score || 0, turbos: r.turbos || 0, supers: r.supers || 0, best: r.best || 0, safe: r.safe || 0, waves: r.waves || 0, reach: r.reach, escapes: r.escapes || 0,
        right: r.right || 0, answered: (r.right || 0) + (p.esWrong || 0),
        awards: Object.keys(fin.awards).filter((a) => fin.awards[a] && fin.awards[a].id === r.id),
      },
    };
  });
  return {
    teamScores, host: Object.assign({ teamScores }, common, hostOnly),
    keyOf: (p) => (p && p.esRound === k.id ? p.esIdx : null),
    guest: () => Object.assign({ teamScores }, common, { me: { k: 0, guest: true } }),
    forPlayer(pid) {
      const p = g.players[pid];
      const c = p && cards[this.keyOf(p)];
      if (!c) return null;
      const other = p.team === 'red' ? 'gold' : 'red';
      return Object.assign({}, common, { teamScores: { [p.team]: fin.escaped ? 1 : 0, [other]: 0 }, scores: { [pid]: c.score }, me: c.me });
    },
  };
}

// === 🏁 THE MARIO PARTY ENDING of Reinos de Colores, Dragones Pintores, Batalla de Nieve, La Gran Fuga (2026-10-16) ===
// His rule «Feelings at the end of class» (CLAUDE.md): when a round ends (the clock, «Terminar», the ice team froze
// everyone, the jet took off) every screen shows «¡FINAL!» for Party.FINAL_MS (an action already on its way for
// GRACE_MS still counts), then game-end carries `fin` (the reveal, the winners, the bonus stars, the podium) and each
// phone its own card (`me`). The end payloads are built ONCE (g.finEnd) and sent again to a projector or a phone that
// reconnects. «⏭ Saltar» on the projector (host:fin-skip) jumps every phone to its card (fin:skip).
// The last 30 s of these games (g.finFrenzy, the fin:frenzy event, one 0.5 s check for every room): Reinos «¡Banderas
// dobles!», Pintores «¡Fuego doble!», Nieve «¡Copos dobles!», La Gran Fuga «¡Súper turbos!» (rules in each core file).
// (Las Trampillas joined 2026-10-17: its own clock ends the match after the Final Round's tally; no last-30-s frenzy, the
// Final Round ×2 is its climax)
const FIN_GAMES = ['kingdoms', 'paint', 'snow', 'escape', 'trapdoor'];
const finGame = (g) => !!g && FIN_GAMES.includes(g.gameType);
function finKey(g, p) { if (!p.finK) p.finK = (g.finNextId = (g.finNextId || 0) + 1); return p.finK; }
function finBegin(pin, g, why) {
  if (!finGame(g) || g.state !== 'active' || g.finalizing) return false;
  const now = Date.now();
  if (g.endTimer) { clearTimeout(g.endTimer); g.endTimer = null; }
  const token = { at: now, until: now + Party.FINAL_MS, why: why || 'time' };
  g.finalizing = token;
  g.finFrenzy = false;
  // the end is armed first, so nothing below can leave a room stuck in «¡FINAL!» (code review 2026-10-16)
  setTimeout(() => {
    if (games[pin] !== g || g.finalizing !== token || g.state !== 'active') return;
    try { endGame(pin, true); } catch (e) { finRescue(pin, g, e); }
  }, Party.FINAL_MS);
  try {
    // a paused round ends now: its clocks move on by the paused time first (a pause is never «survived» seconds), then
    // the pause card goes (the «¡FINAL!» card covers every screen)
    if (g.snow && g.snow.paused) {
      Snow.shiftTimers(g.snow, g.players, now - g.snow.pausedAt);
      g.snow.paused = false;
      io.to(pin).emit('sn:pause', { paused: false, spellInMs: 0 });
    }
    if (g.snow) g.snow.balls = [];
    if (g.kingdoms && g.kingdoms.paused) { g.kingdoms.paused = false; io.to(pin).emit('kd:pause', { paused: false, endsMs: 0 }); }
    if (g.paint && g.paint.paused) { g.paint.paused = false; io.to(pin).emit('pc:pause', { paused: false, endsMs: 0 }); }
    if (g.td) {
      if (g.td.paused) { Trap.resume(g.td, now); io.to(pin).emit('td:pause', { id: g.td.id, paused: false, ago: tdAgo(g.td, now), phase: 'final', r: g.td.r, endsMs: 0 }); }
      if (g.td.phase !== 'done') g.td.phase = 'final';            // the platform stands still from here
    }
    if (g.escape && g.escape.paused) {
      Escape.shiftTimers(g.escape, g.players, now - g.escape.pausedAt);
      g.escape.paused = false;
      io.to(pin).emit('es:pause', Object.assign(esPublic(g, now), { paused: false }));
    }
    Object.values(g.players).forEach((p) => { p.currentQ = null; });
  } catch (e) { console.error('[finBegin]', g.gameType, e); }
  io.to(pin).emit('fin:final', { ms: Party.FINAL_MS, why: token.why, game: g.gameType });
  g._lastBcast = 0;
  broadcast(pin);
  return true;
}
// endGame threw during «¡FINAL!» (it never has; belt and braces): the room still ends, every screen gets a plain end
function finRescue(pin, g, e) {
  console.error('[finRescue]', g.gameType, e);
  g.finalizing = null;
  g.finFrenzy = false;
  g.state = 'ended';
  try { io.to(pin).emit('game-end', { teamScores: g.teamScores || { red: 0, gold: 0 }, winner: 'tie', leaderboard: [] }); } catch (_) {}
  broadcast(pin);
}
// what a screen that (re)connects during «¡FINAL!» needs
// the ending sent again (a reload, a reconnect, a reclaimed projector): `ago` = how long ago the round ended, so the
// screen joins the show where the others are, or goes straight to its card / the podium
function finAgain(g, payload) { return payload && Object.assign({}, payload, { ago: Math.max(0, Date.now() - ((g.finEnd && g.finEnd.at) || Date.now())) }); }
function finFinalLeft(g) { return g && g.finalizing ? Math.max(0, g.finalizing.until - Date.now()) : 0; }
// the teacher paused one of the four games (its clock stands still)
function finPaused(g) { return !!((g.snow && g.snow.paused) || (g.escape && g.escape.paused) || (g.kingdoms && g.kingdoms.paused) || (g.paint && g.paint.paused) || (g.td && g.td.paused)); }
// the moment a paused game stopped (its g.endsAt moves on «Seguir»), null while it runs: the clock of a «−30 s»
function finPausedAt(g) { const s = [g.snow, g.escape, g.kingdoms, g.paint, g.halcon].find((x) => x && x.paused); return s ? s.pausedAt : null; }
// the last 30 s and «⏸ Pausa» / «+30 s»: the ×2 chips stop with the clock (`hold`) and come back with the new seconds
// (`again`: no second banner)
function finFrenzyAgain(pin, g, paused) {
  if (!finGame(g) || !g.finFrenzy || g.state !== 'active' || g.finalizing) return;
  if (paused) io.to(pin).emit('fin:frenzy', { game: g.gameType, off: true, hold: true });
  else io.to(pin).emit('fin:frenzy', { game: g.gameType, endsMs: Math.max(0, g.endsAt - Date.now()), again: true });
}
// A projector that reclaims its room (host:reclaim, after that handler's own checks and the game's init): the last 30 s,
// «¡FINAL!» still on, or the whole ceremony again after the end. Call: `finReclaim(socket.id, g);`
function finReclaim(sid, g) {
  if (!finGame(g)) return;
  if (g.state === 'active' && g.finFrenzy && g.endsAt && !finPaused(g)) io.to(sid).emit('fin:frenzy', { game: g.gameType, endsMs: Math.max(0, g.endsAt - Date.now()) });
  if (g.state === 'active' && g.finalizing) io.to(sid).emit('fin:final', { ms: finFinalLeft(g), why: g.finalizing.why, game: g.gameType });
  if (g.state === 'ended' && g.finEnd) io.to(sid).emit('game-end', finAgain(g, g.finEnd.host));
}
// Reinos de Colores: kingdom points, each kid's flags (tiles, the biggest capture, landmarks), the bonus stars
function kdEndPayloads(g) {
  const k = g.kingdoms;
  const rows = Object.values(g.players).filter((p) => p.team && (!p.disconnected || (p.score || 0) > 0 || (p.kdTiles || 0) > 0)).map((p) => ({
    k: finKey(g, p), name: p.name, skin: hcSkin(p), team: p.team, points: p.score || 0, tiles: p.kdTiles || 0, big: p.kdBig || 0,
    best: p.kdBest || 0, lms: p.kdLms || 0, right: p.kdCorrect || 0, answered: p.kdAnswered || 0,
  }));
  const fin = Kingdoms.finish(rows, g.teamScores);
  const byK = {};
  fin.rows.forEach((r) => { byK[r.k] = r; });
  const lite = (r) => Party.lite(r, r && r.points);
  const lms = { red: [], gold: [] };
  if (k) Object.entries(k.board.landmarks || {}).forEach(([id, key]) => { const t = k.own[id]; if (lms[t]) lms[t].push(key); });
  const mvpR = byK[fin.mvp.red], mvpG = byK[fin.mvp.gold];
  const common = {
    winner: fin.winner,
    mvpRed: mvpR ? { name: mvpR.name, score: mvpR.points } : null,
    mvpGold: mvpG ? { name: mvpG.name, score: mvpG.points } : null,
    leaderboard: fin.rows.map((r) => ({ name: r.name, score: r.points, team: r.team, avatar: '' })),
    fin: {
      game: 'kingdoms', winner: fin.winner, why: g.finalizing ? g.finalizing.why : 'time', count: fin.rows.length,
      totals: fin.totals, captains: (k && k.captains) || g.kdCaptains || null,
      crews: { red: fin.rows.filter((r) => r.team === 'red').slice(0, 12).map(lite), gold: fin.rows.filter((r) => r.team === 'gold').slice(0, 12).map(lite) },
      stars: Party.publicStars(fin.stars, byK, (r) => r.points),
      top: fin.rows.slice(0, 10).map(lite), mvp: { red: lite(mvpR), gold: lite(mvpG) },
      extra: { lms },
    },
  };
  const cards = {};
  fin.rows.forEach((r) => {
    cards[r.k] = {
      score: r.points,
      me: {
        k: r.k, team: r.team, skin: r.skin, won: fin.winner === r.team, tie: fin.winner === 'tie', mvp: fin.mvp[r.team] === r.k,
        stars: r.stars, rank: r.rank, of: fin.rows.length,
        points: r.points, tiles: r.tiles, share: r.share, big: r.big, best: r.best, lms: r.lms, right: r.right, answered: r.answered,
      },
    };
  });
  return finPack(g, common, fin.totals, cards);
}
// Dragones Pintores: clouds of each kingdom, each kid's painting (strokes, clouds still theirs, llamaradas), the stars
function pcEndPayloads(g) {
  const rows = Object.values(g.players).filter((p) => p.team && (!p.disconnected || (p.score || 0) > 0 || (p.pcD && p.pcD.strokes > 0))).map((p) => ({
    k: finKey(g, p), name: p.name, skin: hcSkin(p), team: p.team, owned: p.score || 0, painted: (p.pcD && p.pcD.strokes) || 0, best: p.pcBest || 0,
    blazes: p.pcBlazes || 0, right: p.pcRight || 0, answered: p.pcAnswered || 0, lms: (p.pcD && p.pcD.lms) || 0,
  }));
  const fin = Paint.finish(rows, g.teamScores);
  const byK = {};
  fin.rows.forEach((r) => { byK[r.k] = r; });
  const lite = (r) => Party.lite(r, r && r.owned);
  const common = {
    winner: fin.winner,
    leaderboard: fin.rows.map((r) => ({ name: r.name, score: r.owned, team: r.team, avatar: '' })),
    fin: {
      game: 'paint', winner: fin.winner, why: g.finalizing ? g.finalizing.why : 'time', count: fin.rows.length,
      totals: fin.totals, captains: g.pcCaptains || null, world: g.paint ? g.paint.sky.world : (g.pcWorld | 0),
      crews: { red: fin.rows.filter((r) => r.team === 'red').slice(0, 12).map(lite), gold: fin.rows.filter((r) => r.team === 'gold').slice(0, 12).map(lite) },
      stars: Party.publicStars(fin.stars, byK, (r) => r.owned),
      top: fin.rows.slice(0, 10).map(lite), mvp: { red: lite(byK[fin.mvp.red]), gold: lite(byK[fin.mvp.gold]) },
    },
  };
  const cards = {};
  fin.rows.forEach((r) => {
    cards[r.k] = {
      score: r.owned,
      me: {
        k: r.k, team: r.team, skin: r.skin, won: fin.winner === r.team, tie: fin.winner === 'tie', mvp: fin.mvp[r.team] === r.k,
        stars: r.stars, rank: r.rank, of: fin.rows.length,
        owned: r.owned, painted: r.painted, share: r.share, best: r.best, blazes: r.blazes, right: r.right, answered: r.answered, lms: r.lms,
      },
    };
  });
  return finPack(g, common, fin.totals, cards);
}
// the team games' end: one host payload, each phone its own (by the kid's stable key, so a rejoin finds its card)
function finPack(g, common, totals, cards) {
  const teamScores = { red: totals.red || 0, gold: totals.gold || 0 };
  // the phones get what their ceremony draws: no leaderboard, no podium rows, a few kids of each kingdom
  const f = common.fin;
  const phone = Object.assign({}, common, { fin: Object.assign({}, f, { top: [], crews: { red: (f.crews.red || []).slice(0, 6), gold: (f.crews.gold || []).slice(0, 6) } }) });
  delete phone.leaderboard;
  return {
    teamScores, host: Object.assign({ teamScores }, common),
    keyOf: (p) => (p ? p.finK || null : null),
    guest: () => Object.assign({ teamScores }, phone, { me: { k: 0, guest: true } }),
    forPlayer(pid) {
      const p = g.players[pid];
      const c = p && cards[this.keyOf(p)];
      if (!c) return null;
      return Object.assign({ teamScores }, phone, { scores: { [pid]: c.score }, me: c.me });
    },
  };
}
// endGame for these four games: build the ending once, send the projector its show and each phone its own card
function finFinish(pin, g) {
  let end = null;
  try {
    if (g.gameType === 'kingdoms') end = kdEndPayloads(g);
    else if (g.gameType === 'paint') end = pcEndPayloads(g);
    else if (g.gameType === 'snow') end = snEndPayloads(g);
    else if (g.gameType === 'escape') end = esEndPayloads(g);
    else if (g.gameType === 'trapdoor') end = tdEndPayloads(g);
  } catch (e) { console.error('[finFinish]', g.gameType, e); }
  g.finalizing = null;
  g.finFrenzy = false;
  if (!end) { io.to(pin).emit('game-end', { teamScores: g.teamScores || { red: 0, gold: 0 }, winner: 'tie', leaderboard: [] }); return; }
  end.at = Date.now();
  g.finEnd = end;
  g.teamScores = end.teamScores;
  io.to(g.hostId).emit('game-end', end.host);
  Object.entries(g.players).forEach(([pid, p]) => {
    if (p.disconnected) return;
    io.to(pid).emit('game-end', end.forPlayer(pid) || end.guest());
  });
  _zocoGameEnd(pin, g, end);   // 🪙 El Zoco: a game played for real and its bonus stars pay (core/zoco.js PAY; after the ceremony is sent)
}
// the last 30 s of a round (all four games): one check every 0.5 s; +30 s can switch it off again
setInterval(() => {
  const now = Date.now();
  Object.entries(games).forEach(([pin, g]) => {
    try {
      if (!finGame(g) || g.state !== 'active' || g.finalizing || !g.endsAt || !g.startedAt) return;
      if (g.gameType === 'trapdoor') return;       // Las Trampillas: the Final Round (×2) is its climax, no last-30-s frenzy
      if (finPaused(g)) return;
      const left = g.endsAt - now;
      const running = g.gameType !== 'escape' || (g.escape && g.escape.phase === 'run');
      const on = running && left <= Party.FRENZY_MS && left > 1200 && g.duration >= 60;
      if (on && !g.finFrenzy) { g.finFrenzy = true; io.to(pin).emit('fin:frenzy', { game: g.gameType, endsMs: left }); }
      else if (!on && g.finFrenzy && (left > Party.FRENZY_MS + 1000 || !running)) { g.finFrenzy = false; io.to(pin).emit('fin:frenzy', { game: g.gameType, off: true }); }
    } catch (e) { console.error('[fin:frenzy]', e); }
  });
}, 500);

// ── 🪙 El Zoco de Dralingo in the pin games (2026-10-19) ────────────────────────────────────────────────────────────
// The character a kid plays a pin game as: a skin of El Zoco only when the account this phone PROVED (_joinOwns, never
// a typed classmate's code) owns it; the account's equipped skin wins over the phone's lobby pick (a skin is the kid's
// character everywhere); anything else as before (the phone's emoji or saga id, 8 characters). A skin the account does
// not own becomes its base character's emoji.
// (security review 2026-10-19: the 8-character cut is checked too: «adric-3dX» cut to «adric-3d» is a skin)
function _gameAvatar(sent, rec, proven) {
  const mine = (id) => !!(proven && rec && Students.ownsSkin(rec, id));
  const s = typeof sent === 'string' ? sent : '';
  const skin = Saga.zoco(s) ? s : Saga.zoco(s.slice(0, 8)) ? s.slice(0, 8) : null;
  if (skin) {
    if (mine(skin)) return skin;
    if (proven && rec && typeof rec.avatar === 'string' && mine(rec.avatar)) return rec.avatar;
    return Saga.emojiOf(skin);
  }
  if (proven && rec && typeof rec.avatar === 'string' && mine(rec.avatar)) return rec.avatar;
  return s ? s.slice(0, 8) : '';
}
// The class games that pay (every pin game; never the warm-up, reading or exam rooms: those are class tools)
const ZOCO_GAMES = ['kingdoms', 'paint', 'snow', 'escape', 'trapdoor', 'halcon', 'mochi-mash', 'pinata', 'sixseven', 'monopoly', 'dragon-eye', 'dormilon', 'teamcrab'];
// A pin game's round ended (each game's finisher, right after it built its end payloads): every kid whose account the
// phone proved and who played for real (Zoco.GAME_MIN answers) gets PAY.game and PAY.star per bonus star of the ceremony, once per
// round (the room's id + the round's start), within the day's caps. The phone hears it as `zoco:coins` (a small «+N
// monedas» moment after its own card, never over the ceremony). `end.forPlayer(pid).me` = the kid's card: `answered`
// (Ojos de Halcón: the rounds it looked), `stars` = its bonus stars (Monopolio and the Carrera: `bonus`; their `stars`
// are the game's own score).
function _zocoGameEnd(pin, g, end) {
  try {
    if (!g || !end || typeof end.forPlayer !== 'function' || !ZOCO_GAMES.includes(g.gameType)) return;
    const gid = (g.zid || pin) + ':' + (g.startedAt || 0);
    if (!g.zocoPaid) g.zocoPaid = {};
    if (g.zocoPaid.gid !== gid) g.zocoPaid = { gid, by: {} };
    Object.entries(g.players).forEach(([pid, p]) => {
      // (one kid's trouble never stops the others' coins)
      try {
        if (!p || !p.zocoOk || !p.studentCode || p.zocoCode !== p.studentCode || g.zocoPaid.by[p.studentCode]) return;
        const one = end.forPlayer(pid);
        const me = one && one.me;
        if (!me || me.guest) return;
        const answered = g.gameType === 'halcon' ? (Number(p.hcLooks) || 0) : (Number(me.answered) || 0);
        const st = g.gameType === 'monopoly' || g.gameType === 'dragon-eye' ? me.bonus : me.stars;
        const stars = Array.isArray(st) ? st.length : 0;
        g.zocoPaid.by[p.studentCode] = true;
        const got = Students.updateZoco(p.studentCode, (rec) => { Zoco.ensure(rec, _zocoEnv()); return Zoco.gameEnd(rec, gid, { answered, stars }); });
        if (got && got.got && !p.disconnected) io.to(pid).emit('zoco:coins', { got: got.got, c: got.c, items: got.items, game: g.gameType, at: Date.now() });
      } catch (e) { console.warn('[zoco] a kid\'s game coins failed:', e.message); }
    });
  } catch (e) { console.warn('[zoco] game end failed:', e.message); }
}
function endGame(pin, force) {
  const g = games[pin];
  if (!g) return;
  // Reinos, Pintores, Nieve, La Gran Fuga: every way a round ends plays «¡FINAL!» first (finBegin calls back with force)
  if (finGame(g) && g.state === 'active' && !force) { finBegin(pin, g, 'time'); return; }
  // Flush any pending warmup sentence to contributors' histories before
  // the game ends — otherwise a final un-cleared sentence is lost.
  if (g.gameType === 'warmup' && g.warmup && g.warmup.sentence && g.warmup.sentence.length) {
    if (g.warmup.contributors && g.warmup.contributors.size) {
      Students.logSentence(
        Array.from(g.warmup.contributors),
        g.warmup.sentence,
        pin,
        g.warmup.customWords || [],
      );
    }
  }
  if (g.gameType === 'paint') pcFlush(pin, g);
  g.state = 'ended';
  if (g.gameType === 'kingdoms') kdClearTimers(g);
  if (g.gameType === 'paint') pcStop(g);
  if (g.gameType === 'trapdoor') { tdStop(g); if (g.td) g.td.phase = 'done'; }
  // 🆕 2026-06-08 (Fernando): the moment a room dies, sweep every
  // student's inbox for unread force-pull messages targeting THIS pin
  // and mark them read. That stops the "¡Tu maestra te llama!"
  // takeover from firing on kids who hadn't opened their portal yet —
  // they'd otherwise be pulled into a dead room and feel stuck.
  // Also clear frozen state on warmup rooms so a "stuck frozen" kid
  // on the previous session doesn't get carried forward.
  try {
    const cleared = Students.expirePinForceMessages(pin);
    if (cleared) console.log('[endGame] expired ' + cleared + ' stale force-pulls for pin=' + pin);
  } catch (e) { console.error('[endGame] expirePinForceMessages failed', e); }
  if (g.gameType === 'warmup' && g.warmup) {
    g.warmup.frozen = false;
    g.warmup.frozenNames = [];
  }
  // Reinos de Colores, Dragones Pintores, Batalla de Nieve, La Gran Fuga: the Mario Party ending (finFinish)
  if (finGame(g)) {
    if (g.endTimer) { clearTimeout(g.endTimer); g.endTimer = null; }
    finFinish(pin, g);
    broadcast(pin);
    return;
  }
  // ¡No despiertes a Dralingo!: bonus stars per board, each board's winner, the class podium, each phone its own card.
  if (g.gameType === 'dormilon' && g.dm) {
    if (g.endTimer) { clearTimeout(g.endTimer); g.endTimer = null; }
    dmFinish(pin, g);
    broadcast(pin);
    return;
  }
  // ¡Atrapa a Fénec!: each board's ending (caught / escaped), bonus stars, the crews, the class podium, each phone its card.
  if (g.gameType === 'teamcrab' && g.tc) {
    if (g.endTimer) { clearTimeout(g.endTimer); g.endTimer = null; }
    tcFinish(pin, g);
    broadcast(pin);
    return;
  }
  // Dàfùwēng · Monopolio v2: bonus stars per board, each board's winner, the class podium, each phone its own card.
  if (g.gameType === 'monopoly' && g.mn) {
    if (g.endTimer) { clearTimeout(g.endTimer); g.endTimer = null; }
    mnFinish(pin, g);
    broadcast(pin);
    return;
  }
  // Vuelo del Dragón v2: bonus stars per race, each race's winner, the class podium, each phone its own card.
  if (g.gameType === 'dragon-eye' && g.dr) {
    if (g.endTimer) { clearTimeout(g.endTimer); g.endTimer = null; }
    drFinish(pin, g);
    broadcast(pin);
    return;
  }
  // Mochi Mash v2: totals, winner, bonus stars, each phone its own card (core/mochi.js finish()).
  if (g.gameType === 'mochi-mash' && g.mm) {
    if (g.endTimer) { clearTimeout(g.endTimer); g.endTimer = null; }
    mmFinish(pin, g);
    broadcast(pin);
    return;
  }
  // Piñata Tigre v2: candies, winner, bonus stars, each phone its own card (core/pinata.js finish()).
  if (g.gameType === 'pinata' && g.pn) {
    if (g.endTimer) { clearTimeout(g.endTimer); g.endTimer = null; }
    pnFinish(pin, g);
    broadcast(pin);
    return;
  }
  // 6-7 Swing v2: gold, winner, bonus stars, each phone its own card (core/sixseven.js finish()).
  if (g.gameType === 'sixseven' && g.ss) {
    if (g.endTimer) { clearTimeout(g.endTimer); g.endTimer = null; }
    ssFinish(pin, g);
    broadcast(pin);
    return;
  }
  // Ojos de Halcón: each board's ranking + winner (its phones play the studio finale), the class ranking (core/halcon.js).
  if (g.gameType === 'halcon') {
    if (g.endTimer) { clearTimeout(g.endTimer); g.endTimer = null; }
    hcFinish(pin, g);
    broadcast(pin);
    return;
  }
  const winner =
    g.teamScores.red > g.teamScores.gold
      ? 'red'
      : g.teamScores.gold > g.teamScores.red
      ? 'gold'
      : 'tie';
  const sorted = Object.values(g.players).sort((a, b) => b.score - a.score);
  const mvpRed = sorted.find((p) => p.team === 'red');
  const mvpGold = sorted.find((p) => p.team === 'gold');
  io.to(pin).emit('game-end', {
    teamScores: g.teamScores,
    winner,
    mvpRed: mvpRed ? { name: mvpRed.name, score: mvpRed.score } : null,
    mvpGold: mvpGold ? { name: mvpGold.name, score: mvpGold.score } : null,
    leaderboard: sorted.map((p) => ({ name: p.name, score: p.score, team: p.team, avatar: p.avatar || '' })),
    scores: Object.fromEntries(Object.entries(g.players).map(([id, p]) => [id, p.score || 0])),   // each phone finds its own
  });
  broadcast(pin);
}

// ---------- one name, one device (2026-10-19, player:join) ----------
// a room's slot still in use: its kid's connection is open right now (not a phone that dropped and is coming back)
function _slotLive(g, id) {
  const p = g && g.players[id];
  if (!p || p.disconnected) return false;
  const s = io.sockets.sockets.get(id);
  return !!(s && s.connected);
}
// the same phone again: it sends the code it keeps (its saved code = the slot's account, or the code it sent before)
const _samePhone = (p, code) => !!(code && p && (code === p.studentCode || code === p.phoneCode));
// the slot a join may take by its name → { entry: [id, player] | null, elsewhereId, taken }. A name playing right now on
// ANOTHER phone is never taken (taken: true); the same phone's other tab gives it back and is told (elsewhereId).
function _slotByName(g, name, sid, code) {
  const nm = String(name || '').trim().slice(0, 20).toLowerCase();
  // this phone's own slot first (its code): a «Fernando 2» whose page reloads types «Fernando» again (the link's name)
  if (nm && code && g.gameType !== 'hsksim') {
    const own = Object.entries(g.players).find(([, p]) => {
      if (!_samePhone(p, code)) return false;
      const n = String(p.name || '').toLowerCase(), base = n.replace(/ \d+$/, '');
      return n === nm || (base !== n && nm.startsWith(base) && base.length >= Math.min(nm.length, 14));
    });
    if (own) return { entry: own, elsewhereId: own[0] !== sid && _slotLive(g, own[0]) ? own[0] : null, taken: false };
  }
  const ex = nm ? Object.entries(g.players).find(([, p]) => String(p.name || '').toLowerCase() === nm) : null;
  if (!ex || ex[0] === sid || g.gameType === 'hsksim' || !_slotLive(g, ex[0])) return { entry: ex || null, elsewhereId: null, taken: false };
  if (_samePhone(ex[1], code)) return { entry: ex, elsewhereId: ex[0], taken: false };
  return { entry: null, elsewhereId: null, taken: true };
}
// the same phone's other tab, still open, whose slot a new tab just took: it hears where its game went (a card with
// «Jugar aquí»), never a silent room with no game of its own
function _tellElsewhere(id, pin) {
  const old = id ? io.sockets.sockets.get(id) : null;
  if (!old) return;
  old.data = old.data || {};
  old.data.elsewhere = String(pin);
  old.emit('player:elsewhere', { pin: String(pin) });
  for (const r of Array.from(old.rooms)) if (r !== old.id) old.leave(r);   // the PIN room and any board / race room
}
// a free name in this room for a second «Fernando»: «Fernando 2», «Fernando 3»… (20 characters at most, like any name)
function _freeName(g, name) {
  const taken = new Set(Object.values(g.players).map((p) => String(p.name || '').toLowerCase()));
  for (let n = 2; n < 100; n++) {
    const suf = ' ' + n;
    const cand = name.slice(0, 20 - suf.length).trimEnd() + suf;
    if (!taken.has(cand.toLowerCase())) return cand;
  }
  return name.slice(0, 15).trimEnd() + ' ' + (100 + Math.floor(Math.random() * 900));
}

io.on('connection', (socket) => {
  let currentPin = null;
  let role = null;

  socket.on('host:create', (...args) => {
    // Accept both signatures:
    //   emit('host:create', cb)                       — old mochi client
    //   emit('host:create', { gameType }, cb)         — new client
    let opts = {};
    let cb = () => {};
    for (const a of args) {
      if (typeof a === 'function') cb = a;
      else if (a && typeof a === 'object') opts = a;
    }
    const validTypes = ['mochi-mash', 'pinata', 'dragon-eye', 'monopoly', 'dormilon', 'teamcrab', 'sixseven', 'kingdoms', 'paint', 'snow', 'escape', 'halcon', 'trapdoor', 'warmup', 'reading', 'hsksim'];
    const type = validTypes.includes(opts.gameType) ? opts.gameType : 'mochi-mash';
    // 🔑 2026-10-15 — creating ANY room needs a teacher (his words: "maestros crear un juego needs first time key access,
    // then it's safe"): a remembered teacher device (the dtd cookie the page's connection carried: a /maestro login
    // or the host page's teacher-key screen), or the teacher's code in `password` (host-hsk, the key screen's first
    // create, bots and test scripts). Never by internet address. Wrong codes count in the admin turnstile. An exam room
    // also opens a simulation to every kid with its PIN. Checked before anything is created.
    // 🔒 2026-10-16: the room remembers WHO opened it (hostOwner) and gets a secret (hostToken) that only this projector
    // receives: host:reclaim gives the room back only to them (see _mayReclaim).
    let hostOwner = null;
    {
      const dev = LevelKeys.teacherDevice(socket.handshake.headers || {});
      if (dev) hostOwner = _ownerOfTeacher(dev);
      else {
        const c = _socketCode(socket, opts.password);
        if (c.why === 'wait') return cb({ error: 'Muchos intentos. Espera 10 minutos y vuelve a intentarlo.', needTeacherKey: true });
        if (!c.ok) return cb({ error: 'Falta tu código de maestra: escríbelo una vez en este aparato.', needTeacherKey: true });
        hostOwner = c.owner;
      }
      if (type === 'hsksim' && !_simPayload(String(opts.simId || 'hsk1-sim1'))) return cb({ error: 'unknown simId' });
    }
    const hostToken = require('crypto').randomBytes(16).toString('hex');
    const pin = genPin();
    const defaultDuration =
      type === 'pinata'       ? Pinata.R.DURATION :  // 3 min (the lobby offers 2 / 3 / 4)
      type === 'dragon-eye'   ? Dragon.R.DURATION :   // 4 min (the lobby offers 3 / 4 / 5)
      type === 'monopoly'     ? Mono.R.DURATION :   // 4 min (the lobby offers 3 / 4 / 5)
      type === 'dormilon'     ? Dorm.R.DURATION :   // ¡No despiertes a Dralingo!: 2 min (the lobby offers 2 / 3 / 4)
      type === 'teamcrab'     ? Crab.R.DURATION :   // ¡Atrapa a Fénec!: 2 min (the lobby offers 2 / 3 / 4)
      type === 'sixseven'     ? Sixseven.R.DURATION :   // 2 min (the lobby offers 2 / 3 / 4)
      type === 'kingdoms'     ? 180 :
      type === 'paint'        ? 240 :
      type === 'snow'         ? 240 :
      type === 'escape'       ? 300 :    // three zones + three zona segura phases
      type === 'halcon'       ? Halcon.timeCapS(Halcon.R.ROUNDS) :   // the same: hcStart sets the cap for the rounds picked
      type === 'trapdoor'     ? tdCapS(Trap.R.ROUNDS) :   // Las Trampillas: 7 rounds (the lobby offers 5 / 7 / 10); its tick owns the clock
      type === 'mochi-mash'   ? Mochi.R.DURATION :   // 3 min (the lobby offers 2 / 3 / 4)
      type === 'warmup'       ? 3600 :   // 1 hour ceiling; teacher exits manually
      type === 'reading'      ? 3600 :   // 1 hour ceiling; teacher controls flow
      type === 'hsksim'       ? 3600 :   // 1 hour ceiling; kid takes the exam on their own pace
      60;
    games[pin] = {
      gameType: type,
      hostId: socket.id,
      hostOwner,
      hostToken,
      state: 'lobby',
      duration: defaultDuration,
      startedAt: null,
      endsAt: null,
      questions: [],
      players: {},
      teamScores: { red: 0, gold: 0 },
      feed: [],
      zid: _emCrypto.randomBytes(6).toString('hex'),   // 🪙 this room's own id (PINs come back): a round's coins pay once
    };
    // 6-7 Swing v2 — the sums are generated (core/sixseven.js, dealt by ssTick). No question pack: a single stub keeps
    // questionsLoaded > 0 for the start button; the teacher picks the round style in the lobby (host:ss-style).
    if (type === 'sixseven') {
      games[pin].questions = [{
        text: '__sixseven_stub__',
        correct: '6',
        answers: ['6', '7'],
      }];
      games[pin].setTitle = 'Draly 67 · La Balanza de Oro';
      games[pin].ssStyle = Sixseven.cleanStyle(opts.style);
    }
    // HSKSIM — full mock exam. The host page emits host:create with
    // a simId (which simulation to run). State stays 'lobby' until
    // the teacher hits "Empezar examen" → emits 'hsk:start' → state
    // flips to 'active'. Late joiners after that start from Q1 on
    // their own pace.
    if (type === 'hsksim') {
      const simId = String(opts.simId || 'hsk1-sim1');
      const payload = _simPayload(simId);
      if (!payload) {
        // Reject room creation with bad simId — host page will show err
        return cb({ error: 'unknown simId' });
      }
      games[pin].hsk = {
        simId,
        fx: null,
        sessions: {},
        startedAt: null,
      };
      games[pin].setTitle = payload.title;
      // Seed a stub question so questionsLoaded > 0 passes any
      // start-button gate elsewhere.
      games[pin].questions = [{ text: '__hsksim_stub__', correct: '_', answers: ['_'] }];
      // Mirror into the legacy HSK_ROOMS table so disk-persistence
      // works across dyno restarts.
      try {
        HSK_ROOMS.set(pin, { pin, simId, createdAt: Date.now(), fx: null, owner: hostOwner });   // 🔒 owner: see _mayReclaim
        _hskRoomsSave();
      } catch (_) {}
    }
    currentPin = pin;
    role = 'host';
    socket.join(pin);
    cb({ pin, hostToken });
    broadcast(pin);
  });

  // === HOST RECLAIM === STABILITY FIX (2026-05-28). When the teacher's
  // socket drops (phone lock, network blip, tab switch) socket.io makes a
  // BRAND-NEW socket on reconnect — but the game still points hostId at the
  // dead socket, so the 60s cleanup timer eventually destroys the room and
  // every kid sees "room no longer exists". This lets the host page
  // re-claim its existing game on reconnect: we move hostId to the new
  // socket, cancel the pending cleanup, and re-join the room. No new PIN,
  // so the kids never get kicked.
  socket.on('host:reclaim', (payload, cb) => {
    cb = (typeof cb === 'function') ? cb : () => {};
    const { pin, password, hostToken } = (payload && typeof payload === 'object') ? payload : {};
    const digits = /^\d{3,4}$/.test(String(pin));
    let g = digits ? games[pin] : null;
    // 🔒 2026-10-17: after a restart an exam room lives only on the data disk (HSK_ROOMS) until something needs it; its
    // own monitor coming back (a reconnect, public/js/host-reconnect.js) takes it back too, by the owner rule below.
    // Who asks is checked against a stand-in first (its owner on disk); the room is loaded only for them, and only while
    // it is younger than 6 h (_hskRoomFor), so no socket can wake old or other teachers' exam rooms.
    const stored = (!g && digits && _hskRoomFor(String(pin)))
      ? { gameType: 'hsksim', hostOwner: (HSK_ROOMS.get(String(pin)) || {}).owner || null, hostId: null, hostToken: null } : null;
    // 🔒 2026-10-16: a room goes back only to the teacher who opened it (it used to go to anyone who knew the PIN, even
    // while the teacher's projector was still connected): this projector's room secret (an F5 in the same tab), the
    // same teacher's remembered device or code (another tab or browser), or a super admin. 🔒 2026-10-17 (his decision):
    // warm-up, reading and exam rooms too, on top of their teacher code, read only through _socketCode (it used to be
    // ANY teacher code, even mid-class: one code tried over the 900 PINs took every one of them, and an old sleeping
    // warm-up tab took a newer room whose PIN came back). 🔒 2026-10-17: and nobody else learns whether a PIN is a
    // running room at all (an unknown PIN goes through the same checks: see _mayReclaim).
    const may = _mayReclaim(g || stored, socket, password, hostToken);
    if (may !== 'ok') return cb({ ok: false, error: may });
    if (!g) g = _hskGameLookup(String(pin));
    if (!g) return cb({ ok: false, error: 'no-game' });
    // 🔒 2026-10-17: taken back WITHOUT the room's token (its teacher's other laptop or code, a super admin, an exam room
    // loaded from the disk after a restart) → the room moves to this projector with a fresh token (sent below, kept by
    // teacher-gate.js): its next Wi-Fi blip comes back by the token at once, and an old tab holding the previous token
    // can no longer take it from this one.
    const tokenUsed = !!(g.hostToken && hostToken && _safeEqual(String(hostToken), g.hostToken));
    if (!tokenUsed) g.hostToken = require('crypto').randomBytes(16).toString('hex');
    // Move host identity to this socket; cancel any pending teardown.
    g.hostId = socket.id;
    g.hostDisconnectedAt = null;
    if (g.hostCleanupTimer) { clearTimeout(g.hostCleanupTimer); g.hostCleanupTimer = null; }
    currentPin = pin;
    role = 'host';
    socket.join(pin);
    broadcast(pin);
    // Re-sync the warmup builder state to the reclaiming host so its UI
    // repaints exactly where it left off (sentence, delegates, frozen…).
    if (g.gameType === 'warmup' && g.warmup) {
      io.to(socket.id).emit('wu:state', {
        sentence: g.warmup.sentence || [],
        viewMode: g.warmup.viewMode || 'text',
        curious: !!g.warmup.curious,
        delegates: Array.from(g.warmup.delegates || []),
        judges: Array.from(g.warmup.judges || []),
        frozen: !!g.warmup.frozen,
        frozenNames: g.warmup.frozenNames || [],
        timer: g.warmup.timer || null,
        prompt: g.warmup.prompt || '',
        visibleExps: g.warmup.visibleExps || null,
        customWords: g.warmup.customWords || [],
      });
    }
    // Reading (2026-10-17): the page, the audio, the language, a test running… the projector repaints where it was
    if (g.gameType === 'reading' && g.reading) io.to(socket.id).emit('rd:state', readingBuildStateMsg(g));
    if (g.gameType === 'kingdoms' && g.kingdoms && g.state === 'active') {
      io.to(socket.id).emit('kd:init', kdInitPayload(g, true));
    }
    if (g.gameType === 'paint' && g.paint && g.state === 'active') {
      io.to(socket.id).emit('pc:init', pcInitPayload(g, null));
    }
    if (g.gameType === 'trapdoor' && g.td && g.state === 'active') {
      io.to(socket.id).emit('td:init', tdInitPayload(g, null));
    }
    if (g.gameType === 'snow' && g.snow && g.state === 'active') {
      io.to(socket.id).emit('sn:init', snInitPayload(g, null));
    }
    if (g.gameType === 'escape' && g.escape && g.state === 'active') {
      io.to(socket.id).emit('es:init', esInitPayload(g, null));
    }
    if (g.gameType === 'halcon' && g.halcon && (g.state === 'active' || g.state === 'countdown')) {
      io.to(socket.id).emit('hc:init', hcInitPayload(g, null));
    }
    // Ojos de Halcón: a projector that dropped around the end still gets its finale («Otra ronda» stays reachable)
    if (g.gameType === 'halcon' && g.halcon && g.state === 'ended') {
      io.to(socket.id).emit('game-end', hcEndPayloads(g).host);
    }
    // Dàfùwēng · Monopolio: every board again (the countdown or mid-game), or the ceremony again (after the end)
    if (g.gameType === 'monopoly' && g.mn && (g.state === 'active' || g.state === 'countdown')) io.to(socket.id).emit('mn:init', mnInitPayload(g, null));
    if (g.gameType === 'monopoly' && g.mn && g.state === 'ended') io.to(socket.id).emit('game-end', mnEndPayloads(g).host);
    // ¡No despiertes a Dralingo!: every board again (the countdown or mid-game), or the ceremony again (after the end)
    if (g.gameType === 'dormilon' && g.dm && (g.state === 'active' || g.state === 'countdown')) io.to(socket.id).emit('dm:init', dmInitPayload(g, null));
    if (g.gameType === 'dormilon' && g.dm && g.state === 'ended') io.to(socket.id).emit('game-end', dmEndPayloads(g).host);
    // ¡Atrapa a Fénec!: every board again (the countdown or mid-game), or the ending again (after the end)
    if (g.gameType === 'teamcrab' && g.tc && (g.state === 'active' || g.state === 'countdown')) io.to(socket.id).emit('tc:init', tcInitPayload(g, null));
    if (g.gameType === 'teamcrab' && g.tc && g.state === 'ended') io.to(socket.id).emit('game-end', tcEndPayloads(g).host);
    // Vuelo del Dragón: every race again (the countdown or mid-game), or the ceremony again (after the end)
    if (g.gameType === 'dragon-eye' && g.dr && (g.state === 'active' || g.state === 'countdown')) io.to(socket.id).emit('dr:init', drInitPayload(g, null));
    if (g.gameType === 'dragon-eye' && g.dr && g.state === 'ended') io.to(socket.id).emit('game-end', drEndPayloads(g).host);
    // Mochi Mash: the terrace again (mid-game), or the ceremony again (after the end)
    if (g.gameType === 'mochi-mash' && g.mm && g.state === 'active') io.to(socket.id).emit('mm:init', mmInitPayload(g, null));
    if (g.gameType === 'mochi-mash' && g.mm && g.state === 'ended') io.to(socket.id).emit('game-end', mmEndPayloads(g).host);
    // Piñata Tigre: the party again (mid-game), or the ceremony again (after the end)
    if (g.gameType === 'pinata' && g.pn && g.state === 'active') io.to(socket.id).emit('pn:init', pnInitPayload(g, null));
    if (g.gameType === 'pinata' && g.pn && g.state === 'ended') io.to(socket.id).emit('game-end', pnEndPayloads(g).host);
    // 6-7 Swing: the balance again (mid-game), or the ceremony again (after the end)
    if (g.gameType === 'sixseven' && g.ss && g.state === 'active') io.to(socket.id).emit('ss:init', ssInitPayload(g, null));
    if (g.gameType === 'sixseven' && g.ss && g.state === 'ended') io.to(socket.id).emit('game-end', ssEndPayloads(g).host);
    // Reinos, Pintores, Nieve, La Fuga (the shared Mario Party ending, js/party.js): the last 30 s, «¡FINAL!» still on,
    // or the whole ceremony again after the end
    finReclaim(socket.id, g);
    cb(Object.assign({ ok: true, gameType: g.gameType, state: g.state }, tokenUsed ? {} : { hostToken: g.hostToken }));
  });

  socket.on('host:upload-questions', ({ pin, questions }) => {
    const g = games[pin];
    if (!g || g.hostId !== socket.id) return;
    g.questions = (questions || []).filter(
      (q) => q && q.text && q.correct && Array.isArray(q.answers) && q.answers.length >= 2
    );
    broadcast(pin);
  });

  socket.on('host:load-set', ({ pin, setId }, cb) => {
    const g = games[pin];
    if (!g || g.hostId !== socket.id) {
      console.warn('[host:load-set] BLOCKED pin=' + pin + ' setId=' + setId + ' — not host or no game');
      if (cb) cb({ ok: false, error: 'Not authorized' });
      return;
    }
    try {
      const set = Sets.loadSet(setId);
      if (!set) {
        console.warn('[host:load-set] FAILED pin=' + pin + ' setId=' + setId + ' — Sets.loadSet returned null');
        if (cb) cb({ ok: false, error: 'Set not found: ' + setId });
        return;
      }
      // (2026-10-24, his rule: pinyin WITH tone marks in the pin games) a curriculum pack's questions as the rooms show
      // them, toned (core/packs.js forGames); homework and El Entrenamiento keep the plain ones
      g.questions = Packs.forGames(set.questions);
      g.setTitle = set.title;
      g.setId = String(setId);          // Ojos de Halcón finds the level's word pictures from it
      broadcast(pin);
      console.log('[host:load-set] OK pin=' + pin + ' setId=' + setId + ' title=' + set.title + ' questions=' + set.questions.length);
      if (cb) cb({ ok: true, title: set.title, count: set.questions.length });
      warmImagesForGame(pin, set.questions);
    } catch (e) {
      console.error('[host:load-set] EXCEPTION pin=' + pin + ' setId=' + setId + ' →', e.message, e.stack);
      if (cb) cb({ ok: false, error: e.message });
    }
  });

  async function warmImagesForGame(pin, questions) {
    const g = games[pin];
    if (!g) return;
    // Only pictures on other sites need warming (our /assets/ files are served instantly); none → no badge at all.
    const urls = [...new Set(questions.map((q) => Images.urlForQuestion(q)).filter((u) => u && /^https?:\/\//i.test(u)))];
    if (!urls.length) return;
    const total = urls.length;
    let warmed = 0;
    io.to(g.hostId).emit('images-progress', { warmed: 0, total });
    // Fire 3 in parallel to avoid hammering the image host
    const queue = [...urls];
    async function worker() {
      while (queue.length > 0) {
        const url = queue.shift();
        try {
          await fetch(url, { signal: AbortSignal.timeout(20000) });
        } catch (e) {
          // ignore failures — image will just take longer when displayed
        }
        warmed++;
        if (games[pin]) io.to(games[pin].hostId).emit('images-progress', { warmed, total });
      }
    }
    await Promise.all([worker(), worker(), worker()]);
  }

  socket.on('host:set-duration', ({ pin, duration }) => {
    const g = games[pin];
    if (!g || g.hostId !== socket.id) return;
    g.duration = Math.max(15, Math.min(600, Number(duration) || 60));
    // Las Trampillas counts in rounds: a duration becomes the rounds that fit (the lobby's 5 · 7 · 10 sets them directly)
    if (g.gameType === 'trapdoor' && g.state === 'lobby') { g.tdRounds = tdRoundsFor(g.duration); g.duration = tdCapS(g.tdRounds); }
    broadcast(pin);
  });

  socket.on('host:swap-team', ({ pin, playerId }) => {
    const g = games[pin];
    if (!g || g.hostId !== socket.id) return;
    const p = g.players[playerId];
    if (!p) return;
    if ((g.gameType === 'mochi-mash' || g.gameType === 'pinata' || g.gameType === 'sixseven') && g.state !== 'lobby') return;   // a kid's points belong to the team they played for
    p.team = p.team === 'red' ? 'gold' : 'red';
    g.feed.push({ type: 'swap', name: p.name, team: p.team, t: Date.now() });
    io.to(playerId).emit('team-changed', { team: p.team });
    if (g.gameType === 'paint' && g.paint) io.to(pin).emit('pc:roster', pcRoster(g));
    if (g.gameType === 'trapdoor' && g.td) { const d = tdKidOf(g, p); if (d) d.team = tdTeam(p); io.to(pin).emit('td:roster', tdRoster(g)); }
    broadcast(pin);
  });

  // Las Trampillas: the teacher picks the arena (El Palacio de Dubái, El Templo del Cielo, El Jardín de la Luna) and the
  // rounds (5 · 7 · 10, up to 15) in the lobby; «Otra ronda» moves on to the next arena by itself
  socket.on('host:td-arena', (data, cb) => {
    const { pin, arena } = data || {};
    const g = games[pin];
    const a = Number(arena);
    if (!g || g.hostId !== socket.id || g.gameType !== 'trapdoor' || g.state !== 'lobby' || !Number.isInteger(a) || a < 0 || a >= TD_ARENAS) { if (typeof cb === 'function') cb({ ok: false }); return; }
    g.tdArena = a;
    io.to(pin).emit('td:arena', { arena: a });
    g._lastBcast = 0;
    broadcast(pin);
    if (typeof cb === 'function') cb({ ok: true, arena: a });
  });
  socket.on('host:td-rounds', (data, cb) => {
    const { pin, rounds } = data || {};
    const g = games[pin];
    if (!g || g.hostId !== socket.id || g.gameType !== 'trapdoor' || g.state !== 'lobby' || !Number.isFinite(Number(rounds))) { if (typeof cb === 'function') cb({ ok: false }); return; }
    g.tdRounds = Trap.clampRounds(rounds);
    g.duration = tdCapS(g.tdRounds);
    g._lastBcast = 0;
    broadcast(pin);
    if (typeof cb === 'function') cb({ ok: true, rounds: g.tdRounds });
  });
  // Las Trampillas «⏭ Saltar»: «¡YA!» → round 1 now; a tally → the next round now (the ceremony has host:fin-skip)
  socket.on('host:td-skip', (data) => {
    try {
      const pin = data && data.pin;
      const g = games[pin];
      if (!g || g.hostId !== socket.id || g.gameType !== 'trapdoor' || !g.td || g.state !== 'active' || g.finalizing) return;
      const now = Date.now();
      tdEvents(pin, g, Trap.skip(g.td, now, Math.random), now);
    } catch (e) { console.error('[host:td-skip]', e); }
  });

  // Dragones Pintores v2: the teacher picks the round's world in the lobby (Dubái, la Gran Muralla, el río Li, Shanghái)
  socket.on('host:pc-world', (data, cb) => {
    const { pin, world } = data || {};
    const g = games[pin];
    if (!g || g.hostId !== socket.id || g.gameType !== 'paint' || g.state === 'active' || g.state === 'countdown') { if (typeof cb === 'function') cb({ ok: false }); return; }
    const w = Number(world);
    if (!Number.isInteger(w) || w < 0 || w >= PC_WORLDS) { if (typeof cb === 'function') cb({ ok: false }); return; }
    g.pcWorld = w;
    io.to(pin).emit('pc:world', { world: w });
    if (typeof cb === 'function') cb({ ok: true, world: w });
  });

  // La Gran Fuga v2: the teacher picks the round's route in the lobby (Dubái, China); «Otra ronda» moves on by itself
  socket.on('host:es-route', (data, cb) => {
    const { pin, route } = data || {};
    const g = games[pin];
    const r = Number(route);
    if (!g || g.hostId !== socket.id || g.gameType !== 'escape' || g.state !== 'lobby'
      || !Number.isInteger(r) || r < 0 || r >= EscapeMap.ROUTES.length) { if (typeof cb === 'function') cb({ ok: false }); return; }
    g.esRoute = r;
    io.to(pin).emit('es:route', { route: r });
    if (typeof cb === 'function') cb({ ok: true, route: r });
  });

  socket.on('host:auto-balance', ({ pin }) => {
    const g = games[pin];
    if (!g || g.hostId !== socket.id) return;
    if ((g.gameType === 'mochi-mash' || g.gameType === 'pinata' || g.gameType === 'sixseven') && g.state !== 'lobby') return;
    // only the kids who are still connected (a kid who left stays where they were; the room drops them after 5 min)
    const ids = Object.keys(g.players).filter((id) => !g.players[id].disconnected).sort(() => Math.random() - 0.5);
    ids.forEach((id, i) => {
      g.players[id].team = i % 2 === 0 ? 'red' : 'gold';
      io.to(id).emit('team-changed', { team: g.players[id].team });
      const d = tdKidOf(g, g.players[id]);
      if (d) d.team = tdTeam(g.players[id]);
    });
    if (g.gameType === 'paint' && g.paint) io.to(pin).emit('pc:roster', pcRoster(g));
    if (g.gameType === 'trapdoor' && g.td) io.to(pin).emit('td:roster', tdRoster(g));
    broadcast(pin);
  });

  socket.on('host:start', ({ pin }) => {
    const g = games[pin];
    if (!g || g.hostId !== socket.id) return;
    if ((g.gameType === 'monopoly' || g.gameType === 'dragon-eye' || g.gameType === 'dormilon' || g.gameType === 'teamcrab') && g.state !== 'lobby') return;   // Monopolio / Vuelo / No despiertes: a second click never deals again
    // Reinos / Pintores: a second click (or a reconnected projector) must not wipe a round that is already running.
    if ((g.gameType === 'kingdoms' || g.gameType === 'paint' || g.gameType === 'snow' || g.gameType === 'escape' || g.gameType === 'halcon' || g.gameType === 'mochi-mash' || g.gameType === 'pinata' || g.gameType === 'sixseven' || g.gameType === 'trapdoor') && g.state !== 'lobby') return;
    // Some game types don't use question sets at all (their content is
    // generated server-side or teacher-driven). Don't gate them on
    // questions.length, otherwise Start silently does nothing and the
    // host has no idea why. Warmup/Reading are teacher tools, SixSeven
    // generates math on the fly, HSK rooms load their own simulation.
    const setlessGameTypes = ['sixseven', 'warmup', 'reading', 'hsksim'];
    if (!setlessGameTypes.includes(g.gameType) && !g.questions.length) {
      console.warn('[host:start] BLOCKED pin=' + pin + ' gameType=' + g.gameType + ' — no questions loaded. Pick a set first.');
      io.to(socket.id).emit('host:start-error', {
        reason: 'no-set',
        message: 'Este juego necesita una serie de preguntas. Vuelve a /sets.html y elige una serie primero.',
      });
      return;
    }
    // Teacher TOOLS can open with zero players — the teacher drives the
    // screen and students stream in afterward (e.g. live-master force-join
    // from /maestro creates the builder, THEN pushes the kids in). Gating
    // these on player count caused the "Preparando… (stuck)" bug.
    const soloOkGameTypes = ['warmup', 'reading', 'hsksim'];
    if (!soloOkGameTypes.includes(g.gameType) && Object.keys(g.players).length === 0) {
      console.warn('[host:start] BLOCKED pin=' + pin + ' — no players joined yet.');
      io.to(socket.id).emit('host:start-error', {
        reason: 'no-players',
        message: 'Aún no hay jugadores. Comparte el PIN antes de empezar.',
      });
      return;
    }
    if (g.extraSecs) { g.duration = Math.max(15, g.duration - g.extraSecs); g.extraSecs = 0; }   // last round's «+30 s»
    g.state = 'countdown';
    broadcast(pin);
    // Reinos de Colores: the two captains are revealed during the countdown (projector VS intro, phones).
    g.finalizing = null; g.finEnd = null; g.finFrenzy = false;
    if (g.gameType === 'kingdoms') { g.kdCaptains = kdPickCaptains(g.kdCaptains); io.to(pin).emit('kd:captains', g.kdCaptains); }
    // Dragones Pintores: two of the gang captain the kingdoms too (they cheer on the phones and speak in the ending)
    if (g.gameType === 'paint') { g.pcCaptains = kdPickCaptains(g.pcCaptains); io.to(pin).emit('pc:captains', g.pcCaptains); }
    // Las Trampillas: the same (they cheer on the phones and the projector, and speak in the ending)
    if (g.gameType === 'trapdoor') { g.tdCaptains = kdPickCaptains(g.tdCaptains); io.to(pin).emit('td:captains', g.tdCaptains); }
    // Batalla de Nieve: one of the gang leads the survivors, another the ice team (VS intro on the projector).
    if (g.gameType === 'snow') {
      const c = kdPickCaptains(g.snCaptains ? { red: g.snCaptains.sun, gold: g.snCaptains.ice } : null);
      g.snCaptains = { sun: c.red, ice: c.gold };
      io.to(pin).emit('sn:captains', g.snCaptains);
    }
    // La Gran Fuga: Profe Fer opens the episode, Hamdan waits at the jet, one of the gang cheers at each big moment
    // (the same picks on the projector and every phone).
    if (g.gameType === 'escape') {
      const gang = kdShuffle(['latifa', 'aileen', 'adric', 'adrian', 'hamdan', 'fer']);
      g.esCast = { open: 'fer', jet: 'hamdan', cheers: gang.slice(0, 4) };
      io.to(pin).emit('es:cast', g.esCast);
    }
    // Mochi Mash: one of the gang captains each team (the run-in shows them; they cheer on lead changes and landmarks)
    if (g.gameType === 'mochi-mash') { g.mmCaptains = kdPickCaptains(g.mmCaptains); io.to(pin).emit('mm:captains', g.mmCaptains); }
    // Piñata Tigre: the same (they cheer on hits, bursts, landmarks and lead changes)
    if (g.gameType === 'pinata') { g.pnCaptains = kdPickCaptains(g.pnCaptains); io.to(pin).emit('pn:captains', g.pnCaptains); }
    // 6-7 Swing: the same (they cheer on leads, landmarks and the frenzy, and the winner's captain speaks at the end)
    if (g.gameType === 'sixseven') { g.ssCaptains = kdPickCaptains(g.ssCaptains); io.to(pin).emit('ss:captains', g.ssCaptains); }
    io.to(pin).emit('countdown', { ms: COUNTDOWN_MS });
    // Ojos de Halcón: the boards are dealt now, so the countdown plays each board's run-in on its phones.
    if (g.gameType === 'halcon') hcDeal(pin, g);
    // Dàfùwēng · Monopolio: the same (each phone's run-in shows its own board of 4)
    if (g.gameType === 'monopoly') mnDeal(pin, g);
    const mnDealt = g.gameType === 'monopoly' && g.mn ? g.mn.id : null;   // (a reset / new deal during the countdown: this start is void)
    // ¡No despiertes a Dralingo!: the same (each phone's run-in shows its own board of 4 and the sleeping Dralingo)
    if (g.gameType === 'dormilon') dmDeal(pin, g);
    const dmDealt = g.gameType === 'dormilon' && g.dm ? g.dm.id : null;
    // ¡Atrapa a Fénec!: the same (each phone's run-in shows its own crab and crew)
    if (g.gameType === 'teamcrab') tcDeal(pin, g);
    const tcDealt = g.gameType === 'teamcrab' && g.tc ? g.tc.id : null;
    // Vuelo del Dragón: the same (each phone's run-in shows its own race of 4)
    if (g.gameType === 'dragon-eye') drDeal(pin, g);
    const drDealt = g.gameType === 'dragon-eye' && g.dr ? g.dr.id : null;

    setTimeout(() => {
      if (!games[pin]) return;
      if (g.gameType === 'monopoly' && (g.state !== 'countdown' || !g.mn || g.mn.id !== mnDealt)) return;
      if (g.gameType === 'dormilon' && (g.state !== 'countdown' || !g.dm || g.dm.id !== dmDealt)) return;
      if (g.gameType === 'teamcrab' && (g.state !== 'countdown' || !g.tc || g.tc.id !== tcDealt)) return;
      if (g.gameType === 'dragon-eye' && (g.state !== 'countdown' || !g.dr || g.dr.id !== drDealt)) return;
      g.state = 'active';
      g.startedAt = Date.now();
      g.endsAt = Date.now() + g.duration * 1000;
      g.teamScores = { red: 0, gold: 0 };
      Object.values(g.players).forEach((p) => {
        p.score = 0;
        p.hcLooks = 0;                     // (🪙 El Zoco: this round's looks)
        p.queueIdx = 0;
        p.mashUntil = 0;
        p.recentTaps = [];
      });
      // Dàfùwēng · Monopolio: the boards were dealt at the countdown; the intro now, then mnPlay (its tick deals the questions)
      if (g.gameType === 'monopoly') mnStart(pin, g);
      // ¡No despiertes a Dralingo!: the boards were dealt at the countdown; the intro now, then dmPlay (its tick runs the turns)
      if (g.gameType === 'dormilon') dmStart(pin, g);
      // ¡Atrapa a Fénec!: the boards were dealt at the countdown; the intro now, then tcPlay (its tick runs everything)
      if (g.gameType === 'teamcrab') tcStart(pin, g);

      // Vuelo del Dragón v2: the races were dealt at the countdown; the intro now, then drPlay (its tick deals the questions)
      if (g.gameType === 'dragon-eye') drStart(pin, g);

      if (g.gameType === 'kingdoms') kdStart(pin, g);
      if (g.gameType === 'paint') pcStart(pin, g);
      if (g.gameType === 'trapdoor') tdStart(pin, g);      // «¡YA!», then its tick runs the rounds, deals the questions, ends the match
      if (g.gameType === 'snow') snStart(pin, g);
      if (g.gameType === 'escape') esStart(pin, g);
      if (g.gameType === 'halcon') hcStart(pin, g);
      if (g.gameType === 'mochi-mash') mmStart(pin, g);   // the intro first: mmPlay deals the questions and runs the clock
      if (g.gameType === 'pinata') pnStart(pin, g);       // the same: pnPlay deals the questions and runs the clock
      if (g.gameType === 'sixseven') ssStart(pin, g);     // the same: ssPlay deals the sums and runs the clock
      if (g.gameType === 'reading') {
        // === 📖 READING MODE ===
        // Teacher-driven story session. Server holds the master playback
        // state; all student phones mirror in real time. PINYIN ONLY (no
        // hanzi). Audio + image files live in public/assets/reading/
        // and are referenced by URL in the story payload.
        const startId = ReadingStory.DEFAULT_STORY_ID;
        const payload = ReadingStory.buildStoryPayload(startId);
        g.reading = {
          storyId: payload.id,
          title: payload.title,
          subtitle: payload.subtitle,
          music: payload.music || null,      // 🎵 per-story theme name
          theme: payload.theme || null,      // 🎨 per-story color palette
          pages: payload.pages,
          // List of available stories so the host can switch between them
          // without reloading the page.
          storyList: ReadingStory.listStories(),
          currentPage: 0,            // index into pages
          // 'pinyin' (HSK1 chinese) or 'es' (Spanish translation). The
          // image + audio NEVER change with language — only the on-screen
          // text. So kids hear Chinese narration and read Spanish text =
          // bilingual comprehension boost without doubling audio assets.
          language: 'pinyin',
          // 🔍 Modo Curioso — when ON, students can tap any pinyin word
          // to open a dictionary card (Pokédex-style). The dictionary
          // itself lives client-side in warmup-vocab.js (WU_WORD_BY_PINYIN
          // lookup). Server just gates the visibility.
          curious: false,
          isPlaying: false,
          audioPosMs: 0,
          playStartedAt: 0,
          // 🐢 Slow-mo. 1.0 = normal speed, 0.5 = half-speed for kids who
          // need extra time to catch each pinyin word. Per-page audio +
          // karaoke highlight both slow down together since the highlight
          // is driven by audio.currentTime which respects playbackRate.
          playbackRate: 1.0,
          adminSocketId: g.hostId,
        };
        io.to(pin).emit('rd:state', readingBuildStateMsg(g));
      }
      if (g.gameType === 'warmup') {
        g.warmup = {
          sentence: [],
          viewMode: 'text',
          curious: false,
          delegates: new Set(),
          judges: new Set(),
          frozen: false,
          frozenNames: [],        // selective freeze — specific kids paused
          timer: null,            // { endsAt, duration } countdown or null
          visibleExps: null,      // null = all 8 banks visible
          customWords: [],        // live teacher-created words
          contributors: new Set(),
          // Shared undo stack — anyone (host or asistente) can press
          // undo to pop the last sentence state. Capped at 30 entries.
          undoStack: [],
          adminSocketId: g.hostId,
        };
        io.to(pin).emit('wu:state', {
          sentence: g.warmup.sentence,
          viewMode: g.warmup.viewMode,
          curious: g.warmup.curious,
          delegates: [],
          judges: [],
          frozen: false,
          visibleExps: null,
          customWords: [],
        });
      }
      broadcast(pin);
      // Every question-driven game auto-deals the first question (Dragones Pintores: kids ask with «Recargar»).
      if (g.gameType !== 'paint' && g.gameType !== 'snow' && g.gameType !== 'halcon' && g.gameType !== 'dormilon' && g.gameType !== 'teamcrab' && g.gameType !== 'mochi-mash' && g.gameType !== 'pinata' && g.gameType !== 'sixseven' && g.gameType !== 'trapdoor') Object.keys(g.players).forEach((pid) => {
        const q = nextQuestionFor(g, pid);
        if (q) io.to(pid).emit('question', q);
      });
      if (g.gameType !== 'mochi-mash' && g.gameType !== 'pinata' && g.gameType !== 'sixseven') g.endTimer = setTimeout(() => {
        if (!games[pin] || games[pin].state !== 'active') return;
        endGame(pin);
      }, g.duration * 1000);
      // Dàfùwēng · Monopolio: its room tick owns the clock (intro, +30 s, pause, «¡FINAL!»): no generic end timer
      if ((g.gameType === 'monopoly' || g.gameType === 'dragon-eye' || g.gameType === 'trapdoor' || g.gameType === 'dormilon' || g.gameType === 'teamcrab') && g.endTimer) { clearTimeout(g.endTimer); g.endTimer = null; }
    }, COUNTDOWN_MS);
  });

  socket.on('host:end-now', ({ pin }) => {
    const g = games[pin];
    if (!g || g.hostId !== socket.id) return;
    // Reinos, Pintores, Nieve, La Gran Fuga: «Terminar» plays «¡FINAL!» first (also from the pause card), never twice
    if (finGame(g)) {
      if (g.state !== 'active') return;
      if (g.finalizing && Date.now() > g.finalizing.until + 2000) { try { endGame(pin, true); } catch (e) { finRescue(pin, g, e); } return; }
      finBegin(pin, g, 'end');
      return;
    }
    if ((g.gameType === 'snow' || g.gameType === 'escape' || g.gameType === 'halcon' || g.gameType === 'mochi-mash' || g.gameType === 'pinata' || g.gameType === 'sixseven') && g.state !== 'active') return;      // already over: no second end show
    // Ojos de Halcón: «Terminar» plays «¡FINAL!» first (paused: straight to the finale, the pause holds every timer)
    if (g.gameType === 'halcon' && g.halcon && !g.halcon.paused) {
      if (g.halcon.phase === 'final') return;      // «¡FINAL!» is already on: the finale follows by itself
      if (g.halcon.phase !== 'done') { hcFinal(pin, g); return; }
    }
    // ¡No despiertes a Dralingo!: «Terminar» plays «¡FINAL!» first (also from the pause card), then the ceremony; never twice
    if (g.gameType === 'dormilon') {
      if (!g.dm || g.state !== 'active' || g.dm.phase === 'final' || g.dm.phase === 'done') return;
      dmFinal(pin, g);
      return;
    }
    // ¡Atrapa a Fénec!: «Terminar» plays «¡FINAL!» first (also from the pause card), then the endings; never twice
    if (g.gameType === 'teamcrab') {
      if (!g.tc || g.state !== 'active' || g.tc.phase === 'final' || g.tc.phase === 'done') return;
      tcFinal(pin, g);
      return;
    }
    // Dàfùwēng · Monopolio: «Terminar» plays «¡FINAL!» first (also from the pause card), then the ceremony; never twice
    if (g.gameType === 'monopoly') {
      if (!g.mn || g.state !== 'active' || g.mn.phase === 'final' || g.mn.phase === 'done') return;
      mnFinal(pin, g);
      return;
    }
    // Vuelo del Dragón: the same («¡FINAL!» first, then the ceremony; never twice)
    if (g.gameType === 'dragon-eye') {
      if (!g.dr || g.state !== 'active' || g.dr.phase === 'final' || g.dr.phase === 'done') return;
      drFinal(pin, g);
      return;
    }
    // Mochi Mash: «Terminar» plays «¡FINAL!» first (also when paused: the pause ends), then the ceremony
    if (g.gameType === 'mochi-mash' && g.mm) {
      if (g.state !== 'active' || g.mm.phase === 'final' || g.mm.phase === 'done') return;
      mmFinal(pin, g);
      return;
    }
    // Piñata Tigre: the same («¡FINAL!» first, also from the pause card)
    if (g.gameType === 'pinata' && g.pn) {
      if (g.state !== 'active' || g.pn.phase === 'final' || g.pn.phase === 'done') return;
      pnFinal(pin, g);
      return;
    }
    // 6-7 Swing: the same («¡FINAL!» first, also from the pause card)
    if (g.gameType === 'sixseven' && g.ss) {
      if (g.state !== 'active' || g.ss.phase === 'final' || g.ss.phase === 'done') return;
      ssFinal(pin, g);
      return;
    }
    if (g.endTimer) clearTimeout(g.endTimer);
    endGame(pin);
  });

  // 🔒 2026-10-15 — «Cerrar la sala» on the exam monitor (host-hsk.js): the room closes for good (it used to do nothing,
  // so a PIN kept opening the exam for 6 h). Its PIN, its page and its files stop working; kids who already took it
  // can still hand it in (their submit ticket). Since 2026-10-17 only the teacher who opened it (any socket: a monitor
  // that reconnected under a new socket too), its own projector or a super admin, always with a teacher check.
  socket.on('host:end', ({ pin, password, hostToken } = {}, cb) => {
    cb = typeof cb === 'function' ? cb : () => {};
    pin = String(pin || '');
    const g = games[pin];
    const isExam = (g && g.gameType === 'hsksim') || (!g && HSK_ROOMS.has(pin));
    const owner = !isExam ? null : g ? (g.hostOwner || null) : ((HSK_ROOMS.get(pin) || {}).owner || null);
    // always the teacher code (the monitor sends it), even from the host socket: closing ends the exam for everyone.
    // Wrong codes count in the admin turnstile like every other teacher check.
    // 🔒 2026-10-15: a remembered teacher device's monitor counts too; only a code actually sent (and not a retired one)
    // counts as a wrong guess, so kids in the room can't lock the school's address out by spamming this
    // 🔒 2026-10-17 (his decision): and only the room's own projector, the teacher who opened it or a super admin
    // (_mayCloseExam). The teacher check comes before the PIN is looked at, and an unknown PIN answers like a room that
    // is not yours: a socket learns nothing about which PINs are running exams (kids' PIN guesses count in player:join).
    const may = _mayCloseExam(isExam ? (g || null) : null, owner, socket, password, hostToken);
    if (may === 'wait') return cb({ ok: false, error: 'demasiados intentos' });
    if (may === 'not-teacher') return cb({ ok: false, error: 'not-teacher' });
    if (!isExam || may !== 'ok') return cb({ ok: false, error: 'not-owner' });
    if (g) {
      if (g.endTimer) clearTimeout(g.endTimer);
      io.to(pin).emit('host-left');
      delete games[pin];
    }
    HSK_ROOMS.delete(pin);
    _hskClosed.set(pin, Date.now());
    _hskRoomsSave();
    cb({ ok: true });
  });

  socket.on('host:reset', ({ pin }) => {
    const g = games[pin];
    if (!g || g.hostId !== socket.id) return;
    if (g.endTimer) clearTimeout(g.endTimer);
    g.finalizing = null; g.finEnd = null; g.finFrenzy = false;     // (the Mario Party ending of the four games below)
    if (g.gameType === 'kingdoms') { kdClearTimers(g); g.kingdoms = null; }
    if (g.gameType === 'paint') { const was = g.paint; pcStop(g); g.paint = null; if (was) g.pcWorld = ((was.sky.world | 0) + 1) % PC_WORLDS; io.to(pin).emit('pc:world', { world: g.pcWorld | 0 }); }
    if (g.gameType === 'snow') { snStop(g); g.snow = null; }
    // Las Trampillas: «Otra ronda» = the next arena (Dubái → el Templo del Cielo → el Jardín de la Luna → Dubái…)
    if (g.gameType === 'trapdoor') {
      const was = g.td;
      tdStop(g);
      g.td = null;
      if (was) g.tdArena = (was.arena + 1) % TD_ARENAS;
      Object.values(g.players).forEach((p) => { p.tdQKind = null; p.tdMeKey = ''; });
      io.to(pin).emit('td:arena', { arena: g.tdArena | 0 });
    }
    // La Gran Fuga v2: «Otra ronda» = the next route (Dubái → China → Dubái…)
    if (g.gameType === 'escape') { const was = g.escape; esStop(g); g.escape = null; if (was) g.esRoute = EscapeMap.routeIdx((was.route | 0) + 1); io.to(pin).emit('es:route', { route: EscapeMap.routeIdx(g.esRoute) }); }
    if (g.gameType === 'halcon') { hcStop(g); g.halcon = null; }
    if (g.gameType === 'monopoly') { mnStop(g); g.mn = null; }   // (each kid keeps its id k; a new game makes new boards)
    if (g.gameType === 'dormilon') { dmStop(g); g.dm = null; }   // (the same: a new game deals new boards and new nights)
    if (g.gameType === 'teamcrab') { tcStop(g); g.tc = null; }   // (the same: a new game deals new crabs)
    if (g.gameType === 'dragon-eye') { drStop(g); g.dr = null; }  // (the same: a new game deals new races)
    if (g.gameType === 'mochi-mash') {
      mmStop(g);
      g.mm = null;
      Object.values(g.players).forEach((p) => { p.mmGame = null; p.mmMash = null; p.mmNextQAt = 0; });
    }
    if (g.gameType === 'pinata') {
      pnStop(g);
      g.pn = null;
      Object.values(g.players).forEach((p) => { p.pnGame = null; p.pnSwing = null; p.pnNextQAt = 0; });
    }
    if (g.gameType === 'sixseven') {
      ssStop(g);
      g.ss = null;
      Object.values(g.players).forEach((p) => { p.ssGame = null; p.ssQ = null; p.ssOut = null; p.ssNextQAt = 0; });
    }
    g.state = 'lobby';
    g.teamScores = { red: 0, gold: 0 };
    g.endsAt = null;
    // «+30 s» was for the round that just ended: the next round gets the duration the teacher picked.
    if (g.extraSecs) { g.duration = Math.max(15, g.duration - g.extraSecs); g.extraSecs = 0; }
    Object.values(g.players).forEach((p) => {
      p.score = 0;
      p.queueIdx = 0;
      p.mashUntil = 0;
      p.recentTaps = [];
      p.currentQ = null;
    });
    broadcast(pin);
  });

  socket.on('player:join', ({ pin, name, avatar, studentCode, accessCode }, cb) => {
    cb = typeof cb === 'function' ? cb : () => {};
    const g = games[pin];
    // 🔒 2026-10-15 (security review): joining an exam room hands out its room pass, so PINs must not be found by
    // trying them over the socket either: a PIN with no game counts as a guess for this address (same 60 / 10 min as
    // the HTTP lookups); once paused, unknown PINs and exam rooms answer «espera», other games still let a class in
    const ip = _socketIp(socket);
    const paused = _pinBlocked(ip);
    if (!g) {
      if (!paused) _pinMiss(ip, pin);
      return cb({ ok: false, error: paused ? 'Espera unos minutos y vuelve a escribir el PIN.' : 'No hay ningún juego con ese PIN. Revisa el número.' });
    }
    if (paused && g.gameType === 'hsksim') return cb({ ok: false, error: 'Espera unos minutos y vuelve a escribir el PIN.' });
    const sentCode = typeof studentCode === 'string' && studentCode ? studentCode.slice(0, 64) : null;
    // Dàfùwēng · Monopolio: a kid of this game whose phone dropped around the end (a new socket) gets its slot back and
    // its own board's ceremony + card again, and stays in the room for «Otra ronda»
    // (2026-10-19: never a slot whose name is playing right now on another phone: _slotByName)
    if (g.state === 'ended' && ((g.gameType === 'monopoly' && g.mn) || (g.gameType === 'dormilon' && g.dm) || (g.gameType === 'teamcrab' && g.tc))) {
      const sl = _slotByName(g, name, socket.id, sentCode);
      const ex = sl.entry;
      if (ex) {
        const [oldId, pl] = ex;
        pl.disconnected = false;
        pl.disconnectedAt = null;
        if (pl.cleanupTimer) { clearTimeout(pl.cleanupTimer); pl.cleanupTimer = null; }
        if (oldId !== socket.id) { g.players[socket.id] = pl; delete g.players[oldId]; _tellElsewhere(sl.elsewhereId, pin); }
        currentPin = pin;
        role = 'player';
        socket.join(pin);
        if (socket.data) socket.data.elsewhere = null;
        // (2026-10-19 review: the slot's own code only to that same phone; a classmate typing a dropped kid's name after
        // the end gets the card but never that kid's code)
        const mine = _samePhone(pl, sentCode);
        cb({ ok: true, name: pl.name, team: pl.team, playerId: socket.id, gameType: g.gameType, rejoined: true, gameState: 'ended', studentCode: mine ? pl.studentCode : undefined, guest: !mine });
        io.to(socket.id).emit('state', publicState(g));
        const one = g.gameType === 'dormilon' ? (() => { const e = dmEndPayloads(g); return e.forPlayer(socket.id) || e.guest(); })()
          : g.gameType === 'teamcrab' ? (() => { const e = tcEndPayloads(g); return e.forPlayer(socket.id) || e.guest(); })() : mnEndPayloads(g).forPlayer(socket.id);
        if (one) setTimeout(() => io.to(socket.id).emit('game-end', one), 60);
        return;
      }
    }
    // Vuelo del Dragón: the same (its own race's ceremony + card again)
    if (g.state === 'ended' && g.gameType === 'dragon-eye' && g.dr) {
      const sl = _slotByName(g, name, socket.id, sentCode);
      const ex = sl.entry;
      if (ex) {
        const [oldId, pl] = ex;
        pl.disconnected = false;
        pl.disconnectedAt = null;
        if (pl.cleanupTimer) { clearTimeout(pl.cleanupTimer); pl.cleanupTimer = null; }
        if (oldId !== socket.id) { g.players[socket.id] = pl; delete g.players[oldId]; _tellElsewhere(sl.elsewhereId, pin); }
        currentPin = pin;
        role = 'player';
        socket.join(pin);
        if (socket.data) socket.data.elsewhere = null;
        // (2026-10-19 review: the slot's own code only to that same phone; a classmate typing a dropped kid's name after
        // the end gets the card but never that kid's code)
        const mine = _samePhone(pl, sentCode);
        cb({ ok: true, name: pl.name, team: pl.team, playerId: socket.id, gameType: g.gameType, rejoined: true, gameState: 'ended', studentCode: mine ? pl.studentCode : undefined, guest: !mine });
        io.to(socket.id).emit('state', publicState(g));
        const one = drEndPayloads(g).forPlayer(socket.id);
        if (one) setTimeout(() => io.to(socket.id).emit('game-end', one), 60);
        return;
      }
    }
    // Mochi Mash / Ojos de Halcón: a kid of this game whose phone dropped around the end (a new socket) gets its slot
    // back and its own end card again, and stays in the room for «Otra ronda»
    if (g.state === 'ended' && ((g.gameType === 'mochi-mash' && g.mm) || (g.gameType === 'halcon' && g.halcon) || (g.gameType === 'pinata' && g.pn) || (g.gameType === 'sixseven' && g.ss) || (finGame(g) && g.finEnd))) {
      const sl = _slotByName(g, name, socket.id, sentCode);
      const ex = sl.entry;
      if (ex) {
        const [oldId, pl] = ex;
        pl.disconnected = false;
        pl.disconnectedAt = null;
        if (pl.cleanupTimer) { clearTimeout(pl.cleanupTimer); pl.cleanupTimer = null; }
        if (oldId !== socket.id) { g.players[socket.id] = pl; delete g.players[oldId]; _tellElsewhere(sl.elsewhereId, pin); }
        currentPin = pin;
        role = 'player';
        socket.join(pin);
        if (socket.data) socket.data.elsewhere = null;
        // (2026-10-19 review: the slot's own code only to that same phone; a classmate typing a dropped kid's name after
        // the end gets the card but never that kid's code)
        const mine = _samePhone(pl, sentCode);
        cb({ ok: true, name: pl.name, team: pl.team, playerId: socket.id, gameType: g.gameType, rejoined: true, gameState: 'ended', studentCode: mine ? pl.studentCode : undefined, guest: !mine });
        io.to(socket.id).emit('state', publicState(g));
        const one = finGame(g) ? finAgain(g, g.finEnd.forPlayer(socket.id) || g.finEnd.guest())
          : g.gameType === 'mochi-mash' ? mmEndPayloads(g).forPlayer(socket.id)
          : g.gameType === 'pinata' ? pnEndPayloads(g).forPlayer(socket.id)
          : g.gameType === 'sixseven' ? ssEndPayloads(g).forPlayer(socket.id) : hcEndPayloads(g).forPlayer(socket.id);
        if (one) setTimeout(() => io.to(socket.id).emit('game-end', one), 60);
        return;
      }
    }
    // «Otra ronda» keeps the same PIN: tell the kid to try again, not to wait for a new PIN (class test 2026-10-12)
    if (g.state === 'ended') return cb({ ok: false, error: 'Esta ronda terminó. Cuando tu maestro empiece otra, vuelve a tocar «¡Entrar!».' });
    let cleanName = String(name || '').trim().slice(0, 20);
    if (!cleanName) return cb({ ok: false, error: 'Escribe tu nombre.' });
    const typedName = cleanName;   // (the kid's account keeps the name they typed, never the room's «Fernando 2»)

    // Look for existing player by name (case-insensitive). If found, attach to that slot.
    // 🆕 2026-10-19 (Las Trampillas, his laptop showed an empty game): a name that is playing RIGHT NOW on another
    // connection is never taken from it. Before, the second device (his phone, or a classmate with the same name) moved
    // the slot to itself and the first one stayed in the room with no player: it got the countdown and «active» but never
    // its own game (td:init, questions…) → a dark, empty screen until the PIN was typed again. Now: the same phone again
    // (its saved code: a reload, a second tab) takes its slot back and the old tab is told (`player:elsewhere`); any other
    // device gets a slot of its own with a free name («Fernando 2»). A slot whose connection is gone is a reconnect, as
    // always. Exam rooms keep their old rule (the teacher supervises the tablets).
    const slot = _slotByName(g, cleanName, socket.id, sentCode);
    const existingEntry = slot.entry;
    const elsewhereId = slot.elsewhereId;
    if (slot.taken) cleanName = _freeName(g, cleanName);

    let player;
    let isRejoin = false;
    if (existingEntry) {
      const [oldId, existingPlayer] = existingEntry;
      isRejoin = true;
      player = existingPlayer;
      player.disconnected = false;
      player.disconnectedAt = null;
      // Move slot to new socket id (preserves all state — score, position, team)
      if (oldId !== socket.id) {
        g.players[socket.id] = player;
        delete g.players[oldId];
        // Cancel any pending cleanup timer
        if (player.cleanupTimer) {
          clearTimeout(player.cleanupTimer);
          player.cleanupTimer = null;
        }
        if (elsewhereId === oldId) _tellElsewhere(oldId, pin);
      }
      // Refresh avatar on rejoin so kids can change it across rounds (set below, once the account is known: _gameAvatar)
      g.feed.push({ type: 'rejoin', name: cleanName, team: player.team, t: Date.now() });
    } else {
      // New player — pick smaller team (Mochi Mash: fewer CONNECTED kids, a tie goes to the team that is behind)
      const team = g.gameType === 'mochi-mash' ? Mochi.pickTeam(g.players, g.mm)
        : g.gameType === 'pinata' ? Pinata.pickTeam(g.players, g.pn)
        : g.gameType === 'sixseven' ? Sixseven.pickTeam(g.players, g.ss) : pickTeam(g);
      player = {
        name: cleanName,
        team,
        avatar: '',               // (set below, once the account is known: _gameAvatar)
        score: 0,
        queueIdx: 0,
        mashUntil: 0,
        lastTap: 0,
        recentTaps: [],
        currentQ: null,
        disconnected: false,
        disconnectedAt: null,
        phoneCode: sentCode,      // the code this phone sent (its own, even when the room plays it as a guest): «the same phone»
        acctName: typedName,      // the name the kid typed (its account's), even when the room calls it «Fernando 2»
      };
      g.players[socket.id] = player;
      g.feed.push({ type: 'join', name: cleanName, team: player.team, t: Date.now() });
    }

    // === STUDENT CODE === Identify this player across sessions. If the
    // client sent a known code, link to that record. Otherwise generate
    // a fresh code. The code lives in the kid's localStorage so the
    // same phone = same record = same sentence history forever.
    // 🔒 2026-10-18 (ownership): an EXISTING account is linked (its name updated, the game's results saved on it) only
    // when this phone proves it is that kid's (_joinOwns); a typed classmate's code makes a fresh account instead
    const known = studentCode ? Students.peek(studentCode) : null;
    // An exam room (hsksim) is the teacher's own class, often on school tablets with no proof: the typed code still links
    // (the teacher sees the roster), but an unproven join never renames that account
    const proven = !known || _joinOwns(socket, known.rec, accessCode);
    const guestLink = !proven && g.gameType !== 'hsksim';
    const studentRec = Students.getOrCreate(guestLink ? null : studentCode, proven || guestLink ? ((isRejoin && player.acctName) || typedName) : '');
    _entradaPinTag(socket, g, studentRec);   // 🆕 2026-10-18 (la entrada): a key account joins its teacher's class here
    player.studentCode = studentRec.code;
    player.guestLink = guestLink;   // the phone keeps its own saved code (player.js never overwrites it with this one)
    // 🪙 2026-10-19 El Zoco: the character this kid plays as (a skin only when the account this phone PROVED owns it).
    // A slot pays its game only to the account it was made for (security review: someone typing a dropped kid's name
    // takes the slot back, but never its coins)
    if (!isRejoin || !player.zocoCode) player.zocoCode = studentRec.code;
    player.zocoOk = proven && !guestLink && player.zocoCode === studentRec.code;
    const nextAv = _gameAvatar(avatar, studentRec, player.zocoOk);
    if (nextAv || !isRejoin) player.avatar = nextAv;
    if (g.gameType === 'monopoly') mnEnsureId(g, player);     // the projector knows every kid (k + character) from the lobby
    if (g.gameType === 'dragon-eye') drEnsureId(g, player);
    if (g.gameType === 'mochi-mash') mmEnsureId(g, player);   // the projector knows every kid (k + character) from the lobby
    if (g.gameType === 'pinata') pnEnsureId(g, player);
    if (g.gameType === 'sixseven') ssEnsureId(g, player);

    currentPin = pin;
    role = 'player';
    socket.join(pin);
    if (socket.data) socket.data.elsewhere = null;

    cb({
      ok: true,
      name: player.name,            // (a second device with a name already playing: «Fernando 2», the phone shows it)
      team: player.team,
      playerId: socket.id,
      gameType: g.gameType,
      rejoined: isRejoin,
      gameState: g.state,
      studentCode: player.studentCode,
      guest: !!player.guestLink,
      // 🪙 2026-10-19: the character the room uses for this kid, and the skins of El Zoco this kid owns (the lobby's
      // picker shows them first), only to the phone that proved the account
      avatar: player.avatar,
      skins: player.zocoOk && studentRec.zoco && Array.isArray(studentRec.zoco.own) ? studentRec.zoco.own.filter((id) => Saga.zoco(id)) : [],
      // 🔒 2026-10-15: an exam room's pass (this kid is now on the teacher's roster): the room's sim loads with it
      roomPass: g.gameType === 'hsksim' && g.hsk && g.hsk.simId ? SimLock.roomPass(String(pin), g.hsk.simId, (HSK_ROOMS.get(String(pin)) || {}).createdAt) : undefined,
    });
    broadcast(pin);

    // Ojos de Halcón during the countdown: a kid who was dealt in and reloads gets the run-in of their board again
    // (a new kid sits down when the game starts, hcStart).
    if (g.state === 'countdown' && g.gameType === 'halcon' && g.halcon && Halcon.inGame(g.halcon, player)) {
      io.to(socket.id).emit('hc:init', hcInitPayload(g, socket.id));
    }
    // ¡No despiertes a Dralingo! during the countdown: a dealt kid who reloads gets its board again (a new kid sits down
    // when the intro starts, dmStart)
    if (g.state === 'countdown' && g.gameType === 'dormilon' && g.dm && Dorm.inGame(g.dm, player.dmK)) {
      dmJoinRoom(pin, g, socket.id, player);
      io.to(socket.id).emit('dm:init', dmInitPayload(g, socket.id));
    }
    // ¡Atrapa a Fénec! during the countdown: the same (a new kid sits down when the intro starts, tcStart)
    if (g.state === 'countdown' && g.gameType === 'teamcrab' && g.tc && Crab.inGame(g.tc, player.tcK)) {
      tcJoinRoom(pin, g, socket.id, player);
      io.to(socket.id).emit('tc:init', tcInitPayload(g, socket.id));
    }
    // Dàfùwēng · Monopolio during the countdown: a dealt kid who reloads gets its board's run-in again (a new kid sits
    // down when the intro starts, mnStart)
    if (g.state === 'countdown' && g.gameType === 'monopoly' && g.mn && Mono.inGame(g.mn, player.mnK)) {
      mnJoinRoom(pin, g, socket.id, player);
      io.to(socket.id).emit('mn:init', mnInitPayload(g, socket.id));
    }
    // Vuelo del Dragón during the countdown: the same (its race's run-in again; a new kid flies in at drStart)
    if (g.state === 'countdown' && g.gameType === 'dragon-eye' && g.dr && Dragon.inGame(g.dr, player.drK)) {
      Dragon.setAway(g.dr, player.drK, false);
      drJoinRoom(pin, g, socket.id, player);
      io.to(socket.id).emit('dr:init', drInitPayload(g, socket.id));
    }
    // If joining/rejoining mid-game, sync them up
    if (g.state === 'active') {
      // Reinos / Pintores / Nieve / La Gran Fuga during «¡FINAL!»: that card, then the ceremony (game-end) like everyone
      if (finGame(g) && g.finalizing) {
        io.to(socket.id).emit('fin:final', { ms: finFinalLeft(g), why: g.finalizing.why, game: g.gameType });
        return;
      }
      // … and in the last 30 s, the phone learns it (a moment later: its skin switches on with the room's state first)
      if (finGame(g) && g.finFrenzy && g.endsAt && !finPaused(g)) {
        const sid = socket.id;
        setTimeout(() => { if (games[pin] === g && g.finFrenzy && !g.finalizing && !finPaused(g)) io.to(sid).emit('fin:frenzy', { game: g.gameType, endsMs: Math.max(0, g.endsAt - Date.now()) }); }, 400);
      }
      // === READING: send the current page + audio play state so the
      // late-joining student lands on the correct page with audio in sync. ===
      if (g.gameType === 'reading' && g.reading) {
        io.to(socket.id).emit('rd:state', readingBuildStateMsg(g));
      }
      // === WARM-UP: send the current sentence + view mode + curious flag
      // to the joining socket so they immediately see the teacher's
      // current state (instead of a stale game screen from before). ===
      if (g.gameType === 'warmup' && g.warmup) {
        // LIVE-MASTER auto-delegate: in a session the teacher launched from
        // /maestro, every kid who is force-joined becomes an asistente
        // automatically — no manual 👑 tap needed. "Everybody becomes
        // assistant" (user 2026-05-28).
        if (g.warmup.autoDelegateAll && player && player.name) {
          if (!g.warmup.delegates) g.warmup.delegates = new Set();
          g.warmup.delegates.add(player.name);
          // Broadcast to the whole room so the host roster + every phone
          // reflects the new asistente immediately.
          io.to(pin).emit('wu:state', {
            sentence: g.warmup.sentence || [],
            viewMode: g.warmup.viewMode || 'text',
            curious: !!g.warmup.curious,
            delegates: Array.from(g.warmup.delegates || []),
            judges: Array.from(g.warmup.judges || []),
            frozen: !!g.warmup.frozen,
            prompt: g.warmup.prompt || '',
            visibleExps: g.warmup.visibleExps || null,
            customWords: g.warmup.customWords || [],
          });
        }
        io.to(socket.id).emit('wu:state', {
          sentence: g.warmup.sentence || [],
          viewMode: g.warmup.viewMode || 'text',
          curious: !!g.warmup.curious,
          delegates: Array.from(g.warmup.delegates || []),
          judges: Array.from(g.warmup.judges || []),
          frozen: !!g.warmup.frozen,
          prompt: g.warmup.prompt || '',
          visibleExps: g.warmup.visibleExps || null,
          customWords: g.warmup.customWords || [],
        });
        // 🖼 Late-joiner sees whatever picture is currently being
        // described to the class, + any active dancing-GIF overlay.
        if (g.wuImage) io.to(socket.id).emit('wu:image', { url: g.wuImage });
        if (g.wuAnim) {
          Object.keys(g.wuAnim).forEach((id) => io.to(socket.id).emit('wu:anim', { id, on: true }));
        }
      }
      // ¡No despiertes a Dralingo!: a late joiner sits at the smallest board (max 5, last in its turn order); a rejoin
      // keeps its seat, points and an open question (dm:init carries it with the time left). Never a generic question.
      if (g.gameType === 'dormilon' && g.dm) { dmAttach(pin, g, socket.id, player); return; }
      // ¡Atrapa a Fénec!: a late joiner sits at the smallest board (its hammer joins the crab); a rejoin keeps its seat, words
      // and an open question (tc:init carries it with the time left). Never a generic question.
      if (g.gameType === 'teamcrab' && g.tc) { tcAttach(pin, g, socket.id, player); return; }
      // Dàfùwēng · Monopolio: a late joiner sits at the smallest board (max 5) and plays from now; a rejoin keeps its seat,
      // piece, coins, stars, an open dice window and a turn still playing (mn:init carries them). Its open question comes
      // back; the room's tick deals every new one (never in the intro, a pause or «¡FINAL!»).
      if (g.gameType === 'monopoly' && g.mn) {
        mnEnsureId(g, player);
        if (!Mono.inGame(g.mn, player.mnK)) mnSeatLate(pin, g, socket.id, player);
        else mnJoinRoom(pin, g, socket.id, player);
        io.to(socket.id).emit('mn:init', mnInitPayload(g, socket.id));
        if (g.mn.phase === 'play' && player.currentQ) io.to(socket.id).emit('question', { qid: player.currentQ.qid, text: player.currentQ.text, answers: player.currentQ.answers, image: player.currentQ.image });
        else if (g.mn.phase !== 'play') player.currentQ = null;
        return;
      }
      // Vuelo del Dragón: a late joiner flies in the smallest race (max 5, level with its last dragon); a rejoin keeps its
      // seat, metres, stars and an open flight (dr:init carries it with the time left). Its open question comes back; the
      // room's tick deals every new one (never in the intro, a pause or «¡FINAL!»).
      if (g.gameType === 'dragon-eye' && g.dr) {
        drEnsureId(g, player);
        if (!Dragon.inGame(g.dr, player.drK)) drSeatLate(pin, g, socket.id, player);
        else { Dragon.setAway(g.dr, player.drK, false); drJoinRoom(pin, g, socket.id, player); }
        io.to(socket.id).emit('dr:init', drInitPayload(g, socket.id));
        if (g.dr.phase === 'play' && player.currentQ) io.to(socket.id).emit('question', { qid: player.currentQ.qid, text: player.currentQ.text, answers: player.currentQ.answers, image: player.currentQ.image });
        else if (g.dr.phase !== 'play') player.currentQ = null;
        return;
      }
      if (g.gameType === 'paint' && g.paint) {
        const fresh = !pcHas(g, player);
        if (fresh) pcFresh(g, player);
        pcStaleQ(player);
        io.to(socket.id).emit('pc:init', pcInitPayload(g, socket.id));
        io.to(pin).emit('pc:roster', pcRoster(g));
        if (player.currentQ) io.to(socket.id).emit('question', { qid: player.currentQ.qid, text: player.currentQ.text, answers: player.currentQ.answers, image: player.currentQ.image });
        return;
      }
      // Las Trampillas: a late joiner rises at the next round; a rejoin keeps everything (on the floor / in the pit, wings)
      // and gets its open question again; the room's tick deals every new one
      if (g.gameType === 'trapdoor' && g.td) {
        tdAttach(g, player);
        if (player.currentQ && player.lastQuestionAt && Date.now() - player.lastQuestionAt > 20000) { player.currentQ = null; player.tdQKind = null; }
        player.tdMeKey = '';
        io.to(socket.id).emit('td:init', tdInitPayload(g, socket.id));
        io.to(pin).emit('td:roster', tdRoster(g));
        if (player.currentQ) io.to(socket.id).emit('question', { qid: player.currentQ.qid, text: player.currentQ.text, answers: player.currentQ.answers, image: player.currentQ.image, td: player.tdQKind || 'wings' });
        return;
      }
      // Batalla de Nieve: a late joiner walks in as a survivor with a 10 s shield; a rejoin keeps everything.
      if (g.gameType === 'snow' && g.snow) {
        snAttach(g, socket.id, player, true);
        io.to(socket.id).emit('sn:init', snInitPayload(g, socket.id));
        io.to(pin).emit('sn:roster', { players: snRoster(g), counts: Snow.counts(g.players) });
        if (player.currentQ) io.to(socket.id).emit('question', { qid: player.currentQ.qid, text: player.currentQ.text, answers: player.currentQ.answers, image: player.currentQ.image });
        return;
      }
      // La Gran Fuga: a late joiner runs with the crew (or appears in the zona segura room); a rejoin keeps everything.
      if (g.gameType === 'escape' && g.escape) {
        esAttach(g, socket.id, player);
        io.to(socket.id).emit('es:init', esInitPayload(g, socket.id));
        io.to(pin).emit('es:roster', { players: esRoster(g) });
        if (g.escape.phase !== 'run') { player.currentQ = null; return; }
      if (g.escape.paused) {            // paused: the open question comes back, a new one waits for «Seguir»
        if (player.currentQ) io.to(socket.id).emit('question', { qid: player.currentQ.qid, text: player.currentQ.text, answers: player.currentQ.answers, image: player.currentQ.image });
        return;
      }
      }
      // Ojos de Halcón: a late joiner sits at the smallest board (max 5) and plays from this round; a rejoin keeps the
      // seat, the board and the look.
      if (g.gameType === 'halcon' && g.halcon) {
        hcSeatLate(pin, g, socket.id, player);
        player.currentQ = null;
        io.to(socket.id).emit('hc:init', hcInitPayload(g, socket.id));
        return;
      }
      // Mochi Mash: a late joiner feeds from now (fresh stats), a rejoin keeps its mochis; a reload in the middle of a
      // mash window ends that window (its taps already count). Questions only while the game is in play.
      if (g.gameType === 'mochi-mash' && g.mm) {
        mmEnsureId(g, player);
        Mochi.join(g.mm, player);
        if (player.mmMash) mmClose(g, socket.id, player, Date.now());
        io.to(socket.id).emit('mm:init', mmInitPayload(g, socket.id));
        mmRescale(pin, g);
        if (g.mm.phase !== 'play') { player.currentQ = null; return; }
        if (g.mm.paused) {             // paused: the open question comes back, a new one waits for «Seguir»
          if (player.currentQ) io.to(socket.id).emit('question', { qid: player.currentQ.qid, text: player.currentQ.text, answers: player.currentQ.answers, image: player.currentQ.image });
          return;
        }
        if (!player.currentQ && player.mmNextQAt) return;   // the «¡Casi!» wait or a window summary: the tick deals it
      }
      // Piñata Tigre: a late joiner hits from now (fresh stats), a rejoin keeps its candies. A swing that was open when
      // the phone dropped stays open until its window ends (a Wi-Fi blip: the phone re-sends its tap after the rejoin);
      // past that, it is an automatic hit (the right answer is never lost). Questions only while the game is in play.
      if (g.gameType === 'pinata' && g.pn) {
        pnEnsureId(g, player);
        Pinata.join(g.pn, player);
        if (player.pnSwing && !g.pn.paused && Date.now() >= Pinata.cutAt(g.pn, player.pnSwing)) pnApplyHit(pin, g, socket.id, player, null, null, true, Date.now());
        io.to(socket.id).emit('pn:init', pnInitPayload(g, socket.id));
        pnRescale(pin, g);
        if (g.pn.phase !== 'play') { player.currentQ = null; return; }
        if (g.pn.paused) {             // paused: the open question comes back, a new one waits for «Seguir»
          if (player.currentQ) io.to(socket.id).emit('question', { qid: player.currentQ.qid, text: player.currentQ.text, answers: player.currentQ.answers, image: player.currentQ.image });
          return;
        }
        if (!player.currentQ && (player.pnNextQAt || player.pnSwing)) return;   // the result / «¡Casi!» wait: the tick deals it
      }
      // 6-7 Swing: a late joiner plays from now (fresh stats), a rejoin keeps its gold and gets its open sum again; the
      // room tick deals every new sum (never in the intro, a pause or «¡FINAL!»).
      if (g.gameType === 'sixseven' && g.ss) {
        ssEnsureId(g, player);
        Sixseven.join(g.ss, player);
        player.currentQ = null;
        io.to(socket.id).emit('ss:init', ssInitPayload(g, socket.id));
        ssRescale(pin, g);
        if (g.ss.phase === 'play') ssResend(g, socket.id, player);
        return;
      }
      if (g.gameType === 'kingdoms' && g.kingdoms) {
        io.to(socket.id).emit('kd:init', kdInitPayload(g, false));
        if (player.kdPending) { kdPrompt(pin, socket.id, { reprompt: true }); return; }
      }
      // Send an active question (preserve their currentQ if rejoining)
      if (player.currentQ) {
        io.to(socket.id).emit('question', {
          qid: player.currentQ.qid,
          text: player.currentQ.text,
          answers: player.currentQ.answers,
          image: player.currentQ.image
        });
      } else {
        const q = nextQuestionFor(g, socket.id);
        if (q) io.to(socket.id).emit('question', q);
      }
    }
  });

  socket.on('player:answer', ({ pin, qid, choiceIdx }, ack) => {
    // Immediate ack so the client knows the server received the tap. If transport
    // is flaky, the client uses this to decide whether to retry the emit.
    if (typeof ack === 'function') ack({ ok: true });
    const g = games[pin];
    if (!g || g.state !== 'active') return;
    const p = g.players[socket.id];
    if (!p) return;
    // 6-7 Swing v2: its own judge (core/sixseven.js answer) and its own open sum (p.ssQ), never p.currentQ
    if (g.gameType === 'sixseven' && g.ss) { ssAnswer(pin, g, socket, p, choiceIdx, qid); return; }
    // «¡FINAL!» (Reinos, Pintores, Nieve, La Gran Fuga): the round is over, the answer comes back unused
    if (g.finalizing) { io.to(socket.id).emit('answer-stale', { reason: 'final' }); return; }
    // If the player has no open question at all → tell the client so they can recover
    // (otherwise their answer buttons stay disabled forever — the "frozen" bug).
    if (!p.currentQ) {
      io.to(socket.id).emit('answer-stale', { reason: 'no-question' });
      return;
    }
    // Tolerant qid matching: a brief reconnect or socket churn can leave the
    // client holding an older qid than the server's freshly-assigned one. We
    // accept the answer using the SERVER's currentQ.qid as ground truth as
    // long as a question exists. (qid is informational, not security.)
    // Las Trampillas deals the next question right after an answer: a late tap meant for the old one is never judged
    // against the new one (the phone keeps the new question's tiles)
    if (g.gameType === 'trapdoor' && qid != null && p.currentQ.qid != null && qid !== p.currentQ.qid) {
      io.to(socket.id).emit('answer-stale', { reason: 'old-question' });
      return;
    }
    const cqData = p.currentQ;
    const correct = cqData.correctIdx === choiceIdx;
    const correctText = cqData.answers[cqData.correctIdx];
    p.currentQ = null;

    if (g.gameType === 'dragon-eye' && g.dr) {
      // Vuelo del Dragón v2: paused or not in play → the question stays open (the phone gets its buttons back)
      if (g.dr.paused || g.dr.phase !== 'play') {
        if (g.dr.phase === 'play') p.currentQ = cqData;
        io.to(socket.id).emit('answer-stale', { reason: g.dr.paused ? 'paused' : 'not-playing' });
        return;
      }
      drAnswer(pin, g, socket.id, p, correct, correctText, choiceIdx === -1);   // -1 = the phone's own clock ran out
    } else if (g.gameType === 'monopoly' && g.mn) {
      // Dàfùwēng · Monopolio v2: paused or not in play → the question stays open (the phone gets its buttons back)
      if (g.mn.paused || g.mn.phase !== 'play') {
        if (g.mn.phase === 'play') p.currentQ = cqData;
        io.to(socket.id).emit('answer-stale', { reason: g.mn.paused ? 'paused' : 'not-playing' });
        return;
      }
      mnAnswer(pin, g, socket.id, p, correct, correctText, choiceIdx === -1);   // -1 = the phone's own clock ran out
    } else if (g.gameType === 'pinata' && g.pn) {
      // Piñata Tigre v2: paused or not in play → the question stays open (the phone gets its buttons back)
      if (g.pn.paused || g.pn.phase !== 'play') {
        if (g.pn.phase === 'play') p.currentQ = cqData;
        io.to(socket.id).emit('answer-stale', { reason: g.pn.paused ? 'paused' : 'not-playing' });
        return;
      }
      pnAnswer(pin, g, socket, p, correct, correctText);
    } else if (g.gameType === 'paint') {
      if (g.paint && g.paint.paused) { p.currentQ = cqData; io.to(socket.id).emit('answer-stale', { reason: 'paused' }); return; }
      pcAnswer(pin, g, socket.id, p, correct, correctText, choiceIdx === -1 ? 'timeup' : '');   // -1 = the phone's own 20 s ran out
    } else if (g.gameType === 'trapdoor') {
      // Las Trampillas: paused → the question stays open (the phone gets its tiles back)
      if (!g.td || g.td.paused) { if (g.td) p.currentQ = cqData; io.to(socket.id).emit('answer-stale', { reason: g.td ? 'paused' : 'not-playing' }); return; }
      tdAnswer(pin, g, socket.id, p, correct, correctText, choiceIdx === -1 ? 'timeup' : '');   // -1 = the phone's own 20 s ran out
    } else if (g.gameType === 'snow') {
      snAnswer(pin, g, socket.id, p, correct, correctText);
    } else if (g.gameType === 'escape') {
      // the chase pass: stunned = my tiles are locked; an answer in flight when the zap lands is not judged (no dash
      // over the zap): the question stays mine and the phone gets its tiles back once the lock ends
      if (g.escape && g.escape.phase === 'run' && Date.now() < (p.esStunUntil || 0)) {
        p.currentQ = cqData;
        io.to(socket.id).emit('answer-stale', { reason: 'stunned', ms: p.esStunUntil - Date.now() });
        return;
      }
      esAnswer(pin, g, socket.id, p, correct, correctText);
    } else if (g.gameType === 'kingdoms') {
      // Reinos de Colores: right answer = a flag to plant (3 in a row = 2 flags). The next question waits
      // until the flag is planted (kid taps a tile, or the server auto-plants after KD_PLANT_MS).
      if (g.kingdoms && g.kingdoms.paused) { p.currentQ = cqData; io.to(socket.id).emit('answer-stale', { reason: 'paused' }); return; }
      p.kdAnswered = (p.kdAnswered || 0) + 1;
      if (correct) {
        p.kdStreak = (p.kdStreak || 0) + 1;
        p.kdCorrect = (p.kdCorrect || 0) + 1;
        p.kdBest = Math.max(p.kdBest || 0, p.kdStreak);
        if (g.kingdoms) {
          p.kdFlags = Kingdoms.flagsFor(p.kdStreak, !!g.finFrenzy);     // 3 in a row = 2 flags; the last 30 s: twice the flags
          kdPrompt(pin, socket.id, { correctText });
        } else {
          io.to(socket.id).emit('answer-result', { correct: true, correctText });
          setTimeout(() => { const q = games[pin] && nextQuestionFor(g, socket.id); if (q) io.to(socket.id).emit('question', q); }, 1400);
        }
      } else {
        p.kdStreak = 0;
        io.to(socket.id).emit('answer-result', { correct: false, correctText });
      }
    } else if (g.gameType === 'mochi-mash' && g.mm) {
      // Mochi Mash v2: paused or not in play → the question stays open (the phone gets its buttons back)
      if (g.mm.paused || g.mm.phase !== 'play') {
        if (g.mm.phase === 'play') p.currentQ = cqData;
        io.to(socket.id).emit('answer-stale', { reason: g.mm.paused ? 'paused' : 'not-playing' });
        return;
      }
      mmAnswer(pin, g, socket.id, p, correct, correctText);
    } else {
      // Mochi Mash (legacy path, a room without the v2 game object)
      if (correct) {
        p.mashUntil = Date.now() + MASH_DURATION_MS;
        io.to(socket.id).emit('answer-result', {
          correct: true,
          mashUntil: p.mashUntil,
          correctText
        });
      } else {
        const enemy = p.team === 'red' ? 'gold' : 'red';
        g.teamScores[enemy] += WRONG_PENALTY;
        io.to(socket.id).emit('answer-result', { correct: false, correctText });
        io.to(pin).emit('score-update', { teamScores: g.teamScores });
      }
    }

    let nextDelay;
    if (g.gameType === 'pinata' && g.pn) {
      nextDelay = -1;                       // the room's tick deals the next one (after the hit or the «¡Casi!» wait)
    } else if (g.gameType === 'dragon-eye') {
      nextDelay = -1;                       // Vuelo del Dragón v2: the room's tick deals the next one (after the flight or the «¡Casi!» wait)
    } else if (g.gameType === 'monopoly') {
      nextDelay = -1;                       // Monopolio v2: the room's tick deals the next one (after the turn or the «¡Casi!» wait)
    } else if (g.gameType === 'kingdoms') {
      nextDelay = correct ? -1 : 1400;
    } else if (g.gameType === 'paint' || g.gameType === 'snow') {
      nextDelay = -1;                       // back to flying / walking; the kid asks for the next question
    } else if (g.gameType === 'trapdoor') {
      nextDelay = -1;                       // Las Trampillas: the room's tick deals the next one (when it gives something)
    } else if (g.gameType === 'escape') {
      nextDelay = -1;                       // esAnswer deals the next one, only while the crew is running
    } else if (g.gameType === 'mochi-mash' && g.mm) {
      nextDelay = -1;                       // the room's tick deals the next one (after the mash window or the «¡Casi!» wait)
    } else {
      nextDelay = correct ? MASH_DURATION_MS + 600 : 1400;
    }
    if (nextDelay >= 0) {
      setTimeout(() => {
        if (!games[pin] || games[pin].state !== 'active') return;
        if (g.gameType === 'mochi-mash' && g.mm && g.mm.phase !== 'play') return;   // «¡FINAL!»: no more questions
        const q = nextQuestionFor(g, socket.id);
        if (q) io.to(socket.id).emit('question', q);
      }, nextDelay);
    }
    // Reinos de Colores sends its own small kd:plant diffs; skipping the full-room 'state' push here
    // keeps 30 phones from receiving ~5 full state objects per second.
    if (g.gameType !== 'kingdoms' && g.gameType !== 'paint' && g.gameType !== 'snow' && g.gameType !== 'escape' && g.gameType !== 'mochi-mash' && g.gameType !== 'pinata' && g.gameType !== 'monopoly' && g.gameType !== 'dragon-eye' && g.gameType !== 'trapdoor') broadcast(pin);
  });

  // Las Trampillas: a tap on the floor = where my character should run (an intent: the server clamps it onto the floor,
  // takes at most Trap.R.GO_RATE a second, and moves the character itself; nobody runs into the hub or an open hole)
  socket.on('player:td-go', (data) => {
    try {
      const { pin, x, y } = data || {};
      const g = games[pin];
      if (!g || g.gameType !== 'trapdoor' || !g.td || g.state !== 'active' || g.td.paused || g.finalizing) return;
      if (typeof x !== 'number' || typeof y !== 'number') return;
      const p = g.players[socket.id];
      if (!p || !p.tdK) return;
      const now = Date.now();
      const r = p.tdGo || (p.tdGo = { t: 0, n: 0 });
      if (now - r.t >= 1000) { r.t = now; r.n = 0; }
      if (++r.n > Trap.R.GO_RATE) return;
      Trap.go(g.td, p.tdK, x, y);
    } catch (e) { console.error('[player:td-go]', e); }
  });

  // Dragones Pintores v2: a tap on the sky = where my dragon should fly (an intent: the server clamps it, takes at most
  // Paint.R.GO_RATE a second, and flies the dragon itself), and «Recargar» (ask for a question).
  socket.on('player:pc-go', (data) => {
    try {
      const { pin, x, y } = data || {};
      const g = games[pin];
      if (!g || g.gameType !== 'paint' || !g.paint || g.state !== 'active' || g.paint.paused) return;
      if (g.finalizing && Date.now() - g.finalizing.at > Party.GRACE_MS) return;    // «¡FINAL!»: only taps already on their way count
      if (typeof x !== 'number' || typeof y !== 'number') return;
      const p = g.players[socket.id];
      if (!p || !pcHas(g, p)) return;
      const now = Date.now();
      const r = p.pcGo || (p.pcGo = { t: 0, n: 0 });
      if (now - r.t >= 1000) { r.t = now; r.n = 0; }
      if (++r.n > Paint.R.GO_RATE) return;
      const t = Paint.clampTarget(g.paint.sky, x, y);
      if (!t) return;
      p.pcD.tx = t[0];
      p.pcD.ty = t[1];
    } catch (e) { console.error('[player:pc-go]', e); }
  });
  socket.on('player:pc-ask', (data) => {
    try {
      const { pin } = data || {};
      const g = games[pin];
      if (!g || g.gameType !== 'paint' || g.state !== 'active' || g.finalizing || (g.paint && g.paint.paused)) return;
      const p = g.players[socket.id];
      if (!p) return;
      if (p.currentQ) {
        io.to(socket.id).emit('question', { qid: p.currentQ.qid, text: p.currentQ.text, answers: p.currentQ.answers, image: p.currentQ.image });
        return;
      }
      if (!pcHas(g, p)) return;
      p.pcWantQ = true;                 // the room's tick deals it (at once, or after a «¡Casi!» wait)
    } catch (e) { console.error('[player:pc-ask]', e); }
  });

  // Batalla de Nieve: position (8 Hz from each phone), snowballs, stations, pearls/dates, the ❄️ chest.
  const snGame = (data) => {
    const g = games[data && data.pin];
    if (!g || g.gameType !== 'snow' || !g.snow || g.state !== 'active' || g.finalizing) return null;   // «¡FINAL!»: the map stands still
    const p = g.players[socket.id];
    if (!p || p.snRound !== g.snow.id) return null;
    if (p.snPid !== socket.id) snAttach(g, socket.id, p, false);   // a reconnected socket that hasn't re-joined yet
    return { g, p, k: g.snow };
  };
  socket.on('player:sn-pos', (data) => {
    try {
      const c = snGame(data);
      if (!c) return;
      const { g, p, k } = c;
      const now = Date.now();
      const x = Number(data.x), y = Number(data.y);
      const chk = Snow.checkPos(k, p, socket.id, x, y, now);
      const pos = k.pos[socket.id];
      if (!chk.ok) {
        // too fast / inside a wall / frozen: the phone snaps back (at most twice a second, never a storm)
        if (now - (p.snCorrAt || 0) > 500 && now >= (p.snRespawnUntil || 0)) { p.snCorrAt = now; snSendMe(g, socket.id, { pos: [chk.x, chk.y] }); }
        return;
      }
      pos.x = x; pos.y = y; pos.at = now;
      const f = Number(data.f);
      if (Number.isInteger(f) && f >= 0 && f < 8) pos.f = f;
      k.posDirty = true;
    } catch (e) { console.error('[player:sn-pos]', e); }
  });
  socket.on('player:sn-throw', (data) => {
    try {
      const c = snGame(data);
      if (!c) return;
      const { g, p, k } = c;
      const r = Snow.throwBall(k, p, socket.id, Number(data.dx), Number(data.dy), Date.now());
      if (r.error) { io.to(socket.id).emit('sn:refused', { what: 'throw', why: r.error, copos: p.snCopos }); return; }
      const b = r.ball;
      io.to(data.pin).emit('sn:ball', {
        id: b.id, by: p.snIdx, side: b.side, x: Math.round(b.x), y: Math.round(b.y), dx: b.dx, dy: b.dy, range: b.left, speed: Snow.R.BALL_SPEED,
      });
      snSendMe(g, socket.id);
    } catch (e) { console.error('[player:sn-throw]', e); }
  });
  socket.on('player:sn-ask', (data) => {
    try {
      const c = snGame(data);
      if (!c) return;
      const { g, p, k } = c;
      const now = Date.now();
      if (k.paused || now < (p.snRespawnUntil || 0)) { io.to(socket.id).emit('sn:refused', { what: 'station', why: 'busy' }); return; }
      if (!Snow.nearStation(k, socket.id, Number(data.station))) { io.to(socket.id).emit('sn:refused', { what: 'station', why: 'far' }); return; }
      if (p.currentQ) {
        io.to(socket.id).emit('question', { qid: p.currentQ.qid, text: p.currentQ.text, answers: p.currentQ.answers, image: p.currentQ.image });
        return;
      }
      const q = nextQuestionFor(g, socket.id);
      if (q) io.to(socket.id).emit('question', q);
      else io.to(socket.id).emit('sn:refused', { what: 'station', why: 'noq' });
    } catch (e) { console.error('[player:sn-ask]', e); }
  });
  socket.on('player:sn-job', (data) => {
    try {
      const c = snGame(data);
      if (!c) return;
      const { g, p, k } = c;
      const r = Snow.doJob(k, p, socket.id, Number(data.job), Date.now());
      if (r.error) { io.to(socket.id).emit('sn:refused', { what: 'job', why: r.error, waitMs: r.waitMs || 0 }); return; }
      snSendMe(g, socket.id, { job: { kind: r.kind, gained: r.gained } });
      io.to(g.hostId).emit('sn:fx', { type: 'job', idx: p.snIdx, kind: r.kind });
    } catch (e) { console.error('[player:sn-job]', e); }
  });
  socket.on('player:sn-grab', (data) => {
    try {
      const c = snGame(data);
      if (!c) return;
      const { g, p, k } = c;
      const now = Date.now();
      const r = Snow.grabChest(k, p, socket.id, Number(data.chest), now);
      if (r.error) return;
      k.nextChestAt = now + Snow.nextChestGap();
      io.to(data.pin).emit('sn:chest', { id: null, taken: r.chest.id, by: p.snIdx, name: p.name, zone: r.chest.zone, x: r.chest.x, y: r.chest.y });
      snSendMe(g, socket.id, { chest: { gained: r.gained } });
    } catch (e) { console.error('[player:sn-grab]', e); }
  });
  // La Gran Fuga: the kid's position in the zona segura room (8 Hz while walking, 1/s standing still).
  socket.on('player:es-pos', (data) => {
    try {
      const g = games[data && data.pin];
      if (!g || g.gameType !== 'escape' || !g.escape || g.state !== 'active' || g.finalizing) return;
      const k = g.escape;
      const p = g.players[socket.id];
      if (!p || p.esRound !== k.id || k.phase !== 'zone' || !k.room) return;
      if (p.esPid !== socket.id) esAttach(g, socket.id, p);       // a reconnected socket that hasn't re-joined yet
      const now = Date.now();
      const x = Number(data.x), y = Number(data.y);
      const chk = Escape.checkPos(k, p, socket.id, x, y, now);
      if (!chk.ok) {
        // too fast / inside a wall / dizzy: the phone snaps back (at most twice a second)
        if (chk.x !== undefined && now - (p.esCorrAt || 0) > 500) { p.esCorrAt = now; esSendMe(g, socket.id, { pos: [chk.x, chk.y] }); }
        else if (chk.unknown && !k.pos[socket.id]) { const s = Escape.spawnPos(k, p.esIdx); k.pos[socket.id] = { x: s.x, y: s.y, f: 2, at: now }; esSendMe(g, socket.id, { pos: [s.x, s.y] }); }
        if (k.pos[socket.id]) k.pos[socket.id].at = now;            // the phone is here (not «away»), just refused
        return;
      }
      const pos = k.pos[socket.id] || (k.pos[socket.id] = { x, y, f: 2, at: now });
      pos.x = x; pos.y = y; pos.at = now;
      const f = Number(data.f);
      if (Number.isInteger(f) && f >= 0 && f < 8) pos.f = f;
    } catch (e) { console.error('[player:es-pos]', e); }
  });
  // Teacher «Pausa» (Batalla de Nieve, La Gran Fuga; other games can opt in the same way).
  // Teacher «⏭ Saltar zona» (La Gran Fuga): the zona segura ends now, nobody loses a heart for the wave in play.
  socket.on('host:es-skip', (data) => {
    try {
      const g = games[data && data.pin];
      if (!g || g.hostId !== socket.id || g.state !== 'active' || g.gameType !== 'escape' || !g.escape || g.escape.paused || g.finalizing) return;
      if (Escape.skipZone(g.escape, Date.now())) io.to(data.pin).emit('es:moment', { type: 'skip' });
    } catch (e) { console.error('[host:es-skip]', e); }
  });
  socket.on('host:pause', (data) => {
    try {
      const { pin, paused } = data || {};
      const g = games[pin];
      if (!g || g.hostId !== socket.id || g.state !== 'active' || g.finalizing) return;
      if (g.gameType === 'kingdoms') kdPause(pin, g, !!paused);
      if (g.gameType === 'paint') pcPause(pin, g, !!paused);
      if (g.gameType === 'trapdoor') tdPause(pin, g, !!paused);
      if (g.gameType === 'snow') snPause(pin, g, !!paused);
      if (g.gameType === 'escape') esPause(pin, g, !!paused);
      if (g.gameType === 'halcon') hcPause(pin, g, !!paused);
      if (g.gameType === 'monopoly') mnPause(pin, g, !!paused);
      if (g.gameType === 'dormilon') dmPause(pin, g, !!paused);
      if (g.gameType === 'teamcrab') tcPause(pin, g, !!paused);
      if (g.gameType === 'dragon-eye') drPause(pin, g, !!paused);
      if (g.gameType === 'mochi-mash') mmPause(pin, g, !!paused);
      if (g.gameType === 'pinata') pnPause(pin, g, !!paused);
      if (g.gameType === 'sixseven') ssPause(pin, g, !!paused);
    } catch (e) { console.error('[host:pause]', e); }
  });

  // 6-7 Swing teacher: the round style in the lobby (Números / En Chino / Mezcla), and «Saltar» (the intro → play now;
  // after the end → every phone jumps to its own card).
  socket.on('host:ss-style', (data) => {
    try {
      const g = games[data && data.pin];
      if (!g || g.hostId !== socket.id || g.gameType !== 'sixseven' || g.state !== 'lobby') return;
      g.ssStyle = Sixseven.cleanStyle(data.style);
      g._lastBcast = 0;
      broadcast(data.pin);
    } catch (e) { console.error('[host:ss-style]', e); }
  });
  socket.on('host:ss-skip', (data) => {
    try {
      const pin = data && data.pin;
      const g = games[pin];
      if (!g || g.hostId !== socket.id || g.gameType !== 'sixseven' || !g.ss) return;
      if (g.state === 'active' && g.ss.phase === 'intro' && !g.ss.paused) ssPlay(pin, g);
      else if (g.state === 'ended') io.to(pin).except(g.hostId).emit('ss:skip', { id: g.ss.id });
    } catch (e) { console.error('[host:ss-skip]', e); }
  });

  // Piñata Tigre: the tap that stops the arrow (c = ms since the phone's arrow started), or `auto` when the phone's
  // window ran out. The server judges it (core/pinata.js hit) and answers with pn:hit (or pn:nohit).
  socket.on('player:pn-hit', (data) => {
    try {
      const pin = data && data.pin;
      const g = games[pin];
      if (!g || g.gameType !== 'pinata' || !g.pn || g.state !== 'active') return;
      const p = g.players[socket.id];
      if (!p || !Pinata.inGame(g.pn, p)) return;
      pnApplyHit(pin, g, socket.id, p, Number(data.hid), data.c, !!data.auto, Date.now());
    } catch (e) { console.error('[player:pn-hit]', e); }
  });
  // Piñata Tigre teacher «Saltar»: the intro → play now; after the end → every phone jumps to its own card.
  socket.on('host:pn-skip', (data) => {
    try {
      const pin = data && data.pin;
      const g = games[pin];
      if (!g || g.hostId !== socket.id || g.gameType !== 'pinata' || !g.pn) return;
      if (g.state === 'active' && g.pn.phase === 'intro' && !g.pn.paused) pnPlay(pin, g);
      else if (g.state === 'ended') io.to(pin).except(g.hostId).emit('pn:skip', { id: g.pn.id });
    } catch (e) { console.error('[host:pn-skip]', e); }
  });

  // Mochi Mash: a phone's tap COUNT for its open mash window (every ~250 ms while mashing, plus a last one at the end).
  // No reply per batch: the phone counts on its own, the window's summary comes when it closes (mm:mashed).
  socket.on('player:mm-taps', (data) => {
    try {
      const g = games[data && data.pin];
      if (!g || g.gameType !== 'mochi-mash' || !g.mm || g.state !== 'active') return;
      const p = g.players[socket.id];
      if (!p || !Mochi.inGame(g.mm, p)) return;
      Mochi.taps(g.mm, p, Number(data.mid), data.n, Date.now());
    } catch (e) { console.error('[player:mm-taps]', e); }
  });
  // Reinos / Pintores / Nieve / La Gran Fuga teacher «⏭ Saltar» on the ceremony: every phone jumps to its own card.
  socket.on('host:fin-skip', (data) => {
    try {
      const pin = data && data.pin;
      const g = games[pin];
      if (!g || g.hostId !== socket.id || !finGame(g) || g.state !== 'ended') return;
      io.to(pin).except(g.hostId).emit('fin:skip', {});
    } catch (e) { console.error('[host:fin-skip]', e); }
  });
  // Mochi Mash teacher «⏭ Saltar»: the intro → play now; after the end → every phone jumps to its own card.
  socket.on('host:mm-skip', (data) => {
    try {
      const pin = data && data.pin;
      const g = games[pin];
      if (!g || g.hostId !== socket.id || g.gameType !== 'mochi-mash' || !g.mm) return;
      if (g.state === 'active' && g.mm.phase === 'intro' && !g.mm.paused) mmPlay(pin, g);
      else if (g.state === 'ended') io.to(pin).except(g.hostId).emit('mm:skip', { id: g.mm.id });
    } catch (e) { console.error('[host:mm-skip]', e); }
  });

  // Ojos de Halcón: a kid looked at a window (0 top · 1 right · 2 bottom · 3 left).
  socket.on('player:hc-look', (data) => {
    try {
      const { pin, pos } = data || {};
      const g = games[pin];
      if (!g || g.gameType !== 'halcon' || !g.halcon) return;
      hcAnswer(pin, g, socket.id, Number(pos));
    } catch (e) { console.error('[player:hc-look]', e); }
  });
  // Teacher, in the lobby: 10 or 15 rounds (5–20 accepted). The room's time cap follows at the start.
  socket.on('host:hc-rounds', (data) => {
    try {
      const { pin, rounds } = data || {};
      const g = games[pin];
      if (!g || g.hostId !== socket.id || g.gameType !== 'halcon' || g.state !== 'lobby') return;
      g.hcRounds = Halcon.clampRounds(rounds);
      g.duration = Halcon.timeCapS(g.hcRounds);
      broadcast(pin);
    } catch (e) { console.error('[host:hc-rounds]', e); }
  });
  // Teacher, mid-game: «+5 rondas» (the class is loving it), up to 20.
  socket.on('host:hc-more', (data) => {
    try {
      const pin = data && data.pin;
      const g = games[pin];
      if (!g || g.hostId !== socket.id || g.gameType !== 'halcon' || !g.halcon || g.state !== 'active') return;
      const h = g.halcon;
      if (h.phase === 'final' || h.phase === 'done' || h.rounds >= Halcon.R.ROUNDS_MAX) return;
      const before = h.rounds;
      h.rounds = Math.min(Halcon.R.ROUNDS_MAX, h.rounds + Halcon.R.MORE);
      const extra = (h.rounds - before) * Halcon.R.CAP_PER_ROUND_S * 1000;
      g.endsAt += extra;
      g.duration += extra / 1000;
      if (!h.paused) {
        if (g.endTimer) clearTimeout(g.endTimer);
        g.endTimer = setTimeout(() => { if (games[pin] && games[pin].state === 'active') endGame(pin); }, Math.max(0, g.endsAt - Date.now()));
      }
      io.to(pin).emit('hc:rounds', { id: h.id, round: h.round, rounds: h.rounds });
    } catch (e) { console.error('[host:hc-more]', e); }
  });
  // Teacher, mid-game: «−5 rondas» (his ask 2026-10-20, every game can take time away too): never the round being
  // played nor the next one (that one becomes the last), so the contest never ends by itself.
  socket.on('host:hc-less', (data) => {
    try {
      const pin = data && data.pin;
      const g = games[pin];
      if (!g || g.hostId !== socket.id || g.gameType !== 'halcon' || !g.halcon || g.state !== 'active') return;
      const h = g.halcon;
      const floor = Math.max(h.round + 1, 2);
      if (h.phase === 'final' || h.phase === 'done' || h.rounds <= floor) return;
      const before = h.rounds;
      h.rounds = Math.max(floor, h.rounds - Halcon.R.MORE);
      const cut = (before - h.rounds) * Halcon.R.CAP_PER_ROUND_S * 1000;
      g.endsAt -= cut;
      g.duration -= cut / 1000;
      if (!h.paused) {
        if (g.endTimer) clearTimeout(g.endTimer);
        g.endTimer = setTimeout(() => { if (games[pin] && games[pin].state === 'active') endGame(pin); }, Math.max(0, g.endsAt - Date.now()));
      }
      io.to(pin).emit('hc:rounds', { id: h.id, round: h.round, rounds: h.rounds, cut: true });
    } catch (e) { console.error('[host:hc-less]', e); }
  });
  // Teacher «⏭ Saltar».
  socket.on('host:hc-skip', (data) => {
    try {
      const pin = data && data.pin;
      const g = games[pin];
      if (!g || g.hostId !== socket.id || g.gameType !== 'halcon' || !g.halcon || g.state !== 'active') return;
      hcSkip(pin, g);
    } catch (e) { console.error('[host:hc-skip]', e); }
  });

  // Reinos de Colores: kid tapped a tile on the phone's mini board.
  socket.on('player:kd-plant', (data) => {
    try {
      const { pin, tile } = data || {};
      const g = games[pin];
      if (!g || g.gameType !== 'kingdoms') return;
      kdApplyPlant(pin, socket.id, typeof tile === 'number' ? tile : null, false);
    } catch (e) { console.error('[player:kd-plant]', e); }
  });

  // Teacher «+30 s» / «−30 s» (any timed game; seconds < 0 takes time away, his ask 2026-10-20: every pin game, today's
  // and future ones): moves the end of the round. A cut never ends a round by itself (Party.clockShift stops it 10 s
  // before the end; nothing left to take = nothing happens) and leaves the round's length alone: the next round gets
  // the teacher's pick, and an end inside the last 30 s starts that moment as if the clock got there.
  socket.on('host:add-time', (data) => {
    const { pin, seconds } = data || {};
    const g = games[pin];
    if (!g || g.hostId !== socket.id || g.state !== 'active' || g.finalizing) return;
    const want = Number(seconds) || 30;
    const add = (want < 0 ? -1 : 1) * Math.max(10, Math.min(120, Math.abs(want))) * 1000;
    // the games whose room tick owns the clock: the change that applied, in whole seconds, for the screens' banner
    const said = (ms) => Math.round(ms / 1000);
    // Dàfùwēng · Monopolio: its room tick owns the clock; the teacher's pick (g.duration) stays for the next round
    if (g.gameType === 'monopoly' && g.mn) {
      const clock = mnClock(g.mn);
      const d = Mono.addTime(g.mn, add, clock);
      if (!d) return;
      g.endsAt = g.mn.endsAt;
      io.to(pin).emit('mn:time', { id: g.mn.id, endsMs: Math.max(0, g.mn.endsAt - clock), frenzy: g.mn.frenzy, frenzyMs: Math.max(0, g.mn.frenzyAt - clock), add: said(d) });
      g._lastBcast = 0;
      broadcast(pin);
      return;
    }
    // Vuelo del Dragón: the same (and after a «+30 s» a sprint that no longer fitted may come back)
    if (g.gameType === 'dragon-eye' && g.dr) {
      const clock = drClock(g.dr);
      const d = Dragon.addTime(g.dr, add, clock);
      if (!d) return;
      g.endsAt = g.dr.endsAt;
      if (d > 0) Dragon.reopenSprints(g.dr, clock);
      io.to(pin).emit('dr:time', { id: g.dr.id, endsMs: Math.max(0, g.dr.endsAt - clock), frenzy: g.dr.frenzy, frenzyMs: Math.max(0, g.dr.frenzyAt - clock), add: said(d) });
      g._lastBcast = 0;
      broadcast(pin);
      return;
    }
    // Mochi Mash: the room's tick owns the clock (no end timer); g.duration (the teacher's pick) is not touched, so the
    // next round starts with the picked time again
    if (g.gameType === 'mochi-mash' && g.mm) {
      const clock = g.mm.paused ? g.mm.pausedAt : Date.now();
      const d = Mochi.addTime(g.mm, add, clock);
      if (!d) return;
      g.endsAt = g.mm.endsAt;
      io.to(pin).emit('mm:time', { id: g.mm.id, endsMs: Math.max(0, g.mm.endsAt - clock), frenzy: g.mm.frenzy, frenzyMs: Math.max(0, g.mm.frenzyAt - clock), add: said(d) });
      g._lastBcast = 0;
      broadcast(pin);
      return;
    }
    if (g.gameType === 'pinata' && g.pn) {     // the same for Piñata Tigre
      const clock = g.pn.paused ? g.pn.pausedAt : Date.now();
      const d = Pinata.addTime(g.pn, add, clock);
      if (!d) return;
      g.endsAt = g.pn.endsAt;
      io.to(pin).emit('pn:time', { id: g.pn.id, endsMs: Math.max(0, g.pn.endsAt - clock), frenzy: g.pn.frenzy, frenzyMs: Math.max(0, g.pn.frenzyAt - clock), add: said(d) });
      g._lastBcast = 0;
      broadcast(pin);
      return;
    }
    // ¡No despiertes a Dralingo!: its room tick owns the clock; landing inside the last 30 s starts «¡Luna llena!» on the
    // next tick, as if the clock got there
    if (g.gameType === 'dormilon' && g.dm) {
      const clock = dmClock(g.dm);
      const dev = [];
      const d = Dorm.addTime(g.dm, add, clock, dev);
      if (!d) { if (add < 0) io.to(socket.id).emit('host:time-refused', { cut: true }); return; }
      g.endsAt = g.dm.endsAt;
      io.to(pin).emit('dm:time', { id: g.dm.id, endsMs: Math.max(0, g.dm.endsAt - clock), frenzy: g.dm.frenzy, add: said(d) });
      dmEmit(pin, g, dev);   // (the open window takes its new length: a final round ×2 that still fits the clock)
      g._lastBcast = 0;
      broadcast(pin);
      return;
    }
    // ¡Atrapa a Fénec!: the same (landing inside the last 30 s starts «¡Atardecer dorado!» on the next tick)
    if (g.gameType === 'teamcrab' && g.tc) {
      const clock = tcClock(g.tc);
      const tev = [];
      const d = Crab.addTime(g.tc, add, clock, tev);
      if (!d) { if (add < 0) io.to(socket.id).emit('host:time-refused', { cut: true }); return; }
      g.endsAt = g.tc.endsAt;
      io.to(pin).emit('tc:time', { id: g.tc.id, endsMs: Math.max(0, g.tc.endsAt - clock), frenzy: g.tc.frenzy, add: said(d), targets: Object.fromEntries(g.tc.boards.map((b) => [b.id, b.target])) });
      tcEmit(pin, g, tev);   // (the open window takes its new length: a final round ×2 that still fits the clock)
      io.to(g.hostId).emit('tc:crews', { crews: tcCrews(g) });
      g._lastBcast = 0;
      broadcast(pin);
      return;
    }
    // Las Trampillas counts in rounds: «+30 s» = 2 rondas más (up to 15), «−30 s» = 2 rondas menos (never the round
    // being played nor the next one); neither once the Final Round is on
    if (g.gameType === 'trapdoor' && g.td) {
      const cut = add < 0;
      if (!(cut ? Trap.cutRounds(g.td, Trap.R.MORE) : Trap.addRounds(g.td, Trap.R.MORE))) {
        const fin = g.td.final || g.td.phase === 'final' || g.td.phase === 'done';
        io.to(socket.id).emit('td:rounds', { id: g.td.id, rounds: g.td.rounds, r: g.td.r, refused: true, cut, why: fin ? 'final' : cut ? 'min' : 'max' });
        return;
      }
      const now = Date.now();
      g.endsAt = Trap.endsAt(g.td, now);
      g.duration = tdCapS(g.td.rounds);
      io.to(pin).emit('td:rounds', { id: g.td.id, rounds: g.td.rounds, r: g.td.r, cut, endsMs: Math.max(0, g.endsAt - now) });
      g._lastBcast = 0;
      broadcast(pin);
      return;
    }
    if (g.gameType === 'sixseven' && g.ss) {   // the same for 6-7 Swing
      const clock = g.ss.paused ? g.ss.pausedAt : Date.now();
      const d = Sixseven.addTime(g.ss, add, clock);
      if (!d) return;
      g.endsAt = g.ss.endsAt;
      io.to(pin).emit('ss:time', { id: g.ss.id, endsMs: Math.max(0, g.ss.endsAt - clock), frenzy: g.ss.frenzy, frenzyMs: Math.max(0, g.ss.frenzyAt - clock), add: said(d) });
      g._lastBcast = 0;
      broadcast(pin);
      return;
    }
    // Reinos, Pintores, Nieve, La Gran Fuga: g.endsAt is the clock (paused: it stands at the pause moment and moves on
    // «Seguir»); a cut leaves g.duration and extraSecs alone (the next round gets the teacher's pick back)
    const d = Party.clockShift(g.endsAt, add, finPausedAt(g) || Date.now());
    if (!d) { if (add < 0) io.to(socket.id).emit('host:time-refused', { cut: true }); return; }   // their projector says why
    if (d < 0) io.to(socket.id).emit('host:time-cut', { add: said(d) });
    g.endsAt += d;
    if (d > 0) {
      g.duration += d / 1000;
      g.extraSecs = (g.extraSecs || 0) + d / 1000;   // only for this round: host:reset gives it back (playtest 2026-10-11)
    }
    if (g.endTimer) clearTimeout(g.endTimer);
    g.endTimer = null;
    if (!(g.snow && g.snow.paused) && !(g.escape && g.escape.paused) && !(g.halcon && g.halcon.paused) && !(g.kingdoms && g.kingdoms.paused) && !(g.paint && g.paint.paused)) g.endTimer = setTimeout(() => {   // paused: the resume re-arms it
      if (!games[pin] || games[pin].state !== 'active') return;
      endGame(pin);
    }, Math.max(0, g.endsAt - Date.now()));
    if (!finPaused(g) && g.endsAt - Date.now() <= Party.FRENZY_MS + 1000) finFrenzyAgain(pin, g, false);   // still the last 30 s: the ×2 chips get the new seconds (paused: on «Seguir»)
    g._lastBcast = 0;
    broadcast(pin);
  });

  // Avatar swap — kids can change their avatar in the lobby without rejoining.
  socket.on('player:set-avatar', ({ pin, avatar }) => {
    const g = games[pin];
    if (!g) return;
    const p = g.players[socket.id];
    if (!p) return;
    if (typeof avatar !== 'string') return;
    // 🪙 2026-10-19: a skin of El Zoco only when the account this phone proved owns it (else nothing changes); the
    // 8-character cut is checked too (security review: «adric-3dX» cut to «adric-3d»)
    const skin = Saga.zoco(avatar) ? avatar : Saga.zoco(avatar.slice(0, 8)) ? avatar.slice(0, 8) : null;
    if (skin) {
      const acct = p.zocoOk && p.studentCode ? Students.peek(p.studentCode) : null;
      if (!acct || !Students.ownsSkin(acct.rec, skin)) return;
      p.avatar = skin;
    } else p.avatar = String(avatar).slice(0, 8);
    broadcast(pin);
  });

  // === Player stuck-recovery resync ===
  // Client watchdog pings this when nothing has happened on its end for 12s.
  // Server replies with the player's current state + re-emits the current
  // question if one is open + pushes a NEW question if the player is idle
  // (no mash window, no pending dice roll, etc).
  // This is the last-resort safety net that gets stuck players unstuck.
  socket.on('player:resync', (data) => {
    const pin = data && data.pin;
    const g = games[pin];
    if (!g) return;
    const p = g.players[socket.id];
    if (!p) {
      // (2026-10-19) a phone of this room with no slot any more (it never got its game: an empty screen): it joins again
      // by itself (player.js), never «exit and type the PIN again». Not a tab told its game went to another tab.
      if (role === 'player' && String(currentPin) === String(pin) && !(socket.data && socket.data.elsewhere === String(pin))) io.to(socket.id).emit('player:gone', { pin: String(pin) });
      return;
    }
    const now = Date.now();
    const inAction =
      (p.mashUntil && p.mashUntil > now) ||
      !!p.currentQ;
    io.to(socket.id).emit('state-resync', {
      state: g.state,
      gameType: g.gameType,
      hasOpenQuestion: !!p.currentQ,
      mashUntil:      p.mashUntil || 0,
      score:          p.score     || 0,
      inAction
    });
    // ¡No despiertes a Dralingo!: the board again (seat, points, an open question with its time left); after the end, the
    // ceremony + card again. The room's tick deals every new question.
    if (g.gameType === 'dormilon' && g.dm) {
      if (g.state === 'ended') {
        const e = dmEndPayloads(g);
        const one = e.forPlayer(socket.id) || e.guest();
        if (one) io.to(socket.id).emit('game-end', one);
        return;
      }
      if (g.state === 'active' || g.state === 'countdown') dmAttach(pin, g, socket.id, p);
      return;
    }
    // ¡Atrapa a Fénec!: the board again (seat, words, my hammer, an open question with its time left); after the end the
    // ending + card again. The room's tick deals every new question.
    if (g.gameType === 'teamcrab' && g.tc) {
      if (g.state === 'ended') {
        const e = tcEndPayloads(g);
        const one = e.forPlayer(socket.id) || e.guest();
        if (one) io.to(socket.id).emit('game-end', one);
        return;
      }
      if (g.state === 'active' || g.state === 'countdown') tcAttach(pin, g, socket.id, p);
      return;
    }
    // Dàfùwēng · Monopolio: the board again (seat, piece, coins, an open dice window, a turn still playing), the open
    // question again; after the end, the ceremony + card again. The room's tick deals every new question.
    if (g.gameType === 'monopoly' && g.mn) {
      if (g.state === 'ended') {
        const one = mnEndPayloads(g).forPlayer(socket.id);
        if (one) io.to(socket.id).emit('game-end', one);
        return;
      }
      if (g.state === 'active') {
        mnEnsureId(g, p);
        if (!Mono.inGame(g.mn, p.mnK)) mnSeatLate(pin, g, socket.id, p);
        else mnJoinRoom(pin, g, socket.id, p);
        io.to(socket.id).emit('mn:init', mnInitPayload(g, socket.id));
        if (g.mn.phase === 'play' && p.currentQ) io.to(socket.id).emit('question', { qid: p.currentQ.qid, text: p.currentQ.text, answers: p.currentQ.answers, image: p.currentQ.image });
      }
      return;
    }
    // Vuelo del Dragón: the race again (seat, metres, an open flight with the time left), the open question again; after
    // the end, the ceremony + card again. The room's tick deals every new question.
    if (g.gameType === 'dragon-eye' && g.dr) {
      if (g.state === 'ended') {
        const one = drEndPayloads(g).forPlayer(socket.id);
        if (one) io.to(socket.id).emit('game-end', one);
        return;
      }
      if (g.state === 'active') {
        drEnsureId(g, p);
        if (!Dragon.inGame(g.dr, p.drK)) drSeatLate(pin, g, socket.id, p);
        else { Dragon.setAway(g.dr, p.drK, false); drJoinRoom(pin, g, socket.id, p); }
        io.to(socket.id).emit('dr:init', drInitPayload(g, socket.id));
        if (g.dr.phase === 'play' && p.currentQ) io.to(socket.id).emit('question', { qid: p.currentQ.qid, text: p.currentQ.text, answers: p.currentQ.answers, image: p.currentQ.image });
      }
      return;
    }
    // Reinos / Pintores / Nieve / La Gran Fuga: «¡FINAL!» again (never a question then), or the ceremony + card again
    if (finGame(g) && g.state === 'active' && g.finalizing) { io.to(socket.id).emit('fin:final', { ms: finFinalLeft(g), why: g.finalizing.why, game: g.gameType }); return; }
    // (`again`: a resync — now also on every return to the tab — gives the chip and the lights, never the jingle and the
    // news a second time; a phone joining in the last 30 s still gets them all, player:join)
    if (finGame(g) && g.state === 'active' && g.finFrenzy && g.endsAt && !finPaused(g)) io.to(socket.id).emit('fin:frenzy', { game: g.gameType, endsMs: Math.max(0, g.endsAt - Date.now()), again: true });
    if (finGame(g) && g.state === 'ended') {
      const one = g.finEnd && finAgain(g, g.finEnd.forPlayer(socket.id) || g.finEnd.guest());
      if (one) io.to(socket.id).emit('game-end', one);
      return;
    }
    // Las Trampillas: the platform again (where I am, on the floor or in the pit, my wings), the open question again; the
    // room's tick deals every new one
    if (g.gameType === 'trapdoor' && g.state === 'active' && g.td) {
      const fresh = !tdKidOf(g, p);
      tdAttach(g, p);
      if (fresh) io.to(pin).emit('td:roster', tdRoster(g));
      p.tdMeKey = '';
      io.to(socket.id).emit('td:init', tdInitPayload(g, socket.id));
      if (p.currentQ) io.to(socket.id).emit('question', { qid: p.currentQ.qid, text: p.currentQ.text, answers: p.currentQ.answers, image: p.currentQ.image, td: p.tdQKind || 'wings' });
      return;
    }
    if (g.gameType === 'paint' && g.state === 'active' && g.paint) {
      if (!pcHas(g, p)) { pcFresh(g, p); io.to(pin).emit('pc:roster', pcRoster(g)); }
      pcStaleQ(p);
      io.to(socket.id).emit('pc:init', pcInitPayload(g, socket.id));
      if (p.currentQ) io.to(socket.id).emit('question', { qid: p.currentQ.qid, text: p.currentQ.text, answers: p.currentQ.answers, image: p.currentQ.image });
      return;
    }
    if (g.gameType === 'snow' && g.state === 'active' && g.snow) {
      const fresh = p.snRound !== g.snow.id;   // was away when the round started: walks in as a late joiner (shield)
      snAttach(g, socket.id, p, fresh);
      io.to(socket.id).emit('sn:init', snInitPayload(g, socket.id));
      if (fresh) io.to(pin).emit('sn:roster', { players: snRoster(g), counts: Snow.counts(g.players) });
      return;                         // an open question stays open: the station button re-sends it
    }
    if (g.gameType === 'escape' && g.state === 'active' && g.escape) {
      esAttach(g, socket.id, p);
      io.to(socket.id).emit('es:init', esInitPayload(g, socket.id));
      if (g.escape.phase !== 'run') return;            // zona segura / big moments: no questions now
      if (g.escape.paused) {            // paused: the open question comes back, a new one waits for «Seguir»
        if (p.currentQ) io.to(socket.id).emit('question', { qid: p.currentQ.qid, text: p.currentQ.text, answers: p.currentQ.answers, image: p.currentQ.image });
        return;
      }
    }
    if (g.gameType === 'halcon') {
      if (g.state === 'active' && g.halcon) { hcSeatLate(pin, g, socket.id, p); io.to(socket.id).emit('hc:init', hcInitPayload(g, socket.id)); }
      if (g.state === 'ended' && g.halcon) {        // missed game-end (a drop at «¡FINAL!»): the finale again
        const one = hcEndPayloads(g).forPlayer(socket.id);
        if (one) io.to(socket.id).emit('game-end', one);
      }
      return;                         // the board is the screen: never a question
    }
    if (g.gameType === 'mochi-mash' && g.mm) {
      if (g.state === 'ended') {      // missed game-end (a drop at «¡FINAL!»): the ceremony again
        const one = mmEndPayloads(g).forPlayer(socket.id);
        if (one) io.to(socket.id).emit('game-end', one);
        return;
      }
      if (g.state === 'active') {
        mmEnsureId(g, p);
        Mochi.join(g.mm, p);
        io.to(socket.id).emit('mm:init', mmInitPayload(g, socket.id));
        if (g.mm.phase !== 'play') return;       // intro / «¡FINAL!»: no question now
        if (g.mm.paused || (!p.currentQ && (p.mmMash || p.mmNextQAt))) {   // paused, mashing or waiting: only the open question
          if (p.currentQ) io.to(socket.id).emit('question', { qid: p.currentQ.qid, text: p.currentQ.text, answers: p.currentQ.answers, image: p.currentQ.image });
          return;
        }
      }
    }
    if (g.gameType === 'sixseven' && g.ss) {
      if (g.state === 'ended') {      // missed game-end (a drop at «¡FINAL!»): the ceremony again
        const one = ssEndPayloads(g).forPlayer(socket.id);
        if (one) io.to(socket.id).emit('game-end', one);
        return;
      }
      if (g.state === 'active') {
        ssEnsureId(g, p);
        Sixseven.join(g.ss, p);
        io.to(socket.id).emit('ss:init', ssInitPayload(g, socket.id));
        if (g.ss.phase === 'play') ssResend(g, socket.id, p);   // the same sum again (with its real time left)
      }
      return;                         // the tick deals every new sum (after the wait)
    }
    if (g.gameType === 'pinata' && g.pn) {
      if (g.state === 'ended') {      // missed game-end (a drop at «¡FINAL!»): the ceremony again
        const one = pnEndPayloads(g).forPlayer(socket.id);
        if (one) io.to(socket.id).emit('game-end', one);
        return;
      }
      if (g.state === 'active') {
        pnEnsureId(g, p);
        Pinata.join(g.pn, p);
        io.to(socket.id).emit('pn:init', pnInitPayload(g, socket.id));
        if (g.pn.phase !== 'play') return;       // intro / «¡FINAL!»: no question now
        if (g.pn.paused || (!p.currentQ && (p.pnSwing || p.pnNextQAt))) {   // paused, swinging or waiting: only the open question
          if (p.currentQ) io.to(socket.id).emit('question', { qid: p.currentQ.qid, text: p.currentQ.text, answers: p.currentQ.answers, image: p.currentQ.image });
          return;
        }
      }
    }
    if (g.gameType === 'kingdoms' && g.state === 'active' && g.kingdoms) {
      io.to(socket.id).emit('kd:init', kdInitPayload(g, false));
      if (p.kdPending) { kdPrompt(pin, socket.id, { reprompt: true }); return; }
    }
    // Re-emit the active question so the client can re-render the screen
    if (p.currentQ && g.state === 'active') {
      io.to(socket.id).emit('question', {
        qid: p.currentQ.qid,
        text: p.currentQ.text,
        answers: p.currentQ.answers,
        image: p.currentQ.image
      });
      return;
    }
    // If the player is genuinely idle and the game is running, push them a
    // fresh question to get them moving again.
    if (g.state === 'active' && !inAction) {
      const q = nextQuestionFor(g, socket.id);
      if (q) io.to(socket.id).emit('question', q);
    }
  });

  // === WARM-UP sentence-builder ===
  // Two permission tiers:
  //   - wuRequireHost: ONLY the original teacher socket + correct password
  //     (used for view-mode, curious mode, preset load, delegate grant/revoke).
  //   - wuRequireAdmin: host OR a delegated student "asistente"
  //     (used for add-word, remove-word, clear — the day-to-day sentence ops).
  // Delegates are tracked by PLAYER NAME so they survive reconnects (socket.id
  // changes on rejoin but the name stays).
  // === 📖 READING MODE — Cuento HSK1 ===
  // Same admin password as warmup. Teacher = master playback; students
  // mirror in real time. State message includes everything the client
  // needs to render the current page + decide whether to play audio.
  function readingBuildStateMsg(g) {
    if (!g || !g.reading) return null;
    return {
      storyId: g.reading.storyId,
      storyList: g.reading.storyList || [],
      title: g.reading.title,
      subtitle: g.reading.subtitle,
      music: g.reading.music || null,    // 🎵 per-story theme name
      theme: g.reading.theme || null,    // 🎨 per-story palette
      pages: g.reading.pages,
      currentPage: g.reading.currentPage || 0,
      language: g.reading.language || 'pinyin',   // 'pinyin' | 'es'
      curious: !!g.reading.curious,
      isPlaying: !!g.reading.isPlaying,
      audioPosMs: g.reading.audioPosMs || 0,
      playStartedAt: g.reading.playStartedAt || 0,
      playbackRate: g.reading.playbackRate || 1.0,
      // Test snapshot — null when no test is running. When active includes
      // current question index (without correct answer) so a late-join
      // student still gets the current question.
      test: g.reading.test ? {
        active:     g.reading.test.active,
        qIdx:       g.reading.test.qIdx,
        total:      g.reading.test.total,
        question:   g.reading.test.active && g.reading.test.qIdx < g.reading.test.questions.length
                      ? { q: g.reading.test.questions[g.reading.test.qIdx].q,
                          choices: g.reading.test.questions[g.reading.test.qIdx].choices }
                      : null,
        deadline:   g.reading.test.deadline || 0,
      } : null,
      serverNow: Date.now(),
    };
  }
  // Per-question window (auto-advance even if not all kids have answered).
  const RD_TEST_Q_MS = 22000;
  // Start a fresh test for the current story. Per-student answers stored
  // in g.reading.test.answers[playerId] = [pickIdx, pickIdx, ...].
  function readingStartTest(g, pin) {
    if (!g || !g.reading) return;
    const story = ReadingStory.STORIES[g.reading.storyId];
    const qs = ReadingStory.getStoryQuestions(g.reading.storyId);
    if (!qs.length) return;
    g.reading.test = {
      active: true,
      storyId: g.reading.storyId,
      storyTitle: (story && story.title) || g.reading.storyId,
      questions: qs,
      total: qs.length,
      pointsPerQ: 100 / qs.length,
      qIdx: 0,
      deadline: Date.now() + RD_TEST_Q_MS,
      answers: {},          // playerId -> [pickIdx per question]
      logged: false,        // becomes true once results saved to records
      phaseTimer: null,
    };
    // Pause reading playback so the test isn't competing with narration
    if (g.reading.isPlaying) {
      const elapsed = Date.now() - (g.reading.playStartedAt || Date.now());
      g.reading.audioPosMs = (g.reading.audioPosMs || 0) + elapsed;
    }
    g.reading.isPlaying = false;
    g.reading.playStartedAt = 0;
    io.to(pin).emit('rd:state', readingBuildStateMsg(g));
    g.reading.test.phaseTimer = setTimeout(() => readingAdvanceTest(g, pin), RD_TEST_Q_MS);
  }
  function readingAdvanceTest(g, pin) {
    if (!g || !g.reading || !g.reading.test || !g.reading.test.active) return;
    const t = g.reading.test;
    if (t.phaseTimer) { clearTimeout(t.phaseTimer); t.phaseTimer = null; }
    t.qIdx += 1;
    if (t.qIdx >= t.total) {
      // End of test — grade everyone, save records, broadcast.
      readingFinishTest(g, pin);
      return;
    }
    t.deadline = Date.now() + RD_TEST_Q_MS;
    io.to(pin).emit('rd:state', readingBuildStateMsg(g));
    t.phaseTimer = setTimeout(() => readingAdvanceTest(g, pin), RD_TEST_Q_MS);
  }
  function readingFinishTest(g, pin) {
    if (!g || !g.reading || !g.reading.test) return;
    const t = g.reading.test;
    if (t.phaseTimer) { clearTimeout(t.phaseTimer); t.phaseTimer = null; }
    t.active = false;
    // Grade every player who participated. Score = correct * pointsPerQ.
    const studentResults = [];      // sorted, returned to host for dashboard
    Object.entries(g.players).forEach(([pid, p]) => {
      const picks = t.answers[pid] || [];
      const breakdown = t.questions.map((qq, i) => {
        const picked = typeof picks[i] === 'number' ? picks[i] : -1;
        const gotRight = picked === qq.correctIdx;
        return {
          q: qq.q,
          picked,
          correct: qq.correctIdx,
          correctText: qq.choices[qq.correctIdx],
          pickedText: picked >= 0 ? qq.choices[picked] : '—',
          gotRight,
        };
      });
      const correctCount = breakdown.filter((b) => b.gotRight).length;
      const score = Math.round(correctCount * t.pointsPerQ);
      // Persist to student-records under their code
      if (p.studentCode && !t.logged) {
        try {
          Students.logTestResult(p.studentCode, {
            storyId: t.storyId,
            storyTitle: t.storyTitle,
            score,
            pointsPerQ: t.pointsPerQ,
            breakdown,
            pin,
          });
        } catch (e) { /* ignore */ }
      }
      studentResults.push({
        id: pid,
        name: p.name,
        team: p.team,
        avatar: p.avatar || '',
        code: p.studentCode || null,
        score,
        correctCount,
        total: t.total,
        breakdown,
      });
    });
    t.logged = true;
    studentResults.sort((a, b) => b.score - a.score);
    io.to(pin).emit('rd:test-results', { results: studentResults });
    // Also push the cleared state (test.active = false)
    io.to(pin).emit('rd:state', readingBuildStateMsg(g));
  }
  // 🔒 2026-10-17: only the room's own projector gets its code read, through _socketCode (the turnstile)
  function readingHostCode(g, socket, password) {
    if (!g || g.gameType !== 'reading' || g.hostId !== socket.id) return { ok: false, why: 'not-host' };
    return _socketCode(socket, password);
  }
  function readingRequireHost(g, socket, password) {
    return readingHostCode(g, socket, password).ok;
  }
  socket.on('rd:auth', ({ pin, password }, cb) => {
    const c = readingHostCode(games[pin], socket, password);
    if (typeof cb === 'function') cb(c.why === 'wait' ? { ok: false, wait: true } : { ok: c.ok });
  });
  // Teacher flips the on-screen language between pinyin (HSK1 Chinese) and
  // Spanish translation. Image + audio (Chinese narration) stay the same.
  // Broadcast so every student phone updates simultaneously.
  socket.on('rd:setLanguage', ({ pin, password, language }) => {
    const g = games[pin];
    if (!readingRequireHost(g, socket, password)) return;
    if (!g.reading) return;
    const lang = (language === 'es') ? 'es' : 'pinyin';
    if (g.reading.language === lang) return;
    g.reading.language = lang;
    io.to(pin).emit('rd:state', readingBuildStateMsg(g));
  });
  // Teacher switches to a different built-in story. Server re-loads the
  // selected story's pages + asset URLs, resets playback to page 0.
  socket.on('rd:setStory', ({ pin, password, storyId }) => {
    const g = games[pin];
    if (!readingRequireHost(g, socket, password)) return;
    if (!g.reading) return;
    if (!ReadingStory.STORIES[storyId]) return;  // unknown id, ignore
    if (g.reading.storyId === storyId) return;
    const payload = ReadingStory.buildStoryPayload(storyId);
    g.reading.storyId  = payload.id;
    g.reading.title    = payload.title;
    g.reading.subtitle = payload.subtitle;
    g.reading.music    = payload.music || null;   // 🎵 swap music per story
    g.reading.theme    = payload.theme || null;   // 🎨 swap palette per story
    g.reading.pages    = payload.pages;
    g.reading.currentPage = 0;
    g.reading.audioPosMs = 0;
    g.reading.isPlaying = false;
    g.reading.playStartedAt = 0;
    io.to(pin).emit('rd:state', readingBuildStateMsg(g));
  });
  // Teacher toggles 🔍 Modo Curioso. When ON, students can tap any pinyin
  // word in the reading screen to open a dictionary card. Same UX as the
  // warmup-mode curious toggle; the dictionary is the same WU_WORD_BY_PINYIN
  // map served from warmup-vocab.js.
  socket.on('rd:setCurious', ({ pin, password, curious }) => {
    const g = games[pin];
    if (!readingRequireHost(g, socket, password)) return;
    if (!g.reading) return;
    g.reading.curious = !!curious;
    io.to(pin).emit('rd:state', readingBuildStateMsg(g));
  });
  // 🐢 VFX broadcast — teacher pushes a visual effect to every kid in
  // the room. Currently used by the Toggle Turtle button (Squirtle GIF
  // overlay). Tiny payload, no per-frame work on the server. Each kid's
  // player.js handles the actual rendering.
  socket.on('rd:vfx', ({ pin, password, fx, on }) => {
    const g = games[pin];
    if (!readingRequireHost(g, socket, password)) return;
    if (on && !Saga.anim(String(fx || ''))) return;   // the saga's animations only (public/js/saga.js)
    io.to(pin).emit('rd:vfx', { fx: String(fx || ''), on: !!on });
  });
  // === 📝 TEST MODE ===
  // Teacher kicks off a 5-question multiple-choice test on the current
  // story. Server runs the state machine (auto-advance per question),
  // collects answers, grades on finish, persists per-student results.
  socket.on('rd:startTest', ({ pin, password }) => {
    const g = games[pin];
    if (!readingRequireHost(g, socket, password)) return;
    if (!g.reading) return;
    if (g.reading.test && g.reading.test.active) return;   // already running
    readingStartTest(g, pin);
  });
  // Student submits an answer for the current question. Late submissions
  // are silently dropped (the qIdx will have advanced).
  socket.on('player:rd-test-answer', ({ pin, qIdx, answerIdx }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'reading' || g.state !== 'active') return;
    if (!g.reading || !g.reading.test || !g.reading.test.active) return;
    if (Number(qIdx) !== g.reading.test.qIdx) return;       // stale
    const idx = Number(answerIdx);
    if (!Number.isFinite(idx) || idx < 0 || idx > 3) return;
    if (!g.reading.test.answers[socket.id]) g.reading.test.answers[socket.id] = [];
    g.reading.test.answers[socket.id][g.reading.test.qIdx] = idx;
    // Ack so the player's UI can lock the picked choice
    io.to(socket.id).emit('rd:test-ack', { qIdx: g.reading.test.qIdx, answerIdx: idx });
    // If every connected player has answered the current question, jump
    // ahead instead of waiting for the timer.
    const playerIds = Object.keys(g.players);
    const allDone = playerIds.length > 0 && playerIds.every((pid) => {
      const arr = g.reading.test.answers[pid];
      return arr && typeof arr[g.reading.test.qIdx] === 'number';
    });
    if (allDone) {
      // small grace delay so the last student sees their lock-in animation
      if (g.reading.test.phaseTimer) clearTimeout(g.reading.test.phaseTimer);
      g.reading.test.phaseTimer = setTimeout(() => readingAdvanceTest(g, pin), 500);
    }
  });
  // Teacher manually ends a test in progress (skips remaining questions
  // and shows results immediately). Useful when class runs out of time.
  socket.on('rd:endTest', ({ pin, password }) => {
    const g = games[pin];
    if (!readingRequireHost(g, socket, password)) return;
    if (!g.reading || !g.reading.test || !g.reading.test.active) return;
    readingFinishTest(g, pin);
  });
  // Teacher navigates to a specific page (relative or absolute). Resets
  // audio position + pauses playback so the new page starts fresh.
  socket.on('rd:goto', ({ pin, password, page }) => {
    const g = games[pin];
    if (!readingRequireHost(g, socket, password)) return;
    if (!g.reading) return;
    const max = (g.reading.pages || []).length;
    const targetPage = Math.max(0, Math.min(max - 1, Number(page) || 0));
    g.reading.currentPage = targetPage;
    g.reading.audioPosMs = 0;
    g.reading.isPlaying = false;
    g.reading.playStartedAt = 0;
    io.to(pin).emit('rd:state', readingBuildStateMsg(g));
  });
  // Teacher hits play. Server records the wall clock so clients can
  // align their local audio elements.
  socket.on('rd:play', ({ pin, password }) => {
    const g = games[pin];
    if (!readingRequireHost(g, socket, password)) return;
    if (!g.reading || g.reading.isPlaying) return;
    g.reading.isPlaying = true;
    g.reading.playStartedAt = Date.now();
    io.to(pin).emit('rd:state', readingBuildStateMsg(g));
  });
  // Teacher hits pause. Server snapshots the live audio position so the
  // next play resumes where we left off. Audio time advances at
  // playbackRate, so wall-clock elapsed * rate = real audio elapsed.
  socket.on('rd:pause', ({ pin, password }) => {
    const g = games[pin];
    if (!readingRequireHost(g, socket, password)) return;
    if (!g.reading) return;
    if (g.reading.isPlaying) {
      const elapsed = Date.now() - (g.reading.playStartedAt || Date.now());
      const rate = g.reading.playbackRate || 1.0;
      g.reading.audioPosMs = (g.reading.audioPosMs || 0) + elapsed * rate;
    }
    g.reading.isPlaying = false;
    g.reading.playStartedAt = 0;
    io.to(pin).emit('rd:state', readingBuildStateMsg(g));
  });
  // 🐢 Teacher toggles slow-mo (0.5x) ↔ normal (1.0x). If audio is
  // currently playing, snapshot position first so the change is seamless.
  socket.on('rd:setPlaybackRate', ({ pin, password, rate }) => {
    const g = games[pin];
    if (!readingRequireHost(g, socket, password)) return;
    if (!g.reading) return;
    const newRate = (Number(rate) === 0.5) ? 0.5 : 1.0;
    if (g.reading.playbackRate === newRate) return;
    // If playing, snapshot current position using OLD rate, then switch
    if (g.reading.isPlaying) {
      const elapsed = Date.now() - (g.reading.playStartedAt || Date.now());
      const oldRate = g.reading.playbackRate || 1.0;
      g.reading.audioPosMs = (g.reading.audioPosMs || 0) + elapsed * oldRate;
      g.reading.playStartedAt = Date.now();   // restart "from now" with new rate
    }
    g.reading.playbackRate = newRate;
    io.to(pin).emit('rd:state', readingBuildStateMsg(g));
  });
  // Teacher scrubs the timeline. Pauses if necessary so the seek is exact.
  socket.on('rd:seek', ({ pin, password, posMs }) => {
    const g = games[pin];
    if (!readingRequireHost(g, socket, password)) return;
    if (!g.reading) return;
    const max = (g.reading.pages[g.reading.currentPage] || {}).audioDurationMs || 10000;
    const newPos = Math.max(0, Math.min(max, Number(posMs) || 0));
    g.reading.audioPosMs = newPos;
    g.reading.isPlaying = false;
    g.reading.playStartedAt = 0;
    io.to(pin).emit('rd:state', readingBuildStateMsg(g));
  });

  // 🔒 2026-10-17: only the room's own projector gets its code read, through _socketCode (the turnstile)
  function wuHostCode(g, socket, password) {
    if (!g || g.gameType !== 'warmup' || g.hostId !== socket.id) return { ok: false, why: 'not-host' };
    return _socketCode(socket, password);
  }
  function wuRequireHost(g, socket, password) {
    return wuHostCode(g, socket, password).ok;
  }
  function wuRequireAdmin(g, socket, password) {
    if (!g || g.gameType !== 'warmup') return false;
    // Host path — the teacher can ALWAYS edit, even while frozen.
    if (g.hostId === socket.id && wuRequireHost(g, socket, password)) return true;
    // Delegate path — no password needed, identity comes from the player name
    const p = g.players[socket.id];
    if (!p) return false;
    const delegates = g.warmup && g.warmup.delegates;
    if (!(delegates && delegates.has(p.name))) return false;
    // FREEZE: while the teacher has paused assistance, delegates stay in the
    // builder but cannot mutate anything — only the teacher can. Either a
    // global freeze OR this kid's name being in the selective freeze list.
    if (g.warmup && g.warmup.frozen) return false;
    if (g.warmup && Array.isArray(g.warmup.frozenNames) && g.warmup.frozenNames.indexOf(p.name) >= 0) return false;
    return true;
  }
  socket.on('wu:auth', ({ pin, password }, cb) => {
    const g = games[pin];
    const c = wuHostCode(g, socket, password);   // (the host's code is read once: a wrong one counts once)
    const ok = c.ok || (c.why === 'not-host' && wuRequireAdmin(g, socket, password));
    // Surface super-admin status so the host page can reveal super-only
    // tools (the random-Spanish prompt bar). Host path only — delegates
    // are never super admins.
    const isSuper = c.ok && c.superAdmin;
    if (typeof cb === 'function') cb(Object.assign({ ok, isSuperAdmin: !!isSuper }, c.why === 'wait' ? { wait: true } : {}));
  });
  function wuStatePayload(g) {
    return {
      sentence: g.warmup.sentence,
      viewMode: g.warmup.viewMode || 'text',
      curious: !!g.warmup.curious,
      delegates: Array.from(g.warmup.delegates || []),
      judges: Array.from(g.warmup.judges || []),
      frozen: !!g.warmup.frozen,
      frozenNames: g.warmup.frozenNames || [],
      timer: g.warmup.timer || null,
      prompt: (g.warmup && g.warmup.prompt) || '',
      // null = show ALL experience banks; otherwise only these exp ids.
      visibleExps: g.warmup.visibleExps || null,
      // Live teacher-created words (names, custom vocab). [{id,pinyin,hanzi,es,icon}]
      customWords: g.warmup.customWords || [],
    };
  }
  function wuEmitState(g, pin) {
    io.to(pin).emit('wu:state', wuStatePayload(g));
  }
  // === WORD-BANK VISIBILITY === host picks which EXP banks students see in
  // the builder catalog. Super easy live enable/disable. null/empty = all.
  socket.on('wu:set-visible-exps', ({ pin, password, exps }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'warmup') return;
    if (!wuRequireHost(g, socket, password)) return;
    if (!g.warmup) return;
    g.warmup.visibleExps = (Array.isArray(exps) && exps.length) ? exps.slice(0, 12) : null;
    wuEmitState(g, pin);
  });
  // === LIVE CUSTOM WORD === teacher creates a word on the fly (e.g. a name
  // "Jonathan"). It appears in everyone's catalog in a special "custom" bank
  // and can be tapped into the sentence like any other word.
  socket.on('wu:add-custom-word', ({ pin, password, pinyin, es, hanzi, icon }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'warmup') return;
    if (!wuRequireHost(g, socket, password)) return;
    if (!g.warmup) return;
    if (!g.warmup.customWords) g.warmup.customWords = [];
    const p = String(pinyin || '').trim().slice(0, 40);
    if (!p) return;
    const id = 'cw' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    g.warmup.customWords.push({
      id,
      pinyin: p,
      hanzi: String(hanzi || '').trim().slice(0, 20),
      es: String(es || '').trim().slice(0, 60),
      icon: String(icon || '⭐').slice(0, 4),
      cat: 'custom', exp: 'custom',
    });
    if (g.warmup.customWords.length > 60) g.warmup.customWords = g.warmup.customWords.slice(-60);
    wuEmitState(g, pin);
  });
  socket.on('wu:remove-custom-word', ({ pin, password, id }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'warmup') return;
    if (!wuRequireHost(g, socket, password)) return;
    if (!g.warmup || !g.warmup.customWords) return;
    g.warmup.customWords = g.warmup.customWords.filter((w) => w.id !== id);
    wuEmitState(g, pin);
  });
  // === FREEZE / UNFREEZE assistance === host-only. While frozen, delegates
  // can't mutate the sentence (wuRequireAdmin denies them). They stay in the
  // builder UI but can't touch — teacher regains exclusive control.
  socket.on('wu:set-frozen', ({ pin, password, frozen, names }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'warmup') return;
    if (!wuRequireHost(g, socket, password)) return;
    if (!g.warmup) return;
    // Two modes:
    //  • Global freeze  → { frozen:true }  pauses ALL asistentes at once.
    //  • Selective freeze → { names:[...] } pauses ONLY those kids by name;
    //    everyone else keeps building. Frozen kids stay on the builder
    //    screen (they still SEE everything) — they just can't edit.
    if (Array.isArray(names)) {
      g.warmup.frozenNames = names.filter((n) => typeof n === 'string');
    } else {
      g.warmup.frozen = !!frozen;
    }
    wuEmitState(g, pin);
  });
  // === COUNTDOWN TIMER === Teacher-only. Sets an intense "time machine"
  // countdown on the board + every phone. Everyone sees the seconds left to
  // finish the sentence. Pass seconds=0 / null to clear.
  socket.on('wu:set-timer', ({ pin, password, seconds }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'warmup') return;
    if (!wuRequireHost(g, socket, password)) return;
    if (!g.warmup) return;
    const s = Number(seconds);
    if (Number.isFinite(s) && s > 0) {
      g.warmup.timer = { endsAt: Date.now() + Math.min(s, 600) * 1000, duration: Math.min(s, 600) };
    } else {
      g.warmup.timer = null;
    }
    wuEmitState(g, pin);
  });
  // === VFX BROADCAST === host fires a visual effect; the server relays it to
  // EVERY phone in the room so the fun happens uniformly on player screens
  // (and the host). kind ∈ rain|confetti|zombies|moto|shake|sixseven.
  socket.on('wu:fx', ({ pin, password, kind }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'warmup') return;
    if (!wuRequireHost(g, socket, password)) return;
    const ok = ['rain', 'confetti', 'zombies', 'moto', 'shake', 'sixseven', 'flash', 'stars', 'tiger',
                'dralingo', 'gang'];
    if (!ok.includes(kind) && !Saga.burst(kind)) return;   // + the saga cast bursts (public/js/saga.js)
    io.to(pin).emit('wu:fx', { kind });
  });
  // 🎬 wu:anim — PERSISTENT animation overlay (Gojo dance GIF, Squirtle,
  // future transparent-GIF additions). Different from wu:fx (one-shot
  // particle bursts) in that anim stays on every kid's screen until
  // the teacher toggles it off. Same socket framework, separate event
  // so the player-side rendering is clean.
  socket.on('wu:anim', ({ pin, password, id, on }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'warmup') return;
    if (!wuRequireHost(g, socket, password)) return;
    if (!Saga.anim(String(id || ''))) return;   // the saga's animations only (public/js/saga.js)
    // Stash the current state on the room so a kid joining late
    // automatically sees whatever's already on.
    if (!g.wuAnim) g.wuAnim = {};
    if (on) g.wuAnim[id] = { since: Date.now() };
    else    delete g.wuAnim[id];
    io.to(pin).emit('wu:anim', { id, on: !!on });
  });
  // 🖼 wu:image — "Describe la imagen" teaching mode. The teacher picks
  // a picture from any HSK simulation and it appears full-screen on
  // every kid's phone so the class describes it together in Chinese.
  // url is validated against the scanned catalog so a client can't
  // shove an arbitrary URL onto kids' screens. Stashed on the room so
  // late-joiners see whatever's currently up; null url clears it.
  socket.on('wu:image', ({ pin, password, url }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'warmup') return;
    if (!wuRequireHost(g, socket, password)) return;
    // 🔒 2026-10-15: the picker holds signed links; back to the picture's own address, checked against the catalog,
    // then a fresh link for THIS room (it stops working when the room ends).
    const logical = url ? SimLock.logicalUrl(String(url)) : null;
    if (url && (!logical || !SimImages.isValidImageUrl(logical))) return;   // reject anything not in the catalog
    g.wuImage = logical ? SimLock.linkFor(logical, { kind: 'w', pin: String(pin) }) : null;
    io.to(pin).emit('wu:image', { url: g.wuImage });
  });
  // === JUDGE role === host designates a kid as a "juez" who can approve or
  // deny raise-hand requests. Two categories: asistente (builds) and juez
  // (approves). Host only.
  socket.on('wu:set-judge', ({ pin, password, playerName, on }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'warmup') return;
    if (!wuRequireHost(g, socket, password)) return;
    if (!g.warmup) return;
    if (!g.warmup.judges) g.warmup.judges = new Set();
    const nm = String(playerName || '');
    if (on) g.warmup.judges.add(nm); else g.warmup.judges.delete(nm);
    wuEmitState(g, pin);
  });
  // A judge approves a pending raise-hand → promote that kid to asistente.
  socket.on('wu:judge-grant', ({ pin, playerName }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'warmup' || !g.warmup) return;
    const me = g.players[socket.id];
    const judges = g.warmup.judges;
    if (!me || !judges || !judges.has(me.name)) return;   // caller must be a judge
    if (!g.warmup.delegates) g.warmup.delegates = new Set();
    g.warmup.delegates.add(String(playerName || ''));
    wuEmitState(g, pin);
  });
  // === SUPER-MAESTRO PROMPT === broadcast a free-text Spanish challenge to
  // every student phone. Super-admin only. Stored on the game so late-
  // joiners receive it via wu:state. Empty string clears it everywhere.
  socket.on('wu:prompt-set', ({ pin, password, text }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'warmup') return;
    if (!wuHostCode(g, socket, password).superAdmin) return;
    if (!g.warmup) g.warmup = { sentence: [], viewMode: 'text', contributors: new Set(), undoStack: [] };
    g.warmup.prompt = String(text || '').slice(0, 160);
    io.to(pin).emit('wu:prompt', { text: g.warmup.prompt });
    wuEmitState(g, pin);
  });
  socket.on('wu:prompt-clear', ({ pin, password }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'warmup') return;
    if (!wuHostCode(g, socket, password).superAdmin) return;
    if (g.warmup) g.warmup.prompt = '';
    io.to(pin).emit('wu:prompt', { text: '' });
    wuEmitState(g, pin);
  });
  // === RAISE HAND === a kid in the builder who is NOT yet an asistente
  // taps "✋ Quiero ser asistente". We notify the host (and the room) so the
  // teacher sees who wants in — gamified request-to-join. No auth needed
  // (it's just a request; the teacher still decides via 👑).
  socket.on('wu:raise-hand', ({ pin }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'warmup') return;
    const p = g.players[socket.id];
    if (!p || !p.name) return;
    io.to(pin).emit('wu:hand', { name: p.name, avatar: p.avatar || '', t: Date.now() });
  });
  // === LIVE-MASTER auto-delegate toggle === when ON, every kid who joins
  // this warmup game is auto-promoted to asistente. Set by the host-warmup
  // page when it was launched in live-master mode from /maestro. Host only.
  socket.on('wu:auto-delegate', ({ pin, password, on }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'warmup') return;
    if (!wuRequireHost(g, socket, password)) return;
    if (!g.warmup) return;
    g.warmup.autoDelegateAll = !!on;
    // Retroactively promote everyone already in the room.
    if (g.warmup.autoDelegateAll) {
      if (!g.warmup.delegates) g.warmup.delegates = new Set();
      Object.values(g.players).forEach((p) => { if (p && p.name) g.warmup.delegates.add(p.name); });
      wuEmitState(g, pin);
    }
  });
  // === ASSISTANT ACTIVITY === when a DELEGATE (not the host) mutates the
  // sentence, broadcast who-did-what to the host so the super maestro can
  // supervise. Fired from the add/remove handlers below.
  function wuEmitActivity(g, pin, socketId, action, wordId) {
    const p = g.players[socketId];
    if (!p) return;                       // host has no player record → skip
    const delegates = g.warmup && g.warmup.delegates;
    if (!(delegates && delegates.has(p.name))) return;  // only delegates
    io.to(pin).emit('wu:activity', {
      name: p.name,
      avatar: p.avatar || '',
      action,                              // 'add' | 'remove'
      wordId: wordId || null,
      t: Date.now(),
    });
  }
  // Push the CURRENT sentence state onto the undo stack BEFORE mutating it.
  // Called by every mutation handler. Stack capped to keep memory bounded.
  const WU_UNDO_MAX = 30;
  function wuPushUndo(g) {
    if (!g || !g.warmup) return;
    if (!g.warmup.undoStack) g.warmup.undoStack = [];
    g.warmup.undoStack.push(g.warmup.sentence.slice());
    if (g.warmup.undoStack.length > WU_UNDO_MAX) {
      g.warmup.undoStack.shift();
    }
  }

  // Flush the current sentence to the history of every contributor, then
  // reset the contributors set. Called on clear / replace / game end.
  function wuFlushSentence(g, pin) {
    if (!g || !g.warmup) return;
    if (!g.warmup.sentence.length) {
      g.warmup.contributors = new Set();
      return;
    }
    const contributors = Array.from(g.warmup.contributors || []);
    if (contributors.length) {
      Students.logSentence(contributors, g.warmup.sentence, pin, g.warmup.customWords || []);
      // Notify each contributor's socket(s) that their history grew —
      // they can re-fetch if their history modal is open.
      Object.entries(g.players).forEach(([sid, p]) => {
        if (p.studentCode && contributors.includes(p.studentCode)) {
          io.to(sid).emit('wu:history-updated');
        }
      });
    }
    g.warmup.contributors = new Set();
  }
  socket.on('wu:add-word', ({ pin, password, wordId }) => {
    const g = games[pin];
    if (!wuRequireAdmin(g, socket, password)) return;
    if (!g.warmup) g.warmup = { sentence: [], viewMode: 'text', contributors: new Set(), undoStack: [] };
    wuPushUndo(g);
    g.warmup.sentence.push(wordId);
    const p = g.players[socket.id];
    if (p && p.studentCode) g.warmup.contributors.add(p.studentCode);
    wuEmitActivity(g, pin, socket.id, 'add', wordId);
    wuEmitState(g, pin);
  });
  socket.on('wu:remove-word', ({ pin, password, index }) => {
    const g = games[pin];
    if (!wuRequireAdmin(g, socket, password)) return;
    if (!g.warmup) return;
    const i = Number(index);
    if (Number.isFinite(i) && i >= 0 && i < g.warmup.sentence.length) {
      const removedWid = g.warmup.sentence[i];
      wuPushUndo(g);
      g.warmup.sentence.splice(i, 1);
      const p = g.players[socket.id];
      if (p && p.studentCode) g.warmup.contributors.add(p.studentCode);
      wuEmitActivity(g, pin, socket.id, 'remove', removedWid);
      wuEmitState(g, pin);
    }
  });
  // === SAVE CURRENT === Flush the current sentence to every contributor's
  // history WITHOUT clearing the stage. Anyone with admin rights (host or
  // asistente) can save. Resets the contributors set so the next clear
  // doesn't double-log. Also credits the caller even if they didn't add
  // any words this round — "I want this in MY history".
  socket.on('wu:save-current', ({ pin, password }) => {
    const g = games[pin];
    if (!wuRequireAdmin(g, socket, password)) return;
    if (!g.warmup || !g.warmup.sentence.length) {
      // Tell the caller the save was a no-op (empty stage) so they get
      // explicit feedback instead of silence.
      io.to(socket.id).emit('wu:saved', { ok: false, reason: 'empty' });
      return;
    }
    // Make sure the caller is credited
    const p = g.players[socket.id];
    if (p && p.studentCode) g.warmup.contributors.add(p.studentCode);
    // Snapshot what's about to be logged BEFORE flushing — wuFlushSentence
    // resets the contributors set, so we capture counts up front.
    const savedWordCount = g.warmup.sentence.length;
    const savedContributorCount = g.warmup.contributors.size;
    wuFlushSentence(g, pin);
    // Explicit confirmation to the caller — host or asistente. Used by the
    // client to flash the Save button + show a "✓ Guardada" chip so the
    // user has VISIBLE feedback that the save landed (Rewards.show is
    // disabled platform-wide, so we can't lean on toast for this).
    io.to(socket.id).emit('wu:saved', {
      ok: true,
      words: savedWordCount,
      contributors: savedContributorCount,
    });
    // 🆕 2026-06-16 (Fernando): broadcast WHO saved to the activity
    // ticker. Unlike add/remove (delegate-only via wuEmitActivity),
    // a save can be triggered by the host too — so we emit directly
    // here with a host fallback name/avatar.
    const saver = g.players[socket.id];
    io.to(pin).emit('wu:activity', {
      name: saver ? saver.name : 'Maestra',
      avatar: saver ? (saver.avatar || '🎓') : '👑',
      action: 'save',
      count: savedWordCount,
      t: Date.now(),
    });
    // (sentence stays visible; contributors set reset by wuFlushSentence)
  });
  // === SAVE MINE === ANY player (delegate or not, even while frozen) can
  // save the CURRENT stage sentence to their OWN history. This is the
  // "save is everywhere" rule — a kid can always keep whatever they're
  // looking at, regardless of whether the teacher made them an asistente.
  // Unlike wu:save-current, this credits ONLY the caller, and never clears.
  socket.on('wu:save-mine', ({ pin }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'warmup' || !g.warmup) return;
    const p = g.players[socket.id];
    if (!p || !p.studentCode) {
      io.to(socket.id).emit('wu:saved', { ok: false, reason: 'nocode' });
      return;
    }
    if (!g.warmup.sentence.length) {
      io.to(socket.id).emit('wu:saved', { ok: false, reason: 'empty' });
      return;
    }
    // Append a private copy to THIS student only.
    Students.appendSentence(p.studentCode, g.warmup.sentence, pin, g.warmup.customWords || []);
    io.to(socket.id).emit('wu:history-updated');
    io.to(socket.id).emit('wu:saved', { ok: true, words: g.warmup.sentence.length, mine: true });
  });
  socket.on('wu:clear', ({ pin, password }) => {
    const g = games[pin];
    if (!wuRequireAdmin(g, socket, password)) return;
    if (!g.warmup) return;
    wuPushUndo(g);
    // Flush the about-to-be-cleared sentence to contributors' histories
    wuFlushSentence(g, pin);
    g.warmup.sentence = [];
    // Log WHO wiped the stage — the teacher wants the activity feed to show
    // not just additions/removals but full clears too ("borró todo").
    wuEmitActivity(g, pin, socket.id, 'clear', null);
    wuEmitState(g, pin);
  });
  // === UNDO === Pops the last sentence state off the stack. Host or
  // delegate can undo. Note: undo does NOT bring back contributors that
  // were flushed by a clear — once a sentence is logged to histories,
  // undoing the visible state is fine but the history entries stay.
  socket.on('wu:undo', ({ pin, password }) => {
    const g = games[pin];
    if (!wuRequireAdmin(g, socket, password)) return;
    if (!g.warmup) return;
    if (!g.warmup.undoStack || !g.warmup.undoStack.length) return;
    const prev = g.warmup.undoStack.pop();
    g.warmup.sentence = prev;
    wuEmitState(g, pin);
  });
  // === SWAP WORDS === Used by Modo Rearreglar (rearrange). Swaps the
  // word at fromIndex with the word at toIndex. Tracks contributor.
  socket.on('wu:swap-words', ({ pin, password, fromIndex, toIndex }) => {
    const g = games[pin];
    if (!wuRequireAdmin(g, socket, password)) return;
    if (!g.warmup) return;
    const i = Number(fromIndex), j = Number(toIndex);
    if (!Number.isFinite(i) || !Number.isFinite(j) || i === j) return;
    const len = g.warmup.sentence.length;
    if (i < 0 || j < 0 || i >= len || j >= len) return;
    wuPushUndo(g);
    const tmp = g.warmup.sentence[i];
    g.warmup.sentence[i] = g.warmup.sentence[j];
    g.warmup.sentence[j] = tmp;
    const p = g.players[socket.id];
    if (p && p.studentCode) g.warmup.contributors.add(p.studentCode);
    wuEmitState(g, pin);
  });
  // Student requests their own history. They identify by code (which lives
  // in their phone's localStorage). Server doesn't trust the socket — it
  // looks up the stored record by code so an attacker can't easily probe
  // other kids' sentences without their code.
  socket.on('wu:request-history', ({ studentCode }, cb) => {
    if (typeof cb !== 'function') return;
    const list = Students.getHistory(studentCode, 50);
    cb({ ok: true, sentences: list });
  });
  // Student deletes one of their own history entries (by timestamp,
  // which is unique within their record). Returns the fresh list.
  socket.on('wu:delete-history-entry', ({ studentCode, ts }, cb) => {
    cb = typeof cb === 'function' ? cb : () => {};
    const ok = Students.deleteHistoryEntry(studentCode, ts);
    cb({ ok, sentences: Students.getHistory(studentCode, 50) });
  });
  // === TEACHER PRESETS (cross-device, server-stored) ===
  // Replaces the old localStorage-per-laptop approach so presets follow
  // the teacher across devices. Anyone authenticated as host can read/write.
  // A teacher code is enough (no room needed). 🔒 2026-10-17: checked through _socketCode, so these three can no longer
  // be used to try codes without limit (any socket could, PIN or not); the projector that proved its code goes on.
  function wuPresetsRefusal(socket, password) {
    const c = _socketCode(socket, password);
    return c.ok ? null : { ok: false, error: c.why === 'wait' ? 'demasiados intentos' : 'bad password' };
  }
  socket.on('wu:presets-list', ({ pin, password }, cb) => {
    if (typeof cb !== 'function') return;
    const no = wuPresetsRefusal(socket, password);
    if (no) return cb(no);
    cb({ ok: true, presets: TeacherPresets.list() });
  });
  socket.on('wu:presets-save', ({ pin, password, name, sentence }, cb) => {
    cb = typeof cb === 'function' ? cb : () => {};
    const no = wuPresetsRefusal(socket, password);
    if (no) return cb(no);
    try {
      const preset = TeacherPresets.save(name, sentence);
      cb({ ok: true, preset, presets: TeacherPresets.list() });
    } catch (e) {
      cb({ ok: false, error: e.message });
    }
  });
  socket.on('wu:presets-delete', ({ pin, password, id }, cb) => {
    cb = typeof cb === 'function' ? cb : () => {};
    const no = wuPresetsRefusal(socket, password);
    if (no) return cb(no);
    const ok = TeacherPresets.remove(id);
    cb({ ok, presets: TeacherPresets.list() });
  });
  // Teacher pushes a full sentence at once (used by preset-load) — HOST ONLY
  socket.on('wu:set-sentence', ({ pin, password, sentence }) => {
    const g = games[pin];
    if (!wuRequireHost(g, socket, password)) return;
    if (!g.warmup) g.warmup = { sentence: [], viewMode: 'text', delegates: new Set(), contributors: new Set() };
    if (!Array.isArray(sentence)) return;
    wuPushUndo(g);
    // Flush the old sentence first (it's being replaced by a preset)
    wuFlushSentence(g, pin);
    g.warmup.sentence = sentence.slice(0, 40).map(String);
    wuEmitState(g, pin);
  });
  // Teacher switches text / picture / both view mode — HOST ONLY
  socket.on('wu:set-view-mode', ({ pin, password, mode }) => {
    const g = games[pin];
    if (!wuRequireHost(g, socket, password)) return;
    if (!g.warmup) return;
    const valid = ['text', 'picture', 'both'];
    g.warmup.viewMode = valid.includes(mode) ? mode : 'text';
    wuEmitState(g, pin);
  });
  // === MODO CURIOSO === Teacher toggles global "curious" flag. HOST ONLY —
  // delegates can build sentences but only the original teacher decides when
  // to open the Pokédex layer for the whole class.
  socket.on('wu:set-curious', ({ pin, password, curious }) => {
    const g = games[pin];
    if (!wuRequireHost(g, socket, password)) return;
    if (!g.warmup) return;
    g.warmup.curious = !!curious;
    wuEmitState(g, pin);
  });
  // === ASISTENTE (delegate admin) === Teacher grants/revokes word-building
  // power to a named student. The student's phone instantly switches from
  // read-only mirror to full builder. HOST ONLY.
  socket.on('wu:delegate-grant', ({ pin, password, playerName }) => {
    const g = games[pin];
    if (!wuRequireHost(g, socket, password)) return;
    if (!g.warmup) return;
    if (!playerName) return;
    g.warmup.delegates.add(String(playerName));
    wuEmitState(g, pin);
  });
  socket.on('wu:delegate-revoke', ({ pin, password, playerName }) => {
    const g = games[pin];
    if (!wuRequireHost(g, socket, password)) return;
    if (!g.warmup) return;
    g.warmup.delegates.delete(String(playerName));
    wuEmitState(g, pin);
  });

  // Dàfùwēng · Monopolio: the tap on the dice block. The phone only says "now" (tid = its dice window); the server picks
  // the number and resolves the whole turn (mnRoll). A tap for a turn already resolved gets its script again (the phone
  // missed it), at most once every 1.5 s.
  socket.on('player:mn-roll', (data) => {
    try {
      const pin = data && data.pin;
      const g = games[pin];
      if (!g || g.gameType !== 'monopoly' || !g.mn || g.state !== 'active') return;
      const p = g.players[socket.id];
      const m = g.mn;
      const r = p && Mono.kid(m, p.mnK);
      if (!r) return;
      const tid = Number(data.tid);
      const now = Date.now();
      if (r.turn && r.turn.tid === tid) {
        if (m.paused || (m.phase !== 'play' && m.phase !== 'final')) { io.to(socket.id).emit('mn:noroll', { tid, paused: !!m.paused }); return; }
        mnRoll(pin, g, socket.id, p, false, now);
      } else if (r.last && r.last.tid === tid && now - (r.resentAt || 0) > 1500) {
        r.resentAt = now;
        io.to(socket.id).emit('mn:turn', r.last);
      }
    } catch (e) { console.error('[player:mn-roll]', e); }
  });
  // Vuelo del Dragón: the wing beats of a flight, counted by the phone every 250 ms (mid = the flight). The server credits
  // at most R.RATE a second of the flight (+ a burst) and never answers a batch (the phone predicts with the same cap;
  // dr:flown settles it).
  socket.on('player:dr-beats', (data) => {
    try {
      const { pin, mid, n } = data || {};
      const g = games[pin];
      if (!g || g.gameType !== 'dragon-eye' || !g.dr || g.state !== 'active') return;
      const p = g.players[socket.id];
      if (!p || !p.drK) return;
      Dragon.beats(g.dr, p.drK, Number(mid), n, Date.now());
    } catch (e) { console.error('[player:dr-beats]', e); }
  });
  // Vuelo del Dragón teacher «Saltar»: the intro → play now; after the end → every phone jumps to its own card.
  socket.on('host:dr-skip', (data) => {
    try {
      const pin = data && data.pin;
      const g = games[pin];
      if (!g || g.hostId !== socket.id || g.gameType !== 'dragon-eye' || !g.dr) return;
      if (g.state === 'active' && g.dr.phase === 'intro' && !g.dr.paused) drPlay(pin, g);
      else if (g.state === 'ended') io.to(pin).except(g.hostId).emit('dr:skip', { id: g.dr.id });
    } catch (e) { console.error('[host:dr-skip]', e); }
  });
  // Draly Siesta · ¡No despiertes a Dralingo!: a kid's answer (its qid; a stale or double tap is ignored and the phone
  // hears why), the stroke, «¡Guardar mis plumas!» and the reactions (🤫 😱 😂 👏).
  // v4: one completed stroke of a kid's finger on his head in the play window (the phone counts a back-and-forth rub;
  // x, y = where, 0-1 of his face picture, so the board sees whose tickle landed where); the server judges gentle /
  // scribble by the time since my last stroke, spends the feather (into my collection if he stays asleep), and may wake him
  socket.on('player:dm-stroke', (data) => {
    try {
      const pin = data && data.pin;
      const g = games[pin];
      if (!g || g.gameType !== 'dormilon' || !g.dm || g.state !== 'active') return;
      const p = g.players[socket.id];
      if (!p || !p.dmK) return;
      const res = Dorm.stroke(g.dm, p.dmK, Date.now());
      if (!res.ok) { io.to(socket.id).emit('dm:nostroke', { why: res.why }); return; }
      const fx = Math.max(0, Math.min(1, Number(data.x) || 0.5)), fy = Math.max(0, Math.min(1, Number(data.y) || 0.4));
      res.ev.forEach((e) => { if (e.t === 'pat') { e.x = Math.round(fx * 1000) / 1000; e.y = Math.round(fy * 1000) / 1000; } });
      dmEmit(pin, g, res.ev);
    } catch (e) { console.error('[player:dm-stroke]', e); }
  });
  socket.on('player:dm-answer', (data) => {
    try {
      const { pin, qid, idx } = data || {};
      const g = games[pin];
      if (!g || g.gameType !== 'dormilon' || !g.dm || g.state !== 'active') return;
      const p = g.players[socket.id];
      if (!p || !p.dmK) return;
      const res = Dorm.answer(g.dm, p.dmK, String(qid || ''), Number(idx), Date.now());
      if (!res.ok) { io.to(socket.id).emit('dm:nope', { qid: String(qid || ''), why: res.why }); return; }
      dmEmit(pin, g, res.ev);
    } catch (e) { console.error('[player:dm-answer]', e); }
  });
  // the phone shows its question on a visible screen (only then can it run out and cost a feather)
  socket.on('player:dm-seen', (data) => {
    try {
      const { pin, qid } = data || {};
      const g = games[pin];
      if (!g || g.gameType !== 'dormilon' || !g.dm || g.state !== 'active') return;
      const p = g.players[socket.id];
      if (!p || !p.dmK) return;
      Dorm.seen(g.dm, p.dmK, String(qid || ''));
    } catch (e) { console.error('[player:dm-seen]', e); }
  });
  // «🪶 ¡Guardar mis plumas!»: my feathers of this round are kept
  socket.on('player:dm-stop', (data) => {
    try {
      const pin = data && data.pin;
      const g = games[pin];
      if (!g || g.gameType !== 'dormilon' || !g.dm || g.state !== 'active') return;
      const p = g.players[socket.id];
      if (!p || !p.dmK) return;
      dmEmit(pin, g, Dorm.bank(g.dm, p.dmK));
    } catch (e) { console.error('[player:dm-stop]', e); }
  });
  socket.on('player:dm-react', (data) => {
    try {
      const { pin, e } = data || {};
      const g = games[pin];
      if (!g || g.gameType !== 'dormilon' || !g.dm || g.state !== 'active') return;
      const p = g.players[socket.id];
      if (!p || !p.dmK) return;
      const r = Dorm.react(g.dm, p.dmK, String(e || ''), Date.now());
      if (!r) return;
      io.to(dmRoom(pin, g.dm, r.b)).emit('dm:react', r);
      io.to(g.hostId).emit('dm:react', r);
    } catch (err) { console.error('[player:dm-react]', err); }
  });
  // Draly Siesta teacher «Saltar»: the intro → play now; in play the current window ends now; after the end → every
  // phone jumps to its own card.
  socket.on('host:dm-skip', (data) => {
    try {
      const pin = data && data.pin;
      const g = games[pin];
      if (!g || g.hostId !== socket.id || g.gameType !== 'dormilon' || !g.dm) return;
      const m = g.dm;
      if (g.state === 'active' && m.phase === 'intro' && !m.paused) dmPlay(pin, g);
      else if (g.state === 'active' && m.phase === 'play' && !m.paused) {
        if (Date.now() - (m.skipAt || 0) < 700) return;      // a double tap must not jump over the next window
        m.skipAt = Date.now();
        dmEmit(pin, g, Dorm.skip(m, Date.now(), dmOpts(g)));
      } else if (g.state === 'ended') io.to(pin).except(g.hostId).emit('dm:skip', { id: m.id });
    } catch (e) { console.error('[host:dm-skip]', e); }
  });
  // «🤖 Probar con robots» (the projector's lobby, teacher only): 3 robots join the next game at his board (he can try it
  // with one phone); off again with a second tap. They are never a player: no coins, record, star, podium or ranking.
  socket.on('host:dm-robots', (data) => {
    try {
      const pin = data && data.pin;
      const g = games[pin];
      if (!g || g.hostId !== socket.id || g.gameType !== 'dormilon' || g.state !== 'lobby') return;
      g.dmRobots = data && data.on ? DM_ROBOTS.length : 0;
      io.to(socket.id).emit('dm:robots', { on: !!g.dmRobots, robots: dmRobotNames(g.dmRobots) });
    } catch (e) { console.error('[host:dm-robots]', e); }
  });
  // Draly Cangrejo · ¡Atrapa a Fénec!: a quiz answer (its qid; a stale or double tap is ignored and the phone hears why),
  // the phone showed its question (only then can it run out and cost), the Capitán's steer (the crab walks there; relayed
  // live so every phone of the crew predicts the walk, volatile), a martillero's aim (relayed live, volatile: a late one is
  // just dropped), the SLAM, a cheer.
  const tcPlayer = (data, fn) => {
    const pin = data && data.pin;
    const g = games[pin];
    if (!g || g.gameType !== 'teamcrab' || !g.tc || g.state !== 'active') return;
    const p = g.players[socket.id];
    if (!p || !p.tcK) return;
    fn(pin, g, p);
  };
  socket.on('player:tc-answer', (data) => {
    try {
      tcPlayer(data, (pin, g, p) => {
        const res = Crab.answer(g.tc, p.tcK, String(data.qid || ''), Number(data.idx), Date.now());
        if (!res.ok) { io.to(socket.id).emit('tc:nope', { qid: String(data.qid || ''), why: res.why }); return; }
        tcEmit(pin, g, res.ev);
      });
    } catch (e) { console.error('[player:tc-answer]', e); }
  });
  socket.on('player:tc-seen', (data) => {
    try { tcPlayer(data, (pin, g, p) => { Crab.seen(g.tc, p.tcK, String(data.qid || '')); }); } catch (e) { console.error('[player:tc-seen]', e); }
  });
  socket.on('player:tc-pong', (data) => {
    try {
      tcPlayer(data, (pin, g, p) => {
        const t = Number(data.t), rtt = Date.now() - t;
        if (!Number.isFinite(t) || t !== g.tc.pingAt || rtt < 0 || rtt > 5000) return;   // (only the server's own last ping)
        p.tcRtt = p.tcRtt == null ? rtt : Math.round(p.tcRtt * 0.6 + rtt * 0.4);
        Crab.setRtt(g.tc, p.tcK, p.tcRtt);
      });
    } catch (e) { console.error('[player:tc-pong]', e); }
  });
  socket.on('player:tc-steer', (data) => {
    try {
      tcPlayer(data, (pin, g, p) => {
        const r = Crab.steer(g.tc, p.tcK, Number(data.x), Date.now());
        if (!r) return;
        socket.to(tcRoom(pin, g.tc, r.b)).volatile.emit('tc:steer', r);
        io.to(g.hostId).volatile.emit('tc:steer', r);
      });
    } catch (e) { console.error('[player:tc-steer]', e); }
  });
  socket.on('player:tc-aim', (data) => {
    try {
      tcPlayer(data, (pin, g, p) => {
        const r = Crab.aim(g.tc, p.tcK, Number(data.x), Date.now());
        if (!r) return;
        socket.to(tcRoom(pin, g.tc, r.b)).volatile.emit('tc:aim', r);
        io.to(g.hostId).volatile.emit('tc:aim', r);
      });
    } catch (e) { console.error('[player:tc-aim]', e); }
  });
  socket.on('player:tc-slam', (data) => {
    try {
      tcPlayer(data, (pin, g, p) => {
        const x = data.x == null ? null : Number(data.x);
        const res = Crab.slam(g.tc, p.tcK, Number.isFinite(x) ? x : null, Date.now(), Math.min(Crab.R.LAG_MAX, p.tcRtt || 0));
        if (!res.ok) { io.to(socket.id).emit('tc:noslam', { why: res.why }); return; }
        tcEmit(pin, g, res.ev);
      });
    } catch (e) { console.error('[player:tc-slam]', e); }
  });
  // «1 contra 3»: the runner's phone is the truth for where he is (clamped to his speed), his dashes and his own verdicts
  socket.on('player:tc-run', (data) => {
    try {
      tcPlayer(data, (pin, g, p) => {
        const r = Crab.runnerPos(g.tc, p.tcK, Number(data.x), Date.now());
        if (!r) return;
        socket.to(tcRoom(pin, g.tc, r.b)).volatile.emit('tc:runner', r);
        io.to(g.hostId).volatile.emit('tc:runner', r);
      });
    } catch (e) { console.error('[player:tc-run]', e); }
  });
  socket.on('player:tc-dash', (data) => {
    try {
      tcPlayer(data, (pin, g, p) => {
        const r = Crab.runnerDash(g.tc, p.tcK, Number(data.dir), Date.now());
        if (!r) { const me = Crab.kid(g.tc, p.tcK), bd = me && Crab.boardOf(g.tc, me.b); io.to(socket.id).emit('tc:nodash', { x: bd && bd.runner === p.tcK ? Math.round(bd.rx * 100) / 100 : null }); return; }   // (his phone snaps back to where the server has him)
        io.to(tcRoom(pin, g.tc, r.b)).emit('tc:dash', r);
        io.to(g.hostId).emit('tc:dash', r);
      });
    } catch (e) { console.error('[player:tc-dash]', e); }
  });
  socket.on('player:tc-land', (data) => {
    try {
      tcPlayer(data, (pin, g, p) => {
        const ev = [];
        if (Crab.runnerLand(g.tc, p.tcK, Number(data.sid), Number(data.x), Date.now(), ev)) tcEmit(pin, g, ev);
      });
    } catch (e) { console.error('[player:tc-land]', e); }
  });
  socket.on('player:tc-react', (data) => {
    try {
      tcPlayer(data, (pin, g, p) => {
        const r = Crab.react(g.tc, p.tcK, String(data.e || ''), Date.now());
        if (!r) return;
        io.to(tcRoom(pin, g.tc, r.b)).emit('tc:react', r);
        io.to(g.hostId).emit('tc:react', r);
      });
    } catch (err) { console.error('[player:tc-react]', err); }
  });
  // Draly Cangrejo teacher «Saltar»: the intro → play now; in play the current window (questions or «¡A martillar!») ends
  // now; after the end → every phone jumps to its own card.
  socket.on('host:tc-skip', (data) => {
    try {
      const pin = data && data.pin;
      const g = games[pin];
      if (!g || g.hostId !== socket.id || g.gameType !== 'teamcrab' || !g.tc) return;
      const m = g.tc;
      if (g.state === 'active' && m.phase === 'intro' && !m.paused) tcPlay(pin, g);
      else if (g.state === 'active' && m.phase === 'play' && !m.paused) {
        if (Date.now() - (m.skipAt || 0) < 700) return;     // a double tap must not jump over a whole window
        m.skipAt = Date.now();
        tcEmit(pin, g, Crab.skip(m, Date.now(), tcOpts(g)));
      } else if (g.state === 'ended') io.to(pin).except(g.hostId).emit('tc:skip', { id: m.id });
    } catch (e) { console.error('[host:tc-skip]', e); }
  });
  // «🤖 Probar con robots» (the projector's lobby, teacher only): 3 robot crewmates join the next game (he can try it with
  // one phone); off again with a second tap. They are never a player: no coins, record, star, podium or ranking.
  socket.on('host:tc-robots', (data) => {
    try {
      const pin = data && data.pin;
      const g = games[pin];
      if (!g || g.hostId !== socket.id || g.gameType !== 'teamcrab' || g.state !== 'lobby') return;
      g.tcRobots = data && data.on ? TC_ROBOTS.length : 0;
      io.to(socket.id).emit('tc:robots', { on: !!g.tcRobots, robots: tcRobotNames(g.tcRobots) });
    } catch (e) { console.error('[host:tc-robots]', e); }
  });
  // Draly Cangrejo teacher: «Todos contra Fénec» (crew, the default) or «1 contra 3» (vs) in the lobby; the phones'
  // lobby shows the steps of the mode (state.tcMode). It stays for «Otra ronda».
  socket.on('host:tc-mode', (data) => {
    try {
      const pin = data && data.pin;
      const g = games[pin];
      if (!g || g.hostId !== socket.id || g.gameType !== 'teamcrab' || g.state !== 'lobby') return;
      g.tcMode = data && data.mode === 'vs' ? 'vs' : 'crew';
      io.to(socket.id).emit('tc:mode', { mode: g.tcMode });
      g._lastBcast = 0;
      broadcast(pin);
    } catch (e) { console.error('[host:tc-mode]', e); }
  });
  // Dàfùwēng · Monopolio teacher «Saltar»: the intro → play now; after the end → every phone jumps to its own card.
  socket.on('host:mn-skip', (data) => {
    try {
      const pin = data && data.pin;
      const g = games[pin];
      if (!g || g.hostId !== socket.id || g.gameType !== 'monopoly' || !g.mn) return;
      if (g.state === 'active' && g.mn.phase === 'intro' && !g.mn.paused) mnPlay(pin, g);
      else if (g.state === 'ended') io.to(pin).except(g.hostId).emit('mn:skip', { id: g.mn.id });
    } catch (e) { console.error('[host:mn-skip]', e); }
  });

  socket.on('player:tap', ({ pin }) => {
    const g = games[pin];
    if (!g || g.state !== 'active') return;
    if (g.gameType === 'mochi-mash' && g.mm) return;   // Mochi Mash v2 counts taps in batches (player:mm-taps), capped
    if (g.gameType === 'pinata') return;               // Piñata Tigre v2: one judged swing per right answer (player:pn-hit)
    if (g.gameType === 'sixseven') return;             // 6-7 Swing v2: answers only (player:answer)
    if (g.gameType === 'dragon-eye') return;           // Vuelo del Dragón v2: wing beats come in batches (player:dr-beats), capped
    const p = g.players[socket.id];
    if (!p) return;
    const now = Date.now();
    if (now > p.mashUntil) return;
    if (now - p.lastTap < TAP_MIN_INTERVAL_MS) return;
    p.lastTap = now;
    p.recentTaps.push(now);
    p.recentTaps = p.recentTaps.filter((t) => now - t < COMBO_WINDOW_MS);
    let points = 1;
    let combo = false;
    if (p.recentTaps.length >= COMBO_THRESHOLD) {
      points = 2;
      combo = true;
    }
    p.score += points;
    g.teamScores[p.team] += points;
    io.to(socket.id).emit('tap-ack', { points, combo, score: p.score });
    // Throttle score broadcasts: max 1 per 150ms per game (was every tap = thousands/sec lag)
    if (!g.lastScoreBroadcast || now - g.lastScoreBroadcast >= 150) {
      g.lastScoreBroadcast = now;
      io.to(pin).emit('score-update', { teamScores: g.teamScores });
    }
    // Per-game aggregated tap-fx broadcast: collect taps in 100ms windows then send one event with the count
    if (!g.tapFxBuffer) g.tapFxBuffer = { red: 0, gold: 0 };
    g.tapFxBuffer[p.team] += points;
    if (!g.lastTapFx || now - g.lastTapFx >= 100) {
      g.lastTapFx = now;
      io.to(pin).emit('tap-fx', { red: g.tapFxBuffer.red, gold: g.tapFxBuffer.gold });
      g.tapFxBuffer = { red: 0, gold: 0 };
    }
    if (combo && Math.random() < 0.15) {
      g.feed.push({ type: 'combo', name: p.name, team: p.team, t: now });
      broadcast(pin);
    }
  });

  // (Watchdog moved outside the connection handler — see bottom of file. The previous
  // version registered a new interval on every connection, which compounded as a CPU leak.)

  socket.on('disconnect', () => {
    if (!currentPin || !games[currentPin]) return;
    const g = games[currentPin];

    if (role === 'host') {
      // Soft disconnect: give the host time to reconnect (mobile lock
      // screens, network blips). Teacher TOOLS (warmup/reading) get a much
      // longer grace — the teacher routinely locks their phone mid-session
      // and we must NOT tear the room down under the kids. The host page
      // also actively re-claims via host:reclaim on socket reconnect, so
      // this timer is just the last-resort cleanup.
      const graceMs = (g.gameType === 'warmup' || g.gameType === 'reading' || g.gameType === 'hsksim') ? 10 * 60 * 1000 : 60000;
      g.hostDisconnectedAt = Date.now();
      g.feed.push({ type: 'host-disconnect', t: Date.now() });
      broadcast(currentPin);
      // Schedule final cleanup if host doesn't return
      g.hostCleanupTimer = setTimeout(() => {
        const stillExists = games[currentPin];
        if (!stillExists) return;
        // Only end if no new host has reconnected (hostId would have changed)
        if (stillExists.hostId === socket.id) {
          // 🆕 2026-06-21 (Fernando): an HSK sim room must NEVER die just because
          // the teacher closed/backgrounded the host tab — kids may be mid-exam
          // and the teacher needs to keep forcing late-joiners to the same PIN.
          // The room is also persisted to disk (HSK_ROOMS) and re-hydrates on
          // demand, so it stays valid forever. We only RELEASE the host slot so
          // a reopened host-hsk can reclaim it; we do NOT delete it or kick kids.
          if (stillExists.gameType === 'hsksim') {
            stillExists.hostId = null;
            stillExists.hostDisconnectedAt = null;
            return;
          }
          if (stillExists.endTimer) clearTimeout(stillExists.endTimer);
          if (stillExists.gameType === 'paint') pcStop(stillExists);
          if (stillExists.gameType === 'trapdoor') tdStop(stillExists);
          if (stillExists.gameType === 'snow') snStop(stillExists);
          if (stillExists.gameType === 'escape') esStop(stillExists);
          if (stillExists.gameType === 'halcon') hcStop(stillExists);
          if (stillExists.gameType === 'monopoly') mnStop(stillExists);
          if (stillExists.gameType === 'dormilon') dmStop(stillExists);
          if (stillExists.gameType === 'teamcrab') tcStop(stillExists);
          if (stillExists.gameType === 'dragon-eye') drStop(stillExists);
          if (stillExists.gameType === 'mochi-mash') mmStop(stillExists);
          if (stillExists.gameType === 'pinata') pnStop(stillExists);
          if (stillExists.gameType === 'sixseven') ssStop(stillExists);
          if (stillExists.gameType === 'kingdoms') kdClearTimers(stillExists);
          io.to(currentPin).emit('host-left');
          delete games[currentPin];
        }
      }, graceMs);
    } else if (role === 'player') {
      const p = g.players[socket.id];
      if (p) {
        // Soft disconnect: keep slot for rejoin, mark as disconnected
        p.disconnected = true;
        p.disconnectedAt = Date.now();
        // Vuelo del Dragón: the comeback rules (tailwind, Remontada) look at the dragons still flying
        if (g.gameType === 'dragon-eye' && g.dr && p.drK) Dragon.setAway(g.dr, p.drK, true);
        // Batalla de Nieve: survival seconds don't count while the phone is away (snAttach restarts them)
        if (g.gameType === 'snow' && g.snow && p.snSide === 'sun' && p.snSunSince) { p.snSunMs = (p.snSunMs || 0) + Date.now() - p.snSunSince; p.snSunSince = 0; }
        g.feed.push({ type: 'leave', name: p.name, t: Date.now() });
        broadcast(currentPin);
        // Ojos de Halcón: if everyone still here has looked, a dropped phone must not hold the round its whole 6 s
        if (g.gameType === 'halcon' && g.halcon && g.state === 'active' && !g.halcon.paused) {
          const left = Halcon.closeEarly(g.halcon, g.players, Date.now());
          if (left) {
            const dropPin = currentPin;
            hcTimer(dropPin, g, left, () => hcResolve(dropPin, g));
            io.to(dropPin).emit('hc:closing', { round: g.halcon.round, ms: left });
          }
        }
        // Schedule full cleanup after 5 minutes of inactivity
        const grabbedSocketId = socket.id;
        p.cleanupTimer = setTimeout(() => {
          const stillExists = games[currentPin];
          if (!stillExists) return;
          const stillThere = stillExists.players[grabbedSocketId];
          if (stillThere && stillThere.disconnected && stillThere.disconnectedAt &&
              Date.now() - stillThere.disconnectedAt >= 4 * 60 * 1000) {
            delete stillExists.players[grabbedSocketId];
            if (stillExists.gameType === 'paint' && stillExists.paint) io.to(currentPin).emit('pc:roster', pcRoster(stillExists));
            if (stillExists.gameType === 'trapdoor' && stillExists.td) io.to(currentPin).emit('td:roster', tdRoster(stillExists));
            broadcast(currentPin);
          }
        }, 5 * 60 * 1000);
      }
    }
  });
});

// Retired 2026-10-10: Market Quest, Color Clash, Color Splash, Flappy, Zombie, Mi Familia, Conquest, Triage, Lái-Qù-Huí, Shéi Shì, Hóngbāo Run (their tick loops were removed).

// === Single global watchdog ===
setInterval(() => {
  const now = Date.now();
  Object.entries(games).forEach(([pin, g]) => {
    if (g.state !== 'active') return;
    if (g.gameType === 'warmup') return;       // teacher-driven flashcards, no questions
    if (g.gameType === 'paint') return;        // questions are on demand («Recargar»)
    if (g.gameType === 'trapdoor') return;     // Las Trampillas: its room tick deals every question (wings, comeback)
    if (g.gameType === 'kingdoms' && g.kingdoms && g.kingdoms.paused) return;   // paused: the open questions wait
    if (g.gameType === 'snow') return;         // questions are on demand (the stations)
    if (g.gameType === 'escape' && !(g.escape && g.escape.phase === 'run' && !g.escape.paused)) return;   // only while the crew runs
    if (g.gameType === 'halcon') return;       // no questions on the phones: the boards run the rounds
    if (g.gameType === 'monopoly') return;     // Monopolio: its room tick deals every question (after the turn / the wait)
    if (g.gameType === 'dormilon') return;     // ¡No despiertes a Dralingo!: its room tick deals the turn kid's questions
    if (g.gameType === 'teamcrab') return;     // ¡Atrapa a Fénec!: its room tick deals every kid's questions
    if (g.gameType === 'dragon-eye') return;   // Vuelo del Dragón: the same (after the flight / the wait)
    if (g.gameType === 'mochi-mash' && g.mm && (g.mm.phase !== 'play' || g.mm.paused)) return;   // intro, pause, «¡FINAL!»
    if (g.gameType === 'pinata') return;       // Piñata Tigre: its room tick deals every question (after the hit / the wait)
    if (g.gameType === 'sixseven') return;     // 6-7 Swing: the same (ssTick deals every sum and calls time up)
    Object.entries(g.players).forEach(([pid, p]) => {
      const inAction = p.mashUntil > now || p.currentQ;
      if (!inAction && (!p.lastQuestionAt || now - p.lastQuestionAt > 12000)) {
        const q = nextQuestionFor(g, pid);
        if (q) {
          p.lastQuestionAt = now;
          io.to(pid).emit('question', q);
        }
      }
    });
  });
}, 4000);

// Safety net: one bad socket message or a bug in any game must never take down every class on the server.
process.on('uncaughtException', (e) => console.error('[uncaughtException]', e));
process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n  Mochi Mash running on http://localhost:${PORT}\n`);
});

// 🆕 2026-10-12 (his rule) — accounts with no activity for 30 days move to data/student-archive.json and come back by
// themselves when their code is used again (core/student-records.js). Checked 2 min after each start, then daily.
const _archiveRun = () => { try { Students.archiveInactive(); } catch (e) { console.warn('[students] archive run failed:', e.message); } };
setTimeout(_archiveRun, 2 * 60 * 1000).unref();
setInterval(_archiveRun, 24 * 60 * 60 * 1000).unref();
