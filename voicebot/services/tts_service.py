import os
import base64
import audioop
import io
import wave
import requests
from django.core.files.base import ContentFile

class SarvamTTSService:
    def __init__(self):
        self.api_key = os.getenv("SARVAM_API_KEY")
        self.api_url = "https://api.sarvam.ai/text-to-speech"

    def _resample_to_8k(self, audio_data: bytes) -> bytes:
        """
        Converts Sarvam AI audio (WAV/PCM at 22050Hz mono 16-bit) to
        8000Hz mono 16-bit WAV — the format Exotel requires for telephony.
        """
        try:
            buf = io.BytesIO(audio_data)
            with wave.open(buf, 'rb') as wav_in:
                n_channels = wav_in.getnchannels()
                samp_width = wav_in.getsampwidth()
                src_rate = wav_in.getframerate()
                pcm_data = wav_in.readframes(wav_in.getnframes())

            # Convert stereo to mono if needed
            if n_channels == 2:
                pcm_data = audioop.tomono(pcm_data, samp_width, 0.5, 0.5)

            # Resample from source rate to 8000 Hz
            if src_rate != 8000:
                pcm_data, _ = audioop.ratecv(pcm_data, samp_width, 1, src_rate, 8000, None)

            # Write output as proper WAV file at 8kHz
            out_buf = io.BytesIO()
            with wave.open(out_buf, 'wb') as wav_out:
                wav_out.setnchannels(1)
                wav_out.setsampwidth(samp_width)
                wav_out.setframerate(8000)
                wav_out.writeframes(pcm_data)

            return out_buf.getvalue()
        except Exception as e:
            print(f"[TTS] Audio resample failed: {e}. Using original audio.")
            return audio_data

    def synthesize_telugu(self, text: str) -> ContentFile:
        """
        Converts Telugu text into speech using Sarvam AI.
        Returns a Django ContentFile containing audio resampled to 8kHz for Exotel telephony.
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
            "speaker": "shreya",  # Female voice option (excellent for Telugu reminders)
            "target_language_code": "te-IN",
            "pace": 1.00,
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

        raw_audio = base64.b64decode(audio_base64)

        # Resample to 8kHz mono 16-bit WAV for Exotel telephony compatibility
        audio_data = self._resample_to_8k(raw_audio)

        return ContentFile(audio_data, name="reminder.wav")

    def synthesize_hindi(self, text: str) -> ContentFile:
        """
        Converts Hindi text into speech using Sarvam AI.
        Returns a Django ContentFile containing audio resampled to 8kHz for Exotel telephony.
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
            return ContentFile(audio_data, name="mock_reminder_hindi.mp3")

        headers = {
            "api-subscription-key": self.api_key,
            "Content-Type": "application/json"
        }

        # Correct payload schema for Sarvam AI Bulbul v3 API
        payload = {
            "text": text,
            "speaker": "shreya",  # Female voice option (excellent for Hindi reminders)
            "target_language_code": "hi-IN",
            "pace": 1.00,
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

        raw_audio = base64.b64decode(audio_base64)

        # Resample to 8kHz mono 16-bit WAV for Exotel telephony compatibility
        audio_data = self._resample_to_8k(raw_audio)

        return ContentFile(audio_data, name="reminder_hindi.wav")
