"""
sims_network/permissions.py
============================
Classes de permissions DRF basees sur les roles UserProfile.

Matrice des droits :

    Methode / Action               | admin | superviseur | operateur | lecteur
    ─────────────────────────────────────────────────────────────────────────
    GET (list, retrieve, stats)        OK       OK            OK         OK
    POST (create, actions*)            OK       OK            OK         NON
    PATCH (partial_update)             OK       OK            OK         NON
    DELETE (destroy)                   OK       NON           NON        NON

Usage dans les ViewSets :
    permission_classes = [RoleBasedPermission]
"""

from rest_framework.permissions import BasePermission, SAFE_METHODS

_WRITE_ROLES  = ('admin', 'superviseur', 'operateur')
_DELETE_ROLES = ('admin',)


def _get_role(user) -> str:
    if user.is_superuser:
        return 'admin'
    try:
        return user.profile.role
    except Exception:
        return 'lecteur'


class RoleBasedPermission(BasePermission):
    message = "Vous n'avez pas les droits suffisants pour cette action."

    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        role = _get_role(request.user)
        if request.method == 'DELETE':
            return role in _DELETE_ROLES
        return role in _WRITE_ROLES

    def has_object_permission(self, request, view, obj) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        role = _get_role(request.user)
        if request.method == 'DELETE':
            return role in _DELETE_ROLES
        return role in _WRITE_ROLES


class IsAdminRole(BasePermission):
    message = "Reserve aux administrateurs."
    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        return _get_role(request.user) in _DELETE_ROLES


class CanWrite(BasePermission):
    message = "Les lecteurs ne peuvent pas modifier les donnees."
    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return _get_role(request.user) in _WRITE_ROLES
