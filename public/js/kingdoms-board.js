// Reinos de Colores — shared SVG hex board (projector + phones).
// KdBoard.create(svg, board, own, opts) draws the board once; .set(id, team, anim) recolours a single tile,
// so updates stay cheap. board = { R, castles: {red, gold}, landmarks: {tileId: key}, tiles: [[id, q, r], …] }.
// Dubai landmarks stand on their tiles like board-game pieces (own layer, drawn over the tiles, never catching taps)
// with a badge showing their bonus, painted in the colour of the kingdom that holds them.
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const S = 40;                      // hex radius in SVG units
  const SQ3 = Math.sqrt(3);
  const COLORS = {
    red:  { fill: '#f0443a', deep: '#b22a22' },
    gold: { fill: '#2f7bea', deep: '#1d52a8' },
  };
  // Landmark pieces (assets/kingdoms/landmarks/<key>.webp): width in board units + picture aspect (h / w).
  // Same names/bonuses as core/kingdoms.js LANDMARKS.
  const LANDMARKS = {
    burj: { name: 'Burj Khalifa', the: 'el Burj Khalifa', bonus: 5, w: 47, ar: 471 / 158 },
    arab: { name: 'Burj Al Arab', the: 'el Burj Al Arab', bonus: 3, w: 54, ar: 306 / 158 },
    museum: { name: 'Museo del Futuro', the: 'el Museo del Futuro', bonus: 3, w: 58, ar: 175 / 164 },
    frame: { name: 'Marco de Dubái', the: 'el Marco de Dubái', bonus: 3, w: 52, ar: 261 / 158 },
    atlantis: { name: 'Atlantis', the: 'el Atlantis', bonus: 3, w: 68, ar: 198 / 251 },
  };
  const LM_SRC = (k) => '/assets/kingdoms/landmarks/' + k + '.webp';

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v));
    if (parent) parent.appendChild(e);
    return e;
  }
  function center(q, r) { return [S * SQ3 * (q + r / 2), S * 1.5 * r]; }
  function points(cx, cy, s) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i - 30);
      pts.push((cx + s * Math.cos(a)).toFixed(1) + ',' + (cy + s * Math.sin(a)).toFixed(1));
    }
    return pts.join(' ');
  }

  function create(svg, board, own, opts) {
    opts = opts || {};
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const R = board.R;
    const w = S * SQ3 * (2 * R + 1) + 20;
    const h = S * (3 * R + 2) + 30;
    svg.setAttribute('viewBox', `${-w / 2} ${-h / 2} ${w} ${h}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    const castleOf = {};
    castleOf[board.castles.red] = 'red';
    castleOf[board.castles.gold] = 'gold';

    const tilesLayer = el('g', {}, svg);
    const lmLayer = el('g', { 'pointer-events': 'none' }, svg);    // landmark pieces: taps fall through to the tile
    const fxLayer = el('g', { 'pointer-events': 'none' }, svg);
    const tagLayer = el('g', {}, svg);
    const nodes = {};
    board.tiles.forEach(([id, q, r]) => {
      const [cx, cy] = center(q, r);
      const g = el('g', { 'data-id': id }, tilesLayer);
      const pts = points(cx, cy, S - 1.5);
      // paper-cut depth: a darker copy a few units lower
      const depth = el('polygon', { points: points(cx, cy + 5, S - 1.5), fill: 'rgba(29,36,64,.28)' }, g);
      if (opts.grass) {
        el('image', { href: opts.grass, x: cx - S * SQ3 / 2 - 1, y: cy - S - 1, width: S * SQ3 + 2, height: 2 * S + 2,
          preserveAspectRatio: 'none' }, g);
      } else {
        el('polygon', { points: pts, fill: '#8fd16a', stroke: '#5fa844', 'stroke-width': 2 }, g);
      }
      const ownPoly = el('polygon', { points: pts, class: 'kd-hex-own', fill: 'transparent', stroke: 'transparent', 'stroke-width': 3 }, g);
      nodes[id] = { g, own: ownPoly, depth, cx, cy, team: null };
      if (castleOf[id]) {
        el('circle', { cx, cy: cy + 4, r: S * 0.8, fill: COLORS[castleOf[id]].deep, opacity: 0.55 }, g);
        if (opts.castle) el('image', { href: opts.castle, x: cx - S * 0.85, y: cy - S * 0.95, width: S * 1.7, height: S * 1.7 }, g);
        else el('text', { x: cx, y: cy + 12, 'text-anchor': 'middle', 'font-size': 36 }, g).textContent = '🏰';
      }
    });

    // Landmarks, back to front so a lower piece stands in front of a higher one.
    const lms = {};
    Object.entries(board.landmarks || {})
      .filter(([id, k]) => nodes[id] && LANDMARKS[k])
      .sort((a, b) => nodes[a[0]].cy - nodes[b[0]].cy)
      .forEach(([id, k]) => {
        const n = nodes[id];
        const L = LANDMARKS[k];
        const w = L.w;
        const h = w * L.ar;
        const bottom = n.cy + S * 0.62;
        const g = el('g', { class: 'kd-lm', 'data-lm': k }, lmLayer);
        const glow = el('ellipse', { class: 'kd-lm-glow', cx: n.cx, cy: bottom - w * 0.16, rx: w * 0.66, ry: w * 0.26 }, g);
        const img = el('image', { class: 'kd-lm-img', href: LM_SRC(k), x: n.cx - w / 2, y: bottom - h, width: w, height: h }, g);
        const by = Math.max(bottom - h + 8, n.cy - S * 1.6);
        const bx = n.cx + Math.max(20, w * 0.42);
        const badge = el('g', { class: 'kd-lm-badge' }, g);
        const disc = el('circle', { cx: bx, cy: by, r: 15, 'stroke-width': 3 }, badge);
        const txt = el('text', { x: bx, y: by + 6, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 800 }, badge);
        txt.textContent = '+' + L.bonus;
        const ring = el('ellipse', { class: 'kdp-lm-ring', cx: n.cx, cy: bottom - w * 0.16, rx: w * 0.78, ry: w * 0.34 }, g);
        lms[id] = { key: k, g, glow, img, disc, txt, ring, cx: n.cx, cy: bottom - h / 2 };
      });
    function paintLm(id, team, anim) {
      const m = lms[id];
      if (!m) return;
      const c = COLORS[team];
      m.glow.setAttribute('fill', c ? c.fill : 'rgba(255,201,60,.75)');
      m.glow.setAttribute('opacity', c ? 0.75 : 0.9);
      m.disc.setAttribute('fill', c ? c.fill : '#ffc93c');
      m.disc.setAttribute('stroke', c ? '#fff7e3' : '#1d2440');
      m.txt.setAttribute('fill', c ? '#ffffff' : '#1d2440');
      m.g.classList.toggle('held', !!c);
      if (anim) {
        m.img.classList.remove('hop');
        void m.img.getBBox();
        m.img.classList.add('hop');
        ring(m.cx, m.cy, S * 1.6, c ? c.fill : '#ffc93c');
      }
    }

    // An expanding ring (surround / landmark moments).
    function ring(cx, cy, r, color) {
      const c = el('circle', { class: 'kd-ring', cx, cy, r, fill: 'none', stroke: color, 'stroke-width': 10 }, fxLayer);
      setTimeout(() => c.remove(), 900);
    }
    function burst(ids, team) {
      const pts = (ids || []).map((id) => nodes[id]).filter(Boolean);
      if (!pts.length) return;
      const cx = pts.reduce((s, n) => s + n.cx, 0) / pts.length;
      const cy = pts.reduce((s, n) => s + n.cy, 0) / pts.length;
      ring(cx, cy, S * (1.2 + Math.min(4, Math.sqrt(pts.length))), COLORS[team] ? COLORS[team].fill : '#ffc93c');
    }

    function set(id, team, anim) {
      const n = nodes[id];
      if (!n) return;
      if (lms[id]) paintLm(id, team, anim && (n.team || null) !== (team || null));
      n.team = team || null;
      if (team && COLORS[team]) {
        n.own.setAttribute('fill', COLORS[team].fill);
        n.own.setAttribute('stroke', COLORS[team].deep);
        n.depth.setAttribute('fill', COLORS[team].deep);
      } else {
        n.own.setAttribute('fill', 'transparent');
        n.own.setAttribute('stroke', 'transparent');
        n.depth.setAttribute('fill', 'rgba(29,36,64,.28)');
      }
      if (anim) {
        n.own.classList.remove('pop', 'flip');
        void n.own.getBBox();
        n.own.classList.add(anim);
      }
    }
    Object.keys(nodes).forEach((id) => set(+id, own[id] || null));

    // Floating name tag over a tile (projector).
    function tag(id, text, team) {
      const n = nodes[id];
      if (!n) return;
      const g = el('g', { class: 'kd-tag' }, tagLayer);
      const label = String(text).slice(0, 14);
      const wpx = Math.max(70, label.length * 15 + 26);
      el('rect', { x: n.cx - wpx / 2, y: n.cy - S - 40, width: wpx, height: 38, rx: 10,
        fill: '#fff7e3', stroke: COLORS[team] ? COLORS[team].deep : '#1d2440', 'stroke-width': 3 }, g);
      const t = el('text', { x: n.cx, y: n.cy - S - 13, 'text-anchor': 'middle', fill: COLORS[team] ? COLORS[team].deep : '#1d2440' }, g);
      t.textContent = label;
      setTimeout(() => g.remove(), 2500);
    }

    // Phone: glowing tiles the kid may tap. A landmark the kid can take gets a pulsing ring around its piece.
    function targets(ids, onPick) {
      const picking = !!(ids && ids.length);
      svg.classList.toggle('kdp-picking', picking);
      Object.values(nodes).forEach((n) => {
        n.g.classList.remove('kdp-target');
        n.g.querySelectorAll('.kdp-glow').forEach((x) => x.remove());
        n.g.onclick = null;
      });
      Object.entries(lms).forEach(([id, m]) => {
        const on = picking && ids.includes(+id);
        m.g.classList.toggle('kdp-lm-target', on);
        m.g.classList.toggle('kdp-lm-dim', picking && !on);
        // A kid taps the building, not the hex under it (the Burj covers ~3 tiles): while the landmark can be taken
        // the whole piece is the button; otherwise taps fall through to the tiles behind it.
        m.g.setAttribute('pointer-events', on ? 'visiblePainted' : 'none');
        m.g.onclick = on ? () => onPick && onPick(+id) : null;
      });
      (ids || []).forEach((id) => {
        const n = nodes[id];
        if (!n) return;
        n.g.classList.add('kdp-target');
        el('polygon', { class: 'kdp-glow', points: points(n.cx, n.cy, S - 5), fill: '#ffd23f', stroke: '#ffffff', 'stroke-width': 6 }, n.g);
        if (!lms[id]) el('text', { class: 'kdp-glow', x: n.cx, y: n.cy + 10, 'text-anchor': 'middle', 'font-size': 28, 'pointer-events': 'none' }, n.g).textContent = '🚩';
        n.g.onclick = () => onPick && onPick(id);
      });
    }

    // Phone: zoom onto the tiles the kid can tap (bigger targets for small fingers), keeping the svg's own shape so the
    // map around them still shows. A short tween keeps the kid oriented. No ids (or a zoom smaller than the whole
    // board) → the whole board. `done` runs once the view has settled.
    const full = { x: -w / 2, y: -h / 2, w, h };
    let vb = Object.assign({}, full);
    let tweenId = 0;
    function setVB(b) { vb = b; svg.setAttribute('viewBox', `${b.x} ${b.y} ${b.w} ${b.h}`); }
    function focus(ids, done) {
      let target = full;
      const pts = (ids || []).map((id) => nodes[id]).filter(Boolean);
      const rect = svg.getBoundingClientRect();
      if (pts.length && rect.width > 0 && rect.height > 0) {
        let x0 = Math.min(...pts.map((n) => n.cx)) - S * 2.2;
        let x1 = Math.max(...pts.map((n) => n.cx)) + S * 2.2;
        let y0 = Math.min(...pts.map((n) => n.cy)) - S * 2.6;    // room for a landmark piece standing on a tile
        let y1 = Math.max(...pts.map((n) => n.cy)) + S * 2.2;
        const minW = S * SQ3 * 6;                               // never closer than ~6 tiles across
        if (x1 - x0 < minW) { const c = (x0 + x1) / 2; x0 = c - minW / 2; x1 = c + minW / 2; }
        const ar = rect.width / rect.height;
        let bw = x1 - x0;
        let bh = y1 - y0;
        if (bw / bh < ar) { const nw = bh * ar; x0 -= (nw - bw) / 2; bw = nw; } else { const nh = bw / ar; y0 -= (nh - bh) / 2; bh = nh; }
        const fullScale = Math.min(rect.width / full.w, rect.height / full.h);
        if (rect.width / bw > fullScale * 1.08) {
          // stay over the board instead of showing empty sky past its edge
          if (bw <= full.w) x0 = Math.min(Math.max(x0, full.x), full.x + full.w - bw);
          if (bh <= full.h) y0 = Math.min(Math.max(y0, full.y), full.y + full.h - bh);
          target = { x: x0, y: y0, w: bw, h: bh };
        }
      }
      const from = Object.assign({}, vb);
      const id = ++tweenId;
      const t0 = performance.now();
      const ms = 320;
      const step = (now) => {
        if (id !== tweenId) return;
        const k = Math.min(1, (now - t0) / ms);
        const e = 1 - Math.pow(1 - k, 3);
        setVB({ x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, w: from.w + (target.w - from.w) * e, h: from.h + (target.h - from.h) * e });
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      // background tabs / slow phones may skip frames: always land on the final view
      setTimeout(() => { if (id === tweenId) { setVB(target); if (done) done(); } }, ms + 40);
    }

    // Centre of a tile in screen pixels (for the phone's "tap here" hand).
    function screenPoint(id) {
      const n = nodes[id];
      if (!n || !svg.getScreenCTM) return null;
      const m = svg.getScreenCTM();
      if (!m) return null;
      const p = svg.createSVGPoint();
      p.x = n.cx; p.y = n.cy;
      const s = p.matrixTransform(m);
      return { x: s.x, y: s.y };
    }

    return { set, tag, targets, burst, ring, focus, screenPoint, nodes, lms };
  }

  window.KdBoard = { create, COLORS, LANDMARKS, LM_SRC };
})();
