import { useEffect, useRef } from 'react'
import { GeoJSON, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useWFSLayer } from '../../hooks/useGeoData'
import { useMapStore } from '../../store/mapStore'

/**
 * Couche WFS GeoServer — vecteurs côté client (GeoJSON).
 * Permet l'interaction (clic, survol, popups riches).
 */
export default function WFSLayerComponent({ layer, opacity = 1 }) {
  const map = useMap()
  const { setSelectedFeature } = useMapStore()
  const { data, isLoading, isError } = useWFSLayer(layer.geoserverLayer)
  const geoJsonRef = useRef(null)

  // Style par défaut selon le type de géométrie
  const getStyle = (feature) => ({
    color:       layer.color || '#3388ff',
    weight:      feature?.geometry?.type?.includes('Line') ? 2 : 1,
    opacity:     opacity,
    fillOpacity: feature?.geometry?.type?.includes('Point') ? 0 : opacity * 0.3,
    fillColor:   layer.color || '#3388ff',
  })

  // Style au survol
  const onEachFeature = (feature, leafletLayer) => {
    leafletLayer.on({
      mouseover: (e) => {
        e.target.setStyle({ weight: 4, opacity: 1, fillOpacity: 0.6 })
        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
          e.target.bringToFront()
        }
      },
      mouseout: (e) => {
        if (geoJsonRef.current) {
          geoJsonRef.current.resetStyle(e.target)
        }
      },
      click: (e) => {
        setSelectedFeature({
          properties: feature.properties,
          geometry:   feature.geometry,
          layerId:    layer.id,
          layerName:  layer.name,
          latlng:     e.latlng,
        })
      },
    })

    // Tooltip au survol
    const label = feature.properties?.nom
      || feature.properties?.code
      || feature.properties?.id
      || layer.name
    if (label) {
      leafletLayer.bindTooltip(String(label), {
        permanent:  false,
        direction:  'top',
        className:  'text-xs bg-brand-dark text-white px-2 py-1 rounded',
      })
    }
  }

  // Icône pour les points (postes, clients...)
  const pointToLayer = (feature, latlng) => {
    return L.circleMarker(latlng, {
      radius:      6,
      fillColor:   layer.color || '#3388ff',
      color:       '#ffffff',
      weight:      2,
      opacity:     1,
      fillOpacity: 0.9,
    })
  }

  if (isLoading || isError || !data) return null

  return (
    <GeoJSON
      ref={geoJsonRef}
      data={data}
      style={getStyle}
      onEachFeature={onEachFeature}
      pointToLayer={pointToLayer}
    />
  )
}
