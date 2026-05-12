import re
import xml.etree.ElementTree as ET
import requests as http_requests
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from django.contrib.auth.models import User
from django.core.cache import cache
from django.http import JsonResponse
from django.conf import settings
from drf_spectacular.utils import (
    extend_schema, extend_schema_view,
    OpenApiParameter, OpenApiExample, OpenApiResponse,
    inline_serializer,
)
from drf_spectacular.types import OpenApiTypes
from rest_framework import serializers as drf_serializers

from .models import Organisation, Application, ApplicationLayer, UserProfile, MapAnnotation, MapBookmark, Dashboard, DashboardWidget
from .serializers import (
    OrganisationSerializer, ApplicationSerializer, ApplicationListSerializer,
    ApplicationLayerSerializer, UserProfileSerializer,
    MapAnnotationSerializer, MapBookmarkSerializer,
    DashboardSerializer, DashboardListSerializer, DashboardWidgetSerializer,
)


# ─────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────
def _user_organisation(request):
    """
    Retourne l'organisation du profil connecté.

    Valeurs de retour :
      - None        → superuser (pas de restriction, accès global)
      - Organisation → filtre par cette organisation
      - Sentinelle  → user sans profil ou sans org → queryset vide (voir _NO_ORG)

    Usage dans get_queryset :
        org = _user_organisation(request)
        if org is _NO_ORG:
            return qs.none()      # aucun accès
        if org is not None:
            qs = qs.filter(organisation=org)
    """
    if request.user.is_superuser:
        return None
    profile = getattr(request.user, 'profile', None)
    if profile is None or profile.organisation is None:
        return _NO_ORG
    return profile.organisation


# Sentinelle unique pour distinguer "pas d'org" de "superuser" (qui retourne None)
_NO_ORG = object()


# ─────────────────────────────────────────────────────────────────
# Permissions personnalisées
# ─────────────────────────────────────────────────────────────────
class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated
        return request.user.is_superuser or (
            hasattr(request.user, 'profile') and request.user.profile.role == 'admin'
        )


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Lecture : tout utilisateur authentifié dans le scope queryset.
    Écriture (PUT / PATCH / DELETE) : uniquement le propriétaire du profil,
    un admin de l'organisation ou un superuser.
    Utilisé par UserProfileViewSet.
    """
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = request.user
        if user.is_superuser:
            return True
        if user.is_staff:
            return True
        if hasattr(user, 'profile') and user.profile.role == 'admin':
            return True
        # L'utilisateur ne peut modifier que son propre profil
        return obj.user == user


class IsOwnerOrSharedReadOnly(permissions.BasePermission):
    """
    Lecture : tout utilisateur authentifié (y compris les objets partagés).
    Écriture (PUT / PATCH / DELETE) : uniquement le créateur ou un superuser.
    Pour DashboardWidget, la propriété remonte au dashboard parent.
    """
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        # Dashboard direct
        if hasattr(obj, 'created_by'):
            return obj.created_by == request.user or request.user.is_superuser
        # DashboardWidget → vérifier le dashboard parent
        if hasattr(obj, 'dashboard'):
            return obj.dashboard.created_by == request.user or request.user.is_superuser
        return False


# ─────────────────────────────────────────────────────────────────
# Organisation
# ─────────────────────────────────────────────────────────────────
@extend_schema_view(
    list=extend_schema(summary="Liste des organisations", tags=['Organisations']),
    retrieve=extend_schema(summary="Détail d'une organisation", tags=['Organisations']),
    create=extend_schema(summary="Créer une organisation", tags=['Organisations']),
    update=extend_schema(summary="Modifier une organisation (complet)", tags=['Organisations']),
    partial_update=extend_schema(summary="Modifier une organisation (partiel)", tags=['Organisations']),
    destroy=extend_schema(summary="Supprimer une organisation", tags=['Organisations']),
)
class OrganisationViewSet(viewsets.ModelViewSet):
    queryset           = Organisation.objects.filter(is_active=True)
    serializer_class   = OrganisationSerializer
    permission_classes = [IsAdminOrReadOnly]
    lookup_field       = 'slug'

    def get_queryset(self):
        qs  = Organisation.objects.filter(is_active=True)
        org = _user_organisation(self.request)
        if org is _NO_ORG:
            return qs.none()          # pas d'org → aucun accès
        if org is not None:
            qs = qs.filter(pk=org.pk) # filtre par org
        return qs                     # superuser → tout


# ─────────────────────────────────────────────────────────────────
# Application
# ─────────────────────────────────────────────────────────────────
@extend_schema_view(
    list=extend_schema(summary="Liste des applications", tags=['Applications']),
    retrieve=extend_schema(summary="Détail d'une application", tags=['Applications']),
    create=extend_schema(summary="Créer une application", tags=['Applications']),
    update=extend_schema(summary="Modifier une application (complet)", tags=['Applications']),
    partial_update=extend_schema(summary="Modifier une application (partiel)", tags=['Applications']),
    destroy=extend_schema(summary="Supprimer une application", tags=['Applications']),
)
class ApplicationViewSet(viewsets.ModelViewSet):
    queryset           = Application.objects.filter(is_active=True).select_related('organisation')
    permission_classes = [IsAdminOrReadOnly]   # écriture réservée aux admins
    lookup_field       = 'slug'

    def get_serializer_class(self):
        if self.action == 'list':
            return ApplicationListSerializer
        return ApplicationSerializer

    def get_queryset(self):
        qs  = Application.objects.filter(is_active=True).select_related('organisation')
        org = _user_organisation(self.request)
        if org is _NO_ORG:
            return qs.none()
        if org is not None:
            qs = qs.filter(organisation=org)
        # Filtre optionnel par slug d'organisation (utile pour les superusers)
        org_slug = self.request.query_params.get('organisation')
        if org_slug:
            qs = qs.filter(organisation__slug=org_slug)
        return qs

    @extend_schema(
        summary="Couches d'une application",
        description="Retourne la liste ordonnée des couches cartographiques associées à cette application.",
        responses={200: ApplicationLayerSerializer(many=True)},
        tags=['Applications'],
    )
    @staticmethod
    def _resolve_modules(app):
        """
        Intersection entre les modules activés sur l'Application
        et ceux autorisés par l'Organisation (définis par l'admin Django).
        Auto-découvrant : déduit les modules des champs module_* du modèle Application.
        Ajouter un nouveau module = ajouter le champ + migration, rien d'autre ici.
        """
        # Déduire les modules depuis les champs du modèle Application
        # Clé API = nom du champ sans le préfixe 'module_'
        module_fields = [
            f.name for f in app.__class__._meta.get_fields()
            if f.name.startswith('module_') and hasattr(f, 'default')
        ]
        try:
            org = app.organisation
            return {
                field.replace('module_', ''): bool(getattr(app, field, False) and getattr(org, field, False))
                for field in module_fields
            }
        except Exception:
            # Migration org pas encore appliquée : retourner les flags app seuls
            return {field.replace('module_', ''): bool(getattr(app, field, False)) for field in module_fields}

    @action(detail=True, methods=['get'], url_path='layers')
    def layers(self, request, slug=None):
        """Retourne les couches d'une application."""
        app    = self.get_object()
        layers = app.layers.all().order_by('layer_order', 'name')
        return Response(ApplicationLayerSerializer(layers, many=True).data)

    @extend_schema(
        summary="Configuration complète d'une application",
        description="Retourne le slug, le nom, la config carte (centre, zoom) et les modules activés.",
        tags=['Applications'],
    )
    @action(detail=True, methods=['get'], url_path='config')
    def config(self, request, slug=None):
        """Retourne la config complète (couleurs, modules, paramètres carte)."""
        app = self.get_object()
        return Response({
            'slug':          app.slug,
            'name':          app.name,
            'config':        app.default_config,
            'map': {
                'center':   [app.center_lat, app.center_lon],
                'zoom':     app.zoom_default,
                'zoom_min': app.zoom_min,
                'zoom_max': app.zoom_max,
            },
            'modules': self._resolve_modules(app),
        })


# ─────────────────────────────────────────────────────────────────
# Couche cartographique
# ─────────────────────────────────────────────────────────────────
@extend_schema_view(
    list=extend_schema(
        summary="Liste des couches",
        description="Filtre possible via ?application=<slug>",
        tags=['Couches'],
        parameters=[
            OpenApiParameter('application', OpenApiTypes.STR, OpenApiParameter.QUERY,
                             description="Slug de l'application pour filtrer les couches")
        ]
    ),
    retrieve=extend_schema(summary="Détail d'une couche", tags=['Couches']),
    create=extend_schema(summary="Créer une couche", tags=['Couches']),
    update=extend_schema(summary="Modifier une couche (complet)", tags=['Couches']),
    partial_update=extend_schema(summary="Modifier une couche (partiel)", tags=['Couches']),
    destroy=extend_schema(summary="Supprimer une couche", tags=['Couches']),
)
class ApplicationLayerViewSet(viewsets.ModelViewSet):
    queryset           = ApplicationLayer.objects.all()
    serializer_class   = ApplicationLayerSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs  = ApplicationLayer.objects.all()
        org = _user_organisation(self.request)
        if org is _NO_ORG:
            return qs.none()
        if org is not None:
            qs = qs.filter(application__organisation=org)
        app_slug = self.request.query_params.get('application')
        if app_slug:
            qs = qs.filter(application__slug=app_slug)
        return qs.order_by('layer_order', 'name')


# ─────────────────────────────────────────────────────────────────
# Profil utilisateur
# ─────────────────────────────────────────────────────────────────
@extend_schema_view(
    list=extend_schema(summary="Liste des profils utilisateurs", tags=['Utilisateurs']),
    retrieve=extend_schema(summary="Détail d'un profil", tags=['Utilisateurs']),
    create=extend_schema(summary="Créer un profil", tags=['Utilisateurs']),
    update=extend_schema(summary="Modifier un profil (complet)", tags=['Utilisateurs']),
    partial_update=extend_schema(summary="Modifier un profil (partiel)", tags=['Utilisateurs']),
    destroy=extend_schema(summary="Supprimer un profil", tags=['Utilisateurs']),
)
class UserProfileViewSet(viewsets.ModelViewSet):
    queryset           = UserProfile.objects.select_related('user', 'organisation')
    serializer_class   = UserProfileSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrAdmin]

    def get_queryset(self):
        user = self.request.user
        # Admin voit tout, sinon seulement son organisation
        if user.is_superuser or (hasattr(user, 'profile') and user.profile.role == 'admin'):
            return super().get_queryset()
        if hasattr(user, 'profile') and user.profile.organisation:
            return super().get_queryset().filter(organisation=user.profile.organisation)
        return UserProfile.objects.filter(user=user)


@extend_schema(
    summary="Mon profil",
    description="Retourne le profil complet de l'utilisateur actuellement connecté (JWT).",
    responses={
        200: inline_serializer(
            name='MyProfileResponse',
            fields={
                'id':           drf_serializers.IntegerField(),
                'username':     drf_serializers.CharField(),
                'first_name':   drf_serializers.CharField(),
                'last_name':    drf_serializers.CharField(),
                'email':        drf_serializers.EmailField(),
                'role':         drf_serializers.ChoiceField(choices=['admin', 'operateur', 'lecteur']),
                'organisation': drf_serializers.CharField(allow_null=True),
                'org_slug':     drf_serializers.CharField(allow_null=True),
                'avatar':       drf_serializers.URLField(allow_null=True),
                'phone':        drf_serializers.CharField(allow_null=True),
            }
        )
    },
    tags=['Utilisateurs'],
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_profile(request):
    """Retourne le profil complet de l'utilisateur connecté."""
    user = request.user
    profile_data = {
        'id':         user.id,
        'username':   user.username,
        'first_name': user.first_name,
        'last_name':  user.last_name,
        'email':      user.email,
        'role':       'admin' if user.is_superuser else 'lecteur',
        'organisation': None,
    }
    if hasattr(user, 'profile'):
        p = user.profile
        profile_data.update({
            'role':         p.role if not user.is_superuser else 'admin',
            'organisation': p.organisation.name if p.organisation else None,
            'org_slug':     p.organisation.slug if p.organisation else None,
            'org_id':       p.organisation.id   if p.organisation else None,
            'avatar':       request.build_absolute_uri(p.avatar.url) if p.avatar else None,
            'phone':        p.phone,
            # Modules autorisés pour l'organisation (définis par le superuser)
            'org_modules':  {
                'incidents':     p.organisation.module_incidents     if p.organisation else True,
                'interventions': p.organisation.module_interventions if p.organisation else True,
                'analytics':     p.organisation.module_analytics     if p.organisation else False,
                'export':        p.organisation.module_export        if p.organisation else False,
                'editor':        p.organisation.module_editor        if p.organisation else False,
            } if p.organisation else None,
        })
    return Response(profile_data)


# ─────────────────────────────────────────────────────────────────
# Annotations
# ─────────────────────────────────────────────────────────────────
@extend_schema_view(
    list=extend_schema(
        summary="Liste des annotations cartographiques",
        description="Retourne les annotations partagées + celles de l'utilisateur connecté. Filtre via ?application=<slug>.",
        tags=['Annotations'],
    ),
    retrieve=extend_schema(summary="Détail d'une annotation", tags=['Annotations']),
    create=extend_schema(summary="Créer une annotation", tags=['Annotations']),
    update=extend_schema(summary="Modifier une annotation (complet)", tags=['Annotations']),
    partial_update=extend_schema(summary="Modifier une annotation (partiel)", tags=['Annotations']),
    destroy=extend_schema(summary="Supprimer une annotation", tags=['Annotations']),
)
class MapAnnotationViewSet(viewsets.ModelViewSet):
    queryset           = MapAnnotation.objects.all()
    serializer_class   = MapAnnotationSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrSharedReadOnly]

    def get_queryset(self):
        qs       = super().get_queryset()
        app_slug = self.request.query_params.get('application')
        if app_slug:
            qs = qs.filter(application__slug=app_slug)
        user = self.request.user
        # Retourne les annotations partagées + les siennes
        return qs.filter(
            models.Q(is_shared=True) | models.Q(created_by=user)
        )

    # Import nécessaire pour le filtre Q
    from django.db import models as _models


# ─────────────────────────────────────────────────────────────────
# GeoServer — DescribeFeatureType (attributs d'une couche WFS)
# ─────────────────────────────────────────────────────────────────
# Champs géométriques à exclure systématiquement
GEO_FIELDS = {'the_geom', 'geom', 'geometry', 'wkb_geometry', 'shape', 'SHAPE'}

@api_view(['GET'])
@permission_classes([IsAdminUser])
def geoserver_fields(request):
    """
    Retourne la liste des attributs d'une couche GeoServer.
    Utilise WFS DescribeFeatureType (outputFormat JSON).
    Accessible via JWT Bearer (is_staff requis) ou session Django Admin.

    GET /api/geoserver-fields/?layer=eneo_gis_ws:cmrPosteSource
    Réponse : { "layer": "...", "fields": [{"name": "...", "type": "..."}] }
    """
    layer_name = request.GET.get('layer', '').strip()
    if not layer_name:
        return JsonResponse({'error': 'Paramètre layer requis'}, status=400)

    geoserver_url  = getattr(settings, 'GEOSERVER_URL',      'http://localhost:8080/geoserver')
    geoserver_user = getattr(settings, 'GEOSERVER_USER',     'admin')
    geoserver_pass = getattr(settings, 'GEOSERVER_PASSWORD', 'geoserver')

    try:
        resp = http_requests.get(
            f"{geoserver_url}/wfs",
            params={
                'service':      'WFS',
                'version':      '2.0.0',
                'request':      'DescribeFeatureType',
                'typeName':     layer_name,
                'outputFormat': 'application/json',
            },
            auth=(geoserver_user, geoserver_pass),
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()

        fields = []
        for feature_type in data.get('featureTypes', []):
            for prop in feature_type.get('properties', []):
                name = prop.get('name', '')
                if name and name not in GEO_FIELDS and not name.lower().endswith('_geom'):
                    fields.append({
                        'name': name,
                        'type': prop.get('localType', 'string'),
                    })

        return JsonResponse({'layer': layer_name, 'fields': fields})

    except http_requests.exceptions.ConnectionError:
        return JsonResponse({'error': 'GeoServer inaccessible', 'fields': []}, status=503)
    except Exception as e:
        return JsonResponse({'error': str(e), 'fields': []}, status=500)


# ─────────────────────────────────────────────────────────────────
# GeoServer — GetCapabilities (liste des couches publiées)
# ─────────────────────────────────────────────────────────────────
GEOSERVER_LAYERS_CACHE_KEY    = 'sims:geoserver_layers'
GEOSERVER_LAYERS_CACHE_SECONDS = 300   # 5 min


def _parse_wms_capabilities(xml_text: str):
    """
    Parse une réponse WMS GetCapabilities et retourne la liste des couches publiées.

    Retourne : [{ "name": "ws:layer", "title": "Titre lisible", "abstract": "..." }, ...]
    Seules les couches qui possèdent un <Name> sont retenues
    (les nœuds groupes sans Name sont ignorés).
    """
    layers = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return layers

    # Le namespace varie selon les versions WMS, on dénamespace simplement.
    def localname(tag: str) -> str:
        return tag.split('}', 1)[-1] if '}' in tag else tag

    for layer_node in root.iter():
        if localname(layer_node.tag) != 'Layer':
            continue
        name_node    = next((c for c in layer_node if localname(c.tag) == 'Name'),    None)
        title_node   = next((c for c in layer_node if localname(c.tag) == 'Title'),   None)
        abstract_node = next((c for c in layer_node if localname(c.tag) == 'Abstract'), None)
        if name_node is None or not (name_node.text or '').strip():
            continue
        layers.append({
            'name':     name_node.text.strip(),
            'title':    (title_node.text    or '').strip() if title_node    is not None else '',
            'abstract': (abstract_node.text or '').strip() if abstract_node is not None else '',
        })
    return layers


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def geoserver_layers(request):
    """
    Retourne la liste des couches publiées dans GeoServer (toutes workspaces confondues).
    Utilise WMS GetCapabilities et cache la réponse 5 minutes.
    Accessible via JWT Bearer — tout utilisateur authentifié (React en a besoin pour l'autocomplete).

    GET /api/geoserver-layers/
    GET /api/geoserver-layers/?refresh=1   # force le rafraîchissement du cache
    Réponse : { "layers": [{"name": "...", "title": "...", "abstract": "..."}], "cached": true|false }
    """
    force_refresh = request.GET.get('refresh') in ('1', 'true', 'yes')

    if not force_refresh:
        cached = cache.get(GEOSERVER_LAYERS_CACHE_KEY)
        if cached is not None:
            return JsonResponse({'layers': cached, 'cached': True})

    geoserver_url  = getattr(settings, 'GEOSERVER_URL',      'http://localhost:8080/geoserver')
    geoserver_user = getattr(settings, 'GEOSERVER_USER',     'admin')
    geoserver_pass = getattr(settings, 'GEOSERVER_PASSWORD', 'geoserver')

    try:
        resp = http_requests.get(
            f"{geoserver_url}/wms",
            params={
                'service': 'WMS',
                'version': '1.1.1',
                'request': 'GetCapabilities',
            },
            auth=(geoserver_user, geoserver_pass),
            timeout=15,
        )
        resp.raise_for_status()
        layers = _parse_wms_capabilities(resp.text)
        # Tri alphabétique pour un affichage prévisible
        layers.sort(key=lambda l: l['name'].lower())
        cache.set(GEOSERVER_LAYERS_CACHE_KEY, layers, GEOSERVER_LAYERS_CACHE_SECONDS)
        return JsonResponse({'layers': layers, 'cached': False})

    except http_requests.exceptions.ConnectionError:
        # Toujours 200 pour que le JS admin puisse lire le message d'erreur
        return JsonResponse({
            'error': f'GeoServer inaccessible — URL configurée : {geoserver_url}',
            'layers': [],
        })
    except http_requests.exceptions.Timeout:
        return JsonResponse({
            'error': f'GeoServer timeout (>15 s) — {geoserver_url}',
            'layers': [],
        })
    except http_requests.exceptions.HTTPError as e:
        return JsonResponse({
            'error': f'GeoServer a répondu HTTP {e.response.status_code} — vérifiez les credentials ({geoserver_user})',
            'layers': [],
        })
    except Exception as e:
        return JsonResponse({'error': str(e), 'layers': []})


# ─────────────────────────────────────────────────────────────────
# Recherche globale
# ─────────────────────────────────────────────────────────────────
@extend_schema(
    summary="Recherche globale",
    description=(
        "Recherche multi-sources (incidents, annotations, couches) dans toutes les données Django. "
        "Retourne une liste unifiée de résultats avec localisation géographique optionnelle."
    ),
    parameters=[
        OpenApiParameter(
            name='q', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY,
            required=True, description="Terme de recherche (minimum 2 caractères)"
        ),
        OpenApiParameter(
            name='limit', type=OpenApiTypes.INT, location=OpenApiParameter.QUERY,
            required=False, description="Nombre maximum de résultats (défaut : 20, max : 50)"
        ),
    ],
    responses={
        200: inline_serializer(
            name='GlobalSearchResponse',
            fields={
                'results': drf_serializers.ListField(
                    child=inline_serializer(
                        name='SearchResult',
                        fields={
                            'id':       drf_serializers.CharField(help_text="Ex: incident_42"),
                            'type':     drf_serializers.ChoiceField(choices=['incident', 'annotation', 'layer']),
                            'label':    drf_serializers.CharField(),
                            'sublabel': drf_serializers.CharField(),
                            'lat':      drf_serializers.FloatField(allow_null=True),
                            'lng':      drf_serializers.FloatField(allow_null=True),
                            'extra':    drf_serializers.DictField(),
                        }
                    )
                ),
                'total': drf_serializers.IntegerField(),
            }
        )
    },
    tags=['Recherche'],
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def global_search(request):
    """
    Recherche multi-sources dans les données Django.
    GET /api/search/?q=...&types=incidents,annotations&limit=20

    Retourne une liste unifiée :
    [{ id, type, label, sublabel, lat, lng, extra }]
    """
    from django.db.models import Q

    q     = request.GET.get('q', '').strip()
    limit = min(int(request.GET.get('limit', 20)), 50)

    if not q or len(q) < 2:
        return Response({'results': [], 'total': 0})

    results = []

    # ── 1. Incidents ─────────────────────────────────────────────
    try:
        from sims_network.models import Incident
        incidents = Incident.objects.filter(
            Q(titre__icontains=q) |
            Q(description__icontains=q) |
            Q(localisation__icontains=q) |
            Q(quartier__icontains=q) |
            Q(ville__icontains=q)
        ).select_related('assigne_a', 'type_incident')[:limit]

        for inc in incidents:
            results.append({
                'id':       f'incident_{inc.id}',
                'type':     'incident',
                'label':    inc.titre or (inc.type_incident.nom if inc.type_incident else '—'),
                'sublabel': f'{inc.get_statut_display()} — {inc.get_priorite_display()}'
                            + (f' — {inc.localisation}' if inc.localisation else ''),
                'lat':      inc.latitude,
                'lng':      inc.longitude,
                'extra': {
                    'id':      inc.id,
                    'statut':  inc.statut,
                    'priorite': inc.priorite,
                },
            })
    except Exception:
        pass

    # ── 2. Annotations cartographiques ───────────────────────────
    try:
        annotations = MapAnnotation.objects.filter(
            Q(title__icontains=q),
            Q(is_shared=True) | Q(created_by=request.user)
        )[:10]

        for ann in annotations:
            # Extraire centroïde du GeoJSON si disponible
            lat, lng = None, None
            try:
                import json
                geom = json.loads(ann.geojson) if isinstance(ann.geojson, str) else ann.geojson
                coords = geom.get('geometry', {}).get('coordinates', [])
                if coords and geom.get('geometry', {}).get('type') == 'Point':
                    lng, lat = coords[0], coords[1]
            except Exception:
                pass

            results.append({
                'id':       f'annotation_{ann.id}',
                'type':     'annotation',
                'label':    ann.title,
                'sublabel': f'Annotation — {ann.geom_type}',
                'lat':      lat,
                'lng':      lng,
                'extra':    {'id': ann.id},
            })
    except Exception:
        pass

    # ── 3. Couches / layers par nom ───────────────────────────────
    try:
        layers = ApplicationLayer.objects.filter(
            Q(name__icontains=q) |
            Q(description__icontains=q) |
            Q(group_label__icontains=q)
        )[:5]

        for layer in layers:
            results.append({
                'id':       f'layer_{layer.id}',
                'type':     'layer',
                'label':    layer.name,
                'sublabel': f'Couche {layer.layer_type} — {layer.group_label}',
                'lat':      None,
                'lng':      None,
                'extra':    {'layer_key': layer.layer_key, 'layer_type': layer.layer_type},
            })
    except Exception:
        pass

    return Response({'results': results[:limit], 'total': len(results)})


# ─────────────────────────────────────────────────────────────────
# Bookmarks
# ─────────────────────────────────────────────────────────────────
@extend_schema_view(
    list=extend_schema(summary="Liste des signets cartographiques", tags=['Signets']),
    retrieve=extend_schema(summary="Détail d'un signet", tags=['Signets']),
    create=extend_schema(summary="Créer un signet", tags=['Signets']),
    update=extend_schema(summary="Modifier un signet (complet)", tags=['Signets']),
    partial_update=extend_schema(summary="Modifier un signet (partiel)", tags=['Signets']),
    destroy=extend_schema(summary="Supprimer un signet", tags=['Signets']),
)
class MapBookmarkViewSet(viewsets.ModelViewSet):
    queryset           = MapBookmark.objects.all()
    serializer_class   = MapBookmarkSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)


# ─────────────────────────────────────────────────────────────────
# Dashboards analytiques
# ─────────────────────────────────────────────────────────────────
@extend_schema_view(
    list=extend_schema(
        summary="Liste des dashboards",
        description="Retourne les dashboards de l'utilisateur + les dashboards partagés. Filtre via ?application=<slug>.",
        tags=['Dashboards'],
    ),
    retrieve=extend_schema(summary="Détail d'un dashboard (avec widgets)", tags=['Dashboards']),
    create=extend_schema(summary="Créer un dashboard", tags=['Dashboards']),
    update=extend_schema(summary="Modifier un dashboard (complet)", tags=['Dashboards']),
    partial_update=extend_schema(summary="Modifier un dashboard (partiel)", tags=['Dashboards']),
    destroy=extend_schema(summary="Supprimer un dashboard", tags=['Dashboards']),
)
class DashboardViewSet(viewsets.ModelViewSet):
    queryset           = Dashboard.objects.all()
    permission_classes = [IsAuthenticated, IsOwnerOrSharedReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return DashboardListSerializer
        return DashboardSerializer

    def get_queryset(self):
        from django.db.models import Q
        user     = self.request.user
        app_slug = self.request.query_params.get('application')
        qs = Dashboard.objects.filter(
            Q(created_by=user) | Q(is_shared=True)
        ).select_related('created_by', 'application')
        if app_slug:
            qs = qs.filter(application__slug=app_slug)
        return qs.prefetch_related('widgets')

    @extend_schema(
        summary="Dupliquer un dashboard",
        description="Crée une copie privée du dashboard (et de tous ses widgets) pour l'utilisateur connecté.",
        tags=['Dashboards'],
    )
    @action(detail=True, methods=['post'], url_path='duplicate')
    def duplicate(self, request, pk=None):
        """Duplique un dashboard et tous ses widgets."""
        original = self.get_object()
        new_dash = Dashboard.objects.create(
            application  = original.application,
            created_by   = request.user,
            name         = f"{original.name} (copie)",
            description  = original.description,
            is_shared    = False,
        )
        for widget in original.widgets.all():
            DashboardWidget.objects.create(
                dashboard       = new_dash,
                title           = widget.title,
                geoserver_layer = widget.geoserver_layer,
                layer_name      = widget.layer_name,
                attributes      = widget.attributes,
                chart_type      = widget.chart_type,
                color_scheme    = widget.color_scheme,
                filters         = widget.filters,
                position        = widget.position,
                config          = widget.config,
            )
        return Response(DashboardSerializer(new_dash, context={'request': request}).data)


@extend_schema_view(
    list=extend_schema(
        summary="Liste des widgets",
        description="Filtre via ?dashboard=<id>. Retourne les widgets accessibles à l'utilisateur.",
        tags=['Dashboards'],
    ),
    retrieve=extend_schema(summary="Détail d'un widget", tags=['Dashboards']),
    create=extend_schema(summary="Créer un widget", tags=['Dashboards']),
    update=extend_schema(summary="Modifier un widget (complet)", tags=['Dashboards']),
    partial_update=extend_schema(summary="Modifier un widget (partiel)", tags=['Dashboards']),
    destroy=extend_schema(summary="Supprimer un widget", tags=['Dashboards']),
)
class DashboardWidgetViewSet(viewsets.ModelViewSet):
    queryset           = DashboardWidget.objects.all()
    serializer_class   = DashboardWidgetSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrSharedReadOnly]

    def get_queryset(self):
        from django.db.models import Q
        user         = self.request.user
        dashboard_id = self.request.query_params.get('dashboard')
        qs = DashboardWidget.objects.filter(
            Q(dashboard__created_by=user) | Q(dashboard__is_shared=True)
        )
        if dashboard_id:
            qs = qs.filter(dashboard_id=dashboard_id)
        return qs.order_by('position')

    @extend_schema(
        summary="Réordonner les widgets",
        description="Met à jour la position de chaque widget. Body : `{ \"order\": [{\"id\": 1, \"position\": 0}, ...] }`",
        tags=['Dashboards'],
    )
    @action(detail=False, methods=['post'], url_path='reorder')
    def reorder(self, request):
        """
        Réordonne les widgets d'un dashboard.
        Body: { "order": [{"id": 1, "position": 0}, {"id": 2, "position": 1}, ...] }
        """
        order = request.data.get('order', [])
        for item in order:
            DashboardWidget.objects.filter(
                id=item['id'],
                dashboard__created_by=request.user
            ).update(position=item['position'])
        return Response({'status': 'ok'})
