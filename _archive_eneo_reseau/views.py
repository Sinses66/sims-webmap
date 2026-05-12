"""
eneo_reseau.views
=================
ViewSets DRF pour les Incidents et Interventions.

Endpoints exposés :
    /api/incidents/                     GET (list), POST (create)
    /api/incidents/{id}/                GET, PATCH, DELETE
    /api/incidents/{id}/assigner/       POST
    /api/incidents/stats/               GET

    /api/interventions/                 GET (list), POST (create)
    /api/interventions/{id}/            GET, PATCH, DELETE
    /api/interventions/{id}/assigner/   POST  (démarre + assigne)
    /api/interventions/{id}/cloturer/   POST
"""

from django.contrib.auth.models import User
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from .permissions import RoleBasedPermission
from datetime import timedelta
from django.utils.dateparse import parse_datetime
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination


# ── Pagination configurable par requête ──────────────────────────
class FlexiblePageNumberPagination(PageNumberPagination):
    """Pagination standard + `page_size` query param pour l'export (max 10 000)."""
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
            OpenApiParameter('assigne_a',     OpenApiTypes.INT, description="ID de l'utilisateur assigné"),
            OpenApiParameter('search',        OpenApiTypes.STR, description="Recherche textuelle"),
            OpenApiParameter('couche_id',     OpenApiTypes.STR, description="Identifiant de couche GeoServer"),
            OpenApiParameter('feature_id',    OpenApiTypes.STR, description="Identifiant de l'entité géographique"),
        ],
    ),
    retrieve=extend_schema(summary="Détail d'un incident", tags=['Incidents']),
    create=extend_schema(summary="Signaler un incident", tags=['Incidents']),
    partial_update=extend_schema(summary="Modifier un incident", tags=['Incidents']),
    destroy=extend_schema(summary="Supprimer un incident", tags=['Incidents']),
)
class IncidentViewSet(viewsets.ModelViewSet):
    """
    CRUD complet sur les incidents + actions métier.
    Permissions :
      - GET (list, retrieve, stats, photos) : tous les authentifiés
      - POST / PATCH (create, assigner, photos upload) : opérateur et au-dessus
      - DELETE : admin uniquement
    """
    permission_classes = [RoleBasedPermission]
    pagination_class   = FlexiblePageNumberPagination
    http_method_names  = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = (
            Incident.objects
            .select_related('signale_par', 'assigne_a')
            .prefetch_related('interventions', 'photos')
            .annotate(interventions_count=Count('interventions'))
        )

        # ── Filtres query params ──────────────────────────────────
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

    def get_serializer_class(self):
        if self.action == 'list':
            return IncidentListSerializer
        return IncidentSerializer

    # ── Action : stats globales ───────────────────────────────────
    @extend_schema(
        summary="Statistiques des incidents",
        description="Retourne les compteurs globaux : total, par statut, par priorité, par type.",
        responses={
            200: inline_serializer(
                name='IncidentStatsResponse',
                fields={
                    'total':       drf_serializers.IntegerField(),
                    'ouverts':     drf_serializers.IntegerField(),
                    'en_cours':    drf_serializers.IntegerField(),
                    'resolus':     drf_serializers.IntegerField(),
                    'critiques':   drf_serializers.IntegerField(),
                    'par_statut':  drf_serializers.DictField(child=drf_serializers.IntegerField()),
                    'par_priorite': drf_serializers.DictField(child=drf_serializers.IntegerField()),
                    'par_type':    drf_serializers.DictField(child=drf_serializers.IntegerField()),
                }
            )
        },
        tags=['Incidents'],
    )
    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        """
        GET /api/incidents/stats/
        Retourne des compteurs pour le dashboard.
        """
        qs = Incident.objects.all()

        # Compteurs par statut
        par_statut = dict(
            qs.values_list('statut').annotate(n=Count('id'))
        )
        # Compteurs par priorité
        par_priorite = dict(
            qs.values_list('priorite').annotate(n=Count('id'))
        )
        # Compteurs par type
        par_type = dict(
            qs.values_list('type_incident').annotate(n=Count('id'))
        )

        total         = qs.count()
        ouverts       = par_statut.get(IncidentStatut.OUVERT,   0)
        en_cours      = par_statut.get(IncidentStatut.EN_COURS, 0)
        resolus       = par_statut.get(IncidentStatut.RESOLU,   0)
        critiques     = par_priorite.get(IncidentPriorite.CRITIQUE, 0)

        return Response({
            'total':         total,
            'ouverts':       ouverts,
            'en_cours':      en_cours,
            'resolus':       resolus,
            'critiques':     critiques,
            'par_statut':    par_statut,
            'par_priorite':  par_priorite,
            'par_type':      par_type,
        })

    # ── Action : assigner un incident à un utilisateur ────────────
    @extend_schema(
        summary="Assigner un incident",
        description=(
            "Assigne l'incident à un utilisateur et le passe automatiquement "
            "au statut `en_cours` s'il était `ouvert`."
        ),
        request=AssignerIncidentSerializer,
        responses={200: IncidentSerializer},
        tags=['Incidents'],
    )
    @action(detail=True, methods=['post'], url_path='assigner')
    def assigner(self, request, pk=None):
        """
        POST /api/incidents/{id}/assigner/
        Body : { "user_id": <int> }
        """
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

        return Response(
            IncidentSerializer(incident, context={'request': request}).data
        )

    # ── Action : photos d'un incident ─────────────────────────────
    @extend_schema(
        summary="Photos d'un incident",
        description="GET : liste des photos. POST : upload d'une nouvelle photo (multipart/form-data).",
        responses={200: IncidentPhotoSerializer(many=True), 201: IncidentPhotoSerializer},
        tags=['Incidents'],
    )
    @action(detail=True, methods=['get', 'post'], url_path='photos')
    def photos(self, request, pk=None):
        incident = self.get_object()

        if request.method == 'GET':
            qs  = incident.photos.all()
            ser = IncidentPhotoSerializer(qs, many=True, context={'request': request})
            return Response(ser.data)

        # POST
        ser = IncidentPhotoSerializer(data=request.data, context={'request': request})
        ser.is_valid(raise_exception=True)
        ser.save(incident=incident, uploaded_by=request.user)
        return Response(ser.data, status=status.HTTP_201_CREATED)


# ─────────────────────────────────────────────────────────────────────────────
#  INTERVENTION VIEWSET
# ─────────────────────────────────────────────────────────────────────────────

@extend_schema_view(
    list=extend_schema(
        summary="Liste des interventions",
        description="Filtrables par : incident (id), statut, responsable (id).",
        tags=['Interventions'],
        parameters=[
            OpenApiParameter('incident',    OpenApiTypes.INT, description="ID de l'incident parent"),
            OpenApiParameter('statut',      OpenApiTypes.STR, description="planifiee | en_cours | cloturee | annulee"),
            OpenApiParameter('responsable', OpenApiTypes.INT, description="ID de l'utilisateur responsable"),
        ],
    ),
    retrieve=extend_schema(summary="Détail d'une intervention", tags=['Interventions']),
    create=extend_schema(summary="Créer une intervention", tags=['Interventions']),
    partial_update=extend_schema(summary="Modifier une intervention", tags=['Interventions']),
    destroy=extend_schema(summary="Supprimer une intervention", tags=['Interventions']),
)
class InterventionViewSet(viewsets.ModelViewSet):
    """
    CRUD complet sur les interventions + actions métier (assigner / clôturer).
    Permissions :
      - GET : tous les authentifiés
      - POST / PATCH (create, assigner, cloturer, photos upload) : opérateur et au-dessus
      - DELETE : admin uniquement
    """
    serializer_class   = InterventionSerializer
    permission_classes = [RoleBasedPermission]
    pagination_class   = FlexiblePageNumberPagination
    http_method_names  = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = (
            Intervention.objects
            .select_related('incident', 'responsable', 'equipe', 'created_by')
        )

        # ── Filtres ───────────────────────────────────────────────
        incident_id   = self.request.query_params.get('incident')
        statut        = self.request.query_params.get('statut')
        responsable   = self.request.query_params.get('responsable')
        type_travaux  = self.request.query_params.get('type_travaux')
        date_after    = self.request.query_params.get('date_planifiee_after')
        date_before   = self.request.query_params.get('date_planifiee_before')

        if incident_id:
            qs = qs.filter(incident_id=incident_id)
        if statut:
            qs = qs.filter(statut=statut)
        if responsable:
            qs = qs.filter(responsable_id=responsable)
        if type_travaux:
            qs = qs.filter(type_travaux=type_travaux)
        if date_after:
            qs = qs.filter(date_planifiee__date__gte=date_after)
        if date_before:
            qs = qs.filter(date_planifiee__date__lte=date_before)

        return qs.order_by('-created_at')

    # ── Action : assigner / démarrer une intervention ─────────────
    @extend_schema(
        summary="Démarrer et assigner une intervention",
        description=(
            "Assigne un responsable à l'intervention et la fait passer au statut `en_cours` "
            "via la méthode métier `demarrer()`."
        ),
        request=AssignerIncidentSerializer,
        responses={200: InterventionSerializer},
        tags=['Interventions'],
    )
    @action(detail=True, methods=['post'], url_path='assigner')
    def assigner(self, request, pk=None):
        """
        POST /api/interventions/{id}/assigner/
        Body : { "user_id": <int> }
        Lance l'intervention et assigne un responsable.
        """
        intervention = self.get_object()
        ser = AssignerIncidentSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        user = User.objects.get(pk=ser.validated_data['user_id'])
        intervention.demarrer(utilisateur=user)

        return Response(
            InterventionSerializer(intervention, context={'request': request}).data
        )

    # ── Action : clôturer une intervention ────────────────────────
    @extend_schema(
        summary="Clôturer une intervention",
        description=(
            "Clôture l'intervention via la méthode métier `cloturer()`. "
            "Le champ `rapport` est optionnel mais recommandé."
        ),
        request=CloturerInterventionSerializer,
        responses={200: InterventionSerializer},
        tags=['Interventions'],
    )
    @action(detail=True, methods=['post'], url_path='cloturer')
    def cloturer(self, request, pk=None):
        """
        POST /api/interventions/{id}/cloturer/
        Body : { "rapport": "..." }  (optionnel)
        """
        intervention = self.get_object()
        ser = CloturerInterventionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        rapport = ser.validated_data.get('rapport', '')
        intervention.cloturer(rapport=rapport)

        return Response(
            InterventionSerializer(intervention, context={'request': request}).data
        )

    # ── Action : photos d'une intervention ───────────────────────
    @extend_schema(
        summary="Photos d'une intervention",
        description="GET : liste des photos. POST : upload d'une photo (multipart/form-data).",
        responses={200: InterventionPhotoSerializer(many=True), 201: InterventionPhotoSerializer},
        tags=['Interventions'],
    )
    @action(detail=True, methods=['get', 'post'], url_path='photos',
            parser_classes=[__import__('rest_framework.parsers', fromlist=['MultiPartParser']).MultiPartParser,
                            __import__('rest_framework.parsers', fromlist=['FormParser']).FormParser])
    def photos(self, request, pk=None):
        intervention = self.get_object()

        if request.method == 'GET':
            qs  = intervention.photos.all()
            ser = InterventionPhotoSerializer(qs, many=True, context={'request': request})
            return Response(ser.data)

        # POST — upload
        ser = InterventionPhotoSerializer(data=request.data, context={'request': request})
        ser.is_valid(raise_exception=True)
        photo = ser.save(
            intervention=intervention,
            uploaded_by=request.user if request.user.is_authenticated else None,
        )
        return Response(
            InterventionPhotoSerializer(photo, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


# ─────────────────────────────────────────────────────────────────────────────
#  TYPE D'INCIDENT VIEWSET
# ─────────────────────────────────────────────────────────────────────────────

@extend_schema_view(
    list=extend_schema(
        summary="Liste des types d'incidents",
        description="Retourne les types d'incidents actifs, administrables depuis l'interface admin.",
        tags=["Référentiels"],
    ),
    retrieve=extend_schema(summary="Détail d'un type d'incident", tags=["Référentiels"]),
)
class TypeIncidentViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Liste en lecture seule des types d'incidents.
    La création/modification se fait depuis l'admin Django.
    """
    serializer_class   = TypeIncidentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = TypeIncident.objects.all()
        # Paramètre ?actif=true pour ne récupérer que les actifs (défaut frontend)
        actif = self.request.query_params.get('actif')
        if actif is not None:
            qs = qs.filter(actif=(actif.lower() != 'false'))
        return qs.order_by('ordre', 'nom')


# ─────────────────────────────────────────────────────────────────────────────
#  ÉQUIPE VIEWSET
# ─────────────────────────────────────────────────────────────────────────────

@extend_schema_view(
    list=extend_schema(
        summary="Liste des équipes",
        description="Retourne les équipes d'intervention, administrables depuis l'interface admin.",
        tags=["Référentiels"],
    ),
    retrieve=extend_schema(summary="Détail d'une équipe", tags=["Référentiels"]),
)
class EquipeViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Liste en lecture seule des équipes.
    La création/modification se fait depuis l'admin Django.
    """
    serializer_class   = EquipeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Equipe.objects.select_related('responsable').all()
        actif = self.request.query_params.get('actif')
        if actif is not None:
            qs = qs.filter(actif=(actif.lower() != 'false'))
        return qs.order_by('nom')


# ─────────────────────────────────────────────────────────────────────────────
#  INCIDENT SELECT VIEWSET  (dropdown léger pour le formulaire Intervention)
# ─────────────────────────────────────────────────────────────────────────────

@extend_schema_view(
    list=extend_schema(
        summary="Liste légère des incidents (sélecteur)",
        description="Incidents ouverts/en cours pour le dropdown du formulaire d'intervention.",
        tags=["Référentiels"],
        parameters=[
            OpenApiParameter('statut', OpenApiTypes.STR,
                             description="Filtre statut (défaut: ouvert,en_cours)"),
        ],
    ),
)
class IncidentSelectViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Endpoint léger pour peupler le sélecteur d'incident dans le formulaire Intervention.
    Retourne uniquement id + label + statut + priorite.
    """
    serializer_class   = IncidentSelectSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        statut = self.request.query_params.get('statut')
        if statut:
            return Incident.objects.filter(statut=statut).order_by('-date_signalement')
        # Par défaut : incidents actifs (ouvert + en_cours)
        return Incident.objects.filter(
            statut__in=[IncidentStatut.OUVERT, IncidentStatut.EN_COURS]
        ).order_by('-date_signalement')


# ─────────────────────────────────────────────────────────────────────────────
#  TYPE D'OUVRAGE VIEWSET
# ─────────────────────────────────────────────────────────────────────────────

@extend_schema_view(
    list=extend_schema(
        summary="Liste des types d'ouvrages",
        description=(
            "Retourne les types d'ouvrages configurés (ex : Poste HTA/BT, Cabine, Transformateur). "
            "Chaque type porte la référence GeoServer (layer_key, couche_geoserver) "
            "et les champs clés pour la corrélation carte ↔ incident."
        ),
        tags=["Référentiels"],
    ),
    retrieve=extend_schema(summary="Détail d'un type d'ouvrage", tags=["Référentiels"]),
)
class TypeOuvrageViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Liste en lecture seule des types d'ouvrages.
    Administrables depuis l'admin Django.
    """
    serializer_class   = TypeOuvrageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = TypeOuvrage.objects.all()
        actif = self.request.query_params.get('actif')
        if actif is not None:
            qs = qs.filter(actif=(actif.lower() != 'false'))
        return qs.order_by('ordre', 'nom')


# ─────────────────────────────────────────────────────────────────────────────
#  OUVRAGE VIEWSET
# ─────────────────────────────────────────────────────────────────────────────

@extend_schema_view(
    list=extend_schema(
        summary="Liste des ouvrages",
        description=(
            "Retourne les ouvrages enregistrés. "
            "Filtrables par : type_ouvrage (id), code (exact), search (nom/code)."
        ),
        tags=["Ouvrages"],
        parameters=[
            OpenApiParameter('type_ouvrage', OpenApiTypes.INT,  description="ID du type d'ouvrage"),
            OpenApiParameter('code',         OpenApiTypes.STR,  description="Code exact de l'ouvrage"),
            OpenApiParameter('search',       OpenApiTypes.STR,  description="Recherche dans le nom ou le code"),
        ],
    ),
    retrieve=extend_schema(summary="Détail d'un ouvrage", tags=["Ouvrages"]),
    create=extend_schema(summary="Enregistrer un ouvrage", tags=["Ouvrages"]),
    partial_update=extend_schema(summary="Modifier un ouvrage", tags=["Ouvrages"]),
)
class OuvrageViewSet(viewsets.ModelViewSet):
    """
    CRUD Ouvrage.
    - GET  /api/ouvrages/?code=XXX  → recherche par code unique (pour l'auto-fill depuis la carte)
    - POST /api/ouvrages/           → création lors du signalement d'un incident sur un ouvrage inconnu
    Permissions : opérateur+ pour créer/modifier, admin pour supprimer.
    """
    serializer_class   = OuvrageSerializer
    permission_classes = [RoleBasedPermission]
    http_method_names  = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        qs = Ouvrage.objects.select_related('type_ouvrage').all()

        code         = self.request.query_params.get('code')
        type_ouvrage = self.request.query_params.get('type_ouvrage')
        search       = self.request.query_params.get('search')
        actif        = self.request.query_params.get('actif')

        if code:
            qs = qs.filter(code__iexact=code)
        if type_ouvrage:
            qs = qs.filter(type_ouvrage_id=type_ouvrage)
        if search:
            qs = qs.filter(
                Q(code__icontains=search) | Q(nom__icontains=search)
            )
        if actif is not None:
            qs = qs.filter(actif=(actif.lower() != 'false'))

        return qs.order_by('code')


# ─────────────────────────────────────────────────────────────────────────────
#  NOTIFICATIONS FEED
# ─────────────────────────────────────────────────────────────────────────────

@extend_schema(
    summary="Fil de notifications temps réel (polling)",
    description=(
        "Retourne les événements survenus depuis `since` : "
        "nouveaux incidents, incidents dont le statut a changé, nouvelles interventions. "
        "Le client doit renvoyer le `timestamp` reçu comme prochain `since`."
    ),
    parameters=[
        OpenApiParameter(
            'since', OpenApiTypes.DATETIME,
            description="ISO 8601 — événements survenus après cette date. "
                        "Absent → 5 dernières minutes par défaut.",
        ),
    ],
    tags=["Notifications"],
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notifications_feed(request):
    """
    Endpoint de polling léger pour les notifications temps réel.

    GET /api/notifications/feed/?since=2024-01-15T10:00:00Z
    → retourne les incidents créés, modifiés et les interventions créées depuis `since`.

    Réponse :
    {
        "timestamp": "<now ISO>",   ← à renvoyer comme `since` au prochain appel
        "count": 3,
        "events": [ { type, id, titre, ... }, ... ]
    }
    """
    since_str = request.query_params.get('since')

    if since_str:
        since = parse_datetime(since_str)
        if since is None:
            since = timezone.now() - timedelta(minutes=5)
    else:
        since = timezone.now() - timedelta(minutes=5)

    now = timezone.now()

    # ── Nouveaux incidents ─────────────────────────────────────────
    nouveaux = (
        Incident.objects
        .filter(created_at__gte=since)
        .select_related('type_incident')
        .order_by('-created_at')[:10]
    )

    # ── Incidents modifiés (statut changé, non nouvellement créés) ─
    modifies = (
        Incident.objects
        .filter(updated_at__gte=since, created_at__lt=since)
        .order_by('-updated_at')[:10]
    )

    # ── Nouvelles interventions ────────────────────────────────────
    interventions = (
        Intervention.objects
        .filter(created_at__gte=since)
        .select_related('incident')
        .order_by('-created_at')[:10]
    )

    events = []

    for inc in nouveaux:
        events.append({
            'type':     'incident_nouveau',
            'id':       inc.id,
            'titre':    inc.titre or (inc.type_incident.nom if inc.type_incident else 'Incident'),
            'priorite': inc.priorite,
            'statut':   inc.statut,
            'date':     inc.created_at.isoformat(),
        })

    for inc in modifies:
        events.append({
            'type':   'incident_modifie',
            'id':     inc.id,
            'titre':  inc.titre or '—',
            'statut': inc.statut,
            'date':   inc.updated_at.isoformat(),
        })

    for iv in interventions:
        events.append({
            'type':           'intervention_nouvelle',
            'id':             iv.id,
            'incident_id':    iv.incident_id,
            'incident_titre': iv.incident.titre or '—',
            'type_travaux':   iv.get_type_travaux_display(),
            'statut':         iv.statut,
            'date':           iv.created_at.isoformat(),
        })

    # Trier par date décroissante
    events.sort(key=lambda e: e['date'], reverse=True)

    return Response({
        'timestamp': now.isoformat(),
        'count':     len(events),
        'events':    events,
    })
