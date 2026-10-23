# Dragones Pintores v2 · «El Cielo de las Maravillas» (gameType `paint`)

**Name since 2026-10-23: «Draly Pintores · El Cielo de las Maravillas»**, short «Draly Pintores» (the «Draly Party» names, his «Approve all»; `core/game-names.js`). The text below keeps the name it had when it was written.

Address `/host-paint.html?setId=…` and gameType `paint` unchanged (games.html, packs.html, /maestro's launcher and
`?livegame=1` keep working). Remade 2026-10-17 on a branch, not deployed. v1: `docs/specs/dragones-pintores.md`.

## Why
Fernando: **kids didn't like it**, he thinks it's the graphics, and the scorecard was 13/14 (nothing in the sky worth
fighting for). On a phone v1 looked primitive: white rectangle «clouds», flat colour-stripe floors, tiny dragons,
overlapping name labels, little green diamonds as the only prizes, and three ◀ ▶ ⬆ buttons to learn.

## His picks (2026-10-17)
1. **Dubai + China, a new sky each round.** Each round is a different world, and **the prizes in the sky are its
   landmarks** (floating islands a kingdom captures).
2. **Tap where to fly.** One finger: tap or swipe on the sky and my dragon flies there, painting what it passes. The
   server still judges: a tap is an intent the server validates; no teleporting.
3. Keep what the game is: dragons flying, painting the sky in their kingdom's colour (Fuego vs Mar), answering to
   recharge their fire; keep the teacher flow, the address and the gameType. Anything else may change.

## The worlds (one per round; «Otra ronda» = the next one; the teacher can pick another in the lobby)
| # | World | The sky | Prize islands (+10 each while held) |
|---|---|---|---|
| 1 | **Dubái de noche** (the main stage, first) | indigo night, stars, moon, fireworks, the skyline | Burj Khalifa (centre) · Museo del Futuro · Burj Al Arab |
| 2 | **La Gran Muralla al atardecer** | golden sunset, misty ridges, the Wall | Templo del Cielo (centre) · Torre de la Muralla · Isla del Panda |
| 3 | **El río Li** | dusk, misty karst peaks, sky lanterns | Pagoda del Pico (centre) · Colina Trompa de Elefante · Puente de la Luna |
| 4 | **Las luces de Shanghái** | night, the Pudong lights on the river | Torre Perla Oriental (centre) · Torre de Shanghái · Jardín Yuyuan |
Art (Higgsfield Unlimited, glossy 3D): a far background + a mid strip per world (parallax on the phone), the islands,
4 cloud shapes, sky props (lanterns, a crane, a kite, a balloon). Painted clouds are tinted in code (glowing fire red /
sea blue). Dragons = the Vuelo dragoncitos (3 flying frames, red / blue) with the kid's saga character riding.

## The sky and the rules (`core/paint.js` + `public/js/paint-worlds.js`, shared by server, projector and phones)
- A 1600 × 1000 sky. 48-56 clouds placed from a seed above the world's ground strip (none on an island or a home) and
  mirrored for the other kingdom; three islands placed fairly: one on
  the centre line (contested), one near each kingdom's home, mirrored. Fuego starts left, Mar right.
- **Fly:** a tap (or a finger dragged on the sky) sends `player:pc-go {x, y}`. The server clamps it to the sky, takes at
  most 12 a second, and moves every dragon itself at 10 Hz at a fixed speed (300 u/s, 360 in a Llamarada) toward its
  target: position only ever changes by the server's step. The phone predicts the same straight flight at the same
  speed (instant response) and eases onto the server's position.
- **Paint:** the server paints every cloud the dragon's brush touches on its own path (22 u; 60 in a Llamarada); a cloud
  can't change colour again for 1.5 s. The phone shows its predicted paint at once and takes the server's colour back
  when it disagrees. Phones never send paint.
- **Fire:** 15 s at the start; flying burns 1 s a second, hovering is free, painting an island burns like flying. A
  right answer +10 s (max 30), 3 in a row = «¡Llamarada!» (6 s, wide brush, faster). At 0 the dragon stops where it is
  (no forgotten target after the recharge) and the question rises by itself («¡Sin fuego! Responde y vuelve a volar»);
  after a «¡Casi!» the next one waits 2.6 s (4.2 s after two in a row) while the phone shows the right answer.
- **Islands (the prizes):** each has a ring. Dragons of a kingdom inside it with fire push its meter toward their colour
  (0.15 a second each: ~6.7 s alone, ~2.2 s for three; at most 3 counted per kingdom; the other kingdom pushes back).
  Full = **captured** (+10 to the
  kingdom while held, a big moment on every screen). Pushed back past the middle = lost (neutral); full the other way =
  the other kingdom's. Credit (for the star «Conquista maravillas») to every dragon of the kingdom inside at the capture.
- **Score:** a kingdom = its clouds + 10 per island it holds now. A kid = clouds that are theirs now (the crown, the
  podium), plus islands conquered and strokes for the card and the stars.
- **Viento a favor (the comeback, capped at the gap):** while a kingdom trails by 12 or more, a right answer of one of
  its kids also blows a gust onto the rival clouds nearest that kid's dragon (one gust per kingdom every 20 s): up to 3, never more than
  ⌊(gap − 1) / 2⌋ (each flip is a 2-point swing), so luck alone never puts the trailing side ahead. `scripts/sim-paint.js`
  measures that a stronger kingdom still usually wins.
- **Fair:** too-fast answers (< 450 ms) count as wrong; one answer per question; nothing paints while paused or after
  «¡FINAL!» (+ the shared 0.6 s grace for moves already on their way); a late joiner starts at home with 15 s; clouds
  belong to the kid's id (never to a name another kid could type); the step order is shuffled every tick.

## Phone (the product)
Top: the race bar (Fuego vs Mar points, the islands each side holds), the clock, my fire bar. The sky fills the screen:
the world's background in parallax, the islands with their capture rings, the clouds, every dragon; **mine big with a
pulsing ring and «TÚ»**, a ripple where I tapped, the camera following me; name tags never overlap (a tag that would
overlap another hides; mine and my captain's first); a minimap of the whole sky top right (tap it to fly there). The
big «🔥 Recargar» button sits at the bottom; the question is a sheet over the bottom of the sky (picture, prompt, 4 big
tiles, 20 s clock): the sky stays alive above it. First play: «Así se juega» (3 pictured steps) + a tapping hand on the
sky. Moments: captures and losses of islands (my kingdom's colour, the island's picture, my captain's line), lead
changes, 25/50/75 %, «Viento a favor», «¡Fuego doble!» in the last 30 s with a gold frame; one at a time.

## Projector (secondary, readable from the back)
The whole sky at 1600×900 with every dragon and name tag (collision-avoided), the crown on each kingdom's top painter,
the world's name, the race bar with the islands each side holds, the clock (last 10 s big), side panels with the
captains and the rosters, Dralingo / the captains announcing; a capture flies the island's picture to the centre in
the kingdom's colour. Lobby: PIN, the round's world (picture + «Cambiar mundo»), «Así se juega», duration,
Equilibrar, start.

## Mario Party touches and the ending
Lead alarms (≥ 7 s apart), island captures, «Viento a favor», the last 30 s «¡Fuego doble!» (+20 s per right answer
and always a Llamarada) with fireworks, «¡FINAL!» then the shared ceremony (`js/party.js`, `core/party.js`) with
Pintores' bonus stars: Más nubes pintadas, Más cielo al final, Racha más larga, Más llamaradas and NEW **Conquista
maravillas** (most islands captured); each kid's card adds «Conquistaste N maravillas». Also fixed: the «Sonido» chip
no longer covers «Ver mi tarjeta» on the phone's ending.

## Teacher
Every control kept: ⏸ Pausa (every dragon and meter stops, the clock too), +30 s, Terminar, Sonido, ⏭ Saltar,
Otra ronda (the next world), F5 reclaim with the room token (`teacher-gate.js`). Every wait has a timeout (a question
nobody answers ends at 20 s on the phone and 23 s on the server; the sheet's verdict never waits on a lost packet).

## Network (30 phones)
Up: `player:pc-go` (≤ 12/s, usually a few per tap). Down, to the room: `pc:pos` 5 Hz (a short id, x, y, target, flags
per dragon, only when something moved), `pc:paint` 5 Hz only on change (cloud flips, scores, island meters, events),
`pc:roster` when someone joins or changes kingdom. No full `state` pushes during play.

## Scorecard target
14/14: real place = the four worlds with their landmark prizes worth points, captured and stolen, placed fairly;
gang = captains VS + lines, riders on team-colour dragons; every tap = tap-to-fly with a ripple and a hand, the 3-step
card, «Recargar» prompts; feedback = paint splashes, captures, streaks, one big moment at a time; finale = captures,
comeback, last 30 s, ceremony + new star; fair = server-judged flight and paint, comeback capped, timeouts; product =
Higgsfield worlds, recorded sounds, phone at 390/360 as finished as the projector.

---

## As built · 2026-10-17 (branch `paint-v2`, not deployed)

What changed from the plan above, after three reviews (below): the minimap became **pointers at the screen's edge**
for the islands out of view (tap one = fly there); the phone's moments are **one slim pill above the fire button** (never
over my dragon), not cards under the HUD; a dragon **hovering in an island's ring is drawn circling it** on the ring's
edge (the landmark stays in view); the last 30 s are called **«¡Recarga doble!»** (not «Fuego doble»: on a Mar phone
that read as "Fuego scores double"); islands capture at 0.15 a second (~6.7 s alone); 15 s of fire at the start; a
«¡Casi!» waits 2.6 s (4.2 s after two in a row); «Viento a favor» is one gust per kingdom every 20 s.

### Files
- New: `public/js/paint-worlds.js` (the worlds + the seeded mirrored sky, UMD: server and both screens build the same
  sky), `public/css/paint.css` (phone `pp-*`, projector `ph-*`), `scripts/sim-paint.js` (simulated classes on the real
  rules), `scripts/test-paint-live.js`, art in `public/assets/paint/` (below).
- Rewritten: `core/paint.js` (the rules engine: intents, the server's flight step, paint on the path, islands, totals,
  the comeback, rewards, stars), `public/js/paint-render.js` (the shared canvas renderer), `public/js/player-paint.js`
  (the phone), `public/host-paint.html` + `public/js/host-paint.js` (the projector), `scripts/test-paint.js`,
  `scripts/playtest/paint.js`, the phone markup in `public/player.html`.
- Shared files, paint parts only: `server.js` (the «DRAGONES PINTORES v2» block; handlers `player:pc-go`, `player:pc-ask`,
  `host:pc-world`; `state.pcWorld`; «Otra ronda» = the next world; join / rejoin / resync / late joiner / swap /
  balance / 5-min cleanup send `pc:roster`; the ending's `lms`), `public/js/player.js` + `player-kingdoms-skin.js`
  (paint skips the generic question / result screens; «Recarga doble»; the lobby card), `public/js/party.js` (the new
  star «Conquista maravillas», its card line, the reveal «¿Qué reino ganó el cielo?», points), `public/css/party.css`
  (the round's world behind the ceremony; **the «Sonido» chip fix**: a game screen's own `:has(#screen-…)` rule kept it
  bottom-right over «Ver mi tarjeta»), `public/css/kingdoms.css` (v1's phone rules removed; the shared card rules kept),
  `games.html`, `maestro.js`, `test-party-live.js`, `test-wording.js`, docs. v1's `assets/paint/islands/` removed.

### The art (Higgsfield Unlimited in his Chrome, 0 credits, no reference uploads; he was not using Higgsfield)
29 WebP, 0.86 MB: per world a far background (1600×900, 25-52 KB) and a mid strip (the ground, 1600 px wide, 63-102 KB),
3 landmark islands per world (12, 12-51 KB; Dubai's re-cut bigger from art batch 1's sheet), 4 clouds, 5 sky props.
Originals + log: `assets-library/higgsfield/2026-10-17/paint2/`. Kept on purpose: the Li River's «Colina Trompa de
Elefante» came as a glossy stone elephant drinking from a pool (kids read it at once).

### Tests
| Test | Result |
|---|---|
| `node scripts/test-paint.js` (worlds, 205 seeds: the same sky everywhere, mirrored, nothing overlapping; tap clamp, no teleport, fire, paint on the path, the cooldown, the wide brush; islands: capture, the cap of 3, contested, loss, steal, away / no fire; the comeback over 300 random boards: within ⌊(gap−1)/2⌋, never level or ahead; rewards; too fast; the ending; 240 simulated classes) | ~395,000 checks pass · sim: a kingdom answering 85 % vs 55 % wins 92 %, equal kingdoms 52/48, the wind is 9 % of strokes, a thinker paints 1.48× a fast guesser, ~12 island captures a 3-minute round |
| `node scripts/test-paint-live.js` (real sockets: the lobby's world pick, the same sky on every screen, a tap clamped, no teleport, nonsense ignored, the tap rate, paint, «Recargar», an island captured, out of fire → a question by itself, «¡Casi!» 2.6 s / 4.2 s, a double-tap guess, +10 s, Pausa, +30 s, a reconnect with its dragon and open question, a late joiner, the projector's reclaim, the server's 23 s time-up, Terminar → the ceremony with the islands star, «Otra ronda» = the next world) | 66 checks pass |
| `playtest-bots.js --game paint --seconds 60` | 4 bots PASS (20 questions) · 20 PASS (118-122) · 30 PASS (170-188, three runs in a row on the final code) · 0 frozen · 0 errors. One 30-bot run flagged a «frozen» bot: its «Recargar» crossed the server's own deal at 0 fire, the same question came twice and the bot answered both (a phone shows one question per id); fixed in the phone (a late copy is ignored) and in the bot handler |
| Every live test (`run-live-tests.js` on a throw-away server: dragon, halcon, mochi, monopoly, paint, party, pinata, sixseven) | 8/8 pass (also after the rebase onto main b053aa539, the warm-up / reading / exam lock: test-host-reclaim 105, test-socket-codes 128) |
| Every other suite (25, incl. audios-base with `STUDY_DIR`) + `asset-guard.js` | all pass · exit 0 |

### Reviews and what changed
- **Classroom playtest** (real browsers: projector + phones at 390 and 360 + 22 socket kids, 7 rounds, all 4 worlds;
  bots 20/30 PASS): fixed the projector's F5 mid-round opening a new room (now it takes the same room back:
  sessionStorage + `host:reclaim` with its token, like Monopolio), «TÚ» floating far above my dragon with another kid's
  name on it (my sprite's box is reserved first, «TÚ» sits right above it), a time-up read as «¡Casi!», the shared
  «¡Últimos 30 segundos!» card over the phone's fire bar, the projector lobby taller than 900 px with a full class, a
  stale lead line, the dragon flying on to a forgotten target after a recharge (out of fire = it stops), a short start
  (15 s of fire). Reported, not changed (shared join code): a second kid typing the same name takes the first kid's
  phone over, which then sits on an empty sky.
- **Code review** (agent-skills:code-reviewer, «request changes», no critical): fixed a dead question sheet after a lost
  answer (the server's «no-question» closes it; `pc:init.q`), a double tap counted as a guess (tiles armed 0.5 s after
  the sheet rises), the phone's clock on a wrong device clock (`endsMs` + the measured skew), an expired question
  flashing after a rejoin, island moments every ~5 s (a loss + a capture within 2.5 s = one moment; rival news ≥ 6 s
  apart; slower capture), the renderer's cost on cheap phones (only what the camera sees, glows made once, no layout
  read per frame), the projector drawing under the ceremony, `pc:pos` sending every dragon (only the ones that moved,
  all every 2 s), ghost dragons after the 5-minute cleanup and «Equilibrar» mid-round, clouds keyed by a name another
  kid could type (now the kid's id), the drift during a pause / «¡FINAL!», a missed countdown on the projector, dead v1
  code.
- **Fresh-eyes design review** (stills only, «fix»): the moments moved to a pill above the fire button, my dragon 1.45×
  and on top with the others smaller, names only round me on the phone, the camera keeps me off the HUD, «Sonido» is an
  icon in the HUD row, islands circled + thicker rings + a big flag + edge pointers, the climax narration (a lead line
  only while it is true; the last 10 s belong to the countdown; «¡Burj Khalifa queda libre!»), «Recarga doble», the
  numbers («23 nubes · 1 maravilla», points everywhere, «☁️ 4 mías», «¡Nos faltan 3!»), the ceremony shows the round's
  world, the riders seated on their dragons. Kept: the podium ranks by clouds, not stars (shared ending); no «Tu cielo»
  picture on the card (shared ending).
- **impeccable detector** (at the end, on the game files): fixed the sheet's top border on rounded corners, a tight
  leading, empty <img> sources, the score tiles' contrast and the projector's side panels (deeper red / blue under white
  text). Kept: bounce easing (a kids' party game, as in the other remakes), the last 30 s gold frame glow (the climax),
  and flags that belong to the shared Reinos lobby look (the outlined title, the page gradient) or to captain pictures
  filled in at the countdown.

### Scorecard · Dragones Pintores v2 · 2026-10-17 · branch `paint-v2`
```
Hard gates: bots PASS (4/20/30) · teacher controls ✓ (⏸ Pausa, +30 s, ⏭ Saltar, Terminar, Sonido, Otra ronda = next
            world, F5 reclaim, world pick) · saga only ✓ · Spanish/pinyin/level ✓ (questions from the packs; no hanzi or
            tone marks in the paint files, test-wording) · kid-safe ✓ (no text/logos in the art, nobody touching)
1 Real place ........ 2/2  four worlds (Dubái de noche, la Gran Muralla, el río Li, Shanghái) and their landmarks are
                           the prizes: +10 while held, captured and stolen, one on the centre line + two mirrored
2 The gang .......... 2/2  captains VS in the countdown, side panels, lines on captures and leads on the phones and the
                           projector, every kid's saga character riding a dragon in the kingdom's colour
3 Every tap ......... 2/2  tap-to-fly answers in the same frame (predicted flight, ripple, whoosh, paint pops), a tapping
                           hand + «Así se juega», «¡Quédate! Conquistando …», edge pointers, «¡Sin fuego!» rises by itself
4 Feedback .......... 2/2  paint splashes, capture bursts, right / wrong / too fast / time up / llamarada / wind, one
                           moment at a time (pill, throttled; the projector's card ≥ 4 s apart)
5 Finale ............ 2/2  captures and steals, «Viento a favor», lead alarms, «¡Recarga doble!» with fireworks and a
                           gold frame, the last 10 s big, «¡FINAL!», the ceremony + «Conquista maravillas», every card
6 Fair, no stall .... 2/2  the server flies and paints (a tap is an intent; no teleport; rate-limited), too fast =
                           wrong, comeback capped at the gap (sim: the stronger side wins 92 %), every wait timed out
7 Product feel ...... 2/2  Higgsfield worlds + islands + clouds + props, Kenney sounds and music, phone at 390 and 360
                           as finished as the projector at 1600×900
Total 14/14 → ships (≥ 12, no 0)
```

### What to watch in the first real class
- **Crowds on one island.** Three kids of a kingdom count; the rest burn fire there for nothing. If kids pile up, the
  capture chip says it; consider counting 4.
- **Fire.** 15 s at the start, +10 per right answer. If kids spend more time answering than flying, raise
  `ENERGY_PER_RIGHT` (the sim keeps the stronger side winning either way).
- **The pill and the projector card** are throttled (rival news ≥ 6 s, cards ≥ 4 s). If the class misses captures,
  lower `PC_LOST_HOLD_MS` / the throttles in `host-paint.js` / `player-paint.js`.
- **School Wi-Fi.** The phone predicts its own flight and paint and eases onto the server; a cloud the server refuses
  goes back after 1.2 s. If kids see clouds flicker back often, the Wi-Fi is slow (no code change).
- **Same names.** Two kids typing the same name share one slot (platform rule, outside this game).
