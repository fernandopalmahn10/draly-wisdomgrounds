// =========================================================================
// teacher-presets.js — server-side preset storage for warm-up sentences.
// Previously presets lived in the host laptop's localStorage, which meant
// "save preset" was tied to a specific device. Moving them server-side
// means teachers can save on laptop A and load on laptop B — same admin
// password gets the same library of saved sentences.
//
// Storage: a single JSON file at data/teacher-presets.json.
// =========================================================================
'use strict';
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'teacher-presets.json');

let presets = [];          // array of { id, name, sentence: [wordIds], createdAt, updatedAt }
let saveTimer = null;
let nextId = 1;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { /* ignore */ }
  }
}

function load() {
  ensureDir();
  if (!fs.existsSync(FILE_PATH)) {
    presets = [];
    return;
  }
  try {
    const raw = fs.readFileSync(FILE_PATH, 'utf8');
    presets = JSON.parse(raw) || [];
    // Recompute nextId from the loaded set so saves don't collide
    nextId = presets.reduce((m, p) => Math.max(m, (parseInt(p.id, 10) || 0)), 0) + 1;
    console.log('[presets] loaded', presets.length, 'teacher presets');
  } catch (e) {
    console.warn('[presets] failed to load:', e.message);
    presets = [];
  }
}

function persistNow() {
  ensureDir();
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(presets, null, 2), 'utf8');
  } catch (e) {
    console.warn('[presets] failed to persist:', e.message);
  }
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, 500);
}

function list() {
  return presets.slice();   // shallow copy for safety
}

function save(name, sentence) {
  const cleanName = String(name || '').trim().slice(0, 60);
  if (!cleanName) throw new Error('Preset name required');
  if (!Array.isArray(sentence) || !sentence.length) throw new Error('Sentence empty');
  // Cap sentence length to prevent abuse
  const cleanSentence = sentence.slice(0, 40).map(String);
  const id = String(nextId++);
  const now = Date.now();
  const preset = { id, name: cleanName, sentence: cleanSentence, createdAt: now, updatedAt: now };
  presets.push(preset);
  // Cap total presets to 200 — newest at the end, oldest fall off
  if (presets.length > 200) presets = presets.slice(-200);
  scheduleSave();
  return preset;
}

function remove(id) {
  const idx = presets.findIndex((p) => String(p.id) === String(id));
  if (idx < 0) return false;
  presets.splice(idx, 1);
  scheduleSave();
  return true;
}

load();

module.exports = { list, save, remove };
