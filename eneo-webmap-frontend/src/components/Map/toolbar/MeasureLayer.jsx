import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import * as turf from '@turf/turf'
import toast from 'react-hot-toast'
import { useMapStore } from '../../../store/mapStore'

// ── Utilitaires d'affichage ────────────────────────────────────
function fmtDistance(meters) {
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(2)} km`
}

function fmtArea(sqm) {
  if (sqm < 10000) return `${Math.round(sqm)} m²`
  if (sqm < 1e6)   return `${(sqm / 10000).toFixed(2)} ha`
  return `${(sqm / 1e6).toFixed(4)} km²`
}

// ── Styles partagés ────────────────────────────────────────────
const COLOR      = '#8b5cf6'
const COLOR_LIVE = 'rgba(139,92,246,0.65)'

const LABEL_STYLE = `
  background:${COLOR};
  color:#fff;
  padding:2px 9px;
  border-radius:5px;
  font-size:12px;
  font-weight:600;
  white-space:nowrap;
  box-shadow:0 2px 8px rgba(0,0,0,0.35);
`
const LIVE_LABEL_STYLE = `
  background:rgba(139,92,246,0.75);
  color:#fff;
  padding:2px 8px;
  border-radius:5px;
  font-size:11px;
  font-weight:500;
  white-space:nowrap;
  pointer-events:none;
`

function makeLabel(text, live = false) {
  return L.divIcon({
    className: '',
    html: `<div style="${live ? LIVE_LABEL_STYLE : LABEL_STYLE}">${text}</div>`,
    iconAnchor: [-8, 8],
  })
}

/**
 * Couche de mesure interactive (distance & surface).
 * - Les tracés persistent après double-clic jusqu'au bouton "Effacer mesures".
 * - Surface affichée en temps réel pendant le dessin d'un polygone.
 * - Curseur crosshair géré via useEffect dédié.
 */
export default function MeasureLayer() {
  const map = useMap()
  const { drawMode, setDrawMode, clearMeasureSignal } = useMapStore()

  // ── Session active (points en cours, rubber band, label live) ──
  const sessionRef = useRef({
    points:     [],
    rubberLine: null,
    liveLabel:  null,
    markers:    [],
  })

  // ── Tracés terminés (persistent jusqu'au signal clear) ─────────
  const finishedRef = useRef([])   // tableau de L.Layer

  // ── 1. Curseur crosshair ──────────────────────────────────────
  useEffect(() => {
    const isMeasure = drawMode === 'measure_distance' || drawMode === 'measure_area'
    map.getContainer().style.cursor = isMeasure ? 'crosshair' : ''
  }, [drawMode, map])

  // ── 2. Signal "Effacer mesures" ───────────────────────────────
  useEffect(() => {
    if (clearMeasureSignal === 0) return
    cleanupSession()
    finishedRef.current.forEach(l => map.removeLayer(l))
    finishedRef.current = []
  }, [clearMeasureSignal]) // eslint-disable-line

  // ── 3. Logique de dessin ──────────────────────────────────────
  useEffect(() => {
    const active = drawMode === 'measure_distance' || drawMode === 'measure_area'

    if (!active) {
      // Quand on quitte le mode : on garde les tracés terminés,
      // on nettoie seulement la session en cours (rubber band + label live)
      cleanupSession()
      return
    }

    const isDistance = drawMode === 'measure_distance'

    // ── Clic : ajoute un sommet ─────────────────────────────────
    const onMapClick = (e) => {
      L.DomEvent.stopPropagation(e)
      const { points, markers } = sessionRef.current
      points.push(e.latlng)

      const m = L.circleMarker(e.latlng, {
        radius: 5, fillColor: COLOR, color: '#fff', weight: 2, fillOpacity: 1,
        pane: 'markerPane',
      }).addTo(map)
      markers.push(m)

      redrawActive(isDistance)
    }

    // ── Mousemove : rubber band + label live ─────────────────────
    const onMouseMove = (e) => {
      const { points } = sessionRef.current
      if (points.length === 0) return

      const allPts = [...points, e.latlng]

      // Rubber band
      if (sessionRef.current.rubberLine) {
        sessionRef.current.rubberLine.setLatLngs(allPts)
      } else {
        sessionRef.current.rubberLine = L.polyline(allPts, {
          color: COLOR, weight: 2, dashArray: '5,5', opacity: 0.6, interactive: false,
        }).addTo(map)
      }

      // Label live
      if (sessionRef.current.liveLabel) {
        map.removeLayer(sessionRef.current.liveLabel)
        sessionRef.current.liveLabel = null
      }

      if (isDistance) {
        // Distance totale provisoire
        let total = 0
        for (let i = 1; i < allPts.length; i++) {
          total += allPts[i - 1].distanceTo(allPts[i])
        }
        sessionRef.current.liveLabel = L.marker(e.latlng, {
          icon: makeLabel(`📏 ${fmtDistance(total)}`, true), interactive: false,
        }).addTo(map)
      } else if (allPts.length >= 3) {
        // Surface provisoire du polygone en cours
        try {
          const coords = [...allPts.map(p => [p.lng, p.lat]), [allPts[0].lng, allPts[0].lat]]
          const poly   = turf.polygon([coords])
          const area   = turf.area(poly)
          const center = turf.centerOfMass(poly)
          const [lng, lat] = center.geometry.coordinates
          sessionRef.current.liveLabel = L.marker(L.latLng(lat, lng), {
            icon: makeLabel(`📐 ${fmtArea(area)}`, true), interactive: false,
          }).addTo(map)
        } catch (_) { /* points colinéaires ou invalides */ }
      }
    }

    // ── Double-clic : finalise et conserve le tracé ──────────────
    const onDblClick = (e) => {
      L.DomEvent.stopPropagation(e)
      const { points, markers } = sessionRef.current
      if (points.length < 2) { cleanupSession(); return }

      // Nettoie rubber band + label live
      if (sessionRef.current.rubberLine) { map.removeLayer(sessionRef.current.rubberLine) }
      if (sessionRef.current.liveLabel)  { map.removeLayer(sessionRef.current.liveLabel) }

      const savedLayers = []

      // Sauvegarde les marqueurs de sommets
      markers.forEach(m => savedLayers.push(m))

      if (isDistance) {
        // Polyline finale
        const line = L.polyline(points, {
          color: COLOR, weight: 2.5, dashArray: '6,4', interactive: false,
        }).addTo(map)
        savedLayers.push(line)

        // Étiquette résultat
        let total = 0
        for (let i = 1; i < points.length; i++) total += points[i-1].distanceTo(points[i])
        const lbl = L.marker(points[points.length - 1], {
          icon: makeLabel(`📏 ${fmtDistance(total)}`), interactive: false,
        }).addTo(map)
        savedLayers.push(lbl)

        toast.success(`Distance : ${fmtDistance(total)}`, { duration: 6000 })
      } else {
        if (points.length < 3) { cleanupSession(); return }

        // Polygon final
        const poly = L.polygon(points, {
          color: COLOR, fillColor: COLOR, fillOpacity: 0.12,
          weight: 2.5, dashArray: '6,4', interactive: false,
        }).addTo(map)
        savedLayers.push(poly)

        // Polyline de contour
        const line = L.polyline([...points, points[0]], {
          color: COLOR, weight: 2.5, dashArray: '6,4', interactive: false,
        }).addTo(map)
        savedLayers.push(line)

        // Étiquette résultat au centre
        try {
          const tPoly  = turf.polygon([[...points.map(p => [p.lng, p.lat]), [points[0].lng, points[0].lat]]])
          const area   = turf.area(tPoly)
          const center = turf.centerOfMass(tPoly)
          const [lng, lat] = center.geometry.coordinates
          const lbl = L.marker(L.latLng(lat, lng), {
            icon: makeLabel(`📐 ${fmtArea(area)}`), interactive: false,
          }).addTo(map)
          savedLayers.push(lbl)
          toast.success(`Surface : ${fmtArea(area)}`, { duration: 6000 })
        } catch (_) {}
      }

      // Archive les calques dans finishedRef
      finishedRef.current.push(...savedLayers)

      // Remet la session à zéro pour une nouvelle mesure (sans quitter le mode)
      sessionRef.current = { points: [], rubberLine: null, liveLabel: null, markers: [] }
    }

    // ── Échap : annule la session courante ───────────────────────
    const onKeyDown = (e) => {
      if (e.key === 'Escape') { cleanupSession(); setDrawMode(null) }
    }

    map.on('click',     onMapClick)
    map.on('mousemove', onMouseMove)
    map.on('dblclick',  onDblClick)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      map.off('click',     onMapClick)
      map.off('mousemove', onMouseMove)
      map.off('dblclick',  onDblClick)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [drawMode, map, setDrawMode])

  // ── Nettoyage de la session active uniquement ────────────────
  function cleanupSession() {
    const s = sessionRef.current
    if (s.rubberLine) map.removeLayer(s.rubberLine)
    if (s.liveLabel)  map.removeLayer(s.liveLabel)
    s.markers.forEach(m => map.removeLayer(m))
    sessionRef.current = { points: [], rubberLine: null, liveLabel: null, markers: [] }
  }

  return null
}
