/**
 * InterventionPanelMini.test.jsx
 * ==============================
 * Tests du composant InterventionPanelMini (Interventions/InterventionPanelMini.jsx).
 *
 * Couverture :
 *   État chargement
 *     ✓ Spinner présent quand isLoading=true
 *
 *   État vide
 *     ✓ Message "Aucune intervention" visible quand liste vide
 *
 *   Liste d'interventions
 *     ✓ Les cartes d'interventions sont rendues
 *     ✓ Le message d'aide "Cliquer sur une intervention..." est affiché
 *
 *   Vue liste — contrôles
 *     ✓ Filtre statut présent en vue liste
 *     ✓ Filtre statut absent en vue calendrier
 *
 *   Toggle vue
 *     ✓ Vue liste par défaut
 *     ✓ Clic sur l'icône calendrier bascule en vue calendrier
 *     ✓ Clic retour sur l'icône liste revient en vue liste
 *
 *   Formulaire nouvelle intervention
 *     ✓ Formulaire masqué par défaut
 *     ✓ Clic "Nouvelle" affiche le formulaire
 *     ✓ Clic "Annuler" dans le formulaire ferme le formulaire
 *
 *   Permissions (usePermissions)
 *     ✓ canWrite=true → bouton "Nouvelle" visible
 *     ✓ canWrite=false (lecteur) → bouton "Nouvelle" absent
 *     ✓ isLecteur=true → badge "Lecture" visible
 *     ✓ isLecteur=false → badge "Lecture" absent
 *     ✓ En vue calendrier, bouton "Nouvelle" absent même pour canWrite=true
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import InterventionPanelMini from '../components/Interventions/InterventionPanelMini'


// ── Mocks ─────────────────────────────────────────────────────────

// Hooks react-query wrappés
const mockUseInterventions           = vi.fn()
const mockUseCreateIntervention      = vi.fn()
const mockUseAssignIntervention      = vi.fn()
const mockUseCloturerIntervention    = vi.fn()
const mockUseUploadInterventionPhoto = vi.fn()

vi.mock('../hooks/useGeoData', () => ({
  useInterventions:           (...args) => mockUseInterventions(...args),
  useCreateIntervention:      (...args) => mockUseCreateIntervention(...args),
  useAssignIntervention:      (...args) => mockUseAssignIntervention(...args),
  useCloturerIntervention:    (...args) => mockUseCloturerIntervention(...args),
  useUploadInterventionPhoto: (...args) => mockUseUploadInterventionPhoto(...args),
  useUsers:                   () => ({ data: [] }),
  useEquipes:                 () => ({ data: [] }),
  useIncidentsSelect:         () => ({ data: [] }),
  // Exports utilisés indirectement par des sous-composants
  useIncidents:               () => ({ data: { results: [] }, isLoading: false }),
  useIncidentStats:           () => ({ data: null }),
  useCreateIncident:          () => ({ mutate: vi.fn(), isPending: false }),
  useTypeIncidents:           () => ({ data: [] }),
  useTypeOuvrages:            () => ({ data: [] }),
  useOuvrageByCode:           () => ({ data: null, isFetching: false }),
  useCreateOuvrage:           () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateIncident:          () => ({ mutate: vi.fn(), isPending: false }),
  useUploadIncidentPhoto:     () => ({ mutate: vi.fn(), isPending: false }),
  useAssignIncident:          () => ({ mutate: vi.fn(), isPending: false }),
  useResolveIncident:         () => ({ mutate: vi.fn(), isPending: false }),
}))

// react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

// usePermissions — par défaut : opérateur
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

const FAKE_INTERVENTION = {
  id:           1,
  type_travaux: 'reparation',
  statut:       'planifiee',
  incident:     10,
  date_planifiee: null,
  equipe_detail: null,
}

const FAKE_INTERVENTION_2 = {
  id:           2,
  type_travaux: 'inspection',
  statut:       'en_cours',
  incident:     11,
  date_planifiee: null,
  equipe_detail: null,
}


// ── Helpers ───────────────────────────────────────────────────────

function renderPanel() {
  return render(<InterventionPanelMini />)
}

function setupDefaultMocks() {
  mockUseInterventions.mockReturnValue({ data: { results: [] }, isLoading: false })
  mockUseCreateIntervention.mockReturnValue({ mutate: vi.fn(), isPending: false })
  mockUseAssignIntervention.mockReturnValue({ mutate: vi.fn(), isPending: false })
  mockUseCloturerIntervention.mockReturnValue({ mutate: vi.fn(), isPending: false })
  mockUseUploadInterventionPhoto.mockReturnValue({ mutate: vi.fn(), isPending: false })
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


// ── Reset ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  resetPermissions()
  setupDefaultMocks()
})


// ── État chargement ──────────────────────────────────────────────

describe('InterventionPanelMini — état chargement', () => {

  it('spinner présent quand isLoading=true', () => {
    mockUseInterventions.mockReturnValue({ data: null, isLoading: true })
    renderPanel()
    // Le spinner a la classe animate-spin (Loader2)
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).not.toBeNull()
  })
})


// ── État vide ────────────────────────────────────────────────────

describe('InterventionPanelMini — état vide', () => {

  it('message "Aucune intervention" visible quand liste vide', () => {
    renderPanel()
    expect(screen.getByText('Aucune intervention')).toBeInTheDocument()
  })
})


// ── Liste d'interventions ────────────────────────────────────────

describe('InterventionPanelMini — liste d\'interventions', () => {

  beforeEach(() => {
    mockUseInterventions.mockReturnValue({
      data: { results: [FAKE_INTERVENTION, FAKE_INTERVENTION_2] },
      isLoading: false,
    })
  })

  it('les valeurs type_travaux sont rendues', () => {
    renderPanel()
    // InterventionCard affiche iv.type_travaux brut (pas le label traduit)
    expect(screen.getByText('reparation')).toBeInTheDocument()
    expect(screen.getByText('inspection')).toBeInTheDocument()
  })

  it('le message d\'aide est affiché', () => {
    renderPanel()
    expect(screen.getByText(/Cliquer sur une intervention/)).toBeInTheDocument()
  })
})


// ── Contrôles de la vue liste ────────────────────────────────────

describe('InterventionPanelMini — contrôles vue liste', () => {

  it('filtre statut présent en vue liste', () => {
    renderPanel()
    // Le select de filtre a une option "Toutes"
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('filtre statut absent en vue calendrier', () => {
    renderPanel()
    // Passer en vue calendrier
    fireEvent.click(screen.getByTitle('Vue calendrier'))
    expect(screen.queryByRole('combobox')).toBeNull()
  })
})


// ── Toggle vue ───────────────────────────────────────────────────

describe('InterventionPanelMini — toggle vue', () => {

  it('vue liste par défaut (filtre visible)', () => {
    renderPanel()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('clic calendrier → vue calendrier (filtre masqué)', () => {
    renderPanel()
    fireEvent.click(screen.getByTitle('Vue calendrier'))
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('clic liste après calendrier → vue liste (filtre réapparu)', () => {
    renderPanel()
    fireEvent.click(screen.getByTitle('Vue calendrier'))
    fireEvent.click(screen.getByTitle('Vue liste'))
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })
})


// ── Formulaire nouvelle intervention ────────────────────────────

describe('InterventionPanelMini — formulaire nouvelle intervention', () => {

  it('formulaire masqué par défaut', () => {
    renderPanel()
    // Le bouton "Valider" ou "Créer" du formulaire ne doit pas être présent
    expect(screen.queryByText(/Planifier/i)).toBeNull()
  })

  it('clic "Nouvelle" affiche le formulaire', () => {
    renderPanel()
    fireEvent.click(screen.getByText('Nouvelle'))
    // Le formulaire contient un select ou champ type_travaux
    expect(screen.getByText(/Type de travaux/i)).toBeInTheDocument()
  })

  it('clic "Annuler" ferme le formulaire', () => {
    renderPanel()
    fireEvent.click(screen.getByText('Nouvelle'))
    fireEvent.click(screen.getByText('Annuler'))
    expect(screen.queryByText(/Type de travaux/i)).toBeNull()
  })
})


// ── Permissions ──────────────────────────────────────────────────

describe('InterventionPanelMini — permissions (usePermissions)', () => {

  it('canWrite=true → bouton "Nouvelle" visible', () => {
    resetPermissions({ canWrite: true, isLecteur: false })
    renderPanel()
    expect(screen.getByText('Nouvelle')).toBeInTheDocument()
  })

  it('canWrite=false → bouton "Nouvelle" absent', () => {
    resetPermissions({ canWrite: false, isLecteur: true, isOperateur: false })
    renderPanel()
    expect(screen.queryByText('Nouvelle')).toBeNull()
  })

  it('isLecteur=true → badge "Lecture" visible', () => {
    resetPermissions({ canWrite: false, isLecteur: true, isOperateur: false })
    renderPanel()
    expect(screen.getByText('Lecture')).toBeInTheDocument()
  })

  it('isLecteur=false → badge "Lecture" absent', () => {
    resetPermissions({ canWrite: true, isLecteur: false })
    renderPanel()
    expect(screen.queryByText('Lecture')).toBeNull()
  })

  it('en vue calendrier, bouton "Nouvelle" absent même pour canWrite=true', () => {
    resetPermissions({ canWrite: true, isLecteur: false })
    renderPanel()
    fireEvent.click(screen.getByTitle('Vue calendrier'))
    expect(screen.queryByText('Nouvelle')).toBeNull()
  })
})
