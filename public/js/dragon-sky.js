// Vuelo del Dragón v2 «La Carrera del Cielo de Dubái» — what the phone (js/player-dragon.js) and the projector
// (js/host-dragon.js) both draw:
//   · a FLYER: the kid's dragoncito (the Bebé Dralingo of Reinos and Mochi in its three flying frames: wings up / level /
//     down, recoloured into the five Mario Party seat colours, /assets/dragon/fly-<colour>-<frame>.webp) with the kid's
//     FULL-BODY saga character standing on its back, a seat-colour trail, «¡Fuego azul!» flames, tailwind streaks, a tag
//   · a SKY: the Dubai course seen from the side, from golden hour into the night: the gradient sky, stars, the moon, a
//     far skyline of lit towers (parallax), the five glossy landmarks of Reinos standing on their islands at their metres
//     (js/dragon-course.js), the water of the Creek with its abras, clouds in front, fireworks in the last 30 s.
//     The camera is a number of metres; everything is placed by transform only (a pool of nodes, no giant layer).
//   · small pieces: a full-body figure in a seat colour (lobby, ceremony), the star, the golden ring, count-ups
// window.DragonSky = { COURSE, colorOf, frame, figure, flyer, Sky, star, ring, preload, art, skinFor, isAnimal, … }.
(function (root) {
  'use strict';
  const C = root.DragonCourse;
  const HB = () => root.HalconBoard;
  const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const A = '/assets/dragon/';
  const LM = '/assets/kingdoms/landmarks/big/';
  const DRALINGO = '/assets/dralingo/power.webp';
  const NEUTRAL = { id: 'gold', name: 'Oro', c: '#ffc93c', d: '#c98a26', s: '#fff3c4' };
  const colorOf = (c) => (c == null || c < 0 ? NEUTRAL : C.COLORS[c] || C.COLORS[0]);
  const frame = (c, f) => A + 'fly-' + (c == null || c < 0 ? 'blue' : (C.COLORS[c] || C.COLORS[1]).id) + '-' + f + '.webp';
  const art = (skin, pose) => (HB() ? HB().art(skin, pose || 'idle') : '/assets/dralingo/hello.webp');
  const skinFor = (avatar, name) => (HB() ? HB().skinFor(avatar, name) : 'dralingo');
  const isAnimal = (skin) => ['camel', 'plane', 'falcon', 'oryx'].includes(skin);
  const lmArt = (id) => LM + id + '.webp';
  const ns = 'http://www.w3.org/2000/svg';
  const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('es-ES');
  const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
  function el(tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function svg(cls, viewBox, inner) {
    const s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', viewBox);
    s.setAttribute('class', cls);
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = inner;
    return s;
  }
  const STAR_D = 'M50 5 L62.5 36 L96 38.5 L70 60 L78.5 93 L50 74.5 L21.5 93 L30 60 L4 38.5 L37.5 36 Z';
  const star = (cls) => svg('ds-star' + (cls ? ' ' + cls : ''), '0 0 100 100', `<path d="${STAR_D}"/>`);
  // the golden ring a flight goes through (geometry, crisp at any size)
  const ring = (cls) => svg('ds-ring' + (cls ? ' ' + cls : ''), '0 0 100 140',
    '<ellipse class="o" cx="50" cy="70" rx="34" ry="62"/><ellipse class="i" cx="50" cy="70" rx="22" ry="48"/><ellipse class="g" cx="44" cy="40" rx="5" ry="14"/>');

  const pre = {};
  function preload(colors, skins) {
    const urls = [];
    (colors || []).forEach((c) => ['up', 'mid', 'down'].forEach((f) => urls.push(frame(c, f))));
    (skins || []).forEach((s) => ['idle', 'ok', 'no'].forEach((p) => urls.push(art(s, p))));
    urls.forEach((u) => { if (!pre[u]) { pre[u] = new Image(); pre[u].decoding = 'async'; pre[u].src = u; } });
  }

  // ---------- a full-body figure (lobby, ceremony): the saga character, a ring and an outline in the seat colour ----------
  function figure(o) {
    const col = colorOf(o.c);
    const f = el('div', 'dsk' + (o.me ? ' me' : '') + (isAnimal(o.skin) ? ' animal' : ''));
    f.style.setProperty('--pc', col.c);
    f.style.setProperty('--pd', col.d);
    const img = el('img', 'dsk-img');
    img.alt = o.name || '';
    img.draggable = false;
    img.decoding = 'async';
    img.src = art(o.skin, o.pose);
    f.append(el('i', 'dsk-ring'), img);
    if (o.tag) {
      const tag = el('div', 'dsk-tag');
      tag.appendChild(el('b', null, o.name || ''));
      if (o.me) tag.appendChild(el('em', null, 'TÚ'));
      f.appendChild(tag);
    }
    f.pose = (p) => { const u = art(o.skin, p); if (img.getAttribute('src') !== u) img.src = u; };
    return f;
  }

  // ---------- a flyer: the dragoncito in the seat colour + the kid standing on its back ----------
  // o: { skin, c, name, me, tag (true: name tag), still (no idle flapping) }
  function flyer(o) {
    const col = colorOf(o.c);
    const f = el('div', 'dsf' + (o.me ? ' me' : '') + (isAnimal(o.skin) ? ' animal' : '') + (o.still ? '' : ' glide'));
    f.style.setProperty('--pc', col.c);
    f.style.setProperty('--pd', col.d);
    f.style.setProperty('--ps', col.s);
    const trail = el('i', 'dsf-trail');
    const wind = el('i', 'dsf-wind');
    const body = el('div', 'dsf-body');
    const frames = {};
    ['up', 'mid', 'down'].forEach((k) => {
      const im = el('img', 'dsf-f f-' + k + (k === 'mid' ? ' on' : ''));
      im.alt = k === 'mid' ? (o.name ? `Dragoncito de ${o.name}` : 'Dragoncito') : '';
      im.draggable = false;
      im.decoding = 'async';
      im.src = frame(o.c, k);
      frames[k] = im;
      body.appendChild(im);
    });
    const rider = el('img', 'dsf-rider');
    rider.alt = o.name || '';
    rider.draggable = false;
    rider.decoding = 'async';
    rider.src = art(o.skin, 'idle');
    const fire = el('i', 'dsf-fire');
    body.append(rider, fire);
    f.append(trail, wind, body);
    if (o.tag !== false) {
      const tag = el('div', 'dsf-tag');
      const b = el('b', null, o.name || '');
      tag.appendChild(b);
      if (o.me) tag.appendChild(el('em', null, 'TÚ'));
      f.appendChild(tag);
      f._name = b;
    }
    let cur = 'mid', beatT = [], poseT = null;
    const show = (k) => { if (k === cur) return; frames[cur].classList.remove('on'); frames[k].classList.add('on'); cur = k; };
    f.frame = show;
    // one wing beat: up → down → level, the body pushed forward and up a little (transform only)
    f.beat = (big) => {
      beatT.forEach(clearTimeout);
      f.classList.remove('glide');
      show('up');
      beatT = [setTimeout(() => show('down'), 70), setTimeout(() => show('mid'), 190)];
      if (!reduced() && body.animate) {
        body.animate([{ transform: 'translate3d(0,0,0) rotate(0deg)' }, { transform: `translate3d(${big ? 10 : 6}px,${big ? -12 : -7}px,0) rotate(-4deg)` }, { transform: 'translate3d(0,0,0) rotate(0deg)' }],
          { duration: 260, easing: 'cubic-bezier(.2,.9,.3,1)' });
      }
    };
    f.glide = (v) => { beatT.forEach(clearTimeout); show('mid'); f.classList.toggle('glide', !!v && !o.still); };
    f.flying = (v) => f.classList.toggle('flap', !!v);       // a rival in a flight: fast wings (css)
    f.pose = (p, ms) => {
      clearTimeout(poseT);
      const u = art(o.skin, p);
      if (rider.getAttribute('src') !== u) rider.src = u;
      if (ms) poseT = setTimeout(() => { rider.src = art(o.skin, 'idle'); }, ms);
    };
    f.fire = (v) => f.classList.toggle('fire', !!v);
    f.tail = (v) => f.classList.toggle('tail', !!v);
    f.off = (v) => f.classList.toggle('off', !!v);
    f.lean = () => {                                            // the tap: my rider leans forward, the dragon perks up
      if (reduced() || !body.animate) return;
      body.animate([{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(4px,-5px,0) rotate(-3deg)' }, { transform: 'translate3d(0,0,0)' }], { duration: 320, easing: 'ease-out' });
    };
    f.dip = () => {                                             // a wrong answer: a dip, then on
      if (reduced() || !body.animate) return;
      body.animate([{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(-4px,16px,0) rotate(6deg)' }, { transform: 'translate3d(0,0,0)' }], { duration: 900, easing: 'cubic-bezier(.3,.7,.4,1)' });
    };
    f.setName = (n) => { if (f._name) f._name.textContent = n; };
    f._skin = o.skin;
    f._c = o.c;
    return f;
  }

  // ---------- the far skyline: towers with lit windows (one SVG strip, drawn once, repeated) ----------
  function skylineSvg(seed) {
    let a = seed >>> 0 || 7;
    const rnd = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
    const W = 1200, H = 220;
    let x = 0, towers = '', wins = '';
    while (x < W) {
      const w = 26 + Math.floor(rnd() * 46);
      const h = 50 + Math.floor(rnd() * 120) + (rnd() < 0.12 ? 50 : 0);
      const top = H - h;
      const kind = rnd();
      if (kind < 0.18) towers += `<path d="M${x} ${H}V${top + 14}L${x + w / 2} ${top}L${x + w} ${top + 14}V${H}Z"/>`;
      else if (kind < 0.3) towers += `<path d="M${x} ${H}V${top + 10}Q${x + w / 2} ${top - 8} ${x + w} ${top + 10}V${H}Z"/>`;
      else towers += `<rect x="${x}" y="${top}" width="${w}" height="${h}" rx="2"/>`;
      if (rnd() < 0.3) towers += `<rect x="${x + w / 2 - 1}" y="${top - 16}" width="2" height="16"/>`;
      for (let wy = top + 12; wy < H - 8; wy += 11) {
        for (let wx = x + 5; wx < x + w - 6; wx += 8) if (rnd() < 0.22) wins += `<rect x="${wx}" y="${wy}" width="3" height="4"/>`;
      }
      x += w + Math.floor(rnd() * 8);
    }
    return `<svg class="dss-city" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><g class="t">${towers}</g><g class="w">${wins}</g></svg>`;
  }
  // an abra (the Creek's wooden water taxi), side view
  const ABRA = '<svg class="dss-abra" viewBox="0 0 120 50" aria-hidden="true"><path class="h" d="M4 30 L116 30 L104 46 L14 46 Z"/><rect class="r" x="22" y="12" width="70" height="4" rx="2"/><rect class="p" x="26" y="16" width="4" height="14"/><rect class="p" x="84" y="16" width="4" height="14"/><path class="c" d="M18 12 Q57 2 96 12 Z"/></svg>';

  // ---------- the sky ----------
  // new Sky(host, { px: metres → px on the course layer, anchor: where the camera sits (0..1 of the width), clouds: n })
  //   .camera(m) · .night(t 0..1) · .frenzy(v) · .burst() (one firework) · .size() · .xOf(m) · .destroy()
  function Sky(host, o) {
    o = o || {};
    this.host = host;
    this.px = o.px || C.PX;
    this.anchor = o.anchor == null ? 0.36 : o.anchor;
    this.cam = 0;
    const r = this.root = el('div', 'dss' + (o.cls ? ' ' + o.cls : ''));
    r.setAttribute('aria-hidden', 'true');
    this.nightEl = el('div', 'dss-night');
    this.starsEl = el('div', 'dss-stars');
    this.moon = el('i', 'dss-moon');
    this.far = el('div', 'dss-far');
    const city = skylineSvg(o.seed || 11);
    this.far.innerHTML = city + city + city;               // three copies: the strip wraps under any width
    this.fw = el('div', 'dss-fw');
    this.course = el('div', 'dss-course');
    this.water = el('div', 'dss-water');
    this.waterIn = el('i', 'dss-waves');
    this.water.appendChild(this.waterIn);
    this.flyers = el('div', 'dss-flyers');
    this.near = el('div', 'dss-near');
    r.append(el('div', 'dss-sky'), this.nightEl, this.starsEl, this.moon, this.far, this.fw, this.water, this.course, this.flyers, this.near);
    host.appendChild(r);
    // pools: landmarks (≤ 3 in view), abras, clouds
    this.lms = [];
    for (let i = 0; i < 3; i++) {
      const n = el('div', 'dss-lm');
      const im = el('img');
      im.alt = '';
      im.decoding = 'async';
      n.appendChild(im);
      n.appendChild(el('span', 'dss-lm-name'));
      n._img = im;
      this.course.appendChild(n);
      this.lms.push(n);
    }
    this.abras = [];
    for (let i = 0; i < 2; i++) {
      const n = el('div', 'dss-ab');
      n.innerHTML = ABRA;
      this.course.appendChild(n);
      this.abras.push(n);
    }
    this.clouds = [];
    const nc = o.clouds == null ? 4 : o.clouds;
    for (let i = 0; i < nc; i++) {
      const c = el('i', 'dss-cloud c' + (i % 3));
      c._base = i / nc;
      c._y = 6 + ((i * 37) % 52);
      c.style.top = c._y + '%';
      this.near.appendChild(c);
      this.clouds.push(c);
    }
    this.t0 = performance.now();
    this.size();
    this.camera(0);
  }
  Sky.prototype.size = function () {
    this.w = this.root.clientWidth || this.host.clientWidth || 390;
    this.h = this.root.clientHeight || this.host.clientHeight || 300;
    this.root.style.setProperty('--skh', this.h + 'px');
    this.farW = this.far.firstChild ? (this.far.firstChild.getBoundingClientRect().width || this.w * 1.6) : this.w * 1.6;
    return { w: this.w, h: this.h };
  };
  // where a point m metres along the course sits on screen (px from the left)
  Sky.prototype.xOf = function (m) { return this.w * this.anchor + (m - this.cam) * this.px; };
  Sky.prototype.camera = function (m, now) {
    this.cam = m;
    const px = this.px, w = this.w;
    // the far city: a quarter of the course's speed (wraps)
    const fx = -(((m * px * 0.22) % this.farW) + this.farW) % this.farW;
    this.far.style.transform = `translate3d(${fx.toFixed(1)}px,0,0)`;
    // the water: as fast as the course (wraps every 80 px)
    const wx = -(((m * px) % 80) + 80) % 80;
    this.waterIn.style.transform = `translate3d(${wx.toFixed(1)}px,0,0)`;
    // the landmarks in view (each lap), placed one by one
    const span = w / px;
    const from = m - span * this.anchor - 60, to = m + span * (1 - this.anchor) + 60;
    const list = [];
    for (let lap = Math.floor(from / C.LAP) - 1; lap <= Math.floor(to / C.LAP) + 1 && list.length < this.lms.length; lap++) {
      C.LANDMARKS.forEach((l) => { const at = lap * C.LAP + l.at; if (at >= from && at <= to && at >= 0 && list.length < this.lms.length) list.push([at, l]); });
    }
    this.lms.forEach((n, i) => {
      const it = list[i];
      if (!it) { if (n._on) { n.style.visibility = 'hidden'; n._on = false; } return; }
      if (n._id !== it[1].id) { n._id = it[1].id; n._img.src = lmArt(it[1].id); n.className = 'dss-lm lm-' + it[1].id; n.lastChild.textContent = it[1].name; }
      if (!n._on) { n.style.visibility = 'visible'; n._on = true; }
      n.style.transform = `translate3d(${(this.xOf(it[0])).toFixed(1)}px,0,0)`;
    });
    // abras on the water every 250 m, half way between landmarks
    this.abras.forEach((n, i) => {
      const step = 250;
      const base = Math.floor(from / step) * step + step / 2 + i * step;
      n.style.transform = `translate3d(${(this.xOf(base)).toFixed(1)}px,0,0)`;
    });
    this.drift(now);
  };
  // the clouds in front: faster than the course (parallax) and drifting on their own (the sky never stands still)
  Sky.prototype.drift = function (now) {
    const t = ((now || performance.now()) - this.t0) / 1000;
    const span = this.w + 260;
    this.clouds.forEach((c) => {
      const x = (((c._base * span - this.cam * this.px * 1.35 - t * 14) % span) + span) % span - 180;
      c.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
    });
  };
  Sky.prototype.night = function (t) {
    t = Math.max(0, Math.min(1, t));
    this.nightEl.style.opacity = t.toFixed(3);
    this.starsEl.style.opacity = (0.15 + 0.85 * t).toFixed(3);
    this.root.style.setProperty('--night', t.toFixed(3));
  };
  Sky.prototype.frenzy = function (v) {
    this.root.classList.toggle('frenzy', !!v);
    clearInterval(this.fwT);
    if (v && !reduced()) {
      this.burst();
      this.fwT = setInterval(() => this.burst(), 1500);
    }
  };
  // one firework over the city (≤ 2 at once; transform + opacity only)
  Sky.prototype.burst = function (x, y) {
    if (reduced() || !this.fw.animate) return;
    if (this.fw.childElementCount > 24) return;
    const cols = ['#ffd76a', '#ff7aa8', '#7ef0d8', '#ffffff', '#b99cff'];
    const cx = x != null ? x : 0.12 + Math.random() * 0.76, cy = y != null ? y : 0.1 + Math.random() * 0.28;
    const col = cols[Math.floor(Math.random() * cols.length)];
    const n = 12;
    for (let i = 0; i < n; i++) {
      const d = el('i', 'dss-spark');
      d.style.left = (cx * 100).toFixed(1) + '%';
      d.style.top = (cy * 100).toFixed(1) + '%';
      d.style.background = col;
      this.fw.appendChild(d);
      const a = (i / n) * Math.PI * 2;
      const r = 34 + Math.random() * 30;
      d.animate([{ transform: 'translate3d(0,0,0) scale(.6)', opacity: 1 }, { transform: `translate3d(${(Math.cos(a) * r).toFixed(1)}px,${(Math.sin(a) * r + 14).toFixed(1)}px,0) scale(.2)`, opacity: 0 }],
        { duration: 1100, easing: 'cubic-bezier(.15,.8,.3,1)' }).onfinish = () => d.remove();
    }
  };
  Sky.prototype.destroy = function () { clearInterval(this.fwT); if (this.root) this.root.remove(); this.root = null; };

  // a number that counts up (ceremony, my card)
  function countUp(node, from, to, ms, done) {
    if (reduced() || !(ms > 0)) { node.textContent = fmt(to); if (done) done(); return; }
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      node.textContent = fmt(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
      else if (done) done();
    };
    requestAnimationFrame(step);
  }

  root.DragonSky = { COURSE: C, NEUTRAL, DRALINGO, colorOf, frame, art, skinFor, isAnimal, lmArt, preload, figure, flyer, Sky, star, ring, countUp, el, fmt, sleep, reduced };
})(window);
