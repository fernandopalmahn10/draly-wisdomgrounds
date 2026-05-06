const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Headers we accept (case-insensitive). The first valid one wins.
const HEADERS = {
  question: ['question', 'q', 'prompt'],
  correct: ['correct', 'answer', 'right', 'correct_answer'],
  wrong1: ['wrong1', 'wrong_1', 'option2', 'b'],
  wrong2: ['wrong2', 'wrong_2', 'option3', 'c'],
  wrong3: ['wrong3', 'wrong_3', 'option4', 'd'],
  image: ['image', 'img', 'picture', 'photo', 'image_url']
};

function pickHeader(headerRow, candidates) {
  const lower = headerRow.map((h) => String(h || '').trim().toLowerCase());
  for (const c of candidates) {
    const idx = lower.indexOf(c);
    if (idx >= 0) return idx;
  }
  return -1;
}

function rowsToQuestions(rows) {
  if (!rows || rows.length < 2) return [];
  const header = rows[0];
  const idxQ = pickHeader(header, HEADERS.question);
  const idxC = pickHeader(header, HEADERS.correct);
  if (idxQ < 0 || idxC < 0) {
    // Maybe no header row — assume positional: question, correct, wrong1, wrong2, wrong3, image
    return rows
      .map((r) => ({
        text: String(r[0] || '').trim(),
        correct: String(r[1] || '').trim(),
        answers: [r[1], r[2], r[3], r[4]].map((a) => String(a || '').trim()).filter(Boolean),
        image: String(r[5] || '').trim() || null
      }))
      .filter((q) => q.text && q.correct && q.answers.length >= 2);
  }
  const idxW1 = pickHeader(header, HEADERS.wrong1);
  const idxW2 = pickHeader(header, HEADERS.wrong2);
  const idxW3 = pickHeader(header, HEADERS.wrong3);
  const idxImg = pickHeader(header, HEADERS.image);

  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r.length) continue;
    const text = String(r[idxQ] || '').trim();
    const correct = String(r[idxC] || '').trim();
    const wrongs = [idxW1, idxW2, idxW3]
      .filter((idx) => idx >= 0)
      .map((idx) => String(r[idx] || '').trim())
      .filter(Boolean);
    if (!text || !correct || wrongs.length < 1) continue;
    const image = idxImg >= 0 ? String(r[idxImg] || '').trim() : '';
    out.push({
      text,
      correct,
      answers: [correct, ...wrongs].slice(0, 4),
      image: image || null
    });
  }
  return out;
}

function parseCSVText(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  const rows = lines.map(parseCSVLine);
  return rowsToQuestions(rows);
}

function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

function parseExcelBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  return rowsToQuestions(rows);
}

function parseFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.xlsx' || ext === '.xls') {
    const buffer = fs.readFileSync(filePath);
    return parseExcelBuffer(buffer);
  }
  const text = fs.readFileSync(filePath, 'utf8');
  return parseCSVText(text);
}

module.exports = { parseCSVText, parseExcelBuffer, parseFile };
