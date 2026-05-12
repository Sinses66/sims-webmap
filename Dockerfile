# ════════════════════════════════════════════════════════════════════
# Dockerfile  —  GeoDjango Backend (SIMS)
# ════════════════════════════════════════════════════════════════════
# Copier sur Ubuntu : ~/projects/eneo_webmap/Dockerfile
#
# cp "/mnt/c/devops/Application Webmapping/django_sims_core/Dockerfile" \
#    ~/projects/eneo_webmap/Dockerfile
# ════════════════════════════════════════════════════════════════════

FROM python:3.11-slim-bookworm

# ── Métadonnées ───────────────────────────────────────────────────
LABEL project="sims-webmapping" service="backend"

# ── Dépendances système (GDAL, PostGIS client, compilation) ──────
RUN apt-get update && apt-get install -y --no-install-recommends \
    # GDAL / géospatial
    binutils \
    libproj-dev \
    gdal-bin \
    libgdal-dev \
    # PostgreSQL client
    libpq-dev \
    postgresql-client \
    # Compilation
    gcc \
    g++ \
    # Utilitaires
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# GDAL : variables pour la compilation des bindings Python
ENV CPLUS_INCLUDE_PATH=/usr/include/gdal
ENV C_INCLUDE_PATH=/usr/include/gdal

# ── Répertoire de travail ──────────────────────────────────────
WORKDIR /app

# ── Dépendances Python ─────────────────────────────────────────
# Copier requirements.txt avant le reste pour profiter du cache Docker
COPY requirements.txt .

# Installer GDAL Python (version doit correspondre au GDAL système)
# puis le reste des dépendances
RUN GDAL_VERSION=$(gdal-config --version) && \
    echo "GDAL système : $GDAL_VERSION" && \
    pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir "GDAL==${GDAL_VERSION}" && \
    pip install --no-cache-dir -r requirements.txt

# ── Code source ────────────────────────────────────────────────
COPY . .

# ── Port exposé ────────────────────────────────────────────────
EXPOSE 8001

# ── Commande par défaut (surchargée par docker-compose) ────────
CMD ["python", "manage.py", "runserver", "0.0.0.0:8001"]
