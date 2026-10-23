# Dàfùwēng · Monopolio v2 · «El Gran Tablero de Dubái» (a Mario Party board night, boards of 4)

**Name since 2026-10-23: «Draly Tablero · El Gran Tablero de Dubái»**, short «Draly Tablero» (the «Draly Party» names, his «Approve all»; `core/game-names.js`). The text below keeps the name it had when it was written. «Monopolio» (another company's brand) is gone from every screen; the id and the file names stay.

gameType `monopoly` · address `/host-monopoly.html?setId=…` (unchanged: games.html, packs.html, sets.html and /maestro's
launcher keep working, `?livegame=1` kept; no set → `/packs.html?game=monopoly`) · remade 2026-10-16 on a branch, not
deployed.

## Why
Fernando loved Mochi Mash v2 for its Mario Party feeling (feelings at the end of class, and since 2026-10-16 «no dead
phones» in between). Monopolio was the last kept game never rebuilt: 16 Chinese-city tiles, Kenney toon tokens, teams
Rojo / Dorado, ¥, auto-buy and rent, a 5×5 grid on the phone. Now: a Mario Party board night in Dubai that kids beg to
play.

## The big choice: boards of 4, every kid for themself
A board game is four rivals around one board. That is what Mario Party is, and what this repo's rule for Mario Party
recreations asks (`CLAUDE.md` § Pin games: boards of 4, 3 when it doesn't divide, one board up to 5).
- **Why not Fuego vs Mar on one shared board:** 10-30 pieces on one loop is unreadable on a phone, the events that make
  a board game (stealing a star from the friend next to you, a swap, a duel, a toll paid to *you*) need a small group of
  named rivals, and "my piece among three rivals" is the feeling of Mario Party. Teams also made the old game's tokens
  anonymous.
- **Why not one board per kid:** no rivals, no tolls, no duels, no lead changes.
- **What keeps the class together:** every board plays the same map at the same time; the projector shows every board
  side by side with the class top 3; the frenzy and «¡FINAL!» hit everyone at once; the ceremony crowns each board and
  then the class podium. Halcón (boards of 4) already proved the end-of-class feeling.
- Colours: Mario Party player colours instead of team colours (seat 1 red, 2 blue, 3 green, 4 yellow, a 5th purple):
  each kid's full-body character wears its seat colour (sticker outline + base ring) on the phone and the projector.
- Deal (reused from `core/halcon.js`): ≤ 5 kids = one board; otherwise ceil(n / 4) boards of 3-4, shuffled; a late
  joiner sits at the smallest board that has room (max 5); a rejoin keeps seat, piece, coins and stars.

## The world
- **A board game night in a Dubai penthouse:** the board is a luxury game board (cream and gold frame) on a table, the
  night skyline around it. Painted on the board: the sea and the Palm on the left, the desert with dunes along the
  bottom, Dubai Creek with two abras across the top, downtown on the right, and a gold plaque in the middle with the
  game's name (like the logo in the middle of a Monopoly board).
- **24 spaces on one loop** (Mario Party colours): Salida, 11 blue (+3 coins), 3 red (−3), 3 green «¡Suerte!», 1 orange
  «¡Tormenta de arena!», and **5 landmarks** standing on their spaces (the glossy Reinos art): Museo del Futuro, Marco
  de Dubái, Burj Khalifa (the corner), Burj Al Arab, Atlantis.
- **The star:** Dralingo in his platform look stands on one blue space with the star. Pass or land there with 10 coins
  and the star is yours; then it moves somewhere else on that board.
- **The gang hosts the board** (`js/cast.js`, mood `tablero`, Aileen in voseo): Profe Fer opens the episode, Hamdan
  sells the landmarks, Latifa spins the «¡Suerte!» roulette, Aileen calls the duels, Adric (and his dog) warns of the
  storm, Adrian and his map cheer each lap at Salida.
- Every kid is their full-body saga character (`HalconBoard.art`), never a face crop on the board. Pieces that share a
  space stand side by side, never overlapping (kid-safe).

## Flow (server-timed; constants in `core/monopoly.js` `R`)
1. **Lobby.** Projector: PIN + QR, «Así se juega» in 3 pictured steps (a question card · the dice block with a tapping
   hand · Dralingo with the star), 3 / 4 / 5 min (4 by default), the class as full-body characters, how many boards
   («4 tableros de 4»), «¡A jugar!». Phone: «¡Juegas en un tablero!» («Tú y tus rivales (3 o 4 por tablero), cada uno
   con su color») with my character, the same 3 steps.
2. **Countdown (3.5 s) = the run-in.** Boards are dealt now. Phone: «¡Tu tablero!»: my three rivals and me run in, each
   in its colour, «TÚ» on me, Dralingo with the star in the middle. Projector: every board's pieces run onto Salida.
3. **Intro (2.8 s).** One pictured control: the dice block and a tapping hand: «¡Responde y tira el dado!» → «¿Listos?»
   → «¡YA!». The teacher can skip it.
4. **Play.** The phone IS the board: the four players' plates on top (rank 1º-4º, stars, coins; mine marked «TÚ»), the
   board around my piece in the middle (rivals hop in and out of view, a minimap of the loop with every piece and the
   star), and the question as a sheet at the bottom (picture, prompt, 4 big tiles, 20 s clock with ticks).
   - **Right** → «¡Correcto!» → the sheet slides down, a **dice block** spins over my head: «¡Toca para tirar!» (the
     whole screen is the button; 3 s, then it rolls itself). Every 3rd right answer in a row: **two dice**
     («¡Racha! Dado doble»). The server decides the number. My piece hops space by space (the camera follows, a count
     above my head), passes Salida (+4) or the star, and lands: the space's moment plays (below). Then the next question.
   - **Wrong / time up / too fast** → «¡Casi! Era …» on the sheet; the board above keeps living. 2.2 s, 3.4 s after two
     in a row («¡Respira! Lee y piensa»). No dice: the wait is the cost.
5. **The spaces** (each with its sound, a host from the gang, coins flying to or from my plate):
   - Blue +3 · Red −3 (never below 0) · Salida (passing or landing) +4.
   - **Landmark:** free → bought at once if I have its price (6-10 coins), it takes my colour and my flag; a rival's →
     I pay its toll (2-4 × its level) to the owner, whose phone shows the coins arriving; my own → it goes up a level
     (max 3, toll ×3).
   - **¡Suerte!** → Latifa's roulette: a chest (+5, a golden one +10), **¡Cambio!** (I swap places with a rival of my
     board), **¡Duelo!** (a dice duel with a rival: the higher die takes 4 coins), **¡Avanza 3!**.
   - **¡Tormenta de arena!** → the sand sweeps over the whole board (every phone of that board): everyone drops 2 coins
     and the star flies to another space.
   - **The star** (passing or landing): with 10 coins → «¡ESTRELLA!» (the big moment); without → «Te faltan N».
6. **Rising excitement.** Lead changes on my board («¡Latifa toma la delantera!», ≥ 6 s apart, a lead needs a star or 3 coins
   more); the ticker of what rivals did; **¡Últimos 30 segundos! ¡Monedas dobles!** (every coin ×2, the final music, a
   gold frame, the last 10 s on the projector and as a chip on phones).
7. **«¡FINAL!»** (2.4 s) on every screen; a dice tap already on its way still counts.
8. **The ceremony (~16 s; «Saltar» on the projector jumps every phone to its card).**
   1. *¡Estrellas bonus!* (Mario Party): three bonus stars per board, one by one: **Estrella Sabia** (most right
      answers), **Estrella Magnate** (most landmarks), **Estrella de Racha** (longest streak, ≥ 3). They count: the
      winner can change.
   2. *¿Quién gana?*: a drum roll, then each board's winner in the victory pose under confetti in their colour, the
      others react (sad pose). Phone: my board; projector: every board, then the class podium (top 3 by stars, then
      coins) with «Otra ronda».
   3. *My card:* my character, «1º en tu tablero», stars, coins, landmarks, right answers, every bonus star I won;
      0 stars → «¡La próxima estrella es tuya!», never shame. «Quédate aquí: tu profe puede empezar otra ronda» + a
      quiet «Salir del juego».

## Fair, and never stuck
- **Server judges everything:** answers (one per question, a tap under 600 ms after the question was sent = too fast =
  wrong), the dice (the tap only says *now*; the number is the server's), every space. A phone can't pick its roll.
- **Guessing loses to thinking:** wrong costs a wait (longer after two), streaks give double dice and the Estrella Sabia.
  Measured in `scripts/test-monopoly.js` on simulated games: a thinker beats a fast guesser and a masher.
- **Comeback, capped at the gap:** the last kid of a board who trails the leader by ≥ 8 (stars count 10) gets lucky
  coins: blue +6 instead of +3, chests +10, Salida +8. The extra never takes them past the leader by luck alone (capped
  at the gap). And when the star moves (bought, or blown by the storm), it lands 2-8 spaces ahead of the board's kid
  who saved the most coins but has no star yet (still ≥ 5 spaces from where it was), so «I had 20 coins and never
  reached it» stays rare.
- **Timeouts with defaults:** dice → rolls itself after 3 s (the same dice, never more than a tap); a question nobody
  answers → time up on the server 3 s after the phone's 20 s; every turn's length is computed by the server, so the
  next question comes even if a phone vanished.
- Late joiners sit at the smallest board; a kid who leaves stays on the board greyed (no one waits for anyone: there
  are no turns to wait for).

## Teacher (projector, secondary but never stuck)
PIN + QR, 3 / 4 / 5 min; Pausa (holds every clock, question, dice window and wait), +30 s, Saltar (intro, ceremony),
Terminar («¡FINAL!» then the ceremony, also from the pause card), Sonido, Otra ronda; F5 takes the same room back
(sessionStorage `draly.monopolyHost`).

## Network budget (30 phones)
Per kid: its own question, verdict, dice window and turn script. Per turn, one compact `mn:move` to the 3-4 phones of
that board and the projector (no room-wide event per answer, no full `state` push on answers). Banners one at a time.

## Scorecard target
Gates all pass; 14/14 aimed: 1 real place = the Dubai board with 5 landmarks to own and collect tolls on; 2 the gang =
hosts of the spaces, Dralingo with the star, run-in on phone and projector, full-body pieces in seat colours; 3 every
tap = the dice block (the whole screen), press + sound, pictured rules, prompt strip; 4 feedback = right / wrong / dice
/ every space / star / lead, one big moment at a time; 5 finale = frenzy, lead alarms, bonus stars that can flip the
result, winners and podium, my card; 6 fair = server judge, too-fast rule, waits, comeback capped, timeouts; 7 product
= our art, Kenney sounds and music, phone as finished as the projector.

---

## As built (branch `monopoly-v2`, 2026-10-16, not deployed)

### Files
- New: `core/monopoly.js` (rules: deal, answers, turns, spaces, leads, frenzy, bonus stars, end), `public/js/monopoly-map.js`
  (the 24 spaces, landmarks, positions and the shared timing clock used by the server and the phones),
  `public/js/monopoly-board.js` (the board drawing, pieces, hops, camera, minimap; phone and projector),
  `public/js/player-monopoly.js` (the phone), `public/assets/monopoly/*.mp3` (Kenney CC0: dice, hop, star, storm, level,
  lose, the board music; ~420 KB), tests `scripts/test-monopoly.js`, `scripts/test-monopoly-live.js`,
  `scripts/sim-monopoly.js`, `scripts/playtest/monopoly.js`.
- Rewritten: `public/js/host-monopoly.js`, `public/host-monopoly.html`, `public/css/monopoly.css`; old Kenney tokens
  and dice pictures removed (`public/assets/monopoly/chars/`, `dice/`).
- Shared files, monopoly parts only: `server.js` (the «MONOPOLIO v2» block replaces the old teams code + one-line
  branches), `public/player.html` (`#screen-monopoly`), `public/js/player.js` (the old ~800 monopoly lines out,
  `MonoPhone.init`), `player-kingdoms-skin.js` (lobby, intro, music, end), `cast.js` (mood `tablero` for the gang),
  `sounds.js` (synth theme retired), games / packs / sets / maestro labels, `test-wording.js`.
- Merge notes: `player.html` still links the old `monopoly.css?v=20260520c` on line 18 next to the new link (kept so the
  6-7 branch merges without a conflict): delete that line after both branches land. Same for the old one-line
  Monopolio row in `docs/HOW_CLAUDE_WORKS.md`.

### Test hooks (for screenshots and tests)
Phone `window.MonoPhone`: `frame()`, `hold(v)` (banners and overlays stay), `freeze(v)` / `replay(ev)` / `queued()`
(hold socket events and play them one by one), `stage(name)` (ceremony: bonus, b0-b2, drum, win, card), `runIn()`,
`rules(ms)`, `sim(ev, data)`, `tapDice()`, `answer(i)`, `card(o)`, `banner(...)`, `bigStar()`. Projector
`window.MonoHost`: `frame()`, `freeze` / `replay` / `queued`, `hold(v)`, `stage(name)` (bonus-intro, bonusN, drum,
winners, podium), `sim(ev, data)`, `band(...)`.

### Tests
| Test | Result |
|---|---|
| `node scripts/test-monopoly.js` (board, deal, answers, every space, frenzy, comeback cap, leads, pause, end, 300 simulated classes) | 24,257 checks pass; stars per kid with bonus: thinker 4.60 · slow 2.37 · fast guesser 1.62 · masher 0 · idle 0 · never taps the dice 3.08 (≤ a thinker) |
| `node scripts/test-monopoly-live.js --url … --password …` (real sockets: lobby → deal → intro skip → turns → wrong / too fast → dice rolls itself → pause → +30 s → rejoin mid-turn → late joiner → end → reattach → skip → «Otra ronda») | 89 checks pass |
| `playtest-bots.js --game monopoly --seconds 60` | 4 bots PASS (49 questions) · 20 bots PASS (236) · 30 bots PASS (351) · 0 frozen · 0 errors |
| Every other suite (mochi, pinata, sixseven, halcon, kingdoms, paint, snow, escape, packs, stress-packs, wording, ruta ×3, level-keys, sims-lock, golden-book, archive, audios-base) | all pass |
| `node scripts/asset-guard.js` on the staged files | exit 0 |

### Reviews and what changed
- **Code review** (agent-skills:code-reviewer): fixed a dice window that could stay open after a reconnect (re-asked
  every 1.5 s, closed by the next question), overlays left over the ceremony (a generation counter stops old
  coroutines), the swap and the landing piece overlapping others, stale moves on a phone that missed one (per-board
  `seq`), one kid's error stopping the server tick (per-kid try), reset during the countdown, the phone's time-up,
  aria, the projector's intro timers on pause. Kept: the duplicate css link (merge safety), rolls that arrive after
  «¡FINAL!» are not animated (the spec), a few unused payload fields.
- **Classroom playtest** (real browsers, 20-30 kids): fixed the coins hidden on the players' plates with 4 per board
  (plates rebuilt: name on top, figure, stars over coins), the class panel squeezing names with many boards, the lobby
  text («tablero de 4» when a board can be 3 or 5), gendered «va primero» (now «toma la delantera»), the verdict
  covering the question's picture, the projector's bonus totals not counting up, the star overlay cropped, my name
  collapsing out of my tag on the board.
- **Fresh-eyes design review** (stills only; disposition «fix», 8 items): fixed the «¡ESTRELLA!» title under Dralingo,
  red/blue spaces' small pink number (now big, with a coin), the board's centre plaque dominating the phone (smaller,
  quieter), the HUD over a busy board (darker top), the rivals' ticker cut to one line (2 lines now), the last 30 s too
  quiet (gold frame on the phone, gold board borders on the projector), the ceremony hiding why a tie was won (coins
  under the stars at «¿Quién gana?», gold pill on the winner, «1º» no longer behind the champion's head, bonus cards
  name who got it: «Cami y Valen · 8 aciertos»), small projector chips and ceremony characters with few boards
  (bigger when ≤ 4 boards), and a projector band telling an older storm while another board stormed (a newer band of
  the same kind replaces a waiting one; board moments older than 3 s are dropped). Kept: the right-answer verdict
  (it exists, «¡Correcto!» for 0.8 s; the stills were taken after it), the step counter (it exists, over the piece),
  the moment cards' length (they follow the server's shared clock: longer cards = longer turns for the whole class),
  the projector band at the bottom (2.4 s, one at a time).
- **Design pass (emil-design-eng format):**

| Before | After | Why |
| --- | --- | --- |
| Dralingo pinned over the «¡ESTRELLA!» title | Dralingo at the star's top-right, subtitle on a dark pill | The title is the moment; nothing may cover it |
| Red space: a pale pink «-3» | «−3» in strong red with a coin, «+3» in gold with a coin | Coins, not points, and readable on sand |
| Centre plaque full size under the phone camera | `scale(.62)`, 55 % opacity on the phone | Scenery, not a second headline over my piece |
| Ticker on one line with an ellipsis | Up to 2 lines | «Adric compró el Museo del Futuro» must be read whole |
| Last 30 s: a ×2 chip | Gold frame round the phone, gold tile borders on the projector | A state change the whole room should feel |
| Sheet with only a top border on rounded corners | Full ink outline, open at the bottom | The border no longer tapers into the corners |
| Champion «1º» above the head | «1º» pill in the totals line, no wrap | It hid behind tall characters |
| Ceremony: stars only | Stars + coins at «¿Quién gana?» and «¡Los ganadores!» | Ties go to coins: the class sees why |
| Band queue kept stale bands up to 6 s | A same-kind band replaces the waiting one; board bands older than 3 s are dropped | The band always matches the board that is moving |

- **impeccable detector** (run once on the game files): 5 flags. Kept on purpose: the dice faces' bottom edge (it is
  the 3D dice block, not a side stripe), the glow round the star's space (it tells kids where the star is), the pop
  easing (a kids' board game; the brief wins). Fixed: the sheet's top-only border. One glow it reports for
  `host-monopoly.html` is not in this game's CSS.

### Scorecard · Monopolio v2 · 2026-10-16 · branch `monopoly-v2`
```
Hard gates: bots PASS (4/20/30) · teacher controls ✓ (Pausa, +30 s, Saltar, Terminar, Sonido, Otra ronda, F5)
            · saga only ✓ · Spanish/pinyin/level ✓ (questions from the packs; test-wording clean) · kid-safe ✓
1 Real place ........ 2/2  Dubai board: 5 landmarks to buy, level up and collect tolls on; Creek, Palm, desert painted
2 The gang .......... 2/2  the gang hosts every space with their own lines (cast.js «tablero», Aileen in voseo),
                           Dralingo sells the star, run-in «¡Tu tablero!», full-body pieces in seat colours on phone
                           and projector
3 Every tap ......... 2/2  whole-screen dice tap with a hand, prompt strip, «Así se juega» 3 pictured steps, sounds
4 Feedback .......... 2/2  right / wrong / too fast / time up, every space with its host and sound, one big moment at
                           a time (star overlay, bands queued and deduped)
5 Finale ............ 2/2  lead alarms, last 30 s ×2 with a gold frame, «¡FINAL!», 3 bonus stars that can flip a board,
                           drum, winners in colour + confetti, class podium, every kid's own card
6 Fair, no stall .... 2/2  server judges answers and dice; too fast = wrong; dice rolls itself after 3 s and never
                           earns more than tapping (sim); comeback capped at the gap; late joiners; teacher controls
7 Product feel ...... 2/2  our art only (saga + Reinos landmarks), Kenney music + effects, phone checked at 390 and
                           360, projector at 1600×900 with 2, 3 and 7 boards
Total 14/14 → ships (≥ 12, no 0)
```

### Open items and what to watch in the first real class
- **Stars per kid in short games.** Simulated: with 3 minutes a slow thinker ends with no star bought 15 % of the time
  (11 % with 20+ coins in hand); with 4 minutes (the default) 5 %. The phone card then says «¡La próxima estrella es
  tuya!». If kids complain, raise the default to 5 minutes or lower the star to 8 coins (`R.STAR_PRICE`).
- **Projector with 7-8 boards:** readable but small (chips ~14 px, pieces ~30 px). Kids play on their phones; the
  projector is the class overview. Bigger chips already apply up to 4 boards.
- **Art requests (Higgsfield in his Chrome; kid-safe, no text):** Dralingo (platform look) holding a big gold star on
  flat green, for the star moment and the lobby's step 3; optional: the 5 landmarks as small glossy props without their
  base, for the phone's buy card.
- Pre-existing, platform-wide (not changed here): every kid gets the questions in the same order; a duplicate name can
  take over a seat. «Dàfùwēng» keeps its tone marks in the title (the game's name, not a curriculum word).

### Art batch 1 · 2026-10-17
- The captains' new poses (Higgsfield Unlimited, 0 credits, his Chrome): `assets/cast/<id>-{talk,jump,wow,67}.webp` for Fer, Hamdan, Latifa, Aileen and Adric (Adrian: Higgsfield refuses him, his three poses stay) and Dralingo `assets/dralingo/{talk,jump,wow}.webp`. `js/cast.js` rotates them: `hello` → hello or talk, `cheer` → cheer or jump, `mystery` → mystery or wow (held 25 s per character, so a moment never flickers); `talk` / `jump` / `wow` / `67` ask for exactly one.
- Dralingo holding the big gold star (`assets/dralingo/star-hold.webp`, `MonoBoard.DRALINGO_STAR`): the «¡ESTRELLA!» moment, the phone's run-in («Dralingo tiene la estrella») and step 3 of the how-to on the phone and the projector. The gang hosts each space in the pose of the moment (`card({ host, pose })`: Hamdan jumps when you buy, talks when you are short; Latifa talks at «¡Suerte!», is surprised at the swap; Adric surprised at the storm).
