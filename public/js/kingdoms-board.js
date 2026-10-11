// Reinos de Colores — shared SVG hex board (projector + phones).
// KdBoard.create(svg, board, own, opts) draws the board once; .set(id, team, anim) recolours a single tile,
// so updates stay cheap. board = { R, castles: {red, gold}, tiles: [[id, q, r], …] } from the server.
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const S = 40;                      // hex radius in SVG units
  const SQ3 = Math.sqrt(3);
  const COLORS = {
    red:  { fill: '#f0443a', deep: '#b22a22' },
    gold: { fill: '#2f7bea', deep: '#1d52a8' },
  };

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

    function set(id, team, anim) {
      const n = nodes[id];
      if (!n) return;
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

    // Phone: glowing tiles the kid may tap.
    function targets(ids, onPick) {
      svg.classList.toggle('kdp-picking', !!(ids && ids.length));
      Object.values(nodes).forEach((n) => {
        n.g.classList.remove('kdp-target');
        n.g.querySelectorAll('.kdp-glow').forEach((x) => x.remove());
        n.g.onclick = null;
      });
      (ids || []).forEach((id) => {
        const n = nodes[id];
        if (!n) return;
        n.g.classList.add('kdp-target');
        el('polygon', { class: 'kdp-glow', points: points(n.cx, n.cy, S - 5), fill: '#ffd23f', stroke: '#ffffff', 'stroke-width': 6 }, n.g);
        el('text', { class: 'kdp-glow', x: n.cx, y: n.cy + 10, 'text-anchor': 'middle', 'font-size': 28, 'pointer-events': 'none' }, n.g).textContent = '🚩';
        n.g.onclick = () => onPick && onPick(id);
      });
    }

    return { set, tag, targets, nodes };
  }

  window.KdBoard = { create, COLORS };
})();
