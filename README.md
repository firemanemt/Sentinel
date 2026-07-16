# SENTINEL AI

> Your personal AI command center — inspired by JARVIS from Iron Man.

![Sentinel AI](https://img.shields.io/badge/version-1.0.0-cyan)
![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **AI Chat** — Natural language assistant powered by OpenAI with voice I/O (ElevenLabs TTS + Whisper STT)
- **Unified Calendar** — Google Calendar, Outlook, and Apple Calendar in one view
- **Music Control** — Spotify playback control and search
- **Smart Home** — Home Assistant integration for lights, thermostats, and devices
- **Communication** — Slack & Discord messaging from one interface
- **GitHub** — Repository management, PRs, issues, and notifications
- **Weather** — Real-time weather, forecasts, air quality, and NWS alerts
- **Stocks & News** — Live market data and news headlines
- **Maps** — Multi-layer maps with directions
- **Command Center** — 3D globe with live conflict zones, satellites, weather radar, and earthquakes
- **Morning Briefings** — Customizable daily briefings with music and TTS
- **Billing** — Stripe integration with Free/Pro tiers

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm 10+
- MySQL 8.0+ (or use Docker Compose)

### 1. Clone & Install

```bash
git clone https://github.com/firemanemt/Sentinel.git
cd Sentinel
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values. At minimum you need:

```
DATABASE_URL=mysql://user:pass@localhost:3306/sentinel
JWT_SECRET=<generate-a-random-secret>
OPENAI_API_KEY=sk-...
```

Generate a JWT secret:
```bash
openssl rand -base64 32
```

### 3. Set Up Database

```bash
# Create the database
mysql -u root -p -e "CREATE DATABASE sentinel;"

# Run migrations
pnpm db:push
```

### 4. Start Development Server

```bash
pnpm dev
```

Open http://localhost:3000 and create your first account (it will be auto-promoted to admin).

## Docker Deployment

The fastest way to deploy:

```bash
# Copy and configure environment
cp .env.example .env
# Edit .env with your production values

# Start everything (app + MySQL)
docker compose up -d

# Run migrations
docker compose exec sentinel pnpm db:push
```

The app will be available at http://localhost:3000.

### Production Deployment

For a production VPS, use a reverse proxy (nginx/Caddy) in front of the Docker container:

```nginx
server {
    listen 443 ssl http2;
    server_name sentinel.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Architecture

```
├── server/          # Express + tRPC backend
│   ├── _core/       # Server infrastructure (auth, context, env)
│   ├── auth.ts      # Email/password auth with JWT sessions
│   ├── routers.ts   # tRPC router (all API endpoints)
│   └── db.ts        # Database helpers (Drizzle ORM)
├── components/      # React UI components
├── pages/           # Page components (routes)
├── hooks/           # React hooks
├── schema.ts        # Database schema (Drizzle)
├── vite.config.ts   # Vite build configuration
└── docker-compose.yml  # Full-stack deployment
```

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS 4, Radix UI
- **Backend**: Express, tRPC, Drizzle ORM
- **Database**: MySQL 8.0
- **AI**: OpenAI GPT-4o-mini, ElevenLabs TTS, Whisper STT
- **Auth**: JWT sessions with bcrypt password hashing
- **Billing**: Stripe subscriptions
- **Maps**: Leaflet + react-leaflet, Globe.gl + Three.js
- **Integrations**: Google, Microsoft, Spotify, GitHub, Discord, Slack, Home Assistant

## Configuration Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | MySQL connection string |
| `JWT_SECRET` | ✅ | Secret for JWT session signing |
| `OPENAI_API_KEY` | ✅ | OpenAI API key for AI chat |
| `ELEVENLABS_API_KEY` | ✅ | ElevenLabs API key for TTS |
| `GOOGLE_CLIENT_ID` | ⬜ | Google OAuth for Calendar/Gmail |
| `GOOGLE_CLIENT_SECRET` | ⬜ | Google OAuth secret |
| `SPOTIFY_CLIENT_ID` |  | Spotify OAuth for music control |
| `SPOTIFY_CLIENT_SECRET` | ⬜ | Spotify OAuth secret |
| `MICROSOFT_CLIENT_ID` | ⬜ | Microsoft OAuth for Outlook |
| `MICROSOFT_CLIENT_SECRET` |  | Microsoft OAuth secret |
| `STRIPE_SECRET_KEY` | ⬜ | Stripe API key for billing |
| `STRIPE_WEBHOOK_SECRET` | ⬜ | Stripe webhook signing secret |
| `STRIPE_PRICE_ID_PRO` |  | Stripe price ID for Pro plan |
| `SIMPLE_ROUTING_API_KEY` | ⬜ | Simple Routing API for directions |
| `ADMIN_EMAIL` | ⬜ | Email to auto-promote to admin |

## Development

```bash
pnpm dev          # Start dev server with hot reload
pnpm build        # Production build
pnpm start        # Start production server
pnpm test         # Run test suite
pnpm check        # TypeScript type checking
pnpm format       # Format code with Prettier
```

## Tests

```bash
pnpm test          # Run all tests
pnpm test -- --watch  # Watch mode
```

## License

MIT — see LICENSE for details.
