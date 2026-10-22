// ¡No despiertes a Dralingo! — the bedroom, shared by the phone (js/player-dormilon.js) and the projector
// (js/host-dormilon.js). A Chinese palace bedroom at night (Higgsfield art 2026-10-22: the room, Dralingo asleep / stirring
// / awake in his red-lacquered bed, the gang tiptoeing with the golden feather). All motion is code: he breathes, the
// «Z»s float up, the cues rise (0 calm · 1 louder snore · 2 he stirs: one eye cracks open · 3 restless: he trembles, a
// star pops), a stroke = the feather (with the kid's face, like the glove of the video) sweeps his head and «+1» pops, a
// wrong answer = a wobble, the wake-up = he bolts up with the pillow, rays burst, the screen shakes.
// window.DormStage = { Stage, tiptoe, head, flip }. Modes: 'phone' (the kid's screen), 'tile' (a projector board),
// 'big' (the projector's lobby / a one-board class). Test hook: DormStage.freeze(true) pauses every CSS animation.
(function (root) {
  'use strict';
  const A = '/assets/dormilon/';
  const CAST = ['dralingo', 'fer', 'hamdan', 'latifa', 'aileen', 'adric', 'adrian'];
  const FLIP = { latifa: 1, adric: 1, aileen: 1 };        // these hold the feather on their left: mirrored to face the bed
  // where Dralingo's head is in each bed picture (fractions of the 1000×777 picture): the feather sweeps here
  const HEAD = { sleep: [0.31, 0.17], stir: [0.35, 0.18], awake: [0.44, 0.12] };
  const BED_AR = 1000 / 777;
  const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const HB = () => root.HalconBoard || null;
  const Z = (s) => (root.Saga && root.Saga.zoco ? root.Saga.zoco(s) : null);
  function skinOk(s) { return HB() && HB().skinOk ? HB().skinOk(s) : (CAST.includes(s) ? s : 'dralingo'); }
  // the kid's full body tiptoeing: the cast's own tiptoe picture; the animals and El Zoco skins their usual body
  function tiptoe(skin) {
    skin = skinOk(skin);
    if (!Z(skin) && CAST.includes(skin)) return A + 'cast/' + skin + '-tiptoe.webp';
    return HB() ? HB().art(skin, 'idle') : A + 'cast/dralingo-tiptoe.webp';
  }
  const head = (skin) => (HB() ? HB().head(skinOk(skin)) : '/assets/saga/avatars/dralingo.webp');
  const flip = (skin) => !!(FLIP[skinOk(skin)] && !Z(skinOk(skin)));
  const REACT = { shh: '🤫', wow: '😱', lol: '😂', clap: '👏' };
  function el(tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function img(cls, src) { const i = el('img', cls); i.alt = ''; i.draggable = false; if (src) i.src = src; return i; }

  function Stage(box, o) {
    this.o = o || {};
    this.box = box;
    this.timers = [];
    this.cueN = 0;
    const root_ = this.root = el('div', 'dms dms-' + (this.o.mode || 'phone'));
    this.room = el('div', 'dms-room');
    this.glow = el('div', 'dms-glow');
    this.rays = el('div', 'dms-rays');
    this.bedbox = el('div', 'dms-bedbox');
    this.beds = {};
    ['sleep', 'stir', 'awake'].forEach((k) => { this.beds[k] = img('dms-bed dms-' + k, A + 'dralingo-' + k + '.webp'); this.bedbox.appendChild(this.beds[k]); });
    this.zs = el('div', 'dms-zs');
    for (let i = 0; i < 3; i++) this.zs.appendChild(el('span', 'dms-z z' + i, 'Z'));
    this.bedbox.appendChild(this.zs);
    this.star = el('div', 'dms-star', '✦');
    this.bedbox.appendChild(this.star);
    this.kidbox = el('div', 'dms-kid hidden');
    this.kidImg = img('dms-kidimg');
    this.kidName = el('span', 'dms-kidname');
    this.kidbox.append(this.kidImg, this.kidName);
    this.feather = el('div', 'dms-feather hidden');
    this.featherImg = img('dms-fimg', A + 'feather.webp');
    this.fhead = img('dms-fhead');
    this.feather.append(this.featherImg, this.fhead);
    this.pops = el('div', 'dms-pops');
    this.band = el('div', 'dms-band hidden');
    this.reacts = el('div', 'dms-reacts');
    root_.append(this.room, this.glow, this.rays, this.bedbox, this.kidbox, this.feather, this.pops, this.reacts, this.band);
    box.appendChild(root_);
    this.setCue(0);
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
  // the layout: the bed on the right, the kid by the headboard on the left; the room picture by the box's shape
  Stage.prototype.fit = function () {
    const W = this.box.clientWidth || 360, H = this.box.clientHeight || 300;
    if (W < 20 || H < 20) return;
    const tall = H > W * 0.9;
    this.root.classList.toggle('tall', tall);
    this.room.style.backgroundImage = 'url(' + A + (tall ? 'room-tall.webp' : 'room-wide.webp') + ')';
    const bedW = Math.min(W * (tall ? 0.74 : 0.56), H * (tall ? 0.6 : 0.7) * BED_AR);
    const bedH = bedW / BED_AR;
    const bottom = H * (tall ? 0.05 : 0.06);
    const left = tall ? W - bedW - W * 0.015 : Math.max(W * 0.28, W * 0.56 - bedW * 0.42);
    Object.assign(this.bedbox.style, { width: bedW + 'px', height: bedH + 'px', left: left + 'px', bottom: bottom + 'px' });
    const kidH = Math.min(H * (tall ? 0.5 : 0.56), bedH * (tall ? 1.08 : 0.92));
    const kidLeft = Math.max(W * 0.01, left - kidH * (tall ? 0.42 : 0.62));
    Object.assign(this.kidbox.style, { height: kidH + 'px', left: kidLeft + 'px', bottom: (bottom * 0.6) + 'px' });
    this.geo = { W, H, bedW, bedH, left, bottom };
    this.placeFeather();
  };
  Stage.prototype.headAt = function () {
    const g = this.geo;
    if (!g) return [0, 0];
    const pose = this.cueN >= 4 ? 'awake' : this.cueN >= 2 ? 'stir' : 'sleep';
    const [hx, hy] = HEAD[pose];
    return [g.left + g.bedW * hx, g.H - g.bottom - g.bedH + g.bedH * hy];
  };
  Stage.prototype.placeFeather = function () {
    const g = this.geo;
    if (!g) return;
    const [x, y] = this.headAt();
    const s = Math.max(42, g.bedW * 0.26);
    Object.assign(this.feather.style, { width: s + 'px', height: s + 'px', left: (x - s * 0.15) + 'px', top: (y - s * 0.95) + 'px' });
    Object.assign(this.pops.style, { left: x + 'px', top: (y - s * 0.4) + 'px' });
  };
  // 0 calm · 1 louder snore · 2 he stirs · 3 restless · 4 awake
  Stage.prototype.setCue = function (n) {
    n = Math.max(0, Math.min(4, n | 0));
    this.cueN = n;
    const pose = n >= 4 ? 'awake' : n >= 2 ? 'stir' : 'sleep';
    Object.entries(this.beds).forEach(([k, i]) => i.classList.toggle('on', k === pose));
    for (let i = 0; i <= 4; i++) this.root.classList.toggle('cue-' + i, i === n);
    this.placeFeather();
  };
  Stage.prototype.cue = function () { return this.cueN; };
  // the turn kid tiptoes in by the headboard (null = nobody)
  Stage.prototype.kid = function (skin, name, opts) {
    const o = opts || {};
    if (!skin) { this.kidbox.classList.add('hidden'); this.feather.classList.add('hidden'); this.kidSkin = null; return; }
    const changed = this.kidSkin !== skin;
    this.kidSkin = skin;
    this.kidImg.src = tiptoe(skin);
    this.kidImg.classList.toggle('flip', flip(skin));
    this.kidName.textContent = name || '';
    this.kidName.classList.toggle('hidden', !name || this.o.mode === 'phone' && o.me);
    this.kidbox.classList.remove('hidden');
    this.kidbox.classList.toggle('me', !!o.me);
    if (changed && !reduced()) { this.kidbox.classList.remove('in'); void this.kidbox.offsetWidth; this.kidbox.classList.add('in'); }
    this.fhead.src = head(skin);
  };
  Stage.prototype.featherOn = function (v) { this.feather.classList.toggle('hidden', !v); if (v) this.placeFeather(); };
  // a stroke: the feather sweeps his head, «+1» (or «+2» in the last 30 s) pops
  Stage.prototype.stroke = function (pts) {
    this.featherOn(true);
    if (!reduced()) { this.feather.classList.remove('sweep'); void this.feather.offsetWidth; this.feather.classList.add('sweep'); }
    const p = el('b', 'dms-pop' + (pts > 1 ? ' x2' : ''), '+' + (pts || 1));
    this.pops.appendChild(p);
    this.later(1100, () => p.remove());
    this.bump('dms-happy', 500);
  };
  Stage.prototype.bump = function (cls, ms) {
    if (reduced()) return;
    this.bedbox.classList.remove(cls); void this.bedbox.offsetWidth; this.bedbox.classList.add(cls);
    this.later(ms, () => this.bedbox.classList.remove(cls));
  };
  // a wrong answer: he stirs (a wobble, the creak is the page's sound)
  Stage.prototype.stir = function () { this.bump('dms-wobble', 650); const p = el('b', 'dms-pop no', '¡Uy!'); this.pops.appendChild(p); this.later(1000, () => p.remove()); };
  // the wake-up: he bolts up with the pillow, rays, the screen shakes
  Stage.prototype.wake = function () {
    this.setCue(4);
    this.featherOn(false);
    this.root.classList.add('awake');
    if (!reduced()) {
      this.bump('dms-jump', 700);
      this.root.classList.remove('shake'); void this.root.offsetWidth; this.root.classList.add('shake');
      this.later(700, () => this.root.classList.remove('shake'));
    }
  };
  // back to sleep (a new night)
  Stage.prototype.sleep = function () { this.root.classList.remove('awake'); this.setCue(0); if (this.bubble) this.bubble.classList.add('hidden'); };
  Stage.prototype.say = function (text, kind, ms) {
    const b = this.band;
    if (!text) { b.classList.add('hidden'); return; }
    b.textContent = text;
    b.className = 'dms-band' + (kind ? ' ' + kind : '');
    if (this._bandT) clearTimeout(this._bandT);
    if (ms) this._bandT = this.later(ms, () => b.classList.add('hidden'));
  };
  // Dralingo (or anyone at the bed) says a line: a speech bubble by his head for `ms`
  Stage.prototype.speak = function (text, ms) {
    if (!this.bubble) { this.bubble = el('div', 'dms-bubble hidden'); this.root.appendChild(this.bubble); }
    const b = this.bubble;
    if (!text) { b.classList.add('hidden'); return; }
    const [x, y] = this.headAt();
    const g = this.geo || { W: 300 };
    b.textContent = text;
    b.style.left = Math.max(8, Math.min(g.W - 8, x)) + 'px';
    b.style.top = Math.max(6, y - (g.bedW || 200) * 0.36) + 'px';
    b.classList.remove('hidden');
    if (this._bubT) clearTimeout(this._bubT);
    this._bubT = this.later(ms || 2400, () => b.classList.add('hidden'));
  };
  // a reaction from a kid of the board (🤫 😱 😂 👏) floats up with their face
  Stage.prototype.react = function (e, skin) {
    if (!REACT[e]) return;
    if (this.reacts.childElementCount > 6) this.reacts.firstChild.remove();
    const r = el('span', 'dms-react');
    r.style.left = (8 + Math.random() * 70) + '%';
    if (skin) r.appendChild(img('dms-rhead', head(skin)));
    r.appendChild(el('b', null, REACT[e]));
    this.reacts.appendChild(r);
    this.later(2200, () => r.remove());
  };

  let frozen = false;
  function freeze(v) {
    frozen = !!v;
    if (!document.getAnimations) return;
    document.getAnimations().forEach((a) => { try { if (frozen) { a.pause(); a.currentTime = Math.min(400, Number(a.currentTime) || 0) + 400; } else a.play(); } catch (_) {} });
  }
  function preload() {
    ['dralingo-sleep', 'dralingo-stir', 'dralingo-awake', 'feather'].forEach((n) => { const i = new Image(); i.src = A + n + '.webp'; });
  }
  root.DormStage = { Stage, tiptoe, head, flip, REACT, freeze, preload, skinOk };
})(typeof window !== 'undefined' ? window : this);
