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
// =========================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'content', 'audios');
const CACHE = path.join(SRC, '.cache');
const OUT = path.join(ROOT, 'public', 'assets', 'audios');
const FFDIR = 'C:/Users/ferpa/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/';
const FFMPEG = process.env.FFMPEG || (fs.existsSync(FFDIR + 'ffmpeg.exe') ? FFDIR + 'ffmpeg.exe' : 'ffmpeg');
const TTS_BASE = process.env.TTS_BASE || 'https://draly-wisdomgrounds-2.onrender.com';
const VOICE = { word: 'cmn-CN-Wavenet-A', profe: 'cmn-CN-Wavenet-A', tu: 'cmn-CN-Wavenet-D' };
const SR = 24000;                 // mono s16le working format
const BPS = SR * 2;
const NAME_GAP = 1.4;             // seconds left for the kid's name (zh given as a list)
const LEVELS = { hsk1: 'HSK 1', hsk2: 'HSK 2', hsk3: 'HSK 3', yct1: 'YCT 1', yct2: 'YCT 2', newhsk1: 'New HSK 1', newhsk2: 'New HSK 2' };
const LEVEL_ORDER = ['hsk1', 'hsk2', 'hsk3', 'yct1', 'yct2', 'newhsk1', 'newhsk2'];

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

async function build(id) {
  const src = JSON.parse(fs.readFileSync(path.join(SRC, id + '.json'), 'utf8'));
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
    id, level: src.level, levelName: LEVELS[src.level] || src.level.toUpperCase(), exp: src.exp, round: src.round,
    title: src.title, tagline: src.tagline, cover, tracks,
  };
}

(async () => {
  const want = process.argv.slice(2);
  const ids = want.length ? want : fs.readdirSync(SRC).filter((f) => /^[a-z0-9-]+\.json$/.test(f)).map((f) => f.replace(/\.json$/, ''));
  const catFile = path.join(OUT, 'catalog.json');
  const cat = fs.existsSync(catFile) ? JSON.parse(fs.readFileSync(catFile, 'utf8')) : { homeworks: [] };
  const byId = new Map(cat.homeworks.map((h) => [h.id, h]));
  for (const id of ids) {
    console.log(id);
    byId.set(id, await build(id));
  }
  // Drop entries whose script was deleted.
  for (const id of [...byId.keys()]) if (!fs.existsSync(path.join(SRC, id + '.json'))) byId.delete(id);
  const homeworks = [...byId.values()].sort((a, b) =>
    (LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level)) || (a.exp - b.exp) || (a.round - b.round));
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(catFile, JSON.stringify({ updated: new Date().toISOString(), homeworks }, null, 1));
  console.log('catalog:', homeworks.length, 'homeworks →', path.relative(ROOT, catFile));
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
