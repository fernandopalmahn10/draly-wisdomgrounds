# 🤝 Cowork — super simple instructions

## What you do (2 minutes):

1. **Open Cowork** (claude.ai with Cowork mode + Higgsfield MCP enabled).
2. **Copy this whole project into Cowork** so it can read the files.
3. **Paste the message below** (between the dashes) into Cowork chat.
4. **Wait** for Cowork-Claude to ask you a question.
5. **Answer yes/no** to each clip preview.

That's it. Cowork handles everything else.

---

## 📋 THE MESSAGE TO PASTE INTO COWORK

Copy everything between the two lines below and paste as your first message:

---

```
Hi! I want you to generate video assets for my kids' Chinese-learning
platform using the Higgsfield MCP. The full shopping list (40+ clips
with exact prompts, file paths, and target sizes) is in this repo at
HIGGSFIELD_ASSETS.md.

Please do this:

1. Read HIGGSFIELD_ASSETS.md so you have the full specs.
2. Run mcp__higgsfield__balance to check my Higgsfield credit balance.
   Tell me the number.
3. Generate ONE test clip: Tier 1.1 (the Dragon Victory roar). Use the
   EXACT prompt from the spec. Show me the result URL when done.
4. WAIT FOR ME TO SAY YES OR NO before generating anything else.
5. If I say YES, save the MP4 to public/assets/cutscenes/daily/dragon-victory.mp4,
   commit with the message "asset: tier 1.1 dragon victory", then move to
   the next clip in Tier 1 and repeat.
6. After Tier 1 (14 clips), STOP and ask me before doing Tier 2.

Constraints: kid-friendly (NO scary/violent), Pixar 3D style, warm
colors (gold, jade, Chinese red). Resolution 720p. Each clip ≤ 3 MB.

If anything is unclear, ASK ME. Don't guess.

Start now: read HIGGSFIELD_ASSETS.md and tell me what you see.
```

---

## 🔄 When Cowork finishes

When Cowork-Claude tells you it's done with Tier 1 (or any tier), come back to **this Claude Code session** and tell me:

> *"Cowork finished. Wire the assets in."*

I'll plug them into the platform (replace static PNGs with `<video>` tags, etc.), bump cache version, and deploy. Each tier takes me about 10-15 minutes to wire after the files land.

---

## ❓ If Cowork-Claude gets confused

Just tell it: *"Read HIGGSFIELD_ASSETS.md in the repo and follow the steps in COWORK_BRIEF.md."*

The two files together have everything needed.

---

## 💰 Budget protection

Cowork-Claude will:
- Check your balance before generating
- Generate ONE test clip first (Tier 1.1, ~$1-3)
- Stop and ask you before continuing
- Commit each asset individually (so you can roll back any single one)
- Stop between tiers and ask before continuing

If at any point you want to pause: just type "STOP" in Cowork chat. No money lost.
