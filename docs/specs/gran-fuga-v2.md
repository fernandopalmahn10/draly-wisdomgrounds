# La Gran Fuga de Dubái v2 · «Las rutas de la fuga» (gameType `escape`)

Address `/host-escape.html?setId=…`, gameType `escape`, the teacher flow (/maestro launcher, `/packs.html?game=escape`,
`?livegame=1`) unchanged. Remade 2026-10-17 on a branch, not deployed. v1 and its «As built» notes:
`docs/specs/gran-fuga-de-dubai.md`. Model: Dragones Pintores v2 (`docs/specs/dragones-pintores-v2.md`).

## Why
Fernando picked it next after Pintores v2 (kids loved real worlds). The scorecard was 13/14: Robotín's world (a sky
gradient, a hazy skyline, a plain floor) and the zona segura rooms (a checkerboard tile grid) were drawn with shapes.
On a phone the run was a thin progress bar and the room used half the screen.

## His picks and the rules that frame it
- **Dubai is the main stage, China's wonders round it out** (root CLAUDE.md «Not everything is Dubai»): real-looking
  places, unbranded, kid-safe (no text, logos or QR in the art, nobody touching).
- **Keep what the game is:** a co-op crew escaping zone by zone from Robotín, the «zona segura», answering to power the
  escape, Hamdan's jet at the end, co-op stars, the crew never ranked. Keep the teacher flow, the address, the gameType.
- **Everything else may change** if it makes it better: rooms as real art scenes, Robotín's world, bigger readable
  characters, phone clarity, the escape's drama.

## The routes (one per round; «Otra ronda» = the next route; the teacher can pick another in the lobby)
| # | Route | Zone 1 | Zone 2 | Zone 3 (the jet waits at the end) |
|---|---|---|---|---|
| 1 | **Ruta de Dubái** (first: the main stage) | Museo del Futuro | La Fuente del Burj Khalifa | La pista del aeropuerto |
| 2 | **Ruta de China** («¡Robotín los persigue por el portal del Museo!») | El Mercado Nocturno | El Jardín Chino | La Gran Muralla |

Each zone has its own art (Higgsfield Unlimited, glossy 3D, in his Chrome): a far background, a ground strip the crew
runs on (parallax, mirror-tiled), and a top-down room for its zona segura; between zones the crew runs through a gate
of the next place (a glowing museum door, a golden arch, a red Chinese gate, a moon gate); at the end of each route
Hamdan's jet (unbranded) waits with its stairs down. Ranks keep their ids, named for the route (Dubái: Pilotos del
Cielo · Viajeros del Burj · Exploradores del Zoco; China: Pilotos del Cielo · Viajeros de la Muralla · Exploradores
del Mercado).

## What changes
- **Robotín's world (the run):** the zone's far background + its ground strip scrolling under the crew (parallax),
  the gate or the jet coming into view in the last metres, bigger runners and Robotín, Dralingo at the front.
- **The zona segura rooms:** square rooms (16×16 tiles: the whole room fits a portrait phone too) drawn as the zone's
  painted top-down scene; the walls and the big objects in the picture are the room's walls (authored per room), plus
  a few seeded props of the place for variety; the green zones glow on top. Name tags never overlap on the projector.
- **The phone during the run:** the thin rail becomes a live chase strip on top of every question and result: the
  zone's art, my character big with «TÚ», crewmates around me, Robotín behind at his real distance, the gate / jet
  arriving. A right answer = my character dashes ahead in the strip (and the crew surges); a zap = lightning on me.
- **The escape's drama:** the crew runs to the jet, boards it, the jet takes off while Robotín arrives too late (the
  projector stages it on the route's last scene; every phone shows its own boarding).
- **Pacing (known issue: 4-minute rounds ended one wave short of the jet):** each run's pace is set from the time left
  on the clock (the remaining runs share what the remaining zonas seguras don't need), and the zona segura is a little
  shorter (waves 10 / 9.5 / 9 s, 2.5 s rest). A class that keeps answering reaches the jet at 4, 5 and 6 minutes;
  default stays 5 min.
- **The F5 of the projector keeps the room** (sessionStorage + `host:reclaim` with its token, like Pintores).
- **The playtest's notes:** «Más rápido» no longer goes to a kid who stood next to a zone when it lit up (they must
  start more than a tile away); name tags no longer overlap in the projector's room.

## What stays
The rules engine (`core/escape.js`: turbos, súper turbos, Robotín's rubber band and glitch sprints, the tickle-zap,
hearts, the free distracted kid in ten, the replay of a caught zone, «Saltar zona», súper turbos in the last 30 s), the
shared Mario Party ending (`core/party.js`, `js/party.js`) with Fuga's four co-op stars, the phone bands and cards, the
teacher controls (⏸ Pausa, +30 s, ⏭ Saltar zona, Terminar ronda, ⏭ Saltar, Sonido, Otra ronda), the sounds and music.

## Scorecard target
14/14: product feel 2/2 = real art for the run and the rooms, Robotín's pictures, the phone strip as finished as the
projector at 390 and 360 px.

## As built · 2026-10-17 (branch `escape-v2`, not deployed)

What changed from the plan above, after four reviews (below):
- **Stars count how far the crew got**, not hearts alone: escaped with 3+ hearts = 3 stars («Pilotos del Cielo»),
  escaped = 2, two places cleared = 2 («Viajeros del Burj / de la Muralla»), otherwise 1. A crew that escapes always
  beats one that doesn't.
- **The zona segura forgives a few stragglers:** one kid in five may stay out for free; the crew loses 2 ❤️ only when
  more than 40 % are out.
- **Close calls for a crew far ahead:** Robotín's glitch sprint lunges at a crew more than 3 m past the alarm line and
  stops («trips») as soon as he reaches it: a lively class hears «¡Robotín se acerca!» in every run, without zaps.
- **The projector's run:** the crew in two staggered rows, at most 12 runners shown (a kid on a turbo always shows,
  «+N más» for the rest), every name chip with its own kid (front row under the feet, back row over the head), the kid
  on a turbo jumps ahead cheering with a gold ring; full-body characters everywhere in the play area.
- **The escape:** the crew walks up the stairs, their faces show at the jet's windows, the jet rolls left and climbs over
  Robotín (dizzy); no turbo chips or guide bubbles over it (the ribbon is the only text); the meter leaves Robotín
  behind.
- **The zona segura on the projector:** the wave's result in the left card («✓ 8 a salvo · ⚡ 2 fuera · −1 ❤️»), the
  place in the right card, the room clear.
- **The phone:** the strip's numbers sit in a row under its picture (❤️ · «🤖 Robotín a 21 m» · «El Museo · 1/3»),
  never over Robotín or me; the moments («¡Robotín se acerca!», «¡Zap!», «Pausa») show inside the strip, so the question
  and the tiles stay clear; in a zona segura they sit at the bottom beside the joystick (the room stays clear); the
  room's camera fits the floor to the phone's width; my dash never leaves the strip; my full-body character on the
  result and on the escape card (walking to the jet's door); the cleared card is a postcard of the next place.
- **The ceremony** shows the place the crew reached (the whole picture, softly, on a phone) and the route's postcards.

### Files
- Rewritten: `public/js/escape-map.js` (routes, zones, 16×16 rooms with walls authored per picture, UMD: server, phones,
  bots), `public/js/escape-render.js` (the shared canvas renderer: scene, gate / jet, Robotín, full-body kids, rooms,
  name chips that never overlap), `public/host-escape.html` + `public/js/host-escape.js` (the projector: route card,
  F5 reclaim, run / room / escape), `public/js/player-escape.js` (the phone: chase strip, room, cards, lobby),
  `public/css/escape.css`.
- Changed: `core/escape.js` (pacing from the clock: `zoneSeconds`, `retimeRun`; shorter waves; lunge sprints; reach
  time minus the walk; stragglers; stars by progress; the route), `server.js` (the escape block only: `esRoute`,
  `host:es-route` in the lobby only, «Otra ronda» = the next route, a retime at every run), `public/js/party.js` +
  `public/css/party.css` (the route's postcards in «¿Hasta dónde llegó la tripulación?», the jet faces its way, the
  place behind the ceremony), `?v=` bumps on the pages that load them, `games.html`, `maestro.js`, docs.
- Tests: `scripts/test-escape.js` (rewritten), new `scripts/test-escape-live.js`, `scripts/test-party.js`,
  `scripts/playtest/escape.js` (route-aware rooms).

### The art (Higgsfield Unlimited in his Chrome, 0 credits, no reference uploads; he was not using Higgsfield)
35 WebP, 1.6 MB, in `public/assets/escape/`: per place a far background (`bg`), a lobby / postcard thumbnail (`bg-s`),
the ground strip the crew runs on (`ground`) and its zona segura room seen from above (`room`); four gates (museum
door, golden arch, red Chinese gate, moon gate), Hamdan's jet (unbranded, faces left, door at 20 %), the room props.
Per place: Museo 130 KB, Fuente 249, Pista 131, Mercado 292, Jardín 456, Muralla 157 (its far background reused from
Pintores v2); gates + jet + props 181 KB. Originals + log: `assets-library/higgsfield/2026-10-17/escape2/`. A place
loads only when the crew gets there (the next one preloads during the zona segura).

### Tests
| Test | Result |
|---|---|
| `node scripts/test-escape.js` (both routes complete; 300 seeds × 2 routes × 3 rooms: walls, dock, zones reachable, nothing on a wall; the pace and its clamps; whole episodes on the clock at 4 / 5 / 6 minutes with 5-30 kids; reach time minus the walk; close calls; stragglers; stars by progress) | ~652,000 checks pass · an average class reaches the jet 6/6 at 4, 5 and 6 min (16-34 s spare at 4-5 min) · a lively class hears «¡Robotín se acerca!» in 18/18 runs, 0 zaps · zone 3: an average class 4-8 zaps in 24 runs, a strong one 0 |
| `node scripts/test-escape-live.js` (real sockets: the route pick (lobby only), the same rooms on every screen, a run, turbos, a zona segura wave, Pausa, +30 s, Seguir, «Saltar zona», the projector's F5 reclaim, a late joiner, Terminar → the ceremony with the route and its rank, «Otra ronda» = the next route) | 51 checks pass |
| `playtest-bots.js --game escape --seconds 60` | 4 bots PASS (40 questions) · 20 PASS (170) · 30 PASS (231) · 0 frozen · 0 errors · 30 bots × 5 min escaped («Pilotos del Cielo») |
| Every live test (`run-live-tests.js` on a throw-away server: dragon, escape, halcon, mochi, monopoly, paint, party, pinata, sixseven) | 9/9 pass |
| Every suite (`run-all-tests.sh`: the 24 `scripts/test-*.js`, incl. audios-base with `STUDY_DIR`) + `asset-guard.js` | 0 failing |

### Reviews and what changed
- **Code review** (agent-skills:code-reviewer, no critical): fixed the strip reading the layout every frame (size
  cached on mount / resize), a reconnect that lost its card, the strip running on after the end, a phone waking from
  sleep, 4 fps while paused, the next place preloaded (and the room at 60 m), postcard thumbnails, `host:es-route`
  accepted mid-round (lobby only now), «Más rápido» given to a kid who stood next to a zone (reaction time: the walk is
  subtracted, a kid already inside is skipped), the hearts' order, a stale wave, a leaked timer, dead v1 code.
- **Classroom playtest** (real browsers: projector + phones at 390 and 360 + socket kids; bots 20/30 × 5 min PASS):
  fixed stars that rewarded a crew that never escaped, stragglers costing hearts for one slow kid, «TÚ» hidden under the
  strip's numbers, kids spawning under Robotín, the 640 px phone, a late joiner during a pause, a paused room showing
  two cards, the projector's F5 losing the wave title, the ceremony's subtitle on a dark picture, a small turbo.
  Reported, not changed: a second kid typing the same name takes the first kid's phone over (platform-wide); the
  súper-turbos band can come just before a zona segura; after F5 the music waits for a click (browser autoplay).
- **Fresh-eyes design review** (stills, «fix»): the projector's crew in two rows with names on their own kids, +N, full
  bodies, the turbo kid cheering; the escape clean with faces at the windows; the wave's result in the left card; the
  phone's numbers row, moments inside the strip / beside the joystick, the floor-wide camera, full-body me on the result
  and the escape card, the cleared card's title clear of the postcard, the ceremony's backdrop, a shorter lobby, the
  intro line, bigger level chips. Also fixed while re-shooting: Robotín's picture on the «nos alcanzó» card filled the
  room (a canvas rule of the room).
- **impeccable detector** (once, on the game files): fixed empty <img> sources. Kept: outlined titles (the shared
  Reinos look), the red inner glow while Robotín is close (the alarm), cards in cards (the platform's card look), bounce
  easing (a kids' party game, as in the other remakes).

### Scorecard · La Gran Fuga v2 · 2026-10-17 · branch `escape-v2`
```
Hard gates: bots PASS (4/20/30, and 30 × 5 min) · teacher controls ✓ (⏸ Pausa, +30 s, ⏭ Saltar zona, Terminar, Sonido,
            Otra ronda = next route, route pick in the lobby, F5 reclaim) · saga only ✓ · Spanish/pinyin/level ✓
            (questions from the packs; no hanzi on the phone) · kid-safe ✓ (no text/logos in the art, nobody touching)
1 Real place ........ 2/2  two routes of real places (Museo del Futuro, la Fuente del Burj Khalifa, la pista; el Mercado
                           Nocturno, el Jardín Chino, la Gran Muralla), a gate to the next place, Hamdan's jet at the end
2 The gang .......... 2/2  Fer's episode intro, Dralingo leads the run, a cast cheer at every place cleared, Hamdan waves
                           the crew aboard, every kid's full-body saga character on both screens
3 Every tap ......... 2/2  a right answer = my character dashes ahead in the strip + the crew surges; «Así se juega» with
                           the route; the joystick hand; the room's arrow to the nearest green zone; big tiles
4 Feedback .......... 2/2  turbo / súper turbo / zap / a salvo / fuera each with its own reaction; moments one at a time,
                           inside the strip on a phone; the projector's turbo chips throttled to a few at once
5 Finale ............ 2/2  «¡Robotín se acerca!» alarms, súper turbos in the last 30 s, the boarding + take-off, «¡FINAL!»,
                           the route's postcards «¿Hasta dónde llegó?», co-op stars, every kid's card
6 Fair, no stall .... 2/2  co-op (never ranked), the pace set from the clock so the jet is reachable at 4-6 min, free
                           stragglers, a caught place replays, every wait timed out, Saltar zona
7 Product feel ...... 2/2  Higgsfield places, rooms, gates, jet + Robotín's pictures; recorded music and sounds; the phone
                           strip at 390 and 360 as finished as the projector at 1600×900
Total 14/14 → ships (≥ 12, no 0)
```

### What to watch in the first real class
- **The first zona segura.** Kids must walk to a green zone with the joystick; watch whether the youngest find it in
  the 10 s of the first wave (the arrow points the way; one kid in five is free).
- **Robotín's alarms.** A class far ahead now gets lunges; if «¡Robotín se acerca!» comes too often for a strong class,
  raise `LUNGE_FAR` in `core/escape.js`.
- **4-minute rounds.** The pace is set from the clock; a slow class (far under 0.09 right answers per kid per second)
  still won't reach the jet: a 5- or 6-minute round (the lobby's time slider) gives it room.
- **China route art on a slow school network:** the Jardín is the heaviest place (456 KB), loaded during the Mercado's
  zona segura.
