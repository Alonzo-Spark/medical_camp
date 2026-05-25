import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medicalcamp_inventory.settings')
django.setup()

from inventory.models import Medicine, MedicineCategory

mapping = {
    'A': 'ANTI DIABETIC - A (1-10)',
    'B': 'ANTI HYPERTENSIVE  - B (11-25)',
    'C': 'CHOLESTEROL - C (26-30)',
    'D': 'NEURO MEDICINES  - D (31-35)',
    'E': 'ITCHING & SKIN ALLERGY - E (36-45)',
    'F': 'GASTRIC AND ANTACIDS - F (51-65)',
    'G': 'ANTIBIOTICS - G  (66-75)',
    'H': 'COUGH & COLD  - H (76-85)',
    'I': 'PAIN KILLERS - I (86-100)',
    'J': 'VITAMINS & DIGESTIVE - J (101-115)',
    'K': 'ENT CARE  - K (116-120)',
    'L': 'KIDS -L (121-140)',
    'M': 'OTHERS -M(141-170)'
}

for short_name, full_name in mapping.items():
    try:
        old_cat = MedicineCategory.objects.get(name=short_name)
        try:
            new_cat = MedicineCategory.objects.get(name=full_name)
            # Reassign all medicines
            for med in Medicine.objects.filter(category=old_cat):
                med.category = new_cat
                med.save()
            old_cat.delete()
            print(f"Migrated from {short_name} to {full_name}")
        except MedicineCategory.DoesNotExist:
            print(f"Target category {full_name} not found")
    except MedicineCategory.DoesNotExist:
        pass

print("Done fixing categories.")
