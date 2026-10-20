// asset-refs.js — which of our files the platform's pages and code ask for, and with which ?v= (2026-10-20, scale).
// One reader for two jobs:
//   · server.js `_staticCache` gives a year (immutable) ONLY to a version a page really asks for today
//     (knownVersions): a guessed future ?v= (they are dates) never gets the old file stored for a year
//     at Cloudflare or in a phone (review 2026-10-20);
//   · scripts/test-cache-versions.js fails a deploy whose changed file kept the live site's ?v=.
'use strict';
const fs = require('fs');
const path = require('path');

// A reference to one of our files: "/js/x.js?v=3", '/assets/a b.webp', url(/assets/s.webp), `/css/y.css?v=${V}` (a
// version made by code). Only right after a quote, «(» or «=»: a comment that mentions public/js/x.js loads nothing.
const REF_RE = /(?<=["'`(=])\/(?:js|css|assets)\/[^"'`\s)?#<>\\]+(?:\?[^"'`\s)#<>\\]*)?/g;
// → [{ path: '/js/x.js' (decoded), v: null (none) | '*' (made by code) | 'the literal version' }]
function refsIn(text) {
  const out = [];
  let m;
  REF_RE.lastIndex = 0;
  while ((m = REF_RE.exec(text))) {
    const raw = m[0];
    const q = raw.indexOf('?');
    let p = q < 0 ? raw : raw.slice(0, q);
    const query = q < 0 ? '' : raw.slice(q + 1).replace(/&amp;/g, '&');
    if (/\$\{|['"`+]$/.test(p)) continue;                         // a path built by code: unknown
    try { p = decodeURI(p); } catch (_) { /* keep it */ }
    const vm = /(?:^|&)v=([^&]*)/.exec(query);
    let v = null;
    if (vm) v = /^[A-Za-z0-9._-]{1,64}$/.test(vm[1]) ? vm[1] : '*';
    out.push({ path: p, v });
  }
  return out;
}

// The files that can name ours (relative to the repo root, '/' separators): pages, scripts, styles, the audio catalog,
// the locked pages, the server's own code.
function scanFiles(root) {
  const out = [];
  const walk = (dir, rel, test) => {
    let list = [];
    try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const e of list) {
      const p = path.join(dir, e.name), r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) { if (!/^(node_modules|\.git)$/.test(e.name)) walk(p, r, test); }
      else if (test(e.name)) out.push(r);
    }
  };
  walk(path.join(root, 'public'), 'public', (n) => /\.(html|js|css|json|webmanifest)$/.test(n));
  walk(path.join(root, 'protected', 'pages'), 'protected/pages', (n) => /\.html$/.test(n));
  walk(path.join(root, 'core'), 'core', (n) => /\.js$/.test(n));
  if (fs.existsSync(path.join(root, 'server.js'))) out.push('server.js');
  return out;
}

// path → Set of the literal versions asked for today (a version made by code is not in it: such a request keeps the
// old short header, never a year).
function knownVersions(root) {
  const map = new Map();
  for (const f of scanFiles(root)) {
    let text = '';
    try { text = fs.readFileSync(path.join(root, f), 'utf8'); } catch (_) { continue; }
    for (const r of refsIn(text)) {
      if (!r.v || r.v === '*') continue;
      if (!map.has(r.path)) map.set(r.path, new Set());
      map.get(r.path).add(r.v);
    }
  }
  return map;
}

module.exports = { refsIn, scanFiles, knownVersions, REF_RE };
