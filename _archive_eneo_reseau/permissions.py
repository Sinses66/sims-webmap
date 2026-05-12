"""
eneo_reseau/permissions.py
==========================
Classes de permissions DRF basées sur les rôles UserProfile.

Matrice des droits :

    Méthode / Action          | admin | superviseur | operateur | lecteur
    ─────────────────────────────────────────────────────────────────────
    GET (list, retrieve, stats)    ✅        ✅           ✅         ✅
    POST (create, actions*)        ✅        ✅           ✅         ❌
    PATCH (partial_update)         ✅        ✅           ✅         ❌
    DELETE (destroy)               ✅        ❌           ❌         ❌

    * actions = assigner, cloturer, photos POST

Règle de fallback :
    - Superuser Django → toujours admin, peu importe le profil
    - Utilisateur sans profil → rôle 'lecteur' (lecture seule)

Usage dans les ViewSets :
    permission_classes = [RoleBasedPermission]
"""

from rest_framework.permissions import BasePermission, SAFE_METHODS


# ── Rôles autorisés par niveau ────────────────────────────────────

_WRITE_ROLES  = ('admin', 'superviseur', 'operateur')
_DELETE_ROLES = ('admin',)


# ── Helper interne ────────────────────────────────────────────────

def _get_role(user) -> str:
    """
    Retourne le rôle effectif de l'utilisateur.
    Ordre de priorité :
      1. Superuser Django → 'admin'
      2. user.profile.role → rôle configuré
      3. Pas de profil → 'lecteur'
    """
    if user.is_superuser:
        return 'admin'
    try:
        return user.profile.role
    except Exception:
        return 'lecteur'


# ── Classe principale ─────────────────────────────────────────────

class RoleBasedPermission(BasePermission):
    """
    Permission unique qui couvre toutes les actions des ViewSets métier.

    - Lecture (GET/HEAD/OPTIONS) : tous les utilisateurs authentifiés
    - Écriture (POST/PATCH)      : admin, superviseur, opérateur
    - Suppression (DELETE)       : admin uniquement

    Remplace `IsAuthenticated` sur IncidentViewSet et InterventionViewSet.
    """

    message = "Vous n'avez pas les droits suffisants pour cette action."

    def has_permission(self, request, view) -> bool:
        # Toujours refuser les anonymes
        if not request.user or not request.user.is_authenticated:
            return False

        # Lecture : autorisée pour tous les authentifiés
        if request.method in SAFE_METHODS:
            return True

        role = _get_role(request.user)

        # Suppression : admin seulement
        if request.method == 'DELETE':
            return role in _DELETE_ROLES

        # Écriture (POST, PATCH, PUT) : operateur et au-dessus
        return role in _WRITE_ROLES

    def has_object_permission(self, request, view, obj) -> bool:
        """
        Vérification au niveau objet (appelée pour les actions detail).
        Applique les mêmes règles que has_permission.
        """
        if not request.user or not request.user.is_authenticated:
            return False

        if request.method in SAFE_METHODS:
            return True

        role = _get_role(request.user)

        if request.method == 'DELETE':
            return role in _DELETE_ROLES

        return role in _WRITE_ROLES


# ── Permissions spécialisées (usage optionnel dans les vues) ──────

class IsAdminRole(BasePermission):
    """
    Réservé aux administrateurs.
    Utile pour les endpoints de configuration avancée.
    """
    message = "Réservé aux administrateurs."

    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        return _get_role(request.user) in _DELETE_ROLES


class CanWrite(BasePermission):
    """
    Lecture + écriture : opérateur et au-dessus.
    Bloque les lecteurs sur toute méthode non-safe.
    """
    message = "Les lecteurs ne peuvent pas modifier les données."

    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return _get_role(request.user) in _WRITE_ROLES
