import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from inventory.models import MedicalCamp
from voicebot.models import CampVoiceReminder
from voicebot.services.reminder_service import ReminderService

logger = logging.getLogger(__name__)

@receiver(post_save, sender=MedicalCamp)
def create_camp_voice_reminder(sender, instance, created, **kwargs):
    """
    Automatically generates a single Telugu audio reminder for the camp when it is registered.
    Uses the centralized ReminderService to format date and venue accurately.
    """
    if created:
        try:
            service = ReminderService()
            telugu_text = service.generate_telugu_text(instance.date, instance.venue.name)
            
            audio_file = service.tts.synthesize_telugu(telugu_text)
            filename = f"camp_reminder_{instance.id}.mp3"
            
            # Save the reminder record and generated file
            reminder, _ = CampVoiceReminder.objects.get_or_create(camp=instance)
            reminder.telugu_text = telugu_text
            reminder.audio_file.save(filename, audio_file, save=True)
            logger.info(f"Automatically generated voice reminder audio for Camp {instance.number}")
            
        except Exception as e:
            # Log the error but do not block camp creation
            logger.error(f"Failed to generate auto-camp voice reminder: {str(e)}")
