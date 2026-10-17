// Dragones Pintores — drawing shared by the kid's phone and the projector, so both show the same sky.
// Look: the Reinos de Colores sticker style. Cloud platforms are white with ONE navy outline around each platform
// (only exposed edges are stroked), a lavender cap marks paintable tops, and a painted tile fills completely with its
// kingdom's colour (light top, deep bottom) so the battle reads from the back of the classroom.
(function () {
  const INK = '#1d2440';
  const COL = { red: '#f0443a', gold: '#2f7bea' };
  const HI = { red: '#ff8a80', gold: '#80b4f8' };
  const DEEP = { red: '#b22a22', gold: '#1d52a8' };

  function sky(g, w, h) {
    const s = g.createLinearGradient(0, 0, 0, h);
    s.addColorStop(0, '#9fdcf7');
    s.addColorStop(0.62, '#c6ecfb');
    s.addColorStop(1, '#fde4ec');
    g.fillStyle = s;
    g.fillRect(0, 0, w, h);
  }

  // World transform must already be set. Draws the tiles in columns x0..x1 and rows y0..y1.
  function tiles(g, lv, solid, surf, own, x0, x1, y0, y1, line) {
    const t = lv.tile, cols = lv.cols, rows = lv.rows;
    const S = (x, y) => x >= 0 && x < cols && y >= 0 && y < rows && solid[y * cols + x] === 1;
    const band = Math.round(t * 0.2);
    const w = t + 0.75;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const id = y * cols + x;
        if (!solid[id]) continue;
        const X = x * t, Y = y * t;
        const o = surf.has(id) ? own[id] : null;
        // w overlaps the next tile a hair so scaled canvases show no seams between tiles
        if (o) {
          g.fillStyle = COL[o]; g.fillRect(X, Y, w, w);
          g.fillStyle = HI[o]; g.fillRect(X, Y, w, band);
          g.fillStyle = DEEP[o]; g.fillRect(X, Y + t - band, w, band);
        } else {
          g.fillStyle = '#ffffff'; g.fillRect(X, Y, w, w);
          g.fillStyle = surf.has(id) ? '#ddd1f7' : '#eef1fa';
          if (surf.has(id)) g.fillRect(X, Y, w, band); else g.fillRect(X, Y + t - band, w, band);
        }
      }
    }
    g.strokeStyle = INK;
    g.lineWidth = line || 3;
    g.lineCap = 'square';
    g.beginPath();
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!S(x, y)) continue;
        const X = x * t, Y = y * t;
        if (!S(x, y - 1)) { g.moveTo(X, Y); g.lineTo(X + t, Y); }
        if (!S(x, y + 1)) { g.moveTo(X, Y + t); g.lineTo(X + t, Y + t); }
        if (!S(x - 1, y)) { g.moveTo(X, Y); g.lineTo(X, Y + t); }
        if (!S(x + 1, y)) { g.moveTo(X + t, Y); g.lineTo(X + t, Y + t); }
      }
    }
    g.stroke();
  }

  // Each kingdom's home flag at its spawn (x, y in tiles = the cell just above the ground).
  function flags(g, lv, line) {
    const t = lv.tile;
    [['red', lv.spawns.red], ['gold', lv.spawns.gold]].forEach(([team, sp]) => {
      if (!sp) return;
      const px = sp[0] * t + t / 2, base = (sp[1] + 1) * t, top = base - t * 3.2;
      g.strokeStyle = '#1d2440'; g.lineWidth = (line || 3) + 1;
      g.beginPath(); g.moveTo(px, base); g.lineTo(px, top); g.stroke();
      const dir = team === 'red' ? 1 : -1;
      g.fillStyle = COL[team];
      g.beginPath(); g.moveTo(px, top); g.lineTo(px + dir * t * 1.3, top + t * 0.45); g.lineTo(px, top + t * 0.9); g.closePath();
      g.fill(); g.lineWidth = line || 3; g.stroke();
    });
  }

  // Five Dubai landmark «islands» floating in the sky (art batch 2026-10-17, Higgsfield, content: his request in
  // docs/specs/dragones-pintores.md): behind the cloud platforms, a slow bob (still with reduced motion). Each picture
  // loads the first time it is drawn and shows from then on. Scenery only: the rules and the platforms never change.
  //   islands(g, x0, x1, y, h, t, alpha): spread over x0..x1 (current transform), middle line y, h = the Burj island height
  const ISLANDS = ['burj', 'arab', 'museum', 'frame', 'atlantis'];
  const PIC = {};
  const pic = (k) => {
    const u = '/assets/paint/islands/' + k + '.webp';
    if (!PIC[u]) { const i = new Image(); i.decoding = 'async'; i.src = u; PIC[u] = i; }
    return PIC[u];
  };
  const still = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function islands(g, x0, x1, y, h, t, alpha) {
    const span = (x1 - x0) / ISLANDS.length;
    const tt = still() ? 0 : (t || 0);
    g.save();
    g.globalAlpha = alpha == null ? 0.92 : alpha;
    ISLANDS.forEach((k, i) => {
      const im = pic(k);
      if (!(im.complete && im.naturalWidth)) return;
      // one shared scale (the pictures were cut at one scale: the Burj is the tallest), bottoms staggered up and down
      const sc = h / 350, hh = im.naturalHeight * sc, w = im.naturalWidth * sc;
      const cx = x0 + span * (i + 0.5), base = y + h * 0.5 + (i % 2 ? h * 0.22 : 0) + Math.sin(tt * 0.8 + i * 1.7) * h * 0.035;
      g.drawImage(im, cx - w / 2, base - hh, w, hh);
    });
    g.restore();
  }

  window.PaintRender = { INK, COL, HI, DEEP, sky, tiles, flags, islands, ISLANDS };
})();
