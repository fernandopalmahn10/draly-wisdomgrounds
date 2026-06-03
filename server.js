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
const Assignments = require('./core/assignments');
const Teachers = require('./core/teachers');
const Guides = require('./core/guides');
const Emirati = require('./core/emirati-vocab');
const CustomAsg = require('./core/custom-assignments');
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
  transports: ['websocket', 'polling']
});

// Serve static assets. HTML pages get no-cache headers so phones always pull
// the latest markup (otherwise stale cached HTML keeps referencing old
// rewards.js / player.js versions and users see "nothing changed" after a
// deploy). Versioned CSS/JS via ?v=... are still cached aggressively.
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  },
}));
app.use(express.json({ limit: '5mb' }));
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
  res.json(out);
});

// === /api/admin/disk-status — Render persistent-disk verification ===
// Hit this from any browser with ?pw=<your admin password>. Tells you:
//   - The resolved absolute path of the data/ directory
//   - Whether it's writable RIGHT NOW
//   - Stats on the student-records.json file
//   - A "persistence likely" heuristic (file exists + writable + recently modified)
// Use this to confirm your Render Disk is mounted at the correct path
// before relying on per-student history surviving across deploys.
app.get('/api/admin/disk-status', (req, res) => {
  const fs = require('fs');
  const givenPw = String(req.query.pw || req.query.password || '');
  const expected = process.env.WU_ADMIN_PASSWORD || 'draly2026';
  if (givenPw !== expected) return res.status(401).json({ error: 'wrong password' });

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
  const givenPw = String(req.query.pw || req.query.password || '').trim();
  // Legacy super-admin passwords still grant full access for the live
  // warmup-host flow (host-warmup.html unlock). These bypass the
  // teachers table entirely.
  const wuPw = process.env.WU_ADMIN_PASSWORD || 'draly2026';
  if (givenPw === wuPw) {
    return { teacher: null, isSuperAdmin: true, legacy: true };
  }
  // Otherwise look up as a teacher code
  const teacher = Teachers.getByTeacherId(givenPw);
  if (!teacher) {
    res.status(401).json({ ok: false, error: 'wrong password' });
    return null;
  }
  Teachers.touchLastSeen(teacher.teacherId);
  return { teacher, isSuperAdmin: !!teacher.isSuperAdmin, legacy: false };
}
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
  const wordCap = Math.max(1, Math.min(20, parseInt(req.query.wordCap, 10) || 10));
  const sentenceCap = Math.max(1, Math.min(40, parseInt(req.query.sentCap, 10) || 20));
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
// Register-text endpoint — client POSTs Arabic text, gets back a stable
// ID it can use with the proven /:wordId audio endpoint.
app.post('/api/emirati/audio/register', (req, res) => {
  const ar = String((req.body && req.body.ar) || '').trim();
  if (!ar) return res.status(400).json({ ok: false });
  const id = 's_' + _registerSentenceText(ar);
  res.json({ ok: true, id });
});
app.get('/api/emirati/audio/:wordId', (req, res) => {
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
  if (process.env.AZURE_SPEECH_KEY) {
    // ⭐ Sentence IDs (s_<hash>) → look up the registered Arabic text.
    // Falls through to the same _azureSpeak → _serveAudioFile path
    // that words use, which we know works.
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
    const outPath = _emPath.join(EMIRATI_AUDIO_DIR, cacheBaseName + '.mp3');
    return _azureSpeak(textToSpeak, voice, outPath, (err, buf) => {
      if (err) {
        console.warn('[azure-tts] failed for', id, err.message);
        return res.status(404).end();
      }
      _serveAudioFile(res, outPath, buf);
    });
  }
  res.status(404).end();
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
  if (!process.env.AZURE_SPEECH_KEY) {
    console.warn('[azure-text] AZURE_SPEECH_KEY not set!');
    return res.status(404).end();
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
        console.warn('[azure-text] Azure error body:', errBody.slice(0, 300));
        if (!res.headersSent) res.status(502).json({ error: 'azure ' + azureResp.statusCode, body: errBody.slice(0, 300) });
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
  const rec = Students.get(req.params.code);
  if (!rec) return res.json({ ok: true, assignments: [] });
  const list = CustomAsg.listForStudent(rec.code).map((a) => ({
    id: a.id,
    title: a.title,
    instructions: a.instructions,
    itemCount: a.items.length,
    createdAt: a.createdAt,
    teacherId: a.teacherId,
  }));
  res.json({ ok: true, assignments: list });
});
app.get('/api/homework/custom-assignment/:id', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const rec = Students.get(req.query.studentCode);
  if (!rec) return res.status(404).json({ ok: false, error: 'estudiante no encontrado' });
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
  const rec = Students.get(studentCode);
  if (!rec) return res.status(404).json({ ok: false, error: 'estudiante no encontrado' });
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
  let students = Students.listAll();
  // Filter by the teacher's classroom access codes. Super admin sees
  // everyone (including legacy students without a classroomCode).
  if (!session.isSuperAdmin && session.teacher) {
    const codes = new Set((session.teacher.accessCodes || []));
    students = students.filter((s) => s.classroomCode && codes.has(s.classroomCode));
  }
  res.json({
    ok: true,
    students,
    self: session.teacher ? {
      teacherId: session.teacher.teacherId,
      displayName: session.teacher.displayName,
      isSuperAdmin: session.isSuperAdmin,
      accessCodes: session.teacher.accessCodes,
    } : { isSuperAdmin: true, legacy: true },
  });
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
  });
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
  const fromId   = session.teacher ? session.teacher.teacherId   : 'super';
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
  const rec = Students.get(req.params.code);
  if (!rec) return res.status(404).json({ ok: false, error: 'no student' });
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
  const rec = Students.get(req.params.code);
  if (!rec) return res.status(404).json({ ok: false, error: 'no student' });
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
  const fromId   = session.teacher ? session.teacher.teacherId   : 'super';
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
  const fromId   = session.teacher ? session.teacher.teacherId   : 'super';
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
  const rec = Students.get(code);
  if (!rec) return res.status(404).json({ ok: false, error: 'student not found' });
  rec.lastSeen = Date.now();   // ← presence heartbeat
  const inbox = Students.getInbox(rec.code, 30);
  const unread = inbox.filter((m) => !m.readAt).length;
  res.json({ ok: true, inbox, unread });
});

// Dedicated presence ping — homework page can hit this even when it
// doesn't need anything from the inbox. Just bumps lastSeen.
app.post('/api/homework/ping', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const { studentCode } = req.body || {};
  const rec = Students.get(studentCode);
  if (!rec) return res.status(404).json({ ok: false, error: 'student not found' });
  rec.lastSeen = Date.now();
  res.json({ ok: true, lastSeen: rec.lastSeen });
});

// Mark a single message read
app.post('/api/homework/inbox/:msgId/read', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const { studentCode } = req.body || {};
  const ok = Students.markMessageRead(studentCode, req.params.msgId);
  res.json({ ok });
});

// Mark all messages read (when the kid opens the inbox modal)
app.post('/api/homework/inbox/read-all', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const { studentCode } = req.body || {};
  const count = Students.markAllMessagesRead(studentCode);
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
  const { displayName, email, country } = req.body || {};
  if (!displayName) return res.status(400).json({ ok: false, error: 'displayName required' });
  const t = Teachers.createTeacher({ displayName, email, country });
  res.json({ ok: true, teacher: t });
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
function _hwCheckAccess(req, res) {
  const code = req.body && req.body.accessCode
            || req.query && req.query.accessCode
            || '';
  if (!Assignments.isAccessCodeValid(code)) {
    res.status(401).json({ ok: false, error: 'Código de acceso incorrecto' });
    return false;
  }
  return true;
}

app.post('/api/homework/enter', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  try {
    const { studentCode, displayName, accessCode, meta } = req.body || {};
    const rec = Students.getOrCreate(studentCode, displayName);
    // Tag with their teacher's classroom code. Guard so a failure here
    // never blocks the kid from entering — they can still do tareas.
    if (accessCode) {
      try { Students.setClassroomCode(rec.code, accessCode); }
      catch (e) { console.warn('[hw:enter] setClassroomCode failed:', e.message); }
    }
    // Best-effort device / country / locale capture (client-supplied, since
    // we can't read the real IP behind Render's proxy). Lets the teacher
    // spot duplicates + ban a device from the Cuaderno. Never blocks entry.
    try {
      if (meta && typeof meta === 'object') Students.setMeta(rec.code, meta);
    } catch (e) { console.warn('[hw:enter] setMeta failed:', e.message); }
    res.json({
      ok: true,
      studentCode: rec.code,
      displayName: rec.displayName,
      avatar: rec.avatar || null,
      avatarOptions: Students.AVATAR_OPTIONS,
      classroomCode: rec.classroomCode || null,
      assignments: Assignments.listAssignments(),
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
  const ok = Students.setAvatar(studentCode, avatar);
  if (!ok) return res.status(400).json({ ok: false, error: 'avatar inválido o estudiante no encontrado' });
  res.json({ ok: true });
});
// Let a kid rename themselves from the portal settings.
app.post('/api/homework/rename', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const { studentCode, displayName } = req.body || {};
  const ok = Students.setDisplayName(studentCode, displayName);
  if (!ok) return res.status(400).json({ ok: false, error: 'nombre inválido o estudiante no encontrado' });
  const rec = Students.get(studentCode);
  res.json({ ok: true, displayName: rec ? rec.displayName : null });
});
// Reset a kid's submissions for a specific assignment (clean slate).
app.post('/api/homework/reset', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const { studentCode, assignmentId } = req.body || {};
  if (!assignmentId) return res.status(400).json({ ok: false, error: 'assignmentId requerido' });
  const removed = Students.resetAssignmentSubmissions(studentCode, assignmentId);
  res.json({ ok: true, removed });
});
// 👨‍👩‍👧 Parent view — returns a digest of what the kid has learned, in
// Spanish, derived from their completed assignments + reading-mode tests.
// No password, just access code + student code (parent uses same as kid).
app.get('/api/homework/insights/:code', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const rec = Students.get(req.params.code);
  if (!rec) return res.status(404).json({ ok: false, error: 'Estudiante no encontrado' });
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
  const allAssignments = Assignments.listAssignments();
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
  res.json({
    ok: true,
    code: rec.code,
    displayName: rec.displayName,
    avatar: rec.avatar || '🧒🏼',
    insights,
    tests: uniqueTests,
    remaining,
    conversationPrompts,
    sentenceDetail,
    totals: {
      assignmentAttempts:    subs.length,
      assignmentsMastered:   insights.length,
      assignmentsAvailable:  allAssignments.length,
      assignmentsRemaining:  remaining.length,
      readingTestsTaken:     uniqueTests.length,     // unique stories, NOT total attempts
      readingTestAttempts:   tests.length,
      // Estimated vocab (user feedback 2026-05-27: "make a word count
      // — palabras aprendidas, oraciones, estimated").
      wordsLearned:          learnedWords.size,
      wordsTotalHsk1:        150,
      sentencesCorrect,
      sentencesAttempted,
      // 🌱 Lifetime saved-sentence count — drives the parent 0→2000 progress
      // bar. Every save (warmup save, daily-bonus, edited copy) increments it.
      sentencesSavedTotal:   (rec.sentencesBuilt || []).length,
      sentencesSavedGoal:    2000,
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

app.get('/api/homework/assignment/:id', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const a = Assignments.getAssignment(req.params.id);
  if (!a) return res.status(404).json({ ok: false, error: 'Asignación no encontrada' });
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
    const rec = Students.get(req.query.studentCode);
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

app.post('/api/homework/submit', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const { studentCode, assignmentId, answers, accessCode } = req.body || {};
  const a = Assignments.getAssignment(assignmentId);
  if (!a) return res.status(404).json({ ok: false, error: 'Asignación no encontrada' });
  const rec = Students.get(studentCode);
  if (!rec) return res.status(401).json({ ok: false, error: 'Código de estudiante inválido — vuelve a entrar' });
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
      title:     story.title,
      subtitle:  story.subtitle,
      pageCount: story.pages.length,
      coverImage:  '/assets/reading/' + s.id + '/page-1.png',
      available: triedInClass || READING_UNLOCKED_FOR_ALL,
      triedInClass,
      bestScore: best ? best.score : null,
      attempts:  priorAttempts.filter((t) => t.storyId === s.id).length,
    };
  });
}

// 📚 Public stories list, grouped by HSK1 experience — used by the
// Modo Maestro story picker. Returns every story with its `exp` tag
// so the client can render folders (EXP1 has Pīnpīn, EXP8 has XiǎoMíng).
app.get('/api/reading/stories', (req, res) => {
  res.json({ ok: true, stories: ReadingStory.listStories() });
});

// 🏆 HSK SIMULATION ENDPOINTS ===========================================
// List available simulations (just metadata).
app.get('/api/hsk-sim/list', (req, res) => {
  res.json({ ok: true, sims: HskSim.listSims() });
});
// Auth helper for HSK endpoints — accept EITHER a valid HSK PIN OR a
// homework access code. PIN flow is now the primary path (kids type
// the 4-digit PIN to enter the room), and the homework access code
// remains valid as the legacy fallback for force-impose users who
// don't go through the PIN gate. This was the root cause of
// "código de acceso incorrecto" — the kid was passing the PIN as
// accessCode and the homework validator was rejecting it.
function _hskAuth(req, res) {
  const pin = String(req.query.pin || (req.body && req.body.pin) || '').trim();
  // Authoritative source: real games[] table (same reliability as
  // every other live game). Falls through to disk-persisted HSK_ROOMS
  // if the dyno restarted before the kid joined, and finally to the
  // homework classroom-code check for legacy force-impose URLs.
  if (pin) {
    const g = games[pin];
    if (g && g.gameType === 'hsksim') return true;
    if (HSK_ROOMS.has(pin)) return true;
  }
  return _hwCheckAccess(req, res);
}

// Fetch a simulation's full payload (correct answers stripped client-side).
// Auth: valid PIN OR valid classroom access code.
app.get('/api/hsk-sim/:simId', (req, res) => {
  if (!_hskAuth(req, res)) return;
  const payload = HskSim.buildSimPayload(req.params.simId);
  if (!payload) return res.status(404).json({ ok: false, error: 'unknown sim' });
  res.json({ ok: true, sim: payload });
});
// Submit answers, grade them, persist to student record.
app.post('/api/hsk-sim/:simId/submit', (req, res) => {
  if (!_hskAuth(req, res)) return;
  const { studentCode, answers } = req.body || {};
  const rec = Students.get(studentCode);
  if (!rec) return res.status(404).json({ ok: false, error: 'estudiante no encontrado' });
  const result = HskSim.gradeSim(req.params.simId, answers || {});
  if (!result) return res.status(404).json({ ok: false, error: 'unknown sim' });
  // Persist into student.hskResults so the Cuaderno can show it later.
  if (!Array.isArray(rec.hskResults)) rec.hskResults = [];
  rec.hskResults.push({
    simId: req.params.simId,
    score: result.score,
    total: result.total,
    percent: result.percent,
    ts: Date.now(),
  });
  try { Students._save && Students._save(); } catch (_) {}
  res.json({ ok: true, result });
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
const HSK_ROOMS_FILE = path.join(__dirname, 'data', 'hsk-rooms.json');
const HSK_ROOMS = new Map();   // pin → { pin, simId, createdAt, fx, hostHeartbeat }

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
    if ((room.createdAt || 0) < cutoff) { HSK_ROOMS.delete(pin); changed = true; }
  }
  if (changed) _hskRoomsSave();
}, 10 * 60 * 1000);

// ─── Helpers that bridge HSK rooms to the shared `games` Map ────────
// We register HSK rooms in the same games[pin] table that every other
// live game uses (reading, warmup, identity, …). This gives HSK the
// same reliability — host:reclaim, the 60-min grace timer, broadcast,
// socket-room delivery. PIN can also be entered through /player.html
// because the kids' framework already validates against games[pin].
function _hskGameLookup(pin) {
  let g = games[pin];
  if (g && g.gameType === 'hsksim') return g;
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
    createdAt: legacy.createdAt || Date.now(),
    duration: 3600,
    startedAt: null, endsAt: null,
    questions: [],
    players: {},
    teamScores: { red: 0, gold: 0 },
    feed: [],
    grid: null, vendors: null,
    hsk: { simId: legacy.simId, fx: legacy.fx || null, sessions: {} },
  };
  return games[pin];
}

// Teacher creates a room — admin-auth via ?pw=
app.post('/api/hsk-sim/room/create', (req, res) => {
  const session = _adminAuth(req, res);
  if (!session) return;
  const simId = (req.body && req.body.simId) || (req.query && req.query.simId);
  if (!simId || !HskSim.buildSimPayload(simId)) {
    return res.status(400).json({ ok: false, error: 'unknown simId' });
  }
  // ⭐ Reliability fix: PIN now lives in the same `games` table as
  // every working game (lecture, warmup, etc.). Drops the in-memory
  // HSK_ROOMS map that was getting wiped on dyno restart and that
  // /player.html couldn't see (root cause of "no game with that PIN"
  // reported 2026-06-03).
  const pin = genPin();
  games[pin] = {
    gameType: 'hsksim',
    state: 'lobby',
    hostId: null,                 // no socket host page right now (HTTP-driven)
    createdAt: Date.now(),
    duration: 3600,
    startedAt: null, endsAt: null,
    questions: [],
    players: {},                  // kids who join via socket land here
    teamScores: { red: 0, gold: 0 },
    feed: [],
    grid: null, vendors: null,
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
  HSK_ROOMS.set(pin, { pin, simId, createdAt: Date.now(), fx: null });
  _hskRoomsSave();
  res.json({ ok: true, pin, simId });
});

// Look up the simId for a PIN. Now checks games[] FIRST (the
// authoritative source), then falls back to HSK_ROOMS for any rooms
// loaded from disk after a restart.
app.get('/api/hsk-sim/room/:pin', (req, res) => {
  const pin = req.params.pin;
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
  const fxState = on ? { id: String(fx || ''), since: Date.now() } : null;
  if (g)      g.hsk.fx = fxState;
  if (legacy) legacy.fx = fxState;
  _hskRoomsSave();
  res.json({ ok: true, fx: fxState });
});
app.post('/api/hsk-sim/heartbeat', (req, res) => {
  const { pin, simId, accessCode, studentCode, cursor, total, answered, section, status } = req.body || {};
  // PIN is the new room key. accessCode is retained for back-compat
  // with old force-impose flows. Either path produces a sessionKey
  // that the teacher can poll on.
  const roomKey = pin || accessCode || simId;
  if (!roomKey || !studentCode) {
    return res.status(400).json({ ok: false, error: 'pin (or accessCode) + studentCode required' });
  }
  const key = _hskSessionKey(roomKey, studentCode);
  const rec = Students.get(studentCode);
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
  res.json({ ok: true, stories: _hwReadingListFor(code) });
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
    const rec = Students.get(studentCode);
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
      imageUrl:   '/assets/reading/' + story.id + '/page-' + p.pageNum + '.png',
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
  const rec = Students.get(studentCode);
  if (!rec) return res.status(401).json({ ok: false, error: 'Código de estudiante inválido' });
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
  const rec = Students.get(req.query.studentCode);
  if (!rec || !Array.isArray(rec.testResults)) return res.json({ ok: true, attempt: null });
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
  const rec = Students.get(req.params.code);
  if (!rec) return res.json({ ok: true, sentences: [] });
  res.json({ ok: true, sentences: Students.getHistory(rec.code, 100) });  // newest-first
});
// Kid deletes ONE of their own saved sentences (junk / accidental save).
app.post('/api/homework/sentences/delete', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const { studentCode, ts } = req.body || {};
  const rec = Students.get(studentCode);
  if (!rec) return res.status(404).json({ ok: false, error: 'estudiante no encontrado' });
  const ok = Students.deleteHistoryEntry(rec.code, ts);
  res.json({ ok, sentences: Students.getHistory(rec.code, 100) });
});
// Kid saves an EDITED copy of one of their sentences. Per user intent the
// original is preserved — this appends a brand-new entry with the reordered/
// trimmed word list ("save as a copy of the sentence they started with").
app.post('/api/homework/sentences/save', (req, res) => {
  if (!_hwCheckAccess(req, res)) return;
  const { studentCode, words } = req.body || {};
  const rec = Students.get(studentCode);
  if (!rec) return res.status(404).json({ ok: false, error: 'estudiante no encontrado' });
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
  const rec = Students.get(req.query.studentCode);
  if (!rec) return res.status(404).json({ ok: false, error: 'estudiante no encontrado' });
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
  const rec = Students.get(studentCode);
  if (!rec) return res.status(404).json({ ok: false, error: 'estudiante no encontrado' });
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
  const rec = Students.get(studentCode);
  if (!rec) return res.status(404).json({ ok: false, error: 'estudiante no encontrado' });
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
  const rec = Students.get(req.query.studentCode);
  if (!rec) return res.json({ ok: true, attempt: null });
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
  const cachePath = _ttsCachePath(text, voice);
  // Cache hit → stream from disk, ~5ms
  if (fs.existsSync(cachePath)) {
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=2592000');  // 30 days
    return fs.createReadStream(cachePath).pipe(res);
  }
  // Cache miss → synthesize via Google Cloud TTS
  const client = _getTtsClient();
  if (!client) return res.status(503).json({ ok: false, error: 'TTS not configured' });
  try {
    // Convert pinyin → hanzi for true Mandarin pronunciation. Sending
    // "wo ai mama" to a cmn-CN voice produces a confused tone-deaf
    // reading. Sending "我爱妈妈" produces native pronunciation. SKIP this
    // conversion for non-Mandarin voices (Arabic etc.) — the conversion
    // would mangle the native script.
    const isMandarin = /^(cmn|zh)-/.test(voice);
    const synthText = isMandarin ? _convertPinyinToHanzi(text) : text;
    console.log('[tts] synth voice=' + voice + ' text=' + JSON.stringify(text) + ' → ' + JSON.stringify(synthText));
    const [out] = await client.synthesizeSpeech({
      input: { text: synthText },
      voice: { languageCode: _languageCodeFromVoice(voice), name: voice },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 0.85,    // ~15% slower so kids can mimic
        pitch: 0.0,
      },
    });
    if (!out || !out.audioContent) {
      return res.status(502).json({ ok: false, error: 'no audio returned' });
    }
    // Persist for next time, then stream this response
    fs.writeFile(cachePath, out.audioContent, (err) => {
      if (err) console.warn('[tts] failed to cache', cachePath, err.message);
    });
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=2592000');
    res.end(out.audioContent);
  } catch (e) {
    console.error('[tts] synthesize failed for', JSON.stringify(text), ':', e.message);
    res.status(502).json({ ok: false, error: 'tts failed: ' + e.message });
  }
});

// Friendly redirect: students can type /homework or /tarea — both work.
// The Modo-Maestro auto-exit redirect lands on /homework?code=...&from=maestro,
// so this route MUST exist (and preserve the query string). Without it the
// kid hits a 502/404 on exit.
app.get(['/tarea', '/tareas'], (req, res) => res.redirect('/homework.html'));
app.get('/homework', (req, res) => {
  res.sendFile(_emPath.join(__dirname, 'public', 'homework.html'));
});

// Record the server boot time so the heartbeat above can be compared
// across deploys. If your disk is genuinely persistent, the heartbeat
// file from a PREVIOUS boot will still be there when this boots again.
const serverStartTime = new Date().toISOString();

// ---- Question Sets API ----
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

const games = {};

const MASH_DURATION_MS = 5000;
const TAP_MIN_INTERVAL_MS = 70;
const COMBO_WINDOW_MS = 1000;
const COMBO_THRESHOLD = 8;
const WRONG_PENALTY = 3;
const COUNTDOWN_MS = 3500;

// Color Splash — bigger map + wide brush stroke (paints a cross pattern per step)
const CS_GRID_W = 30;
const CS_GRID_H = 18;
const CS_WALK_DURATION_MS = 5500;   // walk-window burst
const CS_MOVE_COOLDOWN_MS = 100;    // ~10 steps/sec — even across phones/tablets
const CS_WRONG_AUTO_PAINTS = 5;     // wrong answer = enemy splashes 5 cells

// Pickups — school items scattered on the rice paper
const CS_PICKUP_RADIUS = 1;         // grid cells of detection (adjacent or on)
const CS_PICKUP_BONUS_RADIUS = 1;   // 3x3 splat around the pickup
const CS_PICKUP_RESPAWN_MS = 15000; // 15-sec respawn
const CS_PICKUPS = [
  { id: 0,  x: 5,  y: 3,  icon: '📚' },
  { id: 1,  x: 15, y: 2,  icon: '📜' },
  { id: 2,  x: 25, y: 3,  icon: '🍎' },
  { id: 3,  x: 10, y: 8,  icon: '✏️' },
  { id: 4,  x: 20, y: 8,  icon: '🖌' },
  { id: 5,  x: 5,  y: 14, icon: '📕' },
  { id: 6,  x: 15, y: 15, icon: '📖' },
  { id: 7,  x: 25, y: 14, icon: '📒' },
  { id: 8,  x: 2,  y: 9,  icon: '🧧' },
  { id: 9,  x: 27, y: 9,  icon: '📃' }
];

// Color Clash (market theme, continuous movement, energy-based)
// Tuned for "answer questions often" — players burn through energy fast
const CC_GRID_W = 30;
const CC_GRID_H = 18;
const CC_MOVE_COOLDOWN_MS = 110; // 9 steps/sec max
const CC_START_ENERGY = 20;     // burns out in ~20 moves
const CC_ENERGY_PER_TILE = 1;
const CC_CORRECT_ENERGY = 12;   // ~12 more moves per correct answer
const CC_WRONG_ENEMY_PAINTS = 4;

// Market Quest (Canvas-based RPG) — players walk around a market,
// approach vendor NPCs, answer vocab questions to claim items.
const MQ_WORLD_W = 1600;   // game world width in "game pixels"
const MQ_WORLD_H = 900;    // game world height
const MQ_PLAYER_SPEED = 4; // pixels per server tick
const MQ_VENDOR_RADIUS = 130; // collision radius for vendor interaction (forgiving)
const MQ_TICK_MS = 50;       // 20Hz server tick

// Flappy Dragon — each player has their own parallel-play world.
// Tap to flap, gravity drops you, scrolling pipes, die = answer-to-revive.
const FL_WORLD_W = 800;
const FL_WORLD_H = 480;
const FL_GRAVITY = 0.5;      // px/tick² (downward acceleration)
const FL_FLAP_VY = -7.5;     // upward velocity on tap
const FL_SCROLL_SPEED = 3;   // px/tick (~60 px/sec)
const FL_PIPE_GAP = 160;     // vertical gap between top + bottom rocks
const FL_PIPE_W = 80;        // pipe width
const FL_PIPE_SPACING = 280; // horizontal spacing between pipe pairs
const FL_PLAYER_X = 180;     // fixed x position of the player's plane on screen
const FL_PLAYER_R = 28;      // collision radius
const FL_TICK_MS = 33;       // ~30Hz tick
// Vendor positions. Each vendor occupies a spot. The mapping to vocab question
// happens at game start based on the loaded set. food sprite index from food-tiles.png
const MQ_VENDORS = [
  { id: 0,  x: 240,  y: 220,  icon: '🍎' },
  { id: 1,  x: 560,  y: 220,  icon: '🍵' },
  { id: 2,  x: 880,  y: 220,  icon: '🥟' },
  { id: 3,  x: 1200, y: 220,  icon: '🥢' },
  { id: 4,  x: 1360, y: 460,  icon: '💰' },
  { id: 5,  x: 1200, y: 700,  icon: '🍚' },
  { id: 6,  x: 880,  y: 700,  icon: '🥮' },
  { id: 7,  x: 560,  y: 700,  icon: '🍡' },
  { id: 8,  x: 240,  y: 700,  icon: '🏮' },
  { id: 9,  x: 80,   y: 460,  icon: '🛍️' },
  { id: 10, x: 720,  y: 460,  icon: '🍶' }
];
const MQ_VENDOR_POINTS = 5;
const MQ_PICKUP_POINTS = 1;
const MQ_PICKUP_RADIUS = 50;
const MQ_PICKUP_RESPAWN_MS = 20000; // pickup reappears 20s after being grabbed

// Pickup positions — scattered food items on the market floor, between vendors.
// Walking over one = +1 team point + sound + sparkle. Respawns after 20s.
const MQ_PICKUPS = [
  { id: 0,  x: 400,  y: 110, icon: '🍊' },
  { id: 1,  x: 720,  y: 110, icon: '🍇' },
  { id: 2,  x: 1040, y: 110, icon: '🥭' },
  { id: 3,  x: 1300, y: 340, icon: '🍓' },
  { id: 4,  x: 1300, y: 580, icon: '🍍' },
  { id: 5,  x: 1040, y: 800, icon: '🍐' },
  { id: 6,  x: 720,  y: 800, icon: '🍒' },
  { id: 7,  x: 400,  y: 800, icon: '🥝' },
  { id: 8,  x: 160,  y: 580, icon: '🍋' },
  { id: 9,  x: 160,  y: 340, icon: '🌽' },
  { id: 10, x: 480,  y: 460, icon: '🥬' },
  { id: 11, x: 800,  y: 360, icon: '🌶' },
  { id: 12, x: 1120, y: 460, icon: '🥒' },
  { id: 13, x: 320,  y: 280, icon: '🍅' },
  { id: 14, x: 960,  y: 280, icon: '🥕' },
  { id: 15, x: 320,  y: 620, icon: '🍆' },
  { id: 16, x: 960,  y: 620, icon: '🥥' },
  { id: 17, x: 800,  y: 560, icon: '🍑' }
];

// Map Chinese vocab → matching emoji. Used so the collection toast shows
// the right icon (was using the vendor's static icon, which mismatched).
const VOCAB_EMOJI = {
  '苹果': '🍎', '水': '💧', '茶': '🍵', '米饭': '🍚', '菜': '🥬',
  '钱': '💰', '块': '💵', '吃': '🍽', '喝': '🥤', '买': '🛒',
  '商店': '🏪', '饭店': '🍱', '杯子': '🥛', '水果': '🍇',
  '东西': '📦', '多少': '🔢', '请': '🙏', '谢谢': '🙏',
  '不客气': '😊', '好': '👍', '想': '💭', '喜欢': '❤️'
};
// === Zombie Escape (末日逃生) constants ===
// Each team has a survivor sprinting toward the safe zone with a zombie wave
// closing in. Correct answer → 5s sprint window where every tap = step
// forward. Wrong answer → zombies gain ground on that team's survivor.
// Win = first survivor to reach the safe zone. Lose = zombies catch you.
const ZB_TRACK_LEN     = 200;   // total distance to safe zone
const ZB_SPRINT_MS     = 5000;  // sprint mode duration after correct answer
const ZB_ZOMBIE_GAIN   = 8;     // distance zombies advance on a wrong answer
const ZB_WRONG_SETBACK = 8;     // survivor steps back this many m on wrong answer
const ZB_ZOMBIE_START_BACK = 60; // how far behind the survivor zombies start
const ZB_HP_BCAST_MS   = 100;

// === Mi Familia (Family House Tycoon) constants ===
// Each team builds out a 4-room house: Sala / Cocina / Dormitorio / Jardín.
// Correct answer awards the player a random token (family member, pet, or
// furniture). They tap a room on their phone to place it. The host screen
// shows both team houses in real time, getting more decorated with each
// placement. Win = most items placed at time end (or first to fill all rooms).
const FM_ROOMS = ['sala', 'cocina', 'dormitorio', 'jardin'];
const FM_ROOM_LABELS = { sala: 'Sala', cocina: 'Cocina', dormitorio: 'Dormitorio', jardin: 'Jardín' };
// Each token has an emoji + which rooms it makes sense in. Items can be
// placed in `any` room or restricted to specific rooms for realism.
const FM_TOKENS = [
  { id: 'dad',    emoji: '👨',    name: 'Papá',    rooms: ['sala', 'cocina', 'dormitorio'] },
  { id: 'mom',    emoji: '👩',    name: 'Mamá',    rooms: ['sala', 'cocina', 'dormitorio'] },
  { id: 'kid',    emoji: '🧒',    name: 'Hijo',    rooms: ['sala', 'dormitorio', 'jardin'] },
  { id: 'baby',   emoji: '👶',    name: 'Bebé',    rooms: ['sala', 'dormitorio'] },
  { id: 'gran',   emoji: '👵',    name: 'Abuela',  rooms: ['sala', 'cocina'] },
  { id: 'grandpa',emoji: '👴',    name: 'Abuelo',  rooms: ['sala', 'jardin'] },
  { id: 'dog',    emoji: '🐕',    name: 'Perro',   rooms: ['sala', 'jardin'] },
  { id: 'cat',    emoji: '🐱',    name: 'Gato',    rooms: ['sala', 'dormitorio', 'jardin'] },
  { id: 'fish',   emoji: '🐠',    name: 'Pez',     rooms: ['sala'] },
  { id: 'sofa',   emoji: '🛋',     name: 'Sofá',    rooms: ['sala'] },
  { id: 'tv',     emoji: '📺',    name: 'TV',      rooms: ['sala'] },
  { id: 'lamp',   emoji: '💡',    name: 'Lámpara', rooms: ['sala', 'dormitorio'] },
  { id: 'fridge', emoji: '🧊',    name: 'Nevera',  rooms: ['cocina'] },
  { id: 'stove',  emoji: '🍳',    name: 'Estufa',  rooms: ['cocina'] },
  { id: 'pot',    emoji: '🍲',    name: 'Olla',    rooms: ['cocina'] },
  { id: 'noodle', emoji: '🍜',    name: 'Fideos',  rooms: ['cocina'] },
  { id: 'tea',    emoji: '🍵',    name: 'Té',      rooms: ['cocina', 'sala'] },
  { id: 'bed',    emoji: '🛏',     name: 'Cama',    rooms: ['dormitorio'] },
  { id: 'book',   emoji: '📚',    name: 'Libros',  rooms: ['dormitorio', 'sala'] },
  { id: 'plant',  emoji: '🪴',    name: 'Planta',  rooms: ['jardin', 'sala'] },
  { id: 'flower', emoji: '🌸',    name: 'Flores',  rooms: ['jardin'] },
  { id: 'tree',   emoji: '🌳',    name: 'Árbol',   rooms: ['jardin'] },
  { id: 'bike',   emoji: '🚲',    name: 'Bici',    rooms: ['jardin'] },
  { id: 'sun',    emoji: '☀️',    name: 'Sol',     rooms: ['jardin'] },
  { id: 'lantern',emoji: '🏮',    name: 'Farolillo', rooms: ['sala', 'jardin'] }
];
const FM_PLACE_WINDOW_MS = 8000; // player has 8s to drag

// === TRIAGE ER · 急诊室 — hospital "save the patients" game ===
// 6 hospital beds across the host's ER screen. Patients with ailments arrive
// (some critical 🚨), each with a life-timer bar that ticks down. A correct
// vocab answer earns the player a "treatment turn" — they pick WHICH PATIENT
// to treat on their phone (strategic decision, mirrors conquest's picker UX).
// Treating a critical patient gives more points but their life decays faster.
// Random events: 🚑 ambulance multi-spawn, ⚡ code blue (mass-critical),
// 🩸 transfusion bonus (mass-heal). Win = team with most lives saved.
const TR_BEDS = 6;                          // bedIdx 0..5
const TR_TICK_MS = 250;                     // life-decay cadence
const TR_LIFE_MAX = 100;                    // every patient's full bar = 100
const TR_SPAWN_TRY_MS = 3200;               // try-spawn new patient cadence
const TR_SPAWN_PROB_PER_TRY = 0.85;         // chance an empty bed gets filled
const TR_AMBULANCE_INTERVAL_MS = 22000;     // multi-spawn event cadence
const TR_CODE_BLUE_INTERVAL_MS = 28000;     // turn a random patient critical
const TR_TRANSFUSION_INTERVAL_MS = 38000;   // heal everyone by 30%
const TR_PICK_COUNT = 4;                    // patient cards shown on player picker
const TR_NORMAL_POINTS = 10;                // points for treating a normal patient
const TR_CRITICAL_POINTS = 25;              // points for treating a critical patient
const TR_DEATH_PENALTY_POINTS = 0;          // no penalty — softer feel for kids
// Built-in HSK1 medical/family vocab so triage runs without a teacher-
// uploaded set. Each entry is the shape g.questions expects: { text,
// correct, answers }. Mix: location words (yīyuàn, yīshēng), family
// (māma, bàba), where-questions (zài nǎr), states (téng, bù shūfu).
const TRIAGE_DEFAULT_QUESTIONS = [
  { text: '¿Cómo se dice "hospital" en pinyin?',     correct: 'yīyuàn',    answers: ['yīyuàn', 'xuéxiào', 'shāngdiàn', 'jiā'] },
  { text: '¿Cómo se dice "doctor / médico"?',         correct: 'yīshēng',   answers: ['yīshēng', 'lǎoshī', 'péngyou', 'bàba'] },
  { text: '¿Qué significa "téng"?',                   correct: 'duele',     answers: ['duele', 'come', 'corre', 'mira'] },
  { text: '¿Cómo se dice "mamá"?',                    correct: 'māma',      answers: ['māma', 'bàba', 'gēge', 'mèimei'] },
  { text: '¿Cómo se dice "papá"?',                    correct: 'bàba',      answers: ['bàba', 'māma', 'jiějie', 'dìdi'] },
  { text: '¿Qué significa "bù shūfu"?',               correct: 'no me siento bien', answers: ['no me siento bien', 'tengo hambre', 'tengo sueño', 'estoy feliz'] },
  { text: '"Wǒ zài yīyuàn" significa…',               correct: 'estoy en el hospital', answers: ['estoy en el hospital', 'voy a casa', 'tengo frío', 'soy doctor'] },
  { text: '¿Cómo se pregunta "dónde"?',               correct: 'nǎr',       answers: ['nǎr', 'shéi', 'shénme', 'duōshao'] },
  { text: '"Wǒ jiào…" se usa para decir tu…',         correct: 'nombre',    answers: ['nombre', 'edad', 'casa', 'comida'] },
  { text: '"Wǒ … suì" — la palabra que falta es:',    correct: 'shì',       answers: ['shì', 'qù', 'hěn', 'yǒu'] },
  { text: '¿Cómo se dice "hermano mayor"?',           correct: 'gēge',      answers: ['gēge', 'dìdi', 'jiějie', 'mèimei'] },
  { text: '¿Cómo se dice "hermana mayor"?',           correct: 'jiějie',    answers: ['jiějie', 'mèimei', 'gēge', 'māma'] },
  { text: '¿Qué significa "péngyou"?',                correct: 'amigo',     answers: ['amigo', 'maestro', 'padre', 'hermano'] },
  { text: '"Xièxie" significa…',                      correct: 'gracias',   answers: ['gracias', 'hola', 'adiós', 'perdón'] },
  { text: '"Nǐ hǎo" significa…',                      correct: 'hola',      answers: ['hola', 'adiós', 'gracias', 'sí'] },
  { text: '¿Cómo se dice "agua"?',                    correct: 'shuǐ',      answers: ['shuǐ', 'chá', 'mǐfàn', 'cài'] },
  { text: '¿Qué significa "kàn yīshēng"?',            correct: 'ver al médico', answers: ['ver al médico', 'comer arroz', 'ir a casa', 'ver TV'] },
  { text: 'El número "1" en pinyin:',                 correct: 'yī',        answers: ['yī', 'èr', 'sān', 'sì'] },
  { text: 'El número "3" en pinyin:',                 correct: 'sān',       answers: ['sān', 'liù', 'qī', 'jiǔ'] },
  { text: '¿Qué significa "hěn téng"?',               correct: 'duele mucho', answers: ['duele mucho', 'mucha hambre', 'muy alto', 'muy bonito'] },
];
// Ailment pool — each defines life capacity (effective max), decay-per-tick,
// emoji, Spanish name, optional critical flag. Decay tuned so a normal
// patient lives ~30-60 seconds untreated, a critical one ~12-18 seconds.
const TR_AILMENTS = [
  { ailment: 'fever',     icon: '🤒', name: 'Fiebre',     decay: 1.1, critical: false },
  { ailment: 'injury',    icon: '🤕', name: 'Lesión',     decay: 1.3, critical: false },
  { ailment: 'nausea',    icon: '🤢', name: 'Náusea',     decay: 0.9, critical: false },
  { ailment: 'cold',      icon: '🤧', name: 'Resfriado',  decay: 0.7, critical: false },
  { ailment: 'heat',      icon: '🥵', name: 'Sofocado',   decay: 1.4, critical: false },
  { ailment: 'cold-flu',  icon: '🥶', name: 'Hipotermia', decay: 1.4, critical: false },
  { ailment: 'dizzy',     icon: '🥴', name: 'Mareo',      decay: 0.9, critical: false },
  { ailment: 'vomit',     icon: '🤮', name: 'Vómito',     decay: 1.2, critical: false },
  { ailment: 'infection', icon: '😷', name: 'Infección',  decay: 1.2, critical: false },
  // Critical ailments — pre-rolled with critical:true. Decay much faster.
  { ailment: 'cardiac',   icon: '🚨', name: 'Cardíaco',   decay: 2.4, critical: true  },
  { ailment: 'severe',    icon: '⚡', name: 'Crítico',    decay: 2.4, critical: true  },
];

function trPickAilment(forceCritical) {
  const pool = forceCritical
    ? TR_AILMENTS.filter((a) => a.critical)
    : TR_AILMENTS.filter((a) => !a.critical);
  return pool[Math.floor(Math.random() * pool.length)];
}
function trMakePatient(g, bedIdx, opts) {
  const forceCritical = !!(opts && opts.critical);
  const a = trPickAilment(forceCritical);
  const id = ++g.triage.nextPatientId;
  return {
    id,
    bedIdx,
    ailment: a.ailment,
    icon: a.icon,
    name: a.name,
    critical: a.critical,
    lifeMax: TR_LIFE_MAX,
    lifeHp: TR_LIFE_MAX,
    decay: a.decay,
    spawnedAt: Date.now(),
  };
}
// Find every alive patient sorted by urgency (lowest life-HP ratio first,
// critical bumped to top). Used to build the player's "which patient" card list.
function trUrgentPatients(g, limit) {
  const all = Object.values(g.triage.patients);
  all.sort((a, b) => {
    if (a.critical && !b.critical) return -1;
    if (b.critical && !a.critical) return 1;
    return (a.lifeHp / a.lifeMax) - (b.lifeHp / b.lifeMax);
  });
  return all.slice(0, limit || TR_PICK_COUNT);
}
// Spawn into a single empty bed. Returns the new patient or null if all full.
function trTrySpawn(g, opts) {
  const occupied = new Set(
    Object.values(g.triage.patients).map((p) => p.bedIdx)
  );
  const empty = [];
  for (let i = 0; i < TR_BEDS; i++) if (!occupied.has(i)) empty.push(i);
  if (!empty.length) return null;
  const bedIdx = empty[Math.floor(Math.random() * empty.length)];
  const patient = trMakePatient(g, bedIdx, opts || {});
  g.triage.patients[patient.id] = patient;
  g.triage.totalArrived++;
  return patient;
}

// === SHÉI SHÌ? · ¿Quién Es? — Identity Detective game ===
// Theme-focused mini-game targeting the HSK1 identity vocab the user
// reports kids struggling with: jiào (to be called), suì (years old),
// péngyou (friend), jiā (family). Each round shows a clue using these
// EXACT words and the player picks the matching suspect from a grid.
// Decoys deliberately share 1-2 attributes to force kids to read the
// whole clue, not just match on one keyword.
const ID_NAMES = ['Míng', 'Lì', 'Měi', 'Jiā', 'Hóng', 'Yǔ', 'Tiān', 'Wén', 'Ān', 'Lóng', 'Yuè', 'Yáng', 'Lín', 'Hǎi'];
const ID_AVATARS = ['👦', '👧', '🧒', '🧑', '👨', '👩', '👴', '👵', '🧓', '👨‍🦱', '👩‍🦱', '👨‍🦰', '👩‍🦰', '👱', '👱‍♀️'];
const ID_RELATIONSHIPS = [
  { pinyin: 'péngyou', hanzi: '朋友', es: 'amigo/a',  icon: '🤝' },
  { pinyin: 'gēge',    hanzi: '哥哥', es: 'h. mayor',  icon: '🧒' },
  { pinyin: 'dìdi',    hanzi: '弟弟', es: 'h. menor',  icon: '👦' },
  { pinyin: 'jiějie',  hanzi: '姐姐', es: 'h. mayor', icon: '👧' },
  { pinyin: 'mèimei',  hanzi: '妹妹', es: 'h. menor', icon: '👧' },
  { pinyin: 'érzi',    hanzi: '儿子', es: 'hijo',     icon: '👶' },
  { pinyin: 'nǚʼér', hanzi: '女儿', es: 'hija', icon: '👶' },
  { pinyin: 'bàba',    hanzi: '爸爸', es: 'papá',     icon: '👨' },
  { pinyin: 'māma',    hanzi: '妈妈', es: 'mamá',     icon: '👩' },
];
const ID_AGES = [6, 7, 8, 9, 10, 11, 12, 13];
const ID_ROUND_MS = 16000;     // 16s per round — generous for reading time

function idPickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function idMakeSuspect() {
  return {
    name: idPickRandom(ID_NAMES),
    avatar: idPickRandom(ID_AVATARS),
    age: idPickRandom(ID_AGES),
    rel: idPickRandom(ID_RELATIONSHIPS),
  };
}
// Two suspects are FULLY identical if all three identifying attributes match.
function idSameSuspect(a, b) {
  return a.name === b.name && a.age === b.age && a.rel.pinyin === b.rel.pinyin;
}
// Generate a round for a single player. Difficulty ramps with `roundNum`.
function idGenerateRound(roundNum) {
  // User feedback 2026-05-25: "too many options". Capped at 4 suspects
  // throughout the game (was scaling up to 6 then 8). 4 is enough decoy
  // pressure to make kids read all three attributes (name/age/rel) without
  // overwhelming the working-memory window during the 7-second memorize.
  const suspectCount = 4;
  const target = idMakeSuspect();
  const suspects = [target];
  let attempts = 0;
  while (suspects.length < suspectCount && attempts < 200) {
    attempts++;
    const s = idMakeSuspect();
    // Decoy bias: 35% share NAME, 25% share AGE, 25% share REL, 15% random.
    // This forces kids to read all three attributes to disambiguate.
    const r = Math.random();
    if (r < 0.35) s.name = target.name;
    else if (r < 0.60) s.age = target.age;
    else if (r < 0.85) s.rel = target.rel;
    // Reject if accidentally identical to target on ALL three attrs
    if (idSameSuspect(s, target)) continue;
    // Reject if duplicates an existing decoy
    if (suspects.some((x) => idSameSuspect(x, s))) continue;
    suspects.push(s);
  }
  // Shuffle so target isn't always first
  for (let i = suspects.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [suspects[i], suspects[j]] = [suspects[j], suspects[i]];
  }
  const targetIdx = suspects.indexOf(target);
  return {
    suspects, targetIdx,
    clue: {
      pinyin: `Wǒ jiào ${target.name}. Wǒ shì ${target.age} suì. Wǒ shì nǐde ${target.rel.pinyin}.`,
      es:     `Me llamo ${target.name}. Tengo ${target.age} años. Soy tu ${target.rel.es}.`,
    },
    startedAt: Date.now(),
    deadline: Date.now() + ID_ROUND_MS,
  };
}

// === WARM-UP MODE · sentence-builder broadcast tool ===
// Teacher-driven flashcard mode. The teacher picks Chinese words from a
// library on the host page, and the constructed sentence broadcasts live
// to every player phone. Color-coded by category so kids can see how the
// pinyin words map to Spanish word-for-word.
// No timer, no scoring, no game loop — teacher exits when ready.
const WU_ADMIN_PASSWORD = process.env.WU_ADMIN_PASSWORD || 'draly2026';

// 2026-05-27: unified admin password gate. ANY of the following grants
// admin powers in the live-game socket handlers below:
//   - WU_ADMIN_PASSWORD (legacy default 'draly2026')
//   - Any teacherId from teachers.json (so the super admin EMAAR2026 +
//     every regular teacher can host their own warmup sessions, save
//     presets, see the Cuaderno, etc., using ONE code — same one they
//     use to log into /maestro)
//
// This solves user feedback 2026-05-27: "I should be super admin and
// have that privilege everywhere — don't make me re-enter passwords."
function isAdminPassword(password) {
  if (!password) return false;
  const p = String(password).trim();
  if (p === WU_ADMIN_PASSWORD) return true;
  return !!Teachers.getByTeacherId(p);
}
// True ONLY for super-admin credentials: the legacy WU_ADMIN_PASSWORD, OR a
// teacher code whose record has isSuperAdmin:true. Used to gate super-only
// live tools (e.g. the random-Spanish prompt broadcast in Modo Maestro).
function isSuperAdminPassword(password) {
  if (!password) return false;
  const p = String(password).trim();
  if (p === WU_ADMIN_PASSWORD) return true;
  const t = Teachers.getByTeacherId(p);
  return !!(t && t.isSuperAdmin);
}

// === LÁI-QÙ-HUÍ · 来去回 Dragon Courier — directional vocab game ===
// Self-contained (no question set required). Each player is a dragon
// courier on an 8x8 top-down village map. Missions use the three target
// verbs (qù/lái/huí) plus four direction words (上下前后) for navigation:
//   - qù [place]: walk TO that place
//   - lái [place]: come TO that place (different framing, same gameplay)
//   - huí jiā: return HOME
// Difficulty ramps: tighter deadlines as missions succeed.
// === 🧧 HÓNGBĀO RUN · La Carrera de los Sobres Rojos ============
// Chinese New Year-themed Mario-Party-style board game. Setless. All
// players play in PARALLEL each round (no waiting your turn):
//   1. Server pushes the same HSK1 question to every player.
//   2. 12s window. Each player picks an answer.
//   3. Server resolves: correct → roll 1-6, wrong → roll 1-3.
//   4. Each player advances N tiles around the loop.
//   5. Whatever tile they land on fires an effect (star, hóngbāo,
//      trap, blank).
//   6. Next round.
// Win: first to PR_STAR_GOAL stars, or most stars after PR_MAX_ROUNDS.
// Vocab focus: HSK1 numbers (yī–shí) + Chinese New Year terms.
const PR_BOARD_SIZE     = 20;       // tiles in the loop
const PR_MAX_ROUNDS     = 12;       // hard cap before end-of-game
const PR_STAR_GOAL      = 3;        // first to this many stars wins
const PR_QUESTION_MS    = 12000;    // question phase window
const PR_REVEAL_MS      = 4200;     // dice + tile-effect display window
// Tile pattern around the 20-tile loop. Repeats every game so the board
// is predictable. Star tiles are placed at the "corners" of the loop for
// dramatic positioning on the visual board.
const PR_TILE_PATTERN = [
  'blank', 'hongbao', 'blank',  'star',
  'hongbao', 'blank', 'trap',   'hongbao',
  'blank', 'star',    'hongbao','blank',
  'trap',  'hongbao', 'blank',  'star',
  'hongbao','blank',  'trap',   'hongbao',
];
const PR_TILE_META = {
  star:    { icon: '⭐', es: '¡Estrella!',    label: 'Star',    stars: 1, coins: 0 },
  hongbao: { icon: '🧧', es: '¡Sobre rojo!',  label: 'Hóngbāo', stars: 0, coins: 5 },
  trap:    { icon: '🐉', es: '¡Dragón!',      label: 'Trampa',  stars: 0, coins: -3 },
  blank:   { icon: '·',  es: 'Camino libre',  label: 'Camino',  stars: 0, coins: 0 },
};
// Built-in HSK1 question bank focused on numbers + Chinese New Year
// vocabulary. Each question has { text (Spanish prompt), correct (pinyin),
// answers (4 choices including correct), tag (optional category hint). }
const PR_QUESTIONS = [
  { text: '¿Cómo se dice "1" en chino?',  correct: 'yī',   answers: ['yī','èr','sān','sì'] },
  { text: '¿Cómo se dice "2"?',           correct: 'èr',   answers: ['èr','sān','yī','wǔ'] },
  { text: '¿Cómo se dice "3"?',           correct: 'sān',  answers: ['sān','sì','èr','liù'] },
  { text: '¿Cómo se dice "5"?',           correct: 'wǔ',   answers: ['wǔ','sì','liù','qī'] },
  { text: '¿Cómo se dice "8"?',           correct: 'bā',   answers: ['bā','jiǔ','qī','shí'] },
  { text: '¿Cómo se dice "10"?',          correct: 'shí',  answers: ['shí','jiǔ','bā','sì'] },
  { text: '¿Qué significa "hóngbāo"?',    correct: 'sobre rojo', answers: ['sobre rojo','dragón','año nuevo','dumpling'] },
  { text: '¿Qué significa "nián"?',       correct: 'año',  answers: ['año','sobre','dragón','feliz'] },
  { text: '¿Qué significa "lóng"?',       correct: 'dragón', answers: ['dragón','sobre rojo','año','rojo'] },
  { text: '¿Cómo se dice "Feliz" (en gōngxǐ)?', correct: 'gōngxǐ', answers: ['gōngxǐ','xièxie','nǐ hǎo','zàijiàn'] },
  { text: '"Dàjiā" significa…',           correct: 'todos', answers: ['todos','familia','año','rojo'] },
  { text: '"Xīnnián" significa…',         correct: 'año nuevo', answers: ['año nuevo','feliz año','año viejo','fiesta'] },
  { text: '¿Qué número es "qī"?',         correct: '7',    answers: ['7','6','8','9'] },
  { text: '¿Qué número es "jiǔ"?',        correct: '9',    answers: ['9','7','8','10'] },
  { text: '¿Qué número es "liù"?',        correct: '6',    answers: ['6','5','7','8'] },
  { text: '¿Cómo se dice "rojo"?',        correct: 'hóng', answers: ['hóng','jīn','bái','hēi'] },
  { text: '¿Cómo se dice "oro"?',         correct: 'jīn',  answers: ['jīn','hóng','huáng','lǜ'] },
  { text: '"Cài" significa…',             correct: 'comida', answers: ['comida','año','rojo','feliz'] },
  { text: '"Mǐfàn" significa…',           correct: 'arroz', answers: ['arroz','sopa','té','dumpling'] },
  { text: '¿Cómo se dice "amigo"?',       correct: 'péngyou', answers: ['péngyou','māma','lǎoshī','gēge'] },
];
function prGenerateBoard() {
  return PR_TILE_PATTERN.slice(0, PR_BOARD_SIZE).map((kind, idx) => ({ kind, idx }));
}
function prPickQuestion(roundIdx) {
  // Walk the question bank so a single game doesn't repeat (12 rounds, 20 questions)
  const q = PR_QUESTIONS[roundIdx % PR_QUESTIONS.length];
  // Shuffle answer order so the correct one isn't always at index 0
  const choices = q.answers.slice().sort(() => Math.random() - 0.5);
  const correctIdx = choices.indexOf(q.correct);
  return {
    text: q.text,
    choices,
    correctIdx,
  };
}
function prRoll(correct) {
  // Correct answer → 1-6 fair die. Wrong → 1-3 only.
  const sides = correct ? 6 : 3;
  return 1 + Math.floor(Math.random() * sides);
}
function prApplyTileEffect(player, tile) {
  const meta = PR_TILE_META[tile.kind] || PR_TILE_META.blank;
  player.pr.stars = Math.max(0, (player.pr.stars || 0) + (meta.stars || 0));
  player.pr.coins = Math.max(0, (player.pr.coins || 0) + (meta.coins || 0));
  return { kind: tile.kind, ...meta };
}
function prCheckWin(g) {
  // Win if anyone reached PR_STAR_GOAL stars
  const winner = Object.values(g.players).find((p) => p.pr && (p.pr.stars || 0) >= PR_STAR_GOAL);
  return !!winner;
}
// Compute the final per-team ranking and end the game with a winner.
function prFinishGame(g, pin) {
  // Score: stars × 100 + coins (coins as tiebreaker). Per-team total.
  let redScore = 0, goldScore = 0;
  Object.values(g.players).forEach((p) => {
    const s = (p.pr && p.pr.stars || 0) * 100 + (p.pr && p.pr.coins || 0);
    p.score = s;
    if (p.team === 'red') redScore += s; else goldScore += s;
  });
  g.teamScores = { red: redScore, gold: goldScore };
  io.to(pin).emit('pr:game-over', {
    teamScores: g.teamScores,
    players: Object.entries(g.players).map(([pid, p]) => ({
      id: pid, name: p.name, team: p.team, avatar: p.avatar,
      stars: (p.pr && p.pr.stars) || 0,
      coins: (p.pr && p.pr.coins) || 0,
      tile:  (p.pr && p.pr.tile)  || 0,
      score: p.score,
    })),
  });
  // Flip server-side game state to ended so the existing end handlers run
  g.state = 'ended';
}
// Push round N's question to every player + start the answer-collection window.
function prStartRound(g, pin) {
  if (!g.partyrun || g.state !== 'active') return;
  g.partyrun.round += 1;
  if (g.partyrun.round > g.partyrun.maxRounds) {
    prFinishGame(g, pin);
    return;
  }
  g.partyrun.phase = 'question';
  g.partyrun.picks = {};
  g.partyrun.currentQuestion = prPickQuestion(g.partyrun.round - 1);
  g.partyrun.questionDeadline = Date.now() + PR_QUESTION_MS;
  // Send the question to ALL players (parallel — no "your turn" wait)
  io.to(pin).emit('pr:question', {
    round: g.partyrun.round,
    maxRounds: g.partyrun.maxRounds,
    text: g.partyrun.currentQuestion.text,
    choices: g.partyrun.currentQuestion.choices,
    deadline: g.partyrun.questionDeadline,
  });
  // Schedule the resolve phase
  if (g.partyrun.phaseTimer) clearTimeout(g.partyrun.phaseTimer);
  g.partyrun.phaseTimer = setTimeout(() => prResolveRound(g, pin), PR_QUESTION_MS);
}
// Collect all picks, roll dice, advance tiles, fire tile effects, broadcast.
function prResolveRound(g, pin) {
  if (!g.partyrun || g.state !== 'active') return;
  g.partyrun.phase = 'reveal';
  const q = g.partyrun.currentQuestion;
  const board = g.partyrun.board;
  const results = [];
  Object.entries(g.players).forEach(([pid, p]) => {
    if (!p.pr) p.pr = { tile: 0, stars: 0, coins: 0, lastRoll: 0, lastDelta: 0, lastTile: 0 };
    const pickIdx = g.partyrun.picks[pid];
    const hasAnswer = typeof pickIdx === 'number';
    const correct = hasAnswer && pickIdx === q.correctIdx;
    const roll = prRoll(correct);
    const oldTile = p.pr.tile;
    const newTile = (oldTile + roll) % PR_BOARD_SIZE;
    p.pr.tile = newTile;
    p.pr.lastRoll = roll;
    p.pr.lastDelta = roll;
    const landed = board[newTile];
    const effect = prApplyTileEffect(p, landed);
    results.push({
      id: pid,
      name: p.name,
      team: p.team,
      correct,
      hadAnswer: hasAnswer,
      pickIdx: hasAnswer ? pickIdx : -1,
      roll,
      oldTile,
      newTile,
      effect,           // { kind, icon, es, stars, coins }
      stars: p.pr.stars,
      coins: p.pr.coins,
    });
  });
  io.to(pin).emit('pr:reveal', {
    round: g.partyrun.round,
    correctIdx: q.correctIdx,
    correctText: q.choices[q.correctIdx],
    results,
  });
  // Check for end of game (someone hit star goal or round cap)
  if (prCheckWin(g)) {
    setTimeout(() => prFinishGame(g, pin), PR_REVEAL_MS + 800);
    return;
  }
  // Schedule the next round
  if (g.partyrun.phaseTimer) clearTimeout(g.partyrun.phaseTimer);
  g.partyrun.phaseTimer = setTimeout(() => prStartRound(g, pin), PR_REVEAL_MS);
}

const LQH_GRID_W = 10;
const LQH_GRID_H = 8;
// FIVE essential locations only — park + temple removed per user feedback
// ("they don't fit the courier theme"). These are the high-frequency
// HSK1 places kids will actually use in everyday sentences.
// User request 2026-05-25: drop the restaurant (cāntīng), keep hospital
// (yīyuàn). The four remaining locations are spread to four corners +
// near-corners of the 10×8 grid so every pair has a clear straight-line
// or single-turn path. Home (jiā) bottom-left; hospital top-left;
// school top-right; store bottom-right. Always a way to walk between
// any two with shàng/xià/qián/hòu only.
const LQH_LOCATIONS = [
  { id: 'jia',       pinyin: 'jiā',       hanzi: '家',   es: 'casa',     icon: '🏠', x: 1, y: 6, isHome: true },
  { id: 'yiyuan',    pinyin: 'yīyuàn',    hanzi: '医院', es: 'hospital', icon: '🏥', x: 1, y: 1 },
  { id: 'xuexiao',   pinyin: 'xuéxiào',   hanzi: '学校', es: 'escuela',  icon: '🏫', x: 8, y: 1 },
  { id: 'shangdian', pinyin: 'shāngdiàn', hanzi: '商店', es: 'tienda',   icon: '🏪', x: 8, y: 6 },
];
// === WEATHER EVENT POOL ===
// Periodically (every ~22s) the server picks a random weather event and
// broadcasts it to all players. Each event has a Chinese sentence the kids
// see/hear briefly + a visual effect overlay. Pedagogically: teaches a 6th
// vocabulary axis (weather) while breaking the rhythm of pure navigation.
// Movement is NEVER blocked — weather is decorative + reinforces vocab.
// Only RAIN — other weather vocab (sun / snow / wind / cloud) isn't yet in
// the students' covered vocabulary, so we don't surface it. User request
// 2026-05-25: "only rain because we haven't seen any other thing in the
// vocabulary yet." Easy to expand later by re-adding entries here.
const LQH_WEATHERS = [
  { kind: 'rain',  icon: '🌧',  pinyin: 'Xià yǔ le!',  hanzi: '下雨了!', es: '¡Está lloviendo!' },
];
const LQH_WEATHER_INTERVAL_MS = 22000;
const LQH_WEATHER_DURATION_MS = 8000;
// === Bonus pickup catalog — scattered randomly on empty tiles ===
// Stepping on a pickup tile collects it, awards bonus points, and a fresh
// pickup respawns after a delay. Variety of icons = visual interest like
// the Mi Familia game's object variety.
const LQH_PICKUPS = [
  { kind: 'lantern',  icon: '🏮', es: 'farolillo',   pts: 5 },
  { kind: 'cookie',   icon: '🥠', es: 'galleta',     pts: 5 },
  { kind: 'tea',      icon: '🍵', es: 'té',          pts: 4 },
  { kind: 'coin',     icon: '💰', es: 'moneda',      pts: 8 },
  { kind: 'star',     icon: '⭐', es: 'estrella',    pts: 6 },
  { kind: 'dumpling', icon: '🥟', es: 'dumpling',    pts: 5 },
];
const LQH_PICKUP_COUNT = 6;            // number of pickups alive at any time
const LQH_PICKUP_RESPAWN_MS = 4500;    // delay before a collected slot refills
const LQH_VERBS = [
  // weighted: qù most common (60%), huí (25%), lái (15%)
  ...Array(6).fill('qu'),
  ...Array(3).fill('hui'),
  ...Array(2).fill('lai'),
];
// Manhattan-distance-based deadline so all missions feel reachable but
// tight. Ramps DOWN as the player's mission counter increases.
function lqhDeadlineMs(distance, missionsDone) {
  // 2.0s per tile baseline, minus 0.05s per completed mission, floored
  const perTile = Math.max(0.9, 2.0 - missionsDone * 0.05);
  return Math.round((distance * perTile + 1.8) * 1000);
}
function lqhPickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function lqhFindLocation(id) { return LQH_LOCATIONS.find((l) => l.id === id); }
function lqhDistance(ax, ay, bx, by) { return Math.abs(ax - bx) + Math.abs(ay - by); }
// Get a list of tiles that are EMPTY (no location, no existing pickup, no player).
function lqhEmptyTiles(g) {
  const taken = new Set();
  LQH_LOCATIONS.forEach((l) => taken.add(`${l.x},${l.y}`));
  (g.laiquhui.pickups || []).forEach((p) => taken.add(`${p.x},${p.y}`));
  const tiles = [];
  for (let y = 0; y < LQH_GRID_H; y++) {
    for (let x = 0; x < LQH_GRID_W; x++) {
      if (!taken.has(`${x},${y}`)) tiles.push({ x, y });
    }
  }
  return tiles;
}
function lqhSpawnPickup(g) {
  const empties = lqhEmptyTiles(g);
  if (!empties.length) return null;
  const tile = empties[Math.floor(Math.random() * empties.length)];
  const def = lqhPickRandom(LQH_PICKUPS);
  const pickup = {
    id: 'pk_' + (++g.laiquhui.nextPickupId),
    x: tile.x, y: tile.y,
    kind: def.kind, icon: def.icon, es: def.es, pts: def.pts,
  };
  g.laiquhui.pickups.push(pickup);
  return pickup;
}
// Pick a NEW mission for this player based on current position + recent history.
function lqhGenerateMission(player) {
  const verb = lqhPickRandom(LQH_VERBS);
  let destId;
  if (verb === 'hui') {
    destId = 'jia';
  } else {
    // qù / lái can target anywhere EXCEPT the player's current location
    const playerAtId = LQH_LOCATIONS.find((l) => l.x === player.x && l.y === player.y);
    let candidates = LQH_LOCATIONS.filter((l) => !playerAtId || l.id !== playerAtId.id);
    // Avoid repeating the immediately-previous destination
    if (player.lastDestId) {
      const filtered = candidates.filter((l) => l.id !== player.lastDestId);
      if (filtered.length) candidates = filtered;
    }
    destId = lqhPickRandom(candidates).id;
  }
  const dest = lqhFindLocation(destId);
  const distance = lqhDistance(player.x, player.y, dest.x, dest.y);
  const deadlineMs = lqhDeadlineMs(distance, player.missionsDone || 0);
  return {
    verb,
    destId,
    pinyin: lqhBuildSentence(verb, dest),
    es: lqhBuildSpanish(verb, dest),
    deadline: Date.now() + deadlineMs,
    startedAt: Date.now(),
    distance,
  };
}
function lqhBuildSentence(verb, dest) {
  // Sentence shown to the player. Key word styled bold via <strong>.
  if (verb === 'qu')  return `Wǒ <strong>qù</strong> ${dest.pinyin} ${dest.icon}`;
  if (verb === 'lai') return `<strong>Lái</strong> ${dest.pinyin} ${dest.icon}`;
  if (verb === 'hui') return `Wǒ <strong>huí jiā</strong> 🏠`;
  return '';
}
function lqhBuildSpanish(verb, dest) {
  if (verb === 'qu')  return `Voy a la ${dest.es}`;
  if (verb === 'lai') return `Ven a la ${dest.es}`;
  if (verb === 'hui') return 'Vuelvo a casa';
  return '';
}
// Convert a direction tap to a (dx,dy) delta. The D-pad uses the four
// HSK1 direction words; clients send the lowercase pinyin.
//   上 shang = up    → (0, -1)
//   下 xia   = down  → (0, +1)
//   前 qian  = forward = right (the +x direction)  → (+1, 0)
//   后 hou   = back  = left  (the -x direction)    → (-1, 0)
function lqhDirToDelta(dir) {
  if (dir === 'shang') return [ 0, -1];
  if (dir === 'xia')   return [ 0,  1];
  if (dir === 'qian')  return [ 1,  0];
  if (dir === 'hou')   return [-1,  0];
  return [0, 0];
}

// === REINOS EN GUERRA · 战国 (Warring States) — battlefield conquest game ===
// A 6x4 BATTLEFIELD grid (NOT named landmarks — kids don't know Beijing/Xi'an).
// Each square is just a battlefield position with terrain (sand / hill / river).
// Two armies (Red Knights 紅龍 vs Gold Knights 金龍) start at their fortress
// rows on opposite sides. Each correct vocab answer advances a knight into
// adjacent ground — empty squares get an outpost, enemy squares get conquered
// in a sword clash (like checkers eating). The two centermost squares are
// FORTRESSES (capital equivalent — worth +5 if conquered).
//
// Tile content is THE UNIT holding it, not a place name:
//   🐎 Caballero (knight)   🏹 Arquero (archer)
//   🗡 Espadachín           🛡 Lancero (shield/spear)
// + 👑 (general) for the back-row fortresses.
const CQ_COLS = 6;
const CQ_ROWS = 4;
// Terrain types control the tile background sprite (sand/hill/river/fortress)
// but DON'T have place-name labels. Numbered positions instead.
function _cqTerrain(id) {
  // Row 0 (red fortress wall) and Row 3 (gold fortress wall) get harder terrain.
  // The center has a couple of strategic features (hill, river) for variety.
  const r = Math.floor(id / CQ_COLS);
  if ((r === 0 && (id % CQ_COLS) === 2) || (r === 3 && (id % CQ_COLS) === 3)) return 'fortress';
  if (r === 1 && (id % CQ_COLS) === 4) return 'hill';
  if (r === 2 && (id % CQ_COLS) === 1) return 'river';
  if (r === 1 && (id % CQ_COLS) === 1) return 'hill';
  if (r === 2 && (id % CQ_COLS) === 4) return 'river';
  return 'sand';
}
const CQ_TERRAIN_ICON = {
  sand:     '',        // default — no icon, just sand texture
  hill:     '⛰',
  river:    '🌊',
  fortress: '🏯',
};
const CQ_TERRITORIES = [];
for (let i = 0; i < CQ_COLS * CQ_ROWS; i++) {
  const terrain = _cqTerrain(i);
  const t = {
    id: i,
    x: i % CQ_COLS,
    y: Math.floor(i / CQ_COLS),
    terrain,
    icon: CQ_TERRAIN_ICON[terrain] || '',
  };
  // Two FORTRESS squares — one per team's back row — are the capital equivalents.
  if (i === 2) { t.isCapital = true; t.capitalOf = 'red';  } // Red fortress on row 0 col 2
  if (i === 21) { t.isCapital = true; t.capitalOf = 'gold'; } // Gold fortress on row 3 col 3
  CQ_TERRITORIES.push(t);
}

// Unit pool — when a tile gets captured, it shows one of these emojis to
// represent the soldier holding it. Picked randomly per capture so the
// battlefield reads like a real mixed army, not a row of identical icons.
const CQ_UNITS = ['🐎', '🏹', '🗡', '🛡', '🐎', '🐎']; // bias toward cavalry
function cqPickUnit() {
  return CQ_UNITS[Math.floor(Math.random() * CQ_UNITS.length)];
}

// 4-neighbor adjacency for the grid (up/down/left/right). Returns ids.
function cqAdjacent(tileId) {
  const t = CQ_TERRITORIES[tileId];
  if (!t) return [];
  const adj = [];
  CQ_TERRITORIES.forEach((other) => {
    if (other.id === tileId) return;
    const dx = Math.abs(other.x - t.x);
    const dy = Math.abs(other.y - t.y);
    if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) adj.push(other.id);
  });
  return adj;
}

// Pick the best capture target for `team` on a correct answer.
// Priority:
//   1. An ENEMY tile adjacent to any of our tiles (= conquer enemy ground)
//   2. An UNCLAIMED tile adjacent to ours (= expand outward)
//   3. An unclaimed tile adjacent to any tile (= jump start if isolated)
//   4. Our own capital (no-op but keeps the score moving)
// Returns { tileId, action } where action is 'conquered'|'expanded'|'jumped'|'reinforce'
function cqPickTarget(g, team) {
  const ownTiles = [];
  const enemyTeam = team === 'red' ? 'gold' : 'red';
  CQ_TERRITORIES.forEach((t) => {
    if (g.conquest.ownership[t.id] === team) ownTiles.push(t.id);
  });
  // Priority 1 + 2: scan neighbors of our tiles
  const candidatesEnemy = new Set();
  const candidatesEmpty = new Set();
  ownTiles.forEach((tid) => {
    cqAdjacent(tid).forEach((nid) => {
      const owner = g.conquest.ownership[nid];
      if (owner === enemyTeam) candidatesEnemy.add(nid);
      else if (!owner) candidatesEmpty.add(nid);
    });
  });
  if (candidatesEnemy.size > 0) {
    return { tileId: pickRandom([...candidatesEnemy]), action: 'conquered' };
  }
  if (candidatesEmpty.size > 0) {
    return { tileId: pickRandom([...candidatesEmpty]), action: 'expanded' };
  }
  // Priority 3: any unclaimed tile in the world (rare — we got blocked in)
  const anyEmpty = CQ_TERRITORIES.filter((t) => !g.conquest.ownership[t.id]).map((t) => t.id);
  if (anyEmpty.length) {
    return { tileId: pickRandom(anyEmpty), action: 'jumped' };
  }
  // Priority 4: reinforce our capital (visual "stack" — no actual change)
  const cap = CQ_TERRITORIES.find((t) => t.capitalOf === team);
  return { tileId: cap ? cap.id : (ownTiles[0] || 0), action: 'reinforce' };
}
function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Per-team availability check: do we have ENEMY-adjacent, EMPTY-adjacent,
// or OWN-adjacent tiles for each march-order option? Drives the player's
// 3-button picker — greyed-out options aren't tappable.
function cqOrderAvailability(g, team) {
  const enemyTeam = team === 'red' ? 'gold' : 'red';
  const own = [];
  CQ_TERRITORIES.forEach((t) => {
    if (g.conquest.ownership[t.id] === team) own.push(t.id);
  });
  let hasEnemyNeighbor = false;
  let hasEmptyNeighbor = false;
  own.forEach((tid) => {
    cqAdjacent(tid).forEach((nid) => {
      const owner = g.conquest.ownership[nid];
      if (owner === enemyTeam) hasEnemyNeighbor = true;
      else if (!owner) hasEmptyNeighbor = true;
    });
  });
  return {
    attack:  hasEnemyNeighbor,
    advance: hasEmptyNeighbor,
    defend:  own.length > 0,    // can always defend if you own anything
  };
}

// Pick a capture target based on the player's CHOSEN order.
//   attack  → enemy-adjacent tile (sword clash)
//   advance → empty-adjacent tile (peaceful expansion)
//   defend  → reinforce most-threatened own tile (no territory change)
// Falls back to other priorities if the requested option isn't actually
// available (e.g. player tapped Attack but enemies aren't adjacent yet).
function cqPickTargetForOrder(g, team, order) {
  const enemyTeam = team === 'red' ? 'gold' : 'red';
  const own = [];
  CQ_TERRITORIES.forEach((t) => {
    if (g.conquest.ownership[t.id] === team) own.push(t.id);
  });
  const enemyCands = new Set();
  const emptyCands = new Set();
  own.forEach((tid) => {
    cqAdjacent(tid).forEach((nid) => {
      const owner = g.conquest.ownership[nid];
      if (owner === enemyTeam) enemyCands.add(nid);
      else if (!owner) emptyCands.add(nid);
    });
  });
  if (order === 'attack' && enemyCands.size) {
    return { tileId: pickRandom([...enemyCands]), action: 'conquered' };
  }
  if (order === 'advance' && emptyCands.size) {
    return { tileId: pickRandom([...emptyCands]), action: 'expanded' };
  }
  if (order === 'defend' && own.length) {
    // Find the OWN tile with the most enemy neighbors — that's our weak point
    let best = own[0], bestEnemyCount = -1;
    own.forEach((tid) => {
      const enemyN = cqAdjacent(tid).filter((nid) =>
        g.conquest.ownership[nid] === enemyTeam).length;
      if (enemyN > bestEnemyCount) { best = tid; bestEnemyCount = enemyN; }
    });
    return { tileId: best, action: 'reinforce' };
  }
  // Fallback chain if requested order had no valid target
  if (enemyCands.size) return { tileId: pickRandom([...enemyCands]), action: 'conquered' };
  if (emptyCands.size) return { tileId: pickRandom([...emptyCands]), action: 'expanded' };
  const anyEmpty = CQ_TERRITORIES.filter((t) => !g.conquest.ownership[t.id]).map((t) => t.id);
  if (anyEmpty.length) return { tileId: pickRandom(anyEmpty), action: 'jumped' };
  const cap = CQ_TERRITORIES.find((t) => t.capitalOf === team);
  return { tileId: cap ? cap.id : (own[0] || 0), action: 'reinforce' };
}

// Score a team — 1 point per owned tile, +5 bonus per capital owned
function cqTeamScore(g, team) {
  let s = 0;
  CQ_TERRITORIES.forEach((t) => {
    if (g.conquest.ownership[t.id] === team) {
      s += 1;
      if (t.isCapital) s += 5;
    }
  });
  return s;
}

// Apply a capture / defense / attack action. The HP mechanic means:
//   reinforce (DEFEND): +1 HP on the chosen own tile (capped at 4)
//   conquered (ATTACK): -1 HP on enemy tile. ONLY flips ownership when HP=0.
//   expanded (ADVANCE): claim empty tile with HP=1
function cqApplyCapture(g, team, target) {
  const t = CQ_TERRITORIES[target.tileId];
  if (!t) return null;
  const fromTeam = g.conquest.ownership[t.id] || null;

  // DEFEND — fortify an own tile. No ownership change.
  if (target.action === 'reinforce') {
    const curHp = g.conquest.defenseHp[t.id] || 1;
    g.conquest.defenseHp[t.id] = Math.min(4, curHp + 1);
    return {
      tileId: t.id, fromTeam: team, toTeam: team, action: 'reinforce',
      isCapital: !!t.isCapital, unit: g.conquest.units[t.id] || cqPickUnit(),
      defenseHp: g.conquest.defenseHp[t.id],
    };
  }

  // ATTACK — try to capture an enemy tile. Reduce HP first.
  if (target.action === 'conquered') {
    const curHp = g.conquest.defenseHp[t.id] || 1;
    if (curHp > 1) {
      // Tile holds — HP reduces but ownership stays the same
      g.conquest.defenseHp[t.id] = curHp - 1;
      return {
        tileId: t.id, fromTeam, toTeam: fromTeam, action: 'attack-repelled',
        isCapital: !!t.isCapital, unit: g.conquest.units[t.id] || cqPickUnit(),
        defenseHp: g.conquest.defenseHp[t.id],
      };
    }
    // HP was 1 → tile FLIPS to attacking team
    const unit = t.isCapital ? '👑' : cqPickUnit();
    g.conquest.ownership[t.id] = team;
    g.conquest.units[t.id] = unit;
    g.conquest.defenseHp[t.id] = 1;
    g.conquest.capturedCount = (g.conquest.capturedCount || 0) + 1;
    const capturedEnemyCapital = (t.isCapital && t.capitalOf !== team);
    return {
      tileId: t.id, fromTeam, toTeam: team, action: 'conquered',
      isCapital: !!t.isCapital, capturedEnemyCapital, unit,
      terrain: t.terrain, defenseHp: 1,
    };
  }

  // ADVANCE / JUMPED — claim empty tile
  const unit = t.isCapital ? '👑' : cqPickUnit();
  g.conquest.ownership[t.id] = team;
  g.conquest.units[t.id] = unit;
  g.conquest.defenseHp[t.id] = 1;
  g.conquest.capturedCount = (g.conquest.capturedCount || 0) + 1;
  return {
    tileId: t.id, fromTeam, toTeam: team, action: target.action,
    isCapital: !!t.isCapital, capturedEnemyCapital: false,
    unit, terrain: t.terrain, defenseHp: 1,
  };
}

// === Combos === Each combo defines a condition over a team's house and a
// bonus to award when first met. Combos only trigger ONCE per house (tracked
// via team.combosAchieved set). The check runs after every placement.
const FM_COMBOS = [
  {
    id: 'pareja',
    name: '¡Pareja! 💞',
    emoji: '💞',
    bonus: 5,
    test: (h) => h.sala.some(i=>i.id==='dad') && h.sala.some(i=>i.id==='mom')
  },
  {
    id: 'familia',
    name: '¡Familia completa! 👨‍👩‍👧',
    emoji: '👨‍👩‍👧',
    bonus: 10,
    test: (h) => {
      const all = [...h.sala, ...h.cocina, ...h.dormitorio, ...h.jardin];
      const ids = new Set(all.map(i=>i.id));
      return ids.has('dad') && ids.has('mom') && (ids.has('kid')||ids.has('baby'));
    }
  },
  {
    id: 'abuelos',
    name: '¡Abuelos! 👴👵',
    emoji: '👴',
    bonus: 6,
    test: (h) => {
      const all = [...h.sala, ...h.cocina, ...h.dormitorio, ...h.jardin];
      const ids = new Set(all.map(i=>i.id));
      return ids.has('gran') && ids.has('grandpa');
    }
  },
  {
    id: 'mascotas',
    name: '¡Mascotas! 🐕🐱',
    emoji: '🐕',
    bonus: 5,
    test: (h) => {
      const all = [...h.sala, ...h.cocina, ...h.dormitorio, ...h.jardin];
      const ids = new Set(all.map(i=>i.id));
      return ids.has('dog') && ids.has('cat');
    }
  },
  {
    id: 'cena',
    name: '¡Cena familiar! 🍳🍲',
    emoji: '🍲',
    bonus: 6,
    test: (h) => {
      const ids = new Set(h.cocina.map(i=>i.id));
      return ids.has('stove') && ids.has('pot');
    }
  },
  {
    id: 'jardin-bonito',
    name: '¡Jardín bonito! 🌳🌸',
    emoji: '🌸',
    bonus: 5,
    test: (h) => {
      const ids = new Set(h.jardin.map(i=>i.id));
      return ids.has('tree') && ids.has('flower');
    }
  },
  {
    id: 'sala-cozy',
    name: '¡Sala acogedora! 🛋📺',
    emoji: '🛋',
    bonus: 5,
    test: (h) => {
      const ids = new Set(h.sala.map(i=>i.id));
      return ids.has('sofa') && ids.has('tv');
    }
  },
  {
    id: 'dormitorio-listo',
    name: '¡Dormitorio listo! 🛏📚',
    emoji: '🛏',
    bonus: 5,
    test: (h) => {
      const ids = new Set(h.dormitorio.map(i=>i.id));
      return ids.has('bed') && ids.has('book');
    }
  },
  {
    id: 'sala-llena',
    name: '¡Sala llena! +5 objetos',
    emoji: '🏡',
    bonus: 8,
    test: (h) => h.sala.length >= 5
  },
  {
    id: 'cocina-llena',
    name: '¡Cocina llena!',
    emoji: '🍳',
    bonus: 8,
    test: (h) => h.cocina.length >= 5
  },
  {
    id: 'jardin-lleno',
    name: '¡Jardín exuberante!',
    emoji: '🌳',
    bonus: 8,
    test: (h) => h.jardin.length >= 5
  },
  {
    id: 'casa-completa',
    name: '🏆 ¡CASA COMPLETA! ',
    emoji: '🏆',
    bonus: 25,
    test: (h) => h.sala.length>=3 && h.cocina.length>=3 && h.dormitorio.length>=3 && h.jardin.length>=3
  }
];

function fmCheckCombos(g, team) {
  const house = g.family[team];
  if (!house._combos) house._combos = new Set();
  const newCombos = [];
  for (const c of FM_COMBOS) {
    if (house._combos.has(c.id)) continue;
    if (c.test(house)) {
      house._combos.add(c.id);
      newCombos.push(c);
      g.teamScores[team] = (g.teamScores[team] || 0) + c.bonus;
    }
  }
  return newCombos;
}

function fmPickToken() {
  return FM_TOKENS[Math.floor(Math.random() * FM_TOKENS.length)];
}

// Apply a placement: token goes into the requested room (or first valid room
// if the requested one doesn't fit), updates team score, broadcasts to room,
// queues the next question for the player.
function fmPlace(pin, pid, requestedRoom) {
  const g = games[pin];
  if (!g || g.gameType !== 'family' || g.state !== 'active') return;
  const p = g.players[pid];
  if (!p || !p.fmToken) return;
  const t = p.fmToken;
  // Validate room — if invalid for this token, use the first valid room
  const room = (FM_ROOMS.includes(requestedRoom) && t.rooms.includes(requestedRoom))
    ? requestedRoom
    : t.rooms[0];
  p.fmToken = null;
  if (!g.family[p.team]) {
    g.family[p.team] = { sala: [], cocina: [], dormitorio: [], jardin: [] };
  }
  g.family[p.team][room].push({ id: t.id, emoji: t.emoji, by: p.name, t: Date.now() });
  p.score = (p.score || 0) + 1;
  g.teamScores[p.team] = (g.teamScores[p.team] || 0) + 1;
  // Check for new combos unlocked by THIS placement
  const newCombos = fmCheckCombos(g, p.team);
  io.to(pin).emit('fm:placed', {
    team: p.team,
    room,
    token: { id: t.id, emoji: t.emoji, name: t.name },
    teamScores: g.teamScores,
    combos: newCombos.map(c => ({ id: c.id, name: c.name, emoji: c.emoji, bonus: c.bonus }))
  });
  io.to(pid).emit('fm:place-confirmed', {
    room,
    token: t,
    combos: newCombos.map(c => ({ id: c.id, name: c.name, emoji: c.emoji, bonus: c.bonus })),
    teamScore: g.teamScores[p.team]
  });
  // Snappy cadence — fire next question quickly so kids never wait
  setTimeout(() => {
    if (!games[pin] || games[pin].state !== 'active') return;
    const q = nextQuestionFor(g, pid);
    if (q) io.to(pid).emit('question', q);
  }, newCombos.length > 0 ? 1800 : 900);
}

// === Vuelo del Dragón (Dragon Flight) constants ===
// Each team has its OWN dragon. Players answer vocab → unlock 5 s of flap-mode.
// Every tap during flap-mode is one wing-beat that lifts the team's dragon
// higher. As altitude crosses milestones the host reveals new scenery layers
// (rooftops → bamboo → mountains → clouds → heavens). First dragon to reach
// the top wins.
const DR_ALT_MAX     = 500;   // altitude needed to reach the heavens + win
const DR_MASH_MS     = 5000;  // 5 s flap window after a correct answer
const DR_ALT_BCAST_MS = 100;  // throttle altitude broadcasts to ~10 Hz

// === 中国大富翁 · Chinese Trivia Monopoly ===
// 16-tile perimeter board. Each correct vocab answer rolls a 1d6 and advances
// the player's dragon token by that many tiles. Tiles trigger auto-buy / rent /
// bonuses on landing. Pass over START → +¥200. Team wealth (sum of player
// cash + property values) drives the win condition.
const MP_TILES = [
  { id: 0,  type: 'start',    name: 'Salida',      icon: '🏯', side: 'top'    },
  { id: 1,  type: 'city',     name: 'Shànghǎi',    icon: '🏙', side: 'top',    cost: 80,  rent: 20 },
  { id: 2,  type: 'card',     name: 'Carta',       icon: '🎴', side: 'top',    bonus: 40 },
  { id: 3,  type: 'city',     name: 'Guǎngzhōu',   icon: '🛕', side: 'top',    cost: 80,  rent: 20 },
  { id: 4,  type: 'treasure', name: 'Tesoro',      icon: '🐉', side: 'right',  bonus: 100 },
  { id: 5,  type: 'city',     name: 'Xī’ān',  icon: '🕌', side: 'right',  cost: 100, rent: 25 },
  { id: 6,  type: 'card',     name: 'Carta',       icon: '🎴', side: 'right',  bonus: 40 },
  { id: 7,  type: 'city',     name: 'Hángzhōu',    icon: '🌸', side: 'right',  cost: 120, rent: 30 },
  { id: 8,  type: 'festival', name: '¡Fiesta!',    icon: '🏮', side: 'bottom' },
  { id: 9,  type: 'city',     name: 'Chángchéng',  icon: '🧱', side: 'bottom', cost: 140, rent: 35 },
  { id: 10, type: 'tax',      name: 'Impuesto',    icon: '💰', side: 'bottom', penalty: 50 },
  { id: 11, type: 'city',     name: 'Yíhéyuán',    icon: '⛲', side: 'bottom', cost: 160, rent: 40 },
  { id: 12, type: 'jail',     name: 'Cárcel',      icon: '🏛', side: 'left'   },
  { id: 13, type: 'city',     name: 'Gùgōng',      icon: '🏯', side: 'left',   cost: 180, rent: 45 },
  { id: 14, type: 'treasure', name: 'Tesoro',      icon: '🐉', side: 'left',   bonus: 100 },
  { id: 15, type: 'city',     name: 'Tiān’ānmén', icon: '🏛', side: 'left', cost: 200, rent: 50 }
];
const MP_BOARD_SIZE     = MP_TILES.length;
const MP_START_MONEY    = 200;
// Player character slots — 6 distinct Kenney toon characters with names
const MP_CHAR_COUNT     = 6;
const MP_CHAR_NAMES = [
  'Mei 🛡️',       // 0 — Female adventurer
  'Liáng 🛡️',     // 1 — Male adventurer
  'Sara 👩',       // 2 — Female person
  'Daniel 👨',     // 3 — Male person
  'Robot-Bao 🤖',  // 4 — Robot
  'Zombi 🧟'       // 5 — Zombie
];
const MP_PASS_BONUS     = 200;     // each time you cross START
const MP_INSTANT_WIN    = 2000;    // a team hitting this total wealth wins instantly
const MP_FESTIVAL_BONUS = 150;
const MP_DICE_MIN       = 1;
const MP_DICE_MAX       = 6;

// === Piñata Tigre constants ===
// Each TEAM has its own tiger piñata on the host screen. Players play it like
// Mochi Mash: answer a vocab question right → unlocks a short "smash mode"
// where every tap = swing of their stick = 1 damage to their team's tiger.
// First tiger to reach 0 HP loses (their opponents broke the most piñata).
const PN_TIGER_HP   = 220;   // each tiger's HP — tuned so a ~3 min match breaks one
const PN_MASH_MS    = 5000;  // smash-mode duration after correct answer
const PN_HP_BCAST_MS = 100;  // throttle HP broadcasts to ~10 Hz

function emojiForChinese(chinese) {
  if (!chinese) return null;
  // Try whole word match first, then first char
  if (VOCAB_EMOJI[chinese]) return VOCAB_EMOJI[chinese];
  for (const key of Object.keys(VOCAB_EMOJI)) {
    if (chinese.includes(key)) return VOCAB_EMOJI[key];
  }
  return null;
}

function genPin() {
  // Prefer short 3-digit PINs (100-999) so kids can type them in 1 second.
  // If we ever have so many active games that 3-digit space is exhausted
  // (~50+ collisions in a row), fall back to a 4-digit PIN (1000-9999).
  let pin;
  for (let tries = 0; tries < 50; tries++) {
    pin = String(Math.floor(100 + Math.random() * 900));
    if (!games[pin]) return pin;
  }
  do {
    pin = String(Math.floor(1000 + Math.random() * 9000));
  } while (games[pin]);
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
        { name: p.name, team: p.team, score: p.score, avatar: p.avatar || '' }
      ])
    ),
    feed: game.feed.slice(-12)
  };
  // HSK rooms expose simId so kid clients know what to load when
  // state flips to 'active'. fx is the current animation overlay.
  if (game.gameType === 'hsksim' && game.hsk) {
    out.hsk = { simId: game.hsk.simId, fx: game.hsk.fx || null };
  }
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

// 6-7 SWING math generator — returns a problem whose answer is always 6 or 7.
// PINYIN-ONLY for the Chinese variants (no characters per user request).
// 7 problem flavors with addition, subtraction, visual counting, comparisons,
// pinyin number recognition, and pinyin-word addition/subtraction.
// PLAIN-ASCII pinyin (no tone marks). Tone marks can render as ?/box on some
// Android keyboards / older browsers + are confusing for kids who can't type
// or pronounce the tones yet at this level.
const SS_NUM_PINYIN = ['ling','yi','er','san','si','wu','liu','qi','ba','jiu','shi'];
function generateSixSevenProblem(queueIdx) {
  const ans = Math.random() < 0.5 ? 6 : 7;
  const kind = Math.floor(Math.random() * 7);
  let text = '';
  if (kind === 0) {
    // Addition (Arabic numerals)
    const b = Math.floor(Math.random() * (ans + 1));
    const a = ans - b;
    text = `${a} + ${b} = ?`;
  } else if (kind === 1) {
    // Subtraction (Arabic)
    const big = ans + 1 + Math.floor(Math.random() * 8);
    text = `${big} − ${big - ans} = ?`;
  } else if (kind === 2) {
    // Visual count
    const choices = ['⭐', '🍎', '🐱', '🐶', '🍦', '🎈', '🏀', '🐟', '🐲', '🤙'];
    const icon = choices[Math.floor(Math.random() * choices.length)];
    text = `¿Cuántos? ${icon.repeat(ans)}`;
  } else if (kind === 3) {
    // Doubles / halves
    if (ans === 6) {
      const variants = ['3 + 3 = ?', '12 ÷ 2 = ?', '2 × 3 = ?', '1 + 5 = ?'];
      text = variants[Math.floor(Math.random() * variants.length)];
    } else {
      const variants = ['3 + 4 = ?', '14 ÷ 2 = ?', '1 + 6 = ?', '5 + 2 = ?'];
      text = variants[Math.floor(Math.random() * variants.length)];
    }
  } else if (kind === 4) {
    // Mayor / menor
    const other = ans === 6 ? (Math.random() < 0.5 ? 5 : 4) : (Math.random() < 0.5 ? 6 : 8);
    if (ans > other)  text = `¿Cuál es mayor: ${ans} o ${other}?`;
    else              text = `¿Cuál es menor: ${other} o ${ans}?`;
  } else if (kind === 5) {
    // PINYIN: pure recognition — "liù = ?" / "qī = ?"
    text = `${SS_NUM_PINYIN[ans]} = ?`;
  } else {
    // PINYIN addition or subtraction — mixes pinyin operands with the answer
    if (Math.random() < 0.5) {
      const b = Math.floor(Math.random() * (ans + 1));
      const a = ans - b;
      text = `${SS_NUM_PINYIN[a]} + ${SS_NUM_PINYIN[b]} = ?`;
    } else {
      const big = ans + 1 + Math.floor(Math.random() * 4);   // 7..10
      text = `${SS_NUM_PINYIN[big]} − ${SS_NUM_PINYIN[big - ans]} = ?`;
    }
  }
  return { text, ans };
}

function nextQuestionFor(game, playerId) {
  const p = game.players[playerId];
  if (!p || !game.questions.length) return null;

  // 6-7 SWING: generate a fresh math problem each call, never reuse
  if (game.gameType === 'sixseven') {
    p.queueIdx = (p.queueIdx || 0) + 1;
    const { text, ans } = generateSixSevenProblem(p.queueIdx);
    // Answers are always ["6", "7"] in that order — players tap the matching button
    const answers = ['6', '7'];
    const correctIdx = ans === 6 ? 0 : 1;
    const qid = `q-67-${p.queueIdx}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    p.currentQ = { qid, correctIdx, text, answers };
    p.lastQuestionAt = Date.now();
    return { qid, text, answers, gameMode: 'sixseven' };
  }

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

// Flappy: spawn the initial run of pipes far enough ahead that the player can ramp up
function generateInitialPipes() {
  const pipes = [];
  let x = FL_WORLD_W + 100; // first pipe just past the right edge
  for (let i = 0; i < 4; i++) {
    pipes.push({
      x,
      gapY: 100 + Math.random() * (FL_WORLD_H - 200), // gap center between 100 and worldH-100
      scored: false
    });
    x += FL_PIPE_SPACING;
  }
  return pipes;
}

// Market Quest: serve a question tied to a specific vendor (module scope so the
// global tick loop can call it — it was previously inside the connection handler,
// causing ReferenceError crashes on vendor collision).
function nextQuestionForVendor(g, playerId, vendorId) {
  const p = g.players[playerId];
  const vendor = g.vendors && g.vendors.find((v) => v.id === vendorId);
  if (!p || !vendor || vendor.vocabIdx < 0) return null;
  const q = g.questions[vendor.vocabIdx];
  if (!q) return null;
  const shuffled = [...q.answers];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const qid = `mq-${vendorId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const image = Images.urlForQuestion(q);
  p.currentQ = {
    qid,
    correctIdx: shuffled.indexOf(q.correct),
    text: q.text,
    answers: shuffled,
    image,
    vendorId
  };
  p.lastQuestionAt = Date.now();
  return { qid, text: q.text, answers: shuffled, image, vendorId };
}

// === Chinese Monopoly turn resolver ===
// The player rolls their own dice on their phone — server is just the ref.
// If a `roll` is provided (player's tap-stopped value), it's used; otherwise
// the server rolls (safety fallback). Server clamps to 1..6.
function resolveMonopolyTurn(g, pid, playerRoll) {
  const p = g.players[pid];
  if (!p) return null;
  if (!g.monopoly) return null;
  // Skipped this turn? (landed on Jail last time)
  if (p.mpSkip) {
    p.mpSkip = false;
    return { skipped: true, roll: 0, fromPos: p.mpPos, toPos: p.mpPos,
             money: p.mpMoney, action: 'skipped' };
  }
  let roll = Number(playerRoll);
  if (!roll || roll < MP_DICE_MIN || roll > MP_DICE_MAX) {
    roll = MP_DICE_MIN + Math.floor(Math.random() * (MP_DICE_MAX - MP_DICE_MIN + 1));
  }
  const fromPos = p.mpPos || 0;
  const newPos = (fromPos + roll) % MP_BOARD_SIZE;
  // Pass-over-START bonus (if we wrap around, we passed start)
  if (fromPos + roll >= MP_BOARD_SIZE) {
    p.mpMoney = (p.mpMoney || 0) + MP_PASS_BONUS;
  }
  p.mpPos = newPos;
  const tile = MP_TILES[newPos];
  const result = {
    skipped: false,
    roll,
    fromPos,
    toPos: newPos,
    tile: { id: tile.id, type: tile.type, name: tile.name, icon: tile.icon },
    action: 'landed',
    moneyDelta: 0,
    rentTo: null,
    bought: false,
    money: 0
  };
  switch (tile.type) {
    case 'start':
      // Landing exactly on START → extra +¥200 (in addition to pass bonus)
      p.mpMoney += MP_PASS_BONUS;
      result.moneyDelta = MP_PASS_BONUS;
      result.action = 'start-bonus';
      break;
    case 'city': {
      const owner = g.monopoly.ownership[tile.id];
      if (!owner) {
        // Auto-buy if player has enough cash
        if (p.mpMoney >= tile.cost) {
          p.mpMoney -= tile.cost;
          g.monopoly.ownership[tile.id] = p.team;
          result.bought = true;
          result.action = 'bought';
          result.moneyDelta = -tile.cost;
        } else {
          result.action = 'cant-afford';
        }
      } else if (owner === p.team) {
        result.action = 'own-city';
      } else {
        // Pay rent to the enemy team — split equally among that team's players
        const enemyTeam = owner;
        const rentDue = Math.min(p.mpMoney, tile.rent);
        p.mpMoney -= rentDue;
        // Distribute rent among the enemy team's players (so it's MP team wealth)
        const enemies = Object.values(g.players).filter((q) => q.team === enemyTeam);
        if (enemies.length) {
          const each = Math.floor(rentDue / enemies.length) || 0;
          const remainder = rentDue - each * enemies.length;
          enemies.forEach((q, i) => { q.mpMoney = (q.mpMoney || 0) + each + (i === 0 ? remainder : 0); });
        }
        result.action = 'paid-rent';
        result.moneyDelta = -rentDue;
        result.rentTo = enemyTeam;
        result.rentAmount = rentDue;
      }
      break;
    }
    case 'card':
      p.mpMoney += (tile.bonus || 40);
      result.moneyDelta = tile.bonus || 40;
      result.action = 'card-bonus';
      break;
    case 'treasure':
      p.mpMoney += (tile.bonus || 100);
      result.moneyDelta = tile.bonus || 100;
      result.action = 'treasure';
      break;
    case 'tax': {
      const pen = Math.min(p.mpMoney, tile.penalty || 50);
      p.mpMoney -= pen;
      result.moneyDelta = -pen;
      result.action = 'tax';
      break;
    }
    case 'festival':
      p.mpMoney += MP_FESTIVAL_BONUS;
      result.moneyDelta = MP_FESTIVAL_BONUS;
      result.action = 'festival';
      break;
    case 'jail':
      p.mpSkip = true;
      result.action = 'jail';
      break;
  }
  // Personal score reflects player's individual progress (cash earned)
  p.score = (p.score || 0) + Math.max(0, result.moneyDelta) + (result.bought ? tile.cost : 0);
  result.money = p.mpMoney;
  return result;
}

// Once the player commits their tap-stopped dice roll (or the safety timer
// fires), this resolves the turn, broadcasts the move, and queues the next
// question for the player.
function processMonopolyRoll(pin, pid, playerRoll) {
  const g = games[pin];
  if (!g || g.gameType !== 'monopoly' || g.state !== 'active') return;
  const p = g.players[pid];
  if (!p || !p.mpAwaitingRoll) return;
  p.mpAwaitingRoll = false;
  const turn = resolveMonopolyTurn(g, pid, playerRoll);
  g.teamScores = {
    red:  monopolyTeamWealth(g, 'red'),
    gold: monopolyTeamWealth(g, 'gold')
  };
  // Tell the player their turn outcome
  io.to(pid).emit('mp:result', {
    ...turn,
    money: p.mpMoney
  });
  // Broadcast for host board animation
  io.to(pin).emit('mp:move', {
    playerId: pid,
    playerName: p.name,
    team: p.team,
    char: p.mpChar,
    ...turn,
    ownership: g.monopoly.ownership,
    teamScores: g.teamScores,
    // Also send player's running wealth for the live leaderboard on the host
    playerWealth: p.mpMoney
  });
  // Tycoon milestone — celebrate the team hitting MP_INSTANT_WIN, but
  // RESPECT THE TIMER. Per teacher feedback, games (except piñata + zombie)
  // should run for the full duration the host set. Fire the tycoon banner
  // once per team per match so the celebration still happens.
  const w = (g.teamScores.red >= MP_INSTANT_WIN) ? 'red'
          : (g.teamScores.gold >= MP_INSTANT_WIN) ? 'gold' : null;
  if (w && !g.monopoly.tycoonAnnounced) {
    g.monopoly.tycoonAnnounced = w;
    io.to(pin).emit('mp:tycoon', { team: w, teamScores: g.teamScores });
    // No setTimeout/endGame — the round continues until the duration expires.
  }
  // Queue next question after the worst-case client animation budget:
  // 6 walk-steps × 360ms + camera-hold 1.7s + tile reaction overlay 1.9s
  // = ~5800ms. We use 6500ms as a safety ceiling so the player never gets
  // kicked off the walk/celebration mid-animation. The client also emits
  // a "monopoly:ready" signal — whichever arrives first wins.
  if (g.mpQuestionTimers && g.mpQuestionTimers[pid]) {
    clearTimeout(g.mpQuestionTimers[pid]);
  }
  if (!g.mpQuestionTimers) g.mpQuestionTimers = {};
  const sendNext = () => {
    if (g.mpQuestionTimers) delete g.mpQuestionTimers[pid];
    if (!games[pin] || games[pin].state !== 'active') return;
    if (!g.players[pid]) return;
    // Don't double-send if a question was already pushed via the ready signal
    if (g.players[pid]._mpQuestionSent) {
      g.players[pid]._mpQuestionSent = false;
      return;
    }
    g.players[pid]._mpQuestionSent = true;
    const q = nextQuestionFor(g, pid);
    if (q) io.to(pid).emit('question', q);
  };
  g.mpQuestionTimers[pid] = setTimeout(() => {
    g.players[pid] && (g.players[pid]._mpQuestionSent = false);
    sendNext();
  }, 6500);
  // Stash the resolver so the client's `monopoly:ready` event can call it.
  if (!g.mpQuestionResolvers) g.mpQuestionResolvers = {};
  g.mpQuestionResolvers[pid] = sendNext;
}

// Sum total team wealth: cash + value of owned cities.
function monopolyTeamWealth(g, team) {
  let total = 0;
  Object.values(g.players).forEach((p) => {
    if (p.team === team) total += (p.mpMoney || 0);
  });
  MP_TILES.forEach((t) => {
    if (t.type !== 'city') return;
    if (g.monopoly && g.monopoly.ownership[t.id] === team) total += t.cost;
  });
  return total;
}

function endGame(pin) {
  const g = games[pin];
  if (!g) return;
  // Flush any pending warmup sentence to contributors' histories before
  // the game ends — otherwise a final un-cleared sentence is lost.
  if (g.gameType === 'warmup' && g.warmup && g.warmup.sentence && g.warmup.sentence.length) {
    if (g.warmup.contributors && g.warmup.contributors.size) {
      Students.logSentence(Array.from(g.warmup.contributors), g.warmup.sentence, pin);
    }
  }
  g.state = 'ended';
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
    leaderboard: sorted.map((p) => ({ name: p.name, score: p.score, team: p.team, avatar: p.avatar || '' }))
  });
  broadcast(pin);
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
    const pin = genPin();
    const validTypes = ['mochi-mash', 'color-splash', 'color-clash', 'market-quest', 'flappy', 'pinata', 'dragon-eye', 'monopoly', 'zombie', 'family', 'conquest', 'sixseven', 'triage', 'laiquhui', 'warmup', 'identity', 'partyrun', 'reading', 'hsksim'];
    const type = validTypes.includes(opts.gameType) ? opts.gameType : 'mochi-mash';
    const defaultDuration =
      type === 'flappy'       ? 120 :
      type === 'market-quest' ? 240 :
      type === 'color-clash'  ? 180 :
      type === 'color-splash' ? 90 :
      type === 'pinata'       ? 240 :
      type === 'dragon-eye'   ? 240 :
      type === 'monopoly'     ? 300 :
      type === 'zombie'       ? 240 :
      type === 'family'       ? 300 :
      type === 'conquest'     ? 300 :
      type === 'sixseven'     ? 120 :
      type === 'triage'       ? 240 :
      type === 'laiquhui'     ? 180 :
      type === 'warmup'       ? 3600 :   // 1 hour ceiling; teacher exits manually
      type === 'identity'     ? 180 :    // 3 minutes of detective rounds
      type === 'partyrun'     ? 480 :    // 8 min ceiling; round-cap usually ends sooner
      type === 'reading'      ? 3600 :   // 1 hour ceiling; teacher controls flow
      type === 'hsksim'       ? 3600 :   // 1 hour ceiling; kid takes the exam on their own pace
      60;
    let grid = null;
    let vendors = null;
    if (type === 'color-splash') {
      grid = Array.from({ length: CS_GRID_H }, () => Array(CS_GRID_W).fill(null));
    } else if (type === 'color-clash') {
      grid = Array.from({ length: CC_GRID_H }, () => Array(CC_GRID_W).fill(null));
    } else if (type === 'market-quest') {
      // Each vendor starts unclaimed. vocabIdx is set on game start.
      vendors = MQ_VENDORS.map((v) => ({ ...v, claimedBy: null, vocabIdx: -1 }));
    }
    games[pin] = {
      gameType: type,
      hostId: socket.id,
      state: 'lobby',
      duration: defaultDuration,
      startedAt: null,
      endsAt: null,
      questions: [],
      players: {},
      teamScores: { red: 0, gold: 0 },
      feed: [],
      grid,
      vendors
    };
    // 6-7 SWING — math game with server-generated questions. No vocab set
    // needed. We seed questions with a single stub so questionsLoaded > 0
    // passes the start-button check; nextQuestionFor() returns a freshly
    // generated math problem on every call (answer is always 6 or 7).
    if (type === 'sixseven') {
      games[pin].questions = [{
        text: '__sixseven_stub__',
        correct: '6',
        answers: ['6', '7'],
      }];
      games[pin].setTitle = '6-7 Swing 🤙';
    }
    // TRIAGE — self-contained medical mini-game. Seed a built-in HSK1
    // medical/family vocab bank so the host page never has to pick a set.
    // The patient-pick flow still drives off g.questions, so we need real
    // entries (not stubs). Keep them tight to HSK1 + medical context.
    if (type === 'triage') {
      games[pin].questions = TRIAGE_DEFAULT_QUESTIONS.slice();
      games[pin].setTitle = '🚑 Sala de emergencia · HSK1 médico';
    }
    // HSKSIM — full mock exam. The host page emits host:create with
    // a simId (which simulation to run). State stays 'lobby' until
    // the teacher hits "Empezar examen" → emits 'hsk:start' → state
    // flips to 'active'. Late joiners after that start from Q1 on
    // their own pace.
    if (type === 'hsksim') {
      const simId = String(opts.simId || 'hsk1-sim1');
      const payload = HskSim.buildSimPayload(simId);
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
        HSK_ROOMS.set(pin, { pin, simId, createdAt: Date.now(), fx: null });
        _hskRoomsSave();
      } catch (_) {}
    }
    currentPin = pin;
    role = 'host';
    socket.join(pin);
    cb({ pin });
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
  socket.on('host:reclaim', ({ pin, password }, cb) => {
    cb = (typeof cb === 'function') ? cb : () => {};
    const g = games[pin];
    if (!g) return cb({ ok: false, error: 'no-game' });
    // Auth: warmup/reading teacher tools validate via the admin password.
    // Other game types: allow reclaim if the game has no live host right now
    // (host was disconnected) — the password gate already protects warmup.
    const isWarmupTool = (g.gameType === 'warmup' || g.gameType === 'reading');
    if (isWarmupTool && !isAdminPassword(password)) {
      return cb({ ok: false, error: 'bad-password' });
    }
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
    cb({ ok: true, gameType: g.gameType, state: g.state });
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
      g.questions = set.questions;
      g.setTitle = set.title;
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
    const urls = questions.map((q) => Images.urlForQuestion(q));
    const total = urls.length;
    let warmed = 0;
    io.to(g.hostId).emit('images-progress', { warmed: 0, total });
    // Fire 3 in parallel to avoid hammering Pollinations
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
    broadcast(pin);
  });

  socket.on('host:swap-team', ({ pin, playerId }) => {
    const g = games[pin];
    if (!g || g.hostId !== socket.id) return;
    const p = g.players[playerId];
    if (!p) return;
    p.team = p.team === 'red' ? 'gold' : 'red';
    g.feed.push({ type: 'swap', name: p.name, team: p.team, t: Date.now() });
    io.to(playerId).emit('team-changed', { team: p.team });
    broadcast(pin);
  });

  socket.on('host:auto-balance', ({ pin }) => {
    const g = games[pin];
    if (!g || g.hostId !== socket.id) return;
    const ids = Object.keys(g.players).sort(() => Math.random() - 0.5);
    ids.forEach((id, i) => {
      g.players[id].team = i % 2 === 0 ? 'red' : 'gold';
      io.to(id).emit('team-changed', { team: g.players[id].team });
    });
    broadcast(pin);
  });

  socket.on('host:start', ({ pin }) => {
    const g = games[pin];
    if (!g || g.hostId !== socket.id) return;
    // Some game types don't use question sets at all (their content is
    // generated server-side — sixseven, laiquhui). Don't gate them on
    // questions.length, otherwise Start silently does nothing and the
    // host has no idea why.
    // Games that run their own self-contained mini-game logic and don't need
    // a question set picked from the lobby. Triage spawns its own patients,
    // LQH generates missions, Identity rolls suspects, Warmup is a teacher
    // tool, SixSeven generates math on the fly.
    const setlessGameTypes = ['sixseven', 'laiquhui', 'warmup', 'identity', 'triage', 'partyrun', 'reading', 'hsksim'];
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
    g.state = 'countdown';
    broadcast(pin);
    io.to(pin).emit('countdown', { ms: COUNTDOWN_MS });

    setTimeout(() => {
      if (!games[pin]) return;
      g.state = 'active';
      g.startedAt = Date.now();
      g.endsAt = Date.now() + g.duration * 1000;
      g.teamScores = { red: 0, gold: 0 };
      Object.values(g.players).forEach((p) => {
        p.score = 0;
        p.queueIdx = 0;
        p.mashUntil = 0;
        p.walkUntil = 0;
        p.recentTaps = [];
      });
      // Reset grid + spawn positions for grid-based games
      if (g.gameType === 'color-splash' || g.gameType === 'color-clash') {
        const w = g.gameType === 'color-clash' ? CC_GRID_W : CS_GRID_W;
        const h = g.gameType === 'color-clash' ? CC_GRID_H : CS_GRID_H;
        const spawnFn = g.gameType === 'color-clash' ? ccSpawnPosition : csSpawnPosition;
        g.grid = Array.from({ length: h }, () => Array(w).fill(null));
        Object.values(g.players).forEach((p) => {
          const pos = spawnFn(g, p.team);
          p.x = pos.x;
          p.y = pos.y;
          if (g.gameType === 'color-clash') p.energy = CC_START_ENERGY;
        });
        // Color Splash: initialize school pickups
        if (g.gameType === 'color-splash') {
          g.pickups = CS_PICKUPS.map((pk) => ({ ...pk, available: true, respawnAt: 0 }));
        }
        const playersInit = {};
        Object.entries(g.players).forEach(([id, p]) => {
          playersInit[id] = { name: p.name, team: p.team, x: p.x, y: p.y };
        });
        io.to(pin).emit('cs:init', {
          gridW: w,
          gridH: h,
          players: playersInit,
          teamScores: g.teamScores,
          pickups: g.pickups || null
        });
      }

      // Flappy: reset each player's bird/score/pipes and send init
      if (g.gameType === 'flappy') {
        Object.values(g.players).forEach((p) => {
          p.flY = FL_WORLD_H / 2;
          p.flVy = 0;
          p.flScore = 0;
          p.flAlive = true;
          p.flPipes = generateInitialPipes();
          p.flPipeIdx = p.flPipes.length;
          p.flScrollX = 0;
          p.flDeathReason = null;
        });
        io.to(pin).emit('fl:init', {
          worldW: FL_WORLD_W,
          worldH: FL_WORLD_H,
          pipeW: FL_PIPE_W,
          pipeGap: FL_PIPE_GAP,
          playerX: FL_PLAYER_X,
          players: Object.fromEntries(
            Object.entries(g.players).map(([id, pl]) => [id, {
              name: pl.name, team: pl.team, y: pl.flY, score: 0, alive: true
            }])
          ),
          teamScores: g.teamScores
        });
      }

      // Market Quest: assign vendor → vocab mapping, reset pickups, send init
      if (g.gameType === 'market-quest') {
        const vocabIdxs = g.questions.map((_, i) => i).sort(() => Math.random() - 0.5);
        g.vendors = MQ_VENDORS.map((v, i) => ({
          ...v,
          claimedBy: null,
          vocabIdx: vocabIdxs[i % vocabIdxs.length]
        }));
        // Initialize fresh pickups (all available)
        g.pickups = MQ_PICKUPS.map((pk) => ({ ...pk, available: true, respawnAt: 0 }));
        // Reset players to spawn positions
        Object.values(g.players).forEach((p) => {
          p.x = p.team === 'red' ? 100 + Math.random() * 60 : MQ_WORLD_W - 160 + Math.random() * 60;
          p.y = MQ_WORLD_H / 2 + (Math.random() - 0.5) * 200;
          p.dir = p.team === 'red' ? 'right' : 'left';
          p.moving = false;
          p.vendorCooldowns = {};
          p.input = { left: false, right: false, up: false, down: false };
        });
        io.to(pin).emit('mq:init', {
          worldW: MQ_WORLD_W,
          worldH: MQ_WORLD_H,
          vendors: g.vendors,
          pickups: g.pickups,
          players: Object.fromEntries(
            Object.entries(g.players).map(([id, p]) => [id, {
              name: p.name, team: p.team, x: p.x, y: p.y, dir: p.dir
            }])
          ),
          teamScores: g.teamScores
        });
      }
      // Chinese Monopoly: reset board + each player gets a fresh start + character
      if (g.gameType === 'monopoly') {
        g.monopoly = { ownership: {} };
        // Assign each player a character (0..MP_CHAR_COUNT-1) by join order
        const pids = Object.keys(g.players);
        pids.forEach((pid, idx) => {
          const p = g.players[pid];
          p.mpPos = 0;
          p.mpMoney = MP_START_MONEY;
          p.mpSkip = false;
          p.mpChar = idx % MP_CHAR_COUNT;
        });
        io.to(pin).emit('mp:init', {
          tiles: MP_TILES,
          startMoney: MP_START_MONEY,
          instantWin: MP_INSTANT_WIN,
          charCount: MP_CHAR_COUNT,
          charNames: MP_CHAR_NAMES,
          players: Object.fromEntries(
            Object.entries(g.players).map(([id, p]) => [id, {
              name: p.name, team: p.team, pos: 0, money: MP_START_MONEY,
              char: p.mpChar, charName: MP_CHAR_NAMES[p.mpChar]
            }])
          ),
          teamScores: g.teamScores
        });
        // Tell each player privately which character is theirs + show welcome
        pids.forEach((pid) => {
          const charIdx = g.players[pid].mpChar;
          io.to(pid).emit('mp:my-char', {
            charIdx,
            charName: MP_CHAR_NAMES[charIdx],
            welcome: true
          });
        });
      }

      // Vuelo del Dragón: TWO dragons, one per team. Players answer vocab to
      // unlock flap windows; each tap raises their dragon's altitude. First to
      // DR_ALT_MAX reaches the heavens and wins.
      if (g.gameType === 'dragon-eye') {
        g.dragon = {
          altRed: 0,
          altGold: 0,
          maxAlt: DR_ALT_MAX,
          winner: null
        };
        io.to(pin).emit('dragon:init', {
          maxAlt: DR_ALT_MAX,
          players: Object.fromEntries(
            Object.entries(g.players).map(([id, p]) => [id, { name: p.name, team: p.team }])
          ),
          teamScores: g.teamScores
        });
      }

      // Piñata Tigre: two tigers (one per team), each with HP. Players answer
      // questions like Mochi Mash — correct answer unlocks a 5s smash window
      // where every tap deals 1 damage to THEIR team's tiger.
      if (g.gameType === 'pinata') {
        g.pinata = {
          hpRed: PN_TIGER_HP,
          hpGold: PN_TIGER_HP,
          maxHp: PN_TIGER_HP,
          brokenTeam: null
        };
        io.to(pin).emit('pn:init', {
          hpRed: g.pinata.hpRed,
          hpGold: g.pinata.hpGold,
          maxHp: g.pinata.maxHp,
          players: Object.fromEntries(
            Object.entries(g.players).map(([id, p]) => [id, { name: p.name, team: p.team }])
          ),
          teamScores: g.teamScores
        });
      }
      // Zombie Escape: each team has a survivor at distance 0 with zombies
      // chasing at distance -60. Track length 200. First to 200 wins; if the
      // zombies catch the survivor (distance == survivor), that team loses.
      if (g.gameType === 'family') {
        // Initialize an empty 4-room house per team
        g.family = {
          red:  { sala: [], cocina: [], dormitorio: [], jardin: [] },
          gold: { sala: [], cocina: [], dormitorio: [], jardin: [] }
        };
        // Each player can have one pending token at a time
        Object.values(g.players).forEach((p) => { p.fmToken = null; });
        io.to(pin).emit('fm:init', {
          rooms: FM_ROOMS,
          roomLabels: FM_ROOM_LABELS,
          tokens: FM_TOKENS,
          players: Object.fromEntries(
            Object.entries(g.players).map(([id, p]) => [id, { name: p.name, team: p.team, avatar: p.avatar }])
          ),
          teamScores: g.teamScores
        });
      }
      if (g.gameType === 'conquest') {
        // Each team owns its fortress capital from the start (with a 👑 general).
        // Everywhere else is no-man's land. units[id] tracks soldier emoji.
        // defenseHp[id] tracks the tile's defensive strength:
        //   1 = baseline (single attack flips it)
        //   2-4 = fortified (more attacks needed)
        // DEFEND orders bump HP +1. ATTACK reduces enemy HP by 1; only flips
        // when HP=0. This is the strategic heart of v6 — players have to
        // COORDINATE attacks to break a heavily fortified position.
        const ownership = {};
        const units = {};
        const defenseHp = {};
        CQ_TERRITORIES.forEach((t) => {
          if (t.capitalOf) {
            ownership[t.id] = t.capitalOf;
            units[t.id] = '👑';
            defenseHp[t.id] = 3;     // capitals start fortified
          }
        });
        g.conquest = {
          ownership,
          units,
          defenseHp,
          capturedCount: 0,
          battleLog: [],
        };
        g.teamScores = { red: cqTeamScore(g, 'red'), gold: cqTeamScore(g, 'gold') };
        io.to(pin).emit('cq:init', {
          territories: CQ_TERRITORIES,
          ownership,
          units,
          defenseHp,
          cols: CQ_COLS, rows: CQ_ROWS,
          players: Object.fromEntries(
            Object.entries(g.players).map(([id, p]) => [id, { name: p.name, team: p.team, avatar: p.avatar }])
          ),
          teamScores: g.teamScores,
        });
      }
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
      if (g.gameType === 'identity') {
        // Each player runs independent rounds (like sixseven). Server
        // generates the first round for each player + pushes it.
        Object.keys(g.players).forEach((pid) => {
          const p = g.players[pid];
          p.idRound = 0;
          p.idStreak = 0;
          p.idCorrect = 0;
          p.idWrong = 0;
          p.idRoundData = idGenerateRound(p.idRound);
          p.idRoundResolved = false;
        });
        g.teamScores = { red: 0, gold: 0 };
        io.to(pin).emit('id:init', {
          players: Object.fromEntries(
            Object.entries(g.players).map(([id, p]) => [id, {
              name: p.name, team: p.team, avatar: p.avatar,
            }])
          ),
          teamScores: g.teamScores,
        });
        // Push each player's first round privately
        Object.entries(g.players).forEach(([pid, p]) => {
          io.to(pid).emit('id:round', {
            roundNum: p.idRound,
            suspects: p.idRoundData.suspects,
            clue: p.idRoundData.clue,
            deadline: p.idRoundData.deadline,
            score: p.score || 0,
            streak: p.idStreak,
            correct: p.idCorrect,
            wrong: p.idWrong,
          });
        });
      }
      if (g.gameType === 'identity') {
        // Seed the FIRST round for every connected player so id:round
        // actually fires once the countdown finishes. (Was missing — players
        // landed on a blank screen-id with no clue.)
        Object.entries(g.players).forEach(([pid, p]) => {
          p.idRound = 1;
          p.idRoundData = idGenerateRound(1);
          p.idRoundResolved = false;
          p.idCorrect = 0;
          p.idWrong = 0;
          p.idStreak = 0;
          p.score = 0;
          io.to(pid).emit('id:round', {
            roundNum: 1,
            suspects: p.idRoundData.suspects,
            clue: p.idRoundData.clue,
            deadline: p.idRoundData.deadline,
            score: 0, streak: 0, correct: 0, wrong: 0,
          });
        });
      }
      if (g.gameType === 'partyrun') {
        // 🧧 HÓNGBĀO RUN start: build a fresh board, seed every player at
        // tile 0 with 0 stars / 0 coins, then immediately push round 1's
        // question to everyone. Round-state machine is driven by
        // setTimeout from inside the prAdvanceRound helper.
        const board = prGenerateBoard();
        Object.values(g.players).forEach((p) => {
          p.pr = { tile: 0, stars: 0, coins: 0, lastRoll: 0, lastDelta: 0, lastTile: 0 };
          p.score = 0;
        });
        g.partyrun = {
          board,
          round: 0,
          maxRounds: PR_MAX_ROUNDS,
          starGoal: PR_STAR_GOAL,
          phase: 'idle',
          questionDeadline: 0,
          currentQuestion: null,
          picks: {},          // playerId -> answerIdx
          phaseTimer: null,
        };
        g.teamScores = { red: 0, gold: 0 };
        io.to(pin).emit('pr:init', {
          board,
          starGoal: PR_STAR_GOAL,
          maxRounds: PR_MAX_ROUNDS,
          players: Object.fromEntries(
            Object.entries(g.players).map(([id, p]) => [id, {
              name: p.name, team: p.team, avatar: p.avatar,
              tile: 0, stars: 0, coins: 0,
            }])
          ),
        });
        // Kick off round 1 after a short beat so the countdown overlay
        // doesn't compete with the first question.
        setTimeout(() => prStartRound(g, pin), 600);
      }
      if (g.gameType === 'laiquhui') {
        // Each player spawns at the home tile and gets their first mission.
        const home = LQH_LOCATIONS.find((l) => l.isHome);
        Object.values(g.players).forEach((p) => {
          p.x = home.x;
          p.y = home.y;
          p.missionsDone = 0;
          p.missionsFailed = 0;
          p.lqhMission = lqhGenerateMission(p);
          p.lastDestId = null;
          p.score = 0;
        });
        g.laiquhui = {
          gridW: LQH_GRID_W,
          gridH: LQH_GRID_H,
          locations: LQH_LOCATIONS,
          pickups: [],
          nextPickupId: 0,
          lastWeatherAt: Date.now() + 7000,  // first weather event 7s in
        };
        // Seed initial pickups
        for (let k = 0; k < LQH_PICKUP_COUNT; k++) lqhSpawnPickup(g);
        g.teamScores = { red: 0, gold: 0 };
        io.to(pin).emit('lqh:init', {
          gridW: LQH_GRID_W,
          gridH: LQH_GRID_H,
          locations: LQH_LOCATIONS,
          pickups: g.laiquhui.pickups,
          players: Object.fromEntries(
            Object.entries(g.players).map(([id, p]) => [id, {
              name: p.name, team: p.team, avatar: p.avatar,
              x: p.x, y: p.y,
            }])
          ),
          teamScores: g.teamScores,
        });
        // Push each player their initial mission privately
        Object.entries(g.players).forEach(([pid, p]) => {
          io.to(pid).emit('lqh:mission', {
            mission: p.lqhMission,
            x: p.x, y: p.y,
            score: p.score,
            missionsDone: p.missionsDone,
            missionsFailed: p.missionsFailed,
          });
        });
      }
      if (g.gameType === 'triage') {
        // ER ward init — start with 3 patients already in beds so the screen
        // is never empty when the round begins (early-engagement pattern).
        g.triage = {
          patients: {},
          nextPatientId: 0,
          livesSavedRed: 0,
          livesSavedGold: 0,
          patientsDied: 0,
          totalArrived: 0,
          lastSpawnTry: Date.now(),
          lastAmbulanceAt: Date.now(),
          lastCodeBlueAt: Date.now() + 6000,    // first code blue ~6s after start
          lastTransfusionAt: Date.now() + 14000, // first transfusion ~14s
          eventLog: [],
        };
        // Seed with 3 starter patients (none critical — guaranteed early wins).
        for (let k = 0; k < 3; k++) trTrySpawn(g, { critical: false });
        g.teamScores = { red: 0, gold: 0 };
        io.to(pin).emit('tri:init', {
          beds: TR_BEDS,
          lifeMax: TR_LIFE_MAX,
          patients: Object.values(g.triage.patients),
          livesSavedRed: 0,
          livesSavedGold: 0,
          players: Object.fromEntries(
            Object.entries(g.players).map(([id, p]) => [id, { name: p.name, team: p.team, avatar: p.avatar }])
          ),
          teamScores: g.teamScores,
        });
      }
      if (g.gameType === 'zombie') {
        g.zombie = {
          survRed:   0,
          survGold:  0,
          zombRed:  -ZB_ZOMBIE_START_BACK,
          zombGold: -ZB_ZOMBIE_START_BACK,
          trackLen: ZB_TRACK_LEN,
          finishedTeam: null
        };
        io.to(pin).emit('zb:init', {
          trackLen: ZB_TRACK_LEN,
          players: Object.fromEntries(
            Object.entries(g.players).map(([id, p]) => [id, { name: p.name, team: p.team, avatar: p.avatar }])
          ),
          teamScores: g.teamScores
        });
      }
      broadcast(pin);
      // Mochi Mash + Color Splash + Piñata auto-deal first question.
      // Color Clash → button-driven; Market Quest → vendor-driven; Flappy → death-driven.
      // Laiquhui — no questions at all (movement-driven, like sixseven for missions)
      const skipAutoPush = ['color-clash', 'market-quest', 'flappy', 'laiquhui'].includes(g.gameType);
      if (!skipAutoPush) {
        Object.keys(g.players).forEach((pid) => {
          const q = nextQuestionFor(g, pid);
          if (q) io.to(pid).emit('question', q);
        });
      }
      g.endTimer = setTimeout(() => {
        if (!games[pin] || games[pin].state !== 'active') return;
        endGame(pin);
      }, g.duration * 1000);
    }, COUNTDOWN_MS);
  });

  socket.on('host:end-now', ({ pin }) => {
    const g = games[pin];
    if (!g || g.hostId !== socket.id) return;
    if (g.endTimer) clearTimeout(g.endTimer);
    // Clean up partyrun's round-state machine timer so it doesn't fire
    // a pr:question after the game has been ended.
    if (g.partyrun && g.partyrun.phaseTimer) {
      clearTimeout(g.partyrun.phaseTimer);
      g.partyrun.phaseTimer = null;
    }
    endGame(pin);
  });

  socket.on('host:reset', ({ pin }) => {
    const g = games[pin];
    if (!g || g.hostId !== socket.id) return;
    if (g.endTimer) clearTimeout(g.endTimer);
    g.state = 'lobby';
    g.teamScores = { red: 0, gold: 0 };
    g.endsAt = null;
    Object.values(g.players).forEach((p) => {
      p.score = 0;
      p.queueIdx = 0;
      p.mashUntil = 0;
      p.recentTaps = [];
    });
    broadcast(pin);
  });

  socket.on('player:join', ({ pin, name, avatar, studentCode }, cb) => {
    const g = games[pin];
    if (!g) return cb({ ok: false, error: 'No game with that PIN' });
    if (g.state === 'ended') return cb({ ok: false, error: 'Game has ended' });
    const cleanName = String(name || '').trim().slice(0, 20);
    if (!cleanName) return cb({ ok: false, error: 'Please enter a name' });

    // Look for existing player by name (case-insensitive). If found, attach to that slot.
    const existingEntry = Object.entries(g.players).find(
      ([id, p]) => p.name.toLowerCase() === cleanName.toLowerCase()
    );

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
      }
      // Refresh avatar on rejoin so kids can change it across rounds
      if (avatar && typeof avatar === 'string') player.avatar = String(avatar).slice(0, 8);
      g.feed.push({ type: 'rejoin', name: cleanName, team: player.team, t: Date.now() });
    } else {
      // New player — pick smaller team, spawn position for color splash
      const team = pickTeam(g);
      player = {
        name: cleanName,
        team,
        avatar: (avatar && typeof avatar === 'string') ? String(avatar).slice(0, 8) : '',
        score: 0,
        queueIdx: 0,
        mashUntil: 0,
        lastTap: 0,
        recentTaps: [],
        currentQ: null,
        x: 0,
        y: 0,
        walkUntil: 0,
        lastMove: 0,
        energy: CC_START_ENERGY,
        disconnected: false,
        disconnectedAt: null
      };
      if (g.gameType === 'color-splash') {
        const pos = csSpawnPosition(g, team);
        player.x = pos.x;
        player.y = pos.y;
      } else if (g.gameType === 'color-clash') {
        const pos = ccSpawnPosition(g, team);
        player.x = pos.x;
        player.y = pos.y;
      } else if (g.gameType === 'market-quest') {
        // Spawn on the appropriate team side of the world, vertically random
        player.x = team === 'red' ? 100 + Math.random() * 60 : MQ_WORLD_W - 160 + Math.random() * 60;
        player.y = MQ_WORLD_H / 2 + (Math.random() - 0.5) * 200;
        player.dir = team === 'red' ? 'right' : 'left';
        player.moving = false;
        player.vendorCooldowns = {}; // vendor id → unlock timestamp
      } else if (g.gameType === 'flappy') {
        // Each player has their own scrolling world. Server-side state per player:
        player.flY = FL_WORLD_H / 2;
        player.flVy = 0;
        player.flScore = 0;
        player.flAlive = true;
        player.flPipes = [];     // queue of pipes {x, gapY}
        player.flPipeIdx = 0;    // next pipe id counter (for unique keys)
        player.flScrollX = 0;    // total distance scrolled (for parallax + score)
        player.flDeathReason = null;
      }
      g.players[socket.id] = player;
      g.feed.push({ type: 'join', name: cleanName, team: player.team, t: Date.now() });
    }

    // === STUDENT CODE === Identify this player across sessions. If the
    // client sent a known code, link to that record. Otherwise generate
    // a fresh code. The code lives in the kid's localStorage so the
    // same phone = same record = same sentence history forever.
    const studentRec = Students.getOrCreate(studentCode, cleanName);
    player.studentCode = studentRec.code;

    currentPin = pin;
    role = 'player';
    socket.join(pin);

    const gridW = g.gameType === 'color-clash' ? CC_GRID_W : CS_GRID_W;
    const gridH = g.gameType === 'color-clash' ? CC_GRID_H : CS_GRID_H;
    cb({
      ok: true,
      team: player.team,
      playerId: socket.id,
      gameType: g.gameType,
      gridW,
      gridH,
      x: player.x,
      y: player.y,
      energy: player.energy,
      rejoined: isRejoin,
      gameState: g.state,
      studentCode: player.studentCode,
    });
    broadcast(pin);

    // If joining/rejoining mid-game, sync them up
    if (g.state === 'active') {
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
      }
      // === LÁI-QÙ-HUÍ: late-joiner gets the map + their own mission ===
      // Without this, kids joining a running LQH game stay stuck on the
      // previous gameType's screen (commonly the triage doctor banner)
      // because no event ever routes them to screen-lqh.
      if (g.gameType === 'laiquhui') {
        if (!g.laiquhui) {
          // Shouldn't happen since LQH state is created on host:start, but
          // be defensive.
          io.to(socket.id).emit('lqh:init', { gridW: LQH_GRID_W, gridH: LQH_GRID_H, locations: LQH_LOCATIONS, pickups: [] });
        } else {
          // Seed the player if they're a brand-new joiner
          if (typeof player.x !== 'number' || typeof player.y !== 'number') {
            const home = LQH_LOCATIONS.find((l) => l.isHome);
            player.x = home ? home.x : 1;
            player.y = home ? home.y : 6;
            player.missionsDone = 0;
            player.missionsFailed = 0;
            player.lqhMission = lqhGenerateMission(player);
            player.lastDestId = null;
            player.score = 0;
          }
          io.to(socket.id).emit('lqh:init', {
            gridW: LQH_GRID_W,
            gridH: LQH_GRID_H,
            locations: LQH_LOCATIONS,
            pickups: g.laiquhui.pickups || [],
          });
          if (player.lqhMission) {
            io.to(socket.id).emit('lqh:mission', {
              mission: player.lqhMission,
              x: player.x, y: player.y,
              score: player.score || 0,
              missionsDone: player.missionsDone || 0,
              missionsFailed: player.missionsFailed || 0,
            });
          }
        }
      }
      // === HÓNGBĀO RUN: late-joiner gets the board + a fresh player slot.
      // If a question is currently being asked, send that too so they
      // can participate in the in-progress round instead of waiting. ===
      if (g.gameType === 'partyrun' && g.partyrun) {
        // Seed pr state on the new player if needed
        if (!player.pr) {
          player.pr = { tile: 0, stars: 0, coins: 0, lastRoll: 0, lastDelta: 0, lastTile: 0 };
          player.score = 0;
        }
        io.to(socket.id).emit('pr:init', {
          board: g.partyrun.board,
          starGoal: g.partyrun.starGoal,
          maxRounds: g.partyrun.maxRounds,
          players: Object.fromEntries(
            Object.entries(g.players).map(([id, p]) => [id, {
              name: p.name, team: p.team, avatar: p.avatar,
              tile:  (p.pr && p.pr.tile)  || 0,
              stars: (p.pr && p.pr.stars) || 0,
              coins: (p.pr && p.pr.coins) || 0,
            }])
          ),
        });
        // If we're currently in the question phase, also push that question
        if (g.partyrun.phase === 'question' && g.partyrun.currentQuestion) {
          io.to(socket.id).emit('pr:question', {
            round: g.partyrun.round,
            maxRounds: g.partyrun.maxRounds,
            text: g.partyrun.currentQuestion.text,
            choices: g.partyrun.currentQuestion.choices,
            deadline: g.partyrun.questionDeadline,
          });
        }
      }
      // === TRIAGE: explicit late-join event so the client can force the
      // right screen even before a `question` event arrives. ===
      if (g.gameType === 'triage') {
        io.to(socket.id).emit('tri:late-join', {
          // No payload needed — the existence of the event is enough for
          // the client to call showScreen('question') and clean up.
        });
      }
      // === Identity: late-joiner gets their current round (if any). If
      // they're a fresh joiner mid-game and don't yet have round data,
      // seed one so they jump straight in. ===
      if (g.gameType === 'identity') {
        if (!player.idRoundData) {
          player.idRound = 1;
          player.idRoundData = idGenerateRound(1);
          player.idRoundResolved = false;
          player.idCorrect = player.idCorrect || 0;
          player.idWrong = player.idWrong || 0;
          player.idStreak = player.idStreak || 0;
        }
        io.to(socket.id).emit('id:round', {
          roundNum: player.idRound || 1,
          suspects: player.idRoundData.suspects,
          clue: player.idRoundData.clue,
          deadline: player.idRoundData.deadline,
          score: player.score || 0,
          streak: player.idStreak || 0,
          correct: player.idCorrect || 0,
          wrong: player.idWrong || 0,
        });
      }
      // Market Quest: send the world state
      if (g.gameType === 'market-quest') {
        io.to(socket.id).emit('mq:init', {
          worldW: MQ_WORLD_W,
          worldH: MQ_WORLD_H,
          vendors: g.vendors,
          pickups: g.pickups,
          players: Object.fromEntries(
            Object.entries(g.players).map(([id, pl]) => [id, {
              name: pl.name, team: pl.team, x: pl.x, y: pl.y, dir: pl.dir || 'down'
            }])
          ),
          teamScores: g.teamScores
        });
      }
      // Monopoly: send the board state + assign/restore character
      if (g.gameType === 'monopoly' && g.monopoly) {
        // If this player slot has no character yet (truly new mid-game joiner),
        // assign one based on the current player count.
        if (typeof player.mpChar !== 'number') {
          player.mpChar = (Object.keys(g.players).length - 1) % MP_CHAR_COUNT;
          player.mpPos = 0;
          player.mpMoney = MP_START_MONEY;
          player.mpSkip = false;
        }
        io.to(socket.id).emit('mp:init', {
          tiles: MP_TILES,
          startMoney: MP_START_MONEY,
          instantWin: MP_INSTANT_WIN,
          charCount: MP_CHAR_COUNT,
          charNames: MP_CHAR_NAMES,
          players: Object.fromEntries(
            Object.entries(g.players).map(([id, pl]) => [id, {
              name: pl.name, team: pl.team, pos: pl.mpPos || 0,
              money: pl.mpMoney || 0, char: pl.mpChar,
              charName: MP_CHAR_NAMES[pl.mpChar]
            }])
          ),
          teamScores: g.teamScores,
          ownership: g.monopoly.ownership
        });
        io.to(socket.id).emit('mp:my-char', {
          charIdx: player.mpChar,
          charName: MP_CHAR_NAMES[player.mpChar],
          welcome: !isRejoin    // brand-new joiner gets welcome modal; rejoin doesn't
        });
      }

      // For Color Splash and Color Clash, send the current grid + paint state so the rejoiner sees everything
      if (g.gameType === 'color-splash' || g.gameType === 'color-clash') {
        const w = g.gameType === 'color-clash' ? CC_GRID_W : CS_GRID_W;
        const h = g.gameType === 'color-clash' ? CC_GRID_H : CS_GRID_H;
        const playersInit = {};
        Object.entries(g.players).forEach(([id, p]) => {
          playersInit[id] = { name: p.name, team: p.team, x: p.x, y: p.y };
        });
        io.to(socket.id).emit('cs:init', {
          gridW: w,
          gridH: h,
          players: playersInit,
          teamScores: g.teamScores,
          pickups: g.pickups || null
        });
        // Also send a "paint" event with all currently-painted cells so the rejoiner sees the state
        const paintedCells = [];
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (g.grid[y][x]) paintedCells.push({ x, y, team: g.grid[y][x] });
          }
        }
        if (paintedCells.length > 0) {
          io.to(socket.id).emit('cs:paint', { cells: paintedCells, teamScores: g.teamScores });
        }
      }
      // Send an active question (preserve their currentQ if rejoining)
      // Market Quest + Flappy don't auto-push: market = vendor collision, flappy = on death
      if (g.gameType !== 'market-quest' && g.gameType !== 'flappy') {
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
    }
  });

  function csSpawnPosition(g, team) {
    const half = Math.floor(CS_GRID_W / 2);
    for (let attempt = 0; attempt < 30; attempt++) {
      const y = Math.floor(Math.random() * CS_GRID_H);
      const x = team === 'red'
        ? Math.floor(Math.random() * 4)
        : CS_GRID_W - 1 - Math.floor(Math.random() * 4);
      const occupied = Object.values(g.players).some((p) => p.x === x && p.y === y);
      if (!occupied) return { x, y };
    }
    return {
      x: team === 'red' ? 0 : CS_GRID_W - 1,
      y: Math.floor(Math.random() * CS_GRID_H)
    };
  }

  function csPaintCell(g, x, y, team) {
    if (x < 0 || x >= CS_GRID_W || y < 0 || y >= CS_GRID_H) return false;
    const prev = g.grid[y][x];
    if (prev === team) return false;
    if (prev) g.teamScores[prev]--;
    g.grid[y][x] = team;
    g.teamScores[team]++;
    return true;
  }
  // Cross-pattern brush stroke: paint center + 4 cardinal neighbors (up to 5 cells)
  function csPaintCross(g, cx, cy, team) {
    const painted = [];
    [[0,0],[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy]) => {
      const x = cx + dx, y = cy + dy;
      if (csPaintCell(g, x, y, team)) painted.push({ x, y, team });
    });
    return painted;
  }

  function ccSpawnPosition(g, team) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const y = Math.floor(Math.random() * CC_GRID_H);
      const x = team === 'red'
        ? Math.floor(Math.random() * 4)
        : CC_GRID_W - 1 - Math.floor(Math.random() * 4);
      const occupied = Object.values(g.players).some((p) => p.x === x && p.y === y);
      if (!occupied) return { x, y };
    }
    return {
      x: team === 'red' ? 0 : CC_GRID_W - 1,
      y: Math.floor(Math.random() * CC_GRID_H)
    };
  }

  function ccPaintCell(g, x, y, team) {
    if (x < 0 || x >= CC_GRID_W || y < 0 || y >= CC_GRID_H) return false;
    const prev = g.grid[y][x];
    if (prev === team) return false;
    if (prev) g.teamScores[prev]--;
    g.grid[y][x] = team;
    g.teamScores[team]++;
    return true;
  }

  socket.on('player:answer', ({ pin, qid, choiceIdx }, ack) => {
    // Immediate ack so the client knows the server received the tap. If transport
    // is flaky, the client uses this to decide whether to retry the emit.
    if (typeof ack === 'function') ack({ ok: true });
    const g = games[pin];
    if (!g || g.state !== 'active') return;
    const p = g.players[socket.id];
    if (!p) return;
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
    const cqData = p.currentQ;
    const correct = cqData.correctIdx === choiceIdx;
    const correctText = cqData.answers[cqData.correctIdx];
    // Stash the player's actual TAP (6 or 7 for sixseven) for the per-game
    // branches below — currentQ is nulled before those branches run.
    p._lastChoice = cqData.answers ? cqData.answers[choiceIdx] : null;
    p.currentQ = null;

    if (g.gameType === 'flappy') {
      if (correct) {
        // Revive: full health, mid-screen, fresh pipes
        p.flY = FL_WORLD_H / 2;
        p.flVy = 0;
        p.flAlive = true;
        p.flDeathReason = null;
        // Clear pipes that would immediately kill them; respawn ahead
        p.flPipes = generateInitialPipes();
        io.to(socket.id).emit('answer-result', { correct: true, correctText, revived: true });
        io.to(socket.id).emit('fl:revived');
      } else {
        // Wrong: stay dead, get another question after a short delay
        io.to(socket.id).emit('answer-result', { correct: false, correctText });
        setTimeout(() => {
          if (!games[pin] || games[pin].state !== 'active') return;
          if (g.players[socket.id] && !g.players[socket.id].flAlive) {
            sendReviveQuestion(g, socket.id);
          }
        }, 1800);
      }
      broadcast(pin);
      return;
    }

    if (g.gameType === 'market-quest') {
      const vendorId = cqData.vendorId;
      const vendor = g.vendors && g.vendors.find((v) => v.id === vendorId);
      // Extract Chinese characters + pinyin from the question text for the toast
      let itemChinese = '';
      let itemHanzi = '';
      const m = cqData.text.match(/([一-鿿]+)\s*\(([^)]+)\)/);
      if (m) {
        itemHanzi = m[1];
        itemChinese = `${m[1]} (${m[2]})`;
      }
      // Use vocab-specific emoji if we can find one, else fall back to vendor's icon
      const matchedEmoji = emojiForChinese(itemHanzi);
      const itemIcon = matchedEmoji || (vendor ? vendor.icon : '🛍');

      if (correct && vendor && !vendor.claimedBy) {
        vendor.claimedBy = p.team;
        p.score = (p.score || 0) + MQ_VENDOR_POINTS;
        g.teamScores[p.team] = (g.teamScores[p.team] || 0) + MQ_VENDOR_POINTS;
        io.to(pin).emit('mq:vendor-claimed', {
          vendorId,
          team: p.team,
          playerName: p.name,
          teamScores: g.teamScores
        });
        io.to(socket.id).emit('answer-result', {
          correct: true,
          vendorId,
          correctText,
          playerScore: p.score,
          itemIcon,
          itemChinese,
          pointsAwarded: MQ_VENDOR_POINTS
        });
      } else if (correct) {
        io.to(socket.id).emit('answer-result', { correct: true, vendorId, correctText, itemIcon, itemChinese });
      } else {
        if (!p.vendorCooldowns) p.vendorCooldowns = {};
        p.vendorCooldowns[vendorId] = Date.now() + 8000;
        io.to(socket.id).emit('answer-result', { correct: false, vendorId, correctText, itemIcon, itemChinese });
      }
      // All vendors claimed — celebrate the milestone BUT respect the
      // duration the host set. Resetting all vendors lets the round keep
      // generating new claim opportunities (each respawns with a fresh
      // cooldown), so the gameplay loop continues until the timer expires.
      if (g.vendors.every((v) => v.claimedBy) && !g.mqRoundCompleted) {
        g.mqRoundCompleted = true;
        // Optional: announce the achievement without ending the round
        io.to(pin).emit('mq:all-claimed', { teamScores: g.teamScores });
      }
      broadcast(pin);
      return; // don't run other game branches
    }

    if (g.gameType === 'color-splash') {
      // Color Splash: correct → walk window, wrong → enemy gets free random paints
      if (correct) {
        p.walkUntil = Date.now() + CS_WALK_DURATION_MS;
        // Paint a starting cross around the player's position
        const painted = csPaintCross(g, p.x, p.y, p.team);
        p.score += painted.length;
        io.to(socket.id).emit('answer-result', {
          correct: true,
          walkUntil: p.walkUntil,
          correctText
        });
        if (painted.length) {
          io.to(pin).emit('cs:paint', { cells: painted, teamScores: g.teamScores });
        }
      } else {
        const enemy = p.team === 'red' ? 'gold' : 'red';
        const painted = [];
        for (let i = 0; i < CS_WRONG_AUTO_PAINTS; i++) {
          const rx = Math.floor(Math.random() * CS_GRID_W);
          const ry = Math.floor(Math.random() * CS_GRID_H);
          if (csPaintCell(g, rx, ry, enemy)) painted.push({ x: rx, y: ry, team: enemy });
        }
        io.to(socket.id).emit('answer-result', { correct: false, correctText });
        io.to(pin).emit('cs:paint', { cells: painted, teamScores: g.teamScores });
      }
    } else if (g.gameType === 'color-clash') {
      // Color Clash: correct → +energy, wrong → enemy gets random paints
      if (correct) {
        p.energy = (p.energy || 0) + CC_CORRECT_ENERGY;
        io.to(socket.id).emit('answer-result', {
          correct: true,
          energy: p.energy,
          correctText
        });
      } else {
        const enemy = p.team === 'red' ? 'gold' : 'red';
        const painted = [];
        for (let i = 0; i < CC_WRONG_ENEMY_PAINTS; i++) {
          const rx = Math.floor(Math.random() * CC_GRID_W);
          const ry = Math.floor(Math.random() * CC_GRID_H);
          if (ccPaintCell(g, rx, ry, enemy)) painted.push({ x: rx, y: ry, team: enemy });
        }
        io.to(socket.id).emit('answer-result', { correct: false, correctText, energy: p.energy });
        io.to(pin).emit('cs:paint', { cells: painted, teamScores: g.teamScores });
      }
    } else if (g.gameType === 'dragon-eye') {
      // Vuelo del Dragón: correct → 5s flap window. Wrong = nothing (no penalty).
      if (correct && g.dragon && !g.dragon.winner) {
        p.mashUntil = Date.now() + DR_MASH_MS;
        io.to(socket.id).emit('answer-result', {
          correct: true,
          mashUntil: p.mashUntil,
          correctText
        });
      } else {
        io.to(socket.id).emit('answer-result', { correct: false, correctText });
      }
    } else if (g.gameType === 'monopoly') {
      // Correct answer = you earn the RIGHT TO ROLL THE DICE. The player taps
      // a stop-the-spinner mini-game on their phone; whatever number they land
      // on is sent via 'monopoly:roll' (see handler below). We mark the player
      // as "awaiting roll" so the next-question timer doesn't fire too early.
      if (correct && g.monopoly) {
        p.mpAwaitingRoll = true;
        io.to(socket.id).emit('answer-result', {
          correct: true,
          correctText,
          monopoly: { needsRoll: true, money: p.mpMoney }
        });
        // Safety net: if the player never taps stop within 8s, server auto-rolls.
        setTimeout(() => {
          if (!games[pin] || games[pin].state !== 'active') return;
          const pNow = games[pin].players[socket.id];
          if (!pNow || !pNow.mpAwaitingRoll) return;
          processMonopolyRoll(pin, socket.id, null);
        }, 8000);
      } else {
        io.to(socket.id).emit('answer-result', { correct: false, correctText });
      }
    } else if (g.gameType === 'pinata') {
      if (correct) {
        p.mashUntil = Date.now() + PN_MASH_MS;
        io.to(socket.id).emit('answer-result', {
          correct: true, mashUntil: p.mashUntil, correctText
        });
      } else {
        io.to(socket.id).emit('answer-result', { correct: false, correctText });
      }
    } else if (g.gameType === 'sixseven') {
      // 6-7 SWING — math game with combo + speed bonus. Correct answer:
      // +1 base, +1 if their TAP was within 2.5s of question arrival (speed).
      // Combo multiplier scales the per-tap bump from streaks of 3+.
      if (correct) {
        const reactionMs = Date.now() - (p.lastQuestionAt || 0);
        p.ssStreak = (p.ssStreak || 0) + 1;
        const speedBonus = reactionMs < 2500 ? 1 : 0;
        // Combo multiplier: 1× under 3, 2× at 3-5, 3× at 6+
        const mult = p.ssStreak >= 6 ? 3 : p.ssStreak >= 3 ? 2 : 1;
        const gained = (1 + speedBonus) * mult;
        p.score = (p.score || 0) + gained;
        g.teamScores[p.team] = (g.teamScores[p.team] || 0) + gained;
        const chosen = p._lastChoice || '6';
        io.to(socket.id).emit('answer-result', {
          correct: true,
          correctText,
          sixseven: {
            chosen, streak: p.ssStreak, mult, gained, speedBonus,
          },
        });
        io.to(pin).emit('ss:tap', {
          playerId: socket.id, playerName: p.name, playerScore: p.score,
          team: p.team, choice: chosen, gained,
          streak: p.ssStreak, teamScores: g.teamScores,
        });
      } else {
        p.ssStreak = 0;
        const chosen = p._lastChoice || '6';
        io.to(socket.id).emit('answer-result', {
          correct: false,
          correctText,
          sixseven: { chosen, streak: 0, mult: 1, gained: 0 },
        });
        io.to(pin).emit('ss:tap', {
          playerId: socket.id, playerName: p.name, playerScore: p.score,
          team: p.team, choice: chosen, gained: 0, streak: 0,
          teamScores: g.teamScores,
        });
      }
    } else if (g.gameType === 'conquest') {
      // Reinos en Guerra v5 — TWO-STAGE STRATEGIC FLOW:
      //   1) Correct answer → server tells the player to pick a march order
      //      (ATTACK / ADVANCE / DEFEND). The capture does NOT happen yet.
      //   2) Player taps one of three buttons → emits `player:cq-order`.
      //      Server resolves the chosen action and broadcasts the capture.
      // This gives every player a real strategic decision — they're no
      // longer just answering questions to trigger random captures.
      if (correct) {
        // Stage 1: tell the client to show the march-order picker. Mark the
        // player as having an open order so a stale answer can't re-trigger.
        p.cqOrderPending = true;
        // Compute which actions are AVAILABLE right now (so the picker can
        // disable greyed-out options if e.g. no enemy is adjacent).
        const availability = cqOrderAvailability(g, p.team);
        io.to(socket.id).emit('answer-result', {
          correct: true,
          correctText,
          conquest: {
            needsOrder: true,
            availability,           // { attack: bool, advance: bool, defend: bool }
          },
        });
      } else {
        io.to(socket.id).emit('answer-result', { correct: false, correctText });
      }
    } else if (g.gameType === 'family') {
      // Mi Familia: correct → award a random token; the player will tap a room
      // on their phone to place it. Wrong → no reward, next question normally.
      if (correct) {
        const token = fmPickToken();
        p.fmToken = token;
        p.fmTokenAt = Date.now();
        io.to(socket.id).emit('answer-result', {
          correct: true,
          correctText,
          familyToken: token
        });
        // Safety: if the player never places within the window, auto-place in
        // the first valid room so the game keeps moving
        setTimeout(() => {
          if (!games[pin] || games[pin].state !== 'active') return;
          const pNow = games[pin].players[socket.id];
          if (!pNow || !pNow.fmToken) return;
          const t = pNow.fmToken;
          fmPlace(pin, socket.id, t.rooms[0]);
        }, FM_PLACE_WINDOW_MS + 300);
      } else {
        io.to(socket.id).emit('answer-result', { correct: false, correctText });
      }
    } else if (g.gameType === 'triage') {
      // Triage ER — TWO-STAGE STRATEGIC FLOW (mirrors conquest):
      //   1) Correct vocab answer → server tells the player to pick WHICH
      //      patient to treat. Server attaches the current urgency-sorted
      //      patient list so the picker can render cards immediately.
      //   2) Player taps a card → emits `player:tri-treat { patientId }`.
      //      Server applies the treatment and broadcasts to host.
      // No-correct-answer path stays simple — just next question, no penalty
      // (kids' health stakes are emotional; punishing wrong answers feels mean).
      if (correct) {
        p.triTreatPending = true;
        const urgent = trUrgentPatients(g);
        const patients = urgent.map((pat) => ({
          id: pat.id,
          bedIdx: pat.bedIdx,
          icon: pat.icon,
          name: pat.name,
          critical: pat.critical,
          lifeHpRatio: Math.max(0, pat.lifeHp / pat.lifeMax),
        }));
        io.to(socket.id).emit('answer-result', {
          correct: true,
          correctText,
          triage: { needsPick: true, patients },
        });
      } else {
        io.to(socket.id).emit('answer-result', { correct: false, correctText });
      }
    } else if (g.gameType === 'zombie') {
      // Zombie Escape: correct → sprint window. Wrong → SURVIVOR steps back
      // (jump-back penalty) but the game never auto-ends from a wrong answer.
      // This avoids the "I got kicked for one wrong answer" feeling.
      if (correct && g.zombie && !g.zombie.finishedTeam) {
        p.mashUntil = Date.now() + ZB_SPRINT_MS;
        io.to(socket.id).emit('answer-result', {
          correct: true, mashUntil: p.mashUntil, correctText
        });
      } else if (!correct && g.zombie && !g.zombie.finishedTeam) {
        const sKey = p.team === 'red' ? 'survRed' : 'survGold';
        const zKey = p.team === 'red' ? 'zombRed' : 'zombGold';
        // Survivor stumbles back; never below 0
        g.zombie[sKey] = Math.max(0, g.zombie[sKey] - ZB_WRONG_SETBACK);
        // Zombies creep a little closer (visual threat, not a kill condition)
        g.zombie[zKey] = Math.min(g.zombie[sKey] - 10, g.zombie[zKey] + 4);
        io.to(pin).emit('zb:state', {
          survRed:  g.zombie.survRed,
          survGold: g.zombie.survGold,
          zombRed:  g.zombie.zombRed,
          zombGold: g.zombie.zombGold,
          trackLen: g.zombie.trackLen
        });
        io.to(socket.id).emit('answer-result', {
          correct: false, correctText, zombieSetback: ZB_WRONG_SETBACK
        });
      } else {
        io.to(socket.id).emit('answer-result', { correct: false, correctText });
      }
    } else {
      // Mochi Mash logic
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
    if (g.gameType === 'color-clash') {
      // Color Clash players request questions via button — don't auto-push another
      nextDelay = -1;
    } else if (g.gameType === 'color-splash') {
      nextDelay = correct ? CS_WALK_DURATION_MS + 600 : 1400;
    } else if (g.gameType === 'pinata') {
      nextDelay = correct ? PN_MASH_MS + 600 : 1400;
    } else if (g.gameType === 'dragon-eye') {
      nextDelay = correct ? DR_MASH_MS + 600 : 1400;
    } else if (g.gameType === 'monopoly') {
      nextDelay = correct ? -1 : 1500;
    } else if (g.gameType === 'zombie') {
      nextDelay = correct ? ZB_SPRINT_MS + 600 : 1400;
    } else if (g.gameType === 'family') {
      // Correct → wait for placement; placement handler queues next question.
      nextDelay = correct ? -1 : 1500;
    } else if (g.gameType === 'conquest') {
      // Correct → wait for the player's march order (handler queues next q).
      // Wrong → quick next question.
      nextDelay = correct ? -1 : 1400;
    } else if (g.gameType === 'sixseven') {
      // Snappy rhythm — fast cadence so the swing feels continuous
      nextDelay = correct ? 600 : 800;
    } else if (g.gameType === 'triage') {
      // Correct → wait for the player's "which patient" tap (handler queues
      // the next question). Wrong → quick follow-up so they re-engage fast.
      nextDelay = correct ? -1 : 1400;
    } else {
      nextDelay = correct ? MASH_DURATION_MS + 600 : 1400;
    }
    if (nextDelay >= 0) {
      setTimeout(() => {
        if (!games[pin] || games[pin].state !== 'active') return;
        const q = nextQuestionFor(g, socket.id);
        if (q) io.to(socket.id).emit('question', q);
      }, nextDelay);
    }
    broadcast(pin);
  });

  // Color Clash: continuous movement (no walk window). Each move costs 1 energy.
  socket.on('player:cc-move', ({ pin, dx, dy }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'color-clash' || g.state !== 'active') return;
    const p = g.players[socket.id];
    if (!p) return;
    const now = Date.now();
    if (now - p.lastMove < CC_MOVE_COOLDOWN_MS) return;
    if ((p.energy || 0) < CC_ENERGY_PER_TILE) return; // out of energy — must answer questions
    dx = Math.sign(Number(dx) || 0);
    dy = Math.sign(Number(dy) || 0);
    if (dx === 0 && dy === 0) return;
    if (dx !== 0 && dy !== 0) return; // cardinal only
    const nx = Math.max(0, Math.min(CC_GRID_W - 1, p.x + dx));
    const ny = Math.max(0, Math.min(CC_GRID_H - 1, p.y + dy));
    if (nx === p.x && ny === p.y) return; // hit edge
    p.x = nx;
    p.y = ny;
    p.lastMove = now;
    p.energy -= CC_ENERGY_PER_TILE;
    const painted = ccPaintCell(g, nx, ny, p.team);
    if (painted) p.score++;
    io.to(socket.id).emit('cc:energy', { energy: p.energy });
    io.to(pin).emit('cs:move', {
      playerId: socket.id,
      x: nx, y: ny,
      paint: painted ? { x: nx, y: ny, team: p.team } : null,
      teamScores: g.teamScores
    });
  });

  // Flappy: tap to flap (gives upward velocity)
  socket.on('player:fl-flap', ({ pin }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'flappy' || g.state !== 'active') return;
    const p = g.players[socket.id];
    if (!p || !p.flAlive) return;
    p.flVy = FL_FLAP_VY;
  });

  // Market Quest: player sends their movement input state (held keys/joystick)
  // Avatar swap — kids can change their avatar in the lobby without rejoining.
  socket.on('player:set-avatar', ({ pin, avatar }) => {
    const g = games[pin];
    if (!g) return;
    const p = g.players[socket.id];
    if (!p) return;
    if (typeof avatar !== 'string') return;
    p.avatar = String(avatar).slice(0, 8);
    broadcast(pin);
  });

  // === Player stuck-recovery resync ===
  // Client watchdog pings this when nothing has happened on its end for 12s.
  // Server replies with the player's current state + re-emits the current
  // question if one is open + pushes a NEW question if the player is idle
  // (no mash window, no walk window, no pending dice roll, etc).
  // This is the last-resort safety net that gets stuck players unstuck.
  socket.on('player:resync', ({ pin }) => {
    const g = games[pin];
    if (!g) return;
    const p = g.players[socket.id];
    if (!p) return;
    const now = Date.now();
    const inAction =
      (p.mashUntil && p.mashUntil > now) ||
      (p.walkUntil && p.walkUntil > now) ||
      !!p.currentQ ||
      !!p.mpAwaitingRoll ||
      !!p.dragonAim;
    io.to(socket.id).emit('state-resync', {
      state: g.state,
      gameType: g.gameType,
      hasOpenQuestion: !!p.currentQ,
      mashUntil:      p.mashUntil || 0,
      walkUntil:      p.walkUntil || 0,
      energy:         p.energy    || 0,
      score:          p.score     || 0,
      mpAwaitingRoll: !!p.mpAwaitingRoll,
      inAction
    });
    // Re-emit the active question so the client can re-render the screen
    if (p.currentQ && g.state === 'active') {
      io.to(socket.id).emit('question', {
        qid: p.currentQ.qid,
        text: p.currentQ.text,
        answers: p.currentQ.answers,
        image: p.currentQ.image,
        vendorId: p.currentQ.vendorId
      });
      return;
    }
    // If the player is genuinely idle and the game is running, push them a
    // fresh question to get them moving again. Skip for games that drive
    // their own question dispatch (market-quest uses vendor collisions,
    // flappy uses death-revives, color-clash uses request buttons).
    if (g.state === 'active' && !inAction) {
      const driveYourOwn = ['market-quest', 'flappy', 'color-clash'];
      if (!driveYourOwn.includes(g.gameType)) {
        const q = nextQuestionFor(g, socket.id);
        if (q) io.to(socket.id).emit('question', q);
      }
    }
  });

  // Mi Familia: player tapped a room to place their awarded token.
  socket.on('family:place', ({ pin, room }) => {
    fmPlace(pin, socket.id, room);
  });

  // Reinos en Guerra v5: player committed a march order (attack/advance/defend).
  // Resolves the capture they chose and broadcasts it. ONLY accepts the
  // order if the player actually has a pending order (set when they got
  // a question right) — prevents stale order injection.
  socket.on('player:cq-order', ({ pin, order }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'conquest' || g.state !== 'active') return;
    const p = g.players[socket.id];
    if (!p || !p.cqOrderPending) return;
    p.cqOrderPending = false;
    const team = p.team;
    const validOrder = ['attack', 'advance', 'defend'].includes(order) ? order : 'advance';
    const target = cqPickTargetForOrder(g, team, validOrder);
    const captureInfo = cqApplyCapture(g, team, target);
    g.teamScores = { red: cqTeamScore(g, 'red'), gold: cqTeamScore(g, 'gold') };
    p.score = (p.score || 0) + 1;
    io.to(socket.id).emit('cq:order-resolved', {
      action: captureInfo.action,
      tile: CQ_TERRITORIES[captureInfo.tileId],
      unit: captureInfo.unit,
      capturedEnemyCapital: !!captureInfo.capturedEnemyCapital,
      order: validOrder,
    });
    io.to(pin).emit('cq:capture', {
      ...captureInfo,
      playerName: p.name,
      order: validOrder,
      teamScores: g.teamScores,
    });
    if (captureInfo.capturedEnemyCapital) {
      io.to(pin).emit('cq:capital-fallen', { team, teamScores: g.teamScores });
    }
    // Push next question after a short celebration window so the player
    // sees the result of their order before the next round.
    setTimeout(() => {
      if (!games[pin] || games[pin].state !== 'active') return;
      const q = nextQuestionFor(g, socket.id);
      if (q) io.to(socket.id).emit('question', q);
    }, 1800);
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
  function readingRequireHost(g, socket, password) {
    if (!g || g.gameType !== 'reading') return false;
    return g.hostId === socket.id && isAdminPassword(password);
  }
  socket.on('rd:auth', ({ pin, password }, cb) => {
    const g = games[pin];
    const ok = readingRequireHost(g, socket, password);
    if (typeof cb === 'function') cb({ ok });
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

  function wuRequireHost(g, socket, password) {
    if (!g || g.gameType !== 'warmup') return false;
    return g.hostId === socket.id && isAdminPassword(password);
  }
  function wuRequireAdmin(g, socket, password) {
    if (!g || g.gameType !== 'warmup') return false;
    // Host path — the teacher can ALWAYS edit, even while frozen.
    if (g.hostId === socket.id && isAdminPassword(password)) return true;
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
    const ok = wuRequireAdmin(g, socket, password);
    // Surface super-admin status so the host page can reveal super-only
    // tools (the random-Spanish prompt bar). Host path only — delegates
    // are never super admins.
    const isSuper = ok && g && g.hostId === socket.id && isSuperAdminPassword(password);
    if (typeof cb === 'function') cb({ ok, isSuperAdmin: !!isSuper });
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
    if (!(g.hostId === socket.id && isAdminPassword(password))) return;
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
    if (!(g.hostId === socket.id && isAdminPassword(password))) return;
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
    if (!(g.hostId === socket.id && isAdminPassword(password))) return;
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
    if (!(g.hostId === socket.id && isAdminPassword(password))) return;
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
    if (!(g.hostId === socket.id && isAdminPassword(password))) return;
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
    if (!(g.hostId === socket.id && isAdminPassword(password))) return;
    const ok = ['rain', 'confetti', 'zombies', 'moto', 'shake', 'sixseven', 'flash', 'stars', 'tiger',
                'gojo', 'yuji', 'fnaf', 'shelly', 'dandy'];
    if (!ok.includes(kind)) return;
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
    if (!(g.hostId === socket.id && isAdminPassword(password))) return;
    const ok = ['gojo', 'yugi', 'turtle'];   // expand as more transparent GIFs land
    if (!ok.includes(String(id || ''))) return;
    // Stash the current state on the room so a kid joining late
    // automatically sees whatever's already on.
    if (!g.wuAnim) g.wuAnim = {};
    if (on) g.wuAnim[id] = { since: Date.now() };
    else    delete g.wuAnim[id];
    io.to(pin).emit('wu:anim', { id, on: !!on });
  });
  // === JUDGE role === host designates a kid as a "juez" who can approve or
  // deny raise-hand requests. Two categories: asistente (builds) and juez
  // (approves). Host only.
  socket.on('wu:set-judge', ({ pin, password, playerName, on }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'warmup') return;
    if (!(g.hostId === socket.id && isAdminPassword(password))) return;
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
    if (!(g.hostId === socket.id && isSuperAdminPassword(password))) return;
    if (!g.warmup) g.warmup = { sentence: [], viewMode: 'text', contributors: new Set(), undoStack: [] };
    g.warmup.prompt = String(text || '').slice(0, 160);
    io.to(pin).emit('wu:prompt', { text: g.warmup.prompt });
    wuEmitState(g, pin);
  });
  socket.on('wu:prompt-clear', ({ pin, password }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'warmup') return;
    if (!(g.hostId === socket.id && isSuperAdminPassword(password))) return;
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
    if (!(g.hostId === socket.id && isAdminPassword(password))) return;
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
      Students.logSentence(contributors, g.warmup.sentence, pin);
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
    Students.appendSentence(p.studentCode, g.warmup.sentence, pin);
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
  // The password check uses the warmup pin's game state if available; if
  // not (e.g. before a game starts), accept the password directly.
  function wuAuthForPresets(pin, password) {
    if (!isAdminPassword(password)) return false;
    if (!pin) return true;             // direct password match before game exists
    const g = games[pin];
    if (!g || g.gameType !== 'warmup') return isAdminPassword(password);
    return g.hostId === undefined ? true : true;  // password alone suffices here
  }
  socket.on('wu:presets-list', ({ pin, password }, cb) => {
    if (typeof cb !== 'function') return;
    if (!isAdminPassword(password)) return cb({ ok: false, error: 'bad password' });
    cb({ ok: true, presets: TeacherPresets.list() });
  });
  socket.on('wu:presets-save', ({ pin, password, name, sentence }, cb) => {
    cb = typeof cb === 'function' ? cb : () => {};
    if (!isAdminPassword(password)) return cb({ ok: false, error: 'bad password' });
    try {
      const preset = TeacherPresets.save(name, sentence);
      cb({ ok: true, preset, presets: TeacherPresets.list() });
    } catch (e) {
      cb({ ok: false, error: e.message });
    }
  });
  socket.on('wu:presets-delete', ({ pin, password, id }, cb) => {
    cb = typeof cb === 'function' ? cb : () => {};
    if (!isAdminPassword(password)) return cb({ ok: false, error: 'bad password' });
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

  // === SHÉI SHÌ? Identity Detective — per-player round picks ===
  socket.on('player:id-pick', ({ pin, suspectIdx }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'identity' || g.state !== 'active') return;
    const p = g.players[socket.id];
    if (!p || !p.idRoundData || p.idRoundResolved) return;
    const round = p.idRoundData;
    const picked = Number(suspectIdx);
    if (!Number.isFinite(picked) || picked < 0 || picked >= round.suspects.length) return;
    p.idRoundResolved = true;
    const correct = picked === round.targetIdx;
    // Scoring: base + time bonus + streak multiplier
    let points = 0;
    if (correct) {
      p.idCorrect = (p.idCorrect || 0) + 1;
      p.idStreak = (p.idStreak || 0) + 1;
      const timeLeftMs = Math.max(0, round.deadline - Date.now());
      const timeBonus = Math.round((timeLeftMs / ID_ROUND_MS) * 10);
      const streakMult = p.idStreak >= 5 ? 2 : p.idStreak >= 3 ? 1.5 : 1;
      points = Math.round((10 + timeBonus) * streakMult);
      p.score = (p.score || 0) + points;
      g.teamScores[p.team] = (g.teamScores[p.team] || 0) + points;
    } else {
      p.idWrong = (p.idWrong || 0) + 1;
      p.idStreak = 0;
    }
    io.to(socket.id).emit('id:result', {
      correct,
      picked,
      targetIdx: round.targetIdx,
      target: round.suspects[round.targetIdx],
      points,
      score: p.score || 0,
      streak: p.idStreak,
      correct: p.idCorrect,
      wrong: p.idWrong,
    });
    // Brief celebration window, then next round
    setTimeout(() => {
      if (!games[pin] || games[pin].state !== 'active') return;
      const stillP = games[pin].players[socket.id];
      if (!stillP) return;
      stillP.idRound = (stillP.idRound || 0) + 1;
      stillP.idRoundData = idGenerateRound(stillP.idRound);
      stillP.idRoundResolved = false;
      io.to(socket.id).emit('id:round', {
        roundNum: stillP.idRound,
        suspects: stillP.idRoundData.suspects,
        clue: stillP.idRoundData.clue,
        deadline: stillP.idRoundData.deadline,
        score: stillP.score || 0,
        streak: stillP.idStreak,
        correct: stillP.idCorrect,
        wrong: stillP.idWrong,
      });
      broadcast(pin);
    }, correct ? 1500 : 2000);
    broadcast(pin);
  });

  // === 🧧 HÓNGBĀO RUN — player locks in their answer for this round ===
  // Multiple submissions are allowed during the question phase (last one
  // wins), so a kid who second-guesses can change before the timer ends.
  socket.on('player:pr-answer', ({ pin, answerIdx }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'partyrun' || g.state !== 'active') return;
    if (!g.partyrun || g.partyrun.phase !== 'question') return;
    const idx = Number(answerIdx);
    if (!Number.isFinite(idx) || idx < 0 || idx >= 4) return;
    g.partyrun.picks[socket.id] = idx;
    // Privately ack so the player UI can lock in the chosen card
    io.to(socket.id).emit('pr:answer-ack', { answerIdx: idx });
    // If everyone connected has answered, short-circuit and resolve now
    const connectedIds = Object.keys(g.players);
    const answeredCount = connectedIds.filter((id) => typeof g.partyrun.picks[id] === 'number').length;
    if (answeredCount >= connectedIds.length && connectedIds.length > 0) {
      if (g.partyrun.phaseTimer) clearTimeout(g.partyrun.phaseTimer);
      // Tiny delay so the last person sees their own selection confirm
      g.partyrun.phaseTimer = setTimeout(() => prResolveRound(g, pin), 400);
    }
  });

  // === LÁI-QÙ-HUÍ Dragon Courier ===
  // Player tapped one of the 4 direction buttons. Validate the move,
  // update position, check arrival, fire next mission if completed.
  socket.on('player:lqh-move', ({ pin, dir }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'laiquhui' || g.state !== 'active') return;
    const p = g.players[socket.id];
    if (!p || !p.lqhMission) return;
    const [dx, dy] = lqhDirToDelta(dir);
    if (dx === 0 && dy === 0) return;
    const nx = Math.max(0, Math.min(LQH_GRID_W - 1, p.x + dx));
    const ny = Math.max(0, Math.min(LQH_GRID_H - 1, p.y + dy));
    if (nx === p.x && ny === p.y) {
      // Bumped a wall — emit a "bump" so the client can shake the d-pad
      io.to(socket.id).emit('lqh:move', {
        x: p.x, y: p.y, bump: true, dir,
      });
      return;
    }
    p.x = nx;
    p.y = ny;
    // === Pickup collection ===
    // Stepping on a tile holding a pickup awards bonus pts immediately.
    // Removed pickup gets respawned elsewhere after LQH_PICKUP_RESPAWN_MS.
    const pickupIdx = g.laiquhui.pickups.findIndex((pk) => pk.x === p.x && pk.y === p.y);
    if (pickupIdx >= 0) {
      const pk = g.laiquhui.pickups[pickupIdx];
      g.laiquhui.pickups.splice(pickupIdx, 1);
      p.score = (p.score || 0) + pk.pts;
      g.teamScores[p.team] = (g.teamScores[p.team] || 0) + pk.pts;
      io.to(socket.id).emit('lqh:pickup', {
        pickupId: pk.id, kind: pk.kind, icon: pk.icon, es: pk.es, pts: pk.pts,
        x: pk.x, y: pk.y, score: p.score,
      });
      io.to(pin).emit('lqh:pickup-removed', { pickupId: pk.id });
      // Respawn another pickup after a delay
      setTimeout(() => {
        if (!games[pin] || games[pin].state !== 'active') return;
        const fresh = lqhSpawnPickup(games[pin]);
        if (fresh) io.to(pin).emit('lqh:pickup-spawned', fresh);
      }, LQH_PICKUP_RESPAWN_MS);
    }
    // Check arrival
    const dest = lqhFindLocation(p.lqhMission.destId);
    const arrived = (dest && p.x === dest.x && p.y === dest.y);
    if (arrived) {
      // Award points based on remaining time (tighter finish = more pts)
      const totalMs = p.lqhMission.deadline - p.lqhMission.startedAt;
      const remainingMs = Math.max(0, p.lqhMission.deadline - Date.now());
      const bonusFraction = Math.min(1, remainingMs / totalMs);
      const base = 10;
      const bonus = Math.round(base * bonusFraction);
      const points = base + bonus;
      p.score = (p.score || 0) + points;
      p.missionsDone = (p.missionsDone || 0) + 1;
      p.lqhStreak = (p.lqhStreak || 0) + 1;
      if (!p.lqhBestStreak || p.lqhStreak > p.lqhBestStreak) p.lqhBestStreak = p.lqhStreak;
      g.teamScores[p.team] = (g.teamScores[p.team] || 0) + points;
      p.lastDestId = p.lqhMission.destId;
      const completedVerb = p.lqhMission.verb;
      const completedSentence = p.lqhMission.pinyin;
      const completionMs = Date.now() - p.lqhMission.startedAt;
      // === ACHIEVEMENTS — fire milestone banners on the player phone ===
      const achievements = [];
      if (p.missionsDone === 1) achievements.push({ id: 'first', icon: '🎉', title: '¡PRIMERA ENTREGA!', sub: 'Wǒ qù le! · ¡Tu primer mensaje!' });
      if (p.missionsDone === 5) achievements.push({ id: 'starter', icon: '📜', title: '¡5 ENTREGAS!', sub: 'Buen comienzo, mensajero' });
      if (p.missionsDone === 10) achievements.push({ id: 'marathon', icon: '🏃', title: '¡MARATHON x10!', sub: 'Diez entregas seguidas' });
      if (p.missionsDone === 20) achievements.push({ id: 'legend', icon: '🐉', title: '¡LEYENDA DE LA ALDEA!', sub: '20 entregas — eres famoso' });
      if (p.lqhStreak === 3) achievements.push({ id: 'streak3', icon: '🔥', title: '¡RACHA x3!', sub: 'Sigue así' });
      if (p.lqhStreak === 5) achievements.push({ id: 'streak5', icon: '⚡', title: '¡RACHA PERFECTA x5!', sub: 'Imparable' });
      if (p.lqhStreak === 10) achievements.push({ id: 'streak10', icon: '💎', title: '¡RACHA LEGENDARIA x10!', sub: 'Mensajero invicto' });
      if (completionMs < 4000 && p.lqhMission.distance >= 4) achievements.push({ id: 'speed', icon: '💨', title: '¡SPEED DEMON!', sub: 'Entrega ultrarrápida' });
      // Generate next mission immediately
      p.lqhMission = lqhGenerateMission(p);
      if (achievements.length) {
        io.to(socket.id).emit('lqh:achievements', { achievements });
      }
      io.to(socket.id).emit('lqh:complete', {
        verb: completedVerb,
        sentence: completedSentence,
        points,
        x: p.x, y: p.y,
        score: p.score,
        missionsDone: p.missionsDone,
        missionsFailed: p.missionsFailed,
      });
      // Pause briefly so the kid sees the success feedback, then deal next
      setTimeout(() => {
        if (!games[pin] || games[pin].state !== 'active') return;
        const stillP = games[pin].players[socket.id];
        if (!stillP) return;
        io.to(socket.id).emit('lqh:mission', {
          mission: stillP.lqhMission,
          x: stillP.x, y: stillP.y,
          score: stillP.score,
          missionsDone: stillP.missionsDone,
          missionsFailed: stillP.missionsFailed,
        });
      }, 1100);
      io.to(pin).emit('lqh:player-move', {
        playerId: socket.id, x: p.x, y: p.y, name: p.name, team: p.team,
        teamScores: g.teamScores,
      });
      broadcast(pin);
    } else {
      io.to(socket.id).emit('lqh:move', { x: p.x, y: p.y, dir });
      io.to(pin).emit('lqh:player-move', {
        playerId: socket.id, x: p.x, y: p.y, name: p.name, team: p.team,
      });
    }
  });

  // Triage ER: player tapped which patient to treat. Resolves the heal,
  // awards points (2.5x for critical), and broadcasts the rescue so the host
  // can play the defib zap / life-saved chime / EKG stabilize animation.
  socket.on('player:tri-treat', ({ pin, patientId, bonus, completed, failed }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'triage' || g.state !== 'active') return;
    const p = g.players[socket.id];
    if (!p || !p.triTreatPending) return;
    p.triTreatPending = false;
    // Clamp bonus to a sane range (CPR rhythm 0-5, defib 0-8, total max 15)
    const cprBonus = Math.max(0, Math.min(15, Number(bonus) || 0));
    const wasFailed = !!failed;
    // Resolve target — fall back to the most-urgent alive patient if the
    // tapped patient already died between picker-open and the player's tap.
    let patient = g.triage.patients[patientId];
    if (!patient) {
      const urgent = trUrgentPatients(g, 1);
      patient = urgent[0];
    }
    if (!patient) {
      // No one alive to treat (rare — happens if every patient died during
      // the picker window). Award a small consolation point so the player
      // isn't penalized for the empty ward, then queue the next question.
      p.score = (p.score || 0) + 1;
      io.to(socket.id).emit('tri:treat-resolved', {
        action: 'empty-ward',
        points: 1,
      });
      setTimeout(() => {
        if (!games[pin] || games[pin].state !== 'active') return;
        const q = nextQuestionFor(g, socket.id);
        if (q) io.to(socket.id).emit('question', q);
      }, 1000);
      return;
    }
    const basePoints = patient.critical ? TR_CRITICAL_POINTS : TR_NORMAL_POINTS;
    const team = p.team;
    // === FAILURE PATH ===
    // If the player failed the CPR/defib (didn't complete in time, or hit
    // red zone), the patient DIES. No points, increment death counter.
    // This is the "game integrity" the user asked for — failing has real
    // consequences instead of always rewarding the answer.
    if (wasFailed) {
      g.triage.patientsDied++;
      delete g.triage.patients[patient.id];
      io.to(socket.id).emit('tri:treat-resolved', {
        action: 'failed',
        patientId: patient.id,
        bedIdx: patient.bedIdx,
        points: 0,
        basePoints,
        cprBonus: 0,
      });
      io.to(pin).emit('tri:patient-died', {
        patientId: patient.id,
        bedIdx: patient.bedIdx,
        icon: patient.icon,
        ailment: patient.ailment,
        critical: patient.critical,
        patientsDied: g.triage.patientsDied,
        causedByPlayer: p.name,
        causedByTeam: team,
      });
      setTimeout(() => {
        if (!games[pin] || games[pin].state !== 'active') return;
        const q = nextQuestionFor(g, socket.id);
        if (q) io.to(socket.id).emit('question', q);
      }, 1800);
      return;
    }
    // === SUCCESS PATH ===
    const points = basePoints + cprBonus;
    if (team === 'red') g.triage.livesSavedRed++;
    else g.triage.livesSavedGold++;
    g.teamScores[team] = (g.teamScores[team] || 0) + points;
    p.score = (p.score || 0) + points;
    // Remove the patient (their bed empties — next spawn cycle will refill it)
    delete g.triage.patients[patient.id];
    io.to(socket.id).emit('tri:treat-resolved', {
      action: patient.critical ? 'critical-saved' : 'saved',
      patientId: patient.id,
      bedIdx: patient.bedIdx,
      points,
      basePoints,
      cprBonus,
    });
    io.to(pin).emit('tri:patient-treated', {
      patientId: patient.id,
      bedIdx: patient.bedIdx,
      ailment: patient.ailment,
      icon: patient.icon,
      critical: patient.critical,
      team,
      playerName: p.name,
      playerAvatar: p.avatar || '',
      points,
      livesSavedRed: g.triage.livesSavedRed,
      livesSavedGold: g.triage.livesSavedGold,
      teamScores: g.teamScores,
    });
    // Queue next question after a short rescue-celebration window so the
    // player sees the result of THEIR save before being pushed forward.
    setTimeout(() => {
      if (!games[pin] || games[pin].state !== 'active') return;
      const q = nextQuestionFor(g, socket.id);
      if (q) io.to(socket.id).emit('question', q);
    }, 1500);
  });

  // Chinese Monopoly: player committed their tap-stopped dice value (1..6).
  socket.on('monopoly:roll', ({ pin, roll }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'monopoly' || g.state !== 'active') return;
    processMonopolyRoll(pin, socket.id, roll);
  });

  // Client signals: walk + tile-reaction overlay done, push my next question.
  // Lets the next question fire AS SOON AS the player is ready, instead of
  // waiting for the 6.5s safety ceiling — keeps the round snappy when the
  // player rolled a low number (short walk).
  socket.on('monopoly:ready', ({ pin }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'monopoly' || g.state !== 'active') return;
    const resolver = g.mpQuestionResolvers && g.mpQuestionResolvers[socket.id];
    if (typeof resolver === 'function') {
      // Cancel the safety timer — we're firing the question via this signal
      if (g.mpQuestionTimers && g.mpQuestionTimers[socket.id]) {
        clearTimeout(g.mpQuestionTimers[socket.id]);
        delete g.mpQuestionTimers[socket.id];
      }
      delete g.mpQuestionResolvers[socket.id];
      // Reset the "sent" flag so resolver actually sends
      if (g.players[socket.id]) g.players[socket.id]._mpQuestionSent = false;
      resolver();
    }
  });

  socket.on('player:mq-input', ({ pin, left, right, up, down }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'market-quest' || g.state !== 'active') return;
    const p = g.players[socket.id];
    if (!p) return;
    p.input = {
      left: !!left, right: !!right, up: !!up, down: !!down
    };
  });

  // Color Clash: player explicitly requests a question
  socket.on('player:request-question', ({ pin }) => {
    const g = games[pin];
    if (!g || g.state !== 'active') return;
    const p = g.players[socket.id];
    if (!p) return;
    if (p.currentQ) return; // already has one open
    const q = nextQuestionFor(g, socket.id);
    if (q) io.to(socket.id).emit('question', q);
  });

  socket.on('player:move', ({ pin, dx, dy }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'color-splash' || g.state !== 'active') return;
    const p = g.players[socket.id];
    if (!p) return;
    const now = Date.now();
    if (now > p.walkUntil) return; // not in walk window
    if (now - p.lastMove < CS_MOVE_COOLDOWN_MS) return;
    dx = Math.sign(Number(dx) || 0);
    dy = Math.sign(Number(dy) || 0);
    if (dx === 0 && dy === 0) return;
    if (dx !== 0 && dy !== 0) return; // cardinal only
    const nx = Math.max(0, Math.min(CS_GRID_W - 1, p.x + dx));
    const ny = Math.max(0, Math.min(CS_GRID_H - 1, p.y + dy));
    if (nx === p.x && ny === p.y) return; // hit wall
    p.x = nx;
    p.y = ny;
    p.lastMove = now;
    // Wide brush: paint center + 4 neighbors
    const paintedCells = csPaintCross(g, nx, ny, p.team);
    p.score += paintedCells.length;
    io.to(pin).emit('cs:move', {
      playerId: socket.id,
      x: nx, y: ny,
      paint: paintedCells.length ? paintedCells : null,
      teamScores: g.teamScores
    });

    // Pickup collision check — within radius of any available pickup
    if (g.pickups) {
      const nowMs = Date.now();
      for (const pickup of g.pickups) {
        if (!pickup.available) continue;
        if (Math.abs(p.x - pickup.x) > CS_PICKUP_RADIUS) continue;
        if (Math.abs(p.y - pickup.y) > CS_PICKUP_RADIUS) continue;
        // Grab!
        pickup.available = false;
        pickup.respawnAt = nowMs + CS_PICKUP_RESPAWN_MS;
        // 3x3 paint splat around the pickup
        const bonus = [];
        for (let by = pickup.y - CS_PICKUP_BONUS_RADIUS; by <= pickup.y + CS_PICKUP_BONUS_RADIUS; by++) {
          for (let bx = pickup.x - CS_PICKUP_BONUS_RADIUS; bx <= pickup.x + CS_PICKUP_BONUS_RADIUS; bx++) {
            if (csPaintCell(g, bx, by, p.team)) bonus.push({ x: bx, y: by, team: p.team });
          }
        }
        p.score += bonus.length;
        io.to(pin).emit('cs:pickup-grabbed', {
          id: pickup.id,
          icon: pickup.icon,
          x: pickup.x, y: pickup.y,
          team: p.team,
          playerName: p.name,
          bonusCells: bonus,
          teamScores: g.teamScores
        });
        break; // grab one per step
      }
    }
  });

  socket.on('player:tap', ({ pin }) => {
    const g = games[pin];
    if (!g || g.state !== 'active') return;
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

    // === Zombie Escape: each tap sprints this player's TEAM survivor forward ===
    if (g.gameType === 'zombie' && g.zombie && !g.zombie.finishedTeam) {
      const sKey = p.team === 'red' ? 'survRed' : 'survGold';
      g.zombie[sKey] = Math.min(g.zombie.trackLen, g.zombie[sKey] + points);
      if (!g.lastZbBcast || now - g.lastZbBcast >= ZB_HP_BCAST_MS) {
        g.lastZbBcast = now;
        io.to(pin).emit('zb:state', {
          survRed:  g.zombie.survRed,
          survGold: g.zombie.survGold,
          zombRed:  g.zombie.zombRed,
          zombGold: g.zombie.zombGold,
          trackLen: g.zombie.trackLen
        });
      }
      // Win check — first survivor to reach the safe zone
      if (g.zombie[sKey] >= g.zombie.trackLen) {
        g.zombie.finishedTeam = p.team;
        io.to(pin).emit('zb:escaped', {
          team: p.team,
          survRed:  g.zombie.survRed,
          survGold: g.zombie.survGold,
          teamScores: g.teamScores
        });
        if (g.endTimer) clearTimeout(g.endTimer);
        setTimeout(() => endGame(pin), 3500);
      }
    }

    // === Vuelo del Dragón: each tap lifts this player's TEAM dragon ===
    if (g.gameType === 'dragon-eye' && g.dragon && !g.dragon.winner) {
      const altKey = p.team === 'red' ? 'altRed' : 'altGold';
      g.dragon[altKey] = Math.min(g.dragon.maxAlt, g.dragon[altKey] + points);
      // Throttled altitude broadcast
      if (!g.lastDrAltBcast || now - g.lastDrAltBcast >= DR_ALT_BCAST_MS) {
        g.lastDrAltBcast = now;
        io.to(pin).emit('dragon:alt', {
          altRed: g.dragon.altRed,
          altGold: g.dragon.altGold,
          maxAlt: g.dragon.maxAlt
        });
      }
      // Reaching the heavens — celebrate, but RESPECT the timer. The team
      // can keep playing (collecting more taps + points) until duration ends.
      // Once a team has hit the heavens, they cannot go higher (capped above)
      // but they can keep contributing to their score via the normal tap flow.
      if (g.dragon[altKey] >= g.dragon.maxAlt && !g.dragon.heavensAnnounced) {
        g.dragon.heavensAnnounced = p.team;
        io.to(pin).emit('dragon:reached-heavens', {
          team: p.team,
          altRed: g.dragon.altRed,
          altGold: g.dragon.altGold,
          teamScores: g.teamScores
        });
        // No endGame here — wait for the duration timer to fire.
      }
    }

    // === Piñata: each tap damages this player's TEAM tiger ===
    // teamScores already incremented above represents damage dealt by this team
    // (which equals damage taken by their own tiger). HP is the visual countdown.
    if (g.gameType === 'pinata' && g.pinata && !g.pinata.brokenTeam) {
      const hpKey = p.team === 'red' ? 'hpRed' : 'hpGold';
      g.pinata[hpKey] = Math.max(0, g.pinata[hpKey] - points);
      // Throttled HP broadcast — clients lerp between ticks
      if (!g.lastPnHpBcast || now - g.lastPnHpBcast >= PN_HP_BCAST_MS) {
        g.lastPnHpBcast = now;
        io.to(pin).emit('pn:hp', {
          hpRed:  g.pinata.hpRed,
          hpGold: g.pinata.hpGold,
          maxHp:  g.pinata.maxHp
        });
      }
      // Broken? End the round and award victory to the team that broke their own piñata.
      if (g.pinata[hpKey] <= 0) {
        g.pinata.brokenTeam = p.team;
        io.to(pin).emit('pn:broken', {
          team: p.team,
          hpRed: g.pinata.hpRed,
          hpGold: g.pinata.hpGold,
          teamScores: g.teamScores
        });
        if (g.endTimer) clearTimeout(g.endTimer);
        setTimeout(() => endGame(pin), 3500);
      }
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
          if (stillExists.endTimer) clearTimeout(stillExists.endTimer);
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
        g.feed.push({ type: 'leave', name: p.name, t: Date.now() });
        broadcast(currentPin);
        // Schedule full cleanup after 5 minutes of inactivity
        const grabbedSocketId = socket.id;
        p.cleanupTimer = setTimeout(() => {
          const stillExists = games[currentPin];
          if (!stillExists) return;
          const stillThere = stillExists.players[grabbedSocketId];
          if (stillThere && stillThere.disconnected && stillThere.disconnectedAt &&
              Date.now() - stillThere.disconnectedAt >= 4 * 60 * 1000) {
            delete stillExists.players[grabbedSocketId];
            broadcast(currentPin);
          }
        }, 5 * 60 * 1000);
      }
    }
  });
});

// === LÁI-QÙ-HUÍ weather tick — every ~22s pick a weather event and
// broadcast it. Pure visual + audio decoration, doesn't gate movement. ===
setInterval(() => {
  const now = Date.now();
  Object.entries(games).forEach(([pin, g]) => {
    if (g.gameType !== 'laiquhui' || g.state !== 'active') return;
    if (!g.laiquhui) return;
    if (now - g.laiquhui.lastWeatherAt < LQH_WEATHER_INTERVAL_MS) return;
    g.laiquhui.lastWeatherAt = now;
    const w = LQH_WEATHERS[Math.floor(Math.random() * LQH_WEATHERS.length)];
    io.to(pin).emit('lqh:weather', {
      kind: w.kind, icon: w.icon, pinyin: w.pinyin, hanzi: w.hanzi, es: w.es,
      durationMs: LQH_WEATHER_DURATION_MS,
    });
  });
}, 1000);

// === SHÉI SHÌ? tick loop — round-timeout handling
// If a player's round deadline expires without a pick, mark wrong and
// queue the next round. Same per-player cadence as Lái-Qù-Huí. ===
setInterval(() => {
  const now = Date.now();
  Object.entries(games).forEach(([pin, g]) => {
    if (g.gameType !== 'identity' || g.state !== 'active') return;
    Object.entries(g.players).forEach(([pid, p]) => {
      if (!p.idRoundData || p.idRoundResolved) return;
      if (now > p.idRoundData.deadline) {
        p.idRoundResolved = true;
        p.idWrong = (p.idWrong || 0) + 1;
        p.idStreak = 0;
        io.to(pid).emit('id:result', {
          correct: false,
          picked: -1,
          targetIdx: p.idRoundData.targetIdx,
          target: p.idRoundData.suspects[p.idRoundData.targetIdx],
          points: 0,
          score: p.score || 0,
          streak: 0,
          timeout: true,
          correct: p.idCorrect,
          wrong: p.idWrong,
        });
        setTimeout(() => {
          if (!games[pin] || games[pin].state !== 'active') return;
          const stillP = games[pin].players[pid];
          if (!stillP) return;
          stillP.idRound = (stillP.idRound || 0) + 1;
          stillP.idRoundData = idGenerateRound(stillP.idRound);
          stillP.idRoundResolved = false;
          io.to(pid).emit('id:round', {
            roundNum: stillP.idRound,
            suspects: stillP.idRoundData.suspects,
            clue: stillP.idRoundData.clue,
            deadline: stillP.idRoundData.deadline,
            score: stillP.score || 0,
            streak: stillP.idStreak,
            correct: stillP.idCorrect,
            wrong: stillP.idWrong,
          });
        }, 1800);
      }
    });
  });
}, 500);

// === LÁI-QÙ-HUÍ tick loop ===
// Watches each player's mission deadline. If expired without arrival,
// the mission FAILS — no points, increment fail counter, immediately
// hand out a fresh mission.
setInterval(() => {
  const now = Date.now();
  Object.entries(games).forEach(([pin, g]) => {
    if (g.gameType !== 'laiquhui' || g.state !== 'active') return;
    Object.entries(g.players).forEach(([pid, p]) => {
      if (!p.lqhMission) return;
      if (now > p.lqhMission.deadline) {
        p.missionsFailed = (p.missionsFailed || 0) + 1;
        p.lqhStreak = 0;       // reset streak — real consequence
        const failed = p.lqhMission;
        p.lqhMission = lqhGenerateMission(p);
        io.to(pid).emit('lqh:fail', {
          verb: failed.verb,
          sentence: failed.pinyin,
          x: p.x, y: p.y,
          score: p.score,
          missionsDone: p.missionsDone,
          missionsFailed: p.missionsFailed,
        });
        setTimeout(() => {
          if (!games[pin] || games[pin].state !== 'active') return;
          const stillP = games[pin].players[pid];
          if (!stillP) return;
          io.to(pid).emit('lqh:mission', {
            mission: stillP.lqhMission,
            x: stillP.x, y: stillP.y,
            score: stillP.score,
            missionsDone: stillP.missionsDone,
            missionsFailed: stillP.missionsFailed,
          });
        }, 1100);
      }
    });
  });
}, 250);

// === TRIAGE ER tick loop ===
// Drives the patient life-timer decay, periodic auto-spawns into empty beds,
// and randomized hospital events (ambulance arrival, code blue, transfusion).
// Broadcasts a compact `tri:tick` so the host can animate the bed life-bars
// smoothly without spamming per-patient events.
setInterval(() => {
  const now = Date.now();
  Object.entries(games).forEach(([pin, g]) => {
    if (g.gameType !== 'triage' || g.state !== 'active') return;
    const t = g.triage;
    if (!t) return;
    // Decay each patient. If lifeHp hits 0 → patient dies and bed empties.
    const dead = [];
    Object.values(t.patients).forEach((pat) => {
      pat.lifeHp -= pat.decay;
      if (pat.lifeHp <= 0) {
        pat.lifeHp = 0;
        dead.push(pat);
      }
    });
    dead.forEach((pat) => {
      delete t.patients[pat.id];
      t.patientsDied++;
      io.to(pin).emit('tri:patient-died', {
        patientId: pat.id,
        bedIdx: pat.bedIdx,
        icon: pat.icon,
        ailment: pat.ailment,
        critical: pat.critical,
        patientsDied: t.patientsDied,
      });
    });
    // Try-spawn a new patient cadence (only if not all beds are full)
    if (now - t.lastSpawnTry > TR_SPAWN_TRY_MS) {
      t.lastSpawnTry = now;
      if (Math.random() < TR_SPAWN_PROB_PER_TRY) {
        // Difficulty ramp: late-game spawns have a 25% chance of being critical
        const elapsedSec = (now - (g.startedAt || now)) / 1000;
        const critChance = Math.min(0.25, elapsedSec / 240 * 0.25);
        const forceCrit = Math.random() < critChance;
        const newPatient = trTrySpawn(g, { critical: forceCrit });
        if (newPatient) {
          io.to(pin).emit('tri:patient-arrived', {
            patient: newPatient,
            kind: 'walk-in',
          });
        }
      }
    }
    // === Ambulance arrival event ===
    // Adds 2 patients into empty beds at once (one of them critical). Big
    // visual spectacle on host (ambulance drives in from off-screen + siren).
    if (now - t.lastAmbulanceAt > TR_AMBULANCE_INTERVAL_MS) {
      t.lastAmbulanceAt = now;
      const a = trTrySpawn(g, { critical: false });
      const b = trTrySpawn(g, { critical: true });
      const arrivals = [a, b].filter(Boolean);
      if (arrivals.length) {
        io.to(pin).emit('tri:event', {
          kind: 'ambulance',
          arrivals,
        });
      }
    }
    // === Code blue event ===
    // Picks a random existing non-critical patient and bumps them to critical.
    // Host plays the siren + flashing-red alarm; player picker should now show
    // this patient as 🚨 critical urgency.
    if (now - t.lastCodeBlueAt > TR_CODE_BLUE_INTERVAL_MS) {
      t.lastCodeBlueAt = now;
      const candidates = Object.values(t.patients).filter((p) => !p.critical);
      if (candidates.length) {
        const victim = candidates[Math.floor(Math.random() * candidates.length)];
        victim.critical = true;
        victim.decay = 2.4;
        // Don't let them flatline instantly — give them a fighting chance
        victim.lifeHp = Math.max(victim.lifeHp, TR_LIFE_MAX * 0.55);
        io.to(pin).emit('tri:event', {
          kind: 'code-blue',
          patientId: victim.id,
          bedIdx: victim.bedIdx,
        });
      }
    }
    // === Transfusion event (mass-heal bonus) ===
    // Every patient regains a chunk of life. Gives a moment of breathing
    // room and a satisfying simultaneous heart-rate-stabilize visual.
    if (now - t.lastTransfusionAt > TR_TRANSFUSION_INTERVAL_MS) {
      t.lastTransfusionAt = now;
      Object.values(t.patients).forEach((pat) => {
        pat.lifeHp = Math.min(pat.lifeMax, pat.lifeHp + pat.lifeMax * 0.30);
      });
      io.to(pin).emit('tri:event', {
        kind: 'transfusion',
        snapshot: Object.values(t.patients).map((p) => ({ id: p.id, lifeHp: p.lifeHp })),
      });
    }
    // Compact tick — host uses this to smoothly animate the life bars
    io.to(pin).emit('tri:tick', {
      patients: Object.values(t.patients).map((p) => ({
        id: p.id, bedIdx: p.bedIdx, lifeHp: p.lifeHp,
        lifeMax: p.lifeMax, critical: p.critical,
      })),
      livesSavedRed: t.livesSavedRed,
      livesSavedGold: t.livesSavedGold,
      patientsDied: t.patientsDied,
    });
  });
}, TR_TICK_MS);

// === Single global watchdog ===
// (Skips market-quest — that game uses vendor collision triggers, not auto-push)
setInterval(() => {
  const now = Date.now();
  Object.entries(games).forEach(([pin, g]) => {
    if (g.state !== 'active') return;
    if (g.gameType === 'market-quest') return; // vendor-driven, no watchdog needed
    if (g.gameType === 'flappy') return;       // revive-driven, no watchdog
    if (g.gameType === 'laiquhui') return;     // movement-driven, no questions at all
    if (g.gameType === 'warmup') return;       // teacher-driven flashcards, no questions
    if (g.gameType === 'identity') return;     // detective rounds, server-driven
    Object.entries(g.players).forEach(([pid, p]) => {
      // Conquest/triage have multi-stage flows — if the player has a pending
      // strategic pick, don't shove a new question on top of their picker.
      const inAction = p.mashUntil > now || p.walkUntil > now || p.currentQ
                      || p.cqOrderPending || p.triTreatPending;
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

// === Market Quest 20Hz physics tick ===
// Advances player positions based on their input, checks vendor collisions,
// auto-triggers a vocab question on first proximity (with cooldowns).
setInterval(() => {
  const now = Date.now();
  Object.entries(games).forEach(([pin, g]) => {
    if (g.gameType !== 'market-quest' || g.state !== 'active') return;

    // Update positions
    Object.entries(g.players).forEach(([pid, p]) => {
      if (!p.input) p.input = {};
      let vx = 0, vy = 0;
      if (p.input.left)  vx -= 1;
      if (p.input.right) vx += 1;
      if (p.input.up)    vy -= 1;
      if (p.input.down)  vy += 1;
      if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }
      vx *= MQ_PLAYER_SPEED;
      vy *= MQ_PLAYER_SPEED;
      if (vx !== 0 || vy !== 0) {
        p.x = Math.max(40, Math.min(MQ_WORLD_W - 40, p.x + vx));
        p.y = Math.max(40, Math.min(MQ_WORLD_H - 40, p.y + vy));
        p.moving = true;
        if (Math.abs(vx) > Math.abs(vy)) p.dir = vx > 0 ? 'right' : 'left';
        else p.dir = vy > 0 ? 'down' : 'up';
      } else {
        p.moving = false;
      }

      // Stale-question cleanup: if a player has had a question hanging for >10 seconds
      // without responding (e.g. lost it due to client race condition, network drop, etc.),
      // clear it so they can trigger fresh ones.
      if (p.currentQ && p.lastQuestionAt && now - p.lastQuestionAt > 10000) {
        p.currentQ = null;
      }

      // Vendor collision check — auto-trigger quiz if near unclaimed vendor
      if (!p.currentQ) {
        for (const v of g.vendors) {
          if (v.claimedBy) continue;
          const cd = (p.vendorCooldowns && p.vendorCooldowns[v.id]) || 0;
          if (cd > now) continue;
          const dx = p.x - v.x;
          const dy = p.y - v.y;
          if (dx * dx + dy * dy < MQ_VENDOR_RADIUS * MQ_VENDOR_RADIUS) {
            const q = nextQuestionForVendor(g, pid, v.id);
            if (q) io.to(pid).emit('question', q);
            break;
          }
        }
      }

      // Pickup collision — passive: stepping over a pickup grabs it (+1 team point)
      if (g.pickups) {
        for (const pickup of g.pickups) {
          if (!pickup.available) continue;
          const dx2 = p.x - pickup.x;
          const dy2 = p.y - pickup.y;
          if (dx2 * dx2 + dy2 * dy2 < MQ_PICKUP_RADIUS * MQ_PICKUP_RADIUS) {
            pickup.available = false;
            pickup.respawnAt = now + MQ_PICKUP_RESPAWN_MS;
            p.score = (p.score || 0) + MQ_PICKUP_POINTS;
            g.teamScores[p.team] = (g.teamScores[p.team] || 0) + MQ_PICKUP_POINTS;
            io.to(pin).emit('mq:pickup-grabbed', {
              id: pickup.id,
              icon: pickup.icon,
              team: p.team,
              teamScores: g.teamScores
            });
            io.to(pid).emit('mq:my-pickup', {
              icon: pickup.icon,
              playerScore: p.score
            });
          }
        }
      }
    });

    // Respawn pickups whose timer has elapsed
    if (g.pickups) {
      const now2 = Date.now();
      g.pickups.forEach((pickup) => {
        if (!pickup.available && pickup.respawnAt && now2 >= pickup.respawnAt) {
          pickup.available = true;
          io.to(pin).emit('mq:pickup-respawn', { id: pickup.id });
        }
      });
    }

    // Broadcast tick — compact deltas only.
    // To cut bandwidth and client CPU, we only include players whose position
    // or animation state actually changed since the last broadcast. Every 30
    // ticks (~1.5s at 20Hz) we send a full snapshot to keep late-joiners and
    // out-of-sync clients corrected.
    g._mqTickCount = (g._mqTickCount || 0) + 1;
    const isFullSync = (g._mqTickCount % 30) === 0;
    const positions = {};
    let changed = 0;
    Object.entries(g.players).forEach(([id, p]) => {
      const xr = Math.round(p.x);
      const yr = Math.round(p.y);
      const d  = p.dir || 'down';
      const m  = p.moving ? 1 : 0;
      const prev = p._lastBroadcast;
      const dirty = !prev || prev.x !== xr || prev.y !== yr || prev.d !== d || prev.m !== m;
      if (isFullSync || dirty) {
        positions[id] = { x: xr, y: yr, d, m };
        p._lastBroadcast = { x: xr, y: yr, d, m };
        changed++;
      }
    });
    // Skip empty deltas — nothing to say means no packet to send.
    if (isFullSync || changed > 0) {
      io.to(pin).emit('mq:tick', { p: positions, full: isFullSync ? 1 : 0 });
    }
  });
}, MQ_TICK_MS);

// === Flappy ~30Hz physics tick ===
// Each player has independent state: gravity, scrolling pipes, collisions.
// When they die, server sends them a question; on correct answer they revive.
setInterval(() => {
  Object.entries(games).forEach(([pin, g]) => {
    if (g.gameType !== 'flappy' || g.state !== 'active') return;

    const updates = {};
    Object.entries(g.players).forEach(([pid, p]) => {
      if (!p.flAlive) {
        // Dead — just report position so client renders frozen plane
        updates[pid] = { y: Math.round(p.flY), s: p.flScore, a: 0 };
        return;
      }
      // Physics
      p.flVy += FL_GRAVITY;
      p.flY += p.flVy;
      p.flScrollX += FL_SCROLL_SPEED;

      // Floor/ceiling = instant death
      if (p.flY < 20 || p.flY > FL_WORLD_H - 20) {
        p.flAlive = false;
        p.flDeathReason = p.flY < 20 ? 'ceiling' : 'floor';
        io.to(pid).emit('fl:died', { reason: p.flDeathReason, score: p.flScore });
        // Send a question to revive
        sendReviveQuestion(g, pid);
        updates[pid] = { y: Math.round(p.flY), s: p.flScore, a: 0 };
        return;
      }

      // Scroll pipes left
      p.flPipes.forEach((pipe) => { pipe.x -= FL_SCROLL_SPEED; });
      // Remove pipes that left the screen, add new ones on the right
      p.flPipes = p.flPipes.filter((pipe) => pipe.x > -FL_PIPE_W - 50);
      while (p.flPipes.length < 4) {
        const lastX = p.flPipes.length > 0
          ? Math.max(...p.flPipes.map((pp) => pp.x))
          : FL_WORLD_W;
        p.flPipes.push({
          x: lastX + FL_PIPE_SPACING,
          gapY: 100 + Math.random() * (FL_WORLD_H - 200),
          scored: false
        });
      }

      // Collision check + score pipes the player has passed
      const px = FL_PLAYER_X;
      for (const pipe of p.flPipes) {
        // Score when pipe has fully passed player's x
        if (!pipe.scored && pipe.x + FL_PIPE_W < px - FL_PLAYER_R) {
          pipe.scored = true;
          p.flScore++;
          g.teamScores[p.team]++;
        }
        // Collision if player x overlaps pipe x range AND y is outside gap
        if (px + FL_PLAYER_R > pipe.x && px - FL_PLAYER_R < pipe.x + FL_PIPE_W) {
          const gapTop = pipe.gapY - FL_PIPE_GAP / 2;
          const gapBot = pipe.gapY + FL_PIPE_GAP / 2;
          if (p.flY - FL_PLAYER_R < gapTop || p.flY + FL_PLAYER_R > gapBot) {
            p.flAlive = false;
            p.flDeathReason = 'pipe';
            io.to(pid).emit('fl:died', { reason: 'pipe', score: p.flScore });
            sendReviveQuestion(g, pid);
            break;
          }
        }
      }

      updates[pid] = { y: Math.round(p.flY), s: p.flScore, a: 1 };
    });

    // Broadcast everyone's positions + scores + pipes-relative-to-each-player
    // For efficiency: send pipes only to each individual player (they're per-player)
    Object.entries(g.players).forEach(([pid, p]) => {
      io.to(pid).emit('fl:tick', {
        me: {
          y: Math.round(p.flY),
          alive: p.flAlive,
          score: p.flScore
        },
        pipes: p.flPipes.map((pp) => ({ x: Math.round(pp.x), g: Math.round(pp.gapY) })),
        teamScores: g.teamScores,
        // Compact summary of all players (for leaderboard on host + teammate flags)
        all: updates
      });
    });
  });
}, FL_TICK_MS);

// Helper: send a revive question to a player who just died in Flappy
function sendReviveQuestion(g, pid) {
  const q = nextQuestionFor(g, pid);
  if (q) io.to(pid).emit('question', q);
}

// Color Splash pickup respawn loop — 1Hz is plenty for 15-sec respawns
setInterval(() => {
  const now = Date.now();
  Object.entries(games).forEach(([pin, g]) => {
    if (g.gameType !== 'color-splash' || g.state !== 'active') return;
    if (!g.pickups) return;
    g.pickups.forEach((pickup) => {
      if (!pickup.available && pickup.respawnAt && now >= pickup.respawnAt) {
        pickup.available = true;
        io.to(pin).emit('cs:pickup-respawn', { id: pickup.id });
      }
    });
  });
}, 1000);

// Every 500ms, broadcast a slim leaderboard payload to flappy games (for the host UI)
setInterval(() => {
  Object.entries(games).forEach(([pin, g]) => {
    if (g.gameType !== 'flappy' || g.state !== 'active') return;
    const players = {};
    Object.entries(g.players).forEach(([id, p]) => {
      players[id] = {
        name: p.name,
        team: p.team,
        y: Math.round(p.flY || 0),
        score: p.flScore || 0,
        alive: !!p.flAlive
      };
    });
    io.to(pin).emit('fl:scores', { teamScores: g.teamScores, players });
  });
}, 500);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n  Mochi Mash running on http://localhost:${PORT}\n`);
});
