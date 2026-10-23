# Mochi Mash v2 · «La Terraza del Mochi» (team mash, Mario Party style)

**Name since 2026-10-23: «Draly Mochi · La Terraza del Mochi»**, short «Draly Mochi» (the «Draly Party» names, his «Approve all»; `core/game-names.js`). The text below keeps the name it had when it was written.

gameType `mochi-mash` · address `/host.html?setId=…` (unchanged: games.html, packs.html, sets.html, /maestro keep working) ·
remade 2026-10-14 on a worktree branch, not deployed.

## Why (his words, 2026-10-14)
After playing Ojos de Halcón: "Now you know why the Mario Party feeling is so important, because it makes feelings at
the end of a class. Remake Mochi Mash and make it way better, passing every single filter. Super addictive to play."
Rule that came with it (CLAUDE.md § Pin games «Feelings at the end of class»): every game ends with a Mario Party
ceremony: «¡FINAL!», a suspenseful reveal, winners celebrate, the others react, bonus stars by category, and on every
phone the kid's own card. Short, skippable by the teacher, never stuck.

## Kept from the old game
The address and the core idea: **answer right → earn a short mash → feed your team's creature; the bigger creature
wins.** Panda vs Kitsune (emoji, no art files) are retired: wording, emoji and the old zoo board are gone.

## The world
- **Setting:** a dessert terrace on Dubai Creek at sunset (`assets/dubai/skyline-wide.webp`: Burj Khalifa, Museo del
  Futuro, the abras on the water). Two golden plates on a cream-and-gold deck, one per team.
- **Teams:** Equipo **Fuego** (red, server id `red`) and Equipo **Mar** (blue, server id `gold`), as Reinos de Colores.
- **The creatures: the two Dragoncitos.** Each team feeds its own baby dragon: the keffiyeh Dralingo stickers of
  Reinos (`assets/kingdoms/dralingo/*.webp`) in the team colour (red = the `-red` recolours, Mar = the original blue).
  They are the "Bebé Dralingo" of his evolution line (no mustache, no kandura yet), so they don't compete with
  Dralingo Sheikh, who hosts from the side of the terrace in his platform look. Running gag from the cast bible:
  dragons get hungry. Poses: hungry (`pointing`), eating (`laugh`), happy/leading (`jump`), worried (`shocked`),
  champion (`champion`), dance (`dance4`); two new recolours (`laugh-red`, `dance4-red`) made with
  `../video_tools/recolor_dralingo.py`. A dragoncito grows with what its team fed (scale from the expected total).
- **Every kid is their full-body saga character** (`assets/halcon/cast/<id>-ready|victory|sad.webp`, animals from
  `assets/saga/anim/<id>-still.webp`), outlined in the team colour (a sticker border made of four drop-shadows) and
  standing on a team-coloured disc. Never a face crop in the play area.
- **Mochis:** drawn as geometry (a round daifuku: pastel body, ink outline, a soft highlight), four flavours
  (strawberry, matcha, milk, mango). The golden mochi is gold with a warm glow and flies bigger and slower.

## Flow (server-timed; constants in `core/mochi.js` `R`)
1. **Lobby.** Projector: PIN + QR, «Así se juega» in 3 pictured steps, the two teams as full-body characters (tap a
   kid to change team, «Equilibrar»), duration 2 / 3 / 4 min, «¡A comer!». Phone: «¡Eres del Equipo Fuego!» with the
   kid's own character in the team colour next to the team's dragoncito, the same 3 steps.
2. **Countdown (3.5 s) = the run-in.** Projector and every phone: the terrace, each team runs in from its side and
   lines up under its dragoncito (phone: my team's side, me marked «TÚ», the rival dragoncito across the VS split).
3. **Intro (2.8 s).** The rules card with ONE pictured control: a hand tapping a big button, a mochi flying into the
   mouth, «¡Toca rápido!» → «¿Listos?» → «¡YA!». The teacher can skip it.
4. **Play.** Every kid gets curriculum questions (Kahoot tiles from the shared skin, 20 s timer with ticks, the team
   bar «¡Ganamos por 12!»). A full-width strip under the bar always says what to do: «Responde bien → ¡5 segundos de
   mochis!».
   - **Right** → «¡Correcto!» 0.9 s → **the mash zone** for 5 s (6 s with a streak of 3+: «¡Racha! +1 segundo»).
   - **Wrong / time up** → «¡Casi! La respuesta era …» 2.2 s → the next question (no points to anyone: the wait is
     the cost, so guessing fast never beats answering well).
5. **The mash zone (the addictive core).** The whole phone is one tap zone. Top: my team's dragoncito on its plate,
   mouth open. Bottom: my character with a stack of mochis. Every tap: the zone sinks (scale .97, 90 ms), a mochi
   leaves my character's hands and arcs into the dragoncito's mouth (WAAPI transform/opacity, 380 ms), the
   dragoncito chomps (the eating pose 160 ms + a squash), a soft pop with a little pitch variation (Web Audio), a
   short vibration where allowed, and the combo counter climbs (×10, ×20, ×30 flash). Rare **golden mochi**: one tap
   of the window turns gold (+5). A 5 s bar runs along the bottom, red in the last 1.5 s. At the end: «¡+34 mochis!»
   and the next question.
   - **Fair and safe:** phones send a COUNT every 250 ms (`player:mm-taps {n}`), never one event per tap. The server
     credits at most 12 taps per second of the window (+6 burst, an auto-clicker gets 12/s like the fastest kid), only
     inside the window it opened (+0.6 s grace for the last batch), never while paused.
6. **Rising excitement.**
   - **Live meter on both screens:** a tug bar of the two totals; the dragoncitos grow on the projector.
   - **Lead-change alarm:** «¡El Equipo Mar pasa adelante!» on the projector and as a top banner on every phone
     (never over the answer tiles), the losing dragoncito looks worried. A lead must be ≥ 4 mochis and ≥ 3 % of the
     total to count; alarms are ≥ 7 s apart.
   - **Carrera de monumentos (landmarks worth points):** four Dubai landmarks stand on a height ruler between the
     plates: Museo del Futuro, Marco de Dubái, Burj Al Arab, Burj Khalifa. They sit at the same height for both teams
     (12 %, 32 %, 58 %, 88 % of the expected team total for the chosen time and class size). The first dragoncito to
     grow that tall wins the landmark: +4 % of the expected total in mochis, the landmark flies to its plate, banner
     on every phone. Each landmark can only be won once: a team that loses the race loses that prize.
   - **¡Últimos 30 segundos!** Music switches to the final loop, the frame glows gold, «¡DOBLE MOCHI!» (every mochi
     counts ×2 until the end), the last 10 s count down big on the projector and as a chip on phones.
7. **«¡FINAL!»** (2.4 s) on every screen; open mash zones close (taps that arrive in the next 0.6 s still count).
8. **The ceremony (game-end, ~17 s, «⏭ Saltar» on the projector jumps every screen to the end card).**
   1. *El pesaje:* "¿Qué dragoncito comió más?": both totals climb together with a drum loop, the smaller stops,
      the bigger keeps rising (3.4 s).
   2. *¡Gana el Equipo …!:* the winning dragoncito holds the trophy and its team's characters jump in the victory
      pose with confetti in the team colour; the losing dragoncito is shocked and its kids slump (sad pose)
      (2.8 s). A tie: both dragoncitos dance, «¡Empate!».
   3. *Estrellas Bonus* (one by one, 1.6 s each): Más mochis · Respuesta más rápida · Racha más larga · Mejor
      puntería · Gran remontada. The projector shows each category, a short drum roll, then the winner(s) as
      full-body characters with their value; a phone that won it shows «¡ES PARA TI!».
   4. *The end card:* projector podium (top 3 feeders, full body, stars on their badges), the MVP of each team, «🔄
      Otra ronda». Phone: my card (my character in the team colour, my team's result, «Diste 312 mochis», «El 14 % de
      tu equipo», right answers, best streak, every star I won); kids with 0 get «¡La próxima es tuya!», never shame.

## The comeback rule (fair, keeps the losing team hopeful)
- **Mochis dorados para el que va perdiendo:** a team that trails by ≥ 15 % of the leader's total (and ≥ 10 mochis)
  gets a golden mochi in 60 % of its mash windows instead of 25 %. A golden mochi is worth +5 instead of +1, and
  while a team trails, the extra (+4, or +8 in the last 30 s) is capped at the current gap: luck can close the gap,
  never jump it by itself. The leader still needs right answers and taps.
- **¡Doble mochi!** in the last 30 s for both teams: an early lead is never safe.
- **Uneven teams:** a team with fewer connected kids is not punished: each credited mochi counts ×(average team size
  ÷ its team size) in the team total (15 kids = 8 vs 7: ×0.94 vs ×1.07). Kids' own counts stay real.
- Late joiners go to the team with fewer connected kids (a tie: the trailing team).

## Bonus stars (`core/mochi.js` `stars`)
| Star | Value | Eligible |
|---|---|---|
| Más mochis | mochis fed (credited, golden and ×2 included) | ≥ 1 |
| Respuesta más rápida | fastest right answer (ms from the question reaching the server to the answer) | ≥ 1 right |
| Racha más larga | longest streak of right answers | ≥ 2 |
| Mejor puntería | right ÷ answered (time-ups count as answered) | ≥ 3 answered and ≥ 1 right |
| Gran remontada | mochis fed while their team was trailing | ≥ 1 |
Ties share the star (everybody at the top value). A category nobody is eligible for is skipped. Stars are personal
honours: they never change the team result.

## Teacher (projector, secondary but never stuck)
PIN + QR lobby, the team split with full characters, duration 2 / 3 / 4 min; during the game «⏸ Pausa» (holds the
clock, the questions' timers, open mash zones and the frenzy; taps refused), «+30 s», «⏭ Saltar» (intro, ceremony),
«⏹ Terminar» (plays «¡FINAL!» then the ceremony; also on the pause card), «🔊 Sonido». Every wait is server-timed:
no kid can hold the class. «🔄 Otra ronda» = a clean game on the same PIN.

## Sounds and media
Kenney CC0 (copied: `assets/mochi/*.mp3`): pop/chomp (Impact Sounds soft), golden (Retro coin), lead alarm, landmark
(Music Jingles), drum loop (Music Loops «Drumming Sticks»), battle loop; plus the shared `assets/kingdoms/` tick,
whoosh, sting-win, music-final. The platform mute. Phones load only stills and `-lite` animations.

## Network budget (30 phones)
Per kid: the meter every 0.5 s (only when it changed), its own events (question, result, mash summary), one banner
per lead change / landmark / frenzy. The projector: meter + a feed of who fed (`mm:fx`) every 0.25 s. No full-room
`state` push on answers.

## Scorecard target
Gates all pass; 14/14 aimed: 1 real place = landmark race worth points; 2 the gang = full-body cast + dragoncitos +
Dralingo host lines + run-in VS; 3 every tap = the mash zone; 4 feedback = right / wrong / streak / golden / combo,
banners throttled; 5 finale = the ceremony; 6 fair = tap cap, wait cost for wrong, comeback with a cap, size
weighting; 7 product = phone as polished as the projector.

## As built (2026-10-14)
### Files
- `core/mochi.js` — the rules, no sockets (constants in `R`; `newGame / startPlay / answer / openMash / taps / closeMash /
  tick / final / finish / stars`, `pickTeam / weights / shiftTimes`).
- `server.js` «MOCHI MASH v2» block (`mmStart → mmPlay → mmTick (one 250 ms interval per room) → mmFinal → endGame →
  mmFinish`, `mmAnswer`, `mmPause`, `mmEndPayloads`) + branches in host:create (3 min default), host:reclaim (terrace or
  ceremony again), host:swap-team / auto-balance (lobby only), host:start (no generic first deal / end timer),
  host:end-now («¡FINAL!» first), host:reset, player:join (fewer connected kids; late joiner / rejoin snapshot),
  player:answer (paused / not playing → the question stays open), nextDelay, host:pause, `player:mm-taps`,
  `host:mm-skip`, host:add-time (moves the room's clock, not g.duration), player:resync (snapshot, or the card after the
  end), the watchdog (quiet in the intro, pause, «¡FINAL!»), the host-left cleanup, publicState (`k` = the kid's id).
- Phone: `public/js/player-mochi.js` (MochiPhone), `public/js/mochi-stage.js` (MochiStage: Dragoncito, kid figure,
  mochi flyer, confetti, star), `public/css/mochi.css`, `public/player.html` (`#screen-mochi` + the overlays),
  `public/js/player.js` (init, screen map, Fuego/Mar wording, no legacy mash for mochi-mash),
  `public/js/player-kingdoms-skin.js` (mochi-mash in the skin; `holdWhen` takes several sources; `setScores`,
  `isMuted`, `music`).
- Projector: `public/host.html` (rewritten, same address) + `public/js/host-mochi.js` (the old `js/host.js` deleted; its
  zoo / tap-floater CSS removed from `styles.css` after a grep found no other user).
- Art: `assets/kingdoms/dralingo/laugh-red.webp`, `dance4-red.webp` (recolours, 36–38 KB). Sounds `assets/mochi/`
  (Kenney CC0: pop, gold, combo, star, drum, music-mash «Polka Train»; 290 KB in all).
- Registrations: games.html (new description, «Nuevo»), packs.html / sets.html (🍡), maestro.js blurb, test-wording.
- Tests: `scripts/test-mochi.js`, `scripts/test-mochi-live.js`, bots `scripts/playtest/mochi-mash.js`;
  `scripts/playtest-bots.js` lets a handler ask for a longer end grace (`report.endedGrace`).

### Design pass (emil-design-eng, impeccable, design-taste-frontend, web-design-guidelines)
Design read: a kids' game-show phone + projector for a Mandarín school, playful-premium Nintendo language, built on the
platform's own system (ink outlines, Baloo 2 / Nunito, team red / blue, gold; Halcón and Reinos as references).
| Before (first build) | After | Why |
| --- | --- | --- |
| A tap only bumped a counter | The whole zone sinks (WAAPI scale .975, 110 ms, strong ease-out), a pop with pitch drift (Web Audio, no lag at 10 taps/s), an 8 ms buzz, a mochi tossed from the plate at my feet in an arc (transform + opacity only, a pool of 14 nodes), the dragon squashes on landing | Press feel on every tap; nothing animates layout; 30 phones keep their frames |
| One `new Audio()` per tap | One decoded buffer, `playbackRate` 0.92–1.4 rising with the combo | Rapid sounds need zero latency; the rising pitch is the combo felt by ear |
| The dragon flipped poses per tap (10 Hz flicker) | Eating pose held while mochis land, back to hungry / happy / worried 420 ms after the last one | No flicker; the pose tells the race (ahead / behind) |
| Overlays under the countdown (z 60 < 100) | Intro, banners, «¡FINAL!», pause above it | The run-in never showed on phones |
| Sound button over the timer bar in the zone | Moves to the top corner while the zone is open | Never cover the thing a kid watches |
| Team red #f0443a / blue #2f7bea with white text (3.8:1, 4.1:1) | #d8382e / #2a6fdc (4.6:1, 4.8:1) | WCAG AA for the small labels on team surfaces |
| Win / lose sound at game-end | Silent until the weigh-in; drum, then the fanfare or «aww» | The result stays a surprise (Mario Party reveal) |
| Projector crowd wrapped a 7th kid onto the plate | Kid width from the room per row (no wrap), 2 rows from 9 kids, «+N» after 16 | Nobody covers the plates or the team names |
Detector (`impeccable detect`): contrast fixed; kept on purpose: the golden mochi's glow (a game item, not decoration),
the measuring tube's markings (a measuring tool), the deck's top line (a horizon, not a card), the overshoot easing of
the incumbent game-show language (Halcón uses the same), images whose `src` is set in the same tick.
Guidelines: focus-visible on every button and the zone (role=button, Space / Enter), `prefers-reduced-motion` (no
run-in, no flights, no confetti, instant fills), `touch-action: manipulation` + `overscroll-behavior: none` on the zone,
safe areas, `Intl` number format (es-ES), `color-scheme` + `theme-color` on the projector, `translate="no"` on the title.

### Test hooks
`MochiPhone.frame() / tap(n) / openMash(info) / sim(ev, d) / runIn() / rules(ms) / stage(name) / hold(v) /
freeze(v) / replay(ev)`, `MochiHost.frame() / sim(ev, d) / runIn() / stage(name) / hold(v) / freeze(v) / feed(k, n, gold)`.

### Tests and playtests (2026-10-14, own server on :3700)
- `node scripts/test-mochi.js`: 1593 checks (teams, tap cap, golden + comeback cap, size weighting, frenzy, lead
  hysteresis, landmarks, late-joiner rescale, fast floor 400 ms, pause / +30 s / «¡FINAL!», stars with ties and zeros,
  finish, 300 simulated classes).
- `node scripts/test-mochi-live.js --url http://localhost:3700`: 49 checks against a real server (lobby id + skin, one
  question after a wrong answer, server tap cap, a 14 s pause with resyncs, time-up with a slow kid, +30 s, rejoin,
  late joiner, swap refused mid-game, end + a second end ignored, reclaim / resync / a new socket after the end, the
  teacher's skip, «Otra ronda»).
- Bots (`node scripts/playtest-bots.js --game mochi-mash --bots N --seconds 60`, one cheater bot at 40 taps/s):

| Bots | Result | Questions | Mash windows | Mochis | Cheater credited | Events per kid (avg / max) | Meter per kid | `state` per kid |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | PASS, 0 frozen, 0 errors | 47 | 13 | 849 | 12.8 taps/s | 123 / 125 | 77 | 5.5 |
| 20 | PASS, 0 frozen, 0 errors | 232 | 73 | 4149 | 12.8 taps/s | 165 / 169 | 117 | 8.8 |
| 30 | PASS, 0 frozen, 0 errors | 373 | 89 | 4700 | 13 taps/s | 166 / 174 | 115 | 10.5 |

  Every run: 4 landmarks claimed, one frenzy, lead changes, all five stars given, every kid's end card seen.
- The other tests still pass: test-archive, test-audios-base, test-escape, test-halcon (+ test-halcon-live 37 checks:
  Halcón got the same «reconnect after the end» fix), test-kingdoms, test-packs, test-paint, test-snow, test-wording.
- Screenshots (playwright-cli, phones 390×844, projector 1600×900): lobby, run-in, rules, question, mash zone, lead
  band, live deck, frenzy, «¡FINAL!», weigh-in, result, stars, podium, the phone's result / star / own card; a class of
  27 (dense lobby, two-row crowds, team names on the plate rims), the «¡Doble mochi!» strip, the projector after F5
  (same PIN, same game).

### Reviews and what they changed
- `agent-skills:code-reviewer`: a wrong answer could deal two questions (the watchdog and the wait) → the room tick
  deals after the wait; a long pause killed the open mash on resync → pause UI changes only on a state change, each mash
  keeps its own time left; the projector's round 1 missed kids' skins and late joiners → the kid's id is made at join
  and the skin travels in `state`; the zone could open after «¡FINAL!» → timers cleared, phase check; a phone that
  reconnected after the end lost its card → reattach by name (Mochi Mash and Ojos de Halcón); the frenzy glow animated
  `box-shadow` → opacity-only layers; plus pause gating at join / resync, the intro timers, the chip, a11y labels.
- `classroom-playtester` (20 and 30 kids, real browsers): PASS; fixed: projector F5 now reclaims the room (sessionStorage),
  the teacher's buttons moved to a column top right (they covered Mar kids), the lobby fits 30 kids without scrolling,
  the ×2 chip no longer covers the counter (the prompt strip says «¡Doble mochi! Quedan m:ss»), «la más rápida» needs
  400 ms or more, the clock and «+30 s» behave in the intro.

### Scorecard
```
Scorecard · Mochi Mash v2 «La Terraza del Mochi» · 2026-10-14 · branch worktree-agent-aa98bc70d5110982f
Hard gates: bots PASS (4/20/30) · teacher controls ✓ (Pausa, +30 s, Terminar, Sonido, Saltar, F5 keeps the room;
            live test) · saga only ✓ (test-wording) · Spanish / pinyin without tones / level ✓ (pack questions) ·
            kid-safe ✓ (no overlapping figures, nobody touching)
1 Real place ........ 2/2  Dubai terrace; 4 landmarks (Museo del Futuro, Marco de Dubái, Burj Al Arab, Burj Khalifa)
                            on one ruler between the plates, first team there +4 % bonus (final/07, 21, 25)
2 The gang .......... 2/2  a captain of the gang per team, VS run-in on phone and projector, cast.js lines on leads,
                            landmarks, the feast (Aileen in voseo); every kid full-body with the team outline (02, 16, 21)
3 Every tap ......... 2/2  the whole zone is the button: press, pop with rising pitch, buzz, a mochi flies into the
                            dragon; rules card with a tapping hand; the prompt strip names the next action (03, 05)
4 Feedback .......... 2/2  right / wrong (wait) / streak / combo / golden mochi each answer back; banners one at a
                            time from a queue, lead changes with hysteresis (06, 08, 13)
5 Finale ............ 2/2  last 30 s ×2 frenzy, lead alarms, comeback; «¡FINAL!», weigh-in tubes with a drumroll,
                            winners dance / losers slump, 5 bonus stars one by one, podium + MVP per team, my own card (09-15, 24)
6 Fair, no stall .... 2/2  server tap cap (a 40 taps/s cheater gets 13/s), a wrong answer costs a wait, comeback capped
                            at the gap, team totals weighted by size, late joiners to the smaller team; nothing waits on a kid
7 Product feel ...... 2/2  our Dralingo art in team colours, the saga figures, Kenney music + effects (no beeps);
                            phone as finished as the projector at 390 px and 1600×900
Total 14/14 → ships (≥ 12, no 0)
```

### Fixed later (2026-10-15, with 6-7 Swing v2; found by its classroom playtest)
- A kid with no saved avatar saw one character on the phone and another (Dralingo) on the projector: the phone now uses
  the server's character (`mySkin()` reads `sk` from the room state, else what the join sent).
- The end card's big «Inicio» took kids out of the class before «Otra ronda»: now «Quédate aquí: tu profe puede empezar
  otra ronda» and a quiet «Salir del juego».
- Fuego's Dralingo was blue with a red outline: now red (`mochi.css`, the same art turned on the colour wheel; the
  kandura stays white), on the phone and the projector, slumped too.

### Open
- The Dragoncitos are the existing Dralingo stickers (white ghutra, no mustache) recoloured red / blue and framed as
  baby dragons; a dedicated «Dragoncito» set in his platform look would be new Higgsfield art (his call).
- Landmark spacing uses 2.8 mochis per kid per second, measured with bots: check it with a real class.
- Not deployed: built and tested on this branch only.
