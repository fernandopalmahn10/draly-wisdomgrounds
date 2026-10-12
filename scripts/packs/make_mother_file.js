#!/usr/bin/env node
// "Mother file" for New HSK 1: every question of the platform's New HSK 1 simulations (core/yct/newhsk1-sim*.json)
// with what the audio says (hanzi + pinyin), the options, the word banks, the correct answer and a Spanish line —
// the same kind of document as «YCT1 · Simulaciones 1–5» and «HSK1 · Simulaciones 1–10». Prints HTML; turn it into a
// PDF with Edge (see scripts/packs/README.md).
// usage: node scripts/packs/make_mother_file.js out.html
'use strict';
const fs = require('fs');
const path = require('path');

const SIMS = fs.readdirSync(path.join(__dirname, '../../core/yct')).filter((f) => /^newhsk1-sim\d+\.json$/.test(f))
  .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10))
  .map((f) => require(path.join(__dirname, '../../core/yct', f)));

// Spanish for every sentence / phrase, keyed by the pinyin exactly as in the sim data (edit the JSON, not here)
const ES = require('../../core/packs/newhsk1-es.json');   // shared with the game rounds (core/packs/newhsk1.js)
const missing = new Set();
const es = (py) => { if (!py) return ''; if (ES[py]) return ES[py]; missing.add(py); return ''; };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const zp = (o) => `${esc(o.hanzi)}${o.pinyin ? ` <span class="py">(${esc(o.pinyin)})</span>` : ''}`;
const opts = (list) => list.map((o) => `${o.label}) ${zp(o)}`).join(' · ');
const esLine = (py) => (es(py) ? `<div class="es">ES: ${esc(es(py))}</div>` : '');
const optOf = (it) => (it.options || []).find((o) => o.label === it.answer);

const PART_TITLES = {
  listen_choose_picture_abc: ['Escucha', 'Tres imágenes A / B / C', 'Escucha la frase y elige la imagen.'],
  listen_choose_text_abc: ['Escucha', 'Tres opciones A / B / C', 'Escucha y elige la respuesta correcta.'],
  listen_match_picture_gallery: ['Escucha', 'Diálogo ↔ imagen A–F', 'Escucha cada diálogo y elige su imagen.'],
  read_match_sentence_to_picture: ['Lectura', 'Frase ↔ imagen A–F', 'Lee cada frase y elige su imagen.'],
  read_choose_reply_bank: ['Lectura', 'Pregunta ↔ respuesta (banco A–F)', 'Elige la mejor respuesta del banco.'],
  read_fill_blank_word_bank: ['Lectura', 'Completa el espacio (banco A–F)', 'Elige la palabra del banco que completa la frase.'],
  read_passage_question_abc: ['Lectura', 'Lee y responde A / B / C', 'Lee el texto y responde la pregunta.'],
};

function itemHtml(p, it) {
  const n = it.example ? 'EJ' : it.num + '.';
  const ans = (extra) => ` → <b>${it.answer}${extra ? ` (${extra})` : ''}</b>`;
  const bankOf = (bank) => { const b = (bank || []).find((x) => x.label === it.answer); return b ? zp(b) : ''; };
  switch (p.type) {
    case 'listen_choose_picture_abc':
      return `<li><b>${n}</b> Audio: ${zp(it.transcript)}${ans()}${esLine(it.transcript.pinyin)}</li>`;
    case 'listen_choose_text_abc': {
      const o = optOf(it);
      return `<li><b>${n}</b> Audio: ${zp(it.transcript)}<div class="opt">${opts(it.options)}</div>${ans(o ? zp(o) : '')}${esLine(it.transcript.pinyin)}</li>`;
    }
    case 'listen_match_picture_gallery': {
      const lines = (it.transcript.lines || []).map((l) => `${esc(l.speaker === '男' ? 'Hombre' : 'Mujer')}: ${zp(l)}`).join(' / ');
      return `<li><b>${n}</b> Audio: ${lines}${ans()}${esLine(it.transcript.pinyin)}</li>`;
    }
    case 'read_match_sentence_to_picture':
      return `<li><b>${n}</b> ${zp(it)}${ans()}${esLine(it.pinyin)}</li>`;
    case 'read_choose_reply_bank':
      return `<li><b>${n}</b> ${zp(it)}${ans(bankOf(p.bank))}${esLine(it.pinyin)}</li>`;
    case 'read_fill_blank_word_bank': {
      const body = it.dialogue ? it.dialogue.map((l) => `${l.speaker === '男' ? 'Hombre' : 'Mujer'}: ${zp(l)}`).join(' / ') : zp(it);
      const esl = it.dialogue ? it.dialogue.map((l) => es(l.pinyin)).filter(Boolean).join(' ') : es(it.pinyin);
      return `<li><b>${n}</b> ${body}${ans(bankOf(p.bank))}${esl ? `<div class="es">ES: ${esc(esl)}</div>` : ''}</li>`;
    }
    case 'read_passage_question_abc': {
      const o = optOf(it);
      return `<li><b>${n}</b> ${zp(it.passage)} — ${zp(it.question)}<div class="opt">${opts(it.options)}</div>${ans(o ? zp(o) : '')}` +
        `<div class="es">ES: ${esc([es(it.passage.pinyin), es(it.question.pinyin)].filter(Boolean).join(' — '))}</div></li>`;
    }
    default:
      return `<li><b>${n}</b> ${esc(JSON.stringify(it))}</li>`;
  }
}

let qTotal = 0;
const body = SIMS.map((s, si) => {
  let html = `<h2>Simulación ${si + 1}</h2>`;
  for (const sec of ['listening', 'reading']) {
    for (const p of s[sec].parts) {
      const t = PART_TITLES[p.type] || [sec, p.type, ''];
      const nums = p.items.filter((x) => !x.example).map((x) => x.num);
      qTotal += nums.length;
      html += `<h3>${t[0]} · Parte ${p.part} (${Math.min(...nums)}–${Math.max(...nums)}) · ${t[1]}</h3><p class="how">${t[2]}</p>`;
      if (p.bank) html += `<p class="bank">Banco: ${opts(p.bank)}</p>`;
      html += `<ol class="items">${p.items.map((it) => itemHtml(p, it)).join('')}</ol>`;
    }
  }
  return html;
}).join('');

const title = `New HSK 1 · Simulaciones 1–${SIMS.length} (${qTotal} preguntas)`;
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${title}</title><style>
@page { size: A4; margin: 16mm 15mm; }
body { font-family: 'Segoe UI', 'Noto Sans', 'Microsoft YaHei', sans-serif; font-size: 10.5pt; line-height: 1.45; color: #1c1a17; }
h1 { font-size: 20pt; margin: 0 0 2mm; color: #0f2f33; } .meta { color: #6b645a; margin: 0 0 4mm; }
h2 { font-size: 15pt; color: #9e2a2b; border-bottom: 2px solid #9e2a2b; padding-bottom: 1mm; margin: 7mm 0 2mm; page-break-after: avoid; }
h3 { font-size: 11.5pt; color: #0f2f33; margin: 4mm 0 0; page-break-after: avoid; } .how { margin: 0 0 1mm; color: #6b645a; font-style: italic; }
.bank { margin: 1mm 0; background: #f4efe4; padding: 1.5mm 2.5mm; border-radius: 2mm; }
ol.items { list-style: none; padding: 0; margin: 1mm 0; } ol.items li { margin: 1.2mm 0; page-break-inside: avoid; }
.py { color: #4b5d61; } .opt { margin-left: 6mm; color: #333; } .es { margin-left: 6mm; color: #6b645a; font-size: 9.5pt; }
b { color: #0f2f33; } .intro { background: #eef4f4; padding: 3mm 4mm; border-radius: 2mm; }
</style></head><body>
<h1>${title}</h1>
<p class="meta">12 de octubre de 2026 · Draly Wisdom Grounds</p>
<div class="intro">Todas las preguntas de las simulaciones de New HSK 1 de la plataforma (40 cada una), con la respuesta correcta en
negrita después de la flecha, tomadas de los datos de la plataforma (<code>core/yct/</code>). Cada simulación tiene 8 partes: Escucha 1–4
(preguntas 1–20) y Lectura 1–4 (preguntas 21–40). Cada pregunta de escucha incluye lo que dice el audio (caracteres y pinyin), así que el
examen completo se puede leer sin la grabación. Debajo de cada frase va su significado en español (ES). Los ejemplos (EJ) son los que el
examen muestra ya respondidos. Pinyin sin tonos, como en la plataforma.</div>
${body}
</body></html>`;

fs.writeFileSync(process.argv[2] || 'mother.html', html);
console.log(title, '·', SIMS.length, 'sims');
if (missing.size) { console.log('MISSING Spanish for', missing.size, 'line(s):'); missing.forEach((m) => console.log('  ', m)); }
