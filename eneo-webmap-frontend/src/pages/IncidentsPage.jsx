/**
 * IncidentsPage
 * =============
 * Vue tabulaire complète des incidents — accessible via /app/:appSlug/incidents
 *
 * Layout :
 *   ┌─────────────────────────────────────────────┐
 *   │  Stats (Ouverts / En cours / Résolus / ...)  │
 *   │  Barre de filtres (search, statut, priorité) │
 *   │  Tableau paginé                              │
 *   │  Drawer détail (slide-in latéral)            │
 *   └─────────────────────────────────────────────┘
 */

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle, Search, RefreshCw, X, ChevronLeft, ChevronRight,
  MapPin, User, Calendar, ArrowUpDown, ExternalLink,
} from 'lucide-react'
import { useIncidents, useIncidentStats, useUpdateIncident } from '../hooks/useGeoData'
import { usePermissions } from '../hooks/usePermissions'
import { INCIDENT_STATUS, INCIDENT_PRIORITE } from '../config/constants'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import clsx from 'clsx'

// ── Helpers visuels ───────────────────────────────────────────

function StatusBadge({ statut }) {
  const s = INCIDENT_STATUS[statut] || INCIDENT_STATUS.ouvert
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: s.bg, color: s.hex }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.hex }} />
      {s.label}
    </span>
  )
}

function PrioriteBadge({ priorite }) {
  const p = INCIDENT_PRIORITE[priorite] || INCIDENT_PRIORITE.moyenne
  return (
    <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded"
          style={{ background: p.bg, color: p.hex }}>
      {p.label}
    </span>
  )
}

// ── Carte stat ────────────────────────────────────────────────
function StatCard({ label, value, color }) {
  return (
    <div className="flex flex-col items-center justify-center py-3 px-4 rounded-xl"
         style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <span className="text-2xl font-bold" style={{ color }}>{value ?? 0}</span>
      <span className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
    </div>
  )
}

// ── Drawer détail ─────────────────────────────────────────────
function IncidentDrawer({ incident, onClose, appSlug }) {
  const navigate = useNavigate()
  const { mutate: update, isPending } = useUpdateIncident()
  const { canWrite } = usePermissions()

  if (!incident) return null

  const handleStatut = (newStatut) => {
    update({ id: incident.id, data: { statut: newStatut } })
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.5)' }}
           onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md z-50 overflow-y-auto"
           style={{ background: '#0D1B2A', borderLeft: '1px solid rgba(255,255,255,0.08)', boxShadow: '-8px 0 32px rgba(0,0,0,0.4)' }}>

        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-5 py-3 border-b border-white/8"
             style={{ background: '#0D1B2A', zIndex: 1 }}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-white">Incident #{incident.id}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/app/${appSlug}`)}
              title="Voir sur la carte"
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
              style={{ background: 'rgba(0,170,221,0.12)', color: '#00aadd' }}>
              <MapPin className="w-3.5 h-3.5" />
              Carte
            </button>
            <button onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-white/8 text-white/50 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Corps */}
        <div className="p-5 space-y-5">

          {/* Titre + badges */}
          <div>
            <h2 className="text-base font-bold text-white leading-snug mb-2">
              {incident.titre || incident.type_incident_nom || '—'}
            </h2>
            <div className="flex flex-wrap gap-2">
              <StatusBadge statut={incident.statut} />
              <PrioriteBadge priorite={incident.priorite} />
            </div>
          </div>

          {/* Métadonnées */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              { icon: <Calendar className="w-3.5 h-3.5" />, label: 'Signalé le',
                value: incident.date_signalement ? format(new Date(incident.date_signalement), 'dd MMM yyyy HH:mm', { locale: fr }) : '—' },
              { icon: <User className="w-3.5 h-3.5" />, label: 'Signalé par',
                value: incident.signale_par_detail?.full_name || '—' },
              { icon: <User className="w-3.5 h-3.5" />, label: 'Assigné à',
                value: incident.assigne_a_detail?.full_name || 'Non assigné' },
              { icon: <MapPin className="w-3.5 h-3.5" />, label: 'Localisation',
                value: [incident.localisation, incident.ville].filter(Boolean).join(', ') || '—' },
            ].map(({ icon, label, value }) => (
              <div key={label} className="p-3 rounded-lg"
                   style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-1.5 text-white/35 mb-1">{icon}{label}</div>
                <div className="text-white/80 font-medium truncate">{value}</div>
              </div>
            ))}
          </div>

          {/* Description */}
          {incident.description && (
            <div className="p-3 rounded-lg text-xs text-white/60 leading-relaxed"
                 style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
              {incident.description}
            </div>
          )}

          {/* Changement de statut rapide */}
          {canWrite && (
            <div>
              <p className="text-xs text-white/35 mb-2 font-medium">Changer le statut</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(INCIDENT_STATUS).map(([key, s]) => (
                  <button
                    key={key}
                    disabled={incident.statut === key || isPending}
                    onClick={() => handleStatut(key)}
                    className="text-[10px] font-semibold px-3 py-1.5 rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: incident.statut === key ? s.bg : 'rgba(255,255,255,0.05)',
                      color: incident.statut === key ? s.hex : 'rgba(255,255,255,0.5)',
                      border: `1px solid ${incident.statut === key ? s.hex + '40' : 'transparent'}`,
                    }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Interventions liées */}
          {incident.interventions_count > 0 && (
            <div className="p-3 rounded-lg"
                 style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <span className="text-xs text-indigo-300 font-medium">
                {incident.interventions_count} intervention{incident.interventions_count > 1 ? 's' : ''} liée{incident.interventions_count > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Page principale ───────────────────────────────────────────
export default function IncidentsPage() {
  const { appSlug } = useParams()

  const [search,   setSearch]   = useState('')
  const [statut,   setStatut]   = useState('')
  const [priorite, setPriorite] = useState('')
  const [page,     setPage]     = useState(1)
  const [selected, setSelected] = useState(null)

  const PAGE_SIZE = 20

  const params = {
    page,
    page_size: PAGE_SIZE,
    ...(search   && { search }),
    ...(statut   && { statut }),
    ...(priorite && { priorite }),
  }

  const { data, isLoading, isError, refetch } = useIncidents(params)
  const { data: stats }                       = useIncidentStats()

  const incidents = data?.results ?? []
  const total     = data?.count    ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const handleReset = () => {
    setSearch(''); setStatut(''); setPriorite(''); setPage(1)
  }

  const S = { background: '#0D1B2A', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)', colorScheme: 'dark' }

  if (isError) return (
    <div className="h-full flex flex-col items-center justify-center gap-4" style={{ background: '#0F1E2E' }}>
      <AlertTriangle className="w-10 h-10 text-red-400/60" />
      <div className="text-center">
        <p className="text-white/70 font-medium">Impossible de charger les incidents</p>
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
    <div className="h-full overflow-y-auto p-5 space-y-4" style={{ background: '#0F1E2E' }}>

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <h1 className="text-lg font-bold text-white">Incidents</h1>
          {total > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>
              {total}
            </span>
          )}
        </div>
        <button onClick={() => refetch()}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-white/8 text-white/50 hover:text-white">
          <RefreshCw className="w-3.5 h-3.5" />
          Actualiser
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Ouverts"   value={stats.ouverts}   color="#ef4444" />
          <StatCard label="En cours"  value={stats.en_cours}  color="#f59e0b" />
          <StatCard label="Résolus"   value={stats.resolus}   color="#10b981" />
          <StatCard label="Critiques" value={stats.critiques} color="#dc2626" />
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Rechercher…"
            className="w-full text-xs pl-8 pr-3 py-2 rounded-lg outline-none"
            style={S} />
        </div>

        <select value={statut} onChange={e => { setStatut(e.target.value); setPage(1) }}
                className="text-xs px-3 py-2 rounded-lg outline-none" style={S}>
          <option value="">Tous les statuts</option>
          {Object.entries(INCIDENT_STATUS).map(([k, v]) =>
            <option key={k} value={k}>{v.label}</option>)}
        </select>

        <select value={priorite} onChange={e => { setPriorite(e.target.value); setPage(1) }}
                className="text-xs px-3 py-2 rounded-lg outline-none" style={S}>
          <option value="">Toutes priorités</option>
          {Object.entries(INCIDENT_PRIORITE).map(([k, v]) =>
            <option key={k} value={k}>{v.label}</option>)}
        </select>

        {(search || statut || priorite) && (
          <button onClick={handleReset}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-colors text-white/50 hover:text-white hover:bg-white/8">
            <X className="w-3.5 h-3.5" />
            Réinitialiser
          </button>
        )}
      </div>

      {/* Tableau */}
      <div className="rounded-xl overflow-hidden"
           style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
              {['#', 'Titre', 'Priorité', 'Statut', 'Localisation', 'Date', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 font-semibold"
                    style={{ color: 'rgba(255,255,255,0.4)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-white/30">
                  Chargement…
                </td>
              </tr>
            )}
            {!isLoading && incidents.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-white/30">
                  Aucun incident trouvé
                </td>
              </tr>
            )}
            {incidents.map((inc, i) => (
              <tr key={inc.id}
                  onClick={() => setSelected(inc)}
                  className="cursor-pointer transition-colors hover:bg-white/4"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td className="px-4 py-3 text-white/30 font-mono">{inc.id}</td>
                <td className="px-4 py-3 text-white/85 font-medium max-w-[220px] truncate">
                  {inc.titre || '—'}
                </td>
                <td className="px-4 py-3"><PrioriteBadge priorite={inc.priorite} /></td>
                <td className="px-4 py-3"><StatusBadge statut={inc.statut} /></td>
                <td className="px-4 py-3 text-white/40 max-w-[150px] truncate">
                  {inc.ville || inc.localisation || '—'}
                </td>
                <td className="px-4 py-3 text-white/35">
                  {inc.date_signalement
                    ? format(new Date(inc.date_signalement), 'dd MMM yy', { locale: fr })
                    : '—'}
                </td>
                <td className="px-4 py-3 text-white/25">
                  <ExternalLink className="w-3.5 h-3.5" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-white/40">
          <span>{total} incident{total > 1 ? 's' : ''}</span>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-white/8 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-white/60">Page {page} / {totalPages}</span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-white/8 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Drawer */}
      {selected && (
        <IncidentDrawer
          incident={selected}
          appSlug={appSlug}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
