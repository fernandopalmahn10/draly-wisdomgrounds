// Batalla de Nieve en Ski Dubái — drawing shared by the projector and every phone, so both show the same Dubai.
// Look: the Reinos de Colores sticker style in pastel: soft canvas-drawn ground (snow, market tiles, sand, quay, plaza
// stone) pre-rendered once per map, props with one navy outline drawn every frame and depth-sorted with the kids, the
// Dubai landmark pieces (assets/kingdoms/landmarks/big), the saga avatars as the kids (frosted when they join the ice
// team). No text in pictures; the only words are the zone signs and name tags (UI). window.SnowRender.
(function () {
  const INK = '#1d2440';
  const SUN = '#ffb020', SUN_DEEP = '#e07a00', ICE = '#4cc3ff', ICE_DEEP = '#1d6fa8';
  const Q = ['#f0443a', '#2f7bea', '#f5b301', '#26a65b'];         // station quadrants = the answer-tile colours
  // (🪙 2026-10-19: a skin of El Zoco walks as its own head picture, public/js/saga.js)
  const SKIN_URL = (k) => (window.Saga && window.Saga.zoco && window.Saga.zoco(k) ? window.Saga.skinHead(k) : '/assets/saga/avatars/' + k + '.webp');
  const LM_URL = (k) => '/assets/kingdoms/landmarks/big/' + k + '.webp';
  const IMG = {};            // url → Image
  const FROST = {};          // skin → frosted canvas
  const img = (url) => {
    if (!IMG[url]) { const i = new Image(); i.decoding = 'async'; i.src = url; IMG[url] = i; }
    return IMG[url];
  };
  const ready = (i) => i && i.complete && i.naturalWidth > 0;
  function preload(skins) {
    (skins || ['dralingo', 'fer', 'hamdan', 'latifa', 'aileen', 'adric', 'adrian', 'camel', 'plane', 'falcon', 'oryx']).forEach((k) => img(SKIN_URL(k)));
    ['museum', 'burj', 'arab', 'frame', 'atlantis'].forEach((k) => img(LM_URL(k)));
    Object.values(PICS).forEach((d) => img(PROP_URL(d.f)));        // the map's props (~140 KB, art batch 2026-10-17)
    ['lamp', 'lantern', 'abra', 'oyster', 'ice-chest'].forEach((f) => img(PROP_URL(f)));
  }
  // the ice-team version of an avatar: tinted icy blue with a frosty rim (made once per avatar)
  function frost(skin) {
    if (FROST[skin]) return FROST[skin];
    const src = img(SKIN_URL(skin));
    if (!ready(src)) return null;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0, 128, 128);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(90,180,255,.5)';
    g.fillRect(0, 0, 128, 128);
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, 'rgba(255,255,255,.55)');
    gr.addColorStop(0.45, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    FROST[skin] = c;
    return c;
  }

  // ---------- helpers ----------
  const hash = (x, y, k) => { let h = (x * 374761393 + y * 668265263 + (k || 0) * 2147483647) >>> 0; h = (h ^ (h >>> 13)) * 1274126177 >>> 0; return (h >>> 0) / 4294967296; };
  function rr(g, x, y, w, h, r) {
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, r);
    else { g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  }
  function ell(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); }

  // ---------- ground (pre-rendered once per map + scale) ----------
  let groundCache = null;
  function ground(map, scale) {
    const key = map.seed + ':' + scale;
    if (groundCache && groundCache.key === key) return groundCache.canvas;
    const T = map.tile, W = map.cols * T, H = map.rows * T;
    const c = document.createElement('canvas');
    c.width = Math.round(W * scale); c.height = Math.round(H * scale);
    const g = c.getContext('2d');
    g.scale(scale, scale);
    const G = window.SnowMap.groundAt;
    // base: warm promenade stone
    g.fillStyle = '#efe2c8'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < map.rows; y++) for (let x = 0; x < map.cols; x++) {
      const kind = G(x, y);
      const X = x * T, Y = y * T;
      const r = hash(x, y);
      if (kind === 'path') {
        g.fillStyle = r < 0.5 ? '#efe2c8' : '#ebdcbf'; g.fillRect(X, Y, T, T);
        g.strokeStyle = 'rgba(160,120,70,.12)'; g.lineWidth = 1; g.strokeRect(X + 0.5, Y + 0.5, T - 1, T - 1);
      } else if (kind === 'market') {
        g.fillStyle = (x + y) % 2 ? '#f6d3a6' : '#f1c695'; g.fillRect(X, Y, T, T);
        g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(X + 3, Y + 3, T - 6, 3);
        if (r < 0.12) { g.fillStyle = 'rgba(200,90,40,.15)'; ell(g, X + T / 2, Y + T / 2, 6, 6); g.fill(); }
      } else if (kind === 'museum') {
        g.fillStyle = (x + y) % 2 ? '#ebe8f8' : '#e3dff4'; g.fillRect(X, Y, T, T);
        g.strokeStyle = 'rgba(150,140,200,.25)'; g.lineWidth = 1; g.strokeRect(X + 0.5, Y + 0.5, T - 1, T - 1);
        if (r < 0.1) { g.fillStyle = 'rgba(120,220,255,.45)'; g.fillRect(X + 4, Y + T / 2 - 1, T - 8, 2); }
      } else if (kind === 'sand') {
        g.fillStyle = r < 0.5 ? '#f8e2a8' : '#f6dda0'; g.fillRect(X, Y, T, T);
        for (let k = 0; k < 3; k++) { g.fillStyle = 'rgba(190,140,60,.16)'; g.fillRect(X + hash(x, y, k + 1) * T, Y + hash(x, y, k + 9) * T, 2, 2); }
      } else if (kind === 'plaza') {
        g.fillStyle = (x + y) % 2 ? '#f4ecdc' : '#efe5d0'; g.fillRect(X, Y, T, T);
        g.strokeStyle = 'rgba(170,140,90,.14)'; g.lineWidth = 1; g.strokeRect(X + 0.5, Y + 0.5, T - 1, T - 1);
      } else if (kind === 'boulevard') {
        g.fillStyle = (y === 21 || y === 22) ? '#ddd6ca' : ((x + y) % 2 ? '#ebe6dd' : '#e6e0d5'); g.fillRect(X, Y, T, T);
        g.strokeStyle = 'rgba(120,110,95,.13)'; g.lineWidth = 1; g.strokeRect(X + 0.5, Y + 0.5, T - 1, T - 1);
      } else if (kind === 'quay') {
        g.fillStyle = '#dca46c'; g.fillRect(X, Y, T, T);
        g.strokeStyle = 'rgba(120,70,30,.35)'; g.lineWidth = 1.2;
        for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(X, Y + k * T / 4); g.lineTo(X + T, Y + k * T / 4); g.stroke(); }
        if (r < 0.3) { g.fillStyle = 'rgba(90,50,20,.35)'; g.fillRect(X + r * 60 % T, Y + 3, 2, 2); }
      } else if (kind === 'water') {
        g.fillStyle = '#7fd3ea'; g.fillRect(X, Y, T, T);
      }
    }
    // the plaza: rings of stone around the Burj Khalifa
    g.save();
    g.beginPath(); g.rect(30 * T, 10 * T, 13 * T, 15 * T); g.clip();
    for (let k = 1; k < 9; k++) { g.strokeStyle = k % 2 ? 'rgba(200,170,110,.22)' : 'rgba(255,255,255,.35)'; g.lineWidth = 5; ell(g, 38 * T, 20 * T, k * 46, k * 34); g.stroke(); }
    g.restore();
    // the boulevard: a line of darker pavers down the middle + little gold stars
    for (let x = 14; x <= 29; x += 2) { g.fillStyle = 'rgba(255,201,60,.35)'; ell(g, x * T + T, 21.5 * T + T / 2, 3, 3); g.fill(); }
    // sand dunes
    (map.decor || []).filter((d) => d.kind === 'dune').forEach((d) => {
      const cx = d.x * T, cy = d.y * T, s = d.s;
      const gr = g.createRadialGradient(cx - 8 * s, cy - 6 * s, 2, cx, cy, 46 * s);
      gr.addColorStop(0, 'rgba(255,240,200,.9)'); gr.addColorStop(1, 'rgba(240,200,120,0)');
      g.fillStyle = gr; ell(g, cx, cy, 52 * s, 30 * s); g.fill();
      g.strokeStyle = 'rgba(200,150,70,.35)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(cx - 40 * s, cy + 6 * s); g.quadraticCurveTo(cx, cy - 22 * s, cx + 40 * s, cy + 4 * s); g.stroke();
    });
    // water: the creek with soft waves and foam on the quay edge
    const wg = g.createLinearGradient(0, T, 0, 5 * T);
    wg.addColorStop(0, '#5cc2e3'); wg.addColorStop(1, '#8edcf0');
    g.fillStyle = wg; rr(g, 15 * T, T, 14 * T, 4 * T, 14); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(15 * T + 10, 5 * T - 2); g.lineTo(29 * T - 10, 5 * T - 2); g.stroke();
    for (let k = 0; k < 18; k++) {
      const wx = 15.5 * T + hash(k, 3) * 13 * T, wy = 1.4 * T + hash(k, 7) * 3.2 * T;
      g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 2;
      g.beginPath(); g.arc(wx, wy, 8, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    }
    // Ski Dubái: the snow field (an ellipse), ski tracks, the ice team's snowflake at the centre
    const cx = window.SnowMap.CX * T, cy = window.SnowMap.CY * T;
    const sg = g.createRadialGradient(cx, cy - 30, 40, cx, cy, 7.8 * T);
    sg.addColorStop(0, '#ffffff'); sg.addColorStop(0.75, '#f4faff'); sg.addColorStop(1, '#dcefff');
    g.fillStyle = sg; ell(g, cx, cy, 7.6 * T + 6, 5.3 * T + 6); g.fill();
    g.strokeStyle = 'rgba(140,190,235,.55)'; g.lineWidth = 3; ell(g, cx, cy, 7.6 * T + 6, 5.3 * T + 6); g.stroke();
    g.strokeStyle = 'rgba(150,200,240,.35)'; g.lineWidth = 2;
    for (let k = 0; k < 4; k++) {
      g.beginPath(); g.moveTo(cx - 6 * T + k * 30, cy - 4 * T); g.bezierCurveTo(cx - 4 * T + k * 30, cy - T, cx - 6 * T + k * 30, cy + T, cx - 3 * T + k * 30, cy + 4 * T); g.stroke();
    }
    // the snowflake emblem (the ice team's home)
    g.save(); g.translate(cx, cy); g.strokeStyle = 'rgba(92,175,240,.35)'; g.lineCap = 'round';
    for (let k = 0; k < 6; k++) {
      g.rotate(Math.PI / 3); g.lineWidth = 9; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -2.6 * T); g.stroke();
      g.lineWidth = 6; g.beginPath(); g.moveTo(0, -1.5 * T); g.lineTo(-18, -1.5 * T - 18); g.moveTo(0, -1.5 * T); g.lineTo(18, -1.5 * T - 18); g.stroke();
    }
    g.restore();
    for (let k = 0; k < 40; k++) {
      const a = hash(k, 1) * Math.PI * 2, d = Math.sqrt(hash(k, 2));
      const sx = cx + Math.cos(a) * d * 7 * T, sy = cy + Math.sin(a) * d * 4.8 * T;
      g.fillStyle = 'rgba(160,210,255,.6)'; g.fillRect(sx, sy, 2, 2);
    }
    // the border: an Emirati fort wall (sandstone with crenellations)
    const wall = (x, y, w, h) => {
      g.fillStyle = '#e5c38c'; g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(160,110,50,.18)';
      for (let k = 0; k < w; k += 16) g.fillRect(x + k, y + h / 2, 14, 1);
    };
    wall(0, 0, W, T); wall(0, H - T, W, T); wall(0, 0, T, H); wall(W - T, 0, T, H);
    g.fillStyle = '#d9b06f';
    for (let x = 0; x < W; x += 24) { g.fillRect(x, 0, 14, 8); g.fillRect(x, H - 8, 14, 8); }
    for (let y = 0; y < H; y += 24) { g.fillRect(0, y, 8, 14); g.fillRect(W - 8, y, 8, 14); }
    g.strokeStyle = INK; g.lineWidth = 3;
    g.strokeRect(T - 1.5, T - 1.5, W - 2 * T + 3, H - 2 * T + 3);
    groundCache = { key, canvas: c };
    return c;
  }

  // ---------- props ----------
  function outline(g, w) { g.strokeStyle = INK; g.lineWidth = w || 2; g.stroke(); }
  // The props as pictures (art batch 2026-10-17, Higgsfield; brief content/snow/pictures.json): a kind with a picture
  // draws it once it has loaded (bottom-centre on its footprint, `w` tiles wide or the footprint width × `k`), else the
  // canvas drawing below stays. The same pictures dress La Gran Fuga's rooms (assets/props/, js/escape-render.js).
  const PROP_URL = (f) => '/assets/props/' + f + '.webp';
  const PICS = {
    igloo: { f: 'igloo', w: 2.2 }, snowman: { f: 'snowman', w: 0.95 }, pine: { f: 'pine', w: 1.3 }, palm: { f: 'date-palm', w: 1.75 },
    potpalm: { f: 'palm-pot', w: 1.15 }, rock: { f: 'rock', w: 1.1 }, sacks: { f: 'sacks', w: 1.2 }, planter: { f: 'planter', w: 0.95 },
    stall: { f: 'stall', each: 1.4 }, bench: { f: 'bench', k: 1 }, fountain: { f: 'fountain', k: 1.05, flat: true }, oasis: { f: 'oasis', w: 2.5, flat: true },
  };
  function drawPic(g, f, cx, base, wpx, shadow) {
    const i = img(PROP_URL(f));
    if (!ready(i)) return false;
    const h = wpx * i.naturalHeight / i.naturalWidth;
    if (shadow) { g.fillStyle = 'rgba(29,36,64,.16)'; ell(g, cx, base - 2, wpx * 0.42, Math.max(3, wpx * 0.1)); g.fill(); }
    g.drawImage(i, cx - wpx / 2, base - h, wpx, h);
    return true;
  }
  function drawPropPic(g, p, T) {
    const d = PICS[p.kind];
    if (!d) return false;
    if (d.each) {             // a row of stalls: one picture per ~1.4 tiles of the footprint (a tall one would hide a station)
      const n = Math.max(1, Math.round(p.w / d.each)), w = (p.w * T) / n;
      let ok = true;
      for (let i = 0; i < n; i++) ok = drawPic(g, d.f, p.x * T + w * (i + 0.5), (p.y + p.h) * T + 2, w * 0.98, true) && ok;
      return ok;
    }
    return drawPic(g, d.f, (p.x + p.w / 2) * T, (p.y + p.h) * T + 2, (d.w || p.w * d.k) * T, !d.flat);
  }
  function drawDecorPic(g, d, T, now) {
    if (d.kind === 'lamp') return drawPic(g, 'lamp', d.x * T, d.y * T + 2, 0.7 * T, true);
    if (d.kind === 'lantern') return drawPic(g, 'lantern', d.x * T, d.y * T - 4 + Math.sin(now / 800 + d.x) * 1.5, 0.42 * T, false);
    if (d.kind === 'boat') return drawPic(g, 'abra', d.x * T, d.y * T + 12 + Math.sin(now / 700 + d.x) * 2, 1.8 * T, false);
    return false;
  }
  function drawPearlPic(g, j, T, now, cool) {
    g.save();
    if (cool) g.globalAlpha = 0.5;
    const ok = drawPic(g, 'oyster', j.x * T, j.y * T + 10, 0.85 * T, false);
    g.restore();
    if (ok && !cool) { g.fillStyle = 'rgba(255,255,255,.9)'; const s = 2 + Math.sin(now / 200) * 1.5; g.fillRect(j.x * T + 5, j.y * T - 9, s, s); }
    return ok;
  }
  function drawStation(g, p, T, now, near, ready_) {
    const X = p.x * T, Y = p.y * T, S = 2 * T;
    const bob = Math.sin(now / 420 + p.id) * 3;
    // glow when the kid is close enough to use it
    if (near) {
      const a = 0.6 + 0.3 * Math.sin(now / 160);
      g.fillStyle = `rgba(255,214,64,${a})`; rr(g, X - 12, Y - 12, S + 24, S + 24, 20); g.fill();
      g.strokeStyle = '#ffd23f'; g.lineWidth = 4; rr(g, X - 16, Y - 16, S + 32, S + 32, 22); g.stroke();
    }
    g.fillStyle = 'rgba(29,36,64,.22)'; rr(g, X + 3, Y + 6, S, S, 12); g.fill();
    // four quadrants
    const h = S / 2;
    [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([qx, qy], i) => { g.fillStyle = Q[i]; g.fillRect(X + qx * h, Y + qy * h, h, h); });
    g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(X, Y, S, 6);
    rr(g, X, Y, S, S, 12); outline(g, 3);
    g.strokeStyle = 'rgba(29,36,64,.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(X + h, Y); g.lineTo(X + h, Y + S); g.moveTo(X, Y + h); g.lineTo(X + S, Y + h); g.stroke();
    // the question bubble floating above
    const bx = X + h, by = Y - 14 + bob;
    g.fillStyle = '#fff7e3'; ell(g, bx, by, 17, 17); g.fill(); outline(g, 3);
    g.fillStyle = INK; g.font = '900 24px Baloo 2, Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('?', bx, by + 1);
    if (ready_ === false) { g.fillStyle = 'rgba(255,255,255,.4)'; rr(g, X, Y, S, S, 12); g.fill(); }
  }
  function stationBubble(g, p, T, now) {
    const bx = p.x * T + T, by = p.y * T - 14 + Math.sin(now / 420 + p.id) * 3;
    g.fillStyle = '#fff7e3'; ell(g, bx, by, 17, 17); g.fill(); outline(g, 3);
    g.fillStyle = INK; g.font = '900 24px Baloo 2, Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('?', bx, by + 1);
  }
  function drawStall(g, p, T) {
    const X = p.x * T, Y = p.y * T, W = p.w * T;
    g.fillStyle = '#c98a4b'; rr(g, X + 2, Y + 8, W - 4, T - 8, 5); g.fill(); outline(g);
    // goods on the counter
    const goods = [['#ff9f1c', '#f0443a', '#f5d36b'], ['#36c26b', '#f0443a', '#ffd23f'], ['#c0742a', '#e8b04a', '#8b3a1a']][p.goods || 0];
    for (let i = 0; i < p.w * 2; i++) { g.fillStyle = goods[i % 3]; ell(g, X + 10 + i * (W - 20) / Math.max(1, p.w * 2 - 1), Y + 12, 6, 4); g.fill(); }
    // striped awning above (taller than the tile)
    const top = Y - 18;
    for (let i = 0; i < p.w * 4; i++) { g.fillStyle = i % 2 ? '#ffffff' : p.awning; g.fillRect(X + i * W / (p.w * 4), top, W / (p.w * 4) + 0.5, 16); }
    g.beginPath(); g.rect(X, top, W, 16); outline(g);
    for (let i = 0; i < p.w * 4; i++) { g.fillStyle = i % 2 ? '#ffffff' : p.awning; g.beginPath(); g.arc(X + (i + 0.5) * W / (p.w * 4), top + 16, W / (p.w * 8), 0, Math.PI); g.fill(); }
    g.fillStyle = INK; g.fillRect(X + 3, top + 16, 3, 10); g.fillRect(X + W - 6, top + 16, 3, 10);
  }
  function drawSacks(g, p, T) {
    const X = p.x * T, Y = p.y * T;
    [['#c9a36b', '#ff9f1c', 8, 20], ['#bf955c', '#f0443a', 20, 14], ['#c9a36b', '#f5d36b', 24, 24]].forEach(([b, top, dx, dy]) => {
      g.fillStyle = b; ell(g, X + dx, Y + dy, 9, 9); g.fill(); outline(g, 1.6);
      g.fillStyle = top; ell(g, X + dx, Y + dy - 5, 6, 3); g.fill();
    });
  }
  function drawPlanter(g, p, T) {
    const X = p.x * T + T / 2, Y = p.y * T;
    g.fillStyle = '#f4f6fb'; rr(g, X - 11, Y + 10, 22, 20, 6); g.fill(); outline(g);
    g.fillStyle = '#4cb87a'; ell(g, X, Y + 8, 14, 12); g.fill(); outline(g);
    g.fillStyle = 'rgba(255,255,255,.35)'; ell(g, X - 4, Y + 4, 5, 3); g.fill();
  }
  function drawIgloo(g, p, T) {
    const X = p.x * T + T, Y = p.y * T + 2 * T - 4;
    g.fillStyle = 'rgba(80,140,200,.2)'; ell(g, X, Y + 2, 34, 9); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(X, Y, 30, Math.PI, 0); g.closePath(); g.fill(); outline(g, 2.5);
    g.strokeStyle = 'rgba(120,170,220,.6)'; g.lineWidth = 1.5;
    [-10, -20].forEach((dy) => { const w = Math.sqrt(900 - dy * dy); g.beginPath(); g.moveTo(X - w, Y + dy); g.lineTo(X + w, Y + dy); g.stroke(); });
    for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(X + k * 11, Y); g.lineTo(X + k * 11 + 3, Y - 10); g.stroke(); }
    g.fillStyle = '#5a7fa8'; g.beginPath(); g.arc(X + 4, Y, 10, Math.PI, 0); g.closePath(); g.fill(); outline(g, 2);
    g.fillStyle = 'rgba(255,255,255,.7)'; ell(g, X - 12, Y - 20, 7, 3); g.fill();
  }
  function drawSnowman(g, p, T) {
    const X = p.x * T + T / 2, Y = p.y * T + T - 4;
    g.fillStyle = 'rgba(80,140,200,.2)'; ell(g, X, Y + 2, 13, 4); g.fill();
    g.fillStyle = '#fff'; ell(g, X, Y - 8, 12, 11); g.fill(); outline(g);
    ell(g, X, Y - 24, 9, 8); g.fill(); outline(g);
    g.fillStyle = p.scarf || '#f0443a'; g.fillRect(X - 9, Y - 18, 18, 4);
    g.fillStyle = INK; ell(g, X - 3, Y - 26, 1.4, 1.4); g.fill(); ell(g, X + 3, Y - 26, 1.4, 1.4); g.fill();
    g.fillStyle = '#ff8a1c'; g.beginPath(); g.moveTo(X, Y - 24); g.lineTo(X + 8, Y - 23); g.lineTo(X, Y - 22); g.fill();
  }
  function drawPine(g, p, T) {
    const X = p.x * T + T / 2, Y = p.y * T + T - 2;
    g.fillStyle = 'rgba(80,140,200,.22)'; ell(g, X, Y, 14, 4); g.fill();
    g.fillStyle = '#8a5a35'; g.fillRect(X - 3, Y - 8, 6, 8);
    [[0, 18, 16], [-14, 14, 13], [-26, 10, 11]].forEach(([dy, w, h]) => {
      g.fillStyle = '#2f9d62'; g.beginPath(); g.moveTo(X - w, Y - 6 + dy); g.lineTo(X + w, Y - 6 + dy); g.lineTo(X, Y - 6 + dy - h - 6); g.closePath(); g.fill(); outline(g, 2);
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(X - w * 0.45, Y - 6 + dy - h * 0.6); g.lineTo(X + w * 0.45, Y - 6 + dy - h * 0.6); g.lineTo(X, Y - 6 + dy - h - 6); g.closePath(); g.fill();
    });
  }
  function drawPalm(g, p, T, now, pot) {
    const X = p.x * T + T / 2, Y = p.y * T + T - 3;
    g.fillStyle = 'rgba(150,100,40,.22)'; ell(g, X, Y + 1, 14, 4); g.fill();
    if (pot) { g.fillStyle = '#d98b5f'; rr(g, X - 10, Y - 14, 20, 15, 4); g.fill(); outline(g); }
    const h = pot ? 30 : 44, base = pot ? Y - 12 : Y;
    const sway = Math.sin(now / 900 + p.x) * 2;
    g.strokeStyle = '#8a5a35'; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(X, base); g.quadraticCurveTo(X - 6, base - h * 0.5, X + sway, base - h); g.stroke();
    g.strokeStyle = 'rgba(60,35,15,.35)'; g.lineWidth = 1.5;
    for (let k = 1; k < 5; k++) { const yy = base - k * h / 5; g.beginPath(); g.moveTo(X - 4, yy); g.lineTo(X + 3, yy - 2); g.stroke(); }
    const tx = X + sway, ty = base - h;
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + (k - 3) * 0.55;
      g.fillStyle = k % 2 ? '#3fb36b' : '#2f9d62';
      g.beginPath(); g.moveTo(tx, ty);
      g.quadraticCurveTo(tx + Math.cos(a) * 18 - 4, ty + Math.sin(a) * 18 - 6, tx + Math.cos(a) * (pot ? 18 : 26), ty + Math.sin(a) * (pot ? 12 : 18) + 10);
      g.quadraticCurveTo(tx + Math.cos(a) * 12, ty + Math.sin(a) * 10, tx, ty); g.fill(); outline(g, 1.5);
    }
    if (p.dates) {
      g.fillStyle = '#8b4a1c';
      for (let k = 0; k < 6; k++) { ell(g, tx - 6 + (k % 3) * 6, ty + 5 + Math.floor(k / 3) * 5, 3, 3.5); g.fill(); }
    }
  }
  function drawRock(g, p, T) {
    const X = p.x * T + T / 2, Y = p.y * T + T - 6;
    g.fillStyle = '#d2b58c'; g.beginPath(); g.moveTo(X - 13, Y + 4); g.quadraticCurveTo(X - 14, Y - 12, X - 2, Y - 14); g.quadraticCurveTo(X + 14, Y - 10, X + 13, Y + 4); g.closePath(); g.fill(); outline(g);
    g.fillStyle = 'rgba(255,255,255,.35)'; ell(g, X - 4, Y - 8, 4, 2); g.fill();
  }
  function drawBench(g, p, T) {
    const X = p.x * T, Y = p.y * T;
    g.fillStyle = '#b0773f'; rr(g, X + 4, Y + 8, p.w * T - 8, 10, 3); g.fill(); outline(g);
    g.fillStyle = '#8d5a2b'; rr(g, X + 4, Y + 2, p.w * T - 8, 6, 3); g.fill(); outline(g, 1.5);
    g.fillStyle = INK; g.fillRect(X + 8, Y + 18, 3, 8); g.fillRect(X + p.w * T - 11, Y + 18, 3, 8);
  }
  function drawFountain(g, p, T, now) {
    const X = (p.x + p.w / 2) * T, Y = (p.y + p.h / 2) * T;
    g.fillStyle = '#e9dcc3'; ell(g, X, Y, p.w * T / 2 + 6, p.h * T / 2 + 4); g.fill(); outline(g, 2.5);
    g.fillStyle = '#7fd3ea'; ell(g, X, Y, p.w * T / 2 - 4, p.h * T / 2 - 5); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + now / 1600, r = 14 + 6 * Math.sin(now / 300 + k);
      g.beginPath(); g.moveTo(X, Y - 2); g.quadraticCurveTo(X + Math.cos(a) * r, Y - 26, X + Math.cos(a) * r * 1.7, Y + Math.sin(a) * 6); g.stroke();
    }
    g.fillStyle = '#fff'; ell(g, X, Y - 4, 5, 3); g.fill();
  }
  function drawOasis(g, p, T) {
    const X = (p.x + 1) * T, Y = (p.y + 1) * T;
    g.fillStyle = '#9edc8a'; ell(g, X, Y, 40, 32); g.fill();
    g.fillStyle = '#6fd0e8'; ell(g, X, Y, 30, 23); g.fill(); outline(g, 2.5);
    g.fillStyle = 'rgba(255,255,255,.5)'; ell(g, X - 8, Y - 7, 9, 3); g.fill();
    g.strokeStyle = '#3d9c5a'; g.lineWidth = 2;
    for (let k = 0; k < 6; k++) { const a = k * 1.05; g.beginPath(); g.moveTo(X + Math.cos(a) * 34, Y + Math.sin(a) * 26); g.lineTo(X + Math.cos(a) * 38, Y + Math.sin(a) * 26 - 9); g.stroke(); }
  }
  function drawLandmark(g, p, T, key, wTiles) {
    const i = img(LM_URL(key));
    const X = (p.x + p.w / 2) * T, base = (p.y + p.h) * T + 4;
    g.fillStyle = 'rgba(29,36,64,.18)'; ell(g, X, base - 4, p.w * T * 0.55, 8); g.fill();
    if (!ready(i)) { g.fillStyle = '#dfe6f5'; rr(g, p.x * T, p.y * T, p.w * T, p.h * T, 8); g.fill(); outline(g); return; }
    const w = wTiles * T, h = w * i.naturalHeight / i.naturalWidth;
    g.drawImage(i, X - w / 2, base - h, w, h);
  }
  function drawCamel(g, p, T) {
    const i = img(SKIN_URL('camel'));
    const X = (p.x + 1) * T, base = (p.y + 1) * T + 4;
    g.fillStyle = 'rgba(150,100,40,.25)'; ell(g, X, base - 2, 26, 6); g.fill();
    if (ready(i)) g.drawImage(i, X - 30, base - 58, 60, 60);
  }
  function drawBoat(g, d, T, now) {
    const X = d.x * T, Y = d.y * T + Math.sin(now / 700 + d.x) * 2;
    g.fillStyle = 'rgba(30,90,130,.25)'; ell(g, X, Y + 9, 26, 5); g.fill();
    g.fillStyle = ['#b06a35', '#9c5a2c', '#c27a42'][d.hue || 0];
    g.beginPath(); g.moveTo(X - 26, Y); g.quadraticCurveTo(X, Y + 16, X + 26, Y); g.closePath(); g.fill(); outline(g, 2);
    g.fillStyle = '#fff3d6'; g.fillRect(X - 14, Y - 14, 28, 5); g.strokeStyle = INK; g.lineWidth = 1.5; g.strokeRect(X - 14, Y - 14, 28, 5);
    g.fillStyle = INK; g.fillRect(X - 12, Y - 9, 2, 9); g.fillRect(X + 10, Y - 9, 2, 9);
    g.fillStyle = '#ffd23f'; ell(g, X, Y - 6, 2.5, 2.5); g.fill();
  }
  function drawLamp(g, d, T) {
    const X = d.x * T, Y = d.y * T;
    g.fillStyle = INK; g.fillRect(X - 1.5, Y - 26, 3, 26);
    g.fillStyle = 'rgba(255,210,90,.35)'; ell(g, X, Y - 28, 10, 10); g.fill();
    g.fillStyle = '#ffd23f'; ell(g, X, Y - 28, 4, 4); g.fill(); outline(g, 1.5);
  }
  function drawLantern(g, d, T, now) {
    const X = d.x * T, Y = d.y * T + Math.sin(now / 800 + d.x) * 1.5;
    g.strokeStyle = 'rgba(29,36,64,.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(X, Y - 26); g.lineTo(X, Y - 18); g.stroke();
    g.fillStyle = ['#f0443a', '#ffb020', '#26b5a8', '#8b5cf6', '#2f7bea'][d.hue || 0];
    ell(g, X, Y - 12, 5, 7); g.fill(); outline(g, 1.2);
  }
  function drawPearl(g, j, T, now, cool) {
    const X = j.x * T, Y = j.y * T;
    g.strokeStyle = 'rgba(255,255,255,.65)'; g.lineWidth = 2;
    const r = 10 + ((now / 50) % 20);
    g.globalAlpha = 1 - ((now / 50) % 20) / 20; ell(g, X, Y, r, r * 0.5); g.stroke(); g.globalAlpha = 1;
    g.fillStyle = cool ? '#b9b4c9' : '#d9cff0'; g.beginPath(); g.arc(X, Y, 10, Math.PI, 0); g.closePath(); g.fill(); outline(g, 1.8);
    g.fillStyle = '#fff'; ell(g, X, Y - 3, 4, 4); g.fill();
    if (!cool) { g.fillStyle = 'rgba(255,255,255,.9)'; const s = 2 + Math.sin(now / 200) * 1.5; g.fillRect(X + 3, Y - 9, s, s); }
  }

  // ---------- kids ----------
  function drawKid(g, k, T, now, o) {
    if (k.flags & 8) return;                                   // respawning (frozen, on the way to Ski Dubái)
    const ice = !!(k.flags & 1), stun = !!(k.flags & 2), shield = !!(k.flags & 4);
    const moving = k.moving && !stun;
    const bob = moving ? -Math.abs(Math.sin(now / 90 + k.idx)) * 4 : 0;
    const S = o.size || 46;
    // shadow + the side ring at the feet
    g.fillStyle = 'rgba(29,36,64,.22)'; ell(g, k.x, k.y + 1, 14, 5); g.fill();
    g.strokeStyle = ice ? ICE : SUN; g.lineWidth = k.me ? 4 : 3;
    ell(g, k.x, k.y + 1, 17, 7); g.stroke();
    if (k.me) { g.strokeStyle = `rgba(255,255,255,${0.6 + 0.4 * Math.sin(now / 200)})`; g.lineWidth = 2; ell(g, k.x, k.y + 1, 22, 9); g.stroke(); }
    if (ice && o.armor) { g.fillStyle = 'rgba(76,195,255,.18)'; ell(g, k.x, k.y - S * 0.45, S * 0.55, S * 0.6); g.fill(); }
    const src = ice ? frost(k.skin) : img(SKIN_URL(k.skin));
    g.save();
    g.translate(k.x, k.y + bob);
    if (moving) g.rotate(Math.sin(now / 90 + k.idx) * 0.06);
    if (k.f === 3 || k.f === 4 || k.f === 5) g.scale(-1, 1);
    if (src && (src.width || src.naturalWidth)) g.drawImage(src, -S / 2, -S + 4, S, S);
    else { g.fillStyle = ice ? ICE : SUN; ell(g, 0, -S / 2, S / 3, S / 3); g.fill(); }
    g.restore();
    if (ice) {   // little ice crystals around the head
      g.fillStyle = 'rgba(255,255,255,.9)';
      for (let i = 0; i < 3; i++) { const a = now / 600 + i * 2.1 + k.idx; g.fillRect(k.x + Math.cos(a) * S * 0.45, k.y - S * 0.7 + Math.sin(a) * 6, 3, 3); }
    }
    if (stun) {   // stunned: an ice block around the kid
      g.fillStyle = 'rgba(180,230,255,.55)'; rr(g, k.x - S * 0.45, k.y - S + 2, S * 0.9, S, 8); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo(k.x - S * 0.3, k.y - S * 0.8); g.lineTo(k.x - S * 0.1, k.y - S * 0.55); g.stroke();
      rr(g, k.x - S * 0.45, k.y - S + 2, S * 0.9, S, 8); outline(g, 2);
    }
    if (shield) { g.strokeStyle = `rgba(255,255,255,${0.55 + 0.3 * Math.sin(now / 150)})`; g.lineWidth = 3; ell(g, k.x, k.y - S * 0.42, S * 0.62, S * 0.62); g.stroke(); }
  }
  // name tags: a fixed size on screen whatever the zoom (s = world→CSS px scale)
  function drawTag(g, k, s, o) {
    if (k.flags & 8 || !k.name) return;
    const S = o.size || 46;
    const fs = (o.tag || 13) / s;
    g.font = `800 ${fs}px Nunito, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const label = k.me && o.meLabel ? o.meLabel : k.name.slice(0, 12);
    const w = g.measureText(label).width + 12 / s;
    const y = k.y - S - 4 / s - fs * 0.6;
    g.fillStyle = k.me ? '#ffd23f' : (k.flags & 1) ? 'rgba(214,241,255,.96)' : 'rgba(255,247,227,.94)';
    rr(g, k.x - w / 2, y - fs * 0.62, w, fs * 1.24, fs * 0.5); g.fill();
    g.strokeStyle = (k.flags & 1) ? ICE_DEEP : SUN_DEEP; g.lineWidth = 2 / s; g.stroke();
    g.fillStyle = INK; g.fillText(label, k.x, y + fs * 0.04);
  }

  // ---------- balls + effects ----------
  function drawBall(g, b) {
    g.fillStyle = 'rgba(29,36,64,.18)'; ell(g, b.x, b.y + 2, 6, 2.5); g.fill();
    const h = 16;
    g.fillStyle = b.side === 'ice' ? 'rgba(76,195,255,.35)' : 'rgba(255,255,255,.5)';
    ell(g, b.x - b.dx * 9, b.y - h - b.dy * 9, 4.5, 4.5); g.fill();
    g.fillStyle = b.side === 'ice' ? '#bfeaff' : '#ffffff'; ell(g, b.x, b.y - h, 7, 7); g.fill(); outline(g, 2);
    g.fillStyle = b.side === 'ice' ? '#7fd3ff' : '#e3eef9'; ell(g, b.x + 2, b.y - h + 2, 3, 3); g.fill();
  }
  function drawFx(g, fx, now) {
    const t = (now - fx.t0) / fx.dur;
    if (t < 0 || t > 1) return;
    const X = fx.x, Y = fx.y - 18;
    if (fx.kind === 'splash' || fx.kind === 'brrr') {
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + fx.seed;
        g.fillStyle = fx.kind === 'brrr' ? `rgba(120,210,255,${1 - t})` : `rgba(255,255,255,${1 - t})`;
        ell(g, X + Math.cos(a) * 20 * t, Y + Math.sin(a) * 14 * t, 4 * (1 - t) + 1, 4 * (1 - t) + 1); g.fill();
      }
      if (fx.kind === 'brrr') { g.strokeStyle = `rgba(76,195,255,${1 - t})`; g.lineWidth = 3; ell(g, X, Y, 14 + 20 * t, 10 + 14 * t); g.stroke(); }
    } else if (fx.kind === 'freeze') {
      g.strokeStyle = `rgba(76,195,255,${1 - t})`; g.lineWidth = 5 * (1 - t) + 1; ell(g, X, Y, 20 + 60 * t, 14 + 40 * t); g.stroke();
      for (let i = 0; i < 10; i++) {
        const a = i * Math.PI / 5 + fx.seed, r = 10 + 46 * t;
        g.fillStyle = `rgba(200,240,255,${1 - t})`;
        g.save(); g.translate(X + Math.cos(a) * r, Y + Math.sin(a) * r * 0.75); g.rotate(a);
        g.beginPath(); g.moveTo(0, -6); g.lineTo(3, 0); g.lineTo(0, 6); g.lineTo(-3, 0); g.closePath(); g.fill(); g.restore();
      }
    } else if (fx.kind === 'stun' || fx.kind === 'shield' || fx.kind === 'armor') {
      g.strokeStyle = fx.kind === 'stun' ? `rgba(76,195,255,${1 - t})` : `rgba(255,255,255,${1 - t})`;
      g.lineWidth = 4; ell(g, X, Y, 16 + 22 * t, 16 + 22 * t); g.stroke();
    } else if (fx.kind === 'plus') {
      g.font = '900 20px Baloo 2, Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.globalAlpha = 1 - t * t;
      g.lineWidth = 4; g.strokeStyle = INK; g.strokeText(fx.text, X, Y - 26 - 30 * t);
      g.fillStyle = fx.color || '#ffd23f'; g.fillText(fx.text, X, Y - 26 - 30 * t);
      g.globalAlpha = 1;
    } else if (fx.kind === 'chest') {
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6 + fx.seed, r = 8 + 40 * t;
        g.fillStyle = i % 2 ? `rgba(255,210,63,${1 - t})` : `rgba(255,255,255,${1 - t})`;
        g.fillRect(X + Math.cos(a) * r, Y + Math.sin(a) * r * 0.8, 4, 4);
      }
    }
  }
  function drawChest(g, c, now, big) {
    const X = c.x, Y = c.y + Math.sin(now / 260) * 2;
    if (big) {   // a soft light column so the whole class sees where it is
      const gr = g.createLinearGradient(0, Y - 140, 0, Y);
      gr.addColorStop(0, 'rgba(255,210,63,0)'); gr.addColorStop(1, 'rgba(255,210,63,.45)');
      g.fillStyle = gr; g.fillRect(X - 16, Y - 140, 32, 140);
    }
    g.fillStyle = 'rgba(29,36,64,.22)'; ell(g, X, c.y + 3, 16, 5); g.fill();
    const ci = img(PROP_URL('ice-chest'));          // the ice chest picture (art batch 2026-10-17)
    if (ready(ci)) {
      const w = 42, h = w * ci.naturalHeight / ci.naturalWidth;
      g.drawImage(ci, X - w / 2, Y - h + 3, w, h);
      const s2 = 2 + 2 * Math.sin(now / 150);
      g.fillStyle = '#fff'; g.fillRect(X + 12, Y - h, s2, s2); g.fillRect(X - 15, Y - h + 6, s2 * 0.7, s2 * 0.7);
      return;
    }
    g.fillStyle = '#9fe0ff'; rr(g, X - 15, Y - 20, 30, 20, 4); g.fill(); outline(g, 2);
    g.fillStyle = '#5cc8ff'; rr(g, X - 16, Y - 28, 32, 10, 5); g.fill(); outline(g, 2);
    g.fillStyle = '#ffc93c'; g.fillRect(X - 3, Y - 28, 6, 28); g.strokeStyle = INK; g.lineWidth = 1.5; g.strokeRect(X - 3, Y - 28, 6, 28);
    g.fillStyle = '#fff'; g.font = '900 11px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('❄', X - 9, Y - 10);
    const s = 2 + 2 * Math.sin(now / 150);
    g.fillStyle = '#fff'; g.fillRect(X + 10, Y - 34, s, s); g.fillRect(X - 14, Y - 30, s * 0.7, s * 0.7);
  }

  // ---------- the whole world ----------
  // st: { map, kids:[{idx,x,y,f,flags,skin,name,me,moving}], balls, chest, fx, near:{station,job}, jobsCool, armor }
  // view: { s } world→CSS scale (for name tags), opts: { groundScale, tag, size, big }
  const PROP_DRAW = {
    station: null, stall: drawStall, sacks: drawSacks, planter: drawPlanter, igloo: drawIgloo, snowman: drawSnowman, pine: drawPine,
    palm: (g, p, T, now) => drawPalm(g, p, T, now, false), potpalm: (g, p, T, now) => drawPalm(g, p, T, now, true), rock: drawRock,
    bench: drawBench, fountain: drawFountain, oasis: drawOasis, camel: drawCamel,
    museum: (g, p, T) => drawLandmark(g, p, T, 'museum', 3.8), burj: (g, p, T) => drawLandmark(g, p, T, 'burj', 2.6),
    frame: (g, p, T) => drawLandmark(g, p, T, 'frame', 2.4), atlantis: (g, p, T) => drawLandmark(g, p, T, 'atlantis', 3.6),
    arab: (g, p, T) => drawLandmark(g, p, T, 'arab', 2.4),
  };
  function world(g, st, view, opts) {
    const map = st.map, T = map.tile, now = st.now || performance.now();
    const gc = ground(map, opts.groundScale || 1);
    g.drawImage(gc, 0, 0, map.cols * T, map.rows * T);
    // flat things on the ground first (oasis, fountain basins sit under everything)
    const list = [];
    map.props.forEach((p) => {
      if (p.kind === 'oasis') { if (!drawPropPic(g, p, T)) drawOasis(g, p, T); return; }
      list.push({ y: (p.y + p.h) * T - (p.kind === 'fountain' ? 20 : 0), p });
    });
    (map.decor || []).forEach((d) => { if (d.kind === 'boat' && !drawDecorPic(g, d, T, now)) drawBoat(g, d, T, now); });
    map.jobs.forEach((j) => { if (j.kind === 'pearl' && !drawPearlPic(g, j, T, now, st.jobsCool)) drawPearl(g, j, T, now, st.jobsCool); });
    (map.decor || []).forEach((d) => { if (d.kind === 'lamp' || d.kind === 'lantern') list.push({ y: d.y * T + 1, d }); });
    (st.kids || []).forEach((k) => list.push({ y: k.y, k }));
    if (st.chest) list.push({ y: st.chest.y, chest: st.chest });
    list.sort((a, b) => a.y - b.y);
    list.forEach((e) => {
      if (e.k) drawKid(g, e.k, T, now, { size: opts.size, armor: st.armor });
      else if (e.chest) drawChest(g, e.chest, now, opts.big);
      else if (e.d) { if (!drawDecorPic(g, e.d, T, now)) (e.d.kind === 'lamp' ? drawLamp : drawLantern)(g, e.d, T, now); }
      else if (e.p.kind === 'station') drawStation(g, e.p, T, now, st.near && st.near.station === e.p.id, true);
      else if (drawPropPic(g, e.p, T)) { /* its picture */ }
      else if (PROP_DRAW[e.p.kind]) PROP_DRAW[e.p.kind](g, e.p, T, now);
    });
    // the stations' «?» bubbles once more on top: no prop picture may ever hide where kids answer
    map.props.forEach((p) => { if (p.kind === 'station') stationBubble(g, p, T, now); });
    (st.balls || []).forEach((b) => drawBall(g, b));
    (st.fx || []).forEach((fx) => drawFx(g, fx, now));
    (st.kids || []).forEach((k) => drawTag(g, k, view.s, { size: opts.size, tag: opts.tag, meLabel: opts.meLabel }));
    if (opts.labels) zoneLabels(g, map, view.s, opts.labelSize || 13);
  }
  const LABELS = [['El Zoco', 7, 0.5], ['El Creek', 22, 0.5], ['Museo del Futuro', 36.5, 0.5], ['El Desierto', 7, 25.5],
    ['El Bulevar', 22, 25.5], ['Plaza del Burj Khalifa', 36.5, 25.5], ['Ski Dubái', 22, 17.85]];
  function zoneLabels(g, map, s, px) {
    const T = map.tile, fs = px / s;
    g.font = `800 ${fs}px Baloo 2, Nunito, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    LABELS.forEach(([t, x, y]) => {
      const w = g.measureText(t).width + 16 / s;
      const snow = t === 'Ski Dubái';
      g.fillStyle = snow ? 'rgba(76,195,255,.92)' : 'rgba(255,247,227,.95)';
      rr(g, x * T - w / 2, y * T - fs * 0.7, w, fs * 1.4, fs * 0.7); g.fill();
      g.strokeStyle = INK; g.lineWidth = 2 / s; g.stroke();
      g.fillStyle = snow ? '#fff' : INK; g.fillText(t, x * T, y * T + fs * 0.05);
    });
  }

  window.SnowRender = { INK, SUN, SUN_DEEP, ICE, ICE_DEEP, preload, frost, ground, world, img, SKIN_URL, LM_URL, ready };
})();
