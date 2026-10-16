// 6-7 Swing v2 «La Balanza de Oro» — what the phone (js/player-sixseven.js) and the projector (js/host-sixseven.js)
// both draw (kid figures, confetti, stars and count-ups come from js/mochi-stage.js):
//   · the golden balance: a pillar on Dubai Creek, a beam that tips toward the team with more gold, two pans hanging on
//     chains with piles of coins that grow (DOM + CSS: transforms only, the pans always hang straight)
//   · gold coins with a square hole (the old Chinese coin) flying in an arc to a pan or a counter (WAAPI, pooled nodes)
//   · Dralingo doing the «6-7»: two frames (one palm up, then the other), swapped on a beat (CSS steps, no JS loop)
//   · the kid's swing (rock toward the button tapped: 6 = left, 7 = right) and the wrong-answer wobble
//   · the 6-7 gesture in between (2026-10-16): the two buttons swing like the two palms (palms), the next sum tips in
//     from alternating sides (wipe), the balance rocks on a «six seven» wave (Balance.rock)
//   · a little rain cloud over the team that lost
// window.SixSevenStage = { TEAM, PINYIN, tilt, Balance, Coins, coin, dancer, swing, wobble, palms, wipe, sumValue, cloud, sum, el, fmt, reduced, preload }.
(function (root) {
  'use strict';
  const A = '/assets/sixseven/';
  const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const S = () => root.MochiStage;
  const TEAM = { red: { name: 'Fuego', full: 'Equipo Fuego' }, gold: { name: 'Mar', full: 'Equipo Mar' } };
  const PINYIN = ['ling', 'yi', 'er', 'san', 'si', 'wu', 'liu', 'qi', 'ba', 'jiu', 'shi'];   // no tone marks (games' rule)
  const MAX_DEG = 15;
  function el(tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('es-ES');
  // −1 … 1 (+ = the Mar side goes down): the same formula as core/sixseven.js tilt()
  function tilt(r, g) {
    const sum = (r || 0) + (g || 0);
    if (!sum) return 0;
    return Math.max(-1, Math.min(1, ((g || 0) - (r || 0)) / Math.max(sum, 12) * 3.2));
  }
  const pre = {};
  function preload() {
    ['dralingo-67-a.webp', 'dralingo-67-b.webp'].forEach((f) => { if (!pre[f]) { pre[f] = new Image(); pre[f].src = A + f; } });
  }

  // ---------- a gold coin (geometry: a disc with a square hole, like the old Chinese coins) ----------
  function coin(big) { const c = el('i', 'ssc' + (big ? ' big' : '')); c.setAttribute('aria-hidden', 'true'); return c; }

  // ---------- the balance ----------
  // host: a box (the balance fills it); o: { mini: true for the phone's top bar }
  function Balance(host, o) {
    o = o || {};
    const r = this.root = el('div', 'ssb' + (o.mini ? ' mini' : ''));
    r.setAttribute('aria-hidden', 'true');
    const base = el('div', 'ssb-base');
    const pillar = el('div', 'ssb-pillar');
    pillar.append(el('i', 'ssb-ring r1'), el('i', 'ssb-ring r2'));
    const beam = this.beam = el('div', 'ssb-beam');
    beam.appendChild(el('i', 'ssb-bar'));
    this.pans = {};
    this.stacks = {};
    ['red', 'gold'].forEach((t) => {
      const hang = el('div', 'ssb-hang ' + (t === 'red' ? 'l red' : 'r gold'));
      const ch = el('div', 'ssb-chains');
      ch.append(el('i', 'c1'), el('i', 'c2'));
      const pan = el('div', 'ssb-pan');
      const pile = el('div', 'ssb-pile');
      const st = [];
      for (let i = 0; i < (o.mini ? 3 : 7); i++) { const s = el('i', 'ssb-stack'); s.style.setProperty('--i', i); pile.appendChild(s); st.push(s); }
      pan.append(pile, el('i', 'ssb-dish'), el('i', 'ssb-flag'));
      hang.append(ch, pan);
      beam.appendChild(hang);
      this.pans[t] = pan;
      this.stacks[t] = st;
    });
    const boss = el('i', 'ssb-boss');
    const top = el('div', 'ssb-top');
    top.append(el('i', 'ssb-dome'), el('i', 'ssb-spire'));
    r.append(base, pillar, beam, boss, top);
    host.appendChild(r);
    this.k = 0;
    this.set(0, true);
  }
  // k: −1 … 1 (+ = Mar heavier). The beam rotates; the hangers rotate back so the pans hang straight.
  Balance.prototype.set = function (k, instant) {
    k = Math.max(-1, Math.min(1, Number(k) || 0));
    this.k = k;
    // a positive angle turns the beam clockwise: its right end (Mar) goes down; Fuego heavier = negative
    if (!this.rocking || instant) this.root.style.setProperty('--a', (k * MAX_DEG).toFixed(2) + 'deg');
    this.root.classList.toggle('still', !!instant || reduced());
    this.root.classList.toggle('lead-red', k < -0.04);
    this.root.classList.toggle('lead-gold', k > 0.04);
  };
  // the coin piles: each team's gold against the expected total E (0 … ~1.2)
  Balance.prototype.fill = function (red, gold, E) {
    const d = Math.max(20, E || 100);
    [['red', red], ['gold', gold]].forEach(([t, v]) => {
      const k = Math.max(0, Math.min(1.25, (v || 0) / d));
      const st = this.stacks[t];
      const n = st.length, mid = (n - 1) / 2;
      st.forEach((s, i) => {
        const shape = 1 - Math.abs(i - mid) / (mid + 1.2);       // a mound: the middle stacks are taller
        const h = v > 0 ? Math.max(0.12, Math.min(1, k * 1.15) * shape) : 0;
        s.style.setProperty('--h', h.toFixed(3));
      });
      this.pans[t].classList.toggle('empty', !(v > 0));
    });
  };
  // a pan jolts when coins land in it
  Balance.prototype.bump = function (team, big) {
    const p = this.pans[team];
    if (!p || reduced() || !p.animate) return;
    p.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${big ? 9 : 5}%)` }, { transform: 'translateY(0)' }],
      { duration: big ? 360 : 240, easing: 'cubic-bezier(.22,1,.36,1)' });
  };
  // where coins go: the top of a pan's pile, in page coordinates
  Balance.prototype.target = function (team) {
    const b = this.pans[team].getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height * 0.35 };
  };
  // the ceremony's weigh-in: the beam swings one way and the other, then settles where the gold says
  Balance.prototype.weigh = function (k, ms, done) {
    if (reduced() || !this.root.animate) { this.set(k, true); if (done) done(); return; }
    clearTimeout(this._w);
    // it leans the WRONG way first, then back and forth smaller and smaller, then settles (the suspense)
    const s = k > 0 ? 1 : k < 0 ? -1 : 1;
    const steps = [-0.6, 0.75, -0.45, 0.3, -0.15].map((x) => x * s).concat([k]);
    const per = Math.max(240, (ms || 3200) / steps.length);
    let i = 0;
    const go = () => {
      if (i >= steps.length) { if (done) done(); return; }
      this.root.classList.remove('still');
      this.root.style.setProperty('--sw', per + 'ms');
      this.set(steps[i], false);
      i++;
      this._w = setTimeout(go, per);
    };
    go();
  };

  // a «six seven» wave: the beam rocks like the two palms of the gesture (up, down, up…) and settles back where the gold
  // says. Interrupts itself (a new rock restarts from the beam's current place); reduced motion: no rock.
  Balance.prototype.rock = function (big) {
    if (reduced() || !this.root.animate) return;
    clearTimeout(this._r);
    const a = big ? 0.42 : 0.3;
    const offs = [-a, a * 0.85, -a * 0.55, a * 0.3, 0];
    let i = 0;
    this.rocking = true;
    const go = () => {
      if (i >= offs.length) { this.rocking = false; this.root.style.removeProperty('--sw'); this.set(this.k); return; }
      this.root.classList.remove('still');
      this.root.style.setProperty('--sw', '260ms');
      // around the CURRENT target (a meter update during the rock moves the centre, never undoes it)
      this.root.style.setProperty('--a', (Math.max(-1, Math.min(1, this.k + offs[i])) * MAX_DEG).toFixed(2) + 'deg');
      i++;
      this._r = setTimeout(go, 240);
    };
    go();
  };

  // ---------- flying coins (a pool of nodes on a fixed layer) ----------
  function Coins(layer, n) {
    this.layer = layer;
    this.pool = [];
    for (let i = 0; i < (n || 18); i++) {
      const c = el('i', 'ssc ssc-fly');
      c.setAttribute('aria-hidden', 'true');
      layer.appendChild(c);
      this.pool.push({ node: c, busy: false, anim: null });
    }
  }
  // fly(from, to, { size, ms, arc, delay, gold, onLand })
  Coins.prototype.fly = function (from, to, o) {
    o = o || {};
    if (reduced()) { if (o.onLand) setTimeout(o.onLand, 60 + (o.delay || 0)); return; }
    const slot = this.pool.find((s) => !s.busy) || this.pool[this.next = ((this.next || 0) + 1) % this.pool.length];
    if (slot.anim) { const land = slot.land; slot.land = null; slot.anim.onfinish = null; slot.anim.cancel(); if (land) land(); }
    slot.busy = true;
    slot.land = o.onLand || null;
    const c = slot.node;
    // the layer's box, read once (and again after a resize): no layout read per coin right after the last coin's writes
    if (!this._L || this._Lw !== root.innerWidth || this._Lh !== root.innerHeight) {
      this._L = this.layer.getBoundingClientRect(); this._Lw = root.innerWidth; this._Lh = root.innerHeight;
    }
    const L = this._L;
    const sz = o.size || 30;
    c.className = 'ssc ssc-fly' + (o.gold ? ' shine' : '');
    c.style.width = c.style.height = sz + 'px';
    c.style.left = (-sz / 2) + 'px';
    c.style.top = (-sz / 2) + 'px';
    const x1 = from.x - L.left, y1 = from.y - L.top, x2 = to.x - L.left, y2 = to.y - L.top;
    const arc = o.arc != null ? o.arc : Math.max(40, Math.abs(y2 - y1) * 0.35);
    const mx = (x1 + x2) / 2 + (o.drift || 0), my = Math.min(y1, y2) - arc;
    const spin = (Math.random() < 0.5 ? -1 : 1) * (200 + Math.random() * 220);
    slot.anim = c.animate([
      { transform: `translate(${x1}px,${y1}px) scale(.6) rotateY(0deg)`, opacity: 0 },
      { transform: `translate(${x1}px,${y1 - 6}px) scale(.9) rotateY(0deg)`, opacity: 1, offset: 0.08 },
      { transform: `translate(${mx}px,${my}px) scale(1.08) rotateY(${spin / 2}deg)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${x2}px,${y2}px) scale(.55) rotateY(${spin}deg)`, opacity: 0.9 },
    ], { duration: o.ms || 520, delay: o.delay || 0, easing: 'cubic-bezier(.33,0,.67,1)', fill: 'both' });
    slot.anim.onfinish = () => {
      slot.busy = false;
      c.style.opacity = '0';
      slot.anim.cancel();
      const land = slot.land;
      slot.land = null;
      if (land) land();
    };
  };
  // a fountain of coins from one point (a golden question, a landmark)
  Coins.prototype.burst = function (from, n, o) {
    o = o || {};
    if (reduced()) return;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const d = (o.spread || 120) * (0.5 + Math.random() * 0.6);
      this.fly(from, { x: from.x + Math.cos(a) * d, y: from.y + Math.sin(a) * d * 0.6 + (o.fall || 160) }, { size: o.size || 26, ms: o.ms || 700, delay: i * (o.stagger || 22), arc: 40 + Math.random() * 60, gold: i % 3 === 0 });
    }
  };

  // ---------- Dralingo doing the «6-7» (palm up, other palm up) ----------
  // A box with the two frames; .on swaps them on a beat (CSS steps). o: { say: text bubble, size }
  function dancer(o) {
    o = o || {};
    const d = el('div', 'ssd' + (o.cls ? ' ' + o.cls : ''));
    const a = el('img', 'ssd-a');
    a.alt = o.alt != null ? o.alt : 'Dralingo hace el seis-siete';
    a.draggable = false;
    a.src = A + 'dralingo-67-a.webp';
    a.width = 460; a.height = 520;
    const b = el('img', 'ssd-b');
    b.alt = '';
    b.draggable = false;
    b.src = A + 'dralingo-67-b.webp';
    b.width = 460; b.height = 520;
    d.append(a, b);
    if (o.say) d.appendChild(el('b', 'ssd-say', o.say));
    d.play = (on) => d.classList.toggle('on', on !== false && !reduced());
    if (o.on !== false) d.play(true);
    return d;
  }

  // ---------- a kid's swing (right answer) and wobble (wrong answer) ----------
  // fig: a MochiStage kid figure; side: 6 → leans left, 7 → leans right
  function swing(fig, side, big) {
    if (!fig || !fig._img || reduced() || !fig._img.animate) return;
    const s = side === 7 ? 1 : -1;
    fig._img.animate([
      { transform: 'translateY(0) rotate(0deg)' },
      { transform: `translateY(-9%) rotate(${s * (big ? 11 : 8)}deg) scale(1.05, .96)`, offset: 0.3 },
      { transform: `translateY(0) rotate(${-s * 5}deg)`, offset: 0.62 },
      { transform: `translateY(-3%) rotate(${s * 2}deg)`, offset: 0.82 },
      { transform: 'translateY(0) rotate(0deg)' },
    ], { duration: big ? 620 : 480, easing: 'cubic-bezier(.3,.7,.3,1)' });
  }
  // the two giant buttons ARE the two palms of the 6-7 gesture: on a right answer one goes down while the other goes
  // up, then they swap and settle (the side the kid tapped goes down first, like a weight). times: 1 = one swing,
  // 2 = the double swing of a «six seven». Transforms only (WAAPI), ~0.4 s, never blocks a tap.
  function palms(b6, b7, side, times) {
    if (!b6 || !b7 || reduced() || !b6.animate) return;
    const d = side === 7 ? -1 : 1;                       // 6 tapped: the 6 palm sinks first
    const amp = times >= 2 ? 13 : 9;
    const k = (s) => [
      { transform: 'translateY(0)' },
      { transform: `translateY(${s * amp}px) rotate(${s * 2}deg)`, offset: times >= 2 ? 0.16 : 0.28 },
      { transform: `translateY(${-s * amp * 0.8}px) rotate(${-s * 2}deg)`, offset: times >= 2 ? 0.36 : 0.62 },
    ].concat(times >= 2 ? [
      { transform: `translateY(${s * amp * 0.8}px) rotate(${s * 1.5}deg)`, offset: 0.58 },
      { transform: `translateY(${-s * amp * 0.5}px)`, offset: 0.8 },
    ] : []).concat([{ transform: 'translateY(0)' }]);
    const o = { duration: times >= 2 ? 760 : 420, easing: 'cubic-bezier(.37,0,.63,1)' };
    b6.animate(k(d), o);
    b7.animate(k(-d), o);
  }
  // the next sum swings in like a palm: the sum tips in from one side, the card rocks; alternating sides (6, 7, 6…)
  let wipeSide = 1;
  function wipe(card, eq) {
    if (!card || reduced() || !card.animate) return;
    wipeSide = -wipeSide;
    const s = wipeSide;
    if (eq) eq.animate([{ transform: `translate(${s * 26}px, 12px) rotate(${s * 9}deg)`, opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: 230, easing: 'cubic-bezier(.23,1,.32,1)' });
    card.animate([{ transform: `rotate(${s * 1.6}deg) translateY(4px)` }, { transform: `rotate(${-s * 0.6}deg)`, offset: 0.55 }, { transform: 'none' }],
      { duration: 300, easing: 'cubic-bezier(.37,0,.63,1)' });
  }
  const sumValue = (ss) => (!ss ? null : ss.op === '+' ? ss.a + ss.b : ss.a - ss.b);

  function wobble(node, strong) {
    if (!node || reduced() || !node.animate) return;
    const a = strong ? 9 : 6;
    node.animate([
      { transform: 'translateX(0) rotate(0deg)' }, { transform: `translateX(-${a}px) rotate(-4deg)` }, { transform: `translateX(${a}px) rotate(4deg)` },
      { transform: `translateX(-${a * 0.6}px) rotate(-2deg)` }, { transform: `translateX(${a * 0.4}px) rotate(1deg)` }, { transform: 'translateX(0) rotate(0deg)' },
    ], { duration: 460, easing: 'ease-out' });
  }

  // ---------- the sum, written for a kid (digits or pinyin words) ----------
  // q.ss = { a, b, op, zh } → a node: «3 + 4» or «san + si» (the operands are spans so the projector can colour them)
  function sum(info, cls) {
    const box = el('div', 'sss' + (info && info.zh ? ' zh' : ' num') + (cls ? ' ' + cls : ''));
    if (!info) return box;
    const w = (n) => (info.zh ? PINYIN[n] : String(n));
    box.append(el('span', 'sss-n', w(info.a)), el('span', 'sss-op', info.op === '+' ? '+' : '−'), el('span', 'sss-n', w(info.b)));
    box.setAttribute('translate', 'no');
    return box;
  }

  // ---------- a little rain cloud (the team that lost) ----------
  function cloud() {
    const box = el('div', 'ssf-cloud');
    box.setAttribute('aria-hidden', 'true');
    const ns = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 120 62');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', 'M22 54 Q6 54 6 41 Q6 28 21 28 Q22 13 39 13 Q48 3 62 8 Q75 1 86 13 Q104 13 105 30 Q116 32 116 43 Q116 54 101 54 Z');
    p.setAttribute('class', 'ssf-cloud-body');
    s.appendChild(p);
    box.appendChild(s);
    for (let i = 0; i < 6; i++) { const dr = el('i', 'ssf-drop'); dr.style.setProperty('--i', i); box.appendChild(dr); }
    return box;
  }
  // the crew's cloud comes down to just above the tallest head it rains on (a camel is short, Hamdan is tall): the
  // drawn top of each picture (object-fit contain, bottom-aligned) from the layout boxes, so entrance animations
  // don't move it; again when a picture loads
  function fitCloud(crew) {
    const c = crew && crew.querySelector(':scope > .ssf-cloud');
    if (!c) return;
    const fit = () => {
      if (!c.isConnected || !crew.clientHeight) return;
      let top = Infinity;
      crew.querySelectorAll(':scope > .mmk').forEach((f) => {
        const img = f.querySelector('.mmk-img');
        if (!img || !img.naturalWidth || !img.offsetHeight) return;
        const h = Math.min(img.offsetHeight, img.offsetWidth * img.naturalHeight / img.naturalWidth);
        top = Math.min(top, f.offsetTop + img.offsetTop + img.offsetHeight - h);
      });
      if (top === Infinity) return;
      c.style.bottom = Math.round(crew.clientHeight - top + c.offsetHeight * 0.45) + 'px';
    };
    crew.querySelectorAll('.mmk-img').forEach((img) => { if (!img.complete) img.addEventListener('load', fit, { once: true }); });
    requestAnimationFrame(fit);
  }

  root.SixSevenStage = { TEAM, PINYIN, MAX_DEG, tilt, Balance, Coins, coin, dancer, swing, wobble, palms, wipe, sumValue, cloud, fitCloud, sum, el, fmt, reduced, preload, kid: (o) => S().kidFigure(o) };
})(typeof window !== 'undefined' ? window : this);
