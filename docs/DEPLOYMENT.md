# MSR Penny — Production Deployment Guide

**Application:** MSR Penny  
**Hosting Platform:** Vercel (Production URL: `https://msr-penny.vercel.app`)  
**Backend Persistence:** Google Sheets via Google Apps Script Web App  

---

## 1. Deployment Architecture & Prerequisites

MSR Penny is architected for zero-cost, high-reliability deployment using standard developer tiers:
- **Frontend Hosting:** Vercel Hobby Tier (Edge CDN + Static Asset Delivery)
- **Serverless API:** Vercel Serverless Functions (`Node.js 20+`)
- **Database / Persistent Store:** Google Sheets (Google Drive) via Google Apps Script Web App
- **Domain / SSL:** Automated TLS encryption via Vercel Edge Network

---

## 2. Serverless Function Constraints (Vercel Hobby Plan)

Vercel's Hobby plan enforces a strict limit of **at most 12 Serverless Functions** per deployment. MSR Penny is designed to operate safely with **exactly 4 Serverless Functions**:

| Function Path | Source File | Purpose |
| :--- | :--- | :--- |
| `/api/data` | `api/data.ts` | Consolidated router handling state, transactions, accounts, transfers, health, and archiving |
| `/api/shortcut` | `api/shortcut.ts` | High-speed webhook for Apple Shortcuts and Siri expense logging |
| `/api/push` | `api/push.ts` | Web Push VAPID subscription management and test dispatch |
| `/api/cron` | `api/cron.ts` | Scheduled daily reminder cron (invoked daily at 15:30 UTC / 21:00 IST) |

All frontend data requests (e.g. `/api/state`, `/api/accounts`, `/api/health`) are rewritten to `/api/data?route=$1` in [`vercel.json`](../vercel.json).

---

## 3. Step-by-Step Vercel Deployment

### Step 1: Connect GitHub Repository
1. Log in to [Vercel](https://vercel.com).
2. Click **Add New...** > **Project**.
3. Import your repository: `soundhararajanmuthuvel-hub/MSR-Penny`.

### Step 2: Configure Project Settings
- **Framework Preset:** `Vite`
- **Root Directory:** `./`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

### Step 3: Configure Environment Variables
In the **Environment Variables** panel, add the following:

```ini
# Production Google Apps Script Web App URL
GOOGLE_APPS_SCRIPT_URL="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"

# Secret Token for Apple Shortcuts & iOS Siri Webhook
SHORTCUT_SECRET_TOKEN="your-strong-random-token"

# Scheduled Cron Trigger Secret
CRON_SECRET="your-strong-cron-secret"

# Web Push Notification VAPID Keys
VITE_VAPID_PUBLIC_KEY="BFumy3go8AuIfBnrtYBbst5Fksz3VkUbfJe23Q6Ydl6okux_S5BdX9hA9Jq679Evygnc_uh6fpYxb9Fs_cIa6t0"
VAPID_PRIVATE_KEY="your-server-side-private-key"
VAPID_SUBJECT="mailto:soundhararajanmuthuvel@gmail.com"
```

### Step 4: Deploy & Verify
Click **Deploy**. Deployment typically takes under 45 seconds.

---

## 4. Post-Deployment Verification (Smoke Testing)

Run the following smoke tests against your live deployment URL:

```bash
# 1. Verify Health Check
curl -s "https://msr-penny.vercel.app/api/data?action=health" | jq .

# Expected Response:
# { "success": true, "healthReport": { "isHealthy": true, ... } }

# 2. Verify State Retrieval
curl -s "https://msr-penny.vercel.app/api/state" | jq .success

# Expected Response:
# true
```

---

## 5. Rollback & Disaster Recovery Procedures

1. **Instant Rollback via Vercel**: In the Vercel dashboard, navigate to **Deployments** > select the previous working deployment > click **Instant Rollback**.
2. **Git Backup Tags**: Prior to structural database changes or migrations, tagged backups are preserved:
   ```bash
   git checkout backup-before-balance-fix-20261106
   ```
3. **Google Sheets Snapshot**: If a spreadsheet error occurs, open Google Sheets > **File** > **Version history** > **See version history** to restore the sheet state to any point in time with zero data loss.
