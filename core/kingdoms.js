// Reinos de Colores — board rules (pure functions, no sockets).
// Hex board in axial coords (q, r), pointy-top, radius R. Two castles (red left, gold right), each starting with
// its castle tile + the 6 tiles around it. A right answer earns a flag; the kid plants it on any tile touching their
// land (empty or enemy, never a castle). After every plant, any pocket of not-yours tiles that touches neither the
// board edge nor a castle flips to your team ("¡Rodeado!"). Score = tiles owned + siege bonus.
'use strict';

const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const SIEGE_BONUS = 5;       // all 6 tiles around the enemy castle are yours
const ALERT_AT = 4;          // "castle almost surrounded" threshold (of 6 neighbours)

function key(q, r) { return q + ',' + r; }

function radiusFor(playerCount) { return playerCount >= 8 ? 5 : 4; }

function buildBoard(R) {
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
  return { R, tiles, castles };
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

// Best tile for an automatic plant (kid didn't tap in time): biggest surround first, then stealing,
// then hugging our own land. Simulates each candidate on a copy.
function bestTarget(board, own, team) {
  const cands = validTargets(board, own, team);
  if (!cands.length) return null;
  let best = null;
  let bestScore = -Infinity;
  cands.forEach((id) => {
    const sim = Object.assign({}, own);
    sim[id] = team;
    const flips = enclosedPockets(board, sim, team).length;
    const t = board.tiles[id];
    const mine = t.n.filter((n) => own[n] === team).length;
    const score = flips * 4 + (own[id] ? 2 : 0) + mine + Math.random() * 0.5;
    if (score > bestScore) { bestScore = score; best = id; }
  });
  return best;
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

// Compact board for clients: [id, q, r, castle?] — everything else they can derive.
function publicBoard(board) {
  return {
    R: board.R,
    castles: board.castles,
    tiles: board.tiles.map((t) => [t.id, t.q, t.r]),
  };
}

module.exports = {
  SIEGE_BONUS, ALERT_AT, radiusFor, buildBoard, initialOwnership, validTargets,
  enclosedPockets, plant, bestTarget, castlePressure, tileCounts, publicBoard,
};
