const fs = require('fs');
const path = require('path');
const { parseFile } = require('./parsers');

const SETS_DIR = path.join(__dirname, '..', 'data', 'sets');
// Seed copy lives OUTSIDE the data/ folder. On Render, data/ is a
// mounted persistent disk that SHADOWS the git-committed data/sets/
// files — so the committed sets never appear, and if the disk is ever
// wiped (service recreation) the sets vanish entirely. We keep a
// pristine copy in repo-root/seed-sets/ (NOT under data/) and restore
// it on boot whenever data/sets/ is empty. This fixes the "no sets to
// choose from" bug reported 2026-05-27.
const SEED_SETS_DIR = path.join(__dirname, '..', 'seed-sets');

function ensureDir() {
  if (!fs.existsSync(SETS_DIR)) fs.mkdirSync(SETS_DIR, { recursive: true });
}

// Restore seed sets if the live sets dir is empty (e.g. fresh persistent
// disk). Runs once at module load. Never overwrites existing files —
// only fills an empty directory, so teacher-uploaded sets stay safe.
function seedSetsIfEmpty() {
  try {
    ensureDir();
    const existing = fs.readdirSync(SETS_DIR).filter((f) => /\.(csv|xlsx|xls)$/i.test(f));
    if (existing.length > 0) return;
    if (!fs.existsSync(SEED_SETS_DIR)) return;
    const seeds = fs.readdirSync(SEED_SETS_DIR).filter((f) => /\.(csv|xlsx|xls)$/i.test(f));
    let copied = 0;
    seeds.forEach((f) => {
      try {
        fs.copyFileSync(path.join(SEED_SETS_DIR, f), path.join(SETS_DIR, f));
        copied++;
      } catch (e) { /* skip one bad file, keep going */ }
    });
    if (copied) console.log('[sets] restored', copied, 'seed sets into empty data/sets/');
  } catch (e) {
    console.warn('[sets] seed restore failed:', e.message);
  }
}
seedSetsIfEmpty();

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9-_ ]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'set';
}

function titleFromFilename(filename) {
  const base = path.parse(filename).name;
  return base.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function listSets() {
  ensureDir();
  const files = fs.readdirSync(SETS_DIR).filter((f) => /\.(csv|xlsx|xls)$/i.test(f));
  const out = [];
  for (const file of files) {
    const filePath = path.join(SETS_DIR, file);
    let count = 0;
    try {
      const qs = parseFile(filePath);
      count = qs.length;
    } catch (e) {
      // skip broken
    }
    const stat = fs.statSync(filePath);
    out.push({
      id: file,
      title: titleFromFilename(file),
      filename: file,
      questionCount: count,
      sizeKb: Math.round(stat.size / 1024),
      modifiedAt: stat.mtime.toISOString(),
      ext: path.extname(file).toLowerCase().slice(1)
    });
  }
  return out.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
}

function loadSet(id) {
  ensureDir();
  // Sanitize id — only allow filename, no traversal
  const safe = path.basename(id);
  const filePath = path.join(SETS_DIR, safe);
  if (!fs.existsSync(filePath)) return null;
  const questions = parseFile(filePath);
  return {
    id: safe,
    title: titleFromFilename(safe),
    filename: safe,
    questions
  };
}

function saveSet(originalFilename, buffer) {
  ensureDir();
  const ext = path.extname(originalFilename).toLowerCase();
  if (!['.csv', '.xlsx', '.xls'].includes(ext)) {
    throw new Error('Only .csv, .xlsx, .xls files are supported');
  }
  const baseName = slugify(path.parse(originalFilename).name);
  let filename = baseName + ext;
  let counter = 1;
  while (fs.existsSync(path.join(SETS_DIR, filename))) {
    filename = `${baseName}-${counter}${ext}`;
    counter++;
  }
  const filePath = path.join(SETS_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  // Validate: try to parse
  try {
    const qs = parseFile(filePath);
    if (!qs.length) {
      fs.unlinkSync(filePath);
      throw new Error('No valid questions found in file');
    }
    return { id: filename, title: titleFromFilename(filename), filename, questionCount: qs.length };
  } catch (e) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    throw e;
  }
}

function deleteSet(id) {
  const safe = path.basename(id);
  const filePath = path.join(SETS_DIR, safe);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

function renameSet(id, newTitle) {
  const safe = path.basename(id);
  const filePath = path.join(SETS_DIR, safe);
  if (!fs.existsSync(filePath)) return null;
  const ext = path.extname(safe);
  const newFilename = slugify(newTitle) + ext;
  if (newFilename === safe) return { id: safe };
  const newPath = path.join(SETS_DIR, newFilename);
  if (fs.existsSync(newPath)) throw new Error('A set with that name already exists');
  fs.renameSync(filePath, newPath);
  return { id: newFilename, title: titleFromFilename(newFilename), filename: newFilename };
}

module.exports = { listSets, loadSet, saveSet, deleteSet, renameSet };
