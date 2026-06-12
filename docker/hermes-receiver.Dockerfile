# HERMES dispatch receiver image (ADR-019/ADR-020). Zero runtime deps:
# the runtime stage carries only the compiled output. Build context: repo root.
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/dashboard/package.json apps/dashboard/
COPY apps/voice-gateway/package.json apps/voice-gateway/
COPY apps/hermes-receiver/package.json apps/hermes-receiver/
RUN npm install -g npm@11
RUN npm ci
COPY apps/hermes-receiver ./apps/hermes-receiver
RUN npm --workspace @aurion/hermes-receiver run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/apps/hermes-receiver/package.json ./package.json
COPY --from=build /repo/apps/hermes-receiver/dist ./dist
USER node
EXPOSE 8090
CMD ["node", "dist/main.js"]
