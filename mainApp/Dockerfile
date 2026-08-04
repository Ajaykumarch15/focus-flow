# ── FocusFlow client ──────────────────────────────────────────────────────────
# Multi-stage: build the Vite SPA, then serve it with nginx.
# Build context must be the repository root:
#     docker build -f mainApp/Dockerfile -t focusflow-client .
FROM node:20-alpine AS build
WORKDIR /app

COPY mainApp/package.json mainApp/package-lock.json ./
RUN npm ci

COPY mainApp/ ./
# Fail-fast: vite refuses to build without VITE_API_URL; override via --build-arg.
ARG VITE_API_URL=http://localhost:5001/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:1.27-alpine
# The repo-root nginx.conf is an envsubst template: ${SERVER_UPSTREAM} points at
# the API container (compose service name "server" by default).
COPY nginx.conf /etc/nginx/conf.d/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV SERVER_UPSTREAM=server
EXPOSE 80
CMD ["/bin/sh", "-c", "envsubst '${SERVER_UPSTREAM}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
