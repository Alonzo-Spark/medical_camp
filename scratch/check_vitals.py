import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Medical_Camp.settings')
django.setup()

from inventory.models import Vitals, PatientVitals

print("--- Vitals (Old) ---")
for v in Vitals.objects.all():
    print(f"ID: {v.id}, Patient: {v.patient_id}, Camp: {v.camp}, Date: {v.camp.date if v.camp else 'NONE'}")

print("\n--- Patient Vitals (New) ---")
for v in PatientVitals.objects.all():
    print(f"ID: {v.id}, Patient: {v.patient_id}, Camp: {v.camp}, Date field: {v.date}, Camp Date: {v.camp.date if v.camp else 'NONE'}")
