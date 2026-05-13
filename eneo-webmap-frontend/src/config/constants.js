// ── Endpoints ────────────────────────────────────────────────
export const API_BASE_URL = '/api'
export const GEOSERVER_BASE_URL = '/geoserver'
export const GEOSERVER_WORKSPACE = 'ws'

// URL WMS / WFS
export const WMS_URL = `${GEOSERVER_BASE_URL}/${GEOSERVER_WORKSPACE}/wms`
export const WFS_URL = `${GEOSERVER_BASE_URL}/${GEOSERVER_WORKSPACE}/wfs`

// ── Carte ────────────────────────────────────────────────────
// Centre Cameroun (Yaoundé)
export const MAP_CENTER = [3.848, 11.502]
export const MAP_ZOOM   = 7
export const MAP_MIN_ZOOM = 5
export const MAP_MAX_ZOOM = 20

// Projection
export const EPSG_3857 = 'EPSG:3857'
export const EPSG_4326 = 'EPSG:4326'

// ── Fonds de carte ───────────────────────────────────────────
export const BASEMAPS = {
  osm: {
    id: 'osm',
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  satellite: {
    id: 'satellite',
    name: 'Satellite ESRI',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri, Maxar, GeoEye, Earthstar Geographics',
  },
  topo: {
    id: 'topo',
    name: 'OpenTopoMap',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '© OpenTopoMap contributors',
  },
  cartoDB: {
    id: 'cartoDB',
    name: 'CartoDB (clair)',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '© <a href="https://carto.com/">CARTO</a>',
  },
  cartoDBDark: {
    id: 'cartoDBDark',
    name: 'CartoDB (sombre)',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '© <a href="https://carto.com/">CARTO</a>',
  },
}

// ── Statuts d'incidents — valeurs backend (lowercase) ────────
export const INCIDENT_STATUS = {
  ouvert:   { label: 'Ouvert',              hex: '#ef4444', bg: 'rgba(239,68,68,0.15)'   },
  en_cours: { label: 'En cours',            hex: '#f59e0b', bg: 'rgba(245,158,11,0.15)'  },
  resolu:   { label: 'Résolu',              hex: '#10b981', bg: 'rgba(16,185,129,0.15)'  },
  ferme:    { label: 'Fermé',               hex: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
  annule:   { label: 'Annulé',              hex: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
}

// ── Priorités d'incidents ─────────────────────────────────────
export const INCIDENT_PRIORITE = {
  critique: { label: 'Critique', hex: '#dc2626', bg: 'rgba(220,38,38,0.15)'   },
  haute:    { label: 'Haute',    hex: '#ea580c', bg: 'rgba(234,88,12,0.15)'   },
  moyenne:  { label: 'Moyenne',  hex: '#d97706', bg: 'rgba(217,119,6,0.15)'   },
  basse:    { label: 'Basse',    hex: '#16a34a', bg: 'rgba(22,163,74,0.15)'   },
}

// ── Types d'incidents — valeurs backend ───────────────────────
export const INCIDENT_TYPES = [
  { value: 'panne_transfo',    label: 'Panne transformateur'   },
  { value: 'coupure_ligne',    label: 'Coupure de ligne'       },
  { value: 'court_circuit',    label: 'Court-circuit'          },
  { value: 'surcharge',        label: 'Surcharge réseau'       },
  { value: 'vandalisme',       label: 'Vandalisme / Vol'       },
  { value: 'chute_poteau',     label: 'Chute de poteau'        },
  { value: 'defaut_isolation', label: "Défaut d'isolation"     },
  { value: 'autre',            label: 'Autre'                  },
]

// ── Statuts d'interventions ───────────────────────────────────
export const INTERVENTION_STATUS = {
  planifiee: { label: 'Planifiée',  hex: '#6366f1', bg: 'rgba(99,102,241,0.15)'  },
  en_cours:  { label: 'En cours',   hex: '#f59e0b', bg: 'rgba(245,158,11,0.15)'  },
  terminee:  { label: 'Terminée',   hex: '#10b981', bg: 'rgba(16,185,129,0.15)'  },
  annulee:   { label: 'Annulée',    hex: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
}

// ── Types de travaux ──────────────────────────────────────────
export const TYPE_TRAVAUX = [
  { value: 'remplacement', label: 'Remplacement matériel' },
  { value: 'reparation',   label: 'Réparation'            },
  { value: 'maintenance',  label: 'Maintenance préventive' },
  { value: 'inspection',   label: 'Inspection'            },
  { value: 'autre',        label: 'Autre'                 },
]

// ── Niveaux de tension ───────────────────────────────────────
export const VOLTAGE_LEVELS = {
  HT:  { label: 'Haute Tension (HT)',  color: '#dc2626', min_kv: 63  },
  MT:  { label: 'Moyenne Tension (MT)', color: '#d97706', min_kv: 5  },
  BT:  { label: 'Basse Tension (BT)',  color: '#16a34a', min_kv: 0   },
}
