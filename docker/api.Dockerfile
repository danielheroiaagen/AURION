# AURION API image (ADR-020). Build context: repository root.
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/dashboard/package.json apps/dashboard/
COPY apps/voice-gateway/package.json apps/voice-gateway/
COPY apps/hermes-receiver/package.json apps/hermes-receiver/
RUN npm install -g npm@11
RUN npm ci
COPY apps/api ./apps/api
RUN npm --workspace @aurion/api run build && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build /repo/apps/api/dist ./apps/api/dist
# Migration tooling rides in the API image so the one-shot `migrate` service
# uses the same artifact (never runs at app startup — ADR-008/ADR-012).
COPY tools/db ./tools/db
COPY database/migrations ./database/migrations
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
