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
   (`player:mn-roll`, `player:pn-hit`, `dragon:aim-place`, etc.).
8. **Define helpers** like `mnRoll`, `pnApplyHit`, etc. at
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

**The teacher's clock (every game, since 2026-10-20):** «⏸ Pausa», «+30 s» AND «−30 s» side by side, «Terminar».
Both time buttons send `host:add-time { pin, seconds: ±30 }`; the server applies `core/party.js clockShift` (a cut stops
10 s before the end and never ends a round; it leaves the round's length alone, so the last 30 s start as if the clock
got there). A game whose room tick owns the clock gives its rules module `addTime(m, ms, now)` (returns the change that
applied, false for none) and answers `<prefix>:time { endsMs, frenzy, frenzyMs, add }` (`add` < 0 = «… segundos
menos» on every screen); the others use `g.endsAt` and the projector hears `host:time-cut` / `host:time-refused`. Games
that count rounds take rounds away instead (Las Trampillas «−2 rondas», Ojos de Halcón «−5 rondas»), never the round
being played nor the next one. Grey «−30 s» out where the server would refuse. Test: `scripts/test-clock-live.js`.

---

## Status (2026-10-11)

Live modes: **Las Trampillas** (`trapdoor`, built 2026-10-17 on a branch, not deployed: #2 of his Mario Party series, the
round platform whose pie slices drop like trapdoors (his video 4:43-5:41) — the whole class on one platform as their
full-body characters, Fuego vs Mar on red / blue rings, tap the floor to run there (the server moves everyone), pink
slices jump around during the 5…0 count and the ones lit at «0» open; a right answer = golden wings that save you once,
the fallen answer in the pit to come back; each round a kingdom scores its share still standing out of 10 (the Final
Round ×2); three arenas (El Palacio de Dubái, El Templo del Cielo, El Jardín de la Luna); the shared Mario Party
ending; rules `core/trapdoor.js` + the platform `js/trapdoor-arena.js`, phone `js/player-trapdoor.js`, projector
`host-trapdoor.html` + `js/host-trapdoor.js`, both draw `js/trapdoor-render.js` + `css/trapdoor.css`; spec
`docs/specs/las-trampillas.md`), **Ojos de Halcón** (`halcon`, built 2026-10-13 on a branch, not deployed: Super Mario Party «Looking for Love»
recreated board by board — the class is dealt into boards of 4, every kid plays as their full-body saga character on
their own board, +5/+3/+2/+1 by speed inside the board; spec `docs/specs/ojos-de-halcon.md`; it replaced the first
attempt «Ojo de Halcón» (`look`), retired and removed 2026-10-14 by his decision), **Reinos de Colores** (`kingdoms`, built 2026-10-10, Dubai upgrade 2026-10-11: landmarks, captains, zoom on
the phone; spec `docs/specs/reinos-de-colores.md`), **Dragones
Pintores** (`paint`, Gimkit Color Clash in Dralingo style, built 2026-10-11, spec `docs/specs/dragones-pintores.md`; remade 2026-10-17 as
«El Cielo de las Maravillas»: a new world each round — Dubái de noche, la Gran Muralla, el río Li, Shanghái — tap the sky
and the dragon flies there painting clouds, three landmark islands to capture; spec `docs/specs/dragones-pintores-v2.md`), **Batalla de Nieve en
Ski Dubái** (`snow`, Gimkit 2D-map infection game, built 2026-10-12 on a branch, not deployed yet, spec `docs/specs/batalla-de-nieve.md`), **La Gran Fuga de Dubái** (`escape`, Kahoot «Robot Run» co-op chase, built
2026-10-13, spec `docs/specs/gran-fuga-de-dubai.md`; remade 2026-10-17 as «Las rutas de la fuga»: a route of three real
places per round — Dubái or China — drawn as art for the run and the zona segura rooms, a live chase strip on every
phone, pacing from the clock; spec `docs/specs/gran-fuga-v2.md`; these four got the Mario Party ending on
2026-10-16, branch `ending-pass`: «¡FINAL!», a reveal, winners vs the others, bonus stars, the projector's podium and each
phone's card, all from one shared ceremony `js/party.js` + `css/party.css` + `core/party.js`, plus the last 30 s doubled
(Banderas dobles · Fuego doble · Copos dobles · Súper turbos) and live news between questions; «As built · 2026-10-16» in
each spec), **Mochi Mash** (`mochi-mash`, remade
2026-10-14 on a branch, not deployed: «La Terraza del Mochi», Fuego vs Mar feed their Dragoncitos in a mash zone, landmark
race, comeback golden mochis, Mario Party ceremony with bonus stars; rules `core/mochi.js`, phone `js/player-mochi.js`,
projector `host.html` + `js/host-mochi.js`, shared `js/mochi-stage.js` + `css/mochi.css`; spec `docs/specs/mochi-mash-v2.md`),
**Piñata Tigre** (`pinata`, remade 2026-10-15 on a branch, not deployed: «La Fiesta de las Piñatas», Fuego vs Mar break a
ladder of tiger piñatas under Dubai landmarks; every right answer = a hit with a server-judged timing meter (critical in
the gold), bursts with candy jackpots, landmark race, comeback wide golden zone, Mario Party ceremony with bonus stars;
rules `core/pinata.js`, phone `js/player-pinata.js`, projector `host-pinata.html` + `js/host-pinata.js`, shared
`js/pinata-stage.js` + `css/pinata.css` (+ `js/mochi-stage.js` / `css/mochi.css` for the kid figures); spec
`docs/specs/pinata-tigre-v2.md`), **6-7 Swing** (`sixseven`, remade 2026-10-15 on a branch, not deployed: «La Balanza de
Oro», rapid-fire sums whose answer is always 6 or 7 (numbers 1-10, + / −; digits, pinyin words without tone marks, or both,
the teacher's pick), two giant buttons «6 · liu» / «7 · qi», Fuego vs Mar fill a golden balance on Dubai Creek; server-judged
with a too-fast rule, a streak multiplier and wrong-answer waits so random tapping loses to thinking; Dralingo's «6-7» art,
landmark race, comeback golden sums, Mario Party ceremony with bonus stars; second pass 2026-10-16 «no dead phones»: the
tap reacts at once, a little world on the phone where my coins and my teammates' fly into our pan between sums, «¡SIX
SEVEN!» moments during play (racha 7, the 67th coin, team waves at 67 gold); since 2026-10-20 Dralingo's friends **Liu** (the
6) and **Qi** (the 7), blue brick-built number buddies, live on the two buttons, at Dralingo's feet on the projector, in the
lobby, the intro and the ceremony, and join into **el 67** on every «¡SIX SEVEN!»; rules `core/sixseven.js` (no question pack),
phone `js/player-sixseven.js`, projector `host-sixseven.html` + `js/host-sixseven.js`, shared `js/sixseven-stage.js` +
`css/sixseven.css` (+ `js/mochi-stage.js` / `css/mochi.css` for the kid figures); spec `docs/specs/six-seven-v2.md`),
**Vuelo del Dragón** (`dragon-eye`, remade 2026-10-16 on a branch, not deployed: «La Carrera del Cielo de Dubái», a Mario Party sky race in races of 4 dealt like Ojos de Halcón; every right answer is a flight where each swipe up (or tap) is a wing beat of the kid's own dragoncito, the kid's full-body character standing on it; one score = metres; the server caps the beats a second and judges every metre; golden rings, a tailwind for the last dragon (capped at the gap), a 12 s star sprint every 40 s at the next landmark, lead alarms, «¡Alas dobles!» + fireworks in the last 30 s, three bonus stars per race, each race's winner, the class podium; rules `core/dragon.js` + the course `js/dragon-course.js`, phone `js/player-dragon.js`, projector `host-dragon.html` + `js/host-dragon.js`, both draw `js/dragon-sky.js` + `css/dragon.css`; spec `docs/specs/dragon-v2.md`), **Dàfùwēng · Monopolio** (`monopoly`, remade 2026-10-16 on a
branch, not deployed: «El Gran Tablero de Dubái», a Mario Party board night in boards of 4 dealt like Ojos de Halcón; every
right answer opens a dice window (the server rolls; no tap in 3 s = the same dice), the kid's full-body piece walks a
24-space Dubai loop on its own phone (the board is the screen, the question a sheet under it): Salida, the star (10 coins,
Dralingo), blue / red, 5 landmarks to buy that charge tolls, «¡Suerte!» (chest, swap, duel, advance 3), the sand storm;
lead alarms per board, the last 30 s double, lucky coins for the last kid of a board capped at the gap, three bonus stars
per board, each board's winner, the class podium; rules `core/monopoly.js` + the shared board data
`js/monopoly-map.js`, phone `js/player-monopoly.js`, projector `host-monopoly.html` + `js/host-monopoly.js`, both draw
`js/monopoly-board.js` + `css/monopoly.css`; spec `docs/specs/monopoly-v2.md`) — plus the
class tools Warm-up (`warmup`), Lectura (`reading`) and the HSK/YCT sim rooms (`hsksim`).

Retired 2026-10-10 by his decision (code removed; recover from git history at commit `5e3743698`, the last one that still has them, if ever
needed): Market Quest, Market Clash, Clase de Caligrafía, Flappy Dragon, Zombie Escape, Mi Familia, Reinos en Guerra,
Triage ER, Lái-Qù-Huí, Shéi Shì?, Hóngbāo Run.
Retired 2026-10-14 by his decision: «Ojo de Halcón» (`look`, the first Mario Party attempt), replaced by Ojos de Halcón
(`halcon`); code, sounds, spec and picture brief removed (recover from commit `83dbcbd04` if ever needed).

Build any new or overhauled mode with the
`new-pin-game` skill and pass `node scripts/playtest-bots.js --game <type> --bots 20` before it ships.
