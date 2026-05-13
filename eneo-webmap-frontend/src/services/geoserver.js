import axios from 'axios'
import { GEOSERVER_WORKSPACE, EPSG_4326 } from '../config/constants'

/**
 * Extrait le workspace depuis un nom de couche GeoServer (ex: "ws:cmrPosteSource" → "ws")
 * Fallback sur GEOSERVER_WORKSPACE si pas de préfixe.
 */
function wsFromLayer(layerName) {
  return (layerName && layerName.includes(':'))
    ? layerName.split(':')[0]
    : GEOSERVER_WORKSPACE
}

function wmsUrl(layerName) { return `/geoserver/${wsFromLayer(layerName)}/wms` }
function wfsUrl(layerName) { return `/geoserver/${wsFromLayer(layerName)}/wfs` }

/**
 * GetFeatureInfo WMS — récupère les attributs d'une entité au clic carte.
 * @param {string} layer - Nom de la couche (ex: "eneo_gis_ws:ligne_mt")
 * @param {object} latlng - { lat, lng }
 * @param {object} map    - Instance Leaflet map
 */
export async function getFeatureInfo(layer, latlng, map) {
  const size = map.getSize()
  const bounds = map.getBounds()
  const point = map.latLngToContainerPoint(latlng)

  const params = new URLSearchParams({
    SERVICE:      'WMS',
    VERSION:      '1.1.1',
    REQUEST:      'GetFeatureInfo',
    LAYERS:        layer,
    QUERY_LAYERS:  layer,
    STYLES:       '',
    BBOX:         `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`,
    WIDTH:         size.x,
    HEIGHT:        size.y,
    SRS:          'EPSG:4326',
    X:             Math.round(point.x),
    Y:             Math.round(point.y),
    INFO_FORMAT:  'application/json',
    FEATURE_COUNT: 5,
  })

  const res = await axios.get(`${wmsUrl(layer)}?${params.toString()}`)
  return res.data
}

/**
 * WFS GetFeature — retourne un GeoJSON
 * @param {string} typeName - Nom de la couche WFS
 * @param {object} options  - { bbox, cql_filter, maxFeatures }
 */
export async function getWFSFeatures(typeName, options = {}) {
  // CRS:84 garantit l'ordre lon/lat (compatible GeoJSON/Leaflet) indépendamment
  // de la version WFS. WFS 2.0 + EPSG:4326 retournerait lat/lon (inversion d'axes).
  const params = new URLSearchParams({
    SERVICE:      'WFS',
    VERSION:      '2.0.0',
    REQUEST:      'GetFeature',
    typeName,
    outputFormat: 'application/json',
    srsName:      'CRS:84',
    maxFeatures:  options.maxFeatures || 5000,
    ...(options.bbox       && { bbox:       options.bbox }),
    ...(options.cql_filter && { CQL_FILTER: options.cql_filter }),
  })

  const res = await axios.get(`${wfsUrl(typeName)}?${params.toString()}`)
  return res.data
}

/**
 * Légende WMS d'une couche
 */
export function getLegendUrl(layer, width = 20, height = 20) {
  return `${wmsUrl(layer)}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic&FORMAT=image/png&LAYER=${layer}&WIDTH=${width}&HEIGHT=${height}&TRANSPARENT=true`
}
