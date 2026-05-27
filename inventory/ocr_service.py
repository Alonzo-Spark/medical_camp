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

def clean_and_parse_json(content, is_list=False):
    content = content.strip()
    if content.startswith("```"):
        lines = content.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        content = "\n".join(lines).strip()

    pattern = r'(\[.*\])' if is_list else r'(\{.*\})'
    match = re.search(pattern, content, re.DOTALL)
    if match:
        json_str = match.group(1)
    else:
        json_str = content

    json_str = re.sub(r':\s*0+(\d+)', r': \1', json_str)
    json_str = re.sub(r',\s*([\]}])', r'\1', json_str)
    return json.loads(json_str)

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
                   
                5. **Medicines**: Extract as a list of objects {ms_no, medicine_name, strength, days, quantity}. Extract the exact quantity listed in the report directly instead of calculating it from daily dosages.
                
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
                    structured_data = clean_and_parse_json(content, is_list=False)
                    return structured_data, "Extracted via Gemini Vision"
                except Exception as e:
                    print(f"JSON Parse Error in process_report: {e}")
                    return {}, "Failed to parse JSON structure"
                    
            except Exception as e:
                print(f"OCR Error: {e}")
                return {}, str(e)

    def process_patient_list(self, image_path):
        with self.lock:
            if not self.model:
                return [], "Gemini API key not configured."
                
            try:
                img = PIL.Image.open(image_path)
                
                prompt = """
                You are a Medical Document Digitization expert. Extract the table of patients from this sheet into a clean JSON list.
                For each patient, extract:
                1. 'patient_id' (integer, use number if found, or try to extract it from the row)
                2. 'name' (patient's name)
                3. 'gender' (Male, Female, or Other)
                4. 'age' (integer or empty string)
                5. 'address' (string)
                6. 'contact_no' (string)
                7. 'reg_date' (format YYYY-MM-DD or empty string)
                8. 'old_or_new' (string: 'Old' or 'New', classify based on layout, notes, or date)
                
                Return the extracted data as a JSON list of objects:
                [{"patient_id": 101, "name": "John Doe", "gender": "Male", "age": 45, "address": "...", "contact_no": "...", "reg_date": "...", "old_or_new": "New"}]
                
                Return ONLY raw JSON list. Do not include any markdown styling, explanation or wrapper.
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
                    structured_data = clean_and_parse_json(content, is_list=True)
                    return structured_data, "Extracted successfully"
                except Exception as e:
                    print(f"JSON Parse Error in process_patient_list: {e}")
                    return [], "Failed to parse JSON structure"
            except Exception as e:
                print(f"OCR Error in process_patient_list: {e}")
                return [], str(e)
