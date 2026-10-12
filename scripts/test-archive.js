#!/usr/bin/env node
// Student archive test (2026-10-12): inactive accounts move to student-archive.json and come back when their code is
// used. Runs on MADE-UP accounts in a temp folder (STUDENT_DATA_DIR), never on data/.  node scripts/test-archive.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log('FAIL ' + msg); } };
const DAY = 86400e3, now = Date.now();
const kid = (code, extra) => Object.assign({ code, displayName: 'Kid ' + code, firstSeen: now - 60 * DAY, lastSeen: now, sentencesBuilt: [] }, extra);

// --- 1. archive + restore in one process ---
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-archive-'));
fs.writeFileSync(path.join(dir, 'student-records.json'), JSON.stringify({
  AAAA: kid('AAAA'),                                                           // active today
  BBBB: kid('BBBB', { lastSeen: now - 40 * DAY, testResults: [{ storyId: 'pinpin', score: 80 }], avatar: 'gojo' }),
  CCCC: kid('CCCC', { lastSeen: now - 31 * DAY }),                             // inactive, no work
  DDDD: kid('DDDD', { lastSeen: 0, firstSeen: now - 45 * DAY, xp: 30 }),       // never seen again since creation
  EEEE: kid('EEEE', { lastSeen: now - 50 * DAY, restoredAt: now - 2 * DAY }),  // came back from the archive 2 days ago
  FFFF: kid('FFFF', { lastSeen: now - 29 * DAY }),                             // 29 days: stays
}, null, 2));
process.env.STUDENT_DATA_DIR = dir;
const S = require('../core/student-records');
ok(S.listAll().length === 6, 'loads 6 made-up accounts');
const r1 = S.archiveInactive(30, now);
ok(r1.moved === 3 && r1.archived === 3, `archives the 3 inactive ones (moved ${r1.moved})`);
const live = JSON.parse(fs.readFileSync(path.join(dir, 'student-records.json'), 'utf8'));
const arc = JSON.parse(fs.readFileSync(path.join(dir, 'student-archive.json'), 'utf8'));
ok(Object.keys(live).sort().join() === 'AAAA,EEEE,FFFF', 'live file keeps AAAA, EEEE, FFFF: ' + Object.keys(live).sort().join());
ok(Object.keys(arc).sort().join() === 'BBBB,CCCC,DDDD', 'archive holds BBBB, CCCC, DDDD');
ok(arc.BBBB.testResults[0].score === 80, 'archived account keeps its history');
ok(!S.listAll().some((s) => s.code === 'BBBB'), 'teacher list no longer shows archived accounts');
ok(S.archiveStats().archived === 3 && S.archiveStats().bytes > 0, 'stats: 3 archived');
ok(!fs.readFileSync(path.join(dir, 'student-records.json'), 'utf8').includes('\n  '), 'live file is compact JSON');
// a new account never takes an archived code
const realRandom = Math.random;
let n = 0;
Math.random = () => (n++ < 4 ? 1.5 / 32 : realRandom());   // first 4 letters → 'BBBB'
const fresh = S.getOrCreate(null, 'Nueva');
Math.random = realRandom;
ok(fresh.code !== 'BBBB', 'a new account never reuses an archived code (' + fresh.code + ')');
// the kid types their code: everything comes back
const back = S.get('bbbb');
ok(back && back.code === 'BBBB' && back.testResults[0].score === 80, 'get() brings BBBB back with its history');
ok(back.avatar === 'dralingo' || back.avatar !== 'gojo', 'old brand avatar replaced on restore (' + back.avatar + ')');
ok(back.restoredAt >= now, 'restoredAt stamped');
ok(S.flushNow() === true, 'save after the restore (live file first, then the trimmed archive)');
const arc2 = JSON.parse(fs.readFileSync(path.join(dir, 'student-archive.json'), 'utf8'));
ok(!arc2.BBBB && arc2.CCCC && arc2.DDDD, 'archive let BBBB go and kept the others');
ok(JSON.parse(fs.readFileSync(path.join(dir, 'student-records.json'), 'utf8')).BBBB, 'live file has BBBB again');
ok(S.archiveInactive(30, now).moved === 0, 'a restored account is not archived again the next day');
const c = S.getOrCreate('CCCC', 'Kid CCCC');
ok(c.code === 'CCCC' && S.archiveStats().archived === 1, 'homework login (getOrCreate) restores CCCC instead of making a new account');
const d = S.getOrProvisionForPin('DDDD', 'Kid DDDD', '1001');
ok(d.code === 'DDDD' && d.xp === 30 && !d.isGuestPinJoin, 'PIN join restores DDDD (keeps its XP, not a new guest)');
ok(S.archiveStats().archived === 0, 'archive empty after the three came back');
ok(S.get('ZZZZ') === null, 'unknown code still unknown');

// --- 2. separate processes: a corrupt archive is never overwritten; a code in both files: the live copy wins ---
const run = (d2, code) => execFileSync(process.execPath, ['-e', code], { env: Object.assign({}, process.env, { STUDENT_DATA_DIR: d2 }), encoding: 'utf8', cwd: path.join(__dirname, '..') });
const bad = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-archive-bad-'));
fs.writeFileSync(path.join(bad, 'student-records.json'), JSON.stringify({ OLDX: kid('OLDX', { lastSeen: now - 90 * DAY }) }));
fs.writeFileSync(path.join(bad, 'student-archive.json'), '{ this is not json');
const out = run(bad, "const S=require('./core/student-records');const r=S.archiveInactive(30);console.log(JSON.stringify(r),JSON.stringify(S.archiveStats()),!!S.get('OLDX'))");
ok(/"moved":0/.test(out) && /"broken":true/.test(out) && /true\s*$/.test(out), 'corrupt archive: nothing archived, flagged broken, account still live');
ok(fs.readFileSync(path.join(bad, 'student-archive.json'), 'utf8') === '{ this is not json', 'corrupt archive file left untouched');
const both = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-archive-both-'));
fs.writeFileSync(path.join(both, 'student-records.json'), JSON.stringify({ DUPE: kid('DUPE', { xp: 99 }) }));
fs.writeFileSync(path.join(both, 'student-archive.json'), JSON.stringify({ DUPE: kid('DUPE', { xp: 1, lastSeen: now - 90 * DAY }) }));
const out2 = run(both, "const S=require('./core/student-records');console.log(S.get('DUPE').xp,S.archiveStats().archived)");
ok(/^99 0/.test(out2.trim().split('\n').pop()), 'a code in both files, same account: the live copy wins (' + out2.trim().split('\n').pop() + ')');
// same code, DIFFERENT account (handed out again while the archive was unreadable): the archived history is kept aside
const two = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-archive-two-'));
fs.writeFileSync(path.join(two, 'student-records.json'), JSON.stringify({ TWIN: kid('TWIN', { firstSeen: now - DAY, xp: 5 }) }));
fs.writeFileSync(path.join(two, 'student-archive.json'), JSON.stringify({ TWIN: kid('TWIN', { firstSeen: now - 99 * DAY, lastSeen: now - 60 * DAY, xp: 777 }) }));
run(two, "const S=require('./core/student-records');S.flushNow();");
const twoArc = JSON.parse(fs.readFileSync(path.join(two, 'student-archive.json'), 'utf8'));
const kept = Object.keys(twoArc).find((k) => k.startsWith('TWIN~'));
ok(kept && twoArc[kept].xp === 777 && !twoArc.TWIN, 'same code, different account: the archived one kept as ' + kept);
// the live file is missing but the archive is there: archived codes are still known
const noLive = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-archive-nolive-'));
fs.writeFileSync(path.join(noLive, 'student-archive.json'), JSON.stringify({ GONE: kid('GONE', { lastSeen: now - 60 * DAY, xp: 12 }) }));
const out3 = run(noLive, "const S=require('./core/student-records');console.log(S.archiveStats().archived, S.get('GONE').xp)");
ok(/^1 12/.test(out3.trim().split('\n').pop()), 'no live file: the archive still loads and restores (' + out3.trim().split('\n').pop() + ')');
// an unreadable live file is kept aside, never overwritten by the next save
const badLive = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-archive-badlive-'));
fs.writeFileSync(path.join(badLive, 'student-records.json'), '{"AAAA": {"code": "AAAA", cut off here');
run(badLive, "const S=require('./core/student-records');S.getOrCreate(null,'Nueva');S.flushNow();");
const aside = fs.readdirSync(badLive).find((f) => f.startsWith('student-records.unreadable-'));
ok(aside && fs.readFileSync(path.join(badLive, aside), 'utf8').includes('cut off here'), 'unreadable live file kept aside as ' + aside);
// the live file is written atomically (no .tmp left behind)
ok(!fs.readdirSync(badLive).some((f) => f.endsWith('.tmp')), 'no half-written temp file left');

[dir, bad, both, two, noLive, badLive].forEach((d2) => { try { fs.rmSync(d2, { recursive: true, force: true }); } catch (_) {} });
console.log(fails ? `archive: ${fails} of ${checks} checks FAILED` : `archive: all ${checks} checks passed`);
process.exit(fails ? 1 : 0);
