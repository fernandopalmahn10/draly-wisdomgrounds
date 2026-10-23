// ¡Atrapa a Fénec! — the beach stage, shared by the phone (js/player-teamcrab.js) and the projector (js/host-teamcrab.js).
// The Mario Party «Team Crab» camera: a sunny Dubai beach (the sail hotel on the horizon, palms), a wooden dock in
// front, the crew's giant red robot crab standing in the sea behind it with one glass bubble cockpit per kid (their
// face inside) and one wooden barrel hammer per kid on a red arm; Fénec on the dock in front hopping between 5 spots;
// El Péndulo hanging over the sea. Higgsfield art 2026-10-23 (0 credits), all motion in code: a loaded hammer hovers
// over its spot with its shadow on the planks, a slam falls in FALL_MS (dust, splinters, a shake), a bonk flattens Fénec
// (dizzy stars, his sack spills the class's words), El Péndulo grows with every grumpy spark and his big swing knocks
// every hammer away. window.CrabStage = { Stage, head, fig, freeze, preload }. Modes: 'phone' (the kid's screen), 'tile'
// (a projector board), 'big' (the projector's lobby / a one-board class).
(function (root) {
  'use strict';
  const A = '/assets/teamcrab/';
  const SPOTS = 5;
  const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const HB = () => root.HalconBoard || null;
  const head = (skin) => (HB() ? HB().head(HB().skinOk ? HB().skinOk(skin) : skin) : '/assets/saga/avatars/dralingo.webp');
  const fig = (skin, pose) => (HB() ? HB().art(skin, pose || 'idle', pose === 'win') : '/assets/dralingo/hello.webp');
  const FENEC = { idle: 'fenec-idle', left: 'fenec-left', right: 'fenec-right', bonk: 'fenec-bonk', spill: 'fenec-spill', laugh: 'fenec-laugh', run: 'fenec-run', kick: 'fenec-kick' };
  const PEND = { idle: 'pendulo-idle', angry: 'pendulo-angry', swing: 'pendulo-swing', squeak: 'pendulo-squeak', dizzy: 'pendulo-dizzy' };
  // what Fénec says (cast.md: «¡Mías, mías!», «¡No me atrapan!», «¡La próxima vez, Dralingo!»; funny, never mean)
  const LINES = {
    idle: ['¡Mías, mías!', '¿Palabras? ¡Me las llevo!', '¡Nananá! 😜', '¡Uy, una palabra nueva! ¡Mía!'],
    miss: ['¡No me atrapan!', '¡Fallaste! 😜', '¡Muy lento!'], miss2: ['¡Jijiji, por poco!', '¡Ni me tocaste!'],
    mias: ['¡Mías! 😆', '¡Esa palabra es mía!', '¡Jijiji, me la llevo!'],
    nervous: ['¡Ay, ay, ay! 😰', '¡Me están rodeando!'], swing: ['¡Bien, Péndulo! 😆'], up: ['¡Me despeinaste! ⭐', '¡Oye, eso no se vale! 😤'],
  };
  const PLINES = { feed: ['¡Enójate! ¡Ñam!', '¡Ñam, ñam! 😋', '¡Peleen, peleen!'], calm: ['¡Nooo, no se rían!', '¿Me ignoran? ¡Qué injusto!'], swing: ['¡ZAS! 😈'] };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  function el(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function img(cls, src) { const i = el('img', cls); i.alt = ''; i.draggable = false; if (src) i.src = src; return i; }

  function Stage(box, o) {
    this.o = o || {};
    this.box = box;
    this.timers = [];
    this.crew = [];           // [{ k, skin, name, me, dome, arm, ham, shadow, st, x }]
    this.at = 2;              // Fénec's spot
    this.anger = 0;
    const r = this.root = el('div', 'tcs tcs-' + (this.o.mode || 'phone'));
    this.bg = el('div', 'tcs-bg');
    this.pend = el('div', 'tcs-pend');
    this.pendImg = img('tcs-pimg', A + 'pendulo-idle.webp');
    this.pend.appendChild(this.pendImg);
    this.crab = el('div', 'tcs-crab');
    this.crabImg = img('tcs-crabimg', A + 'crab-body.webp');
    this.crab.appendChild(this.crabImg);
    this.arms = el('div', 'tcs-arms');
    this.domes = el('div', 'tcs-domes');
    this.shadows = el('div', 'tcs-shadows');
    this.fen = el('div', 'tcs-fen');
    this.fenImg = img('tcs-fimg', A + 'fenec-idle.webp');
    this.fenStars = el('div', 'tcs-dizzy hidden');
    for (let i = 0; i < 3; i++) this.fenStars.appendChild(el('i', 's' + i, '★'));
    this.fen.append(this.fenImg, this.fenStars);
    this.hams = el('div', 'tcs-hams');
    this.fxl = el('div', 'tcs-fx');
    this.under = el('div', 'tcs-under');           // (the bonk's rays and the dust: behind Fénec)
    this.bubble = el('div', 'tcs-bubble hidden');
    this.pbubble = el('div', 'tcs-bubble p hidden');
    this.band = el('div', 'tcs-band hidden');
    this.reacts = el('div', 'tcs-reacts');
    r.append(this.bg, this.pend, this.crab, this.arms, this.domes, this.shadows, this.under, this.fen, this.hams, this.fxl, this.bubble, this.pbubble, this.reacts, this.band);
    box.appendChild(r);
    this.fit();
    if (root.ResizeObserver) { this.ro = new ResizeObserver(() => this.fit()); this.ro.observe(box); }
    else { this._onr = () => this.fit(); root.addEventListener('resize', this._onr); }
  }
  Stage.prototype.later = function (ms, fn) {
    const t = setTimeout(() => { this.timers = this.timers.filter((x) => x !== t); fn(); }, Math.max(0, ms));
    this.timers.push(t);
    return t;
  };
  Stage.prototype.destroy = function () {
    this.timers.forEach(clearTimeout); this.timers = [];
    if (this.ro) this.ro.disconnect();
    if (this._onr) root.removeEventListener('resize', this._onr);
    if (this.root.parentNode) this.root.parentNode.removeChild(this.root);
  };
  // ---------- the layout: everything in px of this box, from where the beach picture really sits ----------
  Stage.prototype.fit = function () {
    const W = this.box.clientWidth || 360, H = this.box.clientHeight || 300;
    if (W < 20 || H < 20) return;
    const wide = W / H > 1.3;
    const iw = wide ? 1600 : 1000, ih = wide ? 900 : 1000;
    const sc = Math.max(W / iw, H / ih), pw = iw * sc, ph = ih * sc, pl = (W - pw) / 2, pt = H - ph;
    this.bg.style.backgroundImage = 'url(' + A + (wide ? 'beach-wide.webp' : 'beach-square.webp') + ')';
    Object.assign(this.bg.style, { width: pw + 'px', height: ph + 'px', left: pl + 'px', top: pt + 'px' });
    const y = (f) => pt + f * ph;
    const feet = Math.min(H - 6, y(0.93));
    const deckTop = y(0.79);
    // the spots: across the dock, inside the box
    const fenH0 = Math.min(H * (wide ? 0.3 : 0.27), W * 0.3);
    const m = Math.max(wide ? 0.17 : 0.1, (fenH0 * 0.5) / W + 0.015);
    this.spotX = Array.from({ length: SPOTS }, (_, i) => W * (m + (i * (1 - 2 * m)) / (SPOTS - 1)));
    // the crab in the sea behind the dock
    const crabW = Math.min(W * (wide ? 0.44 : 0.66), (deckTop - y(0.2)) * 1.25);
    const crabH = crabW / 1.228;
    const crabL = W / 2 - crabW / 2, crabT = deckTop + crabH * 0.06 - crabH;
    Object.assign(this.crab.style, { width: crabW + 'px', height: crabH + 'px', left: crabL + 'px', top: crabT + 'px' });
    const fenH = fenH0;
    const hamH = Math.min(H * (wide ? 0.36 : 0.32), W * 0.36);
    this.g = { W, H, wide, feet, deckTop, crabW, crabH, crabL, crabT, fenH, hamH, hamW: hamH * 0.75, raisedTop: 2 };
    // a loaded hammer hovers above the row of cockpits (never over a face), as high as the stage allows
    const dTop = crabT + crabH * 0.5 - Math.min(crabW * 0.19, H * 0.17) / 2;
    this.g.raisedTop = Math.max(2, Math.min(dTop - hamH - 4, feet - hamH - H * 0.3));
    // El Péndulo hangs over the sea on the right (his size grows with his anger)
    const pH = Math.min(H * 0.34, W * 0.42);
    Object.assign(this.pend.style, { height: pH + 'px', width: pH * 0.62 + 'px', left: W * (wide ? 0.8 : 0.79) - pH * 0.31 + 'px', top: '0px' });
    this.paintAnger(false);
    // Fénec
    Object.assign(this.fen.style, { width: fenH * 1.5 + 'px', height: fenH + 'px', top: feet - fenH + 'px' });
    this.placeFen(this.at, false);
    this.layoutCrew();
    if (!this.bubble.classList.contains('hidden')) this.placeBubble();
  };
  // ---------- the crew: a glass bubble cockpit with each kid's face, an arm, a hammer ----------
  Stage.prototype.setCrew = function (seats, meK) {
    const old = {};
    this.crew.forEach((c) => { old[c.k] = c; });
    this.domes.innerHTML = ''; this.arms.innerHTML = ''; this.hams.innerHTML = ''; this.shadows.innerHTML = '';
    this.crew = (seats || []).map((s, i) => {
      const c = { k: s.k, skin: s.skin, name: s.name, me: s.k === meK, i, st: old[s.k] ? old[s.k].st : 'idle', x: old[s.k] ? old[s.k].x : (seats.length > 1 ? i / (seats.length - 1) : 0.5) };
      c.dome = el('div', 'tcs-dome' + (c.me ? ' me' : '') + (s.on === false ? ' off' : ''));
      c.dome.appendChild(img('tcs-dhead', head(s.skin)));
      c.dome.appendChild(el('i', 'tcs-glass'));
      if (this.o.mode !== 'phone' || !c.me) c.dome.appendChild(el('b', 'tcs-dname', c.me ? 'Tú' : s.name));
      else c.dome.appendChild(el('b', 'tcs-dname me', 'Tú'));
      c.arm = el('i', 'tcs-arm' + (c.me ? ' me' : ''));
      c.ham = el('div', 'tcs-ham' + (c.me ? ' me' : ''));
      c.ham.appendChild(img('tcs-himg', A + 'hammer.webp'));
      c.ham.appendChild(el('i', 'tcs-smoke'));
      const badge = el('span', 'tcs-hbadge' + (c.me ? ' me' : ''));
      badge.appendChild(img('tcs-hhead', head(s.skin)));
      if (c.me) badge.appendChild(el('b', 'tcs-hmine', 'TÚ'));
      c.ham.appendChild(badge);
      c.shadow = el('i', 'tcs-shadow' + (c.me ? ' me' : ''));
      this.domes.appendChild(c.dome); this.arms.appendChild(c.arm); this.hams.appendChild(c.ham); this.shadows.appendChild(c.shadow);
      return c;
    });
    this.layoutCrew();
    this.crew.forEach((c) => this.paintHam(c, false));
  };
  Stage.prototype.cr = function (k) { return this.crew.find((c) => c.k === k) || null; };
  Stage.prototype.setOn = function (k, on) { const c = this.cr(k); if (c) c.dome.classList.toggle('off', on === false); };
  Stage.prototype.layoutCrew = function () {
    const g = this.g;
    if (!g) return;
    const n = this.crew.length || 1;
    const d = Math.min(g.crabW * (n > 4 ? 0.15 : n > 3 ? 0.17 : 0.19), g.H * 0.17);
    const span = Math.min(0.62, (n - 1) * (d / g.crabW) * 1.12);
    g.domeTop = g.crabT + g.crabH * 0.5 - d / 2;
    this.crew.forEach((c, i) => {
      const fx = n === 1 ? 0.5 : 0.5 - span / 2 + (span * i) / (n - 1);
      c.dx = g.crabL + g.crabW * fx;
      c.dy = g.crabT + g.crabH * 0.5 + (Math.abs(fx - 0.5) * g.crabH * 0.1);
      c.d = d;
      Object.assign(c.dome.style, { width: d + 'px', height: d + 'px', left: c.dx - d / 2 + 'px', top: c.dy - d / 2 + 'px' });
      Object.assign(c.ham.style, { width: g.hamW + 'px', height: g.hamH + 'px' });
      Object.assign(c.shadow.style, { width: g.hamW * 1.05 + 'px', height: g.hamW * 0.34 + 'px', top: g.feet - g.hamW * 0.2 + 'px' });
      this.paintHam(c, false);
    });
  };
  const PARK = 0.42;               // a parked hammer's size (held up over its cockpit)
  const xToSpot = (x) => Math.max(0, Math.min(SPOTS - 1, Math.round(Math.max(0, Math.min(1, x)) * (SPOTS - 1))));
  Stage.prototype.spotPx = function (s) { return this.spotX ? this.spotX[Math.max(0, Math.min(SPOTS - 1, s))] : 0; };
  // the x of a hammer: a loaded / falling one sits over its spot (aim x snaps to the spot), a parked one by its dome
  Stage.prototype.hamPos = function (c) {
    const g = this.g;
    const parked = c.st === 'idle' || c.st === 'back' || c.st === 'jam';
    const knocked = c.st === 'knock';
    if (parked || knocked) {
      // parked: held up just above its cockpit, small, behind the glass (the video's raised claws)
      return { x: c.dx, top: c.dy - c.d * 0.45 - g.hamH * PARK * 0.92, down: false };
    }
    const sx = this.spotPx(c.st === 'loaded' && c.live != null ? xToSpot(c.live) : xToSpot(c.x));
    const down = c.st === 'fall' || c.st === 'hit';
    return { x: sx, top: down ? g.feet - g.hamH * 0.98 : g.raisedTop, down };
  };
  // draw one hammer (its arm from its dome to its claw, its shadow), animated over `ms` (0 = at once)
  Stage.prototype.paintHam = function (c, anim, ms) {
    const g = this.g;
    if (!g || !c.ham) return;
    const p = this.hamPos(c);
    const t = anim ? (ms || 160) : 0;
    const ease = c.st === 'fall' ? 'cubic-bezier(.55,0,1,.6)' : 'cubic-bezier(.3,.7,.3,1)';
    [c.ham, c.arm, c.shadow].forEach((e) => { e.style.transition = t ? `transform ${t}ms ${ease}, opacity ${Math.min(t, 250)}ms, width ${t}ms ${ease}` : 'none'; });
    const hx = p.x - g.hamW / 2;
    const scale = c.st === 'idle' || c.st === 'back' || c.st === 'jam' || c.st === 'knock' ? PARK : 1;
    c.ham.style.transform = `translate(${hx}px, ${p.top}px) scale(${scale})`;
    c.ham.className = 'tcs-ham st-' + c.st + (c.me ? ' me' : '');
    // the arm: from under the dome to the claw (the hammer's top centre)
    const ax = c.dx, ay = c.dy + c.d * 0.35;
    const bx = p.x, by = p.top + g.hamH * (1 - scale) / 2 + g.hamH * 0.06 * scale;
    const len = Math.max(1, Math.hypot(bx - ax, by - ay));
    const ang = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
    const thick = Math.max(6, Math.min(g.W, g.H) * 0.028);
    c.arm.style.width = len + 'px';
    c.arm.style.height = thick + 'px';
    c.arm.style.transformOrigin = '0 50%';
    c.arm.style.transform = `translate(${ax}px, ${ay - thick / 2}px) rotate(${ang}deg)`;
    // the shadow on the planks: only a loaded / falling hammer casts one (it grows as the hammer falls)
    const sh = c.st === 'loaded' || c.st === 'fall';
    c.shadow.style.opacity = sh ? (c.st === 'fall' ? '1' : c.me ? '0.95' : '0.8') : '0';
    const shs = c.st === 'fall' ? 1.1 : 0.85;
    c.shadow.style.transform = `translate(${p.x - g.hamW * 0.525}px, 0) scale(${shs})`;
    c.shadow.dataset.spot = sh ? String(xToSpot(c.live != null && c.st === 'loaded' ? c.live : c.x)) : '';
  };
  // a hammer's state from the server ('idle' | 'loaded' | 'fall' | 'back' | 'knock' | 'jam')
  Stage.prototype.ham = function (k, st, x) {
    const c = this.cr(k);
    if (!c) return;
    const was = c.st;
    c.st = st;
    if (x != null) c.x = x;
    if (st !== 'loaded') c.live = null;
    this.paintHam(c, true, st === 'knock' ? 420 : was === 'idle' && st === 'loaded' ? 260 : 300);
    if (st === 'loaded' && was !== 'loaded' && !reduced()) { c.ham.classList.remove('ready'); void c.ham.offsetWidth; c.ham.classList.add('ready'); }
  };
  // live aim (my finger, or a crewmate's relayed): the hammer glides over the dock and snaps to the spot below
  Stage.prototype.aim = function (k, x) {
    const c = this.cr(k);
    if (!c || (c.st !== 'loaded' && c.st !== 'knock')) return;
    const prev = c.live != null ? xToSpot(c.live) : xToSpot(c.x);
    c.live = Math.max(0, Math.min(1, x));
    c.x = c.live;
    if (xToSpot(c.live) !== prev || !this._aimed) this.paintHam(c, true, 110);
    this._aimed = true;
  };
  // the slam: it falls over ms, then the impact (dust, splinters, a shake); the server says hit / miss with impact()
  Stage.prototype.slam = function (k, x, ms) {
    const c = this.cr(k);
    if (!c) return;
    if (x != null) c.x = x;
    c.live = null;
    c.st = 'fall';
    this.paintHam(c, !reduced(), ms || 420);
    this.later(ms || 420, () => {
      if (c.st !== 'fall') return;
      c.st = 'hit';
      this.paintHam(c, false);
      this.dust(this.spotPx(xToSpot(c.x)), c.me ? 1 : 0.7);
      if (!reduced()) { c.ham.classList.remove('squash'); void c.ham.offsetWidth; c.ham.classList.add('squash'); }
      this.shake(c.me && this.o.mode === 'phone' ? 'big' : 'small');
    });
  };
  Stage.prototype.dust = function (x, s) {
    const g = this.g;
    if (!g) return;
    const fx = this.fxl;
    const puff = el('i', 'tcs-dust');
    puff.style.left = x + 'px'; puff.style.top = g.feet + 'px';
    puff.style.setProperty('--s', s || 1);
    fx.appendChild(puff);
    this.later(700, () => puff.remove());
    if (reduced()) return;
    for (let i = 0; i < 6; i++) {
      const sp = el('i', 'tcs-splinter');
      sp.style.left = x + 'px'; sp.style.top = g.feet - 6 + 'px';
      const a = Math.PI + (i / 5) * Math.PI;
      sp.style.setProperty('--dx', Math.round(Math.cos(a) * g.hamW * (0.6 + Math.random() * 0.5)) + 'px');
      sp.style.setProperty('--dy', Math.round(Math.sin(a) * g.hamW * (0.5 + Math.random() * 0.4)) + 'px');
      sp.style.setProperty('--r', Math.round(Math.random() * 360) + 'deg');
      fx.appendChild(sp);
      this.later(700, () => sp.remove());
    }
  };
  Stage.prototype.shake = function (kind) {
    if (reduced()) return;
    const cls = kind === 'big' ? 'shake-big' : 'shake';
    this.root.classList.remove('shake', 'shake-big'); void this.root.offsetWidth; this.root.classList.add(cls);
    this.later(kind === 'big' ? 520 : 360, () => this.root.classList.remove(cls));
  };
  // ---------- Fénec ----------
  Stage.prototype.fenPose = function (p) { this.fenImg.src = A + (FENEC[p] || FENEC.idle) + '.webp'; this.fen.dataset.pose = p; };
  Stage.prototype.placeFen = function (s, anim, ms) {
    const g = this.g;
    if (!g) return;
    this.at = s;
    const x = this.spotPx(s) - g.fenH * 0.75;
    this.fen.style.transition = anim ? `left ${ms || 300}ms cubic-bezier(.4,0,.4,1)` : 'none';
    this.fen.style.left = x + 'px';
    if (this.bubble && !this.bubble.classList.contains('hidden')) this.placeBubble();
  };
  // a hop to the next spot: the dodge picture toward where he goes, a little jump, then his cheeky idle again
  Stage.prototype.hop = function (from, to, ms) {
    ms = ms || 300;
    if (this.fen.dataset.pose === 'bonk' || this.fen.dataset.pose === 'spill') return;
    this.fenPose(to < from ? 'left' : to > from ? 'right' : 'idle');
    this.placeFen(to, !reduced(), ms);
    if (!reduced()) { this.fenImg.classList.remove('jump'); void this.fenImg.offsetWidth; this.fenImg.classList.add('jump'); }
    clearTimeout(this._fenT);
    this._fenT = this.later(ms + 160, () => { if (this.fen.dataset.pose === 'left' || this.fen.dataset.pose === 'right') this.fenPose('idle'); });
  };
  Stage.prototype.say = function (text, kind, ms) {
    const b = this.band;
    if (!text) { b.classList.add('hidden'); return; }
    b.textContent = text;
    b.className = 'tcs-band' + (kind ? ' ' + kind : '');
    if (this._bandT) clearTimeout(this._bandT);
    if (ms) this._bandT = this.later(ms, () => b.classList.add('hidden'));
  };
  // Fénec speaks (a bubble above him), by line kind or a text
  Stage.prototype.taunt = function (kind, text, ms) {
    const g = this.g;
    if (!g) return;
    if (this.root.classList.contains('swinging') && kind !== 'x') return;
    const t = text || pick(LINES[kind] || LINES.idle);
    const b = this.bubble;
    b.textContent = t;
    b.classList.remove('hidden');
    this.placeBubble();
    if (this._tauntT) clearTimeout(this._tauntT);
    this._tauntT = this.later(ms || 1500, () => b.classList.add('hidden'));
    if (kind === 'mias' || kind === 'swing') {
      if (this.fen.dataset.pose === 'idle') { this.fenPose('laugh'); this.later(1100, () => { if (this.fen.dataset.pose === 'laugh') this.fenPose('idle'); }); }
    }
  };
  Stage.prototype.placeBubble = function () {
    const g = this.g;
    if (!g) return;
    const b = this.bubble;
    const x = this.spotPx(this.at);
    const half = Math.min(110, g.W / 2);
    let top = Math.max(4, g.feet - g.fenH * 1.04), left = x;
    // (above him unless that lands on the row of cockpits: then beside his head, toward the middle of the dock)
    const bh = b.offsetHeight || 40, dTop = g.domeTop != null ? g.domeTop : -1e9, dBot = dTop + Math.min(g.crabW * 0.19, g.H * 0.17) + 22;
    if (top - bh < dBot && top > dTop) { top = Math.min(g.feet - 6, g.feet - g.fenH * 0.62); left = x + (x < g.W / 2 ? 1 : -1) * (g.fenH * 0.8 + Math.min(half, (b.offsetWidth || 2 * half) / 2) + 6); }
    b.style.left = Math.max(half, Math.min(g.W - half, left)) + 'px';
    b.style.top = top + 'px';
  };
  // a miss on the board: he snatches a word back into his sack («¡Mías!»): a word chip flies from the top into his sack
  Stage.prototype.snatch = function (word) {
    const g = this.g;
    if (!g || reduced()) return;
    const w = el('b', 'tcs-word snatch', word || '…');
    const x = this.spotPx(this.at);
    w.style.left = g.W / 2 + 'px'; w.style.top = '8%';
    w.style.setProperty('--dx', Math.round(x - g.W / 2) + 'px');
    w.style.setProperty('--dy', Math.round(g.feet - g.fenH * 0.45 - g.H * 0.08) + 'px');
    this.fxl.appendChild(w);
    this.later(900, () => w.remove());
  };
  // ---------- the BONK (the board's big moment) ----------
  // Fénec flat with dizzy stars; then he sits up with his sack open and the class's words fly out to the crew
  Stage.prototype.bonk = function (k, words, pts, ms) {
    const g = this.g;
    if (!g) return;
    ms = ms || 2800;
    const c = this.cr(k);
    this.fenPose('bonk');
    this.fenStars.classList.remove('hidden');
    this.bubble.classList.add('hidden');
    this.root.classList.add('bonking');
    this.shake('big');
    const x = this.spotPx(this.at);
    const burst = el('i', 'tcs-burst');
    burst.style.left = x + 'px'; burst.style.top = g.feet - g.fenH * 0.3 + 'px';
    this.under.appendChild(burst);
    const stamp = el('b', 'tcs-stamp', '¡BONK!');
    const fsz = Math.max(24, Math.min(110, g.fenH * 0.5));
    let sx = Math.max(g.W * 0.26, Math.min(g.W * 0.74, x)), sy = g.feet - g.fenH * 0.46 - fsz * 0.62;   // (just above him flat)
    const dBot = (g.domeTop != null ? g.domeTop : -1e9) + Math.min(g.crabW * 0.19, g.H * 0.17) + 22;
    if (sy - fsz * 0.6 < dBot) {                     // (no room above on a short stage: beside him on the dock, never on a face)
      sy = g.feet - fsz * 0.7;
      sx = Math.max(fsz * 1.8, Math.min(g.W - fsz * 1.8, x + (x < g.W / 2 ? 1 : -1) * (g.fenH * 0.7 + fsz * 1.7)));
    }
    stamp.style.fontSize = fsz + 'px';
    stamp.style.left = sx + 'px';
    stamp.style.top = sy + 'px';
    this.fxl.appendChild(stamp);
    this.later(1300, () => stamp.remove());
    this.later(ms, () => burst.remove());
    // the words fly out of his sack (pinyin chips) toward the crab's cockpits
    this.later(reduced() ? 0 : 700, () => {
      this.fenPose('spill');
      stamp.remove();                                   // (he sits up with the open sack: the stamp has said it, his face stays clear)
      this.fenStars.classList.add('hidden');
      const list = (words && words.length ? words : ['¡+' + (pts || 2) + '!']).slice(0, 6);
      list.forEach((w, i) => {
        const chip = el('b', 'tcs-word', w);
        chip.style.left = x + 'px'; chip.style.top = g.feet - g.fenH * 0.5 + 'px';
        const dest = c || this.crew[i % Math.max(1, this.crew.length)];
        const tx = dest ? dest.dx : g.W / 2, ty = dest ? dest.dy : g.H * 0.1;
        chip.style.setProperty('--dx', Math.round(tx - x + (Math.random() - 0.5) * 40) + 'px');
        chip.style.setProperty('--dy', Math.round(ty - (g.feet - g.fenH * 0.5)) + 'px');
        chip.style.animationDelay = (i * 140) + 'ms';
        this.fxl.appendChild(chip);
        this.later(1800 + i * 140, () => chip.remove());
      });
      if (c && !reduced()) { c.dome.classList.remove('glow'); void c.dome.offsetWidth; c.dome.classList.add('glow'); this.later(1600, () => c.dome.classList.remove('glow')); }
    });
    this.later(ms - 200, () => this.root.classList.remove('bonking'));
  };
  // he gets up (dizzy) and runs to a new spot
  Stage.prototype.up = function (from, to, ms) {
    this.fenStars.classList.add('hidden');
    this.fenPose('run');
    this.placeFen(to, !reduced(), (ms || 600));
    this.later((ms || 600) + 100, () => this.fenPose('idle'));
  };
  // ---------- El Péndulo ----------
  Stage.prototype.paintAnger = function (anim) {
    const a = Math.max(0, Math.min(5, this.anger));
    const s = 0.72 + a * 0.14;
    this.pend.style.setProperty('--ps', s.toFixed(3));
    this.pend.style.setProperty('--pa', (6 + a * 3).toFixed(1) + 'deg');
    this.pend.style.setProperty('--pt', (3.2 - a * 0.36).toFixed(2) + 's');
    this.pend.classList.toggle('hot', a >= 3);
    if (!this.pend.dataset.mood || this.pend.dataset.mood === 'idle' || this.pend.dataset.mood === 'angry') {
      const mood = a >= 3 ? 'angry' : 'idle';
      this.pend.dataset.mood = mood;
      this.pendImg.src = A + PEND[mood] + '.webp';
    }
  };
  Stage.prototype.pendSay = function (kind, ms) {
    const g = this.g;
    if (!g || this.root.classList.contains('swinging')) return;
    const b = this.pbubble;
    b.textContent = pick(PLINES[kind] || PLINES.feed);
    const pr = this.pend.getBoundingClientRect(), br = this.root.getBoundingClientRect();
    b.style.left = Math.max(70, pr.left - br.left - 6 - Math.min(150, g.W * 0.36) / 2) + 'px';   // (beside him, over the sky: never on a face)
    b.style.top = Math.max(4, Math.min(g.H * 0.3, pr.top - br.top + pr.height * 0.45)) + 'px';
    b.classList.remove('hidden');
    if (this._pbT) clearTimeout(this._pbT);
    this._pbT = this.later(ms || 1500, () => b.classList.add('hidden'));
  };
  // a grumpy spark flies from the dock into him: he eats it and grows
  Stage.prototype.feed = function (anger) {
    const g = this.g;
    this.anger = anger;
    if (g && !reduced()) {
      const sp = el('i', 'tcs-spark');
      const pr = this.pend.getBoundingClientRect(), br = this.root.getBoundingClientRect();
      const tx = pr.left - br.left + pr.width / 2, ty = pr.top - br.top + pr.height * 0.78;
      const sx = this.spotPx(this.at), sy = g.feet - g.fenH * 0.6;
      sp.style.left = sx + 'px'; sp.style.top = sy + 'px';
      sp.style.setProperty('--dx', Math.round(tx - sx) + 'px');
      sp.style.setProperty('--dy', Math.round(ty - sy) + 'px');
      this.fxl.appendChild(sp);
      this.later(760, () => sp.remove());
      this.later(620, () => { this.pend.classList.remove('gulp'); void this.pend.offsetWidth; this.pend.classList.add('gulp'); });
    }
    this.later(reduced() ? 0 : 640, () => { this.paintAnger(true); if (anger >= 2) this.pendSay('feed', 1300); });
  };
  // right answers in a row calm him: he squeaks and shrinks
  Stage.prototype.calm = function (anger) {
    const was = this.anger;
    this.anger = anger;
    if (Math.floor(was) !== Math.floor(anger) || anger <= 0) {
      this.pend.dataset.mood = 'squeak';
      this.pendImg.src = A + (anger <= 0 ? PEND.dizzy : PEND.squeak) + '.webp';
      if (anger > 0) this.pendSay('calm', 1200);
      this.later(900, () => { this.pend.dataset.mood = 'idle'; this.paintAnger(true); });
    } else this.paintAnger(true);
  };
  // his BIG SWING (the whole stage): he swings huge across the dock, every hammer knocked away
  Stage.prototype.swing = function (ms) {
    ms = ms || 1800;
    this.pend.dataset.mood = 'swing';
    this.pendImg.src = A + PEND.swing + '.webp';
    this.root.classList.add('swinging');
    this.bubble.classList.add('hidden');
    this.pbubble.classList.add('hidden');
    this.crew.forEach((c) => { if (c.st !== 'jam') { c.st = 'knock'; this.paintHam(c, true, 420); } });
    this.shake('big');
    this.later(ms, () => {
      this.root.classList.remove('swinging');
      this.anger = 1;
      this.pend.dataset.mood = 'dizzy';
      this.pendImg.src = A + PEND.dizzy + '.webp';
      this.later(1400, () => { this.pend.dataset.mood = 'idle'; this.paintAnger(true); });
    });
  };
  Stage.prototype.setAnger = function (a) { this.anger = a; this.pend.dataset.mood = 'idle'; this.paintAnger(false); };
  // a reaction from a kid of the crew (😱 😂 👏 🔥) floats up with their face
  const REACT = { wow: '😱', lol: '😂', clap: '👏', fire: '🔥' };
  Stage.prototype.react = function (e, skin) {
    if (!REACT[e]) return;
    if (this.reacts.childElementCount > 6) this.reacts.firstChild.remove();
    const r = el('span', 'tcs-react');
    r.style.left = (6 + Math.random() * 74) + '%';
    if (skin) r.appendChild(img('tcs-rhead', head(skin)));
    r.appendChild(el('b', null, REACT[e]));
    this.reacts.appendChild(r);
    this.later(2200, () => r.remove());
  };
  // ---------- the ending ----------
  // caught: the crab's hammers slam together, he is flat, his sack spills every word, then he runs off; escaped: he
  // laughs, kicks the crab and it falls apart in a puff (comic), he cheers
  Stage.prototype.ending = function (caught, words) {
    const g = this.g;
    if (!g) return;
    this.bubble.classList.add('hidden');
    if (caught) {
      // the crew boxes him in: one hammer on him, the others on both sides (the trap), then the bonk
      const around = [0, -1, 1, -2, 2].map((d) => this.at + d).filter((s) => s >= 0 && s < SPOTS);
      this.crew.forEach((c, i) => { c.x = around[i % around.length] / (SPOTS - 1); c.st = 'loaded'; this.paintHam(c, true, 200); this.later(i === 0 ? 560 : 300 + i * 70, () => this.slam(c.k, null, 380)); });
      this.later(960, () => this.bonk(this.crew[0] ? this.crew[0].k : null, (words || []).slice(0, 6), 0, 3000));
      this.later(1800, () => this.crew.forEach((c) => { c.st = 'idle'; this.paintHam(c, true, 420); }));   // (the hammers go back up: he lies flat, the words fly)
      this.later(3000, () => { this.fenPose('run'); this.taunt('x', '¡La próxima vez, Dralingo!', 2600); this.placeFen(SPOTS - 1, true, 900); this.fen.classList.add('runoff'); });
      this.later(1250, () => { this.say('¡ATRAPADO! 🎉', 'win big'); this.crew.forEach((c, i) => this.later(i * 90, () => { c.dome.classList.remove('cheer'); void c.dome.offsetWidth; c.dome.classList.add('cheer'); })); });   // (the video's «Mario Wins!»: the crew cheers in their cockpits)
    } else {
      this.fenPose('laugh');
      this.taunt('x', '¡No me atrapan! 😆', 1600);
      this.later(900, () => { this.placeFen(2, true, 380); this.fenPose('kick'); });
      this.later(1350, () => {
        this.crabImg.src = A + 'crab-broken.webp';
        this.root.classList.add('broken');
        this.crew.forEach((c) => { c.st = 'knock'; this.paintHam(c, true, 500); });
        const pf = el('i', 'tcs-puff');
        pf.style.left = g.crabL + g.crabW / 2 + 'px'; pf.style.top = g.crabT + g.crabH * 0.6 + 'px';
        this.fxl.appendChild(pf);
        this.later(1400, () => pf.remove());
        this.shake('big');
        this.say('¡SE ESCAPÓ! 😜', 'lose big');
      });
      this.later(2400, () => this.taunt('x', '¡La próxima vez, Dralingo!', 2400));
    }
  };
  Stage.prototype.reset = function () {
    this.crabImg.src = A + 'crab-body.webp';
    this.root.classList.remove('broken', 'bonking', 'swinging');
    this.fen.classList.remove('runoff');
    this.fenPose('idle');
    this.fenStars.classList.add('hidden');
    this.setAnger(0);
  };

  let frozen = false;
  function freeze(v) {
    frozen = !!v;
    if (!document.getAnimations) return;
    document.getAnimations().forEach((a) => { try { if (frozen) { a.pause(); a.currentTime = Math.min(400, Number(a.currentTime) || 0) + 400; } else a.play(); } catch (_) {} });
  }
  function preload() {
    ['beach-wide', 'beach-square', 'crab-body', 'crab-broken', 'hammer'].concat(Object.values(FENEC), Object.values(PEND)).forEach((n) => { const i = new Image(); i.src = A + n + '.webp'; });
  }
  root.CrabStage = { Stage, head, fig, freeze, preload, SPOTS, LINES, xToSpot };
})(typeof window !== 'undefined' ? window : this);
