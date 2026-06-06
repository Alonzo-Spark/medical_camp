import os
import requests
import tempfile

class SarvamSTTService:
    def __init__(self):
        self.api_key = os.getenv("SARVAM_API_KEY")
        self.url = "https://api.sarvam.ai/speech-to-text"

    def transcribe_from_url(self, audio_url: str, language_code: str = "te-IN") -> str:
        if not audio_url:
            return ""
        try:
            # Download audio from Exotel (requires Basic Auth)
            exotel_key = os.getenv("EXOTEL_API_KEY")
            exotel_token = os.getenv("EXOTEL_API_TOKEN")

            print(f"[STT] Downloading recording from Exotel...")
            resp = requests.get(audio_url, auth=(exotel_key, exotel_token), timeout=30)
            if resp.status_code != 200:
                print(f"[STT] Failed to download audio - HTTP {resp.status_code}: {resp.text[:200]}")
                return ""

            print(f"[STT] Downloaded {len(resp.content)} bytes. Sending to Sarvam...")

            # Save to a temp file and send as multipart form upload
            suffix = ".wav" if "wav" in audio_url.lower() else ".mp3"
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                tmp.write(resp.content)
                tmp_path = tmp.name

            try:
                headers = {
                    "api-subscription-key": self.api_key,
                }
                with open(tmp_path, "rb") as audio_file:
                    files = {
                        "file": (f"audio{suffix}", audio_file, "audio/mpeg"),
                    }
                    data = {
                        "language_code": language_code,
                        "model": "saaras:v3",
                        "mode": "transcribe"
                    }
                    stt_resp = requests.post(
                        self.url,
                        headers=headers,
                        files=files,
                        data=data,
                        timeout=60
                    )

                if stt_resp.status_code == 200:
                    transcript = stt_resp.json().get("transcript", "")
                    print(f"[STT] Transcript: '{transcript}'")
                    return transcript
                else:
                    print(f"[STT] Sarvam error {stt_resp.status_code}: {stt_resp.text}")
                    return ""
            finally:
                os.unlink(tmp_path)

        except Exception as e:
            print(f"[STT] Exception: {e}")
            return ""
