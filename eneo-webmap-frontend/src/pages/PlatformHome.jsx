import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Globe, LogIn, LogOut, User, Search, Plus, Lock,
  ExternalLink, Calendar, ChevronDown, Layers, X,
  Settings, MapPin, Shield, Activity,
  Users, ArrowRight, Clock, AlertCircle, Loader2,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { platformAPI } from '../services/api'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import NewApplicationModal from '../components/Platform/NewApplicationModal'

// ─── Fallback statique si API indisponible ─────────────────────
const FALLBACK_APPS = [
  {
    id: 1,
    slug: 'eneo',
    name: 'ENEO GIS',
    subtitle: 'data overview',
    description: "Cartographie générale de l'asset ENEO — réseau HTB, HTA, BT, postes sources, postes de distribution et découpage commercial.",
    organisation_name: 'ENEO Cameroun S.A.',
    layers_count: 9,
    updated_at: '2026-04-01',
    stats: { incidents: 0, interventions: 0, users: 1 },
  },
]

// ─── Composant principal ───────────────────────────────────────
export default function PlatformHome() {
  const { user, isAuthenticated, logout } = useAuthStore()
  const navigate = useNavigate()
  const [lang, setLang]           = useState('FR')
  const [search, setSearch]       = useState('')
  const [menuOpen, setMenuOpen]   = useState(false)
  const [apps, setApps]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [showNewApp, setShowNewApp] = useState(false)

  const t = (fr, en) => lang === 'FR' ? fr : en

  // ── Chargement des applications depuis l'API ──
  useEffect(() => {
    if (!isAuthenticated) {
      // Non connecté : afficher fallback sans appel API
      setApps(FALLBACK_APPS)
      setLoading(false)
      return
    }
    platformAPI.listApplications()
      .then(({ data }) => {
        // Normaliser : résultats paginés ou tableau direct
        const list = Array.isArray(data) ? data : (data.results ?? [])
        setApps(list.length > 0 ? list : FALLBACK_APPS)
      })
      .catch(() => {
        setApps(FALLBACK_APPS)
      })
      .finally(() => setLoading(false))
  }, [isAuthenticated])

  const filtered = apps.filter(app =>
    app.name.toLowerCase().includes(search.toLowerCase()) ||
    (app.description || '').toLowerCase().includes(search.toLowerCase()) ||
    (app.organisation_name || '').toLowerCase().includes(search.toLowerCase())
  )

  const handleOpenApp = (app) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/app/${app.slug}` } })
      return
    }
    navigate(`/app/${app.slug}`)
  }

  const handleNewApp = () => {
    // Staff Django → admin SIMS CORE (accès complet)
    // Org admin non-staff → modal frontend (périmètre limité à son org)
    if (user?.is_staff) {
      const coreUrl = import.meta.env.VITE_CORE_URL || 'http://localhost:8001'
      window.open(`${coreUrl}/admin/sims_core/application/add/`, '_blank')
    } else {
      setShowNewApp(true)
    }
  }

  const handleAppCreated = (newApp) => {
    // Ajouter la nouvelle app en tête de liste sans rechargement
    setApps(prev => [newApp, ...prev])
  }

  const handleLogout = () => {
    logout()
    setMenuOpen(false)
    toast.success(t('Déconnecté avec succès', 'Logged out'), {
      style: { background: '#132337', color: '#E2E8F0' },
    })
  }

  return (
    <div className="min-h-screen flex flex-col"
         style={{ background: 'linear-gradient(160deg, #070e17 0%, #0D1B2A 45%, #0f1e30 100%)' }}>

      {/* ══════════════════════════════════════════════════════
          NAVBAR
      ══════════════════════════════════════════════════════ */}
      <nav className="h-14 border-b border-cyan-500/10 flex items-center px-6 gap-4 shrink-0 z-50"
           style={{ background: 'rgba(13,27,42,0.97)', backdropFilter: 'blur(12px)' }}>

        {/* Logo + identité plateforme */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 flex items-center justify-center">
            <img
              src="/logo_sims.png"
              alt="SIMS"
              className="w-full h-full object-contain"
              style={{ filter: 'brightness(0) invert(1)' }}
              onError={(e) => {
                e.target.style.display = 'none'
                e.target.nextSibling.style.display = 'flex'
              }}
            />
            {/* Fallback icône */}
            <div className="w-8 h-8 bg-cyan-500/20 border border-cyan-500/40 rounded-lg
                            hidden items-center justify-center">
              <MapPin className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-white font-bold text-sm tracking-wide">SIMS Online</span>
            <span className="text-cyan-500 text-[10px] font-medium hidden sm:block">
              Where maps drive decisions
            </span>
          </div>
        </div>

        {/* Séparateur */}
        <div className="h-6 w-px bg-white/10 hidden md:block" />

        {/* Fil d'ariane plateforme */}
        <div className="hidden md:flex items-center gap-1.5 text-white/30 text-xs">
          <span>Plateforme</span>
          <span>/</span>
          <span className="text-white/60">Applications</span>
        </div>

        <div className="flex-1" />

        {/* Toggle langue */}
        <button
          onClick={() => setLang(l => l === 'FR' ? 'EN' : 'FR')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10
                     text-white/50 hover:text-white hover:border-white/25 text-xs font-medium
                     transition-all duration-200"
        >
          <Globe className="w-3.5 h-3.5" />
          {lang}
        </button>

        {/* Bouton Auth */}
        {!isAuthenticated ? (
          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg font-semibold text-sm
                       transition-all duration-200 shadow-cyan-sm"
            style={{ background: '#00AADD', color: '#0D1B2A' }}
            onMouseEnter={e => e.currentTarget.style.background = '#0095C4'}
            onMouseLeave={e => e.currentTarget.style.background = '#00AADD'}
          >
            <LogIn className="w-3.5 h-3.5" />
            {t('Connexion', 'Login')}
          </button>
        ) : (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/8
                         text-white transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-cyan-500/15 border border-cyan-500/40
                              flex items-center justify-center shrink-0">
                <User className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <span className="text-sm max-w-[120px] truncate hidden sm:block">
                {user?.first_name || user?.username || 'Utilisateur'}
              </span>
              <ChevronDown className={clsx('w-3.5 h-3.5 text-white/40 transition-transform', menuOpen && 'rotate-180')} />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-cyan-500/15
                                shadow-2xl z-50 overflow-hidden animate-fade-in"
                     style={{ background: '#132337' }}>
                  <div className="px-4 py-3 border-b border-white/8">
                    <p className="text-sm font-semibold text-white">
                      {user?.first_name} {user?.last_name}
                    </p>
                    <p className="text-xs text-white/40 mt-0.5">{user?.email}</p>
                    {user?.role && (
                      <span className="badge badge-info mt-1.5">{user.role}</span>
                    )}
                  </div>
                  <div className="py-1">
                    <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm
                                       text-white/60 hover:text-white hover:bg-white/5 transition-colors">
                      <User className="w-4 h-4" />
                      {t('Mon profil', 'My profile')}
                    </button>
                    <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm
                                       text-white/60 hover:text-white hover:bg-white/5 transition-colors">
                      <Settings className="w-4 h-4" />
                      {t('Paramètres', 'Settings')}
                    </button>
                  </div>
                  <div className="border-t border-white/8 py-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm
                                 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      {t('Déconnexion', 'Sign out')}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </nav>

      {/* ══════════════════════════════════════════════════════
          HERO (compact) — affiché si non connecté
      ══════════════════════════════════════════════════════ */}
      {!isAuthenticated && (
        <div className="border-b border-white/5 py-8 px-6">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white mb-1">
                {t('Plateforme cartographique d\'entreprise', 'Enterprise mapping platform')}
              </h2>
              <p className="text-white/40 text-sm max-w-xl">
                {t(
                  'Créez, configurez et partagez des applications GIS personnalisées pour la gestion de vos infrastructures et données géospatiales.',
                  'Create, configure and share custom GIS applications for managing your infrastructure and geospatial data.'
                )}
              </p>
            </div>
            {/* Stats rapides */}
            <div className="flex gap-6 shrink-0">
              {[
                { icon: Layers,    value: '16',  label: t('Couches', 'Layers') },
                { icon: Users,     value: '25',  label: t('Utilisateurs', 'Users') },
                { icon: Activity,  value: '1',   label: t('Application', 'Application') },
              ].map(({ icon: Icon, value, label }) => (
                <div key={label} className="text-center">
                  <div className="flex items-center justify-center gap-1 text-cyan-500 mb-0.5">
                    <Icon className="w-3.5 h-3.5" />
                    <span className="text-lg font-bold text-white">{value}</span>
                  </div>
                  <span className="text-white/30 text-xs">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          CONTENU PRINCIPAL
      ══════════════════════════════════════════════════════ */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">

        {/* Titre + barre d'actions */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex flex-col gap-1.5">
              {t('Applications', 'Applications')}
              <span className="h-0.5 w-12 bg-cyan-500 rounded-full" />
            </h1>
            <p className="text-white/30 text-sm mt-2">
              {loading
                ? t('Chargement…', 'Loading…')
                : t(
                    `${apps.length} application${apps.length > 1 ? 's' : ''} disponible${apps.length > 1 ? 's' : ''}`,
                    `${apps.length} application${apps.length > 1 ? 's' : ''} available`
                  )
              }
            </p>
          </div>

          <div className="flex gap-3 sm:ml-auto">
            {/* Bouton Nouvelle application — admins/staff uniquement */}
            {isAuthenticated && (user?.is_staff || user?.role === 'admin') && (
              <button
                onClick={handleNewApp}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm
                           transition-all duration-200 shrink-0"
                style={{ background: '#00AADD', color: '#0D1B2A' }}
                onMouseEnter={e => e.currentTarget.style.background = '#0095C4'}
                onMouseLeave={e => e.currentTarget.style.background = '#00AADD'}
              >
                <Plus className="w-4 h-4" />
                {t('Nouvelle application', 'New application')}
              </button>
            )}

            {/* Champ de recherche / filtre */}
            <div className="relative sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('Filtrer...', 'Filter...')}
                className="w-full pl-9 pr-8 py-2 rounded-lg border border-white/10 text-white text-sm
                           placeholder-white/25 focus:outline-none focus:border-cyan-500/40 transition-colors"
                style={{ background: 'rgba(19,35,55,0.8)' }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Grille des applications ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">

          {/* État de chargement */}
          {loading && [1, 2].map(i => (
            <div key={i} className="rounded-xl border border-white/8 overflow-hidden animate-pulse"
                 style={{ background: '#132337', minHeight: 280 }}>
              <div className="h-40 bg-white/5" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-white/8 rounded w-2/3" />
                <div className="h-3 bg-white/5 rounded w-full" />
                <div className="h-3 bg-white/5 rounded w-4/5" />
              </div>
            </div>
          ))}

          {!loading && filtered.map(app => (
            <AppCard
              key={app.id}
              app={app}
              isAuthenticated={isAuthenticated}
              lang={lang}
              onOpen={() => handleOpenApp(app)}
            />
          ))}

          {/* Card placeholder "Créer" — admins/staff uniquement */}
          {isAuthenticated && (user?.is_staff || user?.role === 'admin') && (
            <button
              onClick={handleNewApp}
              className="group rounded-xl border-2 border-dashed border-white/8 flex flex-col
                         items-center justify-center gap-3 p-8 min-h-[280px]
                         hover:border-cyan-500/30 hover:bg-cyan-500/3 transition-all duration-200"
            >
              <div className="w-12 h-12 rounded-full border-2 border-dashed border-white/15
                              group-hover:border-cyan-500/40 flex items-center justify-center
                              transition-colors">
                <Plus className="w-5 h-5 text-white/20 group-hover:text-cyan-500/60 transition-colors" />
              </div>
              <div className="text-center">
                <p className="text-white/20 group-hover:text-white/40 text-sm font-medium transition-colors">
                  {t('Nouvelle application', 'New application')}
                </p>
                <p className="text-white/10 group-hover:text-white/25 text-xs mt-1 transition-colors">
                  {user?.is_staff
                    ? t('Créer dans SIMS CORE', 'Create in SIMS CORE')
                    : t('Configurer et déployer', 'Configure and deploy')
                  }
                </p>
              </div>
            </button>
          )}
        </div>

        {/* Aucun résultat de recherche */}
        {search && filtered.length === 0 && (
          <div className="text-center py-20 animate-fade-in">
            <Search className="w-10 h-10 mx-auto mb-3 text-white/10" />
            <p className="text-white/30 text-sm">
              {t(`Aucune application pour « ${search} »`, `No application for "${search}"`)}
            </p>
            <button onClick={() => setSearch('')} className="text-cyan-500 text-xs mt-2 hover:underline">
              {t('Réinitialiser', 'Clear search')}
            </button>
          </div>
        )}

        {/* Bandeau info non connecté */}
        {!isAuthenticated && (
          <div className="mt-8 rounded-xl border border-cyan-500/15 px-5 py-4 flex flex-col sm:flex-row
                          items-start sm:items-center gap-4 animate-slide-up"
               style={{ background: 'rgba(0,170,221,0.05)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/25
                              flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <p className="text-white/70 text-sm font-medium">
                  {t('Connexion requise pour accéder aux applications', 'Login required to access applications')}
                </p>
                <p className="text-white/30 text-xs mt-0.5">
                  {t('Utilisez vos identifiants entreprise ENEO / LDAP', 'Use your ENEO / LDAP enterprise credentials')}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
                         transition-all shrink-0 sm:ml-auto"
              style={{ background: '#00AADD', color: '#0D1B2A' }}
              onMouseEnter={e => e.currentTarget.style.background = '#0095C4'}
              onMouseLeave={e => e.currentTarget.style.background = '#00AADD'}
            >
              {t('Se connecter', 'Sign in')}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </main>

      {/* ══════════════════════════════════════════════════════
          MODAL — Nouvelle application
      ══════════════════════════════════════════════════════ */}
      {showNewApp && (
        <NewApplicationModal
          onClose={() => setShowNewApp(false)}
          onCreated={handleAppCreated}
        />
      )}

      {/* ══════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════ */}
      <footer className="border-t border-white/5 py-4 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-white/20 text-xs">
            © {new Date().getFullYear()} {t('Powered by', 'Powered by')}{' '}
            <span className="text-cyan-500/50 font-medium">GeoEco Systems</span>
          </p>
          <div className="flex items-center gap-4 text-white/15 text-xs">
            <span>SIMS Online v1.0.0-MVP</span>
            <span>·</span>
            <span>PostGIS · GeoServer · GeoDjango · React</span>
            {/* Lien SIMS CORE — visible uniquement pour les admins/staff */}
            {isAuthenticated && (user?.is_staff || user?.role === 'admin') && (
              <>
                <span>·</span>
                <a
                  href={import.meta.env.VITE_CORE_URL || 'http://localhost:8001'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/25 hover:text-cyan-400/70 transition-colors
                             flex items-center gap-1 cursor-pointer"
                  title="SIMS CORE — Administration"
                >
                  <Shield className="w-3 h-3" />
                  SIMS CORE
                </a>
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}

// ─── Carte Application ─────────────────────────────────────────
function AppCard({ app, isAuthenticated, lang, onOpen }) {
  const t = (fr, en) => lang === 'FR' ? fr : en
  const { stats } = app

  return (
    <div className="group rounded-xl border border-cyan-500/10 hover:border-cyan-500/35
                    overflow-hidden flex flex-col transition-all duration-200
                    hover:shadow-lg hover:shadow-cyan-500/8 cursor-pointer animate-fade-in"
         style={{ background: '#132337' }}
         onClick={onOpen}
    >
      {/* ── Thumbnail cartographique ── */}
      <div className="relative h-40 overflow-hidden flex-shrink-0">
        <MapThumbnail app={app} />

        {/* Badge organisation */}
        <div className="absolute top-2.5 left-2.5">
          <span className="px-2 py-0.5 text-[10px] font-medium rounded-full
                           border border-cyan-500/20 backdrop-blur-sm"
                style={{ background: 'rgba(13,27,42,0.85)', color: '#00AADD' }}>
            {app.organisation_name || app.organization || '—'}
          </span>
        </div>

        {/* Badge couches */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5
                        rounded-full border border-white/10 backdrop-blur-sm"
             style={{ background: 'rgba(13,27,42,0.85)' }}>
          <Layers className="w-3 h-3 text-white/35" />
          <span className="text-[10px] text-white/35">{app.layers_count}</span>
        </div>

        {/* Gradient overlay bas */}
        <div className="absolute bottom-0 inset-x-0 h-12 pointer-events-none"
             style={{ background: 'linear-gradient(to top, #132337, transparent)' }} />
      </div>

      {/* ── Contenu ── */}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex-1">
          {/* Titre */}
          <h3 className="text-white font-bold text-sm leading-snug">
            {app.name}
            <span className="text-white/35 font-normal ml-1.5 text-xs">{app.subtitle}</span>
          </h3>

          {/* Description */}
          <p className="text-white/45 text-xs mt-2 leading-relaxed line-clamp-2">
            {app.description}
          </p>

          {/* Tags (optionnels — non fournis par l'API de base) */}
          <div className="flex flex-wrap gap-1 mt-3">
            {(app.tags || []).slice(0, 3).map(tag => (
              <span key={tag}
                    className="px-1.5 py-0.5 rounded text-[10px] text-white/30"
                    style={{ background: 'rgba(255,255,255,0.05)' }}>
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* ── Mini stats ── */}
        {isAuthenticated && stats && (
          <div className="flex gap-3 mt-3 pt-3 border-t border-white/8">
            <StatChip icon={AlertCircle} value={stats.incidents}     color="text-red-400"    label={t('incidents', 'incidents')} />
            <StatChip icon={Clock}       value={stats.interventions} color="text-yellow-400" label={t('interventions', 'interventions')} />
            <StatChip icon={Users}       value={stats.users}         color="text-cyan-400"   label={t('agents', 'agents')} />
          </div>
        )}

        {/* ── Pied de carte ── */}
        <div className="mt-3 pt-3 border-t border-white/8 flex items-center gap-2">
          <div className="flex items-center gap-1 text-white/20 text-[10px]">
            <Calendar className="w-3 h-3" />
            {new Date(app.updated_at).toLocaleDateString('fr-FR', {
              day: '2-digit', month: 'short', year: 'numeric',
            })}
          </div>

          <div className="flex-1" />

          {/* Bouton Ouvrir */}
          <span
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              isAuthenticated
                ? 'text-sims-900 group-hover:scale-[1.02]'
                : 'text-white/30 cursor-pointer'
            )}
            style={{
              background: isAuthenticated ? '#00AADD' : 'rgba(255,255,255,0.05)',
            }}
          >
            {!isAuthenticated && <Lock className="w-3 h-3" />}
            {isAuthenticated
              ? <><span>{t('Ouvrir', 'Open')}</span><ExternalLink className="w-3 h-3" /></>
              : t('Connexion requise', 'Login required')
            }
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Mini stat chip ────────────────────────────────────────────
function StatChip({ icon: Icon, value, color, label }) {
  return (
    <div className="flex items-center gap-1 text-[10px]">
      <Icon className={clsx('w-3 h-3', color)} />
      <span className="text-white/50 font-medium">{value}</span>
      <span className="text-white/20">{label}</span>
    </div>
  )
}

// ─── Thème visuel selon le slug de l'app ──────────────────────
function getMapTheme(slug, color) {
  const s = (slug || '').toLowerCase()
  const c = color || '#00AADD'

  // ── Réseau électrique (eneo, elec, power, energie…) ──────────
  if (/eneo|elec|power|energie|energ/.test(s)) {
    return {
      accent: c,
      lines: (
        <>
          <polyline points="15,100 55,68 110,78 165,42 215,58 265,28"
                    fill="none" stroke="#dc2626" strokeWidth="2.5" opacity="0.75"/>
          <polyline points="25,118 72,90 128,104 185,78"
                    fill="none" stroke="#dc2626" strokeWidth="1.8" opacity="0.5"/>
          <polyline points="8,130 48,112 102,122 162,102 220,114 278,92"
                    fill="none" stroke="#d97706" strokeWidth="1.8" opacity="0.65"/>
          <polyline points="45,140 95,132 148,128 202,136"
                    fill="none" stroke="#d97706" strokeWidth="1.2" opacity="0.4"/>
          <polyline points="62,150 95,142 132,146 172,138"
                    fill="none" stroke="#16a34a" strokeWidth="1"   opacity="0.45"/>
          <polyline points="110,155 145,148 180,152"
                    fill="none" stroke="#16a34a" strokeWidth="0.8" opacity="0.3"/>
        </>
      ),
      nodes: (
        <>
          {[[55,68],[165,42],[215,58]].map(([x,y], i) => (
            <g key={`ps-${i}`}>
              <circle cx={x} cy={y} r="10" fill="#b45309" opacity="0.12"/>
              <circle cx={x} cy={y} r="6"  fill="#b45309" opacity="0.18"/>
              <circle cx={x} cy={y} r="3.5" fill="#f59e0b" opacity="0.9"/>
            </g>
          ))}
        </>
      ),
      dots: (
        <>
          {[[72,90],[128,104],[185,78],[102,122]].map(([x,y], i) => (
            <circle key={`pd-${i}`} cx={x} cy={y} r="2.5" fill="#22c55e" opacity="0.8"/>
          ))}
          {[[62,150],[95,142],[132,146],[172,138],[145,148]].map(([x,y], i) => (
            <circle key={`cl-${i}`} cx={x} cy={y} r="1.5" fill="#4ade80" opacity="0.5"/>
          ))}
        </>
      ),
    }
  }

  // ── Réseau hydraulique (camwater, water, eau, hydro…) ─────────
  if (/water|eau|camwater|hydro|sanit/.test(s)) {
    return {
      accent: '#0ea5e9',
      lines: (
        <>
          <polyline points="10,80 60,75 120,85 180,70 240,80 290,68"
                    fill="none" stroke="#0ea5e9" strokeWidth="3"   opacity="0.8"/>
          <polyline points="60,75 55,110 60,140"
                    fill="none" stroke="#38bdf8" strokeWidth="1.8" opacity="0.55"/>
          <polyline points="120,85 115,120 120,145"
                    fill="none" stroke="#38bdf8" strokeWidth="1.8" opacity="0.55"/>
          <polyline points="180,70 175,105 180,135"
                    fill="none" stroke="#38bdf8" strokeWidth="1.8" opacity="0.5"/>
          <polyline points="240,80 245,115"
                    fill="none" stroke="#38bdf8" strokeWidth="1.5" opacity="0.4"/>
          <polyline points="55,110 30,115 15,120"
                    fill="none" stroke="#7dd3fc" strokeWidth="1"   opacity="0.35"/>
          <polyline points="115,120 90,125 70,130"
                    fill="none" stroke="#7dd3fc" strokeWidth="1"   opacity="0.35"/>
          <polyline points="175,105 155,112 135,116"
                    fill="none" stroke="#7dd3fc" strokeWidth="1"   opacity="0.3"/>
        </>
      ),
      nodes: (
        <>
          {[[60,75],[180,70]].map(([x,y], i) => (
            <g key={`r-${i}`}>
              <circle cx={x} cy={y} r="12" fill="#0369a1" opacity="0.15"/>
              <circle cx={x} cy={y} r="7"  fill="#0284c7" opacity="0.25"/>
              <circle cx={x} cy={y} r="4"  fill="#38bdf8" opacity="0.9"/>
            </g>
          ))}
          {[[120,85],[240,80]].map(([x,y], i) => (
            <rect key={`v-${i}`} x={x-4} y={y-4} width="8" height="8" rx="1"
                  fill="#0ea5e9" opacity="0.7" transform={`rotate(45,${x},${y})`}/>
          ))}
        </>
      ),
      dots: (
        <>
          {[[55,110],[115,120],[175,105],[245,115],[30,115],[90,125]].map(([x,y], i) => (
            <circle key={`br-${i}`} cx={x} cy={y} r="2"   fill="#7dd3fc" opacity="0.7"/>
          ))}
          {[[15,120],[70,130],[135,116]].map(([x,y], i) => (
            <circle key={`pt-${i}`} cx={x} cy={y} r="1.5" fill="#bae6fd" opacity="0.45"/>
          ))}
        </>
      ),
    }
  }

  // ── Générique — courbes de niveau + réseau routier ────────────
  return {
    accent: c,
    lines: (
      <>
        <path d="M 20,130 Q 80,110 140,120 Q 200,130 270,115"
              fill="none" stroke={c} strokeWidth="1.5" opacity="0.5"/>
        <path d="M 30,105 Q 90,85 150,95 Q 210,105 275,90"
              fill="none" stroke={c} strokeWidth="1.2" opacity="0.38"/>
        <path d="M 45,80 Q 105,60 165,70 Q 220,78 270,62"
              fill="none" stroke={c} strokeWidth="1"   opacity="0.28"/>
        <path d="M 70,55 Q 130,38 185,48 Q 235,55 268,42"
              fill="none" stroke={c} strokeWidth="0.8" opacity="0.2"/>
        <polyline points="10,145 80,130 160,140 250,125 295,130"
                  fill="none" stroke="#f59e0b" strokeWidth="1.5" opacity="0.45"/>
        <polyline points="100,145 120,110 140,95 155,70"
                  fill="none" stroke="#f59e0b" strokeWidth="1"   opacity="0.3"/>
      </>
    ),
    nodes: (
      <>
        {[[80,130],[160,140],[220,110]].map(([x,y], i) => (
          <g key={`u-${i}`}>
            <circle cx={x} cy={y} r="9"   fill={c} opacity="0.1"/>
            <circle cx={x} cy={y} r="5"   fill={c} opacity="0.18"/>
            <circle cx={x} cy={y} r="2.5" fill={c} opacity="0.85"/>
          </g>
        ))}
      </>
    ),
    dots: (
      <>
        {[[50,115],[120,108],[185,118],[100,80],[145,95]].map(([x,y], i) => (
          <circle key={`p-${i}`} cx={x} cy={y} r="1.8" fill={c} opacity="0.55"/>
        ))}
        {[[35,135],[75,142],[125,138],[200,130]].map(([x,y], i) => (
          <circle key={`s-${i}`} cx={x} cy={y} r="1.2" fill={c} opacity="0.35"/>
        ))}
      </>
    ),
  }
}

// ─── Thumbnail carte CSS (art décoratif — générique) ──────────
function MapThumbnail({ app }) {
  const uid   = `grid-${app.id}`
  const color = app.config?.primary_color || '#00AADD'
  const theme = getMapTheme(app.slug, color)

  return (
    <div className="w-full h-full relative overflow-hidden"
         style={{ background: 'linear-gradient(135deg, #091627 0%, #0D1B2A 60%, #0f1f32 100%)' }}>

      {/* Grille lat/lon */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id={uid} width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M 28 0 L 0 0 0 28" fill="none" stroke={theme.accent} strokeWidth="0.4" opacity="0.15"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${uid})`} />
      </svg>

      {/* Réseau vectoriel (spécifique au type d'app) */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160">
        {theme.lines}
        {theme.nodes}
        {theme.dots}
      </svg>

      {/* Glow centré */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                      w-24 h-24 rounded-full pointer-events-none"
           style={{ background: `radial-gradient(circle, ${theme.accent}12 0%, transparent 70%)` }} />

      {/* Label flottant */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full animate-pulse"
             style={{ background: theme.accent }} />
        <span className="text-[10px] text-white/30 font-medium">Live GIS</span>
      </div>
    </div>
  )
}
