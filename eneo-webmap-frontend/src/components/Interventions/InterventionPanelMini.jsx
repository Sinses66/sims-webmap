import { useState } from 'react'
import {
  Wrench, Plus, Loader2, Clock, User, X,
  Play, CheckSquare, ChevronDown, FileText,
  List, CalendarDays, ChevronLeft, ChevronRight,
} from 'lucide-react'
import {
  useInterventions,
  useCreateIntervention,
  useAssignIntervention,
  useCloturerIntervention,
  useUploadInterventionPhoto,
  useUsers,
  useEquipes,
  useIncidentsSelect,
} from '../../hooks/useGeoData'
import { TYPE_TRAVAUX } from '../../config/constants'
import { usePermissions } from '../../hooks/usePermissions'
import { format, startOfMonth, endOfMonth, eachDayOfInterval,
         startOfWeek, endOfWeek, isSameDay, isSameMonth,
         addMonths, subMonths } from 'date-fns'
import { fr } from 'date-fns/locale'

/* ── Statut styles dark ─────────────────────────────────────── */
const STATUS_COLORS = {
  planifiee: { label: 'Planifiée',   bg: 'rgba(99,102,241,0.18)',  text: '#A5B4FC', dot: '#6366F1' },
  en_cours:  { label: 'En cours',    bg: 'rgba(245,158,11,0.18)',  text: '#FBB040', dot: '#F59E0B' },
  terminee:  { label: 'Terminée',    bg: 'rgba(16,185,129,0.18)',  text: '#34D399', dot: '#10B981' },
  annulee:   { label: 'Annulée',     bg: 'rgba(100,116,139,0.18)', text: '#94A3B8', dot: '#64748B' },
}

function StatutBadge({ statut }) {
  const key = statut?.toLowerCase()
  const c = STATUS_COLORS[key] || STATUS_COLORS.planifiee
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
      style={{ background: c.bg, color: c.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
      {c.label}
    </span>
  )
}

/* ── Zone d'actions inline ──────────────────────────────────── */
function ActionZone({ iv }) {
  const statut = iv.statut?.toLowerCase()
  const canDemarrer = statut === 'planifiee'
  const canCloturer = statut === 'en_cours'

  const { canWrite } = usePermissions()

  const { data: users = [], isLoading: usersLoading } = useUsers()
  const { mutate: assign,      isPending: assigning } = useAssignIntervention()
  const { mutate: cloturer,    isPending: cloturing } = useCloturerIntervention()
  const { mutate: uploadPhoto, isPending: uploading } = useUploadInterventionPhoto()

  const [selectedUser, setSelectedUser] = useState('')
  const [rapport,      setRapport]      = useState('')
  const [photoFile,    setPhotoFile]    = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)

  // Pas d'actions possibles si lecteur ou statut non actionnable
  if (!canWrite || (!canDemarrer && !canCloturer)) return null

  const inputStyle = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.85)',
    borderRadius: '0.5rem',
    padding: '6px 10px',
    fontSize: '0.72rem',
    width: '100%',
    outline: 'none',
  }

  return (
    <div
      className="px-3 py-2.5 space-y-2"
      style={{
        background: canDemarrer ? 'rgba(99,102,241,0.07)' : 'rgba(16,185,129,0.07)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* ── Démarrer l'intervention ── */}
      {canDemarrer && (
        <>
          <p className="text-[10px] font-semibold flex items-center gap-1" style={{ color: '#A5B4FC' }}>
            <Play className="w-3 h-3" /> Démarrer l'intervention
          </p>
          <select
            value={selectedUser}
            onChange={e => setSelectedUser(e.target.value)}
            disabled={usersLoading}
            style={{ background: '#1e2a3a', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)', colorScheme: 'dark', borderRadius: '0.5rem', padding: '6px 10px', fontSize: '0.72rem', width: '100%', outline: 'none' }}
          >
            <option value="">
              {usersLoading ? 'Chargement…' : 'Assigner un responsable *'}
            </option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.fullName || u.username}
              </option>
            ))}
          </select>
          <button
            disabled={!selectedUser || assigning}
            onClick={() => assign({ id: iv.id, userId: Number(selectedUser) })}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-opacity"
            style={{
              background: '#6366F1',
              color: '#fff',
              opacity: (!selectedUser || assigning) ? 0.5 : 1,
              cursor: (!selectedUser || assigning) ? 'not-allowed' : 'pointer',
            }}
          >
            {assigning
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Play className="w-3.5 h-3.5" />}
            Démarrer
          </button>
        </>
      )}

      {/* ── Clôturer l'intervention ── */}
      {canCloturer && (
        <>
          <p className="text-[10px] font-semibold flex items-center gap-1" style={{ color: '#34D399' }}>
            <FileText className="w-3 h-3" /> Clôturer l'intervention
          </p>

          <textarea
            value={rapport}
            onChange={e => setRapport(e.target.value)}
            placeholder="Rapport de clôture (optionnel)…"
            rows={2}
            style={{ ...inputStyle, resize: 'none' }}
          />

          {photoPreview ? (
            <div className="relative rounded-lg overflow-hidden"
                 style={{ border: '1px solid rgba(52,211,153,0.3)' }}>
              <img src={photoPreview} alt="preview"
                   className="w-full object-cover" style={{ maxHeight: 100 }} />
              <button
                onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                className="absolute top-1 right-1 p-0.5 rounded-full"
                style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <label
              className="flex items-center justify-center gap-1.5 text-[11px] py-2 rounded-lg cursor-pointer transition-colors"
              style={{
                border: '1px dashed rgba(52,211,153,0.35)',
                color: 'rgba(52,211,153,0.7)',
                background: 'rgba(16,185,129,0.04)',
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              Photo de clôture (optionnel)
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  setPhotoFile(f)
                  setPhotoPreview(URL.createObjectURL(f))
                }}
              />
            </label>
          )}

          <button
            disabled={cloturing || uploading}
            onClick={() => cloturer(
              { id: iv.id, rapport },
              {
                onSuccess: () => {
                  if (photoFile) uploadPhoto({ id: iv.id, file: photoFile })
                  setPhotoFile(null)
                  setPhotoPreview(null)
                  setRapport('')
                },
              }
            )}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-opacity"
            style={{
              background: '#10B981',
              color: '#fff',
              opacity: (cloturing || uploading) ? 0.5 : 1,
              cursor: (cloturing || uploading) ? 'not-allowed' : 'pointer',
            }}
          >
            {(cloturing || uploading)
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <CheckSquare className="w-3.5 h-3.5" />}
            {uploading ? 'Upload photo…' : 'Clôturer'}
          </button>
        </>
      )}
    </div>
  )
}

/* ── Carte intervention cliquable ───────────────────────────── */
function InterventionCard({ iv }) {
  const [expanded, setExpanded] = useState(false)
  const statut = iv.statut?.toLowerCase()
  const isActionable = statut === 'planifiee' || statut === 'en_cours'

  return (
    <li style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div
        className="px-3 py-2.5 transition-colors"
        style={{ cursor: isActionable ? 'pointer' : 'default' }}
        onClick={() => isActionable && setExpanded(v => !v)}
        onMouseEnter={e => { if (isActionable) e.currentTarget.style.background = 'rgba(245,158,11,0.06)' }}
        onMouseLeave={e => { if (isActionable) e.currentTarget.style.background = 'transparent' }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>
              {iv.type_travaux || 'Intervention'}
            </p>
            {iv.incident && (
              <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Incident #{iv.incident}
              </p>
            )}
            {(iv.equipe_detail?.nom || iv.equipe) && (
              <p className="text-[10px] flex items-center gap-1 mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                <User className="w-3 h-3" /> {iv.equipe_detail?.nom || iv.equipe}
              </p>
            )}
            {iv.date_planifiee && (
              <p className="text-[10px] flex items-center gap-1 mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                <Clock className="w-3 h-3" />
                {format(new Date(iv.date_planifiee), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <StatutBadge statut={iv.statut} />
            {isActionable && (
              <ChevronDown
                className="w-3.5 h-3.5 transition-transform duration-200"
                style={{
                  color: 'rgba(255,255,255,0.35)',
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            )}
          </div>
        </div>
      </div>

      {expanded && <ActionZone iv={iv} />}
    </li>
  )
}

/* ── Formulaire nouvelle intervention ───────────────────────── */
function NewInterventionForm({ onCancel }) {
  const { mutate: create, isPending }                         = useCreateIntervention()
  const { data: incidents = [], isLoading: loadingIncidents } = useIncidentsSelect()
  const { data: equipes   = [], isLoading: loadingEquipes   } = useEquipes()

  const handleSubmit = (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const incidentId = fd.get('incident')
    const equipeId   = fd.get('equipe')
    create({
      incident:       incidentId ? Number(incidentId) : undefined,
      type_travaux:   fd.get('type_travaux'),
      description:    fd.get('description'),
      date_planifiee: fd.get('date_planifiee') || undefined,
      equipe:         equipeId ? Number(equipeId) : undefined,
    }, { onSuccess: onCancel })
  }

  const inputCls = "w-full text-xs px-3 py-2 rounded-lg outline-none transition-colors"
  const inputStyle = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.9)',
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="p-3 space-y-2.5"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(245,158,11,0.05)' }}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold" style={{ color: '#FBB040' }}>
          <Wrench className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
          Nouvelle intervention
        </p>
        <button
          type="button"
          onClick={onCancel}
          style={{ color: 'rgba(255,255,255,0.4)' }}
          onMouseEnter={e => e.currentTarget.style.color = '#fff'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <select name="incident" required className={inputCls}
              style={{ background: '#1e2a3a', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)', colorScheme: 'dark' }}
              disabled={loadingIncidents}>
        <option value="">{loadingIncidents ? 'Chargement…' : 'Incident concerné *'}</option>
        {incidents.map(i => (
          <option key={i.id} value={i.id}>{i.label}</option>
        ))}
      </select>

      <select name="type_travaux" required className={inputCls}
              style={{ background: '#1e2a3a', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)', colorScheme: 'dark' }}>
        <option value="" disabled>Type de travaux *</option>
        {TYPE_TRAVAUX.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <select name="equipe" className={inputCls}
              style={{ background: '#1e2a3a', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)', colorScheme: 'dark' }}
              disabled={loadingEquipes}>
        <option value="">{loadingEquipes ? 'Chargement…' : 'Équipe (optionnel)'}</option>
        {equipes.map(eq => (
          <option key={eq.id} value={eq.id}>{eq.nom}{eq.specialite ? ` — ${eq.specialite}` : ''}</option>
        ))}
      </select>

      <input name="date_planifiee" type="datetime-local"
        className={inputCls} style={{ ...inputStyle, colorScheme: 'dark' }} />
      <textarea name="description" placeholder="Description…" rows={2}
        className={`${inputCls} resize-none`}
        style={{ ...inputStyle, fontSize: '0.75rem' }} />

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
          style={{ background: '#F59E0B', color: '#0D1B2A' }}
          onMouseEnter={e => e.currentTarget.style.background = '#D97706'}
          onMouseLeave={e => e.currentTarget.style.background = '#F59E0B'}
        >
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Planifier
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs px-3 py-2 rounded-lg transition-colors"
          style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
        >
          Annuler
        </button>
      </div>
    </form>
  )
}

/* ── Vue Calendrier ─────────────────────────────────────────── */
const JOURS_SEMAINE = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function CalendrierView() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay,  setSelectedDay]  = useState(null)

  // Charger TOUTES les interventions (sans filtre statut) pour les placer sur le calendrier
  const { data, isLoading } = useInterventions({})
  const allInterventions = data?.results || data || []

  // Construire la grille du mois
  const monthStart = startOfMonth(currentMonth)
  const monthEnd   = endOfMonth(currentMonth)
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd     = endOfWeek(monthEnd,   { weekStartsOn: 1 })
  const calDays    = eachDayOfInterval({ start: calStart, end: calEnd })

  // Index : 'yyyy-MM-dd' → liste d'interventions
  const ivByDay = {}
  allInterventions.forEach(iv => {
    if (!iv.date_planifiee) return
    const key = format(new Date(iv.date_planifiee), 'yyyy-MM-dd')
    if (!ivByDay[key]) ivByDay[key] = []
    ivByDay[key].push(iv)
  })

  const selectedKey = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : null
  const selectedIvs = selectedKey ? (ivByDay[selectedKey] || []) : []

  return (
    <div className="flex flex-col gap-0">

      {/* Navigation mois */}
      <div className="flex items-center justify-between px-3 py-2"
           style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={() => { setCurrentMonth(m => subMonths(m, 1)); setSelectedDay(null) }}
          className="p-1 rounded-lg transition-colors"
          style={{ color: 'rgba(255,255,255,0.5)' }}
          onMouseEnter={e => e.currentTarget.style.color = '#fff'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-semibold capitalize" style={{ color: '#fff' }}>
          {format(currentMonth, 'MMMM yyyy', { locale: fr })}
        </span>
        <button
          onClick={() => { setCurrentMonth(m => addMonths(m, 1)); setSelectedDay(null) }}
          className="p-1 rounded-lg transition-colors"
          style={{ color: 'rgba(255,255,255,0.5)' }}
          onMouseEnter={e => e.currentTarget.style.color = '#fff'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="px-2 pt-2">
        {/* En-têtes jours */}
        <div className="grid grid-cols-7 mb-1">
          {JOURS_SEMAINE.map(j => (
            <div key={j} className="text-center text-[9px] font-bold py-1"
                 style={{ color: 'rgba(255,255,255,0.28)' }}>{j}</div>
          ))}
        </div>

        {/* Grille des jours */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#F59E0B' }} />
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-0.5">
            {calDays.map(day => {
              const key      = format(day, 'yyyy-MM-dd')
              const dayIvs   = ivByDay[key] || []
              const inMonth  = isSameMonth(day, currentMonth)
              const isToday  = isSameDay(day, new Date())
              const isSel    = selectedDay && isSameDay(day, selectedDay)

              return (
                <button
                  key={key}
                  onClick={() => setSelectedDay(d => d && isSameDay(d, day) ? null : day)}
                  className="flex flex-col items-center py-1 rounded-lg transition-all"
                  style={{
                    minHeight: 38,
                    opacity: inMonth ? 1 : 0.25,
                    background: isSel
                      ? 'rgba(245,158,11,0.22)'
                      : isToday
                        ? 'rgba(255,255,255,0.07)'
                        : 'transparent',
                    border: isSel
                      ? '1px solid rgba(245,158,11,0.55)'
                      : isToday
                        ? '1px solid rgba(255,255,255,0.13)'
                        : '1px solid transparent',
                  }}
                >
                  <span
                    className="text-[10px] font-medium leading-tight"
                    style={{ color: isToday ? '#F59E0B' : 'rgba(255,255,255,0.75)' }}
                  >
                    {format(day, 'd')}
                  </span>

                  {/* Dots par statut */}
                  {dayIvs.length > 0 && (
                    <div className="flex gap-0.5 flex-wrap justify-center mt-0.5 px-0.5">
                      {dayIvs.slice(0, 3).map((iv, i) => {
                        const c = STATUS_COLORS[iv.statut?.toLowerCase()]
                        return (
                          <span key={i} className="w-1.5 h-1.5 rounded-full"
                                style={{ background: c?.dot || '#F59E0B' }} />
                        )
                      })}
                      {dayIvs.length > 3 && (
                        <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
                          +{dayIvs.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Légende */}
        <div className="flex gap-3 pt-2 pb-1 flex-wrap">
          {Object.entries(STATUS_COLORS).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: v.dot }} />
              <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)' }}>{v.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Détail du jour sélectionné */}
      {selectedDay && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center justify-between px-3 py-2"
               style={{ background: 'rgba(245,158,11,0.06)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider capitalize"
               style={{ color: 'rgba(255,255,255,0.4)' }}>
              {format(selectedDay, 'EEEE d MMMM', { locale: fr })}
            </p>
            <button onClick={() => setSelectedDay(null)}
                    style={{ color: 'rgba(255,255,255,0.35)' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}>
              <X className="w-3 h-3" />
            </button>
          </div>

          {selectedIvs.length === 0 ? (
            <p className="text-xs text-center py-5" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Aucune intervention ce jour
            </p>
          ) : (
            <ul className="space-y-1.5 px-2 py-2">
              {selectedIvs.map(iv => {
                const c         = STATUS_COLORS[iv.statut?.toLowerCase()]
                const typeLabel = TYPE_TRAVAUX.find(t => t.value === iv.type_travaux)?.label || iv.type_travaux || 'Intervention'
                return (
                  <li key={iv.id}
                      className="px-2.5 py-2 rounded-lg"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>
                        {typeLabel}
                      </span>
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                            style={{ background: c?.bg, color: c?.text }}>
                        {c?.label || iv.statut}
                      </span>
                    </div>
                    {iv.equipe_detail?.nom && (
                      <p className="text-[10px] mt-0.5 flex items-center gap-1"
                         style={{ color: 'rgba(255,255,255,0.4)' }}>
                        <User className="w-3 h-3" /> {iv.equipe_detail.nom}
                      </p>
                    )}
                    {iv.incident && (
                      <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        Incident #{iv.incident}
                      </p>
                    )}
                    {iv.date_planifiee && (
                      <p className="text-[10px] flex items-center gap-1 mt-0.5"
                         style={{ color: 'rgba(255,255,255,0.3)' }}>
                        <Clock className="w-3 h-3" />
                        {format(new Date(iv.date_planifiee), "HH:mm", { locale: fr })}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Panel principal ────────────────────────────────────────── */
export default function InterventionPanelMini() {
  const [showForm,     setShowForm]     = useState(false)
  const [filterStatut, setFilterStatut] = useState('en_cours')
  const [view,         setView]         = useState('list')   // 'list' | 'calendar'

  const { canWrite, isLecteur } = usePermissions()

  const { data, isLoading } = useInterventions({ statut: filterStatut || undefined })
  const interventions = data?.results || data || []

  return (
    <div className="flex flex-col h-full">

      {/* ── Barre d'outils ────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-3 py-2 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(245,158,11,0.06)' }}
      >
        {/* Toggle vue */}
        <div className="flex rounded-lg overflow-hidden shrink-0"
             style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            onClick={() => setView('list')}
            title="Vue liste"
            className="flex items-center justify-center px-2 py-1.5 transition-colors"
            style={{
              background: view === 'list' ? 'rgba(245,158,11,0.25)' : 'transparent',
              color: view === 'list' ? '#F59E0B' : 'rgba(255,255,255,0.4)',
            }}
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { setView('calendar'); setShowForm(false) }}
            title="Vue calendrier"
            className="flex items-center justify-center px-2 py-1.5 transition-colors"
            style={{
              background: view === 'calendar' ? 'rgba(245,158,11,0.25)' : 'transparent',
              color: view === 'calendar' ? '#F59E0B' : 'rgba(255,255,255,0.4)',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <CalendarDays className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Filtre statut — visible seulement en vue liste */}
        {view === 'list' && (
          <select
            value={filterStatut}
            onChange={e => setFilterStatut(e.target.value)}
            className="flex-1 text-xs px-2 py-1.5 rounded-lg outline-none"
            style={{
              background: '#1e2a3a',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.85)',
              colorScheme: 'dark',
            }}
          >
            <option value="">Toutes</option>
            {Object.entries(STATUS_COLORS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        )}

        {/* Bouton Nouvelle — masqué en vue calendrier et pour lecteurs */}
        {view === 'list' && canWrite && (
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
            style={{ background: '#F59E0B', color: '#0D1B2A' }}
            onMouseEnter={e => e.currentTarget.style.background = '#D97706'}
            onMouseLeave={e => e.currentTarget.style.background = '#F59E0B'}
          >
            <Plus className="w-3.5 h-3.5" />
            Nouvelle
          </button>
        )}
        {/* Badge lecture seule */}
        {isLecteur && view === 'list' && (
          <span className="text-[9px] px-1.5 py-0.5 rounded shrink-0"
                style={{ background: 'rgba(107,114,128,0.2)', color: 'rgba(255,255,255,0.35)' }}>
            Lecture
          </span>
        )}
      </div>

      {/* ── Vue calendrier ────────────────────────────────── */}
      {view === 'calendar' && (
        <div className="flex-1 overflow-y-auto"
             style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
          <CalendrierView />
        </div>
      )}

      {/* ── Vue liste ─────────────────────────────────────── */}
      {view === 'list' && (
        <>
          {showForm && <NewInterventionForm onCancel={() => setShowForm(false)} />}

          {!showForm && interventions.length > 0 && (
            <p className="text-[10px] text-center py-1 shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Cliquer sur une intervention pour démarrer ou clôturer
            </p>
          )}

          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#F59E0B' }} />
            </div>
          ) : interventions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(245,158,11,0.12)' }}
              >
                <Wrench className="w-6 h-6" style={{ color: '#F59E0B' }} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  Aucune intervention
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {filterStatut ? STATUS_COLORS[filterStatut]?.label : 'Toutes'}
                </p>
              </div>
            </div>
          ) : (
            <ul
              className="overflow-y-auto flex-1"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
            >
              {interventions.map(iv => (
                <InterventionCard key={iv.id} iv={iv} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
