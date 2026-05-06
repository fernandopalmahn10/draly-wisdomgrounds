const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const Sets = require('./core/sets');
const Images = require('./core/images');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' }, maxHttpBufferSize: 5e6 });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '5mb' }));
app.get('/health', (req, res) => res.send('ok'));

// ---- Question Sets API ----
app.get('/api/sets', (req, res) => {
  try {
    res.json({ sets: Sets.listSets() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/sets/:id', (req, res) => {
  try {
    const set = Sets.loadSet(req.params.id);
    if (!set) return res.status(404).json({ error: 'Set not found' });
    res.json(set);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/sets', (req, res) => {
  try {
    const { filename, content } = req.body || {};
    if (!filename || !content) return res.status(400).json({ error: 'Missing filename or content' });
    const buffer = Buffer.from(content, 'base64');
    const set = Sets.saveSet(filename, buffer);
    res.json(set);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/sets/:id', (req, res) => {
  try {
    const ok = Sets.deleteSet(req.params.id);
    res.json({ ok });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/sets/:id/rename', (req, res) => {
  try {
    const { title } = req.body || {};
    const out = Sets.renameSet(req.params.id, title);
    if (!out) return res.status(404).json({ error: 'Set not found' });
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

const games = {};

const MASH_DURATION_MS = 5000;
const TAP_MIN_INTERVAL_MS = 70;
const COMBO_WINDOW_MS = 1000;
const COMBO_THRESHOLD = 8;
const WRONG_PENALTY = 3;
const COUNTDOWN_MS = 3500;

// Color Splash
const CS_GRID_W = 24;
const CS_GRID_H = 14;
const CS_WALK_DURATION_MS = 5000;
const CS_MOVE_COOLDOWN_MS = 130; // ~7 steps/sec max
const CS_WRONG_AUTO_PAINTS = 3;

// Color Clash (market theme, continuous movement, energy-based)
// Tuned for "answer questions often" — players burn through energy fast
const CC_GRID_W = 30;
const CC_GRID_H = 18;
const CC_MOVE_COOLDOWN_MS = 110; // 9 steps/sec max
const CC_START_ENERGY = 20;     // burns out in ~20 moves
const CC_ENERGY_PER_TILE = 1;
const CC_CORRECT_ENERGY = 12;   // ~12 more moves per correct answer
const CC_WRONG_ENEMY_PAINTS = 4;

function genPin() {
  let pin;
  do {
    pin = String(Math.floor(1000 + Math.random() * 9000));
  } while (games[pin]);
  return pin;
}

function pickTeam(game) {
  const counts = { red: 0, gold: 0 };
  Object.values(game.players).forEach((p) => counts[p.team]++);
  return counts.red <= counts.gold ? 'red' : 'gold';
}

function publicState(game) {
  return {
    state: game.state,
    duration: game.duration,
    endsAt: game.endsAt,
    teamScores: game.teamScores,
    questionsLoaded: game.questions.length,
    setTitle: game.setTitle || null,
    players: Object.fromEntries(
      Object.entries(game.players).map(([id, p]) => [
        id,
        { name: p.name, team: p.team, score: p.score }
      ])
    ),
    feed: game.feed.slice(-12)
  };
}

function broadcast(pin) {
  if (!games[pin]) return;
  io.to(pin).emit('state', publicState(games[pin]));
}

function nextQuestionFor(game, playerId) {
  const p = game.players[playerId];
  if (!p || !game.questions.length) return null;
  const q = game.questions[p.queueIdx % game.questions.length];
  p.queueIdx++;
  const shuffled = [...q.answers];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const qid = `q-${p.queueIdx}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const image = Images.urlForQuestion(q);
  p.currentQ = { qid, correctIdx: shuffled.indexOf(q.correct), text: q.text, answers: shuffled, image };
  p.lastQuestionAt = Date.now();
  return { qid, text: q.text, answers: shuffled, image };
}

function endGame(pin) {
  const g = games[pin];
  if (!g) return;
  g.state = 'ended';
  const winner =
    g.teamScores.red > g.teamScores.gold
      ? 'red'
      : g.teamScores.gold > g.teamScores.red
      ? 'gold'
      : 'tie';
  const sorted = Object.values(g.players).sort((a, b) => b.score - a.score);
  const mvpRed = sorted.find((p) => p.team === 'red');
  const mvpGold = sorted.find((p) => p.team === 'gold');
  io.to(pin).emit('game-end', {
    teamScores: g.teamScores,
    winner,
    mvpRed: mvpRed ? { name: mvpRed.name, score: mvpRed.score } : null,
    mvpGold: mvpGold ? { name: mvpGold.name, score: mvpGold.score } : null,
    leaderboard: sorted.map((p) => ({ name: p.name, score: p.score, team: p.team }))
  });
  broadcast(pin);
}

io.on('connection', (socket) => {
  let currentPin = null;
  let role = null;

  socket.on('host:create', (...args) => {
    // Accept both signatures:
    //   emit('host:create', cb)                       — old mochi client
    //   emit('host:create', { gameType }, cb)         — new client
    let opts = {};
    let cb = () => {};
    for (const a of args) {
      if (typeof a === 'function') cb = a;
      else if (a && typeof a === 'object') opts = a;
    }
    const pin = genPin();
    const validTypes = ['mochi-mash', 'color-splash', 'color-clash'];
    const type = validTypes.includes(opts.gameType) ? opts.gameType : 'mochi-mash';
    const defaultDuration = type === 'color-clash' ? 180 : (type === 'color-splash' ? 90 : 60);
    let grid = null;
    if (type === 'color-splash') {
      grid = Array.from({ length: CS_GRID_H }, () => Array(CS_GRID_W).fill(null));
    } else if (type === 'color-clash') {
      grid = Array.from({ length: CC_GRID_H }, () => Array(CC_GRID_W).fill(null));
    }
    games[pin] = {
      gameType: type,
      hostId: socket.id,
      state: 'lobby',
      duration: defaultDuration,
      startedAt: null,
      endsAt: null,
      questions: [],
      players: {},
      teamScores: { red: 0, gold: 0 },
      feed: [],
      grid
    };
    currentPin = pin;
    role = 'host';
    socket.join(pin);
    cb({ pin });
    broadcast(pin);
  });

  socket.on('host:upload-questions', ({ pin, questions }) => {
    const g = games[pin];
    if (!g || g.hostId !== socket.id) return;
    g.questions = (questions || []).filter(
      (q) => q && q.text && q.correct && Array.isArray(q.answers) && q.answers.length >= 2
    );
    broadcast(pin);
  });

  socket.on('host:load-set', ({ pin, setId }, cb) => {
    const g = games[pin];
    if (!g || g.hostId !== socket.id) {
      if (cb) cb({ ok: false, error: 'Not authorized' });
      return;
    }
    try {
      const set = Sets.loadSet(setId);
      if (!set) {
        if (cb) cb({ ok: false, error: 'Set not found' });
        return;
      }
      g.questions = set.questions;
      g.setTitle = set.title;
      broadcast(pin);
      if (cb) cb({ ok: true, title: set.title, count: set.questions.length });
      // Background pre-warm of all question images
      warmImagesForGame(pin, set.questions);
    } catch (e) {
      if (cb) cb({ ok: false, error: e.message });
    }
  });

  async function warmImagesForGame(pin, questions) {
    const g = games[pin];
    if (!g) return;
    const urls = questions.map((q) => Images.urlForQuestion(q));
    const total = urls.length;
    let warmed = 0;
    io.to(g.hostId).emit('images-progress', { warmed: 0, total });
    // Fire 3 in parallel to avoid hammering Pollinations
    const queue = [...urls];
    async function worker() {
      while (queue.length > 0) {
        const url = queue.shift();
        try {
          await fetch(url, { signal: AbortSignal.timeout(20000) });
        } catch (e) {
          // ignore failures — image will just take longer when displayed
        }
        warmed++;
        if (games[pin]) io.to(games[pin].hostId).emit('images-progress', { warmed, total });
      }
    }
    await Promise.all([worker(), worker(), worker()]);
  }

  socket.on('host:set-duration', ({ pin, duration }) => {
    const g = games[pin];
    if (!g || g.hostId !== socket.id) return;
    g.duration = Math.max(15, Math.min(600, Number(duration) || 60));
    broadcast(pin);
  });

  socket.on('host:swap-team', ({ pin, playerId }) => {
    const g = games[pin];
    if (!g || g.hostId !== socket.id) return;
    const p = g.players[playerId];
    if (!p) return;
    p.team = p.team === 'red' ? 'gold' : 'red';
    g.feed.push({ type: 'swap', name: p.name, team: p.team, t: Date.now() });
    io.to(playerId).emit('team-changed', { team: p.team });
    broadcast(pin);
  });

  socket.on('host:auto-balance', ({ pin }) => {
    const g = games[pin];
    if (!g || g.hostId !== socket.id) return;
    const ids = Object.keys(g.players).sort(() => Math.random() - 0.5);
    ids.forEach((id, i) => {
      g.players[id].team = i % 2 === 0 ? 'red' : 'gold';
      io.to(id).emit('team-changed', { team: g.players[id].team });
    });
    broadcast(pin);
  });

  socket.on('host:start', ({ pin }) => {
    const g = games[pin];
    if (!g || g.hostId !== socket.id) return;
    if (!g.questions.length) return;
    if (Object.keys(g.players).length === 0) return;
    g.state = 'countdown';
    broadcast(pin);
    io.to(pin).emit('countdown', { ms: COUNTDOWN_MS });

    setTimeout(() => {
      if (!games[pin]) return;
      g.state = 'active';
      g.startedAt = Date.now();
      g.endsAt = Date.now() + g.duration * 1000;
      g.teamScores = { red: 0, gold: 0 };
      Object.values(g.players).forEach((p) => {
        p.score = 0;
        p.queueIdx = 0;
        p.mashUntil = 0;
        p.walkUntil = 0;
        p.recentTaps = [];
      });
      // Reset grid + spawn positions for grid-based games
      if (g.gameType === 'color-splash' || g.gameType === 'color-clash') {
        const w = g.gameType === 'color-clash' ? CC_GRID_W : CS_GRID_W;
        const h = g.gameType === 'color-clash' ? CC_GRID_H : CS_GRID_H;
        const spawnFn = g.gameType === 'color-clash' ? ccSpawnPosition : csSpawnPosition;
        g.grid = Array.from({ length: h }, () => Array(w).fill(null));
        Object.values(g.players).forEach((p) => {
          const pos = spawnFn(g, p.team);
          p.x = pos.x;
          p.y = pos.y;
          if (g.gameType === 'color-clash') p.energy = CC_START_ENERGY;
        });
        const playersInit = {};
        Object.entries(g.players).forEach(([id, p]) => {
          playersInit[id] = { name: p.name, team: p.team, x: p.x, y: p.y };
        });
        io.to(pin).emit('cs:init', {
          gridW: w,
          gridH: h,
          players: playersInit,
          teamScores: g.teamScores
        });
      }
      broadcast(pin);
      // Mochi Mash + Color Splash auto-deal first question; Color Clash players request via button
      if (g.gameType !== 'color-clash') {
        Object.keys(g.players).forEach((pid) => {
          const q = nextQuestionFor(g, pid);
          if (q) io.to(pid).emit('question', q);
        });
      }
      g.endTimer = setTimeout(() => {
        if (!games[pin] || games[pin].state !== 'active') return;
        endGame(pin);
      }, g.duration * 1000);
    }, COUNTDOWN_MS);
  });

  socket.on('host:end-now', ({ pin }) => {
    const g = games[pin];
    if (!g || g.hostId !== socket.id) return;
    if (g.endTimer) clearTimeout(g.endTimer);
    endGame(pin);
  });

  socket.on('host:reset', ({ pin }) => {
    const g = games[pin];
    if (!g || g.hostId !== socket.id) return;
    if (g.endTimer) clearTimeout(g.endTimer);
    g.state = 'lobby';
    g.teamScores = { red: 0, gold: 0 };
    g.endsAt = null;
    Object.values(g.players).forEach((p) => {
      p.score = 0;
      p.queueIdx = 0;
      p.mashUntil = 0;
      p.recentTaps = [];
    });
    broadcast(pin);
  });

  socket.on('player:join', ({ pin, name }, cb) => {
    const g = games[pin];
    if (!g) return cb({ ok: false, error: 'No game with that PIN' });
    if (g.state === 'ended') return cb({ ok: false, error: 'Game has ended' });
    const cleanName = String(name || '').trim().slice(0, 20);
    if (!cleanName) return cb({ ok: false, error: 'Please enter a name' });

    // Look for existing player by name (case-insensitive). If found, attach to that slot.
    const existingEntry = Object.entries(g.players).find(
      ([id, p]) => p.name.toLowerCase() === cleanName.toLowerCase()
    );

    let player;
    let isRejoin = false;
    if (existingEntry) {
      const [oldId, existingPlayer] = existingEntry;
      isRejoin = true;
      player = existingPlayer;
      player.disconnected = false;
      player.disconnectedAt = null;
      // Move slot to new socket id (preserves all state — score, position, team)
      if (oldId !== socket.id) {
        g.players[socket.id] = player;
        delete g.players[oldId];
        // Cancel any pending cleanup timer
        if (player.cleanupTimer) {
          clearTimeout(player.cleanupTimer);
          player.cleanupTimer = null;
        }
      }
      g.feed.push({ type: 'rejoin', name: cleanName, team: player.team, t: Date.now() });
    } else {
      // New player — pick smaller team, spawn position for color splash
      const team = pickTeam(g);
      player = {
        name: cleanName,
        team,
        score: 0,
        queueIdx: 0,
        mashUntil: 0,
        lastTap: 0,
        recentTaps: [],
        currentQ: null,
        x: 0,
        y: 0,
        walkUntil: 0,
        lastMove: 0,
        energy: CC_START_ENERGY,
        disconnected: false,
        disconnectedAt: null
      };
      if (g.gameType === 'color-splash') {
        const pos = csSpawnPosition(g, team);
        player.x = pos.x;
        player.y = pos.y;
      } else if (g.gameType === 'color-clash') {
        const pos = ccSpawnPosition(g, team);
        player.x = pos.x;
        player.y = pos.y;
      }
      g.players[socket.id] = player;
      g.feed.push({ type: 'join', name: cleanName, team: player.team, t: Date.now() });
    }

    currentPin = pin;
    role = 'player';
    socket.join(pin);

    const gridW = g.gameType === 'color-clash' ? CC_GRID_W : CS_GRID_W;
    const gridH = g.gameType === 'color-clash' ? CC_GRID_H : CS_GRID_H;
    cb({
      ok: true,
      team: player.team,
      playerId: socket.id,
      gameType: g.gameType,
      gridW,
      gridH,
      x: player.x,
      y: player.y,
      energy: player.energy,
      rejoined: isRejoin,
      gameState: g.state
    });
    broadcast(pin);

    // If joining/rejoining mid-game, send them a question to keep playing
    if (g.state === 'active') {
      // For Color Splash and Color Clash, send the current grid + paint state so the rejoiner sees everything
      if (g.gameType === 'color-splash' || g.gameType === 'color-clash') {
        const w = g.gameType === 'color-clash' ? CC_GRID_W : CS_GRID_W;
        const h = g.gameType === 'color-clash' ? CC_GRID_H : CS_GRID_H;
        const playersInit = {};
        Object.entries(g.players).forEach(([id, p]) => {
          playersInit[id] = { name: p.name, team: p.team, x: p.x, y: p.y };
        });
        io.to(socket.id).emit('cs:init', {
          gridW: w,
          gridH: h,
          players: playersInit,
          teamScores: g.teamScores
        });
        // Also send a "paint" event with all currently-painted cells so the rejoiner sees the state
        const paintedCells = [];
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (g.grid[y][x]) paintedCells.push({ x, y, team: g.grid[y][x] });
          }
        }
        if (paintedCells.length > 0) {
          io.to(socket.id).emit('cs:paint', { cells: paintedCells, teamScores: g.teamScores });
        }
      }
      // Send an active question (preserve their currentQ if rejoining)
      if (player.currentQ) {
        io.to(socket.id).emit('question', {
          qid: player.currentQ.qid,
          text: player.currentQ.text,
          answers: player.currentQ.answers,
          image: player.currentQ.image
        });
      } else {
        const q = nextQuestionFor(g, socket.id);
        if (q) io.to(socket.id).emit('question', q);
      }
    }
  });

  function csSpawnPosition(g, team) {
    const half = Math.floor(CS_GRID_W / 2);
    for (let attempt = 0; attempt < 30; attempt++) {
      const y = Math.floor(Math.random() * CS_GRID_H);
      const x = team === 'red'
        ? Math.floor(Math.random() * 4)
        : CS_GRID_W - 1 - Math.floor(Math.random() * 4);
      const occupied = Object.values(g.players).some((p) => p.x === x && p.y === y);
      if (!occupied) return { x, y };
    }
    return {
      x: team === 'red' ? 0 : CS_GRID_W - 1,
      y: Math.floor(Math.random() * CS_GRID_H)
    };
  }

  function csPaintCell(g, x, y, team) {
    if (x < 0 || x >= CS_GRID_W || y < 0 || y >= CS_GRID_H) return false;
    const prev = g.grid[y][x];
    if (prev === team) return false;
    if (prev) g.teamScores[prev]--;
    g.grid[y][x] = team;
    g.teamScores[team]++;
    return true;
  }

  function ccSpawnPosition(g, team) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const y = Math.floor(Math.random() * CC_GRID_H);
      const x = team === 'red'
        ? Math.floor(Math.random() * 4)
        : CC_GRID_W - 1 - Math.floor(Math.random() * 4);
      const occupied = Object.values(g.players).some((p) => p.x === x && p.y === y);
      if (!occupied) return { x, y };
    }
    return {
      x: team === 'red' ? 0 : CC_GRID_W - 1,
      y: Math.floor(Math.random() * CC_GRID_H)
    };
  }

  function ccPaintCell(g, x, y, team) {
    if (x < 0 || x >= CC_GRID_W || y < 0 || y >= CC_GRID_H) return false;
    const prev = g.grid[y][x];
    if (prev === team) return false;
    if (prev) g.teamScores[prev]--;
    g.grid[y][x] = team;
    g.teamScores[team]++;
    return true;
  }

  socket.on('player:answer', ({ pin, qid, choiceIdx }) => {
    const g = games[pin];
    if (!g || g.state !== 'active') return;
    const p = g.players[socket.id];
    if (!p || !p.currentQ || p.currentQ.qid !== qid) return;
    const correct = p.currentQ.correctIdx === choiceIdx;
    const correctText = p.currentQ.answers[p.currentQ.correctIdx];
    p.currentQ = null;

    if (g.gameType === 'color-splash') {
      // Color Splash: correct → walk window, wrong → enemy gets free random paints
      if (correct) {
        p.walkUntil = Date.now() + CS_WALK_DURATION_MS;
        // Paint the cell they're standing on
        const painted = csPaintCell(g, p.x, p.y, p.team);
        io.to(socket.id).emit('answer-result', {
          correct: true,
          walkUntil: p.walkUntil,
          correctText
        });
        if (painted) {
          io.to(pin).emit('cs:paint', { cells: [{ x: p.x, y: p.y, team: p.team }], teamScores: g.teamScores });
        }
      } else {
        const enemy = p.team === 'red' ? 'gold' : 'red';
        const painted = [];
        for (let i = 0; i < CS_WRONG_AUTO_PAINTS; i++) {
          const rx = Math.floor(Math.random() * CS_GRID_W);
          const ry = Math.floor(Math.random() * CS_GRID_H);
          if (csPaintCell(g, rx, ry, enemy)) painted.push({ x: rx, y: ry, team: enemy });
        }
        io.to(socket.id).emit('answer-result', { correct: false, correctText });
        io.to(pin).emit('cs:paint', { cells: painted, teamScores: g.teamScores });
      }
    } else if (g.gameType === 'color-clash') {
      // Color Clash: correct → +energy, wrong → enemy gets random paints
      if (correct) {
        p.energy = (p.energy || 0) + CC_CORRECT_ENERGY;
        io.to(socket.id).emit('answer-result', {
          correct: true,
          energy: p.energy,
          correctText
        });
      } else {
        const enemy = p.team === 'red' ? 'gold' : 'red';
        const painted = [];
        for (let i = 0; i < CC_WRONG_ENEMY_PAINTS; i++) {
          const rx = Math.floor(Math.random() * CC_GRID_W);
          const ry = Math.floor(Math.random() * CC_GRID_H);
          if (ccPaintCell(g, rx, ry, enemy)) painted.push({ x: rx, y: ry, team: enemy });
        }
        io.to(socket.id).emit('answer-result', { correct: false, correctText, energy: p.energy });
        io.to(pin).emit('cs:paint', { cells: painted, teamScores: g.teamScores });
      }
    } else {
      // Mochi Mash logic
      if (correct) {
        p.mashUntil = Date.now() + MASH_DURATION_MS;
        io.to(socket.id).emit('answer-result', {
          correct: true,
          mashUntil: p.mashUntil,
          correctText
        });
      } else {
        const enemy = p.team === 'red' ? 'gold' : 'red';
        g.teamScores[enemy] += WRONG_PENALTY;
        io.to(socket.id).emit('answer-result', { correct: false, correctText });
        io.to(pin).emit('score-update', { teamScores: g.teamScores });
      }
    }

    let nextDelay;
    if (g.gameType === 'color-clash') {
      // Color Clash players request questions via button — don't auto-push another
      nextDelay = -1;
    } else if (g.gameType === 'color-splash') {
      nextDelay = correct ? CS_WALK_DURATION_MS + 600 : 1400;
    } else {
      nextDelay = correct ? MASH_DURATION_MS + 600 : 1400;
    }
    if (nextDelay >= 0) {
      setTimeout(() => {
        if (!games[pin] || games[pin].state !== 'active') return;
        const q = nextQuestionFor(g, socket.id);
        if (q) io.to(socket.id).emit('question', q);
      }, nextDelay);
    }
    broadcast(pin);
  });

  // Color Clash: continuous movement (no walk window). Each move costs 1 energy.
  socket.on('player:cc-move', ({ pin, dx, dy }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'color-clash' || g.state !== 'active') return;
    const p = g.players[socket.id];
    if (!p) return;
    const now = Date.now();
    if (now - p.lastMove < CC_MOVE_COOLDOWN_MS) return;
    if ((p.energy || 0) < CC_ENERGY_PER_TILE) return; // out of energy — must answer questions
    dx = Math.sign(Number(dx) || 0);
    dy = Math.sign(Number(dy) || 0);
    if (dx === 0 && dy === 0) return;
    if (dx !== 0 && dy !== 0) return; // cardinal only
    const nx = Math.max(0, Math.min(CC_GRID_W - 1, p.x + dx));
    const ny = Math.max(0, Math.min(CC_GRID_H - 1, p.y + dy));
    if (nx === p.x && ny === p.y) return; // hit edge
    p.x = nx;
    p.y = ny;
    p.lastMove = now;
    p.energy -= CC_ENERGY_PER_TILE;
    const painted = ccPaintCell(g, nx, ny, p.team);
    if (painted) p.score++;
    io.to(socket.id).emit('cc:energy', { energy: p.energy });
    io.to(pin).emit('cs:move', {
      playerId: socket.id,
      x: nx, y: ny,
      paint: painted ? { x: nx, y: ny, team: p.team } : null,
      teamScores: g.teamScores
    });
  });

  // Color Clash: player explicitly requests a question
  socket.on('player:request-question', ({ pin }) => {
    const g = games[pin];
    if (!g || g.state !== 'active') return;
    const p = g.players[socket.id];
    if (!p) return;
    if (p.currentQ) return; // already has one open
    const q = nextQuestionFor(g, socket.id);
    if (q) io.to(socket.id).emit('question', q);
  });

  socket.on('player:move', ({ pin, dx, dy }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'color-splash' || g.state !== 'active') return;
    const p = g.players[socket.id];
    if (!p) return;
    const now = Date.now();
    if (now > p.walkUntil) return; // not in walk window
    if (now - p.lastMove < CS_MOVE_COOLDOWN_MS) return;
    dx = Math.sign(Number(dx) || 0);
    dy = Math.sign(Number(dy) || 0);
    if (dx === 0 && dy === 0) return;
    if (dx !== 0 && dy !== 0) return; // cardinal only
    const nx = Math.max(0, Math.min(CS_GRID_W - 1, p.x + dx));
    const ny = Math.max(0, Math.min(CS_GRID_H - 1, p.y + dy));
    if (nx === p.x && ny === p.y) return; // hit wall
    p.x = nx;
    p.y = ny;
    p.lastMove = now;
    const painted = csPaintCell(g, nx, ny, p.team);
    if (painted) p.score++;
    io.to(pin).emit('cs:move', {
      playerId: socket.id,
      x: nx, y: ny,
      paint: painted ? { x: nx, y: ny, team: p.team } : null,
      teamScores: g.teamScores
    });
  });

  socket.on('player:tap', ({ pin }) => {
    const g = games[pin];
    if (!g || g.state !== 'active') return;
    const p = g.players[socket.id];
    if (!p) return;
    const now = Date.now();
    if (now > p.mashUntil) return;
    if (now - p.lastTap < TAP_MIN_INTERVAL_MS) return;
    p.lastTap = now;
    p.recentTaps.push(now);
    p.recentTaps = p.recentTaps.filter((t) => now - t < COMBO_WINDOW_MS);
    let points = 1;
    let combo = false;
    if (p.recentTaps.length >= COMBO_THRESHOLD) {
      points = 2;
      combo = true;
    }
    p.score += points;
    g.teamScores[p.team] += points;
    io.to(socket.id).emit('tap-ack', { points, combo, score: p.score });
    // Throttle score broadcasts: max 1 per 150ms per game (was every tap = thousands/sec lag)
    if (!g.lastScoreBroadcast || now - g.lastScoreBroadcast >= 150) {
      g.lastScoreBroadcast = now;
      io.to(pin).emit('score-update', { teamScores: g.teamScores });
    }
    // Per-game aggregated tap-fx broadcast: collect taps in 100ms windows then send one event with the count
    if (!g.tapFxBuffer) g.tapFxBuffer = { red: 0, gold: 0 };
    g.tapFxBuffer[p.team] += points;
    if (!g.lastTapFx || now - g.lastTapFx >= 100) {
      g.lastTapFx = now;
      io.to(pin).emit('tap-fx', { red: g.tapFxBuffer.red, gold: g.tapFxBuffer.gold });
      g.tapFxBuffer = { red: 0, gold: 0 };
    }
    if (combo && Math.random() < 0.15) {
      g.feed.push({ type: 'combo', name: p.name, team: p.team, t: now });
      broadcast(pin);
    }
  });

  // (Watchdog moved outside the connection handler — see bottom of file. The previous
  // version registered a new interval on every connection, which compounded as a CPU leak.)

  socket.on('disconnect', () => {
    if (!currentPin || !games[currentPin]) return;
    const g = games[currentPin];

    if (role === 'host') {
      // Soft disconnect: give the host 60 seconds to reconnect (mobile lock screens, network blips)
      g.hostDisconnectedAt = Date.now();
      g.feed.push({ type: 'host-disconnect', t: Date.now() });
      broadcast(currentPin);
      // Schedule final cleanup if host doesn't return
      g.hostCleanupTimer = setTimeout(() => {
        const stillExists = games[currentPin];
        if (!stillExists) return;
        // Only end if no new host has reconnected (hostId would have changed)
        if (stillExists.hostId === socket.id) {
          if (stillExists.endTimer) clearTimeout(stillExists.endTimer);
          io.to(currentPin).emit('host-left');
          delete games[currentPin];
        }
      }, 60000);
    } else if (role === 'player') {
      const p = g.players[socket.id];
      if (p) {
        // Soft disconnect: keep slot for rejoin, mark as disconnected
        p.disconnected = true;
        p.disconnectedAt = Date.now();
        g.feed.push({ type: 'leave', name: p.name, t: Date.now() });
        broadcast(currentPin);
        // Schedule full cleanup after 5 minutes of inactivity
        const grabbedSocketId = socket.id;
        p.cleanupTimer = setTimeout(() => {
          const stillExists = games[currentPin];
          if (!stillExists) return;
          const stillThere = stillExists.players[grabbedSocketId];
          if (stillThere && stillThere.disconnected && stillThere.disconnectedAt &&
              Date.now() - stillThere.disconnectedAt >= 4 * 60 * 1000) {
            delete stillExists.players[grabbedSocketId];
            broadcast(currentPin);
          }
        }, 5 * 60 * 1000);
      }
    }
  });
});

// === Single global watchdog ===
// Periodically checks every active game and pushes a question to any player who's been
// waiting too long with nothing happening. This protects against the rare race where
// the next-question setTimeout never fires (e.g. server restart mid-round, scheduling glitch).
setInterval(() => {
  const now = Date.now();
  Object.entries(games).forEach(([pin, g]) => {
    if (g.state !== 'active') return;
    Object.entries(g.players).forEach(([pid, p]) => {
      const inAction = p.mashUntil > now || p.walkUntil > now || p.currentQ;
      if (!inAction && (!p.lastQuestionAt || now - p.lastQuestionAt > 12000)) {
        const q = nextQuestionFor(g, pid);
        if (q) {
          p.lastQuestionAt = now;
          io.to(pid).emit('question', q);
        }
      }
    });
  });
}, 4000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n  Mochi Mash running on http://localhost:${PORT}\n`);
});
