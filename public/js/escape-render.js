// La Gran Fuga de Dubái v2 — drawing shared by the projector and every phone (spec docs/specs/gran-fuga-v2.md):
//   scene()  Robotín's world, the run: the zone's far background (slow parallax) and its ground strip scrolling under the
//            crew (both mirror-tiled, so the seams always match), the gate of the next place or Hamdan's jet arriving
//   room()   the zona segura: the zone's painted top-down room, the seeded props, Robotín at his dock, the glowing green
//            zones with their limits, the kids, name tags that never overlap
//   robotin(), kid(), tag(), zap(), stars()  the characters
// Every picture is drawn once loaded; until then a soft fallback in the zone's colours (never a blank stage).
// Art: assets/escape/<zone>/{bg,ground,room}.webp, gates/, jet.webp, props/, robotin/ (Higgsfield, 2026-10-17).
// window.EscapeRender.
(function () {
  const INK = '#1d2440';
  const SAFE = '#2fbf71', SAFE_DEEP = '#178a4c', ROBO = '#3fd6e0', ROBO_DEEP = '#1b8fa3', GOLD = '#ffd23f', DANGER = '#f0443a';
  const M = () => window.EscapeMap;
  // (🪙 2026-10-19: a skin of El Zoco runs as its own head picture and full body, public/js/saga.js)
  const SKIN_URL = (k) => (window.Saga && window.Saga.zoco && window.Saga.zoco(k) ? window.Saga.skinHead(k) : '/assets/saga/avatars/' + k + '.webp');
  // a kid's FULL-BODY character (never a bust in the play area): pose 'idle' | 'ok' (cheering: a turbo) | 'no' (dizzy);
  // js/halcon-board.js holds the cast's full-body poses and the animals' stills (loaded on both pages)
  const BODY_URL = (k, pose) => (window.HalconBoard ? window.HalconBoard.art(k || 'dralingo', pose || 'idle') : SKIN_URL(k || 'dralingo'));
  // Robotín's pictures, one per mood (art batch 2026-10-17)
  const ROBO_MOODS = ['idle', 'chase', 'zap', 'dizzy', 'happy'];
  const ROBO_URL = (m) => '/assets/escape/robotin/' + (ROBO_MOODS.includes(m) ? m : 'idle') + '.webp';
  // where his eyes (x, y, radius as fractions of the picture's width / height / width) and his antenna bulb are, per picture
  const ROBO_PTS = { chase: { eyes: [[0.629, 0.511, 0.052], [0.771, 0.525, 0.042]], antenna: [0.616, 0.139] } };
  // a one-off drawing (a card, a band, the meter) redraws itself once a picture it needs has loaded
  const waiters = new Map();
  function onLoad(url, key, fn) {
    const i = img(url);
    if (ready(i)) return;
    let m = waiters.get(i);
    if (!m) {
      m = new Map();
      waiters.set(i, m);
      i.addEventListener('load', () => { const mm = waiters.get(i); waiters.delete(i); if (mm) mm.forEach((f) => { try { f(); } catch (_) {} }); }, { once: true });
    }
    m.set(key, fn);
  }
  const onRobot = (mood, key, fn) => onLoad(ROBO_URL(mood), key, fn);
  const IMG = {};
  const img = (url) => { if (!IMG[url]) { const i = new Image(); i.decoding = 'async'; i.src = url; IMG[url] = i; } return IMG[url]; };
  const ready = (i) => i && i.complete && i.naturalWidth > 0;
  const still = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  // load what a screen will need: the cast skins, Robotín, and the route's art (the phones ask for one zone at a time)
  function preload(skins, route, zones) {
    (skins || ['dralingo', 'fer', 'hamdan', 'latifa', 'aileen', 'adric', 'adrian', 'camel', 'plane', 'falcon', 'oryx']).forEach((k) => { img(SKIN_URL(k)); img(BODY_URL(k, 'idle')); });
    ROBO_MOODS.forEach((m) => img(ROBO_URL(m)));
    const EM = M();
    if (!EM || route == null) return;
    const list = zones || EM.route(route).zones;
    list.forEach((zid) => {
      const z = EM.ZONES[zid];
      if (!z) return;
      ['bg', 'ground'].forEach((f) => img(EM.art(zid, f)));
      img(EM.gateArt(z.exit));
    });
  }
  // the room's picture: only when the room is about to be used (a phone downloads one room at a time)
  const roomArt = (zid) => img(M().art(zid, 'room'));
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
    // his picture for this mood (art batch 2026-10-17, Higgsfield), with the same bob / tilt / facing; the canvas
    // drawing below stays as the fallback until it has loaded (each mood loads the first time it is drawn)
    const pic = img(ROBO_URL(mood));
    if (ready(pic)) {
      const h = s * 1.08, w = h * pic.naturalWidth / pic.naturalHeight;
      const px = -w / 2, py = -h + s * 0.02;
      g.drawImage(pic, px, py, w, h);
      // the chase pass (2026-10-19): his eyes glow red as he closes in on a kid (o.eyes 0..1), and in a lunge his
      // antenna flashes red / blue like a siren (o.siren). Points are fractions of the chase picture.
      const pts = ROBO_PTS[mood];
      if (pts && o.eyes > 0) {
        const a = Math.min(1, o.eyes);
        pts.eyes.forEach(([fx, fy, fr]) => {
          const ex = px + fx * w, ey = py + fy * h, er = fr * w;
          const halo = g.createRadialGradient(ex, ey, er * 0.2, ex, ey, er * 2.6);
          halo.addColorStop(0, `rgba(255,70,60,${0.55 * a})`); halo.addColorStop(1, 'rgba(255,70,60,0)');
          g.fillStyle = halo; ell(g, ex, ey, er * 2.6, er * 2.6); g.fill();
          const core = g.createRadialGradient(ex, ey, 0, ex, ey, er * 1.05);
          core.addColorStop(0, `rgba(255,236,200,${0.95 * a})`); core.addColorStop(0.45, `rgba(255,60,50,${0.9 * a})`); core.addColorStop(1, `rgba(200,20,30,${0.55 * a})`);
          g.fillStyle = core; ell(g, ex, ey, er, er); g.fill();
        });
      }
      if (pts && o.siren) {
        const on = Math.floor(t * 8) % 2 === 0;
        const [ax, ay] = pts.antenna, axp = px + ax * w, ayp = py + ay * h, ar = w * 0.11;
        const sg = g.createRadialGradient(axp, ayp, 0, axp, ayp, ar);
        sg.addColorStop(0, on ? 'rgba(255,90,80,.95)' : 'rgba(90,160,255,.95)'); sg.addColorStop(1, on ? 'rgba(255,60,50,0)' : 'rgba(60,120,255,0)');
        g.fillStyle = sg; ell(g, axp, ayp, ar, ar); g.fill();
      }
      if (o.glitch !== false && (t % 2.4) < 0.14) {
        g.globalAlpha = 0.5;
        g.fillStyle = '#ff6ad5'; g.fillRect(-w * 0.42 + s * 0.05, -s * 0.66, w * 0.84, s * 0.035);
        g.fillStyle = ROBO; g.fillRect(-w * 0.42 - s * 0.04, -s * 0.5, w * 0.84, s * 0.03);
        g.globalAlpha = 1;
      }
      g.restore();
      return;                       // (the dizzy picture has its own stars around the antenna)
    }
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
    g.fillStyle = 'rgba(29,36,64,.24)'; ell(g, k.x, k.y + 1, S * 0.3, S * 0.1); g.fill();
    // the chase pass: Robotín is right behind this kid (a red ring that pulses; the projector shows who is in danger)
    if (k.danger) {
      const pz = still() ? 0.7 : 0.55 + 0.45 * Math.abs(Math.sin(t * 7 + (k.idx || 0)));
      g.strokeStyle = `rgba(240,68,58,${pz})`; g.lineWidth = Math.max(2.5, S * 0.09);
      ell(g, k.x, k.y + 1, S * 0.42, S * 0.17); g.stroke();
    }
    if (k.me || k.safe || k.glow) {
      g.strokeStyle = k.safe ? SAFE : GOLD; g.lineWidth = Math.max(2, S * 0.08);
      ell(g, k.x, k.y + 1, S * 0.38, S * 0.15); g.stroke();
    }
    if (k.me) { g.strokeStyle = `rgba(255,255,255,${0.55 + 0.4 * Math.sin(t * 5)})`; g.lineWidth = Math.max(1.5, S * 0.045); ell(g, k.x, k.y + 1, S * 0.5, S * 0.2); g.stroke(); }
    let src = img(BODY_URL(k.skin, k.dizzy ? 'no' : (k.cheer ? 'ok' : 'idle')));
    let full = true;
    if (!ready(src)) { src = img(BODY_URL(k.skin, 'idle')); }
    if (!ready(src)) { src = img(SKIN_URL(k.skin || 'dralingo')); full = false; }      // (the bust while the body loads)
    g.save();
    g.translate(k.x, k.y + bob);
    if (k.dizzy) g.rotate(Math.sin(t * 9 + (k.idx || 0)) * 0.18);
    else if (k.moving) g.rotate(Math.sin(t * 11 + (k.idx || 0)) * 0.06);
    if (k.f === 3 || k.f === 4 || k.f === 5) g.scale(-1, 1);
    if (o.alpha) g.globalAlpha = o.alpha;
    if (ready(src) && full) { const h = S * 1.12, w = h * src.naturalWidth / src.naturalHeight; g.drawImage(src, -w / 2, -h + S * 0.04, w, h); }
    else if (ready(src)) g.drawImage(src, -S / 2, -S + S * 0.06, S, S);
    else { g.fillStyle = GOLD; ell(g, 0, -S / 2, S / 3, S / 3); g.fill(); }
    g.restore();
    if (k.dizzy) stars(g, k.x, k.y - S * 1.12, S * 0.34, t + (k.idx || 0));
    if (k.shield) shield(g, k.x, k.y - S * 0.55, S * 0.66, t, k.shield);
  }
  // the chase pass: the shield after a zap (Robotín waits): a cyan bubble with a shine; a (0..1) fades it out
  function shield(g, x, y, r, t, a) {
    a = Math.max(0, Math.min(1, a === true ? 1 : a));
    const wob = still() ? 0 : Math.sin(t * 6) * r * 0.025;
    g.save();
    g.globalAlpha = a;
    const bg = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r + wob);
    bg.addColorStop(0, 'rgba(220,252,255,.18)'); bg.addColorStop(0.75, 'rgba(127,246,255,.22)'); bg.addColorStop(1, 'rgba(63,214,224,.55)');
    g.fillStyle = bg; ell(g, x, y, r + wob, r - wob); g.fill();
    g.strokeStyle = 'rgba(27,143,163,.9)'; g.lineWidth = Math.max(2, r * 0.06); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = Math.max(1.5, r * 0.07); g.lineCap = 'round';
    g.beginPath(); g.arc(x, y, r * 0.78, Math.PI * 1.12, Math.PI * 1.42); g.stroke();
    g.restore();
  }
  // one name tag, a fixed size on screen (s = world → css px scale). Returns its box (world units), or draws nothing
  // when `avoid` (boxes already taken) leaves no room above the head or below the feet (mine always shows).
  function tag(g, k, size, s, px, meLabel, avoid) {
    if (!k.name) return null;
    const fs = px / s;
    g.font = `800 ${fs}px Nunito, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const label = k.me && meLabel ? meLabel : String(k.name).slice(0, 12);
    const w = g.measureText(label).width + 12 / s, h = fs * 1.24;
    const spots = k.below ? [k.y + 4 / s + h / 2, k.y - size * 1.14 - 3 / s - fs * 0.5] : [k.y - size * 1.14 - 3 / s - fs * 0.5, k.y + 4 / s + h / 2];
    let y = null;
    for (const cy of spots) {
      const box = [k.x - w / 2, cy - h / 2, k.x + w / 2, cy + h / 2];
      if (!avoid || !avoid.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) { y = cy; break; }
    }
    if (y === null) { if (!k.me) return null; y = spots[0]; }
    g.fillStyle = k.me ? GOLD : (k.safe ? '#d6f7e3' : 'rgba(255,247,227,.96)');
    rr(g, k.x - w / 2, y - fs * 0.62, w, h, fs * 0.5); g.fill();
    g.strokeStyle = k.safe ? SAFE_DEEP : INK; g.lineWidth = 1.5 / s; g.stroke();
    g.fillStyle = INK; g.fillText(label, k.x, y + fs * 0.04);
    const box = [k.x - w / 2 - 2 / s, y - h / 2 - 2 / s, k.x + w / 2 + 2 / s, y + h / 2 + 2 / s];
    if (avoid) avoid.push(box);
    return box;
  }

  // ---------- Robotín's world: the run ----------
  // a picture repeated sideways, every other copy mirrored (the seams always match); off = how far the world scrolled
  function strip(g, im, off, y, w, h, W) {
    if (!(w > 1)) return;
    let k = Math.floor(off / w);
    for (let x = k * w - off; x < W; k++, x += w) {
      if (((k % 2) + 2) % 2) { g.save(); g.translate(x + w, y); g.scale(-1, 1); g.drawImage(im, -0.5, 0, w + 1, h); g.restore(); }
      else g.drawImage(im, x - 0.5, y, w + 1, h);
    }
  }
  // The zone's scene in a W×H box (css px). o: { zone, crew (m scrolled), groundFrac (the strip's share of H),
  // feetFrac (where feet stand, from the strip's bottom), pxm (ground px per metre), bgPxm (far layer px per metre),
  // bgMinW (the far picture at least this share of W wide: a short phone strip crops it), bgFocus (0..1: which part of
  // a cropped far picture shows; 0.5 = its middle) }. Returns { feetY, groundTop }.
  function scene(g, o) {
    const z = o.zone, W = o.W, H = o.H, EM = M();
    const sh = H * (o.groundFrac || 0.42);
    const bg = img(EM.art(z.id, 'bg')), gr = img(EM.art(z.id, 'ground'));
    const sk = g.createLinearGradient(0, 0, 0, H);
    sk.addColorStop(0, z.sky[0]); sk.addColorStop(1, z.sky[1]);
    g.fillStyle = sk; g.fillRect(0, 0, W, H);
    if (ready(bg)) {
      // the far picture fills the stage's height (copies side by side, mirrored); its bottom hides behind the strip
      const asp = bg.naturalWidth / bg.naturalHeight;
      let bh = H, bw = bh * asp;
      if (o.bgMinW && bw < W * o.bgMinW) { bw = W * o.bgMinW; bh = bw / asp; }
      const by = (H - bh) * (o.bgFocus == null ? 0.5 : o.bgFocus);
      strip(g, bg, (o.crew || 0) * (o.bgPxm == null ? 0.5 : o.bgPxm), by, bw, bh, W);
    }
    if (ready(gr)) {
      const tw = sh * gr.naturalWidth / gr.naturalHeight;
      strip(g, gr, (o.crew || 0) * (o.pxm || 20), H - sh, tw, sh, W);
    } else {
      const gg = g.createLinearGradient(0, H - sh * 0.5, 0, H);
      gg.addColorStop(0, z.ground[0]); gg.addColorStop(1, z.ground[1]);
      g.fillStyle = gg; g.fillRect(0, H - sh * 0.5, W, sh * 0.5);
    }
    return { feetY: H - sh * (o.feetFrac == null ? 0.1 : o.feetFrac), groundTop: H - sh };
  }
  // the end of a zone: the gate of the next place (or Hamdan's jet, its stairs at x), standing on feetY, h px tall
  function goal(g, zone, x, feetY, h, t) {
    const EM = M();
    if (zone.exit === 'jet') return jet(g, x, feetY, h, {});
    const im = img(EM.gateArt(zone.exit));
    g.fillStyle = 'rgba(29,36,64,.2)'; ell(g, x, feetY, h * 0.32, h * 0.05); g.fill();
    if (ready(im)) { const w = h * im.naturalWidth / im.naturalHeight; g.drawImage(im, x - w / 2, feetY - h + h * 0.03, w, h); return; }
    // (until its picture arrives) an arch in the place's colours
    const gw = h * 0.7;
    g.strokeStyle = INK; g.lineWidth = Math.max(3, h * 0.012);
    g.fillStyle = zone.sky[1];
    rr(g, x - gw / 2, feetY - h, gw * 0.16, h, 8); g.fill(); g.stroke();
    rr(g, x + gw / 2 - gw * 0.16, feetY - h, gw * 0.16, h, 8); g.fill(); g.stroke();
    rr(g, x - gw / 2 - 10, feetY - h - 20, gw + 20, 34, 14); g.fill(); g.stroke();
  }
  // Hamdan's jet: its door (and the stairs) at x, wheels on feetY, h = the jet's height. o: { lift (off the ground),
  // tilt (radians: + lifts the nose, which points left: the jet faces the crew running towards it) }
  function jet(g, x, feetY, h, o) {
    o = o || {};
    const im = img(M().JET), fb = img('/assets/saga/avatars/plane.webp');
    const pic = ready(im) ? im : (ready(fb) ? fb : null);
    if (!pic) return;
    const w = h * pic.naturalWidth / pic.naturalHeight;
    // the door and its stairs sit at ~20 % of the picture from the left (the saga plane fallback: its middle)
    const dx = x - w * (pic === im ? 0.2 : 0.5);
    g.save();
    if (!o.lift) { g.fillStyle = 'rgba(29,36,64,.22)'; ell(g, dx + w * 0.5, feetY, w * 0.42, h * 0.05); g.fill(); }
    g.translate(dx + w * 0.5, feetY - h * 0.5);
    if (o.tilt) g.rotate(o.tilt);
    g.drawImage(pic, -w / 2, -h / 2, w, h);
    if (pic === im && o.faces && o.faces.length) {
      const WX = [0.246, 0.294, 0.341, 0.388, 0.435, 0.482], WY = 0.52, r = w * 0.016;
      o.faces.slice(0, 6).forEach((skin, i) => {
        const f = img(SKIN_URL(skin));
        if (!ready(f)) return;
        const fx = -w / 2 + WX[i] * w, fy = -h / 2 + WY * h;
        g.save(); g.beginPath(); g.arc(fx, fy, r, 0, Math.PI * 2); g.clip();
        g.fillStyle = '#dff3ff'; g.fillRect(fx - r, fy - r, r * 2, r * 2);
        g.drawImage(f, fx - r * 1.25, fy - r * 1.05, r * 2.5, r * 2.5);
        g.restore();
        g.strokeStyle = 'rgba(29,36,64,.6)'; g.lineWidth = Math.max(1, r * 0.18); g.beginPath(); g.arc(fx, fy, r, 0, Math.PI * 2); g.stroke();
      });
    }
    g.restore();
    return { x: dx, w };
  }

  // ---------- the zona segura ----------
  // the room while its picture loads: the floor and the walls in the zone's colours
  function roomFallback(g, r) {
    const T = r.tile, z = M().ZONES[r.zone] || {}, L = r.layout || { top: 1, bottom: 1, left: 1, right: 1 };
    g.fillStyle = z.floor || '#efeafb'; g.fillRect(0, 0, r.cols * T, r.rows * T);
    g.fillStyle = 'rgba(29,36,64,.55)';
    g.fillRect(0, 0, r.cols * T, L.top * T); g.fillRect(0, (r.rows - L.bottom) * T, r.cols * T, L.bottom * T);
    g.fillRect(0, 0, L.left * T, r.rows * T); g.fillRect((r.cols - L.right) * T, 0, L.right * T, r.rows * T);
    (L.blocks || []).forEach(([x, y, w, h]) => { g.fillStyle = 'rgba(29,36,64,.3)'; rr(g, x * T + 3, y * T + 3, w * T - 6, h * T - 6, 10); g.fill(); });
  }
  // a seeded prop as its picture, bottom-centre on its footprint; the dock is Robotín's glowing pad
  function prop(g, p, T, t) {
    const X = p.x * T, Y = p.y * T, W = p.w * T, H = p.h * T;
    if (p.kind === 'dock') {
      const glow = 0.55 + 0.25 * Math.sin(t * 3);
      g.fillStyle = `rgba(63,214,224,${glow * 0.45})`; ell(g, X + W / 2, Y + H - 6, W * 0.62, H * 0.36); g.fill();
      g.strokeStyle = ROBO_DEEP; g.lineWidth = 3; ell(g, X + W / 2, Y + H - 6, W * 0.5, H * 0.26); g.stroke();
      return;
    }
    g.fillStyle = 'rgba(29,36,64,.22)'; ell(g, X + W / 2, Y + H - 4, W * 0.46, 7); g.fill();
    const pa = (M().PROP_ART || {})[p.kind];
    const pi = pa && img(pa.f);
    if (pi && ready(pi)) {
      const w = (pa.dw || p.w) * T, h = w * pi.naturalHeight / pi.naturalWidth;
      g.drawImage(pi, X + W / 2 - w / 2, Y + H + 2 - h, w, h);
      return;
    }
    g.fillStyle = '#f4f6fb'; rr(g, X + 5, Y + 6, W - 10, H - 10, 8); g.fill(); outline(g, 2);
  }
  // a green safe zone. o: { count, cap, mine, mySafe, t }
  function zone(g, z, T, o) {
    const X = z.x * T, Y = z.y * T, W = z.w * T, H = z.h * T;
    const t = still() ? 0 : (o.t || 0);
    // full = grey (nobody else fits), except for me when I'm one of the protected kids inside: it stays green
    const full = z.cap && o.count >= z.cap && !o.mySafe;
    const pulse = 0.5 + 0.5 * Math.sin(t * 5 + z.id);
    // a soft halo (no canvas blur: cheap phones), the glowing mat, the marching dashes
    g.fillStyle = full ? 'rgba(160,168,190,.22)' : `rgba(120,255,170,${0.18 + pulse * 0.14})`;
    rr(g, X - 5, Y - 5, W + 10, H + 10, 22); g.fill();
    const fill = g.createRadialGradient(X + W / 2, Y + H / 2, 4, X + W / 2, Y + H / 2, W * 0.7);
    if (full) { fill.addColorStop(0, 'rgba(210,214,226,.78)'); fill.addColorStop(1, 'rgba(150,158,180,.72)'); }
    else { fill.addColorStop(0, `rgba(170,255,200,${0.78 + pulse * 0.12})`); fill.addColorStop(1, 'rgba(47,191,113,.7)'); }
    g.fillStyle = fill; rr(g, X + 3, Y + 3, W - 6, H - 6, 16); g.fill();
    g.setLineDash([12, 8]); g.lineDashOffset = -t * 30;
    g.strokeStyle = full ? '#6b7390' : '#0f6b3a'; g.lineWidth = 4.5; rr(g, X + 3, Y + 3, W - 6, H - 6, 16); g.stroke();
    g.setLineDash([]);
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2; rr(g, X + 8, Y + 8, W - 16, H - 16, 12); g.stroke();
    if (o.mine && o.mySafe) { g.strokeStyle = SAFE_DEEP; g.lineWidth = 6; rr(g, X - 2, Y - 2, W + 4, H + 4, 20); g.stroke(); }
    // the shield in the middle (a picture, no letters)
    const cx = X + W / 2, cy = Y + H / 2;
    g.globalAlpha = 0.8;
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(cx, cy - 17); g.lineTo(cx + 15, cy - 11); g.lineTo(cx + 13, cy + 6); g.quadraticCurveTo(cx, cy + 19, cx, cy + 19); g.quadraticCurveTo(cx, cy + 19, cx - 13, cy + 6); g.lineTo(cx - 15, cy - 11); g.closePath(); g.fill();
    g.strokeStyle = full ? '#6b7390' : SAFE_DEEP; g.lineWidth = 2.5; g.stroke();
    g.globalAlpha = 1;
  }
  // the zone's limit as a badge on its bottom edge («3/6», full = grey). px = its size on screen, s = world → css scale
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
    const mx = cx - w / 2 + fs * 0.85, my = cy;
    g.fillStyle = INK; ell(g, mx, my - fs * 0.22, fs * 0.2, fs * 0.2); g.fill(); g.beginPath(); g.arc(mx, my + fs * 0.42, fs * 0.36, Math.PI, 0); g.fill();
    g.fillStyle = INK; g.fillText(label, cx + fs * 0.5, cy + fs * 0.05);
    return [cx - w / 2, cy - fs * 0.75, cx + w / 2, cy + fs * 0.75];
  }
  // the whole room. st: { room, zones, occ: {zid: {n, safe:[idx]}}, kids:[{x,y,skin,name,me,safe,dizzy,moving,f,idx}], t,
  //   flash (0..1 the zap landing), zapTargets, robot: { mood }, myZone, mySafe }, view: { s }, o: { size, tag, tags,
  //   meLabel, badge, dimOthers }
  function room(g, st, view, o) {
    const r = st.room, T = r.tile, t = st.t || 0, RW = r.cols * T, RH = r.rows * T;
    const pic = roomArt(r.zone);
    if (ready(pic)) g.drawImage(pic, 0, 0, RW, RH); else roomFallback(g, r);
    // the zap landing lights the floor cyan everywhere but the zones (a floor effect: the kids stay readable on top)
    if (st.flash > 0) {
      g.save();
      g.globalAlpha = Math.min(1, st.flash) * 0.45;
      g.fillStyle = '#9ff8ff'; g.fillRect(0, 0, RW, RH);
      g.restore();
    }
    (st.zones || []).forEach((z) => {
      const oc = (st.occ || {})[z.id] || { n: 0, safe: [] };
      zone(g, z, T, { count: oc.n, t, mine: st.myZone === z.id, mySafe: st.myZone === z.id && st.mySafe });
    });
    // props + Robotín + kids, back to front
    const size = o.size || 48;
    const list = [];
    r.props.forEach((p) => list.push({ y: (p.y + p.h) * T, p }));
    (st.kids || []).forEach((k) => { if (!k.me) list.push({ y: k.y, k }); });
    const dx = (r.dock.x + r.dock.w / 2) * T, dy = (r.dock.y + r.dock.h) * T - 4;
    list.push({ y: dy + 0.5, robot: true });
    list.sort((a, b) => a.y - b.y);
    list.forEach((e) => {
      if (e.p) prop(g, e.p, T, t);
      else if (e.robot) robotin(g, dx, dy, T * 2.4, { t, mood: (st.robot && st.robot.mood) || 'idle' });
      else kid(g, e.k, size, t, { alpha: o.dimOthers ? 0.92 : 1 });
    });
    // my own avatar always on top (on a phone a classmate standing on my tile must never hide me)
    const mine = (st.kids || []).find((k) => k.me);
    if (mine) kid(g, mine, size * (o.meScale || 1), t, {});
    // … and the tickle lightning from Robotín to the kids caught outside
    if (st.flash > 0) (st.zapTargets || []).slice(0, 12).forEach((k, i) => zap(g, dx + 10, dy - T * 1.5, k.x, k.y - 20, 3, Math.floor(t * 20) + i * 7));
    const taken = [];
    (st.zones || []).forEach((z) => { const oc = (st.occ || {})[z.id] || { n: 0 }; const b = zoneBadge(g, z, T, oc.n, view.s, o.badge || 13, st.myZone === z.id && st.mySafe); if (b) taken.push(b); });
    // name tags: mine first, then front to back; a tag that would cover another moves under the feet or hides
    const tagged = (st.kids || []).filter((k) => k.me || o.tags).sort((a, b) => (b.me ? 1 : 0) - (a.me ? 1 : 0) || b.y - a.y);
    tagged.forEach((k) => tag(g, k, k.me ? size * (o.meScale || 1) : size, view.s, o.tag || 11, o.meLabel, taken));
  }

  window.EscapeRender = {
    INK, SAFE, SAFE_DEEP, ROBO, ROBO_DEEP, GOLD, DANGER, SKIN_URL, BODY_URL, img, ready, preload, onLoad, roomArt, rr, ell,
    robotin, onRobot, zap, star, stars, kid, tag, strip, scene, goal, jet, room, zone, shield,
  };
})();
