# 🤝 Cowork-Claude Handoff Brief — Higgsfield asset generation

This file contains a paste-ready prompt for a Cowork session that has
**Higgsfield MCP attached**. The handoff Claude will read `HIGGSFIELD_ASSETS.md`
in the same repo for full specs.

---

## 📋 PASTE THIS INTO COWORK

```
Hello! You are helping me generate cinematic assets for my kids' Chinese-learning
platform (Draly Wisdomgrounds) via Higgsfield MCP. Your job is to translate the
detailed shopping list at HIGGSFIELD_ASSETS.md (in this repo root) into actual
generated MP4/WebM files saved into public/assets/cutscenes/.

CONTEXT (one paragraph):
Draly Wisdomgrounds is a real-time multiplayer HSK1 Chinese-learning platform
for Spanish-speaking kids aged 7-10 in Honduras and beyond. It's deployed to
Render at https://draly-wisdomgrounds-2.onrender.com. The platform has 8
experience folders (HSK1 EXP1-EXP8), a daily challenge mode called "Templo
del Dragón", several party games (Triage ER, LQH Dragon Courier, Conquest,
Hongbao Run, Identity Detective, 6-7 Math, Reading), and a side Emirati Arabic
gateway for the platform owner. The visual style is Pixar-3D-meets-Chinese-
aesthetic: warm gold + jade + Chinese red palette, friendly chibi proportions,
NO scary or violent imagery (it's for young kids).

YOUR WORKFLOW (do these in order, ask before deviating):

1. FIRST: read HIGGSFIELD_ASSETS.md in the repo root. That file has the full
   spec for every asset, organized in 5 tiers. Each asset has: exact prompt,
   aspect ratio, duration, target file path, and integration scope.

2. SECOND: call mcp__higgsfield__balance to check remaining credits. Tell me
   the number before generating anything.

3. THIRD: call mcp__higgsfield__models_explore to confirm which model handles
   our needs best. Specifically check:
     - Alpha-channel (transparent background) support — needed for the 8
       character entrance animations in Tier 1
     - 9:16 vertical aspect ratio — needed for the dragon victory clip
     - Loop-ready output — needed for the landing-page hero
   Tell me which model you'll use and why.

4. FOURTH: generate ONE test clip first — Tier 1.1 (Dragon Victory roar).
   Show me the URL/preview so I can confirm the art style is right BEFORE
   you batch-generate. Use the EXACT prompt from HIGGSFIELD_ASSETS.md line
   1.1. Aspect ratio 9:16, duration 5s.

5. ONCE I APPROVE the test clip:
     a. Download the MP4 from Higgsfield
     b. Save to: public/assets/cutscenes/daily/dragon-victory.mp4
     c. Run a quick `git status` to confirm the file landed
     d. Commit with message: "asset: tier 1.1 dragon victory cutscene (Higgsfield)"
     e. Move to the next asset in Tier 1

6. PROCEED TIER 1 TOP-DOWN. After each clip:
     - Save to the exact path in the spec
     - Commit with: "asset: tier <X.Y> <name> (Higgsfield)"
     - Update HIGGSFIELD_ASSETS.md to mark that row [DONE]
     - Tell me the current spend / remaining budget

7. STOP AND ASK ME between tiers. Don't roll into Tier 2 without my OK.

CONSTRAINTS:
  - Style: Pixar 3D with warm-Asian color grade. Warm gold (#ffd24a), jade
    (#5be88a), Dralingo blue (#5be8d1), Chinese red (#c81e1e). Soft lighting.
    NEVER scary, NEVER violent, NEVER any flash-photography effects.
  - Faces: kid-friendly chibi proportions, big eyes, friendly smiles.
  - For Dralingo (clip 1.7): use public/assets/dralingo.png as the character
    reference — Higgsfield's char-lock option should clamp to this design.
  - Audio: muted (no sound track) — clips will play with platform's own
    sound effects underneath.
  - Resolution: 720p is fine; don't pay for 1080p.
  - Duration: respect the spec exactly. Each second over-generates cost.

BLOCKING TASKS (ask me before continuing if any of these happen):
  - Balance is below $20 → stop, ask before any further generation
  - Generation fails 3 times for the same clip → stop, show me the error
  - Higgsfield returns a clip I should pre-approve (anything in chars/ or
    Dralingo/dragon — recognizable IPs/mascots)
  - Any MP4 over 5MB after generation — re-encode or regenerate at lower bitrate

DELIVERABLES per asset (concrete checklist):
  [ ] Generated via Higgsfield MCP using the EXACT prompt from spec
  [ ] Downloaded to disk at the EXACT target path
  [ ] Committed with a clear message including tier number
  [ ] HIGGSFIELD_ASSETS.md row marked [DONE]
  [ ] No regressions (run `git diff --stat HEAD~1` to verify)

When all of Tier 1 is done, ping me. I'll review the assets in the live
platform (you can run /verify if you want to verify they load), then we'll
decide whether to proceed to Tier 2 or pause.

If anything is ambiguous, ASK. Don't guess. The assets are lifetime — a bad
generation costs real money, but a wrong generation forces an explicit
re-generation. I'd rather you ask one clarifying question than burn a credit.

Ready? Start with step 1: read HIGGSFIELD_ASSETS.md and report what you see.
```

---

## 📦 What you (the human) do before pasting

1. **Confirm your Higgsfield plan tier**. Check `higgsfield.com/account`. If your $300/year plan is the **Creator** tier (web UI only, no API), the MCP probably can't talk to your account — you'll need to upgrade or generate manually. If it's **API/Pro/Enterprise**, you're good.

2. **Add your Higgsfield credentials to Cowork** so the MCP can authenticate. Usually this is an API key in the Cowork integration settings.

3. **Confirm the model you want** if you have a preference (e.g., "use Higgsfield's Mage v2 not Soul"). Otherwise the handoff Claude will pick one and explain why.

4. **Decide the budget cap for the first session**. The brief says "stop if balance < $20" — adjust if you want a different threshold.

---

## 🔄 Loop back to me after Cowork is done

When the Cowork session finishes, the assets will be in `public/assets/cutscenes/`. Open this repo back in our normal Claude Code session and tell me:

> *"Cowork finished Tier 1. Wire the assets in."*

I'll then:
- Read the manifest of what was generated
- Update homework.js to swap the CSS dragon emoji for `<video>` in `finishTemple()`
- Update DAILY_CHARS to add `videoIntro: ...` paths
- Wire the landing-page hero to use the new loop
- Bump cache-bust + commit + deploy

The whole flow stays at well under 1 hour of session time per tier.

---

## ❓ Quick FAQ for the handoff Claude

**Q: What if Higgsfield doesn't support transparent backgrounds?**
A: Generate on a chroma-key green (#00FF00) background and note it in the commit message. I'll chroma-key the green out at render time using the same canvas flood-fill we already use for the 67.png mascot.

**Q: What if the dragon model looks too Western (Smaug-style)?**
A: The spec says "Chinese dragon" — long sinewy body, no wings, jade scales, red mane, antlers. If the first attempt comes out wrong, add "traditional Chinese dragon NOT Western dragon, long snake-like body, no wings, golden whiskers" to the negative prompt or re-prompt.

**Q: What if a kid asks "is this AI?"**
A: Doesn't matter — these are static lifetime assets. Just label them appropriately. Future-proof: add a "Powered by Higgsfield" credit somewhere in the about page if you want full transparency.

**Q: How big should each clip be?**
A: 1–2 MB ideal. 3 MB max. The full Tier 1 (14 clips) should total around 25–35 MB on disk — well within Render's free 10 GB disk plus they're git-tracked (small enough to commit).
