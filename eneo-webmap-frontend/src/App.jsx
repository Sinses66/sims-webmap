import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout      from './components/Layout/AppLayout'
import ProtectedRoute from './components/Auth/ProtectedRoute'
import PlatformHome   from './pages/PlatformHome'
import MapPage        from './pages/MapPage'
import LoginPage      from './pages/LoginPage'

/**
 * SIMS Online — Routing principal
 *
 *  /              → Page d'accueil plateforme (publique)
 *  /login         → Connexion
 *  /app/:appSlug  → Application GIS (protégée)
 *                   Incidents / Interventions s'ouvrent en panneau overlay
 *                   via uiStore.activePanel — pas de routes séparées.
 *  *              → Redirection vers /
 */
export default function App() {
  return (
    <Routes>
      {/* ── Page d'accueil plateforme (publique) ── */}
      <Route path="/" element={<PlatformHome />} />

      {/* ── Connexion ── */}
      <Route path="/login" element={<LoginPage />} />

      {/* ── Application GIS (protégée) ── */}
      <Route
        path="/app/:appSlug"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<MapPage />} />
        {/* Dashboard — P4 (à activer) */}
        {/* <Route path="dashboard" element={<DashboardPage />} /> */}
      </Route>

      {/* ── Catch-all ── */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
