from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('sims_core', '0003_applicationlayer_popup_fields'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Dashboard',
            fields=[
                ('id',          models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name',        models.CharField(max_length=200, verbose_name='Nom du tableau de bord')),
                ('description', models.TextField(blank=True)),
                ('is_shared',   models.BooleanField(default=False, verbose_name="Partagé avec l'équipe")),
                ('created_at',  models.DateTimeField(auto_now_add=True)),
                ('updated_at',  models.DateTimeField(auto_now=True)),
                ('application', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='dashboards',
                    to='sims_core.application',
                    verbose_name='Application',
                )),
                ('created_by',  models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='dashboards',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Créé par',
                )),
            ],
            options={
                'verbose_name':        'Tableau de bord',
                'verbose_name_plural': 'Tableaux de bord',
                'ordering':            ['-updated_at'],
            },
        ),
        migrations.CreateModel(
            name='DashboardWidget',
            fields=[
                ('id',               models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title',            models.CharField(max_length=200, verbose_name='Titre du widget')),
                ('geoserver_layer',  models.CharField(max_length=200, verbose_name='Couche GeoServer')),
                ('layer_name',       models.CharField(blank=True, max_length=200, verbose_name='Nom affiché de la couche')),
                ('attributes',       models.JSONField(default=list, verbose_name='Attributs analysés')),
                ('chart_type',       models.CharField(
                    choices=[
                        ('pie',            'Camembert'),
                        ('donut',          'Donut'),
                        ('bar',            'Barres verticales'),
                        ('bar_horizontal', 'Barres horizontales'),
                        ('histogram',      'Histogramme'),
                        ('line',           'Courbe'),
                        ('treemap',        'Treemap'),
                        ('grouped_bar',    'Barres groupées'),
                    ],
                    default='bar',
                    max_length=20,
                    verbose_name='Type de graphique',
                )),
                ('color_scheme',     models.CharField(
                    choices=[
                        ('default',    'Défaut (bleu ENEO)'),
                        ('rainbow',    'Arc-en-ciel'),
                        ('warm',       'Chaud (rouge-orange)'),
                        ('cool',       'Froid (bleu-vert)'),
                        ('monochrome', 'Monochrome'),
                    ],
                    default='default',
                    max_length=20,
                    verbose_name='Palette de couleurs',
                )),
                ('filters',          models.JSONField(blank=True, default=dict, verbose_name='Filtres')),
                ('position',         models.IntegerField(default=0, verbose_name='Position dans la grille')),
                ('config',           models.JSONField(blank=True, default=dict, verbose_name='Configuration avancée')),
                ('created_at',       models.DateTimeField(auto_now_add=True)),
                ('updated_at',       models.DateTimeField(auto_now=True)),
                ('dashboard',        models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='widgets',
                    to='sims_core.dashboard',
                    verbose_name='Tableau de bord',
                )),
            ],
            options={
                'verbose_name':        'Widget de tableau de bord',
                'verbose_name_plural': 'Widgets de tableau de bord',
                'ordering':            ['dashboard', 'position'],
            },
        ),
    ]
