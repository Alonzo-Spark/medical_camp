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
        Trigger Telugu voice reminder generation and place outbound call via Exotel.
        Uses Exotel's App Builder Flow URL — passes EXOTEL_FLOW_URL as the call URL,
        which executes the Exotel dashboard flow (which calls our exotel-callback/ to play audio).
        """
        patient_id = request.data.get("patient_id")

        if not patient_id:
            return Response(
                {"error": "patient_id is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            patient = Patient.objects.get(patient_id=patient_id)
            upcoming_camp = MedicalCamp.objects.all().order_by('-id').first()
            if not upcoming_camp:
                return Response(
                    {"error": "No registered medical camps found. Please register a camp first."},
                    status=status.HTTP_404_NOT_FOUND
                )
        except Patient.DoesNotExist:
            return Response({"error": "Patient not found."}, status=status.HTTP_404_NOT_FOUND)

        schedule = CallSchedule.objects.create(
            patient=patient,
            camp=upcoming_camp,
            scheduled_time=timezone.now(),
            status='pending'
        )

        service = ReminderService()
        try:
            updated_schedule = service.process_and_generate_audio(schedule.id)

            public_url = os.getenv("PUBLIC_URL", "").strip().rstrip('/')
            if public_url:
                audio_url = public_url + updated_schedule.audio_file.url
            else:
                audio_url = request.build_absolute_uri(updated_schedule.audio_file.url)

            exotel_sid = os.getenv("EXOTEL_ACCOUNT_SID", "").strip()
            exotel_key = os.getenv("EXOTEL_API_KEY", "").strip()
            exotel_token = os.getenv("EXOTEL_API_TOKEN", "").strip()
            exotel_caller_id = os.getenv("EXOTEL_CALLER_ID", "").strip()
            exotel_flow_url = os.getenv("EXOTEL_FLOW_URL", "").strip()

            call_status = "Audio generated. Exotel credentials not configured in .env"

            if exotel_sid and exotel_key and exotel_token and exotel_caller_id and exotel_flow_url:
                connect_url = f"https://api.exotel.com/v1/Accounts/{exotel_sid}/Calls/connect.json"
                payload = {
                    "From": patient.contact_no,
                    "CallerId": exotel_caller_id,
                    "Url": exotel_flow_url,  # Points to Exotel App Flow ID 1256480
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
                        updated_schedule.status = 'triggered'
                        updated_schedule.save()
                    else:
                        call_status = f"Exotel API error {response.status_code}: {response.text}"
                        updated_schedule.status = 'failed'
                        updated_schedule.save()
                except Exception as call_err:
                    call_status = f"Failed to connect to Exotel: {str(call_err)}"
                    updated_schedule.status = 'failed'
                    updated_schedule.save()

            return Response({
                "status": "success",
                "message": f"Reminder processed for Camp {upcoming_camp.number}. Status: {call_status}",
                "schedule_id": updated_schedule.id,
                "patient_name": patient.patient_name,
                "target_camp_number": upcoming_camp.number,
                "audio_url": audio_url,
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
    ExoML endpoint — used only if connecting using custom XML.
    Returns XML with <Play> so Exotel downloads and plays the WAV file directly.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        camp_id = request.GET.get('camp_id')
        public_url = os.getenv("PUBLIC_URL", "").strip().rstrip('/')

        try:
            reminder = None
            if camp_id:
                reminder = CampVoiceReminder.objects.filter(camp__id=camp_id).first()
            if not reminder or not reminder.audio_file:
                reminder = CampVoiceReminder.objects.order_by('-id').first()

            if reminder and reminder.audio_file:
                if public_url:
                    audio_url = public_url + reminder.audio_file.url
                else:
                    audio_url = request.build_absolute_uri(reminder.audio_file.url)

                print(f"[ExoML Play] Serving audio: {audio_url}")
                xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>{audio_url}</Play>
    <Hangup/>
</Response>"""
                return HttpResponse(xml, content_type='text/xml')

        except Exception as e:
            print(f"[ExoML Play] Error: {e}")

        xml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Hangup/>
</Response>"""
        return HttpResponse(xml, content_type='text/xml')


class ExotelCallbackView(APIView):
    """
    Callback endpoint for Exotel Greeting applet (set to 'Read from URL' / 'Read Text').
    Returns the raw audio URL in plain text format so Exotel can download and play it.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        patient_phone = request.GET.get('From', '')
        
        # Normalize/clean phone number to match database
        clean_phone = patient_phone
        if clean_phone.startswith('+91'):
            clean_phone = clean_phone[3:]
        elif clean_phone.startswith('91') and len(clean_phone) > 10:
            clean_phone = clean_phone[2:]
            
        try:
            # Try to find the patient and their upcoming camp voice reminder
            if clean_phone:
                patient = Patient.objects.filter(contact_no__contains=clean_phone).first()
                if patient:
                    upcoming_camp = MedicalCamp.objects.all().order_by('-id').first()
                    if upcoming_camp:
                        reminder = CampVoiceReminder.objects.filter(camp=upcoming_camp).first()
                        if reminder and reminder.audio_file:
                            public_url = os.getenv("PUBLIC_URL", "").strip().rstrip('/')
                            if public_url:
                                audio_url = public_url + reminder.audio_file.url
                            else:
                                audio_url = request.build_absolute_uri(reminder.audio_file.url)
                            print(f"[Exotel Callback] Serving patient-specific audio: {audio_url}")
                            return HttpResponse(audio_url, content_type='text/plain')

            # Fallback to latest audio reminder generated
            latest_reminder = CampVoiceReminder.objects.order_by('-id').first()
            if latest_reminder and latest_reminder.audio_file:
                public_url = os.getenv("PUBLIC_URL", "").strip().rstrip('/')
                if public_url:
                    audio_url = public_url + latest_reminder.audio_file.url
                else:
                    audio_url = request.build_absolute_uri(latest_reminder.audio_file.url)
                print(f"[Exotel Callback] Serving latest fallback audio: {audio_url}")
                return HttpResponse(audio_url, content_type='text/plain')
                
            return HttpResponse("Error: No reminders generated", content_type='text/plain', status=404)
            
        except Exception as e:
            print(f"[Exotel Callback] Error: {e}")
            return HttpResponse(f"Error: {str(e)}", content_type='text/plain', status=500)


class ExotelStatusView(APIView):
    """Receives call status updates from Exotel (completed, failed, busy, etc.)."""
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        call_sid = request.data.get('CallSid', 'unknown')
        call_status = request.data.get('Status', 'unknown')
        print(f"[Exotel Status] CallSid={call_sid} Status={call_status}")
        return HttpResponse('OK', content_type='text/plain')
