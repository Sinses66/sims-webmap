import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar        from './Navbar'
import PanelOverlay  from './PanelOverlay'
import { AppProvider }      from '../../context/AppContext'
import { useAuthStore }     from '../../store/authStore'
import { authAPI }          from '../../services/api'
import { useNotifications } from '../../hooks/useNotifications'

/**
 * Layout principal de l'application :
 *   [ Navbar (haut, fixe) ]
 *   [ main : position:relative ]
 *     ├── Outlet  (MapPage — toujours rendu en dessous)
 *     └── PanelOverlay (slide-in par-dessus la carte si activePanel ≠ null)
 *
 * Re-fetch le profil utilisateur au montage si le token est présent
 * mais que l'objet user a été perdu (rechargement de page).
 *
 * Lance également le polling de notifications (toutes les 30 s).
 */
function AppLayoutInner() {
  const user    = useAuthStore(s => s.user)
  const token   = useAuthStore(s => s.token)
  const setUser = useAuthStore(s => s.setUser)

  // ── Polling notifications ──────────────────────────────────
  useNotifications()

  // ── Rechargement du profil après refresh de page ───────────
  useEffect(() => {
    if (!user && token) {
      authAPI.me()
        .then(({ data }) => setUser(data))
        .catch(() => { /* token expiré → le refresh interceptor gère la déconnexion */ })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: '#1A2E45' }}>
      <Navbar />
      <main className="flex-1 overflow-hidden relative">
        {/* Carte toujours visible */}
        <Outlet />
        {/* Panneau incidents / interventions par-dessus */}
        <PanelOverlay />
      </main>
    </div>
  )
}

export default function AppLayout() {
  return (
    <AppProvider>
      <AppLayoutInner />
    </AppProvider>
  )
}
