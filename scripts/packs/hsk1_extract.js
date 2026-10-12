// usage: node scripts/packs/hsk1_extract.js out.json   (reads seed-sets/)
// Pull the word list (pinyin without tones + Spanish meaning) out of the 9 old HSK 1 sets. Prints what it could not parse.
const P = require('../../core/parsers');
const fs = require('fs');
const SETS = ['my-family-hsk-1.csv', 'hsk1-school-vocabulary.csv', 'hsk1-market-pinyin-spanish.xlsx', 'hsk1-exp4-tiempo-clima.xlsx',
  'hsk1-exp5-viajes-direcciones.xlsx', 'hsk1-exp6-casa-actividades.xlsx', 'hsk1-exp7-personas-preguntas.xlsx',
  'hsk1-exp8-numeros-particulas.xlsx', 'pinyin-basicos.xlsx'];
const NUM = { 0: 'cero', 1: 'uno', 2: 'dos', 3: 'tres', 4: 'cuatro', 5: 'cinco', 6: 'seis', 7: 'siete', 8: 'ocho', 9: 'nueve', 10: 'diez' };
const untone = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ü/g, 'u');
const out = {};
const skipped = [];
for (const f of SETS) {
  const qs = P.parseFile(require('path').join(__dirname, '../../seed-sets', f));
  out[f] = [];
  for (const q of qs) {
    let py = null;
    let hz = null;
    let m = q.text.match(/^¿Qué (?:significa|número es)\s+([\u3400-\u9fff…（）]+)\s*\(([^)]+)\)\??/);
    if (m) { hz = m[1]; py = m[2]; }
    if (!m) { m = q.text.match(/^¿Qué significa\s+['"‘“]([^'"’”]+)['"’”]/); if (m) py = m[1]; }
    if (!py) { skipped.push(f + ' :: ' + q.text + ' → ' + q.correct); continue; }
    let es = q.correct;
    if (/^\d+$/.test(es)) es = NUM[es] || es;
    const note = (q.text.match(/\((masculino|femenino)\)/) || [])[1];
    if (note) es = note === 'masculino' ? 'él' : 'ella';
    out[f].push({ py: untone(py).replace(/\s+/g, '').toLowerCase(), es, hz });
  }
}
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
for (const [f, ws] of Object.entries(out)) console.log(f, ws.length, '·', ws.map((w) => w.py + '=' + w.es).join(', '));
console.log('\nSKIPPED', skipped.length);
skipped.forEach((s) => console.log('  ', s));
