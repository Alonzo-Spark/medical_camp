import asyncio
import os
import base64
from dotenv import load_dotenv
from inventory.voicebot_inbound import Inbound, WebSocket

class MockWebSocket:
    def __init__(self):
        self.client_state = 1 # CONNECTED
    async def send_json(self, msg):
        print(f"WS SEND: event={msg.get('event')}, media_bytes={len(msg.get('media', {}).get('payload', ''))}")

async def test_tts():
    load_dotenv()
    inbound = Inbound()
    ws = MockWebSocket()
    
    print("Testing TTS...")
    await inbound._sarvam_tts_stream_to_exotel(
        ws=ws,
        text="Hello, how are you?",
        stream_sid="mock_sid",
        language="te-IN",
        speaker="anushka"
    )
    print("TTS test completed.")

if __name__ == "__main__":
    asyncio.run(test_tts())
