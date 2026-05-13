/**
 * DashboardModal.jsx
 * ==================
 * Modale principale du tableau de bord analytique.
 *
 * Fonctionnalités :
 *   - Nom du dashboard éditable
 *   - Grille multi-widgets responsive (CSS Grid)
 *   - Bouton "+ Ajouter un widget" → ouvre WidgetConfigurator
 *   - Sauvegarde / chargement depuis l'API Django (/api/dashboards/)
 *   - Partage (is_shared)
 *   - Sélection de dashboard existant
 *   - Supprimer / Dupliquer un dashboard
 */

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import WidgetConfigurator from './WidgetConfigurator'
import DashboardWidgetCard from './DashboardWidgetCard'

// ─── API helpers ─────────────────────────────────────────────────────────
const fetchApplication  = (appSlug) =>
  api.get(`/applications/${appSlug}/`).then(r => r.data)

const fetchDashboards = (appSlug) =>
  api.get(`/dashboards/?application=${appSlug}`).then(r => r.data.results || r.data)

const fetchDashboard = (id) =>
  api.get(`/dashboards/${id}/`).then(r => r.data)

const createDashboard = (data) =>
  api.post('/dashboards/', data).then(r => r.data)

const updateDashboard = (id, data) =>
  api.patch(`/dashboards/${id}/`, data).then(r => r.data)

const deleteDashboard = (id) =>
  api.delete(`/dashboards/${id}/`)

const createWidget = (data) =>
  api.post('/dashboard-widgets/', data).then(r => r.data)

const updateWidget = (id, data) =>
  api.patch(`/dashboard-widgets/${id}/`, data).then(r => r.data)

const deleteWidget = (id) =>
  api.delete(`/dashboard-widgets/${id}/`)

// ─── Styles partagés ────────────────────────────────────────────────────
const S = {
  overlay: {
    position:       'fixed', inset: 0, zIndex: 1100,
    background:     'rgba(0,0,0,0.75)',
    display:        'flex', alignItems: 'stretch',
  },
  modal: {
    background:     '#0a1628',
    border:         '1px solid rgba(0,170,221,0.15)',
    display:        'flex',
    flexDirection:  'column',
    width:          '100%',
    height:         '100%',
  },
  navbar: {
    height:         56,
    borderBottom:   '1px solid rgba(0,170,221,0.15)',
    display:        'flex',
    alignItems:     'center',
    padding:        '0 20px',
    gap:            12,
    flexShrink:     0,
    background:     '#0d1b2a',
  },
  sidebar: {
    width:          260,
    borderRight:    '1px solid rgba(0,170,221,0.1)',
    display:        'flex',
    flexDirection:  'column',
    overflowY:      'auto',
    flexShrink:     0,
    background:     '#0b1929',
  },
  body: {
    flex:           1,
    overflowY:      'auto',
    padding:        20,
  },
  btn: (v = 'primary') => ({
    padding:    '7px 14px',
    borderRadius: 6,
    border:     v === 'outline' ? '1px solid rgba(0,170,221,0.3)' : 'none',
    cursor:     'pointer',
    fontSize:   12,
    fontWeight: 600,
    background: v === 'primary' ? '#00aadd'
              : v === 'danger'  ? 'rgba(239,68,68,0.15)'
              : v === 'ghost'   ? 'transparent'
              : 'rgba(255,255,255,0.06)',
    color:      v === 'primary' ? '#fff'
              : v === 'danger'  ? '#ef4444'
              : v === 'ghost'   ? '#64748b'
              : '#cbd5e1',
    whiteSpace: 'nowrap',
  }),
}

// ─── Surligne les occurrences du terme recherché ─────────────────────────
function highlightMatch(text, query) {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(0,170,221,0.3)', color: '#e2e8f0', borderRadius: 2, padding: '0 1px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

// ─── Composant principal ─────────────────────────────────────────────────
export default function DashboardModal({ appSlug, wfsLayers = [], onClose }) {
  const qc = useQueryClient()

  const [activeDashId,  setActiveDashId]  = useState(null)
  const [showWizard,    setShowWizard]     = useState(false)
  const [editingWidget, setEditingWidget]  = useState(null)   // widget en cours d'édition
  const [editName,      setEditName]       = useState(false)
  const [dashName,      setDashName]       = useState('Nouveau tableau de bord')
  const [saving,        setSaving]         = useState(false)
  const [searchQuery,   setSearchQuery]    = useState('')

  // ── Récupérer l'id numérique de l'application depuis son slug ───────
  const { data: appData } = useQuery({
    queryKey: ['application', appSlug],
    queryFn:  () => fetchApplication(appSlug),
    enabled:  !!appSlug,
    staleTime: Infinity,
  })
  const appId = appData?.id ?? null

  // ── Chargement liste des dashboards ─────────────────────────────────
  const { data: dashboards = [], isLoading: loadingList } = useQuery({
    queryKey: ['dashboards', appSlug],
    queryFn:  () => fetchDashboards(appSlug),
    enabled:  !!appSlug,
  })

  // ── Chargement dashboard actif ───────────────────────────────────────
  const { data: activeDash, isLoading: loadingDash } = useQuery({
    queryKey: ['dashboard', activeDashId],
    queryFn:  () => fetchDashboard(activeDashId),
    enabled:  !!activeDashId,
  })

  useEffect(() => {
    if (activeDash) setDashName(activeDash.name)
  }, [activeDash])

  // Auto-sélectionner le premier dashboard disponible
  useEffect(() => {
    if (!activeDashId && dashboards.length > 0) {
      setActiveDashId(dashboards[0].id)
    }
  }, [dashboards, activeDashId])

  // ── Mutations ────────────────────────────────────────────────────────
  const invalidate = () => {
    qc.invalidateQueries(['dashboards', appSlug])
    if (activeDashId) qc.invalidateQueries(['dashboard', activeDashId])
  }

  const createNew = async () => {
    setSaving(true)
    try {
      const dash = await createDashboard({
        application: appId,
        name:        'Nouveau tableau de bord',
      })
      qc.invalidateQueries(['dashboards', appSlug])
      setActiveDashId(dash.id)
      setDashName(dash.name)
      setEditName(true)
    } finally {
      setSaving(false)
    }
  }

  const saveName = async () => {
    setEditName(false)
    if (!activeDashId || dashName === activeDash?.name) return
    setSaving(true)
    try {
      await updateDashboard(activeDashId, { name: dashName })
      invalidate()
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteDash = async (id) => {
    if (!window.confirm('Supprimer ce tableau de bord ?')) return
    await deleteDashboard(id)
    qc.invalidateQueries(['dashboards', appSlug])
    if (activeDashId === id) setActiveDashId(null)
  }

  const handleToggleShare = async () => {
    if (!activeDashId) return
    await updateDashboard(activeDashId, { is_shared: !activeDash?.is_shared })
    invalidate()
  }

  const handleDuplicate = async () => {
    if (!activeDashId) return
    setSaving(true)
    try {
      const resp = await api.post(`/dashboards/${activeDashId}/duplicate/`).then(r => r.data)
      qc.invalidateQueries(['dashboards', appSlug])
      setActiveDashId(resp.id)
    } finally {
      setSaving(false)
    }
  }

  // ── Gestion des widgets ──────────────────────────────────────────────
  const handleSaveWidget = async (widgetConfig) => {
    setShowWizard(false)
    if (!activeDashId) return
    if (editingWidget) {
      // Mise à jour d'un widget existant
      await updateWidget(editingWidget.id, widgetConfig)
      setEditingWidget(null)
    } else {
      // Création d'un nouveau widget
      await createWidget({ ...widgetConfig, dashboard: activeDashId })
    }
    invalidate()
  }

  const handleEditWidget = (widget) => {
    setEditingWidget(widget)
    setShowWizard(true)
  }

  const handleCancelWizard = () => {
    setShowWizard(false)
    setEditingWidget(null)
  }

  const handleDeleteWidget = async (widgetId) => {
    await deleteWidget(widgetId)
    invalidate()
  }

  const handleUpdateWidget = async (widget) => {
    // Mise à jour rapide du titre depuis la carte
    await updateWidget(widget.id, { title: widget.title })
    invalidate()
  }

  const widgets = activeDash?.widgets || []

  return (
    <>
      <div style={S.overlay}>
        <div style={S.modal}>

          {/* ── Navbar ────────────────────────────────────────────────── */}
          <div style={S.navbar}>
            {/* Logo / titre section */}
            <span style={{ color: '#00aadd', fontSize: 18 }}>📊</span>
            <span style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>
              Tableaux de bord
            </span>
            <span style={{ color: '#334155' }}>|</span>

            {/* Nom du dashboard actif */}
            {editName ? (
              <input
                autoFocus
                value={dashName}
                onChange={e => setDashName(e.target.value)}
                onBlur={saveName}
                onKeyDown={e => e.key === 'Enter' && saveName()}
                style={{
                  background: 'transparent', border: 'none',
                  borderBottom: '1px solid #00aadd',
                  color: '#e2e8f0', fontSize: 14, fontWeight: 700,
                  outline: 'none', padding: '2px 6px', minWidth: 200,
                }}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <span
                  style={{
                    color: activeDashId ? '#e2e8f0' : '#475569',
                    fontSize: 14, fontWeight: 700,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    maxWidth: 280,
                  }}
                >
                  {activeDashId ? dashName : 'Sélectionner un tableau de bord'}
                </span>
                {activeDashId && (
                  <button
                    onClick={() => setEditName(true)}
                    title="Renommer le tableau de bord"
                    style={{
                      background:   'transparent',
                      border:       '1px solid rgba(0,170,221,0.25)',
                      borderRadius: 4,
                      color:        '#00aadd',
                      cursor:       'pointer',
                      fontSize:     12,
                      padding:      '2px 6px',
                      flexShrink:   0,
                      lineHeight:   '1.4',
                    }}
                  >
                    ✏ Renommer
                  </button>
                )}
              </div>
            )}

            {saving && <span style={{ color: '#64748b', fontSize: 11 }}>Enregistrement…</span>}

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Actions */}
            {activeDashId && (
              <>
                <button
                  onClick={handleToggleShare}
                  style={S.btn('outline')}
                  title={activeDash?.is_shared
                    ? 'Visible par tous — cliquer pour le rendre privé'
                    : 'Visible uniquement par vous — cliquer pour partager'}
                >
                  {activeDash?.is_shared ? '🔒 Rendre privé' : '🔓 Partager avec l\'équipe'}
                </button>
                <button onClick={handleDuplicate} style={S.btn('outline')}>⊕ Dupliquer</button>
                <button
                  onClick={() => setShowWizard(true)}
                  style={S.btn('primary')}
                >
                  + Ajouter un widget
                </button>
              </>
            )}
            <button onClick={onClose} style={{ ...S.btn('ghost'), fontSize: 18, padding: '4px 8px', marginLeft: 4 }}>
              ✕
            </button>
          </div>

          {/* ── Contenu : sidebar + grille ──────────────────────────────── */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

            {/* Sidebar — liste des dashboards */}
            <div style={S.sidebar}>
              <div style={{ padding: '14px 16px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{
                  color: '#64748b', fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>
                  Mes tableaux de bord
                </div>

                {/* Barre de recherche */}
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
                    color: '#475569', fontSize: 13, pointerEvents: 'none',
                  }}>🔍</span>
                  <input
                    type="text"
                    placeholder="Rechercher…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{
                      width:        '100%',
                      background:   'rgba(255,255,255,0.05)',
                      border:       '1px solid rgba(148,163,184,0.15)',
                      borderRadius: 6,
                      color:        '#e2e8f0',
                      fontSize:     12,
                      padding:      '6px 8px 6px 26px',
                      outline:      'none',
                      boxSizing:    'border-box',
                    }}
                    onFocus={e => e.target.style.borderColor = 'rgba(0,170,221,0.4)'}
                    onBlur={e  => e.target.style.borderColor = 'rgba(148,163,184,0.15)'}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      style={{
                        position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', color: '#475569',
                        cursor: 'pointer', fontSize: 12, padding: '0 2px',
                      }}
                    >✕</button>
                  )}
                </div>

                <button
                  onClick={createNew}
                  style={{ ...S.btn('outline'), width: '100%', textAlign: 'left', padding: '7px 10px' }}
                >
                  + Nouveau
                </button>
              </div>

              {loadingList ? (
                <div style={{ padding: '12px 16px', color: '#64748b', fontSize: 12 }}>
                  Chargement…
                </div>
              ) : dashboards.length === 0 ? (
                <div style={{ padding: '12px 16px', color: '#475569', fontSize: 12 }}>
                  Aucun tableau de bord.<br />Cliquez sur "+ Nouveau" pour commencer.
                </div>
              ) : (
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {dashboards
                    .filter(d => !searchQuery || d.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(d => (
                    <div
                      key={d.id}
                      onClick={() => setActiveDashId(d.id)}
                      style={{
                        padding:    '8px 16px',
                        cursor:     'pointer',
                        borderLeft: `3px solid ${activeDashId === d.id ? '#00aadd' : 'transparent'}`,
                        background: activeDashId === d.id ? 'rgba(0,170,221,0.08)' : 'transparent',
                        transition: 'all 0.15s',
                        display:    'flex', alignItems: 'flex-start', gap: 8,
                      }}
                      onMouseEnter={e => { if (activeDashId !== d.id) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                      onMouseLeave={e => { if (activeDashId !== d.id) e.currentTarget.style.background = 'transparent' }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          color: activeDashId === d.id ? '#e2e8f0' : '#94a3b8',
                          fontSize: 12, fontWeight: activeDashId === d.id ? 600 : 400,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {/* Surligner le terme recherché */}
                          {searchQuery
                            ? highlightMatch(d.name, searchQuery)
                            : d.name}
                        </div>
                        <div style={{ color: '#475569', fontSize: 10, marginTop: 1 }}>
                          {d.widgets_count} widget{d.widgets_count !== 1 ? 's' : ''}
                          {d.is_shared
                            ? <span style={{ color: '#0ea5e9' }}> · partagé</span>
                            : <span style={{ color: '#475569' }}> · privé</span>}
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteDash(d.id) }}
                        style={{
                          background: 'transparent', border: 'none',
                          color: '#475569', cursor: 'pointer', fontSize: 13,
                          padding: '0 2px', lineHeight: 1, flexShrink: 0,
                        }}
                        title="Supprimer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  {/* Aucun résultat de recherche */}
                  {searchQuery && dashboards.filter(d =>
                    d.name.toLowerCase().includes(searchQuery.toLowerCase())
                  ).length === 0 && (
                    <div style={{ padding: '10px 16px', color: '#475569', fontSize: 12, fontStyle: 'italic' }}>
                      Aucun résultat pour « {searchQuery} »
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Zone des widgets */}
            <div style={S.body}>
              {!activeDashId ? (
                <div style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  height: '100%', color: '#334155', gap: 12,
                }}>
                  <span style={{ fontSize: 40 }}>📊</span>
                  <span style={{ fontSize: 14 }}>Sélectionnez ou créez un tableau de bord</span>
                  <button onClick={createNew} style={S.btn('primary')}>
                    + Créer mon premier tableau de bord
                  </button>
                </div>
              ) : loadingDash ? (
                <div style={{ color: '#64748b', fontSize: 13, padding: 20 }}>
                  Chargement…
                </div>
              ) : widgets.length === 0 ? (
                <div style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  height: '100%', color: '#334155', gap: 12,
                }}>
                  <span style={{ fontSize: 36 }}>🧩</span>
                  <span style={{ fontSize: 14 }}>Ce tableau de bord est vide</span>
                  <button onClick={() => setShowWizard(true)} style={S.btn('primary')}>
                    + Ajouter un premier widget
                  </button>
                </div>
              ) : (
                <div style={{
                  display:             'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
                  gap:                 16,
                  alignItems:          'start',
                }}>
                  {[...widgets]
                    .sort((a, b) => a.position - b.position)
                    .map(w => (
                      <DashboardWidgetCard
                        key={w.id}
                        widget={w}
                        onDelete={handleDeleteWidget}
                        onUpdate={handleUpdateWidget}
                        onEdit={handleEditWidget}
                      />
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Wizard ajout / édition de widget */}
      {showWizard && (
        <WidgetConfigurator
          wfsLayers={wfsLayers}
          onConfirm={handleSaveWidget}
          onCancel={handleCancelWizard}
          initialData={editingWidget}
        />
      )}
    </>
  )
}
