# Ojo de Halcón · new pin game (Mario Party «Looking for Love»)

Status: **DEPLOYED 2026-10-13 (83dbcbd04)** (gameType `look`). His brief: "/watch
https://www.youtube.com/watch?v=y9BKCVx_mNk … lets recreate Mario Party style pin games, lets go one by one … minute 1:07
until 1:51 … with our roster characters". The clip is Super Mario Party's **Looking for Love** (watched frame by frame
2026-10-13, 1:04–1:54 at 1 and 6 fps). First of the Mario Party series: the round/reveal/rank skeleton here is meant to
be reused by the next minigames. Build with the `new-pin-game` skill; grade with `docs/GAME_QUALITY_CHECKLIST.md`.

## What the video shows (Looking for Love, 4 players)
- A gym with a big orange game-show board: a green LED wall with the 4 players in a row of panels, and four round cream
  lamps around the frame (top, right, bottom, left). Score strip on top (4 icons + numbers), ten dots inside the board
  track the rounds. Instruction card «Look at the ♥!», then «START!».
- Each round: card symbols (♥ ♠ ♣ ♦ in several colours) fade into the lamps at staggered moments, sometimes two at once,
  sometimes only one. Players must turn toward the ♥. Whoever looks at the heart gets a glowing ring, then the points
  pop on the panels: **+5 to the first, then +3, +2, +1** (1:17: Mario +3, Luigi +1, Peach +2, Daisy +5). A player who
  turns toward a wrong symbol gets a blue sky panel and **0** (1:31: Mario and Peach). 10 rounds (≈3–4 s each).
- End: «FINISH!» on the board, the winner jumps in the gym: «Mario Wins!» (35 · 21 · 19 · 31).
- What makes it exciting: the wait while decoys light up, the pounce, the order of the +5/+3/+2/+1, the dots counting
  down to the finish, everyone on screen at once.

## Ours: Ojo de Halcón (a Dralingo episode, a TV game show in Dubai)
One sentence: Hamdan hosts the fastest game show in Dubai; the question lights up the board, the four answers light up
one by one around it, every kid "looks" at the right word as fast as they can; +5 to the fastest eye, +3 / +2 / +1 to
the rest who got it, 0 for a wrong word; ten rounds, the sharpest eye wins.

### World
- A game-show studio in Dubai: the skyline behind, studio lights, a gold board with the green LED wall (echo of the
  original's board: it is what makes it «Mario Party»), four lamps around the frame. Clean CSS/sticker drawings for
  v1 (no image generator used); picture brief in `content/look/pictures.json`.
- The gang: Profe Fer opens the episode on the countdown, **Hamdan** hosts («¡Marhaba! Bienvenidos al concurso más
  rápido de Dubái»), Dralingo (platform look) comments from the corner, one of the gang cheers at streaks and the last
  round. The **falcon** of the saga swoops onto the right answer on the projector at the end of each round.
- Every kid plays as their saga avatar in their own panel (phone: centre of the board; projector: the panel grid).

### Rules (as built)
- Free-for-all like the original. Rounds: teacher picks **10 / 15 / 20** in the lobby (default 10); «+5 rondas» mid-game
  (max 30). Questions come from the curriculum pack (`/packs.html?game=look`), random order, no repeats until the pack
  is exhausted.
- A round: the question alone (2.4 s, picture + text) → the four answers light up in a random order at random moments
  (first after 0.55–1 s, then 0.42–1.05 s apart, one pair together in ~28 % of rounds) → open until 3.4 s after the
  last lamp, or 0.7 s after everyone looked → result 2.8 s (+N on every panel, the right lamp glows, wrong panels flash
  blue) → next round. «¡FINAL!» after the last one, then the winner show.
- **Looking**: tapping a lamp that is still dark does nothing (a wobble, «Aún no hay nada»). The first lit lamp a kid
  taps locks them for the round: the right word → «¡La viste!» and a rank by arrival at the server; a wrong word →
  «¡Esa no!», 0 for the round (the fail state the original has). Not looking = 0.
- **Points by rank among the kids who looked right** (`core/look.js` pointsFor): 1st **+5**; up to the first quarter
  of the class **+3**; up to 60 % **+2**; everyone else who looked right **+1**. With 4 kids that is exactly the
  original's 5 / 3 / 2 / 1; with 24 kids: 1 × +5, 5 × +3, 9 × +2, the rest +1. Effort always pays ≥ 1.
- Streaks are cosmetic (🔥 racha on the phone, a gang cheer at 3 and 5). Awards at the end: 🦅 Ojo de Halcón (most
  +5), ⚡ Rayo (fastest average reaction, ≥ 2 rights), 🔥 Racha (best streak); three different kids when possible.
- Teacher: ⏸ Pausa (the round clock waits, taps ignored), ⏭ Saltar ronda, +5 rondas, Terminar, Sonido, Otra ronda.
  Every wait is server-timed: nothing waits on a kid. Late joiners get a panel and play from the next lamp; reloads keep
  the panel (looks are keyed by panel index). Time cap = rounds × 14 s + 60 s as a safety net.

### Phone (the product)
Top: round dots + «Ronda n/10», my ⭐ points, 🔥 streak. The question (picture + text). The board: my avatar in the
centre panel, four big lamps (top / right / bottom / left, ≥ 72 px tall, text auto-sized) that light up with a pop;
tap = my avatar turns toward it + whoosh + buzz; right = gold ring «¡La viste!» waiting for the rank; wrong = red shake,
dizzy avatar, «¡Esa no! Era «…»». Result: «+5 ¡Primero!» / «+3 ¡Rápido!» / «+2 ¡Bien!» / «+1 ¡La viste!» / «0» with a
Dralingo pose, score and streak. A status line always says what to do («Espera… las palabras se van a encender»,
«¡Toca la palabra correcta!»). «Así se juega» 3 pictured steps in the lobby. Game-show moments on the phone: the show
intro on the countdown (Hamdan + my avatar), «¡Mira la palabra correcta!», «¡Última ronda!», «¡FINAL!», the end card
(the winner, my rank, my points, my rights / +5s / best streak, my award).

### Projector
Lobby (PIN, the contestants as avatars, the 3 steps, rounds picker) → show intro on the countdown (title card, Hamdan's
line, the contestants in panels, 3-2-1) → the board: question bar (picture + text), green LED wall with every kid's
panel (avatar + name + score; turns toward the lamp they tapped, blue flash when wrong, +N pops with the rank order),
four lamps around the frame, round dots, top-5 strip → the falcon lands on the right answer → «¡FINAL!» → the winner
jumps on stage with a crown, top 6, awards, the gang cheers. Big moments one at a time, ≥ 7 s apart.

### Tests (2026-10-13)
- `node scripts/test-look.js` 17,185 checks OK (schedule, points tiers, looks, early close, pause shift, late joiner, standings, awards, 60 simulated classes).
- Bot playtest `--game look --bots 20 --seconds 150 --set pack:yct1-familia-r1 --handlers scripts/playtest/look.js` **PASS**: 20/20 joined, 10 rounds, 10 results, lk:final + game-end, 0 frozen, 0 errors, max 12.4 s per round.
- Bot playtest `--bots 30 --seconds 60` **PASS** (the 60 s time cap ends the game mid-round 6: 30/30, 0 frozen, 0 errors, game-end on every phone; ~15 `state` events per kid per minute).
- `test-packs`, `test-escape`, `test-wording` pass; asset guard clean on `assets/look` (8 Kenney mp3, 375 KB).
- Screenshots (playwright-cli, 1600×900 + 390×844, 11 bots + a phone as Aileen): lobby, show intro, question alone, lamps lighting, right look (gold ring), wrong look (blue ✖), pause on both screens, last round, winner show, the phone's end card. 0 phone console errors.
- Impeccable detector: only intentional findings (lamp glows, bouncy pop easing of the platform's game feel); the «+5» step chip contrast fixed (ink on gold).
- Real-browser class (classroom-playtester agent: projector 1600×900, 3 phones 390×844 + 8 bots in the room, two games): late joiner mid-reveal gets a panel and locks in that round; reload mid-round keeps the panel, score and lock; Pausa freezes lamps and taps on every screen, Seguir continues; Saltar ronda closes a round at once and skips a result; +5 rondas grows the dots on host and phones; Terminar → «¡FINAL!» → winner show + every phone's own card; Otra ronda → clean lobby and a clean second game (a tie shows both names). No page errors, no hanzi, no overlap at 390 px, lamps 370×80 / 121×364 px. Its 7 cosmetic notes are fixed (round chip after +5, the falcon perches on the lamp's corner instead of its word, the gang comes in after the awards and never lingers into the lobby, the arrow chip on the phone panel, no «+5 rondas» banner without effect, «1 acierto», a neutral welcome line, favicon).
- Code review (agent-skills:code-reviewer): server timers / pause / cap / rejoin / crash paths sound; its required fix (a status update landing during a band was lost) and optionals (lamps closed during the result, the right answer always rides along in sets with more than four answers, a skip during the bare question restarts the round without misses, the pause flag resets on «Otra ronda») are applied; 20-bot run re-passed on the restarted server.

### Scorecard · Ojo de Halcón · 2026-10-13 · 83dbcbd04 (deployed)
```
Hard gates: bots PASS (20/20, 0 frozen, 0 errors, game-end) · teacher controls ✓ (Pausa holds every clock, ⏭ Saltar ronda,
  +5 rondas, Terminar, Sonido, Otra ronda; every wait is server-timed) · saga only ✓ (saga avatars, the cast, Dralingo in
  his platform look, the saga falcon; test-wording clean) · Spanish/pinyin/level ✓ (questions only from /packs.html) ·
  kid-safe ✓ (no touching; existing stickers)
1 Real place ........ 1/2  a Dubai TV studio (navy night, studio lights, the skyline) and the gold board with the LED wall,
                           but the studio is CSS + the skyline webp: no landmark worth points yet (brief content/look/pictures.json)
2 The gang .......... 2/2  Hamdan hosts (lobby, intro bubble, gang finale), Profe Fer / the cast cheer on streaks, Dralingo
                           comments from the corner, every kid in their own panel as their saga avatar (phone + projector)
3 Every tap ......... 2/2  lamps ≥ 80 px with press + whoosh + buzz, dark lamp wobbles «Aún no hay nada ahí», «Así se juega»
                           3 pictured steps (lobby, phone + projector), a status line that always says what to do
4 Feedback .......... 2/2  gold ring / blue shake per look, +5 ¡Primero! / +3 / +2 / +1 / 0 pops with a Dralingo pose, the
                           falcon on the right lamp, streak bands at 3/5/8 with a cast line, big beats ≥ 7 s apart
5 Finale ............ 2/2  dots count down, «¡Última ronda!», «¡FINAL!», winner with crown + top 6 + 3 awards + gang,
                           every phone its own rank, points, rights / firsts / streak / reaction and award
6 Fair, no stall .... 2/2  right look always ≥ +1, wrong = 0 (real fail state), ranks by server arrival, round closes 0.7 s
                           after everyone looked, late joiners get a panel, reloads keep it (looks keyed by panel)
7 Product feel ...... 1/2  recorded sounds + show loop (Kenney), phone as polished as the projector at 390 px / 1600×900;
                           but the board, lamps and studio are CSS drawings, not pictures (brief written)
Total 12/14 → ships (≥ 12, no 0). Work left for 14/14: the pictures of the brief (studio, board, Hamdan with his
microphone, the falcon perched, the medals) and one real landmark worth points on the board.
```

### Files
`core/look.js` (rules, pure; tunables in `R`) · server.js «OJO DE HALCÓN» block (`lkStart / lkRound / lkLook / lkClose /
lkFinal / lkFinish / lkPause`, handlers `player:lk-look`, `host:lk-rounds`, `host:lk-more`, `host:lk-skip`; branches in
host:create/start/end-now/reset/reclaim, player:join/resync, host:pause, the watchdog, the host-left cleanup) ·
`public/host-look.html` + `js/host-look.js` (projector; hooks `LookHost.frame() / hold()`) · `js/player-look.js` (phone;
hooks `LookPhone.frame() / hold()`) · `player.html` `#screen-look` · `css/look.css` · `js/player-kingdoms-skin.js` (look
branches) · `assets/look/*.mp3` (Kenney CC0) · registered in `games.html`, `packs.html`, `sets.html`, `js/maestro.js` ·
tests `scripts/test-look.js`, bots `scripts/playtest/look.js`.
