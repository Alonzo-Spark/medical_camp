import os
import requests
import sys

# Make sure to run this from the same directory as your .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("python-dotenv not installed, assuming env vars are set.")

def test_call(my_phone_number):
    account_sid = os.getenv("EXOTEL_ACCOUNT_SID")
    api_key = os.getenv("EXOTEL_API_KEY")
    api_token = os.getenv("EXOTEL_API_TOKEN")
    caller_id = os.getenv("EXOTEL_VIRTUAL_NUMBER")
    
    # We will use the webhook URL to route the call to your FastAPI websocket
    base_url = os.getenv("PUBLIC_WEBHOOK_URL", "http://localhost:8000")
    ws_url = base_url.replace("http://", "ws://").replace("https://", "wss://") + "/ws/exotel_inbound"
    
    if not all([account_sid, api_key, api_token, caller_id]):
        print("ERROR: Missing Exotel credentials in .env file!")
        return

    exotel_url = f"https://api.exotel.com/v1/Accounts/{account_sid}/Calls/connect.json"
    
    data = {
        "From": my_phone_number,
        "CallerId": caller_id,
        "CallType": "trans",
        "StreamUrl": ws_url,
        "StreamType": "bidirectional"
    }
    
    print(f"Triggering test call to: {my_phone_number}")
    print(f"Using Exotel Number: {caller_id}")
    print(f"Connecting to Stream: {ws_url}")
    
    response = requests.post(exotel_url, auth=(api_key, api_token), data=data)
    
    print("\nExotel Response Status:", response.status_code)
    try:
        print("Exotel Response Body:", response.json())
    except:
        print("Exotel Response Text:", response.text)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_exotel_call.py <YOUR_10_DIGIT_NUMBER>")
        sys.exit(1)
        
    test_number = sys.argv[1]
    test_call(test_number)
