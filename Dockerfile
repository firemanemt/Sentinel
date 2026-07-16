# =============================================================================
# Sentinel AI - Fly.io Optimized Build
# =============================================================================

# --- Stage 1: Dependencies ---
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++ && corepack enable
WORKDIR /app

# Enable pnpm and allow non-frozen installs for CI compatibility
ENV COREPACK_ENABLE_AUTO_PIN=0

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --no-frozen-lockfile || pnpm install

# --- Stage 2: Build ---
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat && corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# --- Stage 3: Production ---
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat tini && corepack enable

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 sentinel

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

# Fly.io sends SIGTERM for graceful shutdown
STOPSIGNAL SIGTERM

USER sentinel

EXPOSE 3000

# Use tini as init system for proper signal handling
ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/index.js"]
