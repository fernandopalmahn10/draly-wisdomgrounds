# Reinos de Colores · build plan (new game mode)

Status: **BUILT 2026-10-10** (gameType `kingdoms`). Files: `core/kingdoms.js` (board rules), server.js `kd*` functions,
`public/host-kingdoms.html` + `js/host-kingdoms.js`, `js/kingdoms-board.js` (shared SVG board), `js/player-kingdoms.js`
(phone), `css/kingdoms.css`, `assets/kingdoms/` (Kenney grass/castle/sounds + small Dralingo). Bot playtest:
`node scripts/playtest-bots.js --game kingdoms --bots 30 --stall 11 --handlers scripts/playtest/kingdoms.js`.
Built differently from the plan below: no pause button (+30 s and end-now instead), castle-ring tiles can be stolen
(no protection rule), and no QR code in the lobby (the platform has no QR library yet).
Working name «Reinos de Colores» (he can rename). gameType: `kingdoms`.

## v2 · Dubai upgrade (2026-10-11, his ask: "super improve it, way more cool")
- **Landmarks** (`core/kingdoms.js` LANDMARKS): neutral tiles on the board's centre line (q = −r/2), so both castles are
  exactly as far from each one. Burj Khalifa in the centre (+5); the side spots get a shuffled pick of Burj Al Arab,
  Museo del Futuro, Marco de Dubái, Atlantis (+3 each): 5 landmarks on radius 5, 3 on radius 4. Score = tiles + siege
  bonus + landmarks held right now (they can be stolen back). The kid who takes one (plant or surround) also gets its
  bonus, but only for a flag they tapped themselves: an auto-plant gives the kingdom the landmark and the kid nothing
  extra, and auto-plant weighs a landmark like one flipped tile (code review 2026-10-11: waiting must never pay more
  than tapping). Event `{type:'landmark', tile, lm, from, team, by, bonus}` in `kd:plant`.
  With 30 kids landmarks flip 13–48 times a minute, so the projector's full-screen moment plays only for the first
  capture of each landmark (or after 25 s), at most one every 8 s, never under another effect; other flips get the
  board hop + a banner; a queued moment that is out of date is dropped. On the phone the landmark piece itself is the
  button while it can be taken (the Burj covers ~3 tiles).
  Pieces: `assets/kingdoms/landmarks/<key>.webp` (board, one common scale) + `landmarks/big/` (440 px, projector
  moment); one Higgsfield sheet keyed with `greenscreen_to_webp.py --protect --holes`. Sound `landmark.mp3` (Kenney
  steel-drum jingle).
- **Captains**: two of the gang (`KD_CAPTAINS` = cast ids) picked at host:start, sent as `kd:captains` right before
  `countdown` and again in `kd:init`. Projector: red | blue VS screen during the countdown, captain in each side panel,
  cameo with a battle line on a lead change (at most every 20 s), winning captain on the end screen. Phone: «Tu
  capitán/capitana» chip at the countdown. Lines in `js/cast.js` mood `battle` (Aileen in voseo).
- **Projector**: Dubai skyline backdrop; 3 pictured steps in the lobby (fits 1600×900); landmark moment (piece flies to
  the front, «+5», «¡El Mar le quita el Burj Khalifa al Fuego!»); big effects via DralingoFX, one at a time, ≥ 7 s apart
  (surround ≥ 5 → zoom, castle alert → cameo, siege → gang «¡ASEDIO!», 30 s left → spotlight); score in «puntos»;
  side panels show the landmarks each kingdom holds; end: champion Dralingo in the winner's colour + captain, landmarks
  won, MVP per kingdom, top 6, gang finale.
- **Phone**: red Dralingo for Fuego kids everywhere (TPOSE); lobby card «Así se juega» (3 pictured steps); the plant
  screen zooms onto the glowing tiles (bigger targets for small fingers, whole board when they spread out), a tapping
  hand on the first two plants, landmark targets get a pulsing ring; «¡Conquistaste el Burj Khalifa! +5» with the
  piece; end screen shows kingdom points and the kid's own points.

## Source: what we copy and beat
Kahoot «Color Kingdoms» demo, https://www.youtube.com/watch?v=6yTSdy4v0e8 (watched 2026-10-10):
- 0:00 mode card: team play, up to 200 players, duration picker (2 min recommended), questions repeat in a loop.
- 1:17 lobby: two castles on hills (blue flag / red flag), PIN + QR, Team Fire 🔴 vs Team Ocean 🔵, auto-balanced, game unlocked so late joiners enter.
- 3:29 countdown 3-2-1, then a big green hexagon board, one castle per team, timer top-right, team panels left/right.
- Loop: correct answer → you earn a **flag** → back to the board → **plant it on a hexagon touching your team's land**; the tile shows the kid's name for a moment.
- **Surround a zone → every tile inside becomes yours** (3:14).
- Tension: «1 minute remaining!», «30 seconds remaining!», «Team Ocean's castle is almost surrounded» (5:22); best player per team gets 👑 + tile count.
- 5:40 «Time's up!» → winner card «Winner with the largest empire!» 22 vs 14 tiles, confetti in the winner's color, Play again.

## Rules (ours)
- Board: hex grid, axial radius 5 (91 tiles); fewer tiles for small classes (radius 4 = 61 when < 8 players).
- Each team starts with its castle tile + the 6 tiles around it. Castles cannot be taken.
- Plant: only on a tile adjacent to your own land; empty tile → yours; enemy tile → yours too (steal), except the 6 tiles
  around an enemy castle while that castle still has at least 1 free neighbour (keeps comebacks possible).
- Surround: after each plant, flood-fill every region of non-team tiles; a region that touches neither the board edge nor
  an enemy castle flips to the planter's team (big «¡Rodeado!» animation, count of tiles flipped).
- Castle alert: when ≥ 4 of an enemy castle's 6 neighbours are yours → banner «¡El castillo azul está casi rodeado!».
  All 6 → «¡Asedio!» bonus +5 tiles-worth to the score and a celebration; castle stays.
- Score = tiles owned. Ties → team with more correct answers.
- Phone: correct → «🚩 ¡Ganaste una bandera!» → phone shows a mini board with the valid tiles glowing → tap to plant.
  No tap in 8 s → server auto-plants on the best tile (nobody stalls the class). Wrong → next question after 1.4 s.
- Streak: 3 correct in a row → «Bandera doble» (plant twice). Keep it the only power-up in v1.

## Beyond Kahoot (Dralingo touches)
- Dralingo (platform look: keffiyeh) as the announcer on the host screen: reacts to surrounds, castle alerts, lead changes.
- Animated celebrations from the character library (WebP/GIF overlays) on big moments; kid-safe, see root rules.
- Sounds: Kenney Music Jingles (fanfare on surround/win), Interface/Impact sounds on plant, a ticking last 10 s.
- Lead-change banner, «racha» combo counter, MVP per team on the end card, winner confetti in team color.
- Teacher controls always visible: pause, +30 s, end now (skip), mute; nothing can leave the teacher stuck.
- Words: only the set chosen for the class (level-safe). Spanish UI, pinyin for curriculum words, no hanzi in the kid UI.
- **His improvement list: still pending — he mentioned one but it never arrived. Add it here before building.**

## Assets (Kenney library on this PC, not in git: `C:\Users\ferpa\ClaudeCode\assets-library\kenney\Kenney Game Assets All-in-1 3.7.0\`)
- `2D assets/Hexagon Pack/PNG/Tiles/Terrain/Grass/*` (board), `.../Tiles/Medieval/medieval_largeCastle.png`,
  `.../Objects/castle_small.png`, `tower.png`; `Hexagon Buildings Pack`, `Hexagon Base Pack` for variety.
- `2D assets/Particle Pack/PNG (Transparent)` (sparkles, smoke on capture); `Audio/Music Jingles/*` (fanfares).
- Copy only the pieces used into `public/assets/kingdoms/` (short paths, no spaces) and commit them.

## Build recipe (use the `new-pin-game` skill; Reinos en Guerra's two-stage answer→order flow is a good model: it was retired 2026-10-10, read it with `git show 5e3743698:server.js` / `:public/js/host-conquest.js`)
1. server.js: add `'kingdoms'` to `validTypes` + duration default; init block on game start (board, castles, ownership,
   `kd:init`); answer branch = two-stage like conquest (`needsPlant` + valid tiles, `nextDelay = -1` on correct);
   `player:kd-plant` handler (validate pending flag + adjacency, apply plant, surround flood-fill, castle alerts, broadcast
   `kd:plant` / `kd:surround` / `kd:castle-alert`, queue next question after ~1.2 s); 8 s auto-plant timer; end → `kd:end`.
2. `public/host-kingdoms.html` + `public/js/host-kingdoms.js` + `public/css/kingdoms.css`: lobby (castles, PIN, QR, team
   lists), countdown, board (SVG or canvas hexes), panels with 👑, timer, banners, end card.
3. `public/js/player.js`: `kingdoms` branch → «bandera» screen + mini board tap; register in the gameType → order map (line ~404).
4. Register: `public/sets.html` (game list), `public/games.html` card, `public/js/maestro.js` games list.
5. Test locally (preview "dralingo", port 3000): host tab + 4 bot players via socket; unit-check the surround fill
   (enclosed region flips, edge-touching region does not, castle neighbourhood rule).
6. Update `docs/GAME_MODES.md` + `docs/HOW_CLAUDE_WORKS.md`; commit assets; deploy only when he says.
