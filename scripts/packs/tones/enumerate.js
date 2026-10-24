// Every pinyin string a pin-game question or answer tile shows, per level, as core/packs.js builds them.
//   words: { py, es, hz }  (asked as «py», offered as an answer tile)
//   lines: phrases / sentences shown alone (an «…» in a question, or an answer tile)
//   texts: written questions mixing Spanish and pinyin (q.t, f.t, the simulacros' «Escuchas/Lees» lines)
'use strict';
const path = require('path');

function enumerate(repo) {
  const Packs = require(path.join(repo, 'core', 'packs.js'));
  const out = {};
  for (const level of Packs.LEVELS) {
    const words = new Map(), lines = new Map(), texts = new Map();
    const fills = new Map();   // a line or text with a blank → the answer that fills it (the sentence read whole)
    const addLine = (s, where, fill) => { if (s && /[a-z]/i.test(s)) { if (!lines.has(s)) lines.set(s, []); lines.get(s).push(where); if (fill) fills.set(s, fill); } };
    const addText = (s, where, fill) => { if (s) { if (!texts.has(s)) texts.set(s, []); texts.get(s).push(where); if (fill) fills.set(s, fill); } };
    for (const world of level.worlds) {
      for (const round of world.rounds) {
        const where = world.id + '/' + round.id;
        (round.words || []).forEach((x) => { const k = x.py + '|' + x.es; if (!words.has(k)) words.set(k, { py: x.py, es: x.es, hz: x.hz || '', gram: !!x.gram, where: [] }); words.get(k).where.push(where); });
        (round.items || []).forEach((it) => {
          if (it.k === 'w') addLine(it.py, where + ' w');
          else if (it.k === 'm') addLine(it.py, where + ' m');
          else if (it.k === 'r') { addLine(it.a, where + ' r.a'); addLine(it.b, where + ' r.b'); (it.w || []).forEach((x) => addLine(x, where + ' r.w')); }
          else if (it.k === 'f') { addLine(it.s, where + ' f.s', it.a); addLine(it.a, where + ' f.a'); (it.bank || []).forEach((x) => addLine(x, where + ' f.bank')); if (it.t) addText(it.t, where + ' f.t', it.a); }
          else { addText(it.t, where + ' q.t', /___/.test(it.t || '') ? it.a : null); addLine(it.a, where + ' q.a'); (it.w || []).forEach((x) => addLine(x, where + ' q.w')); }
        });
      }
    }
    out[level.id] = { words: [...words.values()], lines: [...lines.entries()].map(([s, w]) => ({ s, where: w, fill: fills.get(s) || null })),
      texts: [...texts.entries()].map(([s, w]) => ({ s, where: w, fill: fills.get(s) || null })) };
  }
  return out;
}

module.exports = { enumerate };
if (require.main === module) {
  const e = enumerate(process.argv[2]);
  for (const [lv, d] of Object.entries(e)) console.log(lv, 'words', d.words.length, 'lines', d.lines.length, 'texts', d.texts.length);
  if (process.argv[3] === 'texts') for (const [lv, d] of Object.entries(e)) d.texts.forEach((t) => console.log(lv + ' | ' + t.s));
  if (process.argv[3] === 'lines') for (const [lv, d] of Object.entries(e)) d.lines.forEach((t) => console.log(lv + ' | ' + t.s));
}
