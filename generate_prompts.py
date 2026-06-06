import os
import django
import sys

# Setup Django environment
sys.path.append('/home/neeraj/MedicalCamp/Medical_Camp')
import dotenv
dotenv.load_dotenv()
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medicalcamp_inventory.settings')
django.setup()

from voicebot.services.tts_service import SarvamTTSService

q1_text = "నమస్కారం, మేము సీసీసీ మెడికల్ క్యాంప్ నుంచి ఫోన్ చేస్తున్నాము. మీ ల్యాబ్ టెస్ట్ లు చేయించుకున్నారా?"

q2_text = "మీరు మీ ల్యాబ్ టెస్ట్ ల రిపోర్ట్స్ తీసుకున్నారా?"

thankyou_text = "ధన్యవాదములు, ఆరోగ్యంగా ఉండండి."

svc = SarvamTTSService()

# pyrefly: ignore [no-matching-overload]
prompts_dir = os.path.join(django.conf.settings.MEDIA_ROOT, 'voicebot_prompts')
os.makedirs(prompts_dir, exist_ok=True)

print("Generating Q1...")
q1_audio = svc.synthesize_telugu(q1_text)
with open(os.path.join(prompts_dir, 'followup_q1.wav'), 'wb') as f:
    f.write(q1_audio.read())



print("Generating Scenario 1...")
s1_text = "దయచేసి వచ్చే నెల మొదటి ఆదివారం జరిగే తదుపరి క్యాంప్ ముందే మిగిలిన పరీక్షలు చేయించుకోండి."
s1_audio = svc.synthesize_telugu(s1_text)
with open(os.path.join(prompts_dir, 'scenario1.wav'), 'wb') as f:
    f.write(s1_audio.read())

print("Generating Scenario 2...")
s2_text = "వచ్చే నెల మొదటి ఆదివారం జరిగే తదుపరి క్యాంప్‌లో పరీక్షల రిపోర్టులను తీసుకోండి."
s2_audio = svc.synthesize_telugu(s2_text)
with open(os.path.join(prompts_dir, 'scenario2.wav'), 'wb') as f:
    f.write(s2_audio.read())

print("Generating Scenario 3...")
s3_text = "దయచేసి వచ్చే నెల మొదటి ఆదివారం జరిగే తదుపరి క్యాంప్ ముందే పరీక్షలు చేయించుకోండి."
s3_audio = svc.synthesize_telugu(s3_text)
with open(os.path.join(prompts_dir, 'scenario3.wav'), 'wb') as f:
    f.write(s3_audio.read())

# ─────────────────────────────────────────────────────────────────────────────
# Hindi Prompt Generation
# ─────────────────────────────────────────────────────────────────────────────
q1_text_hindi = "नमस्ते, हम सी सी सी मेडिकल कैंप से बात कर रहे हैं। क्या आपने अपने सुझाए गए लैब टेस्ट करवा लिए हैं?"
q2_text_hindi = "क्या आपने अपने लैब टेस्ट की रिपोर्ट प्राप्त कर ली है?"
thankyou_text_hindi = "धन्यवाद, स्वस्थ रहें।"
s1_text_hindi = "कृपया अगले महीने के first Sunday को होने वाले अगले कैंप से पहले बचे हुए टेस्ट करवा लें।"
s2_text_hindi = "अगले महीने के first Sunday को होने वाले अगले कैंप में अपने टेस्ट की रिपोर्ट ले लीजिए।"
s3_text_hindi = "कृपया अगले महीने के first Sunday को होने वाले अगले कैंप से पहले अपने टेस्ट करवा लें।"

print("Generating Hindi Q1...")
q1_audio_hindi = svc.synthesize_hindi(q1_text_hindi)
with open(os.path.join(prompts_dir, 'followup_q1_hindi.wav'), 'wb') as f:
    f.write(q1_audio_hindi.read())



print("Generating Hindi Scenario 1...")
s1_audio_hindi = svc.synthesize_hindi(s1_text_hindi)
with open(os.path.join(prompts_dir, 'scenario1_hindi.wav'), 'wb') as f:
    f.write(s1_audio_hindi.read())

print("Generating Hindi Scenario 2...")
s2_audio_hindi = svc.synthesize_hindi(s2_text_hindi)
with open(os.path.join(prompts_dir, 'scenario2_hindi.wav'), 'wb') as f:
    f.write(s2_audio_hindi.read())

print("Generating Hindi Scenario 3...")
s3_audio_hindi = svc.synthesize_hindi(s3_text_hindi)
with open(os.path.join(prompts_dir, 'scenario3_hindi.wav'), 'wb') as f:
    f.write(s3_audio_hindi.read())

print("Done generating audio files!")
