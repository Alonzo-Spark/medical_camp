import requests
import json
import os

def get_api_key():
    with open(".env", "r") as f:
        for line in f:
            if line.startswith("SARVAM_API_KEY="):
                return line.strip().split("=")[1].strip('"\'')
    return None

api_key = get_api_key()
url = "https://api.sarvam.ai/text-to-speech/speakers" # Guessing the endpoint
headers = {"api-subscription-key": api_key}
r = requests.get(url, headers=headers)
print(r.status_code, r.text)
