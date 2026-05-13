import { useState } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import {
  User, LogOut, Sun, Moon, Settings,
  ChevronDown, Wifi, WifiOff, ChevronLeft, MapPin,
  Map, AlertTriangle, Wrench,
} from 'lucide-react'
import { useAuthStore }  from '../../store/authStore'
import { useMapStore }   from '../../store/mapStore'
import { useAppContext } from '../../context/AppContext'
import NotificationBell  from './NotificationBell'
import clsx from 'clsx'

// ── Onglets de navigation (filtrés par modules actifs) ────────────
const ALL_NAV_TABS = [
  { id: 'map',           label: 'Carte',         icon: Map,           moduleKey: null            },
  { id: 'incidents',     label: 'Incidents',     icon: AlertTriangle, moduleKey: 'incidents'     },
  { id: 'interventions', label: 'Interventions', icon: Wrench,        moduleKey: 'interventions' },
]

export default function Navbar() {
  const { user, logout }             = useAuthStore()
  const { darkMode, toggleDarkMode } = useMapStore()
  const { appMeta, modules, isLoading } = useAppContext()
  const navigate                     = useNavigate()
  const location                     = useLocation()
  const { appSlug }                  = useParams()
  const [menuOpen, setMenuOpen]      = useState(false)
  const [online]                     = useState(navigator.onLine)

  const base = `/app/${appSlug}`

  // Onglet actif déduit de l'URL (pas d'état local)
  const activeTab = location.pathname.startsWith(`${base}/interventions`) ? 'interventions'
                  : location.pathname.startsWith(`${base}/incidents`)     ? 'incidents'
                  : 'map'

  // Filtrer les onglets selon les modules activés pour cette application
  const visibleTabs = isLoading
    ? ALL_NAV_TABS.filter(t => t.moduleKey === null)
    : ALL_NAV_TABS.filter(t => t.moduleKey === null || modules[t.moduleKey] === true)

  const handleTabClick = (tabId) => {
    if (tabId === 'map') {
      navigate(base)
    } else {
      navigate(`${base}/${tabId}`)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/', { replace: true })
  }

  return (
    <header
      className="h-12 flex items-center px-3 gap-2 shrink-0 border-b border-cyan-500/10"
      style={{ background: '#0D1B2A', boxShadow: '0 1px 0 rgba(0,170,221,0.08)', position: 'relative', zIndex: 100 }}
    >

      {/* ── Retour plateforme ── */}
      <button
        onClick={() => navigate('/')}
        title="Retour à la plateforme"
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-white/30
                   hover:text-white/70 hover:bg-white/8 transition-all text-xs shrink-0"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        <span className="hidden sm:block">SIMS</span>
      </button>

      {/* Séparateur */}
      <div className="h-5 w-px bg-white/10 shrink-0" />

      {/* ── Identité application (dynamique depuis Core) ── */}
      <div className="flex items-center gap-2 shrink-0">
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            background: appMeta.color,
            boxShadow:  `0 0 6px ${appMeta.color}80`,
          }}
        />
        <div className="flex items-baseline gap-1.5">
          <span className="text-white font-bold text-sm">{appMeta.name}</span>
          {appMeta.subtitle && (
            <span className="text-white/30 text-xs hidden md:block">
              {appMeta.subtitle}
            </span>
          )}
        </div>
      </div>

      {/* Séparateur */}
      <div className="h-5 w-px bg-white/10 shrink-0 hidden sm:block" />

      {/* ── Onglets Carte / Incidents / Interventions ── */}
      <nav className="hidden sm:flex items-center gap-0.5 shrink-0">
        {visibleTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => handleTabClick(id)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              activeTab === id
                ? 'bg-cyan-500/15 text-cyan-300'
                : 'text-white/40 hover:text-white/70 hover:bg-white/6',
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden md:block">{label}</span>
          </button>
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* ── Indicateur connectivité ── */}
      <div
        title={online ? 'En ligne' : 'Hors ligne'}
        className={clsx(
          'flex items-center gap-1.5 text-xs px-2 py-1 rounded-full',
          online ? 'text-green-400' : 'text-red-400',
        )}
      >
        {online
          ? <Wifi    className="w-3.5 h-3.5" />
          : <WifiOff className="w-3.5 h-3.5" />
        }
        <span className="hidden lg:block">{online ? 'En ligne' : 'Hors ligne'}</span>
      </div>

      {/* ── Cloche notifications ── */}
      <NotificationBell />

      {/* ── Toggle dark/light ── */}
      <button
        onClick={toggleDarkMode}
        className="p-2 rounded-lg hover:bg-white/8 text-white/50 hover:text-white transition-colors"
        title={darkMode ? 'Mode clair' : 'Mode sombre'}
      >
        {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      {/* ── Menu utilisateur ── */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/8
                     text-white transition-colors"
        >
          <div className="w-6 h-6 rounded-full overflow-hidden border border-cyan-500/35
                          flex items-center justify-center shrink-0 bg-cyan-500/15">
            {user?.avatar
              ? <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
              : <User className="w-3.5 h-3.5 text-cyan-400" />
            }
          </div>
          <span className="text-sm hidden sm:block max-w-[120px] truncate">
            {user?.first_name || user?.username || 'Utilisateur'}
          </span>
          <ChevronDown className={clsx(
            'w-3.5 h-3.5 text-white/35 transition-transform',
            menuOpen && 'rotate-180',
          )} />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0" style={{ zIndex: 98 }} onClick={() => setMenuOpen(false)} />
            <div
              className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-cyan-500/15
                          shadow-2xl overflow-hidden animate-fade-in"
              style={{ background: '#132337', zIndex: 99 }}
            >
              {/* Infos utilisateur */}
              <div className="px-4 py-3 border-b border-white/8 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-cyan-500/40
                                flex items-center justify-center shrink-0 bg-cyan-500/15">
                  {user?.avatar
                    ? <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
                    : <span className="w-full h-full flex items-center justify-center
                                       text-cyan-400 font-bold text-sm">
                        {(user?.first_name?.[0] || user?.username?.[0] || '?').toUpperCase()}
                      </span>
                  }
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-semibold text-white truncate">
                    {user?.first_name} {user?.last_name}
                  </p>
                  <p className="text-xs text-white/35 mt-0.5 truncate">{user?.email}</p>
                  {user?.role && (
                    <span className="badge badge-info mt-1">{user.role}</span>
                  )}
                </div>
              </div>

              <div className="py-1">
                <button
                  onClick={() => { setMenuOpen(false); navigate('/') }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm
                             text-white/55 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <MapPin className="w-4 h-4" />
                  Accueil plateforme
                </button>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm
                             text-white/55 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Paramètres
                </button>
              </div>

              <div className="border-t border-white/8 py-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm
                             text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Déconnexion
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
