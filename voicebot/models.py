from django.db import models
from inventory.models import Patient, MedicalCamp, TestIssue

class CampVoiceReminder(models.Model):
    camp = models.OneToOneField(MedicalCamp, on_delete=models.CASCADE, related_name='voice_reminder', to_field='number')
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

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='call_schedules', to_field='patient_id')
    camp = models.ForeignKey(MedicalCamp, on_delete=models.CASCADE, related_name='call_schedules', to_field='number')
    scheduled_time = models.DateTimeField()
    retry_count = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    call_sid = models.CharField(max_length=100, null=True, blank=True)
    audio_file = models.FileField(upload_to='voicebot_reminders/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Call to {self.patient.patient_name or 'Unknown'} - Camp {self.camp.number} - {self.status}"


# ─────────────────────────────────────────────────────────────────────────────
# Phase 2 — Lab Test Follow-up Voicebot Models
# ─────────────────────────────────────────────────────────────────────────────

class VoiceCall(models.Model):
    """
    Tracks one outbound follow-up call placed to a patient regarding
    their pending lab test. Linked directly to the TestIssue record
    so that the bot can update reports_issued once confirmed.
    """
    CALL_TYPE_CHOICES = [
        ('lab_followup', 'Lab Test Follow-up'),
    ]
    STATUS_CHOICES = [
        ('pending',     'Pending'),
        ('in_progress', 'In Progress'),
        ('completed',   'Completed'),
        ('failed',      'Failed'),
        ('unanswered',  'Unanswered'),
    ]

    patient     = models.ForeignKey(Patient,   on_delete=models.CASCADE, to_field='patient_id', related_name='voice_calls')
    test_issue  = models.ForeignKey(TestIssue, on_delete=models.CASCADE, related_name='voice_calls')
    call_type   = models.CharField(max_length=50, choices=CALL_TYPE_CHOICES, default='lab_followup')
    status      = models.CharField(max_length=20, choices=STATUS_CHOICES,   default='pending')
    call_sid    = models.CharField(max_length=200, null=True, blank=True)   # Exotel CallSid
    started_at  = models.DateTimeField(auto_now_add=True)
    completed_at= models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"VoiceCall [{self.call_type}] → Patient {self.patient.patient_id} | {self.status}"


class VoiceResponse(models.Model):
    """
    Stores one Q&A turn inside a VoiceCall session.
    - question_key : machine-readable key, e.g. 'Q1_TESTS_DONE'
    - transcript   : raw Telugu text returned by Sarvam AI STT
    - intent       : structured classification, e.g. 'YES', 'NO', 'PENDING', 'UNCLEAR'
    - confidence   : 0.0 – 1.0 float from the intent classifier
    - attempt      : which retry attempt this was (1, 2, or 3)
    """
    INTENT_CHOICES = [
        # Question 1 — Did you complete the tests?
        ('YES',              'Yes – Tests Completed'),
        ('NO',               'No – Tests Not Completed'),
        ('PENDING',          'Pending – Appointment Not Done'),
        # Question 2 — Did you receive reports?
        ('REPORT_RECEIVED',      'Report Received'),
        ('REPORT_NOT_RECEIVED',  'Report Not Received'),
        ('REPORT_PENDING',       'Report Pending'),
        # Universal
        ('UNCLEAR',          'Unclear / Could Not Understand'),
    ]

    voice_call    = models.ForeignKey(VoiceCall, on_delete=models.CASCADE, related_name='responses')
    question_key  = models.CharField(max_length=50)   # e.g. 'Q1_TESTS_DONE', 'Q2_REPORT_RECEIVED'
    transcript    = models.TextField(null=True, blank=True)
    intent        = models.CharField(max_length=30, choices=INTENT_CHOICES, default='UNCLEAR')
    confidence    = models.FloatField(default=0.0)
    attempt       = models.IntegerField(default=1)     # retry attempt number (1-3)
    created_at    = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Response [{self.question_key}] → {self.intent} (conf={self.confidence:.2f})"
