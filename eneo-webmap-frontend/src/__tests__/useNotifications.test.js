/**
 * useNotifications.test.js
 * ========================
 * Tests unitaires du hook useNotifications.
 *
 * Couverture :
 *   Pas de données (data = undefined)
 *     ✓ addNotifications non appelé
 *     ✓ setLastChecked non appelé
 *
 *   Données reçues avec timestamp et events
 *     ✓ setLastChecked appelé avec le timestamp
 *     ✓ addNotifications appelé avec les events
 *
 *   Données reçues sans events (events vide ou absent)
 *     ✓ addNotifications non appelé si events = []
 *     ✓ addNotifications non appelé si events absent
 *
 *   Données reçues sans timestamp
 *     ✓ setLastChecked non appelé si timestamp absent
 *
 *   Configuration useQuery
 *     ✓ refetchInterval = 30000 ms
 *     ✓ refetchIntervalInBackground = false
 *     ✓ staleTime = 0
 *     ✓ retry = false
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useQuery } from '@tanstack/react-query'
import { useNotifications } from '../hooks/useNotifications'


// ── Mocks ─────────────────────────────────────────────────────────

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}))

const mockAddNotifications = vi.fn()
const mockSetLastChecked   = vi.fn()

vi.mock('../store/notificationStore', () => ({
  useNotificationStore: (selector) => selector({
    addNotifications: mockAddNotifications,
    setLastChecked:   mockSetLastChecked,
  }),
}))

vi.mock('../services/api', () => ({
  notificationAPI: {
    feed: vi.fn(() => Promise.resolve({ data: { timestamp: null, events: [] } })),
  },
}))


// ── Reset ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})


// ── Helper ────────────────────────────────────────────────────────

function setupQuery(data) {
  useQuery.mockReturnValue({ data })
}


// ── Tests : aucune donnée ────────────────────────────────────────

describe('useNotifications — pas de données (data=undefined)', () => {

  it('addNotifications non appelé', () => {
    setupQuery(undefined)
    renderHook(() => useNotifications())
    expect(mockAddNotifications).not.toHaveBeenCalled()
  })

  it('setLastChecked non appelé', () => {
    setupQuery(undefined)
    renderHook(() => useNotifications())
    expect(mockSetLastChecked).not.toHaveBeenCalled()
  })
})


// ── Tests : données avec timestamp et events ─────────────────────

describe('useNotifications — données complètes', () => {

  const DATA = {
    timestamp: '2024-03-15T12:00:00Z',
    count: 2,
    events: [
      { id: 1, type: 'incident_nouveau',      titre: 'Incident A', date: '2024-03-15T11:00:00Z' },
      { id: 2, type: 'intervention_nouvelle', titre: 'Intervention B', date: '2024-03-15T11:30:00Z' },
    ],
  }

  it('setLastChecked appelé avec le bon timestamp', () => {
    setupQuery(DATA)
    renderHook(() => useNotifications())
    expect(mockSetLastChecked).toHaveBeenCalledWith(DATA.timestamp)
  })

  it('addNotifications appelé avec les events', () => {
    setupQuery(DATA)
    renderHook(() => useNotifications())
    expect(mockAddNotifications).toHaveBeenCalledWith(DATA.events)
  })

  it('addNotifications appelé une seule fois', () => {
    setupQuery(DATA)
    renderHook(() => useNotifications())
    expect(mockAddNotifications).toHaveBeenCalledTimes(1)
  })
})


// ── Tests : events vides ou absents ─────────────────────────────

describe('useNotifications — events vides ou absents', () => {

  it('addNotifications non appelé si events = []', () => {
    setupQuery({ timestamp: '2024-03-15T12:00:00Z', events: [] })
    renderHook(() => useNotifications())
    expect(mockAddNotifications).not.toHaveBeenCalled()
  })

  it('addNotifications non appelé si events absent', () => {
    setupQuery({ timestamp: '2024-03-15T12:00:00Z' })
    renderHook(() => useNotifications())
    expect(mockAddNotifications).not.toHaveBeenCalled()
  })

  it('setLastChecked appelé même si events est vide', () => {
    setupQuery({ timestamp: '2024-03-15T12:00:00Z', events: [] })
    renderHook(() => useNotifications())
    expect(mockSetLastChecked).toHaveBeenCalledWith('2024-03-15T12:00:00Z')
  })
})


// ── Tests : timestamp absent ─────────────────────────────────────

describe('useNotifications — timestamp absent', () => {

  it('setLastChecked non appelé si timestamp absent', () => {
    setupQuery({ events: [{ id: 1, type: 'incident_nouveau', date: '' }] })
    renderHook(() => useNotifications())
    expect(mockSetLastChecked).not.toHaveBeenCalled()
  })
})


// ── Tests : configuration de useQuery ───────────────────────────

describe('useNotifications — configuration useQuery', () => {

  beforeEach(() => {
    setupQuery(undefined)
    renderHook(() => useNotifications())
  })

  it('refetchInterval = 30 000 ms', () => {
    const [config] = useQuery.mock.calls[0]
    expect(config.refetchInterval).toBe(30_000)
  })

  it('refetchIntervalInBackground = false', () => {
    const [config] = useQuery.mock.calls[0]
    expect(config.refetchIntervalInBackground).toBe(false)
  })

  it('staleTime = 0', () => {
    const [config] = useQuery.mock.calls[0]
    expect(config.staleTime).toBe(0)
  })

  it('retry = false', () => {
    const [config] = useQuery.mock.calls[0]
    expect(config.retry).toBe(false)
  })

  it('queryKey contient "notifications-poll"', () => {
    const [config] = useQuery.mock.calls[0]
    expect(config.queryKey).toContain('notifications-poll')
  })
})
