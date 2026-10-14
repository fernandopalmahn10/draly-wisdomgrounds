// Classroom playtest: one fake teacher + N fake kids play a full round against a running server.
//
//   node scripts/playtest-bots.js --game pinata --bots 20 --seconds 60
//   options: --url http://localhost:3000  --set <setId|first>  --stall 8  --handlers scripts/playtest/<game>.js
//
// Kids answer every question with a random choice after a human-like delay (0.6–2.5 s).
// --stall counts from a kid's answer to the next question (default 8 s; reward windows are ~5 s).
// Games with an extra step after an answer (roll a die, pick a tile…) plug in a handler module:
//   module.exports = (bot, ctx) => { bot.on('some-event', (d) => bot.emit('player:something', {...})); };
// The report flags: kids who never joined, kids stuck without a question for --stall seconds while the game is
// active ("frozen"), stale/errored answers, host errors, whether an end-of-game event arrived, and every event seen.
const path = require('path');
const { io } = require('socket.io-client');

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : def;
};
const URL = opt('url', 'http://localhost:3000');
const GAME = opt('game', 'mochi-mash');
const BOTS = +opt('bots', 10);
const SECONDS = +opt('seconds', 60);
const STALL = +opt('stall', 8) * 1000;
const SET = opt('set', 'first');
// a game's own handler module (scripts/playtest/<game>.js) loads by itself when --handlers is not given
const OWN_HANDLERS = path.join(__dirname, 'playtest', GAME + '.js');
const HANDLERS = opt('handlers', null) || (require('fs').existsSync(OWN_HANDLERS) ? OWN_HANDLERS : null);
// Games whose content is generated server-side (no question set to load).
const NO_SET = ['sixseven', 'warmup', 'hsksim'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const emitAck = (s, ev, payload, ms = 5000) => new Promise((res) => {
  const t = setTimeout(() => res({ timeout: true }), ms);
  s.emit(ev, payload, (r) => { clearTimeout(t); res(r || {}); });
});

const report = {
  game: GAME, url: URL, bots: BOTS, seconds: SECONDS,
  joined: 0, joinErrors: [], hostEvents: {}, kidEvents: {}, perBot: [],
  stalls: [], staleAnswers: 0, errors: [], ended: null,
};
const count = (bag, ev) => { bag[ev] = (bag[ev] || 0) + 1; };

(async () => {
  let handler = null;
  if (HANDLERS) handler = require(path.resolve(HANDLERS));

  // --- teacher ---
  const host = io(URL, { transports: ['websocket'], forceNew: true });
  host.onAny((ev, d) => {
    count(report.hostEvents, ev);
    if (!report.ended && /(game-?over|game-?end|ended|winner|final)/i.test(ev)) report.ended = { event: ev, at: Date.now() };
    if (/error/i.test(ev)) report.errors.push({ who: 'host', ev, d });
  });
  host.on('connect_error', (e) => report.errors.push({ who: 'host', ev: 'connect_error', d: String(e && e.message) }));
  const created = await emitAck(host, 'host:create', { gameType: GAME });
  const pin = created && created.pin;
  if (!pin) { console.log('FAIL: host:create returned no PIN', created); process.exit(1); }
  report.pin = pin;

  if (!NO_SET.includes(GAME)) {
    let setId = SET;
    if (setId === 'first') {
      const sets = await fetch(URL + '/api/sets').then((r) => r.json()).catch(() => ({}));
      setId = sets && sets.sets && sets.sets[0] && sets.sets[0].id;
    }
    const loaded = await emitAck(host, 'host:load-set', { pin, setId });
    report.set = { setId, ok: !!(loaded && loaded.ok), title: loaded && loaded.title, count: loaded && loaded.count };
    if (!loaded || !loaded.ok) report.errors.push({ who: 'host', ev: 'load-set', d: loaded });
  }
  host.emit('host:set-duration', { pin, duration: SECONDS });

  // --- kids ---
  const bots = [];
  for (let i = 0; i < BOTS; i++) {
    const name = 'Bot' + String(i + 1).padStart(2, '0');
    const s = io(URL, { transports: ['websocket'], forceNew: true });
    const st = { name, questions: 0, answers: 0, correct: 0, wrong: 0, lastQAt: 0, lastAnsAt: 0, lastEvent: null, waiting: false };
    s.onAny((ev, d) => {
      count(report.kidEvents, ev);
      st.lastEvent = ev;
      if (ev === 'answer-stale') report.staleAnswers++;
      if (/error/i.test(ev)) report.errors.push({ who: name, ev, d });
    });
    s.on('question', (q) => {
      st.questions++;
      st.lastQAt = Date.now();
      st.waiting = false;
      const n = (q && q.answers && q.answers.length) || 2;
      setTimeout(() => {
        st.answers++;
        st.waiting = true;
        st.lastAnsAt = Date.now();
        s.emit('player:answer', { pin, qid: q.qid, choiceIdx: Math.floor(Math.random() * n) }, () => {});
      }, 600 + Math.random() * 1900);
    });
    s.on('answer-result', (r) => { if (r && r.correct) st.correct++; else st.wrong++; });
    s.on('connect_error', (e) => report.errors.push({ who: name, ev: 'connect_error', d: String(e && e.message) }));
    if (handler) handler(s, { pin, name, state: st, report });
    const j = await emitAck(s, 'player:join', { pin, name });
    if (j && j.ok !== false && !j.timeout) report.joined++;
    else report.joinErrors.push({ name, d: j });
    bots.push({ s, st });
    await sleep(40);
  }

  await sleep(800);
  host.emit('host:start', { pin });
  const startedAt = Date.now();

  // Watch for frozen kids while the round runs.
  const flagged = new Set();
  const watch = setInterval(() => {
    if (report.ended) return;
    const now = Date.now();
    for (const { st } of bots) {
      // Frozen = answered (or never got a first question) and nothing new arrived within --stall seconds.
      // Timed from the answer, so a game's own reward window (mash/smash ~5 s) is not counted as a freeze.
      // On-demand games (handler sets state.onDemand, e.g. Dragones Pintores) play first and ask later: there a freeze
      // is "asked for a question (state.askedAt) and none came".
      const asked = st.askedAt && st.askedAt > st.lastQAt ? now - st.askedAt : 0;
      let since = Math.max(asked, st.waiting ? now - st.lastAnsAt : (st.questions || st.onDemand ? 0 : now - startedAt));
      // A handler can declare a legitimate wait (e.g. Reinos de Colores' 8 s plant window + auto-plant): the clock then
      // starts when that window ends.
      if (st.graceUntil && st.graceUntil > st.lastQAt) since = Math.min(since, Math.max(0, now - st.graceUntil));
      if (since > STALL && !flagged.has(st.name)) {
        flagged.add(st.name);
        report.stalls.push({ name: st.name, secondsWithoutQuestion: Math.round(since / 1000), lastEvent: st.lastEvent, answers: st.answers });
      }
    }
  }, 1000);

  while (Date.now() - startedAt < (SECONDS + 15) * 1000 && !report.ended) await sleep(500);
  if (report.ended) await sleep(report.endedGrace || 2000); // let final events arrive (a handler can ask for longer)
  clearInterval(watch);

  report.perBot = bots.map(({ st }) => ({ name: st.name, questions: st.questions, answers: st.answers, correct: st.correct, wrong: st.wrong }));
  host.emit('host:end-now', { pin });
  bots.forEach(({ s }) => s.close());
  host.close();

  const totalQ = report.perBot.reduce((a, b) => a + b.questions, 0);
  const verdict = report.joined === BOTS && report.stalls.length === 0 && report.errors.length === 0 && totalQ > 0 ? 'PASS' : 'CHECK';
  console.log(`\n=== Playtest ${GAME} · PIN ${pin} · ${verdict} ===`);
  console.log(`kids joined ${report.joined}/${BOTS} · questions served ${totalQ} · stale answers ${report.staleAnswers} · frozen kids ${report.stalls.length} · errors ${report.errors.length}`);
  console.log(`end-of-game event: ${report.ended ? report.ended.event : 'NONE seen (check the host screen)'}`);
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
})().catch((e) => { console.error('playtest crashed:', e); process.exit(1); });
