import axios from 'axios'
import toast from 'react-hot-toast'

const TOKEN_KEY   = 'sims_token'
const REFRESH_KEY = 'sims_refresh'

// ── Client Axios ─────────────────────────────────────────────
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

// ── Injection du token JWT ────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Refresh token automatique ─────────────────────────────────
// Si une requête retourne 401, on tente un refresh silencieux.
// Si le refresh échoue → déconnexion + redirection /login.
let isRefreshing    = false
let pendingRequests = []   // requêtes en attente pendant le refresh

function processQueue(error, token = null) {
  pendingRequests.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(token)
  )
  pendingRequests = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config

    // 401 sur la route de refresh elle-même → déconnexion
    if (error.response?.status === 401 && original.url?.includes('/auth/token/refresh/')) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(REFRESH_KEY)
      window.location.href = '/login'
      return Promise.reject(error)
    }

    // 401 sur n'importe quelle autre route → tenter le refresh
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refreshToken = localStorage.getItem(REFRESH_KEY)

      if (!refreshToken) {
        localStorage.removeItem(TOKEN_KEY)
        window.location.href = '/login'
        return Promise.reject(error)
      }

      if (isRefreshing) {
        // D'autres requêtes attendent le nouveau token
        return new Promise((resolve, reject) => {
          pendingRequests.push({ resolve, reject })
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`
          return api(original)
        })
      }

      isRefreshing = true

      try {
        const { data } = await axios.post('/api/auth/token/refresh/', { refresh: refreshToken })
        const newToken = data.access

        localStorage.setItem(TOKEN_KEY, newToken)
        api.defaults.headers.common.Authorization = `Bearer ${newToken}`

        processQueue(null, newToken)
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      } catch (refreshError) {
        processQueue(refreshError)
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(REFRESH_KEY)
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    if (error.response?.status >= 500) {
      toast.error('Erreur serveur. Veuillez réessayer.')
    }

    return Promise.reject(error)
  },
)

// ── Auth ─────────────────────────────────────────────────────
export const authAPI = {
  login:   (credentials) => api.post('/auth/token/', credentials),
  refresh: (refresh)     => api.post('/auth/token/refresh/', { refresh }),
  me:      ()            => api.get('/platform/me/'),
}

// ── Platform (SIMS Core) ──────────────────────────────────────
export const platformAPI = {
  // Applications
  listApplications:  ()       => api.get('/applications/'),
  getApplication:    (slug)   => api.get(`/applications/${slug}/`),
  getAppConfig:      (slug)   => api.get(`/applications/${slug}/config/`),
  getAppLayers:      (slug)   => api.get(`/app-layers/?application=${slug}`),
  createApplication: (data)   => api.post('/applications/', data),

  // Organisations
  listOrganisations: ()       => api.get('/organisations/'),

  // Profil plateforme
  myProfile:         ()       => api.get('/platform/me/'),
  listUserProfiles:  ()       => api.get('/user-profiles/'),

  // Annotations
  listAnnotations:   (appSlug) => api.get('/annotations/', { params: { application: appSlug } }),
  createAnnotation:  (data)    => api.post('/annotations/', data),
  deleteAnnotation:  (id)      => api.delete(`/annotations/${id}/`),

  // Bookmarks
  listBookmarks:     (appSlug) => api.get('/bookmarks/', { params: { application: appSlug } }),
  createBookmark:    (data)    => api.post('/bookmarks/', data),
  deleteBookmark:    (id)      => api.delete(`/bookmarks/${id}/`),
}

// ── Référentiels (TypeIncident, Equipe) ───────────────────────
export const referentielAPI = {
  listTypesIncident:   (params) => api.get('/types-incident/',    { params }),
  listEquipes:         (params) => api.get('/equipes/',           { params }),
  listIncidentsSelect: (params) => api.get('/incidents-select/',  { params }),
}

// ── Ouvrages ─────────────────────────────────────────────────
export const ouvrageAPI = {
  // Types d'ouvrages (read-only, administrés depuis Django admin)
  listTypesOuvrage: (params)  => api.get('/types-ouvrage/',  { params }),

  // Ouvrages
  list:             (params)  => api.get('/ouvrages/',        { params }),
  getByCode:        (code)    => api.get('/ouvrages/',        { params: { code } }),
  get:              (id)      => api.get(`/ouvrages/${id}/`),
  create:           (data)    => api.post('/ouvrages/',       data),
  update:           (id, data) => api.patch(`/ouvrages/${id}/`, data),
}

// ── Incidents ────────────────────────────────────────────────
export const incidentAPI = {
  list:    (params)      => api.get('/incidents/',              { params }),
  get:     (id)          => api.get(`/incidents/${id}/`),
  create:  (data)        => api.post('/incidents/',             data),
  update:  (id, data)    => api.patch(`/incidents/${id}/`,      data),
  delete:  (id)          => api.delete(`/incidents/${id}/`),
  stats:   ()            => api.get('/incidents/stats/'),
  assign:  (id, userId)  => api.post(`/incidents/${id}/assigner/`, { user_id: userId }),
  // Upload photo (multipart/form-data)
  uploadPhoto: (id, formData) => api.post(
    `/incidents/${id}/photos/`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  ),
}

// ── Interventions ────────────────────────────────────────────
export const interventionAPI = {
  list:    (params) => api.get('/interventions/',    { params }),
  get:     (id)     => api.get(`/interventions/${id}/`),
  create:  (data)   => api.post('/interventions/',   data),
  update:  (id, data) => api.patch(`/interventions/${id}/`, data),
  // Note : le backend AssignerIncidentSerializer attend { user_id }, pas { agent_id }.
  assign:  (id, userId) => api.post(`/interventions/${id}/assigner/`, { user_id: userId }),
  close:   (id, rapport) => api.post(`/interventions/${id}/cloturer/`, { rapport }),
  uploadPhoto: (id, formData) => api.post(
    `/interventions/${id}/photos/`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  ),
}

// ── Notifications (polling) ──────────────────────────────────
export const notificationAPI = {
  /**
   * Récupère les événements survenus depuis `since` (ISO 8601).
   * Si `since` est null → le backend retourne les 5 dernières minutes.
   */
  feed: (since = null) => api.get('/notifications/feed/', {
    params: since ? { since } : {},
  }),
}

// ── Recherche ────────────────────────────────────────────────
export const searchAPI = {
  global:  (q)      => api.get('/search/', { params: { q } }),
  geocode: (address) => api.get('/geocode/', { params: { address } }),
}

export default api
