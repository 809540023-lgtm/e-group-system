# 雙北捷運健康餐食節點網路前臺映像（計畫書第十五章）。
# 多階段建置、非 root 執行。
# 建置：docker build -f infra/docker/egroup.Dockerfile -t egroup-web:local .
# 注意：migration 與 seed 不在此映像啟動時執行，必須由部署流程單獨跑一次。

FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/egroup/package.json apps/egroup/
COPY packages/meal/package.json packages/meal/
RUN npm ci --ignore-scripts

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace @eg/web

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3100
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/egroup/.next ./apps/egroup/.next
COPY --from=build --chown=node:node /app/apps/egroup/package.json ./apps/egroup/package.json
COPY --from=build --chown=node:node /app/apps/egroup/next.config.ts ./apps/egroup/next.config.ts
COPY --from=build --chown=node:node /app/apps/egroup/db ./apps/egroup/db
COPY --from=build --chown=node:node /app/apps/egroup/scripts ./apps/egroup/scripts
COPY --from=build --chown=node:node /app/apps/egroup/src/lib ./apps/egroup/src/lib
COPY --from=build --chown=node:node /app/packages/meal ./packages/meal
COPY --from=build --chown=node:node /app/package.json ./package.json
USER node
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3100)+'/api/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "run", "start", "--workspace", "@eg/web"]
