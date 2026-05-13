import { useMemo, useState } from 'react'
import { X, Download, ZoomIn, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMapStore } from '../../../store/mapStore'
import { useAppLayers } from '../../../hooks/useGeoData'
import { useAppContext } from '../../../context/AppContext'

const GEO_FIELDS = new Set(['geom', 'geometry', 'wkb_geometry', 'the_geom', 'shape'])

// ── Export CSV ────────────────────────────────────────────────
function exportCSV(columns, rows, filename = 'selection.csv') {
  const header = columns.join(';')
  const lines  = rows.map(r => columns.map(c => {
    const v = r.properties?.[c] ?? ''
    return `"${String(v).replace(/"/g, '""')}"`
  }).join(';'))
  const blob = new Blob(['\uFEFF' + [header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

/**
 * Tableau de résultats plein-bas.
 * Affiché quand selectionResults est non vide.
 * Colonnes = attributs des features (popup_fields si configuré, sinon tout).
 * Surbrillance jaune gérée par SelectionLayer.
 */
export default function SelectionPanel() {
  const { appSlug } = useAppContext()
  const { selectionResults, clearSelectionResults, mapInstance } = useMapStore()
  const { layerGroups } = useAppLayers(appSlug)

  // Onglet actif (layerId)
  const [activeLayer, setActiveLayer] = useState(null)

  // ── Groupes par couche ────────────────────────────────────
  const grouped = useMemo(() => {
    const map = {}
    selectionResults.forEach(({ feature, layerId, layerName }) => {
      if (!map[layerId]) map[layerId] = { layerId, layerName, features: [] }
      map[layerId].features.push(feature)
    })
    return Object.values(map)
  }, [selectionResults])

  const currentGroup = useMemo(() => {
    if (!grouped.length) return null
    return grouped.find(g => g.layerId === activeLayer) || grouped[0]
  }, [grouped, activeLayer])

  // ── Colonnes : popup_fields si dispo, sinon properties ───
  const columns = useMemo(() => {
    if (!currentGroup) return []
    const layerCfg = layerGroups.flatMap(g => g.layers).find(l => l.id === currentGroup.layerId)
    if (layerCfg?.popupFields?.length) return layerCfg.popupFields

    const first = currentGroup.features[0]
    if (!first?.properties) return []
    return Object.keys(first.properties).filter(k => !GEO_FIELDS.has(k))
  }, [currentGroup, layerGroups])

  // ── Zoom sur une feature ──────────────────────────────────
  function zoomTo(feature) {
    if (!mapInstance || !feature.geometry) return
    const coords = feature.geometry.coordinates
    if (feature.geometry.type === 'Point') {
      mapInstance.flyTo([coords[1], coords[0]], 17, { duration: 1 })
    } else {
      try {
        const b = window.L?.geoJSON(feature)?.getBounds()
        if (b) mapInstance.flyToBounds(b, { padding: [40, 40], duration: 1 })
      } catch { /* */ }
    }
  }

  if (!selectionResults.length) return null

  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      background: 'rgba(15,23,42,0.97)',
      backdropFilter: 'blur(10px)',
      borderTop: '2px solid rgba(251,191,36,0.5)',   // liseré jaune = rappel surbrillance
      boxShadow: '0 -4px 24px rgba(0,0,0,0.5)',
      display: 'flex',
      flexDirection: 'column',
      maxHeight: 240,
      pointerEvents: 'auto',
      color: '#e2e8f0',
      fontSize: 12,
    }}>

      {/* ── Barre de titre ─────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}>
        {/* Onglets couches */}
        <div style={{ display: 'flex', gap: 4, flex: 1, overflowX: 'auto' }}>
          {grouped.map(g => (
            <button key={g.layerId} onClick={() => setActiveLayer(g.layerId)}
              style={{
                background: (currentGroup?.layerId === g.layerId)
                  ? 'rgba(251,191,36,0.2)' : 'transparent',
                border: (currentGroup?.layerId === g.layerId)
                  ? '1px solid rgba(251,191,36,0.5)' : '1px solid transparent',
                color: (currentGroup?.layerId === g.layerId) ? '#FBBF24' : 'rgba(200,210,230,0.6)',
                borderRadius: 5, padding: '2px 10px', cursor: 'pointer', fontSize: 11,
                whiteSpace: 'nowrap',
              }}>
              {g.layerName} <span style={{ opacity: 0.6 }}>({g.features.length})</span>
            </button>
          ))}
        </div>

        {/* Total */}
        <span style={{ color: 'rgba(200,210,230,0.5)', fontSize: 11, whiteSpace: 'nowrap' }}>
          {selectionResults.length} entité(s) sélectionnée(s)
        </span>

        {/* Export CSV */}
        <button
          onClick={() => currentGroup && exportCSV(columns, currentGroup.features,
            `${currentGroup.layerName}_selection.csv`)}
          title="Exporter en CSV"
          style={iconBtnStyle}
        >
          <Download size={14} />
        </button>

        {/* Fermer */}
        <button onClick={clearSelectionResults} title="Fermer" style={iconBtnStyle}>
          <X size={14} />
        </button>
      </div>

      {/* ── Tableau ────────────────────────────────────────── */}
      <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
        {currentGroup && columns.length > 0 ? (
          <table style={{
            width: '100%', borderCollapse: 'collapse',
            fontSize: 12, tableLayout: 'fixed',
          }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.05)', position: 'sticky', top: 0 }}>
                <th style={{ ...thStyle, width: 36 }}>#</th>
                <th style={{ ...thStyle, width: 36 }}>🔍</th>
                {columns.map(col => (
                  <th key={col} style={thStyle}>{col.replace(/_/g, ' ')}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentGroup.features.map((feature, i) => (
                <tr key={i}
                  style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  onMouseOver={e  => e.currentTarget.style.background = 'rgba(251,191,36,0.06)'}
                  onMouseOut={e   => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ ...tdStyle, color: 'rgba(200,210,230,0.4)', textAlign: 'center' }}>
                    {i + 1}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <button onClick={() => zoomTo(feature)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer',
                               color: 'rgba(165,180,252,0.7)', padding: 0 }}>
                      <ZoomIn size={12} />
                    </button>
                  </td>
                  {columns.map(col => (
                    <td key={col} style={tdStyle}>
                      {feature.properties?.[col] !== null && feature.properties?.[col] !== undefined
                        ? String(feature.properties[col])
                        : <span style={{ color: 'rgba(200,210,230,0.25)' }}>—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(200,210,230,0.3)' }}>
            Aucune donnée à afficher
          </div>
        )}
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────
const thStyle = {
  padding: '5px 10px', textAlign: 'left',
  color: 'rgba(200,210,230,0.55)', fontWeight: 600,
  fontSize: 11, whiteSpace: 'nowrap',
  borderRight: '1px solid rgba(255,255,255,0.05)',
  overflow: 'hidden', textOverflow: 'ellipsis',
}
const tdStyle = {
  padding: '4px 10px', color: '#cbd5e1',
  borderRight: '1px solid rgba(255,255,255,0.04)',
  whiteSpace: 'nowrap', overflow: 'hidden',
  textOverflow: 'ellipsis', maxWidth: 180,
}
const iconBtnStyle = {
  background: 'none', border: 'none',
  color: 'rgba(200,210,230,0.55)', cursor: 'pointer',
  padding: 4, borderRadius: 5, display: 'flex',
  alignItems: 'center', justifyContent: 'center',
  transition: 'color 0.15s',
}
