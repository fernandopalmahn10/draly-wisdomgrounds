// Piñata Tigre v2 — what the phone (js/player-pinata.js) and the projector (js/host-pinata.js) both draw:
//   · the tiger piñata: our glossy toy tiger (Higgsfield art, assets/pinata/tiger-*.webp: orange, golden; red bow =
//     Fuego, blue bow = Mar) hanging on its rope, swinging; cracks drawn over it as it loses life (4 stages: 75 / 50 /
//     25 % left, sagging at the end); a hit jolts it like a real piñata (a damped swing + squash); the burst cuts the
//     same picture into shards that fly apart while the candies rain, then the next, bigger tiger drops in
//   · candies drawn as geometry (wrapped candies in five flavours, swirl lollipops, the golden candy) flying in arcs
//     (WAAPI, transform + opacity only, a small pool of nodes so 30 phones keep their frames)
//   · the piñata stick (taped in the team colour) and the timing meter: flojo · bien · fuerte · dorado (crítico) ·
//     fuerte · bien · flojo, with the arrow that sweeps; the needle maths are the server's (core/pinata.js needle)
// Kids (full body, team outline), confetti, stars and number count-ups come from js/mochi-stage.js (MochiStage).
// window.PinataStage = { TEAM, tigerArt, Tiger, Candy, stick, Meter, needle, grade, preload, el, fmt, reduced }.
(function (root) {
  'use strict';
  const A = '/assets/pinata/';
  const MS = () => root.MochiStage;
  const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const LADDER = ['Museo del Futuro', 'Marco de Dubái', 'Burj Al Arab', 'Burj Khalifa'];   // the tigers' landmarks (core/pinata.js R.TIERS)
  const TEAM = {
    red: { name: 'Fuego', full: 'Equipo Fuego', color: '#d8382e' },
    gold: { name: 'Mar', full: 'Equipo Mar', color: '#2a6fdc' },
  };
  const HANG_X = 0.545;                 // the rope loop on the picture (fraction of its width), all four tigers
  const ASPECT = 681 / 592;             // height ÷ width of the pictures
  function el(tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('es-ES');
  const tigerArt = (team, tier) => A + 'tiger-' + ((tier || 0) >= 3 ? 'gold-' : '') + (team === 'red' ? 'red' : 'blue') + '.webp';
  const pre = {};
  function preload() {
    ['red', 'gold'].forEach((t) => [0, 3].forEach((i) => { const u = tigerArt(t, i); if (!pre[u]) { pre[u] = new Image(); pre[u].src = u; } }));
  }
  // bigger tigers up the ladder
  const tierScale = (i) => [0.84, 0.92, 0.98, 1.06][Math.min(3, i || 0)] + (i > 3 ? 0.03 : 0);

  // ---------- the meter's maths (the same as core/pinata.js) ----------
  function needle(phase, c, half) {
    const u = (((phase || 0) + Math.max(0, c) / (half || 900)) % 2 + 2) % 2;
    return u <= 1 ? u : 2 - u;
  }
  function grade(pos, z) {
    const d = Math.abs(pos - 0.5);
    if (d <= z.crit) return 'crit';
    if (d <= z.strong) return 'strong';
    if (d <= z.good) return 'good';
    return 'weak';
  }

  // ---------- cracks (geometry over the body of the picture, viewBox 100 × 100) ----------
  const CRACKS = [
    'M36 48 L41 54 L38 60 L44 66',
    'M58 70 L54 64 L60 58 L57 52',
    'M26 62 L32 66 L29 72 L35 78',
    'M66 46 L61 51 L66 56 L62 62 L66 68',
    'M45 74 L50 79 L46 84',
    'M30 40 L36 44 L33 50',
    'M50 40 L46 46 L52 50 L49 57 L54 62',
  ];
  const STAGE_CRACKS = [0, 2, 4, 7];
  // the shards of the burst: polygons that cover the whole picture
  const SHARDS = [
    '0% 0%, 45% 0%, 40% 30%, 0% 38%',
    '45% 0%, 100% 0%, 100% 34%, 62% 30%, 40% 30%',
    '0% 38%, 40% 30%, 52% 58%, 0% 66%',
    '40% 30%, 62% 30%, 100% 34%, 100% 60%, 52% 58%',
    '0% 66%, 52% 58%, 46% 100%, 0% 100%',
    '52% 58%, 100% 60%, 100% 100%, 46% 100%',
  ];

  // ---------- the tiger on its rope ----------
  // host: a positioned box (the rope hangs from its top centre). o: { team, tier, mirror, idle (sway) }
  function Tiger(host, o) {
    this.team = o.team;
    this.tier = -1;
    this.mirror = !!o.mirror;
    this.stage = 0;
    const r = this.root = el('div', 'ptg ptg-' + (o.team === 'red' ? 'red' : 'gold') + (o.mirror ? ' mirror' : '') + (o.idle === false ? '' : ' idle'));
    this.swing = el('div', 'ptg-swing');
    this.rope = el('i', 'ptg-rope');
    this.kick = el('div', 'ptg-kick');
    this.body = el('div', 'ptg-body');
    this.sag = el('div', 'ptg-sag');
    this.img = el('img', 'ptg-img');
    this.img.alt = TEAM[o.team].full + ': su piñata de tigre';
    this.img.draggable = false;
    const ns = 'http://www.w3.org/2000/svg';
    this.svg = document.createElementNS(ns, 'svg');
    this.svg.setAttribute('viewBox', '0 0 100 100');
    this.svg.setAttribute('preserveAspectRatio', 'none');
    this.svg.setAttribute('class', 'ptg-cracks');
    this.svg.setAttribute('aria-hidden', 'true');
    this.paths = CRACKS.map((d) => {
      const g = document.createElementNS(ns, 'g');
      const a = document.createElementNS(ns, 'path');
      a.setAttribute('d', d);
      a.setAttribute('class', 'ptg-crack-lo');
      const b = document.createElementNS(ns, 'path');
      b.setAttribute('d', d);
      b.setAttribute('class', 'ptg-crack');
      g.append(a, b);
      g.style.opacity = '0';
      this.svg.appendChild(g);
      return g;
    });
    this.sag.append(this.img, this.svg);
    this.body.appendChild(this.sag);
    this.kick.append(this.rope, this.body);
    this.swing.appendChild(this.kick);
    r.appendChild(this.swing);
    host.appendChild(r);
    this.setTier(o.tier || 0, false);
  }
  Tiger.prototype.setTier = function (i, drop) {
    i = Math.max(0, i | 0);
    const changed = i !== this.tier;
    this.tier = i;
    const u = tigerArt(this.team, i);
    if (this.img.getAttribute('src') !== u) this.img.src = u;
    this.root.style.setProperty('--ts', tierScale(i).toFixed(3));
    this.root.classList.toggle('golden', i >= 3);
    this.img.style.opacity = '';
    this.rope.style.opacity = '';
    if (changed) this.setLife(1, 1);
    if (drop && !reduced() && this.body.animate) {
      this.body.animate([
        { transform: 'translateY(-140%)', opacity: 0 },
        { transform: 'translateY(6%)', opacity: 1, offset: 0.7 },
        { transform: 'translateY(-2%)', offset: 0.85 },
        { transform: 'translateY(0)' },
      ], { duration: 650, easing: 'cubic-bezier(.22,1,.36,1)' });
    }
  };
  // life left / total → the crack stage (the tiger sags and wobbles in its last quarter)
  Tiger.prototype.setLife = function (left, total) {
    const k = total > 0 ? left / total : 1;
    const s = k > 0.75 ? 0 : k > 0.5 ? 1 : k > 0.25 ? 2 : 3;
    if (s === this.stage && this._painted) return;
    const grew = s > this.stage;
    this.stage = s;
    this._painted = true;
    this.paths.forEach((g, n) => {
      const on = n < STAGE_CRACKS[s];
      g.style.opacity = on ? '1' : '0';
      if (on && grew && n >= STAGE_CRACKS[s - 1] && !reduced() && g.animate) g.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
    });
    this.root.classList.toggle('sag', s === 3);
  };
  // a hit: the tiger is knocked away from the stick and swings back (a damped swing) and squashes
  Tiger.prototype.jolt = function (power, crit) {
    if (reduced() || !this.kick.animate) return;
    const dir = this.mirror ? -1 : 1;
    const a = Math.min(this.maxKick || 20, 6 + (power || 1) * 1.8) * dir;
    if (this._kick) this._kick.cancel();
    this._kick = this.kick.animate([
      { transform: 'rotate(0deg)' },
      { transform: `rotate(${a}deg)`, offset: 0.16 },
      { transform: `rotate(${-a * 0.55}deg)`, offset: 0.42 },
      { transform: `rotate(${a * 0.28}deg)`, offset: 0.66 },
      { transform: `rotate(${-a * 0.1}deg)`, offset: 0.84 },
      { transform: 'rotate(0deg)' },
    ], { duration: crit ? 1150 : 900, easing: 'ease-out' });
    if (this._sq) this._sq.cancel();
    const q = crit ? 0.12 : 0.06;
    this._sq = this.img.animate([
      { transform: `scale(${1 + q}, ${1 - q})` },
      { transform: `scale(${1 - q / 2}, ${1 + q / 2})`, offset: 0.4 },
      { transform: 'scale(1, 1)' },
    ], { duration: crit ? 360 : 260, easing: 'cubic-bezier(.22,1,.36,1)' });
    this.img.classList.remove('flash');
    void this.img.offsetWidth;
    this.img.classList.add('flash');
  };
  // where the stick lands (page coordinates): the side the tiger faces (where the kid stands)
  Tiger.prototype.impact = function () {
    const b = this.img.getBoundingClientRect();
    return { x: b.left + b.width * (this.mirror ? 0.3 : 0.7), y: b.top + b.height * 0.62 };
  };
  Tiger.prototype.center = function () {
    const b = this.img.getBoundingClientRect();
    return { x: b.left + b.width * 0.5, y: b.top + b.height * 0.58, w: b.width, h: b.height };
  };
  // the burst: shards of the same picture fly apart in `layer` (a fixed full-screen layer); the tiger hides until setTier
  Tiger.prototype.burst = function (layer) {
    const b = this.img.getBoundingClientRect();
    this.img.style.opacity = '0';
    this.rope.style.opacity = '0';                // the rope goes with it (setTier brings both back)
    this.paths.forEach((g) => { g.style.opacity = '0'; });
    if (reduced() || !layer || !b.width) return;
    const L = layer.getBoundingClientRect();
    const src = this.img.getAttribute('src');
    SHARDS.forEach((poly, i) => {
      const s = el('div', 'ptg-shard');
      s.style.left = (b.left - L.left) + 'px';
      s.style.top = (b.top - L.top) + 'px';
      s.style.width = b.width + 'px';
      s.style.height = b.height + 'px';
      const im = el('img');
      im.src = src;
      im.alt = '';
      im.style.clipPath = `polygon(${poly})`;
      if (this.mirror) im.style.transform = 'scaleX(-1)';
      s.appendChild(im);
      layer.appendChild(s);
      const col = i % 2 === 0 ? -1 : 1;
      const dx = col * (40 + Math.random() * 90) * (b.width / 260);
      const up = -(30 + Math.random() * 60) * (b.height / 300);
      const fall = (220 + Math.random() * 200) * (b.height / 300);
      const rot = col * (25 + Math.random() * 80);
      const an = s.animate([
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx * 0.55}px, ${up}px) rotate(${rot * 0.5}deg)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${dx}px, ${fall}px) rotate(${rot}deg)`, opacity: 0 },
      ], { duration: 1100 + Math.random() * 300, easing: 'cubic-bezier(.3,.1,.6,1)', fill: 'forwards' });
      an.onfinish = () => s.remove();
    });
  };

  // ---------- candies ----------
  const FLAVOURS = 5;
  function candyNode() {
    const c = el('i', 'ptc');
    c.setAttribute('aria-hidden', 'true');
    return c;
  }
  // paint one candy: kind w (wrapped) / l (lollipop), a flavour 0-4 or gold
  function paintCandy(c, gold) {
    const lolly = Math.random() < 0.3;
    c.className = 'ptc ' + (lolly ? 'ptc-l' : 'ptc-w') + (gold ? ' gold' : ' c' + Math.floor(Math.random() * FLAVOURS));
  }
  // a fixed layer with a pool of candy nodes
  function Candy(layer, n) {
    this.layer = layer;
    this.pool = [];
    for (let i = 0; i < (n || 24); i++) {
      const c = candyNode();
      c.style.opacity = '0';
      layer.appendChild(c);
      this.pool.push({ node: c, busy: false, anim: null });
    }
  }
  Candy.prototype.slot = function () {
    const s = this.pool.find((x) => !x.busy) || this.pool[Math.floor(Math.random() * this.pool.length)];
    if (s.anim) s.anim.cancel();
    s.busy = true;
    return s;
  };
  // candies burst out of `from` and fall (count, spread px, gold: one golden candy among them)
  Candy.prototype.spill = function (from, count, o) {
    o = o || {};
    if (reduced()) return;
    const L = this.layer.getBoundingClientRect();
    const spread = o.spread || 160;
    for (let i = 0; i < count; i++) {
      const s = this.slot();
      const c = s.node;
      paintCandy(c, o.gold && i === 0);
      const sz = (o.size || 26) * (0.8 + Math.random() * 0.45);
      c.style.width = sz + 'px';
      c.style.height = sz + 'px';
      c.style.left = (-sz / 2) + 'px';
      c.style.top = (-sz / 2) + 'px';
      const x = from.x - L.left, y = from.y - L.top;
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.15;
      const pow = 0.45 + Math.random() * 0.55;
      const dx = Math.cos(ang) * spread * pow, up = Math.sin(ang) * spread * 0.9 * pow;
      const fall = (o.fall || 360) * (0.7 + Math.random() * 0.5);
      const rot = (Math.random() - 0.5) * 900;
      s.anim = c.animate([
        { transform: `translate(${x}px, ${y}px) scale(.6) rotate(0deg)`, opacity: 1 },
        { transform: `translate(${x + dx * 0.6}px, ${y + up}px) scale(1) rotate(${rot * 0.4}deg)`, opacity: 1, offset: 0.32 },
        { transform: `translate(${x + dx}px, ${y + fall}px) scale(.9) rotate(${rot}deg)`, opacity: 0 },
      ], { duration: (o.ms || 1100) + Math.random() * 400, delay: (o.stagger || 0) * i, easing: 'cubic-bezier(.33,0,.6,1)', fill: 'both' });
      s.anim.onfinish = () => { s.busy = false; c.style.opacity = '0'; s.anim.cancel(); s.anim = null; };
    }
  };
  // one candy flies in an arc to a target (my counter) and calls onLand
  Candy.prototype.fly = function (from, to, o) {
    o = o || {};
    if (reduced()) { if (o.onLand) setTimeout(o.onLand, 60); return; }
    const L = this.layer.getBoundingClientRect();
    const s = this.slot();
    const c = s.node;
    paintCandy(c, o.gold);
    const sz = o.size || 26;
    c.style.width = sz + 'px';
    c.style.height = sz + 'px';
    c.style.left = (-sz / 2) + 'px';
    c.style.top = (-sz / 2) + 'px';
    const x1 = from.x - L.left, y1 = from.y - L.top, x2 = to.x - L.left, y2 = to.y - L.top;
    const mx = (x1 + x2) / 2 + (o.drift || 0), my = Math.min(y1, y2) - (o.arc || 80);
    s.anim = c.animate([
      { transform: `translate(${x1}px, ${y1}px) scale(.7) rotate(0deg)`, opacity: 1 },
      { transform: `translate(${mx}px, ${my}px) scale(1.05) rotate(200deg)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${x2}px, ${y2}px) scale(.5) rotate(420deg)`, opacity: 0.9 },
    ], { duration: o.ms || 520, delay: o.delay || 0, easing: 'cubic-bezier(.33,0,.67,1)', fill: 'both' });
    s.anim.onfinish = () => { s.busy = false; c.style.opacity = '0'; s.anim.cancel(); s.anim = null; if (o.onLand) o.onLand(); };
  };
  // a still candy (for cards and jars)
  function candy(gold, kind) {
    const c = candyNode();
    c.className = 'ptc ' + (kind === 'l' ? 'ptc-l' : 'ptc-w') + (gold ? ' gold' : ' c' + Math.floor(Math.random() * FLAVOURS));
    return c;
  }

  // ---------- the piñata stick (taped in the team colour, ribbons at the tip) ----------
  function stick(team) {
    const s = el('i', 'pts pts-' + (team === 'red' ? 'red' : 'gold'));
    s.setAttribute('aria-hidden', 'true');
    s.append(el('i', 'pts-shaft'), el('i', 'pts-grip'), el('i', 'pts-rib r1'), el('i', 'pts-rib r2'));
    return s;
  }

  // ---------- the meter ----------
  // host: a box; draws the zones (flojo · bien · fuerte · dorado · fuerte · bien · flojo) and the arrow
  function Meter(host) {
    this.root = el('div', 'ptm');
    this.bar = el('div', 'ptm-bar');
    this.gold = el('div', 'ptm-gold');
    this.gold.appendChild(MS() ? MS().starSvg() : el('i'));
    this.bar.appendChild(this.gold);
    this.needle = el('i', 'ptm-needle');
    this.needle.setAttribute('aria-hidden', 'true');
    this.root.append(this.bar, this.needle);
    this.root.setAttribute('aria-hidden', 'true');
    host.appendChild(this.root);
    this.z = { crit: 0.075, strong: 0.2, good: 0.34 };
    this.w = 0;
  }
  Meter.prototype.zones = function (z) {
    this.z = z;
    const c = 50 - z.crit * 100, s = 50 - z.strong * 100, g = 50 - z.good * 100;
    const stops = [
      ['var(--ptm-weak)', 0, g], ['var(--ptm-good)', g, s], ['var(--ptm-strong)', s, c], ['var(--ptm-crit)', c, 100 - c],
      ['var(--ptm-strong)', 100 - c, 100 - s], ['var(--ptm-good)', 100 - s, 100 - g], ['var(--ptm-weak)', 100 - g, 100],
    ].map(([col, a, b]) => `${col} ${a.toFixed(2)}% ${b.toFixed(2)}%`).join(', ');
    this.bar.style.background = `linear-gradient(90deg, ${stops})`;
    this.gold.style.left = c.toFixed(2) + '%';
    this.gold.style.width = (z.crit * 200).toFixed(2) + '%';
    this.root.classList.remove('stop', 'g-crit', 'g-strong', 'g-good', 'g-weak', 'g-auto');
    this.measure();
  };
  Meter.prototype.measure = function () { this.w = this.bar.getBoundingClientRect().width || this.w; };
  Meter.prototype.at = function (pos) {
    if (!this.w) this.measure();
    this.needle.style.transform = `translateX(${(pos * this.w).toFixed(1)}px)`;
  };
  // the tap: the arrow stops, the zone it stopped in lights up
  Meter.prototype.stop = function (pos, g) {
    if (pos != null) this.at(pos);
    this.root.classList.add('stop', 'g-' + g);
  };

  // ---------- the little rain cloud over the team that lost (geometry) ----------
  function cloud() {
    const box = el('div', 'ptf-cloud');
    box.setAttribute('aria-hidden', 'true');
    const ns = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 120 62');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', 'M22 54 Q6 54 6 41 Q6 28 21 28 Q22 13 39 13 Q48 3 62 8 Q75 1 86 13 Q104 13 105 30 Q116 32 116 43 Q116 54 101 54 Z');
    p.setAttribute('class', 'ptf-cloud-body');
    const sh = document.createElementNS(ns, 'path');
    sh.setAttribute('d', 'M14 46 Q30 52 60 50 Q90 52 108 45');
    sh.setAttribute('class', 'ptf-cloud-shade');
    s.append(p, sh);
    box.appendChild(s);
    for (let i = 0; i < 6; i++) { const dr = el('i', 'ptf-drop'); dr.style.setProperty('--i', i); box.appendChild(dr); }
    return box;
  }

  // ---------- party flags and lights across the top (geometry: two drooping strings) ----------
  const FLAG_COLS = ['#d8382e', '#ffc93c', '#2a6fdc', '#fff7e3', '#ff8a1f'];
  // drawn at the box's real pixel size (no stretched flags); built when the box is on screen
  function bunting(host) {
    if (!host) return;
    const r = host.getBoundingClientRect();
    const W = Math.round(r.width || root.innerWidth || 1600), Hh = Math.round(r.height || 90);
    if (!W || (host._w === W && host.firstChild)) return;
    host._w = W;
    host.innerHTML = '';
    const ns = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', `0 0 ${W} ${Hh}`);
    const mk = (tag, attrs) => { const e = document.createElementNS(ns, tag); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); return e; };
    // two strings, each sagging between three posts
    [[0, W / 2], [W / 2, W]].forEach(([a, b]) => {
      const mid = (a + b) / 2, sag = Math.max(14, Hh * 0.5 - 18);
      s.appendChild(mk('path', { d: `M${a} 4 Q${mid} ${4 + sag * 2} ${b} 4`, class: 'str' }));
      const k = Math.max(5, Math.round((b - a) / 56));
      for (let i = 1; i < k; i++) {
        const t = i / k;
        const x = (1 - t) * (1 - t) * a + 2 * (1 - t) * t * mid + t * t * b;
        const y = (1 - t) * (1 - t) * 4 + 2 * (1 - t) * t * (4 + sag * 2) + t * t * 4;
        if (i % 2) s.appendChild(mk('path', { d: `M${x - 13} ${y} L${x + 13} ${y} L${x} ${y + 30} Z`, class: 'flag', fill: FLAG_COLS[(i + (a ? 2 : 0)) % FLAG_COLS.length] }));
        else { s.appendChild(mk('circle', { cx: x, cy: y + 9, r: 11, class: 'glow' })); s.appendChild(mk('circle', { cx: x, cy: y + 8, r: 5.5, class: 'bulb' })); }
      }
    });
    host.appendChild(s);
  }

  root.PinataStage = { TEAM, LADDER, HANG_X, ASPECT, tigerArt, tierScale, preload, Tiger, Candy, candy, stick, Meter, needle, grade, cloud, bunting, el, fmt, reduced };
})(typeof window !== 'undefined' ? window : this);
