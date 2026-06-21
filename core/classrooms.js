// =========================================================================
// classrooms.js — teacher-managed CLASSROOMS (named groups of students).
//
// 2026-06-21 (Fernando): a real classroom database the teacher controls.
// Create / rename / delete classrooms, then file each student into one so
// sentences can be sent to a whole class at once.
//
// IMPORTANT — why this is SEPARATE from `classroomCode`:
//   • `student.classroomCode` is the ACCESS CODE the kid logs in with. It
//     is overwritten on every login and the parent-privacy (IDOR) guard
//     depends on it. So it can NOT be repurposed for teacher grouping.
//   • This module owns a stable `id` per classroom; students carry a
//     `classroomId` the teacher sets and that login never touches.
//
// A classroom may also carry an optional `code` (an access code). Students
// who joined with that code are grouped into the classroom automatically
// (derived at read time) UNTIL the teacher manually files them elsewhere —
// so classes are populated instantly without touching the login path.
//
// Stored in its own data/classrooms.json on the persistent disk. Names are
// not secret. Modelled on teachers.js; no migration of any existing data.
// =========================================================================
'use strict';
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'classrooms.json');

let classrooms = {};   // id -> { id, name, code, ts }
let saveTimer = null;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
  }
}
function persistNow() {
  ensureDir();
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(classrooms, null, 2), 'utf8');
  } catch (e) {
    console.warn('[classrooms] failed to persist:', e.message);
  }
}
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, 800);
}

function load() {
  try {
    if (fs.existsSync(FILE_PATH)) {
      classrooms = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8')) || {};
    }
  } catch (e) {
    console.warn('[classrooms] load failed:', e.message);
    classrooms = {};
  }
}
load();

function normCode(code) { return String(code == null ? '' : code).trim().toUpperCase().slice(0, 12); }
function cleanName(name) { return String(name == null ? '' : name).trim().slice(0, 40); }

function genId() {
  for (let i = 0; i < 30; i++) {
    const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    if (!classrooms[id]) return id;
  }
  return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Create a classroom. Returns the new classroom record.
function create({ name, code } = {}) {
  const id = genId();
  classrooms[id] = { id, name: cleanName(name) || 'Aula', code: normCode(code) || null, ts: Date.now() };
  scheduleSave();
  return classrooms[id];
}

// Rename and/or re-code an existing classroom. Returns the record or null.
function update(id, { name, code } = {}) {
  const c = classrooms[id];
  if (!c) return null;
  if (name !== undefined) c.name = cleanName(name) || c.name;
  if (code !== undefined) c.code = normCode(code) || null;
  c.ts = Date.now();
  scheduleSave();
  return c;
}

function remove(id) {
  if (!classrooms[id]) return false;
  delete classrooms[id];
  scheduleSave();
  return true;
}

function get(id) { return classrooms[id] || null; }

// All classrooms as an array (newest-named first is not important; sort by name).
function list() {
  return Object.values(classrooms).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

// Find a classroom whose access code matches (for auto-grouping by login code).
function findByCode(code) {
  const cc = normCode(code);
  if (!cc) return null;
  return Object.values(classrooms).find((c) => c.code && c.code === cc) || null;
}

module.exports = { load, create, update, remove, get, list, findByCode };
