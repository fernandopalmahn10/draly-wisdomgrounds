# Reinos de Colores · build plan (new game mode)

Status: **BUILT 2026-10-10** (gameType `kingdoms`). Files: `core/kingdoms.js` (board rules), server.js `kd*` functions,
`public/host-kingdoms.html` + `js/host-kingdoms.js`, `js/kingdoms-board.js` (shared SVG board), `js/player-kingdoms.js`
(phone), `css/kingdoms.css`, `assets/kingdoms/` (Kenney grass/castle/sounds + small Dralingo). Bot playtest:
`node scripts/playtest-bots.js --game kingdoms --bots 30 --stall 11 --handlers scripts/playtest/kingdoms.js`.
Built differently from the plan below: no pause button at first (+30 s and end-now instead; «⏸ Pausa» added 2026-10-16, see the end), castle-ring tiles can be stolen
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

---

## As built · 2026-10-16 · the Mario Party ending pass (branch `ending-pass`, not deployed)
## As built · 2026-10-16 · the Mario Party ending pass (branch `ending-pass`)
His rules «Feelings at the end of class» and «Feelings in between too: no dead phones» (CLAUDE.md § Pin games), applied
to the four games built before the recipe (Reinos de Colores, Dragones Pintores, Batalla de Nieve, La Gran Fuga). Each
game keeps its core play, rules and teacher flow; what was missing was added. The four share one ceremony:
- **Shared pieces.** `core/party.js` (bonus stars with ties, ranks, shares, `FINAL_MS` 2.4 s / `GRACE_MS` 0.6 s),
  `public/js/party.js` (UMD `DralyParty`: the Spanish card lines, tested in node; the «¡FINAL!» band, the ceremony for the
  phone and the projector, the phone's news banner and the last-30-s chip), `public/css/party.css` (namespace `pf-`; the
  kid figures, stars and confetti are css/mochi.css's `.mmk` / `.mm-star` / `.mm-confetti`, now loaded on these four
  projector pages too, with `js/mochi-stage.js` + `js/halcon-board.js`). server.js block «THE MARIO PARTY ENDING»:
  `finBegin` (every end goes through «¡FINAL!»: the clock, «Terminar», Nieve's last freeze, La Gran Fuga's jet; a paused
  round ends from the pause card; answers during it come back unused, no new question, nothing moves), `finFinish` →
  `kdEndPayloads` / `pcEndPayloads` / `snEndPayloads` / `esEndPayloads` (built ONCE as `g.finEnd`: a phone that rejoins
  or resyncs gets the same show and card again, joining where the others are (`ago`); a reclaiming projector will too
  once `host:reclaim` calls `finReclaim`), `host:fin-skip` → `fin:skip` on every
  phone, `fin:frenzy` (one 0.5 s check for every room: the last 30 s on, or off again after «+30 s»). The remade games
  (Mochi, Piñata, 6-7, Monopolio, Vuelo, Halcón) keep their own ceremonies untouched (their reveals are game-specific);
  a future game can use `DralyParty.Ceremony` with a `fin` payload.
- **The show** (~15 s, «⏭ Saltar» top-right on the projector jumps every phone to its card; «Ver mi tarjeta» on a phone):
  «¡FINAL!» (2.4 s) → the reveal (3.6 s) → the winners celebrate, the others react (3.2 s: full-body kids cheering or
  slumped, each captain speaking next to themselves: the winners' line, a kind `animo` line to the side that lost; new
  cast moods `reino`, `pintado`, `nieve`, `animo` for every character, Aileen in voseo) → up to 4 bonus stars one by one
  (2.1 s each; «¡ES PARA TI!» on the winner's phone) → the projector's podium (top 3 full body with their stars, the MVP
  of each side, «🏠 Inicio», «🔄 Otra ronda») and every phone's own card: my character in my side's colours, the title,
  what I did («Conquistaste 23 casillas», «El 14 % del territorio de tu reino»), the score, up to 4 facts, my stars and
  «¡Número 1 de tu reino!», «Quédate aquí: tu profe puede empezar otra ronda» and a quiet «Salir del juego». A kid with
  nothing sees «¡La próxima es tuya!» and how to play next time, never a 0 («2 preguntas jugadas», never «0 aciertos»).
- **The lobby greeting** (player.html, every game): «¡Hola, Sofi!» (1.3 rem, bold) + «Tu profe va a empezar… mientras
  tanto:» (it was «¡Bienvenido Sofi!» in small grey for girls too, and «Esperando al anfitrión…»).
- **Reinos de Colores: what changed.**
  - *The ending:* «¡FINAL!» → «¿Qué reino conquistó más de Dubái?» (both kingdoms' columns fill with a drum, the smaller
    stops first; the landmarks each kingdom holds drop onto its column) → «¡El Reino del … conquista Dubái!» (the winners'
    captain with a `reino` line, the other captain with an `animo` line; kids cheering / slumped; Fuego's Dralingo stays
    red) → bonus stars: **Más territorio** (tiles the kid's flags took), **Mayor conquista** (the most tiles in one flag,
    3+), **Racha más larga** (3+), **Más monumentos** (landmarks the kid tapped) → podium by points (the unit of the rosters during play) + «Más puntos del Reino del …» for each kingdom; the card:
    «Ganaste 17 puntos para tu reino», «Conquistaste el 31 % del territorio de tu reino», casillas, monumentos, racha,
    aciertos. Auto-planted flags count for the kingdom and the kid's tiles, never for landmark stars.
  - *No dead phones:* the result screen between questions now carries the live kingdom score («¡Faltan 3 para
    alcanzarlos!»), my captain reacting to the answer (a `battle` line on a right one, an `oops` line on a miss) and «Tus
    casillas: N»; banners at the top edge (never over the tiles, one at a time, from the kd:plant diffs every phone
    already gets): a landmark won by a teammate («🏙️ ¡Sofi conquistó el Burj Khalifa!») or lost («😮 ¡El Mar le quitó
    a tu reino el Burj Al Arab!»), my castle in danger, a siege, my kingdom passing ahead with my captain's line (≥ 7 s
    apart), a teammate's big surround (≥ 5 s apart).
  - *Mario Party touch:* **«¡Banderas dobles!»** in the last 30 s (every right answer earns twice the flags; a streak's
    double becomes three, never more): phone banner + «Banderas ×2» chip with the seconds, projector banner + spotlight.
    Kept out on purpose: a comeback bonus (surrounds, steals and the castle ring already let a kingdom come back; a
    capped bonus on top would blur «the bigger empire wins»). Simulated (`scripts/test-kingdoms.js`, 300 classes of 20
    kids, 3 min, random taps): late swings in even classes 11 → 15 of 300; the kingdom that answers better (65 % vs 55 %)
    still wins 288 of 300 with or without it.
  - *«⏸ Pausa» (new, the hard gate «teacher never stuck»):* the clock stops, open plant windows wait (no auto-plant),
    an answer during the pause comes back unused (the question stays open, its 20 s clock held on the phone), taps are
    refused; «▶ Seguir» moves the clock on by the paused time and every kid still holding a flag gets a fresh 8 s plant
    window. Phones show a «⏸ Pausa · Mira a tu profe» card; the projector's card lets «+30 s», «Terminar» and «Sonido»
    work under it; «Terminar» from the pause card plays «¡FINAL!».

### Files (the shared part, used by all four games)
- New: `core/party.js` (bonus stars with ties and `maxShare`, ranks, shares, `FINAL_MS` / `GRACE_MS` / `FRENZY_MS` / `MAX_STARS`),
  `public/js/party.js` (UMD `DralyParty`: `GAMES` config per game, `card()` = the Spanish card lines, `Ceremony` for the
  phone and the projector, `final()`, `news()`, `chip()`, `pauseCard()`, test hook `DralyParty.hold('reveal'|'result'|
  'star0'|'end')`), `public/css/party.css` (namespace `pf-`), `scripts/test-party.js`, `scripts/test-party-live.js`,
  `scripts/playtest/party-check.js` (the bots' FINAL + card checks, used by the four game handlers).
- Shared files, ending parts only: `server.js` (block «THE MARIO PARTY ENDING»: `finBegin`, `finRescue`, `finFinish`,
  `finPack`, the four `*EndPayloads`, the frenzy check, `host:fin-skip`; `endGame(pin, force)`; FINAL / frenzy / card
  re-sent on `player:join` and `player:resync`; answers during FINAL come back stale with reason `final`),
  `js/player-kingdoms-skin.js` (the phone ceremony for the four games, the result screen's live strip, the pause card),
  `js/cast.js` (moods `reino`, `pintado`, `nieve`, `animo` for every character), `player.html` + `js/player.js` +
  `css/styles.css` (the lobby greeting), `scripts/test-wording.js` (the new files are checked for tone and hanzi).
- Not wired on purpose: `finReclaim(sid, g)` in server.js re-sends the frenzy, «¡FINAL!» or the whole show to a
  projector that reclaims its room. `host:reclaim` is being changed in another window (only the teacher who created a
  room may take it back), so the call goes in there: `finReclaim(socket.id, g)` after its checks and the game's own
  init. Until then a projector reloaded after the end shows the old screen; phones get their card back.
- Reinos parts: `core/kingdoms.js` (`flagsFor`, `STARS`, `finish`), server.js (`kdAnswered` / `kdBest` / `kdTiles` /
  `kdBig` / `kdLms` per kid, `kdPause`, `kdEndPayloads`, the pause guards in `kdPrompt` / `kdApplyPlant`, `playerTiles` in
  `kd:plant`), `public/host-kingdoms.html` + `js/host-kingdoms.js` (the ceremony, the last-30-s ribbon, «⏸ Pausa»),
  `js/player-kingdoms.js` (the news banners from `kd:plant`), `scripts/test-kingdoms.js`, `scripts/playtest/kingdoms.js`.

### Tests
| Test | Result |
|---|---|
| `node scripts/test-party.js` (bonus stars with ties and `maxShare`, ranks, shares; 4,000 random cards per game never show a 0, singular forms, the guest card, Nieve's spell picks, the star values, every character has the four new moods, no hanzi) | 80,124 checks pass |
| `node scripts/test-party-live.js --url … --password … --frenzy` (real sockets, the four games: «¡FINAL!» on every screen, a second «Terminar» ignored, an answer during FINAL comes back unused, a late joiner during FINAL gets FINAL then a card, the phone's end payload under 9 KB while the projector keeps the leaderboard, Nieve's paused seconds are not survived seconds, a phone back after the end gets the same card and how long ago it ended, «Saltar» reaches the phones, «Otra ronda» starts clean; Reinos + Pintores pause: stale answer, the clock resumes, a fresh 8 s plant window, «Terminar» from the pause card; `--frenzy`: the last 30 s, 2 flags a right answer, the pause holds the ×2 chips and «Seguir» brings them back, «+30 s» switches them off) | 191 checks pass |
| `node scripts/test-kingdoms.js` (+ `flagsFor`, `finish`, 300 simulated classes of «¡Banderas dobles!») | 461 checks pass; late swings in even classes 11 → 15 of 300; the better kingdom wins 288 → 288 |
| `node scripts/test-paint.js` (+ `reward`, `finish`, the stars) | ~120,900 checks pass (random levels: the count moves a little each run) |
| `node scripts/test-snow.js` (+ copos dobles, bolas certeras, the stars, survived seconds) | 94,784 checks pass |
| `node scripts/test-escape.js` (+ súper turbos in the last 30 s, the shared stars) | 319,113 checks pass |
| `playtest-bots.js --game <g> --seconds 60` with the game's handler (+ `party-check.js`: «¡FINAL!» and a card on every bot) | PASS at 4, 20 and 30 bots for all four games · 0 frozen · 0 errors · a card for every kid · 30 bots: Reinos 503 questions, Pintores 381, Nieve 314, La Gran Fuga 255; stale answers only from FINAL or the pause; La Gran Fuga's «Súper turbos» stays off when the last 30 s fall in a zona segura (20 and 30 bots) |
| Every other suite (dragon, monopoly, sixseven + phone, mochi, pinata, halcon, packs, stress-packs, wording 77 files, archive, ruta ×3, level-keys, sims-lock, golden-book, audios-base) | all pass |
| `node scripts/asset-guard.js` | exit 0 |

### Reviews and what changed
- **Code review** (agent-skills:code-reviewer on the whole diff, all fixed): a throw inside the ending could leave a room
  stuck under «¡FINAL!» (the timer is armed first now, plus a rescue that forces the end); Nieve's paused seconds counted
  as survived seconds (the timers shift by the pause); phones that joined as guests got no card (a guest card «¡Qué
  ronda!»); heavy end payloads sent to 30 phones (lean phone payloads: no leaderboard, crews trimmed); the old
  `.win-screen` still reachable under the ceremony (hidden); the last 30 s not re-sent after a reconnect (re-sent on
  join and resync); the projector's «dobles» banners timed by its own clock (driven by `fin:frenzy` now); «Saltar zona»
  working under FINAL (guarded); the news timer and the ceremony root not cleared on «Otra ronda»; dead constants (the
  last-30-s window is one `FRENZY_MS` in `core/party.js` now); the last 30 s skewing «Más llamaradas» (only streak
  llamaradas count); the live test's default URL.
- **Fresh-eyes design review** (stills of every stage, phone 390 / 360 and projector): fixed the result hidden behind
  «¡FINAL!» (the old win screen was revealed under it), winners not obvious from the back (the winners' side 1.45×
  wider on the projector with a gold glow), the podium's units («9 nubes al final», «puntos»), Nieve's losing-side title,
  stars as «★ × N», a bigger «Estrella Bonus» kicker, the captains' bubbles («Capitana Aileen»), the totals in the head
  row, my own figure with a glow, no last-30-s cue on the projector (a ribbon with the seconds + a red pulsing clock),
  «Más llamaradas» shared by too many kids (skipped when more than 3 would share it). Kept (older than this pass, not
  the ending's): Nieve's side panel clipping on tall classes, Pintores' name tags overlapping when kids bunch up, the
  Nieve tutorial hand, the pinyin answer «you», the rank names.
- **Classroom playtest** (two classroom-playtesters at once, each with a projector at 1600×900, phones at 390×844 and
  360×640, a late joiner and 12-15 socket kids; 4 rounds of each game, every end path, «Terminar» twice, «Pausa» in the
  last 30 s, «+30 s» at the bell, reloads during «¡FINAL!» and after the end, + their own bot runs at 20 and 30):
  nothing froze, nothing errored (only the favicon 404), no phone was ever still for more than 2 s, «¡FINAL!» 2.4-2.5 s
  on every screen, the show ~15-18 s, «Saltar» brings every phone to its card within ~1-2 s, no card ever read «0».
  Fixed from it:
  - La Gran Fuga: «¡Súper turbos!» landed inside the last zona segura (no questions there) and the projector still
    announced it → it runs only while the crew runs (off in a zona segura, on again when the next run starts).
  - Nieve: «¡Copos dobles!» was one 3 s toast most phones missed → the lasting «Copos ×2» chip of the other games.
  - The ×2 chips ran out during a pause in the last 30 s, and after «+30 s» at the bell → the pause holds them
    (`fin:frenzy` off + `hold`), «Seguir» and «+30 s» send them again with the new seconds (`again`: no second banner);
    a phone reconnecting during the pause no longer gets the banner under the pause card.
  - The projector's ribbon sat on top of every event banner («¡E[Copos ×2 24 s]a Leo!») → the banners step below it.
  - A side of 9-15 kids climbed over its captain's bubble and score → rows balanced and capped at 2 (5 a row, 6 for
    La Gran Fuga's crew; 6 kids = 3 + 3, never a lone kid on a row).
  - A phone back after the end replayed the whole show → the server says how long ago the round ended (`ago`): the
    phone joins the show where the projector is, or goes straight to its card.
  - «+30 s» during the pause did not move the stopped projector clock (a teacher may tap it three times) → it shows the
    new time at once (Reinos, Pintores).
  - Pintores' lead bubble could contradict the score bar when the lead flipped back → a flip back hides the stale
    bubble, at most one lead announcement every 7 s.
  - A podium where nobody scored sat empty → «¡Esta vez nadie sumó! La próxima ronda es de todos» with both captains.
  - The reveal's unit floated alone at the bottom → beside each kingdom's number.
  - A Nieve kid picked by the Hechizo read «Y antes aguantaste 9 s sin congelarte» → «¡El Hechizo te eligió…!».
  - Small: the La Gran Fuga star icons floated over the row above (now at the kid's feet), «Fuego ×2» on the corner of
    the out-of-fire card (moves aside), «Sonido» over «¡A jugar!» on Nieve's help card at 360 px (steps aside), «Reino
    del Mar» pale yellow on pale blue in the lobby (deep blue), the VS divider through «¡A pintar!» (an ink pill).
  - Kept: La Gran Fuga's zona segura eats about 45 s a zone, so 4-minute rounds often end one wave short of the jet
    (pacing older than this pass; see what to watch); «Más rápido a la zona segura» won in 0.3 s by a socket kid that
    jumps straight into the zone (a phone walks there); the 3 s «¡Espera la próxima ola!» between waves.
- **Design pass (emil-design-eng format):**

| Before | After | Why |
| --- | --- | --- |
| The round ended on a static «¡Ganó …!» screen, the phones on a list | «¡FINAL!» (2.4 s) on every screen, then reveal → winners → stars → card / podium | One shared beat tells the whole room the round is over |
| The phone ceremony's background: a full Burj Khalifa behind the cards | A 26vh skyline strip at the bottom | The kid's own figure and numbers are the picture |
| Captains as big as the kids, the crew tiny | Captain head + bubble in the side's head row, the kids at full size | The kids are the winners, the captain speaks for them |
| The tools («Otra ronda», «Inicio») on every stage | Only inside the last stage | Nothing to tap by mistake during the show |
| La Gran Fuga's route stops cut at the phone's edges | Phone offsets for the three zones and the jet | The whole route reads on 360 px |
| A crew of 9 wrapping to a lone figure; a side of 15 in three rows over its captain | Balanced rows (6 = 3 + 3), two at most, the margins fit the row | Nobody stands alone, nothing covers the captain's line |
| The podium overlapping the MVP cards at 1600×900 | Podium max 880 px, MVPs fixed beside it | Read from the back row |
| The container class `pf-crew` colliding with a team class | `pf-kids` | A side's colours leaked into the crew |
| «¡Bienvenido Sofi! Esperando al anfitrión…» in small grey | «¡Hola, Sofi!» bold + «Tu profe va a empezar… mientras tanto:» | Neutral for girls and boys, readable, says who starts |
| The last-30-s ribbon on top of the event banners | The banners step 60 px down while it shows | Both read; the ribbon is the frame, the banner the news |
| «puntos» alone under the two columns | «37 puntos» beside each number | One number, one unit, one place to look |
| Star icons floating over the row above on the crew wall | At the kid's feet beside the name | The icon belongs to that kid |
| «¡A pintar!» cut by the cream divider | On an ink pill | The last word of the countdown must read |
| An empty podium | Both captains + «¡Esta vez nadie sumó!» | Never an empty stage in front of the class |

- **impeccable detector** (once at the end): `css/party.css` + `js/party.js` clean; on the four projector pages the same
  findings as before this pass (empty-src pictures filled by the script, contrast inside older panels), plus two kept:
  the gold glow of the shared star pill (`css/mochi.css`, now loaded on Reinos and Pintores) and Pintores' four captain
  pictures that get their `src` when the captains arrive (as Reinos already did). Advisory: the bounce easing and the
  striped bars (the platform's game-show language, kept on purpose).

### Scorecard · Reinos de Colores · 2026-10-16 · branch `ending-pass`
```
Hard gates: bots PASS (4/20/30) · teacher controls ✓ (⏸ Pausa NEW, +30 s, Terminar, ⏭ Saltar, Sonido, Otra ronda,
            F5) · saga only ✓ · Spanish/pinyin/level ✓ (questions from the packs; test-wording checks the new files)
            · kid-safe ✓ (kids stand side by side, nobody touches)
1 Real place ........ 2/2  Dubai skyline, the five landmarks on the board, and they drop onto each kingdom's column
                           in the reveal
2 The gang .......... 2/2  two captains every round (VS, side panels, lead lines), my captain reacting on my phone
                           between questions, both captains speaking in the ending (`reino` / `animo`)
3 Every tap ......... 2/2  unchanged: the plant screen zooms onto glowing tiles, a hand on the first plants
4 Feedback .......... 2/2  the live score + my captain + «Tus casillas» between questions; landmark / castle / siege
                           / lead banners at the top edge, one at a time, throttled
5 Finale ............ 2/2  «¡Banderas dobles!» in the last 30 s, «¡FINAL!», the columns with a drum, winners vs the
                           others, 4 bonus stars, podium + MVP per kingdom, every kid's own card
6 Fair, no stall .... 2/2  the server judges; an auto-plant never pays more than a tap; the frenzy caps at 3 flags
                           (sim: the better kingdom still wins 288/300); pause holds every window; FINAL grace 0.6 s
7 Product feel ...... 2/2  our art (landmarks, the gang, full-body kids), Kenney sounds, reduced motion, phone at 390
                           and 360, projector at 1600×900
Total 14/14 → ships (≥ 12, no 0)
```

### Open items and what to watch in the first real class
- **The show's length.** ~15 s from «¡FINAL!» to the cards (2.4 + 3.6 + 3.2 + 2.1 per star). If the class gets
  restless, «⏭ Saltar» jumps every phone to its card; the stage times are `REVEAL_MS` / `RESULT_MS` / `STAR_MS` in `public/js/party.js`.
- **A projector reloaded after the end** shows the old screen until `finReclaim(socket.id, g)` is called from
  `host:reclaim` (see Files). Phones that reload get their card back.
- **School Wi-Fi.** A flag tap or a paint stroke counts up to 0.6 s into «¡FINAL!» (`GRACE_MS`); a quiz answer sent
  during FINAL comes back unused. If kids complain «I answered!» at the bell, raise `GRACE_MS` in `core/party.js`.
- **The ceremony sounds** (drum, fanfare) under Profe Fer's voice: check the volume on the classroom speakers.
- **Art requests (Higgsfield in his Chrome; kid-safe, no text or logos):** each captain in a true «talking» pose on
  flat #00FF00 (the bubbles use the ready / victory poses today).
- **«¡Banderas dobles!»** makes the last 30 s busier on the board (late swings 11 → 15 in 300 even classes). If a
  kingdom that led all round loses in the last seconds and the class feels cheated, lower `FRENZY_MS` in
  `core/party.js` (the window for all four games) or make `flagsFor` in `core/kingdoms.js` double streaks only.
- **The pause:** after «▶ Seguir» a kid who was holding a flag gets a fresh 8 s. Watch that nobody reads the pause card
  as «the game is over».
