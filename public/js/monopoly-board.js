// Dàfùwēng · Monopolio v2 «El Gran Tablero de Dubái» — the board as both screens draw it (the phone: js/player-monopoly.js,
// the projector: js/host-monopoly.js). One luxury game board on a table in a Dubai penthouse at night: the sea and the
// beach on the left, the Creek with its abras along the top, downtown on the right, the desert along the bottom, a gold
// plaque in the middle; a sandstone road through 24 glossy spaces (Mario Party colours), the 5 landmarks standing on their
// spaces (the Reinos art), Dralingo in his platform look next to the star, and every kid as a FULL-BODY piece with a ring
// and a sticker outline in its seat colour. The geometry and the spaces come from js/monopoly-map.js (the server's too).
//   new MonoBoard.Board(host, { mode: 'phone' | 'tile', me: k, tags: true })
//     .setSeats([{ k, name, skin, c, pos, coins, stars, on }]) · .setOwners({ lm: { k, lvl } }) · .setStar(pos, fly)
//     .hop(k, path) / .jump(k, to) → Promise (a queue per piece; transform + opacity only) · .focus(k, ms) / .view(cy)
//     .pop(space, text, cls) · .flash(space, cls) · .screenXY(x, y) · .fit() · .destroy()
//   MonoBoard.figure({ skin, c, name, me, pose }) · .coin() · .star() · .dice() · .colorOf(c) · .lmArt(id)
// Motion: WAAPI on transforms only, pieces and the camera are their own layers; prefers-reduced-motion = no hops, no pan.
(function (root) {
  'use strict';
  const MAP = root.MonoMap;
  const HB = () => root.HalconBoard;
  const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const LM = '/assets/kingdoms/landmarks/big/';
  const DRALINGO = '/assets/dralingo/power.webp';
  const STEP_ARC = 34;                // how high a hop goes (map units)
  const PIECE_H = 118;                // a piece's height on the board (map units; animals a little lower)
  const FRAME = 12;                   // the board's gold frame (css .mnb-map border): map units start inside it
  const RING = 14;                    // …and the rings drawn around it (box-shadow)
  const ns = 'http://www.w3.org/2000/svg';
  function el(tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('es-ES');
  // a seat colour; no seat yet (the lobby) = neutral gold
  const NEUTRAL = { id: 'gold', name: 'Oro', c: '#ffc93c', d: '#c98a26', s: '#fff3c4' };
  const colorOf = (c) => (c == null || c < 0 ? NEUTRAL : MAP.COLORS[c] || MAP.COLORS[0]);
  const art = (skin, pose) => (HB() ? HB().art(skin, pose || 'idle') : '/assets/dralingo/hello.webp');
  const isAnimal = (skin) => !!(HB() && HB().skinOk && ['camel', 'plane', 'falcon', 'oryx'].includes(skin));
  const skinFor = (avatar, name) => (HB() ? HB().skinFor(avatar, name) : 'dralingo');
  const lmArt = (id) => LM + id + '.webp';
  const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
  const T = MAP.T;

  // ---------- small drawings (geometry: crisp at any size, no emoji) ----------
  function svg(cls, viewBox, inner) {
    const s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', viewBox);
    s.setAttribute('class', cls);
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = inner;
    return s;
  }
  const STAR_D = 'M50 5 L62.5 36 L96 38.5 L70 60 L78.5 93 L50 74.5 L21.5 93 L30 60 L4 38.5 L37.5 36 Z';
  const star = (cls) => svg('mn-star' + (cls ? ' ' + cls : ''), '0 0 100 100', `<path d="${STAR_D}"/>`);
  // an old Chinese coin: a gold disc with a square hole (the same coin as 6-7 Swing's gold)
  const coin = (cls) => svg('mn-coin' + (cls ? ' ' + cls : ''), '0 0 100 100',
    '<circle cx="50" cy="50" r="44"/><circle class="in" cx="50" cy="50" r="31"/><rect x="40" y="40" width="20" height="20" rx="3"/>');
  // the dice block (Mario Party): a cube that spins numbers until the tap
  function dice(cls) {
    const d = el('div', 'mn-dice' + (cls ? ' ' + cls : ''));
    d.append(el('i', 'mn-dice-top'), el('i', 'mn-dice-side'));
    const face = el('b', 'mn-dice-face', '?');
    d.appendChild(face);
    d._face = face;
    return d;
  }
  // a full-body piece: the saga character with the seat colour as a sticker outline and a ring at its feet
  function figure(o) {
    const col = colorOf(o.c);
    const f = el('div', 'mnf' + (o.me ? ' me' : '') + (isAnimal(o.skin) ? ' animal' : ''));
    f.style.setProperty('--pc', col.c);
    f.style.setProperty('--pd', col.d);
    const ring = el('i', 'mnf-ring');
    const img = el('img', 'mnf-img');
    img.alt = o.name || '';
    img.draggable = false;
    img.decoding = 'async';
    img.src = art(o.skin, o.pose);
    f.append(ring, img);
    if (o.tag) {
      const tag = el('div', 'mnf-tag');
      tag.appendChild(el('b', null, o.name || ''));
      if (o.me) tag.appendChild(el('em', null, 'TÚ'));
      f.appendChild(tag);
    }
    f._img = img;
    f._skin = o.skin;
    f.pose = (p) => { const u = art(o.skin, p); if (img.getAttribute('src') !== u) img.src = u; };
    return f;
  }

  // ---------- the painted board (map units: MAP.W × MAP.H) ----------
  // a smooth closed road through the spaces (Catmull-Rom → Bézier)
  function roadPath() {
    const P = MAP.POS, n = P.length;
    let d = `M${P[0].x},${P[0].y}`;
    for (let i = 0; i < n; i++) {
      const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
      const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x},${p2.y}`;
    }
    return d + 'Z';
  }
  const palm = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-3 0 C-5 -30 2 -55 0 -78" stroke="#8a5a2b" stroke-width="7" fill="none" stroke-linecap="round"/>`
    + ['M0 -78 C-20 -92 -40 -86 -52 -70', 'M0 -78 C20 -94 42 -88 54 -70', 'M0 -78 C-10 -100 -28 -108 -40 -104', 'M0 -78 C12 -102 30 -108 42 -100', 'M0 -78 C-24 -80 -38 -64 -44 -50', 'M0 -78 C24 -80 38 -64 44 -50']
      .map((d) => `<path d="${d}" stroke="#2f9a53" stroke-width="9" fill="none" stroke-linecap="round"/>`).join('') + '</g>';
  const abra = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-46 0 H46 L36 14 H-36 Z" fill="#9a5b2e" stroke="#1d2440" stroke-width="3"/><path d="M-30 0 V-16 H30 V0" fill="none" stroke="#1d2440" stroke-width="3"/><path d="M-36 -16 H36 L30 -24 H-30 Z" fill="#f6efe1" stroke="#1d2440" stroke-width="3"/></g>`;
  const tower = (x, y, w, h, c) => `<g><rect x="${x}" y="${y - h}" width="${w}" height="${h}" rx="4" fill="${c}" stroke="#1d2440" stroke-width="3"/>`
    + Array.from({ length: Math.floor(h / 26) }, (_, i) => `<rect x="${x + 6}" y="${y - h + 10 + i * 26}" width="${w - 12}" height="8" rx="2" fill="#ffe7a3" opacity=".85"/>`).join('') + '</g>';
  function terrain() {
    const W = MAP.W, H = MAP.H;
    return svg('mnb-terrain', `0 0 ${W} ${H}`, `
      <defs>
        <linearGradient id="mnSand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f9e6bb"/><stop offset="1" stop-color="#efcf8d"/></linearGradient>
        <linearGradient id="mnSea" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0f7fa6"/><stop offset="1" stop-color="#3cc9d6"/></linearGradient>
        <linearGradient id="mnCreek" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d7ec2"/><stop offset="1" stop-color="#47b0e3"/></linearGradient>
        <radialGradient id="mnDune" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="#f6d79a"/><stop offset="1" stop-color="#e3b766"/></radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#mnSand)"/>
      <path d="M0 0 H330 C300 26 250 40 200 52 C120 70 92 120 76 200 C62 280 70 380 60 480 C52 580 66 700 48 840 H0 Z" fill="url(#mnSea)"/>
      <path d="M0 0 H330 C300 26 250 40 200 52 C120 70 92 120 76 200 C62 280 70 380 60 480 C52 580 66 700 48 840" fill="none" stroke="#fff6dc" stroke-width="10" opacity=".9"/>
      <path d="M20 170 q14 -8 28 0 M18 330 q14 -8 28 0 M24 520 q14 -8 28 0 M14 690 q14 -8 28 0 M140 22 q14 -8 28 0" stroke="#e8fbff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".7"/>
      <path d="M430 0 H${W} V58 C1100 76 1010 52 930 66 C840 82 760 56 680 68 C600 80 520 62 470 40 Z" fill="url(#mnCreek)"/>
      <path d="M470 40 C520 62 600 80 680 68 C760 56 840 82 930 66 C1010 52 1100 76 ${W} 58" fill="none" stroke="#fff6dc" stroke-width="8" opacity=".85"/>
      ${abra(640, 34, 0.9)}${abra(980, 30, 0.8)}
      <path d="M${W} 250 V840 H1110 C1124 700 1112 520 1124 380 C1130 320 1150 280 ${W} 250 Z" fill="#dcd5ee"/>
      ${tower(1130, 470, 30, 120, '#9fb3d9')}${tower(1164, 500, 26, 160, '#b9a6e0')}${tower(1128, 640, 34, 100, '#8fc2d6')}${tower(1166, 690, 26, 130, '#9fb3d9')}${tower(1132, 790, 30, 90, '#b9a6e0')}
      <ellipse cx="420" cy="812" rx="260" ry="46" fill="url(#mnDune)"/><ellipse cx="860" cy="826" rx="240" ry="40" fill="url(#mnDune)"/>
      <ellipse cx="300" cy="600" rx="120" ry="34" fill="url(#mnDune)" opacity=".9"/><ellipse cx="900" cy="590" rx="110" ry="30" fill="url(#mnDune)" opacity=".9"/>
      <ellipse cx="330" cy="290" rx="90" ry="24" fill="url(#mnDune)" opacity=".8"/>
      ${palm(46, 140, 0.9)}${palm(40, 430, 0.8)}${palm(36, 770, 0.9)}${palm(860, 300, 0.8)}${palm(900, 300, 0.65)}${palm(280, 470, 0.7)}${palm(1130, 230, 0.7)}
      <path d="${roadPath()}" fill="none" stroke="#b98a46" stroke-width="70" stroke-linejoin="round"/>
      <path d="${roadPath()}" fill="none" stroke="#fff3d4" stroke-width="58" stroke-linejoin="round"/>
      <path d="${roadPath()}" fill="none" stroke="#e9cf96" stroke-width="5" stroke-dasharray="2 22" stroke-linecap="round"/>
    `);
  }
  const SPACE_GLYPH = {
    lucky: '<text x="50" y="66" text-anchor="middle">?</text>',
    storm: '<path d="M30 52 C30 30 70 26 72 46 C74 62 50 66 46 54 C43 44 58 42 58 50" fill="none" stroke-width="7" stroke-linecap="round"/><path d="M22 66 H70 M30 76 H62" stroke-width="6" stroke-linecap="round"/>',
  };
  function spaceEl(i) {
    const sp = MAP.SPACES[i], p = MAP.POS[i];
    const s = el('div', 'mnb-sp t-' + sp.t);
    s.style.left = p.x + 'px';
    s.style.top = p.y + 'px';
    if (SPACE_GLYPH[sp.t]) s.appendChild(svg('mnb-glyph', '0 0 100 100', SPACE_GLYPH[sp.t]));
    if (sp.t === 'start') {
      s.appendChild(el('b', 'mnb-start', 'SALIDA'));
      s.appendChild(svg('mnb-arrow', '0 0 100 40', '<path d="M6 20 H80 M64 6 L86 20 L64 34" fill="none" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>'));
    }
    return s;
  }

  // ======================= the board =======================
  function Board(host, o) {
    this.o = Object.assign({ mode: 'phone', tags: true }, o || {});
    this.seats = {};          // k → { k, name, skin, c, pos, on, el, busy }
    this.q = {};              // k → promise chain (one move at a time per piece)
    this.owners = {};
    this.starPos = MAP.STAR_START;
    this.cam = { x: MAP.POS[0].x, y: MAP.POS[0].y, s: 1 };
    this.viewCy = null;
    const r = this.root = el('div', 'mnb mnb-' + this.o.mode);
    const camEl = this.camEl = el('div', 'mnb-cam');
    const map = this.map = el('div', 'mnb-map');
    map.style.width = MAP.W + 'px';
    map.style.height = MAP.H + 'px';
    map.appendChild(terrain());
    const plaque = el('div', 'mnb-plaque');
    plaque.append(el('b', null, 'Dàfùwēng'), el('span', null, 'El Gran Tablero de Dubái'));
    plaque.setAttribute('translate', 'no');
    map.appendChild(plaque);
    const camel = el('img', 'mnb-deco mnb-camel');
    camel.src = '/assets/saga/anim/camel-still.webp';
    camel.alt = '';
    camel.decoding = 'async';
    map.appendChild(camel);
    this.spaces = MAP.SPACES.map((_, i) => { const s = spaceEl(i); map.appendChild(s); return s; });
    // the landmarks stand on their spaces (the owner's flag + level pips next to them)
    this.lms = MAP.LANDMARKS.map((lm, i) => {
      const at = MAP.SPACES.findIndex((s) => s.lm === i);
      const p = MAP.POS[at];
      const box = el('div', 'mnb-lm lm-' + lm.id);
      box.style.transform = `translate3d(${p.x}px,${p.y + 16}px,0)`;
      box.style.zIndex = String(p.y + 16 - 40);
      const img = el('img', 'mnb-lm-img');
      img.src = lmArt(lm.id);
      img.alt = lm.name;
      img.decoding = 'async';
      const flag = el('div', 'mnb-flag');
      flag.append(el('i', 'mnb-flag-cloth'), el('b', 'mnb-flag-lvl'));
      box.append(img, flag);
      map.appendChild(box);
      return { box, flag, at };
    });
    // the star and Dralingo (who sells it)
    const st = this.starEl = el('div', 'mnb-starbox');
    st.appendChild(star('mnb-star'));
    const dr = this.dralEl = el('img', 'mnb-dral');
    dr.src = DRALINGO;
    dr.alt = 'Dralingo con la estrella';
    dr.decoding = 'async';
    map.append(st, dr);
    this.fx = el('div', 'mnb-fx');
    map.appendChild(this.fx);
    camEl.appendChild(map);
    r.appendChild(camEl);
    host.appendChild(r);
    this.setStar(this.starPos, false);
    this._onResize = () => { if (this.o.mode === 'tile') this.fit(); else this.focus(null, 0); };
    root.addEventListener('resize', this._onResize);
    if (this.o.mode === 'tile') requestAnimationFrame(() => this.fit());
  }
  Board.prototype.destroy = function () {
    root.removeEventListener('resize', this._onResize);
    this.root.remove();
  };
  const xy = (i) => MAP.POS[((i % MAP.N) + MAP.N) % MAP.N];

  // ---------- pieces ----------
  Board.prototype.setSeats = function (list) {
    const seen = new Set();
    (list || []).forEach((s) => {
      seen.add(s.k);
      let x = this.seats[s.k];
      if (!x) {
        x = this.seats[s.k] = { k: s.k, name: s.name, skin: s.skin, c: s.c, pos: s.pos, on: s.on !== false, busy: 0 };
        x.el = figure({ skin: s.skin, c: s.c, name: s.name, me: s.k === this.o.me, tag: this.o.tags });
        x.el.classList.add('mnb-piece');
        this.map.appendChild(x.el);
      }
      x.on = s.on !== false;
      x.el.classList.toggle('off', !x.on);
      if (!x.busy && s.pos != null) x.pos = s.pos;
    });
    Object.keys(this.seats).forEach((k) => { if (!seen.has(Number(k))) { this.seats[k].el.remove(); delete this.seats[k]; } });
    this.layout();
    this.paintOwners();
  };
  Board.prototype.online = function (k, on) { const x = this.seats[k]; if (x) { x.on = !!on; x.el.classList.toggle('off', !x.on); } };
  // where piece k stands: side by side when it shares its space, spaced by each character's real width so pieces never
  // overlap (kid-safe: nobody touching), smaller the more there are
  const WIDE = { dralingo: 124, aileen: 92, adric: 86, adrian: 58, fer: 52, hamdan: 52, latifa: 48, camel: 96, plane: 122, falcon: 94, oryx: 76 };
  Board.prototype.spot = function (k) {
    const x = this.seats[k];
    const p = xy(x.pos);
    // the pieces standing on that space: resting ones, ones landing there (their moment plays), and k itself
    const here = Object.values(this.seats).filter((y) => y.pos === x.pos && (!y.busy || y.landing || y === x)).sort((a, b) => a.c - b.c);
    const n = here.length, i = Math.max(0, here.indexOf(x));
    const sc = n >= 4 ? 0.62 : n === 3 ? 0.7 : n === 2 ? 0.84 : 1;
    const ws = here.map((y) => (WIDE[y.skin] || 70) * sc);
    const total = ws.reduce((a, w) => a + w, 0) + 4 * (n - 1);
    let left = p.x - total / 2;
    for (let j = 0; j < i; j++) left += ws[j] + 4;
    const lm = MAP.SPACES[x.pos].t === 'land';
    return { x: n > 1 ? left + ws[i] / 2 : p.x, y: p.y + (lm ? 26 : 8) + (i % 2) * 6, s: sc };
  };
  function place(x, s) {
    x.el.style.transform = `translate3d(${s.x}px,${s.y}px,0) scale(${s.s})`;
    x.el.style.zIndex = String(Math.round(s.y) + 2);
    x.at = s;
  }
  Board.prototype.layout = function () {
    Object.values(this.seats).forEach((x) => { if (!x.busy || (x.landing && !x.anim)) place(x, this.spot(x.k)); });
  };
  // queue a move for one piece (moves of one piece never overlap; different pieces move at once)
  Board.prototype.queue = function (k, fn) {
    const prev = this.q[k] || Promise.resolve();
    const next = prev.then(fn, fn).catch(() => {});
    this.q[k] = next;
    return next;
  };
  // hop along a path of spaces (T.step each); onStep(i, space) after every landing; the camera follows my piece
  Board.prototype.hop = function (k, path, o) {
    o = o || {};
    return this.queue(k, async () => {
      const x = this.seats[k];
      if (!x || !path || !path.length) return;
      x.busy++;
      this.layout();
      const stepMs = o.stepMs || T.step;
      for (let i = 0; i < path.length; i++) {
        if (o.gate) await o.gate(i);                     // the phone pauses the walk on a moment (the star, Salida…)
        const from = x.at || this.spot(k);
        const p = xy(path[i]);
        const last = i === path.length - 1;
        x.pos = path[i];
        // passing: the middle of the space; the last hop: its own place beside whoever stands there (never on top)
        if (last) x.landing = true;
        const to = last ? this.spot(k) : { x: p.x, y: p.y + 8, s: 1 };
        if (last) this.layout();
        if (reduced() || !x.el.animate || o.instant) place(x, to);
        else {
          x.anim = true;
          const a = x.el.animate([
            { transform: `translate3d(${from.x}px,${from.y}px,0) scale(${from.s})` },
            { transform: `translate3d(${(from.x + to.x) / 2}px,${(from.y + to.y) / 2 - STEP_ARC}px,0) scale(${(from.s + to.s) / 2 + 0.04})`, offset: 0.5 },
            { transform: `translate3d(${to.x}px,${to.y}px,0) scale(${to.s})` },
          ], { duration: stepMs * 0.86, easing: 'cubic-bezier(.33,0,.4,1)' });
          place(x, to);
          if (k === this.o.me && this.o.mode === 'phone') this.focus(to, stepMs * 0.86, 'linear');
          await new Promise((res) => { a.onfinish = res; a.oncancel = res; });
          x.anim = false;
          await sleep(stepMs * 0.14);
        }
        if (k === this.o.me && this.o.mode === 'phone' && (reduced() || o.instant)) this.focus(to, 0);
        if (o.onStep) o.onStep(i, path[i]);
      }
      if (o.end) await o.end();
      x.landing = false;
      x.busy--;
      this.layout();
      if (k === this.o.me && this.o.mode === 'phone') this.focus(k, 260);
    });
  };
  // fly to a space in one arc (a swap, a rejoin); `now` skips the queue
  Board.prototype.jump = function (k, to, o) {
    o = o || {};
    const run = async () => {
      const x = this.seats[k];
      if (!x) return;
      const from = x.at || this.spot(k);
      x.pos = to;
      // its new place right away (also inside its own running hop: a «¡Cambio!» on landing), the others make room
      const dest = this.spot(k);
      place(x, dest);
      this.layout();
      if (!reduced() && x.el.animate && !o.instant) {
        x.anim = true;
        const a = x.el.animate([
          { transform: `translate3d(${from.x}px,${from.y}px,0) scale(${from.s})` },
          { transform: `translate3d(${(from.x + dest.x) / 2}px,${Math.min(from.y, dest.y) - 150}px,0) scale(1.15)`, offset: 0.5 },
          { transform: `translate3d(${dest.x}px,${dest.y}px,0) scale(${dest.s})` },
        ], { duration: o.ms || 900, easing: 'cubic-bezier(.45,0,.25,1)' });
        if (k === this.o.me && this.o.mode === 'phone') this.focus(dest, o.ms || 900, 'cubic-bezier(.45,0,.25,1)');
        await new Promise((res) => { a.onfinish = res; a.oncancel = res; });
        x.anim = false;
      } else if (k === this.o.me && this.o.mode === 'phone') this.focus(dest, 0);
    };
    return o.now ? run() : this.queue(k, run);
  };
  // set where a piece is without animation (a snapshot from the server after its moves are done)
  Board.prototype.settle = function (k, pos) {
    return this.queue(k, async () => { const x = this.seats[k]; if (!x || x.pos === pos) return; x.pos = pos; this.layout(); if (k === this.o.me) this.focus(k, 300); });
  };
  Board.prototype.pose = function (k, p) { const x = this.seats[k]; if (x) x.el.pose(p); };
  Board.prototype.pieceEl = function (k) { const x = this.seats[k]; return x ? x.el : null; };
  Board.prototype.posOf = function (k) { const x = this.seats[k]; return x ? x.pos : null; };

  // ---------- owners, the star ----------
  Board.prototype.setOwners = function (owners) {
    this.owners = Object.assign({}, owners || {});
    this.paintOwners();
  };
  Board.prototype.own = function (lm, o) { if (o) this.owners[lm] = o; else delete this.owners[lm]; this.paintOwners(lm); };
  Board.prototype.paintOwners = function (only) {
    this.lms.forEach((L, i) => {
      if (only != null && Number(only) !== i) return;
      const o = this.owners[i];
      const seat = o && this.seats[o.k];
      const sp = this.spaces[L.at];
      if (!o) { L.box.classList.remove('owned'); sp.classList.remove('owned'); sp.style.removeProperty('--oc'); L.flag.style.removeProperty('--oc'); return; }
      const col = colorOf(seat ? seat.c : 0);
      L.box.classList.add('owned');
      sp.classList.add('owned');
      sp.style.setProperty('--oc', col.c);
      L.flag.style.setProperty('--oc', col.c);
      L.flag.querySelector('.mnb-flag-lvl').textContent = '★'.repeat(Math.max(1, Math.min(3, o.lvl || 1)));
    });
  };
  Board.prototype.setStar = function (pos, fly) {
    const from = xy(this.starPos), to = xy(pos);
    this.starPos = pos;
    const put = (p) => {
      this.starEl.style.transform = `translate3d(${p.x}px,${p.y - 92}px,0)`;
      this.dralEl.style.transform = `translate3d(${p.x + 58}px,${p.y - 4}px,0)`;
      this.starEl.style.zIndex = String(p.y + 400);
      this.dralEl.style.zIndex = String(p.y - 4);
    };
    if (fly && !reduced() && this.starEl.animate) {
      this.dralEl.style.opacity = '0';
      const a = this.starEl.animate([
        { transform: `translate3d(${from.x}px,${from.y - 92}px,0) scale(1)` },
        { transform: `translate3d(${(from.x + to.x) / 2}px,${Math.min(from.y, to.y) - 320}px,0) scale(1.6)`, offset: 0.5 },
        { transform: `translate3d(${to.x}px,${to.y - 92}px,0) scale(1)` },
      ], { duration: 1300, easing: 'cubic-bezier(.45,0,.25,1)' });
      put(to);
      a.onfinish = () => { this.dralEl.style.opacity = ''; };
    } else put(to);
    this.spaces.forEach((s, i) => s.classList.toggle('has-star', i === pos));
  };

  // ---------- moments on the board ----------
  // a floating number or word at a space («+3», «−3», «★»), rising and fading
  Board.prototype.pop = function (space, text, cls) {
    const p = xy(space);
    const n = el('div', 'mnb-pop ' + (cls || ''), text);
    if (cls === 'gain' || cls === 'loss') n.appendChild(coin());   // «+3 ◎»: coins, not points
    n.style.left = p.x + 'px';
    n.style.top = (p.y - 130) + 'px';
    this.fx.appendChild(n);
    setTimeout(() => n.remove(), 1300);
  };
  Board.prototype.flash = function (space, cls) {
    const s = this.spaces[((space % MAP.N) + MAP.N) % MAP.N];
    if (!s) return;
    s.classList.remove('flash', 'flash-gold', 'flash-red');
    void s.offsetWidth;
    s.classList.add('flash', cls || 'flash-gold');
    setTimeout(() => s.classList.remove('flash', 'flash-gold', 'flash-red'), 900);
  };
  // the sand storm sweeping over this board
  Board.prototype.storm = function () {
    if (reduced()) return;
    const s = el('div', 'mnb-storm');
    this.root.appendChild(s);
    setTimeout(() => s.remove(), 2400);
  };

  // ---------- the camera (phone) / the fit (projector) ----------
  // the phone's camera scale: a 390 px phone shows about 430 map units across
  const camScale = (w) => Math.max(0.74, Math.min(1.12, w / 430));
  // the visible centre (px from the board's top) the camera aims at: the space above the question sheet
  // top / bottom: the part of the screen the board really shows (under the plates, over the sheet): the camera never
  // leaves more than a strip of night there (it slides along the edge instead of centring a piece on an edge space)
  Board.prototype.view = function (cy, ms, top, bottom) { this.viewCy = cy; this.viewTop = top; this.viewBottom = bottom; this.focus(null, ms == null ? 450 : ms); };
  // aim at piece k (or a {x,y} point, or the last target) over ms
  Board.prototype.focus = function (target, ms, ease) {
    if (this.o.mode !== 'phone') return;
    if (typeof target === 'number' || typeof target === 'string') {
      const x = this.seats[target];
      if (x) target = x.at || this.spot(x.k);
      else target = null;
    }
    if (target) { this.cam.x = target.x; this.cam.y = target.y; }
    const w = this.root.clientWidth, h = this.root.clientHeight;
    if (!w || !h) return;
    const s = camScale(w);
    const cy = this.viewCy != null ? this.viewCy : h * 0.5;
    let tx = w / 2 - (FRAME + this.cam.x) * s, ty = cy - (FRAME + this.cam.y - 40) * s;
    const mw = (MAP.W + 2 * FRAME) * s, mh = (MAP.H + 2 * FRAME) * s, edge = 26;
    tx = Math.min(edge, Math.max(w - mw - edge, tx));
    const vt = this.viewTop != null ? this.viewTop : 0, vb = this.viewBottom != null ? this.viewBottom : h;
    if (mh > vb - vt) ty = Math.min(vt + edge, Math.max(vb - mh - edge, ty));
    this.camEl.style.transition = ms > 0 && !reduced() ? `transform ${Math.round(ms)}ms ${ease || 'cubic-bezier(.22,1,.36,1)'}` : 'none';
    this.camEl.style.transform = `translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0) scale(${s.toFixed(3)})`;
    this.cam.s = s; this.cam.tx = tx; this.cam.ty = ty;
  };
  Board.prototype.fit = function () {
    const w = this.root.clientWidth, h = this.root.clientHeight;
    if (!w || !h) return;
    const pad = 8, FW = MAP.W + 2 * (FRAME + RING), FH = MAP.H + 2 * (FRAME + RING);
    const s = Math.min((w - pad) / FW, (h - pad) / FH);
    const tx = (w - (MAP.W + 2 * FRAME) * s) / 2, ty = (h - (MAP.H + 2 * FRAME) * s) / 2;
    this.camEl.style.transition = 'none';
    this.camEl.style.transform = `translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0) scale(${s.toFixed(4)})`;
    this.cam.s = s; this.cam.tx = tx; this.cam.ty = ty;
  };
  // a map point in page coordinates (coins fly from the board to the plates on top)
  Board.prototype.screenXY = function (x, y) {
    const b = this.root.getBoundingClientRect();
    return { x: b.left + (this.cam.tx || 0) + (FRAME + x) * (this.cam.s || 1), y: b.top + (this.cam.ty || 0) + (FRAME + y) * (this.cam.s || 1) };
  };
  // just over a piece's head, in page coordinates (the dice block, the steps left)
  Board.prototype.headXY = function (k) {
    const x = this.seats[k];
    if (!x) return null;
    const a = x.at || this.spot(k);
    const animal = isAnimal(x.skin);
    return this.screenXY(a.x, a.y - (animal ? 96 : PIECE_H) * (a.s || 1) - 12);
  };
  Board.prototype.pieceXY = function (k) {
    const x = this.seats[k];
    if (!x) return null;
    const a = x.at || this.spot(k);
    return this.screenXY(a.x, a.y - PIECE_H * 0.55 * (a.s || 1));
  };

  // ---------- the minimap (phone): the loop, every piece, the star ----------
  function Minimap(host) {
    const w = 120, h = 84;
    const k = Math.min(w / MAP.W, h / MAP.H);
    const pts = MAP.POS.map((p) => `${(p.x * k).toFixed(1)},${(p.y * k).toFixed(1)}`).join(' ');
    this.k = k;
    this.root = svg('mn-mini', `0 0 ${w} ${h}`, `<polygon class="mn-mini-loop" points="${pts}"/>`);
    this.dots = {};
    this.star = document.createElementNS(ns, 'path');
    this.star.setAttribute('d', STAR_D);
    this.star.setAttribute('class', 'mn-mini-star');
    this.root.appendChild(this.star);
    host.appendChild(this.root);
  }
  Minimap.prototype.set = function (seats, starPos, me) {
    const k = this.k;
    const seen = new Set();
    (seats || []).forEach((s) => {
      seen.add(s.k);
      let d = this.dots[s.k];
      if (!d) {
        d = this.dots[s.k] = document.createElementNS(ns, 'circle');
        d.setAttribute('r', s.k === me ? 8.5 : 6.5);
        d.setAttribute('class', 'mn-mini-dot' + (s.k === me ? ' me' : ''));
        d.style.fill = colorOf(s.c).c;
        this.root.appendChild(d);
      }
      const p = xy(s.pos);
      d.setAttribute('cx', (p.x * k).toFixed(1));
      d.setAttribute('cy', (p.y * k).toFixed(1));
    });
    Object.keys(this.dots).forEach((id) => { if (!seen.has(Number(id))) { this.dots[id].remove(); delete this.dots[id]; } });
    if (starPos != null) {
      const p = xy(starPos);
      this.star.setAttribute('transform', `translate(${(p.x * k - 10).toFixed(1)} ${(p.y * k - 10).toFixed(1)}) scale(.2)`);
    }
    if (me != null && this.dots[me]) this.root.appendChild(this.dots[me]);   // mine on top
  };

  const pre = {};
  function preload(skins) {
    (skins || []).forEach((s) => ['idle', 'ok', 'no'].forEach((p) => { const u = art(s, p); if (!pre[u]) { pre[u] = new Image(); pre[u].src = u; } }));
    MAP.LANDMARKS.forEach((l) => { const u = lmArt(l.id); if (!pre[u]) { pre[u] = new Image(); pre[u].src = u; } });
    if (!pre[DRALINGO]) { pre[DRALINGO] = new Image(); pre[DRALINGO].src = DRALINGO; }
  }

  root.MonoBoard = { MAP, T, Board, Minimap, figure, coin, star, dice, colorOf, art, skinFor, isAnimal, lmArt, preload, fmt, el, reduced, sleep, DRALINGO };
})(typeof window !== 'undefined' ? window : this);
