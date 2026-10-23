# «¡Atrapa a Fénec!» (gameType `teamcrab`) · spec

#4 of his Mario Party series: Super Mario Party «Team Crab» (his video https://www.youtube.com/watch?v=y9BKCVx_mNk
7:30-8:16), his design 2026-10-23. Status: built 2026-10-23 on branch `teamcrab` (bundle), **not deployed** (his word).

## The clip (what we copy)
1 vs 3. Mario alone on a wooden dock at a sunny beach; Peach, Luigi and Daisy pilot a giant glossy red robot crab from
glass cockpits (two bubbles on top, one big window in front), its claws holding huge wooden barrel mallets. Fixed camera
from behind the dock, «START!», a 30-s clock. The crew raises the mallets over spots of the dock and slams them down
(a heavy thud, a puff of dust and pebbles), alternating and later double-striking; Mario reads the raised hammers and
runs into the gaps. «FINISH!» → he survived: the crab clanks and falls apart into pieces in a puff, «Mario Wins!».
The feeling: high tension for the dodger, a coordinated whack-a-mole rhythm for the crew. (1 fps scan 7:28-8:17; the
slam at 4 fps 7:39-7:42 (impact at 7:40.0); the ending at 3-4 fps 8:09-8:14.)

## His design (2026-10-23): the kids are the CREW, the enemy dodges
- **Crews of 3-4** (the deal of `core/halcon.js`: 4, 3 when it doesn't divide, ≤ 5 kids = one crew; a late joiner sits
  at the smallest crew, max 5). Each crew = one giant red robot crab in the sea of a **Dubai beach** (the sail-shaped
  hotel on the horizon, palms, a wooden dock; unbranded), a glass bubble cockpit per kid with the kid's face, one wooden
  barrel hammer per kid (with the kid's face on its claw).
- **Fénec, el ladrón de palabras** (cast.md, concept B: a fennec fox, cartoon burglar, striped shirt, eye-mask, a sack
  where the stolen words glow; never Arab or Emirati clothing) stands on the dock, hops between **5 spots**, taunts
  («¡Mías, mías!», «¡No me atrapan!») and dodges. Computer-played and fair (see «Fénec» below).
- **On a kid's phone**: answer a question right → **your hammer loads** (its shadow shows on the dock, ringed in gold for
  you). Then **touch Fénec** (the hammer comes down right there), or drag it over a spot and swipe down / «🔨 ¡GOLPE!»,
  within 6 s (your first one: 9 s, guided by a hand): it slams by itself when the time runs out (never stuck). A laptop:
  the hammer follows the mouse, a click slams. The crewmates' loaded hammers hover live over their spots with their
  shadows (relayed like the dormilon feather), so the crew can **trap** him.
- **A bonk** (the hammer lands where he is): the crew's whole phones flash gold, rays, «¡BONK!», Fénec flat with dizzy
  stars, then he sits up with his sack open and **the class's words fly out** (the pinyin of the round's pack, never
  hanzi) to the cockpits; the bonker shown big over the top bar («¡LO APLASTASTE! +2 📚» / «¡Ana aplastó a Fénec!»);
  every crewmate whose loaded hammer covered a spot next to him gets a **trampa** (+1: «¡Tu trampa funcionó!»).
- **A wrong, late (15 s) or blind (< 0.5 s) answer costs** (his standing rule): my hammer **jams with smoke 3 s** (only
  on my phone), Fénec **snatches a word back** «¡Mías!» (the crew's meter drops; never who failed), and a **grumpy
  spark** flies into El Péndulo. Only a question the phone really showed can run out (`player:tc-seen`).
- **El Péndulo** (concept A: the golden bob with spiral eyes, greedy arms) hangs over the sea and **eats every miss**:
  he grows, glows and swings faster (anger 0-5). At 5 his **BIG SWING** takes over every phone of the crew (purple-orange
  flood, the giant pendulum swings across the whole phone, sparks, shake, whoosh + clank): every hammer of the crew is
  **knocked away 3 s** (their questions wait). Right answers in a row **calm him** (−0.25 each, he squeaks «¡Nooo, no se
  rían!» and shrinks). The lesson, in a funny way: anger feeds him, calm and laughter stop him.
- **The clock**: 2 / 3 / 4 min (default 2). Teacher: «⏸ Pausa», «+30 s», «−30 s» (never ends the game; the crews' targets
  follow the new length), «⏭ Saltar» (a bonk / swing / jam ends now), «⏹ Terminar», «🔊 Sonido». Last 30 s:
  «¡Atardecer dorado!» every bonk ×2.
- **The ending**: «¡FINAL!» says per crew caught / escaped. A crew that **emptied the sack** (words back ≥ its target,
  latched: misses after it never undo it) has **caught him**: the crew's hammers trap him from both sides, bonk, every
  word flies out, «¡ATRAPADO!» big, the crew cheers in the cockpits and he runs off «¡La próxima vez, Dralingo!». Else
  **he escapes**: he laughs, kicks the crab and it **falls apart in a puff** (the video's ending, comic), «¡SE ESCAPÓ!».
  Then each crew's Mario Party ceremony on its phones: bonus stars «Mejor martillazo» (most bonks), «Mejor trampa» (most
  assists), «Mejor racha» (longest run of right answers, ≥ 3) → «¿Quién recuperó más palabras?» drum → the winner
  celebrates → my card (never a 0: «¡La próxima es tuya!»). Projector: each crew's ending (crab + Fénec), champion and
  stars, the **crews' leaderboard** (by their share of the target: a crew of 5 never wins by size), the class podium.

## Fénec (fair, beatable by a crew that covers his escapes)
- He notices a hammer falling on his spot after 120-400 ms and hops (300 ms) to a neighbour spot that no falling hammer
  threatens, preferring one without a loaded hammer's shadow; boxed in (both sides falling, or the edge) = bonked.
- A shadow lingering on his spot 0.65-1.3 s spooks him away; he wanders every 1.3-2.8 s; he never stands on a spot
  under a hammer once he has seen it. A lone surprise slam on him lands ~half the time (unit test: 59 %); a crew's real
  hit rate in the class simulation ~22 %, in the 30-bot playtest ~39 % (bots aim very precisely).
- **Target** per crew = 2.2 words × kids × (minutes + 0.5) (≥ 6): the class simulation (`node scripts/test-teamcrab.js
  --sim`) gives a careful crew of 3-4 (85 % right) the catch in 75-93 % of games with some teamwork, ~50-63 % without;
  a crew at 65 % ~0-10 %; a class of 30 at 80 % with a silent kid in 6 ~41 %.

## Timings (core/teamcrab.js R)
INTRO 2.6 s · question 15 s (late = wrong), < 0.5 s = blind · LOAD 6 s (first 9 s) · FALL 0.42 s · BACK 0.65 s ·
JAM 3 s · BONK 2 s (the quiz goes on; slams wait; the whole-phone gold flash at most every 6 s for a crewmate's bonk, mine and
my trap always) · a hammer that slammed by itself bonks for +1 only · SWING 1.8 s + KNOCK 3 s · HOP 0.3 s · words: bonk +2 (+4 in the
last 30 s), trampa +1, a miss −1 for the crew · anger +1 a miss, −0.25 a right answer in a row, 5 = swing (then 1) ·
FINAL 2.4 s · an 80 ms room tick.

## The slam + bonk side by side with the video (his rule «Never call it done unless it FEELS like Mario Party»)
Our slam filmed at 4 fps on Ana's phone (390×844) from her tap (`scripts/check-teamcrab-screens.js` → `final/slam-4fps/`),
next to the video's 7:39.5-7:42.75: `.claude/handoff/teamcrab-shots/side-by-side-slam-bonk.jpg`.
| Moment | The video | Ours | |
|---|---|---|---|
| The action | press A: a claw raises / slams a mallet | MY finger: touch Fénec (or drag over a spot + swipe down / «¡GOLPE!»); the hammer with my face comes down there | **we win** (a physical aim-and-slam on the screen) |
| Reading the threat | the raised mallets show where they'll fall | every loaded hammer hovers over its spot with its shadow on the planks (mine ringed gold), live from my crewmates' fingers | even |
| The fall | ~0.25-0.5 s, a heavy thud, a dust puff + pebbles | 0.42 s accelerating fall, thud (Higgsfield), dust puff + splinters, a shake (strong on the slammer's phone) | even |
| The hit | (Mario dodged every one) | «¡BONK!»: gold flash, rays, Fénec flat with dizzy stars, his words fly out to the cockpits, the bonker big over the top bar, «¡Tu trampa funcionó!» | **we win** (the hit is the big moment, on every phone of the crew) |
| The dodger | Mario runs into the gaps | Fénec reads the falling hammer and the shadows, hops away, taunts «¡No me atrapan!» with a giggle | even |
| The crew | 3 players, 2 hammers + the driver | 3-5 kids, a hammer each, trampas reward covering his escapes | **we win** (everyone acts) |
| Feedback for a miss | — | jam + smoke on my hammer, «¡Mías!» + giggle, the spark into El Péndulo | **we win** |
Nothing left in «we lose». Found and fixed while filming: the bonker's card first covered the crab's cockpits (now
over the top bar), the hovering hammers covered the faces (the cockpits now sit in a row across the crab's front window,
the hammers hover above them), the «¡BONK!» stamp covered him once he sat up (it goes when the words fly), the shadows
were too faint (darker, ringed), a bonk froze the quiz for 2.8 s (now 2 s and the quiz goes on).

## The ending side by side with the video (8:09.25-8:14.5)
`.claude/handoff/teamcrab-shots/side-by-side-ending.jpg` (caught) and `side-by-side-escape.jpg` (escaped,
`scripts/record-teamcrab-end.js`).
| Moment | The video | Ours | |
|---|---|---|---|
| The end | «FINISH!» on the screen | «¡FINAL!» (the shared Mario Party final) on every phone, with «¡Lo tienen!» / «¿Se escapa Fénec?» | even |
| The loser's fall | the crab clanks, falls apart in pieces in a puff | escaped: Fénec kicks the crab, it falls apart in a puff (crash + clank), hammers gone; caught: the crew's hammers trap him from both sides, bonk, every word flies out, he runs off «¡La próxima vez, Dralingo!» | **we win** (two endings, both comic) |
| The winner | Mario jumps and fist-pumps, «Mario Wins!» | «¡ATRAPADO! 🎉» / «¡SE ESCAPÓ! 😜» big on the stage, the crew cheers in the cockpits; then the ceremony (stars, the drum, the winner celebrating, my card) | **we win** |
Nothing left in «we lose».

## Peaks checked on every phone size (his rule: check the PEAK of every big moment)
`scripts/check-teamcrab-screens.js` (a whole 2-min game in headless Chrome: projector 1600×900 + phones 390×844, 360×640,
844×390, 1366×657 + a late joiner + bots that miss half their answers so El Péndulo swings): at the peak of every bonk
and big swing it measures that Fénec and every face of the crew are inside the screen and that nothing (the bonker's
card, the panel, the stamp, a bubble, the sound button) covers them; at the ending Fénec is inside the ceremony's stage.

## Files
`core/teamcrab.js` (rules, no sockets) · server.js «🦀 ¡ATRAPA A FÉNEC!» block (`tc*`) + `player:tc-*` / `host:tc-skip`
handlers · `public/host-teamcrab.html` + `js/host-teamcrab.js` · `js/player-teamcrab.js` + `js/teamcrab-stage.js` (the
beach, shared by the phone and the projector) · `css/teamcrab.css` · `public/assets/teamcrab/` (Higgsfield art
2026-10-23, 0 credits: the beach wide + square, the crab (body, hero, broken), the hammer, 8 Fénec poses, 5 Péndulo
poses; Canva animations `anim/fenec-idle` + `anim/pendulo-swing` (+ lite, still); sounds made with Higgsfield «Mirelo»
via Supercomputer, 5 credits: thud, clank, crash, tick, swing, slurp, giggle; music `music-beach.mp3` = Kenney «Night at
the Beach» ×3) · tests `scripts/test-teamcrab.js` (+ `--sim`), `scripts/test-teamcrab-live.js`, bot handler
`scripts/playtest/teamcrab.js`, `scripts/check-teamcrab-screens.js`, `scripts/check-teamcrab-lobby.js`,
`scripts/record-teamcrab-end.js`. Originals: `assets-library/higgsfield/2026-10-23/teamcrab/` (+ `-sounds/`),
`assets-library/canva/2026-10-23/`.

## Reviews (2026-10-23)
- **Code review** (agent-skills:code-reviewer, 9 findings, all fixed): a knocked hammer's question kept running out
  while hidden (now frozen); «¡Bolsa vacía!» could end as «se escapó» after later misses (caught is latched); the swing
  showed the failing kid's hammer idle (a jammed hammer looks knocked like the others, «never who failed»); the phone's
  load bar ran out early after a bonk; stale pause freeze and ceremony timers after «Otra ronda»; the projector redrew a
  crew from stale data; a rare double bonk after «Saltar» (moments end after the impacts); crews ranked by share, not
  size; ±30 s rescale the targets; test-wording covers the game's files.
- **Classroom playtester** (1 projector, 4 real-browser phones with real touches, 16 bots, two whole rounds: 0 frozen
  phones, 0 taps without a reaction, 0 page / console / HTTP / server errors; F5 back in 0.5 s, late joiner seated in
  0.8 s, pause / ±30 s / Saltar / Terminar / «Otra ronda» clean): fixed its findings: the card cut off at the top after
  «Saltar a las tarjetas» and on sideways phones, the lobby naming the wrong character for a phone with no avatar, the
  projector end keeping the last game's scroll, the guided hand tapping during a bonk, the in-game sound button and the
  reactions too small on small phones. Noted, not this game's code: a kid who arrives during the ending must tap
  «¡Entrar!» again for the next round (the shared join flow).

## Scorecard · ¡Atrapa a Fénec! · 2026-10-23 · branch `teamcrab`
```
Hard gates: bots PASS (30 kids · 2 min: 8 crews, 591 answers, 480 slams, 181 bonks, 42 trampas, 30 late, 131 jams,
            5 big swings, 0 frozen, 0 errors; silent bots 0 words vs careful 19-21; 20 kids · 60 s PASS) · teacher
            controls ✓ (Pausa, +30 s, −30 s, Saltar, Terminar, Sonido fully visible at 8 laptop / projector sizes incl.
            125 % / 150 % zoom: check-teamcrab-lobby 17/17) · saga only ✓ (our cast + his two villains, no logos) ·
            Spanish / pinyin without tones / the round's own words ✓ (test-wording) · kid-safe ✓ (cartoon bonk, nobody
            touches anybody, never names who failed, the villains comic)
1 Real place ........ 2/2  a Dubai beach with the sail hotel, palms and a wooden dock; the crab in the sea; the words
                           are won back and stolen there; the crab falls apart when he escapes
2 The gang .......... 2/2  every kid's face in their own glass cockpit and on their hammer; Fénec and El Péndulo speak
                           their cast.md lines; the gang cheers streaks on the phone and talks on the projector
3 Every tap ......... 2/2  «Así se juega» in 3 pictures + the villain on the lobby card, a hand guides the first slam,
                           touch Fénec = the hammer comes down there (or drag + swipe / «¡GOLPE!»), a press + sound on
                           every tap, the panel always names the next action (wait, jam, knock, «¡BAM!»)
4 Feedback .......... 2/2  a bonk (gold flash, «¡BONK!», dizzy stars, words fly, the bonker big, «¡Tu trampa
                           funcionó!»), a miss (smoke, «¡Mías!», the spark), the swing; the whole-phone flash at most every
                           6 s for crewmates' bonks, the projector's purple pulse at most every 7 s
5 Finale ............ 2/2  the sack meter fills toward the target, «¡Bolsa vacía!», the swing as the danger, «¡Atardecer
                           dorado!» ×2, «¡FINAL!», two endings (caught / he kicks the crab apart), stars, the drum, the
                           winner, my card; projector: crews by share + podium
6 Fair, no stall .... 2/2  only right answers load hammers; a hammer that slams by itself earns +1 (an aimed slam +2);
                           Fénec is beatable and reacts like a player (59 % for a lone surprise slam, boxed in = sure);
                           every wait has a timeout; late joiners and reconnects heal; never who failed
7 Product feel ...... 2/2  Higgsfield art (19 pictures) and sounds (7), Canva animations of both villains, a beach tune,
                           every phone size checked at the PEAK of every big moment (check-teamcrab-screens 37/37)
Total 14/14 → ships (≥ 12, no 0). For his ears: the 7 Higgsfield sounds and the beach tune (Kenney «Night at the Beach»).
```
Evidence: `.claude/handoff/teamcrab-shots/`: `final/` (a whole game at 390×844, 360×640, 844×390, 1366×657 + the projector,
the peaks of every bonk and swing per phone), `side-by-side-*.jpg`, `escape/`, `lobby/`, `playtester/`,
`bots-30kids-2min.json`, `full-suite.log` (42 test files + asset-guard, 0 failing).
