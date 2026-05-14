import os
import time
import sys
import django

# Setup Django environment
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medicalcamp_inventory.settings')
django.setup()

from inventory.ocr_service import MedicalOCRService

def run_benchmark():
    service = MedicalOCRService()
    
    # Path to a sample image
    image_dir = 'media/scanned_reports'
    
    if len(sys.argv) > 1:
        test_image = os.path.join(image_dir, sys.argv[1])
    else:
        images = [f for f in os.listdir(image_dir) if f.endswith('.jpg')]
        if not images:
            print("No images found in media/scanned_reports")
            return
        test_image = os.path.join(image_dir, images[0])
    print(f"Benchmarking OCR with image: {test_image}")
    print(f"Original size: {os.path.getsize(test_image) / (1024*1024):.2f} MB")
    
    start_time = time.time()
    data, raw_text = service.process_report(test_image)
    end_time = time.time()
    
    duration = end_time - start_time
    print("-" * 30)
    print(f"Benchmark Results:")
    print(f"Total Time: {duration:.2f} seconds")
    print(f"Status: {raw_text}")
    print(f"Data Found: {list(data.keys()) if data else 'None'}")
    print("-" * 30)

if __name__ == "__main__":
    run_benchmark()
