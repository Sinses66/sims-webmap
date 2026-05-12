"""
Migration 0002 — TypeOuvrage.application_layer
===============================================
Ajoute une FK nullable TypeOuvrage → sims_core.ApplicationLayer.

Les champs couche_geoserver et layer_key sont conservés (rétrocompatibilité)
et seront désormais synchronisés automatiquement via TypeOuvrage.save().
"""

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('eneo_reseau', '0006_interventionphoto'),
        ('sims_core', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='typeouvrage',
            name='application_layer',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='type_ouvrages',
                to='sims_core.applicationlayer',
                verbose_name='Couche cartographique',
                help_text=(
                    'Sélectionnez la couche ApplicationLayer correspondante. '
                    'couche_geoserver et layer_key seront synchronisés automatiquement.'
                ),
            ),
        ),
    ]
