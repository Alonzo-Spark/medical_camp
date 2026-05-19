import os
import time
import sys
import json
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medicalcamp_inventory.settings')
django.setup()

from inventory.ocr_service import MedicalOCRService

def calculate_deep_accuracy(data):
    if not data:
        return 0, 0, 0.0
        
    expected_fields = {
        'patient_id': None, 'entry_no': None, 
        'weight': 'vitals', 'height': 'vitals', 'bp': 'vitals', 
        'pulse': 'vitals', 'rbs': 'vitals', 'hemo': 'vitals', 
        'doctor_id': 'clinical', 'diagnosis': 'clinical'
    }
    
    # Check for alternate flat keys (wt instead of weight, etc)
    alt_keys = {'weight': 'wt', 'height': 'ht', 'bp': 'bp', 'pulse': 'pulse', 'rbs': 'rbs', 'hemo': 'hemo'}
    
    filled = 0
    total = len(expected_fields)
    
    for field, category in expected_fields.items():
        # Check flat exact match
        val = data.get(field)
        
        # Check flat alternate match (e.g., wt instead of weight)
        if val is None and field in alt_keys:
            val = data.get(alt_keys[field])
            
        # Check nested match
        if val is None and category and category in data and isinstance(data[category], dict):
            val = data[category].get(field)
            if val is None and field in alt_keys:
                val = data[category].get(alt_keys[field])
                
        if val is not None and str(val).strip() != "":
            filled += 1
            
    # Check medicines depth
    medicines = data.get('medicines', [])
    if medicines:
        med_fields = ['ms_no', 'strength', 'days', 'quantity']
        for med in medicines:
            for field in med_fields:
                total += 1
                val = med.get(field, "")
                if str(val).strip() not in ["", "-", "/"]:
                    filled += 1
                    
    accuracy = (filled / total) * 100 if total > 0 else 0
    return filled, total, accuracy

def run_benchmark():
    service = MedicalOCRService()
    image_dir = 'media/scanned_reports'
    
    if len(sys.argv) > 1:
        target_image = sys.argv[1]
        if not target_image.startswith('media/'):
            target_image = os.path.join(image_dir, target_image)
        if not os.path.exists(target_image):
            print(f"❌ Error: Cannot find the image '{target_image}'")
            return
        test_images = [os.path.basename(target_image)]
    else:
        images = [f for f in os.listdir(image_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png', '.pdf'))]
        if not images:
            print("❌ No images found to benchmark.")
            return
        images.sort(key=lambda x: os.path.getmtime(os.path.join(image_dir, x)), reverse=True)
        test_images = [images[0]]
    
    print("\n" + "="*60)
    print("PROPER OCR BENCHMARK SCRIPT")
    print("="*60)
    
    img_file = test_images[0]
    test_image = os.path.join(image_dir, img_file)
    file_size_mb = os.path.getsize(test_image) / (1024 * 1024)
    
    print(f"\nProcessing File: {img_file} ({file_size_mb:.2f} MB)")
    
    start_time = time.time()
    data, status = service.process_report(test_image)
    duration = time.time() - start_time
    
    filled, total, accuracy_score = calculate_deep_accuracy(data)
    
    print(f"Time Taken     : {duration:.2f} seconds")
    print(f"Accuracy Score : {accuracy_score:.1f}% Completeness (Found {filled}/{total} detailed fields)")
    print(f"Status         : {status}")
    
    print("\n" + "="*60)
    print("FULL EXTRACTED JSON DATA")
    print("="*60)
    if data:
        print(json.dumps(data, indent=2))
    else:
        print("Failed to extract data.")
    print("="*60 + "\n")

if __name__ == "__main__":
    run_benchmark()
