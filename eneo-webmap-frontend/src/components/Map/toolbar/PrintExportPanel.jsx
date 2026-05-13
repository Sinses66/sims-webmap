import { useState, useCallback, useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { X, Printer, Download, FileText, ChevronLeft, Filter } from 'lucide-react'
import { useMapStore } from '../../../store/mapStore'
import { useAppLayers } from '../../../hooks/useGeoData'
import { BASEMAPS, WFS_URL, GEOSERVER_WORKSPACE } from '../../../config/constants'
import toast from 'react-hot-toast'
import { useAppContext } from '../../../context/AppContext'

const SCALES     = [500,1000,2000,5000,10000,25000,50000,100000,250000,500000,1000000]
const GEO_FIELDS = new Set(['geom','geometry','wkb_geometry','the_geom','shape'])
const OPERATORS  = ['=','≠','contient','commence par','>','<']
const VEC_FORMATS = ['GeoJSON','KML']

// ── Utilitaires ───────────────────────────────────────────────

function scaleToZoom(scaleDenom, lat) {
  const mpp = scaleDenom / (96 / 0.0254)
  const z   = Math.log2(40075016.686 * Math.cos(lat * Math.PI / 180) / (mpp * 256))
  return Math.max(1, Math.min(20, Math.round(z * 10) / 10))
}

async function detectGeomType(layerName) {
  try {
    const url = `${WFS_URL}?service=WFS&version=1.1.0&request=GetFeature` +
      `&typeName=${GEOSERVER_WORKSPACE}:${layerName}&outputFormat=application/json&maxFeatures=1`
    const r = await fetch(url, { credentials: 'include' })
    if (!r.ok) return 'polygon'
    const d = await r.json()
    const t = d?.features?.[0]?.geometry?.type?.toLowerCase() || ''
    if (t.includes('point')) return 'point'
    if (t.includes('line'))  return 'line'
    return 'polygon'
  } catch { return 'polygon' }
}

function buildLegendHTML(layers, geomTypeMap) {
  const items = layers.map(layer => {
    const color = layer.color || '#00AADD'
    const gtype = geomTypeMap[layer.geoserverLayer] || 'polygon'
    let symbol = ''
    if (gtype === 'point') {
      symbol = `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${color};border:1.5px solid #fff;box-shadow:0 0 0 1px ${color};vertical-align:middle;margin-right:6px;flex-shrink:0"></span>`
    } else if (gtype === 'line') {
      symbol = `<span style="display:inline-block;width:20px;height:3px;background:${color};vertical-align:middle;margin-right:6px;flex-shrink:0;border-radius:1px"></span>`
    } else {
      symbol = `<span style="display:inline-block;width:14px;height:14px;background:${color}55;border:1.5px solid ${color};vertical-align:middle;margin-right:6px;flex-shrink:0;border-radius:2px"></span>`
    }
    return `<div style="display:flex;align-items:center;margin-bottom:4px;font-size:10px;color:#1e293b">${symbol}<span>${layer.name}</span></div>`
  }).join('')

  return `
    <div style="background:rgba(255,255,255,0.95);border:1px solid #cbd5e1;border-radius:5px;padding:8px 10px;min-width:110px;box-shadow:0 2px 6px rgba(0,0,0,0.12);">
      <div style="font-weight:700;font-size:10px;color:#334155;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #e2e8f0">Légende</div>
      ${items}
    </div>
  `
}

// Convertit un FeatureCollection GeoJSON en chaîne KML
function geojsonToKML(fc, layerName) {
  const placemarks = fc.features.map((f, idx) => {
    const props = f.properties || {}
    const geom  = f.geometry
    if (!geom) return ''

    // Étendue des attributs
    const extData = Object.entries(props)
      .filter(([k]) => !GEO_FIELDS.has(k))
      .map(([k,v]) => `<Data name="${k.replace(/"/g,'&quot;')}"><value>${String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</value></Data>`)
      .join('\n      ')

    // Géométrie
    let kmlGeom = ''
    const coordStr = coords => Array.isArray(coords[0])
      ? coords.map(c => `${c[0]},${c[1]},0`).join(' ')
      : `${coords[0]},${coords[1]},0`

    if (geom.type === 'Point') {
      kmlGeom = `<Point><coordinates>${geom.coordinates[0]},${geom.coordinates[1]},0</coordinates></Point>`
    } else if (geom.type === 'MultiPoint') {
      kmlGeom = geom.coordinates.map(c =>
        `<Point><coordinates>${c[0]},${c[1]},0</coordinates></Point>`).join('')
    } else if (geom.type === 'LineString') {
      kmlGeom = `<LineString><coordinates>${coordStr(geom.coordinates)}</coordinates></LineString>`
    } else if (geom.type === 'MultiLineString') {
      const lines = geom.coordinates.map(c =>
        `<LineString><coordinates>${coordStr(c)}</coordinates></LineString>`).join('')
      kmlGeom = `<MultiGeometry>${lines}</MultiGeometry>`
    } else if (geom.type === 'Polygon') {
      const rings = geom.coordinates.map((r, i) =>
        i === 0
          ? `<outerBoundaryIs><LinearRing><coordinates>${coordStr(r)}</coordinates></LinearRing></outerBoundaryIs>`
          : `<innerBoundaryIs><LinearRing><coordinates>${coordStr(r)}</coordinates></LinearRing></innerBoundaryIs>`
      ).join('')
      kmlGeom = `<Polygon>${rings}</Polygon>`
    } else if (geom.type === 'MultiPolygon') {
      const polys = geom.coordinates.map(poly => {
        const rings = poly.map((r, i) =>
          i === 0
            ? `<outerBoundaryIs><LinearRing><coordinates>${coordStr(r)}</coordinates></LinearRing></outerBoundaryIs>`
            : `<innerBoundaryIs><LinearRing><coordinates>${coordStr(r)}</coordinates></LinearRing></innerBoundaryIs>`
        ).join('')
        return `<Polygon>${rings}</Polygon>`
      }).join('')
      kmlGeom = `<MultiGeometry>${polys}</MultiGeometry>`
    }

    const name = props.name || props.nom || props.id || props.fid || `Entité ${idx+1}`
    return `  <Placemark>
    <name>${String(name).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</name>
    <ExtendedData>${extData}</ExtendedData>
    ${kmlGeom}
  </Placemark>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>${layerName}</name>
${placemarks}
</Document>
</kml>`
}

// Télécharge un blob
function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Applique un filtre attributaire sur un tableau de features
function applyAttrFilter(features, field, op, value) {
  if (!field || !value.trim()) return features
  const val = value.toLowerCase().trim()
  return features.filter(f => {
    const raw = f.properties?.[field]
    if (raw === undefined || raw === null) return false
    const v = String(raw).toLowerCase()
    switch (op) {
      case '=':            return v === val
      case '≠':            return v !== val
      case 'contient':     return v.includes(val)
      case 'commence par': return v.startsWith(val)
      case '>':            return parseFloat(raw) > parseFloat(value)
      case '<':            return parseFloat(raw) < parseFloat(value)
      default:             return false
    }
  })
}

// Récupère les données WFS (cache TanStack ou fetch réseau)
async function fetchWFSData(queryClient, layer) {
  const cached = queryClient.getQueryData(['wfs', layer.geoserverLayer, {}])
  if (cached?.features) return cached

  const url = `${WFS_URL}?service=WFS&version=1.1.0&request=GetFeature` +
    `&typeName=${GEOSERVER_WORKSPACE}:${layer.geoserverLayer}&outputFormat=application/json`
  const r = await fetch(url, { credentials: 'include' })
  if (!r.ok) throw new Error(`WFS error ${r.status}`)
  return r.json()
}

// ── Sous-composant : filtre attributaire réutilisable ─────────
function AttrFilter({ fields, field, setField, op, setOp, value, setValue, uniqueValues = [], listId }) {
  const dlId = listId || `dl-${field}`
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <div>
        <label style={labelSt}>Champ</label>
        <select value={field} onChange={e=>{ setField(e.target.value); setValue('') }} style={selectSt}>
          <option value="">— Tous les enregistrements —</option>
          {fields.map(f=><option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      {field && (
        <div style={{ display:'flex', gap:8 }}>
          <div style={{ flex:'0 0 110px' }}>
            <label style={labelSt}>Opérateur</label>
            <select value={op} onChange={e=>setOp(e.target.value)} style={selectSt}>
              {OPERATORS.map(o=><option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div style={{ flex:1 }}>
            <label style={labelSt}>Valeur</label>
            <input
              list={dlId}
              value={value}
              onChange={e=>setValue(e.target.value)}
              placeholder={uniqueValues.length ? `${uniqueValues.length} valeurs disponibles…` : 'Valeur…'}
              style={inputSt}
              autoComplete="off"
            />
            {uniqueValues.length > 0 && (
              <datalist id={dlId}>
                {uniqueValues.map(v => <option key={v} value={v}/>)}
              </datalist>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// PANNEAU PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export default function PrintExportPanel() {
  const { appSlug } = useAppContext()
  const queryClient = useQueryClient()
  const { drawMode, setDrawMode, layerStates, mapInstance, activeBasemap } = useMapStore()
  const { layerGroups } = useAppLayers(appSlug)

  // ── Navigation entre sous-outils ─────────────────────────────
  const [subTool, setSubTool] = useState(null)  // null | 'print' | 'vector' | 'csv'

  // ── Print state ──────────────────────────────────────────────
  const [title,         setTitle]         = useState('Carte SIMS ENEO')
  const [scale,         setScale]         = useState(25000)
  const [loading,       setLoading]       = useState(false)
  const [checkedLayers, setCheckedLayers] = useState({})

  // ── Vector export state ───────────────────────────────────────
  const [vecLayer,  setVecLayer]  = useState('')
  const [vecFormat, setVecFormat] = useState('GeoJSON')
  const [vecField,  setVecField]  = useState('')
  const [vecOp,     setVecOp]     = useState('=')
  const [vecValue,  setVecValue]  = useState('')
  const [vecLoading, setVecLoading] = useState(false)

  // ── CSV export state ──────────────────────────────────────────
  const [csvLayer,  setCsvLayer]  = useState('')
  const [csvField,  setCsvField]  = useState('')
  const [csvOp,     setCsvOp]     = useState('=')
  const [csvValue,  setCsvValue]  = useState('')
  const [csvLoading, setCsvLoading] = useState(false)

  // ── CSS @media print ─────────────────────────────────────────
  useEffect(() => {
    const style = document.createElement('style')
    style.id = '__sims_print_style'
    style.textContent = `
      @media print {
        @page { margin: 0; size: auto; }
        body * { visibility: hidden !important; }
        #__sims_print_root,
        #__sims_print_root * { visibility: visible !important; }
        #__sims_print_root {
          position: fixed !important;
          top: 0 !important; left: 0 !important;
          width: 100vw !important; height: 100vh !important;
          z-index: 999999 !important;
          background: white !important;
          display: flex !important;
          flex-direction: column !important;
        }
      }
    `
    if (!document.getElementById('__sims_print_style'))
      document.head.appendChild(style)
    return () => document.getElementById('__sims_print_style')?.remove()
  }, [])

  // ── Couches ──────────────────────────────────────────────────
  const allLayers     = layerGroups.flatMap(g => g.layers)
  const visibleLayers = allLayers.filter(l => layerStates[l.id]?.visible !== false)
  // Toutes les couches vecteur (WFS / non-WMS), visibles ou non
  const wfsLayers     = allLayers.filter(l => l.type !== 'WMS')

  // ── Helper : champs + valeurs uniques depuis le cache ─────────
  function getCachedFieldsAndValues(layerId, fieldName) {
    const layer  = wfsLayers.find(l => l.id === layerId)
    if (!layer) return { fields: [], values: [] }
    const cached = queryClient.getQueryData(['wfs', layer.geoserverLayer, {}])
    const first  = cached?.features?.[0]
    const fields = first?.properties
      ? Object.keys(first.properties).filter(k => !GEO_FIELDS.has(k))
      : []
    const values = fieldName && cached?.features
      ? [...new Set(
          cached.features
            .map(f => f.properties?.[fieldName])
            .filter(v => v !== null && v !== undefined)
            .map(v => String(v))
        )].sort().slice(0, 200)
      : []
    return { fields, values }
  }

  // ── Champs + valeurs uniques (vecteur) ────────────────────────
  const { fields: vecFields, values: vecUniqueValues } = useMemo(
    () => getCachedFieldsAndValues(vecLayer, vecField),
    [vecLayer, vecField, wfsLayers, queryClient] // eslint-disable-line
  )

  // ── Champs + valeurs uniques (CSV) ────────────────────────────
  const { fields: csvFields, values: csvUniqueValues } = useMemo(
    () => getCachedFieldsAndValues(csvLayer, csvField),
    [csvLayer, csvField, wfsLayers, queryClient] // eslint-disable-line
  )

  // ── Print : couches sélectionnées dans la légende ─────────────
  const isChecked   = id => checkedLayers[id] !== false
  const toggleLayer = id => setCheckedLayers(s => ({ ...s, [id]: !isChecked(id) }))
  const selectedLayers = visibleLayers.filter(l => isChecked(l.id))

  // ── Réinitialise l'état quand on ferme ───────────────────────
  const closePanel = () => { setDrawMode(null); setSubTool(null) }
  const goBack     = () => setSubTool(null)

  if (drawMode !== 'export_panel') return null

  // ── Impression ───────────────────────────────────────────────
  const generate = async () => {
    if (!mapInstance) { toast.error('Carte non disponible'); return }
    setLoading(true)
    const toastId = toast.loading('Préparation…')
    const savedCenter = mapInstance.getCenter()
    const savedZoom   = mapInstance.getZoom()
    try {
      const wfsLyrs = selectedLayers.filter(l => l.type !== 'WMS' && l.geoserverLayer)
      const geomTypeMap = {}
      await Promise.allSettled(
        wfsLyrs.map(async l => {
          geomTypeMap[l.geoserverLayer] = await detectGeomType(l.geoserverLayer)
        })
      )
      const targetZoom = scaleToZoom(scale, savedCenter.lat)
      mapInstance.setView(savedCenter, targetZoom, { animate: false })
      toast.loading('Chargement des tuiles…', { id: toastId })
      await new Promise(resolve => {
        let done = false
        const finish = () => { if (!done) { done=true; resolve() } }
        setTimeout(finish, 3000)
        mapInstance.once('idle', finish)
      })

      const mapEl = document.querySelector('.leaflet-container')
      if (!mapEl) throw new Error('Conteneur carte introuvable')
      document.getElementById('__sims_print_root')?.remove()

      const root = document.createElement('div')
      root.id = '__sims_print_root'

      const titleBar = document.createElement('div')
      titleBar.style.cssText = 'padding:8px 16px;background:white;border-bottom:2px solid #1e293b;font-family:Arial,sans-serif;font-size:16px;font-weight:700;color:#1e293b;text-align:center;flex-shrink:0'
      titleBar.textContent = title
      root.appendChild(titleBar)

      const mapZone = document.createElement('div')
      mapZone.style.cssText = 'flex:1;display:flex;overflow:hidden;position:relative'

      const mapParent  = mapEl.parentElement
      const mapNextSib = mapEl.nextSibling
      const mapHolder  = document.createElement('div')
      mapHolder.style.cssText = 'flex:1;position:relative;overflow:hidden'
      mapHolder.appendChild(mapEl)
      mapZone.appendChild(mapHolder)

      if (selectedLayers.length > 0) {
        const legEl = document.createElement('div')
        legEl.style.cssText = 'position:absolute;bottom:40px;right:16px;z-index:1000'
        legEl.innerHTML = buildLegendHTML(selectedLayers, geomTypeMap)
        mapHolder.appendChild(legEl)
      }

      const footer = document.createElement('div')
      footer.style.cssText = 'padding:5px 16px;background:white;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;font-family:Arial,sans-serif;font-size:9px;color:#64748b;flex-shrink:0'
      const now = new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})
      footer.innerHTML = `
        <span>SIMS ENEO Cameroun — ${BASEMAPS[activeBasemap]?.name||'OpenStreetMap'}</span>
        <span style="font-weight:600;color:#1e293b">Échelle 1 : ${scale.toLocaleString('fr-FR')}</span>
        <span>Produit le ${now}</span>
      `
      root.appendChild(mapZone)
      root.appendChild(footer)
      document.body.appendChild(root)

      mapInstance.invalidateSize({ animate: false })
      toast.loading('Impression…', { id: toastId })
      await new Promise(r => setTimeout(r, 300))
      window.print()

      if (mapNextSib) mapParent.insertBefore(mapEl, mapNextSib)
      else mapParent.appendChild(mapEl)
      root.remove()
      mapInstance.invalidateSize({ animate: false })
      mapInstance.setView(savedCenter, savedZoom, { animate: false })
      toast.success('Impression lancée', { id: toastId })
    } catch(err) {
      try {
        const mapEl2 = document.querySelector('.leaflet-container')
        document.getElementById('__sims_print_root')?.remove()
        if (mapEl2) mapInstance.invalidateSize({ animate: false })
        mapInstance.setView(savedCenter, savedZoom, { animate: false })
      } catch(_) {}
      console.error('[PrintExport]', err)
      toast.error(`Erreur : ${err.message}`, { id: toastId })
    } finally {
      setLoading(false)
    }
  }

  // ── Export vecteur ───────────────────────────────────────────
  const exportVector = async () => {
    if (!vecLayer) { toast.error('Sélectionnez une couche'); return }
    const layer = wfsLayers.find(l => l.id === vecLayer)
    if (!layer) return
    setVecLoading(true)
    const toastId = toast.loading('Chargement des données…')
    try {
      const fc = await fetchWFSData(queryClient, layer)
      if (!fc?.features) throw new Error('Aucune donnée disponible')

      let features = applyAttrFilter(fc.features, vecField, vecOp, vecValue)
      toast.loading(`${features.length} entité(s) sélectionnée(s)…`, { id: toastId })

      const exportedFC = { type:'FeatureCollection', features }
      const safeName = layer.name.replace(/[^a-z0-9_-]/gi,'_').toLowerCase()
      const now = new Date().toISOString().slice(0,10)

      if (vecFormat === 'GeoJSON') {
        downloadBlob(
          JSON.stringify(exportedFC, null, 2),
          `${safeName}_${now}.geojson`,
          'application/geo+json;charset=utf-8'
        )
        toast.success(`GeoJSON exporté (${features.length} entités)`, { id: toastId })
      } else {
        const kml = geojsonToKML(exportedFC, layer.name)
        downloadBlob(kml, `${safeName}_${now}.kml`, 'application/vnd.google-earth.kml+xml;charset=utf-8')
        toast.success(`KML exporté (${features.length} entités)`, { id: toastId })
      }
    } catch(err) {
      console.error('[ExportVector]', err)
      toast.error(`Erreur : ${err.message}`, { id: toastId })
    } finally {
      setVecLoading(false)
    }
  }

  // ── Export CSV ───────────────────────────────────────────────
  const exportCSV = async () => {
    if (!csvLayer) { toast.error('Sélectionnez une couche'); return }
    const layer = wfsLayers.find(l => l.id === csvLayer)
    if (!layer) return
    setCsvLoading(true)
    const toastId = toast.loading('Chargement des données…')
    try {
      const fc = await fetchWFSData(queryClient, layer)
      if (!fc?.features) throw new Error('Aucune donnée disponible')

      let features = applyAttrFilter(fc.features, csvField, csvOp, csvValue)
      toast.loading(`${features.length} entité(s) sélectionnée(s)…`, { id: toastId })

      if (features.length === 0) {
        toast('Aucune entité ne correspond au filtre', { icon:'ℹ️', id: toastId })
        return
      }

      // En-têtes : tous les champs non géographiques
      const headers = features[0].properties
        ? Object.keys(features[0].properties).filter(k => !GEO_FIELDS.has(k))
        : []

      const escape = v => {
        const s = String(v ?? '')
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g,'""')}"`
          : s
      }

      const rows = features.map(f =>
        headers.map(h => escape(f.properties?.[h] ?? '')).join(',')
      )

      const csv = '\uFEFF' + [headers.join(','), ...rows].join('\r\n')
      const safeName = layer.name.replace(/[^a-z0-9_-]/gi,'_').toLowerCase()
      const now = new Date().toISOString().slice(0,10)
      downloadBlob(csv, `${safeName}_${now}.csv`, 'text/csv;charset=utf-8')
      toast.success(`CSV exporté (${features.length} entités)`, { id: toastId })
    } catch(err) {
      console.error('[ExportCSV]', err)
      toast.error(`Erreur : ${err.message}`, { id: toastId })
    } finally {
      setCsvLoading(false)
    }
  }

  // ── UI ────────────────────────────────────────────────────────

  // En-tête partagé
  const Header = ({ label, icon: Icon, color }) => (
    <div style={{
      display:'flex', alignItems:'center', gap:8, padding:'10px 14px',
      position:'sticky', top:0, zIndex:1,
      borderBottom:'1px solid rgba(255,255,255,0.08)',
      background: subTool ? 'rgba(30,41,59,0.95)' : 'rgba(99,102,241,0.15)',
    }}>
      {subTool && (
        <button onClick={goBack} style={{ background:'none', border:'none', color:'rgba(200,210,230,0.5)', cursor:'pointer', padding:2, display:'flex', alignItems:'center' }}>
          <ChevronLeft size={16}/>
        </button>
      )}
      <Icon size={14} style={{ color: color || '#a5b4fc' }}/>
      <span style={{ fontWeight:600, color: color || '#a5b4fc', flex:1, fontSize:13 }}>{label}</span>
      <button onClick={closePanel} style={{ background:'none', border:'none', color:'rgba(200,210,230,0.5)', cursor:'pointer', padding:2 }}>
        <X size={14}/>
      </button>
    </div>
  )

  // ── Panneau principal : 3 cartes ──────────────────────────────
  if (!subTool) return (
    <div style={panelStyle}>
      <Header label="Impression & Export" icon={Printer} />
      <div style={{ padding:14, display:'flex', flexDirection:'column', gap:10 }}>

        {/* Imprimer la carte */}
        <button onClick={() => setSubTool('print')} style={cardStyle('#6366f1')}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={iconBox('#6366f1')}><Printer size={18} color="#fff"/></div>
            <div style={{ textAlign:'left' }}>
              <div style={{ fontWeight:600, fontSize:13, color:'#e2e8f0' }}>Imprimer la carte</div>
              <div style={{ fontSize:11, color:'rgba(200,210,230,0.5)', marginTop:2 }}>
                Impression navigateur / export PDF
              </div>
            </div>
          </div>
        </button>

        {/* Exporter vecteur */}
        <button onClick={() => setSubTool('vector')} style={cardStyle('#10b981')}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={iconBox('#10b981')}><Download size={18} color="#fff"/></div>
            <div style={{ textAlign:'left' }}>
              <div style={{ fontWeight:600, fontSize:13, color:'#e2e8f0' }}>Exporter vecteur</div>
              <div style={{ fontSize:11, color:'rgba(200,210,230,0.5)', marginTop:2 }}>
                Télécharger en GeoJSON ou KML
              </div>
            </div>
          </div>
        </button>

        {/* Exporter CSV */}
        <button onClick={() => setSubTool('csv')} style={cardStyle('#f59e0b')}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={iconBox('#f59e0b')}><FileText size={18} color="#fff"/></div>
            <div style={{ textAlign:'left' }}>
              <div style={{ fontWeight:600, fontSize:13, color:'#e2e8f0' }}>Exporter CSV</div>
              <div style={{ fontSize:11, color:'rgba(200,210,230,0.5)', marginTop:2 }}>
                Tableur des attributs (Excel compatible)
              </div>
            </div>
          </div>
        </button>

      </div>
    </div>
  )

  // ── Sous-outil : Impression ────────────────────────────────────
  if (subTool === 'print') return (
    <div style={panelStyle}>
      <Header label="Imprimer la carte" icon={Printer} color="#a5b4fc" />
      <div style={{ padding:14, display:'flex', flexDirection:'column', gap:14 }}>

        <div style={infoBox}>
          La carte sera ouverte dans la boîte de dialogue d'impression du navigateur.
          Pour exporter en <strong style={{color:'#a5b4fc'}}>PDF</strong>, sélectionnez
          <em> « Enregistrer au format PDF »</em> comme imprimante.
        </div>

        <div>
          <label style={labelSt}>Titre de la carte</label>
          <input value={title} onChange={e=>setTitle(e.target.value)} style={inputSt} placeholder="Titre…"/>
        </div>

        <div>
          <label style={labelSt}>Échelle approximative</label>
          <select value={scale} onChange={e=>setScale(Number(e.target.value))} style={selectSt}>
            {SCALES.map(s=><option key={s} value={s}>1 : {s.toLocaleString('fr-FR')}</option>)}
          </select>
          <p style={{ fontSize:10, color:'rgba(200,210,230,0.4)', margin:'4px 0 0' }}>
            Ajuste le zoom de la carte pour correspondre à l'échelle choisie.
          </p>
        </div>

        <div>
          <label style={labelSt}>Couches à afficher dans la légende</label>
          {visibleLayers.length === 0
            ? <p style={{ color:'rgba(200,210,230,0.4)', fontSize:12, margin:0 }}>Aucune couche visible</p>
            : <div style={{ border:'1px solid rgba(255,255,255,0.08)', borderRadius:6, overflow:'hidden' }}>
                {visibleLayers.map((layer,i)=>(
                  <label key={layer.id} style={{
                    display:'flex', alignItems:'center', gap:8,
                    padding:'7px 10px', cursor:'pointer',
                    background:i%2===0?'rgba(255,255,255,0.02)':'transparent',
                    borderBottom:i<visibleLayers.length-1?'1px solid rgba(255,255,255,0.05)':'none',
                  }}>
                    <input type="checkbox" checked={isChecked(layer.id)} onChange={()=>toggleLayer(layer.id)}
                      style={{ accentColor:layer.color||'#6366f1', width:14, height:14 }}/>
                    <span style={{ width:10, height:10, borderRadius:'50%', background:layer.color||'#6366f1', flexShrink:0, display:'inline-block' }}/>
                    <span style={{ fontSize:12, flex:1 }}>{layer.name}</span>
                  </label>
                ))}
              </div>
          }
        </div>

        <div style={{ height:1, background:'rgba(255,255,255,0.08)' }}/>

        <button onClick={generate} disabled={loading} style={actionBtn('#6366f1', loading)}
          onMouseOver={e=>{if(!loading)e.currentTarget.style.background='#4f46e5'}}
          onMouseOut={e=>{e.currentTarget.style.background=loading?'rgba(99,102,241,0.4)':'#6366f1'}}
        >
          <Printer size={14}/> {loading ? 'Préparation…' : 'Lancer l\'impression / PDF'}
        </button>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  // ── Sous-outil : Export vecteur ───────────────────────────────
  if (subTool === 'vector') return (
    <div style={panelStyle}>
      <Header label="Exporter vecteur" icon={Download} color="#6ee7b7" />
      <div style={{ padding:14, display:'flex', flexDirection:'column', gap:14 }}>

        {/* Couche */}
        <div>
          <label style={labelSt}>Couche à exporter</label>
          <select value={vecLayer} onChange={e=>{ setVecLayer(e.target.value); setVecField('') }} style={selectSt}>
            <option value="">— Choisir une couche —</option>
            {wfsLayers.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>

        {/* Format */}
        <div>
          <label style={labelSt}>Format d'export</label>
          <div style={{ display:'flex', gap:8 }}>
            {VEC_FORMATS.map(fmt => (
              <button key={fmt} onClick={() => setVecFormat(fmt)} style={{
                flex:1, padding:'7px 0', border:`1px solid ${vecFormat===fmt?'#10b981':'rgba(255,255,255,0.1)'}`,
                borderRadius:6, background: vecFormat===fmt ? 'rgba(16,185,129,0.15)' : 'rgba(30,41,59,0.9)',
                color: vecFormat===fmt ? '#6ee7b7' : 'rgba(200,210,230,0.6)',
                cursor:'pointer', fontWeight: vecFormat===fmt ? 600 : 400, fontSize:12,
              }}>
                {fmt}
              </button>
            ))}
          </div>
        </div>

        {/* Filtre attributaire */}
        <div>
          <label style={{ ...labelSt, display:'flex', alignItems:'center', gap:5, marginBottom:8 }}>
            <Filter size={11}/> Filtre attributaire <span style={{ fontStyle:'italic', fontWeight:400 }}>(optionnel)</span>
          </label>
          {vecLayer
            ? <AttrFilter fields={vecFields} field={vecField} setField={setVecField}
                op={vecOp} setOp={setVecOp} value={vecValue} setValue={setVecValue}
                uniqueValues={vecUniqueValues} listId="vec-field-values" />
            : <p style={{ color:'rgba(200,210,230,0.35)', fontSize:12, margin:0, fontStyle:'italic' }}>
                Sélectionnez d'abord une couche
              </p>
          }
        </div>

        <div style={{ height:1, background:'rgba(255,255,255,0.08)' }}/>

        <button onClick={exportVector} disabled={vecLoading} style={actionBtn('#10b981', vecLoading)}
          onMouseOver={e=>{if(!vecLoading)e.currentTarget.style.background='#059669'}}
          onMouseOut={e=>{e.currentTarget.style.background=vecLoading?'rgba(16,185,129,0.4)':'#10b981'}}
        >
          <Download size={14}/> {vecLoading ? 'Export en cours…' : `Télécharger ${vecFormat}`}
        </button>
      </div>
    </div>
  )

  // ── Sous-outil : Export CSV ───────────────────────────────────
  if (subTool === 'csv') return (
    <div style={panelStyle}>
      <Header label="Exporter CSV" icon={FileText} color="#fcd34d" />
      <div style={{ padding:14, display:'flex', flexDirection:'column', gap:14 }}>

        <div style={{ ...infoBox, borderColor:'rgba(245,158,11,0.25)', background:'rgba(245,158,11,0.08)' }}>
          Exporte les attributs de la couche sélectionnée au format CSV (compatible Excel).
          Les colonnes géométriques sont exclues automatiquement.
        </div>

        {/* Couche */}
        <div>
          <label style={labelSt}>Couche à exporter</label>
          <select value={csvLayer} onChange={e=>{ setCsvLayer(e.target.value); setCsvField('') }} style={selectSt}>
            <option value="">— Choisir une couche —</option>
            {wfsLayers.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>

        {/* Filtre attributaire */}
        <div>
          <label style={{ ...labelSt, display:'flex', alignItems:'center', gap:5, marginBottom:8 }}>
            <Filter size={11}/> Filtre attributaire <span style={{ fontStyle:'italic', fontWeight:400 }}>(optionnel)</span>
          </label>
          {csvLayer
            ? <AttrFilter fields={csvFields} field={csvField} setField={setCsvField}
                op={csvOp} setOp={setCsvOp} value={csvValue} setValue={setCsvValue}
                uniqueValues={csvUniqueValues} listId="csv-field-values" />
            : <p style={{ color:'rgba(200,210,230,0.35)', fontSize:12, margin:0, fontStyle:'italic' }}>
                Sélectionnez d'abord une couche
              </p>
          }
        </div>

        <div style={{ height:1, background:'rgba(255,255,255,0.08)' }}/>

        <button onClick={exportCSV} disabled={csvLoading} style={actionBtn('#f59e0b', csvLoading)}
          onMouseOver={e=>{if(!csvLoading)e.currentTarget.style.background='#d97706'}}
          onMouseOut={e=>{e.currentTarget.style.background=csvLoading?'rgba(245,158,11,0.4)':'#f59e0b'}}
        >
          <FileText size={14}/> {csvLoading ? 'Export en cours…' : 'Télécharger CSV'}
        </button>
      </div>
    </div>
  )

  return null
}

// ── Styles ─────────────────────────────────────────────────────
const panelStyle = {
  position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
  zIndex:2000, width:340,
  background:'rgba(15,23,42,0.97)', backdropFilter:'blur(10px)',
  border:'1px solid rgba(255,255,255,0.1)', borderRadius:10,
  boxShadow:'0 8px 32px rgba(0,0,0,0.5)', color:'#e2e8f0', fontSize:13,
  maxHeight:'85vh', overflowY:'auto',
}

const cardStyle = (color) => ({
  width:'100%', padding:'12px 14px', cursor:'pointer',
  background:`rgba(${hexToRgb(color)},0.06)`,
  border:`1px solid rgba(${hexToRgb(color)},0.2)`,
  borderRadius:8,
  transition:'background 0.15s, border-color 0.15s',
  textAlign:'left',
})

const iconBox = (color) => ({
  width:40, height:40, borderRadius:8,
  background:color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
})

const actionBtn = (color, disabled) => ({
  background: disabled ? `rgba(${hexToRgb(color)},0.4)` : color,
  border:'none', borderRadius:7, color:'#fff',
  padding:'10px 0', cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize:13, fontWeight:600,
  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
  transition:'background 0.15s',
})

const infoBox = {
  background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.2)',
  borderRadius:6, padding:'8px 10px', fontSize:11, color:'rgba(200,210,230,0.7)', lineHeight:1.5,
}

const labelSt  = { fontSize:11, color:'rgba(200,210,230,0.55)', display:'block', marginBottom:5 }
const selectSt = { width:'100%', background:'rgba(30,41,59,0.9)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, color:'#e2e8f0', padding:'6px 8px', fontSize:12, outline:'none' }
const inputSt  = { width:'100%', boxSizing:'border-box', background:'rgba(30,41,59,0.9)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, color:'#e2e8f0', padding:'6px 9px', fontSize:12, outline:'none' }

// Convertit un hex (#10b981) en "r,g,b" pour rgba()
function hexToRgb(hex) {
  const h = hex.replace('#','')
  const r = parseInt(h.slice(0,2),16)
  const g = parseInt(h.slice(2,4),16)
  const b = parseInt(h.slice(4,6),16)
  return `${r},${g},${b}`
}
