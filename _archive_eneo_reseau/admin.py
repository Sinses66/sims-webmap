"""
eneo_reseau.admin
=================
Interface d'administration Django pour les incidents et interventions.
"""

from django.contrib import admin
from django.utils.html import format_html

from .models import Incident, Intervention, IncidentPhoto, InterventionPhoto, TypeIncident, Equipe, TypeOuvrage, Ouvrage
from sims_core.admin import _is_scoped, _get_admin_org


# ─────────────────────────────────────────────────────────────────────────────
#  MIXIN : visibilité conditionnelle selon les modules de l'org
# ─────────────────────────────────────────────────────────────────────────────

class ModuleGatedMixin:
    """
    Rend un ModelAdmin visible dans le menu de l'org-admin uniquement si
    le module correspondant (`org_module_flag`) est activé pour son organisation.
    Pour les superusers : toujours visible.
    """
    org_module_flag = None  # ex: 'module_incidents'

    def _org_has_module(self, request):
        if request.user.is_superuser:
            return True
        if not _is_scoped(request.user):
            return True
        org = _get_admin_org(request.user)
        if org is None:
            return False
        return getattr(org, self.org_module_flag, False)

    def has_module_perms(self, request):
        return self._org_has_module(request)

    def has_view_permission(self, request, obj=None):
        return self._org_has_module(request)

    def has_change_permission(self, request, obj=None):
        return self._org_has_module(request)

    def has_add_permission(self, request):
        return self._org_has_module(request)

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser  # suppression réservée au superuser


# ─────────────────────────────────────────────────────────────────────────────
#  INLINES
# ─────────────────────────────────────────────────────────────────────────────

class InterventionInline(admin.TabularInline):
    model          = Intervention
    extra          = 0
    fields         = ['type_travaux', 'statut', 'responsable', 'date_planifiee', 'date_fin']
    readonly_fields = ['date_fin']
    show_change_link = True


class IncidentPhotoInline(admin.TabularInline):
    model   = IncidentPhoto
    extra   = 0
    fields  = ['image', 'legende', 'uploaded_by', 'uploaded_at']
    readonly_fields = ['uploaded_by', 'uploaded_at']


# ─────────────────────────────────────────────────────────────────────────────
#  INCIDENT ADMIN
# ─────────────────────────────────────────────────────────────────────────────

@admin.register(Incident)
class IncidentAdmin(ModuleGatedMixin, admin.ModelAdmin):
    org_module_flag = 'module_incidents'
    list_display = [
        'id', 'titre', 'colored_priorite', 'colored_statut',
        'type_incident', 'ouvrage', 'ville', 'quartier',
        'signale_par', 'assigne_a',
        'date_signalement', 'nb_interventions_display',
    ]
    list_filter  = ['statut', 'priorite', 'type_incident', 'ouvrage__type_ouvrage', 'ville']
    search_fields = ['titre', 'description', 'localisation', 'quartier', 'ville']
    readonly_fields = ['created_at', 'updated_at', 'date_resolution']
    ordering     = ['-date_signalement']
    date_hierarchy = 'date_signalement'

    fieldsets = (
        ('Identification', {
            'fields': ('titre', 'description', 'type_incident'),
        }),
        ('Statut & Priorité', {
            'fields': ('statut', 'priorite'),
        }),
        ('Géolocalisation', {
            'fields': ('latitude', 'longitude', 'localisation', 'quartier', 'ville'),
        }),
        ('Ouvrage', {
            'fields': ('ouvrage',),
        }),
        ('Lien SIG', {
            'fields': ('couche_id', 'couche_nom', 'feature_id'),
            'classes': ('collapse',),
        }),
        ('Acteurs', {
            'fields': ('signale_par', 'assigne_a'),
        }),
        ('Dates', {
            'fields': ('date_signalement', 'date_prise_charge', 'date_resolution',
                       'created_at', 'updated_at'),
        }),
    )

    inlines = [InterventionInline, IncidentPhotoInline]

    # ── Colonnes colorées ────────────────────────────────────────
    @admin.display(description='Statut')
    def colored_statut(self, obj):
        colors = {
            'ouvert':   '#ef4444',
            'en_cours': '#f59e0b',
            'resolu':   '#10b981',
            'ferme':    '#6b7280',
            'annule':   '#6b7280',
        }
        color = colors.get(obj.statut, '#6b7280')
        return format_html(
            '<span style="color:{}; font-weight:600">{}</span>',
            color, obj.get_statut_display()
        )

    @admin.display(description='Priorité')
    def colored_priorite(self, obj):
        colors = {
            'critique': '#dc2626',
            'haute':    '#ea580c',
            'moyenne':  '#d97706',
            'basse':    '#16a34a',
        }
        color = colors.get(obj.priorite, '#6b7280')
        return format_html(
            '<span style="color:{}; font-weight:600">{}</span>',
            color, obj.get_priorite_display()
        )

    @admin.display(description='Interventions')
    def nb_interventions_display(self, obj):
        return obj.interventions.count()


# ─────────────────────────────────────────────────────────────────────────────
#  INTERVENTION ADMIN
# ─────────────────────────────────────────────────────────────────────────────

class InterventionPhotoInline(admin.TabularInline):
    model           = InterventionPhoto
    extra           = 0
    fields          = ['image', 'legende', 'uploaded_by', 'uploaded_at']
    readonly_fields = ['uploaded_by', 'uploaded_at']


@admin.register(Intervention)
class InterventionAdmin(ModuleGatedMixin, admin.ModelAdmin):
    org_module_flag = 'module_interventions'
    list_display  = [
        'id', 'incident', 'type_travaux', 'statut',
        'responsable', 'date_planifiee', 'date_debut', 'date_fin',
    ]
    list_filter   = ['statut', 'type_travaux']
    search_fields = ['incident__titre', 'description', 'rapport', 'equipe']
    readonly_fields = ['created_at', 'updated_at']
    ordering      = ['-created_at']
    inlines       = [InterventionPhotoInline]

    fieldsets = (
        ('Incident lié', {
            'fields': ('incident',),
        }),
        ('Travaux', {
            'fields': ('type_travaux', 'statut', 'description', 'rapport', 'observations'),
        }),
        ('Équipe', {
            'fields': ('responsable', 'equipe'),
        }),
        ('Planification', {
            'fields': ('date_planifiee', 'date_debut', 'date_fin', 'duree_estimee'),
        }),
        ('Métadonnées', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )


# ─────────────────────────────────────────────────────────────────────────────
#  PHOTO ADMIN
# ─────────────────────────────────────────────────────────────────────────────

@admin.register(IncidentPhoto)
class IncidentPhotoAdmin(ModuleGatedMixin, admin.ModelAdmin):
    org_module_flag = 'module_incidents'
    list_display    = ['id', 'incident', 'legende', 'uploaded_by', 'uploaded_at']
    list_filter     = ['uploaded_at']
    readonly_fields = ['uploaded_at']


@admin.register(InterventionPhoto)
class InterventionPhotoAdmin(ModuleGatedMixin, admin.ModelAdmin):
    org_module_flag = 'module_interventions'
    list_display    = ['id', 'intervention', 'legende', 'uploaded_by', 'uploaded_at']
    list_filter     = ['uploaded_at']
    readonly_fields = ['uploaded_at']


# ─────────────────────────────────────────────────────────────────────────────
#  TYPE D'INCIDENT ADMIN
# ─────────────────────────────────────────────────────────────────────────────

@admin.register(TypeIncident)
class TypeIncidentAdmin(ModuleGatedMixin, admin.ModelAdmin):
    org_module_flag = 'module_incidents'
    list_display  = ['id', 'icone', 'nom', 'actif', 'ordre', 'nb_incidents']
    list_editable = ['actif', 'ordre']
    list_filter   = ['actif']
    search_fields = ['nom', 'description']
    ordering      = ['ordre', 'nom']

    @admin.display(description='Nb incidents')
    def nb_incidents(self, obj):
        return obj.incidents.count()


# ─────────────────────────────────────────────────────────────────────────────
#  ÉQUIPE ADMIN
# ─────────────────────────────────────────────────────────────────────────────

@admin.register(Equipe)
class EquipeAdmin(ModuleGatedMixin, admin.ModelAdmin):
    org_module_flag = 'module_interventions'
    list_display  = ['id', 'nom', 'specialite', 'responsable', 'contact', 'actif', 'nb_interventions']
    list_editable = ['actif']
    list_filter   = ['actif']
    search_fields = ['nom', 'specialite', 'contact']
    ordering      = ['nom']

    @admin.display(description='Nb interventions')
    def nb_interventions(self, obj):
        return obj.interventions.count()


# ─────────────────────────────────────────────────────────────────────────────
#  TYPE D'OUVRAGE ADMIN
# ─────────────────────────────────────────────────────────────────────────────

@admin.register(TypeOuvrage)
class TypeOuvrageAdmin(admin.ModelAdmin):
    list_display  = [
        'id', 'icone', 'nom',
        'application_layer_link', 'layer_key', 'couche_geoserver',
        'champ_cle', 'champ_nom', 'actif', 'ordre',
    ]
    list_editable = ['actif', 'ordre']
    list_filter   = ['actif', 'application_layer__application']
    search_fields = ['nom', 'layer_key', 'couche_geoserver']
    ordering      = ['ordre', 'nom']
    readonly_fields = ['couche_geoserver_display', 'layer_key_display']

    fieldsets = (
        ('Identification', {
            'fields': ('nom', 'icone', 'actif', 'ordre'),
        }),
        ('Couche cartographique — source de vérité', {
            'description': (
                '⚠ Sélectionnez la couche ApplicationLayer correspondante. '
                'couche_geoserver et layer_key seront synchronisés automatiquement au moment '
                "de l'enregistrement. Ne remplissez pas ces champs manuellement si la FK est définie."
            ),
            'fields': ('application_layer', 'couche_geoserver_display', 'layer_key_display'),
        }),
        ('Champs manuels (héritage — à éviter)', {
            'description': (
                'Ces champs ne sont utiles que si aucune ApplicationLayer ne correspond encore. '
                'Ils sont écrasés automatiquement dès que application_layer est définie.'
            ),
            'classes': ('collapse',),
            'fields': ('couche_geoserver', 'layer_key'),
        }),
        ('Attributs WFS', {
            'fields': ('champ_cle', 'champ_nom'),
        }),
    )

    @admin.display(description='Couche liée')
    def application_layer_link(self, obj):
        if obj.application_layer:
            url = f'/admin/sims_core/applicationlayer/{obj.application_layer.pk}/change/'
            return format_html(
                '<a href="{}" style="color:#00AADD;font-weight:600;">{}</a>',
                url, obj.application_layer
            )
        return format_html('<span style="color:#f59e0b;">⚠ Non liée</span>')

    @admin.display(description='couche_geoserver (sync)')
    def couche_geoserver_display(self, obj):
        if obj.application_layer:
            val = obj.application_layer.geoserver_layer or '—'
            return format_html(
                '<code style="color:#10b981;background:rgba(16,185,129,.1);'
                'padding:2px 6px;border-radius:4px;">{}</code>'
                ' <small style="color:#6b7f96;">(depuis la couche liée)</small>', val
            )
        return format_html(
            '<span style="color:#6b7f96;font-style:italic;">'
            'Sélectionnez une application_layer pour auto-remplir</span>'
        )

    @admin.display(description='layer_key (sync)')
    def layer_key_display(self, obj):
        if obj.application_layer:
            val = obj.application_layer.layer_key or '—'
            return format_html(
                '<code style="color:#10b981;background:rgba(16,185,129,.1);'
                'padding:2px 6px;border-radius:4px;">{}</code>'
                ' <small style="color:#6b7f96;">(depuis la couche liée)</small>', val
            )
        return format_html(
            '<span style="color:#6b7f96;font-style:italic;">'
            'Sélectionnez une application_layer pour auto-remplir</span>'
        )


# ─────────────────────────────────────────────────────────────────────────────
#  OUVRAGE ADMIN
# ─────────────────────────────────────────────────────────────────────────────

class IncidentOuvrageInline(admin.TabularInline):
    """Incidents liés à cet ouvrage (lecture seule)."""
    model            = Incident
    fk_name          = 'ouvrage'
    extra            = 0
    fields           = ['titre', 'statut', 'priorite', 'date_signalement']
    readonly_fields  = ['titre', 'statut', 'priorite', 'date_signalement']
    show_change_link = True
    can_delete       = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Ouvrage)
class OuvrageAdmin(ModuleGatedMixin, admin.ModelAdmin):
    org_module_flag = 'module_incidents'
    list_display  = ['id', 'code', 'nom', 'type_ouvrage', 'latitude', 'longitude',
                     'actif', 'nb_incidents_display', 'created_at']
    list_editable = ['actif']
    list_filter   = ['actif', 'type_ouvrage']
    search_fields = ['code', 'nom']
    ordering      = ['code']
    readonly_fields = ['created_at', 'updated_at']

    fieldsets = (
        ('Identification', {
            'fields': ('code', 'nom', 'type_ouvrage', 'actif'),
        }),
        ('Géolocalisation', {
            'fields': ('latitude', 'longitude'),
        }),
        ('Métadonnées', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    inlines = [IncidentOuvrageInline]

    @admin.display(description='Nb incidents')
    def nb_incidents_display(self, obj):
        return obj.incidents.count()
