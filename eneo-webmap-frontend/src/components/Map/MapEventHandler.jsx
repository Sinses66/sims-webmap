import { useMapEvents } from 'react-leaflet'
import { useMapStore } from '../../store/mapStore'
import { useAppLayers } from '../../hooks/useGeoData'
import { getFeatureInfo } from '../../services/geoserver'

const APP_SLUG = 'eneo-gis'

/**
 * Gère les événements carte :
 *  - Clic sur couche WFS  → géré directement dans WFSClusterLayer (stopPropagation)
 *    → ce handler ne reçoit PAS le clic (defaultPrevented = true)
 *  - Clic sur fond de carte → efface le popup ou lance GetFeatureInfo WMS
 */
export default function MapEventHandler() {
  const { layerStates, setSelectedFeature, clearSelectedFeature, drawMode } = useMapStore()
  const { layerGroups } = useAppLayers(APP_SLUG)

  useMapEvents({
    click: async (e) => {
      // ── 1. Modes dessin/mesure : ignorer ─────────────────────
      if (drawMode) return

      // ── 2. Clic déjà traité par une couche WFS ────────────────
      //    WFSClusterLayer appelle e.originalEvent.preventDefault()
      //    → on ne touche pas au selectedFeature déjà positionné
      if (e.originalEvent?.defaultPrevented) return

      // ── 3. Clic sur le fond de carte ──────────────────────────
      //    Cherche une couche WMS visible (couches dynamiques de l'API)
      const allLayers    = layerGroups.flatMap(g => g.layers)
      const activeWMSLayer = allLayers
        .find(l => l.type === 'WMS' && layerStates[l.id]?.visible)

      if (!activeWMSLayer) {
        // Aucune couche WMS visible → clic sur fond = fermer le popup
        clearSelectedFeature()
        return
      }

      // ── 4. GetFeatureInfo WMS ─────────────────────────────────
      try {
        const result = await getFeatureInfo(
          activeWMSLayer.geoserverLayer,
          e.latlng,
          e.target,   // e.target = instance Leaflet map dans useMapEvents
        )
        const features = result?.features || []
        if (features.length > 0) {
          setSelectedFeature({
            properties: features[0].properties,
            geometry:   features[0].geometry,
            layerId:    activeWMSLayer.id,
            layerName:  activeWMSLayer.name,
            latlng:     e.latlng,
          })
        } else {
          clearSelectedFeature()
        }
      } catch {
        clearSelectedFeature()
      }
    },
  })

  return null
}
