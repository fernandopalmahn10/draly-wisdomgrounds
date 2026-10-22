# «¡No despiertes a Dralingo!» (gameType `dormilon`) · spec

#3 of his Mario Party series (his video https://www.youtube.com/watch?v=y9BKCVx_mNk 6:14-7:29, Super Mario Party
«Don't Wake Wiggler»), his picks 2026-10-22. Status: v1 live 2026-10-22 08:37 (219cee484, sounds ab51bf2cc); **v2 «Gana
plumas, luego frota con el dedo»** built the same day on branch `dormilon-v2` (bundle), not deployed. v2 replaces the
turn below («Our version» keeps v1's text for the parts v2 did not change: the place, boards, the danger, the wake-up,
the clock, the ending); read «v2» first.

## v2 · «Gana plumas, luego frota con el dedo» (his pick 2026-10-22, after playing v1)
His words after playing v1: "it's not feeling like you are there in the game… you need to pet the dragon… you need to
feel like everything depends on you… once you have your turn, you interact with the screen and you have to do a
task." v1's turn was a quiz with a sleeping dragon on top (11-14 s of reading). v2 splits it the way the video does:
- **Between turns: the quiz earns feathers.** While the others of my board take their turns, I answer quick questions
  from the class pack, one after another (a right answer = one golden feather flies into my quiver, «+1 pluma 🪶»;
  a wrong one = «¡Casi! Era …», a short wait). Everyone starts with 3, the quiver holds 6. A streak of 3 / 5 / 8 / 12
  brings a gang cheer. My friend's turn plays LIVE above my quiz (his face, their feather moving, every «+1»).
- **My turn: his face fills my phone and I rub his head with my finger.** «¡Te toca!» lands while the camera moves in
  on his sleeping face (2.2 s; the friends guess «¿Se despierta?»), then «¡YA!» (the video's «START!») and a 6-s clock
  (9 s on my guided first turn), red at 3 with tick-tock. The golden feather follows my finger; each sweep across his
  head and back (≥ 36 px each way, on his head) = one tickle: +1 point (+2 in the last 30 s), one feather spent, a
  squish, sparks, «+1» by the feather, the woosh + pop + his sleepy giggle, a vibration, my score ticks in the board
  list. A scribble (tickles < 0.55 s apart) = «¡Despacio!» + a creak + danger ×2. Out of feathers = the turn ends
  safely («¡A salvo! +N · ¡Usaste todas tus plumas!», on screen ~1.8 s before the quiz comes back). «✋ ¡Me retiro!» any
  time. A turn with no feathers at all ends at once («¡Sin plumas! Responde para ganar más»). A laptop kid rubs by just
  moving the mouse over him (no button to hold). The finger may already rest on him during «¡Te toca!».
- **The guided first turn** (9 s): a hand rubs on his head (placed by code on every screen shape), the name bar says
  «Tu primer turno: ¡frota su cabeza con el dedo!»; after the 2nd tickle the hand moves to «¡Me retiro!» with «¿Otra más
  o te retiras? Si se despierta, ¡pierdes todo!»; it ends after 3 tickles («¡Así se juega!»: a later seat that comes with
  6 feathers gets no risk-free edge) and never wakes him.
- **Everyone watches it live**: the turn kid's feather position is relayed (~14 a second, volatile) to the board's
  phones and the projector; the projector shows each board's close-up during its turn. The friends' «¿Se despierta?»
  sits over the bottom of the stage (the quiz tiles below never move under a finger).
- **Every screen shape**: tall phones fill the height with his face (92 %, anchored at the bottom); wide views (a phone
  sideways, a laptop, a projector tile) fit his whole face (the ghutra to the beard) above the turn's bottom row, the
  blurred palace at the sides, «¡Me retiro!» a side button.
- **The danger stays hidden** (6-10 per kid of the board a night; a tickle +1, a scribble +2; the cues: louder snore →
  he stirs (the close-up changes) → «¡Casi se despierta!»): whoever is tickling when he wakes loses ALL their points.
  Guided first turns never wake him.

## v2 · the turn side by side with the video (his rule «Never call it done unless it FEELS like Mario Party»)
Frames of both at 4 fps: `scripts/record-dormilon-turn.js` films a kid's ordinary turn on a 390×844 phone (a real touch
finger through CDP, one tickle ≈ 0.8 s); the sheet `.claude/handoff/dormilon-shots/v2-side-by-side.jpg` (six matched
moments + our whole turn). Where each one wins:
| Moment | The video | Ours (v2) | |
|---|---|---|---|
| Turn starts | camera on Wiggler's face, «START!» | camera moves in on his face with «¡Te toca!», then «¡YA!» | even |
| The action | press A: a glove pats its head | MY finger rubs his head; the feather follows it | **we win** (a physical task on the screen) |
| A pat | glove pat, «+1», score ticks | squish + sparks + «+1» by the feather, giggle, vibration, score ticks | **we win** |
| The clock | 5 s pill, red at 3 | 6 s big count, red at 3 + tick-tock | even |
| Suspense | hidden; it fidgets | hidden; snore louder, he stirs, the chip and «¡Me retiro!» warm up, heartbeat | **we win** |
| Who's ahead | 4 faces + scores, arrow on the turn | 4 seats + scores + feathers, arrow on me | even |
| Waiting | watch | the quiz earns my feathers + the friend's turn live above it + «¿Se despierta?» | **we win** |
| Pace | ~1 pat/s, ~5 pats a turn | ~1 tickle a second (one back-and-forth), 5 in the filmed turn, 6 at most | even |
| Any screen | one TV | phone tall or sideways, laptop, projector: his face always in view | even |
Nothing left in «we lose». Found and fixed on the way: the first film had 2.3 s of bedroom + text before the close-up
and the danger chip under the name bar (now the close-up opens on «¡Te toca!» and «¡YA!» says the rest); the fresh-eyes
review found three more: a natural rub got «¡Despacio!» almost every time (each one-way sweep counted: now a stroke is a
real back-and-forth), sideways phones and laptops showed only the ghutra (now his whole face, «¡Me retiro!» at the
side), and «¡A salvo! +N» flashed for 0.7 s (now ~1.8 s before the quiz comes back).

## The clip (what we copy)
A sleeping Wiggler, close-up on its face, «Z»s floating. 4 players take turns of 5 s (a 5→0 countdown). On your turn
you pat its head as many times as you dare: each pat +1 (a glove with your face, «+1» pops). The score list (top-left,
4 faces, an arrow on whose turn it is) updates live. Every pat by anyone brings it closer to waking (hidden). Whoever is
patting when it wakes LOSES ALL their points: it turns red and angry, rays, «FINISH!», the highest score wins. ~54 s.

## Our version
- **Place**: a Chinese palace bedroom at night (Forbidden City style: red pillars, gold, lanterns, a round moon-gate
  window with the full moon). Dralingo (platform look) sleeps in a red-lacquered bed, snoring, «Z»s.
- **Boards of 4** (3 when it doesn't divide; ≤ 5 kids = one board; late joiners sit at the smallest board, max 5):
  the deal of `core/halcon.js`. Each phone shows its own board; the projector every board + the class top 3.
- **A turn** (board by board, in seat order): «Turno de Hamdan» (the kid tiptoes to the bed, 2.6 s, the others guess
  «¿Se despierta?») → the turn (11 s; a kid's first turn 14 s, guided): quick questions one after another from the
  class's pack (pinyin without tones, Spanish UI, no hanzi). **Every right answer = one stroke of the golden feather
  = +1 point** (+2 in the last 30 s). A wrong answer = Dralingo stirs (danger, no point; the right answer shows). The
  kid can stop any time with the big «¡Me retiro!» (points are already theirs). Time up = the turn ends safely.
- **The danger** (hidden): a wake limit per night, random per board in a fair range (4-7 per kid of the board: a
  board of 4 = 16-28); each stroke +1, each wrong answer +2. Cues rise (jittered per night, never the number):
  0 calm snore → 1 louder snore → 2 he stirs (one eye cracks open, the bed creaks) → 3 restless (wobbles, a star pops).
- **He wakes up** when the danger reaches the limit: the kid holding the feather **loses ALL their points** (score → 0,
  its own sound): Dralingo bolts up with a pillow, ghutra messy, funny-grumpy (kid-safe), rays, «¡Se despertó!»
  (3.6 s) → «Dralingo se vuelve a dormir… Noche N» (2.4 s, new hidden limit) → the next kid's turn. Scores of the
  others stay.
- **Guided first turn**: each kid's very first turn shows the coach card («Responde bien = una cosquilla. ¡Pero no lo
  despiertes!»), a hand on the answers, and after the first stroke «¿Otra o te retiras?» pointing at «¡Me retiro!».
  During a guided turn he never wakes and the danger stops at the first cue (no guess then; see As built).
- **Never a dead phone** (watchers): the turn plays LIVE on every phone of the board (the kid's full-body character
  tiptoeing by the bed, the feather strokes, «+1», the stir, the question being answered with ✓/✗); before each turn a
  big «¿Se despierta?» guess (😴 No / 😱 ¡Sí!, open until 2 s into the turn; a right guess = «¡Adivinaste!» and counts
  for the «Mejor adivino» star, never points); reaction buttons (🤫 😱 😂 👏) float over the board (1 per 1.2 s).
  «Tu turno: después de Aileen» says when mine comes.
- **The clock**: 3 / 4 / 5 min (default 4). Teacher: «⏸ Pausa», «+30 s», «−30 s» (never ends the game; landing in the
  last 30 s starts that moment), «⏭ Saltar» (every board's current moment ends now), «⏹ Terminar», «🔊 Sonido».
- **Last 30 s**: «¡Luna llena! Cosquillas dobles» (+2 a stroke) on every screen, the music speeds up.
- **The end**: the clock → a turn in progress ends safely → «¡FINAL!» (2.4 s) → each phone its board's Mario Party
  ceremony: the bonus stars one by one (honours, never points): «Más valiente» (most strokes in one turn, ≥ 2),
  «Más prudente» (most safe turns with strokes, never woke him), «Mejor racha» (longest run of right answers, ≥ 3),
  «Mejor adivino» (most right guesses, ≥ 2) → «¿Quién gana tu tablero?» drum → the winner celebrates in the bedroom
  (sleeping Dralingo behind: «¡shhh!») → my card (my character, my points, my stars, my place; nothing to show =
  «¡La próxima es tuya!»). Projector: each board's champion + the class top 3 podium + «Otra ronda».
- **Ranking**: points, then strokes in total, then fewer wakes, then the earlier seat. A winner needs > 0 points.

## Edge cases
- The turn kid's phone drops: in «Turno de…» the turn waits 3 s, then is skipped («X no está: sigue Y»); mid-turn the
  turn ends 3 s after the drop (points stand). A board with nobody connected idles until someone comes back.
- A board shrinks to 2 or 1 (kids left): it keeps playing (a board of 1 plays alone; the limit range counts ≥ 2 kids).
- Late joiner: sits at the smallest board, last in its turn order, joins the next turn cycle.
- Reload / reconnect: the stable key (`p.dmK`) keeps the seat, points and board; `dm:init` re-sends the board, the open
  question (same qid, the time really left) for the turn kid.
- One name, one device: `_slotByName` (server.js) as every game.
- Pause: every deadline moves by the paused time. «Terminar» while paused: «¡FINAL!» at once.
- A double tap / stale answer: answers carry the qid; another qid or < 300 ms after the question = ignored.

## Timings (core/dormilon.js R)
INTRO 2.6 s · PRE 2.6 s · TURN 11 s (first 14 s) · after an answer the next question 0.65 s later · POST 1.6 s ·
WAKE 3.6 s · NIGHT 2.4 s · DROP 3 s · FINAL 2.4 s · last 30 s ×2.
**v2**: PRE 2.2 s · TURN 6 s (first 9 s) · feathers start 3, max 6 · the next quiz question 0.6 s after a right
answer, 1.4 s after a wrong one, replaced after 25 s unanswered · a tickle closer than 0.25 s to the last = noise,
closer than 0.55 s = a scribble · POST 1.5 s · limit 6-10 per kid of the board.

## Files
`core/dormilon.js` (rules, no sockets) · server.js «NO DESPIERTES A DRALINGO» block (`dm*`) · `public/host-dormilon.html`
+ `js/host-dormilon.js` · `js/player-dormilon.js` + `js/dormilon-stage.js` (the bedroom, shared by phone and
projector) · `css/dormilon.css` · `public/assets/dormilon/` (Higgsfield art 2026-10-22, 0 credits; sounds) · tests
`scripts/test-dormilon.js`, `scripts/test-dormilon-live.js`, bot handler `scripts/playtest/dormilon.js`.
v2 adds: `closeup-sleep|stir|awake.webp` (his face on the pillow, aligned crops of the same Higgsfield originals,
0 credits), `giggle-h1..3.mp3` (his sleepy giggle, Higgsfield Mirelo through Supercomputer, 3 credits for 6 takes, one
kept) and the 4-fps turn film `scripts/record-dormilon-turn.js` (the real-browser check `scripts/check-dormilon-screens.js`
now rubs on its phones' turns and answers their quiz).

## As built · 2026-10-22 (branch `dormilon`, not deployed)
- **Wording**: «cosquilla» (a tickle with the golden feather), not «caricia»: the review read «caricias» on a sleeping,
  mustached Dralingo in bed as something a parent could take the wrong way; the feather tickle is also why he stirs.
- **Guided first turns** never wake him and never push him past the first cue (the danger they add stops at cue 1; the
  limit never moves). The first build moved the limit just past the danger, which left the next kid a «time bomb»
  (run3: both boards' first kid woke him on their second turn). No «¿Se despierta?» guess on a guided turn: the friends
  read «👀 Primer turno de X: ¡mira cómo se juega!».
- **The danger under the thumb** (my turn): «¡Me retiro!» warms with the cue (gold → orange → pulsing red), a heartbeat
  + vibration at «¡Casi se despierta!», the music steps back to 0.1 during my turn (`KingdomsSkin.musicVol`), the snore
  gets louder with the cue (0.32 → 0.6).
- **The gang speaks**: the projector's side shows one of the gang whispering at each turn (at most every 6 s, their own
  voice, Aileen in voseo) and Dralingo's funny-grumpy line when woken (also a speech bubble by his head on every phone).
- **Watchers**: the question live with ✓ / ✗ and «¿Tú qué dirías? Toca (sin puntos)» (their own pick, marked when the
  turn kid answers), the guess before the turn, 🤫 😱 😂 👏 floating over the bed, «Tu turno: después de X».
- **The phone ceremony**: «¡FINAL!» (shared `DralyParty.final`) → the bonus stars → «¿Quién gana tu tablero?» with every
  kid and no scores (the suspense) → the winner tiptoes in by the bed with «¡Shhh! 🤫» and confetti (nobody won: he
  bolts up on stage) → my card: never a «0» («¡La próxima es tuya!», and «Tenías N puntos… ¡y lo despertaste! 😱» when
  that is what happened). A phone seated too late (joined during «¡FINAL!») gets «¡Se acabó la noche! Mira el
  proyector». «Saltar a las tarjetas» on the projector jumps every phone to its card.
- **Sound**: Kenney «Mishief Stroll» (night loop), Kenney foley woosh + pluck (the tickle), RPG creaks (he stirs), the
  platform's pop / aww / lose / tick / hurry / sting. **Sounds pass 2026-10-22** (his rule «Higgsfield also makes you
  audio»): the snores and the wake-up are Higgsfield sound effects (Mirelo, through Higgsfield Supercomputer; 9 credits
  for 15 takes): `snore-h1.mp3` (a rattling snore + soft breathing, 4.0 s, one breath per replay), `snore-loud-h1.mp3`
  (a puff + a big rattling snore, 2.5 s, the danger cues), `wake-h1.mp3` (a rising cartoon whistle «fwee-UP?!» into a
  bright gong, 1.8 s, no voice). New names, so no phone or Cloudflare keeps the old noise snores. Originals and the
  takes not used: `assets-library/higgsfield/2026-10-22/dormilon-sounds/` (its `web-alternates/` holds Higgsfield
  creaks and a swish, weaker than the recorded Kenney ones in the game: his ears decide). Loudness matched to the
  files they replaced (−21.9 / −17.7 / −15.7 LUFS).
- **Every size**: phone 390×844 and 360×640, sideways 844×390, laptop 1366×657, projector 1600×900 and 1366×657 checked
  in a real browser (`scripts/check-dormilon-screens.js`, a whole game played, 22 checks + 64 shots each run). The
  platform's «🔊 Sonido» sits in the bedroom's corner during the game (never over the tiles or «¡Me retiro!»).
- **Tuning** (class simulation in `scripts/test-dormilon.js --sim`, kids answering in 1.6-3.8 s, 80 % right): a kid who
  never stops gets ~2.4 tickles a turn and his board wakes him ~1.7 times in 4 min; careful kids (stop after 1-2 or when
  he stirs) never wake him; a mixed board ~1 wake-up and ~19 turns in 4 min.

## Scorecard · ¡No despiertes a Dralingo! · 2026-10-22 · branch `dormilon`
```
Hard gates: bots PASS (20 kids · 60 s and 30 kids · 150 s: all joined, 0 frozen, 0 errors, 17 wake-ups checked) ·
            teacher controls ✓ (Pausa, +30 s, −30 s, Saltar, Terminar, Sonido; a dropped turn kid is skipped after 3 s) ·
            saga only ✓ · Spanish / pinyin without tones / level words from the class pack ✓ (test-wording) ·
            kid-safe ✓ (a feather, nobody touches anybody; «cosquillas»)
1 Real place ........ 2/2  a Chinese palace bedroom (moon gate, lanterns); the bed IS the game: points won and lost there
2 The gang .......... 2/2  every kid plays as their full-body cast character tiptoeing with the feather; the gang whispers
                           at the turns, Dralingo speaks when woken; the winner tiptoes in by the bed at the end
3 Every tap ......... 2/2  «Así se juega» in 3 pictures (phone + projector), the guided first turn (coach card + hand on the
                           tiles, then on «¡Me retiro!»), a press + sound on every tap, the watchers' own pick, reactions
4 Feedback .......... 2/2  a tickle (feather sweep, «+1», woosh + pop), a stir (wobble, creak, the right answer shown),
                           the wake-up (bell, rays, shake, his line) is naturally rare (~1.7 per board per 4 min)
5 Finale ............ 2/2  cues rise to «¡Casi se despierta!», «¡Luna llena!» ×2 in the last 30 s, «¡FINAL!», bonus
                           stars → the drum without scores → the winner by the bed → my card; projector champions + podium
6 Fair, no stall .... 2/2  points only from right answers; going first is never punished (guided turns stop at cue 1);
                           drops skipped after 3 s; late joiners seated; «Terminar»/pause/clock work mid-turn
7 Product feel ...... 1/2  premium Higgsfield art, Kenney music, every size checked; the snore (the game's danger sound)
                           is synthesized from noise until he hears it / we record one
Total 13/14 → ships (≥ 12, no 0). To 14: a recorded snore he likes.
```
Sounds pass 2026-10-22: the snore is now a real recorded-style snore made on Higgsfield (see «Sound»); area 7 goes to
2/2 (14/14) once he has heard it and likes it.
Evidence: `.claude/handoff/dormilon-shots/run4/` (+ run1-3), `scripts/test-dormilon.js` (107 checks),
`scripts/test-dormilon-live.js` (38 checks), `scripts/playtest/dormilon.js`, the fresh-eyes review 2026-10-22 (11/14
before its fixes: the sideways ending, the guided-turn time bomb, «+N» strokes vs points, the «0» card, the ending's
suspense, the paused clock, the guess refusal, stale wake-up visuals, the late card, the lobby board count).

## Scorecard · v2 «Gana plumas, luego frota con el dedo» · 2026-10-22 · branch `dormilon-v2`
```
Hard gates: bots PASS (20 kids · 60 s: 54 turns, 111 tickles, 285 quiz answers, 0 frozen, 0 errors; 30 kids · 150 s:
            236 turns, 339 tickles, 8 wake-ups, 1074 answers, 0 frozen, 0 errors) · teacher controls ✓ (Pausa, +30 s,
            −30 s, Saltar, Terminar, Sonido; a dropped turn kid ends the turn after 3 s) · saga only ✓ · Spanish /
            pinyin without tones / level words from the class pack ✓ (test-wording) · kid-safe ✓ (a feather tickles
            his head; nobody touches anybody)
1 Real place ........ 2/2  the palace bedroom; on my turn the camera is on his face on the pillow, the bed is where
                           points are won and lost
2 The gang .......... 2/2  full-body cast tiptoeing before each turn, the gang whispers (Aileen in voseo) and cheers quiz
                           streaks, Dralingo's sleepy giggle on every tickle and his lines when woken
3 Every tap ......... 2/2  «Así se juega» in 3 pictures, the guided first turn (a hand rubs on his head, then points at
                           «¡Me retiro!»: «¿Otra más o te retiras?»), my FINGER is the action (or the mouse on a laptop),
                           the feather follows it, every quiz tap answers with a flying feather
4 Feedback .......... 2/2  every tickle: squish, sparks, «+1» by the feather, woosh + pop + giggle, a vibration, my score
                           ticks; a scribble wobbles «¡Despacio!» with a creak; the wake-up (whistle + gong, he bolts up)
5 Finale ............ 2/2  «¡Te toca!» → «¡YA!» → a 6-s count red at 3 with tick-tock, cues rising, «¡Luna llena!» ×2,
                           «¡FINAL!», bonus stars → the drum → the winner by the bed → my card; projector podium
6 Fair, no stall .... 2/2  feathers only from right answers, points only from real tickles with a feather; guided turns
                           take 3 tickles and never wake him (no seat edge); drops end the turn after 3 s; late joiners
7 Product feel ...... 2/2  Higgsfield art (his face on the pillow aligned across sleep / stir / awake) and sounds, every
                           screen shape checked in a real browser (his face in view sideways and on laptops), the turn
                           filmed at 4 fps beside the video's with nothing left in «we lose»
Total 14/14 → ships (≥ 12, no 0). For his ears: the giggle (a soft child's giggle cut from one Higgsfield take).
```
Evidence: `.claude/handoff/dormilon-shots/v2-side-by-side.jpg` + `turn-4fps/` (the film), `v2run2/` (a whole game in
headless Chrome at 390×844, 360×640, 844×390, 1366×657 + projector 1600×900 / 1366×657: 26/26 checks, 75 shots),
`scripts/test-dormilon.js` (99 checks + class simulation), `scripts/test-dormilon-live.js` (44 checks), the bots above,
the fresh-eyes review 2026-10-22 (10/14 before its fixes: the rub count, wide close-ups, guided-turn seat edge and
coaching, the short «¡A salvo!», the jumping guess box, the mouse, v1 wording, a re-sync in «¡Te toca!», the band) and
its verdict pass (all 10 fixed; one new: the open «¿Se despierta?» stayed over a quick wake-up, fixed → 14/14);
`v2run3/` = the whole game again after the last fix (26/26).
