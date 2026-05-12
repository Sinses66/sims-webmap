"""
Migration 0002 — Couches dynamiques
Ajoute à ApplicationLayer les champs nécessaires pour le mécanisme
de couches dynamiques consommé par le frontend React.

Nouveaux champs :
  - layer_key     : identifiant stable pour React (ex: cmr_reseau_htb)
  - description   : description courte affichée dans le LayerManager
  - group_slug    : identifiant du groupe (ex: htb_existant)
  - group_label   : libellé affiché dans la sidebar
  - group_icon    : emoji du groupe
  - group_order   : ordre d'affichage du groupe

Mise à jour :
  - ordering Meta : inclut group_order
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sims_core', '0001_initial'),
    ]

    operations = [
        # ── Identifiant stable frontend ──────────────────────────
        migrations.AddField(
            model_name='applicationlayer',
            name='layer_key',
            field=models.SlugField(
                blank=True, max_length=100,
                verbose_name='Clé frontend (layer_key)',
                help_text='Identifiant stable utilisé par React (ex: cmr_reseau_htb). '
                          'Généré automatiquement si laissé vide.'
            ),
        ),
        # ── Description ──────────────────────────────────────────
        migrations.AddField(
            model_name='applicationlayer',
            name='description',
            field=models.TextField(blank=True, verbose_name='Description'),
        ),
        # ── Groupe : slug ────────────────────────────────────────
        migrations.AddField(
            model_name='applicationlayer',
            name='group_slug',
            field=models.SlugField(
                blank=True, max_length=100,
                verbose_name='Slug du groupe',
                help_text='Identifiant du groupe (ex: htb_existant)'
            ),
        ),
        # ── Groupe : libellé ─────────────────────────────────────
        migrations.AddField(
            model_name='applicationlayer',
            name='group_label',
            field=models.CharField(
                blank=True, max_length=200,
                verbose_name='Libellé du groupe',
                help_text='Affiché dans la sidebar (ex: Réseau HTB Existant)'
            ),
        ),
        # ── Groupe : icône emoji ─────────────────────────────────
        migrations.AddField(
            model_name='applicationlayer',
            name='group_icon',
            field=models.CharField(
                blank=True, default='🗺️', max_length=10,
                verbose_name="Icône du groupe (emoji)"
            ),
        ),
        # ── Groupe : ordre ───────────────────────────────────────
        migrations.AddField(
            model_name='applicationlayer',
            name='group_order',
            field=models.IntegerField(
                default=0,
                verbose_name='Ordre du groupe',
                help_text='Les groupes sont triés par cet entier croissant'
            ),
        ),
        # ── Mise à jour de l'ordering Meta ───────────────────────
        migrations.AlterModelOptions(
            name='applicationlayer',
            options={
                'ordering': ['application', 'group_order', 'layer_order', 'name'],
                'verbose_name': 'Couche cartographique',
                'verbose_name_plural': 'Couches cartographiques',
            },
        ),
    ]
