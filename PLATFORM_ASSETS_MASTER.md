# 🎬 Draly Wisdomgrounds — Master Asset Plan & Generation Queue

**One file. Everything in it. Hand to Cowork (with Higgsfield MCP) all at once, or batch yourself.**

This document has 3 sections:
1. **Why each asset** — the strategic case (what improves)
2. **Style guide** — global rules every clip must follow
3. **Generation queue** — every asset with a ready-to-paste prompt, in priority order

Total: **31 clips**. Estimated Higgsfield cost: **$60–$120** depending on model tier. Fits your $300 budget with room.

---

# PART 1 — Strategic case: where the platform needs help

I walked through every surface a kid touches and identified exactly where a video/animation would transform the experience. Here's the tour:

## 🟦 Landing page (the first impression)
**Current state**: Static `dralingo.png` PNG hero. Kid logs in to a still image.
**What helps**: A 6-10 second looping clip of Dralingo + Mochi waving, dragon flapping wings, signaling "this is a real living place." First impression matters more than any other surface.
→ **1 asset**

## 🟨 Homework portal — the home tab
**Current state**: 3 tab buttons (Pendientes, Completadas, Tu Maestro/a) with emoji icons. Below them, 8 EXP folder cards with emoji + label only.
**What helps**:
- 8 short hero clips, one per EXP, that autoplay-mute as a 3-second loop when you tap the folder. Kid sees a Pixar family scene for La Familia, a restaurant for Lugares, etc. Instant context, no reading needed.
→ **8 assets**

## 🐲 Daily mode — Templo del Dragón (the signature moment)
**Current state**: Themed CSS scene (mountains, pagoda, petals) + emoji dragon. The dragon spins via CSS animation at the end.
**What helps**:
- A real animated dragon roar replacing the emoji at victory (the #1 highest-impact clip in the platform)
- Character entrance clips for 8 daily characters (Gojo, Yuji, FNAF, Shelly, Dandy, Dralingo, anime-1, anime-2) — currently they slide in as PNGs
- Looping atmosphere backgrounds (dawn / dusk) for the temple scene
→ **11 assets**

## 🎮 Per-game intro cutscenes
**Current state**: Every game (Triage, LQH, Conquest, Hongbao, Identity, 6-7, Reading, Warmup) boots straight to its lobby. Cold start.
**What helps**: A 3-4 second movie-trailer-style intro before each lobby. Skippable. Makes each game feel like a real "level" with a curtain.
→ **8 assets**

## 🌐 Emirati gateway (your personal Khaleeji learning surface)
**Current state**: Section headers with emoji icons. No visual context.
**What helps**: One short looping culture clip per major section (greetings = two Emirati men embracing; food = Arabic coffee pour; transport = camel caravan).
→ **6 assets** (one for the 6 most important sections)

## ⬛ NOT generating (deliberately):
- Reading mode story-page animations (24+ clips, defer until everything above ships)
- Maestro admin panel (no need for cinematics in admin UI)
- Avatar gallery (existing static avatars are fine for now)

---

# PART 2 — Style guide (every clip MUST follow)

These rules apply to **every single generation**. Pasting these once at the start of the Cowork session locks the style.

```
GLOBAL STYLE FOR ALL CLIPS:
- Style: Pixar 3D animation, kid-friendly, warm Asian color grade
- Color palette: warm gold #ffd24a, jade green #5be88a, sky blue #5be8d1,
  Chinese red #c81e1e, cream parchment #fff5d8
- Character proportions: chibi (big heads, small bodies), friendly faces,
  expressive eyes
- Lighting: warm golden-hour, soft shadows, rim-lit
- Camera: gentle, no fast cuts, no jump scares, no extreme close-ups on faces
- Audio: muted (no soundtrack — platform has its own SFX)
- Resolution: 720p
- FPS: 24
- Output: MP4 (or WebM with alpha channel for character intros)
- Negative prompt for EVERY clip:
  "scary, violent, dark, gore, realistic photo, adult content,
  text overlay, watermark, jump scare, fast cut, harsh lighting,
  western dragon (use Chinese dragon), motion blur"
- Duration: respect each clip's spec (most are 4-6 seconds)
- Audience: children 7-10, Spanish-speaking, learning Chinese
```

---

# PART 3 — Generation queue (priority order)

Every clip has 4 lines: `PROMPT`, `ASPECT`, `DURATION`, `SAVE TO`. Cowork can generate top-to-bottom or you can pick & choose.

Estimated cost is per clip on Higgsfield's mid-tier video model (~$2/clip avg).

---

## 🏆 TIER S — Signature moments (9 clips, ~$18)
*Biggest visible improvement per dollar. If you only do one tier, do this.*

### S1. Dragon Victory Roar
- **PROMPT**: Pixar-style golden Chinese dragon, jade scales, red mane, long sinewy serpentine body NO WINGS, slow majestic head-turn toward camera, then roars with mouth open wide letting golden light burst outward, night sky background with hanging red paper lanterns, pagoda silhouette in distance, cherry blossom petals drifting, dramatic low angle, warm golden-hour rim lighting, chibi-friendly NOT scary
- **ASPECT**: 9:16 vertical
- **DURATION**: 5 seconds
- **SAVE TO**: `public/assets/cutscenes/daily/dragon-victory.mp4`

### S2. Landing page Dralingo + Mochi loop
- **PROMPT**: Pixar-style scene, baby blue chibi dragon wearing tiny white Emirati keffiyeh headdress next to a small smiling panda, both on a red Chinese arched bridge, soft sunset sky behind, paper lanterns hanging, the dragon flaps tiny wings gently as panda waves at camera, SEAMLESS LOOP (start frame matches end frame), warm golden hour
- **ASPECT**: 16:9 horizontal
- **DURATION**: 8 seconds
- **SAVE TO**: `public/assets/cutscenes/landing/hero-loop.mp4`

### S3. Templo background — Dusk loop
- **PROMPT**: Pixar-style Chinese mountain pagoda at twilight, layered purple-to-pink sky, gentle clouds drifting, red paper lanterns lighting one-by-one in sequence, fireflies floating, distant misty peaks, slow gentle camera pan right, SEAMLESS LOOP
- **ASPECT**: 9:16 vertical
- **DURATION**: 10 seconds
- **SAVE TO**: `public/assets/cutscenes/temple/bg-dusk.mp4`

### S4. Templo background — Dawn loop
- **PROMPT**: Pixar-style Chinese mountain pagoda at sunrise, pink and gold sky, light mist drifting across the valley below, dew on jade-colored mountains, a single golden dragon silhouette winding through the clouds in distance, slow gentle pan left, SEAMLESS LOOP
- **ASPECT**: 9:16 vertical
- **DURATION**: 10 seconds
- **SAVE TO**: `public/assets/cutscenes/temple/bg-dawn.mp4`

### S5. Gojo character entrance (transparent bg)
- **PROMPT**: Anime character Gojo Satoru from Jujutsu Kaisen, spiky white hair, dark blindfold across eyes, dark blue uniform with white scarf, hands in pockets confident smirk, snaps fingers and blue infinity glow pulses outward in a circular shockwave, transparent background OR pure chroma-key green (#00FF00) if alpha not available, 4 seconds
- **ASPECT**: 9:16 vertical
- **DURATION**: 4 seconds
- **SAVE TO**: `public/assets/cutscenes/chars/gojo-intro.webm`

### S6. Yuji character entrance (transparent bg)
- **PROMPT**: Anime character Yuji Itadori from Jujutsu Kaisen, spiky pink hair, school uniform, runs into frame with fist raised, friendly determined grin, pink cherry blossom petals trailing behind him, transparent background OR chroma-key green if alpha unavailable
- **ASPECT**: 9:16 vertical
- **DURATION**: 4 seconds
- **SAVE TO**: `public/assets/cutscenes/chars/yuji-intro.webm`

### S7. Dralingo character entrance (transparent bg) ⭐
- **PROMPT**: Pixar-style baby blue chibi dragon wearing tiny white Emirati keffiyeh headdress, friendly chibi proportions with big sparkly eyes, small smile, golden Chinese 中 character floats above its head, flaps tiny wings excitedly and waves at camera, transparent background OR chroma-key green
- **ASPECT**: 9:16 vertical
- **DURATION**: 4 seconds
- **SAVE TO**: `public/assets/cutscenes/chars/dralingo-intro.webm`

### S8. Shelly character entrance (transparent bg)
- **PROMPT**: Cartoon character Shelly from Brawl Stars, pink pigtails, casual outfit, shotgun lowered across shoulders, finger gun pose with playful confident wink, chibi-friendly proportions, transparent background OR chroma-key green
- **ASPECT**: 9:16 vertical
- **DURATION**: 4 seconds
- **SAVE TO**: `public/assets/cutscenes/chars/shelly-intro.webm`

### S9. FNAF Freddy character entrance (transparent bg, kid-friendly version)
- **PROMPT**: Cartoon brown animatronic teddy bear character, top hat, friendly purple smiling eyes (NOT scary, very kid-friendly), waves at camera, pizza arcade neon glow around him, chibi proportions, transparent background OR chroma-key green
- **ASPECT**: 9:16 vertical
- **DURATION**: 4 seconds
- **SAVE TO**: `public/assets/cutscenes/chars/fnaf-intro.webm`

---

## 🥈 TIER A — EXP folder hero clips (8 clips, ~$16)
*Plays as 3-second preview when kid taps each HSK1 unit folder. Massive content density boost.*

### A1. EXP1 — La Familia
- **PROMPT**: Pixar-style Chinese family at a circular dinner table, grandmother 奶奶 grandfather 爷爷 mother 妈妈 father 爸爸 son 儿子 daughter 女儿, all chibi-friendly, sharing dim sum and rice, smiling at each other, red paper lanterns hanging overhead, warm golden lighting, gentle camera pull-back from the center of table
- **ASPECT**: 16:9
- **DURATION**: 6 seconds
- **SAVE TO**: `public/assets/cutscenes/exps/exp1.mp4`

### A2. EXP2 — Saludos y personas
- **PROMPT**: Pixar-style scene of three friendly Chinese students waving hello at camera, schoolyard background with cherry blossom trees, Chinese characters 你好 floating in calligraphy ink style, warm sunny lighting, chibi proportions
- **ASPECT**: 16:9
- **DURATION**: 6 seconds
- **SAVE TO**: `public/assets/cutscenes/exps/exp2.mp4`

### A3. EXP3 — Lugares
- **PROMPT**: Pixar-style quick parallax tour of three Chinese place exteriors in sequence — a 饭馆 restaurant with red lanterns, a 商店 store with bright signs, a 学校 school with a flagpole — gentle dolly camera, warm afternoon light, chibi figures bustling about each entrance
- **ASPECT**: 16:9
- **DURATION**: 6 seconds
- **SAVE TO**: `public/assets/cutscenes/exps/exp3.mp4`

### A4. EXP4 — Tiempo y días
- **PROMPT**: Pixar-style dreamy montage — a paper Chinese calendar with pages fluttering off, a wall clock ticking slowly, sun rising and setting across the screen, Chinese characters 今天 明天 昨天 (today tomorrow yesterday) fade in and out in floating calligraphy, warm magical lighting
- **ASPECT**: 16:9
- **DURATION**: 6 seconds
- **SAVE TO**: `public/assets/cutscenes/exps/exp4.mp4`

### A5. EXP5 — Movimiento (qù / lái / huí)
- **PROMPT**: Pixar-style chibi character on a clean white background, walks left and exits frame (label 去 qù appears), turns around and walks back right (label 回 huí), then strolls forward toward camera waving (label 来 lái), simple animated arrows trail behind, friendly tutorial vibe
- **ASPECT**: 16:9
- **DURATION**: 6 seconds
- **SAVE TO**: `public/assets/cutscenes/exps/exp5.mp4`

### A6. EXP6 — Cosas
- **PROMPT**: Pixar-style household items floating playfully in a circular orbit — a small TV 电视, a laptop 电脑, a wooden table 桌子, a wooden chair 椅子, folded clothes 衣服 — gentle rotation, warm interior lighting, like a magic Disney-style enchanted-house moment
- **ASPECT**: 16:9
- **DURATION**: 6 seconds
- **SAVE TO**: `public/assets/cutscenes/exps/exp6.mp4`

### A7. EXP7 — Preguntas
- **PROMPT**: Pixar-style chibi character with curious head-tilt, thought bubbles popping up around them showing Chinese question characters 谁 (who) 什么 (what) 怎么 (how) 几 (how many), each bubble glowing softly, character points finger as if asking, warm puzzled lighting
- **ASPECT**: 16:9
- **DURATION**: 6 seconds
- **SAVE TO**: `public/assets/cutscenes/exps/exp7.mp4`

### A8. EXP8 — Números
- **PROMPT**: Pixar-style Chinese number characters 一 二 三 四 五 floating up like balloons from the ground, chibi character catches them one by one in cupped hands, golden confetti and small fireworks burst out, joyful celebration mood, warm golden-hour light
- **ASPECT**: 16:9
- **DURATION**: 6 seconds
- **SAVE TO**: `public/assets/cutscenes/exps/exp8.mp4`

---

## 🥉 TIER B — Game intro cutscenes (8 clips, ~$16)
*Plays once before each game's lobby. Skippable. Movie-trailer feel.*

### B1. Triage ER
- **PROMPT**: Pixar-style ambulance with flashing red lights pulls up to glass hospital double doors, friendly cartoon medics push a gurney through, hospital interior glows warm in the background, "TRIAGE 急诊" title appears in red Chinese-medical block font, urgent but kid-friendly
- **ASPECT**: 16:9
- **DURATION**: 4 seconds
- **SAVE TO**: `public/assets/cutscenes/games/triage-intro.mp4`

### B2. LQH Dragon Courier
- **PROMPT**: Pixar-style chibi Chinese dragon courier flies low and fast over green rolling hills carrying a red envelope 红包 in its mouth, mailboxes labeled qù lái huí blur past below, motion-blur trails of yellow gold, joyful adventure mood
- **ASPECT**: 16:9
- **DURATION**: 4 seconds
- **SAVE TO**: `public/assets/cutscenes/games/lqh-intro.mp4`

### B3. Conquest
- **PROMPT**: Pixar-style sand dunes at golden hour, two opposing chibi horseback armies face each other across the valley, colorful war banners flap in the wind, a war horn sounds (visualize sound waves), "CONQUEST 征服" title carved in stone tablet rises from ground, kid-friendly NOT scary
- **ASPECT**: 16:9
- **DURATION**: 4 seconds
- **SAVE TO**: `public/assets/cutscenes/games/conquest-intro.mp4`

### B4. Hongbao Run
- **PROMPT**: Pixar-style Mario-Party-style 3D board game perspective, giant dice rolling in slow-motion across colorful board tiles, red envelopes 红包 fly past like confetti, festive Chinese new year lanterns swing, gold coins sparkle in air, joyful party energy
- **ASPECT**: 16:9
- **DURATION**: 4 seconds
- **SAVE TO**: `public/assets/cutscenes/games/hongbao-intro.mp4`

### B5. Identity Detective
- **PROMPT**: Pixar-style magnifying glass close-up sweeping across a row of friendly chibi face cards (Chinese style portraits), cards flip and shuffle on their own, "谁是?" (who is?) title appears in red ink-brush calligraphy, mystery tone but warm and kid-friendly
- **ASPECT**: 16:9
- **DURATION**: 4 seconds
- **SAVE TO**: `public/assets/cutscenes/games/identity-intro.mp4`

### B6. 6-7 Math
- **PROMPT**: Pixar-style cartoon chibi character swinging on a trapeze between two giant glowing number characters 六 (6) and 七 (7), colorful math symbols + - × ÷ sparkle around them, festive playground energy, warm bright lighting
- **ASPECT**: 16:9
- **DURATION**: 4 seconds
- **SAVE TO**: `public/assets/cutscenes/games/sixseven-intro.mp4`

### B7. Reading Mode
- **PROMPT**: Pixar-style old Chinese folktale book opens itself in mid-air on a wooden table, pages turn themselves gently, characters and dragons lift off the pages glowing in soft 3D light, golden particles drift up, magical storytime mood
- **ASPECT**: 16:9
- **DURATION**: 4 seconds
- **SAVE TO**: `public/assets/cutscenes/games/reading-intro.mp4`

### B8. Warmup Builder
- **PROMPT**: Pixar-style Chinese chess pieces 棋 arrange themselves into a row of word chips on a wooden table, each chip snaps into place with a satisfying glow, calligraphy ink swirls in background, focused-learning warm energy
- **ASPECT**: 16:9
- **DURATION**: 4 seconds
- **SAVE TO**: `public/assets/cutscenes/games/warmup-intro.mp4`

---

## 🌐 TIER C — Emirati gateway culture (6 clips, ~$12)
*Plays at the top of each Khaleeji section. Cultural context for the platform owner's personal study.*

### C1. Greetings (Saludos)
- **PROMPT**: Two Emirati men in traditional white kandura robes warmly embrace and exchange three cheek kisses (traditional UAE greeting), sand-colored majlis interior with patterned cushions, golden hour light streaming through window, respectful kid-friendly tone
- **ASPECT**: 16:9
- **DURATION**: 5 seconds
- **SAVE TO**: `public/assets/cutscenes/emirati/greet.mp4`

### C2. Family
- **PROMPT**: Emirati family majlis scene, grandfather in white kandura, father with son in matching dress, all sitting cross-legged on patterned cushions sharing Arabic coffee from a gold dallah pot, gentle smiles, warm interior lighting, family-warmth tone
- **ASPECT**: 16:9
- **DURATION**: 5 seconds
- **SAVE TO**: `public/assets/cutscenes/emirati/family.mp4`

### C3. Food
- **PROMPT**: Close-up of Arabic coffee being poured in a slow elegant stream from a tall gold dallah pot into a small handle-less cup (finjan), plates of medjool dates and golden luqaimat dumplings drizzled with date syrup nearby on a wooden tray, golden hour warm lighting
- **ASPECT**: 16:9
- **DURATION**: 5 seconds
- **SAVE TO**: `public/assets/cutscenes/emirati/food.mp4`

### C4. Home / Places
- **PROMPT**: Aerial slow pull-back from a traditional Emirati wind-tower house in Al Bastakiya old Dubai neighborhood, then continues pulling back to reveal the modern Dubai skyline with Burj Khalifa in distance, sand-colored to glass-tower contrast, golden hour
- **ASPECT**: 16:9
- **DURATION**: 5 seconds
- **SAVE TO**: `public/assets/cutscenes/emirati/home.mp4`

### C5. Transport
- **PROMPT**: A caravan of three camels with riders crossing red sand dunes of Liwa desert at sunset, long shadows, peaceful slow pace, then a quick cut to a white Land Cruiser pulled up at a desert oasis under palm trees, sand to modern transition
- **ASPECT**: 16:9
- **DURATION**: 5 seconds
- **SAVE TO**: `public/assets/cutscenes/emirati/transport.mp4`

### C6. Culture (falconry)
- **PROMPT**: Close-up of a falcon launching gracefully from a falconer's gloved hand wearing traditional Emirati attire, the bird soars upward, camera tilts to follow it climbing high above the Dubai skyline (Burj Khalifa visible), Emirati flag waving in foreground, majestic patriotic-warm tone
- **ASPECT**: 16:9
- **DURATION**: 5 seconds
- **SAVE TO**: `public/assets/cutscenes/emirati/culture.mp4`

---

# 📋 PART 4 — How to use this with Cowork

## Option A: Hand the whole file (if you trust the model)

In Cowork (with Higgsfield MCP attached), paste this single message:

```
I'm attaching the file PLATFORM_ASSETS_MASTER.md. It contains the
strategic plan, style guide, and 31 ready-to-generate prompts for
my kids' learning platform.

Workflow:
1. Read PART 2 (style guide) and treat it as the rules for EVERY clip.
2. Run mcp__higgsfield__balance and tell me my credit balance.
3. Run mcp__higgsfield__models_explore and recommend the best model
   for Pixar-style short clips. Tell me your choice.
4. Generate ALL 9 clips in Tier S, top to bottom, using the prompts
   AS WRITTEN. For each clip: respect the ASPECT, DURATION, and SAVE TO
   fields exactly. The save path will be your local filesystem; I'll
   pull the files from there after.
5. After Tier S finishes, STOP and show me a summary (which clips
   completed, total credits spent, any errors). DO NOT proceed to
   Tier A/B/C without my approval.
6. After my approval, repeat for Tier A, then Tier B, then Tier C.

Constraints:
- Stop if my balance drops below $50.
- Apply the PART 2 negative prompt to every generation.
- If a clip generation fails, retry once. If it fails twice, skip and
  report it; do not block the queue.
- Add commit messages locally if you have git access: "asset: <ID> <name>"

Ready? Start with step 1 (balance check).
```

Then paste the file content right after.

## Option B: One clip at a time (safer, fewer surprises)

Open a Cowork session, paste the GLOBAL STYLE block from PART 2 first as a sticky rule, then paste **one clip's PROMPT + ASPECT + DURATION** at a time. Cowork generates, you approve, you save, you paste the next.

This is slower but gives you full control over every clip and lets you tweak prompts mid-stream.

## Option C: I generate the prompts dynamically here

If Cowork keeps fighting you, just tell me here in this Claude Code session:

> *"Generate clip S1 prompt-only"*

…and I'll paste exactly the ready-to-paste prompt for that one clip with all the style rules baked in. Then you paste THAT into Cowork or any other AI video tool. No file reading needed.

---

# 🔄 PART 5 — What happens after Cowork is done

Once you have MP4 / WebM files from Higgsfield, drop them into the `public/assets/cutscenes/` subfolders matching the `SAVE TO` paths in this doc. Then come back to **this Claude Code session** and say:

> *"Assets landed. Wire Tier S into the platform."*

I'll do all the integration:
- Swap the CSS dragon emoji in homework.js for `<video autoplay muted playsinline>`
- Replace `dralingo.png` on landing page with the video loop
- Wire the 8 character WebMs into the daily intros (replacing the PNG sliding-in animation)
- Add the temple background loops behind the Templo scene
- Bump cache-bust, commit, push to Render

You'll see them live within minutes of each tier landing.

---

# 📊 PART 6 — Cost & timeline forecast

| Tier | Clips | Est. cost | Est. wall-time |
|---|---|---|---|
| S — Signature | 9 | $14–25 | ~45 min |
| A — EXP heroes | 8 | $14–22 | ~40 min |
| B — Game intros | 8 | $14–22 | ~40 min |
| C — Emirati culture | 6 | $10–18 | ~30 min |
| **TOTAL** | **31** | **$52–87** | **~2.5 hrs** |

If you only do Tier S, that's already a transformed-looking platform for ~$20.

---

**TL;DR**: This file is the deliverable you asked for. Take it to Cowork (Option A or B above), get the files, bring them back, I plug them in.
