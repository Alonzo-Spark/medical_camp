import cv2
import numpy as np
import re
import json
import os
import threading
import io
from django.conf import settings
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Attempt to import modern Gemini SDK
try:
    from google import genai
    from google.genai import types
    from PIL import Image
    GEMINI_ENABLED = True
except ImportError:
    GEMINI_ENABLED = False

class MedicalOCRService:
    def __init__(self):
        self.lock = threading.Lock()
        self.client = None
        
        # Initialize Gemini Client
        api_key = os.getenv("GEMINI_API_KEY")
        if GEMINI_ENABLED and api_key:
            try:
                self.client = genai.Client(api_key=api_key)
                print("OCR: Gemini 1.5 Flash Vision Engine Initialized.")
            except Exception as e:
                print(f"Failed to initialize Gemini: {e}")

    def extract_with_gemini_vision(self, image_path):
        """Primary Engine: Gemini Multimodal Extraction"""
        if not self.client:
            return None, "Gemini Client not initialized. Is GEMINI_API_KEY set?"
        
        print(f"OCR: Starting Gemini Vision extraction for {image_path}...")
        
        prompt = """
        You are a highly accurate Medical Document Digitization expert. Extract ALL handwritten and printed data from this report into JSON.
        
        ### PRECISION RULES:
        1. **Demographics**: Extract 'patient_id' and 'entry_no' (whole numbers).
        2. **Vitals**: Extract weight, height, bp, pulse, rbs, hemo.
        3. **Clinical**: Extract 'doctor_name' (the name of the physician/doctor), 'doctor_id', and full 'diagnosis'. Do not leave doctor_name blank if there is a signature or name.
        4. **Lab Tests**: Look at the 'Diagnosis & Tests' section. Identify the tests requested and return their numeric IDs as an array in 'lab_tests'.
           MAPPING (Test Name -> ID):
           CBP: 1, ESR: 2, LFT: 3, LIPID PROFILE: 4, ECG: 5, CHEST X RAY DIGITAL: 6, URINE EXAMINATION: 7, HBA 1C: 8, THYROID PROFILE: 9, URIC ACID: 10, VIDAL: 11, MALARIA: 12, CALCIUM: 13, CRP: 14, RA FACTOR: 15, KFT: 16, VITAMIN D: 17, B 12: 18, SCAN: 19, 2D ECHO: 20, IRON PROFILE: 21, X RAY 2 VIEW: 22
           
        5. **Medicines**: Extract the prescribed medicines as a list of objects with EXACTLY these keys: {"ms_no": "", "medicine_name": "", "strength": "", "days": "", "morning": "", "afternoon": "", "night": "", "quantity": ""}.
           - 'ms_no': The M.S.NO or ID of the medicine.
           - 'medicine_name': The FULL text name of the medication (e.g., 'TAB GLYCOMET 250 mg', 'TAB ORMIPRO 5'). MUST extract this if visible on the row.
           - 'morning', 'afternoon', 'night': Dosage values (e.g., "1", "2", "0", or "/").
           - 'strength', 'days', 'quantity': Numeric values for the prescription.
        
        Return ONLY raw JSON. If a value is missing or unreadable, use "".
        """

        try:
            # Open image with PIL and convert to bytes
            pil_image = Image.open(image_path)
            
            # Convert RGBA to RGB if needed (JPEG doesn't support alpha)
            if pil_image.mode == 'RGBA':
                pil_image = pil_image.convert('RGB')
                
            # --- SPEED OPTIMIZATION ---
            # Phone cameras produce massive 5MB-10MB 4K images which take forever to upload and process.
            # Downscaling to a max dimension of 1200px makes it lightning fast while retaining perfect OCR quality.
            max_dimension = 1200
            if max(pil_image.size) > max_dimension:
                pil_image.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
                
            image_byte_arr = io.BytesIO()
            pil_image.save(image_byte_arr, format='JPEG', quality=80)
            image_bytes = image_byte_arr.getvalue()
            
            # Retry logic for 503 High Demand or 429 Quota Limits
            max_retries = 3
            import time
            for attempt in range(max_retries):
                try:
                    response = self.client.models.generate_content(
                        model='gemini-2.5-flash',
                        contents=[
                            types.Part.from_bytes(
                                data=image_bytes,
                                mime_type='image/jpeg',
                            ),
                            prompt
                        ],
                        config=types.GenerateContentConfig(temperature=0.1)
                    )
                    content = response.text
                    break
                except Exception as e:
                    err_str = str(e)
                    if ("503" in err_str or "429" in err_str) and attempt < max_retries - 1:
                        print(f"OCR: Gemini API busy/rate-limited, retrying in 5 seconds... (Attempt {attempt+1})")
                        time.sleep(5)
                    else:
                        raise e
            
            # Extract JSON from potential markdown code blocks
            json_match = re.search(r'(\{.*\})', content, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
                try:
                    return json.loads(json_str), "Success"
                except json.JSONDecodeError:
                    # Basic repair: Try to fix missing commas between "key": "value" pairs
                    repaired = re.sub(r'"\s*\n\s*"', '",\n"', json_str)
                    try:
                        return json.loads(repaired), "Success (Repaired)"
                    except:
                        return None, f"Malformed JSON: {content[:100]}"
            return None, "No JSON found"
        except Exception as e:
            print(f"OCR: Gemini Vision failed: {e}")
            return None, str(e)

    def process_report(self, image_path):
        with self.lock:
            try:
                # Gemini Vision Path
                structured_data, error_msg = self.extract_with_gemini_vision(image_path)
                
                if structured_data:
                    # --- AUTO-FILL INJECTION ---
                    # Because doctors often only write IDs on the paper, the AI cannot extract names that aren't there.
                    # We inject the actual names from the database directly into the JSON here to satisfy the frontend.
                    from inventory.models import Medicine, Doctor
                    try:
                        # Auto-fill Doctor Name
                        doc_id = structured_data.get('doctor_id')
                        if doc_id and not structured_data.get('doctor_name'):
                            doctor = Doctor.objects.filter(id=doc_id).first()
                            if doctor:
                                structured_data['doctor_name'] = doctor.name

                        # Auto-fill Medicine Names
                        if 'medicines' in structured_data:
                            for med in structured_data['medicines']:
                                ms_no = med.get('ms_no')
                                if ms_no and not med.get('medicine_name'):
                                    try:
                                        medicine = Medicine.objects.filter(uqid=int(ms_no)).first()
                                        if medicine:
                                            med['medicine_name'] = medicine.name
                                            if not med.get('formulation') and medicine.formulation:
                                                med['formulation'] = medicine.formulation
                                    except ValueError:
                                        pass
                    except Exception as db_err:
                        print(f"OCR: Database auto-fill injection failed: {db_err}")
                    # ---------------------------

                    return structured_data, "Extracted via Gemini Vision"
                
                return {}, f"Error: {error_msg}"
            except Exception as e:
                print(f"OCR Error: {e}")
                return {}, str(e)
