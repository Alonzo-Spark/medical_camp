import os
import django
import pandas as pd
import re

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medicalcamp_inventory.settings')
django.setup()

from inventory.models import Medicine, MedicineCategory

print("Reading MED LIST.xlsx...")
df = pd.read_excel('/home/pavithra-philomena/MAIN/MED LIST.xlsx', sheet_name='MEDSTOCK1')
records = df.to_dict('records')

current_category = None
updated_count = 0
created_count = 0

for row in records:
    col_keys = list(df.columns)
    
    # Actually, the columns are shifted.
    # index 1: S.No or Category
    # index 2: Medicine Name
    # index 3: EXP DATE
    # index 5: COST
    # index 6: TOTAL STOCK
    
    val1 = str(row.get(col_keys[1], '')).strip()
    val2 = str(row.get(col_keys[2], '')).strip()
    
    if val1.lower() == 'nan' and val2.lower() == 'nan':
        continue
        
    if val1 != 'nan' and val2.lower() == 'nan' and not str(val1).isdigit() and "COST" not in str(val1) and "S.No" not in str(val1):
        cat_name = val1
        current_category, _ = MedicineCategory.objects.get_or_create(
            name=cat_name,
            defaults={'short_code': cat_name[:20]}
        )
        continue
        
    if val2.lower() != 'nan' and val2 != 'Medicine Name':
        try:
            uqid_val = str(val1)
            if uqid_val.endswith('.0'):
                uqid_val = uqid_val[:-2]
            uqid = int(uqid_val) if uqid_val.isdigit() else None
        except ValueError:
            uqid = None
            
        if uqid is None:
            continue
            
        med_name = val2
        formulation = "Other"
        clean_name = med_name
        
        upper_name = med_name.upper()
        if upper_name.startswith("TAB"):
            formulation = "Tablet"
            clean_name = re.sub(r'^(TAB\s*-\s*|TAB\s+)', '', med_name, flags=re.IGNORECASE).strip()
        elif upper_name.startswith("CAP"):
            formulation = "Capsule"
            clean_name = re.sub(r'^(CAP\s*-\s*|CAP\s+)', '', med_name, flags=re.IGNORECASE).strip()
        elif upper_name.startswith("SYP"):
            formulation = "Syrup"
            clean_name = re.sub(r'^(SYP\s*-\s*|SYP\s+)', '', med_name, flags=re.IGNORECASE).strip()
        elif upper_name.startswith("INJ"):
            formulation = "Injection"
            clean_name = re.sub(r'^(INJ\s*-\s*|INJ\s+)', '', med_name, flags=re.IGNORECASE).strip()
        elif upper_name.startswith("OINT"):
            formulation = "Ointment"
            clean_name = re.sub(r'^(OINT\s*-\s*|OINT\s+)', '', med_name, flags=re.IGNORECASE).strip()
        elif upper_name.startswith("CREAM"):
            formulation = "Cream"
            clean_name = re.sub(r'^(CREAM\s*-\s*|CREAM\s+)', '', med_name, flags=re.IGNORECASE).strip()
        elif upper_name.startswith("DROP"):
            formulation = "Drops"
            clean_name = re.sub(r'^(DROPS?\s*-\s*|DROPS?\s+)', '', med_name, flags=re.IGNORECASE).strip()
        elif upper_name.startswith("POWDER") or upper_name.startswith("PWD"):
            formulation = "Powder"
            clean_name = re.sub(r'^(POWDER|PWD)\s*-\s*|^(POWDER|PWD)\s+', '', med_name, flags=re.IGNORECASE).strip()
            
        if len(clean_name) <= 1:
            clean_name = med_name

        company = '' # not reliably in this sheet
        
        cost_val = row.get(col_keys[5], 0)
        cost = float(cost_val) if not pd.isna(cost_val) and str(cost_val).replace('.','',1).isdigit() else 0.0
        
        stock_val = row.get(col_keys[6], 0)
        stock = int(stock_val) if not pd.isna(stock_val) and str(stock_val).isdigit() else 0
        
        # update or create Medicine
        med, created = Medicine.objects.update_or_create(
            uqid=uqid,
            defaults={
                'name': clean_name,
                'formulation': formulation,
                'category': current_category,
                'cost': cost if cost > 0 else 0,
                'stock': stock if stock > 0 else 0
            }
        )
        
        if created:
            created_count += 1
        else:
            updated_count += 1

print(f"Successfully updated {updated_count} medicines and created {created_count} new medicines!")
