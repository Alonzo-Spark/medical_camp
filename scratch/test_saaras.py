import os
import requests
import dotenv

dotenv.load_dotenv()
api_key = os.getenv("SARVAM_API_KEY")
exotel_key = os.getenv("EXOTEL_API_KEY")
exotel_token = os.getenv("EXOTEL_API_TOKEN")

audio_url = "https://recordings.exotel.com/exotelrecordings/alonzoai1/1780136467.9808319_1.mp3"

# Download audio
print("Downloading audio...")
resp = requests.get(audio_url, auth=(exotel_key, exotel_token))
print(f"Status: {resp.status_code}, Bytes: {len(resp.content)}")

if resp.status_code == 200:
    headers = {
        "api-subscription-key": api_key,
    }
    files = {
        "file": ("audio.mp3", resp.content, "audio/mpeg"),
    }
    data = {
        "language_code": "te-IN",
        "model": "saaras:v3",
        "mode": "translate"
    }
    print("Calling Sarvam saaras:v3...")
    r = requests.post("https://api.sarvam.ai/speech-to-text", headers=headers, files=files, data=data)
    print(f"Status: {r.status_code}")
    print(r.json())
