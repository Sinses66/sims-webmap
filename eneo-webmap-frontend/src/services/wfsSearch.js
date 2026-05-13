/**
 * wfsSearch.js
 * ============
 * Recherche full-text dans les attributs des couches WFS GeoServer.
 *
 * Stratégie :
 *   - Tokeniser la requête (split sur espaces)
 *   - Chaque token doit apparaître dans AU MOINS UN champ de la couche
 *     (LIKE '%token%', insensible à la casse)
 *   - CQL_FILTER combiné avec AND entre les tokens
 *   - Requêtes lancées en parallèle sur toutes les couches WFS
 *   - Résultats émis progressivement via callback onResult
 *
 * Exemple :
 *   query = "pos dou"
 *   tokens = ["pos", "dou"]
 *   CQL = (strToLowerCase(nom) LIKE '%pos%' OR strToLowerCase(code) LIKE '%pos%')
 *     AND (strToLowerCase(nom) LIKE '%dou%' OR strToLowerCase(code) LIKE '%dou%')
 */

import { WFS_URL } from '../config/constants'

// Champs techniques à ne jamais chercher / afficher
const EXCLUDED_FIELDS = new Set([
  'geom', 'geometry', 'wkb_geometry', 'the_geom', 'shape',
  'gid', 'ogc_fid', 'objectid', 'fid',
])

const MAX_FEATURES  = 15   // par couche
const WFS_VERSION   = '1.1.0'

/**
 * Construit le filtre CQL pour une liste de tokens et de champs.
 *
 * Pour chaque token : au moins un champ contient le token.
 * Tous les tokens doivent être satisfaits (AND).
 *
 * Résultat pour tokens=["pos","dou"] et fields=["nom","code"] :
 *   (strToLowerCase(nom) LIKE '%pos%' OR strToLowerCase(code) LIKE '%pos%')
 *   AND
 *   (strToLowerCase(nom) LIKE '%dou%' OR strToLowerCase(code) LIKE '%dou%')
 */
export function buildCQLFilter(tokens, fields) {
  if (!tokens.length || !fields.length) return null

  const tokenClauses = tokens.map(token => {
    const escaped = token.toLowerCase().replace(/'/g, "''")
    const fieldClauses = fields.map(
      f => `strToLowerCase(${f}) LIKE '%${escaped}%'`
    )
    return `(${fieldClauses.join(' OR ')})`
  })

  return tokenClauses.join(' AND ')
}

/**
 * Détermine les champs cherchables d'une couche.
 * Priorité : popupFields définis > tous les champs (fallback après premier fetch).
 */
function getSearchFields(layer) {
  // Si popup_fields définis → chercher dedans
  if (layer.popupFields && layer.popupFields.length > 0) {
    return layer.popupFields.filter(f => !EXCLUDED_FIELDS.has(f))
  }
  // Sinon : on retourne null → on cherchera après avoir récupéré les attributs
  return null
}

/**
 * Récupère les champs disponibles d'une couche via DescribeFeatureType.
 * Mis en cache en mémoire.
 */
const _fieldsCache = {}

async function fetchLayerFields(geoserverLayer) {
  if (_fieldsCache[geoserverLayer]) return _fieldsCache[geoserverLayer]

  try {
    const params = new URLSearchParams({
      service:      'WFS',
      version:      WFS_VERSION,
      request:      'DescribeFeatureType',
      typeName:     geoserverLayer,
      outputFormat: 'application/json',
    })
    const resp = await fetch(`${WFS_URL}?${params}`, { credentials: 'include' })
    if (!resp.ok) return []
    const data = await resp.json()

    const fields = []
    for (const ft of data.featureTypes || []) {
      for (const prop of ft.properties || []) {
        const name = prop.name || ''
        if (name && !EXCLUDED_FIELDS.has(name) && !name.toLowerCase().endsWith('_geom')) {
          fields.push(name)
        }
      }
    }
    _fieldsCache[geoserverLayer] = fields
    return fields
  } catch {
    return []
  }
}

/**
 * Formate un résultat brut (feature GeoJSON) en objet unifié.
 */
function formatResult(feature, layer, fields) {
  const props = feature.properties || {}

  // Valeur principale = premier champ non-vide parmi popup_fields
  const mainField = fields.find(f => props[f] != null && props[f] !== '')
  const mainValue = mainField ? String(props[mainField]) : `Feature #${feature.id || ''}`

  // Sous-titre = 2 premiers champs suivants
  const subFields = fields.filter(f => f !== mainField).slice(0, 2)
  const subValue  = subFields
    .filter(f => props[f] != null && props[f] !== '')
    .map(f => String(props[f]))
    .join(' — ')

  // Coordonnées pour zoom
  let lat = null, lng = null
  const geom = feature.geometry
  if (geom) {
    if (geom.type === 'Point') {
      [lng, lat] = geom.coordinates
    } else if (geom.type === 'MultiPoint') {
      [lng, lat] = geom.coordinates[0]
    } else if (geom.type === 'LineString') {
      const mid = Math.floor(geom.coordinates.length / 2)
      ;[lng, lat] = geom.coordinates[mid]
    } else if (geom.type === 'MultiLineString') {
      const line = geom.coordinates[0]
      const mid  = Math.floor(line.length / 2)
      ;[lng, lat] = line[mid]
    } else if (geom.type === 'Polygon') {
      // Centroïde approximatif
      const coords = geom.coordinates[0]
      lat = coords.reduce((s, c) => s + c[1], 0) / coords.length
      lng = coords.reduce((s, c) => s + c[0], 0) / coords.length
    } else if (geom.type === 'MultiPolygon') {
      const coords = geom.coordinates[0][0]
      lat = coords.reduce((s, c) => s + c[1], 0) / coords.length
      lng = coords.reduce((s, c) => s + c[0], 0) / coords.length
    }
  }

  return {
    id:        `${layer.id}_${feature.id || Math.random()}`,
    layerId:   layer.id,
    layerName: layer.name,
    layerColor:layer.color || '#00AADD',
    label:     mainValue,
    sublabel:  subValue,
    lat,
    lng,
    properties: props,
    geojson:    feature,
    fields,
  }
}

/**
 * Recherche dans une couche WFS.
 * Appelle onResult(results, layerName) dès que la couche répond.
 */
async function searchOneLayer(layer, tokens, onResult) {
  try {
    // 1. Déterminer les champs cherchables
    let fields = getSearchFields(layer)
    if (!fields) {
      fields = await fetchLayerFields(layer.geoserverLayer)
    }
    if (!fields || fields.length === 0) return

    // 2. Construire le filtre CQL
    const cql = buildCQLFilter(tokens, fields)
    if (!cql) return

    // 3. Requête WFS
    const params = new URLSearchParams({
      service:      'WFS',
      version:      WFS_VERSION,
      request:      'GetFeature',
      typeName:     layer.geoserverLayer,
      outputFormat: 'application/json',
      CQL_FILTER:   cql,
      maxFeatures:  MAX_FEATURES,
      srsName:      'EPSG:4326',
    })

    const resp = await fetch(`${WFS_URL}?${params}`, { credentials: 'include' })
    if (!resp.ok) return

    const geojson = await resp.json()
    const features = geojson.features || []
    if (features.length === 0) return

    // 4. Formater et émettre
    const results = features.map(f => formatResult(f, layer, fields))
    onResult(results, layer.name)

  } catch {
    // Erreur silencieuse — on ne bloque pas les autres couches
  }
}

/**
 * Point d'entrée principal.
 *
 * @param {string}   query      Texte saisi
 * @param {Array}    wfsLayers  Couches WFS à chercher [{id, name, geoserverLayer, popupFields, color}]
 * @param {Function} onResult   Callback(results, layerName) appelé par couche dès réponse
 * @param {Function} onDone     Callback() appelé quand toutes les couches ont répondu
 * @returns {Function}          Fonction d'annulation (abort)
 */
export function searchWFS(query, wfsLayers, onResult, onDone) {
  let cancelled = false

  const tokens = query
    .trim()
    .split(/\s+/)
    .filter(t => t.length >= 2)

  if (tokens.length === 0 || wfsLayers.length === 0) {
    onDone?.()
    return () => {}
  }

  const safeLayers = wfsLayers.filter(l => l.geoserverLayer)

  Promise.allSettled(
    safeLayers.map(layer =>
      searchOneLayer(
        layer,
        tokens,
        (results, layerName) => {
          if (!cancelled) onResult(results, layerName)
        }
      )
    )
  ).finally(() => {
    if (!cancelled) onDone?.()
  })

  return () => { cancelled = true }
}
