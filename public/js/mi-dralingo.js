// =========================================================================
// mi-dralingo.js · «Mi Dralingo» part 3: THE KID'S HOME on /homework (his approved design 2026-10-18, «ALL IS GOOD, YOU
// HAVE MY OKAY»: .claude/handoff/kidhome-design/Main.dc.html (laptop), Phone, Experiencia, Mensajes, Oraciones, Desafio,
// Perfil + ASSETS.md). His words: «completely functional… every button, every touch of interaction makes sense».
// =========================================================================
//   the band     the kid's avatar (→ Mi perfil), «¡Hola, <nombre>!», «N días seguidos» (a day counts with a real step:
//                core/student-records.js streakOf) and the level, «Papás» (part 2), «Mi perfil»
//   «Hoy»        the current experience's scene, Dralingo pointing and ONE direct instruction from js/papas-plan.js
//                today() (review 2026-10-18: the current experience = the first one not done, and inside it the ladder
//                1 Palabras → 2 Práctica → 3 Tu tarea; a homework due elsewhere is a reminder line + the red badges;
//                Papás reads the same plan in a parent's order, homework first; La Ruta Dorada's module page says the
//                same, js/ruta.js). Its button names what it does («Marcar mis palabras», «Practicar aquí», «Mandar mi
//                tarea», «Avisar a mi profe», «Ver mi libro dorado») and opens that experience at that step. Right
//                under it, one line «De tu profe»: the teacher's tareas of no experience (custom tareas).
//   La Ruta      the level's experiences as a path of scene cards (8 for New HSK 1 and HSK 1, 6 for YCT 1): number, word
//                sticker, three little bars (palabras · práctica · tarea; a dotted third = no homework yet, YCT 1 has
//                two), done = green ✓, today's glows gold with «¡Empieza aquí!», the rest calm; «N de M listas»; it ends
//                at El Simulacro Dorado (✓ «Aprobado» once passed, «Avisa a tu profe» when ready). A laptop
//                (≥ 1000 px) shows it as a grid with the chosen experience beside it; a phone as a zig-zag whose cards open
//                the experience's own page.
//   experience   1 Palabras (its world of La Base: seals «N de M marcadas», a few word pictures, the base at #mundo-N)
//                → 2 Práctica (its world of El Entrenamiento, best % vs the goal, «Practicar aquí») → 3 Tu tarea (its
//                homework audios: «Escuchar», «¡Ya la mandé!», «Deshacer», the SAME code as La Ruta Dorada's «Tus
//                tareas», js/ruta.js Ruta.hwCards; Aileen's line in voseo; none in a level with no homework audio).
//                Each number once, in its circle; a step that can't open yet = a lock and one line, no button. After
//                the steps, «Preguntas de tu profe»: the teacher's tareas of THIS experience (YCT 1's game rounds of the
//                world, HSK 1's sentence tarea and its «Preguntas del simulacro»). Everything done and nothing new from
//                the teacher: Aileen and Dralingo celebrate.
//   El Simulacro Dorado   class mode (the teacher runs it with a PIN): ✓ «Aprobado», or «¡Ya estás listo!» +
//                «Avisar a mi profe» (WhatsApp / copy); «Tus simulacros» (each class simulation, its latest try and its
//                libro dorado); ONE folder «De tu profe · Practica el examen» (Simulacro del examen, the teacher's
//                Simulacro rounds, HSK 1's reading tests with «Ver mis errores»); how it opens, under them.
//   Mensajes · Mis oraciones · Desafío del día («Muy pronto», DESAFIO_LIVE = false keeps the old daily challenge)
//                tabs at the bottom on a phone, a dock under the path on a laptop.
// Views by the address's hash (a real link everywhere, never history): '' · #exp-N · #dorado · #mensajes · #oraciones ·
// #desafio · #perfil (Mi perfil is homework.html's #screen-settings, homework.js fills it). Every view has its «Volver».
// Data: GET /api/homework/home (server.js: only the kid's own session sees `ruta`) + homework.js's hooks (the kid, their
// tareas, the inbox, the players). This phone's marks not saved yet count (js/papas.js withPhone, js/ruta.js's mirror),
// so the home, Papás and La Ruta Dorada never disagree. No code on screen here (Mi perfil only), no hanzi, no em dash.
// =========================================================================
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const calm = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const wide = () => !!(window.matchMedia && matchMedia('(min-width: 1000px)').matches);
  const ss = {
    get(k) { try { return sessionStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (_) {} },
    del(k) { try { sessionStorage.removeItem(k); } catch (_) {} },
  };
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
  };

  // 🎮 «Desafío del día» shows «Muy pronto» until the pin games become daily challenges (his words 2026-10-18: "the games
  // already made will become games for daily challenges, so leave it there"). true = the old daily challenge
  // (homework.js openDaily: the mini-game, swords, the streak) opens again from the tab.
  const DESAFIO_LIVE = false;

  // ── the design's pictures (ASSETS.md) ─────────────────────────────
  const A = '/assets/';
  const ART = {
    point: A + 'dralingo/point.webp', power: A + 'dralingo/power.webp', star: A + 'dralingo/star-hold.webp', hello: A + 'dralingo/hello.webp',
    dubai: A + 'paint/dubai/bg.webp', dubaiS: A + 'scenes/dubai-s.webp',
    aileenTalk: A + 'cast/aileen-talk.webp', aileenHello: A + 'cast/aileen-hello.webp', aileenWin: A + 'halcon/cast/aileen-victory.webp',
    dralingoWin: A + 'halcon/cast/dralingo-victory.webp', ferHello: A + 'cast/fer-hello.webp', ferCheer: A + 'cast/fer-cheer.webp',
    hamdan: A + 'cast/hamdan-cheer.webp', dragon: A + 'dragon/fly-blue-mid.webp', jet: A + 'escape/jet.webp', panda: A + 'paint/muralla/panda.webp',
    shanghaiS: A + 'scenes/shanghai-s.webp', shanghai: A + 'paint/shanghai/bg.webp',
  };
  // each experience's scene is Papás' (js/papas.js sceneOf: one choice for both pages); «Hoy» on a laptop takes the big one
  const BIG = {
    'escape/jardin/bg-s.webp': 'escape/jardin/bg.webp', 'escape/museo/bg-s.webp': 'escape/museo/bg.webp', 'escape/mercado/bg-s.webp': 'escape/mercado/bg.webp',
    'escape/fuente/bg-s.webp': 'escape/fuente/bg.webp', 'escape/muralla/bg-s.webp': 'escape/muralla/bg.webp', 'escape/pista/bg-s.webp': 'escape/pista/bg.webp',
    'scenes/shanghai-s.webp': 'paint/shanghai/bg.webp', 'scenes/templo-s.webp': 'trapdoor/templo/bg.webp', 'scenes/luna-s.webp': 'trapdoor/luna/bg.webp',
    'scenes/rio-s.webp': 'paint/rio/bg.webp', 'scenes/dubai-s.webp': 'paint/dubai/bg.webp',
    'scenes/deportes-s.webp': 'scenes/deportes.webp', 'scenes/magia-s.webp': 'scenes/magia.webp', 'scenes/espejo-s.webp': 'scenes/espejo.webp', 'scenes/numeros-s.webp': 'scenes/numeros.webp',
  };
  const sceneOf = (slug, n) => (window.DralyPapas && window.DralyPapas.sceneOf ? window.DralyPapas.sceneOf(slug, n) : A + 'escape/jardin/bg-s.webp');
  const bigOf = (src) => { const k = String(src || '').replace(A, ''); return BIG[k] ? A + BIG[k] : src; };
  // the phone's zig-zag: each card's sideways step, as a share of its own width
  const ZZ = ['-21%', '16%', '32%', '16%', '-21%', '-37%', '-21%', '16%'];

  const svg = (d, o) => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"' + (o || ' fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"') + '>' + d + '</svg>';
  const I = {
    back: svg('<path d="M15 18l-6-6 6-6"/>'),
    go: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', ' fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"'),
    lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    fire: svg('<path d="M12 2c1 3.5-1.5 5-1.5 7.5 0 1.4 1 2.5 2.3 2.5 1.4 0 2.2-1.1 2.2-2.6 0-.8-.2-1.5-.5-2.1C17 9 19 11.6 19 14.8 19 18.8 15.9 22 12 22s-7-3.2-7-7.2C5 9.6 9.5 7.2 12 2z"/>', ' fill="currentColor"'),
    family: svg('<circle cx="8" cy="8" r="3.2"/><circle cx="17" cy="9.5" r="2.4"/><path d="M2.5 20c.6-3.4 2.8-5.4 5.5-5.4s4.9 2 5.5 5.4M14 19.5c.4-2.4 1.8-3.9 3.5-3.9s3.1 1.5 3.5 3.9"/>'),
    user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.2 4-6.5 8-6.5s7 2.3 8 6.5"/>'),
    home: svg('<path d="M12 3l9 7.5V21h-6v-6H9v6H3V10.5z"/>', ' fill="currentColor"'),
    chat: svg('<path d="M4 5h16v11H9l-5 4z"/>'),
    pen: svg('<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>'),
    star: svg('<path d="M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/>', ' fill="currentColor"'),
    play: svg('<path d="M8 5.5v13l11-6.5z"/>', ' fill="currentColor"'),
    copy: svg('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
    wa: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2.2a9.7 9.7 0 0 0-8.4 14.6L2.3 21.7l5-1.3A9.7 9.7 0 1 0 12 2.2zm0 17.7a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 19.9zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8.9c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.7-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.2-.2-.4-.3z"/></svg>',
    book: svg('<path d="M2.5 5.2c2.9-1.2 6-1 8.8.9v13.4c-2.8-1.8-5.9-2-8.8-.9zM21.5 5.2c-2.9-1.2-6-1-8.8.9v13.4c2.8-1.8 5.9-2 8.8-.9z"/>', ' fill="currentColor"'),
    // 🪙 El Zoco's coin (the design's: gold with a star; the small one without)
    coin: '<svg class="md-coin" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><circle cx="16" cy="16" r="14" fill="#e8c878" stroke="#b88b2c" stroke-width="2.5"/><circle cx="16" cy="16" r="9" fill="none" stroke="#b88b2c" stroke-width="1.8"/><path d="M16 10.5l1.7 3.5 3.8.5-2.8 2.6.7 3.8L16 19l-3.4 1.9.7-3.8-2.8-2.6 3.8-.5z" fill="#b88b2c"/></svg>',
    coinS: '<svg class="md-coin" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><circle cx="16" cy="16" r="14" fill="#e8c878" stroke="#b88b2c" stroke-width="2.5"/><circle cx="16" cy="16" r="9" fill="none" stroke="#b88b2c" stroke-width="1.8"/></svg>',
    fwd: svg('<path d="M9 6l6 6-6 6"/>'),
  };

  let H = null;          // homework.js's hooks (HOME): the kid, their tareas, the players
  let D = null;          // GET /api/homework/home
  let M = null;          // the model on screen
  let ctxR = null;       // js/ruta.js's context for the homework cards (the kid's account mirror)
  let view = { kind: 'home' };
  let loadSeq = 0, loadedAt = 0, failed = false;
  let cards = null;      // the homework cards on screen (Ruta.hwCards)
  let focusStep = 0;     // «Empezar aquí»: the step to bring forward once the experience is drawn
  let sentAt = 0, examsAt = 0;   // when Mis oraciones / Mis exámenes were last asked for

  // ═══════════════════════════════════════════════════════════════════
  // the model (pure: the server's answer + homework.js's state → what the screens say). scripts/test-home.js runs it.
  // ═══════════════════════════════════════════════════════════════════
  // the teacher's tareas, each in its place: an experience (YCT 1's game rounds of world N, an «EXPn» tarea, HSK 1's
  // Sim-Trainer tier of EXPn), El Simulacro Dorado (the exam's practice rounds, the reading tests), or «De tu profe»
  // under «Hoy» (a custom tarea, anything of no experience). Nothing the old folders showed is left out.
  const PASS = 80;
  // a tarea's name as a parent reads it: no «EXP1 ·» code, no emoji or symbol in front
  const plainTitle = (t) => String(t || '').replace(/^[^0-9A-Za-zÀ-ÿ¡¿«]+/, '').replace(/^EXP\s*\d+\s*[·:.-]\s*/i, '').trim();
  function mapTareas(d, s) {
    const out = { byExp: {}, dorado: [], loose: [], readings: [] };
    if (!s) return out;
    const r = d && d.ruta;
    // a game round's world → its experience: the server's experiences (the pack's regular worlds in order), else the
    // folders' order (the same pack, the same order)
    const worldN = {};
    if (r && Array.isArray(r.exps) && r.exps.some((e) => e.world)) r.exps.forEach((e) => { if (e.world) worldN[e.world] = Number(e.n); });
    else if (Array.isArray(s.folders)) s.folders.filter((f) => f && f.id !== 'simulacro' && f.id !== 'pinyin').forEach((f, i) => { worldN[f.id] = i + 1; });
    const subs = Array.isArray(s.submissions) ? s.submissions : [];
    // (review 2026-10-18) an «EXPn» above the level's experiences (a typo, another level's tarea) goes to «De tu profe»
    // under «Hoy», never to a bucket nobody draws
    const maxN = r && Array.isArray(r.exps) && r.exps.length ? r.exps.length
      : Array.isArray(s.folders) ? s.folders.filter((f) => f && f.id !== 'simulacro' && f.id !== 'pinyin').length : 0;
    const push = (n, it) => { if (maxN && (n < 1 || n > maxN)) { out.loose.push(it); return; } (out.byExp[n] || (out.byExp[n] = [])).push(it); };
    (Array.isArray(s.assignments) ? s.assignments : []).forEach((a, k) => {
      if (!a || !a.id) return;
      const att = subs.filter((x) => x.assignmentId === a.id);
      const tot = (x) => Number(x.total) || Number(a.totalPoints) || (a.itemCount ? a.itemCount * 20 : 100);
      const passed = att.some((x) => tot(x) > 0 && Number(x.score) * 100 >= tot(x) * PASS);
      const pct = att.length ? Math.round(Math.max.apply(null, att.map((x) => (Number(x.score) / tot(x)) * 100))) : null;
      const lab = String(a.expLabel || '');
      const quiz = a.type === 'pack-quiz';
      // (review 2026-10-18: words a parent can read: never «EXP1» or an emoji in front)
      const title = plainTitle(a.title) || 'Tarea';
      const it = { kind: 'asg', id: a.id, order: k, type: a.type || 'sentence-building',
        title: quiz && lab !== 'simulacro' ? title.replace(/^.+? · /, '') : title,
        sub: quiz ? a.itemCount + ' preguntas' : a.type === 'word-sack' ? 'Bolsa de palabras' : a.itemCount + ' oraciones',
        status: passed ? 'done' : att.length ? 'retry' : 'new', pct, tried: att.length > 0 };
      const m = /^exp\s*(\d+)$/i.exec(lab);
      if (lab === 'simulacro') out.dorado.push(it);
      else if (m) push(Number(m[1]), it);
      else if (worldN[lab]) push(worldN[lab], it);
      else out.loose.push(it);
    });
    // HSK 1's Sim-Trainer (questions of the 10 simulations): each tier of an experience is a card of that experience
    const tm = s.trainer;
    if (tm && Array.isArray(tm.tiers)) {
      const passPct = Number(tm.passPct) || PASS;
      tm.tiers.forEach((tier) => {
        const row = (tm.matrix || {})['t' + tier.tier] || {};
        Object.keys(row).forEach((exp) => {
          const m = /^exp(\d+)$/.exec(exp);
          if (!m || !(Number(row[exp]) > 0)) return;
          const id = 'trainer-t' + tier.tier + '-' + exp;
          const best = subs.filter((x) => x.assignmentId === id).reduce((b, x) => Math.max(b, Number(x.score) || 0), -1);
          // (review 2026-10-18: «Preguntas del simulacro · Palabras y audio», never «Tier 1» or «Simulación»)
          push(Number(m[1]), { kind: 'trainer', id, tier: tier.tier, exp, order: 1000 + Number(tier.tier),
            title: 'Preguntas del simulacro · ' + (plainTitle(String(tier.title || '').replace(/^\s*tier\s*\d+\s*[·:.-]?\s*/i, '')) || 'Parte ' + tier.tier),
            sub: row[exp] + ' preguntas',
            status: best < 0 ? 'new' : best >= passPct ? 'done' : 'retry', pct: best < 0 ? null : best, tried: best >= 0 });
        });
      });
    }
    // the teacher's own tareas for this kid (custom): no experience, «De tu profe» under «Hoy»
    (Array.isArray(s.custom) ? s.custom : []).forEach((c) => {
      const a = c && c.a;
      if (!a || !a.id) return;
      const pct = c.best && c.best.total ? Math.round((Number(c.best.score) / Number(c.best.total)) * 100) : null;
      out.loose.push({ kind: 'custom', id: a.id, order: -1, title: plainTitle(a.title) || 'Tarea especial', sub: (a.itemCount || 0) + ' oraciones',
        status: c.status === 'done' ? 'done' : c.status === 'pending' ? 'retry' : 'new', pct, tried: !!c.best });
    });
    out.readings = (Array.isArray(s.readings) ? s.readings : []).filter((x) => x && x.storyId);
    Object.keys(out.byExp).forEach((n) => out.byExp[n].sort((x, y) => x.order - y.order));
    return out;
  }
  // d = the server's answer, s = homework.js's state, marks = this phone's view of the homework marks ({ id: { h, s } }:
  // js/ruta.js's mirror, newer than d) → the model every screen draws
  function model(d, s, marks) {
    const Plan = window.DralyPapasPlan;
    const tareas = mapTareas(d, s);
    const levelName = (d && d.levelName) || (s && s.levelName) || '';
    const base0 = { ruta: false, levelName, slug: (d && d.slug) || '', tareas, exps: [], hoy: null, doneN: 0, streak: (d && d.streak) || { days: 0, today: false } };
    const r0 = d && d.ruta;
    if (!r0 || !Plan) return base0;
    const mk = Object.assign({}, r0.marks || {}, marks || {});
    const r1 = Object.assign({}, r0, { hws: (r0.hws || []).map((h) => Object.assign({}, h, { sent: mk[h.id] ? !!mk[h.id].s : !!h.sent })) });
    const r = window.DralyPapas && window.DralyPapas.withPhone ? window.DralyPapas.withPhone(r1) : r1;
    (r.hws || []).forEach((h) => { if (h.sent) mk[h.id] = Object.assign({}, mk[h.id] || {}, { h: 1, s: 1 }); });
    const p = Plan.plan(r);
    const t = Plan.today(p);
    const slug = r.slug || d.slug;
    const media = r.media || {};
    const hwsAll = (r.hws || []).map((h) => Object.assign({ level: slug }, media[h.id] || {}, h));
    const exps = p.exps.map((e) => {
      const x = (r.exps || []).find((y) => Number(y.n) === e.n) || {};
      const hws = hwsAll.filter((h) => Number(h.exp) === e.n).sort((a, b) => (a.round || 0) - (b.round || 0));
      const heard = hws.some((h) => mk[h.id] && (mk[h.id].h || mk[h.id].s));
      const bars = {
        words: e.count > 0 && e.sealed >= e.count ? 'done' : e.sealed > 0 ? 'half' : 'none',
        practice: e.best != null && e.best >= p.goal ? 'done' : e.best != null ? 'half' : 'none',
        tarea: !hws.length ? 'na' : e.hw.sent >= e.hw.of ? 'done' : (heard || e.hw.sent > 0) ? 'half' : 'none',
      };
      const order = [['words', 1], ['practice', 2]].concat(hws.length ? [['tarea', 3]] : []);
      const first = order.find((o) => bars[o[0]] !== 'done');
      const next = t && !t.dorado && t.exp === e.n && t.step ? t.step : (first ? first[1] : 0);
      const teacher = tareas.byExp[e.n] || [];
      return { n: e.n, name: e.name, pic: x.pic || e.pic || '', peek: Array.isArray(x.peek) ? x.peek : [], scene: sceneOf(slug, e.n),
        sealed: e.sealed, count: e.count, best: e.best, open: !!e.open, train: e.train || null, hws, bars, next,
        left: hws.filter((h) => !(mk[h.id] && mk[h.id].s)).length, done: !!e.done,
        today: !!(t && !t.dorado && t.exp === e.n), started: bars.words !== 'none' || bars.practice !== 'none' || bars.tarea === 'half' || bars.tarea === 'done',
        teacher, teacherNew: teacher.filter((x) => x.status !== 'done').length };
    });
    if (t && !t.dorado && !exps.some((e) => e.today)) { const c = exps.find((e) => e.n === p.current); if (c) c.today = true; }
    const open = r.open !== false;
    const books = Array.isArray(r.books) ? r.books : [];
    const teacherReady = !!(r.dorado && r.dorado.teacher);
    const ready = !!(p.trainDone || teacherReady);
    const passed = !!(p.sim && p.sim.passed);
    // «Hoy»: today() (the kid's ladder; Papás reads the same plan); its button says what it does; a level this phone can't
    // open yet asks for its key first
    let hoy = null;
    if (!open) hoy = { kind: 'key', text: 'Escribe la clave de ' + levelName + ' para abrir tu Ruta Dorada.', href: r.key || '', go: 'Escribir la clave', exp: null, step: 0, dorado: false, remind: null };
    else if (t) {
      hoy = Object.assign({}, t);
      // («Ver mi libro dorado» opens the book of the simulation it names)
      if (t.kind === 'fine' && t.dorado && p.sim) { const b = books.find((x) => x.n === p.sim.n && x.book); if (b) hoy.href = b.book; }
      if (t.kind === 'teacher') hoy.wa = true;
    }
    return Object.assign(base0, {
      ruta: true, slug, name: r.name || levelName, open, key: r.key || '', route: r.route || '/audios/' + slug, base: r.base || null,
      plan: p, today: t, hoy, exps, doneN: exps.filter((e) => e.done).length, goal: p.goal, sim: p.sim,
      // El Simulacro Dorado: passed (✓ «Aprobado»), ready (El Entrenamiento done: «Avisa a tu profe»), or on its way
      dorado: { ready, passed, tell: ready && !passed, practiced: exps.filter((e) => e.bars.practice === 'done').length },
      books, extra: r.extra || {}, hws: hwsAll, marks: mk, anyHw: hwsAll.length > 0,
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // the data
  // ═══════════════════════════════════════════════════════════════════
  // js/ruta.js's context: this kid's account (who), their level's homework marks; a mark saved there asks again here
  function ctxOf(d) {
    const r = d && d.ruta;
    if (!r || !r.who) return null;
    const list = (r.hws || []).map((h) => Object.assign({ level: r.slug }, (r.media || {})[h.id] || {}, h));
    return {
      ruta: { ok: true, student: true, teacher: false, who: r.who, home: r.slug, modules: [{ slug: r.slug, id: d.level, tareas: Object.assign({}, r.marks || {}) }] },
      homeworksOf: (slug) => (slug === r.slug ? list : []),
      refresh: () => load(true),
    };
  }
  const modOf = () => (ctxR && ctxR.ruta.modules[0]) || null;
  // this phone's marks of the level's homework (the account's mirror: a «¡Ya la mandé!» shows at once)
  function marksNow() {
    const m = modOf();
    if (!m || !window.Ruta || !window.Ruta.marksFor) return null;
    try { return window.Ruta.marksFor(ctxR, m); } catch (_) { return null; }
  }
  function load(force) {
    if (!H) return Promise.resolve();
    const s = H.state();
    if (!s.code) return Promise.resolve();
    if (!force && D && D.__code === s.code && Date.now() - loadedAt < 15000) return Promise.resolve();
    const seq = ++loadSeq;
    // (review 2026-10-18: the phone's time zone: «N días seguidos» on the kid's own calendar, never UTC)
    let tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (_) { tz = ''; }
    // (🪙 zs: what this phone already showed of El Zoco's coins, by the server's clock: the newer ones pop once)
    const zs = seenAt() || (Date.now() - 10 * 60000);
    const url = '/api/homework/home?accessCode=' + encodeURIComponent(s.accessCode || '') + '&studentCode=' + encodeURIComponent(s.code) +
      (tz ? '&tz=' + encodeURIComponent(tz) : '') + '&zs=' + zs;
    return fetch(url, { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => r.json().catch(() => null), () => null)
      .then((d) => {
        if (seq !== loadSeq) return;
        if (d && d.ok) {
          D = d;
          Object.defineProperty(D, '__code', { value: s.code });
          loadedAt = Date.now();
          ctxR = ctxOf(d);
          failed = false;
          // 🪙 the coins pill follows the server; coins that came in since this phone last looked pop once
          if (d.zoco) { if (Z && Z.student && zFor === s.code) Z.coins = d.zoco.coins; newsMoment(d.zoco.news, d.zoco.now); }
        } else failed = !D;
        if (H && H.screen() === 'list') redraw();
      });
  }
  // a fresh answer, a new message, a tarea handed in: draw again, except over a homework audio that is playing (review
  // 2026-10-18: load() → draw() stopped it mid-sentence): then only the numbers move (soft)
  function redraw() {
    const p = $('au-player');
    if (p && !p.paused && cards) { soft(); return; }
    draw();
  }

  // ═══════════════════════════════════════════════════════════════════
  // the screens
  // ═══════════════════════════════════════════════════════════════════
  function parse(hash) {
    const h = String(hash || '').replace(/^#/, '');
    let m = /^exp-(\d{1,2})$/.exec(h);
    if (m) return { kind: 'exp', n: Number(m[1]) };
    if (['dorado', 'mensajes', 'oraciones', 'desafio', 'perfil'].indexOf(h) >= 0) return { kind: h };
    // 🪙 El Zoco de Dralingo (2026-10-19): the shop, a character, «¿Cómo gano monedas?», «¡Ya es tuyo!», «Elige tu personaje»
    if (h === 'zoco' || h === 'monedas' || h === 'personaje') return { kind: h };
    m = /^(zoco|tuyo)-([a-z0-9-]{2,40})$/.exec(h);
    if (m) return { kind: m[1] === 'zoco' ? 'item' : 'tuyo', id: m[2] };
    return { kind: 'home' };
  }
  const ZOCO_VIEWS = ['zoco', 'item', 'monedas', 'tuyo', 'personaje'];
  const isZoco = (v) => ZOCO_VIEWS.indexOf(v && v.kind) >= 0;
  const daysText = (n) => (n === 1 ? '1 día seguido' : n + ' días seguidos');
  // «85 %» never splits over two lines (a no-break space; hw-i18n.js reads it as a space)
  const nb = (x) => String(x).replace(/(\d) %/g, '$1 %');
  // the three little bars (palabras · práctica · tarea): green done, gold started, grey to do; an experience whose homework
  // hasn't come yet shows its third bar dotted («pronto»), a level with no homework audio at all (YCT 1) only two
  const barsHtml = (b, n, label) => '<span class="md-bars" data-bars="' + n + '" aria-label="' + esc(label || barsSay(b)) + '" role="img">' +
    ['words', 'practice', 'tarea'].filter((k) => k !== 'tarea' || b.tarea !== 'na' || (M && M.anyHw)).map((k) => '<i class="is-' + b[k] + '"></i>').join('') + '</span>';
  function barsSay(b) {
    const w = { done: 'listas', half: 'empezadas', none: 'por hacer', na: 'pronto' };
    return 'Palabras ' + w[b.words] + ', práctica ' + (b.practice === 'done' ? 'lista' : b.practice === 'half' ? 'empezada' : 'por hacer') +
      (b.tarea === 'na' ? '' : ', tarea ' + (b.tarea === 'done' ? 'mandada' : b.tarea === 'half' ? 'escuchada' : 'por mandar'));
  }

  // ── the band ──
  function bandHtml(s) {
    const st = M && M.streak && M.streak.days > 0 ? M.streak : null;
    const lvl = (M && M.levelName) || s.levelName || '';
    // 🪙 the coins pill (El Zoco de Dralingo): a real pill beside Papás where the band has room, and in the small line
    // under «¡Hola!» on a narrow phone (one of the two shows, by the CSS); both open the Zoco
    const c = coinsNow();
    const pill = (cls) => (c == null ? '' : '<a class="' + cls + '" href="#zoco" aria-label="' + esc(coinsSay(c)) + '">' + I.coin + '<b data-coins>' + c + '</b></a>');
    return '<header class="md-band"><div class="md-band-in">' +
      '<a class="md-av" href="#perfil" aria-label="Mi perfil"><img src="' + esc(s.avatarUrl) + '" alt="" width="46" height="46" decoding="async"></a>' +
      '<div class="md-hi"><p class="md-hi-t">' + (s.name ? esc('¡Hola, ' + s.name + '!') : '¡Hola!') + '</p>' +
        '<p class="md-hi-s">' + (st ? '<span class="md-streak' + (st.today ? ' is-today' : '') + '">' + I.fire + '<span>' + daysText(st.days) + '</span></span>' : '') +
          '<span class="md-lvl">' + esc(lvl) + '</span>' + pill('md-coins-mini') +
          (s.name ? '' : '<a class="md-askname" href="#perfil" data-ask-name>¿Cómo te llamas?</a>') + '</p></div>' +
      '<p class="md-brand" aria-hidden="true">Mi Dralingo</p>' +
      '<div class="md-band-acts">' + pill('md-coins') + '<button type="button" class="md-papas" data-act="papas">' + I.family + '<span>Papás</span></button>' +
        '<a class="md-perfil" href="#perfil" aria-label="Mi perfil">' + I.user + '<span class="md-perfil-t">Mi perfil</span></a></div>' +
      '</div></header>';
  }

  // ── «Hoy» ──
  // (review 2026-10-18) the button names what it does («Marcar mis palabras», «Practicar aquí», «Mandar mi tarea»,
  // «Avisar a mi profe», «Ver mi libro dorado»); a homework due outside today's step rides along as one reminder line
  function waHref() { return 'https://wa.me/?text=' + encodeURIComponent(teacherMsg()); }
  function hoyHtml() {
    const h = M.hoy;
    const e = h && h.exp ? M.exps.find((x) => x.n === h.exp) : null;
    const small = h && h.dorado ? ART.dubaiS : e ? e.scene : (M.exps[0] ? M.exps[0].scene : ART.dubaiS);
    const kicker = e && h.step ? 'Hoy · Experiencia ' + e.n : h && h.dorado ? 'Hoy · El Simulacro Dorado' : 'Hoy';
    const label = h ? h.go || 'Empezar aquí' : '';
    let btn = '';
    if (h && h.kind === 'key') btn = '<a class="md-go" href="' + esc(h.href) + '"><span>' + esc(label) + '</span>' + I.go + '</a>';
    else if (h && h.wa) btn = '<a class="md-go is-wa" href="' + esc(waHref()) + '" target="_blank" rel="noopener">' + I.wa + '<span>' + esc(label) + '</span></a>';
    else if (h && h.href) btn = '<a class="md-go" href="' + esc(h.href) + '" data-out><span>' + esc(label) + '</span>' + I.go + '</a>';
    else if (h) btn = '<button type="button" class="md-go" data-act="today"><span>' + esc(label) + '</span>' + I.go + '</button>';
    // (a homework of no experience opens its own audio page)
    const rem = !h || !h.remind ? ''
      : h.remind.exp ? '<button type="button" class="md-hoy-rem" data-act="remind" data-exp="' + esc(h.remind.exp) + '"><span id="md-hoy-rem">' + esc(h.remind.text) + '</span>' + I.go + '</button>'
        : h.remind.id ? '<a class="md-hoy-rem" href="/audios/' + esc(h.remind.id) + '?from=homework" data-out><span id="md-hoy-rem">' + esc(h.remind.text) + '</span>' + I.go + '</a>' : '';
    // (the big scene only on a laptop: 30 phones in a class each take the small one)
    return '<section class="md-hoy" aria-labelledby="md-hoy-k">' +
      '<picture><source media="(min-width: 1000px)" srcset="' + esc(bigOf(small)) + '">' +
        '<img class="md-hoy-bg" src="' + esc(small) + '" alt="" decoding="async" fetchpriority="high"></picture>' +
      '<span class="md-hoy-shade" aria-hidden="true"></span>' +
      '<div class="md-hoy-in"><p class="md-hoy-k" id="md-hoy-k">' + esc(kicker) + '</p>' +
        '<p class="md-hoy-t" id="md-hoy-t">' + esc(h ? h.text : '') + '</p><div class="md-hoy-acts">' + btn + rem + '</div></div>' +
      '<img class="md-hoy-dr" src="' + ART.point + '" alt="Dralingo señala lo que toca hoy" width="332" height="480" decoding="async" fetchpriority="high">' +
      '</section>';
  }
  // a teacher's tarea: its name, its mark (Nueva / Otra vez / ✓ done = green), its button, «Ver mis errores»
  function tpGo(it) {
    const label = it.status === 'done' ? 'Otra vez' : it.status === 'retry' ? 'Seguir' : 'Hacer';
    return it.kind === 'trainer'
      ? '<button type="button" class="md-tp-go" data-act="trainer" data-tier="' + esc(it.tier) + '" data-exp="' + esc(it.exp) + '">' + label + '</button>'
      : '<button type="button" class="md-tp-go" data-assignment-id="' + esc(it.id) + '">' + label + '</button>';
  }
  const tpChip = (it) => (it.status === 'done' ? '<span class="md-tp-chip is-done">' + I.check + (it.pct != null ? it.pct + ' %' : 'Hecha') + '</span>'
    : it.status === 'retry' ? '<span class="md-tp-chip is-retry">' + (it.pct != null ? it.pct + ' %' : 'Otra vez') + '</span>'
      : '<span class="md-tp-chip is-new">Nueva</span>');
  function tpRow(it) {
    const rev = it.kind === 'asg' && it.tried ? '<button type="button" class="md-tp-rev" data-act="review" data-id="' + esc(it.id) + '" data-title="' + esc(it.title) + '">Ver mis errores</button>' : '';
    return '<li class="md-tp is-' + it.status + '"><span class="md-tp-t"><b>' + esc(it.title) + '</b><small>' + esc(it.sub) + '</small></span>' + tpChip(it) +
      '<span class="md-tp-acts">' + tpGo(it) + rev + '</span></li>';
  }
  // «De tu profe» under «Hoy» (review 2026-10-18: one line, so the path and the dock fit the first screen): the teacher's
  // own tareas of no experience. One tarea: its name and «Hacer» right there; more: «Ver» opens the list
  function stripHtml() {
    const list = M.tareas.loose;
    if (!list.length) return '';
    const todo = list.filter((x) => x.status !== 'done');
    const done = list.filter((x) => x.status === 'done');
    const fer = '<img class="md-strip-fer" src="' + ART.ferHello + '" alt="" width="40" height="40" loading="lazy" decoding="async">';
    if (todo.length === 1 && !done.length) {
      const it = todo[0];
      return '<section class="md-strip" aria-label="De tu profe">' + fer + '<p class="md-strip-t"><b>De tu profe</b><span>' + esc(it.title) + ' · ' + esc(it.sub) + '</span></p>' +
        tpChip(it) + tpGo(it) + '</section>';
    }
    const line = todo.length === 1 ? esc(todo[0].title) : todo.length ? todo.length + ' tareas nuevas' : '¡Hiciste todas sus tareas!';
    return '<details class="md-strip"><summary>' + fer + '<span class="md-strip-t"><b>De tu profe</b><span>' + line + '</span></span>' +
      (todo.length ? '<span class="md-tp-chip is-new">' + (todo.length === 1 ? '1 nueva' : todo.length + ' nuevas') + '</span>' : '<span class="md-tp-chip is-done">' + I.check + (done.length === 1 ? '1 hecha' : done.length + ' hechas') + '</span>') +
      '<span class="md-strip-more">Ver</span></summary><ul class="md-tp-list">' + todo.concat(done).map(tpRow).join('') + '</ul></details>';
  }

  // no La Ruta Dorada on this phone (no session of this kid): every tarea of the teacher in one «De tu profe» list
  function allTareasHtml() {
    const t = M.tareas;
    const list = Object.keys(t.byExp).sort((a, b) => a - b).reduce((l, n) => l.concat(t.byExp[n]), []).concat(t.dorado, t.loose);
    if (!list.length) return '';
    return '<section class="md-profe" aria-labelledby="md-profe-t"><img class="md-profe-fer" src="' + ART.ferHello + '" alt="" width="200" height="240" loading="lazy" decoding="async">' +
      '<div class="md-profe-in"><h2 class="md-h2" id="md-profe-t">De tu profe</h2><ul class="md-tp-list">' + list.map(tpRow).join('') + '</ul></div></section>';
  }

  // ── La Ruta Dorada: the path ──
  function nodeHtml(e, i, sel) {
    const cls = 'md-node' + (e.done ? ' is-done' : e.today ? ' is-today' : ' is-later') + (e.started || e.today || e.done ? '' : ' is-calm') + (sel ? ' is-sel' : '');
    const say = 'Experiencia ' + e.n + ': ' + e.name + (e.done ? ', lista' : e.today ? ', toca hoy' : '');
    return '<li class="md-node-li" style="--zz:' + ZZ[i % ZZ.length] + '"><a class="' + cls + '" href="#exp-' + e.n + '" aria-label="' + esc(say) + '"' + (sel ? ' aria-current="true"' : '') + ' data-node="' + e.n + '">' +
      '<span class="md-node-art"><img class="md-node-scene" src="' + esc(e.scene) + '" alt="" width="480" height="270" loading="lazy" decoding="async">' +
        (e.pic ? '<img class="md-node-pic" src="' + esc(e.pic) + '" alt="" width="200" height="200" loading="lazy" decoding="async">' : '') +
        '<b class="md-node-n">' + e.n + '</b>' +
        (e.done ? '<span class="md-node-ok">' + I.check + '</span>' : e.today ? '<span class="md-node-tag">¡Empieza aquí!</span>' : '') + '</span>' +
      '<span class="md-node-name">' + esc(e.name) + '</span>' + barsHtml(e.bars, e.n) + '</a></li>';
  }
  // El Simulacro Dorado at the end of the path (review 2026-10-18): passed = green ✓ «Aprobado» (never «¡Empieza
  // aquí!»), ready = «Avisa a tu profe», else calm
  function goldNodeHtml(sel) {
    const d = M.dorado;
    const cls = 'md-node md-gold' + (d.passed ? ' is-done' : d.tell ? ' is-today' : '') + (sel ? ' is-sel' : '');
    const say = 'El Simulacro Dorado: ' + (d.passed ? 'aprobado' : d.tell ? 'avisa a tu profe' : 'en clase, con tu profe');
    return '<li class="md-node-li md-gold-li"><a class="' + cls + '" href="#dorado" aria-label="' + esc(say) + '"' + (sel ? ' aria-current="true"' : '') + '>' +
      '<span class="md-node-art"><img class="md-node-scene" src="' + ART.dubaiS + '" alt="" width="480" height="270" loading="lazy" decoding="async">' +
        '<img class="md-gold-star" src="' + ART.star + '" alt="" width="200" height="220" loading="lazy" decoding="async">' +
        (d.passed ? '<span class="md-node-pass">' + I.check + '<span>Aprobado</span></span>' : d.tell ? '<span class="md-node-tag">Avisa a tu profe</span>' : '') + '</span>' +
      '<span class="md-gold-cap"><span class="md-node-name md-gold-name">El Simulacro Dorado</span><span class="md-gold-sub">En clase, con tu profe</span></span></a></li>';
  }
  const ofText = () => M.doneN + ' de ' + M.exps.length + ' listas';
  function pathHtml(sel) {
    const nodes = M.exps.map((e, i) => nodeHtml(e, i, sel === 'exp-' + e.n)).join('') + goldNodeHtml(sel === 'dorado');
    // (the dotted third bar: an experience whose homework hasn't come yet; YCT 1, with no homework audio, has two bars)
    const na = M.anyHw && M.exps.some((e) => e.bars.tarea === 'na');
    const legend = '<p class="md-legend" aria-hidden="true"><span>Las ' + (M.anyHw ? '3' : '2') + ' rayitas:</span>' +
      '<span><i class="is-done"></i>palabras</span><span><i class="is-done"></i>práctica</span>' + (M.anyHw ? '<span><i class="is-done"></i>tarea mandada</span>' : '') +
      (na ? '<span><i class="is-na"></i>sin tarea todavía</span>' : '') + '</p>';
    return '<section class="md-ruta" aria-labelledby="md-ruta-t">' +
      '<div class="md-ruta-head"><h1 class="md-ruta-t" id="md-ruta-t" tabindex="-1">La Ruta Dorada</h1>' +
        '<span class="md-ruta-of" id="md-ruta-of">' + ofText() + '</span></div>' +
      '<ol class="md-path" aria-label="Las experiencias de ' + esc(M.levelName) + '">' + nodes + '</ol>' +
      '<div class="md-ruta-foot">' + legend + '</div></section>';
  }

  // ── an experience: 1 Palabras → 2 Práctica → 3 Tu tarea, then «Preguntas de tu profe» ──
  function missingText(e) {
    const left = [];
    if (e.bars.words !== 'done') left.push('las palabras');
    if (e.bars.practice !== 'done') left.push('la práctica');
    if (e.bars.tarea !== 'done' && e.bars.tarea !== 'na') left.push('tu tarea');
    if (left.length) return 'Te falta: ' + (left.length === 1 ? left[0] : left.slice(0, -1).join(', ') + ' y ' + left[left.length - 1]) + '.';
    // (review 2026-10-18: never «¡Experiencia lista!» while the teacher's new work for it is listed below)
    if (e.teacherNew) return 'Hiciste los ' + (M.anyHw ? '3' : '2') + ' pasos. Tu profe te dejó ' + (e.teacherNew === 1 ? '1 más' : e.teacherNew + ' más') + '.';
    if (e.bars.tarea === 'na' && M.anyHw) return 'Palabras y práctica listas. Tu tarea llega cuando tu clase llegue a esta experiencia.';
    return '¡Experiencia lista! Puedes repasar cuando quieras.';
  }
  function stepState(e, k, done) {
    if (done) return 'done';
    return e.next === k ? 'next' : 'todo';
  }
  const baseHref = (n) => (M.base ? M.base.href + '?from=homework#mundo-' + n : M.route + '?from=homework');
  // Aileen's line in «Tu tarea» (voseo): what to do, or, once every homework of the experience is sent, the praise
  const aileenText = (e) => (e.hws.length && !e.left ? '«¡Qué crack! Tu profe ya tiene tus videos.»'
    : '«¡Dale! Escuchá el audio, grabá tu video y mandáselo a tu profe por WhatsApp. Después tocá <b>¡Ya la mandé!</b>»');
  function expHtml(e, mode) {
    const page = mode === 'page';
    const s1 = !M.open ? 'locked' : stepState(e, 1, e.bars.words === 'done');
    const s2 = !M.open ? 'locked' : !e.open ? 'closed' : stepState(e, 2, e.bars.practice === 'done');
    const s3 = !e.hws.length ? 'soon' : stepState(e, 3, e.bars.tarea === 'done');
    const tag = (st) => (st === 'next' ? '<span class="md-step-tag">¡Empieza aquí!</span>' : '');
    // (each step's number once: in its circle, never again in its title; a lock for a step that can't open yet)
    const num = (st, k) => '<span class="md-step-n' + (st === 'soon' ? ' is-soon' : '') + '">' + (st === 'done' ? I.check : st === 'locked' || st === 'closed' ? I.lock : k) + '</span>';
    const btn = (st, href, label) => '<a class="md-btn ' + (st === 'next' ? 'is-gold' : st === 'done' ? 'is-soft' : 'is-plain') + '" href="' + esc(href) + '" data-out data-step-go>' + label + '</a>';
    const peek = e.peek.slice(0, page ? 4 : 3).map((src) => '<img src="' + esc(src) + '" alt="" width="200" height="200" loading="lazy" decoding="async">').join('');
    const w1 = e.bars.words === 'done' ? 'Repasar' : e.bars.words === 'half' ? 'Seguir marcando' : 'Marcar mis palabras';
    // (review 2026-10-18: a locked step is a lock and one plain line, no button)
    const step1 = '<li class="md-step is-' + s1 + '" id="md-step-1" data-step="1">' + tag(s1) +
      '<div class="md-step-row">' + num(s1, 1) + '<div class="md-step-txt"><h3 class="md-step-t">Palabras <small>La Base</small></h3>' +
        '<p class="md-step-l">' + (s1 === 'locked' ? 'Se abre con la clave de ' + esc(M.levelName) + '.' : e.sealed + ' de ' + e.count + ' marcadas') + '</p></div></div>' +
      (s1 === 'locked' ? '' : (peek ? '<div class="md-peek" aria-hidden="true">' + peek + '</div>' : '') + btn(s1, baseHref(e.n), w1)) + '</li>';
    const pct = e.best == null ? 0 : Math.min(100, Math.round((e.best / M.goal) * 100));
    const step2 = '<li class="md-step is-' + s2 + '" id="md-step-2" data-step="2">' + tag(s2) +
      '<div class="md-step-row">' + num(s2, 2) + '<div class="md-step-txt"><h3 class="md-step-t">Práctica <small>El Entrenamiento</small></h3>' +
        (s2 === 'locked' ? '<p class="md-step-l">Se abre con la clave de ' + esc(M.levelName) + '.</p>'
          : s2 === 'closed' ? '<p class="md-step-l">Se abre cuando marques todas sus palabras.</p>'
            : '<span class="md-meter"><i style="width:' + pct + '%"></i></span><p class="md-step-l">' + (e.best == null ? 'Meta: ' + M.goal + ' % en una ronda de 10' : 'Tu mejor ronda: ' + e.best + ' %<br>Meta: ' + M.goal + ' %') + '</p>') + '</div></div>' +
      (s2 === 'locked' || s2 === 'closed' ? '' : btn(s2, e.train || M.route + '/entrenamiento', e.bars.practice === 'done' ? 'Otra ronda' : 'Practicar aquí')) + '</li>';
    // 3 · Tu tarea: none at all in a level with no homework audio (YCT 1); «sin tarea todavía» until the teacher sends it
    const step3 = !M.anyHw ? '' : '<li class="md-step is-' + s3 + '" id="md-step-3" data-step="3">' + tag(s3) +
      '<div class="md-step-row">' + num(s3, 3) + '<div class="md-step-txt"><h3 class="md-step-t">Tu tarea <small>' + (e.hws.length ? 'Mándala por WhatsApp' : 'Sin tarea todavía') + '</small></h3></div>' +
        '<span class="md-badge" data-left="' + e.n + '"' + (e.left && e.hws.length ? '' : ' hidden') + '>' + (e.left === 1 ? '1 por mandar' : e.left + ' por mandar') + '</span></div>' +
      (e.hws.length ? '<div class="md-say"><img src="' + ART.aileenTalk + '" alt="Aileen" width="312" height="480" loading="lazy" decoding="async">' +
          '<p data-aileen="' + e.n + '">' + aileenText(e) + '</p></div>' +
          '<div class="md-hw" data-hw-mount="' + e.n + '"></div>'
        : '<p class="md-step-l md-soon">Tu profe te la manda cuando tu clase llegue a esta experiencia.</p>') + '</li>';
    // the teacher's work for this experience, after the steps (review 2026-10-18: never inside a locked card)
    const prof = e.teacher.length ? '<section class="md-tp-box md-exp-profe" aria-label="Preguntas de tu profe"><p class="md-tp-k"><img src="' + ART.ferHello + '" alt="" width="40" height="40" loading="lazy" decoding="async"><span>Preguntas de tu profe</span>' +
        (e.teacherNew ? '<span class="md-tp-chip is-new">' + (e.teacherNew === 1 ? '1 nueva' : e.teacherNew + ' nuevas') + '</span>' : '') + '</p>' +
      '<ul class="md-tp-list">' + e.teacher.map(tpRow).join('') + '</ul></section>' : '';
    const also = e.n === 1 && M.extra && M.extra.pinyin && M.open
      ? '<a class="md-also" href="' + esc(M.extra.pinyin.href) + '" data-out>También: Pinyin básico' + (M.extra.pinyin.best != null ? ' · ' + M.extra.pinyin.best + ' %' : '') + '</a>' : '';
    // the whole experience done (and nothing new from the teacher): Aileen and Dralingo celebrate
    const party = e.done && !e.teacherNew && (e.bars.tarea === 'done' || !M.anyHw) ? '<div class="md-party" data-party="' + e.n + '"><img src="' + ART.aileenWin + '" alt="" width="200" height="240" loading="lazy" decoding="async">' +
      '<p>«¡Terminaste esta experiencia! ¡Vamos por la siguiente!»</p><img src="' + ART.dralingoWin + '" alt="" width="200" height="240" loading="lazy" decoding="async"></div>' : '';
    const hero = '<header class="md-exp-hero"><img class="md-exp-bg" src="' + esc(e.scene) + '" alt="" width="480" height="270" decoding="async">' +
      '<span class="md-exp-shade" aria-hidden="true"></span>' +
      (page ? '<a class="md-back md-back-glass" href="#">' + I.back + '<span>La Ruta Dorada</span></a>' : '') +
      (e.pic ? '<img class="md-exp-pic" src="' + esc(e.pic) + '" alt="" width="200" height="200" decoding="async">' : '') +
      '<div class="md-exp-t"><p>Experiencia ' + e.n + '</p><h2 class="md-exp-h" id="md-exp-h" tabindex="-1">' + esc(e.name) + '</h2></div></header>';
    return '<section class="md-exp' + (page ? ' is-page' : ' is-aside') + (e.done ? ' is-done' : '') + '" aria-labelledby="md-exp-h">' + hero +
      '<div class="md-exp-body"><div class="md-exp-sum"><p id="md-exp-sum">' + esc(missingText(e)) + '</p>' + barsHtml(e.bars, 'x' + e.n) + '</div>' +
      '<ol class="md-steps">' + step1 + step2 + step3 + '</ol>' + prof + also + party +
      (page ? '<a class="md-back md-back-foot" href="#">' + I.back + '<span>Volver a La Ruta Dorada</span></a>' : '') + '</div></section>';
  }

  // ── El Simulacro Dorado (review 2026-10-18: one clean list) ──
  //   the state on top when it is news (✓ «Aprobado», or «¡Ya estás listo!» + «Avisar a mi profe»), «Tus simulacros»
  //   (each class simulation: its latest try's % and its libro dorado), ONE folder «De tu profe · Practica el examen»
  //   (El Entrenamiento's Simulacro del examen, the teacher's Simulacro rounds, HSK 1's reading tests), and the way it
  //   opens («Se abre en clase…») under them, never above open cards
  function teacherMsg() {
    const s = H.state();
    return '¡Hola, profe! ' + (s.name ? 'Soy ' + s.name + '. ' : '') + 'Terminé El Entrenamiento de ' + M.levelName + '. ¡Ya puedo hacer El Simulacro Dorado!';
  }
  function doradoHtml(mode) {
    const page = mode === 'page';
    const d = M.dorado;
    const s = H.state();
    let top = '';
    if (d.passed) top = '<div class="md-dor-state is-done"><span class="md-step-n">' + I.check + '</span><div><p class="md-dor-big">Aprobado</p><p>¡Aprobaste El Simulacro Dorado con ' + M.sim.percent + ' %!</p></div></div>';
    else if (d.ready) {
      top = '<div class="md-dor-state is-ready"><p class="md-dor-big">¡Ya estás listo para El Simulacro Dorado!</p>' +
        '<p>Avísale a tu profe: lo hacen en clase, con un PIN.</p>' +
        '<div class="md-dor-acts"><a class="md-btn is-green" href="' + esc(waHref()) + '" target="_blank" rel="noopener">' + I.wa + '<span>Avisar a mi profe</span></a>' +
        '<button type="button" class="md-btn is-plain" data-act="copy-msg">' + I.copy + '<span>Copiar mensaje</span></button></div></div>';
    }
    // «Tus simulacros»: the latest try of each simulation taken (its % and its mistakes agree: the same try)
    const books = M.books.length ? '<section class="md-dor-part"><h3 class="md-h3">Tus simulacros</h3><ul class="md-books">' + M.books.map((b) =>
      '<li><span class="md-book-n' + (b.passed ? ' is-done' : '') + '">' + (b.passed ? I.check : '') + 'Simulacro ' + b.n + ' · ' + b.percent + ' %</span>' +
        '<a class="md-btn is-plain" href="' + esc(b.book) + '" data-out>' + I.book + '<span>Libro dorado' + (b.mistakes > 0 ? ' · ' + (b.mistakes === 1 ? '1 error' : b.mistakes + ' errores') : '') + '</span></a></li>').join('') + '</ul></section>' : '';
    // ONE folder: «De tu profe · Practica el examen»
    const ex = M.extra && M.extra.simulacro;
    const rounds = M.tareas.dorado;
    const reads = M.tareas.readings;
    const avail = reads.filter((x) => x.available || x.bestScore != null);
    const lockedN = reads.length - avail.length;
    const showReads = reads.length && (avail.length || s.level === 'hsk1');
    let folder = '';
    if (ex || rounds.length || showReads) {
      const parts = [];
      if (ex) parts.push('Simulacro del examen');
      if (rounds.length) parts.push(rounds.length === 1 ? '1 ronda' : rounds.length + ' rondas');
      if (avail.length) parts.push(avail.length === 1 ? '1 lectura' : avail.length + ' lecturas');
      const newN = rounds.filter((x) => x.status === 'new').length + avail.filter((x) => x.bestScore == null).length;
      const exRow = ex ? '<li class="md-tp is-' + (ex.best != null ? 'done' : 'new') + '"><span class="md-tp-t"><b>Simulacro del examen</b><small>' + (ex.open ? 'Preguntas como en el examen' + (ex.best != null ? ' · ' + ex.best + ' %' : '') : 'Se abre cuando todas tus experiencias estén listas para practicar') + '</small></span>' +
        (ex.open ? '<span class="md-tp-acts"><a class="md-tp-go" href="' + esc(ex.href) + '" data-out>' + (ex.best != null ? 'Otra vez' : 'Hacer') + '</a></span>' : '<span class="md-tp-lock">' + I.lock + '</span>') + '</li>' : '';
      const readRows = avail.map((x) => '<li class="md-tp is-' + (x.bestScore != null ? 'done' : 'new') + '"><span class="md-tp-t"><b>' + esc(x.title) + '</b><small>' + (x.bestScore != null ? 'Lectura · ' + x.bestScore + ' / 100' : 'Lectura') + '</small></span>' +
        '<span class="md-tp-acts"><button type="button" class="md-tp-go" data-act="reading" data-story="' + esc(x.storyId) + '">' + (x.bestScore != null ? 'Otra vez' : 'Leer') + '</button>' +
        (x.bestScore != null ? '<button type="button" class="md-tp-rev" data-act="reading-review" data-story="' + esc(x.storyId) + '" data-title="' + esc(x.title) + '">Ver mis errores</button>' : '') + '</span></li>').join('');
      folder = '<details class="md-folder"><summary><img src="' + ART.ferHello + '" alt="" width="40" height="40" loading="lazy" decoding="async">' +
        '<span class="md-folder-t"><b>De tu profe · Practica el examen</b><small>' + esc(parts.join(' · ')) + '</small></span>' +
        (newN ? '<span class="md-tp-chip is-new">' + (newN === 1 ? '1 nueva' : newN + ' nuevas') + '</span>' : '') + '</summary>' +
        '<ul class="md-tp-list">' + exRow + rounds.map(tpRow).join('') + (showReads ? readRows : '') + '</ul>' +
        (showReads && lockedN ? '<p class="md-quiet">' + I.lock + ' ' + (lockedN === 1 ? '1 historia se abre' : lockedN + ' historias se abren') + ' cuando la lean en clase.</p>' : '') + '</details>';
    }
    // how it opens, for a kid on the way: under the open cards, never above them
    let wait = '';
    if (!d.passed && !d.ready) {
      const coins = M.exps.map((e) => '<li class="' + (e.bars.practice === 'done' ? 'is-done' : e.bars.practice === 'half' ? 'is-half' : '') + '" title="Experiencia ' + e.n + '">' + (e.bars.practice === 'done' ? I.check : e.n) + '</li>').join('');
      wait = '<div class="md-dor-state is-locked"><span class="md-step-n">' + I.lock + '</span><div><p>Se abre en clase con tu profe, cuando termines El Entrenamiento.</p>' +
        '<p class="md-dor-count">' + d.practiced + ' de ' + M.exps.length + ' prácticas con ' + M.goal + ' %</p><ol class="md-coins" aria-hidden="true">' + coins + '</ol>' +
        (M.books.length ? '' : '<p class="md-dor-note">Cuando hagas un simulacro en clase, aquí repasas tus errores en tu libro dorado.</p>') + '</div></div>';
    }
    const hero = '<header class="md-dor-hero"><img class="md-exp-bg" src="' + ART.dubaiS + '" srcset="' + ART.dubaiS + ' 480w, ' + ART.dubai + ' 1600w" sizes="(min-width: 1000px) 470px, 100vw" alt="" decoding="async">' +
      '<span class="md-exp-shade" aria-hidden="true"></span>' +
      (page ? '<a class="md-back md-back-glass" href="#">' + I.back + '<span>La Ruta Dorada</span></a>' : '') +
      '<img class="md-dor-star" src="' + ART.star + '" alt="" width="200" height="220" decoding="async">' +
      '<div class="md-exp-t"><p>Al final de tu ruta</p><h2 class="md-exp-h" id="md-dor-h" tabindex="-1">El Simulacro Dorado</h2><p class="md-dor-sub">En clase, con tu profe</p></div></header>';
    const none = !top && !books && !folder;
    return '<section class="md-exp md-dor' + (page ? ' is-page' : ' is-aside') + '" aria-labelledby="md-dor-h">' + hero + '<div class="md-exp-body">' +
      top + (none ? wait : books + folder + wait) +
      (page ? '<a class="md-back md-back-foot" href="#">' + I.back + '<span>Volver a La Ruta Dorada</span></a>' : '') + '</div></section>';
  }

  // ── Mensajes · Mis oraciones · Desafío del día ──
  function headHtml(title, mode, id) {
    return mode === 'page'
      ? '<header class="md-sub"><a class="md-back md-back-light" href="#">' + I.back + '<span>Volver</span></a><h1 class="md-sub-t" id="' + id + '" tabindex="-1">' + esc(title) + '</h1></header>'
      : '<div class="md-aside-head"><a class="md-back" href="#">' + I.back + '<span>Volver</span></a><h2 class="md-sub-t" id="' + id + '" tabindex="-1">' + esc(title) + '</h2></div>';
  }
  const PIN_LINK = /[?&]pin=\d+/;
  function whenOf(ts) {
    const d = new Date(Number(ts) || 0);
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(new Date()) - day(d)) / 86400000);
    if (diff <= 0) return 'Hoy';
    if (diff === 1) return 'Ayer';
    try { return d.toLocaleDateString(window.HW_LANG === 'en' ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'short' }); } catch (_) { return ''; }
  }
  function msgsHtml(mode) {
    const s = H.state();
    const list = s.inbox || [];
    const n = list.filter((m) => !m.readAt).length;
    const rows = list.map((m, i) => {
      const act = m.actionType === 'anim' ? '<button type="button" class="md-btn is-gold" data-act="anim" data-i="' + i + '">' + I.play + '<span>Verla otra vez</span></button>'
        : m.actionUrl && /^\/(?![\/\\])/.test(m.actionUrl) ? '<a class="md-btn is-gold" href="' + esc(m.actionUrl) + '">' + (PIN_LINK.test(m.actionUrl) ? 'Entrar al juego con el PIN' : esc(m.actionLabel || 'Abrir')) + '</a>'
          : m.actionUrl && /^https:\/\//.test(m.actionUrl) ? '<a class="md-btn is-gold" href="' + esc(m.actionUrl) + '" target="_blank" rel="noopener">' + esc(m.actionLabel || 'Abrir') + '</a>' : '';
      return '<li class="md-msg' + (m.readAt ? '' : ' is-new') + '"><img src="' + ART.ferHello + '" alt="" width="44" height="44" loading="lazy" decoding="async">' +
        '<div class="md-msg-in"><p class="md-msg-h"><b>' + esc(m.fromName || 'Tu profe') + '</b><span>' + esc(whenOf(m.ts)) + '</span></p>' +
          '<p class="md-msg-t">' + esc(m.text || '') + '</p>' + act +
          (m.broadcast ? '<p class="md-msg-all">Para toda la clase</p>' : '') + '</div>' +
        (m.readAt ? '' : '<span class="md-dot" aria-label="Nuevo"></span>') + '</li>';
    }).join('');
    return '<section class="md-view md-msgs">' + headHtml('Mensajes', mode, 'md-view-h') +
      '<div class="md-view-body"><div class="md-who"><img src="' + ART.ferCheer + '" alt="" width="287" height="480" loading="lazy" decoding="async">' +
        '<div><p class="md-who-t">De tu profe</p><p class="md-who-s">' + (n === 0 ? 'Todo leído' : n === 1 ? '1 mensaje nuevo' : n + ' mensajes nuevos') + '</p></div></div>' +
        (rows ? '<ul class="md-msg-list">' + rows + '</ul>' : '<p class="md-quiet">Aún no tienes mensajes. Cuando tu profe te escriba, aparece aquí.</p>') + '</div></section>';
  }
  function sentHtml(mode) {
    return '<section class="md-view md-orac">' + headHtml('Mis oraciones', mode, 'md-view-h') +
      '<div class="md-view-body"><div class="md-say"><img src="' + ART.aileenHello + '" alt="Aileen" width="312" height="480" loading="lazy" decoding="async">' +
        '<p>«Escuchá cada oración y decila en voz alta. ¡Vos podés!»</p></div><div data-sent-mount></div></div></section>';
  }
  function desafioHtml(mode) {
    return '<section class="md-view md-desafio">' + headHtml('Desafío del día', mode, 'md-view-h') +
      '<div class="md-view-body"><div class="md-des-hero"><img class="md-des-bg" src="' + ART.shanghaiS + '" srcset="' + ART.shanghaiS + ' 480w, ' + ART.shanghai + ' 1600w" sizes="(min-width: 1000px) 470px, 100vw" alt="" loading="lazy" decoding="async">' +
        '<span class="md-des-shade" aria-hidden="true"></span>' +
        '<img class="md-des-dragon" src="' + ART.dragon + '" alt="" width="240" height="180" loading="lazy" decoding="async">' +
        '<img class="md-des-jet" src="' + ART.jet + '" alt="" width="260" height="160" loading="lazy" decoding="async">' +
        '<img class="md-des-panda" src="' + ART.panda + '" alt="" width="240" height="208" loading="lazy" decoding="async">' +
        '<span class="md-des-lock">' + I.lock + '</span>' +
        '<div class="md-des-t"><span class="md-des-soon">Muy pronto</span><p class="md-des-h">Los juegos de la clase llegan a tu casa</p></div></div>' +
        '<div class="md-say"><img src="' + ART.hamdan + '" alt="Hamdan" width="200" height="280" loading="lazy" decoding="async">' +
          '<p>Estamos preparando un desafío nuevo cada día: el Vuelo del Dragón, La Gran Fuga, Las Trampillas… para jugar en casa con tus palabras.</p></div>' +
        '<button type="button" class="md-btn is-gold md-btn-wide" data-act="today">Mientras tanto: lo que toca hoy</button></div></section>';
  }
  function dockHtml(sel) {
    const s = H.state();
    const n = Number(s.unread) || 0;
    const tile = (k, img, t, sub, extra) => '<a class="md-tile' + (sel === k ? ' is-sel' : '') + (k === 'desafio' ? ' is-soon' : '') + '" href="#' + k + '"' + (sel === k ? ' aria-current="true"' : '') + '>' +
      '<img src="' + img + '" alt="" width="46" height="46" loading="lazy" decoding="async"><span class="md-tile-t"><b>' + t + '</b><small>' + sub + '</small></span>' + (extra || '') + '</a>';
    return '<nav class="md-dock" aria-label="Más cosas">' +
      tile('mensajes', ART.ferHello, 'Mensajes', 'De tu profe', '<span class="md-count" data-unread' + (n ? '' : ' hidden') + '>' + (n > 9 ? '9+' : n) + '</span>') +
      tile('oraciones', ART.aileenHello, 'Mis oraciones', 'Tuyas y de tu profe') +
      tile('desafio', ART.dragon, 'Desafío del día', 'Muy pronto: los juegos de la clase', '<span class="md-tile-lock">' + I.lock + '</span>') +
      (coinsNow() == null ? '' : tile('zoco', ZOCO_ART.tile, 'El Zoco', 'Personajes nuevos', '<span class="md-tile-coins">' + I.coinS + '<b data-coins>' + coinsNow() + '</b></span>')) + '</nav>';
  }
  function tabsHtml(sel) {
    const n = Number(H.state().unread) || 0;
    const tab = (k, icon, t, extra) => '<a class="md-tab' + (sel === k ? ' is-on' : '') + '" href="#' + k + '"' + (sel === k ? ' aria-current="page"' : '') + '>' + icon + '<span>' + t + '</span>' + (extra || '') + '</a>';
    return '<nav class="md-tabs" aria-label="Menú">' + tab('', I.home, 'La Ruta') +
      tab('mensajes', I.chat, 'Mensajes', '<span class="md-count" data-unread' + (n ? '' : ' hidden') + '>' + (n > 9 ? '9+' : n) + '</span>') +
      tab('oraciones', I.pen, 'Oraciones') + tab('desafio', I.star, 'Desafío', '<span class="md-soon-chip">pronto</span>') + '</nav>';
  }
  function loadingHtml() {
    return failed
      ? '<div class="md-wait"><img src="' + ART.hello + '" alt="" width="160" height="178"><p>No se pudo cargar tu Ruta Dorada. Revisa tu internet.</p>' +
        '<button type="button" class="md-btn is-gold" data-act="retry">Volver a intentar</button></div>'
      : '<div class="md-wait"><img src="' + ART.hello + '" alt="" width="160" height="178"><p>Cargando tu Ruta Dorada…</p></div>';
  }
  // no `ruta`: this phone has no session of this kid (an expired session, another class's code): the tareas, Mensajes,
  // Mis oraciones and the exams still work (review 2026-10-18: the tabs and the dock stay)
  function noRutaHtml() {
    return '<div class="md-wait"><img src="' + ART.hello + '" alt="" width="160" height="178"><p>Para ver tu Ruta Dorada, toca «Entrar de nuevo».</p>' +
      '<button type="button" class="md-btn is-gold" data-act="relogin">Entrar de nuevo</button></div>';
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🪙 El Zoco de Dralingo (2026-10-19, his OK: "Okay I approve the design of the Souq"; boards Main, Detalle, Monedas,
  // Nuevo, Avatar): kids unlock new characters with coins they earn with real steps
  // ═══════════════════════════════════════════════════════════════════
  //   #zoco        the shop: the purse, one character in the spotlight (a different locked one each visit), the
  //                sections (Dralingo · La pandilla · Mascotas), «¿Cómo gano monedas?»
  //   #zoco-<id>   a character: its picture big on the Dubai sky, what it is, «Tienes X de P» and the bar, «Desbloquear
  //                por P» (two taps: «¡Sí, desbloquear!»), or «Gana las monedas que te faltan»; once theirs, «Usarlo»
  //   #monedas     «¿Cómo gano monedas?»: the six ways (the server's table, core/zoco.js WAYS: one source with the pay)
  //   #tuyo-<id>   «¡Ya es tuyo!» right after a purchase: «Usarlo ahora» (their character from now on) · «Volver al Zoco»
  //   #personaje   «Elige tu personaje» (Mi perfil's row): «Ahora juegas con», «Tus personajes» (the saga's free ones +
  //                the skins they own), «En el Zoco» (the rest, each to its page)
  // Data: GET /api/zoco (the server judges every coin; this page never adds one), POST /api/zoco/buy and /equip. The
  // band's pill reads the home's answer (D.zoco) until the shop answered. Coins that came in since this phone last looked
  // (by the server's clock: js/zoco-coins.js draly_zoco_seen) pop once («+N monedas»). Pages: full pages on a phone and a
  // laptop (no band, no tabs), each with its «Volver».
  const ZOCO_ART = {
    tile: A + 'zoco/avatar/dralingo-emperador-qin.webp', bg: A + 'paint/dubai/bg.webp', bgS: A + 'scenes/dubai-s.webp',
    point: A + 'dralingo/point.webp', win: A + 'dralingo/victory.webp', hello: A + 'dralingo/hello.webp',
  };
  // the characters a «¡Ya es tuyo!» line calls «ella»
  const ZOCO_SHE = ['latifa-3d', 'aileen-3d', 'poni-de-aileen'];
  let Z = null, zAt = 0, zBusy = null, zFail = false, zFor = '', zHero = null, zConfirm = '', zMsg = null, zGift = false;
  const codeNow = () => (H && H.state().code) || '';
  // the coins on screen: the shop's answer, else the home's (null = no session of this kid on this phone: no pill)
  function coinsNow() {
    const c = Z && Z.student && zFor === codeNow() ? Z.coins : D && D.zoco && typeof D.zoco.coins === 'number' ? D.zoco.coins : null;
    return c == null ? null : Math.max(0, c);   // (a debt shows as 0: «¿Cómo gano monedas?» explains it)
  }
  const debtNow = () => (Z && Z.student && zFor === codeNow() && Z.coins < 0 ? -Z.coins : 0);
  const coinsSay = (c) => (c === 1 ? 'Tienes 1 moneda · El Zoco de Dralingo' : 'Tienes ' + c + ' monedas · El Zoco de Dralingo');
  const coinsWord = (n) => (Math.abs(n) === 1 ? n + ' moneda' : n + ' monedas');
  const seenAt = () => (window.DralyCoins ? window.DralyCoins.lastSeen() : 0);
  // the moves since this phone last looked (the server's news, its clock): one «+N monedas» moment, then remembered
  function newsMoment(list, now) {
    const got = (Array.isArray(list) ? list : []).filter((e) => e && Number(e.n) > 0 && Number(e.at) > seenAt()).reduce((a, e) => a + Number(e.n), 0);
    if (window.DralyCoins) {
      if (got > 0) window.DralyCoins.pop({ got, c: coinsNow(), at: now }, { delay: 900 });
      else window.DralyCoins.seen(now);
    }
  }
  function zocoLoad(force) {
    const code = codeNow();
    if (!code) return Promise.resolve(null);
    if (!force && Z && zFor === code && Date.now() - zAt < 15000) return Promise.resolve(Z);
    if (zBusy) return zBusy;
    const since = seenAt() || (Date.now() - 10 * 60000);
    zBusy = fetch('/api/zoco?since=' + since, { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => r.json().catch(() => null), () => null)
      .then((d) => {
        zBusy = null;
        // (the shop's answer must be this page's kid: a sibling who logged in on another tab answers with another `who`)
        const homeWho = D && D.ruta && D.ruta.who;
        if (d && d.ok && d.student && homeWho && d.who && d.who !== homeWho) d = { ok: true, student: false, other: true };
        if (d && d.ok && code === codeNow()) {
          if (!Z || zFor !== code) { zHero = null; zGift = false; }
          Z = d; zFor = code; zAt = Date.now(); zFail = false;
          // (the welcome gift's card: this visit, once per account on this phone)
          const gk = 'draly_zoco_welcome_' + (d.who || '');
          if (d.student && d.welcome > 0 && !ls.get(gk)) { zGift = true; ls.set(gk, '1'); }
          if (d.student) newsMoment(d.news, d.now);
        } else if (code === codeNow()) zFail = true;
        if (H && H.screen() === 'list' && isZoco(view)) draw(); else paintCoins();
        return Z;
      });
    return zBusy;
  }
  // the number on every coins pill on screen (a step paid on this page: js/zoco-coins.js `draly:coins`)
  function paintCoins() {
    const c = coinsNow();
    if (c == null) return;
    document.querySelectorAll('#md-app [data-coins]').forEach((b) => { b.textContent = String(c); });
    document.querySelectorAll('#md-app .md-coins, #md-app .md-coins-mini').forEach((a) => a.setAttribute('aria-label', coinsSay(c)));
  }
  document.addEventListener('draly:coins', (e) => {
    const c = e && e.detail && Number(e.detail.c);
    if (!Number.isFinite(c)) return;
    if (D && D.zoco) D.zoco.coins = c;
    if (Z && Z.student) Z.coins = c;
    paintCoins();
  });
  function zPost(path, body) {
    return fetch(path, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ who: (Z && Z.who) || null }, body)) })
      .then((r) => r.json().catch(() => ({})).then((d) => Object.assign({ status: r.status }, d || {})), () => ({ ok: false, status: 0 }));
  }
  const zItem = (id) => (Z && Array.isArray(Z.items) ? Z.items.find((x) => x.id === id) : null) || null;
  const zCat = (id) => (Z && Array.isArray(Z.cats) ? Z.cats.find((c) => c.id === id) : null) || { title: '', tag: '' };
  const equipped = () => (H ? H.state().avatar : null) || (Z && Z.equipped) || null;
  // the spotlight of the shop: a character the kid doesn't have yet (a different one each visit), else one they have
  function heroOf() {
    const list = (Z && Z.items) || [];
    if (zHero && list.some((x) => x.id === zHero)) return zItem(zHero);
    const locked = list.filter((x) => !x.owned);
    const pool = locked.length ? locked : list;
    if (!pool.length) return null;
    const firstTime = !ls.get('draly_zoco_hero');
    const pick = firstTime ? (pool.find((x) => x.hero) || pool[0]) : pool[Math.floor(Math.random() * pool.length)];
    ls.set('draly_zoco_hero', '1');
    zHero = pick.id;
    return pick;
  }
  function purseHtml(cls) {
    const c = coinsNow();
    return '<a class="zc-purse' + (cls ? ' ' + cls : '') + '" href="#monedas" aria-label="' + esc(coinsSay(c == null ? 0 : c)) + '">' + I.coin + '<b data-coins>' + (c == null ? 0 : c) + '</b></a>';
  }
  const backHtml = (href, label, cls) => '<a class="zc-back' + (cls ? ' ' + cls : '') + '" href="' + href + '">' + I.back + '<span>' + esc(label) + '</span></a>';
  const lockSvg = (cls) => '<span class="' + cls + '">' + I.lock + '</span>';
  // a picture of a character: its full-body render, alt = its name (the cards' pictures load lazily: 16 on a page)
  const pic = (x, cls, lazy, alt) => '<img class="' + cls + '" src="' + esc(x.full) + '" alt="' + esc(alt == null ? x.name : alt) + '"' + (lazy ? ' loading="lazy"' : '') + ' decoding="async">';
  function cardHtml(x, c) {
    const ready = !x.owned && c >= x.price;
    return '<a class="zc-card' + (x.owned ? ' is-owned' : ready ? ' is-ready' : '') + '" href="#zoco-' + esc(x.id) + '">' +
      '<span class="zc-card-art">' + pic(x, 'zc-card-img', true) + (x.owned ? '' : lockSvg('zc-lock' + (ready ? ' is-ready' : ''))) + '</span>' +
      '<span class="zc-card-name">' + esc(x.name) + '</span>' +
      (x.owned ? '<span class="zc-own">' + I.check + '<span>Tuyo</span></span>'
        : '<span class="zc-price">' + I.coinS + '<b>' + x.price + '</b>' + (ready ? '<span class="zc-ready">¡Ya te alcanza!</span>' : '') + '</span>') + '</a>';
  }
  function zocoWaitHtml(kind) {
    const no = Z && !Z.student;
    const msg = no && Z.other ? 'Otra cuenta entró en este teléfono. Toca «Entrar de nuevo».' : no ? 'Para entrar al Zoco, entra con tu código.'
      : zFail ? 'No se pudo abrir el Zoco. Revisa tu internet.' : 'Abriendo el Zoco…';
    return '<section class="zc zc-wait-page"><header class="zc-head"><div class="zc-head-row">' + backHtml(kind === 'personaje' ? '#perfil' : '#', kind === 'personaje' ? 'Mi perfil' : 'Volver') + '</div>' +
      '<h1 class="zc-h1" tabindex="-1">El Zoco de Dralingo</h1></header>' +
      '<div class="zc-body"><div class="md-wait"><img src="' + ZOCO_ART.hello + '" alt="" width="160" height="178"><p>' + esc(msg) + '</p>' +
      (no ? '<button type="button" class="md-btn is-gold" data-act="relogin">Entrar de nuevo</button>'
        : zFail ? '<button type="button" class="md-btn is-gold" data-act="zoco-retry">Volver a intentar</button>' : '') + '</div></div></section>';
  }
  // ── #zoco: the shop ──
  function zocoMainHtml() {
    const c = coinsNow() || 0;
    const items = Z.items || [];
    const h = heroOf();
    // the spotlight places the character by its face (saga.js ar / hx), so the title never sits on it
    const hz = h && window.Saga && window.Saga.zoco ? window.Saga.zoco(h.id) : null;
    const hv = ' style="--ar:' + (Number(hz && hz.ar) || 1) + ';--hx:' + (Number(hz && hz.hx) || 0.5) + '"';
    const heroCard = h ? '<a class="zc-hero" href="#zoco-' + esc(h.id) + '"' + hv + '>' +
      '<picture><source media="(min-width: 700px)" srcset="' + ZOCO_ART.bg + '"><img class="zc-hero-bg" src="' + ZOCO_ART.bgS + '" alt="" decoding="async" fetchpriority="high"></picture>' +
      pic(h, 'zc-hero-img', false) +
      '<span class="zc-badge">' + (Z.fresh ? 'Nuevo en el Zoco' : h.owned ? 'Tuyo' : 'En el Zoco') + '</span>' +
      '<span class="zc-hero-t"><span class="zc-hero-name">' + esc(h.name) + '</span>' +
        (h.owned ? '<span class="zc-hero-chip is-owned">' + I.check + '<span>Tuyo</span></span>'
          : '<span class="zc-hero-chip">' + I.coinS + '<b>' + h.price + '</b>' + I.lock + '</span>') + '</span></a>' : '';
    const welcome = zGift ? '<div class="zc-gift" role="status"><img src="' + ZOCO_ART.win + '" alt="" width="64" height="70" loading="lazy">' +
      '<p><b>¡Un regalo de bienvenida!</b><span>' + esc('Dralingo te dio ' + coinsWord(Z.welcome) + ' por todo lo que ya hiciste.') + '</span></p></div>' : '';
    const secs = (Z.cats || []).map((cat) => {
      const list = items.filter((x) => x.cat === cat.id);
      if (!list.length) return '';
      return '<section class="zc-sec" aria-labelledby="zc-sec-' + esc(cat.id) + '"><div class="zc-sec-head"><h2 class="zc-h2" id="zc-sec-' + esc(cat.id) + '">' + esc(cat.title) + '</h2>' +
        '<span class="zc-count">' + esc(list.length + ' ' + (list.length === 1 ? cat.one : cat.many)) + '</span></div>' +
        '<div class="zc-grid">' + list.map((x) => cardHtml(x, c)).join('') + '</div></section>';
    }).join('');
    const earn = '<a class="zc-earn" href="#monedas"><img src="' + ZOCO_ART.win + '" alt="" width="64" height="70" loading="lazy">' +
      '<span class="zc-earn-t"><b>¿Cómo gano monedas?</b><span>Con tus palabras, prácticas y tareas</span></span>' + I.fwd + '</a>';
    return '<section class="zc zc-main" aria-labelledby="zc-h">' +
      '<header class="zc-head"><div class="zc-head-row">' + backHtml('#', 'Volver') + purseHtml() + '</div>' +
        '<h1 class="zc-h1" id="zc-h" tabindex="-1">El Zoco de Dralingo</h1>' +
        '<p class="zc-sub">Personajes nuevos para ti. Gana monedas con tus pasos de cada día.</p></header>' +
      '<div class="zc-body">' + welcome + heroCard + secs + earn + '</div></section>';
  }
  // ── #zoco-<id>: a character ──
  function zocoItemHtml(id) {
    const x = zItem(id);
    if (!x) {
      return '<section class="zc zc-wait-page"><header class="zc-head"><div class="zc-head-row">' + backHtml('#zoco', 'Volver al Zoco') + '</div>' +
        '<h1 class="zc-h1" tabindex="-1">El Zoco de Dralingo</h1></header><div class="zc-body"><div class="md-wait"><img src="' + ZOCO_ART.hello + '" alt="" width="160" height="178">' +
        '<p>Ese personaje no está en el Zoco.</p><a class="md-btn is-gold" href="#zoco">Ver los personajes</a></div></div></section>';
    }
    const c = coinsNow() || 0;
    const cat = zCat(x.cat);
    const pct = Math.max(0, Math.min(100, Math.round((Math.max(0, c) / x.price) * 100)));
    const ready = !x.owned && c >= x.price;
    const using = x.owned && equipped() === x.id;
    let acts;
    if (x.owned) {
      acts = '<p class="zc-mine">' + I.check + '<span>¡Ya es tuyo!</span></p>' +
        (using ? '<p class="zc-using">' + I.check + '<span>Lo estás usando en tu perfil y en los juegos</span></p>'
          : '<button type="button" class="zc-btn is-gold" data-act="zoco-use" data-id="' + esc(x.id) + '">Usarlo</button>') +
        '<a class="zc-btn is-plain" href="#zoco">Volver al Zoco</a>';
    } else {
      const meter = '<div class="zc-meter-box"><div class="zc-meter-row"><span>' + esc('Tienes ' + Math.max(0, c) + ' de ' + x.price) + '</span>' +
        '<span class="' + (ready ? 'zc-meter-ok' : 'zc-meter-left') + '">' + esc(ready ? '¡Ya te alcanza!' : 'Te faltan ' + (x.price - Math.max(0, c))) + '</span></div>' +
        '<div class="zc-meter" role="img" aria-label="' + pct + ' por ciento"><i style="width:' + pct + '%"></i></div></div>';
      const sure = zConfirm === x.id && ready;
      acts = meter + (ready
        ? (sure
          ? '<p class="zc-sure">' + esc('Te quedan ' + coinsWord(c - x.price) + ' después.') + '</p>' +
            '<button type="button" class="zc-btn is-gold" data-act="zoco-buy" data-id="' + esc(x.id) + '">¡Sí, desbloquear!</button>' +
            '<button type="button" class="zc-btn is-plain" data-act="zoco-nobuy">No, todavía no</button>'
          : '<button type="button" class="zc-btn is-gold" data-act="zoco-sure" data-id="' + esc(x.id) + '">' + I.lock + '<span>' + esc('Desbloquear por ' + x.price) + '</span></button>')
        : '<button type="button" class="zc-btn is-off" disabled>' + I.lock + '<span>' + esc('Desbloquear por ' + x.price) + '</span></button>' +
          '<a class="zc-btn is-rojo" href="#monedas">Gana las monedas que te faltan</a>');
    }
    return '<section class="zc zc-item" aria-labelledby="zc-h">' +
      '<div class="zc-stage"><picture><source media="(min-width: 700px)" srcset="' + ZOCO_ART.bg + '"><img class="zc-stage-bg" src="' + ZOCO_ART.bgS + '" alt="" decoding="async"></picture>' +
        '<i class="zc-shadow" aria-hidden="true"></i>' + pic(x, 'zc-stage-img', false) +
        '<div class="zc-stage-top">' + backHtml('#zoco', 'Volver al Zoco') + purseHtml('is-small') + '</div></div>' +
      '<div class="zc-sheet"><div class="zc-sheet-t"><span class="zc-tag">' + esc(cat.tag) + '</span>' +
        '<h1 class="zc-h1 is-dark" id="zc-h" tabindex="-1">' + esc(x.name) + '</h1><p class="zc-blurb">' + esc(x.blurb) + '</p></div>' +
        acts + '<p class="zc-msg" id="zc-msg" aria-live="polite">' + esc(zMsg || '') + '</p></div></section>';
  }
  // ── #monedas: «¿Cómo gano monedas?» ──
  function zocoCoinsHtml() {
    const ways = (Z.ways || []).map((w) => '<li class="zc-way"><span class="zc-way-n">' + esc(w.n) + '</span>' +
      '<span class="zc-way-t"><b>' + esc(w.what) + '</b><span>' + esc(w.where) + '</span></span>' +
      '<span class="zc-way-c">' + I.coinS + '<b>' + esc('+' + w.coins + (w.each ? ' c/u' : '')) + '</b></span></li>').join('');
    const wait = Z.waiting > 0 ? '<p class="zc-note">' + I.coinS + '<span>' + esc('Tienes ' + coinsWord(Z.waiting) + ' esperando: llegan mañana. Cada día pagan hasta ' + (Z.caps.seal / 2) + ' palabras y ' + (Z.caps.hw / 50) + ' tareas.') + '</span></p>' : '';
    return '<section class="zc zc-coins" aria-labelledby="zc-h">' +
      '<header class="zc-head zc-head-art">' + backHtml('#zoco', 'Volver al Zoco') +
        '<div class="zc-head-split"><div class="zc-head-t"><h1 class="zc-h1" id="zc-h" tabindex="-1">¿Cómo gano monedas?</h1>' +
          '<p class="zc-sub">Cada paso de verdad te da monedas. Nunca se compran con dinero.</p></div>' +
          '<img class="zc-head-img" src="' + ZOCO_ART.point + '" alt="" width="118" height="171" decoding="async"></div></header>' +
      '<div class="zc-body">' + (debtNow() ? '<p class="zc-note">' + I.coinS + '<span>' + esc('Una tarea se deshizo después de gastar sus monedas: tus próximas ' + coinsWord(debtNow()) + ' la pagan.') + '</span></p>' : '') +
        '<ol class="zc-ways">' + ways + '</ol>' + wait +
        '<p class="zc-soon">' + I.lock + '<span>Desafío del día: muy pronto también da monedas</span></p>' +
        '<button type="button" class="zc-btn is-rojo zc-cta" data-act="today">¡A ganar monedas!</button></div></section>';
  }
  // ── #tuyo-<id>: «¡Ya es tuyo!» ──
  function zocoNewHtml(id) {
    const x = zItem(id);
    if (!x || !x.owned) return zocoItemHtml(id);
    const she = ZOCO_SHE.indexOf(x.id) >= 0;
    const using = equipped() === x.id;
    return '<section class="zc zc-new" aria-labelledby="zc-h">' +
      '<svg class="zc-rays" viewBox="0 0 390 420" aria-hidden="true" focusable="false"><g fill="#b88b2c" opacity=".35">' +
        '<path d="M195 210 L170 0 L220 0 Z"/><path d="M195 210 L330 20 L370 60 Z"/><path d="M195 210 L390 170 L390 230 Z"/>' +
        '<path d="M195 210 L370 380 L320 410 Z"/><path d="M195 210 L60 410 L20 380 Z"/><path d="M195 210 L0 230 L0 170 Z"/><path d="M195 210 L20 60 L60 20 Z"/></g>' +
        '<circle cx="195" cy="210" r="120" fill="#e8c878" opacity=".25"/></svg>' +
      '<span class="zc-new-chip">¡Nuevo personaje!</span>' +
      '<h1 class="zc-new-h" id="zc-h" tabindex="-1">¡Ya es tuyo!</h1>' + pic(x, 'zc-new-img', false) +
      '<p class="zc-new-name">' + esc(x.name) + '</p>' +
      '<p class="zc-new-sub">' + esc(using ? 'Ya juegas con ' + (she ? 'ella' : 'él') + ' en tu clase y aparece en tu perfil.' : 'Desde hoy puedes jugar con ' + (she ? 'ella' : 'él') + ' en tu clase y verl' + (she ? 'a' : 'o') + ' en tu perfil.') + '</p>' +
      '<div class="zc-new-acts">' + (using ? '<a class="zc-btn is-gold" href="#personaje">Ver mis personajes</a>'
        : '<button type="button" class="zc-btn is-gold" data-act="zoco-use-now" data-id="' + esc(x.id) + '">Usarlo ahora</button>') +
        '<a class="zc-new-back" href="#zoco">Volver al Zoco</a></div>' +
      '<p class="zc-msg is-light" id="zc-msg" aria-live="polite">' + esc(zMsg || '') + '</p></section>';
  }
  // ── #personaje: «Elige tu personaje» (Mi perfil) ──
  function zocoPickHtml() {
    const S = window.Saga;
    const cur = equipped();
    const mine = (Z.items || []).filter((x) => x.owned);
    const free = S && Array.isArray(S.AVATARS) ? S.AVATARS : [];
    const curSkin = mine.find((x) => x.id === cur);
    const curFree = !curSkin && S ? (S.avatar(cur) || S.avatar('dralingo')) : null;
    const curName = curSkin ? curSkin.name : curFree ? S.labelOf(curFree.id) : 'Dralingo';
    const curImg = curSkin ? '<img class="zc-now-img is-body" src="' + esc(curSkin.full) + '" alt="' + esc(curName) + '">'
      : '<img class="zc-now-img" src="' + esc(curFree ? curFree.url : ZOCO_ART.hello) + '" alt="' + esc(curName) + '">';
    const tile = (id, img, name, body) => '<button type="button" class="zc-pick' + (cur === id ? ' is-on' : '') + '" data-act="zoco-pick" data-id="' + esc(id) + '" aria-pressed="' + (cur === id) + '">' +
      '<img class="' + (body ? 'is-body' : 'is-head') + '" src="' + esc(img) + '" alt="" loading="lazy" decoding="async"><span>' + esc(name) + '</span></button>';
    // (every character you have is a round head, like the free ones: one look for the whole list)
    const owned = mine.slice().reverse().map((x) => tile(x.id, x.head || x.full, x.name, !x.head)).join('') +
      free.map((a) => tile(a.id, a.url, S.labelOf(a.id), false)).join('');
    const locked = (Z.items || []).filter((x) => !x.owned).map((x) => '<a class="zc-pick is-locked" href="#zoco-' + esc(x.id) + '">' +
      '<img class="is-body" src="' + esc(x.full) + '" alt="" loading="lazy" decoding="async"><span>' + esc(x.name) + '</span>' +
      '<span class="zc-pick-price">' + I.lock + '<b>' + x.price + '</b></span></a>').join('');
    return '<section class="zc zc-pickpage" aria-labelledby="zc-h">' +
      '<header class="zc-pick-head">' + backHtml('#perfil', 'Mi perfil', 'is-sand') + '<h1 class="zc-h1 is-dark" id="zc-h" tabindex="-1">Elige tu personaje</h1></header>' +
      '<div class="zc-now"><div class="zc-now-art">' + curImg + '</div><div class="zc-now-t"><span>Ahora juegas con</span><b>' + esc(curName) + '</b>' +
        '<span class="zc-now-ok">' + I.check + '<span>En tu perfil y en los juegos</span></span></div></div>' +
      '<div class="zc-body"><h2 class="zc-h2 is-small">Tus personajes</h2><div class="zc-grid3">' + owned + '</div>' +
        (locked ? '<h2 class="zc-h2 is-small">En el Zoco</h2><div class="zc-grid3">' + locked + '</div>' : '') +
        '<p class="zc-msg" id="zc-msg" aria-live="polite">' + esc(zMsg || '') + '</p>' +
        '<a class="zc-earn is-slim" href="#zoco">' + I.coin + '<span class="zc-earn-t"><b>El Zoco de Dralingo</b><span>' + esc(coinsWord(coinsNow() || 0) + ' para personajes nuevos') + '</span></span>' + I.fwd + '</a></div></section>';
  }
  // the phone home's door to the Zoco, after the path (a laptop has its tile in the dock): a character's picture, the coins
  const DOOR_PICS = ['dralingo-emperador-qin', 'dralingo-fuego-azul', 'dralingo-sheikh-paseo', 'bebe-dralingo-kufiya', 'dralingo-emperador-barba'];
  let doorPic = null;
  function zocoDoorHtml() {
    const c = coinsNow();
    if (c == null) return '';
    if (!doorPic) doorPic = DOOR_PICS[Math.floor(Math.random() * DOOR_PICS.length)];
    return '<a class="md-zoco" href="#zoco"><img src="' + A + 'zoco/full/' + doorPic + '.webp" alt="" width="96" height="80" loading="lazy" decoding="async">' +
      '<span class="md-zoco-t"><b>El Zoco de Dralingo</b><small>Personajes nuevos para ti</small></span>' +
      '<span class="md-zoco-c">' + I.coinS + '<b data-coins>' + c + '</b></span>' + I.fwd + '</a>';
  }
  function zocoHtml(v) {
    if (!Z || zFor !== codeNow() || !Z.student) return zocoWaitHtml(v.kind);
    if (v.kind === 'item') return zocoItemHtml(v.id);
    if (v.kind === 'monedas') return zocoCoinsHtml();
    if (v.kind === 'tuyo') return zocoNewHtml(v.id);
    if (v.kind === 'personaje') return zocoPickHtml();
    return zocoMainHtml();
  }
  // the buttons
  function zSay(text) { zMsg = text || null; const m = $('zc-msg'); if (m) m.textContent = text || ''; }
  function zocoBuy(id, btn) {
    if (btn) btn.disabled = true;
    zSay('');
    zPost('/api/zoco/buy', { id }).then((r) => {
      zConfirm = '';
      if (r && r.ok) {
        if (Z) { Z.coins = r.coins; Z.own = r.own || Z.own; (Z.items || []).forEach((x) => { if ((r.own || []).indexOf(x.id) >= 0) x.owned = true; }); }
        if (D && D.zoco) D.zoco.coins = r.coins;
        zAt = 0;
        if (!calm()) { try { const s = new Audio('/assets/mochi/star.mp3'); s.volume = 0.6; const p = s.play(); if (p && p.catch) p.catch(() => {}); } catch (_) {} }
        setHash('tuyo-' + id);
        return;
      }
      if (btn) btn.disabled = false;
      if (r && r.status === 409 && r.why !== 'owned') { zocoLoad(true); return; }   // (another phone of this kid: settle again)
      if (r && r.why === 'owned') { zocoLoad(true).then(() => setHash('tuyo-' + id)); return; }
      zSay(r && r.why === 'coins' ? (r.error || 'Te faltan monedas.') : r && r.status === 403 ? 'Entra de nuevo con tu código para usar el Zoco.' : 'No se pudo desbloquear. Revisa tu internet y vuelve a intentarlo.');
      if (r && r.why === 'coins') zocoLoad(true);
    });
  }
  function zocoUse(id, btn, then) {
    if (btn) btn.disabled = true;
    zSay('');
    zPost('/api/zoco/equip', { id }).then((r) => {
      if (btn) btn.disabled = false;
      if (r && r.ok) {
        if (H && H.setAvatar) H.setAvatar(id);
        if (Z) Z.equipped = id;
        zMsg = null;
        if (then) setHash(then); else draw();
        return;
      }
      zSay(r && r.status === 403 && r.why === 'owned' ? 'Ese personaje todavía no es tuyo.' : 'No se pudo cambiar. Revisa tu internet y vuelve a intentarlo.');
    });
  }

  // ── drawing ──
  // the parts homework.js fills (Mis oraciones, Mis exámenes) go back to their shelf before a redraw, never destroyed
  function park() {
    const shelf = document.querySelector('#screen-list .md-parts');
    if (!shelf) return;
    ['md-sent', 'hw-myexams-list'].forEach((id) => { const el = $(id); if (el && el.parentNode !== shelf) shelf.appendChild(el); });
  }
  function stopCards() { if (cards) { try { cards.stop(); } catch (_) {} cards = null; } }
  function asideHtml(v) {
    if (v.kind === 'mensajes') return msgsHtml('aside');
    if (v.kind === 'oraciones') return sentHtml('aside');
    if (v.kind === 'desafio') return desafioHtml('aside');
    if (v.kind === 'dorado') return doradoHtml('aside');
    // (the home on a laptop: «Hoy»'s place beside the path; El Simulacro Dorado when that is today's step)
    if (v.kind === 'home' && M.hoy && M.hoy.dorado) return doradoHtml('aside');
    const e = expFor(v);
    return e ? expHtml(e, 'aside') : doradoHtml('aside');
  }
  // the experience a view shows: #exp-N, else today's (the aside on a laptop always shows one)
  function expFor(v) {
    if (!M || !M.exps.length) return null;
    if (v.kind === 'exp') return M.exps.find((e) => e.n === v.n) || null;
    return M.exps.find((e) => e.today) || M.exps.find((e) => !e.done) || M.exps[0];
  }
  function draw() {
    const app = $('md-app');
    if (!H || !app) return;
    const s = H.state();
    park();
    stopCards();
    const W = wide();
    const scr = $('screen-list');
    let v = view;
    let out;
    // (review 2026-10-18) whatever fails while drawing, the kid keeps a way out: the band (Mi perfil, Papás), «Volver a
    // intentar» and «Salir», never an empty page
    try {
      M = model(D, s, marksNow());
      if (v.kind === 'exp' && M.ruta && !M.exps.some((e) => e.n === v.n)) v = { kind: 'home' };
      out = buildHtml(v, W, s);
    } catch (err) {
      console.error('[home] draw failed', err);
      M = { ruta: false, levelName: s.levelName || '', exps: [], tareas: { byExp: {}, dorado: [], loose: [], readings: [] }, streak: { days: 0 } };
      out = { html: bandHtml(s) + '<main class="md-main md-page">' + brokenHtml() + '</main>', tabs: false };
      v = { kind: 'home' };
    }
    app.innerHTML = out.html;
    if (scr) { scr.classList.toggle('is-wide', W); scr.classList.toggle('has-tabs', out.tabs); }
    // (the tab's title in the kid's language: hw-i18n.js translates the page, not the title)
    const en = window.HwI18n && window.HwI18n.lang && window.HwI18n.lang() === 'en';
    document.title = (en ? 'My Dralingo' : 'Mi Dralingo') + (M.levelName ? ' · ' + M.levelName : '');
    try { mount(v); } catch (err) { console.error('[home] mount failed', err); }
  }
  function brokenHtml() {
    return '<div class="md-wait"><img src="' + ART.hello + '" alt="" width="160" height="178"><p>Algo salió mal al dibujar tu inicio.</p>' +
      '<button type="button" class="md-btn is-gold" data-act="retry">Volver a intentar</button>' +
      '<a class="md-btn is-plain" href="#perfil">Mi perfil y «Salir»</a></div>';
  }
  // the screen for a view (W = a laptop): { html, tabs } (no DOM: scripts/test-home.js reads it for every made-up kid)
  function buildHtml(v, W, s) {
    // 🪙 El Zoco's pages: full pages on a phone and a laptop (their own header and «Volver», no band, no tabs)
    if (isZoco(v)) return { html: nb('<main class="md-main md-page is-flush md-zc">' + zocoHtml(v) + '</main>'), tabs: false };
    let html = bandHtml(s);
    let tabs = false;
    if (!D) return { html: nb(html + '<main class="md-main md-page">' + loadingHtml() + '</main>'), tabs };
    const noRuta = !M.ruta;
    if (noRuta && (v.kind === 'exp' || v.kind === 'dorado')) v = { kind: 'home' };
    if (W) {
      const selE = noRuta ? '' : v.kind === 'exp' ? 'exp-' + v.n : v.kind === 'dorado' ? 'dorado'
        : v.kind === 'home' ? (M.hoy && M.hoy.dorado ? 'dorado' : expFor(v) ? 'exp-' + expFor(v).n : '') : '';
      const left = noRuta ? noRutaHtml() + allTareasHtml() : hoyHtml() + stripHtml() + pathHtml(selE);
      // (no route on this phone: the aside keeps the messages)
      const aside = noRuta && v.kind === 'home' ? msgsHtml('aside') : asideHtml(v);
      html += '<div class="md-grid"><div class="md-left">' + left + dockHtml(v.kind) + '</div>' +
        '<aside class="md-aside" id="md-aside" aria-label="Lo que elegiste">' + aside + '</aside></div>';
    } else {
      // (an experience and El Simulacro Dorado are pages of their own: their picture goes edge to edge, no band)
      if (v.kind === 'exp') html = '<main class="md-main md-page is-flush">' + expHtml(expFor(v), 'page') + '</main>';
      else if (v.kind === 'dorado') html = '<main class="md-main md-page is-flush">' + doradoHtml('page') + '</main>';
      else if (v.kind === 'mensajes') { html = msgsHtml('page'); tabs = true; }
      else if (v.kind === 'oraciones') { html = sentHtml('page'); tabs = true; }
      else if (v.kind === 'desafio') { html = desafioHtml('page'); tabs = true; }
      else {
        html += '<main class="md-main md-page">' + (noRuta ? noRutaHtml() + allTareasHtml() : hoyHtml() + stripHtml() + pathHtml('') + zocoDoorHtml()) + '</main>';
        tabs = true;
      }
      if (tabs) html += tabsHtml(v.kind === 'home' ? '' : v.kind);
    }
    return { html: nb(html), tabs };
  }
  // (scripts/test-home.js) the html of a view for a payload and a state, without a page: d = /api/homework/home, s = the
  // hooks' state, hash = '#exp-3'…, w = a laptop
  function htmlFor(d, s, hash, w) {
    const keepH = H, keepD = D, keepM = M;
    try {
      H = Object.assign({}, H || {}, { state: () => s });
      D = d;
      M = model(d, s, null);
      let v = parse(hash);
      if (v.kind === 'exp' && M.ruta && !M.exps.some((e) => e.n === v.n)) v = { kind: 'home' };
      return buildHtml(v, !!w, s).html;
    } finally { H = keepH; D = keepD; M = keepM; }
  }
  // after a draw: the homework cards (js/ruta.js), Mis oraciones, Mis exámenes, the moment of a finished experience
  function mount(v) {
    const box = document.querySelector('#md-app [data-hw-mount]');
    const e = box ? M.exps.find((x) => x.n === Number(box.getAttribute('data-hw-mount'))) : null;
    const m = modOf();
    if (box && e && ctxR && m && window.Ruta && window.Ruta.hwCards) {
      try { cards = window.Ruta.hwCards(box, ctxR, m, e.hws, { pic: e.pic, link: '?from=homework', onChange: soft }); } catch (err) { console.error('[home] the homework cards', err); }
    }
    // (asked again when the kid opens them, at most every 30 s: a redraw for a new message never refetches them)
    const sm = document.querySelector('#md-app [data-sent-mount]');
    if (sm && $('md-sent')) { sm.appendChild($('md-sent')); if (Date.now() - sentAt > 30000) { sentAt = Date.now(); H.loadSentences(); } }
    const em = document.querySelector('#md-app [data-exams-mount]');
    if (em && $('hw-myexams-list')) { em.appendChild($('hw-myexams-list')); if (Date.now() - examsAt > 30000) { examsAt = Date.now(); H.loadMyExams(); } }
    if (v.kind === 'mensajes') { H.readAll(); inboxSig = sigOf(H.state().inbox, Number(H.state().unread) || 0); }
    // the whole experience done: Aileen and Dralingo pop in once per experience on this phone (the page's one moment)
    const party = document.querySelector('#md-app [data-party]');
    if (party && D && D.ruta) {
      const key = 'draly_home_party_' + (D.ruta.who || '') + '_' + D.slug;
      let seen = [];
      try { seen = JSON.parse(ls.get(key) || '[]'); } catch (_) { seen = []; }
      const n = Number(party.getAttribute('data-party'));
      if (Array.isArray(seen) && seen.indexOf(n) < 0) {
        seen.push(n);
        ls.set(key, JSON.stringify(seen.slice(-20)));
        if (!calm()) party.classList.add('is-new');
      }
    }
    // «Empezar aquí»: the step it opened comes forward
    if (focusStep) {
      const st = document.querySelector('#md-app #md-step-' + focusStep);
      const go = st && (st.querySelector('[data-step-go]') || st.querySelector('.md-btn, .rp-hw-play'));
      focusStep = 0;
      if (st) {
        try { st.scrollIntoView({ block: wide() ? 'nearest' : 'center', behavior: calm() ? 'auto' : 'smooth' }); } catch (_) { st.scrollIntoView(); }
        if (go) { try { go.focus({ preventScroll: true }); } catch (_) {} }
        if (!calm() && st.animate) { try { st.animate([{ boxShadow: '0 0 0 0 rgba(232, 200, 120, .9)' }, { boxShadow: '0 0 0 14px rgba(232, 200, 120, 0)' }], { duration: 900, delay: 250, easing: 'cubic-bezier(.23, 1, .32, 1)' }); } catch (_) {} }
      }
    }
  }
  // a homework mark (js/ruta.js): the bars, the badges and «Hoy» follow at once, the cards (and a sound playing) stay
  function soft() {
    if (!H || !D) return;
    M = model(D, H.state(), marksNow());
    M.exps.forEach((e) => {
      document.querySelectorAll('#md-app [data-bars="' + e.n + '"], #md-app [data-bars="x' + e.n + '"]').forEach((b) => { b.outerHTML = barsHtml(e.bars, b.getAttribute('data-bars')); });
      const left = document.querySelector('#md-app [data-left="' + e.n + '"]');
      if (left) { left.hidden = !e.left; left.textContent = e.left === 1 ? '1 por mandar' : e.left + ' por mandar'; }
      const node = document.querySelector('#md-app [data-node="' + e.n + '"]');
      if (node) { node.classList.toggle('is-done', e.done); }
    });
    const ht = $('md-hoy-t');
    if (ht && M.hoy) ht.textContent = nb(M.hoy.text);
    const hr = $('md-hoy-rem');
    if (hr) { if (M.hoy && M.hoy.remind) hr.textContent = M.hoy.remind.text; else if (hr.parentNode) hr.parentNode.hidden = true; }
    const of = $('md-ruta-of');
    if (of) of.textContent = ofText();
    M.exps.forEach((e) => { const p = document.querySelector('#md-app [data-aileen="' + e.n + '"]'); if (p) p.innerHTML = aileenText(e); });
    const sum = $('md-exp-sum');
    const box = document.querySelector('#md-app [data-hw-mount]');
    const e = box ? M.exps.find((x) => x.n === Number(box.getAttribute('data-hw-mount'))) : null;
    if (sum && e) sum.textContent = missingText(e);
  }

  // ═══════════════════════════════════════════════════════════════════
  // moving around
  // ═══════════════════════════════════════════════════════════════════
  // the top of the page (the page scrolls; an older page version's <body> scroll box too)
  function toTop() { try { window.scrollTo(0, 0); document.body.scrollTop = 0; } catch (_) {} }
  function route(fromTap) {
    view = parse(location.hash);
    if (!H || !H.state().code) return;
    if (view.kind === 'perfil') {
      stopCards();
      H.openPerfil();
      toTop();
      // («¿Cómo te llamas?» in the band: the name row opens, ready to type)
      if (!H.state().name) {
        const row = document.querySelector('#screen-settings details');
        const inp = $('hw-settings-name-input');
        if (row) row.open = true;
        if (inp && fromTap) { try { inp.focus({ preventScroll: true }); } catch (_) {} }
      }
      const h = document.querySelector('#screen-settings .md-pf-title');
      if (h && fromTap && H.state().name) { h.tabIndex = -1; try { h.focus({ preventScroll: true }); } catch (_) {} }
      return;
    }
    if (view.kind === 'desafio' && DESAFIO_LIVE && H.state().daily) { stopCards(); H.openDaily(); return; }
    if (H.screen() !== 'list') H.showList();
    const step = focusStep;                          // («Empezar aquí»: the step scrolls into view instead of the top)
    if ((!wide() || isZoco(view)) && !step) toTop();   // (🪙 El Zoco's pages are full pages on a laptop too)
    if (isZoco(view)) { zMsg = null; if (!(view.kind === 'item' && zConfirm === view.id)) zConfirm = ''; }
    draw();
    if (isZoco(view)) zocoLoad(false);
    if (fromTap && !step) {
      const h = document.querySelector(wide() ? '#md-aside h2, #md-aside h1' : '#md-app h1, #md-app h2');
      if (h && (view.kind !== 'home' || !wide())) { if (!h.hasAttribute('tabindex')) h.tabIndex = -1; try { h.focus({ preventScroll: true }); } catch (_) {} }
    }
  }
  window.addEventListener('hashchange', () => route(true));
  // where «Empezar aquí» and the Desafío's button go: today's experience at its step, El Simulacro Dorado, or a page
  function goToday() {
    const h = M && M.hoy;
    if (!h) { location.hash = ''; return; }
    if (h.href) { leaving(h.href); location.href = h.href; return; }
    if (h.wa) { setHash('dorado'); return; }
    if (h.dorado) { setHash('dorado'); return; }
    if (h.exp && h.step) { focusStep = h.step; setHash('exp-' + h.exp); return; }
    // («¡Vas muy bien!»: the path itself)
    setHash('');
    const t = $('md-ruta-t');
    if (t) { try { t.scrollIntoView({ block: 'start', behavior: calm() ? 'auto' : 'smooth' }); } catch (_) {} }
  }
  function setHash(h) {
    const want = h ? '#' + h : '';
    if ((location.hash || '') === want || (!h && !location.hash)) route(true);   // (the same view: draw it again, the step comes forward)
    else location.hash = want;
  }
  // a link out of the home (La Base, El Entrenamiento, a homework's audio, a golden book, the module page): that page's
  // «Volver» comes straight back here (js/entrenamiento.js, js/libro.js, js/audios.js read draly_home_from), and the home
  // opens again on the view the kid left (draly_home_view)
  function leaving(href) {
    try {
      const u = new URL(href, location.origin);
      if (u.origin !== location.origin) return;
      ss.set('draly_home_from', u.pathname);
      ss.set('draly_home_view', location.hash || '');
    } catch (_) { /* a plain link */ }
  }
  function copyMsg(btn) {
    const text = teacherMsg();
    const done = () => { const sp = btn.querySelector('span'); if (sp) sp.textContent = '¡Mensaje copiado!'; setTimeout(() => { if (sp && sp.isConnected) sp.textContent = 'Copiar mensaje'; }, 1800); };
    const fallback = () => {
      const t = document.createElement('textarea');
      t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0'; t.style.top = '0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); done(); } catch (_) { /* the message is in WhatsApp's button */ }
      t.remove();
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  }
  document.addEventListener('click', (e) => {
    const app = $('md-app');
    if (!app || !H || !app.contains(e.target)) return;
    const out = e.target.closest('a[data-out]');
    if (out) { leaving(out.getAttribute('href')); return; }
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.getAttribute('data-act');
    if (act === 'today') goToday();
    else if (act === 'remind') { focusStep = 3; setHash('exp-' + Number(t.getAttribute('data-exp'))); }
    else if (act === 'papas') H.openParents();
    else if (act === 'retry') { failed = false; draw(); load(true); }
    else if (act === 'relogin') location.reload();
    else if (act === 'trainer') H.openTrainer(Number(t.getAttribute('data-tier')), t.getAttribute('data-exp'));
    else if (act === 'review') H.review(t.getAttribute('data-id'), t.getAttribute('data-title'));
    else if (act === 'reading') H.openReading(t.getAttribute('data-story'));
    else if (act === 'reading-review') H.reviewReading(t.getAttribute('data-story'), t.getAttribute('data-title'));
    else if (act === 'copy-msg') copyMsg(t);
    else if (act === 'anim') { const m = (H.state().inbox || [])[Number(t.getAttribute('data-i'))]; if (m) H.replayAnim(m); }
    // 🪙 El Zoco: «Desbloquear» asks once more («¡Sí, desbloquear!»), then buys; «Usarlo» makes it their character
    else if (act === 'zoco-sure') { zConfirm = t.getAttribute('data-id') || ''; draw(); const b = document.querySelector('#md-app [data-act="zoco-buy"]'); if (b) { try { b.focus({ preventScroll: true }); } catch (_) {} } }
    else if (act === 'zoco-nobuy') { zConfirm = ''; draw(); }
    else if (act === 'zoco-buy') zocoBuy(t.getAttribute('data-id'), t);
    else if (act === 'zoco-use') zocoUse(t.getAttribute('data-id'), t, null);
    else if (act === 'zoco-use-now') zocoUse(t.getAttribute('data-id'), t, 'personaje');
    else if (act === 'zoco-pick') { if (t.getAttribute('aria-pressed') !== 'true') zocoUse(t.getAttribute('data-id'), t, null); }
    else if (act === 'zoco-retry') { zFail = false; draw(); zocoLoad(true); }
  });
  // Mi perfil's own buttons (homework.html #screen-settings): «Volver» = the home; the English switch (hw-i18n.js)
  document.addEventListener('click', (e) => {
    const en = e.target.closest('#md-pf-en');
    if (en && window.HwI18n) { window.HwI18n.toggle(); paintEn(); }
  });
  function paintEn() {
    const b = $('md-pf-en');
    if (b && window.HwI18n) b.setAttribute('aria-checked', String(window.HwI18n.lang() === 'en'));
  }
  // a laptop turned into a narrow window (or back): the right layout
  let wasWide = null;
  window.addEventListener('resize', () => {
    const w = wide();
    if (wasWide === null) { wasWide = w; return; }
    if (w !== wasWide) { wasWide = w; if (H && H.screen() === 'list' && !(window.Ruta && document.getElementById('au-player') && !document.getElementById('au-player').paused)) draw(); }
  });
  // back to this tab (another tab sealed words, practised, marked a homework): ask again
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && H && H.screen() === 'list') load(false); });
  window.addEventListener('pageshow', (e) => { if (e.persisted && H && H.screen() === 'list') load(true); });

  // ═══════════════════════════════════════════════════════════════════
  // what homework.js calls
  // ═══════════════════════════════════════════════════════════════════
  // render(hooks): the home is on screen (a login, a «Volver» from a tarea, Papás…)
  function render(hooks) {
    H = hooks;
    wasWide = wide();
    ss.set('draly_home_in', '1');            // (js/entrada.js: back from a trip, no second «¡Hola de nuevo!»)
    document.body.classList.add('md-in');    // (the floating 🌐 pill steps aside: the switch is in Mi perfil)
    paintEn();
    // back from a trip out with no view in the address: the view the kid left (an experience, El Simulacro Dorado)
    if (!location.hash) {
      const back = ss.get('draly_home_view');
      ss.del('draly_home_view');
      if (back && /^#(exp-\d{1,2}|dorado|mensajes|oraciones|desafio)$/.test(back)) { try { history.replaceState(null, '', location.pathname + location.search + back); } catch (_) {} }
    }
    view = parse(location.hash);
    if (view.kind === 'perfil') { setTimeout(() => { if (H.screen() === 'list') route(false); }, 0); view = { kind: 'home' }; }
    draw();
    load(false);
    if (isZoco(view)) zocoLoad(false);   // (🪙 a page opened on El Zoco's address: its data)
  }
  // the inbox as the page last drew it (review 2026-10-18: the 20-second poll redrew Mensajes every time)
  let inboxSig = '';
  const sigOf = (list, n) => (list || []).map((m) => m.id + ':' + (m.readAt ? 1 : 0)).join(',') + '|' + n;
  function changed(kind) {
    if (!H || H.screen() !== 'list') return;
    const n = Number(H.state().unread) || 0;
    document.querySelectorAll('#md-app [data-unread]').forEach((b) => { b.hidden = !n; b.textContent = n > 9 ? '9+' : String(n); });
    if (kind === 'inbox') {
      if (view.kind !== 'mensajes') return;
      const sig = sigOf(H.state().inbox, n);
      if (sig === inboxSig) return;          // (nothing new: the list stays as it is)
    }
    redraw();
  }
  // (a login on this tab: another kid, or another level: nothing of the last one stays)
  function reset() {
    D = null; M = null; ctxR = null; loadedAt = 0; failed = false; loadSeq++; sentAt = 0; examsAt = 0; stopCards();
    Z = null; zFor = ''; zAt = 0; zHero = null; zConfirm = ''; zMsg = null; zFail = false; zGift = false;   // (🪙 nothing of the last kid's purse stays)
  }
  // «▶ Siguiente» after a round: the next tarea not done of the same experience (or of El Simulacro Dorado's rounds,
  // or «De tu profe»), the one that just ended left out
  function next(exclude) {
    if (!M || !H) return null;
    const lists = Object.keys(M.tareas.byExp).map((n) => M.tareas.byExp[n]).concat([M.tareas.dorado, M.tareas.loose]);
    const list = lists.find((l) => l.some((x) => x.id === exclude)) || [];
    const it = list.find((x) => x.id !== exclude && x.status !== 'done');
    if (!it) return null;
    return { title: it.title, run: () => (it.kind === 'trainer' ? H.openTrainer(it.tier, it.exp) : H.openAssignment(it.id)) };
  }
  function go(where) {
    if (where === 'today') {
      if (H && H.screen() !== 'list') H.showList();
      if (!M) draw();
      goToday();
      return;
    }
    setHash(where);
  }
  window.DralyHome = { render, changed, reset, next, go, model, mapTareas, parse, htmlFor, DESAFIO_LIVE, get view() { return view; } };
})();
