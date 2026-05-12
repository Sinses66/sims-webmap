"""
test_urls.py — Configuration URL minimale pour pytest
======================================================
Utilisé uniquement durant les tests (ROOT_URLCONF = 'test_urls' dans test_settings.py).
N'inclut que les routes nécessaires aux tests API, sans dépendances
sur l'admin Django ni sur drf-spectacular.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from sims_core.throttles import ThrottledTokenObtainPairView
from sims_network.views import IncidentViewSet, InterventionViewSet, notifications_feed
from sims_core.views import (
    OrganisationViewSet, ApplicationViewSet,
    ApplicationLayerViewSet, UserProfileViewSet,
    DashboardViewSet, DashboardWidgetViewSet,
)

router = DefaultRouter()
router.register(r'incidents',          IncidentViewSet,          basename='incident')
router.register(r'interventions',      InterventionViewSet,      basename='intervention')
router.register(r'organisations',      OrganisationViewSet,      basename='organisation')
router.register(r'applications',       ApplicationViewSet,       basename='application')
router.register(r'app-layers',         ApplicationLayerViewSet,  basename='app-layer')
router.register(r'user-profiles',      UserProfileViewSet,       basename='user-profile')
router.register(r'dashboards',         DashboardViewSet,         basename='dashboard')
router.register(r'dashboard-widgets',  DashboardWidgetViewSet,   basename='dashboard-widget')

urlpatterns = [
    path('api/', include(router.urls)),
    path('api/notifications/feed/', notifications_feed,              name='notifications-feed'),
    path('api/auth/token/',         ThrottledTokenObtainPairView.as_view(), name='token-obtain'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(),      name='token-refresh'),
]
