import { create } from 'zustand'
import { LAYER_GROUPS } from '../config/layers'
import { BASEMAPS, MAP_CENTER, MAP_ZOOM } from '../config/constants'

// État initial des visibilités des couches depuis la config
const initLayerState = () => {
  const state = {}
  LAYER_GROUPS.forEach(group => {
    group.layers.forEach(layer => {
      state[layer.id] = {
        visible: layer.visible,
        opacity: layer.opacity,
      }
    })
  })
  return state
}

export const useMapStore = create((set, get) => ({
  // ── Carte ──────────────────────────────────────────────────
  mapCenter:   MAP_CENTER,
  mapZoom:     MAP_ZOOM,
  mapInstance: null,   // référence Leaflet map

  setMapInstance: (map) => set({ mapInstance: map }),
  setMapView: (center, zoom) => set({ mapCenter: center, mapZoom: zoom }),

  // ── Fond de carte ──────────────────────────────────────────
  activeBasemap: 'osm',
  setBasemap: (id) => set({ activeBasemap: id }),

  // ── Couches ────────────────────────────────────────────────
  layerStates: initLayerState(),

  toggleLayerVisibility: (layerId) =>
    set(state => ({
      layerStates: {
        ...state.layerStates,
        [layerId]: {
          ...state.layerStates[layerId],
          visible: !state.layerStates[layerId]?.visible,
        },
      },
    })),

  setLayerOpacity: (layerId, opacity) =>
    set(state => ({
      layerStates: {
        ...state.layerStates,
        [layerId]: { ...state.layerStates[layerId], opacity },
      },
    })),

  // Initialise les états pour les couches venant de l'API
  // N'écrase pas les états déjà définis (ex: layer déjà masqué par l'utilisateur)
  initLayerStates: (layers) =>
    set(state => {
      const next = { ...state.layerStates }
      layers.forEach(layer => {
        if (!(layer.id in next)) {
          next[layer.id] = { visible: layer.visible ?? true, opacity: layer.opacity ?? 1 }
        }
      })
      return { layerStates: next }
    }),

  // ── Sélection / Popup ──────────────────────────────────────
  selectedFeature: null,
  setSelectedFeature: (feature) => set({ selectedFeature: feature }),
  clearSelectedFeature: () => set({ selectedFeature: null }),

  // ── Panneau latéral ────────────────────────────────────────
  sidebarPanel: 'layers',      // 'layers' | 'incidents' | 'interventions' | 'search' | 'analytics'
  sidebarOpen:  true,
  setSidebarPanel: (panel) => set({ sidebarPanel: panel, sidebarOpen: true }),
  toggleSidebar:   () => set(s => ({ sidebarOpen: !s.sidebarOpen })),

  // ── Pré-remplissage formulaire incident (depuis popup carte) ─
  // Schéma : {
  //   latitude, longitude,
  //   couche_id, couche_nom, feature_id, localisation,
  //   code_ouvrage,   // valeur du champ champ_cle dans les properties GeoServer
  //   nom_ouvrage,    // valeur du champ champ_nom dans les properties GeoServer
  //   type_ouvrage_id // id Django du TypeOuvrage correspondant au layer_key cliqué
  // }
  incidentPrefill: null,
  setIncidentPrefill: (data) => set({ incidentPrefill: data }),
  clearIncidentPrefill: () => set({ incidentPrefill: null }),

  // ── Couche incidents sur la carte ────────────────────────────
  showIncidentMarkers: true,
  toggleIncidentMarkers: () => set(s => ({ showIncidentMarkers: !s.showIncidentMarkers })),

  // ── Outil dessin / mesure ─────────────────────────────────
  // drawMode valeurs : null | 'measure_distance' | 'measure_area'
  //                  | 'draw_point' | 'draw_line' | 'draw_polygon' | 'draw_text'
  //                  | 'clear_drawn'
  drawMode: null,
  setDrawMode: (mode) => set({ drawMode: mode }),

  // Signal pour effacer tous les dessins depuis la toolbar
  clearDrawingsSignal: 0,
  signalClearDrawings: () => set(s => ({ clearDrawingsSignal: s.clearDrawingsSignal + 1, drawMode: null })),

  // Signal pour effacer les mesures depuis la toolbar
  clearMeasureSignal: 0,
  signalClearMeasure: () => set(s => ({ clearMeasureSignal: s.clearMeasureSignal + 1 })),

  // ── Interrogation / Sélection spatiale ────────────────────
  selectionResults: [],   // [{ feature, layerId, layerName }]
  setSelectionResults: (results) => set({ selectionResults: results }),
  clearSelectionResults: () => set({ selectionResults: [], drawMode: null }),

  // ── Filtres actifs ─────────────────────────────────────────
  filters: {
    tension:  [],      // ['HT', 'MT', 'BT']
    region:   null,
    statut:   null,
  },
  setFilter: (key, value) =>
    set(state => ({ filters: { ...state.filters, [key]: value } })),
  resetFilters: () =>
    set({ filters: { tension: [], region: null, statut: null } }),

  // ── Mode sombre ────────────────────────────────────────────
  darkMode: false,
  toggleDarkMode: () => set(s => ({ darkMode: !s.darkMode })),
}))
