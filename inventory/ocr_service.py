import cv2
import numpy as np
import re
import json
import os
import threading
import google.generativeai as genai
from django.conf import settings
from dotenv import load_dotenv
import PIL.Image

# Load environment variables
load_dotenv()

# Initialize Gemini Client
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    print("WARNING: GEMINI_API_KEY not found in environment. OCR will fail.")

class MedicalOCRService:
    def __init__(self):
        self.lock = threading.Lock()
        
        # Configure Gemini Model
        if GEMINI_API_KEY:
            self.model = genai.GenerativeModel('gemini-3.1-flash-lite')
            print("OCR: Gemini 3.1 Flash-Lite Vision Engine Initialized.")
        else:
            self.model = None

    def extract_with_gemini(self, image_path):
        """Primary Engine: 100% Gemini Flash Multimodal Extraction"""
        if not self.model:
            return None, "Gemini client not initialized (Missing API Key)"
        
        print(f"OCR: Starting Gemini extraction for {image_path}...")
        
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
                return structured_data, "Success"
            except json.JSONDecodeError:
                json_match = re.search(r'(\{.*\})', content, re.DOTALL)
                if json_match:
                    return json.loads(json_match.group(1)), "Success (Regex)"
                return None, f"Malformed JSON: {content[:100]}"
                
        except Exception as e:
            print(f"OCR: Gemini Vision failed: {e}")
            return None, str(e)

    def process_report(self, image_path):
        with self.lock:
            try:
                # 100% Gemini Vision Path
                structured_data, error_msg = self.extract_with_gemini(image_path)
                
                if structured_data:
                    return structured_data, "Extracted via Gemini 3.1 Flash-Lite Vision"
                
                return {}, f"Error: {error_msg}"
            except Exception as e:
                print(f"OCR Error: {e}")
                return {}, str(e)
