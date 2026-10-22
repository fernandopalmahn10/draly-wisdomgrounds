# «¡No despiertes a Dralingo!» (gameType `dormilon`) · spec

#3 of his Mario Party series (his video https://www.youtube.com/watch?v=y9BKCVx_mNk 6:14-7:29, Super Mario Party
«Don't Wake Wiggler»), his picks 2026-10-22. Status: built 2026-10-22 on branch `dormilon` (bundle), not deployed.

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

## Files
`core/dormilon.js` (rules, no sockets) · server.js «NO DESPIERTES A DRALINGO» block (`dm*`) · `public/host-dormilon.html`
+ `js/host-dormilon.js` · `js/player-dormilon.js` + `js/dormilon-stage.js` (the bedroom, shared by phone and
projector) · `css/dormilon.css` · `public/assets/dormilon/` (Higgsfield art 2026-10-22, 0 credits; sounds) · tests
`scripts/test-dormilon.js`, `scripts/test-dormilon-live.js`, bot handler `scripts/playtest/dormilon.js`.

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
