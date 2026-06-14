from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0055_testissue_test_done'),
    ]

    operations = [
        migrations.AddField(
            model_name='scansession',
            name='image_url',
            field=models.URLField(blank=True, max_length=1000, null=True),
        ),
    ]
