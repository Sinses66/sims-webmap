import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { useWFSLayer } from '../../hooks/useGeoData'
import { useMapStore } from '../../store/mapStore'

/**
 * Couche WFS intelligente — choisit le moteur de rendu selon le type de géométrie :
 *
 *  • Point / MultiPoint      → MarkerClusterGroup  (markerPane,  z-index 600)
 *  • Line / MultiLine        → L.geoJSON polyline  (overlayPane, z-index 400)
 *  • Polygon / MultiPolygon  → L.geoJSON polygon   (overlayPane, z-index 400)
 *
 * Les panes sont toujours AU-DESSUS du fond de carte (tilePane = 200).
 */
export default function WFSClusterLayer({ layer, opacity = 1 }) {
  const map                 = useMap()
  const { setSelectedFeature } = useMapStore()
  const layerRef            = useRef(null)

  const { data, isLoading, isError, error } = useWFSLayer(layer.geoserverLayer)

  useEffect(() => {
    if (isLoading || isError || !data?.features?.length) return

    // ── Détecte le type de géométrie dominant ─────────────────
    const firstGeom = data.features.find(f => f.geometry)?.geometry
    const geomType  = firstGeom?.type || 'Point'
    const isPoint   = geomType === 'Point' || geomType === 'MultiPoint'
    const isLine    = geomType === 'LineString' || geomType === 'MultiLineString'

    // ── Tooltip helper ─────────────────────────────────────────
    const getLabel = (props) =>
      props?.nom || props?.libelle || props?.name || props?.code || props?.id || layer.name

    // ═══════════════════════════════════════════════════════════
    // A. POINTS → MarkerClusterGroup
    // ═══════════════════════════════════════════════════════════
    if (isPoint) {
      if (typeof L.markerClusterGroup !== 'function') {
        // Fallback si la lib n'est pas chargée
        const fallback = L.featureGroup()
        data.features.forEach(f => {
          if (!f.geometry || f.geometry.type !== 'Point') return
          const [lng, lat] = f.geometry.coordinates
          const m = L.circleMarker([lat, lng], {
            radius: 7, fillColor: layer.color || '#00AADD',
            color: '#fff', weight: 2, fillOpacity: opacity * 0.9,
          })
          m.on('click', (e) => {
            if (e.originalEvent) {
              e.originalEvent.stopPropagation()
              e.originalEvent.preventDefault()
            }
            setSelectedFeature({
              properties: f.properties, geometry: f.geometry,
              layerId: layer.id, layerName: layer.name, latlng: e.latlng,
            })
          })
          m.addTo(fallback)
        })
        map.addLayer(fallback)
        layerRef.current = fallback
        return () => { map.removeLayer(fallback); layerRef.current = null }
      }

      const clusterGroup = L.markerClusterGroup({
        showCoverageOnHover:     false,
        maxClusterRadius:        60,
        spiderfyOnMaxZoom:       true,
        disableClusteringAtZoom: 16,
        iconCreateFunction: (cluster) => {
          const count = cluster.getChildCount()
          const size  = count < 10 ? 34 : count < 50 ? 42 : 52
          const bg    = layer.color || '#00AADD'
          return L.divIcon({
            html: `<div style="
              width:${size}px;height:${size}px;
              background:${bg}CC;border:2px solid ${bg};border-radius:50%;
              display:flex;align-items:center;justify-content:center;
              color:#fff;font-size:13px;font-weight:600;
              box-shadow:0 2px 6px rgba(0,0,0,0.4);
            ">${count}</div>`,
            className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
          })
        },
      })

      data.features.forEach(f => {
        if (!f.geometry) return
        let latlng
        if (f.geometry.type === 'Point') {
          const [lng, lat] = f.geometry.coordinates
          latlng = L.latLng(lat, lng)
        } else {
          try { latlng = L.geoJSON(f).getBounds().getCenter() } catch { return }
        }

        const marker = L.circleMarker(latlng, {
          radius: 7, fillColor: layer.color || '#00AADD',
          color: '#ffffff', weight: 2,
          opacity, fillOpacity: opacity * 0.9,
        })

        const label = getLabel(f.properties)
        if (label) {
          marker.bindTooltip(String(label), {
            direction: 'top', offset: [0, -6], className: 'sims-tooltip',
          })
        }

        marker.on('click', (e) => {
          // Stoppe le DOM event (pas l'objet Leaflet) pour empêcher
          // MapEventHandler de recevoir ce clic et d'effacer le popup
          if (e.originalEvent) {
            e.originalEvent.stopPropagation()
            e.originalEvent.preventDefault()
          }
          setSelectedFeature({
            properties: f.properties, geometry: f.geometry,
            layerId: layer.id, layerName: layer.name, latlng: e.latlng,
          })
        })

        clusterGroup.addLayer(marker)
      })

      map.addLayer(clusterGroup)
      layerRef.current = clusterGroup
      return () => { map.removeLayer(clusterGroup); layerRef.current = null }
    }

    // ═══════════════════════════════════════════════════════════
    // B. LIGNES & POLYGONES → L.geoJSON dans overlayPane
    // ═══════════════════════════════════════════════════════════
    const color  = layer.color || '#6366f1'
    const weight = isLine ? 2.5 : 1.5

    const geojsonLayer = L.geoJSON(data, {
      pane: 'overlayPane',   // z-index 400 — toujours au-dessus du fond de carte

      style: () => ({
        color,
        weight,
        opacity,
        fillColor:   color,
        fillOpacity: isLine ? 0 : opacity * 0.18,
        lineJoin:    'round',
        lineCap:     'round',
      }),

      // Points éventuellement mélangés dans la même couche
      pointToLayer: (f, latlng) => L.circleMarker(latlng, {
        radius: 6, fillColor: color, color: '#fff',
        weight: 2, opacity, fillOpacity: opacity * 0.9,
        pane: 'overlayPane',
      }),

      onEachFeature: (f, leafletLayer) => {
        // ── Interactivité ─────────────────────────────────────
        leafletLayer.on({
          mouseover(e) {
            e.target.setStyle({
              weight:      weight + 2,
              opacity:     1,
              fillOpacity: isLine ? 0 : 0.45,
            })
            if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
              e.target.bringToFront()
            }
          },
          mouseout(e) {
            geojsonLayer.resetStyle(e.target)
          },
          click(e) {
            if (e.originalEvent) {
              e.originalEvent.stopPropagation()
              e.originalEvent.preventDefault()
            }
            setSelectedFeature({
              properties: f.properties, geometry: f.geometry,
              layerId: layer.id, layerName: layer.name, latlng: e.latlng,
            })
          },
        })

        // ── Tooltip ───────────────────────────────────────────
        const label = getLabel(f.properties)
        if (label) {
          leafletLayer.bindTooltip(String(label), {
            sticky:    true,
            direction: 'top',
            className: 'sims-tooltip',
          })
        }
      },
    })

    map.addLayer(geojsonLayer)
    layerRef.current = geojsonLayer
    return () => { map.removeLayer(geojsonLayer); layerRef.current = null }

  }, [data, layer.id, layer.color, layer.name, isLoading, isError]) // eslint-disable-line

  // ── Mise à jour de l'opacité sans recréer la couche ───────────
  useEffect(() => {
    if (!layerRef.current) return
    layerRef.current.eachLayer(l => {
      if (l.setStyle) {
        const geomType = l.feature?.geometry?.type || ''
        const isLine   = geomType.includes('Line')
        l.setStyle({
          opacity,
          fillOpacity: isLine ? 0 : opacity * 0.18,
        })
      } else if (l.setOpacity) {
        l.setOpacity(opacity)
      }
    })
  }, [opacity])

  return null
}
