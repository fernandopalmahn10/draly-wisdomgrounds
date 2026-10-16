// Vuelo del Dragón v2 «La Carrera del Cielo de Dubái» — the course, as data. ONE file for the server's rules
// (core/dragon.js requires it) and both screens (js/dragon-sky.js draws it on the phone and the projector).
//   LAP        one lap of the course over Dubai, in metres (the Creek with its abras is the start line of every lap)
//   LANDMARKS  the 5 glossy landmarks of Reinos standing along each lap (/assets/kingdoms/landmarks/big/), and where
//   SPRINTS    the order of the star sprints («¡Carrera al Burj Khalifa!»): one landmark after another, then again
//   COLORS     the Mario Party seat colours (a race of 4 = red, blue, green, yellow; a 5th kid purple)
//   PX         how many phone pixels one metre is on the course layer (the camera follows my dragon)
//   relX(d, a) where a rival d metres ahead of me sits on my screen: the true distance up close, squeezed toward the
//              edges further away (a ± a px), so a rival 300 m ahead is still in view, at the edge, with a «+300 m» chip
// Browser: window.DragonCourse. Node: require('./public/js/dragon-course').
(function (root, factory) {
  const C = factory();
  if (typeof module === 'object' && module.exports) module.exports = C;
  else root.DragonCourse = C;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  const LAP = 1500;
  const LANDMARKS = [
    { id: 'frame', name: 'Marco de Dubái', at: 250 },
    { id: 'museum', name: 'Museo del Futuro', at: 500 },
    { id: 'burj', name: 'Burj Khalifa', at: 750 },
    { id: 'arab', name: 'Burj Al Arab', at: 1000 },
    { id: 'atlantis', name: 'Atlantis', at: 1250 },
  ];
  const SPRINTS = ['burj', 'frame', 'arab', 'museum', 'atlantis'];   // the first sprint is the Burj Khalifa (the icon)
  const COLORS = [
    { id: 'red', name: 'Rojo', c: '#e0463c', d: '#a8261e', s: '#ffd3cc' },
    { id: 'blue', name: 'Azul', c: '#2f6fe0', d: '#1a4aa8', s: '#cfe0ff' },
    { id: 'green', name: 'Verde', c: '#25a35a', d: '#157341', s: '#cdf2da' },
    { id: 'yellow', name: 'Amarillo', c: '#f2b705', d: '#a87a00', s: '#fff0bf' },
    { id: 'purple', name: 'Morado', c: '#8a4fd8', d: '#5d2aa6', s: '#e6d6ff' },
  ];
  const PX = 4;
  const lm = (id) => LANDMARKS.find((l) => l.id === id) || null;
  const sprintLm = (n) => SPRINTS[(Math.max(1, n) - 1) % SPRINTS.length];
  // the landmark ahead of a dragon at metres m (and how far), every lap
  function next(m) {
    const at = ((m % LAP) + LAP) % LAP;
    const l = LANDMARKS.find((x) => x.at > at + 1) || null;
    if (l) return { id: l.id, name: l.name, in: Math.round(l.at - at) };
    return { id: 'creek', name: 'Dubai Creek', in: Math.round(LAP - at) };
  }
  const lap = (m) => 1 + Math.floor(Math.max(0, m) / LAP);
  function relX(d, a) {
    const k = PX * d / a;
    const e = Math.exp(2 * Math.max(-20, Math.min(20, k)));
    return a * ((e - 1) / (e + 1));                       // tanh: true distance near me, squeezed further away
  }
  return { LAP, LANDMARKS, SPRINTS, COLORS, PX, lm, sprintLm, next, lap, relX };
});
