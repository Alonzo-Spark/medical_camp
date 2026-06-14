from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('voicebot', '0005_rename_confidence_voiceresponse_confidence_score_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='voicecall',
            name='language',
            field=models.CharField(default='te', max_length=10),
        ),
    ]
