import os
import django
import pandas as pd

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medicalcamp_inventory.settings')
django.setup()

from inventory.models import Medicine, MedicineCategory

print("Reading MED LIST.xlsx...")
df = pd.read_excel('/home/pavithra-philomena/MAIN/MED LIST.xlsx', sheet_name='MEDSTOCK1')
records = df.to_dict('records')
col_keys = list(df.columns)

# First, extract valid categories
current_category = None

# To map uqid -> formulation (which is in the next row)
med_formulations = {}
med_categories = {}
med_names = {}

for i, row in enumerate(records):
    val1 = str(row.get(col_keys[1], '')).strip()
    val2 = str(row.get(col_keys[2], '')).strip()
    
    if val1 != 'nan' and val2.lower() == 'nan' and not val1.isdigit() and "COST" not in val1 and "S.No" not in val1:
        # This is a category header
        cat_name = val1
        current_category, _ = MedicineCategory.objects.get_or_create(
            name=cat_name,
            defaults={'short_code': cat_name[:20]}
        )
        continue
        
    if val1.isdigit():
        uqid = int(val1)
        med_categories[uqid] = current_category
        med_names[uqid] = val2
        
        # Look ahead for formulation in the next row
        if i + 1 < len(records):
            next_row = records[i + 1]
            next_val1 = str(next_row.get(col_keys[1], '')).strip()
            next_val2 = str(next_row.get(col_keys[2], '')).strip()
            
            # If next row has no S.No but has a medicine name, it's the formulation
            if (next_val1.lower() == 'nan' or not next_val1) and next_val2.lower() != 'nan' and next_val2:
                med_formulations[uqid] = next_val2

# Now update the database
for med in Medicine.objects.all():
    if med.uqid in med_categories:
        med.category = med_categories[med.uqid]
        if med.uqid in med_formulations:
            med.formulation = med_formulations[med.uqid]
        med.save()

# Clean up empty categories (those with no medicines attached)
for cat in MedicineCategory.objects.all():
    if not Medicine.objects.filter(category=cat).exists():
        cat.delete()

print("Database fixed!")
