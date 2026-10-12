// Golden Dralingo studio rig (lighting-pass, host level): the reference's soft studio key from the upper right-front (image right = character left, +X),
// a weak warm/cool fill so the white kandura keeps its grey falloff, and a warm rim that outlines wings and ghutra.
// Shared by review.html and the platform page so the reviewed lighting is the shipped lighting.
import * as THREE from 'three';

export const STUDIO = {
  exposure: 0.8,
  hemi: { sky: '#fff6e6', ground: '#9c8c6c', intensity: 0.42 },
  key: { color: '#fff1dc', intensity: 3.2, position: [4.0, 5.0, 4.0] },
  fill: { color: '#cfe0ff', intensity: 0.3, position: [-4.5, 1.5, 3.0] },
  rim: { color: '#ffe6b0', intensity: 1.4, position: [-3.0, 4.0, -5.0] },
};

export function createStudioLights(cfg = STUDIO, { shadows = true, shadowMapSize = 2048 } = {}) {
  const lights = new THREE.Group();
  lights.name = 'Golden Dralingo studio lights';
  lights.add(new THREE.HemisphereLight(cfg.hemi.sky, cfg.hemi.ground, cfg.hemi.intensity));
  const key = new THREE.DirectionalLight(cfg.key.color, cfg.key.intensity);
  key.position.set(...cfg.key.position);
  if (shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    key.shadow.bias = -0.0003;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 6;
    Object.assign(key.shadow.camera, { near: 0.5, far: 30, left: -2.2, right: 2.2, top: 2.6, bottom: -1.0 });
    key.shadow.camera.updateProjectionMatrix();
  }
  lights.add(key);
  const fill = new THREE.DirectionalLight(cfg.fill.color, cfg.fill.intensity);
  fill.position.set(...cfg.fill.position);
  lights.add(fill);
  const rim = new THREE.DirectionalLight(cfg.rim.color, cfg.rim.intensity);
  rim.position.set(...cfg.rim.position);
  lights.add(rim);
  return lights;
}

// three.js r163+: material.envMapIntensity only scales material.envMap; with scene.environment alone every material
// gets scene.environmentIntensity and the per-material values authored in the spec are silently ignored. Binding the
// environment to each material makes the authored envMapIntensity (cloth 0.3, blacks 0.35, gold ...) real.
export function bindEnvironment(model, envTexture) {
  model.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (m && 'envMap' in m) { m.envMap = envTexture; m.needsUpdate = true; }
    }
  });
}
