from rest_framework import serializers
from django.contrib.auth.models import User
from drf_spectacular.utils import extend_schema_field
from drf_spectacular.types import OpenApiTypes
from .models import Organisation, Application, ApplicationLayer, UserProfile, MapAnnotation, MapBookmark, Dashboard, DashboardWidget


class OrganisationSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Organisation
        fields = ['id', 'name', 'slug', 'description', 'logo', 'website', 'is_active']


class ApplicationLayerSerializer(serializers.ModelSerializer):
    """
    Sérialiseur de ApplicationLayer.

    Expose deux ensembles de champs :
      1. Champs « natifs » Django  (verbose, pour l'admin / POST)
      2. Alias React  (noms courts attendus par buildLayerGroups() côté frontend)

    Alias React :
      group       ← group_slug   (identifiant du groupe, ex: htb_existant)
      visible     ← visible_default
      opacity     ← opacity_default
    """

    # ── Alias compatibilité React ──────────────────────────────
    group   = serializers.CharField(
        source='group_slug', read_only=True,
        help_text="Identifiant du groupe (utilisé par buildLayerGroups côté React)"
    )
    visible = serializers.BooleanField(
        source='visible_default', read_only=True,
        help_text="Alias de visible_default pour le frontend"
    )
    opacity = serializers.FloatField(
        source='opacity_default', read_only=True,
        help_text="Alias de opacity_default pour le frontend"
    )

    class Meta:
        model  = ApplicationLayer
        fields = [
            # ── Rattachement ─────────────────────────────────────
            'application',        # FK obligatoire (writable)

            # ── Identité ────────────────────────────────────────
            'id',
            'layer_key',          # identifiant stable React (ex: cmr_reseau_htb)
            'name',
            'description',
            'geoserver_layer',
            'layer_type',         # 'WMS' | 'WFS'

            # ── Groupe ──────────────────────────────────────────
            'group',              # alias ← group_slug
            'group_slug',         # identifiant brut du groupe
            'group_label',        # libellé affiché (ex: Réseau HTB Existant)
            'group_icon',         # emoji (ex: ⚡)
            'group_order',        # ordre de tri du groupe
            'group_name',         # champ legacy (backward compat)

            # ── Visibilité / opacité ─────────────────────────────
            'visible',            # alias ← visible_default
            'opacity',            # alias ← opacity_default
            'visible_default',    # champ Django natif
            'opacity_default',    # champ Django natif
            'layer_order',

            # ── Style ───────────────────────────────────────────
            'color',
            'line_width',
            'point_radius',
            'style_config',

            # ── Popup ────────────────────────────────────────────
            'popup_fields',   # liste ordonnée des attributs à afficher
        ]
        read_only_fields = ['id', 'group', 'visible', 'opacity']

    def validate_geoserver_layer(self, value):
        """
        Valide le format workspace:nom_couche côté sérialiseur.
        DRF n'appelle pas model.clean() automatiquement — cette validation
        garantit un 400 correct via l'API sans passer par full_clean().
        """
        if not value:
            return value
        parts = value.strip().split(':')
        if len(parts) != 2 or not parts[0] or not parts[1]:
            raise serializers.ValidationError(
                "Format invalide — attendu : workspace:nom_couche "
                f"(ex: eneo_gis_ws:cmrReseauHTB). Valeur reçue : « {value} »"
            )
        return value


class ApplicationSerializer(serializers.ModelSerializer):
    organisation_name = serializers.CharField(source='organisation.name', read_only=True)
    layers            = ApplicationLayerSerializer(many=True, read_only=True)
    config_full       = serializers.SerializerMethodField()
    layers_count      = serializers.SerializerMethodField()

    class Meta:
        model  = Application
        fields = [
            'id', 'slug', 'name', 'subtitle', 'description', 'thumbnail',
            'organisation', 'organisation_name',
            'config', 'config_full',
            'center_lat', 'center_lon', 'zoom_default', 'zoom_min', 'zoom_max',
            'module_incidents', 'module_interventions', 'module_analytics',
            'module_export', 'module_editor',
            'is_public', 'is_active',
            'layers', 'layers_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_config_full(self, obj):
        return obj.default_config

    @extend_schema_field(OpenApiTypes.INT)
    def get_layers_count(self, obj):
        return obj.layers.count()


class ApplicationListSerializer(serializers.ModelSerializer):
    """Sérialiseur allégé pour la liste des applications (page d'accueil)."""
    organisation_name = serializers.CharField(source='organisation.name', read_only=True)
    layers_count      = serializers.SerializerMethodField()
    stats             = serializers.SerializerMethodField()

    class Meta:
        model  = Application
        fields = [
            'id', 'slug', 'name', 'subtitle', 'description', 'thumbnail',
            'organisation', 'organisation_name',
            'is_public', 'is_active',
            'layers_count', 'stats',
            'updated_at',
        ]

    @extend_schema_field(OpenApiTypes.INT)
    def get_layers_count(self, obj):
        return obj.layers.count()

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_stats(self, obj):
        # Stats rapides pour la carte d'application
        try:
            from sims_network.models import Incident, Intervention
            return {
                'incidents':     obj.incidents.filter(statut='ouvert').count(),
                'interventions': obj.interventions.filter(statut__in=['planifiee', 'en_cours']).count(),
                'users':         obj.organisation.users.count() if obj.organisation else 0,
            }
        except Exception:
            return {'incidents': 0, 'interventions': 0, 'users': 0}


class UserProfileSerializer(serializers.ModelSerializer):
    user_id    = serializers.IntegerField(source='user.id',         read_only=True)
    username   = serializers.CharField(source='user.username',      read_only=True)
    email      = serializers.CharField(source='user.email',         read_only=True)
    first_name = serializers.CharField(source='user.first_name',    read_only=True)
    last_name  = serializers.CharField(source='user.last_name',     read_only=True)
    full_name  = serializers.SerializerMethodField()
    is_active  = serializers.BooleanField(source='user.is_active',  read_only=True)
    organisation_name = serializers.CharField(source='organisation.name', read_only=True)
    avatar_url = serializers.SerializerMethodField()

    def get_full_name(self, obj):
        name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        return name or obj.user.username

    def get_avatar_url(self, obj):
        """Retourne l'URL absolue de l'avatar, ou None si pas de photo."""
        if not obj.avatar:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.avatar.url)
        return obj.avatar.url

    class Meta:
        model  = UserProfile
        fields = [
            'id', 'user_id', 'username', 'full_name',
            'email', 'first_name', 'last_name',
            'organisation', 'organisation_name',
            'role', 'avatar', 'avatar_url', 'phone', 'is_active',
            'created_at',
        ]
        read_only_fields = ['created_at', 'avatar_url']


class MapAnnotationSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model  = MapAnnotation
        fields = [
            'id', 'application', 'title', 'geom_type', 'geojson',
            'color', 'is_shared', 'created_by', 'created_by_name', 'created_at',
        ]
        read_only_fields = ['created_by', 'created_at']

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class MapBookmarkSerializer(serializers.ModelSerializer):
    class Meta:
        model  = MapBookmark
        fields = [
            'id', 'application', 'name',
            'center_lat', 'center_lon', 'zoom',
            'active_layers', 'created_at',
        ]
        read_only_fields = ['user', 'created_at']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


# ─────────────────────────────────────────────────────────────────
# Dashboard / Widget
# ─────────────────────────────────────────────────────────────────
class DashboardWidgetSerializer(serializers.ModelSerializer):
    class Meta:
        model  = DashboardWidget
        fields = [
            'id', 'dashboard', 'title',
            'geoserver_layer', 'layer_name',
            'attributes', 'chart_type', 'color_scheme',
            'filters', 'position', 'config',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class DashboardSerializer(serializers.ModelSerializer):
    widgets          = DashboardWidgetSerializer(many=True, read_only=True)
    created_by_name  = serializers.CharField(source='created_by.username', read_only=True)
    widgets_count    = serializers.SerializerMethodField()

    class Meta:
        model  = Dashboard
        fields = [
            'id', 'application', 'name', 'description',
            'is_shared', 'created_by', 'created_by_name',
            'widgets', 'widgets_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    @extend_schema_field(OpenApiTypes.INT)
    def get_widgets_count(self, obj):
        return obj.widgets.count()

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class DashboardListSerializer(serializers.ModelSerializer):
    """Sérialiseur allégé pour la liste des dashboards (sans widgets détaillés)."""
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    widgets_count   = serializers.SerializerMethodField()

    class Meta:
        model  = Dashboard
        fields = [
            'id', 'application', 'name', 'description',
            'is_shared', 'created_by_name',
            'widgets_count', 'updated_at',
        ]

    @extend_schema_field(OpenApiTypes.INT)
    def get_widgets_count(self, obj):
        return obj.widgets.count()
