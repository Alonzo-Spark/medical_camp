"""
Simulates what Exotel sends over WebSocket so we can see the full flow locally.
"""
import asyncio
import json
import websockets

WS_URL = "ws://localhost:8000/ws/exotel_inbound"

async def simulate_call():
    print(f"Connecting to {WS_URL}...")
    async with websockets.connect(WS_URL) as ws:
        print("Connected!")

        # Step 1: Send 'connected' event (Exotel always sends this first)
        await ws.send(json.dumps({"event": "connected"}))
        print("Sent: connected")

        # Step 2: Send 'start' event with stream metadata
        await ws.send(json.dumps({
            "event": "start",
            "stream_sid": "test_stream_123",
            "streamSid": "test_stream_123",
            "start": {
                "streamSid": "test_stream_123",
                "callSid": "test_call_456",
                "from": "08897921297",
                "caller": "08897921297",
            }
        }))
        print("Sent: start event")

        # Step 3: Listen for the bot's greeting for up to 15 seconds
        print("Waiting for bot greeting...")
        try:
            for i in range(60):  # 60 x 0.25s = 15 seconds
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=0.25)
                    parsed = json.loads(msg)
                    event = parsed.get("event")
                    if event == "media":
                        payload_len = len(parsed.get("media", {}).get("payload", ""))
                        print(f"  [AUDIO FRAME #{i}] received {payload_len} bytes of audio!")
                    else:
                        print(f"  [EVENT] {event}: {msg[:100]}")
                except asyncio.TimeoutError:
                    print(f"  ... waiting ({i}/60)")
        except websockets.ConnectionClosed as e:
            print(f"Connection closed: {e.code} {e.reason}")

if __name__ == "__main__":
    asyncio.run(simulate_call())
