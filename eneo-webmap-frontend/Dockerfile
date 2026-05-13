# ════════════════════════════════════════════════════════════════════
# Dockerfile  —  React / Vite Frontend (SIMS)
# ════════════════════════════════════════════════════════════════════
# Copier sur Ubuntu : ~/projects/sims-frontend/Dockerfile
#
# cp "/mnt/c/devops/Application Webmapping/eneo-webmap-frontend/Dockerfile" \
#    ~/projects/sims-frontend/Dockerfile
# ════════════════════════════════════════════════════════════════════

FROM node:20-alpine

# ── Métadonnées ───────────────────────────────────────────────────
LABEL project="sims-webmapping" service="frontend"

WORKDIR /app

# ── Dépendances npm ────────────────────────────────────────────────
# Copier package.json avant le reste pour profiter du cache Docker
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# ── Code source ────────────────────────────────────────────────────
COPY . .

# ── Port Vite dev server ───────────────────────────────────────────
EXPOSE 3000

# ── Dev server (écoute sur toutes les interfaces réseau) ──────────
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
