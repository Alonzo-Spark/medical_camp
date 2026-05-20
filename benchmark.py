import os
import time
import sys
import django
import PIL.Image
import json
import re
import google.generativeai as genai

# Setup Django environment
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medicalcamp_inventory.settings')
django.setup()

from inventory.ocr_service import MedicalOCRService

def calculate_accuracy(data):
    if not data:
        return 0.0, ["No data extracted."]

    scores = []
    details = []
    
    # 1. Top-Level Completeness (40% Weight)
    expected_top = ['patient_id', 'entry_no', 'vitals', 'clinical', 'lab_tests', 'medicines']
    top_found = [f for f in expected_top if f in data]
    top_score = (len(top_found) / len(expected_top)) * 100
    scores.append((top_score, 0.40))
    details.append(f"Top-level fields: {len(top_found)}/{len(expected_top)} found ({top_score:.0f}%)")

    # 2. Vitals Sub-fields (20% Weight)
    vitals = data.get('vitals')
    if isinstance(vitals, dict):
        expected_vitals = ['weight', 'height', 'bp', 'pulse', 'rbs', 'hemo']
        vitals_keys = list(vitals.keys())
        vitals_found = []
        for k in expected_vitals:
            if k in vitals_keys:
                vitals_found.append(k)
            elif k == 'bp' and 'blood_pressure' in vitals_keys:
                vitals_found.append(k)
            elif k == 'hemo' and 'haemoglobin' in vitals_keys:
                vitals_found.append(k)
        vitals_score = (len(vitals_found) / len(expected_vitals)) * 100
    else:
        vitals_score = 0.0
    scores.append((vitals_score, 0.20))
    details.append(f"Vitals sub-fields: {vitals_score:.0f}% complete")

    # 3. Clinical Sub-fields (20% Weight)
    clinical = data.get('clinical')
    if isinstance(clinical, dict):
        expected_clinical = ['doctor_name', 'doctor_id', 'diagnosis']
        clinical_keys = list(clinical.keys())
        clinical_found = []
        for k in expected_clinical:
            if k in clinical_keys:
                clinical_found.append(k)
            elif k == 'doctor_name' and 'dr_name' in clinical_keys:
                clinical_found.append(k)
            elif k == 'doctor_id' and 'dr_id' in clinical_keys:
                clinical_found.append(k)
        clinical_score = (len(clinical_found) / len(expected_clinical)) * 100
    else:
        clinical_score = 0.0
    scores.append((clinical_score, 0.20))
    details.append(f"Clinical sub-fields: {clinical_score:.0f}% complete")

    # 4. Medicines Sub-fields Structure (20% Weight)
    medicines = data.get('medicines')
    if isinstance(medicines, list) and len(medicines) > 0:
        expected_med_keys = ['ms_no', 'medicine_name', 'strength', 'days', 'morning', 'afternoon', 'night', 'quantity']
        total_med_fields = len(medicines) * len(expected_med_keys)
        med_fields_found = 0
        for med in medicines:
            if isinstance(med, dict):
                med_keys = list(med.keys())
                for k in expected_med_keys:
                    if k in med_keys:
                        med_fields_found += 1
                    elif k == 'ms_no' and 'msNo' in med_keys:
                        med_fields_found += 1
        med_score = (med_fields_found / total_med_fields) * 100 if total_med_fields > 0 else 0.0
    elif 'medicines' in data:
        med_score = 100.0  # Field present but empty (no prescriptions)
    else:
        med_score = 0.0
    scores.append((med_score, 0.20))
    details.append(f"Medicines structure: {med_score:.0f}% complete")

    final_score = sum(s * w for s, w in scores)
    return final_score, details

def run_benchmark():
    service = MedicalOCRService()
    
    # Path to a sample image
    image_dir = 'media/scanned_reports'
    
    if len(sys.argv) > 1:
        test_image = os.path.join(image_dir, sys.argv[1])
    else:
        # Get all images in the directory and find the latest one based on modification time
        images = [os.path.join(image_dir, f) for f in os.listdir(image_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
        if not images:
            print("No images found in media/scanned_reports")
            return
        # Sort by modification time, newest first
        images.sort(key=os.path.getmtime, reverse=True)
        test_image = images[0]
        
    print(f"Benchmarking OCR with image: {test_image}")
    print(f"Original size: {os.path.getsize(test_image) / (1024*1024):.2f} MB")
    
    if not service.model:
        print("Gemini model not initialized. Make sure GEMINI_API_KEY is set in environment.")
        return

    # 1. Encoding Time (Load/prepare image)
    start_encode = time.time()
    try:
        img = PIL.Image.open(test_image)
        img.load()
        encoding_time = time.time() - start_encode
    except Exception as e:
        print(f"Failed to open/encode image: {e}")
        return

    # 2. API Latency
    prompt = """
    You are a Medical Document Digitization expert. Extract ALL data from this report into JSON.
    
    ### PRECISION RULES:
    1. **Demographics**: Extract 'patient_id' and 'entry_no' (whole numbers).
    2. **Vitals**: Extract weight, height, bp, pulse, rbs, hemo.
    3. **Clinical**: Extract doctor_name, doctor_id, and full diagnosis.
    4. **Lab Tests**: Look at the 'Diagnosis & Tests' section. Identify the tests requested and return their numeric IDs as an array in 'lab_tests'.
       MAPPING (Test Name -> ID):
       CBP: 1, ESR: 2, LFT: 3, LIPID PROFILE: 4, ECG: 5, CHEST X RAY DIGITAL: 6, URINE EXAMINATION: 7, HBA 1C: 8, THYROID PROFILE: 9, URIC ACID: 10, VIDAL: 11, MALARIA: 12, CALCIUM: 13, CRP: 14, RA FACTOR: 15, KFT: 16, VITAMIN D: 17, B 12: 18, SCAN: 19, 2D ECHO: 20, IRON PROFILE: 21, X RAY 2 VIEW: 22
       
    5. **Medicines**: Extract as a list of objects {ms_no, medicine_name, strength, days, morning, afternoon, night, quantity}.
    
    Return ONLY raw JSON. If a value is missing, use "". Do not use markdown formatting.
    """
    
    print("Sending request to Gemini API...")
    start_api = time.time()
    try:
        response = service.model.generate_content(
            [prompt, img],
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.1
            )
        )
        content = response.text
        api_latency = time.time() - start_api
    except Exception as e:
        print(f"API call failed: {e}")
        return

    # 3. Parsing Time
    start_parse = time.time()
    structured_data = None
    try:
        structured_data = json.loads(content)
    except json.JSONDecodeError:
        json_match = re.search(r'(\{.*\})', content, re.DOTALL)
        if json_match:
            try:
                structured_data = json.loads(json_match.group(1))
            except Exception:
                pass
    parsing_time = time.time() - start_parse

    total_duration = encoding_time + api_latency + parsing_time

    # Calculate percentages
    enc_pct = (encoding_time / total_duration) * 100 if total_duration > 0 else 0
    api_pct = (api_latency / total_duration) * 100 if total_duration > 0 else 0
    parse_pct = (parsing_time / total_duration) * 100 if total_duration > 0 else 0

    # Calculate Accuracy Score
    accuracy_score, accuracy_details = calculate_accuracy(structured_data)

    print("\n" + "=" * 50)
    print("FINAL PERFORMANCE REPORT")
    print("=" * 50)
    print(f"Encoding Time:        {encoding_time:6.2f}s ({enc_pct:5.1f}%)")
    print(f"API Latency:          {api_latency:6.2f}s ({api_pct:5.1f}%)")
    print(f"Parsing Time:         {parsing_time:6.2f}s ({parse_pct:5.1f}%)")
    print("-" * 50)
    print(f"TOTAL DURATION:       {total_duration:6.2f}s")
    print("=" * 50)
    print(f"EXTRACTION ACCURACY:  {accuracy_score:.1f}%")
    print("-" * 50)
    for detail in accuracy_details:
        print(f" - {detail}")
    print("=" * 50)
    print("\nSAMPLE DATA EXTRACTED:")
    if structured_data:
        print(json.dumps(structured_data, indent=2))
    else:
        print("Failed to parse response as JSON. Raw Response:")
        print(content)
    print("=" * 50)

if __name__ == "__main__":
    run_benchmark()
