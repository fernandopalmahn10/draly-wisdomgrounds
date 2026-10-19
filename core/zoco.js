// El Zoco de Dralingo: the characters shop (his OK 2026-10-19: "Okay I approve the design of the Souq"). Rules in
// mochi-mash/CLAUDE.md § «El Zoco de Dralingo», the build in docs/specs/zoco.md.
// Kids unlock new characters and skins with coins they EARN: coins come only from real steps, judged here on the server
// (the phone never says how many it has), never bought with money. This file is the whole engine and the catalog; it
// works on a student record (`rec`) and never saves by itself: server.js calls it inside Students.updateZoco (which
// finds the record, an archived kid included, and saves it). How a skin is drawn lives in public/js/saga.js (ZOCO).
//
// rec.zoco = {
//   v: 1, at: <when the purse was opened>,
//   c: coins now (an undone homework can leave it below 0: «Deshacer» always takes its +50 back, so a spend-then-undo
//      never mints coins), e: coins earned in all, sp: coins spent in all, w: the one-time welcome grant,
//   ps: coins paid for La Base's words in all (a merge moves at most that for words new to the real account),
//   own: [skin ids bought, in order], buys: [[id, price, when]],
//   k: { '<key>': coins paid }      one payment per key, kept forever: 'train:<level>:<world>', 'hw:<homework id>',
//                                   'streak:<first day of the run>:<n>' (0 = it was already done before the purse opened)
//   sk: { '<level>': '1-17,20' }    the La Base words that already count (paid, waiting, or done before), per level
//   gm: { '<game id>': [when, coins] } the class games that paid (dropped after 14 days: a game never comes back)
//   q: { seal: <coins waiting>, hw: [[id, coins], …] }  what a day's cap left for the next days (paid first thing then)
//   day: { d: 'YYYY-MM-DD', seal, hw, game, star }       today's counts for the caps (the kid's own calendar)
//   log: [[when, coins, why], …]    the last 40 moves, for the «+N monedas» moments (why: seal · train · hw · undo ·
//                                   game · star · streak · welcome · buy)
// }
'use strict';

const Saga = require('../public/js/saga');
let RP = null;
const rp = () => RP || (RP = require('./ruta-progress'));

// ── what each real step pays (the approved amounts) ──────────────────────────────────────────────────────────────
const PAY = {
  seal: 2,      // a word marked in La Base, the first time only (unmark + mark again pays nothing)
  train: 20,    // a practice of El Entrenamiento that reaches its goal (the Dorado %), once per world
  hw: 50,       // a homework marked «¡Ya la mandé!», once per homework; «Deshacer» takes the 50 back
  game: 10,     // a class PIN game played for real (GAME_MIN answers or more)
  star: 5,      // each bonus star of that game's ceremony
  streak: 30,   // 7 days in a row with a real step (each 7 of the same run: 7, 14, 21…)
};
const GAME_MIN = 3;          // «played for real»: at least this many answers in the game
// daily caps (the kid's own calendar). Seals and homework are one-time steps that a free tap can take in bulk (300
// words in two minutes, every homework of the level at once): what passes the day's cap WAITS and is paid on the next
// days (nothing is lost, it is only paced). Games and stars repeat (a teacher plays «Otra ronda»): past the cap they
// simply pay nothing that day.
const CAP = { seal: 100, hw: 150, game: 6, star: 8 };   // coins of seals · coins of homework · games · stars per day
const WELCOME_MAX = 150;     // the one-time welcome grant for what a kid already did before El Zoco (see welcomeOf)
const LOG_MAX = 40;
const GAME_KEEP_MS = 14 * 86400000;

// ── the catalog (the renders' ids and names are saga.js ZOCO; price 150-400, his range) ──────────────────────────────
// hold: kept OUT of the shop until he says so (hidden from kids and never sold; a kid who owns one keeps it). Held
// 2026-10-19: where the model came from is not confirmed yet (roster.json), so their pictures are not published either
// (security review: a licence question is about the files too). To sell one: delete its `hold` (one line) and copy its
// two renders from assets-library/originals-renders/2026-10-19 (full/<roster id>.webp → public/assets/zoco/full/<id>.webp,
// avatar/<roster id>.webp → public/assets/zoco/avatar/<id>.webp; roster ids: latifa, panda, perro-de-adric,
// poni-de-aileen); scripts/test-zoco.js checks the files of everything on sale.
const CATS = [
  { id: 'dralingo', title: 'Dralingo', one: 'forma', many: 'formas', tag: 'Dralingo · forma especial' },
  { id: 'pandilla', title: 'La pandilla', one: 'personaje', many: 'personajes', tag: 'La pandilla · nuevo look' },
  { id: 'mascotas', title: 'Mascotas', one: 'amigo', many: 'amigos', tag: 'Mascota' },
];
const ADDED = '2026-10-19';
const CATALOG = [
  // (order = the shop's order: look-alikes never side by side, on a phone's 2 columns or a laptop's 5)
  { id: 'dralingo-emperador-qin', cat: 'dralingo', price: 400, hero: true, blurb: 'La corona de los emperadores de la Gran Muralla. Úsalo en tu perfil y en los juegos de la clase.' },
  { id: 'dralingo-fuego-azul', cat: 'dralingo', price: 300, blurb: 'Su superpoder: un fuego azul que nunca quema. Ilumina las palabras y le da fuerza a tus amigos.' },
  { id: 'dralingo-sheikh', cat: 'dralingo', price: 150, blurb: 'Dralingo con su kandura blanca y su ghutra, sentado tranquilo, como en casa en Dubái.' },
  { id: 'dralingo-emperador-barba', cat: 'dralingo', price: 350, blurb: 'Dralingo cuando ya es muy sabio: barba blanca larga y la calma de los grandes maestros.' },
  { id: 'dralingo-sheikh-paseo-roja', cat: 'dralingo', price: 200, blurb: 'De paseo con su bastón y la ghutra roja.' },
  { id: 'dralingo-clasico', cat: 'dralingo', price: 150, blurb: 'El dragón azul de siempre, con las alas abiertas y la ghutra roja.' },
  { id: 'dralingo-emperador', cat: 'dralingo', price: 250, blurb: 'Gorro de emperador y túnica blanca, listo para recorrer la Ciudad Prohibida.' },
  { id: 'bebe-dralingo-kufiya', cat: 'dralingo', price: 200, blurb: 'Dralingo de bebé, con su kufiya roja y blanca.' },
  { id: 'dralingo-sheikh-roja', cat: 'dralingo', price: 150, blurb: 'El mismo Dralingo Sheikh, con la ghutra de cuadros rojos y blancos.' },
  { id: 'bebe-dralingo-emperador', cat: 'dralingo', price: 200, blurb: 'Dralingo de bebé, con un gorro de emperador rojo. ¡Pequeño pero valiente!' },
  { id: 'dralingo-sheikh-paseo', cat: 'dralingo', price: 200, blurb: 'Dralingo sale de paseo por Dubái con su bastón. ¡Yalla, amigos!' },
  { id: 'profe-fer', cat: 'pandilla', price: 200, blurb: 'Tu profe con su traje azul de gala. ¡Atención, equipo!' },
  { id: 'hamdan-3d', cat: 'pandilla', price: 200, blurb: 'El capitán de la pandilla, con su kandura y su ghutra. ¡Bienvenidos a Dubái!' },
  { id: 'latifa-3d', cat: 'pandilla', price: 200, hold: 'su cabeza viene de Ready Player Me: revisar los términos', blurb: 'La estratega de la pandilla: siempre tiene un plan.' },
  { id: 'aileen-3d', cat: 'pandilla', price: 200, blurb: 'Aileen con su traje blanco de artes marciales. ¡Dale, vos podés!' },
  { id: 'adric-3d', cat: 'pandilla', price: 200, blurb: 'El rastreador de la pandilla, con su chaqueta negra y azul. Mira… escucha.' },
  { id: 'adrian-3d', cat: 'pandilla', price: 200, blurb: 'El explorador de la pandilla, siempre buscando la próxima X del mapa. ¡A la aventura!' },
  { id: 'perro-de-adric', cat: 'mascotas', price: 250, hold: 'el origen del modelo no está confirmado', blurb: 'El perro de Adric sigue cualquier pista.' },
  { id: 'poni-de-aileen', cat: 'mascotas', price: 250, hold: 'el origen del modelo no está confirmado', blurb: 'La poni unicornio de Aileen.' },
  { id: 'panda-3d', cat: 'mascotas', price: 250, hold: 'la licencia del modelo no está confirmada', blurb: 'Un panda de China, amigo de toda la pandilla.' },
];
const ITEM = Object.create(null);
CATALOG.forEach((x) => { ITEM[x.id] = x; });
const item = (id) => (typeof id === 'string' && Object.prototype.hasOwnProperty.call(ITEM, id) ? ITEM[id] : null);
const isSkin = (id) => !!item(id) && !!Saga.zoco(id);
// what a kid may see and buy in the shop
const onSale = (x) => !!(x && !x.hold && Saga.zoco(x.id));

// ── days (the kid's own calendar: rec.tz from their phone, like the streak in core/student-records.js) ─────────────
function localDay(rec, at) {
  const d = new Date(at || Date.now());
  const tz = rec && typeof rec.tz === 'string' ? rec.tz : '';
  if (tz) {
    try { const s = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; } catch (_) { /* UTC */ }
  }
  return d.toISOString().slice(0, 10);
}
function addDay(day, delta) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day || ''));
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
const obj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// ── the purse ────────────────────────────────────────────────────────────────────────────────────────────────────
// the streak milestones of the run the record is in now: ['streak:<first day>:<n>', …] (n = 1 for 7 days, 2 for 14…)
function streakKeys(rec) {
  const n = Number(rec && rec.streak) || 0;
  const last = rec && (rec.dayDate || rec.dailyDate);
  if (n < 7 || !last) return [];
  const start = addDay(last, -(n - 1));
  if (!start) return [];
  const out = [];
  for (let k = 1; k <= Math.floor(n / 7); k++) out.push('streak:' + start + ':' + k);
  return out;
}
const levelsOf = (rec) => (obj(rec && rec.ruta) ? Object.keys(rec.ruta) : []);
// the practice worlds of a level at or above the goal (their record keys: a number of La Base's worlds, or pinyin /
// simulacro)
function trainKeysAtGoal(rec, level, goal) {
  const e = obj(rec && rec.ruta) && obj(rec.ruta[level]) ? rec.ruta[level] : null;
  const p = e && obj(e.p) ? e.p : {};
  return Object.keys(p).filter((w) => Number(p[w]) >= goal).map((w) => 'train:' + level + ':' + w);
}
const sentIds = (rec) => (obj(rec && rec.tareas) ? Object.keys(rec.tareas).filter((id) => rec.tareas[id] && rec.tareas[id].s) : []);
function sealCount(rec, level) {
  const b = rp().baseOf(level);
  return b ? rp().sealsOf(rec, level).size : 0;
}
// the welcome grant (decided 2026-10-19, documented in docs/specs/zoco.md): what a kid did BEFORE El Zoco never pays
// coin by coin (no retroactive pay), but a diligent kid should not start at 0 next to a new one either: half pay for it
// (1 a word, 10 a practice at the goal, 25 a homework sent), at most WELCOME_MAX (one character at most).
function welcomeOf(rec, goal) {
  let n = 0;
  levelsOf(rec).forEach((lvl) => { n += sealCount(rec, lvl) + 10 * trainKeysAtGoal(rec, lvl, goal).length; });
  n += 25 * sentIds(rec).length;
  return Math.min(WELCOME_MAX, Math.max(0, Math.round(n)));
}
// The kid's purse, opened the first time El Zoco meets the record (their home, the shop, or their first real step after
// the launch: server.js calls this BEFORE a step changes the record). Everything already done counts as done (never paid
// again) and sizes the welcome grant. env: { goal } (the Dorado %). → rec.zoco
function ensure(rec, env) {
  if (!rec) return null;
  if (obj(rec.zoco) && rec.zoco.v === 1) return rec.zoco;
  const goal = Number(env && env.goal) || 70;
  const now = Date.now();
  const z = { v: 1, at: now, c: 0, e: 0, sp: 0, w: 0, ps: 0, own: [], buys: [], k: {}, sk: {}, gm: {}, q: { seal: 0, hw: [] }, day: {}, log: [] };
  levelsOf(rec).forEach((lvl) => {
    const b = rp().baseOf(lvl);
    if (b) { const s = rp().encodeSeals(rp().sealsOf(rec, lvl)); if (s) z.sk[lvl] = s; }
    trainKeysAtGoal(rec, lvl, goal).forEach((k) => { z.k[k] = 0; });
  });
  sentIds(rec).forEach((id) => { z.k['hw:' + id] = 0; });
  streakKeys(rec).forEach((k) => { z.k[k] = 0; });
  const w = welcomeOf(rec, goal);
  if (w > 0) { z.c = w; z.e = w; z.w = w; z.log.push([now, w, 'welcome']); }
  rec.zoco = z;
  return z;
}
// (security review 2026-10-19: the day only moves FORWARD. A phone that flips its time zone back and forth, Kiritimati ↔
// Niue, would otherwise reset the caps on every request; like the streak's _bumpDay, a day before the last one changes
// nothing: the counts of the later day stay until the calendar catches up)
function today(rec, z) {
  const d = localDay(rec);
  if (!obj(z.day) || !z.day.d || d > z.day.d) z.day = { d, seal: 0, hw: 0, game: 0, star: 0 };
  return z.day;
}
function credit(z, n, why, out) {
  if (!n) return;
  z.c += n;
  if (n > 0) z.e += n;
  z.log.push([Date.now(), n, why]);
  if (z.log.length > LOG_MAX) z.log.splice(0, z.log.length - LOG_MAX);
  out.got += n;
  out.items.push({ why, n });
}
const result = () => ({ got: 0, items: [] });
function done(z, out) { return { got: out.got, items: out.items, c: z.c }; }

// what waited for a new day: paid first thing, up to today's caps (seals first, then homework in the order they came)
function settleQueue(rec, out) {
  const z = rec.zoco;
  const t = today(rec, z);
  if (!obj(z.q)) z.q = { seal: 0, hw: [] };
  if (z.q.seal > 0) {
    const n = Math.min(z.q.seal, Math.max(0, CAP.seal - t.seal));
    if (n > 0) { z.q.seal -= n; t.seal += n; z.ps = (Number(z.ps) || 0) + n; credit(z, n, 'seal', out); }
  }
  const hw = Array.isArray(z.q.hw) ? z.q.hw : (z.q.hw = []);
  const sent = new Set(sentIds(rec));
  while (hw.length && t.hw + hw[0][1] <= CAP.hw) {
    const [id, n] = hw.shift();
    if (!sent.has(id) || own(z.k, 'hw:' + id)) continue;   // (unmarked meanwhile, or already paid: nothing)
    t.hw += n;
    z.k['hw:' + id] = n;
    credit(z, n, 'hw', out);
  }
}

// ── the steps ────────────────────────────────────────────────────────────────────────────────────────────────────
// La Base: the words sealed now that never counted before pay PAY.seal each (today's cap, the rest waits). An unmark
// and a new mark of the same word pays nothing (it stays counted). → { got, items, c }
function settleSeals(rec, level) {
  const z = rec.zoco;
  const out = result(z);
  const b = rp().baseOf(level);
  if (!b) return done(z, out);
  if (!obj(z.sk)) z.sk = {};
  const known = rp().decodeSeals(z.sk[level], b.words);
  const now = rp().sealsOf(rec, level);
  let fresh = 0;
  now.forEach((n) => { if (!known.has(n)) { known.add(n); fresh++; } });
  if (fresh) {
    z.sk[level] = rp().encodeSeals(known);
    const t = today(rec, z);
    settleQueue(rec, out);
    const coins = fresh * PAY.seal;
    const pay = Math.min(coins, Math.max(0, CAP.seal - t.seal));
    if (pay > 0) { t.seal += pay; z.ps = (Number(z.ps) || 0) + pay; credit(z, pay, 'seal', out); }
    if (coins > pay) z.q.seal = (Number(z.q.seal) || 0) + (coins - pay);
  }
  return done(z, out);
}
// El Entrenamiento: every world of the level at the goal that never paid pays PAY.train once (a round replayed or a
// best beaten pays nothing more). → { got, items, c }
function settleTrain(rec, level, goal) {
  const z = rec.zoco;
  const out = result(z);
  trainKeysAtGoal(rec, level, Number(goal) || 70).forEach((k) => {
    if (own(z.k, k)) return;
    z.k[k] = PAY.train;
    credit(z, PAY.train, 'train', out);
  });
  return done(z, out);
}
// The homework marks: a homework of the kid's own level (`ids`) newly marked «¡Ya la mandé!» pays PAY.hw once (today's
// cap, the rest waits); one unmarked («Deshacer») takes back exactly what it paid (or leaves the waiting line). A mark
// made again pays again (net: one payment while it is marked). → { got, items, c }
function settleHw(rec, ids) {
  const z = rec.zoco;
  const out = result(z);
  const t = today(rec, z);
  const list = Array.isArray(ids) ? ids : [];
  const sent = new Set(sentIds(rec));
  if (!obj(z.q)) z.q = { seal: 0, hw: [] };
  if (!Array.isArray(z.q.hw)) z.q.hw = [];
  settleQueue(rec, out);
  // pays: the kid's own level's homework (`ids`); takes back: any homework that paid or waits, whatever its level (a kid
  // who moved up a level and unmarks an old homework gives its 50 back too)
  const all = new Set(list);
  Object.keys(z.k).forEach((k) => { if (k.indexOf('hw:') === 0) all.add(k.slice(3)); });
  z.q.hw.forEach((x) => { if (Array.isArray(x)) all.add(x[0]); });
  all.forEach((id) => {
    const key = 'hw:' + id;
    const waiting = z.q.hw.findIndex((x) => x[0] === id);
    if (sent.has(id)) {
      if (own(z.k, key) || waiting >= 0 || list.indexOf(id) < 0) return;
      if (t.hw + PAY.hw <= CAP.hw) { t.hw += PAY.hw; z.k[key] = PAY.hw; credit(z, PAY.hw, 'hw', out); }
      else z.q.hw.push([id, PAY.hw]);
    } else {
      if (waiting >= 0) { z.q.hw.splice(waiting, 1); return; }
      if (!own(z.k, key)) return;
      const back = Number(z.k[key]) || 0;
      if (!back) return;                    // (sent before El Zoco opened: it never paid, so it never pays later either)
      delete z.k[key];
      credit(z, -back, 'undo', out);
    }
  });
  return done(z, out);
}
// 7 days in a row (rec.streak, counted by core/student-records.js on the kid's calendar): each 7 of the run pays once
function settleStreak(rec) {
  const z = rec.zoco;
  const out = result(z);
  streakKeys(rec).forEach((k) => {
    if (own(z.k, k)) return;
    z.k[k] = PAY.streak;
    credit(z, PAY.streak, 'streak', out);
  });
  return done(z, out);
}
// everything that may be due without a new step (a new day's waiting coins, a streak): the home and the shop ask it
function settle(rec) {
  const z = rec.zoco;
  const out = result(z);
  settleQueue(rec, out);
  const s = settleStreak(rec);
  s.items.forEach((x) => { out.got += x.n; out.items.push(x); });
  return done(z, out);
}
// A class PIN game ended (server.js, every game's end): played for real (GAME_MIN answers or more) = PAY.game, plus
// PAY.star per bonus star of its ceremony, each once per game (`gid`: the room's own id for that round), within the
// day's caps. stats: { answered, stars: n } → { got, items, c }
function gameEnd(rec, gid, stats) {
  const z = rec.zoco;
  const out = result(z);
  const id = String(gid || '').slice(0, 64);
  if (!id) return done(z, out);
  if (!obj(z.gm)) z.gm = {};
  const now = Date.now();
  Object.keys(z.gm).forEach((k) => { const e = z.gm[k]; if (!Array.isArray(e) || now - Number(e[0]) > GAME_KEEP_MS) delete z.gm[k]; });
  if (own(z.gm, id)) return done(z, out);
  const answered = Number(stats && stats.answered) || 0;
  if (answered < GAME_MIN) return done(z, out);
  const t = today(rec, z);
  let got = 0;
  if (t.game < CAP.game) { t.game++; credit(z, PAY.game, 'game', out); got += PAY.game; }
  const stars = Math.max(0, Math.min(8, Math.floor(Number(stats && stats.stars) || 0)));
  const sn = Math.min(stars, Math.max(0, CAP.star - t.star));
  if (sn > 0) { t.star += sn; credit(z, sn * PAY.star, 'star', out); got += sn * PAY.star; }
  z.gm[id] = [now, got];
  return done(z, out);
}

// ── the shop ─────────────────────────────────────────────────────────────────────────────────────────────────────
const owns = (rec, id) => !!(rec && obj(rec.zoco) && Array.isArray(rec.zoco.own) && rec.zoco.own.includes(id));
// buy `id` (one atomic step: on sale, not owned yet, enough coins) → { ok, c, item } | { ok: false, status, why, error }
function buy(rec, id) {
  const z = rec && rec.zoco;
  const x = item(id);
  if (!z || !x || !onSale(x)) return { ok: false, status: 404, why: 'item', error: 'Ese personaje no está en el Zoco.' };
  if (owns(rec, x.id)) return { ok: false, status: 409, why: 'owned', error: '¡Ya es tuyo!' };
  if (!(z.c >= x.price)) return { ok: false, status: 402, why: 'coins', error: 'Te faltan ' + (x.price - Math.max(0, z.c)) + ' monedas.', need: x.price - Math.max(0, z.c) };
  z.c -= x.price;
  z.sp += x.price;
  z.own.push(x.id);
  if (!Array.isArray(z.buys)) z.buys = [];
  z.buys.push([x.id, x.price, Date.now()]);
  z.log.push([Date.now(), -x.price, 'buy']);
  if (z.log.length > LOG_MAX) z.log.splice(0, z.log.length - LOG_MAX);
  return { ok: true, c: z.c, item: x.id };
}
// «Pasar mi progreso a esta cuenta» (server.js _autoMerge): an automatic account's purse joins the kid's real one: its
// coins, its characters, and everything that already counted on it (so nothing it brings pays a second time)
// (security review 2026-10-19) only what is NEW to the real account moves: a merge never pays twice for the same words or
// homework (else «a fresh automatic account → mark everything → «Pasar mi progreso»» would mint coins in a loop):
//   · the keys the real account lacks (a practice, a homework, a game, a streak) with what they paid there (so
//     «Deshacer» on the real account still takes a homework's 50 back), and its homework still waiting in line;
//   · its words the real account never counted, 2 each, never more than the automatic account really earned or had
//     waiting for words (`ps` + its seal line); the part that was still waiting joins the real account's line;
//   · minus what it spent: its characters move too, so a shortfall (it spent coins on work the real account had already
//     done) is a debt on the real account, never minted.
function merge(from, to, env) {
  if (!from || !to) return { c: 0, own: 0 };
  ensure(to, env);
  const zt = to.zoco;
  const zf = obj(from.zoco) && from.zoco.v === 1 ? from.zoco : null;
  const out = { c: 0, own: 0 };
  if (!obj(zt.q)) zt.q = { seal: 0, hw: [] };
  if (!Array.isArray(zt.q.hw)) zt.q.hw = [];
  if (zf && !zf.mergedInto) {
    let worth = 0;
    Object.keys(obj(zf.k) ? zf.k : {}).forEach((k) => {
      if (own(zt.k, k) || (k.indexOf('hw:') === 0 && zt.q.hw.some((y) => 'hw:' + y[0] === k))) return;
      const v = Math.max(0, Number(zf.k[k]) || 0);
      zt.k[k] = v;
      worth += v;
    });
    if (!obj(zt.gm)) zt.gm = {};
    Object.keys(obj(zf.gm) ? zf.gm : {}).forEach((g) => {
      if (own(zt.gm, g) || !Array.isArray(zf.gm[g])) return;
      zt.gm[g] = zf.gm[g].slice(0, 2);
      worth += Math.max(0, Number(zf.gm[g][1]) || 0);
    });
    let fresh = 0;
    Object.keys(obj(zf.sk) ? zf.sk : {}).forEach((lvl) => {
      const b = rp().baseOf(lvl);
      if (!b) return;
      const known = rp().decodeSeals(zt.sk[lvl], b.words);
      rp().decodeSeals(zf.sk[lvl], b.words).forEach((n) => { if (!known.has(n)) fresh++; });
    });
    const sealLine = Math.max(0, Number(obj(zf.q) && zf.q.seal) || 0);
    const sealWorth = Math.min(fresh * PAY.seal, Math.max(0, Number(zf.ps) || 0) + sealLine);
    const sealQ = Math.min(sealLine, sealWorth);
    worth += sealWorth - sealQ;
    zt.q.seal = (Number(zt.q.seal) || 0) + sealQ;
    (obj(zf.q) && Array.isArray(zf.q.hw) ? zf.q.hw : []).forEach((x) => {
      if (Array.isArray(x) && !own(zt.k, 'hw:' + x[0]) && !zt.q.hw.some((y) => y[0] === x[0])) zt.q.hw.push([x[0], Math.max(0, Number(x[1]) || 0)]);
    });
    const spent = Math.max(0, Number(zf.sp) || 0);
    const delta = Math.min(worth - spent, Number(zf.c) || 0);
    if (delta) { zt.c += delta; zt.log.push([Date.now(), delta, 'merge']); if (zt.log.length > LOG_MAX) zt.log.splice(0, zt.log.length - LOG_MAX); }
    zt.e += Math.max(0, worth);
    zt.sp += spent;
    (zf.own || []).forEach((id) => { if (item(id) && !zt.own.includes(id)) { zt.own.push(id); out.own++; } });
    out.c = delta;
    zf.c = 0;
    zf.q = { seal: 0, hw: [] };
    zf.mergedInto = to.code;
  }
  // every step of the automatic account counts as done on the real one (its seals, its practices, its homework)
  levelsOf(from).forEach((lvl) => {
    const b = rp().baseOf(lvl);
    if (b) {
      const known = rp().decodeSeals(zt.sk[lvl], b.words);
      rp().sealsOf(from, lvl).forEach((n) => known.add(n));
      if (zf && zf.sk && zf.sk[lvl]) rp().decodeSeals(zf.sk[lvl], b.words).forEach((n) => known.add(n));
      const s = rp().encodeSeals(known);
      if (s) zt.sk[lvl] = s;
    }
    trainKeysAtGoal(from, lvl, Number(env && env.goal) || 70).forEach((k) => { if (!own(zt.k, k)) zt.k[k] = 0; });
  });
  sentIds(from).forEach((id) => { if (!own(zt.k, 'hw:' + id) && !zt.q.hw.some((y) => y[0] === id)) zt.k['hw:' + id] = 0; });
  return out;
}

// ── what the shop shows ──────────────────────────────────────────────────────────────────────────────────────────
// the table of «¿Cómo gano monedas?» (one source with the payments above)
const WAYS = [
  { n: 1, what: 'Marca una palabra', where: 'En La Base de tu experiencia', coins: PAY.seal, each: false },
  { n: 2, what: 'Supera una práctica', where: 'En El Entrenamiento, al llegar a la meta', coins: PAY.train, each: false },
  { n: 3, what: 'Manda tu tarea', where: 'Toca «¡Ya la mandé!» con tu video', coins: PAY.hw, each: false },
  { n: 4, what: 'Juega en clase', where: 'Cada partida con el PIN de tu profe', coins: PAY.game, each: false },
  { n: 5, what: 'Gana estrellas en el juego', where: 'En la ceremonia del final', coins: PAY.star, each: true },
  { n: 6, what: 'Racha de 7 días', where: 'Un paso cada día, siete días seguidos', coins: PAY.streak, each: false },
];
const isNew = (now) => (Date.parse(ADDED + 'T00:00:00Z') + 45 * 86400000) > (now || Date.now());
// rec → { coins, own, equipped, items: [on sale + owned], cats, ways, news: log since `since` }
function view(rec, opts) {
  const z = rec && rec.zoco;
  const o = opts || {};
  const since = Number(o.since) || 0;
  const mine = z && Array.isArray(z.own) ? z.own : [];
  const items = CATALOG.filter((x) => onSale(x) || mine.includes(x.id)).map((x) => {
    const s = Saga.zoco(x.id);
    return {
      id: x.id, name: s.label, cat: x.cat, price: x.price, blurb: x.blurb, owned: mine.includes(x.id), hero: !!x.hero,
      animal: !!s.animal, full: '/assets/zoco/full/' + x.id + '.webp', head: '/assets/zoco/avatar/' + x.id + '.webp',
    };
  });
  const news = z ? z.log.filter((e) => Array.isArray(e) && Number(e[0]) > since).map((e) => ({ at: e[0], n: e[1], why: e[2] })) : [];
  const q = z && obj(z.q) ? (Number(z.q.seal) || 0) + (Array.isArray(z.q.hw) ? z.q.hw.reduce((a, x) => a + (Number(x[1]) || 0), 0) : 0) : 0;
  return {
    coins: z ? z.c : 0, earned: z ? z.e : 0, waiting: q, welcome: z ? z.w : 0,
    own: mine.slice(), equipped: rec && typeof rec.avatar === 'string' ? rec.avatar : null,
    items, cats: CATS.map((c) => ({ id: c.id, title: c.title, one: c.one, many: c.many, tag: c.tag })), fresh: isNew(),
    ways: WAYS, news, caps: { seal: CAP.seal, hw: CAP.hw, game: CAP.game, star: CAP.star, gameMin: GAME_MIN },
  };
}
// the coins pill and its news only (the home's band)
function brief(rec, since) {
  const z = rec && rec.zoco;
  const s = Number(since) || 0;
  return { coins: z ? z.c : 0, news: z ? z.log.filter((e) => Array.isArray(e) && Number(e[0]) > s && Number(e[1]) > 0).map((e) => ({ at: e[0], n: e[1], why: e[2] })) : [] };
}

module.exports = {
  PAY, CAP, GAME_MIN, WELCOME_MAX, CATS, CATALOG, WAYS, ADDED,
  item, isSkin, onSale, owns, localDay,
  ensure, welcomeOf, settle, settleQueue: (rec) => { const out = result(rec.zoco); settleQueue(rec, out); return done(rec.zoco, out); },
  settleSeals, settleTrain, settleHw, settleStreak, gameEnd, buy, merge, view, brief, streakKeys,
};
