// =========================================================================
// zoco3d/stage.js — El Zoco's character in real 3D (2026-10-20, his words: "it looked like a display in 3D… each
// character… you can touch it and move it. I always loved that. Like if you were interacting in the 3D world")
// =========================================================================
// On a character's page (#zoco-<id>, js/mi-dralingo.js) of a character listed in saga.js ZOCO_3D, the picture shows
// first; this module then puts the character on the same lit pedestal in 3D:
//   · drag  → it turns (full turn, with inertia) and tilts a little; a vertical swipe still scrolls the page
//             (touch-action: pan-y), so the page never gets stuck under a finger
//   · pinch / mouse wheel → zoom (clamped; at a limit the wheel scrolls the page again); the CSS pedestal zooms with it
//   · tap the character → a happy hop (squash and stretch + a spin), code motion, no skeleton needed
//   · untouched → it breathes and looks around slowly, «waiting for you»
//   · first visits teach by doing: one automatic turn + a hand «Gíralo con el dedo»; after the first turn, «¡Tócalo!»
// The 3D model is HIS original (ONLY MAIN CHARACTERS), made web-sized by tools/blender/zoco_web_glb.py: one GLB
// (Draco), feet on 0, 1 unit tall, facing +Z. The page fetches it first (a missing model fails before three.js is even
// asked for), then three.js (+ the Draco decoder) comes from the CDN of the import map in homework.html. The page keeps
// the picture when anything fails (mi-dralingo.js decides who may try: reduced motion, Save-Data, no hardware WebGL 2,
// < 2 GB and a model that failed before never get here); a load the kid walked away from stops at the next step.
// Cheap phones: at most ~1.5 Mpx drawn (pixel ratio ≤ 2), ~30 frames a second when nobody touches it, ~12 after 25 s,
// none after 90 s (a touch, a key, the pointer over it or coming back wakes it), nothing drawn while the tab is hidden or
// the stage is off screen, the Draco workers closed once the model is read, everything given back when the kid leaves.
// The CSS pedestal stays (css/mi-dralingo.css «the pedestal»): the canvas is transparent and the camera looks down at
// the pedestal's angle (its top is an ellipse 0.2 as tall as wide: ~11.5°), the feet on its centre.
// Test hook: window.__zoco3d (state, the time to the first frame, pose / freeze for screenshots).
// =========================================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const DRACO_PATH = 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/';
const ELEV = Math.asin(0.2);                 // the pedestal top's ellipse (css: height .2 of its width)
const FOV = 30;
const ZMIN = 0.85, ZMAX = 2.2;               // zoom limits (1 = the whole character on its pedestal)
const TILT_MIN = -0.12, TILT_MAX = 0.24;     // radians: a little forward / back
const IDLE_AFTER = 2600;                     // ms untouched before it looks around again
const SLOW_AFTER = 25000, SLEEP_AFTER = 90000;   // ms untouched: ~12 frames a second, then none (it wakes on a touch)
const MAX_PX = 1.5e6;                        // pixels drawn per frame at most (a big laptop at DPR 2 stays light)
const HOP_S = 0.82;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
};
const K_SPUN = 'draly_zoco3d_spun';          // this phone already turned a character (the hand hint stops)
const K_TAP = 'draly_zoco3d_tap';            // … and already made one hop (the «¡Tócalo!» hint stops)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeOutBack = (k) => { const c = 1.6; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };

// the model's glossy toy look (close to the Higgsfield pictures): a clear coat, roughness kept in the look's range
function dress(root, look) {
  const lo = look.rough[0], hi = look.rough[1];
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    const one = (m) => {
      const p = new THREE.MeshPhysicalMaterial();
      ['color', 'emissive'].forEach((k) => { if (m[k]) p[k].copy(m[k]); });
      ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap'].forEach((k) => { if (m[k]) p[k] = m[k]; });
      if (m.normalScale) p.normalScale.copy(m.normalScale);
      p.vertexColors = !!m.vertexColors;
      p.emissiveIntensity = m.emissiveIntensity;
      p.roughness = m.roughnessMap ? m.roughness : clamp(m.roughness, lo, hi);
      p.metalness = m.metalness > 0.9 ? 0.85 : m.metalness;
      p.transparent = m.transparent; p.opacity = m.opacity; p.alphaTest = m.alphaTest; p.side = m.side;
      p.depthWrite = m.depthWrite;
      // (a picture's see-through parts are cut-outs on a toy, a strap, an eyelash: cut, never blended, so no piece
      // ever shows through another while it turns)
      if (m.transparent && (m.map || m.alphaMap) && m.opacity >= 0.99) { p.transparent = false; p.alphaTest = Math.max(m.alphaTest, 0.5); p.depthWrite = true; }
      p.clearcoat = look.coat; p.clearcoatRoughness = 0.18;
      if (look.sheen) { p.sheen = look.sheen; p.sheenRoughness = 0.6; p.sheenColor.set('#ffffff'); }
      p.name = m.name;
      m.dispose();
      return p;
    };
    o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material);
  });
}

// a soft round shadow on the pedestal (a picture, no shadow maps: cheap on any phone)
function shadowDisc() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(60,28,4,0.62)'); r.addColorStop(0.45, 'rgba(60,28,4,0.34)'); r.addColorStop(1, 'rgba(60,28,4,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.002;
  mesh.renderOrder = -1;
  return mesh;
}

// the model's measures in its own units: height, how far it reaches from its axis, how wide its footprint is
function measure(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  let rmax = 0, rfoot = 0;
  const v = new THREE.Vector3();
  const H = Math.max(1e-6, box.max.y - box.min.y);
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    const p = o.geometry.attributes.position;
    const step = Math.max(1, Math.floor(p.count / 6000));
    for (let i = 0; i < p.count; i += step) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
      const r = Math.hypot(v.x, v.z);
      if (r > rmax) rmax = r;
      if (v.y - box.min.y < 0.06 * H && r > rfoot) rfoot = r;
    }
  });
  return { box, H, rmax: Math.max(rmax, 0.05), rfoot: Math.max(rfoot, 0.08) };
}

// everything a scene holds, given back to the graphics card
function freeScene(scene) {
  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.dispose();
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
      if (!m) return;
      ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap'].forEach((k) => { if (m[k]) m[k].dispose(); });
      m.dispose();
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────
// mount(stage, opts) → a controller { attach(stage), dispose(), state() }, or throws (the page keeps its picture);
// throws Error('cancelled') when opts.alive() says the page no longer wants it.
//   opts: { id, buf (the GLB, fetched by the page) | url, alive(), where(), software (tests: allow software WebGL),
//           look: { coat, rough: [lo, hi], sheen?, exposure?, yaw? }, words: { spin, drag, tap, label },
//           onReady(), onFail(reason) }
// ─────────────────────────────────────────────────────────────────────────
export async function mount(stage, opts) {
  const t0 = performance.now();
  const look = Object.assign({ coat: 0.2, rough: [0.3, 0.6], exposure: 1, yaw: 0 }, opts.look || {});
  const wanted = () => !opts.alive || opts.alive();
  const cancel = () => { throw new Error('cancelled'); };
  let buf = opts.buf || null;
  if (!buf) {
    const res = await fetch(opts.url, { credentials: 'same-origin' });
    if (!res.ok) throw new Error('model ' + res.status);
    buf = await res.arrayBuffer();
  }
  if (!wanted()) cancel();
  const tFetched = performance.now();

  // what to give back, newest first: listeners, observers, timers, the scene, the renderer and its context. A failure
  // half way through gives back whatever was made so far (never a context or a listener left behind).
  const undo = [];
  const giveBack = () => { while (undo.length) { const f = undo.pop(); try { f(); } catch (_) {} } };
  let alive = true;
  try {
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: (window.devicePixelRatio || 1) < 2, alpha: true, powerPreference: 'low-power',
        failIfMajorPerformanceCaveat: !opts.software });
    } catch (e) { throw new Error('webgl'); }
    undo.push(() => { renderer.dispose(); if (!renderer.getContext().isContextLost()) renderer.forceContextLoss(); });
    const gl = renderer.getContext();
    const canvas = renderer.domElement;
    undo.push(() => canvas.remove());
    // (a phone that takes the graphics back, even while the model is read: the picture again. Our own dispose()
    // releases the context too: its listener is gone by then, never a failure)
    let lost = false, ctlMade = false;
    const onLost =(e) => { e.preventDefault(); lost = true; if (alive && ctlMade) fail('context'); };
    canvas.addEventListener('webglcontextlost', onLost);
    undo.push(() => canvas.removeEventListener('webglcontextlost', onLost));
    // (a shader a weak GPU cannot build draws nothing: the picture stays instead of an empty pedestal)
    let shaderBad = false;
    renderer.debug.onShaderError = () => { shaderBad = true; };
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = look.exposure;
    canvas.className = 'zc-3d';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', opts.words.label);
    canvas.tabIndex = 0;

    // the model (a Draco reader of its own, closed as soon as the model is read: its workers hold MBs each)
    const draco = new DRACOLoader();
    draco.setDecoderPath(DRACO_PATH);
    draco.setWorkerLimit(2);
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    let gltf;
    try {
      gltf = await new Promise((ok, bad) => loader.parse(buf, '', ok, bad));
    } catch (e) { throw new Error('parse'); } finally { try { draco.dispose(); } catch (_) {} }
    buf = null;
    const tParsed = performance.now();
    if (!wanted()) cancel();
    if (lost || gl.isContextLost()) throw new Error('context');

    // ── the scene ──
    const scene = new THREE.Scene();
    undo.push(() => freeScene(scene));
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    undo.push(() => env.dispose());
    freeScene(room);
    pmrem.dispose();
    scene.environment = env;
    scene.environmentIntensity = 0.85;
    scene.add(new THREE.HemisphereLight('#fff6e6', '#8a6a4a', 0.55));
    const key = new THREE.DirectionalLight('#fff1dc', 1.75); key.position.set(1.6, 3.2, 2.6); scene.add(key);
    const fill = new THREE.DirectionalLight('#cfe0ff', 0.35); fill.position.set(-3, 1.2, 2); scene.add(fill);
    const rim = new THREE.DirectionalLight('#ffe6b0', 1.25); rim.position.set(-2, 2.6, -3); scene.add(rim);

    const model = gltf.scene;
    dress(model, look);
    const M = measure(model);
    model.position.y = -M.box.min.y;           // feet on the pedestal
    // turntable: yaw → tilt (around the feet) → hop (lift + squash) → breath (scale) → the model
    const breath = new THREE.Group(); breath.add(model);
    const hop = new THREE.Group(); hop.add(breath);
    const turn = new THREE.Group(); turn.add(hop);
    const tilt = new THREE.Group(); tilt.add(turn);
    scene.add(tilt);
    const shadow = shadowDisc();
    const sd = Math.min(M.rfoot * 2.3, M.H * 0.9);
    shadow.scale.set(sd, sd * 0.92, 1);
    scene.add(shadow);

    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 100);

    // ── the stage around it (re-read after every redraw of the page) ──
    let host = null, pod = null, fig = null;
    let W = 1, Hs = 1, A0 = { x: 0, y: 0 }, ppu0 = 100, Fs = { x: 0, y: 0 };
    let zoom = 1;
    undo.push(() => { if (pod) pod.style.transform = ''; if (host) host.classList.remove('has-3d', 'is-3d'); });
    function layout() {
      if (!host) return;
      const r = host.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width)); Hs = Math.max(1, Math.round(r.height));
      renderer.setPixelRatio(Math.max(0.5, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(MAX_PX / (W * Hs)))));
      renderer.setSize(W, Hs, false);
      if (pod) pod.style.transform = '';
      const pr = pod ? pod.getBoundingClientRect() : null;
      A0 = pr ? { x: pr.left - r.left, y: pr.top - r.top } : { x: W / 2, y: Hs - 60 };
      const hpx = fig ? fig.offsetHeight : Hs * 0.6;
      const side = Math.min(A0.x, W - A0.x, Math.max(W * 0.42, 190)) - 8;
      // as tall as its picture, never wider than the stage when it turns (its farthest point from the axis)
      // (and its head under the stage's top row: «Volver al Zoco» and the purse stay clear)
      ppu0 = Math.max(10, Math.min(hpx * 0.96 / M.H, side / M.rmax, (A0.y - 72) / (M.H * 1.02)));
      // zooming goes towards the face and chest
      Fs = { x: A0.x, y: A0.y - 0.7 * M.H * ppu0 };
      const D = (Hs / 2) / (ppu0 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
      camera.aspect = W / Hs;
      camera.near = Math.max(0.01, D * 0.05); camera.far = D * 6;
      camera.position.set(0, Math.sin(ELEV) * D, Math.cos(ELEV) * D);
      camera.lookAt(0, 0, 0);
      applyZoom();
    }
    function applyZoom() {
      const o = { x: Fs.x * (1 - 1 / zoom), y: Fs.y * (1 - 1 / zoom) };
      const s = { x: W / 2 - A0.x, y: Hs / 2 - A0.y };
      camera.setViewOffset(W, Hs, s.x + o.x, s.y + o.y, W / zoom, Hs / zoom);
      camera.updateProjectionMatrix();
      // the CSS pedestal zooms with the character (around the same point)
      if (pod) pod.style.transform = zoom === 1 ? '' : 'translate(' + ((A0.x - Fs.x) * (zoom - 1)).toFixed(2) + 'px,' + ((A0.y - Fs.y) * (zoom - 1)).toFixed(2) + 'px) scale(' + zoom.toFixed(4) + ')';
      dirty = true;
    }

    // ── the hints (teach by doing) ──
    const coarse = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
    const hint = document.createElement('div');
    hint.className = 'zc-3d-hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.innerHTML = '<span class="zc-3d-hand"><svg viewBox="0 0 48 48" width="40" height="40" focusable="false">' +
      '<path d="M19 22V9.5a3.5 3.5 0 0 1 7 0V20l.6-.1a3.4 3.4 0 0 1 4 2.6l.1.5.6-.1a3.4 3.4 0 0 1 3.9 2.5l.2.8a3.4 3.4 0 0 1 4.4 2.6l.3 1.7c.8 4.6-.2 9.3-2.9 13.1L36 45H20l-7.8-9.6a4 4 0 0 1 .2-5.4 4 4 0 0 1 5.3-.3l1.3 1V22z" fill="#fffaf0" stroke="#5a3a10" stroke-width="2.2" stroke-linejoin="round"/></svg></span>' +
      '<span class="zc-3d-say"></span>';
    undo.push(() => hint.remove());
    const say = hint.querySelector('.zc-3d-say');
    function showHint(kind) {
      say.textContent = kind === 'tap' ? opts.words.tap : (coarse ? opts.words.spin : opts.words.drag);
      hint.className = 'zc-3d-hint is-' + kind + ' is-on';
    }
    function hideHint() { hint.classList.remove('is-on'); }

    // ── state ──
    let yaw = look.yaw, tiltA = 0, vel = 0;
    let dragging = false, learnedSpin = !!store.get(K_SPUN), learnedTap = !!store.get(K_TAP);
    let demo = null;                           // { t0, from } the first visit's automatic turn
    let hopT = -1;
    let enterT = -1;
    let raf = 0, visible = !document.hidden, onScreen = true, dirty = true, frames = 0, lastDraw = 0;
    let firstFrameAt = 0;
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (alive) fn(); }, ms); timers.add(t); return t; };
    undo.push(() => { timers.forEach(clearTimeout); timers.clear(); if (raf) cancelAnimationFrame(raf); raf = 0; });
    let tapHintTimer = 0;
    let clock = null;                          // a frozen clock (test hook), else performance.now()
    const pts = new Map();                     // the fingers (or the mouse) on the canvas
    let pinch = null, down = null, lastMove = null;
    const now = () => (clock != null ? clock : performance.now());
    const tStart = now();
    let lastTouch = tStart;
    const touched = () => { lastTouch = now(); };

    // ── the hop: crouch, jump with a spin, land, settle ──
    function startHop() {
      if (hopT >= 0) return;
      hopT = now();
      vel = 0; demo = null;
      if (!learnedTap) { learnedTap = true; store.set(K_TAP, '1'); hideHint(); }
    }
    function hopPose(k) {
      // k 0…1 · returns { y (in model heights), sy (squash), turn (radians) }
      if (k < 0.16) { const q = k / 0.16; return { y: 0, sy: 1 - 0.13 * Math.sin(q * Math.PI / 2), turn: 0 }; }
      if (k < 0.66) {
        const q = (k - 0.16) / 0.5;
        const y = 4 * q * (1 - q) * 0.2;
        const sy = 1 + 0.1 * Math.max(0, 1 - q * 2.2) - 0.13 * Math.max(0, 1 - q * 6);
        return { y, sy, turn: easeInOut(q) * Math.PI * 2 };
      }
      if (k < 0.8) { const q = (k - 0.66) / 0.14; return { y: 0, sy: 1 - 0.11 * Math.sin(q * Math.PI), turn: Math.PI * 2 }; }
      const q = (k - 0.8) / 0.2;
      return { y: 0, sy: 1 + 0.03 * Math.sin(q * Math.PI) * (1 - q), turn: Math.PI * 2 };
    }
    const busyNow = () => dragging || hopT >= 0 || !!demo || enterT >= 0 || Math.abs(vel) > 0.02 || !!pinch;

    // ── a frame ──
    let prev = now();
    function frame() {
      raf = 0;
      if (!alive) return;
      const t = now();
      const dt = Math.min(0.05, Math.max(0, (t - prev) / 1000));
      // (nobody touching it: ~30 frames a second is plenty for a breath, ~12 after a while)
      const gap = t - lastTouch > SLOW_AFTER ? 80 : 31;
      if (!busyNow() && !dirty && t - lastDraw < gap && clock == null) { schedule(); return; }
      prev = t;
      // the first visit's turn
      if (demo) {
        const k = clamp((t - demo.t0) / 2400, 0, 1);
        yaw = demo.from + easeInOut(k) * Math.PI * 2;
        if (k >= 1) demo = null;
      } else if (!dragging) {
        if (Math.abs(vel) > 0.001) { yaw += vel * dt; vel *= Math.exp(-dt * 3.0); } else vel = 0;
        // «waiting for you»: back to the kid, looking around a little
        if (t - lastTouch > IDLE_AFTER && Math.abs(vel) < 0.15 && hopT < 0) {
          const base = Math.round((yaw - look.yaw) / (Math.PI * 2)) * Math.PI * 2 + look.yaw;
          const want = base + 0.42 * Math.sin((t - tStart) / 1000 * 0.42);
          yaw += (want - yaw) * (1 - Math.exp(-dt * 0.9));
          tiltA += (0 - tiltA) * (1 - Math.exp(-dt * 1.5));
        }
      }
      // pop in
      let pop = 1;
      if (enterT >= 0) {
        const k = clamp((t - enterT) / 520, 0, 1);
        pop = 0.82 + 0.18 * easeOutBack(k);
        if (k >= 1) enterT = -1;
      }
      // the hop
      let hy = 0, sy = 1, extra = 0;
      if (hopT >= 0) {
        const k = clamp((t - hopT) / 1000 / HOP_S, 0, 1);
        const p = hopPose(k);
        hy = p.y; sy = p.sy; extra = p.turn;
        if (k >= 1) { hopT = -1; extra = 0; }   // (a whole turn: the same angle, no jump)
      }
      // breathing (slower than the CSS idle's sway on purpose: they never share a rhythm)
      const b = Math.sin((t - tStart) / 1000 * (Math.PI * 2 / 3.8));
      breath.scale.set(1 - 0.006 * b, 1 + 0.014 * b, 1 - 0.006 * b);
      hop.position.y = hy * M.H;
      hop.scale.set(pop * (1 + (1 - sy) * 0.55), pop * sy, pop * (1 + (1 - sy) * 0.55));
      turn.rotation.y = yaw + extra;
      tilt.rotation.x = tiltA;
      const lift = clamp(hy / 0.2, 0, 1);
      shadow.material.opacity = 1 - 0.55 * lift;
      shadow.scale.set(sd * (1 - 0.35 * lift) * pop, sd * 0.92 * (1 - 0.35 * lift) * pop, 1);
      renderer.render(scene, camera);
      if (shaderBad || gl.isContextLost()) { fail(shaderBad ? 'shader' : 'context'); return; }
      lastDraw = t; dirty = false; frames += 1;
      if (!firstFrameAt) { firstFrameAt = performance.now(); ready(); }
      schedule();
    }
    function schedule() {
      if (!alive || raf || !visible || !onScreen || clock != null) return;
      // (asleep after a long while untouched: a touch, a key, the pointer over it or coming back wakes it)
      if (now() - lastTouch > SLEEP_AFTER && !busyNow() && !dirty) return;
      raf = requestAnimationFrame(frame);
    }
    function wake() { touched(); dirty = true; schedule(); }

    // ── fingers and the mouse ──
    const ray = new THREE.Raycaster();
    function hitModel(cx, cy) {
      const r = canvas.getBoundingClientRect();
      const v = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(v, camera);
      return ray.intersectObject(model, true).length > 0;
    }
    function startDrag(p) {
      dragging = true; vel = 0;
      down = { x: p.x, y: p.y, t: now(), moved: 0 };
      lastMove = { x: p.x, y: p.y, t: now() };
    }
    function onDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      // (a first finger again: anything left over from a pointer the page lost while it redrew is forgotten)
      if (e.isPrimary) { pts.clear(); pinch = null; }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      touched(); demo = null;
      if (pts.size === 2) {
        const [a, c] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - c.x, a.y - c.y), z: zoom };
        dragging = false; down = null; vel = 0;
      } else if (pts.size === 1) startDrag({ x: e.clientX, y: e.clientY });
      schedule();
    }
    function onMove(e) {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      touched();
      if (pinch && pts.size >= 2) {
        const [a, c] = [...pts.values()];
        const d = Math.hypot(a.x - c.x, a.y - c.y);
        setZoom(pinch.z * d / Math.max(1, pinch.d));
        e.preventDefault();
        return;
      }
      if (!dragging || !lastMove) return;
      const dx = e.clientX - lastMove.x, dy = e.clientY - lastMove.y;
      const dts = Math.max(1, now() - lastMove.t) / 1000;
      const k = (Math.PI * 2) / Math.max(260, Math.min(W, 520) * 1.1);   // about one turn across the stage
      yaw += dx * k;
      tiltA = clamp(tiltA + dy * 0.004, TILT_MIN, TILT_MAX);
      const v = (dx * k) / dts;
      vel = vel * 0.6 + v * 0.4;
      if (down) down.moved += Math.abs(dx) + Math.abs(dy);
      lastMove = { x: e.clientX, y: e.clientY, t: now() };
      if (down && down.moved > 24 && !learnedSpin) {
        learnedSpin = true; store.set(K_SPUN, '1'); hideHint();
        if (!learnedTap) { clearTimeout(tapHintTimer); tapHintTimer = later(() => { if (!learnedTap && hopT < 0) showHint('tap'); }, 1600); }
      }
      dirty = true;
      schedule();
    }
    function onUp(e) {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      touched();
      if (pinch) {
        if (pts.size < 2) {
          pinch = null;
          // (one finger still down after a pinch: it turns the character from here)
          const rest = [...pts.values()][0];
          if (rest) { startDrag(rest); down.moved = 99; } else { dragging = false; down = null; }
        }
        return;
      }
      const tap = down && down.moved < 8 && now() - down.t < 450 && e.type === 'pointerup';
      // (a finger resting still before it lets go: no spin)
      if (lastMove && now() - lastMove.t > 90) vel = 0;
      vel = clamp(vel, -14, 14);
      dragging = false; down = null; lastMove = null;
      if (tap && hitModel(e.clientX, e.clientY)) { vel = 0; startHop(); }
      schedule();
    }
    function setZoom(z) {
      const nz = clamp(z, ZMIN, ZMAX);
      if (Math.abs(nz - zoom) < 1e-4) return false;
      zoom = nz; applyZoom(); touched(); schedule();
      return true;
    }
    function onWheel(e) {
      // a trackpad pinch (and Ctrl + wheel) is ours, never the page's zoom («nothing opens zoomed in»)
      if (e.ctrlKey) { e.preventDefault(); setZoom(zoom * Math.exp(-e.deltaY * 0.01)); return; }
      // zoom while there is room to zoom; at a limit the page scrolls as usual (never a trapped wheel)
      const z = zoom * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016));
      if (setZoom(z)) { e.preventDefault(); }
    }
    function onKey(e) {
      const k = e.key;
      if (k === 'ArrowLeft' || k === 'ArrowRight') { vel = (k === 'ArrowLeft' ? -1 : 1) * 3.2; demo = null; e.preventDefault(); }
      else if (k === 'ArrowUp' || k === 'ArrowDown') { tiltA = clamp(tiltA + (k === 'ArrowDown' ? 0.06 : -0.06), TILT_MIN, TILT_MAX); dirty = true; e.preventDefault(); }
      else if (k === '+' || k === '=') { setZoom(zoom * 1.15); e.preventDefault(); }
      else if (k === '-' || k === '_') { setZoom(zoom / 1.15); e.preventDefault(); }
      else if (k === 'Enter' || k === ' ') { startHop(); e.preventDefault(); }
      else return;
      wake();
    }
    const noMenu = (e) => e.preventDefault();
    const on = (el, type, fn, o) => { el.addEventListener(type, fn, o); undo.push(() => el.removeEventListener(type, fn, o)); };
    on(canvas, 'pointerdown', onDown);
    on(canvas, 'pointermove', onMove);
    on(canvas, 'pointerup', onUp);
    on(canvas, 'pointercancel', onUp);
    on(canvas, 'lostpointercapture', onUp);
    on(canvas, 'pointerenter', wake);
    on(canvas, 'wheel', onWheel, { passive: false });
    on(canvas, 'keydown', onKey);
    on(canvas, 'focus', wake);
    on(canvas, 'contextmenu', noMenu);

    // ── only while it can be seen ──
    function onVis() {
      visible = !document.hidden;
      if (visible) { prev = now(); wake(); } else if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }
    on(document, 'visibilitychange', onVis);
    let io = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((list) => {
        onScreen = list.some((x) => x.isIntersecting);
        if (onScreen) { prev = now(); wake(); } else if (raf) { cancelAnimationFrame(raf); raf = 0; }
      });
      undo.push(() => io.disconnect());
    }
    const onResize = () => { layout(); schedule(); };
    on(window, 'resize', onResize);
    let ro = null;
    if ('ResizeObserver' in window) { ro = new ResizeObserver(() => onResize()); undo.push(() => ro.disconnect()); }

    // ── the page's stage (a redraw of the page makes a new one: the same canvas moves into it) ──
    function attach(st) {
      if (!alive || !st) return;
      if (host && io) io.unobserve(host);
      if (host && ro) ro.unobserve(host);
      if (pod) pod.style.transform = '';
      if (host && host !== st) host.classList.remove('has-3d', 'is-3d');
      host = st;
      pod = st.querySelector('.zc-pod');
      fig = pod ? pod.querySelector('.zc-fig') : null;
      const top = st.querySelector('.zc-stage-top');
      st.insertBefore(canvas, top || null);
      st.insertBefore(hint, top || null);
      st.classList.add('has-3d');
      if (firstFrameAt) st.classList.add('is-3d');
      layout();
      if (io) io.observe(st);
      if (ro) ro.observe(st);
      dirty = true; schedule();
    }
    let readyDone = false;
    function ready() {
      if (readyDone) return;
      readyDone = true;
      if (host) host.classList.add('is-3d');
      enterT = now();
      if (!learnedSpin) {
        demo = { t0: now() + 450, from: yaw };
        later(() => { if (!learnedSpin) showHint('spin'); }, 900);
      } else if (!learnedTap) {
        tapHintTimer = later(() => { if (!learnedTap && hopT < 0) showHint('tap'); }, 2200);
      }
      if (opts.onReady) opts.onReady();
    }
    let failed = false, firstFail = '';
    function fail(why) {
      if (failed || !alive) return;
      failed = true;
      dispose();
      if (ctlMade && opts.onFail) opts.onFail(why);
      else firstFail = why;
    }
    function dispose() {
      if (!alive) return;
      alive = false;
      giveBack();
      if (window.__zoco3d && window.__zoco3d.id === opts.id) window.__zoco3d = null;
    }

    // (the page may have drawn itself again while the model loaded: the stage of this moment)
    attach((opts.where && opts.where()) || stage);
    frame();   // the first frame now (also when the page is not painting, e.g. a background tab: no blank swap)
    if (firstFail) throw new Error(firstFail);   // (the very first frame could not be drawn: the picture stays)

    const ctl = {
      id: opts.id,
      attach, dispose,
      state: () => ({ id: opts.id, yaw, tilt: tiltA, zoom, vel, hopping: hopT >= 0, demo: !!demo, frames, alive,
        hint: hint.classList.contains('is-on') ? hint.className : '', ppu: ppu0, size: [W, Hs], pixelRatio: renderer.getPixelRatio(),
        t: Math.round(now() - tStart), asleep: !raf && alive && visible && onScreen,
        timing: { fetch: Math.round(tFetched - t0), parse: Math.round(tParsed - tFetched), firstFrame: firstFrameAt ? Math.round(firstFrameAt - t0) : null,
          sinceOpen: firstFrameAt ? Math.round(firstFrameAt) : null },
        gpu: { geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles } }),
      // (test hook) stop the clock at t ms after the start and draw that frame: screenshots of a moving thing
      freeze(tms) { clock = tStart + tms; prev = clock - 16; dirty = true; frame(); },
      unfreeze() { clock = null; prev = now(); wake(); },
      // (test hook) a turn / tilt / zoom straight away, no inertia, no demo
      pose(p) { demo = null; vel = 0; if (p.yaw != null) yaw = p.yaw; if (p.tilt != null) tiltA = p.tilt; if (p.zoom != null) setZoom(p.zoom); wake(); },
      // (test hook) as if nobody had touched it for ms
      idle(ms) { lastTouch = now() - ms; dirty = false; },
      hop: startHop,
    };
    ctlMade = true;
    window.__zoco3d = ctl;
    return ctl;
  } catch (err) {
    alive = false;
    giveBack();
    throw err;
  }
}
