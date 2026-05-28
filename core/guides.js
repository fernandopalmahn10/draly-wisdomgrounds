// =========================================================================
// guides.js — study-guide PDF hosting on the Render persistent disk.
//
// Why the persistent disk and NOT the git repo:
//   The teacher plans to upload 76+ guides (~2-3 MB each ≈ 200+ MB). Putting
//   those in git would bloat every clone/deploy. Instead we store the PDF
//   bytes under data/guides/ (the mounted persistent disk) and keep a small
//   JSON manifest (data/guides.json) mapping id → { title, exp, filename }.
//   Files survive deploys; only a disk wipe loses them (originals live on the
//   teacher's machine, so that's recoverable).
//
// Feasibility: Render persistent disks are sized on creation (commonly 1 GB+,
// expandable, ~$0.25/GB/mo). 76 × 3 MB ≈ 228 MB fits comfortably in 1 GB with
// room to grow to a few hundred guides. No hard file-count limit.
// =========================================================================
'use strict';
const fs = require('fs');
const path = require('path');

const DATA_DIR   = path.join(__dirname, '..', 'data');
const GUIDES_DIR = path.join(DATA_DIR, 'guides');
const MANIFEST   = path.join(DATA_DIR, 'guides.json');

let guides = {};   // id -> { id, title, exp, classroomCode, filename, size, ts }

function ensureDirs() {
  for (const d of [DATA_DIR, GUIDES_DIR]) {
    if (!fs.existsSync(d)) { try { fs.mkdirSync(d, { recursive: true }); } catch (_) {} }
  }
}
function load() {
  ensureDirs();
  if (!fs.existsSync(MANIFEST)) { guides = {}; return; }
  try { guides = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) || {}; }
  catch (e) { console.warn('[guides] manifest load failed:', e.message); guides = {}; }
}
function persist() {
  ensureDirs();
  try { fs.writeFileSync(MANIFEST, JSON.stringify(guides, null, 2), 'utf8'); }
  catch (e) { console.warn('[guides] manifest save failed:', e.message); }
}
function genId() {
  let id;
  do { id = 'g' + Math.random().toString(36).slice(2, 9); } while (guides[id]);
  return id;
}

// Add a guide from raw PDF bytes (Buffer). Returns the manifest entry.
function addGuide({ title, exp, classroomCode, buffer }) {
  ensureDirs();
  const id = genId();
  const filename = id + '.pdf';
  fs.writeFileSync(path.join(GUIDES_DIR, filename), buffer);
  guides[id] = {
    id,
    title: String(title || 'Guía').slice(0, 120),
    exp: exp ? String(exp).slice(0, 8) : null,           // 'exp1'..'exp8'
    classroomCode: classroomCode ? String(classroomCode).toUpperCase().slice(0, 12) : null,
    filename,
    size: buffer.length,
    ts: Date.now(),
  };
  persist();
  return guides[id];
}
function deleteGuide(id) {
  const g = guides[id];
  if (!g) return false;
  try { fs.unlinkSync(path.join(GUIDES_DIR, g.filename)); } catch (_) {}
  delete guides[id];
  persist();
  return true;
}
function get(id) { return guides[id] || null; }
function filePath(id) {
  const g = guides[id];
  return g ? path.join(GUIDES_DIR, g.filename) : null;
}
// List manifest entries (no file bytes). Optionally filter to a classroom
// (null classroomCode guides are considered shared/global → always shown).
function list(classroomCode) {
  const cc = classroomCode ? String(classroomCode).toUpperCase() : null;
  return Object.values(guides)
    .filter((g) => !cc || !g.classroomCode || g.classroomCode === cc)
    .map((g) => ({ id: g.id, title: g.title, exp: g.exp || null, size: g.size, ts: g.ts }))
    .sort((a, b) => (a.exp || '').localeCompare(b.exp || '') || (a.ts - b.ts));
}

try { load(); } catch (e) { console.error('[guides] load crashed:', e.message); guides = {}; }

module.exports = { addGuide, deleteGuide, get, filePath, list, load };
