from django.db import models
from inventory.models import Patient, MedicalCamp

class CampVoiceReminder(models.Model):
    camp = models.OneToOneField(MedicalCamp, on_delete=models.CASCADE, related_name='voice_reminder')
    audio_file = models.FileField(upload_to='camp_reminders/', null=True, blank=True)
    telugu_text = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Reminder for Camp {self.camp.number} at {self.camp.venue.name}"

class CallSchedule(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    )

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='call_schedules')
    camp = models.ForeignKey(MedicalCamp, on_delete=models.CASCADE, related_name='call_schedules')
    scheduled_time = models.DateTimeField()
    retry_count = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    call_sid = models.CharField(max_length=100, null=True, blank=True)
    audio_file = models.FileField(upload_to='voicebot_reminders/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Call to {self.patient.patient_name or 'Unknown'} - Camp {self.camp.number} - {self.status}"
