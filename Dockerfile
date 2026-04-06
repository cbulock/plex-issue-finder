# Build frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Backend runtime
FROM node:22-alpine AS backend
WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ ./

# Copy built frontend into backend's expected location
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Create data directory for SQLite
RUN mkdir -p /data

ENV DB_PATH=/data/plex-issue-finder.db
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "src/index.js"]
