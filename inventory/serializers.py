from rest_framework import serializers
from .models import (
    Medicine, MedicalCamp, Patient, PatientVitals, Vitals, 
    Doctor, MedicalTest, TestIssue, PatientMedicineIssue, 
    CampWiseStock, ScanSession, MedicalCampVenue
)

class MedicineSerializer(serializers.ModelSerializer):
    category = serializers.ReadOnlyField(source='category.name', default="General")
    category_name = serializers.ReadOnlyField(source='category.name', default="General")
    class Meta:
        model = Medicine
        fields = ['id', 'uqid', 'name', 'formulation', 'category', 'category_name', 'stock', 'expiry_date', 'company_name', 'cost']

class MedicalCampSerializer(serializers.ModelSerializer):
    venue = serializers.ReadOnlyField(source='venue.name')
    venue_name = serializers.ReadOnlyField(source='venue.name')
    date = serializers.SerializerMethodField()
    class Meta:
        model = MedicalCamp
        fields = ['id', 'number', 'venue', 'venue_name', 'date']
    
    def get_date(self, obj):
        if obj.date:
            return obj.date.strftime('%d/%m/%Y')
        return None

class PatientSerializer(serializers.ModelSerializer):
    name = serializers.ReadOnlyField(source='patient_name')
    age = serializers.ReadOnlyField(source='patient_age')
    gender = serializers.ReadOnlyField(source='patient_gender')
    contact = serializers.ReadOnlyField(source='contact_no')
    address = serializers.ReadOnlyField(source='patient_addr')
    registered_date = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = [
            'id', 'patient_id', 'patient_name', 'name', 
            'patient_age', 'age', 'patient_gender', 'gender', 
            'contact_no', 'contact', 'patient_addr', 'address', 
            'registered_date', 'camp_session'
        ]
    
    def get_registered_date(self, obj):
        if obj.registered_date:
            return obj.registered_date.strftime('%d/%m/%Y')
        return None

class PatientVitalsSerializer(serializers.ModelSerializer):
    camp_name = serializers.ReadOnlyField(source='camp.venue.name')
    class Meta:
        model = PatientVitals
        fields = '__all__'

class VitalsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vitals
        fields = '__all__'

class DoctorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Doctor
        fields = '__all__'

class MedicalTestSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicalTest
        fields = ['id', 'test_id', 'name', 'actual_cost', 'patient_cost']

class TestIssueSerializer(serializers.ModelSerializer):
    test_name = serializers.ReadOnlyField(source='test.name')
    test_id = serializers.ReadOnlyField(source='test.test_id')
    test_issue_id = serializers.ReadOnlyField(source='id')
    camp_info = serializers.SerializerMethodField()
    class Meta:
        model = TestIssue
        fields = ['id', 'test_issue_id', 'patient_id', 'camp', 'test', 'test_id', 'test_name', 'reports_issued', 'camp_info', 'vitals_record']

    def get_camp_info(self, obj):
        try:
            if obj.camp and hasattr(obj.camp, 'venue'):
                return f"{obj.camp.venue.name} - {obj.camp.number} ({obj.camp.date})"
            return f"Camp {obj.camp_id}" if obj.camp_id else "Unknown Camp"
        except:
            return "Unknown Camp"

class PatientMedicineIssueSerializer(serializers.ModelSerializer):
    medicine_name = serializers.ReadOnlyField(source='medicine.name')
    medicine_id = serializers.ReadOnlyField(source='medicine.uqid')
    quantity = serializers.ReadOnlyField(source='qty')
    camp_info = serializers.SerializerMethodField()

    class Meta:
        model = PatientMedicineIssue
        fields = ['id', 'patient_id', 'camp', 'medicine', 'medicine_id', 'medicine_name', 'qty', 'quantity', 'camp_info', 'vitals_record', 'formulation', 'strength', 'days', 'morning', 'afternoon', 'night']

    def get_camp_info(self, obj):
        try:
            if obj.camp and hasattr(obj.camp, 'venue'):
                return f"{obj.camp.venue.name} - {obj.camp.number} ({obj.camp.date})"
            return f"Camp {obj.camp_id}" if obj.camp_id else "Unknown Camp"
        except:
            return "Unknown Camp"

class CampWiseStockSerializer(serializers.ModelSerializer):
    medicine_name = serializers.ReadOnlyField(source='medicine.name')
    medicine_uqid = serializers.ReadOnlyField(source='medicine.uqid')
    remaining = serializers.ReadOnlyField(source='remaining_stock')
    allocated = serializers.ReadOnlyField(source='allocated_stock')
    used = serializers.ReadOnlyField(source='used_stock')

    class Meta:
        model = CampWiseStock
        fields = [
            'id', 'camp', 'medicine', 'medicine_name', 'medicine_uqid', 
            'allocated_stock', 'allocated', 'used_stock', 'used', 'remaining', 'created_at'
        ]

class ScanSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScanSession
        fields = '__all__'
