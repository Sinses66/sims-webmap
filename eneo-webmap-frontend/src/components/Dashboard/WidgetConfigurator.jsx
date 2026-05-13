/**
 * WidgetConfigurator.jsx
 * ======================
 * Wizard 3 étapes pour configurer un widget de tableau de bord.
 *
 * Étape 1 — Choisir une couche WFS
 * Étape 2 — Choisir un ou deux attributs
 * Étape 3 — Choisir le type de graphique + palette + titre → Prévisualisation
 */

import { useState, useEffect, useCallback } from 'react'
import {
  fetchLayerFields,
  prepareWidgetData,
  detectFieldType,
  getCompatibleCharts,
  COLOR_SCHEMES,
} from '../../services/dashboardService'
import ChartRenderer from './ChartRenderer'

const STEP_LABELS = ['Couche', 'Attributs', 'Graphique']

// ─── Styles partagés ────────────────────────────────────────────────────────
const S = {
  overlay: {
    position:        'fixed', inset: 0, zIndex: 1200,
    background:      'rgba(0,0,0,0.7)',
    display:         'flex', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    background:   '#0d1b2a',
    border:       '1px solid rgba(0,170,221,0.2)',
    borderRadius: 12,
    width:        'min(760px, 95vw)',
    maxHeight:    '90vh',
    display:      'flex',
    flexDirection:'column',
    overflow:     'hidden',
  },
  header: {
    padding:      '16px 20px',
    borderBottom: '1px solid rgba(0,170,221,0.15)',
    display:      'flex', alignItems: 'center', gap: 12,
  },
  body: {
    padding:   '20px',
    overflowY: 'auto',
    flex:      1,
  },
  footer: {
    padding:      '14px 20px',
    borderTop:    '1px solid rgba(0,170,221,0.1)',
    display:      'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  label: {
    color:      '#94a3b8',
    fontSize:   12,
    fontWeight: 600,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    marginBottom: 6,
    display:    'block',
  },
  select: {
    width:        '100%',
    background:   'rgba(255,255,255,0.05)',
    border:       '1px solid rgba(148,163,184,0.2)',
    borderRadius: 6,
    color:        '#e2e8f0',
    padding:      '8px 10px',
    fontSize:     13,
    cursor:       'pointer',
  },
  input: {
    width:        '100%',
    background:   'rgba(255,255,255,0.05)',
    border:       '1px solid rgba(148,163,184,0.2)',
    borderRadius: 6,
    color:        '#e2e8f0',
    padding:      '8px 10px',
    fontSize:     13,
    boxSizing:    'border-box',
  },
  chip: (selected) => ({
    display:      'inline-flex', alignItems: 'center', gap: 6,
    padding:      '5px 12px',
    borderRadius: 20,
    border:       `1px solid ${selected ? '#00aadd' : 'rgba(148,163,184,0.2)'}`,
    background:   selected ? 'rgba(0,170,221,0.15)' : 'rgba(255,255,255,0.04)',
    color:        selected ? '#00aadd' : '#94a3b8',
    cursor:       'pointer',
    fontSize:     12,
    fontWeight:   selected ? 600 : 400,
    transition:   'all 0.15s',
    userSelect:   'none',
  }),
  btn: (variant = 'primary') => ({
    padding:      '8px 18px',
    borderRadius: 6,
    border:       'none',
    cursor:       'pointer',
    fontSize:     13,
    fontWeight:   600,
    background:   variant === 'primary' ? '#00aadd'
                : variant === 'ghost'   ? 'transparent'
                : 'rgba(255,255,255,0.08)',
    color:        variant === 'ghost' ? '#64748b' : '#fff',
    opacity:      1,
  }),
}

// ─── Stepper ─────────────────────────────────────────────────────────────────
function Stepper({ current }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {STEP_LABELS.map((label, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{
            width: 26, height: 26, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700,
            background: i < current  ? 'rgba(0,170,221,0.3)'
                      : i === current ? '#00aadd'
                      : 'rgba(255,255,255,0.08)',
            color:     i < current  ? '#00aadd'
                      : i === current ? '#fff'
                      : '#475569',
            border:    i === current ? '2px solid #00aadd' : '2px solid transparent',
          }}>
            {i < current ? '✓' : i + 1}
          </div>
          <span style={{
            marginLeft: 6,
            fontSize: 12,
            color: i === current ? '#e2e8f0' : '#475569',
            fontWeight: i === current ? 600 : 400,
          }}>
            {label}
          </span>
          {i < STEP_LABELS.length - 1 && (
            <div style={{
              width: 28, height: 1, margin: '0 10px',
              background: i < current ? '#00aadd' : 'rgba(148,163,184,0.2)',
            }} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function WidgetConfigurator({ wfsLayers, onConfirm, onCancel, initialData = null }) {
  const isEditing = !!initialData

  // En mode édition, retrouver l'objet layer depuis wfsLayers (ou reconstruire un objet minimal)
  const initLayer = () => {
    if (!initialData) return null
    return wfsLayers.find(l => l.geoserverLayer === initialData.geoserver_layer) || {
      id:             initialData.geoserver_layer,
      name:           initialData.layer_name || initialData.geoserver_layer,
      geoserverLayer: initialData.geoserver_layer,
      color:          '#00aadd',
    }
  }

  const [step,           setStep]           = useState(isEditing ? 2 : 0)
  const [layer,          setLayer]          = useState(initLayer)
  const [fields,         setFields]         = useState([])
  const [loadingFields,  setLoadingFields]  = useState(false)
  const [attrs,          setAttrs]          = useState(initialData?.attributes || [])
  const [chartType,      setChartType]      = useState(initialData?.chart_type || null)
  const [colorScheme,    setColorScheme]    = useState(initialData?.color_scheme || 'default')
  const [title,          setTitle]          = useState(initialData?.title || '')
  const [preview,        setPreview]        = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Chargement des champs quand la couche change
  // En mode édition (isEditing=true) on ne réinitialise pas les attrs/chartType
  useEffect(() => {
    if (!layer) return
    setLoadingFields(true)
    if (!isEditing) {
      setFields([])
      setAttrs([])
      setChartType(null)
    }
    fetchLayerFields(layer.geoserverLayer)
      .then(f => setFields(f))
      .finally(() => setLoadingFields(false))
  }, [layer]) // eslint-disable-line react-hooks/exhaustive-deps

  // En mode édition : charger la preview immédiatement
  useEffect(() => {
    if (isEditing && layer && attrs.length > 0) {
      loadPreview()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Déterminer le type de données dominant pour les attributs sélectionnés
  const primaryType = attrs.length > 0 && preview?.fieldTypes
    ? preview.fieldTypes[attrs[0]] || 'categorical'
    : 'categorical'

  const compatibleCharts = getCompatibleCharts(primaryType, attrs.length)

  // Charger la preview quand on arrive à l'étape 3
  const loadPreview = useCallback(async () => {
    if (!layer || attrs.length === 0) return
    setLoadingPreview(true)
    try {
      const data = await prepareWidgetData(layer.geoserverLayer, attrs)
      setPreview(data)
      // Auto-sélectionner le premier graphique compatible
      const ft = data.fieldTypes[attrs[0]] || 'categorical'
      const charts = getCompatibleCharts(ft, attrs.length)
      if (charts.length > 0 && !chartType) setChartType(charts[0].type)
    } finally {
      setLoadingPreview(false)
    }
  }, [layer, attrs, chartType])

  const goToStep = (n) => {
    if (n === 2 && step < 2) loadPreview()
    setStep(n)
  }

  const toggleAttr = (fieldName) => {
    setAttrs(prev => {
      if (prev.includes(fieldName)) return prev.filter(f => f !== fieldName)
      if (prev.length >= 2) return [prev[1], fieldName]  // remplace le plus vieux
      return [...prev, fieldName]
    })
    setChartType(null)
    setPreview(null)
  }

  const handleConfirm = () => {
    if (!layer || attrs.length === 0 || !chartType) return
    onConfirm({
      title:          title || `${layer.name} — ${attrs.join(', ')}`,
      geoserver_layer: layer.geoserverLayer,
      layer_name:      layer.name,
      attributes:      attrs,
      chart_type:      chartType,
      color_scheme:    colorScheme,
    })
  }

  // ─── Rendu données preview ───────────────────────────────────────────────
  const chartData = preview
    ? (chartType === 'grouped_bar'
        ? preview.crossAggregation
        : preview.aggregations[attrs[0]])
    : []

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onCancel()}>
      <div style={S.modal}>

        {/* Header */}
        <div style={S.header}>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15, marginBottom: 10 }}>
              {isEditing ? '✏ Modifier le widget' : 'Nouveau widget'}
            </div>
            <Stepper current={step} />
          </div>
          <button onClick={onCancel} style={{ ...S.btn('ghost'), fontSize: 18, padding: '4px 8px' }}>✕</button>
        </div>

        {/* Body */}
        <div style={S.body}>

          {/* ── Étape 0 : Couche ────────────────────────────────────────── */}
          {step === 0 && (
            <div>
              <label style={S.label}>Sélectionner une couche WFS</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {wfsLayers.length === 0 && (
                  <p style={{ color: '#64748b', fontSize: 13 }}>
                    Aucune couche WFS disponible dans cette application.
                  </p>
                )}
                {wfsLayers.map(l => (
                  <div
                    key={l.id}
                    onClick={() => setLayer(l)}
                    style={{
                      padding:      '10px 14px',
                      borderRadius: 8,
                      border:       `1px solid ${layer?.id === l.id ? '#00aadd' : 'rgba(148,163,184,0.15)'}`,
                      background:   layer?.id === l.id ? 'rgba(0,170,221,0.1)' : 'rgba(255,255,255,0.03)',
                      cursor:       'pointer',
                      display:      'flex', alignItems: 'center', gap: 10,
                      transition:   'all 0.15s',
                    }}
                  >
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: l.color || '#00aadd', flexShrink: 0,
                    }} />
                    <div>
                      <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>{l.name}</div>
                      <div style={{ color: '#64748b', fontSize: 11 }}>{l.geoserverLayer}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Étape 1 : Attributs ─────────────────────────────────────── */}
          {step === 1 && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>Choisir 1 ou 2 attributs à analyser</label>
                <p style={{ color: '#64748b', fontSize: 12, margin: '0 0 12px' }}>
                  Avec 1 attribut : camembert, barres, histogram. Avec 2 : barres groupées.
                </p>
                {loadingFields ? (
                  <div style={{ color: '#64748b', fontSize: 13 }}>Chargement des champs…</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {fields.map(f => (
                      <span
                        key={f.name}
                        onClick={() => toggleAttr(f.name)}
                        style={S.chip(attrs.includes(f.name))}
                      >
                        {attrs.includes(f.name) && '✓ '}
                        {f.name}
                        <span style={{ opacity: 0.6, fontSize: 10 }}>({f.localType})</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {attrs.length > 0 && (
                <div style={{
                  background: 'rgba(0,170,221,0.06)', borderRadius: 8,
                  padding: '10px 14px', fontSize: 12,
                }}>
                  <span style={{ color: '#00aadd', fontWeight: 600 }}>Sélectionnés : </span>
                  <span style={{ color: '#e2e8f0' }}>{attrs.join(', ')}</span>
                </div>
              )}
            </div>
          )}

          {/* ── Étape 2 : Graphique + preview ───────────────────────────── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Titre */}
              <div>
                <label style={S.label}>Titre du widget</label>
                <input
                  style={S.input}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={`${layer?.name || 'Couche'} — ${attrs.join(', ')}`}
                />
              </div>

              {/* Type de graphique */}
              <div>
                <label style={S.label}>Type de graphique</label>
                {loadingPreview ? (
                  <div style={{ color: '#64748b', fontSize: 13 }}>Analyse des données…</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {compatibleCharts.map(c => (
                      <div
                        key={c.type}
                        onClick={() => setChartType(c.type)}
                        title={c.description}
                        style={{
                          ...S.chip(chartType === c.type),
                          padding: '7px 14px',
                          fontSize: 13,
                        }}
                      >
                        {c.icon} {c.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Palette */}
              <div>
                <label style={S.label}>Palette de couleurs</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {Object.entries(COLOR_SCHEMES).map(([key, palette]) => (
                    <div
                      key={key}
                      onClick={() => setColorScheme(key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '5px 10px', borderRadius: 20, cursor: 'pointer',
                        border: `1px solid ${colorScheme === key ? '#00aadd' : 'rgba(148,163,184,0.15)'}`,
                        background: colorScheme === key ? 'rgba(0,170,221,0.1)' : 'transparent',
                      }}
                    >
                      <div style={{ display: 'flex', gap: 2 }}>
                        {palette.slice(0, 5).map((c, i) => (
                          <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
                        ))}
                      </div>
                      <span style={{ color: colorScheme === key ? '#00aadd' : '#94a3b8', fontSize: 11 }}>
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview graphique */}
              {chartData && chartType && !loadingPreview && (
                <div>
                  <label style={S.label}>Prévisualisation</label>
                  <div style={{
                    background:   'rgba(255,255,255,0.02)',
                    border:       '1px solid rgba(148,163,184,0.1)',
                    borderRadius: 8,
                    padding:      '16px 8px',
                  }}>
                    <ChartRenderer
                      chartType={chartType}
                      data={chartData}
                      colorScheme={colorScheme}
                      height={220}
                    />
                    {preview && attrs[0] && preview.stats[attrs[0]] && (
                      <div style={{
                        borderTop: '1px solid rgba(148,163,184,0.1)',
                        marginTop: 12, paddingTop: 10,
                        display: 'flex', gap: 16, flexWrap: 'wrap',
                        justifyContent: 'center',
                      }}>
                        {[
                          ['Total',    preview.stats[attrs[0]].total],
                          ['Valeurs',  preview.stats[attrs[0]].count],
                          ['Uniques',  preview.stats[attrs[0]].unique],
                          ['Manquant', preview.stats[attrs[0]].nullCount],
                        ].map(([k, v]) => (
                          <div key={k} style={{ textAlign: 'center' }}>
                            <div style={{ color: '#00aadd', fontWeight: 700, fontSize: 16 }}>{v}</div>
                            <div style={{ color: '#64748b', fontSize: 11 }}>{k}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={S.footer}>
          <button
            style={S.btn('ghost')}
            onClick={step === 0 ? onCancel : () => setStep(step - 1)}
          >
            {step === 0 ? 'Annuler' : '← Retour'}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step < 2 ? (
              <button
                style={{
                  ...S.btn('primary'),
                  opacity: (step === 0 && !layer) || (step === 1 && attrs.length === 0) ? 0.4 : 1,
                  cursor: (step === 0 && !layer) || (step === 1 && attrs.length === 0) ? 'not-allowed' : 'pointer',
                }}
                disabled={(step === 0 && !layer) || (step === 1 && attrs.length === 0)}
                onClick={() => goToStep(step + 1)}
              >
                Suivant →
              </button>
            ) : (
              <button
                style={{
                  ...S.btn('primary'),
                  opacity: !chartType ? 0.4 : 1,
                  cursor: !chartType ? 'not-allowed' : 'pointer',
                }}
                disabled={!chartType}
                onClick={handleConfirm}
              >
                {isEditing ? '✓ Enregistrer les modifications' : '✓ Ajouter le widget'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
