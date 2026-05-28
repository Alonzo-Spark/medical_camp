import os
import base64
import requests
from django.core.files.base import ContentFile

class SarvamTTSService:
    def __init__(self):
        self.api_key = os.getenv("SARVAM_API_KEY")
        self.api_url = "https://api.sarvam.ai/text-to-speech"

    def synthesize_telugu(self, text: str) -> ContentFile:
        """
        Converts Telugu text into speech using Sarvam AI.
        Returns a Django ContentFile containing the MP3 data.
        Falls back to a mock MP3 if the API key is not configured.
        """
        if not self.api_key or self.api_key == "YOUR_SARVAM_API_KEY_HERE":
            # Generate a tiny mock mp3 file
            tiny_mp3_base64 = (
                "SUQzBAAAAAAAI1RTU0UAAAAPAAADTGFtZTMuMTAwZXJyb3IAAAAAAAAAAAAAAAAADQ=="
                "//uQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM1NTRSBhIGx1"
                "Y2t5IG1wMwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
            )
            audio_data = base64.b64decode(tiny_mp3_base64)
            return ContentFile(audio_data, name="mock_reminder.mp3")

        headers = {
            "api-subscription-key": self.api_key,
            "Content-Type": "application/json"
        }

        # Correct payload schema for Sarvam AI Bulbul v3 API
        payload = {
            "text": text,
            "speaker": "neha",  # Female voice option (excellent for Telugu reminders)
            "target_language_code": "te-IN",
            "pace": 1.15,
            "model": "bulbul:v3"
        }

        try:
            response = requests.post(self.api_url, json=payload, headers=headers)
            response.raise_for_status()
        except requests.exceptions.HTTPError as http_err:
            try:
                error_detail = response.json()
            except Exception:
                error_detail = response.text
            raise Exception(f"Sarvam API Error: {http_err} - Details: {error_detail}")

        response_data = response.json()
        
        # Sarvam AI can return either 'audio' (base64 string) or 'audios' (list)
        audio_base64 = response_data.get("audio")
        if not audio_base64:
            audios_list = response_data.get("audios", [])
            if audios_list:
                audio_base64 = audios_list[0]
                
        if not audio_base64:
            raise Exception(f"No audio data returned by Sarvam API. Response: {response_data}")
            
        audio_data = base64.b64decode(audio_base64)
        return ContentFile(audio_data, name="reminder.mp3")
