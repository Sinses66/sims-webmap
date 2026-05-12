"""
eneo_reseau.urls
================
Enregistrement des ViewSets dans le routeur DRF.
"""

from rest_framework.routers import DefaultRouter

from django.urls import path

from .views import (
    IncidentViewSet, InterventionViewSet,
    TypeIncidentViewSet, EquipeViewSet,
    IncidentSelectViewSet,
    TypeOuvrageViewSet, OuvrageViewSet,
    notifications_feed,
)

router = DefaultRouter()
router.register(r'incidents',          IncidentViewSet,       basename='incident')
router.register(r'interventions',      InterventionViewSet,   basename='intervention')
router.register(r'types-incident',     TypeIncidentViewSet,   basename='type-incident')
router.register(r'equipes',            EquipeViewSet,         basename='equipe')
router.register(r'incidents-select',   IncidentSelectViewSet, basename='incident-select')
router.register(r'types-ouvrage',      TypeOuvrageViewSet,    basename='type-ouvrage')
router.register(r'ouvrages',           OuvrageViewSet,        basename='ouvrage')

urlpatterns = router.urls + [
    path('notifications/feed/', notifications_feed, name='notifications-feed'),
]
