// Playtest handler for an exam room (hsksim, YCT / New HSK / Old HSK simulations), since the simulations are locked
// (2026-10-15, core/sim-lock.js). Every kid does what yct-sim.js / hsk-sim.js do once the teacher starts: loads the
// room's sim with the room PIN + the room pass its join gave it, opens its recording (a range request, like <audio>) and two pictures through the signed
// /sim-media/ links, sends heartbeats and hands in random answers with the submit ticket. Checks: the payload carries
// no answer key, every file answers 200/206 with a private no-store header, the grade comes back. Stats in report.exam.
//   node scripts/playtest-bots.js --game hsksim --bots 20 --sim yct1-sim1 --url http://localhost:4000
'use strict';

module.exports = (bot, ctx) => {
  const R = ctx.report;
  const E = R.exam || (R.exam = { loaded: 0, files: 0, filesOk: 0, keyLeaks: 0, heartbeats: 0, submitted: 0, graded: 0, ms: [] });
  const fail = (what, d) => R.errors.push({ who: ctx.name, ev: 'exam:' + what, d });
  let started = false;
  bot.on('state', (s) => {
    if (started || !s || !(s.state === 'active' || s.state === 'countdown')) return;
    started = true;
    run().catch((e) => fail('crash', String(e && e.message)));
  });

  async function run() {
    await new Promise((r) => setTimeout(r, Math.random() * 1500));   // a class doesn't tap at the same millisecond
    const t0 = Date.now();
    const simId = ctx.sim;
    // the room pass the join gave this phone (yct-sim.js does the same): the sim loads only with it
    const pass = (ctx.state.join && ctx.state.join.roomPass) || '';
    if (!pass) fail('no-pass', 'player:join gave no room pass');
    const q = '?studentCode=' + encodeURIComponent(ctx.name) + '&pin=' + encodeURIComponent(ctx.pin) + '&pass=' + encodeURIComponent(pass);
    const r = await fetch(ctx.url + '/api/hsk-sim/' + encodeURIComponent(simId) + q);
    const d = await r.json().catch(() => null);
    if (!d || !d.ok || !d.sim) return fail('load', { status: r.status, d });
    E.loaded++;
    E.ms.push(Date.now() - t0);
    const text = JSON.stringify(d.sim);
    // only the worked examples keep their answer (YCT / New HSK: parts[].items; Old HSK: partN.questions)
    const scored = [];
    ['listening', 'reading'].forEach((k) => {
      const sec = d.sim[k] || {};
      (sec.parts || []).forEach((p) => (p.items || []).forEach((it) => { if (!it.example) scored.push(it); }));
      Object.keys(sec).filter((n) => /^part\d$/.test(n)).forEach((n) => ((sec[n] && sec[n].questions) || []).forEach((it) => scored.push(it)));
    });
    if (!scored.length || scored.some((it) => 'answer' in it || 'transcript' in it)) { E.keyLeaks++; fail('answer-key', simId); }
    if (/\/assets\/[^"]*SIMULATIONS/i.test(text)) fail('old-url', 'a payload still names /assets/…SIMULATIONS');
    const links = Array.from(new Set(text.match(/\/sim-media\/[^"]+/g) || []));
    const audio = links.find((u) => /\.(m4a|mp3)$/.test(u));
    const pics = links.filter((u) => /\.(webp|jpg|png)$/.test(u)).sort(() => Math.random() - 0.5).slice(0, 2);
    for (const u of [audio].concat(pics).filter(Boolean)) {
      E.files++;
      const f = await fetch(ctx.url + u, /\.(m4a|mp3)$/.test(u) ? { headers: { Range: 'bytes=0-4095' } } : {});
      const cc = f.headers.get('cache-control') || '';
      await f.arrayBuffer().catch(() => null);
      if ((f.status === 200 || f.status === 206) && /private/.test(cc) && /no-store/.test(cc)) E.filesOk++;
      else fail('file', { u: u.slice(0, 60), status: f.status, cc });
    }
    const hb = await fetch(ctx.url + '/api/hsk-sim/heartbeat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: ctx.pin, simId, studentCode: ctx.name, cursor: 3, total: 35, answered: 3, section: 'listening' }),
    });
    if (hb.ok) E.heartbeats++;
    const answers = {};
    const items = [];
    ['listening', 'reading'].forEach((k) => ((d.sim[k] && d.sim[k].parts) || []).forEach((p) => (p.items || []).forEach((it) => { if (!it.example) items.push([p, it]); })));
    items.forEach(([p, it]) => {
      const opts = (it.options || p.bank || p.gallery || []).map((o) => o.label);
      answers[it.qid] = opts.length ? opts[Math.floor(Math.random() * opts.length)] : (Math.random() < 0.5 ? 'T' : 'F');
    });
    const sub = await fetch(ctx.url + '/api/hsk-sim/' + encodeURIComponent(simId) + '/submit' + q, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentCode: ctx.name, answers, pin: ctx.pin, ticket: d.sim.ticket }),
    });
    const sd = await sub.json().catch(() => null);
    E.submitted++;
    if (sd && sd.ok && sd.result && typeof sd.result.score === 'number') E.graded++;
    else fail('submit', { status: sub.status, sd });
  }
};
