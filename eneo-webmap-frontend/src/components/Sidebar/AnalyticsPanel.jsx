import { useState } from 'react'
import { BarChart2, Loader2, Zap, AlertTriangle, Wrench, Users, TrendingUp, Activity,
         LayoutDashboard, History, FileSpreadsheet, Eye, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useIncidentStats, useIncidents, useTypeIncidents, useAppLayers, useInterventions } from '../../hooks/useGeoData'
import { INCIDENT_STATUS, INCIDENT_PRIORITE, INTERVENTION_STATUS, TYPE_TRAVAUX } from '../../config/constants'
import DashboardModal from '../Dashboard/DashboardModal'

/* ── Stat card dark ─────────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${accent}22` }}
      >
        <Icon className="w-4.5 h-4.5" style={{ width: '1.1rem', height: '1.1rem', color: accent }} />
      </div>
      <div>
        <p className="text-xl font-bold leading-tight" style={{ color: '#fff' }}>
          {value ?? <span style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>}
        </p>
        <p className="text-[10px] leading-tight mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</p>
      </div>
    </div>
  )
}

/* ── Progress bar ───────────────────────────────────────────── */
function BarRow({ label, value, max, accent }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-1">
        <span style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</span>
        <span className="font-semibold" style={{ color: accent }}>{value}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: accent }}
        />
      </div>
    </div>
  )
}

/* ── KPI réseau ligne ───────────────────────────────────────── */
function KpiRow({ label, value }) {
  return (
    <div className="flex justify-between items-center py-1.5"
         style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
      <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>{value}</span>
    </div>
  )
}

/* ── Section header ─────────────────────────────────────────── */
function SectionTitle({ children, icon: Icon }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest px-0.5 mb-2 flex items-center gap-1.5"
       style={{ color: 'rgba(255,255,255,0.35)' }}>
      {Icon && <Icon className="w-3 h-3" />}
      {children}
    </p>
  )
}

// ── Styles sélecteurs ────────────────────────────────────────
const SEL = {
  background: '#1e2a3a',
  border: '1px solid rgba(255,255,255,0.12)',
  color: 'rgba(255,255,255,0.85)',
  colorScheme: 'dark',
  fontSize: '0.7rem',
  padding: '0.25rem 0.5rem',
  borderRadius: '0.5rem',
  outline: 'none',
  width: '100%',
}
const INP = {
  ...SEL,
  background: 'rgba(255,255,255,0.06)',
}

// ── Export Excel ──────────────────────────────────────────────
async function exportExcel(incidents, typesIncident) {
  const XLSX = await import('xlsx')

  const typeMap = Object.fromEntries((typesIncident || []).map(t => [t.id, t.nom]))

  const rows = incidents.map(inc => ({
    'ID':              inc.id,
    'Titre':           inc.titre || '',
    'Type':            typeMap[inc.type_incident] || inc.type_incident_label || '',
    'Statut':          inc.statut_label  || inc.statut,
    'Priorité':        inc.priorite_label || inc.priorite,
    'Ouvrage':         inc.ouvrage_detail?.code || '',
    'Localisation':    inc.localisation || '',
    'Quartier':        inc.quartier || '',
    'Ville':           inc.ville || '',
    'Signalé par':     inc.signale_par_detail?.full_name || '',
    'Assigné à':       inc.assigne_a_detail?.full_name || '',
    'Date signalement':inc.date_signalement
      ? format(new Date(inc.date_signalement), 'dd/MM/yyyy HH:mm', { locale: fr }) : '',
    'Date résolution': inc.date_resolution
      ? format(new Date(inc.date_resolution), 'dd/MM/yyyy HH:mm', { locale: fr }) : '',
    'Nb interventions':inc.nb_interventions ?? 0,
  }))

  const ws = XLSX.utils.json_to_sheet(rows)

  // Largeurs colonnes
  ws['!cols'] = [
    { wch: 6 }, { wch: 35 }, { wch: 20 }, { wch: 12 }, { wch: 10 },
    { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 15 },
    { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 8 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Historique incidents')
  XLSX.writeFile(wb, `historique_incidents_${format(new Date(), 'yyyyMMdd')}.xlsx`)
}

// ── Modale Historique ─────────────────────────────────────────
function HistoriqueModal({ filtres, typesIncident, onClose }) {
  const [page, setPage] = useState(1)

  const params = {
    statut:   filtres.statut   || undefined,
    priorite: filtres.priorite || undefined,
    date_signalement_after:  filtres.dateDebut || undefined,
    date_signalement_before: filtres.dateFin   || undefined,
    page,
  }

  const { data, isLoading, isFetching } = useIncidents(params)

  const isPaginated = data && 'results' in data
  const incidents   = isPaginated ? data.results : (data ?? [])
  const totalCount  = isPaginated ? data.count   : incidents.length
  const totalPages  = Math.ceil(totalCount / 20)

  // Labels filtres actifs pour affichage en titre
  const filtreLabels = [
    filtres.statut    ? INCIDENT_STATUS[filtres.statut]?.label       : null,
    filtres.priorite  ? INCIDENT_PRIORITE[filtres.priorite]?.label   : null,
    filtres.dateDebut ? `Du ${filtres.dateDebut}`                     : null,
    filtres.dateFin   ? `Au ${filtres.dateFin}`                       : null,
  ].filter(Boolean)

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="flex flex-col w-full max-w-5xl rounded-2xl overflow-hidden"
        style={{
          background: '#0d1b2a',
          border: '1px solid rgba(255,255,255,0.1)',
          maxHeight: '90vh',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
        }}
      >
        {/* En-tête modale */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0"
             style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: '#111f2e' }}>
          <div className="flex items-center gap-2.5">
            <History className="w-4 h-4" style={{ color: '#00aadd' }} />
            <span className="font-bold text-sm" style={{ color: '#fff' }}>Historique des incidents</span>
            {filtreLabels.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {filtreLabels.map((l, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(0,170,221,0.15)', color: '#00aadd' }}>
                    {l}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isFetching && <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: '#8B5CF6' }} />}
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {totalCount} incident{totalCount > 1 ? 's' : ''}
            </span>
            <button onClick={onClose}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.06)' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Corps : tableau */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#8B5CF6' }} />
            </div>
          ) : incidents.length === 0 ? (
            <p className="text-center py-16 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Aucun incident pour ces filtres
            </p>
          ) : (
            <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr style={{ background: '#111f2e' }}>
                  {['#', 'Titre', 'Type', 'Statut', 'Priorité', 'Ouvrage', 'Localisation', 'Signalé le', 'Résolu le', 'Interv.'].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 font-semibold whitespace-nowrap"
                        style={{ color: 'rgba(255,255,255,0.45)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {incidents.map((inc, i) => {
                  const s = INCIDENT_STATUS[inc.statut]
                  const p = INCIDENT_PRIORITE[inc.priorite]
                  const typeLabel = typesIncident.find(t => t.id === inc.type_incident)?.nom
                                 || inc.type_incident_label || '—'
                  return (
                    <tr key={inc.id}
                        style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                                 borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td className="px-3 py-2" style={{ color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>
                        {inc.id}
                      </td>
                      <td className="px-3 py-2" style={{ minWidth: 200, maxWidth: 280 }}>
                        <p className="truncate font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>
                          {inc.titre}
                        </p>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.55)' }}>
                        {typeLabel}
                      </td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap"
                              style={{ background: s?.bg, color: s?.hex }}>
                          {s?.label || inc.statut}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-[11px] font-bold" style={{ color: p?.hex }}>
                          {p?.label || inc.priorite}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'rgba(0,170,221,0.8)', fontSize: '0.7rem' }}>
                        {inc.ouvrage_detail?.code || '—'}
                      </td>
                      <td className="px-3 py-2" style={{ color: 'rgba(255,255,255,0.45)', maxWidth: 160 }}>
                        <p className="truncate">
                          {[inc.localisation, inc.ville].filter(Boolean).join(', ') || '—'}
                        </p>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {inc.date_signalement
                          ? format(new Date(inc.date_signalement), 'dd/MM/yy HH:mm', { locale: fr })
                          : '—'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {inc.date_resolution
                          ? format(new Date(inc.date_resolution), 'dd/MM/yy', { locale: fr })
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-center" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        {inc.nb_interventions ?? 0}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pied : pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 shrink-0"
               style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: '#111f2e' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-30"
                    style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' }}>
              <ChevronLeft className="w-3.5 h-3.5" /> Préc.
            </button>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Page {page} / {totalPages}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-30"
                    style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' }}>
              Suiv. <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Section Historique (sidebar) ──────────────────────────────
function HistoriqueSection() {
  const [filtres, setFiltres]     = useState({ statut: '', priorite: '', dateDebut: '', dateFin: '' })
  const [showModal, setShowModal] = useState(false)
  const [exporting, setExporting] = useState(false)

  const { data: typesIncident = [] } = useTypeIncidents()

  const setF = (k) => (e) => setFiltres(f => ({ ...f, [k]: e.target.value }))

  // Appel léger pour le compteur sidebar (page 1 uniquement)
  const previewParams = {
    statut:   filtres.statut   || undefined,
    priorite: filtres.priorite || undefined,
    date_signalement_after:  filtres.dateDebut || undefined,
    date_signalement_before: filtres.dateFin   || undefined,
    page: 1,
  }
  const { data: previewData, isLoading: previewLoading } = useIncidents(previewParams)
  const totalCount = previewData
    ? ('count' in previewData ? previewData.count : (previewData?.length ?? 0))
    : 0

  // Export : tous les incidents filtrés
  const { data: exportData } = useIncidents({
    ...previewParams,
    page: undefined,
    page_size: 9999,
  })
  const allIncidents = exportData?.results ?? exportData ?? []

  const handleExport = async () => {
    setExporting(true)
    try { await exportExcel(allIncidents, typesIncident) }
    finally { setExporting(false) }
  }

  return (
    <>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '1rem' }}>
        <SectionTitle icon={History}>Historique des incidents</SectionTitle>

        {/* Filtres */}
        <div className="space-y-1.5 mb-3">
          <div className="flex gap-1.5">
            <select value={filtres.statut}   onChange={setF('statut')}   style={SEL}>
              <option value="">Tous statuts</option>
              {Object.entries(INCIDENT_STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <select value={filtres.priorite} onChange={setF('priorite')} style={SEL}>
              <option value="">Toutes priorités</option>
              {Object.entries(INCIDENT_PRIORITE).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-1.5">
            <input type="date" value={filtres.dateDebut} onChange={setF('dateDebut')} style={INP} title="Date début" />
            <input type="date" value={filtres.dateFin}   onChange={setF('dateFin')}   style={INP} title="Date fin" />
          </div>
        </div>

        {/* Compteur */}
        <div className="flex items-center justify-between mb-3 px-0.5">
          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Résultats</span>
          <span className="text-sm font-bold" style={{ color: '#00aadd' }}>
            {previewLoading ? '…' : totalCount}
          </span>
        </div>

        {/* Boutons action */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowModal(true)}
            disabled={!totalCount}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold disabled:opacity-40 transition-all"
            style={{
              background: 'rgba(0,170,221,0.12)',
              color: '#00aadd',
              border: '1px solid rgba(0,170,221,0.25)',
            }}
          >
            <Eye className="w-3.5 h-3.5" />
            Afficher
          </button>
          <button
            onClick={handleExport}
            disabled={!totalCount || exporting}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold disabled:opacity-40 transition-all"
            style={{
              background: 'rgba(16,185,129,0.12)',
              color: '#10b981',
              border: '1px solid rgba(16,185,129,0.25)',
            }}
          >
            {exporting
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <FileSpreadsheet className="w-3.5 h-3.5" />}
            Exporter
          </button>
        </div>
      </div>

      {/* Modale */}
      {showModal && (
        <HistoriqueModal
          filtres={filtres}
          typesIncident={typesIncident}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}


// ── Export Excel Interventions ────────────────────────────────
async function exportInterventionsExcel(interventions) {
  const XLSX = await import('xlsx')
  const typeMap = Object.fromEntries(TYPE_TRAVAUX.map(t => [t.value, t.label]))

  const rows = interventions.map(iv => ({
    'ID':             iv.id,
    'Type travaux':   typeMap[iv.type_travaux] || iv.type_travaux || '',
    'Statut':         INTERVENTION_STATUS[iv.statut?.toLowerCase()]?.label || iv.statut || '',
    'Incident #':     iv.incident || '',
    'Équipe':         iv.equipe_detail?.nom || '',
    'Responsable':    iv.responsable_detail?.full_name || '',
    'Date planifiée': iv.date_planifiee
      ? format(new Date(iv.date_planifiee), 'dd/MM/yyyy HH:mm', { locale: fr }) : '',
    'Date début':     iv.date_debut
      ? format(new Date(iv.date_debut), 'dd/MM/yyyy HH:mm', { locale: fr }) : '',
    'Date fin':       iv.date_fin
      ? format(new Date(iv.date_fin), 'dd/MM/yyyy HH:mm', { locale: fr }) : '',
    'Description':    iv.description || '',
    'Rapport':        iv.rapport || '',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 6 }, { wch: 22 }, { wch: 12 }, { wch: 10 },
    { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
    { wch: 30 }, { wch: 30 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Historique interventions')
  XLSX.writeFile(wb, `historique_interventions_${format(new Date(), 'yyyyMMdd')}.xlsx`)
}

// ── Modale Historique Interventions ───────────────────────────
function HistoriqueInterventionsModal({ filtres, onClose }) {
  const [page, setPage] = useState(1)

  const params = {
    statut:              filtres.statut       || undefined,
    type_travaux:        filtres.type_travaux || undefined,
    date_planifiee_after:  filtres.dateDebut  || undefined,
    date_planifiee_before: filtres.dateFin    || undefined,
    page,
  }

  const { data, isLoading, isFetching } = useInterventions(params)

  const isPaginated   = data && 'results' in data
  const interventions = isPaginated ? data.results : (data ?? [])
  const totalCount    = isPaginated ? data.count   : interventions.length
  const totalPages    = Math.ceil(totalCount / 20)

  const typeMap = Object.fromEntries(TYPE_TRAVAUX.map(t => [t.value, t.label]))

  const filtreLabels = [
    filtres.statut       ? INTERVENTION_STATUS[filtres.statut]?.label : null,
    filtres.type_travaux ? typeMap[filtres.type_travaux]              : null,
    filtres.dateDebut    ? `Du ${filtres.dateDebut}`                  : null,
    filtres.dateFin      ? `Au ${filtres.dateFin}`                    : null,
  ].filter(Boolean)

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="flex flex-col w-full max-w-5xl rounded-2xl overflow-hidden"
        style={{
          background: '#0d1b2a',
          border: '1px solid rgba(255,255,255,0.1)',
          maxHeight: '90vh',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
        }}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0"
             style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: '#111f2e' }}>
          <div className="flex items-center gap-2.5">
            <Wrench className="w-4 h-4" style={{ color: '#F59E0B' }} />
            <span className="font-bold text-sm" style={{ color: '#fff' }}>Historique des interventions</span>
            {filtreLabels.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {filtreLabels.map((l, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
                    {l}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isFetching && <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: '#F59E0B' }} />}
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {totalCount} intervention{totalCount > 1 ? 's' : ''}
            </span>
            <button onClick={onClose}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.06)' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tableau */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#F59E0B' }} />
            </div>
          ) : interventions.length === 0 ? (
            <p className="text-center py-16 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Aucune intervention pour ces filtres
            </p>
          ) : (
            <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr style={{ background: '#111f2e' }}>
                  {['#', 'Type travaux', 'Statut', 'Incident', 'Équipe', 'Responsable', 'Planifiée le', 'Début', 'Fin'].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 font-semibold whitespace-nowrap"
                        style={{ color: 'rgba(255,255,255,0.45)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {interventions.map((iv, i) => {
                  const s = INTERVENTION_STATUS[iv.statut?.toLowerCase()]
                  const typeLabel = typeMap[iv.type_travaux] || iv.type_travaux || '—'
                  return (
                    <tr key={iv.id}
                        style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                                 borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.3)' }}>{iv.id}</td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.85)' }}>{typeLabel}</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap"
                              style={{ background: s?.bg, color: s?.hex }}>
                          {s?.label || iv.statut}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        {iv.incident ? `#${iv.incident}` : '—'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.55)' }}>
                        {iv.equipe_detail?.nom || '—'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.55)' }}>
                        {iv.responsable_detail?.full_name || '—'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {iv.date_planifiee
                          ? format(new Date(iv.date_planifiee), 'dd/MM/yy HH:mm', { locale: fr }) : '—'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {iv.date_debut
                          ? format(new Date(iv.date_debut), 'dd/MM/yy HH:mm', { locale: fr }) : '—'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {iv.date_fin
                          ? format(new Date(iv.date_fin), 'dd/MM/yy', { locale: fr }) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 shrink-0"
               style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: '#111f2e' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-30"
                    style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' }}>
              <ChevronLeft className="w-3.5 h-3.5" /> Préc.
            </button>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Page {page} / {totalPages}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-30"
                    style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' }}>
              Suiv. <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Section Historique Interventions (sidebar) ─────────────────
function HistoriqueInterventionsSection() {
  const [filtres, setFiltres]     = useState({ statut: '', type_travaux: '', dateDebut: '', dateFin: '' })
  const [showModal, setShowModal] = useState(false)
  const [exporting, setExporting] = useState(false)

  const setF = (k) => (e) => setFiltres(f => ({ ...f, [k]: e.target.value }))

  const previewParams = {
    statut:              filtres.statut       || undefined,
    type_travaux:        filtres.type_travaux || undefined,
    date_planifiee_after:  filtres.dateDebut  || undefined,
    date_planifiee_before: filtres.dateFin    || undefined,
    page: 1,
  }
  const { data: previewData, isLoading: previewLoading } = useInterventions(previewParams)
  const totalCount = previewData
    ? ('count' in previewData ? previewData.count : (previewData?.length ?? 0))
    : 0

  const { data: exportData } = useInterventions({
    ...previewParams,
    page: undefined,
    page_size: 9999,
  })
  const allInterventions = exportData?.results ?? exportData ?? []

  const handleExport = async () => {
    setExporting(true)
    try { await exportInterventionsExcel(allInterventions) }
    finally { setExporting(false) }
  }

  return (
    <>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '1rem' }}>
        <SectionTitle icon={Wrench}>Historique des interventions</SectionTitle>

        {/* Filtres */}
        <div className="space-y-1.5 mb-3">
          <div className="flex gap-1.5">
            <select value={filtres.statut}       onChange={setF('statut')}       style={SEL}>
              <option value="">Tous statuts</option>
              {Object.entries(INTERVENTION_STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <select value={filtres.type_travaux} onChange={setF('type_travaux')} style={SEL}>
              <option value="">Tous types</option>
              {TYPE_TRAVAUX.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-1.5">
            <input type="date" value={filtres.dateDebut} onChange={setF('dateDebut')} style={INP} title="Date début planifiée" />
            <input type="date" value={filtres.dateFin}   onChange={setF('dateFin')}   style={INP} title="Date fin planifiée" />
          </div>
        </div>

        {/* Compteur */}
        <div className="flex items-center justify-between mb-3 px-0.5">
          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Résultats</span>
          <span className="text-sm font-bold" style={{ color: '#F59E0B' }}>
            {previewLoading ? '…' : totalCount}
          </span>
        </div>

        {/* Boutons action */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowModal(true)}
            disabled={!totalCount}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold disabled:opacity-40 transition-all"
            style={{
              background: 'rgba(245,158,11,0.12)',
              color: '#F59E0B',
              border: '1px solid rgba(245,158,11,0.25)',
            }}
          >
            <Eye className="w-3.5 h-3.5" />
            Afficher
          </button>
          <button
            onClick={handleExport}
            disabled={!totalCount || exporting}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold disabled:opacity-40 transition-all"
            style={{
              background: 'rgba(16,185,129,0.12)',
              color: '#10b981',
              border: '1px solid rgba(16,185,129,0.25)',
            }}
          >
            {exporting
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <FileSpreadsheet className="w-3.5 h-3.5" />}
            Exporter
          </button>
        </div>
      </div>

      {showModal && (
        <HistoriqueInterventionsModal
          filtres={filtres}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}


/* ── Panel principal ────────────────────────────────────────── */
export default function AnalyticsPanel() {
  const { data: stats, isLoading } = useIncidentStats()
  const { data: typesIncident = [] } = useTypeIncidents()
  const { appSlug }               = useParams()
  const { layerGroups }           = useAppLayers(appSlug)
  const [showDashboard, setShowDashboard] = useState(false)

  // Map id → nom pour la section "Par type"
  const typeMap = Object.fromEntries(typesIncident.map(t => [String(t.id), t.nom]))

  // Construire la liste des couches WFS pour le configurateur
  // Après buildLayerGroups : layer.type (pas layer_type), layer.geoserverLayer (camelCase)
  const wfsLayers = []
  if (layerGroups) {
    for (const group of layerGroups) {
      for (const layer of group.layers || []) {
        if (layer.type === 'WFS' && layer.geoserverLayer) {
          wfsLayers.push({
            id:             layer.id,
            name:           layer.name,
            geoserverLayer: layer.geoserverLayer,
            color:          layer.color,
            popupFields:    layer.popupFields || [],
          })
        }
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#8B5CF6' }} />
      </div>
    )
  }

  return (
    <div className="p-3 space-y-4">

      {/* ── Bouton Tableaux de bord ──────────────────────────── */}
      <button
        onClick={() => setShowDashboard(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
        style={{
          background:  'linear-gradient(135deg, rgba(0,170,221,0.15), rgba(0,119,170,0.1))',
          border:      '1px solid rgba(0,170,221,0.3)',
          color:       '#00aadd',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,170,221,0.22)'}
        onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0,170,221,0.15), rgba(0,119,170,0.1))'}
      >
        <LayoutDashboard size={16} />
        Tableaux de bord analytiques
      </button>

      {/* Modal dashboard */}
      {showDashboard && (
        <DashboardModal
          appSlug={appSlug}
          wfsLayers={wfsLayers}
          onClose={() => setShowDashboard(false)}
        />
      )}

      {/* ── KPI principaux ────────────────────────────────── */}
      <section>
        <SectionTitle icon={Activity}>Tableau de bord</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <StatCard icon={AlertTriangle} label="Ouverts"   value={stats?.ouverts}   accent="#FF4757" />
          <StatCard icon={Wrench}        label="En cours"  value={stats?.en_cours}  accent="#F59E0B" />
          <StatCard icon={TrendingUp}    label="Résolus"   value={stats?.resolus}   accent="#10B981" />
          <StatCard icon={Zap}           label="Critiques" value={stats?.critiques} accent="#dc2626" />
        </div>
      </section>

      {/* ── Répartition par priorité ──────────────────────── */}
      {stats?.par_priorite && Object.keys(stats.par_priorite).length > 0 && (
        <section>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '1rem' }}>
            <SectionTitle icon={Activity}>Par priorité</SectionTitle>
            <div className="space-y-2">
              {[
                { key: 'critique', label: 'Critique', color: '#dc2626' },
                { key: 'haute',    label: 'Haute',    color: '#ea580c' },
                { key: 'moyenne',  label: 'Moyenne',  color: '#d97706' },
                { key: 'basse',    label: 'Basse',    color: '#16a34a' },
              ].map(({ key, label, color }) => {
                const val = stats.par_priorite[key] || 0
                const max = Math.max(...Object.values(stats.par_priorite), 1)
                return <BarRow key={key} label={label} value={val} max={max} accent={color} />
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Répartition par type ──────────────────────────── */}
      {stats?.par_type && Object.keys(stats.par_type).length > 0 && (
        <section>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '1rem' }}>
            <SectionTitle icon={BarChart2}>Par type</SectionTitle>
            <div className="space-y-2">
              {Object.entries(stats.par_type)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => {
                  const max = Math.max(...Object.values(stats.par_type), 1)
                  // Résolution dynamique depuis TypeIncident (id ou slug)
                  const label = typeMap[String(type)] || type
                  return (
                    <BarRow key={type} label={label} value={count} max={max} accent="#FF4757" />
                  )
                })}
            </div>
          </div>
        </section>
      )}

      {/* ── Total général ─────────────────────────────────── */}
      {stats?.total > 0 && (
        <section>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '1rem' }}>
            <SectionTitle icon={Users}>Résumé</SectionTitle>
            <KpiRow label="Total incidents" value={stats.total} />
            <KpiRow label="Taux résolution"
              value={stats.total > 0
                ? `${Math.round((stats.resolus / stats.total) * 100)} %`
                : '—'} />
          </div>
        </section>
      )}

      {/* ── Historique des incidents ───────────────────────── */}
      <section>
        <HistoriqueSection />
      </section>

      {/* ── Historique des interventions ───────────────────── */}
      <section>
        <HistoriqueInterventionsSection />
      </section>

    </div>
  )
}
