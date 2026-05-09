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


    # API Endpoints
    path('api/camps', api_get_camps),
    path('api/medicines', api_get_medicines),
    path('api/add_medicine', api_add_medicine),
    path('api/patient/<int:patient_id>', api_get_patient_details),
    path('api/issue', api_issue_medicine),
    path('api/save_vitals', api_save_vitals),
    path('api/register_patient', api_register_patient),
    path('api/check_patient_id/<int:pid>', api_check_patient_id),
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
]
