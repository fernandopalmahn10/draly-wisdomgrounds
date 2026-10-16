# 6-7 Swing v2 · «La Balanza de Oro» (rapid-fire 6-or-7 sums, Mario Party style)

gameType `sixseven` · address `/host-sixseven.html` (unchanged; no question pack: games.html «▶ Jugar» and /maestro's
launcher keep working, `?livegame=1` kept) · remade 2026-10-15 on a worktree branch, not deployed.

## Why (his words, 2026-10-15)
"I loved Mochi Mash" (v2, 14/14) and Piñata Tigre v2 (14/14) → "Next is 6-7 Swing please", same treatment: the Mario
Party feeling, the same feelings at the end of class, super addictive, every design filter passed.

## Second pass · «no dead phones» (his words, 2026-10-16)
He played it and said: "I didn't even feel there was a feeling. There's nothing in between." His two picks: **(1) phones
go dead** (after answering, the phone just waited: no reaction, nothing to watch, no sense the tap mattered) and **(2)
not enough 6-7 energy** (the meme the kids love, the hand swing and the shout «six seven!», only at the end). New rule in
`mochi-mash/CLAUDE.md` «Feelings in between too: no dead phones». What changed (as built: «As built · 2026-10-16» below):
- **The tap answers at once.** The sum is on the screen, so the phone knows a wrong button is wrong, and the right one is
  right once the sum has been readable for the too-fast line (`ss.min`, the server's 400 ms: its clock started earlier,
  so its time is never shorter). The whole reaction plays on the tap; the server's verdict follows and settles the coins
  (the golden extra, the exact wait) or, very rarely, takes the guess back. A school Wi-Fi's round trip no longer leaves
  a kid staring at a pressed button.
- **My world above the card**, a mini of the projector: the golden balance with both pans filling and tipping live; my
  team under my pan (me big, two mates), two rivals under theirs, Dralingo at the foot doing the 6-7 whenever my team
  scores; my coins fly from the button into my team's pan; **my teammates' coins land in our pan between my sums** (the
  phones' meter now carries who scored: their figures swing, «Sofía +3» pops over the pan); the gap «¡Vamos ganando por
  3!», «¡Nos alcanzan! Solo 3», «¡Faltan 5 para alcanzarlos!» always on screen; my captain's bubble reacts (a slip, a
  lead change, a wave, the last 30 s).
- **The in-between beat:** 0.65 s after a right answer (was 0.5 s): the two buttons swing like the two palms of the 6-7,
  the coin lands, the next sum tips in from alternating sides. A wrong answer's wait is «¡Recargando!», never «Espera…».
- **«¡SIX SEVEN!» during play:** a 6 then a 7 right in a row (a small stamp at my pan, the palms double-swing, the voice
  has just said liù… qī), **racha 7** and **my 67th coin** (the big one on my phone: «¡SIX SEVEN!» stamped over my world,
  a crowd shouting «six seven!», Dralingo sliding in doing it, my crew swinging, gold confetti, then Dralingo's «liù, qī!»),
  and **team waves**: each team's gold at 67, then every ~E ÷ 3 (a multiple of 67, ≥ 12 s apart): the team's phones get
  the shout, their whole crew does the 6-7, the balance rocks; the projector shows a big «¡SIX SEVEN!» band, that crowd
  swinging in unison, Dralingo dancing bigger. All cosmetic: no gold changes hands (the anti-spam maths is untouched).
- **The projector builds hype:** the team that passes ahead jumps into the 6-7 and the balance swings over; a kid who
  hits racha 7 or 67 coins gets «¡6-7!» over the head; in the last 30 s both crowds bob to the beat, Dralingo dances
  faster and the gap is called out every 7 s («¡Fuego gana solo por 4! ¡Vamos, Mar!»); bands queue instead of being lost.
- **The pause card** shows the live score and my gold (a pause is a wait too).

## Kept from the old game, and what changed
- Kept (its soul): **fast, funny, every answer is 6 or 7** (the kids' «six-seven» meme), **two giant buttons** on the
  phone, two teams, a swing / balance that tips toward the team that scores, no question pack (the sums are generated).
- Gone: the blocky «6» and «7» meme figure (`assets/png-library/67.png`, `67-transparent.png` and the script that cut it
  out, `scripts/bg-removal-67.js`), its jumpscare / peeks / dance loop, «Equipo 6 / Equipo 7», the synthesized trap theme
  and beeps (`sounds.js` `themeSixseven`, `tap6`, `tap7`, `swingWhoosh`, `comboBell`, `sixSevenChant`), the per-answer
  `ss:tap` broadcast to the whole room (30 phones × every answer), the «Respuesta rápida» point bonus (it paid guessing).
  The warm-up's «6-7» quick effect now shows Dralingo doing the 6-7 (our saga) instead of the meme figure.

## The learning upgrade
- The buttons always read **«6 · liu»** and **«7 · qi»**: the number with its Chino Mandarín word, pinyin **without tone
  marks** (this repo's rule for games: CLAUDE.md «Pinyin without tone marks in games»). A right answer is spoken: the
  platform voice says «liù» or «qī» (`assets/sixseven/liu.mp3`, `qi.mp3`, Google cmn-CN-Wavenet-A via `/api/tts`, trimmed).
- The teacher picks the round style in the lobby:
  - **Números**: digit sums, «3 + 4».
  - **En Chino**: the same sums written with the pinyin number words yi … shi, «san + si».
  - **Mezcla** (default): the two in turns, one sum each.
- Only the numbers 1-10 and + / − (YCT 1 counts 1-10): 11 additions (1+5 … 6+1) and 7 subtractions (7−1 … 10−3), 18
  sums in all, all with answer 6 or 7. 6 and 7 are equally likely (a guess is right exactly half the time), subtraction
  40 %, never the same sum twice in a row for a kid. «Escucha» (hear the sum) was considered and left out: 30 phones
  speaking at different moments is noise in a classroom, and the voice already says the answer on every right tap.

## The world
- **Setting:** night on Dubai Creek (`assets/dubai/skyline-wide.webp` under a deep blue sky with gold lights): **a giant
  golden balance** (geometry: a pillar with a dome finial, a beam, two pans on chains, piles of coin stacks that grow).
  The beam tips toward the team with more gold (a spring ease); the leading pan glows. The «6-7» hand gesture IS a
  balance (palms up, one up, one down): the game's metaphor.
- **Teams:** Equipo **Fuego** (red, server id `red`) and Equipo **Mar** (blue, `gold`), like Reinos / Mochi / Piñata.
- **The star of the show:** Dralingo in his platform look (kandura, ghutra + agal, mustache) doing the **6-7**: palms up,
  one high, one low, swapped on a beat (`assets/sixseven/dralingo-67-a.webp` + its mirror `-b`; Higgsfield Nano Banana
  Pro in his Chrome, Unlimited, 0 credits; how-made in `assets-library/higgsfield/2026-10-15/sixseven/`). He stands at the
  foot of the balance on the projector, comes in from the phone's edge on a racha, and dances at the result.
- **Every kid is their full-body saga character** (`MochiStage.kidFigure`) with the team-colour sticker outline, on the
  phone and the projector. Never a face crop in the play area. The captains (two of the gang, `cast.js`, new moods
  `swing` for the game and `oro` for the winners, Aileen in voseo) cheer on leads, landmarks and the frenzy.
- **Gold coins** are geometry: a disc with a square hole (the old Chinese coin).
- The buttons are **teal (6)** and **violet (7)**: never the team colours, so no kid reads a button as a team.

## Flow (server-timed; constants in `core/sixseven.js` `R`)
1. **Lobby.** Projector: PIN + QR, «Así se juega» in 3 pictured steps (a sum · the two buttons with a tapping hand · the
   balance), the style picker (Números «3 + 4» · En Chino «san + si» · Mezcla), 2 / 3 / 4 min (2 by default), the two
   teams as full-body characters (tap a kid to change team, «Equilibrar equipos»), a preview of the balance with Dralingo
   dancing, «¡A jugar!». Phone: «¡Eres del Equipo Fuego!», my character in the team colour next to my balance, «Hoy:
   Mezcla · 3 + 4 · san + si», the same 3 steps.
2. **Countdown (3.5 s) = the run-in.** Phone: the red | blue split, Dralingo doing the 6-7 over the «VS», each team's
   pan filling with coins, my team runs in behind its captain, me marked «TÚ». Projector: the crowds run in under their
   pans, the captains say hello.
3. **Intro (2.8 s).** One pictured control: a sum card «3 + 4 = ?», the two buttons, a hand pressing «7» (it lights green):
   «¡Toca el resultado!» → «¿Listos?» → «¡YA!». The teacher can skip it.
4. **Play, rapid-fire.** Each kid has their own stream of sums. The phone (since 2026-10-16, «no dead phones», below):
   the team meter on top; **my world** (the golden balance, my team under my pan: me big + two mates, two rivals under
   theirs, Dralingo at the foot, my gold in my corner, my captain's bubble, the live gap «¡Vamos ganando por 3!»); the
   sum card (a 12 s clock bar under it, ticking in the last 3 s); the two giant buttons (≥ 156 px tall, the whole lower
   third). A hand shows «one of these» on the first sum.
   - **Right** (shown on the tap itself, the server's verdict settles it) → the button pops, the two buttons swing like
     the two palms of the 6-7, a pop sound whose pitch climbs with the streak, a 14 ms buzz, the voice says «liù» /
     «qī», my character swings toward the side I tapped (6 left, 7 right), my coins fly up into MY TEAM'S PAN (it dips,
     Dralingo at the foot does the 6-7, «+3» rises), the verdict pill «¡Sí! 7 · qi», the combo chip «Racha 4 · ×2 oro».
     **The next sum 0.65 s later** (was 0.5 s), tipping in like a palm from alternating sides.
   - **Racha** milestones (3 → ×2, 10 → ×4, then every 5): Dralingo slides in from the far edge doing the 6-7, the voice
     chants «liù, qī!» (one Dralingo at a time, ≥ 2.5 s apart, never over the buttons); 6 → ×3 is a chip; **7 = «¡SIX
     SEVEN!»** (below).
   - **Golden sum** (8 %, 25 % for the trailing team): the card turns gold «¡Pregunta dorada!» (+5, ×2 in the
     frenzy; while trailing capped at the gap, so the card names no number), a coin fountain.
   - **Wrong / time up / too fast** → a funny wobble (the tapped button shakes and greys, my character wobbles in the sad
     pose), a «wah» sound, «¡Uy! Era 7 · qi» (the right button glows gold), my captain says something kind, the buttons
     **recharge**: «¡Recargando!» with a gold bar that fills, the two buttons rocking gently, the world above going on:
     **1.6 s**, or **2.6 s after two wrong in a row: «¡Respira! Piensa y toca»**. Then the next sum.
5. **Rising excitement.**
   - **Live balance + meter** on both screens.
   - **Carrera de monumentos:** four Dubai landmarks on a gold track on the projector (Museo del Futuro 12 %, Marco de
     Dubái 32 %, Burj Al Arab 58 %, Burj Khalifa 88 % of E): the first team whose gold reaches one wins it (+4 % of E,
     coins burst into its pan, a band on the projector, a banner on every phone).
   - **Lead-change alarm** (≥ 4 coins and ≥ 3 % of the total, ≥ 7 s apart) on the projector and as a top banner on every
     phone (never over the buttons), with the captain's line.
   - **¡Últimos 30 segundos! ¡DOBLE ORO!** Every coin ×2, the final music, a gold frame, the last 10 s big on the
     projector and as a chip on phones.
6. **«¡FINAL!»** (2.4 s) on every screen; an answer already on its way (≤ 0.6 s) still counts; the buttons are covered.
7. **The ceremony (game-end, ~19 s, «Saltar» on the projector jumps every phone to its card).**
   1. *La gran pesada:* «¿Quién tiene más oro?»: the empty balance leans the WRONG way first, then back and forth smaller
      and smaller, then settles toward the winner while both totals count up with a drum roll (3.8 s).
   2. *¡Gana el Equipo …!:* the winners do the 6-7 swing (their figures rock side to side on the beat) with confetti in
      the team colour and their captain's `oro` line, Dralingo dances the 6-7 in the middle and says «liù, qī!»; the
      others clearly react: sad pose, slumped and sobbing under a little rain cloud, an «aww» (3.2 s). A tie: everybody
      cheers, «¡Empate!».
   3. *Estrellas Bonus,* one by one (2.1 s each, see below). A phone that won it: «¡ES PARA TI!».
   4. *The end card:* projector podium (top 3 by gold, full body, their stars), the MVP of each team, «Otra ronda». Phone:
      my card (my character in the team colour, victory or sad pose, a small balance tipped my way or not, «Ganaste 87
      monedas de oro», «El 14 % del oro de tu equipo» (under 1 %: «¡Cada moneda cuenta para tu equipo!»), aciertos ·
      mejor racha · puntería % · en chino, every star I won, «Quédate aquí: tu profe puede empezar otra ronda» and a quiet
      «Salir del juego»); a kid with 0 gets «¡La próxima es tuya!» and only «N cuentas jugadas», never «0 aciertos».

## Points (core `answer`)
- A right answer = the **streak multiplier**: ×1 (1-2 right in a row), ×2 (3-5), ×3 (6-9), ×4 (10+). ×2 in the last
  30 s. A golden sum adds +5 (×2 in the frenzy).
- A wrong answer, a time-up or a too-fast tap = 0 coins, the streak back to 0, a wait (1.6 s, 2.6 s after two in a row).
- Team totals are weighted by team size (from Mochi Mash): each coin counts ×(average team size ÷ the team's connected
  size) in the team total; kids' own coins stay real.

## Anti-spam: random tapping loses to thinking
Two buttons invite random tapping. The server judges every answer and makes guessing a losing plan:
- **One answer per sum**, and the next sum comes only from the server after the beat / the wait (the tick deals it): no
  phone can answer faster than the server deals. A mashed double tap gets one verdict and at most one 'answer-stale' a
  second (mashing can't make the server chatter).
- **Too fast = wrong:** a tap that reaches the server less than **400 ms** after its sum was sent (round trip included)
  is wrong even on the right button (nobody reads a sum and taps that fast).
- **The multiplier is the reward:** a guesser is right half the time, so its streak rarely reaches 3; a kid who thinks
  lives at ×2-×4.
- **Wrong costs time:** 1.6 s, 2.6 s after two in a row (a guesser hits two in a row a quarter of the time).
- Measured on the server's own rules (`scripts/test-sixseven.js`, 60 simulated 2-minute games each): a kid who thinks
  (1.2-3 s, 88 %) **134 coins**, a slow kid who thinks (2.6-5 s, 82 %) **66**, a fast guesser (0.4-0.7 s, 50 %) **61**,
  a masher (taps before reading) **0**. Bots on the live server: see «Tests».

## The comeback rule (fair, keeps the losing team hopeful)
- **Más preguntas doradas:** while a team trails by ≥ 15 % of the leader's gold (and ≥ 10), its kids' sums are golden
  25 % of the time instead of 8 %. They still need the right answer.
- **The cap:** while a team trails, a golden sum's extra (+5, ×2 in the frenzy) is capped at the current gap: luck can
  close the gap, never jump it. (The coins of the answer itself are earned and never capped.)
- **¡Doble oro!** in the last 30 s for both teams: an early lead is never safe.
- Uneven teams are weighted (above); late joiners go to the team with fewer connected kids (a tie: the trailing team).

## Bonus stars (`core/sixseven.js` `STARS`)
| Star | Value | Eligible |
|---|---|---|
| Más aciertos | right answers | ≥ 1 |
| Racha más larga | longest streak | ≥ 3 |
| Mejor puntería | right ÷ answered (time-ups and too-fast taps count) | ≥ 5 answered, ≥ 1 right |
| Respuesta más rápida | fastest right answer (≥ 400 ms) of a kid who thinks | ≥ 3 right and ≥ 60 % right |
| Experto en Chino | right answers on «En Chino» sums | ≥ 1 (so never in a «Números» round) |
| Gran remontada | coins earned while their team was trailing | ≥ 1 |
Ties share the star; a category nobody qualifies for is skipped; stars never change the team result. MVP of a team =
most gold (≥ 1). Podium = top 3 by gold.

## Teacher (projector, secondary but never stuck)
PIN + QR lobby, the style picker, the team split with full characters (tap to swap, «Equilibrar equipos»), 2 / 3 / 4
min; during the game «Pausa» (holds the clock, every sum's clock and the waits; answers handed back), «+30 s», «Saltar»
(intro, ceremony), «Terminar» («¡FINAL!» then the ceremony; also on the pause card), «Sonido». F5 on the projector takes
the same room back (sessionStorage `draly.sixsevenHost`). Every wait is server-timed: a sum nobody answers is called
«time up» by the server 2.5 s after the phone's 12 s clock (a frozen tab can't hold a kid). «Otra ronda» = a clean game.

## Network budget (30 phones)
Per kid: its own sum and verdict (one event each), the meter every 750 ms only when it changed, carrying since
2026-10-16 the feed of the last beat's top 8 scorers (`f: [k, coins, golden, six]`, «six seven» kids first), one banner
per lead change / landmark / frenzy / team wave (~2-3 waves a team a game). The projector: the meter + the feed of who
scored or slipped (`f: [k, coins, golden, wrong, six]`) every 250 ms. No room-wide event per answer, no full-room
`state` push on answers. Measured with 30 bots: ~150 events per kid in a 60-s round (≈ 2.5 a second), as before.

## Scorecard target
Gates all pass; 14/14 aimed: 1 real place = the golden balance on Dubai Creek + the landmark race worth gold; 2 the gang =
Dralingo's 6-7 as the star, captains with lines, VS run-in on phone and projector, every kid full-body in the team
outline; 3 every tap = two giant buttons, press + pop with rising pitch + buzz + voice + swing + coins, the pictured
rules card and the tapping hand, the lock card naming what to do; 4 feedback = right / wrong / too fast / time up /
racha / golden / landmark / lead each answer back, banners one at a time; 5 finale = the ceremony; 6 fair = server
judge, too-fast rule, multiplier + waits, comeback capped at the gap, size weighting, late joiners; 7 product = our
Dralingo art, the saga, Kenney music + effects and the platform voice (no beeps), phone as finished as the projector.

## As built (2026-10-15)
### Files
- `core/sixseven.js` — the rules, no sockets (constants in `R`; `makeQuestion` (the 18 sums, the three styles, never the
  same sum twice in a row), `newGame / rescale / join / startPlay / deal / answer / credit / tick / display / tilt / race /
  final / finish / stars`, `shiftTimes / shiftKid` (pause), `addTime`; team helpers reused from `core/mochi.js`:
  `teamSizes`, `weights`, `pickTeam`, `mulberry32`).
- `server.js` «6-7 SWING v2» block (`ssStart → ssPlay → ssTick (one 125 ms interval per room: deals every sum, calls
  time-ups, landmarks / leads / frenzy, the projector meter every 250 ms, the phones' meter every 750 ms when it changed)
  → ssFinal → endGame → ssFinish`, `ssAnswer` (one answer per sum, the sum's id checked, stale answers answered at most once
  a second), `ssResend` (a reconnecting phone gets its open sum back with the time really left), `ssPause`,
  `ssEndPayloads`) + the branches in host:create (2 min default, the style from the lobby), host:reclaim, swap / balance
  (lobby only), host:start (captains, no generic deal / end timer), host:end-now («¡FINAL!» first), host:reset,
  player:join (fewer connected kids; late joiner / rejoin snapshot + its sum back; the card again after the end),
  player:answer, `host:ss-style`, `host:ss-skip`, host:pause, host:add-time, player:resync, the watchdog (the room tick
  deals every sum), the host-left cleanup, publicState (`k` + `sk`, `ssStyle`). The old generator
  (`generateSixSevenProblem`, its pinyin table), the `ss:tap` room broadcast and the «Respuesta rápida» bonus are gone.
- Phone: `public/js/player-sixseven.js` (SixSevenPhone: run-in, rules card, lobby card, the sum + buttons, right / wrong /
  racha / golden, banners, pause, the last-30-s chip, the ceremony and my card), `public/js/sixseven-stage.js`
  (SixSevenStage: the balance (beam, chains, pans, coin stacks, spring tilt, the weigh-in), the coin pool, the Dralingo
  dancer, the sum card, the rain cloud), `public/css/sixseven.css` (rewritten), `public/player.html` (`#screen-sixseven`
  + the `ssx-*` overlays; the old `ss-ambience` markup removed), `public/js/player.js` (init, screen map, Fuego / Mar
  wording, ~350 lines of the old 6-7 code removed), `public/js/player-kingdoms-skin.js` (sixseven in the skin: lobby /
  end routed to SixSevenPhone, the swing music, no win sound before the reveal).
- Projector: `public/host-sixseven.html` + `public/js/host-sixseven.js` (rewritten, same address; F5 keeps the room
  through sessionStorage `draly.sixsevenHost`).
- Shared, extended: `js/cast.js` (moods `swing` for the game, `oro` for the winners and `casi` for the team that lost, every character, Aileen in
  voseo), `js/mochi-stage.js` + `css/mochi.css` (kid figures, confetti, stars, count-ups; untouched), `js/halcon-board.js`.
- Warm-up: the «6-7» quick effect (`js/host-warmup.js`, `css/warmup.css`) shows Dralingo doing the 6-7 instead of the meme.
- Art: `assets/sixseven/dralingo-67-a.webp` + `-b.webp` (34 KB each; Higgsfield Nano Banana Pro in his Chrome,
  Unlimited, 0 credits; frame b is the mirror of a; originals + how-made in
  `assets-library/higgsfield/2026-10-15/sixseven/`). Sounds `assets/sixseven/` (Kenney CC0: music-swing, wrong, coins;
  the platform voice: liu, qi, liuqi; 292 KB for the whole folder). Shared sounds reused from `assets/kingdoms/`.
- Retired: `assets/png-library/67.png`, `67-transparent.png`, `scripts/bg-removal-67.js`, `sounds.js` `themeSixseven`,
  `tap6`, `tap7`, `swingWhoosh`, `comboBell`, `sixSevenChant` (grep: no other user).
- Registrations: games.html (new description, «Nuevo», Equipos · Números 1-10 · 2–40 jugadores), maestro.js blurb,
  test-wording (the new files; pinyin tone marks refused in the 6-7 files), `docs/GAME_MODES.md`,
  `docs/HOW_CLAUDE_WORKS.md`, the roster in `CLAUDE.md`.
- Tests: `scripts/test-sixseven.js`, `scripts/test-sixseven-live.js`, bots `scripts/playtest/sixseven.js`.

### Design pass (frontend-design, emil-design-eng, design-taste-frontend, impeccable, web-design-guidelines)
Design read: a kids' game-show phone + projector for a Mandarín school, playful-premium Nintendo / Mario Party language
on the platform's own system (ink outlines, Baloo 2 / Nunito, team red / blue, gold); a night on Dubai Creek so it reads
apart from Mochi Mash's sunset and the piñata party at dusk; one memorable object (the golden balance), everything else
quiet; the two buttons teal and violet so no kid reads a button as a team.

| Before (first build) | After | Why |
| --- | --- | --- |
| A third chain in the middle of the beam read as a ⚠ sign | Two chains, one per pan | The balance must read as a balance at phone size |
| Pans spilled off the phone; borders thick on the mini balance | The balance is drawn in container-query units (beam 15–85 cqw), borders scale with it (`--bw`) | One drawing, crisp from the 64 px lobby step to the projector |
| Coin piles were dark combs at small sizes / a mound in the run-in | Stacks of coins with rims, filling each pan | Gold has to look like gold |
| The landmark race marker hid behind the medallions | Marker above them | Progress readable from the back of the room |
| Result kids tiny, the rain cloud far above them | Crew 58 % of the stage (two rows over 5 kids) on the projector, 38 vh on the phone; the cloud sits on their heads | The losers' reaction must be seen |
| The winners' captain said «¡Pista resuelta!» (mystery mood) | A new `oro` mood for every character | Lines true to this game |
| The last-30-s chip covered the mini balance | The chip sits on the sum card's corner | Never over what the kid reads |
| A long press answered and its click answered the NEXT sum | The press answers (pointerdown); a click within 2.5 s of a press is ignored (keyboard still works) | One tap = one answer |
| «Pregunta dorada · +5» on the card | «¡Pregunta dorada!» | The comeback cap can lower the +5 |
| A Fuego kid playing Dralingo was a blue dragon with a red outline | Fuego's Dralingo is the same art turned on the colour wheel (`hue-rotate(140deg)`, the kandura and ghutra stay white), only on the 6-7 pages | His rule: Fuego = red Dralingo, Mar = blue |
| The rain cloud floated far above short characters (a camel, a plane) | `fitCloud` brings it down to the tallest drawn head of the crew (from the layout boxes, so entrances don't move it) | The losers' moment reads as one picture |
| Podium stars floated in the sky over short characters; a tie showed 1 and 2 | Stars on a white pill on the step; the step shows the rank | Ties share; nothing floats |
| The pans hung below the end of their chains; the landmark track touched the balance like a second beam | Chains to the dish rim; the race on a dark rail with 22 px prizes and the team markers above / below it | The centrepiece must read as one real object |
| A flat button press | The button sinks 6 px onto its ink shadow in 80 ms (strong ease-out), then pops; the balance tilts on a spring (0.9 s) | The tap must feel physical and instant; the slow part is the world, not the button |

Detector (`impeccable detect`, once at the end): 3 findings, kept on purpose: the stage floor's top line on the ceremony
(a floor edge, not a rounded card), white 6 / 7 digits on the teal / violet pictured buttons (an ink outline 3-4 px
gives the contrast; the detector reads the fill only), the golden coin's glow (it marks a golden-sum coin). Advisory: the
pop easing (the incumbent game-show language, as in Mochi Mash and Piñata), the coin-rim stripes (a real coin stack).
Guidelines: `aria-label` on both buttons («6, liu» / «7, qi»), focus-visible on every button, aria-live on the sum,
the verdict, the lock and the banners, `prefers-reduced-motion` (no swing, sway, flights, confetti, rain; the balance
jumps to its tilt, the dancer holds one frame, the gold frame stays still), `touch-action: manipulation` + no callout on the buttons, safe areas,
`toLocaleString('es-ES')` numbers, `text-wrap: balance` on headings, `color-scheme` + `theme-color` + `translate="no"`
on the projector, the dancer's `<img>` with width / height. No em dash in kid text.

### Test hooks
`SixSevenPhone.frame() / tap(6|7) / hold(v) / freeze(v) / replay(ev) / queued() / stage(name) / sim(ev, d) / runIn() /
rules(ms) / milestone(n)`, `SixSevenHost.frame() / freeze(v) / replay(ev) / queued() / hold(v) / stage(name) / sim(ev, d)
/ runIn() / score(...)`.

### Tests
- `node scripts/test-sixseven.js`: 390,830 checks (every sum of every style is 1-10, + / −, answer 6 or 7, no repeat in a
  row, «Mezcla» alternates; the judge: one answer per sum, too fast = wrong, time-up, the streak multiplier, the waits
  (1.6 s / 2.6 s), golden sums and the comeback cap at the gap, the frenzy ×2, size weighting, landmarks, lead hysteresis,
  pause / +30 s shifts, late joiners and rescale, the stars and ties; 60 simulated 2-minute games per kind of kid: a kid
  who thinks **134** coins, a slow thinker **66**, a fast guesser **61**, a masher **0**; 300 simulated classes: 0.67 coins
  per kid per second, 3.3 landmarks a game, the Burj Khalifa reached in 92 of 300, 2 ties).
- `node scripts/test-sixseven-live.js --url http://localhost:3900`: 60 checks on a running server (the lobby and the
  style picker, «Equilibrar equipos» with a kid who left (2 / 2 every time; the kid sits the round out), the captains, the intro and «Saltar», a right answer and its coins, a wrong one and its wait, a too-fast
  tap, a double tap = one verdict, an answer to an old sum ignored, «Pausa» (sum held, answers handed back) and «Seguir»,
  «+30 s», a reconnect gets its open sum back with the time really left, rejoin keeps team + gold, a late joiner to the
  smaller team, swaps refused mid-game, «Terminar» → «¡FINAL!» → the cards, «Saltar» on the ceremony, «Otra ronda»).
- Bots (`node scripts/playtest-bots.js --game sixseven --bots N --seconds 60`; `scripts/playtest/sixseven.js`: thinkers
  read the sum and tap right ~88 % after 0.9-2.4 s; Bot03 the masher taps a random button 120-300 ms after each sum, Bot04
  the guesser a random button after 0.4-0.7 s, Bot05 never taps; every verdict, coin and total is checked), final code:

| Bots | Result | Sums | Answers (right / wrong / of them too fast / time up) | Golden | Leads · landmarks · frenzy | Coins: thinkers avg (min) · guesser · masher · sleeper | Events per kid (avg / max) | Meter per kid |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | PASS, 0 frozen, 0 errors, 0 stale | 104 | 102 (58 / 44 / 22 / 0) | 6 | 1 · 4 · 1 | 95 (89) · 22 · 0 · — | 111.3 / 119 | 42 |
| 20 | PASS, 0 frozen, 0 errors, 0 stale | 505 | 491 (391 / 100 / 22 / 4) | 51 | 3 · 4 · 1 | 87.7 (50) · 41 · 0 · 0 | 147.6 / 165 | 75 |
| 30 | PASS, 0 frozen, 0 errors, 0 stale | 755 | 733 (605 / 128 / 21 / 4) | 79 | 1 · 4 · 1 | 92.3 (39) · 13 · 0 · 0 | 146.6 / 157 | 75 |

  Random tapping loses to thinking in every run: the masher earns 0 (every tap «too fast»), the guesser ends below every
  thinker, even the weakest (22 vs 89 with 4 bots, 41 vs 50 with 20, 13 vs 39 with 30; the run before the last fixes: 16 vs 68, 32 vs 35, 33 vs 39) and far below their average. Events per kid ≈ 2.4 a second (its own sums and verdicts ≈ 25 each a minute, the meter 74, `state` ≈ 10);
  no room-wide event per answer.
- The other tests pass on the same code: test-wording (47 files), test-packs (82 rounds), test-mochi 1,593, test-pinata
  248,399, test-halcon 68,229, test-kingdoms, test-paint, test-snow, test-escape, test-archive; live: test-mochi-live 49,
  test-pinata-live 53, test-halcon-live 37 (all on the final server code, after the shared «Equilibrar» fix). `node --check` on every changed file.

### Reviews and what they changed
- `agent-skills:code-reviewer` ("request changes", no blockers), 8 items, all done: an answer for an older sum is dropped
  (the sum's id checked on the server); a long press + its click no longer answers the NEXT sum (the press answers, a
  click within 2.5 s of a press is ignored, the keyboard still works); a reconnecting phone gets its open sum with the time
  really left (dropped under 3 s, no streak lost); a sum shown during «Pausa» starts held and a finished sum never
  restarts its clock or buttons; a pooled coin whose slot is reused still lands (its callback runs) and the counter
  repaints on its own beat; «Terminar» from the pause card un-pauses the phone; the tap rescue never brings the buttons
  back under the pause card; the golden card says «¡Pregunta dorada!» (the comeback cap can lower the +5).
- `classroom-playtester` (20 and 30 bots + 3-5 real phones and the projector, 8 rounds, 3,754 sums): PASS, 0 frozen,
  0 stale, 0 errors, 0 console errors; all three styles, Pausa (22 s), +30 s, Saltar (intro and ceremony), Terminar (in
  play and from the pause card), swaps, F5 on the projector, phone reloads mid-game and after the end, late joiners all
  worked. Fixed after its report: «Equilibrar equipos» counted kids who had left (an empty team could start; shared by
  every team game: now only connected kids are split, live test); a kid who left before the round sat in the ceremony
  as a 0-gold figure (now out of the round until they come back); a kid with no saved avatar saw a different character
  on the phone than on the projector (the phone now uses the server's character); «Inicio» on the card took kids out of
  the class (now «Quédate aquí: tu profe puede empezar otra ronda» + a quiet «Salir del juego»); «0 aciertos · 0 %
  puntería» on a card (a kid with no right answer sees only «N cuentas jugadas»); the projector's star winner rose late
  (now 0.45 s, like the phone); the podium split a tie (uses the rank) and its stars floated over short characters (now
  on the step); my name tag cut in the run-in; the teaching hand covered «qi»; «Seguir» kept the pause icon; «¡FINAL!»
  left the buttons bright (now a full dim) and a lead banner on top (cleared).
- Fresh-eyes finish review (impeccable; a subagent that only saw the screenshots): "fix, then ship" (the phone play
  loop and the Dubai look at the bar), 8 items: (1) the chains stopped above the pans, so every balance floated → the
  chains reach the dish rim; (2) after a miss the right answer showed in red → gold like its glowing button, and the
  «Espera…» / «¡Respira!» pill moved to the top edge of the buttons (the digits stay readable under the dim); (3) a phone
  of the team that lost read the winners' captain («¡La balanza es de ustedes!») → its own captain with a new `casi`
  line (every character, Aileen in voseo); (4) the projector's result left one kid alone in the back row → two even rows;
  (6) the racha Dralingo now lands inside the phone frame; (7) the landmark track read as a second beam with tiny prizes
  → a dark rail of its own, «+55» at 22 px beside each landmark, the team markers above and below it, the balance lower;
  (8) the card hides «puntería» under 50 % and «Quédate aquí…» is a plain line, not a box. Item 5 (a crowd piled at the
  left edge in the last 30 s) was the screenshot harness rewinding the run-in animations, not the game (live play
  shows even slots).

### Scorecard
```
Scorecard · 6-7 Swing v2 «La Balanza de Oro» · 2026-10-15 · branch worktree-agent-aacedd1f25206adee
Hard gates: bots PASS (4/20/30, 0 frozen, 0 errors, 0 stale; playtester 20/30 + 8 browser rounds) · teacher controls ✓
            (Pausa, +30 s, Saltar intro + ceremony, Terminar in play and from the pause card, Sonido, swaps, Equilibrar,
            F5 keeps the room, Otra ronda; live test + playtester) · saga only ✓ (Dralingo's 6-7 is our Higgsfield art,
            the cast, the meme figure removed; test-wording) · Spanish / pinyin without tones / level ✓ (YCT 1 numbers
            1-10 and + / − only, «6 · liu» / «7 · qi», no hanzi on the phone; tone marks refused by test-wording) ·
            kid-safe ✓ (figures side by side, nobody touching)
1 Real place ........ 2/2  night on Dubai Creek, a giant golden balance; the landmark race (Museo del Futuro, Marco de
                            Dubái, Burj Al Arab, Burj Khalifa) worth +4 % gold to the first team there
2 The gang .......... 2/2  Dralingo in his platform look does the 6-7 (projector, run-in VS, rachas, result); a captain
                            of the gang per team with swing / oro lines (Aileen in voseo) on leads, landmarks, the winner;
                            every kid full-body in the team colour (Fuego's Dralingo red) on phone and projector
3 Every tap ......... 2/2  two giant buttons «6 · liu» / «7 · qi» (the lower third), press + pop with rising pitch,
                            buzz, the voice says liù / qī, my character swings, coins fly; the 3-step pictured card,
                            the tapping hand on the first sum, the lock card names the wait («¡Respira! Piensa y toca»)
4 Feedback .......... 2/2  right / wrong / too fast / time up / golden / racha ×2-×4 / landmark / lead each with its own
                            reaction; Dralingo's racha entrance ≥ 2.5 s apart, banners one at a time, none over the buttons
5 Finale ............ 2/2  lead alarms, landmarks, golden comeback sums, last 30 s «¡Doble oro!» + countdown; «¡FINAL!»,
                            the great weigh-in (leans the wrong way first), winners swing / losers sob under a rain
                            cloud, 6 bonus stars, podium + MVP per team, my own card
6 Fair, no stall .... 2/2  server-judged: one answer per sum, too fast = wrong, multiplier + waits (a masher earns 0, a
                            guesser less than the weakest thinker in every run), comeback extra capped at the gap, size
                            weighting, late joiners to the smaller team; nothing waits on a kid (the server calls time up)
7 Product feel ...... 2/2  our Dralingo art, the saga, Kenney music + effects and the platform voice (no beeps); the
                            phone as finished as the projector at 390 px and 1600×900
Total 14/14 → ships (≥ 12, no 0)
```

### Open
- **Not deployed**: the branch is committed only. Deploy with the `deploy-platform` skill after asking him whether a
  class is running.
- The pace (`E = 0.95 × seconds × average team size`, landmarks at 12 / 32 / 58 / 88 %) comes from bots and the simulator (the
  Burj Khalifa in 31 % of simulated games): check with a real class that a 2-minute round reaches it only when a team
  plays well. The too-fast line (400 ms) is measured from the server sending the sum, round trip included: watch a real
  class on slow Wi-Fi for honest taps called «¡Muy rápido!».
- «Escucha» (hear the sum) left out on purpose (30 phones talking at once); the voice says the answer on every right tap.
- Dralingo's second dance frame is the mirror of the first (one Higgsfield picture); a true second pose needs another
  Higgsfield pass in his Chrome.
- Done in Mochi Mash v2 and Piñata v2 too (same branch, after this game): the phone shows the server's character
  (`mySkin()` uses its `sk`), the end card says «Quédate aquí: tu profe puede empezar otra ronda» with a quiet «Salir
  del juego» instead of the big «Inicio», and Fuego's Dralingo is red (`mochi.css`, `pinata.css`).
- Left as in the other games: «Terminar» pressed during the intro gives a 0–0 «¡Empate!» ceremony (short, skippable);
  during the 3.5 s countdown «Terminar» is hidden; «Terminar» asks with the browser's own confirm box; `host:reclaim`
  checks no teacher login (pre-existing for every game).

## As built · 2026-10-16 («no dead phones», branch `sixseven-alive`)
### Files
- `core/sixseven.js`: `RIGHT_MS` 500 → 650 (the in-between beat), `PER_KID_S` 0.95 → 0.90 (the landmark pace kept: the
  Burj Khalifa in 94 of 300 simulated classes, 31 %, as before); the kid's own «six seven» flags in `answer()` (`six`:
  1 = racha 7, 2 = the 67th coin; `pair` = a right 6 then a right 7; cosmetic, after `credit()`); the team waves in
  `tick()` (`WAVE_FIRST` 67, then every `waveStep(E)` ≈ E ÷ 3 rounded to a multiple of 67, a team's waves ≥ 12 s apart,
  moved by a pause, spaced out by rescale); `min` (the too-fast line) in the dealt sum; the feed entries
  `[coins, golden, wrong, six]` (golden only when the extra was paid); the «Experto en Chino Mandarín» star.
- `server.js` «6-7 SWING v2» block: `ss:wave` to the room; the phones' meter every 750 ms carries `f` (up to 4 scorers
  of each team: «six seven» kids first, then the biggest, ties shuffled); the verdict carries `six` / `pair`; `ss:init`
  carries the beats `w`; `ss:pause` carries the meter (the pause card shows that moment's score).
- `public/js/player-sixseven.js` (the play loop rewritten): the instant reaction (`predict` → `apply`, the server's
  verdict `settle`s or `revertGuess`es; the same sum sent again, a paused stale or a new sum undo a guess the server never
  judged; a 3 s rescue re-sends a guessed answer once; a 200 ms margin after a pause), my coins' `shots` shown on top of
  the meter until the first meter after the verdict (never counted twice), the world (`paintTeam` crews, `feed`,
  `whoChip`, `gang`, `footDance`, `crewCheer`), the «¡SIX SEVEN!» moments (`sixStamp`, `mySix`, `wave`), «¡Recargando!»
  (`lockUI`), the pause score. `public/js/sixseven-stage.js`: `palms`, `wipe`, `sumValue`, `Balance.rock`, the coin layer
  measured once per size. `public/css/sixseven.css`: the world (`.ssx-world` and its parts), the recharge lock, the
  «SIX SEVEN» banner / stamp, the projector's crowd cheer / bob, kid pops, Dralingo's hype, reduced-motion fallbacks.
  `public/player.html`: the world markup (6-7 block only). `public/js/host-sixseven.js` + `host-sixseven.html`: the band
  queue (no band in the last 10 s, none after «¡FINAL!»), `ss:wave`, kid pops, crowd cheers on leads / landmarks / waves,
  the last-30-s gap callouts, Dralingo's lines at least 2.5 s each (two teams' waves together = one line).
- `public/js/cast.js`: a `sixseven` mood line per character (after `swing`; Aileen in voseo, Adric and his dog…).
- `public/assets/sixseven/shout67.mp3` (11 KB): «six… SEVEN!» shouted by a crowd, made from Kenney's Voiceover Pack
  (CC0: the announcer and the male / female voices saying "six" and "seven", pitched up into kids' voices and layered a
  few ms apart, a short echo, loudness-normalised; recipe in the scratchpad `ss67/shout.sh`, sources in
  `assets-library/kenney/…/Audio/Voiceover Pack*`). Plays with the global mute.
- Tests: `scripts/test-sixseven.js` (+ the six flags, the pair, the waves, their gap and pause shift, the wave stats in
  300 simulated classes), `scripts/test-sixseven-phone.js` (NEW: the real phone module in a tiny fake page with a fake
  clock and socket: the guess, settle and revert paths, the meter never counting my coins twice, the golden extra
  before / after landing, the pause score, a capped golden sum), `scripts/test-sixseven-live.js` (+ `ss.min`, the six
  flags, another phone seeing A's coins in the feed), `scripts/playtest/sixseven.js` (+ the waves, the six flags, the
  feed's shape). Docs: this spec, `docs/GAME_MODES.md`, `docs/HOW_CLAUDE_WORKS.md`, the «no dead phones» rule in
  `CLAUDE.md` (copied word for word from his main checkout).
- Kept on purpose: `cast.js?v=` in player.html (the server revalidates every file, max-age 0 + ETag; another branch is
  editing the cast too, so the bump is left to whichever merges last); «Esperando al anfitrión» in the shared lobby
  (player.js, every game); the lobby's style button «En Chino» (short label).

### Tests (final code)
- `node scripts/test-sixseven.js`: 390,864 checks; thinker 127 · slow thinker 65 · fast guesser 60 · masher 0 coins in
  a 2-minute game; 300 simulated classes: 0.65 coins per kid per second, 3.3 landmarks a game, the Burj Khalifa in 94;
  waves 2.7 a team per game (at most 4, never a game without one, a team's two closest 13.4 s apart).
- `node scripts/test-sixseven-phone.js`: 44 checks. `node scripts/test-sixseven-live.js --url …`: 63 checks.
- Bots (`--seconds 60`, the fast bots of `scripts/playtest/sixseven.js`), all PASS, 0 frozen, 0 errors, 0 stale:

| Bots | Sums | Answers (right / wrong / too fast / time up) | Waves | Pairs · racha 7 · 67th coin | Coins: thinkers avg (min) · guesser · masher | Events per kid avg / max |
| --- | --- | --- | --- | --- | --- | --- |
| 4 | 105 | 101 (60 / 41 / 21 / 0) | 3 | 8 · 2 · 2 | 88 (76) · 28 · 0 | 125 / 136 |
| 20 | 477 | 463 (376 / 87 / 21 / 4) | 8 | 73 · 22 · 11 | 84.9 (56) · 9 · 0 | 150 / 159 |
| 30 | 728 | 710 (597 / 113 / 22 / 4) | 8 | 118 · 31 · 22 | 87.7 (40) · 27 · 0 | 153 / 169 |

  (Bots answer faster than a class, so they reach more waves than the ~2-3 a team of a real 2-minute round.)
- Every other test passes on this code: test-mochi 1,593 · test-pinata 248,399 · test-halcon 68,229 · test-kingdoms ·
  test-paint 120,728 · test-snow 94,768 · test-escape 319,101 · test-packs 82 rounds · stress-packs · test-wording 52
  files · test-archive 27 · test-ruta-dorada 91 · test-ruta-progress 161 · test-ruta-training 165 · test-level-keys 203 ·
  test-sims-lock 413 · test-golden-book 263 · test-audios-base 3,502 (with `STUDY_DIR`) · asset-guard exit 0.

### Reviews and what they changed
- `agent-skills:code-reviewer`: approve after two Important items, both done: (1) the team meter briefly counted my own
  coins twice (an update that already held them arrived before they landed) → my coins in flight are shown on top of the
  meter only until the first meter after the server's verdict (same socket, in order); (2) no automated test of the
  guessing → `scripts/test-sixseven-phone.js`. Also done: a guess never judged (a rejoin dropped its sum) is undone when a
  new sum arrives; a margin after a pause; the phones' feed 4 per team (the trailing team sees its own teammates); the
  coin layer measured once; no stale band over the ceremony; the gap chip no longer chatters to screen readers; a golden
  extra after landing pops only the difference; the beats sent in `ss:init`; a comment on merged waves.
- `classroom-playtester` (1 projector + 2-4 real phones at 390×844 and 360×640 + 24 socket kids, 3 full rounds, a small
  class of 6, bots 20 / 30): **PASS: no phone ever dead between questions** (sampled every 0.5 s: never quiet for more
  than 2 s between sums; the reaction on the tap 150 of 150 times; per phone per round ~50 «+N» teammate chips, ~30
  teammate «six seven» chips, 8-10 big stamps, 11 Dralingo entrances; no plain wait screen; buttons and sum never
  covered; no console errors). Teacher controls, F5, reloads and late joiners all worked. Fixed after its report: the
  pause card showed a score up to 750 ms old (now sent with the pause); my corner piled up («+N» on the racha chip, the
  mini stamp on the teammate chip) → «+N» rises from my pan, the mini stamp sits on the pillar, the teammate chip shares
  the other corner with my captain one at a time; the projector band hid the last-10-s number (now above it, and no band
  in the last 10 s); Dralingo's lines raced each other (each stays ≥ 2.5 s, two waves together = one line); a golden sum
  capped to 0 by the comeback rule no longer plays the golden fanfare; «Capitana» capitalised in the run-in; «Experto en
  Chino Mandarín».
- Design pass: `emil-design-eng` (the per-answer motion fast and transform-only: palms 420 ms, the coin 470 ms, the wipe
  230 ms; the rare moments get the delight: stamps, the shout, the crowd), `design-taste-frontend` (design read: an
  in-class kids' game phone, playful-premium game-show language on the platform's own system; anti-clutter, motivated
  motion, reduced motion, no em dash), `impeccable` craft floor; detector once at the end: it flagged a 8 px side stripe
  on the new phone banner (removed: my team's wave is gold, the rivals' wears their colour); kept as before: the
  ceremony floor's top line and the game-show pop easing.
- Fresh-eyes finish review (a subagent that only saw the screenshots): "fix, then ship" (the phone has life between
  questions, the 6-7 shows during play, the sum and the buttons are never covered). Done: the phone's banners now slide
  in just under the score bar (the score stays on screen, even in the last 30 s) and the world's top chips step aside
  while one shows; my own «¡SIX SEVEN!» holds the next banner for a beat and hides the teammate chip; a rival's wave is
  one compact line in their colour; on a small phone (360×640) the crews are me + one mate and one rival, side by side
  with a gap (nobody touching), and Dralingo's entrance is smaller; «me» gets a gold glow on the ground; the last-30-s
  chip sits on the card corner away from my «TÚ»; «¡Falta 1 para alcanzarlos!» in the singular; projector: bigger race
  markers and kid names, a stronger tilt (×3.2), the lead band without a duplicate bubble line (in the last 10 s the
  bubble says it instead of a band), lead / landmark bands above Dralingo's head, the crowds clear of the gold frame.
  Kept: the projector race stays a track with team dots (bigger now), not captains' faces.

### Scorecard
```
Scorecard · 6-7 Swing v2 «La Balanza de Oro» · second pass «no dead phones» · 2026-10-16 · branch sixseven-alive
Hard gates: bots PASS (4/20/30: 0 frozen, 0 errors, 0 stale; playtester 3 rounds + small class) · teacher controls ✓
            (Pausa with the live score, Seguir, +30 s, Saltar intro + ceremony, Terminar in play and from the pause card,
            Sonido, F5, Otra ronda) · saga only ✓ (our Dralingo art, the cast; the shout is Kenney CC0 voices) ·
            Spanish / pinyin without tones / level ✓ («6 · liu», «7 · qi», no hanzi; «Chino Mandarín») · kid-safe ✓
            (figures side by side in the crews)
1 Real place ........ 2/2  night Dubai Creek, the golden balance now on every phone too, the landmark race worth gold
2 The gang .......... 2/2  Dralingo at the foot of every phone's balance doing the 6-7 when my team scores, sliding in on
                            rachas and «six seven»; my captain's bubble reacts (a slip, a lead, a wave, the last 30 s);
                            my two mates and two rivals full-body in team colours on my phone
3 Every tap ......... 2/2  the reaction lands ON the tap (no Wi-Fi wait): palms swing, my character swings, the voice,
                            my coins fly into my team's pan; the pictured rules, the tapping hand, «¡Recargando!» /
                            «¡Respira! Piensa y toca» name the wait
4 Feedback .......... 2/2  right / wrong / too fast / time up / golden (only when paid) / racha / six seven / landmark /
                            lead / wave each with its own reaction; one Dralingo at a time, the news corner one at a time,
                            team waves ~2-3 a team, bands queued, none in the last 10 s
5 Finale ............ 2/2  lead cheers, waves, landmarks, last 30 s with crowds bobbing, gap callouts and the countdown;
                            the Mario Party ceremony unchanged
6 Fair, no stall .... 2/2  unchanged rules: server-judged, too-fast line, multiplier + waits (a masher 0, a guesser below
                            the weakest thinker in every run), comeback capped at the gap; the phone's guess never decides
                            gold (the server's verdict settles or reverts it, tested)
7 Product feel ...... 2/2  the phone is now a living mini of the projector at 390 and 360 px; our art, Kenney music and
                            effects, the platform voice and a crowd shout (no beeps)
Total 14/14 → ships (≥ 12, no 0)
```

### Open (second pass)
- **Not deployed**: committed on the branch only; deploy with `deploy-platform` after asking him whether a class runs.
- Watch in the first real class: the waves' pace (~2-3 a team in 2 minutes) and the shout's volume with 30 phones; a
  guessed reaction taken back (the server disagrees) should be rare (a pause racing a tap, a sum dropped on a rejoin);
  how often kids on slow Wi-Fi see «¡Muy rápido!»; whether the phone world stays smooth on the cheapest phones.
- Art requests (no generation done): Dralingo's true second 6-7 frame (frame b is still the mirror of a), and one
  «6-7 palms up» pose per saga character (11 avatars on green, Higgsfield Unlimited) so the crews do the real gesture.
