import os
import sys

# Setup Django environment
sys.path.append('/home/neeraj/MedicalCamp/Medical_Camp')
import dotenv
dotenv.load_dotenv()
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medicalcamp_inventory.settings')

import django
django.setup()

from voicebot.services.tts_service import SarvamTTSService

tts = SarvamTTSService()

# Telugu Scenario 1
s1_text_telugu = "దయచేసి వచ్చే నెల మొదటి ఆదివారం జరిగే తదుపరి క్యాంప్ ముందే మిగిలిన పరీక్షలు చేయించుకోండి."
audio_te = tts.synthesize_telugu(s1_text_telugu)
print(f"Telugu S1 size: {len(audio_te.read())}")
