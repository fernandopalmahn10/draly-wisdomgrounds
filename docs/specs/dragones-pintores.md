# Dragones Pintores · new pin game (Gimkit «Color Clash», Dralingo style)

Status: **BUILT 2026-10-11, local, not deployed yet** (gameType `paint`). His brief: "design and improve this same game,
dralingo style … a new pin game" after watching Gimkit Color Clash (https://www.youtube.com/watch?v=SyAyV0LcRQQ).

## What we copy and what we beat
Color Clash: two teams run and jump around a 2D map; every platform you touch turns your team's colour; you spend
energy moving and refill it by answering questions; the team with more of the map wins.
Ours, Dralingo style:
- Every kid flies a baby Dralingo in the team colour (Fuego = red Dralingo, Mar = blue) over pastel cloud platforms.
- Fire («fuego») instead of energy: running/flying burns it; «🔥 ¡Recargar fuego!» asks for a question; right answer
  = +10 s, three in a row = «¡Llamarada!» (6 s of wide painting). Gems give an extra flap.
- Kid-obvious (his rule 2026-10-11): a 3-step picture card when the round starts, a full-width Recargar bar that pulses
  when fire is low, and a «¡Te quedaste sin fuego!» card with a giant button at 0. Same 3 steps on the projector lobby.
- Projector: the whole map live (every dragon with a name tag, painted tiles), Fuego/Mar rosters, territory tug bar,
  👑 on each team's top painter, team flags at the spawns, Dralingo announcer + DralingoFX (flyby on lead change,
  random effect at 25/50/75 % painted, rain of Dralingos on the winner screen). Teacher: +30 s, Terminar ronda.

## Rules
- Level: `core/paint.js` `buildLevel(seed)`, 60×36 tiles of 32 px, ground with 4 gaps, 8 platform tiers 4 rows apart,
  short walls and 3 pillars, spawn columns kept clear. Seeded, so server, projector and phones build the same map.
- A "surface" is a solid tile with air above it; only surfaces paint. Team score = surfaces owned per team; a kid's
  score = clouds they own at that moment (last painter of each tile), so the 👑 goes to whoever holds the sky.
- A cloud can't change colour again for 1.5 s (`PC_FLIP_COOLDOWN_MS`): standing still on a contested cloud farms nothing.
  The phone that painted too early gets the true colour back. Lead-change announcements: at most every 4 s.
- Server owns fire and tile ownership. Phones run the physics (client side) and send position at 8 Hz plus painted
  tile ids (≤16 per message); the server checks reach (3 tiles, 6 while blazing) and fire > 0.
- Fire burn: the phone reports the seconds it actually simulated (`spent`); the server charges that, never more than
  the real time since the last message (a laggy phone isn't charged for frames it never showed), and a dragon that
  clearly moved pays at least half the real time. Physics runs in ≤ 1/60 s sub-steps (no falling through clouds at
  low frame rates). Playing counts as activity, so the phone's 12 s resync never fires mid-flight; a resync of the same
  round keeps the dragon where it is (same level seed).
- Start fire 8 s, +10 s per right answer, max 30 s. Questions only on demand (no watchdog push).
- Broadcast: `pc:pos` and `pc:paint` batched at 5 Hz (200 ms tick) to the room.

## Files
`core/paint.js` · server.js (`pcStart`, `pcTick`, `pcAnswer`, `pcStop`, handlers `player:pc-pos|pc-paint|pc-ask`) ·
`public/host-paint.html` + `js/host-paint.js` · `js/player-paint.js` (phone; test hook `PaintPhone.advance(sec, keys)`)
· `js/paint-render.js` (shared tile drawing) · `player.html` `#screen-paint` · `css/kingdoms.css` (`pc-*`) ·
poses in `assets/kingdoms/dralingo/` (`fly`, `jump`, `*-red` made with `video_tools/recolor_dralingo.py`).

## Review + classroom playtest (2026-10-11), all fixed
Teleport every ~12 s (watchdog resync → spawn), blank canvas after rotating during a question, paint tick leaking after
the host left, last 200 ms of paint not counted for the winner, projector map not resent on reclaim, tunnelling at
20–30 fps, point farming by camping, /maestro launch losing ?livegame=1 through /packs, gems inside walls, question
timer refilled by resyncs, «Otra ronda» leaving question-less kids on the winner screen, «Tú pintaste: 0», sound button
over an answer tile, blue champion for Fuego, English join errors, winner screen taller than the projector.

## Tests
- `node scripts/test-paint.js` (level rules, ~2000 checks).
- `node scripts/playtest-bots.js --game paint --bots 20 --seconds 45 --handlers scripts/playtest/paint.js --set pack:yct1-familia-r1`
  (the handler marks the game on-demand: a freeze = asked for a question and none came).
- Headless browsers here deliver ~2 animation frames per second, so drive the phone with `PaintPhone.advance()` and
  `PaintPhone.jump()` from the console for screenshots.

## Next ideas (not built)
Power-ups from gems (paint bomb), a short "pintura" sound per tile on the projector, per-kid trails, Aileen/Adric/
Adrian/Profe Fer as selectable dragons' riders once he sends their art.
