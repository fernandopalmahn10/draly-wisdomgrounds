#!/usr/bin/env node
// =========================================================================
// yct-import.js — turn a YCT build package into platform data
// =========================================================================
// Usage:
//   node scripts/yct-import.js <buildDir> <simNum> [--level yct1] [--offset 55.0]
//        [--start SEC] [--intros p1,p2,p3,p4] [--end SEC]
//
// <buildDir> is a folder shaped like ClaudeCode/YCT1_Sim1_Build:
//   simulation.json   every item, answer, image path, and for listening items
//                     reference_audio_video_time = [start, end] in the SOURCE
//                     screen recording (seconds)
//   images/*.jpg      the pictures
// Writes core/yct/<level>-sim<N>.json and copies the images into
// public/assets/YCT SIMULATIONS/<LEVEL>/SIMULATION <N>/images/.
//
// The listening audio is ONE continuous track cut from the recording
// (welcome + instructions + every item, exactly as in the real exam):
//   ffmpeg -ss <offset> -to <end> -i recording.mp4 -vn -ac 1 -c:a aac -b:a 96k listening.m4a
// placed at public/assets/YCT SIMULATIONS/<LEVEL>/SIMULATION <N>/listening.m4a.
// --offset is the second of the recording where that track starts; every
// item time is stored relative to it so the player can follow the audio.
// =========================================================================
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : def;
};
const buildDir = args[0];
const simNum = parseInt(args[1], 10);
const level = opt('level', 'yct1');
const offset = parseFloat(opt('offset', '55.0'));
// Track-relative seconds where each listening part's spoken instructions
// begin (first speech after the previous part's last answer pause), and
// where the closing announcement ends. Read them off an ffmpeg
// silencedetect of listening.m4a. Before the Part 1 intro = welcome.
const intros = String(opt('intros', '')).split(',').filter(Boolean).map(Number);
const endAt = parseFloat(opt('end', '0')) || null;
// Second where the "listening test starts now" line (听力考试现在开始) begins;
// before it is the welcome, which kids may skip.
const startAt = parseFloat(opt('start', '0')) || null;
if (!buildDir || !simNum) {
  console.error('usage: node scripts/yct-import.js <buildDir> <simNum> [--level yct1] [--offset 55.0]');
  process.exit(1);
}

const ROOT = path.join(__dirname, '..');
const src = JSON.parse(fs.readFileSync(path.join(buildDir, 'simulation.json'), 'utf8'));
const LEVEL_DIR = level.toUpperCase().replace(/^YCT/, 'YCT ');           // yct1 → "YCT 1"
const assetDir = path.join(ROOT, 'public', 'assets', 'YCT SIMULATIONS', LEVEL_DIR, 'SIMULATION ' + simNum);
const webBase = '/assets/' + ['YCT SIMULATIONS', LEVEL_DIR, 'SIMULATION ' + simNum].map(encodeURIComponent).join('/');
fs.mkdirSync(path.join(assetDir, 'images'), { recursive: true });

const ZH_PART = ['', '第一部分', '第二部分', '第三部分', '第四部分'];
const round2 = (n) => Math.round(n * 100) / 100;

// Copy an image if the platform copy doesn't exist yet (resized copies
// made by hand win). Returns the web URL, or null for a missing picture.
function img(rel) {
  if (!rel) return null;
  const name = path.basename(rel);
  const from = path.join(buildDir, rel);
  const to = path.join(assetDir, 'images', name);
  if (!fs.existsSync(to)) {
    if (!fs.existsSync(from)) { console.warn('  ! missing image', rel); return null; }
    fs.copyFileSync(from, to);
  }
  return webBase + '/images/' + encodeURIComponent(name);
}

function prefixFor(sectionId, part) {
  return (sectionId === 'listening' ? 'L' : 'R') + part;
}

const out = {
  id: level + '-sim' + simNum,
  title: level.toUpperCase() + ' · Simulación ' + simNum,
  level,
  scoring: {
    total: (src.scoring && src.scoring.total_points) || 200,
    pass: (src.scoring && src.scoring.pass_mark) || 120,
  },
  listening: null,
  reading: null,
};

for (const sec of src.sections) {
  const isL = sec.id === 'listening';
  const section = {
    timeLimit: sec.time_limit_seconds,
    review: sec.review_seconds || 0,
    parts: [],
  };
  if (isL) {
    section.audio = webBase + '/listening.m4a';
    if (endAt) section.endAt = endAt;
    if (startAt) section.startAt = startAt;
  }
  for (const p of sec.parts) {
    const pre = prefixFor(sec.id, p.part);
    const part = {
      part: p.part,
      type: p.type,
      zh: ZH_PART[p.part] || '',
      items: [],
    };
    if (isL && intros[p.part - 1] != null) part.introAt = intros[p.part - 1];
    if (p.shared_options) part.gallery = p.shared_options.map((o) => ({ label: o.label, image: img(o.image) }));
    if (p.word_bank) part.bank = p.word_bank.map((b) => ({ label: b.label, hanzi: b.hanzi, pinyin: b.pinyin }));
    for (const it of p.items) {
      // An example without a picture is one the recording never showed
      // (e.g. R1_EX2 米饭) — skip it rather than show a blank card.
      if (it.is_example && !it.image && !it.options && !it.hanzi && !it.dialogue) continue;
      if (it.is_example && it.unverified) continue;
      const item = {
        id: it.id,
        qid: it.is_example ? null : pre + '-' + it.number,
        num: it.number,
        example: !!it.is_example,
        answer: it.answer,
      };
      if (it.image) item.image = img(it.image);
      if (it.options) item.options = it.options.map((o) => ({ label: o.label, image: img(o.image) }));
      if (it.word) item.word = { hanzi: it.word.hanzi, pinyin: it.word.pinyin };
      if (it.hanzi) { item.hanzi = it.hanzi; item.pinyin = it.pinyin; }
      if (it.dialogue) item.dialogue = it.dialogue.map((d) => ({ speaker: d.speaker, hanzi: d.hanzi, pinyin: d.pinyin }));
      if (it.transcript) {
        item.transcript = { hanzi: it.transcript.hanzi, pinyin: it.transcript.pinyin };
        if (it.transcript.lines) item.transcript.lines = it.transcript.lines.map((l) => ({ speaker: l.speaker, hanzi: l.hanzi, pinyin: l.pinyin }));
      }
      if (it.reference_audio_video_time) {
        item.t = it.reference_audio_video_time.map((s) => round2(s - offset));
      }
      part.items.push(item);
    }
    section.parts.push(part);
  }
  out[isL ? 'listening' : 'reading'] = section;
}

const dest = path.join(ROOT, 'core', 'yct', out.id + '.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 1));
const count = (s) => s.parts.reduce((n, p) => n + p.items.filter((i) => !i.example).length, 0);
console.log('wrote', path.relative(ROOT, dest), '·', count(out.listening), 'listening +', count(out.reading), 'reading questions');
if (!fs.existsSync(path.join(assetDir, 'listening.m4a'))) console.warn('  ! listening.m4a not in', assetDir);
