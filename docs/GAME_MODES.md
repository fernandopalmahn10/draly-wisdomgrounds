# Modular Game-Mode Framework

Draly Wisdomgrounds now hosts a growing library of distinct mini-game modes,
all sharing the same PIN-based multiplayer architecture (host on a big
display, students on phones/tablets). Each mode is **fully self-contained**
with its own server state shape, socket events, host view, player screens,
CSS theme, and assets.

This document captures the pattern so a new mode can be added in a few
hundred lines without disturbing the others.

---

## File layout convention

For every new mode `<name>`:

```
server.js                                 ← register gameType + handlers
public/host-<name>.html                   ← host's lobby+active+win view
public/js/host-<name>.js                  ← host's socket wiring + render
public/css/<name>.css                     ← mode-specific theme
public/player.html                        ← adds a new <screen-<name>-X> block
public/js/player.js                       ← adds startXxx() + handlers
public/assets/<name>/                     ← PNG/SVG sprites for this mode
                                            (sub-folders allowed, e.g.
                                            /assets/family/items/dog.png)
public/games.html                         ← adds the game card
public/sets.html                          ← adds the GAME_INFO entry
```

The asset path is **always** `/public/assets/<mode-name>/...` so the
client and the server agree on URLs without hard-coding. Inside that
folder, sub-folders are free-form (`chars/`, `items/`, `bg/`, etc.).

---

## Server contract

In `server.js`:

1. **Register the type** in `validTypes` (the array passed to `host:create`).
2. **Add a defaultDuration** entry.
3. **Define constants** in a clearly-commented block near the top
   (`// === <Mode Name> constants ===`).
4. **Initialize game state** in the `host:start` setTimeout block — attach
   it as `g.<mode>` so it never collides with another mode's data.
5. **Handle answers** by adding an `else if (g.gameType === '<name>')`
   branch to the big `player:answer` chain. Emit `answer-result` plus any
   mode-specific reward fields (`familyToken`, `dragonAim`, `monopoly`,
   etc.) so the client can decide what screen to show next.
6. **Set `nextDelay`** in the post-answer block. Use `-1` if the mode
   drives its own follow-up (e.g., waits for a placement / dice roll).
7. **Add any mode-specific socket events** near the existing ones
   (`monopoly:roll`, `family:place`, `dragon:aim-place`, etc.).
8. **Define helpers** like `fmPlace`, `processMonopolyRoll`, etc. at
   module scope so the bulletproof stuck-recovery `player:resync` handler
   can also re-trigger them if needed.

State is just plain object properties — no class hierarchy or abstract
"GameMode" interface. The pattern keeps each mode readable in isolation.

---

## Client contract

In `public/js/player.js`:

1. Add the new screen name(s) to the `showScreen()` registry.
2. Add a branch in `updateTeamUI()` so the team label + mascot fit your
   mode's theme.
3. Add an `else if (gameType === '<name>')` branch in the `answer-result`
   handler — this is where you call `startXxx()` for your mode.
4. Define `startXxx()` near the other game-start functions. Keep all DOM
   handling defensive: guard with `if ($('foo'))` because the player may
   have joined late and missed a screen.

The watchdog (`player:resync`) handles all stuck-state recovery — your mode
doesn't need its own timeout logic.

---

## Host contract

`public/host-<name>.html` mirrors the existing template:

- `screen-lobby` with PIN display, set info, team panels, "How to play"
- `screen-countdown` with the universal countdown overlay
- `screen-active` with the **sticky-pin** tab + mode-specific stage
- `screen-win` with leaderboard + narration

`public/js/host-<name>.js` follows the existing pattern: socket bootstrap,
team chip rendering with avatars, animated countdown, mode-specific event
listeners, calm dragon mascot if you want one (use `fm-mascot` style — gentle
hover, no aggressive shake).

**No individual-player encouragement text** on the host screen. The big
display only shows team state and gameplay events. Praise/motivational
copy belongs on the player's phone.

---

## Status of the 8 announced modes

| # | Mode (Spanish) | Concept | Status |
|---|----------------|---------|--------|
| 1 | Mi Familia (Family House Tycoon) | Place items in rooms | ✅ Built (this commit) |
| 2 | La Escuela (Classroom Stationery Rush) | Falling objects, magnet basket | 📐 Designed, not built |
| 3 | El Mercado (Food Stall Tycoon) | Currency, recipe fulfillment | 📐 Designed, not built |
| 4 | ¿Qué Hora Es? (Clock Tower Weather Defense) | Time Shards vs weather | 📐 Designed, not built |
| 5 | Viajando por China (Cross-Country Vehicle Rally) | Fuel + map path | 📐 Designed, not built |
| 6 | Mi Casa (Spatial Sorting Blitz) | Drag-to-room categorization | 📐 Designed, not built |
| 7 | La Ciudad (City Emergency Grid Rescue) | Lane nav, bypass blockades | 📐 Designed, not built |
| 8 | Los Números (Magical Garden Harvest) | Number trees, grammar gates | 📐 Designed, not built |

Plus the previously shipped modes (Mochi Mash, Color Splash/Clash, Market
Quest, Flappy Dragon, Piñata Tigre, Vuelo del Dragón, Monopolio Dàfùwēng,
Zombie Escape) — total **9 modes live**, ready to grow to 17+.

Each remaining mode follows the same recipe above and can be slotted in
incrementally without disturbing the others.
