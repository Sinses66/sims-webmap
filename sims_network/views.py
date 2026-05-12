"""
sims_network.views
==================
ViewSets DRF pour les Incidents et Interventions.

Endpoints exposes :
    /api/incidents/                     GET (list), POST (create)
    /api/incidents/{id}/                GET, PATCH, DELETE
    /api/incidents/{id}/assigner/       POST
    /api/incidents/stats/               GET

    /api/interventions/                 GET (list), POST (create)
    /api/interventions/{id}/            GET, PATCH, DELETE
    /api/interventions/{id}/assigner/   POST
    /api/interventions/{id}/cloturer/   POST
"""

from django.contrib.auth.models import User
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from .permissions import RoleBasedPermission
from sims_core.throttles import CreateRateThrottle
from datetime import timedelta
from django.utils.dateparse import parse_datetime
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination


# ── Pagination configurable par requete ──────────────────────────
class FlexiblePageNumberPagination(PageNumberPagination):
    page_size              = 20
    page_size_query_param  = 'page_size'
    max_page_size          = 10000

from drf_spectacular.utils import (
    extend_schema, extend_schema_view,
    OpenApiParameter, OpenApiResponse,
    inline_serializer,
)
from drf_spectacular.types import OpenApiTypes
from rest_framework import serializers as drf_serializers

from .models import (
    Incident, IncidentStatut, IncidentPriorite,
    Intervention, InterventionStatut,
    IncidentPhoto, InterventionPhoto, TypeIncident, Equipe,
    TypeOuvrage, Ouvrage,
)
from .serializers import (
    IncidentSerializer, IncidentListSerializer,
    InterventionSerializer,
    AssignerIncidentSerializer, CloturerInterventionSerializer,
    IncidentPhotoSerializer, InterventionPhotoSerializer,
    TypeIncidentSerializer, EquipeSerializer,
    IncidentSelectSerializer,
    TypeOuvrageSerializer, OuvrageSerializer,
)


# ─────────────────────────────────────────────────────────────────────────────
#  INCIDENT VIEWSET
# ─────────────────────────────────────────────────────────────────────────────

@extend_schema_view(
    list=extend_schema(
        summary="Liste des incidents",
        description=(
            "Retourne les incidents filtrables par : statut, priorite, type_incident, "
            "assigne_a, search (titre/description/localisation), couche_id, feature_id."
        ),
        tags=['Incidents'],
        parameters=[
            OpenApiParameter('statut',        OpenApiTypes.STR, description="ouvert | en_cours | resolu | ferme"),
            OpenApiParameter('priorite',      OpenApiTypes.STR, description="basse | normale | haute | critique"),
            OpenApiParameter('type_incident', OpenApiTypes.STR, description="Type d'incident"),
            OpenApiParameter('assigne_a',     OpenApiTypes.INT, description="ID de l'utilisateur assigne"),
            OpenApiParameter('search',        OpenApiTypes.STR, description="Recherche textuelle"),
            OpenApiParameter('couche_id',     OpenApiTypes.STR, description="Identifiant de couche GeoServer"),
            OpenApiParameter('feature_id',    OpenApiTypes.STR, description="Identifiant de l'entite geographique"),
        ],
    ),
    retrieve=extend_schema(summary="Detail d'un incident", tags=['Incidents']),
    create=extend_schema(summary="Signaler un incident", tags=['Incidents']),
    partial_update=extend_schema(summary="Modifier un incident", tags=['Incidents']),
    destroy=extend_schema(summary="Supprimer un incident", tags=['Incidents']),
)
class IncidentViewSet(viewsets.ModelViewSet):
    permission_classes = [RoleBasedPermission]
    pagination_class   = FlexiblePageNumberPagination
    http_method_names  = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_throttles(self):
        if self.action == 'create':
            return [CreateRateThrottle()]
        return super().get_throttles()

    def _base_queryset(self):
        """
        Queryset de base scope par organisation (multi-tenant).
        Superusers voient tout ; les autres voient uniquement les incidents
        de leur propre organisation via la FK directe Incident.organisation.
        """
        user    = self.request.user
        if user.is_superuser:
            return Incident.objects.all()
        profile = getattr(user, 'profile', None)
        org     = profile.organisation if profile else None
        if org is None:
            return Incident.objects.none()
        return Incident.objects.filter(organisation=org)

    def get_queryset(self):
        qs = (
            self._base_queryset()
            .select_related('signale_par', 'assigne_a', 'organisation')
            .prefetch_related('interventions', 'photos')
            .annotate(interventions_count=Count('interventions'))
        )

        statut     = self.request.query_params.get('statut')
        priorite   = self.request.query_params.get('priorite')
        type_inc   = self.request.query_params.get('type_incident')
        assigne_a  = self.request.query_params.get('assigne_a')
        search     = self.request.query_params.get('search')
        couche_id  = self.request.query_params.get('couche_id')
        feature_id = self.request.query_params.get('feature_id')
        date_after  = self.request.query_params.get('date_signalement_after')
        date_before = self.request.query_params.get('date_signalement_before')

        if statut:
            qs = qs.filter(statut=statut)
        if priorite:
            qs = qs.filter(priorite=priorite)
        if type_inc:
            qs = qs.filter(type_incident=type_inc)
        if assigne_a:
            qs = qs.filter(assigne_a_id=assigne_a)
        if search:
            qs = qs.filter(
                Q(titre__icontains=search) |
                Q(description__icontains=search) |
                Q(localisation__icontains=search) |
                Q(quartier__icontains=search)
            )
        if couche_id:
            qs = qs.filter(couche_id=couche_id)
        if feature_id:
            qs = qs.filter(feature_id=feature_id)
        if date_after:
            qs = qs.filter(date_signalement__date__gte=date_after)
        if date_before:
            qs = qs.filter(date_signalement__date__lte=date_before)

        return qs.order_by('-date_signalement')

    def perform_create(self, serializer):
        """Auto-renseigne organisation et signale_par depuis la requête."""
        user    = self.request.user
        profile = getattr(user, 'profile', None)
        org     = profile.organisation if profile else None
        serializer.save(
            signale_par=user,
            organisation=org,
        )

    def get_serializer_class(self):
        if self.action == 'list':
            return IncidentListSerializer
        return IncidentSerializer

    @extend_schema(
        summary="Statistiques des incidents",
        tags=['Incidents'],
    )
    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        # Utilise le queryset scopé par organisation (pas Incident.objects.all())
        qs = self._base_queryset()
        par_statut   = dict(qs.values_list('statut').annotate(n=Count('id')))
        par_priorite = dict(qs.values_list('priorite').annotate(n=Count('id')))
        par_type     = dict(qs.values_list('type_incident').annotate(n=Count('id')))
        total    = qs.count()
        ouverts  = par_statut.get(IncidentStatut.OUVERT,   0)
        en_cours = par_statut.get(IncidentStatut.EN_COURS, 0)
        resolus  = par_statut.get(IncidentStatut.RESOLU,   0)
        critiques = par_priorite.get(IncidentPriorite.CRITIQUE, 0)
        return Response({
            'total': total, 'ouverts': ouverts, 'en_cours': en_cours,
            'resolus': resolus, 'critiques': critiques,
            'par_statut': par_statut, 'par_priorite': par_priorite, 'par_type': par_type,
        })

    @action(detail=True, methods=['post'], url_path='assigner')
    def assigner(self, request, pk=None):
        incident = self.get_object()
        ser = AssignerIncidentSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = User.objects.get(pk=ser.validated_data['user_id'])
        incident.assigne_a = user
        if incident.statut == IncidentStatut.OUVERT:
            incident.statut = IncidentStatut.EN_COURS
            if not incident.date_prise_charge:
                incident.date_prise_charge = timezone.now()
        incident.save(update_fields=['assigne_a', 'statut', 'date_prise_charge', 'updated_at'])
        return Response(IncidentSerializer(incident, context={'request': request}).data)

    @action(detail=True, methods=['get', 'post'], url_path='photos')
    def photos(self, request, pk=None):
        incident = self.get_object()
        if request.method == 'GET':
            ser = IncidentPhotoSerializer(incident.photos.all(), many=True, context={'request': request})
            return Response(ser.data)
        ser = IncidentPhotoSerializer(data=request.data, context={'request': request})
        ser.is_valid(raise_exception=True)
        ser.save(incident=incident, uploaded_by=request.user)
        return Response(ser.data, status=status.HTTP_201_CREATED)


# ─────────────────────────────────────────────────────────────────────────────
#  INTERVENTION VIEWSET
# ─────────────────────────────────────────────────────────────────────────────

@extend_schema_view(
    list=extend_schema(summary="Liste des interventions", tags=['Interventions']),
    retrieve=extend_schema(summary="Detail d'une intervention", tags=['Interventions']),
    create=extend_schema(summary="Creer une intervention", tags=['Interventions']),
    partial_update=extend_schema(summary="Modifier une intervention", tags=['Interventions']),
    destroy=extend_schema(summary="Supprimer une intervention", tags=['Interventions']),
)
class InterventionViewSet(viewsets.ModelViewSet):
    serializer_class   = InterventionSerializer
    permission_classes = [RoleBasedPermission]
    pagination_class   = FlexiblePageNumberPagination
    http_method_names  = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_throttles(self):
        if self.action == 'create':
            return [CreateRateThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        # Scope multi-tenant via la FK directe incident__organisation
        user    = self.request.user
        if user.is_superuser:
            qs = Intervention.objects.all()
        else:
            profile = getattr(user, 'profile', None)
            org     = profile.organisation if profile else None
            if org is None:
                return Intervention.objects.none()
            qs = Intervention.objects.filter(incident__organisation=org)

        qs = qs.select_related('incident', 'responsable', 'equipe', 'created_by')
        incident_id  = self.request.query_params.get('incident')
        statut       = self.request.query_params.get('statut')
        responsable  = self.request.query_params.get('responsable')
        type_travaux = self.request.query_params.get('type_travaux')
        date_after   = self.request.query_params.get('date_planifiee_after')
        date_before  = self.request.query_params.get('date_planifiee_before')
        if incident_id:  qs = qs.filter(incident_id=incident_id)
        if statut:       qs = qs.filter(statut=statut)
        if responsable:  qs = qs.filter(responsable_id=responsable)
        if type_travaux: qs = qs.filter(type_travaux=type_travaux)
        if date_after:   qs = qs.filter(date_planifiee__date__gte=date_after)
        if date_before:  qs = qs.filter(date_planifiee__date__lte=date_before)
        return qs.order_by('-created_at')

    @action(detail=True, methods=['post'], url_path='assigner')
    def assigner(self, request, pk=None):
        intervention = self.get_object()
        ser = AssignerIncidentSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = User.objects.get(pk=ser.validated_data['user_id'])
        intervention.demarrer(utilisateur=user)
        return Response(InterventionSerializer(intervention, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='cloturer')
    def cloturer(self, request, pk=None):
        intervention = self.get_object()
        ser = CloturerInterventionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        intervention.cloturer(rapport=ser.validated_data.get('rapport', ''))
        return Response(InterventionSerializer(intervention, context={'request': request}).data)

    @action(detail=True, methods=['get', 'post'], url_path='photos')
    def photos(self, request, pk=None):
        intervention = self.get_object()
        if request.method == 'GET':
            ser = InterventionPhotoSerializer(intervention.photos.all(), many=True, context={'request': request})
            return Response(ser.data)
        ser = InterventionPhotoSerializer(data=request.data, context={'request': request})
        ser.is_valid(raise_exception=True)
        photo = ser.save(
            intervention=intervention,
            uploaded_by=request.user if request.user.is_authenticated else None,
        )
        return Response(InterventionPhotoSerializer(photo, context={'request': request}).data,
                        status=status.HTTP_201_CREATED)


# ─────────────────────────────────────────────────────────────────────────────
#  REFERENTIELS
# ─────────────────────────────────────────────────────────────────────────────

class TypeIncidentViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class   = TypeIncidentSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self):
        qs = TypeIncident.objects.all()
        actif = self.request.query_params.get('actif')
        if actif is not None:
            qs = qs.filter(actif=(actif.lower() != 'false'))
        return qs.order_by('ordre', 'nom')


class EquipeViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class   = EquipeSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self):
        qs = Equipe.objects.select_related('responsable').all()
        actif = self.request.query_params.get('actif')
        if actif is not None:
            qs = qs.filter(actif=(actif.lower() != 'false'))
        return qs.order_by('nom')


class IncidentSelectViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class   = IncidentSelectSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self):
        statut = self.request.query_params.get('statut')
        if statut:
            return Incident.objects.filter(statut=statut).order_by('-date_signalement')
        return Incident.objects.filter(
            statut__in=[IncidentStatut.OUVERT, IncidentStatut.EN_COURS]
        ).order_by('-date_signalement')


class TypeOuvrageViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class   = TypeOuvrageSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self):
        qs = TypeOuvrage.objects.all()
        actif = self.request.query_params.get('actif')
        if actif is not None:
            qs = qs.filter(actif=(actif.lower() != 'false'))
        return qs.order_by('ordre', 'nom')


class OuvrageViewSet(viewsets.ModelViewSet):
    serializer_class   = OuvrageSerializer
    permission_classes = [RoleBasedPermission]
    http_method_names  = ['get', 'post', 'patch', 'head', 'options']
    def get_queryset(self):
        qs = Ouvrage.objects.select_related('type_ouvrage').all()
        code         = self.request.query_params.get('code')
        type_ouvrage = self.request.query_params.get('type_ouvrage')
        search       = self.request.query_params.get('search')
        actif        = self.request.query_params.get('actif')
        if code:         qs = qs.filter(code__iexact=code)
        if type_ouvrage: qs = qs.filter(type_ouvrage_id=type_ouvrage)
        if search:       qs = qs.filter(Q(code__icontains=search) | Q(nom__icontains=search))
        if actif is not None: qs = qs.filter(actif=(actif.lower() != 'false'))
        return qs.order_by('code')


# ─────────────────────────────────────────────────────────────────────────────
#  NOTIFICATIONS FEED
# ─────────────────────────────────────────────────────────────────────────────

@extend_schema(summary="Fil de notifications temps reel (polling)", tags=["Notifications"])
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notifications_feed(request):
    since_str = request.query_params.get('since')
    if since_str:
        since = parse_datetime(since_str)
        if since is None:
            since = timezone.now() - timedelta(minutes=5)
    else:
        since = timezone.now() - timedelta(minutes=5)

    now = timezone.now()

    # ── Scope par organisation (multi-tenancy) ────────────────────
    # Depuis la migration 0003, Incident possède une FK directe `organisation`.
    # Le scope est désormais un simple .filter(organisation=org) — plus de Q() complexes.
    user    = request.user
    profile = getattr(user, 'profile', None)
    org     = profile.organisation if profile else None

    def _scope_incident(qs):
        if user.is_superuser:
            return qs
        if org is None:
            return qs.none()
        return qs.filter(organisation=org)

    def _scope_intervention(qs):
        if user.is_superuser:
            return qs
        if org is None:
            return qs.none()
        return qs.filter(incident__organisation=org)

    nouveaux      = _scope_incident(Incident.objects.filter(created_at__gte=since)).select_related('type_incident').order_by('-created_at')[:10]
    modifies      = _scope_incident(Incident.objects.filter(updated_at__gte=since, created_at__lt=since)).order_by('-updated_at')[:10]
    interventions = _scope_intervention(Intervention.objects.filter(created_at__gte=since)).select_related('incident').order_by('-created_at')[:10]

    events = []
    for inc in nouveaux:
        events.append({'type': 'incident_nouveau', 'id': inc.id,
                       'titre': inc.titre or (inc.type_incident.nom if inc.type_incident else 'Incident'),
                       'priorite': inc.priorite, 'statut': inc.statut, 'date': inc.created_at.isoformat()})
    for inc in modifies:
        events.append({'type': 'incident_modifie', 'id': inc.id,
                       'titre': inc.titre or '—', 'statut': inc.statut, 'date': inc.updated_at.isoformat()})
    for iv in interventions:
        events.append({'type': 'intervention_nouvelle', 'id': iv.id,
                       'incident_id': iv.incident_id, 'incident_titre': iv.incident.titre or '—',
                       'type_travaux': iv.get_type_travaux_display(), 'statut': iv.statut,
                       'date': iv.created_at.isoformat()})

    events.sort(key=lambda e: e['date'], reverse=True)
    return Response({'timestamp': now.isoformat(), 'count': len(events), 'events': events})
