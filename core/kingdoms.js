// Reinos de Colores — board rules (pure functions, no sockets).
// Hex board in axial coords (q, r), pointy-top, radius R. Two castles (red left, gold right), each starting with
// its castle tile + the 6 tiles around it. A right answer earns a flag; the kid plants it on any tile touching their
// land (empty or enemy, never a castle). After every plant, any pocket of not-yours tiles that touches neither the
// board edge nor a castle flips to your team ("¡Rodeado!"). Score = tiles owned + siege bonus + Dubai landmarks held.
'use strict';

const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const SIEGE_BONUS = 5;       // all 6 tiles around the enemy castle are yours
const ALERT_AT = 4;          // "castle almost surrounded" threshold (of 6 neighbours)

// Dubai landmarks: neutral tiles on the board's centre line, so both castles are exactly as far from each one (fair).
// Whoever holds a landmark adds its bonus to the kingdom's score; it can be stolen back like any tile.
// `the` is the Spanish name with its article, for sentences («¡El Fuego conquistó el Burj Khalifa!»).
const LANDMARKS = {
  burj: { name: 'Burj Khalifa', the: 'el Burj Khalifa', bonus: 5 },
  arab: { name: 'Burj Al Arab', the: 'el Burj Al Arab', bonus: 3 },
  museum: { name: 'Museo del Futuro', the: 'el Museo del Futuro', bonus: 3 },
  frame: { name: 'Marco de Dubái', the: 'el Marco de Dubái', bonus: 3 },
  atlantis: { name: 'Atlantis', the: 'el Atlantis', bonus: 3 },
};
const SIDE_LANDMARKS = ['arab', 'museum', 'frame', 'atlantis'];
// Centre-line spots (q = -r/2), nearest first. The Burj Khalifa always takes the centre.
function landmarkSpots(R) {
  const spots = [[0, 0], [1, -2], [-1, 2]];
  if (R >= 5) spots.push([2, -4], [-2, 4]);
  return spots;
}

function key(q, r) { return q + ',' + r; }

function radiusFor(playerCount) { return playerCount >= 8 ? 5 : 4; }

// sideOrder: which side landmarks to use, in spot order (the server shuffles it so every round looks different).
function buildBoard(R, sideOrder) {
  const tiles = [];
  const index = {};
  for (let q = -R; q <= R; q++) {
    for (let r = Math.max(-R, -q - R); r <= Math.min(R, -q + R); r++) {
      const id = tiles.length;
      const dist = Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
      tiles.push({ id, q, r, edge: dist === R });
      index[key(q, r)] = id;
    }
  }
  tiles.forEach((t) => {
    t.n = DIRS.map(([dq, dr]) => index[key(t.q + dq, t.r + dr)]).filter((x) => x !== undefined);
  });
  const cd = R - 2;
  const castles = { red: index[key(-cd, 0)], gold: index[key(cd, 0)] };
  tiles[castles.red].castle = 'red';
  tiles[castles.gold].castle = 'gold';
  const side = (sideOrder || SIDE_LANDMARKS).filter((k) => LANDMARKS[k] && k !== 'burj');
  const landmarks = {};
  landmarkSpots(R).forEach(([q, r], i) => {
    const lm = i === 0 ? 'burj' : side[i - 1];
    const id = index[key(q, r)];
    if (!lm || id === undefined) return;
    tiles[id].lm = lm;
    landmarks[id] = lm;
  });
  return { R, tiles, castles, landmarks };
}

// Bonus points each team earns from the landmarks it holds right now.
function landmarkScore(board, own) {
  const out = { red: 0, gold: 0 };
  Object.entries(board.landmarks || {}).forEach(([id, lm]) => {
    const t = own[id];
    if (out[t] !== undefined) out[t] += LANDMARKS[lm].bonus;
  });
  return out;
}

// Fresh ownership map: id → 'red' | 'gold' (absent = empty).
function initialOwnership(board) {
  const own = {};
  ['red', 'gold'].forEach((team) => {
    const c = board.castles[team];
    own[c] = team;
    board.tiles[c].n.forEach((id) => { own[id] = team; });
  });
  return own;
}

function validTargets(board, own, team) {
  const out = [];
  board.tiles.forEach((t) => {
    if (t.castle || own[t.id] === team) return;
    if (t.n.some((id) => own[id] === team)) out.push(t.id);
  });
  return out;
}

// Pockets of not-`team` tiles that touch no edge tile and hold no castle → they flip to `team`.
function enclosedPockets(board, own, team) {
  const seen = new Set();
  const flips = [];
  board.tiles.forEach((start) => {
    if (own[start.id] === team || seen.has(start.id)) return;
    const comp = [];
    let open = false;
    const stack = [start.id];
    seen.add(start.id);
    while (stack.length) {
      const id = stack.pop();
      const t = board.tiles[id];
      comp.push(id);
      if (t.edge || t.castle) open = true;
      t.n.forEach((nid) => {
        if (own[nid] !== team && !seen.has(nid)) { seen.add(nid); stack.push(nid); }
      });
    }
    if (!open) flips.push(...comp);
  });
  return flips;
}

// Applies a plant. Returns { tile, from, flipped: [{id, from}] } — caller has already validated the target.
function plant(board, own, team, tileId) {
  const from = own[tileId] || null;
  own[tileId] = team;
  const flipped = enclosedPockets(board, own, team).map((id) => ({ id, from: own[id] || null }));
  flipped.forEach(({ id }) => { own[id] = team; });
  return { tile: tileId, from, flipped };
}

// Best tile for an automatic plant (kid didn't tap in time): biggest surround first, a landmark counts like one
// flipped tile (kept modest on purpose: a kid who waits must not do better than a kid who taps), then stealing,
// then hugging our own land. Simulates each candidate on a copy.
function bestTarget(board, own, team) {
  const cands = validTargets(board, own, team);
  if (!cands.length) return null;
  let best = null;
  let bestScore = -Infinity;
  cands.forEach((id) => {
    const sim = Object.assign({}, own);
    sim[id] = team;
    const flipped = enclosedPockets(board, sim, team);
    const lms = [id].concat(flipped).filter((x) => board.tiles[x].lm).length;
    const t = board.tiles[id];
    const mine = t.n.filter((n) => own[n] === team).length;
    const score = flipped.length * 4 + lms * 4 + (own[id] ? 2 : 0) + mine + Math.random() * 0.5;
    if (score > bestScore) { bestScore = score; best = id; }
  });
  return best;
}

// Landmarks that changed hands in a plant result → [{ tile, lm, from }] (all now belong to the planter's team).
function landmarksTaken(board, result) {
  if (!result) return [];
  return [{ id: result.tile, from: result.from }].concat(result.flipped)
    .filter((x) => board.tiles[x.id] && board.tiles[x.id].lm)
    .map((x) => ({ tile: x.id, lm: board.tiles[x.id].lm, from: x.from || null }));
}

// How many of each castle's neighbours the OTHER team owns (0..6).
function castlePressure(board, own) {
  const out = {};
  ['red', 'gold'].forEach((team) => {
    const enemy = team === 'red' ? 'gold' : 'red';
    out[team] = board.tiles[board.castles[team]].n.filter((id) => own[id] === enemy).length;
  });
  return out;
}

function tileCounts(own) {
  const c = { red: 0, gold: 0 };
  Object.values(own).forEach((t) => { if (c[t] !== undefined) c[t]++; });
  return c;
}

// Compact board for clients: [id, q, r] + castles + landmarks { tileId: key } — everything else they can derive.
function publicBoard(board) {
  return {
    R: board.R,
    castles: board.castles,
    landmarks: board.landmarks || {},
    tiles: board.tiles.map((t) => [t.id, t.q, t.r]),
  };
}

// ---------- Mario Party touches (2026-10-16 ending pass) ----------
// «¡Banderas dobles!» in the last 30 s: every right answer earns twice the flags (a streak's double becomes three,
// never more, so a kid is never stuck planting for long). The same for both kingdoms: an early lead is never safe.
function flagsFor(streak, frenzy) {
  const base = streak > 0 && streak % 3 === 0 ? 2 : 1;
  return frenzy ? Math.min(3, base * 2) : base;
}

// ---------- the ending (core/party.js: «¡FINAL!», the reveal, the winners, the bonus stars, each kid's card) ----------
// rows: [{ k, name, skin, team, points, tiles, big, best, lms, right, answered }]
//   points  the kid's own points (1 + every tile a flag of theirs flipped + landmark bonuses they tapped)
//   tiles   tiles their flags took (the plant + the surround), big = the most in one flag, lms = landmarks they tapped
const STARS = [
  { id: 'tiles', name: 'Más territorio', unit: 'casillas', val: (r) => r.tiles, ok: (r) => r.tiles >= 1 },
  { id: 'big', name: 'Mayor conquista', unit: 'casillas de una vez', val: (r) => r.big, ok: (r) => r.big >= 3 },
  { id: 'streak', name: 'Racha más larga', unit: 'seguidas', val: (r) => r.best, ok: (r) => r.best >= 3 },
  { id: 'lms', name: 'Más monumentos', unit: 'monumentos', val: (r) => r.lms, ok: (r) => r.lms >= 1 },
];
function finish(rows, totals) {
  const Party = require('./party');
  const t = { red: (totals && totals.red) || 0, gold: (totals && totals.gold) || 0 };
  const winner = t.red > t.gold ? 'red' : t.gold > t.red ? 'gold' : 'tie';
  const sorted = rows.slice().sort((a, b) => b.points - a.points || b.tiles - a.tiles || a.k - b.k);
  Party.ranks(sorted, 'points');
  const raw = { red: 0, gold: 0 };
  rows.forEach((r) => { if (raw[r.team] != null) raw[r.team] += r.tiles; });
  const mvp = {};
  ['red', 'gold'].forEach((team) => { const top = sorted.find((r) => r.team === team && r.points > 0); mvp[team] = top ? top.k : null; });
  const st = Party.stars(rows, STARS);
  rows.forEach((r) => {
    r.share = Party.share(r.tiles, raw[r.team]);
    r.stars = st.filter((s) => s.winners.includes(r.k)).map((s) => s.id);
  });
  return { totals: t, winner, raw, mvp, stars: st, rows: sorted };
}

module.exports = {
  SIEGE_BONUS, ALERT_AT, LANDMARKS, SIDE_LANDMARKS, radiusFor, buildBoard, initialOwnership, validTargets,
  enclosedPockets, plant, bestTarget, castlePressure, tileCounts, landmarkScore, landmarksTaken, publicBoard,
  flagsFor, STARS, finish,
};
