// Mochi Mash v2 — what the phone (js/player-mochi.js) and the projector (js/host-mochi.js) both draw:
//   · the Dragoncitos: Fuego's red baby dragon and Mar's blue one (the keffiyeh Dralingo stickers of Reinos, the
//     "Bebé Dralingo" of his evolution line), with poses for hungry / eating / happy / worried / champion / dance
//   · a kid as their FULL-BODY saga character (js/halcon-board.js art) with a sticker outline in the team colour
//   · mochis drawn as geometry (four flavours + the golden one) flying in an arc into a dragoncito's mouth (WAAPI,
//     transform + opacity only, a small pool of nodes so 30 phones keep their frames)
//   · confetti in a team colour, a star badge (SVG geometry), number count-ups
// window.MochiStage = { TEAM, dragonArt, kidArt, kidFigure, Dragon, Flyer, confetti, starSvg, countUp, fmt, reduced }.
(function (root) {
  'use strict';
  const K = '/assets/kingdoms/dralingo/';
  const HB = () => root.HalconBoard;
  const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const TEAM = {
    red: { name: 'Fuego', full: 'Equipo Fuego', color: '#d8382e', deep: '#b8221a', soft: '#ffd2cc' },
    gold: { name: 'Mar', full: 'Equipo Mar', color: '#2a6fdc', deep: '#1a4fb0', soft: '#cfe0ff' },
  };
  // pose → sticker (the red team's dragoncito is the `-red` recolour of the same pose)
  const POSE = { hungry: 'pointing', eat: 'laugh', happy: 'jump', worried: 'shocked', win: 'champion', dance: 'dance4', think: 'thinking' };
  function dragonArt(team, pose) {
    const f = POSE[pose] || POSE.hungry;
    return K + f + (team === 'red' ? '-red' : '') + '.webp';
  }
  const pre = {};
  function preloadDragons() {
    ['red', 'gold'].forEach((t) => Object.keys(POSE).forEach((p) => {
      const u = dragonArt(t, p);
      if (!pre[u]) { pre[u] = new Image(); pre[u].src = u; }
    }));
  }
  // a kid's full-body art: idle (ready) · ok (victory) · no (sad)
  const kidArt = (skin, pose) => (HB() ? HB().art(skin, pose || 'idle') : '/assets/dralingo/hello.webp');
  const skinFor = (avatar, name) => (HB() ? HB().skinFor(avatar, name) : 'dralingo');
  const isAnimal = (skin) => !!(HB() && HB().isAnimal && HB().isAnimal(skin));
  function el(tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('es-ES');

  // ---------- a kid: full body, team-colour sticker outline, a disc at the feet, a name tag ----------
  // o: { team, skin, name, me, pose, tag (false: no tag) }
  function kidFigure(o) {
    const f = el('div', 'mmk mmk-' + (o.team === 'red' ? 'red' : 'gold') + (o.me ? ' me' : '') + (isAnimal(o.skin) ? ' animal' : ''));
    const disc = el('i', 'mmk-disc');
    const img = el('img', 'mmk-img');
    img.alt = o.name || '';
    img.draggable = false;
    img.src = kidArt(o.skin, o.pose);
    f.append(disc, img);
    if (o.tag !== false) {
      const tag = el('div', 'mmk-tag');
      tag.appendChild(el('b', null, o.name || ''));
      if (o.me) tag.appendChild(el('em', null, 'TÚ'));
      f.appendChild(tag);
    }
    f._img = img;
    f._skin = o.skin;
    f.pose = (p) => { const u = kidArt(o.skin, p); if (img.getAttribute('src') !== u) img.src = u; };
    return f;
  }

  // ---------- a Dragoncito on its plate ----------
  // host: a box; o: { team, size: 0..1 start, label }
  function Dragon(host, o) {
    this.team = o.team;
    this.pose = 'hungry';
    const r = this.root = el('div', 'mmd mmd-' + (o.team === 'red' ? 'red' : 'gold'));
    this.plate = el('div', 'mmd-plate');
    this.plate.append(el('i', 'mmd-rim'), el('i', 'mmd-glow'));
    this.body = el('div', 'mmd-body');          // scaled by growth
    this.bump = el('div', 'mmd-bump');          // the chomp squash (WAAPI)
    this.img = el('img', 'mmd-img');
    this.img.alt = TEAM[o.team].full + ': su dragoncito';
    this.img.draggable = false;
    this.img.src = dragonArt(o.team, 'hungry');
    this.bump.appendChild(this.img);
    this.body.appendChild(this.bump);
    r.append(this.plate, this.body);
    host.appendChild(r);
    this.size = -1;
    this.grow(o.size || 0, true);
  }
  // 0..1 (more than 1 = a little bigger still): the dragoncito's scale on its plate
  Dragon.prototype.grow = function (k, instant) {
    const s = 0.62 + 0.42 * Math.pow(Math.max(0, Math.min(1.25, k)), 0.75);
    if (Math.abs(s - this.size) < 0.004) return;
    this.size = s;
    this.body.style.transition = instant || reduced() ? 'none' : 'transform .6s cubic-bezier(.22,1,.36,1)';
    this.body.style.transform = 'scale(' + s.toFixed(3) + ')';
  };
  Dragon.prototype.setPose = function (p) {
    if (this.pose === p) return;
    this.pose = p;
    this.img.src = dragonArt(this.team, p);
  };
  // a mochi landed: a quick squash and the eating pose for a moment
  Dragon.prototype.chomp = function (big) {
    clearTimeout(this._eatT);
    if (this.pose !== 'win' && this.pose !== 'dance') this.setPose('eat');
    this._eatT = setTimeout(() => { if (this.pose === 'eat') this.setPose(this._rest || 'hungry'); }, 420);
    if (reduced() || !this.bump.animate) return;
    if (this._anim) this._anim.cancel();
    const a = big ? 1.12 : 1.05;
    this._anim = this.bump.animate([
      { transform: 'scale(1,1)' },
      { transform: 'scale(' + (a + 0.03) + ',' + (2 - a - 0.04) + ')', offset: 0.35 },
      { transform: 'scale(1,1)' },
    ], { duration: big ? 320 : 170, easing: 'cubic-bezier(.22,1,.36,1)' });
  };
  // the pose it goes back to after eating (hungry / happy when leading / worried when behind)
  Dragon.prototype.rest = function (p) { this._rest = p; if (this.pose !== 'eat' && this.pose !== 'win' && this.pose !== 'dance') this.setPose(p); };
  // where mochis go: the mouth, in page coordinates
  Dragon.prototype.mouth = function () {
    const b = this.img.getBoundingClientRect();
    return { x: b.left + b.width * 0.5, y: b.top + b.height * 0.36 };
  };

  // ---------- flying mochis ----------
  // A fixed layer with a pool of nodes. fly(from, to, { gold, flavour, ms, arc, size, onLand })
  function Flyer(layer, n) {
    this.layer = layer;
    this.pool = [];
    for (let i = 0; i < (n || 16); i++) {
      const m = el('i', 'mm-mochi mm-fly');
      m.setAttribute('aria-hidden', 'true');
      layer.appendChild(m);
      this.pool.push({ node: m, busy: false, anim: null });
    }
  }
  Flyer.prototype.fly = function (from, to, o) {
    o = o || {};
    if (reduced()) { if (o.onLand) setTimeout(o.onLand, 60); return; }
    const slot = this.pool.find((s) => !s.busy) || this.pool[0];
    if (slot.anim) slot.anim.cancel();
    slot.busy = true;
    const m = slot.node;
    const L = this.layer.getBoundingClientRect();
    const sz = o.size || 34;
    m.className = 'mm-mochi mm-fly f' + (o.flavour != null ? o.flavour : Math.floor(Math.random() * 4)) + (o.gold ? ' gold' : '');
    m.style.width = sz + 'px';
    m.style.height = Math.round(sz * 0.86) + 'px';
    m.style.left = (-sz / 2) + 'px';
    m.style.top = (-sz * 0.43) + 'px';
    const x1 = from.x - L.left, y1 = from.y - L.top, x2 = to.x - L.left, y2 = to.y - L.top;
    const arc = o.arc != null ? o.arc : Math.max(40, Math.abs(y2 - y1) * 0.45);
    const mx = (x1 + x2) / 2 + (o.drift || 0), my = Math.min(y1, y2) - arc;
    const spin = (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 160);
    slot.anim = m.animate([
      { transform: `translate(${x1}px,${y1}px) scale(.7) rotate(0deg)`, opacity: 1 },
      { transform: `translate(${mx}px,${my}px) scale(1.05) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${x2}px,${y2}px) scale(.45) rotate(${spin}deg)`, opacity: 0.85 },
    ], { duration: o.ms || 380, easing: 'cubic-bezier(.33,0,.67,1)', fill: 'forwards' });
    slot.anim.onfinish = () => {
      slot.busy = false;
      m.style.opacity = '0';
      slot.anim.cancel();
      if (o.onLand) o.onLand();
    };
  };

  // ---------- confetti in a team colour (or both) ----------
  function confetti(host, team, n) {
    if (reduced()) return;
    const cols = team === 'red' ? ['#f0443a', '#ff8a7a', '#ffc93c', '#fff7e3'] : team === 'gold' ? ['#2f7bea', '#7fb0ff', '#ffc93c', '#fff7e3'] : ['#f0443a', '#2f7bea', '#ffc93c', '#fff7e3'];
    for (let i = 0; i < (n || 30); i++) {
      const c = el('i', 'mm-confetti');
      c.style.setProperty('--x', (4 + Math.random() * 92) + '%');
      c.style.setProperty('--d', (Math.random() * 0.8).toFixed(2) + 's');
      c.style.setProperty('--r', Math.round(Math.random() * 360) + 'deg');
      c.style.setProperty('--dx', Math.round((Math.random() - 0.5) * 120) + 'px');
      c.style.background = cols[i % cols.length];
      host.appendChild(c);
      setTimeout(() => c.remove(), 3600);
    }
  }
  // a five-point star (geometry) with an optional number
  function starSvg(cls) {
    const ns = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 100 100');
    s.setAttribute('class', 'mm-star' + (cls ? ' ' + cls : ''));
    s.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', 'M50 5 L62.5 36 L96 38.5 L70 60 L78.5 93 L50 74.5 L21.5 93 L30 60 L4 38.5 L37.5 36 Z');
    s.appendChild(p);
    return s;
  }
  // a number that counts up (ease-out) into an element
  function countUp(node, from, to, ms, done) {
    if (reduced() || !(ms > 0)) { node.textContent = fmt(to); if (done) done(); return; }
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      node.textContent = fmt(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step); else if (done) done();
    };
    requestAnimationFrame(step);
  }
  // growth of a team's dragoncito from its total and the expected total E
  const growth = (total, E) => (E > 0 ? total / E : 0);

  root.MochiStage = { TEAM, POSE, dragonArt, preloadDragons, kidArt, skinFor, isAnimal, kidFigure, Dragon, Flyer, confetti, starSvg, countUp, fmt, growth, reduced, el };
})(typeof window !== 'undefined' ? window : this);
