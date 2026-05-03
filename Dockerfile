# HARDENING-PLAN.md item #1 — Vaidix Next.js production image.
# Multi-stage build → small final image, non-root runtime user.

# ─── Stage 1: deps ──────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev=false && npx prisma generate

# ─── Stage 2: build ─────────────────────────────────────────────────────────
FROM node:20-alpine AS build
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NEXT_PHASE=phase-production-build
# Build-time placeholders: env.ts schema validates at module-load even though
# the production runtime gate is skipped for the build phase. These satisfy the
# zod schema. They are scoped to the build stage and never copied into runtime.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV REDIS_URL=redis://localhost:6379
ENV NEXTAUTH_URL=http://localhost:3000
ENV NEXTAUTH_SECRET=build_time_placeholder_secret_at_least_32_chars_long
ENV EMAIL_HOST=smtp.example.com
ENV EMAIL_PORT=587
ENV EMAIL_USER=build
ENV EMAIL_PASSWORD=build
ENV EMAIL_FROM=build@example.com
ENV LIVEKIT_URL=wss://livekit.example.com
ENV LIVEKIT_API_KEY=buildplaceholderkey
ENV LIVEKIT_API_SECRET=buildplaceholdersecret16chars
ENV S3_ENDPOINT=http://localhost:9000
ENV S3_BUCKET=build
ENV S3_ACCESS_KEY=build
ENV S3_SECRET_KEY=build
ENV VAIDIX_DATA_ROOT=/var/lib/vaidix-data
RUN npx prisma generate && npm run build

# ─── Stage 3: runtime ───────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
RUN apk add --no-cache libc6-compat openssl ffmpeg curl tini
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Non-root runtime user.
RUN addgroup --system --gid 1001 vaidix \
 && adduser  --system --uid 1001 --ingroup vaidix vaidix

# Copy built artefacts. Use Next standalone output if available, else full.
COPY --from=build --chown=vaidix:vaidix /app/.next ./.next
COPY --from=build --chown=vaidix:vaidix /app/public ./public
COPY --from=build --chown=vaidix:vaidix /app/node_modules ./node_modules
COPY --from=build --chown=vaidix:vaidix /app/package.json ./package.json
COPY --from=build --chown=vaidix:vaidix /app/prisma ./prisma
COPY --from=build --chown=vaidix:vaidix /app/scripts ./scripts
COPY --from=build --chown=vaidix:vaidix /app/src ./src

USER vaidix
EXPOSE 3000

# tini reaps zombie ffmpeg children spawned by transcode/transcribe workers.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "start"]
