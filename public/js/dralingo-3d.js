// Dralingo3D — three.js wrapper that mounts a 3D Dralingo into a DOM container.
// Loads .glb (DRACO-compressed) and falls back to a textured plane (dralingo.png) if loading fails.
// Used on:
//   - Home page hero
//   - Legendary appearance overlay
//   - Player corner (light variant)
//
// API:
//   Dralingo3D.mount(container, { variant, hover, rotate, glowColor, onReady })
//   Returns { dispose, setVariant, kick }

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const VARIANTS = {
  flying:   { url: '/assets/dralingo-flying.glb',          scale: 1.0,  yOffset: 0,    rotY: 0   },
  emperor:  { url: '/assets/dralingo-emperor.glb',         scale: 1.0,  yOffset: 0,    rotY: 0   },
  eating:   { url: '/assets/dralingo-eating.glb',          scale: 1.0,  yOffset: 0,    rotY: 0   },
  sheikh:   { url: '/assets/dralingo-sheikh.glb',          scale: 1.0,  yOffset: 0,    rotY: 0   },
  red:      { url: '/assets/dralingo-red-compressed.glb',  scale: 1.0,  yOffset: 0,    rotY: 0   },
  monk:     { url: '/assets/john-monk.glb',                scale: 1.0,  yOffset: 0,    rotY: 0   }
};

// Cache loaded geometries — multiple mounts of the same variant only fetch once
const variantCache = new Map();
let dracoLoader = null;
let gltfLoader = null;

function getLoaders() {
  if (!gltfLoader) {
    dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
    dracoLoader.setDecoderConfig({ type: 'js' });
    gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);
  }
  return gltfLoader;
}

async function loadVariant(variantKey) {
  const v = VARIANTS[variantKey] || VARIANTS.flying;
  if (variantCache.has(variantKey)) return variantCache.get(variantKey);
  const loader = getLoaders();
  const promise = new Promise((resolve, reject) => {
    loader.load(
      v.url,
      (gltf) => resolve({ scene: gltf.scene, animations: gltf.animations, settings: v }),
      undefined,
      (err) => reject(err)
    );
  });
  variantCache.set(variantKey, promise);
  return promise;
}

function fitToBox(object3D, targetSize) {
  const box = new THREE.Box3().setFromObject(object3D);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim === 0) return;
  const scale = targetSize / maxDim;
  object3D.scale.multiplyScalar(scale);
  // Recenter
  const center = new THREE.Vector3();
  box.getCenter(center);
  object3D.position.sub(center.multiplyScalar(scale));
}

const Dralingo3D = {
  /**
   * Mount a 3D Dralingo into a DOM element.
   * @param {HTMLElement} container
   * @param {object} opts
   *   - variant: 'flying' | 'emperor' | 'eating' | 'sheikh' | 'red' | 'monk' (default 'flying')
   *   - hover: bool (default true) — gentle Y-axis bob
   *   - rotate: bool (default true) — slow Y-axis spin
   *   - autoSize: bool (default true) — fits model to viewport
   *   - glow: bool (default true) — golden rim light
   *   - onReady: fn called when model is loaded
   *   - bg: 'transparent' (default) | hex color
   */
  async mount(container, opts = {}) {
    if (!container) return null;

    const variant = opts.variant || 'flying';
    const hover = opts.hover !== false;
    const rotate = opts.rotate !== false;
    const autoSize = opts.autoSize !== false;
    const glow = opts.glow !== false;

    // --- Renderer ---
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: opts.bg !== 'transparent' ? false : true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    function resize() {
      const w = container.clientWidth || 320;
      const h = container.clientHeight || 320;
      renderer.setSize(w, h, false);
      if (camera) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
    }

    container.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, {
      width: '100%',
      height: '100%',
      display: 'block'
    });

    // --- Scene ---
    const scene = new THREE.Scene();
    if (opts.bg && opts.bg !== 'transparent') scene.background = new THREE.Color(opts.bg);

    // --- Camera ---
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0.4, 4.2);
    camera.lookAt(0, 0, 0);

    // --- Lighting (warm golden + cool rim) ---
    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xfff0d4, 1.6);
    keyLight.position.set(2, 3, 4);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xffd57a, 1.2);
    rimLight.position.set(-2, 1.5, -2);
    scene.add(rimLight);

    if (glow) {
      const fillLight = new THREE.PointLight(0xff9966, 0.6, 8);
      fillLight.position.set(0, -1, 3);
      scene.add(fillLight);
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // --- Model ---
    const root = new THREE.Group();
    scene.add(root);

    let model = null;
    let kickFactor = 0; // for kick() — temporary scale boost
    let tStart = performance.now();

    // Loading placeholder: a small spinning torus while GLB loads
    const placeholderGeo = new THREE.TorusGeometry(0.5, 0.08, 8, 32);
    const placeholderMat = new THREE.MeshStandardMaterial({
      color: 0xffd57a,
      emissive: 0xffd57a,
      emissiveIntensity: 0.4,
      metalness: 0.6,
      roughness: 0.3
    });
    const placeholder = new THREE.Mesh(placeholderGeo, placeholderMat);
    root.add(placeholder);

    let mixer = null; // for animations if present
    const clock = new THREE.Clock();

    loadVariant(variant)
      .then(({ scene: gltfScene, animations }) => {
        root.remove(placeholder);
        placeholderGeo.dispose();
        placeholderMat.dispose();

        model = gltfScene;
        if (autoSize) fitToBox(model, 2.4);
        root.add(model);

        if (animations && animations.length > 0) {
          mixer = new THREE.AnimationMixer(model);
          const clip = animations[0];
          mixer.clipAction(clip).play();
        }

        if (opts.onReady) opts.onReady(model);
      })
      .catch((err) => {
        console.warn('[Dralingo3D] failed to load', variant, err);
      });

    // --- Animation loop ---
    let raf = null;
    let stopped = false;

    function animate() {
      if (stopped) return;
      raf = requestAnimationFrame(animate);
      const t = (performance.now() - tStart) / 1000;
      const dt = clock.getDelta();
      if (mixer) mixer.update(dt);

      if (rotate) {
        root.rotation.y = Math.sin(t * 0.45) * 0.45 + 0.05;
      }
      if (hover) {
        root.position.y = Math.sin(t * 1.6) * 0.15;
      }
      if (placeholder.parent === root) {
        placeholder.rotation.x += 0.04;
        placeholder.rotation.y += 0.06;
      }

      // Kick decay (smooth scale boost on demand)
      if (kickFactor > 0.001) {
        kickFactor *= 0.85;
        const s = 1 + kickFactor;
        root.scale.setScalar(s);
      } else if (root.scale.x !== 1) {
        root.scale.setScalar(1);
      }

      renderer.render(scene, camera);
    }
    animate();

    return {
      dispose() {
        stopped = true;
        if (raf) cancelAnimationFrame(raf);
        ro.disconnect();
        renderer.dispose();
        scene.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
            else obj.material.dispose();
          }
        });
        if (renderer.domElement.parentElement === container) {
          container.removeChild(renderer.domElement);
        }
      },
      kick() {
        kickFactor = 0.4;
      },
      getRoot() { return root; }
    };
  },

  preload(variantKey) {
    return loadVariant(variantKey).catch(() => {});
  },

  variants: Object.keys(VARIANTS)
};

window.Dralingo3D = Dralingo3D;
export default Dralingo3D;
