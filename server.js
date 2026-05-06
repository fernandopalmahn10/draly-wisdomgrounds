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

function genPin() {
  let pin;
  do {
    pin = String(Math.floor(100000 + Math.random() * 900000));
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
    const type = opts.gameType === 'color-splash' ? 'color-splash' : 'mochi-mash';
    games[pin] = {
      gameType: type,
      hostId: socket.id,
      state: 'lobby',
      duration: type === 'color-splash' ? 90 : 60,
      startedAt: null,
      endsAt: null,
      questions: [],
      players: {},
      teamScores: { red: 0, gold: 0 },
      feed: [],
      // Color-splash specific:
      grid: type === 'color-splash'
        ? Array.from({ length: CS_GRID_H }, () => Array(CS_GRID_W).fill(null))
        : null
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
      // Reset color-splash grid
      if (g.gameType === 'color-splash') {
        g.grid = Array.from({ length: CS_GRID_H }, () => Array(CS_GRID_W).fill(null));
        // Re-spawn players (in case team swaps changed things)
        Object.values(g.players).forEach((p) => {
          const pos = csSpawnPosition(g, p.team);
          p.x = pos.x;
          p.y = pos.y;
        });
        // Send init payload to everyone
        const playersInit = {};
        Object.entries(g.players).forEach(([id, p]) => {
          playersInit[id] = { name: p.name, team: p.team, x: p.x, y: p.y };
        });
        io.to(pin).emit('cs:init', {
          gridW: CS_GRID_W,
          gridH: CS_GRID_H,
          players: playersInit,
          teamScores: g.teamScores
        });
      }
      broadcast(pin);
      Object.keys(g.players).forEach((pid) => {
        const q = nextQuestionFor(g, pid);
        if (q) io.to(pid).emit('question', q);
      });
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
    if (g.state !== 'lobby') return cb({ ok: false, error: 'Game already in progress' });
    const cleanName = String(name || '').trim().slice(0, 20);
    if (!cleanName) return cb({ ok: false, error: 'Please enter a name' });
    if (Object.values(g.players).some((p) => p.name.toLowerCase() === cleanName.toLowerCase()))
      return cb({ ok: false, error: 'Name already taken' });
    const team = pickTeam(g);
    const player = {
      name: cleanName,
      team,
      score: 0,
      queueIdx: 0,
      mashUntil: 0,
      lastTap: 0,
      recentTaps: [],
      currentQ: null,
      // color-splash:
      x: 0,
      y: 0,
      walkUntil: 0,
      lastMove: 0
    };
    if (g.gameType === 'color-splash') {
      const pos = csSpawnPosition(g, team);
      player.x = pos.x;
      player.y = pos.y;
    }
    g.players[socket.id] = player;
    currentPin = pin;
    role = 'player';
    socket.join(pin);
    g.feed.push({ type: 'join', name: cleanName, team, t: Date.now() });
    cb({
      ok: true,
      team,
      playerId: socket.id,
      gameType: g.gameType,
      gridW: CS_GRID_W,
      gridH: CS_GRID_H,
      x: player.x,
      y: player.y
    });
    broadcast(pin);
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

    const nextDelay = correct
      ? (g.gameType === 'color-splash' ? CS_WALK_DURATION_MS + 600 : MASH_DURATION_MS + 600)
      : 1400;
    setTimeout(() => {
      if (!games[pin] || games[pin].state !== 'active') return;
      const q = nextQuestionFor(g, socket.id);
      if (q) io.to(socket.id).emit('question', q);
    }, nextDelay);
    broadcast(pin);
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
    io.to(pin).emit('score-update', { teamScores: g.teamScores });
    if (combo && Math.random() < 0.15) {
      g.feed.push({ type: 'combo', name: p.name, team: p.team, t: now });
      broadcast(pin);
    }
  });

  socket.on('disconnect', () => {
    if (!currentPin || !games[currentPin]) return;
    const g = games[currentPin];
    if (role === 'host') {
      if (g.endTimer) clearTimeout(g.endTimer);
      io.to(currentPin).emit('host-left');
      delete games[currentPin];
    } else if (role === 'player') {
      const p = g.players[socket.id];
      if (p) {
        g.feed.push({ type: 'leave', name: p.name, t: Date.now() });
        delete g.players[socket.id];
        broadcast(currentPin);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n  Mochi Mash running on http://localhost:${PORT}\n`);
});
