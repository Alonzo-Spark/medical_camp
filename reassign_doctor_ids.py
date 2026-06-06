"""
Reassign Doctor IDs so they map alphabetically (A=1, B=2, …).
Updates Doctor PKs, CampWiseDoctor FKs, ManualPatientRecord FKs,
and PatientVitals.dr_id (char field).

Run with:
  venv/bin/python reassign_doctor_ids.py
"""
import os, re, django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medicalcamp_inventory.settings')
django.setup()

from django.db import connection
from inventory.models import Doctor

# ── 1. Build the ordered mapping ──────────────────────────────────────────────
def sort_key(doc):
    return re.sub(r'^Dr\.?\s*', '', doc.name, flags=re.IGNORECASE).strip().lower()

doctors_sorted = sorted(Doctor.objects.all(), key=sort_key)
id_map = {doc.id: idx + 1 for idx, doc in enumerate(doctors_sorted)}

print("=== Planned remapping ===")
for doc in doctors_sorted:
    print(f"  #{id_map[doc.id]:>2}  {doc.name}  (was #{doc.id})")

# ── 2. Execute with raw SQLite (PRAGMA foreign_keys OFF) ─────────────────────
with connection.cursor() as cur:
    cur.execute("PRAGMA foreign_keys = OFF")

    # --- Doctor table: move to negative temp IDs first, then to final IDs ---
    for old_id in id_map:
        cur.execute(f"UPDATE inventory_doctor SET id = {-old_id} WHERE id = {old_id}")
    for old_id, new_id in id_map.items():
        cur.execute(f"UPDATE inventory_doctor SET id = {new_id} WHERE id = {-old_id}")

    # --- CampWiseDoctor FK ---
    for old_id in id_map:
        cur.execute(f"UPDATE inventory_campwisedoctor SET doctor_id = {-old_id} WHERE doctor_id = {old_id}")
    for old_id, new_id in id_map.items():
        cur.execute(f"UPDATE inventory_campwisedoctor SET doctor_id = {new_id} WHERE doctor_id = {-old_id}")

    # --- ManualPatientRecord FK ---
    for old_id in id_map:
        cur.execute(f"UPDATE inventory_manualpatientrecord SET doctor_id = {-old_id} WHERE doctor_id = {old_id}")
    for old_id, new_id in id_map.items():
        cur.execute(f"UPDATE inventory_manualpatientrecord SET doctor_id = {new_id} WHERE doctor_id = {-old_id}")

    # --- PatientVitals.dr_id (stored as string of the old Doctor PK) ---
    # Use temp negative string values to avoid collision
    for old_id in id_map:
        cur.execute(f"UPDATE patient_vitals SET dr_id = '-{old_id}' WHERE dr_id = '{old_id}'")
    for old_id, new_id in id_map.items():
        cur.execute(f"UPDATE patient_vitals SET dr_id = '{new_id}' WHERE dr_id = '-{old_id}'")

    cur.execute("PRAGMA foreign_keys = ON")

print("\n=== Done! Final state ===")
for doc in Doctor.objects.all().order_by('id'):
    print(f"  #{doc.id}  {doc.name}")
