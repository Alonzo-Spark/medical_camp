from django.shortcuts import render, redirect, get_object_or_404
from django.core import serializers
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth import authenticate, login
from django.db import transaction

import json
import csv
import datetime
import threading
from django.db import close_old_connections
from .ocr_service import MedicalOCRService

# Global OCR Service instance
ocr_service = MedicalOCRService()


from .forms import IssueForm, VitalsForm
from .models import (
    Medicine,
    MedicalCamp,
    MedicalCampVenue,
    PatientMedicineIssue,
    MedicineCategory,
    Vitals,
    PatientVitals,
    MedicalTest,
    TestIssue,
    Patient,
    CampWiseStock,
    Doctor,
    ScanSession,

)

def charts_data(vitals):
    all_vitals = {
        "blood_pressure": [],
        "glucose": [],
        "haemoglobin": []
    }
    for vital in vitals:
        # Determine the most accurate date available
        d_obj = None
        if hasattr(vital, 'date') and vital.date:
            d_obj = vital.date
        elif vital.camp and vital.camp.date:
            d_obj = vital.camp.date
        
        if not d_obj:
            continue
            
        d_str = d_obj.strftime('%Y-%m-%d')
        
        bp_value = (vital.blood_pressure or '').strip()
        glucose_value = (vital.glucose or '').strip()
        
        # RBS check for PatientVitals specifically
        if not glucose_value and hasattr(vital, 'rbs') and vital.rbs:
            glucose_value = (vital.rbs or '').strip()
            
        hb_value = (vital.haemoglobin or '').strip()
        
        if bp_value not in ["NA", "-", ""]:
            bp_parts = bp_value.split('/')
            systolic = bp_parts[0].strip()
            diastolic = bp_parts[1].strip() if len(bp_parts) > 1 else ""
            
            if systolic or diastolic:
                all_vitals['blood_pressure'].append({
                    "label": d_str,
                    "systolic": systolic,
                    "diastolic": diastolic
                })
                
        if glucose_value not in ["NA", "-", ""]:
            all_vitals['glucose'].append({
                "label": d_str,
                "value": glucose_value
            })
            
        if hb_value not in ["NA", "-", ""]:
            all_vitals['haemoglobin'].append({
                "label": d_str,
                "value": hb_value
            })
            
    return all_vitals

def get_patient_profile(request):
    groups = {}
    p_vitals = []
    all_vitals = {}
    patient_id = None
    if 'patient_id' in request.GET:
        patient_id = request.GET['patient_id']
        # pyrefly: ignore [missing-attribute]
        selected_issues = PatientMedicineIssue.objects.filter(
            patient_id=patient_id
        ).order_by('-camp')
        # pyrefly: ignore [missing-attribute]
        p_vitals = Vitals.objects.filter(
            patient_id=patient_id
        ).order_by('camp')
        all_vitals = charts_data(p_vitals)
        for issue in selected_issues:
            if issue.camp not in groups:
                groups[issue.camp] = []
            groups[issue.camp].append(issue)
    return render(
        request,
        'inventory/patient.tpl.html',
        {
            'groups': groups,
            'patient_id': patient_id,
            'patient_vitals': p_vitals,
            'vital_charts': all_vitals
        }
    )

def get_patient_vitals(request):
    success = False
    if request.method == 'GET':
        vitals_form = VitalsForm()
    elif request.method == 'POST':
        vitals_form = VitalsForm()
        # pyrefly: ignore [missing-attribute]
        v = Vitals.objects.filter(
            patient_id=request.POST['patient_id'],
            camp__id=int(request.POST['medical_camp'])
        ).first()
        if not v:
            v = Vitals()
            v.patient_id = request.POST['patient_id']
            v.camp = get_object_or_404(
                MedicalCamp,
                id=int(request.POST['medical_camp'])
            )
        v.blood_pressure = request.POST.get("blood_pressure", "")
        v.glucose = request.POST.get("glucose", "")
        v.haemoglobin = request.POST.get("haemoglobin", "")
        v.save()
        success = True
    vitals_form = VitalsForm()
    return render(
        request,
        'inventory/vitals.tpl.html',
        {
            'vitals_form': vitals_form,
            'success': success
        }
    )

def issue_tests(request):
    # pyrefly: ignore [missing-attribute]
    all_camps = MedicalCamp.objects.all().order_by("-date")
    # pyrefly: ignore [missing-attribute]
    all_test_types = MedicalTest.objects.all()
    if request.method == 'GET':
        return render(
            request,
            'inventory/tests.tpl.html',
            {
                'all_tests': all_test_types,
                'all_camps': all_camps
            }
        )
    elif request.method == 'POST':
        test_ids = request.POST.getlist("tests")
        camp_id = int(request.POST['camp'])
        patient_id = int(request.POST['patient_id'])
        camp = get_object_or_404(MedicalCamp, id=camp_id)
        for test_id in test_ids:
            test = get_object_or_404(MedicalTest, id=test_id)
            # pyrefly: ignore [missing-attribute]
            TestIssue.objects.create(
                camp=camp,
                patient_id=patient_id,
                test=test
            )
        return render(
            request,
            'inventory/tests.tpl.html',
            {
                'all_tests': all_test_types,
                'all_camps': all_camps,
                'success': True
            }
        )

def get_issued_tests(request, patient_id, camp_id):
    tests = list(
        # pyrefly: ignore [missing-attribute]
        TestIssue.objects.filter(
            patient_id=patient_id,
            camp__id=camp_id
        ).values_list('test__id', flat=True)
    )
    return JsonResponse(tests, safe=False)

def search_vitals(request, patient_id, camp_id):
    # pyrefly: ignore [missing-attribute]
    v = Vitals.objects.filter(
        patient_id=patient_id,
        camp__id=camp_id
    ).first()
    if v:
        return JsonResponse(
            serializers.serialize('json', [v]),
            safe=False
        )
    return JsonResponse({}, safe=False)

@transaction.atomic
def index(request):
    success = False
    issue_form = IssueForm()
    if request.method == 'POST':
        patient_id = request.POST.get('patient_id')
        medical_camp = get_object_or_404(
            MedicalCamp,
            id=request.POST.get('medical_camp')
        )
        med_ids = request.POST.getlist('med-id')
        qtys = request.POST.getlist('qty')
        for med_id, qty in zip(med_ids, qtys):
            if not med_id:
                continue
            qty = int(qty)
            medicine = get_object_or_404(
                Medicine,
                uqid=int(med_id)
            )
            if medicine.stock < qty:
                return JsonResponse({
                    'status': 'error',
                    'message': f'Insufficient stock for {medicine.name}'
                }, status=400)
            # pyrefly: ignore [missing-attribute]
            PatientMedicineIssue.objects.create(
                patient_id=int(patient_id),
                camp=medical_camp,
                medicine=medicine,
                qty=qty
            )
            medicine.stock -= qty
            medicine.save()
        success = True
    return render(
        request,
        'inventory/issue.tpl.html',
        {
            'issue_form': issue_form,
            'success': success
        }
    )

def search_meds(request, med_id):
    # pyrefly: ignore [missing-attribute]
    med = Medicine.objects.filter(uqid=med_id).first()
    if med:
        json_q = {
            "uqid": med.uqid,
            "name": med.name,
            "stock": med.stock
        }
        return JsonResponse(json_q)
    return JsonResponse({})



def export(request):
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = (
        'attachment; filename="stock_list.csv"'
    )
    # pyrefly: ignore [missing-attribute]
    meds = Medicine.objects.order_by('uqid')
    writer = csv.writer(response)
    writer.writerow([
        'UQID',
        'Name',
        'Formulation',
        'Stock',
        'Expiry Date'
    ])
    for med in meds:
        writer.writerow([
            med.uqid,
            med.name,
            med.formulation,
            med.stock,
            med.expiry_date
        ])
    return response


def export_camp_stock(request, camp_id):
    camp = get_object_or_404(MedicalCamp, id=camp_id)
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = (
        f'attachment; filename="camp_{camp.number}_stock_allocation.csv"'
    )

    writer = csv.writer(response)
    writer.writerow([
        'Camp Number',
        'Venue',
        'Date',
        'Medicine UQID',
        'Medicine Name',
        'Warehouse Stock',
        'Allocated Stock',
        'Used Stock',
        'Remaining Stock'
    ])

    stocks = CampWiseStock.objects.filter(camp=camp).select_related('medicine').order_by('medicine__uqid')
    
    for s in stocks:
        writer.writerow([
            camp.number,
            camp.venue.name,
            camp.date.strftime('%Y-%m-%d'),
            s.medicine.uqid,
            s.medicine.name,
            s.medicine.stock,

            s.allocated_stock,
            s.used_stock,
            s.remaining_stock()
        ])
    
    return response



def api_get_camps(request):
    # pyrefly: ignore [missing-attribute]
    camps = MedicalCamp.objects.all().order_by('id')
    data = []
    for camp in camps:
        data.append({
            'id': camp.id,
            'number': camp.number,
            'venue': camp.venue.name,
            'date': camp.date.strftime('%Y-%m-%d')
        })
    return JsonResponse(data, safe=False)

def api_get_medicines(request):
    # pyrefly: ignore [missing-attribute]
    medicines = Medicine.objects.all().order_by('uqid')
    data = []
    for med in medicines:
        data.append({
            'id': med.id,
            'uqid': med.uqid,
            'name': med.name,
            'formulation': med.formulation,
            'category': med.category.name if med.category else "General",
            'stock': med.stock,
            'expiry_date': med.expiry_date.strftime('%Y-%m-%d') if med.expiry_date else None,
            'company_name': med.company_name,
            'cost': str(med.cost) if med.cost is not None else None
        })
    return JsonResponse(data, safe=False)

@csrf_exempt
@require_http_methods(["POST"])
def api_update_medicine_details(request):
    try:
        data = json.loads(request.body)
        uqid = data.get('uqid')
        medicine = get_object_or_404(Medicine, uqid=uqid)
        
        medicine.company_name = data.get('company_name', medicine.company_name)
        
        # Handle cost
        cost = data.get('cost')
        if cost is not None and cost != '':
            medicine.cost = float(cost)
        else:
            medicine.cost = None
            
        # Handle expiry date
        expiry = data.get('expiry_date')
        if expiry and expiry.strip():
            medicine.expiry_date = expiry
        else:
            medicine.expiry_date = None
            
        medicine.save()
        
        return JsonResponse({
            'status': 'success',
            'message': 'Medicine details updated successfully'
        })
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=400)

@csrf_exempt
@require_http_methods(["POST"])
def api_add_medicine(request):
    try:
        data = json.loads(request.body)
        name = data.get('name')
        formulation = data.get('formulation', '')
        stock = int(data.get('stock', 0))
        custom_uqid = data.get('uqid')
        
        if not name:
            return JsonResponse({'status': 'error', 'message': 'Medicine name is required'}, status=400)
            
        if custom_uqid:
            try:
                custom_uqid = int(custom_uqid)
                # pyrefly: ignore [missing-attribute]
                if Medicine.objects.filter(uqid=custom_uqid).exists():
                    return JsonResponse({'status': 'error', 'message': f'Medicine with UQID {custom_uqid} already exists'}, status=400)
                new_uqid = custom_uqid
            except ValueError:
                return JsonResponse({'status': 'error', 'message': 'UQID must be a number'}, status=400)
        else:
            # Generate new uqid
            # pyrefly: ignore [untyped-import]
            from django.db.models import Max
            # pyrefly: ignore [missing-attribute]
            max_uqid = Medicine.objects.aggregate(max_uqid=Max('uqid'))['max_uqid'] or 0
            new_uqid = max_uqid + 1
        
        # pyrefly: ignore [missing-attribute]
        medicine = Medicine.objects.create(
            uqid=new_uqid,
            name=name,
            formulation=formulation,
            stock=stock
        )
        
        return JsonResponse({
            'status': 'success',
            'message': 'Medicine added successfully',
            'medicine': {
                'uqid': medicine.uqid,
                'name': medicine.name,
                'formulation': medicine.formulation,
                'stock': medicine.stock
            }
        })
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)


def api_get_patient_details(request, patient_id):
    # pyrefly: ignore [missing-attribute]
    issues = PatientMedicineIssue.objects.filter(
        patient_id=patient_id
    ).order_by('-camp__date')
    history = {}
    for issue in issues:
        camp_key = (
            f"{issue.camp.venue.name} - "
            f"{issue.camp.number} "
            f"({issue.camp.date})"
        )
        if camp_key not in history:
            history[camp_key] = []
        history[camp_key].append({
            'medicine': issue.medicine.name,
            'qty': issue.qty
        })
    # Fetch vitals from both old and new tables for backward compatibility
    # pyrefly: ignore [missing-attribute]
    old_vitals = Vitals.objects.filter(patient_id=patient_id)
    # pyrefly: ignore [missing-attribute]
    new_vitals = PatientVitals.objects.filter(patient_id=patient_id)
    
    combined_vitals = []
    for v in old_vitals:
        combined_vitals.append(v)
    for v in new_vitals:
        combined_vitals.append(v)
        
    # Sort combined vitals by the date they were recorded (or camp date fallback)
    def get_vital_date(v):
        if hasattr(v, 'date') and v.date:
            return v.date
        if v.camp and v.camp.date:
            return v.camp.date
        return datetime.date.min

    combined_vitals.sort(key=get_vital_date)

    vitals_list = []
    filtered_vitals_for_charts = []
    
    for v in combined_vitals:
        bp = (v.blood_pressure or '').strip()
        glu = (v.glucose or '').strip()
        # RBS check for PatientVitals
        if not glu and hasattr(v, 'rbs') and v.rbs:
            glu = (v.rbs or '').strip()
            
        hb = (v.haemoglobin or '').strip()
        
        # Check if there is any actual clinical data in this record
        has_data = any(val not in ["NA", "-", "", None] for val in [bp, glu, hb])
        
        if has_data:
            # Determine best date for display
            display_date = 'N/A'
            if hasattr(v, 'date') and v.date:
                display_date = v.date.strftime('%Y-%m-%d')
            elif v.camp and v.camp.date:
                display_date = v.camp.date.strftime('%Y-%m-%d')

            vitals_list.append({
                'camp': f"{v.camp.venue.name if v.camp and v.camp.venue else 'Unknown'} - {v.camp.number if v.camp else '?'}",
                'date': display_date,
                'blood_pressure': bp if bp not in ["NA", "-"] else "",
                'glucose': glu if glu not in ["NA", "-"] else "",
                'haemoglobin': hb if hb not in ["NA", "-"] else ""
            })
            filtered_vitals_for_charts.append(v)

    charts = charts_data(filtered_vitals_for_charts)
    
    # Fetch demographic details
    patient_info = {}
    try:
        # pyrefly: ignore [missing-attribute]
        p = Patient.objects.get(patient_id=patient_id)
        patient_info = {
            'name': p.patient_name or '',
            'age': p.patient_age or '',
            'gender': p.patient_gender or '',
            'contact': p.contact_no or '',
            'address': p.patient_addr or '',
            'registered_date': str(p.registered_date) if p.registered_date else ''
        }
    # pyrefly: ignore [missing-attribute]
    except Patient.DoesNotExist:
        pass

    return JsonResponse({
        'patient_id': patient_id,
        'info': patient_info,
        'medicine_history': history,
        'vitals': vitals_list,
        'charts': charts
    })

@csrf_exempt
@require_http_methods(["POST"])
@transaction.atomic
def api_issue_medicine(request):
    try:
        data = json.loads(request.body)
        patient_id = data.get('patient_id')
        camp_id = data.get('medical_camp')
        med_issues = data.get('issues', [])
        camp = get_object_or_404(MedicalCamp, id=camp_id)
        for item in med_issues:
            med_id = item.get('med_id')
            qty = int(item.get('qty', 0))
            if not med_id or qty <= 0:
                continue
            medicine = get_object_or_404(Medicine, uqid=med_id)
            # pyrefly: ignore [missing-attribute]
            camp_stock = CampWiseStock.objects.filter(
                camp=camp,
                medicine=medicine
            ).first()
            if not camp_stock:
                return JsonResponse({
                    'status': 'error',
                    'message': f'Stock not allocated for {medicine.name}'
                }, status=400)
            if camp_stock.remaining_stock() < qty:
                return JsonResponse({
                    'status': 'error',
                    'message': f'Insufficient stock for {medicine.name}'
                }, status=400)
            # pyrefly: ignore [missing-attribute]
            PatientMedicineIssue.objects.create(
                patient_id=patient_id,
                camp=camp,
                medicine=medicine,
                qty=qty
            )
            # Update used stock in camp wise stock
            camp_stock.used_stock += qty
            camp_stock.save()

        return JsonResponse({'status': 'success'})
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=400)

@csrf_exempt
@require_http_methods(["POST"])
@transaction.atomic
def api_save_vitals(request):
    try:
        data = json.loads(request.body)
        patient_id = data.get('patient_id')
        camp_id = data.get('medical_camp')
        med_issues = data.get('medicines', [])
        camp = get_object_or_404(MedicalCamp, id=camp_id)
        # pyrefly: ignore [missing-attribute]
        v = PatientVitals.objects.create(
            patient_id=patient_id,
            camp_id=camp_id,
            date=data.get('date'),
            time=data.get('time'),
            e_no=data.get('e_no'),
            weight=data.get('weight'),
            height=data.get('height'),
            blood_pressure=data.get('blood_pressure'),
            pulse=data.get('pulse'),
            glucose=data.get('glucose'),
            rbs=data.get('rbs'),
            haemoglobin=data.get('haemoglobin'),
            last_food_time=data.get('last_food_time'),
            dr_name=data.get('dr_name'),
            dr_id=data.get('dr_id'),
            diagnosis=data.get('diagnosis')
        )
        for item in med_issues:
            med_id = item.get('msNo')
            qty = int(item.get('quantity', 0))
            if med_id and qty > 0:
                # pyrefly: ignore [missing-attribute]
                medicine = Medicine.objects.filter(uqid=med_id).first()
                if medicine:
                    # pyrefly: ignore [missing-attribute]
                    camp_stock = CampWiseStock.objects.filter(
                        camp=camp,
                        medicine=medicine
                    ).first()
                    if not camp_stock:
                        v.delete()
                        return JsonResponse({
                            'status': 'error',
                            'message': f'Stock not allocated for {medicine.name}'
                        }, status=400)
                    if camp_stock.remaining_stock() < qty:
                        v.delete()
                        return JsonResponse({
                            'status': 'error',
                            'message': f'Insufficient stock for {medicine.name}'
                        }, status=400)
                    # pyrefly: ignore [missing-attribute]
                    PatientMedicineIssue.objects.create(
                        patient_id=patient_id,
                        camp=camp,
                        medicine=medicine,
                        qty=qty,
                        vitals_record=v,
                        strength=item.get('strength'),
                        days=int(item.get('days') or 0),
                        morning=int(item.get('morning') or 0),
                        afternoon=int(item.get('afternoon') or 0),
                        night=int(item.get('night') or 0)
                    )
                    # Update used stock in camp wise stock
                    camp_stock.used_stock += qty
                    camp_stock.save()

        selected_tests = data.get('selected_tests', [])
        for test_id in selected_tests:
            # pyrefly: ignore [missing-attribute]
            test = MedicalTest.objects.filter(test_id=test_id).first()
            if test:
                # pyrefly: ignore [missing-attribute]
                TestIssue.objects.create(
                    patient_id=patient_id,
                    camp=camp,
                    test=test
                )
        return JsonResponse({'status': 'success'})
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=400)

@csrf_exempt
@require_http_methods(["POST"])
def api_register_patient(request):
    try:
        data = json.loads(request.body)
        defaults_data = {
            'patient_name': data.get('name'),
            'patient_gender': data.get('gender'),
            'patient_addr': data.get('address'),
            'patient_age': data.get('age'),
            'contact_no': data.get('contact'),
        }
        
        if data.get('regdate'):
            defaults_data['registered_date'] = data.get('regdate')
            
        if data.get('camp_session'):
            defaults_data['camp_session'] = data.get('camp_session')

        # pyrefly: ignore [missing-attribute]
        patient, created = Patient.objects.update_or_create(
            patient_id=data.get('pid'),
            defaults=defaults_data
        )
        return JsonResponse({
            'status': 'success',
            'patient_id': patient.patient_id
        })
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=400)

def api_get_doctor(request, doctor_id):
    try:
        # pyrefly: ignore [missing-attribute, unknown-name]
        doctor = Doctor.objects.get(id=doctor_id)
        return JsonResponse({
            'status': 'success',
            'name': doctor.name
        })
    # pyrefly: ignore [missing-attribute, unknown-name]
    except Doctor.DoesNotExist:
        return JsonResponse({
            'status': 'error',
            'message': 'Doctor not found'
        }, status=404)

@csrf_exempt
def api_login(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            username = data.get('username')
            password = data.get('password')
            user = authenticate(
                request,
                username=username,
                password=password
            )
            if user is not None:
                login(request, user)
                
                # Get the user's role, default to main_admin if no profile exists
                role = 'main_admin'
                if hasattr(user, 'profile'):
                    role = user.profile.role
                    
                return JsonResponse({
                    'status': 'success',
                    'message': 'Login successful',
                    'role': role
                })
            return JsonResponse({
                'status': 'error',
                'message': 'Invalid credentials'
            }, status=401)
        except Exception as e:
            return JsonResponse({
                'status': 'error',
                'message': str(e)
            }, status=400)
    return JsonResponse({
        'status': 'error',
        'message': 'Method not allowed'
    }, status=405)

def api_check_patient_id(request, pid):
    # pyrefly: ignore [missing-attribute]
    exists = Patient.objects.filter(
        patient_id=pid
    ).exists()
    return JsonResponse({'exists': exists})

@csrf_exempt
@require_http_methods(["POST"])
@transaction.atomic
def api_update_medicine_stock(request):
    try:
        data = json.loads(request.body)
        uqid = data.get('uqid')
        added_qty = int(data.get('added_qty', 0))
        medicine = get_object_or_404(Medicine, uqid=uqid)
        medicine.stock += added_qty
        medicine.save()
        return JsonResponse({
            'status': 'success',
            'new_stock': medicine.stock,
            'medicine_name': medicine.name
        })
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=400)

@csrf_exempt
@require_http_methods(["POST"])
@transaction.atomic
def api_set_medicine_stock(request):
    try:
        data = json.loads(request.body)
        uqid = data.get('uqid')
        new_stock = int(data.get('stock', 0))
        if new_stock < 0:
            return JsonResponse({
                'status': 'error',
                'message': 'Stock cannot be negative.'
            }, status=400)
        medicine = get_object_or_404(Medicine, uqid=uqid)
        medicine.stock = new_stock
        medicine.save()
        return JsonResponse({
            'status': 'success',
            'new_stock': medicine.stock,
            'medicine_name': medicine.name
        })
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=400)

def api_get_camp_wise_stock(request):
    # pyrefly: ignore [missing-attribute]
    stocks = CampWiseStock.objects.select_related('medicine', 'camp')
    data = []
    for s in stocks:
        data.append({
            'uqid': s.medicine.uqid,
            'medication': s.medicine.name,
            'total_stock': s.medicine.stock,
            'camp_stock': s.allocated_stock,
            'camp': str(s.camp),
            'camp_id': s.camp.id,
            'used_stock': s.used_stock,
            'remaining_stock': s.remaining_stock()
        })
    return JsonResponse(data, safe=False)

def api_get_specific_camp_stock(request, camp_id):
    # pyrefly: ignore [missing-attribute]
    camp = get_object_or_404(MedicalCamp, id=camp_id)
    stocks = CampWiseStock.objects.filter(camp=camp)
    data = {}
    for s in stocks:
        data[s.medicine.uqid] = {
            'allocated': s.allocated_stock,
            'used': s.used_stock,
            'remaining': s.remaining_stock()
        }
    return JsonResponse(data)

@csrf_exempt
@require_http_methods(["POST"])
@transaction.atomic
def api_allocate_to_camp(request):
    try:
        data = json.loads(request.body)
        camp_id = data.get('camp_id')
        uqid = data.get('uqid')
        qty = int(data.get('qty', 0))
        medicine = get_object_or_404(Medicine, uqid=uqid)
        if medicine.stock < qty:
            return JsonResponse({
                'status': 'error',
                'message': 'Insufficient stock'
            }, status=400)
        # pyrefly: ignore [missing-attribute]
        camp_stock, created = CampWiseStock.objects.get_or_create(
            camp_id=camp_id,
            medicine=medicine,
            defaults={'allocated_stock': 0, 'used_stock': 0}
        )
        medicine.stock -= qty
        medicine.save()
        camp_stock.allocated_stock += qty
        camp_stock.save()
        return JsonResponse({
            'status': 'success',
            'medicine_name': medicine.name,
            'new_total_stock': medicine.stock,
            'new_camp_stock': camp_stock.allocated_stock
        })
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=400)

@csrf_exempt
@require_http_methods(["POST"])
@transaction.atomic
def api_set_camp_allocation(request):
    try:
        data = json.loads(request.body)
        camp_id = data.get('camp_id')
        uqid = data.get('uqid')
        qty = int(data.get('qty', 0))
        if qty < 0:
            return JsonResponse({
                'status': 'error',
                'message': 'Quantity cannot be negative.'
            }, status=400)
        camp = get_object_or_404(MedicalCamp, id=camp_id)
        medicine = get_object_or_404(Medicine, uqid=uqid)
        # pyrefly: ignore [missing-attribute]
        camp_stock, _ = CampWiseStock.objects.get_or_create(
            camp=camp,
            medicine=medicine,
            defaults={
                'allocated_stock': 0,
                'used_stock': 0
            }
        )
        if qty < camp_stock.used_stock:
            return JsonResponse({
                'status': 'error',
                'message': f'Cannot allocate less than used stock ({camp_stock.used_stock})'
            }, status=400)
        diff = qty - camp_stock.allocated_stock
        if diff > 0 and medicine.stock < diff:
            return JsonResponse({
                'status': 'error',
                'message': f'Insufficient central stock. Available: {medicine.stock}'
            }, status=400)
        medicine.stock -= diff
        medicine.save()
        camp_stock.allocated_stock = qty
        camp_stock.save()
        return JsonResponse({
            'status': 'success',
            'new_allocation': qty,
            'central_stock': medicine.stock
        })
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=400)

@csrf_exempt
@require_http_methods(["POST"])
@transaction.atomic
def api_return_to_warehouse(request):
    try:
        data = json.loads(request.body)
        camp_id = data.get('camp_id')
        med_id = data.get('med_id')
        # pyrefly: ignore [missing-attribute]
        camp_stock = CampWiseStock.objects.get(
            camp_id=camp_id,
            medicine__uqid=med_id
        )
        remaining = camp_stock.remaining_stock()
        medicine = camp_stock.medicine
        if remaining > 0:
            medicine.stock += remaining
            medicine.save()
        camp_stock.allocated_stock = 0
        camp_stock.used_stock = 0
        camp_stock.save()
        return JsonResponse({
            'status': 'success',
            'new_total': medicine.stock
        })
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=400)

@csrf_exempt
@require_http_methods(["POST"])
@transaction.atomic
def api_close_camp_session(request):
    try:
        data = json.loads(request.body)
        camp_id = data.get('camp_id')
        # pyrefly: ignore [missing-attribute]
        camp_stocks = CampWiseStock.objects.filter(camp_id=camp_id)
        for cs in camp_stocks:
            remaining = cs.remaining_stock()
            if remaining > 0:
                medicine = cs.medicine
                medicine.stock += remaining
                medicine.save()
            cs.allocated_stock = 0
            cs.used_stock = 0
            cs.save()
        return JsonResponse({
            'status': 'success',
            'message': 'Camp session closed and stock returned to warehouse'
        })
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=400)

@csrf_exempt
@require_http_methods(["POST"])
def api_register_camp(request):
    try:
        data = json.loads(request.body)
        camp_number = data.get('camp_number')
        venue_name = data.get('venue_name')
        camp_date = data.get('date')
        # pyrefly: ignore [missing-attribute]
        venue, _ = MedicalCampVenue.objects.get_or_create(name=venue_name)
        # pyrefly: ignore [missing-attribute]
        camp = MedicalCamp.objects.create(
            number=camp_number,
            venue=venue,
            date=camp_date
        )
        return JsonResponse({
            'status': 'success',
            'message': f'Camp {camp_number} at {venue_name} registered successfully',
            'camp_id': camp.id
        })
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=400)

def api_get_medical_tests(request):
    # pyrefly: ignore [missing-attribute]
    tests = MedicalTest.objects.all().order_by('test_id')
    data = []
    for t in tests:
        data.append({
            'id': t.test_id,
            'name': t.name,
            'actual_cost': float(t.actual_cost),
            'patient_cost': float(t.patient_cost),
        })
    return JsonResponse(data, safe=False)

def api_camp_patients(request, camp_id):
    try:
        # pyrefly: ignore [missing-attribute]
        camp = MedicalCamp.objects.get(id=camp_id)
    # pyrefly: ignore [missing-attribute]
    except MedicalCamp.DoesNotExist:
        return JsonResponse({
            'status': 'error',
            'message': 'Camp not found'
        }, status=404)
    vitals_pids = set(
        # pyrefly: ignore [missing-attribute]
        PatientVitals.objects.filter(
            camp=camp
        ).values_list('patient_id', flat=True)
    )
    issue_pids = set(
        # pyrefly: ignore [missing-attribute]
        PatientMedicineIssue.objects.filter(
            camp=camp
        ).values_list('patient_id', flat=True)
    )
    test_pids = set(
        # pyrefly: ignore [missing-attribute]
        TestIssue.objects.filter(
            camp=camp
        ).values_list('patient_id', flat=True)
    )
    registered_pids = set(
        # pyrefly: ignore [missing-attribute]
        Patient.objects.filter(
            camp_session=camp.number
        ).values_list('patient_id', flat=True)
    )
    
    all_pids = vitals_pids | issue_pids | test_pids | registered_pids
    
    patient_details = {}
    # pyrefly: ignore [missing-attribute]
    for p in Patient.objects.filter(patient_id__in=all_pids):
        patient_details[p.patient_id] = {
            'name': p.patient_name or '',
            'age': p.patient_age or '',
            'gender': p.patient_gender or '',
            'contact': p.contact_no or '',
            'address': p.patient_addr or '',
            'registered_date': str(p.registered_date) if p.registered_date else ''
        }
    result = []
    for pid in sorted(all_pids):
        # pyrefly: ignore [missing-attribute]
        issues = PatientMedicineIssue.objects.filter(
            patient_id=pid,
            camp=camp
        )
        medicines = []
        for iss in issues:
            medicines.append({
                'medicine_id': iss.medicine.uqid,
                'medicine_name': iss.medicine.name,
                'quantity': iss.qty,
            })
        # pyrefly: ignore [missing-attribute]
        test_issues = TestIssue.objects.filter(
            patient_id=pid,
            camp=camp
        )
        tests = []
        for ti in test_issues:
            tests.append({
                'test_issue_id': ti.id,
                'test_id': ti.test.id,
                'test_name': ti.test.name,
                'reports_issued': ti.reports_issued,
            })
        p_data = patient_details.get(pid, {})
        result.append({
            'patient_id': pid,
            'patient_name': p_data.get('name', ''),
            'age': p_data.get('age', ''),
            'gender': p_data.get('gender', ''),
            'contact': p_data.get('contact', ''),
            'address': p_data.get('address', ''),
            'registered_date': p_data.get('registered_date', ''),
            'medicines': medicines,
            'tests': tests,
        })
    return JsonResponse(result, safe=False)

@csrf_exempt
@require_http_methods(["POST"])
def api_update_test_record(request):
    try:
        data = json.loads(request.body)
        test_issue_id = data.get('test_issue_id')
        reports_issued = data.get('reports_issued')
        test_issue = get_object_or_404(TestIssue, id=test_issue_id)
        test_issue.reports_issued = bool(reports_issued)
        test_issue.save()
        return JsonResponse({
            'status': 'success',
            'reports_issued': test_issue.reports_issued
        })
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=400)

@csrf_exempt
def api_create_scan_session(request):
    if request.method == 'POST':
        session = ScanSession.objects.create()
        return JsonResponse({
            'status': 'success',
            'session_id': str(session.session_id)
        })
    return JsonResponse({'status': 'error', 'message': 'Invalid request'}, status=400)

def run_ocr_task(session_uuid):
    """Background task to process OCR"""
    try:
        close_old_connections()
        print(f"DEBUG: OCR Task started for session {session_uuid}")
        session = ScanSession.objects.get(session_id=session_uuid)
        session.ocr_status = 'processing'
        session.save()
        
        # Trigger OCR
        print(f"DEBUG: Triggering OCR for {session.image.path}")
        structured_data, raw_text = ocr_service.process_report(session.image.path)
        
        print(f"DEBUG: OCR completed for {session_uuid}, saving results...")
        session.ocr_data = structured_data
        session.ocr_raw_text = raw_text
        session.ocr_status = 'completed'
        session.save()
        print(f"DEBUG: Session {session_uuid} updated to completed.")
    except Exception as e:
        print(f"OCR Task Error for {session_uuid}: {e}")
        try:
            close_old_connections()
            session = ScanSession.objects.get(session_id=session_uuid)
            session.ocr_status = 'error'
            session.save()
        except Exception as e2:
            print(f"OCR Error status update failed: {e2}")
    finally:
        close_old_connections()

@csrf_exempt
def api_upload_scan(request, session_id):
    if request.method == 'POST' and request.FILES.get('image'):
        try:
            session = ScanSession.objects.get(session_id=session_id)
            if session.is_completed:
                return JsonResponse({'status': 'error', 'message': 'Session already completed'}, status=400)
            
            session.image = request.FILES['image']
            session.is_completed = True
            session.save()

            # Start OCR in background thread
            threading.Thread(target=run_ocr_task, args=(session.session_id,)).start()

            return JsonResponse({'status': 'success', 'message': 'Image uploaded successfully'})
        except ScanSession.DoesNotExist:
            return JsonResponse({'status': 'error', 'message': 'Invalid session'}, status=404)
    return JsonResponse({'status': 'error', 'message': 'No image provided'}, status=400)

def api_check_scan_status(request, session_id):
    try:
        session = ScanSession.objects.get(session_id=session_id)
        return JsonResponse({
            'status': 'success',
            'is_completed': session.is_completed,
            'image_url': request.build_absolute_uri(session.image.url) if session.image else None,
            'ocr_status': session.ocr_status,
            'ocr_data': session.ocr_data,
            'ocr_raw_text': session.ocr_raw_text
        })
    except ScanSession.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Invalid session'}, status=404)

def api_get_doctors(request):
    from django.db.models import Count
    doctors = PatientVitals.objects.exclude(dr_name__isnull=True).exclude(dr_name='').values('dr_name', 'dr_id').annotate(patient_count=Count('patient_id', distinct=True)).order_by('dr_name')
    return JsonResponse(list(doctors), safe=False)

