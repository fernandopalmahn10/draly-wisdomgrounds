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

// Market Quest (Canvas-based RPG) — players walk around a market,
// approach vendor NPCs, answer vocab questions to claim items.
const MQ_WORLD_W = 1600;   // game world width in "game pixels"
const MQ_WORLD_H = 900;    // game world height
const MQ_PLAYER_SPEED = 4; // pixels per server tick
const MQ_VENDOR_RADIUS = 130; // collision radius for vendor interaction (forgiving)
const MQ_TICK_MS = 50;       // 20Hz server tick

// Flappy Dragon — each player has their own parallel-play world.
// Tap to flap, gravity drops you, scrolling pipes, die = answer-to-revive.
const FL_WORLD_W = 800;
const FL_WORLD_H = 480;
const FL_GRAVITY = 0.5;      // px/tick² (downward acceleration)
const FL_FLAP_VY = -7.5;     // upward velocity on tap
const FL_SCROLL_SPEED = 3;   // px/tick (~60 px/sec)
const FL_PIPE_GAP = 160;     // vertical gap between top + bottom rocks
const FL_PIPE_W = 80;        // pipe width
const FL_PIPE_SPACING = 280; // horizontal spacing between pipe pairs
const FL_PLAYER_X = 180;     // fixed x position of the player's plane on screen
const FL_PLAYER_R = 28;      // collision radius
const FL_TICK_MS = 33;       // ~30Hz tick
// Vendor positions. Each vendor occupies a spot. The mapping to vocab question
// happens at game start based on the loaded set. food sprite index from food-tiles.png
const MQ_VENDORS = [
  { id: 0,  x: 240,  y: 220,  icon: '🍎' },
  { id: 1,  x: 560,  y: 220,  icon: '🍵' },
  { id: 2,  x: 880,  y: 220,  icon: '🥟' },
  { id: 3,  x: 1200, y: 220,  icon: '🥢' },
  { id: 4,  x: 1360, y: 460,  icon: '💰' },
  { id: 5,  x: 1200, y: 700,  icon: '🍚' },
  { id: 6,  x: 880,  y: 700,  icon: '🥮' },
  { id: 7,  x: 560,  y: 700,  icon: '🍡' },
  { id: 8,  x: 240,  y: 700,  icon: '🏮' },
  { id: 9,  x: 80,   y: 460,  icon: '🛍️' },
  { id: 10, x: 720,  y: 460,  icon: '🍶' }
];

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

// Flappy: spawn the initial run of pipes far enough ahead that the player can ramp up
function generateInitialPipes() {
  const pipes = [];
  let x = FL_WORLD_W + 100; // first pipe just past the right edge
  for (let i = 0; i < 4; i++) {
    pipes.push({
      x,
      gapY: 100 + Math.random() * (FL_WORLD_H - 200), // gap center between 100 and worldH-100
      scored: false
    });
    x += FL_PIPE_SPACING;
  }
  return pipes;
}

// Market Quest: serve a question tied to a specific vendor (module scope so the
// global tick loop can call it — it was previously inside the connection handler,
// causing ReferenceError crashes on vendor collision).
function nextQuestionForVendor(g, playerId, vendorId) {
  const p = g.players[playerId];
  const vendor = g.vendors && g.vendors.find((v) => v.id === vendorId);
  if (!p || !vendor || vendor.vocabIdx < 0) return null;
  const q = g.questions[vendor.vocabIdx];
  if (!q) return null;
  const shuffled = [...q.answers];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const qid = `mq-${vendorId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const image = Images.urlForQuestion(q);
  p.currentQ = {
    qid,
    correctIdx: shuffled.indexOf(q.correct),
    text: q.text,
    answers: shuffled,
    image,
    vendorId
  };
  p.lastQuestionAt = Date.now();
  return { qid, text: q.text, answers: shuffled, image, vendorId };
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
    const validTypes = ['mochi-mash', 'color-splash', 'color-clash', 'market-quest', 'flappy'];
    const type = validTypes.includes(opts.gameType) ? opts.gameType : 'mochi-mash';
    const defaultDuration =
      type === 'flappy'       ? 120 :
      type === 'market-quest' ? 240 :
      type === 'color-clash'  ? 180 :
      type === 'color-splash' ? 90 :
      60;
    let grid = null;
    let vendors = null;
    if (type === 'color-splash') {
      grid = Array.from({ length: CS_GRID_H }, () => Array(CS_GRID_W).fill(null));
    } else if (type === 'color-clash') {
      grid = Array.from({ length: CC_GRID_H }, () => Array(CC_GRID_W).fill(null));
    } else if (type === 'market-quest') {
      // Each vendor starts unclaimed. vocabIdx is set on game start.
      vendors = MQ_VENDORS.map((v) => ({ ...v, claimedBy: null, vocabIdx: -1 }));
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
      grid,
      vendors
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

      // Flappy: reset each player's bird/score/pipes and send init
      if (g.gameType === 'flappy') {
        Object.values(g.players).forEach((p) => {
          p.flY = FL_WORLD_H / 2;
          p.flVy = 0;
          p.flScore = 0;
          p.flAlive = true;
          p.flPipes = generateInitialPipes();
          p.flPipeIdx = p.flPipes.length;
          p.flScrollX = 0;
          p.flDeathReason = null;
        });
        io.to(pin).emit('fl:init', {
          worldW: FL_WORLD_W,
          worldH: FL_WORLD_H,
          pipeW: FL_PIPE_W,
          pipeGap: FL_PIPE_GAP,
          playerX: FL_PLAYER_X,
          players: Object.fromEntries(
            Object.entries(g.players).map(([id, pl]) => [id, {
              name: pl.name, team: pl.team, y: pl.flY, score: 0, alive: true
            }])
          ),
          teamScores: g.teamScores
        });
      }

      // Market Quest: assign vendor → vocab mapping, reset everything, send init
      if (g.gameType === 'market-quest') {
        // Shuffle vocab indexes and assign to vendors
        const vocabIdxs = g.questions.map((_, i) => i).sort(() => Math.random() - 0.5);
        g.vendors = MQ_VENDORS.map((v, i) => ({
          ...v,
          claimedBy: null,
          vocabIdx: vocabIdxs[i % vocabIdxs.length]
        }));
        // Reset players to spawn positions
        Object.values(g.players).forEach((p) => {
          p.x = p.team === 'red' ? 100 + Math.random() * 60 : MQ_WORLD_W - 160 + Math.random() * 60;
          p.y = MQ_WORLD_H / 2 + (Math.random() - 0.5) * 200;
          p.dir = p.team === 'red' ? 'right' : 'left';
          p.moving = false;
          p.vendorCooldowns = {};
          p.input = { left: false, right: false, up: false, down: false };
        });
        io.to(pin).emit('mq:init', {
          worldW: MQ_WORLD_W,
          worldH: MQ_WORLD_H,
          vendors: g.vendors,
          players: Object.fromEntries(
            Object.entries(g.players).map(([id, p]) => [id, {
              name: p.name, team: p.team, x: p.x, y: p.y, dir: p.dir
            }])
          ),
          teamScores: g.teamScores
        });
      }
      broadcast(pin);
      // Mochi Mash + Color Splash auto-deal first question.
      // Color Clash → button-driven; Market Quest → vendor-driven; Flappy → death-driven.
      const skipAutoPush = ['color-clash', 'market-quest', 'flappy'].includes(g.gameType);
      if (!skipAutoPush) {
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
      } else if (g.gameType === 'market-quest') {
        // Spawn on the appropriate team side of the world, vertically random
        player.x = team === 'red' ? 100 + Math.random() * 60 : MQ_WORLD_W - 160 + Math.random() * 60;
        player.y = MQ_WORLD_H / 2 + (Math.random() - 0.5) * 200;
        player.dir = team === 'red' ? 'right' : 'left';
        player.moving = false;
        player.vendorCooldowns = {}; // vendor id → unlock timestamp
      } else if (g.gameType === 'flappy') {
        // Each player has their own scrolling world. Server-side state per player:
        player.flY = FL_WORLD_H / 2;
        player.flVy = 0;
        player.flScore = 0;
        player.flAlive = true;
        player.flPipes = [];     // queue of pipes {x, gapY}
        player.flPipeIdx = 0;    // next pipe id counter (for unique keys)
        player.flScrollX = 0;    // total distance scrolled (for parallax + score)
        player.flDeathReason = null;
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

    // If joining/rejoining mid-game, sync them up
    if (g.state === 'active') {
      // Market Quest: send the world state
      if (g.gameType === 'market-quest') {
        io.to(socket.id).emit('mq:init', {
          worldW: MQ_WORLD_W,
          worldH: MQ_WORLD_H,
          vendors: g.vendors,
          players: Object.fromEntries(
            Object.entries(g.players).map(([id, pl]) => [id, {
              name: pl.name, team: pl.team, x: pl.x, y: pl.y, dir: pl.dir || 'down'
            }])
          ),
          teamScores: g.teamScores
        });
      }
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
      // Market Quest + Flappy don't auto-push: market = vendor collision, flappy = on death
      if (g.gameType !== 'market-quest' && g.gameType !== 'flappy') {
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
    const cqData = p.currentQ;
    const correct = cqData.correctIdx === choiceIdx;
    const correctText = cqData.answers[cqData.correctIdx];
    p.currentQ = null;

    if (g.gameType === 'flappy') {
      if (correct) {
        // Revive: full health, mid-screen, fresh pipes
        p.flY = FL_WORLD_H / 2;
        p.flVy = 0;
        p.flAlive = true;
        p.flDeathReason = null;
        // Clear pipes that would immediately kill them; respawn ahead
        p.flPipes = generateInitialPipes();
        io.to(socket.id).emit('answer-result', { correct: true, correctText, revived: true });
        io.to(socket.id).emit('fl:revived');
      } else {
        // Wrong: stay dead, get another question after a short delay
        io.to(socket.id).emit('answer-result', { correct: false, correctText });
        setTimeout(() => {
          if (!games[pin] || games[pin].state !== 'active') return;
          if (g.players[socket.id] && !g.players[socket.id].flAlive) {
            sendReviveQuestion(g, socket.id);
          }
        }, 1800);
      }
      broadcast(pin);
      return;
    }

    if (g.gameType === 'market-quest') {
      const vendorId = cqData.vendorId;
      const vendor = g.vendors && g.vendors.find((v) => v.id === vendorId);
      if (correct && vendor && !vendor.claimedBy) {
        vendor.claimedBy = p.team;
        p.score = (p.score || 0) + 1;
        g.teamScores[p.team]++;
        io.to(pin).emit('mq:vendor-claimed', {
          vendorId,
          team: p.team,
          playerName: p.name,
          teamScores: g.teamScores
        });
        io.to(socket.id).emit('answer-result', {
          correct: true,
          vendorId,
          correctText,
          playerScore: p.score
        });
      } else if (correct) {
        // Already claimed somehow — no score
        io.to(socket.id).emit('answer-result', { correct: true, vendorId, correctText });
      } else {
        // Wrong: 8-second cooldown for this player on this vendor
        if (!p.vendorCooldowns) p.vendorCooldowns = {};
        p.vendorCooldowns[vendorId] = Date.now() + 8000;
        io.to(socket.id).emit('answer-result', { correct: false, vendorId, correctText });
      }
      // Win check: all vendors claimed → end game early
      if (g.vendors.every((v) => v.claimedBy)) {
        if (g.endTimer) clearTimeout(g.endTimer);
        endGame(pin);
      }
      broadcast(pin);
      return; // don't run other game branches
    }

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

  // Flappy: tap to flap (gives upward velocity)
  socket.on('player:fl-flap', ({ pin }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'flappy' || g.state !== 'active') return;
    const p = g.players[socket.id];
    if (!p || !p.flAlive) return;
    p.flVy = FL_FLAP_VY;
  });

  // Market Quest: player sends their movement input state (held keys/joystick)
  socket.on('player:mq-input', ({ pin, left, right, up, down }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'market-quest' || g.state !== 'active') return;
    const p = g.players[socket.id];
    if (!p) return;
    p.input = {
      left: !!left, right: !!right, up: !!up, down: !!down
    };
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
// (Skips market-quest — that game uses vendor collision triggers, not auto-push)
setInterval(() => {
  const now = Date.now();
  Object.entries(games).forEach(([pin, g]) => {
    if (g.state !== 'active') return;
    if (g.gameType === 'market-quest') return; // vendor-driven, no watchdog needed
    if (g.gameType === 'flappy') return;       // revive-driven, no watchdog
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

// === Market Quest 20Hz physics tick ===
// Advances player positions based on their input, checks vendor collisions,
// auto-triggers a vocab question on first proximity (with cooldowns).
setInterval(() => {
  const now = Date.now();
  Object.entries(games).forEach(([pin, g]) => {
    if (g.gameType !== 'market-quest' || g.state !== 'active') return;

    // Update positions
    Object.entries(g.players).forEach(([pid, p]) => {
      if (!p.input) p.input = {};
      let vx = 0, vy = 0;
      if (p.input.left)  vx -= 1;
      if (p.input.right) vx += 1;
      if (p.input.up)    vy -= 1;
      if (p.input.down)  vy += 1;
      if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }
      vx *= MQ_PLAYER_SPEED;
      vy *= MQ_PLAYER_SPEED;
      if (vx !== 0 || vy !== 0) {
        p.x = Math.max(40, Math.min(MQ_WORLD_W - 40, p.x + vx));
        p.y = Math.max(40, Math.min(MQ_WORLD_H - 40, p.y + vy));
        p.moving = true;
        if (Math.abs(vx) > Math.abs(vy)) p.dir = vx > 0 ? 'right' : 'left';
        else p.dir = vy > 0 ? 'down' : 'up';
      } else {
        p.moving = false;
      }

      // Vendor collision check — auto-trigger quiz if near unclaimed vendor
      if (!p.currentQ) {
        for (const v of g.vendors) {
          if (v.claimedBy) continue;
          const cd = (p.vendorCooldowns && p.vendorCooldowns[v.id]) || 0;
          if (cd > now) continue;
          const dx = p.x - v.x;
          const dy = p.y - v.y;
          if (dx * dx + dy * dy < MQ_VENDOR_RADIUS * MQ_VENDOR_RADIUS) {
            const q = nextQuestionForVendor(g, pid, v.id);
            if (q) io.to(pid).emit('question', q);
            break;
          }
        }
      }
    });

    // Broadcast tick — compact positions
    const positions = {};
    Object.entries(g.players).forEach(([id, p]) => {
      positions[id] = {
        x: Math.round(p.x),
        y: Math.round(p.y),
        d: p.dir || 'down',
        m: p.moving ? 1 : 0
      };
    });
    io.to(pin).emit('mq:tick', { p: positions });
  });
}, MQ_TICK_MS);

// === Flappy ~30Hz physics tick ===
// Each player has independent state: gravity, scrolling pipes, collisions.
// When they die, server sends them a question; on correct answer they revive.
setInterval(() => {
  Object.entries(games).forEach(([pin, g]) => {
    if (g.gameType !== 'flappy' || g.state !== 'active') return;

    const updates = {};
    Object.entries(g.players).forEach(([pid, p]) => {
      if (!p.flAlive) {
        // Dead — just report position so client renders frozen plane
        updates[pid] = { y: Math.round(p.flY), s: p.flScore, a: 0 };
        return;
      }
      // Physics
      p.flVy += FL_GRAVITY;
      p.flY += p.flVy;
      p.flScrollX += FL_SCROLL_SPEED;

      // Floor/ceiling = instant death
      if (p.flY < 20 || p.flY > FL_WORLD_H - 20) {
        p.flAlive = false;
        p.flDeathReason = p.flY < 20 ? 'ceiling' : 'floor';
        io.to(pid).emit('fl:died', { reason: p.flDeathReason, score: p.flScore });
        // Send a question to revive
        sendReviveQuestion(g, pid);
        updates[pid] = { y: Math.round(p.flY), s: p.flScore, a: 0 };
        return;
      }

      // Scroll pipes left
      p.flPipes.forEach((pipe) => { pipe.x -= FL_SCROLL_SPEED; });
      // Remove pipes that left the screen, add new ones on the right
      p.flPipes = p.flPipes.filter((pipe) => pipe.x > -FL_PIPE_W - 50);
      while (p.flPipes.length < 4) {
        const lastX = p.flPipes.length > 0
          ? Math.max(...p.flPipes.map((pp) => pp.x))
          : FL_WORLD_W;
        p.flPipes.push({
          x: lastX + FL_PIPE_SPACING,
          gapY: 100 + Math.random() * (FL_WORLD_H - 200),
          scored: false
        });
      }

      // Collision check + score pipes the player has passed
      const px = FL_PLAYER_X;
      for (const pipe of p.flPipes) {
        // Score when pipe has fully passed player's x
        if (!pipe.scored && pipe.x + FL_PIPE_W < px - FL_PLAYER_R) {
          pipe.scored = true;
          p.flScore++;
          g.teamScores[p.team]++;
        }
        // Collision if player x overlaps pipe x range AND y is outside gap
        if (px + FL_PLAYER_R > pipe.x && px - FL_PLAYER_R < pipe.x + FL_PIPE_W) {
          const gapTop = pipe.gapY - FL_PIPE_GAP / 2;
          const gapBot = pipe.gapY + FL_PIPE_GAP / 2;
          if (p.flY - FL_PLAYER_R < gapTop || p.flY + FL_PLAYER_R > gapBot) {
            p.flAlive = false;
            p.flDeathReason = 'pipe';
            io.to(pid).emit('fl:died', { reason: 'pipe', score: p.flScore });
            sendReviveQuestion(g, pid);
            break;
          }
        }
      }

      updates[pid] = { y: Math.round(p.flY), s: p.flScore, a: 1 };
    });

    // Broadcast everyone's positions + scores + pipes-relative-to-each-player
    // For efficiency: send pipes only to each individual player (they're per-player)
    Object.entries(g.players).forEach(([pid, p]) => {
      io.to(pid).emit('fl:tick', {
        me: {
          y: Math.round(p.flY),
          alive: p.flAlive,
          score: p.flScore
        },
        pipes: p.flPipes.map((pp) => ({ x: Math.round(pp.x), g: Math.round(pp.gapY) })),
        teamScores: g.teamScores,
        // Compact summary of all players (for leaderboard on host + teammate flags)
        all: updates
      });
    });
  });
}, FL_TICK_MS);

// Helper: send a revive question to a player who just died in Flappy
function sendReviveQuestion(g, pid) {
  const q = nextQuestionFor(g, pid);
  if (q) io.to(pid).emit('question', q);
}

// Every 500ms, broadcast a slim leaderboard payload to flappy games (for the host UI)
setInterval(() => {
  Object.entries(games).forEach(([pin, g]) => {
    if (g.gameType !== 'flappy' || g.state !== 'active') return;
    const players = {};
    Object.entries(g.players).forEach(([id, p]) => {
      players[id] = {
        name: p.name,
        team: p.team,
        y: Math.round(p.flY || 0),
        score: p.flScore || 0,
        alive: !!p.flAlive
      };
    });
    io.to(pin).emit('fl:scores', { teamScores: g.teamScores, players });
  });
}, 500);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n  Mochi Mash running on http://localhost:${PORT}\n`);
});
