import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { incidentAPI, interventionAPI, platformAPI, referentielAPI, ouvrageAPI } from '../services/api'
import { getWFSFeatures } from '../services/geoserver'

import { useMapStore } from '../store/mapStore'
import toast from 'react-hot-toast'

// ── Couches dynamiques depuis Django ─────────────────────────

/**
 * Transforme la réponse plate de l'API Django en format LAYER_GROUPS.
 * Compatible avec le format statique de layers.js (fallback offline).
 *
 * Champs attendus de l'API (fournis par ApplicationLayerSerializer) :
 *   layer_key, name, description, geoserver_layer, layer_type,
 *   group (= group_slug), group_label, group_icon, group_order,
 *   visible (= visible_default), opacity (= opacity_default), color
 */
export function buildLayerGroups(apiLayers = []) {
  const groupMap   = {}
  const groupOrder = []

  apiLayers.forEach(layer => {
    const gid = layer.group || layer.group_slug || 'default'
    if (!groupMap[gid]) {
      groupMap[gid] = {
        id:     gid,
        label:  layer.group_label || layer.group_name || gid,
        icon:   layer.group_icon  || '🗺️',
        order:  layer.group_order ?? 99,
        layers: [],
      }
      groupOrder.push(gid)
    }
    groupMap[gid].layers.push({
      id:             layer.layer_key   || String(layer.id),
      name:           layer.name,
      geoserverLayer: layer.geoserver_layer,
      type:           layer.layer_type  || 'WMS',
      visible:        layer.visible     ?? layer.visible_default ?? true,
      opacity:        layer.opacity     ?? layer.opacity_default ?? 1,
      color:          layer.color       || '#6366f1',
      description:    layer.description || '',
      popupFields:    layer.popup_fields || [],  // [] = tous les attributs
    })
  })

  return groupOrder
    .map(gid => groupMap[gid])
    .sort((a, b) => a.order - b.order)
}

/**
 * Récupère les couches d'une application depuis l'API Django.
 *
 * - Si l'API répond : construit les groupes dynamiquement et initialise
 *   le store Zustand (initLayerStates) pour les nouvelles couches.
 * - Si l'API est indisponible ou renvoie une liste vide :
 *   fallback sur LAYER_GROUPS statique (config/layers.js).
 */
export function useAppLayers(appSlug) {
  const initLayerStates = useMapStore(s => s.initLayerStates)

  const query = useQuery({
    queryKey:  ['app-layers', appSlug],
    queryFn:   () => platformAPI.getAppLayers(appSlug).then(r => Array.isArray(r.data) ? r.data : (r.data.results ?? r.data)),
    staleTime: 1000 * 60 * 5,   // 5 min de cache
    enabled:   !!appSlug,
    retry:     1,
  })

  // Dès que l'API répond, on initialise les états Zustand
  // pour les couches qui n'ont pas encore d'état (nouvelles couches ajoutées)
  useEffect(() => {
    if (query.data && query.data.length > 0) {
      const layers = query.data.map(l => ({
        id:      l.layer_key || String(l.id),
        visible: l.visible   ?? l.visible_default ?? true,
        opacity: l.opacity   ?? l.opacity_default ?? 1,
      }))
      initLayerStates(layers)
    }
  }, [query.data, initLayerStates])

  // Si l'API répond avec des couches → on les utilise
  // Si erreur réseau/auth → fallback sur config statique (dev offline)
  // Si API vide (aucune couche configurée) → tableau vide
  const layerGroups = (query.data && query.data.length > 0)
    ? buildLayerGroups(query.data)
    : []             // API ok mais aucune couche configurée

  return { ...query, layerGroups }
}

// ── WFS (GeoServer) ──────────────────────────────────────────
export function useWFSLayer(layerName, options = {}, enabled = true) {
  return useQuery({
    queryKey: ['wfs', layerName, options],
    queryFn: () => getWFSFeatures(layerName, options),
    enabled,
    staleTime: 1000 * 60 * 2,
  })
}

// ── Incidents ────────────────────────────────────────────────
export function useIncidents(params = {}) {
  return useQuery({
    queryKey: ['incidents', params],
    queryFn: () => incidentAPI.list(params).then(r => r.data),
    refetchInterval: 1000 * 30,  // actualisation auto toutes les 30s
  })
}

export function useIncident(id) {
  return useQuery({
    queryKey: ['incident', id],
    queryFn: () => incidentAPI.get(id).then(r => r.data),
    enabled: !!id,
  })
}

export function useIncidentStats() {
  return useQuery({
    queryKey: ['incidents', 'stats'],
    queryFn: () => incidentAPI.stats().then(r => r.data),
    refetchInterval: 1000 * 60,
  })
}

export function useUploadIncidentPhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, file, legende }) => {
      const fd = new FormData()
      fd.append('image', file)
      if (legende) fd.append('legende', legende)
      return incidentAPI.uploadPhoto(id, fd).then(r => r.data)
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['incident', id] })
      toast.success('Photo ajoutée')
    },
    onError: () => toast.error('Erreur lors de l\'upload'),
  })
}

export function useUploadInterventionPhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, file, legende }) => {
      const fd = new FormData()
      fd.append('image', file)
      if (legende) fd.append('legende', legende)
      return interventionAPI.uploadPhoto(id, fd).then(r => r.data)
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['interventions'] })
      toast.success('Photo de clôture ajoutée')
    },
    onError: () => toast.error('Erreur lors de l\'upload de la photo'),
  })
}

export function useCreateIncident() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => incidentAPI.create(data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incidents'] })
      toast.success('Incident créé avec succès')
    },
    onError: () => toast.error('Erreur lors de la création de l\'incident'),
  })
}

export function useUpdateIncident() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => incidentAPI.update(id, data).then(r => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['incidents'] })
      qc.invalidateQueries({ queryKey: ['incident', id] })
      toast.success('Incident mis à jour')
    },
    onError: () => toast.error('Erreur de mise à jour'),
  })
}

/** Assigne un incident à un utilisateur (POST /incidents/{id}/assigner/) */
export function useAssignIncident() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, userId }) =>
      incidentAPI.assign(id, userId).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incidents'] })
      toast.success('Incident assigné')
    },
    onError: (err) => {
      const msg = err?.response?.data?.user_id?.[0] || 'Erreur lors de l\'assignation'
      toast.error(msg)
    },
  })
}

/** Marque un incident comme résolu (PATCH statut → resolu) */
export function useResolveIncident() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) =>
      incidentAPI.update(id, { statut: 'resolu' }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incidents'] })
      toast.success('Incident marqué comme résolu ✓')
    },
    onError: () => toast.error('Erreur lors de la résolution'),
  })
}

// ── Interventions ────────────────────────────────────────────
export function useInterventions(params = {}) {
  return useQuery({
    queryKey: ['interventions', params],
    queryFn: () => interventionAPI.list(params).then(r => r.data),
  })
}

export function useCreateIntervention() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => interventionAPI.create(data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['interventions'] })
      toast.success('Intervention planifiée')
    },
    onError: () => toast.error('Erreur lors de la planification'),
  })
}

/** Démarre une intervention et assigne un responsable (POST /interventions/{id}/assigner/) */
export function useAssignIntervention() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, userId }) =>
      interventionAPI.assign(id, userId).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['interventions'] })
      qc.invalidateQueries({ queryKey: ['incidents'] })   // cascade statut incident
      toast.success('Intervention démarrée')
    },
    onError: (err) => {
      const msg = err?.response?.data?.user_id?.[0] || 'Erreur lors du démarrage'
      toast.error(msg)
    },
  })
}

/** Clôture une intervention avec un rapport optionnel (POST /interventions/{id}/cloturer/) */
export function useCloturerIntervention() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, rapport }) =>
      interventionAPI.close(id, rapport ?? '').then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['interventions'] })
      qc.invalidateQueries({ queryKey: ['incidents'] })   // cascade statut incident
      toast.success('Intervention clôturée ✓')
    },
    onError: () => toast.error('Erreur lors de la clôture'),
  })
}

/** Liste des profils utilisateurs pour les sélecteurs d'assignation */
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () =>
      platformAPI.listUserProfiles().then(r => {
        const list = Array.isArray(r.data) ? r.data : (r.data.results ?? [])
        // Normalise : garantit { id (User.id), username, fullName }
        return list.map(p => ({
          id:       p.user_id ?? p.user ?? p.id,
          username: p.username ?? p.user_detail?.username ?? `user-${p.id}`,
          fullName: (p.full_name ?? p.user_detail?.full_name
                    ?? `${p.user_detail?.first_name ?? ''} ${p.user_detail?.last_name ?? ''}`.trim())
                    || p.username || `Utilisateur ${p.id}`,
          role:     p.role ?? '',
        }))
      }),
    staleTime: 1000 * 60 * 10,  // 10 min — liste stable
    retry: 1,
  })
}

// ── Référentiels ─────────────────────────────────────────────

/** Liste des types d'incidents (administrables depuis l'admin Django) */
export function useTypeIncidents() {
  return useQuery({
    queryKey: ['types-incident'],
    queryFn: () => referentielAPI.listTypesIncident({ actif: true })
      .then(r => Array.isArray(r.data) ? r.data : (r.data.results ?? [])),
    staleTime: 1000 * 60 * 10,  // 10 min — stable
    retry: 1,
  })
}

/** Liste des équipes actives (administrables depuis l'admin Django) */
export function useEquipes() {
  return useQuery({
    queryKey: ['equipes'],
    queryFn: () => referentielAPI.listEquipes({ actif: true })
      .then(r => Array.isArray(r.data) ? r.data : (r.data.results ?? [])),
    staleTime: 1000 * 60 * 10,
    retry: 1,
  })
}

/** Liste légère des incidents ouverts/en cours pour le sélecteur du formulaire Intervention */
export function useIncidentsSelect() {
  return useQuery({
    queryKey: ['incidents-select'],
    queryFn: () => referentielAPI.listIncidentsSelect()
      .then(r => Array.isArray(r.data) ? r.data : (r.data.results ?? [])),
    staleTime: 1000 * 30,  // 30s — se rafraîchit souvent
    retry: 1,
  })
}

// ── Ouvrages ─────────────────────────────────────────────────

/** Liste des types d'ouvrages (pour le sélecteur dans le formulaire) */
export function useTypeOuvrages() {
  return useQuery({
    queryKey: ['types-ouvrage'],
    queryFn: () => ouvrageAPI.listTypesOuvrage({ actif: true })
      .then(r => Array.isArray(r.data) ? r.data : (r.data.results ?? [])),
    staleTime: 1000 * 60 * 10,
    retry: 1,
  })
}

/**
 * Recherche un ouvrage par son code exact.
 * Activé seulement si `code` est non-vide (déclenché depuis la carte ou la saisie manuelle).
 */
export function useOuvrageByCode(code) {
  return useQuery({
    queryKey: ['ouvrage-by-code', code],
    queryFn: () => ouvrageAPI.getByCode(code)
      .then(r => {
        const list = Array.isArray(r.data) ? r.data : (r.data.results ?? [])
        return list[0] ?? null   // premier résultat ou null si introuvable
      }),
    enabled: !!code && code.trim().length >= 2,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  })
}

/** Crée un nouvel ouvrage (appelé quand l'ouvrage est inconnu de la base) */
export function useCreateOuvrage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => ouvrageAPI.create(data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ouvrage-by-code'] })
      toast.success('Ouvrage enregistré')
    },
    onError: (err) => {
      const msg = err?.response?.data?.code?.[0] || 'Erreur lors de l\'enregistrement'
      toast.error(msg)
    },
  })
}

