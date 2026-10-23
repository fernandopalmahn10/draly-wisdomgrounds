# La Gran Fuga de Dubái · new pin game

**Name since 2026-10-23: «Draly Fuga · Las rutas de la fuga»**, short «Draly Fuga» (the «Draly Party» names, his «Approve all»; `core/game-names.js`). The text below keeps the name it had when it was written.

> **v2 «Las rutas de la fuga» (2026-10-17): `docs/specs/gran-fuga-v2.md`** (routes of real places drawn as art, the
> painted rooms, the phone's chase strip, pacing from the clock). This file is v1 and its history.

Status: **BUILT 2026-10-13 on a worktree branch, local only, not deployed** (gameType `escape`). What was built and how
it differs from this proposal: § «As built» at the end, with the scorecard. His brief: "/watch https://www.youtube.com/watch?v=tDNcgM7b7oU
and construct with all the better criteria: frontend-design, Emil Kowalski, taste and impeccable". The video is Kahoot!
**Robot Run** (watched locally 2026-10-13: 101 frames + captions; times below are from it). Build with the
`new-pin-game` skill; grade with `docs/GAME_QUALITY_CHECKLIST.md` (ships at ≥ 12/14, no 0, all 5 gates); follow the
rules «Game-show moments on every phone» and «Design skills on every kid/teacher screen» in `mochi-mash/CLAUDE.md`.

## What the video shows (Kahoot Robot Run, co-op)
- How to play, 4 cards (~04:52): "You and your crew are being chased by an angry robot" · "Answer questions correctly
  and collect boosts to run faster" · "Move to the safe zones as quickly as possible" · "Pass as many levels as you can
  and escape the station".
- Run phase (~05:20–09:45): the projector shows the whole crew (each player's character + name) running right across a
  space-station floor; a big angry robot on the left zaps lightning at them. Top bar: «LEVEL 1/3», a green progress bar
  with the crew's position, and the time left. Every right answer on a phone = a **boost**: that player's name pops
  big over the crew and the crew surges forward. If the robot catches up the crew is zapped and the level restarts
  ("now we know the questions better", ~07:00). Phones only show the questions (4 coloured tiles, true/false too).
- Mini-game (~10:07–11:30): a top-down room with obstacles; green **safe zones** appear and every player walks their
  character into one before the zap; some zones show a number (4 players max) so the crew must split up ("this is the
  difficult one, you have to split up"); team hearts top-right (04 ♥); 3 waves.
- Ending (~11:30): the station explodes, a rocket blasts off, «Your rank is: JET TRAVELERS» (team rank, level 2 of 3);
  achievements for the most boosts, the fastest to the safe zones, the longest run.
- What makes it exciting: one class against one villain (everyone cheers everyone), the names popping on every boost,
  the robot getting closer, the split-up challenge, the escape.

## Ours: La Gran Fuga de Dubái (a Dralingo episode)
One sentence: the robot guard of the Museo del Futuro got a glitch and chases the whole gang through Dubai; every right
answer gives a kid a turbo; the class runs together through three Dubai zones to Hamdan's jet, dodging the robot's
(harmless, ticklish) zaps in the safe-zone challenges, and escapes in the sky.

### World (real places, Dubai at golden hour)
- Level 1 **Museo del Futuro** (silver ring, glass floor), level 2 **Dubai Mall + la Fuente** (palms, fountain jets),
  level 3 **la pista del aeropuerto** (Hamdan's unbranded jet waiting, engines glowing). Landmark art from
  `public/assets/kingdoms/landmarks/big/` + the Dubai skyline; new art made locally (local AI studio, no credits).
- The villain: **Robotín**, a big round glitchy guard robot (goofy, never scary: googly screen eyes, a spinning broom
  arm), zaps with blue tickle-lightning that makes kids dizzy for a second, never hurts. Kid-safe always.
- The gang: Dralingo leads the crew (projector top-left with his lines from `js/cast.js`); Profe Fer opens the episode;
  Hamdan waits at the jet; one random gang member cheers at each big moment.
- Each kid runs as their saga avatar (`public/js/saga.js`), name tag above.

### Rules
- Co-op, one team: the class against Robotín. Round 4-6 min (teacher picks), 3 levels.
- **Run:** answering is the engine. Right answer = turbo (the kid's character dashes, +progress for the crew); streak of
  3 = super turbo. Wrong = the right answer shown, next question at once (no penalty beyond no turbo). Robotín moves at
  a steady speed that grows each level; the gap between him and the crew is the tension meter. If he catches the crew:
  «¡Zap!», everybody dizzy 3 s, the crew is pushed back a bit (never a full restart: keep the class moving).
- **Zona segura** (between levels, 3 waves of ~12 s): a top-down room of that zone (museum hall, mall atrium, airport
  gate); green zones light up; every kid moves their avatar (joystick like Batalla de Nieve) into one; some zones have a
  capacity («4 👤») so the class must split up; kids still outside when the zap lands lose the crew a ❤️ (team hearts
  start at 5) and are dizzy 2 s. Hearts at 0 = Robotín catches the crew at the gate: the level is replayed once, faster.
- **Final escape:** reach the jet → Hamdan takes off, the crew rank is shown (team ranks named after Dubai:
  «Exploradores del Zoco» → «Viajeros del Burj» → «Pilotos del Cielo» by levels cleared and hearts left).
- Personal achievements at the end (like the video): most turbos, fastest to the safe zones, best streak.

### Phone (the product, every tap answers)
- Run phase: big 4-colour answer tiles + per-question timer; on a right answer the phone plays the turbo: the kid's
  avatar dashes across the phone with a speed trail and «¡Turbo! +1» (≤ 1.2 s, never covering the next question);
  a thin crew bar at the top shows Robotín's gap (turns red and pulses when he is close: «¡Robotín se acerca!»).
- Zona segura: the same joystick as Batalla de Nieve + a big arrow to the nearest free zone; capacity numbers on zones.
- Game-show moments on the phone (rule): episode intro (Profe Fer + Robotín, 3-2-1 with the kid's own avatar in the
  crew), level cleared («¡Nivel 2!» with the zone's landmark), zap, last minute, and the final escape with the kid's
  own stats and the team rank.
- «Así se juega» 3 pictured steps before the round; Spanish only; pinyin without tones; level words only.

### Projector
- Side-scrolling run: the crew (all avatars + names) running right through the zone's landmarks, Robotín behind with
  his zaps, parallax Dubai skyline; top bar: level, crew progress to the next zone, hearts, time. Turbo names pop big
  (one at a time, queued, ≥ 0.4 s apart). Big moments only: episode intro, level cleared, zap, last minute, escape.
- Teacher controls always: ⏸ Pausa, +30 s, Terminar ronda, Sonido, Otra ronda (pause must not block the buttons:
  the overlay lets clicks through, lesson of Batalla de Nieve).

### Engine notes
Reuse the Batalla de Nieve real-time pieces for the zona segura (movement validated by the server, 8 Hz positions,
seeded rooms, `scripts/playtest/<type>.js` handler that walks bots into zones) and the Reinos de Colores captains /
countdown / skin code for the phone moments. The run phase is server-timed (crew position = f(turbos, Robotín speed));
5 Hz broadcast. Bot playtest must answer, turbo, enter zones, split for capacity zones, lose hearts.

### Art to make (local AI studio, `local_ai/briefs/`)
Robotín (idle, zap, dizzy, defeated-goofy), the three zone backdrops + top-down rooms, the jet take-off, turbo trail,
safe-zone tiles, team-rank badges (no text). Until then: canvas drawings + the existing landmarks.

---

## As built (2026-10-13)

### Rules as built (what changed from the proposal, and why)
- **Pace fits the round.** The teacher picks 4–6 min (default 5). `core/escape.js` `paceFor()` turns it into a target
  run time per zone (round − 150 s for the three zonas seguras, ÷ 3, kept between 25 and 80 s). A turbo is worth
  `0.58 × pace / (0.09 × kids)` metres (0.4–12 m), so 5 kids and 30 kids feel the same; 3 right in a row = súper turbo
  ×2.5. The crew jogs at 42 % of the pace on its own: answering is the engine.
- **Robotín tracks the crew** instead of a fixed speed (bot runs: with a fixed speed he never caught a 20-kid class, 0
  zaps in 5 min). Behind more than the zone's target gap (12 / 8 / 5 m) he speeds up; every 14–22 s his glitch makes
  him sprint for 2.5 s, harder each zone (×0.9 / 1.3 / 1.7 of the pace). Zone 1 is calm, zone 2 has close calls,
  zone 3 zaps an average class now and then (test: 3 zaps in 6 simulated zone-3 runs of an average class, 0 for a
  strong one). He waits 3 s at the start of every run («¡Robotín despertó!»).
- **The zap tickles, never restarts.** Caught = «¡Zap!», everybody dizzy 3 s (tiles wobble and wait, the question
  timer holds), the crew slides back 6 m, Robotín bounces back 16 m dazed for 2.5 s, 4 s cooldown.
- **«¡Robotín se acerca!»** fires under 7 / 5 / 3 m per zone and switches off 4 m later (design review: one 8 m line
  kept the alarm on for all of zone 3). Phones: the rail turns red + a short band; projector: a red edge burst.
- **Zona segura** (3 waves of 12/11/10 s in zone 1, a little shorter later): wave 1 has big zones with no limit, wave 2
  every zone has a limit (room for 1.6× the class), wave 3 one more zone and tighter limits (1.25×, the class must
  split). A limited zone protects only the first kids in. Phones silent for 8 s (locked) are «away»: they never cost
  hearts and never take a protected spot.
- **Hearts, fairer than proposed** (classroom playtest: two distracted kids out of 17 cost the class zone 1 every
  round, no class ever escaped): one kid in ten may miss a wave for free, then 1 ❤️, 2 ❤️ only when over a third of
  the class is out; **clearing a zone gives 1 ❤️ back** (max 5). Hearts at 0 = «¡Robotín los alcanzó!»: the zone is
  replayed once with 3 hearts and a 12 % faster Robotín; a zone never starts at 0 hearts, and a teacher skip is never
  «caught».
- **Teacher escape hatch:** «⏭ Saltar zona» (only during a zona segura) ends it at once, nobody loses a heart. Plus
  ⏸ Pausa (everything waits, wave clock and question timers included), +30 s, Terminar ronda, Sonido, Otra ronda.
- **Ranks:** «Pilotos del Cielo» (escaped with 3+ ❤️), «Viajeros del Burj» (escaped, or 2 zones with 3+ ❤️),
  «Exploradores del Zoco». Stars 1–3 from the hearts left, never more than zones cleared + 1.
- **Awards** (most turbos, fastest to the zona segura, best streak) go to three different kids when the class allows
  it; «fastest» needs 2 timed waves and never counts a kid who was already standing where a zone lit up.
- **The end shows the whole crew** in join order with no numbers (nobody ranked last in front of the class); when the
  time runs out first, a «¡Tiempo!» beat («Robotín se quedó sin batería») comes before the rank.
- The episode intro is the countdown: Profe Fer («¡Bienvenidos a un nuevo episodio!»), Dralingo (platform look) and the
  crew VS Robotín, 3-2-1. Dralingo leads the crew in the run and talks from a bubble above his head (one Dralingo on
  screen, never two). One of the gang cheers at each cleared zone and the last minute with new `chase` lines in
  `js/cast.js` (each in their own voice, Aileen with voseo; the old `battle` lines talk about flags). Hamdan waits at the
  jet at the end of zone 3 and speaks at the escape.

### Phone moments (his rule «Game-show moments on every phone»)
Episode intro with my avatar in the crew + 3-2-1 (countdown) · «¡Robotín despertó!» / «¡Nivel 2: Dubai Mall!» band at
each run · turbo lane (my avatar dashes, Robotín left dizzy, ≤ 1.1 s on the result screen) · «¡Robotín se acerca!» band
· «¡Zap! ¡Cosquillas!» band + 3 s dizzy tiles · «⏱ ¡Último minuto!» band · «Ola N: ¡zonas verdes!» band · «¡A salvo!» /
«¡Zap! Te quedaste fuera» · level cleared card with the zone's landmark, my safe count and the cheer (+1 ❤️) · caught
card · escape card with my avatar boarding and my numbers · «⏱ ¡Tiempo!» band · end card: rank badge, stars, my
turbos / best streak / zonas seguras, my award. Bands sit below the chase rail (question) or the wave ring (room), never
over the answer tiles, ≤ 2.5 s; cards only when no tiles are on screen (the room's HUD and joystick step away).

### Files
`core/escape.js` (rules, pure; every tunable in `R`) · `public/js/escape-map.js` (the three 20×12 rooms + wave zones,
UMD, reuses `snow-map.js` movement) · `public/js/escape-render.js` (canvas: Robotín, his zap, rooms, props, zones,
kids) · server.js «LA GRAN FUGA DE DUBÁI» (`esStart`, `esTick` 10 Hz / 5 Hz broadcast, `esAnswer`, `esPause`,
`esFinish`; handlers `player:es-pos`, `host:es-skip`; escape branches in host:create/start/end-now/reset/reclaim,
player:join/answer/resync, host:pause/add-time, the watchdog, the host-left cleanup) · `public/host-escape.html` +
`js/host-escape.js` (projector; hooks `EscapeHost.frame() / debug() / moment(kind) / turbo() / hold() / say()`) ·
`js/player-escape.js` (phone; hooks `EscapePhone.advance() / walkTo() / frame() / band() / card() / dizzy()`) ·
`player.html` `#screen-escape` · `css/escape.css` · `js/player-kingdoms-skin.js` (escape branches, `hold()` /
`holdWhen()` for the question timer) · `js/cast.js` (`chase` mood) · `assets/escape/*.mp3` (Kenney CC0: turbo, super,
zap, glitch, safe, heart, wave, full, jet, «Mission Plausible» run loop, «Wacky Waiting» zone loop, ~400 KB) ·
registered in `games.html`, `packs.html`, `sets.html`, `js/maestro.js` · picture brief `content/escape/pictures.json`.

### Tests
- `node scripts/test-escape.js` — rooms (300 seeds × 3 zones: deterministic, no walled-in pockets, spawns fit), wave
  zones (7 class sizes × 3 waves: count, open floor, reachable, no overlap, room for the whole class), pace, turbo
  gains, streaks, the chase (a silent class is caught within a minute; an answering class of 5–30 reaches the zone near
  the 50 s target; zone 3 zaps an average class, not a strong one), occupancy (first in protected, away phones), hearts
  (free distracted kid, class-size rule, +1 per zone), caught/replay/skip/0-heart carry-over, position checks, ranks,
  stars, awards, pause shift: **319,101 checks**.
- Bot playtest `--bots 20 --seconds 60 --set pack:yct1-familia-r1` **PASS** (20/20, 205 questions, 0 frozen, 0 errors,
  game-end); `--bots 30 --seconds 60` **PASS** (30/30, 297 questions). Full 5-minute rounds: 20 bots **escaped**
  («Pilotos del Cielo», 3 zones, 4 ❤️, 1 tickle-zap, 18 capacity switches, 265 turbos); 30 bots reached the last zona
  segura («Viajeros del Burj», 19 capacity switches). Bots answer at random (~25 % right), so a real class is faster.
- Real-browser class (classroom-playtester agent, 12 bots + 5 headless phones, 3 rounds): late joiners in a run and in
  a zona segura, reload mid-run and mid-wave (same number, place and clock), Pausa / +30 s while paused, Terminar ronda
  mid-wave, time-out, Otra ronda ×2, Sonido; no console errors, no server errors, no hanzi, tiles 178×98+ px. Its
  findings (0 hearts carried into the next zone, finale out of reach, paused wave clock, lobby avatar ≠ game avatar,
  +30 s while paused not shown, end strip dropping kids) are fixed above.
- Code review (agent-skills:code-reviewer): R1 the phone's body class clashed with the projector's pause overlay, R2
  questions auto-failing during a long pause (timer hold + no new questions while paused), R3 «caught» after a perfect
  wave at 0 hearts; optional: paused wave clock, stale room loop after a reconnect, locked phones taking spots, the pause
  band sticking, wrong wave-end text at 0 hearts, `esTick` try/catch. All fixed, regression tests added.
- Design passes: impeccable (A: design review 28/40, B: detector) + emil-design-eng motion review, all fixes applied
  (contrast of white on the orange/green accents → ink; projector text sizes; run camera; banner/pop collisions; the
  cast sticker over the title; caught skin; crew in the escape; zone colours: full = grey, mine = green; exit faster than
  entrance on the name pops; meter/rail markers on transforms; only new lobby chips animate; reduced motion stills the
  zones). `test-packs`, `test-snow`, `test-kingdoms`, `test-paint`, `test-archive`, `test-wording` (now with the escape
  files) pass.

### Scorecard · La Gran Fuga de Dubái · 2026-10-13 · worktree branch (not deployed)
```
Hard gates: bots PASS (20/20 and 30/30, 0 frozen, 0 errors, game-end; 5-min rounds PASS) · teacher controls ✓ (Pausa
  lets clicks through, +30 s, Terminar ronda, Sonido above the big moments, Otra ronda, ⏭ Saltar zona; the question has a
  20 s timer, waves and moments are server-timed, nothing waits on a kid) · saga only ✓ (saga avatars, the cast,
  Dralingo in his platform look, an original goofy Robotín; test-wording clean) · Spanish/pinyin/level ✓ (questions only
  from /packs.html, pinyin without tones, no hanzi seen on any phone) · kid-safe ✓ (the zap tickles; no touching; the
  pictures are existing stickers)
1 Real place ........ 2/2  three real Dubai zones run in order: Museo del Futuro (the ring), Dubai Mall + the fountain
                           (the Burj), the runway with Hamdan's jet; skyline parallax; each zone's landmark is the
                           reward card when it's cleared; a room per zone; ranks named after Dubai (proj-run-turbo,
                           proj-cleared, phone-cleared)
2 The gang .......... 2/2  Profe Fer opens the episode in the VS intro, Dralingo leads the crew and talks, a gang member
                           cheers each cleared zone and the last minute in their own voice (Aileen voseo), Hamdan waits
                           at the jet and cheers the escape; every kid runs as their saga avatar on phone and projector
                           (proj-countdown, phone-countdown, proj-escape)
3 Every tap ......... 2/2  4 colour tiles ≥ 92 px with press + sound + buzz; joystick 132 px and the whole room as a
                           floating joystick; «¡Arrastra!» hand; «Así se juega» on the phone lobby and the projector;
                           first-zone help card; a status pill that says exactly what to do + an arrow to a zone with room;
                           dizzy / pause explained (phone-lobby, phone-zone-safe, phone-close)
4 Feedback .......... 2/2  turbo lane, súper turbo, «¡Una más y súper turbo!», wrong shows the answer, safe / out per
                           wave, zap, close, caught, cleared, escape each their own reaction; optional big moments one at
                           a time ≥ 7 s apart; turbo names queued ≥ 0.4 s, 2 on screen, «+N turbos más» (proj-zap,
                           phone-turbo, phone-zap)
5 Finale ............ 2/2  the gap is the tension (red rail, «¡Robotín se acerca!», glitch sprints, zone 3 bites), last
                           minute alarm + final music + cameo, the jet takes off with the crew under it, rank badge +
                           stars, zones cleared, 3 awards to 3 kids, the whole crew, gang finale; «¡Tiempo!» beat when
                           time runs out; every phone its own rank and numbers (proj-escape, proj-end, phone-end,
                           proj-timeup)
6 Fair, no stall .... 2/2  only right answers make turbos (time-up = wrong); nothing waits on a kid; away phones don't
                           cost hearts or take spots; first-in protection; one distracted kid in ten free; late joiners
                           and reloads keep their place (playtest); Pausa / +30 s / Terminar / Saltar zona / Otra ronda
                           mid-round
7 Product feel ...... 1/2  recorded sounds + two music loops (Kenney CC0), the phone as polished as the projector, right at
                           390 px and 1600×900; but Robotín, the rooms, the props, the control tower and the gate are
                           clean canvas drawings in the sticker style, not pictures yet (brief content/escape/pictures.json,
                           24 pictures + 2 loops; no image generator was used, the GPU was busy)
Total 13/14 → ships (≥ 12, no 0). Work left for 14/14: Robotín's poses and the zone art from the brief.
```

### Next ideas (not built)
Each green zone carries a picture and the wave says its word («¡A la zona de jiejie!»), so the zona segura also teaches
(design review question) · a findable spot for every kid in the run (a lane or a seat with the tag always on) · tune
`R` after the first real class (target gaps, sprint, wave times, hearts).

---

## As built · 2026-10-16 · the Mario Party ending pass (branch `ending-pass`, not deployed)

The shared ceremony, the lobby greeting, the shared files, every test with its count, the reviews and what they
changed, and the design pass are written once in `docs/specs/reinos-de-colores.md` § «As built · 2026-10-16».

- **La Gran Fuga: what changed.**
  - *The ending:* the jet's take-off (7 s) or the clock → «¡FINAL!» («¡Despegamos! ¿Qué rango ganamos?» / «¡Se acabó el
    tiempo!») → «¿Hasta dónde llegó la tripulación?» (the three zones light up one by one with a drum, the jet takes off
    when they escaped, then the rank badge and its stars pop) → «¡Escaparon de Robotín!» (the crew cheering, Robotín
    dizzy, Hamdan's `win` line) or «¡Casi escapan!» (the crew sighing, Robotín happy, Hamdan's kind `animo` line) → bonus
    stars: **Más turbos**, **Más rápido a la zona segura** (2 timed waves), **Mejor racha**, **Más olas a salvo**; co-op,
    so everyone at the top shares a star (a crew safe in every wave all get «Más olas a salvo») → the projector shows the
    whole crew (join order, the star icons on the kids who won one), never a ranking; the card: the rank as the title
    with its stars, «Diste 6 turbos a la tripulación», where the crew got, olas a salvo, súper turbos, racha, aciertos.
    The old awards (three different kids) stay in the payload for the old end screen.
  - *No dead phones:* already alive (turbo lane, bands, the zona segura room, cards between zones); the «¡Tiempo!» band
    moved into «¡FINAL!».
  - *Mario Party touch:* **«¡Súper turbos!»** in the last 30 s (every right answer is a súper turbo, ×2.5), only while
    the crew runs (a zona segura asks no questions: it switches off there and on again with its band when the next run
    starts inside the last 30 s): phone band, projector banner + Dralingo's line + ribbon + red clock. Co-op: no lead changes, no comeback rule (the hearts and the one free distracted
    kid in ten already keep the class going).

### Files
- La Gran Fuga parts: `core/escape.js` (súper turbos in the last 30 s in `answer`, `STARS`, `finish`), server.js
  (`esEndPayloads` replaces `esFinish`; the jet goes through «¡FINAL!»; «Súper turbos» only while the crew runs),
  `public/host-escape.html` + `js/host-escape.js`, `js/player-escape.js` (FINAL stops the chase, the last-30-s band; the
  «¡Tiempo!» band moved into «¡FINAL!»), `scripts/test-escape.js`, `scripts/playtest/escape.js`.

### Tests and reviews
`node scripts/test-escape.js` 319,113 checks; La Gran Fuga in `test-party.js` (cards, shared stars) and
  `test-party-live.js` (the ending after the clock, «Saltar zona» guarded under FINAL); bots PASS at 4 / 20 / 30 (30: 255
  questions; «Súper turbos» off when the last 30 s fall in a zona segura).

Classroom playtest (2 rounds: the clock, a late joiner, «Pausa», «Terminar» twice, a reload during «¡FINAL!»,
«Saltar»): PASS, no phone ever dead. Fixed: «¡Súper turbos!» landing inside the last zona segura (it runs only while
the crew runs), a crew of 14 over Hamdan's line, the star icons floating over the row above, a reload after the end
replaying the show. Kept: the 4-minute pacing (see below), «Más rápido» won in 0.3 s by a socket kid.

### Scorecard · La Gran Fuga de Dubái · 2026-10-16 · branch `ending-pass`
```
Hard gates: bots PASS (4/20/30) · teacher controls ✓ (⏸ Pausa, +30 s, ⏭ Saltar zona, Terminar, ⏭ Saltar, Sonido,
            Otra ronda, F5) · saga only ✓ · Spanish/pinyin/level ✓ · kid-safe ✓ (Robotín's zap tickles)
1 Real place ........ 2/2  Museo del Futuro → Dubai Mall y la Fuente → la pista del aeropuerto and the jet, lit
                           up one by one in the reveal
2 The gang .......... 2/2  Profe Fer's episode intro, Dralingo leads the run, Hamdan at the jet and speaking in the
                           ending, the crew full body
3 Every tap ......... 2/2  unchanged: turbo lane, zona segura room
4 Feedback .......... 2/2  unchanged bands and cards + «¡Súper turbos!»
5 Finale ............ 2/2  «¡Súper turbos!» in the last 30 s, «¡FINAL!», the route reveal with the rank and its stars,
                           the crew cheering or sighing, 4 shared bonus stars, the whole crew (never ranked), every
                           kid's own card
6 Fair, no stall .... 2/2  co-op: stars shared by everyone at the top, nobody ranked last, hearts and the free
                           distracted kid unchanged
7 Product feel ...... 1/2  Robotín and the rooms are canvas drawings, not art
Total 13/14 → ships (≥ 12, no 0). To 14: Robotín poses and the zone rooms (art request below).
```

### Open items and what to watch in the first real class
- **«¡Súper turbos!»** makes every right answer a súper turbo in the last 30 s: a class close to the jet may now
  escape at the bell. That is the point; watch it doesn't feel automatic.
- **Shared stars:** a crew safe in every wave all get «Más olas a salvo» on their cards; the projector shows the star
  icons on the kids, never a ranking.
- **The clock vs the zonas seguras.** In the playtest each zona segura took ~45 s, so 4-minute rounds often ended one
  wave short of the jet («¡Casi escapan!» twice). If classes never escape at 4 min, pick 5 min or shorten the waves
  (`core/escape.js` `paceFor()` reserves 150 s for the three zonas seguras).
- **Art request:** Robotín in four poses (running, dizzy, happy, sad) and the three zones' rooms (Museo del Futuro,
  Dubai Mall y la Fuente, the airport runway with the jet), on #00FF00 for Robotín (→ Product feel 2/2).
- **The show's length.** ~15 s from «¡FINAL!» to the cards (2.4 + 3.6 + 3.2 + 2.1 per star). If the class gets
  restless, «⏭ Saltar» jumps every phone to its card; the stage times are `REVEAL_MS` / `RESULT_MS` / `STAR_MS` in `public/js/party.js`.
- **A projector reloaded after the end** shows the old screen until `finReclaim(socket.id, g)` is called from
  `host:reclaim` (`reinos-de-colores.md` § Files). Phones that reload get their card back.
- **School Wi-Fi.** A flag tap or a paint stroke counts up to 0.6 s into «¡FINAL!» (`GRACE_MS`); a quiz answer sent
  during FINAL comes back unused. If kids complain «I answered!» at the bell, raise `GRACE_MS` in `core/party.js`.
- **The ceremony sounds** (drum, fanfare) under Profe Fer's voice: check the volume on the classroom speakers.
- **Art requests (Higgsfield in his Chrome; kid-safe, no text or logos):** each captain in a true «talking» pose on
  flat #00FF00 (the bubbles use the ready / victory poses today).

### Art batch 1 · 2026-10-17
- The captains' new poses (Higgsfield Unlimited, 0 credits, his Chrome): `assets/cast/<id>-{talk,jump,wow,67}.webp` for Fer, Hamdan, Latifa, Aileen and Adric (Adrian: Higgsfield refuses him, his three poses stay) and Dralingo `assets/dralingo/{talk,jump,wow}.webp`. `js/cast.js` rotates them: `hello` → hello or talk, `cheer` → cheer or jump, `mystery` → mystery or wow (held 25 s per character, so a moment never flickers); `talk` / `jump` / `wow` / `67` ask for exactly one. The shared ending (`js/party.js`): the reveal shows both captains surprised (`wow`), the result the winners cheering and the other captain speaking kindly (`talk`), the phone card the same; the captains' stickers are preloaded with the show.
- Robotín is a picture per mood (`assets/escape/robotin/{idle,chase,zap,dizzy,happy}.webp`, one Higgsfield sheet): `EscapeRender.robotin()` draws it with the same bob, tilt and facing (the canvas drawing stays as the fallback while it loads; the phone preloads them at `es:init`). The zona segura props (display case, planter, potted palm, fountain, bench, airport seats, luggage cart) use the shared `assets/props/` pictures. The rooms' floors and the run scene's backdrops stay canvas (a picture would not line up with the tile grid).
