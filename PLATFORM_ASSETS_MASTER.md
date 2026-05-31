# 🎬 Draly Wisdomgrounds — Master Asset Plan (Higgsfield + Nano Banana Pro 2k)

**One file. Everything in it. Hand to Cowork (with Higgsfield MCP) all at once, or batch yourself.**

You have **two tools** inside Higgsfield:
- 🍌 **Nano Banana Pro 2k** with UNLIMITED toggle = FREE images (no credit cost)
- 🎬 **Higgsfield video models** = paid (uses your $300/yr plan credits)

**The smart play:**
- Use Nano Banana for **28 static images** that become moving via CSS animation (zero credits)
- Use Higgsfield video for **3 clips** that genuinely need real motion (Dragon roar + Landing loop + Dralingo mascot intro — ~$6 total)

Total cost: **~$6** out of your $300 plan. Platform gets the full visual overhaul.

---

# PART 1 — Strategic plan: Image-first, video only where needed

For each asset I list WHICH tool generates it, and (for images) what CSS animation I'll add when wiring it in so it feels alive.

| Surface | Tool | Why this choice |
|---|---|---|
| Landing page hero | 🎬 Video | Continuous loop motion (Dralingo wings + Mochi wave). Worth $2. |
| 8 EXP folder thumbnails | 🍌 Image + CSS Ken-Burns | Slow zoom on a beautiful painting = movie-poster feel. Free. |
| Templo backgrounds (dawn/dusk) | 🍌 Image + parallax layers | Multiple PNGs at different scroll speeds = depth. Free. |
| Templo dragon roar (S1) | 🎬 Video | Mouth opening + light burst = real animation needed. ~$2. |
| Dralingo mascot entrance | 🎬 Video | Star asset, deserves real animation. ~$2. |
| 7 other character intros | 🍌 Image (2 poses) + CSS sprite | Cycle 2 poses every 0.4s = looks animated. Free. |
| 8 game intro stills | 🍌 Image + CSS pan-zoom | Static painting + 3s reveal animation = cinematic. Free. |
| 6 Emirati culture stills | 🍌 Image + CSS slow zoom | Same Ken-Burns technique. Free. |

---

# PART 2 — Style guide (paste once, applies to ALL generations)

```
GLOBAL STYLE FOR DRALY WISDOMGROUNDS ASSETS:
- Style: Pixar 3D animation aesthetic, kid-friendly, warm Asian palette
- Colors: warm gold #ffd24a, jade green #5be88a, sky blue #5be8d1,
  Chinese red #c81e1e, cream parchment #fff5d8
- Character proportions: chibi (big heads, small bodies), big sparkly eyes
- Lighting: warm golden hour, soft shadows, rim-lit
- For images: cinematic painterly quality, no text overlays, no watermarks
- For videos: 24fps, 720p, gentle camera moves, no jump scares
- Audience: children 7-10 learning Chinese in Spanish

NEGATIVE FOR EVERY GENERATION:
"scary, violent, dark, gore, realistic photo, adult, text, watermark,
jump scare, fast cut, harsh lighting, western dragon use chinese dragon,
motion blur, deformed faces, extra limbs"
```

---

# PART 3 — Generation queue

For each asset: `TOOL` / `PROMPT` / `ASPECT` / `SAVE TO`. (Duration only for videos.)

---

## 🎬 VIDEO QUEUE (Higgsfield credits, ~$6 total)

Only **3 clips**. Generate these first. If even one looks bad, stop and tell me.

### V1. Dragon Victory Roar ⭐
- **TOOL**: 🎬 Higgsfield video (best Pixar 9:16 model — let MCP pick)
- **PROMPT**: Pixar-style golden Chinese dragon with jade scales and red flowing mane, long sinewy serpentine body NO WINGS, slow majestic head-turn toward camera, opens mouth wide letting golden light burst outward in rays, night sky with hanging red paper lanterns, pagoda silhouette in background, cherry blossom petals drifting, dramatic low-angle shot, warm rim lighting, chibi-friendly NOT scary
- **ASPECT**: 9:16 vertical
- **DURATION**: 5 seconds
- **SAVE TO**: `public/assets/cutscenes/daily/dragon-victory.mp4`

### V2. Landing-page hero loop
- **TOOL**: 🎬 Higgsfield video (seamless-loop capable)
- **PROMPT**: Pixar-style scene, baby blue chibi dragon wearing tiny white Emirati keffiyeh headdress next to a small smiling panda, both on a red Chinese arched bridge, sunset sky behind, paper lanterns hanging, the dragon flaps tiny wings gently while panda waves at camera, SEAMLESS LOOP (start matches end frame), warm golden hour
- **ASPECT**: 16:9 horizontal
- **DURATION**: 8 seconds (loops forever)
- **SAVE TO**: `public/assets/cutscenes/landing/hero-loop.mp4`

### V3. Dralingo mascot entrance
- **TOOL**: 🎬 Higgsfield video (alpha-channel preferred)
- **PROMPT**: Pixar-style baby blue chibi dragon wearing tiny white Emirati keffiyeh headdress, friendly chibi proportions with big sparkly eyes, soft smile, golden Chinese character 中 floats above its head, flaps tiny wings excitedly and waves at camera, transparent background OR chroma-key green (#00FF00) if alpha unavailable
- **ASPECT**: 9:16 vertical
- **DURATION**: 4 seconds
- **SAVE TO**: `public/assets/cutscenes/chars/dralingo-intro.webm`

---

## 🍌 IMAGE QUEUE (Nano Banana Pro 2k UNLIMITED — FREE)

**Before starting**: in Higgsfield's image tool, toggle ON the "Unlimited Nano Banana Pro 2k" button. Then crank these out.

All images are 2048×something resolution (Nano Banana's native 2k). I'll downscale when wiring in.

### Landing page support

### I1. Landing — fallback hero still (in case V2 fails)
- **PROMPT**: Pixar-style key art, baby blue chibi dragon with white Emirati keffiyeh next to smiling panda on red Chinese bridge, sunset, paper lanterns, golden hour, cinematic painterly quality
- **ASPECT**: 16:9
- **SAVE TO**: `public/assets/cutscenes/landing/hero-fallback.png`

### EXP folder thumbnails (8 images)
*CSS treatment after generation: each card slowly zooms in (Ken Burns) when in viewport.*

### I2. EXP1 La Familia
- **PROMPT**: Pixar key art of a chibi Chinese multi-generational family seated at a round red dim sum table — grandmother grandfather mother father son daughter — all smiling, red paper lanterns above, warm golden interior lighting, cinematic
- **ASPECT**: 16:9
- **SAVE TO**: `public/assets/cutscenes/exps/exp1.png`

### I3. EXP2 Saludos
- **PROMPT**: Pixar key art of three chibi Chinese students in school uniforms waving enthusiastically, schoolyard with cherry blossom trees, large 你好 calligraphy character floating in background like a banner, warm sunny lighting
- **ASPECT**: 16:9
- **SAVE TO**: `public/assets/cutscenes/exps/exp2.png`

### I4. EXP3 Lugares
- **PROMPT**: Pixar key art establishing shot of a Chinese street at dusk — a 饭馆 restaurant with bright red lanterns on left, a 商店 store with colorful signage in middle, a 学校 school with flagpole on right — chibi figures bustling about, warm street lighting, cinematic wide shot
- **ASPECT**: 16:9
- **SAVE TO**: `public/assets/cutscenes/exps/exp3.png`

### I5. EXP4 Tiempo
- **PROMPT**: Pixar surreal dreamy key art, a giant floating paper Chinese calendar with pages drifting off in the wind, a vintage wall clock in foreground, sun rising in left side and moon setting in right side, glowing calligraphy 今天 in center, magical mood
- **ASPECT**: 16:9
- **SAVE TO**: `public/assets/cutscenes/exps/exp4.png`

### I6. EXP5 Movimiento
- **PROMPT**: Pixar key art, three chibi versions of the same character on a clean light blue background showing three actions — walking left labeled 去 qù, walking right labeled 回 huí, walking toward camera labeled 来 lái — gentle Chinese ink wash arrows trail behind each, tutorial-friendly clarity
- **ASPECT**: 16:9
- **SAVE TO**: `public/assets/cutscenes/exps/exp5.png`

### I7. EXP6 Cosas
- **PROMPT**: Pixar key art of a magical Chinese-style living room, household objects floating in a gentle orbit — small TV 电视, laptop 电脑, wooden table 桌子, chair 椅子, folded clothes 衣服 — golden particles around each, warm interior light, enchanted-house mood
- **ASPECT**: 16:9
- **SAVE TO**: `public/assets/cutscenes/exps/exp6.png`

### I8. EXP7 Preguntas
- **PROMPT**: Pixar key art of a chibi child character with curious head-tilt and finger to chin, large thought bubbles popping up around them each containing a glowing Chinese question character 谁 什么 怎么 几, soft puzzle-mystery purple lighting
- **ASPECT**: 16:9
- **SAVE TO**: `public/assets/cutscenes/exps/exp7.png`

### I9. EXP8 Números
- **PROMPT**: Pixar key art celebration scene, Chinese number characters 一 二 三 四 五 floating up like helium balloons from the ground, chibi character with arms raised catching them, golden confetti and small fireworks bursting, joyful golden hour
- **ASPECT**: 16:9
- **SAVE TO**: `public/assets/cutscenes/exps/exp8.png`

### Templo del Dragón backgrounds (4 layers each = 8 images)

*CSS treatment: each layer scrolls at different speed = parallax depth.*

### I10. Templo Dawn — sky layer
- **PROMPT**: Pink and gold dawn sky with soft drifting clouds, no land elements, full frame painterly Chinese watercolor style
- **ASPECT**: 9:16
- **SAVE TO**: `public/assets/cutscenes/temple/dawn-sky.png`

### I11. Templo Dawn — mountains layer
- **PROMPT**: Distant Chinese mountains in jade green silhouette with morning mist around bases, transparent PNG above the mountain line, painterly
- **ASPECT**: 9:16
- **SAVE TO**: `public/assets/cutscenes/temple/dawn-mountains.png`

### I12. Templo Dawn — pagoda layer
- **PROMPT**: A multi-tiered Chinese pagoda silhouette at sunrise, sitting on a hill, glowing red lanterns hanging from each roof, transparent PNG background
- **ASPECT**: 9:16
- **SAVE TO**: `public/assets/cutscenes/temple/dawn-pagoda.png`

### I13. Templo Dusk — sky layer
- **PROMPT**: Twilight sky purple to deep blue gradient, scattered stars beginning to appear, full frame painterly Chinese watercolor
- **ASPECT**: 9:16
- **SAVE TO**: `public/assets/cutscenes/temple/dusk-sky.png`

### I14. Templo Dusk — mountains layer
- **PROMPT**: Distant Chinese mountains in deep purple silhouette at dusk with firefly specks floating, transparent PNG above mountain line, painterly
- **ASPECT**: 9:16
- **SAVE TO**: `public/assets/cutscenes/temple/dusk-mountains.png`

### I15. Templo Dusk — pagoda layer
- **PROMPT**: Same Chinese pagoda silhouette at twilight, all the red lanterns now lit and glowing brightly, transparent PNG background
- **ASPECT**: 9:16
- **SAVE TO**: `public/assets/cutscenes/temple/dusk-pagoda.png`

### Character intros — 2 poses each, sprite-cycled (14 images = 7 characters × 2 poses)

*CSS treatment: alternates between the two PNGs every 0.4 seconds + slide-in from edge. Looks animated.*

### I16-17. Gojo (Pose A: walking in / Pose B: snap-finger pose)
- **PROMPT A**: Anime character Gojo Satoru from JJK chibi style, walking forward casually with hands in pockets, dark blindfold over eyes, white spiky hair, dark blue uniform, transparent PNG
- **PROMPT B**: Same Gojo chibi, now in mid-finger-snap pose, blue glowing infinity shockwave radiating outward from his hand, transparent PNG
- **SAVE TO**: `public/assets/cutscenes/chars/gojo-a.png` + `public/assets/cutscenes/chars/gojo-b.png`

### I18-19. Yuji (Pose A: running in / Pose B: fist-up grin)
- **PROMPT A**: Yuji Itadori from JJK chibi style, mid-run pose with one foot forward, school uniform, pink spiky hair, friendly look, transparent PNG
- **PROMPT B**: Same Yuji chibi, now in heroic fist-raised pose with big grin, pink cherry blossom petals swirling behind, transparent PNG
- **SAVE TO**: `public/assets/cutscenes/chars/yuji-a.png` + `public/assets/cutscenes/chars/yuji-b.png`

### I20-21. Shelly (Pose A: lowered gun walk / Pose B: finger-gun wink)
- **PROMPT A**: Shelly from Brawl Stars chibi style, walking in with shotgun lowered casually across her shoulders, pink pigtails, transparent PNG
- **PROMPT B**: Same Shelly chibi, now in playful finger-gun pose with one eye winked, sparkles around her hand, transparent PNG
- **SAVE TO**: `public/assets/cutscenes/chars/shelly-a.png` + `public/assets/cutscenes/chars/shelly-b.png`

### I22-23. FNAF Freddy (kid-friendly Pose A: standing / Pose B: waving)
- **PROMPT A**: Friendly brown animatronic teddy bear chibi style with top hat, kid-friendly smiling purple eyes (NOT SCARY), standing pose, pizza arcade neon glow behind, transparent PNG
- **PROMPT B**: Same Freddy chibi, now waving at camera with raised paw, big friendly smile, transparent PNG
- **SAVE TO**: `public/assets/cutscenes/chars/fnaf-a.png` + `public/assets/cutscenes/chars/fnaf-b.png`

### I24-25. Dandy (Pose A: standing tall / Pose B: bow)
- **PROMPT A**: Tall friendly flower-headed mascot character (yellow petal head, green stem body) standing tall in greeting pose, transparent PNG
- **PROMPT B**: Same Dandy character now in polite bowing pose with head tilted down, transparent PNG
- **SAVE TO**: `public/assets/cutscenes/chars/dandy-a.png` + `public/assets/cutscenes/chars/dandy-b.png`

### I26-27. Anime warrior (generic) — A katana ready / B spin slash
- **PROMPT A**: Chibi anime warrior with traditional Asian samurai armor and cherry blossom katana, ready stance, transparent PNG
- **PROMPT B**: Same warrior now mid-spin-slash with petals trailing his blade in an arc, transparent PNG
- **SAVE TO**: `public/assets/cutscenes/chars/anime1-a.png` + `public/assets/cutscenes/chars/anime1-b.png`

### I28-29. Anime mage (generic) — A staff ready / B casting spell
- **PROMPT A**: Chibi anime mage girl with long flowing robes and magical wooden staff, calm ready pose, transparent PNG
- **PROMPT B**: Same mage now mid-cast, glowing pinyin characters orbiting her staff in a magical circle, transparent PNG
- **SAVE TO**: `public/assets/cutscenes/chars/anime2-a.png` + `public/assets/cutscenes/chars/anime2-b.png`

### Game intro stills (8 images)
*CSS treatment: pan-and-zoom for 3 seconds then fade to lobby. Movie-poster reveal.*

### I30. Triage ER intro
- **PROMPT**: Pixar key art of a friendly ambulance with red flashing lights parked outside glass hospital double doors, chibi medics pushing a gurney through, warm hospital interior glow, red 急诊 "TRIAGE" Chinese title carved into a stone plaque in foreground, urgent but kid-friendly
- **ASPECT**: 16:9
- **SAVE TO**: `public/assets/cutscenes/games/triage-intro.png`

### I31. LQH Dragon Courier
- **PROMPT**: Pixar key art wide shot of a chibi Chinese dragon courier flying low across green rolling hills carrying a red envelope 红包 in its mouth, mailboxes labeled qù lái huí visible below, motion-streak trail behind the dragon, joyful adventure
- **ASPECT**: 16:9
- **SAVE TO**: `public/assets/cutscenes/games/lqh-intro.png`

### I32. Conquest
- **PROMPT**: Pixar key art of red sand dunes at golden hour, two opposing chibi horseback armies facing each other across a valley with colorful war banners, "CONQUEST 征服" title carved in a sandstone tablet in foreground, kid-friendly NOT scary
- **ASPECT**: 16:9
- **SAVE TO**: `public/assets/cutscenes/games/conquest-intro.png`

### I33. Hongbao Run
- **PROMPT**: Pixar key art of a Mario-Party-style colorful 3D board game perspective with giant dice mid-roll, red envelopes 红包 flying like confetti in the air, festive Chinese new year lanterns swinging, gold coins sparkling, joyful party energy
- **ASPECT**: 16:9
- **SAVE TO**: `public/assets/cutscenes/games/hongbao-intro.png`

### I34. Identity Detective
- **PROMPT**: Pixar key art close-up of a magnifying glass hovering over a row of chibi Chinese face cards, cards mid-flip on their own, red ink-brush calligraphy "谁是?" title (who is?) above, mystery tone but warm kid-friendly
- **ASPECT**: 16:9
- **SAVE TO**: `public/assets/cutscenes/games/identity-intro.png`

### I35. 6-7 Math
- **PROMPT**: Pixar key art of a chibi character swinging on a trapeze between two giant glowing Chinese number characters 六 (6) and 七 (7), colorful math symbols + - × ÷ sparkling around, festive playground energy, warm bright lighting
- **ASPECT**: 16:9
- **SAVE TO**: `public/assets/cutscenes/games/sixseven-intro.png`

### I36. Reading Mode
- **PROMPT**: Pixar key art of an old Chinese folktale book floating open in mid-air on a wooden table, glowing dragon and characters lifting off the pages in soft 3D light, golden magical particles drifting up, storytime warmth
- **ASPECT**: 16:9
- **SAVE TO**: `public/assets/cutscenes/games/reading-intro.png`

### I37. Warmup Builder
- **PROMPT**: Pixar key art of Chinese chess pieces 棋 arranged in a row on a wooden table forming a sentence, each chip glowing softly, ink calligraphy swirls in background, focused-learning warm aesthetic
- **ASPECT**: 16:9
- **SAVE TO**: `public/assets/cutscenes/games/warmup-intro.png`

### Emirati culture stills (6 images)
*CSS treatment: gentle 5s zoom-in when section opens.*

### I38. Greetings
- **PROMPT**: Two Emirati men in traditional white kandura robes warmly embracing exchanging three cheek kisses (traditional UAE greeting), sand-colored majlis interior with patterned cushions, golden hour light through window, painterly respectful tone
- **ASPECT**: 16:9
- **SAVE TO**: `public/assets/cutscenes/emirati/greet.png`

### I39. Family
- **PROMPT**: Emirati family majlis scene, grandfather in white kandura with father and son in matching dress, sitting cross-legged on patterned cushions sharing Arabic coffee from a gold dallah pot, gentle smiles, warm interior lighting
- **ASPECT**: 16:9
- **SAVE TO**: `public/assets/cutscenes/emirati/family.png`

### I40. Food
- **PROMPT**: Close-up still life of Arabic coffee being poured from a tall gold dallah pot into a small handle-less cup (finjan), plates of medjool dates and golden luqaimat dumplings drizzled with date syrup nearby on a wooden tray, golden hour
- **ASPECT**: 16:9
- **SAVE TO**: `public/assets/cutscenes/emirati/food.png`

### I41. Home / Places
- **PROMPT**: Wide establishing shot showing a traditional Emirati wind-tower house in Al Bastakiya old Dubai in foreground, modern Burj Khalifa skyline visible in distance, sand-tone to glass-tower contrast, golden hour painterly
- **ASPECT**: 16:9
- **SAVE TO**: `public/assets/cutscenes/emirati/home.png`

### I42. Transport
- **PROMPT**: Caravan of three camels with riders crossing red sand dunes of Liwa desert at sunset, long shadows, peaceful slow pace, cinematic wide shot painterly
- **ASPECT**: 16:9
- **SAVE TO**: `public/assets/cutscenes/emirati/transport.png`

### I43. Culture (falconry)
- **PROMPT**: Cinematic shot of a falcon launching from a falconer's gloved hand wearing traditional Emirati attire, the bird soars upward toward Dubai skyline visible in background, Emirati flag waving in foreground, majestic patriotic warm tone
- **ASPECT**: 16:9
- **SAVE TO**: `public/assets/cutscenes/emirati/culture.png`

---

# PART 4 — How to actually use this in Cowork (simple version)

## Recommended workflow: 2 batches

### Batch A: VIDEOS FIRST (~$6, ~15 min wall time)

In Cowork (with Higgsfield MCP attached), paste this single message:

```
I have a project with PLATFORM_ASSETS_MASTER.md in it. Generate ONLY
the 3 VIDEO clips from that file (V1 Dragon Victory, V2 Landing Loop,
V3 Dralingo Intro). Use the EXACT prompts from the file.

Workflow:
1. Run mcp__higgsfield__balance and tell me my Higgsfield credit balance.
2. Run mcp__higgsfield__models_explore and pick the best video model
   for Pixar 9:16 short clips. Tell me which one.
3. Generate V1 first. Show me the preview URL. WAIT for my approval.
4. After my OK, generate V2 and V3.
5. Save each MP4/WebM to the local file path in the SAVE TO field.
6. Stop after all 3 videos. Report total credits spent.

Constraints:
- Apply the negative prompt from PART 2 to every generation.
- If V1 fails twice, stop and ask me before continuing.
```

### Batch B: IMAGES (FREE — unlimited, ~30 min wall time)

In the same Cowork session (or a new one):

```
Now toggle ON the Unlimited Nano Banana Pro 2k mode. Then generate
ALL the IMAGE assets from PLATFORM_ASSETS_MASTER.md (I1 through I43).
Use the EXACT prompts. Apply the PART 2 negative prompt.

Save each PNG to the local file path in the SAVE TO field.

For the parallax temple layers (I11, I12, I14, I15), make sure the
backgrounds are TRANSPARENT (PNG with alpha channel).

For the character poses (I16-I29), make sure characters are on
TRANSPARENT background (PNG with alpha) so I can layer them.

If any image has scary/violent elements, REJECT and regenerate.
Report when all 43 images are done.
```

## After Cowork is done

Drag the MP4s and PNGs into your local repo at the paths shown in each SAVE TO field. Then come back to me in Claude Code and say:

> *"Assets landed. Wire everything in."*

I'll:
- Replace the dragon emoji in homework.js with V1 video
- Replace landing PNG with V2 video loop
- Add V3 to the Dralingo character entrance flow
- Wire 8 EXP folder images with CSS Ken Burns zoom
- Wire 6 Emirati section images with section-open zoom
- Wire 8 game-intro images with pan-zoom curtain
- Wire 14 character pose pairs as sprite cycles
- Wire 6 temple parallax layers with depth scroll
- Bump cache, commit, deploy

---

# PART 5 — Cost & time summary

| Batch | Assets | Tool | Cost | Time |
|---|---|---|---|---|
| Videos | 3 | 🎬 Higgsfield credits | ~$6 | ~15 min |
| Images | 43 | 🍌 Nano Banana (unlimited) | FREE | ~30 min |
| **TOTAL** | **46** | | **~$6** | **~45 min** |

You'll have spent ~2% of your $300 plan and transformed the platform's visual identity. The remaining 98% of your plan stays available for future video assets (story-mode page animations, more character intros, seasonal events).

---

**TL;DR**: Generate 3 videos first (~$6). Generate 43 images on Unlimited Nano Banana (free). Drag files into the repo. I plug everything in. Total cost: ~$6.
