// Golden Dralingo interaction layer (interaction-pass): rigid-pivot animation on the factory's sculptRuntime nodes.
// pose(t) is a pure function of time, so the review harness can render any frame and the page can drive it per frame.
//   wave   sleeve-fore-wave about its elbow pivot (frontal plane, local Z)       ~1 Hz hello
//   wings  wing-membrane-r/l about their roots (local Y sweep + a little Z lift), mirrored
//   tail   about its base (local Y)
//   head   small tilt/turn about the head pivot (it carries the ghutra, agal and face)
//   root   idle bob; cheer(t0) adds a hop with one full spin
const ANIMATED = ['head', 'sleeve-fore-wave', 'wing-membrane-r', 'wing-membrane-l', 'tail'];

export function createDralingoActions(model) {
  const nodes = model.userData.sculptRuntime.nodes;
  const rest = new Map();
  for (const id of ANIMATED) if (nodes[id]) rest.set(id, nodes[id].rotation.clone());
  const base = { y: model.position.y, ry: model.rotation.y };
  let cheerStart = -1;

  function turn(id, x, y, z) {
    const node = nodes[id];
    const r = rest.get(id);
    if (node && r) node.rotation.set(r.x + x, r.y + y, r.z + z);
  }

  function pose(t) {
    const w = Math.sin(t * 6.0);
    turn('sleeve-fore-wave', 0, 0, w * (w > 0 ? 0.38 : 0.2));   // smaller inward swing: the hand clears the ghutra
    const flap = Math.sin(t * 3.2);
    turn('wing-membrane-r', 0, -flap * 0.3, -flap * 0.08);
    turn('wing-membrane-l', 0, flap * 0.3, flap * 0.08);
    turn('tail', 0, Math.sin(t * 2.1) * 0.25, 0);
    turn('head', 0, Math.sin(t * 0.9) * 0.08, Math.sin(t * 1.3) * 0.07);
    model.position.y = base.y + Math.sin(t * 2.4) * 0.03;
    model.rotation.y = base.ry;
    if (cheerStart >= 0) {
      const k = (t - cheerStart) / 1.2;
      if (k >= 1 || k < 0) cheerStart = -1;
      else {
        model.position.y += Math.sin(Math.PI * k) * 0.35;
        model.rotation.y = base.ry + (1 - Math.cos(Math.PI * k)) * Math.PI;   // eased full spin
      }
    }
  }

  return {
    pose,
    cheer(t) { cheerStart = t; },
    isCheering() { return cheerStart >= 0; },
    animated: ANIMATED.filter((id) => nodes[id]),
  };
}
