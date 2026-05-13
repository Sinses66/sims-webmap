import { MapContainer, TileLayer, ScaleControl, useMap } from 'react-leaflet'
import { useEffect } from 'react'
import 'leaflet/dist/leaflet.css'
import { useMapStore } from '../../store/mapStore'
import { BASEMAPS, MAP_CENTER, MAP_ZOOM, MAP_MIN_ZOOM, MAP_MAX_ZOOM } from '../../config/constants'
import { useAppLayers } from '../../hooks/useGeoData'
import WMSLayerComponent    from './WMSLayer'
import WFSLayerComponent    from './WFSLayer'
import WFSClusterLayer      from './WFSClusterLayer'
import MapEventHandler      from './MapEventHandler'
import FeaturePopup         from './FeaturePopup'
import MapToolbar           from './toolbar/MapToolbar'
import MeasureLayer         from './toolbar/MeasureLayer'
import DrawLayer            from './toolbar/DrawLayer'
import SelectionLayer        from './toolbar/SelectionLayer'
import SelectionPanel        from './toolbar/SelectionPanel'
import AttributeFilterPanel  from './toolbar/AttributeFilterPanel'
import PrintExportPanel      from './toolbar/PrintExportPanel'
import AnalysisPanel         from './toolbar/AnalysisPanel'
import IncidentMarkerLayer   from './IncidentMarkerLayer'
import { useAppContext } from '../../context/AppContext'

// ── Capture l'instance Leaflet dans le store Zustand ──────────
function MapInstanceCapture() {
  const map = useMap()
  const setMapInstance = useMapStore(s => s.setMapInstance)
  useEffect(() => { setMapInstance(map) }, [map, setMapInstance])
  return null
}

export default function MapView() {
  const { appSlug } = useAppContext()
  const { activeBasemap, layerStates } = useMapStore()
  const basemap = BASEMAPS[activeBasemap] || BASEMAPS.osm

  // ── Couches dynamiques depuis Django ──────────────────────────
  const { layerGroups } = useAppLayers(appSlug)

  return (
    <>
    <MapContainer
      center={MAP_CENTER}
      zoom={MAP_ZOOM}
      minZoom={MAP_MIN_ZOOM}
      maxZoom={MAP_MAX_ZOOM}
      zoomControl={false}
      className="w-full h-full"
    >
      {/* ── Fond de carte ── zIndex=1 garantit qu'il reste sous les couches overlay ── */}
      <TileLayer
        key={activeBasemap}
        url={basemap.url}
        attribution={basemap.attribution}
        maxZoom={MAP_MAX_ZOOM}
        zIndex={1}
      />

      {/* ── Couches GeoServer ───────────────────────────────────── */}
      {layerGroups.flatMap(group =>
        group.layers.map(layer => {
          const state = layerStates[layer.id]
          if (!state?.visible) return null

          // WMS → tuiles serveur
          if (layer.type === 'WMS') {
            return (
              <WMSLayerComponent
                key={layer.id}
                layer={layer}
                opacity={state.opacity}
              />
            )
          }

          // WFS → tous via WFSClusterLayer (gère points ET polygones)
          return (
            <WFSClusterLayer
              key={layer.id}
              layer={layer}
              opacity={state.opacity}
            />
          )
        })
      )}

      {/* ── Contrôles ────────────────────────────────────────────── */}
      <ScaleControl position="bottomleft" imperial={false} />

      {/* ── Gestionnaires & outils ───────────────────────────────── */}
      <MapInstanceCapture />
      <MapEventHandler />
      <FeaturePopup />
      <IncidentMarkerLayer />
      <MeasureLayer />
      <DrawLayer />
      <SelectionLayer />
      <SelectionPanel />
      <MapToolbar />
    </MapContainer>
    <AttributeFilterPanel />
    <PrintExportPanel />
    <AnalysisPanel />
  </>
  )
}
