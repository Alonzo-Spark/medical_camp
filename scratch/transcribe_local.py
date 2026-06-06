import os
import sys
import requests

# Setup Django environment
sys.path.append('/home/neeraj/MedicalCamp/Medical_Camp')
import dotenv
dotenv.load_dotenv()

api_key = os.getenv("SARVAM_API_KEY")
url = "https://api.sarvam.ai/speech-to-text"

target_file = "media/voicebot_prompts/dynamic/scenario2_te_21.wav"

if not os.path.exists(target_file):
    print(f"File {target_file} does not exist!")
    sys.exit(1)

headers = {
    "api-subscription-key": api_key,
}

print(f"Transcribing {target_file} in Telugu (te-IN)...")
with open(target_file, "rb") as audio_file:
    files = {
        "file": ("audio.wav", audio_file, "audio/wav"),
    }
    data = {
        "language_code": "te-IN",
        "model": "saaras:v3",
        "mode": "transcribe"
    }
    stt_resp = requests.post(url, headers=headers, files=files, data=data, timeout=60)
    if stt_resp.status_code == 200:
        print(f"Telugu Transcript: '{stt_resp.json().get('transcript')}'")
    else:
        print(f"Telugu error {stt_resp.status_code}: {stt_resp.text}")
