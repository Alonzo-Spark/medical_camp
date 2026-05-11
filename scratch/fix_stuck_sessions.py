import os
import django
import sys
from datetime import datetime, timedelta
from django.utils import timezone

sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medicalcamp_inventory.settings')
django.setup()

from inventory.models import ScanSession

# Fix sessions stuck in 'processing' for more than 10 minutes
ten_minutes_ago = timezone.now() - timedelta(minutes=10)
stuck_sessions = ScanSession.objects.filter(ocr_status='processing', created_at__lt=ten_minutes_ago)

count = stuck_sessions.count()
for s in stuck_sessions:
    print(f"Fixing stuck session: {s.session_id}")
    s.ocr_status = 'error'
    s.save()

print(f"Fixed {count} stuck sessions.")
