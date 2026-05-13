import { useState } from 'react'
import { X, ChevronDown, ChevronUp, Download } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'

/**
 * Tableau attributaire bas de page — affiché quand une entité est sélectionnée.
 * Hauteur réglable par drag.
 */
export default function AttributeTable({ feature }) {
  const { clearSelectedFeature } = useMapStore()
  const [expanded, setExpanded]  = useState(false)

  if (!feature) return null

  const { properties, layerName } = feature

  // Filtrer les colonnes techniques
  const entries = Object.entries(properties || {})
    .filter(([k]) => !['geom', 'geometry', 'wkb_geometry'].includes(k))

  const exportCSV = () => {
    const header = entries.map(([k]) => k).join(',')
    const row    = entries.map(([, v]) => `"${v ?? ''}"`).join(',')
    const blob   = new Blob([header + '\n' + row], { type: 'text/csv;charset=utf-8;' })
    const url    = URL.createObjectURL(blob)
    const a      = document.createElement('a')
    a.href       = url
    a.download   = `${layerName}_feature.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      className={`border-t border-gray-200 bg-white shadow-lg transition-all duration-200 ${
        expanded ? 'h-64' : 'h-36'
      }`}
    >
      {/* En-tête */}
      <div className="flex items-center justify-between px-4 py-2 bg-brand-dark text-white">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{layerName}</span>
          <span className="text-white/40 text-xs">— {entries.length} attributs</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={exportCSV}
            title="Exporter en CSV"
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setExpanded(v => !v)}
            title={expanded ? 'Réduire' : 'Agrandir'}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
          >
            {expanded
              ? <ChevronDown className="w-3.5 h-3.5" />
              : <ChevronUp   className="w-3.5 h-3.5" />
            }
          </button>
          <button
            onClick={clearSelectedFeature}
            title="Fermer"
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Corps — tableau scrollable */}
      <div className="overflow-auto h-[calc(100%-40px)]">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              {entries.map(([k]) => (
                <th
                  key={k}
                  className="px-3 py-2 text-left font-semibold text-gray-500 border-b border-r
                             border-gray-200 capitalize whitespace-nowrap"
                >
                  {k.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="hover:bg-eneo-50">
              {entries.map(([k, v]) => (
                <td
                  key={k}
                  className="px-3 py-2 border-b border-r border-gray-100 text-gray-800
                             whitespace-nowrap max-w-[200px] truncate"
                  title={v !== null && v !== undefined ? String(v) : ''}
                >
                  {v !== null && v !== undefined ? String(v) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
