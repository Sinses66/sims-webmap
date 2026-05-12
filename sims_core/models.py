"""
SIMS Platform Core Models
─────────────────────────
Architecture multi-tenant :
  Organisation  ──< Application ──< ApplicationLayer
  User ──── UserProfile ──── Organisation
  Application ──< Incident
  Application ──< Intervention
"""

from django.db import models
from django.contrib.auth.models import User
from django.utils.text import slugify


# ─────────────────────────────────────────────────────────────────
# Organisation
# ─────────────────────────────────────────────────────────────────
class Organisation(models.Model):
    """
    Entité cliente de la plateforme (ex : ENEO Cameroun, CAMWATER, CAMRAIL…)
    Chaque organisation possède ses propres applications et utilisateurs.
    """
    name        = models.CharField(max_length=200, verbose_name="Nom")
    slug        = models.SlugField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    logo        = models.ImageField(upload_to='orgs/logos/', blank=True, null=True)
    website     = models.URLField(blank=True)
    is_active   = models.BooleanField(default=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    # ── Modules autorisés pour cette organisation ─────────────────
    # Configurés par le superuser — l'org-admin ne peut activer dans
    # ses applications que les modules listés ici.
    module_incidents     = models.BooleanField(default=True,  verbose_name="Module Incidents")
    module_interventions = models.BooleanField(default=True,  verbose_name="Module Interventions")
    module_analytics     = models.BooleanField(default=False, verbose_name="Module Analytics")
    module_export        = models.BooleanField(default=False, verbose_name="Module Export")
    module_editor        = models.BooleanField(default=False, verbose_name="Module Éditeur cartographique")

    class Meta:
        verbose_name        = "Organisation"
        verbose_name_plural = "Organisations"
        ordering            = ['name']

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


# ─────────────────────────────────────────────────────────────────
# Application
# ─────────────────────────────────────────────────────────────────
class Application(models.Model):
    """
    Application cartographique configurable.
    Chaque application appartient à une organisation et peut être
    configurée sans code par un Key User via le back-office.
    """

    # Identité
    organisation = models.ForeignKey(
        Organisation, on_delete=models.CASCADE,
        related_name='applications', verbose_name="Organisation"
    )
    name         = models.CharField(max_length=200, verbose_name="Nom")
    slug         = models.SlugField(max_length=100, unique=True)
    subtitle     = models.CharField(max_length=200, blank=True, verbose_name="Sous-titre")
    description  = models.TextField(blank=True, verbose_name="Description")
    thumbnail    = models.ImageField(upload_to='apps/thumbnails/', blank=True, null=True)

    # Configuration visuelle (couleurs, layout, modules)
    config = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Configuration",
        help_text="Paramètres JSON : couleurs, modules actifs, layout, basemap…"
    )

    # Carte — vue initiale
    center_lat   = models.FloatField(default=3.848,  verbose_name="Latitude initiale")
    center_lon   = models.FloatField(default=11.502, verbose_name="Longitude initiale")
    zoom_default = models.IntegerField(default=7,    verbose_name="Zoom initial")
    zoom_min     = models.IntegerField(default=5,    verbose_name="Zoom minimum")
    zoom_max     = models.IntegerField(default=20,   verbose_name="Zoom maximum")

    # Modules activés
    module_incidents     = models.BooleanField(default=True,  verbose_name="Module Incidents")
    module_interventions = models.BooleanField(default=True,  verbose_name="Module Interventions")
    module_analytics     = models.BooleanField(default=True,  verbose_name="Module Analytics")
    module_export        = models.BooleanField(default=True,  verbose_name="Module Export")
    module_editor        = models.BooleanField(default=False, verbose_name="Module Éditeur géométrique")

    # Accès
    is_public  = models.BooleanField(default=False, verbose_name="Publique (sans login)")
    is_active  = models.BooleanField(default=True,  verbose_name="Active")

    # Méta
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_applications', verbose_name="Créé par"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = "Application"
        verbose_name_plural = "Applications"
        ordering            = ['organisation', 'name']

    @staticmethod
    def _module_fields():
        """
        Retourne tous les champs module_* définis sur Organisation.
        Auto-découvrant : ajouter un module = ajouter le champ BooleanField
        préfixé 'module_' + une migration. Aucune liste à maintenir ici.
        """
        return [
            f.name for f in Organisation._meta.get_fields()
            if f.name.startswith('module_') and hasattr(f, 'default')
        ]

    def clean(self):
        """
        Valide que l'application n'active pas un module non autorisé par l'organisation.
        Auto-découvrant : se base sur les champs module_* du modèle, sans liste hardcodée.
        """
        from django.core.exceptions import ValidationError
        if not self.organisation_id:
            return
        org = self.organisation
        violations = []
        for field in self._module_fields():
            if getattr(self, field, False) and not getattr(org, field, False):
                label = field.replace('module_', '').replace('_', ' ').capitalize()
                violations.append(label)
        if violations:
            raise ValidationError(
                f"Module(s) non autorisé(s) pour l'organisation « {org.name} » : "
                f"{', '.join(violations)}. L'admin Django doit d'abord les activer sur l'organisation."
            )

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(f"{self.organisation.slug}-{self.name}")
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.organisation.name} — {self.name}"

    @property
    def default_config(self):
        """Retourne la config complète avec valeurs par défaut."""
        return {
            'colors': {
                'primary':   '#0D1B2A',
                'secondary': '#F0F4F8',
                'accent':    '#00AADD',
                'danger':    '#FF4757',
                'navbar':    '#0D1B2A',
                'sidebar':   '#132337',
                'map_bg':    '#1A2E45',
                'text':      '#E2E8F0',
            },
            'theme':  'dark',
            'layout': 'navbar_sidebar_map',
            'language': 'fr',
            **self.config,
        }


# ─────────────────────────────────────────────────────────────────
# Couche cartographique
# ─────────────────────────────────────────────────────────────────
class ApplicationLayer(models.Model):
    """
    Couche cartographique d'une application.
    Chaque couche pointe vers GeoServer (WMS ou WFS) et définit
    son style d'affichage et son comportement.
    """

    LAYER_TYPE_CHOICES = [
        ('WMS', 'WMS — Carte tuilée (lignes, polygones)'),
        ('WFS', 'WFS — Vecteur interactif (points)'),
    ]

    application     = models.ForeignKey(
        Application, on_delete=models.CASCADE,
        related_name='layers', verbose_name="Application"
    )

    # Identité
    name            = models.CharField(max_length=200, verbose_name="Nom affiché")
    geoserver_layer = models.CharField(max_length=200, verbose_name="Couche GeoServer (workspace:nom)")
    layer_type      = models.CharField(max_length=10, choices=LAYER_TYPE_CHOICES, default='WMS')

    # Visibilité & ordre
    visible_default = models.BooleanField(default=True, verbose_name="Visible par défaut")
    opacity_default = models.FloatField(default=1.0,    verbose_name="Opacité par défaut (0-1)")
    layer_order     = models.IntegerField(default=0,    verbose_name="Ordre d'affichage")
    group_name      = models.CharField(max_length=100, blank=True, verbose_name="Groupe")

    # Identifiant stable pour le frontend React
    layer_key       = models.SlugField(
        max_length=100, blank=True,
        verbose_name="Clé frontend (layer_key)",
        help_text="Identifiant stable utilisé par React (ex: cmr_reseau_htb). "
                  "Généré automatiquement si laissé vide."
    )

    # Description courte affichée dans le LayerManager
    description     = models.TextField(blank=True, verbose_name="Description")

    # Groupe cartographique (remplace/complète group_name)
    group_slug      = models.SlugField(
        max_length=100, blank=True,
        verbose_name="Slug du groupe",
        help_text="Identifiant du groupe (ex: htb_existant)"
    )
    group_label     = models.CharField(
        max_length=200, blank=True,
        verbose_name="Libellé du groupe",
        help_text="Affiché dans la sidebar (ex: Réseau HTB Existant)"
    )
    group_icon      = models.CharField(
        max_length=10, blank=True, default='🗺️',
        verbose_name="Icône du groupe (emoji)"
    )
    group_order     = models.IntegerField(
        default=0, verbose_name="Ordre du groupe",
        help_text="Les groupes sont triés par cet entier croissant"
    )

    # Style
    color           = models.CharField(max_length=20, default='#00AADD', verbose_name="Couleur HEX")
    line_width      = models.FloatField(default=2.0,  verbose_name="Épaisseur de ligne (px)")
    point_radius    = models.FloatField(default=6.0,  verbose_name="Rayon des points (px)")
    style_config    = models.JSONField(
        default=dict, blank=True,
        verbose_name="Style avancé (JSON)",
        help_text="SLD, filtres CQL, classification…"
    )

    # Champs affichés dans le popup au clic sur la carte
    popup_fields    = models.JSONField(
        default=list, blank=True,
        verbose_name="Champs popup",
        help_text=(
            "Liste ordonnée des attributs à afficher dans le popup. "
            "Format : [\"nom\", \"tension\", \"code\"] — "
            "Laisser vide = tous les attributs."
        )
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = "Couche cartographique"
        verbose_name_plural = "Couches cartographiques"
        ordering            = ['application', 'group_order', 'layer_order', 'name']
        unique_together     = [('application', 'geoserver_layer')]

    def clean(self):
        """
        Validation en deux niveaux :
          1. Format obligatoire « workspace:nom_couche » (toujours).
          2. Existence sur GeoServer via l'API REST (si GEOSERVER_URL est défini
             dans settings.py) — bloquant si la couche renvoie 404, non-bloquant
             si GeoServer est inaccessible (timeout, réseau, etc.).
        """
        from django.core.exceptions import ValidationError

        # ── 1. Validation du format ───────────────────────────────────────────
        gs = (self.geoserver_layer or '').strip()
        if gs:
            parts = gs.split(':')
            if len(parts) != 2 or not parts[0] or not parts[1]:
                raise ValidationError({
                    'geoserver_layer': (
                        "Format invalide — attendu : workspace:nom_couche "
                        "(ex: eneo_gis_ws:cmrReseauHTB). "
                        f"Valeur reçue : « {gs} »"
                    )
                })

        # ── 2. Vérification GeoServer (si GEOSERVER_URL configuré) ───────────
        from django.conf import settings
        geoserver_url = getattr(settings, 'GEOSERVER_URL', None)
        if geoserver_url and gs and ':' in gs:
            try:
                import requests as _requests
                workspace, lname = gs.split(':', 1)
                url  = f"{geoserver_url.rstrip('/')}/rest/layers/{workspace}:{lname}.json"
                user = getattr(settings, 'GEOSERVER_USER', 'admin')
                pwd  = getattr(settings, 'GEOSERVER_PASSWORD', 'geoserver')
                resp = _requests.get(url, auth=(user, pwd), timeout=4)
                if resp.status_code == 404:
                    raise ValidationError({
                        'geoserver_layer': (
                            f"Couche introuvable sur GeoServer : « {gs} ». "
                            "Vérifiez le workspace et le nom exact de la couche publiée."
                        )
                    })
                # 401/403 → credentials incorrectes côté GeoServer → on laisse passer
                # (pb de config, on ne bloque pas l'admin)
            except ValidationError:
                raise  # on propage uniquement les ValidationError
            except Exception:
                pass   # GeoServer inaccessible → non-bloquant

    def save(self, *args, **kwargs):
        # Auto-génère layer_key depuis geoserver_layer si vide
        # ex: "eneo_gis_ws:cmrReseauHTB" → "cmr_reseau_htb"
        if not self.layer_key and self.geoserver_layer:
            raw = self.geoserver_layer.split(':')[-1]  # partie après workspace:
            self.layer_key = slugify(raw).replace('-', '_')
        # Auto-génère group_slug depuis group_name/group_label si vide
        if not self.group_slug:
            src = self.group_label or self.group_name
            if src:
                self.group_slug = slugify(src).replace('-', '_')
        # Synchronise group_label ← group_name si group_label vide
        if not self.group_label and self.group_name:
            self.group_label = self.group_name
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.application.name} › {self.name} ({self.layer_type})"


# ─────────────────────────────────────────────────────────────────
# Profil utilisateur
# ─────────────────────────────────────────────────────────────────
class UserProfile(models.Model):
    """
    Extension du User Django.
    Gère le rôle sur la plateforme et le rattachement à une organisation.
    Compatible SSO / LDAP via ldap_dn.
    """

    ROLE_CHOICES = [
        ('admin',       'Administrateur — Accès complet'),
        ('superviseur', 'Superviseur — Suivi opérations'),
        ('operateur',   'Opérateur — Saisie terrain'),
        ('lecteur',     'Lecteur — Consultation seule'),
    ]

    user         = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    organisation = models.ForeignKey(
        Organisation, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='users', verbose_name="Organisation"
    )
    role         = models.CharField(max_length=20, choices=ROLE_CHOICES, default='lecteur')
    avatar       = models.ImageField(upload_to='users/avatars/', blank=True, null=True)
    phone        = models.CharField(max_length=30, blank=True)

    # SSO / LDAP
    ldap_dn      = models.CharField(max_length=500, blank=True, verbose_name="DN LDAP",
                                    help_text="Distinguished Name de l'entrée LDAP")

    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = "Profil utilisateur"
        verbose_name_plural = "Profils utilisateurs"
        ordering            = ['user__username']

    def __str__(self):
        return f"{self.user.username} ({self.get_role_display()})"

    @property
    def full_name(self):
        return f"{self.user.first_name} {self.user.last_name}".strip() or self.user.username

    @property
    def is_admin(self):
        return self.role == 'admin' or self.user.is_superuser

    @property
    def can_edit(self):
        return self.role in ('admin', 'superviseur', 'operateur')


# ─────────────────────────────────────────────────────────────────
# Annotation cartographique
# ─────────────────────────────────────────────────────────────────
class MapAnnotation(models.Model):
    """
    Dessin / annotation sauvegardé sur la carte d'une application.
    """

    GEOM_TYPE_CHOICES = [
        ('point',   'Point / Marqueur'),
        ('line',    'Ligne'),
        ('polygon', 'Polygone / Zone'),
        ('text',    'Texte'),
    ]

    application  = models.ForeignKey(Application, on_delete=models.CASCADE, related_name='annotations')
    created_by   = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    title        = models.CharField(max_length=200, blank=True)
    geom_type    = models.CharField(max_length=20, choices=GEOM_TYPE_CHOICES)
    geojson      = models.JSONField(verbose_name="GeoJSON de la géométrie")
    color        = models.CharField(max_length=20, default='#00AADD')
    is_shared    = models.BooleanField(default=False, verbose_name="Partagée avec l'équipe")

    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = "Annotation cartographique"
        verbose_name_plural = "Annotations cartographiques"
        ordering            = ['-created_at']

    def __str__(self):
        return f"{self.get_geom_type_display()} — {self.title or 'Sans titre'}"


# ─────────────────────────────────────────────────────────────────
# Dashboard analytique
# ─────────────────────────────────────────────────────────────────
class Dashboard(models.Model):
    """
    Tableau de bord analytique sauvegardé.
    Contient un ou plusieurs widgets, chacun associé à une couche WFS
    et un ou plusieurs attributs avec un type de graphique.
    """
    application  = models.ForeignKey(
        Application, on_delete=models.CASCADE,
        related_name='dashboards', verbose_name="Application"
    )
    created_by   = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True,
        related_name='dashboards', verbose_name="Créé par"
    )
    name         = models.CharField(max_length=200, verbose_name="Nom du tableau de bord")
    description  = models.TextField(blank=True)
    is_shared    = models.BooleanField(default=False, verbose_name="Partagé avec l'équipe")
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = "Tableau de bord"
        verbose_name_plural = "Tableaux de bord"
        ordering            = ['-updated_at']

    def __str__(self):
        return f"{self.application.name} — {self.name}"


class DashboardWidget(models.Model):
    """
    Widget individuel d'un tableau de bord.
    Chaque widget est lié à une couche WFS, un ou plusieurs attributs,
    et un type de graphique.
    """

    CHART_TYPE_CHOICES = [
        ('pie',            'Camembert'),
        ('donut',          'Donut'),
        ('bar',            'Barres verticales'),
        ('bar_horizontal', 'Barres horizontales'),
        ('histogram',      'Histogramme'),
        ('line',           'Courbe'),
        ('treemap',        'Treemap'),
        ('grouped_bar',    'Barres groupées'),
    ]

    COLOR_SCHEME_CHOICES = [
        ('default',  'Défaut (bleu ENEO)'),
        ('rainbow',  'Arc-en-ciel'),
        ('warm',     'Chaud (rouge-orange)'),
        ('cool',     'Froid (bleu-vert)'),
        ('monochrome', 'Monochrome'),
    ]

    dashboard        = models.ForeignKey(
        Dashboard, on_delete=models.CASCADE,
        related_name='widgets', verbose_name="Tableau de bord"
    )
    title            = models.CharField(max_length=200, verbose_name="Titre du widget")

    # Source de données WFS
    geoserver_layer  = models.CharField(
        max_length=200, verbose_name="Couche GeoServer",
        help_text="Ex: eneo_gis_ws:cmrPosteSource"
    )
    layer_name       = models.CharField(
        max_length=200, blank=True,
        verbose_name="Nom affiché de la couche"
    )

    # Attributs analysés (1 ou 2 selon le type de graphique)
    attributes       = models.JSONField(
        default=list, verbose_name="Attributs analysés",
        help_text="Liste des noms de champs, ex: [\"region\", \"type_poste\"]"
    )

    # Type de graphique
    chart_type       = models.CharField(
        max_length=20, choices=CHART_TYPE_CHOICES, default='bar',
        verbose_name="Type de graphique"
    )

    # Apparence
    color_scheme     = models.CharField(
        max_length=20, choices=COLOR_SCHEME_CHOICES, default='default',
        verbose_name="Palette de couleurs"
    )

    # Filtres CQL optionnels (ex: {"region": "LITTORAL"})
    filters          = models.JSONField(
        default=dict, blank=True, verbose_name="Filtres",
        help_text="Filtres attributaires optionnels (CQL)"
    )

    # Position dans la grille (ordre d'affichage)
    position         = models.IntegerField(default=0, verbose_name="Position dans la grille")

    # Config supplémentaire libre (max features, tri, etc.)
    config           = models.JSONField(
        default=dict, blank=True, verbose_name="Configuration avancée"
    )

    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = "Widget de tableau de bord"
        verbose_name_plural = "Widgets de tableau de bord"
        ordering            = ['dashboard', 'position']

    def clean(self):
        """Valide le format workspace:nom_couche (existence non vérifiée ici — voir ApplicationLayer)."""
        from django.core.exceptions import ValidationError
        gs = (self.geoserver_layer or '').strip()
        if gs:
            parts = gs.split(':')
            if len(parts) != 2 or not parts[0] or not parts[1]:
                raise ValidationError({
                    'geoserver_layer': (
                        "Format invalide — attendu : workspace:nom_couche "
                        "(ex: eneo_gis_ws:cmrPosteSource). "
                        f"Valeur reçue : « {gs} »"
                    )
                })

    def __str__(self):
        return f"{self.dashboard.name} › {self.title} ({self.get_chart_type_display()})"


# ─────────────────────────────────────────────────────────────────
# Bookmark / Vue sauvegardée
# ─────────────────────────────────────────────────────────────────
class MapBookmark(models.Model):
    """
    Vue cartographique sauvegardée par un utilisateur (zoom + centre + couches actives).
    """
    application   = models.ForeignKey(Application, on_delete=models.CASCADE, related_name='bookmarks')
    user          = models.ForeignKey(User, on_delete=models.CASCADE)

    name          = models.CharField(max_length=200)
    center_lat    = models.FloatField()
    center_lon    = models.FloatField()
    zoom          = models.IntegerField()
    active_layers = models.JSONField(default=list, verbose_name="IDs couches actives")

    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name        = "Bookmark carte"
        verbose_name_plural = "Bookmarks carte"
        ordering            = ['-created_at']

    def __str__(self):
        return f"{self.user.username} — {self.name}"
