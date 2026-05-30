// =====================================================================
// 🎯 CUSTOM ASSIGNMENTS — teacher-authored, multi-bank, per-student
// Teachers craft a Spanish sentence + expected pinyin, target specific kids
// (by stable student code), and send. Recipients see them in their own
// "🎯 Tareas especiales" section above the HSK1 folders.
// =====================================================================
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'custom-assignments.json');

let store = { items: {} };
function load() {
  try { store = JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch (_) { store = { items: {} }; }
  if (!store.items) store.items = {};
}
let saveT = null;
function scheduleSave() {
  if (saveT) return;
  saveT = setTimeout(() => {
    saveT = null;
    try {
      const dir = path.dirname(FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(FILE, JSON.stringify(store, null, 2));
    } catch (e) { console.warn('[custom-asg] save failed:', e.message); }
  }, 250);
}
load();

function _id() { return 'ca_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7); }

function _norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

function create({ teacherId, title, instructions, items, targetStudents, pointsPerItem }) {
  const cleanItems = (Array.isArray(items) ? items : [])
    .slice(0, 24)
    .map((it) => ({ es: String(it.es || '').slice(0, 200), expected: String(it.expected || '').slice(0, 200) }))
    .filter((it) => it.es && it.expected);
  if (!cleanItems.length) return null;
  const targets = (Array.isArray(targetStudents) ? targetStudents : [])
    .slice(0, 200)
    .map((c) => String(c || '').toUpperCase())
    .filter(Boolean);
  if (!targets.length) return null;
  const id = _id();
  const rec = {
    id,
    teacherId: teacherId || null,
    createdAt: Date.now(),
    title: String(title || 'Tarea especial').slice(0, 120),
    instructions: String(instructions || '').slice(0, 400),
    items: cleanItems,
    targetStudents: targets,
    pointsPerItem: Math.max(1, Math.min(50, Number(pointsPerItem) || 10)),
    status: 'active',
  };
  store.items[id] = rec;
  scheduleSave();
  return rec;
}

function listForTeacher(teacherId) {
  return Object.values(store.items)
    .filter((a) => a.status === 'active' && (!teacherId || a.teacherId === teacherId || a.teacherId === null))
    .sort((a, b) => b.createdAt - a.createdAt);
}
function listAll() {
  return Object.values(store.items)
    .filter((a) => a.status === 'active')
    .sort((a, b) => b.createdAt - a.createdAt);
}
function listForStudent(code) {
  const c = String(code || '').toUpperCase();
  return Object.values(store.items)
    .filter((a) => a.status === 'active' && a.targetStudents.indexOf(c) >= 0)
    .sort((a, b) => b.createdAt - a.createdAt);
}
function get(id) { return store.items[id] || null; }

function remove(id, teacherId, isSuper) {
  const a = store.items[id];
  if (!a) return false;
  // Super admin can delete anyone's; otherwise only the author can.
  if (!isSuper && teacherId && a.teacherId && a.teacherId !== teacherId) return false;
  delete store.items[id];
  scheduleSave();
  return true;
}

// Grades a custom assignment the same way HSK1 assignments are graded —
// per-item exact pinyin match (case + accent insensitive). Returns a
// breakdown shape compatible with Students.logAssignmentSubmission.
function grade(rec, answers) {
  if (!rec) return null;
  if (!Array.isArray(answers)) answers = [];
  let score = 0;
  const breakdown = rec.items.map((item, i) => {
    const studentRaw = String(answers[i] || '');
    const correct = _norm(studentRaw).length > 0 && _norm(studentRaw) === _norm(item.expected);
    if (correct) score += rec.pointsPerItem;
    return { i, es: item.es, expected: item.expected, student: studentRaw, correct, pointsEarned: correct ? rec.pointsPerItem : 0 };
  });
  const total = rec.items.length * rec.pointsPerItem;
  return { score, total, breakdown };
}

module.exports = { create, listForTeacher, listAll, listForStudent, get, remove, grade };
