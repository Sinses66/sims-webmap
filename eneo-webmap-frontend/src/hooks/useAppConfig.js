/**
 * useAppConfig.js
 * ===============
 * Fetch la configuration d'une application SIMS depuis le Core.
 *
 * Endpoint : GET /api/applications/{slug}/config/
 * Réponse  :
 *   {
 *     slug, name,
 *     map: { center, zoom, zoom_min, zoom_max },
 *     modules: {
 *       incidents, interventions, analytics, export, editor
 *     },
 *     config: { ... couleurs, etc. }
 *   }
 *
 * Usage :
 *   const { modules, appMeta, mapConfig, isLoading } = useAppConfig('eneo')
 */

import { useQuery } from '@tanstack/react-query'
import { platformAPI } from '../services/api'

// ── Valeurs par défaut (tous modules actifs) ──────────────────────
// Utilisées si l'API est indisponible ou pendant le chargement.
// Garantit qu'aucun module n'est masqué par erreur réseau.
const DEFAULT_MODULES = {
  incidents:     true,
  interventions: true,
  analytics:     true,
  export:        true,
  editor:        false,
}

const DEFAULT_META = {
  name:     'Application',
  subtitle: '',
  color:    '#00AADD',
}

// ─────────────────────────────────────────────────────────────────
export function useAppConfig(appSlug) {
  const { data, isLoading, isError } = useQuery({
    queryKey:  ['app-config', appSlug],
    queryFn:   () => platformAPI.getAppConfig(appSlug).then(r => r.data),
    enabled:   !!appSlug,
    staleTime: 0,   // toujours rafraîchi — la config peut changer depuis l'admin
    retry:     1,
  })

  // Deuxième appel pour récupérer subtitle (pas dans /config/)
  const { data: appData } = useQuery({
    queryKey:  ['app', appSlug],
    queryFn:   () => platformAPI.getApplication(appSlug).then(r => r.data),
    enabled:   !!appSlug,
    staleTime: 0,
    retry:     1,
  })

  // ── Modules ───────────────────────────────────────────────────
  const modules = isError
    ? DEFAULT_MODULES
    : (data?.modules ?? DEFAULT_MODULES)

  // ── Métadonnées affichées dans Navbar + Sidebar ───────────────
  const appMeta = {
    name:     data?.name     ?? appData?.name     ?? DEFAULT_META.name,
    subtitle: appData?.subtitle                   ?? DEFAULT_META.subtitle,
    color:    appData?.config?.primary_color      ?? DEFAULT_META.color,
  }

  // ── Config carte ──────────────────────────────────────────────
  const mapConfig = data?.map ?? null

  return { modules, appMeta, mapConfig, isLoading }
}
