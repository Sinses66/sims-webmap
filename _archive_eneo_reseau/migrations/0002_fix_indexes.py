from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('eneo_reseau', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='incident',
            name='id',
            field=models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID'),
        ),
        migrations.AlterField(
            model_name='incidentphoto',
            name='id',
            field=models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID'),
        ),
        migrations.AlterField(
            model_name='intervention',
            name='id',
            field=models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID'),
        ),
    ]
