// =========================================================================
// classrooms.js — friendly NAMES for classroom codes.
//
// 2026-06-21 (Fernando): the platform already groups students by
// `classroomCode` (the access code a kid types to join, e.g. "1001").
// This module just layers a human-readable NAME on top of each code, so
// the teacher dashboard can show "HSK1 Sábado AM" instead of "1001" and
// the teacher can send sentences to a whole named classroom.
//
// The CODE stays the identity (nothing about joining changes). Names are
// NOT secret. Stored in its own data/classrooms.json on the persistent
// disk, modelled on teachers.js — no migration of any existing data.
// =========================================================================
'use strict';
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'classrooms.json');

let classrooms = {};   // CODE (uppercased) -> { name, ts }
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

function norm(code) { return String(code || '').trim().toUpperCase(); }

// Returns the friendly name for a code, or null if unnamed.
function getName(code) {
  const c = norm(code);
  return (classrooms[c] && classrooms[c].name) || null;
}

// Set (or, with an empty name, clear) the friendly name for a code.
function setName(code, name) {
  const c = norm(code);
  if (!c) return false;
  const clean = String(name == null ? '' : name).trim().slice(0, 40);
  if (!clean) { delete classrooms[c]; scheduleSave(); return true; }
  classrooms[c] = { name: clean, ts: Date.now() };
  scheduleSave();
  return true;
}

// The whole map (code -> { name, ts }). Read-only use.
function all() { return classrooms; }

module.exports = { load, getName, setName, all };
