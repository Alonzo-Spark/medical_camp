import os
import json
import re
import threading
import PIL.Image
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables from the .env file in the project root
current_dir = os.path.dirname(os.path.abspath(__file__))
dotenv_path = os.path.join(current_dir, '..', '.env')
load_dotenv(dotenv_path)

class MedicalOCRService:
    def __init__(self):
        self.lock = threading.Lock()
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            print("WARNING: GEMINI_API_KEY not found in environment variables.")
            self.model = None
            return
            
        genai.configure(api_key=api_key)
        # Using Gemini 3.1 Flash-Lite (as supported in this environment)
        self.model = genai.GenerativeModel('gemini-3.1-flash-lite')
        print("OCR: Gemini Vision Engine Initialized.")

    def process_report(self, image_path):
        with self.lock:
            if not self.model:
                return {}, "Gemini API key not configured."
                
            try:
                img = PIL.Image.open(image_path)
                
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
                
                response = self.model.generate_content(
                    [prompt, img],
                    generation_config=genai.GenerationConfig(
                        response_mime_type="application/json",
                        temperature=0.1
                    )
                )
                
                content = response.text
                
                try:
                    structured_data = json.loads(content)
                    return structured_data, "Extracted via Gemini Vision"
                except json.JSONDecodeError:
                    # Fallback to regex extraction if JSON parsing fails
                    json_match = re.search(r'(\{.*\})', content, re.DOTALL)
                    if json_match:
                        try:
                            structured_data = json.loads(json_match.group(1))
                            return structured_data, "Extracted via Gemini Vision (Regex Fallback)"
                        except Exception:
                            pass
                    return {}, "Failed to parse JSON structure"
                    
            except Exception as e:
                print(f"OCR Error: {e}")
                return {}, str(e)
