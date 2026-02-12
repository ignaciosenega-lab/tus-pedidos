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

# Install server dependencies
COPY server/package.json ./
RUN npm ci --production

# Copy server code
COPY server/index.js ./

# Copy built frontend
COPY --from=frontend /app/dist ./public

# Create data directory (will be mounted as volume)
RUN mkdir -p data/uploads

EXPOSE 3000

# Environment variables (set via EasyPanel/docker-compose)
ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "index.js"]
