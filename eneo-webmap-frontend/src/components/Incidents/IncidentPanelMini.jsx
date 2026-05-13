import { useState, useEffect, useRef } from 'react'
import {
  AlertTriangle, Plus, Loader2, RefreshCw, X,
  MapPin, User, Zap, Map, Download, UserCheck, CheckCircle2, ChevronDown,
  Search, Building2, PlusCircle, Camera, Wrench, Clock, FileText, Pencil, Save,
} from 'lucide-react'
import {
  useIncidents, useIncident, useCreateIncident, useUpdateIncident, useIncidentStats,
  useAssignIncident, useResolveIncident, useUsers,
  useTypeIncidents, useUploadIncidentPhoto,
  useOuvrageByCode, useCreateOuvrage, useTypeOuvrages,
} from '../../hooks/useGeoData'
import { INCIDENT_STATUS, INCIDENT_PRIORITE } from '../../config/constants'
import { useMapStore } from '../../store/mapStore'
import { usePermissions } from '../../hooks/usePermissions'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import clsx from 'clsx'


// ── Styles partagés ───────────────────────────────────────────
const INPUT_STYLE = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: 'rgba(255,255,255,0.9)',
}
// Les <select> natifs ignorent les fonds transparents → fond sombre solide obligatoire
const SELECT_STYLE = {
  background: '#1e2a3a',
  border: '1px solid rgba(255,255,255,0.15)',
  color: 'rgba(255,255,255,0.9)',
  colorScheme: 'dark',
}
const INPUT_CLS = 'w-full text-xs px-3 py-2 rounded-lg outline-none transition-colors'


// ── Badge statut ──────────────────────────────────────────────
function StatusBadge({ statut }) {
  const s = INCIDENT_STATUS[statut] || INCIDENT_STATUS.ouvert
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
          style={{ background: s.bg, color: s.hex }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.hex }} />
      {s.label}
    </span>
  )
}

// ── Badge priorité ────────────────────────────────────────────
function PrioriteBadge({ priorite }) {
  const p = INCIDENT_PRIORITE[priorite] || INCIDENT_PRIORITE.moyenne
  return (
    <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
          style={{ background: p.bg, color: p.hex }}>
      {p.label}
    </span>
  )
}

// ── Stats globales ────────────────────────────────────────────
function StatsBar() {
  const { data: stats } = useIncidentStats()
  if (!stats) return null
  const items = [
    { label: 'Ouverts',   value: stats.ouverts,   color: '#ef4444' },
    { label: 'En cours',  value: stats.en_cours,  color: '#f59e0b' },
    { label: 'Résolus',   value: stats.resolus,   color: '#10b981' },
    { label: 'Critiques', value: stats.critiques, color: '#dc2626' },
  ]
  return (
    <div className="grid grid-cols-4 gap-px shrink-0"
         style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.2)' }}>
      {items.map(({ label, value, color }) => (
        <div key={label} className="flex flex-col items-center py-2">
          <span className="text-base font-bold leading-none" style={{ color }}>{value ?? 0}</span>
          <span className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</span>
        </div>
      ))}
    </div>
  )
}


// ── Statut badge intervention ─────────────────────────────────
const IV_STATUS = {
  planifiee: { label: 'Planifiée',  hex: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  en_cours:  { label: 'En cours',   hex: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  cloturee:  { label: 'Clôturée',   hex: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  annulee:   { label: 'Annulée',    hex: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
}
function IVBadge({ statut }) {
  const s = IV_STATUS[statut] || IV_STATUS.planifiee
  return (
    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
          style={{ background: s.bg, color: s.hex }}>{s.label}</span>
  )
}


// ── Zone upload photo ─────────────────────────────────────────
function PhotoUploadZone({ incId }) {
  const { mutate: upload, isPending } = useUploadIncidentPhoto()
  const [legende, setLegende]         = useState('')
  const [preview, setPreview]         = useState(null)
  const [file, setFile]               = useState(null)
  const [dragging, setDragging]       = useState(false)
  const inputRef                      = useRef(null)

  const handleFile = (f) => {
    if (!f || !f.type.startsWith('image/')) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleSubmit = () => {
    if (!file) return
    upload(
      { id: incId, file, legende },
      {
        onSuccess: () => {
          setFile(null)
          setPreview(null)
          setLegende('')
          if (inputRef.current) inputRef.current.value = ''
        },
      }
    )
  }

  return (
    <div className="mt-3 space-y-2">
      {/* Zone de dépôt */}
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        className="relative cursor-pointer rounded-lg transition-all"
        style={{
          border: `2px dashed ${dragging ? '#00AADD' : preview ? 'rgba(0,170,221,0.3)' : 'rgba(255,255,255,0.15)'}`,
          background: dragging ? 'rgba(0,170,221,0.06)' : 'rgba(255,255,255,0.03)',
        }}
      >
        {preview ? (
          <div className="relative">
            <img src={preview} alt="preview"
                 className="w-full h-32 object-cover rounded-lg" />
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setFile(null); setPreview(null) }}
              className="absolute top-1.5 right-1.5 rounded-full p-0.5"
              style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-5 gap-1.5">
            <Camera className="w-6 h-6" style={{ color: 'rgba(255,255,255,0.2)' }} />
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Glisser une photo ou <span style={{ color: '#00AADD' }}>cliquer pour parcourir</span>
            </p>
            <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
              JPG, PNG, WEBP — max 10 Mo
            </p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => handleFile(e.target.files[0])}
        />
      </div>

      {/* Légende + bouton envoyer */}
      {file && (
        <div className="flex gap-1.5">
          <input
            value={legende}
            onChange={e => setLegende(e.target.value)}
            placeholder="Légende (optionnel)"
            className="flex-1 text-[11px] px-2.5 py-1.5 rounded-lg outline-none"
            style={INPUT_STYLE}
          />
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-lg shrink-0 disabled:opacity-50"
            style={{ background: '#00AADD', color: '#0D1B2A' }}
          >
            {isPending
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <Plus className="w-3 h-3" />}
            Envoyer
          </button>
        </div>
      )}
    </div>
  )
}


// ── Formulaire de modification d'un incident ──────────────────
function IncidentEditForm({ inc, onCancel }) {
  const { mutate: update, isPending }                          = useUpdateIncident()
  const { data: typesIncident = [], isLoading: loadingTypes } = useTypeIncidents()
  const [ouvrageId, setOuvrageId]                             = useState(inc.ouvrage ?? null)

  const [form, setForm] = useState({
    titre:         inc.titre         || '',
    type_incident: inc.type_incident || '',
    priorite:      inc.priorite      || 'moyenne',
    statut:        inc.statut        || 'ouvert',
    description:   inc.description  || '',
    localisation:  inc.localisation  || '',
    quartier:      inc.quartier      || '',
    ville:         inc.ville         || '',
    latitude:      inc.latitude      ?? '',
    longitude:     inc.longitude     ?? '',
  })

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.titre.trim()) return
    const payload = {
      ...form,
      latitude:  form.latitude  !== '' ? Number(form.latitude)  : null,
      longitude: form.longitude !== '' ? Number(form.longitude) : null,
      ouvrage:   ouvrageId ?? null,
    }
    update({ id: inc.id, data: payload }, { onSuccess: onCancel })
  }

  return (
    <form onSubmit={handleSubmit} className="px-3 py-2.5 space-y-2"
          style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>

      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide"
           style={{ color: 'rgba(255,255,255,0.4)' }}>
          <Pencil className="inline w-3 h-3 mr-1 -mt-0.5" />
          Modifier l'incident
        </p>
        <button type="button" onClick={onCancel} style={{ color: 'rgba(255,255,255,0.3)' }}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Titre */}
      <input required value={form.titre} onChange={set('titre')}
             placeholder="Titre *" className={INPUT_CLS} style={INPUT_STYLE} />

      {/* Type + Priorité */}
      <div className="flex gap-2">
        <select value={form.type_incident} onChange={set('type_incident')}
                className={INPUT_CLS} style={SELECT_STYLE} disabled={loadingTypes}>
          <option value="">{loadingTypes ? 'Chargement…' : 'Type d\'incident'}</option>
          {typesIncident.map(t => (
            <option key={t.id} value={t.id}>{t.icone} {t.nom}</option>
          ))}
        </select>
        <select value={form.priorite} onChange={set('priorite')}
                className={`${INPUT_CLS} w-28`} style={SELECT_STYLE}>
          {Object.entries(INCIDENT_PRIORITE).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Statut */}
      <select value={form.statut} onChange={set('statut')}
              className={INPUT_CLS} style={SELECT_STYLE}>
        {Object.entries(INCIDENT_STATUS).map(([k, v]) => (
          <option key={k} value={k}>{v.label}</option>
        ))}
      </select>

      {/* Ouvrage */}
      <OuvrageSection
        codeInit={inc.ouvrage_detail?.code || ''}
        nomInit={inc.ouvrage_detail?.nom || ''}
        typeOuvrageIdInit={null}
        onOuvrageChange={setOuvrageId}
      />

      {/* Localisation */}
      <div className="flex gap-2">
        <input value={form.localisation} onChange={set('localisation')}
               placeholder="Localisation" className={INPUT_CLS} style={INPUT_STYLE} />
        <input value={form.quartier} onChange={set('quartier')}
               placeholder="Quartier" className={`${INPUT_CLS} w-24`} style={INPUT_STYLE} />
      </div>
      <input value={form.ville} onChange={set('ville')}
             placeholder="Ville" className={INPUT_CLS} style={INPUT_STYLE} />

      {/* Description */}
      <textarea value={form.description} onChange={set('description')}
                placeholder="Description" rows={2}
                className={`${INPUT_CLS} resize-none`}
                style={{ ...INPUT_STYLE, fontSize: '0.75rem' }} />

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={isPending || !form.titre.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-40"
                style={{ background: '#00AADD', color: '#0D1B2A' }}>
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Enregistrer
        </button>
        <button type="button" onClick={onCancel}
                className="text-xs px-3 py-2 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' }}>
          Annuler
        </button>
      </div>
    </form>
  )
}


// ── Zone détail complet d'un incident ─────────────────────────
function IncidentDetail({ incId, onClose }) {
  const { data: inc, isLoading } = useIncident(incId)
  const { data: users = [], isLoading: loadingUsers } = useUsers()
  const { mutate: assign, isPending: assigning }      = useAssignIncident()
  const { mutate: resolve, isPending: resolving }     = useResolveIncident()
  const [selectedUserId, setSelectedUserId]           = useState('')
  const [activeTab, setActiveTab]                     = useState('infos')
  const [editing, setEditing]                         = useState(false)
  const { canWrite }                                  = usePermissions()

  if (isLoading) return (
    <div className="flex items-center justify-center py-6">
      <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#FF4757' }} />
    </div>
  )
  if (!inc) return null

  const canAct = !['resolu', 'ferme', 'annule'].includes(inc.statut)

  const handleAssign = () => {
    if (!selectedUserId) return
    assign({ id: inc.id, userId: Number(selectedUserId) })
  }
  const handleResolve = () => resolve(inc.id, { onSuccess: onClose })

  const tabs = [
    { id: 'infos',         label: 'Infos',         icon: FileText },
    { id: 'interventions', label: `Interv. (${inc.interventions?.length ?? 0})`, icon: Wrench },
    { id: 'photos',        label: `Photos (${inc.photos?.length ?? 0})`,         icon: Camera },
  ]

  return (
    <div style={{ borderTop: '1px solid rgba(255,71,87,0.2)', background: 'rgba(255,71,87,0.03)' }}>

      {/* Onglets + bouton Modifier */}
      <div className="flex border-b items-center" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setActiveTab(id); setEditing(false) }}
            className="flex-1 flex items-center justify-center gap-1 text-[10px] py-2 transition-colors"
            style={{
              color:        activeTab === id && !editing ? '#FF4757' : 'rgba(255,255,255,0.35)',
              borderBottom: activeTab === id && !editing ? '2px solid #FF4757' : '2px solid transparent',
              fontWeight:   activeTab === id && !editing ? 600 : 400,
            }}>
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
        {/* Bouton Modifier — masqué pour les lecteurs */}
        {canWrite && (
          <button
            onClick={() => { setEditing(v => !v); setActiveTab('infos') }}
            title={editing ? 'Annuler la modification' : 'Modifier l\'incident'}
            className="px-2.5 py-2 shrink-0 transition-colors"
            style={{
              color:        editing ? '#00AADD' : 'rgba(255,255,255,0.3)',
              borderBottom: editing ? '2px solid #00AADD' : '2px solid transparent',
              borderLeft:   '1px solid rgba(255,255,255,0.07)',
            }}>
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── Mode édition ── */}
      {editing && inc && (
        <IncidentEditForm inc={inc} onCancel={() => setEditing(false)} />
      )}

      {/* ── Tab Infos ── */}
      {!editing && activeTab === 'infos' && (
        <div className="px-3 py-2.5 space-y-2.5">

          {/* Ouvrage lié */}
          {inc.ouvrage_detail && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                 style={{ background: 'rgba(0,170,221,0.08)', border: '1px solid rgba(0,170,221,0.2)' }}>
              <Building2 className="w-3 h-3 shrink-0" style={{ color: '#00AADD' }} />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold truncate" style={{ color: '#00AADD' }}>
                  {inc.ouvrage_detail.nom || inc.ouvrage_detail.code}
                </p>
                <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {inc.ouvrage_detail.type_nom} · {inc.ouvrage_detail.code}
                </p>
              </div>
            </div>
          )}

          {/* Description */}
          {inc.description && (
            <div>
              <p className="text-[9px] uppercase tracking-wide mb-1"
                 style={{ color: 'rgba(255,255,255,0.3)' }}>Description</p>
              <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {inc.description}
              </p>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {[
              { label: 'Signalé le',    val: inc.date_signalement },
              { label: 'Pris en charge',val: inc.date_prise_charge },
              { label: 'Résolu le',     val: inc.date_resolution },
            ].filter(d => d.val).map(({ label, val }) => (
              <div key={label}>
                <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</p>
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {format(new Date(val), 'dd MMM yyyy HH:mm', { locale: fr })}
                </p>
              </div>
            ))}
          </div>

          {/* Localisation */}
          {(inc.localisation || inc.quartier || inc.ville) && (
            <div className="flex items-start gap-1.5">
              <MapPin className="w-3 h-3 mt-0.5 shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} />
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {[inc.localisation, inc.quartier, inc.ville].filter(Boolean).join(', ')}
              </p>
            </div>
          )}

          {/* Signalé par */}
          {inc.signale_par_detail && (
            <div className="flex items-center gap-1.5">
              <User className="w-3 h-3 shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} />
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Signalé par <span style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {inc.signale_par_detail.full_name}
                </span>
              </p>
            </div>
          )}

          {/* ── Actions — masquées pour les lecteurs ── */}
          {canAct && canWrite && (
            <div className="space-y-2 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>

              {/* Assigner */}
              <div className="flex gap-1.5">
                {loadingUsers ? (
                  <div className="flex-1 flex items-center justify-center py-1">
                    <Loader2 className="w-3 h-3 animate-spin" style={{ color: '#00AADD' }} />
                  </div>
                ) : (
                  <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}
                          className="flex-1 text-xs px-2 py-1.5 rounded-lg outline-none" style={SELECT_STYLE}>
                    <option value="">— Assigner à —</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.fullName}{u.role ? ` · ${u.role}` : ''}</option>
                    ))}
                  </select>
                )}
                <button onClick={handleAssign} disabled={!selectedUserId || assigning}
                        className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg shrink-0 disabled:opacity-40"
                        style={{ background: '#00AADD', color: '#0D1B2A' }}>
                  {assigning ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
                  OK
                </button>
              </div>
              {inc.assigne_a_detail && (
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Assigné à : <span style={{ color: 'rgba(255,255,255,0.6)' }}>{inc.assigne_a_detail.full_name}</span>
                </p>
              )}

              {/* Résoudre */}
              <button onClick={handleResolve} disabled={resolving}
                      className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-40"
                      style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>
                {resolving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Marquer comme résolu
              </button>
            </div>
          )}
          {/* Assigné à — toujours visible même pour lecteur */}
          {(!canAct || !canWrite) && inc.assigne_a_detail && (
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Assigné à : <span style={{ color: 'rgba(255,255,255,0.6)' }}>{inc.assigne_a_detail.full_name}</span>
            </p>
          )}
          {!canAct && (
            <p className="text-[10px] text-center py-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Incident {inc.statut_label} — aucune action disponible
            </p>
          )}
        </div>
      )}

      {/* ── Tab Interventions ── */}
      {!editing && activeTab === 'interventions' && (
        <div className="px-3 py-2.5">
          {!inc.interventions?.length ? (
            <div className="text-center py-4">
              <Wrench className="w-6 h-6 mx-auto mb-2" style={{ color: 'rgba(255,255,255,0.15)' }} />
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Aucune intervention</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {inc.interventions.map(iv => (
                <li key={iv.id} className="rounded-lg p-2"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>
                      {iv.type_travaux_label}
                    </p>
                    <IVBadge statut={iv.statut} />
                  </div>
                  <div className="flex items-center justify-between">
                    {iv.responsable_detail && (
                      <p className="text-[9px] flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        <User className="w-2.5 h-2.5" />
                        {iv.responsable_detail.full_name}
                      </p>
                    )}
                    {iv.date_planifiee && (
                      <p className="text-[9px] flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        <Clock className="w-2.5 h-2.5" />
                        {format(new Date(iv.date_planifiee), 'dd MMM', { locale: fr })}
                      </p>
                    )}
                  </div>
                  {iv.equipe_detail && (
                    <p className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      Équipe : {iv.equipe_detail.nom}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Tab Photos ── */}
      {!editing && activeTab === 'photos' && (
        <div className="px-3 py-2.5">
          {/* Grille des photos existantes */}
          {inc.photos?.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 mb-2">
              {inc.photos.map(photo => (
                <div key={photo.id} className="rounded-lg overflow-hidden group"
                     style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                  <a href={photo.image} target="_blank" rel="noreferrer">
                    <img src={photo.image} alt={photo.legende || 'Photo'}
                         className="w-full h-24 object-cover transition-opacity group-hover:opacity-80"
                         style={{ background: 'rgba(255,255,255,0.05)' }} />
                  </a>
                  <div className="px-1.5 py-1">
                    {photo.legende && (
                      <p className="text-[9px] truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        {photo.legende}
                      </p>
                    )}
                    <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      {photo.uploaded_by?.username || ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-3">
              <Camera className="w-5 h-5 mx-auto mb-1" style={{ color: 'rgba(255,255,255,0.15)' }} />
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Aucune photo</p>
            </div>
          )}

          {/* Zone d'upload — masquée pour les lecteurs */}
          {canWrite && <PhotoUploadZone incId={inc.id} />}
        </div>
      )}
    </div>
  )
}


// ── Carte incident ────────────────────────────────────────────
function IncidentCard({ inc }) {
  const [expanded, setExpanded] = useState(false)
  const typeLabel = inc.type_incident_label || inc.type_incident_detail?.nom || '—'

  return (
    <li style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      {/* En-tête — clic pour expand */}
      <div
        className="px-3 py-2.5 cursor-pointer select-none transition-colors"
        onClick={() => setExpanded(v => !v)}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,71,87,0.06)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        {/* Titre + statut + chevron */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-xs font-semibold truncate flex-1" style={{ color: 'rgba(255,255,255,0.9)' }}>
            {inc.titre || typeLabel}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            <StatusBadge statut={inc.statut} />
            <ChevronDown
              className={clsx('w-3.5 h-3.5 transition-transform shrink-0', expanded && 'rotate-180')}
              style={{ color: 'rgba(255,255,255,0.3)' }}
            />
          </div>
        </div>

        {/* Priorité + type */}
        <div className="flex items-center gap-2 mb-1">
          <PrioriteBadge priorite={inc.priorite} />
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{typeLabel}</span>
          {/* Ouvrage badge */}
          {inc.ouvrage_detail && (
            <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded ml-auto shrink-0"
                  style={{ background: 'rgba(0,170,221,0.1)', color: '#00AADD' }}>
              <Building2 className="w-2.5 h-2.5" />
              {inc.ouvrage_detail.code}
            </span>
          )}
        </div>

        {/* Localisation */}
        {(inc.localisation || inc.ville) && (
          <p className="text-[10px] flex items-center gap-1 truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
            <MapPin className="w-2.5 h-2.5 shrink-0" />
            {[inc.localisation, inc.ville].filter(Boolean).join(', ')}
          </p>
        )}

        {/* Date + assigné + compteurs */}
        <div className="flex items-center justify-between mt-1">
          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {inc.date_signalement
              ? format(new Date(inc.date_signalement), "dd MMM yyyy 'à' HH:mm", { locale: fr })
              : ''}
          </p>
          <div className="flex items-center gap-2">
            {inc.nb_interventions > 0 && (
              <span className="flex items-center gap-0.5 text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                <Wrench className="w-2.5 h-2.5" />{inc.nb_interventions}
              </span>
            )}
            {inc.assigne_a_detail && (
              <p className="text-[10px] flex items-center gap-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                <User className="w-2.5 h-2.5" />
                {inc.assigne_a_detail.full_name}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Détail complet */}
      {expanded && <IncidentDetail incId={inc.id} onClose={() => setExpanded(false)} />}
    </li>
  )
}


// ── Section Ouvrage dans le formulaire incident ───────────────
/**
 * Permet de lier un incident à un ouvrage.
 * Si un code est fourni (depuis la carte) → recherche auto.
 * Sinon → saisie manuelle avec debounce.
 * Si l'ouvrage n'existe pas en base → proposition de création.
 */
function OuvrageSection({ codeInit, nomInit, typeOuvrageIdInit, onOuvrageChange }) {
  const [codeInput, setCodeInput]     = useState(codeInit || '')
  const [debouncedCode, setDebounced] = useState(codeInit || '')
  const [creating, setCreating]       = useState(false)
  const [newNom, setNewNom]           = useState(nomInit || '')
  const [newType, setNewType]         = useState(typeOuvrageIdInit ? String(typeOuvrageIdInit) : '')
  const debounceRef                   = useRef(null)

  const { data: typesOuvrage = [] } = useTypeOuvrages()
  const { data: ouvrage, isFetching: searching } = useOuvrageByCode(debouncedCode)
  const { mutate: createOuvrage, isPending: saving } = useCreateOuvrage()

  // Debounce sur la saisie manuelle (300 ms)
  const handleCodeChange = (val) => {
    setCodeInput(val)
    setCreating(false)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebounced(val.trim()), 300)
  }

  // Quand on trouve un ouvrage → on le remonte au formulaire parent
  useEffect(() => {
    if (ouvrage) {
      onOuvrageChange(ouvrage.id)
    } else {
      onOuvrageChange(null)
    }
  }, [ouvrage]) // eslint-disable-line

  // Création rapide d'un ouvrage inconnu
  const handleCreate = () => {
    if (!codeInput.trim() || !newType) return
    createOuvrage(
      { code: codeInput.trim(), nom: newNom || codeInput.trim(), type_ouvrage: Number(newType) },
      {
        onSuccess: (created) => {
          setCreating(false)
          onOuvrageChange(created.id)
        },
      }
    )
  }

  const showResult  = debouncedCode.length >= 2 && !searching
  const notFound    = showResult && !ouvrage

  return (
    <div className="space-y-1.5 rounded-lg p-2"
         style={{ background: 'rgba(0,170,221,0.05)', border: '1px solid rgba(0,170,221,0.15)' }}>

      {/* Label */}
      <p className="text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1"
         style={{ color: 'rgba(0,170,221,0.8)' }}>
        <Building2 className="w-3 h-3" />
        Ouvrage lié
      </p>

      {/* Champ code */}
      <div className="relative">
        <input
          value={codeInput}
          onChange={e => handleCodeChange(e.target.value)}
          placeholder="Code ouvrage (ex : PT-1042)"
          className={`${INPUT_CLS} pr-7`}
          style={INPUT_STYLE}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2">
          {searching
            ? <Loader2 className="w-3 h-3 animate-spin" style={{ color: '#00AADD' }} />
            : <Search className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.2)' }} />
          }
        </span>
      </div>

      {/* Ouvrage trouvé */}
      {showResult && ouvrage && (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
             style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}>
          <CheckCircle2 className="w-3 h-3 shrink-0" style={{ color: '#10b981' }} />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold truncate" style={{ color: '#10b981' }}>
              {ouvrage.nom || ouvrage.code}
            </p>
            <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {ouvrage.type_ouvrage_detail?.nom || ''} · {ouvrage.code}
            </p>
          </div>
        </div>
      )}

      {/* Ouvrage introuvable → proposer création */}
      {notFound && !creating && (
        <div className="flex items-center justify-between px-2 py-1.5 rounded-lg"
             style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <p className="text-[10px]" style={{ color: 'rgba(245,158,11,0.9)' }}>
            Ouvrage « {debouncedCode} » inconnu
          </p>
          <button
            type="button"
            onClick={() => { setCreating(true); setNewNom(codeInput); setNewType(String(typeOuvrageIdInit || '')) }}
            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded transition-colors"
            style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
            <PlusCircle className="w-3 h-3" />
            Créer
          </button>
        </div>
      )}

      {/* Mini-formulaire de création */}
      {creating && (
        <div className="space-y-1.5 pt-1">
          <input
            value={newNom}
            onChange={e => setNewNom(e.target.value)}
            placeholder="Nom de l'ouvrage"
            className={INPUT_CLS}
            style={INPUT_STYLE}
          />
          <select
            value={newType}
            onChange={e => setNewType(e.target.value)}
            className={INPUT_CLS}
            style={SELECT_STYLE}
          >
            <option value="">— Type d'ouvrage —</option>
            {typesOuvrage.map(t => (
              <option key={t.id} value={t.id}>{t.icone} {t.nom}</option>
            ))}
          </select>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving || !newType}
              className="flex-1 flex items-center justify-center gap-1 text-[10px] font-semibold px-2 py-1.5 rounded-lg disabled:opacity-40"
              style={{ background: '#00AADD', color: '#0D1B2A' }}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="text-[10px] px-2 py-1.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}


// ── Formulaire création incident ──────────────────────────────
function NewIncidentForm({ onCancel, prefill }) {
  const { mutate: create, isPending }          = useCreateIncident()
  const { clearIncidentPrefill }               = useMapStore()
  const { data: typesIncident = [], isLoading: loadingTypes } = useTypeIncidents()

  const [ouvrageId, setOuvrageId] = useState(null)   // ID de l'ouvrage résolu

  const [form, setForm] = useState({
    titre:         '',
    type_incident: '',   // ID du TypeIncident (FK)
    priorite:      'moyenne',
    description:   '',
    localisation:  prefill?.localisation || '',
    ville:         '',
    latitude:      prefill?.latitude  ?? '',
    longitude:     prefill?.longitude ?? '',
    couche_id:     prefill?.couche_id  || '',
    couche_nom:    prefill?.couche_nom || '',
    feature_id:    prefill?.feature_id || '',
  })

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.titre.trim()) return
    const payload = {
      ...form,
      latitude:  form.latitude  !== '' ? Number(form.latitude)  : null,
      longitude: form.longitude !== '' ? Number(form.longitude) : null,
      ouvrage:   ouvrageId ?? null,
    }
    create(payload, { onSuccess: () => { clearIncidentPrefill(); onCancel() } })
  }

  const handleCancel = () => { clearIncidentPrefill(); onCancel() }

  return (
    <form onSubmit={handleSubmit} className="p-3 space-y-2"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,71,87,0.04)' }}>

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold" style={{ color: '#FF6B7A' }}>
          <AlertTriangle className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
          Déclarer un incident
        </p>
        <button type="button" onClick={handleCancel} style={{ color: 'rgba(255,255,255,0.4)' }}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {prefill?.couche_nom && (
        <div className="flex items-center gap-1.5 text-[10px] px-2 py-1.5 rounded-lg"
             style={{ background: 'rgba(0,170,221,0.12)', color: '#00AADD' }}>
          <Zap className="w-3 h-3 shrink-0" />
          Depuis carte : <span className="font-semibold">{prefill.couche_nom}</span>
          {prefill.latitude && (
            <span className="ml-auto opacity-60">
              {Number(prefill.latitude).toFixed(4)}, {Number(prefill.longitude).toFixed(4)}
            </span>
          )}
        </div>
      )}

      <input required value={form.titre} onChange={set('titre')}
             placeholder="Titre de l'incident *" className={INPUT_CLS} style={INPUT_STYLE} />

      <div className="flex gap-2">
        {/* Type d'incident — chargé dynamiquement depuis l'admin */}
        <select value={form.type_incident} onChange={set('type_incident')}
                className={INPUT_CLS} style={SELECT_STYLE}
                disabled={loadingTypes}>
          <option value="">{loadingTypes ? 'Chargement…' : 'Type d\'incident'}</option>
          {typesIncident.map(t => (
            <option key={t.id} value={t.id}>{t.icone} {t.nom}</option>
          ))}
        </select>
        <select value={form.priorite} onChange={set('priorite')}
                className={`${INPUT_CLS} w-28`} style={SELECT_STYLE}>
          {Object.entries(INCIDENT_PRIORITE).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Section ouvrage */}
      <OuvrageSection
        codeInit={prefill?.code_ouvrage}
        nomInit={prefill?.nom_ouvrage}
        typeOuvrageIdInit={prefill?.type_ouvrage_id}
        onOuvrageChange={setOuvrageId}
      />

      <div className="flex gap-2">
        <input value={form.localisation} onChange={set('localisation')}
               placeholder="Localisation" className={INPUT_CLS} style={INPUT_STYLE} />
        <input value={form.ville} onChange={set('ville')}
               placeholder="Ville" className={`${INPUT_CLS} w-24`} style={INPUT_STYLE} />
      </div>

      <textarea value={form.description} onChange={set('description')}
                placeholder="Description (optionnel)" rows={2}
                className={`${INPUT_CLS} resize-none`}
                style={{ ...INPUT_STYLE, fontSize: '0.75rem' }} />

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={isPending || !form.titre.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all"
                style={{ background: form.titre.trim() ? '#FF4757' : 'rgba(255,71,87,0.3)', color: '#fff' }}>
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Déclarer
        </button>
        <button type="button" onClick={handleCancel}
                className="text-xs px-3 py-2 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' }}>
          Annuler
        </button>
      </div>
    </form>
  )
}


// ── Export CSV ────────────────────────────────────────────────
function exportCSV(incidents) {
  const headers = [
    'ID','Titre','Type','Statut','Priorité','Localisation','Ville',
    'Latitude','Longitude','Signalé par','Assigné à','Date signalement','Date résolution',
  ]
  const rows = incidents.map(inc => [
    inc.id,
    `"${(inc.titre || '').replace(/"/g, '""')}"`,
    inc.type_incident_label || inc.type_incident,
    inc.statut_label  || inc.statut,
    inc.priorite_label || inc.priorite,
    `"${(inc.localisation || '').replace(/"/g, '""')}"`,
    inc.ville || '',
    inc.latitude ?? '',
    inc.longitude ?? '',
    inc.signale_par_detail?.full_name || '',
    inc.assigne_a_detail?.full_name   || '',
    inc.date_signalement ? new Date(inc.date_signalement).toLocaleString('fr-FR') : '',
    inc.date_resolution  ? new Date(inc.date_resolution).toLocaleString('fr-FR')  : '',
  ])
  const csv  = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `incidents_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}


// ── Panel principal ───────────────────────────────────────────
export default function IncidentPanelMini() {
  const [filterStatut,      setFilterStatut]      = useState('ouvert')
  const [filterPriorite,    setFilterPriorite]    = useState('')
  const [filterType,        setFilterType]        = useState('')
  const [searchInput,       setSearchInput]       = useState('')
  const [searchDebounced,   setSearchDebounced]   = useState('')
  const [page,              setPage]              = useState(1)
  const [showForm,          setShowForm]          = useState(false)
  const searchRef = useRef(null)

  const { canWrite, isLecteur } = usePermissions()

  const {
    incidentPrefill, showIncidentMarkers, toggleIncidentMarkers,
  } = useMapStore()

  const { data: typesIncident = [] } = useTypeIncidents()

  // Debounce recherche — 350 ms + reset page
  useEffect(() => {
    clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => {
      setSearchDebounced(searchInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(searchRef.current)
  }, [searchInput])

  // Ouvre le formulaire si un pré-remplissage arrive depuis la carte (interdit aux lecteurs)
  useEffect(() => {
    if (incidentPrefill && canWrite) setShowForm(true)
  }, [incidentPrefill, canWrite])

  const { data, isLoading, refetch, isFetching } = useIncidents({
    statut:        filterStatut      || undefined,
    priorite:      filterPriorite    || undefined,
    type_incident: filterType        || undefined,
    search:        searchDebounced   || undefined,
    page,
  })

  // Support pagination DRF ({ count, next, previous, results }) ET liste plate
  const isPaginated = data && 'results' in data
  const incidents   = isPaginated ? data.results : (data ?? [])
  const totalCount  = isPaginated ? data.count   : incidents.length
  const pageSize    = 20
  const totalPages  = Math.ceil(totalCount / pageSize)

  // Nb de filtres actifs (hors statut par défaut)
  const activeFilters = [filterPriorite, filterType, searchDebounced].filter(Boolean).length

  const clearFilters = () => {
    setFilterStatut('ouvert')
    setFilterPriorite('')
    setFilterType('')
    setSearchInput('')
    setSearchDebounced('')
    setPage(1)
  }

  // Reset page quand les filtres changent
  useEffect(() => { setPage(1) }, [filterStatut, filterPriorite, filterType])

  const selectStyle = {
    background: '#1e2a3a',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.8)',
    colorScheme: 'dark',
  }

  return (
    <div className="flex flex-col h-full">

      {/* Stats */}
      <StatsBar />

      {/* ── Barre de recherche ── */}
      <div className="px-2 pt-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                  style={{ color: searchInput ? '#00AADD' : 'rgba(255,255,255,0.25)' }} />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Rechercher un incident…"
            className="w-full text-[11px] pl-8 pr-7 py-1.5 rounded-lg outline-none"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${searchInput ? 'rgba(0,170,221,0.4)' : 'rgba(255,255,255,0.1)'}`,
              color: 'rgba(255,255,255,0.9)',
            }}
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="absolute right-2 top-1/2 -translate-y-1/2"
              style={{ color: 'rgba(255,255,255,0.3)' }}>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* ── Filtres ── */}
      <div className="px-2 pt-1.5 pb-2 shrink-0"
           style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>

        {/* Ligne 1 : statut + priorité */}
        <div className="flex gap-1.5 mb-1.5">
          <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
                  className="flex-1 text-[11px] px-2 py-1.5 rounded-lg outline-none" style={selectStyle}>
            <option value="">Tous statuts</option>
            {Object.entries(INCIDENT_STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>

          <select value={filterPriorite} onChange={e => setFilterPriorite(e.target.value)}
                  className="w-24 text-[11px] px-2 py-1.5 rounded-lg outline-none" style={selectStyle}>
            <option value="">Priorité</option>
            {Object.entries(INCIDENT_PRIORITE).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>

        {/* Ligne 2 : type + actions */}
        <div className="flex items-center gap-1.5">
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
                  className="flex-1 text-[11px] px-2 py-1.5 rounded-lg outline-none" style={selectStyle}>
            <option value="">Tous types</option>
            {typesIncident.map(t => (
              <option key={t.id} value={t.id}>{t.icone} {t.nom}</option>
            ))}
          </select>

          {/* Effacer les filtres */}
          {activeFilters > 0 && (
            <button onClick={clearFilters} title="Effacer les filtres"
                    className="flex items-center gap-1 text-[10px] px-2 py-1.5 rounded-lg shrink-0 transition-colors"
                    style={{ background: 'rgba(255,71,87,0.12)', color: '#FF4757', border: '1px solid rgba(255,71,87,0.25)' }}>
              <X className="w-3 h-3" />
              {activeFilters}
            </button>
          )}

          <button onClick={() => refetch()} title="Actualiser"
                  className={clsx('p-1.5 rounded-lg transition-colors shrink-0', isFetching && 'animate-spin')}
                  style={{ color: 'rgba(255,255,255,0.4)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}>
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {incidents.length > 0 && (
            <button onClick={() => exportCSV(incidents)} title="Exporter en CSV"
                    className="p-1.5 rounded-lg transition-colors shrink-0"
                    style={{ color: 'rgba(255,255,255,0.4)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#10b981' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}>
              <Download className="w-3.5 h-3.5" />
            </button>
          )}

          <button onClick={toggleIncidentMarkers}
                  title={showIncidentMarkers ? 'Masquer sur la carte' : 'Afficher sur la carte'}
                  className="p-1.5 rounded-lg shrink-0 transition-colors"
                  style={{
                    background: showIncidentMarkers ? 'rgba(255,71,87,0.2)' : 'rgba(255,255,255,0.06)',
                    color:      showIncidentMarkers ? '#FF4757' : 'rgba(255,255,255,0.4)',
                    border:     showIncidentMarkers ? '1px solid rgba(255,71,87,0.4)' : '1px solid transparent',
                  }}>
            <Map className="w-3.5 h-3.5" />
          </button>

          {/* Bouton Nouveau — masqué pour les lecteurs */}
          {canWrite && (
            <button onClick={() => setShowForm(v => !v)}
                    className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1.5 rounded-lg shrink-0"
                    style={{ background: showForm ? '#E8394A' : '#FF4757', color: '#fff' }}
                    title="Déclarer un incident">
              <Plus className="w-3.5 h-3.5" />
              Nouveau
            </button>
          )}
          {/* Badge lecture seule */}
          {isLecteur && (
            <span className="text-[9px] px-1.5 py-0.5 rounded shrink-0"
                  style={{ background: 'rgba(107,114,128,0.2)', color: 'rgba(255,255,255,0.35)' }}>
              Lecture
            </span>
          )}
        </div>
      </div>

      {/* Formulaire création */}
      {showForm && <NewIncidentForm onCancel={() => setShowForm(false)} prefill={incidentPrefill} />}

      {/* Liste */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#FF4757' }} />
        </div>
      ) : incidents.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center"
               style={{ background: 'rgba(255,71,87,0.10)' }}>
            <AlertTriangle className="w-6 h-6" style={{ color: '#FF4757' }} />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>Aucun incident</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {searchDebounced
                ? `Recherche : « ${searchDebounced} »`
                : filterStatut ? `Statut : ${INCIDENT_STATUS[filterStatut]?.label}` : 'Tous les statuts'}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Info + compteur */}
          <div className="flex items-center justify-between px-3 py-1 shrink-0"
               style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
              Cliquer sur un incident pour le détail
            </p>
            {isPaginated && (
              <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                {totalCount} incident{totalCount > 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Liste */}
          <ul className="overflow-y-auto flex-1"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
            {incidents.map(inc => <IncidentCard key={inc.id} inc={inc} />)}
          </ul>

          {/* Pagination */}
          {isPaginated && totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 shrink-0"
                 style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.15)' }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || isFetching}
                className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg disabled:opacity-30 transition-colors"
                style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)' }}
              >
                ← Préc.
              </button>

              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Page <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{page}</span> / {totalPages}
              </p>

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || isFetching}
                className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg disabled:opacity-30 transition-colors"
                style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)' }}
              >
                Suiv. →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
