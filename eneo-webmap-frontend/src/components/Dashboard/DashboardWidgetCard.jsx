/**
 * DashboardWidgetCard.jsx
 * =======================
 * Rendu d'un widget individuel dans le tableau de bord.
 *
 * Affiche :
 *   - Titre éditable
 *   - Graphique (ChartRenderer)
 *   - Tableau de statistiques descriptives
 *   - Légende couleurs
 *   - Bouton export PNG
 *   - Bouton supprimer
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import ChartRenderer from './ChartRenderer'
import { prepareWidgetData, COLOR_SCHEMES, CHART_DEFINITIONS } from '../../services/dashboardService'

// ─── Styles ───────────────────────────────────────────────────────────────
const card = {
  background:   '#0d2035',
  border:       '1px solid rgba(0,170,221,0.15)',
  borderRadius: 10,
  display:      'flex',
  flexDirection:'column',
  overflow:     'hidden',
  position:     'relative',
}

const sectionTitle = {
  color:         '#64748b',
  fontSize:      10,
  fontWeight:    700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom:  8,
}

// ─── Composant ───────────────────────────────────────────────────────────
export default function DashboardWidgetCard({ widget, onDelete, onUpdate, onEdit }) {
  const cardRef       = useRef(null)
  const [data,        setData]      = useState(null)
  const [loading,     setLoading]   = useState(true)
  const [progress,    setProgress]  = useState({ loaded: 0, total: null })
  const [error,       setError]     = useState(null)
  const [editTitle,   setEditTitle] = useState(false)
  const [title,       setTitle]     = useState(widget.title)

  const colors = COLOR_SCHEMES[widget.color_scheme] || COLOR_SCHEMES.default
  const chartDef = CHART_DEFINITIONS.find(c => c.type === widget.chart_type)

  // Chargement des données avec progression par page
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setProgress({ loaded: 0, total: null })
    try {
      const result = await prepareWidgetData(
        widget.geoserver_layer,
        widget.attributes,
        widget.filters || {},
        (loaded, total) => setProgress({ loaded, total })
      )
      setData(result)
    } catch (e) {
      setError(e.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [widget.geoserver_layer, widget.attributes, widget.filters])

  useEffect(() => { load() }, [load])

  // Données pour le graphique
  const primaryField = widget.attributes[0]
  const chartData = data
    ? (widget.chart_type === 'grouped_bar'
        ? data.crossAggregation
        : data.aggregations[primaryField])
    : []

  const stats = data?.stats?.[primaryField]

  // Export PNG
  const exportPNG = async () => {
    try {
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#0d2035',
        scale: 2,
        logging: false,
      })
      const link = document.createElement('a')
      link.download = `${title.replace(/\s+/g, '_')}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch {
      // fallback : copier via canvas natif si html2canvas indisponible
      alert('Export PNG nécessite html2canvas. Installez-le avec : npm install html2canvas')
    }
  }

  const saveTitle = () => {
    setEditTitle(false)
    if (title !== widget.title) onUpdate?.({ ...widget, title })
  }

  return (
    <div ref={cardRef} style={card}>

      {/* ── Entête ──────────────────────────────────────────────────── */}
      <div style={{
        padding:      '10px 14px',
        borderBottom: '1px solid rgba(0,170,221,0.1)',
        display:      'flex', alignItems: 'center', gap: 8,
      }}>
        {/* Pastille type graphique */}
        <span style={{ fontSize: 16 }}>{chartDef?.icon || '📊'}</span>

        {/* Titre éditable */}
        {editTitle ? (
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => e.key === 'Enter' && saveTitle()}
            style={{
              flex: 1, background: 'transparent',
              border: 'none', borderBottom: '1px solid #00aadd',
              color: '#e2e8f0', fontSize: 13, fontWeight: 600,
              outline: 'none', padding: '2px 4px',
            }}
          />
        ) : (
          <span
            onClick={() => setEditTitle(true)}
            title="Cliquer pour modifier"
            style={{
              flex: 1, color: '#e2e8f0', fontSize: 13, fontWeight: 600,
              cursor: 'text', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {title}
          </span>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button
            onClick={load}
            title="Rafraîchir"
            style={iconBtn}
          >↻</button>
          <button
            onClick={exportPNG}
            title="Exporter PNG"
            style={iconBtn}
          >⤓</button>
          <button
            onClick={() => onEdit?.(widget)}
            title="Modifier le widget"
            style={{ ...iconBtn, color: '#00aadd' }}
          >✏</button>
          <button
            onClick={() => onDelete?.(widget.id)}
            title="Supprimer"
            style={{ ...iconBtn, color: '#ef4444' }}
          >✕</button>
        </div>
      </div>

      {/* ── Corps ───────────────────────────────────────────────────── */}
      <div style={{ padding: '14px 10px', flex: 1 }}>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: 200, color: '#64748b', fontSize: 13, gap: 10 }}>
            <span style={{ fontSize: 22, animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
            <span>
              {progress.total
                ? `Chargement… ${progress.loaded.toLocaleString()} / ${progress.total.toLocaleString()} entités`
                : progress.loaded > 0
                  ? `Chargement… ${progress.loaded.toLocaleString()} entités`
                  : 'Connexion à GeoServer…'
              }
            </span>
            {progress.total && (
              <div style={{ width: 160, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                <div style={{
                  width:      `${Math.min(100, Math.round(progress.loaded / progress.total * 100))}%`,
                  height:     '100%',
                  background: '#00aadd',
                  borderRadius: 2,
                  transition:  'width 0.3s ease',
                }} />
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{ padding: 16, color: '#ef4444', fontSize: 13, textAlign: 'center' }}>
            ⚠ {error}
            <br />
            <button onClick={load} style={{ ...iconBtn, marginTop: 8, fontSize: 12 }}>
              Réessayer
            </button>
          </div>
        )}

        {!loading && !error && chartData && (
          <>
            {/* Graphique */}
            <ChartRenderer
              chartType={widget.chart_type}
              data={chartData}
              colorScheme={widget.color_scheme}
              height={220}
            />

            {/* Légende */}
            {Array.isArray(chartData) && chartData.length > 0
              && ['pie', 'donut', 'treemap'].includes(widget.chart_type) && (
              <div style={{ marginTop: 10 }}>
                <div style={sectionTitle}>Légende</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                  {chartData.slice(0, 12).map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: colors[i % colors.length], flexShrink: 0,
                      }} />
                      <span style={{ color: '#94a3b8', fontSize: 11 }}>
                        {item.label}
                        <span style={{ color: '#475569' }}> ({item.percent}%)</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Statistiques descriptives */}
            {stats && (
              <div style={{
                marginTop: 14,
                borderTop: '1px solid rgba(148,163,184,0.1)',
                paddingTop: 12,
              }}>
                <div style={sectionTitle}>Statistiques — {primaryField}</div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
                  gap: 8,
                }}>
                  {buildStatsCards(stats).map(({ label, value }) => (
                    <div key={label} style={{
                      background:   'rgba(255,255,255,0.04)',
                      borderRadius: 6,
                      padding:      '8px 10px',
                      textAlign:    'center',
                    }}>
                      <div style={{ color: '#00aadd', fontWeight: 700, fontSize: 15 }}>{value}</div>
                      <div style={{ color: '#475569', fontSize: 10 }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info couche */}
            <div style={{ marginTop: 10, color: '#334155', fontSize: 11, textAlign: 'right' }}>
              {widget.layer_name || widget.geoserver_layer}
              {data?.total ? ` — ${data.total} entités` : ''}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Helper : cartes stats ────────────────────────────────────────────────
function buildStatsCards(stats) {
  const cards = [
    { label: 'Total',   value: stats.total   ?? '-' },
    { label: 'Valeurs', value: stats.count   ?? '-' },
    { label: 'Uniques', value: stats.unique  ?? '-' },
  ]
  if (stats.nullCount > 0)
    cards.push({ label: 'Manquant', value: stats.nullCount })
  if (stats.min !== undefined)
    cards.push({ label: 'Min', value: fmt(stats.min) }, { label: 'Max', value: fmt(stats.max) }, { label: 'Moyenne', value: fmt(stats.mean) })
  if (stats.mode !== undefined)
    cards.push({ label: 'Mode', value: stats.mode })
  return cards
}

function fmt(v) {
  if (v === undefined || v === null) return '-'
  if (typeof v === 'number') return Number.isInteger(v) ? v : v.toFixed(2)
  return v
}

const iconBtn = {
  background: 'transparent',
  border:     '1px solid rgba(148,163,184,0.15)',
  borderRadius: 4,
  color:      '#64748b',
  cursor:     'pointer',
  fontSize:   13,
  padding:    '2px 6px',
  lineHeight: '1.4',
  transition: 'color 0.15s',
}
