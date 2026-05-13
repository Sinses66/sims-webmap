import { WMSTileLayer } from 'react-leaflet'
import { GEOSERVER_WORKSPACE } from '../../config/constants'

/**
 * Couche WMS GeoServer — rendu côté serveur (raster).
 * Le workspace est extrait dynamiquement depuis layer.geoserverLayer
 * (ex: "ws:cmrReseauHTB" → /geoserver/ws/wms).
 */
export default function WMSLayerComponent({ layer, opacity = 1 }) {
  const ws = (layer.geoserverLayer && layer.geoserverLayer.includes(':'))
    ? layer.geoserverLayer.split(':')[0]
    : GEOSERVER_WORKSPACE
  const wmsUrl = `/geoserver/${ws}/wms`

  return (
    <WMSTileLayer
      key={`${layer.id}-${opacity}`}
      url={wmsUrl}
      layers={layer.geoserverLayer}
      format="image/png"
      transparent={true}
      version="1.1.1"
      opacity={opacity}
      tileSize={256}
      uppercase={false}
      zIndex={10}
    />
  )
}
