/**
 * SearchPanel
 * ===========
 * Recherche full-text dans les attributs des couches WFS + incidents Django.
 * Autocomplétion progressive : résultats affichés couche par couche dès réception.
 *
 * Sections :
 *   1. Recherche WFS (avec autocompletion)
 *   2. Géocodage adresse (Nominatim)
 *   3. Villes rapides
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Search, MapPin, Loader2, X, Navigation,
  AlertTriangle, Layers, ZoomIn, ChevronDown, ChevronUp,
} from 'lucide-react'
import { useMapStore }  from '../../store/mapStore'
import { useAppLayers } from '../../hooks/useGeoData'
import { searchWFS }    from '../../services/wfsSearch'
import { searchAPI }    from '../../services/api'
import toast from 'react-hot-toast'
import { useAppContext } from '../../context/AppContext'

const DEBOUNCE   = 400   // ms avant lancement de la recherche
const MIN_CHARS  = 2     // caractères minimum pour déclencher

// ── Nominatim ────────────────────────────────────────────────
async function geocodeNominatim(address) {
  const params = new URLSearchParams({
    q: address, format: 'json', limit: '5',
    countrycodes: 'cm', addressdetails: '1',
  })
  const resp = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { headers: { 'Accept-Language': 'fr' } }
  )
  if (!resp.ok) throw new Error('Nominatim error')
  return resp.json()
}

// ── Villes rapides ────────────────────────────────────────────
const QUICK_CITIES = [
  { label: 'Douala',      lat: 4.0511,  lng: 9.7679  },
  { label: 'Yaoundé',    lat: 3.848,   lng: 11.502  },
  { label: 'Bafoussam',  lat: 5.478,   lng: 10.417  },
  { label: 'Garoua',     lat: 9.301,   lng: 13.397  },
  { label: 'Maroua',     lat: 10.591,  lng: 14.316  },
  { label: 'Ngaoundéré', lat: 7.329,   lng: 13.584  },
]

// ── Styles communs ────────────────────────────────────────────
const IS = {
  base:  {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.9)',
    outline: 'none',
  },
  focus: {
    background: 'rgba(0,170,221,0.08)',
    border: '1px solid #00AADD',
  },
}

// ── Groupe de résultats d'une couche ─────────────────────────
function LayerResultGroup({ layerName, layerColor, results, mapInstance, onZoom }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="mb-2">
      {/* En-tête couche */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors"
        style={{ background: 'rgba(255,255,255,0.04)' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
      >
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: layerColor, boxShadow: `0 0 4px ${layerColor}80` }}
        />
        <span className="flex-1 text-[11px] font-semibold text-left truncate"
              style={{ color: 'rgba(255,255,255,0.75)' }}>
          {layerName}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
              style={{ background: `${layerColor}25`, color: layerColor }}>
          {results.length}
        </span>
        {expanded
          ? <ChevronUp   className="w-3 h-3 shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} />
          : <ChevronDown className="w-3 h-3 shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} />
        }
      </button>

      {/* Résultats */}
      {expanded && (
        <div className="mt-1 space-y-0.5 pl-1">
          {results.map(r => (
            <FeatureResult key={r.id} result={r} onZoom={onZoom} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Résultat individuel ───────────────────────────────────────
function FeatureResult({ result, onZoom }) {
  const [showAttrs, setShowAttrs] = useState(false)
  const hasCoords = result.lat != null && result.lng != null

  const visibleAttrs = Object.entries(result.properties || {})
    .filter(([k, v]) => !['geom','geometry','wkb_geometry','the_geom'].includes(k) && v != null && v !== '')
    .slice(0, 6)

  return (
    <div
      className="rounded-lg overflow-hidden transition-colors"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Ligne principale */}
      <div className="flex items-center gap-2 px-2.5 py-2">
        {/* Loupe zoom */}
        <button
          onClick={() => hasCoords && onZoom(result)}
          disabled={!hasCoords}
          title={hasCoords ? 'Zoomer sur cette entité' : 'Coordonnées indisponibles'}
          className="p-1 rounded transition-colors shrink-0"
          style={{
            color: hasCoords ? result.layerColor : 'rgba(255,255,255,0.2)',
            cursor: hasCoords ? 'pointer' : 'not-allowed',
          }}
          onMouseEnter={e => hasCoords && (e.currentTarget.style.background = `${result.layerColor}20`)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        {/* Texte */}
        <div className="flex-1 overflow-hidden">
          <p className="text-xs font-medium truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>
            {result.label}
          </p>
          {result.sublabel && (
            <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {result.sublabel}
            </p>
          )}
        </div>

        {/* Toggle attributs */}
        {visibleAttrs.length > 0 && (
          <button
            onClick={() => setShowAttrs(v => !v)}
            className="p-1 rounded transition-colors shrink-0"
            style={{ color: 'rgba(255,255,255,0.25)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}
            title="Voir les attributs"
          >
            {showAttrs
              ? <ChevronUp   className="w-3 h-3" />
              : <ChevronDown className="w-3 h-3" />
            }
          </button>
        )}
      </div>

      {/* Attributs dépliables */}
      {showAttrs && visibleAttrs.length > 0 && (
        <div
          className="px-2.5 pb-2 pt-1 space-y-0.5"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          {visibleAttrs.map(([k, v]) => (
            <div key={k} className="flex gap-2 text-[10px]">
              <span className="shrink-0 capitalize" style={{ color: 'rgba(255,255,255,0.35)', minWidth: '60px' }}>
                {k.replace(/_/g, ' ')}
              </span>
              <span className="truncate font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {String(v)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Résultat incident (depuis Django) ────────────────────────
function IncidentResult({ result, onZoom }) {
  const hasCoords = result.lat != null && result.lng != null
  return (
    <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors"
         style={{ background: 'rgba(255,71,87,0.06)', border: '1px solid rgba(255,71,87,0.15)' }}>
      <button
        onClick={() => hasCoords && onZoom(result)}
        disabled={!hasCoords}
        title="Zoomer"
        className="p-1 rounded shrink-0"
        style={{ color: hasCoords ? '#FF4757' : 'rgba(255,255,255,0.2)', cursor: hasCoords ? 'pointer' : 'not-allowed' }}
        onMouseEnter={e => hasCoords && (e.currentTarget.style.background = 'rgba(255,71,87,0.15)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <ZoomIn className="w-3.5 h-3.5" />
      </button>
      <div className="flex-1 overflow-hidden">
        <p className="text-xs font-medium truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>
          {result.label}
        </p>
        <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {result.sublabel}
        </p>
      </div>
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: '#FF4757' }} />
    </div>
  )
}

// ── Panel principal ───────────────────────────────────────────
export default function SearchPanel() {
  const { appSlug } = useAppContext()
  const { mapInstance } = useMapStore()
  const { layerGroups } = useAppLayers(appSlug)

  // Couches WFS actives
  const wfsLayers = layerGroups
    .flatMap(g => g.layers)
    .filter(l => l.type === 'WFS' && l.geoserverLayer)

  // ── État recherche WFS ────────────────────────────────────
  const [query,        setQuery]        = useState('')
  const [wfsResults,   setWfsResults]   = useState([])  // [{layerName, layerColor, results}]
  const [djangoResults,setDjangoResults]= useState([])
  const [searching,    setSearching]    = useState(false)
  const [searchDone,   setSearchDone]   = useState(false)
  const [layersDone,   setLayersDone]   = useState(0)   // nb couches ayant répondu
  const abortRef  = useRef(null)
  const debounceRef = useRef(null)

  // ── État géocodage ────────────────────────────────────────
  const [geoQuery,   setGeoQuery]   = useState('')
  const [geoResults, setGeoResults] = useState([])
  const [geocoding,  setGeocoding]  = useState(false)

  // ── Lancer la recherche ───────────────────────────────────
  const runSearch = useCallback((q) => {
    // Annuler recherche précédente
    if (abortRef.current) abortRef.current()
    setWfsResults([])
    setDjangoResults([])
    setSearchDone(false)
    setLayersDone(0)

    if (q.trim().length < MIN_CHARS) {
      setSearching(false)
      return
    }

    setSearching(true)
    let wfsDone = false, djangoDone = false

    const checkDone = () => {
      if (wfsDone && djangoDone) {
        setSearching(false)
        setSearchDone(true)
      }
    }

    // ── Recherche WFS (GeoServer) ─────────────────────────
    abortRef.current = searchWFS(
      q,
      wfsLayers,
      // onResult : appelé par couche dès qu'elle répond
      (results, layerName) => {
        const layer = wfsLayers.find(l => l.name === layerName)
        setWfsResults(prev => {
          const exists = prev.find(g => g.layerName === layerName)
          if (exists) return prev   // ne pas dupliquer
          return [...prev, {
            layerName,
            layerColor: layer?.color || '#00AADD',
            results,
          }]
        })
        setLayersDone(n => n + 1)
      },
      // onDone : toutes les couches WFS ont répondu
      () => {
        wfsDone = true
        checkDone()
      }
    )

    // ── Recherche Django (incidents, annotations) ─────────
    searchAPI.global(q)
      .then(({ data }) => {
        setDjangoResults(data.results || [])
      })
      .catch(() => {})
      .finally(() => {
        djangoDone = true
        checkDone()
      })

  }, [wfsLayers])

  // ── Debounce sur la frappe ────────────────────────────────
  const handleQueryChange = (e) => {
    const val = e.target.value
    setQuery(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(val), DEBOUNCE)
  }

  const handleClear = () => {
    setQuery('')
    setWfsResults([])
    setDjangoResults([])
    setSearchDone(false)
    setSearching(false)
    if (abortRef.current) abortRef.current()
  }

  // Nettoyer à la destruction
  useEffect(() => () => {
    if (abortRef.current) abortRef.current()
    clearTimeout(debounceRef.current)
  }, [])

  // ── Zoom sur une entité ───────────────────────────────────
  const handleZoom = (result) => {
    if (!mapInstance || result.lat == null) return
    mapInstance.flyTo([result.lat, result.lng], 17, { duration: 1.2 })
  }

  // ── Totaux ────────────────────────────────────────────────
  const totalWFS     = wfsResults.reduce((s, g) => s + g.results.length, 0)
  const totalDjango  = djangoResults.length
  const totalResults = totalWFS + totalDjango
  const hasResults   = totalResults > 0

  // ── Géocodage ─────────────────────────────────────────────
  const handleGeocode = async (e) => {
    e.preventDefault()
    if (!geoQuery.trim()) return
    setGeocoding(true)
    setGeoResults([])
    try {
      const data = await geocodeNominatim(geoQuery.trim())
      if (data.length === 0) { toast.error('Adresse non trouvée'); return }
      if (data.length === 1) {
        flyToAddress(data[0])
      } else {
        setGeoResults(data)
      }
    } catch {
      toast.error('Service de géocodage indisponible')
    } finally {
      setGeocoding(false)
    }
  }

  const flyToAddress = (place) => {
    mapInstance?.flyTo([parseFloat(place.lat), parseFloat(place.lon)], 15, { duration: 1.2 })
    setGeoResults([])
    setGeoQuery('')
    toast.success(place.display_name.split(',')[0])
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto"
         style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
      <div className="p-3 space-y-5">

        {/* ══ 1. RECHERCHE WFS ══════════════════════════════ */}
        <section>
          <p className="text-[10px] font-bold uppercase tracking-widest px-0.5 mb-2
                         flex items-center gap-1.5"
             style={{ color: 'rgba(255,255,255,0.35)' }}>
            <Search className="w-3 h-3" />
            Recherche dans les couches
            {wfsLayers.length > 0 && (
              <span className="ml-auto font-normal normal-case tracking-normal"
                    style={{ color: 'rgba(255,255,255,0.25)' }}>
                {wfsLayers.length} couche{wfsLayers.length > 1 ? 's' : ''}
              </span>
            )}
          </p>

          {/* Champ de saisie */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                    style={{ color: 'rgba(255,255,255,0.3)' }} />
            <input
              type="text"
              value={query}
              onChange={handleQueryChange}
              placeholder={`Rechercher… (min. ${MIN_CHARS} car.)`}
              className="w-full pl-9 pr-8 py-2 text-xs rounded-lg transition-colors outline-none"
              style={IS.base}
              onFocus={e => Object.assign(e.target.style, IS.focus)}
              onBlur={e => Object.assign(e.target.style, IS.base)}
            />
            {/* Indicateur de progression */}
            {searching && (
              <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin"
                       style={{ color: '#00AADD' }} />
            )}
            {!searching && query && (
              <button onClick={handleClear}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2"
                      style={{ color: 'rgba(255,255,255,0.35)' }}>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Indicateur couches en cours */}
          {searching && query.length >= MIN_CHARS && (
            <p className="text-[10px] mt-1.5 flex items-center gap-1.5"
               style={{ color: 'rgba(255,255,255,0.3)' }}>
              <Loader2 className="w-3 h-3 animate-spin" />
              Interrogation des couches…
              {layersDone > 0 && (
                <span style={{ color: '#00AADD' }}>
                  {layersDone} / {wfsLayers.length} répondu{layersDone > 1 ? 's' : ''}
                </span>
              )}
            </p>
          )}

          {/* Résumé résultats */}
          {(hasResults || searchDone) && query.length >= MIN_CHARS && (
            <p className="text-[10px] mt-1.5 px-0.5"
               style={{ color: hasResults ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.25)' }}>
              {hasResults
                ? `${totalResults} résultat${totalResults > 1 ? 's' : ''} — ${totalWFS} SIG, ${totalDjango} données`
                : 'Aucune correspondance trouvée'
              }
            </p>
          )}

          {/* ── Incidents Django ────────────────────────── */}
          {djangoResults.filter(r => r.type === 'incident').length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] font-semibold px-0.5 mb-1 flex items-center gap-1.5"
                 style={{ color: '#FF4757' }}>
                <AlertTriangle className="w-3 h-3" />
                Incidents ({djangoResults.filter(r => r.type === 'incident').length})
              </p>
              <div className="space-y-1">
                {djangoResults
                  .filter(r => r.type === 'incident')
                  .map(r => (
                    <IncidentResult key={r.id} result={r} onZoom={handleZoom} />
                  ))}
              </div>
            </div>
          )}

          {/* ── Résultats WFS par couche ────────────────── */}
          {wfsResults.length > 0 && (
            <div className="mt-2">
              {wfsResults.map(group => (
                <LayerResultGroup
                  key={group.layerName}
                  layerName={group.layerName}
                  layerColor={group.layerColor}
                  results={group.results}
                  mapInstance={mapInstance}
                  onZoom={handleZoom}
                />
              ))}
            </div>
          )}
        </section>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} />

        {/* ══ 2. GÉOCODAGE ══════════════════════════════════ */}
        <section>
          <p className="text-[10px] font-bold uppercase tracking-widest px-0.5 mb-2
                         flex items-center gap-1.5"
             style={{ color: 'rgba(255,255,255,0.35)' }}>
            <Navigation className="w-3 h-3" /> Aller à une adresse
          </p>

          <form onSubmit={handleGeocode} className="flex gap-2">
            <input
              value={geoQuery}
              onChange={e => { setGeoQuery(e.target.value); setGeoResults([]) }}
              placeholder="Ex : Akwa, Douala"
              className="flex-1 text-xs px-3 py-2 rounded-lg outline-none transition-colors"
              style={IS.base}
              onFocus={e => Object.assign(e.target.style, IS.focus)}
              onBlur={e => Object.assign(e.target.style, IS.base)}
            />
            <button type="submit" disabled={geocoding || !geoQuery.trim()}
                    className="px-3 py-2 rounded-lg shrink-0 transition-colors"
                    style={{ background: '#10B981', color: '#fff', opacity: geoQuery.trim() ? 1 : 0.5 }}>
              {geocoding
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Navigation className="w-3.5 h-3.5" />
              }
            </button>
          </form>

          {geoResults.length > 0 && (
            <div className="mt-2 space-y-1">
              {geoResults.map((place, i) => (
                <button key={i} onClick={() => flyToAddress(place)}
                        className="w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors"
                        style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.12)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(16,185,129,0.06)'}>
                  <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: '#10B981' }} />
                  <div className="overflow-hidden">
                    <p className="text-xs font-medium truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>
                      {place.display_name.split(',').slice(0, 2).join(', ')}
                    </p>
                    <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {place.display_name.split(',').slice(2, 4).join(', ')}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} />

        {/* ══ 3. VILLES RAPIDES ═════════════════════════════ */}
        <section>
          <p className="text-[10px] font-bold uppercase tracking-widest px-0.5 mb-2"
             style={{ color: 'rgba(255,255,255,0.35)' }}>
            Centres urbains
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {QUICK_CITIES.map(city => (
              <button key={city.label}
                      onClick={() => mapInstance?.flyTo([city.lat, city.lng], 12, { duration: 1 })}
                      className="text-xs py-1.5 px-2.5 rounded-lg transition-colors text-left
                                 flex items-center gap-1.5"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: 'rgba(255,255,255,0.6)',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,170,221,0.1)'; e.currentTarget.style.color = '#00AADD' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}>
                <MapPin className="w-3 h-3 shrink-0" />
                {city.label}
              </button>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
