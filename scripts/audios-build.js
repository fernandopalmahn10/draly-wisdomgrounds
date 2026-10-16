#!/usr/bin/env node
// =========================================================================
// audios-build.js — homework audio gateway (/audios) builder
// =========================================================================
// Usage:  node scripts/audios-build.js [id ...]      (no id = every script)
//
// Reads content/audios/<id>.json (one per homework PDF: three tracks —
// words, dialogue, video lines — each item with the PDF's pinyin + Spanish
// and the hanzi the voice reads), and writes, per homework:
//   public/assets/audios/<id>/<CODE>.mp3     the full practice track
//   public/assets/audios/<id>/<CODE>-<n>.mp3 each line on its own (tap to hear)
// plus public/assets/audios/catalog.json, the only file the page reads
// (pinyin + Spanish + timings, never hanzi: kid UI rule).
//
// Voices come from the platform's own Google TTS endpoint (/api/tts, live
// by default, 20 new clips/min limit → paced). Raw clips are cached in
// content/audios/.cache/ so a rebuild only synthesizes changed lines.
// Track shapes (the PDFs say "escucha y repite", "cada toma tres veces"):
//   words    each word twice, then a pause to repeat it
//   dialogue the whole conversation once, then line by line with pauses
//   video    each line with a pause to repeat, then all lines in one go
//            (the video is ONE take: the model to imitate)
//
// A script with "kind": "base" is a level's vocabulary base (2026-10-14:
// content/audios/yct1-base.json, written by ../study/yct1/export_web.py from
// the same source as the printed book). It gets one clip per word (wNN.mp3)
// and one per example sentence (sNN.mp3, shared when two cards use the same
// sentence), plus base.json, the data its page reads (no hanzi). The catalog
// lists it under `bases`, and `levels` (the /audios folders) comes from
// core/levels.js. 🔑 Since 2026-10-15 a base is behind its level's key: it is
// written to protected/base/<id>/ (never public/) and its page reads it as
// /base-media/<id>/… (server.js checks every file); the La Base PDF lives in
// protected/study/ (a fresh copy that ../study/lib/web.py drops in
// public/assets/study/ is moved there) and is served as /base-media/<id>/book.pdf.
//
//   --cache <dir>   use another clip cache (e.g. the main checkout's, from a worktree)
// =========================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const Levels = require('../core/levels');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'content', 'audios');
const argCache = process.argv.indexOf('--cache');
const CACHE = argCache > 0 ? path.resolve(process.argv[argCache + 1]) : path.join(SRC, '.cache');
const OUT = path.join(ROOT, 'public', 'assets', 'audios');
const BASE_OUT = path.join(ROOT, 'protected', 'base');     // 🔑 the bases: behind their level's key (2026-10-15)
const STUDY = path.join(ROOT, 'protected', 'study');       // … and their PDFs
const FFDIR = 'C:/Users/ferpa/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/';
const FFMPEG = process.env.FFMPEG || (fs.existsSync(FFDIR + 'ffmpeg.exe') ? FFDIR + 'ffmpeg.exe' : 'ffmpeg');
const TTS_BASE = process.env.TTS_BASE || 'https://draly-wisdomgrounds-2.onrender.com';
const VOICE = { word: 'cmn-CN-Wavenet-A', profe: 'cmn-CN-Wavenet-A', tu: 'cmn-CN-Wavenet-D' };
const SR = 24000;                 // mono s16le working format
const BPS = SR * 2;
const NAME_GAP = 1.4;             // seconds left for the kid's name (zh given as a list)
// /audios folders: one per level, in core/levels.js order, named as kids see them («YCT 1», «New HSK 1», «HSK 1»).
// A script's `level` is the curriculum id (yct1 · newhsk1 · hsk1) = the level's `pack`.
const FOLDERS = Levels.LEVELS.map((l) => ({ id: l.pack, name: l.name }));
// a level's stored id that differs from its folder id (hsk2 → newhsk1): old /audios/hsk2-… links open the right page
const ALIASES = Object.fromEntries(Levels.LEVELS.filter((l) => l.id !== l.pack).map((l) => [l.id, l.pack]));
const folderOf = (lv) => ALIASES[String(lv).toLowerCase()] || lv;
const levelName = (lv) => {
  const f = FOLDERS.find((x) => x.id === folderOf(lv));
  if (f) return f.name;
  const id = Levels.normalize(lv);                        // never print a raw id such as «HSK2» to families
  return id ? Levels.info(id).name : String(lv).toUpperCase();
};
const levelRank = (lv) => { const i = FOLDERS.findIndex((f) => f.id === folderOf(lv)); return i < 0 ? 99 : i; };
// ?v=<content hash> on clips and pictures: Cloudflare keeps /assets/* for 2 h, a rebuilt clip (a fixed reading) under
// the same name must still reach phones at once
const stamp = (file) => crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 8);

fs.mkdirSync(CACHE, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const r2 = (n) => Math.round(n * 100) / 100;

// ── PCM helpers ─────────────────────────────────────────────────────────
function decode(file) {
  return execFileSync(FFMPEG, ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 's16le', '-'], { maxBuffer: 1 << 28 });
}
function silence(sec) { return Buffer.alloc(Math.round(sec * SR) * 2); }
function dur(pcm) { return pcm.length / BPS; }
// Trim the synthesizer's own leading/trailing silence (keep 60 ms of air).
function trim(pcm) {
  const n = pcm.length / 2;
  const loud = (i) => Math.abs(pcm.readInt16LE(i * 2)) > 400;
  let a = 0, b = n - 1;
  while (a < n && !loud(a)) a++;
  while (b > a && !loud(b)) b--;
  const pad = Math.round(0.06 * SR);
  return pcm.subarray(Math.max(0, a - pad) * 2, Math.min(n, b + pad) * 2);
}
function encode(pcm, file) {
  execFileSync(FFMPEG, ['-v', 'error', '-y', '-f', 's16le', '-ar', String(SR), '-ac', '1', '-i', '-',
    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', String(SR), '-c:a', 'libmp3lame', '-b:a', '64k', file], { input: pcm, maxBuffer: 1 << 28 });
}

// ── Voice: cached Google TTS through the platform ───────────────────────
let lastFresh = 0;
async function tts(text, voice) {
  const key = crypto.createHash('sha1').update(voice + '|' + text).digest('hex').slice(0, 16);
  const file = path.join(CACHE, key + '.mp3');
  if (fs.existsSync(file) && fs.statSync(file).size > 500) return file;
  for (let attempt = 0; attempt < 6; attempt++) {
    const wait = lastFresh + 3200 - Date.now();       // ≤ 20 new clips per minute
    if (wait > 0) await sleep(wait);
    lastFresh = Date.now();
    const url = TTS_BASE + '/api/tts?voice=' + encodeURIComponent(voice) + '&text=' + encodeURIComponent(text);
    const res = await fetch(url);
    if (res.status === 429) { console.log('   (voice limit, waiting 60 s)'); await sleep(60000); continue; }
    if (!res.ok) throw new Error('tts ' + res.status + ' for ' + text);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 500) throw new Error('tts returned ' + buf.length + ' bytes for ' + text);
    fs.writeFileSync(file, buf);
    return file;
  }
  throw new Error('tts kept refusing: ' + text);
}

// One item's audio: its hanzi (a list = a gap between parts for the kid's name).
async function itemPcm(item, voice) {
  const parts = Array.isArray(item.zh) ? item.zh : [item.zh];
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i]) out.push(trim(decode(await tts(parts[i], voice))));
    if (i < parts.length - 1) out.push(silence(NAME_GAP));
  }
  return Buffer.concat(out);
}

// ── Track shapes ────────────────────────────────────────────────────────
function shape(kind, clips) {
  const bufs = [], segs = [], parts = [];
  let t = 0;
  const add = (pcm, i) => { if (i != null) segs.push([i, r2(t), r2(t + dur(pcm))]); bufs.push(pcm); t += dur(pcm); };
  const gap = (s) => add(silence(s));
  gap(0.4);
  if (kind === 'words') {
    parts.push({ at: 0, label: 'Escucha y repite' });
    clips.forEach((c, i) => { add(c, i); gap(0.8); add(c, i); gap(Math.max(1.8, dur(c) * 1.4 + 0.8)); });
  } else if (kind === 'dialogue') {
    parts.push({ at: 0, label: 'Escucha la conversación' });
    clips.forEach((c, i) => { add(c, i); gap(0.7); });
    gap(1.2);
    parts.push({ at: r2(t), label: 'Ahora repite cada frase' });
    clips.forEach((c, i) => { add(c, i); gap(dur(c) * 1.25 + 1.2); });
  } else {
    parts.push({ at: 0, label: 'Repite cada frase' });
    clips.forEach((c, i) => { add(c, i); gap(dur(c) * 1.4 + 1.5); });
    gap(0.6);
    parts.push({ at: r2(t), label: 'Ahora todo seguido, como tu video' });
    clips.forEach((c, i) => { add(c, i); gap(0.6); });
  }
  return { pcm: Buffer.concat(bufs), segs, parts };
}

// ── A level's vocabulary base (kind "base"): one clip per word and per sentence ──
const pad2 = (n) => String(n).padStart(2, '0');
async function buildBase(id, src) {
  const dir = path.join(BASE_OUT, id);
  fs.mkdirSync(dir, { recursive: true });
  const web = '/base-media/' + id + '/';
  const clip = async (zh, name) => {                       // short clip: a breath of air before and after
    encode(Buffer.concat([silence(0.12), await itemPcm({ zh }, VOICE.word), silence(0.22)]), path.join(dir, name));
    return web + name + '?v=' + stamp(path.join(dir, name));
  };
  const pic = (name) => {
    const f = path.join(dir, 'pics', name);
    return web + 'pics/' + name + (fs.existsSync(f) ? '?v=' + stamp(f) : '');
  };
  const said = new Map();                                  // zh → clip already made (repeated sentences)
  const sentence = async (zh, name) => {
    if (!said.has(zh)) said.set(zh, await clip(zh, name));
    return said.get(zh);
  };
  const words = [];
  process.stdout.write('  ');
  for (const w of src.words) {
    const au = await clip(w.zh, 'w' + pad2(w.n) + '.mp3');
    const exau = await sentence(w.exzh, 's' + pad2(w.n) + '.mp3');
    // only what the page shows (never the voice's hanzi, nor any field added to the source later)
    words.push({ n: w.n, world: w.world, py: w.py, es: w.es, hint: w.hint, ex: w.ex, exes: w.exes, pic: pic(w.pic), au, exau });
    process.stdout.write(w.n % 10 ? '.' : String(w.n));
  }
  const toneNote = [];
  for (let i = 0; i < (src.toneNote || []).length; i++) {
    const t = src.toneNote[i];
    toneNote.push({ py: t.py, au: await sentence(t.zh, 'n' + (i + 1) + '.mp3') });
  }
  // Dralingo's bubbles on the cover and the closing card («Nǐ hǎo!», «Zàijiàn!»), when the source has them
  const cover = {};
  for (const k of ['hello', 'bye']) {
    const c = src.cover && src.cover[k];
    if (c && c.zh) cover[k] = { py: c.py, au: await sentence(c.zh, 'c-' + k + '.mp3') };
  }
  console.log(' ' + words.length + ' words, ' + said.size + ' sentences');
  // clips nobody uses any more (a sentence changed) leave the folder
  const keep = new Set(words.flatMap((w) => [w.au, w.exau]).concat(toneNote.map((t) => t.au), Object.values(cover).map((c) => c.au))
    .map((u) => path.basename(u.split('?')[0])));
  fs.readdirSync(dir).filter((f) => f.endsWith('.mp3') && !keep.has(f)).forEach((f) => fs.unlinkSync(path.join(dir, f)));
  // the page's data, field by field: whatever else the source carries (the voice's hanzi) stays out of public/.
  // The book: src.book.pdf names it (/assets/study/<level>-vocabulario.pdf, what web.py writes); its copy lives in
  // protected/study/ (a fresh one web.py left in public/ moves there: nothing of La Base stays public).
  let book = null;
  if (src.book) {
    const name = path.basename(src.book.pdf.split('?')[0]);
    const pdfFile = path.join(STUDY, name);
    const fresh = path.join(ROOT, 'public', 'assets', 'study', name);
    if (fs.existsSync(fresh)) {
      fs.mkdirSync(STUDY, { recursive: true });
      fs.copyFileSync(fresh, pdfFile);
      fs.unlinkSync(fresh);
      console.log('  (the new ' + name + ' moved to protected/study/)');
    }
    book = { pdf: web + 'book.pdf' + (fs.existsSync(pdfFile) ? '?v=' + stamp(pdfFile) : ''), pages: src.book.pages, mb: src.book.mb, name: src.book.name };
  }
  const data = {
    id, kind: 'base', level: src.level, levelName: levelName(src.level), title: src.title, kicker: src.kicker, lede: src.lede,
    book: book || null, steps: src.steps || [], parents: src.parents || [],
    tones: (src.tones || []).map((t) => ({ mark: t.mark, name: t.name, how: t.how, py: t.py, es: t.es, word: t.word, points: t.points })),
    // the line under the tones as the book prints it ({braces} = pinyin) + a clip per example that has one
    toneNoteText: src.toneNoteText || '', toneNote, cover,
    worlds: (src.worlds || []).map((w) => ({ n: w.n, name: w.name, short: w.short, first: w.first, count: w.count, pics: w.pics })),
    words, updated: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(dir, 'base.json'), JSON.stringify(data));
  // three pictures that peek out of the level's folder: the first of the 3rd, 4th and 6th world openers (for YCT 1 the
  // dog, the noodles, the school: clear on their own)
  const picOf = (n) => (words.find((w) => w.n === n) || {}).pic;
  const peek = [2, 3, 5].map((i) => src.worlds && src.worlds[i] && picOf(src.worlds[i].pics[0])).filter(Boolean);
  return {
    id, kind: 'base', level: src.level, levelName: levelName(src.level), title: src.title, kicker: src.kicker,
    words: words.length, worlds: (src.worlds || []).map((w) => ({ n: w.n, first: w.first, count: w.count })), data: web + 'base.json',
    peek, book: book || null,
  };
}

async function build(id) {
  const src = JSON.parse(fs.readFileSync(path.join(SRC, id + '.json'), 'utf8'));
  if (src.kind === 'base') return buildBase(id, src);
  const dir = path.join(OUT, id);
  fs.mkdirSync(dir, { recursive: true });
  const web = '/assets/audios/' + id + '/';
  const tracks = [];
  for (const tr of src.tracks) {
    process.stdout.write('  ' + tr.code + ' ');
    const clips = [];
    const items = [];
    for (let n = 0; n < tr.items.length; n++) {
      const it = tr.items[n];
      const voice = tr.kind === 'words' ? VOICE.word : (it.who === 'profe' ? VOICE.profe : VOICE.tu);
      const pcm = await itemPcm(it, voice);
      clips.push(pcm);
      const clipName = tr.code + '-' + (n + 1) + '.mp3';
      encode(Buffer.concat([silence(0.15), pcm, silence(0.25)]), path.join(dir, clipName));
      const row = { py: it.py, es: it.es, clip: web + clipName };
      if (it.who) row.who = it.who;
      items.push(row);
      process.stdout.write('.');
    }
    const s = shape(tr.kind, clips);
    encode(s.pcm, path.join(dir, tr.code + '.mp3'));
    tracks.push({ code: tr.code, kind: tr.kind, src: web + tr.code + '.mp3', dur: r2(dur(s.pcm)), parts: s.parts, segs: s.segs, items });
    console.log(' ' + r2(dur(s.pcm)) + ' s');
  }
  const cover = fs.existsSync(path.join(dir, 'cover.jpg')) ? web + 'cover.jpg' : null;
  return {
    id, level: src.level, levelName: levelName(src.level), exp: src.exp, round: src.round,
    title: src.title, tagline: src.tagline, cover, tracks,
  };
}

(async () => {
  const args = process.argv.slice(2);
  const want = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--cache');
  const ids = want.length ? want : fs.readdirSync(SRC).filter((f) => /^[a-z0-9-]+\.json$/.test(f)).map((f) => f.replace(/\.json$/, ''));
  const catFile = path.join(OUT, 'catalog.json');
  const cat = fs.existsSync(catFile) ? JSON.parse(fs.readFileSync(catFile, 'utf8')) : { homeworks: [] };
  const byId = new Map((cat.homeworks || []).concat(cat.bases || []).map((h) => [h.id, h]));
  for (const id of ids) {
    console.log(id);
    byId.set(id, await build(id));
  }
  // Drop entries whose script was deleted.
  for (const id of [...byId.keys()]) if (!fs.existsSync(path.join(SRC, id + '.json'))) byId.delete(id);
  const all = [...byId.values()];
  all.forEach((h) => {
    h.levelName = levelName(h.level);   // names always as core/levels.js says them
    // a small copy of the cover for the folder and the list (the 1200 px cover is ~100 KB; this one ~10 KB)
    const cover = path.join(OUT, h.id, 'cover.jpg');
    const small = path.join(OUT, h.id, 'cover-s.webp');
    if (h.kind !== 'base' && fs.existsSync(cover)) {
      if (!fs.existsSync(small) || fs.statSync(small).mtimeMs < fs.statSync(cover).mtimeMs) {
        execFileSync(FFMPEG, ['-v', 'error', '-y', '-i', cover, '-vf', 'scale=360:-2', '-c:v', 'libwebp', '-quality', '78', small]);
      }
      h.thumb = '/assets/audios/' + h.id + '/cover-s.webp';
    }
  });
  const homeworks = all.filter((h) => h.kind !== 'base').sort((a, b) =>
    (levelRank(a.level) - levelRank(b.level)) || (a.exp - b.exp) || (a.round - b.round));
  const bases = all.filter((h) => h.kind === 'base').sort((a, b) => levelRank(a.level) - levelRank(b.level));
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(catFile, JSON.stringify({ updated: new Date().toISOString(), levels: FOLDERS, aliases: ALIASES, bases, homeworks }, null, 1));
  console.log('catalog:', FOLDERS.length, 'folders,', bases.length, 'bases,', homeworks.length, 'homeworks →', path.relative(ROOT, catFile));
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
