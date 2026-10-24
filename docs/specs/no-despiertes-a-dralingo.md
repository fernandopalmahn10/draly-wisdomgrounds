# «¡No despiertes a Dralingo!» (gameType `dormilon`) · spec

**Name since 2026-10-23: «Draly Siesta · ¡No despiertes a Dralingo!»**, short «Draly Siesta» (the «Draly Party» names, his «Approve all»; `core/game-names.js`). The text below keeps the name it had when it was written.

#3 of his Mario Party series (his video https://www.youtube.com/watch?v=y9BKCVx_mNk 6:14-7:29, Super Mario Party
«Don't Wake Wiggler»), his picks 2026-10-22. Status: v1 live 2026-10-22 08:37 (219cee484, sounds ab51bf2cc); v2 «Gana
plumas, luego frota con el dedo» live the same day (6254b16c9, giggle d774da097: "it feels more interactive now");
**v3** (his picks 15:44: random early wake-ups, 2 minutes, an ANGRY wake-up on every screen, a wrong or late answer
costs, the projector lobby fixed) live 2026-10-22 evening (a0388210b). **v4** (2026-10-24, the Windows rhythm: everyone
tickles at once, frequent wake-ups, robots) live 2026-10-24 (59d5e5127; he liked it); **v4.1** (one unit, the feather: no
coins, no tower) on branch `dormilon-v41` (bundle), not deployed. Read «v4.1», then «v4», «v3», «v2»; «Our version» keeps v1's text for what none changed (the place, boards, the clock).

## v4.1 · one unit, the feather (2026-10-24, after he played v4 live and liked it)

His words: "you don't need to make things that don't make sense within the game. You're not building a tower, you're
collecting golden feathers. If you don't wake him up, then you indeed get the feathers. At the end, who has most
feathers wins. It makes sense to the game theme." (his new rule «Everything belongs to the game's story», CLAUDE.md).
- The feathers a kid earns by answering are what they tickle with. Each tickle that doesn't wake him moves that feather
  into the kid's own collection «Tus plumas»: a pile of golden feathers on a dark plate by the kid's face (this round's
  glow until kept), the feather flies from the hand slots into the pile with a soft pop; 2 a tickle in the final round.
- Waking him: the feathers the waker collected THIS round fly away out of the pile («fsss», «−N 🪶 ¡Se volaron!»).
- «🪶 ¡Guardar mis plumas!» (was «¡Me retiro!») keeps this round's feathers; the first play window where a kid has some,
  one line: «Guárdalas y nadie te las quita esta ronda». Kept: «✓ ¡Plumas guardadas!»; nothing in the hand: «Sin plumas».
- The top rows (phone and projector) show each kid's feathers collected «🪶N» and this round's «+N»; the tally «+N 🪶 ·
  Tus plumas: N · en la mano: N»; the reveal «¿Quién juntó más plumas?» (columns of golden feathers rising side by side);
  the stars 🪶 Mejor ronda (plumas en una ronda), 🛡️ Más prudente (rondas guardadas), 🦁 Más valiente, 🔥 Mejor racha;
  the card «Tus plumas: N 🪶»; the projector's lists, labels, podium and champions in feathers.
- No coin or tower left in this game (art, words, sounds): the coin clink and the crash are gone; sounds reused (0
  credits): the feather stroke (stroke.mp3), a soft pop as a feather lands (halcon/pop.mp3), «fsss» as they fly away
  (lose-feather-h1.mp3).
- Everything else of v4 stays: the rhythm, the wake odds, waker-only loss, the robots, little on screen, the ×2 final round.
- Proof: `dormilon-shots/v41b/` (4 phone / laptop sizes + the projector: the play window, the pile growing, a wake-up
  taking the round's feathers, the kept feathers by a REAL tap on «Guardar mis plumas», the final reveal, the card).

## v4 · the Windows rhythm: everyone tickles at once, coin towers, frequent wake-ups, robots (2026-10-24)

His words after playing v3: "it just lacks that Mario Party minigame feeling… how do you get all the kids involved… very
little window time to answer questions… every time you use the feather nothing happens… when it's your turn, you
build, construct, and at the end you see who wins… sometimes leave a window for questions and then after 10 seconds
people play… make all games playable with robots… not too many things on the screen… the dragon needs to awaken more
often". Branch `dormilon-v4` (bundle), not deployed.

- **Rhythm = windows** (his rule «Two rhythms», core/teamcrab.js's machinery): class-wide rounds, ~4 in 2 minutes.
  QUESTION WINDOW (12-20 s, everyone at once; a question has 12 s and never outlives its window: withdrawn free): a right
  answer = a golden feather (max 4, unused ones stay for the next round); a wrong, late or blind (< 0.5 s) answer = a
  feather flies off («fsss») and he shifts in his sleep (the board's danger +1, no roll; never who). On screen only the
  question and my 4 feather slots, the bedroom asleep above.
- «¡A hacerle cosquillas!» (1.6 s, the camera moves in) → PLAY WINDOW (10 s): EVERY kid of the board rubs his face at
  the same time on their own phone. One back-and-forth rub = one feather → +1 coin on MY tower (it jumps, «clink»;
  +2 in the final round ×2); he giggles, squirms or his snore bubble pops; my friends' tickles land live on his face
  (their head + a feather + «+1»), their towers grow in the top row («🪙 chest +N this round»). On screen: his face, the
  10-s count, my tower, my feathers, «✋ ¡Me retiro!».
- **The danger**: each tickle (a scribble = 3) is a roll of the board's shared dice, whose chance grows with every
  tickle since he fell asleep (the danger stays from one window to the next while he sleeps); his face says how risky
  it is (snores louder, an eye cracks open, he trembles), never a number. Each kid's first tickle of the game is safe
  (the guided window: a hand shows the rub, «¡Frota su cabeza! Cada cosquilla = +1 🪙», then «¿Otra más o "Me
  retiro"? Si lo despiertas tú, ¡se cae tu torre!»).
- **He wakes** → the WAKER's tower of this round falls (the coins fly off the phone, «−N 🪙 😱», a crash), the ANGRY
  wake-up floods every phone of the board (v3's rage), «¡X lo despertó!» on the board; then «¡Se durmió! ¡Sigue!»: a new
  night (danger 0) and the window goes on. The window's clock stands still while he rages (each board is owed the
  rage's time, at most two wake-ups' worth; the class window lasts until the latest board's make-up time).
  Why only the waker's tower (decided by the simulation, 2026-10-24 09:20): with «every tower not in the safe falls»,
  rubbing fast and finishing first beat careful play (luck and speed over skill); with the waker's only, the kid who
  stops when his face says «careful» wins (the risk is the one I choose with each stroke: his «Skill decides»).
- «¡Me retiro!» (or my last feather) puts my tower in the safe for the round; a board where everyone is done gets its
  tally at once (no still seconds while other boards play); the window's end banks every standing tower → the tally
  card «+N 🪙 · Tu cofre: N».
- The end: «¡FINAL!» → the board's bonus stars (🏯 Torre más alta, 🛡️ Más prudente, 🦁 Más valiente, 🔥 Mejor racha) →
  «¿Quién construyó la torre más alta?»: every tower rises side by side, the numbers counting up (the build, then the
  reveal) → the winner by the bed → my card. The projector: every board (bedrooms in the question window, close-ups in
  the play window with every tickle landing, each kid's coins + this round's tower), the champions and the podium.
- **«🤖 Probar con robots»** (his rule 2026-10-24, the pattern of core/teamcrab.js): a teacher-only lobby button
  (`host:dm-robots`) seats 3 robots (🤖 Robi, Roba, Robo) beside a board of 1-2 phones: they answer at 70 %, rub at a
  kid's pace, wait a moment after he falls asleep, bank when his face says «careful»; marked 🤖, never ranked, starred,
  on the podium, the class list or paid (their towers stand grey beside the reveal).
- Kept from v3: the ANGRY wake-up on every screen, «a wrong or late answer always costs», the projector lobby that fits
  and scrolls, 2 / 3 / 4 min (default 2). El Péndulo: not added (one threat per game: the sleeping dragon is the clock;
  a second villain would put more on the screen).

### The simulation (`node scripts/test-dormilon.js --sim`, 2-minute games, 12 and 28 kids, 8 seeds each)
- Average kids (70 % right, stop at a height they picked or when his face says «careful»): he wakes in **70 % of the
  play windows after the first** (15 % of the first, the lesson), **3.2 wake-ups per board** in a 2-minute game, ~4
  rounds, 4.8 questions per kid per question window.
- **Skill decides** (a board of 4 mixed kids): careful (90 %, gentle, stops when his face says «careful») **9.7 coins** ·
  average 6.3 · greedy (scribbles, never stops) 5.5 · random tapper 1.3 · a kid who never answers 0.
- The 30-bot class (`scripts/playtest-bots.js --game dormilon --bots 30 --seconds 120`): careful bots 9.0 · normal 8.6 ·
  greedy 7.5 · silent 0; he woke in 22 of 32 board windows.

### The play window side by side with the video (his rule «Never call it done unless it FEELS like Mario Party»)
`.claude/handoff/dormilon-shots/v4-side-by-side.jpg` (the original's frames from the saved v2 / v3 sheets: the video in
the scratchpad was emptied by the PC's cleanup), our whole play window at 4 fps in `dormilon-shots/v4e/turn-frames/`
(Ana rubs 2 coins, wakes him with the 3rd: «−2», her tower flies, the rage, «¡Se durmió! ¡Sigue!», she rubs 2 more,
«¡A salvo! +2», her board is done: the tally at once).
- Where we win: everyone plays at the same time (Mario Party: one plays, three watch); each tickle builds MY tower that
  I see grow, and my friends' tickles land live with their faces; he reacts to every tickle (giggle, squirm, snore
  bubble; Wiggler stays still); the wake-up knocks MY tower down on top of the red fury, and the window waits for it;
  the round ends with my «+N · Tu cofre» and the game with every tower rising side by side.
- The same: «START!» ↔ «¡A hacerle cosquillas!» with the camera on his face; the count red at 3 with tick-tock; the
  angry wake-up (ring, lines, steam, shake, his line).
- Where we lose: nothing left. (Found and fixed on the way: a phone standing still for 5 s after banking → the board's
  tally comes as soon as the board is done; a wake-up eating the window → the window waits; the guided first window
  waking him at once → each kid's first tickle is safe; the tower too small to see → a big tower on the left.)

### Scorecard · v4 · 2026-10-24 · branch `dormilon-v4`
```
Hard gates: bots PASS (30 kids · 2 min: 8 boards, 4 rounds, 430 answers, 241 tickles, 632 of them within a second of a
            friend's, 38 wake-ups, 39 «¡Me retiro!», 10 late, 47 feathers lost, 0 frozen, 0 errors; the playtester's 20 and
            30 kids PASS) · teacher controls ✓ (Pausa, +30 s, −30 s, Saltar, Terminar, Sonido, «🤖 Probar con robots»;
            the lobby keeps PIN, QR, time, «¡Empezar!» and the robots on the first screen at 8 sizes: 20/20) · saga only
            ✓ · Spanish / pinyin without tones / level words ✓ · kid-safe ✓ (funny-angry, a miss never names anyone)
1 Real place ........ 2/2  the palace bedroom while they answer, his face on the pillow while they tickle, the angry close-up
2 The gang .......... 2/2  every friend's face lands on his face with each tickle; the cast whispers; his funny-angry lines
3 Every tap ......... 2/2  a tickle: my tower jumps with a clink, he giggles / squirms / his bubble pops; a right answer
                           flies a feather in, a wrong / late one flies it out («fsss»)
4 Feedback .......... 2/2  the waker's tower falls (coins fly, «−N»), the ANGRY wake-up on every phone of the board; the
                           tally card «+N · Tu cofre»; the top row shows every chest and this round's towers live
5 Finale ............ 2/2  the final round ×2, «¡FINAL!», bonus stars (Torre más alta, Más prudente, Más valiente, Mejor
                           racha), the towers rising side by side, the winner by the bed, my card
6 Fair, no stall .... 2/2  skill decides (sim: careful 9.7 > average 6.3 > greedy 5.5 > random 1.3; silent 0), only the
                           waker's tower falls, each kid's first tickle safe, the window waits for a wake-up, a board done
                           gets its tally at once, robots never count, 0 frozen phones
7 Product feel ...... 2/2  every kid in every moment (all rub at once), little on screen (QW: question + 4 feathers; PW:
                           face + count + tower + feathers + «¡Me retiro!»), the play window filmed beside the video:
                           where we lose, nothing
Total 14/14 → ships (his try first: nothing goes live without his word).
```
Evidence: `scripts/test-dormilon.js` (99 checks + the simulation), `scripts/test-dormilon-live.js` (60 checks, robots
included), `scripts/check-dormilon-screens.js` (37/37: 5 phone / laptop sizes + the projector, every moment and its peak:
`dormilon-shots/v4e/`), `scripts/check-dormilon-lobby.js` (20/20), the bots above, the classroom playtester (robots
scenario + a class of 12 with reloads, a late joiner, every teacher button: PASS; its 9 findings fixed) and a fresh-eyes
code review (no blockers; its 11 findings fixed).

## v3 · random wake-ups, 2 minutes, he wakes up ANGRY, a wrong answer costs (his picks 2026-10-22 15:44)
His words after playing v2: "it's okay if the round ends randomly… someone awakens the dragon in the first round… you
don't need to wait for the whole 3 or 4 minutes… 3 minutes is a lot… in 2 minutes it can wake up randomly twice…
suspense, the dragon wakes up and you never know when"; "whenever the dragon wakes up, you get red that keeps angry,
red things follow around the screen… make it feel like he's angry… that's what Mario does really good, the
feelings"; "make the whole point of the game make sense, you somehow get punished if you don't answer correctly / in
time"; and the projector lobby "the button gets lost… it's unscrollable… you cannot find the button to press start".
- **The wake-up is a dice roll** (no hidden number any more): every danger unit (a tickle +1, a scribble +2 = two
  rolls) wakes him with a chance of HAZ_BASE + HAZ × the danger since he fell asleep (1 % + 0.25 % a unit, at most 30 %).
  A wrong or late quiz answer of anyone on the board makes him shift in his sleep (danger +1, never a roll: only the
  kid tickling can wake him). Class simulation, 2-minute games, boards of 4 with mixed kids: **2.25 wake-ups a board**
  (0: 7 · 1: 8 · 2: 18 · 3: 20 · 4+: 7 of 60 boards), **28 % wake him in the very first round of turns**, greedy boards
  3.0, careful 0.2. The cues follow the chance (jittered per night): louder snore at 2.5-3 %, he stirs at 4.5-5.5 %,
  «¡Casi se despierta!» at 7-8 %: they say «riskier», never «safe».
- **Only each board's very first turn of the game is safe** (it shows how to play: 3 tickles at most, no guess). Every
  other turn can wake him, a kid's own first turn too (it is still guided: the hand on his head, then on «¡Me retiro!»).
- **2 minutes by default**: the lobby offers 2 / 3 / 4.
- **A wrong or late answer always costs** (his standing rule): a wrong answer, a question left to run out (15 s, a
  draining time bar on the question, red near the end) or a blind tap (< 0.5 s after the question went out: a guess)
  makes a feather fly OUT of the quiver with a «fsss» (Higgsfield), my head shakes sad 😖 with «¡Casi! Era …», and he
  shifts in his sleep on every phone of the board and the projector («¡Dralingo se movió! 😬», never who failed, a
  creak; on the turn kid's phone «¡Se movió!»). The time bar is drawn from the question's own deadline (a repaint, the
  pause or the wake-up never refill it; the server allows 300 ms of grace), and only a question the phone really showed
  on a visible screen can run out and cost (`player:dm-seen`): a pocketed, locked or dropped phone loses nothing. A tap
  in the first 0.35 s of a new question is ignored on the phone (a double tap meant for the last one). Bots prove it:
  a bot that never answers ends far below a careful one (30 kids · 2 min: 2.4 vs 6.3 points; 20 kids · 60 s: 3.0 vs
  5.6; class simulation: 2.8 vs 4.9).
- **He wakes up ANGRY on every screen, ~4 s** (the video's red Wiggler): his close-up turns into the angry Dralingo
  (Higgsfield, 0 credits: face and ears tomato red, angry brows, steam puffs, an anger mark), the WHOLE phone floods red
  (a pulsing vignette, the quiz panel steps aside so his face fills the phone, the board's quiz waits on the server),
  a jagged white burst ring pulses on his face every 0.5 s, speed lines fly in from the edges, steam puffs and red
  sparks move around, 💢 marks pop, a camera push-in and a strong shake, «¡Se despertó!» under his face, his funny-angry
  line («¡¿QUIÉN ME DESPERTÓ?! ¡Soñaba con dumplings! 🥟», «¡Te vi con esa pluma! 😠»…), the whistle-and-gong then his
  growl (Higgsfield), and on the waker's phone «−N 😱» lands on his face while their score drops to 0. The projector:
  the board's tile takes the same rage and the whole projector pulses red. Then he calms back to night («Noche N»).
  Transform / opacity only; reduced motion keeps the red and the angry face, still.
- **The projector lobby fits and scrolls**: the PIN + QR, then the time and «¡Empezar!» right under them (the pictured
  steps after), a compact head on short windows, and the page scrolls by wheel when it is taller. Checked at 1366×657,
  1280×720, 1440×900, 1600×900, 1920×1080 and zoomed 125 % / 150 % (`scripts/check-dormilon-lobby.js`: 19/19, the
  in-game toolbar with «−30 s» fully visible at every size too). Before: at 1366×657 zoomed 125 % «¡Empezar!» was below
  the window and the page did not scroll (his bug).

## v3 · the wake-up side by side with the video (7:18-7:22)
Our wake-up filmed at 4 fps on Ana's phone when SHE wakes him (`scripts/record-dormilon-wake.js`), next to the video's
loose frames: `.claude/handoff/dormilon-shots/v3-wake-side-by-side.jpg` (six matched moments + our whole wake-up).
| Moment | The video | Ours (v3) | |
|---|---|---|---|
| It comes | after one pat, no warning | any tickle (1 % on the first, more with every tickle); often in the first round | even |
| The colour | Wiggler instantly maroon-red, glowing angry eyes | his close-up instantly the angry red Dralingo, steam, anger mark | even |
| The takeover | white burst ring + speed lines, push-in, shake, steam (~5 s) | the same + the whole phone floods red, sparks and 💢 fly around, his growl (~4 s) | **we win** (his «red that keeps angry») |
| The loss | the waker's score 10 → 0 on the same frame | the waker's score → 0 on the same frame + «−N 😱» on his face + «¡Lo despertaste! Pierdes tus N puntos» | **we win** |
| His word | «FINISH!» stamped on the face | «¡Se despertó!» under his face + his funny-angry line in a bubble | even |
| Where | one shared TV | every phone of the board (the waker's and the watchers', the panel steps aside) + the projector tile and a red pulse | **we win** |
| After | the game ends | he calms back to sleep, a new night, the game goes on | (our game goes on by design) |
Nothing left in «we lose». Found and fixed while filming: his angry face was hidden under the red tint and the
«¡Se despertó!» band (the band now sits under his face, the tint keeps his face clear), the waker's finger kept moving
the feather over the rage, and his wake lines were still sleepy («…bueno, a dormir otra vez»).

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
answer, 1.4 s after a wrong one · a tickle closer than 0.25 s to the last = noise, closer than 0.55 s = a scribble ·
POST 1.5 s.
**v3**: 2 / 3 / 4 min (default 2) · a question's time 15 s (late = wrong) · an answer < 0.5 s after the question = a
guess = wrong · the wake chance 1 % + 0.25 % × the danger since he fell asleep (≤ 30 %), a wrong / late answer +1
danger · WAKE 4.4 s (the rage ~4 s, the board's quiz waits) · NIGHT 2.4 s.

## Files
`core/dormilon.js` (rules, no sockets) · server.js «NO DESPIERTES A DRALINGO» block (`dm*`) · `public/host-dormilon.html`
+ `js/host-dormilon.js` · `js/player-dormilon.js` + `js/dormilon-stage.js` (the bedroom, shared by phone and
projector) · `css/dormilon.css` · `public/assets/dormilon/` (Higgsfield art 2026-10-22, 0 credits; sounds) · tests
`scripts/test-dormilon.js`, `scripts/test-dormilon-live.js`, bot handler `scripts/playtest/dormilon.js`.
v2 adds: `closeup-sleep|stir|awake.webp` (his face on the pillow, aligned crops of the same Higgsfield originals,
0 credits), `giggle-h1..3.mp3` (his sleepy giggle, Higgsfield Mirelo through Supercomputer, 3 credits for 6 takes, one
kept) and the 4-fps turn film `scripts/record-dormilon-turn.js` (the real-browser check `scripts/check-dormilon-screens.js`
now rubs on its phones' turns and answers their quiz).
v3 adds: `closeup-angry.webp` (the angry red Dralingo, Higgsfield Unlimited 0 credits, registered to the same crop by
`assets-library/higgsfield/2026-10-22/dormilon/_how-made/closeup_extra.py`), `angry-h1/h2.mp3` (his growl) and `lose-feather-h1.mp3` (the «fsss»), Higgsfield
Mirelo via Supercomputer, 3 credits for 6 takes; `scripts/check-dormilon-lobby.js` (the projector at 8 sizes and zooms) and
`scripts/record-dormilon-wake.js` (a wake-up filmed at 4 fps on the waker's phone).

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

## Scorecard · v3 · 2026-10-22 · branch `dormilon-v3`
```
Hard gates: bots PASS (30 kids · 2 min: 8 boards, 136 turns, 369 tickles, 27 wake-ups, 555 answers, 11 late, 64
            feathers lost, 0 frozen, 0 errors; 20 kids · 60 s PASS) · teacher controls ✓ (Pausa, +30 s, −30 s, Saltar,
            Terminar, Sonido fully visible at 8 laptop / projector sizes incl. 125 % and 150 % zoom) · saga only ✓ ·
            Spanish / pinyin without tones / level words ✓ · kid-safe ✓ (funny-angry, never scary; a miss never names anyone)
1 Real place ........ 2/2  the palace bedroom; his face on the pillow on my turn; the angry close-up when he wakes
2 The gang .......... 2/2  the cast tiptoes, whispers and cheers; Dralingo's funny-angry lines and growl when woken
3 Every tap ......... 2/2  my finger rubs; a right answer flies a feather in, a wrong / late one flies it out («fsss»)
4 Feedback .......... 2/2  every tickle answers; he wakes up ANGRY on every phone and the projector (~4 s, the whole
                           screen red, ring, lines, steam, sparks, shake); the projector's full-screen pulse ≤ 1 a 7 s
5 Finale ............ 2/2  random wake-ups keep every turn tense (28 % of boards in the first round), «¡Luna llena!»,
                           «¡FINAL!», bonus stars, the winner by the bed, my card
6 Fair, no stall .... 2/2  only the kid tickling can wake him; the board's first turn safe; a late answer costs only a
                           question that was really on screen; the quiz waits while he rages; never naming who failed
7 Product feel ...... 2/2  Higgsfield art (the angry Dralingo) and sounds (growl, «fsss»), the lobby fits and scrolls
                           everywhere, the turn and the wake-up filmed at 4 fps beside the video's
Total 14/14 → ships. For his ears: the growl (one Higgsfield take, «grumpy creature») and the «fsss».
```
Evidence: `.claude/handoff/dormilon-shots/v3-wake-side-by-side.jpg` + `wake-4fps/`, `v3run2/` (a whole game at 5 phone /
laptop sizes + the projector: 24/24), `lobby-before/` + `lobby-after/` (`scripts/check-dormilon-lobby.js`: 19/19),
`scripts/test-dormilon.js` (117 checks + the 2-minute class simulation), `scripts/test-dormilon-live.js` (46 checks),
the fresh-eyes review 2026-10-22 (12/14 before its fixes: the time bar refilled on repaints, a pocketed phone paying for a
late question, the projector's stacked red pulses and creaks, steam over his eyes and a clipped bubble, naming who
failed, the danger chip hidden on first turns that can wake him, a double tap counting as a blind guess, stacked sounds,
a reconnect during the wake without the whole-phone rage).
