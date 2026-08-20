# Barnepige Timeregistrering — multi-stage build (npm workspaces).
# Stage 1 builds the Vite SPA with the deploy base path baked in; stage 2
# compiles backend deps (better-sqlite3 needs a toolchain on musl); stage 3
# is the runtime: Express serves /api plus the built frontend.

FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm ci --workspace frontend
COPY frontend/ frontend/
# Behind Traefik the app lives under /barnepige-app/ — assets and the router
# basename must match (import.meta.env.BASE_URL). Default "/" for local use.
ARG VITE_BASE_PATH=/
ENV VITE_BASE_PATH=$VITE_BASE_PATH
RUN npm run build --workspace frontend

FROM node:22-alpine AS backend-deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json .npmrc ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm ci --workspace backend --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001 \
    DB_PATH=/app/data/database.sqlite
COPY --from=backend-deps /app/node_modules ./node_modules
COPY package.json ./
COPY backend/ backend/
COPY --from=frontend-build /app/frontend/dist frontend/dist
COPY start.sh ./
RUN chmod +x start.sh && mkdir -p /app/data
EXPOSE 3001
CMD ["./start.sh"]
