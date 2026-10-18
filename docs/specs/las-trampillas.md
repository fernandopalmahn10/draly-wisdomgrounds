# Las Trampillas · ¡Que no te trague el suelo! (gameType `trapdoor`)

Mario Party recreation #2 of his series (2026-10-17): the minigame of his video at 4:43-5:41
(https://www.youtube.com/watch?v=y9BKCVx_mNk), the round platform whose pie slices drop like trapdoors. Analysis and his
picks: `.claude/handoff/trapdoor-video/next-minigame-analysis.md` (root repo, this PC). Built on a branch, not deployed.

## The video, frame by frame (80 frames, 4:43 → 5:41)
- One big round platform split into **8 equal pie slices** (seams every 45°, from 12 o'clock) around a raised **hub**
  that shows the countdown; a thick gold rim; a fixed **tilted top-down camera**: the whole platform and every player
  always in view. ~20 characters on it at once, **red rings vs blue rings** under their feet.
- Flow: black → the platform → **«START!»** (1.5 s) → **«Round 1»** with 3 progress dots (1.5 s) → pink warning
  slices start jumping (~2 s) → the hub counts **5, 4, 3, 2, 1** (1 s each) while the pink slices keep jumping around the
  circle (a bluff: every ~0.7 s a new place) → **«0»**: the slices lit at that instant hold ~1 s (the last dash) → they
  **open like double doors** hinged on their outer seams, everyone on them drops into the dark (~1.5 s) → the floor
  closes (~0.6 s) → **«Round 2»** → the same → **«Final Round»** → **«FINISH!»** over the survivors → **«Team Mario
  Wins!»** (the team with more survivors), the whole cast celebrating on the platform.
- What drops: Rounds 1 and 2 = **one quarter** (2 adjacent slices); the Final Round = **two opposite quarters** (a bowtie,
  half the floor), the lit pair rotating 45° at a time. A round is ~13 s.

## Our version: the same minigame, reskinned (his three picks)
**1 · Answers save you.** Exactly the video's round, plus: during the countdown each kid on the platform gets a question
on the phone; a **right answer gives their character golden WINGS** for this round's drop: standing on a falling slice
with wings, the wings flap and hold them over the hole, then set them down when the floor closes (wings used up). Wings
are earned again every round (every round every kid answers). The wings question closes at «0» (the dash belongs to
running). **Kids who fell answer to come back**: in the pit their phone keeps asking; a right answer brings them back up
at once (rising onto the platform) if there is still time before «0» this round (≥ 1.8 s), else at the start of the next
round. While they wait for that start, one more right answer = they come up with wings. Nobody just watches.
**2 · Fuego vs Mar.** Red vs blue rings, the whole class (10-30) on one platform. After each drop each kingdom scores
**its share still standing, out of 10** (8 of 10 standing = 8 points; the Final Round counts double: «¡vale doble!»), so
an odd class (7 vs 6) is a fair fight; the kingdom with more points wins («¡Gana el Reino del Fuego!»), then the shared
Mario Party ending (`core/party.js`, `js/party.js`).
**3 · The arena (Claude's pick, Dubai + China).** Three arenas, the teacher picks one in the lobby, «Otra ronda» = the
next: **El Palacio de Dubái** (a royal hall's round marble mosaic, gold and turquoise, the night skyline through the
arches; the pit = a pool of giant floating cushions), **El Templo del Cielo** (Pekín: the round white marble altar, the
blue triple-roof hall behind it at sunset; the pit = a misty lotus pond), **El Jardín de la Luna** (Suzhou: a round
pebble-mosaic courtyard behind a moon gate, lanterns and bamboo; the pit = a koi pond). Art: Higgsfield Unlimited.

## Timing (one round = 13.1 s, like the video's ~13-15 s)
| Phase | ms | What every screen shows |
|---|---|---|
| TITLE | 1500 (Final 2200) | «Ronda N» + the progress dots; wings reset; waiting kids rise; the wings question appears |
| ROULETTE | 2000 | pink slices start jumping (no number yet) |
| COUNT | 5000 | the hub counts 5 → 1 (tick each second); the pink keeps jumping, faster near the end |
| LOCK | 1100 | «0» + alarm: the chosen slices burn hot pink; the wings question closes («¡CORRE!») |
| OPEN | 1700 | the doors swing down; falls judged on the server at this instant; wings hover over the hole |
| CLOSE | 600 | the doors close; saved kids land |
| TALLY | 1300 | «+N en pie» per kingdom, the lead; then the next round (or «¡FINAL!») |
Game: «¡YA!» intro 2.6 s, then **5 · 7 · 10 rounds** (teacher's pick in the lobby, default 7 ≈ 1.6 min), the last one
is always «¡Ronda final!». What drops: quarter (2 slices) in the first half, **3 slices** in the second half («¡Ahora
caen 3!», the roulette faster), the bowtie (4 slices = two opposite quarters) in the Final Round. The final set is drawn
uniformly at random at «0» by the server, independent of the roulette and of where kids stand (the roulette is a bluff,
like the video). A class plays several matches with «Otra ronda» (the next arena each time).

## Movement (server-authoritative, the paint recipe)
- Platform radius 100 world units; the hub 24; a kid's feet stay between 32 and 93 from the centre. **Tap the floor =
  run there** (`player:td-go {x, y}`, an intent: clamped, ≤ 12 a second); the server moves every kid at 10 Hz at
  92 u/s (≈ 2 s across), sliding around the hub; nobody enters an open hole; position only ever changes by the server's
  step. The phone predicts its own run at the same speed (the tap answers in the same frame) and eases onto the server.
- Positions out at 5 Hz (`td:pos`, only the kids that moved, everyone every 2 s); round plan once per round (`td:round`,
  the roulette schedule included, never the final set); `td:lock` / `td:open` / `td:tally` at those instants; `td:me`
  per kid on a change; `td:roster` on joins and team changes. No `state` pushes during play.
- Which slice a kid is on = the slice of their feet point. Falls are judged on the server's position at the OPEN instant,
  with a **lag grace**: a kid already running off the dropping slice gets a little more of their run first, because
  their phone shows them that far ahead: their own one-way lag (the room pings every phone every 3 s, the median of
  the last 5) + a tick, between 180 and 400 ms of running; a kid standing still, too far from the seam or running the
  wrong way still falls. A fall is drawn from where the server judged the feet, never from safe floor.

## Phone (the product, 390×844 and 360×640)
Top: Fuego vs Mar points + who is still standing, the round dots, «Sonido». Middle (flex): **the whole platform**
(tilted, full width), every kid as their full-body saga character on a red / blue ring, **mine 1.4× bigger, a pulsing
ring and «TÚ»**, names only near me (never overlapping), the pink slices, the hub's big number. Bottom: **a compact
question card** (header in words, a 64 px picture + the prompt, four 2×2 tiles ≥ 58 px): **tap-to-move on the platform +
answer below = two separate areas, no mode switch**, so a kid can run and answer without fumbling (the alternative, a
sheet over the floor like Pintores, would hide the slices during the countdown: rejected). The card collapses to one line
once answered («🪽 ¡Tienes alas! Ahora ¡esquiva!»), giving the platform more room. In the pit: the platform stays in view
(the action above), my character waits in a «foso» window in the corner (the arena's pit art), the card says «¡Caíste!
Responde y vuelves arriba». Moments on every phone: «¡YA!», «Ronda N», «¡RONDA FINAL! ¡vale doble!», «0 · ¡CORRE!»,
«¡Tus alas te salvaron!», «¡Caíste!», «¡De vuelta!», «+9 en pie», lead changes with my captain's line. «Así se juega» (3
pictured steps) on the first round + a tapping hand on the floor.

## Projector (secondary, 1600×900, readable from the back)
The arena art filling the screen, the platform big in the middle with every kid, name tags collision-avoided, the
hub's number big; top: PIN, Fuego points (en pie), «Ronda 3 de 7» dots, Mar points; sides: the captains + rosters (🪽
wings, 🕳️ in the pit); bottom: **«El foso»** strip with the fallen kids (their heads rise when they come back);
bands for «¡YA!», «Ronda N», «¡Ronda final!», «+N en pie». Lobby: PIN, the arena (picture + «Cambiar arena»), rounds
5 · 7 · 10, the kingdoms, Equilibrar, «Así se juega», start. Countdown: the captains' VS.

## Fairness (sim `scripts/test-trapdoor.js`, 360 simulated classes)
- A stronger kingdom usually wins (more wings, faster comebacks); chance still matters (where you stand at «0»).
- Server judges answers: a guess under 450 ms = wrong; one answer per question; a wrong one waits 2 s (3.4 s after two
  in a row) before the next; the wings question closes at «0»: mashing never earns anything.
- No teleport, no client deciding a fall, no entering a hub or an open hole; the final set is uniform random.
- Late joiners and kids whose phone dropped: a late joiner rises at the next round; a dropped phone's character stays
  (greyed) and can fall, but only connected kids score.

## Teacher
⏸ Pausa (everything stands still: the count, the roulette, the runners, the question clocks), «+30 s» = **2 rondas
más** (up to 15, not during the Final Round), ⏭ Saltar (the intro, a tally), Terminar («¡FINAL!» now), Sonido, «Otra
ronda» (the next arena), F5 reclaim with the room token (`teacher-gate.js`), arena + rounds in the lobby, Equilibrar.
Every wait has a timeout: phases are timer-driven, a question nobody answers closes at 20 s (phone) / 21 s (server).

## Ending (shared ceremony)
«¡FINAL!» → the reveal «¿Qué reino aguantó más?» → «¡Gana el Reino del …!» → bonus stars (at most 4): **Siempre en
pie** (longest run of rounds standing), **Alas salvadoras** (times the wings saved them), **Más aciertos**, **Vuelta
épica** (comebacks from the pit) → each phone's card («Aguantaste N rondas en pie», wings, comebacks, aciertos).

---

## As built · 2026-10-17 (branch `trapdoor`, not deployed)

What changed from the plan above, after three reviews (below): the kingdoms score **their share standing out of 10**
each round (a head count gave the bigger side of an odd class 70 % of the wins in the first sim); the doors judge falls
with a **lag grace** that follows each phone (the room pings every phone every 3 s; the grace = that kid's one-way lag +
a tick, 180-400 ms of running; see Movement); after a right answer the next question waits **1 s** (the verdict stays
readable); «too fast» is timed on the wall clock from the deal (a teacher's pause counts as reading time); at «0» only a
kid whose own slice burns is told «¡CORRE!» (the others «¡Quieto ahí!»); the Final Round deals no pit or «rise with
wings» questions after «0» and never promises «la próxima ronda»; the podium breaks equal points by the longer run,
then the right answers; «Siempre en pie» shared by more than 6 kids is skipped; the reveal asks «¿Qué reino aguantó
más?».

### Files
- New: `core/trapdoor.js` (the rules: rounds, the roulette plan, the uniform drop at «0», falls / wings / the grace,
  questions, comebacks, the tally, pause, +2 rondas, skip, stars, ranks), `public/js/trapdoor-arena.js` (UMD, shared by
  the server and both screens: the platform's geometry, the clock of a round, the runner's step, the three arenas),
  `public/js/trapdoor-render.js` (the canvas: the arena, the tilted platform, the doors swinging over the pit art, every
  kid's saga character on a red / blue ring, wings, falls, rises, tags), `public/js/player-trapdoor.js` (the phone),
  `public/host-trapdoor.html` + `public/js/host-trapdoor.js` (the projector), `public/css/trapdoor.css` (phone `tp-*`,
  projector `th-*`), `scripts/test-trapdoor.js`, `scripts/test-trapdoor-live.js`, `scripts/playtest/trapdoor.js`,
  `docs/specs/las-trampillas.md`, art and sounds in `public/assets/trapdoor/`.
- Shared files, trapdoor parts only: `server.js` (the «LAS TRAMPILLAS» block `td*`; handlers `player:td-go`,
  `host:td-arena`, `host:td-rounds`, `host:td-skip`; the `td:ping` lag probe; join / rejoin / resync / late joiner /
  swap / balance / 5-min cleanup / F5 reclaim; a trapdoor answer for an old question is refused as stale; the shared
  ending), `public/player.html`, `public/js/player.js`, `public/js/player-kingdoms-skin.js`, `public/js/party.js` +
  `public/css/party.css` (the reveal, the card, the stars), `public/js/cast.js` (moods `trampa` + `enpie`, Aileen in
  voseo), `games.html`, `sets.html`, `packs.html`, `js/maestro.js`, `scripts/test-wording.js`, `docs/GAME_MODES.md`,
  `docs/HOW_CLAUDE_WORKS.md`, `CLAUDE.md`; `?v=` bumped to `20261017td`.

### Art and weight
10 pictures on his unlimited Higgsfield (Nano Banana Pro, zero credits): a floor, a background and a pit for each arena
+ the golden wings; originals in `assets-library/higgsfield/2026-10-17/trapdoor/`. Shipped as WebP: Dubái 456 KB,
Templo 230 KB, Luna 505 KB (bg 1600 w, floor 900², pit 960 w), wings 26 KB; music `music-rounds.mp3` 211 KB (Kenney),
7 recorded effects 53 KB. A phone loads one arena: **≈ 0.75 MB** of media + ≈ 150 KB of new code (uncompressed).

### Network and cheap phones
`td:pos` ≈ 4.8 messages a second per screen, only the kids that moved (everyone every 2 s); one tiny `td:ping` per phone
every 3 s; no `state` pushes during play (≈ 10 per kid in a whole match: lobby, start, end). The canvas keeps a static
layer (background, rim, floor, seams) and redraws only the moving parts; sprites are scaled once per size (1/8 steps),
the wings' glow blurred once, the hub's gradients made once per layout; reduced motion: no bobbing, no shake, no card
nudge, a short fade instead of the drop.

### Tests
- `scripts/test-trapdoor.js` 1306 checks: geometry, the runner (never through the hub or into an open hole), the clock,
  the roulette, the uniform drop (8000 draws), falls / wings / the lag grace (quick vs slow phone), the tally shares,
  questions (too fast, waits, the 1 s pause, the «0» instant, the Final Round's pit), the teacher, the ending, ranks and
  every card, and **360 simulated classes**: a kingdom answering 85 % vs 55 % wins 99 % (loses 1 %), 75 % vs 62 % wins
  76 %, equal kingdoms 41 / 53 (ties 6 %); per round 1.7 falls, 4.4 saves by wings, 1.3 comebacks; 8.1 questions a kid.
- `scripts/test-trapdoor-live.js` 92 checks on a real server: lobby (arena, rounds), intents, clamping, no teleport, the
  tap rate limit, the wings question, a guess, «¡Casi!» waits, «0» closing the question, who falls / is saved / gets
  away, the pit's questions, the tally, a late joiner, +2 rondas, pause (an answer right after «Seguir» is not too
  fast), a reconnect, the projector's F5, a comeback at once, the server's time-up, the lag probe, «Terminar», the cards,
  «Otra ronda».
- Bots (`scripts/playtest-bots.js --game trapdoor`): 4 / 20 / 30 kids PASS (79 / 383 / 549 questions, 0 frozen, 0
  errors, the ending seen). The whole unit suite (25 files) 0 failing + asset-guard; every live suite (10) on a
  throw-away server: all pass.

### Reviews
- **Code review** (agent-skills:code-reviewer, 4 important + 12 minor): all fixed: the lag grace + falls drawn from the
  server's spot, the 1 s pause after a right answer + tiles armed 450 ms after they arrive, the sprite cache (1/8 steps),
  the glow and the hub's gradients made once, the clock wrapped (30 faults → the ending), wings need time before «0»,
  old-question taps refused, «¡FINAL!» stops the round clock, ghost kids off the screens, the rosters reset on «Otra
  ronda», «Siempre en pie» capped, the 15-round refusal says so, the Final Round copy, reduced motion, the pit strip.
  Kept (already in every game, not trapdoor's): the countdown timer in `host:start`, the projector's reclaim ignoring a
  refusal, an F5 with `?livegame=1` opening a new room.
- **Classroom playtest** (classroom-playtester agent, 6 matches, 3 arenas, 30 bots, real browsers at 1600×900,
  390×844, 360×640, lag kids at 0-250 ms): nothing froze, 0 server errors. Fixed: two opposite messages at «0»; the
  header cut at two-digit counts and 10-15 rounds («¡Nos falta 1!»); «Así se juega» clipped at 360×640; the lag (the
  grace now follows each phone, the phone no longer pulls itself back on a slow connection); the Final Round's pit copy;
  ⏭ Saltar silent mid-round (now greyed with a hint); the pink vanishing before the doors; the projector lobby's cards
  cut; name tags over the hub's count. Kept: the shared «Sonido» pill over the phone lobby's third step at 360 px, the
  phone watchdog's resync during the 3-2-1 (every game).
- **Fresh-eyes design review** (screenshots): fixed: a saturated magenta in every round (the pastel pink vanished),
  my ring turns hot pink when my slice burns, «TÚ» bigger with a pointer, the projector's names bigger, idle wings
  smaller, my character wears the wings on the card, «¡Huye del rosa!» in «Así se juega», the podium ranks (no more three
  «1»), the pit's status line shorter, «¿Qué reino aguantó más?», «2 rescates de sus alas». Kept: the phone's star
  screens were caught before their figures fly in (they do); the lobby's «camel Benja» chips are the test bots' raw
  avatar names (real phones send the character's emoji); the start screen's dragon and the ending's grid / glow are
  the shared skin and ceremony (all games); the card keeps its fixed height (the platform must not jump when a question
  comes).
- impeccable detector (run once): 16 findings → the pit strip's heading level and the lobby's red fixed; the rest are
  pictures filled at run time, text on game panels the detector can't see, and the game's own glows.

### Follow-up · the doors' word, one truth (2026-10-17)
- `td:open` carries `at`: where the doors judged every kid on the floor (after the lag grace). Both screens draw a fall
  or a save from there, and a test checks every verdict against it (never against a position report one tick late).
- The phone never contradicts the server: at «0» it says «¡Quieto ahí!» only when both its own position and the
  server's last report are off the burning slices (`TrapdoorArena.lockVerdict`: else «¡CORRE!», «¡Sigue corriendo!» or,
  with wings, «¡Tus alas te cuidan!»); «¡Sigues en pie!» waits for the doors' verdict; a fall or a save shows the moment
  `td:open` arrives. Found while checking: before this, a kid whose phone ran ahead could read «¡Quieto ahí! Tu suelo
  no se abre» and then fall, and a fallen kid could see «¡Sigues en pie!» for a beat before «¡Caíste!».
- `scripts/test-trapdoor-live.js` is deterministic on a slow laptop: round 1 puts four winged kids still on the even
  slices and four without wings on the odd ones (a quarter is one of each: exactly one save and one fall, whatever
  drops), every round-1 event is listened for from the round's start, waits are on messages; 8 runs in a row against
  one low-priority throw-away server all pass.

### Scorecard · Las Trampillas · 2026-10-17 · branch `trapdoor`
```
Hard gates: bots PASS (4/20/30 + the playtester's 30) · teacher controls ✓ (⏸ Pausa, «+30 s» = 2 rondas más, ⏭ Saltar,
            Terminar, Sonido, Otra ronda = next arena, F5 reclaim, arena + rounds in the lobby, Equilibrar) · saga only ✓
            · Spanish/pinyin/level ✓ (questions from the packs; test-wording 85 files clean) · kid-safe ✓ (no text or
            logos in the art, nobody touching)
1 Real place ........ 1/2  three real places with their own pit (a Dubai palace hall on the night skyline, the Temple of
                           Heaven's round marble altar, a Suzhou moon-gate garden); but nothing in the place is worth
                           points: the video's minigame has no prizes (like Ojos de Halcón)
2 The gang .......... 2/2  captains' VS in the countdown, their lines on leads and in the ending (moods trampa / enpie,
                           Aileen in voseo), every kid's full-body saga character on a team ring on both screens
3 Every tap ......... 2/2  tap-to-run answers in the same frame (prediction, ripple), the tapping hand, «Así se juega»
                           with 3 pictured steps, «¡CORRE!» only when my slice burns / «¡Quieto ahí!», the pit window
                           and card say exactly what to do
4 Feedback .......... 2/2  «¡ALAS!», «¡Tus alas te salvaron!», «¡Caíste!», «¡De vuelta arriba!», too fast / time up,
                           tally bands, recorded sounds per event; one moment at a time (a pill, throttled)
5 Finale ............ 2/2  2 → 3 trapdoors → the Final Round's bowtie ×2 with its own band and music, lead changes,
                           «¡FINAL!», the reveal, the winners, 4 bonus stars, the podium, each phone's own card
6 Fair, no stall .... 2/2  the server judges every fall and answer, share scoring (no size bias, 360 simulated
                           classes), guesses wrong, waits after misses, a lag grace per phone, nobody without something
                           to do (pit questions, late joiners rise), every wait timed, teacher controls mid-round, F5
7 Product feel ...... 2/2  Higgsfield arenas, pits and wings, recorded music and effects, the phone at 390 and 360 as
                           finished as the projector
Total 13/14 → ships (≥ 12, no 0). The missing point: a landmark or prize worth points in the arena; the minigame has
none, and adding one would change it (his call).
```
