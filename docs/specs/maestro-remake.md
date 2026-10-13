# /maestro remake: the teacher's control room

Status: built on branch `worktree-agent-a2befd10f38dbd3d3` (2026-10-13), not deployed.
Files: `public/maestro.html`, `public/css/teacher-dashboard.css` (new, the only stylesheet of /maestro),
`public/js/maestro.js` (markup clean-ups + small UI helpers; every API call unchanged).
`public/css/maestro.css` stays for `host-hsk.html`, which still loads it.

## 1. Brief

Remake Teacher Mode so it looks premium and makes a teacher in a live class faster, without losing a single feature.
Rules that bind it: nothing may leave a teacher stuck mid-class; fast to the core activity; big tap targets; a skip
escape hatch; English UI (teachers include non-Spanish speakers); the platform look (Reinos de Colores + home page:
pastel sticker world, Dralingo in his platform look, the gang, Dubai); calm and premium, a polished control room, not a
toy. Works on the projector laptop (1280 / 1600 wide) and on a teacher's phone (390).

Design read: an Operate surface (a tool in use during a lesson) inside an established visual world. The world lends
palette, type, density and one signature move; the layout and controls stay standard (buttons, tabs, inputs, lists).

Physical scene: a teacher standing at the front of a bright classroom, laptop mirrored to a projector that washes out
dark colours, 10 to 30 kids waiting; or a phone held in one hand between desks. That scene forces a light paper surface
with navy ink text (high contrast on a projector) and big targets.

## 2. Audit of the old dashboard (before screenshots `shots/maestro-before-*`)

- 17 equal-weight buttons in the header (gold, jade, red gradients with glow) before any content; no hierarchy, so
  "Launch game" (the core action) looks like "Backup". At 390 px they fill the whole first screen.
- Dark navy theme with Cinzel small caps: unrelated to the pastel sticker world of the home page and the games.
- Who is online lives in a pill in the subtitle and a dot on each roster row; nothing answers "who is here?" at a glance.
- Roster row grid breaks: the "last seen" cell wraps under the avatar; stats chips crowd the right side.
- "Message the whole class" is a chain of five `prompt()`/`confirm()` dialogs; about 66 `alert()` calls block the screen.
- Auto-login passes no teacher identity, so the Teachers tab and My Gateway appear only after the first 15 s refresh
  (layout shift, and the super admin thinks they are missing).
- Modals: no Esc, no focus handling, close button scrolls away in long modals, primary buttons sit below long lists.
- `.btn-sm` / `.btn-xl` were never loaded on this page (they live in dralingo.css), so every "small" button is 56 px tall.
- No loading, empty or error states for the roster (a network error leaves "Loading…" forever).
- The impeccable critique (dual-agent, section 8) scored it before the remake.

## 3. Information architecture

What a teacher needs in the first 5 seconds of a class, in order:

1. Start something: launch a game, Live Teacher Mode (Modo Maestro en vivo), open an Official Test room.
2. See who is online right now.
3. Send something to the class: a message, a GIF, or the rescue "Send home".

Layout (desktop, 1280 and 1600):

```
+--------------------------------------------------------------------------------+
| [icon] Teacher Mode            Students | Teachers      Fer · Super admin  ⟳  ⎋ |  top bar, sticky
+--------------------------------------------------------------------------------+
| Start the class                                    | Online now        4      |
| [ 🚀 Launch a game  (gold, the one big button) ]   | (kid avatars standing   |
| [ ✏️ Live Teacher Mode ] [ 🏆 Official tests ]       |  on the skyline line)   |
| 📖 Reading in class   🧠 Sentence practice          | [📢 Message] [🎬 GIF]   |
|  ~~~~~~~~~~~~~~ Dubai skyline strip ~~~~~~~~~~~~~~  | [🏠 Send home]          |
+--------------------------------------------------------------------------------+
| Students  9 with activity · 📦 2 archived          | Class work              |
| [search........] [All][Online][YCT 1][New HSK 1].. | 🏅 Test results          |
| 0/9 assignments · 0/9 reading tests · 9/9 sentences| 🎯 Special assignment    |
| Online now ------------------------------------    | 🎓 Classrooms            |
|  (o) Diego Herrera  GRQL   YCT 1  YCT Tuesday ...  | Admin                   |
| Earlier ---------------------------------------    | 📘 Guides (PDF)          |
|  (o) Sofía Ramírez  NRJX   Old HSK 1  ...          | 💾 Backup                |
+--------------------------------------------------------------------------------+
```

Phone (390): the same order in one column: top bar, Start (Launch full width, then two half-width tiles, then two
links), Online now with the three send buttons, Students, Tools.

Every action stays reachable in at most 2 clicks:

| Action | Path |
|---|---|
| Launch a game (any of the 11, incl. Teacher Mode, Class Reading, HSK Simulation) | Launch a game → pick game + kids → Launch |
| Live Teacher Mode | Live Teacher Mode → Activate |
| Official tests → family → level → Open room with PIN | Official tests (1) then 2 folder taps (unchanged drill-down) |
| Test results / migrate a result | Test results (1) → tap a result |
| Reading in class (launch / force) | Reading in class → Launch or Force |
| Sentence practice (folders, vocabulary, ES/EN) | Sentence practice → folder |
| Message the class / GIF / Send home | one button each in Online now |
| A kid's Cuaderno (notes, report card, message, classroom, delete…) | tap the row |
| Special assignment / Classrooms / Guides / Backup / My Gateway | one button each in Tools |
| Teachers tab (code levels, new teacher, new code) | Teachers tab |
| Refresh / Log out | top bar |

## 4. Tokens

Colour (from home.css / kingdoms.css, the established world):

| Token | Hex | Job |
|---|---|---|
| `--ink` | #1d2440 | text, outlines, sticker shadows |
| `--ink-soft` / `--ink-mute` | #55607f / #5f6984 | secondary and quiet text (5.9:1 and 4.9:1 on paper) |
| `--paper` | #fff7e3 | cards, panels, modals |
| `--sky` / `--sky-2` | #9fdcf7 / #c6ecfb | page ground (sky fading to pale) |
| `--gold` | #ffc93c | the one primary action per area (Launch a game, modal confirms) |
| `--mint` | #c8f2dc / `--jade` #1a7a43 | online, success (jade is the text colour, 4.8:1) |
| `--coral` | #f0443a | danger (delete) and the Send home rescue |
| `--blue` | #2f7bea | focus ring, links, selection |
| level tints | YCT 1 peach, New HSK 1 sky, Old HSK 1 butter | level pills |

Type: Baloo 2 (800) only for the page title, section titles, the start tiles and big counts; Nunito for every
label, button, row and number (tabular numerals). Scale in rem, ratio about 1.2: 0.8125 / 0.875 / 1 / 1.125 /
1.375 / 1.75 / 2.25.

Spacing: 4 px base (4, 8, 12, 16, 24, 32, 48). Radius: panels 18 px, modals 20 px, buttons and inputs 12 px, pills
only for small status chips and filter chips. Elevation: the world's sticker edge, declared once per level: panels
2 px ink border + 4 px ink drop, buttons 2 px ink border + 3 px ink drop (gold primary 4 px), rows have none.

Motion (emil-design-eng): press = translateY(2px) + shadow shrinks, 100 ms ease-out (the sticker press of the home
page); modals enter with scrim fade + card from scale(.97)/8 px, 200 ms cubic-bezier(.23,1,.32,1), exit instantly;
toasts slide up 200 ms; a kid who comes online pops into Online now once (scale .9 → 1, 240 ms). No infinite loops
except one slow "live" dot; everything off under prefers-reduced-motion. Hover effects only on hover-capable pointers.

Signature move: Online now. Up to five avatars stand on one line along the Dubai skyline, feet on the ground like
the gang on the home page; a bigger class becomes a scrolling grid of smaller faces that keeps every name. The count
is in big Baloo numerals. It answers "who is here?" from across the room.

## 5. Panels

- Login: sky ground with the skyline, a paper card with Dralingo (wise pose) and two gang members picked at random,
  "Teacher Mode", the code field and a gold Enter. Loading and error text inside the card.
- Dashboard: as in section 3. Roster rows: avatar with online dot, name + code, level pill, class, daily ✅/⏳,
  ⚔️ 🔥 📝 📚 🏆 numerals, last seen (green "online" when live). Group labels "Online now" / "Earlier". Search, filter
  chips (All, Online, one per level present) and a class select (when classrooms exist) survive the 15 s refresh.
- Student detail (Cuaderno): replaces the roster inside the Students panel; header with big avatar, name + rename,
  code, level, class select, device line, actions (Send message opens an inline composer, Clear sentences, Delete),
  report-card notes card, then Official tests, Assignments, Reading tests, Sentences.
- Teachers tab: one card per teacher, codes as chips with their level select and the "New code" control.
- Modals (all 20+): one paper card language, sticky ✕, Esc closes, focus moves in and back, body scroll locked,
  primary button sticky at the bottom of long pickers. Message the class becomes a real form (class code, message,
  optional link) instead of five prompts.
- Toasts replace blocking alerts (errors stay longer and use role=alert). Destructive actions keep their confirm().

## 6. States

| Where | Loading | Empty | Error |
|---|---|---|---|
| Roster | 4 skeleton rows | "No student activity yet. Kids appear here after their first homework or game. Your class codes: …" | "Can't reach the server. Games already open keep running. Check the Wi-Fi, then Retry." + Retry |
| Online now | skeleton avatars | two gang stickers + "Nobody online yet. Kids show up when they open their homework or join a game." | same banner as roster |
| Pickers | "Loading students…" | "Nobody is online right now. Switch to All…" | toast with the server's error |
| Login | button shows "Signing in…" | — | "That code didn't work. Check it and try again." |

## 7. Review of the plan against the brief

- Generic-default check: a light SaaS dashboard with a left sidebar and KPI cards was the first idea; rejected because
  the KPI row is the hero-metric template and a sidebar hides the start actions. Revised to the start band + Online
  now on top, KPIs reduced to one quiet line inside the roster panel.
- Sticker look vs calm: the full kingdoms treatment (4 px borders, 8 px drops everywhere) is a toy on a working
  screen; kept only on the start tiles and modals, 2 px elsewhere, rows flat.
- Emoji as icons: the platform's icon vocabulary everywhere (games, roster, kid screens); a new icon library is not
  allowed (no new external libraries), so emoji stay, set in consistent paper tiles.
- Dark mode: not added; the projector scene and the platform world are light.

## 8. What each design skill changed

- **frontend-design**: the plan in this file (subject, scene, tokens, one signature move: Online now on the Dubai
  waterfront) and the review of the plan against the brief (section 7).
- **design-taste-frontend**: redesign audit (section 2), anti-default checks: no hero-metric KPI cards, no eyebrows,
  no em dashes in new copy, one radius system (panels 18, buttons 12, pills only for chips), one accent per job
  (gold = start / confirm), full state cycle (loading skeletons, empty, error with Retry), opaque disabled buttons.
- **impeccable**: dual-agent critique before (17/40, 45 detector findings: jade white-text contrast, purple headings,
  side-tab borders, glows, pulsing dots, em dashes) and after; Operate-mode rules (standard controls, motion only for
  state, product type scale); browser surfaces themed (selection, caret, scrollbars, focus ring, tabular numerals).
- **emil-design-eng**:

| Before | After | Why |
| --- | --- | --- |
| Every `.btn` lifts `translateY(-2px)` with a coloured glow on hover | Sticker press `translateY(2px)` + drop shrinks, 100 ms `cubic-bezier(.23,1,.32,1)`; hover only under `(hover: hover) and (pointer: fine)` | Press must answer instantly; hover jitter on touch screens is noise |
| `m-pulse` on the online pill and `m-dot-pulse` on every online row, forever | One slow 2.4 s live ring on the «Online now» dot; rows still | Motion only where it carries state |
| Modals pop in at once over a blur | Scrim fade 160 ms, card from `scale(.97)` + 8 px in 220 ms; exit instant; phones slide a bottom sheet up 260 ms | Enter eases, exit is fast; the sheet comes from where the thumb is |
| `alert()` boxes | Toast up 220 ms, out 160 ms, time on screen grows with its length | Feedback without freezing the class |
| Rows re-sorted by last seen every 15 s | Online kids sorted by name; a newcomer pops into Online now once (260 ms) | Targets stay where the finger expects them |
| Selected launcher card grows `scale(1.02)` | Gold fill + ink drop, press `scale(.98)` | Selection shown by colour, not by layout |
| No reduced-motion handling | `prefers-reduced-motion`: opacity fades only, no loops | Accessibility |

## 9. Results

| Check | Before | After |
|---|---|---|
| impeccable critique (Nielsen, dual-agent) | 17/40, Poor | 29/40, Good |
| impeccable detector, CLI on maestro.html | 45 findings | 2 (both false positives: login cast images get their src at runtime) |
| impeccable detector in the browser (dashboard / launcher / profile) | 16 / 22 / 27 | 6 / 6 / 5 (row-text contrast, then fixed with the new tokens) |
| Click-through of every panel and action that needs no live class | n/a | 30/30, no JS errors |
| Fix checks (layout 1024-1280, 401 vs 429, crowd strip, profile in view, breadcrumb, tablet top bar) | n/a | all pass |

Independent code review (agent-skills:code-reviewer): 4 important findings (roster columns under the tools rail at
981-1279 px, every `ok:false` treated as a wrong code, profile opening off-screen, Results breadcrumb lost) and 14
suggestions, all fixed; a re-check confirmed them and found one new issue (codes chip over the tabs at 641-1000 px),
fixed. Same pass on the critique's priorities: names kept for big classes in Online now, one 45 s «online» window
everywhere, one picker contract (online kids checked, «Select all / Clear»), contrast tokens, launcher grouped in
«Class tools» and «Games», Teachers tab without the start band.

Known and left as is: the launcher still replaces /maestro in the same tab (proven mobile flow), three rare admin
`prompt()` boxes remain (rename, edit sentence, move a result), the HSK Simulation launcher entry always opens Old HSK
Sim 1 (LAUNCHER_GAMES is shared with another branch), Spanish exam titles inside Official tests come from the sim data.
