/**
 * usePermissions
 * ==============
 * Hook centralisé pour la gestion des droits UI.
 *
 * Rôles backend (UserProfile.role) :
 *   admin       → accès complet (CRUD + suppression)
 *   superviseur → créer, modifier (pas de suppression) — mêmes droits que opérateur
 *   operateur   → créer, modifier, assigner, clôturer (pas de suppression)
 *   lecteur     → lecture seule, aucune action d'écriture
 *
 * Matrice backend (RoleBasedPermission) :
 *   GET            → admin | superviseur | opérateur | lecteur
 *   POST / PATCH   → admin | superviseur | opérateur
 *   DELETE         → admin uniquement
 *
 * Usage :
 *   const { canWrite, canDelete, role, isLecteur, isSuperviseur } = usePermissions()
 */

import { useAuthStore } from '../store/authStore'

// Rôles autorisés à écrire (POST / PATCH) — aligné sur RoleBasedPermission backend
const WRITE_ROLES = ['admin', 'superviseur', 'operateur']

export function usePermissions() {
  const user  = useAuthStore(s => s.user)
  const token = useAuthStore(s => s.token)

  // user null + token présent = profil pas encore rechargé (page refresh)
  // → on ne bloque pas l'UI pendant ce temps, on attend que le profil arrive
  const loading = !user && !!token

  // Par défaut 'lecteur' SEULEMENT quand on sait qu'il n'y a pas de session
  // (pas de token). Pendant le chargement on laisse passer ('operateur').
  const role = user?.role ?? (loading ? 'operateur' : 'lecteur')

  const isAdmin       = role === 'admin'
  const isSuperviseur = role === 'superviseur'
  const isOperateur   = role === 'operateur'
  const isLecteur     = !loading && !WRITE_ROLES.includes(role)

  return {
    role,
    loading,
    isAdmin,
    isSuperviseur,
    isOperateur,
    isLecteur,

    canWrite:  loading || WRITE_ROLES.includes(role),
    canDelete: isAdmin,
    canExport: true,
  }
}
