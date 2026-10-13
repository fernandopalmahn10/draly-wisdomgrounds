# Student portal remake (`/homework`) · design plan

Status: **BUILT 2026-10-13** on branch `worktree-agent-a1a378b811a9cc51b` (not deployed). His ask: "make the student portal
look and feel premium, like a Nintendo game, without losing a single feature", with frontend-design, Emil Kowalski,
taste and impeccable. Files: `public/css/portal.css` (new, loaded last, every rule under `body.hw-portal`: drop the class
to switch the layer off; a full rollback = revert the commit, the home markup changed), `public/js/portal.js` (new: the moments + the alive layer + the pose map), small hooks in
`public/js/homework.js`, list markup in `public/homework.html`, new strings in `public/js/hw-i18n.js`.

## Design read
Redesign that **keeps the brand world and overhauls the composition** of a phone-first kid + parent portal (an Operate
surface with Experience moments), in the platform's pastel paper-sticker language, pushed to the Reinos de Colores
"Nintendo party game" finish. Native CSS + a small vanilla JS moment layer (no libraries).
Dials: variance 5 (kids need predictable places), motion 6 (moments, never everywhere), density 4.

What the old portal got wrong (critique 2026-10-13, phone 390×844): the home was a header card with seven equal
buttons (no hierarchy, Desafíos the only cue), the pinned code + level stack sat over the card corner, the
language pill covered card content, nothing was alive after the login, finishing a tarea was a plain card (🏆 or 💪
emoji, no kid, no gang), level-ups and streaks only spoke inside Desafíos, the parents' view shouted in the same
sticker voice as the kid screens.

## Tokens (portal.css `:root`-level on `body.hw-portal`)
| Token | Value | Use |
|---|---|---|
| `--pt-ink` | #1d2440 | outlines, text |
| `--pt-ink-soft` | #4f5a7c | secondary text (6.4:1 on paper) |
| `--pt-paper` | #fff7e3 | cards |
| `--pt-white` | #ffffff | inner surfaces, inputs |
| `--pt-sky` / `--pt-sky-2` | #9fdcf7 / #c6ecfb | page sky, hero sky |
| `--pt-gold` / `--pt-gold-deep` | #ffc93c / #f0a800 | the one primary action per screen, stars |
| `--pt-mint` | #c8f2dc | secondary actions, done states |
| `--pt-jade` | #26a65b | right answers, passed |
| `--pt-coral` | #f0443a | unread badge, wrong answers (never for a low score headline) |
| `--pt-blue` | #2f7bea | focus ring, links |
| `--pt-stage` | #1d2440 → #33427f | the game-show stage behind moments (night sky + gold rays) |
| world tints | #ffe7cf #ece6ff #d9f6e6 #dff2fd #fff0b8 #ffe0ea #e6f0ff #fde2c8 | one per folder/world, in order |

**Type.** Baloo 2 800 for display (titles, numbers, buttons), Nunito 700-900 for body, pinyin always Nunito 900 (Baloo's
macrons sit off the letter). Phone scale: .85 / 1 / 1.125 / 1.35 / 1.75 / 2.25 / 3.25 rem; the score is 4.5 rem.
Big moment words get the Reinos treatment: paper fill, 3-4 px ink stroke (`paint-order: stroke fill`), hard
text-shadow. Tracking 0 (Baloo is already wide), headings `text-wrap: balance`.

**Spacing.** 4 px base: 4 8 12 16 20 24 32 40. Phone gutter 16 px, laptop 24 px, section gap 20 px.

**Radii (one rule).** cards 22 px · tiles 20 px · buttons 16 px · chips and pills 999 px · avatar frames 18 px ·
modal cards 28 px.

**Elevation (the sticker world chose hard shadows).** chip `0 3px 0 ink` · button/tile `0 5px 0 ink` · card
`0 7px 0 ink` · modal `0 8px 0 ink`. Pressed = `translateY(4px)` + `0 1px 0 ink`. Primary buttons get the toy-plastic
gloss: `inset 0 3px 0 rgba(255,255,255,.55), inset 0 -5px 0 rgba(0,0,0,.08)`. The parents' view steps down to a calm
elevation: 2 px outlines at ink, `0 3px 0 rgba(29,36,64,.14)`, more white.

**Motion (emil-design-eng).** `--pt-out: cubic-bezier(.23,1,.32,1)` for everything that enters,
`--pt-spring: cubic-bezier(.3,1.5,.5,1)` only for pops (stars, stamps, avatars), never `ease-in`. Press 100 ms,
release 160 ms, sheets 240 ms, moments ≤ 2.4 s to their final state, exit faster than enter. Only `transform` and
`opacity` animate (plus one `clip-path` wipe on the welcome split). Hover effects only under
`(hover: hover) and (pointer: fine)`. `prefers-reduced-motion`: no movement at all, moments appear in their final
state with a 150 ms fade, no confetti, the alive layer stays on its first still frame.

## Layout per screen (phone first, 390 px; laptop centres the same column, max 980 px)
- **Entry.** Kept (Dralingo on the card, Dubai skyline, peeker, fly-by). Title gets the outline treatment, the access
  code reads like a ticket, «Entrar» is the glossy gold button, the hint becomes quiet text under it.
- **Avatar picker = character select.** Same copy («¡Hola, Sofia!» · «Elige tu avatar…»), 3 columns of portrait tiles on
  a sky gradient; the picked one jumps and goes gold (≥ 450 ms on screen) before the home and the welcome open.
- **Home (list).** Top to bottom:
  1. *Hero stage* (Dubai skyline strip, sky): the kid's avatar (tap = Ajustes), «Hola Sofia», the level HUD inside it
     (HSK levels), Dralingo in his platform look + one of the gang with a speech bubble on the right. The pinned
     🔑 code + level stack sits over the hero's empty sky corner, so it reads as part of it, and scrolls away with the
     page on the home, Ajustes and Papás (the code is part of those screens) instead of floating over the world cards;
     everywhere else it stays pinned (his 2026-09-15 rule).
  2. *▶ Siguiente*: the only gold action of the home, the next tarea in one tap.
  3. *Dock*: one row of square tiles, icon over a short name: ⚔️ Desafíos (white, gold disc, HSK only) · 🔔 Mensajes (badge) ·
     📜 Mis oraciones · 📝 Mis exámenes.
  4. *Utility pills*: 👨‍👩‍👧 Papás · ⚙️ Ajustes · 📲 Instalar app · Salir (small, quiet, white, one line).
  5. Tabs (Pendientes / Completadas / Tu Maestro/a) as a segmented control, then the world cards: each world its own
     tint, the emoji in a white sticker, «2 por hacer» and, once a round is done, a progress bar `done/total`.
  Inside a folder the hero, dock and pills step away: the sticky folder bar (← Volver + world + progress) is the top
  bar, the code stack sits in its right end, and the rounds read like a level select (number badge, status, ▶).
- **Quiz player.** The 20 dots become one segmented progress bar under the header (green/red/now), big A-D tiles kept,
  a «¡Combo x3!» chip at the top edge on 3 / 5 / 8 / 10 right in a row (never over the tiles); ← mid-round asks
  before it throws the answers away.
- **Results.** One reveal for every way a tarea ends (game round, trainer, sentence tarea, reading test): see moments.
- **Desafíos, Ajustes, reading, sentence tarea, Mis oraciones, Mis exámenes, inbox.** Same structure, the new tokens:
  sheets slide up from the bottom on phones, one gold action per screen, white inner surfaces, headers clear the
  code stack. The sentence tarea's top «Entregar» stays (tablets hid the bottom one) but white and not sticky on
  phones; the bottom one is the big gold action. The 🌐 language pill steps away during a round, a reveal, the welcome
  and the sheets (a mis-tap switched the portal to English mid-quiz); every screen ends above it.
- **Parents' view.** Calm report: white card, 2 px outlines, soft shadows, the child's avatar + name + level + code in a
  header row, the four counts as a 2×2 grid of number tiles (same data, same taps), the language path bar, sections
  with plain headings and generous space. No bouncing anything.

## The alive layer (his rule: alive, randomized, not overdone)
On the home: two moving things at most, both inside the hero, never over a tap target. Dralingo (platform look) breathes
(3.6 s bob); one of the gang or a saga animal peeks next to him with a line from the cast bible and changes every
12 s (a different one each time, never twice in a row). Stills only (≈30 KB each), so a phone that opens it in class
costs nothing. Stops when the screen is hidden or the tab is in the background; reduced motion = one still pick.

## Game-show moments (his rule 2026-10-13: game-show moments on every phone)
1. **Welcome** (once per visit per kid, ≤ 2.2 s, tap to skip): a gold | sky split wipes in, the kid's avatar slides in
   from the left and Dralingo from the right, «¡Hola, Sofia!» stamps in the middle with the level chip under it.
2. **Results reveal** (every tarea, ≤ 2.4 s to the final state, every button works from the first frame): night stage
   with paper rays that turn once, the kid's avatar on the left and a gang member on the right, the score counts up (900 ms,
   ease-out), up to three stars pop one by one (≥ 50 / ≥ 80 / ≥ 95 %), then the headline: «¡PERFECTO!» (≥ 95),
   «¡EXCELENTE!» (≥ 80, passed), «¡Casi! Inténtalo otra vez» (50-79), «¡Tú puedes! Inténtalo otra vez» (< 50) with
   «Necesitas 80 para pasar». Passed: the gang member cheers + confetti. Not passed: the kind pose and a kind line from
   the cast («No pasa nada. ¡Yalla, otra vez!»; under 50 never a «Casi» line), no confetti, never red, never mocking;
   the headline lands first (0.9 s). Buttons: ▶ Siguiente (passed, when there is a next one) or 🔁 Otra vez (not
   passed) as the gold action + «📚 Mis tareas»; a sentence tarea or reading test gets «📋 Ver mis respuestas» (the
   answers screen is under it). The friend who reacts is never the kid's own avatar.
3. **Level up / streak** in the HUD: when the home shows a higher level or a longer streak than this phone saw last,
   the HUD bumps and a banner drops from the top (≤ 2.2 s): «¡Subiste a Nivel 3!» with Dralingo, «¡Racha de 4 días! 🔥»
   with the gang. First visit only remembers (no fake celebration). Queued after the welcome, one at a time.
4. **Combo** in the quiz player (above).

## Pose hooks (new gang poses land in `assets-library/local-ai/2026-10-13/`)
One map in `public/js/portal.js` → `POSES[character][pose]`. Poses: `ready`, `victory`, `kindSad`, `pointing`.
Today they point at the existing art; to swap in the new art copy the WebP files to `public/assets/cast/<id>-<pose>.webp`
(and `public/assets/dralingo/<pose>.webp`) and change only these entries.
| Pose | Shows where | Today's art |
|---|---|---|
| `ready` | home hero (Dralingo + the peeker), welcome (Dralingo) | `dralingo/hello.webp`, `cast/<id>-hello.webp` |
| `victory` | reveal when passed, level-up banner, streak banner | `dralingo/power.webp`, `cast/<id>-cheer.webp` |
| `kindSad` | reveal when not passed | `dralingo/wise.webp`, `cast/<id>-mystery.webp` |
| `pointing` | empty states («¡Sin pendientes!»), first-time tips | `kingdoms/dralingo/pointing.webp`, `cast/<id>-hello.webp` |

## Critique scores
- impeccable critique before: 21/40 (dual-agent, 2026-10-13), detector 31 findings.
- impeccable critique after the build: 27/40, detector 26 (low-contrast 6 → 0); its P1/P2 then fixed: the 🌐 pill and
  the code stack no longer cover work, one gold action per screen, reveal buttons that never mean the same thing,
  lines that fit the score, rays that stop, reduced motion for the combo chip and the sheets.
- Still open (content work, not this visual remake): YCT 1 quiz is text-only (no audio on the options), trainer
  jargon («Tier», «EXP6», «Experience 1») comes from the server's labels, the parents' «fluidez HSK1+» note shows for
  YCT kids, no pictured 3-step first-play card on the sentence tarea.

## Review against the brief (what was revised)
- First draft put Papás / Ajustes / Salir in a footer under the world cards: parents would have had to scroll past
  every world to find their view. Revised: a quiet pill row right under the dock, still above the fold.
- First draft had a staggered fade-up of the world cards on every render: generic, and the list re-renders on every
  tab switch. Dropped; the only entrance is the welcome moment.
- First draft reveal played a recorded sting: no mute on the portal and kids do homework next to sleeping siblings.
  Dropped (silent moments; the games keep their sounds).
- Icons stay emoji: they are the kid vernacular of the whole platform and the ES→EN dictionary keys on them; no icon
  library is added (no new external libraries).
- Platform look wins over the design skills: hard offset shadows, cream paper, Baloo 2, Dralingo in his kandura,
  Spanish UI, 48 px+ tap targets.
