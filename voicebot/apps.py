from django.apps import AppConfig

class VoicebotConfig(AppConfig):
    name = 'voicebot'

    def ready(self):
        import voicebot.signals
