# ── Stage 1: Build frontend ─────────────────
FROM node:20-alpine AS frontend
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_GOOGLE_MAPS_KEY
ENV VITE_GOOGLE_MAPS_KEY=$VITE_GOOGLE_MAPS_KEY

RUN npm run build

# ── Stage 2: Setup API server ──────────────
FROM node:20-alpine
WORKDIR /app

# better-sqlite3 needs build tools for native addon
RUN apk add --no-cache python3 make g++

# Install server dependencies
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev

# Remove build tools to keep image small
RUN apk del python3 make g++

# Copy server code
COPY server/index.js ./
COPY server/db ./db
COPY server/middleware ./middleware
COPY server/routes ./routes
COPY server/services ./services

# Copy built frontend
COPY --from=frontend /app/dist ./public

# Create data directory (will be mounted as volume)
RUN mkdir -p data/uploads

EXPOSE 3000

# Environment variables (set via EasyPanel/docker-compose)
ENV NODE_ENV=production
ENV PORT=3000
ENV TZ=America/Argentina/Buenos_Aires

CMD ["node", "index.js"]
