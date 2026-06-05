import os
import requests
from django.utils import timezone
from django.http import HttpResponse, HttpResponseRedirect
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
            exotel_flow_url = (os.getenv("EXOTEL_REMINDER_FLOW_URL") or os.getenv("EXOTEL_FLOW_URL", "")).strip()
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

    Phase 1 (camp reminder) → returns Play + Hangup ExoML
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

    def post(self, request):
        return self.get(request)

    def get(self, request):
        # Exotel sends the patient's phone as 'From' or 'CallFrom'
        raw_phone   = request.GET.get('From') or request.GET.get('CallFrom') or request.POST.get('From') or request.POST.get('CallFrom') or ''
        call_sid    = request.GET.get('CallSid') or request.POST.get('CallSid')
        clean_phone = self._normalize_phone(raw_phone)
        public_url  = os.getenv("PUBLIC_URL", "").strip().rstrip('/')

        print(f"[SmartStart] Incoming call sid={call_sid} from: {raw_phone} (cleaned: {clean_phone})")

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
# Phase 2 — Lab Test Follow-up Voicebot Webhooks (Linear App Builder Flow)
# ─────────────────────────────────────────────────────────────────────────────
from voicebot.models import VoiceCall, VoiceResponse
from voicebot.services.stt_service import SarvamSTTService
from voicebot.services.intent_service import IntentService
from django.utils import timezone

def _wait_for_recording_ready(url, max_wait_seconds=300):
    """
    Polls the Exotel recording URL until it is ready (returns HTTP 200 with audio content).
    Checks every 5 seconds, up to max_wait_seconds.
    """
    import time
    import requests
    import os
    if not url:
        return False
    exotel_key = os.getenv("EXOTEL_API_KEY")
    exotel_token = os.getenv("EXOTEL_API_TOKEN")
    start_time = time.time()
    while time.time() - start_time < max_wait_seconds:
        try:
            resp = requests.get(url, auth=(exotel_key, exotel_token), timeout=5, stream=True)
            if resp.status_code == 200:
                content_length = int(resp.headers.get('Content-Length', 0))
                content_type = resp.headers.get('Content-Type', '')
                if 'audio' in content_type.lower() or content_length > 1000:
                    resp.close()
                    time.sleep(3)  # extra safety delay to make sure file is flushed
                    return True
            resp.close()
        except Exception:
            pass
        time.sleep(5)
    return False


class BaseLabTestWebhookView(APIView):
    authentication_classes = []
    permission_classes = []
    
    def get(self, request):
        return self.post(request)
        
    def _get_voice_call(self, request):
        # CustomField = VoiceCall.id — most reliable identifier Exotel sends
        custom_field = request.POST.get("CustomField") or request.GET.get("CustomField")
        call_sid     = request.POST.get("CallSid")     or request.GET.get("CallSid")
        raw_phone    = request.POST.get("From")        or request.GET.get("From") or ""

        print(f"[Webhook] CustomField={custom_field} CallSid={call_sid} From={raw_phone}")

        voice_call = None

        # 1. Try by VoiceCall.id (CustomField) — most reliable
        if custom_field:
            try:
                voice_call = VoiceCall.objects.get(id=int(custom_field))
                print(f"[Webhook] Found VoiceCall by CustomField: {voice_call.id}")
                # Update call_sid if not set yet (Exotel uses a different SID in webhooks)
                if call_sid and not voice_call.call_sid:
                    voice_call.call_sid = call_sid
                    voice_call.save(update_fields=["call_sid"])
                return voice_call
            except (VoiceCall.DoesNotExist, ValueError):
                print(f"[Webhook] No VoiceCall found for CustomField={custom_field}")

        # 2. Try by call_sid
        if call_sid:
            voice_call = VoiceCall.objects.filter(call_sid=call_sid).first()
            if voice_call:
                print(f"[Webhook] Found VoiceCall by CallSid")
                return voice_call

        # 3. Fallback: most recent pending/in-progress call for this phone
        clean_phone = raw_phone.strip()
        if clean_phone.startswith('+91'):   clean_phone = clean_phone[3:]
        elif clean_phone.startswith('91') and len(clean_phone) > 10: clean_phone = clean_phone[2:]
        if clean_phone.startswith('0') and len(clean_phone) > 10: clean_phone = clean_phone[1:]

        if clean_phone:
            voice_call = VoiceCall.objects.filter(
                patient__contact_no__contains=clean_phone,
            ).order_by('-started_at').first()
            if voice_call:
                print(f"[Webhook] Found VoiceCall by phone fallback: {voice_call.id}")
                if call_sid and not voice_call.call_sid:
                    voice_call.call_sid = call_sid
                    voice_call.save(update_fields=["call_sid"])
                return voice_call

        # 4. Final fallback: find the most recent in-progress/pending VoiceCall
        voice_call = VoiceCall.objects.filter(status__in=["in_progress", "pending"]).order_by('-started_at').first()
        if voice_call:
            print(f"[Webhook] Found VoiceCall by active in_progress fallback: {voice_call.id}")
            if call_sid and not voice_call.call_sid:
                voice_call.call_sid = call_sid
                voice_call.save(update_fields=["call_sid"])
            return voice_call

        print("[Webhook] Could not find any VoiceCall.")
        return None



class LabTestQuestion1View(BaseLabTestWebhookView):
    """
    GET /api/voicebot/lab-test/question1/
    Processes the recording in a background thread to prevent Exotel timeout/hangup.
    """
    def post(self, request):
        voice_call = self._get_voice_call(request)
        if not voice_call:
            print("[Q1] VoiceCall not found — returning OK anyway to keep call alive.")
            return HttpResponse("OK", content_type="text/plain", status=200)

        recording_url = request.POST.get("RecordingUrl") or request.GET.get("RecordingUrl") or ""
        print(f"[Q1] URL={recording_url} — starting background check.")

        # Update status to in_progress (do not mark completed yet!)
        voice_call.status = "in_progress"
        voice_call.save(update_fields=["status"])

        import threading
        threading.Thread(
            target=self._process_q1_bg,
            args=(voice_call.id, recording_url),
            daemon=True
        ).start()

        return HttpResponse("OK", content_type="text/plain", status=200)

    def _process_q1_bg(self, voice_call_id, recording_url):
        try:
            from voicebot.models import VoiceCall, VoiceResponse
            from voicebot.services.stt_service import SarvamSTTService
            from voicebot.services.intent_service import IntentService
            from inventory.models import TestIssue
            
            vc = VoiceCall.objects.get(id=voice_call_id)
            is_ready = _wait_for_recording_ready(recording_url)
            if is_ready:
                patient = vc.patient
                
                # pyrefly: ignore [missing-attribute]
                test_issues = TestIssue.objects.filter(
                    patient_id=patient.patient_id,
                    camp=vc.test_issue.camp,
                    reports_issued=False
                )
                test_names = [ti.test.name for ti in test_issues]
                
                transcript = SarvamSTTService().transcribe_from_url(recording_url)
                test_statuses = IntentService().classify_multi_test_q1(transcript, test_names)
                
                if not test_statuses:
                    intent = "UNCLEAR"
                elif all(test_statuses.values()):
                    intent = "YES"
                elif any(test_statuses.values()):
                    intent = "YES"
                else:
                    intent = "NO"
                
                # Update all test statuses based on classification
                for ti in test_issues:
                    ti_name = ti.test.name
                    status_done = test_statuses.get(ti_name, False)
                    ti.test_done = status_done
                    ti.save(update_fields=["test_done"])
                    print(f"[Q1 BG] Set test_done={status_done} for TestIssue {ti.id} ({ti_name})")
                
                # pyrefly: ignore [missing-attribute]
                VoiceResponse.objects.create(
                    voice_call=vc, question="Q1_TESTS_DONE",
                    transcript=f"{transcript} [Detailed Statuses: {test_statuses}]", 
                    intent=intent, confidence_score=0.85
                )
                print(f"[Q1 BG] Saved — intent={intent} transcript='{transcript}' statuses={test_statuses}")
            else:
                print(f"[Q1 BG] Recording was not ready within timeout. Skipping transcription.")
            
        except Exception as ex:
            print(f"[Q1 BG] Error: {ex}")


class LabTestQuestion2View(BaseLabTestWebhookView):
    """
    GET /api/voicebot/lab-test/question2/
    Same pattern — 200 immediately, STT processed in background after 5.5 min.
    """
    def post(self, request):
        voice_call = self._get_voice_call(request)
        if not voice_call:
            return HttpResponse("OK", content_type="text/plain", status=200)

        recording_url = request.POST.get("RecordingUrl") or request.GET.get("RecordingUrl") or ""
        print(f"[Q2] URL={recording_url} — queuing background STT in 5.5 min.")

        import threading
        def _process(vc_id, url):
            _wait_for_recording_ready(url)
            try:
                from voicebot.models import VoiceCall, VoiceResponse
                from voicebot.services.stt_service import SarvamSTTService
                from voicebot.services.intent_service import IntentService
                from inventory.models import TestIssue
                from django.utils import timezone
                
                # pyrefly: ignore [missing-attribute]
                vc = VoiceCall.objects.get(id=vc_id)
                patient = vc.patient
                
                # pyrefly: ignore [missing-attribute]
                test_issues = TestIssue.objects.filter(
                    patient_id=patient.patient_id,
                    camp=vc.test_issue.camp,
                    reports_issued=False
                )
                test_names = [ti.test.name for ti in test_issues]
                
                transcript = SarvamSTTService().transcribe_from_url(url) if url else ""
                test_statuses = IntentService().classify_multi_test_q2(transcript, test_names)
                
                if not test_statuses:
                    intent = "UNCLEAR"
                elif all(test_statuses.values()):
                    intent = "REPORT_RECEIVED"
                elif any(test_statuses.values()):
                    intent = "REPORT_RECEIVED"
                else:
                    intent = "REPORT_NOT_RECEIVED"
                
                # pyrefly: ignore [missing-attribute]
                VoiceResponse.objects.create(
                    voice_call=vc, question="Q2_REPORT_RECEIVED",
                    transcript=f"{transcript} [Detailed Statuses: {test_statuses}]",
                    intent=intent, confidence_score=0.85
                )
                print(f"[Q2 BG] Saved — intent={intent} transcript='{transcript}' statuses={test_statuses}")
                
                # Check off only the reports that were received (which also implies tests are done)
                for ti in test_issues:
                    ti_name = ti.test.name
                    if test_statuses.get(ti_name, False):
                        ti.reports_issued = True
                        ti.test_done = True
                        ti.save(update_fields=["reports_issued", "test_done"])
                        print(f"[Q2 BG] Auto-checked reports_issued & test_done for TestIssue {ti.id} ({ti_name})")
                        
                vc.status = "completed"
                vc.completed_at = timezone.now()
                vc.save(update_fields=["status", "completed_at"])
            except Exception as ex:
                print(f"[Q2 BG] Error: {ex}")

        threading.Thread(target=_process, args=(voice_call.id, recording_url), daemon=True).start()
        return HttpResponse("OK", content_type="text/plain", status=200)


class CallStatusView(APIView):
    """
    POST /api/voicebot/call-status/
    Track call completion, failure, busy, unanswered
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return self.post(request)

    def post(self, request):
        call_sid     = request.POST.get("CallSid")     or request.GET.get("CallSid")     or ""
        custom_field = request.POST.get("CustomField") or request.GET.get("CustomField") or ""
        status_val   = (request.POST.get("Status") or request.GET.get("Status") or "").lower()

        voice_call = None
        # Prefer CustomField (VoiceCall.id) lookup
        if custom_field:
            try:
                voice_call = VoiceCall.objects.get(id=int(custom_field))
            except (VoiceCall.DoesNotExist, ValueError):
                pass
        # Fallback to call_sid
        if not voice_call and call_sid:
            voice_call = VoiceCall.objects.filter(call_sid=call_sid).first()

        if voice_call:
            if status_val in ("completed", "answered"):
                if voice_call.status != "failed":
                    voice_call.status = "completed"
            elif status_val in ("no-answer", "busy", "failed", "canceled"):
                voice_call.status = "unanswered" if status_val in ("no-answer", "busy") else "failed"
            voice_call.completed_at = timezone.now()
            voice_call.save()

        return HttpResponse("OK", content_type="text/plain")

class AskQ1View(APIView):
    authentication_classes = []
    permission_classes = []
    def get(self, request):
        custom_field = request.GET.get("CustomField") or request.POST.get("CustomField") or ""
        public_url = os.getenv("PUBLIC_URL", "").rstrip('/')
        if not public_url:
            public_url = request.build_absolute_uri('/')[:-1]
            
        if custom_field.isdigit():
            dynamic_file = f"media/voicebot_prompts/dynamic/q1_{custom_field}.wav"
            if os.path.exists(dynamic_file) and os.path.getsize(dynamic_file) > 0:
                print(f"[Ask Q1] Serving dynamic audio: {dynamic_file}")
                return HttpResponse(f"{public_url}/{dynamic_file}", content_type="text/plain")
                
        audio_path = "media/voicebot_prompts/followup_q1.wav"
        if not os.path.exists(audio_path) or os.path.getsize(audio_path) == 0:
            try:
                from voicebot.services.tts_service import SarvamTTSService
                tts = SarvamTTSService()
                q1_fallback_text = "నమస్కారం, మేము సీ సీ సీ మెడికల్ క్యాంప్ నుండి మాట్లాడుతున్నాము. మీకు సూచించిన ల్యాబ్ పరీక్షలు చేయించుకున్నారా?"
                audio_file = tts.synthesize_telugu(q1_fallback_text)
                os.makedirs(os.path.dirname(audio_path), exist_ok=True)
                with open(audio_path, "wb") as f:
                    f.write(audio_file.read())
                print(f"[Ask Q1] Successfully pre-generated fallback {audio_path}")
            except Exception as e:
                print(f"[Ask Q1] Fallback audio generation failed: {e}")

        audio_url = f"{public_url}/{audio_path}"
        return HttpResponse(audio_url, content_type="text/plain")

class AskQ2View(BaseLabTestWebhookView):
    def get(self, request):
        voice_call = self._get_voice_call(request)
        public_url = os.getenv("PUBLIC_URL", "").rstrip('/')
        if not public_url:
            public_url = request.build_absolute_uri('/')[:-1]

        os.makedirs("media/voicebot_prompts", exist_ok=True)
        s1_path = "media/voicebot_prompts/scenario1.wav"
        s2_path = "media/voicebot_prompts/scenario2.wav"
        s3_path = "media/voicebot_prompts/scenario3.wav"

        # Check all tests status for this voice call
        completed_all = False
        completed_none = False
        if voice_call:
            # Wait for the background thread to finish updating the database for Q1 (max 6s)
            import time
            from voicebot.models import VoiceResponse
            start_wait = time.time()
            while time.time() - start_wait < 6.0:
                if VoiceResponse.objects.filter(voice_call=voice_call, question="Q1_TESTS_DONE").exists():
                    break
                time.sleep(0.5)

            from inventory.models import TestIssue
            # Check if all issued tests are done
            # pyrefly: ignore [missing-attribute]
            test_issues = TestIssue.objects.filter(
                patient_id=voice_call.patient.patient_id,
                camp=voice_call.test_issue.camp
            )
            total_tests = test_issues.count()
            completed_tests = test_issues.filter(test_done=True).count()
            if total_tests > 0:
                if completed_tests == total_tests:
                    completed_all = True
                elif completed_tests == 0:
                    completed_none = True

        if completed_all:
            target_file = s2_path
        elif completed_none:
            target_file = s3_path
        else:
            target_file = s1_path
        
        # One-time generation if the file doesn't exist yet or is empty
        if not os.path.exists(target_file) or os.path.getsize(target_file) == 0:
            try:
                from voicebot.services.tts_service import SarvamTTSService
                tts = SarvamTTSService()
                if completed_all:
                    s2_text = "వచ్చే నెల మొదటి ఆదివారం జరిగే తదుపరి క్యాంప్‌లో పరీక్షల రిపోర్టులను తీసుకోండి."
                    audio_file = tts.synthesize_telugu(s2_text)
                elif completed_none:
                    s3_text = "దయచేసి వచ్చే నెల మొదటి ఆదివారం జరిగే తదుపరి క్యాంప్‌లో పరీక్షలు చేయించుకోండి."
                    audio_file = tts.synthesize_telugu(s3_text)
                else:
                    s1_text = "దయచేసి వచ్చే నెల మొదటి ఆదివారం జరిగే తదుపరి క్యాంప్ ముందే మిగిలిన పరీక్షలు చేయించుకోండి."
                    audio_file = tts.synthesize_telugu(s1_text)
                
                with open(target_file, "wb") as f:
                    f.write(audio_file.read())
                print(f"[Ask Q2] Successfully performed one-time generation for {target_file}")
            except Exception as e:
                print(f"[Ask Q2] Failed one-time generation: {e}")
                # Fallback to general thank you
                return HttpResponseRedirect(f"{public_url}/media/voicebot_prompts/followup_thankyou.wav")

        return HttpResponseRedirect(f"{public_url}/{target_file}")

class ThankYouView(APIView):
    authentication_classes = []
    permission_classes = []
    def get(self, request):
        public_url = os.getenv("PUBLIC_URL", "").rstrip('/')
        if not public_url:
            public_url = request.build_absolute_uri('/')[:-1]
        
        audio_path = "media/voicebot_prompts/followup_thankyou.wav"
        if not os.path.exists(audio_path) or os.path.getsize(audio_path) == 0:
            try:
                from voicebot.services.tts_service import SarvamTTSService
                tts = SarvamTTSService()
                thankyou_text = "ధన్యవాదాలు."
                audio_file = tts.synthesize_telugu(thankyou_text)
                os.makedirs(os.path.dirname(audio_path), exist_ok=True)
                with open(audio_path, "wb") as f:
                    f.write(audio_file.read())
                print(f"[Thank You] Successfully generated {audio_path}")
            except Exception as e:
                print(f"[Thank You] Audio generation failed: {e}")

        return HttpResponseRedirect(f"{public_url}/{audio_path}")

class TriggerFollowupCallView(APIView):
    authentication_classes = []
    permission_classes = []
    
    def post(self, request):
        test_issue_id = request.data.get("test_issue_id")
        if not test_issue_id:
            return Response({"success": False, "message": "Missing test_issue_id"}, status=400)
            
        from inventory.models import TestIssue, Patient
        from voicebot.services.followup_service import FollowupCallService
        
        try:
            test_issue = TestIssue.objects.get(id=test_issue_id)
            patient = Patient.objects.get(patient_id=test_issue.patient_id)
            
            if not patient.contact_no:
                return Response({"success": False, "message": "Patient has no contact number"}, status=400)
                
            voice_call = VoiceCall.objects.create(
                patient=patient,
                test_issue=test_issue,
                call_type="lab_followup",
                status="pending"
            )
            
            # Pre-generate personalized dynamic audio prompts synchronously to prevent race conditions
            svc = FollowupCallService()
            svc.generate_dynamic_prompts(voice_call)
            
            result = svc.trigger_followup_call(voice_call)
            
            if result["success"]:
                return Response(result, status=200)
            else:
                voice_call.status = "failed"
                voice_call.save()
                return Response(result, status=500)
                
        except TestIssue.DoesNotExist:
            return Response({"success": False, "message": "Test issue not found"}, status=404)
