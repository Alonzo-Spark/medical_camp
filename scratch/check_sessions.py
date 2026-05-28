import os
import django
import sys

sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medicalcamp_inventory.settings')
django.setup()

from inventory.models import ScanSession

# pyrefly: ignore [missing-attribute]
sessions = ScanSession.objects.all().order_by('-created_at')[:5]
for s in sessions:
    print(f"ID: {s.session_id}, Status: {s.ocr_status}, Completed: {s.is_completed}")
