import os
import time
import base64
import json
import re
from dotenv import load_dotenv
from zhipuai import ZhipuAI

# Load API Key
load_dotenv()
api_key = os.getenv("ZHIPUAI_API_KEY")

def benchmark_ocr(image_path):
    if not os.path.exists(image_path):
        print(f"Error: File {image_path} not found.")
        return

    print(f"\n{'='*50}")
    print(f"BENCHMARKING GLM-4.6v VISION OCR")
    print(f"Target Image: {os.path.basename(image_path)}")
    print(f"Image Size: {os.path.getsize(image_path) / 1024 / 1024:.2f} MB")
    print(f"{'='*50}\n")

    results = {}

    # Step 1: Image Encoding
    start_time = time.perf_counter()
    with open(image_path, "rb") as image_file:
        base64_image = base64.b64encode(image_file.read()).decode('utf-8')
    image_url = f"data:image/jpeg;base64,{base64_image}"
    encoding_time = time.perf_counter() - start_time
    results['Encoding'] = encoding_time
    print(f"[1/3] Image Encoding: {encoding_time:.4f}s")

    # Step 2: LLM API Call (The heavy lifting)
    client = ZhipuAI(api_key=api_key)
    prompt = """
    You are a Medical Document Digitization expert. Extract ALL data from this report into JSON.
    
    ### PRECISION RULES:
    1. **Demographics**: Extract 'patient_id' and 'entry_no'. Ensure they are whole numbers.
    2. **Vitals**: Extract weight, height, bp, pulse, rbs, hemo.
    3. **Clinical**: Extract doctor_name, doctor_id, and full diagnosis.
    4. **Medicines**: Extract as a list of objects {ms_no, medicine_name, strength, days, morning, afternoon, night, quantity}.
    
    Return ONLY raw JSON. If a value is missing, use "".
    """

    print(f"[2/3] Calling GLM-4.6v Vision API... (Waiting for response)")
    start_time = time.perf_counter()
    try:
        response = client.chat.completions.create(
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
            max_tokens=2000,
            temperature=0.1
        )
        api_time = time.perf_counter() - start_time
        results['API Call'] = api_time
        content = response.choices[0].message.content
        print(f"[2/3] API Response Received: {api_time:.4f}s")
    except Exception as e:
        print(f"API Error: {e}")
        return

    # Step 3: Parsing and Post-processing
    start_time = time.perf_counter()
    json_match = re.search(r'(\{.*\})', content, re.DOTALL)
    if json_match:
        try:
            extracted_data = json.loads(json_match.group(1))
            parsing_success = True
        except:
            parsing_success = False
    else:
        parsing_success = False
    
    parsing_time = time.perf_counter() - start_time
    results['Parsing'] = parsing_time
    print(f"[3/3] JSON Parsing: {parsing_time:.4f}s")

    # FINAL REPORT
    total_time = sum(results.values())
    print(f"\n{'='*50}")
    print(f"FINAL PERFORMANCE REPORT")
    print(f"{'='*50}")
    print(f"Encoding Time:    {results['Encoding']:>8.2f}s ({(results['Encoding']/total_time)*100:>5.1f}%)")
    print(f"API Latency:      {results['API Call']:>8.2f}s ({(results['API Call']/total_time)*100:>5.1f}%)")
    print(f"Parsing Time:     {results['Parsing']:>8.2f}s ({(results['Parsing']/total_time)*100:>5.1f}%)")
    print(f"{'-'*50}")
    print(f"TOTAL DURATION:   {total_time:>8.2f}s")
    print(f"{'='*50}\n")
    
    if parsing_success:
        print("SAMPLE DATA EXTRACTED:")
        print(json.dumps(extracted_data, indent=2)[:500] + "...")
    else:
        print("FAILED TO PARSE JSON RESPONSE")

if __name__ == "__main__":
    import sys
    # If you provide a path in the terminal, it uses that. Otherwise, it uses the default below.
    if len(sys.argv) > 1:
        TEST_IMAGE = sys.argv[1]
    else:
        TEST_IMAGE = "media/scanned_reports/17785633228943978442955564084444.jpg"
    
    benchmark_ocr(TEST_IMAGE)

