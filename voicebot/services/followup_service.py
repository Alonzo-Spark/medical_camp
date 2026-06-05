import os
import requests
from django.utils import timezone
from inventory.models import TestIssue
from voicebot.models import VoiceCall

class FollowupCallService:
    def trigger_followup_call(self, voice_call) -> dict:
        EXOTEL_SID = os.getenv("EXOTEL_ACCOUNT_SID")
        EXOTEL_TOKEN = os.getenv("EXOTEL_API_TOKEN")
        EXOTEL_KEY = os.getenv("EXOTEL_API_KEY")
        CALLER_ID = os.getenv("EXOTEL_CALLER_ID")
        FLOW_URL = os.getenv("EXOTEL_FLOW_URL", f"https://my.exotel.com/{EXOTEL_SID}/exoml/start_voice/1256480")

        url = f"https://api.exotel.com/v1/Accounts/{EXOTEL_SID}/Calls/connect.json"

        patient_phone = voice_call.patient.contact_no
        if not patient_phone.startswith("0") and not patient_phone.startswith("+"):
            patient_phone = "0" + patient_phone

        data = {
            "From": patient_phone,
            "CallerId": CALLER_ID,
            "Url": FLOW_URL,
            "CustomField": str(voice_call.id)
        }
        
        try:
            resp = requests.post(url, auth=(EXOTEL_KEY, EXOTEL_TOKEN), data=data)
            if resp.status_code == 200:
                call_data = resp.json().get("Call", {})
                voice_call.call_sid = call_data.get("Sid")
                voice_call.status = "in_progress"
                voice_call.save()
                return {"success": True, "message": "Call initiated", "call_sid": voice_call.call_sid}
            else:
                return {"success": False, "message": resp.text}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def generate_dynamic_prompts(self, voice_call):
        """
        Retrieves the patient's pending test list, translates acronyms phonetically to Telugu,
        generates personalized audio prompts (Q1 & Q2) using Sarvam TTS, and saves them
        to media/voicebot_prompts/dynamic/ for the call to fetch.
        """
        from inventory.models import TestIssue
        from voicebot.services.tts_service import SarvamTTSService
        from voicebot.services.reminder_service import format_acronyms_to_telugu
        import os
        
        try:
            patient = voice_call.patient
            # Retrieve all pending tests for the patient from the camp session of the triggered test
            # pyrefly: ignore [missing-attribute]
            test_issues = TestIssue.objects.filter(
                patient_id=patient.patient_id,
                camp=voice_call.test_issue.camp,
                reports_issued=False
            )
            
            test_names = []
            if test_issues.exists():
                for ti in test_issues:
                    name_clean = ti.test.name.strip()
                    telugu_name = format_acronyms_to_telugu(name_clean)
                    test_names.append(telugu_name)
            else:
                # Fallback to the specific triggering test
                name_clean = voice_call.test_issue.test.name.strip()
                telugu_name = format_acronyms_to_telugu(name_clean)
                test_names.append(telugu_name)
                
            # Deduplicate just in case
            test_names = list(dict.fromkeys(test_names))
            
            if len(test_names) == 1:
                tests_phrase = test_names[0]
            else:
                tests_phrase = " మరియు ".join([", ".join(test_names[:-1]), test_names[-1]])
                
            # Formulate sentences
            q1_text = f"నమస్కారం, మేము సీ సీ సీ మెడికల్ క్యాంప్ నుండి మాట్లాడుతున్నాము. మీకు సూచించిన {tests_phrase} ల్యాబ్ పరీక్షలు చేయించుకున్నారా?"
            
            os.makedirs("media/voicebot_prompts/dynamic", exist_ok=True)
            
            tts = SarvamTTSService()
            
            # Generate and save Q1
            q1_file = tts.synthesize_telugu(q1_text)
            q1_path = f"media/voicebot_prompts/dynamic/q1_{voice_call.id}.wav"
            with open(q1_path, "wb") as f:
                f.write(q1_file.read())
            print(f"[Dynamic Prompt] Generated Q1 audio file for VoiceCall {voice_call.id}: {q1_text}")


            
        except Exception as err:
            print(f"[Dynamic Prompt] Error pre-generating dynamic prompts: {err}")
