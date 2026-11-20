# Production image (Railway, or any Docker host).
# Railway sets PORT; the app listens on it (react-router-serve). SQLite lives on a
# mounted volume: set DATABASE_URL to a file on it, e.g. file:/data/prod.sqlite.
FROM node:22-alpine
RUN apk add --no-cache openssl

WORKDIR /app

COPY . .

# Dev dependencies are needed for the build (Vite, TypeScript), then removed.
# package-lock.json is git-ignored in this repo, so fall back to npm install.
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi

ENV NODE_ENV=production
RUN npm run build && npm prune --omit=dev && npm cache clean --force

EXPOSE 3000

# Applies database migrations (on the volume), then starts the server.
CMD ["npm", "run", "docker-start"]
