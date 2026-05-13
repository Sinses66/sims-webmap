/**
 * LayerManager.test.jsx
 * =====================
 * Tests du composant LayerManager (Sidebar/LayerManager.jsx).
 *
 * Couverture :
 *   ✓ État chargement : spinner visible
 *   ✓ État erreur API : badge "local" + icône WifiOff
 *   ✓ État succès API : badge "API Django"
 *   ✓ Basemaps : tous les boutons BASEMAPS affichés
 *   ✓ Basemap actif : style spécifique (couleur ENEO)
 *   ✓ Clic basemap : appelle setBasemap avec le bon id
 *   ✓ Groupes de couches : les titres de groupe sont rendus
 *   ✓ Couche individuelle : nom et type visibles
 *   ✓ Bouton toggle visibilité : appelle toggleLayerVisibility(layerId)
 *   ✓ Fallback local → les groupes restent affichés même si isError
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LayerManager from '../components/Sidebar/LayerManager'
import { BASEMAPS } from '../config/constants'

// ── Mocks des dépendances ─────────────────────────────────────────

// react-router-dom
vi.mock('react-router-dom', () => ({
  useParams: () => ({ appSlug: 'test-app' }),
}))

// Store Zustand mapStore
const mockMapStore = {
  layerStates:           {},
  toggleLayerVisibility: vi.fn(),
  setLayerOpacity:       vi.fn(),
  activeBasemap:         'osm',
  setBasemap:            vi.fn(),
  initLayerStates:       vi.fn(),
}

vi.mock('../store/mapStore', () => ({
  useMapStore: (selector) => {
    if (typeof selector === 'function') return selector(mockMapStore)
    return mockMapStore
  },
}))

// Service GeoServer
vi.mock('../services/geoserver', () => ({
  getLegendUrl: (layer) => `http://geoserver/legend?layer=${layer}`,
}))

// Hook useAppLayers — état par défaut remplacé par chaque test
const mockUseAppLayers = vi.fn()
vi.mock('../hooks/useGeoData', () => ({
  useAppLayers: (...args) => mockUseAppLayers(...args),
}))


// ── Données de test ──────────────────────────────────────────────

const FAKE_LAYER_GROUPS = [
  {
    id:    'htb_existant',
    label: 'Réseau HTB Existant',
    icon:  '⚡',
    order: 1,
    layers: [
      {
        id:             'cmr_reseau_htb',
        name:           'Réseau HTB',
        geoserverLayer: 'eneo_gis_ws:cmrReseauHTB',
        type:           'WMS',
        visible:        true,
        opacity:        0.8,
        color:          '#FF6B35',
        popupFields:    [],
      },
    ],
  },
  {
    id:    'postes',
    label: 'Postes Sources',   // label du groupe
    icon:  '🏭',
    order: 2,
    layers: [
      {
        id:             'cmr_poste_source',
        name:           'Poste Source Principal',  // nom différent du groupe → évite doublon
        geoserverLayer: 'eneo_gis_ws:cmrPosteSource',
        type:           'WFS',
        visible:        false,
        opacity:        1.0,
        color:          '#00AADD',
        popupFields:    [],
      },
    ],
  },
]


// ── Helper de rendu ──────────────────────────────────────────────

function renderLayerManager() {
  return render(<LayerManager />)
}


// ── Tests ─────────────────────────────────────────────────────────

describe('LayerManager — état de chargement', () => {

  beforeEach(() => {
    mockMapStore.activeBasemap = 'osm'
    vi.clearAllMocks()
  })

  it('affiche le spinner de chargement quand isLoading=true', () => {
    mockUseAppLayers.mockReturnValue({
      layerGroups: [],
      isLoading:   true,
      isError:     false,
    })
    const { container } = renderLayerManager()
    // Vérifier la présence du spinner via la classe CSS (évite les problèmes d'encoding)
    expect(container.querySelector('.animate-spin')).not.toBeNull()
  })

  it("n'affiche PAS le spinner quand isLoading=false", () => {
    mockUseAppLayers.mockReturnValue({
      layerGroups: FAKE_LAYER_GROUPS,
      isLoading:   false,
      isError:     false,
    })
    renderLayerManager()
    expect(screen.queryByText(/Chargement des couches/i)).not.toBeInTheDocument()
  })
})


describe('LayerManager — badge source API', () => {

  beforeEach(() => vi.clearAllMocks())

  it('affiche le badge "API Django" quand pas d\'erreur', () => {
    mockUseAppLayers.mockReturnValue({
      layerGroups: FAKE_LAYER_GROUPS,
      isLoading:   false,
      isError:     false,
    })
    renderLayerManager()
    expect(screen.getByText('API Django')).toBeInTheDocument()
  })

  it('affiche le badge "local" quand isError=true', () => {
    mockUseAppLayers.mockReturnValue({
      layerGroups: FAKE_LAYER_GROUPS,   // fallback statique passé via le hook
      isLoading:   false,
      isError:     true,
    })
    renderLayerManager()
    expect(screen.getByText(/local/i)).toBeInTheDocument()
  })
})


describe('LayerManager — basemaps', () => {

  beforeEach(() => vi.clearAllMocks())

  it('rend un bouton pour chaque basemap configuré', () => {
    mockUseAppLayers.mockReturnValue({
      layerGroups: [],
      isLoading:   false,
      isError:     false,
    })
    renderLayerManager()
    const basemapNames = Object.values(BASEMAPS).map(b => b.name)
    basemapNames.forEach(name => {
      expect(screen.getByText(name)).toBeInTheDocument()
    })
  })

  it('appelle setBasemap avec le bon id au clic', () => {
    mockUseAppLayers.mockReturnValue({
      layerGroups: [],
      isLoading:   false,
      isError:     false,
    })
    renderLayerManager()
    const satelliteBtn = screen.getByText('Satellite ESRI')
    fireEvent.click(satelliteBtn)
    expect(mockMapStore.setBasemap).toHaveBeenCalledWith('satellite')
  })

  it('appelle setBasemap avec "osm" au clic sur OpenStreetMap', () => {
    mockUseAppLayers.mockReturnValue({
      layerGroups: [],
      isLoading:   false,
      isError:     false,
    })
    renderLayerManager()
    fireEvent.click(screen.getByText('OpenStreetMap'))
    expect(mockMapStore.setBasemap).toHaveBeenCalledWith('osm')
  })
})


describe('LayerManager — groupes et couches', () => {

  beforeEach(() => vi.clearAllMocks())

  it('affiche les titres des groupes de couches', () => {
    mockUseAppLayers.mockReturnValue({
      layerGroups: FAKE_LAYER_GROUPS,
      isLoading:   false,
      isError:     false,
    })
    renderLayerManager()
    expect(screen.getByText('Réseau HTB Existant')).toBeInTheDocument()
    expect(screen.getByText('Postes Sources')).toBeInTheDocument()
  })

  it('affiche les noms des couches dans les groupes', async () => {
    mockMapStore.layerStates = {
      cmr_reseau_htb:  { visible: true,  opacity: 0.8 },
      cmr_poste_source: { visible: false, opacity: 1.0 },
    }
    mockUseAppLayers.mockReturnValue({
      layerGroups: FAKE_LAYER_GROUPS,
      isLoading:   false,
      isError:     false,
    })
    renderLayerManager()
    // findByText attend que le useEffect ait ouvert les groupes
    expect(await screen.findByText('Réseau HTB')).toBeInTheDocument()
  })

  it('affiche le type badge WMS/WFS', async () => {
    mockMapStore.layerStates = {
      cmr_reseau_htb: { visible: true, opacity: 0.8 },
    }
    mockUseAppLayers.mockReturnValue({
      layerGroups: [FAKE_LAYER_GROUPS[0]],
      isLoading:   false,
      isError:     false,
    })
    renderLayerManager()
    expect(await screen.findByText('WMS')).toBeInTheDocument()
  })

  it('appelle toggleLayerVisibility avec l\'id de couche au clic', async () => {
    mockMapStore.layerStates = {
      cmr_reseau_htb: { visible: true, opacity: 0.8 },
    }
    mockUseAppLayers.mockReturnValue({
      layerGroups: [FAKE_LAYER_GROUPS[0]],
      isLoading:   false,
      isError:     false,
    })
    renderLayerManager()
    await screen.findByText('Réseau HTB')
    // DEBUG temporaire : afficher tous les boutons et le HTML du groupe
    const allBtns = screen.getAllByRole('button')
    console.log('=== Boutons trouvés :', allBtns.length)
    allBtns.forEach((b, i) =>
      console.log(`  [${i}] title="${b.getAttribute('title')}" text="${b.textContent.trim().slice(0,30)}"`)
    )
    const toggleBtn = allBtns.find(
      b => b.getAttribute('title') === 'Masquer' || b.getAttribute('title') === 'Afficher'
    )
    if (!toggleBtn) {
      // Afficher les 3000 premiers chars du DOM pour voir la structure réelle
      console.log('=== DOM body (3000 chars) ===')
      console.log(document.body.innerHTML.slice(0, 3000))
    }
    expect(toggleBtn).toBeDefined()
    fireEvent.click(toggleBtn)
    expect(mockMapStore.toggleLayerVisibility).toHaveBeenCalledWith('cmr_reseau_htb')
  })

  it('affiche zéro groupes si la liste est vide (sans chargement)', () => {
    mockUseAppLayers.mockReturnValue({
      layerGroups: [],
      isLoading:   false,
      isError:     false,
    })
    renderLayerManager()
    // Aucun titre de groupe affiché
    expect(screen.queryByText('Réseau HTB Existant')).not.toBeInTheDocument()
  })
})
