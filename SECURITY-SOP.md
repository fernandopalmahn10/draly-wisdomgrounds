# 🛡 DRALY WISDOMGROUNDS — SECURITY SOP

**Purpose:** Step-by-step procedure for *you* (Fernando, the operator) to
protect the live platform using external services. Do these in order —
nothing here requires code changes; everything is configuration in
external dashboards.

**Audience:** A single non-expert operator running a small ed-tech site
on Render (Hobby tier), GitHub (free), Cloudflare (free), and Google
Cloud TTS (pay-per-use).

**Time to complete first pass:** ~90 minutes
**Recurring time:** ~30 min / month

---

## 1. THREAT MODEL — what we're actually defending against

In plain words, the realistic risks for a classroom site like this are:

| Risk | Who does this | Damage |
|---|---|---|
| Bot scanners hammering admin endpoints with password guesses | Automated worldwide scrapers, ~24/7 | Eventually guesses `EMAAR2026` → admin compromise |
| Student-code enumeration (guessing kid codes to read sentences) | Curious student / former student | Privacy leak of kids' work |
| Bandwidth flood (DoS) — somebody loads the site in a loop | Bored kid, malicious classmate | Render goes slow / over quota |
| Credential leak (admin password / Google key) on GitHub | YOU, by accident | Whole platform compromised, GCP bill |
| Render disk loss (deploy wipe, region outage) | Render infra | All student records lost forever |
| Domain hijack / TLS expiry | Domain registrar / Render | Site goes dark, parents lose trust |

We're **NOT** defending against nation-states, targeted spear-phishing,
or insider attacks by admins. Those need a different document.

---

## 2. CLOUDFLARE — the single highest-ROI step (30 min)

Cloudflare in front of the Render origin gives us, for free:
WAF (web app firewall), bot mitigation, rate limiting, DDoS absorption,
SSL everywhere, edge caching, and analytics.

### 2.1 Sign up + add the domain

1. Sign up at <https://dash.cloudflare.com> (free plan).
2. Click **Add a Site** → enter `draly-wisdomgrounds-2.onrender.com` is
   NOT what we want; we need a real custom domain.
3. **First:** buy a domain (use Cloudflare Registrar directly — cheapest,
   no extra account). Suggested: `draly.app` or `dralingo.app` (~$11/yr).
4. Once the domain is in Cloudflare, go to Render → Settings → Custom
   Domains → add `app.draly.app` (or your choice). Render gives you a
   CNAME target like `draly-wisdomgrounds-2.onrender.com`.
5. In Cloudflare DNS, add a **CNAME** record: `app` → that Render target.
   **Proxy status = ORANGE CLOUD (proxied)**. This is what puts us
   behind Cloudflare.

### 2.2 Lock down SSL/TLS

In the Cloudflare dashboard for your domain:

1. **SSL/TLS → Overview → Set encryption mode to "Full (strict)"**.
   This forces HTTPS between Cloudflare and Render and verifies the
   Render-issued cert.
2. **SSL/TLS → Edge Certificates →**
   - Always Use HTTPS: **ON**
   - Automatic HTTPS Rewrites: **ON**
   - Minimum TLS Version: **TLS 1.2**
   - HSTS: **Enable** (Max age 6 months, include subdomains, preload off
     for now)
3. **SSL/TLS → Origin Server →** (optional — only if you want extra
   defense) issue an Origin CA cert and install in Render.

### 2.3 Turn on the firewall + bot protection

1. **Security → Settings →**
   - Security Level: **High**
   - Bot Fight Mode: **ON** (free plan)
   - Challenge Passage: **30 minutes**
   - Browser Integrity Check: **ON**
2. **Security → WAF → Managed Rules →** enable
   "Cloudflare Managed Ruleset" (free).
3. **Security → WAF → Custom Rules → Create rule:**
   - Name: `Block admin pw brute-force`
   - When incoming requests match: `URI Path contains "/api/admin"` AND
     `URI Query Parameter "pw" exists`
   - Action: **Managed Challenge**
   This makes every admin-password call show a Cloudflare puzzle to
   non-browser clients (i.e., bots). Real teachers see nothing.

### 2.4 Rate limit the noisy endpoints

**Security → WAF → Rate limiting rules → Create rule:**

Rule 1 — admin endpoint protection:
- When: URI Path contains `/api/admin/`
- Same IP makes: **20 requests in 1 minute**
- Action: **Block** for **10 minutes**

Rule 2 — heartbeat protection:
- When: URI Path contains `/api/hsk-sim/heartbeat`
- Same IP makes: **60 requests in 1 minute**
- Action: **Block** for **5 minutes**

Rule 3 — student data scrapers:
- When: URI Path contains `/api/students/` OR `/api/sentences/`
- Same IP makes: **100 requests in 1 minute**
- Action: **Managed Challenge**

Free plan gives you 5 rate-limit rules. We've used 3. Leave 2 for future.

### 2.5 Cache the right things, don't cache the wrong things

**Caching → Configuration:**
- Browser Cache TTL: **Respect Existing Headers** (server already sends
  no-cache on HTML).
- Always Online: **ON** (Cloudflare serves cached version if Render is
  down).

**Page Rules → Create:** (free plan = 3 rules)
- `*draly.app/api/*` → Cache Level: **Bypass**, Disable Performance
- `*draly.app/assets/*` → Cache Level: **Cache Everything**, Edge Cache
  TTL: **1 month**
- `*draly.app/socket.io/*` → Cache Level: **Bypass**

This makes static assets (images, MP3s) flow from Cloudflare's edge
instead of Render every time. **Big bandwidth win.**

### 2.6 Verify it's working

After ~5 minutes, run:
```
curl -I https://app.draly.app/
```
Look for headers `cf-ray:`, `server: cloudflare`. If you see them,
you're behind the proxy.

---

## 3. RENDER — harden the origin (15 min)

### 3.1 Environment variables — rotate to long random values

In Render → Service → Environment:

1. Change `WU_ADMIN_PASSWORD` from `draly2026` (default fallback) to a
   long random value. Generate with:
   ```
   node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
   ```
   Example output: `kP3xRq2nMv8sH7tL4wY9aZ6bC1dE5fG0`
   Save this in a password manager (1Password, Bitwarden — NOT a
   text file in the repo).
2. Verify `GOOGLE_APPLICATION_CREDENTIALS_JSON` (or whatever the TTS
   key is named) is present and is a Service Account JSON, not your
   personal account.
3. Add `NODE_ENV = production` if not already set.

### 3.2 IP allowlist for admin endpoints (optional, paranoid mode)

If you only access admin from a couple of places (your home, school):
Cloudflare → Security → WAF → Custom Rules → Create rule:
- When: URI Path contains `/api/admin/` AND IP Source Address NOT IN
  `{your.home.ip, your.school.ip}`
- Action: **Block**

Downside: you lock yourself out if you travel. Don't do this until
you're comfortable rolling it back.

### 3.3 Persistent disk — verify, then back up

1. Render → Service → Disks: confirm the disk is **Mounted** and shows
   non-zero usage.
2. Hit `https://app.draly.app/api/admin/disk-status?pw=<your-pw>` and
   verify `writable: true` and `persistenceLikely: true`.
3. **Weekly backup ritual** (5 min, do every Friday):
   - SSH to Render service shell.
   - Run `tar -czf /tmp/data-$(date +%Y%m%d).tar.gz data/`.
   - Download to your laptop with the shell file picker.
   - Drag into a Google Drive folder named "Draly backups".
   - Done.

   This is manual and that's fine for a single-operator small site.
   If you ever want to automate: spin up a daily cron on a free
   GitHub Actions runner that uses `rclone` to push `data/` to S3.

### 3.4 Auto-deploy gating

Render → Service → Settings → Auto Deploy: **ON** for `main` only.
Make sure no other branch deploys.

---

## 4. GITHUB — keep secrets out (10 min)

### 4.1 Verify .gitignore covers all sensitive paths

Open `.gitignore` and confirm these lines exist (add if missing):
```
data/
.env
.env.*
*-credentials.json
google-credentials*.json
node_modules/
.DS_Store
```

### 4.2 Enable secret scanning

GitHub repo → Settings → Code security and analysis:
- **Secret scanning: ENABLE**
- **Push protection: ENABLE** (blocks pushes that contain detected secrets)
- **Dependabot alerts: ENABLE**
- **Dependabot security updates: ENABLE**

### 4.3 Branch protection on `main`

Repo → Settings → Branches → Add rule for `main`:
- Require a pull request before merging — **OFF** (you're the only dev)
- Require status checks to pass — N/A
- Restrict pushes to `main` — **OFF** (you need to push directly)
- **DO enable: "Do not allow bypassing the above settings"** for the
  Admin role on force-push.

This stops you from accidentally `git push --force main` and erasing
history. If you ever need to, you'll have to flip it back manually —
which is the point.

### 4.4 Audit collaborators

Repo → Settings → Collaborators and teams. Nobody should be here
except you. If anyone else is listed and you don't recognize the
account, **revoke immediately**.

---

## 5. GOOGLE CLOUD — the TTS key is your highest-cost-exposure secret (10 min)

A leaked Google service account can run up tens of thousands of
dollars before you notice. Most expensive risk on the whole platform.

### 5.1 Set a hard budget alert

GCP Console → Billing → Budgets & alerts → Create budget:
- Name: `Draly TTS hard cap`
- Amount: **$25/month** (or whatever your normal usage is × 3)
- Alerts at 50%, 90%, 100% — all to your email AND your phone via SMS.
- **DO enable: "Connect a Pub/Sub topic"** + a tiny Cloud Function that
  disables billing if 100% breached. Search Google for "GCP automated
  budget disable" — official sample exists.

### 5.2 Restrict the TTS service account

GCP Console → IAM & Admin → Service Accounts → click the TTS account:
- Roles: must be **ONLY** `roles/cloudtexttospeech.user`. Remove any
  Editor / Owner / Storage Admin roles.
- Keys tab: rotate the key. Generate new one, install in Render env,
  test once, delete old key from GCP.
- Do this rotation **every 90 days**. Put a recurring calendar event.

### 5.3 Enable API quota limits

GCP Console → APIs & Services → Cloud Text-to-Speech API → Quotas:
- **Requests per day:** set to something safe like 10,000.
- **Requests per minute per user:** 100.
This caps blast radius even if the key leaks.

---

## 6. INCIDENT RESPONSE — what to do when something is wrong

### 6.1 "I think the admin password leaked"

1. Render → Environment → change `WU_ADMIN_PASSWORD` to a new random
   value (procedure in 3.1).
2. Render redeploys automatically (~2 min).
3. Old password is dead from that moment.

### 6.2 "Someone is hammering my endpoints"

1. Cloudflare → Analytics → Security → find the offending IP.
2. Security → WAF → IP Access Rules → block that IP.
3. If it's a botnet (many IPs): Security → Settings → Security Level:
   **Under Attack**. This makes every visitor see a Cloudflare puzzle
   for 5 seconds. Sucks for kids but saves the site. Turn off after
   the wave passes.

### 6.3 "Render is down"

Cloudflare's "Always Online" serves the last cached version. Static
pages still work. Sockets / live features don't. Update Render status
page subscription so you get an email when service is restored.

### 6.4 "I accidentally committed credentials"

1. Don't just delete the file in the next commit — the secret is in
   git history forever and bots already saw it.
2. **Immediately rotate the credential** (procedures above).
3. THEN purge from history: `git filter-repo --invert-paths --path
   <file>` then force-push (yes, that's what force-push is for).
4. Tell GitHub support to invalidate any secret-scanning cache.

### 6.5 "My disk got wiped"

Restore from the weekly backup tarball (procedure in 3.3). You'll lose
up to a week of student records. This is why the backup matters.

---

## 7. RECURRING CALENDAR EVENTS

Put these in your calendar TODAY:

| Frequency | Task | Time |
|---|---|---|
| Weekly (Fri) | Download `data/` tarball backup | 5 min |
| Monthly | Review Cloudflare security analytics + Render logs for weirdness | 15 min |
| Monthly | Verify GitHub secret scanning has fired no alerts | 2 min |
| Quarterly | Rotate `WU_ADMIN_PASSWORD` | 5 min |
| Quarterly | Rotate GCP TTS service account key | 10 min |
| Yearly | Re-read this document; update anything that's drifted | 30 min |

---

## 8. WHAT'S OUT OF SCOPE FOR THIS DOC

These are real concerns but require either expensive services or
specialist time:

- **PCI / GDPR / FERPA compliance** — if you ever take payments or
  expand to EU/US schools, you need a lawyer, not a checklist.
- **Penetration testing** — annual third-party pentest if the user
  base grows past a few hundred.
- **24/7 incident monitoring** — PagerDuty / Datadog. Worth it once
  the site has revenue.
- **Encrypted backups** — current weekly tarball is plaintext. Fine
  while it lives in your Google Drive; encrypt with `gpg` if you ever
  move backups to a less-trusted location.

---

## 9. ONE-LINE SUMMARY

If you do nothing else from this document, do this:

**Put the site behind Cloudflare with Bot Fight Mode + WAF + Rate
Limiting, change `WU_ADMIN_PASSWORD` to a 24-byte random string, and
set a $25/month GCP budget cap.**

Those three steps alone defeat 95% of real-world threats to a site
this size.

---

_Last updated: 2026-06-04 · written when the platform was at safe-state-2026-06-04_
