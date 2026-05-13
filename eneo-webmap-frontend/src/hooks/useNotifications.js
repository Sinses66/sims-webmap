/**
 * useNotifications
 * ================
 * Hook de polling léger pour les notifications temps réel.
 *
 * - Interroge GET /api/notifications/feed/?since=<lastTimestamp> toutes les 30 s.
 * - Utilise un ref mutable (sinceRef) pour transmettre le timestamp sans déclencher
 *   de re-render ni invalider la query key à chaque poll.
 * - Ajoute les nouveaux événements dans le notificationStore (Zustand).
 *
 * Usage : appeler une seule fois dans AppLayout pour activer le polling
 * pour toute la durée de la session.
 *
 *   useNotifications()
 */

import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNotificationStore } from '../store/notificationStore'
import { notificationAPI } from '../services/api'

const POLL_INTERVAL = 30 * 1000   // 30 secondes

export function useNotifications() {
  const addNotifications = useNotificationStore(s => s.addNotifications)
  const setLastChecked   = useNotificationStore(s => s.setLastChecked)

  // Ref mutable : contient le timestamp à passer comme ?since= au prochain poll.
  // On évite d'en faire un état React pour ne pas invalider la queryKey.
  const sinceRef = useRef(null)

  const { data } = useQuery({
    queryKey:   ['notifications-poll'],
    queryFn:    () => notificationAPI.feed(sinceRef.current).then(r => r.data),
    // Polling toutes les 30 s, arrêté quand l'onglet est en arrière-plan
    refetchInterval:             POLL_INTERVAL,
    refetchIntervalInBackground: false,
    // Toujours considérer les données comme périmées → re-fetch à chaque intervalle
    staleTime: 0,
    // Ne pas ré-essayer en cas d'erreur réseau — on réessaiera au prochain intervalle
    retry: false,
  })

  useEffect(() => {
    if (!data) return

    // Mémoriser le timestamp serveur pour le prochain ?since=
    if (data.timestamp) {
      sinceRef.current = data.timestamp
      setLastChecked(data.timestamp)
    }

    // Ajouter les nouveaux événements au store
    if (data.events?.length) {
      addNotifications(data.events)
    }
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps
}
