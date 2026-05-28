from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.db.models import Sum

from .models import MedicalCamp, Medicine, CampWiseStock, PatientMedicineIssue

@receiver(post_save, sender=MedicalCamp)
def create_camp_stock(sender, instance, created, **kwargs):
    if created:
        medicines = Medicine.objects.all()
        for medicine in medicines:
            CampWiseStock.objects.get_or_create(
                camp=instance,
                medicine=medicine,
                defaults={'allocated_stock': 0, 'used_stock': 0}
            )

def recalculate_camp_medicine_stock(camp, medicine):
    """Recalculates the used_stock field in CampWiseStock based on actual database entries."""
    # Sum the quantities of all PatientMedicineIssue for this camp and medicine
    total_used = PatientMedicineIssue.objects.filter(camp=camp, medicine=medicine).aggregate(
        total=Sum('qty')
    )['total'] or 0
    
    # Update or create the CampWiseStock entry
    # pyrefly: ignore [missing-attribute]
    camp_stock, _ = CampWiseStock.objects.get_or_create(
        camp=camp,
        medicine=medicine,
        defaults={'allocated_stock': 0, 'used_stock': 0}
    )
    camp_stock.used_stock = total_used
    camp_stock.save()

@receiver(post_save, sender=PatientMedicineIssue)
def update_camp_stock_on_save(sender, instance, **kwargs):
    """Recalculates used_stock when a PatientMedicineIssue is created or updated."""
    recalculate_camp_medicine_stock(instance.camp, instance.medicine)

@receiver(post_delete, sender=PatientMedicineIssue)
def update_camp_stock_on_delete(sender, instance, **kwargs):
    """Recalculates used_stock when a PatientMedicineIssue is deleted."""
    recalculate_camp_medicine_stock(instance.camp, instance.medicine)