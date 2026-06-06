import os
import time
import requests
from django.utils import timezone
from django.http import HttpResponse, HttpResponseRedirect
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from inventory.models import Patient, MedicalCamp


# Phase 1 views removed as per client request.



# ─────────────────────────────────────────────────────────────────────────────
# Phase 2 — Lab Test Follow-up Voicebot Webhooks (Linear App Builder Flow)
# ─────────────────────────────────────────────────────────────────────────────
from voicebot.models import VoiceCall, VoiceResponse
from voicebot.services.stt_service import SarvamSTTService
from voicebot.services.intent_service import IntentService
from django.utils import timezone

def _get_param(request, key):
    val = request.POST.get(key) or request.GET.get(key)
    if not val and hasattr(request, "data") and isinstance(request.data, dict):
        val = request.data.get(key)
    return val

def _log_request(endpoint, request, voice_call=None, extra=None):
    try:
        import json, datetime, os
        log_dir = "media"
        os.makedirs(log_dir, exist_ok=True)
        log_file = os.path.join(log_dir, "voicebot_requests.log")
        
        get_params = dict(request.GET.items())
        post_params = dict(request.POST.items())
        data_params = {}
        if hasattr(request, "data") and isinstance(request.data, dict):
            # Convert QueryDict or dict keys/vals to string/serializable format
            for k, v in request.data.items():
                data_params[str(k)] = str(v)
            
        log_data = {
            "timestamp": datetime.datetime.now().isoformat(),
            "endpoint": endpoint,
            "method": request.method,
            "GET": get_params,
            "POST": post_params,
            "data": data_params,
            "voice_call_id": voice_call.id if voice_call else None,
            "voice_call_lang": voice_call.language if voice_call else None,
            "voice_call_sid": voice_call.call_sid if voice_call else None,
            "extra": extra
        }
        
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_data) + "\n")
    except Exception as e:
        print(f"Failed to log request: {e}")

def _wait_for_recording_ready(url, max_wait_seconds=300):
    """
    Polls the Exotel recording URL until it is ready (returns HTTP 200 with audio content).
    Checks frequently (every 0.5s) to minimize latency.
    """
    import time
    import requests
    import os
    if not url:
        return False
    exotel_key = os.getenv("EXOTEL_API_KEY")
    exotel_token = os.getenv("EXOTEL_API_TOKEN")
    start_time = time.time()
    
    # Try immediately first
    try:
        resp = requests.get(url, auth=(exotel_key, exotel_token), timeout=2, stream=True)
        if resp.status_code == 200:
            content_length = int(resp.headers.get('Content-Length', 0))
            content_type = resp.headers.get('Content-Type', '')
            if 'audio' in content_type.lower() or content_length > 1000:
                resp.close()
                time.sleep(0.3)
                return True
        resp.close()
    except Exception:
        pass

    while time.time() - start_time < max_wait_seconds:
        time.sleep(0.5)
        try:
            # pyrefly: ignore [bad-argument-type]
            resp = requests.get(url, auth=(exotel_key, exotel_token), timeout=2, stream=True)
            if resp.status_code == 200:
                content_length = int(resp.headers.get('Content-Length', 0))
                content_type = resp.headers.get('Content-Type', '')
                if 'audio' in content_type.lower() or content_length > 1000:
                    resp.close()
                    time.sleep(0.3)
                    return True
            resp.close()
        except Exception:
            pass
    return False


class BaseLabTestWebhookView(APIView):
    authentication_classes = []
    permission_classes = []
    
    def get(self, request):
        return self.post(request)
        
    def _get_voice_call(self, request):
        # CustomField = VoiceCall.id — most reliable identifier Exotel sends
        custom_field = _get_param(request, "CustomField")
        call_sid     = _get_param(request, "CallSid")
        raw_phone    = _get_param(request, "From") or ""

        print(f"[Webhook] CustomField={custom_field} CallSid={call_sid} From={raw_phone}")

        voice_call = None

        # 1. Try by VoiceCall.id (CustomField) — most reliable
        if custom_field:
            try:
                voice_call = VoiceCall.objects.get(id=int(custom_field))
                print(f"[Webhook] Found VoiceCall by CustomField: {voice_call.id} (lang={voice_call.language})")
                # ALWAYS update call_sid from webhook — Exotel's leg SID differs from the
                # parent SID saved during trigger_followup_call, so we must overwrite it
                # every time CustomField is present to keep lookup-by-SID working.
                if call_sid and voice_call.call_sid != call_sid:
                    print(f"[Webhook] Updating call_sid from {voice_call.call_sid} -> {call_sid}")
                    voice_call.call_sid = call_sid
                    voice_call.save(update_fields=["call_sid"])
            except (VoiceCall.DoesNotExist, ValueError):
                print(f"[Webhook] No VoiceCall found for CustomField={custom_field}")

        # 2. Try by call_sid
        if not voice_call and call_sid:
            voice_call = VoiceCall.objects.filter(call_sid=call_sid).first()
            if voice_call:
                print(f"[Webhook] Found VoiceCall by CallSid: {voice_call.id} (lang={voice_call.language})")

        # 3. Fallback: most recent in-progress/pending call for this phone
        if not voice_call:
            clean_phone = raw_phone.strip()
            if clean_phone.startswith('+91'):   clean_phone = clean_phone[3:]
            elif clean_phone.startswith('91') and len(clean_phone) > 10: clean_phone = clean_phone[2:]
            if clean_phone.startswith('0') and len(clean_phone) > 10: clean_phone = clean_phone[1:]

            if clean_phone:
                voice_call = VoiceCall.objects.filter(
                    patient__contact_no__contains=clean_phone,
                    status__in=["in_progress", "pending"],
                ).order_by('-started_at').first()
                if voice_call:
                    print(f"[Webhook] Found VoiceCall by phone+status fallback: {voice_call.id} (lang={voice_call.language})")
                    if call_sid and voice_call.call_sid != call_sid:
                        voice_call.call_sid = call_sid
                        voice_call.save(update_fields=["call_sid"])

        # 4. Final fallback: find the most recent in-progress/pending VoiceCall
        if not voice_call:
            voice_call = VoiceCall.objects.filter(status__in=["in_progress", "pending"]).order_by('-started_at').first()
            if voice_call:
                print(f"[Webhook] Found VoiceCall by active status fallback: {voice_call.id} (lang={voice_call.language})")
                if call_sid and voice_call.call_sid != call_sid:
                    voice_call.call_sid = call_sid
                    voice_call.save(update_fields=["call_sid"])

        if voice_call:
            _log_request("get_voice_call", request, voice_call, extra={
                "custom_field": custom_field,
                "call_sid": call_sid,
                "raw_phone": raw_phone,
                "path": request.path
            })
        else:
            print("[Webhook] Could not find any VoiceCall.")
            _log_request("get_voice_call", request, None, extra={
                "custom_field": custom_field,
                "call_sid": call_sid,
                "raw_phone": raw_phone,
                "path": request.path
            })

        return voice_call



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

        recording_url = _get_param(request, "RecordingUrl") or ""
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
                    test_done=False
                )
                test_names = [ti.test.name for ti in test_issues]
                
                lang = vc.language
                lang_code = "hi-IN" if lang == "hi" else "te-IN"
                transcript = SarvamSTTService().transcribe_from_url(recording_url, language_code=lang_code)
                test_statuses = IntentService().classify_multi_test_q1(transcript, test_names, language=lang)
                
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

        recording_url = _get_param(request, "RecordingUrl") or ""
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
                
                vc = VoiceCall.objects.get(id=vc_id)
                patient = vc.patient
                
                # pyrefly: ignore [missing-attribute]
                test_issues = TestIssue.objects.filter(
                    patient_id=patient.patient_id,
                    camp=vc.test_issue.camp,
                    test_done=False
                )
                test_names = [ti.test.name for ti in test_issues]
                
                lang = vc.language
                lang_code = "hi-IN" if lang == "hi" else "te-IN"
                transcript = SarvamSTTService().transcribe_from_url(url, language_code=lang_code) if url else ""
                test_statuses = IntentService().classify_multi_test_q2(transcript, test_names, language=lang)
                
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
                
                for ti in test_issues:
                    ti_name = ti.test.name
                    if test_statuses.get(ti_name, False):
                        ti.test_done = True
                        ti.save(update_fields=["test_done"])
                        print(f"[Q2 BG] Auto-checked test_done for TestIssue {ti.id} ({ti_name})")
                        
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
        call_sid     = _get_param(request, "CallSid") or ""
        custom_field = _get_param(request, "CustomField") or ""
        status_val   = (_get_param(request, "Status") or "").lower()

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

class AskQ1View(BaseLabTestWebhookView):
    def post(self, request):
        voice_call = self._get_voice_call(request)
        custom_field = _get_param(request, "CustomField") or ""
        call_sid = _get_param(request, "CallSid") or ""
        public_url = os.getenv("PUBLIC_URL", "").rstrip('/')
        if not public_url:
            public_url = request.build_absolute_uri('/')[:-1]

        # Check if language is Hindi
        is_hindi = False
        if voice_call:
            if call_sid and voice_call.call_sid != call_sid:
                voice_call.call_sid = call_sid
                voice_call.save(update_fields=["call_sid"])
                print(f"[AskQ1View] Saved leg call_sid {call_sid} for VoiceCall {voice_call.id}")
            if voice_call.language == 'hi':
                is_hindi = True
        elif custom_field.isdigit():
            try:
                from voicebot.models import VoiceCall
                vc = VoiceCall.objects.get(id=int(custom_field))
                if call_sid and vc.call_sid != call_sid:
                    vc.call_sid = call_sid
                    vc.save(update_fields=["call_sid"])
                    print(f"[AskQ1View] Saved leg call_sid {call_sid} for VoiceCall {vc.id}")
                if vc.language == 'hi':
                    is_hindi = True
            except Exception as e:
                print(f"[AskQ1View] Error looking up/saving call: {e}")

        call_id = custom_field or (str(voice_call.id) if voice_call else str(int(time.time())))

        if is_hindi:
            audio_path = "media/voicebot_prompts/followup_q1_hindi.wav"
            audio_url = f"{public_url}/{audio_path}"
            return HttpResponse(audio_url, content_type="text/plain")

        # Telugu fallback/dynamic logic
        dynamic_file = f"media/voicebot_prompts/dynamic/q1_{call_id}.wav"
        if os.path.exists(dynamic_file) and os.path.getsize(dynamic_file) > 0:
            print(f"[Ask Q1] Serving dynamic audio: {dynamic_file}")
            return HttpResponse(f"{public_url}/{dynamic_file}", content_type="text/plain")
        # Static fallback for Telugu
        audio_path = "media/voicebot_prompts/followup_q1.wav"
        audio_url = f"{public_url}/{audio_path}"
        return HttpResponse(audio_url, content_type="text/plain")

class AskQ2View(BaseLabTestWebhookView):
    def post(self, request):
        voice_call = self._get_voice_call(request)
        public_url = os.getenv("PUBLIC_URL", "").rstrip('/')
        if not public_url:
            public_url = request.build_absolute_uri('/')[:-1]

        os.makedirs("media/voicebot_prompts/dynamic", exist_ok=True)
        
        is_hindi = False
        if voice_call and voice_call.language == 'hi':
            is_hindi = True

        print(f"[Ask Q2] voice_call={voice_call.id if voice_call else None}, lang={voice_call.language if voice_call else None}, is_hindi={is_hindi}")

        call_id = str(voice_call.id) if voice_call else str(int(time.time()))

        if is_hindi:
            s1_path = "media/voicebot_prompts/scenario1_hindi.wav"
            s2_path = "media/voicebot_prompts/scenario2_hindi.wav"
            s3_path = "media/voicebot_prompts/scenario3_hindi.wav"
        else:
            s1_path = "media/voicebot_prompts/scenario1.wav"
            s2_path = "media/voicebot_prompts/scenario2.wav"
            s3_path = "media/voicebot_prompts/scenario3.wav"

        # Check all tests status for this voice call using Q1 response intent
        completed_all = False
        completed_none = False
        if voice_call:
            # Wait for the background thread to finish updating the database for Q1 (max 6s)
            import time
            from voicebot.models import VoiceResponse
            start_wait = time.time()
            q1_response = None
            while time.time() - start_wait < 4.0:
                # pyrefly: ignore [missing-attribute]
                q1_response = VoiceResponse.objects.filter(voice_call=voice_call, question="Q1_TESTS_DONE").first()
                if q1_response:
                    break
                time.sleep(0.1)

            wait_elapsed = time.time() - start_wait
            print(f"[Ask Q2] Q1 poll waited {wait_elapsed:.1f}s, found={'yes' if q1_response else 'no'}")

            if q1_response:
                print(f"[Ask Q2] Q1 intent={q1_response.intent}, transcript={q1_response.transcript[:80]}")
                if q1_response.intent == "NO":
                    completed_none = True
                elif q1_response.intent == "YES":
                    from inventory.models import TestIssue
                    # Check if there are any remaining pending tests in the database
                    # pyrefly: ignore [missing-attribute]
                    pending_count = TestIssue.objects.filter(
                        patient_id=voice_call.patient.patient_id,
                        camp=voice_call.test_issue.camp,
                        test_done=False
                    ).count()
                    print(f"[Ask Q2] YES intent — pending_count={pending_count}")
                    if pending_count == 0:
                        completed_all = True
                    else:
                        # Some tests completed but some are still pending
                        pass
                else:
                    # Fallback for UNCLEAR / PENDING
                    completed_none = True
            else:
                # Fallback if background task timed out
                completed_none = True

        if completed_all:
            target_file = s2_path
        elif completed_none:
            target_file = s3_path
        else:
            target_file = s1_path
        
        print(f"[Ask Q2] Decision: completed_all={completed_all}, completed_none={completed_none} -> target_file={target_file}")

        # One-time generation if the file doesn't exist yet or is empty
        if not os.path.exists(target_file) or os.path.getsize(target_file) == 0:
            try:
                from voicebot.services.tts_service import SarvamTTSService
                tts = SarvamTTSService()
                if is_hindi:
                    if completed_all:
                        s2_text = "अगले महीने के first Sunday को होने वाले अगले कैंप में अपने टेस्ट की रिपोर्ट ले लीजिए।"
                        audio_file = tts.synthesize_hindi(s2_text)
                    elif completed_none:
                        s3_text = "कृपया अगले महीने के first Sunday को होने वाले अगले कैंप से पहले अपने टेस्ट करवा लें।"
                        audio_file = tts.synthesize_hindi(s3_text)
                    else:
                        s1_text = "कृपया अगले महीने के first Sunday को होने वाले अगले कैंप से पहले बचे हुए टेस्ट करवा लें।"
                        audio_file = tts.synthesize_hindi(s1_text)
                else:
                    if completed_all:
                        s2_text = "వచ్చే నెల మొదటి ఆదివారం జరిగే తదుపరి క్యాంప్‌లో పరీక్షల రిపోర్టులను తీసుకోండి."
                        audio_file = tts.synthesize_telugu(s2_text)
                    elif completed_none:
                        s3_text = "దయచేసి వచ్చే నెల మొదటి ఆదివారం జరిగే తదుపరి క్యాంప్ ముందే పరీక్షలు చేయించుకోండి."
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
                fallback_thankyou = f"media/voicebot_prompts/dynamic/thankyou_{'hi' if is_hindi else 'te'}_{call_id}.wav"
                if not os.path.exists(fallback_thankyou) or os.path.getsize(fallback_thankyou) == 0:
                    try:
                        from voicebot.services.tts_service import SarvamTTSService
                        tts = SarvamTTSService()
                        if is_hindi:
                            thankyou_text = "धन्यवाद, स्वस्थ रहें।"
                            audio_file = tts.synthesize_hindi(thankyou_text)
                        else:
                            thankyou_text = "ధన్యవాదములు, ఆరోగ్యంగా ఉండండి."
                            audio_file = tts.synthesize_telugu(thankyou_text)
                        with open(fallback_thankyou, "wb") as f:
                            f.write(audio_file.read())
                    except Exception as ex:
                        print(f"[Ask Q2 Fallback] Thank you generation failed: {ex}")
                return HttpResponse(f"{public_url}/{fallback_thankyou}", content_type="text/plain")

        print(f"[Ask Q2] Returning audio URL: {public_url}/{target_file}")
        return HttpResponse(f"{public_url}/{target_file}", content_type="text/plain")

class ThankYouView(BaseLabTestWebhookView):
    def post(self, request):
        voice_call = self._get_voice_call(request)
        public_url = os.getenv("PUBLIC_URL", "").rstrip('/')
        if not public_url:
            public_url = request.build_absolute_uri('/')[:-1]
        
        is_hindi = False
        if voice_call and voice_call.language == 'hi':
            is_hindi = True

        call_id = str(voice_call.id) if voice_call else str(int(time.time()))

        os.makedirs("media/voicebot_prompts/dynamic", exist_ok=True)

        if is_hindi:
            audio_path = f"media/voicebot_prompts/dynamic/thankyou_hi_{call_id}.wav"
        else:
            audio_path = f"media/voicebot_prompts/dynamic/thankyou_te_{call_id}.wav"

        if not os.path.exists(audio_path) or os.path.getsize(audio_path) == 0:
            try:
                from voicebot.services.tts_service import SarvamTTSService
                tts = SarvamTTSService()
                if is_hindi:
                    thankyou_text = "धन्यवाद, स्वस्थ रहें।"
                    audio_file = tts.synthesize_hindi(thankyou_text)
                else:
                    thankyou_text = "ధన్యవాదములు, ఆరోగ్యంగా ఉండండి."
                    audio_file = tts.synthesize_telugu(thankyou_text)
                with open(audio_path, "wb") as f:
                    f.write(audio_file.read())
                print(f"[Thank You] Successfully generated {audio_path}")
            except Exception as e:
                print(f"[Thank You] Audio generation failed: {e}")

        return HttpResponse(f"{public_url}/{audio_path}", content_type="text/plain")

class TriggerFollowupCallView(APIView):
    authentication_classes = []
    permission_classes = []
    
    def post(self, request):
        test_issue_id = request.data.get("test_issue_id")
        language = request.data.get("language", "te")
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
                status="pending",
                language=language
            )
            
            # Pre-generate personalized dynamic audio prompt only for Telugu (since Hindi Q1 and all scenarios are static)
            if language == 'te':
                svc = FollowupCallService()
                svc.generate_dynamic_prompts(voice_call)
            
            svc = FollowupCallService()
            result = svc.trigger_followup_call(voice_call)
            
            if result["success"]:
                return Response(result, status=200)
            else:
                voice_call.status = "failed"
                voice_call.save()
                return Response(result, status=500)
                
        except TestIssue.DoesNotExist:
            return Response({"success": False, "message": "Test issue not found"}, status=404)

