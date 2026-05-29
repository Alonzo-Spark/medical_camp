import os
import requests
from dotenv import load_dotenv

load_dotenv()

account_sid = os.getenv("EXOTEL_ACCOUNT_SID")
api_key = os.getenv("EXOTEL_API_KEY")
api_token = os.getenv("EXOTEL_API_TOKEN")
caller_id = os.getenv("EXOTEL_VIRTUAL_NUMBER")
my_phone_number = "08897921297" # Using the number the user tested with

base_url = os.getenv("PUBLIC_WEBHOOK_URL", "http://localhost:8000")
# Convert https:// to wss://
ws_url = base_url.replace("http://", "ws://").replace("https://", "wss://") + "/ws/exotel_inbound"

exotel_url = f"https://api.exotel.com/v1/Accounts/{account_sid}/Calls/connect.json"

data = {
    "From": my_phone_number,
    "CallerId": caller_id,
    "CallType": "trans",
    # Try passing Stream parameters directly
    "StreamUrl": ws_url,
    "StreamType": "bidirectional"
}

print(f"Triggering with StreamUrl: {ws_url}")
response = requests.post(exotel_url, auth=(api_key, api_token), data=data)

print("Status:", response.status_code)
print("Body:", response.text)
