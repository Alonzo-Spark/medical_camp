import os
import requests
import base64
import wave
import io

def get_api_key():
    with open(".env", "r") as f:
        for line in f:
            if line.startswith("SARVAM_API_KEY="):
                return line.strip().split("=")[1].strip('"\'')
    return None

SARVAM_API_KEY = get_api_key()

def generate_audio():
    url = "https://api.sarvam.ai/text-to-speech"
    
    inputs = [
        "నమస్కారం, మేము సి.సి.సి మెడికల్ క్యాంప్ నుండి కాల్ చేస్తున్నాము.",
        "మీ తదుపరి క్యాంప్ జూన్ 7, 2026 న పద్మారావు నగర్ లో ఉంటుంది. సమయం ఉదయం 7 గంటల నుండి మధ్యాహ్నం 1 గంట వరకు.",
        "ధన్యవాదాలు. "
    ]

    payload = {
        "inputs": inputs,
        "target_language_code": "te-IN",
        "speaker": "kavitha",
        "speech_sample_rate": 8000,
        "enable_preprocessing": True,
        "model": "bulbul:v3"
    }
    
    headers = {
        "api-subscription-key": SARVAM_API_KEY,
        "Content-Type": "application/json"
    }

    print("Generating Telugu voice in chunks by making separate API calls...")
    
    all_audios = []
    
    for i, text_chunk in enumerate(inputs):
        print(f"Requesting chunk {i+1}...")
        payload = {
            "inputs": [text_chunk],
            "target_language_code": "te-IN",
            "speaker": "kavitha",
            "pace": 1.1,
            "speech_sample_rate": 8000,
            "enable_preprocessing": True,
            "model": "bulbul:v3"
        }
        
        response = requests.post(url, json=payload, headers=headers)
        
        if response.status_code == 200:
            response_data = response.json()
            audios = response_data.get("audios", [])
            if audios:
                all_audios.append(audios[0])
            else:
                print(f"No audio returned for chunk {i+1}")
        else:
            print(f"Failed on chunk {i+1}! Status Code: {response.status_code}")
            print(response.text)
            
    if not all_audios:
        print("No audios generated.")
        return

    print(f"Received {len(all_audios)} audio chunks total. Stitching together with pauses...")
    
    outfile = "test_telugu_reminder.wav"
    
    with wave.open(outfile, 'wb') as wf_out:
        for i, audio_b64 in enumerate(all_audios):
            audio_bytes = base64.b64decode(audio_b64)
            with wave.open(io.BytesIO(audio_bytes), 'rb') as wf_in:
                if i == 0:
                    wf_out.setparams(wf_in.getparams())
                    
                    # Store parameters for silence generation
                    nchannels = wf_in.getnchannels()
                    sampwidth = wf_in.getsampwidth()
                    framerate = wf_in.getframerate()
                    
                wf_out.writeframes(wf_in.readframes(wf_in.getnframes()))
                
    print(f"Success! Audio saved as {outfile}")

if __name__ == "__main__":
    generate_audio()
