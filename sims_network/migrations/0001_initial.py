"""
Migration initiale — sims_network
Declare tous les modeles avec db_table pointant sur les tables eneo_reseau_*
deja existantes en base. Aucune table n'est creee (fake-initial).
"""

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('sims_core', '0001_initial'),
    ]

    operations = [

        # ── TypeOuvrage ──────────────────────────────────────────────
        migrations.CreateModel(
            name='TypeOuvrage',
            fields=[
                ('id',               models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('nom',              models.CharField(max_length=100, verbose_name='Nom')),
                ('couche_geoserver', models.CharField(blank=True, max_length=200, verbose_name='Couche GeoServer')),
                ('layer_key',        models.CharField(blank=True, max_length=100, verbose_name='Cle de couche')),
                ('champ_cle',        models.CharField(max_length=100, verbose_name='Attribut-cle')),
                ('champ_nom',        models.CharField(blank=True, max_length=100, verbose_name='Attribut nom')),
                ('icone',            models.CharField(blank=True, default='🔌', max_length=10, verbose_name='Icone')),
                ('actif',            models.BooleanField(db_index=True, default=True, verbose_name='Actif')),
                ('ordre',            models.PositiveSmallIntegerField(default=0, verbose_name='Ordre')),
                ('application_layer', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='type_ouvrages',
                    to='sims_core.applicationlayer',
                    verbose_name='Couche cartographique',
                )),
            ],
            options={
                'verbose_name':        "Type d'ouvrage",
                'verbose_name_plural': "Types d'ouvrage",
                'ordering':            ['ordre', 'nom'],
                'db_table':            'eneo_reseau_typeouvrage',
            },
        ),

        # ── Ouvrage ──────────────────────────────────────────────────
        migrations.CreateModel(
            name='Ouvrage',
            fields=[
                ('id',        models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('code',      models.CharField(max_length=100, unique=True, verbose_name='Code ouvrage')),
                ('nom',       models.CharField(blank=True, max_length=200, verbose_name='Nom / Libelle')),
                ('latitude',  models.FloatField(blank=True, null=True, verbose_name='Latitude')),
                ('longitude', models.FloatField(blank=True, null=True, verbose_name='Longitude')),
                ('actif',     models.BooleanField(db_index=True, default=True, verbose_name='Actif')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('type_ouvrage', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='ouvrages',
                    to='sims_network.typeouvrage',
                    verbose_name="Type d'ouvrage",
                )),
            ],
            options={
                'verbose_name':        'Ouvrage',
                'verbose_name_plural': 'Ouvrages',
                'ordering':            ['code'],
                'db_table':            'eneo_reseau_ouvrage',
            },
        ),

        # ── TypeIncident ─────────────────────────────────────────────
        migrations.CreateModel(
            name='TypeIncident',
            fields=[
                ('id',          models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('nom',         models.CharField(max_length=100, unique=True, verbose_name='Nom')),
                ('description', models.TextField(blank=True, verbose_name='Description')),
                ('icone',       models.CharField(blank=True, default='⚡', max_length=10, verbose_name='Icone')),
                ('actif',       models.BooleanField(db_index=True, default=True, verbose_name='Actif')),
                ('ordre',       models.PositiveSmallIntegerField(default=0, verbose_name="Ordre d'affichage")),
            ],
            options={
                'verbose_name':        "Type d'incident",
                'verbose_name_plural': "Types d'incident",
                'ordering':            ['ordre', 'nom'],
                'db_table':            'eneo_reseau_typeincident',
            },
        ),

        # ── Equipe ───────────────────────────────────────────────────
        migrations.CreateModel(
            name='Equipe',
            fields=[
                ('id',         models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('nom',        models.CharField(max_length=100, verbose_name="Nom de l'equipe")),
                ('specialite', models.CharField(blank=True, max_length=150, verbose_name='Specialite')),
                ('contact',    models.CharField(blank=True, max_length=100, verbose_name='Contact / Telephone')),
                ('actif',      models.BooleanField(db_index=True, default=True, verbose_name='Active')),
                ('responsable', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='equipes_responsable',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Responsable',
                )),
            ],
            options={
                'verbose_name':        'Equipe',
                'verbose_name_plural': 'Equipes',
                'ordering':            ['nom'],
                'db_table':            'eneo_reseau_equipe',
            },
        ),

        # ── Incident ─────────────────────────────────────────────────
        migrations.CreateModel(
            name='Incident',
            fields=[
                ('id',            models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('titre',         models.CharField(max_length=200, verbose_name='Titre')),
                ('description',   models.TextField(blank=True, verbose_name='Description')),
                ('statut',        models.CharField(
                    choices=[('ouvert','Ouvert'),('en_cours','En cours'),('resolu','Résolu'),('ferme','Fermé'),('annule','Annulé')],
                    db_index=True, default='ouvert', max_length=20, verbose_name='Statut',
                )),
                ('priorite',      models.CharField(
                    choices=[('critique','Critique'),('haute','Haute'),('moyenne','Moyenne'),('basse','Basse')],
                    db_index=True, default='moyenne', max_length=20, verbose_name='Priorite',
                )),
                ('latitude',      models.FloatField(blank=True, null=True, verbose_name='Latitude')),
                ('longitude',     models.FloatField(blank=True, null=True, verbose_name='Longitude')),
                ('couche_id',     models.CharField(blank=True, max_length=100, verbose_name='ID couche SIG')),
                ('couche_nom',    models.CharField(blank=True, max_length=100, verbose_name='Nom couche SIG')),
                ('feature_id',    models.CharField(blank=True, max_length=100, verbose_name='Feature ID SIG')),
                ('localisation',  models.CharField(blank=True, max_length=300, verbose_name='Localisation')),
                ('quartier',      models.CharField(blank=True, max_length=150, verbose_name='Quartier')),
                ('ville',         models.CharField(blank=True, max_length=100, verbose_name='Ville')),
                ('date_signalement',  models.DateTimeField(default=django.utils.timezone.now, verbose_name='Date de signalement')),
                ('date_prise_charge', models.DateTimeField(blank=True, null=True, verbose_name='Date prise en charge')),
                ('date_resolution',   models.DateTimeField(blank=True, null=True, verbose_name='Date de resolution')),
                ('created_at',    models.DateTimeField(auto_now_add=True)),
                ('updated_at',    models.DateTimeField(auto_now=True)),
                ('ouvrage', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='incidents',
                    to='sims_network.ouvrage',
                    verbose_name='Ouvrage concerne',
                )),
                ('type_incident', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='incidents',
                    to='sims_network.typeincident',
                    verbose_name="Type d'incident",
                )),
                ('signale_par', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='incidents_signales',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Signale par',
                )),
                ('assigne_a', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='incidents_assignes',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Assigne a',
                )),
            ],
            options={
                'verbose_name':        'Incident',
                'verbose_name_plural': 'Incidents',
                'ordering':            ['-date_signalement'],
                'db_table':            'eneo_reseau_incident',
            },
        ),

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

        # ── IncidentPhoto ─────────────────────────────────────────────
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
                    to='sims_network.incident',
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
                'db_table':            'eneo_reseau_incidentphoto',
            },
        ),

        # ── Intervention ──────────────────────────────────────────────
        migrations.CreateModel(
            name='Intervention',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('type_travaux', models.CharField(
                    choices=[('remplacement','Remplacement'),('reparation','Réparation'),
                             ('maintenance','Maintenance'),('inspection','Inspection'),('autre','Autre')],
                    default='reparation', max_length=30, verbose_name='Type de travaux',
                )),
                ('statut', models.CharField(
                    choices=[('planifiee','Planifiée'),('en_cours','En cours'),
                             ('terminee','Terminée'),('annulee','Annulée')],
                    db_index=True, default='planifiee', max_length=20, verbose_name='Statut',
                )),
                ('description',   models.TextField(blank=True, verbose_name='Description des travaux')),
                ('rapport',       models.TextField(blank=True, verbose_name='Rapport de cloture')),
                ('observations',  models.TextField(blank=True, verbose_name='Observations')),
                ('date_planifiee', models.DateTimeField(blank=True, null=True, verbose_name='Date planifiee')),
                ('date_debut',    models.DateTimeField(blank=True, null=True, verbose_name='Date de debut')),
                ('date_fin',      models.DateTimeField(blank=True, null=True, verbose_name='Date de fin')),
                ('duree_estimee', models.PositiveIntegerField(blank=True, null=True, verbose_name='Duree estimee (min)')),
                ('created_at',    models.DateTimeField(auto_now_add=True)),
                ('updated_at',    models.DateTimeField(auto_now=True)),
                ('incident', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='interventions',
                    to='sims_network.incident',
                    verbose_name='Incident',
                )),
                ('equipe', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='interventions',
                    to='sims_network.equipe',
                    verbose_name='Equipe',
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
                    verbose_name='Cree par',
                )),
            ],
            options={
                'verbose_name':        'Intervention',
                'verbose_name_plural': 'Interventions',
                'ordering':            ['-created_at'],
                'db_table':            'eneo_reseau_intervention',
            },
        ),

        migrations.AddIndex(
            model_name='intervention',
            index=models.Index(fields=['statut'], name='intervention_statut_idx'),
        ),
        migrations.AddIndex(
            model_name='intervention',
            index=models.Index(fields=['date_planifiee'], name='intervention_date_plan_idx'),
        ),

        # ── InterventionPhoto ─────────────────────────────────────────
        migrations.CreateModel(
            name='InterventionPhoto',
            fields=[
                ('id',           models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('image',        models.ImageField(upload_to='interventions/photos/%Y/%m/')),
                ('legende',      models.CharField(blank=True, max_length=200)),
                ('uploaded_at',  models.DateTimeField(auto_now_add=True)),
                ('intervention', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='photos',
                    to='sims_network.intervention',
                )),
                ('uploaded_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='intervention_photos',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name':        "Photo d'intervention",
                'verbose_name_plural': "Photos d'intervention",
                'ordering':            ['uploaded_at'],
                'db_table':            'eneo_reseau_interventionphoto',
            },
        ),
    ]
