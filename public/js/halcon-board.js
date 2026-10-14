// Ojos de Halcón — the Mario Party board and the TV studio, shared by the phone (js/player-halcon.js) and the projector
// (js/host-halcon.js). The board is the minigame of the video (Super Mario Party «Looking for Love»): a brass frame with
// four round windows (top · right · bottom · left) around an LED screen split in stalls, one per player of the board,
// each kid as their FULL-BODY saga character; score chips with the heads on top, the round dots, a band across the
// screen for «¡Mira la respuesta correcta!» / the question / «¡YA!» / «¡FINAL!». A look turns the character toward the
// window (lean + turn + a beam of light from the eyes to the window); the resolve gives the right looks a glow ring,
// sparkles, «+5» and the victory pose, the wrong ones a blue dim and the sad slump; the chips count up.
// The studio is the wide shot: the board on the wall of a Dubai TV set (arched windows with the skyline, polished
// floor, landmark props), the board's characters run in (intro) or the winner poses while the others fall (finale).
// window.HalconBoard = { Board, Studio, art, head, preload, skinOk }.
(function (root) {
  'use strict';
  const CAST = ['dralingo', 'fer', 'hamdan', 'latifa', 'aileen', 'adric', 'adrian'];
  const ANIMALS = ['camel', 'plane', 'falcon', 'oryx'];
  const SKINS = CAST.concat(ANIMALS);
  const POSE_FILE = { idle: 'ready', ok: 'victory', win: 'victory', no: 'sad', lose: 'sad' };
  // animated victory loops (phone-safe "lite" versions, 160–280 KB) for the finale winner
  const WIN_ANIM = { dralingo: '/assets/dralingo/anim/cheer-lite.webp', adric: '/assets/cast/anim/adric-cheer-lite.webp' };
  const POS_NAME = ['de arriba', 'de la derecha', 'de abajo', 'de la izquierda'];
  const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const skinOk = (s) => (SKINS.includes(s) ? s : 'dralingo');
  const isAnimal = (s) => ANIMALS.includes(s);
  // the character a kid plays as, exactly like the server (public/js/snow-map.js skinFor): their lobby pick (old
  // emoji included) or one picked from their name
  const EMOJI = {
    '🐉': 'dralingo', '🐲': 'dralingo', '👨‍🏫': 'fer', '🧔': 'hamdan', '🧕': 'latifa', '🌎': 'aileen', '🐕': 'adric',
    '🐶': 'adric', '🗺️': 'adrian', '🗺': 'adrian', '🐪': 'camel', '🐫': 'camel', '✈️': 'plane', '✈': 'plane',
    '🦅': 'falcon', '🦌': 'oryx',
  };
  function skinFor(avatar, name) {
    if (typeof avatar === 'string') {
      if (EMOJI[avatar]) return EMOJI[avatar];
      if (SKINS.includes(avatar)) return avatar;
    }
    const s = String(name || '').toLowerCase();
    let h = 7;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return SKINS[h % SKINS.length];
  }
  function art(skin, pose, animated) {
    skin = skinOk(skin);
    if (animated && pose === 'win' && WIN_ANIM[skin]) return WIN_ANIM[skin];
    if (isAnimal(skin)) return '/assets/saga/anim/' + skin + '-still.webp';
    return '/assets/halcon/cast/' + skin + '-' + (POSE_FILE[pose] || 'ready') + '.webp';
  }
  const head = (skin) => '/assets/saga/avatars/' + skinOk(skin) + '.webp';
  const pre = {};
  function preload(skins) {
    (skins || []).forEach((s) => ['idle', 'ok', 'no'].forEach((p) => {
      const u = art(s, p);
      if (!pre[u]) { pre[u] = new Image(); pre[u].src = u; }
    }));
  }
  function el(tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function bindTap(node, fn) {
    let last = 0;
    const go = (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') e.preventDefault();
      const t = Date.now();
      if (t - last < 250) return;                 // pointerdown + click of one tap
      last = t;
      fn();
    };
    node.addEventListener('pointerdown', go);
    node.addEventListener('click', go);
  }

  // ======================= the board =======================
  // o: { layout: 'tall' (phone portrait: stalls 2×2) | 'wide' (projector / landscape: stalls in a row), mini, onTap(pos) }
  function Board(host, o) {
    this.o = o || {};
    this.seats = [];
    this.stallEls = {};
    this.chipEls = {};
    this.looks = {};
    this.shown = {};
    this.you = null;
    this.mine = null;
    const r = this.root = el('div', 'hcb ' + (this.o.layout === 'wide' ? 'hcb-wide' : 'hcb-tall') + (this.o.mini ? ' hcb-mini' : ''));
    const frame = this.frame = el('div', 'hcb-frame');
    // the score chips sit in the two top corners of the frame (left / right of the top window), like the video
    this.chipsL = el('div', 'hcb-chips l');
    this.chipsR = el('div', 'hcb-chips r');
    const cross = this.cross = el('div', 'hcb-cross');
    cross.append(this.chipsL, this.chipsR, el('i', 'hcb-star bl'), el('i', 'hcb-star br'));
    this.wins = [0, 1, 2, 3].map((pos) => {
      const w = el(this.o.onTap ? 'button' : 'div', 'hcb-win w' + pos);
      w.dataset.pos = pos;
      if (this.o.onTap) { w.type = 'button'; w.disabled = true; w.setAttribute('aria-label', 'Ventana ' + POS_NAME[pos]); }
      const g = el('span', 'hcb-glass');
      const im = el('img', 'hcb-pic');
      im.alt = '';
      g.append(im, el('b', 'hcb-txt'));
      w.appendChild(g);
      if (this.o.onTap) bindTap(w, () => this.o.onTap(pos));
      return w;
    });
    const screen = this.screen = el('div', 'hcb-screen');
    this.dotsEl = el('div', 'hcb-dots');
    this.timerEl = el('div', 'hcb-timer');
    this.timerFill = el('i');
    this.timerEl.appendChild(this.timerFill);
    this.stallsEl = el('div', 'hcb-stalls');
    this.band = el('div', 'hcb-band');
    this.bandText = el('span');
    this.band.appendChild(this.bandText);
    screen.append(this.stallsEl, this.dotsEl, this.timerEl);
    cross.append(this.wins[0], this.wins[3], screen, this.wins[1], this.wins[2], this.band);   // the band spans the frame
    this.beams = el('div', 'hcb-beams');
    frame.append(cross, this.beams);
    r.appendChild(frame);
    host.appendChild(r);
    this._onResize = () => this.fit();
    root.addEventListener('resize', this._onResize);
  }
  // sizes come from the board's own box: the window size drives everything (on a phone never under 84 px: the window
  // is the button)
  Board.prototype.fit = function () {
    const w = this.root.clientWidth, h = this.root.clientHeight;
    if (!w || !h) return;
    let win = this.o.layout === 'wide' ? Math.min(h * 0.22, w * 0.105) : Math.min(w * 0.25, h * 0.165);
    if (!this.o.mini) win = Math.max(84, win);
    win = Math.min(win, this.o.mini ? 132 : 118);
    this.root.style.setProperty('--win', Math.round(win) + 'px');
    this.relayout();
  };
  Board.prototype.destroy = function () {
    root.removeEventListener('resize', this._onResize);
    if (this.root.parentNode) this.root.parentNode.removeChild(this.root);
  };
  // seats: [{ id, name, skin, score, on }]; you: my seat id (phone) or null (projector)
  Board.prototype.setSeats = function (seats, you) {
    this.seats = (seats || []).slice();
    if (you !== undefined) this.you = you;
    const n = Math.max(1, Math.min(5, this.seats.length));
    this.root.className = this.root.className.replace(/\s?hcb-n\d/g, '') + ' hcb-n' + n;
    this.chipsL.innerHTML = '';
    this.chipsR.innerHTML = '';
    this.chipEls = {};
    this.stallsEl.innerHTML = '';
    this.stallEls = {};
    const half = Math.ceil(this.seats.length / 2);
    this.seats.forEach((s, i) => {
      const c = el('div', 'hcb-chip' + (s.id === this.you ? ' me' : '') + (s.on === false ? ' off' : ''));
      const im = el('img');
      im.src = head(s.skin);
      im.alt = '';
      const num = el('b', null, String(s.score || 0));
      c.append(im, num);
      (i < half ? this.chipsL : this.chipsR).appendChild(c);
      this.chipEls[s.id] = { c, num };
      this.shown[s.id] = s.score || 0;

      const st = el('div', 'hcb-stall' + (s.id === this.you ? ' me' : '') + (s.on === false ? ' off' : '') + (isAnimal(s.skin) ? ' animal' : ''));
      st.dataset.seat = s.id;
      st.style.setProperty('--i', i);
      const fig = el('div', 'hcb-fig');
      const img = el('img', 'hcb-char');
      img.alt = s.name;
      img.draggable = false;
      img.src = art(s.skin, 'idle');
      fig.appendChild(img);
      const tag = el('div', 'hcb-tag');
      tag.appendChild(el('b', null, s.name));
      if (s.id === this.you) tag.appendChild(el('em', null, 'TÚ'));
      const spark = el('div', 'hcb-spark');
      for (let k = 0; k < 6; k++) spark.appendChild(el('i'));
      st.append(el('i', 'hcb-ring'), spark, fig, tag, el('div', 'hcb-pop'));
      this.stallsEl.appendChild(st);
      this.stallEls[s.id] = { st, fig, img, skin: s.skin, pop: st.lastChild, c };
    });
    preload(this.seats.map((s) => s.skin));
    this.fit();
    this.beams.innerHTML = '';
    const looks = this.looks;
    this.looks = {};
    Object.keys(looks).forEach((sid) => this.look(Number(sid), looks[sid], true));
  };
  Board.prototype.setOn = function (seatId, on) {
    const x = this.stallEls[seatId];
    if (x) { x.st.classList.toggle('off', !on); x.c.classList.toggle('off', !on); }
  };
  Board.prototype.dots = function (round, rounds) {
    this.dotsEl.innerHTML = '';
    for (let i = 1; i <= rounds; i++) this.dotsEl.appendChild(el('i', i < round ? 'done' : i === round ? 'now' : ''));
  };
  // the band across the screen («Look at the ♥!»): kind '' | 'q' (a question) | 'go' | 'final'
  Board.prototype.bandShow = function (text, kind) {
    this.bandText.textContent = '';
    // a question: the asked word «…» in big gold, the one thing to catch at a glance (the video's ♥)
    String(text).split(/(«[^»]+»)/).forEach((part) => {
      if (!part) return;
      if (kind === 'q' && /^«[^»]+»$/.test(part)) this.bandText.appendChild(el('em', 'key', part.slice(1, -1)));
      else this.bandText.appendChild(document.createTextNode(part));
    });
    this.band.className = 'hcb-band show' + (kind ? ' ' + kind : '') + (String(text).length > 38 ? ' long' : '');
  };
  Board.prototype.bandHide = function () { this.band.classList.remove('show'); };
  // a new round: windows closed, everybody facing front, no beams
  Board.prototype.newRound = function () {
    this.looks = {};
    this.mine = null;
    this.beams.innerHTML = '';
    this.beams.classList.remove('fade');
    this.root.classList.remove('resolved', 'answering');
    delete this.root.dataset.len;
    this.wins.forEach((w) => {
      w.className = 'hcb-win w' + w.dataset.pos;
      w.querySelector('.hcb-txt').textContent = '';
      const im = w.querySelector('.hcb-pic');
      im.removeAttribute('src');
      if (this.o.onTap) w.disabled = true;
    });
    Object.values(this.stallEls).forEach((x) => {
      x.st.classList.remove('ok', 'no', 'five', 'looked', 'look0', 'look1', 'look2', 'look3');
      x.img.src = art(x.skin, 'idle');
      x.pop.textContent = '';
      x.pop.className = 'hcb-pop';
      x.c.classList.remove('looked');
    });
    this.timer(0);
  };
  // the answers pop into the windows (text, or pictures with their label); ms = the answer window
  Board.prototype.open = function (opts, pics, ms, total) {
    const longest = Math.max(0, ...opts.map((t) => (t ? String(t).length : 0)));
    this.root.dataset.len = pics ? 'pic' : longest <= 7 ? 's' : longest <= 13 ? 'm' : longest <= 22 ? 'l' : 'xl';
    // round windows: one font size for the four, the largest that keeps every word whole on ≤ 3 lines
    if (!pics && longest <= 13) {
      let k = 0.27;
      opts.forEach((t) => {
        if (!t) return;
        const words = String(t).split(/\s+/);
        const L = Math.max(...words.map((w) => w.length));
        k = Math.min(k, 0.6 / (0.56 * L), (0.6 * 2.6) / (0.56 * String(t).length));
      });
      this.root.style.setProperty('--fs', Math.max(0.11, k).toFixed(3));
    } else this.root.style.removeProperty('--fs');
    this.wins.forEach((w, pos) => {
      const t = opts[pos];
      if (t == null) { w.classList.add('empty'); return; }
      w.querySelector('.hcb-txt').textContent = t;
      if (pics && pics[pos]) { w.querySelector('.hcb-pic').src = pics[pos]; w.classList.add('has-pic'); }
      w.style.setProperty('--d', (pos * 55) + 'ms');
      w.classList.add('open');
      if (this.o.onTap) w.disabled = this.mine != null;
    });
    this.root.classList.add('answering');
    if (ms != null) this.timer(ms, total || ms);
  };
  Board.prototype.timer = function (ms, total) {
    const f = this.timerFill;
    const tot = total || ms || 1;
    f.style.transition = 'none';
    f.style.transform = 'scaleX(' + (ms > 0 ? Math.min(1, ms / tot) : 0) + ')';
    void f.offsetWidth;
    if (ms > 0) { f.style.transition = 'transform ' + ms + 'ms linear'; f.style.transform = 'scaleX(0)'; }
    this._tEnd = Date.now() + Math.max(0, ms || 0);
    this._tTot = tot;
    this.timerEl.classList.toggle('hurry', false);
  };
  Board.prototype.timerHold = function () {
    const left = Math.max(0, (this._tEnd || 0) - Date.now());
    this.timerFill.style.transition = 'none';
    this.timerFill.style.transform = 'scaleX(' + (this._tTot ? Math.min(1, left / this._tTot) : 0) + ')';
  };
  Board.prototype.timeLeft = function () { return Math.max(0, (this._tEnd || 0) - Date.now()); };
  // a kid looked at window `pos` (mine: the phone's own look, locks every window)
  Board.prototype.look = function (seatId, pos, quiet) {
    const x = this.stallEls[seatId];
    if (!x || !(pos >= 0 && pos <= 3)) return;
    this.looks[seatId] = pos;
    x.st.classList.remove('look0', 'look1', 'look2', 'look3');
    x.st.classList.add('look' + pos, 'looked');
    x.c.classList.add('looked');
    if (seatId === this.you) {
      this.mine = pos;
      this.wins.forEach((w, p) => { w.classList.toggle('mine', p === pos); w.classList.add('locked'); if (this.o.onTap) w.disabled = true; });
    }
    this.drawBeam(seatId, pos, quiet);
  };
  // the server said no (the round had just closed): the character turns back to the front
  Board.prototype.unlook = function (seatId) {
    delete this.looks[seatId];
    const x = this.stallEls[seatId];
    if (x) { x.st.classList.remove('look0', 'look1', 'look2', 'look3', 'looked'); x.c.classList.remove('looked'); }
    const b = this.beams.querySelector('[data-seat="' + seatId + '"]');
    if (b) b.remove();
    if (seatId === this.you) {
      this.mine = null;
      const open = this.root.classList.contains('answering');
      this.wins.forEach((w) => { w.classList.remove('mine', 'locked'); if (this.o.onTap) w.disabled = !(open && w.classList.contains('open')); });
    }
  };
  Board.prototype.drawBeam = function (seatId, pos, quiet) {
    const x = this.stallEls[seatId];
    if (!x || !this.frame.offsetWidth) return;
    let b = this.beams.querySelector('[data-seat="' + seatId + '"]');
    if (!b) {
      b = el('i', 'hcb-beam' + (seatId === this.you ? ' me' : ''));
      b.dataset.seat = seatId;
      this.beams.appendChild(b);
    }
    const fr = this.frame.getBoundingClientRect();
    const k = fr.width / this.frame.offsetWidth || 1;           // a scaled camera (CSS transform) still lines up
    const sr = x.st.getBoundingClientRect();
    const wr = this.wins[pos].querySelector('.hcb-glass').getBoundingClientRect();
    const x1 = (sr.left + sr.width / 2 - fr.left) / k, y1 = (sr.top + sr.height * 0.3 - fr.top) / k;
    const x2 = (wr.left + wr.width / 2 - fr.left) / k, y2 = (wr.top + wr.height / 2 - fr.top) / k;
    const len = Math.max(12, Math.hypot(x2 - x1, y2 - y1) - (Math.min(wr.width, wr.height) / k) * 0.42);
    b.style.left = x1 + 'px';
    b.style.top = y1 + 'px';
    b.style.width = len + 'px';
    b.style.setProperty('--ang', (Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI).toFixed(1) + 'deg');
    if (!quiet && !reduced()) { b.classList.remove('grow'); void b.offsetWidth; b.classList.add('grow'); }
  };
  Board.prototype.relayout = function () {
    Object.keys(this.looks).forEach((sid) => this.drawBeam(Number(sid), this.looks[sid], true));
  };
  // the round resolves: the right window glows, right looks shine with +N, wrong ones slump; chips count up
  Board.prototype.resolve = function (correctPos, rows) {
    this.root.classList.remove('answering');
    this.root.classList.add('resolved');
    this.timer(0);
    this.wins.forEach((w, pos) => {
      if (this.o.onTap) w.disabled = true;
      w.classList.toggle('right', pos === correctPos);
      w.classList.toggle('off', pos !== correctPos);
    });
    this.beams.classList.add('fade');
    (rows || []).forEach((r) => {
      const x = this.stallEls[r.id];
      if (!x) return;
      if (r.pos >= 0 && this.looks[r.id] == null) this.look(r.id, r.pos, true);   // a look we missed (reload) still shows
      if (r.pos < 0 && this.looks[r.id] != null) this.unlook(r.id);               // a look the server never counted (too late)
      if (r.id === this.you && r.pos >= 0 && r.pos !== correctPos) this.wins[r.pos].classList.add('miss');
      x.st.classList.add(r.ok ? 'ok' : 'no');
      if (r.pts === 5) x.st.classList.add('five');
      x.img.src = art(x.skin, r.ok ? 'ok' : 'no');
      if (r.ok) {
        x.pop.textContent = '+' + r.pts;
        x.pop.style.setProperty('--d', ((r.rank || 1) - 1) * 140 + 'ms');
        x.pop.className = 'hcb-pop show' + (r.pts === 5 ? ' five' : '');
      }
      this.countTo(r.id, r.score, r.ok ? 350 + ((r.rank || 1) - 1) * 140 : 0);
    });
  };
  Board.prototype.countTo = function (seatId, to, delay) {
    const c = this.chipEls[seatId];
    if (!c || to == null) return;
    const from = this.shown[seatId] || 0;
    this.shown[seatId] = to;
    if (from === to) { c.num.textContent = String(to); return; }
    const run = () => {
      if (reduced()) { c.num.textContent = String(to); return; }
      c.c.classList.remove('bump'); void c.c.offsetWidth; c.c.classList.add('bump');
      const t0 = performance.now(), dur = 520;
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        c.num.textContent = String(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if (delay) setTimeout(run, delay); else run();
  };
  Board.prototype.setScores = function (map) {
    Object.keys(map || {}).forEach((sid) => { const c = this.chipEls[sid]; if (c) { c.num.textContent = String(map[sid]); this.shown[sid] = map[sid]; } });
  };
  // the leader's chip wears the crown (FINAL)
  Board.prototype.crown = function () {
    const best = Math.max(...this.seats.map((s) => this.shown[s.id] || 0));
    this.seats.forEach((s) => { const c = this.chipEls[s.id]; if (c) c.c.classList.toggle('lead', best > 0 && (this.shown[s.id] || 0) === best); });
  };

  // ======================= the studio =======================
  // The wide shot of the Dubai TV set. mode 'intro': the board's characters run in from both sides and stop in front of
  // the board. mode 'finale': the board says «<name> ¡Gana!», the winner poses in front, the others fall on the floor.
  function Studio(host, o) {
    this.o = o || {};
    const s = this.root = el('div', 'hcs' + (this.o.big ? ' hcs-big' : ''));
    const wall = el('div', 'hcs-wall');
    for (let i = 0; i < 3; i++) wall.appendChild(el('div', 'hcs-arch a' + i));
    const board = this.board = el('div', 'hcs-board');
    ['t', 'r', 'b', 'l'].forEach((p) => board.appendChild(el('i', 'hcs-port ' + p)));
    const scr = el('div', 'hcs-board-screen');
    this.t1 = el('span', 'hcs-t1');
    this.t2 = el('b', 'hcs-t2');
    scr.append(this.t1, this.t2);
    board.appendChild(scr);
    wall.appendChild(board);
    const floor = el('div', 'hcs-floor');
    const propL = el('img', 'hcs-prop l');
    propL.src = '/assets/kingdoms/landmarks/burj.webp';
    propL.alt = '';
    const propR = el('img', 'hcs-prop r');
    propR.src = '/assets/kingdoms/landmarks/atlantis.webp';
    propR.alt = '';
    this.cast = el('div', 'hcs-cast');
    this.fx = el('div', 'hcs-fx');
    const hostBox = this.host = el('div', 'hcs-host');
    const hostImg = el('img');
    hostImg.src = '/assets/dralingo/hello.webp';
    hostImg.alt = 'Dralingo';
    this.bubble = el('div', 'hcs-bubble');
    hostBox.append(hostImg, this.bubble);
    s.append(wall, floor, propL, propR, this.cast, this.fx, hostBox);
    host.appendChild(s);
    this.title('Ojos de', 'Halcón');
  }
  Studio.prototype.title = function (t1, t2) { this.t1.textContent = t1 || ''; this.t2.textContent = t2 || ''; };
  Studio.prototype.say = function (text) {
    this.bubble.textContent = text || '';
    this.host.classList.toggle('talk', !!text);
  };
  Studio.prototype.destroy = function () { if (this.root.parentNode) this.root.parentNode.removeChild(this.root); };
  function figure(seat, you, pose, animated) {
    const f = el('div', 'hcs-kid' + (seat.id === you ? ' me' : '') + (isAnimal(seat.skin) ? ' animal' : ''));
    const body = el('div', 'hcs-body');
    const img = el('img');
    img.alt = seat.name;
    img.src = art(seat.skin, pose, animated);
    body.appendChild(img);
    const tag = el('div', 'hcs-tag');
    tag.appendChild(el('b', null, seat.name));
    if (seat.id === you) tag.appendChild(el('em', null, 'TÚ'));
    f.append(body, tag);
    return f;
  }
  // the run-in: seats spread in a row in front of the board, half come from the left, half from the right
  Studio.prototype.intro = function (seats, you) {
    this.root.classList.remove('finale');
    this.root.classList.add('intro');
    this.cast.innerHTML = '';
    const n = seats.length;
    seats.forEach((seat, i) => {
      const f = figure(seat, you, 'idle');
      const x = n === 1 ? 50 : 16 + (68 * i) / (n - 1);
      f.style.setProperty('--x', x + '%');
      f.style.setProperty('--from', (x < 50 ? -60 : 60) + 'vw');
      f.style.setProperty('--i', i);
      this.cast.appendChild(f);
    });
    this.title('Ojos de', 'Halcón');
  };
  // the finale: winners (ids) front and centre, the rest on the floor
  Studio.prototype.finale = function (seats, winners, you, o) {
    o = o || {};
    this.root.classList.remove('intro');
    this.root.classList.add('finale');
    this.cast.innerHTML = '';
    this.fx.innerHTML = '';
    const wins = seats.filter((s) => winners.includes(s.id));
    // the phone's own kid takes the nearest spot among the others (always fully in view)
    const rest = seats.filter((s) => !winners.includes(s.id)).sort((a, b) => (b.id === you) - (a.id === you));
    const names = wins.map((w) => w.name);
    if (!wins.length) this.title('Nadie sumó puntos', '¡A la próxima!');
    else this.title(names.length > 2 ? names.slice(0, 2).join(', ') + '…' : names.join(' y '), wins.length > 1 ? '¡Ganan!' : '¡Gana!');
    // The losers sit or fall like the video's ending, each in its own slot (no bodies piled on each other): on a wide
    // screen a loser alone on its side falls outward, the others sit; on a phone held upright they sit at the edges
    // (the far ones a step behind), always clear of the winner.
    const portrait = this.root.clientHeight > this.root.clientWidth;
    const perSide = [Math.ceil(rest.length / 2), Math.floor(rest.length / 2)];
    rest.forEach((seat, i) => {
      // o.rest 'stand': the projector's board champions cheer at the sides instead of falling
      const stand = o.rest === 'stand';
      const f = figure(seat, you, stand ? 'ok' : 'lose');
      const side = i % 2 === 0 ? -1 : 1;
      const k = Math.floor(i / 2);
      const step = rest.length > 4 ? 10 : 13;
      f.classList.add(stand ? 'stander' : 'loser');
      let x = 50 + side * (23 + k * step);
      if (!stand && portrait) {
        x = 50 + side * (k === 0 ? 36 : 38);
        f.classList.add(side < 0 ? 'sit' : 'sit2');
        if (k > 0) f.classList.add('back');
      } else if (!stand) {
        const alone = perSide[side < 0 ? 0 : 1] === 1;
        f.classList.add(k === 0 && alone ? (side < 0 ? 'fall-l' : 'fall-r') : (side < 0 ? 'sit' : 'sit2'));
      }
      f.style.setProperty('--x', x + '%');
      f.style.setProperty('--i', i);
      this.cast.appendChild(f);
    });
    wins.forEach((seat, i) => {
      const f = figure(seat, you, 'win', o.animated !== false);
      f.classList.add('winner');
      f.style.setProperty('--x', (wins.length === 1 ? 50 : 50 + (i - (wins.length - 1) / 2) * 20) + '%');
      f.style.setProperty('--i', i);
      this.cast.appendChild(f);
    });
    if (!reduced()) {
      const colors = ['#ffc93c', '#f0443a', '#2f7bea', '#26a65b', '#fff7e3', '#c38bff'];
      for (let i = 0; i < 26; i++) {
        const c = el('i', 'hcs-confetti');
        c.style.setProperty('--x', (8 + Math.random() * 84) + '%');
        c.style.setProperty('--d', (Math.random() * 0.9).toFixed(2) + 's');
        c.style.setProperty('--r', Math.round(Math.random() * 360) + 'deg');
        c.style.background = colors[i % colors.length];
        this.fx.appendChild(c);
      }
    }
  };
  // the camera pushes into the board (intro → board view)
  Studio.prototype.zoom = function () { this.root.classList.add('zoom'); };

  root.HalconBoard = { Board, Studio, art, head, preload, skinOk, skinFor, isAnimal, SKINS };
})(typeof window !== 'undefined' ? window : this);
