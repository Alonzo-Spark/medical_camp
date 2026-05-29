import asyncio
import os
import requests
from django.utils import timezone
from asgiref.sync import sync_to_async

@sync_to_async
def process_retries():
    from django.db import models
    from inventory.models import Patient
    
    # Need to retry patients who failed and have retries left
    now = timezone.now()
    patients_to_retry = Patient.objects.filter(
        call_status__in=['failed', 'no-answer', 'busy'],
        retry_count__lt=3
    ).filter(
        models.Q(next_retry_time__lte=now) | models.Q(next_retry_time__isnull=True)
    )
    
    if not patients_to_retry.exists():
        return
        
    account_sid = os.getenv("EXOTEL_ACCOUNT_SID")
    api_key = os.getenv("EXOTEL_API_KEY")
    api_token = os.getenv("EXOTEL_API_TOKEN")
    caller_id = os.getenv("EXOTEL_VIRTUAL_NUMBER")
    
    if not all([account_sid, api_key, api_token, caller_id]):
        print("Retry Task: Missing Exotel credentials.")
        return

    # Use localhost or whatever PUBLIC_WEBHOOK_URL is set to
    base_url = os.getenv("PUBLIC_WEBHOOK_URL", "http://localhost:8000")
    call_flow_url = f"{base_url}/api/exotel_call_flow/"
    webhook_url = f"{base_url}/api/exotel_webhook/"
    
    exotel_url = f"https://api.exotel.com/v1/Accounts/{account_sid}/Calls/connect.json"
    
    for patient in patients_to_retry:
        phone = patient.contact_no
        if not phone or len(phone) < 10:
            continue
            
        data = {
            "From": phone,
            "CallerId": caller_id,
            "CallType": "trans",
            "Url": call_flow_url,
            "StatusCallback": webhook_url,
            "StatusCallbackEvents[0]": "terminal",
            "CustomField": str(patient.patient_id)
        }
        
        try:
            response = requests.post(exotel_url, auth=(api_key, api_token), data=data)
            if response.status_code in [200, 201]:
                patient.call_status = "queued"
                patient.retry_count += 1
                # Set next retry to 15 mins from now
                patient.next_retry_time = now + timezone.timedelta(minutes=15)
                # patient.latest_call_sid = response.json().get("Call", {}).get("Sid")
                patient.save()
                print(f"Retry Task: Queued call for patient {patient.patient_id}")
            else:
                print(f"Retry Task: Exotel API error for patient {patient.patient_id}: {response.text}")
                # Increment retry anyway to avoid infinite loops on bad numbers
                patient.retry_count += 1
                patient.next_retry_time = now + timezone.timedelta(minutes=15)
                patient.save()
        except Exception as e:
            print(f"Retry Task: Error calling Exotel: {e}")

async def exotel_retry_loop():
    print("Started Exotel Retry Background Task...")
    while True:
        try:
            # We must import models here because django is loaded dynamically in asgi
            from django.db import models
            import inventory.models
            await process_retries()
        except Exception as e:
            print(f"Exotel Retry Loop Error: {e}")
        
        # Check every 1 minute
        await asyncio.sleep(60)
