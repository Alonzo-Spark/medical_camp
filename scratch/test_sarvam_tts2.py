import requests
import base64

def get_api_key():
    with open(".env", "r") as f:
        for line in f:
            if line.startswith("SARVAM_API_KEY="):
                return line.strip().split("=")[1].strip('"\'')
    return None

def generate():
    url = "https://api.sarvam.ai/text-to-speech"
    payload = {
        "inputs": [
            "నమస్కారం, మేము సి.సి.సి మెడికల్ క్యాంప్ నుండి కాల్ చేస్తున్నాము. మీ తదుపరి క్యాంప్ జూన్ 7, 2026 న పద్మారావు నగర్ లో ఉంటుంది.",
            "సమయం ఉదయం 7 గంటల నుండి మధ్యాహ్నం 1 గంట వరకు. ధన్యవాదాలు."
        ],
        "target_language_code": "te-IN",
        "speaker": "kavitha",
        "speech_sample_rate": 8000,
        "enable_preprocessing": True,
        "model": "bulbul:v3"
    }
    headers = {
        "api-subscription-key": get_api_key(),
        "Content-Type": "application/json"
    }
    r = requests.post(url, json=payload, headers=headers)
    if r.status_code == 200:
        data = r.json()
        audios = data.get("audios", [])
        combined = b""
        for a in audios:
            combined += base64.b64decode(a)
        with open("test_telugu_reminder2.wav", "wb") as f:
            f.write(combined)
        print("Success, saved combined audio.")
    else:
        print("Error:", r.text)

if __name__ == "__main__":
    generate()
