// =========================================================================
// libro.js · El libro dorado, inside El Simulacro Dorado (La Ruta Dorada, phase 5 · his picks 2026-10-16)
// =========================================================================
// Drawn by js/audios.js's router inside La Ruta Dorada's page:
//   /audios/<level>/libro/<n>   simulation n's golden book: «Mis resultados», «Repasa tus N errores» (the wrong questions
//                               of the kid's latest try, each a full card with its play button), «Así es el examen»
//                               (the solved examples), then the whole simulation, part by part (the PDF: only for
//                               the super admin since 2026-10-18; nobody else sees a word about it)
// One phone card per question, as the printed golden book prints it (same source: ../study/lib/examweb.py): its photos
// (4:3, the book's letter tabs over the exam's painted-out ones), its own play button with the original exam recording
// of that question, the pinyin with tone marks, the Spanish, the question in bold and the answer in gold.
// Everything comes from GET /api/golden/<level>/<n> (server.js, core/golden.js), which asks every door: the level's
// key, an account, El Simulacro Dorado open, THAT simulation taken (a teacher passes them all). This file holds no
// question, no answer and no media address of its own. A teacher's «Ver su libro» (/maestro) adds ?de=<sealed link>:
// that kid's mistakes. One clip at a time, started by the tap itself (iPhone). No hanzi, no em dash.
// =========================================================================
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const calm = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const I = {
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    cross: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 11.5V8a4 4 0 0 1 8 0v3.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><rect x="4.5" y="11" width="15" height="10.5" rx="2.6" fill="currentColor"/></svg>',
    ear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9.5a5 5 0 0 1 10 0c0 2.6-1.6 3.6-2.6 4.6-.9.9-1 1.7-1.2 2.7a2.7 2.7 0 0 1-5.2.4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M10 9.7a2 2 0 0 1 4 0c0 1-.7 1.4-1.3 2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M2.5 5.2c2.9-1.2 6-1 8.8.9v13.4c-2.8-1.8-5.9-2-8.8-.9zM21.5 5.2c-2.9-1.2-6-1-8.8.9v13.4c2.8-1.8 5.9-2 8.8-.9z"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 3.5h10v5.2a5 5 0 0 1-10 0z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M7 5.5H4.6a2.6 2.6 0 0 0 2.7 4.4M17 5.5h2.4a2.6 2.6 0 0 1-2.7 4.4M12 13.8v3.4"/><path fill="currentColor" d="M8 20.5h8v-.7a2.6 2.6 0 0 0-2.6-2.6h-2.8A2.6 2.6 0 0 0 8 19.8z"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>',
  };
  // Dralingo in his platform look (kandura, ghutra, mustache)
  const DRAGON = { wise: '/assets/dralingo/wise.webp', hello: '/assets/dralingo/hello.webp', power: '/assets/dralingo/power.webp' };
  // the level's jewel colours (the same as its card on La Ruta Dorada)
  const LOOK = { yct1: ['#a8352c', '#6c1513', '#360606'], newhsk1: ['#24806b', '#0e4d43', '#04221d'], hsk1: ['#3c5bb0', '#1b2f6b', '#0a1435'] };
  const SECTION = { L: 'Escuchar', R: 'Leer' };

  // ── text as the book prints it ──
  // pinyin: numbers (8 suì, 7:15) in the Spanish type like every number in the books; `fw` = the word that fills the
  // blank, highlighted
  // (numbers are found in the raw text, then every piece is escaped: never a digit of an escaped entity)
  const digits = (s) => String(s).split(/(\d+(?::\d+)?)/).map((x, i) => (i % 2 ? '<span class="gd-dg">' + esc(x) + '</span>' : esc(x))).join('');
  function pyHtml(py, fw) {
    const parts = String(py || '').split('___');
    const out = parts.map((p) => digits(p));
    return fw != null && parts.length > 1 ? out.join('<b class="gd-fill">' + esc(fw) + '</b>') : out.join('___');
  }
  // Spanish: {pinyin} inside it set in the pinyin type
  const esHtml = (es) => esc(es || '').replace(/\{([^}]+)\}/g, '<span class="gd-pyin" lang="zh-Latn-pinyin">$1</span>');
  const howHtml = (how) => esc(how || '').replace('{ok}', '<i class="gd-mk-in is-ok" aria-label="sí">' + I.check + '</i>').replace('{no}', '<i class="gd-mk-in is-no" aria-label="no">' + I.cross + '</i>');
  const range = (p) => (p.first === p.last ? 'Pregunta ' + p.first : 'Preguntas ' + p.first + '–' + p.last);
  const partName = (p) => SECTION[p.sec] + ' · Parte ' + p.part;
  const mb = (n) => String(Number(n) || 0).replace('.', ',');

  // ── sound: one clip at a time, started inside the tap (iPhone lets it play) ──
  let au = null, playing = null, raf = 0;
  function stopSound() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (au) { try { au.pause(); } catch (_) {} }
    if (playing) {
      playing.classList.remove('is-playing', 'is-wait');
      playing.style.removeProperty('--p');
      playing.innerHTML = I.play;
      playing.setAttribute('aria-label', playing.getAttribute('data-label') || 'Escuchar');
      playing.setAttribute('aria-pressed', 'false');
    }
    playing = null;
  }
  function tick() {
    if (!playing || !au) return;
    if (au.duration > 0) playing.style.setProperty('--p', Math.min(1, au.currentTime / au.duration).toFixed(3));
    raf = requestAnimationFrame(tick);
  }
  function toggle(btn) {
    const was = playing === btn;
    stopSound();
    if (was) return;
    if (!au) {
      au = new Audio();
      au.preload = 'auto';
      au.addEventListener('ended', stopSound);
      au.addEventListener('playing', () => { if (playing) playing.classList.remove('is-wait'); });
      au.addEventListener('error', () => { if (playing) { const b = playing; stopSound(); b.classList.add('is-error'); setTimeout(() => b.classList.remove('is-error'), 1600); } });
    }
    playing = btn;
    btn.classList.add('is-playing', 'is-wait');
    btn.innerHTML = I.pause;
    btn.setAttribute('aria-label', 'Parar');
    btn.setAttribute('aria-pressed', 'true');
    try {
      au.src = btn.getAttribute('data-src');
      const p = au.play();
      if (p && p.catch) p.catch(() => { if (playing === btn) stopSound(); });
    } catch (_) { stopSound(); }
    tick();
  }

  // ── a photo, with the book's letter tab when it has one (shares of the 4:3 frame, from the book itself) ──
  function photo(pics, i, cls, tab, letter, extra) {
    const p = pics[i];
    if (!p) return '';
    const tw = Number(tab && tab[0]) || 0, th = Number(tab && tab[1]) || 0;
    const t = tab ? '<span class="gd-tab" style="width:' + tw + '%;height:' + th + '%;--th:' + th + '" aria-hidden="true">' + esc(letter) + '</span>' : '';
    return '<figure class="gd-ph ' + (cls || '') + '"><img src="' + esc(p.url) + '" alt="" width="' + (Number(p.w) || 480) + '" height="' + (Number(p.h) || 360) +
      '" loading="lazy" decoding="async" data-zoom="1">' + t + (extra || '') + '</figure>';
  }
  function lineHtml(ln) {
    const dot = ln.v != null ? '<span class="gd-dot gd-dot-' + (ln.v ? 'b' : 'a') + '" aria-hidden="true"></span>' : '';
    return '<div class="gd-line' + (ln.mark ? ' is-mark' : '') + (ln.v != null ? ' has-dot' : '') + '">' + dot +
      '<div><p class="gd-py" lang="zh-Latn-pinyin">' + pyHtml(ln.py, ln.fw) + '</p>' + (ln.es ? '<p class="gd-es">' + esHtml(ln.es) + '</p>' : '') + '</div></div>';
  }
  const linesHtml = (ls) => '<div class="gd-lines">' + ls.map(lineHtml).join('') + '</div>';
  const said = (it, big) => '<div class="gd-said' + (big ? ' is-big' : '') + '"><p class="gd-py" lang="zh-Latn-pinyin">' + pyHtml(it.py) + '</p>' +
    (it.es ? '<p class="gd-es">' + esHtml(it.es) + '</p>' : '') + '</div>';
  const letterOf = (v) => (v === 'T' ? I.check : v === 'F' ? I.cross : esc(v));

  // one question as a card. ctx: { pics, clips, part, yours (the kid's own answer, in the mistakes), whose }
  function cardHtml(it, c) {
    const p = c.part;
    const num = it.ex ? '<span class="gd-qn is-ex" aria-label="Ejemplo">Ej.</span>' : '<span class="gd-qn"><span class="au-sr">Pregunta </span>' + (Number(it.num) || 0) + '</span>';
    const label = it.ex ? 'Escuchar el ejemplo' : 'Escuchar la pregunta ' + it.num;
    const play = it.a != null && c.clips[it.a]
      ? '<button type="button" class="gd-play" data-src="' + esc(c.clips[it.a]) + '" data-label="' + esc(label) + '" aria-label="' + esc(label) + '" aria-pressed="false">' + I.play + '</button>' : '';
    const yours = c.yours !== undefined;
    const given = yours ? c.yours : null;
    let body = '', sr = '';
    if (p.kind === 'tf') {
      const marks = '<span class="gd-tf" aria-hidden="true">' + ['T', 'F'].map((v) => '<i class="gd-mk' + (v === it.ans ? ' is-on' : '') +
        (yours && v === given ? ' is-yours' : '') + '">' + (v === 'T' ? I.check : I.cross) + '</i>').join('') + '</span>';
      sr = 'Respuesta: ' + (it.ans === 'T' ? 'sí va con la foto.' : 'no va con la foto.');
      body = '<div class="gd-row">' + photo(c.pics, it.p, '') + '<div class="gd-tx">' + marks + said(it, p.big) + '</div></div>';
    } else if (p.kind === 'abc') {
      const text = it.lines ? linesHtml(it.lines) : said(it, p.big);
      const opts = '<div class="gd-opts">' + it.opts.map((o) => photo(c.pics, o.p, 'gd-opt' + (o.l === it.ans ? ' is-ok' : '') + (yours && o.l === given ? ' is-yours' : ''),
        it.tab, o.l, o.l === it.ans ? '<i class="gd-okb" aria-hidden="true">' + I.check + '</i>' : (yours && o.l === given ? '<i class="gd-nob" aria-hidden="true">' + I.cross + '</i>' : ''))).join('') + '</div>';
      sr = 'Respuesta: ' + it.ans + '.';
      body = text + opts;
    } else if (p.kind === 'text') {
      const head = '<div class="gd-ask">' + it.said.map((s) => '<div class="gd-said' + (s.k === 'ask' ? ' is-ask' : '') + '"><p class="gd-py" lang="zh-Latn-pinyin">' + pyHtml(s.py) + '</p>' +
        (s.es ? '<p class="gd-es">' + esHtml(s.es) + '</p>' : '') + '</div>').join('') + '</div>';
      const opts = '<ol class="gd-topts">' + it.opts.map((o) => '<li class="gd-topt' + (o.l === it.ans ? ' is-ok' : '') + (yours && o.l === given ? ' is-yours' : '') + '">' +
        '<b class="gd-tl">' + esc(o.l) + '</b><div><p class="gd-py" lang="zh-Latn-pinyin">' + pyHtml(o.py) + '</p>' + (o.es ? '<p class="gd-es">' + esHtml(o.es) + '</p>' : '') + '</div>' +
        (o.l === it.ans ? '<i class="gd-okb" aria-hidden="true">' + I.check + '</i>' : '') + '</li>').join('') + '</ol>';
      sr = 'Respuesta: ' + it.ans + '.';
      body = head + opts;
    } else if (p.kind === 'gal') {
      body = '<div class="gd-row gd-gal' + (p.talk ? ' is-talk' : '') + '">' + photo(c.pics, it.p, 'gd-galph is-ok', it.tab, it.ans) +
        (it.lines ? linesHtml(it.lines) : said(it)) + '</div>';
      sr = 'Respuesta: la foto ' + it.ans + '.';
    } else if (p.kind === 'reply' || p.kind === 'fill') {
      body = '<div class="gd-fillrow">' + (it.p != null ? photo(c.pics, it.p, 'gd-small') : '') + linesHtml(it.lines) +
        '<span class="gd-ans" aria-hidden="true">' + esc(it.ans) + '</span></div>';
      sr = 'Respuesta: ' + it.ans + '.';
    }
    let mine = '';
    if (yours) {
      // the kid's answer beside the right one, in words a kid reads (a red ✓ alone looked like «I got it right»)
      // (✓ / ✗ only on a ✓/✗ question: elsewhere «F» is the letter F of a list or a gallery)
      const tf = p.kind === 'tf';
      const wordOf = (v) => {
        if (tf) return ' <span class="gd-yours-w">' + (v === 'T' ? 'sí va' : 'no va') + '</span>';
        const src = p.kind === 'reply' || p.kind === 'fill' ? (p.bank || []).find((x) => x.l === v) : (p.kind === 'text' ? it.opts.find((x) => x.l === v) : null);
        return src ? ' <span class="gd-yours-py" lang="zh-Latn-pinyin">' + pyHtml(src.py) + '</span>' : '';
      };
      const chip = (v, cls) => '<b class="' + cls + '">' + (tf ? letterOf(v) : esc(v)) + '</b>' + wordOf(v);
      mine = '<p class="gd-yours"><span class="gd-yours-row">' + (c.whose === 'teacher-kid' ? 'Su respuesta: ' : 'Tu respuesta: ') +
        (given ? chip(given, 'gd-yours-l') : '<b>sin responder</b>') + '</span>' +
        '<span class="gd-yours-row is-right">La correcta: ' + chip(it.ans, 'gd-right-l') + '</span></p>';
    }
    const compact = !play && !yours;   // (a card without a play button: its number beside the content, no empty row)
    return '<article class="gd-card gd-k-' + p.kind + (it.ex ? ' is-ex' : '') + (compact ? ' is-compact' : '') + '"' + (c.anchor && !it.ex ? ' id="pregunta-' + (Number(it.num) || 0) + '"' : '') + '>' +
      '<header class="gd-card-top">' + num + (yours ? '<span class="gd-card-part">' + esc(partName(p)) + '</span>' : '') + play + '</header>' +
      body + '<p class="au-sr">' + esc(sr) + '</p>' + mine + '</article>';
  }
  // the list of words or replies a fill-in / reply part chooses from, each with the question it answers
  function bankHtml(p, examples) {
    if (!p.bank || !p.bank.length) return '';
    return '<ul class="gd-bank is-' + p.kind + '" aria-label="' + esc(p.kind === 'fill' ? 'Las palabras de la lista' : 'Las respuestas de la lista') + '">' + p.bank.map((b) => {
      const dim = examples && b.for !== 'ex';
      const tag = b.for == null ? '' : (b.for === 'ex' ? '<em class="is-ex">Ej.</em>' : (examples ? '' : '<em><span class="au-sr">pregunta </span>' + (Number(b.for) || 0) + '</em>'));
      return '<li class="gd-bk' + (dim ? ' is-dim' : '') + '"><b>' + esc(b.l) + '</b><div><p class="gd-py" lang="zh-Latn-pinyin">' + pyHtml(b.py) + '</p>' +
        '<p class="gd-es">' + esHtml(b.es) + '</p></div>' + tag + '</li>';
    }).join('') + '</ul>';
  }
  function partHtml(p, media, examples) {
    const ic = p.sec === 'L' ? I.ear : I.book;
    const head = '<header class="gd-part"><span class="gd-part-ic" aria-hidden="true">' + ic + '</span><div><h3 class="gd-part-t">' + esc(partName(p)) + '</h3>' +
      '<p class="gd-part-how">' + howHtml(p.how) + '</p></div>' + (examples ? '' : '<span class="gd-part-q">' + esc(range(p)) + '</span>') + '</header>';
    if (p.note) return '<section class="gd-partbox">' + head + '<p class="gd-note">' + esc(p.note) + '</p></section>';
    return '<section class="gd-partbox">' + head + bankHtml(p, examples) +
      p.items.map((it) => cardHtml(it, { pics: media.pics, clips: media.clips, part: p, anchor: !examples })).join('') + '</section>';
  }

  // ── the page ──
  let screen = 0;
  let zoomEl = null;
  function leave() {
    screen++;
    stopSound();
    document.body.classList.remove('au-is-gold');
    if (zoomEl && zoomEl.open) closeZoom();
  }
  const fetchJson = (url) => fetch(url, { credentials: 'same-origin', cache: 'no-store' })
    .then((r) => r.json().catch(() => null).then((d) => ({ status: r.status, d })), () => ({ status: 0, d: null }));
  function lookStyle(slug) { const l = LOOK[slug] || LOOK.yct1; return '--c1:' + l[0] + ';--c2:' + l[1] + ';--c3:' + l[2]; }
  function friendHtml(mood, cls) {
    const C = window.DralingoCast;
    if (!C) return '';
    const f = C.pick(1)[0];
    return '<div class="rd-friend gd-friend' + (cls ? ' ' + cls : '') + '"><img src="' + esc(C.pose(f, mood)) + '" alt="" width="200" height="240" decoding="async">' +
      '<p class="rd-bubble"><b>' + esc(C.name(f)) + '</b>' + esc(C.line(f, mood)) + '</p></div>';
  }
  // the simulations of the level: each one's book (gold once taken, with its mistakes; one not taken yet is a plain coin
  // whose page says «Haz el Simulacro N»), the one on screen ringed
  function simsNav(d, de) {
    if (!d.sims || d.sims.length < 2) return '';
    return '<nav class="gd-sims" aria-label="El libro de cada simulacro"><ol>' + d.sims.map((s) => {
      const here = s.n === d.n;
      const label = 'Simulacro ' + s.n + (s.taken ? (s.mistakes === 0 ? ', sin errores' : s.mistakes ? ', ' + s.mistakes + (s.mistakes === 1 ? ' error' : ' errores') : '') : (d.who === 'teacher' || d.who === 'teacher-kid' ? '' : ', todavía no lo hiciste'));
      return '<li><a class="gd-sim' + (here ? ' is-here' : '') + (s.taken ? ' is-taken' : '') + '" href="/audios/' + esc(d.slug) + '/libro/' + s.n + (de ? '?de=' + encodeURIComponent(de) : '') + '"' +
        (here ? ' aria-current="page"' : '') + ' data-nav aria-label="' + esc(label) + '"><b>' + s.n + '</b>' +
        (s.taken && s.mistakes != null ? '<small>' + (s.mistakes === 0 ? I.check : s.mistakes) + '</small>' : '') + '</a></li>';
    }).join('') + '</ol></nav>';
  }
  function headHtml(d, sub) {
    const back = d.who === 'teacher-kid' ? '' : '<a class="au-back" data-nav href="/audios/' + esc(d.slug) + '#paso-3">' + I.back + 'La Ruta de ' + esc(d.name) + '</a>';
    return back + '<section class="gd-head" style="' + lookStyle(d.slug) + '">' +
      '<img class="gd-head-dragon" src="' + DRAGON.wise + '" alt="" width="432" height="480" decoding="async" fetchpriority="high">' +
      '<h1 class="gd-head-title" tabindex="-1">El libro dorado</h1>' +
      '<p class="gd-head-sim">Simulacro ' + d.n + ' de ' + esc(d.name) + '</p>' +
      '<p class="gd-head-sub">' + esc(sub) + '</p><span class="gd-head-rule" aria-hidden="true"></span></section>';
  }
  function stateCard(main, d, o) {
    main.innerHTML = headHtml(d, o.sub) + (o.nav ? simsNav(d) : '') +
      '<section class="gd-state">' + '<img class="gd-state-dragon" src="' + (o.dragon || DRAGON.hello) + '" alt="" width="432" height="480" decoding="async">' +
      '<div><h2 class="gd-state-t">' + esc(o.title) + '</h2><p>' + esc(o.text) + '</p>' + (o.btn || '') + '</div></section>';
  }
  function pdfHtml(d) {
    const p = d.pdf || {};
    if (p.href) {
      return '<section class="gd-pdf is-ready"><span class="gd-pdf-ic" aria-hidden="true">' + I.book + '</span><div class="gd-pdf-body">' +
        '<h2 class="gd-pdf-t">El libro en PDF</h2><p>' + esc(d.title || '') + '</p>' +
        (p.pages || p.mb ? '<p>' + [p.pages ? (Number(p.pages) || 0) + ' páginas' : '', p.mb ? mb(p.mb) + ' MB' : ''].filter(Boolean).join(', ') + '</p>' : '') +
        '<a class="gd-btn gd-btn-gold" href="' + esc(p.href) + '" download>' + I.down + 'Descargar el libro</a></div></section>';
    }
    // (2026-10-18, his rule: the study PDFs download for the super admin only; the server sends `href` to nobody else,
    // and families never read about a PDF: this web book, with its audio, is how they study)
    return '';
  }
  function resultsHtml(d, parts) {
    const m = d.mine;
    if (!m) return '';
    const wrong = new Set(m.wrong || []);
    const kid = d.who === 'teacher-kid';
    const passed = !!m.passed;   // (the server's: the exam's pass line as a %, the route's figure)
    let rows = '', right = 0, all = 0;
    const weak = [];
    if (m.wrong) {
      rows = '<ol class="gd-res-parts">' + parts.map((p) => {
        const ok = p.items.filter((it) => !wrong.has(it.q)).length;
        right += ok; all += p.items.length;
        if (ok < Math.min(4, p.items.length)) weak.push(partName(p));
        return '<li><span class="gd-res-name">' + esc(partName(p)) + '</span><span class="gd-res-coins" aria-hidden="true">' +
          p.items.map((it) => '<i class="' + (wrong.has(it.q) ? '' : 'is-on') + '"></i>').join('') + '</span><b>' + ok + ' de ' + p.items.length + '</b></li>';
      }).join('') +
        // (the total only on a pass, like the route: a kid reads a low number as failing)
        (passed ? '<li class="is-total"><span class="gd-res-name">Total</span><span class="gd-res-coins" aria-hidden="true"></span><b>' + right + ' de ' + all + '</b></li>' : '') + '</ol>';
    }
    const tips = (d.review || []).map((r) => '<li><b>' + esc(r.b) + '</b>' + esc(r.t) + '</li>').join('');
    const join = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1]);
    return '<section class="gd-res" aria-labelledby="gd-res-t"><div class="gd-res-head"><div><h2 class="gd-res-t" id="gd-res-t">' + (kid ? 'Sus resultados' : 'Mis resultados') + '</h2>' +
      '<p class="gd-res-when">' + (kid ? 'Su último intento' : 'Tu último intento') + '</p></div>' +
      (passed ? '<span class="gd-pass">' + I.trophy + '¡Aprobado! ' + (Number(m.percent) || 0) + ' %</span>' : '') + '</div>' +
      (rows || '<p class="gd-note">Este intento no guardó cada respuesta: repasa el simulacro completo.</p>') +
      (weak.length ? '<p class="gd-res-tip">Repasa otra vez: <b>' + esc(join(weak)) + '</b>.</p>' : '') +
      (tips ? '<ul class="gd-res-how">' + tips + '</ul>' : '') + '</section>';
  }
  function mistakesHtml(d, parts, media) {
    const m = d.mine;
    if (!m || !m.wrong) return '';
    const kid = d.who === 'teacher-kid';
    if (!m.wrong.length) {
      // the moment: every question right, a gold coin, a friend of the gang cheering, and the next step
      const q = d.sim.questions;
      let next = '';
      if (!kid) {
        const after = (d.sims || []).filter((s) => s.n > d.n).concat((d.sims || []).filter((s) => s.n < d.n));
        const todo = after.find((s) => !s.taken);
        const again = after.find((s) => s.taken && s.mistakes);
        // (a kid whose Dorado is still closed can't take a simulation alone yet: no «Hacer» then; since 2026-10-18 the
        // teacher opens every simulation in class: `solo` false, no «Hacer» for a kid at all)
        if (todo && d.dorado !== false && d.solo !== false) next = '<a class="gd-btn gd-btn-gold" href="' + esc((/^hsk\d/.test(todo.id) ? '/hsk-sim.html?sim=' : '/yct-sim.html?sim=') + encodeURIComponent(todo.id)) + '">Hacer el Simulacro ' + todo.n + '</a>';
        else if (again) next = '<a class="gd-btn gd-btn-red" href="/audios/' + esc(d.slug) + '/libro/' + again.n + '" data-nav>Repasar el Simulacro ' + again.n + '</a>';
      }
      return '<section class="gd-zero" aria-labelledby="gd-zero-t"><div class="gd-zero-head"><span class="gd-zero-coin" aria-hidden="true"><b>' + q + '</b>' + I.check + '</span>' +
        '<h2 class="gd-zero-t" id="gd-zero-t">' + (kid ? 'Las ' + q + ', todas bien' : '¡Las ' + q + ', todas bien!') + '</h2></div>' +
        friendHtml('libro', 'is-cheer') + (next ? '<p class="gd-zero-next">' + next + '</p>' : '') + '</section>';
    }
    const wrong = new Set(m.wrong);
    const cards = [];
    parts.forEach((p) => p.items.forEach((it) => {
      if (wrong.has(it.q)) cards.push(cardHtml(it, { pics: media.pics, clips: media.clips, part: p, yours: m.given[it.q] || null, whose: d.who }));
    }));
    const n = cards.length;
    const title = kid ? (n === 1 ? 'Su error' : 'Sus ' + n + ' errores') : (n === 1 ? 'Repasa tu error' : 'Repasa tus ' + n + ' errores');
    return '<section class="gd-miss" aria-labelledby="gd-miss-t"><h2 class="au-h2 gd-h2" id="gd-miss-t">' + esc(title) + '</h2>' +
      (kid ? '' : friendHtml('repaso', 'is-small')) + '<div class="gd-cards">' + cards.join('') + '</div></section>';
  }
  function draw(main, d, de) {
    const sim = d.sim;
    const media = { pics: sim.pics, clips: sim.clips };
    const kid = d.who === 'teacher-kid';
    const sub = kid ? 'El repaso de ' + d.kid.name + (d.mine ? '' : ': todavía no hizo este simulacro')
      : (d.who === 'teacher' ? 'Vista de maestro: todas las respuestas' : sim.questions + ' preguntas, con la respuesta en dorado');
    const ex = d.examples && d.examples.parts && d.examples.parts.length
      ? '<details class="gd-ex"><summary><span class="gd-ex-t">Así es el examen</span><span class="gd-ex-s">Un ejemplo resuelto de cada parte</span></summary>' +
        d.examples.parts.map((p) => partHtml(p, d.examples, true)).join('') + '</details>' : '';
    // mistakes first (his pick): the book opens on «Repasa tus N errores», then the kid's results, then the whole simulation
    main.innerHTML = headHtml(d, sub) + simsNav(d, de) + mistakesHtml(d, sim.parts, media) + resultsHtml(d, sim.parts) + ex +
      '<h2 class="au-h2 gd-h2" id="gd-all">' + (d.mine ? 'El simulacro completo' : 'Las ' + sim.questions + ' preguntas') + '</h2>' +
      sim.parts.map((p) => partHtml(p, media, false)).join('') + pdfHtml(d);
    // the zero-mistakes moment: the friend's bubble arrives once (reduced motion: it simply shows)
    const z = main.querySelector('.gd-zero .rd-friend');
    if (z && z.animate && !calm()) {
      try { z.animate([{ opacity: 0, transform: 'translateY(8px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 120, easing: 'cubic-bezier(.23, 1, .32, 1)', fill: 'backwards' }); } catch (_) {}
    }
  }
  // (an older iPhone has no <dialog>: the element is then shown and hidden by its attribute)
  function closeZoom() {
    if (!zoomEl) return;
    try { if (typeof zoomEl.close === 'function') zoomEl.close(); else zoomEl.removeAttribute('open'); } catch (_) { zoomEl.removeAttribute('open'); }
  }
  // a photo bigger, on a tap (the three options of a question are small on a phone)
  function zoom(img) {
    if (!zoomEl) {
      zoomEl = document.createElement('dialog');
      zoomEl.className = 'gd-zoom';
      zoomEl.innerHTML = '<button type="button" class="gd-zoom-x" aria-label="Cerrar">' + I.close + '</button><div class="gd-zoom-ph"></div>';
      zoomEl.addEventListener('click', closeZoom);
      document.body.appendChild(zoomEl);
    }
    const fig = img.closest('figure');
    const box = zoomEl.querySelector('.gd-zoom-ph');
    box.innerHTML = '';
    const copy = fig.cloneNode(true);
    copy.className = fig.className.replace(/\bgd-(opt|small|galph)\b/g, '') + ' is-zoomed';
    const ci = copy.querySelector('img');
    if (ci) { ci.removeAttribute('loading'); ci.removeAttribute('data-zoom'); }
    box.appendChild(copy);
    if (typeof zoomEl.showModal === 'function') zoomEl.showModal(); else zoomEl.setAttribute('open', '');
  }
  function wire(main) {
    main.addEventListener('click', (e) => {
      const b = e.target.closest('.gd-play');
      if (b) { toggle(b); return; }
      const img = e.target.closest('img[data-zoom]');
      if (img && img.closest('.gd-card')) zoom(img);
    });
  }

  function render(main, ctx, m, n) {
    leave();
    document.body.classList.add('au-is-gold');
    document.title = 'El libro dorado · ' + m.name + ' · Dralingo';
    main.innerHTML = '<p class="au-loading">Abriendo tu libro dorado…</p>';
    if (!main.dataset.gdWired) { main.dataset.gdWired = '1'; wire(main); }
    const at = screen;
    const de = new URLSearchParams(location.search).get('de') || '';
    fetchJson('/api/golden/' + encodeURIComponent(m.slug) + '/' + encodeURIComponent(n) + (de ? '?de=' + encodeURIComponent(de) : '')).then(({ status, d }) => {
      if (at !== screen) return;                       // the kid moved on meanwhile: draw nothing
      if (status === 401) { location.reload(); return; }   // the key was closed meanwhile: the key screen
      const base = Object.assign({ slug: m.slug, name: m.name, n: Number(n) }, d || {});
      if (status === 429) {   // many books opened at once on one address: a short wait, then the same page
        main.innerHTML = '<p class="au-error">Muchos libros abiertos a la vez. Espera un momento…</p><p style="text-align:center"><button type="button" class="gd-btn gd-btn-red" id="gd-retry">Volver a intentar</button></p>';
        main.querySelector('#gd-retry').addEventListener('click', () => render(main, ctx, m, n));
        const t = setTimeout(() => { if (at === screen) render(main, ctx, m, n); }, 20000);
        void t;
        return;
      }
      if (!d || (!d.ok && !d.why)) {
        main.innerHTML = '<p class="au-error">No se pudo abrir el libro. Revisa tu internet.</p><p style="text-align:center"><button type="button" class="gd-btn gd-btn-red" id="gd-retry">Volver a intentar</button></p>';
        main.querySelector('#gd-retry').addEventListener('click', () => render(main, ctx, m, n));
        return;
      }
      if (!d.ok) {
        if (d.why === 'login') {
          return stateCard(main, base, { sub: 'Tu repaso de cada simulacro', title: 'Entra con tu código para ver tu libro dorado',
            text: 'Tu libro dorado guarda tus respuestas: se abre en tu cuenta, después de hacer cada simulacro.',
            btn: '<a class="gd-btn gd-btn-red" href="/homework.html?next=' + encodeURIComponent('/audios/' + m.slug + '/libro/' + Number(n)) + '">Entrar con mi código</a>' });
        }
        if (d.why === 'dorado') {
          return stateCard(main, base, { nav: true, sub: 'Tu repaso de cada simulacro', title: 'Primero, El Simulacro Dorado',
            text: 'Se abre cuando practiques cada mundo de El Entrenamiento con ' + (Number(d.pct) || 70) + ' % o más. Después haces el simulacro y lo repasas aquí.',
            btn: '<a class="gd-btn gd-btn-gold" href="/audios/' + esc(m.slug) + '#paso-3" data-nav>Ver mi ruta</a>', dragon: DRAGON.power });
        }
        // 🔒 2026-10-18: El Simulacro Dorado is the teacher's (server.js DORADO_SELF_SERVE off): a simulation not taken
        // yet is taken in class, with the teacher's PIN; its book opens here right after
        if (d.why === 'clase') {
          return stateCard(main, base, { nav: true, sub: 'Tu repaso de cada simulacro', title: 'El Simulacro ' + base.n + ' lo haces en clase',
            text: 'Tu profe lo abre en clase con un PIN. Cuando lo termines, su libro dorado se abre aquí con tus errores primero.',
            btn: '<a class="gd-btn gd-btn-gold" href="/audios/' + esc(m.slug) + '#paso-3" data-nav>Ver mi ruta</a>', dragon: DRAGON.power });
        }
        if (d.why === 'taken') {
          return stateCard(main, base, { nav: true, sub: 'Tu repaso de cada simulacro', title: 'Haz el Simulacro ' + base.n + ' y después repásalo aquí',
            text: 'El simulacro es tu examen de verdad. Al terminarlo, su libro dorado se abre con tus errores primero.',
            btn: d.player ? '<a class="gd-btn gd-btn-gold" href="' + esc(d.player) + '">Hacer el Simulacro ' + base.n + '</a>' : '' });
        }
        if (d.why === 'link') {
          return stateCard(main, base, { sub: 'Vista de maestro', title: 'Este enlace no se puede abrir aquí',
            text: 'Puede que haya vencido (dura un día) o que este alumno no sea de tu clase. Ábrelo otra vez desde su perfil en /maestro.',
            btn: '<a class="gd-btn gd-btn-red" href="/maestro.html">Ir a /maestro</a>' });
        }
        if (d.why === 'teacher') {
          // a teacher's «Ver su libro» in a browser that is no teacher's yet: the /maestro code this browser keeps
          // remembers it as a teacher's (once), then the same page; else, a way to /maestro
          let code = '';
          try { code = localStorage.getItem('mochi.maestroPw') || localStorage.getItem('dralyMaestroPw') || ''; } catch (_) { code = ''; }
          if (code && !render.triedTeacher) {
            render.triedTeacher = true;
            fetch('/api/teacher-device', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'X-Admin-Pw': encodeURIComponent(code) } })
              .then((r) => { if (at === screen) render(main, ctx, m, n); return r; }, () => { if (at === screen) render(main, ctx, m, n); });
            return;
          }
          return stateCard(main, base, { sub: 'Vista de maestro', title: 'Abre este enlace donde entraste a /maestro',
            text: 'El libro de un alumno se abre en el teléfono o la computadora donde usas /maestro.',
            btn: '<a class="gd-btn gd-btn-red" href="/maestro.html">Ir a /maestro</a>' });
        }
      }
      document.title = 'Simulacro ' + d.n + ' · El libro dorado · ' + d.name + ' · Dralingo';
      try {
        draw(main, d, de);
        // after a tap inside the page, the heading takes the focus (screen readers hear where they are)
        const h = ctx && ctx.focus ? main.querySelector('h1') : null;
        if (h) { try { h.focus({ preventScroll: true }); } catch (_) {} }
      } catch (e) {
        console.error('[golden] the book could not be drawn', e);
        main.innerHTML = '<p class="au-error">Algo salió mal. Vuelve a intentarlo.</p>';
      }
    });
  }

  window.GoldenBook = { render, leave };
})();
