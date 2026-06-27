// =========================================================================
// dump-reading-cheatsheet.js  (Fernando, 2026-06-21)
// Printable, kid-friendly answer sheet for the LAST reading parts
// (oraciones 31-40 = Lectura 3 + 4) of Sims 1-9 → 90 sentences.
// LEFT  = sentence in PINYIN only, answer in RED pinyin.
// RIGHT = Spanish translation.
// Output: repo-root hsk-respuestas-lectura.html  → open & "Descargar PDF".
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
function bankPinyin(part, letter) {
  const b = (part.bank || []).find((x) => x.letter === letter);
  return b ? b.pinyin : '?';
}

// Spanish translations (oraciones 31-40 de cada simulación). For Lectura 3
// the format is "pregunta → respuesta"; for Lectura 4 the full sentence with
// the answer word in parentheses.
const ES = {
  1: {
    31: '¿Qué tal esta ropa? → (es muy pequeña)',
    32: '¿Quién compró esas manzanas? → (mi mamá)',
    33: '¿Qué día vuelves a casa? → (el sábado)',
    34: '¿Dónde vive tu hija? → (en la escuela)',
    35: '¿Su hijo ya trabaja? → (no)',
    36: 'Esa persona es mi (alumno).',
    37: 'Sobre la mesa hay una (taza) de té.',
    38: 'Adiós, nos vemos (mañana) en la escuela.',
    39: 'Niño, ¿(cuántos) años tienes?',
    40: 'Gracias, ya (sé) escribir este carácter.',
  },
  2: {
    31: '¿Qué quieres comer al mediodía? → (arroz)',
    32: '¿Dónde trabaja el Sr. Li? → (en la librería)',
    33: '¿A qué hora es la película? → (8:40 de la mañana)',
    34: '¿Qué le pasa a la Srta. Xie? → (extraña su casa)',
    35: '¿Quién sabe leer este carácter? → (yo)',
    36: 'Este año tiene 27 (años), es maestro.',
    37: 'Ayer a esta hora yo estaba (en) el avión.',
    38: 'Ya son las 22h, quiero ir a (dormir).',
    39: 'Gracias por (invitarme) a comer. — De nada.',
    40: 'Esta mesa es muy (pequeña). ¿Y esta?',
  },
  3: {
    31: '¿Dónde vive tu hija? → (en la escuela)',
    32: '¿Qué tiempo hizo ayer? → (mucho calor)',
    33: '¿Cuántos años tiene tu hijo? → (8 años)',
    34: '¿Cómo irás mañana al restaurante? → (en taxi)',
    35: '¿Qué quieres comer al mediodía? → (arroz)',
    36: 'Le (encanta) leer; leyó decenas de libros en un año.',
    37: '¿Puedes sentarte allá? Aquí (hay) alguien.',
    38: 'El maestro Wang quiere ir al hospital a ver a su (alumno).',
    39: '¡Tu comida está muy buena! ¡Gracias! → (de nada)',
    40: '¿El Sr. Li sabe (hablar) chino? — Un poco.',
  },
  4: {
    31: '¿De quién es ese perrito? → (de mi amigo)',
    32: '¿Dónde trabaja tu hijo? → (en China)',
    33: '¿Cuántos días te quedas aquí? → (un mes)',
    34: '¿Qué tal su chino? → (muy bueno)',
    35: '¿Hay tiendas detrás de la escuela? → (sí, bastantes)',
    36: 'Hoy hace mucho (frío).',
    37: 'A mi mamá le gusta comer (comida) china.',
    38: 'Hay (demasiado) pocas tazas; somos nueve personas.',
    39: 'Está lloviendo, ¿cómo vuelves? — (manejé) el auto.',
    40: 'Mañana en la mañana, ¿qué tal si vamos a ver una (película)?',
  },
  5: {
    31: '¿Dónde estudia él ahora? → (en la Universidad de Pekín)',
    32: '¿Viste a la Srta. Zhang? → (no)',
    33: '¿Cuándo se conocieron? → (el mes pasado)',
    34: '¿Quién de ustedes sabe manejar? → (yo)',
    35: '¿Qué tiempo hará mañana? → (lloverá al mediodía)',
    36: 'Ahora (muchas) personas vienen a China a aprender chino.',
    37: '(Perdón), ¿qué dijiste? No te oí.',
    38: 'Adiós, nos vemos (mañana) en la escuela.',
    39: 'Cuando vuelvas, (compra) algo de fruta.',
    40: '¿Dónde estás? Estoy en la (tienda); vuelvo en 10 min.',
  },
  6: {
    31: '¿Tu hija está en casa? → (se fue a la escuela)',
    32: '¿Qué tiempo hará mañana? → (hará mucho calor)',
    33: '¿Qué comida les gusta comer? → (comida china)',
    34: '¿Qué te pasa? → (tengo sueño)',
    35: '¿Quién dice que tu chino es muy bueno? → (mi maestro)',
    36: 'Él me (llamó por teléfono) para decir que no viene.',
    37: 'A los maestros les gusta mucho este (alumno).',
    38: 'Ya (sé) cocinar.',
    39: 'Esta silla es muy (bonita). La compró mi papá.',
    40: '¿Cuándo abrió esta tienda? — El 7 de (marzo / mes 3).',
  },
  7: {
    31: '¿Qué día es hoy? → (lunes)',
    32: 'Gracias por invitarme a comer → (de nada)',
    33: '¿Qué estudias en Pekín? → (estudio chino)',
    34: '¿Vino solo a China? → (sí, vino solo)',
    35: '¿Dónde está tu auto? → (detrás del restaurante)',
    36: 'Ella compró (un poco) de arroz.',
    37: 'No conoce al (alumno) sentado delante de él.',
    38: '¿De qué (año) es esta película?',
    39: '¿Cómo no conoces este carácter? (Ayer) no vine.',
    40: '¿(Está) el Sr. Qian? — Se fue al hospital.',
  },
  8: {
    31: '¿Cuánto cuestan estas cosas? → (20 yuanes)',
    32: '¿Dónde trabaja tu papá? → (en la Universidad de Pekín)',
    33: '¿Qué le pasa a Xiao Yue? → (tiene sueño)',
    34: '¿Qué tiempo hará mañana? → (hará mucho frío)',
    35: '¿Quién cocina hoy? → (mamá)',
    36: 'Oí que la doctora Wang es muy (bonita).',
    37: 'A los compañeros les gusta (comer) fruta.',
    38: 'La próxima semana quiere ir a comprar una (computadora).',
    39: '¿(Cuándo) van a la tienda?',
    40: 'Srta. Qian, su llamada. — Bien, (gracias).',
  },
  9: {
    31: '¿Quién es esa persona de adelante? → (mi compañero)',
    32: '¿Fuiste a la escuela ayer en la mañana? → (no)',
    33: '¿Esta película dura 60 minutos? → (no)',
    34: '¿Cuántos años tiene tu hijo? → (10 años)',
    35: '¿Qué día regresas a tu país? → (mañana)',
    36: 'Su ropa es (demasiado) pequeña.',
    37: 'Ayer compré un (libro) de chino.',
    38: 'Viví 5 años en Pekín; me (gusta) mucho este lugar.',
    39: 'Mamá (puede) volver este mes.',
    40: 'Hola, ¿en qué (trabajas)?',
  },
};

let total = 0;
let simsHtml = '';
for (let n = 1; n <= 9; n++) {
  const sim = SIMULATIONS['hsk1-sim' + n];
  if (!sim || !sim.reading || !sim.reading.part3 || !sim.reading.part4) continue;
  const es = ES[n] || {};
  let rows = '';

  // Lectura 3 (31-35): pinyin de la pregunta + respuesta (pinyin) en rojo.
  sim.reading.part3.questions.forEach((q) => {
    const ans = bankPinyin(sim.reading.part3, q.answer);
    total++;
    rows +=
      '<div class="line">' +
        '<span class="qn">' + q.num + '</span>' +
        '<div class="py">' + esc(q.pinyin) + ' <span class="ans">（' + esc(ans) + '）</span></div>' +
        '<div class="es">' + esc(es[q.num] || '') + '</div>' +
      '</div>';
  });

  // Lectura 4 (36-40): pinyin con el ( ) relleno por la respuesta (pinyin) en rojo.
  sim.reading.part4.questions.forEach((q) => {
    const ans = bankPinyin(sim.reading.part4, q.answer);
    total++;
    const filled = esc(q.pinyin).replace(/\(\s*\)|（\s*）/, '（<span class="ans">' + esc(ans) + '</span>）');
    rows +=
      '<div class="line">' +
        '<span class="qn">' + q.num + '</span>' +
        '<div class="py">' + filled + '</div>' +
        '<div class="es">' + esc(es[q.num] || '') + '</div>' +
      '</div>';
  });

  simsHtml += '<section class="sim"><h2>📘 Simulación ' + n + '</h2>' + rows + '</section>';
}

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dralingo HSK1 · Respuestas Lectura 31-40</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&display=swap" rel="stylesheet">
<style>
  :root { --red:#e23b3b; --ink:#1b2333; --jade:#1f7a63; }
  * { box-sizing:border-box; }
  body { font-family:'Nunito',system-ui,sans-serif; color:var(--ink);
         background:#fff7e6; margin:0; padding:24px; }
  .hero { text-align:center; margin:0 auto 22px; max-width:980px; }
  .hero h1 { font-size:30px; font-weight:900; margin:0 0 4px; color:var(--jade); }
  .hero p  { font-size:15px; margin:4px 0; opacity:.85; }
  .hero .key { display:inline-block; margin-top:8px; background:#fff; border:2px dashed var(--red);
               border-radius:12px; padding:6px 14px; font-weight:800; }
  .hero .key b { color:var(--red); }
  .sim { max-width:980px; margin:0 auto 20px; background:#fff; border-radius:18px;
         box-shadow:0 4px 16px rgba(0,0,0,.08); overflow:hidden; break-inside:avoid; }
  .sim h2 { margin:0; background:linear-gradient(90deg,#f4c84a,#f0a93a); color:#1b2333;
            font-size:22px; font-weight:900; padding:12px 20px; }
  .line { display:flex; gap:14px; align-items:flex-start; padding:11px 20px;
          border-bottom:1px solid #f0e7d2; }
  .line:last-child { border-bottom:none; }
  .qn { flex:0 0 auto; min-width:32px; height:32px; border-radius:50%;
        background:var(--jade); color:#fff; font-weight:900; font-size:15px;
        display:flex; align-items:center; justify-content:center; margin-top:2px; }
  .py { flex:1 1 54%; font-size:20px; font-weight:700; line-height:1.4; }
  .es { flex:1 1 46%; font-size:15px; color:#3a4253; line-height:1.4;
        border-left:2px solid #efe6cf; padding-left:14px; }
  .ans { color:var(--red); font-weight:900; }
  /* Floating download button — hidden in the actual PDF. */
  .dl-btn { position:fixed; top:16px; right:16px; z-index:50;
            background:var(--red); color:#fff; border:none; border-radius:999px;
            font-family:'Nunito',sans-serif; font-weight:900; font-size:17px;
            padding:13px 22px; box-shadow:0 6px 18px rgba(226,59,59,.45); cursor:pointer; }
  .dl-btn:active { transform:scale(.96); }
  @media print {
    body { background:#fff; padding:0; }
    .sim { box-shadow:none; border:1px solid #e5d9bd; }
    .hero p.note, .dl-btn { display:none !important; }
  }
</style>
</head>
<body>
  <button class="dl-btn" onclick="window.print()">⬇️ Descargar PDF</button>
  <div class="hero">
    <h1>🐉 Dralingo · HSK1 — Hoja de respuestas</h1>
    <p><strong>Lectura 3 y 4 · Oraciones 31 a 40</strong> · pinyin a la izquierda, español a la derecha</p>
    <div class="key">La respuesta correcta va en <b>rojo</b>, entre paréntesis （ <b>así</b> ）</div>
    <p class="note">${total} oraciones · Simulaciones 1–9 (la Simulación 10 aún no existe).
       Para imprimir: Ctrl/Cmd + P.</p>
  </div>
  ${simsHtml}
</body>
</html>`;

const out = path.join(__dirname, '..', 'hsk-respuestas-lectura.html');
fs.writeFileSync(out, html, 'utf8');
console.log('Wrote ' + out + ' — ' + total + ' sentences (pinyin + Spanish).');
