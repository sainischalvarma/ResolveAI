FROM node:20-alpine AS base
RUN npm install -g pnpm

# ── Build shared ──────────────────────────────────────────────────────────────
FROM base AS shared-build
WORKDIR /app
COPY shared/package.json shared/tsconfig.json ./shared/
COPY shared/src ./shared/src
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --filter @resolveai/shared
RUN pnpm --filter @resolveai/shared build

# ── Build server ──────────────────────────────────────────────────────────────
FROM base AS server-build
WORKDIR /app
COPY server/package.json server/tsconfig.json ./server/
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY --from=shared-build /app/shared ./shared
RUN pnpm install --frozen-lockfile --filter @resolveai/server
COPY server/src ./server/src
RUN pnpm --filter @resolveai/server build

# ── Production image ──────────────────────────────────────────────────────────
FROM node:20-alpine AS production
RUN npm install -g pnpm
WORKDIR /app
COPY server/package.json ./server/
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY --from=shared-build /app/shared ./shared
RUN pnpm install --frozen-lockfile --filter @resolveai/server --prod
COPY --from=server-build /app/server/dist ./server/dist

WORKDIR /app/server
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "dist/index.js"]
