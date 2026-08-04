# ── FocusFlow API server ──────────────────────────────────────────────────────
# Build context must be the repository root:
#     docker build -f mainApp/server/Dockerfile -t focusflow-server .
FROM node:20-alpine
WORKDIR /app

COPY mainApp/server/package.json mainApp/server/package-lock.json ./
RUN npm ci --omit=dev

COPY mainApp/server/ ./
ENV PORT=5001
EXPOSE 5001

# Readiness probe backed by GET /api/health/ready (IES-P0-19).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5001/api/health/ready >/dev/null 2>&1 || exit 1

CMD ["node", "index.js"]
