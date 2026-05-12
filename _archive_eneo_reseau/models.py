"""
eneo_reseau.models
==================
Modèles métier pour la gestion des incidents et interventions sur le réseau
électrique ENEO.

Schéma simplifié :
    TypeOuvrage   ←──(FK)──  Ouvrage  ←──(FK)──  Incident  ←──(FK)──  Intervention
    TypeIncident  ←──(FK)──  Incident
    Equipe        ←──(FK)──  Intervention
    Incident      ←──(FK)──  IncidentPhoto
"""

from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


# ─────────────────────────────────────────────────────────────────────────────
#  CHOICES (statuts — restent fixes, métier ENEO)
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
#  TYPE D'OUVRAGE  (administrable depuis l'admin Django)
# ─────────────────────────────────────────────────────────────────────────────

class TypeOuvrage(models.Model):
    """
    Catalogue des types d'ouvrages du réseau électrique.
    Chaque type est lié à une couche cartographique (ApplicationLayer) via FK.

    La FK `application_layer` est la SOURCE DE VÉRITÉ : au save(), les champs
    `couche_geoserver` et `layer_key` sont automatiquement synchronisés depuis
    la couche liée. Cela garantit la cohérence entre le catalogue métier
    (eneo_reseau) et la configuration applicative (sims_core).

    Ex : TypeOuvrage "Transformateur MT"
         application_layer → ApplicationLayer(layer_key="transformateurs",
                                              geoserver_layer="ws:transformateurs")
         couche_geoserver  ← synchronisé automatiquement
         layer_key         ← synchronisé automatiquement
         champ_cle         = "code_transfo"   ← attribut WFS identifiant l'ouvrage
         champ_nom         = "nom_transfo"    ← attribut WFS pour le libellé
    """
    from sims_core.models import ApplicationLayer as _AL  # import local pour éviter les cycles

    nom              = models.CharField(max_length=100, verbose_name='Nom')

    # ── Source de vérité : couche cartographique liée ─────────────
    application_layer = models.ForeignKey(
        'sims_core.ApplicationLayer',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='type_ouvrages',
        verbose_name='Couche cartographique',
        help_text=(
            'Sélectionnez la couche ApplicationLayer correspondante. '
            'couche_geoserver et layer_key seront synchronisés automatiquement.'
        ),
    )

    # ── Champs synchronisés (ne pas éditer manuellement si FK définie) ──
    couche_geoserver = models.CharField(
        max_length=200, blank=True,
        verbose_name='Couche GeoServer',
        help_text='Synchronisé depuis application_layer.geoserver_layer (lecture seule si FK définie).'
    )
    layer_key        = models.CharField(
        max_length=100, blank=True,
        verbose_name='Clé de couche (layer_key)',
        help_text='Synchronisé depuis application_layer.layer_key (lecture seule si FK définie).'
    )

    # ── Attributs WFS spécifiques au type ─────────────────────────
    champ_cle        = models.CharField(
        max_length=100,
        verbose_name='Attribut-clé',
        help_text="Nom de l'attribut WFS servant de code unique (ex: code_transfo)"
    )
    champ_nom        = models.CharField(
        max_length=100, blank=True,
        verbose_name='Attribut nom',
        help_text="Nom de l'attribut WFS pour le libellé de l'ouvrage (ex: nom_transfo)"
    )
    icone            = models.CharField(max_length=10, blank=True, default='🔌', verbose_name='Icône')
    actif            = models.BooleanField(default=True, verbose_name='Actif', db_index=True)
    ordre            = models.PositiveSmallIntegerField(default=0, verbose_name='Ordre')

    class Meta:
        verbose_name        = "Type d'ouvrage"
        verbose_name_plural = "Types d'ouvrage"
        ordering            = ['ordre', 'nom']

    def save(self, *args, **kwargs):
        """Synchronise couche_geoserver et layer_key depuis la FK si elle est définie."""
        if self.application_layer_id:
            # Recharger depuis la DB pour avoir les valeurs à jour
            try:
                layer = self.__class__._meta.get_field('application_layer') \
                    .related_model.objects.get(pk=self.application_layer_id)
                self.couche_geoserver = layer.geoserver_layer or self.couche_geoserver
                self.layer_key        = layer.layer_key        or self.layer_key
            except Exception:
                pass  # FK invalide — on conserve les valeurs manuelles
        super().save(*args, **kwargs)

    def clean(self):
        """Avertit si layer_key diverge de la couche liée (incohérence détectée)."""
        from django.core.exceptions import ValidationError
        if self.application_layer_id and self.layer_key:
            try:
                layer = self.__class__._meta.get_field('application_layer') \
                    .related_model.objects.get(pk=self.application_layer_id)
                if layer.layer_key and layer.layer_key != self.layer_key:
                    raise ValidationError({
                        'layer_key': (
                            f'Incohérence détectée : layer_key "{self.layer_key}" '
                            f'≠ ApplicationLayer.layer_key "{layer.layer_key}". '
                            f'Videz le champ layer_key pour le synchroniser automatiquement.'
                        )
                    })
            except self.__class__._meta.get_field('application_layer').related_model.DoesNotExist:
                pass

    def __str__(self):
        return f'{self.icone} {self.nom}'


# ─────────────────────────────────────────────────────────────────────────────
#  OUVRAGE  (référentiel des ouvrages du réseau)
# ─────────────────────────────────────────────────────────────────────────────

class Ouvrage(models.Model):
    """
    Un ouvrage physique du réseau électrique.
    Créé automatiquement lors du premier incident sur cet ouvrage
    (depuis la sélection carte) ou manuellement depuis l'admin.
    """
    code         = models.CharField(
        max_length=100, unique=True,
        verbose_name='Code ouvrage',
        help_text='Identifiant unique de l\'ouvrage (lu depuis GeoServer)'
    )
    nom          = models.CharField(max_length=200, blank=True, verbose_name='Nom / Libellé')
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

    def __str__(self):
        label = self.nom or self.code
        type_label = self.type_ouvrage.nom if self.type_ouvrage else 'Ouvrage'
        return f'[{type_label}] {label}'


# ─────────────────────────────────────────────────────────────────────────────
#  TYPE D'INCIDENT  (administrable depuis l'admin Django)
# ─────────────────────────────────────────────────────────────────────────────

class TypeIncident(models.Model):
    """
    Catalogue des types d'incidents, géré par l'administrateur.
    L'opérateur choisit parmi cette liste lors de la déclaration.
    """
    nom         = models.CharField(max_length=100, unique=True, verbose_name='Nom')
    description = models.TextField(blank=True, verbose_name='Description')
    icone       = models.CharField(max_length=10, blank=True, default='⚡', verbose_name='Icône (emoji)')
    actif       = models.BooleanField(default=True, verbose_name='Actif', db_index=True)
    ordre       = models.PositiveSmallIntegerField(default=0, verbose_name='Ordre d\'affichage')

    class Meta:
        verbose_name        = "Type d'incident"
        verbose_name_plural = "Types d'incident"
        ordering            = ['ordre', 'nom']

    def __str__(self):
        return self.nom


# ─────────────────────────────────────────────────────────────────────────────
#  ÉQUIPE  (administrable depuis l'admin Django)
# ─────────────────────────────────────────────────────────────────────────────

class Equipe(models.Model):
    """
    Équipe d'intervention, gérée par l'administrateur.
    Associée aux interventions lors de la planification.
    """
    nom         = models.CharField(max_length=100, verbose_name="Nom de l'équipe")
    specialite  = models.CharField(max_length=150, blank=True, verbose_name='Spécialité')
    responsable = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='equipes_responsable',
        verbose_name='Responsable',
    )
    contact     = models.CharField(max_length=100, blank=True, verbose_name='Contact / Téléphone')
    actif       = models.BooleanField(default=True, verbose_name='Active', db_index=True)

    class Meta:
        verbose_name        = 'Équipe'
        verbose_name_plural = 'Équipes'
        ordering            = ['nom']

    def __str__(self):
        return self.nom


# ─────────────────────────────────────────────────────────────────────────────
#  INCIDENT
# ─────────────────────────────────────────────────────────────────────────────

class Incident(models.Model):
    """
    Un incident sur le réseau électrique.
    La géolocalisation est stockée en lat/lng (PostGIS non obligatoire ici,
    mais on garde la porte ouverte via couche_id pour le lien SIG).
    """

    # ── Ouvrage concerné ────────────────────────────────────────
    ouvrage = models.ForeignKey(
        'Ouvrage',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='incidents',
        verbose_name='Ouvrage concerné',
    )

    # ── Identification ──────────────────────────────────────────
    titre         = models.CharField(max_length=200, verbose_name='Titre')
    description   = models.TextField(blank=True, verbose_name='Description')
    type_incident = models.ForeignKey(
        TypeIncident,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='incidents',
        verbose_name="Type d'incident",
    )

    # ── Statut & priorité ───────────────────────────────────────
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
        verbose_name='Priorité',
        db_index=True,
    )

    # ── Géolocalisation ─────────────────────────────────────────
    latitude   = models.FloatField(verbose_name='Latitude',  null=True, blank=True)
    longitude  = models.FloatField(verbose_name='Longitude', null=True, blank=True)

    # Lien optionnel vers une entité SIG (ex : id d'un transformateur WFS)
    couche_id       = models.CharField(max_length=100, blank=True, verbose_name='ID couche SIG')
    couche_nom      = models.CharField(max_length=100, blank=True, verbose_name='Nom couche SIG')
    feature_id      = models.CharField(max_length=100, blank=True, verbose_name='Feature ID SIG')

    # ── Localisation texte ──────────────────────────────────────
    localisation    = models.CharField(max_length=300, blank=True, verbose_name='Localisation (texte)')
    quartier        = models.CharField(max_length=150, blank=True, verbose_name='Quartier / Zone')
    ville           = models.CharField(max_length=100, blank=True, verbose_name='Ville')

    # ── Acteurs ─────────────────────────────────────────────────
    signale_par     = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='incidents_signales',
        verbose_name='Signalé par',
    )
    assigne_a       = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='incidents_assignes',
        verbose_name='Assigné à',
    )

    # ── Dates ────────────────────────────────────────────────────
    date_signalement  = models.DateTimeField(default=timezone.now,  verbose_name='Date de signalement')
    date_prise_charge = models.DateTimeField(null=True, blank=True,  verbose_name='Date prise en charge')
    date_resolution   = models.DateTimeField(null=True, blank=True,  verbose_name='Date de résolution')

    # ── Métadonnées ──────────────────────────────────────────────
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = 'Incident'
        verbose_name_plural = 'Incidents'
        ordering            = ['-date_signalement']
        indexes = [
            models.Index(fields=['statut', 'priorite']),
            models.Index(fields=['date_signalement']),
            models.Index(fields=['couche_id', 'feature_id']),
        ]

    def __str__(self):
        return f'[{self.get_priorite_display()}] {self.titre} — {self.get_statut_display()}'

    # ── Helpers ──────────────────────────────────────────────────
    @property
    def coords(self):
        """Retourne (lat, lng) ou None."""
        if self.latitude is not None and self.longitude is not None:
            return (self.latitude, self.longitude)
        return None

    @property
    def nb_interventions(self):
        return self.interventions.count()

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
        verbose_name        = 'Photo d\'incident'
        verbose_name_plural = 'Photos d\'incident'
        ordering            = ['uploaded_at']

    def __str__(self):
        return f'Photo #{self.pk} – {self.incident}'


# ─────────────────────────────────────────────────────────────────────────────
#  INTERVENTION
# ─────────────────────────────────────────────────────────────────────────────

class Intervention(models.Model):
    """
    Une intervention (ordre de travail) liée à un incident.
    Un incident peut avoir plusieurs interventions successives.
    """

    # ── Liens ────────────────────────────────────────────────────
    incident = models.ForeignKey(
        Incident,
        on_delete=models.CASCADE,
        related_name='interventions',
        verbose_name='Incident',
    )

    # ── Classification ───────────────────────────────────────────
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

    # ── Description ──────────────────────────────────────────────
    description   = models.TextField(blank=True, verbose_name='Description des travaux')
    rapport       = models.TextField(blank=True, verbose_name='Rapport de clôture')
    observations  = models.TextField(blank=True, verbose_name='Observations')

    # ── Équipe ───────────────────────────────────────────────────
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
        verbose_name='Équipe',
    )

    # ── Planification ────────────────────────────────────────────
    date_planifiee  = models.DateTimeField(null=True, blank=True, verbose_name='Date planifiée')
    date_debut      = models.DateTimeField(null=True, blank=True, verbose_name='Date de début effectif')
    date_fin        = models.DateTimeField(null=True, blank=True, verbose_name='Date de fin effective')
    duree_estimee   = models.PositiveIntegerField(
        null=True, blank=True,
        verbose_name='Durée estimée (minutes)',
    )

    # ── Métadonnées ──────────────────────────────────────────────
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)
    created_by  = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='interventions_creees',
        verbose_name='Créé par',
    )

    class Meta:
        verbose_name        = 'Intervention'
        verbose_name_plural = 'Interventions'
        ordering            = ['-created_at']
        indexes = [
            models.Index(fields=['statut']),
            models.Index(fields=['date_planifiee']),
        ]

    def __str__(self):
        return (
            f'Intervention #{self.pk} — {self.get_type_travaux_display()} '
            f'({self.get_statut_display()}) sur {self.incident}'
        )

    # ── Helpers ──────────────────────────────────────────────────
    @property
    def duree_reelle_minutes(self):
        """Durée réelle en minutes (si début et fin renseignés)."""
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
        # Mettre l'incident en cours si pas déjà
        self.incident.marquer_en_cours(utilisateur)

    def cloturer(self, rapport=''):
        self.statut   = InterventionStatut.TERMINEE
        self.date_fin = timezone.now()
        if rapport:
            self.rapport = rapport
        self.save(update_fields=['statut', 'date_fin', 'rapport', 'updated_at'])
        # Si toutes les interventions sont terminées → résoudre l'incident
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

    def __str__(self):
        return f"Photo #{self.pk} – {self.intervention}"
