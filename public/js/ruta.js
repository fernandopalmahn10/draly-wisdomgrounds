// =========================================================================
// ruta.js · La Ruta Dorada (/audios): the picker and each module's page
// phase 2 (2026-10-15) · redesign (his picks 2026-10-18, «it's not clear, it's messy, the tareas are left behind»)
// =========================================================================
// His pick for the picker: "like choosing a world in a Nintendo game". Two screens, drawn by js/audios.js's router:
//   Ruta.picker(main, ctx)        /audios          one big glossy card per module of core/levels.js (YCT 1, New
//                                                  HSK 1, HSK 1, and every level added there later). Swipe (touch,
//                                                  mouse drag), arrow keys, the ‹ › buttons or the dots: the next card
//                                                  flies in with depth and a little bounce (a spring, transform and
//                                                  opacity only). Reduced motion: a calm crossfade. The first frame is
//                                                  still (a whole class may open it at once). Its own band at the top
//                                                  with «Volver» (to Mis tareas when the kid came from there, else the
//                                                  platform home); a red «N por mandar» on the card of a module with
//                                                  homework to send.
//   Ruta.path(main, ctx, module)  /audios/<level>  the module page (redesign 2026-10-18, his approved clickable design
//                                                  .claude/handoff/ruta-design): ONE clear ladder + the homework beside it.
//       · the band: «Volver a mis tareas» (came from /homework) or «Todos los mundos», always visible (sticky)
//       · the hero: the module's wonder (YCT 1 Dubái, New HSK 1 the Li River, HSK 1 the Great Wall; a later level takes
//         the next), its jewel colour, Dralingo pointing at the ladder and ONE direct instruction that follows this
//         kid's state («¡Empieza aquí! Toca el 1, La Base…», «¡Ahora el 2! Practica La Familia…», «¡Ya puedes hacer el
//         examen!…», locked: «Escribe la clave de New HSK 1 para abrir tu ruta.»)
//       · the ladder: 1 La Base → 2 El Entrenamiento → 3 El Simulacro Dorado, three picture cards in a row with arrows
//         (laptop) or stacked with down-arrows (phone). A card is current (gold glow, red «¡Empieza aquí!», the big gold
//         button with a direct verb), started (a soft «Seguir…»), done (green tick, «Repasar»), locked (grey art,
//         padlock, one plain line of how it opens) or soon («Muy pronto»), with red badges («300 por marcar»).
//         DONE, as the code counts it: La Base = every word sealed; El Entrenamiento = every regular world (not Pinyin,
//         not the «Simulacro del examen») with the Dorado's % or more; El Simulacro Dorado = every simulation taken.
//         CURRENT = the step with the next useful thing to do: a practice world the kid's seals opened and not at the %
//         yet (the 2, «practise what you just earned»), else La Base until every word is sealed, else the practice left
//         (Pinyin, the exam world), else the next simulation; a locked module's current step is its key (card 1).
//       · «Tus tareas» (right column on a laptop, below on a phone; a red «Tareas: N por mandar» in the phone's hero jumps
//         to #tareas): BY EXPERIENCE, LIKE FOLDERS (his rule 2026-10-18): one folder card per experience of the module
//         (the server's `exps`: the curriculum pack's worlds, Experiencia 1…8, a pack picture each) with «N por mandar» /
//         «✓ Mandadas» / «Pronto»; the newest homework's experience glows («La más nueva»); a tap opens its 2-3
//         homeworks with «← Volver a las experiencias» (the open folder is kept per tab: sessionStorage
//         draly_tareas_exp). Aileen says what to do on each view. Inside a folder: «Escuchar» plays its three audios
//         right there, «¡Ya la mandé!» = sent. «Nueva» / «Escuchada ✓» / «✓ Mandada». A module with no homework audio
//         at all (YCT 1 today) has no column. A logged-in kid's marks live on the ACCOUNT (POST /api/ruta/tareas, any phone);
//         a phone without login keeps them in localStorage draly_tareas and they join the account at the first login
//         (like La Base's seals: `who` = the account the mirror holds, `pend` = not saved yet, `held` = a sibling's).
// Round 2 (his asks 2026-10-18, after the redesign went live):
//       · El Simulacro Dorado is the TEACHER's ("the golden simulations should be just for me… I enable it through pin"):
//         server.js DORADO_SELF_SERVE is off, the route state says `solo: false` and sends no player link to a kid. Card 3
//         (classMode) never starts a simulation: locked with «Se abre en clase con tu profe, cuando termines El
//         Entrenamiento»; once El Entrenamiento is done (card 2 done, or the teacher opened the Dorado) it is the current
//         step, Dralingo says «¡Terminaste El Entrenamiento! Avísale a tu profe…», and its big button «Avisarle a mi profe»
//         opens WhatsApp with a ready message (wa.me with no number: the family picks the teacher; the kid's name when the
//         account has a real one) + «Copiar mensaje». The simulations taken in class keep their chips and «Libro dorado».
//         A teacher still sees and opens everything (the chips link the players).
//       · A teacher's look at «Tus tareas» (his computer is a teacher's, so he never saw the kids' buttons): each card
//         shows the kid's buttons as a calm preview that does nothing and writes nothing («Así lo ven tus alumnos»).
//       · The homework's own page (/audios/<homework id>) has the same marks (Ruta.hwMarks, called by js/audios.js): ONE
//         implementation with «Tus tareas» (the mirror, the account, the phone's own marks, «Deshacer»).
//       · The automatic student account (js/ruta-auto.js, server.js «AUTOMATIC STUDENT ACCOUNTS»): the first «¡Ya la
//         mandé!» on a phone with no account gives it one (listening alone never does: printed PDFs open these pages),
//         the card «¡Ya tienes tu cuenta!» shows once; «Mi código» on the band (code, Copiar, the name) for a logged-in kid.
// «A practice that's done shows it» (2026-10-18): card 2's coins and «N de 8 mundos con 70 %» read the server's best
// for an account and THIS device's scores for a key-only phone or a teacher (Entrenamiento.localBest: a teacher's own
// rounds, kept on that device only, with «Tus rondas de maestro: solo en este equipo»); a world at the % is a green coin
// with its ✓. js/audios.js puts a round that just ended into the route data (no stale card 2 after «Volver»).
// What is open comes from the server (GET /api/ruta-dorada, LevelKeys.access per level: a teacher, the logged-in
// kid's account, this device's key). «Escribe la clave de <nivel>» opens the phase-1 key screen at
// /audios/<level>/clave and comes back here. The sims only reach this page when open, and each one opens its player
// through the same key check at the player's door. Nothing that worked before got lost: La Base's meter (card 1's bar),
// El Entrenamiento's worlds (a coin row on card 2; its button opens the world or /audios/<level>/entrenamiento), the
// simulations (numbered chips on card 3, the button opens the next one), the «Libro dorado» with its mistakes, the key
// box (card 1 of a locked module), the «dorado=cerrado#paso-3» moment, the new-world pop (card 2's badge), the seals
// and scores sync for a logged-in kid, the «Entra con tu código» paths. The study PDFs are the super admin's only.
// No hanzi here, no em dash (scripts/test-audios-base.js).
// =========================================================================
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const calmMotion = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (_) {} },
    getL(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    setL(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
  };

  // ── look ──────────────────────────────────────────────────────────
  // one jewel colour per module, all living with Rojo Imperial, Oro and Crema (the books' palette): light · base · deep
  const FAMILY_LOOK = {
    yct: ['#a8352c', '#6c1513', '#360606'],      // Rojo Imperial
    newhsk: ['#24806b', '#0e4d43', '#04221d'],   // Jade
    hsk: ['#3c5bb0', '#1b2f6b', '#0a1435'],      // Lapislázuli
  };
  const EXTRA_LOOKS = [
    ['#83449a', '#4a1d5a', '#200a28'],           // Amatista
    ['#22788e', '#0f3f4c', '#041b22'],           // Petróleo
    ['#9a6a1e', '#5e3d0c', '#2a1a04'],           // Ámbar
  ];
  const FAMILY_SUB = { yct: 'El examen de los niños', newhsk: 'El nuevo HSK', hsk: 'El HSK clásico' };
  // the same family twice (YCT 2 after YCT 1) takes the next free colour, so two cards never look alike
  function looksFor(modules) {
    const used = new Set();
    let extra = 0;
    const out = {};
    modules.forEach((m) => {
      let look = FAMILY_LOOK[m.family];
      if (!look || used.has(m.family)) look = EXTRA_LOOKS[extra++ % EXTRA_LOOKS.length];
      used.add(m.family);
      out[m.slug] = look;
    });
    return out;
  }
  const lookStyle = (l) => '--c1:' + l[0] + ';--c2:' + l[1] + ';--c3:' + l[2];
  const rgbOf = (hex) => { const n = parseInt(String(hex).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(','); };
  // Dralingo in his platform look; a different pose on each card, a new mix on every visit («alive, randomized»)
  const POSES = ['/assets/dralingo/hello.webp', '/assets/dralingo/power.webp', '/assets/dralingo/wise.webp'];
  const shuffled = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = b[i]; b[i] = b[j]; b[j] = t; } return b; };
  const visitPoses = shuffled(POSES);
  const poseOf = (i) => visitPoses[i % visitPoses.length];
  // each module's wonder (Dubai the main stage, China rounds it out: his direction 2026-10-17) and where its picture
  // keeps its landmark in a wide banner; a later level takes the next one free
  const WONDERS = {
    dubai: { src: '/assets/paint/dubai/bg.webp', pos: '50% 80%' },
    rio: { src: '/assets/paint/rio/bg.webp', pos: '50% 62%' },
    muralla: { src: '/assets/paint/muralla/bg.webp', pos: '50% 58%' },
    shanghai: { src: '/assets/paint/shanghai/bg.webp', pos: '50% 70%' },
  };
  const FAMILY_WONDER = { yct: 'dubai', newhsk: 'rio', hsk: 'muralla' };
  function wondersFor(modules) {
    const used = new Set();
    const out = {};
    modules.forEach((m) => {
      let w = FAMILY_WONDER[m.family];
      if (!w || used.has(w)) w = Object.keys(WONDERS).find((k) => !used.has(k)) || 'dubai';
      used.add(w);
      out[m.slug] = WONDERS[w];
    });
    return out;
  }
  // La Base's card: a little fan of three word pictures of THAT level's pack (public, glossy clay look); a later level
  // without one shows its base's own peek pictures once open, else Dralingo with the book
  const FAN = {
    newhsk1: ['familia/baba', 'familia/jia', 'familia/gou'],
    yct1: ['familia/mama', 'comida/pingguo', 'mascotas/mao'],
    hsk1: ['viajes/feiji', 'viajes/zhongguo', 'mercado/cha'],
  };
  // a homework's picture: its theme in the level's pack, else the homework's own cover
  const HW_THEMES = [
    [/famil/, { any: 'familia/jia' }],
    [/restaur|comida|comer|cocin/, { newhsk1: 'restaurante/fandian', hsk1: 'mercado/fandian', yct1: 'comida/mifan' }],
    [/escuel|clase|colegio/, { any: 'escuela/xuexiao' }],
    [/mercad|tienda|compr/, { newhsk1: 'tienda/shangdian', hsk1: 'mercado/shangdian', yct1: 'comida/shangdian' }],
    [/clima|tiempo|lluv|calor|frio/, { newhsk1: 'rutina/tianqi', hsk1: 'tiempo/tianqi' }],
    [/mascot|perr|gato/, { yct1: 'mascotas/gou', newhsk1: 'familia/gou', hsk1: 'familia/gou' }],
    [/salud|hospital|medic|doctor|enferm/, { newhsk1: 'salud/yiyuan', hsk1: 'personas/yiyuan' }],
    [/viaj|china|aeropuert|avion/, { newhsk1: 'china/feiji', hsk1: 'viajes/feiji' }],
  ];
  const plain = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function hwPic(h, slug) {
    const t = plain(h.title);
    for (const [re, map] of HW_THEMES) {
      const p = re.test(t) ? (map[slug] || map.any) : null;
      if (p && FAN[slug]) return '/assets/packs/' + slug + '/' + p + '.webp';
    }
    return h.thumb || h.cover || '';
  }

  const I = {
    book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M2.5 5.2c2.9-1.2 6-1 8.8.9v13.4c-2.8-1.8-5.9-2-8.8-.9zM21.5 5.2c-2.9-1.2-6-1-8.8.9v13.4c2.8-1.8 5.9-2 8.8-.9z"/></svg>',
    target: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="4.6" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 3.5h10v5.2a5 5 0 0 1-10 0z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M7 5.5H4.6a2.6 2.6 0 0 0 2.7 4.4M17 5.5h2.4a2.6 2.6 0 0 1-2.7 4.4M12 13.8v3.4"/><path fill="currentColor" d="M8 20.5h8v-.7a2.6 2.6 0 0 0-2.6-2.6h-2.8A2.6 2.6 0 0 0 8 19.8z"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 11.5V8a4 4 0 0 1 8 0v3.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><rect x="4.5" y="11" width="15" height="10.5" rx="2.6" fill="currentColor"/></svg>',
    soon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" d="M7 3.5h10M7 20.5h10M8 3.5c0 4.6 8 4.7 8 8.5s-8 3.9-8 8.5M16 3.5c0 4.6-8 4.7-8 8.5s8 3.9 8 8.5"/></svg>',
    key: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2.4"/><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M12.2 12H21M18 12v3.2M21 12v2.4"/></svg>',
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    go: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    again: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12a7 7 0 1 0 2.1-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M6.6 2.8v4.6h4.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3.4 20.6l17.9-8.1a.6.6 0 0 0 0-1.1L3.4 3.4a.6.6 0 0 0-.8.7L4.6 11l9 1-9 1-2 6.9a.6.6 0 0 0 .8.7z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>',
    eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>',
    badge: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="9" cy="11" r="2.4" fill="currentColor"/><path d="M5.8 16.4a3.4 3.4 0 0 1 6.4 0M14 10h4M14 14h3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  };
  const sky = '<svg class="rd-sky" viewBox="0 0 400 110" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false"><use href="#rd-sky"/></svg>' +
    '<svg class="rd-sky rd-sky-mirror" viewBox="0 0 400 110" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false"><use href="#rd-sky"/></svg>';

  // ── what a module holds, for this visitor ─────────────────────────
  // base / train / gold: 'open' | 'locked' | 'soon' (nothing yet). El Entrenamiento (phase 4) exists for every level
  // with a La Base and a practice pack (the server sends `train` only when the module is open). A gold step that the key
  // opens but the kid has not earned yet (El Entrenamiento live: every world practised) is 'locked' with goldEarn.
  function statesOf(m) {
    const earn = !!(m.open && m.simCount && m.dorado && !m.dorado.open);
    return {
      base: !m.base ? 'soon' : (m.open ? 'open' : 'locked'),
      train: !m.open ? (m.base ? 'locked' : 'soon') : (m.train ? 'open' : 'soon'),
      gold: !m.simCount ? 'soon' : (m.open && !earn ? 'open' : 'locked'),
      goldEarn: earn,
    };
  }
  // El Entrenamiento's worlds for this visitor (phase 4): the server's answer (the account's seals, a teacher's opening,
  // the account's best %), plus what THIS phone holds (its own seals open a world too; a key-only phone's own scores)
  // → [{ key, kind, n, short, open, best, sealed, count }]
  function trainWorldsOf(ctx, m, pr) {
    if (!m.train || !Array.isArray(m.train.worlds)) return [];
    const E = window.Entrenamiento;
    // (2026-10-18) this device's scores for this visitor: a key-only phone's own, or a teacher's own rounds kept here
    // (his computer is the super admin: before, a teacher's card 2 always said «0 de 8»)
    const mine = E && E.localBest ? E.localBest(ctx.ruta, m.slug) : {};
    const list = m.train.worlds.map((w) => {
      const pw = pr && w.kind === 'world' ? pr.worlds.find((x) => x.n === w.n) : null;
      const best = w.best != null ? w.best : (mine[w.key] != null ? Number(mine[w.key]) : null);
      return { key: w.key, kind: w.kind, n: w.n, short: w.short, open: !!w.open || !!(pw && pw.train), best,
        via: w.open ? w.via || null : (pw && pw.train ? pw.via : null), sealed: pw ? pw.sealed : 0, count: pw ? pw.count : 0 };
    });
    const regular = list.filter((w) => w.kind === 'world');
    list.forEach((w) => { if (w.kind === 'simulacro' && !w.open) w.open = regular.length > 0 && regular.every((x) => x.open); });
    return list;
  }

  // ── what this visitor's seals add up to in an open module (phase 3, 2026-10-16) ──
  // A logged-in kid: their account (server `progress`), or this phone's mirror when it already holds THEIR account (it
  // is the newest: taps not saved yet included). Anyone else with the key (a key-only phone, a teacher): this phone's
  // own seals. El Entrenamiento opens world by world: every seal of a world in La Base (or a teacher's «Desbloquear»).
  // → null | { sealed, words, base (catalog entry), worlds: [{ n, short, count, sealed, train, via }] }
  function progressOf(ctx, m) {
    if (!m.open || !m.base) return null;
    const cb = (ctx.catalog.bases || []).find((x) => x.id === m.base.id);
    const list = (m.base.worlds && m.base.worlds.length ? m.base.worlds : (cb && cb.worlds) || []);
    const P = m.progress;
    const AB = window.AudiosBase;
    const mine = !!(P && ctx.ruta.who && AB && AB.who && cb && AB.who(cb.level) === ctx.ruta.who);
    const seals = (!P || mine) && cb ? ctx.sealsOf(cb) : null;
    let next = 1;
    const worlds = (Array.isArray(list) ? list : []).map((w) => {
      const first = w.first || next;
      next = first + w.count;
      const pw = P ? (P.worlds || []).find((x) => x.n === w.n) : null;
      let sealed = 0;
      if (seals) { for (let n = first; n < first + w.count; n++) if (seals.has(n)) sealed++; } else sealed = pw ? Math.min(pw.sealed, w.count) : 0;
      const bySeals = sealed >= w.count;
      const byTeacher = !!(pw && pw.teacher);
      return { n: w.n, short: w.short || '', count: w.count, sealed, train: bySeals || byTeacher, via: bySeals ? 'seals' : (byTeacher ? 'teacher' : null) };
    });
    return { sealed: worlds.reduce((a, w) => a + w.sealed, 0), words: m.base.words, base: cb, worlds };
  }
  // how many worlds a base has (the catalog lists them; an older one counted them)
  const worldCount = (cb) => (!cb ? 0 : Array.isArray(cb.worlds) ? cb.worlds.length : Number(cb.worlds) || 0);
  // La Base's meter (the same look as audios.js meterHtml), from the per-world counts
  const meterOf = (p) => '<span class="au-meter" aria-hidden="true">' +
    p.worlds.map((w) => '<i style="--w:' + w.count + ';--p:' + (w.sealed / w.count).toFixed(3) + '"></i>').join('') + '</span>';

  // a friend of the gang cheers along (a new one, and a new line, on each visit: «alive, randomized»)
  function friendRow(cls) {
    const C = window.DralingoCast;
    if (!C) return '';
    const f = C.pick(1)[0];
    return '<div class="rd-friend' + (cls ? ' ' + cls : '') + '"><img src="' + esc(C.pose(f, 'ruta')) + '" alt="" width="200" height="240" decoding="async" loading="lazy">' +
      '<p class="rd-bubble"><b>' + esc(C.name(f)) + '</b>' + esc(C.line(f, 'ruta')) + '</p></div>';
  }

  // ════════════════════════════════════════════════════════════════════
  // the homework done marks (2026-10-18): «Escuchada» (the audio played) and «¡Ya la mandé!» (sent on WhatsApp)
  // ════════════════════════════════════════════════════════════════════
  // localStorage draly_tareas = { v: 2, who, marks, pend, held, phone }
  //   who   = the account the mirror holds (the server's opaque id; never the kid's code)
  //   marks = that account's marks as this phone last knew them: { id: { h: 1, s: 1 } } (a save's answer, the route data)
  //   pend  = that kid's taps not saved on the account yet: { id: { h: 1, s: 1 | 0 } } (s: 0 = «mandada» undone)
  //   held  = a sibling's unsaved taps, kept for their next login on this phone: { who: pend }
  //   phone = taps made while NOBODY is logged in: this phone's own, never a kid's (a logged-out phone shows only these)
  // A logged-in kid: every tap goes up (batched, retried offline, sent on pagehide), and the mirror wins over the route
  // data the page was drawn with (a save's answer is newer). The phone's own taps join the next account that logs in
  // (a union), like La Base's seals. Server: /api/ruta/tareas (server.js).
  const TKEY = 'draly_tareas';
  const idOk = (id) => typeof id === 'string' && /^[a-z0-9-]{3,60}$/.test(id);
  const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
  function tRead() {
    let o = null;
    try { o = JSON.parse(localStorage.getItem(TKEY) || 'null'); } catch (_) { o = null; }
    if (!isObj(o)) o = {};
    if (!isObj(o.marks)) o.marks = {};
    if (!isObj(o.pend)) o.pend = {};
    if (!isObj(o.phone)) o.phone = {};
    // (a first-version mirror that never met an account kept the phone's own marks in `marks`)
    if (!o.who && Object.keys(o.marks).length) { o.phone = Object.assign({}, o.marks, o.phone); o.marks = {}; }
    return o;
  }
  function tWrite(o) { o.v = 2; try { localStorage.setItem(TKEY, JSON.stringify(o)); } catch (_) {} }
  // marks + pend → what shows (a copy)
  function tApply(marks, pend) {
    const out = {};
    Object.keys(marks || {}).forEach((id) => { if (idOk(id) && isObj(marks[id])) out[id] = { h: marks[id].h ? 1 : 0, s: marks[id].s ? 1 : 0 }; });
    Object.keys(pend || {}).forEach((id) => {
      const p = pend[id];
      if (!idOk(id) || !isObj(p)) return;
      const e = out[id] || (out[id] = { h: 0, s: 0 });
      if (p.h === 1) e.h = 1;
      if (p.s === 1) { e.s = 1; e.h = 1; }
      if (p.s === 0) e.s = 0;
    });
    return out;
  }
  // ruta = the route state object the page draws from (js/audios.js keeps it): a save's answer is written back into it
  const tSync = { mode: null, who: null, timer: 0, busy: null, tries: 0, onChange: null, ruta: null, idsOf: null };
  // the mirror now holds `who`'s account. acct = that account's marks for `ids` from a FRESH route state (the server's
  // word then), or null (the homework page, or route data the mirror already learned from): this phone's own taps go up
  // to this account, a sibling's unsaved taps wait for them
  function tSettle(who, acct, ids) {
    const o = tRead();
    if (o.who !== who) {
      if (o.who) {                                               // a sibling's mirror: theirs waits, never mixed
        const held = isObj(o.held) ? o.held : {};
        if (Object.keys(o.pend).length) held[o.who] = Object.assign({}, isObj(held[o.who]) ? held[o.who] : {}, o.pend);
        o.pend = isObj(held[who]) ? held[who] : {};
        delete held[who];
        const keys = Object.keys(held);
        keys.slice(0, Math.max(0, keys.length - 4)).forEach((k) => { delete held[k]; });   // a family phone: 4 kids at most
        if (keys.length) o.held = held; else delete o.held;
      } else o.pend = {};
      o.marks = {};
      o.who = who;
    }
    if (acct) {                                                  // the account's word for these ids
      (ids || Object.keys(acct)).forEach((id) => { if (acct[id]) o.marks[id] = { h: acct[id].h ? 1 : 0, s: acct[id].s ? 1 : 0 }; else delete o.marks[id]; });
    }
    // the phone's own taps (made while nobody was logged in) join this account: a union
    Object.keys(o.phone).forEach((id) => {
      const e = o.phone[id];
      if (!idOk(id) || !isObj(e)) return;
      const have = tApply(o.marks, o.pend)[id] || {};
      const p = isObj(o.pend[id]) ? o.pend[id] : {};
      if (e.h && !have.h) p.h = 1;
      if (e.s && !have.s) { p.s = 1; p.h = 1; }
      if (p.h || p.s === 1) o.pend[id] = p;
    });
    o.phone = {};
    tWrite(o);
    tSync.mode = 'account';
    tSync.who = who;
    if (Object.keys(o.pend).length) tLater(300);
  }
  // a fresh route state (a page load, or a refresh that brought news) is the server's word: the mirror learns it once.
  // After that the mirror (saves' answers) is newer than the route data the page keeps.
  function tSeed(ruta, idsOf) {
    if (!ruta) return;
    tSync.ruta = ruta;
    if (idsOf) tSync.idsOf = idsOf;
    if (!(ruta.student && ruta.who) || ruta.__tareasSeeded === ruta.who) return;
    const acct = {}, ids = [];
    (ruta.modules || []).forEach((m) => {
      if (!isObj(m.tareas)) return;
      Object.assign(acct, m.tareas);
      if (idsOf) ids.push.apply(ids, idsOf(m.slug));
    });
    // (route data asked for while a save was on its way can be older than that save's answer: the mirror keeps it,
    // the next refresh brings the rest)
    const raced = tSync.who === ruta.who && (tSync.busy || Date.now() - (tSync.savedAt || 0) < 5000);
    if (raced) { tLearn(tRead().marks); tSettle(ruta.who, null); } else tSettle(ruta.who, acct, idsOf ? ids : null);
    try { Object.defineProperty(ruta, '__tareasSeeded', { value: ruta.who, configurable: true }); } catch (_) {}
  }
  // a save's answer (the whole account map): into the mirror, and into the route data each module keeps (so a redraw,
  // the picker or a path → homework → path trip never brings back older marks)
  function tLearn(marks) {
    const R = tSync.ruta;
    if (!R || !Array.isArray(R.modules) || !tSync.idsOf) return;
    R.modules.forEach((m) => {
      if (!isObj(m.tareas)) return;
      const t = {};
      tSync.idsOf(m.slug).forEach((id) => { if (marks[id]) t[id] = { h: marks[id].h ? 1 : 0, s: marks[id].s ? 1 : 0 }; });
      m.tareas = t;
    });
  }
  function tLater(ms) { clearTimeout(tSync.timer); tSync.timer = setTimeout(() => { tSync.timer = 0; tFlush(); }, ms); }
  // what goes up now (60 ids per list at most; the rest go in the next save) and the taps it carries
  function tBody(o) {
    const heard = [], sent = [], unsent = [];
    Object.keys(o.pend).forEach((id) => {
      const p = o.pend[id];
      if (!idOk(id) || !isObj(p)) return;
      if (p.s === 1 && sent.length < 60) sent.push(id);
      else if (p.s === 0 && unsent.length < 60) unsent.push(id);
      if (p.h === 1 && p.s !== 1 && heard.length < 60) heard.push(id);
    });
    const carried = {};
    heard.concat(sent, unsent).forEach((id) => { carried[id] = JSON.parse(JSON.stringify(o.pend[id])); });
    return { body: { who: o.who || null, heard, sent, unsent }, carried };
  }
  function tFlush() {
    if (tSync.mode !== 'account') return Promise.resolve();
    if (tSync.busy) return tSync.busy;
    const o = tRead();
    const { body, carried } = tBody(o);
    if (!body.heard.length && !body.sent.length && !body.unsent.length) return Promise.resolve();
    tSync.busy = fetch('/api/ruta/tareas', { method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then((r) => r.json().catch(() => null).then((d) => ({ status: r.status, d })), () => ({ status: 0, d: null }))
      .then(({ status, d }) => {
        tSync.busy = null;
        const n = tRead();
        // only the taps this save carried, and only when no newer tap on the same homework came meanwhile
        const drop = () => { Object.keys(carried).forEach((id) => { if (JSON.stringify(n.pend[id]) === JSON.stringify(carried[id])) delete n.pend[id]; }); };
        if (d && d.ok && isObj(d.marks)) {
          tSync.tries = 0;
          drop();
          if (d.who && n.who === d.who) { n.marks = d.marks; tLearn(d.marks); tSync.savedAt = Date.now(); }
          tWrite(n);
          if (tSync.onChange) tSync.onChange();
          if (Object.keys(n.pend).length) tLater(400);
          return;
        }
        if (status === 409) { tSync.mode = null; if (tSync.onChange) tSync.onChange(true); return; }   // another kid logged in: ask again
        if (status === 401 || status === 403) { tSync.mode = 'device'; return; }   // the login ended: they wait for it
        if (status === 400) { drop(); tWrite(n); return; }                        // a broken batch: never retried
        tSync.tries += 1;
        if (tSync.tries <= 6) tLater(Math.min(60000, 2000 * Math.pow(2, tSync.tries - 1)));
      });
    return tSync.busy;
  }
  window.addEventListener('online', () => { tSync.tries = 0; if (tSync.mode === 'account') tFlush(); });
  window.addEventListener('pagehide', () => {
    if (tSync.mode !== 'account' || tSync.busy) return;
    const { body } = tBody(tRead());
    if (!body.heard.length && !body.sent.length && !body.unsent.length) return;
    try { fetch('/api/ruta/tareas', { method: 'POST', credentials: 'same-origin', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {}); } catch (_) {}
  });
  // a tap: kind 'h' (heard) | 's' (sent) | 'u' (sent undone). ruta = the route state (who is here). Nobody logged in:
  // the tap is the phone's own (never a kid's account, even the kid who logged out on this phone)
  function tMark(id, kind, ruta) {
    if (!idOk(id)) return;
    const account = !!(ruta && ruta.student && ruta.who);
    if (account && tSync.who !== ruta.who) tSettle(ruta.who, null);
    const o = tRead();
    const cur = (account ? tApply(o.marks, o.pend) : tApply(o.phone, null))[id] || { h: 0, s: 0 };
    if (kind === 'h' && cur.h) return;
    if (kind === 's' && cur.s) return;
    if (kind === 'u' && !cur.s) return;
    if (account) {
      const p = isObj(o.pend[id]) ? o.pend[id] : {};
      if (kind === 'h') p.h = 1;
      if (kind === 's') { p.s = 1; p.h = 1; }
      if (kind === 'u') p.s = 0;
      o.pend[id] = p;
    } else {
      const e = isObj(o.phone[id]) ? o.phone[id] : (o.phone[id] = {});
      if (kind === 'h') e.h = 1;
      if (kind === 's') { e.s = 1; e.h = 1; }
      if (kind === 'u') delete e.s;
    }
    tWrite(o);
    if (account) tLater(kind === 'h' ? 1500 : 600);
  }
  // what shows: a logged-in kid = the mirror of their account (it wins: it is newer than the route data the page was
  // drawn with) + their taps not saved yet; nobody logged in = only this phone's own taps
  function tMarksFor(ruta, acct) {
    const o = tRead();
    if (ruta && ruta.student && ruta.who) {
      if (o.who === ruta.who) return tApply(Object.assign({}, acct || {}, o.marks), o.pend);
      return tApply(Object.assign({}, acct || {}), tApply(o.phone, null));   // (not met yet: the phone's own are about to join)
    }
    return tApply(o.phone, null);
  }
  const unsentOf = (hws, marks) => hws.filter((h) => !(marks[h.id] && marks[h.id].s)).length;

  // ── the band at the top of both screens: the way back, always visible ──
  // me (2026-10-18): the logged-in kid (their own login, or the phone's automatic account) gets «Mi código» on the right:
  // their code, «Copiar» and their name (js/ruta-auto.js)
  function bandHtml(back, title, me) {
    return '<header class="rp-band' + (me ? ' has-me' : '') + '" data-back><div class="rp-band-in">' +
      '<a class="rp-back" href="' + esc(back.href) + '"' + (back.nav ? ' data-nav' : '') + ' data-back>' + I.left + '<span>' + esc(back.label) + '</span></a>' +
      (title ? '<a class="rp-band-title" href="/audios" data-nav aria-label="La Ruta Dorada: todos los mundos">' + esc(title) + '</a>' : '<span class="rp-band-title" aria-hidden="true">La Ruta Dorada</span>') +
      (me && me.code && window.DralyAuto ? '<button type="button" class="rp-me" data-me>' + I.badge + '<span>Mi código</span></button>' : '') +
      '</div></header>';
  }
  function wireMe(main, ctx) {
    const b = main.querySelector('[data-me]');
    if (!b) return;
    b.addEventListener('click', () => {
      const me = ctx.ruta.me;
      if (me && window.DralyAuto) window.DralyAuto.codeSheet(me, (acc) => { me.name = acc.name; me.placeholder = !!acc.placeholder; });
    });
  }

  // ── the picker: big glossy cards that fly ─────────────────────────
  let live = null;   // the carousel on screen (one at a time)
  function leave() {
    if (live) { live.destroy(); live = null; }
    if (readyIo) { readyIo.disconnect(); readyIo = null; }
    hwStop();
    tSync.onChange = null;
    hwBar = null;
    document.body.classList.remove('rp-on');
  }

  function cardHtml(m, i, look, ctx, toSend) {
    const st = statesOf(m);
    const pr = progressOf(ctx, m);
    const seals = pr ? pr.sealed : 0;
    // a locked module: the gold lock seal of the key screen next to its words (kids who don't read see the lock)
    const status = !m.open
      ? '<span class="rd-card-status is-locked"><span class="rd-lockseal" aria-hidden="true">' + I.lock + '</span><span id="rd-s-' + esc(m.slug) + '">Se abre con la clave</span></span>'
      : '<span class="rd-card-status" id="rd-s-' + esc(m.slug) + '">' + (m.base ? seals + ' de ' + m.base.words + ' sellos' : 'Tu ruta está abierta') + '</span>';
    const mini = [['base', 'La Base', I.book], ['train', 'Entrenamiento', I.target], ['gold', 'Simulacro', I.trophy]]
      .map(([k, label, icon]) => '<li class="is-' + st[k] + '"><i>' + (st[k] === 'locked' ? I.lock : icon) + '</i>' + label + '</li>').join('');
    const badge = toSend ? '<span class="rd-card-badge">' + toSend + ' por mandar</span>' : '';
    return '<div class="rd-slide' + (m.name.length > 6 ? ' is-long' : '') + '" role="tabpanel" id="rd-p-' + esc(m.slug) + '" aria-labelledby="rd-t-' + esc(m.slug) + '" data-i="' + i + '">' +
      '<a class="rd-card' + (m.open ? '' : ' is-locked') + '" href="/audios/' + esc(m.slug) + '" data-nav style="' + lookStyle(look) + '"' +
        ' aria-label="Entrar a ' + esc(m.name) + (toSend ? ', ' + toSend + (toSend === 1 ? ' tarea' : ' tareas') + ' por mandar' : '') + '" aria-describedby="rd-s-' + esc(m.slug) + '" draggable="false">' +
        sky +
        '<img class="rd-card-dragon" src="' + poseOf(i) + '" alt="" width="432" height="480" decoding="async" draggable="false"' + (i === ctx.start ? ' fetchpriority="high"' : ' loading="lazy"') + '>' +
        '<span class="rd-card-text"><span class="rd-card-name">' + esc(m.name) + '</span>' +
          '<span class="rd-card-sub">' + esc(FAMILY_SUB[m.family] || ('Examen ' + (m.exam || m.name))) + '</span></span>' +
        '<ol class="rd-mini" aria-hidden="true">' + mini + '</ol>' +
        '<span class="rd-card-foot">' + status + '<span class="rd-card-go">Entrar' + I.right + '</span></span>' +
        '<span class="rd-card-gloss" aria-hidden="true"></span><span class="rd-card-shine" aria-hidden="true"></span>' +
        '<span class="rd-card-shade" aria-hidden="true"></span>' + badge +
      '</a></div>';
  }

  function picker(main, ctx) {
    leave();
    const mods = ctx.ruta.modules || [];
    // the way back (his rule 2026-10-18 «every screen has a way back»): to Mis tareas when the kid came from there
    // (the route's «La Ruta Dorada» or a link with ?from=homework), else the platform's home
    const qFrom = new URLSearchParams(location.search).get('from');
    const fromHw = qFrom === 'homework' || store.get('draly_ruta_from') === 'homework' || store.get('draly_pick_from') === 'homework';
    store.set('draly_pick_from', fromHw ? 'homework' : '');
    store.set('draly_ruta_from', '');   // the kid chose «all worlds»: the routes' back arrow leads here again, not to Mis tareas
    const back = fromHw ? { href: '/homework.html', label: 'Volver a mis tareas' } : { href: '/', label: 'Volver al inicio' };
    // (the page's own band steps aside only once this screen is drawn: an error before that keeps its «Volver»)
    if (!mods.length) { main.innerHTML = bandHtml(back) + '<p class="au-error">Muy pronto: tus mundos de Chino Mandarín.</p>'; document.body.classList.add('rp-on'); return; }
    tSeed(ctx.ruta, idsOfCtx(ctx));
    const looks = looksFor(mods);
    // the first card: the one this tab was on (back from a path), else the kid's own module (or a level this device
    // holds the key of), else the last one chosen on this phone, else the first
    const bySlug = (s) => mods.findIndex((m) => m.slug === s);
    let start = [store.get('draly_ruta_at'), ctx.ruta.home, store.getL('draly_ruta_last')].map(bySlug).find((i) => i >= 0);
    if (start == null) start = 0;
    ctx.start = start;
    const anon = !ctx.ruta.student && !ctx.ruta.teacher;
    // a red «N por mandar»: the same rule as the module page («Tus tareas» is the kid's own level: mineOf), and on a
    // phone nobody is logged in on only for a level whose homework it already marked (never a badge on every card)
    const toSendOf = (m) => {
      const hws = ctx.homeworksOf(m.slug);
      if (!hws.length || !mineOf(ctx, m)) return 0;
      const marks = tMarksFor(ctx.ruta, m.tareas);
      if (!ctx.ruta.student && !hws.some((h) => marks[h.id] && (marks[h.id].h || marks[h.id].s))) return 0;
      return unsentOf(hws, marks);
    };
    const friend = window.DralingoCast ? window.DralingoCast.pick(1)[0] : null;
    main.innerHTML = bandHtml(back, null, ctx.ruta.me) +
      '<section class="rd-pick">' +
        '<h1 class="rd-h1" id="rd-h1">Elige tu mundo</h1>' +
        '<p class="rd-lede">Cada mundo es un nivel de Chino Mandarín. Toca el tuyo.</p>' +
        '<div class="rd-carousel" role="region" aria-roledescription="carrusel" aria-labelledby="rd-h1">' +
          '<div class="rd-stage' + (calmMotion() ? ' is-calm' : '') + '" id="rd-stage">' +
            mods.map((m, i) => cardHtml(m, i, looks[m.slug], ctx, toSendOf(m))).join('') + '</div>' +
          '<div class="rd-ctrl"' + (mods.length < 2 ? ' hidden' : '') + '>' +
            '<button class="rd-arrow" type="button" data-dir="-1" aria-controls="rd-stage" aria-label="Mundo anterior">' + I.left + '</button>' +
            '<div class="rd-dots" role="tablist" aria-label="Mundos">' +
              '<span class="rd-dot-now" aria-hidden="true"></span>' +
              mods.map((m) => '<button class="rd-dot" type="button" role="tab" id="rd-t-' + esc(m.slug) + '" aria-controls="rd-p-' + esc(m.slug) + '" aria-label="' + esc(m.name) + '"><i></i></button>').join('') +
            '</div>' +
            '<button class="rd-arrow" type="button" data-dir="1" aria-controls="rd-stage" aria-label="Mundo siguiente">' + I.right + '</button>' +
          '</div>' +
          '<p class="au-sr" id="rd-live" aria-live="polite"></p>' +
        '</div>' +
        (anon ? '<div class="rd-join">' +
          (friend ? '<img class="rd-join-friend" src="' + esc(window.DralingoCast.pose(friend, 'hello')) + '" alt="" width="200" height="240" loading="lazy" decoding="async">' : '') +
          '<div class="rd-join-text"><h2 class="rd-join-title">¿Ya eres alumno de Dralingo?</h2>' +
          '<p>Entra con tu código de estudiante. ¿Tienes la clave de tu nivel? Toca tu mundo.</p>' +
          '<a class="rd-btn rd-btn-red" href="/homework.html?next=%2Faudios">Entrar con mi código</a></div></div>' : friendRow('is-pick')) +
      '</section>';
    live = carousel(main, mods, start);
    wireMe(main, ctx);
    document.body.classList.add('rp-on');
  }
  // «Tus tareas» is the kid's own level: a phone nobody is logged in on counts every level as its own; a teacher, or a
  // kid looking at another module, only plays its homework (no marks, no counts)
  const mineOf = (ctx, m) => !ctx.ruta.teacher && (!ctx.ruta.student || m.slug === ctx.ruta.home);
  // 🔒 2026-10-18: El Simulacro Dorado in class (the server's `solo: false`: a kid never starts one from here; a teacher
  // still sees and opens everything)
  const classMode = (ctx) => ctx.ruta.solo === false && !ctx.ruta.teacher;
  const idsOfCtx = (ctx) => (slug) => ctx.homeworksOf(slug).map((h) => h.id);

  // ── the flying carousel ───────────────────────────────────────────
  // pos = which card is in the middle (0, 1, 2…; fractions while flying). Each frame writes transform/opacity only;
  // the card size is read once (and on resize), never inside a frame.
  function carousel(main, mods, start) {
    const stage = main.querySelector('#rd-stage');
    const slides = Array.prototype.slice.call(stage.querySelectorAll('.rd-slide'));
    const cards = slides.map((s) => s.querySelector('.rd-card'));
    const shades = slides.map((s) => s.querySelector('.rd-card-shade'));
    const glosses = slides.map((s) => s.querySelector('.rd-card-gloss'));
    const dots = Array.prototype.slice.call(main.querySelectorAll('.rd-dot'));
    const now = main.querySelector('.rd-dot-now');
    const arrows = Array.prototype.slice.call(main.querySelectorAll('.rd-arrow'));
    const liveEl = main.querySelector('#rd-live');
    const shines = slides.map((s) => s.querySelector('.rd-card-shine'));
    const n = slides.length;
    const calm = stage.classList.contains('is-calm');
    // three worlds or more go round in a ring (a neighbour on each side, like a world select); two stop at the ends
    const loop = n >= 3;
    const norm = (i) => ((i % n) + n) % n;
    const ring = (x) => (loop ? x - n * Math.round(x / n) : x);       // the shortest way from the middle to a card
    let pos = start, target = start, vel = 0, active = -1, raf = 0, last = 0, spacing = 300, dotStep = 44;
    let drag = null, dragRaf = 0, dragEndAt = 0, userMoved = false;
    const zNow = [];
    // spring: stiffness 190, damping ratio 0.66 (about 6 % overshoot: the little bounce), settles in ~0.45 s
    const K = 190, C = 2 * Math.sqrt(K) * 0.66;

    function measure() {
      const w = slides[0].offsetWidth || 280;
      const room = stage.clientWidth || window.innerWidth;
      // the neighbours peek in from the edges on a phone, stand beside the middle card on a laptop
      spacing = Math.min(w * 0.86, Math.max(w * 0.72, (room - w) / 2 + w * 0.3));
      dotStep = dots.length > 1 ? (dots[1].offsetLeft - dots[0].offsetLeft) || 44 : 44;
      if (now) now.style.transform = 'translate3d(' + (Math.max(0, active) * dotStep) + 'px,0,0)';
    }
    function paint() {
      for (let i = 0; i < n; i++) {
        const d = ring(i - pos), ad = Math.abs(d);
        if (!calm) {
          const cd = Math.max(-1.5, Math.min(1.5, d));
          slides[i].style.transform = 'perspective(1100px) translate3d(' + (d * spacing).toFixed(1) + 'px,' + (Math.min(ad, 1) * 16).toFixed(1) + 'px,' +
            (-Math.min(ad, 2.2) * 170).toFixed(1) + 'px) rotateY(' + (-cd * 26).toFixed(2) + 'deg)';
          slides[i].style.opacity = ad > 2.4 ? '0' : (ad > 1.5 ? ((2.4 - ad) / 0.9).toFixed(3) : '1');
          shades[i].style.opacity = (Math.min(ad, 1) * 0.46).toFixed(3);
          glosses[i].style.transform = 'translate3d(' + (cd * -38).toFixed(1) + '%,0,0)';
        }
        const z = 100 - Math.round(ad * 20);   // the card nearest the middle is always in front
        if (zNow[i] !== z) { slides[i].style.zIndex = String(z); zNow[i] = z; }
      }
    }
    function setActive(i, announce) {
      if (i === active) return;
      active = i;
      slides.forEach((s, k) => {
        const on = k === i;
        s.classList.toggle('is-active', on);
        if (on) s.removeAttribute('inert'); else s.setAttribute('inert', '');
        cards[k].tabIndex = on ? 0 : -1;       // (phones without inert: only the middle card is a tab stop)
      });
      dots.forEach((d, k) => { d.setAttribute('aria-selected', String(k === i)); d.tabIndex = k === i ? 0 : -1; });
      if (now) now.style.transform = 'translate3d(' + (i * dotStep) + 'px,0,0)';   // the gold pill slides (css transition)
      // aria-disabled, not disabled: a focused ‹ › keeps the focus (only two worlds stop at the ends)
      arrows[0].setAttribute('aria-disabled', String(!loop && i <= 0));
      arrows[1].setAttribute('aria-disabled', String(!loop && i >= n - 1));
      store.set('draly_ruta_at', mods[i].slug);
      store.setL('draly_ruta_last', mods[i].slug);
      if (announce && liveEl) {
        const m = mods[i];
        liveEl.textContent = '';
        setTimeout(() => { liveEl.textContent = m.name + ', mundo ' + (i + 1) + ' de ' + n + (m.open ? '' : ', se abre con la clave'); }, 30);
      }
    }
    function step(t) {
      const dt = Math.min(0.064, Math.max(0, (t - last) / 1000));
      last = t;
      let left = dt;
      while (left > 0) {                       // small fixed steps: the same spring on a 30 Hz phone and a 120 Hz laptop
        const h = Math.min(1 / 240, left);
        vel += (-K * (pos - target) - C * vel) * h;
        pos += vel * h;
        left -= h;
      }
      if (Math.abs(pos - target) < 0.0006 && Math.abs(vel) < 0.003) {
        pos = target = norm(Math.round(target)); vel = 0; raf = 0; paint(); settled();   // back to 0…n-1 (the ring looks the same)
        return;
      }
      paint();
      raf = requestAnimationFrame(step);
    }
    function kick() {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(step);
    }
    function settled() {
      if (!userMoved) return;
      userMoved = false;
      const s = shines[active];               // the arrival: one gold sweep across the card that just landed
      if (s && s.animate) {
        try {
          s.animate([{ opacity: 1, transform: 'translate3d(-45%,0,0)' }, { opacity: 0, transform: 'translate3d(45%,0,0)' }],
            { duration: 820, easing: 'cubic-bezier(.23, 1, .32, 1)' });
        } catch (_) { /* an old phone: no sweep */ }
      }
    }
    // how: 'card' / 'dot' = the keyboard moved (focus follows, the focused element speaks for itself);
    // 'tap' = a dot was tapped (it speaks for itself too); nothing = a swipe or ‹ ›: the live region says where we are
    function go(i, v0, how) {
      const idx = loop ? norm(i) : Math.max(0, Math.min(n - 1, i));
      userMoved = true;
      setActive(idx, !how);
      if (calm) { pos = target = idx; paint(); }
      else {
        target = loop ? idx + n * Math.round((pos - idx) / n) : idx;   // the nearest way round the ring
        if (typeof v0 === 'number' && isFinite(v0)) vel = Math.max(-14, Math.min(14, v0));
        kick();
      }
      if (how === 'card') { try { cards[idx].focus({ preventScroll: true }); } catch (_) {} }
      if (how === 'dot' && dots[idx]) { try { dots[idx].focus({ preventScroll: true }); } catch (_) {} }
    }

    // ── touch and mouse: the card follows the finger, a flick flies one card on ──
    const rubber = (x) => 0.32 * (1 - Math.exp(-x * 1.6));   // two worlds, past an end: it gives a little, then stops
    function onDown(e) {
      if (drag || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;   // one finger at a time
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, p0: pos, from: active, moved: false, pts: [[e.timeStamp, e.clientX]] };
      if (raf) { cancelAnimationFrame(raf); raf = 0; }  // grab the card mid-flight
    }
    function onMove(e) {
      if (!drag || e.pointerId !== drag.id) return;
      // a mouse let go outside the window never sends pointerup: no button pressed any more = the drag is over
      if (e.pointerType === 'mouse' && !(e.buttons & 1)) { endDrag(false); return; }
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.moved) {
        if (Math.abs(dx) < 7 && Math.abs(dy) < 7) return;
        if (Math.abs(dy) > Math.abs(dx)) { endDrag(false); return; }   // the page is scrolling: let it
        drag.moved = true;
        try { stage.setPointerCapture(e.pointerId); } catch (_) {}
        stage.classList.add('is-dragging');
      }
      drag.pts.push([e.timeStamp, e.clientX]);
      while (drag.pts.length > 2 && e.timeStamp - drag.pts[0][0] > 90) drag.pts.shift();
      if (calm) return;
      let p = drag.p0 - dx / spacing;
      if (!loop) {
        if (p < 0) p = -rubber(-p);
        else if (p > n - 1) p = n - 1 + rubber(p - (n - 1));
      }
      pos = p;
      // a 120 Hz screen sends several moves per frame: draw once per frame
      if (!dragRaf) dragRaf = requestAnimationFrame(() => { dragRaf = 0; paint(); });
    }
    function endDrag(fling) {
      const d = drag;
      drag = null;
      if (dragRaf) { cancelAnimationFrame(dragRaf); dragRaf = 0; }
      stage.classList.remove('is-dragging');
      if (!d) return;
      if (!d.moved || !fling) { if (pos !== target) kick(); return; }
      dragEndAt = performance.now();
      const a = d.pts[0], b = d.pts[d.pts.length - 1];
      const v = b[0] > a[0] ? (b[1] - a[1]) / (b[0] - a[0]) : 0;          // px per ms; < 0 = towards the next card
      const moved = calm ? -((b[1] - d.x0) / spacing) : ring(pos - d.from);
      const dir = v < -0.28 ? 1 : v > 0.28 ? -1 : (moved > 0.2 ? 1 : moved < -0.2 ? -1 : 0);
      go(d.from + dir, (-v * 1000) / spacing);
    }
    function onUp(e) { if (drag && e.pointerId === drag.id) endDrag(e.type === 'pointerup'); }
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', onUp);
    stage.addEventListener('lostpointercapture', onUp);
    stage.addEventListener('dragstart', (e) => e.preventDefault());
    // a drag never opens the card it ended on; a tap on a side card brings it to the middle
    stage.addEventListener('click', (e) => {
      if (performance.now() - dragEndAt < 450) { e.preventDefault(); e.stopPropagation(); return; }
      if (e.target.closest('.rd-slide.is-active')) return;
      const r = slides[active].getBoundingClientRect();
      if (e.clientX < r.left) go(active - 1); else if (e.clientX > r.right) go(active + 1);
    }, true);
    // keys: ← → on the card, ← → Home End on the dots (one tab stop, roving)
    stage.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); go(active + (e.key === 'ArrowRight' ? 1 : -1), undefined, 'card'); }
    });
    dots.forEach((d, k) => {
      d.addEventListener('click', () => go(k, undefined, 'tap'));
      d.addEventListener('keydown', (e) => {
        const to = e.key === 'ArrowRight' ? active + 1 : e.key === 'ArrowLeft' ? active - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : null;
        if (to == null) return;
        e.preventDefault();
        go(to, undefined, 'dot');
      });
    });
    arrows.forEach((b) => b.addEventListener('click', () => {
      if (b.getAttribute('aria-disabled') === 'true') return;
      go(active + Number(b.getAttribute('data-dir')));
    }));
    const onResize = () => { measure(); paint(); };
    window.addEventListener('resize', onResize);

    setActive(start, false);
    measure();
    paint();   // the still first frame: no entrance animation
    return {
      destroy() { if (raf) cancelAnimationFrame(raf); raf = 0; if (dragRaf) cancelAnimationFrame(dragRaf); dragRaf = 0; window.removeEventListener('resize', onResize); },
      // test hook (screenshots of a card mid-flight; headless browsers barely animate): draw position p as it is
      at(p) { if (raf) { cancelAnimationFrame(raf); raf = 0; } pos = p; paint(); return pos; },
      go,
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // a module's page: the ladder + «Tus tareas» (redesign 2026-10-18)
  // ════════════════════════════════════════════════════════════════════
  // The three steps for this visitor → { steps: [{ key, n, state, current, … }], say } (state: 'fresh' | 'started' |
  // 'done' | 'locked' | 'soon'; current: the one with the next useful thing to do). See the header for «done» / «current».
  function ladderOf(ctx, m) {
    const st = statesOf(m);
    const anon = !ctx.ruta.student && !ctx.ruta.teacher;
    const cb = m.base && (ctx.catalog.bases || []).find((x) => x.id === m.base.id);
    const pr = progressOf(ctx, m);
    const tw = trainWorldsOf(ctx, m, pr);
    const need = (m.dorado && m.dorado.pct) || 70;
    const regular = tw.filter((w) => w.kind === 'world');
    const atGoal = (w) => w.best != null && (w.kind !== 'world' || w.best >= need);
    const href = (p) => '/audios/' + m.slug + p;

    // 1 · La Base
    const words = m.base ? m.base.words : 0;
    const sealed = pr ? pr.sealed : 0;
    const s1 = { key: 'base', n: 1, title: 'La Base', line: 'Marca las palabras que ya sabes' };
    if (st.base === 'soon') Object.assign(s1, { state: 'soon', status: 'Todas las palabras con su audio', opens: 'Muy pronto' });
    else if (st.base === 'locked') Object.assign(s1, { state: 'locked', status: words + ' palabras con audio', opens: 'Se abre con la clave' });
    else {
      const left = Math.max(0, words - sealed);
      const firstOpen = pr && pr.worlds.find((w) => w.sealed < w.count);
      Object.assign(s1, {
        state: sealed >= words && words ? 'done' : (sealed ? 'started' : 'fresh'),
        status: sealed + ' de ' + words + ' sellos', pct: words ? sealed / words : 0, meter: pr ? meterOf(pr) : '',
        badge: left && sealed < words ? left + ' por marcar' : '',
        go: cb ? '/audios/' + cb.id + (sealed && firstOpen ? '#mundo-' + firstOpen.n : '') : null,
        world: firstOpen || null,
      });
    }
    // 2 · El Entrenamiento
    const s2 = { key: 'train', n: 2, title: 'El Entrenamiento', line: 'Practica cada mundo jugando' };
    const openRegular = regular.filter((w) => w.open);
    const todoRegular = openRegular.filter((w) => !atGoal(w));
    const todoExtra = tw.filter((w) => w.kind !== 'world' && w.open && !atGoal(w));
    const counted = regular.filter(atGoal).length;
    if (st.train === 'soon') Object.assign(s2, { state: 'soon', status: 'Rondas como en el examen', opens: 'Muy pronto' });
    else if (st.train === 'locked') Object.assign(s2, { state: 'locked', status: worldCount(cb) ? worldCount(cb) + ' mundos para practicar' : 'Mundo por mundo', opens: 'Se abre con la clave' });
    else if (!tw.some((w) => w.open)) {
      Object.assign(s2, { state: 'locked', byProgress: true, status: '0 de ' + regular.length + ' mundos abiertos', pct: 0,
        opens: 'Se abre al marcar todas las palabras de un mundo' });
    } else {
      const played = tw.some((w) => w.best != null);
      const next = todoRegular[0] || (todoExtra.length && (!pr || sealed >= words) ? todoExtra[0] : null) || null;
      Object.assign(s2, {
        state: regular.length && counted >= regular.length ? 'done' : (played ? 'started' : 'fresh'),
        status: counted + ' de ' + regular.length + ' mundos con ' + need + ' %', pct: regular.length ? counted / regular.length : 0,
        badge: todoRegular.length ? todoRegular.length + ' para practicar' : '',
        go: next ? href('/entrenamiento/' + next.key) : href('/entrenamiento'), list: href('/entrenamiento'), next, worlds: regular, need,
      });
    }
    // 3 · El Simulacro Dorado
    const s3 = { key: 'gold', n: 3, title: 'El Simulacro Dorado', line: 'El examen completo, como el día del examen' };
    const sims = Array.isArray(m.sims) ? m.sims : [];
    const takenOf = (s) => s.best != null || !!s.taken;
    if (st.gold === 'soon') Object.assign(s3, { state: 'soon', status: 'El examen con su audio original', opens: 'Muy pronto' });
    else if (st.gold === 'locked' && !st.goldEarn) Object.assign(s3, { state: 'locked', status: m.simCount + (m.simCount === 1 ? ' simulacro' : ' simulacros') + ' con el audio del examen', opens: 'Se abre con la clave' });
    else if (classMode(ctx)) {
      // 🔒 2026-10-18 (his decision): El Simulacro Dorado is the teacher's. A kid never starts one here: it is taken in
      // class with the teacher's PIN. Once El Entrenamiento is done (every world with the %, or the teacher opened it),
      // this card is the step to do: tell the teacher (WhatsApp). The simulations taken in class keep their books.
      const taken = sims.length ? sims.filter((s) => s.taken).map((s) => ({ n: s.n, mistakes: s.mistakes, at: s.at, book: s.book }))
        : (m.golden && Array.isArray(m.golden.taken) ? m.golden.taken : []);
      const ready = s2.state === 'done' || !!(m.dorado && m.dorado.open && m.dorado.via === 'teacher');
      const all = sims.length > 0 && sims.every(takenOf) && taken.length >= sims.length;
      const lastBook = taken.filter((x) => x.book).reduce((best, x) => (!best || (Number(x.at) || 0) >= (Number(best.at) || 0) ? x : best), null);
      Object.assign(s3, {
        cls: true, sims, taken, book: lastBook, ready, login: !!(m.dorado && m.dorado.login),
        state: all ? 'done' : ready ? 'ready' : 'locked',
        status: taken.length ? taken.length + ' de ' + m.simCount + ' hechos en clase' : m.simCount + (m.simCount === 1 ? ' simulacro' : ' simulacros') + ' con tu profe',
        pct: m.simCount ? taken.length / m.simCount : 0,
        badge: ready && !all ? '¡Avísale a tu profe!' : '',
        opens: 'Se abre en clase con tu profe, cuando termines El Entrenamiento',
        go: lastBook ? lastBook.book : null,
      });
    }
    else if (st.goldEarn) {
      const d = m.dorado;
      const n = d.login ? counted : (d.practiced || 0);
      const of = d.of || regular.length;
      Object.assign(s3, { state: 'locked', earn: true, login: !!d.login, status: n + ' de ' + of + ' mundos con ' + d.pct + ' %', pct: of ? n / of : 0,
        opens: d.login ? 'Tus puntos cuentan cuando entras con tu código' : 'Se abre con ' + d.pct + ' % en cada mundo de El Entrenamiento',
        taken: m.golden && Array.isArray(m.golden.taken) ? m.golden.taken : [] });
    } else {
      const taken = sims.filter(takenOf);
      const nextSim = sims.find((s) => !takenOf(s)) || null;
      const books = sims.filter((s) => s.book);
      // the book of the simulation taken last (the server's `at`), else the highest one taken, else the first book
      const takenBooks = books.filter(takenOf);
      const lastBook = takenBooks.reduce((best, x) => (!best || (Number(x.at) || 0) >= (Number(best.at) || 0) ? x : best), null) || books[0] || null;
      Object.assign(s3, {
        state: sims.length && taken.length >= sims.length ? 'done' : (taken.length ? 'started' : 'fresh'),
        status: taken.length + ' de ' + sims.length + ' simulacros hechos', pct: sims.length ? taken.length / sims.length : 0,
        badge: !sims.length ? '' : !taken.length ? '¡Listo!' : nextSim ? (sims.length - taken.length) + ' por hacer' : '',
        sims, nextSim, go: nextSim ? nextSim.href : (lastBook ? lastBook.book : null), book: lastBook,
        login: !!(m.golden && m.golden.login), pdf: m.golden && m.golden.pdf ? m.golden.pdf : null, mb: m.golden && m.golden.mb,
      });
    }
    // which step is current (the next useful thing to do). A world the kid's seals (or their teacher) opened and not at
    // the % yet comes first: «practise what you just earned» (a teacher visiting has no practice of their own)
    const earned = ctx.ruta.teacher ? [] : todoRegular;
    let cur = null;
    if (!m.open) cur = ([s1, s2, s3].find((s) => s.state !== 'soon') || s1).n;   // a locked module: its key first
    else if (s2.state !== 'locked' && s2.state !== 'soon' && earned.length) cur = 2;
    else if (s1.state === 'fresh' || s1.state === 'started') cur = 1;
    // (the extra worlds, Pinyin and the exam questions, never hold the kid back from El Simulacro Dorado)
    else if (s2.state !== 'locked' && s2.state !== 'soon' && s2.next && s2.next.kind === 'world') cur = 2;
    else if (s3.state === 'fresh' || s3.state === 'started' || s3.state === 'ready') cur = 3;
    const steps = [s1, s2, s3];
    steps.forEach((s) => { s.current = s.n === cur; });
    // the one instruction, for this kid now
    let say;
    if (!m.open) say = 'Escribe la clave de ' + m.name + ' para abrir tu ruta. Está en el mensaje de tu maestra.';
    else if (cur === 1) {
      say = s1.state === 'fresh' ? '¡Empieza aquí! Toca el 1, La Base, y marca las palabras que ya sabes.'
        : (s1.world ? '¡Sigue con el 1! Marca las palabras del mundo ' + (s1.world.short || s1.world.n) + ': te ' + ((s1.world.count - s1.world.sealed) === 1 ? 'falta 1.' : 'faltan ' + (s1.world.count - s1.world.sealed) + '.')
          : '¡Sigue con el 1, La Base! Marca las palabras que ya sabes.');
    } else if (cur === 2) {
      const w = s2.next;
      const name = w ? (w.kind === 'pinyin' ? 'el Pinyin' : w.kind === 'simulacro' ? 'las preguntas del examen' : 'el mundo ' + (w.short || w.n)) : '';
      say = w && w.kind === 'world' && w.best == null && w.via === 'seals' ? '¡Ahora el 2! Practica ' + name + ': ya marcaste todas sus palabras.'
        : w && w.kind === 'world' && w.best == null ? '¡Ahora el 2! Toca el 2 y practica ' + name + '.'
        : w && w.kind === 'world' ? '¡Ahora el 2! Juega otra vez ' + name + ' hasta llegar a ' + need + ' %.'
        : '¡Ahora el 2! Practica ' + name + ' en El Entrenamiento.';
    } else if (cur === 3 && s3.cls) {
      say = s3.taken.length ? '¡Muy bien! Avísale a tu profe: tu próximo Simulacro Dorado es en clase.'
        : '¡Terminaste El Entrenamiento! Avísale a tu profe: ya puedes hacer El Simulacro Dorado en clase.';
    } else if (cur === 3) {
      say = s3.state === 'fresh' ? '¡Ya puedes hacer el examen! Toca el 3, El Simulacro Dorado.'
        : '¡Sigue con el 3! Haz el Simulacro ' + (s3.nextSim ? s3.nextSim.n : '') + '.';
    } else if (s3.cls && s3.state === 'locked') {
      say = s3.login ? 'Entra con tu código para que cuenten tus puntos de El Entrenamiento.'
        : 'Practica cada mundo con ' + need + ' % o más. Después, tu profe abre El Simulacro Dorado en clase.';
    } else if (s3.earn) {
      say = s3.login ? 'Entra con tu código para que cuenten tus puntos y se abra el 3, El Simulacro Dorado.'
        : 'Practica cada mundo con ' + need + ' % o más y se abre el 3, El Simulacro Dorado.';
    } else if (s3.state === 'done') say = '¡Terminaste tu ruta! Repasa tus errores en el libro dorado.';
    else say = '¡Muy bien! Repasa cuando quieras.';
    return { steps, say, st, anon, cb, pr, tw, cur, teacher: !!ctx.ruta.teacher, msg: s3.cls ? teacherMsg(ctx, m) : '' };
  }

  // one step card (the design's picture card)
  function stepHtml(s, m, L) {
    const cls = 'rp-step is-' + s.state + (s.current ? ' is-current' : '');
    // the picture: La Base = a fan of three word pictures, El Entrenamiento = Dralingo's power pose, the Dorado = the star
    let art;
    if (s.key === 'base') {
      const fan = FAN[m.slug];
      const peek = !fan && L.cb && m.open && Array.isArray(L.cb.peek) ? L.cb.peek.slice(0, 3) : null;
      const pics = fan ? fan.map((p) => '/assets/packs/' + m.slug + '/' + p + '.webp') : peek;
      art = pics && pics.length === 3
        ? '<span class="rp-fan" aria-hidden="true"><img class="rp-fan-l" src="' + esc(pics[0]) + '" alt="" width="200" height="200" loading="lazy" decoding="async">' +
          '<img class="rp-fan-r" src="' + esc(pics[2]) + '" alt="" width="200" height="200" loading="lazy" decoding="async">' +
          '<img class="rp-fan-c" src="' + esc(pics[1]) + '" alt="" width="200" height="200" loading="lazy" decoding="async">' +
          '<span class="rp-fan-seal">¡Me la sé!</span></span>'
        : '<img class="rp-art-img" src="/assets/dralingo/wise.webp" alt="" width="432" height="480" loading="lazy" decoding="async">';
    } else if (s.key === 'train') art = '<img class="rp-art-img" src="/assets/dralingo/power.webp" alt="" width="454" height="480" loading="lazy" decoding="async">';
    else art = '<img class="rp-art-img" src="/assets/dralingo/star-hold.webp" alt="" width="347" height="600" loading="lazy" decoding="async">';
    const mark = s.state === 'done' ? '<span class="rp-mark is-done" role="img" aria-label="Hecho">' + I.check + '</span>'
      : s.state === 'locked' ? '<span class="rp-mark is-locked" role="img" aria-label="Bloqueado">' + I.lock + '</span>' : '';
    // what the card says about the kid's progress
    let extra = '';
    if (s.key === 'train' && s.worlds && s.worlds.length) {
      // one small coin per practice world: gold with a check at the %, red = open to play, dashed = not open yet. The
      // row opens the worlds' page (/audios/<level>/entrenamiento: every world's tile, as before)
      const coins = '<ol class="rp-coins" aria-hidden="true">' + s.worlds.map((w) => {
        const done = w.best != null && w.best >= s.need;
        return '<li class="' + (done ? 'is-done' : w.open ? 'is-open' : '') + '" data-w="' + w.n + '"' +
          (!w.open && w.count ? ' style="--p:' + Math.round((w.sealed / w.count) * 100) + '"' : '') + '>' + (done ? I.check : w.n) + '</li>';
      }).join('') + '</ol>';
      extra = s.list ? '<a class="rp-coins-link" href="' + esc(s.list) + '" data-nav aria-label="Ver los ' + s.worlds.length + ' mundos de El Entrenamiento">' + coins + I.right + '</a>' : coins;
      // a teacher's device: the coins are their own rounds, kept here only
      if (L.teacher && window.Entrenamiento) extra += '<p class="rp-teacher-note">' + I.eye + '<span>' + esc(window.Entrenamiento.TEACHER_NOTE) + '</span></p>';
    }
    if (s.key === 'gold' && s.cls) extra = classChipsHtml(s);
    else if (s.key === 'gold' && Array.isArray(s.sims) && s.sims.length) {
      // the simulations: a numbered chip each (gold with a check once passed, 60 %: YCT and HSK pass at 120 / 200; a
      // try below it is «Otra vez», never a low number on screen)
      extra = '<ol class="rp-sims" aria-label="Los simulacros">' + s.sims.map((x) => {
        const pass = x.best != null && x.best >= 60;
        const tried = x.best != null || x.taken;
        // (a taken simulation's mistakes, in a small red number on its corner: its book has them to review)
        const err = x.taken && Number(x.mistakes) > 0 ? Number(x.mistakes) : 0;
        const label = 'Simulacro ' + x.n + (pass ? ': tu mejor ' + x.best + ' %' : tried ? ': ya lo intentaste, otra vez' : '') +
          (err ? ', ' + err + (err === 1 ? ' error' : ' errores') + ' para repasar en su libro dorado' : '');
        return '<li><a class="rp-sim' + (pass ? ' is-pass' : tried ? ' is-tried' : '') + (s.nextSim === x ? ' is-next' : '') + '" href="' + esc(x.href) + '" aria-label="' + esc(label) + '">' +
          (pass ? I.check : '') + '<b>' + (Number(x.n) || 0) + '</b>' + (err ? '<i class="rp-sim-err" aria-hidden="true">' + err + '</i>' : '') + '</a></li>';
      }).join('') + '</ol>';
      if (s.book) {
        const k = s.book.mistakes;
        const tag = s.book.taken && k != null ? (k === 0 ? 'sin errores' : k + (k === 1 ? ' error' : ' errores')) : '';
        extra += '<a class="rp-book" href="' + esc(s.book.book) + '" data-nav>' + I.book + '<span>Libro dorado del Simulacro ' + (Number(s.book.n) || 0) + '</span>' +
          (tag ? '<b>' + tag + '</b>' : '') + '</a>';
      }
      if (s.login) extra += '<p class="rp-note">Tu libro dorado se abre en tu cuenta: <a href="/homework.html?next=' + encodeURIComponent('/audios/' + m.slug) + '">entra con tu código</a>.</p>';
      // (the study PDFs download for the super admin only: his rule 2026-10-18)
      if (s.pdf) extra += '<a class="rp-pdf" href="' + esc(s.pdf) + '" download>Libro en PDF (solo administración)</a>';
    }
    if (s.key === 'gold' && !s.cls && s.earn && s.taken && s.taken.length) {
      // while the Dorado is closed: the books of the simulations the kid took in a teacher's room (taken anywhere is enough)
      extra = s.taken.map((x) => {
        const k = x.mistakes;
        return '<a class="rp-book" href="' + esc(x.book) + '" data-nav>' + I.book + '<span>Libro dorado del Simulacro ' + (Number(x.n) || 0) + '</span>' +
          (k != null ? '<b>' + (k === 0 ? 'sin errores' : k + (k === 1 ? ' error' : ' errores')) + '</b>' : '') + '</a>';
      }).join('');
    }
    // the button: a direct verb on the current step, soft «Seguir…» on a started one, «Repasar» on a done one
    let act = '';
    const btn = (href, label, kind, nav) => '<a class="rp-btn rp-btn-' + kind + '" href="' + esc(href) + '"' + (nav ? ' data-nav' : '') + '>' + esc(label) + (kind === 'go' ? I.go : '') + '</a>';
    if (s.key === 'gold' && s.cls) act = classActHtml(s, m, L);
    else if (s.state === 'locked' || s.state === 'soon') {
      if (s.current && !m.open) {
        // a locked module: its key is the first step (the key box)
        act = '<p class="rp-opens">' + I.key + '<span>Se escribe una sola vez y abre los 3 pasos</span></p>' +
          btn('/audios/' + m.slug + '/clave', 'Escribe la clave de ' + m.name, 'go', false) +
          (L.anon ? '<p class="rp-alt">¿Ya eres alumno? <a href="/homework.html?next=' + encodeURIComponent('/audios/' + m.slug + '/clave') + '">Entra con tu código</a></p>' : '');
      } else if (s.key === 'gold' && s.earn && s.login) {
        act = '<p class="rp-opens">' + I.lock + '<span>' + esc(s.opens) + '</span></p>' + btn('/homework.html?next=' + encodeURIComponent('/audios/' + m.slug), 'Entrar con mi código', 'soft', false);
      } else act = '<p class="rp-opens">' + (s.state === 'soon' ? I.soon : I.lock) + '<span>' + esc(s.opens) + '</span></p>';
    } else if (s.key === 'base') {
      const label = s.current ? (s.state === 'fresh' ? 'Empezar aquí' : s.state === 'done' ? 'Repasar' : 'Seguir marcando') : (s.state === 'done' ? 'Repasar' : s.state === 'started' ? 'Seguir marcando' : 'Empezar');
      act = s.go ? btn(s.go, label, s.current ? 'go' : s.state === 'done' ? 'done' : 'soft', true) : '';
    } else if (s.key === 'train') {
      const label = s.current ? (s.next && s.next.kind === 'world' ? 'Practicar aquí' : 'Practicar') : (s.state === 'done' ? 'Repasar' : s.state === 'started' ? 'Seguir practicando' : 'Entrar');
      act = btn(s.current ? s.go : s.list, label, s.current ? 'go' : s.state === 'done' ? 'done' : 'soft', true);
    } else {
      const label = s.nextSim ? (s.current ? 'Hacer el Simulacro ' + s.nextSim.n : (s.state === 'started' ? 'Seguir: Simulacro ' : 'Simulacro ') + s.nextSim.n) : 'Repasar';
      act = s.go ? btn(s.go, label, s.current ? 'go' : s.state === 'done' ? 'done' : 'soft', !s.nextSim) : '';
    }
    const bar = s.meter ? '<span class="rp-bar is-meter">' + s.meter + '</span>'
      : '<span class="rp-bar" aria-hidden="true"><i style="width:' + Math.round((s.pct || 0) * 100) + '%"></i></span>';
    return '<li class="' + cls + '" id="paso-' + s.n + '" data-step="' + s.key + '">' +
      (s.current ? '<span class="rp-tag">¡Empieza aquí!</span>' : '') +
      '<div class="rp-art is-' + s.key + '">' + art + '<b class="rp-num" aria-hidden="true">' + s.n + '</b>' + mark + '</div>' +
      '<div class="rp-body">' +
        '<h2 class="rp-step-t"><span class="au-sr">Paso ' + s.n + ': </span>' + s.title + '</h2>' +
        '<p class="rp-line">' + esc(s.line) + '</p>' + bar +
        '<p class="rp-status"><span>' + esc(s.status) + '</span>' + (s.badge ? '<span class="rp-badge">' + esc(s.badge) + '</span>' : '') + '</p>' +
        extra + '<div class="rp-act">' + act + '</div>' +
      '</div></li>';
  }

  // ── card 3 in class (2026-10-18, DORADO_SELF_SERVE off in server.js): the teacher opens El Simulacro Dorado ──
  // the simulations as numbered chips: one taken in class opens its golden book (its mistakes in red on the corner); one
  // not taken yet is a plain number (the teacher opens it in class), never a link to a player
  function classChipsHtml(s) {
    let out = '';
    // (the chips only once a simulation was taken: before that they would be plain numbers, and the card's button must
    // stay on a short laptop's first screen)
    if (s.sims.length && s.taken.length) {
      out = '<ol class="rp-sims" aria-label="Los simulacros">' + s.sims.map((x) => {
        const n = Number(x.n) || 0;
        const pass = x.best != null && x.best >= 60;
        const err = x.taken && Number(x.mistakes) > 0 ? Number(x.mistakes) : 0;
        if (x.taken && x.book) {
          const label = 'Simulacro ' + n + ': hecho en clase' + (err ? ', ' + err + (err === 1 ? ' error' : ' errores') + ' para repasar en su libro dorado' : ', abre su libro dorado');
          return '<li><a class="rp-sim' + (pass ? ' is-pass' : ' is-tried') + '" href="' + esc(x.book) + '" data-nav aria-label="' + esc(label) + '">' + (pass ? I.check : '') + '<b>' + n + '</b>' +
            (err ? '<i class="rp-sim-err" aria-hidden="true">' + err + '</i>' : '') + '</a></li>';
        }
        return '<li><span class="rp-sim is-class" role="img" aria-label="Simulacro ' + n + ': en clase con tu profe"><b>' + n + '</b></span></li>';
      }).join('') + '</ol>';
    }
    // the book of the simulation taken last (or, while the list is not sent, every book taken)
    const books = s.sims.length ? (s.book ? [s.book] : []) : s.taken.filter((x) => x.book);
    out += books.map((x) => {
      const k = x.mistakes;
      return '<a class="rp-book" href="' + esc(x.book) + '" data-nav>' + I.book + '<span>Libro dorado del Simulacro ' + (Number(x.n) || 0) + '</span>' +
        (k != null ? '<b>' + (k === 0 ? 'sin errores' : k + (k === 1 ? ' error' : ' errores')) + '</b>' : '') + '</a>';
    }).join('');
    return out;
  }
  // the message the family sends the teacher (the kid's name when the account has a real one; never the placeholder,
  // never the code: the family picks the chat)
  function teacherMsg(ctx, m) {
    const me = ctx.ruta.me;
    const name = me && me.name && !me.placeholder ? me.name : '';
    return '¡Hola, profe! ' + (name ? 'Soy ' + name + '. ' : '') + 'Terminé El Entrenamiento de ' + m.name + '. ¡Ya puedo hacer El Simulacro Dorado!';
  }
  const WA_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.2a9.7 9.7 0 0 0-8.4 14.6L2.3 21.7l5-1.3A9.7 9.7 0 1 0 12 2.2zm0 17.7a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 19.9zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8.9c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.7-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.2-.2-.4-.3z"/></svg>';
  function classActHtml(s, m, L) {
    if (s.state === 'ready') {
      // the big button helps the family tell the teacher (WhatsApp with no number: the family picks the teacher's chat)
      return '<a class="rp-btn rp-btn-wa" href="' + esc('https://wa.me/?text=' + encodeURIComponent(L.msg)) + '" data-tell target="_blank" rel="noopener">' + WA_ICON + '<span>Avisarle a mi profe</span></a>' +
        '<button type="button" class="rp-btn rp-btn-soft" data-tell-copy>' + I.copy + '<span>Copiar mensaje</span></button>' +
        '<p class="rp-opens">' + I.trophy + '<span>Tu profe lo abre en clase con un PIN</span></p>';
    }
    if (s.state === 'done') return s.go ? '<a class="rp-btn rp-btn-done" href="' + esc(s.go) + '" data-nav>Repasar</a>' : '';
    return '<p class="rp-opens">' + I.lock + '<span>' + esc(s.opens) + '</span></p>' +
      (s.login && L.anon ? '<p class="rp-alt"><a href="/homework.html?next=' + encodeURIComponent('/audios/' + m.slug) + '">Entra con tu código</a> para que cuenten tus puntos</p>' : '');
  }

  // «Copiar mensaje»: the same text for a family that writes to the teacher another way
  function wireTell(main, L) {
    const b = main.querySelector('[data-tell-copy]');
    if (!b || !L.msg) return;
    b.addEventListener('click', () => {
      if (window.DralyAuto) { window.DralyAuto.copyText(L.msg, b, '¡Mensaje copiado!'); return; }
      try { navigator.clipboard.writeText(L.msg).then(() => { b.lastChild.textContent = '¡Mensaje copiado!'; }, () => {}); } catch (_) {}
    });
  }

  // ── «Tus tareas»: the homework audios of the level, by experience (folders) ─────────────────
  const KIND_T = { words: 'Las palabras', dialogue: 'Escucha, lee, repite', video: 'Tu video' };
  // 🗂️ «Homework by experience, like folders» (his rule 2026-10-18: "you tap on it and then that experience has two
  // homeworks or three… if you keep them all scroll down in the list then it's going to become messy"). The module's
  // experiences come from the server (`exps`: the level's curriculum pack worlds, EXP1…EXP8, each with a pack picture);
  // a homework's `exp` is its experience. → [{ n, name, pic, hws: [homeworks, round 1 first] }] (an experience a
  // homework names but the pack doesn't is added from the homework itself: never a homework without its folder)
  function expsOf(m, hws) {
    const list = (Array.isArray(m.exps) ? m.exps : []).map((e) => ({ n: Number(e.n) || 0, name: e.name || '', pic: e.pic || '', hws: [] }));
    hws.forEach((h) => {
      const n = Number(h.exp) || 0;
      let e = list.find((x) => x.n === n);
      if (!e) { e = { n, name: h.title || '', pic: '', hws: [] }; list.push(e); }
      e.hws.push(h);
    });
    list.forEach((e) => { e.hws.sort((a, b) => (a.round || 0) - (b.round || 0)); if (!e.pic && e.hws[0]) e.pic = hwPic(e.hws[0], m.slug); });
    return list.sort((a, b) => a.n - b.n);
  }
  // the folder open on this tab (a trip to a homework's own page and back finds it open again)
  const OPEN_KEY = 'draly_tareas_exp';
  const openExpOf = (m) => { const v = store.get(OPEN_KEY) || ''; const p = v.split(':'); return p[0] === m.slug ? Number(p[1]) || 0 : 0; };
  const setOpenExp = (m, n) => store.set(OPEN_KEY, n ? m.slug + ':' + n : '');
  // a folder's tag: «N por mandar» (red), «✓ Mandadas» (green, all sent), «N tareas» (only plays), «Pronto» (none yet)
  function expTag(e, marks, mine, preview) {
    if (!e.hws.length) return { cls: 'is-soon', html: 'Pronto', say: 'pronto' };
    if (!mine && !preview) return { cls: 'is-other', html: e.hws.length + (e.hws.length === 1 ? ' tarea' : ' tareas'), say: e.hws.length + (e.hws.length === 1 ? ' tarea' : ' tareas') };
    const n = preview ? e.hws.length : unsentOf(e.hws, marks);
    if (n) return { cls: 'is-todo', html: n + ' por mandar', say: n + (n === 1 ? ' tarea por mandar' : ' tareas por mandar') };
    return { cls: 'is-done', html: I.check + 'Mandadas', say: 'todas mandadas' };
  }
  // ── one homework's marks: ONE look and ONE behaviour for the module page's cards and the homework's own page
  // (/audios/<homework id>, js/audios.js → Ruta.hwMarks) ──
  // state: 'new' | 'heard' | 'sent' (the kid's own) · 'other' (another level's homework: it only plays) · 'preview' (a
  // teacher: the kid's buttons, calm, doing nothing)
  const stateTag = (state) => (state === 'sent' ? I.check + 'Mandada' : state === 'heard' ? 'Escuchada' + I.check : 'Nueva');
  const SEND_BTN = '<button type="button" class="rp-hw-send" data-send>¡Ya la mandé!</button>';
  const playBtn = (state) => '<button type="button" class="rp-hw-play" data-play aria-pressed="false">' +
    (state === 'new' || state === 'other' || state === 'preview' ? I.play + '<span>Escuchar</span>' : I.again + '<span>Otra vez</span>') + '</button>';
  const NOW_HTML = '<p class="rp-hw-now" data-now hidden><span data-now-t></span><span class="rp-hw-line"><i data-now-f></i></span></p>';
  // noPlay: the homework's own page plays its three audios itself
  function actsHtml(state, noPlay) {
    if (state === 'preview') {
      return '<div class="rp-hw-acts">' + (noPlay ? '' : playBtn(state)) + '<span class="rp-hw-send is-preview" aria-hidden="true">¡Ya la mandé!</span></div>' +
        (noPlay ? '' : NOW_HTML) + '<p class="rp-hw-prev">' + I.eye + '<span>Así lo ven tus alumnos</span></p>';
    }
    return '<div class="rp-hw-acts">' + (noPlay ? '' : playBtn(state)) + (state === 'sent' || state === 'other' ? '' : SEND_BTN) + '</div>' +
      (noPlay ? '' : NOW_HTML) +
      (state === 'other' ? '' : '<p class="rp-hw-undo" data-undo hidden>¿Fue sin querer? <button type="button" data-unsend>Deshacer</button></p>');
  }
  // a card or a bar to a new state (→ false when it already was); the tag, the «¡Ya la mandé!» button
  function paintHw(el, state) {
    if (el.classList.contains('is-' + state)) return false;
    el.classList.remove('is-new', 'is-heard', 'is-sent');
    el.classList.add('is-' + state);
    el.querySelectorAll('[data-state]').forEach((tag) => { tag.innerHTML = stateTag(state); });
    const acts = el.querySelector('.rp-hw-acts');
    const send = el.querySelector('[data-send]');
    if (state === 'sent' && send) send.remove();
    if (state !== 'sent' && !send && acts) acts.insertAdjacentHTML('beforeend', SEND_BTN);
    return true;
  }
  const hwStateOf = (marks, id) => { const e = marks[id] || {}; return e.s ? 'sent' : e.h ? 'heard' : 'new'; };
  // a kid's tap: «¡Ya la mandé!» ('s') or «Deshacer» ('u') (the audio playing marks 'h' by itself). A phone with no
  // account: the tap is the phone's own, and «¡Ya la mandé!» is a first real step: the phone gets its automatic account
  // (js/ruta-auto.js; listening alone never makes one: a printed PDF's audio is opened by every family). onAccount: the
  // page settles with the new account (the phone's marks join it).
  function markTap(id, kind, ctx, level, onAccount) {
    tMark(id, kind, ctx.ruta);
    const R = ctx.ruta;
    if (kind !== 's' || (R && (R.teacher || (R.student && R.who))) || !window.DralyAuto || !level) return;
    window.DralyAuto.ensure(level, 'tarea', id).then((r) => { if (r && onAccount) onAccount(r); });
  }
  // after a «¡Ya la mandé!» tap: «Deshacer» for 8 s, the tag pops, the screen reader hears it
  function sentMoment(el, title) {
    const undo = el.querySelector('[data-undo]');
    if (undo) { undo.hidden = false; clearTimeout(undo._t); undo._t = setTimeout(() => { undo.hidden = true; }, 8000); }
    const tag = el.querySelector('[data-state]');
    if (tag && tag.animate && !calmMotion()) {
      try { tag.animate([{ transform: 'scale(.6)', opacity: 0.3 }, { transform: 'scale(1.12)', opacity: 1, offset: 0.6 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.23, 1, .32, 1)' }); } catch (_) {}
    }
    const say = document.getElementById('au-say');
    if (say) { say.textContent = ''; setTimeout(() => { say.textContent = title + ': mandada.'; }, 30); }
  }
  // the new automatic account: the card once («¡Ya tienes tu cuenta!»), then the page asks the server again (the marks,
  // the seals and the scores this phone holds join the account through their usual paths)
  function accountArrived(r, again) {
    if (r && r.account && (r.created || r.resumed) && window.DralyAuto) window.DralyAuto.welcome(r.account);
    if (again) again();
  }
  // mine: the kid's own level (a phone nobody logged in on counts every level as its own); another level's homework
  // (a teacher, or a kid looking at another module) only plays: no marks, no counts
  // 👀 a teacher (2026-10-18, he never saw the kids' buttons: his computer is a teacher's): each card shows the kid's
  // buttons as a calm preview that does nothing and writes nothing, with «Así lo ven tus alumnos»
  // one homework's card inside its folder (the same marks everywhere: «Escuchar», «¡Ya la mandé!», «Deshacer»)
  function hwCardHtml(m, h, state) {
    const pic = hwPic(h, m.slug);
    // (the picture and the name open the homework's own page: its lines with pinyin and Spanish, the PDF's audio codes)
    return '<li class="rp-hw is-' + state + '" data-hw="' + esc(h.id) + '">' +
      '<a class="rp-hw-open" href="/audios/' + esc(h.id) + '" data-nav>' +
        '<img class="rp-hw-pic" src="' + esc(pic) + '" alt="" width="200" height="200" loading="lazy" decoding="async"' +
          (h.thumb && pic !== h.thumb ? ' data-alt="' + esc(h.thumb) + '"' : '') + '>' +
        '<span class="rp-hw-kicker">Tarea · Ronda ' + (Number(h.round) || 1) + '</span>' +
        '<h4 class="rp-hw-title">' + esc(h.title) + '</h4>' +
        (state === 'other' ? '' : '<span class="rp-hw-state" data-state>' + stateTag(state === 'preview' ? 'new' : state) + '</span>') +
      '</a>' +
      '<div class="rp-hw-body">' + actsHtml(state) + '</div></li>';
  }
  // «Tus tareas» = every experience of the module as a folder (picture, name, its tag); a tap opens that experience's
  // 2-3 homeworks with «← Volver a las experiencias». The newest homework's experience glows («La más nueva»): this
  // week's homework is one tap away. Folders keep the curriculum's order (Experiencia 1, 2, 3…) so a kid always finds
  // theirs in the same place. A module with no homework audio at all (YCT 1 today) keeps no column (never an empty box).
  function tareasHtml(ctx, m, hws, marks, mine) {
    if (!hws.length) return '';
    const preview = !mine && !!ctx.ruta.teacher;
    const toSend = mine ? unsentOf(hws, marks) : 0;
    const showLogin = !ctx.ruta.student && !ctx.ruta.teacher;
    const exps = expsOf(m, hws);
    const latest = Number(hws[0].exp) || 0;                        // (homeworksOf: the newest first)
    const open = exps.some((e) => e.n === openExpOf(m) && e.hws.length) ? openExpOf(m) : 0;
    const stateOf = (h) => { const e = (mine && marks[h.id]) || {}; return preview ? 'preview' : !mine ? 'other' : e.s ? 'sent' : e.h ? 'heard' : 'new'; };
    const folders = exps.map((e) => {
      const tag = expTag(e, marks, mine, preview);
      const isLatest = e.n === latest && e.hws.length;
      // (the picture carries the experience's number, like card 2's coins: «Experiencia 3» in full for a screen reader
      // and on the open folder; a compact card keeps all 8 folders on a short laptop's first screen)
      const inner = '<span class="rp-exp-art" aria-hidden="true"><img class="rp-exp-pic" src="' + esc(e.pic) + '" alt="" width="200" height="200" loading="lazy" decoding="async">' +
          '<b class="rp-exp-num">' + e.n + '</b></span>' +
        '<span class="rp-exp-name">' + esc(e.name) + '</span>' +
        '<span class="rp-exp-tag ' + tag.cls + '" data-exp-tag>' + tag.html + '</span>' +
        (isLatest ? '<span class="rp-exp-new">La más nueva</span>' : '');
      const label = 'Experiencia ' + e.n + ', ' + e.name + ': ' + tag.say + (isLatest ? ', la más nueva' : '');
      return '<li>' + (e.hws.length
        ? '<button type="button" class="rp-exp ' + tag.cls + (isLatest ? ' is-latest' : '') + '" data-open-exp="' + e.n + '" aria-label="' + esc(label) + '">' + inner + '</button>'
        : '<div class="rp-exp is-soon" role="group" aria-label="' + esc(label) + '">' + inner + '</div>') + '</li>';
    }).join('');
    const views = exps.filter((e) => e.hws.length).map((e) =>
      '<section class="rp-exp-view" data-exp-view="' + e.n + '" aria-labelledby="rp-exp-t-' + e.n + '"' + (e.n === open ? '' : ' hidden') + '>' +
        '<button type="button" class="dw-back rp-exp-back" data-close-exp>Volver a las experiencias</button>' +
        '<div class="rp-exp-head"><img class="rp-exp-hpic" src="' + esc(e.pic) + '" alt="" width="200" height="200" loading="lazy" decoding="async">' +
          '<div><span class="rp-exp-k">Experiencia ' + e.n + '</span><h3 class="rp-exp-t" id="rp-exp-t-' + e.n + '" tabindex="-1">' + esc(e.name) + '</h3></div></div>' +
        '<ul class="rp-hw-list">' + e.hws.map((h) => hwCardHtml(m, h, stateOf(h))).join('') + '</ul>' +
      '</section>').join('');
    // Aileen says what to do on each view (folders: tap yours; a folder: listen, record, send, «¡Ya la mandé!»)
    const sayHw = mine || preview ? '«¡Dale! Escuchá el audio, grabá tu video y mandáselo a tu profe por WhatsApp. Después tocá <b>¡Ya la mandé!</b>»'
      : '«Estas son las tareas de ' + esc(m.name) + '. ¡Escuchá el audio cuando quieras!»';
    const sayFolders = mine || preview ? '«¡Dale! Tocá tu experiencia y hacé sus tareas.»' : '«Tocá una experiencia para escuchar sus tareas.»';
    return '<aside class="rp-tareas' + (mine ? '' : ' is-other') + (preview ? ' is-preview' : '') + (open ? ' is-open' : '') + '" id="tareas" aria-labelledby="rp-tareas-t" tabindex="-1">' +
      '<div class="rp-tareas-head"><h2 class="rp-tareas-t" id="rp-tareas-t">' + (mine ? 'Tus tareas' : 'Tareas de ' + esc(m.name)) + '</h2>' +
        (mine ? '<span class="rp-badge" data-tosend' + (toSend ? '' : ' hidden') + '>' + toSend + ' por mandar</span>' : '') + '</div>' +
      (preview ? '<p class="rp-preview-note">' + I.eye + '<span><b>Vista de alumno:</b> así lo ven tus alumnos. Aquí «¡Ya la mandé!» no marca nada.</span></p>' : '') +
      '<div class="rp-aileen"><img src="/assets/cast/aileen-talk.webp" alt="Aileen" width="312" height="480" loading="lazy" decoding="async">' +
        '<p class="rp-aileen-say"><span data-say-folders' + (open ? ' hidden' : '') + '>' + sayFolders + '</span><span data-say-hw' + (open ? '' : ' hidden') + '>' + sayHw + '</span></p></div>' +
      '<ul class="rp-exps" aria-label="Las experiencias de ' + esc(m.name) + '"' + (open ? ' hidden' : '') + '>' + folders + '</ul>' +
      views +
      (showLogin && mine ? '<p class="rp-hw-login">Tus marcas quedan en este teléfono. <a href="/homework.html?next=' + encodeURIComponent('/audios/' + m.slug) + '">Entra con tu código</a> para guardarlas en tu cuenta.</p>' : '') +
      '</aside>';
  }

  // one homework's three audios, in a row, with the shared <audio> (one sound at a time)
  let hwNow = null;   // { id, k, tracks, li }
  const audioEl = () => document.getElementById('au-player');
  function hwUi(playing) {
    if (!hwNow || !hwNow.li) return;
    const b = hwNow.li.querySelector('[data-play]');
    const now = hwNow.li.querySelector('[data-now]');
    if (b) { b.setAttribute('aria-pressed', String(!!playing)); b.innerHTML = playing ? I.pause + '<span>Pausa</span>' : I.play + '<span>Seguir</span>'; }
    if (now) now.hidden = false;
    const t = hwNow.tracks[hwNow.k];
    const tt = hwNow.li.querySelector('[data-now-t]');
    if (tt && t) tt.textContent = 'Audio ' + (hwNow.k + 1) + ' de ' + hwNow.tracks.length + ' · ' + (KIND_T[t.kind] || t.code || '');
  }
  function hwReset(li) {
    if (!li) return;
    const b = li.querySelector('[data-play]');
    if (b) { b.setAttribute('aria-pressed', 'false'); b.innerHTML = li.classList.contains('is-new') ? I.play + '<span>Escuchar</span>' : I.again + '<span>Otra vez</span>'; }
    const now = li.querySelector('[data-now]');
    if (now) now.hidden = true;
    const f = li.querySelector('[data-now-f]');
    if (f) f.style.width = '0';
  }
  const onHwPlaying = () => { if (hwNow) { hwUi(true); if (hwNow.onHeard) hwNow.onHeard(hwNow.id); } };
  const onHwPause = () => { if (hwNow && !hwNow.switching) hwUi(false); };
  const onHwTime = () => {
    const p = audioEl();
    if (!hwNow || !p || !hwNow.li) return;
    const t = hwNow.tracks[hwNow.k];
    const f = hwNow.li.querySelector('[data-now-f]');
    if (f && t && t.dur) f.style.width = Math.min(100, (p.currentTime / t.dur) * 100) + '%';
  };
  const onHwEnded = () => {
    if (!hwNow) return;
    if (hwNow.k + 1 < hwNow.tracks.length) { hwNow.k += 1; hwTrack(); return; }
    const li = hwNow.li;
    hwNow = null;
    hwReset(li);
  };
  function hwTrack() {
    const p = audioEl();
    if (!p || !hwNow) return;
    hwNow.switching = true;
    p.src = hwNow.tracks[hwNow.k].src;
    p.playbackRate = 1;
    p.play().catch(() => {});
    hwNow.switching = false;
    hwUi(true);
  }
  function hwListen(on) {
    const p = audioEl();
    if (!p) return;
    const f = on ? 'addEventListener' : 'removeEventListener';
    p[f]('playing', onHwPlaying);
    p[f]('pause', onHwPause);
    p[f]('timeupdate', onHwTime);
    p[f]('ended', onHwEnded);
  }
  function hwStop() {
    hwListen(false);
    if (hwNow) { const p = audioEl(); try { if (p) p.pause(); } catch (_) {} hwReset(hwNow.li); hwNow = null; }
  }

  // ── the page ──────────────────────────────────────────────────────
  function path(main, ctx, m) {
    leave();
    const mods = ctx.ruta.modules || [];
    const look = looksFor(mods)[m.slug];
    const wonder = wondersFor(mods)[m.slug];
    store.set('draly_ruta_at', m.slug);
    // back: to the worlds, or to «Mis tareas» when the kid came from there (the home-screen app has no back button)
    const qFrom = new URLSearchParams(location.search).get('from');
    if (qFrom === 'homework') store.set('draly_ruta_from', 'homework');
    const fromHw = store.get('draly_ruta_from') === 'homework';
    const back = fromHw ? { href: '/homework.html', label: 'Volver a mis tareas' } : { href: '/audios', label: 'Todos los mundos', nav: true };
    const L = ladderOf(ctx, m);
    const hws = ctx.homeworksOf(m.slug);
    // a logged-in kid: a fresh route state teaches the mirror their account's marks once (a phone's own marks join
    // the account); after that the mirror (saves' answers) wins over the route data this page keeps
    tSeed(ctx.ruta, idsOfCtx(ctx));
    const marks = tMarksFor(ctx.ruta, m.tareas);
    const mine = mineOf(ctx, m);
    const toSend = mine ? unsentOf(hws, marks) : 0;
    const cb = L.cb;
    const facts = [worldCount(cb) ? worldCount(cb) + ' mundos' : '', m.base ? m.base.words + ' palabras' : '', m.simCount ? 'el examen al final' : ''].filter(Boolean).join(' · ');
    const hero = '<section class="rp-hero' + (m.name.length > 6 ? ' is-long' : '') + '" style="--hero-rgb:' + rgbOf(look[2]) + '">' +
      '<img class="rp-hero-bg" src="' + esc(wonder.src) + '" alt="" width="1600" height="900" decoding="async" fetchpriority="high" style="object-position:' + wonder.pos + '">' +
      '<span class="rp-hero-shade" aria-hidden="true"></span>' +
      '<div class="rp-hero-text"><div class="rp-hero-top"><div class="rp-hero-head"><h1 class="rp-hero-name" tabindex="-1">' + esc(m.name) + '</h1>' +
        (m.open ? '' : '<span class="rd-seal rp-hero-seal" aria-hidden="true">' + I.lock + '</span>') + '</div>' +
        // (a phone: the red «Tareas: N por mandar» jumps down to «Tus tareas»; a laptop shows them beside the ladder)
        (hws.length && mine ? '<a class="rp-hero-tareas" href="#tareas"' + (toSend ? '' : ' hidden') + '>Tareas: ' + toSend + ' por mandar</a>' : '') + '</div>' +
        '<p class="rp-hero-sub">' + esc(facts || (FAMILY_SUB[m.family] || '')) + '</p>' +
        '<p class="rp-say" id="rp-say">' + esc(L.say) +
          // (a phone: the current step may be further down; one tap brings it up)
          (L.cur > 1 ? '<a class="rp-say-go" href="#paso-' + L.cur + '">Ver el paso ' + L.cur + I.down + '</a>' : '') + '</p></div>' +
      '<img class="rp-hero-dragon" src="/assets/dralingo/point.webp" alt="Dralingo señala el paso que toca" width="332" height="480" decoding="async" fetchpriority="high">' +
      '</section>';
    const ladder = '<h2 class="rp-ladder-t">Tu camino, paso a paso</h2>' +
      '<ol class="rp-ladder" aria-label="La Ruta Dorada de ' + esc(m.name) + '">' + L.steps.map((s) => stepHtml(s, m, L)).join('') + '</ol>';
    main.innerHTML = '<div class="rp" style="' + lookStyle(look) + '">' + bandHtml(back, 'La Ruta Dorada', ctx.ruta.me) +
      '<div class="rp-grid' + (hws.length ? ' has-tareas' : '') + '"><div class="rp-main">' + hero + ladder + '</div>' +
      tareasHtml(ctx, m, hws, marks, mine) + '</div></div>';
    wireTareas(main, ctx, m, hws, mine);
    wireMe(main, ctx);
    wireTell(main, L);
    document.body.classList.add('rp-on');   // (drawn: the page's own band steps aside for this screen's band)
    if (L.pr) celebrateNewWorlds(main, m, L.pr);
    // a logged-in kid: this phone's seals meet their account (a phone's seals from before the login join it, taps not
    // saved yet go up); when the account changed, the route asks the server again and redraws (js/audios.js)
    const AB = window.AudiosBase;
    const b = cb;
    if (ctx.ruta.student && m.open && b && AB && AB.sync) {
      const at = location.pathname;
      AB.sync(b.level, b.words).then((r) => { if (r && (r.sent || r.changed) && location.pathname === at && ctx.refresh) ctx.refresh(true); }, () => {});
    }
    // (phase 4) … and so do the El Entrenamiento scores this phone made before the login (with their proofs)
    const E = window.Entrenamiento;
    if (ctx.ruta.student && ctx.ruta.who && m.open && m.train && E) {
      const at = location.pathname;
      E.syncScores(m.slug, ctx.ruta.who).then((r) => { if (r && r.sent && location.pathname === at && ctx.refresh) ctx.refresh(true); });
    }
    // a simulation's link that is not earned yet lands here (server.js: /audios/<level>?dorado=cerrado#paso-3): step 3
    // comes into view and lights up once, so the kid sees how it opens
    if (location.hash === '#paso-3' || location.hash === '#tareas') {
      const el = main.querySelector(location.hash);
      if (el) {
        try { el.scrollIntoView({ block: 'center', behavior: calmMotion() ? 'auto' : 'smooth' }); } catch (_) { el.scrollIntoView(); }
        if (location.hash === '#paso-3' && /dorado=(cerrado|clase)/.test(location.search) && el.animate && !calmMotion()) {
          try { el.animate([{ boxShadow: '0 0 0 0 rgba(216, 176, 90, .75)' }, { boxShadow: '0 0 0 18px rgba(216, 176, 90, 0)' }], { duration: 1100, delay: 350, iterations: 2, easing: 'cubic-bezier(.23, 1, .32, 1)' }); } catch (_) {}
        }
      }
    }
    // the page's one calm moment: «¡Empieza aquí!» nods once, a moment after the page is still (never on reduced motion)
    const tag = main.querySelector('.rp-tag');
    if (tag && tag.animate && !calmMotion() && !location.hash) {
      try { tag.animate([{ transform: 'translate(-50%, 0)' }, { transform: 'translate(-50%, -5px)', offset: 0.4 }, { transform: 'translate(-50%, 0)' }], { duration: 620, delay: 900, easing: 'cubic-bezier(.23, 1, .32, 1)' }); } catch (_) {}
    }
  }

  // the homework cards: «Escuchar» plays here, «¡Ya la mandé!» marks it sent (account or phone), «Deshacer» undoes it
  function wireTareas(main, ctx, m, hws, mine) {
    const box = main.querySelector('#tareas');
    if (!box) return;
    const byId = new Map(hws.map((h) => [h.id, h]));
    const exps = expsOf(m, hws);
    const paint = () => {
      if (!mine) return;
      const marks = tMarksFor(ctx.ruta, m.tareas);
      box.querySelectorAll('.rp-hw').forEach((li) => {
        if (paintHw(li, hwStateOf(marks, li.getAttribute('data-hw'))) && !(hwNow && hwNow.li === li)) hwReset(li);
      });
      const n = unsentOf(hws, marks);
      const badge = box.querySelector('[data-tosend]');
      if (badge) { badge.hidden = !n; badge.textContent = n + ' por mandar'; }
      const heroTag = main.querySelector('.rp-hero-tareas');
      if (heroTag) { heroTag.hidden = !n; heroTag.textContent = 'Tareas: ' + n + ' por mandar'; }
      // each folder's tag follows its homeworks («1 por mandar» → «✓ Mandadas»)
      exps.forEach((e) => {
        const b = box.querySelector('[data-open-exp="' + e.n + '"]');
        if (!b) return;
        const t = expTag(e, marks, mine, false);
        const tag = b.querySelector('[data-exp-tag]');
        b.classList.remove('is-todo', 'is-done');
        b.classList.add(t.cls);
        if (tag) { tag.className = 'rp-exp-tag ' + t.cls; tag.innerHTML = t.html; }
        b.setAttribute('aria-label', 'Experiencia ' + e.n + ', ' + e.name + ': ' + t.say + (b.classList.contains('is-latest') ? ', la más nueva' : ''));
      });
    };
    // a folder opens in place (its 2-3 homeworks), «← Volver a las experiencias» closes it; the open one is kept for
    // this tab (a trip to a homework's own page and back finds it open)
    const showExp = (n, focusTo) => {
      hwStop();
      setOpenExp(m, n);
      box.classList.toggle('is-open', !!n);
      const grid = box.querySelector('.rp-exps');
      if (grid) grid.hidden = !!n;
      box.querySelectorAll('[data-exp-view]').forEach((v) => { v.hidden = Number(v.getAttribute('data-exp-view')) !== n; });
      const sf = box.querySelector('[data-say-folders]'), sh = box.querySelector('[data-say-hw]');
      if (sf) sf.hidden = !!n;
      if (sh) sh.hidden = !n;
      // (a phone: the opened folder (or the folders again) comes into view when part of it is off the screen; the focus
      // goes where the eyes go, for a screen reader too)
      const shownEl = n ? box.querySelector('[data-exp-view="' + n + '"]') : box.querySelector('.rp-exps');
      const r = (shownEl || box).getBoundingClientRect();
      if (r.top < 60 || r.bottom > window.innerHeight) {
        try { box.scrollIntoView({ block: 'start', behavior: calmMotion() ? 'auto' : 'smooth' }); } catch (_) { box.scrollIntoView(); }
      }
      const f = focusTo && box.querySelector(focusTo);
      if (f) { try { f.focus({ preventScroll: true }); } catch (_) {} }
      const say = document.getElementById('au-say');
      if (say && n) { const e = exps.find((x) => x.n === n); say.textContent = ''; setTimeout(() => { say.textContent = 'Experiencia ' + n + (e ? ', ' + e.name : '') + ': ' + (e ? e.hws.length : 0) + ' tareas.'; }, 30); }
    };
    tSync.onChange = (again) => { if (again && ctx.refresh) ctx.refresh(true); else paint(); };
    // the phone hero's «Tareas: N por mandar» scrolls down here (no address change: the page's router would redraw)
    const heroTag = main.querySelector('.rp-hero-tareas');
    const sayGo = main.querySelector('.rp-say-go');
    if (sayGo) sayGo.addEventListener('click', (e) => {
      const el = main.querySelector(sayGo.getAttribute('href'));
      if (!el) return;
      e.preventDefault();
      try { el.scrollIntoView({ block: 'center', behavior: calmMotion() ? 'auto' : 'smooth' }); } catch (_) { el.scrollIntoView(); }
    });
    if (heroTag) heroTag.addEventListener('click', (e) => {
      e.preventDefault();
      try { box.scrollIntoView({ block: 'start', behavior: calmMotion() ? 'auto' : 'smooth' }); } catch (_) { box.scrollIntoView(); }
      try { box.focus({ preventScroll: true }); } catch (_) {}
    });
    box.querySelectorAll('.rp-hw-pic[data-alt]').forEach((img) => img.addEventListener('error', () => { const a = img.getAttribute('data-alt'); img.removeAttribute('data-alt'); if (a) img.src = a; }, { once: true }));
    box.addEventListener('click', (e) => {
      const opener = e.target.closest('[data-open-exp]');
      if (opener) { const n = Number(opener.getAttribute('data-open-exp')) || 0; showExp(n, '#rp-exp-t-' + n); return; }
      if (e.target.closest('[data-close-exp]')) {
        const was = openExpOf(m);
        showExp(0, '[data-open-exp="' + was + '"]');
        return;
      }
      const li = e.target.closest('.rp-hw');
      if (!li) return;
      const id = li.getAttribute('data-hw');
      const h = byId.get(id);
      if (!h) return;
      if (e.target.closest('[data-play]')) {
        const p = audioEl();
        if (!p) return;
        if (hwNow && hwNow.id === id) {                    // the same homework: pause / go on (inside the tap: iPhone)
          if (p.paused) p.play().catch(() => {}); else p.pause();
          return;
        }
        hwStop();
        hwListen(true);
        hwNow = { id, k: 0, tracks: (h.tracks || []).filter((t) => t && t.src), li, onHeard: (x) => { if (mine) { tMark(x, 'h', ctx.ruta); paint(); } } };
        if (!hwNow.tracks.length) { hwNow = null; return; }
        hwTrack();
        return;
      }
      // (a teacher's preview has no data-send / data-unsend: its buttons do nothing and write nothing)
      if (e.target.closest('[data-send]') && mine) {
        markTap(id, 's', ctx, m.slug, (r) => accountArrived(r, () => { if (ctx.refresh) ctx.refresh(true); }));
        paint();
        sentMoment(li, h.title);
        return;
      }
      if (e.target.closest('[data-unsend]') && mine) {
        markTap(id, 'u', ctx, m.slug);
        const undo = li.querySelector('[data-undo]');
        if (undo) undo.hidden = true;
        paint();
      }
    });
  }

  // ── the route's one moment (phase 3): a world that became ready for El Entrenamiento since this phone last saw the
  // route pops on card 2 (its badge says «¡Nuevo mundo!» and its coin pops, once), when it comes into view («so kids see
  // what their seals earn»). The first look at a route only remembers what is ready (no fireworks for the past).
  // localStorage draly_ruta_ready: { slug: [n…] }.
  let readyIo = null;
  function celebrateNewWorlds(main, m, pr) {
    if (readyIo) { readyIo.disconnect(); readyIo = null; }
    const now = pr.worlds.filter((w) => w.train).map((w) => w.n);
    let seen = null;
    try { seen = JSON.parse(store.getL('draly_ruta_ready') || 'null'); } catch (_) { seen = null; }
    if (!seen || typeof seen !== 'object' || Array.isArray(seen)) seen = {};
    const before = Array.isArray(seen[m.slug]) ? seen[m.slug] : null;
    // remembered once the kid has seen it (a redraw before the card came into view must not swallow the moment)
    const remember = () => { seen[m.slug] = now; store.setL('draly_ruta_ready', JSON.stringify(seen)); };
    const fresh = before ? now.filter((n) => before.indexOf(n) < 0) : [];
    const card = main.querySelector('#paso-2');
    const coins = fresh.map((n) => main.querySelector('#paso-2 .rp-coins li[data-w="' + n + '"]')).filter(Boolean);
    if (!fresh.length || !card || !card.animate) { remember(); return; }
    let badge = card.querySelector('.rp-badge');
    if (!badge) {
      const status = card.querySelector('.rp-status');
      if (status) { status.insertAdjacentHTML('beforeend', '<span class="rp-badge"></span>'); badge = status.querySelector('.rp-badge'); }
    }
    if (badge) badge.textContent = fresh.length === 1 ? '¡Nuevo mundo!' : '¡' + fresh.length + ' mundos nuevos!';
    const pop = () => {
      remember();
      try {
        if (calmMotion()) { if (badge) badge.animate([{ opacity: 0.25 }, { opacity: 1 }], { duration: 320, easing: 'ease-out', fill: 'backwards' }); return; }
        if (badge) badge.animate([{ transform: 'scale(.55) rotate(-10deg)', opacity: 0.2 }, { transform: 'scale(1.16) rotate(3deg)', opacity: 1, offset: 0.62 }, { transform: 'none', opacity: 1 }],
          { duration: 560, easing: 'cubic-bezier(.23, 1, .32, 1)', fill: 'backwards' });
        coins.forEach((c, i) => c.animate([{ transform: 'scale(.55)', opacity: 0.2 }, { transform: 'scale(1.2)', opacity: 1, offset: 0.62 }, { transform: 'none', opacity: 1 }],
          { duration: 520, delay: 120 + i * 90, easing: 'cubic-bezier(.23, 1, .32, 1)', fill: 'backwards' }));
      } catch (_) { /* an old phone: the badge simply says it */ }
    };
    if (!('IntersectionObserver' in window)) { pop(); return; }
    readyIo = new IntersectionObserver((entries) => {
      if (!entries.some((en) => en.isIntersecting)) return;
      readyIo.disconnect();
      readyIo = null;
      pop();
    }, { threshold: 0.6 });
    readyIo.observe(card);
  }

  // a homework audio played on its own page (/audios/<id>, js/audios.js) counts as «Escuchada» too
  // (idsOf: slug → that level's homework ids, so the route data the page loaded with is learned BEFORE this tap's save:
  // a later trip to the level's page never shows older marks than the save's answer)
  const markHeard = (id, ruta, idsOf) => {
    if (ruta && ruta.teacher) return;                    // (a teacher's listening marks nothing)
    tSeed(ruta, idsOf);
    tMark(id, 'h', ruta);
    if (hwBar && hwBar.id === id) hwBar.paint();
  };

  // ── 2026-10-18: the homework's own page (/audios/<homework id>) has the kid's marks too: «Escuchada ✓» (the audio
  // played), «¡Ya la mandé!», «✓ Mandada», «Deshacer». The SAME code as «Tus tareas» above (the mirror, the account, the
  // phone's own marks, the rules): js/audios.js gives the places for the bar (under the title, and after «¡Ahora graba tu
  // video!») and the page's context (ruta = the route state, reloadState = ask the server again, homeworksOf).
  //   a kid of that level, or a phone nobody is logged in on → the marks (account or phone, like the module page)
  //   a teacher → the kid's buttons as a calm preview («Así lo ven tus alumnos»), nothing written
  //   a logged-in kid on another level's homework → no bar (it only plays, like the module page)
  let hwBar = null;   // { id, paint } of the bar on screen
  function hwMarks(mounts, ctx, h) {
    let R = ctx.ruta;
    const modOf = () => (R && Array.isArray(R.modules) ? R.modules.find((x) => x.slug === h.level || x.id === h.level) : null);
    const preview = !!(R && R.teacher);
    const mod0 = modOf();
    const mine = !preview && (!R || !R.student || !!(mod0 && mod0.slug === R.home));
    if (!mine && !preview) return null;
    const idsOf = idsOfCtx(ctx);
    if (mine && R) tSeed(R, idsOf);
    const stateNow = () => (preview ? 'preview' : hwStateOf(tMarksFor(R, (modOf() || {}).tareas), h.id));
    const login = mine && !(R && R.student);
    const st = stateNow();
    mounts.forEach((el, k) => {
      el.innerHTML = '<div class="rp-hwbar is-' + st + '" data-hwbar>' +
        '<div class="rp-hwbar-head"><span class="rp-hw-state" data-state>' + stateTag(st === 'preview' ? 'new' : st) + '</span>' +
        '<p class="rp-hwbar-t">' + (preview ? '<b>Vista de alumno.</b> Tocan «¡Ya la mandé!» cuando mandan su video.'
          : k === 0 ? 'Cuando mandes tu video a tu profe por WhatsApp, toca <b>¡Ya la mandé!</b>' : '¿Ya se lo mandaste a tu profe?') + '</p></div>' +
        actsHtml(st, true) +
        (login && k === mounts.length - 1 ? '<p class="rp-hw-login">Tus marcas quedan en este teléfono. <a href="/homework.html?next=' + encodeURIComponent('/audios/' + h.id) + '">Entra con tu código para guardarlas en tu cuenta</a></p>' : '') +
        '</div>';
    });
    const bars = mounts.map((el) => el.querySelector('[data-hwbar]')).filter(Boolean);
    const paint = () => { if (!preview) { const s = stateNow(); bars.forEach((b) => paintHw(b, s)); } };
    hwBar = { id: h.id, paint };
    tSync.onChange = (again) => {
      if (!again) { paint(); return; }
      if (ctx.reloadState) ctx.reloadState().then((r) => { if (r) { R = r; tSeed(R, idsOf); } paint(); });
    };
    // a new automatic account (the first «¡Ya la mandé!» on a phone with none): the page learns it, the phone's marks join it
    const arrived = (r) => accountArrived(r, () => {
      if (!ctx.reloadState) return;
      ctx.reloadState().then((r2) => {
        if (!r2) return;
        R = r2;
        tSeed(R, idsOf);
        paint();
        bars.forEach((b) => { const l = b.querySelector('.rp-hw-login'); if (l && R.student) l.remove(); });
      });
    });
    bars.forEach((b) => b.addEventListener('click', (e) => {
      if (preview) return;
      if (e.target.closest('[data-send]')) {
        markTap(h.id, 's', { ruta: R }, h.level, arrived);
        paint();
        sentMoment(b, h.title);
        return;
      }
      if (e.target.closest('[data-unsend]')) {
        markTap(h.id, 'u', { ruta: R }, h.level);
        bars.forEach((x) => { const u = x.querySelector('[data-undo]'); if (u) u.hidden = true; });
        paint();
      }
    }));
    return hwBar;
  }
  window.Ruta = { picker, path, leave, markHeard, hwMarks, get live() { return live; } };
})();
