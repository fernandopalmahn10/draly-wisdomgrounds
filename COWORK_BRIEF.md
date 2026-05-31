# 🤝 Cowork: Just Copy & Paste This Whole Block

Cowork-Claude can't read your repo files unless you connect them. So instead, here's a self-contained message that has the spec INLINE. Paste it as-is. Cowork has everything it needs.

---

## ✂️ COPY EVERYTHING BETWEEN THE LINES BELOW

---

```
Hi! I want to generate ONE test video clip using Higgsfield MCP for my
kids' Chinese-learning platform. Here are the exact specs — you don't
need to read any files, everything you need is below.

TEST CLIP: "Templo del Dragón — Victory Roar"

Prompt:
"Pixar-style golden Chinese dragon, jade scales, red mane, slow majestic
head-turn toward camera, then roars open mouth with golden light bursting
out, night sky with hanging red lanterns and pagoda silhouette in
background, cherry blossom petals floating, dramatic low angle, warm
golden-hour lighting, kid-friendly chibi proportions, NOT scary"

Negative prompt: "western dragon, wings, scary, violent, dark, gore,
realistic photo, adult, text, watermark"

Aspect ratio: 9:16 (vertical, for mobile phone screens)
Duration: 5 seconds
Resolution: 720p
Style: 3D animation, Pixar look, warm colors
Audio: muted (no soundtrack)
Reference image: not needed for this clip
Output: MP4

WORKFLOW:
1. Run mcp__higgsfield__balance and tell me my Higgsfield credit balance.
2. Run mcp__higgsfield__models_explore and pick the best model for a
   short 9:16 Pixar-style video. Tell me which model and why.
3. Generate the clip using mcp__higgsfield__generate_video with the
   prompt above. Use the model you picked.
4. When the generation completes, show me the preview URL.
5. WAIT for me to say "YES, save it" or "NO, regenerate with these
   changes: ..."
6. If YES, download the MP4 and save the file. I'll tell you where to
   save it in my next message after I see the preview.

BUDGET RULE: STOP after this ONE clip. Do not generate anything else
without my permission. If the balance is under $10, ask me before
generating at all.

Ready? Start with step 1.
```

---

## 🔁 What happens next

1. Cowork shows you the clip preview URL.
2. **If you like it**, reply in Cowork:
   > *"YES, save it. Save the file as `dragon-victory.mp4` somewhere I can download it. Then stop."*

   Cowork will download the MP4 to its local environment. You then download it from there.

3. **If you don't like it**, reply with what to change:
   > *"NO, the dragon should be more chibi/cuter, less menacing teeth"*

   Cowork regenerates with your tweak.

4. **When you have the MP4 file**, switch back to me (Claude Code in this repo) and say:
   > *"Cowork generated the dragon clip. Here it is."*
   
   Then drag-and-drop or upload the MP4. I'll save it to `public/assets/cutscenes/daily/dragon-victory.mp4`, wire it into the daily game's victory moment, bump cache, and deploy. Then you'll see it live.

---

## 📜 If you want to generate MORE clips after the test

Once the first clip is working, come back to me and I'll give you the next paste-ready message — one for each clip you want, with the prompt and target file path filled in. We do them **one at a time** so you stay in control.

If you want the full list of clips I think would have the biggest impact, just ask: *"give me the next 3 clips to generate"* and I'll write three more paste-ready blocks like the one above.

---

## ⚠️ Common Cowork issues

- **"I can't access your repo"** → That's fine, this prompt has everything inline. Just paste it as-is.
- **"What model should I use?"** → Step 2 of the prompt asks Cowork to pick one and explain. If unsure, suggest *"Higgsfield Soul"* (their best 9:16 cinematic model).
- **"What aspect ratio?"** → 9:16 (vertical) — it's in the prompt.
- **"Should I generate more?"** → NO. Stop after the first clip. The budget rule is in the prompt.
