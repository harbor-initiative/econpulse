FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    NODE_OPTIONS=--no-warnings

# Dependencies first so a code change does not reinstall them.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY server ./server
COPY public ./public
COPY pipeline/schema.sql ./pipeline/schema.sql

# The database is the payload. It ships inside the image so the container has
# nothing to fetch at boot and works with no network at all.
COPY data/econpulse.db ./data/econpulse.db

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node_modules/.bin/tsx", "server/index.ts"]
