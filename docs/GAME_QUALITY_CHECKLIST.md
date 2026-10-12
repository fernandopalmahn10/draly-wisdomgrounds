# Pin game scorecard · the Reinos de Colores bar

Every pin game, new or overhauled, is graded with this card **before it ships** (his decision 2026-10-12). The bar is
Reinos de Colores after its Dubai upgrade, the game he called "like a Nintendo Switch game… so premium. The landmarks,
the touches, the feedback, the excitement". Reinos itself scores 14/14 and is the reference to compare side by side.

**How to grade.** Play it like a class: local server, the bot playtest (`scripts/playtest-bots.js`), the
`classroom-playtester` agent, and screenshots of the projector (1600×900) and a phone (390×844) with the
`platform-screenshots` skill. Every point needs evidence you can show him (a screenshot, a test line, a file:line).
Score each area 0, 1 or 2. Write the card into the deploy report and into the game's spec in `docs/specs/`.

**Ships when:** every hard gate passes, no area scores 0, and the total is **12/14 or more**. Anything below is work
left, not a judgement call. Tell him the score honestly, with what is missing.

---

## Hard gates (pass / fail, any fail blocks the ship)
| Gate | How to check |
|---|---|
| Bot playtest PASS (20 kids: all joined, no frozen kids, no errors, end event seen) | `node scripts/playtest-bots.js --game <type> --bots 20` |
| Teacher never stuck: pause, +30 s, end now, mute on the projector; every "wait for the kid" step has a timeout | click each on the projector screenshot run |
| Only our saga (no brand characters, no logos, no text or QR in pictures) | look at every screen; `node scripts/test-wording.js` |
| Spanish UI, pinyin without tones for curriculum words, no hanzi on the phone, only words of the chosen level | read the phone screens; questions come from `/packs.html` |
| Kid-safe pictures (nobody touching or hugging) | look at every picture and animation |

## 1 · A real place, not a board (landmarks)
- **2** The game happens somewhere kids recognise (Dubai, a Chinese market, a temple…) with real landmarks or prizes
  that are worth points, can be won and lost, and are placed fairly for both sides.
- **1** A themed backdrop, but the prizes are decoration (no points, nothing to fight over).
- **0** A plain grid / plain cards.
Reinos: Dubai skyline; Burj Khalifa +5, Burj Al Arab, Museo del Futuro, Marco de Dubái, Atlantis +3, stealable, on
the centre line at the same distance from both castles.

## 2 · The gang are the stars (the episode feeling)
- **2** The cast has a role in every round (captains, rivals, hosts) with a VS or intro moment, speaks with their own
  personality (`js/cast.js` lines, Aileen in voseo), and each kid's character wears the team colour on phone and
  projector.
- **1** Dralingo or the cast appear, but only as decoration.
- **0** No characters, or characters that are not ours.
Reinos: two random captains per round, red | blue VS screen in the countdown, cameo lines on a lead change, red
Dralingo for Fuego kids, blue for Mar.

## 3 · Every tap answers back (the touches)
- **2** On the phone: the valid targets are big and obvious (zoom to them, pulsing ring), a tapping hand teaches the
  first moves, a «Así se juega» card shows 3 pictured steps before the game, every tap gives a press + sound, and a
  blocked kid gets a full-width prompt saying exactly what to tap.
- **1** Taps work and give a sound, but kids would still need someone to explain.
- **0** Small targets, silent taps, or a kid can get stuck not knowing what to do.
Reinos: phone zooms onto the glowing tiles, tapping hand on the first two plants, landmark pieces are the buttons,
«Así se juega» lobby card, «¡YA!» start.

## 4 · Feedback with restraint
- **2** Every right / wrong / streak / capture has its own reaction (Dralingo pose, sound, banner), and the big
  full-screen moments are rare: one at a time, at least ~7 s apart, never stacked, throttled when 30 kids trigger them.
- **1** Feedback exists but is flat (same reaction for everything), OR big effects fire so often they become noise.
- **0** Kids can't tell whether they were right, or the screen is chaos.
Reinos: landmark capture flies to the front with «+5» and who took it; «¡Rodeado!», «¡Asedio!»; DralingoFX one at a
time ≥ 7 s apart; landmark moment in ~18 % of a round with 30 kids (was 55–74 %).

## 5 · Excitement rises to a finale
- **2** Tension builds (steal-backs, comebacks, alerts like «¡casi rodeado!», a lead-change cheer, a final-30-s
  spotlight and countdown) and the end is a show: winner in their colour, MVP per team, top list, the gang celebrates,
  and every kid sees their own points on the phone.
- **1** A timer and a winner card, but the middle is flat or the end is just a table.
- **0** It simply stops.
Reinos: stealable landmarks, castle alerts, 30-s spotlight, champion Dralingo in the winner's colour + winning captain,
landmarks won, MVP per kingdom, top 6, gang finale, kid's own points.

## 6 · Fair, and never stalls the class
- **2** Effort always pays most (an automatic move after a timeout keeps the class going but never earns more than a
  kid who tapped), late joiners get in, no kid can block others, and the teacher's controls work mid-round.
- **1** Nothing stalls, but waiting or spamming can beat playing well.
- **0** One slow kid or one stuck phone can hold the class.
Reinos: auto-plant after 8 s gives the kingdom the tile but the kid no landmark bonus; second start click can't wipe a
round; «+30 s» doesn't leak into the next round.

## 7 · It feels like a product, not a quiz
- **2** Our own art (Higgsfield, the saga), recorded music and sound effects (no synthesized beeps), and the phone is as
  polished as the projector (his rule: "the kid's phone is the product"); looks right at 390 px and at 1600×900.
- **1** Polished projector, plain phone (or the reverse).
- **0** Placeholder art, beeps, broken layout on a phone.
Reinos: Higgsfield landmarks and cast, Kenney music + steel-drum landmark jingle, phone Kahoot-style skin with team
colours.

---

## The card (copy into the deploy report and the spec)
```
Scorecard · <game> · <date> · <commit>
Hard gates: bots PASS · teacher controls ✓ · saga only ✓ · Spanish/pinyin/level ✓ · kid-safe ✓
1 Real place ........ x/2  evidence:
2 The gang .......... x/2  evidence:
3 Every tap ......... x/2  evidence:
4 Feedback .......... x/2  evidence:
5 Finale ............ x/2  evidence:
6 Fair, no stall .... x/2  evidence:
7 Product feel ...... x/2  evidence:
Total x/14 → ships (≥ 12, no 0) / work left: …
```
