// Print resolve.js's list to look at, readably.  node scripts/packs/tones/show.js [<check file>] [filter]
'use strict';
const c = require(require('path').resolve(process.argv[2] || require('path').join(require('os').tmpdir(), 'pack-tones-check.json')));
const f = process.argv[3] ? new RegExp(process.argv[3], 'i') : null;
c.filter((x) => !f || f.test(JSON.stringify(x))).forEach((x, i) => {
  console.log(`${i + 1}. [${x.level} ${x.kind}] «${x.s}» → «${x.toned}»  (${x.how})${x.extra ? ' ' + x.extra : ''}`);
  (x.notes || []).forEach((n) => console.log('     · ' + n));
  if (x.alt) console.log('     · sources differ: ' + x.alt.join(' | '));
});
