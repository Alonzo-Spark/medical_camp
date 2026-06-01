import os
import google.generativeai as genai

class IntentService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if self.api_key:
            genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel('gemini-3.1-flash-lite')

    def classify_intent(self, question: str, transcript: str) -> tuple:
        if not transcript or len(transcript.strip()) < 2:
            return "UNCLEAR", 1.0

        transcript_lower = transcript.lower()

        if question == "Q1":
            # Keyword matching for YES
            yes_keywords = [
                "అవును", "చేయించుకున్నాను", "చేయించుకున్నాం", "చేయించాను", "చేయించాం", 
                "వెళ్ళాను", "వెళ్ళాం", "తీసుకున్నాను", "తీసుకున్నాం", "తీసుకున్నాము", 
                "అయింది", "అయిపోయింది", "చేసాను", "yes", "avunu", "cheyinchukunnanu", 
                "ninne", "rendu", "done", "completed"
            ]
            for kw in yes_keywords:
                if kw in transcript_lower:
                    return "YES", 0.95
            
            # Keyword matching for NO
            no_keywords = [
                "లేదు", "చేయించుకోలేదు", "వెళ్లలేదు", "చేయలేదు", "చేయలే", 
                "no", "ledu", "cheyinchukoledu"
            ]
            for kw in no_keywords:
                if kw in transcript_lower:
                    return "NO", 0.95
                    
            # Keyword matching for PENDING
            pending_keywords = [
                "ఇంకా", "అపాయింట్మెంట్", "రేపు", "ఎల్లుండి", "వెళ్ళాలి", 
                "inka", "appointment"
            ]
            for kw in pending_keywords:
                if kw in transcript_lower:
                    return "PENDING", 0.95

            # Fallback to Gemini
            prompt = f"""
            You are an expert medical voicebot assistant.
            Classify the patient's Telugu transcript answering the question: "Did you complete the prescribed lab tests?" (మీ ల్యాబ్ టెస్ట్ లు చేయించుకున్నారా?)
            
            Understand both Telugu script, English transliterations (like 'avunu', 'ledu'), and colloquial variations.
            
            Examples:
            - "అవును" or "చేయించుకున్నాను" or "తీసుకున్నాము" or "అయిపోయింది" or "yes" or "done" -> YES
            - "లేదు" or "చేయించుకోలేదు" or "no" or "ledu" -> NO
            - "ఇంకా లేదు" or "రేపు వెళ్తాను" or "pending" or "appointment inka ledu" -> PENDING
            
            Transcript to classify: "{transcript}"
            
            Return ONLY one of these exact words: YES, NO, PENDING, UNCLEAR.
            """
            try:
                response = self.model.generate_content(prompt).text.strip().upper()
                for intent in ["YES", "NO", "PENDING", "UNCLEAR"]:
                    if intent in response:
                        return intent, 0.8
            except Exception as e:
                print(f"[Intent] Gemini error: {e}")
        
        elif question == "Q2":
            # Keyword matching for REPORT_RECEIVED
            yes_keywords = [
                "వచ్చాయి", "తీసుకున్నాను", "తీసుకున్నాం", "తీసుకున్నాము", "తీసుకున్నా", 
                "వచ్చింది", "వచ్చాయ్", "ఇచ్చారు", "ఇచ్చారులే", "వచ్చేసాయి", "yes", "vachayi"
            ]
            for kw in yes_keywords:
                if kw in transcript_lower:
                    return "REPORT_RECEIVED", 0.95
            
            # Keyword matching for REPORT_NOT_RECEIVED
            no_keywords = [
                "రాలేదు", "లేదు", "తీసుకోలేదు", "ఇవ్వలేదు", "రాలే", 
                "no", "ledu", "raledu"
            ]
            for kw in no_keywords:
                if kw in transcript_lower:
                    return "REPORT_NOT_RECEIVED", 0.95

            # Keyword matching for REPORT_PENDING
            pending_keywords = [
                "ఇంకా రాలేదు", "వెయిటింగ్", "waiting", "ఇంకా ఇవ్వలేదు", "రేపు ఇస్తారు"
            ]
            for kw in pending_keywords:
                if kw in transcript_lower:
                    return "REPORT_PENDING", 0.95

            # Fallback to Gemini
            prompt = f"""
            You are an expert medical voicebot assistant.
            Classify the patient's Telugu transcript answering the question: "Did you receive your lab reports?" (మీరు మీ ల్యాబ్ టెస్ట్ ల రిపోర్ట్స్ తీసుకున్నారా?)
            
            Understand both Telugu script, English transliterations (like 'vachayi', 'ledu'), and colloquial variations.
            
            Examples:
            - "వచ్చాయి" or "తీసుకున్నాను" or "తీసుకున్నాము" or "yes" or "received" or "vachayi" -> REPORT_RECEIVED
            - "రాలేదు" or "లేదు" or "తీసుకోలేదు" or "no" or "ledu" -> REPORT_NOT_RECEIVED
            - "ఇంకా రాలేదు" or "రేపు ఇస్తారు" or "waiting" or "pending" -> REPORT_PENDING
            
            Transcript to classify: "{transcript}"
            
            Return ONLY one of these exact words: REPORT_RECEIVED, REPORT_NOT_RECEIVED, REPORT_PENDING, UNCLEAR.
            """
            try:
                response = self.model.generate_content(prompt).text.strip().upper()
                for intent in ["REPORT_RECEIVED", "REPORT_NOT_RECEIVED", "REPORT_PENDING", "UNCLEAR"]:
                    if intent in response:
                        return intent, 0.8
            except Exception as e:
                print(f"[Intent] Gemini error: {e}")

        return "UNCLEAR", 0.5

    def classify_multi_test_q1(self, transcript: str, test_names: list) -> dict:
        """
        Classifies which of the prescribed tests were completed based on the patient's transcript.
        Returns a dict mapping each test name to a boolean indicating if it was completed (True) or not (False).
        """
        if not test_names:
            return {}
        if not transcript or len(transcript.strip()) < 2:
            return {name: False for name in test_names}
            
        test_names_str = ", ".join(test_names)
        prompt = f"""
        You are an expert medical voicebot assistant.
        A patient was prescribed these lab tests: [{test_names_str}].
        The patient was asked: "Did you complete these lab tests?" (మీ ల్యాబ్ టెస్ట్ లు చేయించుకున్నారా?)
        
        Analyze the patient's response in Telugu (which may be in Telugu script, English transliteration, or colloquial mix).
        Determine for each test in the list whether the patient has completed it (YES) or not/pending/no (NO).
        
        Examples:
        1. Patient transcript: "నేను సీబీపీ చేయించాను షుగర్ ఇంకా లేదు" (I did CBP, sugar not yet)
           Tests: [CBP, Sugar]
           Output:
           CBP: YES
           Sugar: NO
           
        2. Patient transcript: "అన్నీ చేయించుకున్నాను అండి" (I did all of them)
           Tests: [CBP, RBS, BP]
           Output:
           CBP: YES
           RBS: YES
           BP: YES
           
        3. Patient transcript: "ఇంకా లేదు రేపు వెళ్తాను" (Not yet, will go tomorrow)
           Tests: [CBP, Sugar]
           Output:
           CBP: NO
           Sugar: NO

        Transcript to classify: "{transcript}"
        
        Return ONLY a JSON block mapping each test name to either "YES" or "NO".
        Do not include any explanation or markdown formatting outside the JSON block.
        Example:
        {{
            "CBP": "YES",
            "Sugar": "NO"
        }}
        """
        try:
            response_text = self.model.generate_content(prompt).text.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()
            
            import json
            data = json.loads(response_text)
            
            result = {}
            for name in test_names:
                found_val = "NO"
                for k, v in data.items():
                    if k.lower().strip() == name.lower().strip():
                        found_val = v
                        break
                result[name] = (str(found_val).upper().strip() == "YES")
            return result
        except Exception as e:
            print(f"[Intent Q1 Multi] Error parsing Gemini JSON: {e}")
            transcript_lower = transcript.lower()
            yes_keywords = ["అవును", "చేయించుకున్నాను", "చేయించుకున్నాం", "చేయించాను", "yes", "done", "completed"]
            all_done = any(kw in transcript_lower for kw in yes_keywords)
            return {name: all_done for name in test_names}

    def classify_multi_test_q2(self, transcript: str, test_names: list) -> dict:
        """
        Classifies which of the completed tests have their reports received.
        Returns a dict mapping each test name to a boolean indicating if report was received (True) or not (False).
        """
        if not test_names:
            return {}
        if not transcript or len(transcript.strip()) < 2:
            return {name: False for name in test_names}
            
        test_names_str = ", ".join(test_names)
        prompt = f"""
        You are an expert medical voicebot assistant.
        A patient completed these lab tests: [{test_names_str}].
        The patient was asked: "Did you receive the reports for these tests?" (మీరు మీ ల్యాబ్ టెస్ట్ ల రిపోర్ట్స్ తీసుకున్నారా?)
        
        Analyze the patient's response in Telugu (which may be in Telugu script, English transliteration, or colloquial mix).
        Determine for each test in the list whether the patient has received the report (YES) or not/pending/no (NO).
        
        Examples:
        1. Patient transcript: "సిబీపీ వచ్చింది షుగర్ ఇంకా రాలేదు" (CBP came, sugar not yet)
           Tests: [CBP, Sugar]
           Output:
           CBP: YES
           Sugar: NO
           
        2. Patient transcript: "అవును రిపోర్ట్స్ వచ్చాయి" (Yes, reports received)
           Tests: [CBP, Sugar]
           Output:
           CBP: YES
           Sugar: YES

        Transcript to classify: "{transcript}"
        
        Return ONLY a JSON block mapping each test name to either "YES" or "NO".
        Do not include any explanation or markdown formatting outside the JSON block.
        Example:
        {{
            "CBP": "YES",
            "Sugar": "NO"
        }}
        """
        try:
            response_text = self.model.generate_content(prompt).text.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()
            
            import json
            data = json.loads(response_text)
            
            result = {}
            for name in test_names:
                found_val = "NO"
                for k, v in data.items():
                    if k.lower().strip() == name.lower().strip():
                        found_val = v
                        break
                result[name] = (str(found_val).upper().strip() == "YES")
            return result
        except Exception as e:
            print(f"[Intent Q2 Multi] Error parsing Gemini JSON: {e}")
            transcript_lower = transcript.lower()
            yes_keywords = ["వచ్చాయి", "తీసుకున్నాను", "వచ్చింది", "yes", "received", "vachayi"]
            all_done = any(kw in transcript_lower for kw in yes_keywords)
            return {name: all_done for name in test_names}
