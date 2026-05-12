"""
Migration 0002 — no-op.
La FK application_layer est deja incluse dans 0001_initial.
Cette migration existe pour maintenir la coherence avec l'historique eneo_reseau.
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('sims_network', '0001_initial'),
    ]

    operations = []
