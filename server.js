const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const Sets = require('./core/sets');
const Images = require('./core/images');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 5e6,
  // Detect dead clients faster — default is 25s/20s which is too forgiving for
  // classroom wifi. With these, a frozen client is reaped after ~20s and the
  // grace-period rejoin path kicks in cleanly instead of leaving phantom slots.
  pingInterval: 10000,
  pingTimeout: 20000,
  // Allow both transports; clients prefer websocket first but fall back to
  // polling on locked-down networks.
  transports: ['websocket', 'polling']
});

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

// Color Splash — bigger map + wide brush stroke (paints a cross pattern per step)
const CS_GRID_W = 30;
const CS_GRID_H = 18;
const CS_WALK_DURATION_MS = 5500;   // walk-window burst
const CS_MOVE_COOLDOWN_MS = 100;    // ~10 steps/sec — even across phones/tablets
const CS_WRONG_AUTO_PAINTS = 5;     // wrong answer = enemy splashes 5 cells

// Pickups — school items scattered on the rice paper
const CS_PICKUP_RADIUS = 1;         // grid cells of detection (adjacent or on)
const CS_PICKUP_BONUS_RADIUS = 1;   // 3x3 splat around the pickup
const CS_PICKUP_RESPAWN_MS = 15000; // 15-sec respawn
const CS_PICKUPS = [
  { id: 0,  x: 5,  y: 3,  icon: '📚' },
  { id: 1,  x: 15, y: 2,  icon: '📜' },
  { id: 2,  x: 25, y: 3,  icon: '🍎' },
  { id: 3,  x: 10, y: 8,  icon: '✏️' },
  { id: 4,  x: 20, y: 8,  icon: '🖌' },
  { id: 5,  x: 5,  y: 14, icon: '📕' },
  { id: 6,  x: 15, y: 15, icon: '📖' },
  { id: 7,  x: 25, y: 14, icon: '📒' },
  { id: 8,  x: 2,  y: 9,  icon: '🧧' },
  { id: 9,  x: 27, y: 9,  icon: '📃' }
];

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
const MQ_VENDOR_POINTS = 5;
const MQ_PICKUP_POINTS = 1;
const MQ_PICKUP_RADIUS = 50;
const MQ_PICKUP_RESPAWN_MS = 20000; // pickup reappears 20s after being grabbed

// Pickup positions — scattered food items on the market floor, between vendors.
// Walking over one = +1 team point + sound + sparkle. Respawns after 20s.
const MQ_PICKUPS = [
  { id: 0,  x: 400,  y: 110, icon: '🍊' },
  { id: 1,  x: 720,  y: 110, icon: '🍇' },
  { id: 2,  x: 1040, y: 110, icon: '🥭' },
  { id: 3,  x: 1300, y: 340, icon: '🍓' },
  { id: 4,  x: 1300, y: 580, icon: '🍍' },
  { id: 5,  x: 1040, y: 800, icon: '🍐' },
  { id: 6,  x: 720,  y: 800, icon: '🍒' },
  { id: 7,  x: 400,  y: 800, icon: '🥝' },
  { id: 8,  x: 160,  y: 580, icon: '🍋' },
  { id: 9,  x: 160,  y: 340, icon: '🌽' },
  { id: 10, x: 480,  y: 460, icon: '🥬' },
  { id: 11, x: 800,  y: 360, icon: '🌶' },
  { id: 12, x: 1120, y: 460, icon: '🥒' },
  { id: 13, x: 320,  y: 280, icon: '🍅' },
  { id: 14, x: 960,  y: 280, icon: '🥕' },
  { id: 15, x: 320,  y: 620, icon: '🍆' },
  { id: 16, x: 960,  y: 620, icon: '🥥' },
  { id: 17, x: 800,  y: 560, icon: '🍑' }
];

// Map Chinese vocab → matching emoji. Used so the collection toast shows
// the right icon (was using the vendor's static icon, which mismatched).
const VOCAB_EMOJI = {
  '苹果': '🍎', '水': '💧', '茶': '🍵', '米饭': '🍚', '菜': '🥬',
  '钱': '💰', '块': '💵', '吃': '🍽', '喝': '🥤', '买': '🛒',
  '商店': '🏪', '饭店': '🍱', '杯子': '🥛', '水果': '🍇',
  '东西': '📦', '多少': '🔢', '请': '🙏', '谢谢': '🙏',
  '不客气': '😊', '好': '👍', '想': '💭', '喜欢': '❤️'
};
// === Zombie Escape (末日逃生) constants ===
// Each team has a survivor sprinting toward the safe zone with a zombie wave
// closing in. Correct answer → 5s sprint window where every tap = step
// forward. Wrong answer → zombies gain ground on that team's survivor.
// Win = first survivor to reach the safe zone. Lose = zombies catch you.
const ZB_TRACK_LEN     = 200;   // total distance to safe zone
const ZB_SPRINT_MS     = 5000;  // sprint mode duration after correct answer
const ZB_ZOMBIE_GAIN   = 8;     // distance zombies advance on a wrong answer
const ZB_WRONG_SETBACK = 8;     // survivor steps back this many m on wrong answer
const ZB_ZOMBIE_START_BACK = 60; // how far behind the survivor zombies start
const ZB_HP_BCAST_MS   = 100;

// === Mi Familia (Family House Tycoon) constants ===
// Each team builds out a 4-room house: Sala / Cocina / Dormitorio / Jardín.
// Correct answer awards the player a random token (family member, pet, or
// furniture). They tap a room on their phone to place it. The host screen
// shows both team houses in real time, getting more decorated with each
// placement. Win = most items placed at time end (or first to fill all rooms).
const FM_ROOMS = ['sala', 'cocina', 'dormitorio', 'jardin'];
const FM_ROOM_LABELS = { sala: 'Sala', cocina: 'Cocina', dormitorio: 'Dormitorio', jardin: 'Jardín' };
// Each token has an emoji + which rooms it makes sense in. Items can be
// placed in `any` room or restricted to specific rooms for realism.
const FM_TOKENS = [
  { id: 'dad',    emoji: '👨',    name: 'Papá',    rooms: ['sala', 'cocina', 'dormitorio'] },
  { id: 'mom',    emoji: '👩',    name: 'Mamá',    rooms: ['sala', 'cocina', 'dormitorio'] },
  { id: 'kid',    emoji: '🧒',    name: 'Hijo',    rooms: ['sala', 'dormitorio', 'jardin'] },
  { id: 'baby',   emoji: '👶',    name: 'Bebé',    rooms: ['sala', 'dormitorio'] },
  { id: 'gran',   emoji: '👵',    name: 'Abuela',  rooms: ['sala', 'cocina'] },
  { id: 'grandpa',emoji: '👴',    name: 'Abuelo',  rooms: ['sala', 'jardin'] },
  { id: 'dog',    emoji: '🐕',    name: 'Perro',   rooms: ['sala', 'jardin'] },
  { id: 'cat',    emoji: '🐱',    name: 'Gato',    rooms: ['sala', 'dormitorio', 'jardin'] },
  { id: 'fish',   emoji: '🐠',    name: 'Pez',     rooms: ['sala'] },
  { id: 'sofa',   emoji: '🛋',     name: 'Sofá',    rooms: ['sala'] },
  { id: 'tv',     emoji: '📺',    name: 'TV',      rooms: ['sala'] },
  { id: 'lamp',   emoji: '💡',    name: 'Lámpara', rooms: ['sala', 'dormitorio'] },
  { id: 'fridge', emoji: '🧊',    name: 'Nevera',  rooms: ['cocina'] },
  { id: 'stove',  emoji: '🍳',    name: 'Estufa',  rooms: ['cocina'] },
  { id: 'pot',    emoji: '🍲',    name: 'Olla',    rooms: ['cocina'] },
  { id: 'noodle', emoji: '🍜',    name: 'Fideos',  rooms: ['cocina'] },
  { id: 'tea',    emoji: '🍵',    name: 'Té',      rooms: ['cocina', 'sala'] },
  { id: 'bed',    emoji: '🛏',     name: 'Cama',    rooms: ['dormitorio'] },
  { id: 'book',   emoji: '📚',    name: 'Libros',  rooms: ['dormitorio', 'sala'] },
  { id: 'plant',  emoji: '🪴',    name: 'Planta',  rooms: ['jardin', 'sala'] },
  { id: 'flower', emoji: '🌸',    name: 'Flores',  rooms: ['jardin'] },
  { id: 'tree',   emoji: '🌳',    name: 'Árbol',   rooms: ['jardin'] },
  { id: 'bike',   emoji: '🚲',    name: 'Bici',    rooms: ['jardin'] },
  { id: 'sun',    emoji: '☀️',    name: 'Sol',     rooms: ['jardin'] },
  { id: 'lantern',emoji: '🏮',    name: 'Farolillo', rooms: ['sala', 'jardin'] }
];
const FM_PLACE_WINDOW_MS = 8000; // player has 8s to drag

// === REINOS EN GUERRA · 战国 (Warring States) — territory conquest game ===
// A 6x4 grid of territories on a stylized map of ancient China. Two teams
// (Red Dragon Cavalry vs Gold Dragon Cavalry) start in opposite corners
// and expand outward. Each correct vocab answer captures one adjacent tile;
// preference order: enemy-held → unclaimed → grow from the team's own.
// Themed around HSK1 EXP5 travel/direction vocab (北京, 中国, 去, 来, 飞机,
// 出租车, 上, 下, 前面, 后面, etc).
//
// Territory data: id, place name (Chinese + pinyin + Spanish), x/y grid pos,
// icon. The board renders these in a 6x4 grid with adjacency (4-neighbor).
const CQ_COLS = 6;
const CQ_ROWS = 4;
const CQ_TERRITORIES = [
  // Row 0 (north) — towards Beijing / Great Wall
  { id: 0,  name: '北京',  pinyin: 'Běijīng',     es: 'Beijing',     icon: '🏯', isCapital: true,  capitalOf: 'red'  },
  { id: 1,  name: '长城',  pinyin: 'Chángchéng',  es: 'Gran Muralla',icon: '🧱' },
  { id: 2,  name: '哈尔滨',pinyin: 'Hā\'ěrbīn',   es: 'Harbin',      icon: '❄️' },
  { id: 3,  name: '草原',  pinyin: 'Cǎoyuán',     es: 'Estepa',      icon: '🌾' },
  { id: 4,  name: '沙漠',  pinyin: 'Shāmò',       es: 'Desierto',    icon: '🏜' },
  { id: 5,  name: '蒙古',  pinyin: 'Měnggǔ',      es: 'Mongolia',    icon: '⛺' },
  // Row 1
  { id: 6,  name: '西安',  pinyin: 'Xī\'ān',      es: 'Xi\'an',      icon: '🕌' },
  { id: 7,  name: '黄河',  pinyin: 'Huánghé',     es: 'Río Amarillo',icon: '🌊' },
  { id: 8,  name: '少林',  pinyin: 'Shàolín',     es: 'Templo Shaolin', icon: '⛩' },
  { id: 9,  name: '泰山',  pinyin: 'Tàishān',     es: 'Monte Tai',   icon: '⛰' },
  { id: 10, name: '青岛',  pinyin: 'Qīngdǎo',     es: 'Qingdao',     icon: '🏝' },
  { id: 11, name: '森林',  pinyin: 'Sēnlín',      es: 'Bosque',      icon: '🌲' },
  // Row 2
  { id: 12, name: '成都',  pinyin: 'Chéngdū',     es: 'Chengdu',     icon: '🐼' },
  { id: 13, name: '长江',  pinyin: 'Chángjiāng',  es: 'Río Yangtsé', icon: '🚣' },
  { id: 14, name: '洛阳',  pinyin: 'Luòyáng',     es: 'Luoyang',     icon: '🪷' },
  { id: 15, name: '武当',  pinyin: 'Wǔdāng',      es: 'Monte Wudang',icon: '🗡' },
  { id: 16, name: '上海',  pinyin: 'Shànghǎi',    es: 'Shanghái',    icon: '🌃' },
  { id: 17, name: '钱塘',  pinyin: 'Qiántáng',    es: 'Qiantang',    icon: '🌉' },
  // Row 3 (south) — towards Guangzhou
  { id: 18, name: '云南',  pinyin: 'Yúnnán',      es: 'Yunnan',      icon: '🌺' },
  { id: 19, name: '桂林',  pinyin: 'Guìlín',      es: 'Guilin',      icon: '🗿' },
  { id: 20, name: '香港',  pinyin: 'Xiānggǎng',   es: 'Hong Kong',   icon: '🌆' },
  { id: 21, name: '台湾',  pinyin: 'Táiwān',      es: 'Taiwán',      icon: '🏖' },
  { id: 22, name: '海南',  pinyin: 'Hǎinán',      es: 'Hainan',      icon: '🌴' },
  { id: 23, name: '广州',  pinyin: 'Guǎngzhōu',   es: 'Guangzhou',   icon: '🏮', isCapital: true, capitalOf: 'gold' },
];
// Position each territory in the grid (row * COLS + col convention)
CQ_TERRITORIES.forEach((t, i) => {
  t.x = i % CQ_COLS;
  t.y = Math.floor(i / CQ_COLS);
});

// 4-neighbor adjacency for the grid (up/down/left/right). Returns ids.
function cqAdjacent(tileId) {
  const t = CQ_TERRITORIES[tileId];
  if (!t) return [];
  const adj = [];
  CQ_TERRITORIES.forEach((other) => {
    if (other.id === tileId) return;
    const dx = Math.abs(other.x - t.x);
    const dy = Math.abs(other.y - t.y);
    if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) adj.push(other.id);
  });
  return adj;
}

// Pick the best capture target for `team` on a correct answer.
// Priority:
//   1. An ENEMY tile adjacent to any of our tiles (= conquer enemy ground)
//   2. An UNCLAIMED tile adjacent to ours (= expand outward)
//   3. An unclaimed tile adjacent to any tile (= jump start if isolated)
//   4. Our own capital (no-op but keeps the score moving)
// Returns { tileId, action } where action is 'conquered'|'expanded'|'jumped'|'reinforce'
function cqPickTarget(g, team) {
  const ownTiles = [];
  const enemyTeam = team === 'red' ? 'gold' : 'red';
  CQ_TERRITORIES.forEach((t) => {
    if (g.conquest.ownership[t.id] === team) ownTiles.push(t.id);
  });
  // Priority 1 + 2: scan neighbors of our tiles
  const candidatesEnemy = new Set();
  const candidatesEmpty = new Set();
  ownTiles.forEach((tid) => {
    cqAdjacent(tid).forEach((nid) => {
      const owner = g.conquest.ownership[nid];
      if (owner === enemyTeam) candidatesEnemy.add(nid);
      else if (!owner) candidatesEmpty.add(nid);
    });
  });
  if (candidatesEnemy.size > 0) {
    return { tileId: pickRandom([...candidatesEnemy]), action: 'conquered' };
  }
  if (candidatesEmpty.size > 0) {
    return { tileId: pickRandom([...candidatesEmpty]), action: 'expanded' };
  }
  // Priority 3: any unclaimed tile in the world (rare — we got blocked in)
  const anyEmpty = CQ_TERRITORIES.filter((t) => !g.conquest.ownership[t.id]).map((t) => t.id);
  if (anyEmpty.length) {
    return { tileId: pickRandom(anyEmpty), action: 'jumped' };
  }
  // Priority 4: reinforce our capital (visual "stack" — no actual change)
  const cap = CQ_TERRITORIES.find((t) => t.capitalOf === team);
  return { tileId: cap ? cap.id : (ownTiles[0] || 0), action: 'reinforce' };
}
function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Score a team — 1 point per owned tile, +5 bonus per capital owned
function cqTeamScore(g, team) {
  let s = 0;
  CQ_TERRITORIES.forEach((t) => {
    if (g.conquest.ownership[t.id] === team) {
      s += 1;
      if (t.isCapital) s += 5;
    }
  });
  return s;
}

// Apply a capture: mark ownership + update scores. Returns the captureInfo
// for broadcast: { tileId, fromTeam, toTeam, action, isCapital, capturedCapital }
function cqApplyCapture(g, team, target) {
  const t = CQ_TERRITORIES[target.tileId];
  if (!t) return null;
  const fromTeam = g.conquest.ownership[t.id] || null;
  // If reinforcing our own land, return a no-op event
  if (target.action === 'reinforce') {
    return { tileId: t.id, fromTeam: team, toTeam: team, action: 'reinforce', isCapital: !!t.isCapital };
  }
  g.conquest.ownership[t.id] = team;
  g.conquest.capturedCount = (g.conquest.capturedCount || 0) + 1;
  const capturedEnemyCapital = (target.action === 'conquered' && t.isCapital && t.capitalOf !== team);
  return {
    tileId: t.id,
    fromTeam,
    toTeam: team,
    action: target.action,
    isCapital: !!t.isCapital,
    capturedEnemyCapital,
  };
}

// === Combos === Each combo defines a condition over a team's house and a
// bonus to award when first met. Combos only trigger ONCE per house (tracked
// via team.combosAchieved set). The check runs after every placement.
const FM_COMBOS = [
  {
    id: 'pareja',
    name: '¡Pareja! 💞',
    emoji: '💞',
    bonus: 5,
    test: (h) => h.sala.some(i=>i.id==='dad') && h.sala.some(i=>i.id==='mom')
  },
  {
    id: 'familia',
    name: '¡Familia completa! 👨‍👩‍👧',
    emoji: '👨‍👩‍👧',
    bonus: 10,
    test: (h) => {
      const all = [...h.sala, ...h.cocina, ...h.dormitorio, ...h.jardin];
      const ids = new Set(all.map(i=>i.id));
      return ids.has('dad') && ids.has('mom') && (ids.has('kid')||ids.has('baby'));
    }
  },
  {
    id: 'abuelos',
    name: '¡Abuelos! 👴👵',
    emoji: '👴',
    bonus: 6,
    test: (h) => {
      const all = [...h.sala, ...h.cocina, ...h.dormitorio, ...h.jardin];
      const ids = new Set(all.map(i=>i.id));
      return ids.has('gran') && ids.has('grandpa');
    }
  },
  {
    id: 'mascotas',
    name: '¡Mascotas! 🐕🐱',
    emoji: '🐕',
    bonus: 5,
    test: (h) => {
      const all = [...h.sala, ...h.cocina, ...h.dormitorio, ...h.jardin];
      const ids = new Set(all.map(i=>i.id));
      return ids.has('dog') && ids.has('cat');
    }
  },
  {
    id: 'cena',
    name: '¡Cena familiar! 🍳🍲',
    emoji: '🍲',
    bonus: 6,
    test: (h) => {
      const ids = new Set(h.cocina.map(i=>i.id));
      return ids.has('stove') && ids.has('pot');
    }
  },
  {
    id: 'jardin-bonito',
    name: '¡Jardín bonito! 🌳🌸',
    emoji: '🌸',
    bonus: 5,
    test: (h) => {
      const ids = new Set(h.jardin.map(i=>i.id));
      return ids.has('tree') && ids.has('flower');
    }
  },
  {
    id: 'sala-cozy',
    name: '¡Sala acogedora! 🛋📺',
    emoji: '🛋',
    bonus: 5,
    test: (h) => {
      const ids = new Set(h.sala.map(i=>i.id));
      return ids.has('sofa') && ids.has('tv');
    }
  },
  {
    id: 'dormitorio-listo',
    name: '¡Dormitorio listo! 🛏📚',
    emoji: '🛏',
    bonus: 5,
    test: (h) => {
      const ids = new Set(h.dormitorio.map(i=>i.id));
      return ids.has('bed') && ids.has('book');
    }
  },
  {
    id: 'sala-llena',
    name: '¡Sala llena! +5 objetos',
    emoji: '🏡',
    bonus: 8,
    test: (h) => h.sala.length >= 5
  },
  {
    id: 'cocina-llena',
    name: '¡Cocina llena!',
    emoji: '🍳',
    bonus: 8,
    test: (h) => h.cocina.length >= 5
  },
  {
    id: 'jardin-lleno',
    name: '¡Jardín exuberante!',
    emoji: '🌳',
    bonus: 8,
    test: (h) => h.jardin.length >= 5
  },
  {
    id: 'casa-completa',
    name: '🏆 ¡CASA COMPLETA! ',
    emoji: '🏆',
    bonus: 25,
    test: (h) => h.sala.length>=3 && h.cocina.length>=3 && h.dormitorio.length>=3 && h.jardin.length>=3
  }
];

function fmCheckCombos(g, team) {
  const house = g.family[team];
  if (!house._combos) house._combos = new Set();
  const newCombos = [];
  for (const c of FM_COMBOS) {
    if (house._combos.has(c.id)) continue;
    if (c.test(house)) {
      house._combos.add(c.id);
      newCombos.push(c);
      g.teamScores[team] = (g.teamScores[team] || 0) + c.bonus;
    }
  }
  return newCombos;
}

function fmPickToken() {
  return FM_TOKENS[Math.floor(Math.random() * FM_TOKENS.length)];
}

// Apply a placement: token goes into the requested room (or first valid room
// if the requested one doesn't fit), updates team score, broadcasts to room,
// queues the next question for the player.
function fmPlace(pin, pid, requestedRoom) {
  const g = games[pin];
  if (!g || g.gameType !== 'family' || g.state !== 'active') return;
  const p = g.players[pid];
  if (!p || !p.fmToken) return;
  const t = p.fmToken;
  // Validate room — if invalid for this token, use the first valid room
  const room = (FM_ROOMS.includes(requestedRoom) && t.rooms.includes(requestedRoom))
    ? requestedRoom
    : t.rooms[0];
  p.fmToken = null;
  if (!g.family[p.team]) {
    g.family[p.team] = { sala: [], cocina: [], dormitorio: [], jardin: [] };
  }
  g.family[p.team][room].push({ id: t.id, emoji: t.emoji, by: p.name, t: Date.now() });
  p.score = (p.score || 0) + 1;
  g.teamScores[p.team] = (g.teamScores[p.team] || 0) + 1;
  // Check for new combos unlocked by THIS placement
  const newCombos = fmCheckCombos(g, p.team);
  io.to(pin).emit('fm:placed', {
    team: p.team,
    room,
    token: { id: t.id, emoji: t.emoji, name: t.name },
    teamScores: g.teamScores,
    combos: newCombos.map(c => ({ id: c.id, name: c.name, emoji: c.emoji, bonus: c.bonus }))
  });
  io.to(pid).emit('fm:place-confirmed', {
    room,
    token: t,
    combos: newCombos.map(c => ({ id: c.id, name: c.name, emoji: c.emoji, bonus: c.bonus })),
    teamScore: g.teamScores[p.team]
  });
  // Snappy cadence — fire next question quickly so kids never wait
  setTimeout(() => {
    if (!games[pin] || games[pin].state !== 'active') return;
    const q = nextQuestionFor(g, pid);
    if (q) io.to(pid).emit('question', q);
  }, newCombos.length > 0 ? 1800 : 900);
}

// === Vuelo del Dragón (Dragon Flight) constants ===
// Each team has its OWN dragon. Players answer vocab → unlock 5 s of flap-mode.
// Every tap during flap-mode is one wing-beat that lifts the team's dragon
// higher. As altitude crosses milestones the host reveals new scenery layers
// (rooftops → bamboo → mountains → clouds → heavens). First dragon to reach
// the top wins.
const DR_ALT_MAX     = 500;   // altitude needed to reach the heavens + win
const DR_MASH_MS     = 5000;  // 5 s flap window after a correct answer
const DR_ALT_BCAST_MS = 100;  // throttle altitude broadcasts to ~10 Hz

// === 中国大富翁 · Chinese Trivia Monopoly ===
// 16-tile perimeter board. Each correct vocab answer rolls a 1d6 and advances
// the player's dragon token by that many tiles. Tiles trigger auto-buy / rent /
// bonuses on landing. Pass over START → +¥200. Team wealth (sum of player
// cash + property values) drives the win condition.
const MP_TILES = [
  { id: 0,  type: 'start',    name: 'Salida',      icon: '🏯', side: 'top'    },
  { id: 1,  type: 'city',     name: 'Shànghǎi',    icon: '🏙', side: 'top',    cost: 80,  rent: 20 },
  { id: 2,  type: 'card',     name: 'Carta',       icon: '🎴', side: 'top',    bonus: 40 },
  { id: 3,  type: 'city',     name: 'Guǎngzhōu',   icon: '🛕', side: 'top',    cost: 80,  rent: 20 },
  { id: 4,  type: 'treasure', name: 'Tesoro',      icon: '🐉', side: 'right',  bonus: 100 },
  { id: 5,  type: 'city',     name: 'Xī’ān',  icon: '🕌', side: 'right',  cost: 100, rent: 25 },
  { id: 6,  type: 'card',     name: 'Carta',       icon: '🎴', side: 'right',  bonus: 40 },
  { id: 7,  type: 'city',     name: 'Hángzhōu',    icon: '🌸', side: 'right',  cost: 120, rent: 30 },
  { id: 8,  type: 'festival', name: '¡Fiesta!',    icon: '🏮', side: 'bottom' },
  { id: 9,  type: 'city',     name: 'Chángchéng',  icon: '🧱', side: 'bottom', cost: 140, rent: 35 },
  { id: 10, type: 'tax',      name: 'Impuesto',    icon: '💰', side: 'bottom', penalty: 50 },
  { id: 11, type: 'city',     name: 'Yíhéyuán',    icon: '⛲', side: 'bottom', cost: 160, rent: 40 },
  { id: 12, type: 'jail',     name: 'Cárcel',      icon: '🏛', side: 'left'   },
  { id: 13, type: 'city',     name: 'Gùgōng',      icon: '🏯', side: 'left',   cost: 180, rent: 45 },
  { id: 14, type: 'treasure', name: 'Tesoro',      icon: '🐉', side: 'left',   bonus: 100 },
  { id: 15, type: 'city',     name: 'Tiān’ānmén', icon: '🏛', side: 'left', cost: 200, rent: 50 }
];
const MP_BOARD_SIZE     = MP_TILES.length;
const MP_START_MONEY    = 200;
// Player character slots — 6 distinct Kenney toon characters with names
const MP_CHAR_COUNT     = 6;
const MP_CHAR_NAMES = [
  'Mei 🛡️',       // 0 — Female adventurer
  'Liáng 🛡️',     // 1 — Male adventurer
  'Sara 👩',       // 2 — Female person
  'Daniel 👨',     // 3 — Male person
  'Robot-Bao 🤖',  // 4 — Robot
  'Zombi 🧟'       // 5 — Zombie
];
const MP_PASS_BONUS     = 200;     // each time you cross START
const MP_INSTANT_WIN    = 2000;    // a team hitting this total wealth wins instantly
const MP_FESTIVAL_BONUS = 150;
const MP_DICE_MIN       = 1;
const MP_DICE_MAX       = 6;

// === Piñata Tigre constants ===
// Each TEAM has its own tiger piñata on the host screen. Players play it like
// Mochi Mash: answer a vocab question right → unlocks a short "smash mode"
// where every tap = swing of their stick = 1 damage to their team's tiger.
// First tiger to reach 0 HP loses (their opponents broke the most piñata).
const PN_TIGER_HP   = 220;   // each tiger's HP — tuned so a ~3 min match breaks one
const PN_MASH_MS    = 5000;  // smash-mode duration after correct answer
const PN_HP_BCAST_MS = 100;  // throttle HP broadcasts to ~10 Hz

function emojiForChinese(chinese) {
  if (!chinese) return null;
  // Try whole word match first, then first char
  if (VOCAB_EMOJI[chinese]) return VOCAB_EMOJI[chinese];
  for (const key of Object.keys(VOCAB_EMOJI)) {
    if (chinese.includes(key)) return VOCAB_EMOJI[key];
  }
  return null;
}

function genPin() {
  // Prefer short 3-digit PINs (100-999) so kids can type them in 1 second.
  // If we ever have so many active games that 3-digit space is exhausted
  // (~50+ collisions in a row), fall back to a 4-digit PIN (1000-9999).
  let pin;
  for (let tries = 0; tries < 50; tries++) {
    pin = String(Math.floor(100 + Math.random() * 900));
    if (!games[pin]) return pin;
  }
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
        { name: p.name, team: p.team, score: p.score, avatar: p.avatar || '' }
      ])
    ),
    feed: game.feed.slice(-12)
  };
}

// Throttled broadcast — coalesces rapid-fire calls (avatar swap, swap-team,
// join/rejoin churn) into at most one 'state' emit per 120ms per game.
// This is the cheapest lag win: instead of pushing 5-10 state events per
// second during busy moments, we push max ~8/s — clients still feel realtime
// but use 5x less bandwidth + render budget.
const BROADCAST_THROTTLE_MS = 120;
function broadcast(pin) {
  if (!games[pin]) return;
  const g = games[pin];
  const now = Date.now();
  // Always send if more than threshold has passed
  if (!g._lastBcast || now - g._lastBcast >= BROADCAST_THROTTLE_MS) {
    g._lastBcast = now;
    if (g._pendingBcast) { clearTimeout(g._pendingBcast); g._pendingBcast = null; }
    io.to(pin).emit('state', publicState(g));
    return;
  }
  // Coalesce: schedule a single trailing-edge broadcast so the latest state
  // gets through even if the burst keeps firing.
  if (g._pendingBcast) return;
  const wait = BROADCAST_THROTTLE_MS - (now - g._lastBcast);
  g._pendingBcast = setTimeout(() => {
    g._pendingBcast = null;
    if (!games[pin]) return;
    games[pin]._lastBcast = Date.now();
    io.to(pin).emit('state', publicState(games[pin]));
  }, Math.max(20, wait));
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

// === Chinese Monopoly turn resolver ===
// The player rolls their own dice on their phone — server is just the ref.
// If a `roll` is provided (player's tap-stopped value), it's used; otherwise
// the server rolls (safety fallback). Server clamps to 1..6.
function resolveMonopolyTurn(g, pid, playerRoll) {
  const p = g.players[pid];
  if (!p) return null;
  if (!g.monopoly) return null;
  // Skipped this turn? (landed on Jail last time)
  if (p.mpSkip) {
    p.mpSkip = false;
    return { skipped: true, roll: 0, fromPos: p.mpPos, toPos: p.mpPos,
             money: p.mpMoney, action: 'skipped' };
  }
  let roll = Number(playerRoll);
  if (!roll || roll < MP_DICE_MIN || roll > MP_DICE_MAX) {
    roll = MP_DICE_MIN + Math.floor(Math.random() * (MP_DICE_MAX - MP_DICE_MIN + 1));
  }
  const fromPos = p.mpPos || 0;
  const newPos = (fromPos + roll) % MP_BOARD_SIZE;
  // Pass-over-START bonus (if we wrap around, we passed start)
  if (fromPos + roll >= MP_BOARD_SIZE) {
    p.mpMoney = (p.mpMoney || 0) + MP_PASS_BONUS;
  }
  p.mpPos = newPos;
  const tile = MP_TILES[newPos];
  const result = {
    skipped: false,
    roll,
    fromPos,
    toPos: newPos,
    tile: { id: tile.id, type: tile.type, name: tile.name, icon: tile.icon },
    action: 'landed',
    moneyDelta: 0,
    rentTo: null,
    bought: false,
    money: 0
  };
  switch (tile.type) {
    case 'start':
      // Landing exactly on START → extra +¥200 (in addition to pass bonus)
      p.mpMoney += MP_PASS_BONUS;
      result.moneyDelta = MP_PASS_BONUS;
      result.action = 'start-bonus';
      break;
    case 'city': {
      const owner = g.monopoly.ownership[tile.id];
      if (!owner) {
        // Auto-buy if player has enough cash
        if (p.mpMoney >= tile.cost) {
          p.mpMoney -= tile.cost;
          g.monopoly.ownership[tile.id] = p.team;
          result.bought = true;
          result.action = 'bought';
          result.moneyDelta = -tile.cost;
        } else {
          result.action = 'cant-afford';
        }
      } else if (owner === p.team) {
        result.action = 'own-city';
      } else {
        // Pay rent to the enemy team — split equally among that team's players
        const enemyTeam = owner;
        const rentDue = Math.min(p.mpMoney, tile.rent);
        p.mpMoney -= rentDue;
        // Distribute rent among the enemy team's players (so it's MP team wealth)
        const enemies = Object.values(g.players).filter((q) => q.team === enemyTeam);
        if (enemies.length) {
          const each = Math.floor(rentDue / enemies.length) || 0;
          const remainder = rentDue - each * enemies.length;
          enemies.forEach((q, i) => { q.mpMoney = (q.mpMoney || 0) + each + (i === 0 ? remainder : 0); });
        }
        result.action = 'paid-rent';
        result.moneyDelta = -rentDue;
        result.rentTo = enemyTeam;
        result.rentAmount = rentDue;
      }
      break;
    }
    case 'card':
      p.mpMoney += (tile.bonus || 40);
      result.moneyDelta = tile.bonus || 40;
      result.action = 'card-bonus';
      break;
    case 'treasure':
      p.mpMoney += (tile.bonus || 100);
      result.moneyDelta = tile.bonus || 100;
      result.action = 'treasure';
      break;
    case 'tax': {
      const pen = Math.min(p.mpMoney, tile.penalty || 50);
      p.mpMoney -= pen;
      result.moneyDelta = -pen;
      result.action = 'tax';
      break;
    }
    case 'festival':
      p.mpMoney += MP_FESTIVAL_BONUS;
      result.moneyDelta = MP_FESTIVAL_BONUS;
      result.action = 'festival';
      break;
    case 'jail':
      p.mpSkip = true;
      result.action = 'jail';
      break;
  }
  // Personal score reflects player's individual progress (cash earned)
  p.score = (p.score || 0) + Math.max(0, result.moneyDelta) + (result.bought ? tile.cost : 0);
  result.money = p.mpMoney;
  return result;
}

// Once the player commits their tap-stopped dice roll (or the safety timer
// fires), this resolves the turn, broadcasts the move, and queues the next
// question for the player.
function processMonopolyRoll(pin, pid, playerRoll) {
  const g = games[pin];
  if (!g || g.gameType !== 'monopoly' || g.state !== 'active') return;
  const p = g.players[pid];
  if (!p || !p.mpAwaitingRoll) return;
  p.mpAwaitingRoll = false;
  const turn = resolveMonopolyTurn(g, pid, playerRoll);
  g.teamScores = {
    red:  monopolyTeamWealth(g, 'red'),
    gold: monopolyTeamWealth(g, 'gold')
  };
  // Tell the player their turn outcome
  io.to(pid).emit('mp:result', {
    ...turn,
    money: p.mpMoney
  });
  // Broadcast for host board animation
  io.to(pin).emit('mp:move', {
    playerId: pid,
    playerName: p.name,
    team: p.team,
    char: p.mpChar,
    ...turn,
    ownership: g.monopoly.ownership,
    teamScores: g.teamScores,
    // Also send player's running wealth for the live leaderboard on the host
    playerWealth: p.mpMoney
  });
  // Tycoon milestone — celebrate the team hitting MP_INSTANT_WIN, but
  // RESPECT THE TIMER. Per teacher feedback, games (except piñata + zombie)
  // should run for the full duration the host set. Fire the tycoon banner
  // once per team per match so the celebration still happens.
  const w = (g.teamScores.red >= MP_INSTANT_WIN) ? 'red'
          : (g.teamScores.gold >= MP_INSTANT_WIN) ? 'gold' : null;
  if (w && !g.monopoly.tycoonAnnounced) {
    g.monopoly.tycoonAnnounced = w;
    io.to(pin).emit('mp:tycoon', { team: w, teamScores: g.teamScores });
    // No setTimeout/endGame — the round continues until the duration expires.
  }
  // Queue next question after the worst-case client animation budget:
  // 6 walk-steps × 360ms + camera-hold 1.7s + tile reaction overlay 1.9s
  // = ~5800ms. We use 6500ms as a safety ceiling so the player never gets
  // kicked off the walk/celebration mid-animation. The client also emits
  // a "monopoly:ready" signal — whichever arrives first wins.
  if (g.mpQuestionTimers && g.mpQuestionTimers[pid]) {
    clearTimeout(g.mpQuestionTimers[pid]);
  }
  if (!g.mpQuestionTimers) g.mpQuestionTimers = {};
  const sendNext = () => {
    if (g.mpQuestionTimers) delete g.mpQuestionTimers[pid];
    if (!games[pin] || games[pin].state !== 'active') return;
    if (!g.players[pid]) return;
    // Don't double-send if a question was already pushed via the ready signal
    if (g.players[pid]._mpQuestionSent) {
      g.players[pid]._mpQuestionSent = false;
      return;
    }
    g.players[pid]._mpQuestionSent = true;
    const q = nextQuestionFor(g, pid);
    if (q) io.to(pid).emit('question', q);
  };
  g.mpQuestionTimers[pid] = setTimeout(() => {
    g.players[pid] && (g.players[pid]._mpQuestionSent = false);
    sendNext();
  }, 6500);
  // Stash the resolver so the client's `monopoly:ready` event can call it.
  if (!g.mpQuestionResolvers) g.mpQuestionResolvers = {};
  g.mpQuestionResolvers[pid] = sendNext;
}

// Sum total team wealth: cash + value of owned cities.
function monopolyTeamWealth(g, team) {
  let total = 0;
  Object.values(g.players).forEach((p) => {
    if (p.team === team) total += (p.mpMoney || 0);
  });
  MP_TILES.forEach((t) => {
    if (t.type !== 'city') return;
    if (g.monopoly && g.monopoly.ownership[t.id] === team) total += t.cost;
  });
  return total;
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
    leaderboard: sorted.map((p) => ({ name: p.name, score: p.score, team: p.team, avatar: p.avatar || '' }))
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
    const validTypes = ['mochi-mash', 'color-splash', 'color-clash', 'market-quest', 'flappy', 'pinata', 'dragon-eye', 'monopoly', 'zombie', 'family', 'conquest'];
    const type = validTypes.includes(opts.gameType) ? opts.gameType : 'mochi-mash';
    const defaultDuration =
      type === 'flappy'       ? 120 :
      type === 'market-quest' ? 240 :
      type === 'color-clash'  ? 180 :
      type === 'color-splash' ? 90 :
      type === 'pinata'       ? 240 :
      type === 'dragon-eye'   ? 240 :
      type === 'monopoly'     ? 300 :
      type === 'zombie'       ? 240 :
      type === 'family'       ? 300 :
      type === 'conquest'     ? 300 :
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
        // Color Splash: initialize school pickups
        if (g.gameType === 'color-splash') {
          g.pickups = CS_PICKUPS.map((pk) => ({ ...pk, available: true, respawnAt: 0 }));
        }
        const playersInit = {};
        Object.entries(g.players).forEach(([id, p]) => {
          playersInit[id] = { name: p.name, team: p.team, x: p.x, y: p.y };
        });
        io.to(pin).emit('cs:init', {
          gridW: w,
          gridH: h,
          players: playersInit,
          teamScores: g.teamScores,
          pickups: g.pickups || null
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

      // Market Quest: assign vendor → vocab mapping, reset pickups, send init
      if (g.gameType === 'market-quest') {
        const vocabIdxs = g.questions.map((_, i) => i).sort(() => Math.random() - 0.5);
        g.vendors = MQ_VENDORS.map((v, i) => ({
          ...v,
          claimedBy: null,
          vocabIdx: vocabIdxs[i % vocabIdxs.length]
        }));
        // Initialize fresh pickups (all available)
        g.pickups = MQ_PICKUPS.map((pk) => ({ ...pk, available: true, respawnAt: 0 }));
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
          pickups: g.pickups,
          players: Object.fromEntries(
            Object.entries(g.players).map(([id, p]) => [id, {
              name: p.name, team: p.team, x: p.x, y: p.y, dir: p.dir
            }])
          ),
          teamScores: g.teamScores
        });
      }
      // Chinese Monopoly: reset board + each player gets a fresh start + character
      if (g.gameType === 'monopoly') {
        g.monopoly = { ownership: {} };
        // Assign each player a character (0..MP_CHAR_COUNT-1) by join order
        const pids = Object.keys(g.players);
        pids.forEach((pid, idx) => {
          const p = g.players[pid];
          p.mpPos = 0;
          p.mpMoney = MP_START_MONEY;
          p.mpSkip = false;
          p.mpChar = idx % MP_CHAR_COUNT;
        });
        io.to(pin).emit('mp:init', {
          tiles: MP_TILES,
          startMoney: MP_START_MONEY,
          instantWin: MP_INSTANT_WIN,
          charCount: MP_CHAR_COUNT,
          charNames: MP_CHAR_NAMES,
          players: Object.fromEntries(
            Object.entries(g.players).map(([id, p]) => [id, {
              name: p.name, team: p.team, pos: 0, money: MP_START_MONEY,
              char: p.mpChar, charName: MP_CHAR_NAMES[p.mpChar]
            }])
          ),
          teamScores: g.teamScores
        });
        // Tell each player privately which character is theirs + show welcome
        pids.forEach((pid) => {
          const charIdx = g.players[pid].mpChar;
          io.to(pid).emit('mp:my-char', {
            charIdx,
            charName: MP_CHAR_NAMES[charIdx],
            welcome: true
          });
        });
      }

      // Vuelo del Dragón: TWO dragons, one per team. Players answer vocab to
      // unlock flap windows; each tap raises their dragon's altitude. First to
      // DR_ALT_MAX reaches the heavens and wins.
      if (g.gameType === 'dragon-eye') {
        g.dragon = {
          altRed: 0,
          altGold: 0,
          maxAlt: DR_ALT_MAX,
          winner: null
        };
        io.to(pin).emit('dragon:init', {
          maxAlt: DR_ALT_MAX,
          players: Object.fromEntries(
            Object.entries(g.players).map(([id, p]) => [id, { name: p.name, team: p.team }])
          ),
          teamScores: g.teamScores
        });
      }

      // Piñata Tigre: two tigers (one per team), each with HP. Players answer
      // questions like Mochi Mash — correct answer unlocks a 5s smash window
      // where every tap deals 1 damage to THEIR team's tiger.
      if (g.gameType === 'pinata') {
        g.pinata = {
          hpRed: PN_TIGER_HP,
          hpGold: PN_TIGER_HP,
          maxHp: PN_TIGER_HP,
          brokenTeam: null
        };
        io.to(pin).emit('pn:init', {
          hpRed: g.pinata.hpRed,
          hpGold: g.pinata.hpGold,
          maxHp: g.pinata.maxHp,
          players: Object.fromEntries(
            Object.entries(g.players).map(([id, p]) => [id, { name: p.name, team: p.team }])
          ),
          teamScores: g.teamScores
        });
      }
      // Zombie Escape: each team has a survivor at distance 0 with zombies
      // chasing at distance -60. Track length 200. First to 200 wins; if the
      // zombies catch the survivor (distance == survivor), that team loses.
      if (g.gameType === 'family') {
        // Initialize an empty 4-room house per team
        g.family = {
          red:  { sala: [], cocina: [], dormitorio: [], jardin: [] },
          gold: { sala: [], cocina: [], dormitorio: [], jardin: [] }
        };
        // Each player can have one pending token at a time
        Object.values(g.players).forEach((p) => { p.fmToken = null; });
        io.to(pin).emit('fm:init', {
          rooms: FM_ROOMS,
          roomLabels: FM_ROOM_LABELS,
          tokens: FM_TOKENS,
          players: Object.fromEntries(
            Object.entries(g.players).map(([id, p]) => [id, { name: p.name, team: p.team, avatar: p.avatar }])
          ),
          teamScores: g.teamScores
        });
      }
      if (g.gameType === 'conquest') {
        // Each team owns its capital from the start; everywhere else is wilderness.
        const ownership = {};
        CQ_TERRITORIES.forEach((t) => {
          if (t.capitalOf) ownership[t.id] = t.capitalOf;
        });
        g.conquest = {
          ownership,
          capturedCount: 0,
          battleLog: [],
        };
        g.teamScores = { red: cqTeamScore(g, 'red'), gold: cqTeamScore(g, 'gold') };
        io.to(pin).emit('cq:init', {
          territories: CQ_TERRITORIES,
          ownership,
          cols: CQ_COLS, rows: CQ_ROWS,
          players: Object.fromEntries(
            Object.entries(g.players).map(([id, p]) => [id, { name: p.name, team: p.team, avatar: p.avatar }])
          ),
          teamScores: g.teamScores,
        });
      }
      if (g.gameType === 'zombie') {
        g.zombie = {
          survRed:   0,
          survGold:  0,
          zombRed:  -ZB_ZOMBIE_START_BACK,
          zombGold: -ZB_ZOMBIE_START_BACK,
          trackLen: ZB_TRACK_LEN,
          finishedTeam: null
        };
        io.to(pin).emit('zb:init', {
          trackLen: ZB_TRACK_LEN,
          players: Object.fromEntries(
            Object.entries(g.players).map(([id, p]) => [id, { name: p.name, team: p.team, avatar: p.avatar }])
          ),
          teamScores: g.teamScores
        });
      }
      broadcast(pin);
      // Mochi Mash + Color Splash + Piñata auto-deal first question.
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

  socket.on('player:join', ({ pin, name, avatar }, cb) => {
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
      // Refresh avatar on rejoin so kids can change it across rounds
      if (avatar && typeof avatar === 'string') player.avatar = String(avatar).slice(0, 8);
      g.feed.push({ type: 'rejoin', name: cleanName, team: player.team, t: Date.now() });
    } else {
      // New player — pick smaller team, spawn position for color splash
      const team = pickTeam(g);
      player = {
        name: cleanName,
        team,
        avatar: (avatar && typeof avatar === 'string') ? String(avatar).slice(0, 8) : '',
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
          pickups: g.pickups,
          players: Object.fromEntries(
            Object.entries(g.players).map(([id, pl]) => [id, {
              name: pl.name, team: pl.team, x: pl.x, y: pl.y, dir: pl.dir || 'down'
            }])
          ),
          teamScores: g.teamScores
        });
      }
      // Monopoly: send the board state + assign/restore character
      if (g.gameType === 'monopoly' && g.monopoly) {
        // If this player slot has no character yet (truly new mid-game joiner),
        // assign one based on the current player count.
        if (typeof player.mpChar !== 'number') {
          player.mpChar = (Object.keys(g.players).length - 1) % MP_CHAR_COUNT;
          player.mpPos = 0;
          player.mpMoney = MP_START_MONEY;
          player.mpSkip = false;
        }
        io.to(socket.id).emit('mp:init', {
          tiles: MP_TILES,
          startMoney: MP_START_MONEY,
          instantWin: MP_INSTANT_WIN,
          charCount: MP_CHAR_COUNT,
          charNames: MP_CHAR_NAMES,
          players: Object.fromEntries(
            Object.entries(g.players).map(([id, pl]) => [id, {
              name: pl.name, team: pl.team, pos: pl.mpPos || 0,
              money: pl.mpMoney || 0, char: pl.mpChar,
              charName: MP_CHAR_NAMES[pl.mpChar]
            }])
          ),
          teamScores: g.teamScores,
          ownership: g.monopoly.ownership
        });
        io.to(socket.id).emit('mp:my-char', {
          charIdx: player.mpChar,
          charName: MP_CHAR_NAMES[player.mpChar],
          welcome: !isRejoin    // brand-new joiner gets welcome modal; rejoin doesn't
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
          teamScores: g.teamScores,
          pickups: g.pickups || null
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
  // Cross-pattern brush stroke: paint center + 4 cardinal neighbors (up to 5 cells)
  function csPaintCross(g, cx, cy, team) {
    const painted = [];
    [[0,0],[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy]) => {
      const x = cx + dx, y = cy + dy;
      if (csPaintCell(g, x, y, team)) painted.push({ x, y, team });
    });
    return painted;
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

  socket.on('player:answer', ({ pin, qid, choiceIdx }, ack) => {
    // Immediate ack so the client knows the server received the tap. If transport
    // is flaky, the client uses this to decide whether to retry the emit.
    if (typeof ack === 'function') ack({ ok: true });
    const g = games[pin];
    if (!g || g.state !== 'active') return;
    const p = g.players[socket.id];
    if (!p) return;
    // If the player has no open question at all → tell the client so they can recover
    // (otherwise their answer buttons stay disabled forever — the "frozen" bug).
    if (!p.currentQ) {
      io.to(socket.id).emit('answer-stale', { reason: 'no-question' });
      return;
    }
    // Tolerant qid matching: a brief reconnect or socket churn can leave the
    // client holding an older qid than the server's freshly-assigned one. We
    // accept the answer using the SERVER's currentQ.qid as ground truth as
    // long as a question exists. (qid is informational, not security.)
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
      // Extract Chinese characters + pinyin from the question text for the toast
      let itemChinese = '';
      let itemHanzi = '';
      const m = cqData.text.match(/([一-鿿]+)\s*\(([^)]+)\)/);
      if (m) {
        itemHanzi = m[1];
        itemChinese = `${m[1]} (${m[2]})`;
      }
      // Use vocab-specific emoji if we can find one, else fall back to vendor's icon
      const matchedEmoji = emojiForChinese(itemHanzi);
      const itemIcon = matchedEmoji || (vendor ? vendor.icon : '🛍');

      if (correct && vendor && !vendor.claimedBy) {
        vendor.claimedBy = p.team;
        p.score = (p.score || 0) + MQ_VENDOR_POINTS;
        g.teamScores[p.team] = (g.teamScores[p.team] || 0) + MQ_VENDOR_POINTS;
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
          playerScore: p.score,
          itemIcon,
          itemChinese,
          pointsAwarded: MQ_VENDOR_POINTS
        });
      } else if (correct) {
        io.to(socket.id).emit('answer-result', { correct: true, vendorId, correctText, itemIcon, itemChinese });
      } else {
        if (!p.vendorCooldowns) p.vendorCooldowns = {};
        p.vendorCooldowns[vendorId] = Date.now() + 8000;
        io.to(socket.id).emit('answer-result', { correct: false, vendorId, correctText, itemIcon, itemChinese });
      }
      // All vendors claimed — celebrate the milestone BUT respect the
      // duration the host set. Resetting all vendors lets the round keep
      // generating new claim opportunities (each respawns with a fresh
      // cooldown), so the gameplay loop continues until the timer expires.
      if (g.vendors.every((v) => v.claimedBy) && !g.mqRoundCompleted) {
        g.mqRoundCompleted = true;
        // Optional: announce the achievement without ending the round
        io.to(pin).emit('mq:all-claimed', { teamScores: g.teamScores });
      }
      broadcast(pin);
      return; // don't run other game branches
    }

    if (g.gameType === 'color-splash') {
      // Color Splash: correct → walk window, wrong → enemy gets free random paints
      if (correct) {
        p.walkUntil = Date.now() + CS_WALK_DURATION_MS;
        // Paint a starting cross around the player's position
        const painted = csPaintCross(g, p.x, p.y, p.team);
        p.score += painted.length;
        io.to(socket.id).emit('answer-result', {
          correct: true,
          walkUntil: p.walkUntil,
          correctText
        });
        if (painted.length) {
          io.to(pin).emit('cs:paint', { cells: painted, teamScores: g.teamScores });
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
    } else if (g.gameType === 'dragon-eye') {
      // Vuelo del Dragón: correct → 5s flap window. Wrong = nothing (no penalty).
      if (correct && g.dragon && !g.dragon.winner) {
        p.mashUntil = Date.now() + DR_MASH_MS;
        io.to(socket.id).emit('answer-result', {
          correct: true,
          mashUntil: p.mashUntil,
          correctText
        });
      } else {
        io.to(socket.id).emit('answer-result', { correct: false, correctText });
      }
    } else if (g.gameType === 'monopoly') {
      // Correct answer = you earn the RIGHT TO ROLL THE DICE. The player taps
      // a stop-the-spinner mini-game on their phone; whatever number they land
      // on is sent via 'monopoly:roll' (see handler below). We mark the player
      // as "awaiting roll" so the next-question timer doesn't fire too early.
      if (correct && g.monopoly) {
        p.mpAwaitingRoll = true;
        io.to(socket.id).emit('answer-result', {
          correct: true,
          correctText,
          monopoly: { needsRoll: true, money: p.mpMoney }
        });
        // Safety net: if the player never taps stop within 8s, server auto-rolls.
        setTimeout(() => {
          if (!games[pin] || games[pin].state !== 'active') return;
          const pNow = games[pin].players[socket.id];
          if (!pNow || !pNow.mpAwaitingRoll) return;
          processMonopolyRoll(pin, socket.id, null);
        }, 8000);
      } else {
        io.to(socket.id).emit('answer-result', { correct: false, correctText });
      }
    } else if (g.gameType === 'pinata') {
      if (correct) {
        p.mashUntil = Date.now() + PN_MASH_MS;
        io.to(socket.id).emit('answer-result', {
          correct: true, mashUntil: p.mashUntil, correctText
        });
      } else {
        io.to(socket.id).emit('answer-result', { correct: false, correctText });
      }
    } else if (g.gameType === 'conquest') {
      // Reinos en Guerra — correct answer captures one tile for the player's
      // team. Wrong answer = no capture, next question normally. The server
      // picks the target (smart adjacency-aware) so kids stay in the language-
      // learning loop and don't have to fiddle with tile selection.
      if (correct) {
        const team = p.team;
        const target = cqPickTarget(g, team);
        const captureInfo = cqApplyCapture(g, team, target);
        g.teamScores = { red: cqTeamScore(g, 'red'), gold: cqTeamScore(g, 'gold') };
        p.score = (p.score || 0) + 1;
        io.to(socket.id).emit('answer-result', {
          correct: true,
          correctText,
          conquest: {
            tile: CQ_TERRITORIES[captureInfo.tileId],
            action: captureInfo.action,
            fromTeam: captureInfo.fromTeam,
            toTeam: captureInfo.toTeam,
            capturedEnemyCapital: !!captureInfo.capturedEnemyCapital,
          },
        });
        io.to(pin).emit('cq:capture', {
          ...captureInfo,
          playerName: p.name,
          teamScores: g.teamScores,
        });
        // Tycoon-style celebration if a capital fell — but respect the timer
        if (captureInfo.capturedEnemyCapital) {
          io.to(pin).emit('cq:capital-fallen', { team, teamScores: g.teamScores });
        }
      } else {
        io.to(socket.id).emit('answer-result', { correct: false, correctText });
      }
    } else if (g.gameType === 'family') {
      // Mi Familia: correct → award a random token; the player will tap a room
      // on their phone to place it. Wrong → no reward, next question normally.
      if (correct) {
        const token = fmPickToken();
        p.fmToken = token;
        p.fmTokenAt = Date.now();
        io.to(socket.id).emit('answer-result', {
          correct: true,
          correctText,
          familyToken: token
        });
        // Safety: if the player never places within the window, auto-place in
        // the first valid room so the game keeps moving
        setTimeout(() => {
          if (!games[pin] || games[pin].state !== 'active') return;
          const pNow = games[pin].players[socket.id];
          if (!pNow || !pNow.fmToken) return;
          const t = pNow.fmToken;
          fmPlace(pin, socket.id, t.rooms[0]);
        }, FM_PLACE_WINDOW_MS + 300);
      } else {
        io.to(socket.id).emit('answer-result', { correct: false, correctText });
      }
    } else if (g.gameType === 'zombie') {
      // Zombie Escape: correct → sprint window. Wrong → SURVIVOR steps back
      // (jump-back penalty) but the game never auto-ends from a wrong answer.
      // This avoids the "I got kicked for one wrong answer" feeling.
      if (correct && g.zombie && !g.zombie.finishedTeam) {
        p.mashUntil = Date.now() + ZB_SPRINT_MS;
        io.to(socket.id).emit('answer-result', {
          correct: true, mashUntil: p.mashUntil, correctText
        });
      } else if (!correct && g.zombie && !g.zombie.finishedTeam) {
        const sKey = p.team === 'red' ? 'survRed' : 'survGold';
        const zKey = p.team === 'red' ? 'zombRed' : 'zombGold';
        // Survivor stumbles back; never below 0
        g.zombie[sKey] = Math.max(0, g.zombie[sKey] - ZB_WRONG_SETBACK);
        // Zombies creep a little closer (visual threat, not a kill condition)
        g.zombie[zKey] = Math.min(g.zombie[sKey] - 10, g.zombie[zKey] + 4);
        io.to(pin).emit('zb:state', {
          survRed:  g.zombie.survRed,
          survGold: g.zombie.survGold,
          zombRed:  g.zombie.zombRed,
          zombGold: g.zombie.zombGold,
          trackLen: g.zombie.trackLen
        });
        io.to(socket.id).emit('answer-result', {
          correct: false, correctText, zombieSetback: ZB_WRONG_SETBACK
        });
      } else {
        io.to(socket.id).emit('answer-result', { correct: false, correctText });
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
    } else if (g.gameType === 'pinata') {
      nextDelay = correct ? PN_MASH_MS + 600 : 1400;
    } else if (g.gameType === 'dragon-eye') {
      nextDelay = correct ? DR_MASH_MS + 600 : 1400;
    } else if (g.gameType === 'monopoly') {
      nextDelay = correct ? -1 : 1500;
    } else if (g.gameType === 'zombie') {
      nextDelay = correct ? ZB_SPRINT_MS + 600 : 1400;
    } else if (g.gameType === 'family') {
      // Correct → wait for placement; placement handler queues next question.
      nextDelay = correct ? -1 : 1500;
    } else if (g.gameType === 'conquest') {
      // Brief celebration window so the capture animation has time to play
      nextDelay = correct ? 1800 : 1400;
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
  // Avatar swap — kids can change their avatar in the lobby without rejoining.
  socket.on('player:set-avatar', ({ pin, avatar }) => {
    const g = games[pin];
    if (!g) return;
    const p = g.players[socket.id];
    if (!p) return;
    if (typeof avatar !== 'string') return;
    p.avatar = String(avatar).slice(0, 8);
    broadcast(pin);
  });

  // === Player stuck-recovery resync ===
  // Client watchdog pings this when nothing has happened on its end for 12s.
  // Server replies with the player's current state + re-emits the current
  // question if one is open + pushes a NEW question if the player is idle
  // (no mash window, no walk window, no pending dice roll, etc).
  // This is the last-resort safety net that gets stuck players unstuck.
  socket.on('player:resync', ({ pin }) => {
    const g = games[pin];
    if (!g) return;
    const p = g.players[socket.id];
    if (!p) return;
    const now = Date.now();
    const inAction =
      (p.mashUntil && p.mashUntil > now) ||
      (p.walkUntil && p.walkUntil > now) ||
      !!p.currentQ ||
      !!p.mpAwaitingRoll ||
      !!p.dragonAim;
    io.to(socket.id).emit('state-resync', {
      state: g.state,
      gameType: g.gameType,
      hasOpenQuestion: !!p.currentQ,
      mashUntil:      p.mashUntil || 0,
      walkUntil:      p.walkUntil || 0,
      energy:         p.energy    || 0,
      score:          p.score     || 0,
      mpAwaitingRoll: !!p.mpAwaitingRoll,
      inAction
    });
    // Re-emit the active question so the client can re-render the screen
    if (p.currentQ && g.state === 'active') {
      io.to(socket.id).emit('question', {
        qid: p.currentQ.qid,
        text: p.currentQ.text,
        answers: p.currentQ.answers,
        image: p.currentQ.image,
        vendorId: p.currentQ.vendorId
      });
      return;
    }
    // If the player is genuinely idle and the game is running, push them a
    // fresh question to get them moving again. Skip for games that drive
    // their own question dispatch (market-quest uses vendor collisions,
    // flappy uses death-revives, color-clash uses request buttons).
    if (g.state === 'active' && !inAction) {
      const driveYourOwn = ['market-quest', 'flappy', 'color-clash'];
      if (!driveYourOwn.includes(g.gameType)) {
        const q = nextQuestionFor(g, socket.id);
        if (q) io.to(socket.id).emit('question', q);
      }
    }
  });

  // Mi Familia: player tapped a room to place their awarded token.
  socket.on('family:place', ({ pin, room }) => {
    fmPlace(pin, socket.id, room);
  });

  // Chinese Monopoly: player committed their tap-stopped dice value (1..6).
  socket.on('monopoly:roll', ({ pin, roll }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'monopoly' || g.state !== 'active') return;
    processMonopolyRoll(pin, socket.id, roll);
  });

  // Client signals: walk + tile-reaction overlay done, push my next question.
  // Lets the next question fire AS SOON AS the player is ready, instead of
  // waiting for the 6.5s safety ceiling — keeps the round snappy when the
  // player rolled a low number (short walk).
  socket.on('monopoly:ready', ({ pin }) => {
    const g = games[pin];
    if (!g || g.gameType !== 'monopoly' || g.state !== 'active') return;
    const resolver = g.mpQuestionResolvers && g.mpQuestionResolvers[socket.id];
    if (typeof resolver === 'function') {
      // Cancel the safety timer — we're firing the question via this signal
      if (g.mpQuestionTimers && g.mpQuestionTimers[socket.id]) {
        clearTimeout(g.mpQuestionTimers[socket.id]);
        delete g.mpQuestionTimers[socket.id];
      }
      delete g.mpQuestionResolvers[socket.id];
      // Reset the "sent" flag so resolver actually sends
      if (g.players[socket.id]) g.players[socket.id]._mpQuestionSent = false;
      resolver();
    }
  });

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
    // Wide brush: paint center + 4 neighbors
    const paintedCells = csPaintCross(g, nx, ny, p.team);
    p.score += paintedCells.length;
    io.to(pin).emit('cs:move', {
      playerId: socket.id,
      x: nx, y: ny,
      paint: paintedCells.length ? paintedCells : null,
      teamScores: g.teamScores
    });

    // Pickup collision check — within radius of any available pickup
    if (g.pickups) {
      const nowMs = Date.now();
      for (const pickup of g.pickups) {
        if (!pickup.available) continue;
        if (Math.abs(p.x - pickup.x) > CS_PICKUP_RADIUS) continue;
        if (Math.abs(p.y - pickup.y) > CS_PICKUP_RADIUS) continue;
        // Grab!
        pickup.available = false;
        pickup.respawnAt = nowMs + CS_PICKUP_RESPAWN_MS;
        // 3x3 paint splat around the pickup
        const bonus = [];
        for (let by = pickup.y - CS_PICKUP_BONUS_RADIUS; by <= pickup.y + CS_PICKUP_BONUS_RADIUS; by++) {
          for (let bx = pickup.x - CS_PICKUP_BONUS_RADIUS; bx <= pickup.x + CS_PICKUP_BONUS_RADIUS; bx++) {
            if (csPaintCell(g, bx, by, p.team)) bonus.push({ x: bx, y: by, team: p.team });
          }
        }
        p.score += bonus.length;
        io.to(pin).emit('cs:pickup-grabbed', {
          id: pickup.id,
          icon: pickup.icon,
          x: pickup.x, y: pickup.y,
          team: p.team,
          playerName: p.name,
          bonusCells: bonus,
          teamScores: g.teamScores
        });
        break; // grab one per step
      }
    }
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

    // === Zombie Escape: each tap sprints this player's TEAM survivor forward ===
    if (g.gameType === 'zombie' && g.zombie && !g.zombie.finishedTeam) {
      const sKey = p.team === 'red' ? 'survRed' : 'survGold';
      g.zombie[sKey] = Math.min(g.zombie.trackLen, g.zombie[sKey] + points);
      if (!g.lastZbBcast || now - g.lastZbBcast >= ZB_HP_BCAST_MS) {
        g.lastZbBcast = now;
        io.to(pin).emit('zb:state', {
          survRed:  g.zombie.survRed,
          survGold: g.zombie.survGold,
          zombRed:  g.zombie.zombRed,
          zombGold: g.zombie.zombGold,
          trackLen: g.zombie.trackLen
        });
      }
      // Win check — first survivor to reach the safe zone
      if (g.zombie[sKey] >= g.zombie.trackLen) {
        g.zombie.finishedTeam = p.team;
        io.to(pin).emit('zb:escaped', {
          team: p.team,
          survRed:  g.zombie.survRed,
          survGold: g.zombie.survGold,
          teamScores: g.teamScores
        });
        if (g.endTimer) clearTimeout(g.endTimer);
        setTimeout(() => endGame(pin), 3500);
      }
    }

    // === Vuelo del Dragón: each tap lifts this player's TEAM dragon ===
    if (g.gameType === 'dragon-eye' && g.dragon && !g.dragon.winner) {
      const altKey = p.team === 'red' ? 'altRed' : 'altGold';
      g.dragon[altKey] = Math.min(g.dragon.maxAlt, g.dragon[altKey] + points);
      // Throttled altitude broadcast
      if (!g.lastDrAltBcast || now - g.lastDrAltBcast >= DR_ALT_BCAST_MS) {
        g.lastDrAltBcast = now;
        io.to(pin).emit('dragon:alt', {
          altRed: g.dragon.altRed,
          altGold: g.dragon.altGold,
          maxAlt: g.dragon.maxAlt
        });
      }
      // Reaching the heavens — celebrate, but RESPECT the timer. The team
      // can keep playing (collecting more taps + points) until duration ends.
      // Once a team has hit the heavens, they cannot go higher (capped above)
      // but they can keep contributing to their score via the normal tap flow.
      if (g.dragon[altKey] >= g.dragon.maxAlt && !g.dragon.heavensAnnounced) {
        g.dragon.heavensAnnounced = p.team;
        io.to(pin).emit('dragon:reached-heavens', {
          team: p.team,
          altRed: g.dragon.altRed,
          altGold: g.dragon.altGold,
          teamScores: g.teamScores
        });
        // No endGame here — wait for the duration timer to fire.
      }
    }

    // === Piñata: each tap damages this player's TEAM tiger ===
    // teamScores already incremented above represents damage dealt by this team
    // (which equals damage taken by their own tiger). HP is the visual countdown.
    if (g.gameType === 'pinata' && g.pinata && !g.pinata.brokenTeam) {
      const hpKey = p.team === 'red' ? 'hpRed' : 'hpGold';
      g.pinata[hpKey] = Math.max(0, g.pinata[hpKey] - points);
      // Throttled HP broadcast — clients lerp between ticks
      if (!g.lastPnHpBcast || now - g.lastPnHpBcast >= PN_HP_BCAST_MS) {
        g.lastPnHpBcast = now;
        io.to(pin).emit('pn:hp', {
          hpRed:  g.pinata.hpRed,
          hpGold: g.pinata.hpGold,
          maxHp:  g.pinata.maxHp
        });
      }
      // Broken? End the round and award victory to the team that broke their own piñata.
      if (g.pinata[hpKey] <= 0) {
        g.pinata.brokenTeam = p.team;
        io.to(pin).emit('pn:broken', {
          team: p.team,
          hpRed: g.pinata.hpRed,
          hpGold: g.pinata.hpGold,
          teamScores: g.teamScores
        });
        if (g.endTimer) clearTimeout(g.endTimer);
        setTimeout(() => endGame(pin), 3500);
      }
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

      // Stale-question cleanup: if a player has had a question hanging for >10 seconds
      // without responding (e.g. lost it due to client race condition, network drop, etc.),
      // clear it so they can trigger fresh ones.
      if (p.currentQ && p.lastQuestionAt && now - p.lastQuestionAt > 10000) {
        p.currentQ = null;
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

      // Pickup collision — passive: stepping over a pickup grabs it (+1 team point)
      if (g.pickups) {
        for (const pickup of g.pickups) {
          if (!pickup.available) continue;
          const dx2 = p.x - pickup.x;
          const dy2 = p.y - pickup.y;
          if (dx2 * dx2 + dy2 * dy2 < MQ_PICKUP_RADIUS * MQ_PICKUP_RADIUS) {
            pickup.available = false;
            pickup.respawnAt = now + MQ_PICKUP_RESPAWN_MS;
            p.score = (p.score || 0) + MQ_PICKUP_POINTS;
            g.teamScores[p.team] = (g.teamScores[p.team] || 0) + MQ_PICKUP_POINTS;
            io.to(pin).emit('mq:pickup-grabbed', {
              id: pickup.id,
              icon: pickup.icon,
              team: p.team,
              teamScores: g.teamScores
            });
            io.to(pid).emit('mq:my-pickup', {
              icon: pickup.icon,
              playerScore: p.score
            });
          }
        }
      }
    });

    // Respawn pickups whose timer has elapsed
    if (g.pickups) {
      const now2 = Date.now();
      g.pickups.forEach((pickup) => {
        if (!pickup.available && pickup.respawnAt && now2 >= pickup.respawnAt) {
          pickup.available = true;
          io.to(pin).emit('mq:pickup-respawn', { id: pickup.id });
        }
      });
    }

    // Broadcast tick — compact deltas only.
    // To cut bandwidth and client CPU, we only include players whose position
    // or animation state actually changed since the last broadcast. Every 30
    // ticks (~1.5s at 20Hz) we send a full snapshot to keep late-joiners and
    // out-of-sync clients corrected.
    g._mqTickCount = (g._mqTickCount || 0) + 1;
    const isFullSync = (g._mqTickCount % 30) === 0;
    const positions = {};
    let changed = 0;
    Object.entries(g.players).forEach(([id, p]) => {
      const xr = Math.round(p.x);
      const yr = Math.round(p.y);
      const d  = p.dir || 'down';
      const m  = p.moving ? 1 : 0;
      const prev = p._lastBroadcast;
      const dirty = !prev || prev.x !== xr || prev.y !== yr || prev.d !== d || prev.m !== m;
      if (isFullSync || dirty) {
        positions[id] = { x: xr, y: yr, d, m };
        p._lastBroadcast = { x: xr, y: yr, d, m };
        changed++;
      }
    });
    // Skip empty deltas — nothing to say means no packet to send.
    if (isFullSync || changed > 0) {
      io.to(pin).emit('mq:tick', { p: positions, full: isFullSync ? 1 : 0 });
    }
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

// Color Splash pickup respawn loop — 1Hz is plenty for 15-sec respawns
setInterval(() => {
  const now = Date.now();
  Object.entries(games).forEach(([pin, g]) => {
    if (g.gameType !== 'color-splash' || g.state !== 'active') return;
    if (!g.pickups) return;
    g.pickups.forEach((pickup) => {
      if (!pickup.available && pickup.respawnAt && now >= pickup.respawnAt) {
        pickup.available = true;
        io.to(pin).emit('cs:pickup-respawn', { id: pickup.id });
      }
    });
  });
}, 1000);

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
