/**
 * notificationStore
 * =================
 * Store Zustand pour les notifications temps réel (polling).
 *
 * notifications  → liste des événements reçus (max 50, LIFO)
 * unreadCount    → nb d'événements non vus depuis la dernière ouverture du dropdown
 * lastChecked    → timestamp ISO du dernier poll réussi (envoyé comme `since` au prochain appel)
 */
import { create } from 'zustand'

export const useNotificationStore = create((set) => ({
  notifications: [],
  unreadCount:   0,
  lastChecked:   null,

  /**
   * Ajoute de nouveaux événements en tête de liste.
   * Limite la liste à 50 entrées pour ne pas saturer la mémoire.
   */
  addNotifications: (events) => {
    if (!events || !events.length) return
    set(state => ({
      notifications: [...events, ...state.notifications].slice(0, 50),
      unreadCount:   state.unreadCount + events.length,
    }))
  },

  /** Appelé quand l'utilisateur ouvre le dropdown — remet le compteur à zéro. */
  markAllRead: () => set({ unreadCount: 0 }),

  /** Efface toutes les notifications. */
  clearAll: () => set({ notifications: [], unreadCount: 0 }),

  /** Mémorise le timestamp du dernier poll pour le prochain appel ?since=. */
  setLastChecked: (ts) => set({ lastChecked: ts }),
}))
