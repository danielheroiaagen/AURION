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
# OIDC sign-in (ADR-021/ADR-033): Vite bakes these PUBLIC values into the
# bundle at build time — endpoints and a public client id, never secrets.
ARG VITE_OIDC_AUTHORIZATION_URL=
ARG VITE_OIDC_TOKEN_URL=
ARG VITE_OIDC_CLIENT_ID=
ARG VITE_OIDC_SCOPE=
ARG VITE_OIDC_AUDIENCE=
ENV VITE_OIDC_AUTHORIZATION_URL=$VITE_OIDC_AUTHORIZATION_URL \
    VITE_OIDC_TOKEN_URL=$VITE_OIDC_TOKEN_URL \
    VITE_OIDC_CLIENT_ID=$VITE_OIDC_CLIENT_ID \
    VITE_OIDC_SCOPE=$VITE_OIDC_SCOPE \
    VITE_OIDC_AUDIENCE=$VITE_OIDC_AUDIENCE
RUN npm --workspace @aurion/dashboard run build

FROM nginx:1.27-alpine
COPY docker/dashboard-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/dashboard/dist /usr/share/nginx/html
EXPOSE 80
