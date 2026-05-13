/**
 * dashboardService.js
 * ===================
 * Récupère les features WFS d'une couche, agrège les attributs,
 * détecte les types de données et propose les graphiques compatibles.
 *
 * API publique :
 *   fetchWFSData(geoserverLayer, attributes, filters?) → { rows, total }
 *   aggregateAttribute(rows, field)                    → AggregationResult
 *   detectFieldType(rows, field)                       → 'categorical' | 'numeric' | 'date'
 *   getCompatibleCharts(fieldType, attributesCount)    → ChartOption[]
 *   buildStats(rows, field, fieldType)                 → StatsResult
 */

import { WFS_URL } from '../config/constants'

// ─── Palettes de couleurs ──────────────────────────────────────────────────
export const COLOR_SCHEMES = {
  default:    ['#00AADD', '#0077B6', '#0096C7', '#48CAE4', '#90E0EF', '#ADE8F4', '#CAF0F8', '#023E8A'],
  rainbow:    ['#e63946', '#f4a261', '#e9c46a', '#2a9d8f', '#457b9d', '#6d6875', '#b5838d', '#e9c46a'],
  warm:       ['#d62828', '#f77f00', '#fcbf49', '#eae2b7', '#e63946', '#c77dff', '#9d4edd', '#7b2d8b'],
  cool:       ['#03045e', '#023e8a', '#0077b6', '#0096c7', '#00b4d8', '#48cae4', '#90e0ef', '#ade8f4'],
  monochrome: ['#03045e', '#023e8a', '#0077b6', '#0096c7', '#00b4d8', '#48cae4', '#90e0ef', '#caf0f8'],
}

// ─── Types de graphiques par cas d'usage ─────────────────────────────────
export const CHART_DEFINITIONS = [
  {
    type:        'pie',
    label:       'Camembert',
    icon:        '🥧',
    description: 'Répartition en parts — idéal pour < 8 catégories',
    suitable:    (fieldType, attrCount) => fieldType === 'categorical' && attrCount === 1,
  },
  {
    type:        'donut',
    label:       'Donut',
    icon:        '🍩',
    description: 'Variante du camembert avec valeur centrale',
    suitable:    (fieldType, attrCount) => fieldType === 'categorical' && attrCount === 1,
  },
  {
    type:        'bar',
    label:       'Barres verticales',
    icon:        '📊',
    description: 'Comparaison entre catégories',
    suitable:    (fieldType, attrCount) => fieldType === 'categorical' && attrCount <= 2,
  },
  {
    type:        'bar_horizontal',
    label:       'Barres horizontales',
    icon:        '📉',
    description: 'Idéal pour les labels longs',
    suitable:    (fieldType, attrCount) => fieldType === 'categorical' && attrCount === 1,
  },
  {
    type:        'histogram',
    label:       'Histogramme',
    icon:        '📈',
    description: 'Distribution de valeurs numériques',
    suitable:    (fieldType, attrCount) => fieldType === 'numeric' && attrCount === 1,
  },
  {
    type:        'line',
    label:       'Courbe',
    icon:        '〰️',
    description: 'Évolution / tendance',
    suitable:    (fieldType, attrCount) => (fieldType === 'numeric' || fieldType === 'date') && attrCount === 1,
  },
  {
    type:        'treemap',
    label:       'Treemap',
    icon:        '🗂️',
    description: 'Surfaces proportionnelles aux effectifs',
    suitable:    (fieldType, attrCount) => fieldType === 'categorical' && attrCount === 1,
  },
  {
    type:        'grouped_bar',
    label:       'Barres groupées',
    icon:        '📊',
    description: 'Comparaison croisée de 2 attributs catégoriels',
    suitable:    (fieldType, attrCount) => fieldType === 'categorical' && attrCount === 2,
  },
]

/**
 * Retourne les types de graphiques compatibles avec les données.
 */
export function getCompatibleCharts(fieldType, attributesCount) {
  return CHART_DEFINITIONS.filter(c => c.suitable(fieldType, attributesCount))
}

// ─── Champs à exclure ────────────────────────────────────────────────────
const EXCLUDED_FIELDS = new Set([
  'geom', 'geometry', 'wkb_geometry', 'the_geom', 'shape',
  'gid', 'ogc_fid', 'objectid', 'fid',
])

const PAGE_SIZE   = 2000   // taille d'une page WFS
const WFS_VERSION = '1.1.0'

// ─── Cache champs ────────────────────────────────────────────────────────
const _fieldsCache = {}

/**
 * Découvre les champs d'une couche via DescribeFeatureType.
 * Retourne [{ name, type }]
 */
export async function fetchLayerFields(geoserverLayer) {
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
          fields.push({ name, localType: prop.localType || 'string' })
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
 * Télécharge TOUTES les features WFS via pagination automatique.
 * Utilise startIndex + maxFeatures (WFS 1.1.0) pour itérer par pages
 * jusqu'à épuiser la couche.
 *
 * @param {string}   geoserverLayer  Ex: "eneo_gis_ws:cmrPosteSource"
 * @param {string[]} attributes      Champs à récupérer (propertyName)
 * @param {Object}   filters         Filtres CQL optionnels { field: value }
 * @param {Function} onProgress      Callback(loaded, total) — optionnel
 */
export async function fetchWFSData(geoserverLayer, attributes = [], filters = {}, onProgress) {
  // Construire le CQL_FILTER depuis les filtres
  let cqlFilter = null
  const filterClauses = Object.entries(filters)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k} = '${String(v).replace(/'/g, "''")}'`)
  if (filterClauses.length > 0) {
    cqlFilter = filterClauses.join(' AND ')
  }

  const baseParams = {
    service:      'WFS',
    version:      WFS_VERSION,
    request:      'GetFeature',
    typeName:     geoserverLayer,
    outputFormat: 'application/json',
    srsName:      'EPSG:4326',
  }
  if (attributes.length > 0) baseParams.propertyName = attributes.join(',')
  if (cqlFilter)              baseParams.CQL_FILTER   = cqlFilter

  const allRows = []
  let startIndex = 0
  let totalHits  = null   // connu après la 1ère réponse si GeoServer le renvoie

  while (true) {
    const params = new URLSearchParams({
      ...baseParams,
      maxFeatures: PAGE_SIZE,
      startIndex,
    })

    const resp = await fetch(`${WFS_URL}?${params}`, { credentials: 'include' })
    if (!resp.ok) throw new Error(`WFS error ${resp.status}`)

    const geojson  = await resp.json()
    const features = geojson.features || []

    for (const f of features) allRows.push(f.properties || {})

    // GeoServer peut renvoyer numberOfMatchedFeatures ou totalFeatures
    if (totalHits === null) {
      totalHits = geojson.totalFeatures
               ?? geojson.numberMatched
               ?? geojson.numberOfMatchedFeatures
               ?? null
    }

    onProgress?.(allRows.length, totalHits)

    // Arrêt si la page est incomplète (dernière page) ou vide
    if (features.length < PAGE_SIZE) break

    // Arrêt si on a tout récupéré
    if (totalHits !== null && allRows.length >= totalHits) break

    startIndex += PAGE_SIZE

    // Garde-fou : max 50 pages (100 000 entités)
    if (startIndex >= 100_000) break
  }

  return { rows: allRows, total: allRows.length }
}

/**
 * Détecte si un champ est catégoriel, numérique ou date.
 * Analyse un échantillon de valeurs.
 */
export function detectFieldType(rows, field) {
  const sample = rows
    .map(r => r[field])
    .filter(v => v !== null && v !== undefined && v !== '')
    .slice(0, 100)

  if (sample.length === 0) return 'categorical'

  // Vérif date
  const dateRe = /^\d{4}-\d{2}-\d{2}/
  if (sample.every(v => typeof v === 'string' && dateRe.test(v))) return 'date'

  // Vérif numérique
  const numericCount = sample.filter(v => !isNaN(Number(v))).length
  if (numericCount / sample.length >= 0.9) return 'numeric'

  return 'categorical'
}

/**
 * Agrège les valeurs d'un champ catégoriel.
 * Retourne [{ label, count, percent }] trié par count décroissant.
 */
export function aggregateCategorical(rows, field) {
  const counts = {}
  for (const row of rows) {
    const val = row[field]
    if (val === null || val === undefined || val === '') continue
    const key = String(val)
    counts[key] = (counts[key] || 0) + 1
  }
  const total = Object.values(counts).reduce((s, n) => s + n, 0)
  return Object.entries(counts)
    .map(([label, count]) => ({
      label,
      count,
      percent: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Agrège les valeurs d'un champ numérique en buckets (histogramme).
 * Retourne [{ label, count }]
 */
export function aggregateNumeric(rows, field, buckets = 10) {
  const values = rows
    .map(r => Number(r[field]))
    .filter(v => !isNaN(v))

  if (values.length === 0) return []

  const min  = Math.min(...values)
  const max  = Math.max(...values)
  const step = max === min ? 1 : (max - min) / buckets

  const counts = Array(buckets).fill(0)
  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / step), buckets - 1)
    counts[idx]++
  }

  return counts.map((count, i) => ({
    label: `${(min + i * step).toFixed(1)}–${(min + (i + 1) * step).toFixed(1)}`,
    count,
  }))
}

/**
 * Calcule les statistiques descriptives d'un champ.
 * Retourne { count, unique, min, max, mean, median, mode, nullCount }
 */
export function buildStats(rows, field, fieldType) {
  const allValues = rows.map(r => r[field])
  const nullCount = allValues.filter(v => v === null || v === undefined || v === '').length
  const values    = allValues.filter(v => v !== null && v !== undefined && v !== '')

  const base = {
    total:     rows.length,
    count:     values.length,
    nullCount,
    unique:    new Set(values.map(String)).size,
  }

  if (fieldType === 'numeric') {
    const nums = values.map(Number).filter(v => !isNaN(v)).sort((a, b) => a - b)
    if (nums.length === 0) return base
    const sum  = nums.reduce((s, v) => s + v, 0)
    const mid  = Math.floor(nums.length / 2)
    return {
      ...base,
      min:    nums[0],
      max:    nums[nums.length - 1],
      mean:   Math.round((sum / nums.length) * 100) / 100,
      median: nums.length % 2 === 0
        ? (nums[mid - 1] + nums[mid]) / 2
        : nums[mid],
    }
  }

  // Catégoriel — mode
  const counts = {}
  for (const v of values) {
    const k = String(v)
    counts[k] = (counts[k] || 0) + 1
  }
  const mode = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return {
    ...base,
    mode:      mode ? mode[0] : null,
    modeCount: mode ? mode[1] : 0,
  }
}

/**
 * Point d'entrée principal : prépare toutes les données pour un widget.
 *
 * @param {string}   geoserverLayer
 * @param {string[]} attributes    Liste de 1 ou 2 champs
 * @param {Object}   filters       Filtres CQL optionnels
 * @returns {Promise<WidgetData>}
 */
export async function prepareWidgetData(geoserverLayer, attributes, filters = {}, onProgress) {
  const { rows, total } = await fetchWFSData(geoserverLayer, attributes, filters, onProgress)

  if (attributes.length === 0 || rows.length === 0) {
    return { rows: [], total: 0, aggregations: {}, stats: {}, fieldTypes: {} }
  }

  const fieldTypes    = {}
  const aggregations  = {}
  const stats         = {}

  for (const field of attributes) {
    const ftype            = detectFieldType(rows, field)
    fieldTypes[field]      = ftype

    if (ftype === 'numeric') {
      aggregations[field]  = aggregateNumeric(rows, field)
    } else {
      aggregations[field]  = aggregateCategorical(rows, field)
    }

    stats[field]           = buildStats(rows, field, ftype)
  }

  // Pour grouped_bar (2 attributs catégoriels) : matrice croisée
  let crossAggregation = null
  if (attributes.length === 2 && attributes.every(f => fieldTypes[f] === 'categorical')) {
    crossAggregation = buildCrossAggregation(rows, attributes[0], attributes[1])
  }

  return { rows, total, aggregations, stats, fieldTypes, crossAggregation }
}

/**
 * Croise deux champs catégoriels pour les barres groupées.
 * Retourne { labels, series: [{ name, data: [count, ...] }] }
 */
function buildCrossAggregation(rows, field1, field2) {
  // Valeurs distinctes du champ 2 = séries
  const seriesKeys = [...new Set(rows.map(r => String(r[field2] ?? '')))]
    .filter(Boolean).slice(0, 8)  // max 8 séries pour lisibilité

  // Valeurs distinctes du champ 1 = labels (axe X)
  const labels = [...new Set(rows.map(r => String(r[field1] ?? '')))]
    .filter(Boolean).slice(0, 20)

  const matrix = {}
  for (const row of rows) {
    const k1 = String(row[field1] ?? '')
    const k2 = String(row[field2] ?? '')
    if (!labels.includes(k1) || !seriesKeys.includes(k2)) continue
    if (!matrix[k2]) matrix[k2] = {}
    matrix[k2][k1] = (matrix[k2][k1] || 0) + 1
  }

  const series = seriesKeys.map(key => ({
    name: key,
    data: labels.map(label => matrix[key]?.[label] || 0),
  }))

  return { labels, series }
}
