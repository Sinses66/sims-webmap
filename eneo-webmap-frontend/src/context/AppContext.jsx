/**
 * AppContext.jsx
 * =============
 * Contexte global d'une application SIMS Online.
 *
 * Expose à tous les composants enfants :
 *   - appSlug   : identifiant de l'app (ex: "eneo")
 *   - modules   : feature flags { incidents, interventions, analytics, export, editor }
 *   - appMeta   : { name, subtitle, color } — pour Navbar et Sidebar
 *   - mapConfig : { center, zoom, zoom_min, zoom_max } — pour MapView
 *   - isLoading : true pendant le premier fetch
 *
 * Usage :
 *   const { modules, appMeta } = useAppContext()
 *   if (!modules.incidents) return null
 */

import { createContext, useContext } from 'react'
import { useParams } from 'react-router-dom'
import { useAppConfig } from '../hooks/useAppConfig'

// ── Valeurs par défaut du contexte (avant fetch) ─────────────────
const DEFAULT_CONTEXT = {
  appSlug:   '',
  modules: {
    incidents:     true,
    interventions: true,
    analytics:     true,
    export:        true,
    editor:        false,
  },
  appMeta: {
    name:     'Application',
    subtitle: '',
    color:    '#00AADD',
  },
  mapConfig:  null,
  isLoading:  true,
}

const AppContext = createContext(DEFAULT_CONTEXT)

// ─────────────────────────────────────────────────────────────────
export function AppProvider({ children }) {
  const { appSlug } = useParams()
  const { modules, appMeta, mapConfig, isLoading } = useAppConfig(appSlug)

  return (
    <AppContext.Provider value={{ appSlug, modules, appMeta, mapConfig, isLoading }}>
      {children}
    </AppContext.Provider>
  )
}

// ─────────────────────────────────────────────────────────────────
export function useAppContext() {
  return useContext(AppContext)
}
