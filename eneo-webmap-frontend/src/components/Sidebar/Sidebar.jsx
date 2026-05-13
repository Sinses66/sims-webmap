import { Layers, AlertTriangle, Wrench, Search, BarChart2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMapStore }   from '../../store/mapStore'
import { useAppContext } from '../../context/AppContext'
import { useIncidentStats } from '../../hooks/useGeoData'
import LayerManager         from './LayerManager'
import IncidentPanelMini    from '../Incidents/IncidentPanelMini'
import InterventionPanelMini from '../Interventions/InterventionPanelMini'
import SearchPanel          from './SearchPanel'
import AnalyticsPanel       from './AnalyticsPanel'
import clsx from 'clsx'

// ── Tous les onglets possibles ────────────────────────────────────
// `moduleKey` correspond à la clé dans modules (null = toujours visible)
const ALL_NAV_ITEMS = [
  { id: 'layers',        label: 'Couches',      icon: Layers,        moduleKey: null          },
  { id: 'incidents',     label: 'Incidents',    icon: AlertTriangle, moduleKey: 'incidents'   },
  { id: 'interventions', label: 'Interventions',icon: Wrench,        moduleKey: 'interventions'},
  { id: 'search',        label: 'Recherche',    icon: Search,        moduleKey: null          },
  { id: 'analytics',     label: 'Statistiques', icon: BarChart2,     moduleKey: 'analytics'   },
]

// ── Couleur d'accent par onglet ───────────────────────────────────
const ACCENT = {
  layers:        '#00AADD',
  incidents:     '#FF4757',
  interventions: '#F59E0B',
  search:        '#10B981',
  analytics:     '#8B5CF6',
}

export default function Sidebar() {
  const { sidebarPanel, sidebarOpen, setSidebarPanel, toggleSidebar } = useMapStore()
  const { modules, appMeta, isLoading } = useAppContext()   // ← feature flags + nom app
  const { data: stats } = useIncidentStats()
  const incidentsOuverts = stats?.ouverts ?? 0

  // ── Filtrer les onglets selon les modules actifs ──────────────
  // On attend la fin du chargement pour filtrer — évite le flash
  // des onglets par défaut (tous actifs) avant que l'API réponde.
  const navItems = isLoading
    ? ALL_NAV_ITEMS.filter(item => item.moduleKey === null)  // pendant le chargement : couches + recherche seulement
    : ALL_NAV_ITEMS.filter(item =>
        item.moduleKey === null ? true : modules[item.moduleKey] === true
      )

  // ── Si le panel actif est masqué, basculer sur 'layers' ──────
  const activePanel = navItems.find(i => i.id === sidebarPanel)
    ? sidebarPanel
    : 'layers'

  return (
    <div
      className={clsx(
        'flex flex-col h-full transition-all duration-300 overflow-hidden shrink-0',
        sidebarOpen ? 'w-80' : 'w-14',
      )}
      style={{ background: '#132337', borderRight: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-3 py-3 shrink-0"
        style={{ background: '#0D1B2A', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        {sidebarOpen && (
          <div className="flex items-center gap-2.5 overflow-hidden">
            {/* Logo pill — initiale du nom de l'app */}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-black text-white text-xs"
              style={{ background: `linear-gradient(135deg, ${appMeta.color}, ${appMeta.color}88)` }}
            >
              {appMeta.name?.charAt(0).toUpperCase() ?? 'S'}
            </div>
            <div className="overflow-hidden">
              <p className="text-white font-semibold text-sm leading-tight truncate">
                {appMeta.name}
              </p>
              <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {appMeta.subtitle || 'Webmapping SIMS'}
              </p>
            </div>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg transition-colors ml-auto shrink-0"
          style={{ color: 'rgba(255,255,255,0.5)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
          title={sidebarOpen ? 'Réduire' : 'Agrandir'}
        >
          {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {/* ── Navigation — onglets filtrés selon modules ─────────── */}
      <nav
        className="flex flex-col gap-0.5 px-2 py-2 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        {navItems.map(({ id, label, icon: Icon }) => {
          const active = activePanel === id
          const accent = ACCENT[id]
          return (
            <button
              key={id}
              onClick={() => setSidebarPanel(id)}
              title={!sidebarOpen ? label : undefined}
              className="flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 text-left"
              style={active
                ? { background: `${accent}20`, color: accent, boxShadow: `inset 3px 0 0 ${accent}` }
                : { color: 'rgba(255,255,255,0.55)' }
              }
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#fff' } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' } }}
            >
              <Icon className="w-4.5 h-4.5 shrink-0" style={{ width: '1.1rem', height: '1.1rem' }} />
              {sidebarOpen && <span className="truncate">{label}</span>}

              {/* Badge incidents ouverts */}
              {sidebarOpen && id === 'incidents' && incidentsOuverts > 0 && (
                <span
                  className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ background: '#FF4757', color: '#fff' }}
                >
                  {incidentsOuverts > 99 ? '99+' : incidentsOuverts}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* ── Panel content ──────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="flex-1 overflow-y-auto"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.15) transparent' }}
        >
          {activePanel === 'layers'        && <LayerManager />}
          {activePanel === 'incidents'     && modules.incidents     && <IncidentPanelMini />}
          {activePanel === 'interventions' && modules.interventions && <InterventionPanelMini />}
          {activePanel === 'search'        && <SearchPanel />}
          {activePanel === 'analytics'     && modules.analytics     && <AnalyticsPanel />}
        </div>
      )}
    </div>
  )
}
