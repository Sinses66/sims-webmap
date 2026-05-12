"""
eneo_reseau.serializers
=======================
Sérialiseurs DRF pour Incident, Intervention, TypeIncident, Equipe et IncidentPhoto.
"""

from django.contrib.auth.models import User
from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from drf_spectacular.types import OpenApiTypes

from .models import Incident, Intervention, IncidentPhoto, InterventionPhoto, TypeIncident, Equipe, TypeOuvrage, Ouvrage


# ─────────────────────────────────────────────────────────────────────────────
#  HELPERS
# ─────────────────────────────────────────────────────────────────────────────

class UserMinimalSerializer(serializers.ModelSerializer):
    """Représentation allégée d'un utilisateur (lecture seule)."""
    full_name = serializers.SerializerMethodField()

    class Meta:
        model  = User
        fields = ['id', 'username', 'full_name']

    @extend_schema_field(OpenApiTypes.STR)
    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


# ─────────────────────────────────────────────────────────────────────────────
#  TYPE D'OUVRAGE + OUVRAGE
# ─────────────────────────────────────────────────────────────────────────────

class TypeOuvrageSerializer(serializers.ModelSerializer):
    class Meta:
        model  = TypeOuvrage
        fields = ['id', 'nom', 'couche_geoserver', 'layer_key',
                  'champ_cle', 'champ_nom', 'icone', 'actif', 'ordre']


class OuvrageSerializer(serializers.ModelSerializer):
    type_ouvrage_detail = TypeOuvrageSerializer(source='type_ouvrage', read_only=True)
    nb_incidents        = serializers.SerializerMethodField()

    class Meta:
        model  = Ouvrage
        fields = ['id', 'code', 'nom', 'type_ouvrage', 'type_ouvrage_detail',
                  'latitude', 'longitude', 'actif', 'nb_incidents', 'created_at']
        read_only_fields = ['created_at']

    @extend_schema_field(OpenApiTypes.INT)
    def get_nb_incidents(self, obj):
        return obj.incidents.count()


class OuvrageMinimalSerializer(serializers.ModelSerializer):
    """Représentation légère pour l'imbrication dans Incident."""
    type_nom = serializers.CharField(source='type_ouvrage.nom', read_only=True, default='')

    class Meta:
        model  = Ouvrage
        fields = ['id', 'code', 'nom', 'type_nom']


# ─────────────────────────────────────────────────────────────────────────────
#  TYPE D'INCIDENT
# ─────────────────────────────────────────────────────────────────────────────

class TypeIncidentSerializer(serializers.ModelSerializer):
    class Meta:
        model  = TypeIncident
        fields = ['id', 'nom', 'description', 'icone', 'actif', 'ordre']


# ─────────────────────────────────────────────────────────────────────────────
#  ÉQUIPE
# ─────────────────────────────────────────────────────────────────────────────

class EquipeSerializer(serializers.ModelSerializer):
    responsable_detail = UserMinimalSerializer(source='responsable', read_only=True)

    class Meta:
        model  = Equipe
        fields = ['id', 'nom', 'specialite', 'contact', 'actif', 'responsable', 'responsable_detail']
        read_only_fields = ['responsable_detail']


# ─────────────────────────────────────────────────────────────────────────────
#  INCIDENT PHOTO
# ─────────────────────────────────────────────────────────────────────────────

class IncidentPhotoSerializer(serializers.ModelSerializer):
    uploaded_by = UserMinimalSerializer(read_only=True)

    class Meta:
        model  = IncidentPhoto
        fields = ['id', 'image', 'legende', 'uploaded_at', 'uploaded_by']
        read_only_fields = ['uploaded_at', 'uploaded_by']


# ─────────────────────────────────────────────────────────────────────────────
#  INTERVENTION PHOTO
# ─────────────────────────────────────────────────────────────────────────────

class InterventionPhotoSerializer(serializers.ModelSerializer):
    uploaded_by = UserMinimalSerializer(read_only=True)

    class Meta:
        model  = InterventionPhoto
        fields = ['id', 'image', 'legende', 'uploaded_at', 'uploaded_by']
        read_only_fields = ['uploaded_at', 'uploaded_by']


# ─────────────────────────────────────────────────────────────────────────────
#  INTERVENTION
# ─────────────────────────────────────────────────────────────────────────────

class InterventionSerializer(serializers.ModelSerializer):
    responsable_detail = UserMinimalSerializer(source='responsable', read_only=True)
    created_by_detail  = UserMinimalSerializer(source='created_by',  read_only=True)
    equipe_detail      = EquipeSerializer(source='equipe', read_only=True)
    duree_reelle       = serializers.IntegerField(source='duree_reelle_minutes', read_only=True)

    type_travaux_label = serializers.CharField(source='get_type_travaux_display', read_only=True)
    statut_label       = serializers.CharField(source='get_statut_display',       read_only=True)

    photos = InterventionPhotoSerializer(many=True, read_only=True)

    class Meta:
        model  = Intervention
        fields = [
            'id', 'incident',
            'type_travaux', 'type_travaux_label',
            'statut', 'statut_label',
            'description', 'rapport', 'observations',
            'responsable', 'responsable_detail',
            'equipe', 'equipe_detail',
            'date_planifiee', 'date_debut', 'date_fin', 'duree_estimee', 'duree_reelle',
            'photos',
            'created_by', 'created_by_detail',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by', 'created_by_detail']

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['created_by'] = request.user
        return super().create(validated_data)


class InterventionListSerializer(serializers.ModelSerializer):
    """Version compacte pour les listes imbriquées dans l'incident."""
    responsable_detail = UserMinimalSerializer(source='responsable', read_only=True)
    equipe_detail      = EquipeSerializer(source='equipe', read_only=True)
    type_travaux_label = serializers.CharField(source='get_type_travaux_display', read_only=True)
    statut_label       = serializers.CharField(source='get_statut_display',       read_only=True)

    class Meta:
        model  = Intervention
        fields = [
            'id', 'type_travaux', 'type_travaux_label',
            'statut', 'statut_label',
            'responsable_detail', 'equipe_detail',
            'date_planifiee', 'date_fin',
        ]


# ─────────────────────────────────────────────────────────────────────────────
#  INCIDENT
# ─────────────────────────────────────────────────────────────────────────────

class IncidentSerializer(serializers.ModelSerializer):
    signale_par_detail   = UserMinimalSerializer(source='signale_par',   read_only=True)
    assigne_a_detail     = UserMinimalSerializer(source='assigne_a',     read_only=True)
    type_incident_detail = TypeIncidentSerializer(source='type_incident', read_only=True)
    ouvrage_detail       = OuvrageMinimalSerializer(source='ouvrage',    read_only=True)

    type_incident_label = serializers.SerializerMethodField()
    statut_label        = serializers.CharField(source='get_statut_display',   read_only=True)
    priorite_label      = serializers.CharField(source='get_priorite_display', read_only=True)

    photos        = IncidentPhotoSerializer(many=True, read_only=True)
    interventions = InterventionListSerializer(many=True, read_only=True)
    nb_interventions = serializers.IntegerField(read_only=True)

    class Meta:
        model  = Incident
        fields = [
            'id',
            'ouvrage', 'ouvrage_detail',
            'titre', 'description',
            'type_incident', 'type_incident_label', 'type_incident_detail',
            'statut', 'statut_label',
            'priorite', 'priorite_label',
            'latitude', 'longitude',
            'couche_id', 'couche_nom', 'feature_id',
            'localisation', 'quartier', 'ville',
            'signale_par', 'signale_par_detail',
            'assigne_a',   'assigne_a_detail',
            'date_signalement', 'date_prise_charge', 'date_resolution',
            'created_at', 'updated_at',
            'nb_interventions', 'interventions', 'photos',
        ]
        read_only_fields = [
            'created_at', 'updated_at',
            'signale_par', 'signale_par_detail',
            'nb_interventions',
        ]

    @extend_schema_field(OpenApiTypes.STR)
    def get_type_incident_label(self, obj):
        return obj.type_incident.nom if obj.type_incident else ''

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['signale_par'] = request.user
        return super().create(validated_data)


class IncidentListSerializer(serializers.ModelSerializer):
    """Sérialiseur allégé pour les listes (pas d'imbrication lourde)."""
    signale_par_detail  = UserMinimalSerializer(source='signale_par', read_only=True)
    assigne_a_detail    = UserMinimalSerializer(source='assigne_a',   read_only=True)
    ouvrage_detail      = OuvrageMinimalSerializer(source='ouvrage',  read_only=True)
    type_incident_label = serializers.SerializerMethodField()
    statut_label        = serializers.CharField(source='get_statut_display',   read_only=True)
    priorite_label      = serializers.CharField(source='get_priorite_display', read_only=True)
    nb_interventions    = serializers.IntegerField(source='interventions_count', read_only=True)

    class Meta:
        model  = Incident
        fields = [
            'id', 'titre',
            'ouvrage', 'ouvrage_detail',
            'type_incident', 'type_incident_label',
            'statut', 'statut_label',
            'priorite', 'priorite_label',
            'latitude', 'longitude',
            'localisation', 'quartier', 'ville',
            'signale_par_detail', 'assigne_a_detail',
            'date_signalement', 'date_resolution',
            'nb_interventions',
        ]

    @extend_schema_field(OpenApiTypes.STR)
    def get_type_incident_label(self, obj):
        return obj.type_incident.nom if obj.type_incident else ''


# ─────────────────────────────────────────────────────────────────────────────
#  ACTIONS SPÉCIALES
# ─────────────────────────────────────────────────────────────────────────────

class AssignerIncidentSerializer(serializers.Serializer):
    """Payload pour l'action d'assignation d'un incident."""
    user_id = serializers.IntegerField(required=True, help_text="ID de l'utilisateur à assigner")

    def validate_user_id(self, value):
        try:
            User.objects.get(pk=value)
        except User.DoesNotExist:
            raise serializers.ValidationError('Utilisateur introuvable.')
        return value


class CloturerInterventionSerializer(serializers.Serializer):
    """Payload pour la clôture d'une intervention."""
    rapport = serializers.CharField(
        required=False,
        allow_blank=True,
        default='',
        help_text='Rapport de clôture (optionnel)',
    )


# ─────────────────────────────────────────────────────────────────────────────
#  SÉLECTEUR INCIDENT (liste légère pour le dropdown dans le formulaire Intervention)
# ─────────────────────────────────────────────────────────────────────────────

class IncidentSelectSerializer(serializers.ModelSerializer):
    """Représentation minimale pour le sélecteur dans le formulaire Intervention."""
    label = serializers.SerializerMethodField()

    class Meta:
        model  = Incident
        fields = ['id', 'label', 'statut', 'priorite']

    @extend_schema_field(OpenApiTypes.STR)
    def get_label(self, obj):
        return f'#{obj.pk} — {obj.titre}'
