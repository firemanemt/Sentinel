# Sentinel AI — Railway Deployment Guide

Get Sentinel live in **5 minutes** with a real URL.

---

## Quick Deploy (5 Minutes)

### Step 1: Create a Railway Account
Go to [railway.com](https://railway.com) → Sign up with GitHub

### Step 2: Create a New Project
1. Click **"New Project"**
2. Click **"Deploy from GitHub repo"**
3. Connect your `Sentinel` repo
4. Railway auto-detects the `railway.toml` and starts building

### Step 3: Add MySQL Database
1. In your Railway project, click **"+ New"**
2. Select **"Database"** → **"Add MySQL"**
3. Railway creates a MySQL instance and injects connection variables

### Step 4: Set Environment Variables
In the Railway dashboard → your service → **Variables** tab, add:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `${{MYSQL_URL}}` (Railway auto-fills this) |
| `JWT_SECRET` | Click "Generate" or paste a random string |
| `OPENAI_API_KEY` | `sk-your-openai-key` |
| `ELEVENLABS_API_KEY` | Your ElevenLabs key (optional for voice) |

Railway automatically provides `MYSQL_URL` when you add the MySQL plugin — just reference it.

### Step 5: Run Database Migrations
In the Railway dashboard → your service → **Settings** → **Deploy** section:

Under **Custom Start Command**, temporarily change it to:
```
npx pnpm db:push && node dist/index.js
```

Deploy once to run migrations, then change it back to:
```
node dist/index.js
```

**Or** use the Railway CLI:
```bash
npm i -g @railway/cli
railway login
railway run -- npx pnpm db:push
```

### Step 6: Open Your App
Railway gives you a URL like `https://sentinel-ai.up.railway.app`

Open it → Create your first account (auto-promoted to admin)

---

## Railway CLI (Optional)

For faster iteration:

```bash
npm i -g @railway/cli
railway login
railway link          # Link to your project
railway up            # Deploy from local
railway logs          # View live logs
railway run -- <cmd>  # Run commands on the server
railway domain        # See your live URL
```

---

## Custom Domain

1. In Railway dashboard → your service → **Settings**
2. Scroll to **Domains** → **Generate Domain** (free railway.app subdomain)
3. For custom domain: **Add Custom Domain** → follow DNS instructions

---

## Pricing

| Plan | Cost |
|------|------|
| Hobby (your first project) | $5/mo flat |
| Pro (per-resource billing) | Pay for what you use |

**Expected cost: ~$5-7/mo** (app + MySQL)

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails | Check `railway logs` — usually a missing env var |
| `DATABASE_URL` not set | Add the MySQL plugin first, then redeploy |
| Port mismatch | Railway sets `PORT` automatically — don't override |
| Migration errors | Run `railway run -- npx pnpm db:push` manually |
| App crashes on start | Check logs: `railway logs` |

---

## Updating After Changes

Railway auto-deploys when you push to the connected branch:

```bash
git push origin main  # That's it — Railway builds & deploys automatically
```
