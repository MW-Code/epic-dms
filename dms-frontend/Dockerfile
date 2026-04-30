# Multi-Stage Frontend-Image:
#  Stage 1: Node baut das Quasar-SPA
#  Stage 2: nginx serviert die statischen Dateien und proxiet /api -> backend

# ---- Build ---------------------------------------------------------------
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Build-Time-Variable fuer die API-URL. In Production hinter dem nginx-Proxy
# zeigen wir auf "/api", was vom Frontend-Container an den Backend-Service
# weitergeleitet wird. Override moeglich via --build-arg API_URL=...
ARG API_URL=/api
ENV API_URL=${API_URL}

COPY package*.json ./
# postinstall (quasar prepare) braucht die Config, die erst spaeter
# kopiert wird -> Scripts beim ci ueberspringen
RUN npm ci --ignore-scripts

COPY . .
RUN npx quasar prepare && npm run build

# ---- Serve ---------------------------------------------------------------
FROM nginx:1.27-alpine

# nginx-Konfig mit /api-Proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Quasar buildet nach /app/dist/spa per Default
COPY --from=build /app/dist/spa /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
