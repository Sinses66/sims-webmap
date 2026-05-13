# ENEO GIS — Frontend React

Application Webmapping interactive pour la gestion du réseau électrique ENEO Cameroun.

## Stack technique

| Couche       | Technologie                        |
|--------------|------------------------------------|
| Framework    | React 18 + Vite 5                  |
| Carte        | Leaflet 1.9 + React-Leaflet 4      |
| État global  | Zustand                            |
| Data-fetching| TanStack React Query v5            |
| HTTP         | Axios                              |
| Styles       | Tailwind CSS 3                     |
| Routing      | React Router DOM v6                |
| Géométrie    | Turf.js                            |
| Dessin       | leaflet-draw + react-leaflet-draw  |

## Prérequis

- Node.js ≥ 18
- npm ≥ 9
- GeoServer en cours d'exécution sur `http://localhost:8080`
- GeoDjango en cours d'exécution sur `http://localhost:8001`

## Installation

```bash
# 1. Se placer dans le dossier du projet
cd eneo-webmap-frontend

# 2. Installer les dépendances
npm install

# 3. Lancer le serveur de développement
npm run dev
```

L'application sera accessible sur **http://localhost:3000**

## Architecture des fichiers

```
src/
├── App.jsx                        # Routeur principal
├── main.jsx                       # Point d'entrée
├── index.css                      # Styles globaux + Tailwind
│
├── config/
│   ├── constants.js               # URLs, centre carte, statuts
│   └── layers.js                  # Définition des couches GeoServer
│
├── store/
│   ├── mapStore.js                # État carte (Zustand)
│   └── authStore.js               # Session utilisateur (Zustand)
│
├── services/
│   ├── api.js                     # Client Axios → GeoDjango
│   └── geoserver.js               # WMS GetFeatureInfo / WFS GetFeature
│
├── hooks/
│   └── useGeoData.js              # Hooks React Query (incidents, WFS…)
│
├── components/
│   ├── Auth/
│   │   ├── LoginForm.jsx          # Formulaire de connexion JWT
│   │   └── ProtectedRoute.jsx     # Garde de route
│   │
│   ├── Layout/
│   │   ├── AppLayout.jsx          # Shell : Navbar + <Outlet>
│   │   └── Navbar.jsx             # Barre supérieure
│   │
│   ├── Map/
│   │   ├── MapView.jsx            # <MapContainer> principal
│   │   ├── WMSLayer.jsx           # Couche TileLayer WMS GeoServer
│   │   ├── WFSLayer.jsx           # Couche GeoJSON interactive (WFS)
│   │   ├── MapEventHandler.jsx    # Clic carte → GetFeatureInfo
│   │   ├── FeaturePopup.jsx       # Popup d'entité sélectionnée
│   │   └── DrawToolbar.jsx        # Outils mesure distance / surface
│   │
│   ├── Sidebar/
│   │   ├── Sidebar.jsx            # Panneau latéral + navigation
│   │   ├── LayerManager.jsx       # Toggle couches + opacité + légende
│   │   ├── AttributeTable.jsx     # Tableau attributaire bas de page
│   │   ├── SearchPanel.jsx        # Recherche entités + géocodage
│   │   └── AnalyticsPanel.jsx     # KPIs réseau et incidents
│   │
│   ├── Incidents/
│   │   └── IncidentPanelMini.jsx  # Liste + création d'incidents
│   │
│   └── Interventions/
│       └── InterventionPanelMini.jsx # Liste + planification d'interventions
│
└── pages/
    ├── MapPage.jsx                # Page principale (carte)
    └── LoginPage.jsx              # Page de connexion
```

## Proxy Vite (développement)

Le fichier `vite.config.js` configure deux proxies pour éviter les problèmes CORS :

| Chemin       | Cible                     |
|--------------|---------------------------|
| `/api/*`     | `http://localhost:8001`   |
| `/geoserver/*` | `http://localhost:8080` |

## Démarrer toute la stack

### 1 — Base de données PostGIS (WSL)
```bash
# WSL Ubuntu
sudo service postgresql start
```

### 2 — GeoServer
```bash
# WSL Ubuntu
sudo GEOSERVER_HOME=/opt/geoserver \
     JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64 \
     bash /opt/geoserver/bin/startup.sh
```

### 3 — GeoDjango (backend)
```bash
cd ~/projects/eneo_webmap
source venv/bin/activate
python manage.py runserver 8001
```

### 4 — Frontend React
```bash
cd eneo-webmap-frontend
npm run dev
```

## Ajouter une couche GeoServer

1. Publier la couche dans GeoServer (workspace `eneo_gis_ws`)
2. Ajouter une entrée dans `src/config/layers.js` dans le groupe approprié
3. Le LayerManager et la carte la prendront en compte automatiquement

## Build production

```bash
npm run build
# Les fichiers sont dans /dist — à servir via Nginx ou Django static files
```

## Prochaines évolutions

- [ ] Pages dédiées Incidents / Interventions (tableaux complets + filtres avancés)
- [ ] Édition géométrique sur la carte (création de postes, tracé de lignes)
- [ ] Authentification par rôles (lecture seule / opérateur / admin)
- [ ] Export cartographique (impression PDF / PNG)
- [ ] Mode hors-ligne (Service Worker + cache tuiles)
- [ ] Notifications temps réel (WebSocket Django Channels)
