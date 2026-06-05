import os
import sys

# Add project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medicalcamp_inventory.settings')
django.setup()

from inventory.models import Medicine, CampWiseStock, MedicalCamp
import pandas

df = pandas.read_excel('SWP - 7-6-26.xlsx', sheet_name='MEDCOST')

print("Comparing S.No with uqid:")
matches = 0
mismatches = 0
for idx, row in df.iterrows():
    s_no = row.iloc[0]
    med_name = row.iloc[1]
    unit_cost = row.iloc[3]
    
    # Check if s_no is a number (integer or float)
    if pandas.notna(s_no) and isinstance(s_no, (int, float)):
        s_no = int(s_no)
        try:
            db_med = Medicine.objects.get(uqid=s_no)
            print(f"Match found! S.No: {s_no} | Sheet Name: '{med_name}' | DB Name: '{db_med.name}' | Cost: {unit_cost}")
            matches += 1
        except Medicine.DoesNotExist:
            print(f"No DB medicine with uqid={s_no} (Sheet Name: '{med_name}')")
            mismatches += 1

print(f"\nTotal Matches: {matches}, Mismatches: {mismatches}")
