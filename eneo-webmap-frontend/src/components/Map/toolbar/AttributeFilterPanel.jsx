import { useState, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { X, Filter } from 'lucide-react'
import { useMapStore } from '../../../store/mapStore'
import { useAppLayers } from '../../../hooks/useGeoData'
import toast from 'react-hot-toast'
import { useAppContext } from '../../../context/AppContext'

const GEO_FIELDS = new Set(['geom', 'geometry', 'wkb_geometry', 'the_geom', 'shape'])
const OPERATORS  = ['=', '≠', 'contient', 'commence par', '>', '<']

/**
 * Panneau flottant de filtre attributaire.
 * Ouvert quand drawMode === 'attr_query'.
 * Résultats renvoyés dans selectionResults (même store que la sélection spatiale).
 */
export default function AttributeFilterPanel() {
  const { appSlug } = useAppContext()
  const queryClient = useQueryClient()
  const { drawMode, setDrawMode, layerStates, setSelectionResults } = useMapStore()
  const { layerGroups } = useAppLayers(appSlug)

  const [filterLayer, setFilterLayer] = useState('')
  const [filterField, setFilterField] = useState('')
  const [filterOp,    setFilterOp]    = useState('=')
  const [filterValue, setFilterValue] = useState('')

  // Couches vecteur visibles (non-WMS)
  const wfsLayers = layerGroups.flatMap(g => g.layers)
    .filter(l => l.type !== 'WMS' && layerStates[l.id]?.visible)

  // ── Champs disponibles — AVANT tout return conditionnel ───────
  const availableFields = useMemo(() => {
    if (!filterLayer) return []
    const layer  = wfsLayers.find(l => l.id === filterLayer)
    if (!layer) return []
    const cached = queryClient.getQueryData(['wfs', layer.geoserverLayer, {}])
    const first  = cached?.features?.[0]
    if (!first?.properties) return []
    return Object.keys(first.properties).filter(k => !GEO_FIELDS.has(k))
  }, [filterLayer, wfsLayers, queryClient])

  // ── Valeurs uniques pour l'autocomplete — AVANT tout return conditionnel ──
  const uniqueValues = useMemo(() => {
    if (!filterLayer || !filterField) return []
    const layer  = wfsLayers.find(l => l.id === filterLayer)
    if (!layer) return []
    const cached = queryClient.getQueryData(['wfs', layer.geoserverLayer, {}])
    if (!cached?.features) return []
    return [...new Set(
      cached.features
        .map(f => f.properties?.[filterField])
        .filter(v => v !== null && v !== undefined)
        .map(v => String(v))
    )].sort().slice(0, 200)
  }, [filterLayer, filterField, wfsLayers, queryClient])

  if (drawMode !== 'attr_query') return null

  // ── Application du filtre ──────────────────────────────────
  function applyFilter() {
    if (!filterLayer || !filterField || !filterValue.trim()) {
      toast.error('Renseignez couche, champ et valeur')
      return
    }
    const layer  = wfsLayers.find(l => l.id === filterLayer)
    if (!layer) return
    const cached = queryClient.getQueryData(['wfs', layer.geoserverLayer, {}])
    if (!cached?.features) { toast.error('Données non disponibles'); return }

    const val = filterValue.toLowerCase().trim()
    const matches = cached.features.filter(f => {
      const raw = f.properties?.[filterField]
      if (raw === undefined || raw === null) return false
      const v = String(raw).toLowerCase()
      switch (filterOp) {
        case '=':            return v === val
        case '≠':            return v !== val
        case 'contient':     return v.includes(val)
        case 'commence par': return v.startsWith(val)
        case '>':            return parseFloat(raw) > parseFloat(filterValue)
        case '<':            return parseFloat(raw) < parseFloat(filterValue)
        default:             return false
      }
    })

    const results = matches.map(feature => ({
      feature,
      layerId:   layer.id,
      layerName: layer.name,
    }))

    setSelectionResults(results)
    setDrawMode(null)

    if (!results.length) toast('Aucun résultat pour ce filtre', { icon: 'ℹ️' })
    else toast.success(`${results.length} entité(s) trouvée(s)`)
  }

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 2000,
      width: 300,
      background: 'rgba(15,23,42,0.97)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 10,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      color: '#e2e8f0',
      fontSize: 13,
      pointerEvents: 'auto',
      overflow: 'hidden',
    }}>

      {/* ── En-tête ───────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(99,102,241,0.12)',
      }}>
        <Filter size={14} style={{ color: '#a5b4fc' }} />
        <span style={{ fontWeight: 600, fontSize: 13, color: '#a5b4fc', flex: 1 }}>
          Filtre attributaire
        </span>
        <button onClick={() => setDrawMode(null)} style={closeBtnStyle}>
          <X size={14} />
        </button>
      </div>

      {/* ── Formulaire ───────────────────────────────────── */}
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Couche */}
        <div>
          <label style={labelStyle}>Couche</label>
          <select
            value={filterLayer}
            onChange={e => { setFilterLayer(e.target.value); setFilterField(''); setFilterValue('') }}
            style={selectStyle}
          >
            <option value="">— Choisir une couche —</option>
            {wfsLayers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>

        {filterLayer && (
          <>
            {/* Champ */}
            <div>
              <label style={labelStyle}>Champ</label>
              <select
                value={filterField}
                onChange={e => { setFilterField(e.target.value); setFilterValue('') }}
                style={selectStyle}
              >
                <option value="">— Choisir un champ —</option>
                {availableFields.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            {filterField && (
              <>
                {/* Opérateur + Valeur */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: '0 0 100px' }}>
                    <label style={labelStyle}>Opérateur</label>
                    <select value={filterOp} onChange={e => setFilterOp(e.target.value)}
                      style={selectStyle}>
                      {OPERATORS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Valeur</label>
                    <input
                      list="attr-filter-values"
                      value={filterValue}
                      onChange={e => setFilterValue(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && applyFilter()}
                      placeholder={uniqueValues.length ? `${uniqueValues.length} valeurs…` : 'Entrez une valeur…'}
                      style={inputStyle}
                      autoComplete="off"
                    />
                    {uniqueValues.length > 0 && (
                      <datalist id="attr-filter-values">
                        {uniqueValues.map(v => <option key={v} value={v}/>)}
                      </datalist>
                    )}
                  </div>
                </div>

                {/* Bouton */}
                <button onClick={applyFilter} style={{
                  background: '#6366f1', border: 'none', borderRadius: 7,
                  color: '#fff', padding: '8px 0', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  transition: 'background 0.15s',
                }}
                  onMouseOver={e => e.currentTarget.style.background = '#4f46e5'}
                  onMouseOut={e  => e.currentTarget.style.background = '#6366f1'}
                >
                  <Filter size={13} /> Appliquer le filtre
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────
const labelStyle = {
  fontSize: 11, color: 'rgba(200,210,230,0.55)',
  display: 'block', marginBottom: 4,
}
const selectStyle = {
  width: '100%',
  background: 'rgba(30,41,59,0.9)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6, color: '#e2e8f0',
  padding: '6px 8px', fontSize: 12, outline: 'none',
}
const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(30,41,59,0.9)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6, color: '#e2e8f0',
  padding: '6px 9px', fontSize: 12, outline: 'none',
}
const closeBtnStyle = {
  background: 'none', border: 'none',
  color: 'rgba(200,210,230,0.5)', cursor: 'pointer', padding: 2,
}
