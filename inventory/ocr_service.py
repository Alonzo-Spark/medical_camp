import cv2
import numpy as np
import re
import json
import os
import threading
import base64
from django.conf import settings
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Attempt to import ZhipuAI
try:
    from zhipuai import ZhipuAI
    ZHIPU_ENABLED = True
except ImportError:
    ZHIPU_ENABLED = False

class MedicalOCRService:
    def __init__(self):
        self.lock = threading.Lock()
        self.client = None
        
        # Initialize AI Client
        api_key = os.getenv("ZHIPUAI_API_KEY")
        if ZHIPU_ENABLED and api_key:
            try:
                self.client = ZhipuAI(api_key=api_key)
                print("OCR: GLM-4.6v Vision Engine Initialized.")
            except: pass

    def encode_image(self, image_path):
        """Encode image to base64 for API transmission"""
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')

    def extract_with_glm_vision(self, image_path):
        """Primary Engine: 100% GLM-4.6v Multimodal Extraction"""
        if not self.client:
            return None, "Client not initialized"
        
        print(f"OCR: Starting GLM-4.6v Vision extraction for {image_path}...")
        base64_image = self.encode_image(image_path)
        image_url = f"data:image/jpeg;base64,{base64_image}"
        
        # Original successful prompt from session aecececc
        prompt = """
        You are a Medical Document Digitization expert. Extract ALL data from this report into JSON.
        
        ### PRECISION RULES:
        1. **Demographics**: Extract 'patient_id' and 'entry_no' (whole numbers).
        2. **Vitals**: Extract weight, height, bp, pulse, rbs, hemo.
        3. **Clinical**: Extract doctor_name, doctor_id, and full diagnosis.
        4. **Lab Tests**: Look at the 'Diagnosis & Tests' section. Identify the tests requested and return their numeric IDs as an array in 'lab_tests'.
           MAPPING (Test Name -> ID):
           CBP: 1
           ESR: 2
           LFT: 3
           LIPID PROFILE: 4
           ECG: 5
           CHEST X RAY DIGITAL: 6
           URINE EXAMINATION: 7
           HBA 1C: 8
           THYROID PROFILE: 9
           URIC ACID: 10
           VIDAL: 11
           MALARIA: 12
           CALCIUM: 13
           CRP: 14
           RA FACTOR: 15
           KFT: 16
           VITAMIN D: 17
           B 12: 18
           SCAN: 19
           2D ECHO: 20
           IRON PROFILE: 21
           X RAY 2 VIEW: 22
           
        5. **Medicines**: Extract as a list of objects {ms_no, medicine_name, strength, days, morning, afternoon, night, quantity}.
        
        Return ONLY raw JSON. If a value is missing, use "".
        """


        
        try:
            response = self.client.chat.completions.create(
                model="glm-4.6v",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {"url": image_url}}
                        ]
                    }
                ],
                max_tokens=4000,
                temperature=0.1
            )
            content = response.choices[0].message.content
            
            # Extract JSON from potential markdown code blocks
            json_match = re.search(r'(\{.*\})', content, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
                try:
                    return json.loads(json_str), "Success"
                except json.JSONDecodeError:
                    # Basic repair: Try to fix missing commas between "key": "value" pairs
                    # This is a common AI error in JSON output
                    repaired = re.sub(r'"\s*\n\s*"', '",\n"', json_str)
                    try:
                        return json.loads(repaired), "Success (Repaired)"
                    except:
                        return None, f"Malformed JSON: {content[:100]}"
            return None, "No JSON found"
        except Exception as e:
            print(f"OCR: GLM Vision failed: {e}")
            return None, str(e)

    def process_report(self, image_path):
        with self.lock:
            try:
                # 100% GLM Vision Path (Reverted to aecececc version)
                structured_data, error_msg = self.extract_with_glm_vision(image_path)
                
                if structured_data:
                    return structured_data, "Extracted via GLM-4.6v Vision"
                
                return {}, f"Error: {error_msg}"
            except Exception as e:
                print(f"OCR Error: {e}")
                return {}, str(e)
