from django.db import models
from django.contrib.auth.models import User
import uuid

class UserProfile(models.Model):
    ROLE_CHOICES = (
        ('registration_staff', 'Registration Staff'),
        ('log_vitals_staff', 'Log Vitals Staff'),
        ('main_admin', 'Main Admin'),
        ('medicine_entry_staff', 'Medicine Entry Staff'),
    )
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=50, choices=ROLE_CHOICES, default='main_admin')

    def __str__(self):
        return f"{self.user.username} - {self.role}"


class Doctor(models.Model):
    name = models.CharField(max_length=2000)
    specialization = models.CharField(max_length=500, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        return f"{self.name} ({self.specialization or 'General'})"


# Create your models here.
class MedicineCategory(models.Model):
    class Meta:
        verbose_name_plural = "Medicine Categories"

    name = models.CharField(max_length=2000)
    short_code = models.CharField(max_length=20)

    def __str__(self):
        return self.name

class Medicine(models.Model):
    uqid = models.IntegerField(unique=True)
    name = models.CharField(max_length=2000)
    formulation = models.CharField(max_length=4000, null=True, blank=True)
    category = models.ForeignKey(MedicineCategory, on_delete=models.SET_NULL, null=True, blank=True)
    stock = models.IntegerField(default=0)
    expiry_date = models.DateField(null=True, blank=True)
    company_name = models.CharField(max_length=2000, null=True, blank=True)
    cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    def __str__(self):
        return f"{self.uqid} - {self.name} ({self.category}) - Available {self.stock}"

class MedicalCampVenue(models.Model):
    name = models.CharField(max_length=2000)

    def __str__(self):
        return self.name
     
class MedicalCamp(models.Model):
    number = models.IntegerField(unique=True)
    venue = models.ForeignKey(MedicalCampVenue, on_delete=models.CASCADE)
    date = models.DateField()

    def __str__(self):
        return f"{self.venue} -{self.number} on {self.date}"

class PatientMedicineIssue(models.Model):
    patient_id = models.IntegerField()
    camp = models.ForeignKey(MedicalCamp, on_delete=models.CASCADE, to_field='number')
    medicine = models.ForeignKey(Medicine, on_delete=models.CASCADE, to_field='uqid')
    qty = models.IntegerField()
    
    # New clinical fields to link with Vitals
    vitals_record = models.ForeignKey('PatientVitals', on_delete=models.CASCADE, null=True, blank=True, related_name='issued_medicines')
    formulation = models.CharField(max_length=100, null=True, blank=True)
    strength = models.CharField(max_length=100, null=True, blank=True)
    days = models.IntegerField(default=0)
    morning = models.IntegerField(default=0)
    afternoon = models.IntegerField(default=0)
    night = models.IntegerField(default=0)

    def __str__(self):
        return f"Issued {self.qty} of {self.medicine.name} to {self.patient_id} at {self.camp}"


class Vitals(models.Model):
    class Meta:
        verbose_name_plural = "Vitals"

    patient_id = models.IntegerField()
    camp = models.ForeignKey(MedicalCamp, on_delete=models.CASCADE, to_field='number')
    blood_pressure = models.CharField(max_length = 100)
    haemoglobin = models.CharField(max_length = 100)

    def __str__(self):
        return f"Patient : {self.patient_id}, Camp : {self.camp}, Blood Pressure : {self.blood_pressure}, Haemoglobin : {self.haemoglobin}"

class PatientVitals(models.Model):
    class Meta:
        verbose_name_plural = "Patient Vitals"
        db_table = 'patient_vitals'

    patient_id = models.IntegerField()
    camp = models.ForeignKey(MedicalCamp, on_delete=models.CASCADE, to_field='number')
    date = models.DateField(null=True, blank=True)
    time = models.TimeField(null=True, blank=True)
    e_no = models.CharField(max_length=100, null=True, blank=True)
    weight = models.CharField(max_length=100, null=True, blank=True)
    height = models.CharField(max_length=100, null=True, blank=True)
    blood_pressure = models.CharField(max_length=100, null=True, blank=True)
    pulse = models.CharField(max_length=100, null=True, blank=True)
    rbs = models.CharField(max_length=100, null=True, blank=True)
    haemoglobin = models.CharField(max_length=100, null=True, blank=True)
    last_food_time = models.CharField(max_length=200, null=True, blank=True)
    dr_name = models.CharField(max_length=500, null=True, blank=True)
    dr_id = models.CharField(max_length=100, null=True, blank=True)
    diagnosis = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Patient {self.patient_id} - {self.date} at {self.camp}"

class MedicalTest(models.Model):
    test_id = models.IntegerField(unique=True)
    name = models.CharField(max_length=1000)
    actual_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    patient_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    def __str__(self):
        return f"{self.test_id} - {self.name}"
        
class TestIssue(models.Model):
    patient_id = models.IntegerField()
    camp = models.ForeignKey(MedicalCamp, on_delete=models.CASCADE, to_field='number')
    test = models.ForeignKey(MedicalTest, on_delete=models.CASCADE)
    reports_issued = models.BooleanField(default=False)
    vitals_record = models.ForeignKey('PatientVitals', on_delete=models.CASCADE, null=True, blank=True, related_name='issued_tests')
    
    def __str__(self):
        return f"Patient {self.patient_id}, Camp: {self.camp} issued {self.test} (Reports Issued: {self.reports_issued})"

class Patient(models.Model):
    class Meta:
        db_table = 'patient_details'

    patient_id = models.IntegerField(unique=True)
    patient_name = models.CharField(max_length=2000, null=True, blank=True)
    patient_gender = models.CharField(max_length=10, null=True, blank=True)
    patient_addr = models.CharField(max_length=4000, null=True, blank=True)
    patient_age = models.IntegerField(null=True, blank=True)
    contact_no = models.CharField(max_length=20, null=True, blank=True)
    registered_date = models.DateField(null=True, blank=True)
    camp_session = models.IntegerField(null=True, blank=True)

    def __str__(self):
        return f"{self.patient_id} - {self.patient_name or 'No Name'}"

class PatientCampVisit(models.Model):
    class Meta:
        db_table = 'patient_camp_visits'
        unique_together = ('patient', 'camp')

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='camp_visits', to_field='patient_id')
    camp = models.ForeignKey(MedicalCamp, on_delete=models.CASCADE, to_field='number')
    visit_date = models.DateField(null=True, blank=True)
    is_new = models.BooleanField(default=True)

    def __str__(self):
        status = "New" if self.is_new else "Old"
        return f"Patient {self.patient.patient_id} at Camp {self.camp.number} - {status}"

class CampWiseStock(models.Model):

    camp = models.ForeignKey(
        MedicalCamp,
        on_delete=models.CASCADE,
        related_name='camp_stocks',
        to_field='number'
    )

    medicine = models.ForeignKey(
        Medicine,
        on_delete=models.CASCADE,
        related_name='camp_stocks',
        to_field='uqid'
    )

    allocated_stock = models.IntegerField(default=0)

    used_stock = models.IntegerField(default=0)
    returned_stock = models.IntegerField(default=0)
    available_stock = models.IntegerField(default=0)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    alternate_name = models.CharField(max_length=2000, null=True, blank=True)
    company_name = models.CharField(max_length=2000, null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('camp', 'medicine')

    def remaining_stock(self):
        return max(0, self.available_stock)

    def save(self, *args, **kwargs):
        # pyrefly: ignore [unsupported-operation]
        self.available_stock = max(0, self.allocated_stock - self.used_stock - self.returned_stock)
        super().save(*args, **kwargs)

    def __str__(self):
        return (
            f"{self.camp} - "
            f"{self.medicine.name} - "
            f"Allocated: {self.allocated_stock}, "
            f"Used: {self.used_stock}"
        )

class ScanSession(models.Model):
    session_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    image = models.ImageField(upload_to='scanned_reports/', null=True, blank=True)
    is_completed = models.BooleanField(default=False)
    ocr_data = models.JSONField(null=True, blank=True)
    ocr_raw_text = models.TextField(null=True, blank=True)
    ocr_status = models.CharField(max_length=20, default='pending') # pending, processing, completed, error
    created_at = models.DateTimeField(auto_now_add=True)

class ManualPatientRecord(models.Model):
    camp = models.ForeignKey(MedicalCamp, on_delete=models.CASCADE, related_name='manual_patients')
    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE, null=True, blank=True)
    doctor_name = models.CharField(max_length=500)
    patient_id_string = models.CharField(max_length=100)
    patient_name = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.patient_name} seen by {self.doctor_name} at {self.camp}"

class CampWiseDoctor(models.Model):
    camp = models.ForeignKey(MedicalCamp, on_delete=models.CASCADE, related_name='camp_doctors', to_field='number')
    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE, related_name='camp_doctors')
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('camp', 'doctor')

    def __str__(self):
        return f"{self.doctor.name} - Camp {self.camp.number} ({'Active' if self.is_active else 'Inactive'})"
