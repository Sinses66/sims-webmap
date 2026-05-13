import { useState, useEffect, useRef, useCallback } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  ChevronLeft, ChevronRight,
  ZoomIn, ZoomOut, Home, Navigation,
  Ruler, Square, Trash2,
  MapPin, Minus, Hexagon, Type, FileUp, Eraser,
  Crop, Pentagon, Filter, XCircle,
  Printer,
  FlaskConical,
} from 'lucide-react'
import { useMapStore } from '../../../store/mapStore'
import { MAP_CENTER, MAP_ZOOM } from '../../../config/constants'
import toast from 'react-hot-toast'

// ── Groupes d'outils ──────────────────────────────────────────
const TOOL_GROUPS = [
  {
    id: 'navigation',
    label: 'Navigation',
    tools: [
      { id: 'zoom-in',   icon: ZoomIn,     label: 'Zoom +'        },
      { id: 'zoom-out',  icon: ZoomOut,    label: 'Zoom −'        },
      { id: 'home',      icon: Home,       label: 'Vue initiale'  },
      { id: 'geolocate', icon: Navigation, label: 'Ma position'   },
    ],
  },
  {
    id: 'mesures',
    label: 'Mesures',
    tools: [
      { id: 'measure-distance', icon: Ruler,   label: 'Mesure distance' },
      { id: 'measure-area',     icon: Square,  label: 'Mesure surface'  },
      { id: 'clear-measure',    icon: Trash2,  label: 'Effacer mesures', danger: true },
    ],
  },
  {
    id: 'dessin',
    label: 'Dessin',
    tools: [
      { id: 'draw-point',   icon: MapPin,   label: 'Point'       },
      { id: 'draw-line',    icon: Minus,    label: 'Ligne'       },
      { id: 'draw-polygon', icon: Hexagon,  label: 'Polygone'    },
      { id: 'draw-text',    icon: Type,     label: 'Annotation'  },
      { id: 'import-file',  icon: FileUp,   label: 'Importer fichier' },
      { id: 'clear-drawn',  icon: Eraser,   label: 'Effacer dessins', danger: true },
    ],
  },
  {
    id: 'interrogation',
    label: 'Filtres & Analyse',
    tools: [
      { id: 'select-rect',    icon: Crop,          label: 'Sélection rectangle'  },
      { id: 'select-poly',    icon: Pentagon,      label: 'Sélection polygone'   },
      { id: 'attr-query',     icon: Filter,        label: 'Filtre attributaire'  },
      { id: 'clear-select',   icon: XCircle,       label: 'Effacer sélection', danger: true },
      { id: 'analyse-panel',  icon: FlaskConical,  label: 'Analyse spatiale'     },
    ],
  },
  {
    id: 'impression',
    label: 'Impression & Export',
    tools: [
      { id: 'export-panel', icon: Printer, label: 'Impression & Export' },
    ],
  },
]

export default function MapToolbar() {
  const map = useMap()
  const { drawMode, setDrawMode, signalClearDrawings, signalClearMeasure, clearSelectionResults } = useMapStore()
  const [isOpen,      setIsOpen]      = useState(false)
  const [tooltipInfo, setTooltipInfo] = useState(null)  // { label, top, right }
  const [locating,    setLocating]    = useState(false)
  // Groupes ouverts par défaut : navigation + mesures
  const [openGroups,  setOpenGroups]  = useState({ navigation: true, mesures: true, dessin: false, interrogation: false, impression: false })

  const toggleGroup = (id) => setOpenGroups(s => ({ ...s, [id]: !s[id] }))

  // Référence à l'input file caché pour l'import
  const fileInputRef = useRef(null)

  // ── Actions des outils ─────────────────────────────────────
  const handleTool = useCallback((toolId) => {
    switch (toolId) {
      case 'zoom-in':          map.zoomIn();                                                    break
      case 'zoom-out':         map.zoomOut();                                                   break
      case 'home':             map.flyTo(MAP_CENTER, MAP_ZOOM, { duration: 1.2 });              break
      case 'geolocate':        setLocating(true); map.locate({ setView: true, maxZoom: 16 });  break
      case 'measure-distance': setDrawMode(drawMode === 'measure_distance' ? null : 'measure_distance'); break
      case 'measure-area':     setDrawMode(drawMode === 'measure_area'     ? null : 'measure_area');     break
      case 'clear-measure':    signalClearMeasure(); setDrawMode(null);                          break
      case 'draw-point':       setDrawMode(drawMode === 'draw_point'   ? null : 'draw_point');   break
      case 'draw-line':        setDrawMode(drawMode === 'draw_line'    ? null : 'draw_line');    break
      case 'draw-polygon':     setDrawMode(drawMode === 'draw_polygon' ? null : 'draw_polygon'); break
      case 'draw-text':        setDrawMode(drawMode === 'draw_text'    ? null : 'draw_text');    break
      case 'import-file':      fileInputRef.current?.click();                                   break
      case 'clear-drawn':      signalClearDrawings();                                                  break
      case 'select-rect':      setDrawMode(drawMode === 'select_rect' ? null : 'select_rect');         break
      case 'select-poly':      setDrawMode(drawMode === 'select_poly' ? null : 'select_poly');         break
      case 'attr-query':       setDrawMode('attr_query');                                               break
      case 'clear-select':     clearSelectionResults();                                                break
      case 'export-panel':   setDrawMode(drawMode === 'export_panel'    ? null : 'export_panel');    break
      case 'analyse-panel': setDrawMode(drawMode === 'analysis_panel' ? null : 'analysis_panel'); break
    }
  }, [map, drawMode, setDrawMode, signalClearDrawings, signalClearMeasure])

  // ── Géolocalisation ────────────────────────────────────────
  useEffect(() => {
    const onFound = (e) => {
      setLocating(false)
      L.circle(e.latlng, {
        radius: e.accuracy / 2, color: '#f59e0b',
        fillColor: '#f59e0b', fillOpacity: 0.12, weight: 2,
      }).addTo(map)
      L.circleMarker(e.latlng, {
        radius: 7, fillColor: '#f59e0b', color: '#fff', weight: 2, fillOpacity: 1,
      }).addTo(map)
      toast.success(`Position trouvée — précision ±${Math.round(e.accuracy)} m`)
    }
    const onError = () => { setLocating(false); toast.error('Géolocalisation impossible') }
    map.on('locationfound', onFound)
    map.on('locationerror', onError)
    return () => { map.off('locationfound', onFound); map.off('locationerror', onError) }
  }, [map])

  // ── Import GeoJSON / KML ───────────────────────────────────
  const handleFileImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const geojson = JSON.parse(ev.target.result)
        const layer = L.geoJSON(geojson, {
          style:       { color: '#6366f1', weight: 2, fillOpacity: 0.15 },
          pointToLayer: (_, latlng) => L.circleMarker(latlng, {
            radius: 6, fillColor: '#6366f1', color: '#fff', weight: 2, fillOpacity: 1,
          }),
        }).addTo(map)
        map.fitBounds(layer.getBounds(), { padding: [30, 30] })
        toast.success(`Fichier importé — ${geojson.features?.length ?? '?'} entité(s)`)
      } catch {
        toast.error('Fichier invalide (GeoJSON attendu)')
      }
    }
    reader.readAsText(file)
    e.target.value = ''   // reset pour permettre re-import du même fichier
  }

  // ── État actif d'un outil ──────────────────────────────────
  const isActive = (toolId) => {
    if (toolId === 'measure-distance') return drawMode === 'measure_distance'
    if (toolId === 'measure-area')     return drawMode === 'measure_area'
    if (toolId === 'draw-point')       return drawMode === 'draw_point'
    if (toolId === 'draw-line')        return drawMode === 'draw_line'
    if (toolId === 'draw-polygon')     return drawMode === 'draw_polygon'
    if (toolId === 'draw-text')        return drawMode === 'draw_text'
    if (toolId === 'select-rect')      return drawMode === 'select_rect'
    if (toolId === 'select-poly')      return drawMode === 'select_poly'
    if (toolId === 'attr-query')       return drawMode === 'attr_query'
    if (toolId === 'export-panel')  return drawMode === 'export_panel'
    if (toolId === 'analyse-panel') return drawMode === 'analysis_panel'
    if (toolId === 'geolocate')     return locating
    return false
  }

  const showTooltip = (e, label) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltipInfo({
      label,
      top:   rect.top + rect.height / 2,
      right: window.innerWidth - rect.left + 10,
    })
  }
  const hideTooltip = () => setTooltipInfo(null)

  // Couleur de l'outil actif selon le groupe
  const activeColor = () => {
    if (['measure_distance', 'measure_area'].includes(drawMode)) return '#8b5cf6'
    if (['draw_point', 'draw_line', 'draw_polygon', 'draw_text'].includes(drawMode)) return '#f59e0b'
    if (drawMode === 'analysis_panel') return '#10b981'
    return '#8b5cf6'
  }

  const hasActiveTool = !!drawMode

  // ── Bannière outil actif ───────────────────────────────────
  const toolBanner = {
    measure_distance: '📏 Tracez une ligne — double-clic pour terminer — Échap pour annuler',
    measure_area:     '📐 Tracez un polygone — double-clic pour terminer — Échap pour annuler',
    draw_point:       '📍 Cliquez pour placer un point',
    draw_line:        '✏️ Cliquez pour tracer une ligne — double-clic pour finir',
    draw_polygon:     '⬡ Cliquez pour dessiner un polygone — double-clic pour finir',
    draw_text:        '✍️ Cliquez sur la carte pour placer une annotation',
    select_rect:      '⬚ Maintenez et glissez pour sélectionner par rectangle',
    select_poly:      '⬡ Cliquez pour délimiter — double-clic pour interroger',
    attr_query:       '🔍 Panneau de filtre ouvert en bas de la carte',
    export_panel:     '🖨️ Choisissez un format d\'export dans le panneau',
    analysis_panel:   '🔬 Panneau d\'analyse spatiale ouvert',
  }

  return (
    <>
      {/* ── Bannière outil actif — haut centré ─────────────────── */}
      {hasActiveTool && toolBanner[drawMode] && (
        <div style={{
          position: 'fixed',
          top: 52,
          left: '50%',
          transform: 'translateX(-50%)',
          background: `${activeColor()}ee`,
          color: '#fff',
          padding: '7px 16px',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 500,
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
          pointerEvents: 'auto',
          zIndex: 9998,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          {toolBanner[drawMode]}
          <button onClick={() => setDrawMode(null)} style={{
            background: 'rgba(255,255,255,0.2)', border: 'none',
            color: '#fff', cursor: 'pointer', padding: '1px 6px',
            borderRadius: 4, fontSize: 12, lineHeight: 1,
          }}>✕</button>
        </div>
      )}

      {/* ── Tooltip global (position fixed, échappe overflow) ── */}
      {tooltipInfo && (
        <div style={{
          position: 'fixed',
          top:       tooltipInfo.top,
          right:     tooltipInfo.right,
          transform: 'translateY(-50%)',
          background: 'rgba(15,23,42,0.97)',
          color: '#e2e8f0',
          padding: '4px 10px',
          borderRadius: 5,
          fontSize: 12,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
          border: '1px solid rgba(255,255,255,0.1)',
          zIndex: 9999,
        }}>
          {tooltipInfo.label}
        </div>
      )}

      {/* Input fichier caché */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".geojson,.json,.kml"
        style={{ display: 'none' }}
        onChange={handleFileImport}
      />

      <div style={{
        position: 'absolute',
        right: 0,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        pointerEvents: 'none',
      }}>

        {/* ── Bannière outil actif (haut centré, position fixed) ── */}

        {/* ── Panneau vertical ─────────────────────────────── */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(15,23,42,0.92)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRight: 'none',
          borderRadius: '8px 0 0 8px',
          padding: isOpen ? '6px 5px' : 0,
          maxWidth: isOpen ? 46 : 0,
          maxHeight: '85vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          opacity: isOpen ? 1 : 0,
          transition: 'max-width 0.28s ease, opacity 0.22s ease, padding 0.28s ease',
          pointerEvents: isOpen ? 'auto' : 'none',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.15) transparent',
        }}>
          {TOOL_GROUPS.map((group, gi) => {
            const isGroupOpen = openGroups[group.id]
            // Couleur de l'indicateur de groupe selon s'il a un outil actif
            const groupHasActive = group.tools.some(t => isActive(t.id))

            return (
              <div key={group.id}>
                {/* Séparateur entre groupes */}
                {gi > 0 && (
                  <div style={{
                    height: 2,
                    background: 'rgba(255,255,255,0.18)',
                    margin: '4px 3px',
                    borderRadius: 1,
                  }} />
                )}

                {/* En-tête de groupe cliquable */}
                <button
                  onClick={() => toggleGroup(group.id)}
                  onMouseEnter={(e) => showTooltip(e, isGroupOpen ? `Replier ${group.label}` : group.label)}
                  onMouseLeave={hideTooltip}
                  style={{
                    width: 34, height: 18,
                    borderRadius: 4,
                    border: 'none',
                    background: groupHasActive
                      ? 'rgba(139,92,246,0.2)'
                      : isGroupOpen
                        ? 'rgba(255,255,255,0.06)'
                        : 'transparent',
                    color: groupHasActive
                      ? '#a78bfa'
                      : 'rgba(148,163,184,0.6)',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9,
                    letterSpacing: 0.5,
                    fontWeight: 700,
                    margin: '2px 0',
                    transition: 'all 0.15s',
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                  onMouseOut={e  => e.currentTarget.style.background = groupHasActive
                    ? 'rgba(139,92,246,0.2)' : isGroupOpen ? 'rgba(255,255,255,0.06)' : 'transparent'}
                >
                  {isGroupOpen ? '▲' : '▼'}
                </button>

                {/* Outils du groupe (masqués si replié) */}
                {isGroupOpen && group.tools.map((tool) => {
                  const Icon   = tool.icon
                  const active = isActive(tool.id)

                  return (
                    <div key={tool.id} style={{ position: 'relative', marginBottom: 2 }}>
                      <button
                        onClick={() => handleTool(tool.id)}
                        onMouseEnter={(e) => showTooltip(e, tool.label)}
                        onMouseLeave={hideTooltip}
                        style={{
                          width: 34, height: 32,
                          borderRadius: 6,
                          border: 'none',
                          background: active
                            ? (tool.id.startsWith('draw') ? '#f59e0b'
                              : tool.id.startsWith('select') || tool.id === 'attr-query' ? '#6366f1'
                              : '#8b5cf6')
                            : 'transparent',
                          color: active
                            ? '#fff'
                            : tool.danger
                              ? '#f87171'
                              : 'rgba(203,213,225,0.85)',
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'background 0.15s, color 0.15s',
                        }}
                        onMouseOver={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.09)' }}
                        onMouseOut={e  => { if (!active) e.currentTarget.style.background = 'transparent' }}
                      >
                        <Icon size={15} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* ── Bouton toggle ─────────────────────────────────── */}
        <button
          onClick={() => setIsOpen(o => !o)}
          style={{
            width: 22,
            height: 64,
            borderRadius: isOpen ? '0 6px 6px 0' : '6px 0 0 6px',
            border: 'none',
            background: 'rgba(15,23,42,0.92)',
            backdropFilter: 'blur(8px)',
            color: hasActiveTool ? activeColor() : 'rgba(203,213,225,0.85)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '-2px 0 8px rgba(0,0,0,0.2)',
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            pointerEvents: 'auto',
            transition: 'color 0.2s, background 0.15s',
          }}
          onMouseOver={e => e.currentTarget.style.background = 'rgba(30,40,60,0.97)'}
          onMouseOut={e  => e.currentTarget.style.background = 'rgba(15,23,42,0.92)'}
        >
          {isOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </>
  )
}
