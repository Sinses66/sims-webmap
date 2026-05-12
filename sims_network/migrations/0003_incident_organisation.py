"""
0003_incident_organisation
==========================
Ajoute la FK organisation (nullable) sur Incident.

Cette colonne est la source de verite multi-tenant :
  - Renseignee automatiquement via Incident.save() ou IncidentViewSet.perform_create()
  - Remplace les Q() combinatoires fragiles dans les ViewSets et notifications_feed
"""

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('sims_core',    '0001_initial'),
        ('sims_network', '0002_typeouvrage_application_layer'),
    ]

    operations = [
        migrations.AddField(
            model_name='incident',
            name='organisation',
            field=models.ForeignKey(
                blank=True,
                db_index=True,
                help_text='Renseigne automatiquement depuis le profil du declarant.',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='incidents',
                to='sims_core.organisation',
                verbose_name='Organisation',
            ),
        ),
    ]
