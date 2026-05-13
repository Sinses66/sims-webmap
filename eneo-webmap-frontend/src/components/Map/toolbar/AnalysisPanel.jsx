import { useState, useMemo, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { X, ChevronLeft, Loader2 } from 'lucide-react'
import * as turf from '@turf/turf'
import L from 'leaflet'
import { useMapStore } from '../../../store/mapStore'
import { useAppLayers } from '../../../hooks/useGeoData'
import { WFS_URL, GEOSERVER_WORKSPACE } from '../../../config/constants'
import toast from 'react-hot-toast'
import { useAppContext } from '../../../context/AppContext'

const GEO_FIELDS = new Set(['geom','geometry','wkb_geometry','the_geom','shape'])

// ── Utilitaires ───────────────────────────────────────────────

async function fetchWFSData(queryClient, layer) {
  const cached = queryClient.getQueryData(['wfs', layer.geoserverLayer, {}])
  if (cached?.features) return cached
  const url = `${WFS_URL}?service=WFS&version=1.1.0&request=GetFeature` +
    `&typeName=${GEOSERVER_WORKSPACE}:${layer.geoserverLayer}&outputFormat=application/json`
  const r = await fetch(url, { credentials: 'include' })
  if (!r.ok) throw new Error(`WFS error ${r.status}`)
  return r.json()
}

function fmtNum(n) {
  if (n === null || n === undefined || isNaN(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e6)  return (n / 1e6).toFixed(2)  + ' M'
  if (abs >= 1000) return (n / 1000).toFixed(2) + ' k'
  return Number.isInteger(n) ? String(n) : n.toFixed(3)
}

// ═══════════════════════════════════════════════════════════════
// COMPOSANT
// ═══════════════════════════════════════════════════════════════
export default function AnalysisPanel() {
  const { appSlug } = useAppContext()
  const queryClient = useQueryClient()
  const { drawMode, setDrawMode, mapInstance, setSelectionResults } = useMapStore()
  const { layerGroups } = useAppLayers(appSlug)

  // ── Navigation ────────────────────────────────────────────────
  const [subTool, setSubTool] = useState(null)   // null | 'buffer' | 'intersect' | 'stats'

  // ── Buffer state ──────────────────────────────────────────────
  const [bufLayer,       setBufLayer]       = useState('')
  const [bufRadius,      setBufRadius]      = useState(500)
  const [bufUnit,        setBufUnit]        = useState('meters')
  const [bufTargetLayer, setBufTargetLayer] = useState('')
  const [bufLoading,     setBufLoading]     = useState(false)

  // ── Intersection state ────────────────────────────────────────
  const [intLayerA,  setIntLayerA]  = useState('')
  const [intLayerB,  setIntLayerB]  = useState('')
  const [intLoading, setIntLoading] = useState(false)

  // ── Stats state ───────────────────────────────────────────────
  const [statsLayer,   setStatsLayer]   = useState('')
  const [statsField,   setStatsField]   = useState('')
  const [statsResults, setStatsResults] = useState(null)
  const [statsLoading, setStatsLoading] = useState(false)

  // ── Couches d'analyse sur la carte (buffer) ───────────────────
  const analysisLayersRef = useRef([])

  // ── Listes de couches ─────────────────────────────────────────
  const allLayers = layerGroups.flatMap(g => g.layers)
  const wfsLayers = allLayers.filter(l => l.type !== 'WMS')

  // ── Champs pour les stats (AVANT tout return conditionnel) ─────
  const statsFields = useMemo(() => {
    if (!statsLayer) return []
    const layer  = wfsLayers.find(l => l.id === statsLayer)
    if (!layer) return []
    const cached = queryClient.getQueryData(['wfs', layer.geoserverLayer, {}])
    const first  = cached?.features?.[0]
    if (!first?.properties) return []
    return Object.keys(first.properties).filter(k => !GEO_FIELDS.has(k))
  }, [statsLayer, wfsLayers, queryClient])

  if (drawMode !== 'analysis_panel') return null

  // ── Actions helpers ───────────────────────────────────────────
  const closePanel = () => { setDrawMode(null); setSubTool(null) }
  const goBack     = () => { setSubTool(null); setStatsResults(null) }

  const clearAnalysisLayers = () => {
    if (!mapInstance) return
    analysisLayersRef.current.forEach(l => { try { mapInstance.removeLayer(l) } catch (_) {} })
    analysisLayersRef.current = []
    toast('Couches d\'analyse effacées', { icon: '🗑️' })
  }

  // ══════════════════════════════════════════════════════════════
  // A. ZONE TAMPON
  // ══════════════════════════════════════════════════════════════
  const runBuffer = async () => {
    if (!bufLayer)   { toast.error('Sélectionnez une couche source'); return }
    if (!mapInstance){ toast.error('Carte non disponible'); return }
    if (bufRadius <= 0){ toast.error('Le rayon doit être > 0'); return }

    const layer = wfsLayers.find(l => l.id === bufLayer)
    if (!layer) return
    setBufLoading(true)
    const toastId = toast.loading('Calcul du tampon…')

    try {
      const fc = await fetchWFSData(queryClient, layer)
      if (!fc?.features?.length) throw new Error('Aucune donnée pour cette couche')

      // Turf buffer sur le FeatureCollection complet
      const buffered = turf.buffer(fc, bufRadius, { units: bufUnit })
      if (!buffered?.features?.length) throw new Error('Résultat tampon vide')

      // Supprime les couches d'analyse précédentes
      analysisLayersRef.current.forEach(l => { try { mapInstance.removeLayer(l) } catch (_) {} })
      analysisLayersRef.current = []

      // Affiche le tampon sur la carte
      const bufLeaflet = L.geoJSON(buffered, {
        pane: 'overlayPane',
        style: {
          color:       '#f59e0b',
          fillColor:   '#f59e0b',
          fillOpacity: 0.15,
          weight:      2,
          dashArray:   '7,5',
        },
      }).addTo(mapInstance)
      analysisLayersRef.current.push(bufLeaflet)

      try { mapInstance.fitBounds(bufLeaflet.getBounds(), { padding: [30,30] }) } catch(_) {}

      let msg = `Tampon de ${bufRadius} ${bufUnit === 'meters' ? 'm' : 'km'} créé`

      // Entités dans le tampon (couche cible)
      if (bufTargetLayer) {
        const targetObj = wfsLayers.find(l => l.id === bufTargetLayer)
        if (targetObj) {
          toast.loading('Sélection des entités dans le tampon…', { id: toastId })
          const targetFc = await fetchWFSData(queryClient, targetObj)

          if (targetFc?.features) {
            const inside = targetFc.features.filter(f => {
              if (!f.geometry) return false
              try {
                return buffered.features.some(bf => turf.booleanIntersects(bf, f))
              } catch { return false }
            })

            setSelectionResults(inside.map(f => ({
              feature:   f,
              layerId:   targetObj.id,
              layerName: targetObj.name,
            })))

            msg += ` — ${inside.length} entité(s) dans le tampon`
            if (inside.length > 0) setDrawMode(null)
          }
        }
      }

      toast.success(msg, { id: toastId })

    } catch (err) {
      console.error('[Buffer]', err)
      toast.error(`Erreur : ${err.message}`, { id: toastId })
    } finally {
      setBufLoading(false)
    }
  }

  // ══════════════════════════════════════════════════════════════
  // B. INTERSECTION SPATIALE
  // ══════════════════════════════════════════════════════════════
  const runIntersect = async () => {
    if (!intLayerA || !intLayerB) { toast.error('Sélectionnez les deux couches'); return }
    if (intLayerA === intLayerB)  { toast.error('Les deux couches doivent être différentes'); return }

    setIntLoading(true)
    const toastId = toast.loading('Calcul de l\'intersection…')

    try {
      const layerA = wfsLayers.find(l => l.id === intLayerA)
      const layerB = wfsLayers.find(l => l.id === intLayerB)

      const [fcA, fcB] = await Promise.all([
        fetchWFSData(queryClient, layerA),
        fetchWFSData(queryClient, layerB),
      ])

      if (!fcA?.features || !fcB?.features) throw new Error('Données manquantes')

      toast.loading(`Test sur ${fcA.features.length} × ${fcB.features.length} entités…`, { id: toastId })

      const results = fcA.features.filter(fA => {
        if (!fA.geometry) return false
        return fcB.features.some(fB => {
          if (!fB.geometry) return false
          try { return turf.booleanIntersects(fA, fB) } catch { return false }
        })
      })

      setSelectionResults(results.map(f => ({
        feature:   f,
        layerId:   layerA.id,
        layerName: layerA.name,
      })))

      if (!results.length) {
        toast('Aucune intersection trouvée', { icon: 'ℹ️', id: toastId })
      } else {
        toast.success(
          `${results.length} entité(s) de "${layerA.name}" croisent "${layerB.name}"`,
          { id: toastId }
        )
        setDrawMode(null)
      }

    } catch (err) {
      console.error('[Intersect]', err)
      toast.error(`Erreur : ${err.message}`, { id: toastId })
    } finally {
      setIntLoading(false)
    }
  }

  // ══════════════════════════════════════════════════════════════
  // C. STATISTIQUES
  // ══════════════════════════════════════════════════════════════
  const runStats = async () => {
    if (!statsLayer || !statsField) { toast.error('Sélectionnez couche et champ'); return }
    const layer = wfsLayers.find(l => l.id === statsLayer)
    if (!layer) return

    setStatsLoading(true)
    const toastId = toast.loading('Calcul des statistiques…')

    try {
      const fc = await fetchWFSData(queryClient, layer)
      if (!fc?.features) throw new Error('Données non disponibles')

      const values = fc.features
        .map(f => parseFloat(f.properties?.[statsField]))
        .filter(v => !isNaN(v))

      if (!values.length) throw new Error('Aucune valeur numérique valide pour ce champ')

      const sorted = [...values].sort((a, b) => a - b)
      const sum    = values.reduce((s, v) => s + v, 0)
      const avg    = sum / values.length
      const mid    = Math.floor(sorted.length / 2)
      const median = sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2

      // Distribution en quartiles
      const q1 = sorted[Math.floor(sorted.length * 0.25)]
      const q3 = sorted[Math.floor(sorted.length * 0.75)]

      setStatsResults({
        layer: layer.name,
        field: statsField,
        total: fc.features.length,
        count: values.length,
        sum, avg, min: sorted[0], max: sorted[sorted.length - 1], median, q1, q3,
      })

      toast.success('Statistiques calculées', { id: toastId })

    } catch (err) {
      console.error('[Stats]', err)
      toast.error(`Erreur : ${err.message}`, { id: toastId })
    } finally {
      setStatsLoading(false)
    }
  }

  // ══════════════════════════════════════════════════════════════
  // UI
  // ══════════════════════════════════════════════════════════════

  const Header = ({ label, color = '#a5b4fc' }) => (
    <div style={{
      display:'flex', alignItems:'center', gap:8, padding:'10px 14px',
      borderBottom:'1px solid rgba(255,255,255,0.08)',
      background: subTool ? 'rgba(30,41,59,0.95)' : 'rgba(99,102,241,0.15)',
      position:'sticky', top:0, zIndex:1,
    }}>
      {subTool && (
        <button onClick={goBack} style={iconBtn}>
          <ChevronLeft size={16}/>
        </button>
      )}
      <span style={{ fontWeight:600, color, flex:1, fontSize:13 }}>{label}</span>
      <button onClick={closePanel} style={iconBtn}><X size={14}/></button>
    </div>
  )

  // ── Panneau principal ─────────────────────────────────────────
  if (!subTool) return (
    <div style={panelSt}>
      <Header label="Analyse spatiale"/>
      <div style={{ padding:14, display:'flex', flexDirection:'column', gap:10 }}>

        <button onClick={() => setSubTool('buffer')} style={cardSt}
          onMouseOver={e => e.currentTarget.style.background='rgba(245,158,11,0.1)'}
          onMouseOut={e  => e.currentTarget.style.background='rgba(30,41,59,0.5)'}
        >
          <div style={cardRow}>
            <div style={{ ...iconCircle, background:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.3)' }}>🎯</div>
            <div style={{ textAlign:'left' }}>
              <div style={cardTitle}>Zone tampon</div>
              <div style={cardDesc}>Créer un tampon autour d'une couche</div>
            </div>
          </div>
        </button>

        <button onClick={() => setSubTool('intersect')} style={cardSt}
          onMouseOver={e => e.currentTarget.style.background='rgba(99,102,241,0.1)'}
          onMouseOut={e  => e.currentTarget.style.background='rgba(30,41,59,0.5)'}
        >
          <div style={cardRow}>
            <div style={{ ...iconCircle, background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.3)' }}>✂️</div>
            <div style={{ textAlign:'left' }}>
              <div style={cardTitle}>Intersection spatiale</div>
              <div style={cardDesc}>Entités de A qui croisent celles de B</div>
            </div>
          </div>
        </button>

        <button onClick={() => setSubTool('stats')} style={cardSt}
          onMouseOver={e => e.currentTarget.style.background='rgba(16,185,129,0.1)'}
          onMouseOut={e  => e.currentTarget.style.background='rgba(30,41,59,0.5)'}
        >
          <div style={cardRow}>
            <div style={{ ...iconCircle, background:'rgba(16,185,129,0.15)', border:'1px solid rgba(16,185,129,0.3)' }}>📊</div>
            <div style={{ textAlign:'left' }}>
              <div style={cardTitle}>Statistiques</div>
              <div style={cardDesc}>Min, max, moyenne, somme sur un champ</div>
            </div>
          </div>
        </button>

        <button onClick={clearAnalysisLayers} style={{
          marginTop:4, padding:'6px 0', cursor:'pointer',
          background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)',
          borderRadius:6, color:'#f87171', fontSize:12,
        }}>
          🗑️ Effacer les couches d'analyse
        </button>
      </div>
    </div>
  )

  // ── Sous-outil : Buffer ───────────────────────────────────────
  if (subTool === 'buffer') return (
    <div style={panelSt}>
      <Header label="Zone tampon" color="#fcd34d"/>
      <div style={{ padding:14, display:'flex', flexDirection:'column', gap:12 }}>

        <div>
          <label style={lblSt}>Couche source</label>
          <select value={bufLayer} onChange={e => setBufLayer(e.target.value)} style={selSt}>
            <option value="">— Choisir une couche —</option>
            {wfsLayers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>

        <div style={{ display:'flex', gap:8 }}>
          <div style={{ flex:1 }}>
            <label style={lblSt}>Rayon</label>
            <input
              type="number" min={1} value={bufRadius}
              onChange={e => setBufRadius(Number(e.target.value))}
              style={inpSt}
            />
          </div>
          <div style={{ flex:'0 0 110px' }}>
            <label style={lblSt}>Unité</label>
            <select value={bufUnit} onChange={e => setBufUnit(e.target.value)} style={selSt}>
              <option value="meters">Mètres</option>
              <option value="kilometers">Kilomètres</option>
            </select>
          </div>
        </div>

        <div>
          <label style={lblSt}>
            Sélectionner les entités dans le tampon&nbsp;
            <span style={{ fontStyle:'italic', fontWeight:400 }}>(optionnel)</span>
          </label>
          <select value={bufTargetLayer} onChange={e => setBufTargetLayer(e.target.value)} style={selSt}>
            <option value="">— Aucune sélection —</option>
            {wfsLayers.filter(l => l.id !== bufLayer).map(l =>
              <option key={l.id} value={l.id}>{l.name}</option>
            )}
          </select>
        </div>

        <div style={divider}/>

        <button onClick={runBuffer} disabled={bufLoading} style={actBtn('#f59e0b', bufLoading)}>
          {bufLoading
            ? <><Loader2 size={14} style={spin}/> Calcul en cours…</>
            : '🎯 Créer le tampon'}
        </button>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  // ── Sous-outil : Intersection ─────────────────────────────────
  if (subTool === 'intersect') return (
    <div style={panelSt}>
      <Header label="Intersection spatiale" color="#a5b4fc"/>
      <div style={{ padding:14, display:'flex', flexDirection:'column', gap:12 }}>

        <div style={infoBx}>
          Retourne les entités de la <strong style={{ color:'#a5b4fc' }}>couche A</strong> qui croisent
          spatialement au moins une entité de la <strong style={{ color:'#6ee7b7' }}>couche B</strong>.
          Les résultats s'affichent dans le panneau de sélection.
        </div>

        <div>
          <label style={{ ...lblSt, color:'rgba(165,180,252,0.7)' }}>Couche A — entités à filtrer</label>
          <select value={intLayerA} onChange={e => setIntLayerA(e.target.value)}
            style={{ ...selSt, borderColor:'rgba(99,102,241,0.4)' }}>
            <option value="">— Choisir —</option>
            {wfsLayers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>

        <div>
          <label style={{ ...lblSt, color:'rgba(110,231,183,0.7)' }}>Couche B — zone d'intersection</label>
          <select value={intLayerB} onChange={e => setIntLayerB(e.target.value)}
            style={{ ...selSt, borderColor:'rgba(16,185,129,0.4)' }}>
            <option value="">— Choisir —</option>
            {wfsLayers.filter(l => l.id !== intLayerA).map(l =>
              <option key={l.id} value={l.id}>{l.name}</option>
            )}
          </select>
        </div>

        <div style={divider}/>

        <button onClick={runIntersect} disabled={intLoading} style={actBtn('#6366f1', intLoading)}>
          {intLoading
            ? <><Loader2 size={14} style={spin}/> Calcul en cours…</>
            : '✂️ Calculer l\'intersection'}
        </button>
      </div>
    </div>
  )

  // ── Sous-outil : Statistiques ─────────────────────────────────
  if (subTool === 'stats') return (
    <div style={{ ...panelSt, width:360 }}>
      <Header label="Statistiques" color="#6ee7b7"/>
      <div style={{ padding:14, display:'flex', flexDirection:'column', gap:12 }}>

        <div>
          <label style={lblSt}>Couche</label>
          <select value={statsLayer} onChange={e => {
            setStatsLayer(e.target.value); setStatsField(''); setStatsResults(null)
          }} style={selSt}>
            <option value="">— Choisir une couche —</option>
            {wfsLayers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>

        {statsLayer && (
          <div>
            <label style={lblSt}>Champ à analyser</label>
            <select value={statsField} onChange={e => { setStatsField(e.target.value); setStatsResults(null) }} style={selSt}>
              <option value="">— Choisir un champ —</option>
              {statsFields.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        )}

        {statsLayer && statsField && !statsResults && (
          <>
            <div style={divider}/>
            <button onClick={runStats} disabled={statsLoading} style={actBtn('#10b981', statsLoading)}>
              {statsLoading
                ? <><Loader2 size={14} style={spin}/> Calcul…</>
                : '📊 Calculer les statistiques'}
            </button>
          </>
        )}

        {statsResults && (
          <>
            <div style={{ fontSize:11, color:'rgba(200,210,230,0.5)', textAlign:'center', marginTop:4 }}>
              <strong style={{ color:'#6ee7b7' }}>{statsResults.layer}</strong>
              {' · '}champ <em style={{ color:'#fcd34d' }}>{statsResults.field}</em>
              {' · '}{statsResults.total} entité(s) totales, {statsResults.count} avec valeur
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {[
                { label:'Nb valeurs',  value: statsResults.count,           color:'#a5b4fc' },
                { label:'Somme',       value: fmtNum(statsResults.sum),     color:'#6ee7b7' },
                { label:'Moyenne',     value: fmtNum(statsResults.avg),     color:'#fcd34d' },
                { label:'Médiane',     value: fmtNum(statsResults.median),  color:'#fcd34d' },
                { label:'Minimum',     value: fmtNum(statsResults.min),     color:'#86efac' },
                { label:'Maximum',     value: fmtNum(statsResults.max),     color:'#f87171' },
                { label:'1er quartile',value: fmtNum(statsResults.q1),      color:'#93c5fd' },
                { label:'3e quartile', value: fmtNum(statsResults.q3),      color:'#93c5fd' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  background:'rgba(30,41,59,0.8)', borderRadius:8,
                  padding:'10px 12px', border:'1px solid rgba(255,255,255,0.07)',
                }}>
                  <div style={{ fontSize:10, color:'rgba(200,210,230,0.4)', marginBottom:4 }}>{label}</div>
                  <div style={{ fontSize:15, fontWeight:700, color, fontVariantNumeric:'tabular-nums' }}>{value}</div>
                </div>
              ))}
            </div>

            <button onClick={() => { setStatsField(''); setStatsResults(null) }} style={{
              marginTop:4, padding:'6px 0', cursor:'pointer',
              background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)',
              borderRadius:6, color:'rgba(200,210,230,0.6)', fontSize:12,
            }}>
              ↩ Nouvelle analyse
            </button>
          </>
        )}
      </div>
    </div>
  )

  return null
}

// ── Styles ─────────────────────────────────────────────────────
const panelSt = {
  position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
  zIndex:2000, width:340,
  background:'rgba(15,23,42,0.97)', backdropFilter:'blur(10px)',
  border:'1px solid rgba(255,255,255,0.1)', borderRadius:10,
  boxShadow:'0 8px 32px rgba(0,0,0,0.5)', color:'#e2e8f0', fontSize:13,
  maxHeight:'88vh', overflowY:'auto',
}
const iconBtn = { background:'none', border:'none', color:'rgba(200,210,230,0.5)', cursor:'pointer', padding:2, display:'flex', alignItems:'center' }
const cardSt  = {
  width:'100%', padding:'12px 14px', cursor:'pointer',
  background:'rgba(30,41,59,0.5)', border:'1px solid rgba(255,255,255,0.07)',
  borderRadius:8, textAlign:'left', transition:'background 0.15s',
}
const cardRow   = { display:'flex', alignItems:'center', gap:12 }
const iconCircle= { width:40, height:40, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }
const cardTitle = { fontWeight:600, fontSize:13, color:'#e2e8f0' }
const cardDesc  = { fontSize:11, color:'rgba(200,210,230,0.45)', marginTop:2 }
const lblSt     = { fontSize:11, color:'rgba(200,210,230,0.55)', display:'block', marginBottom:5 }
const selSt     = { width:'100%', background:'rgba(30,41,59,0.9)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, color:'#e2e8f0', padding:'6px 8px', fontSize:12, outline:'none' }
const inpSt     = { width:'100%', boxSizing:'border-box', background:'rgba(30,41,59,0.9)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, color:'#e2e8f0', padding:'6px 9px', fontSize:12, outline:'none' }
const divider   = { height:1, background:'rgba(255,255,255,0.08)' }
const infoBx    = { background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:6, padding:'8px 10px', fontSize:11, color:'rgba(200,210,230,0.7)', lineHeight:1.6 }
const actBtn    = (color, disabled) => ({
  background: disabled ? 'rgba(30,41,59,0.6)' : color,
  border:'none', borderRadius:7, color: disabled ? 'rgba(200,210,230,0.4)' : '#fff',
  padding:'10px 0', cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize:13, fontWeight:600,
  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
  transition:'background 0.15s',
})
const spin = { animation:'spin 1s linear infinite' }
