import os
import django
import sys

sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medicalcamp_inventory.settings')
django.setup()

from inventory.models import ScanSession

# Get the most recent completed session
# pyrefly: ignore [missing-attribute]
session = ScanSession.objects.filter(ocr_status='completed').order_by('-created_at').first()

if session:
    print(f"Session ID: {session.session_id}")
    print("-" * 20)
    print("RAW TEXT:")
    print(session.ocr_raw_text)
    print("-" * 20)
    print("PARSED DATA:")
    import json
    print(json.dumps(session.ocr_data, indent=2))
else:
    print("No completed sessions found.")
