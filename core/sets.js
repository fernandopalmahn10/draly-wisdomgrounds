const fs = require('fs');
const path = require('path');
const { parseFile } = require('./parsers');

const SETS_DIR = path.join(__dirname, '..', 'data', 'sets');

function ensureDir() {
  if (!fs.existsSync(SETS_DIR)) fs.mkdirSync(SETS_DIR, { recursive: true });
}

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
