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
            
            # Formulate the absolute media URL (respecting PUBLIC_URL env variable if present)
            public_url = os.getenv("PUBLIC_URL")
            if public_url:
                audio_url = public_url.rstrip('/') + updated_schedule.audio_file.url
            else:
                audio_url = request.build_absolute_uri(updated_schedule.audio_file.url)
            
            # Trigger outbound call via Exotel if configured
            exotel_sid = os.getenv("EXOTEL_ACCOUNT_SID")
            exotel_key = os.getenv("EXOTEL_API_KEY")
            exotel_token = os.getenv("EXOTEL_API_TOKEN")
            exotel_caller_id = os.getenv("EXOTEL_CALLER_ID")
            exotel_flow_url = os.getenv("EXOTEL_FLOW_URL")
            
            call_status = "Audio generated. Exotel credentials not configured in .env"
            
            if exotel_sid and exotel_key and exotel_token and exotel_caller_id and exotel_flow_url:
                connect_url = f"https://api.exotel.com/v1/Accounts/{exotel_sid}/Calls/connect.json"
                payload = {
                    "From": patient.contact_no,
                    "CallerId": exotel_caller_id,
                    "Url": exotel_flow_url,
                    "CallType": "trans"
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
                        call_status = f"Exotel API error: {response.text}"
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
                "exotel_status": call_status
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                "status": "error",
                "message": f"Failed to process reminder: {str(e)}",
                "schedule_id": schedule.id
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ExotelCallbackView(APIView):
    def get(self, request):
        """
        Callback endpoint for Exotel Greeting applet (set to 'Read from URL').
        Returns the raw audio URL in plain text format.
        """
        patient_phone = request.GET.get('From', '')
        
        # Normalize/clean phone number to match database
        clean_phone = patient_phone
        if clean_phone.startswith('+91'):
            clean_phone = clean_phone[3:]
        elif clean_phone.startswith('91') and len(clean_phone) > 10:
            clean_phone = clean_phone[2:]
            
        try:
            # Search for patient
            patient = Patient.objects.filter(contact_no__contains=clean_phone).first()
            upcoming_camp = MedicalCamp.objects.all().order_by('-id').first()
            
            # Fetch corresponding generated audio reminder
            if upcoming_camp:
                reminder = CampVoiceReminder.objects.filter(camp=upcoming_camp).first()
                if reminder and reminder.audio_file:
                    public_url = os.getenv("PUBLIC_URL")
                    if public_url:
                        audio_url = public_url.rstrip('/') + reminder.audio_file.url
                    else:
                        audio_url = request.build_absolute_uri(reminder.audio_file.url)
                    return HttpResponse(audio_url, content_type='text/plain')
            
            # Fallback to latest audio reminder generated
            latest_reminder = CampVoiceReminder.objects.order_by('-id').first()
            if latest_reminder and latest_reminder.audio_file:
                public_url = os.getenv("PUBLIC_URL")
                if public_url:
                    audio_url = public_url.rstrip('/') + latest_reminder.audio_file.url
                else:
                    audio_url = request.build_absolute_uri(latest_reminder.audio_file.url)
                return HttpResponse(audio_url, content_type='text/plain')
                
            return HttpResponse("Error: No reminders generated", content_type='text/plain', status=404)
            
        except Exception as e:
            return HttpResponse(f"Error: {str(e)}", content_type='text/plain', status=500)
