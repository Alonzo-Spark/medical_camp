from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from inventory.models import Patient, MedicalCamp
from voicebot.models import CallSchedule
from voicebot.services.reminder_service import ReminderService

class TriggerTestReminderView(APIView):
    def post(self, request):
        """
        API to manually trigger and test Telugu voice reminder audio generation.
        Targets the latest registered upcoming camp.
        """
        patient_id = request.data.get("patient_id")

        if not patient_id:
            return Response(
                {"error": "patient_id is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            patient = Patient.objects.get(patient_id=patient_id)
            
            # Dynamically target the latest registered upcoming camp
            upcoming_camp = MedicalCamp.objects.all().order_by('-id').first()
            if not upcoming_camp:
                return Response(
                    {"error": "No registered medical camps found to send reminders for. Please register a camp first."},
                    status=status.HTTP_404_NOT_FOUND
                )
        except Patient.DoesNotExist:
            return Response({"error": "Patient not found."}, status=status.HTTP_404_NOT_FOUND)

        # Create a new schedule entry pointing to the upcoming camp
        schedule = CallSchedule.objects.create(
            patient=patient,
            camp=upcoming_camp,
            scheduled_time=timezone.now(),
            status='pending'
        )

        service = ReminderService()
        try:
            updated_schedule = service.process_and_generate_audio(schedule.id)
            
            import os
            public_url = os.getenv("PUBLIC_URL")
            if public_url:
                audio_url = public_url.rstrip('/') + updated_schedule.audio_file.url
            else:
                audio_url = request.build_absolute_uri(updated_schedule.audio_file.url)
            
            return Response({
                "status": "success",
                "message": f"Reminder audio generated/reused successfully for upcoming Camp {upcoming_camp.number}",
                "schedule_id": updated_schedule.id,
                "patient_name": patient.patient_name,
                "target_camp_number": upcoming_camp.number,
                "telugu_text": service.generate_telugu_text(
                    upcoming_camp.date.strftime("%d-%m-%Y"),
                    upcoming_camp.venue.name
                ),
                "audio_url": audio_url
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                "status": "error",
                "message": f"Failed to generate audio: {str(e)}",
                "schedule_id": schedule.id
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
