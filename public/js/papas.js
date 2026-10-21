// papas.js — «Mi Dralingo» part 2 · Papás, the parents' view of /homework (his approved design 2026-10-18:
// .claude/handoff/kidhome-design/Papas.dc.html; his words about the old one: "very poor… not easy to read… easy to get
// lost in"). One clear page, top to bottom:
//   the banner (the family garden, Latifa, «Volver»: homework.js #hw-parents-back) →
//   «Lo más importante esta semana» (ONE action, Aileen, one button) →
//   four big numbers (palabras que ya sabe · experiencias completas · tareas mandadas · simulacro en clase) →
//   La Ruta Dorada in small scenes (done / current / later, the trophy at the end, «Va en la Experiencia N…») →
//   «Cómo ayudar en casa (5 minutos)» (Profe Fer, 3 tips for this week's experience) →
//   rows that open the rest in a sheet with «Volver» / ✕ / Esc (nothing of the old Papás is lost).
// What it says comes from js/papas-plan.js (the same file the server runs); the numbers from /api/homework/insights
// `ruta` (only for the logged-in kid's own record). This phone's marks not saved yet are added first, with the same
// rules as the kid's home (homework.js renderBaseEntry / renderTareasEntry), so Papás and the home never disagree.
// No code is ever shown here (his rule 2026-10-18), no hanzi (the words list shows pinyin + Spanish + 🔊).
// homework.js calls DralyPapas.render(data, hooks) and DralyPapas.close().
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const A = '/assets/';
  const CHEV = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const WA = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.2a9.7 9.7 0 0 0-8.4 14.6L2.3 21.7l5-1.3A9.7 9.7 0 1 0 12 2.2zm0 17.7a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 19.9zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8.9c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.7-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.2-.2-.4-.3z"/></svg>';
  const SPEAK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>';

  // ── one small scene per experience (ASSETS.md: New HSK 1's from the approved design; YCT 1's 6 and HSK 1's 8 picked
  //    from the same art: the family garden, the museum school, the night market, the lantern river for weather…) ──
  const SC = {
    jardin: 'escape/jardin/bg-s.webp', museo: 'escape/museo/bg-s.webp', mercado: 'escape/mercado/bg-s.webp',
    fuente: 'escape/fuente/bg-s.webp', muralla: 'escape/muralla/bg-s.webp', pista: 'escape/pista/bg-s.webp',
    shanghai: 'scenes/shanghai-s.webp', templo: 'scenes/templo-s.webp', luna: 'scenes/luna-s.webp', rio: 'scenes/rio-s.webp',
    // (2026-10-18, made for the home on Higgsfield: Dubai's beach sports park for Deportes y Salud, an enchanted lantern
    // garden for Palabras Mágicas II, a magic mirror in a Dubai palace courtyard for El Espejo Mágico, a giant abacus in a
    // Chinese garden for Números)
    deportes: 'scenes/deportes-s.webp', magia: 'scenes/magia-s.webp', espejo: 'scenes/espejo-s.webp', numeros: 'scenes/numeros-s.webp',
  };
  // (review 2026-10-18: no trapdoor arena any more, templo / luna: their giant black pit read as a sinkhole)
  const SCENES = {
    newhsk1: ['jardin', 'museo', 'mercado', 'fuente', 'shanghai', 'deportes', 'muralla', 'magia'],
    yct1: ['jardin', 'espejo', 'rio', 'mercado', 'numeros', 'museo'],      // familia · espejo mágico · mascotas · comida · números y tiempo · escuela
    hsk1: ['jardin', 'museo', 'mercado', 'rio', 'pista', 'fuente', 'shanghai', 'numeros'],   // … tiempo y clima · viajes · casa · personas · números
  };
  const ROTA = ['jardin', 'museo', 'mercado', 'fuente', 'shanghai', 'muralla', 'rio', 'pista'];
  const sceneOf = (slug, n) => A + SC[(SCENES[slug] || [])[n - 1] || ROTA[(n - 1) % ROTA.length]];

  let D = null;        // the insights payload
  let H = {};          // homework.js hooks
  let P = null;        // the plan (js/papas-plan.js) after this phone's marks
  let R = null;        // the ruta numbers after this phone's marks
  let opener = null;   // what opened the sheet (focus goes back there)

  const lang = () => (window.HW_LANG === 'en' ? 'en-GB' : 'es-ES');
  const day = (ts, year) => { try { return new Date(ts).toLocaleDateString(lang(), year ? { day: '2-digit', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' }); } catch (_) { return ''; } };
  const realName = (n) => { const s = String(n || '').trim(); return s && s !== 'Anon' && !/^Dragoncito \d{3}$/.test(s) ? s : ''; };

  // ── this phone's marks not saved yet join the account's numbers (the kid's home does the same) ──────────────
  function withPhone(r) {
    const out = Object.assign({}, r);
    const okN = (x) => Number.isInteger(x) && x >= 1 && x <= (Number(r.words) || 0);
    const acct = Array.isArray(r.seals) ? r.seals.filter(okN) : [];
    try {
      const o = r.base && r.base.level ? JSON.parse(localStorage.getItem('draly_base_' + r.base.level) || 'null') : null;
      if (isObj(o) && o.who && o.who === r.who) {
        // this kid's mirror: its changes not saved yet
        const s = new Set(acct);
        const p = isObj(o.pend) ? o.pend : {};
        Object.keys(p).forEach((k) => { const x = Number(k); if (!okN(x)) return; if (p[k]) s.add(x); else s.delete(x); });
        out.seals = [...s];
      } else if (isObj(o) && !o.who) {
        // a phone that never met an account: its own seals join it at the next visit to La Base
        out.seals = [...new Set(acct.concat(Array.isArray(o.seals) ? o.seals.filter(okN) : []))];
      }
      // (a sibling's mirror never counts)
    } catch (_) { /* the account's word is enough */ }
    try {
      const o = JSON.parse(localStorage.getItem('draly_tareas') || 'null');
      const sent = new Set((r.hws || []).filter((h) => h.sent).map((h) => h.id));
      if (isObj(o) && o.who && o.who === r.who && isObj(o.pend)) {
        Object.keys(o.pend).forEach((id) => { const p = o.pend[id]; if (!isObj(p)) return; if (p.s === 1) sent.add(id); if (p.s === 0) sent.delete(id); });
      }
      const own = isObj(o) && isObj(o.phone) ? o.phone : (isObj(o) && !o.who && isObj(o.marks) ? o.marks : {});
      Object.keys(own).forEach((id) => { if (isObj(own[id]) && own[id].s) sent.add(id); });
      out.hws = (r.hws || []).map((h) => Object.assign({}, h, { sent: sent.has(h.id) }));
    } catch (_) { /* idem */ }
    return out;
  }

  // ── ① «Lo más importante esta semana» ────────────────────────────────────────────────────────────────────────
  // (pure: the words of the page for a plan, its ruta numbers and the payload; the test reads them too)
  function teacherText(r, d) {
    const n = realName(d && d.displayName);
    return '¡Hola, profe! ' + (n ? n + ' terminó' : 'Terminamos') + ' El Entrenamiento de ' + (r ? r.name : '') + '. ¡Ya puede hacer El Simulacro Dorado!';
  }
  function focusOf(p, r, d) {
    if (!p || !r) return { text: 'Para ver su Ruta Dorada, vuelve a entrar con su código.', btn: 'Entrar de nuevo', reload: true };
    const f = p.focus;
    const exp = (n, name) => 'la Experiencia ' + n + (name ? ', ' + name : '');
    const ruta = '/audios/' + encodeURIComponent(r.slug) + '?from=homework';
    if (f.kind === 'tarea') {
      return { text: f.exp ? 'Ayúdale a mandar la tarea de ' + exp(f.exp, f.name) + ': graben juntos su video y mándenlo a la profe por WhatsApp.'
        : 'Ayúdale a mandar su tarea: graben juntos su video y mándenlo a la profe por WhatsApp.',
        btn: 'Ver la tarea', href: '/audios/' + encodeURIComponent(f.id) };
    }
    if (f.kind === 'practice') {
      return { text: 'Ayúdale a practicar ' + exp(f.exp, f.name) + (f.name ? ',' : '') + ' hasta llegar al ' + f.goal + ' %: ' + (f.best == null ? 'todavía no la practica.' : 'hoy va en ' + f.best + ' %.'),
        btn: 'Practicar ahora', href: f.train || '/audios/' + encodeURIComponent(r.slug) + '/entrenamiento' };
    }
    if (f.kind === 'words') {
      return { text: 'Ayúdale a marcar las palabras que ya sabe de ' + exp(f.exp, f.name) + ': ' + (f.left === 1 ? 'le falta 1.' : 'le faltan ' + f.left + '.'),
        btn: 'Marcar palabras', href: r.base ? r.base.href + '#mundo-' + f.exp : ruta };
    }
    if (f.kind === 'teacher') {
      return { text: '¡Terminó El Entrenamiento! Avísale a la profe: ya puede hacer El Simulacro Dorado en clase.',
        btn: 'Avisar a la profe', href: 'https://wa.me/?text=' + encodeURIComponent(teacherText(r, d)), wa: true, copy: true };
    }
    // (a simulation passed: its golden book, where they review it together; else the route)
    const book = f.sim && Array.isArray(r.books) ? r.books.find((b) => b.n === f.sim.n) : null;
    return { text: f.sim ? '¡Va muy bien! Aprobó El Simulacro Dorado con ' + f.sim.percent + ' %. Pídele que te cuente cómo le fue.'
      : '¡Va muy bien! Sigan así: 5 minutos al día en casa hacen la diferencia.',
    btn: book ? 'Ver su libro dorado' : 'Ver La Ruta Dorada', href: book ? book.book : ruta, calm: true };
  }
  function drawFocus() {
    const box = $('pp-focus');
    const f = focusOf(P, R, D);
    box.classList.toggle('is-calm', !!f.calm);
    $('pp-focus-t').textContent = f.text;
    // (no ruta: nobody is logged in on this phone any more, the session ended: one tap brings the kid back)
    if (f.reload) { $('pp-focus-acts').innerHTML = '<button type="button" class="pp-btn pp-btn-gold" data-pp-reload>' + esc(f.btn) + '</button>'; return; }
    $('pp-focus-acts').innerHTML =
      '<a class="pp-btn pp-btn-gold" href="' + esc(f.href) + '"' + (f.wa ? ' target="_blank" rel="noopener"' : '') + '>' + (f.wa ? WA : '') + '<span>' + esc(f.btn) + '</span></a>' +
      (f.copy ? '<button type="button" class="pp-btn pp-btn-ghost" data-pp-copy><span>Copiar mensaje</span></button>' : '');
  }

  // ── ② four big numbers, each with its picture ──────────────────────────────────────────────────────────────
  function num(pic, picCls, big, of, label, sub, subCls, bigCls) {
    return '<div class="pp-num">' +
      '<img class="pp-num-pic' + (picCls ? ' ' + picCls : '') + '" src="' + esc(pic) + '" alt="" width="44" height="44" draggable="false">' +
      '<span class="pp-num-big' + (bigCls ? ' ' + bigCls : '') + '">' + big + (of ? ' <small>' + esc(of) + '</small>' : '') + '</span>' +
      '<span class="pp-num-label">' + esc(label) + '</span>' +
      (sub ? '<span class="pp-num-sub' + (subCls ? ' ' + subCls : '') + '">' + sub + '</span>' : '') + '</div>';
  }
  function drawNums() {
    const box = $('pp-nums');
    if (!P) { box.innerHTML = ''; box.hidden = true; return; }
    box.hidden = false;
    const cur = P.exps.find((e) => e.n === P.current) || P.exps[0];
    const wordPic = (cur && cur.pic) || A + 'dralingo/point.webp';
    const t = P.tareas;
    let tareas;
    if (!t.of && !t.later) tareas = num(A + 'cast/aileen-hello.webp', 'is-face', esc('Pronto'), '', 'tareas por WhatsApp', esc('La profe las manda pronto'), '', 'is-soft');
    else {
      // (2026-10-21, the class's pace) only homework up to the class's experience is due: this week's first, then any
      // older one still waiting; a later experience's homework never counts as missing (sent ahead, it counts as sent)
      const week = t.week && t.week.left;
      const left = t.of - t.sent;
      // («de esta semana» only when every one missing is this week's: an older one waiting counts in «por mandar»)
      tareas = num(A + 'cast/aileen-hello.webp', 'is-face', String(t.sent + (t.ahead || 0)), 'mandadas', 'tareas por WhatsApp',
        week && week === left ? esc(week === 1 ? 'Falta 1 de esta semana' : 'Faltan ' + week + ' de esta semana')
          : left ? esc(left === 1 ? 'Falta 1 por mandar' : 'Faltan ' + left + ' por mandar') : '<i class="pp-ok">' + CHECK + '</i>' + esc('Al día'),
        left ? 'is-red' : 'is-green', 'is-green');
    }
    let sim;
    if (P.sim) {
      sim = num(A + 'dralingo/star-hold.webp', '', P.sim.percent + ' %' + (P.sim.passed ? ' <i class="pp-ok pp-ok-big">' + CHECK + '</i>' : ''), '', 'simulacro en clase',
        esc(P.sim.passed ? '¡Aprobado!' : 'Para aprobar: 60 %'), P.sim.passed ? 'is-green' : '', P.sim.passed ? 'is-green' : 'is-gold');
    } else sim = num(A + 'dralingo/star-hold.webp', '', esc('Aún no'), '', 'simulacro en clase', esc('La profe lo hace al final'), '', 'is-gold');
    box.innerHTML =
      num(wordPic, 'is-word', String(P.sealed), 'de ' + P.words, 'palabras que ya sabe') +
      num(A + 'dralingo/power.webp', '', String(P.complete), 'de ' + P.of, 'experiencias completas') +
      tareas + sim;
  }

  // ── ③ La Ruta Dorada in small scenes ────────────────────────────────────────────────────────────────────────
  function rutaWords(p) {
    const cur = p.exps.find((e) => e.n === p.current);
    const won = p.sim && p.sim.passed;
    return {
      of: p.of + ' experiencias y el examen',
      tiles: p.exps.map((e) => 'Experiencia ' + e.n + ', ' + e.name + ': ' + (e.state === 'done' ? 'completa' : e.state === 'current' ? 'va aquí' : 'después')),
      say: cur ? 'Va en la Experiencia ' + cur.n + ', ' + cur.name + '. Cuando termine las ' + p.of + ', la profe le hace El Simulacro Dorado en clase.'
        : won ? '¡Terminó las ' + p.of + ' experiencias y aprobó El Simulacro Dorado!'
          : '¡Terminó las ' + p.of + ' experiencias! Ahora la profe le hace El Simulacro Dorado en clase.',
    };
  }
  function drawRuta() {
    const sec = $('pp-ruta');
    if (!P || !P.of) { sec.hidden = true; return; }
    sec.hidden = false;
    const w = rutaWords(P);
    $('pp-ruta-of').textContent = w.of;
    const tiles = P.exps.map((e, i) => {
      const st = e.state;
      const aria = w.tiles[i];
      return '<li class="pp-tile is-' + st + '" title="' + esc(aria) + '">' +
        '<img src="' + esc(sceneOf(R.slug, e.n)) + '" alt="" loading="lazy" draggable="false">' +
        '<span class="pp-tile-n">' + e.n + '</span>' +
        (st === 'done' ? '<span class="pp-tile-ok">' + CHECK + '</span>' : '') +
        '<span class="pp-sr">' + esc(aria) + '</span></li>';
    }).join('');
    const won = P.sim && P.sim.passed;
    // the trophy at the end: El Simulacro Dorado (Dubai, Dralingo holding the star; ASSETS.md)
    $('pp-strip').innerHTML = tiles + '<li class="pp-tile pp-tile-trophy' + (won ? ' is-done' : P.current == null ? ' is-current' : ' is-later') + '">' +
      '<img src="' + A + 'scenes/dubai-s.webp" alt="" loading="lazy" draggable="false"><img class="pp-cup" src="' + A + 'dralingo/star-hold.webp" alt="" draggable="false">' +
      (won ? '<span class="pp-tile-ok">' + CHECK + '</span>' : '') + '<span class="pp-sr">El Simulacro Dorado</span></li>';
    $('pp-strip').style.setProperty('--pp-n', String(P.of + 1));
    $('pp-strip').style.setProperty('--pp-half', String(Math.ceil((P.of + 1) / 2)));   // (a phone: two rows)
    $('pp-ruta-say').textContent = w.say;
    const go = $('pp-ruta-go');
    go.href = '/audios/' + encodeURIComponent(R.slug) + '?from=homework';
    go.hidden = false;
  }

  // ── ④ «Cómo ayudar en casa (5 minutos)»: 3 tips for this week's experience ─────────────────────────────────
  function tipsOf(p, r, d) {
    const e = p ? (p.exps.find((x) => x.n === (p.focus.exp || p.current)) || p.exps.find((x) => p.tareas.week && x.n === p.tareas.week.exp) || null) : null;
    const prompts = r && Array.isArray(r.prompts) ? r.prompts : [];
    const conv = d && Array.isArray(d.conversationPrompts) ? d.conversationPrompts : [];
    const mine = e ? prompts.filter((p) => p.exp === e.n) : [];
    const ask = mine.length ? mine[mine.length - 1].text : '';
    return [
      e ? 'Pídele que te enseñe 3 palabras de ' + e.name + ', con su dibujo.' : 'Pídele que te enseñe 3 palabras de hoy, con su dibujo.',
      ask || (conv.length ? conv[conv.length - 1].prompt : 'Pregúntale «Ni hao ma?» y celebra su respuesta, aunque no sea perfecta.'),
      (p && p.focus.kind === 'tarea') || (e && e.due !== false && e.hw.sent < e.hw.of) ? 'Graben juntos el video de la tarea y mándenlo el mismo día.'
        : 'Que lo diga EN VOZ ALTA: 5 minutos al día valen más que una hora a la semana.',
    ];
  }
  function drawTips() {
    $('pp-tips').innerHTML = tipsOf(P, R, D).map((t, i) => '<li><span class="pp-tip-n" aria-hidden="true">' + (i + 1) + '</span><span class="pp-tip-t">' + esc(t) + '</span></li>').join('');
  }

  // ── ⑤ the rows' badges and counts ───────────────────────────────────────────────────────────────────────────
  function drawRows() {
    const unread = H.unread ? Number(H.unread()) || 0 : 0;
    const b = $('pp-badge-msgs');
    b.hidden = !unread;
    b.textContent = unread > 9 ? '9+' : String(unread);
    const count = (id, n) => { const el = $(id); el.hidden = !n; el.textContent = String(n || ''); };
    count('pp-count-preguntas', (D.conversationPrompts || []).length);
    count('pp-count-examenes', (D.hskResults || []).length);
    count('pp-count-historias', (D.tests || []).length);
  }

  // ── the sheets ─────────────────────────────────────────────────────────────────────────────────────────────
  function empty(t) { return '<p class="pp-empty">' + esc(t) + '</p>'; }
  // «Lo que ya sabe hacer»: their achievements (tareas ≥ 80 %, stories ≥ 60 %), their words with audio, what they wrote
  function drawSabe() {
    const t = D.totals || {};
    const rows = (D.insights || []).slice();
    (D.tests || []).forEach((x) => {
      if (x.score >= 60) {
        rows.push({ insight: { title: 'Entendió la historia «' + (x.storyTitle || x.storyId) + '»',
          bullets: ['Sacó ' + x.score + '/100 en el examen de lectura', 'Identificó eventos y personajes de la historia'],
          encouragement: 'Pídele que te cuente la historia de «' + (x.storyTitle || x.storyId) + '» con sus propias palabras.' },
        score: x.score, total: 100, lastAttemptAt: x.ts });
      }
    });
    let h = '<div class="pp-chips">' +
      (P ? '<span class="pp-chip"><b>' + P.sealed + '</b> <span>de ' + P.words + ' palabras marcadas</span></span>' : '') +
      '<span class="pp-chip"><b>' + (t.assignmentsMastered || 0) + '</b> <span>de ' + (t.assignmentsAvailable || 0) + ' tareas aprobadas</span></span>' +
      '<span class="pp-chip"><b>' + (t.readingTestsTaken || 0) + '</b> <span>historias leídas</span></span></div>';
    h += '<h3 class="pp-h3">Sus logros</h3>';
    h += rows.length ? rows.map((r) => '<article class="pp-item">' +
      '<div class="pp-item-head"><b class="pp-item-t">' + esc(r.insight.title) + '</b><span class="pp-item-score">' + r.score + '/' + r.total + '</span></div>' +
      (r.lastAttemptAt ? '<span class="pp-item-date">' + esc(day(r.lastAttemptAt, true)) + '</span>' : '') +
      '<ul class="pp-item-list">' + (r.insight.bullets || []).map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' +
      (r.insight.encouragement ? '<p class="pp-item-tip">' + esc(r.insight.encouragement) + '</p>' : '') + '</article>').join('')
      : empty('Todavía no tiene logros. Cuando apruebe su primera tarea, aparece aquí.');
    h += '<h3 class="pp-h3">Sus palabras</h3><p class="pp-intro">' + esc(levelIntro()) + '</p><div class="pp-words">' + wordsHtml() + '</div>';
    const det = Array.isArray(D.sentenceDetail) ? D.sentenceDetail : [];
    if (det.length) {
      h += '<h3 class="pp-h3">Lo que escribió en sus tareas</h3>' + det.map((d) => '<details class="pp-fold"><summary><span>' + esc(d.assignmentTitle) + '</span>' +
        '<b class="pp-fold-n">' + d.correct + ' de ' + d.rows.length + '</b></summary><ul class="pp-sent">' +
        d.rows.map((r) => '<li class="' + (r.correct ? 'is-ok' : 'is-bad') + '"><span class="pp-sent-mark" aria-hidden="true">' + (r.correct ? '✓' : '✗') + '</span><span>' +
          '<span class="pp-sent-es">' + esc(r.es) + '</span>' +
          '<span class="pp-sent-l">Escribió: <b>' + esc(r.student || '—') + '</b></span>' +
          (r.correct ? '' : '<span class="pp-sent-l">Correcto: <b>' + esc(r.expected) + '</b></span>') + '</span></li>').join('') + '</ul></details>').join('');
    }
    $('pp-sabe').innerHTML = h;
  }
  function levelIntro() {
    if (D.level === 'yct1') return 'YCT 1 es el primer nivel del examen oficial de Chino Mandarín para niños. Toca 🔊 para oír cada palabra y pídele que la repita.';
    if (D.level === 'hsk2') return 'New HSK 1 es el primer nivel del nuevo examen oficial de Chino Mandarín. Toca 🔊 para oír cada palabra y pídele que la repita.';
    return 'HSK 1 es el primer nivel del examen oficial de Chino Mandarín. Toca 🔊 para oír cada palabra y pídele que la repita.';
  }
  // the level's words per world: the pack's lists (YCT 1, New HSK 1) or the HSK 1 list (warmup-vocab.js); pinyin and
  // Spanish only (the hanzi stay in the 🔊 button's data, for the voice)
  function wordsHtml() {
    let lists = [];
    if (Array.isArray(D.levelWords)) lists = D.levelWords.map((w) => ({ name: w.name, words: (w.words || []).map((x) => ({ py: x.py, es: x.es, pic: x.image, say: x.hz || '' })) }));
    else if (window.WU_WORDS && window.WU_EXPERIENCES) {
      lists = Object.keys(window.WU_EXPERIENCES).map((k) => ({ name: window.WU_EXPERIENCES[k].label || k,
        words: window.WU_WORDS.filter((w) => w.exp === k).map((w) => ({ py: w.pinyin, es: w.es, pic: null, say: w.pinyin || '' })) }));
    }
    if (!lists.length) return empty('Las palabras de su nivel llegan pronto.');
    return lists.map((l, i) => '<details class="pp-fold"' + (i === 0 ? ' open' : '') + '><summary><span>' + esc(String(l.name || '').replace(/^[^A-Za-zÀ-ÿ0-9¿¡]+/, '')) + '</span>' +
      '<b class="pp-fold-n">' + l.words.length + ' palabras</b></summary><ul class="pp-wordlist">' +
      l.words.map((w) => '<li class="pp-word">' + (w.pic ? '<img src="' + esc(w.pic) + '" alt="" loading="lazy" width="48" height="48">' : '<span class="pp-word-dot" aria-hidden="true"></span>') +
        '<span class="pp-word-t"><span class="pp-word-py">' + esc(w.py) + '</span><span class="pp-word-es">' + esc(w.es) + '</span></span>' +
        (w.say ? '<button type="button" class="pp-say" data-say="' + esc(w.say) + '" aria-label="Escuchar ' + esc(w.py) + '">' + SPEAK + '</button>' : '') + '</li>').join('') +
      '</ul></details>').join('');
  }
  function drawPreguntas() {
    const list = Array.isArray(D.conversationPrompts) ? D.conversationPrompts : [];
    $('pp-preguntas').innerHTML = list.length ? list.slice().reverse().map((c) => '<article class="pp-item"><b class="pp-item-k">' + esc(c.assignmentTitle) + '</b>' +
      '<p class="pp-item-q">' + esc(c.prompt) + '</p></article>').join('')
      : empty('Cuando apruebe una tarea o lea una historia, aquí aparecen preguntas para hacerle.');
  }
  function drawExamenes() {
    const rows = Array.isArray(D.hskResults) ? D.hskResults : [];
    let h = rows.length ? rows.map((r) => {
      const passed = r.percent != null && r.percent >= 60;
      return '<article class="pp-item pp-exam"><div class="pp-item-head"><b class="pp-item-t">' + esc(r.title) + '</b>' +
        '<span class="pp-item-score ' + (passed ? 'is-green' : 'is-gold') + '">' + (r.percent != null ? Math.round(r.percent) + ' %' : '—') + '</span></div>' +
        '<span class="pp-item-date">' + esc(day(r.ts, true)) + ' · ' + r.score + '/' + r.total + '</span>' +
        '<p class="pp-item-tip">' + esc(passed ? 'Aprobó. Pídele que te cuente qué le gustó del examen.' : 'Aún no aprueba este examen. Lo repasan en clase y en El Entrenamiento.') + '</p></article>';
    }).join('') : empty('Aún no hizo ningún simulacro. La profe lo hace en clase, al final de La Ruta Dorada.');
    const books = R && Array.isArray(R.books) ? R.books : [];
    if (books.length) {
      h += '<h3 class="pp-h3">Sus errores, en el libro dorado</h3><div class="pp-books">' + books.map((b) => '<a class="pp-book" href="' + esc(b.book) + '">' +
        '<img src="' + A + 'dralingo/star-hold.webp" alt="" width="36" height="36"><span class="pp-book-t"><b>Simulacro ' + b.n + '</b><small>' +
        esc(b.mistakes == null || (b.mistakes === 0 && !(b.percent >= 100)) ? 'Ver el libro dorado' : b.mistakes === 0 ? 'Sin errores' : b.mistakes === 1 ? '1 error para repasar' : b.mistakes + ' errores para repasar') + '</small></span>' + CHEV + '</a>').join('') + '</div>';
    }
    $('pp-examenes').innerHTML = h;
  }
  function drawHistorias() {
    const list = Array.isArray(D.tests) ? D.tests : [];
    $('pp-historias').innerHTML = list.length ? list.map((x) => '<article class="pp-item"><div class="pp-item-head"><b class="pp-item-t">' + esc(x.storyTitle || x.storyId) + '</b>' +
      '<span class="pp-item-score ' + (x.score >= 60 ? 'is-green' : 'is-gold') + '">' + x.score + '/100</span></div>' +
      '<span class="pp-item-date">' + esc(day(x.ts)) + '</span>' +
      '<p class="pp-item-q">' + esc('Pregúntale: «¿Qué pasó en la historia de ' + (x.storyTitle || x.storyId) + '? Cuéntamela en Chino Mandarín o en español.»') + '</p></article>').join('')
      : empty('Aún no lee historias en clase. Cuando lea la primera, aquí ves su nota.');
  }

  const PARTS = { sabe: drawSabe, preguntas: drawPreguntas, examenes: drawExamenes, historias: drawHistorias };
  function openSheet(part, from) {
    if (part === 'mensajes') { if (H.openInbox) H.openInbox(); return; }
    if (part === 'tareas') { close(); if (H.home) H.home('tareas'); return; }
    const sheet = $('pp-sheet');
    const sec = sheet.querySelector('[data-part="' + part + '"]');
    if (!sec) return;
    sheet.querySelectorAll('[data-part]').forEach((s) => { s.hidden = s !== sec; });
    $('pp-sheet-title').textContent = sec.getAttribute('data-title') || '';
    if (PARTS[part] && D) PARTS[part]();
    if (part === 'guias' && H.guides) H.guides();
    if (part === 'reporte' && H.reports) H.reports();
    opener = from || document.activeElement;
    sheet.hidden = false;
    $('pp-sheet-body').scrollTop = 0;
    const wrap = document.querySelector('#screen-parents .pp-wrap');
    if (wrap) wrap.inert = true;
    document.documentElement.classList.add('pp-lock');
    requestAnimationFrame(() => {
      sheet.classList.add('is-open');
      const card = sheet.querySelector('.pp-sheet-card');
      if (card) card.focus({ preventScroll: true });
    });
  }
  function close() {
    const sheet = $('pp-sheet');
    if (!sheet || sheet.hidden) return;
    sheet.classList.remove('is-open');
    sheet.hidden = true;
    const wrap = document.querySelector('#screen-parents .pp-wrap');
    if (wrap) wrap.inert = false;
    document.documentElement.classList.remove('pp-lock');
    if (opener && opener.focus && document.contains(opener)) { try { opener.focus({ preventScroll: true }); } catch (_) {} }
    opener = null;
  }

  // ── wiring (once) ─────────────────────────────────────────────────────────────────────────────────────────
  let wired = false;
  function wire() {
    if (wired) return;
    wired = true;
    const scr = $('screen-parents');
    scr.addEventListener('click', (e) => {
      const o = e.target.closest('[data-open]');
      if (o) { openSheet(o.getAttribute('data-open'), o); return; }
      if (e.target.closest('[data-close]')) { close(); return; }
      const s = e.target.closest('.pp-say');
      if (s) {
        e.preventDefault();
        // (homework.js speakChinese writes «🔊 …» into the button it gets: this one keeps its icon, only the class changes)
        if (H.speak) H.speak(s.getAttribute('data-say') || '', { classList: s.classList, textContent: '' });
        return;
      }
      if (e.target.closest('[data-pp-reload]')) { location.reload(); return; }
      const c = e.target.closest('[data-pp-copy]');
      if (c) {
        const msg = teacherText(R, D);
        const done = () => { const sp = c.querySelector('span'); if (sp) sp.textContent = '¡Mensaje copiado!'; };
        if (window.DralyAuto && window.DralyAuto.copyText) { window.DralyAuto.copyText(msg, c, '¡Mensaje copiado!'); return; }
        try { navigator.clipboard.writeText(msg).then(done, () => {}); } catch (_) { /* nothing to copy with */ }
      }
    });
    // «Volver» leaves Papás: any open sheet closes with it (homework.js shows the home)
    const back = $('hw-parents-back');
    if (back) back.addEventListener('click', close, true);
    document.addEventListener('keydown', (e) => {
      const sheet = $('pp-sheet');
      if (!sheet || sheet.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key === 'Tab') {
        // keep the keyboard inside the sheet
        const f = [...sheet.querySelectorAll('button, a[href], summary, [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && (document.activeElement === first || !sheet.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  function render(data, hooks) {
    D = data || {};
    H = hooks || {};
    wire();
    close();
    if (H.avatar) H.avatar($('hw-parents-avatar'), D.avatar);
    const name = realName(D.displayName);
    $('hw-parents-name').textContent = name;
    $('hw-parents-name').hidden = !name;
    $('pp-level').textContent = 'Chino Mandarín · ' + (D.levelName || '');
    R = D.ruta && window.DralyPapasPlan ? withPhone(D.ruta) : null;
    if (R) R.prompts = D.ruta.prompts;
    P = R ? window.DralyPapasPlan.plan(R) : null;
    drawFocus();
    drawNums();
    drawRuta();
    drawTips();
    drawRows();
    // Papás opens at its top (the home may have been scrolled; on /homework the body is the page's scroller)
    try { window.scrollTo(0, 0); document.body.scrollTop = 0; document.documentElement.scrollTop = 0; } catch (_) { /* nothing to scroll */ }
  }

  // texts(data): the page's words for an insights payload, without a page (scripts/test-papas.js reads them)
  function texts(data) {
    const d = data || {};
    const r = d.ruta && window.DralyPapasPlan ? Object.assign({}, d.ruta) : null;
    const p = r ? window.DralyPapasPlan.plan(r) : null;
    return { plan: p, focus: focusOf(p, r, d), ruta: p && p.of ? rutaWords(p) : null, tips: tipsOf(p, r, d), teacher: teacherText(r, d) };
  }
  // (2026-10-18, «Mi Dralingo» part 3: the kid's home draws the same scene per experience and counts this phone's marks
  // not saved yet with the same rule: one place for both, so the home and Papás never disagree)
  window.DralyPapas = { render, close, open: openSheet, texts, sceneOf, withPhone };
})();
