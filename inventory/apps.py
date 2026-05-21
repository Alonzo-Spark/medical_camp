from django.apps import AppConfig


class InventoryConfig(AppConfig):
    # pyrefly: ignore [bad-override]
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'inventory'

    def ready(self):
        import inventory.signals