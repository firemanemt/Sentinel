# Sentinel AI — Fly.io Deployment Guide

This guide walks you through deploying Sentinel AI to Fly.io in about 10 minutes.

---

## Prerequisites

1. [Install Fly CLI](https://fly.io/docs/hands-on/install-flyctl/):
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. Sign up / log in:
   ```bash
   fly auth signup     # new account
   fly auth login      # existing account
   ```

3. **A MySQL database** (Fly.io doesn't have managed MySQL — use one of these):

   | Provider | Free Tier | Setup |
   |----------|-----------|-------|
   | [PlanetScale](https://planetscale.com/) | ✅ Yes | `mysql://user:pass@aws.connect.psdb.cloud/db?sslaccept=strict` |
   | [Turso](https://turso.tech/) | ✅ Yes (SQLite) | Requires schema changes |
   | [Supabase](https://supabase.com/) | ✅ Yes (Postgres) | Requires schema changes |
   | AWS RDS | ❌ Paid | Standard MySQL |

   **Recommended:** PlanetScale — MySQL-compatible, free tier, easiest setup.

---

## Step 1: Create the App

From your project directory:

```bash
cd Sentinel
fly launch --no-deploy
```

This creates a `fly.toml` (or use the one already in this repo).

---

## Step 2: Set Environment Secrets

Fly.io encrypts secrets and injects them at runtime:

```bash
fly secrets set \
  DATABASE_URL="mysql://user:pass@host:3306/sentinel" \
  JWT_SECRET="$(openssl rand -base64 32)" \
  OPENAI_API_KEY="sk-..." \
  ELEVENLABS_API_KEY="..." \
  STRIPE_SECRET_KEY="sk_..." \
  STRIPE_WEBHOOK_SECRET="whsec_..." \
  STRIPE_PRICE_ID_PRO="price_..."
```

You only **need** `DATABASE_URL`, `JWT_SECRET`, and `OPENAI_API_KEY` to start.
Add the others as you connect integrations.

---

## Step 3: Deploy

```bash
fly deploy
```

This builds the Docker image, pushes it to Fly's registry, and starts the machine.

---

## Step 4: Run Database Migrations

SSH into your running machine to run migrations:

```bash
fly ssh console
# Inside the machine:
npx pnpm db:push
exit
```

Or run it as a one-off:

```bash
fly machine exec <machine-id> -- pnpm db:push
```

---

## Step 5: Create Your Admin Account

1. Open your app: `fly apps open`
2. You'll be redirected to `/login`
3. Create an account — the **first account** is auto-promoted to admin

---

## Scaling

Edit `fly.toml` to scale:

```toml
# Change region
primary_region = "lhr"  # London

# Scale machine size (for heavy AI usage)
# [env]
# FLY_MACHINE_VM_SIZE = "performance-2x"
```

Scale commands:
```bash
fly scale count 2          # Add more machines
fly scale memory 512       # Increase RAM
fly regions add lhr fra    # Add regions
```

---

## Domain & SSL

Fly.io provides a free `*.fly.dev` subdomain. For a custom domain:

```bash
fly certs add sentinel.yourdomain.com
fly domains add sentinel.yourdomain.com
```

Then update your DNS with the provided CNAME.

---

## Monitoring

```bash
fly logs              # Live logs
fly status            # App status
fly dashboard         # Web dashboard
```

---

## Updating

After pushing changes to GitHub:

```bash
git pull origin main
fly deploy
```

Fly.io handles zero-downtime rolling deploys automatically.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `ECONNREFUSED` on MySQL | Check `DATABASE_URL` and ensure DB allows Fly's IP range |
| `JWT_SECRET not set` | Run `fly secrets set JWT_SECRET="..."` |
| Build OOM | Increase builder memory: `fly deploy --build-only --remote-only` |
| Port mismatch | Ensure `PORT=3000` in `fly.toml` matches your app |

---

## Cost Estimate

| Resource | Cost |
|----------|------|
| Fly.io shared-cpu-1x (512MB) | ~$1.94/mo |
| PlanetScale free tier | $0 |
| OpenAI API | ~$0.01-0.05 per conversation |
| ElevenLabs (optional) | Free tier: 10k chars/mo |
| **Total minimum** | **~$2/mo** |
