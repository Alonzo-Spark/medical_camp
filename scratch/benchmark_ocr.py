import os
import sys
import time
import json
import django

# Setup Django environment
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medicalcamp_inventory.settings')
django.setup()

from inventory.models import ScanSession
from inventory.ocr_service import MedicalOCRService

def run_benchmark():
    if len(sys.argv) > 1:
        session_id = sys.argv[1].strip()
    else:
        session_id = "9200596902b04077850cbb0662a3b424"
    print(f"Fetching session: {session_id}")
    
    try:
        # pyrefly: ignore [missing-attribute]
        session = ScanSession.objects.get(session_id=session_id)
        test_image = session.image.path
    # pyrefly: ignore [missing-attribute]
    except ScanSession.DoesNotExist:
        print(f"Error: Scan session with ID {session_id} not found in database.")
        return
        
    if not os.path.exists(test_image):
        print(f"Error: Test image not found at {test_image}")
        return
        
    print(f"--- STARTING OCR BENCHMARK ---")
    print(f"Image: {test_image}")
    print(f"Deep Thinking: DISABLED (as per ocr_service.py)")
    
    start_time = time.time()
    service = MedicalOCRService()
    
    try:
        extracted_data, msg = service.process_report(test_image)
        end_time = time.time()
        
        duration = end_time - start_time
        print(f"\n--- BENCHMARK RESULTS ---")
        print(f"Time Taken: {duration:.2f} seconds")
        print(f"Status Message: {msg}")
        print("\nExtracted Data (Accuracy Check):")
        print(json.dumps(extracted_data, indent=2))
        
    except Exception as e:
        print(f"Benchmark failed: {str(e)}")

run_benchmark()
