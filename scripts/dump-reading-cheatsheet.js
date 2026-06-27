// =========================================================================
// dump-reading-cheatsheet.js  (Fernando, 2026-06-21)
// Builds a printable, kid-friendly answer sheet for the LAST READING PARTS
// (oraciones 31-40 = Lectura 3 + Lectura 4) of every simulation that has
// them (Sims 1-9 → 90 sentences; Sim 10 doesn't exist yet).
// Each line shows the sentence with its ANSWER in RED inside parentheses.
// Output: public/hsk-respuestas-lectura.html  → open & print (Ctrl/Cmd+P).
//
// Run:  node scripts/dump-reading-cheatsheet.js
// =========================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const { SIMULATIONS } = require('../core/hsk-sim.js');

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function bankWord(part, letter) {
  const b = (part.bank || []).find((x) => x.letter === letter);
  return b ? { hanzi: b.hanzi, pinyin: b.pinyin } : { hanzi: '?', pinyin: '' };
}

let total = 0;
let simsHtml = '';
for (let n = 1; n <= 9; n++) {
  const sim = SIMULATIONS['hsk1-sim' + n];
  if (!sim || !sim.reading || !sim.reading.part3 || !sim.reading.part4) continue;
  const p3 = sim.reading.part3;
  const p4 = sim.reading.part4;
  let rows = '';

  // Lectura 3 (31-35): pregunta → respuesta del banco, en rojo entre paréntesis.
  p3.questions.forEach((q) => {
    const a = bankWord(p3, q.answer);
    total++;
    rows +=
      '<div class="line">' +
        '<span class="qn">' + q.num + '</span>' +
        '<div class="body">' +
          '<div class="zh">' + esc(q.hanzi) + ' <span class="ans">（<b>' + esc(a.hanzi) + '</b>）</span></div>' +
          '<div class="py">' + esc(q.pinyin) + ' <span class="ans">（' + esc(a.pinyin) + '）</span></div>' +
        '</div>' +
      '</div>';
  });

  // Lectura 4 (36-40): rellena el ( ) con la palabra correcta, en rojo.
  p4.questions.forEach((q) => {
    const a = bankWord(p4, q.answer);
    total++;
    const filled = esc(q.hanzi).replace(/（\s*）|\(\s*\)/, '（<b>' + esc(a.hanzi) + '</b>）');
    rows +=
      '<div class="line">' +
        '<span class="qn">' + q.num + '</span>' +
        '<div class="body">' +
          '<div class="zh">' + filled + '</div>' +
          '<div class="py">' + esc(q.pinyin) + ' <span class="ans">→ （' + esc(a.hanzi) + ' ' + esc(a.pinyin) + '）</span></div>' +
        '</div>' +
      '</div>';
  });

  simsHtml +=
    '<section class="sim">' +
      '<h2>📘 Simulación ' + n + '</h2>' +
      rows +
    '</section>';
}

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>HSK1 · Respuestas Lectura 3 y 4 (oraciones 31–40)</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&family=ZCOOL+XiaoWei&display=swap" rel="stylesheet">
<style>
  :root { --red:#e23b3b; --ink:#1b2333; --jade:#1f7a63; }
  * { box-sizing:border-box; }
  body { font-family:'Nunito',system-ui,sans-serif; color:var(--ink);
         background:#fff7e6; margin:0; padding:24px; }
  .hero { text-align:center; margin:0 auto 22px; max-width:900px; }
  .hero h1 { font-size:30px; font-weight:900; margin:0 0 4px; color:var(--jade); }
  .hero p  { font-size:15px; margin:4px 0; opacity:.8; }
  .hero .key { display:inline-block; margin-top:8px; background:#fff; border:2px dashed var(--red);
               border-radius:12px; padding:6px 14px; font-weight:800; }
  .hero .key b { color:var(--red); }
  .sim { max-width:900px; margin:0 auto 20px; background:#fff; border-radius:18px;
         box-shadow:0 4px 16px rgba(0,0,0,.08); overflow:hidden; break-inside:avoid; }
  .sim h2 { margin:0; background:linear-gradient(90deg,#f4c84a,#f0a93a); color:#1b2333;
            font-size:22px; font-weight:900; padding:12px 20px; }
  .line { display:flex; gap:14px; align-items:flex-start; padding:12px 20px;
          border-bottom:1px solid #f0e7d2; }
  .line:last-child { border-bottom:none; }
  .qn { flex:0 0 auto; min-width:34px; height:34px; border-radius:50%;
        background:var(--jade); color:#fff; font-weight:900; font-size:16px;
        display:flex; align-items:center; justify-content:center; }
  .body { flex:1 1 auto; }
  .zh { font-family:'ZCOOL XiaoWei','Nunito',serif; font-size:27px; line-height:1.35; }
  .py { font-size:15px; color:#6b7280; margin-top:2px; }
  .ans, .ans b, .zh b { color:var(--red); font-weight:900; }
  @media print {
    body { background:#fff; padding:0; }
    .sim { box-shadow:none; border:1px solid #e5d9bd; }
    .hero p.note { display:none; }
  }
</style>
</head>
<body>
  <div class="hero">
    <h1>🐉 Dralingo · HSK1 — Hoja de respuestas</h1>
    <p><strong>Lectura 3 y 4 · Oraciones 31 a 40</strong> de cada simulación</p>
    <div class="key">La respuesta correcta va en <b>rojo</b>, entre paréntesis （ <b>así</b> ）</div>
    <p class="note">${total} oraciones · Simulaciones 1–9 (la Simulación 10 aún no existe).
       Para imprimir: Ctrl/Cmd + P.</p>
  </div>
  ${simsHtml}
</body>
</html>`;

const out = path.join(__dirname, '..', 'public', 'hsk-respuestas-lectura.html');
fs.writeFileSync(out, html, 'utf8');
console.log('Wrote ' + out + ' — ' + total + ' sentences across 9 sims.');
