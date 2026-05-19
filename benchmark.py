import os
import time
import sys
import json
import django
from collections import defaultdict

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medicalcamp_inventory.settings')
django.setup()

from inventory.ocr_service import MedicalOCRService

def run_benchmark():
    service = MedicalOCRService()
    image_dir = 'media/scanned_reports'
    
    # If the user passed a specific image name as an argument
    if len(sys.argv) > 1:
        target_image = sys.argv[1]
        # Allow passing full path or just the filename
        if not target_image.startswith('media/'):
            target_image = os.path.join(image_dir, target_image)
            
        if not os.path.exists(target_image):
            print(f"❌ Error: Cannot find the image '{target_image}'")
            return
        test_images = [os.path.basename(target_image)]
    else:
        # Otherwise, just pick the most recent single image
        images = [f for f in os.listdir(image_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png', '.pdf'))]
        if not images:
            print("❌ No images found to benchmark.")
            return
        # Get the latest uploaded image
        images.sort(key=lambda x: os.path.getmtime(os.path.join(image_dir, x)), reverse=True)
        test_images = [images[0]]
    
    print("\n" + "="*60)
    print("🚀 OCR EXTRACTION BENCHMARK")
    print("="*60)
    
    # Expected fields to calculate "Extraction Accuracy / Completeness"
    expected_fields = ['patient_id', 'entry_no', 'vitals', 'clinical', 'lab_tests', 'medicines']
    
    img_file = test_images[0]
    test_image = os.path.join(image_dir, img_file)
    file_size_mb = os.path.getsize(test_image) / (1024 * 1024)
    
    print(f"\nProcessing File: {img_file} ({file_size_mb:.2f} MB)")
    
    # Start the timer before extraction
    start_time = time.time()
    data, status = service.process_report(test_image)
    end_time = time.time()
    
    # Calculate the duration
    duration = end_time - start_time
    
    # Calculate Completeness Score for Accuracy
    found_fields = list(data.keys()) if data else []
    matches = [f for f in expected_fields if f in found_fields]
    accuracy_score = (len(matches) / len(expected_fields)) * 100 if data else 0
    
    # Display Results for this image
    print(f"⏱️ Time Taken     : {duration:.2f} seconds")
    print(f"✅ Accuracy Score : {accuracy_score:.0f}% Completeness (Found {len(matches)}/{len(expected_fields)} main fields)")
    print(f"ℹ️ Status         : {status}")
    
    print("\n" + "="*60)
    print("📋 FULL EXTRACTED JSON DATA")
    print("="*60)
    if data:
        print(json.dumps(data, indent=2))
    else:
        print("❌ Failed to extract data.")
    print("="*60 + "\n")

if __name__ == "__main__":
    run_benchmark()
