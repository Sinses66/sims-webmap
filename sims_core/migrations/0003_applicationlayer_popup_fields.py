"""
Migration 0003 — Champs popup configurables
Ajoute popup_fields à ApplicationLayer.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sims_core', '0002_applicationlayer_dynamic_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='applicationlayer',
            name='popup_fields',
            field=models.JSONField(
                blank=True,
                default=list,
                verbose_name='Champs popup',
                help_text=(
                    "Liste ordonnée des attributs à afficher dans le popup. "
                    "Format : [\"nom\", \"tension\", \"code\"] — "
                    "Laisser vide = tous les attributs."
                ),
            ),
        ),
    ]
