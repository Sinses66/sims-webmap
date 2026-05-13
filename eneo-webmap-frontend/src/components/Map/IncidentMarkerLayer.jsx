/**
 * IncidentMarkerLayer
 * ===================
 * Affiche les incidents géolocalisés comme marqueurs Leaflet sur la carte.
 * - Couleur du marqueur = priorité (critique→rouge, haute→orange, moyenne→jaune, basse→vert)
 * - Popup au clic : titre, statut, priorité, date, bouton "Voir détails"
 * - Actualisation automatique toutes les 60 secondes
 * - S'affiche uniquement si showIncidentMarkers = true dans le store
 */

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useMap } from 'react-leaflet'
import { useIncidents } from '../../hooks/useGeoData'
import { useMapStore } from '../../store/mapStore'
import { INCIDENT_STATUS, INCIDENT_PRIORITE, INCIDENT_TYPES } from '../../config/constants'

// ── Couleurs par priorité ─────────────────────────────────────
const PRIORITY_COLORS = {
  critique: { fill: '#dc2626', stroke: '#991b1b', shadow: 'rgba(220,38,38,0.4)'  },
  haute:    { fill: '#ea580c', stroke: '#9a3412', shadow: 'rgba(234,88,12,0.4)'  },
  moyenne:  { fill: '#d97706', stroke: '#92400e', shadow: 'rgba(217,119,6,0.4)'  },
  basse:    { fill: '#16a34a', stroke: '#14532d', shadow: 'rgba(22,163,74,0.4)'  },
}

// ── SVG marker personnalisé ───────────────────────────────────
function makeSvgIcon(priorite, statut) {
  const c = PRIORITY_COLORS[priorite] || PRIORITY_COLORS.moyenne
  const isPulsing = statut === 'ouvert' || statut === 'en_cours'

  // Point d'exclamation pour incidents ouverts/en cours, check pour résolus
  const symbol = statut === 'resolu'
    ? `<polyline points="5,10 8,13 13,7" stroke="white" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<line x1="9" y1="5" x2="9" y2="10" stroke="white" stroke-width="2" stroke-linecap="round"/>
       <circle cx="9" cy="13" r="1" fill="white"/>`

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
      <defs>
        <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="${c.shadow}"/>
        </filter>
      </defs>
      <!-- Pin shape -->
      <path d="M14 2 C8.5 2 4 6.5 4 12 C4 20 14 34 14 34 C14 34 24 20 24 12 C24 6.5 19.5 2 14 2 Z"
            fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" filter="url(#shadow)"/>
      <!-- Inner circle -->
      <circle cx="14" cy="12" r="7" fill="rgba(0,0,0,0.15)"/>
      <!-- Symbole -->
      <g transform="translate(5, 5)">${symbol}</g>
    </svg>
  `

  return L.divIcon({
    html: `<div style="position:relative">${svg}${isPulsing ? `
      <div style="
        position:absolute; top:2px; right:-2px;
        width:8px; height:8px; border-radius:50%;
        background:${c.fill}; border:2px solid white;
        animation: pulse-ring 2s infinite;
      "></div>` : ''}</div>`,
    className: '',
    iconSize:    [28, 36],
    iconAnchor:  [14, 36],
    popupAnchor: [0, -38],
  })
}

// ── HTML du popup Leaflet ─────────────────────────────────────
function makePopupHtml(inc) {
  const priorite = INCIDENT_PRIORITE[inc.priorite] || INCIDENT_PRIORITE.moyenne
  const statut   = INCIDENT_STATUS[inc.statut]   || INCIDENT_STATUS.ouvert
  const type     = INCIDENT_TYPES.find(t => t.value === inc.type_incident)?.label || inc.type_incident_label || inc.type_incident

  const date = inc.date_signalement
    ? new Date(inc.date_signalement).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      })
    : ''

  return `
    <div style="
      font-family: system-ui, sans-serif;
      background: #0D1B2A;
      color: #fff;
      border-radius: 10px;
      overflow: hidden;
      min-width: 220px;
      max-width: 280px;
      font-size: 12px;
    ">
      <!-- En-tête priorité -->
      <div style="
        background: ${priorite.bg};
        border-bottom: 1px solid rgba(255,255,255,0.08);
        padding: 8px 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      ">
        <span style="color:${priorite.hex}; font-weight:700; font-size:11px; letter-spacing:0.05em; text-transform:uppercase">
          ⚠ ${priorite.label}
        </span>
        <span style="
          background: ${statut.bg};
          color: ${statut.hex};
          font-size:10px; font-weight:600;
          padding: 2px 8px; border-radius:20px;
        ">${statut.label}</span>
      </div>

      <!-- Corps -->
      <div style="padding: 10px 12px; space-y: 4px">
        <p style="font-weight:600; margin:0 0 4px; color:rgba(255,255,255,0.95); font-size:13px; line-height:1.3">
          ${inc.titre || type}
        </p>
        <p style="color:rgba(255,255,255,0.5); margin:0 0 6px; font-size:11px">${type}</p>

        ${inc.localisation || inc.ville ? `
        <p style="color:rgba(255,255,255,0.4); margin:0 0 4px; font-size:10px">
          📍 ${[inc.localisation, inc.ville].filter(Boolean).join(', ')}
        </p>` : ''}

        ${inc.assigne_a_detail ? `
        <p style="color:rgba(255,255,255,0.35); margin:0 0 4px; font-size:10px">
          👤 ${inc.assigne_a_detail.full_name}
        </p>` : ''}

        ${date ? `
        <p style="color:rgba(255,255,255,0.25); margin:0; font-size:10px">🕐 ${date}</p>
        ` : ''}
      </div>

      <!-- Actions -->
      <div style="
        padding: 8px 12px;
        border-top: 1px solid rgba(255,255,255,0.07);
        display: flex;
        gap: 8px;
      ">
        <button
          data-incident-id="${inc.id}"
          onclick="document.dispatchEvent(new CustomEvent('sims:openIncident', {detail:{id:${inc.id}}}))"
          style="
            flex: 1; padding: 5px 10px;
            background: #FF4757; color: #fff;
            border: none; border-radius: 6px;
            font-size: 11px; font-weight: 600;
            cursor: pointer;
          "
        >Voir l'incident</button>
      </div>
    </div>
  `
}

// ── Composant principal ───────────────────────────────────────
export default function IncidentMarkerLayer() {
  const map = useMap()
  const layerRef = useRef(null)
  const { setSidebarPanel, sidebarOpen, showIncidentMarkers } = useMapStore()

  // Charger TOUS les incidents avec coords (pas de filtre statut ici)
  const { data } = useIncidents({})
  const incidents = (data?.results ?? data ?? []).filter(
    inc => inc.latitude != null && inc.longitude != null
  )

  // Écouter l'événement "Voir l'incident" depuis le popup HTML
  useEffect(() => {
    const handler = (e) => {
      setSidebarPanel('incidents')
    }
    document.addEventListener('sims:openIncident', handler)
    return () => document.removeEventListener('sims:openIncident', handler)
  }, [setSidebarPanel])

  // Créer/mettre à jour les marqueurs
  useEffect(() => {
    if (!map) return

    // Supprimer l'ancienne couche
    if (layerRef.current) {
      layerRef.current.remove()
      layerRef.current = null
    }

    // Si couche masquée, ne rien afficher
    if (showIncidentMarkers === false) return

    // Pas d'incidents géolocalisés
    if (incidents.length === 0) return

    // Créer un LayerGroup
    const group = L.layerGroup()

    incidents.forEach(inc => {
      const icon   = makeSvgIcon(inc.priorite, inc.statut)
      const marker = L.marker([inc.latitude, inc.longitude], { icon, zIndexOffset: 500 })

      marker.bindPopup(makePopupHtml(inc), {
        maxWidth: 300,
        className: 'sims-incident-popup',
        closeButton: true,
      })

      group.addLayer(marker)
    })

    group.addTo(map)
    layerRef.current = group

    return () => {
      if (layerRef.current) {
        layerRef.current.remove()
        layerRef.current = null
      }
    }
  }, [map, incidents, showIncidentMarkers])

  return null
}
