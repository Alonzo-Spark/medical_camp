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

print("Generating Q2...")
q2_audio = svc.synthesize_telugu(q2_text)
with open(os.path.join(prompts_dir, 'followup_q2.wav'), 'wb') as f:
    f.write(q2_audio.read())

print("Generating Thank You...")
thankyou_audio = svc.synthesize_telugu(thankyou_text)
with open(os.path.join(prompts_dir, 'followup_thankyou.wav'), 'wb') as f:
    f.write(thankyou_audio.read())

print("Done generating audio files!")
