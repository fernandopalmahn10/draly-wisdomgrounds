# 🥮 Mochi Mash

Real-time team quiz battle. **Red Panda 🐼 vs Kitsune 🦊.** Players answer questions; correct answers unlock a 5-second tap-frenzy that feeds dumplings to their team's spirit creature. Loudest team wins.

Inspired by Kahoot and Gimkit — but team-based, with live host control over rosters, mid-game team-swapping, and a single cohesive bamboo-forest theme instead of cluttered gadgets.

---

## Quick Start (local play)

You need [Node.js 18+](https://nodejs.org/).

```bash
cd mochi-mash
npm install
npm start
```

Open **http://localhost:3000** in your browser. Click **Host a Battle**, upload `questions.csv`, and the PIN appears on screen.

For other devices on the same Wi-Fi, find your computer's local IP (e.g., `192.168.1.50`) and have players visit `http://192.168.1.50:3000`.

---

## How to play

**Host:**
1. Click **Host a Battle** — get a 6-digit PIN.
2. Upload a CSV (`question, correct, wrong1, wrong2, wrong3` — see `questions.csv` for an example).
3. Set duration (30s–5min).
4. Wait for players to join. As they appear, **tap a player chip to swap their team**, or **Auto-balance** to split evenly.
5. Click **Start Battle**.

**Players:**
1. Open the host's URL (or scan the PIN).
2. Type the PIN and a name → joins automatically to the smaller team.
3. **Answer questions on your own pace** (no waiting for slowpokes — Gimkit-style continuous flow).
4. Right answer → **MASH MODE** for 5 seconds: tap the giant button as fast as possible. Each tap = 1 dumpling fed to your team. 8+ taps/second = 2× combo multiplier.
5. Wrong answer → enemy team gets +3 dumplings. Sad bonk sound.
6. When the timer hits zero → confetti, gong, leaderboard.

---

## Sharing with players over the internet

The local URL only works on the same Wi-Fi. For phones on cell data or remote players, pick one:

### Option A — Cloudflare Tunnel (free, no signup, runs on demand)

Best for "I'm hosting tonight, my laptop is on, want a quick public URL."

```bash
# Install once (Windows)
winget install --id Cloudflare.cloudflared

# Each session, in a second terminal alongside `npm start`:
cloudflared tunnel --url http://localhost:3000
```

It prints a public URL like `https://random-words.trycloudflare.com`. Share that.

### Option B — Render (free, always-on)

Best for "I want a permanent URL my friends can hit anytime."

1. Push this folder to a GitHub repo (free private repo is fine).
2. Go to [render.com](https://render.com), sign up (no credit card).
3. **New → Web Service** → connect your GitHub repo.
4. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** Free
5. Deploy. You get a URL like `mochi-mash.onrender.com`.

⚠️ Free tier sleeps after 15min idle — first visitor waits ~30s for cold start. After that it's snappy. Pro tip: open the URL yourself a minute before your party starts to wake it.

---

## File structure

```
mochi-mash/
├── server.js          # Node + Socket.IO real-time server
├── package.json
├── questions.csv      # Sample question pack
├── public/
│   ├── index.html     # Landing (host or join)
│   ├── host.html      # Host dashboard
│   ├── player.html    # Player UI
│   ├── css/styles.css
│   └── js/
│       ├── sounds.js  # Web Audio API sound synthesis
│       ├── host.js
│       └── player.js
└── README.md
```

All sounds are synthesized in the browser via Web Audio — no audio assets to host.

---

## Question CSV format

```csv
question,correct,wrong1,wrong2,wrong3
What is the capital of Japan?,Tokyo,Kyoto,Osaka,Seoul
```

- Header row optional (auto-detected).
- 3 to 4 answer columns supported (1 correct + 2-3 wrong).
- Quote fields with commas: `"Hello, world",greeting,...`

---

## Tweakable game knobs

In `server.js`:

| Constant | Default | What it does |
|---|---|---|
| `MASH_DURATION_MS` | 5000 | How long mash mode lasts after a correct answer |
| `TAP_MIN_INTERVAL_MS` | 70 | Anti-autoclicker rate limit (~14 taps/sec max) |
| `COMBO_THRESHOLD` | 8 | Taps in 1 second to trigger 2× combo |
| `WRONG_PENALTY` | 3 | Dumplings awarded to enemy on wrong answer |
| `COUNTDOWN_MS` | 3500 | Pre-round 3-2-1 countdown length |

Restart the server after edits.

---

## Player capacity

Tested comfortably with 30 players on the Render free tier. Should handle 50+ on a paid tier or local network.
