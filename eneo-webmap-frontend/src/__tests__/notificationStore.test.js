/**
 * notificationStore.test.js
 * =========================
 * Tests unitaires du store Zustand notificationStore.
 *
 * Couverture :
 *   État initial
 *     ✓ notifications = []
 *     ✓ unreadCount = 0
 *     ✓ lastChecked = null
 *
 *   addNotifications
 *     ✓ Ajoute des événements en tête de liste (LIFO)
 *     ✓ Incrémente unreadCount du bon nombre
 *     ✓ Limite la liste à 50 entrées
 *     ✓ No-op si events est null
 *     ✓ No-op si events est un tableau vide
 *
 *   markAllRead
 *     ✓ Remet unreadCount à 0
 *     ✓ Conserve la liste notifications intacte
 *
 *   clearAll
 *     ✓ Vide notifications
 *     ✓ Remet unreadCount à 0
 *
 *   setLastChecked
 *     ✓ Met à jour lastChecked avec le timestamp fourni
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useNotificationStore } from '../store/notificationStore'


// ── Helper : accès direct à l'état du store ──────────────────────
function getState() {
  return useNotificationStore.getState()
}


// ── Reset entre chaque test ──────────────────────────────────────
beforeEach(() => {
  useNotificationStore.setState({
    notifications: [],
    unreadCount:   0,
    lastChecked:   null,
  })
})


// ── État initial ─────────────────────────────────────────────────

describe('notificationStore — état initial', () => {

  it('notifications est un tableau vide', () => {
    expect(getState().notifications).toEqual([])
  })

  it('unreadCount est 0', () => {
    expect(getState().unreadCount).toBe(0)
  })

  it('lastChecked est null', () => {
    expect(getState().lastChecked).toBeNull()
  })
})


// ── addNotifications ─────────────────────────────────────────────

describe('notificationStore — addNotifications', () => {

  const EVT_A = { id: 1, type: 'incident_nouveau',      titre: 'Incident A', date: '2024-03-01T10:00:00Z' }
  const EVT_B = { id: 2, type: 'intervention_nouvelle', titre: 'Intervention B', date: '2024-03-01T11:00:00Z' }

  it('ajoute les événements dans la liste', () => {
    getState().addNotifications([EVT_A])
    expect(getState().notifications).toHaveLength(1)
    expect(getState().notifications[0]).toEqual(EVT_A)
  })

  it('ajoute en tête (LIFO) — les nouveaux sont devant les anciens', () => {
    getState().addNotifications([EVT_A])
    getState().addNotifications([EVT_B])
    expect(getState().notifications[0]).toEqual(EVT_B)
    expect(getState().notifications[1]).toEqual(EVT_A)
  })

  it('incrémente unreadCount du bon nombre', () => {
    getState().addNotifications([EVT_A, EVT_B])
    expect(getState().unreadCount).toBe(2)
    getState().addNotifications([EVT_A])
    expect(getState().unreadCount).toBe(3)
  })

  it('limite la liste à 50 entrées', () => {
    // Remplir avec 49 événements existants
    const existing = Array.from({ length: 49 }, (_, i) => ({ id: i, type: 'incident_nouveau', date: '' }))
    useNotificationStore.setState({ notifications: existing, unreadCount: 49 })

    // Ajouter 3 nouveaux → total théorique 52, doit être tronqué à 50
    const newEvts = [
      { id: 100, type: 'incident_nouveau', date: '' },
      { id: 101, type: 'incident_nouveau', date: '' },
      { id: 102, type: 'incident_nouveau', date: '' },
    ]
    getState().addNotifications(newEvts)

    expect(getState().notifications).toHaveLength(50)
    // Les 3 nouveaux sont bien en tête
    expect(getState().notifications[0].id).toBe(100)
    expect(getState().notifications[1].id).toBe(101)
    expect(getState().notifications[2].id).toBe(102)
  })

  it('no-op si events est null', () => {
    getState().addNotifications(null)
    expect(getState().notifications).toHaveLength(0)
    expect(getState().unreadCount).toBe(0)
  })

  it('no-op si events est un tableau vide', () => {
    getState().addNotifications([])
    expect(getState().notifications).toHaveLength(0)
    expect(getState().unreadCount).toBe(0)
  })
})


// ── markAllRead ──────────────────────────────────────────────────

describe('notificationStore — markAllRead', () => {

  const EVT = { id: 1, type: 'incident_nouveau', date: '' }

  it('remet unreadCount à 0', () => {
    getState().addNotifications([EVT, EVT])
    expect(getState().unreadCount).toBe(2)
    getState().markAllRead()
    expect(getState().unreadCount).toBe(0)
  })

  it('conserve la liste notifications intacte', () => {
    getState().addNotifications([EVT])
    getState().markAllRead()
    expect(getState().notifications).toHaveLength(1)
  })
})


// ── clearAll ─────────────────────────────────────────────────────

describe('notificationStore — clearAll', () => {

  it('vide la liste notifications', () => {
    getState().addNotifications([{ id: 1, type: 'incident_nouveau', date: '' }])
    getState().clearAll()
    expect(getState().notifications).toHaveLength(0)
  })

  it('remet unreadCount à 0', () => {
    getState().addNotifications([{ id: 1, type: 'incident_nouveau', date: '' }])
    getState().clearAll()
    expect(getState().unreadCount).toBe(0)
  })
})


// ── setLastChecked ───────────────────────────────────────────────

describe('notificationStore — setLastChecked', () => {

  it('met à jour lastChecked avec le timestamp fourni', () => {
    const ts = '2024-03-15T12:00:00Z'
    getState().setLastChecked(ts)
    expect(getState().lastChecked).toBe(ts)
  })

  it('peut être mis à jour plusieurs fois', () => {
    getState().setLastChecked('2024-01-01T00:00:00Z')
    getState().setLastChecked('2024-06-01T00:00:00Z')
    expect(getState().lastChecked).toBe('2024-06-01T00:00:00Z')
  })
})
