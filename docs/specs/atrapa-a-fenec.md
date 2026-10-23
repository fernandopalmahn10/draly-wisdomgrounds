# «Draly Cangrejo · ¡Atrapa a Fénec!» (gameType `teamcrab`) · spec

#4 of his Mario Party series: Super Mario Party «Team Crab» (his video https://www.youtube.com/watch?v=y9BKCVx_mNk
7:30-8:16), his design 2026-10-23. **v1** deployed 2026-10-23 (18fc42e4f + c8bdf147b). **v2** built the same day on
branch `teamcrab-v2` from his feedback after playing v1; **not deployed** (his word).

## Why v2 (his words after playing v1, 2026-10-23)
"I tried to hit the little fox and it said that it escaped… I don't see that it's working based on skills… it should feel
like kids are controlling the crab… who escapes, who hits… merit-based… what does the pendulum do?… why don't you make the
crab so that it moves as well, like in Mario Party… the crab decides where to hit." And: "I need to try it with two of my
devices and simulate how it would work in real life." His three new rules (mochi-mash CLAUDE.md): «Skill decides, never
luck», «Two rhythms: pick the one that fits each game», «Draly Party» (the name carries Draly).

## The clip (what we copy)
1 vs 3. Mario alone on a wooden dock at a sunny beach; Peach, Luigi and Daisy pilot a giant glossy red robot crab from
glass cockpits (two bubbles on top, one big window in front), its claws holding huge wooden barrel mallets. Fixed camera
from behind the dock, «START!», a 30-s clock. The crew raises the mallets over spots of the dock and slams them down
(a heavy thud, a puff of dust and pebbles), alternating and later double-striking; Mario reads the raised hammers and
runs into the gaps. «FINISH!» → he survived: the crab clanks and falls apart into pieces in a puff, «Mario Wins!».
(1 fps scan 7:28-8:17; the slam at 4 fps 7:39.5-7:42.75; the ending at 3-4 fps 8:09-8:14.)

## v2: rounds of two windows (his rule «Two rhythms»: a moving target needs the Windows rhythm)
Crews of 3-4 (the deal of `core/halcon.js`; ≤ 5 kids = one crew; a late joiner sits in the smallest crew, max 5). Each
crew = one giant red robot crab on a **Dubai beach**, a glass cockpit with each kid's face, a wooden barrel hammer each.
A 2-min game = **5 rounds** (3 min ≈ 7, 4 min ≈ 10; the schedule is recomputed at each round from the time left):
1. **Question window** (~11 s; at least 8 s): every kid answers quick-fire questions (8 s each, the round's pack).
   - A **right** answer = **+1 hammer charge** (max 4): a slot of my **hammer meter** fills with a clank.
   - A **wrong, late or blind** (< 0.5 s) answer = **El Péndulo eats one of my charges**: the hammer flies from my meter
     into his mouth («¡Ñam!», the Higgsfield chomp), he grows. With none to eat he still grows. The crew sees him eat,
     never who missed (`tc:eat` has no kid; `tc:mine` goes only to that kid). Right answers in a row shrink him (he
     squeaks). Only a question really shown can run out (`player:tc-seen`); a question cut by the window's end is free.
   - The crew sees the **race for Capitán** live («⭐ ¡Vas para Capitán!» / «⭐ Capitán: Ana»): right answers only.
   - The beach stays alive on top (the crab, Fénec moving, El Péndulo), the phone is never dead.
2. **«¡A martillar!»** (1.6 s, the whole phone): **my role**, shown big with its picture:
   - **⭐ Capitán** = the window's best answerer (most right; tie → the faster total time, then the earlier first right
     answer). He **steers**: drag the finger and the crab **walks** there (4.2 spots/s, it leans and bobs, its servos
     clank, the cockpits light up), its claws ride along. With charges he also slams with «¡GOLPE!» (the middle claw).
     No right answers in a crew = no Capitán.
   - **🔨 Martillero** = every kid with charges: my claw rides on the crab within its reach (±1 spot); **hold** the
     finger = my hammer's shadow follows it on the planks (the shadow = where it lands, as wide as the hit zone),
     **let go = SLAM** (one charge; 0.35 s fall, a thud, dust, a shake). A laptop: the shadow follows the mouse, a click
     slams. «¡GOLPE!» slams where the shadow is.
   - **👀 No charges**: I watch live and cheer with the emoji buttons; a big card says «Responde bien en la próxima ronda
     para subir al cangrejo».
3. **Play window** (10 s; it ends 1.5 s after the crew's last hammer lands when every charge is spent): Fénec runs his
   readable pattern; every hammer that lands with its shadow on him **bonks** him. «¡Tiempo!» (1.5 s) shows the round's
   tally, then the next question window. The last round is the **final round ×2** («¡Ronda final!»).

## Skill decides, never luck (his rule): Fénec's readable pattern
- He **stands** 0.65-1.35 s, **crouches 0.3 s leaning the way he will go** (the Higgsfield crouch, flipped for the left),
  then **runs exactly 2 spots** (to the edge at most) at 3.2 spots/s, away from the crab (at an edge he turns back).
- He **never dodges** a hammer: the server judges each impact at its own time, where he is then (`fxAt`): a hammer whose
  centre lands within 0.45 spot of his centre bonks him (the shadow's width shows it). Lying flat (1.1 s) or getting up
  (0.4 s) he can't be bonked twice.
- Every phone runs his plan exactly (the server sends each step with its timing, `tc:fen`), so what a kid sees is what
  the server judges. Unit test: a slam on a standing Fénec with time left bonks him 100 %; a slam on the spot he is
  running from misses 100 %.
- **What the kid saw is what counts**: every phone draws his plan one network trip late and its slam arrives one trip late,
  so the server measures each phone's round trip (`tc:ping` / `player:tc-pong`, every 3 s) and judges a slam where Fénec
  was at (impact − that round trip, ≤ 0.25 s), from his plan's history; a slam drawn on him on a slow phone bonks him.
- **A bonk**: +2 words for the slammer (+4 in the final round), +1 «trampa» for every other armed claw right beside him
  (≤ 0.75 spot: it blocked his way), +1 for the Capitán who drove the crab there (never counted as a trampa); the crew's phones flood gold, «¡BONK!», dizzy
  stars, his sack spills the class's words to the cockpits.
- **Target** per crew = 5.5 words × kids × minutes (≥ 6), tuned with the skill simulation below; a crew that reaches it
  has caught him (latched).

## The skill simulation (`node scripts/test-teamcrab.js --sim 60`, 60 games of 2 min per line; 92 checks pass)
| Crew (2 min) | caught | bonks / crew | slams / crew | hit rate | words / kid |
|---|---|---|---|---|---|
| skilful crew of 4 (85 % right; the Capitán drives under him; claws read his crouch, lead him, take turns; a kid's finger ±0.55 spot) | **100 %** | 21.3 | 24 | **88 %** | 21.8 |
| skilful crew of 3 | 100 % | 20.7 | 24 | 86 % | 22.6 |
| random tappers of 4 (the same 85 % answers; tap anywhere, steer anywhere) | **0 %** | 6.7 | 50 | **13 %** | 6.1 |
| robots of 4 («🤖 Probar con robots»: 70 % right, tap where he is, no lead) | 68 % | 12.9 | 35 | 37 % | 11.9 |
| skilful crew of 4 that answers 50 % right | 57 % | 14.9 | 17 | 86 % | 11.8 |
| never-answer crew of 4 | 0 % | 0 | **0** | — | 0 |
| a class of 30, every 6th kid never answers (80 % right) | 92 % | 19.3 | 22 | 86 % | 21.4 (the silent kids: **0**, 0 slams) |
| skilful crew of 4 on a slow school Wi-Fi (100 ms each way; the server rewinds by the round trip) | 100 % | 19.2 | 30 | 65 % | 19.6 |
| random tappers of 4 on the same Wi-Fi | 0 % | 6.5 | 50 | 13 % | 6.0 |
Skilful crews clearly beat random tappers (88 % vs 13 % of slams land; 100 % vs 0 % catches), on a slow Wi-Fi too (65 %
vs 13 %); answering right buys hammers (50 % right = fewer slams, half the words, 57 % catches); never answering never
slams. Live bots on the real server (skill bots read the `tc:fen` plan, random bots tap anywhere): 30 kids · 2 min: skill
72 hits of 117 slams (62 %), random 17 of 195 (9 %), silent 0; the classroom playtester's 20 bots: skill 66 %, random 11 %.

## «🤖 Probar con robots» (teacher only, the projector's lobby; reusable later, only this game today)
`host:tc-robots` (the room's projector in the lobby only) seats robots (🤖 Robi, 🤖 Roba, 🤖 Robo; Hamdan, Latifa, Aileen
skins) only into a crew of 1-2 phones, up to 4 seats: his own when he plays with one phone (1 kid + 3 robots = one crew of
4; 2 phones + 2 robots). A real class gets none even if the toggle stays on after «Otra ronda» (the lobby says «🤖 solo con
1-2 teléfonos»); a robot never opens a crew of its own. The rules play
them (`robotTick`): 70 % right after 1.5-3.6 s, the Capitán steers toward Fénec, slams every 1.1-2.2 s where he is with
±0.32 spot of aim. They are online always and marked 🤖 everywhere; never a player: no coins, record, star, podium,
leaderboard, class count or ranking (the end lists them in their crew's line only). A second tap sends them home.

## Timings (core/teamcrab.js R)
INTRO 2.6 s · question 8 s (late = eaten), < 0.5 s = blind, a wrong answer waits 1.3 s · question window ~11 s
(8-18 s from the time left; ROUND 24.5 s) · «¡A martillar!» 1.6 s · play window 10 s · «¡Tiempo!» 1.5 s · charges max 4
· FALL 0.35 s · BACK 0.42 s · reach ±1 spot · hit radius 0.45 spot · crab 4.2 spots/s · Fénec: stand 0.65-1.35 s, crouch
0.3 s, run 2 spots at 3.2 spots/s, flat 1.1 s, up 0.4 s · words: bonk +2 (+4 final round), trampa +1, Capitán +1 · anger
+1 a miss (max 5), −0.5 a right answer in a row · the final round fits the clock (its play window ≥ 4 s; ±30 s re-plans
the open window) · a slam rewound by the phone's round trip (≤ 0.25 s) · FINAL 2.4 s · an 80 ms room tick.

## The play window side by side with the video (his rule «Never call it done unless it FEELS like Mario Party»)
Ana's phone (390×844) filmed at 4 fps through a play window (`scripts/check-teamcrab-screens.js` → `final/play-4fps/`),
aligned on the impact with the video's 7:39.5-7:41.75: `.claude/handoff/teamcrab-shots/v2/side-by-side-play-window.jpg`
(the whole 5-s take: `play-window-4fps-sheet.jpg`: Fénec runs, she lets go on him standing, the fall on her shadow, BONK
at +0.25 s after the fall, the words fly, «¡Oye, eso no se vale!»).
| Moment | The video | Ours | |
|---|---|---|---|
| Who acts | 3 players: 2 raise and slam mallets, 1 drives | every kid of the crew: the best answerer drives (⭐ Capitán), every kid with charges slams; the others cheer | **we win** (everyone has a job, earned by answers) |
| The machine | the crab stands in the sea, claws up | the crab WALKS where the Capitán drags (leans, bobs, servo clank, the cockpit lights up), its claws ride along | **we win** |
| The aim | a raised mallet over a spot | my hammer's shadow on the planks follows my finger inside the crab's reach (as wide as the hit zone): let go = slam | even |
| The fall | ~0.25-0.5 s, a heavy thud, dust + pebbles | 0.35 s fall on the shadow, thud, dust + splinters, a shake (strong on my phone) | even |
| The dodger | Mario reads the mallets and runs into the gaps | Fénec reads the crab: stands, crouches 0.3 s leaning (the Higgsfield crouch), runs 2 spots, never an instant dodge | even (he is readable and beatable: the skill is ours) |
| The hit | (Mario dodged every one) | «¡BONK!»: gold flash on the crew's phones, dizzy stars, his words fly to the cockpits, «¡Buen manejo, Capitán!» / «¡Tu trampa funcionó!» | **we win** |
| Camera | tight on the crab, the mallets huge | a tall phone frames the action tighter (less sky, a bigger crab and Fénec); the projector shows every crew | even (the video's mallets are still bigger: a phone needs room for the panel) |
Nothing left in «we lose». Fixed while filming: the hammers first hovered over the faces (now above the cockpits), the crab
was small with a lot of sky on a phone (tighter framing), the «¡BONK!» stamp covered him once he sat up (it goes when the
words fly), Fénec left the screen at the dock's end mid-shake (wider margins).

## The ending side by side with the video (8:09.25-8:14.5)
Kept from v1 (`.claude/handoff/teamcrab-shots/side-by-side-ending.jpg`, `side-by-side-escape.jpg`): caught = every hammer
slams around him, bonk, every word flies, «¡ATRAPADO!», he runs to the far end of the dock «¡La próxima vez, Dralingo!»
(v2: he stays on the screen); escaped = he kicks the crab and it falls apart in a puff, «¡SE ESCAPÓ!». Then each crew's
ceremony: stars «Mejor martillazo», «Mejor capitán» (bonks while he drove), «Mejor trampa», «Mejor racha» → the drum →
the winner → my card (never a 0). Projector: each crew's ending, champion and stars, the robots' line («no cuentan»), the
crews by share of their target, the class podium.

## Peaks checked on every phone size (his rule: check the PEAK of every big moment)
`scripts/check-teamcrab-screens.js` (a whole 2-min game: projector 1600×900 + phones 390×844, 360×640, 844×390,
1366×657 + a late joiner + bots that miss half their answers): the question window (tiles + my hammer meter fit), each
role in the play window (the controls fit; the faces inside, no hovering hammer on them, Fénec inside), every bonk peak
(Fénec and the faces inside, nothing covering them), El Péndulo eating my miss, the ending (Fénec inside the ceremony's
stage), my card. `scripts/check-teamcrab-lobby.js`: «¡Empezar!» and «🤖 Probar con robots» on the first screen at 8
laptop / projector sizes.

## Files
`core/teamcrab.js` (rules, no sockets; the robots' brain `robotTick`) · server.js «🦀 DRALY CANGREJO» block (`tc*`) +
`player:tc-answer / -seen / -steer / -aim / -slam / -react / -pong`, `host:tc-skip`, `host:tc-robots` · `public/host-teamcrab.html`
+ `js/host-teamcrab.js` · `js/player-teamcrab.js` + `js/teamcrab-stage.js` (the beach, shared) · `css/teamcrab.css` ·
`public/assets/teamcrab/` (v1 art + v2: `pendulo-eat.webp` (El Péndulo biting a hammer), `fenec-crouch.webp` (the crouch
before a run), `chomp.mp3` (his «¡Ñam!»); Higgsfield 2026-10-23: pictures on Unlimited 0 credits, 2 sounds 0.75 credits) ·
shared end sounds `public/assets/party/final-v2.mp3`, `tick-v2.mp3`, `tock-v2.mp3` (the end-sounds branch, the same files) ·
tests `scripts/test-teamcrab.js` (+ `--sim`), `scripts/test-teamcrab-live.js`, bot handler `scripts/playtest/teamcrab.js`
(skill / random / silent bots), `scripts/check-teamcrab-screens.js`, `scripts/check-teamcrab-lobby.js`,
`scripts/record-teamcrab-end.js`. Originals: `assets-library/higgsfield/2026-10-23/teamcrab/` (+ `-sounds/`).

## Reviews (2026-10-23, v2)
- **Code review** (agent-skills:code-reviewer, 14 findings, all fixed, two verdict passes: **approve**): the blocker
  was the slammer's own phone drawing a different result than the server judged on a slow link (fixed: the server
  measures each phone's round trip and judges at the moment that phone showed, from Fénec's plan history; a unit test and
  a 100-ms sim line prove it); «±30 s» didn't re-plan the open window (no final round, play past 0:00: fixed with
  `replan()` and a final round that fits the clock); robots could open robot-only crews (now only a crew of 1-2 phones);
  a falling hammer jumped while the crab walked; a reflow + leaked timer per aim / steer message; «Saltar» in «¡A
  martillar!» gave phantom slams; last-second hammers judged early; the question bar after a pause; pause not shifting
  the answer times; non-numeric x; crewmates' charges on show; the race naming the wrong leader; the release landing off
  the shadow.
- **Classroom playtester** (projector + real-browser phones with real taps / CDP finger touches at 390×844, 360×640,
  844×390, 1366×657, «🤖 Probar con robots» with one phone, a class with 20 bots; 0 frozen, 0 errors, every tap reacted,
  clean server log): fixed its findings: the first-time guide hand pointed where Fénec had been (now where he stands or
  lands), the Capitán's own bonk was counted as a «trampa» and trampas were nearly free (now only another armed claw
  right beside him; the Capitán gets his own +1), robots left on joined a real class (now only 1-2 phones), the
  projector's end title with 1 of 5 crews («¡1 de 5 cangrejos atraparon a Fénec!»), the wrong pick unmarked (red
  outline), «+1 martillazo» too brief, the race chip cut and stale, «¡GOLPE!» pulsing past the edge, cockpit names
  overlapping, an F5 after the last hammer showing «miras». Its feel: «a real skill game: reading the crouch and releasing
  on an idle Fénec wins, random tapping loses; the crab feels driven; Fénec is readable».

## Scorecard · Draly Cangrejo · ¡Atrapa a Fénec! v2 · 2026-10-23 · branch `teamcrab-v2`
```
Hard gates: bots PASS (30 kids · 2 min: 8 crews, 6 rounds, 432 answers, 91 eaten, 336 slams, 110
            bonks, 37 trampas, 0 frozen, 0 errors; skill bots 87 of 141 slams hit (62 %) vs random 23 of 195 (12 %), silent 0
            words; 20 kids PASS in the classroom playtest) · teacher controls ✓ (Pausa holds the beach too, +30 s /
            −30 s re-plan the open window, Saltar ends the current window, Terminar, Sonido; «¡Empezar!» and «🤖 Probar
            con robots» on the first screen at 8 sizes: check-teamcrab-lobby 17/17) · saga only ✓ (our cast + his two villains,
            no logos) · Spanish / pinyin without tones / the round's own words ✓ (test-wording) · kid-safe ✓ (cartoon
            bonk, nobody touches anybody, never names who missed, the villains comic)
1 Real place ........ 2/2  a Dubai beach with the sail hotel, palms and a wooden dock; the crab walks the shore; the
                           words are won back there; it falls apart when he escapes
2 The gang .......... 2/2  every kid's face in their cockpit and on their hammer, the ⭐ Capitán star, Fénec and El
                           Péndulo with their cast.md lines («¡Ñam!»), the gang cheers streaks and talks on the projector
3 Every tap ......... 2/2  the lobby's 3 pictures (Responde bien · Si te equivocas, El Péndulo se come tu martillazo · ¡A
                           martillar!), a big role card each round, a guide hand for my first drag / slam, my hammer
                           meter, the shadow follows my finger and the release slams there, the panel names the action
4 Feedback .......... 2/2  +1 hammer (clank + pop), the hammer flying into El Péndulo's mouth (chomp), the crab
                           walking (clank), every bonk (gold flood, «¡BONK!», words fly, «¡Buen manejo, Capitán!» /
                           «¡Tu trampa funcionó!»), my miss («¡Fallaste! Mira dónde para Fénec»), the round's tally
5 Finale ............ 2/2  5 rounds with a rhythm (questions → «¡A martillar!» → «¡Tiempo!»), the last one ×2 with
                           tick-tock, «¡FINAL!» (whistle + crowd), two endings, stars (martillazo / capitán / trampa /
                           racha), the drum, the winner, my card; projector: crews by share + podium
6 Fair, no stall .... 2/2  skill decides (the sim: 88 % vs 13 % hits, 100 % vs 0 % catches; at 100 ms latency too),
                           never-answer = 0 slams; Fénec telegraphs every run; the hit judged where the slammer saw him;
                           only shown questions cost; every window has an end; late joiners, F5 and hidden tabs heal
7 Product feel ...... 2/2  Higgsfield art (2 new poses + v1's 19) and sounds, the walking crab, the 4-fps side-by-side
                           with the video, every phone size checked at the PEAK of every moment (check-teamcrab-screens 53/53)
Total 14/14 → ships (≥ 12, no 0). For his ears: the chomp and the shared «¡FINAL!» whistle + tick-tock.
```
Evidence: `.claude/handoff/teamcrab-shots/v2/`: `final/` (a whole game at 390×844, 360×640, 844×390, 1366×657 + the
projector: every window, role, bonk peak, El Péndulo eating, the endings, the cards; `play-4fps/` the filmed play
window), `side-by-side-play-window.jpg`, `lobby/`, `playtester/`, `bots-30kids-2min.txt`, `full-suite.log`.

## v1 (the morning of 2026-10-23, deployed 18fc42e4f + c8bdf147b, replaced by v2)
The alternating rhythm: a right answer loaded my hammer for 6 s (9 s the first time), I touched Fénec and it fell on one
of 5 fixed spots; Fénec hopped away from a hammer he «noticed» after 120-400 ms (an instant dodge he called luck: «I
tried to hit the little fox and it said that it escaped»); a miss jammed my hammer 3 s and Fénec snatched a word; El
Péndulo's big swing at anger 5 knocked every hammer away; the last 30 s ×2. Its full spec, side-by-sides, reviews and
14/14 card are in git (`git show 18fc42e4f:docs/specs/atrapa-a-fenec.md`); its evidence in
`.claude/handoff/teamcrab-shots/` (`final/`, `side-by-side-*.jpg`, `playtester/`).
