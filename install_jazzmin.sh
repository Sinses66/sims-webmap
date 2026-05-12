#!/bin/bash
# ════════════════════════════════════════════════════════════════
# install_jazzmin.sh — Installation et configuration django-jazzmin
# ════════════════════════════════════════════════════════════════
# Usage : bash install_jazzmin.sh
# ════════════════════════════════════════════════════════════════

DJANGO_PROJECT="$HOME/projects/eneo_webmap"
SETTINGS="$DJANGO_PROJECT/eneo_backend/settings.py"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "══ Installation django-jazzmin ══════════════════════════"

# ── 1. Installer le package ───────────────────────────────────────
echo "1. Installation pip..."
cd "$DJANGO_PROJECT"
source venv/bin/activate
pip install django-jazzmin==2.6.0 --quiet
echo "   ✓ django-jazzmin installé"

# ── 2. Copier jazzmin_settings.py dans le projet ──────────────────
echo "2. Copie jazzmin_settings.py..."
cp "$SCRIPT_DIR/jazzmin_settings.py" "$DJANGO_PROJECT/jazzmin_settings.py"
echo "   ✓ jazzmin_settings.py copié dans $DJANGO_PROJECT"

# ── 3. Patcher INSTALLED_APPS — jazzmin DOIT être avant django.contrib.admin ──
echo "3. Patch INSTALLED_APPS..."
if grep -q "jazzmin" "$SETTINGS"; then
    echo "   ✓ jazzmin déjà dans INSTALLED_APPS"
else
    # Insérer 'jazzmin' juste avant 'django.contrib.admin'
    sed -i "s/'django.contrib.admin'/'jazzmin',\n    'django.contrib.admin'/" "$SETTINGS"
    echo "   ✓ jazzmin ajouté avant django.contrib.admin"
fi

# ── 4. Ajouter l'import jazzmin_settings à la fin de settings.py ──
echo "4. Ajout import JAZZMIN_SETTINGS..."
if grep -q "jazzmin_settings" "$SETTINGS"; then
    echo "   ✓ import déjà présent"
else
    cat >> "$SETTINGS" << 'EOF'

# ── Thème Admin Jazzmin ───────────────────────────────────────────
import os as _os
_jazzmin_path = _os.path.join(_os.path.dirname(_os.path.dirname(__file__)), 'jazzmin_settings.py')
if _os.path.exists(_jazzmin_path):
    exec(open(_jazzmin_path).read())
EOF
    echo "   ✓ import JAZZMIN_SETTINGS ajouté dans settings.py"
fi

# ── 5. Collecter les fichiers statiques ───────────────────────────
echo "5. collectstatic..."
python manage.py collectstatic --noinput --verbosity 0
echo "   ✓ Fichiers statiques collectés"

echo ""
echo "══ Jazzmin configuré ✓ ══════════════════════════════════"
echo "   Redémarre Django : python manage.py runserver 8001"
echo "   Admin : http://localhost:8001/admin/"
echo ""
echo "   Astuce : pour personnaliser davantage l'apparence,"
echo "   mets 'show_ui_builder': True dans jazzmin_settings.py,"
echo "   puis visite l'admin pour accéder au UI Builder."
