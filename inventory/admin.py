from django.contrib import admin
from .models import (
    Medicine, MedicineCategory, MedicalCamp, MedicalCampVenue, 
    PatientMedicineIssue, Vitals, PatientVitals, TestIssue, 
    MedicalTest, CampWiseStock
)

class MedicineAdmin(admin.ModelAdmin):
    # pyrefly: ignore [bad-override-mutable-attribute]
    list_display = ['uqid', 'name', 'formulation', 'category', 'stock', 'expiry_date']
    # pyrefly: ignore [bad-override-mutable-attribute]
    list_filter = ['category', 'expiry_date']
    # pyrefly: ignore [bad-override-mutable-attribute]
    search_fields = ['uqid', 'name', 'category']

class VitalsAdmin(admin.ModelAdmin):
    # pyrefly: ignore [bad-override-mutable-attribute]
    list_display = ['patient_id', 'camp', 'blood_pressure', 'glucose', 'haemoglobin']
    # pyrefly: ignore [bad-override-mutable-attribute]
    list_filter = ['camp']

class IssueInline(admin.TabularInline):
    model = PatientMedicineIssue
    extra = 0
    fields = ['medicine', 'qty', 'strength', 'days', 'morning', 'afternoon', 'night']

class PatientVitalsAdmin(admin.ModelAdmin):
    # pyrefly: ignore [bad-override-mutable-attribute]
    list_display = ['patient_id', 'camp', 'date', 'weight', 'blood_pressure', 'glucose', 'pulse', 'dr_name']
    # pyrefly: ignore [bad-override-mutable-attribute]
    list_filter = ['camp', 'date', 'dr_name']
    # pyrefly: ignore [bad-override-mutable-attribute]
    search_fields = ['patient_id', 'diagnosis', 'dr_name']
    # pyrefly: ignore [bad-override-mutable-attribute]
    inlines = [IssueInline]

admin.site.register(Medicine, MedicineAdmin)
admin.site.register(MedicineCategory)
admin.site.register(MedicalCamp)
admin.site.register(MedicalCampVenue)
admin.site.register(PatientMedicineIssue)
admin.site.register(Vitals, VitalsAdmin)
admin.site.register(PatientVitals, PatientVitalsAdmin)
admin.site.register(MedicalTest)
admin.site.register(TestIssue)

class CampWiseStockAdmin(admin.ModelAdmin):
    # pyrefly: ignore [bad-override-mutable-attribute]
    list_display = ['camp', 'medicine_name', 'allocated_stock', 'used_stock', 'remaining_stock_display']
    # pyrefly: ignore [bad-override-mutable-attribute]
    list_filter = ['camp', 'medicine']
    # pyrefly: ignore [bad-override-mutable-attribute]
    search_fields = ['medicine__name', 'camp__venue']

    def medicine_name(self, obj):
        return obj.medicine.name
    
    def remaining_stock_display(self, obj):
        return obj.remaining_stock()
    # pyrefly: ignore [missing-attribute]
    remaining_stock_display.short_description = 'Remaining'

admin.site.register(CampWiseStock, CampWiseStockAdmin)