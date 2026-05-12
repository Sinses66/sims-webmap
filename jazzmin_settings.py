"""
jazzmin_settings.py — Configuration du thème d'administration SIMS/ENEO
========================================================================
À importer dans settings.py :

    from pathlib import Path
    BASE_DIR = Path(__file__).resolve().parent.parent
    exec(open(BASE_DIR / 'jazzmin_settings.py').read())

Ou directement copier/coller les dictionnaires JAZZMIN_SETTINGS et
JAZZMIN_UI_TWEAKS dans settings.py.

Documentation complète : https://django-jazzmin.readthedocs.io/
"""

# ═══════════════════════════════════════════════════════════════════
#  JAZZMIN_SETTINGS — Apparence et navigation
# ═══════════════════════════════════════════════════════════════════

JAZZMIN_SETTINGS = {
    # ── Identité ───────────────────────────────────────────────────
    "site_title":        "SIMS CORE",
    "site_header":       "SIMS CORE",
    "site_brand":        "SIMS",
    "site_logo":         "img/sims_logo.png",   # logo dans /static/img/
    "login_logo":        "img/sims_logo.png",
    "login_logo_dark":   "img/sims_logo.png",
    "site_logo_classes": "img-fluid",            # pas de crop circulaire sur le logo
    "site_icon":         "img/sims_logo.png",
    "welcome_sign":      "Space Imaging & Mapping Systems",
    "copyright":         "Powered by GeoEco Systems",
    "search_model":      ["sims_network.Incident", "sims_network.Intervention"],

    # ── Utilisateur — avatar depuis UserProfile.avatar ────────────
    "user_avatar": "profile.avatar",             # champ sur le profil Django

    # ── Menu haut (Topbar) ────────────────────────────────────────
    "topmenu_links": [
        {"name": "Accueil",  "url": "admin:index", "permissions": ["auth.view_user"]},
        {"name": "API Docs", "url": "/api/docs/", "new_window": True},
        {"model": "auth.User"},
    ],

    # ── Menu utilisateur (dropdown en haut à droite) ───────────────
    "usermenu_links": [
        {"name": "API Docs", "url": "/api/docs/", "new_window": True},
        {"model": "auth.User"},
    ],

    # ── Sidebar ───────────────────────────────────────────────────
    "show_sidebar":              True,
    "navigation_expanded":       True,
    "hide_apps":                 [],
    "hide_models":               [],

    # Ordre et icônes de la sidebar
    "order_with_respect_to": [
        "sims_network",
        "sims_network.Incident",
        "sims_network.Intervention",
        "sims_network.TypeIncident",
        "sims_network.Equipe",
        "sims_network.TypeOuvrage",
        "sims_network.Ouvrage",
        "sims_core",
        "sims_core.Organisation",
        "sims_core.Application",
        "sims_core.ApplicationLayer",
        "sims_core.UserProfile",
        "sims_core.Dashboard",
        "sims_core.DashboardWidget",
        "auth",
    ],

    # Icônes FontAwesome 5 par modèle
    "icons": {
        # Auth Django
        "auth":                     "fas fa-users-cog",
        "auth.user":                "fas fa-user",
        "auth.Group":               "fas fa-users",

        # sims_network
        "sims_network":                     "fas fa-bolt",
        "sims_network.Incident":            "fas fa-exclamation-triangle",
        "sims_network.Intervention":        "fas fa-wrench",
        "sims_network.IncidentPhoto":       "fas fa-camera",
        "sims_network.InterventionPhoto":   "fas fa-image",
        "sims_network.TypeIncident":        "fas fa-tags",
        "sims_network.Equipe":              "fas fa-hard-hat",
        "sims_network.TypeOuvrage":         "fas fa-plug",
        "sims_network.Ouvrage":             "fas fa-network-wired",

        # sims_core
        "sims_core":                       "fas fa-map",
        "sims_core.Organisation":          "fas fa-building",
        "sims_core.Application":           "fas fa-layer-group",
        "sims_core.ApplicationLayer":      "fas fa-map-marked-alt",
        "sims_core.UserProfile":           "fas fa-id-badge",
        "sims_core.MapAnnotation":         "fas fa-draw-polygon",
        "sims_core.MapBookmark":           "fas fa-bookmark",
        "sims_core.Dashboard":             "fas fa-chart-pie",
        "sims_core.DashboardWidget":       "fas fa-chart-bar",
    },

    "default_icon_parents": "fas fa-chevron-circle-right",
    "default_icon_children": "fas fa-circle",

    # ── Liens rapides sidebar bas ──────────────────────────────────
    "related_modal_active": True,

    # ── Autres options ─────────────────────────────────────────────
    "custom_css":        "sims_admin.css",   # thème SIMS cyan/navy
    "custom_js":         "sims_admin.js",    # override footer version text
    "use_google_fonts_cdn": False,      # False en prod (pas de réseau externe)
    "show_ui_builder":   False,         # Mettre True pour générer la config visuellement

    # ── Changeform ────────────────────────────────────────────────
    "changeform_format":        "horizontal_tabs",   # ou "collapsible", "carousel", "single"
    "changeform_format_overrides": {
        "auth.user":    "collapsible",
        "auth.group":   "vertical_tabs",
        "sims_network.incident":     "horizontal_tabs",
        "sims_network.intervention": "horizontal_tabs",
    },

    # ── Langue ────────────────────────────────────────────────────
    "language_chooser": False,
}


# ═══════════════════════════════════════════════════════════════════
#  JAZZMIN_UI_TWEAKS — Apparence fine (couleurs, sidebar, boutons)
# ═══════════════════════════════════════════════════════════════════

JAZZMIN_UI_TWEAKS = {
    # ── Thème AdminLTE ────────────────────────────────────────────
    # Valeurs possibles : "default", "cerulean", "cosmo", "cyborg",
    # "darkly", "flatly", "journal", "litera", "lumen", "lux",
    # "materia", "minty", "pulse", "sandstone", "simplex",
    # "sketchy", "slate", "solar", "spacelab", "superhero",
    # "united", "yeti"
    "theme":      "cyborg",    # base sombre proche du navy SIMS (overridé par sims_admin.css)

    # ── Navbar ────────────────────────────────────────────────────
    "navbar":          "navbar-dark",
    "navbar_small_text": False,

    # ── Sidebar ───────────────────────────────────────────────────
    "sidebar":         "sidebar-dark-primary",
    "sidebar_nav_small_text":    False,
    "sidebar_disable_expand":    False,
    "sidebar_nav_child_indent":  True,
    "sidebar_nav_compact_style": False,
    "sidebar_nav_legacy_style":  False,
    "sidebar_nav_flat_style":    False,
    "sidebar_fixed":             True,

    # ── Boutons & liens ────────────────────────────────────────────
    "actions_sticky_top":        True,

    # ── Footer ────────────────────────────────────────────────────
    "footer_small_text": True,

    # ── Body ──────────────────────────────────────────────────────
    "body_small_text":   False,
    "brand_small_text":  False,
    "brand_colour":      "navbar-primary",
    "accent":            "accent-primary",
    "no_navbar_border":  False,
    "body_small_text":   False,
}
