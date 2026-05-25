import os
import django
import pandas as pd
import math
import re

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medicalcamp_inventory.settings')
django.setup()

from inventory.models import Medicine, MedicineCategory

print("Clearing existing medicines and categories...")
Medicine.objects.all().delete()
MedicineCategory.objects.all().delete()

print("Reading MED LIST.xlsx...")
df = pd.read_excel('/home/pavithra-philomena/MAIN/MED LIST.xlsx', sheet_name='MEDSTOCK1')
records = df.to_dict('records')

current_category = None
added_count = 0

for row in records:
    col0 = str(row.get(df.columns[0], '')).strip()
    col1 = str(row.get(df.columns[1], '')).strip()
    
    if col0.lower() == 'nan' and col1.lower() == 'nan':
        continue
        
    # Check if this row is a classification heading
    # Usually col0 has text, col1 is nan, and it's not a cost total row or column header
    if col0 != 'nan' and col1.lower() == 'nan' and not str(col0).isdigit() and "COST" not in str(col0) and "S.No" not in str(col0):
        cat_name = col0
        # Create category
        current_category, _ = MedicineCategory.objects.get_or_create(
            name=cat_name,
            defaults={'short_code': cat_name[:20]}
        )
        continue
        
    if col1.lower() != 'nan' and col1 != 'Medicine Name':
        # This is a medicine row
        try:
            uqid_val = str(col0)
            if uqid_val.endswith('.0'):
                uqid_val = uqid_val[:-2]
            uqid = int(uqid_val) if uqid_val.isdigit() else None
        except ValueError:
            uqid = None
            
        if uqid is None:
            # If no valid ID, we can't really add it easily if uqid is required as an int.
            # But let's check if it's required. In models.py: uqid = models.IntegerField(unique=True)
            # Let's generate one if missing
            uqid = added_count + 1000
            
        med_name = col1
        
        # Extract formulation (TAB, CAP, SYP, etc.)
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

        # other columns:
        # col2: CMP (Company Name)
        # col3: UNIT COST
        # col5: STOCK
        company = str(row.get(df.columns[2], ''))
        company = company if company.lower() != 'nan' else ''
        
        cost_val = row.get(df.columns[3], 0)
        cost = float(cost_val) if not pd.isna(cost_val) and str(cost_val).replace('.','',1).isdigit() else 0.0
        
        stock_val = row.get(df.columns[5], 0)
        stock = int(stock_val) if not pd.isna(stock_val) and str(stock_val).isdigit() else 0
        
        # Handle duplicates in uqid just in case
        while Medicine.objects.filter(uqid=uqid).exists():
            uqid += 1

        Medicine.objects.create(
            uqid=uqid,
            name=clean_name,
            formulation=formulation,
            category=current_category,
            company_name=company,
            cost=cost,
            stock=stock
        )
        added_count += 1

print(f"Successfully added {added_count} medicines!")
