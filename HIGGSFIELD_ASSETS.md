# 🎬 Higgsfield Asset Production Plan
**Status:** Ready to generate. When Cowork-mode is on with Higgsfield MCP enabled, I'll work this list top-down.

## How this works
1. **You decide the budget** — pick a tier (top to bottom, decreasing impact-per-clip).
2. **I generate** each asset via MCP using the spec sheet below.
3. **Higgsfield returns an MP4/PNG URL** → I download → save to the path shown.
4. **I wire it in** — replace the static PNG / add a new `<video>` tag / etc. The integration is already scoped per asset.
5. **Commit + deploy.**

Every asset on this list is **single-generation, lifetime asset** — generated once, served from disk to every kid forever.

---

## What I need from you (one-time, before we start)

| Question | Why I need it | Default if unsure |
|---|---|---|
| Confirm your Higgsfield plan tier | Different tiers expose different models (image-only, video, character-lock, etc) | I'll inspect via MCP `balance` + `models_explore` first |
| Preferred art style for kids | "Anime", "Pixar 3D", "watercolor", "Disney 2D", "flat cartoon", "cinematic realism" | **Pixar 3D + Asian aesthetic** (warm, kid-friendly, parents-approve) |
| Color palette anchors | Brand consistency across all clips | Dralingo blue (`#5be8d1`), jade (`#5be88a`), warm gold (`#ffd24a`), Chinese red (`#c81e1e`) |
| Dralingo character reference image | Higgsfield character-lock works best with a reference PNG | The existing `public/assets/dralingo.png` |

---

## 📦 Asset budget tiers

### 🟢 TIER 1 — Signature moments (**14 clips, ~$30-50 of plan**)
The visceral wow-moments kids will tell their friends about. If you only do one tier, do this.

#### 1.1 — Templo del Dragón boss roar  ⭐ HIGHEST IMPACT
- **Prompt:** *"Pixar-style golden Chinese dragon, jade scales, red mane, slow majestic head-turn toward camera, roars open mouth with golden light bursting out, night sky with hanging red lanterns and pagoda silhouette in background, cherry blossom petals floating, dramatic low angle, warm golden-hour lighting, 5 seconds"*
- **Aspect ratio:** 9:16 (vertical, plays in the daily game arena)
- **Duration:** 5s
- **Save to:** `public/assets/cutscenes/daily/dragon-victory.mp4`
- **Integration:** Replace the `🐲` emoji in `.hw-temple-dragon.roar` CSS animation with `<video autoplay muted playsinline>` at the end of `runStoryMode()` → `finishTemple()` in homework.js. Already-placed; just swap.
- **Why it matters:** This is the daily reward moment. Currently a CSS-rotated emoji. Replacing with a real 5s dragon roar = the kid feels they BEAT something.

#### 1.2-1.9 — Daily-mode character entrances (8 clips)
Each: character bursts onto screen in their signature style, 4 seconds, transparent background.

| # | Character | Prompt | Target file |
|---|---|---|---|
| 1.2 | **Gojo** (JJK) | *"Anime character Gojo Satoru with white hair and blindfold, blue and white outfit, snaps fingers, blue infinity glow pulses outward, confident smirk, transparent background, 4 seconds"* | `public/assets/cutscenes/chars/gojo-intro.webm` |
| 1.3 | **Yuji** (JJK) | *"Anime character Yuji Itadori, pink hair, school uniform, runs in with fist raised, friendly grin, sakura petals trailing behind, transparent background, 4 seconds"* | `public/assets/cutscenes/chars/yuji-intro.webm` |
| 1.4 | **FNAF Freddy** | *"Cute brown animatronic bear waving at camera, top hat tipped, friendly purple eyes (NOT scary — kid-friendly), pizza arcade neon glow, transparent background, 4 seconds"* | `public/assets/cutscenes/chars/fnaf-intro.webm` |
| 1.5 | **Shelly** (Brawl Stars) | *"Brawl Stars Shelly, pink hair pigtails, shotgun lowered casually, finger gun pose, confident wink, transparent background, 4 seconds"* | `public/assets/cutscenes/chars/shelly-intro.webm` |
| 1.6 | **Dandy** (Dandy's World) | *"Tall cartoon flower-headed mascot, yellow petals, polite bow, gentle wave, transparent background, 4 seconds"* | `public/assets/cutscenes/chars/dandy-intro.webm` |
| 1.7 | **Dralingo** ⭐ | *"Pixar-style baby blue dragon wearing a tiny Emirati keffiyeh headdress, friendly chibi proportions, soft smile, ZH 中 floating above head, flaps wings excitedly, transparent background, 4 seconds, USE REFERENCE IMAGE for character lock"* | `public/assets/cutscenes/chars/dralingo-intro.webm` |
| 1.8 | **Anime warrior** (generic) | *"Anime warrior with cherry blossom katana, cool spin pose, petals trail, transparent background, 4 seconds"* | `public/assets/cutscenes/chars/anime1-intro.webm` |
| 1.9 | **Anime mage** | *"Anime mage with glowing pinyin characters orbiting her, magical staff, spell-cast pose, transparent background, 4 seconds"* | `public/assets/cutscenes/chars/anime2-intro.webm` |

**Spec:** WebM with alpha channel if Higgsfield supports it (preferred); else MP4 with green-screen and we chroma-key in the browser.
**Integration:** In `homework.js`, the `DAILY_CHARS` array currently has `img: '/assets/png-library/...'`. Add a `videoIntro: '/assets/cutscenes/chars/X-intro.webm'` field. Then in `showDailyStory()`, if `videoIntro` exists, play it as the entrance instead of fade-in PNG.

#### 1.10 — Dralingo + Mochi landing-page loop
- **Prompt:** *"Pixar-style scene: baby blue dragon with Emirati keffiyeh and small panda friend bouncing on a Chinese red bridge, soft sunset backdrop with floating lanterns, both wave at camera, loop-ready (start = end), 8 seconds"*
- **Aspect ratio:** 16:9
- **Duration:** 8s, MUST loop seamlessly
- **Save to:** `public/assets/cutscenes/landing/hero-loop.mp4`
- **Integration:** Replace landing-page hero `<img>` with `<video autoplay muted loop playsinline>`.

#### 1.11-1.14 — Daily-mode background ambience (4 clips)
Looping parallax backgrounds for the Templo scene (replaces the CSS-only gradient). One per day-of-week mood:

| # | Mood | Prompt | File |
|---|---|---|---|
| 1.11 | Dawn | *"Chinese mountain pagoda at sunrise, pink/gold sky, mist over valley, slow camera pan right, seamless loop, 10s"* | `public/assets/cutscenes/temple/bg-dawn.mp4` |
| 1.12 | Day | *"Chinese mountain pagoda midday, blue sky with white clouds drifting, jade dragon statue, cherry blossoms, loop, 10s"* | `public/assets/cutscenes/temple/bg-day.mp4` |
| 1.13 | Dusk | *"Chinese mountain pagoda at twilight, purple sky, red lanterns lighting one-by-one, fireflies, loop, 10s"* | `public/assets/cutscenes/temple/bg-dusk.mp4` |
| 1.14 | Night | *"Chinese mountain pagoda at night, moon over jade peaks, star field, lanterns glowing, loop, 10s"* | `public/assets/cutscenes/temple/bg-night.mp4` |

**Tier 1 total: 14 clips. Rough plan cost: $30-50 (~10-15% of $300 yearly budget). Highest engagement lift in the platform.**

---

### 🟡 TIER 2 — Per-EXP unit hero videos (**8 clips, ~$20-35**)
One 6-second video per HSK1 experience folder. Plays once when the kid enters the folder.

| # | EXP | Theme | Prompt | File |
|---|---|---|---|---|
| 2.1 | EXP1 | La Familia | *"Pixar-style Chinese family — grandma 奶奶, grandpa 爷爷, mom 妈妈, dad 爸爸, son 儿子 — sharing dim sum at round table, golden lanterns above, all smiling, family group hug, 6s"* | `public/assets/cutscenes/exps/exp1.mp4` |
| 2.2 | EXP2 | Saludos / People | *"Three Chinese students waving hello, 你好 floating in calligraphy, school courtyard with cherry blossoms, friendly camera pan, 6s"* | `public/assets/cutscenes/exps/exp2.mp4` |
| 2.3 | EXP3 | Lugares | *"Quick tour: Chinese restaurant 饭馆 façade with red lanterns → store 商店 entrance → school 学校 gate, gentle parallax dolly, 6s"* | `public/assets/cutscenes/exps/exp3.mp4` |
| 2.4 | EXP4 | Tiempo | *"Calendar pages fluttering, clock ticking, sun rising and setting, 今天 明天 昨天 characters fade in, dreamy, 6s"* | `public/assets/cutscenes/exps/exp4.mp4` |
| 2.5 | EXP5 | Movimiento | *"Chibi character walks left (去 qù), turns and runs back right (回 huí), comes forward toward camera (来 lái), simple white background with arrows, 6s"* | `public/assets/cutscenes/exps/exp5.mp4` |
| 2.6 | EXP6 | Cosas | *"Floating Chinese household items — TV 电视, computer 电脑, table 桌子, chair 椅子, clothes 衣服 — orbiting playfully, 6s"* | `public/assets/cutscenes/exps/exp6.mp4` |
| 2.7 | EXP7 | Preguntas | *"Chibi character with thought bubbles popping up: 谁?什么?怎么?几? characters glowing, curious head-tilt, 6s"* | `public/assets/cutscenes/exps/exp7.mp4` |
| 2.8 | EXP8 | Números | *"Chinese numbers 一二三四五 floating up like balloons, character catches them, golden confetti, 6s"* | `public/assets/cutscenes/exps/exp8.mp4` |

**Integration:** In `homework.js → renderFolderRoot()`, when rendering an EXP folder card, add a small **▶ Tráiler** button that opens a fullscreen video player. Or autoplay as a 2-sec preview when the folder card is in viewport.

---

### 🟠 TIER 3 — Game intro cutscenes (**8 clips, ~$25-40**)
Each game currently boots into its arena cold. A 4-second cinematic intro before the lobby gives every game a movie-trailer feel.

| # | Game | Prompt | File |
|---|---|---|---|
| 3.1 | Triage ER | *"Ambulance with red flashing lights pulls up to glass hospital doors, hands push gurney through, 'TRIAGE ER' title in Chinese-medical font, 4s"* | `public/assets/cutscenes/games/triage-intro.mp4` |
| 3.2 | LQH Dragon Courier | *"Pixar Chinese dragon courier flies low over green hills carrying a red envelope 红包, mailboxes labeled qù lái huí blur past, 4s"* | `public/assets/cutscenes/games/lqh-intro.mp4` |
| 3.3 | Conquest | *"Sand dunes, two horseback armies face off, banners flap, war horn sounds, 'CONQUEST' title carved in stone, 4s"* | `public/assets/cutscenes/games/conquest-intro.mp4` |
| 3.4 | Hongbao Run | *"Dice rolling in slow-mo across a Mario-Party-style board, red envelopes 红包 fly past, festive lanterns, 4s"* | `public/assets/cutscenes/games/hongbao-intro.mp4` |
| 3.5 | Identity Detective | *"Magnifying glass close-up sweeping across a row of face cards, cards flip and shuffle, '谁是?' title, 4s"* | `public/assets/cutscenes/games/identity-intro.mp4` |
| 3.6 | 6-7 Math | *"Cartoon character swinging between 6 and 7 number characters like trapeze, math symbols sparkle, 4s"* | `public/assets/cutscenes/games/sixseven-intro.mp4` |
| 3.7 | Reading Mode | *"A Chinese folktale book opens, pages turn themselves, characters lift off the page in glowing 3D, 4s"* | `public/assets/cutscenes/games/reading-intro.mp4` |
| 3.8 | Warmup builder | *"Chinese chess pieces 棋 arranging themselves into a sentence row, word chips snap into place with satisfying clicks, 4s"* | `public/assets/cutscenes/games/warmup-intro.mp4` |

**Integration:** Each game host page (`host-triage.html`, `host-laiquhui.html`, etc.) gets a `<video class="game-intro">` overlay that plays once before the lobby UI fades in. Skippable by tap.

---

### 🔵 TIER 4 — Emirati gateway culture clips (**6 clips, ~$15-25**)
For Fernando's personal gateway. Plays when each section is opened the first time.

| # | Section | Prompt | File |
|---|---|---|---|
| 4.1 | Greetings | *"Two Emirati men in traditional white kandura embrace and exchange cheek kisses (traditional greeting), warm sand-light, Burj Khalifa silhouette in distance, 5s"* | `public/assets/cutscenes/emirati/greet.mp4` |
| 4.2 | Family | *"Emirati family majlis — grandfather, father, son in traditional dress sitting on patterned cushions, drinking Arabic coffee from dallah, gentle smiles, 5s"* | `public/assets/cutscenes/emirati/family.mp4` |
| 4.3 | Food | *"Hand pours Arabic coffee from gold dallah into small cup, plates of dates and luqaimat dessert on tray, golden hour, 5s"* | `public/assets/cutscenes/emirati/food.mp4` |
| 4.4 | Home/Places | *"Aerial slow pull-back from a traditional wind-tower house in Al Bastakiya old Dubai, then reveal modern Burj Khalifa skyline, 5s"* | `public/assets/cutscenes/emirati/home.mp4` |
| 4.5 | Transport | *"Camel caravan crossing red Liwa desert dunes at sunset, then quick cut to white Land Cruiser at oasis, 5s"* | `public/assets/cutscenes/emirati/transport.mp4` |
| 4.6 | Culture | *"Falcon launches from gloved hand, soars high over Dubai skyline (Burj + Frame + Marina), Emirati flag in foreground, 5s"* | `public/assets/cutscenes/emirati/culture.mp4` |

**Integration:** In maestro.js Emirati gateway, each section carpet header gets a small ▶ button that opens the clip in a modal overlay.

---

### ⚪ TIER 5 — Story-page animations (**~24 clips, ~$60-100**)
Reading mode currently shows a single static image per story page. Replacing with subtle 4s loops per page transforms the stories into mini-movies. Defer until tiers 1-4 are confirmed working.

---

## 🛠️ Integration helpers I'll need

When I start generating, I'll create these scaffolds:

1. **`public/assets/cutscenes/`** — new folder for all MP4/WebM assets (auto-gitignored if files exceed Render's free-tier git push limits; otherwise committed).
2. **`core/cutscenes.js`** — small module exporting a `CUTSCENES` map of `{id, type, path, duration}` so the client can request the right file via convention.
3. **`public/js/cutscene-player.js`** — generic `<video>` overlay with tap-to-skip + autoplay-mute + analytics ping.
4. **Cache-bust** — adding `?v=YYYYMMDD` to video URLs so a regenerated asset replaces the prior one cleanly.

---

## 📊 Tracking + budget guard

I'll add an admin-only endpoint `/api/admin/cutscenes/manifest` that lists every asset:
- Tier
- Status (planned / generated / wired / live)
- File size + duration
- Higgsfield job ID (for reference / re-generation)

This lets you see at a glance how much of the plan you've spent and what's left.

---

## ✋ Next step

Once you flip Cowork on with Higgsfield MCP attached, tell me **which tier(s)** you want to start with. I'll:
1. Run `mcp__higgsfield__balance` to check your remaining credits
2. Run `mcp__higgsfield__models_explore` to confirm which models give us alpha-channel video (for character intros)
3. Generate Tier 1 first (highest impact-per-clip)
4. Download → save → wire → commit each one with its own micro-PR

If you want to skip the asset list step and just do **5 of the highest-impact** items right now, those would be: **1.1 Dragon Victory + 1.7 Dralingo + 1.10 Landing loop + 2.1 Family + 3.1 Triage**. Five clips ≈ $10-15, transforms 80% of the platform's "wow moments."
