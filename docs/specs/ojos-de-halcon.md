# Ojos de Halcón · new pin game (Super Mario Party «Looking for Love», recreated in boards of 4)

gameType `halcon` · built 2026-10-13 on a worktree branch (not deployed) · replaces the first attempt «Ojo de Halcón»
(`look`, `docs/specs/ojo-de-halcon.md`), whose launcher entries were removed; its code stays until he says to retire it.

## The brief (his words and decisions, 2026-10-13)
He wants the Mario Party minigames recreated EXACTLY, one by one, as pin games with our cast. This one is the minigame
at 1:07–1:51 of https://www.youtube.com/watch?v=y9BKCVx_mNk («Look at the ♥!»). About the previous attempt by another
model: "it looks nothing like the mini game. The mini-games should be like a competition, just like Mario Party. Kids
are competing in the avatar fields, the complete avatar, not just a little portion of the face of the girl or of
Hamdan; the 2D character moving just like it is in the video. Make sure it makes sense with 10 kids or 4 kids. The
teacher main screen is useless: the kids' screens are the most important. Build according to Mario Party, because they
already know what works in groups. Just recreate exactly how they did it." He chose: the class plays in BOARDS OF 4.
(Rule in `CLAUDE.md` § Pin games «Mario Party recreations».)

## What the video shows (frames looked at: 1:09 intro, 1:13 instruction, 1:15, 1:17 first scoring, 1:31 a wrong look, 1:44 final scores, 1:48 winner)
- **Intro (1:08–1:11):** wide shot of a gym studio (wood floor, posters, props); the 4 characters RUN up to a big wall
  board (orange/gold frame, dark screen, 4 round windows: top, bottom, left, right).
- **Board view (1:12–1:43):** the frame fills the screen. Inside: a screen split into 4 vertical stalls, one per player,
  each player shown full/half body facing camera on a green screen; 4 round windows on the frame; score chips with
  player head icons along the top edge; a row of ~10 small dots above the stalls = round progress. Banner at start:
  «Look at the ♥!», then «START!».
- **Each round (~3 s):** symbols appear in the windows; each player snaps head and torso to look at one window. At the
  resolve: right lookers get a glowing ring + sparkles and a floating +5 / +3 / +2 / +1 by speed rank and pump their
  fists («Yes!» cheer); a wrong look = 0, that stall goes dim/blue and the character slumps («Aww»). 10 rounds, no
  elimination.
- **End:** «FINISH!» (1:43), final scores on the chips (1:44), back to the studio: the board says «Mario Wins!», the
  winner runs forward and poses with arms open, the other three sit/fall on the floor (1:46–1:51), victory fanfare.

## Ours: the same minigame, reskinned
- **Setting:** a luxury Dubai TV studio (cream-and-gold walls, arched windows on the Dubai skyline, polished floor, the
  Burj Khalifa and Atlantis models as studio props) and a brass board with an Emirati lattice and eight-point stars
  instead of the orange one. Dralingo (platform look: kandura, ghutra, mustache) hosts from the side of the set.
- **The ♥ = the right answer** of a curriculum question from the question packs (`/packs.html?game=halcon`: test family
  → level → world → round). Spanish UI, pinyin without tone marks, no hanzi, only the pack's level words; questions say
  exactly what they ask («¿Cómo se dice «hermano mayor» en Chino Mandarín?»).
- **Pacing (kids need reading time):** question across the board 1.5 s → the answers pop into the windows, 6 s with the
  dots and a timer bar ticking in the last 3 s → resolve 2.3 s → next. 10 rounds by default, 15 if the teacher picks it.
- **Scoring exactly like the video, per board:** right looks ranked by speed inside the board: +5 / +3 / +2 / +1 (board
  of 3: 5/3/2, board of 5: 5/3/2/1/1); wrong or no look = 0 and the slump. The class ranking sums the points (every board
  hands out the same maximum per round, so it is fair across boards).
- **Boards:** at «Empezar» the server shuffles the class into boards. ≤ 5 kids = one board; otherwise ceil(n/4) boards
  with sizes as even as possible (always 3 or 4). Late joiners go to the smallest board (max 5; all full → a new board).

## As built
### Rules (`core/halcon.js`, pure; tunables in `R`)
- `boardSizes / splitBoards / deal / lateSeat`: the boards above. Kids sit in SEATS (`p.hcSeat`, stable ids): a reload
  or a new socket keeps the seat, the board, the score and the round's look; a seat stays on its board if the kid
  leaves (the stall goes grey «off» and scores 0).
- `pickOrder / nextQuestion`: the pack in random order with questions whose answers fit a window (≤ 22 characters)
  first, no repeats until the pack is used up.
- `startQuestion`: the answers go to random windows. «¿Qué significa «gege»?» questions show a picture per window (with
  its Spanish label) when every answer has one in the level's word list; never for «¿Cómo se dice…?» (the picture of the
  asked word would give it away); otherwise text. One look per round, locked; right/wrong stays secret until the round
  resolves (like the video, everybody learns it at once). `closeEarly`: when every connected kid has looked, the round
  resolves 0.5 s later.
- `resolve`: points per board by speed rank, streaks, +5 count, misses. `finish`: each board's ranking and winner(s)
  (score, then most +5, then the faster average look; exact ties share the win) and the class ranking.
- Teacher: «Pausa» holds every clock (server timer + the room's cap, shifted on resume), «⏭ Saltar» (the intro or a
  bare question → a fresh question; open windows → resolve now; a resolve → next round), «+5 rondas» (up to 20),
  «⏹ Terminar» (plays «¡FINAL!» first, then the finale), «🔊 Sonido», «🔄 Otra ronda». Every wait is server-timed: no
  kid can hold the class.

### Server (`server.js` «OJOS DE HALCÓN» block)
`hcDeal` (at «Empezar», so the countdown plays each board's run-in) → `hcStart` (cap, late seats, intro) → `hcRound`
(`hc:q`) → `hcOpen` (`hc:open`) → `hcAnswer` (`hc:mine` to the kid, `hc:look` to the board's phones + projector,
`hc:closing` when all looked) → `hcResolve` (`hc:resolve` per board to its phones, all boards + top 5 to the
projector) → … → `hcFinal` (`hc:finish`) → `endGame` → `hcFinish` (`game-end`: each phone gets its board's ranking +
its own place, the projector everything). Phones only ever receive their own board. Branches in host:create / start /
end-now / reset / reclaim, player:join (incl. countdown rejoin) / resync, host:pause, host:add-time, the watchdog, the
host-left cleanup; handlers `player:hc-look`, `host:hc-rounds`, `host:hc-more`, `host:hc-skip`. `host:load-set` now
keeps `g.setId` (for the level's word pictures).

### The phone (the product): `js/player-halcon.js` + `js/halcon-board.js` + `css/halcon.css`, `#screen-halcon`
- **Lobby:** «Vas a concursar como <full-body character>» + «Así se juega» in 3 pictured steps (question band, the
  windows with my character, the +5 glow).
- **Countdown:** the studio wide shot; my board's characters run in from both sides and land in front of the board
  (mine marked «TÚ»), Dralingo: «¡Tu tablero: Hamdan, Adric, Latifa!»; the camera pushes into the board.
- **The board** (portrait: stalls 2×2 so every full-body character stays big; landscape/tablet: stalls in a row like
  the video): brass frame, 4 round windows ≥ 84 px (the window is the button), score chips with the heads in the top
  corners (mine gold), the round dots and a timer bar, every board member as a full-body character, my stall framed
  gold with «TÚ». «¡Mira la respuesta correcta!» → «¡YA!» band at the start.
- **A round:** the question across the board (band, 1.5 s), then the answers pop into the windows (text sized so words
  never break, or pictures with labels); the hint line always says what to do; a tapping hand on round 1. My tap: my
  character snaps to look (lean + turn toward the window + a gold beam from the eyes to the window + an arrow on my
  tag), the window rings gold «TÚ», whoosh + buzz, «¡Miraste arriba! Esperando a los demás…». Rivals turn live with
  white beams as they look. Ticks in the last 3 s.
- **Resolve:** the right window glows, right looks get the ring + sparkles + «+5 / +3 / +2 / +1» (staggered by rank) +
  the victory pose with a hop; wrong / no look: blue dim + the sad pose slumping; chips count up; «¡Sí!» (rising sax) /
  «Aww» (falling sax) / the +5 jingle; the hint names the right answer when I missed.
- **«¡FINAL!»** band (windows close if «Terminar» came mid-round), the leader's chip gets the crown.
- **Finale (on the end screen):** the studio: the board says «<nombre> ¡Gana!» («¡Ganan!» on a tie), the winner poses
  in front (Dralingo and Adric animate), the others sit or fall on the floor (mine always in view), confetti, fanfare;
  then my card: place on my board, my points, my class place, the class champion, «🏠 Inicio».
- Pause card «⏸ Pausa · Mira al profe». `prefers-reduced-motion`: no run-in, no confetti, instant looks.
- Sounds: `assets/halcon/` (Kenney CC0: yes/aww/start jingles; round/pop/final/first/show loop from the `look` set) +
  `assets/kingdoms/` (tick, whoosh, tap, sting-win); the platform mute. No synthesized beeps.

### The projector (secondary): `host-halcon.html` + `js/host-halcon.js`
Lobby (PIN + QR, the 3 steps, the contestants as full-body characters, the studio preview with «N concursantes ·
N tableros», 10/15 rounds) → countdown studio (the class runs in, Dralingo: «¡3 tableros de 4! ¡A sus puestos!») → the
boards as mini Mario boards (one board = the video's full-screen board; 2–8 boards in a grid; each with «👀 3/4 miraron»),
the question big on top with the right answer chip at the resolve, «Top 5 de la clase», Dralingo's lines → «¡FINAL!» →
the studio finale: the class winner(s) posing (one board: the others fall, like the video), each board's champion
cheering, «Campeones de cada tablero» + class top 5, «Otra ronda». Teacher buttons always visible.

### Art
Full-body poses of the gang + Dralingo (`assets/halcon/cast/<id>-ready|victory|sad.webp`, 400 px, 12–28 KB each, from
the local-AI cut-outs of 2026-10-13, checked: full bodies, nobody touching, no text). Animals: the saga stills.
Animated winners: Dralingo `cheer-lite`, Adric `adric-cheer-lite`. Studio: CSS + `assets/dubai/skyline-wide.webp` +
the kingdoms landmark models.

### Files
`core/halcon.js` · `server.js` (block + branches) · `public/host-halcon.html` · `public/js/host-halcon.js` ·
`public/js/halcon-board.js` (board + studio, shared) · `public/js/player-halcon.js` · `public/css/halcon.css` ·
`public/player.html` (`#screen-halcon`, includes) · `public/js/player.js` (init, screen map) ·
`public/js/player-kingdoms-skin.js` (skin, music, lobby/end routing, no 3-2-1 ticks for halcon) · `public/games.html`,
`packs.html`, `sets.html`, `js/maestro.js` (+ `maestro.html` version) · `public/assets/halcon/` · tests
`scripts/test-halcon.js` (rules), `scripts/test-halcon-live.js` (server timing against a running local server), bots
`scripts/playtest/halcon.js` (`playtest-bots.js` now loads `scripts/playtest/<game>.js` by itself) ·
`scripts/test-wording.js` (halcon files added).
Test hooks: `HalconPhone.frame() / tap(pos) / hold(v) / freeze(v) / replay(ev) / queued()`, `HalconHost.frame() /
freeze(v) / replay(ev) / hold(v)`.

### Fixes from the reviews (applied before the commit)
Design critique (impeccable, dual pass): verdict pill + ✓/✗ on the windows + bigger «+N» on my stall + resolve 2.3 s;
the asked word «…» in big gold on the question band; losers in their own slots (nobody piled on anybody; my own kid
always in view); Dralingo's line fades before the result card; sound button out of the play area; «breathing» ring on
the open windows animates opacity only; tie / zero-point wording on the card; lobby text contrast. Detector: heading
levels on the projector, step padding. Code review: the finale is re-sent to a projector or phone that drops around
the end (reclaim / resync), a double «Saltar» never skips the result (700 ms guard + button lock), a tap lost in a
network blip is re-sent (1.2 s retry + after a rejoin), the paused clock stands still in snapshots, a dropped phone
triggers the early close, nobody «wins» with 0 points, «Terminar» also on the pause card, a late board keeps the other
boards' round on the projector, late seats join after «intro». Classroom playtest: «Terminar» while the windows are
open still scores the looks already made; the bot stall clock starts with the game.
Kept on purpose (his brief): rivals' looks are visible live, as in the video — a kid could copy the fastest rival, but
copying is slower and scores less.

## Tests (2026-10-13)
- `node scripts/test-halcon.js` → 68,221 checks OK (boards for 1–40 kids + 12 late joiners each, 5/3/2/1 · 5/3/2 ·
  5/3/2/1/1 · 5/3 · 5, wrong / none = 0, one look per round, early close vs the 6 s window, a disconnected kid never
  holds a round, ranks per board, pause shift, question order, per-answer pictures, ties and tiebreaks, nobody wins at
  0, the end payload, 400 simulated classes where every point adds up).
- `node scripts/test-halcon-live.js --url http://localhost:3500` → 31 checks OK against a running server: skip in the
  intro, pause holds the round (no resolve, looks refused, the clock stands still), resume, a double «Saltar», a kid
  who drops and rejoins mid-round keeps seat + look, «+5 rondas», «Terminar» while paused, a projector reconnecting
  after the end gets its finale again, «Otra ronda» = a clean game, «Terminar» during «¡FINAL!» is ignored.
- Bots (`node scripts/playtest-bots.js --url http://localhost:3500 --game halcon --bots N --seconds 120`, handler
  `scripts/playtest/halcon.js` checks every resolve against the rules and every end payload): **4 bots PASS** (one board
  of 4, 10 rounds, 40/40 rule checks, 4/4 end payloads) · **10 bots PASS** (boards 4+3+3, 100/100, 10/10) · **30 bots
  PASS** (boards 6×4 + 2×3, 300/300, 30/30) · the classroom-playtester's own **20 bots PASS** (5×4) and **30 bots
  PASS**. 0 frozen kids, 0 errors, ≤ 9.8 s per round.
- `test-packs` (82 rounds, 1,593 questions), `test-wording` (35 files clean), `test-escape`, `test-look`,
  `test-kingdoms`, `test-paint`, `test-snow` pass.
- Real browsers (classroom-playtester agent: projector 1600×900 + up to 4 phones 390×844 + bots, 7 games): joins with
  full-body characters, each phone only its own board, a real tap registers and locks, rivals' beams live, scores by
  speed on boards of 3 and 4 checked by hand, 9 kids = 3 boards of 3, a late joiner lands on the smallest board and
  plays the next round, pause exact to the second on every screen, reload mid-round and while paused keeps seat /
  score / look, «Saltar» in every phase, «+5 rondas», «Terminar», «Otra ronda»; no hanzi, Spanish UI, nothing cut at
  390 px, no console errors. 360×640 cheap phone with a board of 5: windows 84×84, no scroll.
- Screenshots (playwright-cli, freeze/replay hooks): phone intro run-in, question band, windows with rivals looking,
  my look, resolve with +5 glow / +3 / slumps, «¡FINAL!», studio finale with «Hamdan ¡Gana!» and the others on the
  floor, lobby card; projector lobby (PIN + QR), «¡YA!», one board (the video's board), 3 boards, resolve, «¡FINAL!»,
  finale with the board champions.

## Scorecard · Ojos de Halcón · 2026-10-13 · branch, not deployed
```
Hard gates: bots PASS (4 / 10 / 20 / 30, 0 frozen, 0 errors, game-end) · teacher controls ✓ (Pausa holds every clock,
  ⏭ Saltar in every phase, +5 rondas, ⏹ Terminar also on the pause card, 🔊 Sonido, 🔄 Otra ronda; every wait is
  server-timed; test-halcon-live) · saga only ✓ (the cast + Dralingo in his platform look + the saga animals; no
  logos; test-wording clean) · Spanish / pinyin without tones / pack level ✓ (questions only from /packs.html, no
  hanzi) · kid-safe ✓ (full-body cut-outs checked, nobody touching, losers in separate slots)
1 Real place ........ 1/2  a Dubai TV studio (arched windows on the skyline, Burj + Atlantis props, a brass board with
                           an Emirati lattice); but no landmark worth points: the minigame has none, so this stays a
                           themed set
2 The gang .......... 2/2  every kid IS a cast member (full body, on every phone and the projector), the run-in intro
                           of my board, the cast win and slump every round, Dralingo hosts the intro / rounds / finale;
                           (the cast don't speak their own lines here: no captains in this minigame)
3 Every tap ......... 2/2  windows ≥ 84 px (the window is the button), press sink + whoosh + buzz, my character snaps
                           with a gold beam and «TÚ», a tapping hand in round 1, «Así se juega» 3 pictured steps, a
                           hint line that always says what to do, the pause card
4 Feedback .......... 2/2  +5 / +3 / +2 / +1 by rank with glow ring + sparkles + victory pose, blue slump + sad pose,
                           ✓ / ✗ on the windows, a verdict pill, «¡Sí!» / «Aww» / +5 jingles, streaks; the bands only
                           between rounds (never over open windows)
5 Finale ............ 2/2  round dots + «¡Última ronda!», «¡FINAL!» + the leader's crown, the studio: «<nombre> ¡Gana!»,
                           the winner poses (Dralingo / Adric animated), the others sit or fall, confetti, fanfare,
                           each phone's own card (board place, points, class place, the champion); projector: class
                           winner + board champions + top 5 (no lead-change cheer yet)
6 Fair, no stall .... 2/2  speed counts inside each board, wrong = 0, server-timed rounds that close early when all
                           looked (or one dropped), late joiners to the smallest board, reloads keep seat and look,
                           lost taps re-sent, the finale re-sent after a drop
7 Product feel ...... 2/2  the cast as full-body art (local AI cut-outs), the skyline, recorded Kenney sounds and show
                           loop, the phone is the minigame itself and as polished as the projector (390×844, 360×640,
                           1600×900)
Total 13/14 → ships (≥ 12, no 0). For 14/14: a landmark worth points (not in this minigame) or a painted studio set.
```

## Open / next
- His OK to retire `look` (code, `assets/look`, `content/look`, its spec, the server block).
- Recorded crowd «¡Sí!» / «Aww» voices (local voice studio) instead of the sax jingles.
- Optional pictures: a studio backdrop painting and Dralingo with a microphone (local AI studio).
- Next minigames of the series reuse `core/halcon.js` (boards, seats, speed ranks, timers) and `js/halcon-board.js`
  (board + studio + run-in + finale).
