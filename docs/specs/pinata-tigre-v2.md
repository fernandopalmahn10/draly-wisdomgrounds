# Piñata Tigre v2 · «La Fiesta de las Piñatas» (team hits + timing meter, Mario Party style)

gameType `pinata` · address `/host-pinata.html?setId=…` (unchanged: games.html, packs.html, sets.html, /maestro keep
working) · remade 2026-10-15 on a worktree branch, not deployed.

## Why (his words, 2026-10-15)
"I loved Mochi Mash" (v2 «La Terraza del Mochi», 14/14) → "remake Piñata Tigre next, same as Mochi Mash". Same Mario
Party feeling, same quality bar, the same feelings at the end of class, super addictive, every design filter passed.

## Kept from the old game, and its flaw fixed
- Kept: the address, **hitting a tiger piñata** and **the timing meter for a critical hit** (the first version,
  commit 58d7956ab, had a power meter; the second, c8b5db5ad, turned it into a tap mash).
- Fixed: in the first version only the FIRST kid who answered right won a hit, so most of a class of 20-30 watched.
  Now **every right answer is a hit** for that kid, and a fast answer adds power. Every kid acts every round.
- Gone: Equipo Bastón / Arco, the emoji tigers, lanterns, the synthesized thwack, the old smash screen, `pn-smash-*`.

## Design decision: one piñata per team, a ladder of piñatas
Considered: (a) both teams hit ONE giant piñata and the breaking hit (or the collected candies) wins; (b) each team its
own piñata. Chose (b) as a ladder:
- (a) makes the breaking hit a lottery ticket (one lucky kid decides) and mixes both teams' feedback on one target, so
  a kid can't tell whose hits moved it. (b) keeps the clean tug-of-war he loved in Mochi Mash: MY team's tiger, OUR
  candies, THEIR tiger cracking on the other side.
- A single piñata per team for the whole game would burst only at the end. The juicy moment (the burst, the candy
  shower) must happen DURING play, for both teams, several times. So each team breaks a **ladder of tigers**: every
  tiger hangs under a Dubai landmark; when it bursts, its candies rain on the team and the next, bigger tiger drops in.
- Score = **caramelos** (candies). A hit knocks out as many candies as its power; a burst spills the tiger's jackpot;
  the first team to break the tiger of a landmark wins that landmark (a bonus). More candies wins.

## The world
- **Setting:** an evening party on Dubai Creek (`assets/dubai/skyline-wide.webp`, Burj Khalifa and Museo del Futuro on
  the water) under a string of party flags and lights; a sandy-gold party courtyard. Evening sky, so it reads
  differently from Mochi Mash's pastel sunset.
- **Teams:** Equipo **Fuego** (red, server id `red`) and Equipo **Mar** (blue, server id `gold`), like Reinos and
  Mochi Mash.
- **The tigers:** our own glossy 3D toy tiger piñata (fringed crepe-paper rows, orange with black stripes, big friendly
  eyes), made with Higgsfield Nano Banana Pro in his Chrome (Unlimited): an orange tiger and a golden tiger, each with a
  **red bow (Fuego) or a blue bow (Mar)**: the team colour is on the piñata itself. Files `assets/pinata/tiger-*.webp`.
  Cracks are drawn over the picture (geometry); the burst cuts the same picture into chunks that fly apart.
- **The ladder (both teams climb the same one):** 1 Museo del Futuro · 2 Marco de Dubái · 3 Burj Al Arab · 4 Burj
  Khalifa (the golden tiger) · then more golden tigers («¡Tigre de oro!»), no landmark. Each tiger is bigger than the
  last and holds more candy.
- **Every kid is their full-body saga character** (`MochiStage.kidFigure`: `assets/halcon/cast/*`, animals from
  `assets/saga/anim/*-still.webp`) with the team-colour sticker outline, holding a **piñata stick** taped in the team
  colour. Never a face crop in the play area.
- **Candies** are geometry (CSS): wrapped candies in five flavours and round swirl lollipops; the golden candy for
  criticals.

## Flow (server-timed; constants in `core/pinata.js` `R`)
1. **Lobby.** Projector: PIN + QR, «Así se juega» in 3 pictured steps, the two teams as full-body characters (tap a
   kid to change team, «Equilibrar»), 2 / 3 / 4 min, «¡A romper!». Phone: «¡Eres del Equipo Fuego!», my character in
   the team colour next to my team's tiger, the same 3 steps (answer · stop the arrow on the gold · break the piñata).
2. **Countdown (3.5 s) = the run-in.** Projector and every phone: the red | blue split, each team's tiger swings in on
   its rope, the team runs in behind its captain (one of the gang, `cast.js` lines), me marked «TÚ».
3. **Intro (2.8 s).** One pictured control: the meter with the arrow sweeping and a tapping hand, «¡Para la flecha en
   el dorado!» → «¿Listos?» → «¡YA!». The teacher can skip it.
4. **Play.** Every kid gets curriculum questions (Kahoot tiles of the shared skin, 20 s timer with ticks, the team bar).
   A strip under the bar says what to do: «Responde bien → ¡un golpe a tu piñata!» and my candies.
   - **Right** → «¡Correcto!» (0.8 s; «¡Rápido! +1», «¡Racha!» notes) → **the hit** (below).
   - **Wrong / time up** → «¡Casi! La respuesta era …» 2.2 s → the next question (no hit: the wait is the cost).
5. **The hit (the addictive core, 2-4 s).** The whole phone is one tap zone. Top: my team's tiger on its rope under
   the landmark, its crack bar. Bottom-left: my character with the stick. Bottom: **the meter**, a wide bar split
   flojo · bien · fuerte · **dorado (crítico)** · fuerte · bien · flojo, and an arrow that sweeps back and forth.
   - One tap stops the arrow → my character winds up and swings, a recorded whack (pitch by grade), vibration, the
     screen shakes (more for stronger hits), the tiger jolts and swings, cracks spread, candies fly out (as many as the
     hit's power) and land in my counter, «+6» and the grade stamp: «Flojito» · «¡Bien!» · «¡Fuerte!» · «¡CRÍTICO!»
     (gold, stars, a flash, a longer buzz).
   - **Racha** chip that grows: ×3 (+1 power, orange), ×6 (+2 power, «¡En llamas!»).
   - No tap in 2.7 s → an automatic «Flojito» hit (power 1): the class never waits, and an automatic hit never earns
     more than a tap.
   - My hit broke the tiger → the BIG moment on my phone: the tiger bursts into pieces, a shower of candies, «¡ROMPISTE
     LA PIÑATA!» + the jackpot, then the next tiger drops in. The next question waits 1.6 s more.
   - 1 s after the hit: the next question.
6. **Rising excitement.**
   - **Live candy meter** on both screens (tug bar) + each team's tiger and its crack bar (how much is left).
   - **Damage stages:** the tiger cracks at 75 / 50 / 25 % of its life left, sags and tilts when it is about to break.
   - **Carrera de monumentos:** the first team to break the tiger of a landmark wins it (+bonus, its picture flies to
     the team, a banner on every phone); the other team still gets its own tiger's jackpot when it breaks it later.
   - **Lead-change alarm** on the projector and as a top banner on every phone (never over the answer tiles); a lead
     counts at ≥ 4 candies and ≥ 3 % of the total, alarms ≥ 7 s apart.
   - **¡Últimos 30 segundos! ¡DOBLE GOLPE!** Every hit counts ×2 (candies and damage: more bursts at the end), final
     music, a gold frame, the last 10 s big on the projector and as a chip on phones.
7. **«¡FINAL!»** (2.4 s) on every screen; a tap in flight (≤ 0.6 s) still counts; open meters become automatic hits.
8. **The ceremony (game-end, ~18 s, «Saltar» on the projector jumps every phone to its card).**
   1. *La piñata final:* both teams' tigers burst together, their candies pour into two candy jars that fill with a drum
      roll; the smaller stops, the bigger keeps rising: «¿Quién juntó más caramelos?» (3.6 s).
   2. *¡Gana el Equipo …!:* the winners jump in their victory pose with confetti in the team colour and their
      captain's line; the losers clearly react: sad pose, they slump and sob, a little rain cloud over them and an
      «aww» (3 s). A tie: both teams cheer, «¡Empate!».
   3. *Estrellas Bonus,* one by one (2.2 s each): Más golpes · Más críticos · Respuesta más rápida · Racha más larga ·
      Gran remontada. A phone that won it: «¡ES PARA TI!».
   4. *The end card:* projector podium (top 3 by candies, full body, stars on their badges), the MVP of each team, «Otra
      ronda». Phone: my card (my character in the team colour, victory or sad pose, my team's result, «Sacaste 87
      caramelos», «El 14 % de tu equipo», hits · criticals · best streak · piñatas I broke, every star I won); a kid with
      0 gets «¡La próxima es tuya!», never shame.

## The hit and the meter (server-judged)
- The meter is a pure function the server owns: `needle(c) = triangle wave` with a half-sweep of `HALF_MS` (900 ms) and a
  random start `phase` per swing (so nobody can tap blind on a rhythm). Grade by the distance `d = |p − 0.5|` from the
  centre: **crítico** `d ≤ 0.075` (15 % of the bar), **fuerte** ≤ 0.20, **bien** ≤ 0.34, **flojo** beyond.
- Right before the right answer's `answer-result` (which carries the swing: `hid`, phase, half, zones, lead, window)
  the server sends `pn:ping` WITH an acknowledgement; the phone acks it before its answer handlers run. The round trip
  used is the median of that phone's last 5 pings (one jittery sample doesn't move the judge; an ack that lands during a
  pause is ignored). No ping answer: 250 ms.
- The phone draws the arrow from the same function on its own clock (started LEAD_MS after the answer-result arrived)
  and sends `player:pn-hit { hid, c }` (c = ms since its arrow started). The server computes where that tap must have
  happened by its own clock, `est = (receipt − sent) − LEAD − RTT`, and uses the phone's `c` only when it is within
  `est ± TOL_MS` (150 ms); otherwise it grades the tap at `est`. So an honest phone is judged on exactly what the kid
  saw, and a tampered clock can only nudge a tap by ±150 ms around the moment it really reached the server, never
  claim a different moment. (A tap that crossed the teacher's «Pausa» is handed back and the kid taps again after
  «Seguir»; a tap lost in a Wi-Fi blip is sent once more after the rejoin, and the swing stays open until its window
  ends.)
- Power: flojo 1 · bien 2 · fuerte 3 · **crítico 6** · automatic 1 (no bonuses). Plus **¡Rápido!** +1 when the answer
  came in under 4 s (and ≥ 0.4 s, no glitches), plus **Racha** +1 from 3 right in a row, +2 from 6. ×2 in the last 30 s.
- A tap is credited once per swing, only inside its window (+ 0.6 s grace), never while paused; a second tap is ignored.

## Numbers
- Team size weighting (from Mochi Mash): each hit's power counts ×(average team size ÷ the team's connected size) in the
  team's damage and candies, so a smaller team's tigers break at the same pace. Kids' own counts stay real.
- Expected damage per team: `E = 0.36 × seconds × average team size` (a real class: a question every ~7.7 s at 75 %
  right, ~3.1 power a hit with bonuses, the ×2 at the end). Tigers break at 12 % · 30 % · 55 % · 85 % of E, then every
  +30 % (golden tigers). A tiger's **jackpot = 20 % of its life** in candies; a landmark won first = **+3 % of E**.
- Late joiners in the intro or the first 20 s grow E; tigers nobody has broken yet grow with it (never down).

## The comeback rule (fair, keeps the losing team hopeful)
- **¡Zona dorada!** While a team trails by ≥ 15 % of the leader's candies (and ≥ 10), its kids' meters get a golden
  zone almost twice as wide (`d ≤ 0.13`): they still need a right answer AND a good tap. The phone says «¡Van perdiendo:
  zona dorada más grande!».
- **The cap:** a critical that only happened thanks to the wider zone earns its extra over «fuerte» (+3, ×2 in the
  last 30 s) only up to the current gap: the candies luck knocks out can close the gap, never jump it. (If that hit
  also finishes the team's tiger, the tiger's jackpot is paid like any other burst: the damage that got the tiger there
  was earned hit by hit.)
- **¡Doble golpe!** in the last 30 s for both teams: an early lead is never safe.
- Uneven teams are weighted (above); late joiners go to the team with fewer connected kids (a tie: the trailing team).

## Bonus stars (`core/pinata.js` `STARS`)
| Star | Value | Eligible |
|---|---|---|
| Más golpes | hits (right answers that hit, automatic ones included) | ≥ 1 |
| Más críticos | critical hits | ≥ 1 |
| Respuesta más rápida | fastest right answer (ms from the question reaching the server to the answer) | ≥ 1 right, ≥ 400 ms |
| Racha más larga | longest streak of right answers | ≥ 2 |
| Gran remontada | candies knocked out while their team was trailing | ≥ 1 |
Ties share the star; a category nobody qualifies for is skipped; stars never change the team result. MVP of a team =
most candies (≥ 1). Podium = top 3 by candies.

## Teacher (projector, secondary but never stuck)
PIN + QR lobby, the team split with full characters (tap to swap, «Equilibrar»), 2 / 3 / 4 min; during the game «Pausa»
(holds the clock, the questions' timers, open meters, the frenzy; taps and answers refused), «+30 s», «Saltar» (intro,
ceremony), «Terminar» («¡FINAL!» then the ceremony; also on the pause card), «Sonido». F5 on the projector takes the
same room back (sessionStorage). Every wait is server-timed: no kid can hold the class. «Otra ronda» = a clean game.

## Sounds and media
Kenney CC0 (copied to `assets/pinata/`: whack, crit sting, burst, candy rain, swing whoosh, the party loop), plus the
shared kingdoms / halcon / mochi effects; the platform mute. Pictures: the four tiger WebPs (< 150 KB each). Phones load
only stills and `-lite` animations.

## Network budget (30 phones)
Per kid: its own events (question, result, ping, hit), the meter every 0.5 s only when it changed (candies + each team's
tiger and life), one banner per burst / landmark / lead change / frenzy. The projector: meter + who hit (`f`) every
0.25 s. No full-room `state` push on answers.

## Scorecard target
Gates all pass; 14/14 aimed: 1 real place = the landmark ladder worth points; 2 the gang = full-body cast with team
outlines + captains with cast lines + VS run-in on phone and projector; 3 every tap = the hit (press, swing, whack,
shake, candies) + the pictured meter card + the strip naming the next action; 4 feedback = flojo / bien / fuerte /
crítico / racha / burst, banners one at a time; 5 finale = the ceremony; 6 fair = server-judged meter with a latency
band, one hit per right answer, automatic hit = the minimum, comeback capped at the gap, size weighting; 7 product =
our tiger art, the saga, Kenney sounds, the phone as finished as the projector.

## As built (2026-10-15)
### Files
- `core/pinata.js` — the rules, no sockets (constants in `R`; `newGame / startPlay / answer / openSwing / ack / hit /
  tick / display / ladder / final / finish / stars`, `needle / gradeAt / threshold / life / jackpot`, `shiftTimes /
  shiftSwing / rescale`; team helpers reused from `core/mochi.js`: `teamSizes`, `weights`, `pickTeam`, `mulberry32`).
- `server.js` «PIÑATA TIGRE v2» block (`pnStart → pnPlay → pnTick (one 250 ms interval per room) → pnFinal → endGame →
  pnFinish`, `pnAnswer` (answer-result + `pn:ping` with an ack), `pnApplyHit`, `pnPause`, `pnEndPayloads`) + the branches
  in host:create (3 min default), host:reclaim, swap / balance (lobby only), host:start (captains, no generic deal / end
  timer), host:end-now («¡FINAL!» first), host:reset, player:join (fewer connected kids; late joiner / rejoin snapshot;
  a reload mid-swing = an automatic hit; the card again after the end), player:answer (paused / not playing → the
  question stays open), `player:pn-hit`, `host:pn-skip`, host:add-time, player:resync, the watchdog (the room tick deals
  every question), the host-left cleanup, publicState (`k` + `sk`). The old two-tiger smash (`PN_TIGER_HP`, `pn:hp`,
  `pn:broken`, the tap branch) is gone.
- Phone: `public/js/player-pinata.js` (PinataPhone), `public/js/pinata-stage.js` (PinataStage: the tiger on its rope
  with cracks / jolt / burst shards, candies, the stick, the meter, the rain cloud, the party flags), `public/css/pinata.css`
  (rewritten; the old `pn-*` / `pinata-active` rules removed after a grep found no other user), `public/player.html`
  (`#screen-pinata` + the `pt-*` overlays; the old `screen-pinata-smash` removed), `public/js/player.js` (init, screen map,
  Fuego / Mar wording, the old smash code and the mash-mascot reskin removed), `public/js/player-kingdoms-skin.js`
  (pinata in the skin: lobby / result / end routed to PinataPhone, the party loop, no win sound before the reveal).
- Projector: `public/host-pinata.html` + `public/js/host-pinata.js` (rewritten, same address; F5 keeps the room through
  sessionStorage `draly.pinataHost`).
- Shared with Mochi Mash, untouched: `js/mochi-stage.js` (kid figures, confetti, stars, count-ups) + `css/mochi.css`
  (loaded on both pages), `js/halcon-board.js` (character art), `js/cast.js` (+ a `smash` mood, Aileen in voseo).
- Art: `assets/pinata/tiger-red|blue|gold-red|gold-blue.webp` (62–76 KB; Higgsfield Nano Banana Pro, Unlimited, one 16:9
  sheet, keyed and split at one scale; originals + how-made in `assets-library/higgsfield/2026-10-15/pinata/`).
  Sounds `assets/pinata/` (Kenney CC0: whack, whack-big, crit, swing, candy, burst, music-fiesta «Swinging Pants»;
  394 KB in all). Retired: the synthesized `themePinata` / `candySpill` in `js/sounds.js`.
- Registrations: games.html (new description, «Nuevo», 2–40 jugadores), packs.html / sets.html (🐯, unchanged),
  maestro.js blurb, test-wording (the new files).
- Tests: `scripts/test-pinata.js`, `scripts/test-pinata-live.js`, bots `scripts/playtest/pinata.js`.

### Design pass (frontend-design, emil-design-eng, design-taste-frontend, impeccable, web-design-guidelines)
Design read: a kids' game-show phone + projector for a Mandarín school, playful-premium Nintendo / Mario Party language
on the platform's own system (ink outlines, Baloo 2 / Nunito, team red / blue, gold), an evening party so it reads apart
from Mochi Mash's pastel sunset; one focal point per screen (the tiger), the meter as the only control.

| Before (first build) | After | Why |
| --- | --- | --- |
| The tap only stopped the arrow | Stop + zone flash, wind-up / strike of the stick (520 ms), the whack 140 ms later (Web Audio, pitch by grade), a buzz by grade, a shake (2 → 12 px), the tiger kicked away and swinging back (damped), squash, candies spilling from the side the kid hits | The press must feel physical; the impact is a beat after the tap, like a real swing |
| The local guess and the server could disagree silently | The phone stamps its own guess at once; the server's `pn:hit` replaces the stamp / the numbers if they differ | Instant feel, honest numbers |
| The tiger flew off a phone screen on a critical | Kick capped at 20° on phones (24° on the projector), the tiger box re-centred | A crit is big, never lost off-screen |
| Sticks drawn across the kids' faces | The stick sits behind the body at the hand side, the taped tip shows over the shoulder | Faces stay visible (the cast art is the product) |
| Losers "standing" (the Mochi Mash note) | Sad pose + slump + a sob shake + desaturated + a drawn rain cloud raining on their heads + «aww» | The other team clearly reacts sad, kid-safe |
| A burst band covered the burst on the projector | The shower plays first, the band comes 650 ms later and lower (under the tigers) | The juicy moment stays visible |
| A tiger whose «next tiger» timer was cleared («¡FINAL!») stayed invisible | Restored by the next paint (≥ 1.5 s after a burst) and after «¡FINAL!» | Never an empty rope |
| Ladder markers hidden behind the landmark circles | Markers outside the column, above the circles | Progress readable from the back of the room |
| Flags across the lobby title | Flags only in the preview and the party | Title legible |
| A tap that crossed the teacher's «Pausa» was lost | The phone gets the swing back, held, and the kid taps again after «Seguir» | Fair to the kid |

Detector (`impeccable detect`): the empty `<img>` tags fixed (initial sources); kept on purpose: the courtyard's top
line (a horizon, not a card), the stick's cylinder shading, the shine sweep on the gold target (it is the target), the
golden candy's glow (a game item), the candy-jar fill and the rope / tape / life-bar stripes (real objects' textures),
the pop easing of the incumbent game-show language (Mochi Mash and Halcón use it).
Guidelines: focus-visible on every button and the hit zone (role=button, Space / Enter), aria-live on the stamp and
banners, `prefers-reduced-motion` (no sway, kicks, flights, shards, confetti, rain; the gold frame stays still; the
pictured arrow rests on the gold), `touch-action: manipulation` + `overscroll-behavior: none` on the hit zone, safe
areas, `Intl` numbers (es-ES), `color-scheme` + `theme-color` on the projector, `translate="no"` on the title.

### Test hooks
`PinataPhone.frame() / tap() / needleAt(pos) / openSwing(info) / burst(b) / sim(ev, d) / runIn() / rules(ms) /
stage(name) / hold(v) / freeze(v) / replay(ev) / end(data)`, `PinataHost.frame() / sim(ev, d) / runIn() / stage(name) /
hold(v) / freeze(v) / hit(k, power, crit)`.

### Tests
- `node scripts/test-pinata.js`: 248,399 checks (the needle and the grades, the judge: an honest tap is graded on what
  the kid saw, a claim outside ±150 ms is graded at the server's estimate, the median round trip, an ack during a pause
  ignored, jitter 120 ms; one hit per right answer, the automatic hit = 1, fast / streak / frenzy, the ladder, jackpots,
  landmarks, the comeback cap, size weighting, pause / +30 s shifts, the stars and ties; 300 simulated classes:
  5,141 piñatas broken, 1,200 landmarks, 1 tie).
- `node scripts/test-pinata-live.js --url http://localhost:3800`: 53 checks on a running server (the lobby, the intro
  and «Saltar», one question after a wrong answer, a swing + its ping, an honest centre tap = critical, a second tap
  refused, a tampered clock graded at the server's clock, no tap = the automatic hit after the whole window, «Pausa»
  14 s with resyncs and the tap after «Seguir», «+30 s», rejoin keeps team + candies, a late joiner to the smaller team,
  swaps refused mid-game, «Terminar» → «¡FINAL!» → the cards, reconnects after the end, «Saltar» on the ceremony).
- Bots (`node scripts/playtest-bots.js --game pinata --bots N --seconds 60`; `scripts/playtest/pinata.js`: bots ack the
  pings and aim at the centre ±0.12; Bot03 lies about its clock, Bot04 never taps), final code:

| Bots | Result | Questions | Swings = hits | Automatic | Criticals (honest / cheater) | Bursts · landmarks · leads | Events per kid (avg / max) | Meter per kid | `state` per kid |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | PASS, 0 frozen, 0 errors | 58 | 8 = 8 | 4 | 4/4 · 0/0 | 4 · 2 · 1 | 59.8 / 61 | 9 | 5.8 |
| 20 | PASS, 0 frozen, 0 errors | 302 | 80 = 80 | 7 | 61/72 · 0/1 | 11 · 4 · 3 | 130.5 / 140 | 63 | 8.3 |
| 30 | PASS, 0 frozen, 0 errors | 466 | 117 = 117 | 8 | 86/107 · 0/2 | 11 · 4 · 1 | 141.3 / 148 | 73 | 10.4 |

  Earlier runs on the same build: 40 bots PASS (625 questions, 146 hits, 154 / 164 events per kid). Stale answers
  (2 / 10 / 14) are all answers sent after «¡FINAL!» (refused on purpose).
- The other tests pass: test-mochi 1,593, test-mochi-live 49, test-halcon 68,229, test-halcon-live 37, test-packs
  (82 rounds), test-wording (42 files), test-kingdoms, test-paint, test-snow, test-escape, test-archive,
  test-audios-base. `node scripts/asset-guard.js` clean.
- Real browsers (playwright-cli, phones 390×844, projector 1600×900): lobby (join address breaks before «/?pin=»),
  run-in on phone and projector, rules card, question, the hit (meter, critical with its pop, burst with its headline),
  lead band, frenzy, «¡FINAL!», jars, result (both phones and the projector, two kids a side), stars, podium, both
  cards; three rounds in a row on one PIN with two browser phones answering and tapping by themselves (round 2 after
  «Otra ronda»: 6 and 5 hit screens opened, real grades); a phone reloaded after the end lands on its card.

### Reviews and what they changed
- Fresh-eyes design review (impeccable finish): "fix, then ship" (play as good as Mochi Mash v2; meter and ceremony
  short of it), 8 items, all done: (1) the meter's gold stands out (pale → green → gold with ink borders and a white
  star, on the hit, the rules card and the lobby step); (2) the burst headline waits for the explosion; (3) the stick
  swings from rest and lands on the tiger with an impact pop; (4) the status pill under the team bar is readable on the
  dark sky; (5) the result has a big Dralingo per team (red / blue: champion vs shocked), the losers sob under a rain
  cloud, confetti only over the winners; (6) the candy jars restyled; (7) the projector's lead / frenzy / burst bands
  sit low, under the tigers; (8) polish (the MVP chip's gold star, «¡La próxima vez, toca la pantalla!» after an
  automatic hit, captains' bubbles hidden while a band shows, the join link wraps).
- `agent-skills:code-reviewer` ("request changes"): swings and bursts were not renumbered on «Otra ronda» (the hit never
  opened in round 2) → reset on a fresh `pn:init`; a tiger could stay invisible after «¡FINAL!» cut its «next tiger»
  timer → repainted; a tap that crossed «Pausa» was lost → handed back; the lead-in ignored a pause → it waits with
  the server's clock; a Wi-Fi blip lost the tap → the swing stays open until its window ends and the phone re-sends;
  the rules card could stay on top after «Pausa» in the intro + «Terminar» → hidden on «¡FINAL!» / the end (Mochi Mash
  had the same bug: one-line fix); the judge band was too lax → ±150 ms, the server's estimate outside it, the median
  of 5 round trips, the ping sent before the answer handlers; cheer / sob rules scoped to this game. Item 6 (the
  jackpot can follow a capped lucky hit) is by design and now written in the comeback rule.
- `classroom-playtester` (20 and 30 bots + 3-4 real phones and the projector, 5 rounds): PASS; it caught the round-2
  hit bug live (already fixed, verified in its later rounds). Fixed after: the piñata's captain lines no longer say
  «¡Caso resuelto!» (a `fiesta` mood in cast.js for every character, Aileen in voseo), the kid's name tag no longer
  covers the team total, «¡FINAL!» blocks taps and the wrong-answer line becomes «¡Ahora viene el gran final!», a
  phone that reloads after the end goes straight to its card, the projector's join address breaks before «/?pin=».

### Scorecard
```
Scorecard · Piñata Tigre v2 «La Fiesta de las Piñatas» · 2026-10-15 · branch worktree-agent-a07a4f612c65a3145
Hard gates: bots PASS (4/20/30, earlier 40) · teacher controls ✓ (Pausa, +30 s, Saltar intro + ceremony, Terminar,
            Sonido, F5 keeps the room, Otra ronda; live test + playtester) · saga only ✓ (our toy tiger, the cast,
            test-wording) · Spanish / pinyin without tones / level ✓ (pack questions) · kid-safe ✓ (figures side by
            side, nobody touching; the stick never crosses a face)
1 Real place ........ 2/2  Dubai Creek party at dusk; the ladder of tigers under the Museo del Futuro, Marco de Dubái,
                            Burj Al Arab and Burj Khalifa (golden tiger), first team there wins a bonus
2 The gang .......... 2/2  a captain of the gang per team (VS run-in on phone and projector, cast.js smash / fiesta
                            lines on bursts, leads, the winner); every kid full-body in the team outline with a taped stick
3 Every tap ......... 2/2  every right answer = a hit: the whole phone is the button, the arrow + a teaching hand,
                            one tap = swing, whack, buzz, shake, the tiger jolts and cracks, candies fly to my counter;
                            the strip and the hint name the next action
4 Feedback .......... 2/2  flojo / bien / fuerte / ¡CRÍTICO! each with its own sound, shake and stamp; streak, fast,
                            burst moment on the hitter's phone, banners one at a time
5 Finale ............ 2/2  crack stages, landmarks, lead alarms, last 30 s «¡Doble golpe!», comeback zone; «¡FINAL!»,
                            the candy jars, winners cheer with confetti / losers sob under a rain cloud, 5 stars,
                            podium + MVPs, my own card
6 Fair, no stall .... 2/2  server-judged meter (a lying clock gets 0 crits), one hit per right answer, the automatic
                            hit = 1, comeback extra capped at the gap, size weighting, late joiners to the smaller team;
                            nothing waits on a kid (the window closes by itself)
7 Product feel ...... 2/2  Higgsfield tiger art with the team bow, the saga, Kenney music + effects (no beeps), the
                            phone as finished as the projector at 390 px and 1600×900
Total 14/14 → ships (≥ 12, no 0)
```

### Open
- The candy pace (`E = 0.36 × seconds × team size`, the ladder at 12 / 30 / 55 / 85 %) comes from bots and the
  simulator: check with a real class that a 3-minute game reaches the Burj Khalifa only when a team plays well.
- The tiger's forehead stripes are natural tiger marks; if he reads a letter in them, a new Higgsfield pass fixes it.
- Shared with the other games, left as they are: «Terminar» asks with the browser's own confirm box; kids who left stay
  faded in the crowds after «Otra ronda» (so a kid who comes back keeps their place); `host:reclaim` checks no
  teacher token (the platform's PIN model).
- Mochi Mash got one line (`hideIntro()` on «¡FINAL!» / the end): its rules card could stay on top too.
- Not deployed: built and tested on this branch only.
