// ════════════════════════════════════════════════════════════════════
// 🖼 SIM IMAGE CATALOG — every describable picture from the HSK
// simulations, for the "Describe the image" teaching mode in Modo
// Maestro. Fernando 2026-06-08: "pick from a list of all the pictures
// we have so far, put it on everyone's screen, then have them together
// describe the image."
//
// DESIGN: scans the assets folder at startup (and on demand) instead of
// hardcoding 200 paths. That means Sims 6-10 just need their folders
// dropped in — no code edit, just a server restart or a re-scan.
//
// We EXCLUDE the .bmp option tiles (those are Listening-Part-4 answer
// text, not real photos) and keep only .png / .jpg / .jpeg.
// We also build a CLEAN label that strips the (TRUE)/(FALSE)/(CORRECT)/
// (A) answer-key markers so kids describing the image never see spoilers.
// ════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const SIMS_ROOT = path.join(__dirname, '..', 'public', 'assets', 'HSK SIMULATIONS');
const IMG_RE = /\.(png|jpe?g)$/i;
// Skip pure example/instruction frames? No — Fernando wants EVERYTHING
// pictured. We keep examples too; they're fine teaching material.

let _cache = null;       // { groups: [...], total, builtAt }

// Turn a raw filename into a clean, spoiler-free, teacher-friendly label.
function _cleanLabel(file) {
  let s = file.replace(IMG_RE, '');
  // Strip answer-key markers in parentheses: (TRUE) (FALSE) (CORRECT) (A)..(F) (EXAMPLE)
  s = s.replace(/\s*\((?:TRUE|FALSE|CORRECT|EXAMPLE|[A-F]|\d+)\)\s*/gi, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s || file;
}

// Convert an absolute disk path to the public URL the browser fetches,
// URL-encoding each path segment (spaces, etc.) but keeping the slashes.
function _toUrl(absPath) {
  const rel = path.relative(path.join(__dirname, '..', 'public'), absPath);
  return '/' + rel.split(path.sep).map(encodeURIComponent).join('/');
}

// Recursively collect image files under a directory.
function _collect(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (_) { return; }
  entries.forEach((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) _collect(full, out);
    else if (IMG_RE.test(e.name)) out.push(full);
  });
}

// Build the catalog. Groups by "<HSK level> / SIMULATION <n>".
// onlyLevels (optional) limits to e.g. ['HSK 1']; simRange (optional)
// limits to sims 1..5 etc. By default scans everything present.
function build(opts) {
  opts = opts || {};
  const maxSim = typeof opts.maxSim === 'number' ? opts.maxSim : Infinity;
  const groups = [];
  let total = 0;
  let levels;
  try { levels = fs.readdirSync(SIMS_ROOT, { withFileTypes: true }); }
  catch (_) { levels = []; }
  levels.filter((l) => l.isDirectory()).forEach((levelDir) => {
    const levelPath = path.join(SIMS_ROOT, levelDir.name);
    let sims;
    try { sims = fs.readdirSync(levelPath, { withFileTypes: true }); }
    catch (_) { sims = []; }
    sims.filter((s) => s.isDirectory()).forEach((simDir) => {
      // Parse the trailing number out of "SIMULATION 4"
      const m = /(\d+)\s*$/.exec(simDir.name);
      const simNum = m ? parseInt(m[1], 10) : 0;
      if (simNum > maxSim) return;   // skip not-yet-ready sims (e.g. 6)
      const simPath = path.join(levelPath, simDir.name);
      const files = [];
      _collect(simPath, files);
      if (!files.length) return;
      const images = files.sort().map((abs) => ({
        url: _toUrl(abs),
        label: _cleanLabel(path.basename(abs)),
      }));
      total += images.length;
      groups.push({
        id: (levelDir.name + '-' + simDir.name).replace(/\s+/g, '-').toLowerCase(),
        level: levelDir.name,
        sim: simDir.name,
        simNum,
        count: images.length,
        images,
      });
    });
  });
  // Sort groups by level then sim number.
  groups.sort((a, b) => (a.level.localeCompare(b.level)) || (a.simNum - b.simNum));
  return { groups, total, builtAt: Date.now() };
}

// Cached accessor — builds once, reuses. Pass {refresh:true} to rescan
// after dropping new sim folders without restarting the server.
function getCatalog(opts) {
  opts = opts || {};
  if (opts.refresh || !_cache) {
    _cache = build({ maxSim: opts.maxSim });
  }
  return _cache;
}

// Flat set of every valid image URL — used server-side to validate a
// broadcast request so a client can't push an arbitrary URL to kids.
function isValidImageUrl(url) {
  const cat = getCatalog();
  for (const g of cat.groups) {
    for (const img of g.images) {
      if (img.url === url) return true;
    }
  }
  return false;
}

module.exports = { build, getCatalog, isValidImageUrl };
