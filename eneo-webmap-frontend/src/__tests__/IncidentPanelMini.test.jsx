/**
 * IncidentPanelMini.test.jsx
 * ==========================
 * Tests du composant IncidentPanelMini (Incidents/IncidentPanelMini.jsx).
 *
 * Couverture :
 *   ✓ État chargement : spinner rouge visible
 *   ✓ État vide (0 incidents) : message "Aucun incident" visible
 *   ✓ État avec données : les cartes d'incidents sont rendues
 *   ✓ Bouton "Nouveau" : toggle le formulaire à l'affichage
 *   ✓ Formulaire : titre est vide → bouton Déclarer désactivé
 *   ✓ Formulaire : titre rempli → bouton Déclarer activé
 *   ✓ Formulaire : clic Annuler ferme le formulaire
 *   ✓ Auto-ouverture du formulaire si incidentPrefill est défini
 *   ✓ StatsBar absente si useIncidentStats retourne null
 *   ✓ StatsBar présente si useIncidentStats retourne des stats
 *   ✓ Bouton export CSV affiché uniquement si incidents.length > 0
 *   ✓ Bouton toggle carte (Map) présent
 *
 *   Permissions (usePermissions)
 *   ✓ Bouton "Nouveau" visible si canWrite=true
 *   ✓ Bouton "Nouveau" masqué si canWrite=false (lecteur)
 *   ✓ Badge "Lecture" affiché pour isLecteur=true
 *   ✓ Badge "Lecture" absent pour canWrite=true
 *   ✓ Formulaire ne s'auto-ouvre pas si canWrite=false même avec prefill
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import IncidentPanelMini from '../components/Incidents/IncidentPanelMini'

// ── Mocks ─────────────────────────────────────────────────────────

// date-fns : pas de mock nécessaire, jsdom gère bien les dates

// Store Zustand
const mockMapStore = {
  incidentPrefill:       null,
  clearIncidentPrefill:  vi.fn(),
  showIncidentMarkers:   true,
  toggleIncidentMarkers: vi.fn(),
}

vi.mock('../store/mapStore', () => ({
  useMapStore: (selector) => {
    if (typeof selector === 'function') return selector(mockMapStore)
    return mockMapStore
  },
}))

// Hooks react-query wrappés
const mockUseIncidents    = vi.fn()
const mockUseIncidentStats = vi.fn()
const mockUseCreateIncident = vi.fn()

vi.mock('../hooks/useGeoData', () => ({
  useIncidents:            (...args) => mockUseIncidents(...args),
  useIncidentStats:        (...args) => mockUseIncidentStats(...args),
  useCreateIncident:       (...args) => mockUseCreateIncident(...args),
  useTypeIncidents:        () => ({ data: [] }),
  useTypeOuvrages:         () => ({ data: [] }),
  useOuvrageByCode:        () => ({ data: null, isFetching: false }),
  useCreateOuvrage:        () => ({ mutate: vi.fn(), isPending: false }),
  useEquipes:              () => ({ data: [] }),
  useUsers:                () => ({ data: [] }),
  useUpdateIncident:       () => ({ mutate: vi.fn(), isPending: false }),
  useUploadIncidentPhoto:  () => ({ mutate: vi.fn(), isPending: false }),
  useAssignIncident:       () => ({ mutate: vi.fn(), isPending: false }),
  useResolveIncident:      () => ({ mutate: vi.fn(), isPending: false }),
  useInterventions:        () => ({ data: [] }),
  useCreateIntervention:   () => ({ mutate: vi.fn(), isPending: false }),
}))

// react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

// usePermissions — par défaut : opérateur (canWrite=true, isLecteur=false)
const mockPermissions = {
  role:        'operateur',
  loading:     false,
  isAdmin:     false,
  isOperateur: true,
  isLecteur:   false,
  canWrite:    true,
  canDelete:   false,
  canExport:   true,
}

vi.mock('../hooks/usePermissions', () => ({
  usePermissions: () => mockPermissions,
}))


// ── Données de test ──────────────────────────────────────────────

const FAKE_INCIDENT = {
  id:              1,
  titre:           'Panne transformateur Biyem-Assi',
  type_incident:   'panne_transfo',
  statut:          'ouvert',
  priorite:        'haute',
  localisation:    'Biyem-Assi',
  ville:           'Yaoundé',
  date_signalement: '2024-03-15T08:30:00Z',
  assigne_a_detail: null,
}

const FAKE_STATS = {
  ouverts:   3,
  en_cours:  1,
  resolus:   7,
  critiques: 2,
}


// ── Helper de rendu ──────────────────────────────────────────────

function renderPanel() {
  return render(<IncidentPanelMini />)
}

function setupDefaultMocks() {
  mockUseIncidentStats.mockReturnValue({ data: null })
  mockUseCreateIncident.mockReturnValue({ mutate: vi.fn(), isPending: false })
}

function resetPermissions(overrides = {}) {
  Object.assign(mockPermissions, {
    role:        'operateur',
    loading:     false,
    isAdmin:     false,
    isOperateur: true,
    isLecteur:   false,
    canWrite:    true,
    canDelete:   false,
    canExport:   true,
    ...overrides,
  })
}


// ── Tests : états du composant ───────────────────────────────────

describe('IncidentPanelMini — état chargement', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    mockMapStore.incidentPrefill = null
    resetPermissions()
    setupDefaultMocks()
  })

  it('affiche un spinner quand isLoading=true', () => {
    mockUseIncidents.mockReturnValue({
      data:      undefined,
      isLoading: true,
      refetch:   vi.fn(),
      isFetching: false,
    })
    renderPanel()
    // Le Loader2 est dans un div flex centré, pas de texte mais on peut chercher l'animation
    const container = document.querySelector('.animate-spin')
    expect(container).toBeInTheDocument()
  })
})


describe('IncidentPanelMini — état vide', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    mockMapStore.incidentPrefill = null
    resetPermissions()
    setupDefaultMocks()
  })

  it('affiche "Aucun incident" quand la liste est vide', () => {
    mockUseIncidents.mockReturnValue({
      data:      [],
      isLoading: false,
      refetch:   vi.fn(),
      isFetching: false,
    })
    renderPanel()
    expect(screen.getByText('Aucun incident')).toBeInTheDocument()
  })

  it("affiche le filtre statut actif dans le message vide", () => {
    mockUseIncidents.mockReturnValue({
      data:      [],
      isLoading: false,
      refetch:   vi.fn(),
      isFetching: false,
    })
    renderPanel()
    // Filtre par défaut = 'ouvert'
    expect(screen.getByText(/Statut : Ouvert/i)).toBeInTheDocument()
  })

  it("n'affiche PAS le bouton export CSV si liste vide", () => {
    mockUseIncidents.mockReturnValue({
      data:      [],
      isLoading: false,
      refetch:   vi.fn(),
      isFetching: false,
    })
    renderPanel()
    expect(screen.queryByTitle('Exporter en CSV')).not.toBeInTheDocument()
  })
})


describe('IncidentPanelMini — liste d\'incidents', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    mockMapStore.incidentPrefill = null
    resetPermissions()
    setupDefaultMocks()
  })

  it('rend une carte pour chaque incident', () => {
    mockUseIncidents.mockReturnValue({
      data:      [FAKE_INCIDENT, { ...FAKE_INCIDENT, id: 2, titre: 'Coupure Ngousso' }],
      isLoading: false,
      refetch:   vi.fn(),
      isFetching: false,
    })
    renderPanel()
    expect(screen.getByText('Panne transformateur Biyem-Assi')).toBeInTheDocument()
    expect(screen.getByText('Coupure Ngousso')).toBeInTheDocument()
  })

  it('affiche la localisation de l\'incident', () => {
    mockUseIncidents.mockReturnValue({
      data:      [FAKE_INCIDENT],
      isLoading: false,
      refetch:   vi.fn(),
      isFetching: false,
    })
    renderPanel()
    expect(screen.getByText(/Biyem-Assi, Yaoundé/i)).toBeInTheDocument()
  })

  it('affiche le bouton export CSV si des incidents sont présents', () => {
    mockUseIncidents.mockReturnValue({
      data:      [FAKE_INCIDENT],
      isLoading: false,
      refetch:   vi.fn(),
      isFetching: false,
    })
    renderPanel()
    expect(screen.getByTitle('Exporter en CSV')).toBeInTheDocument()
  })

  it('gère correctement le format { results: [...] } (pagination DRF)', () => {
    mockUseIncidents.mockReturnValue({
      data:      { results: [FAKE_INCIDENT] },
      isLoading: false,
      refetch:   vi.fn(),
      isFetching: false,
    })
    renderPanel()
    expect(screen.getByText('Panne transformateur Biyem-Assi')).toBeInTheDocument()
  })
})


describe('IncidentPanelMini — formulaire création', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    mockMapStore.incidentPrefill = null
    resetPermissions()
    setupDefaultMocks()
    mockUseIncidents.mockReturnValue({
      data:      [],
      isLoading: false,
      refetch:   vi.fn(),
      isFetching: false,
    })
  })

  it('le formulaire est masqué par défaut', () => {
    renderPanel()
    expect(screen.queryByText('Déclarer un incident')).not.toBeInTheDocument()
  })

  it('ouvre le formulaire au clic sur "Nouveau"', async () => {
    renderPanel()
    const nouveauBtn = screen.getByRole('button', { name: /Nouveau/i })
    fireEvent.click(nouveauBtn)
    expect(screen.getByText('Déclarer un incident')).toBeInTheDocument()
  })

  it('ferme le formulaire au clic sur "Annuler"', async () => {
    renderPanel()
    // Ouvrir le formulaire
    fireEvent.click(screen.getByRole('button', { name: /Nouveau/i }))
    expect(screen.getByText('Déclarer un incident')).toBeInTheDocument()
    // Fermer
    fireEvent.click(screen.getByRole('button', { name: /Annuler/i }))
    expect(screen.queryByText('Déclarer un incident')).not.toBeInTheDocument()
  })

  it('le bouton Déclarer est désactivé si le titre est vide', async () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /Nouveau/i }))
    const declarerBtn = screen.getByRole('button', { name: /Déclarer/i })
    expect(declarerBtn).toBeDisabled()
  })

  it('le bouton Déclarer est actif quand le titre est rempli', async () => {
    const user = userEvent.setup()
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /Nouveau/i }))

    const titreInput = screen.getByPlaceholderText(/Titre de l'incident/i)
    await user.type(titreInput, 'Panne transformateur Test')

    const declarerBtn = screen.getByRole('button', { name: /Déclarer/i })
    expect(declarerBtn).not.toBeDisabled()
  })

  it('auto-ouvre le formulaire si incidentPrefill est défini', () => {
    mockMapStore.incidentPrefill = {
      latitude:   3.848,
      longitude:  11.502,
      couche_nom: 'Transformateur',
      localisation: 'Quartier test',
    }
    renderPanel()
    expect(screen.getByText('Déclarer un incident')).toBeInTheDocument()
  })

  it('pré-remplit la localisation depuis incidentPrefill', () => {
    mockMapStore.incidentPrefill = {
      latitude:     3.848,
      longitude:    11.502,
      couche_nom:   'Transformateur HTB',
      localisation: 'Biyem-Assi Sec',
    }
    renderPanel()
    const locInput = screen.getByPlaceholderText(/Localisation/i)
    expect(locInput.value).toBe('Biyem-Assi Sec')
  })
})


describe('IncidentPanelMini — StatsBar', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    mockMapStore.incidentPrefill = null
    mockUseIncidents.mockReturnValue({
      data:      [],
      isLoading: false,
      refetch:   vi.fn(),
      isFetching: false,
    })
    mockUseCreateIncident.mockReturnValue({ mutate: vi.fn(), isPending: false })
  })

  it("n'affiche PAS la StatsBar si useIncidentStats retourne null", () => {
    mockUseIncidentStats.mockReturnValue({ data: null })
    renderPanel()
    // Les valeurs de stats (3, 1, 7, 2) ne doivent pas être présentes
    expect(screen.queryByText('Ouverts')).not.toBeInTheDocument()
  })

  it('affiche la StatsBar avec les compteurs si stats disponibles', () => {
    mockUseIncidentStats.mockReturnValue({ data: FAKE_STATS })
    renderPanel()
    expect(screen.getByText('Ouverts')).toBeInTheDocument()
    // "En cours" apparaît aussi dans le <select> → utiliser getAllByText
    expect(screen.getAllByText('En cours').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Résolus')).toBeInTheDocument()
    expect(screen.getByText('Critiques')).toBeInTheDocument()
  })

  it('affiche les valeurs numériques des stats', () => {
    mockUseIncidentStats.mockReturnValue({ data: FAKE_STATS })
    renderPanel()
    // Les valeurs 3, 1, 7, 2 doivent être dans le DOM
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })
})


describe('IncidentPanelMini — filtres et contrôles', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    mockMapStore.incidentPrefill = null
    resetPermissions()
    setupDefaultMocks()
    mockUseIncidents.mockReturnValue({
      data:      [],
      isLoading: false,
      refetch:   vi.fn(),
      isFetching: false,
    })
  })

  it('le bouton toggle carte (Map) est présent', () => {
    renderPanel()
    expect(screen.getByTitle(/Masquer sur la carte|Afficher sur la carte/i)).toBeInTheDocument()
  })

  it('appelle toggleIncidentMarkers au clic du bouton carte', () => {
    renderPanel()
    const mapBtn = screen.getByTitle(/Masquer sur la carte|Afficher sur la carte/i)
    fireEvent.click(mapBtn)
    expect(mockMapStore.toggleIncidentMarkers).toHaveBeenCalledOnce()
  })

  it('le select statut a "ouvert" sélectionné par défaut', () => {
    renderPanel()
    const selects = screen.getAllByRole('combobox')
    // Premier select = statut
    expect(selects[0].value).toBe('ouvert')
  })

  it('le select priorité est vide par défaut', () => {
    renderPanel()
    const selects = screen.getAllByRole('combobox')
    // Deuxième select = priorité
    expect(selects[1].value).toBe('')
  })
})


// ── Tests permissions ─────────────────────────────────────────────

describe('IncidentPanelMini — permissions (usePermissions)', () => {

  function setupEmptyList() {
    mockUseIncidents.mockReturnValue({
      data:      [],
      isLoading: false,
      refetch:   vi.fn(),
      isFetching: false,
    })
    setupDefaultMocks()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockMapStore.incidentPrefill = null
  })

  it('affiche le bouton "Nouveau" quand canWrite=true (opérateur)', () => {
    resetPermissions({ canWrite: true, isLecteur: false })
    setupEmptyList()
    renderPanel()
    expect(screen.getByRole('button', { name: /Nouveau/i })).toBeInTheDocument()
  })

  it('masque le bouton "Nouveau" quand canWrite=false (lecteur)', () => {
    resetPermissions({ role: 'lecteur', canWrite: false, isLecteur: true, isOperateur: false })
    setupEmptyList()
    renderPanel()
    expect(screen.queryByRole('button', { name: /Nouveau/i })).not.toBeInTheDocument()
  })

  it('affiche le badge "Lecture" quand isLecteur=true', () => {
    resetPermissions({ role: 'lecteur', canWrite: false, isLecteur: true, isOperateur: false })
    setupEmptyList()
    renderPanel()
    expect(screen.getByText('Lecture')).toBeInTheDocument()
  })

  it("n'affiche PAS le badge \"Lecture\" quand canWrite=true", () => {
    resetPermissions({ canWrite: true, isLecteur: false })
    setupEmptyList()
    renderPanel()
    expect(screen.queryByText('Lecture')).not.toBeInTheDocument()
  })

  it('le formulaire ne s\'auto-ouvre pas si canWrite=false même avec incidentPrefill', () => {
    resetPermissions({ role: 'lecteur', canWrite: false, isLecteur: true, isOperateur: false })
    mockMapStore.incidentPrefill = {
      latitude:     3.848,
      longitude:    11.502,
      couche_nom:   'Transformateur',
      localisation: 'Biyem-Assi',
    }
    setupEmptyList()
    renderPanel()
    // Avec canWrite=false le formulaire ne doit pas s'ouvrir automatiquement
    expect(screen.queryByText('Déclarer un incident')).not.toBeInTheDocument()
  })

  it('le formulaire s\'auto-ouvre si canWrite=true avec incidentPrefill', () => {
    resetPermissions({ canWrite: true, isLecteur: false })
    mockMapStore.incidentPrefill = {
      latitude:     3.848,
      longitude:    11.502,
      couche_nom:   'Transformateur',
      localisation: 'Biyem-Assi',
    }
    setupEmptyList()
    renderPanel()
    expect(screen.getByText('Déclarer un incident')).toBeInTheDocument()
  })

  it('admin : canWrite=true, badge Lecture absent', () => {
    resetPermissions({ role: 'admin', isAdmin: true, isOperateur: false, isLecteur: false, canWrite: true, canDelete: true })
    setupEmptyList()
    renderPanel()
    expect(screen.getByRole('button', { name: /Nouveau/i })).toBeInTheDocument()
    expect(screen.queryByText('Lecture')).not.toBeInTheDocument()
  })
})
