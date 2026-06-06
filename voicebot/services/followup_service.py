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
                test_done=False
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

    def generate_hindi_q1_prompt(self, voice_call):
        from voicebot.services.tts_service import SarvamTTSService
        import os
        try:
            call_id = voice_call.id
            os.makedirs("media/voicebot_prompts/dynamic", exist_ok=True)
            path = f"media/voicebot_prompts/dynamic/q1_hi_{call_id}.wav"
            if not os.path.exists(path) or os.path.getsize(path) == 0:
                tts = SarvamTTSService()
                txt = "नमस्ते, हम सी सी सी मेडिकल कैंप से बात कर रहे हैं। क्या आपने अपने सुझाए गए लैब टेस्ट करवा लिए हैं?"
                audio = tts.synthesize_hindi(txt)
                with open(path, "wb") as f:
                    f.write(audio.read())
                print(f"[Pre-generate Q1 Hindi] Generated {path}")
        except Exception as e:
            print(f"[Pre-generate Q1 Hindi] Error: {e}")

    def generate_scenario_prompts(self, voice_call):
        from voicebot.services.tts_service import SarvamTTSService
        import os
        try:
            is_hindi = (voice_call.language == 'hi')
            call_id = voice_call.id
            os.makedirs("media/voicebot_prompts/dynamic", exist_ok=True)
            tts = SarvamTTSService()
            
            if is_hindi:
                texts = {
                    f"media/voicebot_prompts/dynamic/scenario1_hi_{call_id}.wav": "कृपया अगले महीने के first Sunday को होने वाले अगले कैंप से पहले बचे हुए टेस्ट करवा लें।",
                    f"media/voicebot_prompts/dynamic/scenario2_hi_{call_id}.wav": "अगले महीने के first Sunday को होने वाले अगले कैंप में अपने टेस्ट की रिपोर्ट ले लीजिए।",
                    f"media/voicebot_prompts/dynamic/scenario3_hi_{call_id}.wav": "कृपया अगले महीने के first Sunday को होने वाले अगले कैंप से पहले अपने टेस्ट करवा लें।",
                    f"media/voicebot_prompts/dynamic/thankyou_hi_{call_id}.wav": "धन्यवाद, स्वस्थ रहें।"
                }
                for path, txt in texts.items():
                    if not os.path.exists(path) or os.path.getsize(path) == 0:
                        audio = tts.synthesize_hindi(txt)
                        with open(path, "wb") as f:
                            f.write(audio.read())
                        print(f"[Pre-generate Scenarios] Generated Hindi {path}")
            else:
                texts = {
                    f"media/voicebot_prompts/dynamic/scenario1_te_{call_id}.wav": "దయచేసి వచ్చే నెల మొదటి ఆదివారం జరిగే తదుపరి క్యాంప్ ముందే మిగిలిన పరీక్షలు చేయించుకోండి.",
                    f"media/voicebot_prompts/dynamic/scenario2_te_{call_id}.wav": "వచ్చే నెల మొదటి ఆదివారం జరిగే తదుపరి క్యాంప్‌లో పరీక్షల రిపోర్టులను తీసుకోండి.",
                    f"media/voicebot_prompts/dynamic/scenario3_te_{call_id}.wav": "దయచేసి వచ్చే నెల మొదటి ఆదివారం జరిగే తదుపరి క్యాంప్ ముందే పరీక్షలు చేయించుకోండి.",
                    f"media/voicebot_prompts/dynamic/thankyou_te_{call_id}.wav": "ధన్యవాదములు, ఆరోగ్యంగా ఉండండి."
                }
                for path, txt in texts.items():
                    if not os.path.exists(path) or os.path.getsize(path) == 0:
                        audio = tts.synthesize_telugu(txt)
                        with open(path, "wb") as f:
                            f.write(audio.read())
                        print(f"[Pre-generate Scenarios] Generated Telugu {path}")
        except Exception as e:
            print(f"[Pre-generate Scenarios] Error: {e}")
