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
            smart_start_url = f"{public_url}/api/voicebot/smart-start/" if public_url else request.build_absolute_uri("/api/voicebot/smart-start/")

            call_status = "Audio generated. Exotel credentials not configured in .env"

            if exotel_sid and exotel_key and exotel_token and exotel_caller_id:
                connect_url = f"https://api.exotel.com/v1/Accounts/{exotel_sid}/Calls/connect.json"
                payload = {
                    "From": patient.contact_no,
                    "CallerId": exotel_caller_id,
                    "Url": exotel_flow_url,  # Points to Exotel App Builder Flow
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
        if clean_phone.startswith('0') and len(clean_phone) > 10:
            clean_phone = clean_phone[1:]
            
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


class SmartStartView(APIView):
    """
    GET /api/voicebot/smart-start/

    Unified ExoML webhook — configure this as the Exotel App Builder 'Passthru' URL.

    When any outbound call connects, Exotel hits this endpoint.
    We detect whether this is a Phase 2 follow-up call (by looking up a
    pending VoiceCall for that phone number) and return the correct ExoML.

    Phase 2 (follow-up call pending) → returns interactive Q1 ExoML
    Phase 1 (camp reminder)          → returns Play + Hangup ExoML
    """
    authentication_classes = []
    permission_classes = []

    def _normalize_phone(self, phone: str) -> str:
        """Strip country codes and leading zeroes to match DB contact_no."""
        phone = phone.strip()
        if phone.startswith('+91'):
            phone = phone[3:]
        elif phone.startswith('91') and len(phone) > 10:
            phone = phone[2:]
        if phone.startswith('0') and len(phone) > 10:
            phone = phone[1:]
        return phone

    def get(self, request):
        from voicebot.models import VoiceCall
        from voicebot.services.followup_service import FollowupCallService

        # Exotel sends the patient's phone as 'From'
        raw_phone   = request.GET.get('From', '')
        clean_phone = self._normalize_phone(raw_phone)
        public_url  = os.getenv("PUBLIC_URL", "").strip().rstrip('/')

        print(f"[SmartStart] Incoming call from: {raw_phone} (cleaned: {clean_phone})")

        # ── Check for a pending Phase 2 VoiceCall for this phone ─────────────
        pending_call = None
        if clean_phone:
            try:
                patient = Patient.objects.filter(
                    contact_no__contains=clean_phone
                ).first()
                if patient:
                    pending_call = VoiceCall.objects.filter(
                        patient=patient,
                        status='in_progress'
                    ).order_by('-started_at').first()
            except Exception as e:
                print(f"[SmartStart] Error looking up VoiceCall: {e}")

        # ── Phase 2: return interactive follow-up ExoML ───────────────────────
        if pending_call:
            print(f"[SmartStart] Phase 2 call detected — VoiceCall id={pending_call.id}")
            service = FollowupCallService()
            xml = service.get_start_exoml(pending_call.id)
            return HttpResponse(xml, content_type='text/xml')

        # ── Phase 1: return camp reminder play + hangup ExoML ─────────────────
        print(f"[SmartStart] Phase 1 call — serving camp reminder audio")
        try:
            reminder = None
            if clean_phone:
                patient = Patient.objects.filter(contact_no__contains=clean_phone).first()
                if patient:
                    upcoming_camp = MedicalCamp.objects.all().order_by('-id').first()
                    if upcoming_camp:
                        reminder = CampVoiceReminder.objects.filter(camp=upcoming_camp).first()

            if not reminder:
                reminder = CampVoiceReminder.objects.order_by('-id').first()

            if reminder and reminder.audio_file:
                audio_url = (public_url + reminder.audio_file.url
                             if public_url
                             else request.build_absolute_uri(reminder.audio_file.url))
                xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>{audio_url}</Play>
    <Hangup/>
</Response>"""
                return HttpResponse(xml, content_type='text/xml')

        except Exception as e:
            print(f"[SmartStart] Phase 1 fallback error: {e}")

        # Final fallback — just hang up gracefully
        return HttpResponse(
            '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>',
            content_type='text/xml'
        )


class ExotelStatusView(APIView):
    """Receives call status updates from Exotel (completed, failed, busy, etc.)."""
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        call_sid = request.data.get('CallSid', 'unknown')
        call_status = request.data.get('Status', 'unknown')
        print(f"[Exotel Status] CallSid={call_sid} Status={call_status}")
        return HttpResponse('OK', content_type='text/plain')


# ─────────────────────────────────────────────────────────────────────────────
# Phase 2 — Lab Test Follow-up Voicebot Views
# ─────────────────────────────────────────────────────────────────────────────

from inventory.models import TestIssue
from voicebot.models import VoiceCall, VoiceResponse
from voicebot.services.followup_service import FollowupCallService
from voicebot.services.stt_service import SarvamSTTService


class TriggerFollowupCallView(APIView):
    """
    POST /api/voicebot/trigger-followup/
    Body: { "test_issue_id": 5 }

    Initiates a lab test follow-up call for a specific TestIssue record.
    Creates a VoiceCall, pre-generates all audio prompts, then places the call.
    """

    def post(self, request):
        test_issue_id = request.data.get("test_issue_id")
        if not test_issue_id:
            return Response({"error": "test_issue_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            test_issue = TestIssue.objects.select_related("test", "camp").get(id=test_issue_id)
        except TestIssue.DoesNotExist:
            return Response({"error": "TestIssue not found."}, status=status.HTTP_404_NOT_FOUND)

        # Look up the Patient object using the integer patient_id stored on TestIssue
        try:
            from inventory.models import Patient
            patient = Patient.objects.get(patient_id=test_issue.patient_id)
        except Patient.DoesNotExist:
            return Response({"error": "Patient not found for this TestIssue."}, status=status.HTTP_404_NOT_FOUND)

        if not patient.contact_no:
            return Response({"error": "Patient has no contact number."}, status=status.HTTP_400_BAD_REQUEST)

        # Create the VoiceCall record
        voice_call = VoiceCall.objects.create(
            patient    = patient,
            test_issue = test_issue,
            call_type  = "lab_followup",
            status     = "pending",
        )

        service = FollowupCallService()

        # Pre-generate all audio prompts (cached to disk for speed)
        try:
            service.ensure_audio_files()
        except Exception as e:
            print(f"[TriggerFollowup] Audio generation warning: {e}")

        # Place the Exotel call
        result = service.trigger_followup_call(voice_call)

        if result["success"]:
            return Response({
                "status":        "success",
                "voice_call_id": voice_call.id,
                "call_sid":      result.get("call_sid"),
                "patient_name":  patient.patient_name,
                "test_name":     test_issue.test.name,
                "message":       result["message"],
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                "status":  "error",
                "message": result["message"],
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class FollowupStartView(APIView):
    """
    GET /api/voicebot/followup-start/?call_id=<id>

    Exotel calls this URL the moment the patient picks up.
    Returns ExoML that plays Question 1 and starts recording the response.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        call_id = request.GET.get("call_id")
        if not call_id:
            return HttpResponse("<Response><Hangup/></Response>", content_type="text/xml")

        try:
            voice_call = VoiceCall.objects.get(id=call_id)
        except VoiceCall.DoesNotExist:
            return HttpResponse("<Response><Hangup/></Response>", content_type="text/xml")

        service = FollowupCallService()
        xml = service.get_start_exoml(voice_call.id)
        return HttpResponse(xml, content_type="text/xml")


class FollowupResponseView(APIView):
    """
    POST /api/voicebot/followup-response/
         ?call_id=<id>&question=<Q1_TESTS_DONE|Q2_REPORT_RECEIVED>&attempt=<1-3>

    Exotel POSTs here after recording the patient's spoken response.
    We download the recording, run STT, classify the intent, save to DB,
    then return the next ExoML instruction for the call to continue.
    """
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        call_id      = request.GET.get("call_id")
        question_key = request.GET.get("question", "Q1_TESTS_DONE")
        attempt      = int(request.GET.get("attempt", 1))

        # Exotel sends the recording URL in the POST body as 'RecordingUrl'
        recording_url = request.POST.get("RecordingUrl", "")

        print(f"[FollowupResponse] call_id={call_id}, Q={question_key}, attempt={attempt}")
        print(f"[FollowupResponse] RecordingUrl={recording_url}")

        # Fallback XML in case anything goes wrong
        hangup_xml = "<Response><Hangup/></Response>"

        if not call_id:
            return HttpResponse(hangup_xml, content_type="text/xml")

        try:
            voice_call = VoiceCall.objects.get(id=call_id)
        except VoiceCall.DoesNotExist:
            return HttpResponse(hangup_xml, content_type="text/xml")

        # Step 1: Convert recorded audio to Telugu text via Sarvam STT
        transcript = ""
        if recording_url:
            stt = SarvamSTTService()
            transcript = stt.transcribe_from_url(recording_url)

        # Step 2: Run state machine (classify intent, save, decide next step)
        service = FollowupCallService()
        xml = service.handle_response(
            voice_call_id = voice_call.id,
            question_key  = question_key,
            attempt       = attempt,
            transcript    = transcript,
        )
        return HttpResponse(xml, content_type="text/xml")


class FollowupStatusView(APIView):
    """
    POST /api/voicebot/followup-status/?call_id=<id>

    Exotel calls this webhook when the overall call status changes
    (e.g. completed, no-answer, busy, failed).
    We update the VoiceCall status accordingly.
    """
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        call_id     = request.GET.get("call_id")
        call_status = request.POST.get("Status", "").lower()
        call_sid    = request.POST.get("CallSid", "")

        print(f"[FollowupStatus] call_id={call_id}, Status={call_status}, SID={call_sid}")

        if call_id:
            try:
                voice_call = VoiceCall.objects.get(id=call_id)

                if call_status in ("no-answer", "busy", "failed", "canceled"):
                    voice_call.status = "failed" if call_status == "failed" else "unanswered"
                    voice_call.completed_at = timezone.now()
                    voice_call.save()
                # Do NOT mark it completed here. The state machine (handle_response)
                # will set the status to 'completed' when the Q&A ends.
            except VoiceCall.DoesNotExist:
                pass

        return HttpResponse("OK", content_type="text/plain")


class GetPendingFollowupsView(APIView):
    """
    GET /api/voicebot/pending-followups/

    Returns a list of patients who have pending lab tests (reports_issued=False).
    Used by the frontend to show which patients need a follow-up call.
    """

    def get(self, request):
        pending = TestIssue.objects.filter(
            reports_issued=False
        ).select_related("test", "camp")

        data = []
        for ti in pending:
            # Attempt to get patient info
            from inventory.models import Patient
            try:
                patient = Patient.objects.get(patient_id=ti.patient_id)
                patient_name   = patient.patient_name or "Unknown"
                patient_phone  = patient.contact_no or ""
            except Patient.DoesNotExist:
                patient_name  = "Unknown"
                patient_phone = ""

            # Check if a follow-up call has already been placed
            last_call = VoiceCall.objects.filter(test_issue=ti).order_by("-started_at").first()

            data.append({
                "test_issue_id":  ti.id,
                "patient_id":     ti.patient_id,
                "patient_name":   patient_name,
                "patient_phone":  patient_phone,
                "test_name":      ti.test.name,
                "camp_number":    ti.camp.number,
                "last_call_status": last_call.status if last_call else None,
                "last_call_id":     last_call.id if last_call else None,
            })

        return Response({"pending_followups": data, "total": len(data)})

