# 🛡 DRALY SECURITY — DO THIS, DO THAT

A simple list. Top to bottom. Do them in order.

If you only have 30 minutes, do **Part 1**. That alone stops 95% of bad stuff.

---

## ✅ ALREADY DONE IN CODE (no action needed)

Server-side hardening shipped 2026-06-06:

- ✅ **No more `draly2026` fallback password.** Server reads `WU_ADMIN_PASSWORD`
  from env. If missing or <12 chars in production, the process refuses to
  start (clear FATAL log line on Render).
- ✅ **`POST /api/sets` and `DELETE /api/sets/:id` now require admin auth.**
  Previously anyone on the internet could upload xlsx (which has a known
  prototype-pollution CVE) or delete teacher sets.
- ✅ **Rate limiting** on `/api/admin/*` (30 req/min/IP) and uploads
  (12/min/IP). Belt-and-suspenders for the case where Cloudflare WAF
  isn't yet deployed or someone hits the `.onrender.com` origin directly.
- ✅ **`trust proxy`** set so rate limiter sees real client IPs, not
  Render's internal 10.x.
- ✅ **`.gitignore` audit passes** — `.render-token`, `cloudflared.exe`,
  `.env*`, `*-credentials.json`, `*service-account*.json`, and every
  PII-bearing file in `data/` is gitignored. Nothing secret is tracked.
- ✅ **Backup script** at `scripts/backup-disk.ps1` — automates the
  Friday tarball ritual (auto-fetches via render CLI if installed,
  otherwise prints exact commands to paste).

What still needs YOU to click in dashboards: Parts 1–4 below.

---

## PART 1 — CLOUDFLARE (do this first, takes 30 min)

### 1. Buy a domain
- Go to **dash.cloudflare.com**
- Sign up (free, use your normal email)
- Click **"Register a domain"**
- Buy `dralingo.app` (or `draly.app`, whatever)
- Cost: ~$11/year. Pay with card.
- **Done.**

### 2. Add the domain to Cloudflare
- Cloudflare auto-adds it because you registered through them.
- If not: dashboard → **"Add a Site"** → type the domain → click **Free plan**.
- **Done.**

### 3. Point the domain at Render
- Go to **dashboard.render.com** → your service → **Settings** → **Custom Domains** → **Add Custom Domain**
- Type `app.dralingo.app`
- Render shows you a target like `draly-wisdomgrounds-2.onrender.com`. **Copy it.**
- Go back to Cloudflare → your domain → **DNS** → **Add record**:
  - Type: **CNAME**
  - Name: **app**
  - Target: paste the Render thing
  - Proxy status: **ORANGE CLOUD (proxied)** ← important
- Click **Save**.
- **Done.**

### 4. Force HTTPS
- Cloudflare → your domain → **SSL/TLS** → **Overview**
- Click **"Full (strict)"**
- Go to **Edge Certificates** tab
- Turn ON: **Always Use HTTPS**
- Turn ON: **Automatic HTTPS Rewrites**
- Minimum TLS Version: **TLS 1.2**
- **Done.**

### 5. Turn on bot protection
- Cloudflare → your domain → **Security** → **Settings**
- Security Level: **High**
- Bot Fight Mode: **ON**
- Browser Integrity Check: **ON**
- **Done.**

### 6. Block password guessers
- Cloudflare → your domain → **Security** → **WAF** → **Rate limiting rules** → **Create rule**
- Name: `Admin password brute-force`
- "If incoming requests match…"
  - Field: **URI Path** → Operator: **contains** → Value: `/api/admin/`
- "When rate exceeds…"
  - Requests: **20**
  - Period: **1 minute**
- "Then take action…"
  - **Block** for **10 minutes**
- Click **Deploy**.
- **Done.**

### 7. Block heartbeat flooders
- Same place → **Create rule** again
- Name: `Heartbeat flood`
- Field: **URI Path** → contains → `/api/hsk-sim/heartbeat`
- Rate: **60 requests / 1 minute**
- Action: **Block** for **5 minutes**
- Click **Deploy**.
- **Done.**

### 8. Cache the heavy stuff
- Cloudflare → your domain → **Rules** → **Page Rules** → **Create Page Rule**
- URL: `*dralingo.app/assets/*`
- Setting: **Cache Level → Cache Everything**
- Setting: **Edge Cache TTL → a month**
- Save.
- **Create another** for `*dralingo.app/api/*` → **Cache Level → Bypass**
- **Create another** for `*dralingo.app/socket.io/*` → **Cache Level → Bypass**
- **Done.**

### 9. Test it works
- Wait 5 minutes
- Open browser to `https://app.dralingo.app/`
- Page loads → ✅ you're behind Cloudflare

**Part 1 DONE.** This alone is the biggest win.

---

## PART 2 — RENDER (do this second, takes 15 min)

### 10. Change the admin password to something nobody can guess
- Open a terminal, run this command:
  ```
  node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
  ```
- Copy the output (looks like `kP3xRq2nMv8sH7tL4wY9aZ6bC1dE5fG0`)
- Open **1Password** (or Bitwarden, or your password manager). **NOT a text file.**
- Save it under **"Draly admin password"**
- Go to **dashboard.render.com** → your service → **Environment**
- Find `WU_ADMIN_PASSWORD`
- Click **Edit** → paste the new value → **Save Changes**
- Render redeploys automatically (~2 min)
- Old password is dead from this moment.
- **Done.**

### 11. Verify the disk is real
- Open browser to: `https://app.dralingo.app/api/admin/disk-status?pw=<your-new-password>`
- You should see `"writable": true` and `"persistenceLikely": true`
- ✅ disk works
- **Done.**

### 12. Set up the weekly backup
- Add to your calendar: **"Backup Draly disk"** → every **Friday at 5pm** → recurring.
- The Friday ritual (5 minutes):
  - Render → your service → **Shell** tab
  - Type: `tar -czf /tmp/data-$(date +%Y%m%d).tar.gz data/` → Enter
  - Click the file picker icon, find `/tmp/data-20260604.tar.gz`, download
  - Drag the file into Google Drive folder **"Draly backups"**
- **Done.**

**Part 2 DONE.**

---

## PART 3 — GITHUB (do this third, takes 5 min)

### 13. Stop accidentally committing secrets
- Open **github.com/fernandopalmahn10/draly-wisdomgrounds**
- Click **Settings** (top right)
- Click **Code security and analysis** (left sidebar)
- Find **Secret scanning** → click **Enable**
- Find **Push protection** → click **Enable**
- Find **Dependabot alerts** → click **Enable**
- Find **Dependabot security updates** → click **Enable**
- **Done.**

### 14. Stop accidentally force-pushing
- Same Settings page → click **Branches** (left sidebar)
- Click **Add classic branch protection rule**
- Branch name pattern: `main`
- Scroll down. Check **"Restrict force pushes"**
- Save.
- **Done.**

**Part 3 DONE.**

---

## PART 4 — GOOGLE CLOUD (do this fourth, takes 10 min)

This stops a leaked TTS key from running up a $40,000 bill.

### 15. Set a hard $25/month cap
- Open **console.cloud.google.com**
- Top search bar → type **"Billing"** → click **Budgets & alerts**
- Click **Create budget**
- Name: `Draly TTS hard cap`
- Amount: **$25**
- Alerts: check 50%, 90%, 100% boxes — emails to your address
- Save.
- **Done.**

### 16. Rotate the TTS key
- Same console → top search → **"IAM & Admin"** → **Service Accounts**
- Click the TTS service account
- Tab: **Keys**
- Click **Add Key → Create new key → JSON**
- Download the JSON file
- Open the JSON in a text editor, copy all of it
- Go to Render → Environment → find `GOOGLE_APPLICATION_CREDENTIALS_JSON` (or similar)
- Replace the value with the new JSON contents → Save
- Wait 2 minutes for Render to redeploy
- Test the audio in your app — does it speak? ✅
- Back in GCP → service account → Keys tab → **delete the OLD key**
- **Done.**

### 17. Calendar event: rotate again in 90 days
- Calendar → **"Rotate Draly GCP key"** → 90 days from today → recurring every 90 days.
- **Done.**

**Part 4 DONE.**

---

## 🚨 WHEN SOMETHING GOES WRONG

### "I think someone got my admin password"
1. Go to **Render → Environment**
2. Change `WU_ADMIN_PASSWORD` to a new random string (use the command in step 10)
3. Save. Wait 2 min for redeploy.
4. Save the new one in 1Password. Delete the old one.
5. ✅ Old password is dead.

### "My site is getting hammered with traffic"
1. Go to **Cloudflare → your domain → Security → Settings**
2. Change Security Level to **"Under Attack"**
3. ✅ Every visitor sees a 5-second puzzle. Bots die. Site survives.
4. Turn it back to **"High"** after a few hours.

### "Render is down"
1. Cloudflare's "Always Online" serves the last cached pages.
2. Live games won't work but the site doesn't go dark.
3. Wait. Refresh **status.render.com** to see when it's fixed.

### "I committed my credentials by accident"
1. **First** — rotate the credential immediately (steps 10 or 16).
2. **Then** — delete the bad commit:
   ```
   git rm <the-bad-file>
   git commit -m "remove leaked file"
   git push
   ```
3. (The secret is technically still in history. That's why rotating FIRST is non-negotiable. Bots scrape GitHub within minutes.)

### "My disk got wiped"
1. Go to your Google Drive **"Draly backups"** folder
2. Download the most recent `.tar.gz`
3. Render → Shell tab
4. Upload the tar file via the file picker
5. Run: `tar -xzf data-20260604.tar.gz` (use the actual filename)
6. ✅ Restored. You lose up to a week of records.

---

## 📅 CALENDAR — set these now, never think again

| When | What | Time |
|---|---|---|
| Every Friday 5pm | Download backup | 5 min |
| Every 1st of month | Look at Cloudflare analytics for weirdness | 10 min |
| Every 90 days | Rotate admin password (step 10) | 5 min |
| Every 90 days | Rotate GCP key (step 16) | 10 min |
| Every January | Re-read this file | 15 min |

---

## ⏱ TOTAL TIME

- First-time setup: **~60 minutes** (all four parts)
- Every week: **5 minutes** (backup)
- Every month: **10 minutes** (check analytics)
- Every 3 months: **15 minutes** (rotate passwords)

That's it. Stop reading. Start with Part 1.

---

_Last updated: 2026-06-04_
