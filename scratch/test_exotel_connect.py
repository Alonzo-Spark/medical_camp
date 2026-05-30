import os
import sys
import requests
import django
from dotenv import load_dotenv

sys.path.append("/home/neeraj/MedicalCamp/Medical_Camp")
load_dotenv(dotenv_path="/home/neeraj/MedicalCamp/Medical_Camp/.env")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "medicalcamp_inventory.settings")
django.setup()

from voicebot.models import VoiceCall
from voicebot.services.followup_service import FollowupCallService

service = FollowupCallService()
print("Exotel Account SID:", service.exotel_sid)
print("Exotel Key:", service.exotel_key)
print("Exotel Token (masked):", service.exotel_token[:4] + "..." if service.exotel_token else "None")
print("Exotel Caller ID:", service.exotel_caller)
print("Public URL:", service.public_url)

# Get the latest voice call
voice_call = VoiceCall.objects.last()
print(f"Testing VoiceCall ID: {voice_call.id}, Patient Phone: {voice_call.patient.contact_no}")

patient_phone = voice_call.patient.contact_no
smart_start_url = f"{service.public_url}/api/voicebot/smart-start/"

connect_url = f"https://api.exotel.com/v1/Accounts/{service.exotel_sid}/Calls/connect.json"
payload = {
    "From":            patient_phone,
    "CallerId":        service.exotel_caller,
    "Url":             smart_start_url,
    "CallType":        "trans",
    "TimeOut":         30,
    "StatusCallback":  f"{service.public_url}/api/voicebot/followup-status/?call_id={voice_call.id}",
}

print("Payload:", payload)
resp = requests.post(
    connect_url,
    auth=(service.exotel_key, service.exotel_token),
    data=payload,
    timeout=10
)
print("Status Code:", resp.status_code)
print("Response JSON:")
try:
    print(resp.json())
except Exception as e:
    print("Response text:", resp.text)
