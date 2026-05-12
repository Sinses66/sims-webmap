"""
Script de population initiale — SIMS Platform
Crée l'organisation ENEO, l'Application ENEO GIS et toutes les couches GeoServer.

Usage :
    python manage.py shell < sims_core/fixtures_initial.py

Les couches sont calquées sur src/config/layers.js (React)
pour garantir la cohérence layer_key ↔ store Zustand.
"""

from django.contrib.auth.models import User
from sims_core.models import Organisation, Application, ApplicationLayer, UserProfile

print("── Population SIMS Platform ──────────────────────────")

# ─── 1. Organisation ENEO ──────────────────────────────────────
org, created = Organisation.objects.get_or_create(
    slug='eneo-cameroun',
    defaults={
        'name':        'ENEO Cameroun S.A.',
        'description': "Énergie Du Cameroun — Opérateur national de distribution d'électricité",
        'website':     'https://www.eneo.cm',
        'is_active':   True,
    }
)
print(f"{'Créée' if created else 'Existante'} : Organisation ENEO")

# ─── 2. Rattacher l'admin à ENEO ──────────────────────────────
try:
    admin_user = User.objects.get(is_superuser=True)
    profile, created_p = UserProfile.objects.get_or_create(
        user=admin_user,
        defaults={'organisation': org, 'role': 'admin'}
    )
    if not created_p:
        profile.organisation = org
        profile.role = 'admin'
        profile.save()
    print(f"Profil admin ({admin_user.username}) rattaché à ENEO")
except User.DoesNotExist:
    print("⚠ Aucun superuser trouvé — créez-en un avec: python manage.py createsuperuser")

# ─── 3. Application : ENEO GIS ────────────────────────────────
app, created = Application.objects.get_or_create(
    slug='eneo-gis',
    defaults={
        'organisation': org,
        'name':         'ENEO GIS',
        'subtitle':     'data overview',
        'description':  (
            "Cartographie générale de l'asset ENEO — réseau HTB, HTA, BT, "
            "postes sources, postes de distribution et découpage commercial."
        ),
        'center_lat':   3.848,
        'center_lon':   11.502,
        'zoom_default': 7,
        'zoom_min':     5,
        'zoom_max':     20,
        'module_incidents':     True,
        'module_interventions': True,
        'module_analytics':     True,
        'module_export':        True,
        'module_editor':        True,
        'is_public':    False,
        'is_active':    True,
        'config': {
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
            'theme':    'dark',
            'language': 'fr',
        }
    }
)
print(f"{'Créée' if created else 'Existante'} : Application ENEO GIS")

# ─── 4. Couches cartographiques ───────────────────────────────
# Calquées sur src/config/layers.js côté React.
# Chaque layer_key correspond à l'id utilisé dans le store Zustand.
#
# Structure :
#   group_slug  : identifiant du groupe (= id dans LAYER_GROUPS React)
#   group_label : libellé affiché dans la sidebar
#   group_icon  : emoji du groupe
#   group_order : ordre d'affichage du groupe (10, 20, 30…)
#   layer_key   : identifiant stable côté React (= id dans layers[])
#   layer_order : ordre au sein du groupe

WS = 'eneo_gis_ws'

LAYERS = [

    # ═══════════════════════════════════════════════════════════
    # Groupe 1 — Réseau HTB Existant
    # ═══════════════════════════════════════════════════════════
    {
        'layer_key':       'cmr_reseau_htb',
        'name':            'Réseau HTB (national)',
        'description':     'Réseau Haute Tension B à l\'échelle nationale',
        'geoserver_layer': f'{WS}:cmrReseauHTB',
        'layer_type':      'WMS',
        'visible_default': True,
        'opacity_default': 0.9,
        'color':           '#dc2626',
        'line_width':      3.0,
        'layer_order':     10,
        'group_slug':      'htb_existant',
        'group_label':     'Réseau HTB Existant',
        'group_icon':      '⚡',
        'group_order':     10,
    },
    {
        'layer_key':       'reseau_htb_existant',
        'name':            'HTB Existant (détail)',
        'description':     'Tracé détaillé des lignes HTB existantes',
        'geoserver_layer': f'{WS}:Reseau_HTB_Existant',
        'layer_type':      'WMS',
        'visible_default': False,
        'opacity_default': 0.9,
        'color':           '#b91c1c',
        'line_width':      2.5,
        'layer_order':     11,
        'group_slug':      'htb_existant',
        'group_label':     'Réseau HTB Existant',
        'group_icon':      '⚡',
        'group_order':     10,
    },
    {
        'layer_key':       'cmr_existant_reseau_htb',
        'name':            'HTB Existant (simplifié)',
        'description':     'Version simplifiée du réseau HTB existant',
        'geoserver_layer': f'{WS}:cmrExistantReseauHTB',
        'layer_type':      'WMS',
        'visible_default': False,
        'opacity_default': 0.8,
        'color':           '#ef4444',
        'line_width':      2.0,
        'layer_order':     12,
        'group_slug':      'htb_existant',
        'group_label':     'Réseau HTB Existant',
        'group_icon':      '⚡',
        'group_order':     10,
    },
    {
        'layer_key':       'ouvrages_htb_existant',
        'name':            'Ouvrages HTB Existants',
        'description':     'Postes et ouvrages HTB en service',
        'geoserver_layer': f'{WS}:Ouvrages_HTB_Existant',
        'layer_type':      'WFS',
        'visible_default': True,
        'opacity_default': 1.0,
        'color':           '#dc2626',
        'point_radius':    8.0,
        'layer_order':     13,
        'group_slug':      'htb_existant',
        'group_label':     'Réseau HTB Existant',
        'group_icon':      '⚡',
        'group_order':     10,
    },

    # ═══════════════════════════════════════════════════════════
    # Groupe 2 — Réseau HTB Projet
    # ═══════════════════════════════════════════════════════════
    {
        'layer_key':       'ligne_htb_projet',
        'name':            'Lignes HTB Projet',
        'description':     'Tracé des futures lignes HTB en projet',
        'geoserver_layer': f'{WS}:Ligne_HTB_Projet',
        'layer_type':      'WMS',
        'visible_default': False,
        'opacity_default': 0.85,
        'color':           '#f97316',
        'line_width':      2.0,
        'layer_order':     20,
        'group_slug':      'htb_projet',
        'group_label':     'Réseau HTB Projet',
        'group_icon':      '🔧',
        'group_order':     20,
    },
    {
        'layer_key':       'ouvrage_htb_projet',
        'name':            'Ouvrages HTB Projet',
        'description':     'Futurs postes et ouvrages HTB en cours de développement',
        'geoserver_layer': f'{WS}:Ouvrage_HTB_Projet',
        'layer_type':      'WFS',
        'visible_default': False,
        'opacity_default': 1.0,
        'color':           '#f97316',
        'point_radius':    8.0,
        'layer_order':     21,
        'group_slug':      'htb_projet',
        'group_label':     'Réseau HTB Projet',
        'group_icon':      '🔧',
        'group_order':     20,
    },

    # ═══════════════════════════════════════════════════════════
    # Groupe 3 — Réseau HTA / MT
    # ═══════════════════════════════════════════════════════════
    {
        'layer_key':       'cmr_reseau_hta',
        'name':            'Réseau HTA (national)',
        'description':     'Réseau Haute Tension A (Moyenne Tension) national',
        'geoserver_layer': f'{WS}:cmrReseauHTA',
        'layer_type':      'WMS',
        'visible_default': True,
        'opacity_default': 0.9,
        'color':           '#d97706',
        'line_width':      2.0,
        'layer_order':     30,
        'group_slug':      'hta',
        'group_label':     'Réseau HTA / MT',
        'group_icon':      '🔌',
        'group_order':     30,
    },
    {
        'layer_key':       'projet_reseau_hta',
        'name':            'Réseau HTA Projet',
        'description':     'Extensions HTA planifiées',
        'geoserver_layer': f'{WS}:Projet_Reseau_HTA',
        'layer_type':      'WMS',
        'visible_default': False,
        'opacity_default': 0.85,
        'color':           '#fbbf24',
        'line_width':      2.0,
        'layer_order':     31,
        'group_slug':      'hta',
        'group_label':     'Réseau HTA / MT',
        'group_icon':      '🔌',
        'group_order':     30,
    },
    {
        'layer_key':       'cmr_poste_source',
        'name':            'Postes Sources',
        'description':     'Postes sources de transformation HTB/HTA',
        'geoserver_layer': f'{WS}:cmrPosteSource',
        'layer_type':      'WFS',
        'visible_default': True,
        'opacity_default': 1.0,
        'color':           '#b45309',
        'point_radius':    8.0,
        'layer_order':     32,
        'group_slug':      'hta',
        'group_label':     'Réseau HTA / MT',
        'group_icon':      '🔌',
        'group_order':     30,
    },
    {
        'layer_key':       'projet_poste_hta',
        'name':            'Postes HTA Projet',
        'description':     'Futurs postes HTA en projet',
        'geoserver_layer': f'{WS}:Projet_Poste_HTA',
        'layer_type':      'WFS',
        'visible_default': False,
        'opacity_default': 1.0,
        'color':           '#fbbf24',
        'point_radius':    7.0,
        'layer_order':     33,
        'group_slug':      'hta',
        'group_label':     'Réseau HTA / MT',
        'group_icon':      '🔌',
        'group_order':     30,
    },

    # ═══════════════════════════════════════════════════════════
    # Groupe 4 — Réseau BT / Distribution
    # ═══════════════════════════════════════════════════════════
    {
        'layer_key':       'bt_drd_dry',
        'name':            'BT DRD/DRY',
        'description':     'Réseau Basse Tension des directions régionales',
        'geoserver_layer': f'{WS}:bt_drd_dry',
        'layer_type':      'WMS',
        'visible_default': False,
        'opacity_default': 0.8,
        'color':           '#16a34a',
        'line_width':      1.0,
        'layer_order':     40,
        'group_slug':      'bt',
        'group_label':     'Réseau BT / Distribution',
        'group_icon':      '💡',
        'group_order':     40,
    },
    {
        'layer_key':       'projet_reseau_bt',
        'name':            'Réseau BT Projet',
        'description':     'Extensions BT planifiées',
        'geoserver_layer': f'{WS}:Projet_Reseau_BT',
        'layer_type':      'WMS',
        'visible_default': False,
        'opacity_default': 0.8,
        'color':           '#22c55e',
        'line_width':      1.0,
        'layer_order':     41,
        'group_slug':      'bt',
        'group_label':     'Réseau BT / Distribution',
        'group_icon':      '💡',
        'group_order':     40,
    },
    {
        'layer_key':       'projets_reseau_bt',
        'name':            'Projets Réseau BT',
        'description':     'Ensemble des projets BT en cours',
        'geoserver_layer': f'{WS}:Projets_Reseau_BT',
        'layer_type':      'WMS',
        'visible_default': False,
        'opacity_default': 0.75,
        'color':           '#4ade80',
        'line_width':      1.0,
        'layer_order':     42,
        'group_slug':      'bt',
        'group_label':     'Réseau BT / Distribution',
        'group_icon':      '💡',
        'group_order':     40,
    },
    {
        'layer_key':       'cmr_poste_distribution',
        'name':            'Postes de Distribution',
        'description':     'Postes de transformation HTA/BT (cabines, TGBT…)',
        'geoserver_layer': f'{WS}:cmrPosteDistribution',
        'layer_type':      'WFS',
        'visible_default': True,
        'opacity_default': 1.0,
        'color':           '#15803d',
        'point_radius':    6.0,
        'layer_order':     43,
        'group_slug':      'bt',
        'group_label':     'Réseau BT / Distribution',
        'group_icon':      '💡',
        'group_order':     40,
    },

    # ═══════════════════════════════════════════════════════════
    # Groupe 5 — Découpage DRD / Zones
    # ═══════════════════════════════════════════════════════════
    {
        'layer_key':       'ilotsdrd',
        'name':            'Îlots DRD',
        'description':     'Découpage en îlots des directions régionales de distribution',
        'geoserver_layer': f'{WS}:ilotsdrd',
        'layer_type':      'WMS',
        'visible_default': False,
        'opacity_default': 0.35,
        'color':           '#6366f1',
        'line_width':      1.0,
        'layer_order':     50,
        'group_slug':      'admin',
        'group_label':     'Découpage DRD / Zones',
        'group_icon':      '🗺️',
        'group_order':     50,
    },
    {
        'layer_key':       'pl_drd_dry',
        'name':            'PL DRD/DRY',
        'description':     'Périmètres de livraison DRD et DRY',
        'geoserver_layer': f'{WS}:pl_drd_dry',
        'layer_type':      'WFS',
        'visible_default': False,
        'opacity_default': 0.8,
        'color':           '#818cf8',
        'point_radius':    5.0,
        'layer_order':     51,
        'group_slug':      'admin',
        'group_label':     'Découpage DRD / Zones',
        'group_icon':      '🗺️',
        'group_order':     50,
    },
]

# ─── 5. Insertion / mise à jour des couches ────────────────────
created_count  = 0
updated_count  = 0

for layer_data in LAYERS:
    gs_layer = layer_data['geoserver_layer']
    layer, created_l = ApplicationLayer.objects.get_or_create(
        application=app,
        geoserver_layer=gs_layer,
        defaults=layer_data
    )
    if not created_l:
        # Mise à jour des champs dynamiques si la couche existe déjà
        for field, value in layer_data.items():
            setattr(layer, field, value)
        layer.save()
        updated_count += 1
    else:
        created_count += 1

print(f"Couches : {created_count} créée(s), {updated_count} mise(s) à jour / {len(LAYERS)} total")
print(f"Groupes : {len(set(l['group_slug'] for l in LAYERS))} groupe(s) distincts")
print("── Population terminée ✓ ─────────────────────────────")
