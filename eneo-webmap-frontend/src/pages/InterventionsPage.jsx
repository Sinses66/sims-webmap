/**
 * InterventionsPage
 * =================
 * Vue tabulaire complète des interventions — accessible via /app/:appSlug/interventions
 *
 * Layout :
 *   ┌──────────────────────────────────────────────────────┐
 *   │  Stats (Planifiées / En cours / Terminées / Annulées) │
 *   │  Barre de filtres (search, statut, type travaux)      │
 *   │  Tableau paginé                                       │
 *   │  Drawer détail (slide-in latéral)                     │
 *   └──────────────────────────────────────────────────────┘
 */

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Wrench, Search, RefreshCw, X, ChevronLeft, ChevronRight,
  User, Calendar, Clock, FileText, AlertTriangle, CheckCircle2,
  PlayCircle, XCircle, ExternalLink,
} from 'lucide-react'
import {
  useInterventions,
  useAssignIntervention,
  useCloturerIntervention,
} from '../hooks/useGeoData'
import { usePermissions } from '../hooks/usePermissions'
import { INTERVENTION_STATUS, TYPE_TRAVAUX } from '../config/constants'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import clsx from 'clsx'

// ── Helpers visuels ───────────────────────────────────────────

function StatusBadge({ statut }) {
  const s = INTERVENTION_STATUS[statut] || INTERVENTION_STATUS.planifiee
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.hex }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.hex }} />
      {s.label}
    </span>
  )
}

function TypeBadge({ type }) {
  const found = TYPE_TRAVAUX.find(t => t.value === type)
  return (
    <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded
                     bg-indigo-500/15 text-indigo-300">
      {found?.label ?? type ?? '—'}
    </span>
  )
}

// ── Carte stat ────────────────────────────────────────────────

function StatCard({ label, value, color, icon: Icon, loading }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl border"
      style={{ background: '#0D1B2A', borderColor: `${color}25` }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${color}15` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div>
        <p className="text-xs text-white/40">{label}</p>
        {loading
          ? <div className="mt-1 h-5 w-8 rounded bg-white/10 animate-pulse" />
          : <p className="text-xl font-bold text-white leading-tight">{value ?? '—'}</p>
        }
      </div>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────

export default function InterventionsPage() {
  const { appSlug }  = useParams()
  const navigate     = useNavigate()
  const { canEdit }  = usePermissions()

  // Filtres
  const [search,  setSearch]  = useState('')
  const [statut,  setStatut]  = useState('')
  const [typeT,   setTypeT]   = useState('')
  const [page,    setPage]    = useState(1)

  // Drawer
  const [selected, setSelected] = useState(null)

  // Requêtes
  const params = {
    ...(search  && { search }),
    ...(statut  && { statut }),
    ...(typeT   && { type_travaux: typeT }),
    page,
  }
  const { data, isLoading, isFetching, isError, refetch } = useInterventions(params)

  const interventions = data?.results ?? (Array.isArray(data) ? data : [])
  const totalCount    = data?.count   ?? interventions.length
  const totalPages    = data?.count   ? Math.ceil(data.count / 20) : 1

  // Mutations
  const assignMutation   = useAssignIntervention()
  const clotureMutation  = useCloturerIntervention()

  // Stats calculées depuis les données courantes (page visible)
  const statsCalc = {
    planifiee: interventions.filter(i => i.statut === 'planifiee').length,
    en_cours:  interventions.filter(i => i.statut === 'en_cours').length,
    terminee:  interventions.filter(i => i.statut === 'terminee').length,
    annulee:   interventions.filter(i => i.statut === 'annulee').length,
  }

  const handleReset = () => {
    setSearch(''); setStatut(''); setTypeT(''); setPage(1)
  }

  const fmtDate = (d) => {
    if (!d) return '—'
    try { return format(new Date(d), 'dd MMM yyyy HH:mm', { locale: fr }) }
    catch { return d }
  }

  if (isError) return (
    <div className="h-full flex flex-col items-center justify-center gap-4" style={{ background: '#0F1E2E' }}>
      <Wrench className="w-10 h-10 text-red-400/60" />
      <div className="text-center">
        <p className="text-white/70 font-medium">Impossible de charger les interventions</p>
        <p className="text-white/35 text-sm mt-1">Vérifiez votre connexion ou contactez l'administrateur.</p>
      </div>
      <button
        onClick={() => refetch()}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        style={{ background: 'rgba(0,170,221,0.15)', color: '#00aadd' }}
      >
        <RefreshCw className="w-4 h-4" />
        Réessayer
      </button>
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#0F1E2E' }}>

      {/* ── En-tête ── */}
      <div className="shrink-0 px-5 pt-5 pb-4 border-b border-white/6">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => navigate(`/app/${appSlug}`)}
            className="p-1.5 rounded-lg hover:bg-white/8 text-white/35 hover:text-white/70 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <Wrench className="w-5 h-5 text-indigo-400" />
          <h1 className="text-lg font-bold text-white">Interventions</h1>
          <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-medium
                           bg-indigo-500/15 text-indigo-300">
            {isFetching ? '…' : totalCount}
          </span>
          <div className="flex-1" />
          <button
            onClick={() => refetch()}
            className="p-1.5 rounded-lg hover:bg-white/8 text-white/35 hover:text-white transition-colors"
            title="Actualiser"
          >
            <RefreshCw className={clsx('w-4 h-4', isFetching && 'animate-spin')} />
          </button>
        </div>
        <p className="text-xs text-white/30 pl-10">
          Suivi des opérations terrain — {fmtDate(new Date())}
        </p>
      </div>

      {/* ── Stats ── */}
      <div className="shrink-0 px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Planifiées"  value={statsCalc.planifiee} color="#6366f1" icon={Clock}         loading={isLoading} />
        <StatCard label="En cours"    value={statsCalc.en_cours}  color="#f59e0b" icon={PlayCircle}    loading={isLoading} />
        <StatCard label="Terminées"   value={statsCalc.terminee}  color="#10b981" icon={CheckCircle2}  loading={isLoading} />
        <StatCard label="Annulées"    value={statsCalc.annulee}   color="#6b7280" icon={XCircle}       loading={isLoading} />
      </div>

      {/* ── Filtres ── */}
      <div className="shrink-0 px-5 pb-4 flex flex-wrap gap-2">
        {/* Recherche */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10
                        bg-white/4 text-white/60 flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Rechercher…"
            className="bg-transparent outline-none text-sm text-white placeholder-white/30 w-full"
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(1) }}>
              <X className="w-3.5 h-3.5 hover:text-white" />
            </button>
          )}
        </div>

        {/* Statut */}
        <select
          value={statut}
          onChange={e => { setStatut(e.target.value); setPage(1) }}
          className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/4 text-sm
                     text-white/70 outline-none cursor-pointer"
          style={{ background: '#0D1B2A' }}
        >
          <option value="">Tous les statuts</option>
          {Object.entries(INTERVENTION_STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        {/* Type travaux */}
        <select
          value={typeT}
          onChange={e => { setTypeT(e.target.value); setPage(1) }}
          className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/4 text-sm
                     text-white/70 outline-none cursor-pointer"
          style={{ background: '#0D1B2A' }}
        >
          <option value="">Tous les types</option>
          {TYPE_TRAVAUX.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        {(search || statut || typeT) && (
          <button
            onClick={handleReset}
            className="px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white
                       hover:bg-white/8 border border-white/10 transition-colors"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* ── Corps : tableau + drawer ── */}
      <div className="flex-1 overflow-hidden flex">

        {/* Tableau */}
        <div className={clsx('flex-1 overflow-auto', selected && 'hidden lg:block')}>
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-white/30 text-sm">
              Chargement…
            </div>
          ) : interventions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-white/25">
              <Wrench className="w-8 h-8 mb-2" />
              <p className="text-sm">Aucune intervention trouvée</p>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs text-white/30 border-b border-white/6"
                    style={{ background: '#0D1B2A' }}>
                  <th className="px-4 py-3 font-medium w-12">#</th>
                  <th className="px-4 py-3 font-medium">Titre / Incident</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Responsable</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">Planifiée le</th>
                  <th className="px-4 py-3 font-medium hidden xl:table-cell">Clôturée le</th>
                </tr>
              </thead>
              <tbody>
                {interventions.map((interv, idx) => (
                  <tr
                    key={interv.id}
                    onClick={() => setSelected(interv)}
                    className={clsx(
                      'border-b border-white/4 cursor-pointer transition-colors',
                      selected?.id === interv.id
                        ? 'bg-indigo-500/10'
                        : idx % 2 === 0 ? 'hover:bg-white/3' : 'bg-white/[0.02] hover:bg-white/4',
                    )}
                  >
                    <td className="px-4 py-3 text-white/30 font-mono text-xs">{interv.id}</td>
                    <td className="px-4 py-3 max-w-[240px]">
                      <p className="text-white font-medium truncate">
                        {interv.titre || `Intervention #${interv.id}`}
                      </p>
                      {interv.incident_details?.titre && (
                        <p className="text-xs text-white/35 truncate mt-0.5 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0 text-amber-400/60" />
                          {interv.incident_details.titre}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3"><TypeBadge type={interv.type_travaux} /></td>
                    <td className="px-4 py-3"><StatusBadge statut={interv.statut} /></td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-white/55 text-xs">
                        {interv.responsable_details?.username
                          || interv.responsable_details?.first_name
                          || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-white/40 text-xs">
                      {interv.date_planifiee ? fmtDate(interv.date_planifiee) : '—'}
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell text-white/40 text-xs">
                      {interv.date_cloture ? fmtDate(interv.date_cloture) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/6">
              <span className="text-xs text-white/30">
                Page {page} / {totalPages} — {totalCount} résultat{totalCount > 1 ? 's' : ''}
              </span>
              <div className="flex gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white
                             disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white
                             disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Drawer détail ── */}
        {selected && (
          <div
            className="w-full lg:w-96 shrink-0 border-l border-white/8 flex flex-col overflow-hidden"
            style={{ background: '#0D1B2A' }}
          >
            {/* Header drawer */}
            <div className="px-4 py-3 border-b border-white/8 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge statut={selected.statut} />
                  <TypeBadge type={selected.type_travaux} />
                </div>
                <p className="text-white font-semibold mt-1.5 leading-snug">
                  {selected.titre || `Intervention #${selected.id}`}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-1.5 rounded-lg hover:bg-white/8 text-white/35 hover:text-white
                           transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Corps drawer */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">

              {/* Incident lié */}
              {selected.incident_details && (
                <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                  <p className="text-xs text-amber-400/60 font-medium mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Incident lié
                  </p>
                  <p className="text-sm text-white/80">{selected.incident_details.titre}</p>
                  <button
                    onClick={() => navigate(`/app/${appSlug}/incidents`)}
                    className="mt-1.5 text-xs text-amber-400/60 hover:text-amber-300 flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" /> Voir l'incident
                  </button>
                </div>
              )}

              {/* Grille métadonnées */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    icon: Calendar,
                    label: 'Planifiée le',
                    value: selected.date_planifiee ? fmtDate(selected.date_planifiee) : '—',
                  },
                  {
                    icon: CheckCircle2,
                    label: 'Clôturée le',
                    value: selected.date_cloture ? fmtDate(selected.date_cloture) : '—',
                  },
                  {
                    icon: User,
                    label: 'Responsable',
                    value: selected.responsable_details?.username
                        || selected.responsable_details?.first_name
                        || '—',
                  },
                  {
                    icon: Clock,
                    label: 'Durée estimée',
                    value: selected.duree_estimee ? `${selected.duree_estimee} h` : '—',
                  },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="p-2.5 rounded-lg bg-white/4 border border-white/6">
                    <p className="text-[10px] text-white/35 flex items-center gap-1 mb-1">
                      <Icon className="w-3 h-3" />{label}
                    </p>
                    <p className="text-xs text-white/80 font-medium truncate">{value}</p>
                  </div>
                ))}
              </div>

              {/* Description / Rapport */}
              {selected.description && (
                <div>
                  <p className="text-xs text-white/35 font-medium mb-1.5 flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Description
                  </p>
                  <p className="text-sm text-white/60 leading-relaxed bg-white/3 rounded-lg
                                px-3 py-2.5 border border-white/6">
                    {selected.description}
                  </p>
                </div>
              )}

              {selected.rapport && (
                <div>
                  <p className="text-xs text-white/35 font-medium mb-1.5 flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Rapport de clôture
                  </p>
                  <p className="text-sm text-white/60 leading-relaxed bg-white/3 rounded-lg
                                px-3 py-2.5 border border-white/6">
                    {selected.rapport}
                  </p>
                </div>
              )}

              {/* Actions rapides */}
              {canEdit && (
                <div>
                  <p className="text-xs text-white/30 font-medium mb-2">Actions rapides</p>
                  <div className="flex flex-col gap-2">
                    {selected.statut === 'planifiee' && (
                      <button
                        disabled={assignMutation.isPending}
                        onClick={() => assignMutation.mutate(
                          { id: selected.id, userId: selected.responsable },
                          { onSuccess: () => setSelected(s => ({ ...s, statut: 'en_cours' })) },
                        )}
                        className="w-full py-2 rounded-lg text-sm font-medium transition-colors
                                   bg-amber-500/15 text-amber-300 hover:bg-amber-500/25
                                   disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <PlayCircle className="w-4 h-4" />
                        {assignMutation.isPending ? 'Démarrage…' : 'Démarrer'}
                      </button>
                    )}
                    {selected.statut === 'en_cours' && (
                      <button
                        disabled={clotureMutation.isPending}
                        onClick={() => clotureMutation.mutate(
                          { id: selected.id, rapport: '' },
                          { onSuccess: () => setSelected(s => ({ ...s, statut: 'terminee' })) },
                        )}
                        className="w-full py-2 rounded-lg text-sm font-medium transition-colors
                                   bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25
                                   disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {clotureMutation.isPending ? 'Clôture…' : 'Clôturer'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
