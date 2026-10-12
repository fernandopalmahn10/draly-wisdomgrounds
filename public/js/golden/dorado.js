// =========================================================================
// dorado.js — «Dralingo Dorado», the rare golden visitor of /audios
// =========================================================================
// About one visit in ten (audios.html rolls the dice; ?dorado=1 forces it, ?dorado=0 never) a golden Dralingo pops
// out of a gold seal in the corner, waves, and says he only comes now and then. Tap him: hop, spin, gold sparkles.
// He leaves by himself after 30 s (or with ×), and the WebGL context is released.
// Never blocks the page: a small corner card, no sound (the homework audio is the point of this page).
// The model is the procedural three.js build in three/golden-dralingo (img2threejs, all passes reviewed);
// golden-dralingo.js / studioLights.js / dralingoActions.js come from its ship.mjs, do not edit them here.
// =========================================================================
import * as THREE from 'three';
import { createGoldenDralingoModel, createGoldenDralingoEnvironment, configureGoldenDralingoRenderer } from './golden-dralingo.js';
import { STUDIO, createStudioLights, bindEnvironment } from './studioLights.js';
import { createDralingoActions } from './dralingoActions.js';

const STAY_MS = 30000;
const EXTRA_MS = 10000;          // every tap keeps him a little longer
const ENTER_S = 1.1;
const EXIT_S = 0.75;
const CSS = '/css/dorado.css?v=20261011a';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
};
const easeOutBack = (k) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const easeInBack = (k) => { const c = 1.70158; return (c + 1) * k * k * k - c * k * k; };

function loadCss() {
  if (document.querySelector('link[data-dorado]')) return Promise.resolve();
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CSS;
    link.dataset.dorado = '1';
    link.onload = link.onerror = () => resolve();
    document.head.appendChild(link);
  });
}

function bubbleText(seen) {
  if (seen <= 1) return { title: '¡Me encontraste!', text: 'Soy Dralingo Dorado. Aparezco muy pocas veces.' };
  return { title: '¡Otra vez tú!', text: 'Ya me viste ' + seen + ' veces. Aparezco muy pocas veces.' };
}

export async function summon() {
  if (document.querySelector('.dorado')) return;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (_) { return; }                       // no WebGL: no visitor, nothing else changes
  await loadCss();

  const seen = (parseInt(store.get('dorado-visto'), 10) || 0) + 1;
  store.set('dorado-visto', String(seen));
  const words = bubbleText(seen);

  // ── DOM: card = bubble + seal ring + Dralingo button + ground shadow ──
  const card = document.createElement('aside');
  card.className = 'dorado' + (reduced ? ' dorado--calm' : '');
  card.setAttribute('aria-label', 'Dralingo Dorado');
  card.innerHTML =
    '<div class="dorado-bubble" role="status">' +
      '<p class="dorado-title"></p><p class="dorado-text"></p>' +
      '<button type="button" class="dorado-close" aria-label="Cerrar">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>' +
      '</button>' +
    '</div>' +
    '<div class="dorado-stage">' +
      '<span class="dorado-ring" aria-hidden="true"></span>' +
      '<span class="dorado-shadow" aria-hidden="true"></span>' +
      '<div class="dorado-view" aria-hidden="true"></div>' +
      '<button type="button" class="dorado-hit" aria-label="Tocar a Dralingo Dorado"></button>' +
      '<span class="dorado-twinkle t1" aria-hidden="true"></span><span class="dorado-twinkle t2" aria-hidden="true"></span>' +
      '<span class="dorado-twinkle t3" aria-hidden="true"></span>' +
    '</div>';
  const $ = (s) => card.querySelector(s);
  $('.dorado-title').textContent = words.title;
  $('.dorado-text').textContent = words.text;
  const stage = $('.dorado-stage');
  const hit = $('.dorado-hit');
  const view = $('.dorado-view');
  const shadow = $('.dorado-shadow');
  view.appendChild(renderer.domElement);
  document.body.appendChild(card);

  // ── three.js scene ─────────────────────────────────────────────────
  configureGoldenDralingoRenderer(renderer);
  renderer.toneMappingExposure = STUDIO.exposure;
  renderer.shadowMap.enabled = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const env = createGoldenDralingoEnvironment(renderer);
  scene.environment = env;
  scene.add(createStudioLights(STUDIO, { shadowMapSize: 1024 }));
  const model = createGoldenDralingoModel({});
  bindEnvironment(model, env);
  model.traverse((o) => {                       // invisible proxies (root box, repetition carriers): skip their draw calls
    if (o.isMesh && o.material && o.material.transparent && o.material.opacity === 0) o.visible = false;
  });
  const pivot = new THREE.Group();              // entrance / exit transforms; the actions own the model itself
  pivot.add(model);
  scene.add(pivot);
  const actions = createDralingoActions(model);

  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 50);
  const target = new THREE.Vector3(0, 1.12, 0);
  const halfH = 1.4;
  const dist = halfH / Math.tan(THREE.MathUtils.degToRad(12));
  const el = THREE.MathUtils.degToRad(7);
  camera.position.set(0, target.y + Math.sin(el) * dist, Math.cos(el) * dist);
  camera.lookAt(target);

  function size() {
    const r = view.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  size();
  window.addEventListener('resize', size);

  // ── life cycle ─────────────────────────────────────────────────────
  const t0 = performance.now();
  let leaveAt = t0 + STAY_MS;
  let exitStart = -1;
  let raf = 0;
  let alive = true;

  function frame(now) {
    if (!alive) return;
    const t = (now - t0) / 1000;
    actions.pose(reduced ? 0 : t);
    if (exitStart >= 0) {
      const k = Math.min(1, (now - exitStart) / 1000 / EXIT_S);
      const s = reduced ? 1 : 1 - easeInBack(k);
      pivot.scale.setScalar(Math.max(0.001, s));
      pivot.rotation.y = reduced ? 0 : k * Math.PI * 1.5;
      card.style.opacity = String(1 - k);
      if (k >= 1) { destroy(); return; }
    } else if (t < ENTER_S && !reduced) {
      const k = t / ENTER_S;
      pivot.scale.setScalar(Math.max(0.001, easeOutBack(k)));
      pivot.rotation.y = (1 - k) * (1 - k) * -Math.PI * 2;
      pivot.position.y = (1 - easeOutBack(k)) * -0.6;
    } else {
      pivot.scale.setScalar(1);
      pivot.rotation.y = 0;
      pivot.position.y = 0;
      if (now >= leaveAt) leave();
    }
    // contact shadow (page-level, as the spec says): shrinks and fades while he is in the air
    const lift = Math.max(0, model.position.y + pivot.position.y);
    shadow.style.transform = 'translateX(-50%) scale(' + (1 - Math.min(0.6, lift * 1.4)).toFixed(3) + ')';
    shadow.style.opacity = String(Math.max(0.25, 1 - lift * 2));
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  function leave() {
    if (exitStart >= 0) return;
    exitStart = performance.now();
    card.classList.add('dorado--leaving');
    setTimeout(destroy, EXIT_S * 1000 + 400);   // gone even if the browser runs no frames (throttled / hidden tab)
  }

  function destroy() {
    if (!alive) return;
    alive = false;
    cancelAnimationFrame(raf);
    clearInterval(tick);
    window.removeEventListener('resize', size);
    document.removeEventListener('visibilitychange', onVisibility);
    scene.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); } });
    env.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    card.remove();
  }

  function onVisibility() {                     // no GPU work while the tab is hidden
    if (document.hidden) cancelAnimationFrame(raf);
    else if (alive) raf = requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', onVisibility);

  function sparkle() {
    if (reduced) return;
    const n = 16;
    for (let i = 0; i < n; i += 1) {
      const s = document.createElement('span');
      s.className = 'dorado-spark';
      stage.appendChild(s);
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const r = 70 + Math.random() * 60;
      const anim = s.animate([
        { transform: 'translate(-50%, -50%) scale(.2) rotate(0deg)', opacity: 1 },
        { transform: 'translate(calc(-50% + ' + (Math.cos(a) * r).toFixed(1) + 'px), calc(-50% + ' +
          (Math.sin(a) * r * 0.8 - 30).toFixed(1) + 'px)) scale(' + (0.6 + Math.random() * 0.7).toFixed(2) + ') rotate(' +
          Math.round(Math.random() * 180) + 'deg)', opacity: 0 },
      ], { duration: 800 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.3,1)' });
      anim.onfinish = () => s.remove();
    }
  }

  let taps = 0;
  hit.addEventListener('click', () => {
    if (exitStart >= 0) return;
    taps += 1;
    if (!reduced && !actions.isCheering()) actions.cheer((performance.now() - t0) / 1000);
    sparkle();
    $('.dorado-title').textContent = taps === 1 ? '¡Hoy es tu día de suerte!' : '¡Otra vez! ¡Qué divertido!';
    $('.dorado-text').textContent = 'Sigue escuchando tu tarea. ¡Tú puedes!';
    leaveAt = Math.max(leaveAt, performance.now() + EXTRA_MS);
  });
  $('.dorado-close').addEventListener('click', leave);

  card.classList.add('dorado--in');
  raf = requestAnimationFrame(frame);
  const tick = setInterval(() => { if (performance.now() >= leaveAt) leave(); }, 1000);
  window.__dorado = { leave, actions };          // test hook (screenshots step the animation through it)
}
