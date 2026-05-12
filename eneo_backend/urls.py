from django.contrib import admin
from eneo_backend.home_view import home
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenRefreshView
from sims_core.throttles import ThrottledTokenObtainPairView

urlpatterns = [
    path('', home, name='home'),
    path('admin/', admin.site.urls),
    # ── JWT Auth (ThrottledTokenObtainPairView : 5 tentatives/min par IP) ──
    path('api/auth/token/',         ThrottledTokenObtainPairView.as_view(), name='token_obtain'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(),             name='token_refresh'),
    # ── API metier + Auth me ──────────────────────
    path('api/', include('sims_network.urls')),
    path('api/', include('sims_core.urls')),
    # ── Documentation ─────────────────────────────
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/',   SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
