# AURION dashboard image (ADR-017/ADR-020): static bundle behind nginx.
# Build context: repository root.
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/dashboard/package.json apps/dashboard/
COPY apps/voice-gateway/package.json apps/voice-gateway/
COPY apps/hermes-receiver/package.json apps/hermes-receiver/
RUN npm ci
COPY apps/dashboard ./apps/dashboard
RUN npm --workspace @aurion/dashboard run build

FROM nginx:1.27-alpine
COPY docker/dashboard-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/dashboard/dist /usr/share/nginx/html
EXPOSE 80
