# SIMS Webmapping

Plateforme de webmapping multi-tenant pour la gestion du réseau électrique et des incidents terrain.

---

## Architecture

```
sims-webmap/
├── django_sims_core/       # Backend Django / DRF
│   ├── eneo_backend/       # Config Django (settings, urls, wsgi)
│   ├── sims_core/          # App core : organisations, applications, couches, auth
│   └── sims_network/       # App métier : incidents, interventions, notifications
├── eneo-webmap-frontend/   # Frontend React + Vite + Leaflet
├── docker-compose.yml      # Stack locale (backend + db + redis)
├── .env.example            # Variables d'environnement à copier en .env
└── .github/workflows/      # CI GitHub Actions
```

### Stack

| Composant | Technologie |
|-----------|-------------|
| Backend | Django 4.2, Django REST Framework |
| Auth | SimpleJWT + throttling personnalisé |
| Base de données | PostgreSQL 15 + PostGIS |
| Frontend | React 18, React Router v6, Zustand, Leaflet |
| Carto | GeoServer (WMS/WFS) |
| Tests | pytest-django, Vitest |
| CI | GitHub Actions |

---

## Installation locale

### Prérequis

- Docker & Docker Compose
- Node 20+
- Python 3.11+

### Démarrage

```bash
# 1. Cloner le repo
git clone https://github.com/Sinses66/sims-webmap.git
cd sims-webmap

# 2. Configurer l'environnement
cp .env.example .env
# Éditer .env avec vos valeurs

# 3. Lancer la stack Docker
docker compose up -d

# 4. Appliquer les migrations
docker exec sims_backend python manage.py migrate

# 5. Créer un superuser
docker exec -it sims_backend python manage.py createsuperuser

# 6. Lancer le frontend
cd eneo-webmap-frontend
npm install
npm run dev
```

L'application est accessible sur `http://localhost:5173`.
L'API est accessible sur `http://localhost:8000/api/`.

---

## Tests

### Backend

```bash
cd django_sims_core
python -m pytest sims_core/tests/ sims_network/tests/ -v
```

### Lint backend

```bash
cd django_sims_core
flake8 sims_core sims_network --max-line-length=120 --exclude=migrations
```

### Frontend

```bash
cd eneo-webmap-frontend
npm run test:run   # tests unitaires Vitest
npm run lint       # ESLint
```

---

## Modèle de données principal

```
Organisation
  └── Application
        └── ApplicationLayer (WMS / WFS)
        └── Dashboard
              └── DashboardWidget

UserProfile (User → Organisation, rôle : admin | superviseur | operateur | lecteur)

Incident (type, statut, priorité, localisation GPS, organisation)
  └── Intervention (type_travaux, statut, date_debut, date_fin)
```

### Rôles et permissions

| Rôle | Lecture | Création | Modification | Suppression |
|------|---------|----------|--------------|-------------|
| `lecteur` | ✓ | ✗ | ✗ | ✗ |
| `operateur` | ✓ | ✓ | ✓ (propres) | ✗ |
| `superviseur` | ✓ | ✓ | ✓ | ✗ |
| `admin` | ✓ | ✓ | ✓ | ✓ |
| superuser | ✓ | ✓ | ✓ | ✓ |

---

## Endpoints API principaux

| Méthode | URL | Description |
|---------|-----|-------------|
| `POST` | `/api/auth/token/` | Obtenir un token JWT (rate-limité) |
| `POST` | `/api/auth/token/refresh/` | Rafraîchir le token |
| `GET/POST` | `/api/incidents/` | Liste / création d'incidents |
| `GET/POST` | `/api/interventions/` | Liste / création d'interventions |
| `GET` | `/api/notifications/feed/` | Flux d'événements temps réel |
| `GET` | `/api/applications/{slug}/config/` | Config carte d'une application |
| `GET` | `/api/applications/{slug}/layers/` | Couches GeoServer d'une application |

---

## CI / CD

Le pipeline GitHub Actions (`.github/workflows/ci.yml`) exécute à chaque push :

1. **Lint** — flake8 sur `sims_core` et `sims_network`
2. **Tests** — pytest avec PostGIS service container

---

## Variables d'environnement

Voir `.env.example` pour la liste complète. Variables minimales requises :

```env
SECRET_KEY=...
DATABASE_URL=postgis://user:pass@localhost:5432/sims_db
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1
```
