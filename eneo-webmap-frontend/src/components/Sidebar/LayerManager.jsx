import { useState, useEffect } from 'react'
import { Eye, EyeOff, ChevronDown, ChevronRight, Loader2, WifiOff } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'
import { useAppLayers } from '../../hooks/useGeoData'
import { getLegendUrl } from '../../services/geoserver'
import { BASEMAPS } from '../../config/constants'
import { useAppContext } from '../../context/AppContext'

const DIVIDER  = '1px solid rgba(255,255,255,0.06)'
const CARD_BG  = 'rgba(255,255,255,0.04)'
const CARD_HOV = 'rgba(255,255,255,0.08)'

export default function LayerManager() {
  const { appSlug } = useAppContext()
  const { layerGroups, isLoading, isError } = useAppLayers(appSlug)

  const {
    layerStates, toggleLayerVisibility, setLayerOpacity,
    activeBasemap, setBasemap, initLayerStates,
  } = useMapStore()

  const [expanded, setExpanded] = useState({})

  // Dépendance stable : string des IDs plutôt que la référence tableau (évite la boucle infinie)
  const groupIds = layerGroups?.map(g => g.id).join(',') ?? ''

  useEffect(() => {
    if (!groupIds) return
    // Ouvrir les nouveaux groupes sans écraser l'état des groupes déjà gérés
    setExpanded(prev => {
      const next = { ...prev }
      layerGroups.forEach(g => { if (!(g.id in next)) next[g.id] = true })
      return next
    })
    initLayerStates(layerGroups.flatMap(g => g.layers))
  }, [groupIds]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id) => setExpanded(s => ({ ...s, [id]: !s[id] }))

  return (
    <div className="p-3 space-y-4">

      {/* ── Fond de carte ───────────────────────────────────── */}
      <section>
        <p className="text-[10px] font-bold uppercase tracking-widest px-1 mb-2"
           style={{ color: 'rgba(255,255,255,0.35)' }}>
          Fond de carte
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.values(BASEMAPS).map(bm => {
            const active = activeBasemap === bm.id
            return (
              <button
                key={bm.id}
                onClick={() => setBasemap(bm.id)}
                className="text-xs px-2 py-2 rounded-lg border transition-all text-left truncate"
                style={active
                  ? { background: 'rgba(0,170,221,0.15)', color: '#00AADD', borderColor: '#00AADD' }
                  : { background: CARD_BG, color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.1)' }
                }
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = CARD_HOV }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = CARD_BG }}
              >
                {bm.name}
              </button>
            )
          })}
        </div>
      </section>

      {/* ── Couches ─────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between px-1 mb-2">
          <p className="text-[10px] font-bold uppercase tracking-widest"
             style={{ color: 'rgba(255,255,255,0.35)' }}>
            Couches
          </p>
          {/* Indicateur source */}
          <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                style={isError
                  ? { background: 'rgba(255,71,87,0.15)', color: '#FF6B7A' }
                  : { background: 'rgba(0,170,221,0.12)', color: '#00AADD' }
                }>
            {isError ? <><WifiOff className="inline w-2.5 h-2.5 mr-0.5" />local</> : 'API Django'}
          </span>
        </div>

        {/* Chargement */}
        {isLoading && (
          <div className="flex items-center justify-center py-6 gap-2"
               style={{ color: 'rgba(255,255,255,0.4)' }}>
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#00AADD' }} />
            <span className="text-xs">Chargement des couches…</span>
          </div>
        )}

        {/* Aucune couche configurée */}
        {!isLoading && layerGroups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-center"
               style={{ color: 'rgba(255,255,255,0.25)' }}>
            <span className="text-2xl">🗺️</span>
            <p className="text-xs">Aucune couche configurée</p>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.15)' }}>
              Publiez des couches depuis l'admin Django
            </p>
          </div>
        )}

        {/* Groupes */}
        {!isLoading && layerGroups.length > 0 && (
          <div className="space-y-2">
            {layerGroups.map(group => (
              <div key={group.id} className="rounded-lg overflow-hidden"
                   style={{ border: DIVIDER, background: 'rgba(255,255,255,0.02)' }}>

                {/* En-tête groupe */}
                <button
                  onClick={() => toggle(group.id)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left transition-colors"
                  style={{ color: 'rgba(255,255,255,0.75)', borderBottom: expanded[group.id] ? DIVIDER : 'none' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span className="text-sm leading-none">{group.icon}</span>
                  <span className="flex-1 text-xs font-semibold">{group.label}</span>
                  <span className="text-[10px] mr-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {group.layers.length}
                  </span>
                  {expanded[group.id]
                    ? <ChevronDown  className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
                    : <ChevronRight className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
                  }
                </button>

                {/* Couches du groupe */}
                {expanded[group.id] && (
                  <div>
                    {group.layers.map((layer, idx) => {
                      const st = layerStates[layer.id] || { visible: layer.visible, opacity: layer.opacity }
                      return (
                        <div key={layer.id} className="px-3 py-2.5 space-y-1.5"
                             style={{
                               borderTop: idx > 0 ? DIVIDER : 'none',
                               background: st.visible ? 'rgba(255,255,255,0.03)' : 'transparent',
                             }}>

                          <div className="flex items-center gap-2">
                            {/* Dot couleur */}
                            <span className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-black/20"
                                  style={{ backgroundColor: layer.color }} />
                            {/* Nom */}
                            <span className="flex-1 text-xs truncate"
                                  style={{ color: st.visible ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)' }}>
                              {layer.name}
                            </span>
                            {/* Type badge */}
                            <span className="text-[9px] px-1 rounded shrink-0"
                                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)' }}>
                              {layer.type}
                            </span>
                            {/* Toggle visibilité */}
                            <button
                              onClick={() => toggleLayerVisibility(layer.id)}
                              className="p-1 rounded transition-colors shrink-0"
                              style={{ color: st.visible ? '#00AADD' : 'rgba(255,255,255,0.2)' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              title={st.visible ? 'Masquer' : 'Afficher'}
                            >
                              {st.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            </button>
                          </div>

                          {/* Légende WMS */}
                          {st.visible && layer.type === 'WMS' && (
                            <img src={getLegendUrl(layer.geoserverLayer)}
                                 alt={`Légende ${layer.name}`}
                                 className="h-4 ml-4 opacity-75"
                                 onError={e => { e.target.style.display = 'none' }} />
                          )}

                          {/* Slider opacité */}
                          {st.visible && (
                            <div className="flex items-center gap-2 ml-4">
                              <span className="text-[10px] w-10 shrink-0"
                                    style={{ color: 'rgba(255,255,255,0.3)' }}>Opacité</span>
                              <input
                                type="range" min="0.1" max="1" step="0.05"
                                value={st.opacity ?? 1}
                                onChange={e => setLayerOpacity(layer.id, parseFloat(e.target.value))}
                                className="flex-1 h-1"
                                style={{ accentColor: layer.color }}
                              />
                              <span className="text-[10px] w-7 text-right shrink-0"
                                    style={{ color: 'rgba(255,255,255,0.3)' }}>
                                {Math.round((st.opacity ?? 1) * 100)}%
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
