#!/usr/bin/env node
// test-cache-versions.js — the safety net of the cache headers (2026-10-20, scale): a file of public/js, public/css or
// public/assets asked for with a ?v= that a page names is kept a YEAR by phones and Cloudflare (server.js
// _staticCache), and one asked for with no query is kept by Cloudflare for a day. So a changed file must reach the
// pages under a NEW name:
//   · a changed script, style, picture or sound that a page or the audio catalog still asks for with a ?v= the live
//     site already used for it (on ANY live page) → FAIL (phones that have that version would keep the old file for a
//     year: bump its ?v=)
//   · a changed script or style that a page asks for WITHOUT ?v= → FAIL (add one: Cloudflare would serve the old file
//     for up to a day, next to the new page)
//   · a changed file of assets/png-library/ (always kept a year) → FAIL (give it a new name)
//   · a changed script or style that no page names (an `import` inside another script, a name built by code) → a
//     warning in the last line (Cloudflare may keep it up to a day: load it with ?v= if it must change at once)
//   · a changed picture or sound asked for without ?v= → fine (it shows within a day; the rules say so)
// A version made by code (`?v=' + X`) never gets the year (the server gives it only to versions written in our files),
// so it needs no check here.
// «The live site» = the base commit: origin/main (what the last deploy pushed; fetched first, best effort), else
// main, or --base <ref>. The files are compared as they are on disk now (uncommitted changes included), so it runs
// before the deploy's commit.
//   node scripts/test-cache-versions.js [--base <ref>] [--no-fetch] [--self-test]
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { refsIn, scanFiles } = require('../core/asset-refs');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : undefined; };
const pairKey = (p, v) => p + '\n' + v;

// The decision, kept apart from git so --self-test can feed it made-up files.
//   changed: ['js/x.js', 'assets/a.webp', …] (relative to public/, only files that still exist)
//   now: Map(file → text) of every file that may name ours (pages, scripts, styles, the catalog, server code)
//   livePairs: Set of pairKey(path, v) asked for anywhere on the live site
function decide(changed, now, livePairs) {
  const fails = [], warns = [], notes = [];
  const refsByFile = new Map();
  for (const [file, text] of now) refsByFile.set(file, refsIn(text));
  for (const f of changed) {
    const url = '/' + f;
    const code = /^(js|css)\//.test(f);
    if (/^assets\/png-library\//.test(f)) { fails.push(`public/${f} changed: files of assets/png-library are kept a year, give it a new name`); continue; }
    let named = false;
    for (const [file, refs] of refsByFile) {
      for (const r of refs.filter((x) => x.path === url)) {
        named = true;
        if (r.v === null) {
          if (code) fails.push(`public/${f} changed, but ${file} asks for it without ?v=: add one (Cloudflare keeps it a day)`);
          else notes.push(f);
        } else if (r.v !== '*' && livePairs.has(pairKey(url, r.v))) {
          fails.push(`public/${f} changed, but ${file} still asks for ?v=${r.v} like the live site: give it a new ?v=`);
        }
      }
    }
    if (!named && code) warns.push(`public/${f} changed and no page names it (loaded by code): Cloudflare may keep the old one up to a day`);
    if (!named && !code) notes.push(f);
  }
  return { fails: [...new Set(fails)], warns: [...new Set(warns)], notes: [...new Set(notes)] };
}

function git(argv, extra) {
  return execFileSync('git', argv, Object.assign({ cwd: ROOT, encoding: 'utf8', maxBuffer: 256 << 20, stdio: ['ignore', 'pipe', 'ignore'] }, extra || {}));
}
function refExists(ref) { try { git(['rev-parse', '--verify', '--quiet', ref + '^{commit}']); return true; } catch (_) { return false; } }

// every (path, v) the live site asks for: one `git grep` over the base commit's pages and code
function livePairsAt(base) {
  const pat = '["\'`(=]/(js|css|assets)/[^"\'`[:space:])?#<>\\\\]+\\?[^"\'`[:space:])#<>\\\\]*v=[A-Za-z0-9._-]+';
  let out = '';
  try { out = git(['grep', '-h', '-o', '-E', pat, base, '--', 'public', 'protected/pages', 'core', 'server.js']); }
  catch (e) { if (e.status !== 1) throw e; }   // 1 = no match
  const set = new Set();
  for (const r of refsIn(out)) if (r.v && r.v !== '*') set.add(pairKey(r.path, r.v));
  return set;
}

function selfTest() {
  let bad = 0, n = 0;
  const t = (cond, msg) => { n++; if (!cond) { bad++; console.log('  ✖ ' + msg); } };
  const now = new Map([
    ['public/a.html', '<script src="/js/kept.js?v=1"></script><script src="/js/bumped.js?v=2"></script><script src="/js/plain.js"></script>'
      + '<link href="/css/s.css?v=7" rel="stylesheet"><img src="/assets/pics/same.webp?v=3"><img src="/assets/pics/free.webp">'
      + '<img src="/assets/HSK%20X/p.webp?v=1">'],
    ['public/new.html', '<script src="/js/elsewhere.js?v=5"></script>'],
    ['public/js/load.js', "fetch('/assets/data.json?v=' + STAMP); import('/js/dyn.js?v=' + V); const u = `/css/t.css?v=${V}`;"],
    ['public/assets/audios/catalog.json', '{"src":"/assets/audios/e1/EXP1.1.mp3?v=aa11","clip":"/assets/audios/e1/EXP1.1-1.mp3?v=bb22"}'],
  ]);
  const live = new Set([pairKey('/js/kept.js', '1'), pairKey('/js/bumped.js', '1'), pairKey('/css/s.css', '7'), pairKey('/assets/pics/same.webp', '3'),
    pairKey('/assets/HSK X/p.webp', '1'), pairKey('/js/elsewhere.js', '5'), pairKey('/assets/audios/e1/EXP1.1.mp3', 'aa11')]);
  const run = (changed) => decide(changed, now, live);
  t(run(['js/kept.js']).fails.length === 1, 'a script changed under the same ?v= fails');
  t(run(['js/bumped.js']).fails.length === 0, 'a script with a new ?v= passes');
  t(run(['js/plain.js']).fails.length === 1, 'a script asked for without ?v= fails when it changes');
  t(run(['css/s.css']).fails.length === 1, 'a style under the same ?v= fails');
  t(run(['assets/pics/same.webp']).fails.length === 1, 'a picture under the same ?v= fails');
  t(run(['assets/pics/free.webp']).fails.length === 0 && run(['assets/pics/free.webp']).notes.length === 1, 'a picture without ?v= is only noted');
  t(run(['assets/HSK X/p.webp']).fails.length === 1, 'a path with %20 is matched decoded');
  t(run(['js/elsewhere.js']).fails.length === 1, 'a NEW page asking for a version another live page used fails (the live site as a whole)');
  t(run(['assets/audios/e1/EXP1.1.mp3']).fails.length === 1, 'the audio catalog: a re-made track under the same ?v= fails');
  t(run(['assets/audios/e1/EXP1.1-1.mp3']).fails.length === 0, '… a re-made clip with a new ?v= (the builder\'s hash) passes');
  t(run(['assets/data.json']).fails.length === 0, 'a version made by code (?v=\' + X) is not checked (it never gets the year)');
  t(run(['js/dyn.js']).fails.length === 0 && run(['css/t.css']).fails.length === 0, '… also in an import() and a template');
  t(run(['js/nobody.js']).fails.length === 0 && run(['js/nobody.js']).warns.length === 1, 'a script no page names is a warning');
  t(run(['assets/png-library/x.gif']).fails.length === 1, 'png-library always fails (kept a year whatever the ?v=)');
  t(decide(['js/kept.js'], now, new Set()).fails.length === 0, 'a version the live site never used passes');
  console.log(bad ? `test-cache-versions --self-test: ${bad} FAILED` : 'test-cache-versions --self-test: all ' + n + ' checks passed');
  process.exit(bad ? 1 : 0);
}

function main() {
  if (args.includes('--self-test')) return selfTest();
  let base = opt('base');
  let fetchNote = '';
  if (!base) {
    if (!args.includes('--no-fetch')) {
      // (never a repack or gc from a test: the laptop runs one heavy job at a time)
      // (and never a sign-in window: Git Credential Manager would open one on Windows)
      try {
        git(['-c', 'gc.auto=0', '-c', 'maintenance.auto=false', '-c', 'credential.interactive=never', 'fetch', '--quiet', '--no-auto-gc', 'origin', 'main'],
          { timeout: 20000, env: Object.assign({}, process.env, { GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' }) });
      }
      catch (_) { fetchNote = ' (origin not fetched: compared with the last known copy)'; }
    }
    base = ['origin/main', 'main'].find(refExists);
  }
  if (!base || !refExists(base)) { console.log('test-cache-versions: no base commit to compare with (origin/main, main): skipped'); return process.exit(0); }
  const changed = git(['diff', '--name-only', '-z', base, '--', 'public/js', 'public/css', 'public/assets']).split('\0').filter(Boolean)
    .filter((f) => fs.existsSync(path.join(ROOT, f)))
    .map((f) => f.replace(/^public\//, ''))
    .filter((f) => !/\.html$/.test(f));
  if (!changed.length) { console.log(`test-cache-versions: ok (no script, style or picture changed since ${base})${fetchNote}`); return process.exit(0); }
  const now = new Map();
  for (const f of scanFiles(ROOT)) { try { now.set(f, fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch (_) { /* gone */ } }
  const r = decide(changed, now, livePairsAt(base));
  r.fails.forEach((l) => console.log('  ✖ ' + l));
  r.warns.forEach((l) => console.log('  ! ' + l));
  const tail = `${changed.length} changed file(s) since ${base}` + (r.warns.length ? `, ${r.warns.length} warning(s)` : '')
    + (r.notes.length ? `, ${r.notes.length} picture(s)/sound(s) under the same name (seen within a day)` : '') + fetchNote;
  console.log(r.fails.length ? `test-cache-versions: ${r.fails.length} FAILED (${tail})` : `test-cache-versions: ok (${tail})`);
  process.exit(r.fails.length ? 1 : 0);
}
main();
