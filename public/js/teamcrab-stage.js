// Draly Cangrejo · ¡Atrapa a Fénec! — the beach stage, shared by the phone (js/player-teamcrab.js) and the projector
// (js/host-teamcrab.js). The Mario Party «Team Crab» camera: a sunny Dubai beach (the sail hotel on the horizon, palms),
// a wooden dock in front, the crew's giant red robot crab WALKING in the shallow sea behind it (the Capitán drives it:
// it leans and its legs bob as it goes) with one glass bubble cockpit per kid (their face inside) and one wooden barrel
// hammer per kid on a red arm; Fénec runs along the dock in a pattern a kid can read (he stands, crouches 0.3 s leaning
// the way he will go, then runs 2 spots); El Péndulo hangs over the sea and EATS the hammer charges of wrong answers.
// v2 2026-10-23 (his «Skill decides, never luck»): positions are continuous (0-4 on the dock, the server's units);
// one requestAnimationFrame loop moves the crab toward its target at its real speed, carries the armed claws with it and
// runs Fénec exactly along the server's plan, so what a kid sees is what the server judges: a hammer's shadow on the
// planks is where it lands, and it bonks him when its shadow is on him at the impact.
// window.CrabStage = { Stage, head, fig, freeze, preload }. Modes: 'phone' (the kid's screen), 'tile' (a projector
// crew), 'big' (the projector's lobby / a one-crew class).
// v3 «1 contra 3» (his idea 2026-10-23): setRunner(k, me) — a kid is Fénec this round. me = MY phone runs him: the
// video's camera (Fénec from behind on the dock, the crab and its hammers in front), runTarget(x) / dash(dir) / myX()
// (the phone is the truth for where he is), stunMe(ms) after a hit; a hammer's slam(k, x, ms, onLand) calls onLand at
// the landing ON THIS SCREEN (his verdict). Others: runAt(x) = the relayed spot, drawn ahead by his speed.
(function (root) {
  'use strict';
  const A = '/assets/teamcrab/';
  const SPOTS = 5, MAXX = SPOTS - 1;
  const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const HB = () => root.HalconBoard || null;
  const head = (skin) => (HB() ? HB().head(HB().skinOk ? HB().skinOk(skin) : skin) : '/assets/saga/avatars/dralingo.webp');
  const fig = (skin, pose) => (HB() ? HB().art(skin, pose || 'idle', pose === 'win') : '/assets/dralingo/hello.webp');
  const FENEC = { idle: 'fenec-idle', left: 'fenec-left', right: 'fenec-right', bonk: 'fenec-bonk', spill: 'fenec-spill', laugh: 'fenec-laugh', run: 'fenec-run', kick: 'fenec-kick', crouch: 'fenec-crouch', back: 'fenec-back', backrun: 'fenec-backrun' };
  const PEND = { idle: 'pendulo-idle', angry: 'pendulo-angry', eat: 'pendulo-eat', squeak: 'pendulo-squeak', dizzy: 'pendulo-dizzy' };
  // what Fénec says (cast.md: «¡Mías, mías!», «¡No me atrapan!», «¡La próxima vez, Dralingo!»; funny, never mean)
  const LINES = {
    idle: ['¡Mías, mías!', '¿Palabras? ¡Me las llevo!', '¡Nananá! 😜', '¡No me atrapan!'],
    miss: ['¡No me atrapan!', '¡Fallaste! 😜', '¡Muy lento!'], miss2: ['¡Jijiji, por poco!', '¡Ni me tocaste!'],
    up: ['¡Me despeinaste! ⭐', '¡Oye, eso no se vale! 😤'],
  };
  const PLINES = { eat: ['¡Ñam! 😋', '¡Ñam, ñam!', '¡Qué rico martillazo!'], calm: ['¡Nooo, no se rían!', '¿Me ignoran? ¡Qué injusto!'] };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function el(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function img(cls, src) { const i = el('img', cls); i.alt = ''; i.draggable = false; if (src) i.src = src; return i; }

  function Stage(box, o) {
    this.o = Object.assign({ reach: 1.0, speed: 4.2, hit: 0.45, fall: 350, vs: { run: 1.5, dashX: 1.2, dashMs: 220 } }, o || {});
    this.runK = null; this.runMe = false; this.me = null; this.runS = [];   // («1 contra 3»: the runner this round)
    this.box = box;
    this.timers = [];
    this.crew = [];           // [{ k, skin, name, me, dome, arm, ham, shadow, st, off, x, charges }]
    this.captain = null;
    this.crabX = MAXX / 2; this.crabTx = MAXX / 2; this.crabSrv = null;
    this.f = { mode: 'idle', x: MAXX / 2, x0: MAXX / 2, x1: MAXX / 2, dir: 1, t0: 0, t1: 0 };
    this.fx = MAXX / 2;       // Fénec's x on screen now
    this.anger = 0;
    const r = this.root = el('div', 'tcs tcs-' + (this.o.mode || 'phone'));
    this.bg = el('div', 'tcs-bg');
    this.pend = el('div', 'tcs-pend');
    this.pendImg = img('tcs-pimg', A + 'pendulo-idle.webp');
    this.pend.appendChild(this.pendImg);
    this.rig = el('div', 'tcs-rig');               // (the crab, its arms and its cockpits move together)
    this.crab = el('div', 'tcs-crab');
    this.crabImg = img('tcs-crabimg', A + 'crab-body.webp');
    this.crab.appendChild(this.crabImg);
    this.domes = el('div', 'tcs-domes');
    this.rig.append(this.crab, this.domes);
    this.arms = el('div', 'tcs-arms');
    this.reach = el('i', 'tcs-reach hidden');      // (my claw's reach on the planks: my phone only)
    this.shadows = el('div', 'tcs-shadows');
    this.fen = el('div', 'tcs-fen');
    this.fenImg = img('tcs-fimg', A + 'fenec-idle.webp');
    this.fenStars = el('div', 'tcs-dizzy hidden');
    for (let i = 0; i < 3; i++) this.fenStars.appendChild(el('i', 's' + i, '★'));
    this.fen.append(this.fenImg, this.fenStars);
    this.runTag = el('b', 'tcs-runtag hidden');      // (the runner's face and name over Fénec: the crew's screens)
    this.runTagImg = img('tcs-rthead');
    this.runTagName = el('span');
    this.runTag.append(el('i', null, '🦊'), this.runTagImg, this.runTagName);
    this.hams = el('div', 'tcs-hams');
    this.fxl = el('div', 'tcs-fx');
    this.under = el('div', 'tcs-under');           // (the bonk's rays and the dust: behind Fénec)
    this.bubble = el('div', 'tcs-bubble hidden');
    this.pbubble = el('div', 'tcs-bubble p hidden');
    this.band = el('div', 'tcs-band hidden');
    this.reacts = el('div', 'tcs-reacts');
    r.append(this.bg, this.pend, this.rig, this.arms, this.reach, this.shadows, this.under, this.fen, this.runTag, this.hams, this.fxl, this.bubble, this.pbubble, this.reacts, this.band);
    box.appendChild(r);
    this.fit();
    if (root.ResizeObserver) { this.ro = new ResizeObserver(() => this.fit()); this.ro.observe(box); }
    else { this._onr = () => this.fit(); root.addEventListener('resize', this._onr); }
    this._last = 0;
    this._raf = root.requestAnimationFrame ? root.requestAnimationFrame((t) => this.frame(t)) : 0;
  }
  Stage.prototype.later = function (ms, fn) {
    const t = setTimeout(() => { this.timers = this.timers.filter((x) => x !== t); fn(); }, Math.max(0, ms));
    this.timers.push(t);
    return t;
  };
  Stage.prototype.cancel = function (t) { if (!t) return; clearTimeout(t); this.timers = this.timers.filter((x) => x !== t); };
  Stage.prototype.destroy = function () {
    this.dead = true;
    if (this._raf && root.cancelAnimationFrame) root.cancelAnimationFrame(this._raf);
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
    // a tall phone stage (the play window) frames the action tighter, like the video's camera: less sky, a bigger crab
    const tall = H / W > 1.15;
    this.root.classList.toggle('tall', tall);          // (a tall phone: my runner is drawn closer to the camera)
    const sc = Math.max(W / iw, H / ih) * (tall ? 1.22 : 1), pw = iw * sc, ph = ih * sc, pl = (W - pw) / 2, pt = H - ph;
    this.bg.style.backgroundImage = 'url(' + A + (wide ? 'beach-wide.webp' : 'beach-square.webp') + ')';
    Object.assign(this.bg.style, { width: pw + 'px', height: ph + 'px', left: pl + 'px', top: pt + 'px' });
    const y = (f) => pt + f * ph;
    const feet = Math.min(H - 6, y(0.93));
    const deckTop = y(0.79);
    // the dock: x 0-4 across, inside the box
    const fenH = Math.min(H * (wide ? 0.3 : 0.27), W * (tall ? 0.3 : 0.28));
    const m = Math.max(wide ? 0.14 : 0.1, (fenH * 0.5) / W + 0.035);   // (Fénec stays inside the screen at both ends, even mid-shake)
    this.x0 = W * m; this.x4 = W * (1 - m);
    this.spotW = (this.x4 - this.x0) / MAXX;
    this.spotX = Array.from({ length: SPOTS }, (_, i) => this.x0 + i * this.spotW);
    // the crab in the sea behind the dock (smaller than v1: it walks)
    const crabW = Math.min(W * (wide ? 0.36 : tall ? 0.7 : 0.56), (deckTop - y(0.2)) * 1.2);
    const crabH = crabW / 1.228;
    const crabT = deckTop + crabH * 0.06 - crabH;
    Object.assign(this.crab.style, { width: crabW + 'px', height: crabH + 'px', left: -crabW / 2 + 'px', top: crabT + 'px' });
    const hamH = Math.min(H * (wide ? 0.24 : 0.22), W * 0.2);
    this.g = { W, H, wide, feet, deckTop, crabW, crabH, crabT, fenH, hamH, hamW: hamH * 0.75, raisedTop: 2 };
    const d = Math.min(crabW * 0.2, H * 0.16);
    this.g.domeTop = crabT + crabH * 0.5 - d / 2;
    // (a short stage: smaller hammers, so a hovering one never covers a face)
    const hamFit = Math.max(18, (this.g.domeTop - 10) / 1.1);
    if (this.g.hamH > hamFit) { this.g.hamH = hamFit; this.g.hamW = hamFit * 0.75; }
    // an armed hammer hovers above the row of cockpits (never over a face), as high as the stage allows
    this.g.raisedTop = Math.max(2, Math.min(this.g.domeTop - this.g.hamH * 1.1 - 8, feet - this.g.hamH - H * 0.26));
    // El Péndulo hangs over the sea on the right (his size grows with his anger)
    const pH = Math.min(H * 0.32, W * 0.36);
    Object.assign(this.pend.style, { height: pH + 'px', width: pH * 0.62 + 'px', left: W * (wide ? 0.86 : 0.84) - pH * 0.31 + 'px', top: '0px' });
    this.paintAnger(false);
    Object.assign(this.fen.style, { width: fenH * 1.5 + 'px', height: fenH + 'px', top: feet - fenH + 'px' });
    const sw = Math.max(16, this.spotW * this.o.hit * 2);
    Object.assign(this.reach.style, { top: feet - 8 + 'px', height: '14px' });
    this.g.shadowW = sw;
    this.layoutCrew();
    this.paintAll();
    if (!this.bubble.classList.contains('hidden')) this.placeBubble();
  };
  const xPxOf = (s, x) => s.x0 + clamp(x, 0, MAXX) * s.spotW;
  Stage.prototype.xPx = function (x) { return xPxOf(this, x); };
  Stage.prototype.spotPx = function (s) { return this.xPx(s); };
  Stage.prototype.xOfPx = function (px) { return clamp((px - this.x0) / Math.max(1, this.spotW), 0, MAXX); };
  // the crab body's centre on screen: it follows the crab's x but never walks fully off the beach (its claws reach on)
  Stage.prototype.bodyPx = function (x) { const g = this.g; return clamp(this.xPx(x), g.crabW * 0.5 + 2, g.W - g.crabW * 0.5 - 2); };
  // ---------- the crew: a glass bubble cockpit with each kid's face, an arm, a hammer ----------
  Stage.prototype.setCrew = function (seats, meK) {
    const old = {};
    this.crew.forEach((c) => { old[c.k] = c; });
    this.domes.innerHTML = ''; this.arms.innerHTML = ''; this.hams.innerHTML = ''; this.shadows.innerHTML = '';
    this.meK = meK;
    this.crew = (seats || []).map((s, i) => {
      const o = old[s.k];
      const c = { k: s.k, skin: s.skin, name: s.name, robot: !!s.robot, me: s.k === meK, i, st: o ? o.st : 'idle', off: o ? o.off : 0, x: o ? o.x : 2, charges: o ? o.charges : 0, fallX: o ? o.fallX : 2, _landing: o ? o._landing : false };
      c.dome = el('div', 'tcs-dome' + (c.me ? ' me' : '') + (s.on === false ? ' off' : '') + (c.robot ? ' bot' : ''));
      c.dome.appendChild(img('tcs-dhead', head(s.skin)));
      c.dome.appendChild(el('i', 'tcs-glass'));
      c.dome.appendChild(el('b', 'tcs-dname' + (c.me ? ' me' : ''), c.me ? 'Tú' : (c.robot ? s.name : s.name)));
      c.cap = el('i', 'tcs-cap hidden', '⭐');
      c.pips = el('i', 'tcs-pips');
      c.dome.append(c.cap, c.pips);
      c.arm = el('i', 'tcs-arm' + (c.me ? ' me' : ''));
      c.ham = el('div', 'tcs-ham' + (c.me ? ' me' : ''));
      c.ham.appendChild(img('tcs-himg', A + 'hammer.webp'));
      const badge = el('span', 'tcs-hbadge' + (c.me ? ' me' : ''));
      badge.appendChild(img('tcs-hhead', head(s.skin)));
      if (c.me) badge.appendChild(el('b', 'tcs-hmine', 'TÚ'));
      c.ham.appendChild(badge);
      c.shadow = el('i', 'tcs-shadow' + (c.me ? ' me' : ''));
      this.domes.appendChild(c.dome); this.arms.appendChild(c.arm); this.hams.appendChild(c.ham); this.shadows.appendChild(c.shadow);
      return c;
    });
    this.layoutCrew();
    this.setCaptain(this.captain);
    this.markRunner();
    this.crew.forEach((c) => { this.pips(c); this.paintHam(c, false); });
  };
  Stage.prototype.cr = function (k) { return this.crew.find((c) => c.k === k) || null; };
  Stage.prototype.setOn = function (k, on) { const c = this.cr(k); if (c) c.dome.classList.toggle('off', on === false); };
  Stage.prototype.layoutCrew = function () {
    const g = this.g;
    if (!g) return;
    const n = this.crew.length || 1;
    const d = Math.min(g.crabW * (n > 4 ? 0.16 : n > 3 ? 0.18 : 0.2), g.H * 0.16);
    const span = Math.min(0.64, (n - 1) * (d / g.crabW) * 1.1);
    this.crew.forEach((c, i) => {
      const fx = n === 1 ? 0.5 : 0.5 - span / 2 + (span * i) / (n - 1);
      c.rx = (fx - 0.5) * g.crabW;                                // (relative to the crab's centre)
      c.dy = g.crabT + g.crabH * 0.5 + (Math.abs(fx - 0.5) * g.crabH * 0.1);
      c.d = d;
      Object.assign(c.dome.style, { width: d + 'px', height: d + 'px', left: c.rx - d / 2 + 'px', top: c.dy - d / 2 + 'px' });
      c.dome.style.setProperty('--dd', d + 'px');
      Object.assign(c.ham.style, { width: g.hamW + 'px', height: g.hamH + 'px' });
      Object.assign(c.shadow.style, { width: g.shadowW + 'px', height: Math.max(8, g.shadowW * 0.3) + 'px', top: g.feet - Math.max(8, g.shadowW * 0.3) * 0.6 + 'px' });
    });
  };
  // the Capitán: a star on their cockpit (the projector also names them)
  Stage.prototype.setCaptain = function (k) {
    this.captain = k;
    this.crew.forEach((c) => { c.cap.classList.toggle('hidden', c.k !== k); c.dome.classList.toggle('captain', c.k === k); });
  };
  // a kid's charges as little hammer pips under their cockpit
  Stage.prototype.pips = function (c, n) {
    if (n != null) c.charges = n;
    c.pips.textContent = c.me && c.charges > 0 ? '🔨'.repeat(Math.min(4, c.charges)) : '';
  };
  Stage.prototype.charges = function (k, n) { const c = this.cr(k); if (c) this.pips(c, n); };
  // the cockpit of whoever acts lights up
  Stage.prototype.light = function (k) {
    const c = this.cr(k);
    if (!c || reduced()) return;
    const now = Date.now();
    if (c._litAt && now - c._litAt < 400) return;
    c._litAt = now;
    c.dome.classList.remove('lit'); void c.dome.offsetWidth; c.dome.classList.add('lit');
    c.dome.addEventListener('animationend', () => c.dome.classList.remove('lit'), { once: true });
  };
  const PARK = 0.42;               // a parked hammer's size (held up over its cockpit)
  // where a hammer is drawn: parked above its cockpit, or (armed / falling / coming back) over its x on the dock
  Stage.prototype.hamPos = function (c) {
    const g = this.g;
    const bx = this.bodyPx(this.crabX);
    if (c.st === 'idle') return { x: bx + c.rx, top: c.dy - c.d * 0.45 - g.hamH * PARK * 0.92, scale: PARK };
    const x = c.st === 'fall' || c.st === 'hit' ? c.fallX : clamp(this.crabX + c.off, 0, MAXX);
    const px = this.xPx(x);
    const down = c.st === 'fall' || c.st === 'hit';
    return { x: px, top: down ? g.feet - g.hamH * 0.98 : g.raisedTop + (c.st === 'back' ? -g.hamH * 0.05 : 0), scale: 1, down };
  };
  // draw one hammer (its arm from its cockpit to its claw, its shadow); ms = a transition, 0 = at once
  Stage.prototype.paintHam = function (c, anim, ms, armOnly) {
    const g = this.g;
    if (!g || !c.ham) return;
    const p = this.hamPos(c);
    if (armOnly) { this.paintArm(c, p); return; }
    const t = anim ? (ms || 160) : 0;
    const ease = c.st === 'fall' ? 'cubic-bezier(.55,0,1,.6)' : 'cubic-bezier(.3,.7,.3,1)';
    const tr = t ? `transform ${t}ms ${ease}, opacity ${Math.min(t, 250)}ms` : 'none';
    if (c._tr !== tr) { [c.ham, c.arm, c.shadow].forEach((e) => { e.style.transition = tr; }); c._tr = tr; }
    const hx = p.x - g.hamW / 2;
    c.ham.style.transform = `translate(${hx.toFixed(1)}px, ${p.top.toFixed(1)}px) scale(${p.scale})`;
    const cls = 'tcs-ham st-' + c.st + (c.me ? ' me' : '') + (c.ham.classList.contains('squash') ? ' squash' : '') + (c.ham.classList.contains('ready') ? ' ready' : '') + (c.ham.classList.contains('rising') ? ' rising' : '');
    if (c.ham.className !== cls) c.ham.className = cls;
    this.paintArm(c, p);
    // the shadow on the planks = where it lands (its width = the hit zone): an armed / falling hammer casts one
    const sh = c.st === 'armed' || c.st === 'fall';
    c.shadow.style.opacity = sh ? (c.st === 'fall' ? '1' : c.me ? '0.95' : this.runMe ? '0.6' : '0.38') : '0';
    if (c.shadow.classList.contains('falling') !== (c.st === 'fall')) c.shadow.classList.toggle('falling', c.st === 'fall');
    c.shadow.style.transform = `translate(${(p.x - g.shadowW / 2).toFixed(1)}px, 0) scale(${c.st === 'fall' ? 1.08 : 1})`;
  };
  // the arm: from under its cockpit (which walks with the crab) to the claw (the hammer's top centre)
  Stage.prototype.paintArm = function (c, p) {
    const g = this.g;
    const ax = this.bodyPx(this.crabX) + c.rx, ay = c.dy + c.d * 0.35;
    const bxp = p.x, by = p.top + g.hamH * (1 - p.scale) / 2 + g.hamH * 0.06 * p.scale;
    const len = Math.max(1, Math.hypot(bxp - ax, by - ay));
    const ang = Math.atan2(by - ay, bxp - ax) * 180 / Math.PI;
    const thick = Math.max(5, Math.min(g.W, g.H) * 0.024);
    c.arm.style.width = len.toFixed(1) + 'px';
    c.arm.style.height = thick + 'px';
    c.arm.style.transformOrigin = '0 50%';
    c.arm.style.transform = `translate(${ax.toFixed(1)}px, ${(ay - thick / 2).toFixed(1)}px) rotate(${ang.toFixed(2)}deg)`;
  };
  Stage.prototype.paintAll = function () {
    const g = this.g;
    if (!g) return;
    const bx = this.bodyPx(this.crabX);
    this.rig.style.transform = `translateX(${bx.toFixed(1)}px)`;
    this.crew.forEach((c) => this.paintHam(c, false, 0, c.st === 'fall' || c.st === 'hit'));
    this.placeFenPx();
    if (this.reachOn) {
      const a = this.xPx(clamp(this.crabX - this.o.reach, 0, MAXX)) - g.shadowW / 2, b = this.xPx(clamp(this.crabX + this.o.reach, 0, MAXX)) + g.shadowW / 2;
      this.reach.style.left = a.toFixed(1) + 'px'; this.reach.style.width = Math.max(4, b - a).toFixed(1) + 'px';
    }
  };
  // ---------- the loop: the crab walks, the claws ride on it, Fénec runs his plan ----------
  Stage.prototype.frame = function (t) {
    if (this.dead) return;
    this._raf = root.requestAnimationFrame((tt) => this.frame(tt));
    if (this.paused) { this._last = t; return; }
    const dt = this._last ? Math.min(100, t - this._last) : 16;
    this._last = t;
    let moved = false;
    // the crab: toward its target at its real speed (a big gap from the server's x = catch up faster)
    const want = this.crabTx;
    const step = (this.o.speed * dt) / 1000;
    if (this.crabSrv != null && Math.abs(this.crabSrv - this.crabX) > 0.6) { this.crabX += (this.crabSrv - this.crabX) * 0.35; moved = true; }
    else if (Math.abs(want - this.crabX) > 0.002) { const d = want - this.crabX; this.crabX = Math.abs(d) <= step ? want : this.crabX + Math.sign(d) * step; moved = true; this.walkDir = Math.sign(d); }
    const walking = moved && Math.abs(want - this.crabX) > 0.01;
    if (walking !== this.walking) {
      this.walking = walking;
      this.root.classList.toggle('walking', walking && !reduced());
      this.root.classList.toggle('walk-l', walking && this.walkDir < 0);
      this.root.classList.toggle('walk-r', walking && this.walkDir > 0);
    }
    // Fénec: his plan (run = exactly from x0 to x1 over its time); in «1 contra 3» the runner's own phone, or his relay
    const f = this.f;
    let fx = f.x;
    if (this.runMe && this.me) fx = this.stepMe(dt);
    else if (this.runK != null && this.runS.length) fx = this.relayX(dt);
    else if (f.mode === 'run') { const now = Date.now(); const p = f.t1 > f.t0 ? clamp((now - f.t0) / (f.t1 - f.t0), 0, 1) : 1; fx = f.x0 + (f.x1 - f.x0) * p; }
    if (Math.abs(fx - this.fx) > 0.0005) { this.fx = fx; this.placeFenPx(); }
    if (moved) this.paintAll();
  };
  // the server's crab: x now, tx its target
  Stage.prototype.crabTo = function (x, tx, snap) {
    if (x != null) this.crabSrv = x;
    if (tx != null) this.crabTx = clamp(tx, 0, MAXX);
    if (snap && x != null) { this.crabX = x; this.crabSrv = x; this.paintAll(); }
  };
  // the Capitán's finger (mine, or relayed): the crab starts walking there at once
  Stage.prototype.steer = function (tx) { this.crabTx = clamp(tx, 0, MAXX); };
  Stage.prototype.setPaused = function (v) { this.paused = !!v; this.root.classList.toggle('paused', this.paused); };
  // the server's landing spot for a hammer already falling on this screen (it clamps to its crab's reach)
  Stage.prototype.refall = function (k, x) { const c = this.cr(k); if (!c || c.st !== 'fall' || Math.abs(c.fallX - x) < 0.04) return; c.fallX = x; this.paintHam(c, true, 120); };
  Stage.prototype.showReach = function (v) { this.reachOn = !!v; this.reach.classList.toggle('hidden', !v); this.paintAll(); };
  // a hammer's state from the server: 'idle' (parked: no charges) | 'armed' (over the dock) | 'fall' | 'back'
  Stage.prototype.claw = function (k, st, off, charges) {
    const c = this.cr(k);
    if (!c) return;
    const was = c.st;
    if (was === 'fall' && (st === 'armed' || st === 'back') && c._landing) return;   // (the fall plays out first)
    c.st = st === 'back' ? 'armed' : st;
    if (off != null) c.off = off;
    if (charges != null) this.pips(c, charges);
    this.paintHam(c, true, was === 'idle' && st === 'armed' ? 320 : 240);
    if (st === 'armed' && was === 'idle' && !reduced()) { c.ham.classList.remove('ready'); void c.ham.offsetWidth; c.ham.classList.add('ready'); const done = (e) => { if (e.animationName !== 'tcs-ready') return; c.ham.removeEventListener('animationend', done); c.ham.classList.remove('ready'); }; c.ham.addEventListener('animationend', done); }
  };
  // live aim (my finger, or a crewmate's relayed): the hammer glides along the crab's reach
  Stage.prototype.aim = function (k, off) {
    const c = this.cr(k);
    if (!c || c.st !== 'armed') return;
    c.off = clamp(off, -this.o.reach, this.o.reach);
    this.paintHam(c, true, 90);
  };
  // the slam: it falls on x over ms (shadow → hammer), then the impact (dust, splinters, a shake)
  Stage.prototype.slam = function (k, x, ms, onLand) {
    const c = this.cr(k);
    if (!c) { if (onLand) this.later(ms || this.o.fall, onLand); return; }
    ms = ms || this.o.fall;
    c.fallX = x != null ? x : clamp(this.crabX + c.off, 0, MAXX);
    c.off = clamp(c.fallX - this.crabX, -this.o.reach, this.o.reach);
    c.st = 'fall';
    c._landing = true;
    this.light(k);
    this.paintHam(c, !reduced(), ms);
    this.later(ms, () => {
      if (onLand) onLand();
      if (c.st !== 'fall') { c._landing = false; return; }
      c.st = 'hit';
      this.paintHam(c, false);
      this.dust(this.xPx(c.fallX), c.me ? 1 : 0.7);
      if (!reduced()) { c.ham.classList.remove('squash'); void c.ham.offsetWidth; c.ham.classList.add('squash'); }
      this.shake(c.me && this.o.mode === 'phone' ? 'big' : 'small');
      this.later(260, () => { c._landing = false; c.ham.classList.remove('squash'); c.ham.classList.add('rising'); this.later(420, () => c.ham.classList.remove('rising')); if (c.st === 'hit') { c.st = c.charges > 0 && this.playing ? 'armed' : 'idle'; this.paintHam(c, true, 380); } });
    });
  };
  Stage.prototype.setPlaying = function (v) {
    this.playing = !!v;
    this.root.classList.toggle('playing', this.playing);
    if (!v) this.crew.forEach((c) => { if (c.st === 'armed') { c.st = 'idle'; this.paintHam(c, true, 380); } });
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
  // ---------- Fénec: the server's plan (idle · crouch leaning the way he will go · run · flat · up) ----------
  Stage.prototype.fenPose = function (p, dir) {
    this.fenImg.src = A + (FENEC[p] || FENEC.idle) + '.webp';
    this.fen.dataset.pose = p;
    this.fen.classList.toggle('flip', p === 'crouch' && dir < 0);
  };
  Stage.prototype.placeFenPx = function () {
    const g = this.g;
    if (!g) return;
    const x = this.xPx(this.fx) - g.fenH * 0.75;
    this.fen.style.transform = `translateX(${x.toFixed(1)}px)`;
    // (his name rides on his legs, on the dock: never on the row of cockpits)
    if (this.runK != null && !this.runMe) this.runTag.style.transform = `translate(${(this.xPx(this.fx)).toFixed(1)}px, ${Math.min(g.feet - g.fenH * 0.08, g.H - 4).toFixed(1)}px) translate(-50%, -100%)`;
    if (this.bubble && !this.bubble.classList.contains('hidden')) this.placeBubble();
  };
  Stage.prototype.placeFen = function (x) { this.fx = x; this.f = { mode: 'idle', x, x0: x, x1: x, dir: 1, t0: 0, t1: 0 }; this.placeFenPx(); };
  // ev: { mode, x, x0, x1, dir, ms (left), dur }
  Stage.prototype.fenec = function (ev) {
    if (!ev || this.runK != null) return;
    const now = Date.now();
    const f = { mode: ev.mode, x: ev.x, x0: ev.x0, x1: ev.x1, dir: ev.dir || 1, t0: now, t1: now + (ev.ms || 0) };
    if (ev.mode === 'run') { f.t0 = now - Math.max(0, (ev.dur || 0) - (ev.ms || 0)); f.t1 = f.t0 + (ev.dur || 1); }
    this.f = f;
    if (this.fen.dataset.pose === 'spill' && ev.mode === 'flat') return;
    if (ev.mode === 'idle') { if (this.fen.dataset.pose !== 'laugh') this.fenPose('idle'); this.fx = ev.x; this.placeFenPx(); this.fen.classList.remove('crouch', 'running'); }
    else if (ev.mode === 'crouch') {
      this.fenPose('crouch', ev.dir);
      this.fen.classList.remove('running');
      if (!reduced()) { this.fen.classList.remove('crouch'); void this.fen.offsetWidth; }
      this.fen.classList.add('crouch');
      this.fx = ev.x0; this.placeFenPx();
    } else if (ev.mode === 'run') {
      this.fenPose(ev.dir < 0 ? 'left' : 'right');
      this.fen.classList.remove('crouch');
      this.fen.classList.add('running');
    } else if (ev.mode === 'up') {
      this.fenStars.classList.add('hidden');
      this.fenPose('idle');
      this.fen.classList.remove('crouch', 'running');
      this.fx = ev.x; this.placeFenPx();
    }
  };
  Stage.prototype.say = function (text, kind, ms) {
    const b = this.band;
    if (!text) { b.classList.add('hidden'); return; }
    b.textContent = text;
    b.className = 'tcs-band' + (kind ? ' ' + kind : '');
    this.cancel(this._bandT);
    if (ms) this._bandT = this.later(ms, () => b.classList.add('hidden'));
  };
  // Fénec speaks (a bubble by him), by line kind or a text
  Stage.prototype.taunt = function (kind, text, ms) {
    const g = this.g;
    if (!g || (this.root.classList.contains('bonking') && kind !== 'x' && kind !== 'up')) return;   // (during a bonk his bubble stays off the cockpits)
    const t = text || pick(LINES[kind] || LINES.idle);
    const b = this.bubble;
    b.textContent = t;
    b.classList.remove('hidden');
    this.placeBubble();
    this.cancel(this._tauntT);
    this._tauntT = this.later(ms || 1400, () => b.classList.add('hidden'));
  };
  Stage.prototype.placeBubble = function () {
    const g = this.g;
    if (!g) return;
    const b = this.bubble;
    const x = this.xPx(this.fx);
    const half = Math.min(110, g.W / 2);
    let top = Math.max(4, g.feet - g.fenH * 1.04), left = x;
    // (above him unless that lands on the row of cockpits: then beside his head, toward the middle of the dock)
    const bh = b.offsetHeight || 40, dTop = g.domeTop, dBot = dTop + Math.min(g.crabW * 0.2, g.H * 0.16) + 22;
    if (top - bh < dBot && top > dTop) { top = Math.min(g.feet - 6, g.feet - g.fenH * 0.62); left = x + (x < g.W / 2 ? 1 : -1) * (g.fenH * 0.8 + Math.min(half, (b.offsetWidth || 2 * half) / 2) + 6); }
    const bl = Math.max(half, Math.min(g.W - half, left));
    b.style.left = bl + 'px';
    b.style.top = top + 'px';
    // (still on the row of cockpits, a short stage with the crab beside him: he keeps it to himself, never on a face)
    const bw = b.offsetWidth || 2 * half, bx = this.bodyPx(this.crabX), cw = g.crabW * 0.42;
    const onRow = top > dTop - 4 && top - bh < dBot;
    const onCrab = bl + bw / 2 > bx - cw && bl - bw / 2 < bx + cw;
    b.style.visibility = onRow && onCrab ? 'hidden' : '';
  };
  // ---------- the BONK (the crew's big moment) ----------
  // Fénec flat with dizzy stars where the hammer caught him; then he sits up with his sack open and words fly out
  Stage.prototype.bonk = function (k, words, pts, ms, x) {
    const g = this.g;
    if (!g) return;
    ms = ms || 1100;
    if (x != null) { this.f = { mode: 'flat', x, x0: x, x1: x, dir: 1, t0: Date.now(), t1: Date.now() + ms }; this.fx = x; this.placeFenPx(); }
    const c = this.cr(k);
    this.fen.classList.remove('crouch', 'running', 'flip');
    this.fenPose('bonk');
    this.fenStars.classList.remove('hidden');
    this.bubble.classList.add('hidden');
    this.pbubble.classList.add('hidden');
    this.root.classList.add('bonking');
    this.shake('big');
    const px = this.xPx(this.fx);
    const burst = el('i', 'tcs-burst');
    burst.style.left = px + 'px'; burst.style.top = g.feet - g.fenH * 0.3 + 'px';
    this.under.appendChild(burst);
    const stamp = el('b', 'tcs-stamp', '¡BONK!');
    let fsz = Math.max(24, Math.min(100, g.fenH * 0.5));
    let sx = Math.max(fsz * 1.7, Math.min(g.W - fsz * 1.7, px)), sy = g.feet - g.fenH * 0.62 - fsz * 0.62;
    const dBot = g.domeTop + Math.min(g.crabW * 0.2, g.H * 0.16) + 22;
    if (sy - fsz * 0.6 < dBot) {                     // (no room above on a short stage: beside him on the dock, never on a face)
      sy = g.feet - fsz * 0.7;
      // (beside him on the wider side; a smaller stamp when even that side is short: never on him)
      const half = g.fenH * 0.7, room = Math.max(px - half, g.W - px - half) - 6;
      if (room < fsz * 3.5) fsz = Math.max(16, room / 3.5);
      const side = px - half > g.W - px - half ? -1 : 1;
      sx = px + side * (half + fsz * 1.75);
    }
    stamp.style.fontSize = fsz + 'px';
    stamp.style.left = sx + 'px';
    stamp.style.top = sy + 'px';
    this.fxl.appendChild(stamp);
    this.later(Math.min(1100, ms), () => stamp.remove());
    this.later(ms, () => burst.remove());
    // the words fly out of his sack (pinyin chips) toward the cockpits
    this.later(reduced() ? 0 : Math.min(450, ms * 0.4), () => {
      if (this.f.mode === 'flat') this.fenPose('spill');
      stamp.remove();                                   // (he sits up with the open sack: the stamp has said it, his face stays clear)
      this.fenStars.classList.add('hidden');
      const list = (words && words.length ? words : ['¡+' + (pts || 2) + '!']).slice(0, 6);
      const bx = this.bodyPx(this.crabX);
      list.forEach((w, i) => {
        const chip = el('b', 'tcs-word', w);
        chip.style.left = px + 'px'; chip.style.top = g.feet - g.fenH * 0.5 + 'px';
        const dest = c || this.crew[i % Math.max(1, this.crew.length)];
        const tx = dest ? bx + dest.rx : g.W / 2, ty = dest ? dest.dy : g.H * 0.1;
        chip.style.setProperty('--dx', Math.round(tx - px + (Math.random() - 0.5) * 40) + 'px');
        chip.style.setProperty('--dy', Math.round(ty - (g.feet - g.fenH * 0.5)) + 'px');
        chip.style.animationDelay = (i * 120) + 'ms';
        this.fxl.appendChild(chip);
        this.later(1700 + i * 120, () => chip.remove());
      });
      if (c && !reduced()) { c.dome.classList.remove('glow'); void c.dome.offsetWidth; c.dome.classList.add('glow'); this.later(1500, () => c.dome.classList.remove('glow')); }
    });
    this.later(ms + 200, () => { this.root.classList.remove('bonking'); if (this.runK != null) this.runPose(); });
  };
  // ---------- «1 contra 3»: a kid is Fénec this round ----------
  // k = the runner (null = the computer's Fénec again); me = my phone runs him (the camera from behind); x = his start
  Stage.prototype.setRunner = function (k, me, x, name, skin) {
    if (k == null && this.runK == null) return;          // (the computer's Fénec keeps his pose: crew mode never notices)
    this.runK = k != null ? k : null;
    this.runMe = this.runK != null && !!me;
    this.runS = [];
    this.root.classList.toggle('vs-run', this.runK != null);
    this.root.classList.toggle('run-me', this.runMe);
    this.markRunner();
    this.fen.classList.remove('crouch', 'running', 'stunned', 'dashing');
    this.fenStars.classList.add('hidden');
    if (this.runK == null) { this.me = null; this.runTag.classList.add('hidden'); this.fenPose('idle'); this.fen.classList.remove('flip'); if (this.g) this.placeFenPx(); return; }
    const sx = clamp(x != null ? x : this.fx, 0, MAXX);
    this.f = { mode: 'idle', x: sx, x0: sx, x1: sx, dir: 1, t0: 0, t1: 0 };
    this.fx = sx;
    this.me = this.runMe ? { x: sx, tx: sx, dashTo: null, dashFrom: 0, dashAt: 0, stunUntil: 0, dir: 1, moving: false } : null;
    if (!this.runMe) { this.runS = [{ t: Date.now(), x: sx }]; this.runTagName.textContent = name || ''; this.runTagImg.src = head(skin || 'dralingo'); }
    this.runTag.classList.toggle('hidden', this.runMe);
    this.runPose();
    if (this.g) this.placeFenPx();
  };
  // the runner is out on the dock this round: his cockpit stands empty (a 🦊 in the glass)
  Stage.prototype.markRunner = function () { this.crew.forEach((c) => c.dome.classList.toggle('running', this.runK != null && c.k === this.runK)); };
  Stage.prototype.runPose = function () {
    if (this.runK == null) return;
    const m = this.me;
    if (this.runMe) { this.fenPose(m && m.moving ? 'backrun' : 'back'); this.fen.classList.toggle('flip', !!(m && m.dir < 0)); }
    else { const v = this._rv || 0; this.fenPose(Math.abs(v) > 0.0004 ? (v < 0 ? 'left' : 'right') : 'idle'); this.fen.classList.remove('flip'); }
  };
  // my finger: he runs there at his speed (never faster: the server clamps the same)
  Stage.prototype.runTarget = function (x) { if (this.me) this.me.tx = clamp(x, 0, MAXX); };
  Stage.prototype.myX = function () { return this.me ? Math.round(this.me.x * 1000) / 1000 : null; };
  Stage.prototype.stepMe = function (dt) {
    const m = this.me, now = Date.now(), v = this.o.vs || {};
    let moving = false;
    if (now < m.stunUntil) { m.tx = m.x; }
    else if (m.dashTo != null) {
      const p = clamp((now - m.dashAt) / Math.max(1, v.dashMs || 220), 0, 1);
      m.x = m.dashFrom + (m.dashTo - m.dashFrom) * p;
      moving = true;
      if (p >= 1) { m.dashTo = null; m.tx = m.x; this.fen.classList.remove('dashing'); }
    } else {
      const step = ((v.run || 1.5) * dt) / 1000, d = m.tx - m.x;
      if (Math.abs(d) > 0.004) { m.x = Math.abs(d) <= step ? m.tx : m.x + Math.sign(d) * step; m.dir = Math.sign(d); moving = true; }
    }
    if (moving !== m.moving) { m.moving = moving; this.runPose(); }
    else if (moving && this.fen.classList.contains('flip') !== (m.dir < 0)) this.runPose();
    return m.x;
  };
  // a dash: a quick burst (dir -1 / 1); false when he can't (stunned, already dashing)
  Stage.prototype.dash = function (dir) {
    const m = this.me, v = this.o.vs || {};
    if (!m || Date.now() < m.stunUntil || m.dashTo != null) return false;
    m.dashFrom = m.x; m.dashTo = clamp(m.x + (dir < 0 ? -1 : 1) * (v.dashX || 1.2), 0, MAXX); m.dashAt = Date.now(); m.dir = dir < 0 ? -1 : 1;
    this.dashFx(m.dir);
    return true;
  };
  Stage.prototype.dashFx = function (dir) {
    if (reduced()) return;
    this.fen.classList.toggle('dash-l', dir < 0);
    this.fen.classList.remove('dashing'); void this.fen.offsetWidth; this.fen.classList.add('dashing');
    this.later(420, () => this.fen.classList.remove('dashing'));
  };
  // the relayed runner (a crewmate's phone or the projector): his last spots, drawn ahead by his speed over the trip
  Stage.prototype.runAt = function (x) {
    const now = Date.now();
    this.runS.push({ t: now, x: clamp(x, 0, MAXX) });
    while (this.runS.length > 6 || (this.runS.length > 2 && now - this.runS[0].t > 600)) this.runS.shift();
  };
  Stage.prototype.relayX = function (dt) {
    const S2 = this.runS, a = S2[0], b = S2[S2.length - 1], now = Date.now();
    let v = S2.length > 1 && b.t > a.t ? (b.x - a.x) / (b.t - a.t) : 0;                          // (spots per ms)
    if (now - b.t > 400) v = 0;
    const want = clamp(b.x + v * clamp(now - b.t + (this.o.lead || 120), 0, 350), 0, MAXX);
    const k = clamp(dt / 90, 0, 1);
    const x = this.fx + (want - this.fx) * k;
    const was = this._rv || 0;
    this._rv = v;
    if ((Math.abs(v) > 0.0004) !== (Math.abs(was) > 0.0004) || Math.sign(v) !== Math.sign(was)) this.runPose();
    return x;
  };
  // a hit on MY runner: he is stunned (dizzy stars, he can't move for ms); the words fly out of his sack to the crab
  Stage.prototype.stunMe = function (ms, words) {
    const g = this.g, m = this.me;
    if (m) { m.stunUntil = Date.now() + (ms || 1000); m.dashTo = null; m.tx = m.x; }
    this.fen.classList.remove('stunned'); void this.fen.offsetWidth; this.fen.classList.add('stunned');
    this.fenStars.classList.remove('hidden');
    this.shake('big');
    this.later(ms || 1000, () => { this.fen.classList.remove('stunned'); this.fenStars.classList.add('hidden'); });
    if (!g || reduced()) return;
    const px = this.xPx(this.fx), bx = this.bodyPx(this.crabX);
    (words || []).slice(0, 4).forEach((w, i) => {
      const chip = el('b', 'tcs-word', w);
      chip.style.left = px + 'px'; chip.style.top = g.feet - g.fenH * 0.5 + 'px';
      const dest = this.crew[i % Math.max(1, this.crew.length)];
      chip.style.setProperty('--dx', Math.round((dest ? bx + dest.rx : g.W / 2) - px) + 'px');
      chip.style.setProperty('--dy', Math.round((dest ? dest.dy : g.H * 0.1) - (g.feet - g.fenH * 0.5)) + 'px');
      chip.style.animationDelay = (i * 120) + 'ms';
      this.fxl.appendChild(chip);
      this.later(1700 + i * 120, () => chip.remove());
    });
  };
  // ---------- El Péndulo ----------
  Stage.prototype.paintAnger = function () {
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
  Stage.prototype.pendSay = function (kind, ms, text) {
    const g = this.g;
    if (!g || this.root.classList.contains('bonking')) return;   // (a bonk speaks for itself: nothing over the cockpits)
    const b = this.pbubble;
    b.textContent = text || pick(PLINES[kind] || PLINES.eat);
    const pr = this.pend.getBoundingClientRect(), br = this.root.getBoundingClientRect();
    b.style.left = Math.max(60, pr.left - br.left - 6 - Math.min(140, g.W * 0.34) / 2) + 'px';   // (beside him, over the sky: never on a face)
    b.style.top = Math.max(4, Math.min(g.H * 0.2, pr.top - br.top + pr.height * 0.45)) + 'px';
    b.classList.remove('hidden');
    this.cancel(this._pbT);
    this._pbT = this.later(ms || 1400, () => b.classList.add('hidden'));
  };
  // a hammer charge flies into El Péndulo and he EATS it («¡Ñam!»): he grows. from = { x, y } in this stage's px (my
  // own hammer meter on my phone), else from the crab's cockpits
  Stage.prototype.eat = function (anger, from, ate) {
    const g = this.g;
    this.anger = anger;
    if (g && !reduced()) {
      const sp = el('i', 'tcs-charge' + (ate === false ? ' empty' : ''));
      sp.appendChild(img(null, A + 'hammer.webp'));
      const pr = this.pend.getBoundingClientRect(), br = this.root.getBoundingClientRect();
      const tx = pr.left - br.left + pr.width / 2, ty = pr.top - br.top + pr.height * 0.74;
      const sx = from ? from.x : this.bodyPx(this.crabX), sy = from ? from.y : g.domeTop;
      sp.style.left = sx + 'px'; sp.style.top = sy + 'px';
      sp.style.setProperty('--dx', Math.round(tx - sx) + 'px');
      sp.style.setProperty('--dy', Math.round(ty - sy) + 'px');
      this.fxl.appendChild(sp);
      this.later(720, () => sp.remove());
      this.later(560, () => {
        this.pend.dataset.mood = 'eat';
        this.pendImg.src = A + PEND.eat + '.webp';
        this.pend.classList.remove('gulp'); void this.pend.offsetWidth; this.pend.classList.add('gulp');
        this.later(700, () => { this.pend.dataset.mood = 'idle'; this.paintAnger(true); });
      });
    }
    this.later(reduced() ? 0 : 600, () => { this.paintAnger(true); this.pendSay('eat', 1100); });
  };
  Stage.prototype.feed = function (anger) { this.eat(anger, null); };
  // right answers in a row calm him: he squeaks and shrinks
  Stage.prototype.calm = function (anger) {
    const was = this.anger;
    this.anger = anger;
    if (Math.floor(was) !== Math.floor(anger) || anger <= 0) {
      this.pend.dataset.mood = 'squeak';
      this.pendImg.src = A + (anger <= 0 ? PEND.dizzy : PEND.squeak) + '.webp';
      if (anger > 0) this.pendSay('calm', 1100);
      this.later(900, () => { this.pend.dataset.mood = 'idle'; this.paintAnger(true); });
    } else this.paintAnger(true);
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
  // caught: the crab walks under him, every hammer slams around him, he is flat, his sack spills every word, then he runs
  // off; escaped: he laughs, kicks the crab and it falls apart in a puff (comic), he cheers
  Stage.prototype.ending = function (caught, words) {
    const g = this.g;
    if (!g) return;
    this.bubble.classList.add('hidden');
    this.playing = false;
    const at = this.fx;
    if (caught) {
      this.steer(at);
      const offs = [0, -0.6, 0.6, -0.3, 0.3];
      this.crew.forEach((c, i) => { c.off = offs[i % offs.length]; c.charges = 1; c.st = 'armed'; this.paintHam(c, true, 220); this.later(i === 0 ? 700 : 450 + i * 70, () => this.slam(c.k, clamp(at + offs[i % offs.length], 0, MAXX), 360)); });
      this.later(1080, () => this.bonk(this.crew[0] ? this.crew[0].k : null, (words || []).slice(0, 6), 0, 2600, at));
      this.later(1900, () => this.crew.forEach((c) => { c.st = 'idle'; this.paintHam(c, true, 420); }));
      this.later(3100, () => { const to = at < MAXX / 2 ? MAXX : 0; const dur = (Math.abs(to - at) / 3.2) * 1000; this.fenec({ mode: 'run', x: at, x0: at, x1: to, dir: to > at ? 1 : -1, ms: dur, dur }); this.fenPose('run'); this.fen.classList.toggle('flip', to < at); this.taunt('x', '¡La próxima vez, Dralingo!', 2600); this.later(dur + 50, () => { this.fenec({ mode: 'idle', x: to, x0: to, x1: to, dir: 1, ms: 9999, dur: 9999 }); this.fenPose('laugh'); }); });
      this.later(1350, () => { this.say('¡ATRAPADO! 🎉', 'win big'); this.crew.forEach((c, i) => this.later(i * 90, () => { c.dome.classList.remove('cheer'); void c.dome.offsetWidth; c.dome.classList.add('cheer'); })); });
    } else {
      this.fenPose('laugh');
      this.taunt('x', '¡No me atrapan! 😆', 1600);
      this.later(900, () => { this.placeFen(this.crabX); this.fenPose('kick'); });
      this.later(1350, () => {
        this.crabImg.src = A + 'crab-broken.webp';
        this.root.classList.add('broken');
        this.crew.forEach((c) => { c.st = 'idle'; this.paintHam(c, true, 500); });
        const pf = el('i', 'tcs-puff');
        pf.style.left = this.bodyPx(this.crabX) + 'px'; pf.style.top = g.crabT + g.crabH * 0.6 + 'px';
        this.fxl.appendChild(pf);
        this.later(1400, () => pf.remove());
        this.shake('big');
        this.say('¡SE ESCAPÓ! 😜', 'lose big');
      });
      this.later(2400, () => this.taunt('x', '¡La próxima vez, Dralingo!', 2400));
    }
  };
  Stage.prototype.reset = function () {
    this.setRunner(null);
    this.crabImg.src = A + 'crab-body.webp';
    this.root.classList.remove('broken', 'bonking', 'walking', 'walk-l', 'walk-r');
    this.fen.classList.remove('runoff', 'crouch', 'running', 'flip');
    this.fenPose('idle');
    this.fenStars.classList.add('hidden');
    this.setAnger(0);
    this.setCaptain(null);
    this.crabTo(MAXX / 2, MAXX / 2, true);
    this.placeFen(MAXX / 2);
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
  root.CrabStage = { Stage, head, fig, freeze, preload, SPOTS, MAXX, LINES };
})(typeof window !== 'undefined' ? window : this);
