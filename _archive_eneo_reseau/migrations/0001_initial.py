"""
Migration initiale — eneo_reseau
Crée les tables : incident, incidentphoto, intervention
"""

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ── Incident ────────────────────────────────────────────────
        migrations.CreateModel(
            name='Incident',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('titre',          models.CharField(max_length=200, verbose_name='Titre')),
                ('description',    models.TextField(blank=True, verbose_name='Description')),
                ('type_incident',  models.CharField(
                    choices=[
                        ('panne_transfo',   'Panne transformateur'),
                        ('coupure_ligne',   'Coupure de ligne'),
                        ('court_circuit',   'Court-circuit'),
                        ('surcharge',       'Surcharge réseau'),
                        ('vandalisme',      'Vandalisme / Vol'),
                        ('chute_poteau',    'Chute de poteau'),
                        ('defaut_isolation','Défaut d\'isolation'),
                        ('autre',           'Autre'),
                    ],
                    default='autre', max_length=30, verbose_name="Type d'incident"
                )),
                ('statut', models.CharField(
                    choices=[
                        ('ouvert',   'Ouvert'),
                        ('en_cours', 'En cours de traitement'),
                        ('resolu',   'Résolu'),
                        ('ferme',    'Fermé'),
                        ('annule',   'Annulé'),
                    ],
                    db_index=True, default='ouvert', max_length=20, verbose_name='Statut'
                )),
                ('priorite', models.CharField(
                    choices=[
                        ('critique', 'Critique'),
                        ('haute',    'Haute'),
                        ('moyenne',  'Moyenne'),
                        ('basse',    'Basse'),
                    ],
                    db_index=True, default='moyenne', max_length=20, verbose_name='Priorité'
                )),
                ('latitude',    models.FloatField(blank=True, null=True, verbose_name='Latitude')),
                ('longitude',   models.FloatField(blank=True, null=True, verbose_name='Longitude')),
                ('couche_id',   models.CharField(blank=True, max_length=100, verbose_name='ID couche SIG')),
                ('couche_nom',  models.CharField(blank=True, max_length=100, verbose_name='Nom couche SIG')),
                ('feature_id',  models.CharField(blank=True, max_length=100, verbose_name='Feature ID SIG')),
                ('localisation',models.CharField(blank=True, max_length=300, verbose_name='Localisation (texte)')),
                ('quartier',    models.CharField(blank=True, max_length=150, verbose_name='Quartier / Zone')),
                ('ville',       models.CharField(blank=True, max_length=100, verbose_name='Ville')),
                ('date_signalement',  models.DateTimeField(default=django.utils.timezone.now, verbose_name='Date de signalement')),
                ('date_prise_charge', models.DateTimeField(blank=True, null=True, verbose_name='Date prise en charge')),
                ('date_resolution',   models.DateTimeField(blank=True, null=True, verbose_name='Date de résolution')),
                ('created_at',  models.DateTimeField(auto_now_add=True)),
                ('updated_at',  models.DateTimeField(auto_now=True)),
                ('signale_par', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='incidents_signales',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Signalé par',
                )),
                ('assigne_a', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='incidents_assignes',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Assigné à',
                )),
            ],
            options={
                'verbose_name':        'Incident',
                'verbose_name_plural': 'Incidents',
                'ordering':            ['-date_signalement'],
            },
        ),

        # ── Index Incident ──────────────────────────────────────────
        migrations.AddIndex(
            model_name='incident',
            index=models.Index(fields=['statut', 'priorite'], name='incident_statut_priorite_idx'),
        ),
        migrations.AddIndex(
            model_name='incident',
            index=models.Index(fields=['date_signalement'], name='incident_date_sig_idx'),
        ),
        migrations.AddIndex(
            model_name='incident',
            index=models.Index(fields=['couche_id', 'feature_id'], name='incident_couche_feature_idx'),
        ),

        # ── IncidentPhoto ────────────────────────────────────────────
        migrations.CreateModel(
            name='IncidentPhoto',
            fields=[
                ('id',          models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('image',       models.ImageField(upload_to='incidents/photos/%Y/%m/')),
                ('legende',     models.CharField(blank=True, max_length=200)),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('incident', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='photos',
                    to='eneo_reseau.incident',
                )),
                ('uploaded_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name':        "Photo d'incident",
                'verbose_name_plural': "Photos d'incident",
                'ordering':            ['uploaded_at'],
            },
        ),

        # ── Intervention ─────────────────────────────────────────────
        migrations.CreateModel(
            name='Intervention',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('type_travaux', models.CharField(
                    choices=[
                        ('remplacement', 'Remplacement matériel'),
                        ('reparation',   'Réparation'),
                        ('maintenance',  'Maintenance préventive'),
                        ('inspection',   'Inspection'),
                        ('autre',        'Autre'),
                    ],
                    default='reparation', max_length=30, verbose_name='Type de travaux'
                )),
                ('statut', models.CharField(
                    choices=[
                        ('planifiee', 'Planifiée'),
                        ('en_cours',  'En cours'),
                        ('terminee',  'Terminée'),
                        ('annulee',   'Annulée'),
                    ],
                    db_index=True, default='planifiee', max_length=20, verbose_name='Statut'
                )),
                ('description',    models.TextField(blank=True, verbose_name='Description des travaux')),
                ('rapport',        models.TextField(blank=True, verbose_name='Rapport de clôture')),
                ('observations',   models.TextField(blank=True, verbose_name='Observations')),
                ('equipe',         models.CharField(blank=True, max_length=200, verbose_name='Équipe / Agents')),
                ('date_planifiee', models.DateTimeField(blank=True, null=True, verbose_name='Date planifiée')),
                ('date_debut',     models.DateTimeField(blank=True, null=True, verbose_name='Date de début effectif')),
                ('date_fin',       models.DateTimeField(blank=True, null=True, verbose_name='Date de fin effective')),
                ('duree_estimee',  models.PositiveIntegerField(blank=True, null=True, verbose_name='Durée estimée (minutes)')),
                ('created_at',     models.DateTimeField(auto_now_add=True)),
                ('updated_at',     models.DateTimeField(auto_now=True)),
                ('incident', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='interventions',
                    to='eneo_reseau.incident',
                    verbose_name='Incident',
                )),
                ('responsable', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='interventions_responsable',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Responsable',
                )),
                ('created_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='interventions_creees',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Créé par',
                )),
            ],
            options={
                'verbose_name':        'Intervention',
                'verbose_name_plural': 'Interventions',
                'ordering':            ['-created_at'],
            },
        ),

        # ── Index Intervention ──────────────────────────────────────
        migrations.AddIndex(
            model_name='intervention',
            index=models.Index(fields=['statut'], name='intervention_statut_idx'),
        ),
        migrations.AddIndex(
            model_name='intervention',
            index=models.Index(fields=['date_planifiee'], name='intervention_date_plan_idx'),
        ),
    ]
