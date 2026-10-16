#!/usr/bin/env node
// The 6-7 phone's instant reaction (2026-10-16, «no dead phones»), tested without a browser: the real
// public/js/player-sixseven.js (+ sixseven-stage.js, mochi-stage.js, cast.js) runs in a tiny fake page with a fake clock,
// fake timers and a fake socket. The phone guesses the verdict at the tap (a wrong button is certainly wrong; the right
// one is certainly right once the sum was readable for the too-fast line); the server's verdict then settles or reverts it.
// Checked: a confirmed guess counts once (coins = the server's total, right/answered +1); a too-fast verdict takes a
// guessed «¡Sí!» back; a wrong-button guess; the same sum sent again (the server never got the tap) gives the sum back;
// 'answer-stale' paused gives it back; a new sum while a guess is open (never judged) undoes it; a golden sum settled
// before and after the coins land; my coins on the team meter are never counted twice (the meter after the verdict
// holds them); a fast right tap (under the line) waits for the server; the teammates' feed; a team wave.
//   node scripts/test-sixseven-phone.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let checks = 0;
const ok = (c, msg) => { checks++; assert.ok(c, msg); };
const eq = (a, b, msg) => { checks++; assert.deepStrictEqual(a, b, msg); };

// ---------- a fake clock and timers ----------
let NOW = 1000;
let tq = [], tid = 1;
const setT = (fn, ms) => { const id = tid++; tq.push({ id, at: NOW + Math.max(0, +ms || 0), fn, every: 0 }); return id; };
const setI = (fn, ms) => { const id = tid++; tq.push({ id, at: NOW + Math.max(1, +ms || 1), fn, every: Math.max(1, +ms || 1) }); return id; };
const clearT = (id) => { tq = tq.filter((t) => t.id !== id); };
function advance(ms) {
  const end = NOW + ms;
  for (;;) {
    tq.sort((a, b) => a.at - b.at || a.id - b.id);
    const t = tq[0];
    if (!t || t.at > end) break;
    NOW = t.at;
    if (t.every) t.at += t.every; else tq.shift();
    t.fn();
  }
  NOW = end;
}

// ---------- a fake page: just enough DOM for the phone module ----------
class ClassList {
  constructor() { this.l = []; }
  add(...c) { c.forEach((x) => { if (x && !this.l.includes(x)) this.l.push(x); }); }
  remove(...c) { this.l = this.l.filter((x) => !c.includes(x)); }
  toggle(c, v) { const on = v === undefined ? !this.l.includes(c) : !!v; if (on) this.add(c); else this.remove(c); return on; }
  contains(c) { return this.l.includes(c); }
}
class Style { setProperty(k, v) { this[k] = v; } removeProperty(k) { delete this[k]; } }
class El {
  constructor(tag, id, html) {
    this.tagName = String(tag || 'div').toUpperCase(); this.id = id || ''; this._html = !!html; this.children = [];
    this.style = new Style(); this.classList = new ClassList(); this.attrs = {}; this.text = ''; this.parentNode = null;
    this.listeners = {}; this.disabled = false; this.isConnected = true; this.dataset = {};
    this.offsetWidth = 100; this.offsetHeight = 100; this.offsetTop = 0; this.clientHeight = 100;
    this.naturalWidth = 100; this.naturalHeight = 100; this.complete = true;
  }
  get className() { return this.classList.l.join(' '); }
  set className(v) { this.classList.l = String(v || '').split(/\s+/).filter(Boolean); }
  get textContent() { return this.text + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this.text = String(v); this.children = []; }
  get innerHTML() { return ''; }
  set innerHTML(v) { this.children = []; this.text = ''; }
  appendChild(c) { if (c.parentNode) c.parentNode.children = c.parentNode.children.filter((x) => x !== c); c.parentNode = this; this.children.push(c); return c; }
  append(...n) { n.forEach((x) => this.appendChild(typeof x === 'string' ? Object.assign(new El('#text'), { text: x }) : x)); }
  prepend(c) { if (c.parentNode) c.parentNode.children = c.parentNode.children.filter((x) => x !== c); c.parentNode = this; this.children.unshift(c); }
  after() {}
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((x) => x !== this); this.parentNode = null; }
  find(sel) {
    for (const c of this.children) {
      const hit = sel[0] === '.' ? c.classList.contains(sel.slice(1)) : c.tagName === sel.toUpperCase();
      if (hit) return c;
      const d = c.find(sel);
      if (d) return d;
    }
    return null;
  }
  querySelector(sel) { const s = String(sel).replace(':scope > ', '').trim(); return this.find(s) || (this._html ? new El('b') : null); }
  querySelectorAll() { return []; }
  getBoundingClientRect() { return { left: 10, top: 10, width: 100, height: 100, right: 110, bottom: 110 }; }
  animate(kf, o) {
    const ms = (typeof o === 'number' ? o : (o && (o.duration || 0) + (o.delay || 0))) || 0;
    const a = { onfinish: null, cancel() { clearT(this._t); }, pause() {}, play() {} };
    a._t = setT(() => { if (a.onfinish) a.onfinish(); }, ms);
    return a;
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : (k === 'src' ? this.src || null : null); }
  addEventListener(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); }
  removeEventListener() {}
}
const byId = {};
const body = new El('body', 'body', true);
const document = {
  body,
  getElementById: (id) => byId[id] || (byId[id] = Object.assign(new El('div', id, true), { parentNode: new El('div', '', true) })),
  createElement: (t) => new El(t),
  createElementNS: (ns, t) => new El(t),
  createTextNode: (t) => Object.assign(new El('#text'), { text: String(t) }),
  addEventListener() {},
  getAnimations: () => [],
};

// ---------- a fake socket and the phone's context ----------
const handlers = {};
const sent = [];
const socket = { id: 'sockA', on: (ev, fn) => { (handlers[ev] = handlers[ev] || []).push(fn); }, emit: (ev, d) => { sent.push([ev, d]); } };
const fire = (ev, d) => (handlers[ev] || []).forEach((fn) => fn(d));
let team = 'red';
const sandbox = {
  document, console, Math, JSON, Object, Array, String, Number, Boolean, Promise, Error, Infinity, NaN, isNaN, parseInt, parseFloat,
  setTimeout: setT, clearTimeout: clearT, setInterval: setI, clearInterval: clearT,
  requestAnimationFrame: (fn) => setT(() => fn(NOW), 16),
  performance: { now: () => NOW },
  Date: { now: () => 1.7e12 + NOW },
  navigator: { vibrate() {} },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  location: { href: '/' },
  innerWidth: 390, innerHeight: 844,
  matchMedia: () => ({ matches: false }),
  Image: function () { return new El('img'); },
  Node: El,
};
sandbox.window = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
const root = path.join(__dirname, '..', 'public', 'js');
['cast.js', 'mochi-stage.js', 'sixseven-stage.js', 'player-sixseven.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f }));
const Phone = sandbox.SixSevenPhone;
Phone.init({ socket, getPin: () => '1234', getTeam: () => team, showScreen() {}, markActivity() {} });
const $ = (id) => document.getElementById(id);
const F = () => Phone.frame();
const answers = () => sent.filter(([ev]) => ev === 'player:answer').map(([, d]) => d);

// ---------- a round: lobby state, init, play ----------
const players = {
  sockA: { name: 'Ana', team: 'red', k: 1, sk: 'dralingo', avatar: '' },
  sockB: { name: 'Sofía', team: 'red', k: 2, sk: 'latifa', avatar: '' },
  sockC: { name: 'Omar', team: 'gold', k: 3, sk: 'camel', avatar: '' },
};
fire('state', { gameType: 'sixseven', state: 'active', players, ssStyle: 'num' });
fire('ss:init', { id: 7, phase: 'play', endsMs: 120000, frenzy: false, paused: false, style: 'num', E: 216, race: [], meter: { r: 0, g: 0, b: null },
  roster: [{ k: 1, name: 'Ana', skin: 'dralingo', team: 'red', on: true }, { k: 2, name: 'Sofía', skin: 'latifa', team: 'red', on: true }, { k: 3, name: 'Omar', skin: 'camel', team: 'gold', on: true }],
  captains: { red: 'aileen', gold: 'hamdan' }, you: { k: 1, team: 'red', coins: 0, streak: 0, right: 0, answered: 0, best: 0 }, w: [650, 1600, 2600] });
ok(F().on && F().phase === 'play', 'the phone is in the round');
eq(F().crew, 2, 'my world draws one mate and one rival (the others of the round)');
let qn = 0;
const ask = (a, b, op, o) => {
  const q = Object.assign({ qid: 'q' + (++qn), gameMode: 'sixseven', text: `${a} ${op === '+' ? '+' : '−'} ${b} = ?`, answers: ['6', '7'],
    ss: { a, b, op, zh: false, gold: false, ms: 12000, min: 400, n: qn } }, o || {});
  if (o && o.gold) q.ss.gold = true;
  fire('question', q);
  return q;
};
const verdict = (q, o) => {
  const v = Object.assign({ qid: q.qid, right: true, ans: 7, word: 'qi', choice: 7, timeUp: false, tooFast: false, calm: false, wait: 650,
    streak: 1, mult: 1, coins: 1, total: 1, gold: false, goldExtra: 0, frenzy: false, zh: false, six: 0, pair: false }, o);
  fire('answer-result', { correct: v.right, correctText: `${v.ans} · ${v.word}`, sixseven: v });
};
const meterText = () => [$('ssx-rn').textContent, $('ssx-gn').textContent];

// 1 · a right tap after the line: the reaction is on the tap; the server confirms; nothing counts twice
let q = ask(3, 4, '+');
advance(800);
Phone.tap(7);
ok(F().guessed && F().done, 'a right tap after the too-fast line: the phone shows the verdict at once (a guess)');
eq([F().me.coins, F().me.right, F().me.answered, F().me.streak], [1, 1, 1, 1], 'the guess counts once: 1 coin, 1 right');
ok($('ssx-card').classList.contains('ok') && $('ssx-ask').textContent === '7', 'the card turns green with «= 7» on the tap');
eq(answers().length, 1, 'the answer went to the server');
advance(80);
verdict(q, { streak: 1, coins: 1, total: 1 });
ok(!F().guessed, 'the verdict settles the guess');
eq([F().me.coins, F().me.right, F().me.answered], [1, 1, 1], 'confirmed: still counted once (coins = the server\'s total)');
// the team meter: a server meter that already holds my coin arrives before the coin lands → no double count
fire('ss:meter', { r: 1, g: 0, b: null });
advance(600);                                        // the coin lands
eq(meterText(), ['1', '0'], 'my coin in the meter once (the meter after the verdict held it)');

// 2 · the coin lands BEFORE the server's meter: shown at once on top of the meter, never twice after
q = ask(2, 4, '+');
advance(700);
Phone.tap(6);
advance(600);                                        // the coin lands before any verdict or meter
eq(meterText(), ['2', '0'], 'landed before any meter: my coin shows on top of the server\'s meter');
fire('ss:meter', { r: 1, g: 0, b: null });          // an older meter (sent before the server judged it): mine stays on top
eq(meterText(), ['2', '0'], 'an older meter does not wipe my landed coin');
verdict(q, { ans: 6, word: 'liu', choice: 6, streak: 2, coins: 1, total: 2 });
fire('ss:meter', { r: 2, g: 0, b: null });          // the meter after the verdict holds it
eq(meterText(), ['2', '0'], 'the meter after the verdict: counted once, no jump back');
eq(F().me.coins, 2, 'my gold = the server\'s total');
// streak 3 (×2) for the next cases
q = ask(9, 3, '-');
advance(700);
Phone.tap(6);
eq(F().me.coins, 4, 'racha 3 guessed: ×2');
verdict(q, { ans: 6, word: 'liu', choice: 6, streak: 3, mult: 2, coins: 2, total: 4 });
fire('ss:meter', { r: 4, g: 0, b: null });
advance(700);
eq(meterText(), ['4', '0'], 'counted once after landing');

// 3 · a right tap the server calls too fast: the guessed «¡Sí!» is taken back
const before = F().me;
q = ask(5, 2, '+');
advance(700);
Phone.tap(7);
ok(F().guessed, 'guessed right');
verdict(q, { right: false, tooFast: true, choice: 7, streak: 0, coins: 0, total: before.coins, wait: 1600 });
eq([F().me.coins, F().me.right, F().me.answered, F().me.streak], [before.coins, before.right, before.answered + 1, 0], 'a too-fast verdict: the guess is undone, the answer counted once as wrong');
ok($('ssx-card').classList.contains('no') && F().locked && $('ssx-lock').textContent.includes('Recargando'), 'the card shows the wrong answer and the buttons recharge («¡Recargando!»)');
advance(600);
eq(meterText()[0], '4', 'the taken-back coin never reaches the team meter (still the server\'s 4)');

// 4 · a wrong button: certainly wrong at the tap; «¡Recargando!», then the server agrees
advance(1200);
q = ask(8, 1, '-');
advance(500);
Phone.tap(6);
ok(F().guessed && F().locked, 'a wrong button: the wobble and «¡Recargando!» on the tap');
ok($('ssx-lock').textContent.includes('Respira') && !$('ssx-lock').textContent.includes('Espera'), 'the second slip in a row, guessed at the tap: «¡Respira! Piensa y toca», never a plain «Espera…»');
const ans5 = F().me.answered;
verdict(q, { right: false, choice: 6, streak: 0, coins: 0, total: F().me.coins, wait: 2600, calm: true });
eq(F().me.answered, ans5, 'confirmed wrong: counted once');
ok($('ssx-lock').textContent.includes('Respira'), 'the server says two in a row: «¡Respira!»');

// 5 · the same sum sent again (the server never got the tap): the guess is undone, the sum is mine again
advance(3000);
q = ask(1, 6, '+');
advance(700);
const pre = F().me;
Phone.tap(7);
ok(F().guessed, 'guessed');
fire('question', q);                                   // a resync re-sends the open sum: the server is still waiting for it
ok(!F().guessed && !F().done && !F().tapped, 'the same sum again: the guess is undone');
eq([F().me.coins, F().me.right, F().me.answered], [pre.coins, pre.right, pre.answered], 'my numbers as before the tap');
ok(!$('ssx-b6').disabled && !$('ssx-b7').disabled, 'the buttons are back');
Phone.tap(7);
verdict(q, { streak: 1, coins: 1, total: pre.coins + 1 });
eq(F().me.coins, pre.coins + 1, 'the second tap counts');

// 6 · 'answer-stale' paused: the teacher paused while the tap travelled
advance(800);
q = ask(4, 2, '+');
advance(700);
const pre6 = F().me;
Phone.tap(6);
fire('answer-stale', { reason: 'paused' });
ok(!F().guessed && !F().tapped && !F().done, 'a paused stale: the guess is undone');
eq(F().me.coins, pre6.coins, 'no coin from the undone guess');
Phone.tap(6);                                          // (the phone is not paused here: the tap goes through)
verdict(q, { ans: 6, word: 'liu', choice: 6, streak: 2, coins: 1, total: pre6.coins + 1 });

// 7 · a new sum while a guess is still open (the server dropped that sum on a rejoin, never judged it)
advance(800);
q = ask(3, 3, '+');
advance(700);
const pre7 = F().me;
Phone.tap(6);
eq(F().me.coins, pre7.coins + 2, 'guessed (streak 3: ×2)');
q = ask(2, 5, '+');                                    // a NEW sum, no verdict for the old one
eq([F().me.coins, F().me.streak, F().me.right], [pre7.coins, pre7.streak, pre7.right], 'a new sum: the never-judged guess is undone');
ok(!F().done && !F().guessed, 'the new sum is open');

// 8 · a golden sum: the verdict brings the golden extra, before and after the coins land
advance(700);
let q8 = q;
const pre8 = F().me;
Phone.tap(7);
advance(60);
verdict(q8, { streak: pre8.streak + 1, coins: 6, goldExtra: 5, gold: true, total: pre8.coins + 6 });
advance(700);
eq(F().me.coins, pre8.coins + 6, 'golden extra settled before landing: my gold = the server\'s');
advance(500);
q8 = ask(10, 3, '-', { gold: true });
advance(700);
const pre9 = F().me;
Phone.tap(7);
advance(700);                                          // lands with the guessed coins first
verdict(q8, { streak: pre9.streak + 1, coins: 7, goldExtra: 5, gold: true, total: pre9.coins + 7 });
eq(F().me.coins, pre9.coins + 7, 'golden extra settled after landing: my gold = the server\'s');
ok($('ssx-plus').textContent === '+5', 'only the golden difference pops («+5»), not a second «+7»');

// 9 · a fast right tap (under the too-fast line): the phone waits for the server instead of guessing
advance(800);
q = ask(6, 1, '+');
advance(150);
Phone.tap(7);
ok(F().tapped && !F().done && !F().guessed, 'a right tap under the line: no guess (the server decides)');
verdict(q, { right: false, tooFast: true, choice: 7, streak: 0, coins: 0, total: F().me.coins, wait: 1600 });
ok($('ssx-verdict').textContent.includes('Muy rápido'), 'the server\'s «¡Muy rápido!»');

// 10 · teammates between my sums, a team wave, the pause card
advance(2600);                                         // (my captain's bubble from the slip is gone: the corner is free)
fire('ss:meter', { r: 20, g: 10, b: null, f: [[2, 3, 0, 0], [3, 2, 0, 0], [2, 1, 0, 1]] });
ok($('ssx-who').textContent.includes('Sofía'), 'a teammate\'s coins: «Sofía +3» over our pan');
fire('ss:wave', { team: 'red', n: 1, gold: 67, meter: { r: 67, g: 30, b: null } });
advance(100);
ok($('ssx-banner').textContent.includes('SIX SEVEN'), 'my team\'s wave: «¡SIX SEVEN!» banner');
ok($('ssx-crew-l').classList.contains('cheer'), 'my crew does the 6-7');
fire('ss:pause', { paused: true, endsMs: 60000, phase: 'play', meter: { r: 283, g: 240, b: null } });
ok($('ssx-pause-score').textContent.includes('Fuego 283') && $('ssx-pause-score').textContent.includes('Tú'), 'the pause card shows the score of that moment (sent with the pause) and my gold');
fire('ss:pause', { paused: false, endsMs: 60000, phase: 'play' });

// 11 · a golden sum whose extra the comeback cap brought to 0: a plain «¡Sí!», never «¡Pregunta dorada! +1»
advance(3000);
q = ask(5, 1, '+', { gold: true });
advance(700);
const c11 = F().me.coins;
Phone.tap(6);
const pre11 = F().me;
verdict(q, { ans: 6, word: 'liu', choice: 6, streak: pre11.streak, coins: pre11.coins - c11, goldExtra: 0, gold: true, total: pre11.coins });
ok(!$('ssx-verdict').textContent.includes('dorada'), 'a golden sum capped to 0: no golden fanfare');
eq(answers().filter((a) => a.choiceIdx !== -1).length >= 10, true, 'every tap reached the server');

console.log(`test-sixseven-phone: ${checks} checks passed`);
process.exit(0);
