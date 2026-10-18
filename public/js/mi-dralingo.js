// =========================================================================
// mi-dralingo.js · «Mi Dralingo» part 3: THE KID'S HOME on /homework (his approved design 2026-10-18, «ALL IS GOOD, YOU
// HAVE MY OKAY»: .claude/handoff/kidhome-design/Main.dc.html (laptop), Phone, Experiencia, Mensajes, Oraciones, Desafio,
// Perfil + ASSETS.md). His words: «completely functional… every button, every touch of interaction makes sense».
// =========================================================================
//   the band     the kid's avatar (→ Mi perfil), «¡Hola, <nombre>!», «N días seguidos» (a day counts with a real step:
//                core/student-records.js streakOf) and the level, «Papás» (part 2), «Mi perfil»
//   «Hoy»        the current experience's scene, Dralingo pointing and ONE direct instruction from js/papas-plan.js
//                today(): the SAME decision as Papás' «Lo más importante esta semana» (a homework to send → practice to
//                the goal → words to mark → tell the teacher). «Empezar aquí» opens that experience at its next step.
//                Below it, «De tu profe»: the teacher's tareas of no experience (custom tareas).
//   La Ruta      the level's experiences as a path of scene cards (8 for New HSK 1 and HSK 1, 6 for YCT 1): number, word
//                sticker, three little bars (palabras · práctica · tarea), done = green ✓, today's glows gold with
//                «¡Empieza aquí!», the rest calm; it ends at El Simulacro Dorado («En clase, con tu profe»). A laptop
//                (≥ 1000 px) shows it as a grid with the chosen experience beside it; a phone as a zig-zag whose cards open
//                the experience's own page.
//   experience   1 Palabras (its world of La Base: seals «N de M marcadas», a few word pictures, the base at #mundo-N)
//                → 2 Práctica (its world of El Entrenamiento, best % vs the goal, «Practicar aquí»; «De tu profe»: the
//                teacher's tareas of THIS experience: YCT 1's game rounds of the world, HSK 1's EXP sentence tarea and its
//                Sim-Trainer tiers) → 3 Tu tarea (its homework audios: «Escuchar», «¡Ya la mandé!», «Deshacer», the SAME
//                code as La Ruta Dorada's «Tus tareas», js/ruta.js Ruta.hwCards; Aileen's line in voseo). The whole
//                experience done: Aileen and Dralingo celebrate.
//   El Simulacro Dorado   class mode (the teacher runs it with a PIN): locked until El Entrenamiento is done, then
//                «Avisarle a mi profe» (WhatsApp / copy). It also holds the simulations taken in class with their libro
//                dorado, the exam's practice rounds («Simulacro del examen»), «Mis exámenes» and «Exámenes de lectura»
//                with «Ver mis errores».
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
    const push = (n, it) => (out.byExp[n] || (out.byExp[n] = [])).push(it);
    (Array.isArray(s.assignments) ? s.assignments : []).forEach((a, k) => {
      if (!a || !a.id) return;
      const att = subs.filter((x) => x.assignmentId === a.id);
      const tot = (x) => Number(x.total) || Number(a.totalPoints) || (a.itemCount ? a.itemCount * 20 : 100);
      const passed = att.some((x) => tot(x) > 0 && Number(x.score) * 100 >= tot(x) * PASS);
      const pct = att.length ? Math.round(Math.max.apply(null, att.map((x) => (Number(x.score) / tot(x)) * 100))) : null;
      const lab = String(a.expLabel || '');
      const quiz = a.type === 'pack-quiz';
      const title = String(a.title || 'Tarea').replace(/^EXP\s*\d+\s*·\s*/i, '');
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
          push(Number(m[1]), { kind: 'trainer', id, tier: tier.tier, exp, order: 1000 + Number(tier.tier),
            title: 'Entrenamiento de Simulación · ' + String(tier.title || 'Nivel ' + tier.tier), sub: row[exp] + ' preguntas del examen',
            status: best < 0 ? 'new' : best >= passPct ? 'done' : 'retry', pct: best < 0 ? null : best, tried: best >= 0 });
        });
      });
    }
    // the teacher's own tareas for this kid (custom): no experience, «De tu profe» under «Hoy»
    (Array.isArray(s.custom) ? s.custom : []).forEach((c) => {
      const a = c && c.a;
      if (!a || !a.id) return;
      const pct = c.best && c.best.total ? Math.round((Number(c.best.score) / Number(c.best.total)) * 100) : null;
      out.loose.push({ kind: 'custom', id: a.id, order: -1, title: a.title || 'Tarea especial', sub: (a.itemCount || 0) + ' oraciones',
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
      return { n: e.n, name: e.name, pic: x.pic || e.pic || '', peek: Array.isArray(x.peek) ? x.peek : [], scene: sceneOf(slug, e.n),
        sealed: e.sealed, count: e.count, best: e.best, open: !!e.open, train: e.train || null, hws, bars, next,
        left: hws.filter((h) => !(mk[h.id] && mk[h.id].s)).length, done: !!e.done,
        today: !!(t && !t.dorado && t.exp === e.n), started: bars.words !== 'none' || bars.practice !== 'none' || bars.tarea === 'half' || bars.tarea === 'done',
        teacher: tareas.byExp[e.n] || [] };
    });
    if (t && !t.dorado && !exps.some((e) => e.today)) { const c = exps.find((e) => e.n === p.current); if (c) c.today = true; }
    const open = r.open !== false;
    // «Hoy»: today() (the same decision as Papás); a level this phone can't open yet asks for its key first
    let hoy = null;
    if (!open) hoy = { kind: 'key', text: 'Escribe la clave de ' + levelName + ' para abrir tu Ruta Dorada.', href: r.key || '', exp: null, step: 0, dorado: false };
    else if (t) hoy = Object.assign({}, t, t.kind === 'tarea' && !t.exp && t.id ? { href: '/audios/' + t.id + '?from=homework' } : {});
    const teacherReady = !!(r.dorado && r.dorado.teacher);
    return Object.assign(base0, {
      ruta: true, slug, name: r.name || levelName, open, key: r.key || '', route: r.route || '/audios/' + slug, base: r.base || null,
      plan: p, today: t, hoy, exps, doneN: exps.filter((e) => e.done).length, goal: p.goal, sim: p.sim,
      dorado: { ready: !!(p.trainDone || teacherReady), passed: !!(p.sim && p.sim.passed), glow: !!(t && t.dorado), practiced: exps.filter((e) => e.bars.practice === 'done').length },
      books: Array.isArray(r.books) ? r.books : [], extra: r.extra || {}, hws: hwsAll, marks: mk, anyHw: hwsAll.length > 0,
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
    const url = '/api/homework/home?accessCode=' + encodeURIComponent(s.accessCode || '') + '&studentCode=' + encodeURIComponent(s.code);
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
        } else failed = !D;
        if (H && H.screen() === 'list') draw();
      });
  }

  // ═══════════════════════════════════════════════════════════════════
  // the screens
  // ═══════════════════════════════════════════════════════════════════
  function parse(hash) {
    const h = String(hash || '').replace(/^#/, '');
    let m = /^exp-(\d{1,2})$/.exec(h);
    if (m) return { kind: 'exp', n: Number(m[1]) };
    if (['dorado', 'mensajes', 'oraciones', 'desafio', 'perfil'].indexOf(h) >= 0) return { kind: h };
    return { kind: 'home' };
  }
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
    return '<header class="md-band"><div class="md-band-in">' +
      '<a class="md-av" href="#perfil" aria-label="Mi perfil"><img src="' + esc(s.avatarUrl) + '" alt="" width="46" height="46" decoding="async"></a>' +
      '<div class="md-hi"><p class="md-hi-t">' + (s.name ? esc('¡Hola, ' + s.name + '!') : '¡Hola!') + '</p>' +
        '<p class="md-hi-s">' + (st ? '<span class="md-streak' + (st.today ? ' is-today' : '') + '">' + I.fire + '<span>' + daysText(st.days) + '</span></span>' : '') +
          '<span class="md-lvl">' + esc(lvl) + '</span>' +
          (s.name ? '' : '<a class="md-askname" href="#perfil" data-ask-name>¿Cómo te llamas?</a>') + '</p></div>' +
      '<p class="md-brand" aria-hidden="true">Mi Dralingo</p>' +
      '<div class="md-band-acts"><button type="button" class="md-papas" data-act="papas">' + I.family + '<span>Papás</span></button>' +
        '<a class="md-perfil" href="#perfil" aria-label="Mi perfil">' + I.user + '<span class="md-perfil-t">Mi perfil</span></a></div>' +
      '</div></header>';
  }

  // ── «Hoy» ──
  function hoyHtml() {
    const h = M.hoy;
    const e = h && h.exp ? M.exps.find((x) => x.n === h.exp) : null;
    const small = h && h.dorado ? ART.dubaiS : e ? e.scene : (M.exps[0] ? M.exps[0].scene : ART.dubaiS);
    const kicker = e ? 'Hoy · Experiencia ' + e.n : h && h.dorado ? 'Hoy · El Simulacro Dorado' : 'Hoy';
    const btn = !h ? '' : h.href ? '<a class="md-go" href="' + esc(h.href) + '"' + (h.kind === 'key' ? '' : ' data-out') + '><span>' + (h.kind === 'key' ? 'Escribir la clave' : 'Empezar aquí') + '</span>' + I.go + '</a>'
      : '<button type="button" class="md-go" data-act="today"><span>Empezar aquí</span>' + I.go + '</button>';
    // (the big scene only on a laptop: 30 phones in a class each take the small one)
    return '<section class="md-hoy" aria-labelledby="md-hoy-k">' +
      '<picture><source media="(min-width: 1000px)" srcset="' + esc(bigOf(small)) + '">' +
        '<img class="md-hoy-bg" src="' + esc(small) + '" alt="" decoding="async" fetchpriority="high"></picture>' +
      '<span class="md-hoy-shade" aria-hidden="true"></span>' +
      '<div class="md-hoy-in"><p class="md-hoy-k" id="md-hoy-k">' + esc(kicker) + '</p>' +
        '<p class="md-hoy-t" id="md-hoy-t">' + esc(h ? h.text : '') + '</p>' + btn + '</div>' +
      '<img class="md-hoy-dr" src="' + ART.point + '" alt="Dralingo señala lo que toca hoy" width="332" height="480" decoding="async" fetchpriority="high">' +
      '</section>';
  }
  // a teacher's tarea («De tu profe»): its name, its mark (Nueva / Otra vez / ✓ done = green), its button, «Ver mis errores»
  function tpRow(it) {
    const chip = it.status === 'done' ? '<span class="md-tp-chip is-done">' + I.check + (it.pct != null ? it.pct + ' %' : 'Hecha') + '</span>'
      : it.status === 'retry' ? '<span class="md-tp-chip is-retry">' + (it.pct != null ? it.pct + ' %' : 'Otra vez') + '</span>'
        : '<span class="md-tp-chip is-new">Nueva</span>';
    const label = it.status === 'done' ? 'Otra vez' : it.status === 'retry' ? 'Seguir' : 'Hacer';
    const go = it.kind === 'trainer'
      ? '<button type="button" class="md-tp-go" data-act="trainer" data-tier="' + esc(it.tier) + '" data-exp="' + esc(it.exp) + '">' + label + '</button>'
      : '<button type="button" class="md-tp-go" data-assignment-id="' + esc(it.id) + '">' + label + '</button>';
    const rev = it.kind === 'asg' && it.tried ? '<button type="button" class="md-tp-rev" data-act="review" data-id="' + esc(it.id) + '" data-title="' + esc(it.title) + '">Ver mis errores</button>' : '';
    return '<li class="md-tp is-' + it.status + '"><span class="md-tp-t"><b>' + esc(it.title) + '</b><small>' + esc(it.sub) + '</small></span>' + chip +
      '<span class="md-tp-acts">' + go + rev + '</span></li>';
  }
  function profeHtml() {
    const list = M.tareas.loose;
    if (!list.length) return '';
    const todo = list.filter((x) => x.status !== 'done');
    const done = list.filter((x) => x.status === 'done');
    return '<section class="md-profe" aria-labelledby="md-profe-t">' +
      '<img class="md-profe-fer" src="' + ART.ferHello + '" alt="" width="200" height="240" loading="lazy" decoding="async">' +
      '<div class="md-profe-in"><h2 class="md-h2" id="md-profe-t">De tu profe</h2>' +
        (todo.length ? '<ul class="md-tp-list">' + todo.map(tpRow).join('') + '</ul>' : '<p class="md-quiet">¡Hiciste todas las tareas de tu profe!</p>') +
        (done.length ? '<details class="md-done-list"><summary>' + I.check + '<span>' + (done.length === 1 ? '1 hecha' : done.length + ' hechas') + '</span></summary>' +
          '<ul class="md-tp-list">' + done.map(tpRow).join('') + '</ul></details>' : '') +
      '</div></section>';
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
  function goldNodeHtml(sel) {
    const pend = M.tareas.dorado.filter((x) => x.status !== 'done').length;
    const d = M.dorado;
    const cls = 'md-node md-gold' + (d.glow ? ' is-today' : d.passed ? ' is-done' : '') + (sel ? ' is-sel' : '');
    return '<li class="md-node-li md-gold-li"><a class="' + cls + '" href="#dorado" aria-label="El Simulacro Dorado: en clase, con tu profe"' + (sel ? ' aria-current="true"' : '') + '>' +
      '<span class="md-node-art"><img class="md-node-scene" src="' + ART.dubaiS + '" alt="" width="480" height="270" loading="lazy" decoding="async">' +
        '<img class="md-gold-star" src="' + ART.star + '" alt="" width="200" height="220" loading="lazy" decoding="async">' +
        (d.glow ? '<span class="md-node-tag">¡Empieza aquí!</span>' : d.passed ? '<span class="md-node-ok">' + I.check + '</span>'
          : pend ? '<span class="md-node-badge">' + (pend === 1 ? '1 ronda' : pend + ' rondas') + '</span>' : '') + '</span>' +
      '<span class="md-node-name md-gold-name">El Simulacro Dorado</span><span class="md-gold-sub">En clase, con tu profe</span></a></li>';
  }
  function pathHtml(sel) {
    const nodes = M.exps.map((e, i) => nodeHtml(e, i, sel === 'exp-' + e.n)).join('') + goldNodeHtml(sel === 'dorado');
    const legend = '<p class="md-legend" aria-hidden="true"><span>Las ' + (M.anyHw ? '3' : '2') + ' rayitas:</span>' +
      '<span><i class="is-done"></i>palabras</span><span><i class="is-done"></i>práctica</span>' + (M.anyHw ? '<span><i class="is-done"></i>tarea mandada</span>' : '') + '</p>';
    return '<section class="md-ruta" aria-labelledby="md-ruta-t">' +
      '<div class="md-ruta-head"><h1 class="md-ruta-t" id="md-ruta-t" tabindex="-1">La Ruta Dorada</h1>' +
        '<span class="md-ruta-of" id="md-ruta-of">' + M.doneN + ' de ' + M.exps.length + ' experiencias listas</span></div>' +
      '<ol class="md-path" aria-label="Las experiencias de ' + esc(M.levelName) + '">' + nodes + '</ol>' +
      '<div class="md-ruta-foot">' + legend +
        '<a class="md-ruta-all" href="' + esc(M.route) + '?from=homework" data-out>' + I.book + '<span>Ver toda La Ruta Dorada de ' + esc(M.levelName) + '</span></a></div>' +
      '</section>';
  }

  // ── an experience: 1 Palabras → 2 Práctica → 3 Tu tarea ──
  function missingText(e) {
    const left = [];
    if (e.bars.words !== 'done') left.push('las palabras');
    if (e.bars.practice !== 'done') left.push('la práctica');
    if (e.bars.tarea !== 'done' && e.bars.tarea !== 'na') left.push('tu tarea');
    if (!left.length) return e.done ? '¡Experiencia lista! Puedes repasar cuando quieras.' : 'Tu profe te manda la tarea en clase.';
    return 'Te falta: ' + (left.length === 1 ? left[0] : left.slice(0, -1).join(', ') + ' y ' + left[left.length - 1]) + '.';
  }
  function stepState(e, k, done) {
    if (done) return 'done';
    return e.next === k ? 'next' : 'todo';
  }
  const baseHref = (n) => (M.base ? M.base.href + '?from=homework#mundo-' + n : M.route + '?from=homework');
  function expHtml(e, mode) {
    const page = mode === 'page';
    const s1 = !M.open ? 'locked' : stepState(e, 1, e.bars.words === 'done');
    const s2 = !M.open ? 'locked' : !e.open ? 'closed' : stepState(e, 2, e.bars.practice === 'done');
    const s3 = !e.hws.length ? 'soon' : stepState(e, 3, e.bars.tarea === 'done');
    const tag = (st) => (st === 'next' ? '<span class="md-step-tag">¡Empieza aquí!</span>' : '');
    const num = (st, k) => '<span class="md-step-n">' + (st === 'done' ? I.check : st === 'locked' || st === 'closed' ? I.lock : k) + '</span>';
    const peek = e.peek.slice(0, page ? 4 : 3).map((src) => '<img src="' + esc(src) + '" alt="" width="200" height="200" loading="lazy" decoding="async">').join('');
    const w1 = e.bars.words === 'done' ? 'Repasar' : e.bars.words === 'half' ? 'Seguir' : 'Empezar';
    const step1 = '<li class="md-step is-' + s1 + '" id="md-step-1" data-step="1">' + tag(s1) +
      '<div class="md-step-row">' + num(s1, 1) + '<div class="md-step-txt"><h3 class="md-step-t">1 · Palabras <small>La Base</small></h3>' +
        '<p class="md-step-l">' + (s1 === 'locked' ? 'Se abre con la clave de ' + esc(M.levelName) + '.' : e.sealed + ' de ' + e.count + ' marcadas') + '</p></div>' +
        (s1 === 'locked' ? '<a class="md-btn is-gold" href="' + esc(M.key) + '">Escribir la clave</a>'
          : '<a class="md-btn ' + (s1 === 'next' ? 'is-gold' : s1 === 'done' ? 'is-soft' : 'is-plain') + '" href="' + esc(baseHref(e.n)) + '" data-out data-step-go>' + w1 + '</a>') + '</div>' +
      (peek && s1 !== 'locked' ? '<div class="md-peek" aria-hidden="true">' + peek + '</div>' : '') + '</li>';
    const pct = e.best == null ? 0 : Math.min(100, Math.round((e.best / M.goal) * 100));
    const pinyin = e.n === 1 && M.extra && M.extra.pinyin && M.open
      ? '<a class="md-also" href="' + esc(M.extra.pinyin.href) + '" data-out>También: Pinyin básico' + (M.extra.pinyin.best != null ? ' · ' + M.extra.pinyin.best + ' %' : '') + '</a>' : '';
    const step2 = '<li class="md-step is-' + s2 + '" id="md-step-2" data-step="2">' + tag(s2) +
      '<div class="md-step-row"><img class="md-step-art" src="' + ART.power + '" alt="" width="200" height="220" loading="lazy" decoding="async">' +
        '<div class="md-step-txt"><h3 class="md-step-t">2 · Práctica <small>El Entrenamiento</small></h3>' +
          (s2 === 'locked' ? '<p class="md-step-l">Se abre con la clave de ' + esc(M.levelName) + '.</p>'
            : s2 === 'closed' ? '<p class="md-step-l">Se abre cuando marques todas sus palabras.</p>'
              : '<span class="md-meter"><i style="width:' + pct + '%"></i></span><p class="md-step-l">' + (e.best == null ? 'Meta: ' + M.goal + ' % en una ronda de 10' : 'Tu mejor ronda: ' + e.best + ' %<br>Meta: ' + M.goal + ' %') + '</p>') + '</div>' +
        (s2 === 'locked' ? '' : s2 === 'closed' ? '<a class="md-btn is-plain" href="' + esc(baseHref(e.n)) + '" data-out>Marcar palabras</a>'
          : '<a class="md-btn ' + (s2 === 'next' ? 'is-gold' : s2 === 'done' ? 'is-soft' : 'is-plain') + '" href="' + esc(e.train || M.route + '/entrenamiento') + '" data-out data-step-go>' + (e.bars.practice === 'done' ? 'Otra ronda' : 'Practicar aquí') + '</a>') + '</div>' +
      pinyin +
      (e.teacher.length ? '<div class="md-tp-box"><p class="md-tp-k"><img src="' + ART.ferHello + '" alt="" width="40" height="40" loading="lazy" decoding="async"><span>De tu profe</span></p>' +
        '<ul class="md-tp-list">' + e.teacher.map(tpRow).join('') + '</ul></div>' : '') + '</li>';
    const step3 = '<li class="md-step is-' + s3 + '" id="md-step-3" data-step="3">' + tag(s3) +
      '<div class="md-step-row">' + num(s3 === 'soon' ? 'todo' : s3, 3) + '<div class="md-step-txt"><h3 class="md-step-t">3 · Tu tarea <small>Se manda por WhatsApp</small></h3></div>' +
        '<span class="md-badge" data-left="' + e.n + '"' + (e.left && e.hws.length ? '' : ' hidden') + '>' + (e.left === 1 ? '1 por mandar' : e.left + ' por mandar') + '</span></div>' +
      (e.hws.length ? '<div class="md-say"><img src="' + ART.aileenTalk + '" alt="Aileen" width="312" height="480" loading="lazy" decoding="async">' +
          '<p>«¡Dale! Escuchá el audio, grabá tu video y mandáselo a tu profe por WhatsApp. Después tocá <b>¡Ya la mandé!</b>»</p></div>' +
          '<div class="md-hw" data-hw-mount="' + e.n + '"></div>'
        : '<p class="md-step-l md-soon">Tu profe te manda esta tarea cuando lleguen a esta experiencia en clase.</p>') + '</li>';
    const party = e.done ? '<div class="md-party" data-party="' + e.n + '"><img src="' + ART.aileenWin + '" alt="" width="200" height="240" loading="lazy" decoding="async">' +
      '<p>«¡Qué crack! Terminaste esta experiencia.»</p><img src="' + ART.dralingoWin + '" alt="" width="200" height="240" loading="lazy" decoding="async"></div>' : '';
    const hero = '<header class="md-exp-hero"><img class="md-exp-bg" src="' + esc(e.scene) + '" alt="" width="480" height="270" decoding="async">' +
      '<span class="md-exp-shade" aria-hidden="true"></span>' +
      (page ? '<a class="md-back md-back-glass" href="#">' + I.back + '<span>La Ruta Dorada</span></a>' : '') +
      (e.pic ? '<img class="md-exp-pic" src="' + esc(e.pic) + '" alt="" width="200" height="200" decoding="async">' : '') +
      '<div class="md-exp-t"><p>Experiencia ' + e.n + '</p><h2 class="md-exp-h" id="md-exp-h" tabindex="-1">' + esc(e.name) + '</h2></div></header>';
    return '<section class="md-exp' + (page ? ' is-page' : ' is-aside') + (e.done ? ' is-done' : '') + '" aria-labelledby="md-exp-h">' + hero +
      '<div class="md-exp-body"><div class="md-exp-sum"><p id="md-exp-sum">' + esc(missingText(e)) + '</p>' + barsHtml(e.bars, 'x' + e.n) + '</div>' +
      '<ol class="md-steps">' + step1 + step2 + step3 + '</ol>' + party +
      (page ? '<a class="md-back md-back-foot" href="#">' + I.back + '<span>Volver a La Ruta Dorada</span></a>' : '') + '</div></section>';
  }

  // ── El Simulacro Dorado ──
  function teacherMsg() {
    const s = H.state();
    return '¡Hola, profe! ' + (s.name ? 'Soy ' + s.name + '. ' : '') + 'Terminé El Entrenamiento de ' + M.levelName + '. ¡Ya puedo hacer El Simulacro Dorado!';
  }
  function doradoHtml(mode) {
    const page = mode === 'page';
    const d = M.dorado;
    const s = H.state();
    let state;
    if (d.passed) state = '<div class="md-dor-state is-done"><span class="md-step-n">' + I.check + '</span><p>¡Aprobaste El Simulacro Dorado con ' + M.sim.percent + ' %!</p></div>';
    else if (d.ready) {
      state = '<div class="md-dor-state is-ready"><p class="md-dor-big">¡Ya estás listo para El Simulacro Dorado!</p>' +
        '<p>Avísale a tu profe: lo hacen en clase, con un PIN.</p>' +
        '<div class="md-dor-acts"><a class="md-btn is-green" href="' + esc('https://wa.me/?text=' + encodeURIComponent(teacherMsg())) + '" target="_blank" rel="noopener">' + I.wa + '<span>Avisarle a mi profe</span></a>' +
        '<button type="button" class="md-btn is-plain" data-act="copy-msg">' + I.copy + '<span>Copiar mensaje</span></button></div></div>';
    } else {
      const coins = M.exps.map((e) => '<li class="' + (e.bars.practice === 'done' ? 'is-done' : e.bars.practice === 'half' ? 'is-half' : '') + '" title="Experiencia ' + e.n + '">' + (e.bars.practice === 'done' ? I.check : e.n) + '</li>').join('');
      state = '<div class="md-dor-state is-locked"><span class="md-step-n">' + I.lock + '</span><div><p>Se abre en clase con tu profe, cuando termines El Entrenamiento.</p>' +
        '<p class="md-dor-count">' + d.practiced + ' de ' + M.exps.length + ' prácticas con ' + M.goal + ' %</p><ol class="md-coins" aria-hidden="true">' + coins + '</ol></div></div>';
    }
    const books = M.books.length
      ? '<ul class="md-books">' + M.books.map((b) => '<li><span class="md-book-n' + (b.passed ? ' is-done' : '') + '">' + (b.passed ? I.check : '') + 'Simulacro ' + b.n + ' · ' + b.percent + ' %</span>' +
          '<a class="md-btn is-plain" href="' + esc(b.book) + '" data-out>' + I.book + '<span>Libro dorado' + (b.mistakes ? ' · ' + (b.mistakes === 1 ? '1 error' : b.mistakes + ' errores') : '') + '</span></a></li>').join('') + '</ul>'
      : '<p class="md-quiet">Cuando hagas un simulacro en clase, aquí repasas tus errores en tu libro dorado.</p>';
    const ex = M.extra && M.extra.simulacro;
    const rounds = M.tareas.dorado;
    const practice = (ex || rounds.length) ? '<section class="md-dor-part"><h3 class="md-h3">Practica el examen</h3>' +
      (ex ? '<div class="md-dor-train">' + (ex.open ? '<a class="md-btn is-gold" href="' + esc(ex.href) + '" data-out>Simulacro del examen' + (ex.best != null ? ' · ' + ex.best + ' %' : '') + '</a>'
        : '<p class="md-quiet">' + I.lock + ' El simulacro de práctica se abre cuando todas tus experiencias estén listas para practicar.</p>') + '</div>' : '') +
      (rounds.length ? '<div class="md-tp-box"><p class="md-tp-k"><img src="' + ART.ferHello + '" alt="" width="40" height="40" loading="lazy" decoding="async"><span>De tu profe</span></p><ul class="md-tp-list">' + rounds.map(tpRow).join('') + '</ul></div>' : '') +
      '</section>' : '';
    const reads = M.tareas.readings;
    const avail = reads.filter((x) => x.available || x.bestScore != null);
    const lockedN = reads.length - avail.length;
    const readings = reads.length && (avail.length || s.level === 'hsk1') ? '<section class="md-dor-part"><h3 class="md-h3">Exámenes de lectura</h3>' +
      (avail.length ? '<ul class="md-reads">' + avail.map((x) => '<li><span class="md-read-t"><b>' + esc(x.title) + '</b><small>' + (x.bestScore != null ? x.bestScore + ' / 100' : 'Disponible') + '</small></span>' +
        '<span class="md-tp-acts"><button type="button" class="md-tp-go" data-act="reading" data-story="' + esc(x.storyId) + '">' + (x.bestScore != null ? 'Otra vez' : 'Leer') + '</button>' +
        (x.bestScore != null ? '<button type="button" class="md-tp-rev" data-act="reading-review" data-story="' + esc(x.storyId) + '" data-title="' + esc(x.title) + '">Ver mis errores</button>' : '') + '</span></li>').join('') + '</ul>' : '') +
      (lockedN ? '<p class="md-quiet">' + I.lock + ' ' + (lockedN === 1 ? '1 historia se abre' : lockedN + ' historias se abren') + ' cuando la lean en clase.</p>' : '') + '</section>' : '';
    const hero = '<header class="md-dor-hero"><img class="md-exp-bg" src="' + ART.dubaiS + '" srcset="' + ART.dubaiS + ' 480w, ' + ART.dubai + ' 1600w" sizes="(min-width: 1000px) 470px, 100vw" alt="" decoding="async">' +
      '<span class="md-exp-shade" aria-hidden="true"></span>' +
      (page ? '<a class="md-back md-back-glass" href="#">' + I.back + '<span>La Ruta Dorada</span></a>' : '') +
      '<img class="md-dor-star" src="' + ART.star + '" alt="" width="200" height="220" decoding="async">' +
      '<div class="md-exp-t"><p>Al final de tu ruta</p><h2 class="md-exp-h" id="md-dor-h" tabindex="-1">El Simulacro Dorado</h2><p class="md-dor-sub">En clase, con tu profe</p></div></header>';
    return '<section class="md-exp md-dor' + (page ? ' is-page' : ' is-aside') + '" aria-labelledby="md-dor-h">' + hero + '<div class="md-exp-body">' + state +
      '<section class="md-dor-part"><h3 class="md-h3">Tus simulacros en clase</h3>' + books + '</section>' + practice +
      '<section class="md-dor-part"><h3 class="md-h3">Mis exámenes</h3><div data-exams-mount></div></section>' + readings +
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
        : m.actionUrl && /^\/(?!\/)/.test(m.actionUrl) ? '<a class="md-btn is-gold" href="' + esc(m.actionUrl) + '">' + (PIN_LINK.test(m.actionUrl) ? 'Entrar al juego con el PIN' : esc(m.actionLabel || 'Abrir')) + '</a>'
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
      tile('desafio', ART.dragon, 'Desafío del día', 'Muy pronto: los juegos de la clase', '<span class="md-tile-lock">' + I.lock + '</span>') + '</nav>';
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
  // no `ruta`: this phone has no session of this kid (an old class code typed for another class): the tareas still work
  function noRutaHtml() {
    return '<div class="md-wait"><img src="' + ART.hello + '" alt="" width="160" height="178"><p>Para ver tu Ruta Dorada, entra con tu código y la clave de tu nivel.</p>' +
      '<button type="button" class="md-btn is-gold" data-act="relogin">Entrar de nuevo</button></div>';
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
    M = model(D, s, marksNow());
    park();
    stopCards();
    const W = wide();
    const scr = $('screen-list');
    let v = view;
    if (v.kind === 'exp' && M.ruta && !M.exps.some((e) => e.n === v.n)) v = { kind: 'home' };
    const out = buildHtml(v, W, s);
    app.innerHTML = out.html;
    if (scr) { scr.classList.toggle('is-wide', W); scr.classList.toggle('has-tabs', out.tabs); }
    document.title = 'Mi Dralingo' + (M.levelName ? ' · ' + M.levelName : '');
    mount(v);
  }
  // the screen for a view (W = a laptop): { html, tabs } (no DOM: scripts/test-home.js reads it for every made-up kid)
  function buildHtml(v, W, s) {
    let html = bandHtml(s);
    let tabs = false;
    if (!D) html += '<main class="md-main md-page">' + loadingHtml() + '</main>';
    else if (!M.ruta) html += '<main class="md-main md-page">' + noRutaHtml() + allTareasHtml() + '</main>';
    else if (W) {
      const selE = v.kind === 'exp' ? 'exp-' + v.n : v.kind === 'dorado' ? 'dorado' : v.kind === 'home' ? (expFor(v) ? 'exp-' + expFor(v).n : '') : '';
      html += '<div class="md-grid"><div class="md-left">' + hoyHtml() + profeHtml() + pathHtml(selE) + dockHtml(v.kind) + '</div>' +
        '<aside class="md-aside" id="md-aside" aria-label="Lo que elegiste">' + asideHtml(v) + '</aside></div>';
    } else {
      // (an experience and El Simulacro Dorado are pages of their own: their picture goes edge to edge, no band)
      if (v.kind === 'exp') html = '<main class="md-main md-page is-flush">' + expHtml(expFor(v), 'page') + '</main>';
      else if (v.kind === 'dorado') html = '<main class="md-main md-page is-flush">' + doradoHtml('page') + '</main>';
      else if (v.kind === 'mensajes') { html = msgsHtml('page'); tabs = true; }
      else if (v.kind === 'oraciones') { html = sentHtml('page'); tabs = true; }
      else if (v.kind === 'desafio') { html = desafioHtml('page'); tabs = true; }
      else { html += '<main class="md-main md-page">' + hoyHtml() + profeHtml() + pathHtml('') + '</main>'; tabs = true; }
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
    if (v.kind === 'mensajes') H.readAll();
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
    const of = $('md-ruta-of');
    if (of) of.textContent = M.doneN + ' de ' + M.exps.length + ' experiencias listas';
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
    if (!wide() && !step) toTop();
    draw();
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
    if (h.dorado) { setHash('dorado'); return; }
    if (h.exp) { focusStep = h.step || 0; setHash('exp-' + h.exp); return; }
    setHash('');
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
    else if (act === 'papas') H.openParents();
    else if (act === 'retry') { failed = false; draw(); load(true); }
    else if (act === 'relogin') location.reload();
    else if (act === 'trainer') H.openTrainer(Number(t.getAttribute('data-tier')), t.getAttribute('data-exp'));
    else if (act === 'review') H.review(t.getAttribute('data-id'), t.getAttribute('data-title'));
    else if (act === 'reading') H.openReading(t.getAttribute('data-story'));
    else if (act === 'reading-review') H.reviewReading(t.getAttribute('data-story'), t.getAttribute('data-title'));
    else if (act === 'copy-msg') copyMsg(t);
    else if (act === 'anim') { const m = (H.state().inbox || [])[Number(t.getAttribute('data-i'))]; if (m) H.replayAnim(m); }
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
  }
  function changed(kind) {
    if (!H || H.screen() !== 'list') return;
    const n = Number(H.state().unread) || 0;
    document.querySelectorAll('#md-app [data-unread]').forEach((b) => { b.hidden = !n; b.textContent = n > 9 ? '9+' : String(n); });
    if (kind === 'inbox' && view.kind !== 'mensajes') return;
    const p = $('au-player');
    if (p && !p.paused) { soft(); return; }   // (a homework audio playing is never cut by a redraw)
    draw();
  }
  // (a login on this tab: another kid, or another level: nothing of the last one stays)
  function reset() { D = null; M = null; ctxR = null; loadedAt = 0; failed = false; loadSeq++; sentAt = 0; examsAt = 0; stopCards(); }
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
