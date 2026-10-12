import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// THREE.CapsuleGeometry duplicates every UV-seam vertex (measured: 194 boundary
// edges on the default radius/segments below) -- same benign pattern as box/
// cylinder/sphere/torus, all of which weld cleanly to 0 given a CORRECT weld.
// (A naive vertex-only mergeVertices() reports 64 'non-manifold' edges here, but
// that is a counting artifact, not a real defect: it double-counts a handful of
// near-pole triangles that become degenerate once two of their three corners
// coincide -- confirmed by replicating subdivideCatmullClark's own degenerate-
// triangle-aware vertex identity, which finds a perfectly ordinary 2-manifold.)
// A capsule is the primary shape for skinned limbs/torso (PLAN_1.5), and skinning
// weight computation is O(vertices x bones), so fewer, guaranteed-simple vertices
// is worth having regardless -- authored as a deterministic, closed-by-
// construction mesh instead: shared pole vertices, and
// the radial index taken `% radialSegments` so the seam is never a duplicate
// vertex in the first place, rather than something to weld away afterward.
// Adapted from forge/stage5_rig/emit_rig.py's buildWatertightCapsule (verified
// there: 0 boundary edges, 0 non-manifold edges, deterministic across repeated
// runs) -- ported here rather than imported because this factory and the rig
// emitter are separate generated-output surfaces with no shared runtime module;
// see forge/tests/test_primitive_watertightness.py for the measured proof, and
// coordinate with the rig owner before changing either copy independently.
function buildWatertightCapsule(
  radius ,
  cylLength ,
  capSegments ,
  radialSegments ,
  heightSegments ,
) {
  const positions = [];
  const indices = [];
  const uvs = [];
  const halfCyl = cylLength / 2;
  const totalSpan = 2 * (Math.PI / 2 * radius) + Math.max(0, cylLength);
  const vOf = (fromBottom ) => (totalSpan > 0 ? fromBottom / totalSpan : 0);

  const bottomPoleIndex = positions.length / 3;
  positions.push(0, -halfCyl - radius, 0);
  uvs.push(0.5, vOf(0));

  const ringStarts = [];
  const ringV = [];
  for (let ring = 1; ring <= capSegments; ring += 1) {
    const phi = (Math.PI / 2) * (ring / capSegments);
    const y = -halfCyl - radius * Math.cos(phi);
    const r = radius * Math.sin(phi);
    const start = positions.length / 3;
    ringStarts.push(start);
    ringV.push(vOf(radius * phi));
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const theta = (radial / radialSegments) * Math.PI * 2;
      positions.push(r * Math.cos(theta), y, r * Math.sin(theta));
      uvs.push(radial / radialSegments, vOf(radius * phi));
    }
  }

  const cylinderRingStarts = [];
  if (cylLength > 0) {
    for (let step = 1; step <= heightSegments; step += 1) {
      const y = -halfCyl + (cylLength * step) / heightSegments;
      const start = positions.length / 3;
      cylinderRingStarts.push(start);
      const v = vOf(radius * (Math.PI / 2) + halfCyl + y);
      for (let radial = 0; radial < radialSegments; radial += 1) {
        const theta = (radial / radialSegments) * Math.PI * 2;
        positions.push(radius * Math.cos(theta), y, radius * Math.sin(theta));
        uvs.push(radial / radialSegments, v);
      }
    }
  }

  const topRingStarts = [];
  for (let ring = capSegments - 1; ring >= 1; ring -= 1) {
    const phi = (Math.PI / 2) * (ring / capSegments);
    const y = halfCyl + radius * Math.cos(phi);
    const r = radius * Math.sin(phi);
    const start = positions.length / 3;
    topRingStarts.push(start);
    const v = vOf(radius * (Math.PI / 2) + Math.max(0, cylLength) + radius * (Math.PI / 2 - phi));
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const theta = (radial / radialSegments) * Math.PI * 2;
      positions.push(r * Math.cos(theta), y, r * Math.sin(theta));
      uvs.push(radial / radialSegments, v);
    }
  }

  const topPoleIndex = positions.length / 3;
  positions.push(0, halfCyl + radius, 0);
  uvs.push(0.5, vOf(totalSpan));

  const firstBottomRing = ringStarts[0];
  for (let radial = 0; radial < radialSegments; radial += 1) {
    const next = (radial + 1) % radialSegments;
    indices.push(bottomPoleIndex, firstBottomRing + radial, firstBottomRing + next);
  }

  const allRings = [...ringStarts, ...cylinderRingStarts, ...topRingStarts];
  for (let i = 0; i < allRings.length - 1; i += 1) {
    const a = allRings[i];
    const b = allRings[i + 1];
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const next = (radial + 1) % radialSegments;
      indices.push(a + radial, a + next, b + next);
      indices.push(a + radial, b + next, b + radial);
    }
  }

  const lastRing = allRings[allRings.length - 1];
  for (let radial = 0; radial < radialSegments; radial += 1) {
    const next = (radial + 1) % radialSegments;
    indices.push(topPoleIndex, lastRing + next, lastRing + radial);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// bevelEnabled defaults to true on THREE.ExtrudeGeometry and rounds every
// corner — sharp/pointed profiles (blades, fork tines, spikes) need
// bevelEnabled: false plus lineTo()-only path segments near the tip, since a
// curve command cannot produce a true converging point.
function buildExtrudeShape(points , holes ) {
  const shape = new THREE.Shape();
  if (points.length > 0) {
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) {
      shape.lineTo(points[i][0], points[i][1]);
    }
  }
  // Cutouts (e.g. an oval wire-cutter hole) as THREE.Path added to shape.holes —
  // dep-free boolean subtraction via the tessellator, no CSG library needed.
  for (const loop of holes ?? []) {
    if (loop.length < 3) continue;
    const path = new THREE.Path();
    path.moveTo(loop[0][0], loop[0][1]);
    for (let i = 1; i < loop.length; i += 1) path.lineTo(loop[i][0], loop[i][1]);
    path.closePath();
    shape.holes.push(path);
  }
  return shape;
}

// Build an N-gon oval loop (for hole authoring from a compact {cx,cy,rx,ry} descriptor).
function ovalLoop(cx , cy , rx , ry , seg = 24) {
  const loop = [];
  for (let i = 0; i < seg; i += 1) {
    const a = (i / seg) * Math.PI * 2;
    loop.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return loop;
}

function buildExtrudeGeometry(profile ) {
  const holes = [...(profile.holes ?? []), ...((profile.ovalHoles ?? []).map((o) => ovalLoop(o.cx, o.cy, o.rx, o.ry)))];
  const shape = buildExtrudeShape(profile.points, holes);
  return new THREE.ExtrudeGeometry(shape, {
    depth: profile.depth,
    bevelEnabled: false,
    steps: 1,
  });
}

function buildLatheGeometry(profile ) {
  const points = profile.points.map(([x, y]) => new THREE.Vector2(Math.max(0.0001, x), y));
  return new THREE.LatheGeometry(points, profile.segments ?? 24);
}

// Frames come from PARALLEL TRANSPORT, not from a Frenet frame. A Frenet frame is defined by
// the curve's normal, which flips sign wherever the path has an inflection or straightens out,
// and every flip twists the surface 180 degrees within one segment. Carrying the previous frame
// forward and removing only its along-path component keeps the twist continuous. THREE's own
// extrudePath and TubeGeometry do not expose this, which is why this is hand-built.
function buildTaperedSweepGeometry(
  sweep ,
) {
  const stations = sweep.stations;
  if (stations.length < 2) throw new Error('tapered-sweep needs at least two stations');
  const radial = Math.max(3, sweep.radialSegments ?? 10);
  const centres = stations.map((s) => new THREE.Vector3(...s.position));

  const tangents = centres.map((_, i) => {
    const prev = centres[Math.max(0, i - 1)];
    const next = centres[Math.min(centres.length - 1, i + 1)];
    const t = next.clone().sub(prev);
    // Coincident neighbours would normalise to NaN and poison every downstream vertex.
    return t.lengthSq() < 1e-12 ? new THREE.Vector3(0, 1, 0) : t.normalize();
  });

  // Seed a reference axis that is not parallel to the first tangent, or the first cross
  // product is degenerate and the whole sweep collapses to a line.
  let ref = new THREE.Vector3(0, 0, 1);
  if (Math.abs(tangents[0].dot(ref)) > 0.9) ref = new THREE.Vector3(1, 0, 0);

  const normals = [];
  const binormals = [];
  let carried = ref.clone().sub(tangents[0].clone().multiplyScalar(ref.dot(tangents[0]))).normalize();
  for (let i = 0; i < tangents.length; i += 1) {
    const t = tangents[i];
    // Project the carried frame back onto the plane perpendicular to this tangent.
    const n = carried.clone().sub(t.clone().multiplyScalar(carried.dot(t)));
    if (n.lengthSq() < 1e-12) {
      const fallback = Math.abs(t.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      n.copy(fallback.sub(t.clone().multiplyScalar(fallback.dot(t))));
    }
    n.normalize();
    normals.push(n);
    binormals.push(new THREE.Vector3().crossVectors(t, n).normalize());
    carried = n;
  }

  const positions = [];
  const uvs = [];
  const indices = [];
  const ringStart = [];
  const isPoint = [];

  for (let i = 0; i < stations.length; i += 1) {
    const st = stations[i];
    const v = i / (stations.length - 1);
    ringStart.push(positions.length / 3);
    // A station whose section has collapsed emits ONE vertex, not a ring of radius zero.
    // A degenerate ring still carries `radial` coincident vertices and `radial` zero-area
    // triangles, so the lock ends in a blunt cap the width of the floating-point noise
    // rather than at a point -- and a hair lock, a horn or a blade tip has to reach a point.
    if (st.rx <= 1e-6 && st.rz <= 1e-6) {
      isPoint.push(true);
      positions.push(centres[i].x, centres[i].y, centres[i].z);
      uvs.push(0.5, v);
      continue;
    }
    isPoint.push(false);
    const twist = ((st.twist ?? 0) * Math.PI) / 180;
    for (let j = 0; j <= radial; j += 1) {
      const theta = (j / radial) * Math.PI * 2 + twist;
      const offset = normals[i].clone().multiplyScalar(Math.cos(theta) * st.rx)
        .add(binormals[i].clone().multiplyScalar(Math.sin(theta) * st.rz));
      const p = centres[i].clone().add(offset);
      positions.push(p.x, p.y, p.z);
      uvs.push(j / radial, v);
    }
  }

  for (let i = 0; i < stations.length - 1; i += 1) {
    const a0 = ringStart[i];
    const b0 = ringStart[i + 1];
    if (isPoint[i] && isPoint[i + 1]) continue; // two collapsed stations bound nothing
    for (let j = 0; j < radial; j += 1) {
      // Wound so the face normal points radially OUTWARD.
      //
      // Ring vertices advance from `normal` toward `binormal`, and binormal is
      // tangent x normal, so increasing theta runs counter-clockwise seen from the
      // far end of the segment. Taking the ring-to-ring edge first therefore puts
      // the cross product on the inside. Measured as signed volume on the built
      // mesh: every tapered-sweep came out negative -- a torso at -0.0674 and a
      // tail at -0.0044 against a positive ellipsoid head -- so every sweep this
      // generator has ever emitted rendered its back faces, with normals pointing
      // into the solid and every lighting judgement made on the wrong surface.
      if (isPoint[i]) indices.push(a0, b0 + j + 1, b0 + j);
      else if (isPoint[i + 1]) indices.push(a0 + j, a0 + j + 1, b0);
      else indices.push(a0 + j, a0 + j + 1, b0 + j, a0 + j + 1, b0 + j + 1, b0 + j);
    }
  }

  if (sweep.capEnds ?? true) {
    for (const end of [0, stations.length - 1]) {
      if (isPoint[end]) continue; // a point end is already closed
      const centreIndex = positions.length / 3;
      positions.push(centres[end].x, centres[end].y, centres[end].z);
      uvs.push(0.5, end === 0 ? 0 : 1);
      const base = ringStart[end];
      for (let j = 0; j < radial; j += 1) {
        if (end === 0) indices.push(centreIndex, base + j + 1, base + j);
        else indices.push(centreIndex, base + j, base + j + 1);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function hashString(value ) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readLayerNumber(value , keys , fallback ) {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const record = value ;
    for (const key of keys) {
      if (typeof record[key] === 'number') return record[key] ;
    }
  }
  return fallback;
}

function hexToRgb(hex ) {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex)
    ? '#' + hex.slice(1).split('').map((part) => part + part).join('')
    : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized.slice(1), 16) : 0x8a7a5f;
  return [clampAlbedoChannel((value >> 16) & 255), clampAlbedoChannel((value >> 8) & 255), clampAlbedoChannel(value & 255)];
}

function materialPalette(spec ) {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0) return palette.filter((value) => typeof value === 'string');
  const secondary = spec.albedo?.secondary;
  const colors = [spec.baseColor ?? spec.color ?? spec.albedo?.dominant, ...(Array.isArray(secondary) ? secondary : [])];
  return colors.filter((value) => typeof value === 'string' && value.startsWith('#'));
}

function clamp01(value ) {
  return Math.max(0, Math.min(1, value));
}

function clampAlbedoChannel(value ) {
  return Math.max(30, Math.min(240, Math.round(value)));
}

function clampPbrF0(value ) {
  return Math.max(0.02, Math.min(1, value));
}

function clampPbrIor(value ) {
  return Math.max(1, Math.min(2.5, value));
}

function clampPbrMetalness(value ) {
  return value >= 0.5 ? 1 : 0;
}

function clampedAlbedoColor(spec ) {
  const source = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  // setStyle with an explicit SRGBColorSpace, NOT the numeric constructor.
  //
  // `new THREE.Color(r, g, b)` treats its arguments as LINEAR working-space components,
  // while an authored `baseColor` hex is sRGB. Feeding one to the other skipped the
  // transfer function and lifted every dark albedo: #2e2a28, authored as a near-black
  // vinyl, rendered at roughly sRGB 0.46 — a mid grey. The error is largest exactly where
  // it matters most, because the transfer curve is steepest near black.
  return new THREE.Color().setStyle(source, THREE.SRGBColorSpace);
}

function smoothCurve(value ) {
  return value * value * (3 - 2 * value);
}

function periodicHash(x , y , seed , periodX , periodY ) {
  const wrappedX = ((x % periodX) + periodX) % periodX;
  const wrappedY = ((y % periodY) + periodY) % periodY;
  let value = Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function periodicValueNoise(u , v , seed , periodX , periodY ) {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const a = periodicHash(x0, y0, seed, periodX, periodY);
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY);
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY);
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}

function surfaceBands(spec ) {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item ) => {
    if (!item || typeof item !== 'object') return [];
    const band = item ;
    const frequency = typeof band.frequency === 'number' ? band.frequency : 0;
    const amplitude = typeof band.amplitude === 'number' ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0) return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? '')} ${String(band.role ?? '')}`.toLowerCase();
    return [{
      frequency,
      amplitude,
      stretchX: typeof stretch[0] === 'number' ? Math.max(0.1, stretch[0]) : 1,
      stretchY: typeof stretch[1] === 'number' ? Math.max(0.1, stretch[1]) : 1,
      ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description),
    }];
  });
  return parsed.length > 0 ? parsed : [
    { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false },
  ];
}

function sampleSurface(u , v , bands , seed ) {
  let value = 0;
  let weight = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX));
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY));
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY);
    if (band.ridge) sample = 1 - Math.abs(sample * 2 - 1);
    value += sample * band.amplitude;
    weight += band.amplitude;
  }
  return weight > 0 ? clamp01(value / weight) : 0.5;
}

function mixPalette(colors , value ) {
  if (colors.length === 1) return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix)),
  ];
}

function parseRgba(value ) {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match) return [138, 122, 95];
  return [clampAlbedoChannel(Number(match[1])), clampAlbedoChannel(Number(match[2])), clampAlbedoChannel(Number(match[3]))];
}

// Analytical per-pixel gradient sample. The extraction schema's colorGradient carries
// exact rgba(...) stop colors (see extract_part_color_recipe.py), so this samples the
// same trend directly in JS math rather than round-tripping through a Canvas 2D
// createLinearGradient/createRadialGradient object — same visual result, and it composes
// directly with the existing noise/height-correlated colorVariation blend below.
function sampleColorGradient(gradient , u , v ) {
  const stops = gradient.stops.length >= 2 ? gradient.stops : [{ offset: 0, color: 'rgba(138,122,95,1)' }, { offset: 1, color: 'rgba(138,122,95,1)' }];
  let t ;
  if (gradient.type === 'radial') {
    const [cx, cy] = gradient.axis;
    const dx = u - cx;
    const dy = v - cy;
    const maxRadius = Math.max(0.001, Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy)));
    t = clamp01(Math.hypot(dx, dy) / maxRadius);
  } else {
    const [ax, ay] = gradient.axis;
    const projection = (u - 0.5) * ax + (v - 0.5) * ay;
    const maxProjection = 0.5 * (Math.abs(ax) + Math.abs(ay)) || 0.5;
    t = clamp01(projection / maxProjection + 0.5);
  }
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
  const mix = scaled - index;
  const a = parseRgba(stops[index].color);
  const b = parseRgba(stops[index + 1].color);
  return [
    THREE.MathUtils.lerp(a[0], b[0], mix),
    THREE.MathUtils.lerp(a[1], b[1], mix),
    THREE.MathUtils.lerp(a[2], b[2], mix),
  ];
}

function writePixel(data , offset , red , green , blue ) {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}

function makeCanvas(size ) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createMapTexture(
  canvas ,
  colorSpace ,
  spec ,
  options ,
) {
  const texture = new THREE.CanvasTexture(canvas);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 2,
    typeof repeat[1] === 'number' ? repeat[1] : 2,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

function referenceMapUrl(spec , channel ) {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== 'object') return null;
  if (reference.usable === false) return null;
  const confidence = typeof reference.confidence === 'number'
    ? reference.confidence
    : (typeof reference.estimatedFidelity === 'number' ? reference.estimatedFidelity : 0);
  const threshold = typeof reference.targetThreshold === 'number' ? reference.targetThreshold : 0.7;
  if (confidence < threshold) return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== 'object') return null;
  const map = (maps )[channel];
  if (!map || typeof map !== 'object') return null;
  const record = map ;
  const url = typeof record.url === 'string' && record.url.trim() ? record.url : record.path;
  return typeof url === 'string' && url.trim() ? url : null;
}

function createLoadedMapTexture(
  url ,
  colorSpace ,
  spec ,
  options ,
) {
  const texture = new THREE.TextureLoader().load(url);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 1,
    typeof repeat[1] === 'number' ? repeat[1] : 1,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

function makeReferenceTextureSet(spec , options ) {
  const albedo = referenceMapUrl(spec, 'albedo');
  const roughness = referenceMapUrl(spec, 'roughness');
  const height = referenceMapUrl(spec, 'height');
  const normal = referenceMapUrl(spec, 'normal');
  const ao = referenceMapUrl(spec, 'ao');
  if (!albedo || !roughness || !height || !normal || !ao) return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: 'reference-pixel-extraction',
  };
}

function makeProceduralTextureSet(
  id ,
  spec ,
  options ,
) {
  if (typeof document === 'undefined') return null;
  const qualityFirst = (options.qualityPriority ?? 'reference-fidelity') === 'reference-fidelity';
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize = typeof requested === 'number' && Number.isFinite(requested)
    ? requested
    : (qualityFirst ? 1024 : 512);
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size),
  };
  const contexts = {
    albedo: canvases.albedo.getContext('2d'),
    roughness: canvases.roughness.getContext('2d'),
    height: canvases.height.getContext('2d'),
    normal: canvases.normal.getContext('2d'),
    ao: canvases.ao.getContext('2d'),
  };
  if (!contexts.albedo || !contexts.roughness || !contexts.height || !contexts.normal || !contexts.ao) return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size),
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const colors = (palette.length >= 2 ? palette : [fallback, '#6E614B', '#A08F70']).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ['base'], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ['variation'], 0.18));
  const colorAmplitude = clamp01(readLayerNumber(spec.colorVariation, ['amplitude', 'variation'], 0.18));
  const heightCorrelation = clamp01(readLayerNumber(spec.colorVariation, ['heightCorrelation'], 0.3));
  const colorGradient = spec.colorGradient;
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const height = sampleSurface(u, v, bands, seed + 101);
      const roughNoise = sampleSurface(u, v, bands, seed + 7001);
      const colorNoise = sampleSurface(u, v, bands, seed + 15013);
      heightField[index] = height;
      roughnessField[index] = clamp01(baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2);
      let color ;
      if (colorGradient) {
        // Evidence-derived spatial gradient (Plan 1.3 Workstream C) takes priority
        // over the noise-based palette blend below — it is a measured trend, not a guess.
        color = sampleColorGradient(colorGradient, u, v);
      } else {
        const paletteValue = clamp01(
          0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation
        );
        color = mixPalette(colors, paletteValue);
      }
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2]);
    }
  }
  const normalStrength = Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35));
  const aoStrength = clamp01(readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35));
  for (let y = 0; y < size; y += 1) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const center = heightField[index];
      const dx = (heightField[y * size + right] - heightField[y * size + left]) * normalStrength * 6;
      const dy = (heightField[down + x] - heightField[up + x]) * normalStrength * 6;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const normalX = -dx * inverseLength;
      const normalY = -dy * inverseLength;
      const normalZ = inverseLength;
      const neighborAverage = (
        heightField[y * size + left] + heightField[y * size + right]
        + heightField[up + x] + heightField[down + x]
      ) * 0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(
        images.normal.data, offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255,
      );
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255);
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0);
  contexts.roughness.putImageData(images.roughness, 0, 0);
  contexts.height.putImageData(images.height, 0, 0);
  contexts.normal.putImageData(images.normal, 0, 0);
  contexts.ao.putImageData(images.ao, 0, 0);
  return {
    albedo: createMapTexture(canvases.albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createMapTexture(canvases.roughness, THREE.NoColorSpace, spec, options),
    height: createMapTexture(canvases.height, THREE.NoColorSpace, spec, options),
    normal: createMapTexture(canvases.normal, THREE.NoColorSpace, spec, options),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: 'procedural',
  };
}

function createSculptMaterial(id , spec , options , denseComponent = false) {
  // A material that declares -- with evidence -- that its subject carries no texture
  // detail gets NO texture set. Synthesising one anyway is not a harmless default: the
  // branch below then forces color to white and roughness to 1 and reads both from the
  // generated maps, so the authored albedo and the reference-derived roughness are both
  // discarded, and the model gains mottling the reference does not have. Measured on the
  // tuxedo cat, whose black fur rendered as speckled grey-and-white from a palette that
  // only ever described two flat regions.
  const textureless = (spec.textureless )?.declared === true;
  const textures = textureless
    ? null
    : makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 0xffffff : clampedAlbedoColor(spec),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ['base'], 0.76)),
    metalness: clampPbrMetalness(readLayerNumber(spec.metalness, ['base'], 0.0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ['base', 'amount'], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ['base'], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ['base', 'amount'], 0)),
    ior: clampPbrIor(readLayerNumber(spec.ior, ['base', 'value'], 1.5)),
    thickness: Math.max(0, readLayerNumber(spec.thickness, ['base', 'amount'], 0)),
    attenuationDistance: Math.max(0.001, readLayerNumber(spec.attenuationDistance, ['base', 'value'], Infinity)),
    attenuationColor: new THREE.Color(typeof spec.attenuationColor === 'string' ? spec.attenuationColor : '#ffffff'),
    sheen: clamp01(readLayerNumber(spec.sheen, ['base', 'amount'], 0)),
    sheenColor: new THREE.Color(typeof spec.sheenColor === 'string' ? spec.sheenColor : '#ffffff'),
    sheenRoughness: clamp01(readLayerNumber(spec.sheenRoughness, ['base'], 1.0)),
    iridescence: clamp01(readLayerNumber(spec.iridescence, ['base', 'amount'], 0)),
    iridescenceIOR: clampPbrIor(readLayerNumber(spec.iridescenceIOR, ['base', 'value'], 1.3)),
    anisotropy: clamp01(readLayerNumber(spec.anisotropy, ['base', 'amount'], 0)),
    anisotropyRotation: readLayerNumber(spec.anisotropy, ['rotation'], 0),
    specularIntensity: clampPbrF0(readLayerNumber(spec.specularF0 ?? spec.f0 ?? spec.specularIntensity, ['base', 'value'], 1.0)),
    specularColor: new THREE.Color(typeof spec.specularColor === 'string' ? spec.specularColor : '#ffffff'),
    emissive: new THREE.Color(typeof spec.emissive === 'string' ? spec.emissive : '#000000'),
    emissiveIntensity: Math.max(0, readLayerNumber(spec.emissiveIntensity, ['base'], 1.0)),
    opacity: clamp01(readLayerNumber(spec.opacity, ['base'], 1)),
    transparent: readLayerNumber(spec.transmission, ['base', 'amount'], 0) > 0 || readLayerNumber(spec.opacity, ['base'], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ['cutoff', 'alphaTest'], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: spec.flatShading === true,
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35);
    const denseMesh = denseComponent || spec.denseMesh === true || spec.geometryDensity === 'dense' || spec.topologyClass === 'dense';
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ['amplitude', 'strength'], 0));
    const effectiveBumpScale = denseMesh ? Math.max(0.05, bumpScale) : bumpScale;
    if (effectiveBumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = effectiveBumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ['amplitude', 'strength'], 0));
    const effectiveDisplacementScale = denseMesh ? Math.max(0.005, displacementScale) : displacementScale;
    if (effectiveDisplacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = effectiveDisplacementScale;
      material.displacementBias = -effectiveDisplacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ['envMapIntensity'], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrConstraints = { albedoRange: [30, 240], binaryMetalness: true, f0Range: [0.02, 1], iorRange: [1, 2.5] };
  material.userData.pbrTextureSource = textures?.source ?? 'flat-fallback';
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.userData.referenceMaterialId = spec.referenceMaterialId ?? spec.materialReference?.profileId ?? null;
  material.userData.materialEvidence = spec.materialEvidence ?? null;
  material.userData.validationViews = spec.materialReference?.validationViews ?? [];
  material.needsUpdate = true;
  return material;
}

function readVector3(value , fallback ) {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number')) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

function readNumber(value , fallback ) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function makeAttachmentEndpoint(attachment ) {
  if (!attachment || typeof attachment !== 'object') return null;
  const record = attachment ;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 0.0001) return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const baseRadius = Math.max(0.005, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(0.003, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius,
  };
}

// Generated from ObjectSculptSpec target: Golden Dralingo
// Sculpt build pass: optimization-pass
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createGoldenDralingoModel(options = {}) {
  const root = new THREE.Group();
  root.name = "Golden Dralingo";
  root.userData.reconstructionEvidence = {"itemFamily": null, "subtype": null, "componentAdapter": null, "route": null, "exactnessTier": null, "referenceCamera": {"solved": false, "fovDegrees": 40.0, "aspect": 1.0, "orientation": {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}, "positionHint": [0.0, 0.0, 3.0], "note": "For likeness work, solve the reference camera (forge/stage1_intake/solve_camera_pose.py) so the review render aligns with the photo and the reference can be projected. Confirm by overlay review."}, "approximationNotes": []};
  root.userData.materialPipeline = {};
  root.userData.materialReferenceRegistry = null;

  const materialMap = {};
  materialMap["hidden"] = createSculptMaterial(
    "hidden",
    {"id": "hidden", "name": "Root proxy (never rendered)", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#000000", "color": "#000000", "albedo": {"dominant": "#000000", "secondary": ["#000000"]}, "colorVariation": {"palette": ["#000000"], "pattern": "flat", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 1.0, "variation": 0.0}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "clearcoat": {"base": 0.0}, "clearcoatRoughness": {"base": 0.3}, "textureless": {"declared": true, "evidence": ["reference.png front view (1024 px): invisible root proxy reads as one uniform albedo, no grain/print/pattern", "measure.py colour-region areas: single-hue regions with no sub-structure"]}, "envMapIntensity": 1.0, "opacity": {"base": 0.0}},
    options
  );
  materialMap["gold-skin"] = createSculptMaterial(
    "gold-skin",
    {"id": "gold-skin", "name": "Polished gold (golden edition skin)", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#feb02c", "color": "#feb02c", "albedo": {"dominant": "#feb02c", "secondary": ["#feb02c"]}, "colorVariation": {"palette": ["#feb02c"], "pattern": "flat", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 0.24, "variation": 0.06}, "metalness": {"base": 1.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "gold-hotspot", "kind": "gloss", "region": "crown, cheeks, knuckles", "roughness": 0.14, "notes": "clearcoat hotspot faces the key light"}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "clearcoat": {"base": 0.25}, "clearcoatRoughness": {"base": 0.12}, "textureless": {"declared": true, "evidence": ["reference.png front view (1024 px): golden edition recolour of a glossy vinyl skin reads as one uniform albedo, no grain/print/pattern", "measure.py colour-region areas: single-hue regions with no sub-structure"]}, "envMapIntensity": 1.8},
    options
  );
  materialMap["cloth-white"] = createSculptMaterial(
    "cloth-white",
    {"id": "cloth-white", "name": "Kandura / ghutra cloth", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#ffffff", "color": "#ffffff", "albedo": {"dominant": "#ffffff", "secondary": ["#ffffff"]}, "colorVariation": {"palette": ["#ffffff"], "pattern": "flat", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 0.7, "variation": 0.0}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "clearcoat": {"base": 0.0}, "clearcoatRoughness": {"base": 0.3}, "textureless": {"declared": true, "evidence": ["reference.png front view (1024 px): matte white cotton reads as one uniform albedo, no grain/print/pattern", "measure.py colour-region areas: single-hue regions with no sub-structure"]}, "envMapIntensity": 0.3, "sheen": {"base": 0.15}, "sheenRoughness": {"base": 0.6}, "doubleSided": true},
    options
  );
  materialMap["agal-black"] = createSculptMaterial(
    "agal-black",
    {"id": "agal-black", "name": "Agal cord", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#18191c", "color": "#18191c", "albedo": {"dominant": "#18191c", "secondary": ["#18191c"]}, "colorVariation": {"palette": ["#18191c"], "pattern": "flat", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 0.5, "variation": 0.0}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "agal-gloss", "kind": "gloss", "region": "top of each cord", "clearcoat": 0.35}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "clearcoat": {"base": 0.35}, "clearcoatRoughness": {"base": 0.25}, "textureless": {"declared": true, "evidence": ["reference.png front view (1024 px): satin black cord reads as one uniform albedo, no grain/print/pattern", "measure.py colour-region areas: single-hue regions with no sub-structure"]}, "envMapIntensity": 0.35, "specularIntensity": {"base": 0.5}},
    options
  );
  materialMap["stripe-black"] = createSculptMaterial(
    "stripe-black",
    {"id": "stripe-black", "name": "Crest mid-line", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#323538", "color": "#323538", "albedo": {"dominant": "#323538", "secondary": ["#323538"]}, "colorVariation": {"palette": ["#323538"], "pattern": "flat", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 0.8, "variation": 0.0}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "clearcoat": {"base": 0.0}, "clearcoatRoughness": {"base": 0.3}, "textureless": {"declared": true, "evidence": ["reference.png front view (1024 px): black mid-line stripe reads as one uniform albedo, no grain/print/pattern", "measure.py colour-region areas: single-hue regions with no sub-structure"]}, "envMapIntensity": 0.2, "specularIntensity": {"base": 0.3}},
    options
  );
  materialMap["hair-black"] = createSculptMaterial(
    "hair-black",
    {"id": "hair-black", "name": "Mustache / goatee", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#252729", "color": "#252729", "albedo": {"dominant": "#252729", "secondary": ["#252729"]}, "colorVariation": {"palette": ["#252729"], "pattern": "flat", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 0.55, "variation": 0.0}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "clearcoat": {"base": 0.0}, "clearcoatRoughness": {"base": 0.3}, "textureless": {"declared": true, "evidence": ["reference.png front view (1024 px): black styled hair mass reads as one uniform albedo, no grain/print/pattern", "measure.py colour-region areas: single-hue regions with no sub-structure"]}, "envMapIntensity": 0.35, "specularIntensity": {"base": 0.5}},
    options
  );
  materialMap["crest-mint"] = createSculptMaterial(
    "crest-mint",
    {"id": "crest-mint", "name": "Crest plates", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#3ea2a5", "color": "#3ea2a5", "albedo": {"dominant": "#3ea2a5", "secondary": ["#3ea2a5"]}, "colorVariation": {"palette": ["#3ea2a5"], "pattern": "flat", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 0.4, "variation": 0.0}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "clearcoat": {"base": 0.0}, "clearcoatRoughness": {"base": 0.2}, "textureless": {"declared": true, "evidence": ["reference.png front view (1024 px): pale mint vinyl plates reads as one uniform albedo, no grain/print/pattern", "measure.py colour-region areas: single-hue regions with no sub-structure"]}, "envMapIntensity": 0.6},
    options
  );
  materialMap["spike-teal"] = createSculptMaterial(
    "spike-teal",
    {"id": "spike-teal", "name": "Tail spikes", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#185a63", "color": "#185a63", "albedo": {"dominant": "#185a63", "secondary": ["#185a63"]}, "colorVariation": {"palette": ["#185a63"], "pattern": "flat", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 0.4, "variation": 0.0}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "clearcoat": {"base": 0.0}, "clearcoatRoughness": {"base": 0.2}, "textureless": {"declared": true, "evidence": ["reference.png front view (1024 px): teal vinyl spikes reads as one uniform albedo, no grain/print/pattern", "measure.py colour-region areas: single-hue regions with no sub-structure"]}, "envMapIntensity": 0.6},
    options
  );
  materialMap["eye-white"] = createSculptMaterial(
    "eye-white",
    {"id": "eye-white", "name": "Sclera", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#edf8ff", "color": "#edf8ff", "albedo": {"dominant": "#edf8ff", "secondary": ["#edf8ff"]}, "colorVariation": {"palette": ["#edf8ff"], "pattern": "flat", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 0.12, "variation": 0.0}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "clearcoat": {"base": 0.6}, "clearcoatRoughness": {"base": 0.06}, "textureless": {"declared": true, "evidence": ["reference.png front view (1024 px): glossy eye white reads as one uniform albedo, no grain/print/pattern", "measure.py colour-region areas: single-hue regions with no sub-structure"]}, "envMapIntensity": 0.5},
    options
  );
  materialMap["iris-teal"] = createSculptMaterial(
    "iris-teal",
    {"id": "iris-teal", "name": "Iris", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#569aac", "color": "#569aac", "albedo": {"dominant": "#569aac", "secondary": ["#569aac"]}, "colorVariation": {"palette": ["#569aac"], "pattern": "flat", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 0.12, "variation": 0.0}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "clearcoat": {"base": 0.6}, "clearcoatRoughness": {"base": 0.06}, "textureless": {"declared": true, "evidence": ["reference.png front view (1024 px): glossy teal iris reads as one uniform albedo, no grain/print/pattern", "measure.py colour-region areas: single-hue regions with no sub-structure"]}, "envMapIntensity": 0.5},
    options
  );
  materialMap["pupil-navy"] = createSculptMaterial(
    "pupil-navy",
    {"id": "pupil-navy", "name": "Pupil", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#384b68", "color": "#384b68", "albedo": {"dominant": "#384b68", "secondary": ["#384b68"]}, "colorVariation": {"palette": ["#384b68"], "pattern": "flat", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 0.12, "variation": 0.0}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "clearcoat": {"base": 0.6}, "clearcoatRoughness": {"base": 0.06}, "textureless": {"declared": true, "evidence": ["reference.png front view (1024 px): dark navy pupil reads as one uniform albedo, no grain/print/pattern", "measure.py colour-region areas: single-hue regions with no sub-structure"]}, "envMapIntensity": 0.35, "specularIntensity": {"base": 0.5}},
    options
  );
  materialMap["catchlight"] = createSculptMaterial(
    "catchlight",
    {"id": "catchlight", "name": "Catch-light", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#ffffff", "color": "#ffffff", "albedo": {"dominant": "#ffffff", "secondary": ["#ffffff"]}, "colorVariation": {"palette": ["#ffffff"], "pattern": "flat", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 0.1, "variation": 0.0}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "clearcoat": {"base": 0.0}, "clearcoatRoughness": {"base": 0.2}, "textureless": {"declared": true, "evidence": ["reference.png front view (1024 px): emissive eye highlight reads as one uniform albedo, no grain/print/pattern", "measure.py colour-region areas: single-hue regions with no sub-structure"]}, "envMapIntensity": 1.0, "emissive": "#ffffff", "emissiveIntensity": {"base": 1.4}},
    options
  );
  materialMap["mouth-dark"] = createSculptMaterial(
    "mouth-dark",
    {"id": "mouth-dark", "name": "Mouth interior", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#623d4d", "color": "#623d4d", "albedo": {"dominant": "#623d4d", "secondary": ["#623d4d"]}, "colorVariation": {"palette": ["#623d4d"], "pattern": "flat", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 0.6, "variation": 0.0}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "clearcoat": {"base": 0.0}, "clearcoatRoughness": {"base": 0.3}, "textureless": {"declared": true, "evidence": ["reference.png front view (1024 px): dark rose mouth cavity reads as one uniform albedo, no grain/print/pattern", "measure.py colour-region areas: single-hue regions with no sub-structure"]}, "envMapIntensity": 0.35, "specularIntensity": {"base": 0.5}},
    options
  );
  materialMap["tongue-rose"] = createSculptMaterial(
    "tongue-rose",
    {"id": "tongue-rose", "name": "Tongue", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#8c586a", "color": "#8c586a", "albedo": {"dominant": "#8c586a", "secondary": ["#8c586a"]}, "colorVariation": {"palette": ["#8c586a"], "pattern": "flat", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 0.45, "variation": 0.0}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "clearcoat": {"base": 0.2}, "clearcoatRoughness": {"base": 0.25}, "textureless": {"declared": true, "evidence": ["reference.png front view (1024 px): dusky rose tongue reads as one uniform albedo, no grain/print/pattern", "measure.py colour-region areas: single-hue regions with no sub-structure"]}, "envMapIntensity": 0.35, "specularIntensity": {"base": 0.5}},
    options
  );
  materialMap["claw-ivory"] = createSculptMaterial(
    "claw-ivory",
    {"id": "claw-ivory", "name": "Claws / fangs", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#ffffff", "color": "#ffffff", "albedo": {"dominant": "#ffffff", "secondary": ["#ffffff"]}, "colorVariation": {"palette": ["#ffffff"], "pattern": "flat", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 0.3, "variation": 0.0}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "clearcoat": {"base": 0.5}, "clearcoatRoughness": {"base": 0.15}, "textureless": {"declared": true, "evidence": ["reference.png front view (1024 px): ivory claws reads as one uniform albedo, no grain/print/pattern", "measure.py colour-region areas: single-hue regions with no sub-structure"]}, "envMapIntensity": 0.6},
    options
  );
  materialMap["membrane-cream"] = createSculptMaterial(
    "membrane-cream",
    {"id": "membrane-cream", "name": "Wing membrane", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#ffffea", "color": "#ffffea", "albedo": {"dominant": "#ffffea", "secondary": ["#ffffea"]}, "colorVariation": {"palette": ["#ffffea"], "pattern": "flat", "amplitude": 0.0, "heightCorrelation": 0.0}, "roughness": {"base": 0.62, "variation": 0.0}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "clearcoat": {"base": 0.0}, "clearcoatRoughness": {"base": 0.3}, "textureless": {"declared": true, "evidence": ["reference.png front view (1024 px): thin cream membrane reads as one uniform albedo, no grain/print/pattern", "measure.py colour-region areas: single-hue regions with no sub-structure"]}, "envMapIntensity": 0.6, "doubleSided": true},
    options
  );

  const nodes = { root };
  const meshes = {};
  const sockets = {};
  const colliders = {};
  const destructionGroups = {};

  const endpoint_root_0 = makeAttachmentEndpoint(null);
  const node_root_0 = new THREE.Group();
  node_root_0.name = "Character (root)__pivot";
  node_root_0.scale.set(1, 1, 1);
  if (endpoint_root_0) {
    node_root_0.position.copy(endpoint_root_0.start);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_root_0.position.set(0.0, 0.0, 0.0);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
  }
  node_root_0.userData.sculptComponent = {"id":"root","name":"Character (root)","material":"hidden"};
  node_root_0.userData.actionProfile = {"animationRole":"root","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["root"] ?? root).add(node_root_0);
  nodes["root"] = node_root_0;
  const mesh_root_0Geometry = endpoint_root_0
    ? new THREE.CylinderGeometry(endpoint_root_0.endRadius, endpoint_root_0.baseRadius, endpoint_root_0.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_root_0) {
    mesh_root_0Geometry.scale(0.001, 0.001, 0.001);
  }
  const mesh_root_0 = new THREE.Mesh(
    mesh_root_0Geometry,
    materialMap["hidden"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_root_0.name = "Character (root)";
  if (endpoint_root_0) {
    mesh_root_0.position.copy(endpoint_root_0.midpoint);
    mesh_root_0.quaternion.copy(endpoint_root_0.quaternion);
  }
  mesh_root_0.castShadow = options.castShadow ?? true;
  mesh_root_0.receiveShadow = options.receiveShadow ?? true;
  mesh_root_0.userData.sculptComponent = {"id":"root","name":"Character (root)","material":"hidden"};
  node_root_0.add(mesh_root_0);
  meshes["root"] = mesh_root_0;
  colliders["root"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_root_0);

  const endpoint_kandura_1 = makeAttachmentEndpoint(null);
  const node_kandura_1 = new THREE.Group();
  node_kandura_1.name = "Kandura__pivot";
  node_kandura_1.scale.set(1, 1, 1);
  if (endpoint_kandura_1) {
    node_kandura_1.position.copy(endpoint_kandura_1.start);
    node_kandura_1.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_kandura_1.position.set(0.0, 0.0, 0.0);
    node_kandura_1.rotation.set(0.0, 0.0, 0.0);
  }
  node_kandura_1.userData.sculptComponent = {"id":"kandura","name":"Kandura","material":"cloth-white"};
  node_kandura_1.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["root"] ?? root).add(node_kandura_1);
  nodes["kandura"] = node_kandura_1;
  const mesh_kandura_1Geometry = endpoint_kandura_1
    ? new THREE.CylinderGeometry(endpoint_kandura_1.endRadius, endpoint_kandura_1.baseRadius, endpoint_kandura_1.length, 16, 6)
    : buildLatheGeometry({"points": [[0.0001, 0.125], [0.415, 0.13], [0.42, 0.165], [0.39, 0.3], [0.355, 0.5], [0.322, 0.7], [0.295, 0.86], [0.275, 0.96], [0.24, 1.03], [0.18, 1.075], [0.13, 1.1], [0.0001, 1.11]], "segments": 48});
  if (!endpoint_kandura_1) {
    mesh_kandura_1Geometry.scale(1.0, 1.0, 0.8);
  }
  const mesh_kandura_1 = new THREE.Mesh(
    mesh_kandura_1Geometry,
    materialMap["cloth-white"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_kandura_1.name = "Kandura";
  if (endpoint_kandura_1) {
    mesh_kandura_1.position.copy(endpoint_kandura_1.midpoint);
    mesh_kandura_1.quaternion.copy(endpoint_kandura_1.quaternion);
  }
  mesh_kandura_1.castShadow = options.castShadow ?? true;
  mesh_kandura_1.receiveShadow = options.receiveShadow ?? true;
  mesh_kandura_1.userData.sculptComponent = {"id":"kandura","name":"Kandura","material":"cloth-white"};
  node_kandura_1.add(mesh_kandura_1);
  meshes["kandura"] = mesh_kandura_1;
  colliders["kandura"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["kandura"] ??= [];
  destructionGroups["kandura"].push(node_kandura_1);

  const endpoint_kandura_collar_2 = makeAttachmentEndpoint(null);
  const node_kandura_collar_2 = new THREE.Group();
  node_kandura_collar_2.name = "Collar band__pivot";
  node_kandura_collar_2.scale.set(1, 1, 1);
  if (endpoint_kandura_collar_2) {
    node_kandura_collar_2.position.copy(endpoint_kandura_collar_2.start);
    node_kandura_collar_2.rotation.set(1.5707963267948966, 0.0, 0.0);
  } else {
    node_kandura_collar_2.position.set(0.0, 1.085, 0.0);
    node_kandura_collar_2.rotation.set(1.5707963267948966, 0.0, 0.0);
  }
  node_kandura_collar_2.userData.sculptComponent = {"id":"kandura-collar","name":"Collar band","material":"cloth-white"};
  node_kandura_collar_2.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["kandura"] ?? root).add(node_kandura_collar_2);
  nodes["kandura-collar"] = node_kandura_collar_2;
  const mesh_kandura_collar_2Geometry = endpoint_kandura_collar_2
    ? new THREE.CylinderGeometry(endpoint_kandura_collar_2.endRadius, endpoint_kandura_collar_2.baseRadius, endpoint_kandura_collar_2.length, 16, 6)
    : new THREE.TorusGeometry(0.45, 0.063, 12, 48);
  if (!endpoint_kandura_collar_2) {
    mesh_kandura_collar_2Geometry.scale(0.33, 0.33, 0.33);
  }
  const mesh_kandura_collar_2 = new THREE.Mesh(
    mesh_kandura_collar_2Geometry,
    materialMap["cloth-white"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_kandura_collar_2.name = "Collar band";
  if (endpoint_kandura_collar_2) {
    mesh_kandura_collar_2.position.copy(endpoint_kandura_collar_2.midpoint);
    mesh_kandura_collar_2.quaternion.copy(endpoint_kandura_collar_2.quaternion);
  }
  mesh_kandura_collar_2.castShadow = options.castShadow ?? true;
  mesh_kandura_collar_2.receiveShadow = options.receiveShadow ?? true;
  mesh_kandura_collar_2.userData.sculptComponent = {"id":"kandura-collar","name":"Collar band","material":"cloth-white"};
  node_kandura_collar_2.add(mesh_kandura_collar_2);
  meshes["kandura-collar"] = mesh_kandura_collar_2;
  colliders["kandura-collar"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["kandura-collar"] ??= [];
  destructionGroups["kandura-collar"].push(node_kandura_collar_2);

  const endpoint_kandura_placket_3 = makeAttachmentEndpoint(null);
  const node_kandura_placket_3 = new THREE.Group();
  node_kandura_placket_3.name = "Placket__pivot";
  node_kandura_placket_3.scale.set(1, 1, 1);
  if (endpoint_kandura_placket_3) {
    node_kandura_placket_3.position.copy(endpoint_kandura_placket_3.start);
    node_kandura_placket_3.rotation.set(-0.08, 0.0, 0.0);
  } else {
    node_kandura_placket_3.position.set(0.0, 0.955, 0.262);
    node_kandura_placket_3.rotation.set(-0.08, 0.0, 0.0);
  }
  node_kandura_placket_3.userData.sculptComponent = {"id":"kandura-placket","name":"Placket","material":"cloth-white"};
  node_kandura_placket_3.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["kandura"] ?? root).add(node_kandura_placket_3);
  nodes["kandura-placket"] = node_kandura_placket_3;
  const mesh_kandura_placket_3Geometry = endpoint_kandura_placket_3
    ? new THREE.CylinderGeometry(endpoint_kandura_placket_3.endRadius, endpoint_kandura_placket_3.baseRadius, endpoint_kandura_placket_3.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_kandura_placket_3) {
    mesh_kandura_placket_3Geometry.scale(0.045, 0.24, 0.02);
  }
  const mesh_kandura_placket_3 = new THREE.Mesh(
    mesh_kandura_placket_3Geometry,
    materialMap["cloth-white"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_kandura_placket_3.name = "Placket";
  if (endpoint_kandura_placket_3) {
    mesh_kandura_placket_3.position.copy(endpoint_kandura_placket_3.midpoint);
    mesh_kandura_placket_3.quaternion.copy(endpoint_kandura_placket_3.quaternion);
  }
  mesh_kandura_placket_3.castShadow = options.castShadow ?? true;
  mesh_kandura_placket_3.receiveShadow = options.receiveShadow ?? true;
  mesh_kandura_placket_3.userData.sculptComponent = {"id":"kandura-placket","name":"Placket","material":"cloth-white"};
  node_kandura_placket_3.add(mesh_kandura_placket_3);
  meshes["kandura-placket"] = mesh_kandura_placket_3;
  colliders["kandura-placket"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["kandura-placket"] ??= [];
  destructionGroups["kandura-placket"].push(node_kandura_placket_3);

  const attachment_tassel_4 = {"parentSocket": "kandura-placket-socket", "localStart": [0, -0.11, 0.014], "localEnd": [0, -0.22, 0.028], "contactType": "butt", "baseRadius": 0.012, "endRadius": 0.026, "embedDepth": 0.0072, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_tassel_4 = makeAttachmentEndpoint(attachment_tassel_4);
  const node_tassel_4 = new THREE.Group();
  node_tassel_4.name = "Tassel (tarboosh)__pivot";
  node_tassel_4.scale.set(1, 1, 1);
  if (endpoint_tassel_4) {
    node_tassel_4.position.copy(endpoint_tassel_4.start);
    node_tassel_4.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_tassel_4.position.set(0.0, -0.11, 0.014);
    node_tassel_4.rotation.set(0.0, 0.0, 0.0);
  }
  node_tassel_4.userData.sculptComponent = {"id":"tassel","name":"Tassel (tarboosh)","material":"cloth-white"};
  node_tassel_4.userData.actionProfile = {"animationRole":"secondary","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["kandura-placket"] ?? root).add(node_tassel_4);
  nodes["tassel"] = node_tassel_4;
  const mesh_tassel_4Geometry = endpoint_tassel_4
    ? new THREE.CylinderGeometry(endpoint_tassel_4.endRadius, endpoint_tassel_4.baseRadius, endpoint_tassel_4.length, 16, 6)
    : new THREE.ConeGeometry(0.5, 1, 24, 1);
  if (!endpoint_tassel_4) {
    mesh_tassel_4Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_tassel_4 = new THREE.Mesh(
    mesh_tassel_4Geometry,
    materialMap["cloth-white"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_tassel_4.name = "Tassel (tarboosh)";
  if (endpoint_tassel_4) {
    mesh_tassel_4.position.copy(endpoint_tassel_4.midpoint);
    mesh_tassel_4.quaternion.copy(endpoint_tassel_4.quaternion);
  }
  mesh_tassel_4.castShadow = options.castShadow ?? true;
  mesh_tassel_4.receiveShadow = options.receiveShadow ?? true;
  mesh_tassel_4.userData.sculptComponent = {"id":"tassel","name":"Tassel (tarboosh)","material":"cloth-white"};
  node_tassel_4.add(mesh_tassel_4);
  meshes["tassel"] = mesh_tassel_4;
  colliders["tassel"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["tassel"] ??= [];
  destructionGroups["tassel"].push(node_tassel_4);

  const endpoint_neck_5 = makeAttachmentEndpoint(null);
  const node_neck_5 = new THREE.Group();
  node_neck_5.name = "Neck__pivot";
  node_neck_5.scale.set(1, 1, 1);
  if (endpoint_neck_5) {
    node_neck_5.position.copy(endpoint_neck_5.start);
    node_neck_5.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_neck_5.position.set(0.0, 1.14, 0.0);
    node_neck_5.rotation.set(0.0, 0.0, 0.0);
  }
  node_neck_5.userData.sculptComponent = {"id":"neck","name":"Neck","material":"gold-skin"};
  node_neck_5.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["kandura"] ?? root).add(node_neck_5);
  nodes["neck"] = node_neck_5;
  const mesh_neck_5Geometry = endpoint_neck_5
    ? new THREE.CylinderGeometry(endpoint_neck_5.endRadius, endpoint_neck_5.baseRadius, endpoint_neck_5.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_neck_5) {
    mesh_neck_5Geometry.scale(0.22, 0.14, 0.2);
  }
  const mesh_neck_5 = new THREE.Mesh(
    mesh_neck_5Geometry,
    materialMap["gold-skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_neck_5.name = "Neck";
  if (endpoint_neck_5) {
    mesh_neck_5.position.copy(endpoint_neck_5.midpoint);
    mesh_neck_5.quaternion.copy(endpoint_neck_5.quaternion);
  }
  mesh_neck_5.castShadow = options.castShadow ?? true;
  mesh_neck_5.receiveShadow = options.receiveShadow ?? true;
  mesh_neck_5.userData.sculptComponent = {"id":"neck","name":"Neck","material":"gold-skin"};
  node_neck_5.add(mesh_neck_5);
  meshes["neck"] = mesh_neck_5;
  colliders["neck"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["neck"] ??= [];
  destructionGroups["neck"].push(node_neck_5);

  const endpoint_head_6 = makeAttachmentEndpoint(null);
  const node_head_6 = new THREE.Group();
  node_head_6.name = "Head (cranium)__pivot";
  node_head_6.scale.set(1, 1, 1);
  if (endpoint_head_6) {
    node_head_6.position.copy(endpoint_head_6.start);
    node_head_6.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_head_6.position.set(0.0, 0.36, 0.0);
    node_head_6.rotation.set(0.0, 0.0, 0.0);
  }
  node_head_6.userData.sculptComponent = {"id":"head","name":"Head (cranium)","material":"gold-skin"};
  node_head_6.userData.actionProfile = {"animationRole":"head","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["neck"] ?? root).add(node_head_6);
  nodes["head"] = node_head_6;
  const mesh_head_6Geometry = endpoint_head_6
    ? new THREE.CylinderGeometry(endpoint_head_6.endRadius, endpoint_head_6.baseRadius, endpoint_head_6.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_head_6) {
    mesh_head_6Geometry.scale(0.66, 0.58, 0.57);
  }
  const mesh_head_6 = new THREE.Mesh(
    mesh_head_6Geometry,
    materialMap["gold-skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_head_6.name = "Head (cranium)";
  if (endpoint_head_6) {
    mesh_head_6.position.copy(endpoint_head_6.midpoint);
    mesh_head_6.quaternion.copy(endpoint_head_6.quaternion);
  }
  mesh_head_6.castShadow = options.castShadow ?? true;
  mesh_head_6.receiveShadow = options.receiveShadow ?? true;
  mesh_head_6.userData.sculptComponent = {"id":"head","name":"Head (cranium)","material":"gold-skin"};
  node_head_6.add(mesh_head_6);
  meshes["head"] = mesh_head_6;
  colliders["head"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["head"] ??= [];
  destructionGroups["head"].push(node_head_6);

  const endpoint_muzzle_7 = makeAttachmentEndpoint(null);
  const node_muzzle_7 = new THREE.Group();
  node_muzzle_7.name = "Muzzle__pivot";
  node_muzzle_7.scale.set(1, 1, 1);
  if (endpoint_muzzle_7) {
    node_muzzle_7.position.copy(endpoint_muzzle_7.start);
    node_muzzle_7.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_muzzle_7.position.set(0.0, -0.19, 0.17);
    node_muzzle_7.rotation.set(0.0, 0.0, 0.0);
  }
  node_muzzle_7.userData.sculptComponent = {"id":"muzzle","name":"Muzzle","material":"gold-skin"};
  node_muzzle_7.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["head"] ?? root).add(node_muzzle_7);
  nodes["muzzle"] = node_muzzle_7;
  const mesh_muzzle_7Geometry = endpoint_muzzle_7
    ? new THREE.CylinderGeometry(endpoint_muzzle_7.endRadius, endpoint_muzzle_7.baseRadius, endpoint_muzzle_7.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_muzzle_7) {
    mesh_muzzle_7Geometry.scale(0.54, 0.3, 0.4);
  }
  const mesh_muzzle_7 = new THREE.Mesh(
    mesh_muzzle_7Geometry,
    materialMap["gold-skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_muzzle_7.name = "Muzzle";
  if (endpoint_muzzle_7) {
    mesh_muzzle_7.position.copy(endpoint_muzzle_7.midpoint);
    mesh_muzzle_7.quaternion.copy(endpoint_muzzle_7.quaternion);
  }
  mesh_muzzle_7.castShadow = options.castShadow ?? true;
  mesh_muzzle_7.receiveShadow = options.receiveShadow ?? true;
  mesh_muzzle_7.userData.sculptComponent = {"id":"muzzle","name":"Muzzle","material":"gold-skin"};
  node_muzzle_7.add(mesh_muzzle_7);
  meshes["muzzle"] = mesh_muzzle_7;
  colliders["muzzle"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["muzzle"] ??= [];
  destructionGroups["muzzle"].push(node_muzzle_7);

  const endpoint_cheek_r_8 = makeAttachmentEndpoint(null);
  const node_cheek_r_8 = new THREE.Group();
  node_cheek_r_8.name = "Cheek R__pivot";
  node_cheek_r_8.scale.set(1, 1, 1);
  if (endpoint_cheek_r_8) {
    node_cheek_r_8.position.copy(endpoint_cheek_r_8.start);
    node_cheek_r_8.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_cheek_r_8.position.set(-0.21, -0.13, 0.13);
    node_cheek_r_8.rotation.set(0.0, 0.0, 0.0);
  }
  node_cheek_r_8.userData.sculptComponent = {"id":"cheek-r","name":"Cheek R","material":"gold-skin"};
  node_cheek_r_8.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["head"] ?? root).add(node_cheek_r_8);
  nodes["cheek-r"] = node_cheek_r_8;
  const mesh_cheek_r_8Geometry = endpoint_cheek_r_8
    ? new THREE.CylinderGeometry(endpoint_cheek_r_8.endRadius, endpoint_cheek_r_8.baseRadius, endpoint_cheek_r_8.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_cheek_r_8) {
    mesh_cheek_r_8Geometry.scale(0.24, 0.21, 0.21);
  }
  const mesh_cheek_r_8 = new THREE.Mesh(
    mesh_cheek_r_8Geometry,
    materialMap["gold-skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_cheek_r_8.name = "Cheek R";
  if (endpoint_cheek_r_8) {
    mesh_cheek_r_8.position.copy(endpoint_cheek_r_8.midpoint);
    mesh_cheek_r_8.quaternion.copy(endpoint_cheek_r_8.quaternion);
  }
  mesh_cheek_r_8.castShadow = options.castShadow ?? true;
  mesh_cheek_r_8.receiveShadow = options.receiveShadow ?? true;
  mesh_cheek_r_8.userData.sculptComponent = {"id":"cheek-r","name":"Cheek R","material":"gold-skin"};
  node_cheek_r_8.add(mesh_cheek_r_8);
  meshes["cheek-r"] = mesh_cheek_r_8;
  colliders["cheek-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["cheek-r"] ??= [];
  destructionGroups["cheek-r"].push(node_cheek_r_8);

  const attachment_ear_r_9 = {"parentSocket": "head-socket", "localStart": [-0.27, 0.08, -0.04], "localEnd": [-0.34, 0.2, -0.1], "contactType": "embed", "baseRadius": 0.045, "endRadius": 0.006, "embedDepth": 0.027, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_ear_r_9 = makeAttachmentEndpoint(attachment_ear_r_9);
  const node_ear_r_9 = new THREE.Group();
  node_ear_r_9.name = "Ear R__pivot";
  node_ear_r_9.scale.set(1, 1, 1);
  if (endpoint_ear_r_9) {
    node_ear_r_9.position.copy(endpoint_ear_r_9.start);
    node_ear_r_9.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_ear_r_9.position.set(-0.27, 0.08, -0.04);
    node_ear_r_9.rotation.set(0.0, 0.0, 0.0);
  }
  node_ear_r_9.userData.sculptComponent = {"id":"ear-r","name":"Ear R","material":"gold-skin"};
  node_ear_r_9.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["head"] ?? root).add(node_ear_r_9);
  nodes["ear-r"] = node_ear_r_9;
  const mesh_ear_r_9Geometry = endpoint_ear_r_9
    ? new THREE.CylinderGeometry(endpoint_ear_r_9.endRadius, endpoint_ear_r_9.baseRadius, endpoint_ear_r_9.length, 16, 6)
    : new THREE.ConeGeometry(0.5, 1, 24, 1);
  if (!endpoint_ear_r_9) {
    mesh_ear_r_9Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_ear_r_9 = new THREE.Mesh(
    mesh_ear_r_9Geometry,
    materialMap["gold-skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_ear_r_9.name = "Ear R";
  if (endpoint_ear_r_9) {
    mesh_ear_r_9.position.copy(endpoint_ear_r_9.midpoint);
    mesh_ear_r_9.quaternion.copy(endpoint_ear_r_9.quaternion);
  }
  mesh_ear_r_9.castShadow = options.castShadow ?? true;
  mesh_ear_r_9.receiveShadow = options.receiveShadow ?? true;
  mesh_ear_r_9.userData.sculptComponent = {"id":"ear-r","name":"Ear R","material":"gold-skin"};
  node_ear_r_9.add(mesh_ear_r_9);
  meshes["ear-r"] = mesh_ear_r_9;
  colliders["ear-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["ear-r"] ??= [];
  destructionGroups["ear-r"].push(node_ear_r_9);

  const endpoint_cheek_l_10 = makeAttachmentEndpoint(null);
  const node_cheek_l_10 = new THREE.Group();
  node_cheek_l_10.name = "Cheek L__pivot";
  node_cheek_l_10.scale.set(1, 1, 1);
  if (endpoint_cheek_l_10) {
    node_cheek_l_10.position.copy(endpoint_cheek_l_10.start);
    node_cheek_l_10.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_cheek_l_10.position.set(0.21, -0.13, 0.13);
    node_cheek_l_10.rotation.set(0.0, 0.0, 0.0);
  }
  node_cheek_l_10.userData.sculptComponent = {"id":"cheek-l","name":"Cheek L","material":"gold-skin"};
  node_cheek_l_10.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["head"] ?? root).add(node_cheek_l_10);
  nodes["cheek-l"] = node_cheek_l_10;
  const mesh_cheek_l_10Geometry = endpoint_cheek_l_10
    ? new THREE.CylinderGeometry(endpoint_cheek_l_10.endRadius, endpoint_cheek_l_10.baseRadius, endpoint_cheek_l_10.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_cheek_l_10) {
    mesh_cheek_l_10Geometry.scale(0.24, 0.21, 0.21);
  }
  const mesh_cheek_l_10 = new THREE.Mesh(
    mesh_cheek_l_10Geometry,
    materialMap["gold-skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_cheek_l_10.name = "Cheek L";
  if (endpoint_cheek_l_10) {
    mesh_cheek_l_10.position.copy(endpoint_cheek_l_10.midpoint);
    mesh_cheek_l_10.quaternion.copy(endpoint_cheek_l_10.quaternion);
  }
  mesh_cheek_l_10.castShadow = options.castShadow ?? true;
  mesh_cheek_l_10.receiveShadow = options.receiveShadow ?? true;
  mesh_cheek_l_10.userData.sculptComponent = {"id":"cheek-l","name":"Cheek L","material":"gold-skin"};
  node_cheek_l_10.add(mesh_cheek_l_10);
  meshes["cheek-l"] = mesh_cheek_l_10;
  colliders["cheek-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["cheek-l"] ??= [];
  destructionGroups["cheek-l"].push(node_cheek_l_10);

  const attachment_ear_l_11 = {"parentSocket": "head-socket", "localStart": [0.27, 0.08, -0.04], "localEnd": [0.34, 0.2, -0.1], "contactType": "embed", "baseRadius": 0.045, "endRadius": 0.006, "embedDepth": 0.027, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_ear_l_11 = makeAttachmentEndpoint(attachment_ear_l_11);
  const node_ear_l_11 = new THREE.Group();
  node_ear_l_11.name = "Ear L__pivot";
  node_ear_l_11.scale.set(1, 1, 1);
  if (endpoint_ear_l_11) {
    node_ear_l_11.position.copy(endpoint_ear_l_11.start);
    node_ear_l_11.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_ear_l_11.position.set(0.27, 0.08, -0.04);
    node_ear_l_11.rotation.set(0.0, 0.0, 0.0);
  }
  node_ear_l_11.userData.sculptComponent = {"id":"ear-l","name":"Ear L","material":"gold-skin"};
  node_ear_l_11.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["head"] ?? root).add(node_ear_l_11);
  nodes["ear-l"] = node_ear_l_11;
  const mesh_ear_l_11Geometry = endpoint_ear_l_11
    ? new THREE.CylinderGeometry(endpoint_ear_l_11.endRadius, endpoint_ear_l_11.baseRadius, endpoint_ear_l_11.length, 16, 6)
    : new THREE.ConeGeometry(0.5, 1, 24, 1);
  if (!endpoint_ear_l_11) {
    mesh_ear_l_11Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_ear_l_11 = new THREE.Mesh(
    mesh_ear_l_11Geometry,
    materialMap["gold-skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_ear_l_11.name = "Ear L";
  if (endpoint_ear_l_11) {
    mesh_ear_l_11.position.copy(endpoint_ear_l_11.midpoint);
    mesh_ear_l_11.quaternion.copy(endpoint_ear_l_11.quaternion);
  }
  mesh_ear_l_11.castShadow = options.castShadow ?? true;
  mesh_ear_l_11.receiveShadow = options.receiveShadow ?? true;
  mesh_ear_l_11.userData.sculptComponent = {"id":"ear-l","name":"Ear L","material":"gold-skin"};
  node_ear_l_11.add(mesh_ear_l_11);
  meshes["ear-l"] = mesh_ear_l_11;
  colliders["ear-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["ear-l"] ??= [];
  destructionGroups["ear-l"].push(node_ear_l_11);

  const endpoint_brow_12 = makeAttachmentEndpoint(null);
  const node_brow_12 = new THREE.Group();
  node_brow_12.name = "Brow ridge__pivot";
  node_brow_12.scale.set(1, 1, 1);
  if (endpoint_brow_12) {
    node_brow_12.position.copy(endpoint_brow_12.start);
    node_brow_12.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_brow_12.position.set(0.0, 0.06, 0.19);
    node_brow_12.rotation.set(0.0, 0.0, 0.0);
  }
  node_brow_12.userData.sculptComponent = {"id":"brow","name":"Brow ridge","material":"gold-skin"};
  node_brow_12.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["head"] ?? root).add(node_brow_12);
  nodes["brow"] = node_brow_12;
  const mesh_brow_12Geometry = endpoint_brow_12
    ? new THREE.CylinderGeometry(endpoint_brow_12.endRadius, endpoint_brow_12.baseRadius, endpoint_brow_12.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_brow_12) {
    mesh_brow_12Geometry.scale(0.42, 0.07, 0.1);
  }
  const mesh_brow_12 = new THREE.Mesh(
    mesh_brow_12Geometry,
    materialMap["gold-skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_brow_12.name = "Brow ridge";
  if (endpoint_brow_12) {
    mesh_brow_12.position.copy(endpoint_brow_12.midpoint);
    mesh_brow_12.quaternion.copy(endpoint_brow_12.quaternion);
  }
  mesh_brow_12.castShadow = options.castShadow ?? true;
  mesh_brow_12.receiveShadow = options.receiveShadow ?? true;
  mesh_brow_12.userData.sculptComponent = {"id":"brow","name":"Brow ridge","material":"gold-skin"};
  node_brow_12.add(mesh_brow_12);
  meshes["brow"] = mesh_brow_12;
  colliders["brow"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["brow"] ??= [];
  destructionGroups["brow"].push(node_brow_12);

  const endpoint_eye_r_13 = makeAttachmentEndpoint(null);
  const node_eye_r_13 = new THREE.Group();
  node_eye_r_13.name = "Eye R__pivot";
  node_eye_r_13.scale.set(1, 1, 1);
  if (endpoint_eye_r_13) {
    node_eye_r_13.position.copy(endpoint_eye_r_13.start);
    node_eye_r_13.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_eye_r_13.position.set(-0.165, -0.02, 0.235);
    node_eye_r_13.rotation.set(0.0, 0.0, 0.0);
  }
  node_eye_r_13.userData.sculptComponent = {"id":"eye-r","name":"Eye R","material":"eye-white"};
  node_eye_r_13.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["head"] ?? root).add(node_eye_r_13);
  nodes["eye-r"] = node_eye_r_13;
  const mesh_eye_r_13Geometry = endpoint_eye_r_13
    ? new THREE.CylinderGeometry(endpoint_eye_r_13.endRadius, endpoint_eye_r_13.baseRadius, endpoint_eye_r_13.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_eye_r_13) {
    mesh_eye_r_13Geometry.scale(0.15, 0.17, 0.12);
  }
  const mesh_eye_r_13 = new THREE.Mesh(
    mesh_eye_r_13Geometry,
    materialMap["eye-white"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_eye_r_13.name = "Eye R";
  if (endpoint_eye_r_13) {
    mesh_eye_r_13.position.copy(endpoint_eye_r_13.midpoint);
    mesh_eye_r_13.quaternion.copy(endpoint_eye_r_13.quaternion);
  }
  mesh_eye_r_13.castShadow = options.castShadow ?? true;
  mesh_eye_r_13.receiveShadow = options.receiveShadow ?? true;
  mesh_eye_r_13.userData.sculptComponent = {"id":"eye-r","name":"Eye R","material":"eye-white"};
  node_eye_r_13.add(mesh_eye_r_13);
  meshes["eye-r"] = mesh_eye_r_13;
  colliders["eye-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["eye-r"] ??= [];
  destructionGroups["eye-r"].push(node_eye_r_13);

  const endpoint_eyelid_r_14 = makeAttachmentEndpoint(null);
  const node_eyelid_r_14 = new THREE.Group();
  node_eyelid_r_14.name = "Upper eyelid R__pivot";
  node_eyelid_r_14.scale.set(1, 1, 1);
  if (endpoint_eyelid_r_14) {
    node_eyelid_r_14.position.copy(endpoint_eyelid_r_14.start);
    node_eyelid_r_14.rotation.set(0.25, 0.0, -0.24);
  } else {
    node_eyelid_r_14.position.set(-0.1683, 0.048, 0.245);
    node_eyelid_r_14.rotation.set(0.25, 0.0, -0.24);
  }
  node_eyelid_r_14.userData.sculptComponent = {"id":"eyelid-r","name":"Upper eyelid R","material":"gold-skin"};
  node_eyelid_r_14.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["head"] ?? root).add(node_eyelid_r_14);
  nodes["eyelid-r"] = node_eyelid_r_14;
  const mesh_eyelid_r_14Geometry = endpoint_eyelid_r_14
    ? new THREE.CylinderGeometry(endpoint_eyelid_r_14.endRadius, endpoint_eyelid_r_14.baseRadius, endpoint_eyelid_r_14.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_eyelid_r_14) {
    mesh_eyelid_r_14Geometry.scale(0.18, 0.07, 0.15);
  }
  const mesh_eyelid_r_14 = new THREE.Mesh(
    mesh_eyelid_r_14Geometry,
    materialMap["gold-skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_eyelid_r_14.name = "Upper eyelid R";
  if (endpoint_eyelid_r_14) {
    mesh_eyelid_r_14.position.copy(endpoint_eyelid_r_14.midpoint);
    mesh_eyelid_r_14.quaternion.copy(endpoint_eyelid_r_14.quaternion);
  }
  mesh_eyelid_r_14.castShadow = options.castShadow ?? true;
  mesh_eyelid_r_14.receiveShadow = options.receiveShadow ?? true;
  mesh_eyelid_r_14.userData.sculptComponent = {"id":"eyelid-r","name":"Upper eyelid R","material":"gold-skin"};
  node_eyelid_r_14.add(mesh_eyelid_r_14);
  meshes["eyelid-r"] = mesh_eyelid_r_14;
  colliders["eyelid-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["eyelid-r"] ??= [];
  destructionGroups["eyelid-r"].push(node_eyelid_r_14);

  const endpoint_iris_r_15 = makeAttachmentEndpoint(null);
  const node_iris_r_15 = new THREE.Group();
  node_iris_r_15.name = "Iris R__pivot";
  node_iris_r_15.scale.set(1, 1, 1);
  if (endpoint_iris_r_15) {
    node_iris_r_15.position.copy(endpoint_iris_r_15.start);
    node_iris_r_15.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_iris_r_15.position.set(0.0033, -0.005, 0.05);
    node_iris_r_15.rotation.set(0.0, 0.0, 0.0);
  }
  node_iris_r_15.userData.sculptComponent = {"id":"iris-r","name":"Iris R","material":"iris-teal"};
  node_iris_r_15.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["eye-r"] ?? root).add(node_iris_r_15);
  nodes["iris-r"] = node_iris_r_15;
  const mesh_iris_r_15Geometry = endpoint_iris_r_15
    ? new THREE.CylinderGeometry(endpoint_iris_r_15.endRadius, endpoint_iris_r_15.baseRadius, endpoint_iris_r_15.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_iris_r_15) {
    mesh_iris_r_15Geometry.scale(0.105, 0.12, 0.03);
  }
  const mesh_iris_r_15 = new THREE.Mesh(
    mesh_iris_r_15Geometry,
    materialMap["iris-teal"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_iris_r_15.name = "Iris R";
  if (endpoint_iris_r_15) {
    mesh_iris_r_15.position.copy(endpoint_iris_r_15.midpoint);
    mesh_iris_r_15.quaternion.copy(endpoint_iris_r_15.quaternion);
  }
  mesh_iris_r_15.castShadow = options.castShadow ?? true;
  mesh_iris_r_15.receiveShadow = options.receiveShadow ?? true;
  mesh_iris_r_15.userData.sculptComponent = {"id":"iris-r","name":"Iris R","material":"iris-teal"};
  node_iris_r_15.add(mesh_iris_r_15);
  meshes["iris-r"] = mesh_iris_r_15;
  colliders["iris-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["iris-r"] ??= [];
  destructionGroups["iris-r"].push(node_iris_r_15);

  const endpoint_pupil_r_16 = makeAttachmentEndpoint(null);
  const node_pupil_r_16 = new THREE.Group();
  node_pupil_r_16.name = "Pupil R__pivot";
  node_pupil_r_16.scale.set(1, 1, 1);
  if (endpoint_pupil_r_16) {
    node_pupil_r_16.position.copy(endpoint_pupil_r_16.start);
    node_pupil_r_16.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_pupil_r_16.position.set(0.0017, -0.003, 0.013);
    node_pupil_r_16.rotation.set(0.0, 0.0, 0.0);
  }
  node_pupil_r_16.userData.sculptComponent = {"id":"pupil-r","name":"Pupil R","material":"pupil-navy"};
  node_pupil_r_16.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["iris-r"] ?? root).add(node_pupil_r_16);
  nodes["pupil-r"] = node_pupil_r_16;
  const mesh_pupil_r_16Geometry = endpoint_pupil_r_16
    ? new THREE.CylinderGeometry(endpoint_pupil_r_16.endRadius, endpoint_pupil_r_16.baseRadius, endpoint_pupil_r_16.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_pupil_r_16) {
    mesh_pupil_r_16Geometry.scale(0.05, 0.065, 0.012);
  }
  const mesh_pupil_r_16 = new THREE.Mesh(
    mesh_pupil_r_16Geometry,
    materialMap["pupil-navy"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_pupil_r_16.name = "Pupil R";
  if (endpoint_pupil_r_16) {
    mesh_pupil_r_16.position.copy(endpoint_pupil_r_16.midpoint);
    mesh_pupil_r_16.quaternion.copy(endpoint_pupil_r_16.quaternion);
  }
  mesh_pupil_r_16.castShadow = options.castShadow ?? true;
  mesh_pupil_r_16.receiveShadow = options.receiveShadow ?? true;
  mesh_pupil_r_16.userData.sculptComponent = {"id":"pupil-r","name":"Pupil R","material":"pupil-navy"};
  node_pupil_r_16.add(mesh_pupil_r_16);
  meshes["pupil-r"] = mesh_pupil_r_16;
  colliders["pupil-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["pupil-r"] ??= [];
  destructionGroups["pupil-r"].push(node_pupil_r_16);

  const endpoint_catchlight_1_17 = makeAttachmentEndpoint(null);
  const node_catchlight_1_17 = new THREE.Group();
  node_catchlight_1_17.name = "Catch-light R__pivot";
  node_catchlight_1_17.scale.set(1, 1, 1);
  if (endpoint_catchlight_1_17) {
    node_catchlight_1_17.position.copy(endpoint_catchlight_1_17.start);
    node_catchlight_1_17.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_catchlight_1_17.position.set(0.018, 0.03, 0.007);
    node_catchlight_1_17.rotation.set(0.0, 0.0, 0.0);
  }
  node_catchlight_1_17.userData.sculptComponent = {"id":"catchlight-1","name":"Catch-light R","material":"catchlight"};
  node_catchlight_1_17.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["pupil-r"] ?? root).add(node_catchlight_1_17);
  nodes["catchlight-1"] = node_catchlight_1_17;
  const mesh_catchlight_1_17Geometry = endpoint_catchlight_1_17
    ? new THREE.CylinderGeometry(endpoint_catchlight_1_17.endRadius, endpoint_catchlight_1_17.baseRadius, endpoint_catchlight_1_17.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_catchlight_1_17) {
    mesh_catchlight_1_17Geometry.scale(0.022, 0.022, 0.008);
  }
  const mesh_catchlight_1_17 = new THREE.Mesh(
    mesh_catchlight_1_17Geometry,
    materialMap["catchlight"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_catchlight_1_17.name = "Catch-light R";
  if (endpoint_catchlight_1_17) {
    mesh_catchlight_1_17.position.copy(endpoint_catchlight_1_17.midpoint);
    mesh_catchlight_1_17.quaternion.copy(endpoint_catchlight_1_17.quaternion);
  }
  mesh_catchlight_1_17.castShadow = options.castShadow ?? true;
  mesh_catchlight_1_17.receiveShadow = options.receiveShadow ?? true;
  mesh_catchlight_1_17.userData.sculptComponent = {"id":"catchlight-1","name":"Catch-light R","material":"catchlight"};
  node_catchlight_1_17.add(mesh_catchlight_1_17);
  meshes["catchlight-1"] = mesh_catchlight_1_17;
  colliders["catchlight-1"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["catchlight-1"] ??= [];
  destructionGroups["catchlight-1"].push(node_catchlight_1_17);

  const endpoint_eye_l_18 = makeAttachmentEndpoint(null);
  const node_eye_l_18 = new THREE.Group();
  node_eye_l_18.name = "Eye L__pivot";
  node_eye_l_18.scale.set(1, 1, 1);
  if (endpoint_eye_l_18) {
    node_eye_l_18.position.copy(endpoint_eye_l_18.start);
    node_eye_l_18.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_eye_l_18.position.set(0.165, -0.02, 0.235);
    node_eye_l_18.rotation.set(0.0, 0.0, 0.0);
  }
  node_eye_l_18.userData.sculptComponent = {"id":"eye-l","name":"Eye L","material":"eye-white"};
  node_eye_l_18.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["head"] ?? root).add(node_eye_l_18);
  nodes["eye-l"] = node_eye_l_18;
  const mesh_eye_l_18Geometry = endpoint_eye_l_18
    ? new THREE.CylinderGeometry(endpoint_eye_l_18.endRadius, endpoint_eye_l_18.baseRadius, endpoint_eye_l_18.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_eye_l_18) {
    mesh_eye_l_18Geometry.scale(0.15, 0.17, 0.12);
  }
  const mesh_eye_l_18 = new THREE.Mesh(
    mesh_eye_l_18Geometry,
    materialMap["eye-white"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_eye_l_18.name = "Eye L";
  if (endpoint_eye_l_18) {
    mesh_eye_l_18.position.copy(endpoint_eye_l_18.midpoint);
    mesh_eye_l_18.quaternion.copy(endpoint_eye_l_18.quaternion);
  }
  mesh_eye_l_18.castShadow = options.castShadow ?? true;
  mesh_eye_l_18.receiveShadow = options.receiveShadow ?? true;
  mesh_eye_l_18.userData.sculptComponent = {"id":"eye-l","name":"Eye L","material":"eye-white"};
  node_eye_l_18.add(mesh_eye_l_18);
  meshes["eye-l"] = mesh_eye_l_18;
  colliders["eye-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["eye-l"] ??= [];
  destructionGroups["eye-l"].push(node_eye_l_18);

  const endpoint_eyelid_l_19 = makeAttachmentEndpoint(null);
  const node_eyelid_l_19 = new THREE.Group();
  node_eyelid_l_19.name = "Upper eyelid L__pivot";
  node_eyelid_l_19.scale.set(1, 1, 1);
  if (endpoint_eyelid_l_19) {
    node_eyelid_l_19.position.copy(endpoint_eyelid_l_19.start);
    node_eyelid_l_19.rotation.set(0.25, 0.0, 0.24);
  } else {
    node_eyelid_l_19.position.set(0.1683, 0.048, 0.245);
    node_eyelid_l_19.rotation.set(0.25, 0.0, 0.24);
  }
  node_eyelid_l_19.userData.sculptComponent = {"id":"eyelid-l","name":"Upper eyelid L","material":"gold-skin"};
  node_eyelid_l_19.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["head"] ?? root).add(node_eyelid_l_19);
  nodes["eyelid-l"] = node_eyelid_l_19;
  const mesh_eyelid_l_19Geometry = endpoint_eyelid_l_19
    ? new THREE.CylinderGeometry(endpoint_eyelid_l_19.endRadius, endpoint_eyelid_l_19.baseRadius, endpoint_eyelid_l_19.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_eyelid_l_19) {
    mesh_eyelid_l_19Geometry.scale(0.18, 0.07, 0.15);
  }
  const mesh_eyelid_l_19 = new THREE.Mesh(
    mesh_eyelid_l_19Geometry,
    materialMap["gold-skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_eyelid_l_19.name = "Upper eyelid L";
  if (endpoint_eyelid_l_19) {
    mesh_eyelid_l_19.position.copy(endpoint_eyelid_l_19.midpoint);
    mesh_eyelid_l_19.quaternion.copy(endpoint_eyelid_l_19.quaternion);
  }
  mesh_eyelid_l_19.castShadow = options.castShadow ?? true;
  mesh_eyelid_l_19.receiveShadow = options.receiveShadow ?? true;
  mesh_eyelid_l_19.userData.sculptComponent = {"id":"eyelid-l","name":"Upper eyelid L","material":"gold-skin"};
  node_eyelid_l_19.add(mesh_eyelid_l_19);
  meshes["eyelid-l"] = mesh_eyelid_l_19;
  colliders["eyelid-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["eyelid-l"] ??= [];
  destructionGroups["eyelid-l"].push(node_eyelid_l_19);

  const endpoint_iris_l_20 = makeAttachmentEndpoint(null);
  const node_iris_l_20 = new THREE.Group();
  node_iris_l_20.name = "Iris L__pivot";
  node_iris_l_20.scale.set(1, 1, 1);
  if (endpoint_iris_l_20) {
    node_iris_l_20.position.copy(endpoint_iris_l_20.start);
    node_iris_l_20.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_iris_l_20.position.set(-0.0033, -0.005, 0.05);
    node_iris_l_20.rotation.set(0.0, 0.0, 0.0);
  }
  node_iris_l_20.userData.sculptComponent = {"id":"iris-l","name":"Iris L","material":"iris-teal"};
  node_iris_l_20.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["eye-l"] ?? root).add(node_iris_l_20);
  nodes["iris-l"] = node_iris_l_20;
  const mesh_iris_l_20Geometry = endpoint_iris_l_20
    ? new THREE.CylinderGeometry(endpoint_iris_l_20.endRadius, endpoint_iris_l_20.baseRadius, endpoint_iris_l_20.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_iris_l_20) {
    mesh_iris_l_20Geometry.scale(0.105, 0.12, 0.03);
  }
  const mesh_iris_l_20 = new THREE.Mesh(
    mesh_iris_l_20Geometry,
    materialMap["iris-teal"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_iris_l_20.name = "Iris L";
  if (endpoint_iris_l_20) {
    mesh_iris_l_20.position.copy(endpoint_iris_l_20.midpoint);
    mesh_iris_l_20.quaternion.copy(endpoint_iris_l_20.quaternion);
  }
  mesh_iris_l_20.castShadow = options.castShadow ?? true;
  mesh_iris_l_20.receiveShadow = options.receiveShadow ?? true;
  mesh_iris_l_20.userData.sculptComponent = {"id":"iris-l","name":"Iris L","material":"iris-teal"};
  node_iris_l_20.add(mesh_iris_l_20);
  meshes["iris-l"] = mesh_iris_l_20;
  colliders["iris-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["iris-l"] ??= [];
  destructionGroups["iris-l"].push(node_iris_l_20);

  const endpoint_pupil_l_21 = makeAttachmentEndpoint(null);
  const node_pupil_l_21 = new THREE.Group();
  node_pupil_l_21.name = "Pupil L__pivot";
  node_pupil_l_21.scale.set(1, 1, 1);
  if (endpoint_pupil_l_21) {
    node_pupil_l_21.position.copy(endpoint_pupil_l_21.start);
    node_pupil_l_21.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_pupil_l_21.position.set(-0.0017, -0.003, 0.013);
    node_pupil_l_21.rotation.set(0.0, 0.0, 0.0);
  }
  node_pupil_l_21.userData.sculptComponent = {"id":"pupil-l","name":"Pupil L","material":"pupil-navy"};
  node_pupil_l_21.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["iris-l"] ?? root).add(node_pupil_l_21);
  nodes["pupil-l"] = node_pupil_l_21;
  const mesh_pupil_l_21Geometry = endpoint_pupil_l_21
    ? new THREE.CylinderGeometry(endpoint_pupil_l_21.endRadius, endpoint_pupil_l_21.baseRadius, endpoint_pupil_l_21.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_pupil_l_21) {
    mesh_pupil_l_21Geometry.scale(0.05, 0.065, 0.012);
  }
  const mesh_pupil_l_21 = new THREE.Mesh(
    mesh_pupil_l_21Geometry,
    materialMap["pupil-navy"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_pupil_l_21.name = "Pupil L";
  if (endpoint_pupil_l_21) {
    mesh_pupil_l_21.position.copy(endpoint_pupil_l_21.midpoint);
    mesh_pupil_l_21.quaternion.copy(endpoint_pupil_l_21.quaternion);
  }
  mesh_pupil_l_21.castShadow = options.castShadow ?? true;
  mesh_pupil_l_21.receiveShadow = options.receiveShadow ?? true;
  mesh_pupil_l_21.userData.sculptComponent = {"id":"pupil-l","name":"Pupil L","material":"pupil-navy"};
  node_pupil_l_21.add(mesh_pupil_l_21);
  meshes["pupil-l"] = mesh_pupil_l_21;
  colliders["pupil-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["pupil-l"] ??= [];
  destructionGroups["pupil-l"].push(node_pupil_l_21);

  const endpoint_catchlight_2_22 = makeAttachmentEndpoint(null);
  const node_catchlight_2_22 = new THREE.Group();
  node_catchlight_2_22.name = "Catch-light L__pivot";
  node_catchlight_2_22.scale.set(1, 1, 1);
  if (endpoint_catchlight_2_22) {
    node_catchlight_2_22.position.copy(endpoint_catchlight_2_22.start);
    node_catchlight_2_22.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_catchlight_2_22.position.set(0.018, 0.03, 0.007);
    node_catchlight_2_22.rotation.set(0.0, 0.0, 0.0);
  }
  node_catchlight_2_22.userData.sculptComponent = {"id":"catchlight-2","name":"Catch-light L","material":"catchlight"};
  node_catchlight_2_22.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["pupil-l"] ?? root).add(node_catchlight_2_22);
  nodes["catchlight-2"] = node_catchlight_2_22;
  const mesh_catchlight_2_22Geometry = endpoint_catchlight_2_22
    ? new THREE.CylinderGeometry(endpoint_catchlight_2_22.endRadius, endpoint_catchlight_2_22.baseRadius, endpoint_catchlight_2_22.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_catchlight_2_22) {
    mesh_catchlight_2_22Geometry.scale(0.022, 0.022, 0.008);
  }
  const mesh_catchlight_2_22 = new THREE.Mesh(
    mesh_catchlight_2_22Geometry,
    materialMap["catchlight"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_catchlight_2_22.name = "Catch-light L";
  if (endpoint_catchlight_2_22) {
    mesh_catchlight_2_22.position.copy(endpoint_catchlight_2_22.midpoint);
    mesh_catchlight_2_22.quaternion.copy(endpoint_catchlight_2_22.quaternion);
  }
  mesh_catchlight_2_22.castShadow = options.castShadow ?? true;
  mesh_catchlight_2_22.receiveShadow = options.receiveShadow ?? true;
  mesh_catchlight_2_22.userData.sculptComponent = {"id":"catchlight-2","name":"Catch-light L","material":"catchlight"};
  node_catchlight_2_22.add(mesh_catchlight_2_22);
  meshes["catchlight-2"] = mesh_catchlight_2_22;
  colliders["catchlight-2"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["catchlight-2"] ??= [];
  destructionGroups["catchlight-2"].push(node_catchlight_2_22);

  const endpoint_crest_plate_1_23 = makeAttachmentEndpoint(null);
  const node_crest_plate_1_23 = new THREE.Group();
  node_crest_plate_1_23.name = "Crest plate 1__pivot";
  node_crest_plate_1_23.scale.set(1, 1, 1);
  if (endpoint_crest_plate_1_23) {
    node_crest_plate_1_23.position.copy(endpoint_crest_plate_1_23.start);
    node_crest_plate_1_23.rotation.set(-0.78, 0.0, 0.0);
  } else {
    node_crest_plate_1_23.position.set(-0.062, 0.205, 0.178);
    node_crest_plate_1_23.rotation.set(-0.78, 0.0, 0.0);
  }
  node_crest_plate_1_23.userData.sculptComponent = {"id":"crest-plate-1","name":"Crest plate 1","material":"crest-mint"};
  node_crest_plate_1_23.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["head"] ?? root).add(node_crest_plate_1_23);
  nodes["crest-plate-1"] = node_crest_plate_1_23;
  const mesh_crest_plate_1_23Geometry = endpoint_crest_plate_1_23
    ? new THREE.CylinderGeometry(endpoint_crest_plate_1_23.endRadius, endpoint_crest_plate_1_23.baseRadius, endpoint_crest_plate_1_23.length, 16, 6)
    : buildExtrudeGeometry({"points": [[0.046, 0.022], [0.0446, 0.0289], [0.0407, 0.0347], [0.0349, 0.0386], [0.028, 0.04], [-0.028, 0.04], [-0.0349, 0.0386], [-0.0407, 0.0347], [-0.0446, 0.0289], [-0.046, 0.022], [-0.046, -0.022], [-0.0446, -0.0289], [-0.0407, -0.0347], [-0.0349, -0.0386], [-0.028, -0.04], [0.028, -0.04], [0.0349, -0.0386], [0.0407, -0.0347], [0.0446, -0.0289], [0.046, -0.022]], "depth": 0.022});
  if (!endpoint_crest_plate_1_23) {
    mesh_crest_plate_1_23Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_crest_plate_1_23 = new THREE.Mesh(
    mesh_crest_plate_1_23Geometry,
    materialMap["crest-mint"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_crest_plate_1_23.name = "Crest plate 1";
  if (endpoint_crest_plate_1_23) {
    mesh_crest_plate_1_23.position.copy(endpoint_crest_plate_1_23.midpoint);
    mesh_crest_plate_1_23.quaternion.copy(endpoint_crest_plate_1_23.quaternion);
  }
  mesh_crest_plate_1_23.castShadow = options.castShadow ?? true;
  mesh_crest_plate_1_23.receiveShadow = options.receiveShadow ?? true;
  mesh_crest_plate_1_23.userData.sculptComponent = {"id":"crest-plate-1","name":"Crest plate 1","material":"crest-mint"};
  node_crest_plate_1_23.add(mesh_crest_plate_1_23);
  meshes["crest-plate-1"] = mesh_crest_plate_1_23;
  colliders["crest-plate-1"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["crest-plate-1"] ??= [];
  destructionGroups["crest-plate-1"].push(node_crest_plate_1_23);

  const endpoint_crest_plate_2_24 = makeAttachmentEndpoint(null);
  const node_crest_plate_2_24 = new THREE.Group();
  node_crest_plate_2_24.name = "Crest plate 2__pivot";
  node_crest_plate_2_24.scale.set(1, 1, 1);
  if (endpoint_crest_plate_2_24) {
    node_crest_plate_2_24.position.copy(endpoint_crest_plate_2_24.start);
    node_crest_plate_2_24.rotation.set(-0.78, 0.0, 0.0);
  } else {
    node_crest_plate_2_24.position.set(0.062, 0.205, 0.178);
    node_crest_plate_2_24.rotation.set(-0.78, 0.0, 0.0);
  }
  node_crest_plate_2_24.userData.sculptComponent = {"id":"crest-plate-2","name":"Crest plate 2","material":"crest-mint"};
  node_crest_plate_2_24.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["head"] ?? root).add(node_crest_plate_2_24);
  nodes["crest-plate-2"] = node_crest_plate_2_24;
  const mesh_crest_plate_2_24Geometry = endpoint_crest_plate_2_24
    ? new THREE.CylinderGeometry(endpoint_crest_plate_2_24.endRadius, endpoint_crest_plate_2_24.baseRadius, endpoint_crest_plate_2_24.length, 16, 6)
    : buildExtrudeGeometry({"points": [[0.046, 0.022], [0.0446, 0.0289], [0.0407, 0.0347], [0.0349, 0.0386], [0.028, 0.04], [-0.028, 0.04], [-0.0349, 0.0386], [-0.0407, 0.0347], [-0.0446, 0.0289], [-0.046, 0.022], [-0.046, -0.022], [-0.0446, -0.0289], [-0.0407, -0.0347], [-0.0349, -0.0386], [-0.028, -0.04], [0.028, -0.04], [0.0349, -0.0386], [0.0407, -0.0347], [0.0446, -0.0289], [0.046, -0.022]], "depth": 0.022});
  if (!endpoint_crest_plate_2_24) {
    mesh_crest_plate_2_24Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_crest_plate_2_24 = new THREE.Mesh(
    mesh_crest_plate_2_24Geometry,
    materialMap["crest-mint"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_crest_plate_2_24.name = "Crest plate 2";
  if (endpoint_crest_plate_2_24) {
    mesh_crest_plate_2_24.position.copy(endpoint_crest_plate_2_24.midpoint);
    mesh_crest_plate_2_24.quaternion.copy(endpoint_crest_plate_2_24.quaternion);
  }
  mesh_crest_plate_2_24.castShadow = options.castShadow ?? true;
  mesh_crest_plate_2_24.receiveShadow = options.receiveShadow ?? true;
  mesh_crest_plate_2_24.userData.sculptComponent = {"id":"crest-plate-2","name":"Crest plate 2","material":"crest-mint"};
  node_crest_plate_2_24.add(mesh_crest_plate_2_24);
  meshes["crest-plate-2"] = mesh_crest_plate_2_24;
  colliders["crest-plate-2"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["crest-plate-2"] ??= [];
  destructionGroups["crest-plate-2"].push(node_crest_plate_2_24);

  const endpoint_crest_plate_3_25 = makeAttachmentEndpoint(null);
  const node_crest_plate_3_25 = new THREE.Group();
  node_crest_plate_3_25.name = "Crest plate 3__pivot";
  node_crest_plate_3_25.scale.set(1, 1, 1);
  if (endpoint_crest_plate_3_25) {
    node_crest_plate_3_25.position.copy(endpoint_crest_plate_3_25.start);
    node_crest_plate_3_25.rotation.set(-0.4, 0.0, 0.0);
  } else {
    node_crest_plate_3_25.position.set(-0.058, 0.1, 0.252);
    node_crest_plate_3_25.rotation.set(-0.4, 0.0, 0.0);
  }
  node_crest_plate_3_25.userData.sculptComponent = {"id":"crest-plate-3","name":"Crest plate 3","material":"crest-mint"};
  node_crest_plate_3_25.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["head"] ?? root).add(node_crest_plate_3_25);
  nodes["crest-plate-3"] = node_crest_plate_3_25;
  const mesh_crest_plate_3_25Geometry = endpoint_crest_plate_3_25
    ? new THREE.CylinderGeometry(endpoint_crest_plate_3_25.endRadius, endpoint_crest_plate_3_25.baseRadius, endpoint_crest_plate_3_25.length, 16, 6)
    : buildExtrudeGeometry({"points": [[0.0525, 0.037], [0.0511, 0.0439], [0.0472, 0.0497], [0.0414, 0.0536], [0.0345, 0.055], [-0.0345, 0.055], [-0.0414, 0.0536], [-0.0472, 0.0497], [-0.0511, 0.0439], [-0.0525, 0.037], [-0.0525, -0.037], [-0.0511, -0.0439], [-0.0472, -0.0497], [-0.0414, -0.0536], [-0.0345, -0.055], [0.0345, -0.055], [0.0414, -0.0536], [0.0472, -0.0497], [0.0511, -0.0439], [0.0525, -0.037]], "depth": 0.022});
  if (!endpoint_crest_plate_3_25) {
    mesh_crest_plate_3_25Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_crest_plate_3_25 = new THREE.Mesh(
    mesh_crest_plate_3_25Geometry,
    materialMap["crest-mint"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_crest_plate_3_25.name = "Crest plate 3";
  if (endpoint_crest_plate_3_25) {
    mesh_crest_plate_3_25.position.copy(endpoint_crest_plate_3_25.midpoint);
    mesh_crest_plate_3_25.quaternion.copy(endpoint_crest_plate_3_25.quaternion);
  }
  mesh_crest_plate_3_25.castShadow = options.castShadow ?? true;
  mesh_crest_plate_3_25.receiveShadow = options.receiveShadow ?? true;
  mesh_crest_plate_3_25.userData.sculptComponent = {"id":"crest-plate-3","name":"Crest plate 3","material":"crest-mint"};
  node_crest_plate_3_25.add(mesh_crest_plate_3_25);
  meshes["crest-plate-3"] = mesh_crest_plate_3_25;
  colliders["crest-plate-3"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["crest-plate-3"] ??= [];
  destructionGroups["crest-plate-3"].push(node_crest_plate_3_25);

  const endpoint_crest_plate_4_26 = makeAttachmentEndpoint(null);
  const node_crest_plate_4_26 = new THREE.Group();
  node_crest_plate_4_26.name = "Crest plate 4__pivot";
  node_crest_plate_4_26.scale.set(1, 1, 1);
  if (endpoint_crest_plate_4_26) {
    node_crest_plate_4_26.position.copy(endpoint_crest_plate_4_26.start);
    node_crest_plate_4_26.rotation.set(-0.4, 0.0, 0.0);
  } else {
    node_crest_plate_4_26.position.set(0.058, 0.1, 0.252);
    node_crest_plate_4_26.rotation.set(-0.4, 0.0, 0.0);
  }
  node_crest_plate_4_26.userData.sculptComponent = {"id":"crest-plate-4","name":"Crest plate 4","material":"crest-mint"};
  node_crest_plate_4_26.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["head"] ?? root).add(node_crest_plate_4_26);
  nodes["crest-plate-4"] = node_crest_plate_4_26;
  const mesh_crest_plate_4_26Geometry = endpoint_crest_plate_4_26
    ? new THREE.CylinderGeometry(endpoint_crest_plate_4_26.endRadius, endpoint_crest_plate_4_26.baseRadius, endpoint_crest_plate_4_26.length, 16, 6)
    : buildExtrudeGeometry({"points": [[0.0525, 0.037], [0.0511, 0.0439], [0.0472, 0.0497], [0.0414, 0.0536], [0.0345, 0.055], [-0.0345, 0.055], [-0.0414, 0.0536], [-0.0472, 0.0497], [-0.0511, 0.0439], [-0.0525, 0.037], [-0.0525, -0.037], [-0.0511, -0.0439], [-0.0472, -0.0497], [-0.0414, -0.0536], [-0.0345, -0.055], [0.0345, -0.055], [0.0414, -0.0536], [0.0472, -0.0497], [0.0511, -0.0439], [0.0525, -0.037]], "depth": 0.022});
  if (!endpoint_crest_plate_4_26) {
    mesh_crest_plate_4_26Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_crest_plate_4_26 = new THREE.Mesh(
    mesh_crest_plate_4_26Geometry,
    materialMap["crest-mint"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_crest_plate_4_26.name = "Crest plate 4";
  if (endpoint_crest_plate_4_26) {
    mesh_crest_plate_4_26.position.copy(endpoint_crest_plate_4_26.midpoint);
    mesh_crest_plate_4_26.quaternion.copy(endpoint_crest_plate_4_26.quaternion);
  }
  mesh_crest_plate_4_26.castShadow = options.castShadow ?? true;
  mesh_crest_plate_4_26.receiveShadow = options.receiveShadow ?? true;
  mesh_crest_plate_4_26.userData.sculptComponent = {"id":"crest-plate-4","name":"Crest plate 4","material":"crest-mint"};
  node_crest_plate_4_26.add(mesh_crest_plate_4_26);
  meshes["crest-plate-4"] = mesh_crest_plate_4_26;
  colliders["crest-plate-4"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["crest-plate-4"] ??= [];
  destructionGroups["crest-plate-4"].push(node_crest_plate_4_26);

  const endpoint_crest_stripe_27 = makeAttachmentEndpoint(null);
  const node_crest_stripe_27 = new THREE.Group();
  node_crest_stripe_27.name = "Crest mid-line__pivot";
  node_crest_stripe_27.scale.set(1, 1, 1);
  if (endpoint_crest_stripe_27) {
    node_crest_stripe_27.position.copy(endpoint_crest_stripe_27.start);
    node_crest_stripe_27.rotation.set(-0.55, 0.0, 0.0);
  } else {
    node_crest_stripe_27.position.set(0.0, 0.16, 0.225);
    node_crest_stripe_27.rotation.set(-0.55, 0.0, 0.0);
  }
  node_crest_stripe_27.userData.sculptComponent = {"id":"crest-stripe","name":"Crest mid-line","material":"stripe-black"};
  node_crest_stripe_27.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["head"] ?? root).add(node_crest_stripe_27);
  nodes["crest-stripe"] = node_crest_stripe_27;
  const mesh_crest_stripe_27Geometry = endpoint_crest_stripe_27
    ? new THREE.CylinderGeometry(endpoint_crest_stripe_27.endRadius, endpoint_crest_stripe_27.baseRadius, endpoint_crest_stripe_27.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_crest_stripe_27) {
    mesh_crest_stripe_27Geometry.scale(0.016, 0.2, 0.012);
  }
  const mesh_crest_stripe_27 = new THREE.Mesh(
    mesh_crest_stripe_27Geometry,
    materialMap["stripe-black"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_crest_stripe_27.name = "Crest mid-line";
  if (endpoint_crest_stripe_27) {
    mesh_crest_stripe_27.position.copy(endpoint_crest_stripe_27.midpoint);
    mesh_crest_stripe_27.quaternion.copy(endpoint_crest_stripe_27.quaternion);
  }
  mesh_crest_stripe_27.castShadow = options.castShadow ?? true;
  mesh_crest_stripe_27.receiveShadow = options.receiveShadow ?? true;
  mesh_crest_stripe_27.userData.sculptComponent = {"id":"crest-stripe","name":"Crest mid-line","material":"stripe-black"};
  node_crest_stripe_27.add(mesh_crest_stripe_27);
  meshes["crest-stripe"] = mesh_crest_stripe_27;
  colliders["crest-stripe"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["crest-stripe"] ??= [];
  destructionGroups["crest-stripe"].push(node_crest_stripe_27);

  const endpoint_mouth_28 = makeAttachmentEndpoint(null);
  const node_mouth_28 = new THREE.Group();
  node_mouth_28.name = "Mouth (open smile)__pivot";
  node_mouth_28.scale.set(1, 1, 1);
  if (endpoint_mouth_28) {
    node_mouth_28.position.copy(endpoint_mouth_28.start);
    node_mouth_28.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_mouth_28.position.set(0.0, -0.045, 0.165);
    node_mouth_28.rotation.set(0.0, 0.0, 0.0);
  }
  node_mouth_28.userData.sculptComponent = {"id":"mouth","name":"Mouth (open smile)","material":"mouth-dark"};
  node_mouth_28.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["muzzle"] ?? root).add(node_mouth_28);
  nodes["mouth"] = node_mouth_28;
  const mesh_mouth_28Geometry = endpoint_mouth_28
    ? new THREE.CylinderGeometry(endpoint_mouth_28.endRadius, endpoint_mouth_28.baseRadius, endpoint_mouth_28.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_mouth_28) {
    mesh_mouth_28Geometry.scale(0.24, 0.075, 0.06);
  }
  const mesh_mouth_28 = new THREE.Mesh(
    mesh_mouth_28Geometry,
    materialMap["mouth-dark"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_mouth_28.name = "Mouth (open smile)";
  if (endpoint_mouth_28) {
    mesh_mouth_28.position.copy(endpoint_mouth_28.midpoint);
    mesh_mouth_28.quaternion.copy(endpoint_mouth_28.quaternion);
  }
  mesh_mouth_28.castShadow = options.castShadow ?? true;
  mesh_mouth_28.receiveShadow = options.receiveShadow ?? true;
  mesh_mouth_28.userData.sculptComponent = {"id":"mouth","name":"Mouth (open smile)","material":"mouth-dark"};
  node_mouth_28.add(mesh_mouth_28);
  meshes["mouth"] = mesh_mouth_28;
  colliders["mouth"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["mouth"] ??= [];
  destructionGroups["mouth"].push(node_mouth_28);

  const endpoint_tongue_29 = makeAttachmentEndpoint(null);
  const node_tongue_29 = new THREE.Group();
  node_tongue_29.name = "Tongue__pivot";
  node_tongue_29.scale.set(1, 1, 1);
  if (endpoint_tongue_29) {
    node_tongue_29.position.copy(endpoint_tongue_29.start);
    node_tongue_29.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_tongue_29.position.set(0.0, -0.013, 0.013);
    node_tongue_29.rotation.set(0.0, 0.0, 0.0);
  }
  node_tongue_29.userData.sculptComponent = {"id":"tongue","name":"Tongue","material":"tongue-rose"};
  node_tongue_29.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["mouth"] ?? root).add(node_tongue_29);
  nodes["tongue"] = node_tongue_29;
  const mesh_tongue_29Geometry = endpoint_tongue_29
    ? new THREE.CylinderGeometry(endpoint_tongue_29.endRadius, endpoint_tongue_29.baseRadius, endpoint_tongue_29.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_tongue_29) {
    mesh_tongue_29Geometry.scale(0.13, 0.04, 0.04);
  }
  const mesh_tongue_29 = new THREE.Mesh(
    mesh_tongue_29Geometry,
    materialMap["tongue-rose"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_tongue_29.name = "Tongue";
  if (endpoint_tongue_29) {
    mesh_tongue_29.position.copy(endpoint_tongue_29.midpoint);
    mesh_tongue_29.quaternion.copy(endpoint_tongue_29.quaternion);
  }
  mesh_tongue_29.castShadow = options.castShadow ?? true;
  mesh_tongue_29.receiveShadow = options.receiveShadow ?? true;
  mesh_tongue_29.userData.sculptComponent = {"id":"tongue","name":"Tongue","material":"tongue-rose"};
  node_tongue_29.add(mesh_tongue_29);
  meshes["tongue"] = mesh_tongue_29;
  colliders["tongue"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["tongue"] ??= [];
  destructionGroups["tongue"].push(node_tongue_29);

  const attachment_fang_r_30 = {"parentSocket": "mouth-socket", "localStart": [-0.075, 0.027, 0.017], "localEnd": [-0.072, -0.01, 0.027], "contactType": "embed", "baseRadius": 0.012, "endRadius": 0.003, "embedDepth": 0.0072, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_fang_r_30 = makeAttachmentEndpoint(attachment_fang_r_30);
  const node_fang_r_30 = new THREE.Group();
  node_fang_r_30.name = "Fang R__pivot";
  node_fang_r_30.scale.set(1, 1, 1);
  if (endpoint_fang_r_30) {
    node_fang_r_30.position.copy(endpoint_fang_r_30.start);
    node_fang_r_30.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_fang_r_30.position.set(-0.075, 0.027, 0.017);
    node_fang_r_30.rotation.set(0.0, 0.0, 0.0);
  }
  node_fang_r_30.userData.sculptComponent = {"id":"fang-r","name":"Fang R","material":"claw-ivory"};
  node_fang_r_30.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["mouth"] ?? root).add(node_fang_r_30);
  nodes["fang-r"] = node_fang_r_30;
  const mesh_fang_r_30Geometry = endpoint_fang_r_30
    ? new THREE.CylinderGeometry(endpoint_fang_r_30.endRadius, endpoint_fang_r_30.baseRadius, endpoint_fang_r_30.length, 16, 6)
    : new THREE.ConeGeometry(0.5, 1, 24, 1);
  if (!endpoint_fang_r_30) {
    mesh_fang_r_30Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_fang_r_30 = new THREE.Mesh(
    mesh_fang_r_30Geometry,
    materialMap["claw-ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_fang_r_30.name = "Fang R";
  if (endpoint_fang_r_30) {
    mesh_fang_r_30.position.copy(endpoint_fang_r_30.midpoint);
    mesh_fang_r_30.quaternion.copy(endpoint_fang_r_30.quaternion);
  }
  mesh_fang_r_30.castShadow = options.castShadow ?? true;
  mesh_fang_r_30.receiveShadow = options.receiveShadow ?? true;
  mesh_fang_r_30.userData.sculptComponent = {"id":"fang-r","name":"Fang R","material":"claw-ivory"};
  node_fang_r_30.add(mesh_fang_r_30);
  meshes["fang-r"] = mesh_fang_r_30;
  colliders["fang-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["fang-r"] ??= [];
  destructionGroups["fang-r"].push(node_fang_r_30);

  const endpoint_mustache_r_31 = makeAttachmentEndpoint(null);
  const node_mustache_r_31 = new THREE.Group();
  node_mustache_r_31.name = "Mustache lobe R__pivot";
  node_mustache_r_31.scale.set(1, 1, 1);
  if (endpoint_mustache_r_31) {
    node_mustache_r_31.position.copy(endpoint_mustache_r_31.start);
    node_mustache_r_31.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_mustache_r_31.position.set(-0.002, 0.025, 0.193);
    node_mustache_r_31.rotation.set(0.0, 0.0, 0.0);
  }
  node_mustache_r_31.userData.sculptComponent = {"id":"mustache-r","name":"Mustache lobe R","material":"hair-black"};
  node_mustache_r_31.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["muzzle"] ?? root).add(node_mustache_r_31);
  nodes["mustache-r"] = node_mustache_r_31;
  const mesh_mustache_r_31Geometry = endpoint_mustache_r_31
    ? new THREE.CylinderGeometry(endpoint_mustache_r_31.endRadius, endpoint_mustache_r_31.baseRadius, endpoint_mustache_r_31.length, 16, 6)
    : buildTaperedSweepGeometry({"stations": [{"position": [0.008, 0.0, 0.0], "rx": 0.028, "rz": 0.019, "twist": 0.0}, {"position": [-0.045, -0.006, -0.002], "rx": 0.034, "rz": 0.03, "twist": 0.0}, {"position": [-0.095, -0.012, -0.013], "rx": 0.032, "rz": 0.031, "twist": 0.0}, {"position": [-0.145, -0.006, -0.032], "rx": 0.025, "rz": 0.023, "twist": 0.0}, {"position": [-0.18, 0.014, -0.052], "rx": 0.018, "rz": 0.016, "twist": 0.0}, {"position": [-0.192, 0.04, -0.07], "rx": 0.013, "rz": 0.011, "twist": 0.0}, {"position": [-0.178, 0.058, -0.074], "rx": 0.009, "rz": 0.008, "twist": 0.0}, {"position": [-0.16, 0.052, -0.07], "rx": 0.0, "rz": 0.0, "twist": 0.0}], "radialSegments": 14, "capEnds": true});
  if (!endpoint_mustache_r_31) {
    mesh_mustache_r_31Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_mustache_r_31 = new THREE.Mesh(
    mesh_mustache_r_31Geometry,
    materialMap["hair-black"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_mustache_r_31.name = "Mustache lobe R";
  if (endpoint_mustache_r_31) {
    mesh_mustache_r_31.position.copy(endpoint_mustache_r_31.midpoint);
    mesh_mustache_r_31.quaternion.copy(endpoint_mustache_r_31.quaternion);
  }
  mesh_mustache_r_31.castShadow = options.castShadow ?? true;
  mesh_mustache_r_31.receiveShadow = options.receiveShadow ?? true;
  mesh_mustache_r_31.userData.sculptComponent = {"id":"mustache-r","name":"Mustache lobe R","material":"hair-black"};
  node_mustache_r_31.add(mesh_mustache_r_31);
  meshes["mustache-r"] = mesh_mustache_r_31;
  colliders["mustache-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["mustache-r"] ??= [];
  destructionGroups["mustache-r"].push(node_mustache_r_31);

  const attachment_fang_l_32 = {"parentSocket": "mouth-socket", "localStart": [0.075, 0.027, 0.017], "localEnd": [0.072, -0.01, 0.027], "contactType": "embed", "baseRadius": 0.012, "endRadius": 0.003, "embedDepth": 0.0072, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_fang_l_32 = makeAttachmentEndpoint(attachment_fang_l_32);
  const node_fang_l_32 = new THREE.Group();
  node_fang_l_32.name = "Fang L__pivot";
  node_fang_l_32.scale.set(1, 1, 1);
  if (endpoint_fang_l_32) {
    node_fang_l_32.position.copy(endpoint_fang_l_32.start);
    node_fang_l_32.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_fang_l_32.position.set(0.075, 0.027, 0.017);
    node_fang_l_32.rotation.set(0.0, 0.0, 0.0);
  }
  node_fang_l_32.userData.sculptComponent = {"id":"fang-l","name":"Fang L","material":"claw-ivory"};
  node_fang_l_32.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["mouth"] ?? root).add(node_fang_l_32);
  nodes["fang-l"] = node_fang_l_32;
  const mesh_fang_l_32Geometry = endpoint_fang_l_32
    ? new THREE.CylinderGeometry(endpoint_fang_l_32.endRadius, endpoint_fang_l_32.baseRadius, endpoint_fang_l_32.length, 16, 6)
    : new THREE.ConeGeometry(0.5, 1, 24, 1);
  if (!endpoint_fang_l_32) {
    mesh_fang_l_32Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_fang_l_32 = new THREE.Mesh(
    mesh_fang_l_32Geometry,
    materialMap["claw-ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_fang_l_32.name = "Fang L";
  if (endpoint_fang_l_32) {
    mesh_fang_l_32.position.copy(endpoint_fang_l_32.midpoint);
    mesh_fang_l_32.quaternion.copy(endpoint_fang_l_32.quaternion);
  }
  mesh_fang_l_32.castShadow = options.castShadow ?? true;
  mesh_fang_l_32.receiveShadow = options.receiveShadow ?? true;
  mesh_fang_l_32.userData.sculptComponent = {"id":"fang-l","name":"Fang L","material":"claw-ivory"};
  node_fang_l_32.add(mesh_fang_l_32);
  meshes["fang-l"] = mesh_fang_l_32;
  colliders["fang-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["fang-l"] ??= [];
  destructionGroups["fang-l"].push(node_fang_l_32);

  const endpoint_mustache_l_33 = makeAttachmentEndpoint(null);
  const node_mustache_l_33 = new THREE.Group();
  node_mustache_l_33.name = "Mustache lobe L__pivot";
  node_mustache_l_33.scale.set(1, 1, 1);
  if (endpoint_mustache_l_33) {
    node_mustache_l_33.position.copy(endpoint_mustache_l_33.start);
    node_mustache_l_33.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_mustache_l_33.position.set(0.002, 0.025, 0.193);
    node_mustache_l_33.rotation.set(0.0, 0.0, 0.0);
  }
  node_mustache_l_33.userData.sculptComponent = {"id":"mustache-l","name":"Mustache lobe L","material":"hair-black"};
  node_mustache_l_33.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["muzzle"] ?? root).add(node_mustache_l_33);
  nodes["mustache-l"] = node_mustache_l_33;
  const mesh_mustache_l_33Geometry = endpoint_mustache_l_33
    ? new THREE.CylinderGeometry(endpoint_mustache_l_33.endRadius, endpoint_mustache_l_33.baseRadius, endpoint_mustache_l_33.length, 16, 6)
    : buildTaperedSweepGeometry({"stations": [{"position": [-0.008, 0.0, 0.0], "rx": 0.028, "rz": 0.019, "twist": 0.0}, {"position": [0.045, -0.006, -0.002], "rx": 0.034, "rz": 0.03, "twist": 0.0}, {"position": [0.095, -0.012, -0.013], "rx": 0.032, "rz": 0.031, "twist": 0.0}, {"position": [0.145, -0.006, -0.032], "rx": 0.025, "rz": 0.023, "twist": 0.0}, {"position": [0.18, 0.014, -0.052], "rx": 0.018, "rz": 0.016, "twist": 0.0}, {"position": [0.192, 0.04, -0.07], "rx": 0.013, "rz": 0.011, "twist": 0.0}, {"position": [0.178, 0.058, -0.074], "rx": 0.009, "rz": 0.008, "twist": 0.0}, {"position": [0.16, 0.052, -0.07], "rx": 0.0, "rz": 0.0, "twist": 0.0}], "radialSegments": 14, "capEnds": true});
  if (!endpoint_mustache_l_33) {
    mesh_mustache_l_33Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_mustache_l_33 = new THREE.Mesh(
    mesh_mustache_l_33Geometry,
    materialMap["hair-black"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_mustache_l_33.name = "Mustache lobe L";
  if (endpoint_mustache_l_33) {
    mesh_mustache_l_33.position.copy(endpoint_mustache_l_33.midpoint);
    mesh_mustache_l_33.quaternion.copy(endpoint_mustache_l_33.quaternion);
  }
  mesh_mustache_l_33.castShadow = options.castShadow ?? true;
  mesh_mustache_l_33.receiveShadow = options.receiveShadow ?? true;
  mesh_mustache_l_33.userData.sculptComponent = {"id":"mustache-l","name":"Mustache lobe L","material":"hair-black"};
  node_mustache_l_33.add(mesh_mustache_l_33);
  meshes["mustache-l"] = mesh_mustache_l_33;
  colliders["mustache-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["mustache-l"] ??= [];
  destructionGroups["mustache-l"].push(node_mustache_l_33);

  const endpoint_goatee_34 = makeAttachmentEndpoint(null);
  const node_goatee_34 = new THREE.Group();
  node_goatee_34.name = "Beard (jaw crescent)__pivot";
  node_goatee_34.scale.set(1, 1, 1);
  if (endpoint_goatee_34) {
    node_goatee_34.position.copy(endpoint_goatee_34.start);
    node_goatee_34.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_goatee_34.position.set(-0.205, -0.045, 0.112);
    node_goatee_34.rotation.set(0.0, 0.0, 0.0);
  }
  node_goatee_34.userData.sculptComponent = {"id":"goatee","name":"Beard (jaw crescent)","material":"hair-black"};
  node_goatee_34.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["muzzle"] ?? root).add(node_goatee_34);
  nodes["goatee"] = node_goatee_34;
  const mesh_goatee_34Geometry = endpoint_goatee_34
    ? new THREE.CylinderGeometry(endpoint_goatee_34.endRadius, endpoint_goatee_34.baseRadius, endpoint_goatee_34.length, 16, 6)
    : buildTaperedSweepGeometry({"stations": [{"position": [0.0, 0.0, 0.0], "rx": 0.0, "rz": 0.0, "twist": 0.0}, {"position": [0.04, -0.047, -0.01], "rx": 0.0168, "rz": 0.016, "twist": 0.0}, {"position": [0.11, -0.079, 0.0], "rx": 0.0284, "rz": 0.027, "twist": 0.0}, {"position": [0.205, -0.089, 0.006], "rx": 0.0326, "rz": 0.031, "twist": 0.0}, {"position": [0.3, -0.079, 0.0], "rx": 0.0284, "rz": 0.027, "twist": 0.0}, {"position": [0.37, -0.047, -0.01], "rx": 0.0168, "rz": 0.016, "twist": 0.0}, {"position": [0.41, 0.0, 0.0], "rx": 0.0, "rz": 0.0, "twist": 0.0}], "radialSegments": 14, "capEnds": true});
  if (!endpoint_goatee_34) {
    mesh_goatee_34Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_goatee_34 = new THREE.Mesh(
    mesh_goatee_34Geometry,
    materialMap["hair-black"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_goatee_34.name = "Beard (jaw crescent)";
  if (endpoint_goatee_34) {
    mesh_goatee_34.position.copy(endpoint_goatee_34.midpoint);
    mesh_goatee_34.quaternion.copy(endpoint_goatee_34.quaternion);
  }
  mesh_goatee_34.castShadow = options.castShadow ?? true;
  mesh_goatee_34.receiveShadow = options.receiveShadow ?? true;
  mesh_goatee_34.userData.sculptComponent = {"id":"goatee","name":"Beard (jaw crescent)","material":"hair-black"};
  node_goatee_34.add(mesh_goatee_34);
  meshes["goatee"] = mesh_goatee_34;
  colliders["goatee"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["goatee"] ??= [];
  destructionGroups["goatee"].push(node_goatee_34);

  const endpoint_goatee_tip_35 = makeAttachmentEndpoint(null);
  const node_goatee_tip_35 = new THREE.Group();
  node_goatee_tip_35.name = "Goatee point__pivot";
  node_goatee_tip_35.scale.set(1, 1, 1);
  if (endpoint_goatee_tip_35) {
    node_goatee_tip_35.position.copy(endpoint_goatee_tip_35.start);
    node_goatee_tip_35.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_goatee_tip_35.position.set(0.205, -0.075, 0.006);
    node_goatee_tip_35.rotation.set(0.0, 0.0, 0.0);
  }
  node_goatee_tip_35.userData.sculptComponent = {"id":"goatee-tip","name":"Goatee point","material":"hair-black"};
  node_goatee_tip_35.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["goatee"] ?? root).add(node_goatee_tip_35);
  nodes["goatee-tip"] = node_goatee_tip_35;
  const mesh_goatee_tip_35Geometry = endpoint_goatee_tip_35
    ? new THREE.CylinderGeometry(endpoint_goatee_tip_35.endRadius, endpoint_goatee_tip_35.baseRadius, endpoint_goatee_tip_35.length, 16, 6)
    : buildTaperedSweepGeometry({"stations": [{"position": [0, 0, 0], "rx": 0.03, "rz": 0.05, "twist": 0.0}, {"position": [0, -0.045, -0.006], "rx": 0.028, "rz": 0.036, "twist": 0.0}, {"position": [0, -0.085, -0.016], "rx": 0.0, "rz": 0.0, "twist": 0.0}], "radialSegments": 12, "capEnds": true});
  if (!endpoint_goatee_tip_35) {
    mesh_goatee_tip_35Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_goatee_tip_35 = new THREE.Mesh(
    mesh_goatee_tip_35Geometry,
    materialMap["hair-black"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_goatee_tip_35.name = "Goatee point";
  if (endpoint_goatee_tip_35) {
    mesh_goatee_tip_35.position.copy(endpoint_goatee_tip_35.midpoint);
    mesh_goatee_tip_35.quaternion.copy(endpoint_goatee_tip_35.quaternion);
  }
  mesh_goatee_tip_35.castShadow = options.castShadow ?? true;
  mesh_goatee_tip_35.receiveShadow = options.receiveShadow ?? true;
  mesh_goatee_tip_35.userData.sculptComponent = {"id":"goatee-tip","name":"Goatee point","material":"hair-black"};
  node_goatee_tip_35.add(mesh_goatee_tip_35);
  meshes["goatee-tip"] = mesh_goatee_tip_35;
  colliders["goatee-tip"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["goatee-tip"] ??= [];
  destructionGroups["goatee-tip"].push(node_goatee_tip_35);

  const endpoint_ghutra_crown_36 = makeAttachmentEndpoint(null);
  const node_ghutra_crown_36 = new THREE.Group();
  node_ghutra_crown_36.name = "Ghutra crown__pivot";
  node_ghutra_crown_36.scale.set(1, 1, 1);
  if (endpoint_ghutra_crown_36) {
    node_ghutra_crown_36.position.copy(endpoint_ghutra_crown_36.start);
    node_ghutra_crown_36.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_ghutra_crown_36.position.set(0.0, 0.0, -0.01);
    node_ghutra_crown_36.rotation.set(0.0, 0.0, 0.0);
  }
  node_ghutra_crown_36.userData.sculptComponent = {"id":"ghutra-crown","name":"Ghutra crown","material":"cloth-white"};
  node_ghutra_crown_36.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["head"] ?? root).add(node_ghutra_crown_36);
  nodes["ghutra-crown"] = node_ghutra_crown_36;
  const mesh_ghutra_crown_36Geometry = endpoint_ghutra_crown_36
    ? new THREE.CylinderGeometry(endpoint_ghutra_crown_36.endRadius, endpoint_ghutra_crown_36.baseRadius, endpoint_ghutra_crown_36.length, 16, 6)
    : buildLatheGeometry({"points": [[0.0001, 0.5], [0.15, 0.492], [0.26, 0.462], [0.33, 0.4], [0.362, 0.32], [0.362, 0.25], [0.35, 0.22], [0.0001, 0.22]], "segments": 40});
  if (!endpoint_ghutra_crown_36) {
    mesh_ghutra_crown_36Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_ghutra_crown_36 = new THREE.Mesh(
    mesh_ghutra_crown_36Geometry,
    materialMap["cloth-white"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_ghutra_crown_36.name = "Ghutra crown";
  if (endpoint_ghutra_crown_36) {
    mesh_ghutra_crown_36.position.copy(endpoint_ghutra_crown_36.midpoint);
    mesh_ghutra_crown_36.quaternion.copy(endpoint_ghutra_crown_36.quaternion);
  }
  mesh_ghutra_crown_36.castShadow = options.castShadow ?? true;
  mesh_ghutra_crown_36.receiveShadow = options.receiveShadow ?? true;
  mesh_ghutra_crown_36.userData.sculptComponent = {"id":"ghutra-crown","name":"Ghutra crown","material":"cloth-white"};
  node_ghutra_crown_36.add(mesh_ghutra_crown_36);
  meshes["ghutra-crown"] = mesh_ghutra_crown_36;
  colliders["ghutra-crown"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["ghutra-crown"] ??= [];
  destructionGroups["ghutra-crown"].push(node_ghutra_crown_36);

  const endpoint_ghutra_hood_37 = makeAttachmentEndpoint(null);
  const node_ghutra_hood_37 = new THREE.Group();
  node_ghutra_hood_37.name = "Ghutra drape__pivot";
  node_ghutra_hood_37.scale.set(1, 1, 1);
  if (endpoint_ghutra_hood_37) {
    node_ghutra_hood_37.position.copy(endpoint_ghutra_hood_37.start);
    node_ghutra_hood_37.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_ghutra_hood_37.position.set(0.0, 0.0, -0.11);
    node_ghutra_hood_37.rotation.set(0.0, 0.0, 0.0);
  }
  node_ghutra_hood_37.userData.sculptComponent = {"id":"ghutra-hood","name":"Ghutra drape","material":"cloth-white"};
  node_ghutra_hood_37.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["ghutra-crown"] ?? root).add(node_ghutra_hood_37);
  nodes["ghutra-hood"] = node_ghutra_hood_37;
  const mesh_ghutra_hood_37Geometry = endpoint_ghutra_hood_37
    ? new THREE.CylinderGeometry(endpoint_ghutra_hood_37.endRadius, endpoint_ghutra_hood_37.baseRadius, endpoint_ghutra_hood_37.length, 16, 6)
    : buildLatheGeometry({"points": [[0.345, 0.25], [0.37, 0.1], [0.395, -0.05], [0.425, -0.2], [0.455, -0.32], [0.472, -0.4], [0.445, -0.425]], "segments": 48});
  if (!endpoint_ghutra_hood_37) {
    mesh_ghutra_hood_37Geometry.scale(1.0, 1.0, 0.62);
  }
  const mesh_ghutra_hood_37 = new THREE.Mesh(
    mesh_ghutra_hood_37Geometry,
    materialMap["cloth-white"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_ghutra_hood_37.name = "Ghutra drape";
  if (endpoint_ghutra_hood_37) {
    mesh_ghutra_hood_37.position.copy(endpoint_ghutra_hood_37.midpoint);
    mesh_ghutra_hood_37.quaternion.copy(endpoint_ghutra_hood_37.quaternion);
  }
  mesh_ghutra_hood_37.castShadow = options.castShadow ?? true;
  mesh_ghutra_hood_37.receiveShadow = options.receiveShadow ?? true;
  mesh_ghutra_hood_37.userData.sculptComponent = {"id":"ghutra-hood","name":"Ghutra drape","material":"cloth-white"};
  node_ghutra_hood_37.add(mesh_ghutra_hood_37);
  meshes["ghutra-hood"] = mesh_ghutra_hood_37;
  colliders["ghutra-hood"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["ghutra-hood"] ??= [];
  destructionGroups["ghutra-hood"].push(node_ghutra_hood_37);

  const endpoint_ghutra_fold_a_38 = makeAttachmentEndpoint(null);
  const node_ghutra_fold_a_38 = new THREE.Group();
  node_ghutra_fold_a_38.name = "Ghutra fold (character-left shoulder)__pivot";
  node_ghutra_fold_a_38.scale.set(1, 1, 1);
  if (endpoint_ghutra_fold_a_38) {
    node_ghutra_fold_a_38.position.copy(endpoint_ghutra_fold_a_38.start);
    node_ghutra_fold_a_38.rotation.set(0.0, 0.0, 0.19);
  } else {
    node_ghutra_fold_a_38.position.set(0.42, -0.04, -0.05);
    node_ghutra_fold_a_38.rotation.set(0.0, 0.0, 0.19);
  }
  node_ghutra_fold_a_38.userData.sculptComponent = {"id":"ghutra-fold-a","name":"Ghutra fold (character-left shoulder)","material":"cloth-white"};
  node_ghutra_fold_a_38.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["ghutra-crown"] ?? root).add(node_ghutra_fold_a_38);
  nodes["ghutra-fold-a"] = node_ghutra_fold_a_38;
  const mesh_ghutra_fold_a_38Geometry = endpoint_ghutra_fold_a_38
    ? new THREE.CylinderGeometry(endpoint_ghutra_fold_a_38.endRadius, endpoint_ghutra_fold_a_38.baseRadius, endpoint_ghutra_fold_a_38.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_ghutra_fold_a_38) {
    mesh_ghutra_fold_a_38Geometry.scale(0.22, 0.82, 0.24);
  }
  const mesh_ghutra_fold_a_38 = new THREE.Mesh(
    mesh_ghutra_fold_a_38Geometry,
    materialMap["cloth-white"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_ghutra_fold_a_38.name = "Ghutra fold (character-left shoulder)";
  if (endpoint_ghutra_fold_a_38) {
    mesh_ghutra_fold_a_38.position.copy(endpoint_ghutra_fold_a_38.midpoint);
    mesh_ghutra_fold_a_38.quaternion.copy(endpoint_ghutra_fold_a_38.quaternion);
  }
  mesh_ghutra_fold_a_38.castShadow = options.castShadow ?? true;
  mesh_ghutra_fold_a_38.receiveShadow = options.receiveShadow ?? true;
  mesh_ghutra_fold_a_38.userData.sculptComponent = {"id":"ghutra-fold-a","name":"Ghutra fold (character-left shoulder)","material":"cloth-white"};
  node_ghutra_fold_a_38.add(mesh_ghutra_fold_a_38);
  meshes["ghutra-fold-a"] = mesh_ghutra_fold_a_38;
  colliders["ghutra-fold-a"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["ghutra-fold-a"] ??= [];
  destructionGroups["ghutra-fold-a"].push(node_ghutra_fold_a_38);

  const endpoint_ghutra_fold_b_39 = makeAttachmentEndpoint(null);
  const node_ghutra_fold_b_39 = new THREE.Group();
  node_ghutra_fold_b_39.name = "Ghutra fold (character-right side)__pivot";
  node_ghutra_fold_b_39.scale.set(1, 1, 1);
  if (endpoint_ghutra_fold_b_39) {
    node_ghutra_fold_b_39.position.copy(endpoint_ghutra_fold_b_39.start);
    node_ghutra_fold_b_39.rotation.set(0.0, 0.0, -0.12);
  } else {
    node_ghutra_fold_b_39.position.set(-0.31, -0.1, -0.05);
    node_ghutra_fold_b_39.rotation.set(0.0, 0.0, -0.12);
  }
  node_ghutra_fold_b_39.userData.sculptComponent = {"id":"ghutra-fold-b","name":"Ghutra fold (character-right side)","material":"cloth-white"};
  node_ghutra_fold_b_39.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["ghutra-crown"] ?? root).add(node_ghutra_fold_b_39);
  nodes["ghutra-fold-b"] = node_ghutra_fold_b_39;
  const mesh_ghutra_fold_b_39Geometry = endpoint_ghutra_fold_b_39
    ? new THREE.CylinderGeometry(endpoint_ghutra_fold_b_39.endRadius, endpoint_ghutra_fold_b_39.baseRadius, endpoint_ghutra_fold_b_39.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_ghutra_fold_b_39) {
    mesh_ghutra_fold_b_39Geometry.scale(0.12, 0.3, 0.18);
  }
  const mesh_ghutra_fold_b_39 = new THREE.Mesh(
    mesh_ghutra_fold_b_39Geometry,
    materialMap["cloth-white"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_ghutra_fold_b_39.name = "Ghutra fold (character-right side)";
  if (endpoint_ghutra_fold_b_39) {
    mesh_ghutra_fold_b_39.position.copy(endpoint_ghutra_fold_b_39.midpoint);
    mesh_ghutra_fold_b_39.quaternion.copy(endpoint_ghutra_fold_b_39.quaternion);
  }
  mesh_ghutra_fold_b_39.castShadow = options.castShadow ?? true;
  mesh_ghutra_fold_b_39.receiveShadow = options.receiveShadow ?? true;
  mesh_ghutra_fold_b_39.userData.sculptComponent = {"id":"ghutra-fold-b","name":"Ghutra fold (character-right side)","material":"cloth-white"};
  node_ghutra_fold_b_39.add(mesh_ghutra_fold_b_39);
  meshes["ghutra-fold-b"] = mesh_ghutra_fold_b_39;
  colliders["ghutra-fold-b"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["ghutra-fold-b"] ??= [];
  destructionGroups["ghutra-fold-b"].push(node_ghutra_fold_b_39);

  const endpoint_agal_lower_40 = makeAttachmentEndpoint(null);
  const node_agal_lower_40 = new THREE.Group();
  node_agal_lower_40.name = "Agal lower__pivot";
  node_agal_lower_40.scale.set(1, 1, 1);
  if (endpoint_agal_lower_40) {
    node_agal_lower_40.position.copy(endpoint_agal_lower_40.start);
    node_agal_lower_40.rotation.set(1.4507963267948965, 0.0, 0.0);
  } else {
    node_agal_lower_40.position.set(0.0, 0.315, -0.02);
    node_agal_lower_40.rotation.set(1.4507963267948965, 0.0, 0.0);
  }
  node_agal_lower_40.userData.sculptComponent = {"id":"agal-lower","name":"Agal lower","material":"agal-black"};
  node_agal_lower_40.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["ghutra-crown"] ?? root).add(node_agal_lower_40);
  nodes["agal-lower"] = node_agal_lower_40;
  const mesh_agal_lower_40Geometry = endpoint_agal_lower_40
    ? new THREE.CylinderGeometry(endpoint_agal_lower_40.endRadius, endpoint_agal_lower_40.baseRadius, endpoint_agal_lower_40.length, 16, 6)
    : new THREE.TorusGeometry(0.45, 0.0338, 12, 48);
  if (!endpoint_agal_lower_40) {
    mesh_agal_lower_40Geometry.scale(0.7777777777777777, 0.7777777777777777, 0.7777777777777777);
  }
  const mesh_agal_lower_40 = new THREE.Mesh(
    mesh_agal_lower_40Geometry,
    materialMap["agal-black"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_agal_lower_40.name = "Agal lower";
  if (endpoint_agal_lower_40) {
    mesh_agal_lower_40.position.copy(endpoint_agal_lower_40.midpoint);
    mesh_agal_lower_40.quaternion.copy(endpoint_agal_lower_40.quaternion);
  }
  mesh_agal_lower_40.castShadow = options.castShadow ?? true;
  mesh_agal_lower_40.receiveShadow = options.receiveShadow ?? true;
  mesh_agal_lower_40.userData.sculptComponent = {"id":"agal-lower","name":"Agal lower","material":"agal-black"};
  node_agal_lower_40.add(mesh_agal_lower_40);
  meshes["agal-lower"] = mesh_agal_lower_40;
  colliders["agal-lower"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["agal-lower"] ??= [];
  destructionGroups["agal-lower"].push(node_agal_lower_40);

  const endpoint_agal_upper_41 = makeAttachmentEndpoint(null);
  const node_agal_upper_41 = new THREE.Group();
  node_agal_upper_41.name = "Agal upper__pivot";
  node_agal_upper_41.scale.set(1, 1, 1);
  if (endpoint_agal_upper_41) {
    node_agal_upper_41.position.copy(endpoint_agal_upper_41.start);
    node_agal_upper_41.rotation.set(1.4507963267948965, 0.0, 0.0);
  } else {
    node_agal_upper_41.position.set(0.0, 0.362, -0.02);
    node_agal_upper_41.rotation.set(1.4507963267948965, 0.0, 0.0);
  }
  node_agal_upper_41.userData.sculptComponent = {"id":"agal-upper","name":"Agal upper","material":"agal-black"};
  node_agal_upper_41.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["ghutra-crown"] ?? root).add(node_agal_upper_41);
  nodes["agal-upper"] = node_agal_upper_41;
  const mesh_agal_upper_41Geometry = endpoint_agal_upper_41
    ? new THREE.CylinderGeometry(endpoint_agal_upper_41.endRadius, endpoint_agal_upper_41.baseRadius, endpoint_agal_upper_41.length, 16, 6)
    : new THREE.TorusGeometry(0.45, 0.0338, 12, 48);
  if (!endpoint_agal_upper_41) {
    mesh_agal_upper_41Geometry.scale(0.7555555555555555, 0.7555555555555555, 0.7555555555555555);
  }
  const mesh_agal_upper_41 = new THREE.Mesh(
    mesh_agal_upper_41Geometry,
    materialMap["agal-black"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_agal_upper_41.name = "Agal upper";
  if (endpoint_agal_upper_41) {
    mesh_agal_upper_41.position.copy(endpoint_agal_upper_41.midpoint);
    mesh_agal_upper_41.quaternion.copy(endpoint_agal_upper_41.quaternion);
  }
  mesh_agal_upper_41.castShadow = options.castShadow ?? true;
  mesh_agal_upper_41.receiveShadow = options.receiveShadow ?? true;
  mesh_agal_upper_41.userData.sculptComponent = {"id":"agal-upper","name":"Agal upper","material":"agal-black"};
  node_agal_upper_41.add(mesh_agal_upper_41);
  meshes["agal-upper"] = mesh_agal_upper_41;
  colliders["agal-upper"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["agal-upper"] ??= [];
  destructionGroups["agal-upper"].push(node_agal_upper_41);

  const attachment_sleeve_upper_wave_42 = {"parentSocket": "kandura-socket", "localStart": [-0.27, 1.0, 0.02], "localEnd": [-0.46, 1.06, 0.06], "contactType": "socket-joint", "baseRadius": 0.095, "endRadius": 0.085, "embedDepth": 0.057, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_sleeve_upper_wave_42 = makeAttachmentEndpoint(attachment_sleeve_upper_wave_42);
  const node_sleeve_upper_wave_42 = new THREE.Group();
  node_sleeve_upper_wave_42.name = "Sleeve upper R (waving arm)__pivot";
  node_sleeve_upper_wave_42.scale.set(1, 1, 1);
  if (endpoint_sleeve_upper_wave_42) {
    node_sleeve_upper_wave_42.position.copy(endpoint_sleeve_upper_wave_42.start);
    node_sleeve_upper_wave_42.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_sleeve_upper_wave_42.position.set(-0.27, 1.0, 0.02);
    node_sleeve_upper_wave_42.rotation.set(0.0, 0.0, 0.0);
  }
  node_sleeve_upper_wave_42.userData.sculptComponent = {"id":"sleeve-upper-wave","name":"Sleeve upper R (waving arm)","material":"cloth-white"};
  node_sleeve_upper_wave_42.userData.actionProfile = {"animationRole":"arm","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["kandura"] ?? root).add(node_sleeve_upper_wave_42);
  nodes["sleeve-upper-wave"] = node_sleeve_upper_wave_42;
  const mesh_sleeve_upper_wave_42Geometry = endpoint_sleeve_upper_wave_42
    ? new THREE.CylinderGeometry(endpoint_sleeve_upper_wave_42.endRadius, endpoint_sleeve_upper_wave_42.baseRadius, endpoint_sleeve_upper_wave_42.length, 16, 6)
    : buildWatertightCapsule(0.35, 0.7, 8, 16, 1);
  if (!endpoint_sleeve_upper_wave_42) {
    mesh_sleeve_upper_wave_42Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_sleeve_upper_wave_42 = new THREE.Mesh(
    mesh_sleeve_upper_wave_42Geometry,
    materialMap["cloth-white"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_sleeve_upper_wave_42.name = "Sleeve upper R (waving arm)";
  if (endpoint_sleeve_upper_wave_42) {
    mesh_sleeve_upper_wave_42.position.copy(endpoint_sleeve_upper_wave_42.midpoint);
    mesh_sleeve_upper_wave_42.quaternion.copy(endpoint_sleeve_upper_wave_42.quaternion);
  }
  mesh_sleeve_upper_wave_42.castShadow = options.castShadow ?? true;
  mesh_sleeve_upper_wave_42.receiveShadow = options.receiveShadow ?? true;
  mesh_sleeve_upper_wave_42.userData.sculptComponent = {"id":"sleeve-upper-wave","name":"Sleeve upper R (waving arm)","material":"cloth-white"};
  node_sleeve_upper_wave_42.add(mesh_sleeve_upper_wave_42);
  meshes["sleeve-upper-wave"] = mesh_sleeve_upper_wave_42;
  colliders["sleeve-upper-wave"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["sleeve-upper-wave"] ??= [];
  destructionGroups["sleeve-upper-wave"].push(node_sleeve_upper_wave_42);

  const attachment_sleeve_fore_wave_43 = {"parentSocket": "sleeve-upper-wave-socket", "localStart": [-0.19, 0.06, 0.04], "localEnd": [-0.25, 0.24, 0.07], "contactType": "socket-joint", "baseRadius": 0.085, "endRadius": 0.078, "embedDepth": 0.051, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_sleeve_fore_wave_43 = makeAttachmentEndpoint(attachment_sleeve_fore_wave_43);
  const node_sleeve_fore_wave_43 = new THREE.Group();
  node_sleeve_fore_wave_43.name = "Sleeve forearm R__pivot";
  node_sleeve_fore_wave_43.scale.set(1, 1, 1);
  if (endpoint_sleeve_fore_wave_43) {
    node_sleeve_fore_wave_43.position.copy(endpoint_sleeve_fore_wave_43.start);
    node_sleeve_fore_wave_43.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_sleeve_fore_wave_43.position.set(-0.19, 0.06, 0.04);
    node_sleeve_fore_wave_43.rotation.set(0.0, 0.0, 0.0);
  }
  node_sleeve_fore_wave_43.userData.sculptComponent = {"id":"sleeve-fore-wave","name":"Sleeve forearm R","material":"cloth-white"};
  node_sleeve_fore_wave_43.userData.actionProfile = {"animationRole":"wave","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["sleeve-upper-wave"] ?? root).add(node_sleeve_fore_wave_43);
  nodes["sleeve-fore-wave"] = node_sleeve_fore_wave_43;
  const mesh_sleeve_fore_wave_43Geometry = endpoint_sleeve_fore_wave_43
    ? new THREE.CylinderGeometry(endpoint_sleeve_fore_wave_43.endRadius, endpoint_sleeve_fore_wave_43.baseRadius, endpoint_sleeve_fore_wave_43.length, 16, 6)
    : buildWatertightCapsule(0.35, 0.7, 8, 16, 1);
  if (!endpoint_sleeve_fore_wave_43) {
    mesh_sleeve_fore_wave_43Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_sleeve_fore_wave_43 = new THREE.Mesh(
    mesh_sleeve_fore_wave_43Geometry,
    materialMap["cloth-white"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_sleeve_fore_wave_43.name = "Sleeve forearm R";
  if (endpoint_sleeve_fore_wave_43) {
    mesh_sleeve_fore_wave_43.position.copy(endpoint_sleeve_fore_wave_43.midpoint);
    mesh_sleeve_fore_wave_43.quaternion.copy(endpoint_sleeve_fore_wave_43.quaternion);
  }
  mesh_sleeve_fore_wave_43.castShadow = options.castShadow ?? true;
  mesh_sleeve_fore_wave_43.receiveShadow = options.receiveShadow ?? true;
  mesh_sleeve_fore_wave_43.userData.sculptComponent = {"id":"sleeve-fore-wave","name":"Sleeve forearm R","material":"cloth-white"};
  node_sleeve_fore_wave_43.add(mesh_sleeve_fore_wave_43);
  meshes["sleeve-fore-wave"] = mesh_sleeve_fore_wave_43;
  colliders["sleeve-fore-wave"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["sleeve-fore-wave"] ??= [];
  destructionGroups["sleeve-fore-wave"].push(node_sleeve_fore_wave_43);

  const endpoint_hand_wave_44 = makeAttachmentEndpoint(null);
  const node_hand_wave_44 = new THREE.Group();
  node_hand_wave_44.name = "Hand R (waving)__pivot";
  node_hand_wave_44.scale.set(1, 1, 1);
  if (endpoint_hand_wave_44) {
    node_hand_wave_44.position.copy(endpoint_hand_wave_44.start);
    node_hand_wave_44.rotation.set(0.0, 0.0, 0.18);
  } else {
    node_hand_wave_44.position.set(-0.09, 0.27, 0.04);
    node_hand_wave_44.rotation.set(0.0, 0.0, 0.18);
  }
  node_hand_wave_44.userData.sculptComponent = {"id":"hand-wave","name":"Hand R (waving)","material":"gold-skin"};
  node_hand_wave_44.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["sleeve-fore-wave"] ?? root).add(node_hand_wave_44);
  nodes["hand-wave"] = node_hand_wave_44;
  const mesh_hand_wave_44Geometry = endpoint_hand_wave_44
    ? new THREE.CylinderGeometry(endpoint_hand_wave_44.endRadius, endpoint_hand_wave_44.baseRadius, endpoint_hand_wave_44.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_hand_wave_44) {
    mesh_hand_wave_44Geometry.scale(0.2, 0.19, 0.09);
  }
  const mesh_hand_wave_44 = new THREE.Mesh(
    mesh_hand_wave_44Geometry,
    materialMap["gold-skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_hand_wave_44.name = "Hand R (waving)";
  if (endpoint_hand_wave_44) {
    mesh_hand_wave_44.position.copy(endpoint_hand_wave_44.midpoint);
    mesh_hand_wave_44.quaternion.copy(endpoint_hand_wave_44.quaternion);
  }
  mesh_hand_wave_44.castShadow = options.castShadow ?? true;
  mesh_hand_wave_44.receiveShadow = options.receiveShadow ?? true;
  mesh_hand_wave_44.userData.sculptComponent = {"id":"hand-wave","name":"Hand R (waving)","material":"gold-skin"};
  node_hand_wave_44.add(mesh_hand_wave_44);
  meshes["hand-wave"] = mesh_hand_wave_44;
  colliders["hand-wave"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["hand-wave"] ??= [];
  destructionGroups["hand-wave"].push(node_hand_wave_44);

  const attachment_finger_wave_1_45 = {"parentSocket": "sleeve-fore-wave-socket", "localStart": [-0.155, 0.31, 0.04], "localEnd": [-0.205, 0.405, 0.045], "contactType": "embed", "baseRadius": 0.042, "endRadius": 0.036, "embedDepth": 0.0252, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_finger_wave_1_45 = makeAttachmentEndpoint(attachment_finger_wave_1_45);
  const node_finger_wave_1_45 = new THREE.Group();
  node_finger_wave_1_45.name = "Finger R1__pivot";
  node_finger_wave_1_45.scale.set(1, 1, 1);
  if (endpoint_finger_wave_1_45) {
    node_finger_wave_1_45.position.copy(endpoint_finger_wave_1_45.start);
    node_finger_wave_1_45.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_finger_wave_1_45.position.set(-0.155, 0.31, 0.04);
    node_finger_wave_1_45.rotation.set(0.0, 0.0, 0.0);
  }
  node_finger_wave_1_45.userData.sculptComponent = {"id":"finger-wave-1","name":"Finger R1","material":"gold-skin"};
  node_finger_wave_1_45.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["sleeve-fore-wave"] ?? root).add(node_finger_wave_1_45);
  nodes["finger-wave-1"] = node_finger_wave_1_45;
  const mesh_finger_wave_1_45Geometry = endpoint_finger_wave_1_45
    ? new THREE.CylinderGeometry(endpoint_finger_wave_1_45.endRadius, endpoint_finger_wave_1_45.baseRadius, endpoint_finger_wave_1_45.length, 16, 6)
    : buildWatertightCapsule(0.35, 0.7, 8, 16, 1);
  if (!endpoint_finger_wave_1_45) {
    mesh_finger_wave_1_45Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_finger_wave_1_45 = new THREE.Mesh(
    mesh_finger_wave_1_45Geometry,
    materialMap["gold-skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_finger_wave_1_45.name = "Finger R1";
  if (endpoint_finger_wave_1_45) {
    mesh_finger_wave_1_45.position.copy(endpoint_finger_wave_1_45.midpoint);
    mesh_finger_wave_1_45.quaternion.copy(endpoint_finger_wave_1_45.quaternion);
  }
  mesh_finger_wave_1_45.castShadow = options.castShadow ?? true;
  mesh_finger_wave_1_45.receiveShadow = options.receiveShadow ?? true;
  mesh_finger_wave_1_45.userData.sculptComponent = {"id":"finger-wave-1","name":"Finger R1","material":"gold-skin"};
  node_finger_wave_1_45.add(mesh_finger_wave_1_45);
  meshes["finger-wave-1"] = mesh_finger_wave_1_45;
  colliders["finger-wave-1"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["finger-wave-1"] ??= [];
  destructionGroups["finger-wave-1"].push(node_finger_wave_1_45);

  const attachment_fingerclaw_wave_1_46 = {"parentSocket": "finger-wave-1-socket", "localStart": [-0.05, 0.09, 0.005], "localEnd": [-0.0633, 0.13, 0.01], "contactType": "embed", "baseRadius": 0.016, "endRadius": 0.003, "embedDepth": 0.0096, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_fingerclaw_wave_1_46 = makeAttachmentEndpoint(attachment_fingerclaw_wave_1_46);
  const node_fingerclaw_wave_1_46 = new THREE.Group();
  node_fingerclaw_wave_1_46.name = "Finger claw R1__pivot";
  node_fingerclaw_wave_1_46.scale.set(1, 1, 1);
  if (endpoint_fingerclaw_wave_1_46) {
    node_fingerclaw_wave_1_46.position.copy(endpoint_fingerclaw_wave_1_46.start);
    node_fingerclaw_wave_1_46.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_fingerclaw_wave_1_46.position.set(-0.05, 0.09, 0.005);
    node_fingerclaw_wave_1_46.rotation.set(0.0, 0.0, 0.0);
  }
  node_fingerclaw_wave_1_46.userData.sculptComponent = {"id":"fingerclaw-wave-1","name":"Finger claw R1","material":"claw-ivory"};
  node_fingerclaw_wave_1_46.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["finger-wave-1"] ?? root).add(node_fingerclaw_wave_1_46);
  nodes["fingerclaw-wave-1"] = node_fingerclaw_wave_1_46;
  const mesh_fingerclaw_wave_1_46Geometry = endpoint_fingerclaw_wave_1_46
    ? new THREE.CylinderGeometry(endpoint_fingerclaw_wave_1_46.endRadius, endpoint_fingerclaw_wave_1_46.baseRadius, endpoint_fingerclaw_wave_1_46.length, 16, 6)
    : new THREE.ConeGeometry(0.5, 1, 24, 1);
  if (!endpoint_fingerclaw_wave_1_46) {
    mesh_fingerclaw_wave_1_46Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_fingerclaw_wave_1_46 = new THREE.Mesh(
    mesh_fingerclaw_wave_1_46Geometry,
    materialMap["claw-ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_fingerclaw_wave_1_46.name = "Finger claw R1";
  if (endpoint_fingerclaw_wave_1_46) {
    mesh_fingerclaw_wave_1_46.position.copy(endpoint_fingerclaw_wave_1_46.midpoint);
    mesh_fingerclaw_wave_1_46.quaternion.copy(endpoint_fingerclaw_wave_1_46.quaternion);
  }
  mesh_fingerclaw_wave_1_46.castShadow = options.castShadow ?? true;
  mesh_fingerclaw_wave_1_46.receiveShadow = options.receiveShadow ?? true;
  mesh_fingerclaw_wave_1_46.userData.sculptComponent = {"id":"fingerclaw-wave-1","name":"Finger claw R1","material":"claw-ivory"};
  node_fingerclaw_wave_1_46.add(mesh_fingerclaw_wave_1_46);
  meshes["fingerclaw-wave-1"] = mesh_fingerclaw_wave_1_46;
  colliders["fingerclaw-wave-1"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["fingerclaw-wave-1"] ??= [];
  destructionGroups["fingerclaw-wave-1"].push(node_fingerclaw_wave_1_46);

  const attachment_finger_wave_2_47 = {"parentSocket": "sleeve-fore-wave-socket", "localStart": [-0.1, 0.31, 0.04], "localEnd": [-0.12, 0.43, 0.045], "contactType": "embed", "baseRadius": 0.042, "endRadius": 0.036, "embedDepth": 0.0252, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_finger_wave_2_47 = makeAttachmentEndpoint(attachment_finger_wave_2_47);
  const node_finger_wave_2_47 = new THREE.Group();
  node_finger_wave_2_47.name = "Finger R2__pivot";
  node_finger_wave_2_47.scale.set(1, 1, 1);
  if (endpoint_finger_wave_2_47) {
    node_finger_wave_2_47.position.copy(endpoint_finger_wave_2_47.start);
    node_finger_wave_2_47.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_finger_wave_2_47.position.set(-0.1, 0.31, 0.04);
    node_finger_wave_2_47.rotation.set(0.0, 0.0, 0.0);
  }
  node_finger_wave_2_47.userData.sculptComponent = {"id":"finger-wave-2","name":"Finger R2","material":"gold-skin"};
  node_finger_wave_2_47.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["sleeve-fore-wave"] ?? root).add(node_finger_wave_2_47);
  nodes["finger-wave-2"] = node_finger_wave_2_47;
  const mesh_finger_wave_2_47Geometry = endpoint_finger_wave_2_47
    ? new THREE.CylinderGeometry(endpoint_finger_wave_2_47.endRadius, endpoint_finger_wave_2_47.baseRadius, endpoint_finger_wave_2_47.length, 16, 6)
    : buildWatertightCapsule(0.35, 0.7, 8, 16, 1);
  if (!endpoint_finger_wave_2_47) {
    mesh_finger_wave_2_47Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_finger_wave_2_47 = new THREE.Mesh(
    mesh_finger_wave_2_47Geometry,
    materialMap["gold-skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_finger_wave_2_47.name = "Finger R2";
  if (endpoint_finger_wave_2_47) {
    mesh_finger_wave_2_47.position.copy(endpoint_finger_wave_2_47.midpoint);
    mesh_finger_wave_2_47.quaternion.copy(endpoint_finger_wave_2_47.quaternion);
  }
  mesh_finger_wave_2_47.castShadow = options.castShadow ?? true;
  mesh_finger_wave_2_47.receiveShadow = options.receiveShadow ?? true;
  mesh_finger_wave_2_47.userData.sculptComponent = {"id":"finger-wave-2","name":"Finger R2","material":"gold-skin"};
  node_finger_wave_2_47.add(mesh_finger_wave_2_47);
  meshes["finger-wave-2"] = mesh_finger_wave_2_47;
  colliders["finger-wave-2"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["finger-wave-2"] ??= [];
  destructionGroups["finger-wave-2"].push(node_finger_wave_2_47);

  const attachment_fingerclaw_wave_2_48 = {"parentSocket": "finger-wave-2-socket", "localStart": [-0.02, 0.115, 0.005], "localEnd": [-0.0316, 0.155, 0.01], "contactType": "embed", "baseRadius": 0.016, "endRadius": 0.003, "embedDepth": 0.0096, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_fingerclaw_wave_2_48 = makeAttachmentEndpoint(attachment_fingerclaw_wave_2_48);
  const node_fingerclaw_wave_2_48 = new THREE.Group();
  node_fingerclaw_wave_2_48.name = "Finger claw R2__pivot";
  node_fingerclaw_wave_2_48.scale.set(1, 1, 1);
  if (endpoint_fingerclaw_wave_2_48) {
    node_fingerclaw_wave_2_48.position.copy(endpoint_fingerclaw_wave_2_48.start);
    node_fingerclaw_wave_2_48.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_fingerclaw_wave_2_48.position.set(-0.02, 0.115, 0.005);
    node_fingerclaw_wave_2_48.rotation.set(0.0, 0.0, 0.0);
  }
  node_fingerclaw_wave_2_48.userData.sculptComponent = {"id":"fingerclaw-wave-2","name":"Finger claw R2","material":"claw-ivory"};
  node_fingerclaw_wave_2_48.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["finger-wave-2"] ?? root).add(node_fingerclaw_wave_2_48);
  nodes["fingerclaw-wave-2"] = node_fingerclaw_wave_2_48;
  const mesh_fingerclaw_wave_2_48Geometry = endpoint_fingerclaw_wave_2_48
    ? new THREE.CylinderGeometry(endpoint_fingerclaw_wave_2_48.endRadius, endpoint_fingerclaw_wave_2_48.baseRadius, endpoint_fingerclaw_wave_2_48.length, 16, 6)
    : new THREE.ConeGeometry(0.5, 1, 24, 1);
  if (!endpoint_fingerclaw_wave_2_48) {
    mesh_fingerclaw_wave_2_48Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_fingerclaw_wave_2_48 = new THREE.Mesh(
    mesh_fingerclaw_wave_2_48Geometry,
    materialMap["claw-ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_fingerclaw_wave_2_48.name = "Finger claw R2";
  if (endpoint_fingerclaw_wave_2_48) {
    mesh_fingerclaw_wave_2_48.position.copy(endpoint_fingerclaw_wave_2_48.midpoint);
    mesh_fingerclaw_wave_2_48.quaternion.copy(endpoint_fingerclaw_wave_2_48.quaternion);
  }
  mesh_fingerclaw_wave_2_48.castShadow = options.castShadow ?? true;
  mesh_fingerclaw_wave_2_48.receiveShadow = options.receiveShadow ?? true;
  mesh_fingerclaw_wave_2_48.userData.sculptComponent = {"id":"fingerclaw-wave-2","name":"Finger claw R2","material":"claw-ivory"};
  node_fingerclaw_wave_2_48.add(mesh_fingerclaw_wave_2_48);
  meshes["fingerclaw-wave-2"] = mesh_fingerclaw_wave_2_48;
  colliders["fingerclaw-wave-2"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["fingerclaw-wave-2"] ??= [];
  destructionGroups["fingerclaw-wave-2"].push(node_fingerclaw_wave_2_48);

  const attachment_finger_wave_3_49 = {"parentSocket": "sleeve-fore-wave-socket", "localStart": [-0.045, 0.31, 0.04], "localEnd": [-0.04, 0.415, 0.045], "contactType": "embed", "baseRadius": 0.042, "endRadius": 0.036, "embedDepth": 0.0252, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_finger_wave_3_49 = makeAttachmentEndpoint(attachment_finger_wave_3_49);
  const node_finger_wave_3_49 = new THREE.Group();
  node_finger_wave_3_49.name = "Finger R3__pivot";
  node_finger_wave_3_49.scale.set(1, 1, 1);
  if (endpoint_finger_wave_3_49) {
    node_finger_wave_3_49.position.copy(endpoint_finger_wave_3_49.start);
    node_finger_wave_3_49.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_finger_wave_3_49.position.set(-0.045, 0.31, 0.04);
    node_finger_wave_3_49.rotation.set(0.0, 0.0, 0.0);
  }
  node_finger_wave_3_49.userData.sculptComponent = {"id":"finger-wave-3","name":"Finger R3","material":"gold-skin"};
  node_finger_wave_3_49.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["sleeve-fore-wave"] ?? root).add(node_finger_wave_3_49);
  nodes["finger-wave-3"] = node_finger_wave_3_49;
  const mesh_finger_wave_3_49Geometry = endpoint_finger_wave_3_49
    ? new THREE.CylinderGeometry(endpoint_finger_wave_3_49.endRadius, endpoint_finger_wave_3_49.baseRadius, endpoint_finger_wave_3_49.length, 16, 6)
    : buildWatertightCapsule(0.35, 0.7, 8, 16, 1);
  if (!endpoint_finger_wave_3_49) {
    mesh_finger_wave_3_49Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_finger_wave_3_49 = new THREE.Mesh(
    mesh_finger_wave_3_49Geometry,
    materialMap["gold-skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_finger_wave_3_49.name = "Finger R3";
  if (endpoint_finger_wave_3_49) {
    mesh_finger_wave_3_49.position.copy(endpoint_finger_wave_3_49.midpoint);
    mesh_finger_wave_3_49.quaternion.copy(endpoint_finger_wave_3_49.quaternion);
  }
  mesh_finger_wave_3_49.castShadow = options.castShadow ?? true;
  mesh_finger_wave_3_49.receiveShadow = options.receiveShadow ?? true;
  mesh_finger_wave_3_49.userData.sculptComponent = {"id":"finger-wave-3","name":"Finger R3","material":"gold-skin"};
  node_finger_wave_3_49.add(mesh_finger_wave_3_49);
  meshes["finger-wave-3"] = mesh_finger_wave_3_49;
  colliders["finger-wave-3"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["finger-wave-3"] ??= [];
  destructionGroups["finger-wave-3"].push(node_finger_wave_3_49);

  const attachment_fingerclaw_wave_3_50 = {"parentSocket": "finger-wave-3-socket", "localStart": [0.005, 0.1, 0.005], "localEnd": [-0.005, 0.14, 0.01], "contactType": "embed", "baseRadius": 0.016, "endRadius": 0.003, "embedDepth": 0.0096, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_fingerclaw_wave_3_50 = makeAttachmentEndpoint(attachment_fingerclaw_wave_3_50);
  const node_fingerclaw_wave_3_50 = new THREE.Group();
  node_fingerclaw_wave_3_50.name = "Finger claw R3__pivot";
  node_fingerclaw_wave_3_50.scale.set(1, 1, 1);
  if (endpoint_fingerclaw_wave_3_50) {
    node_fingerclaw_wave_3_50.position.copy(endpoint_fingerclaw_wave_3_50.start);
    node_fingerclaw_wave_3_50.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_fingerclaw_wave_3_50.position.set(0.005, 0.1, 0.005);
    node_fingerclaw_wave_3_50.rotation.set(0.0, 0.0, 0.0);
  }
  node_fingerclaw_wave_3_50.userData.sculptComponent = {"id":"fingerclaw-wave-3","name":"Finger claw R3","material":"claw-ivory"};
  node_fingerclaw_wave_3_50.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["finger-wave-3"] ?? root).add(node_fingerclaw_wave_3_50);
  nodes["fingerclaw-wave-3"] = node_fingerclaw_wave_3_50;
  const mesh_fingerclaw_wave_3_50Geometry = endpoint_fingerclaw_wave_3_50
    ? new THREE.CylinderGeometry(endpoint_fingerclaw_wave_3_50.endRadius, endpoint_fingerclaw_wave_3_50.baseRadius, endpoint_fingerclaw_wave_3_50.length, 16, 6)
    : new THREE.ConeGeometry(0.5, 1, 24, 1);
  if (!endpoint_fingerclaw_wave_3_50) {
    mesh_fingerclaw_wave_3_50Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_fingerclaw_wave_3_50 = new THREE.Mesh(
    mesh_fingerclaw_wave_3_50Geometry,
    materialMap["claw-ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_fingerclaw_wave_3_50.name = "Finger claw R3";
  if (endpoint_fingerclaw_wave_3_50) {
    mesh_fingerclaw_wave_3_50.position.copy(endpoint_fingerclaw_wave_3_50.midpoint);
    mesh_fingerclaw_wave_3_50.quaternion.copy(endpoint_fingerclaw_wave_3_50.quaternion);
  }
  mesh_fingerclaw_wave_3_50.castShadow = options.castShadow ?? true;
  mesh_fingerclaw_wave_3_50.receiveShadow = options.receiveShadow ?? true;
  mesh_fingerclaw_wave_3_50.userData.sculptComponent = {"id":"fingerclaw-wave-3","name":"Finger claw R3","material":"claw-ivory"};
  node_fingerclaw_wave_3_50.add(mesh_fingerclaw_wave_3_50);
  meshes["fingerclaw-wave-3"] = mesh_fingerclaw_wave_3_50;
  colliders["fingerclaw-wave-3"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["fingerclaw-wave-3"] ??= [];
  destructionGroups["fingerclaw-wave-3"].push(node_fingerclaw_wave_3_50);

  const attachment_thumb_wave_51 = {"parentSocket": "sleeve-fore-wave-socket", "localStart": [-0.02, 0.23, 0.05], "localEnd": [0.06, 0.3, 0.06], "contactType": "embed", "baseRadius": 0.04, "endRadius": 0.034, "embedDepth": 0.024, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_thumb_wave_51 = makeAttachmentEndpoint(attachment_thumb_wave_51);
  const node_thumb_wave_51 = new THREE.Group();
  node_thumb_wave_51.name = "Thumb R__pivot";
  node_thumb_wave_51.scale.set(1, 1, 1);
  if (endpoint_thumb_wave_51) {
    node_thumb_wave_51.position.copy(endpoint_thumb_wave_51.start);
    node_thumb_wave_51.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_thumb_wave_51.position.set(-0.02, 0.23, 0.05);
    node_thumb_wave_51.rotation.set(0.0, 0.0, 0.0);
  }
  node_thumb_wave_51.userData.sculptComponent = {"id":"thumb-wave","name":"Thumb R","material":"gold-skin"};
  node_thumb_wave_51.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["sleeve-fore-wave"] ?? root).add(node_thumb_wave_51);
  nodes["thumb-wave"] = node_thumb_wave_51;
  const mesh_thumb_wave_51Geometry = endpoint_thumb_wave_51
    ? new THREE.CylinderGeometry(endpoint_thumb_wave_51.endRadius, endpoint_thumb_wave_51.baseRadius, endpoint_thumb_wave_51.length, 16, 6)
    : buildWatertightCapsule(0.35, 0.7, 8, 16, 1);
  if (!endpoint_thumb_wave_51) {
    mesh_thumb_wave_51Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_thumb_wave_51 = new THREE.Mesh(
    mesh_thumb_wave_51Geometry,
    materialMap["gold-skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_thumb_wave_51.name = "Thumb R";
  if (endpoint_thumb_wave_51) {
    mesh_thumb_wave_51.position.copy(endpoint_thumb_wave_51.midpoint);
    mesh_thumb_wave_51.quaternion.copy(endpoint_thumb_wave_51.quaternion);
  }
  mesh_thumb_wave_51.castShadow = options.castShadow ?? true;
  mesh_thumb_wave_51.receiveShadow = options.receiveShadow ?? true;
  mesh_thumb_wave_51.userData.sculptComponent = {"id":"thumb-wave","name":"Thumb R","material":"gold-skin"};
  node_thumb_wave_51.add(mesh_thumb_wave_51);
  meshes["thumb-wave"] = mesh_thumb_wave_51;
  colliders["thumb-wave"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["thumb-wave"] ??= [];
  destructionGroups["thumb-wave"].push(node_thumb_wave_51);

  const attachment_sleeve_upper_hip_52 = {"parentSocket": "kandura-socket", "localStart": [0.28, 1.0, 0.0], "localEnd": [0.43, 0.8, -0.03], "contactType": "socket-joint", "baseRadius": 0.085, "endRadius": 0.08, "embedDepth": 0.051, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_sleeve_upper_hip_52 = makeAttachmentEndpoint(attachment_sleeve_upper_hip_52);
  const node_sleeve_upper_hip_52 = new THREE.Group();
  node_sleeve_upper_hip_52.name = "Sleeve upper L (hand on hip)__pivot";
  node_sleeve_upper_hip_52.scale.set(1, 1, 1);
  if (endpoint_sleeve_upper_hip_52) {
    node_sleeve_upper_hip_52.position.copy(endpoint_sleeve_upper_hip_52.start);
    node_sleeve_upper_hip_52.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_sleeve_upper_hip_52.position.set(0.28, 1.0, 0.0);
    node_sleeve_upper_hip_52.rotation.set(0.0, 0.0, 0.0);
  }
  node_sleeve_upper_hip_52.userData.sculptComponent = {"id":"sleeve-upper-hip","name":"Sleeve upper L (hand on hip)","material":"cloth-white"};
  node_sleeve_upper_hip_52.userData.actionProfile = {"animationRole":"arm","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["kandura"] ?? root).add(node_sleeve_upper_hip_52);
  nodes["sleeve-upper-hip"] = node_sleeve_upper_hip_52;
  const mesh_sleeve_upper_hip_52Geometry = endpoint_sleeve_upper_hip_52
    ? new THREE.CylinderGeometry(endpoint_sleeve_upper_hip_52.endRadius, endpoint_sleeve_upper_hip_52.baseRadius, endpoint_sleeve_upper_hip_52.length, 16, 6)
    : buildWatertightCapsule(0.35, 0.7, 8, 16, 1);
  if (!endpoint_sleeve_upper_hip_52) {
    mesh_sleeve_upper_hip_52Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_sleeve_upper_hip_52 = new THREE.Mesh(
    mesh_sleeve_upper_hip_52Geometry,
    materialMap["cloth-white"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_sleeve_upper_hip_52.name = "Sleeve upper L (hand on hip)";
  if (endpoint_sleeve_upper_hip_52) {
    mesh_sleeve_upper_hip_52.position.copy(endpoint_sleeve_upper_hip_52.midpoint);
    mesh_sleeve_upper_hip_52.quaternion.copy(endpoint_sleeve_upper_hip_52.quaternion);
  }
  mesh_sleeve_upper_hip_52.castShadow = options.castShadow ?? true;
  mesh_sleeve_upper_hip_52.receiveShadow = options.receiveShadow ?? true;
  mesh_sleeve_upper_hip_52.userData.sculptComponent = {"id":"sleeve-upper-hip","name":"Sleeve upper L (hand on hip)","material":"cloth-white"};
  node_sleeve_upper_hip_52.add(mesh_sleeve_upper_hip_52);
  meshes["sleeve-upper-hip"] = mesh_sleeve_upper_hip_52;
  colliders["sleeve-upper-hip"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["sleeve-upper-hip"] ??= [];
  destructionGroups["sleeve-upper-hip"].push(node_sleeve_upper_hip_52);

  const attachment_sleeve_fore_hip_53 = {"parentSocket": "sleeve-upper-hip-socket", "localStart": [0.15, -0.2, -0.03], "localEnd": [0.02, -0.28, 0.13], "contactType": "socket-joint", "baseRadius": 0.085, "endRadius": 0.078, "embedDepth": 0.051, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_sleeve_fore_hip_53 = makeAttachmentEndpoint(attachment_sleeve_fore_hip_53);
  const node_sleeve_fore_hip_53 = new THREE.Group();
  node_sleeve_fore_hip_53.name = "Sleeve forearm L__pivot";
  node_sleeve_fore_hip_53.scale.set(1, 1, 1);
  if (endpoint_sleeve_fore_hip_53) {
    node_sleeve_fore_hip_53.position.copy(endpoint_sleeve_fore_hip_53.start);
    node_sleeve_fore_hip_53.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_sleeve_fore_hip_53.position.set(0.15, -0.2, -0.03);
    node_sleeve_fore_hip_53.rotation.set(0.0, 0.0, 0.0);
  }
  node_sleeve_fore_hip_53.userData.sculptComponent = {"id":"sleeve-fore-hip","name":"Sleeve forearm L","material":"cloth-white"};
  node_sleeve_fore_hip_53.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["sleeve-upper-hip"] ?? root).add(node_sleeve_fore_hip_53);
  nodes["sleeve-fore-hip"] = node_sleeve_fore_hip_53;
  const mesh_sleeve_fore_hip_53Geometry = endpoint_sleeve_fore_hip_53
    ? new THREE.CylinderGeometry(endpoint_sleeve_fore_hip_53.endRadius, endpoint_sleeve_fore_hip_53.baseRadius, endpoint_sleeve_fore_hip_53.length, 16, 6)
    : buildWatertightCapsule(0.35, 0.7, 8, 16, 1);
  if (!endpoint_sleeve_fore_hip_53) {
    mesh_sleeve_fore_hip_53Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_sleeve_fore_hip_53 = new THREE.Mesh(
    mesh_sleeve_fore_hip_53Geometry,
    materialMap["cloth-white"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_sleeve_fore_hip_53.name = "Sleeve forearm L";
  if (endpoint_sleeve_fore_hip_53) {
    mesh_sleeve_fore_hip_53.position.copy(endpoint_sleeve_fore_hip_53.midpoint);
    mesh_sleeve_fore_hip_53.quaternion.copy(endpoint_sleeve_fore_hip_53.quaternion);
  }
  mesh_sleeve_fore_hip_53.castShadow = options.castShadow ?? true;
  mesh_sleeve_fore_hip_53.receiveShadow = options.receiveShadow ?? true;
  mesh_sleeve_fore_hip_53.userData.sculptComponent = {"id":"sleeve-fore-hip","name":"Sleeve forearm L","material":"cloth-white"};
  node_sleeve_fore_hip_53.add(mesh_sleeve_fore_hip_53);
  meshes["sleeve-fore-hip"] = mesh_sleeve_fore_hip_53;
  colliders["sleeve-fore-hip"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["sleeve-fore-hip"] ??= [];
  destructionGroups["sleeve-fore-hip"].push(node_sleeve_fore_hip_53);

  const endpoint_hand_hip_54 = makeAttachmentEndpoint(null);
  const node_hand_hip_54 = new THREE.Group();
  node_hand_hip_54.name = "Hand L (on hip)__pivot";
  node_hand_hip_54.scale.set(1, 1, 1);
  if (endpoint_hand_hip_54) {
    node_hand_hip_54.position.copy(endpoint_hand_hip_54.start);
    node_hand_hip_54.rotation.set(0.3, 0.5, -0.4);
  } else {
    node_hand_hip_54.position.set(-0.18, -0.11, 0.23);
    node_hand_hip_54.rotation.set(0.3, 0.5, -0.4);
  }
  node_hand_hip_54.userData.sculptComponent = {"id":"hand-hip","name":"Hand L (on hip)","material":"gold-skin"};
  node_hand_hip_54.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["sleeve-fore-hip"] ?? root).add(node_hand_hip_54);
  nodes["hand-hip"] = node_hand_hip_54;
  const mesh_hand_hip_54Geometry = endpoint_hand_hip_54
    ? new THREE.CylinderGeometry(endpoint_hand_hip_54.endRadius, endpoint_hand_hip_54.baseRadius, endpoint_hand_hip_54.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_hand_hip_54) {
    mesh_hand_hip_54Geometry.scale(0.18, 0.15, 0.09);
  }
  const mesh_hand_hip_54 = new THREE.Mesh(
    mesh_hand_hip_54Geometry,
    materialMap["gold-skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_hand_hip_54.name = "Hand L (on hip)";
  if (endpoint_hand_hip_54) {
    mesh_hand_hip_54.position.copy(endpoint_hand_hip_54.midpoint);
    mesh_hand_hip_54.quaternion.copy(endpoint_hand_hip_54.quaternion);
  }
  mesh_hand_hip_54.castShadow = options.castShadow ?? true;
  mesh_hand_hip_54.receiveShadow = options.receiveShadow ?? true;
  mesh_hand_hip_54.userData.sculptComponent = {"id":"hand-hip","name":"Hand L (on hip)","material":"gold-skin"};
  node_hand_hip_54.add(mesh_hand_hip_54);
  meshes["hand-hip"] = mesh_hand_hip_54;
  colliders["hand-hip"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["hand-hip"] ??= [];
  destructionGroups["hand-hip"].push(node_hand_hip_54);

  const attachment_finger_hip_1_55 = {"parentSocket": "sleeve-fore-hip-socket", "localStart": [-0.23, -0.13, 0.25], "localEnd": [-0.28, -0.2, 0.26], "contactType": "embed", "baseRadius": 0.04, "endRadius": 0.034, "embedDepth": 0.024, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_finger_hip_1_55 = makeAttachmentEndpoint(attachment_finger_hip_1_55);
  const node_finger_hip_1_55 = new THREE.Group();
  node_finger_hip_1_55.name = "Finger L1__pivot";
  node_finger_hip_1_55.scale.set(1, 1, 1);
  if (endpoint_finger_hip_1_55) {
    node_finger_hip_1_55.position.copy(endpoint_finger_hip_1_55.start);
    node_finger_hip_1_55.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_finger_hip_1_55.position.set(-0.23, -0.13, 0.25);
    node_finger_hip_1_55.rotation.set(0.0, 0.0, 0.0);
  }
  node_finger_hip_1_55.userData.sculptComponent = {"id":"finger-hip-1","name":"Finger L1","material":"gold-skin"};
  node_finger_hip_1_55.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["sleeve-fore-hip"] ?? root).add(node_finger_hip_1_55);
  nodes["finger-hip-1"] = node_finger_hip_1_55;
  const mesh_finger_hip_1_55Geometry = endpoint_finger_hip_1_55
    ? new THREE.CylinderGeometry(endpoint_finger_hip_1_55.endRadius, endpoint_finger_hip_1_55.baseRadius, endpoint_finger_hip_1_55.length, 16, 6)
    : buildWatertightCapsule(0.35, 0.7, 8, 16, 1);
  if (!endpoint_finger_hip_1_55) {
    mesh_finger_hip_1_55Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_finger_hip_1_55 = new THREE.Mesh(
    mesh_finger_hip_1_55Geometry,
    materialMap["gold-skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_finger_hip_1_55.name = "Finger L1";
  if (endpoint_finger_hip_1_55) {
    mesh_finger_hip_1_55.position.copy(endpoint_finger_hip_1_55.midpoint);
    mesh_finger_hip_1_55.quaternion.copy(endpoint_finger_hip_1_55.quaternion);
  }
  mesh_finger_hip_1_55.castShadow = options.castShadow ?? true;
  mesh_finger_hip_1_55.receiveShadow = options.receiveShadow ?? true;
  mesh_finger_hip_1_55.userData.sculptComponent = {"id":"finger-hip-1","name":"Finger L1","material":"gold-skin"};
  node_finger_hip_1_55.add(mesh_finger_hip_1_55);
  meshes["finger-hip-1"] = mesh_finger_hip_1_55;
  colliders["finger-hip-1"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["finger-hip-1"] ??= [];
  destructionGroups["finger-hip-1"].push(node_finger_hip_1_55);

  const attachment_fingerclaw_hip_1_56 = {"parentSocket": "finger-hip-1-socket", "localStart": [-0.05, -0.065, 0.01], "localEnd": [-0.055, -0.105, 0.02], "contactType": "embed", "baseRadius": 0.015, "endRadius": 0.003, "embedDepth": 0.009, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_fingerclaw_hip_1_56 = makeAttachmentEndpoint(attachment_fingerclaw_hip_1_56);
  const node_fingerclaw_hip_1_56 = new THREE.Group();
  node_fingerclaw_hip_1_56.name = "Finger claw L1__pivot";
  node_fingerclaw_hip_1_56.scale.set(1, 1, 1);
  if (endpoint_fingerclaw_hip_1_56) {
    node_fingerclaw_hip_1_56.position.copy(endpoint_fingerclaw_hip_1_56.start);
    node_fingerclaw_hip_1_56.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_fingerclaw_hip_1_56.position.set(-0.05, -0.065, 0.01);
    node_fingerclaw_hip_1_56.rotation.set(0.0, 0.0, 0.0);
  }
  node_fingerclaw_hip_1_56.userData.sculptComponent = {"id":"fingerclaw-hip-1","name":"Finger claw L1","material":"claw-ivory"};
  node_fingerclaw_hip_1_56.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["finger-hip-1"] ?? root).add(node_fingerclaw_hip_1_56);
  nodes["fingerclaw-hip-1"] = node_fingerclaw_hip_1_56;
  const mesh_fingerclaw_hip_1_56Geometry = endpoint_fingerclaw_hip_1_56
    ? new THREE.CylinderGeometry(endpoint_fingerclaw_hip_1_56.endRadius, endpoint_fingerclaw_hip_1_56.baseRadius, endpoint_fingerclaw_hip_1_56.length, 16, 6)
    : new THREE.ConeGeometry(0.5, 1, 24, 1);
  if (!endpoint_fingerclaw_hip_1_56) {
    mesh_fingerclaw_hip_1_56Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_fingerclaw_hip_1_56 = new THREE.Mesh(
    mesh_fingerclaw_hip_1_56Geometry,
    materialMap["claw-ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_fingerclaw_hip_1_56.name = "Finger claw L1";
  if (endpoint_fingerclaw_hip_1_56) {
    mesh_fingerclaw_hip_1_56.position.copy(endpoint_fingerclaw_hip_1_56.midpoint);
    mesh_fingerclaw_hip_1_56.quaternion.copy(endpoint_fingerclaw_hip_1_56.quaternion);
  }
  mesh_fingerclaw_hip_1_56.castShadow = options.castShadow ?? true;
  mesh_fingerclaw_hip_1_56.receiveShadow = options.receiveShadow ?? true;
  mesh_fingerclaw_hip_1_56.userData.sculptComponent = {"id":"fingerclaw-hip-1","name":"Finger claw L1","material":"claw-ivory"};
  node_fingerclaw_hip_1_56.add(mesh_fingerclaw_hip_1_56);
  meshes["fingerclaw-hip-1"] = mesh_fingerclaw_hip_1_56;
  colliders["fingerclaw-hip-1"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["fingerclaw-hip-1"] ??= [];
  destructionGroups["fingerclaw-hip-1"].push(node_fingerclaw_hip_1_56);

  const attachment_finger_hip_2_57 = {"parentSocket": "sleeve-fore-hip-socket", "localStart": [-0.2, -0.15, 0.25], "localEnd": [-0.23, -0.23, 0.26], "contactType": "embed", "baseRadius": 0.04, "endRadius": 0.034, "embedDepth": 0.024, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_finger_hip_2_57 = makeAttachmentEndpoint(attachment_finger_hip_2_57);
  const node_finger_hip_2_57 = new THREE.Group();
  node_finger_hip_2_57.name = "Finger L2__pivot";
  node_finger_hip_2_57.scale.set(1, 1, 1);
  if (endpoint_finger_hip_2_57) {
    node_finger_hip_2_57.position.copy(endpoint_finger_hip_2_57.start);
    node_finger_hip_2_57.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_finger_hip_2_57.position.set(-0.2, -0.15, 0.25);
    node_finger_hip_2_57.rotation.set(0.0, 0.0, 0.0);
  }
  node_finger_hip_2_57.userData.sculptComponent = {"id":"finger-hip-2","name":"Finger L2","material":"gold-skin"};
  node_finger_hip_2_57.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["sleeve-fore-hip"] ?? root).add(node_finger_hip_2_57);
  nodes["finger-hip-2"] = node_finger_hip_2_57;
  const mesh_finger_hip_2_57Geometry = endpoint_finger_hip_2_57
    ? new THREE.CylinderGeometry(endpoint_finger_hip_2_57.endRadius, endpoint_finger_hip_2_57.baseRadius, endpoint_finger_hip_2_57.length, 16, 6)
    : buildWatertightCapsule(0.35, 0.7, 8, 16, 1);
  if (!endpoint_finger_hip_2_57) {
    mesh_finger_hip_2_57Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_finger_hip_2_57 = new THREE.Mesh(
    mesh_finger_hip_2_57Geometry,
    materialMap["gold-skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_finger_hip_2_57.name = "Finger L2";
  if (endpoint_finger_hip_2_57) {
    mesh_finger_hip_2_57.position.copy(endpoint_finger_hip_2_57.midpoint);
    mesh_finger_hip_2_57.quaternion.copy(endpoint_finger_hip_2_57.quaternion);
  }
  mesh_finger_hip_2_57.castShadow = options.castShadow ?? true;
  mesh_finger_hip_2_57.receiveShadow = options.receiveShadow ?? true;
  mesh_finger_hip_2_57.userData.sculptComponent = {"id":"finger-hip-2","name":"Finger L2","material":"gold-skin"};
  node_finger_hip_2_57.add(mesh_finger_hip_2_57);
  meshes["finger-hip-2"] = mesh_finger_hip_2_57;
  colliders["finger-hip-2"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["finger-hip-2"] ??= [];
  destructionGroups["finger-hip-2"].push(node_finger_hip_2_57);

  const attachment_fingerclaw_hip_2_58 = {"parentSocket": "finger-hip-2-socket", "localStart": [-0.03, -0.075, 0.01], "localEnd": [-0.035, -0.115, 0.02], "contactType": "embed", "baseRadius": 0.015, "endRadius": 0.003, "embedDepth": 0.009, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_fingerclaw_hip_2_58 = makeAttachmentEndpoint(attachment_fingerclaw_hip_2_58);
  const node_fingerclaw_hip_2_58 = new THREE.Group();
  node_fingerclaw_hip_2_58.name = "Finger claw L2__pivot";
  node_fingerclaw_hip_2_58.scale.set(1, 1, 1);
  if (endpoint_fingerclaw_hip_2_58) {
    node_fingerclaw_hip_2_58.position.copy(endpoint_fingerclaw_hip_2_58.start);
    node_fingerclaw_hip_2_58.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_fingerclaw_hip_2_58.position.set(-0.03, -0.075, 0.01);
    node_fingerclaw_hip_2_58.rotation.set(0.0, 0.0, 0.0);
  }
  node_fingerclaw_hip_2_58.userData.sculptComponent = {"id":"fingerclaw-hip-2","name":"Finger claw L2","material":"claw-ivory"};
  node_fingerclaw_hip_2_58.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["finger-hip-2"] ?? root).add(node_fingerclaw_hip_2_58);
  nodes["fingerclaw-hip-2"] = node_fingerclaw_hip_2_58;
  const mesh_fingerclaw_hip_2_58Geometry = endpoint_fingerclaw_hip_2_58
    ? new THREE.CylinderGeometry(endpoint_fingerclaw_hip_2_58.endRadius, endpoint_fingerclaw_hip_2_58.baseRadius, endpoint_fingerclaw_hip_2_58.length, 16, 6)
    : new THREE.ConeGeometry(0.5, 1, 24, 1);
  if (!endpoint_fingerclaw_hip_2_58) {
    mesh_fingerclaw_hip_2_58Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_fingerclaw_hip_2_58 = new THREE.Mesh(
    mesh_fingerclaw_hip_2_58Geometry,
    materialMap["claw-ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_fingerclaw_hip_2_58.name = "Finger claw L2";
  if (endpoint_fingerclaw_hip_2_58) {
    mesh_fingerclaw_hip_2_58.position.copy(endpoint_fingerclaw_hip_2_58.midpoint);
    mesh_fingerclaw_hip_2_58.quaternion.copy(endpoint_fingerclaw_hip_2_58.quaternion);
  }
  mesh_fingerclaw_hip_2_58.castShadow = options.castShadow ?? true;
  mesh_fingerclaw_hip_2_58.receiveShadow = options.receiveShadow ?? true;
  mesh_fingerclaw_hip_2_58.userData.sculptComponent = {"id":"fingerclaw-hip-2","name":"Finger claw L2","material":"claw-ivory"};
  node_fingerclaw_hip_2_58.add(mesh_fingerclaw_hip_2_58);
  meshes["fingerclaw-hip-2"] = mesh_fingerclaw_hip_2_58;
  colliders["fingerclaw-hip-2"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["fingerclaw-hip-2"] ??= [];
  destructionGroups["fingerclaw-hip-2"].push(node_fingerclaw_hip_2_58);

  const attachment_finger_hip_3_59 = {"parentSocket": "sleeve-fore-hip-socket", "localStart": [-0.16, -0.155, 0.25], "localEnd": [-0.17, -0.23, 0.26], "contactType": "embed", "baseRadius": 0.04, "endRadius": 0.034, "embedDepth": 0.024, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_finger_hip_3_59 = makeAttachmentEndpoint(attachment_finger_hip_3_59);
  const node_finger_hip_3_59 = new THREE.Group();
  node_finger_hip_3_59.name = "Finger L3__pivot";
  node_finger_hip_3_59.scale.set(1, 1, 1);
  if (endpoint_finger_hip_3_59) {
    node_finger_hip_3_59.position.copy(endpoint_finger_hip_3_59.start);
    node_finger_hip_3_59.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_finger_hip_3_59.position.set(-0.16, -0.155, 0.25);
    node_finger_hip_3_59.rotation.set(0.0, 0.0, 0.0);
  }
  node_finger_hip_3_59.userData.sculptComponent = {"id":"finger-hip-3","name":"Finger L3","material":"gold-skin"};
  node_finger_hip_3_59.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["sleeve-fore-hip"] ?? root).add(node_finger_hip_3_59);
  nodes["finger-hip-3"] = node_finger_hip_3_59;
  const mesh_finger_hip_3_59Geometry = endpoint_finger_hip_3_59
    ? new THREE.CylinderGeometry(endpoint_finger_hip_3_59.endRadius, endpoint_finger_hip_3_59.baseRadius, endpoint_finger_hip_3_59.length, 16, 6)
    : buildWatertightCapsule(0.35, 0.7, 8, 16, 1);
  if (!endpoint_finger_hip_3_59) {
    mesh_finger_hip_3_59Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_finger_hip_3_59 = new THREE.Mesh(
    mesh_finger_hip_3_59Geometry,
    materialMap["gold-skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_finger_hip_3_59.name = "Finger L3";
  if (endpoint_finger_hip_3_59) {
    mesh_finger_hip_3_59.position.copy(endpoint_finger_hip_3_59.midpoint);
    mesh_finger_hip_3_59.quaternion.copy(endpoint_finger_hip_3_59.quaternion);
  }
  mesh_finger_hip_3_59.castShadow = options.castShadow ?? true;
  mesh_finger_hip_3_59.receiveShadow = options.receiveShadow ?? true;
  mesh_finger_hip_3_59.userData.sculptComponent = {"id":"finger-hip-3","name":"Finger L3","material":"gold-skin"};
  node_finger_hip_3_59.add(mesh_finger_hip_3_59);
  meshes["finger-hip-3"] = mesh_finger_hip_3_59;
  colliders["finger-hip-3"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["finger-hip-3"] ??= [];
  destructionGroups["finger-hip-3"].push(node_finger_hip_3_59);

  const attachment_fingerclaw_hip_3_60 = {"parentSocket": "finger-hip-3-socket", "localStart": [-0.01, -0.07, 0.01], "localEnd": [-0.015, -0.11, 0.02], "contactType": "embed", "baseRadius": 0.015, "endRadius": 0.003, "embedDepth": 0.009, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_fingerclaw_hip_3_60 = makeAttachmentEndpoint(attachment_fingerclaw_hip_3_60);
  const node_fingerclaw_hip_3_60 = new THREE.Group();
  node_fingerclaw_hip_3_60.name = "Finger claw L3__pivot";
  node_fingerclaw_hip_3_60.scale.set(1, 1, 1);
  if (endpoint_fingerclaw_hip_3_60) {
    node_fingerclaw_hip_3_60.position.copy(endpoint_fingerclaw_hip_3_60.start);
    node_fingerclaw_hip_3_60.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_fingerclaw_hip_3_60.position.set(-0.01, -0.07, 0.01);
    node_fingerclaw_hip_3_60.rotation.set(0.0, 0.0, 0.0);
  }
  node_fingerclaw_hip_3_60.userData.sculptComponent = {"id":"fingerclaw-hip-3","name":"Finger claw L3","material":"claw-ivory"};
  node_fingerclaw_hip_3_60.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["finger-hip-3"] ?? root).add(node_fingerclaw_hip_3_60);
  nodes["fingerclaw-hip-3"] = node_fingerclaw_hip_3_60;
  const mesh_fingerclaw_hip_3_60Geometry = endpoint_fingerclaw_hip_3_60
    ? new THREE.CylinderGeometry(endpoint_fingerclaw_hip_3_60.endRadius, endpoint_fingerclaw_hip_3_60.baseRadius, endpoint_fingerclaw_hip_3_60.length, 16, 6)
    : new THREE.ConeGeometry(0.5, 1, 24, 1);
  if (!endpoint_fingerclaw_hip_3_60) {
    mesh_fingerclaw_hip_3_60Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_fingerclaw_hip_3_60 = new THREE.Mesh(
    mesh_fingerclaw_hip_3_60Geometry,
    materialMap["claw-ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_fingerclaw_hip_3_60.name = "Finger claw L3";
  if (endpoint_fingerclaw_hip_3_60) {
    mesh_fingerclaw_hip_3_60.position.copy(endpoint_fingerclaw_hip_3_60.midpoint);
    mesh_fingerclaw_hip_3_60.quaternion.copy(endpoint_fingerclaw_hip_3_60.quaternion);
  }
  mesh_fingerclaw_hip_3_60.castShadow = options.castShadow ?? true;
  mesh_fingerclaw_hip_3_60.receiveShadow = options.receiveShadow ?? true;
  mesh_fingerclaw_hip_3_60.userData.sculptComponent = {"id":"fingerclaw-hip-3","name":"Finger claw L3","material":"claw-ivory"};
  node_fingerclaw_hip_3_60.add(mesh_fingerclaw_hip_3_60);
  meshes["fingerclaw-hip-3"] = mesh_fingerclaw_hip_3_60;
  colliders["fingerclaw-hip-3"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["fingerclaw-hip-3"] ??= [];
  destructionGroups["fingerclaw-hip-3"].push(node_fingerclaw_hip_3_60);

  const endpoint_wing_membrane_r_61 = makeAttachmentEndpoint(null);
  const node_wing_membrane_r_61 = new THREE.Group();
  node_wing_membrane_r_61.name = "Wing membrane R__pivot";
  node_wing_membrane_r_61.scale.set(1, 1, 1);
  if (endpoint_wing_membrane_r_61) {
    node_wing_membrane_r_61.position.copy(endpoint_wing_membrane_r_61.start);
    node_wing_membrane_r_61.rotation.set(-0.12, -0.35, 0.0);
  } else {
    node_wing_membrane_r_61.position.set(-0.13, 1.04, -0.24);
    node_wing_membrane_r_61.rotation.set(-0.12, -0.35, 0.0);
  }
  node_wing_membrane_r_61.userData.sculptComponent = {"id":"wing-membrane-r","name":"Wing membrane R","material":"membrane-cream"};
  node_wing_membrane_r_61.userData.actionProfile = {"animationRole":"wing","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["kandura"] ?? root).add(node_wing_membrane_r_61);
  nodes["wing-membrane-r"] = node_wing_membrane_r_61;
  const mesh_wing_membrane_r_61Geometry = endpoint_wing_membrane_r_61
    ? new THREE.CylinderGeometry(endpoint_wing_membrane_r_61.endRadius, endpoint_wing_membrane_r_61.baseRadius, endpoint_wing_membrane_r_61.length, 16, 6)
    : buildExtrudeGeometry({"points": [[-0.04, -0.08], [-0.2, -0.16], [-0.34, -0.3], [-0.45, -0.24], [-0.58, -0.36], [-0.7, -0.29], [-0.87, -0.37], [-0.63, 0.03], [-0.33, 0.22], [0, 0]], "depth": 0.014});
  if (!endpoint_wing_membrane_r_61) {
    mesh_wing_membrane_r_61Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_wing_membrane_r_61 = new THREE.Mesh(
    mesh_wing_membrane_r_61Geometry,
    materialMap["membrane-cream"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_wing_membrane_r_61.name = "Wing membrane R";
  if (endpoint_wing_membrane_r_61) {
    mesh_wing_membrane_r_61.position.copy(endpoint_wing_membrane_r_61.midpoint);
    mesh_wing_membrane_r_61.quaternion.copy(endpoint_wing_membrane_r_61.quaternion);
  }
  mesh_wing_membrane_r_61.castShadow = options.castShadow ?? true;
  mesh_wing_membrane_r_61.receiveShadow = options.receiveShadow ?? true;
  mesh_wing_membrane_r_61.userData.sculptComponent = {"id":"wing-membrane-r","name":"Wing membrane R","material":"membrane-cream"};
  node_wing_membrane_r_61.add(mesh_wing_membrane_r_61);
  meshes["wing-membrane-r"] = mesh_wing_membrane_r_61;
  colliders["wing-membrane-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["wing-membrane-r"] ??= [];
  destructionGroups["wing-membrane-r"].push(node_wing_membrane_r_61);

  const endpoint_wing_spar_lead_r_62 = makeAttachmentEndpoint(null);
  const node_wing_spar_lead_r_62 = new THREE.Group();
  node_wing_spar_lead_r_62.name = "Wing Spar Lead R__pivot";
  node_wing_spar_lead_r_62.scale.set(1, 1, 1);
  if (endpoint_wing_spar_lead_r_62) {
    node_wing_spar_lead_r_62.position.copy(endpoint_wing_spar_lead_r_62.start);
    node_wing_spar_lead_r_62.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_wing_spar_lead_r_62.position.set(0.0, 0.0, 0.0);
    node_wing_spar_lead_r_62.rotation.set(0.0, 0.0, 0.0);
  }
  node_wing_spar_lead_r_62.userData.sculptComponent = {"id":"wing-spar-lead-r","name":"Wing Spar Lead R","material":"gold-skin"};
  node_wing_spar_lead_r_62.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["wing-membrane-r"] ?? root).add(node_wing_spar_lead_r_62);
  nodes["wing-spar-lead-r"] = node_wing_spar_lead_r_62;
  const mesh_wing_spar_lead_r_62Geometry = endpoint_wing_spar_lead_r_62
    ? new THREE.CylinderGeometry(endpoint_wing_spar_lead_r_62.endRadius, endpoint_wing_spar_lead_r_62.baseRadius, endpoint_wing_spar_lead_r_62.length, 16, 6)
    : buildTaperedSweepGeometry({"stations": [{"position": [-0.0, 0.0, 0.007], "rx": 0.046, "rz": 0.0368, "twist": 0.0}, {"position": [-0.17, 0.12, 0.007], "rx": 0.0362, "rz": 0.029, "twist": 0.0}, {"position": [-0.33, 0.22, 0.007], "rx": 0.0264, "rz": 0.0212, "twist": 0.0}, {"position": [-0.62, 0.0, 0.007], "rx": 0.0167, "rz": 0.0133, "twist": 0.0}, {"position": [-0.87, -0.37, 0.007], "rx": 0.0, "rz": 0.0, "twist": 0.0}], "radialSegments": 10, "capEnds": true});
  if (!endpoint_wing_spar_lead_r_62) {
    mesh_wing_spar_lead_r_62Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_wing_spar_lead_r_62 = new THREE.Mesh(
    mesh_wing_spar_lead_r_62Geometry,
    materialMap["gold-skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_wing_spar_lead_r_62.name = "Wing Spar Lead R";
  if (endpoint_wing_spar_lead_r_62) {
    mesh_wing_spar_lead_r_62.position.copy(endpoint_wing_spar_lead_r_62.midpoint);
    mesh_wing_spar_lead_r_62.quaternion.copy(endpoint_wing_spar_lead_r_62.quaternion);
  }
  mesh_wing_spar_lead_r_62.castShadow = options.castShadow ?? true;
  mesh_wing_spar_lead_r_62.receiveShadow = options.receiveShadow ?? true;
  mesh_wing_spar_lead_r_62.userData.sculptComponent = {"id":"wing-spar-lead-r","name":"Wing Spar Lead R","material":"gold-skin"};
  node_wing_spar_lead_r_62.add(mesh_wing_spar_lead_r_62);
  meshes["wing-spar-lead-r"] = mesh_wing_spar_lead_r_62;
  colliders["wing-spar-lead-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["wing-spar-lead-r"] ??= [];
  destructionGroups["wing-spar-lead-r"].push(node_wing_spar_lead_r_62);

  const endpoint_wing_spar_mid_r_63 = makeAttachmentEndpoint(null);
  const node_wing_spar_mid_r_63 = new THREE.Group();
  node_wing_spar_mid_r_63.name = "Wing Spar Mid R__pivot";
  node_wing_spar_mid_r_63.scale.set(1, 1, 1);
  if (endpoint_wing_spar_mid_r_63) {
    node_wing_spar_mid_r_63.position.copy(endpoint_wing_spar_mid_r_63.start);
    node_wing_spar_mid_r_63.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_wing_spar_mid_r_63.position.set(0.0, 0.0, 0.0);
    node_wing_spar_mid_r_63.rotation.set(0.0, 0.0, 0.0);
  }
  node_wing_spar_mid_r_63.userData.sculptComponent = {"id":"wing-spar-mid-r","name":"Wing Spar Mid R","material":"gold-skin"};
  node_wing_spar_mid_r_63.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["wing-membrane-r"] ?? root).add(node_wing_spar_mid_r_63);
  nodes["wing-spar-mid-r"] = node_wing_spar_mid_r_63;
  const mesh_wing_spar_mid_r_63Geometry = endpoint_wing_spar_mid_r_63
    ? new THREE.CylinderGeometry(endpoint_wing_spar_mid_r_63.endRadius, endpoint_wing_spar_mid_r_63.baseRadius, endpoint_wing_spar_mid_r_63.length, 16, 6)
    : buildTaperedSweepGeometry({"stations": [{"position": [-0.33, 0.22, 0.007], "rx": 0.034, "rz": 0.0272, "twist": 0.0}, {"position": [-0.48, -0.04, 0.007], "rx": 0.0196, "rz": 0.0156, "twist": 0.0}, {"position": [-0.58, -0.36, 0.007], "rx": 0.0, "rz": 0.0, "twist": 0.0}], "radialSegments": 10, "capEnds": true});
  if (!endpoint_wing_spar_mid_r_63) {
    mesh_wing_spar_mid_r_63Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_wing_spar_mid_r_63 = new THREE.Mesh(
    mesh_wing_spar_mid_r_63Geometry,
    materialMap["gold-skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_wing_spar_mid_r_63.name = "Wing Spar Mid R";
  if (endpoint_wing_spar_mid_r_63) {
    mesh_wing_spar_mid_r_63.position.copy(endpoint_wing_spar_mid_r_63.midpoint);
    mesh_wing_spar_mid_r_63.quaternion.copy(endpoint_wing_spar_mid_r_63.quaternion);
  }
  mesh_wing_spar_mid_r_63.castShadow = options.castShadow ?? true;
  mesh_wing_spar_mid_r_63.receiveShadow = options.receiveShadow ?? true;
  mesh_wing_spar_mid_r_63.userData.sculptComponent = {"id":"wing-spar-mid-r","name":"Wing Spar Mid R","material":"gold-skin"};
  node_wing_spar_mid_r_63.add(mesh_wing_spar_mid_r_63);
  meshes["wing-spar-mid-r"] = mesh_wing_spar_mid_r_63;
  colliders["wing-spar-mid-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["wing-spar-mid-r"] ??= [];
  destructionGroups["wing-spar-mid-r"].push(node_wing_spar_mid_r_63);

  const endpoint_wing_spar_low_r_64 = makeAttachmentEndpoint(null);
  const node_wing_spar_low_r_64 = new THREE.Group();
  node_wing_spar_low_r_64.name = "Wing Spar Low R__pivot";
  node_wing_spar_low_r_64.scale.set(1, 1, 1);
  if (endpoint_wing_spar_low_r_64) {
    node_wing_spar_low_r_64.position.copy(endpoint_wing_spar_low_r_64.start);
    node_wing_spar_low_r_64.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_wing_spar_low_r_64.position.set(0.0, 0.0, 0.0);
    node_wing_spar_low_r_64.rotation.set(0.0, 0.0, 0.0);
  }
  node_wing_spar_low_r_64.userData.sculptComponent = {"id":"wing-spar-low-r","name":"Wing Spar Low R","material":"gold-skin"};
  node_wing_spar_low_r_64.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["wing-membrane-r"] ?? root).add(node_wing_spar_low_r_64);
  nodes["wing-spar-low-r"] = node_wing_spar_low_r_64;
  const mesh_wing_spar_low_r_64Geometry = endpoint_wing_spar_low_r_64
    ? new THREE.CylinderGeometry(endpoint_wing_spar_low_r_64.endRadius, endpoint_wing_spar_low_r_64.baseRadius, endpoint_wing_spar_low_r_64.length, 16, 6)
    : buildTaperedSweepGeometry({"stations": [{"position": [-0.33, 0.22, 0.007], "rx": 0.03, "rz": 0.024, "twist": 0.0}, {"position": [-0.35, -0.04, 0.007], "rx": 0.0172, "rz": 0.0138, "twist": 0.0}, {"position": [-0.34, -0.3, 0.007], "rx": 0.0, "rz": 0.0, "twist": 0.0}], "radialSegments": 10, "capEnds": true});
  if (!endpoint_wing_spar_low_r_64) {
    mesh_wing_spar_low_r_64Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_wing_spar_low_r_64 = new THREE.Mesh(
    mesh_wing_spar_low_r_64Geometry,
    materialMap["gold-skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_wing_spar_low_r_64.name = "Wing Spar Low R";
  if (endpoint_wing_spar_low_r_64) {
    mesh_wing_spar_low_r_64.position.copy(endpoint_wing_spar_low_r_64.midpoint);
    mesh_wing_spar_low_r_64.quaternion.copy(endpoint_wing_spar_low_r_64.quaternion);
  }
  mesh_wing_spar_low_r_64.castShadow = options.castShadow ?? true;
  mesh_wing_spar_low_r_64.receiveShadow = options.receiveShadow ?? true;
  mesh_wing_spar_low_r_64.userData.sculptComponent = {"id":"wing-spar-low-r","name":"Wing Spar Low R","material":"gold-skin"};
  node_wing_spar_low_r_64.add(mesh_wing_spar_low_r_64);
  meshes["wing-spar-low-r"] = mesh_wing_spar_low_r_64;
  colliders["wing-spar-low-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["wing-spar-low-r"] ??= [];
  destructionGroups["wing-spar-low-r"].push(node_wing_spar_low_r_64);

  const attachment_wing_claw_r_65 = {"parentSocket": "wing-membrane-r-socket", "localStart": [-0.33, 0.22, 0.007], "localEnd": [-0.34, 0.3, 0.01], "contactType": "embed", "baseRadius": 0.024, "endRadius": 0.003, "embedDepth": 0.0144, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_wing_claw_r_65 = makeAttachmentEndpoint(attachment_wing_claw_r_65);
  const node_wing_claw_r_65 = new THREE.Group();
  node_wing_claw_r_65.name = "Wing claw R__pivot";
  node_wing_claw_r_65.scale.set(1, 1, 1);
  if (endpoint_wing_claw_r_65) {
    node_wing_claw_r_65.position.copy(endpoint_wing_claw_r_65.start);
    node_wing_claw_r_65.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_wing_claw_r_65.position.set(-0.33, 0.22, 0.007);
    node_wing_claw_r_65.rotation.set(0.0, 0.0, 0.0);
  }
  node_wing_claw_r_65.userData.sculptComponent = {"id":"wing-claw-r","name":"Wing claw R","material":"claw-ivory"};
  node_wing_claw_r_65.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["wing-membrane-r"] ?? root).add(node_wing_claw_r_65);
  nodes["wing-claw-r"] = node_wing_claw_r_65;
  const mesh_wing_claw_r_65Geometry = endpoint_wing_claw_r_65
    ? new THREE.CylinderGeometry(endpoint_wing_claw_r_65.endRadius, endpoint_wing_claw_r_65.baseRadius, endpoint_wing_claw_r_65.length, 16, 6)
    : new THREE.ConeGeometry(0.5, 1, 24, 1);
  if (!endpoint_wing_claw_r_65) {
    mesh_wing_claw_r_65Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_wing_claw_r_65 = new THREE.Mesh(
    mesh_wing_claw_r_65Geometry,
    materialMap["claw-ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_wing_claw_r_65.name = "Wing claw R";
  if (endpoint_wing_claw_r_65) {
    mesh_wing_claw_r_65.position.copy(endpoint_wing_claw_r_65.midpoint);
    mesh_wing_claw_r_65.quaternion.copy(endpoint_wing_claw_r_65.quaternion);
  }
  mesh_wing_claw_r_65.castShadow = options.castShadow ?? true;
  mesh_wing_claw_r_65.receiveShadow = options.receiveShadow ?? true;
  mesh_wing_claw_r_65.userData.sculptComponent = {"id":"wing-claw-r","name":"Wing claw R","material":"claw-ivory"};
  node_wing_claw_r_65.add(mesh_wing_claw_r_65);
  meshes["wing-claw-r"] = mesh_wing_claw_r_65;
  colliders["wing-claw-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["wing-claw-r"] ??= [];
  destructionGroups["wing-claw-r"].push(node_wing_claw_r_65);

  const endpoint_wing_membrane_l_66 = makeAttachmentEndpoint(null);
  const node_wing_membrane_l_66 = new THREE.Group();
  node_wing_membrane_l_66.name = "Wing membrane L__pivot";
  node_wing_membrane_l_66.scale.set(1, 1, 1);
  if (endpoint_wing_membrane_l_66) {
    node_wing_membrane_l_66.position.copy(endpoint_wing_membrane_l_66.start);
    node_wing_membrane_l_66.rotation.set(-0.12, 0.35, 0.0);
  } else {
    node_wing_membrane_l_66.position.set(0.13, 1.04, -0.24);
    node_wing_membrane_l_66.rotation.set(-0.12, 0.35, 0.0);
  }
  node_wing_membrane_l_66.userData.sculptComponent = {"id":"wing-membrane-l","name":"Wing membrane L","material":"membrane-cream"};
  node_wing_membrane_l_66.userData.actionProfile = {"animationRole":"wing","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["kandura"] ?? root).add(node_wing_membrane_l_66);
  nodes["wing-membrane-l"] = node_wing_membrane_l_66;
  const mesh_wing_membrane_l_66Geometry = endpoint_wing_membrane_l_66
    ? new THREE.CylinderGeometry(endpoint_wing_membrane_l_66.endRadius, endpoint_wing_membrane_l_66.baseRadius, endpoint_wing_membrane_l_66.length, 16, 6)
    : buildExtrudeGeometry({"points": [[0, 0], [0.33, 0.22], [0.63, 0.03], [0.87, -0.37], [0.7, -0.29], [0.58, -0.36], [0.45, -0.24], [0.34, -0.3], [0.2, -0.16], [0.04, -0.08]], "depth": 0.014});
  if (!endpoint_wing_membrane_l_66) {
    mesh_wing_membrane_l_66Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_wing_membrane_l_66 = new THREE.Mesh(
    mesh_wing_membrane_l_66Geometry,
    materialMap["membrane-cream"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_wing_membrane_l_66.name = "Wing membrane L";
  if (endpoint_wing_membrane_l_66) {
    mesh_wing_membrane_l_66.position.copy(endpoint_wing_membrane_l_66.midpoint);
    mesh_wing_membrane_l_66.quaternion.copy(endpoint_wing_membrane_l_66.quaternion);
  }
  mesh_wing_membrane_l_66.castShadow = options.castShadow ?? true;
  mesh_wing_membrane_l_66.receiveShadow = options.receiveShadow ?? true;
  mesh_wing_membrane_l_66.userData.sculptComponent = {"id":"wing-membrane-l","name":"Wing membrane L","material":"membrane-cream"};
  node_wing_membrane_l_66.add(mesh_wing_membrane_l_66);
  meshes["wing-membrane-l"] = mesh_wing_membrane_l_66;
  colliders["wing-membrane-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["wing-membrane-l"] ??= [];
  destructionGroups["wing-membrane-l"].push(node_wing_membrane_l_66);

  const endpoint_wing_spar_lead_l_67 = makeAttachmentEndpoint(null);
  const node_wing_spar_lead_l_67 = new THREE.Group();
  node_wing_spar_lead_l_67.name = "Wing Spar Lead L__pivot";
  node_wing_spar_lead_l_67.scale.set(1, 1, 1);
  if (endpoint_wing_spar_lead_l_67) {
    node_wing_spar_lead_l_67.position.copy(endpoint_wing_spar_lead_l_67.start);
    node_wing_spar_lead_l_67.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_wing_spar_lead_l_67.position.set(0.0, 0.0, 0.0);
    node_wing_spar_lead_l_67.rotation.set(0.0, 0.0, 0.0);
  }
  node_wing_spar_lead_l_67.userData.sculptComponent = {"id":"wing-spar-lead-l","name":"Wing Spar Lead L","material":"gold-skin"};
  node_wing_spar_lead_l_67.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["wing-membrane-l"] ?? root).add(node_wing_spar_lead_l_67);
  nodes["wing-spar-lead-l"] = node_wing_spar_lead_l_67;
  const mesh_wing_spar_lead_l_67Geometry = endpoint_wing_spar_lead_l_67
    ? new THREE.CylinderGeometry(endpoint_wing_spar_lead_l_67.endRadius, endpoint_wing_spar_lead_l_67.baseRadius, endpoint_wing_spar_lead_l_67.length, 16, 6)
    : buildTaperedSweepGeometry({"stations": [{"position": [0.0, 0.0, 0.007], "rx": 0.046, "rz": 0.0368, "twist": 0.0}, {"position": [0.17, 0.12, 0.007], "rx": 0.0362, "rz": 0.029, "twist": 0.0}, {"position": [0.33, 0.22, 0.007], "rx": 0.0264, "rz": 0.0212, "twist": 0.0}, {"position": [0.62, 0.0, 0.007], "rx": 0.0167, "rz": 0.0133, "twist": 0.0}, {"position": [0.87, -0.37, 0.007], "rx": 0.0, "rz": 0.0, "twist": 0.0}], "radialSegments": 10, "capEnds": true});
  if (!endpoint_wing_spar_lead_l_67) {
    mesh_wing_spar_lead_l_67Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_wing_spar_lead_l_67 = new THREE.Mesh(
    mesh_wing_spar_lead_l_67Geometry,
    materialMap["gold-skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_wing_spar_lead_l_67.name = "Wing Spar Lead L";
  if (endpoint_wing_spar_lead_l_67) {
    mesh_wing_spar_lead_l_67.position.copy(endpoint_wing_spar_lead_l_67.midpoint);
    mesh_wing_spar_lead_l_67.quaternion.copy(endpoint_wing_spar_lead_l_67.quaternion);
  }
  mesh_wing_spar_lead_l_67.castShadow = options.castShadow ?? true;
  mesh_wing_spar_lead_l_67.receiveShadow = options.receiveShadow ?? true;
  mesh_wing_spar_lead_l_67.userData.sculptComponent = {"id":"wing-spar-lead-l","name":"Wing Spar Lead L","material":"gold-skin"};
  node_wing_spar_lead_l_67.add(mesh_wing_spar_lead_l_67);
  meshes["wing-spar-lead-l"] = mesh_wing_spar_lead_l_67;
  colliders["wing-spar-lead-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["wing-spar-lead-l"] ??= [];
  destructionGroups["wing-spar-lead-l"].push(node_wing_spar_lead_l_67);

  const endpoint_wing_spar_mid_l_68 = makeAttachmentEndpoint(null);
  const node_wing_spar_mid_l_68 = new THREE.Group();
  node_wing_spar_mid_l_68.name = "Wing Spar Mid L__pivot";
  node_wing_spar_mid_l_68.scale.set(1, 1, 1);
  if (endpoint_wing_spar_mid_l_68) {
    node_wing_spar_mid_l_68.position.copy(endpoint_wing_spar_mid_l_68.start);
    node_wing_spar_mid_l_68.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_wing_spar_mid_l_68.position.set(0.0, 0.0, 0.0);
    node_wing_spar_mid_l_68.rotation.set(0.0, 0.0, 0.0);
  }
  node_wing_spar_mid_l_68.userData.sculptComponent = {"id":"wing-spar-mid-l","name":"Wing Spar Mid L","material":"gold-skin"};
  node_wing_spar_mid_l_68.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["wing-membrane-l"] ?? root).add(node_wing_spar_mid_l_68);
  nodes["wing-spar-mid-l"] = node_wing_spar_mid_l_68;
  const mesh_wing_spar_mid_l_68Geometry = endpoint_wing_spar_mid_l_68
    ? new THREE.CylinderGeometry(endpoint_wing_spar_mid_l_68.endRadius, endpoint_wing_spar_mid_l_68.baseRadius, endpoint_wing_spar_mid_l_68.length, 16, 6)
    : buildTaperedSweepGeometry({"stations": [{"position": [0.33, 0.22, 0.007], "rx": 0.034, "rz": 0.0272, "twist": 0.0}, {"position": [0.48, -0.04, 0.007], "rx": 0.0196, "rz": 0.0156, "twist": 0.0}, {"position": [0.58, -0.36, 0.007], "rx": 0.0, "rz": 0.0, "twist": 0.0}], "radialSegments": 10, "capEnds": true});
  if (!endpoint_wing_spar_mid_l_68) {
    mesh_wing_spar_mid_l_68Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_wing_spar_mid_l_68 = new THREE.Mesh(
    mesh_wing_spar_mid_l_68Geometry,
    materialMap["gold-skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_wing_spar_mid_l_68.name = "Wing Spar Mid L";
  if (endpoint_wing_spar_mid_l_68) {
    mesh_wing_spar_mid_l_68.position.copy(endpoint_wing_spar_mid_l_68.midpoint);
    mesh_wing_spar_mid_l_68.quaternion.copy(endpoint_wing_spar_mid_l_68.quaternion);
  }
  mesh_wing_spar_mid_l_68.castShadow = options.castShadow ?? true;
  mesh_wing_spar_mid_l_68.receiveShadow = options.receiveShadow ?? true;
  mesh_wing_spar_mid_l_68.userData.sculptComponent = {"id":"wing-spar-mid-l","name":"Wing Spar Mid L","material":"gold-skin"};
  node_wing_spar_mid_l_68.add(mesh_wing_spar_mid_l_68);
  meshes["wing-spar-mid-l"] = mesh_wing_spar_mid_l_68;
  colliders["wing-spar-mid-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["wing-spar-mid-l"] ??= [];
  destructionGroups["wing-spar-mid-l"].push(node_wing_spar_mid_l_68);

  const endpoint_wing_spar_low_l_69 = makeAttachmentEndpoint(null);
  const node_wing_spar_low_l_69 = new THREE.Group();
  node_wing_spar_low_l_69.name = "Wing Spar Low L__pivot";
  node_wing_spar_low_l_69.scale.set(1, 1, 1);
  if (endpoint_wing_spar_low_l_69) {
    node_wing_spar_low_l_69.position.copy(endpoint_wing_spar_low_l_69.start);
    node_wing_spar_low_l_69.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_wing_spar_low_l_69.position.set(0.0, 0.0, 0.0);
    node_wing_spar_low_l_69.rotation.set(0.0, 0.0, 0.0);
  }
  node_wing_spar_low_l_69.userData.sculptComponent = {"id":"wing-spar-low-l","name":"Wing Spar Low L","material":"gold-skin"};
  node_wing_spar_low_l_69.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["wing-membrane-l"] ?? root).add(node_wing_spar_low_l_69);
  nodes["wing-spar-low-l"] = node_wing_spar_low_l_69;
  const mesh_wing_spar_low_l_69Geometry = endpoint_wing_spar_low_l_69
    ? new THREE.CylinderGeometry(endpoint_wing_spar_low_l_69.endRadius, endpoint_wing_spar_low_l_69.baseRadius, endpoint_wing_spar_low_l_69.length, 16, 6)
    : buildTaperedSweepGeometry({"stations": [{"position": [0.33, 0.22, 0.007], "rx": 0.03, "rz": 0.024, "twist": 0.0}, {"position": [0.35, -0.04, 0.007], "rx": 0.0172, "rz": 0.0138, "twist": 0.0}, {"position": [0.34, -0.3, 0.007], "rx": 0.0, "rz": 0.0, "twist": 0.0}], "radialSegments": 10, "capEnds": true});
  if (!endpoint_wing_spar_low_l_69) {
    mesh_wing_spar_low_l_69Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_wing_spar_low_l_69 = new THREE.Mesh(
    mesh_wing_spar_low_l_69Geometry,
    materialMap["gold-skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_wing_spar_low_l_69.name = "Wing Spar Low L";
  if (endpoint_wing_spar_low_l_69) {
    mesh_wing_spar_low_l_69.position.copy(endpoint_wing_spar_low_l_69.midpoint);
    mesh_wing_spar_low_l_69.quaternion.copy(endpoint_wing_spar_low_l_69.quaternion);
  }
  mesh_wing_spar_low_l_69.castShadow = options.castShadow ?? true;
  mesh_wing_spar_low_l_69.receiveShadow = options.receiveShadow ?? true;
  mesh_wing_spar_low_l_69.userData.sculptComponent = {"id":"wing-spar-low-l","name":"Wing Spar Low L","material":"gold-skin"};
  node_wing_spar_low_l_69.add(mesh_wing_spar_low_l_69);
  meshes["wing-spar-low-l"] = mesh_wing_spar_low_l_69;
  colliders["wing-spar-low-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["wing-spar-low-l"] ??= [];
  destructionGroups["wing-spar-low-l"].push(node_wing_spar_low_l_69);

  const attachment_wing_claw_l_70 = {"parentSocket": "wing-membrane-l-socket", "localStart": [0.33, 0.22, 0.007], "localEnd": [0.34, 0.3, 0.01], "contactType": "embed", "baseRadius": 0.024, "endRadius": 0.003, "embedDepth": 0.0144, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_wing_claw_l_70 = makeAttachmentEndpoint(attachment_wing_claw_l_70);
  const node_wing_claw_l_70 = new THREE.Group();
  node_wing_claw_l_70.name = "Wing claw L__pivot";
  node_wing_claw_l_70.scale.set(1, 1, 1);
  if (endpoint_wing_claw_l_70) {
    node_wing_claw_l_70.position.copy(endpoint_wing_claw_l_70.start);
    node_wing_claw_l_70.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_wing_claw_l_70.position.set(0.33, 0.22, 0.007);
    node_wing_claw_l_70.rotation.set(0.0, 0.0, 0.0);
  }
  node_wing_claw_l_70.userData.sculptComponent = {"id":"wing-claw-l","name":"Wing claw L","material":"claw-ivory"};
  node_wing_claw_l_70.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["wing-membrane-l"] ?? root).add(node_wing_claw_l_70);
  nodes["wing-claw-l"] = node_wing_claw_l_70;
  const mesh_wing_claw_l_70Geometry = endpoint_wing_claw_l_70
    ? new THREE.CylinderGeometry(endpoint_wing_claw_l_70.endRadius, endpoint_wing_claw_l_70.baseRadius, endpoint_wing_claw_l_70.length, 16, 6)
    : new THREE.ConeGeometry(0.5, 1, 24, 1);
  if (!endpoint_wing_claw_l_70) {
    mesh_wing_claw_l_70Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_wing_claw_l_70 = new THREE.Mesh(
    mesh_wing_claw_l_70Geometry,
    materialMap["claw-ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_wing_claw_l_70.name = "Wing claw L";
  if (endpoint_wing_claw_l_70) {
    mesh_wing_claw_l_70.position.copy(endpoint_wing_claw_l_70.midpoint);
    mesh_wing_claw_l_70.quaternion.copy(endpoint_wing_claw_l_70.quaternion);
  }
  mesh_wing_claw_l_70.castShadow = options.castShadow ?? true;
  mesh_wing_claw_l_70.receiveShadow = options.receiveShadow ?? true;
  mesh_wing_claw_l_70.userData.sculptComponent = {"id":"wing-claw-l","name":"Wing claw L","material":"claw-ivory"};
  node_wing_claw_l_70.add(mesh_wing_claw_l_70);
  meshes["wing-claw-l"] = mesh_wing_claw_l_70;
  colliders["wing-claw-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["wing-claw-l"] ??= [];
  destructionGroups["wing-claw-l"].push(node_wing_claw_l_70);

  const endpoint_tail_71 = makeAttachmentEndpoint(null);
  const node_tail_71 = new THREE.Group();
  node_tail_71.name = "Tail__pivot";
  node_tail_71.scale.set(1, 1, 1);
  if (endpoint_tail_71) {
    node_tail_71.position.copy(endpoint_tail_71.start);
    node_tail_71.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_tail_71.position.set(0.12, 0.42, -0.22);
    node_tail_71.rotation.set(0.0, 0.0, 0.0);
  }
  node_tail_71.userData.sculptComponent = {"id":"tail","name":"Tail","material":"gold-skin"};
  node_tail_71.userData.actionProfile = {"animationRole":"tail","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["kandura"] ?? root).add(node_tail_71);
  nodes["tail"] = node_tail_71;
  const mesh_tail_71Geometry = endpoint_tail_71
    ? new THREE.CylinderGeometry(endpoint_tail_71.endRadius, endpoint_tail_71.baseRadius, endpoint_tail_71.length, 16, 6)
    : buildTaperedSweepGeometry({"stations": [{"position": [0, 0, 0], "rx": 0.095, "rz": 0.0808, "twist": 0.0}, {"position": [0.18, 0.02, 0.02], "rx": 0.086, "rz": 0.0731, "twist": 0.0}, {"position": [0.31, 0.1, 0.1], "rx": 0.066, "rz": 0.0561, "twist": 0.0}, {"position": [0.34, 0.22, 0.17], "rx": 0.042, "rz": 0.0357, "twist": 0.0}, {"position": [0.29, 0.32, 0.2], "rx": 0.0, "rz": 0.0, "twist": 0.0}], "radialSegments": 14, "capEnds": true});
  if (!endpoint_tail_71) {
    mesh_tail_71Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_tail_71 = new THREE.Mesh(
    mesh_tail_71Geometry,
    materialMap["gold-skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_tail_71.name = "Tail";
  if (endpoint_tail_71) {
    mesh_tail_71.position.copy(endpoint_tail_71.midpoint);
    mesh_tail_71.quaternion.copy(endpoint_tail_71.quaternion);
  }
  mesh_tail_71.castShadow = options.castShadow ?? true;
  mesh_tail_71.receiveShadow = options.receiveShadow ?? true;
  mesh_tail_71.userData.sculptComponent = {"id":"tail","name":"Tail","material":"gold-skin"};
  node_tail_71.add(mesh_tail_71);
  meshes["tail"] = mesh_tail_71;
  colliders["tail"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["tail"] ??= [];
  destructionGroups["tail"].push(node_tail_71);

  const attachment_tail_spike_1_72 = {"parentSocket": "tail-socket", "localStart": [0.2, 0.07, 0.03], "localEnd": [0.2, 0.14, 0.009], "contactType": "embed", "baseRadius": 0.03, "endRadius": 0.004, "embedDepth": 0.018, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_tail_spike_1_72 = makeAttachmentEndpoint(attachment_tail_spike_1_72);
  const node_tail_spike_1_72 = new THREE.Group();
  node_tail_spike_1_72.name = "Tail spike 1__pivot";
  node_tail_spike_1_72.scale.set(1, 1, 1);
  if (endpoint_tail_spike_1_72) {
    node_tail_spike_1_72.position.copy(endpoint_tail_spike_1_72.start);
    node_tail_spike_1_72.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_tail_spike_1_72.position.set(0.2, 0.07, 0.03);
    node_tail_spike_1_72.rotation.set(0.0, 0.0, 0.0);
  }
  node_tail_spike_1_72.userData.sculptComponent = {"id":"tail-spike-1","name":"Tail spike 1","material":"spike-teal"};
  node_tail_spike_1_72.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["tail"] ?? root).add(node_tail_spike_1_72);
  nodes["tail-spike-1"] = node_tail_spike_1_72;
  const mesh_tail_spike_1_72Geometry = endpoint_tail_spike_1_72
    ? new THREE.CylinderGeometry(endpoint_tail_spike_1_72.endRadius, endpoint_tail_spike_1_72.baseRadius, endpoint_tail_spike_1_72.length, 16, 6)
    : new THREE.ConeGeometry(0.5, 1, 24, 1);
  if (!endpoint_tail_spike_1_72) {
    mesh_tail_spike_1_72Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_tail_spike_1_72 = new THREE.Mesh(
    mesh_tail_spike_1_72Geometry,
    materialMap["spike-teal"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_tail_spike_1_72.name = "Tail spike 1";
  if (endpoint_tail_spike_1_72) {
    mesh_tail_spike_1_72.position.copy(endpoint_tail_spike_1_72.midpoint);
    mesh_tail_spike_1_72.quaternion.copy(endpoint_tail_spike_1_72.quaternion);
  }
  mesh_tail_spike_1_72.castShadow = options.castShadow ?? true;
  mesh_tail_spike_1_72.receiveShadow = options.receiveShadow ?? true;
  mesh_tail_spike_1_72.userData.sculptComponent = {"id":"tail-spike-1","name":"Tail spike 1","material":"spike-teal"};
  node_tail_spike_1_72.add(mesh_tail_spike_1_72);
  meshes["tail-spike-1"] = mesh_tail_spike_1_72;
  colliders["tail-spike-1"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["tail-spike-1"] ??= [];
  destructionGroups["tail-spike-1"].push(node_tail_spike_1_72);

  const attachment_tail_spike_2_73 = {"parentSocket": "tail-socket", "localStart": [0.31, 0.16, 0.1], "localEnd": [0.352, 0.216, 0.086], "contactType": "embed", "baseRadius": 0.03, "endRadius": 0.004, "embedDepth": 0.018, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_tail_spike_2_73 = makeAttachmentEndpoint(attachment_tail_spike_2_73);
  const node_tail_spike_2_73 = new THREE.Group();
  node_tail_spike_2_73.name = "Tail spike 2__pivot";
  node_tail_spike_2_73.scale.set(1, 1, 1);
  if (endpoint_tail_spike_2_73) {
    node_tail_spike_2_73.position.copy(endpoint_tail_spike_2_73.start);
    node_tail_spike_2_73.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_tail_spike_2_73.position.set(0.31, 0.16, 0.1);
    node_tail_spike_2_73.rotation.set(0.0, 0.0, 0.0);
  }
  node_tail_spike_2_73.userData.sculptComponent = {"id":"tail-spike-2","name":"Tail spike 2","material":"spike-teal"};
  node_tail_spike_2_73.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["tail"] ?? root).add(node_tail_spike_2_73);
  nodes["tail-spike-2"] = node_tail_spike_2_73;
  const mesh_tail_spike_2_73Geometry = endpoint_tail_spike_2_73
    ? new THREE.CylinderGeometry(endpoint_tail_spike_2_73.endRadius, endpoint_tail_spike_2_73.baseRadius, endpoint_tail_spike_2_73.length, 16, 6)
    : new THREE.ConeGeometry(0.5, 1, 24, 1);
  if (!endpoint_tail_spike_2_73) {
    mesh_tail_spike_2_73Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_tail_spike_2_73 = new THREE.Mesh(
    mesh_tail_spike_2_73Geometry,
    materialMap["spike-teal"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_tail_spike_2_73.name = "Tail spike 2";
  if (endpoint_tail_spike_2_73) {
    mesh_tail_spike_2_73.position.copy(endpoint_tail_spike_2_73.midpoint);
    mesh_tail_spike_2_73.quaternion.copy(endpoint_tail_spike_2_73.quaternion);
  }
  mesh_tail_spike_2_73.castShadow = options.castShadow ?? true;
  mesh_tail_spike_2_73.receiveShadow = options.receiveShadow ?? true;
  mesh_tail_spike_2_73.userData.sculptComponent = {"id":"tail-spike-2","name":"Tail spike 2","material":"spike-teal"};
  node_tail_spike_2_73.add(mesh_tail_spike_2_73);
  meshes["tail-spike-2"] = mesh_tail_spike_2_73;
  colliders["tail-spike-2"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["tail-spike-2"] ??= [];
  destructionGroups["tail-spike-2"].push(node_tail_spike_2_73);

  const attachment_tail_spike_3_74 = {"parentSocket": "tail-socket", "localStart": [0.33, 0.27, 0.17], "localEnd": [0.393, 0.298, 0.17], "contactType": "embed", "baseRadius": 0.03, "endRadius": 0.004, "embedDepth": 0.018, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_tail_spike_3_74 = makeAttachmentEndpoint(attachment_tail_spike_3_74);
  const node_tail_spike_3_74 = new THREE.Group();
  node_tail_spike_3_74.name = "Tail spike 3__pivot";
  node_tail_spike_3_74.scale.set(1, 1, 1);
  if (endpoint_tail_spike_3_74) {
    node_tail_spike_3_74.position.copy(endpoint_tail_spike_3_74.start);
    node_tail_spike_3_74.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_tail_spike_3_74.position.set(0.33, 0.27, 0.17);
    node_tail_spike_3_74.rotation.set(0.0, 0.0, 0.0);
  }
  node_tail_spike_3_74.userData.sculptComponent = {"id":"tail-spike-3","name":"Tail spike 3","material":"spike-teal"};
  node_tail_spike_3_74.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["tail"] ?? root).add(node_tail_spike_3_74);
  nodes["tail-spike-3"] = node_tail_spike_3_74;
  const mesh_tail_spike_3_74Geometry = endpoint_tail_spike_3_74
    ? new THREE.CylinderGeometry(endpoint_tail_spike_3_74.endRadius, endpoint_tail_spike_3_74.baseRadius, endpoint_tail_spike_3_74.length, 16, 6)
    : new THREE.ConeGeometry(0.5, 1, 24, 1);
  if (!endpoint_tail_spike_3_74) {
    mesh_tail_spike_3_74Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_tail_spike_3_74 = new THREE.Mesh(
    mesh_tail_spike_3_74Geometry,
    materialMap["spike-teal"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_tail_spike_3_74.name = "Tail spike 3";
  if (endpoint_tail_spike_3_74) {
    mesh_tail_spike_3_74.position.copy(endpoint_tail_spike_3_74.midpoint);
    mesh_tail_spike_3_74.quaternion.copy(endpoint_tail_spike_3_74.quaternion);
  }
  mesh_tail_spike_3_74.castShadow = options.castShadow ?? true;
  mesh_tail_spike_3_74.receiveShadow = options.receiveShadow ?? true;
  mesh_tail_spike_3_74.userData.sculptComponent = {"id":"tail-spike-3","name":"Tail spike 3","material":"spike-teal"};
  node_tail_spike_3_74.add(mesh_tail_spike_3_74);
  meshes["tail-spike-3"] = mesh_tail_spike_3_74;
  colliders["tail-spike-3"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["tail-spike-3"] ??= [];
  destructionGroups["tail-spike-3"].push(node_tail_spike_3_74);

  const endpoint_foot_r_75 = makeAttachmentEndpoint(null);
  const node_foot_r_75 = new THREE.Group();
  node_foot_r_75.name = "Foot R__pivot";
  node_foot_r_75.scale.set(1, 1, 1);
  if (endpoint_foot_r_75) {
    node_foot_r_75.position.copy(endpoint_foot_r_75.start);
    node_foot_r_75.rotation.set(0.0, -0.28, 0.0);
  } else {
    node_foot_r_75.position.set(-0.27, 0.062, 0.1);
    node_foot_r_75.rotation.set(0.0, -0.28, 0.0);
  }
  node_foot_r_75.userData.sculptComponent = {"id":"foot-r","name":"Foot R","material":"gold-skin"};
  node_foot_r_75.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["root"] ?? root).add(node_foot_r_75);
  nodes["foot-r"] = node_foot_r_75;
  const mesh_foot_r_75Geometry = endpoint_foot_r_75
    ? new THREE.CylinderGeometry(endpoint_foot_r_75.endRadius, endpoint_foot_r_75.baseRadius, endpoint_foot_r_75.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_foot_r_75) {
    mesh_foot_r_75Geometry.scale(0.3, 0.13, 0.36);
  }
  const mesh_foot_r_75 = new THREE.Mesh(
    mesh_foot_r_75Geometry,
    materialMap["gold-skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_foot_r_75.name = "Foot R";
  if (endpoint_foot_r_75) {
    mesh_foot_r_75.position.copy(endpoint_foot_r_75.midpoint);
    mesh_foot_r_75.quaternion.copy(endpoint_foot_r_75.quaternion);
  }
  mesh_foot_r_75.castShadow = options.castShadow ?? true;
  mesh_foot_r_75.receiveShadow = options.receiveShadow ?? true;
  mesh_foot_r_75.userData.sculptComponent = {"id":"foot-r","name":"Foot R","material":"gold-skin"};
  node_foot_r_75.add(mesh_foot_r_75);
  meshes["foot-r"] = mesh_foot_r_75;
  colliders["foot-r"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["foot-r"] ??= [];
  destructionGroups["foot-r"].push(node_foot_r_75);

  const attachment_claw_r_1_76 = {"parentSocket": "foot-r-socket", "localStart": [0.085, -0.017, 0.1188], "localEnd": [0.0918, -0.035, 0.1788], "contactType": "embed", "baseRadius": 0.032, "endRadius": 0.004, "embedDepth": 0.0192, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_claw_r_1_76 = makeAttachmentEndpoint(attachment_claw_r_1_76);
  const node_claw_r_1_76 = new THREE.Group();
  node_claw_r_1_76.name = "Toe claw R1__pivot";
  node_claw_r_1_76.scale.set(1, 1, 1);
  if (endpoint_claw_r_1_76) {
    node_claw_r_1_76.position.copy(endpoint_claw_r_1_76.start);
    node_claw_r_1_76.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_claw_r_1_76.position.set(0.085, -0.017, 0.1188);
    node_claw_r_1_76.rotation.set(0.0, 0.0, 0.0);
  }
  node_claw_r_1_76.userData.sculptComponent = {"id":"claw-r-1","name":"Toe claw R1","material":"claw-ivory"};
  node_claw_r_1_76.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["foot-r"] ?? root).add(node_claw_r_1_76);
  nodes["claw-r-1"] = node_claw_r_1_76;
  const mesh_claw_r_1_76Geometry = endpoint_claw_r_1_76
    ? new THREE.CylinderGeometry(endpoint_claw_r_1_76.endRadius, endpoint_claw_r_1_76.baseRadius, endpoint_claw_r_1_76.length, 16, 6)
    : new THREE.ConeGeometry(0.5, 1, 24, 1);
  if (!endpoint_claw_r_1_76) {
    mesh_claw_r_1_76Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_claw_r_1_76 = new THREE.Mesh(
    mesh_claw_r_1_76Geometry,
    materialMap["claw-ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_claw_r_1_76.name = "Toe claw R1";
  if (endpoint_claw_r_1_76) {
    mesh_claw_r_1_76.position.copy(endpoint_claw_r_1_76.midpoint);
    mesh_claw_r_1_76.quaternion.copy(endpoint_claw_r_1_76.quaternion);
  }
  mesh_claw_r_1_76.castShadow = options.castShadow ?? true;
  mesh_claw_r_1_76.receiveShadow = options.receiveShadow ?? true;
  mesh_claw_r_1_76.userData.sculptComponent = {"id":"claw-r-1","name":"Toe claw R1","material":"claw-ivory"};
  node_claw_r_1_76.add(mesh_claw_r_1_76);
  meshes["claw-r-1"] = mesh_claw_r_1_76;
  colliders["claw-r-1"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["claw-r-1"] ??= [];
  destructionGroups["claw-r-1"].push(node_claw_r_1_76);

  const attachment_claw_r_2_77 = {"parentSocket": "foot-r-socket", "localStart": [0.0, -0.017, 0.14], "localEnd": [0.0, -0.035, 0.2], "contactType": "embed", "baseRadius": 0.032, "endRadius": 0.004, "embedDepth": 0.0192, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_claw_r_2_77 = makeAttachmentEndpoint(attachment_claw_r_2_77);
  const node_claw_r_2_77 = new THREE.Group();
  node_claw_r_2_77.name = "Toe claw R2__pivot";
  node_claw_r_2_77.scale.set(1, 1, 1);
  if (endpoint_claw_r_2_77) {
    node_claw_r_2_77.position.copy(endpoint_claw_r_2_77.start);
    node_claw_r_2_77.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_claw_r_2_77.position.set(0.0, -0.017, 0.14);
    node_claw_r_2_77.rotation.set(0.0, 0.0, 0.0);
  }
  node_claw_r_2_77.userData.sculptComponent = {"id":"claw-r-2","name":"Toe claw R2","material":"claw-ivory"};
  node_claw_r_2_77.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["foot-r"] ?? root).add(node_claw_r_2_77);
  nodes["claw-r-2"] = node_claw_r_2_77;
  const mesh_claw_r_2_77Geometry = endpoint_claw_r_2_77
    ? new THREE.CylinderGeometry(endpoint_claw_r_2_77.endRadius, endpoint_claw_r_2_77.baseRadius, endpoint_claw_r_2_77.length, 16, 6)
    : new THREE.ConeGeometry(0.5, 1, 24, 1);
  if (!endpoint_claw_r_2_77) {
    mesh_claw_r_2_77Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_claw_r_2_77 = new THREE.Mesh(
    mesh_claw_r_2_77Geometry,
    materialMap["claw-ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_claw_r_2_77.name = "Toe claw R2";
  if (endpoint_claw_r_2_77) {
    mesh_claw_r_2_77.position.copy(endpoint_claw_r_2_77.midpoint);
    mesh_claw_r_2_77.quaternion.copy(endpoint_claw_r_2_77.quaternion);
  }
  mesh_claw_r_2_77.castShadow = options.castShadow ?? true;
  mesh_claw_r_2_77.receiveShadow = options.receiveShadow ?? true;
  mesh_claw_r_2_77.userData.sculptComponent = {"id":"claw-r-2","name":"Toe claw R2","material":"claw-ivory"};
  node_claw_r_2_77.add(mesh_claw_r_2_77);
  meshes["claw-r-2"] = mesh_claw_r_2_77;
  colliders["claw-r-2"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["claw-r-2"] ??= [];
  destructionGroups["claw-r-2"].push(node_claw_r_2_77);

  const attachment_claw_r_3_78 = {"parentSocket": "foot-r-socket", "localStart": [-0.085, -0.017, 0.1188], "localEnd": [-0.0918, -0.035, 0.1788], "contactType": "embed", "baseRadius": 0.032, "endRadius": 0.004, "embedDepth": 0.0192, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_claw_r_3_78 = makeAttachmentEndpoint(attachment_claw_r_3_78);
  const node_claw_r_3_78 = new THREE.Group();
  node_claw_r_3_78.name = "Toe claw R3__pivot";
  node_claw_r_3_78.scale.set(1, 1, 1);
  if (endpoint_claw_r_3_78) {
    node_claw_r_3_78.position.copy(endpoint_claw_r_3_78.start);
    node_claw_r_3_78.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_claw_r_3_78.position.set(-0.085, -0.017, 0.1188);
    node_claw_r_3_78.rotation.set(0.0, 0.0, 0.0);
  }
  node_claw_r_3_78.userData.sculptComponent = {"id":"claw-r-3","name":"Toe claw R3","material":"claw-ivory"};
  node_claw_r_3_78.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["foot-r"] ?? root).add(node_claw_r_3_78);
  nodes["claw-r-3"] = node_claw_r_3_78;
  const mesh_claw_r_3_78Geometry = endpoint_claw_r_3_78
    ? new THREE.CylinderGeometry(endpoint_claw_r_3_78.endRadius, endpoint_claw_r_3_78.baseRadius, endpoint_claw_r_3_78.length, 16, 6)
    : new THREE.ConeGeometry(0.5, 1, 24, 1);
  if (!endpoint_claw_r_3_78) {
    mesh_claw_r_3_78Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_claw_r_3_78 = new THREE.Mesh(
    mesh_claw_r_3_78Geometry,
    materialMap["claw-ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_claw_r_3_78.name = "Toe claw R3";
  if (endpoint_claw_r_3_78) {
    mesh_claw_r_3_78.position.copy(endpoint_claw_r_3_78.midpoint);
    mesh_claw_r_3_78.quaternion.copy(endpoint_claw_r_3_78.quaternion);
  }
  mesh_claw_r_3_78.castShadow = options.castShadow ?? true;
  mesh_claw_r_3_78.receiveShadow = options.receiveShadow ?? true;
  mesh_claw_r_3_78.userData.sculptComponent = {"id":"claw-r-3","name":"Toe claw R3","material":"claw-ivory"};
  node_claw_r_3_78.add(mesh_claw_r_3_78);
  meshes["claw-r-3"] = mesh_claw_r_3_78;
  colliders["claw-r-3"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["claw-r-3"] ??= [];
  destructionGroups["claw-r-3"].push(node_claw_r_3_78);

  const endpoint_foot_l_79 = makeAttachmentEndpoint(null);
  const node_foot_l_79 = new THREE.Group();
  node_foot_l_79.name = "Foot L__pivot";
  node_foot_l_79.scale.set(1, 1, 1);
  if (endpoint_foot_l_79) {
    node_foot_l_79.position.copy(endpoint_foot_l_79.start);
    node_foot_l_79.rotation.set(0.0, 0.28, 0.0);
  } else {
    node_foot_l_79.position.set(0.27, 0.062, 0.1);
    node_foot_l_79.rotation.set(0.0, 0.28, 0.0);
  }
  node_foot_l_79.userData.sculptComponent = {"id":"foot-l","name":"Foot L","material":"gold-skin"};
  node_foot_l_79.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["root"] ?? root).add(node_foot_l_79);
  nodes["foot-l"] = node_foot_l_79;
  const mesh_foot_l_79Geometry = endpoint_foot_l_79
    ? new THREE.CylinderGeometry(endpoint_foot_l_79.endRadius, endpoint_foot_l_79.baseRadius, endpoint_foot_l_79.length, 16, 6)
    : new THREE.SphereGeometry(0.5, 32, 20);
  if (!endpoint_foot_l_79) {
    mesh_foot_l_79Geometry.scale(0.3, 0.13, 0.36);
  }
  const mesh_foot_l_79 = new THREE.Mesh(
    mesh_foot_l_79Geometry,
    materialMap["gold-skin"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_foot_l_79.name = "Foot L";
  if (endpoint_foot_l_79) {
    mesh_foot_l_79.position.copy(endpoint_foot_l_79.midpoint);
    mesh_foot_l_79.quaternion.copy(endpoint_foot_l_79.quaternion);
  }
  mesh_foot_l_79.castShadow = options.castShadow ?? true;
  mesh_foot_l_79.receiveShadow = options.receiveShadow ?? true;
  mesh_foot_l_79.userData.sculptComponent = {"id":"foot-l","name":"Foot L","material":"gold-skin"};
  node_foot_l_79.add(mesh_foot_l_79);
  meshes["foot-l"] = mesh_foot_l_79;
  colliders["foot-l"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["foot-l"] ??= [];
  destructionGroups["foot-l"].push(node_foot_l_79);

  const attachment_claw_l_1_80 = {"parentSocket": "foot-l-socket", "localStart": [-0.085, -0.017, 0.1188], "localEnd": [-0.0918, -0.035, 0.1788], "contactType": "embed", "baseRadius": 0.032, "endRadius": 0.004, "embedDepth": 0.0192, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_claw_l_1_80 = makeAttachmentEndpoint(attachment_claw_l_1_80);
  const node_claw_l_1_80 = new THREE.Group();
  node_claw_l_1_80.name = "Toe claw L1__pivot";
  node_claw_l_1_80.scale.set(1, 1, 1);
  if (endpoint_claw_l_1_80) {
    node_claw_l_1_80.position.copy(endpoint_claw_l_1_80.start);
    node_claw_l_1_80.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_claw_l_1_80.position.set(-0.085, -0.017, 0.1188);
    node_claw_l_1_80.rotation.set(0.0, 0.0, 0.0);
  }
  node_claw_l_1_80.userData.sculptComponent = {"id":"claw-l-1","name":"Toe claw L1","material":"claw-ivory"};
  node_claw_l_1_80.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["foot-l"] ?? root).add(node_claw_l_1_80);
  nodes["claw-l-1"] = node_claw_l_1_80;
  const mesh_claw_l_1_80Geometry = endpoint_claw_l_1_80
    ? new THREE.CylinderGeometry(endpoint_claw_l_1_80.endRadius, endpoint_claw_l_1_80.baseRadius, endpoint_claw_l_1_80.length, 16, 6)
    : new THREE.ConeGeometry(0.5, 1, 24, 1);
  if (!endpoint_claw_l_1_80) {
    mesh_claw_l_1_80Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_claw_l_1_80 = new THREE.Mesh(
    mesh_claw_l_1_80Geometry,
    materialMap["claw-ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_claw_l_1_80.name = "Toe claw L1";
  if (endpoint_claw_l_1_80) {
    mesh_claw_l_1_80.position.copy(endpoint_claw_l_1_80.midpoint);
    mesh_claw_l_1_80.quaternion.copy(endpoint_claw_l_1_80.quaternion);
  }
  mesh_claw_l_1_80.castShadow = options.castShadow ?? true;
  mesh_claw_l_1_80.receiveShadow = options.receiveShadow ?? true;
  mesh_claw_l_1_80.userData.sculptComponent = {"id":"claw-l-1","name":"Toe claw L1","material":"claw-ivory"};
  node_claw_l_1_80.add(mesh_claw_l_1_80);
  meshes["claw-l-1"] = mesh_claw_l_1_80;
  colliders["claw-l-1"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["claw-l-1"] ??= [];
  destructionGroups["claw-l-1"].push(node_claw_l_1_80);

  const attachment_claw_l_2_81 = {"parentSocket": "foot-l-socket", "localStart": [0.0, -0.017, 0.14], "localEnd": [0.0, -0.035, 0.2], "contactType": "embed", "baseRadius": 0.032, "endRadius": 0.004, "embedDepth": 0.0192, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_claw_l_2_81 = makeAttachmentEndpoint(attachment_claw_l_2_81);
  const node_claw_l_2_81 = new THREE.Group();
  node_claw_l_2_81.name = "Toe claw L2__pivot";
  node_claw_l_2_81.scale.set(1, 1, 1);
  if (endpoint_claw_l_2_81) {
    node_claw_l_2_81.position.copy(endpoint_claw_l_2_81.start);
    node_claw_l_2_81.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_claw_l_2_81.position.set(0.0, -0.017, 0.14);
    node_claw_l_2_81.rotation.set(0.0, 0.0, 0.0);
  }
  node_claw_l_2_81.userData.sculptComponent = {"id":"claw-l-2","name":"Toe claw L2","material":"claw-ivory"};
  node_claw_l_2_81.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["foot-l"] ?? root).add(node_claw_l_2_81);
  nodes["claw-l-2"] = node_claw_l_2_81;
  const mesh_claw_l_2_81Geometry = endpoint_claw_l_2_81
    ? new THREE.CylinderGeometry(endpoint_claw_l_2_81.endRadius, endpoint_claw_l_2_81.baseRadius, endpoint_claw_l_2_81.length, 16, 6)
    : new THREE.ConeGeometry(0.5, 1, 24, 1);
  if (!endpoint_claw_l_2_81) {
    mesh_claw_l_2_81Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_claw_l_2_81 = new THREE.Mesh(
    mesh_claw_l_2_81Geometry,
    materialMap["claw-ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_claw_l_2_81.name = "Toe claw L2";
  if (endpoint_claw_l_2_81) {
    mesh_claw_l_2_81.position.copy(endpoint_claw_l_2_81.midpoint);
    mesh_claw_l_2_81.quaternion.copy(endpoint_claw_l_2_81.quaternion);
  }
  mesh_claw_l_2_81.castShadow = options.castShadow ?? true;
  mesh_claw_l_2_81.receiveShadow = options.receiveShadow ?? true;
  mesh_claw_l_2_81.userData.sculptComponent = {"id":"claw-l-2","name":"Toe claw L2","material":"claw-ivory"};
  node_claw_l_2_81.add(mesh_claw_l_2_81);
  meshes["claw-l-2"] = mesh_claw_l_2_81;
  colliders["claw-l-2"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["claw-l-2"] ??= [];
  destructionGroups["claw-l-2"].push(node_claw_l_2_81);

  const attachment_claw_l_3_82 = {"parentSocket": "foot-l-socket", "localStart": [0.085, -0.017, 0.1188], "localEnd": [0.0918, -0.035, 0.1788], "contactType": "embed", "baseRadius": 0.032, "endRadius": 0.004, "embedDepth": 0.0192, "gapTolerance": 0.01, "evidenceRefs": ["full-object"]};
  const endpoint_claw_l_3_82 = makeAttachmentEndpoint(attachment_claw_l_3_82);
  const node_claw_l_3_82 = new THREE.Group();
  node_claw_l_3_82.name = "Toe claw L3__pivot";
  node_claw_l_3_82.scale.set(1, 1, 1);
  if (endpoint_claw_l_3_82) {
    node_claw_l_3_82.position.copy(endpoint_claw_l_3_82.start);
    node_claw_l_3_82.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_claw_l_3_82.position.set(0.085, -0.017, 0.1188);
    node_claw_l_3_82.rotation.set(0.0, 0.0, 0.0);
  }
  node_claw_l_3_82.userData.sculptComponent = {"id":"claw-l-3","name":"Toe claw L3","material":"claw-ivory"};
  node_claw_l_3_82.userData.actionProfile = {"animationRole":"static","pivot":{"mode":"center","localPosition":[0,0,0],"axis":[0,1,0],"confidence":0.7}};
  (nodes["foot-l"] ?? root).add(node_claw_l_3_82);
  nodes["claw-l-3"] = node_claw_l_3_82;
  const mesh_claw_l_3_82Geometry = endpoint_claw_l_3_82
    ? new THREE.CylinderGeometry(endpoint_claw_l_3_82.endRadius, endpoint_claw_l_3_82.baseRadius, endpoint_claw_l_3_82.length, 16, 6)
    : new THREE.ConeGeometry(0.5, 1, 24, 1);
  if (!endpoint_claw_l_3_82) {
    mesh_claw_l_3_82Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_claw_l_3_82 = new THREE.Mesh(
    mesh_claw_l_3_82Geometry,
    materialMap["claw-ivory"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_claw_l_3_82.name = "Toe claw L3";
  if (endpoint_claw_l_3_82) {
    mesh_claw_l_3_82.position.copy(endpoint_claw_l_3_82.midpoint);
    mesh_claw_l_3_82.quaternion.copy(endpoint_claw_l_3_82.quaternion);
  }
  mesh_claw_l_3_82.castShadow = options.castShadow ?? true;
  mesh_claw_l_3_82.receiveShadow = options.receiveShadow ?? true;
  mesh_claw_l_3_82.userData.sculptComponent = {"id":"claw-l-3","name":"Toe claw L3","material":"claw-ivory"};
  node_claw_l_3_82.add(mesh_claw_l_3_82);
  meshes["claw-l-3"] = mesh_claw_l_3_82;
  colliders["claw-l-3"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "box proxy"};
  destructionGroups["claw-l-3"] ??= [];
  destructionGroups["claw-l-3"].push(node_claw_l_3_82);

  // repetition system: crest-plates (InstancedMesh, radial, count=4, level=meso)
  {
    const parent = nodes["root"] ?? root;
    const geo = new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
    const mat = materialMap["hidden"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 });
    // Contract (PLAN_1.5 WS-E): instanceScale is ABSOLUTE, in the parent pivot's
    // local units -- it is never multiplied by the parent component's own declared
    // dimensional scale. This falls out of the same fix as componentTree: the pivot
    // Group this cluster is parented to always carries identity scale (dimensions are
    // baked into that component's OWN geometry, not exposed on the Group), so an
    // instanced fastener/tooth/spoke sized [0.05, 0.05, 0.05] renders at exactly that
    // size regardless of how non-uniformly its host component is shaped, and a
    // `radial` ring's placement stays circular instead of being squashed into an
    // ellipse by a non-uniform host.
    const scl = [0.1, 0.1, 0.1];
    const axis = new THREE.Vector3(0.0, 0.0, 1.0).normalize();
    const radius = 0.0;
    const seed = Math.abs(axis.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const perp = new THREE.Vector3().crossVectors(axis, seed).normalize();
    // One InstancedMesh = one draw call for all repeated parts (teeth/fasteners/spokes),
    // replacing the former per-instance Mesh clone loop (real-time perf principle).
    const cluster = new THREE.InstancedMesh(geo, mat, 4);
    const _m = new THREE.Matrix4();
    const _p = new THREE.Vector3();
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3(scl[0], scl[1], scl[2]);
    for (let i = 0; i < 4; i++) {
      const ang = ((0.0) + (i * 360) / 4) * Math.PI / 180;
      const dir = perp.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, ang));
      _p.copy(radius > 0 ? dir.clone().multiplyScalar(radius * 0.5) : new THREE.Vector3());
      _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      _m.compose(_p, _q, _s);
      cluster.setMatrixAt(i, _m);
    }
    cluster.instanceMatrix.needsUpdate = true;
    cluster.castShadow = options.castShadow ?? true;
    cluster.receiveShadow = options.receiveShadow ?? true;
    cluster.name = "crest-plates";
    parent.add(cluster);
  }

  // repetition system: toe-claws (InstancedMesh, radial, count=6, level=meso)
  {
    const parent = nodes["root"] ?? root;
    const geo = new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
    const mat = materialMap["hidden"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 });
    // Contract (PLAN_1.5 WS-E): instanceScale is ABSOLUTE, in the parent pivot's
    // local units -- it is never multiplied by the parent component's own declared
    // dimensional scale. This falls out of the same fix as componentTree: the pivot
    // Group this cluster is parented to always carries identity scale (dimensions are
    // baked into that component's OWN geometry, not exposed on the Group), so an
    // instanced fastener/tooth/spoke sized [0.05, 0.05, 0.05] renders at exactly that
    // size regardless of how non-uniformly its host component is shaped, and a
    // `radial` ring's placement stays circular instead of being squashed into an
    // ellipse by a non-uniform host.
    const scl = [0.1, 0.1, 0.1];
    const axis = new THREE.Vector3(0.0, 0.0, 1.0).normalize();
    const radius = 0.0;
    const seed = Math.abs(axis.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const perp = new THREE.Vector3().crossVectors(axis, seed).normalize();
    // One InstancedMesh = one draw call for all repeated parts (teeth/fasteners/spokes),
    // replacing the former per-instance Mesh clone loop (real-time perf principle).
    const cluster = new THREE.InstancedMesh(geo, mat, 6);
    const _m = new THREE.Matrix4();
    const _p = new THREE.Vector3();
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3(scl[0], scl[1], scl[2]);
    for (let i = 0; i < 6; i++) {
      const ang = ((0.0) + (i * 360) / 6) * Math.PI / 180;
      const dir = perp.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, ang));
      _p.copy(radius > 0 ? dir.clone().multiplyScalar(radius * 0.5) : new THREE.Vector3());
      _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      _m.compose(_p, _q, _s);
      cluster.setMatrixAt(i, _m);
    }
    cluster.instanceMatrix.needsUpdate = true;
    cluster.castShadow = options.castShadow ?? true;
    cluster.receiveShadow = options.receiveShadow ?? true;
    cluster.name = "toe-claws";
    parent.add(cluster);
  }

  // repetition system: finger-claws (InstancedMesh, radial, count=6, level=meso)
  {
    const parent = nodes["root"] ?? root;
    const geo = new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
    const mat = materialMap["hidden"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 });
    // Contract (PLAN_1.5 WS-E): instanceScale is ABSOLUTE, in the parent pivot's
    // local units -- it is never multiplied by the parent component's own declared
    // dimensional scale. This falls out of the same fix as componentTree: the pivot
    // Group this cluster is parented to always carries identity scale (dimensions are
    // baked into that component's OWN geometry, not exposed on the Group), so an
    // instanced fastener/tooth/spoke sized [0.05, 0.05, 0.05] renders at exactly that
    // size regardless of how non-uniformly its host component is shaped, and a
    // `radial` ring's placement stays circular instead of being squashed into an
    // ellipse by a non-uniform host.
    const scl = [0.1, 0.1, 0.1];
    const axis = new THREE.Vector3(0.0, 0.0, 1.0).normalize();
    const radius = 0.0;
    const seed = Math.abs(axis.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const perp = new THREE.Vector3().crossVectors(axis, seed).normalize();
    // One InstancedMesh = one draw call for all repeated parts (teeth/fasteners/spokes),
    // replacing the former per-instance Mesh clone loop (real-time perf principle).
    const cluster = new THREE.InstancedMesh(geo, mat, 6);
    const _m = new THREE.Matrix4();
    const _p = new THREE.Vector3();
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3(scl[0], scl[1], scl[2]);
    for (let i = 0; i < 6; i++) {
      const ang = ((0.0) + (i * 360) / 6) * Math.PI / 180;
      const dir = perp.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, ang));
      _p.copy(radius > 0 ? dir.clone().multiplyScalar(radius * 0.5) : new THREE.Vector3());
      _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      _m.compose(_p, _q, _s);
      cluster.setMatrixAt(i, _m);
    }
    cluster.instanceMatrix.needsUpdate = true;
    cluster.castShadow = options.castShadow ?? true;
    cluster.receiveShadow = options.receiveShadow ?? true;
    cluster.name = "finger-claws";
    parent.add(cluster);
  }

  // repetition system: wing-spars (InstancedMesh, radial, count=6, level=meso)
  {
    const parent = nodes["root"] ?? root;
    const geo = new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
    const mat = materialMap["hidden"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 });
    // Contract (PLAN_1.5 WS-E): instanceScale is ABSOLUTE, in the parent pivot's
    // local units -- it is never multiplied by the parent component's own declared
    // dimensional scale. This falls out of the same fix as componentTree: the pivot
    // Group this cluster is parented to always carries identity scale (dimensions are
    // baked into that component's OWN geometry, not exposed on the Group), so an
    // instanced fastener/tooth/spoke sized [0.05, 0.05, 0.05] renders at exactly that
    // size regardless of how non-uniformly its host component is shaped, and a
    // `radial` ring's placement stays circular instead of being squashed into an
    // ellipse by a non-uniform host.
    const scl = [0.1, 0.1, 0.1];
    const axis = new THREE.Vector3(0.0, 0.0, 1.0).normalize();
    const radius = 0.0;
    const seed = Math.abs(axis.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const perp = new THREE.Vector3().crossVectors(axis, seed).normalize();
    // One InstancedMesh = one draw call for all repeated parts (teeth/fasteners/spokes),
    // replacing the former per-instance Mesh clone loop (real-time perf principle).
    const cluster = new THREE.InstancedMesh(geo, mat, 6);
    const _m = new THREE.Matrix4();
    const _p = new THREE.Vector3();
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3(scl[0], scl[1], scl[2]);
    for (let i = 0; i < 6; i++) {
      const ang = ((0.0) + (i * 360) / 6) * Math.PI / 180;
      const dir = perp.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, ang));
      _p.copy(radius > 0 ? dir.clone().multiplyScalar(radius * 0.5) : new THREE.Vector3());
      _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      _m.compose(_p, _q, _s);
      cluster.setMatrixAt(i, _m);
    }
    cluster.instanceMatrix.needsUpdate = true;
    cluster.castShadow = options.castShadow ?? true;
    cluster.receiveShadow = options.receiveShadow ?? true;
    cluster.name = "wing-spars";
    parent.add(cluster);
  }

  // repetition system: tail-spikes (InstancedMesh, radial, count=3, level=meso)
  {
    const parent = nodes["root"] ?? root;
    const geo = new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
    const mat = materialMap["hidden"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 });
    // Contract (PLAN_1.5 WS-E): instanceScale is ABSOLUTE, in the parent pivot's
    // local units -- it is never multiplied by the parent component's own declared
    // dimensional scale. This falls out of the same fix as componentTree: the pivot
    // Group this cluster is parented to always carries identity scale (dimensions are
    // baked into that component's OWN geometry, not exposed on the Group), so an
    // instanced fastener/tooth/spoke sized [0.05, 0.05, 0.05] renders at exactly that
    // size regardless of how non-uniformly its host component is shaped, and a
    // `radial` ring's placement stays circular instead of being squashed into an
    // ellipse by a non-uniform host.
    const scl = [0.1, 0.1, 0.1];
    const axis = new THREE.Vector3(0.0, 0.0, 1.0).normalize();
    const radius = 0.0;
    const seed = Math.abs(axis.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const perp = new THREE.Vector3().crossVectors(axis, seed).normalize();
    // One InstancedMesh = one draw call for all repeated parts (teeth/fasteners/spokes),
    // replacing the former per-instance Mesh clone loop (real-time perf principle).
    const cluster = new THREE.InstancedMesh(geo, mat, 3);
    const _m = new THREE.Matrix4();
    const _p = new THREE.Vector3();
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3(scl[0], scl[1], scl[2]);
    for (let i = 0; i < 3; i++) {
      const ang = ((0.0) + (i * 360) / 3) * Math.PI / 180;
      const dir = perp.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, ang));
      _p.copy(radius > 0 ? dir.clone().multiplyScalar(radius * 0.5) : new THREE.Vector3());
      _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      _m.compose(_p, _q, _s);
      cluster.setMatrixAt(i, _m);
    }
    cluster.instanceMatrix.needsUpdate = true;
    cluster.castShadow = options.castShadow ?? true;
    cluster.receiveShadow = options.receiveShadow ?? true;
    cluster.name = "tail-spikes";
    parent.add(cluster);
  }

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } ;
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function createGoldenDralingoLookDevLights(
  mode = 'neutral',
) {
  const lights = new THREE.Group();
  lights.name = "Golden Dralingo look-dev lights";
  const hemi = new THREE.HemisphereLight(
    mode === 'reference' ? 0xfff0d6 : 0xf2f4ff,
    0x363b42,
    mode === 'grazing' ? 0.28 : mode === 'reference' ? 0.72 : 0.85,
  );
  lights.add(hemi);
  const key = new THREE.DirectionalLight(
    mode === 'reference' ? 0xffcf8a : 0xfff4e8,
    mode === 'grazing' ? 4.2 : mode === 'reference' ? 2.6 : 2.15,
  );
  if (mode === 'grazing') key.position.set(7.5, 1.1, 4.0);
  else if (mode === 'reference') key.position.set(-4.5, 7.5, 5.0);
  else key.position.set(-4.0, 6.0, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 24;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -2.6;
  key.shadow.camera.right = 2.6;
  key.shadow.camera.top = 2.6;
  key.shadow.camera.bottom = -2.6;
  key.shadow.camera.updateProjectionMatrix();
  lights.add(key);
  const fill = new THREE.DirectionalLight(0xa8c4ff, mode === 'grazing' ? 0.12 : 0.42);
  fill.position.set(4.0, 3.0, 3.5);
  lights.add(fill);
  const rim = new THREE.DirectionalLight(0xfff1c4, mode === 'grazing' ? 0.28 : 0.85);
  rim.position.set(0.5, 4.5, -6.0);
  lights.add(rim);
  lights.userData.reviewMode = mode;
  return lights;
}

// PBR materials (clearcoat/iridescence/transmission/anisotropy) need an environment
// map to visually behave as intended — call this once per renderer and assign the
// result to scene.environment before rendering. No external HDR asset required.
export function createGoldenDralingoEnvironment(renderer ) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return texture;
}

// Plan 1.3 §3.2 — auto-framing by bounding box. The Divine Eye can only compare a
// render to the reference if the object is FRAMED consistently (an object framed
// differently scores as wrong even when its shape is right). This positions the camera
// deterministically from the object's bounding box so it fills the frame at a stable
// margin, and sets near/far to the object scale. Call after adding the model to the
// scene, and again on resize (after updating camera.aspect).
export function frameGoldenDralingoCamera(
  camera ,
  object ,
  options = {},
) {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const margin = options.margin ?? 1.15;
  const maxDim = Math.max(size.x, size.y, size.z) * margin;
  const fov = (camera.fov * Math.PI) / 180;
  // distance so the largest object dimension fits vertically in the frame
  const distance = (maxDim / 2) / Math.tan(fov / 2);
  const az = ((options.azimuthDeg ?? 0) * Math.PI) / 180;
  const el = ((options.elevationDeg ?? 0) * Math.PI) / 180;
  const dir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  );
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - maxDim);
  camera.far = distance + maxDim * 2;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

// Plan 1.3 §3.2c — PRESENTATION composer (DOF + bloom). CRITICAL (R-POSTFX): this is
// for the showcase/hero render ONLY. The Divine Eye's EVALUATION render MUST use a
// plain renderer with NO composer — bloom blows highlights and DOF blurs edges, which
// would corrupt the deterministic IoU/DCD/edge/blowout signals. Enable dof/bloom ONLY
// when the reference photo actually exhibits them (detect_reference_effects.py authorizes).

export function configureGoldenDralingoRenderer(renderer ) {
  // Load-bearing for view-dependent finishes (anodized / Doppler): without ACES + sRGB
  // the environment reflection reads flat/washed instead of a believable metal response.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

