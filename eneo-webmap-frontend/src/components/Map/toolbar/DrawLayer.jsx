import { useEffect, useRef, useState, useCallback } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { useMapStore } from '../../../store/mapStore'
import toast from 'react-hot-toast'

// ── Styles ────────────────────────────────────────────────────
const COLORS = {
  point:   '#f59e0b',
  line:    '#3b82f6',
  polygon: '#10b981',
  text:    '#f1f5f9',
}

function pointIcon(color = COLORS.point) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:12px; height:12px;
      background:${color}; border:2px solid #fff;
      border-radius:50%;
      box-shadow:0 2px 6px rgba(0,0,0,0.4);
    "></div>`,
    iconSize:   [12, 12],
    iconAnchor: [6, 6],
  })
}

function textIcon(text, color = COLORS.text) {
  return L.divIcon({
    className: '',
    html: `<div style="
      background:rgba(15,23,42,0.88);
      color:${color};
      padding:3px 9px;
      border-radius:5px;
      font-size:13px;
      font-weight:500;
      white-space:nowrap;
      box-shadow:0 2px 8px rgba(0,0,0,0.4);
      border:1px solid rgba(255,255,255,0.12);
      backdrop-filter:blur(4px);
      cursor:default;
    ">${text}</div>`,
    iconAnchor: [0, 10],
  })
}

/**
 * Couche de dessin interactive.
 * Modes gérés via drawMode du store :
 *   draw_point    → clic = marqueur ponctuel
 *   draw_line     → clics = polyligne, double-clic pour finir
 *   draw_polygon  → clics = polygone, double-clic pour finir
 *   draw_text     → clic = saisie texte flottante, Entrée pour valider
 *
 * clearDrawingsSignal → efface toutes les annotations
 */
export default function DrawLayer() {
  const map = useMap()
  const { drawMode, setDrawMode, clearDrawingsSignal } = useMapStore()

  // Groupe Leaflet permanent pour les dessins terminés
  const drawnGroupRef = useRef(null)

  // Dessin en cours (temporaire)
  const activeRef = useRef({
    points:     [],
    polyline:   null,
    rubberLine: null,
    markers:    [],
  })

  // Saisie texte : { containerPoint, latlng }
  const [textPrompt, setTextPrompt] = useState(null)
  const [textValue,  setTextValue]  = useState('')

  // ── Initialisation du groupe permanent ──────────────────────
  useEffect(() => {
    drawnGroupRef.current = L.layerGroup().addTo(map)
    return () => { if (drawnGroupRef.current) map.removeLayer(drawnGroupRef.current) }
  }, [map])

  // ── Signal "effacer tout" ────────────────────────────────────
  useEffect(() => {
    if (clearDrawingsSignal === 0) return
    if (drawnGroupRef.current) drawnGroupRef.current.clearLayers()
    cancelActive()
    setTextPrompt(null)
  }, [clearDrawingsSignal])   // eslint-disable-line

  // ── Gestion des modes de dessin ──────────────────────────────
  useEffect(() => {
    if (!drawMode?.startsWith('draw_')) {
      cancelActive()
      return
    }

    map.getContainer().style.cursor = 'crosshair'

    // ── Point ──────────────────────────────────────────────────
    if (drawMode === 'draw_point') {
      const onClick = (e) => {
        L.DomEvent.stopPropagation(e)
        L.marker(e.latlng, { icon: pointIcon(), interactive: false })
          .addTo(drawnGroupRef.current)
        toast('📍 Point ajouté', { duration: 2000 })
      }
      map.on('click', onClick)
      return () => { map.off('click', onClick); map.getContainer().style.cursor = '' }
    }

    // ── Texte ──────────────────────────────────────────────────
    if (drawMode === 'draw_text') {
      const onClick = (e) => {
        L.DomEvent.stopPropagation(e)
        setTextValue('')
        setTextPrompt({
          latlng:         e.latlng,
          containerPoint: map.latLngToContainerPoint(e.latlng),
        })
        setDrawMode(null)  // outil se désactive après 1 clic (le prompt gère la suite)
      }
      map.on('click', onClick)
      return () => { map.off('click', onClick); map.getContainer().style.cursor = '' }
    }

    // ── Ligne ──────────────────────────────────────────────────
    if (drawMode === 'draw_line') {
      const onClick = (e) => {
        L.DomEvent.stopPropagation(e)
        const { points, markers } = activeRef.current
        points.push(e.latlng)
        markers.push(L.circleMarker(e.latlng, {
          radius: 4, fillColor: COLORS.line, color: '#fff', weight: 2, fillOpacity: 1, interactive: false,
        }).addTo(map))
        redrawLine()
      }
      const onMove = (e) => {
        const { points, rubberLine } = activeRef.current
        if (!points.length) return
        const coords = [...points, e.latlng]
        if (rubberLine) rubberLine.setLatLngs(coords)
        else activeRef.current.rubberLine = L.polyline(coords, {
          color: COLORS.line, weight: 2, dashArray: '5,5', opacity: 0.6, interactive: false,
        }).addTo(map)
      }
      const onDbl = (e) => {
        L.DomEvent.stopPropagation(e)
        const { points } = activeRef.current
        if (points.length >= 2) {
          L.polyline(points, { color: COLORS.line, weight: 2.5, interactive: false })
            .addTo(drawnGroupRef.current)
        }
        cancelActive()
        setDrawMode(null)
        toast('📏 Ligne enregistrée', { duration: 2000 })
      }
      const onKey = (e) => { if (e.key === 'Escape') { cancelActive(); setDrawMode(null) } }

      map.on('click', onClick)
      map.on('mousemove', onMove)
      map.on('dblclick', onDbl)
      window.addEventListener('keydown', onKey)
      return () => {
        map.off('click', onClick); map.off('mousemove', onMove); map.off('dblclick', onDbl)
        window.removeEventListener('keydown', onKey)
        map.getContainer().style.cursor = ''
      }
    }

    // ── Polygone ───────────────────────────────────────────────
    if (drawMode === 'draw_polygon') {
      const onClick = (e) => {
        L.DomEvent.stopPropagation(e)
        const { points, markers } = activeRef.current
        points.push(e.latlng)
        markers.push(L.circleMarker(e.latlng, {
          radius: 4, fillColor: COLORS.polygon, color: '#fff', weight: 2, fillOpacity: 1, interactive: false,
        }).addTo(map))
        redrawPolygon()
      }
      const onMove = (e) => {
        const { points, rubberLine } = activeRef.current
        if (!points.length) return
        const coords = [...points, e.latlng, points[0]]
        if (rubberLine) rubberLine.setLatLngs(coords)
        else activeRef.current.rubberLine = L.polyline(coords, {
          color: COLORS.polygon, weight: 2, dashArray: '5,5', opacity: 0.6, interactive: false,
        }).addTo(map)
      }
      const onDbl = (e) => {
        L.DomEvent.stopPropagation(e)
        const { points } = activeRef.current
        if (points.length >= 3) {
          L.polygon(points, {
            color: COLORS.polygon, fillColor: COLORS.polygon,
            fillOpacity: 0.15, weight: 2, interactive: false,
          }).addTo(drawnGroupRef.current)
        }
        cancelActive()
        setDrawMode(null)
        toast('⬡ Polygone enregistré', { duration: 2000 })
      }
      const onKey = (e) => { if (e.key === 'Escape') { cancelActive(); setDrawMode(null) } }

      map.on('click', onClick)
      map.on('mousemove', onMove)
      map.on('dblclick', onDbl)
      window.addEventListener('keydown', onKey)
      return () => {
        map.off('click', onClick); map.off('mousemove', onMove); map.off('dblclick', onDbl)
        window.removeEventListener('keydown', onKey)
        map.getContainer().style.cursor = ''
      }
    }
  }, [drawMode, map, setDrawMode])  // eslint-disable-line

  // ── Redessine polyligne active ───────────────────────────────
  function redrawLine() {
    const { points, polyline } = activeRef.current
    if (points.length < 2) return
    if (polyline) map.removeLayer(polyline)
    activeRef.current.polyline = L.polyline(points, {
      color: COLORS.line, weight: 2.5, dashArray: '6,4', interactive: false,
    }).addTo(map)
  }

  function redrawPolygon() {
    const { points, polyline } = activeRef.current
    if (points.length < 2) return
    if (polyline) map.removeLayer(polyline)
    activeRef.current.polyline = L.polygon(points, {
      color: COLORS.polygon, fillColor: COLORS.polygon,
      fillOpacity: 0.1, weight: 2, dashArray: '6,4', interactive: false,
    }).addTo(map)
  }

  // ── Annule le dessin en cours ────────────────────────────────
  function cancelActive() {
    const s = activeRef.current
    if (s.polyline)   map.removeLayer(s.polyline)
    if (s.rubberLine) map.removeLayer(s.rubberLine)
    s.markers.forEach(m => map.removeLayer(m))
    activeRef.current = { points: [], polyline: null, rubberLine: null, markers: [] }
    map.getContainer().style.cursor = ''
  }

  // ── Valide l'annotation texte ────────────────────────────────
  const confirmText = useCallback(() => {
    if (!textPrompt || !textValue.trim()) { setTextPrompt(null); return }
    L.marker(textPrompt.latlng, { icon: textIcon(textValue.trim()), interactive: false })
      .addTo(drawnGroupRef.current)
    toast('✍️ Annotation ajoutée', { duration: 2000 })
    setTextPrompt(null)
    setTextValue('')
  }, [textPrompt, textValue])

  // ── Import GeoJSON / KML ─────────────────────────────────────
  // (appelé depuis MapToolbar via un <input type="file"> déclenché programmatiquement)

  // ── Rendu ────────────────────────────────────────────────────
  if (!textPrompt) return null

  // Input texte flottant positionné à l'endroit du clic
  const { x, y } = textPrompt.containerPoint
  return (
    <div style={{
      position: 'absolute',
      left: x + 10,
      top:  y - 20,
      zIndex: 1001,
      display: 'flex',
      gap: 4,
      pointerEvents: 'auto',
    }}>
      <input
        autoFocus
        value={textValue}
        onChange={e => setTextValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') confirmText()
          if (e.key === 'Escape') { setTextPrompt(null); setTextValue('') }
        }}
        placeholder="Tapez votre annotation…"
        style={{
          background: 'rgba(15,23,42,0.95)',
          border: '1px solid rgba(139,92,246,0.6)',
          borderRadius: 6,
          color: '#f1f5f9',
          padding: '5px 10px',
          fontSize: 13,
          outline: 'none',
          width: 220,
          boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
        }}
      />
      <button onClick={confirmText} style={{
        background: '#8b5cf6', border: 'none', borderRadius: 6,
        color: '#fff', padding: '5px 10px', cursor: 'pointer', fontSize: 13,
      }}>✓</button>
      <button onClick={() => { setTextPrompt(null); setTextValue('') }} style={{
        background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6,
        color: '#fff', padding: '5px 8px', cursor: 'pointer', fontSize: 13,
      }}>✕</button>
    </div>
  )
}
