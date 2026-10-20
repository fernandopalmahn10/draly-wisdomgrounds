#!/usr/bin/env node
// unpack-backup.js — turns one backup file (draly-backup-<date>.json.gz from the weekly backup, or the .json the
// super admin's button downloads) back into a data/ folder: every JSON file, guides/*.pdf, sets/*, sim-lock.key.
// It only writes into a NEW or EMPTY folder you name (never over a live data folder); then docs/BACKUP.md says how the
// folder goes onto Render's disk, or how to open it on a throw-away local server to look at old data.
//   node scripts/unpack-backup.js <backup .json.gz or .json> <empty folder>
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const [src, dest] = process.argv.slice(2);
if (!src || !dest) { console.error('usage: node scripts/unpack-backup.js <backup .json.gz or .json> <empty folder>'); process.exit(2); }
const stop = (m) => { console.error('stopped: ' + m); process.exit(1); };

let buf;
try { buf = fs.readFileSync(src); } catch (e) { stop('cannot read ' + src + ': ' + e.message); }
if (buf[0] === 0x1f && buf[1] === 0x8b) { try { buf = zlib.gunzipSync(buf); } catch (e) { stop('the .gz file is broken: ' + e.message); } }
let b;
try { b = JSON.parse(buf.toString('utf8')); } catch (e) { stop('the backup does not read as JSON (cut or broken): ' + e.message.slice(0, 80)); }
if (!b || !b._meta || !b.files || typeof b.files !== 'object') stop('this is not a platform backup');
const format = Number(b._meta.format) || 1;
if (format >= 2 && !b._end) stop('the backup is cut (no «_end» mark): pick an older one');

const out = path.resolve(dest);
if (fs.existsSync(out) && !fs.statSync(out).isDirectory()) stop(out + ' is a file: name a new folder');
if (fs.existsSync(out) && fs.readdirSync(out).length) stop(out + ' is not empty: name a new folder (nothing is ever written over a data folder)');
const SAFE = /^[\p{L}\p{N}][\p{L}\p{N}._ ()-]{0,150}$/u;   // a plain file name (accents too): no folder, no «..»
const DEVICE = /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i;     // names Windows keeps for itself
const skipped = [];
const write = (rel, data) => {
  const parts = rel.split('/');
  if (!parts.every((p) => SAFE.test(p) && !/\.\./.test(p) && !DEVICE.test(p) && !/[. ]$/.test(p))) { skipped.push(rel + ' (odd name)'); return false; }
  const file = path.join(out, ...parts);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
  return true;
};

fs.mkdirSync(out, { recursive: true });
let nFiles = 0, nGuides = 0, nSets = 0, nKeys = 0;
for (const [name, val] of Object.entries(b.files)) {
  if (!/\.json$/.test(name)) { skipped.push(name + ' (not .json)'); continue; }
  if (val && typeof val === 'object' && val._readError) { skipped.push(name + ' (the server could not read it that day)'); continue; }
  if (write(name, JSON.stringify(val))) nFiles++;
}
let nRaw = 0;
for (const [name, b64] of Object.entries(b.raw || {})) {   // a .json that did not parse on the server: its bytes as they were
  if (!/\.json$/.test(name) || typeof b64 !== 'string') { skipped.push(name + ' (odd raw entry)'); continue; }
  if (write(name, Buffer.from(b64, 'base64'))) nRaw++;
}
// a file the server marked as cut while sending it is never written as if it were whole
const cutNames = new Set(((b._end && b._end.errors) || []).filter((e) => / \(cut\)$/.test(e)).map((e) => e.replace(/ \(cut\)$/, '')));
for (const [key, dir] of [['guides', 'guides'], ['sets', 'sets']]) {
  for (const [name, b64] of Object.entries(b[key] || {})) {
    if (typeof b64 !== 'string') { skipped.push(dir + '/' + name + ' (missing in the backup)'); continue; }
    if (cutNames.has(dir + '/' + name)) { skipped.push(dir + '/' + name + ' (cut while the server sent it)'); continue; }
    if (write(dir + '/' + name, Buffer.from(b64, 'base64'))) key === 'guides' ? nGuides++ : nSets++;
  }
}
for (const [name, text] of Object.entries(b.keys || {})) {
  if (typeof text !== 'string' || !/\.key$/.test(name)) { skipped.push(name + ' (missing in the backup)'); continue; }
  if (write(name, text)) nKeys++;
}
const recs = b.files['student-records.json'];
const arch = b.files['student-archive.json'];
console.log(`unpacked into ${out}: ${nFiles} data files${nRaw ? ` (+ ${nRaw} unreadable kept as they were)` : ''}, ${nGuides} guides, ${nSets} sets, ${nKeys} key file(s)`
  + ` · ${recs && !recs._readError ? Object.keys(recs).length : 0} kids + ${arch && !arch._readError ? Object.keys(arch).length : 0} archived`
  + ` · backup made ${b._meta.generatedAt} (format ${format})`);
if (format < 2) console.log('note: an older backup (format 1) holds only the JSON files: no guides, sets or signing key');
if (skipped.length) { console.log('not written: ' + skipped.join(', ')); process.exit(1); }
