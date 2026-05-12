from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('sims_network', '0003_incident_organisation'),
    ]

    operations = [
        migrations.RunSQL(
            sql=[
                "ALTER TABLE eneo_reseau_typeouvrage     RENAME TO sims_network_typeouvrage;",
                "ALTER TABLE eneo_reseau_ouvrage         RENAME TO sims_network_ouvrage;",
                "ALTER TABLE eneo_reseau_typeincident    RENAME TO sims_network_typeincident;",
                "ALTER TABLE eneo_reseau_equipe          RENAME TO sims_network_equipe;",
                "ALTER TABLE eneo_reseau_incident        RENAME TO sims_network_incident;",
                "ALTER TABLE eneo_reseau_incidentphoto   RENAME TO sims_network_incidentphoto;",
                "ALTER TABLE eneo_reseau_intervention    RENAME TO sims_network_intervention;",
                "ALTER TABLE eneo_reseau_interventionphoto RENAME TO sims_network_interventionphoto;",
            ],
            reverse_sql=[
                "ALTER TABLE sims_network_typeouvrage       RENAME TO eneo_reseau_typeouvrage;",
                "ALTER TABLE sims_network_ouvrage           RENAME TO eneo_reseau_ouvrage;",
                "ALTER TABLE sims_network_typeincident      RENAME TO eneo_reseau_typeincident;",
                "ALTER TABLE sims_network_equipe            RENAME TO eneo_reseau_equipe;",
                "ALTER TABLE sims_network_incident          RENAME TO eneo_reseau_incident;",
                "ALTER TABLE sims_network_incidentphoto     RENAME TO eneo_reseau_incidentphoto;",
                "ALTER TABLE sims_network_intervention      RENAME TO eneo_reseau_intervention;",
                "ALTER TABLE sims_network_interventionphoto RENAME TO eneo_reseau_interventionphoto;",
            ],
        ),
    ]
