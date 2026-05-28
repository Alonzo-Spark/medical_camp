import django
import os
import re
import csv
from datetime import datetime

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medicalcamp_inventory.settings')
django.setup()

from inventory.models import Medicine, MedicineCategory

def parse_stock(stock_val):
    if not stock_val:
        return 0
    stock_val = stock_val.strip()
    if '/' in stock_val:
        parts = stock_val.split('/')
        try:
            return int(float(parts[0].replace(',', '').strip()))
        except Exception:
            return 0
    try:
        return int(float(stock_val.replace(',', '').strip()))
    except Exception:
        return 0

def parse_expiry(exp_val):
    if not exp_val:
        return None
    exp_val = exp_val.strip()
    for fmt in ("%b-%y", "%b-%Y", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(exp_val, fmt).date()
        except ValueError:
            continue
    return None

def parse_cost(cost_val):
    if not cost_val:
        return None
    cost_val = cost_val.strip()
    try:
        return float(cost_val.replace(',', ''))
    except Exception:
        return None

# Load rows
with open('MED LIST-MEDSTOCK1.csv', 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    rows = list(reader)

current_category_title = "OTHERS"
current_category_code = "M"

# Pre-create/ensure default category
default_cat, _ = MedicineCategory.objects.get_or_create(short_code="M", defaults={'name': "OTHERS - M"})

i = 0
imported_uqids = set()
imported_count = 0
while i < len(rows):
    row = rows[i]
    row = [cell.strip() for cell in row]
    
    if not any(row):
        i += 1
        continue
        
    # Check if this row is a category header
    if len(row) > 1 and row[1] and (len(row) <= 2 or not row[2]):
        val = row[1]
        if not val.isdigit() and val.lower() not in ['s.no', 'medicine name', 'exp date', 'exp dt', 'exp date']:
            current_category_title = val
            # Extract letter code A-M
            match = re.search(r'-\s*([A-Z])(?:\s*\(|$|\s*-)', val)
            if match:
                current_category_code = match.group(1)
            else:
                current_category_code = val[:20] # fallback
            i += 1
            continue
            
    # Skip table header rows
    if len(row) > 1 and row[1].lower() in ['s.no']:
        i += 1
        continue
        
    # Process medicine row
    if len(row) > 2 and row[1].isdigit():
        uqid = int(row[1])
        name = row[2]
        exp_date = parse_expiry(row[3]) if len(row) > 3 else None
        stock = parse_stock(row[4]) if len(row) > 4 else 0
        cost = parse_cost(row[5]) if len(row) > 5 else None
        
        # Look ahead for formulation lines
        formulation_parts = []
        j = i + 1
        while j < len(rows):
            next_row = [cell.strip() for cell in rows[j]]
            if not any(next_row):
                j += 1
                continue
            if len(next_row) > 1 and next_row[1]:
                # Next medicine, category or table header starts
                break
            if len(next_row) > 2 and next_row[2]:
                formulation_parts.append(next_row[2])
            j += 1
            
        formulation = " ".join(formulation_parts).strip()
        
        # Ensure category in database
        category, _ = MedicineCategory.objects.get_or_create(
            short_code=current_category_code,
            defaults={'name': current_category_title}
        )
        if category.name != current_category_title:
            category.name = current_category_title
            category.save()
            
        # Update or create the medicine record
        medicine, created = Medicine.objects.update_or_create(
            uqid=uqid,
            defaults={
                'name': name,
                'formulation': formulation,
                'category': category,
                'stock': stock,
                'expiry_date': exp_date,
                'cost': cost,
                'is_active': True
            }
        )
        imported_uqids.add(uqid)
        imported_count += 1
        i = j
        continue
        
    i += 1

# Deactivate medicines not in the new CSV
deactivated_count = Medicine.objects.exclude(uqid__in=imported_uqids).update(is_active=False)

print(f"Successfully processed {imported_count} medicines. Deactivated {deactivated_count} deprecated medicines.")
