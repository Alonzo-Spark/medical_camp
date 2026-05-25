import pandas as pd
import json
import re

df = pd.read_excel('/home/pavithra-philomena/MAIN/MED LIST.xlsx', sheet_name='MEDSTOCK1')
records = df.to_dict('records')

results = []
current_classification = "Unclassified"

for row in records:
    col0 = str(row.get(df.columns[0], '')).strip()
    col1 = str(row.get(df.columns[1], '')).strip()
    
    if col0.lower() == 'nan' and col1.lower() == 'nan':
        continue
        
    # Check if this row might be a classification heading
    if col0 != 'nan' and col1.lower() == 'nan' and not str(col0).isdigit() and "COST" not in str(col0) and "S.No" not in str(col0):
        current_classification = col0
        continue
        
    if col1.lower() != 'nan' and col1 != 'Medicine Name':
        med_name = col1
        
        # Extract formulation (TAB, CAP, SYP, OINT, etc.)
        formulation = "Other"
        clean_name = med_name
        
        upper_name = med_name.upper()
        if upper_name.startswith("TAB"):
            formulation = "Tablet"
            clean_name = med_name[3:].strip(" -")
        elif upper_name.startswith("CAP"):
            formulation = "Capsule"
            clean_name = med_name[3:].strip(" -")
        elif upper_name.startswith("SYP"):
            formulation = "Syrup"
            clean_name = med_name[3:].strip(" -")
        elif upper_name.startswith("INJ"):
            formulation = "Injection"
            clean_name = med_name[3:].strip(" -")
        elif upper_name.startswith("OINT"):
            formulation = "Ointment"
            clean_name = med_name[4:].strip(" -")
        elif upper_name.startswith("CREAM"):
            formulation = "Cream"
            clean_name = med_name[5:].strip(" -")
        elif upper_name.startswith("DROP"):
            formulation = "Drops"
            clean_name = med_name[4:].strip(" -S")
        elif upper_name.startswith("POWDER") or upper_name.startswith("PWD"):
            formulation = "Powder"
            clean_name = re.sub(r'^(POWDER|PWD)', '', upper_name, flags=re.IGNORECASE).strip(" -")
        
        # Avoid adding empty names or weird strings
        if len(clean_name) > 1:
            results.append({
                "name": clean_name,
                "formulation": formulation,
                "classification": current_classification,
                "original_name": med_name
            })

# Save to a json file in the medical_camp directory
with open('extracted_meds.json', 'w') as f:
    json.dump(results, f, indent=2)

print(f"Extracted {len(results)} medicines.")
