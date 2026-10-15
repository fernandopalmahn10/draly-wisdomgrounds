// Playtest handler for 6-7 Swing v2 «La Balanza de Oro». The harness answers every question with a random choice; this
// handler replaces that with kids who play like a class:
//   · thinkers (most bots): read the sum (q.ss: a, op, b) and tap the right button ~88 % of the time, after 0.9-2.4 s
//   · Bot03, the masher: taps a random button 120-300 ms after each sum arrives (faster than anybody reads: the server's
//     «¡Muy rápido!» rule must count those as wrong)
//   · Bot04, the guesser: taps a random button 0.4-0.7 s after each sum (just past the «too fast» line: a pure 50 % guess)
//   · Bot05, the sleeper: never taps; its phone sends «time up» after the 12 s clock like a real phone
// Checks on what comes back: every answer gets exactly one verdict; a right one earns ≥ 1 coin and exactly the streak's
// multiplier (×1, ×2 from 3, ×3 from 6, ×4 from 10; ×2 in the last 30 s; + the golden extra), a wrong one 0 coins and a
// wait; my running total = the sum of my coins; every sum's answer is 6 or 7 with numbers 1-10 only; the end payload
// (teamScores = totals, the winner, my card = my total, stars only for kids with something). Stats in report.sixseven,
// including coins per kind of kid (the random tappers must end below the thinkers) and events per kid.
'use strict';

const PINYIN = ['ling', 'yi', 'er', 'san', 'si', 'wu', 'liu', 'qi', 'ba', 'jiu', 'shi'];
const mult = (s) => (s >= 10 ? 4 : s >= 6 ? 3 : s >= 3 ? 2 : 1);

module.exports = (bot, ctx) => {
  const st = ctx.state;
  const R = ctx.report;
  R.endedGrace = 5000;                         // «¡FINAL!» (ss:final) ends the watch; game-end comes 2.4 s later
  const E = R.sixseven || (R.sixseven = {
    sums: 0, answers: 0, results: 0, right: 0, wrong: 0, tooFast: 0, timeUps: 0, golds: 0, calm: 0, coins: 0, zh: 0, num: 0,
    leads: 0, landmarks: 0, frenzy: 0, finals: 0, ends: 0, meterPerKid: {}, eventsPerKid: {}, kinds: {}, winner: null, totals: null, stars: null,
  });
  const kind = ctx.name === 'Bot03' ? 'masher' : ctx.name === 'Bot04' ? 'guesser' : ctx.name === 'Bot05' ? 'sleeper' : 'thinker';
  const lead = ctx.name === 'Bot01';
  const K = E.kinds[ctx.name] = { kind, answers: 0, right: 0, coins: 0, best: 0 };
  let mySum = 0, frenzy = false, finalSeen = false, timer = null, open = null, streak = 0;
  E.meterPerKid[ctx.name] = 0;
  E.eventsPerKid[ctx.name] = 0;
  const fail = (what, d) => R.errors.push({ who: ctx.name, ev: 'rule:' + what, d });
  bot.onAny(() => { E.eventsPerKid[ctx.name]++; });
  bot.on('ss:meter', () => { E.meterPerKid[ctx.name]++; });
  bot.on('ss:lead', () => { if (lead) E.leads++; });
  bot.on('ss:landmark', () => { if (lead) E.landmarks++; });
  bot.on('ss:frenzy', () => { frenzy = true; if (lead) E.frenzy++; });
  bot.on('ss:final', () => { finalSeen = true; if (lead) E.finals++; clearTimeout(timer); });
  bot.on('ss:init', () => { frenzy = false; });

  // the harness's random answers are replaced by this kid's own way of playing
  bot.off('question');
  bot.on('question', (q) => {
    st.questions++;
    st.lastQAt = Date.now();
    st.waiting = false;
    E.sums++;
    const s = q && q.ss;
    if (!s || !(q.answers && q.answers[0] === '6' && q.answers[1] === '7')) { fail('a sum must come with the buttons 6 and 7', q); return; }
    const val = s.op === '+' ? s.a + s.b : s.a - s.b;
    if (!(val === 6 || val === 7)) fail('the answer must be 6 or 7', s);
    if (!(s.a >= 1 && s.a <= 10 && s.b >= 1 && s.b <= 10)) fail('only the numbers 1-10', s);
    if (s.zh) {
      E.zh++;
      if (!s.words || s.words[0] !== PINYIN[s.a] || s.words[1] !== PINYIN[s.b]) fail('pinyin words without tone marks', s);
      if (!/^[a-z]+ [+−] [a-z]+ = \?$/.test(q.text)) fail('an «En Chino» sum is written in pinyin', q.text);
    } else {
      E.num++;
      if (!/^\d+ [+−] \d+ = \?$/.test(q.text)) fail('a «Números» sum is written in digits', q.text);
    }
    open = { qid: q.qid, ans: val };
    clearTimeout(timer);
    if (kind === 'sleeper') {
      timer = setTimeout(() => { send(q.qid, -1); }, 12000);      // the phone's clock runs out: time up
      return;
    }
    let delay, pick;
    if (kind === 'masher') { delay = 120 + Math.random() * 180; pick = Math.random() < 0.5 ? 0 : 1; }
    else if (kind === 'guesser') { delay = 400 + Math.random() * 300; pick = Math.random() < 0.5 ? 0 : 1; }
    else { delay = 900 + Math.random() * 1500; const right = Math.random() < 0.88; pick = (val === 6) === right ? 0 : 1; }
    timer = setTimeout(() => send(q.qid, pick), delay);
  });
  function send(qid, choiceIdx) {
    st.answers++;
    st.waiting = true;
    st.lastAnsAt = Date.now();
    E.answers++;
    K.answers++;
    bot.emit('player:answer', { pin: ctx.pin, qid, choiceIdx }, () => {});
  }
  bot.on('answer-stale', (d) => { if (!finalSeen && !(d && d.reason === 'paused')) fail('an answer was refused', d); });
  bot.on('answer-result', (r) => {
    const x = r && r.sixseven;
    if (!x) { fail('answer-result without its 6-7 verdict', r); return; }
    E.results++;
    if (open && x.qid !== open.qid) fail('a verdict for another sum', { got: x.qid, open: open.qid });
    if (open && x.ans !== open.ans) fail('the server and the sum disagree', { server: x.ans, sum: open.ans });
    if (x.ans !== 6 && x.ans !== 7) fail('the answer must be 6 or 7', x);
    if (x.word !== PINYIN[x.ans]) fail('the answer word', x);
    open = null;
    if (x.right) {
      streak++;
      E.right++;
      K.right++;
      K.best = Math.max(K.best, streak);
      if (x.streak !== streak) fail('the streak', { server: x.streak, mine: streak });
      const want = mult(streak) * (x.frenzy ? 2 : 1) + (x.goldExtra || 0);
      if (x.coins !== want || x.coins < 1) fail('a right answer earns the multiplier', { coins: x.coins, want, x });
      if (x.gold) E.golds++;
    } else {
      streak = 0;
      E.wrong++;
      if (x.tooFast) E.tooFast++;
      if (x.timeUp) E.timeUps++;
      if (x.calm) E.calm++;
      if (x.coins !== 0) fail('a wrong answer earns nothing', x);
      if (!(x.wait >= 1500)) fail('a wrong answer costs a wait', x);
    }
    mySum += x.coins;
    K.coins += x.coins;
    E.coins += x.coins;
    if (x.total !== mySum) fail('my running total does not add up', { total: x.total, mySum });
    if (kind === 'masher' && x.right && x.tooFast) fail('a too-fast tap was counted right', x);
  });

  bot.on('game-end', (d) => {
    clearTimeout(timer);
    const mo = d && d.sixseven;
    if (!mo || !d.me || !mo.totals) { fail('end payload', d); return; }
    if (d.teamScores.red !== mo.totals.r || d.teamScores.gold !== mo.totals.g) fail('teamScores = totals', d.teamScores);
    const w = mo.totals.r > mo.totals.g ? 'red' : mo.totals.g > mo.totals.r ? 'gold' : 'tie';
    if (mo.winner !== w || d.winner !== w) fail('winner', { w, got: mo.winner });
    if (d.me.coins !== mySum) fail('my card = the sum of my coins', { card: d.me.coins, mine: mySum });
    if (d.me.won !== (w === d.me.team)) fail('won flag', d.me);
    (mo.stars || []).forEach((s) => { if (!s.who || !s.who.length) fail('a star without a winner', s); });
    if ((d.me.stars || []).some((id) => !(mo.stars || []).some((s) => s.id === id))) fail('my star is not in the list', d.me);
    if (d.me.coins === 0 && (d.me.stars || []).some((id) => id !== 'aim' && id !== 'zh')) fail('a kid with 0 got a star', d.me);
    K.card = { coins: d.me.coins, right: d.me.right, answered: d.me.answered, aim: d.me.aim, stars: d.me.stars };
    if (lead) { E.ends++; E.winner = mo.winner; E.totals = mo.totals; E.stars = (mo.stars || []).map((s) => `${s.id}:${s.n}`); }
  });
};
