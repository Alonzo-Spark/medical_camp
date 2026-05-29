import asyncio
import websockets
import json

async def test_ws():
    uri = "ws://localhost:8000/ws/exotel_inbound"
    print(f"Connecting to {uri}...")
    try:
        async with websockets.connect(uri) as ws:
            print("Connected!")
            
            # Simulate Exotel "connected" event
            await ws.send(json.dumps({
                "event": "connected"
            }))
            
            # Wait for response or error
            try:
                msg = await ws.recv()
                print("Received:", msg)
            except websockets.exceptions.ConnectionClosed as e:
                print(f"Connection closed: {e.code} {e.reason}")
    except Exception as e:
        print(f"Failed to connect: {e}")

if __name__ == "__main__":
    asyncio.run(test_ws())
