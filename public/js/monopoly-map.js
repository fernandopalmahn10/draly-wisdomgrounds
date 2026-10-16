// Dàfùwēng · Monopolio v2 «El Gran Tablero de Dubái» — the board itself, as data. ONE file for the server's rules
// (core/monopoly.js requires it) and both screens (js/monopoly-board.js draws it on the phone and the projector).
//   SPACES     the 24 spaces of the loop, in walking order (0 = Salida)
//   LANDMARKS  the 5 Dubai landmarks that stand on their spaces (the glossy Reinos art: /assets/kingdoms/landmarks/)
//   COLORS     the Mario Party seat colours (a board of 4 = red, blue, green, yellow; a 5th kid purple)
//   W, H, POS  the board's size in map units and where each space sits (an even walk around a rounded square)
// Browser: window.MonoMap. Node: require('./public/js/monopoly-map').
(function (root, factory) {
  const M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M;
  else root.MonoMap = M;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  // price = coins to buy it; toll = what a rival pays when landing on it (× its level, 1-3)
  const LANDMARKS = [
    { id: 'museum', name: 'Museo del Futuro', price: 6, toll: 2 },
    { id: 'frame', name: 'Marco de Dubái', price: 7, toll: 2 },
    { id: 'burj', name: 'Burj Khalifa', price: 10, toll: 4 },
    { id: 'arab', name: 'Burj Al Arab', price: 9, toll: 3 },
    { id: 'atlantis', name: 'Atlantis', price: 8, toll: 3 },
  ];
  // t: start · blue (+3) · red (−3) · lucky («¡Suerte!») · storm («¡Tormenta de arena!») · land (a landmark, lm = index)
  // «¡Avanza 3!» from each lucky space (4, 14, 20) lands on a blue one (7, 17, 23).
  const S = (t, lm) => (lm == null ? { t } : { t, lm });
  const SPACES = [
    S('start'), S('blue'), S('blue'), S('land', 0), S('lucky'), S('blue'), S('red'), S('blue'),
    S('land', 1), S('blue'), S('storm'), S('blue'), S('land', 2), S('blue'), S('lucky'), S('blue'),
    S('red'), S('blue'), S('land', 3), S('blue'), S('lucky'), S('land', 4), S('red'), S('blue'),
  ];
  const N = SPACES.length;
  const STAR_START = 9;            // every board's first star: the same distance from Salida for everybody
  const COLORS = [
    { id: 'red', name: 'Rojo', c: '#e0463c', d: '#a8261e', s: '#ffd3cc' },
    { id: 'blue', name: 'Azul', c: '#2f6fe0', d: '#1a4aa8', s: '#cfe0ff' },
    { id: 'green', name: 'Verde', c: '#25a35a', d: '#157341', s: '#cdf2da' },
    { id: 'yellow', name: 'Amarillo', c: '#f2b705', d: '#a87a00', s: '#fff0bf' },
    { id: 'purple', name: 'Morado', c: '#8a4fd8', d: '#5d2aa6', s: '#e6d6ff' },
  ];

  // ---------- geometry ----------
  // The loop is a rounded square (a superellipse) walked at an even pace: Salida at the bottom-left corner, then right
  // along the bottom (the desert), up the right side (downtown), left along the top (the Creek), down the left (the beach).
  const W = 1200, H = 840;
  const CX = 600, CY = 430, A = 470, B = 290, NE = 5;
  function curve(s) {
    const th = (3 * Math.PI) / 4 - 2 * Math.PI * s;
    const c = Math.cos(th), sn = Math.sin(th);
    const e = 2 / NE;
    return [CX + A * Math.sign(c) * Math.pow(Math.abs(c), e), CY + B * Math.sign(sn) * Math.pow(Math.abs(sn), e)];
  }
  function layout() {
    const K = 4000;
    const pts = [];
    let len = 0;
    let prev = curve(0);
    pts.push([prev[0], prev[1], 0]);
    for (let i = 1; i <= K; i++) {
      const p = curve(i / K);
      len += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      pts.push([p[0], p[1], len]);
      prev = p;
    }
    const out = [];
    let j = 0;
    for (let n = 0; n < N; n++) {
      const want = (len * n) / N;
      while (j < pts.length - 1 && pts[j + 1][2] < want) j++;
      const a = pts[j], b = pts[Math.min(pts.length - 1, j + 1)];
      const k = b[2] > a[2] ? (want - a[2]) / (b[2] - a[2]) : 0;
      out.push({ x: Math.round(a[0] + (b[0] - a[0]) * k), y: Math.round(a[1] + (b[1] - a[1]) * k) });
    }
    return out;
  }
  const POS = layout();
  // the unit vector pointing out of the loop at space i (landmarks stand a little outside and behind their space)
  function outward(i) {
    const p = POS[i];
    const dx = (p.x - CX) / A, dy = (p.y - CY) / B;
    const l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l };
  }
  // steps from a to b walking forward
  const ahead = (a, b) => (((b - a) % N) + N) % N;

  // ---------- the turn's clock ----------
  // How long each moment of a turn plays on the phones. The server adds them up (core/monopoly.js roll) to deal the next
  // question exactly when the phone has finished showing the move; the phones schedule the same moments with these.
  const T = {
    show: 750,                  // the dice number, before the first hop
    step: 300,                  // one hop
    pass: 900,                  // passing Salida (+coins)
    star: 2500, nostar: 700,    // the star: bought / «te faltan N»
    blue: 1000, red: 1000,
    buy: 2100, broke: 1300, toll: 1900, level: 1500,
    roulette: 1300,             // «¡Suerte!»: the roulette spins, then its outcome:
    chest: 1300, swap: 1900, duel: 2700, ahead: 500,
    storm: 2500,
    end: 400,                   // a breath before the next question
  };
  // one moment's length (a «¡Suerte!» moment = the roulette + its outcome)
  function evMs(e) {
    if (!e) return 0;
    if (e.type === 'lucky') return T.roulette + (e.out === 'gold' || e.out === 'chest' ? T.chest : (T[e.out] || 0));
    return T[e.type] || 0;
  }
  // a whole script: the dice, the hops, every moment, the breath
  const scriptMs = (s) => T.show + (s.path || []).length * T.step + (s.ev || []).reduce((a, e) => a + evMs(e), 0) + T.end;

  return { W, H, N, SPACES, LANDMARKS, COLORS, POS, STAR_START, outward, ahead, CX, CY, T, evMs, scriptMs };
});
