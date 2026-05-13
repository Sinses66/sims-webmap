import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { useQueryClient } from '@tanstack/react-query'
import L from 'leaflet'
import * as turf from '@turf/turf'
import { useMapStore } from '../../../store/mapStore'
import { useAppLayers } from '../../../hooks/useGeoData'
import toast from 'react-hot-toast'
import { useAppContext } from '../../../context/AppContext'

const SEL_COLOR = '#6366f1'
const HL_COLOR  = '#FBBF24'   // jaune surbrillance

function boundsToGeoJSON(bounds) {
  const sw = bounds.getSouthWest()
  const ne = bounds.getNorthEast()
  return turf.polygon([[
    [sw.lng, sw.lat], [ne.lng, sw.lat],
    [ne.lng, ne.lat], [sw.lng, ne.lat],
    [sw.lng, sw.lat],
  ]])
}

function latlngsToGeoJSON(latlngs) {
  const coords = latlngs.map(p => [p.lng, p.lat])
  coords.push(coords[0])
  return turf.polygon([coords])
}

export default function SelectionLayer() {
  const { appSlug } = useAppContext()
  const map         = useMap()
  const queryClient = useQueryClient()
  const {
    drawMode, setDrawMode,
    layerStates, selectionResults, setSelectionResults,
  } = useMapStore()
  const { layerGroups } = useAppLayers(appSlug)

  const shapeRef     = useRef(null)
  const polyRef      = useRef({ points: [], markers: [], rubberLine: null, polyline: null })
  const highlightRef = useRef(null)   // groupe surbrillance jaune

  // ── Groupe de surbrillance permanent ────────────────────────
  useEffect(() => {
    highlightRef.current = L.layerGroup().addTo(map)
    return () => { if (highlightRef.current) map.removeLayer(highlightRef.current) }
  }, [map])

  // ── Surbrillance jaune des features sélectionnées ───────────
  useEffect(() => {
    if (!highlightRef.current) return
    highlightRef.current.clearLayers()
    if (!selectionResults.length) return

    selectionResults.forEach(({ feature }) => {
      if (!feature.geometry) return
      try {
        L.geoJSON(feature, {
          style: {
            color:       HL_COLOR,
            fillColor:   HL_COLOR,
            fillOpacity: 0.35,
            weight:      3,
          },
          pointToLayer: (_, latlng) => L.circleMarker(latlng, {
            radius:      10,
            fillColor:   HL_COLOR,
            color:       '#fff',
            weight:      2.5,
            fillOpacity: 0.9,
          }),
        }).addTo(highlightRef.current)
      } catch { /* géométrie invalide */ }
    })
  }, [selectionResults])

  // ── Requête spatiale ─────────────────────────────────────────
  function runQuery(selectionGeoJSON) {
    const results = []

    layerGroups.flatMap(g => g.layers).forEach(layer => {
      if (layer.type !== 'WFS') return
      if (!layerStates[layer.id]?.visible) return

      const cached = queryClient.getQueryData(['wfs', layer.geoserverLayer, {}])
      if (!cached?.features) return

      cached.features.forEach(feature => {
        if (!feature.geometry) return
        try {
          const hit = feature.geometry.type === 'Point'
            ? turf.booleanPointInPolygon(
                turf.point(feature.geometry.coordinates), selectionGeoJSON)
            : turf.booleanIntersects(selectionGeoJSON, feature)

          if (hit) results.push({ feature, layerId: layer.id, layerName: layer.name })
        } catch { /* skip */ }
      })
    })

    setSelectionResults(results)
    if (!results.length) toast('Aucune entité dans la sélection', { icon: 'ℹ️' })
    else toast.success(`${results.length} entité(s) sélectionnée(s)`)
  }

  function clearShape() {
    if (shapeRef.current) { map.removeLayer(shapeRef.current); shapeRef.current = null }
  }
  function clearPoly() {
    const s = polyRef.current
    if (s.polyline)   map.removeLayer(s.polyline)
    if (s.rubberLine) map.removeLayer(s.rubberLine)
    s.markers.forEach(m => map.removeLayer(m))
    polyRef.current = { points: [], markers: [], rubberLine: null, polyline: null }
  }

  // ── Sélection RECTANGLE ──────────────────────────────────────
  useEffect(() => {
    if (drawMode !== 'select_rect') return
    map.getContainer().style.cursor = 'crosshair'
    let startPt = null

    const onDown = (e) => { L.DomEvent.preventDefault(e); startPt = e.latlng; map.dragging.disable() }
    const onMove = (e) => {
      if (!startPt) return
      const b = L.latLngBounds(startPt, e.latlng)
      if (shapeRef.current) shapeRef.current.setBounds(b)
      else shapeRef.current = L.rectangle(b, {
        color: SEL_COLOR, weight: 2, dashArray: '5,4',
        fillColor: SEL_COLOR, fillOpacity: 0.08, interactive: false,
      }).addTo(map)
    }
    const onUp = (e) => {
      map.dragging.enable()
      if (!startPt) return
      const b = L.latLngBounds(startPt, e.latlng)
      if (!b.getNorthEast().equals(b.getSouthWest())) runQuery(boundsToGeoJSON(b))
      clearShape(); startPt = null; setDrawMode(null)
    }

    map.on('mousedown', onDown); map.on('mousemove', onMove); map.on('mouseup', onUp)
    return () => {
      map.off('mousedown', onDown); map.off('mousemove', onMove); map.off('mouseup', onUp)
      map.dragging.enable(); map.getContainer().style.cursor = ''; clearShape()
    }
  }, [drawMode])  // eslint-disable-line

  // ── Sélection POLYGONE ───────────────────────────────────────
  useEffect(() => {
    if (drawMode !== 'select_poly') return
    map.getContainer().style.cursor = 'crosshair'

    const onClick = (e) => {
      L.DomEvent.stopPropagation(e)
      const s = polyRef.current
      s.points.push(e.latlng)
      s.markers.push(L.circleMarker(e.latlng, {
        radius: 4, fillColor: SEL_COLOR, color: '#fff', weight: 2, fillOpacity: 1, interactive: false,
      }).addTo(map))
      if (s.points.length >= 2) {
        if (s.polyline) map.removeLayer(s.polyline)
        s.polyline = L.polygon(s.points, {
          color: SEL_COLOR, fillColor: SEL_COLOR,
          fillOpacity: 0.1, weight: 2, dashArray: '5,4', interactive: false,
        }).addTo(map)
      }
    }
    const onMove = (e) => {
      const s = polyRef.current
      if (!s.points.length) return
      const coords = [...s.points, e.latlng, s.points[0]]
      if (s.rubberLine) s.rubberLine.setLatLngs(coords)
      else s.rubberLine = L.polyline(coords, {
        color: SEL_COLOR, weight: 1.5, dashArray: '4,4', opacity: 0.5, interactive: false,
      }).addTo(map)
    }
    const onDbl = (e) => {
      L.DomEvent.stopPropagation(e)
      if (polyRef.current.points.length >= 3) runQuery(latlngsToGeoJSON(polyRef.current.points))
      clearPoly(); setDrawMode(null)
    }
    const onKey = (e) => { if (e.key === 'Escape') { clearPoly(); setDrawMode(null) } }

    map.on('click', onClick); map.on('mousemove', onMove)
    map.on('dblclick', onDbl); window.addEventListener('keydown', onKey)
    return () => {
      map.off('click', onClick); map.off('mousemove', onMove)
      map.off('dblclick', onDbl); window.removeEventListener('keydown', onKey)
      map.getContainer().style.cursor = ''; clearPoly()
    }
  }, [drawMode])  // eslint-disable-line

  return null
}
