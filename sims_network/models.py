"""
sims_network.models
===================
Modeles metier pour la gestion des incidents et interventions sur le reseau.

Schema simplifie :
    TypeOuvrage   <--(FK)--  Ouvrage  <--(FK)--  Incident  <--(FK)--  Intervention
    TypeIncident  <--(FK)--  Incident
    Equipe        <--(FK)--  Intervention
    Incident      <--(FK)--  IncidentPhoto
"""

from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


# ─────────────────────────────────────────────────────────────────────────────
#  CHOICES
# ─────────────────────────────────────────────────────────────────────────────

class IncidentStatut(models.TextChoices):
    OUVERT      = 'ouvert',       'Ouvert'
    EN_COURS    = 'en_cours',     'En cours de traitement'
    RESOLU      = 'resolu',       'Résolu'
    FERME       = 'ferme',        'Fermé'
    ANNULE      = 'annule',       'Annulé'


class IncidentPriorite(models.TextChoices):
    CRITIQUE  = 'critique',  'Critique'
    HAUTE     = 'haute',     'Haute'
    MOYENNE   = 'moyenne',   'Moyenne'
    BASSE     = 'basse',     'Basse'


class InterventionStatut(models.TextChoices):
    PLANIFIEE   = 'planifiee',   'Planifiée'
    EN_COURS    = 'en_cours',    'En cours'
    TERMINEE    = 'terminee',    'Terminée'
    ANNULEE     = 'annulee',     'Annulée'


class TypeTravaux(models.TextChoices):
    REMPLACEMENT   = 'remplacement',   'Remplacement matériel'
    REPARATION     = 'reparation',     'Réparation'
    MAINTENANCE    = 'maintenance',    'Maintenance préventive'
    INSPECTION     = 'inspection',     'Inspection'
    AUTRE          = 'autre',          'Autre'


# ─────────────────────────────────────────────────────────────────────────────
#  TYPE D'OUVRAGE
# ─────────────────────────────────────────────────────────────────────────────

class TypeOuvrage(models.Model):
    """
    Catalogue des types d'ouvrages du reseau.
    Chaque type est lie a une couche cartographique (ApplicationLayer) via FK.

    La FK `application_layer` est la SOURCE DE VERITE : au save(), les champs
    `couche_geoserver` et `layer_key` sont automatiquement synchronises depuis
    la couche liee.
    """
    from sims_core.models import ApplicationLayer as _AL  # import local pour eviter les cycles

    nom              = models.CharField(max_length=100, verbose_name='Nom')

    application_layer = models.ForeignKey(
        'sims_core.ApplicationLayer',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='type_ouvrages',
        verbose_name='Couche cartographique',
        help_text=(
            'Selectionnez la couche ApplicationLayer correspondante. '
            'couche_geoserver et layer_key seront synchronises automatiquement.'
        ),
    )

    couche_geoserver = models.CharField(
        max_length=200, blank=True,
        verbose_name='Couche GeoServer',
        help_text='Synchronise depuis application_layer.geoserver_layer (lecture seule si FK definie).'
    )
    layer_key        = models.CharField(
        max_length=100, blank=True,
        verbose_name='Cle de couche (layer_key)',
        help_text='Synchronise depuis application_layer.layer_key (lecture seule si FK definie).'
    )

    champ_cle        = models.CharField(
        max_length=100,
        verbose_name='Attribut-cle',
        help_text="Nom de l'attribut WFS servant de code unique (ex: code_transfo)"
    )
    champ_nom        = models.CharField(
        max_length=100, blank=True,
        verbose_name='Attribut nom',
        help_text="Nom de l'attribut WFS pour le libelle de l'ouvrage (ex: nom_transfo)"
    )
    icone            = models.CharField(max_length=10, blank=True, default='🔌', verbose_name='Icone')
    actif            = models.BooleanField(default=True, verbose_name='Actif', db_index=True)
    ordre            = models.PositiveSmallIntegerField(default=0, verbose_name='Ordre')

    class Meta:
        verbose_name        = "Type d'ouvrage"
        verbose_name_plural = "Types d'ouvrage"
        ordering            = ['ordre', 'nom']
        db_table            = 'sims_network_typeouvrage'

    def save(self, *args, **kwargs):
        if self.application_layer_id:
            try:
                layer = self.__class__._meta.get_field('application_layer') \
                    .related_model.objects.get(pk=self.application_layer_id)
                self.couche_geoserver = layer.geoserver_layer or self.couche_geoserver
                self.layer_key        = layer.layer_key        or self.layer_key
            except Exception:
                pass
        super().save(*args, **kwargs)

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.application_layer_id and self.layer_key:
            try:
                layer = self.__class__._meta.get_field('application_layer') \
                    .related_model.objects.get(pk=self.application_layer_id)
                if layer.layer_key and layer.layer_key != self.layer_key:
                    raise ValidationError({
                        'layer_key': (
                            f'Incoherence detectee : layer_key "{self.layer_key}" '
                            f'vs ApplicationLayer.layer_key "{layer.layer_key}". '
                            f'Videz le champ layer_key pour le synchroniser automatiquement.'
                        )
                    })
            except self.__class__._meta.get_field('application_layer').related_model.DoesNotExist:
                pass

    def __str__(self):
        return f'{self.icone} {self.nom}'


# ─────────────────────────────────────────────────────────────────────────────
#  OUVRAGE
# ─────────────────────────────────────────────────────────────────────────────

class Ouvrage(models.Model):
    """
    Un ouvrage physique du reseau.
    Cree automatiquement lors du premier incident sur cet ouvrage
    (depuis la selection carte) ou manuellement depuis l'admin.
    """
    code         = models.CharField(
        max_length=100, unique=True,
        verbose_name='Code ouvrage',
        help_text="Identifiant unique de l'ouvrage (lu depuis GeoServer)"
    )
    nom          = models.CharField(max_length=200, blank=True, verbose_name='Nom / Libelle')
    type_ouvrage = models.ForeignKey(
        TypeOuvrage,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='ouvrages',
        verbose_name="Type d'ouvrage",
    )
    latitude     = models.FloatField(null=True, blank=True, verbose_name='Latitude')
    longitude    = models.FloatField(null=True, blank=True, verbose_name='Longitude')
    actif        = models.BooleanField(default=True, verbose_name='Actif', db_index=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = 'Ouvrage'
        verbose_name_plural = 'Ouvrages'
        ordering            = ['code']
        db_table            = 'sims_network_ouvrage'

    def __str__(self):
        label = self.nom or self.code
        type_label = self.type_ouvrage.nom if self.type_ouvrage else 'Ouvrage'
        return f'[{type_label}] {label}'


# ─────────────────────────────────────────────────────────────────────────────
#  TYPE D'INCIDENT
# ─────────────────────────────────────────────────────────────────────────────

class TypeIncident(models.Model):
    """
    Catalogue des types d'incidents, gere par l'administrateur.
    L'operateur choisit parmi cette liste lors de la declaration.
    """
    nom         = models.CharField(max_length=100, unique=True, verbose_name='Nom')
    description = models.TextField(blank=True, verbose_name='Description')
    icone       = models.CharField(max_length=10, blank=True, default='⚡', verbose_name='Icone (emoji)')
    actif       = models.BooleanField(default=True, verbose_name='Actif', db_index=True)
    ordre       = models.PositiveSmallIntegerField(default=0, verbose_name="Ordre d'affichage")

    class Meta:
        verbose_name        = "Type d'incident"
        verbose_name_plural = "Types d'incident"
        ordering            = ['ordre', 'nom']
        db_table            = 'sims_network_typeincident'

    def __str__(self):
        return self.nom


# ─────────────────────────────────────────────────────────────────────────────
#  EQUIPE
# ─────────────────────────────────────────────────────────────────────────────

class Equipe(models.Model):
    """
    Equipe d'intervention, geree par l'administrateur.
    Associee aux interventions lors de la planification.
    """
    nom         = models.CharField(max_length=100, verbose_name="Nom de l'equipe")
    specialite  = models.CharField(max_length=150, blank=True, verbose_name='Specialite')
    responsable = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='equipes_responsable',
        verbose_name='Responsable',
    )
    contact     = models.CharField(max_length=100, blank=True, verbose_name='Contact / Telephone')
    actif       = models.BooleanField(default=True, verbose_name='Active', db_index=True)

    class Meta:
        verbose_name        = 'Equipe'
        verbose_name_plural = 'Equipes'
        ordering            = ['nom']
        db_table            = 'sims_network_equipe'

    def __str__(self):
        return self.nom


# ─────────────────────────────────────────────────────────────────────────────
#  INCIDENT
# ─────────────────────────────────────────────────────────────────────────────

class Incident(models.Model):
    """
    Un incident sur le reseau.
    La geolocalisation est stockee en lat/lng.

    Le champ `organisation` est la SOURCE DE VERITE pour le multi-tenant.
    Il est renseigne automatiquement a la creation depuis :
      1. perform_create() du ViewSet (request.user.profile.organisation)
      2. save() fallback : signale_par.profile.organisation si organisation est None
    """

    organisation = models.ForeignKey(
        'sims_core.Organisation',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='incidents',
        verbose_name='Organisation',
        db_index=True,
        help_text="Renseigne automatiquement depuis le profil du declarant.",
    )

    ouvrage = models.ForeignKey(
        'Ouvrage',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='incidents',
        verbose_name='Ouvrage concerne',
    )

    titre         = models.CharField(max_length=200, verbose_name='Titre')
    description   = models.TextField(blank=True, verbose_name='Description')
    type_incident = models.ForeignKey(
        TypeIncident,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='incidents',
        verbose_name="Type d'incident",
    )

    statut    = models.CharField(
        max_length=20,
        choices=IncidentStatut.choices,
        default=IncidentStatut.OUVERT,
        verbose_name='Statut',
        db_index=True,
    )
    priorite  = models.CharField(
        max_length=20,
        choices=IncidentPriorite.choices,
        default=IncidentPriorite.MOYENNE,
        verbose_name='Priorite',
        db_index=True,
    )

    latitude   = models.FloatField(verbose_name='Latitude',  null=True, blank=True)
    longitude  = models.FloatField(verbose_name='Longitude', null=True, blank=True)

    couche_id       = models.CharField(max_length=100, blank=True, verbose_name='ID couche SIG')
    couche_nom      = models.CharField(max_length=100, blank=True, verbose_name='Nom couche SIG')
    feature_id      = models.CharField(max_length=100, blank=True, verbose_name='Feature ID SIG')

    localisation    = models.CharField(max_length=300, blank=True, verbose_name='Localisation (texte)')
    quartier        = models.CharField(max_length=150, blank=True, verbose_name='Quartier / Zone')
    ville           = models.CharField(max_length=100, blank=True, verbose_name='Ville')

    signale_par     = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='incidents_signales',
        verbose_name='Signale par',
    )
    assigne_a       = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='incidents_assignes',
        verbose_name='Assigne a',
    )

    date_signalement  = models.DateTimeField(default=timezone.now,  verbose_name='Date de signalement')
    date_prise_charge = models.DateTimeField(null=True, blank=True,  verbose_name='Date prise en charge')
    date_resolution   = models.DateTimeField(null=True, blank=True,  verbose_name='Date de resolution')

    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = 'Incident'
        verbose_name_plural = 'Incidents'
        ordering            = ['-date_signalement']
        db_table            = 'sims_network_incident'
        indexes = [
            models.Index(fields=['statut', 'priorite']),
            models.Index(fields=['date_signalement']),
            models.Index(fields=['couche_id', 'feature_id']),
        ]

    def __str__(self):
        return f'[{self.get_priorite_display()}] {self.titre} — {self.get_statut_display()}'

    @property
    def coords(self):
        if self.latitude is not None and self.longitude is not None:
            return (self.latitude, self.longitude)
        return None

    @property
    def nb_interventions(self):
        return self.interventions.count()

    def save(self, *args, **kwargs):
        # Auto-fill organisation depuis le signalant si elle n'est pas encore renseignee.
        # Uniquement a la creation (pk is None) pour eviter des ecrasements intempestifs.
        if self.organisation_id is None and self.pk is None and self.signale_par_id:
            try:
                profile = self.signale_par.profile
                if profile and profile.organisation_id:
                    self.organisation_id = profile.organisation_id
            except Exception:
                pass
        super().save(*args, **kwargs)

    def marquer_en_cours(self, utilisateur=None):
        self.statut = IncidentStatut.EN_COURS
        if not self.date_prise_charge:
            self.date_prise_charge = timezone.now()
        if utilisateur and not self.assigne_a:
            self.assigne_a = utilisateur
        self.save(update_fields=['statut', 'date_prise_charge', 'assigne_a', 'updated_at'])

    def marquer_resolu(self):
        self.statut = IncidentStatut.RESOLU
        if not self.date_resolution:
            self.date_resolution = timezone.now()
        self.save(update_fields=['statut', 'date_resolution', 'updated_at'])


# ─────────────────────────────────────────────────────────────────────────────
#  PHOTO D'INCIDENT
# ─────────────────────────────────────────────────────────────────────────────

class IncidentPhoto(models.Model):
    incident    = models.ForeignKey(Incident, on_delete=models.CASCADE, related_name='photos')
    image       = models.ImageField(upload_to='incidents/photos/%Y/%m/')
    legende     = models.CharField(max_length=200, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        verbose_name        = "Photo d'incident"
        verbose_name_plural = "Photos d'incident"
        ordering            = ['uploaded_at']
        db_table            = 'sims_network_incidentphoto'

    def __str__(self):
        return f'Photo #{self.pk} – {self.incident}'


# ─────────────────────────────────────────────────────────────────────────────
#  INTERVENTION
# ─────────────────────────────────────────────────────────────────────────────

class Intervention(models.Model):
    """
    Une intervention (ordre de travail) liee a un incident.
    Un incident peut avoir plusieurs interventions successives.
    """

    incident = models.ForeignKey(
        Incident,
        on_delete=models.CASCADE,
        related_name='interventions',
        verbose_name='Incident',
    )

    type_travaux = models.CharField(
        max_length=30,
        choices=TypeTravaux.choices,
        default=TypeTravaux.REPARATION,
        verbose_name='Type de travaux',
    )
    statut = models.CharField(
        max_length=20,
        choices=InterventionStatut.choices,
        default=InterventionStatut.PLANIFIEE,
        verbose_name='Statut',
        db_index=True,
    )

    description   = models.TextField(blank=True, verbose_name='Description des travaux')
    rapport       = models.TextField(blank=True, verbose_name='Rapport de cloture')
    observations  = models.TextField(blank=True, verbose_name='Observations')

    responsable   = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='interventions_responsable',
        verbose_name='Responsable',
    )
    equipe = models.ForeignKey(
        Equipe,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='interventions',
        verbose_name='Equipe',
    )

    date_planifiee  = models.DateTimeField(null=True, blank=True, verbose_name='Date planifiee')
    date_debut      = models.DateTimeField(null=True, blank=True, verbose_name='Date de debut effectif')
    date_fin        = models.DateTimeField(null=True, blank=True, verbose_name='Date de fin effective')
    duree_estimee   = models.PositiveIntegerField(
        null=True, blank=True,
        verbose_name='Duree estimee (minutes)',
    )

    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)
    created_by  = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='interventions_creees',
        verbose_name='Cree par',
    )

    class Meta:
        verbose_name        = 'Intervention'
        verbose_name_plural = 'Interventions'
        ordering            = ['-created_at']
        db_table            = 'sims_network_intervention'
        indexes = [
            models.Index(fields=['statut']),
            models.Index(fields=['date_planifiee']),
        ]

    def __str__(self):
        return (
            f'Intervention #{self.pk} — {self.get_type_travaux_display()} '
            f'({self.get_statut_display()}) sur {self.incident}'
        )

    @property
    def duree_reelle_minutes(self):
        if self.date_debut and self.date_fin:
            delta = self.date_fin - self.date_debut
            return int(delta.total_seconds() / 60)
        return None

    def demarrer(self, utilisateur=None):
        self.statut     = InterventionStatut.EN_COURS
        self.date_debut = timezone.now()
        if utilisateur and not self.responsable:
            self.responsable = utilisateur
        self.save(update_fields=['statut', 'date_debut', 'responsable', 'updated_at'])
        self.incident.marquer_en_cours(utilisateur)

    def cloturer(self, rapport=''):
        self.statut   = InterventionStatut.TERMINEE
        self.date_fin = timezone.now()
        if rapport:
            self.rapport = rapport
        self.save(update_fields=['statut', 'date_fin', 'rapport', 'updated_at'])
        if not self.incident.interventions.exclude(
            statut__in=[InterventionStatut.TERMINEE, InterventionStatut.ANNULEE]
        ).exists():
            self.incident.marquer_resolu()


# ─────────────────────────────────────────────────────────────────────────────
#  PHOTO D'INTERVENTION
# ─────────────────────────────────────────────────────────────────────────────

class InterventionPhoto(models.Model):
    intervention = models.ForeignKey(Intervention, on_delete=models.CASCADE, related_name='photos')
    image        = models.ImageField(upload_to='interventions/photos/%Y/%m/')
    legende      = models.CharField(max_length=200, blank=True)
    uploaded_at  = models.DateTimeField(auto_now_add=True)
    uploaded_by  = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name='intervention_photos')

    class Meta:
        verbose_name        = "Photo d'intervention"
        verbose_name_plural = "Photos d'intervention"
        ordering            = ['uploaded_at']
        db_table            = 'sims_network_interventionphoto'

    def __str__(self):
        return f"Photo #{self.pk} – {self.intervention}"
