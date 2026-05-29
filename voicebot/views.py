import os
import requests
from django.utils import timezone
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from inventory.models import Patient, MedicalCamp
from voicebot.models import CallSchedule, CampVoiceReminder
from voicebot.services.reminder_service import ReminderService


class TriggerTestReminderView(APIView):
    def post(self, request):
        """
        API to manually trigger Telugu voice reminder audio generation and place outbound call via Exotel.
        Uses ExoML Play approach - passes the Django ExoML endpoint directly as the call URL,
        so Exotel fetches our XML and plays the audio file properly.
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

            # Formulate the public audio URL
            public_url = os.getenv("PUBLIC_URL", "").strip().rstrip('/')
            if public_url:
                audio_url = public_url + updated_schedule.audio_file.url
            else:
                audio_url = request.build_absolute_uri(updated_schedule.audio_file.url)

            # Build the ExoML play URL - Exotel will call this and get XML instructions
            if public_url:
                exoml_url = f"{public_url}/api/voicebot/exotel-play/?camp_id={upcoming_camp.id}"
            else:
                exoml_url = request.build_absolute_uri(f"/api/voicebot/exotel-play/?camp_id={upcoming_camp.id}")

            # Trigger outbound call via Exotel
            exotel_sid = os.getenv("EXOTEL_ACCOUNT_SID", "").strip()
            exotel_key = os.getenv("EXOTEL_API_KEY", "").strip()
            exotel_token = os.getenv("EXOTEL_API_TOKEN", "").strip()
            exotel_caller_id = os.getenv("EXOTEL_CALLER_ID", "").strip()

            call_status = "Audio generated. Exotel credentials not configured in .env"

            if exotel_sid and exotel_key and exotel_token and exotel_caller_id:
                connect_url = f"https://api.exotel.com/v1/Accounts/{exotel_sid}/Calls/connect.json"
                payload = {
                    "From": patient.contact_no,
                    "CallerId": exotel_caller_id,
                    "Url": exoml_url,          # Points to our ExoML endpoint
                    "CallType": "trans",
                    "TimeOut": 30,
                    "StatusCallback": f"{public_url}/api/voicebot/exotel-status/" if public_url else "",
                }

                try:
                    response = requests.post(
                        connect_url,
                        auth=(exotel_key, exotel_token),
                        data=payload,
                        timeout=10
                    )
                    if response.status_code == 200:
                        call_status = "Exotel call triggered successfully!"
                        schedule.status = 'triggered'
                        schedule.save()
                    else:
                        call_status = f"Exotel API error {response.status_code}: {response.text}"
                        schedule.status = 'failed'
                        schedule.save()
                except Exception as call_err:
                    call_status = f"Failed to connect to Exotel: {str(call_err)}"
                    schedule.status = 'failed'
                    schedule.save()

            return Response({
                "status": "success",
                "message": f"Reminder processed for Camp {upcoming_camp.number}. Status: {call_status}",
                "schedule_id": updated_schedule.id,
                "patient_name": patient.patient_name,
                "target_camp_number": upcoming_camp.number,
                "audio_url": audio_url,
                "exoml_url": exoml_url,
                "exotel_status": call_status
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                "status": "error",
                "message": f"Failed to process reminder: {str(e)}",
                "schedule_id": schedule.id
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ExotelPlayXMLView(APIView):
    """
    ExoML endpoint — Exotel calls this URL when the patient picks up the phone.
    Returns XML with <Play> instruction so Exotel downloads and plays the WAV file directly.
    This is the correct approach for playing pre-recorded audio on Exotel calls.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        camp_id = request.GET.get('camp_id')
        public_url = os.getenv("PUBLIC_URL", "").strip().rstrip('/')

        try:
            # Get the audio file for the specific camp
            if camp_id:
                reminder = CampVoiceReminder.objects.filter(camp__id=camp_id).first()
            else:
                reminder = None

            # Fallback to latest reminder if camp_id not found
            if not reminder or not reminder.audio_file:
                reminder = CampVoiceReminder.objects.order_by('-id').first()

            if reminder and reminder.audio_file:
                if public_url:
                    audio_url = public_url + reminder.audio_file.url
                else:
                    audio_url = request.build_absolute_uri(reminder.audio_file.url)

                print(f"[ExoML] Playing audio: {audio_url}")

                xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>{audio_url}</Play>
    <Hangup/>
</Response>"""
                return HttpResponse(xml, content_type='text/xml')

            # No audio found — hang up gracefully
            xml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Hangup/>
</Response>"""
            return HttpResponse(xml, content_type='text/xml', status=200)

        except Exception as e:
            print(f"[ExoML] Error: {e}")
            xml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Hangup/>
</Response>"""
            return HttpResponse(xml, content_type='text/xml', status=200)


class ExotelCallbackView(APIView):
    """Legacy callback — kept for inbound call flow (user calls Exotel number)."""
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        upcoming_camp = MedicalCamp.objects.all().order_by('-id').first()
        public_url = os.getenv("PUBLIC_URL", "").strip().rstrip('/')

        try:
            if upcoming_camp:
                reminder = CampVoiceReminder.objects.filter(camp=upcoming_camp).first()
                if reminder and reminder.audio_file:
                    if public_url:
                        audio_url = public_url + reminder.audio_file.url
                    else:
                        audio_url = request.build_absolute_uri(reminder.audio_file.url)

                    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>{audio_url}</Play>
    <Hangup/>
</Response>"""
                    return HttpResponse(xml, content_type='text/xml')

            xml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Hangup/>
</Response>"""
            return HttpResponse(xml, content_type='text/xml')

        except Exception as e:
            return HttpResponse(f"Error: {str(e)}", content_type='text/plain', status=500)
