from django.urls import path
from django.views.generic import RedirectView
from .views import *

urlpatterns = [
    # Redirect root to React Frontend (Port 5173)
    path('', RedirectView.as_view(url='http://localhost:5173/')),

    # Legacy Django Template Views
    path('legacy/issue/', index, name='legacy_issue'),

    # Data Export
    path('export', export),
    path('export_camp_stock/<int:camp_id>', export_camp_stock),
    path('export_camp_report/<int:camp_id>', export_camp_report),
    path('api/doctor_camp_reports/<int:camp_id>', api_get_doctor_report),
    path('api/save_doctor_report', api_save_doctor_report),
    path('api/delete_doctor_report/<int:record_id>', api_delete_doctor_report),


    # API Endpoints
    path('api/camps', api_get_camps),
    path('api/medicines', api_get_medicines),
    path('api/add_medicine', api_add_medicine),
    path('api/update_medicine_details', api_update_medicine_details),
    path('api/update_medicine_profile', api_update_medicine_profile),
    path('api/update_camp_unit_cost', api_update_camp_unit_cost),
    path('api/update_camp_alternate_name', api_update_camp_alternate_name),
    path('api/patient/<int:patient_id>', api_get_patient_details),
    path('api/issue', api_issue_medicine),
    path('api/save_vitals', api_save_vitals),
    path('api/visit_details/<int:vitals_id>', api_get_visit_details),
    path('api/update_visit/<int:vitals_id>', api_update_visit_details),
    path('api/register_patient', api_register_patient),
    path('api/check_patient_id/<int:pid>', api_check_patient_id),
    path('api/doctor/<int:doctor_id>', api_get_doctor),
    path('api/login', api_login),
    path('api/update_stock', api_update_medicine_stock),
    path('api/set_stock', api_set_medicine_stock),
    path('api/camp_wise_stock', api_get_camp_wise_stock),
    path('api/camp_stock/<int:camp_id>', api_get_specific_camp_stock),
    path('api/allocate_to_camp', api_allocate_to_camp),
    path('api/return_to_warehouse', api_return_to_warehouse),
    path('api/close_camp_session', api_close_camp_session),
    path('api/register_camp', api_register_camp),
    path('api/tests', api_get_medical_tests),
    path('api/camp_patients/<int:camp_id>', api_camp_patients),
    path('api/update_test_record', api_update_test_record),
    path('api/update_visit/<int:vitals_id>', api_update_visit_details),
    path('api/delete_visit/<int:vitals_id>', api_delete_visit),
    path('api/camp_report/<int:camp_id>',api_get_camp_report),
    # Mobile Scan APIs
    path('api/create_scan_session', api_create_scan_session),
    path('api/upload_scan/<uuid:session_id>', api_upload_scan),
    path('api/check_scan_status/<uuid:session_id>', api_check_scan_status),
    
    path('api/doctors', api_get_doctors),
    path('api/add_doctor', api_add_doctor),
    path('api/update_doctor', api_update_doctor),
    path('api/delete_doctor/<int:doctor_id>', api_delete_doctor),
    path('api/toggle_doctor_status/<int:doctor_id>', api_toggle_doctor_status),
    path('api/doctor_analytics', api_doctor_analytics),
    path('api/camps', api_get_all_camps),
    path('api/camp_details/<int:camp_id>', api_get_camp_details),






]
