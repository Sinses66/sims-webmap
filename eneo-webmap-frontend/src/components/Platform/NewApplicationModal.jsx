import { useState, useEffect } from 'react'
import { X, Loader2, MapPin, ChevronRight } from 'lucide-react'
import { platformAPI } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'

// ── Slugification simple (compatible noms fr/en avec accents) ──
function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // supprimer les accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

const TOAST_STYLE = { background: '#132337', color: '#E2E8F0', border: '1px solid rgba(0,170,221,0.2)' }

const INITIAL = {
  name:        '',
  slug:        '',
  subtitle:    '',
  description: '',
  // Centre par défaut : Yaoundé, Cameroun
  center_lat:  3.848,
  center_lon:  11.502,
  zoom_default: 7,
  // Modules activés par défaut
  module_incidents:     true,
  module_interventions: true,
  module_analytics:     false,
  module_export:        false,
  module_editor:        false,
}

export default function NewApplicationModal({ onClose, onCreated }) {
  const { user } = useAuthStore()
  const [form, setForm]         = useState(INITIAL)
  const [slugManual, setSlugManual] = useState(false)   // true si l'user a modifié le slug à la main
  const [loading, setLoading]   = useState(false)
  const [errors, setErrors]     = useState({})

  // Auto-générer le slug depuis le nom (sauf si l'user l'a modifié manuellement)
  useEffect(() => {
    if (!slugManual && form.name) {
      setForm(f => ({ ...f, slug: slugify(form.name) }))
    }
  }, [form.name, slugManual])

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }))
    if (errors[key]) setErrors(e => ({ ...e, [key]: null }))
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim())   e.name = 'Le nom est requis'
    if (!form.slug.trim())   e.slug = 'Le slug est requis'
    if (!/^[a-z0-9-]+$/.test(form.slug)) e.slug = 'Slug invalide — lettres minuscules, chiffres et tirets uniquement'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    if (!user?.org_id) {
      toast.error("Votre profil n'est pas rattaché à une organisation", { style: TOAST_STYLE })
      return
    }

    setLoading(true)
    try {
      const payload = {
        ...form,
        organisation: user.org_id,
        is_active:    true,
        is_public:    false,
      }
      const { data } = await platformAPI.createApplication(payload)
      toast.success(`Application « ${data.name} » créée avec succès`, { style: TOAST_STYLE })
      onCreated(data)
      onClose()
    } catch (err) {
      const detail = err.response?.data
      if (detail && typeof detail === 'object') {
        // Mapper les erreurs de champ DRF
        const fieldErrors = {}
        Object.entries(detail).forEach(([k, v]) => {
          fieldErrors[k] = Array.isArray(v) ? v[0] : String(v)
        })
        setErrors(fieldErrors)
      } else {
        toast.error('Erreur lors de la création', { style: TOAST_STYLE })
      }
    } finally {
      setLoading(false)
    }
  }

  // Tous les modules possibles
  const ALL_MODULES = [
    { key: 'module_incidents',     label: 'Incidents',              orgKey: 'incidents'     },
    { key: 'module_interventions', label: 'Interventions',          orgKey: 'interventions' },
    { key: 'module_analytics',     label: 'Analytics',              orgKey: 'analytics'     },
    { key: 'module_export',        label: 'Export',                 orgKey: 'export'        },
    { key: 'module_editor',        label: 'Éditeur cartographique', orgKey: 'editor'        },
  ]

  // Filtrer selon les modules autorisés par l'organisation (reçus via my_profile)
  // Si org_modules absent (superuser), afficher tous les modules
  const orgModules = user?.org_modules
  const modules = orgModules
    ? ALL_MODULES.filter(m => orgModules[m.orgKey] === true)
    : ALL_MODULES

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <div
          className="w-full max-w-lg rounded-2xl border border-cyan-500/15 shadow-2xl overflow-hidden animate-fade-in"
          style={{ background: '#0D1B2A' }}
        >
          {/* ── En-tête ── */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-white/8">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/25
                            flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-white font-semibold text-sm">Nouvelle application</h2>
              <p className="text-white/35 text-xs mt-0.5">
                Organisation : <span className="text-cyan-400/70">{user?.organisation || '—'}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white/30 hover:text-white/70 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Formulaire ── */}
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto">

            {/* Nom */}
            <Field label="Nom de l'application *" error={errors.name}>
              <input
                type="text"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="ex : ENEO GIS — Réseau HTB"
                autoFocus
                className="input-modal"
              />
            </Field>

            {/* Slug */}
            <Field label="Identifiant (slug) *" error={errors.slug}
                   hint="Utilisé dans l'URL — lettres minuscules, chiffres, tirets">
              <input
                type="text"
                value={form.slug}
                onChange={e => { setSlugManual(true); set('slug', e.target.value) }}
                placeholder="ex : eneo-gis-htb"
                className="input-modal font-mono text-xs"
              />
            </Field>

            {/* Sous-titre */}
            <Field label="Sous-titre" error={errors.subtitle}>
              <input
                type="text"
                value={form.subtitle}
                onChange={e => set('subtitle', e.target.value)}
                placeholder="ex : data overview"
                className="input-modal"
              />
            </Field>

            {/* Description */}
            <Field label="Description" error={errors.description}>
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Description courte de l'application…"
                rows={3}
                className="input-modal resize-none"
              />
            </Field>

            {/* Centrage carte */}
            <div>
              <p className="text-xs font-medium text-white/50 mb-2">
                Centre de la carte
              </p>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Latitude" error={errors.center_lat} compact>
                  <input
                    type="number"
                    step="0.001"
                    value={form.center_lat}
                    onChange={e => set('center_lat', parseFloat(e.target.value))}
                    className="input-modal text-xs"
                  />
                </Field>
                <Field label="Longitude" error={errors.center_lon} compact>
                  <input
                    type="number"
                    step="0.001"
                    value={form.center_lon}
                    onChange={e => set('center_lon', parseFloat(e.target.value))}
                    className="input-modal text-xs"
                  />
                </Field>
                <Field label="Zoom" error={errors.zoom_default} compact>
                  <input
                    type="number"
                    min={1} max={20}
                    value={form.zoom_default}
                    onChange={e => set('zoom_default', parseInt(e.target.value))}
                    className="input-modal text-xs"
                  />
                </Field>
              </div>
            </div>

            {/* Modules */}
            <div>
              <p className="text-xs font-medium text-white/50 mb-2">Modules activés</p>
              <div className="grid grid-cols-2 gap-2">
                {modules.map(({ key, label }) => (
                  <label key={key}
                         className="flex items-center gap-2.5 cursor-pointer group
                                    px-3 py-2 rounded-lg border border-white/6
                                    hover:border-cyan-500/20 transition-colors"
                         style={{ background: 'rgba(255,255,255,0.02)' }}
                  >
                    <div
                      onClick={() => set(key, !form[key])}
                      className={`w-4 h-4 rounded border flex items-center justify-center
                                  shrink-0 transition-colors ${
                        form[key]
                          ? 'bg-cyan-500 border-cyan-500'
                          : 'border-white/20 hover:border-white/40'
                      }`}
                    >
                      {form[key] && (
                        <svg className="w-3 h-3 text-sims-900" fill="none" viewBox="0 0 12 12">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5"
                                strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span className="text-xs text-white/50 group-hover:text-white/70 transition-colors select-none">
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Erreur globale */}
            {errors.non_field_errors && (
              <p className="text-xs text-red-400 px-3 py-2 rounded-lg border border-red-500/20"
                 style={{ background: 'rgba(239,68,68,0.06)' }}>
                {errors.non_field_errors}
              </p>
            )}
          </form>

          {/* ── Pied de modal ── */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/8">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white/80
                         border border-white/10 hover:border-white/20 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-sm
                         transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#00AADD', color: '#0D1B2A' }}
              onMouseEnter={e => !loading && (e.currentTarget.style.background = '#0095C4')}
              onMouseLeave={e => !loading && (e.currentTarget.style.background = '#00AADD')}
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Création…</>
                : <><span>Créer l'application</span><ChevronRight className="w-4 h-4" /></>
              }
            </button>
          </div>
        </div>
      </div>

      {/* Styles locaux */}
      <style>{`
        .input-modal {
          width: 100%;
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(19,35,55,0.8);
          color: #E2E8F0;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s;
        }
        .input-modal:focus {
          border-color: rgba(0,170,221,0.4);
        }
        .input-modal::placeholder {
          color: rgba(255,255,255,0.2);
        }
      `}</style>
    </>
  )
}

// ── Helper : champ avec label + erreur ──────────────────────────
function Field({ label, error, hint, compact, children }) {
  return (
    <div>
      {!compact && (
        <label className="block text-xs font-medium text-white/50 mb-1.5">
          {label}
          {hint && <span className="text-white/25 font-normal ml-1.5">— {hint}</span>}
        </label>
      )}
      {compact && (
        <label className="block text-[11px] text-white/35 mb-1">{label}</label>
      )}
      {children}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  )
}
