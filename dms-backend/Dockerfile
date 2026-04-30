# Backend-Image fuer Epic DMS
# Enthaelt das Node-App und alle System-Deps fuer ocrmypdf (tesseract,
# ghostscript etc.). Wird sowohl von der "backend"- als auch "worker"-
# Service in compose.yml verwendet, mit unterschiedlichem CMD.
FROM node:22-bookworm-slim

# OCR-Stack als System-Pakete. tesseract-ocr-deu fuer deutsche Sprache.
# qpdf wird von ocrmypdf benoetigt, ist nicht immer auto-pulled.
RUN apt-get update && apt-get install -y --no-install-recommends \
        ocrmypdf \
        tesseract-ocr-deu \
        ghostscript \
        qpdf \
        unpaper \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# package*.json zuerst kopieren -> npm-Layer wird gecached, solange sich
# Dependencies nicht aendern.
COPY package*.json ./
RUN npm ci --omit=dev

# Restlichen Source kopieren
COPY src ./src
COPY scripts ./scripts

# Uploads als Volume mountbar
RUN mkdir -p /app/uploads
VOLUME ["/app/uploads"]

EXPOSE 3000

# Default: API-Server. Worker-Service ueberschreibt das mit "node src/workers/ocrWorker.js"
CMD ["node", "src/server.js"]
