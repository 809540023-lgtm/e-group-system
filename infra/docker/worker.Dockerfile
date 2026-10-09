# Worker 映像（規劃書 18 章；模組 18）。
# 非 root 執行；只帶 worker 需要的檔案。
# 建置：docker build -f infra/docker/worker.Dockerfile -t jp-worker:local .

FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/domain/package.json packages/domain/
COPY packages/integrations/package.json packages/integrations/
COPY packages/db/package.json packages/db/
COPY packages/ui/package.json packages/ui/
RUN npm ci --ignore-scripts

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./package.json
COPY --chown=node:node apps/worker ./apps/worker
COPY --chown=node:node packages ./packages
USER node
# worker 沒有對外埠；以程序存活作為健康判斷。
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "process.exit(0)"
CMD ["npm", "run", "start", "--workspace", "@jp/worker"]
