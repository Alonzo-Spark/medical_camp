import os
import django
import sys
import dotenv

# Load .env variables
dotenv.load_dotenv()

# Setup django environment
sys.path.append("/home/neeraj/MedicalCamp/Medical_Camp")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "medicalcamp_inventory.settings")
django.setup()

from voicebot.services.intent_service import IntentService

def run_tests():
    print("Initializing IntentService...")
    svc = IntentService()
    
    # Test cases for Q1 (Tests completed)
    test_cases_q1 = [
        (
            "నేను సీబీపీ చేయించాను షుగర్ ఇంకా లేదు",
            ["CBP", "Sugar"],
            {"CBP": True, "Sugar": False}
        ),
        (
            "అన్నీ చేయించుకున్నాను అండి",
            ["CBP", "RBS", "BP"],
            {"CBP": True, "RBS": True, "BP": True}
        ),
        (
            "ఇంకా లేదు రేపు వెళ్తాను",
            ["CBP", "Sugar"],
            {"CBP": False, "Sugar": False}
        )
    ]
    
    print("\n--- Testing Q1 (Tests Completed) ---")
    for transcript, tests, expected in test_cases_q1:
        print(f"\nTranscript: '{transcript}'")
        print(f"Prescribed Tests: {tests}")
        result = svc.classify_multi_test_q1(transcript, tests)
        print(f"Result:   {result}")
        print(f"Expected: {expected}")
        assert result == expected, f"Q1 match failed! Got {result}, expected {expected}"
        print("PASS")

    # Test cases for Q2 (Reports received)
    test_cases_q2 = [
        (
            "సిబీపీ వచ్చింది షుగర్ ఇంకా రాలేదు",
            ["CBP", "Sugar"],
            {"CBP": True, "Sugar": False}
        ),
        (
            "అవును రిపోర్ట్స్ వచ్చాయి",
            ["CBP", "Sugar"],
            {"CBP": True, "Sugar": True}
        )
    ]
    
    print("\n--- Testing Q2 (Reports Received) ---")
    for transcript, tests, expected in test_cases_q2:
        print(f"\nTranscript: '{transcript}'")
        print(f"Prescribed Tests: {tests}")
        result = svc.classify_multi_test_q2(transcript, tests)
        print(f"Result:   {result}")
        print(f"Expected: {expected}")
        assert result == expected, f"Q2 match failed! Got {result}, expected {expected}"
        print("PASS")
        
    print("\nAll multi-test intent classification tests passed successfully!")

if __name__ == "__main__":
    run_tests()
