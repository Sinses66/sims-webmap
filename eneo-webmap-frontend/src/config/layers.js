/**
 * Configuration des couches GeoServer ENEO — workspace : eneo_gis_ws
 * Noms extraits du GetCapabilities WMS (16 couches publiées).
 *
 * type 'WMS'  → rendu serveur (TileLayer) — idéal pour les linéaires denses
 * type 'WFS'  → vecteurs client (GeoJSON) — idéal pour les points interactifs
 */

const WS = 'ws'

export const LAYER_GROUPS = [
  // ── 1. RÉSEAU HTB EXISTANT ────────────────────────────────────────────────
  {
    id:    'htb_existant',
    label: 'Réseau HTB Existant',
    icon:  '⚡',
    layers: [
      {
        id:              'cmr_reseau_htb',
        name:            'Réseau HTB (national)',
        geoserverLayer:  `${WS}:cmrReseauHTB`,
        type:            'WMS',
        visible:         true,
        opacity:         0.9,
        color:           '#dc2626',
        description:     'Réseau haute tension B national existant',
      },
      {
        id:              'reseau_htb_existant',
        name:            'HTB Existant (détail)',
        geoserverLayer:  `${WS}:Reseau_HTB_Existant`,
        type:            'WMS',
        visible:         false,
        opacity:         0.9,
        color:           '#b91c1c',
        description:     'Réseau HTB existant — vue détaillée',
      },
      {
        id:              'cmr_existant_reseau_htb',
        name:            'HTB Existant (simplifié)',
        geoserverLayer:  `${WS}:cmrExistantReseauHTB`,
        type:            'WMS',
        visible:         false,
        opacity:         0.8,
        color:           '#ef4444',
        description:     'Réseau HTB existant — version simplifiée',
      },
      {
        id:              'ouvrages_htb_existant',
        name:            'Ouvrages HTB Existants',
        geoserverLayer:  `${WS}:Ouvrages_HTB_Existant`,
        type:            'WFS',
        visible:         true,
        opacity:         1,
        color:           '#dc2626',
        description:     'Ouvrages (pylônes, équipements) HTB existants',
      },
    ],
  },

  // ── 2. RÉSEAU HTB PROJET ──────────────────────────────────────────────────
  {
    id:    'htb_projet',
    label: 'Réseau HTB Projet',
    icon:  '🔧',
    layers: [
      {
        id:              'ligne_htb_projet',
        name:            'Lignes HTB Projet',
        geoserverLayer:  `${WS}:Ligne_HTB_Projet`,
        type:            'WMS',
        visible:         false,
        opacity:         0.85,
        color:           '#f97316',
        description:     'Tracé des lignes HTB en projet',
      },
      {
        id:              'ouvrage_htb_projet',
        name:            'Ouvrages HTB Projet',
        geoserverLayer:  `${WS}:Ouvrage_HTB_Projet`,
        type:            'WFS',
        visible:         false,
        opacity:         1,
        color:           '#f97316',
        description:     'Ouvrages HTB prévus (pylônes, postes)',
      },
    ],
  },

  // ── 3. RÉSEAU HTA (MOYENNE TENSION) ──────────────────────────────────────
  {
    id:    'hta',
    label: 'Réseau HTA / MT',
    icon:  '🔌',
    layers: [
      {
        id:              'cmr_reseau_hta',
        name:            'Réseau HTA (national)',
        geoserverLayer:  `${WS}:cmrReseauHTA`,
        type:            'WMS',
        visible:         true,
        opacity:         0.9,
        color:           '#d97706',
        description:     'Réseau moyenne tension national existant',
      },
      {
        id:              'projet_reseau_hta',
        name:            'Réseau HTA Projet',
        geoserverLayer:  `${WS}:Projet_Reseau_HTA`,
        type:            'WMS',
        visible:         false,
        opacity:         0.85,
        color:           '#fbbf24',
        description:     'Extensions HTA planifiées',
      },
      {
        id:              'cmr_poste_source',
        name:            'Postes Sources',
        geoserverLayer:  `${WS}:cmrPosteSource`,
        type:            'WFS',
        visible:         true,
        opacity:         1,
        color:           '#b45309',
        description:     'Postes sources HTA/HTB',
      },
      {
        id:              'projet_poste_hta',
        name:            'Postes HTA Projet',
        geoserverLayer:  `${WS}:Projet_Poste_HTA`,
        type:            'WFS',
        visible:         false,
        opacity:         1,
        color:           '#fbbf24',
        description:     'Postes HTA en projet',
      },
    ],
  },

  // ── 4. RÉSEAU BT (BASSE TENSION) ─────────────────────────────────────────
  {
    id:    'bt',
    label: 'Réseau BT / Distribution',
    icon:  '💡',
    layers: [
      {
        id:              'bt_drd_dry',
        name:            'BT DRD/DRY',
        geoserverLayer:  `${WS}:bt_drd_dry`,
        type:            'WMS',
        visible:         false,
        opacity:         0.8,
        color:           '#16a34a',
        description:     'Réseau basse tension — agences DRD/DRY',
      },
      {
        id:              'projet_reseau_bt',
        name:            'Réseau BT Projet',
        geoserverLayer:  `${WS}:Projet_Reseau_BT`,
        type:            'WMS',
        visible:         false,
        opacity:         0.8,
        color:           '#22c55e',
        description:     'Extensions BT planifiées',
      },
      {
        id:              'projets_reseau_bt',
        name:            'Projets Réseau BT',
        geoserverLayer:  `${WS}:Projets_Reseau_BT`,
        type:            'WMS',
        visible:         false,
        opacity:         0.75,
        color:           '#4ade80',
        description:     'Ensemble des projets réseau BT',
      },
      {
        id:              'cmr_poste_distribution',
        name:            'Postes de Distribution',
        geoserverLayer:  `${WS}:cmrPosteDistribution`,
        type:            'WFS',
        visible:         true,
        opacity:         1,
        color:           '#15803d',
        description:     'Postes de distribution MT/BT (transformateurs)',
      },
    ],
  },

  // ── 5. DÉCOUPAGE ADMINISTRATIF / DRD ─────────────────────────────────────
  {
    id:    'admin',
    label: 'Découpage DRD / Zones',
    icon:  '🗺️',
    layers: [
      {
        id:              'ilotsdrd',
        name:            'Îlots DRD',
        geoserverLayer:  `${WS}:ilotsdrd`,
        type:            'WMS',
        visible:         false,
        opacity:         0.35,
        color:           '#6366f1',
        description:     'Découpage en îlots par Direction Régionale',
      },
      {
        id:              'pl_drd_dry',
        name:            'PL DRD/DRY',
        geoserverLayer:  `${WS}:pl_drd_dry`,
        type:            'WFS',
        visible:         false,
        opacity:         0.8,
        color:           '#818cf8',
        description:     'Points de livraison par agence DRD/DRY',
      },
    ],
  },
]

