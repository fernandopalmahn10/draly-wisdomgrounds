// papas-plan.js — «Mi Dralingo» part 2 · Papás (his approved design, 2026-10-18): what the parents' view says, worked out
// from the kid's La Ruta Dorada numbers. ONE file for the server (server.js `_papasRuta` → the insights payload,
// scripts/test-papas.js) and the page (js/papas.js, after it adds this phone's marks not saved yet), so both always
// say the same thing. Pure: no DOM, no storage, no network.
//
//   raw = { pct,                                       the practice goal of El Entrenamiento (the Dorado %, 70 by default)
//           words, seals: [n…],                        La Base: its word count and the kid's «¡Me la sé!» seals
//           worlds: [{ n, name, pic, first, count, best, open, train }],
//                                                      one per experience (La Base world N = experience N = practice
//                                                      world N): its words first…first+count-1, the best % of its
//                                                      practice (null = never played), open = its practice is open
//           hws: [{ id, exp, round, title, sent }],    the level's homework audios, newest first (sent = «¡Ya la mandé!»)
//           sim: { n, percent, passed, at } | null }   the latest simulation taken (in class, with a PIN)
//
//   plan(raw) → { goal, sealed, words, of, complete, current, trainDone,
//                 exps: [{ n, name, pic, sealed, count, best, open, train, hw: { of, sent }, done, state }],
//                 tareas: { of, sent, week: { exp, of, left } | null },
//                 sim, focus, hws: [{ id, exp, sent }] }
//   today(plan) → the KID's one next step (the home's «Hoy», the module page's bubble): the ladder of the current
//                 experience, the homework due as a reminder (see today() below). Papás reads `focus` (the parents'
//                 order, homework first): one file, one data source, so the two never contradict each other.
//
// An experience is COMPLETE when every word is marked, its practice is at the goal, and its homework is sent (every
// homework of it, or it has none yet). `current` = the first experience not complete (null: all of them are).
// «Lo más importante esta semana» (focus), in this order (his picks for the design, 2026-10-18):
//   1. tarea     a homework to send: the newest one not sent
//   2. practice  the current experience's practice is open and below the goal
//   3. words     the current experience has words to mark
//   4. teacher   every practice is at the goal (El Entrenamiento done) and no simulation passed yet: tell the teacher
//   5. fine      «¡Va muy bien!»
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DralyPapasPlan = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

  function plan(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const goal = num(r.pct) || 70;
    const worlds = Array.isArray(r.worlds) ? r.worlds : [];
    const hws = Array.isArray(r.hws) ? r.hws.filter((h) => h && typeof h.id === 'string') : [];
    const seals = Array.isArray(r.seals) ? new Set(r.seals.map(Number).filter((n) => Number.isInteger(n) && n > 0)) : null;
    const exps = worlds.map((w) => {
      const n = Number(w.n) || 0;
      const count = Math.max(0, Number(w.count) || 0);
      const first = Number(w.first) || 0;
      let sealed = Math.max(0, Number(w.sealed) || 0);
      if (seals && first > 0) { sealed = 0; for (let k = first; k < first + count; k++) if (seals.has(k)) sealed++; }
      sealed = Math.min(sealed, count);
      const best = num(w.best);
      const mine = hws.filter((h) => Number(h.exp) === n);
      const hw = { of: mine.length, sent: mine.filter((h) => h.sent).length };
      const wordsDone = count > 0 && sealed >= count;
      const practiceDone = best != null && best >= goal;
      return { n, name: String(w.name || ''), pic: w.pic || null, sealed, count, best,
        open: !!w.open || wordsDone, train: w.train || null, hw,
        done: wordsDone && practiceDone && hw.sent >= hw.of, state: 'later' };
    });
    const cur = exps.find((e) => !e.done) || null;
    exps.forEach((e) => { e.state = e.done ? 'done' : (cur && e.n === cur.n ? 'current' : 'later'); });
    const sealed = exps.reduce((s, e) => s + e.sealed, 0);
    const words = Math.max(num(r.words) || 0, exps.reduce((s, e) => s + e.count, 0));
    // this week's homework = the newest experience that has homework (the folder that glows «La más nueva» for the kid)
    const weekExp = hws.length ? Number(hws[0].exp) || null : null;
    const weekHws = weekExp != null ? hws.filter((h) => Number(h.exp) === weekExp) : [];
    const tareas = { of: hws.length, sent: hws.filter((h) => h.sent).length,
      week: weekExp != null ? { exp: weekExp, of: weekHws.length, left: weekHws.filter((h) => !h.sent).length } : null };
    const trainDone = exps.length > 0 && exps.every((e) => e.best != null && e.best >= goal);
    const sim = r.sim && num(r.sim.percent) != null ? { n: num(r.sim.n), percent: Math.round(num(r.sim.percent)), passed: !!r.sim.passed, at: num(r.sim.at) } : null;
    const expName = (n) => { const e = exps.find((x) => x.n === Number(n)); return e ? e.name : ''; };

    let focus;
    const nextHw = hws.find((h) => !h.sent);
    if (nextHw) focus = { kind: 'tarea', id: nextHw.id, exp: Number(nextHw.exp) || null, name: expName(nextHw.exp) || String(nextHw.title || '') };
    else if (cur && cur.open && !(cur.best != null && cur.best >= goal)) focus = { kind: 'practice', exp: cur.n, name: cur.name, best: cur.best, goal, train: cur.train };
    else if (cur && cur.sealed < cur.count) focus = { kind: 'words', exp: cur.n, name: cur.name, left: cur.count - cur.sealed };
    else if (trainDone && !(sim && sim.passed)) focus = { kind: 'teacher' };
    else focus = { kind: 'fine', sim: sim && sim.passed ? sim : null };

    return { goal, sealed, words, of: exps.length, complete: exps.filter((e) => e.done).length, current: cur ? cur.n : null,
      exps, tareas, trainDone, sim, focus, hws: hws.map((h) => ({ id: h.id, exp: Number(h.exp) || null, sent: !!h.sent })) };
  }

  // «Hoy» on the kid's home and the bubble of La Ruta Dorada's module page (js/ruta.js): ONE next step for the kid
  // (review 2026-10-18: «one next-step rule, following the ladder»). The current experience (the first one not done;
  // `current` above) and, inside it, its ladder: 1 Palabras → 2 Práctica → 3 Tu tarea, the first step not done. A
  // homework due elsewhere never jumps the ladder: it rides along as a reminder line (`remind`) and the red «N por
  // mandar» badges. Papás keeps «homework to send» first (`focus`, for the parents): the same numbers, a parent's order.
  //   today(plan) → { kind: 'words' | 'practice' | 'tarea' | 'teacher' | 'fine', exp (the experience it opens, or null),
  //                   step (1 · 2 · 3, or null), dorado (true: it opens El Simulacro Dorado), id (the homework, 'tarea'),
  //                   go (the button: what it does), text, remind: null | { exp, id (the newest due), left, text } }
  function today(p) {
    const P = p && typeof p === 'object' ? p : plan({});
    const exps = Array.isArray(P.exps) ? P.exps : [];
    const goal = Number(P.goal) || 70;
    const cur = P.current != null ? exps.find((x) => x.n === P.current) || null : null;
    const hoy = (n) => '¡Hoy toca la Experiencia ' + n + '!';
    let t;
    if (cur) {
      const wordsDone = cur.count > 0 && cur.sealed >= cur.count;
      const practiceDone = cur.best != null && cur.best >= goal;
      if (!wordsDone && cur.count > 0) {
        const left = cur.count - cur.sealed;
        t = { kind: 'words', exp: cur.n, step: 1, dorado: false, go: 'Marcar mis palabras',
          text: hoy(cur.n) + (cur.sealed === 0 ? ' Empieza por marcar sus palabras.' : left === 1 ? ' Marca sus palabras: te falta 1.' : ' Marca sus palabras: te faltan ' + left + '.') };
      } else if (!practiceDone) {
        t = { kind: 'practice', exp: cur.n, step: 2, dorado: false, go: 'Practicar aquí', text: hoy(cur.n) + ' Practica ' + cur.name + ' hasta llegar al ' + goal + ' %.' };
      } else {
        const hw = (Array.isArray(P.hws) ? P.hws : []).find((h) => Number(h.exp) === cur.n && !h.sent) || null;
        t = { kind: 'tarea', exp: cur.n, step: 3, dorado: false, id: hw ? hw.id : null, go: 'Mandar mi tarea', text: hoy(cur.n) + ' Manda tu tarea de ' + cur.name + '.' };
      }
    } else if (P.trainDone && !(P.sim && P.sim.passed)) {
      t = { kind: 'teacher', exp: null, step: null, dorado: true, go: 'Avisar a mi profe', text: '¡Terminaste El Entrenamiento! Avísale a tu profe: ya puedes hacer El Simulacro Dorado.' };
    } else if (P.sim && P.sim.passed) {
      t = { kind: 'fine', exp: null, step: null, dorado: true, go: 'Ver mi libro dorado', text: '¡Aprobaste El Simulacro Dorado con ' + P.sim.percent + ' %! Repasa tu libro dorado.' };
    } else {
      const n = exps[0] ? exps[0].n : null;
      t = { kind: 'fine', exp: n, step: null, dorado: false, go: 'Ver mi Ruta', text: n ? '¡Vas muy bien! Repasa cuando quieras.' : '¡Vas muy bien! Muy pronto, tu Ruta Dorada.' };
    }
    // the homework that waits outside today's step: one reminder line («Y tu tarea de esta semana: 1 por mandar.»)
    const due = (Array.isArray(P.hws) ? P.hws : []).filter((h) => !h.sent && !(t.kind === 'tarea' && Number(h.exp) === t.exp));
    t.remind = null;
    if (due.length) {
      const week = P.tareas && P.tareas.week ? P.tareas.week.exp : null;
      const allWeek = week != null && due.every((h) => Number(h.exp) === week);
      t.remind = { exp: Number(due[0].exp) || null, id: due[0].id, left: due.length,
        text: allWeek ? 'Y tu tarea de esta semana: ' + due.length + ' por mandar.' : due.length === 1 ? 'Y tienes 1 tarea por mandar.' : 'Y tienes ' + due.length + ' tareas por mandar.' };
    }
    return t;
  }

  return { plan, today };
});
