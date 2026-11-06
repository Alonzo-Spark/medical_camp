import datetime

from django.test import TestCase

from .models import Doctor, ManualPatientRecord, MedicalCamp, MedicalCampVenue, PatientVitals
from .views import _doctor_patient_counts


class DoctorPatientCountsTest(TestCase):
    def test_counts_distinct_patients_per_doctor_across_sources(self):
        camp = MedicalCamp.objects.create(number=7, venue=MedicalCampVenue.objects.create(name="V"), date=datetime.date(2026, 1, 1))
        other = MedicalCamp.objects.create(number=8, venue=camp.venue, date=datetime.date(2026, 2, 1))
        a = Doctor.objects.create(name="Dr A")
        b = Doctor.objects.create(name="Dr B")

        # Dr A: patients 1, 2 via vitals (1 twice), 2 again + 3 manually -> 3 distinct
        for pid in (1, 1, 2):
            PatientVitals.objects.create(patient_id=pid, camp=camp, dr_id=str(a.id), dr_name="Dr A")
        ManualPatientRecord.objects.create(camp=camp, doctor=a, doctor_name="Dr A", patient_id_string="2", patient_name="P2")
        ManualPatientRecord.objects.create(camp=camp, doctor=a, doctor_name="Dr A", patient_id_string="3", patient_name="P3")
        # Dr B: one patient; plus a record at another camp that must be ignored
        PatientVitals.objects.create(patient_id=4, camp=camp, dr_id=str(b.id), dr_name="Dr B")
        PatientVitals.objects.create(patient_id=5, camp=other, dr_id=str(b.id), dr_name="Dr B")

        counts = {r['dr_name']: r['patients'] for r in _doctor_patient_counts(camp)}
        self.assertEqual(counts, {"Dr A": 3, "Dr B": 1})

        api = self.client.get('/api/camp_report/7').json()
        self.assertEqual([r['patients'] for r in api['doctors']['patient_counts']], [3, 1])
        csv_body = self.client.get('/export_camp_report/7').content.decode()
        self.assertIn('DOCTOR-WISE PATIENTS SEEN', csv_body)
        self.assertIn(f'{a.id},Dr A,3', csv_body)
