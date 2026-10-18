#!/usr/bin/env node
// test-golden-book.js — La Ruta Dorada, phase 5 (2026-10-16): «El libro dorado», the golden book on the web.
// Two parts, both on MADE-UP accounts in a temporary folder (never data/, never the live site):
//   1. the content (no server): every level of core/levels.js with a `golden` book has its export
//      (content/golden/<book>.json + protected/golden/<book>/): one simulation per platform simulation, every question
//      of the platform's data once and in order with its right answer, no hanzi, no em dash, every photo a WebP <= 60 KB,
//      every clip really speaks (ffprobe > 0.3 s), the web PDF under 9 MB, all new media <= 20 MB; and, when the study
//      book's build is on this PC (../study/<book>/build/book.html), the web matches the printed book question by
//      question (number, every pinyin and Spanish line, the answer, the word lists); skipped in a clone without it.
//   2. its OWN server (port 4440, never 3000) with throw-away teacher codes and level keys that are never printed:
//      the doors for every visitor (anonymous · a new kid without the key · a key-only phone · a kid whose Dorado is
//      closed · a kid who took Simulacro 1 only · a kid who took every simulation · a blank try · a teacher), the page,
//      the API, the photos / clips / PDF (by index, refused to whoever may not open them, no path tricks), the mistakes
//      = the latest try's wrongQs (YCT and old HSK), the route's step 3, /maestro's «Ver su libro» (teacher sessions
//      only; a kid holding the link sees only their own book), nothing written on a record by a view.
//   node scripts/test-golden-book.js            (--port 4440 · --keep to leave the server running)
'use strict';
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFileSync } = require('child_process');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };
const PORT = Number(opt('port', 4440));
const KEEP = args.includes('--keep');
if (PORT === 3000) { console.error('never port 3000 (that is the dev server of the main checkout)'); process.exit(2); }
const ROOT = path.join(__dirname, '..');

let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.log('  ✖ ' + msg); } };
const section = (t) => console.log('· ' + t);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CJK = /[\u2e80-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/;

const Levels = require('../core/levels');
const HskSim = require('../core/hsk-sim');
const YctSim = require('../core/yct-sim');
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const BOOKS = Levels.LEVELS.filter((l) => l.golden).map((l) => ({ level: l.id, slug: l.pack || l.id, id: l.golden, name: l.name }));
const book = (id) => read(path.join(ROOT, 'content', 'golden', id + '.json'));
const MEDIA = path.join(ROOT, 'protected', 'golden');
const FFDIR = 'C:/Users/ferpa/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/';
const FFPROBE = process.env.FFPROBE || (fs.existsSync(FFDIR + 'ffprobe.exe') ? FFDIR + 'ffprobe.exe' : 'ffprobe');
let probe = true;
try { execFileSync(FFPROBE, ['-version'], { stdio: 'ignore' }); } catch (_) { probe = false; console.log('note: no ffprobe here: clip lengths judged by file size'); }
function findUp(rel) {
  let dir = ROOT;
  for (let i = 0; i < 8; i++) {
    const p = path.join(dir, rel);
    if (fs.existsSync(p)) return p;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}
const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&nbsp;/g, '\u00a0').replace(/&amp;/g, '&');
const plain = (h) => unescape(String(h).replace(/<[^>]+>/g, '')).trim();
const noBraces = (s) => String(s || '').replace(/[{}]/g, '').trim();

// the platform's own simulation data → [{ q, num, answer }] in order (YCT / New HSK: core/yct/*.json; old HSK: hsk-sim.js)
function platformQuestions(simId) {
  if (/^hsk\d/.test(simId)) {
    const s = HskSim.SIMULATIONS[simId];
    const out = [];
    [['L', s.listening], ['R', s.reading]].forEach(([sec, S]) => [1, 2, 3, 4].forEach((p) => {
      const part = S['part' + p];
      if (part && Array.isArray(part.questions)) part.questions.forEach((q) => out.push({ q: sec + p + '-' + q.num, num: q.num,
        answer: typeof q.answer === 'boolean' ? (q.answer ? 'T' : 'F') : String(q.answer) }));
    }));
    return out;
  }
  const s = read(path.join(ROOT, 'core', 'yct', simId + '.json'));
  const out = [];
  ['listening', 'reading'].forEach((sec) => s[sec].parts.forEach((p) => p.items.forEach((it) => { if (!it.example) out.push({ q: it.qid, num: it.num, answer: it.answer }); })));
  return out;
}
const webQuestions = (b, n) => b.sims[n - 1].parts.flatMap((p) => p.items.map((it) => Object.assign({ kind: p.kind }, it)));

// what a card prints, in order (the page draws the same fields in this order): [pinyin lines], [Spanish lines]
function printed(it) {
  const py = [], es = [];
  const line = (l) => { py.push(String(l.py).split('___').join(l.fw != null ? l.fw : '___')); if (l.es) es.push(noBraces(l.es)); };
  if (it.kind === 'text') {
    it.said.forEach(line);
    it.opts.forEach((o) => { py.push(o.py); if (o.es) es.push(noBraces(o.es)); });
  } else if (it.lines) it.lines.forEach(line);
  else line(it);
  return { py, es };
}
// the printed book: per simulation, its question cards [{ num, py, es, ans }] and word lists
function bookCards(html) {
  const starts = [...html.matchAll(/<div class="x-sim">/g)].map((m) => m.index);
  const end = html.indexOf('class="page x-answers"');
  return starts.map((s, i) => {
    const chunk = html.slice(s, i + 1 < starts.length ? starts[i + 1] : end);
    const cards = [...chunk.matchAll(/<article class="x-card ([^"]*)">([\s\S]*?)<\/article>/g)].map((m) => {
      const a = m[2];
      const num = Number((/<span class="qn">(\d+)<\/span>/.exec(a) || [])[1]);
      const py = [...a.matchAll(/<p class="py[^"]*" lang="zh-Latn-pinyin">([\s\S]*?)<\/p>/g)].map((x) => plain(x[1]));
      const es = [...a.matchAll(/<p class="es">([\s\S]*?)<\/p>/g)].map((x) => plain(x[1])).filter(Boolean);
      let ans = null;
      const tf = /<span class="tfm">([\s\S]*?)<\/span>/.exec(a);
      if (tf) ans = [...tf[1].matchAll(/<i class="mk( on)?">/g)].findIndex((x) => x[1]) === 0 ? 'T' : 'F';
      ans = ans || (/<figure class="opt ok">[\s\S]*?<span class="lt"[^>]*>([A-F])<\/span>/.exec(a) || [])[1] ||
        (/<div class="topt ok"><b class="tl">([A-F])<\/b>/.exec(a) || [])[1] || (/<span class="lt on"[^>]*>([A-F])<\/span>/.exec(a) || [])[1] ||
        (/<span class="ans"><b>([A-F])<\/b><\/span>/.exec(a) || [])[1] || null;
      return { num, py, es, ans };
    });
    const banks = [...chunk.matchAll(/<span class="bk[^"]*"><b>([A-F])<\/b><span class="bt"><span class="py" lang="zh-Latn-pinyin">([\s\S]*?)<\/span><span class="es">([\s\S]*?)<\/span><\/span>/g)]
      .map((m) => ({ l: m[1], py: plain(m[2]), es: plain(m[3]) }));
    return { cards, banks };
  });
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 1. the content
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
function content() {
  ok(BOOKS.length >= 3, 'core/levels.js names the golden books (' + BOOKS.map((b) => b.id).join(', ') + ')');
  let newBytes = 0;
  BOOKS.forEach((B) => {
    const tag = B.id + ': ';
    const b = book(B.id);
    const platform = HskSim.listSims().concat(YctSim.listSims()).filter((s) => Levels.normalize(s.level) === B.level)
      .sort((x, y) => Number(x.id.split('sim')[1]) - Number(y.id.split('sim')[1]));
    ok(b.sims.length === platform.length && b.sims.every((s, i) => s.n === i + 1 && s.id === platform[i].id),
      tag + `one golden simulation per platform simulation, in order (${b.sims.length} of ${platform.length})`);
    ok(Levels.normalize(b.level) === B.level, tag + 'the book names its level (' + b.level + ')');
    const text = JSON.stringify(b);
    ok(!CJK.test(text), tag + 'no hanzi anywhere in the book data');
    ok(!/—/.test(text), tag + 'no em dash');
    b.sims.forEach((s) => {
      const web = webQuestions(b, s.n);
      const plat = platformQuestions(s.id);
      ok(web.length === plat.length && web.length === s.questions, tag + `Simulación ${s.n}: ${plat.length} questions, each once`);
      ok(web.every((w, i) => plat[i] && w.q === plat[i].q && w.num === plat[i].num && w.ans === plat[i].answer),
        tag + `Simulación ${s.n}: the platform's questions in order, each with its right answer`);
      ok(web.every((w) => (w.kind === 'abc' ? w.opts.length === 3 && w.opts.some((o) => o.l === w.ans) : true) && (w.kind === 'text' ? w.opts.some((o) => o.l === w.ans) : true)),
        tag + `Simulación ${s.n}: every choice question holds its answer among its options`);
      const listen = web.filter((w) => w.q[0] === 'L');
      ok(listen.every((w) => w.a != null && s.clips[w.a]), tag + `Simulación ${s.n}: every listening question has its own play button`);
      ok(web.filter((w) => w.q[0] === 'R').every((w) => w.a == null), tag + `Simulación ${s.n}: reading questions have none`);
      const picsUsed = new Set();
      web.forEach((w) => { if (w.p != null) picsUsed.add(w.p); (w.opts || []).forEach((o) => { if (o.p != null) picsUsed.add(o.p); }); });
      ok([...picsUsed].every((i) => s.pics[i]) && picsUsed.size === s.pics.length, tag + `Simulación ${s.n}: every photo a card shows exists, and none is unused`);
    });
    // media on disk
    const packs = b.sims.concat([b.examples]);
    let pics = 0, clips = 0, short = Infinity;
    packs.forEach((pk) => {
      pk.pics.forEach((p) => {
        const f = path.join(MEDIA, B.id, p.f);
        const sz = fs.existsSync(f) ? fs.statSync(f).size : -1;
        if (!(sz > 500 && sz <= 60 * 1024 && /^[0-9a-z]+\/p\d+\.webp$/.test(p.f))) ok(false, tag + `photo ${p.f}: ${sz} bytes (a WebP <= 60 KB, named by order only)`);
        pics += Math.max(0, sz);
      });
      pk.clips.forEach((c) => {
        const f = c.src ? path.join(ROOT, 'protected', c.src) : path.join(MEDIA, B.id, c.f);
        if (!fs.existsSync(f)) { ok(false, tag + 'missing clip ' + (c.src || c.f)); return; }
        if (!c.src) {
          clips += fs.statSync(f).size;
          if (!/^[0-9a-z]+\/a\d+\.m4a$/.test(c.f)) ok(false, tag + 'a clip named by order only: ' + c.f);
        } else if (!/^HSK SIMULATIONS\//.test(c.src)) ok(false, tag + 'a reused clip from the protected exam media: ' + c.src);
        if (probe) {
          const d = parseFloat(execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
          short = Math.min(short, d);
          if (!(d > 0.3)) ok(false, tag + `${c.src || c.f} speaks for ${d} s`);
        }
      });
    });
    ok(true, tag + `photos ${(pics / 1e6).toFixed(1)} MB, new clips ${(clips / 1e6).toFixed(1)} MB` + (probe && isFinite(short) ? `, shortest clip ${short.toFixed(2)} s` : ''));
    newBytes += pics + clips;
    const pdf = path.join(MEDIA, B.id, 'book.pdf');
    ok(fs.existsSync(pdf) && fs.statSync(pdf).size < 9 * 1048576 && fs.readFileSync(pdf).slice(0, 5).toString() === '%PDF-', tag + `the web PDF is there, under 9 MB (${fs.existsSync(pdf) ? (fs.statSync(pdf).size / 1e6).toFixed(1) : '?'} MB)`);
    ok(!fs.existsSync(path.join(ROOT, 'public', 'assets', 'golden')) && !fs.readdirSync(path.join(ROOT, 'public')).some((f) => /golden.*\.json$/.test(f)), tag + 'nothing of the book under public/');

    // the printed book, when its build is on this PC
    // (a clone elsewhere can point at the study folder: STUDY_DIR=<…/study>)
    const html = process.env.STUDY_DIR && fs.existsSync(path.join(process.env.STUDY_DIR, B.id, 'build', 'book.html'))
      ? path.join(process.env.STUDY_DIR, B.id, 'build', 'book.html') : findUp(path.join('study', B.id, 'build', 'book.html'));
    if (!html) { console.log(`note: the study book build (../study/${B.id}/build/) is not on this machine: compared with the platform's data only`); return; }
    const printedBook = bookCards(fs.readFileSync(html, 'utf8'));
    ok(printedBook.length === b.sims.length, tag + `the printed book has ${b.sims.length} simulations (found ${printedBook.length})`);
    let bad = 0;
    printedBook.forEach((pb, si) => {
      const web = webQuestions(b, si + 1);
      ok(pb.cards.length === web.length, tag + `Simulación ${si + 1}: ${web.length} cards in the book (found ${pb.cards.length})`);
      pb.cards.forEach((c, i) => {
        const w = web[i];
        if (!w) return;
        const pw = printed(w);
        const same = c.num === w.num && c.ans === w.ans && JSON.stringify(c.py) === JSON.stringify(pw.py) && JSON.stringify(c.es) === JSON.stringify(pw.es);
        if (!same && bad++ < 6) console.log('    book ' + JSON.stringify(c) + '\n    web  ' + JSON.stringify(Object.assign({ num: w.num, ans: w.ans }, pw)));
      });
      const banks = b.sims[si].parts.filter((p) => p.bank).flatMap((p) => p.bank.map((x) => ({ l: x.l, py: x.py, es: noBraces(x.es) })));
      ok(JSON.stringify(pb.banks) === JSON.stringify(banks), tag + `Simulación ${si + 1}: the word lists as the book prints them (${banks.length} words)`);
    });
    ok(bad === 0, tag + `every card = the printed book's (number, pinyin, Spanish, answer): ${bad} differ`);
  });
  ok(newBytes <= 20 * 1e6, `all new web book media (photos + clips) ${(newBytes / 1e6).toFixed(1)} MB (budget 20 MB)`);
  // every file is the one the JSON stamped (an export that stopped half-way would leave another question's photo)
  let stale = 0;
  BOOKS.forEach((B) => {
    const b = book(B.id);
    b.sims.concat([b.examples]).forEach((pk) => pk.pics.concat(pk.clips).forEach((x) => {
      const f = x.src ? path.join(ROOT, 'protected', x.src) : path.join(MEDIA, B.id, x.f);
      if (!fs.existsSync(f) || crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex').slice(0, 10) !== x.v) stale++;
    }));
    const pdf = path.join(MEDIA, B.id, 'book.pdf');
    if (crypto.createHash('sha1').update(fs.readFileSync(pdf)).digest('hex').slice(0, 10) !== b.pdf.v) stale++;
    // «Así es el examen» goes with ANY open book: its word lists name no simulation question (that would be its answer)
    ok(b.examples.parts.every((p) => (p.bank || []).every((x) => x.for == null || x.for === 'ex')), B.id + ': the examples\' word lists name only the example');
  });
  ok(stale === 0, `every photo, clip and PDF is the file its stamp names (${stale} differ)`);
  // core/golden.js on its own: only configured books, a try needs real answers, a try from an older simulation shape
  const G = require('../core/golden');
  ok(G.book('x'.repeat(40)) === null && G.book('zz9sim') === null && G.book('yct1sim') && G.book('yct1sim').id === 'yct1sim', 'only a book core/levels.js names is ever read');
  const rec = { hskResults: [
    { simId: 'yct1-sim1', total: 200, score: 0, percent: 0, answeredCount: 1, questions: 35, wrongQs: [], ts: 1 },
    { simId: 'yct1-sim2', total: 200, score: 100, percent: 50, answeredCount: 18, questions: 35, wrongQs: [], ts: 2 },
    { simId: 'yct1-sim3', total: 200, score: 0, percent: 0, answeredCount: 0, wrongQs: [], ts: 3 },
    { simId: 'yct1-sim4', total: 200, score: 160, percent: 80, answeredCount: 3, wrongQs: [], ts: 4 },
    { simId: 'hsk1-sim1', total: 300, score: 200, percent: 67, answeredCount: 30, wrongQs: [{ qid: 'L1-1', given: true }], ts: 5 },
  ] };
  ok(!G.taken(rec, 'yct1-sim1') && G.taken(rec, 'yct1-sim2'), 'a try with 1 of 35 answered opens no book; 18 of 35 does');
  ok(!G.taken(rec, 'yct1-sim3') && G.taken(rec, 'yct1-sim4'), 'blank: no; an older try without the question count: anything but blank');
  G.configure({ totalOf: (id) => (/^hsk/.test(id) ? 400 : 200) });
  const ov = G.attemptView(G.latest(rec, 'hsk1-sim1'), G.book('hsk1sim').sims[0]);
  ok(ov && ov.wrong === null && G.mistakesOf(G.latest(rec, 'hsk1-sim1')) === null && ov.passed === true, 'an old-HSK try of 30 questions (total 300): no per-question record on a 40-question book, passed by its %');
  ok(G.attemptView({ simId: 'hsk1-sim2', total: 400, score: 130, percent: 33, wrongQs: [] }, G.book('hsk1sim').sims[1]).passed === false, 'old HSK: 130 points of 400 (33 %) is not «¡Aprobado!»');
  // the page code holds no content and no media address
  const js = fs.readFileSync(path.join(ROOT, 'public', 'js', 'libro.js'), 'utf8');
  const y = book('yct1sim');
  const sample = webQuestions(y, 1).slice(0, 12).flatMap((w) => printed(w).py).filter((s) => s.length > 6);
  ok(!sample.some((s) => js.includes(s)) && !/protected|content\/golden|golden-media|\.m4a|\.mp3/.test(js), 'js/libro.js holds no question, answer or file address of its own');
  ok(!/pack-check|\/api\/sets|\/api\/packs/.test(js) && /\/api\/golden\//.test(js), '… it reads only /api/golden');
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 2. its own server
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-golden-'));
const rnd = (n) => crypto.randomBytes(n).toString('hex').toUpperCase();
const LEGACY = 'legacy-' + rnd(12);
const SEED = 'T-' + rnd(5);
const SECRET = 'test-' + rnd(24);
const KEYS = { yct1: 'Luna-' + (10 + crypto.randomInt(89)), hsk2: 'Cometa-' + (10 + crypto.randomInt(89)), hsk1: 'Tigre-' + (10 + crypto.randomInt(89)) };

function req(method, p, o = {}) {
  return new Promise((resolve, reject) => {
    const h = Object.assign({}, o.headers || {});
    if (o.jar && Object.keys(o.jar).length) h.Cookie = Object.entries(o.jar).map(([k, v]) => k + '=' + v).join('; ');
    let data = null;
    if (o.body !== undefined) { data = Buffer.from(JSON.stringify(o.body)); h['Content-Type'] = 'application/json'; h['Content-Length'] = data.length; }
    const r = http.request({ host: '127.0.0.1', port: PORT, method, path: p, headers: h }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const text = buf.toString('utf8');
        const sc = res.headers['set-cookie'] || [];
        if (o.jar) sc.forEach((c) => { const m = /^([^=]+)=([^;]*)/.exec(c); if (m) { if (/Max-Age=0\b/.test(c)) delete o.jar[m[1]]; else o.jar[m[1]] = m[2]; } });
        let json = null;
        try { json = JSON.parse(text); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, text, json, bytes: buf.length });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}
const get = (p, o) => req('GET', p, o);
const post = (p, body, o = {}) => req('POST', p, Object.assign({}, o, { body }));
const put = (p, body, o = {}) => req('PUT', p, Object.assign({}, o, { body }));
const T = (code) => ({ 'X-Admin-Pw': encodeURIComponent(code) });
let ipN = 10;
const phone = () => ({ jar: {}, headers: { 'CF-Connecting-IP': '198.51.100.' + (ipN++) } });
const as = (ph, extra) => ({ jar: ph.jar, headers: Object.assign({}, ph.headers, extra || {}) });
const teacher = (code) => ({ jar: {}, headers: Object.assign({ 'CF-Connecting-IP': '198.51.100.250' }, T(code)) });
const ruta = async (o) => (await get('/api/ruta-dorada', o)).json || {};
const mod = (st, id) => (st.modules || []).find((m) => m.id === id);
const isKeyScreen = (r) => r.status === 401 && /data-level-key="locked"/.test(r.text);
const isAudiosPage = (r) => r.status === 200 && /id="au-main"/.test(r.text) && !/data-level-key/.test(r.text);
const gb = (ph, level, n, de) => get('/api/golden/' + level + '/' + n + (de ? '?de=' + encodeURIComponent(de) : ''), ph.jar ? as(ph) : ph);

let srv = null;
let allLog = '';
async function startServer(extraEnv) {
  try { await get('/health'); console.error('port ' + PORT + ' is busy: stop that server first'); process.exit(2); } catch (_) { /* free */ }
  srv = spawn(process.execPath, ['server.js'], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { PORT: String(PORT), DRALY_DATA_DIR: DATA, STUDENT_DATA_DIR: '', SIM_LOCK_SECRET: SECRET,
      WU_ADMIN_PASSWORD: LEGACY, DRALY_SEED_ADMIN_CODE: SEED, RENDER: '', DRALY_TRAINING_BUILT: '' }, extraEnv || {}),
  });
  srv.stdout.on('data', (d) => { allLog += d; });
  srv.stderr.on('data', (d) => { allLog += d; });
  for (let i = 0; i < 60; i++) {
    await sleep(400);
    try { const r = await get('/health'); if (r.status === 200) return; } catch (_) {}
  }
  console.error('the server did not start:\n' + allLog.slice(-2000));
  srv.kill();
  process.exit(2);
}
async function stopServer() {
  if (!srv) return;
  const p = new Promise((r) => srv.once('exit', r));
  srv.kill();
  await p;
  srv = null;
  await sleep(300);
}
async function enter(ph, accessCode, name, code) {
  const body = code ? { accessCode, studentCode: code } : { accessCode, displayName: name };
  return (await post('/api/homework/enter', body, as(ph))).json || {};
}
// a simulation handed in by a kid on their own: the right answer everywhere except `wrong` (a wrong one) and `blank`
// (nothing); `none` = hand it in with nothing answered at all
async function takeSim(ph, simId, wrong, blank, none) {
  const p = await get('/api/hsk-sim/' + simId, as(ph));
  if (!p.json || !p.json.ok) return { status: p.status, json: p.json };
  const b = book(Levels.info(Levels.normalize(simId.replace(/-sim\d+$/, ''))).golden);
  const s = b.sims.find((x) => x.id === simId);
  const old = /^hsk\d/.test(simId);
  const answers = {};
  if (!none) {
    webQuestions(b, s.n).forEach((w) => {
      if ((blank || []).includes(w.q)) return;
      let a = w.ans;
      if ((wrong || []).includes(w.q)) a = w.kind === 'tf' ? (a === 'T' ? 'F' : 'T') : ['A', 'B', 'C', 'D', 'E', 'F'].find((x) => x !== a);
      answers[w.q] = old && w.kind === 'tf' ? a === 'T' : a;
    });
  }
  const r = await post('/api/hsk-sim/' + simId + '/submit', { answers, ticket: p.json.sim.ticket }, as(ph));
  return { status: r.status, json: r.json };
}
const recordOf = (code) => { try { return read(path.join(DATA, 'student-records.json'))[code] || null; } catch (_) { return null; } };
// a simulation taken in a teacher's PIN room (the kid joins with the room's PIN; no key or Dorado needed there)
const { io } = require('socket.io-client');
const emitAck = (s, ev, payload, ms = 5000) => new Promise((res) => {
  const t = setTimeout(() => res({ timeout: true }), ms);
  s.emit(ev, payload, (r) => { clearTimeout(t); res(r || {}); });
});
async function takeInRoom(ph, code, simId, wrong) {
  const host = io('http://127.0.0.1:' + PORT, { transports: ['websocket'], forceNew: true });
  const kid = io('http://127.0.0.1:' + PORT, { transports: ['websocket'], forceNew: true });
  try {
    const created = await emitAck(host, 'host:create', { gameType: 'hsksim', simId, password: LEGACY });
    const joined = created && created.pin ? await emitAck(kid, 'player:join', { pin: created.pin, name: 'Sala ' + code, studentCode: code }) : {};
    if (!joined || !joined.roomPass) return { status: 0 };
    const q = '?pin=' + created.pin + '&pass=' + encodeURIComponent(joined.roomPass);
    const p = await get('/api/hsk-sim/' + simId + q, as(ph));
    const b = book(Levels.info(Levels.normalize(simId.replace(/-sim\d+$/, ''))).golden);
    const s = b.sims.find((x) => x.id === simId);
    const answers = {};
    webQuestions(b, s.n).forEach((w) => {
      let a = w.ans;
      if ((wrong || []).includes(w.q)) a = w.kind === 'tf' ? (a === 'T' ? 'F' : 'T') : ['A', 'B', 'C', 'D', 'E', 'F'].find((x) => x !== a);
      answers[w.q] = a;
    });
    const r = await post('/api/hsk-sim/' + simId + '/submit' + q, { answers, ticket: p.json && p.json.sim && p.json.sim.ticket, pin: created.pin, pass: joined.roomPass, studentCode: code }, as(ph));
    await emitAck(host, 'host:end', { pin: created.pin, password: LEGACY });
    return { status: r.status, json: r.json };
  } finally { host.close(); kid.close(); }
}

async function server() {
  const stamp36 = Date.now().toString(36).slice(-4);
  await startServer();
  // kids enrolled before the keys (grandfathered: their class level is open)
  const S1 = phone(), ALL = phone(), BL = phone(), H1 = phone(), D1 = phone();
  const kS1 = await enter(S1, '1003', 'Libro Uno ' + stamp36);
  const kALL = await enter(ALL, '1003', 'Libro Todo ' + stamp36);
  const kBL = await enter(BL, '1003', 'Libro Blanco ' + stamp36);
  const kH1 = await enter(H1, '1001', 'Libro Hsk ' + stamp36);
  const kD1 = await enter(D1, '1003', 'Libro Cerrado ' + stamp36);
  const R1 = phone();
  const kR1 = await enter(R1, '1003', 'Libro Sala ' + stamp36);   // takes simulations in a teacher's room, no Dorado
  ok([kS1, kALL, kBL, kH1, kD1, kR1].every((k) => k.ok && k.levelOpen), 'six kids enrolled before the keys (their level open)');
  for (const [lvl, k] of Object.entries(KEYS)) ok((await put('/api/admin/level-keys/' + lvl, { key: k }, teacher(SEED))).json.ok, `the ${lvl} key is set`);
  const st0 = (await get('/api/admin/ruta-settings', teacher(SEED))).json.settings;
  ok(st0.trainingLive === true, 'the Dorado rule is ON (El Entrenamiento live): the Dorado is earned');
  const N1 = phone();
  const kN = await enter(N1, '1003', 'Libro Nuevo ' + stamp36);
  ok(kN.ok && kN.levelOpen === false, 'a kid enrolled after the keys, without the key');
  const K1 = phone();
  ok((await post('/api/level-key', { level: 'yct1', key: KEYS.yct1 }, as(K1))).json.ok, 'a phone that typed the YCT 1 key (nobody logged in)');
  const anon = phone();
  const unlock = (code, level) => post('/api/admin/student/' + code + '/ruta', { level, step: 'dorado', action: 'unlock' }, teacher(SEED));
  for (const [k, lvl] of [[kS1, 'yct1'], [kALL, 'yct1'], [kBL, 'yct1'], [kH1, 'hsk1']]) ok((await unlock(k.studentCode, lvl)).json.ok, 'a teacher opens the Dorado of a kid (' + lvl + ')');

  section('the simulations taken');
  const Y = book('yct1sim');
  const y1 = webQuestions(Y, 1);
  const wrong1 = [y1[2].q, y1[8].q, y1[23].q, y1[33].q];
  const blank1 = [y1[30].q];
  let t = await takeSim(S1, 'yct1-sim1', wrong1, blank1);
  ok(t.status === 200 && t.json.ok, 'kid S1 hands in Simulacro 1 (4 wrong, 1 blank)');
  t = await takeSim(S1, 'yct1-sim1', [y1[0].q], []);
  ok(t.status === 200, '… and again later (1 wrong): the book shows the LATEST try');
  for (let n = 1; n <= Y.sims.length; n++) ok((await takeSim(ALL, 'yct1-sim' + n, n === 2 ? [webQuestions(Y, 2)[5].q] : [], [])).status === 200, 'kid ALL hands in Simulacro ' + n);
  ok((await takeSim(BL, 'yct1-sim1', [], [], true)).status === 200, 'kid BL hands Simulacro 1 in blank (nothing answered)');
  // shortcuts to the answers: one answer, or made-up question ids (the server counts what the grader saw)
  const one = await get('/api/hsk-sim/yct1-sim2', as(BL));
  ok((await post('/api/hsk-sim/yct1-sim2/submit', { answers: { [y1[0].q]: 'T' }, ticket: one.json.sim.ticket }, as(BL))).status === 200, 'kid BL hands Simulacro 2 in with ONE answer');
  ok((await post('/api/hsk-sim/yct1-sim3/submit', { answers: { zz: 'A', yy: 'B', xx: 'C', ww: 'A', vv: 'B', uu: 'C', tt: 'A', ss: 'B', rr: 'C', qq: 'A', pp: 'B', oo: 'C', nn: 'A', mm: 'B', ll: 'C', kk: 'A', jj: 'B', ii: 'C' } }, as(BL))).status === 200,
    '… and Simulacro 3 with 18 made-up question ids (no ticket)');
  const H2 = phone();
  const kH2 = await enter(H2, '1001', 'Libro Hsk Dos ' + stamp36);
  ok(kH2.ok && (await post('/api/level-key', { level: 'hsk1', key: KEYS.hsk1 }, as(H2))).json.ok && (await unlock(kH2.studentCode, 'hsk1')).json.ok,
    'a second HSK 1 kid (enrolled after the keys: types the HSK 1 key), the Dorado opened by a teacher');
  ok((await takeSim(H2, 'hsk1-sim2', webQuestions(book('hsk1sim'), 2).slice(0, 26).map((w) => w.q), [])).status === 200, '… hands in old-HSK Simulacro 2 with 26 of 40 wrong');
  const H = book('hsk1sim');
  const h1 = webQuestions(H, 1);
  const hWrong = [h1.find((w) => w.kind === 'tf').q, h1[h1.length - 1].q];
  ok((await takeSim(H1, 'hsk1-sim1', hWrong, [])).status === 200, 'an HSK 1 kid hands in old-HSK Simulacro 1 (a ✓/✗ wrong, the last one wrong)');
  await sleep(1500);   // the student file is written a second after the last change

  section('the page: behind the level\'s key');
  ok(isKeyScreen(await get('/audios/yct1/libro/1', as(anon))) && isKeyScreen(await get('/audios/yct1/libro/1', as(N1))), 'anonymous, a new kid without the key: the key screen');
  ok(isAudiosPage(await get('/audios/yct1/libro/1', as(K1))) && isAudiosPage(await get('/audios/yct1/libro/2', as(S1))), 'a key-only phone, a kid: the page (it holds no content; the API says what to show)');
  ok(isAudiosPage(await get('/audios/hsk2/libro/1', teacher(SEED))) && isAudiosPage(await get('/audios/newhsk1/libro/2', teacher(SEED))), 'a teacher: any level, by its stored id or its curriculum name');
  let r = await get('/audios/yct1/libro/9', as(S1));
  ok(r.status === 302 && /\/audios\/yct1#paso-3$/.test(r.headers.location || ''), 'a simulation that does not exist → the route\'s step 3');
  r = await get('/audios/yct1/libro', as(S1));
  ok(r.status === 302 && /\/audios\/yct1#paso-3$/.test(r.headers.location || ''), '/audios/<level>/libro → the route\'s step 3');
  ok((await get('/audios/zz9/libro/1', as(S1))).status === 302, 'a level that does not exist → La Ruta Dorada');
  ok((await get('/content/golden/yct1sim.json')).status === 404 && (await get('/protected/golden/yct1sim/1/p00.webp')).status === 404 && (await get('/golden/yct1sim/book.pdf')).status === 404,
    'the book\'s data and files have no public address');

  section('the API: every door, in order');
  r = await gb(anon, 'yct1', 1);
  ok(r.status === 401 && r.json.why === 'key' && !r.json.sim && !r.json.player && !r.json.title && !r.json.simCount, 'anonymous: 401 (the key screen), nothing of the book (not even its title, size or players)');
  r = await gb(N1, 'yct1', 1);
  ok(r.status === 401 && !r.json.sim, 'a new kid without the key: 401');
  r = await gb(K1, 'yct1', 1);
  ok(r.status === 403 && r.json.why === 'login' && !r.json.sim, 'a key-only phone: «Entra con tu código para ver tu libro dorado» (no answers)');
  r = await gb(D1, 'yct1', 1);
  ok(r.status === 403 && r.json.why === 'dorado' && !r.json.sim, 'a kid whose El Simulacro Dorado is still closed and who took nothing: «Primero, El Simulacro Dorado»');
  r = await gb(BL, 'yct1', 1);
  ok(r.status === 403 && r.json.why === 'taken' && !r.json.sim, 'a kid who handed Simulacro 1 in blank: not taken, no book');
  r = await gb(S1, 'yct1', 2);
  ok(r.status === 403 && r.json.why === 'taken' && !r.json.sim && /yct-sim\.html\?sim=yct1-sim2/.test(r.json.player), 'kid S1, Simulacro 2 (not taken): «Haz el Simulacro 2», its player\'s link, no book');
  ok(Array.isArray(r.json.sims) && r.json.sims[0].taken && r.json.sims[0].open && !r.json.sims[1].open, '… the switcher shows the one they took');
  ok((await gb(S1, 'yct1', 9)).status === 404 && (await gb(S1, 'zz9', 1)).status === 404 && (await gb(S1, 'yct1', '1x')).status === 404, 'a book that does not exist: 404');
  ok((await gb(S1, 'hsk1', 1)).status === 401, 'kid S1 (YCT 1) on an HSK 1 book: 401 (not their level)');

  section('kid S1: the book of Simulacro 1, mistakes first');
  r = await gb(S1, 'yct1', 1);
  const d1 = r.json || {};
  ok(r.status === 200 && d1.ok && d1.who === 'kid' && d1.sim && d1.sim.id === 'yct1-sim1', 'kid S1 opens Simulacro 1\'s book');
  ok(/no-store/.test(r.headers['cache-control'] || '') && /no-store/.test(r.headers['cloudflare-cdn-cache-control'] || ''), '… never cached (phone or Cloudflare)');
  ok(!CJK.test(r.text) && !/—/.test(r.text), '… no hanzi, no em dash');
  ok(!/yct1-sim2|"parts":[\s\S]*"parts"/.test(JSON.stringify(d1.sim)) && !r.text.includes(JSON.stringify(Y.sims[1].parts[0].items[0])), '… only THIS simulation\'s cards travel');
  ok(d1.sim.pics.every((p) => /^\/golden-media\/yct1sim\/1\/p\d+\?v=/.test(p.url)) && d1.sim.clips.every((c) => /^\/golden-media\/yct1sim\/1\/a\d+\?v=/.test(c)), '… its photos and clips by index (no file name)');
  const recS1 = recordOf(kS1.studentCode);
  const lastTry = recS1 && recS1.hskResults.filter((x) => x.simId === 'yct1-sim1').sort((a, b) => b.ts - a.ts)[0];
  ok(lastTry && d1.mine && JSON.stringify(d1.mine.wrong) === JSON.stringify(lastTry.wrongQs.map((w) => w.qid)) && d1.mine.wrong.length === 1 && d1.mine.wrong[0] === y1[0].q,
    'the mistakes = the latest try\'s wrongQs (' + (d1.mine && d1.mine.wrong.join(',')) + ')');
  ok(d1.mine.percent === lastTry.percent && d1.mine.passed === true && d1.mine.score === undefined, '… with that try\'s % (the route\'s figure) and «¡Aprobado!»');
  ok(lastTry.answeredCount === 35 && lastTry.questions === 35, 'the try records the questions really answered, out of how many (35 of 35)');
  ok((await gb(BL, 'yct1', 2)).json.why === 'taken' && (await gb(BL, 'yct1', 3)).json.why === 'taken', 'one answer, or made-up question ids: not a test taken, no book');
  const recBL = recordOf(kBL.studentCode);
  const bl3 = recBL && recBL.hskResults.find((x) => x.simId === 'yct1-sim3');
  ok(bl3 && bl3.answeredCount === 0 && bl3.questions === 35, '… the made-up ids count as nothing answered');
  ok(d1.examples && d1.examples.parts.length >= 7 && d1.examples.pics.every((p) => /^\/golden-media\/yct1sim\/ex\/p\d+/.test(p.url)), '«Así es el examen»: each part\'s solved example');
  ok(d1.pdf && !d1.pdf.ready && !d1.pdf.href && d1.pdf.left === 4, 'the PDF: not yet («Haz los 4 simulacros que faltan»)');

  section('files: by index, only to whoever may open that book');
  const p0 = d1.sim.pics[0].url, a0 = d1.sim.clips[0];
  r = await get(p0, as(S1));
  ok(r.status === 200 && /image\/webp/.test(r.headers['content-type'] || '') && r.bytes > 500 && /private/.test(r.headers['cache-control'] || '') && /no-store/.test(r.headers['cloudflare-cdn-cache-control'] || ''),
    'a photo of Simulacro 1 → kid S1 (private to the phone, never kept by Cloudflare)');
  r = await get(a0, Object.assign(as(S1), { headers: Object.assign({}, S1.headers, { Range: 'bytes=0-99' }) }));
  ok((r.status === 206 || r.status === 200) && /audio\/mp4/.test(r.headers['content-type'] || ''), 'its clip (Range requests for the phone\'s player: ' + r.status + ')');
  ok((await get('/golden-media/yct1sim/2/p0', as(S1))).status === 403 && (await get('/golden-media/yct1sim/2/a0', as(S1))).status === 403, 'Simulacro 2\'s photo and clip → kid S1: refused');
  ok((await get(p0, as(anon))).status === 401 && (await get(p0, as(K1))).status === 403 && (await get(p0, as(D1))).status === 403 && (await get(p0, as(BL))).status === 403,
    'Simulacro 1\'s photo → anonymous 401, key-only phone / Dorado closed / blank try 403');
  ok((await get('/golden-media/yct1sim/ex/p0', as(S1))).status === 200 && (await get('/golden-media/yct1sim/ex/p0', as(D1))).status === 403, 'the examples\' files: with any book open, else refused');
  for (const bad of ['/golden-media/yct1sim/1/..%2f..%2f..%2fserver.js', '/golden-media/yct1sim/1/p999', '/golden-media/yct1sim/1/x0', '/golden-media/yct1sim/../content/1/p0',
    '/golden-media/..%2fcontent/1/p0', '/golden-media/yct1sim/1%2f..%2f2/p0', '/golden-media/yct1sim/01/p0', '/golden-media/YCT1SIM/1/p0', '/golden-media/yct1sim/1/p0.webp']) {
    const x = await get(bad, as(S1));
    ok([400, 403, 404].includes(x.status) && !/require\(|RIFF|%PDF/.test(x.text.slice(0, 400)), 'no path trick: ' + bad + ' → ' + x.status);
  }
  ok((await get('/golden-media/yct1sim/book.pdf', as(S1))).status === 403, 'the PDF → kid S1 (4 simulations left): refused');

  // (2026-10-18, his rule: the study PDFs download only for the super admin; every visitor in scripts/test-ruta-tareas.js)
  section('kid ALL (every simulation taken): every book, the PDF stays the super admin\'s');
  r = await gb(ALL, 'yct1', 2);
  ok(r.status === 200 && r.json.mine.wrong.length === 1 && !r.json.pdf.ready && r.json.pdf.href === null, 'their book of Simulacro 2 (1 mistake), no PDF');
  ok((await get('/golden-media/yct1sim/book.pdf', as(ALL))).status === 403, '… the PDF refused even with every simulation taken');
  r = await get('/golden-media/yct1sim/book.pdf', teacher(SEED));
  ok(r.status === 200 && /application\/pdf/.test(r.headers['content-type'] || '') && r.text.slice(0, 5) === '%PDF-' && /no-store/.test(r.headers['cache-control'] || '') && /attachment/.test(r.headers['content-disposition'] || ''),
    'the super admin downloads it (private, no-store, as a file)');
  r = await gb(ALL, 'yct1', 1);
  ok(r.status === 200 && r.json.mine.wrong.length === 0, 'Simulacro 1 with zero mistakes: the celebration (wrong = [])');

  section('taken anywhere: a kid without the Dorado who took Simulacro 1 in a teacher\'s room');
  ok(!mod(await ruta(as(R1)), 'yct1').dorado.open, 'kid R: El Simulacro Dorado still closed (no practice, no «Desbloquear»)');
  const yR = webQuestions(Y, 1);
  let tr = await takeInRoom(R1, kR1.studentCode, 'yct1-sim1', [yR[1].q, yR[20].q]);
  ok(tr.status === 200 && tr.json.ok, 'kid R hands in Simulacro 1 in a teacher\'s room (2 wrong)');
  r = await gb(R1, 'yct1', 1);
  ok(r.status === 200 && r.json.who === 'kid' && r.json.dorado === false && JSON.stringify(r.json.mine.wrong) === JSON.stringify([yR[1].q, yR[20].q]),
    'its book opens, mistakes first, before the Dorado');
  ok(r.json.pdf.href === null && r.json.pdf.dorado === false && r.json.pdf.ready === false, '… no PDF: it comes with the Dorado');
  const rp = r.json.sim.pics[0].url, ra = r.json.sim.clips[0];
  ok((await get(rp, as(R1))).status === 200 && (await get(ra, as(R1))).status === 200 && (await get('/golden-media/yct1sim/ex/p0', as(R1))).status === 200,
    '… its photos, its clips and the examples load');
  r = await gb(R1, 'yct1', 2);
  ok(r.status === 403 && r.json.why === 'dorado' && !r.json.sim && r.json.sims[0].taken && !r.json.sims[1].taken, 'Simulacro 2 (not taken): «Primero, El Simulacro Dorado», nothing of it');
  ok((await get('/golden-media/yct1sim/2/p0', as(R1))).status === 403 && (await get('/golden-media/yct1sim/2/a0', as(R1))).status === 403, '… its photos and clips refused');
  ok((await get('/golden-media/yct1sim/book.pdf', as(R1))).status === 403, 'the PDF: refused');
  let mR = mod(await ruta(as(R1)), 'yct1');
  ok(!mR.dorado.open && mR.sims.length === 0 && mR.golden && mR.golden.closed && mR.golden.pdf === null &&
    JSON.stringify(mR.golden.taken.map(({ at, ...s }) => s)) === JSON.stringify([{ n: 1, mistakes: 2, book: '/audios/yct1/libro/1' }]) &&
    mR.golden.taken.every((s) => typeof s.at === 'number' && s.at > 0), 'the route: the Dorado still closed, only Simulacro 1\'s «Libro dorado» with its 2 mistakes (and when it was taken)');
  const anyTaken = (st) => (st.modules || []).some((x) => x.golden && x.golden.taken);
  ok(!anyTaken(await ruta(as(K1))) && !anyTaken(await ruta(as(anon))) && !anyTaken(await ruta(as(D1))), '… sent only to the kid who took it (not a key-only phone, a visitor or another kid)');
  for (let n = 2; n <= Y.sims.length; n++) ok((await takeInRoom(R1, kR1.studentCode, 'yct1-sim' + n, [])).status === 200, 'kid R takes Simulacro ' + n + ' in a room too');
  r = await gb(R1, 'yct1', 3);
  ok(r.status === 200 && r.json.pdf.href === null && r.json.pdf.dorado === false, 'every simulation taken, still no Dorado: every book, but no PDF');
  ok((await get('/golden-media/yct1sim/book.pdf', as(R1))).status === 403, '… the PDF refused');
  mR = mod(await ruta(as(R1)), 'yct1');
  ok(mR.golden.taken.length === Y.sims.length && mR.golden.pdf === null, '… the route lists their five books, no PDF');
  ok((await unlock(kR1.studentCode, 'yct1')).json.ok, 'a teacher opens kid R\'s Dorado');
  r = await gb(R1, 'yct1', 3);
  ok(r.status === 200 && r.json.dorado === true && r.json.pdf.href === null, 'now every book opens (the PDF stays the super admin\'s)');
  ok((await get('/golden-media/yct1sim/book.pdf', as(R1))).status === 403, '… the PDF refused');
  mR = mod(await ruta(as(R1)), 'yct1');
  ok(mR.dorado.open && mR.sims.every((s) => s.book) && mR.golden.pdf === null && !mR.golden.closed, '… the route: every simulation with its book, no PDF');

  section('old HSK: the mistakes map onto the book too');
  r = await gb(H1, 'hsk1', 1);
  ok(r.status === 200 && JSON.stringify(r.json.mine.wrong) === JSON.stringify(hWrong), 'old-HSK mistakes = the try\'s wrongQs (' + (r.json.mine && r.json.mine.wrong.join(',')) + ')');
  ok(r.json.mine.given[hWrong[0]] === (h1[0].ans === 'T' ? 'F' : 'T') || ['T', 'F'].includes(r.json.mine.given[hWrong[0]]), '… a ✓/✗ answer reads as ✓ or ✗');
  const hc = r.json.sim.clips[0];
  r = await get(hc, as(H1));
  ok(r.status === 200 && /audio\/mpeg/.test(r.headers['content-type'] || '') && r.bytes > 2000, 'its clip is the platform\'s own mp3 of the question, served by index');
  r = await gb(H2, 'hsk1', 2);
  ok(r.status === 200 && r.json.mine.passed === false && r.json.mine.percent < 60 && r.json.mine.wrong.length === 26, 'old HSK graded in points of 400: 14 of 40 right is NOT «¡Aprobado!»');

  section('the route\'s step 3');
  let m = mod(await ruta(as(S1)), 'yct1');
  ok(m.sims[0].taken && m.sims[0].mistakes === 1 && m.sims[0].book === '/audios/yct1/libro/1', 'kid S1: Simulacro 1 «Libro dorado» with its mistakes');
  ok(m.sims.slice(1).every((s) => !s.taken && s.book === null && s.mistakes === null), '… the others as today (no book)');
  ok(m.golden && m.golden.left === 4 && m.golden.pdf === null && !m.golden.login, '… 4 simulations left, no PDF');
  m = mod(await ruta(as(ALL)), 'yct1');
  ok(m.sims.every((s) => s.taken && s.book) && m.golden.left === 0 && m.golden.pdf === null, 'kid ALL: every book, no PDF (the super admin\'s only)');
  m = mod(await ruta(as(BL)), 'yct1');
  ok(m.sims[0].best === 0 && !m.sims[0].taken && m.sims[0].book === null, 'kid BL (blank try): no book');
  m = mod(await ruta(teacher(SEED)), 'yct1');
  ok(m.sims.every((s) => s.book && !s.taken) && m.golden.pdf, 'the super admin: every book and the PDF');
  const rt = await get('/api/ruta-dorada', as(S1));
  ok(!CJK.test(rt.text) && !/"ans"|"wrong"|"pics"/.test(rt.text), 'the route state carries counts only (no answer, no file)');

  section('a teacher');
  r = await gb(teacher(SEED), 'yct1', 3);
  ok(r.status === 200 && r.json.who === 'teacher' && r.json.mine === null && r.json.sims.every((s) => s.open) && r.json.pdf.href, 'every book (no mistakes of their own), the PDF');
  ok((await get('/golden-media/yct1sim/3/p0', teacher(SEED))).status === 200 && (await get('/golden-media/hsk1sim/10/a0', teacher(SEED))).status === 200 && (await get('/golden-media/newhsk1sim/book.pdf', teacher(SEED))).status === 200,
    '… every file of every book');

  section('/maestro: «Ver su libro», for teacher sessions only');
  const prof = (await get('/api/admin/students/' + kS1.studentCode, teacher(SEED))).json;
  const LY = prof.ruta.levels.find((l) => l.id === 'yct1');
  const s1 = LY.sims.find((s) => s.n === 1);
  ok(s1 && s1.mistakes === 1 && /^\/audios\/yct1\/libro\/1\?de=[A-Za-z0-9_-]+$/.test(s1.book) && LY.sims.slice(1).every((s) => s.book === null && s.mistakes === null),
    'the kid\'s profile: Simulacro 1 with 1 mistake and «Ver su libro»; the others not taken');
  ok(!s1.book.includes(kS1.studentCode), '… the link never shows the kid\'s code');
  const de = s1.book.split('?de=')[1];
  r = await gb(teacher(SEED), 'yct1', 1, de);
  ok(r.status === 200 && r.json.who === 'teacher-kid' && r.json.kid && JSON.stringify(r.json.mine.wrong) === JSON.stringify(d1.mine.wrong), 'the teacher sees that kid\'s mistakes view');
  r = await gb(teacher(SEED), 'yct1', 4, de);
  ok(r.status === 200 && r.json.who === 'teacher-kid' && r.json.mine === null && r.json.sims[3].open && !r.json.sims[3].taken, '… and any of their simulations (one they did not take: no mistakes)');
  r = await gb(ALL, 'yct1', 1, de);
  ok(r.status === 200 && r.json.who === 'kid' && JSON.stringify(r.json.mine.wrong) === '[]', 'another kid holding the link sees only THEIR own book');
  r = await gb(K1, 'yct1', 1, de);
  ok(r.status === 403 && r.json.why === 'teacher' && !r.json.sim && !r.json.player, 'a key-only phone holding the link: «Abre este enlace donde entraste a /maestro», nothing of the book');
  r = await gb(anon, 'yct1', 1, de);
  ok(r.status === 403 && r.json.why === 'teacher' && !r.json.sim, 'anonymous holding the link: the same, nothing of the book');
  // a teacher on a remembered device (the dtd cookie of a /maestro login, no code header): what the page really sends
  const TD = phone();
  ok((await post('/api/teacher-device', {}, as(TD, T(SEED)))).json.ok && TD.jar.dtd, 'a browser remembered as a teacher\'s (the /maestro login)');
  r = await gb(TD, 'yct1', 1, de);
  ok(r.status === 200 && r.json.who === 'teacher-kid' && JSON.stringify(r.json.mine.wrong) === JSON.stringify(d1.mine.wrong), '… opens «Ver su libro» with the cookie alone');
  ok((await get('/golden-media/yct1sim/3/p0', as(TD))).status === 200 && isAudiosPage(await get('/audios/yct1/libro/1?de=' + encodeURIComponent(de), as(TD))), '… its photos and its page');
  const forged = de.slice(0, -4) + (de.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA');
  r = await gb(teacher(SEED), 'yct1', 1, forged);
  ok(r.status === 403 && r.json.why === 'link' && !r.json.sim, 'a changed link: refused («Este enlace ya venció»)');
  const hde = (await get('/api/admin/students/' + kH1.studentCode, teacher(SEED))).json.ruta.levels.find((l) => l.id === 'hsk1').sims[0].book.split('?de=')[1];
  ok((await gb(teacher(SEED), 'yct1', 1, hde)).status === 403, 'a link made for another level: refused');

  section('rates: refused requests never spend a school\'s budget');
  const SCHOOL = '198.51.100.77';
  const atSchool = (ph) => ({ jar: ph.jar, headers: Object.assign({}, ph.headers, { 'CF-Connecting-IP': SCHOOL }) });
  let last = null;
  for (let i = 0; i < 305; i++) last = await get('/api/golden/yct1/1', { jar: {}, headers: { 'CF-Connecting-IP': SCHOOL } });
  ok(last.status === 429, '305 refused requests from one address: the 301st waits');
  ok((await get('/api/golden/yct1/1', atSchool(S1))).status === 200 && (await get(p0, atSchool(S1))).status === 200, '… a kid on the same Wi-Fi still opens the book and its photos');
  ok((await get('/api/golden/yct1/1', Object.assign(atSchool({ jar: {}, headers: {} }), { headers: Object.assign({ 'CF-Connecting-IP': SCHOOL }, T(SEED)) }))).status === 200, '… and so does a teacher');
  ok((await get('/golden-media/' + 'a'.repeat(300) + '/1/p0', { jar: {}, headers: { 'CF-Connecting-IP': '198.51.100.78' } })).status === 404, 'an unknown book name: 404, never read from disk');

  section('a view writes nothing on a record');
  await sleep(1300);
  const before = JSON.stringify(recordOf(kS1.studentCode));
  for (let i = 0; i < 3; i++) { await gb(S1, 'yct1', 1); await get(p0, as(S1)); await get('/golden-media/yct1sim/book.pdf', as(S1)); }
  await gb(teacher(SEED), 'yct1', 1, de);
  await sleep(1500);
  ok(JSON.stringify(recordOf(kS1.studentCode)) === before, 'the kid\'s record is the same after their views and the teacher\'s');

  section('the rule switched OFF: a key-only phone sees the sims, its book asks for a login');
  ok((await put('/api/admin/ruta-settings', { trainingLive: false }, teacher(SEED))).json.ok, 'he switches the Dorado rule OFF');
  m = mod(await ruta(as(K1)), 'yct1');
  ok(m.sims.length === Y.sims.length && m.sims.every((s) => s.book === null) && m.golden && m.golden.login, 'a key-only phone: the sims listed, no book, «entra con tu código»');
  r = await gb(K1, 'yct1', 1);
  ok(r.status === 403 && r.json.why === 'login', '… and the book itself asks for the login');
  r = await gb(D1, 'yct1', 1);
  ok(r.status === 403 && r.json.why === 'taken', 'kid D1 (the key opens their Dorado now): «Haz el Simulacro 1»');
  ok((await put('/api/admin/ruta-settings', { trainingLive: true }, teacher(SEED))).json.ok, 'back ON');

  ok(!/TypeError|ReferenceError|Unhandled/.test(allLog), 'no server error in the log');
}

(async () => {
  section('the content of every golden book');
  content();
  try { await server(); } catch (e) { failed++; console.log('  ✖ the server part crashed: ' + (e && e.stack)); }
  if (KEEP) { console.log('server left on port ' + PORT + ' (data ' + DATA + ')'); return; }
  await stopServer();
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (_) {}
  console.log(`golden book: ${passed} checks, ${failed ? failed + ' FAIL(S)' : 'all pass'}`);
  process.exit(failed ? 1 : 0);
})();
