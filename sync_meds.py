import os
import django
import pandas as pd

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medicalcamp_inventory.settings')
django.setup()

from inventory.models import Medicine

# Read all uqids from excel
df = pd.read_excel('/home/pavithra-philomena/MAIN/MED LIST.xlsx', sheet_name='MEDSTOCK1')
records = df.to_dict('records')
col_keys = list(df.columns)

excel_uqids = set()
for row in records:
    val1 = str(row.get(col_keys[1], '')).strip()
    if val1.isdigit():
        excel_uqids.add(int(val1))

# Find medicines in DB not in excel
db_uqids = set(Medicine.objects.values_list('uqid', flat=True))
to_delete = db_uqids - excel_uqids

print(f"Excel has {len(excel_uqids)} valid uqids.")
print(f"DB has {len(db_uqids)} valid uqids.")
print(f"Medicines to delete (not in excel): {to_delete}")

# Try deleting them one by one to see which ones fail
failed_deletes = []
for uqid in to_delete:
    try:
        Medicine.objects.get(uqid=uqid).delete()
    except Exception as e:
        failed_deletes.append(uqid)

print(f"Failed to delete {len(failed_deletes)} medicines due to FK constraints: {failed_deletes}")
