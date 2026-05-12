from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    OrganisationViewSet, ApplicationViewSet, ApplicationLayerViewSet,
    UserProfileViewSet, MapAnnotationViewSet, MapBookmarkViewSet,
    DashboardViewSet, DashboardWidgetViewSet,
    my_profile, geoserver_fields, geoserver_layers, global_search,
)

router = DefaultRouter()
router.register(r'organisations',      OrganisationViewSet,     basename='organisation')
router.register(r'applications',       ApplicationViewSet,      basename='application')
router.register(r'app-layers',         ApplicationLayerViewSet, basename='app-layer')
router.register(r'user-profiles',      UserProfileViewSet,      basename='user-profile')
router.register(r'annotations',        MapAnnotationViewSet,    basename='annotation')
router.register(r'bookmarks',          MapBookmarkViewSet,      basename='bookmark')
router.register(r'dashboards',         DashboardViewSet,        basename='dashboard')
router.register(r'dashboard-widgets',  DashboardWidgetViewSet,  basename='dashboard-widget')

urlpatterns = router.urls + [
    path('platform/me/',      my_profile,       name='platform-me'),
    path('geoserver-fields/', geoserver_fields, name='geoserver-fields'),
    path('geoserver-layers/', geoserver_layers, name='geoserver-layers'),
    path('search/',           global_search,    name='global-search'),
]
