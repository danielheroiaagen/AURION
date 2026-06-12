# AURION voice gateway image (ADR-018/ADR-020). Build context: repository root.
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/dashboard/package.json apps/dashboard/
COPY apps/voice-gateway/package.json apps/voice-gateway/
COPY apps/hermes-receiver/package.json apps/hermes-receiver/
RUN npm install -g npm@11
RUN npm ci
COPY apps/voice-gateway ./apps/voice-gateway
RUN npm --workspace @aurion/voice-gateway run build && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
# MP3 → μ-law decode for the operator's cloned voice on the phone (ADR-029).
RUN apk add --no-cache ffmpeg
WORKDIR /repo
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/voice-gateway/package.json ./apps/voice-gateway/package.json
COPY --from=build /repo/apps/voice-gateway/dist ./apps/voice-gateway/dist
USER node
EXPOSE 8080
CMD ["node", "apps/voice-gateway/dist/main.js"]
