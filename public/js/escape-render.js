// La Gran Fuga de Dubái — drawing shared by the projector and every phone: Robotín (the goofy guard robot), his
// tickle-zap, the three «zona segura» rooms, the green zones and the kids. Look: the Reinos de Colores sticker world
// (one navy outline, pastel fills, soft drop shadows) at Dubai's golden hour. Canvas only, no pictures with text.
// Robotín is drawn here until his art exists (brief: content/escape/pictures.json). window.EscapeRender.
(function () {
  const INK = '#1d2440';
  const SAFE = '#2fbf71', SAFE_DEEP = '#178a4c', ROBO = '#3fd6e0', ROBO_DEEP = '#1b8fa3', GOLD = '#ffd23f', DANGER = '#f0443a';
  const SKIN_URL = (k) => '/assets/saga/avatars/' + k + '.webp';
  const IMG = {};
  const img = (url) => { if (!IMG[url]) { const i = new Image(); i.decoding = 'async'; i.src = url; IMG[url] = i; } return IMG[url]; };
  const ready = (i) => i && i.complete && i.naturalWidth > 0;
  const still = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function preload(skins) {
    (skins || ['dralingo', 'fer', 'hamdan', 'latifa', 'aileen', 'adric', 'adrian', 'camel', 'plane', 'falcon', 'oryx']).forEach((k) => img(SKIN_URL(k)));
    ['/assets/kingdoms/landmarks/big/museum.webp', '/assets/kingdoms/landmarks/big/burj.webp', '/assets/saga/avatars/plane.webp'].forEach(img);
  }
  function rr(g, x, y, w, h, r) {
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, r);
    else { g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  }
  function ell(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); }
  function outline(g, w) { g.strokeStyle = INK; g.lineWidth = w; g.stroke(); }

  // ---------- Robotín ----------
  // (x, y) = the middle of his wheels on the ground, s = his height in px, faces right (dir -1 = left).
  // o: { t (s), mood: 'chase' | 'zap' | 'dizzy' | 'idle' | 'happy', moving, glitch }
  function robotin(g, x, y, s, o) {
    o = o || {};
    const t = o.t || 0, mood = o.mood || 'idle', dir = o.dir || 1;
    const lw = Math.max(1.5, s * 0.022);
    g.save();
    g.translate(x, y);
    // shadow
    g.fillStyle = 'rgba(29,36,64,.22)'; ell(g, 0, 0, s * 0.34, s * 0.05); g.fill();
    if (o.moving) {   // speed lines behind him
      g.strokeStyle = 'rgba(29,36,64,.25)'; g.lineWidth = lw; g.lineCap = 'round';
      for (let i = 0; i < 3; i++) { const yy = -s * (0.1 + i * 0.12); const off = (t * 3 + i * 0.3) % 1; g.beginPath(); g.moveTo(-dir * s * (0.42 + off * 0.1), yy); g.lineTo(-dir * s * (0.62 + off * 0.1), yy); g.stroke(); }
    }
    const bob = mood === 'dizzy' ? Math.sin(t * 9) * s * 0.02 : (o.moving ? Math.abs(Math.sin(t * 10)) * -s * 0.025 : Math.sin(t * 2.4) * s * 0.012);
    const tilt = mood === 'dizzy' ? Math.sin(t * 5) * 0.12 : (o.moving ? 0.06 * dir : 0);
    g.translate(0, bob);
    g.rotate(tilt);
    g.scale(dir, 1);
    // wheels
    g.fillStyle = '#4a5578'; rr(g, -s * 0.24, -s * 0.13, s * 0.48, s * 0.13, s * 0.06); g.fill(); outline(g, lw);
    for (let i = -1; i <= 1; i++) {
      g.fillStyle = '#c9d2e6'; ell(g, i * s * 0.14, -s * 0.065, s * 0.045, s * 0.045); g.fill();
      g.strokeStyle = '#4a5578'; g.lineWidth = lw * 0.6; g.beginPath(); const a = t * 12 + i; g.moveTo(i * s * 0.14 + Math.cos(a) * s * 0.035, -s * 0.065 + Math.sin(a) * s * 0.035); g.lineTo(i * s * 0.14 - Math.cos(a) * s * 0.035, -s * 0.065 - Math.sin(a) * s * 0.035); g.stroke();
    }
    // the back arm: a little claw that waves
    const wave = Math.sin(t * (mood === 'happy' ? 9 : 4)) * 0.5;
    g.save(); g.translate(-s * 0.26, -s * 0.46); g.rotate(-0.9 + wave);
    g.strokeStyle = INK; g.lineWidth = s * 0.05; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -s * 0.16); g.stroke();
    g.strokeStyle = '#dfe6f3'; g.lineWidth = s * 0.03; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -s * 0.16); g.stroke();
    g.fillStyle = '#ffb347'; ell(g, 0, -s * 0.19, s * 0.045, s * 0.045); g.fill(); outline(g, lw * 0.8);
    g.restore();
    // body: a round egg, white-silver with a pastel guard belt
    const bodyG = g.createLinearGradient(0, -s * 0.84, 0, -s * 0.14);
    bodyG.addColorStop(0, '#ffffff'); bodyG.addColorStop(1, '#cdd6ea');
    g.fillStyle = bodyG; rr(g, -s * 0.29, -s * 0.84, s * 0.58, s * 0.71, s * 0.27); g.fill(); outline(g, lw * 1.3);
    g.fillStyle = '#ffb347'; g.fillRect(-s * 0.29 + lw, -s * 0.31, s * 0.58 - lw * 2, s * 0.07);
    g.strokeStyle = INK; g.lineWidth = lw * 0.8; g.strokeRect(-s * 0.29 + lw, -s * 0.31, s * 0.58 - lw * 2, s * 0.07);
    g.fillStyle = GOLD; ell(g, s * 0.02, -s * 0.275, s * 0.05, s * 0.05); g.fill(); outline(g, lw * 0.8);       // the guard badge (no letters)
    // cheeks (goofy, never scary)
    g.fillStyle = 'rgba(255,140,170,.55)'; ell(g, -s * 0.2, -s * 0.42, s * 0.045, s * 0.03); g.fill(); ell(g, s * 0.22, -s * 0.42, s * 0.045, s * 0.03); g.fill();
    // the screen face
    g.fillStyle = '#17334a'; rr(g, -s * 0.21, -s * 0.76, s * 0.44, s * 0.29, s * 0.08); g.fill(); outline(g, lw);
    g.strokeStyle = 'rgba(95,243,255,.5)'; g.lineWidth = lw * 0.7; rr(g, -s * 0.19, -s * 0.74, s * 0.40, s * 0.25, s * 0.06); g.stroke();
    const ex = s * 0.025;
    [-1, 1].forEach((k) => {
      const cx = ex + k * s * 0.095, cy = -s * 0.63;
      if (mood === 'dizzy') {          // spiral eyes
        g.strokeStyle = '#7ff6ff'; g.lineWidth = lw * 0.8; g.beginPath();
        for (let a = 0; a < Math.PI * 5; a += 0.3) { const r = a / (Math.PI * 5) * s * 0.06; const px = cx + Math.cos(a + t * 6 * k) * r, py = cy + Math.sin(a + t * 6 * k) * r; if (a === 0) g.moveTo(px, py); else g.lineTo(px, py); }
        g.stroke();
      } else if (mood === 'zap' || mood === 'happy') {   // happy ^ ^ eyes
        g.strokeStyle = '#7ff6ff'; g.lineWidth = lw * 1.2; g.lineCap = 'round';
        g.beginPath(); g.moveTo(cx - s * 0.045, cy + s * 0.02); g.lineTo(cx, cy - s * 0.03); g.lineTo(cx + s * 0.045, cy + s * 0.02); g.stroke();
      } else {                         // googly eyes: big white, wobbling pupils
        g.fillStyle = '#ffffff'; ell(g, cx, cy, s * 0.068, s * 0.068); g.fill();
        const px = Math.sin(t * 7 + k * 1.7) * s * 0.018 + s * 0.012, py = Math.cos(t * 5.3 + k) * s * 0.014;
        g.fillStyle = INK; ell(g, cx + px, cy + py, s * 0.032, s * 0.032); g.fill();
        g.fillStyle = '#fff'; ell(g, cx + px - s * 0.01, cy + py - s * 0.012, s * 0.009, s * 0.009); g.fill();
      }
    });
    // mouth: a wobbly cyan grin (open «o» when zapping)
    g.strokeStyle = '#7ff6ff'; g.lineWidth = lw * 1.1; g.lineCap = 'round';
    if (mood === 'zap') { g.fillStyle = '#7ff6ff'; ell(g, ex, -s * 0.535, s * 0.04, s * 0.03); g.fill(); }
    else {
      g.beginPath();
      for (let i = 0; i <= 10; i++) { const u = i / 10; const px = ex - s * 0.08 + u * s * 0.16; const py = -s * 0.54 + Math.sin(u * Math.PI) * s * 0.03 + Math.sin(u * 12 + t * 8) * s * 0.004; if (!i) g.moveTo(px, py); else g.lineTo(px, py); }
      g.stroke();
    }
    // side bolts + antenna with a blinking bulb
    g.fillStyle = '#c9d2e6'; ell(g, -s * 0.29, -s * 0.6, s * 0.035, s * 0.05); g.fill(); outline(g, lw * 0.8);
    g.strokeStyle = INK; g.lineWidth = lw; g.beginPath(); g.moveTo(0, -s * 0.84); g.quadraticCurveTo(s * 0.03, -s * 0.92, s * 0.02 + Math.sin(t * 3) * s * 0.02, -s * 0.98); g.stroke();
    const blink = Math.floor(t * 3) % 2 === 0;
    g.fillStyle = mood === 'zap' ? '#7ff6ff' : (blink ? '#ff5a5f' : '#ffd23f');
    ell(g, s * 0.02 + Math.sin(t * 3) * s * 0.02, -s * 1.0, s * 0.045, s * 0.045); g.fill(); outline(g, lw * 0.8);
    // the front arm with the spinning broom
    g.save(); g.translate(s * 0.27, -s * 0.42);
    // the broom twirls up and down on the outer side only (never across his face)
    const spin = mood === 'dizzy' ? 0.5 + Math.sin(t * 4) * 0.4 : (mood === 'zap' ? -0.9 : -0.3 + Math.sin(t * (o.moving ? 11 : 3)) * 1.0);
    g.rotate(spin);
    g.strokeStyle = INK; g.lineWidth = s * 0.05; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.lineTo(s * 0.34, 0); g.stroke();
    g.strokeStyle = '#c98a4b'; g.lineWidth = s * 0.03; g.beginPath(); g.moveTo(0, 0); g.lineTo(s * 0.34, 0); g.stroke();
    g.fillStyle = GOLD; g.beginPath(); g.moveTo(s * 0.32, -s * 0.02); g.lineTo(s * 0.46, -s * 0.09); g.lineTo(s * 0.48, s * 0.09); g.lineTo(s * 0.32, s * 0.02); g.closePath(); g.fill(); outline(g, lw * 0.8);
    g.strokeStyle = 'rgba(160,110,20,.6)'; g.lineWidth = lw * 0.5;
    for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(s * 0.35, 0); g.lineTo(s * 0.47, i * s * 0.06); g.stroke(); }
    g.fillStyle = '#dfe6f3'; ell(g, 0, 0, s * 0.045, s * 0.045); g.fill(); outline(g, lw * 0.8);
    g.restore();
    // glitch: for a blink every ~2.4 s, two coloured slices jump sideways (his famous glitch)
    if (o.glitch !== false && (t % 2.4) < 0.14) {
      g.globalAlpha = 0.55;
      g.fillStyle = '#ff6ad5'; g.fillRect(-s * 0.3 + s * 0.05, -s * 0.66, s * 0.6, s * 0.035);
      g.fillStyle = ROBO; g.fillRect(-s * 0.3 - s * 0.04, -s * 0.5, s * 0.6, s * 0.03);
      g.globalAlpha = 1;
    }
    g.restore();
    if (mood === 'dizzy') stars(g, x, y - s * 1.02, s * 0.32, t);
  }
  // little stars orbiting a dizzy head (kids and Robotín)
  function stars(g, x, y, r, t) {
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + i * 2.09;
      const sx = x + Math.cos(a) * r, sy = y + Math.sin(a) * r * 0.35;
      star(g, sx, sy, r * 0.22, '#ffd23f');
    }
  }
  function star(g, x, y, r, color) {
    g.save(); g.translate(x, y); g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr_ = i % 2 ? r * 0.45 : r; g.lineTo(Math.cos(a) * rr_, Math.sin(a) * rr_); }
    g.closePath(); g.fillStyle = color; g.fill(); g.strokeStyle = INK; g.lineWidth = Math.max(1, r * 0.18); g.stroke(); g.restore();
  }
  // the tickle-zap: a jittery cyan lightning with a white core (seed changes the zigzag every frame)
  function zap(g, x1, y1, x2, y2, w, seed) {
    const n = 9;
    const pts = [[x1, y1]];
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    let s = seed || Math.random() * 1000;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let i = 1; i < n; i++) { const u = i / n; const j = (rnd() - 0.5) * len * 0.16; pts.push([x1 + dx * u + nx * j, y1 + dy * u + ny * j]); }
    pts.push([x2, y2]);
    const path = () => { g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); };
    g.lineCap = 'round'; g.lineJoin = 'round';
    path(); g.strokeStyle = 'rgba(127,246,255,.35)'; g.lineWidth = w * 3.2; g.stroke();
    path(); g.strokeStyle = ROBO; g.lineWidth = w * 1.4; g.stroke();
    path(); g.strokeStyle = '#ffffff'; g.lineWidth = w * 0.55; g.stroke();
  }

  // ---------- a kid (saga avatar) ----------
  // k: { x, y, skin, name, me, safe, dizzy, moving, f, idx }  feet at (x, y)
  function kid(g, k, size, t, o) {
    o = o || {};
    const S = size;
    const bob = k.moving && !k.dizzy ? -Math.abs(Math.sin(t * 11 + (k.idx || 0))) * S * 0.08 : 0;
    g.fillStyle = 'rgba(29,36,64,.22)'; ell(g, k.x, k.y + 1, S * 0.3, S * 0.1); g.fill();
    if (k.me || k.safe) {
      g.strokeStyle = k.safe ? SAFE : GOLD; g.lineWidth = Math.max(2, S * 0.07);
      ell(g, k.x, k.y + 1, S * 0.36, S * 0.14); g.stroke();
    }
    if (k.me) { g.strokeStyle = `rgba(255,255,255,${0.55 + 0.4 * Math.sin(t * 5)})`; g.lineWidth = Math.max(1.5, S * 0.04); ell(g, k.x, k.y + 1, S * 0.46, S * 0.18); g.stroke(); }
    const src = img(SKIN_URL(k.skin || 'dralingo'));
    g.save();
    g.translate(k.x, k.y + bob);
    if (k.dizzy) g.rotate(Math.sin(t * 9 + (k.idx || 0)) * 0.18);
    else if (k.moving) g.rotate(Math.sin(t * 11 + (k.idx || 0)) * 0.06);
    if (k.f === 3 || k.f === 4 || k.f === 5) g.scale(-1, 1);
    if (o.alpha) g.globalAlpha = o.alpha;
    if (ready(src)) g.drawImage(src, -S / 2, -S + S * 0.06, S, S);
    else { g.fillStyle = GOLD; ell(g, 0, -S / 2, S / 3, S / 3); g.fill(); }
    g.restore();
    if (k.dizzy) stars(g, k.x, k.y - S * 0.95, S * 0.34, t + (k.idx || 0));
  }
  // name tag a fixed size on screen (s = world → css px scale)
  function tag(g, k, size, s, px, meLabel) {
    if (!k.name) return;
    const fs = px / s;
    g.font = `800 ${fs}px Nunito, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const label = k.me && meLabel ? meLabel : String(k.name).slice(0, 12);
    const w = g.measureText(label).width + 12 / s;
    const y = k.y - size - 3 / s - fs * 0.5;
    g.fillStyle = k.me ? GOLD : (k.safe ? '#d6f7e3' : 'rgba(255,247,227,.95)');
    rr(g, k.x - w / 2, y - fs * 0.62, w, fs * 1.24, fs * 0.5); g.fill();
    g.strokeStyle = k.safe ? SAFE_DEEP : INK; g.lineWidth = 1.5 / s; g.stroke();
    g.fillStyle = INK; g.fillText(label, k.x, y + fs * 0.04);
  }

  // ---------- the zona segura rooms ----------
  const ROOM = {
    1: { floorA: '#efeafb', floorB: '#e7e1f7', seam: 'rgba(140,120,210,.18)', wall: '#cfd6ea', wallTop: '#e9edf7', glow: 'rgba(95,220,255,.35)' },
    2: { floorA: '#fbf3e4', floorB: '#f5e9d4', seam: 'rgba(190,150,80,.2)', wall: '#f1d6a8', wallTop: '#fbe9c9', glow: 'rgba(255,210,63,.35)' },
    3: { floorA: '#dfe7f2', floorB: '#d6e0ee', seam: 'rgba(80,110,160,.18)', wall: '#b9c6dc', wallTop: '#dbe4f2', glow: 'rgba(120,200,255,.3)' },
  };
  let roomCache = null;
  function roomGround(room, scale) {
    const key = room.seed + ':' + room.level + ':' + scale;
    if (roomCache && roomCache.key === key) return roomCache.canvas;
    const T = room.tile, W = room.cols * T, H = room.rows * T, P = ROOM[room.level] || ROOM[1];
    const c = document.createElement('canvas');
    c.width = Math.round(W * scale); c.height = Math.round(H * scale);
    const g = c.getContext('2d');
    g.scale(scale, scale);
    for (let y = 0; y < room.rows; y++) for (let x = 0; x < room.cols; x++) {
      const X = x * T, Y = y * T;
      g.fillStyle = (x + y) % 2 ? P.floorA : P.floorB; g.fillRect(X, Y, T, T);
      g.strokeStyle = P.seam; g.lineWidth = 1; g.strokeRect(X + 0.5, Y + 0.5, T - 1, T - 1);
    }
    if (room.level === 1) {          // glass floor: soft light strips
      for (let i = 0; i < 6; i++) { g.fillStyle = P.glow; rr(g, (2 + i * 3) * T, 3.5 * T + (i % 2) * 4 * T, 2.2 * T, 5, 3); g.fill(); }
    } else if (room.level === 2) {   // marble with gold diamonds
      for (let y = 2; y < room.rows - 1; y += 3) for (let x = 2; x < room.cols - 1; x += 4) {
        g.save(); g.translate(x * T, y * T); g.rotate(Math.PI / 4); g.fillStyle = 'rgba(255,201,60,.35)'; g.fillRect(-5, -5, 10, 10); g.restore();
      }
    } else {                         // gate carpet stripes + the walking lane
      g.fillStyle = 'rgba(255,255,255,.35)'; for (let x = 1; x < room.cols - 1; x += 2) g.fillRect(x * T, 10.4 * T, T, 4);
    }
    // walls: a thick top wall with a window band (Dubai outside), side and bottom walls
    g.fillStyle = P.wall; g.fillRect(0, 0, W, T); g.fillRect(0, 0, T, H); g.fillRect(W - T, 0, T, H); g.fillRect(0, H - T, W, T);
    const win = g.createLinearGradient(0, 3, 0, T - 6);
    win.addColorStop(0, '#ffd6a5'); win.addColorStop(1, '#f9b4c8');
    g.fillStyle = win; rr(g, T * 1.2, 4, W - T * 2.4, T - 10, 6); g.fill();
    g.fillStyle = 'rgba(29,36,64,.25)';
    for (let x = 2; x < room.cols - 2; x += 1.6) { const h = 6 + ((x * 37) % 13); g.fillRect(x * T, T - 6 - h, T * 0.5, h); }   // skyline through the glass
    if (room.level === 3) { g.fillStyle = '#ffffff'; rr(g, W * 0.62, 7, T * 2.2, 8, 4); g.fill(); g.fillRect(W * 0.62 + T * 0.9, 4, 5, 16); }   // the jet waiting outside
    g.strokeStyle = INK; g.lineWidth = 3; g.strokeRect(T - 1.5, T - 1.5, W - 2 * T + 3, H - 2 * T + 3);
    roomCache = { key, canvas: c };
    return c;
  }
  function prop(g, p, T, t) {
    const X = p.x * T, Y = p.y * T, W = p.w * T, H = p.h * T;
    g.fillStyle = 'rgba(29,36,64,.18)'; ell(g, X + W / 2, Y + H - 3, W * 0.48, 7); g.fill();
    if (p.kind === 'dock') {
      g.fillStyle = '#9aa7c4'; rr(g, X + 4, Y + 8, W - 8, H - 12, 10); g.fill(); outline(g, 2);
      g.fillStyle = ROBO; rr(g, X + 12, Y + 14, W - 24, 6, 3); g.fill();
    } else if (p.kind === 'ring') {
      const i = img('/assets/kingdoms/landmarks/big/museum.webp');
      if (ready(i)) { const w = W * 0.9, h = w * i.naturalHeight / i.naturalWidth; g.drawImage(i, X + W / 2 - w / 2, Y + H - h + 2, w, h); }
    } else if (p.kind === 'case') {
      const c = ['#ff9fc0', '#8fdcff', '#ffd23f', '#9be15d'][p.hue || 0];
      g.fillStyle = '#ffffff'; rr(g, X + 5, Y + 14, T - 10, T - 16, 4); g.fill(); outline(g, 2);
      g.fillStyle = 'rgba(200,235,255,.7)'; rr(g, X + 6, Y - 4, T - 12, 20, 5); g.fill(); outline(g, 2);
      g.fillStyle = c; ell(g, X + T / 2, Y + 7 + Math.sin(t * 2 + p.x) * 1.5, 6, 6); g.fill(); outline(g, 1.5);
    } else if (p.kind === 'planter' || p.kind === 'palm') {
      const cx = X + T / 2;
      g.fillStyle = p.kind === 'palm' ? '#d98b5f' : '#f4f6fb'; rr(g, cx - 10, Y + 12, 20, 18, 5); g.fill(); outline(g, 2);
      if (p.kind === 'palm') {
        g.strokeStyle = '#8a5a35'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx, Y + 13); g.lineTo(cx + Math.sin(t + p.x), Y - 12); g.stroke();
        for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * 0.6; g.fillStyle = k % 2 ? '#3fb36b' : '#2f9d62'; g.beginPath(); g.moveTo(cx, Y - 12); g.quadraticCurveTo(cx + Math.cos(a) * 12, Y - 18 + Math.sin(a) * 8, cx + Math.cos(a) * 18, Y - 6 + Math.sin(a) * 10); g.closePath(); g.fill(); outline(g, 1.2); }
      } else { g.fillStyle = '#4cb87a'; ell(g, cx, Y + 9, 13, 11); g.fill(); outline(g, 2); }
    } else if (p.kind === 'fountain') {
      g.fillStyle = '#e9dcc3'; ell(g, X + W / 2, Y + H / 2, W / 2 + 4, H / 2 + 2); g.fill(); outline(g, 2.5);
      g.fillStyle = '#7fd3ea'; ell(g, X + W / 2, Y + H / 2, W / 2 - 5, H / 2 - 6); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2;
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + t * 0.6; const r = 10 + 5 * Math.sin(t * 3 + k); g.beginPath(); g.moveTo(X + W / 2, Y + H / 2 - 2); g.quadraticCurveTo(X + W / 2 + Math.cos(a) * r, Y + H / 2 - 26, X + W / 2 + Math.cos(a) * r * 1.6, Y + H / 2 + Math.sin(a) * 6); g.stroke(); }
    } else if (p.kind === 'bench') {
      g.fillStyle = '#b0773f'; rr(g, X + 4, Y + 10, W - 8, 10, 3); g.fill(); outline(g, 2);
      g.fillStyle = '#8d5a2b'; rr(g, X + 4, Y + 3, W - 8, 6, 3); g.fill(); outline(g, 1.5);
    } else if (p.kind === 'seats') {
      const c = ['#2f7bea', '#26b5a8', '#8b5cf6'][p.hue || 0];
      for (let i = 0; i < p.w; i++) { g.fillStyle = c; rr(g, X + i * T + 3, Y + 4, T - 6, T - 8, 6); g.fill(); outline(g, 2); g.fillStyle = 'rgba(255,255,255,.35)'; rr(g, X + i * T + 6, Y + 6, T - 12, 6, 3); g.fill(); }
    } else if (p.kind === 'cart') {
      g.fillStyle = '#9aa7c4'; rr(g, X + 4, Y + 16, T - 8, 10, 3); g.fill(); outline(g, 2);
      g.fillStyle = '#ff9f1c'; rr(g, X + 6, Y + 2, 12, 14, 3); g.fill(); outline(g, 1.5);
      g.fillStyle = '#f0443a'; rr(g, X + 15, Y + 6, 11, 10, 3); g.fill(); outline(g, 1.5);
    }
  }
  // a green safe zone. o: { count, cap, safeMe, mine, t, flash }
  function zone(g, z, T, o) {
    const X = z.x * T, Y = z.y * T, W = z.w * T, H = z.h * T;
    const t = still() ? 0 : (o.t || 0);
    // full = grey (nobody else fits), except for me when I'm one of the protected kids inside: it stays green
    const full = z.cap && o.count >= z.cap && !o.mySafe;
    const pulse = 0.5 + 0.5 * Math.sin(t * 5 + z.id);
    g.fillStyle = full ? 'rgba(160,168,190,.42)' : `rgba(47,191,113,${0.32 + pulse * 0.16})`;
    rr(g, X + 3, Y + 3, W - 6, H - 6, 16); g.fill();
    g.setLineDash([10, 7]); g.lineDashOffset = -t * 30;
    g.strokeStyle = full ? '#7c849c' : SAFE_DEEP; g.lineWidth = 4; rr(g, X + 3, Y + 3, W - 6, H - 6, 16); g.stroke();
    g.setLineDash([]);
    if (o.mine && o.mySafe) { g.strokeStyle = SAFE_DEEP; g.lineWidth = 6; rr(g, X - 2, Y - 2, W + 4, H + 4, 20); g.stroke(); }
    // the shield mark in the middle (a picture, no letters)
    const cx = X + W / 2, cy = Y + H / 2;
    g.globalAlpha = 0.55;
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(cx, cy - 16); g.lineTo(cx + 14, cy - 10); g.lineTo(cx + 12, cy + 6); g.quadraticCurveTo(cx, cy + 18, cx, cy + 18); g.quadraticCurveTo(cx, cy + 18, cx - 12, cy + 6); g.lineTo(cx - 14, cy - 10); g.closePath(); g.fill();
    g.globalAlpha = 1;
  }
  // the zone's limit as a badge above it («3/6», full = gold). px = its size on screen, s = world → css scale
  function zoneBadge(g, z, T, count, s, px, mine) {
    if (!z.cap) return;
    const fs = px / s;
    const full = count >= z.cap && !mine;
    const label = full ? `${z.cap}/${z.cap} ¡llena!` : `${Math.min(count, z.cap)}/${z.cap}`;
    g.font = `800 ${fs}px "Baloo 2", Nunito, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = g.measureText(label).width + fs * 1.6 + 10 / s;
    const cx = (z.x + z.w / 2) * T, cy = (z.y + z.h) * T - 2;      // on the bottom edge: the name tags of the kids inside sit at the top
    g.fillStyle = full ? '#d9dce6' : (mine ? '#d6f7e3' : '#ffffff'); rr(g, cx - w / 2, cy - fs * 0.75, w, fs * 1.5, fs * 0.75); g.fill();
    g.strokeStyle = INK; g.lineWidth = 2 / s; g.stroke();
    // a little person mark (head + shoulders), then the numbers
    const mx = cx - w / 2 + fs * 0.85, my = cy;
    g.fillStyle = INK; ell(g, mx, my - fs * 0.22, fs * 0.2, fs * 0.2); g.fill(); g.beginPath(); g.arc(mx, my + fs * 0.42, fs * 0.36, Math.PI, 0); g.fill();
    g.fillStyle = INK; g.fillText(label, cx + fs * 0.5, cy + fs * 0.05);
  }
  // the whole room. st: { room, zones, occ: {zid: {n, safe:[idx]}}, kids:[{x,y,skin,name,me,safe,dizzy,moving,f,idx}], t,
  //   flash (0..1 the zap landing), robot: { mood }, myZone }, view: { s }, o: { size, tag, groundScale, meLabel, badge }
  function room(g, st, view, o) {
    const r = st.room, T = r.tile, t = st.t || 0;
    g.drawImage(roomGround(r, o.groundScale || 1), 0, 0, r.cols * T, r.rows * T);
    // the zap landing lights the floor cyan everywhere but the zones (a floor effect: the kids stay readable on top)
    if (st.flash > 0) {
      g.save();
      g.globalAlpha = Math.min(1, st.flash) * 0.5;
      g.fillStyle = '#9ff8ff'; g.fillRect(T, T, (r.cols - 2) * T, (r.rows - 2) * T);
      g.restore();
    }
    (st.zones || []).forEach((z) => {
      const oc = (st.occ || {})[z.id] || { n: 0, safe: [] };
      zone(g, z, T, { count: oc.n, t, mine: st.myZone === z.id, mySafe: st.myZone === z.id && st.mySafe });
    });
    // props + Robotín + kids, back to front
    const list = [];
    r.props.forEach((p) => list.push({ y: (p.y + p.h) * T, p }));
    (st.kids || []).forEach((k) => list.push({ y: k.y, k }));
    const dx = (r.dock.x + r.dock.w / 2) * T, dy = (r.dock.y + r.dock.h) * T + 2;
    list.push({ y: dy + 0.5, robot: true });
    list.sort((a, b) => a.y - b.y);
    list.forEach((e) => {
      if (e.p) prop(g, e.p, T, t);
      else if (e.robot) robotin(g, dx, dy, T * 2.1, { t, mood: (st.robot && st.robot.mood) || 'idle' });
      else if (!e.k.me) kid(g, e.k, o.size || 44, t, { alpha: o.dimOthers ? 0.9 : 1 });
    });
    // my own avatar always on top (on a phone a classmate standing on my tile must never hide me)
    (st.kids || []).forEach((k) => { if (k.me) kid(g, k, o.size || 44, t, {}); });
    // … and the tickle lightning from Robotín to the kids caught outside
    if (st.flash > 0) (st.zapTargets || []).slice(0, 12).forEach((k, i) => zap(g, dx + 10, dy - T * 1.2, k.x, k.y - 20, 3, Math.floor(t * 20) + i * 7));
    (st.zones || []).forEach((z) => { const oc = (st.occ || {})[z.id] || { n: 0 }; zoneBadge(g, z, T, oc.n, view.s, o.badge || 13, st.myZone === z.id && st.mySafe); });
    (st.kids || []).forEach((k) => { if (k.me || o.tags) tag(g, k, o.size || 44, view.s, o.tag || 11, o.meLabel); });
  }

  window.EscapeRender = { INK, SAFE, SAFE_DEEP, ROBO, ROBO_DEEP, GOLD, DANGER, SKIN_URL, img, ready, preload, rr, ell, robotin, zap, star, stars, kid, tag, room, roomGround, zone };
})();
