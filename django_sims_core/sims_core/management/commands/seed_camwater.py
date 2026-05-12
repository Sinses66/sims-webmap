"""
Management command : seed_camwater
===================================
Crée l'organisation CAMWATER et son application GIS de test
dans la base SIMS Core, pour valider l'architecture multi-app.

Utilisation (dans Docker) :
  docker compose exec backend python manage.py seed_camwater

Options :
  --reset   Supprime l'app CAMWATER existante avant de la recréer
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from sims_core.models import Organisation, Application, ApplicationLayer


CAMWATER_LAYERS = [
    # ── Adduction d'eau ────────────────────────────────────────
    {
        'name':            'Réseau Adduction (conduites principales)',
        'geoserver_layer': 'camwater_ws:cmrReseauAdduction',
        'layer_type':      'WMS',
        'color':           '#0ea5e9',
        'line_width':      3.0,
        'group_label':     'Réseau Adduction',
        'group_icon':      '💧',
        'group_order':     1,
        'layer_order':     1,
        'visible_default': True,
        'description':     'Conduites principales d\'adduction d\'eau potable',
        'popup_fields':    ['id', 'diametre', 'materiau', 'annee_pose', 'etat'],
    },
    {
        'name':            'Réseau Distribution (secondaire)',
        'geoserver_layer': 'camwater_ws:cmrReseauDistribution',
        'layer_type':      'WMS',
        'color':           '#38bdf8',
        'line_width':      1.8,
        'group_label':     'Réseau Adduction',
        'group_icon':      '💧',
        'group_order':     1,
        'layer_order':     2,
        'visible_default': True,
        'description':     'Réseau secondaire de distribution d\'eau',
        'popup_fields':    ['id', 'diametre', 'materiau', 'etat'],
    },
    # ── Infrastructures ────────────────────────────────────────
    {
        'name':            'Châteaux d\'eau',
        'geoserver_layer': 'camwater_ws:cmrChateauxEau',
        'layer_type':      'WFS',
        'color':           '#0284c7',
        'point_radius':    8.0,
        'group_label':     'Infrastructures',
        'group_icon':      '🏗️',
        'group_order':     2,
        'layer_order':     1,
        'visible_default': True,
        'description':     'Réservoirs et châteaux d\'eau',
        'popup_fields':    ['id', 'nom', 'capacite_m3', 'altitude_m', 'etat', 'commune'],
    },
    {
        'name':            'Stations de pompage',
        'geoserver_layer': 'camwater_ws:cmrStationsPompage',
        'layer_type':      'WFS',
        'color':           '#0369a1',
        'point_radius':    7.0,
        'group_label':     'Infrastructures',
        'group_icon':      '🏗️',
        'group_order':     2,
        'layer_order':     2,
        'visible_default': True,
        'description':     'Stations de pompage et surpresseurs',
        'popup_fields':    ['id', 'nom', 'debit_m3h', 'puissance_kw', 'etat'],
    },
    {
        'name':            'Stations de traitement',
        'geoserver_layer': 'camwater_ws:cmrStationsTraitement',
        'layer_type':      'WFS',
        'color':           '#1d4ed8',
        'point_radius':    9.0,
        'group_label':     'Infrastructures',
        'group_icon':      '🏗️',
        'group_order':     2,
        'layer_order':     3,
        'visible_default': True,
        'description':     'Usines et stations de traitement de l\'eau',
        'popup_fields':    ['id', 'nom', 'capacite_m3j', 'type_traitement', 'etat'],
    },
    # ── Réseau commerciale ──────────────────────────────────────
    {
        'name':            'Branchements abonnés',
        'geoserver_layer': 'camwater_ws:cmrBranchements',
        'layer_type':      'WFS',
        'color':           '#7dd3fc',
        'point_radius':    4.0,
        'group_label':     'Réseau Commercial',
        'group_icon':      '🏠',
        'group_order':     3,
        'layer_order':     1,
        'visible_default': False,
        'description':     'Points de branchement des abonnés',
        'popup_fields':    ['id', 'ref_abonne', 'type_branchement', 'diametre', 'etat'],
    },
    {
        'name':            'Bornes-fontaines',
        'geoserver_layer': 'camwater_ws:cmrBornesFontaines',
        'layer_type':      'WFS',
        'color':           '#22d3ee',
        'point_radius':    6.0,
        'group_label':     'Réseau Commercial',
        'group_icon':      '🏠',
        'group_order':     3,
        'layer_order':     2,
        'visible_default': True,
        'description':     'Bornes-fontaines publiques',
        'popup_fields':    ['id', 'nom', 'commune', 'etat', 'debit_lh'],
    },
    # ── Découpage administratif ────────────────────────────────
    {
        'name':            'Zones de desserte',
        'geoserver_layer': 'camwater_ws:cmrZonesDesserte',
        'layer_type':      'WMS',
        'color':           '#93c5fd',
        'line_width':      1.5,
        'group_label':     'Découpage',
        'group_icon':      '🗺️',
        'group_order':     4,
        'layer_order':     1,
        'visible_default': True,
        'description':     'Périmètres des zones de desserte CAMWATER',
        'popup_fields':    ['id', 'nom_zone', 'population', 'taux_desserte'],
    },
]


class Command(BaseCommand):
    help = 'Crée l\'application CAMWATER GIS de test (multi-app seed)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Supprime l\'app CAMWATER existante avant de la recréer',
        )

    def handle(self, *args, **options):
        reset = options['reset']

        # ── 1. Organisation ──────────────────────────────────────
        org, org_created = Organisation.objects.get_or_create(
            slug='camwater',
            defaults={
                'name':        'CAMWATER',
                'description': 'Cameroon Water Utilities Corporation — réseau AEP national',
                'website':     'https://www.camwater.cm',
                'is_active':   True,
            }
        )
        if org_created:
            self.stdout.write(self.style.SUCCESS('✔ Organisation créée : {org}'))
        else:
            self.stdout.write('   Organisation existante : {org}')

        # ── 2. Application ───────────────────────────────────────
        if reset:
            deleted, _ = Application.objects.filter(slug='camwater').delete()
            if deleted:
                self.stdout.write(self.style.WARNING('⚠ App CAMWATER supprimée (reset)'))

        admin_user = User.objects.filter(is_superuser=True).first()

        app, app_created = Application.objects.get_or_create(
            slug='camwater',
            defaults={
                'organisation':        org,
                'name':                'CAMWATER GIS',
                'subtitle':            'réseau AEP',
                'description':         (
                    'Cartographie du réseau d\'alimentation en eau potable CAMWATER — '
                    'conduites, châteaux d\'eau, stations de pompage, branchements abonnés '
                    'et zones de desserte.'
                ),
                'config': {
                    'primary_color':   '#0ea5e9',
                    'secondary_color': '#0c1f35',
                    'accent_color':    '#38bdf8',
                },
                # Vue initiale — Yaoundé centre
                'center_lat':   3.866,
                'center_lon':   11.516,
                'zoom_default': 12,
                'zoom_min':     6,
                'zoom_max':     20,
                # Modules — analytics désactivé pour l'instant
                'module_incidents':     True,
                'module_interventions': True,
                'module_analytics':     False,   # ← pour tester le masquage côté React
                'module_export':        True,
                'module_editor':        False,
                'is_public':  False,
                'is_active':  True,
                'created_by': admin_user,
            }
        )

        if app_created:
            self.stdout.write(self.style.SUCCESS('✔ Application créée  : {app}'))
        else:
            self.stdout.write('   Application existante : {app}')
            if not reset:
                self.stdout.write('   (utilisez --reset pour recréer les couches)')
                return

        # ── 3. Couches cartographiques ───────────────────────────
        self.stdout.write('\n   Création des couches :')
        for layer_data in CAMWATER_LAYERS:
            layer, created = ApplicationLayer.objects.get_or_create(
                application=app,
                geoserver_layer=layer_data['geoserver_layer'],
                defaults={k: v for k, v in layer_data.items() if k != 'geoserver_layer'},
            )
            icon = '✔' if created else '·'
            style = self.style.SUCCESS if created else str
            self.stdout.write(style(f'   {icon} {layer.name}'))

        # ── Résumé ───────────────────────────────────────────────
        layers_count = app.layers.count()
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(
            f'✅  CAMWATER GIS prête — {layers_count} couche(s) — slug: camwater'
        ))
        self.stdout.write(
            '   → URL : http://localhost:5173/app/camwater'
        )
        self.stdout.write(
            '   → module_analytics = False  (teste le masquage React)'
        )
        self.stdout.write(
            '   → primary_color = #0ea5e9  (bleu eau vs cyan ENEO)'
        )
